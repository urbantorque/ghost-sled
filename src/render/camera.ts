import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { WRECK_SLED } from './rider';
import { IDLE_FEEL, type Beat, type Feel } from '../game/beats';
import type { SimEvent } from '../sim/sim';

// Chase camera (ART.md section 8): leads into turns, breathes FOV with speed, rolls into carves,
// shakes on impacts, punches on perfect landings, orbits on a crash, frames portrait screens with a
// higher, wider view, eases a close rival into the frame, and on the results screen settles into a
// hero shot of the wreck.

export interface CamTarget {
  pos: Vector3;
  /** Direction of travel in three.js space (unit, horizontal). */
  dir: Vector3;
  speed: number;
  steer: number;
  airborne: boolean;
  boost: number;
  /** Title only: the nearest ghost to share the hero shot with (three.js world position). */
  mate?: Vector3 | null;
  /** Run only: the chest of the ghost the HUD's rival pill names (three.js world position). */
  rival?: Vector3 | null;
  /** Run start, 1 easing to 0: the chase rides higher and further back while the mood card shows. */
  intro?: number;
}

const smooth01 = (x: number) => {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * (3 - 2 * k);
};

export type CamMode = 'chase' | 'crash' | 'orbit' | 'hero';

/** Compass angle of a horizontal direction: 0 straight down the course (-z), positive toward +x. */
function azimuth(x: number, z: number): number {
  return Math.atan2(x, -z);
}

function wrapAngle(a: number): number {
  return a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
}

/** Results hero shot fallbacks, tried in order: heights above the wreck, then turns off the set view.
 *  The first is low, under the seated rider's eye line, so the rider and its upturned sled stand as
 *  one silhouette against the sky rather than being looked down on against a snow wall. */
const HERO_UPS = [0.45, 1.1, 2.0, 3.2];
const HERO_YAWS = [0, 0.4, -0.4, 0.8, -0.8];
/** By the treeline the lens starts a little higher, on the bank looking across at the wreck in front
 *  of the forest wall; the last is a crane shot over the canopy, for when every lower spot is walled in. */
const HERO_UPS_TREES = [0.6, 1.0, 1.5, 2.2, 3.2, 8];
/** How far the lens may stand back from the set distance (multiples of it) before it gives up on a
 *  level shot: a wreck in the forest is framed from out on the open course through the treeline
 *  rather than from a crane straight above it. */
const HERO_BACKS = [1, 1.6, 2.2];
/** Metres past the corridor's edge where the forest wall begins (FOREST_LIMIT plus a little). */
const TREELINE = 10.3;
/** A hero framing that cannot see the wreck at all. */
const HERO_BLOCKED = 99;

export class ChaseCamera {
  readonly camera: PerspectiveCamera;
  mode: CamMode = 'chase';
  private pos = new Vector3();
  private look = new Vector3();
  private dirS = new Vector3(0, 0, -1);
  private fov = 64;
  private roll = 0;
  private shakeAmp = 0;
  private punch = 0;
  private aspect = 16 / 9;
  private orbitAngle = 0;
  /** Desktop title: the eased sweep around the hero (it steers a sharing ghost clear of the logo). */
  private sweepS = 0;
  /** Phone title: the eased screen position of the hero (left of centre, or across from a ghost). */
  private heroXS = 0;
  /** Results hero shot: the clear framing in use (a turn off the set view, and a height). */
  private heroPicked = false;
  private heroYaw = 0;
  private heroUp = HERO_UPS[0];
  private heroBack = 1;
  /** Where the wreck was when the framing was picked: it is picked again once the wreck has slid on
   *  (a framing picked while it still tumbled could end up with a trunk across the settled rider). */
  private heroFrom = new Vector3();
  /** Scratch: the turns a hero pick tries (the culprit's first, when there is one). */
  private heroYawList: number[] = [];
  /** Compass direction the results hero shot looks along (the wreck turns its profile to it). */
  heroAz = 0;
  /** Portrait results (contract C6): the share of the height, from the top, that the card leaves
   *  open for the hero shot (the safe-area inset included); the wreck is centred in that band. */
  heroBand = 0.28;
  /** The eased look-ahead point of the landscape chase, before the rival bias turns the view. */
  private lookS = new Vector3();
  /** Sell top fix 1: the eased turn (radians, + toward screen right) and extra FOV (degrees) that
   *  keep a close rival in the frame. */
  private rivalYaw = 0;
  private rivalFov = 0;
  /** The eased sideways step (metres, + to the right) that shows a drafted ghost beside the rider. */
  private slipX = 0;
  /** Eased 0 to 1: airborne, and a chaser close behind in your lane (the lens eases back for each). */
  private airK = 0;
  private chaseK = 0;
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private tmp3 = new Vector3();
  private tmp4 = new Vector3();
  private mateV = new Vector3();
  private crowd = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  private crowdN = 0;
  private lastFocus = new Vector3();
  private initialized = false;
  /** Terrain height at a three.js (x, z), so low title shots never sink into a bank. */
  ground: ((x: number, z: number) => number) | null = null;
  /** The course corridor at a three.js z: its centre x and half width (the results shot of a wreck
   *  in the trees is taken from the open course side). */
  corridor: ((z: number) => { x: number; hw: number }) | null = null;
  /** Whether a prop stands within `r` metres of a three.js (x, z): the results shot keeps its lens
   *  clear of the trees. */
  blocked: ((x: number, z: number, r: number) => boolean) | null = null;
  /** Where the sun disc sits (unit, three.js space): the phone title turns toward it. */
  sun: Vector3 | null = null;

