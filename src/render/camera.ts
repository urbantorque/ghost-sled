import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { WRECK_SLED } from './rider';
import { CRASH_FREEZE_S, CRASH_PACK_NEAR_M, IDLE_FEEL, type Beat, type Feel, type GhostRef, type PassWord } from '../game/beats';
import type { GhostPose } from '../game/ghosts';
import type { SimEvent } from '../sim/sim';

// Chase camera (ART.md section 8): leads into turns, breathes FOV with speed, rolls into carves,
// shakes on impacts, punches on perfect landings, orbits on a crash (holding the ghost that rides past
// your wreck in the frame with it), frames portrait screens with a higher, wider view, eases a close
// rival into the frame, and on the results screen settles into a hero shot of the wreck.
//
// Weight (the fun pass): landings sink the lens and nod the horizon, a bump knocks it sideways and
// rolls it, a whisker flinches it away and tips the horizon, a max drift's release throws it back and
// whips the horizon out of the lean, a stomp streak shakes harder and knocks the horizon side to side,
// passes lean it toward the ghost, and a crash holds the lens still (and out of the snow) while the
// rider tumbles away from it before the orbit. Knocks are jolts: a stiff spring
// (omega 22, zeta 0.5) integrated exactly, so it settles alike at any frame rate. The shake runs on
// its own clock, slowed by hit-stops and held by a held frame or a pause. Every kick, shake, jolt,
// roll and freeze is off under reduced motion (Feel.reduced); the speed FOV breathing stays.

export interface CamTarget {
  pos: Vector3;
  /** Direction of travel in three.js space (unit, horizontal). */
  dir: Vector3;
  speed: number;
  steer: number;
  airborne: boolean;
  boost: number;
  /** Run only: the drift, which leans the horizon into it (absent reads as not drifting). */
  drifting?: boolean;
  /** The drift's locked direction (-1 or 1, the sign steer takes). */
  driftDir?: number;
  /** The drift's slip angle (radians). */
  slip?: number;
  /** Title only: the nearest ghost to share the hero shot with (three.js world position). */
  mate?: Vector3 | null;
  /** Run only: the chest of the ghost the HUD's rival pill names (three.js world position). */
  rival?: Vector3 | null;
  /** Run start, 1 easing to 0: the chase rides higher and further back while the mood card shows. */
  intro?: number;
  /** Crash only: the chest of the ghost riding past your wreck (crashPack, three.js world position),
   *  which the crash orbit frames with the wreck; absent or null when none rides by. */
  pack?: Vector3 | null;
  /** Crash only: where you fell (the sim's crash spot, three.js), the line the pack's passes are told
   *  at; absent or null outside a crash. */
  fell?: Vector3 | null;
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

// The jolt spring: omega 22 rad/s, zeta 0.5, integrated exactly (closed form per frame).
const J_OMEGA = 22;
const J_A = J_OMEGA * 0.5;
const J_WD = J_OMEGA * Math.sqrt(1 - 0.25);
/** Peak displacement of the spring after a unit velocity impulse: a jolt's amount is its peak. */
const J_PEAK = (() => {
  const tp = Math.atan(J_WD / J_A) / J_WD;
  return (Math.exp(-J_A * tp) * Math.sin(J_WD * tp)) / J_WD;
})();
/** The lens may roll this far either way (ART.md section 8: about 4 degrees). */
const ROLL_MAX = 0.07;
/** Pass words that lean the lens toward the ghost (race-news). */
const NUDGE_WORDS: ReadonlySet<PassWord> = new Set<PassWord>(['slung', 'double', 'triple', 'streak', 'duelWon', 'heldOff']);
/** Bank kicks by tier (none for tier 0, nor for a bump bank). */
const BANK_KICK = [0, 0.15, 0.25, 0.4];
/** Drift release kicks by tier. */
const RELEASE_KICK = [0, 0.3, 0.5, 0.75];
/** The crash orbit: radius, height over the wreck, and drift (radians per second of scaled time). */
const ORBIT_R = 7.5;
const ORBIT_UP = 3.2;
const ORBIT_SPIN = 0.55;
/** The crash orbit's turn to face the pack: a start further than ORBIT_CUT (radians) from where the
 *  held lens stood is a cut, a nearer one a swing at ORBIT_EASE per second, at most ORBIT_SWING
 *  radians per second of scaled time. The orbit winds up over ORBIT_WIND seconds from the hold. */
const ORBIT_CUT = 0.6;
/** Facing the pack, the lens stays downhill of the wreck, at most this far (radians) off looking
 *  straight up the slope. */
const ORBIT_FACE = 0.9;
const ORBIT_EASE = 5;
const ORBIT_SWING = 3.6;
const ORBIT_WIND = 0.15;
/** The orbit rides along with a sliding wreck, winding in over this many seconds from the hold. */
const ORBIT_CARRY_WIND = 0.4;
/** Facing the pack, the lens sits low (this high over the wreck, about head height over the snow
 *  downhill of it) and looks a little over the wreck, so the slope it came down fills the frame with
 *  the ghosts riding down it. From the orbit's usual 3.2 m, the downhill lens stood 5 m over its own
 *  snow and looked down onto a sheet of white with the pack as specks at the top edge. */
const ORBIT_PACK_UP = 1.3;
const ORBIT_PACK_LOOK = 1.1;
/** The pack lens's search for a clear spot: radii (the orbit's, then closer), turns off the set
 *  facing (radians), and where along the line to the wreck a trunk would hide it. */
const PACK_RADII = [ORBIT_R, 5.5, 4];
const PACK_TURNS = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9];
const PACK_SIGHT = [0.35, 0.65];
/** No prop's foot this close to the pack lens (metres): props dissolve inside about 3.6 m of a lens. */
const PACK_CLEAR = 3.4;
/** The pack lens stays on the downhill side: at most this far (radians) off straight downhill. */
const PACK_DOWNHILL = 1.4;
/** The ghost that passes your wreck (CamTarget.pack) is looked for from CRASH_PACK_NEAR_M behind
 *  where you fell to this far past it (metres). */
const PACK_PAST_M = 6;
/** Framing it: the look eases toward the midpoint of the wreck and that ghost by up to PACK_LOOK, at
 *  PACK_LOOK_EASE per second (only once it is in front of the lens). */
const PACK_LOOK = 0.45;
const PACK_LOOK_EASE = 5;
/** ...and the lens narrows (eased in and out at PACK_ZOOM_EASE per second) until that ghost stands
 *  about PACK_TALL of the frame's height (of 1.6 widths on a phone, as the ghost layer measures
 *  size), as far as the wreck stays inside the middle 70% of the frame and the ghost inside 85%,
 *  never under PACK_FOV_MIN degrees. Feet to head, a seated ghost on its sled stands PACK_GHOST_H. */
