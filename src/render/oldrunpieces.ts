import { BufferGeometry, Color, CylinderGeometry, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, ShaderMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { type MomentPlay, momentPlays } from '../sim/moments';
import { CREST_TOP, CREST_U, FLOOR, WALL, placeOf, trackAt } from '../sim/oldrun';
import type { Sim } from '../sim/sim';
import { merge, part } from './flora';
import { crestGround } from './ground';
import { box, seg } from './landmarkKit';
import { pushLocalLight } from './lights';
import { makeToonMaterial } from './materials';
import type { Particles } from './particles';

// The Old Run's three set pieces as the world draws them (round 9, notes/r9-oldrun-world.md; their sim is the lane's,
// moments.ts and sim.ts). Each is a thing that stands or hangs in its place, lit by its own light, and nothing of it
// stands on the ice a sled rides (ART.md 14):
//  - The Bend Bells (peal): a bronze bell at each of the Hotel Straights' turns, hung on a rope from an iron bracket on
//    the outside crest, over the point of the glaze the sim asks a sled to pass under. The next bell breathes brightest;
//    a rung bell swings and flares; a missed one hangs dark.
//  - The Labyrinth (split): at its entry two banded posts on the crests with a wire of pennants across (the split
//    starts there), at its exit a timing board on the outside crest, a great dial whose hand sweeps the split's time as
//    the rider rides it: home before the hand comes round is the split beaten. Its lamp burns marigold while the rider
//    is up on the split, cold while behind; it flares for a win and gutters for a loss.
//  - The Horseshoe (glaze): lanterns on short iron posts along the hook's outside crest, dark until the rider holds the
//    glaze: they light down the line in step with the hold, the next one breathing; a broken hold gutters it.
// No HUD signal is added: the world says it.

type V3 = [number, number, number];

const IRON = new Color('#26242E');
/** Bronze: an olive-brown body, a gold light at its rim when it is lit (never the coral of the rider's family). */
const BRONZE = new Color('#7E6A3A');
const GREEN = new Color('#2F5446');
const CREAM = new Color('#EEE4D0');
const TIMBER = new Color('#5E4640');
const DIAL = new Color('#F4EEE0');
const MARIGOLD_LIN = new Color('#FFD34D').convertSRGBToLinear();
const LAMP_LIN = new Color('#FFC27A').convertSRGBToLinear();
const CREST_D = FLOOR + CREST_U * WALL + CREST_TOP * 0.55;
/** A bell's lip over the wall it hangs above (m): clear over a rider's head on the glaze. */
const BELL_CLEAR = 2.9;
/** The length of rope that swings with its bell (m). */
const SWING_ROPE = 1.3;
const BRONZE_GLOW = new Color('#D8B060');
const XAXIS = new Vector3(1, 0, 0);
const ONE = new Vector3(1, 1, 1);
const tq = new Quaternion();

const tm = new Matrix4();
const tv = new Vector3();
const tc = new Color();

function crestAt(c: Course, side: number, z: number, d = CREST_D): { x: number; y: number; p: number } {
  const t = trackAt(c, z);
  const x = t.cx + side * d * Math.sqrt(1 + t.p * t.p);
  return { x, y: crestGround(c, x, z), p: t.p };
}

/** A bell: a lathe of bronze, round-shouldered and flaring to a lip, about a metre tall, hung from its crown at 0. */
function bellGeometry(): BufferGeometry {
  const prof = [new Vector2(0.001, 0), new Vector2(0.18, -0.02), new Vector2(0.3, -0.12), new Vector2(0.34, -0.35), new Vector2(0.38, -0.62), new Vector2(0.5, -0.86), new Vector2(0.54, -0.92), new Vector2(0.44, -0.9), new Vector2(0.001, -0.84)];
  const parts = [part(new LatheGeometry(prof, 10), BRONZE), part(new SphereGeometry(0.1, 6, 4), IRON, { pos: [0, -0.92, 0] }), part(new CylinderGeometry(0.06, 0.06, 0.16, 6, 1), IRON, { pos: [0, 0.06, 0] })];
  return merge(parts);
}

interface Bell {
  /** Where it swings from (world): the foot of the rope's fixed length. */
  pivot: Vector3;
  x: number;
  y: number;
  z: number;
  /** When it rang (s, the frame clock; -9 not yet), and whether the sim passed it unrung. */
  rang: number;
  missed: boolean;
}

export class OldRunPieces {
  readonly root = new Object3D();
  private readonly mat = makeToonMaterial({ coolShade: 0.5, stone: true });
  private readonly owned: Array<{ dispose(): void }> = [];
  private plays: readonly MomentPlay[] = [];
  private bells: Bell[] = [];
  /** Every bell, one draw: each instance swings on its own and is lit by its own colour. */
  private bellMesh: InstancedMesh | null = null;
  private bellPlay = -1;
  private dial: Object3D | null = null;
  private splitLamp: ShaderMaterial | null = null;
  private splitPlay = -1;
  private splitAt: V3 = [0, 0, 0];
  private hookPlay = -1;
  private hookLamps: InstancedMesh | null = null;
  private hookPos: V3[] = [];
  /** When each set piece ended this run (s), and whether it was won: by play index. */
  private ended = new Map<number, { t: number; won: boolean }>();
  private time = 0;

  constructor(private readonly particles: Particles | null) {
    this.root.name = 'oldrun-pieces';
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  clear(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
    this.bells = [];
    this.bellMesh = null;
    this.dial = null;
    this.splitLamp = null;
    this.hookLamps = null;
    this.hookPos = [];
    this.bellPlay = this.splitPlay = this.hookPlay = -1;
    this.plays = [];
  }

  reset(): void {
    this.ended.clear();
    for (const b of this.bells) {
      b.rang = -9;
      b.missed = false;
    }
  }

  /** Builds what the plays hold (once per set of plays: a run's own, or the course's plain ones on the title). */
  build(c: Course, plays: readonly MomentPlay[], low: boolean): void {
    this.clear();
    this.plays = plays;
    const iron: BufferGeometry[] = [];
    for (const p of plays) {
      if (p.verb === 'peal') this.bellsFor(c, p, iron);
      else if (p.verb === 'split') this.splitFor(c, p, iron, low);
      else if (p.verb === 'glaze') this.hookFor(c, p, iron);
    }
    if (iron.length) {
      const m = new Mesh(this.keep(merge(iron)), this.mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
  }

  private bellsFor(c: Course, p: MomentPlay, iron: BufferGeometry[]): void {
    this.bellPlay = p.index;
    // (A short length of rope swings with its bell, from a pivot under the rope's fixed length.)
    const geo = this.keep(merge([bellGeometry().translate(0, -SWING_ROPE, 0), seg([0, 0, 0], [0, -SWING_ROPE, 0], 0.025, IRON)]));
    const im = new InstancedMesh(geo, this.mat, Math.max(1, p.targets.length));
    im.castShadow = true;
    im.frustumCulled = false;
    this.root.add(im);
    this.bellMesh = im;
    for (const t of p.targets) {
      const tt = trackAt(c, t.z);
      const side = t.x >= tt.cx ? 1 : -1;
      const a = crestAt(c, side, t.z, CREST_D - 0.3);
      const gy = c.ground(t.x, t.z);
      const armY = Math.max(a.y + 2.6, gy + BELL_CLEAR + 1.6);
      // The bracket: an iron post on the crest, its arm out over the wall to above the bell, a brace under it.
      iron.push(seg([a.x, a.y - 0.3, -t.z], [a.x, armY + 0.3, -t.z], 0.09, IRON, 6));
      iron.push(seg([a.x, armY, -t.z], [t.x, armY, -t.z], 0.06, IRON));
      iron.push(seg([a.x, armY - 1.6, -t.z], [a.x + (t.x - a.x) * 0.45, armY, -t.z], 0.045, IRON));
      iron.push(box(0.5, 0.5, 0.5, IRON, [a.x, a.y - 0.05, -t.z]));
      // The bell on its rope, as long as the height it asks: hung from the arm's end, its lip BELL_CLEAR over the wall.
      const pivotY = gy + BELL_CLEAR + 0.95 + SWING_ROPE;
      if (armY > pivotY + 0.05) iron.push(seg([t.x, armY, -t.z], [t.x, pivotY, -t.z], 0.025, IRON));
      this.bells.push({ pivot: new Vector3(t.x, Math.min(armY, pivotY), -t.z), x: t.x, y: gy + BELL_CLEAR + 0.5, z: t.z, rang: -9, missed: false });
    }
  }

  private splitFor(c: Course, p: MomentPlay, iron: BufferGeometry[], low: boolean): void {
    this.splitPlay = p.index;
    // The entry: two banded posts on the crests, a wire between their heads with pennants of the resort's colours.
    const za = p.z0;
    const L = crestAt(c, -1, za);
    const R = crestAt(c, 1, za);
    const H = 7.5;
    for (const q of [L, R]) {
      iron.push(seg([q.x, q.y - 0.3, -za], [q.x, q.y + H, -za], 0.11, IRON, 6));
      for (let k = 0; k < 4; k++) iron.push(part(new CylinderGeometry(0.13, 0.13, 0.7, 6, 1), k % 2 ? CREAM : GREEN, { pos: [q.x, q.y + 1.2 + k * 0.7, -za] }));
      iron.push(part(new SphereGeometry(0.22, 8, 6), CREAM, { pos: [q.x, q.y + H + 0.15, -za] }));
    }
    const wy = Math.max(L.y, R.y) + H - 0.4;
    iron.push(seg([L.x, wy, -za], [R.x, wy, -za], 0.025, IRON));
    const nP = low ? 5 : 9;
    for (let k = 1; k <= nP; k++) {
      const x = L.x + ((R.x - L.x) * k) / (nP + 1);
      iron.push(part(new CylinderGeometry(0, 0.36, 0.9, 3, 1), k % 2 ? GREEN : CREAM, { pos: [x, wy - 0.5, -za], rot: [Math.PI, 0, 0], scale: [1, 1, 0.12] }));
    }
    // The exit: the timing board on the left crest, facing up the run, a dial on it and a lamp over it.
    const zb = p.z1;
    const B = crestAt(c, -1, zb, CREST_D + 2.2);
    const by = B.y;
    const W = 4.2;
    const top = by + 7.2;
    for (const dx of [-1.6, 1.6]) iron.push(box(0.3, top - by + 0.4, 0.3, TIMBER, [B.x + dx, (top + by) / 2 - 0.2, -zb]));
    iron.push(box(W, W, 0.3, GREEN, [B.x, top - W / 2, -zb - 0.1]));
    iron.push(box(W + 0.3, 0.25, 0.5, CREAM, [B.x, top + 0.1, -zb]));
    const cy = top - W / 2;
    iron.push(part(new CylinderGeometry(1.7, 1.7, 0.14, 28, 1), IRON, { pos: [B.x, cy, -zb + 0.08], rot: [Math.PI / 2, 0, 0] }));
    iron.push(part(new CylinderGeometry(1.55, 1.55, 0.1, 28, 1), DIAL, { pos: [B.x, cy, -zb + 0.14], rot: [Math.PI / 2, 0, 0] }));
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      iron.push(box(0.1, h % 3 === 0 ? 0.36 : 0.2, 0.04, IRON, [B.x + Math.sin(a) * 1.28, cy + Math.cos(a) * 1.28, -zb + 0.2], [0, 0, -a]));
    }
    // (The hand turns: its own node, pivoting at the dial's middle.)
    const dial = new Object3D();
    dial.position.set(B.x, cy, -zb + 0.26);
    const hand = new Mesh(this.keep(merge([box(0.13, 1.3, 0.05, IRON, [0, 0.55, 0]), part(new SphereGeometry(0.14, 8, 6), IRON)])), this.mat);
    dial.add(hand);
    this.root.add(dial);
    this.dial = dial;
    // The board's lamp over it: a round glass, its light the split's state.
    const lampMat = this.keep(makeToonMaterial({ coolShade: 0.4, emissive: new Color('#FFD34D'), emissiveStrength: 0 }));
    const lamp = new Mesh(this.keep(part(new SphereGeometry(0.42, 10, 8), new Color('#5A5468'))), lampMat);
    lamp.position.set(B.x, top + 0.75, -zb);
    this.root.add(lamp);
    dial.userData.lamp = lamp;
    this.splitLamp = lampMat;
    this.splitAt = [B.x, top + 0.75, zb];
  }

  private hookFor(c: Course, p: MomentPlay, iron: BufferGeometry[]): void {
    this.hookPlay = p.index;
    const hook = placeOf(c, 'hook');
    const t = hook.turns[1] ?? hook.turns[0];
    const n = Math.max(6, Math.round(t.len / 10));
    this.hookPos = [];
    for (let i = 0; i < n; i++) {
      const z = t.z0 + (t.len * (i + 0.5)) / n;
      const a = crestAt(c, t.side, z, CREST_D - 0.6);
      iron.push(seg([a.x, a.y - 0.3, -z], [a.x, a.y + 1.7, -z], 0.05, IRON, 5));
      iron.push(part(new CylinderGeometry(0.2, 0.26, 0.2, 4, 1), IRON, { pos: [a.x, a.y + 2.35, -z], rot: [0, Math.PI / 4, 0] }));
      this.hookPos.push([a.x, a.y + 2.0, z]);
    }
    // The lanterns' glass: one draw, each lit by its own colour (dark until the hold reaches it).
    const glass = this.keep(new MeshBasicMaterial({ color: 0xffffff }));
    const g = this.keep(new CylinderGeometry(0.17, 0.13, 0.4, 4, 1));
    const im = new InstancedMesh(g, glass, n);
    this.hookPos.forEach((q, i) => {
      im.setMatrixAt(i, tm.makeTranslation(q[0], q[1], -q[2]));
      im.setColorAt(i, tc.setRGB(0.18, 0.17, 0.24));
    });
    im.computeBoundingSphere();
    this.root.add(im);
    this.hookLamps = im;
  }

  /** The set pieces' named moments (the director's beats): a bell rung or passed, a split or a hold won or lost. */
  beats(list: readonly Beat[], s: Snap): void {
    for (const b of list) {
      if (b.type !== 'moment') continue;
      const p = this.plays.find((q) => q.key === b.key);
      if (!p) continue;
      if (b.phase === 'won' || b.phase === 'lost') this.ended.set(p.index, { t: this.time, won: b.phase === 'won' });
      if (p.verb === 'peal' && (b.phase === 'step' || b.phase === 'miss')) {
        // The bell just passed: the nearest behind the rider not yet answered.
        let best: Bell | null = null;
        for (const bell of this.bells) if (bell.rang < 0 && !bell.missed && bell.z <= s.z + 2 && (!best || bell.z > best.z)) best = bell;
        if (!best) continue;
        if (b.phase === 'step') {
          best.rang = this.time;
          this.particles?.sparkle(tv.set(best.x, best.y, -best.z), new Color('#FFD34D'), 28, 3.6, 0.7, 0.24, null, 0.4);
        } else best.missed = true;
      }
      if (p.verb === 'split' && b.phase === 'won' && this.splitLamp) {
        this.particles?.sparkle(tv.set(this.splitAt[0], this.splitAt[1], -this.splitAt[2]), new Color('#FFD34D'), 36, 4, 0.8, 0.26, null, 0.5);
      }
    }
  }

  update(c: Course, time: number, s: Snap, sim: Sim | null, run: boolean, low: boolean, reduced: boolean): void {
    this.time = time;
    // (Each set piece's moving parts are drawn from within reach of it only.)
    const reach = low ? 420 : 700;
    const near = (z0: number, z1: number): boolean => s.z > z0 - reach && s.z < z1 + 90;
    const plays = run && sim ? sim.plays : this.plays.length ? this.plays : momentPlays(c);
    if (plays !== this.plays) this.build(c, plays, low);
    const mo = run && sim ? sim.mo : null;
    const breathe = reduced ? 0.75 : 0.6 + 0.4 * Math.sin(time * 3.2);
    // The bells.
    if (this.bellMesh && this.bellPlay >= 0) this.bellMesh.visible = near(this.plays[this.bellPlay].z0, this.plays[this.bellPlay].z1);
    if (this.bellPlay >= 0 && this.bellMesh?.visible) {
      const active = mo !== null && mo.active === this.bellPlay;
      const next = active ? mo!.at : mo && mo.next > this.bellPlay ? -1 : 0;
      this.bells.forEach((b, i) => {
        const t = time - b.rang;
        let k = 0.12;
        if (b.rang >= 0) k = 0.5 + 2.6 * Math.exp(-t * 2.2);
        else if (b.missed) k = 0;
        else if (i === next && Math.abs(b.z - s.z) < 260) k = 0.5 + 0.9 * breathe;
        // Lit from inside by its own colour (over 1 it blooms on Medium and High), and a rung bell swings and settles.
        const sw = b.rang >= 0 && !reduced ? 0.55 * Math.exp(-t * 0.9) * Math.sin(t * 5.2) : 0;
        if (this.bellMesh) {
          tq.setFromAxisAngle(XAXIS, sw);
          this.bellMesh.setMatrixAt(i, tm.compose(b.pivot, tq, ONE));
          this.bellMesh.setColorAt(i, tc.setRGB(1, 1, 1).lerp(BRONZE_GLOW, Math.min(0.6, k * 0.4)).multiplyScalar(1 + k * 0.55));
        }
        if (k > 0.3 && Math.abs(b.z - s.z) < 90) pushLocalLight(b.x, b.y, -b.z, MARIGOLD_LIN.r, MARIGOLD_LIN.g, MARIGOLD_LIN.b, 9, Math.min(1.4, k * 0.6));
      });
      if (this.bellMesh) {
        this.bellMesh.instanceMatrix.needsUpdate = true;
        if (this.bellMesh.instanceColor) this.bellMesh.instanceColor.needsUpdate = true;
      }
    }
    // The split's dial and lamp.
    if (this.splitPlay >= 0 && this.dial && this.splitLamp) {
      const p = this.plays[this.splitPlay];
      const show = near(p.z1 - 40, p.z1);
      this.dial.visible = show;
      if (this.dial.userData.lamp) (this.dial.userData.lamp as Mesh).visible = show;
      const active = mo !== null && mo.active === this.splitPlay;
      const end = this.ended.get(this.splitPlay);
      let frac = 0;
      if (active && sim) frac = Math.min(1, (sim.tick - mo!.t0) / Math.max(1, p.need));
      else if (end) frac = (this.dial.userData.frac as number | undefined) ?? 0;
      this.dial.userData.frac = frac;
      this.dial.rotation.z = -frac * Math.PI * 2;
      let k = 0.15;
      if (end) {
        const t = time - end.t;
        k = end.won ? 0.8 + 2.4 * Math.exp(-t * 1.5) : 0.4 * Math.exp(-t * 2) * (0.6 + 0.4 * Math.sin(t * 23));
      } else if (active) k = mo!.ahead ? 0.9 + 0.6 * breathe : 0.12;
      this.splitLamp.uniforms.uEmissiveStrength.value = k;
      if (k > 0.3 && Math.abs(p.z1 - s.z) < 140) pushLocalLight(this.splitAt[0], this.splitAt[1], -this.splitAt[2], MARIGOLD_LIN.r, MARIGOLD_LIN.g, MARIGOLD_LIN.b, 14, Math.min(1.5, k * 0.7));
    }
    // The Horseshoe's lanterns.
    if (this.hookPlay >= 0 && this.hookLamps) {
      const p = this.plays[this.hookPlay];
      this.hookLamps.visible = near(p.z0, p.z1);
    }
    if (this.hookPlay >= 0 && this.hookLamps?.visible) {
      const p = this.plays[this.hookPlay];
      const active = mo !== null && mo.active === this.hookPlay;
      const end = this.ended.get(this.hookPlay);
      const n = this.hookPos.length;
      const held = active ? (p.row ? mo!.aux : mo!.at) : 0;
      const lit = end ? (end.won ? n : (this.hookLamps.userData.lit as number | undefined) ?? 0) : Math.min(n, Math.floor((held / Math.max(1, p.need)) * n));
      this.hookLamps.userData.lit = lit;
      const gut = end && !end.won ? Math.exp(-(time - end.t) * 1.6) : 1;
      for (let i = 0; i < n; i++) {
        let k = 0;
        if (i < lit) k = (end && end.won ? 1.6 + 1.2 * Math.exp(-(time - end.t) * 1.4) : 1.4) * gut;
        else if (active && i === lit) k = 0.35 + 0.45 * breathe;
        if (k > 0.02) tc.copy(LAMP_LIN).multiplyScalar(0.6 + k);
        else tc.setRGB(0.18, 0.17, 0.24);
        this.hookLamps.setColorAt(i, tc);
        const q = this.hookPos[i];
        if (k > 0.5 && Math.abs(q[2] - s.z) < 70 && i % 2 === 0) pushLocalLight(q[0], q[1], -q[2], LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 9, Math.min(1.2, k * 0.5));
      }
      if (this.hookLamps.instanceColor) this.hookLamps.instanceColor.needsUpdate = true;
    }
  }
}