  constructor() {
    this.camera = new PerspectiveCamera(64, 16 / 9, 0.3, 5200);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  shake(amount: number): void {
    this.shakeAmp = Math.min(1.2, this.shakeAmp + amount);
  }

  kick(amount: number): void {
    this.punch = Math.min(1, this.punch + amount);
  }

  /** This frame's feel from the director (reduced motion, time scale, streak); set by beats(). */
  feel: Feel = IDLE_FEEL;

  /** The camera's reactions to raw sim events: kicks on boosts and perfect landings, shakes on impacts. */
  onSimEvent(e: SimEvent): void {
    switch (e.type) {
      case 'land':
        if (e.quality === 'perfect') {
          this.kick(0.9);
          this.shake(0.25);
        } else if (e.quality === 'clean') this.shake(Math.min(0.5, e.impact * 0.03));
        else if (e.quality === 'sketchy') this.shake(0.55);
        break;
      case 'crash':
        this.shake(1.1);
        break;
      case 'bump':
        this.shake(0.5);
        break;
      case 'boost':
        this.kick(0.35);
        break;
      default:
        break;
    }
  }

  /** This frame's named moments and feel, every frame after the raw events. Never keeps the list. */
  beats(_list: readonly Beat[], feel: Feel): void {
    this.feel = feel;
  }

  /** A positional knock in camera space (metres right, up and back). Scaffold: no-op. */
  jolt(_right: number, _up: number, _back: number): void {
    // (The spring lands with the camera's weight work.)
  }

  /** Clears held feel (a freeze, a jolt) on revive and at a run's start. Scaffold: nothing is held. */
  resetFeel(): void {
    // (Nothing held yet.)
  }

  /** The current lens roll in radians, for probes. */
  get rollNow(): number {
    return this.roll;
  }

  /** Title: the nearest live ghost to the hero (sim coordinates in, three.js out), or null. Also
   *  notes up to four ghosts around the hero that are visible (not faded onto it), for the desktop
   *  shot to keep clear of the logo. */
  pickMate(hero: { x: number; y: number; z: number }, poses: Iterable<{ x: number; y: number; z: number; done: boolean } | null>): Vector3 | null {
    let best = 70 * 70;
    let found = false;
    this.crowdN = 0;
    for (const p of poses) {
      if (!p || p.done) continue;
      const dx = p.x - hero.x;
      const dz = p.z - hero.z;
      const d2 = dx * dx + dz * dz;
      // Within about 1.5 m of the hero the reel's ghost layer holds a ghost at a faint 15%: not worth
      // steering for. That rule measures in 3D, so a ghost flying high over the hero still counts.
      const dy = p.y - hero.y;
      if (d2 + dy * dy > 1.5 * 1.5 && d2 < 30 * 30 && this.crowdN < this.crowd.length) this.crowd[this.crowdN++].set(p.x, p.y, -p.z);
      // A ghost sitting on the hero fades out (DECISIONS #34), so it cannot share the shot.
      if (d2 < 1.6 * 1.6 || d2 >= best) continue;
      best = d2;
      found = true;
      this.mateV.set(p.x, p.y, -p.z);
    }
    return found ? this.mateV : null;
  }

  snap(t: CamTarget): void {
    this.initialized = false;
    this.update(t, 1 / 60);
  }

  /** Look from `from` along compass `yaw`, pitched so a point at elevation angle `elev` (from the
   *  camera) lands `ndcY` above (+) or below (-) the middle of the screen. `horizonMin`, when given,
   *  caps the look-down so the horizon never climbs above that fraction of the height (from the top). */
  private aimAt(lookAt: Vector3, from: Vector3, yaw: number, elev: number, ndcY: number, horizonMin?: number, lowest?: number): void {
    const tanHalf = Math.tan(MathUtils.degToRad(this.fov) / 2);
    let pitch = elev - Math.atan(ndcY * tanHalf);
    if (horizonMin !== undefined) pitch = Math.max(pitch, -Math.atan((1 - 2 * horizonMin) * tanHalf));
    // ...but never so far that the aim point drops below `lowest` (NDC) and out of the bottom of the frame.
    if (lowest !== undefined) pitch = Math.min(pitch, elev - Math.atan(lowest * tanHalf));
    const c = Math.cos(pitch) * 10;
    lookAt.set(from.x + Math.sin(yaw) * c, from.y + Math.sin(pitch) * 10, from.z - Math.cos(yaw) * c);
  }

  update(t: CamTarget, dt: number): void {
    const portrait = this.aspect < 1;
    const speedK = MathUtils.clamp((t.speed - 8) / 30, 0, 1);
    // Smooth the travel direction so the camera leads gently.
    this.dirS.lerp(t.dir, 1 - Math.exp(-dt * 3.2)).normalize();
    const desired = this.tmp;
    const lookAt = this.tmp2;
    const tanHalf = Math.tan(MathUtils.degToRad(this.fov) / 2);
    const tanHalfW = tanHalf * this.aspect;
    const travelAz = azimuth(this.dirS.x, this.dirS.z);
    if (this.mode !== 'hero') this.heroPicked = false;

    if (this.mode === 'chase' && portrait) {
      // Portrait (contract C3): close behind and high, so the rider is big enough to read its pose
      // and scarf on a phone, pitched so the rider's middle always sits at 58% of the height (the
      // avalanche mirror hangs in the sky above it) and the horizon near 30%: most of the screen
      // goes to the corridor ahead rather than to sky.
      // The eased follow trails the set point by speed / 9 m; most of that is led back in, or at
      // speed the rider would shrink and the horizon climb back up the screen.
      const back = 3.5 + speedK * 0.4 - Math.min(t.speed, 45) * 0.083;
      const up = 3.0 + speedK * 0.2 + (t.airborne ? 0.4 : 0);
      desired.copy(t.pos).addScaledVector(this.dirS, -back);
      desired.y += up;
      this.aimAt(lookAt, desired, travelAz, Math.atan2(t.pos.y + 0.55 - desired.y, back), -0.16);
      // (Re-aimed from the eased position below.)
    } else if (this.mode === 'chase') {
      // Close and low, so the rider's lean, scarf and spray read at thumbnail size: about 1.35 times
      // the old framing at every speed. The eased follow trails the set point by speed / 9 m and a
      // quarter of that is led back in, so the rider still eases back a little as it gathers speed.
      // The look-ahead point leads the view into turns; the pitch is set below. For the first
      // seconds of a run (the mood card's reveal) the lens rides higher and further back, so the
      // rider's head sits below the far end of the corridor instead of covering it, then pushes in.
      const intro = t.intro ?? 0;
      // In the air the lens eases back and stays lower than it used to climb, so the ghosts on the
      // snow below share the frame with the rider (high and close, the rider and sled filled the
      // middle while the pack was a few specks in a corner).
      this.airK += ((t.airborne ? 1 : 0) - this.airK) * (1 - Math.exp(-dt * 3));
      // While you lead, a chaser close behind in your lane eases the lens back and up (at most about
      // 0.6 m) so its head and wisp come into the bottom of the frame: with no ghost in view a
      // frame sold a mood but not the race. The rider's height on screen is solved below (C3).
      let chaseT = 0;
      const cg = t.rival;
      if (cg) {
        const ax = cg.x - t.pos.x;
        const az = cg.z - t.pos.z;
        const along = ax * this.dirS.x + az * this.dirS.z;
        const lat = ax * -this.dirS.z + az * this.dirS.x;
        chaseT = smooth01((-along - 0.4) / 1.2) * (1 - smooth01((-along - 5) / 3)) * (1 - smooth01((Math.abs(lat) - 2.4) / 1.2));
      }
      this.chaseK += (chaseT - this.chaseK) * (1 - Math.exp(-dt * 1.5));
      const back = 2.2 - Math.min(t.speed, 45) * 0.026 + intro * 1.1 + this.airK * 0.7 + this.chaseK * 0.6;
      const up = 1.05 + speedK * 0.2 + this.airK * 0.05 + intro * 1.0 + this.chaseK * 0.3;
      desired.copy(t.pos).addScaledVector(this.dirS, -back);
      desired.y += up;
      // ...and a little to one side: from straight behind, the far end of the corridor sat right
      // behind the rider's back however high the lens rode.
      desired.x += -this.dirS.z * intro * 1.0;
      desired.z += this.dirS.x * intro * 1.0;
      // A ghost you are drafting rides squarely ahead, right behind the rider on screen: the lens
      // eases up to 0.8 m aside (toward the carve, else toward the ghost's own side), so the
      // slipstreamed ghost shows beside the rider rather than behind its back.
      let slipT = 0;
      const g = t.rival;
      if (g) {
        const ax = g.x - t.pos.x;
        const az = g.z - t.pos.z;
        const along = ax * this.dirS.x + az * this.dirS.z;
        const lat = ax * -this.dirS.z + az * this.dirS.x;
        const k = smooth01((along - 1.5) / 1) * (1 - smooth01((along - 9) / 3)) * (1 - smooth01((Math.abs(lat) - 0.7) / 0.5));
        slipT = k * 0.8 * (Math.abs(t.steer) > 0.2 ? Math.sign(t.steer) : Math.sign(lat) || 1);
      }
      this.slipX += (slipT - this.slipX) * (1 - Math.exp(-dt * 2));
      desired.x += -this.dirS.z * this.slipX;
      desired.z += this.dirS.x * this.slipX;
      lookAt.copy(t.pos).addScaledVector(this.dirS, 6.5 + speedK * 5);
      lookAt.y += 0.25;
    } else if (this.mode === 'crash') {
      // Slow drift around the wreck.
      this.orbitAngle += dt * 0.55;
      const r = 7.5;
      desired.set(t.pos.x + Math.sin(this.orbitAngle) * r, t.pos.y + 3.2, t.pos.z + Math.cos(this.orbitAngle) * r);
      lookAt.copy(t.pos);
    } else if (this.mode === 'hero') {
      this.heroShot(t, desired, lookAt, tanHalfW, travelAz);
    } else {
      this.orbitAngle += dt * 0.16;
      if (portrait) this.phoneTitle(t, desired, lookAt, dt, tanHalfW, travelAz);
      else this.desktopTitle(t, desired, lookAt, dt, tanHalfW, travelAz);
    }

    if (!this.initialized) {
      this.pos.copy(desired);
      this.look.copy(lookAt);
      this.lookS.copy(lookAt);
      this.initialized = true;
    } else if (this.mode === 'orbit') {
      // Carry the shot along with the hero so the slow orbit easing frames it instead of trailing
      // a fast rider by several metres. A jump (the lead changing hands) is left to the easing.
      const step = this.tmp4.subVectors(t.pos, this.lastFocus);
      if (step.lengthSq() < (t.speed * dt * 1.5 + 0.2) ** 2) {
        this.pos.add(step);
        this.look.add(step);
      }
    }
    this.lastFocus.copy(t.pos);
    const kPos = 1 - Math.exp(-dt * (this.mode === 'chase' ? 9 : this.mode === 'orbit' ? 7 : 2.5));
    const kLook = 1 - Math.exp(-dt * (this.mode === 'chase' ? 14 : 3));
    const y0 = this.pos.y;
    this.pos.lerp(desired, kPos);
    // The chase height follows faster than the trail: dropping out of a jump, the rider would
    // otherwise leave the lens high above it, staring down onto the landing.
    if (this.mode === 'chase') this.pos.y = y0 + (desired.y - y0) * (1 - Math.exp(-dt * 16));
    // Never dip below the snow just behind the sled (the title orbit keeps its own ground clearance).
    // (The hero shot keeps its own clearance: on a phone it lies low on the snow downhill of the wreck,
    // and held 0.8 m over the wreck it looked down onto blank snow.)
    if (this.pos.y < t.pos.y + 0.8 && this.mode !== 'orbit' && this.mode !== 'hero') this.pos.y = t.pos.y + 0.8;
    // Nor into the snow under the lens or halfway to the rider: just past a kicker or a bank lip the
    // mound behind the rider can stand higher than the rider itself, and the lens sank into it, the
    // lower frame a flat slab of terrain with its dark underside showing.
    if (this.mode === 'chase' && this.ground) {
      const mx = (this.pos.x + t.pos.x) * 0.5;
      const mz = (this.pos.z + t.pos.z) * 0.5;
      // (A floor, not a height: the low chase lens skims 0.3 to 0.6 m over the snow behind the rider
      // on the steeper mountains, and a higher floor would have lifted every frame there.)
      this.pos.y = Math.max(this.pos.y, this.ground(this.pos.x, this.pos.z) + 0.2, this.ground(mx, mz) + 0.3);
    }
    if (this.mode === 'chase' && portrait) {
      // Aim from where the camera actually is (it trails the set distance by speed / 9 m), so the
      // rider holds its height on the screen at any speed; the eased position keeps it smooth.
      const hx = t.pos.x - this.pos.x;
      const hz = t.pos.z - this.pos.z;
      this.frameRival(t, travelAz, dt);
      this.aimAt(this.look, this.pos, travelAz + this.rivalYaw, Math.atan2(t.pos.y + 0.55 - this.pos.y, Math.hypot(hx, hz)), -0.16);
    } else if (this.mode === 'chase') {
      // The eased look point leads into turns; the pitch is set from where the camera actually is,
      // so the rider's middle holds about 61% of the height (its base clear of the hint and chip
      // row at the bottom) at any speed, on any pitch of slope and in the air. Only a hard look down
      // (onto a landing far below) is capped, so the sky and the sun stay in the frame. During the
      // run-start reveal the cap gives a little, down to just under the mood card.
      this.lookS.lerp(lookAt, kLook);
      const hx = t.pos.x - this.pos.x;
      const hz = t.pos.z - this.pos.z;
      const yaw = azimuth(this.lookS.x - this.pos.x, this.lookS.z - this.pos.z);
      this.frameRival(t, yaw, dt);
      const intro = t.intro ?? 0;
      // During the reveal the view also pitches up about 4 degrees (the rider sits a little lower), so
      // the mood's sky signature (the moon, the aurora, the comet) frames the mood card instead of
      // being cropped by the top edge.
      this.aimAt(this.look, this.pos, yaw + this.rivalYaw, Math.atan2(t.pos.y + 0.55 - this.pos.y, Math.hypot(hx, hz)), -0.22 - 0.13 * intro, 0.22 - 0.05 * intro);
    } else {
      this.look.lerp(lookAt, kLook);
      this.lookS.copy(this.look);
      this.frameRival(t, 0, dt);
    }

    // FOV: breathe with speed, kick on boosts and perfect landings.
    this.punch = Math.max(0, this.punch - dt * 2.4);
    let baseFov = 62 + speedK * 14 + t.boost * 4 + this.punch * 8 + this.rivalFov + (this.mode === 'chase' && this.aspect >= 1 ? this.airK * 4 : 0);
    if (this.mode === 'hero') {
      // A longer lens for the still hero shot: less distortion, a bigger sun. A phone's band is short
      // and narrow, so there the lens is wider: at 50 degrees it was a close-up of the rider alone.
      baseFov = portrait ? 72 : 50;
    } else if (portrait && this.mode === 'orbit') {
      // The phone title frames a rider and the sun, not a corridor to steer.
      baseFov = 78;
    } else if (portrait) {
      // Keep a usable horizontal field of view on tall screens.
      const hfov = 2 * Math.atan(Math.tan(MathUtils.degToRad(baseFov) / 2) * 1.6);
      baseFov = MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / Math.max(this.aspect, 0.4)));
      baseFov = Math.min(baseFov, 96);
    }
    this.fov += (baseFov - this.fov) * (1 - Math.exp(-dt * 5));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // The hero shot is level: a roll held over from the last carve tilted the wreck's horizon.
    const rollT = this.mode === 'hero' ? 0 : -t.steer * 0.07 * (0.4 + speedK);
    this.roll += (rollT - this.roll) * (1 - Math.exp(-dt * 4));
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.2);
    const sh = this.shakeAmp * this.shakeAmp;
    const time = performance.now() / 1000;
    const ox = Math.sin(time * 47) * sh * 0.25 + Math.sin(time * 23) * sh * 0.12;
    const oy = Math.cos(time * 41) * sh * 0.2;

    this.camera.position.set(this.pos.x + ox, this.pos.y + oy, this.pos.z);
    this.camera.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    this.camera.lookAt(this.look);
  }

  /** Sell top fix 1, put the rivals in the frame: the ghost the HUD's rival pill names used to sit
   *  just off the edge whenever it rode beside you. Within about 12 m the view eases round toward
   *  it, by the least turn that brings it inside the frame while the rider stays within the middle
   *  40% of the width (C3 and the desktop placement keep their heights: only the yaw moves), plus a
   *  few degrees of FOV when the turn alone is not enough. A ghost level with the lens or behind it
   *  cannot be framed from a chase camera and is left to the edge marker. The turn eases over about
   *  half a second, so it never snaps against the player's own steering. */
  private frameRival(t: CamTarget, yaw: number, dt: number): void {
    let yawT = 0;
    let fovT = 0;
    const g = t.rival;
    if (g && this.mode === 'chase') {
      const fx = Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const gx = g.x - this.pos.x;
      const gz = g.z - this.pos.z;
      const depth = gx * fx + gz * fz;
      const dist = Math.hypot(g.x - t.pos.x, g.z - t.pos.z);
      const w = (1 - smooth01((dist - 11) / 4)) * smooth01((depth - 0.5) / 1.0);
      if (w > 0.001) {
        const tanHalfW = Math.tan(MathUtils.degToRad(this.fov) / 2) * this.aspect;
        // Bearings off the unturned view axis (+ to the right).
        const aG = Math.atan2(gx * -fz + gz * fx, depth);
        const rx = t.pos.x - this.pos.x;
        const rz = t.pos.z - this.pos.z;
        const aR = Math.atan2(rx * -fz + rz * fx, Math.max(0.3, rx * fx + rz * fz));
        // The rider may slide out to a third of the way across, the rival framed on the other third.
        const limR = Math.atan(0.4 * tanHalfW);
        const limG = Math.atan(0.75 * tanHalfW);
        const lo = Math.max(aR - limR, aG - limG);
        const hi = Math.min(aR + limR, aG + limG);
        let b: number;
        if (lo <= hi) b = MathUtils.clamp(0, lo, hi);
        else {
          // Too wide to frame both by turning: the rider goes to its band's edge and the lens widens.
          // A rival far beyond even that is left to the edge marker, rather than shoving the rider
          // aside for a ghost that stays out of frame anyway.
          const over = lo - hi;
          const reach = 1 - smooth01((over - 0.08) / 0.1);
          b = (aG > aR ? aR + limR : aR - limR) * reach;
          fovT = Math.min(8, MathUtils.radToDeg(over) * 2.4) * reach;
        }
        yawT = MathUtils.clamp(b, -0.42, 0.42) * w;
        fovT *= w;
      }
    }
    this.rivalYaw += (yawT - this.rivalYaw) * (1 - Math.exp(-dt * 3));
    this.rivalFov += (fovT - this.rivalFov) * (1 - Math.exp(-dt * 2.5));
  }

  /** Results hero shot. Wide screens (contract C4): the panel owns the right ~58%, so the wreck
   *  is framed in the middle of the left ~40% (its middle about a fifth of the way across and just
   *  under half way down: low in the corner it read as cropped) from a close, low lens beside it,
   *  looking down the course into the low sun with the ridges behind; the rider sits up facing the
   *  lens at three-quarters. Portrait (contract C6): the card leaves the top ~28% open, and the wreck
   *  is centred in that band from a lens lying low on the snow down the slope, looking back up at it:
   *  only from below does the band show sky over the rider's head (from above, or across the slope,
   *  it saw only snow), and the low sun ahead of the course lights the rider's front. The seated
   *  rider and its overturned sled are framed as a pair (rider.ts lays the sled beside the rider,
   *  toward the middle of the frame). A crash usually ends against a bank or in the trees, where the
   *  set framing can look into the snow or a trunk: then the shot swings round, climbs and stands
   *  back until it sees the wreck with no tree in its near frame, and holds that framing while it
   *  stays clear so it never hunts. */
  private heroShot(t: CamTarget, desired: Vector3, lookAt: Vector3, tanHalfW: number, travelAz: number): void {
    const portrait = this.aspect < 1;
    const cor = this.corridor?.(t.pos.z);
    // Wide: half way from the wreck's heading to straight down the course (a rider who crashed
    // across the slope would otherwise have the shot stare into a bank instead of at the sun).
    // Portrait: from down the slope, looking back up at the wreck, a little across.
    let base = MathUtils.clamp(travelAz * 0.5, -0.5, 0.5);
    if (portrait) base = Math.PI + (cor && t.pos.x > cor.x ? 0.4 : -0.4);
    let off = portrait ? 0 : Math.atan(0.58 * tanHalfW);
    // A wreck up the bank or in the treeline: the set view from behind would sit in the trees (every
    // trunk near the lens dissolving), so the lens moves round to the open course side, uphill of the
    // wreck, and looks down and out at it with the forest behind.
    let ups = HERO_UPS;
    let treeline = false;
    if (cor && Math.abs(t.pos.x - cor.x) - cor.hw > 1.5) {
      const s = Math.sign(cor.x - t.pos.x);
      // The pair a little in from the left edge (in the trees it read as jammed into the corner).
      off = Math.atan(0.5 * tanHalfW);
      // toward = yaw - off; a negative toward puts the lens on the +x side (see heroPlace).
      base = off - s * 0.85;
      ups = HERO_UPS_TREES;
      treeline = true;
    }
    // The rider and its upturned sled fill the left column on a wide screen (at 5.5 m they sat small
    // over blank snow; at 4.5 m with the old framing the rider was cut by the left edge), and about
    // half the open band on a phone, close enough that the beanie stays in the band. By the treeline
    // the lens stands further out and lower on the open slope, so the forest wall reads as a row of
    // trunks behind the wreck with sky between them rather than canopy over the lens.
    const r = portrait ? 6.4 : treeline ? 6.6 : 4.4;
    const aim = this.tmp4;
    if (!this.heroPicked || this.heroFrom.distanceToSquared(t.pos) > 0.36 || !this.heroPlace(t.pos, base + this.heroYaw, off, this.heroUp, r * this.heroBack, desired, aim)) {
      this.heroPicked = true;
      this.heroFrom.copy(t.pos);
      // The tree or rock the wreck hit, when there is one: the first turn tried looks past the wreck
      // at it, so the shot tells the story (as long as that keeps the low sun ahead of the lens).
      const yaws = this.heroYawList;
      yaws.length = 0;
      const cAz = portrait ? null : this.culprit(t.pos);
      if (cAz !== null) {
        const yc = wrapAngle(cAz + off - base);
        if (Math.abs(yc) < 0.9) yaws.push(yc);
      }
      for (const y of HERO_YAWS) yaws.push(y);
      // Every height and turn at the set distance first, then the same standing further back. The
      // first framing with nothing in the way wins; failing that, the one with the least foliage in
      // its near frame (a lens with a tree right by it is never taken). The crane over the canopy is
      // the last resort.
      let best = HERO_BLOCKED;
      for (let m = 0; m < HERO_BACKS.length && best > 0; m++) {
        for (let i = 0; i < ups.length && best > 0; i++) {
          if (ups[i] > 5) continue;
          for (let j = 0; j < yaws.length && best > 0; j++) {
            const cost = this.heroCost(t.pos, base + yaws[j], off, ups[i], r * HERO_BACKS[m], desired, aim, tanHalfW);
            if (cost < best) {
              best = cost;
              this.heroYaw = yaws[j];
              this.heroUp = ups[i];
              this.heroBack = HERO_BACKS[m];
            }
          }
        }
      }
      // Walled in on every side: the highest straight shot, looking down onto the wreck.
      if (best >= HERO_BLOCKED) {
        this.heroYaw = 0;
        this.heroUp = ups[ups.length - 1];
        this.heroBack = 1;
      }
      this.heroPlace(t.pos, base + this.heroYaw, off, this.heroUp, r * this.heroBack, desired, aim);
    }
    const yaw = base + this.heroYaw;
    this.heroAz = yaw;
    const elev = Math.atan2(aim.y - desired.y, Math.hypot(aim.x - desired.x, aim.z - desired.z));
    // Wide: the wreck's middle sits just under half way down. On a steep pitch the low lens sits
    // well above it (behind is uphill), so the look down is capped: the wreck drops a little lower
    // instead and the whole sun disc stays in the sky above it, though never below two thirds of the
    // way down: from a raised fallback lens (over a bump, by the treeline, the crane over the forest)
    // the shot looks down at the wreck instead, or it sank to the bottom corner. Portrait: the middle
    // of the open band.
    // (Portrait: a touch below the band's middle, so the beanie and the dazed stars clear the top.)
    if (portrait) this.aimAt(lookAt, desired, yaw, elev, 1 - this.heroBand * 1.14);
    else this.aimAt(lookAt, desired, yaw, elev, treeline ? -0.02 : -0.1, this.heroUp > 1.4 ? undefined : 0.37, -0.32);
  }

  /** The compass direction from the wreck to the nearest tree or rock within about 3 m of it (the
   *  thing it hit, most likely), or null. Asked once per hero pick. */
  private culprit(focus: Vector3): number | null {
    const blocked = this.blocked;
    if (!blocked) return null;
    for (const d of [1.1, 1.9, 2.8]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        if (blocked(focus.x + Math.sin(a) * d, focus.z - Math.cos(a) * d, 0.5)) return a;
      }
    }
    return null;
  }

  /** How much a candidate hero framing has in its way: HERO_BLOCKED when it cannot see the wreck
   *  (snow in the sight line, a lens deep in the forest wall or a tree right by it), else one for
   *  each spot in its near frame where a tree or rock stands: on the sight line to the wreck, and in
   *  a fan a few metres out across the view, where a trunk fills half the frame with dark cone (or,
   *  dissolving, with flat grey polygons that read as clipping). 0 is a clear view. */
  private heroCost(focus: Vector3, yaw: number, off: number, up: number, r: number, desired: Vector3, aim: Vector3, tanHalfW: number): number {
    if (!this.heroPlace(focus, yaw, off, up, r, desired, aim, true)) return HERO_BLOCKED;
    const blocked = this.blocked;
    if (!blocked || up >= 5) return 0;
    let cost = 0;
    for (let k = 1; k <= 3; k++) {
      // Out by the lens a canopy covers the frame; by the wreck a trunk stands across the rider.
      const f = 0.25 * k + 0.05;
      if (blocked(desired.x + (aim.x - desired.x) * f, desired.z + (aim.z - desired.z) * f, k === 3 ? 0.9 : 1.7)) cost++;
    }
    // A trunk right in front of the wreck hides the rider whole (a forest crash framed with a pine
    // between the lens and the rider showed only the dazed stars): that costs the most.
    for (const f of [0.88, 0.95]) {
      if (blocked(desired.x + (aim.x - desired.x) * f, desired.z + (aim.z - desired.z) * f, 0.7)) cost += 3;
    }
    const spread = Math.atan(0.7 * tanHalfW);
    const d = Math.min(4, r * 0.75);
    for (let k = -1; k <= 1; k++) {
      if (blocked(desired.x + Math.sin(yaw + k * spread) * d, desired.z - Math.cos(yaw + k * spread) * d, 2.2)) cost++;
    }
    return cost;
  }

  /** Puts the hero camera (into `desired`) looking along compass `yaw`, `r` metres from the wreck
   *  and `up` metres above it, with the pair (the seated rider and the sled laid beside it, whose
   *  middle goes into `aim`) `off` left of centre; true when nothing but air lies between the lens
   *  and `aim` (and, `strict`, no prop stands right by the lens). */
  private heroPlace(focus: Vector3, yaw: number, off: number, up: number, r: number, desired: Vector3, aim: Vector3, strict = false): boolean {
    const fx = Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const sr = WRECK_SLED.right * WRECK_SLED.side * 0.5;
    const sa = WRECK_SLED.away * 0.5;
    aim.set(focus.x - fz * sr + fx * sa, focus.y + (this.aspect < 1 ? 0.5 : 0.4), focus.z + fx * sr + fz * sa);
    const toward = yaw - off;
    desired.set(aim.x - Math.sin(toward) * r, focus.y + up, aim.z + Math.cos(toward) * r);
    if (!this.ground) return true;
    // A portrait shot sits low on its own patch of snow, downhill of the wreck, looking back up at it
    // at about seat height: low enough that the rider's head and shoulders stand above the slope's
    // vanishing line, against the sky, high enough to see the face over the legs (lying on the snow
    // it saw two boot soles in the lens).
    if (this.aspect < 1) desired.y = this.ground(desired.x, desired.z) + 0.5 + up * 0.3;
    desired.y = Math.max(desired.y, this.ground(desired.x, desired.z) + (this.aspect < 1 ? 0.3 : 0.35));
    // Below the canopy, a lens inside the forest wall sees only the trunks around it.
    const cor = up < 5 ? this.corridor?.(desired.z) : null;
    if (cor && Math.abs(desired.x - cor.x) - cor.hw > TREELINE) return false;
    // While picking, no tree or rock within a few metres of the lens either.
    if (strict && up < 5 && this.blocked?.(desired.x, desired.z, 3.8)) return false;
    // The snow must clear the sight lines to the pair's middle and to the rider's chest, with a
    // margin: a low lens over a rise saw only the dazed stars above a rider hidden behind the snow.
    const cy = focus.y + 0.45;
    for (let k = 1; k < 12; k++) {
      const f = k / 12;
      const x = desired.x + (aim.x - desired.x) * f;
      const z = desired.z + (aim.z - desired.z) * f;
      if (this.ground(x, z) + 0.15 > desired.y + (aim.y - desired.y) * f) return false;
      const rx = desired.x + (focus.x - desired.x) * f;
      const rz = desired.z + (focus.z - desired.z) * f;
      if (this.ground(rx, rz) + 0.15 > desired.y + (cy - desired.y) * f) return false;
    }
    return true;
  }

  /** Phone title (contract C5): the logo owns the top fifth of a tall screen and the Ride button
   *  the bottom, so the hero gets the band from 45 to 60% of the height. The camera sits low behind
   *  it and looks down the course, turned toward the low sun, so the sun and the layered ridges hang
   *  in the sky above the rider and the lit snow and its long shadow fill the foreground. A ghost
   *  racing alongside shares the shot: the hero shifts to the other side to make room for it. */
  private phoneTitle(t: CamTarget, desired: Vector3, lookAt: Vector3, dt: number, tanHalfW: number, travelAz: number): void {
    let yaw = travelAz;
    if (this.sun) {
      // The sun just right of centre, under the tagline; never so far round that the course leaves the frame.
      const want = azimuth(this.sun.x, this.sun.z) - Math.atan(0.3 * tanHalfW);
      yaw = travelAz + MathUtils.clamp(wrapAngle(want - travelAz), -0.4, 0.4);
    }
    yaw += Math.sin(this.orbitAngle) * 0.06;
    // Close and low: the hero and the ghost beside it stand larger in their band, and the lit snow and
    // the hero's groove fill the band down to the tagline (from 1.15 m up it was a fog gradient).
    const r = 4.6;
    let heroX = -0.08;
    let near = Infinity;
    for (let i = 0; i < this.crowdN; i++) {
      const mx = this.crowd[i].x - t.pos.x;
      const mz = this.crowd[i].z - t.pos.z;
      const along = mx * Math.sin(yaw) - mz * Math.cos(yaw);
      const lat = mx * Math.cos(yaw) + mz * Math.sin(yaw);
      // Only a ghost roughly abreast fits: one further back sits behind the hero's sled from here.
      if (along < -0.8 || along > 8 || Math.abs(lat) > 4.5 || mx * mx + mz * mz > near) continue;
      near = mx * mx + mz * mz;
      heroX = lat > 0 ? -0.32 : 0.32;
    }
    // Shift across gently when the ghost alongside changes sides.
    this.heroXS = this.initialized ? this.heroXS + (heroX - this.heroXS) * (1 - Math.exp(-dt * 1.5)) : heroX;
    const toward = yaw + Math.atan(this.heroXS * tanHalfW);
    desired.set(t.pos.x - Math.sin(toward) * r, t.pos.y + 0.95, t.pos.z + Math.cos(toward) * r);
    // Behind the hero is uphill: keep a little air under the lens, low enough that the slope
    // ahead and the hero's shadow fill the foreground.
    if (this.ground) desired.y = Math.max(desired.y, this.ground(desired.x, desired.z) + 0.5);
    // The hero's middle at about 53% of the height, so its sled clears the cards and Ride below 60%.
    this.aimAt(lookAt, desired, yaw, Math.atan2(t.pos.y + 0.5 - desired.y, r), -0.06);
  }

  /** Desktop title hero shot: a slow sweep behind and beside the lead rider, looking down the
   *  course into the low sun so riders read as silhouettes against the sky, close enough that the
   *  rider is the hero of the frame rather than a figure in the distance. The logo owns the left
   *  of the screen, so a ghost sharing the shot must land right of the hero: the sweep leans to
   *  whichever side puts it there. */
  private desktopTitle(t: CamTarget, desired: Vector3, lookAt: Vector3, dt: number, tanHalfW: number, travelAz: number): void {
    const side = this.tmp3.set(-this.dirS.z, 0, this.dirS.x);
    // Far enough back (and low) that the hero and its streaming scarf stand against the open sky
    // right of the menu cards, with the ghost racing it in the same shot at about two thirds of its
    // size: at 3.2 m the hero filled the frame behind the cards and the ghost read as a bystander.
    const r = 4.7;
    // Seen from sweep s the hero lies s radians left of the course, so the sweep rocks about the one
    // that puts the low sun a little right of the hero: the bloomed disc and the paling ridges hang
    // in the open sky over its shoulder (the frame ART.md section 11 asks for), not behind the
    // menu column and its scrim on the left. With the sun behind, the sweep opens on the hero's
    // left, where the field (which starts behind it) shows on the right.
    const sunRel = this.sun ? wrapAngle(azimuth(this.sun.x, this.sun.z) - travelAz) : Math.PI;
    const natural = Math.abs(sunRel) < 1.2 ? MathUtils.clamp(0.25 - sunRel + Math.sin(this.orbitAngle) * 0.2, -1.1, 1.1) : -Math.sin(this.orbitAngle) * 0.9;
    let target = natural;
    if (this.crowdN > 0) {
      let best = Infinity;
      for (let k = -8; k <= 8; k++) {
        const s = MathUtils.clamp(natural + k * 0.15, -1.15, 1.15);
        let cost = Math.abs(k);
        for (let i = 0; i < this.crowdN; i++) cost += this.logoClash(t.pos, this.crowd[i], s, r, side, tanHalfW) * 100;
        if (t.mate && t.mate.distanceToSquared(t.pos) < 64) cost += this.mateCost(t.pos, t.mate, s, r, side);
        if (cost < best) {
          best = cost;
          target = s;
        }
      }
    }
    this.sweepS = this.initialized ? this.sweepS + (target - this.sweepS) * (1 - Math.exp(-dt * 0.9)) : target;
    const sweep = this.sweepS;
    desired
      .copy(t.pos)
      .addScaledVector(this.dirS, -Math.cos(sweep) * r)
      .addScaledVector(side, Math.sin(sweep) * r);
    desired.y = t.pos.y + 1.0 + Math.sin(this.orbitAngle * 0.7) * 0.15;
    // Behind the hero is uphill: on a steep pitch that height alone would sink into the slope.
    if (this.ground) desired.y = Math.max(desired.y, this.ground(desired.x, desired.z) + 0.85);
    lookAt.copy(t.pos).addScaledVector(this.dirS, 5);
    lookAt.y += 1.25;
    // As the sweep swings, the hero drifts sideways in the frame. Turn just enough to keep it
    // between about 57 and 63% of the width: clear of the menu column on the left (the logo, and
    // for a returning player the mountain cards beside Ride, out to about 38%), its scarf included.
    const fx = lookAt.x - desired.x;
    const fz = lookAt.z - desired.z;
    const fl = Math.hypot(fx, fz) || 1;
    const hx = t.pos.x - desired.x;
    const hz = t.pos.z - desired.z;
    const heroAng = Math.atan2((hz * fx - hx * fz) / fl, (hx * fx + hz * fz) / fl);
    const turn = heroAng - MathUtils.clamp(heroAng, Math.atan(0.14 * tanHalfW), Math.atan(0.26 * tanHalfW));
    if (turn !== 0) {
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      lookAt.x = desired.x + fx * c - fz * s;
      lookAt.z = desired.z + fz * c + fx * s;
    }
  }

  /** How far, from the title camera at sweep `s`, the ghost racing the hero is from reading as its
   *  rival: nearly the hero's size on screen (level with it, 2 to 3 m off its shoulder) and to its
   *  right. Seen from straight behind, a ghost a few metres ahead was a third of the hero's size and
   *  read as a bystander. In sweep steps (each step of the sweep costs 1). */
  private mateCost(hero: Vector3, m: Vector3, s: number, r: number, side: Vector3): number {
    const cx = hero.x - this.dirS.x * Math.cos(s) * r + side.x * Math.sin(s) * r;
    const cz = hero.z - this.dirS.z * Math.cos(s) * r + side.z * Math.sin(s) * r;
    let fx = hero.x + this.dirS.x * 5 - cx;
    let fz = hero.z + this.dirS.z * 5 - cz;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const dh = (hero.x - cx) * fx + (hero.z - cz) * fz;
    const dm = (m.x - cx) * fx + (m.z - cz) * fz;
    if (dm < 1) return 6;
    const right = ((m.x - cx) * -fz + (m.z - cz) * fx) / dm - ((hero.x - cx) * -fz + (hero.z - cz) * fx) / Math.max(dh, 0.5);
    return Math.min(6, Math.abs(dh / dm - 0.92) * 18) + (right < 0 ? 2 : 0);
  }

  /** About 1 when, from the title camera at sweep `s`, ghost `m` would sit in the logo's corner
   *  (the left 35% of the width), a little when it is merely left of the hero, else 0. Turning to
   *  hold the hero in place is left out: it only ever moves both of them right. */
  private logoClash(hero: Vector3, m: Vector3, s: number, r: number, side: Vector3, tanHalfW: number): number {
    const cx = hero.x - this.dirS.x * Math.cos(s) * r + side.x * Math.sin(s) * r;
    const cz = hero.z - this.dirS.z * Math.cos(s) * r + side.z * Math.sin(s) * r;
    // View axis toward the look point 5 m down the course.
    let fx = hero.x + this.dirS.x * 5 - cx;
    let fz = hero.z + this.dirS.z * 5 - cz;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const screenX = (x: number, z: number): number => {
      const ax = x - cx;
      const az = z - cz;
      const fwd = ax * fx + az * fz;
      return fwd < 0.5 ? NaN : (ax * -fz + az * fx) / fwd / tanHalfW;
    };
    const mx = screenX(m.x, m.z);
    if (Number.isNaN(mx)) return 0;
    // Right of the hero is better still (toward the sun and the open slope), but only a mild preference.
    return (mx < -0.3 ? 1 : 0) + (mx < screenX(hero.x, hero.z) ? 0.04 : 0);
  }
}