const PACK_TALL = 0.1;
const PACK_FOV_MIN = 40;
const PACK_ZOOM_EASE = 4;
const PACK_GHOST_H = 1.55;
/** The wreck's extent over and under its middle (metres; the tumbling rider's limbs and its sled) and
 *  the share of the frame it stays in. */
const PACK_WRECK_UP = 0.9;
const PACK_WRECK_DOWN = 0.6;
const PACK_WRECK_IN = 0.7;
const PACK_GHOST_IN = 0.85;
/** The highest that ghost's chest sits in the frame (from the middle, 1 at the top edge: about 32% of
 *  the height from the top on a wide screen, 45% on a phone, whose race row hangs lower). */
const PACK_CHEST_TOP = [0.35, 0.1];
/** The pack tripod: when the ghost riding past will cross the line you fell on more than PACK_FORE_D
 *  metres from the wreck (the wreck slid on down the slope, or the ghost rides wide of it), the pack
 *  lens downhill of the wreck sees it only as a speck far up the slope as the HUD names it. The lens
 *  cuts instead to a tripod on the far side of that crossing from the wreck, TRIPOD_BACK metres out
 *  (the first clear of the trees) and TRIPOD_SIDE to one side (toward the course's middle first, so
 *  the ghost never hides the wreck), TRIPOD_UP over the snow: the ghost rides past the lens and on
 *  toward your wreck, the two lined up in the frame, and it is about 10 m out as it passes you. The
 *  lens stands over head height and looks down on it (from head height a ghost flying a kicker there
 *  rose into the HUD's race row), and only for a crossing within TRIPOD_REACH of the wreck (a pack
 *  riding 35 m wide of a wreck in the trees left the wreck a speck past the bottom of the frame). */
const PACK_FORE_D = 5;
const TRIPOD_BACK = [9, 11, 7];
const TRIPOD_SIDE = 3;
const TRIPOD_UP = 2.6;
const TRIPOD_REACH = 24;

/** Scratch for crashPack (Map.forEach with a module-level callback: no per-frame allocation). */
const packScan = { x: 0, z: 0, best: Infinity, p: null as GhostPose | null };
function scanPack(p: GhostPose | null): void {
  if (!p || p.done) return;
  const dz = p.z - packScan.z;
  if (dz < -CRASH_PACK_NEAR_M || dz > PACK_PAST_M) return;
  const dx = p.x - packScan.x;
  const d = dx * dx + dz * dz;
  if (d < packScan.best) {
    packScan.best = d;
    packScan.p = p;
  }
}

/** The crash orbit's pack (CamTarget.pack): the chest of the live ghost nearest where you fell (sim
 *  x and z), from CRASH_PACK_NEAR_M behind it to PACK_PAST_M past it, in three.js space into `out`;
 *  null when none rides there. */
export function crashPack(poses: ReadonlyMap<number, GhostPose | null>, x: number, z: number, out: Vector3): Vector3 | null {
  packScan.x = x;
  packScan.z = z;
  packScan.best = Infinity;
  packScan.p = null;
  poses.forEach(scanPack);
  // (Set by the callback, which the compiler's narrowing does not see.)
  const p = packScan.p as GhostPose | null;
  packScan.p = null;
  return p ? out.set(p.x, p.y + 0.8, -p.z) : null;
}

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
  /** The jolt spring in camera space (metres right, up, back) plus a roll (radians): displacement
   *  and velocity per axis. */
  private jx = 0;
  private jy = 0;
  private jz = 0;
  private jr = 0;
  private jvx = 0;
  private jvy = 0;
  private jvz = 0;
  private jvr = 0;
  /** The shake's own clock: real seconds times Feel.shakeScale (a pause or a held frame stops it). */
  private shakeT = 0;
  /** Scaled seconds the crash lens still holds still (CRASH_FREEZE_S after the crash beat). */
  private freezeLeft = 0;
  /** The crash beat's bearing to the nearest live ghost behind (pack-orbit), or null. */
  private orbitFrom: number | null = null;
  /** The crash orbit has taken over from the held lens (its angle seeded from where the lens was). */
  private orbitSeeded = false;
  /** Scaled seconds since the orbit took over from the hold (the swing winds up over ORBIT_WIND). */
  private orbitT = 0;
  /** The orbit angle a short swing is easing to (facing the pack), or null. */
  private orbitAim: number | null = null;
  private orbitR = ORBIT_R;
  private orbitUp = ORBIT_UP;
  /** The height the orbit eases to, and the eased lift of its look point over the wreck (and its
   *  target): low and looking up the slope while it faces the pack. */
  private orbitUpT = ORBIT_UP;
  private orbitLook = 0;
  private orbitLookT = 0;
  /** The radius the orbit eases to, and the radius packLens picked. */
  private orbitRT = ORBIT_R;
  private packR = ORBIT_R;
  /** The crash orbit's drift (radians per second; its sign is the way the pack swing went). */
  private orbitSpin = ORBIT_SPIN;
  /** Framing the ghost that passes your wreck: the eased weight of the look toward the wreck and
   *  pack's midpoint, the last pack seen (eased out toward it), the eased share of the long lens and
   *  the narrowest FOV (vertical degrees) it last allowed. */
  private packK = 0;
  private packAt = new Vector3();
  private packZoom = 0;
  private packFov = 0;
  /** This frame's crash orbit cut to face the pack (the FOV stands at its framing at once). */
  private packCut = false;
  /** The crash lens stands on the pack tripod (at tripodAt) instead of orbiting. */
  private tripod = false;
  private tripodAt = new Vector3();
  /** Raw events this frame that a beat may take over: a perfect landing (the stomp beat kicks by
   *  streak) and a drift boost (the release beat kicks by tier). Settled in beats(). */
  private pendPerfect = false;
  private pendDriftKick = 0;
  /** Ghosts the lens already leaned toward this frame (a duel result and its pass are one nudge). */
  private nudged: number[] = [];
  /** The applied roll this frame (eased roll plus the bump's impulse, clamped). */
  private rollOut = 0;
  private lens = new Vector3();
  private lookT = new Vector3();
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

  /** A shake (off under reduced motion; the world's rumbles come through here too). */
  shake(amount: number): void {
    if (this.feel.reduced) return;
    this.shakeAmp = Math.min(1.2, this.shakeAmp + amount);
  }

  /** A FOV punch (off under reduced motion). */
  kick(amount: number): void {
    if (this.feel.reduced) return;
    this.punch = Math.min(1, this.punch + amount);
  }

  /** This frame's feel from the director (reduced motion, time scale, streak); set by beats(). */
  feel: Feel = IDLE_FEEL;

  /** The camera's reactions to raw sim events: shakes on impacts, a sink on clean and sketchy
   *  landings, and boost kicks. A perfect landing's kick and a drift boost's are left to their beats
   *  (the stomp kicks by streak, the release by tier), with today's numbers as the fallback when no
   *  beat names them. Called before beats() each frame, so it reads the last frame's feel. */
  onSimEvent(e: SimEvent): void {
    switch (e.type) {
      case 'land':
        if (e.quality === 'perfect') {
          this.pendPerfect = true;
        } else if (e.quality === 'clean' || e.quality === 'sketchy') {
          this.shake(e.quality === 'clean' ? Math.min(0.5, e.impact * 0.03) : 0.55);
          // The lens sinks with a hard landing and the horizon nods (a late stomp after it never dips
          // again: its stomp beat says late).
          const a = MathUtils.clamp((e.impact - 6) * 0.022, 0, 0.28);
          if (a > 0) this.jolt(0, -a, 0);
        }
        break;
      case 'crash':
        this.shake(1.1);
        break;
      case 'bump':
        this.shake(0.5);
        break;
      case 'boost':
        if (e.source === 'drift') this.pendDriftKick = 0.35;
        else this.kick(0.35);
        break;
      default:
        break;
    }
  }

  /** This frame's named moments and feel, every frame after the raw events. Never keeps the list. */
  beats(list: readonly Beat[], feel: Feel): void {
    this.feel = feel;
    if (feel.reduced) {
      // A calm screen: nothing kicks, shakes, knocks, rolls or holds.
      this.pendPerfect = false;
      this.pendDriftKick = 0;
      this.calm();
      this.freezeLeft = 0;
      return;
    }
    let stomped = false;
    let released = false;
    this.nudged.length = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      switch (b.type) {
        case 'stomp': {
          const n = Math.max(1, b.streak);
          this.kick(n <= 1 ? 0.9 : n === 2 ? 0.95 : 1);
          // The shake builds with the streak (0.25 for one, up to 0.4), since the kick is near its cap.
          this.shake(Math.min(0.4, 0.25 + 0.03 * (n - 1)));
          // A late stomp follows a clean landing that already sank the lens.
          if (!b.late) this.jolt(0, -Math.min(0.28, 0.2 + 0.02 * (n - 1)), 0);
          // From the third in a row the horizon knocks too, the other way each stomp, growing to 0.02
          // rad by the fifth.
          if (n >= 3) this.jvr += (0.02 * (n % 2 ? 1 : -1) * Math.min(1, (n - 2) / 3)) / J_PEAK;
          stomped = true;
          break;
        }
        case 'bump':
          // Knocked away from the obstacle (side is the way away), and the horizon tips with it.
          this.jolt(0.22 * b.side, -0.05, 0);
          this.jvr += (0.035 * b.side) / J_PEAK;
          break;
        case 'nearMiss':
          // A whisker flinches the lens away from the obstacle's side (side is the obstacle's) and the
          // horizon tips away with it, as a bump's does.
          if (b.grade === 'whisker') {
            this.jolt(-0.16 * b.side, 0, 0);
            this.jvr += (-0.025 * b.side) / J_PEAK;
            this.kick(0.3);
          }
          break;
        case 'driftRelease':
          this.kick(RELEASE_KICK[b.tier] ?? 0.3);
          if (b.tier === 3) {
            // A max drift's release throws the lens back and whips the horizon out of the drift's lean
            // (a drift leans it by -driftDir; the release shoves the sled toward driftDir, and a shove
            // to the right rolls positive, as a bump's knock does).
            this.jolt(0, 0, 0.35);
            this.jvr += (0.03 * Math.sign(b.driftDir)) / J_PEAK;
            this.shake(0.2);
          }
          released = true;
          break;
        case 'flow':
          if (b.phase === 'in') {
            this.kick(0.2);
            this.jolt(0, -0.1, 0);
          }
          break;
        case 'pass':
          if (!b.muted && NUDGE_WORDS.has(b.word)) this.nudge(b.ghost);
          break;
        case 'duel':
          if (b.phase === 'won' || b.phase === 'heldOff') this.nudge(b.ghost);
          break;
        case 'lead':
          this.kick(0.15);
          break;
        case 'bank':
          if (!b.bump) this.kick(BANK_KICK[b.tier] ?? 0);
          break;
        case 'finale':
          if (b.stamp) this.kick(0.6);
          break;
        case 'crash':
          // The lens holds still while the wreck tumbles away from it, then the orbit takes over. It
          // holds clear of the snow (once here, and the shaken lens each frame in update).
          this.freezeLeft = CRASH_FREEZE_S;
          this.orbitFrom = b.orbitFrom;
          this.orbitSeeded = false;
          if (this.initialized) this.holdFloor();
          break;
        default:
          break;
      }
    }
    if (this.pendPerfect && !stomped) {
      this.kick(0.9);
      this.shake(0.25);
    }
    if (this.pendDriftKick > 0 && !released) this.kick(this.pendDriftKick);
    this.pendPerfect = false;
    this.pendDriftKick = 0;
  }

  /** The crash hold's snow floor, once as the hold begins (update holds the shaken lens to it each
   *  frame). The look point rises with the lens, so the held frame keeps its aim. */
  private holdFloor(): void {
    if (!this.ground) return;
    const p = this.pos;
    const y = Math.max(p.y, this.heldFloor(p));
    this.look.y += y - p.y;
    p.y = y;
  }

  /** The lowest the held crash lens may stand at `p`: over the snow under it, halfway to the held look
   *  point (fixed, unlike the tumbling wreck), and with the near plane's lower corners (half a metre
   *  out to each side in landscape) over the snow too, with 5 cm to spare for the held roll. Held on
   *  the first two alone, the shake pushed a corner of the frame into a bank beside the wreck. */
  private heldFloor(p: Vector3): number {
    const g = this.ground!;
    const dx = this.look.x - p.x;
    const dz = this.look.z - p.z;
    const hl = Math.hypot(dx, dz) || 1e-6;
    const dl = Math.hypot(hl, this.look.y - p.y);
    const fx = dx / hl;
    const fz = dz / hl;
    // The near plane's lower edge, in from the lens along the view (pitched by sp) and down its up axis.
    const cp = hl / dl;
    const sp = (this.look.y - p.y) / dl;
    const near = this.camera.near;
    const nh = near * Math.tan(MathUtils.degToRad(this.fov) / 2);
    const nw = nh * this.aspect;
    const ahead = near * cp + nh * sp;
    const drop = nh * cp - near * sp + 0.05;
    const ax = p.x + fx * ahead;
    const az = p.z + fz * ahead;
    return Math.max(
      g(p.x, p.z) + 0.2,
      g((p.x + this.look.x) * 0.5, (p.z + this.look.z) * 0.5) + 0.3,
      g(ax - fz * nw, az + fx * nw) + drop,
      g(ax + fz * nw, az - fx * nw) + drop,
    );
  }

  /** Leans the lens a few centimetres toward a ghost just passed (once per ghost per frame). */
  private nudge(g: GhostRef): void {
    if (this.nudged.includes(g.id) || g.dx === 0) return;
    this.nudged.push(g.id);
    this.jolt(0.06 * Math.sign(g.dx), 0, 0);
  }

  /** A positional knock in camera space (metres right, up and back), each amount its peak: a velocity
   *  impulse into a stiff spring, so it lands over about 55 ms and settles within about 0.25 s.
   *  Chase only, off under reduced motion. */
  jolt(right: number, up: number, back: number): void {
    if (this.feel.reduced || this.mode !== 'chase') return;
    this.jvx += right / J_PEAK;
    this.jvy += up / J_PEAK;
    this.jvz += back / J_PEAK;
  }

  /** Clears held feel on revive and at a run's start: the crash hold, jolts, the shake and the punch. */
  resetFeel(): void {
    this.calm();
    this.freezeLeft = 0;
    this.orbitFrom = null;
    this.orbitSeeded = false;
    this.orbitLook = this.orbitLookT = 0;
    this.packK = this.packZoom = 0;
    this.tripod = false;
    this.pendPerfect = false;
    this.pendDriftKick = 0;
  }

  private calm(): void {
    this.jx = this.jy = this.jz = this.jr = 0;
    this.jvx = this.jvy = this.jvz = this.jvr = 0;
    this.shakeAmp = 0;
    this.punch = 0;
  }

  /** The current lens roll in radians (the eased lean plus a bump's knock, clamped), for probes. */
  get rollNow(): number {
    return this.rollOut;
  }

  /** The current jolt offset (metres right, up, back), for probes. */
  get joltNow(): { right: number; up: number; back: number } {
    return { right: this.jx, up: this.jy, back: this.jz };
  }

  /** Scaled seconds the crash lens still holds (0 once the orbit has it), for probes. */
  get holdNow(): number {
    return this.freezeLeft;
  }

  /** The shake's current amplitude (0 to 1.2; the lens moves by its square), for probes. */
  get shakeNow(): number {
    return this.shakeAmp;
  }

  /** Advances the jolt spring exactly over dt (clamped to 1/30 s). */
  private stepJolt(dt: number): void {
    const d = Math.min(Math.max(0, dt), 1 / 30);
    if (d === 0) return;
    const e = Math.exp(-J_A * d);
    const c = Math.cos(J_WD * d) * e;
    const s = Math.sin(J_WD * d) * e;
    // x' = e(x cos + (v + a x) / wd sin), v' = e(v cos - (a v + w^2 x) / wd sin), per axis.
    const p = s / J_WD;
    const w2 = J_OMEGA * J_OMEGA;
    let x = this.jx;
    let v = this.jvx;
    this.jx = x * c + (v + J_A * x) * p;
    this.jvx = v * c - (J_A * v + w2 * x) * p;
    x = this.jy;
    v = this.jvy;
    this.jy = x * c + (v + J_A * x) * p;
    this.jvy = v * c - (J_A * v + w2 * x) * p;
    x = this.jz;
    v = this.jvz;
    this.jz = x * c + (v + J_A * x) * p;
    this.jvz = v * c - (J_A * v + w2 * x) * p;
    x = this.jr;
    v = this.jvr;
    this.jr = x * c + (v + J_A * x) * p;
    this.jvr = v * c - (J_A * v + w2 * x) * p;
    // Settled: rest exactly (no denormal drift).
    if (Math.abs(this.jx) + Math.abs(this.jy) + Math.abs(this.jz) + Math.abs(this.jr) < 1e-5 && Math.abs(this.jvx) + Math.abs(this.jvy) + Math.abs(this.jvz) + Math.abs(this.jvr) < 1e-4) {
      this.jx = this.jy = this.jz = this.jr = 0;
      this.jvx = this.jvy = this.jvz = this.jvr = 0;
    }
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
    const reduced = this.feel.reduced;
    this.packCut = false;
    // The crash hold lasts only while the crash orbit is the mode (a revive or the results end it).
    if (this.mode !== 'crash' || reduced || !this.initialized) this.freezeLeft = 0;
    const held = this.mode === 'crash' && this.freezeLeft > 0;
    if (this.mode !== 'crash') {
      this.orbitSeeded = false;
      this.packK = this.packZoom = 0;
    }
    // Jolts ride the chase only: elsewhere they die away at once.
    if (this.mode === 'chase' && !reduced) this.stepJolt(dt);
    else if (this.jx || this.jy || this.jz || this.jr || this.jvx || this.jvy || this.jvz || this.jvr) {
      this.jx = this.jy = this.jz = this.jr = 0;
      this.jvx = this.jvy = this.jvz = this.jvr = 0;
    }

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
      if (held) {
        // The crash beat: the lens holds where it was, looking where it looked, while the rider
        // tumbles away from it (scaled time, so the held frame and the slow motion hold it longer).
        this.freezeLeft = Math.max(0, this.freezeLeft - dt);
        desired.copy(this.pos);
        lookAt.copy(this.look);
      } else {
        const cut = this.crashOrbit(t, dt, desired);
        lookAt.copy(t.pos);
        lookAt.y += this.orbitLook;
        if (cut) {
          // A cut to face the pack: the lens stands there at once (and its framing of the ghost riding
          // past, below, with it).
          this.pos.copy(desired);
          this.look.copy(lookAt);
        } else if (!reduced) {
          // The orbit rides along with a wreck still sliding down the slope (along the snow under it, so
          // its bounces never bob the lens), winding in over ORBIT_CARRY_WIND: eased after it, a fast
          // slide ran into the lens facing the pack and took the rider out of the bottom of the frame.
          // The tripod stands still and only its look rides along (eased, the slide left it at the
          // frame's edge).
          const sx = t.pos.x - this.lastFocus.x;
          const sz = t.pos.z - this.lastFocus.z;
          if (sx * sx + sz * sz < 4) {
            const k = this.tripod ? 1 : smooth01(this.orbitT / ORBIT_CARRY_WIND);
            const sy = this.ground ? this.ground(t.pos.x, t.pos.z) - this.ground(this.lastFocus.x, this.lastFocus.z) : 0;
            if (!this.tripod) {
              this.pos.x += sx * k;
              this.pos.y += sy * k;
              this.pos.z += sz * k;
            }
            this.look.x += sx * k;
            this.look.y += sy * k;
            this.look.z += sz * k;
          }
        }
        this.framePack(t, lookAt, dt, cut);
        if (cut) {
          this.look.copy(lookAt);
          this.lookS.copy(lookAt);
        }
        this.packCut = cut;
      }
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
    // (Held still on the crash beat, whatever the tumbling wreck does.)
    if (this.pos.y < t.pos.y + 0.8 && this.mode !== 'orbit' && this.mode !== 'hero' && !held) this.pos.y = t.pos.y + 0.8;
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

    // FOV: breathe with speed, kick on boosts and perfect landings, and open a little in earned flow
    // (the chase only; the kick and the flow are off under reduced motion, the breathing stays).
    this.punch = reduced ? 0 : Math.max(0, this.punch - dt * 2.4);
    const flowFov = this.mode === 'chase' && !reduced ? 2.5 * MathUtils.clamp(this.feel.flow, 0, 1) : 0;
    let baseFov = 62 + speedK * 14 + t.boost * 4 + this.punch * 8 + this.rivalFov + flowFov + (this.mode === 'chase' && this.aspect >= 1 ? this.airK * 4 : 0);
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
    // The crash orbit's long lens on the ghost that passes your wreck.
    if (this.mode === 'crash') baseFov = this.packZoomFov(t, baseFov, held, dt);
    if (this.packCut) this.fov = baseFov;
    else this.fov += (baseFov - this.fov) * (1 - Math.exp(-dt * 5));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // Roll: a drift leans the horizon into it, with its slip; otherwise the carve leans it with the
    // steer, more with speed; never past ROLL_MAX either way. The hero shot is level (a roll held
    // over from the last carve tilted the wreck's horizon), and so is the crash orbit, which eases
    // level from the roll the crash hold kept (the hand-off to the hero shot never tilts). Reduced
    // motion never rolls.
    let rollT = 0;
    if (this.mode === 'chase' && !reduced) {
      if (t.drifting) rollT = -(t.driftDir ?? 0) * (0.035 + 0.035 * Math.min(1, Math.abs(t.slip ?? 0) / 0.7));
      else rollT = -t.steer * 0.05 * (0.4 + speedK);
      rollT = MathUtils.clamp(rollT, -ROLL_MAX, ROLL_MAX);
    }
    if (reduced) this.roll = 0;
    else if (!held) this.roll += (rollT - this.roll) * (1 - Math.exp(-dt * 4));
    this.rollOut = reduced ? 0 : MathUtils.clamp(this.roll + this.jr, -ROLL_MAX, ROLL_MAX);

    // The shake runs on its own clock: real time scaled by the hit-stop (Feel.shakeScale), so a
    // stomp's shake thickens with it, a held frame or a pause freezes it, and nothing jitters while
    // time stands still. (dt arrives already scaled by the render channel.)
    const tr = this.feel.timeRender;
    const realDt = tr > 1e-4 ? dt / tr : 0;
    this.shakeT += realDt * this.feel.shakeScale;
    this.shakeAmp = reduced ? 0 : Math.max(0, this.shakeAmp - dt * 2.2);
    const sh = this.shakeAmp * this.shakeAmp;
    const time = this.shakeT;
    const ox = Math.sin(time * 47) * sh * 0.25 + Math.sin(time * 23) * sh * 0.12;
    const oy = Math.cos(time * 41) * sh * 0.2;

    // The lens: the eased position plus the jolt and the shake in camera-local axes (right is level,
    // up is the world's, back is away from the look point), then held clear of the snow again, so a
    // landing's sink never takes the near plane into the slope behind the rider.
    let fx = this.look.x - this.pos.x;
    let fz = this.look.z - this.pos.z;
    const fl = Math.hypot(fx, fz);
    if (fl > 1e-6) {
      fx /= fl;
      fz /= fl;
    } else {
      fx = 0;
      fz = -1;
    }
    const rx = -fz;
    const rz = fx;
    const lens = this.lens.copy(this.pos);
    const look = this.lookT.copy(this.look);
    if (this.mode === 'chase') {
      const jr = this.jx;
      const jb = this.jz;
      lens.x += rx * jr - fx * jb;
      lens.z += rz * jr - fz * jb;
      lens.y += this.jy;
      // The look point moves with the lens sideways and back, and dips half as far: the horizon nods.
      look.x += rx * jr - fx * jb;
      look.z += rz * jr - fz * jb;
      look.y += this.jy * 0.5;
    }
    lens.x += rx * ox;
    lens.z += rz * ox;
    lens.y += oy;
    // The crash lens too: the crash's shake dipped the held lens into a mound behind the wreck, the
    // lower third of the held frame a flat slab of terrain. While held, the floor is taken toward the
    // held look point rather than the tumbling wreck (heldFloor), so it never moves the held lens.
    if (held && this.ground) lens.y = Math.max(lens.y, this.heldFloor(lens));
    else if ((this.mode === 'chase' || this.mode === 'crash') && this.ground) {
      const mx = (lens.x + t.pos.x) * 0.5;
      const mz = (lens.z + t.pos.z) * 0.5;
      lens.y = Math.max(lens.y, this.ground(lens.x, lens.z) + 0.2, this.ground(mx, mz) + 0.3);
    }
    this.camera.position.copy(lens);
    if (this.mode === 'chase') {
      // A true roll about the view axis (the chase turns with the course).
      const sr = Math.sin(this.rollOut);
      this.camera.up.set(rx * sr, Math.cos(this.rollOut), rz * sr);
    } else this.camera.up.set(Math.sin(this.rollOut), Math.cos(this.rollOut), 0);
    this.camera.lookAt(look);
  }

  /** The crash orbit: a slow drift round the wreck. With no ghost to watch it takes over from
   *  wherever the held lens stood (its angle, distance and height ease to the orbit's), so it never
   *  jumps. With the crash beat's bearing to the nearest live ghost behind or abreast (pack-orbit),
   *  it starts facing that ghost: the lens stands downhill of the wreck on the far side from it and
   *  looks past the wreck up the slope toward the ghost, so the pack streams down past your wreck
   *  through the frame (the race went on without you). From the chase lens behind the wreck that is a reverse angle, far
   *  too far to swing in the third of a second before the results, so after the held frame it is a
   *  cut; a start within ORBIT_CUT of the lens swings there instead. Then it drifts on slowly, so a
   *  narrow screen's panel never sits over a frozen frame. Reduced motion never cuts or swings: the
   *  orbit drifts on from the lens. Returns true on a cut (the caller snaps the lens there). */
  private crashOrbit(t: CamTarget, dt: number, desired: Vector3): boolean {
    let cut = false;
    if (!this.orbitSeeded) {
      this.orbitSeeded = true;
      const dx = this.pos.x - t.pos.x;
      const dz = this.pos.z - t.pos.z;
      this.orbitAngle = Math.atan2(dx, dz);
      this.orbitR = MathUtils.clamp(Math.hypot(dx, dz), 2, 12);
      this.orbitUp = MathUtils.clamp(this.pos.y - t.pos.y, 0.8, 6);
      this.orbitSpin = ORBIT_SPIN;
      this.orbitT = 0;
      this.orbitAim = null;
      this.orbitUpT = ORBIT_UP;
      this.orbitRT = ORBIT_R;
      this.orbitLook = this.orbitLookT = 0;
      this.packR = ORBIT_R;
      const from = this.feel.reduced ? null : this.orbitFrom;
      // The ghost's bearing from the wreck is `from` (sim x and z: 0 down the course, + toward +x).
      // In three.js the ghost lies along (sin from, -cos from) and the orbit puts the lens along
      // (sin a, cos a), so the lens opposite the ghost, facing it, is at a = -from. It stays on the
      // downhill side (a = PI looks straight up the slope): a ghost abreast is watched across the
      // slope as it comes down, not from deeper in the trees beside a wreck. ...From a spot with no
      // tree at the lens or across the line to the wreck: in the treeline the low lens stood among
      // dissolving trunks, and where every spot is walled in there is no pack shot at all (the orbit
      // drifts on from the held lens, which rode in along the open course).
      // ...unless the ghost riding past will cross the line you fell on well clear of the wreck: then
      // the lens cuts to the pack tripod beside its line (packTripod), and stays there.
      this.tripod = !this.feel.reduced && !!t.pack && !!t.fell && this.packTripod(t.pos, t.pack, t.fell);
      if (this.tripod) cut = true;
      const aim = from === null || this.tripod ? null : this.packLens(t.pos, Math.PI + MathUtils.clamp(wrapAngle(-from - Math.PI), -ORBIT_FACE, ORBIT_FACE));
      if (aim !== null) {
        this.orbitUpT = ORBIT_PACK_UP;
        this.orbitLookT = ORBIT_PACK_LOOK;
        this.orbitRT = this.packR;
        const gap = wrapAngle(aim - this.orbitAngle);
        this.orbitSpin = ORBIT_SPIN * 0.4 * (gap < 0 ? -1 : 1);
        if (Math.abs(gap) > ORBIT_CUT) {
          this.orbitAngle = aim;
          this.orbitR = this.packR;
          this.orbitUp = ORBIT_PACK_UP;
          this.orbitLook = ORBIT_PACK_LOOK;
          this.orbitT = ORBIT_WIND;
          cut = true;
        } else this.orbitAim = aim;
      }
    }
    this.orbitT += dt;
    if (this.tripod) {
      desired.copy(this.tripodAt);
      return cut;
    }
    const wind = Math.min(1, this.orbitT / ORBIT_WIND);
    // While a ghost rides past the wreck (CamTarget.pack) the orbit holds its angle and comes no
    // further out than the pack lens's radius, so the wreck stays in frame as the look turns toward
    // the passer (framePack). Reduced motion drifts on as ever.
    const pack = !!t.pack && !this.feel.reduced;
    if (this.orbitAim !== null) {
      const gap = wrapAngle(this.orbitAim - this.orbitAngle);
      if (Math.abs(gap) < 0.02) this.orbitAim = null;
      else this.orbitAngle += MathUtils.clamp(gap * (1 - Math.exp(-dt * ORBIT_EASE)), -dt * ORBIT_SWING, dt * ORBIT_SWING) * wind;
    } else if (!pack) this.orbitAngle += dt * this.orbitSpin * wind;
    const k = 1 - Math.exp(-dt * 2.5);
    this.orbitR += ((pack ? Math.min(this.orbitRT, this.packR) : this.orbitRT) - this.orbitR) * k;
    this.orbitUp += (this.orbitUpT - this.orbitUp) * k;
    this.orbitLook += (this.orbitLookT - this.orbitLook) * k;
    desired.set(t.pos.x + Math.sin(this.orbitAngle) * this.orbitR, t.pos.y + this.orbitUp, t.pos.z + Math.cos(this.orbitAngle) * this.orbitR);
    // Facing the pack can put the lens over a bank or among the trees beside the course: never in
    // the snow.
    if (this.ground) desired.y = Math.max(desired.y, this.ground(desired.x, desired.z) + 1);
    return cut;
  }

  /** The pack-facing lens's angle round the wreck (three.js position `w`), or null for no pack shot.
   *  The set facing when nothing stands by the lens or across its line to the wreck; else the clear
   *  spot nearest it, turning off the facing or round toward straight downhill (a wreck in the
   *  treeline is watched from the open course, not from deeper in the forest), at the orbit's radius
   *  or a step closer, never uphill of the wreck; null when every spot has a tree by the lens. Sets
   *  packR. Asked once per crash, so its prop scan never runs per frame. */
  private packLens(w: Vector3, face: number): number | null {
    this.packR = ORBIT_R;
    const blocked = this.blocked;
    if (!blocked) return face;
    let best = face;
    let bestCost = Infinity;
    for (const r of PACK_RADII) {
      for (let i = 0; i < PACK_TURNS.length * 2; i++) {
        // Turns off the facing first, then the same turns round straight downhill.
        const a = (i < PACK_TURNS.length ? face : Math.PI) + PACK_TURNS[i % PACK_TURNS.length];
        if (Math.abs(wrapAngle(a - Math.PI)) > PACK_DOWNHILL) continue;
        const lx = w.x + Math.sin(a) * r;
        const lz = w.z + Math.cos(a) * r;
        // A tree by the lens is the worst (inside about 3.5 m it fills a side of the frame, dissolving);
        // one across the line hides the wreck.
        let cost = blocked(lx, lz, PACK_CLEAR) ? 3 : 0;
        for (const f of PACK_SIGHT) if (blocked(w.x + (lx - w.x) * f, w.z + (lz - w.z) * f, 1.4)) cost += 1;
        // (The set facing and the orbit's own radius win ties.)
        cost += Math.abs(wrapAngle(a - face)) * 0.4 + (ORBIT_R - r) * 0.05;
        if (cost === 0) return a;
        if (cost < bestCost) {
          bestCost = cost;
          best = a;
          this.packR = r;
        }
      }
      if (bestCost < 1) break;
    }
    return bestCost < 3 ? best : null;
  }

  /** The pack tripod's spot (into tripodAt) for the wreck at `w` and the ghost riding past with its
   *  chest at `g`, toward the line you fell on at `fell` (three.js): where it crosses that line (its
   *  lane taken as where it rides now), more than PACK_FORE_D and at most TRIPOD_REACH from the wreck,
   *  the lens stands on the far side of the crossing from the wreck, TRIPOD_BACK out and TRIPOD_SIDE
   *  aside, clear of the trees at the lens and halfway to the crossing. False for no tripod: the ghost
   *  has already crossed, it crosses near the wreck (the pack lens downhill frames that) or far wide
   *  of it, or every spot is walled in. Asked once per crash, so its prop scan never runs per frame. */
  private packTripod(w: Vector3, g: Vector3, fell: Vector3): boolean {
    // (Uphill is +z in three.js: a ghost still coming rides behind the line.)
    if (g.z < fell.z + 0.5) return false;
    const cx = g.x;
    const cz = fell.z;
    let ux = cx - w.x;
    let uz = cz - w.z;
    const d0 = Math.hypot(ux, uz);
    if (d0 <= PACK_FORE_D || d0 > TRIPOD_REACH) return false;
    ux /= d0;
    uz /= d0;
    const nx = -uz;
    const nz = ux;
    // Toward the course's middle first (open snow).
    const cor = this.corridor?.(cz);
    const side = cor ? Math.sign((cor.x - cx) * nx) || 1 : 1;
    const blocked = this.blocked;
    for (const back of TRIPOD_BACK) {
      for (let s = 0; s < 2; s++) {
        const sd = s === 0 ? side : -side;
        const lx = cx + ux * back + nx * sd * TRIPOD_SIDE;
        const lz = cz + uz * back + nz * sd * TRIPOD_SIDE;
        if (blocked && (blocked(lx, lz, PACK_CLEAR) || blocked((lx + cx) * 0.5, (lz + cz) * 0.5, 1.4))) continue;
        const gy = this.ground ? this.ground(lx, lz) : g.y - 0.8;
        this.tripodAt.set(lx, gy + TRIPOD_UP, lz);
        return true;
      }
    }
    return false;
  }

  /** Frame the ghost that passes your wreck (CamTarget.pack): once it is in front of the lens, the
   *  look eases toward the midpoint of the wreck and that ghost, by up to PACK_LOOK, so the passer
   *  stays in frame as it goes by (and eases back to the wreck after it). Reduced motion skips it. */
  private framePack(t: CamTarget, lookAt: Vector3, dt: number, snap: boolean): void {
    if (this.feel.reduced) {
      this.packK = 0;
      return;
    }
    const g = t.pack ?? null;
    let w = 0;
    if (g) {
      this.packAt.copy(g);
      const fx = this.look.x - this.pos.x;
      const fz = this.look.z - this.pos.z;
      const fl = Math.hypot(fx, fz) || 1;
      const depth = ((g.x - this.pos.x) * fx + (g.z - this.pos.z) * fz) / fl;
      // ...as far as the wreck stays inside the middle of the frame: on a phone's narrow frame the
      // full turn toward a ghost riding wide put the wreck at its edge.
      w = Math.min(PACK_LOOK * smooth01((depth - 1) / 2), this.packReach(t.pos, g));
    }
    // (On a cut the framing stands there at once, with the lens.)
    if (snap) this.packK = w;
    else this.packK += (w - this.packK) * (1 - Math.exp(-dt * PACK_LOOK_EASE));
    if (this.packK < 1e-4 && w === 0) this.packK = 0;
    if (this.packK === 0) return;
    // The midpoint as the lens sees them: the view turns from the wreck toward the ghost by packK of
    // the angle between them (at the wreck's distance). Halfway along the line between them, the far
    // ghost pulled the view almost onto itself and the near wreck dropped to the foot of the frame;
    // 0.45 of the angle is also where the long lens fits both narrowest (packFit's 70% and 85%). The
    // pack lens's lift over the wreck gives way as it comes in: the ghost up the slope lifts the view.
    const p = this.pos;
    const wx = lookAt.x - p.x;
    const wy = lookAt.y - this.orbitLook * Math.min(1, this.packK / PACK_LOOK) - p.y;
    const wz = lookAt.z - p.z;
    const wl = Math.hypot(wx, wy, wz);
    const gx = this.packAt.x - p.x;
    const gy = this.packAt.y - p.y;
    const gz = this.packAt.z - p.z;
    const gl = Math.hypot(gx, gy, gz);
    if (wl < 1e-3 || gl < 1e-3) return;
    const k = this.packK;
    const bx = (wx / wl) * (1 - k) + (gx / gl) * k;
    const by = (wy / wl) * (1 - k) + (gy / gl) * k;
    const bz = (wz / wl) * (1 - k) + (gz / gl) * k;
    const bl = Math.hypot(bx, by, bz);
    if (bl < 1e-3) return;
    const fx = bx / bl;
    const fy = by / bl;
    const fz = bz / bl;
    // ...then tipped up until the ghost's chest sits no higher than PACK_CHEST_TOP (under the HUD's
    // race row, which on a phone hid its tag as a ghost flew over the lens), as far as the wreck's foot
    // stays inside the middle PACK_WRECK_IN of the frame.
    const rl = Math.hypot(fx, fz) || 1;
    const rx = -fz / rl;
    const rz = fx / rl;
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;
    const dg = gx * fx + gy * fy + gz * fz;
    const ex = t.pos.x - p.x;
    const ey = t.pos.y - PACK_WRECK_DOWN - p.y;
    const ez = t.pos.z - p.z;
    const de = ex * fx + ey * fy + ez * fz;
    let lift = 0;
    if (dg > 0.3 && de > 0.3) {
      const tanV = Math.tan(MathUtils.degToRad(this.fov) / 2);
      const top = (this.aspect < 1 ? PACK_CHEST_TOP[1] : PACK_CHEST_TOP[0]) * tanV;
      const yg = (gx * ux + gy * uy + gz * uz) / dg;
      const ye = (ex * ux + ey * uy + ez * uz) / de;
      lift = MathUtils.clamp(Math.min(yg - top, ye + PACK_WRECK_IN * tanV), 0, 1) * Math.min(1, k / PACK_LOOK);
    }
    const lx = fx + ux * lift;
    const ly = fy + uy * lift;
    const lz = fz + uz * lift;
    const ll = Math.hypot(lx, ly, lz);
    lookAt.set(p.x + (lx / ll) * wl, p.y + (ly / ll) * wl, p.z + (lz / ll) * wl);
  }

  /** The most of the turn toward the ghost (packK) that keeps the wreck, its middle at `w`, inside the
   *  middle PACK_WRECK_IN of the frame with the ghost's chest at `g`, as the lens stands and looks
   *  (measured on the view's tangent plane, where the turn moves the wreck by packK of the ghost's
   *  offset from it). */
  private packReach(w: Vector3, g: Vector3): number {
    const p = this.pos;
    let fx = this.look.x - p.x;
    let fy = this.look.y - p.y;
    let fz = this.look.z - p.z;
    const fl = Math.hypot(fx, fy, fz);
    if (fl < 1e-6) return PACK_LOOK;
    fx /= fl;
    fy /= fl;
    fz /= fl;
    // The view's right (level) and up axes.
    const rl = Math.hypot(fx, fz) || 1;
    const rx = -fz / rl;
    const rz = fx / rl;
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;
    const dw = (w.x - p.x) * fx + (w.y - p.y) * fy + (w.z - p.z) * fz;
    const dg = (g.x - p.x) * fx + (g.y - p.y) * fy + (g.z - p.z) * fz;
    if (dw < 0.3 || dg < 0.3) return 0;
    const sx = ((g.x - p.x) * rx + (g.z - p.z) * rz) / dg - ((w.x - p.x) * rx + (w.z - p.z) * rz) / dw;
    const sy = ((g.x - p.x) * ux + (g.y - p.y) * uy + (g.z - p.z) * uz) / dg - ((w.x - p.x) * ux + (w.y - p.y) * uy + (w.z - p.z) * uz) / dw;
    const tanV = Math.tan(MathUtils.degToRad(this.fov) / 2);
    // (Vertically the wreck's own height counts too.)
    const kx = Math.abs(sx) > 1e-6 ? (PACK_WRECK_IN * tanV * this.aspect) / Math.abs(sx) : Infinity;
    const ky = Math.abs(sy) > 1e-6 ? Math.max(0, PACK_WRECK_IN * tanV - PACK_WRECK_UP / dw) / Math.abs(sy) : Infinity;
    return Math.min(PACK_LOOK, kx, ky);
  }

  /** The crash orbit's long lens while a ghost rides past your wreck: the FOV eases (PACK_ZOOM_EASE)
   *  down to what packFit allows, never wider than `base`, and back out once it has gone by. Off
   *  while the crash lens holds and under reduced motion. */
  private packZoomFov(t: CamTarget, base: number, held: boolean, dt: number): number {
    const g = this.feel.reduced || held ? null : (t.pack ?? null);
    const fov = g ? this.packFit(t.pos, g) : 0;
    if (fov > 0) this.packFov = fov;
    if (this.packCut && fov > 0) this.packZoom = 1;
    else this.packZoom += ((fov > 0 ? 1 : 0) - this.packZoom) * (1 - Math.exp(-dt * PACK_ZOOM_EASE));
    if (fov <= 0 && this.packZoom < 1e-3) this.packZoom = 0;
    if (this.packZoom === 0) return base;
    return base + (Math.min(base, this.packFov) - base) * this.packZoom;
  }

  /** The vertical FOV (degrees) that shows the ghost whose chest is at `g` about PACK_TALL of the frame
   *  high, with the wreck (its middle at `w`) inside the middle PACK_WRECK_IN of the frame and the ghost
   *  inside PACK_GHOST_IN, from the lens as it stands and looks; never under PACK_FOV_MIN. 0 while the
   *  ghost is not in front of the lens (180 when the wreck is behind it: no long lens). */
  private packFit(w: Vector3, g: Vector3): number {
    const f = this.tmp3.subVectors(this.look, this.pos);
    if (f.lengthSq() < 1e-8) return 0;
    f.normalize();
    // The view's right (level) and up axes.
    const rl = Math.hypot(f.x, f.z) || 1;
    const rx = -f.z / rl;
    const rz = f.x / rl;
    const u = this.tmp4.set(-rz * f.y, rz * f.x - rx * f.z, rx * f.y);
    const gd = (g.x - this.pos.x) * f.x + (g.y - this.pos.y) * f.y + (g.z - this.pos.z) * f.z;
    if (gd < 1) return 0;
    const a = this.aspect;
    const need = Math.max(
      Math.tan(MathUtils.degToRad(PACK_FOV_MIN) / 2),
      this.tanNeed(f, rx, rz, u, w.x, w.y + PACK_WRECK_UP, w.z, PACK_WRECK_IN, a),
      this.tanNeed(f, rx, rz, u, w.x, w.y - PACK_WRECK_DOWN, w.z, PACK_WRECK_IN, a),
      this.tanNeed(f, rx, rz, u, g.x, g.y + PACK_GHOST_H - 0.8, g.z, PACK_GHOST_IN, a),
      this.tanNeed(f, rx, rz, u, g.x, g.y - 0.8, g.z, PACK_GHOST_IN, a),
    );
    // The size: the ghost PACK_TALL of the frame's height (of 1.6 widths on a phone).
    const frac = PACK_TALL * (a < 1 ? Math.min(1, 1.6 * a) : 1);
    const size = PACK_GHOST_H / (2 * frac * gd);
    return MathUtils.radToDeg(2 * Math.atan(Math.max(need, size)));
  }

  /** The half-height tangent of the frame that keeps a point within `share` of the half frame on both
   *  axes, seen from the lens along view axis `f` (right (rx, 0, rz), up `u`); Infinity behind it. */
  private tanNeed(f: Vector3, rx: number, rz: number, u: Vector3, x: number, y: number, z: number, share: number, aspect: number): number {
    const dx = x - this.pos.x;
    const dy = y - this.pos.y;
    const dz = z - this.pos.z;
    const depth = dx * f.x + dy * f.y + dz * f.z;
    if (depth < 0.3) return Infinity;
    const tx = Math.abs(dx * rx + dz * rz) / depth;
    const ty = Math.abs(dx * u.x + dy * u.y + dz * u.z) / depth;
    return Math.max(ty / share, tx / (share * aspect));
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
