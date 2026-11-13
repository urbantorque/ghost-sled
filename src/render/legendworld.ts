import { BufferAttribute, BufferGeometry, Color, Mesh, Object3D, Quaternion, type ShaderMaterial, Vector3, type Vector4 } from 'three';
import type { Course } from '../sim/course';
import { LEGEND_AHEAD, type LegendPlay, pathX, RIBBON_CAP, RIBBON_HW } from '../sim/moments';
import { CRANE_RIBBONS, craneFlock, curtainMaterial, DEER, type DeerForms, deerForms, dragonDrum, dragonHead, dragonTail, ERUPT_AT, type Field, fountain, laneMaterial, lanternField, lavaBombs, lavaRuns, ribbonLink, smokeColumn, spiritMaterial, wyrmHead, wyrmPlate } from './legendforms';
import { pushLocalLight } from './lights';
import { DECAL_POOL, DECAL_RING, GLOW_FLAME, GLOW_RING, GLOW_SOFT, GLOW_STAR, type MomentKit, type Pool, type StageCtx, tiered } from './momentkit';

// Round 7 (the momentsworld lane): the legend moments of the four older mountains, staged. Each is drawn
// from the sim's own account (sim.legend: where, which side, its line and lights; sim.lg: its phase, a
// runner's head, a ribbon's charge) and is spectacle only: no collider, nothing written back.
//
// Every legend has three beats. It is announced as it is said (phase 1, 220 m out): something comes into
// the frame ahead and toward its side. It peaks while it plays (phase 2). It leaves past its end (it runs
// off, dives, climbs away or drifts: nothing pops out). A runner's nearest part is never drawn nearer than
// LEGEND_AHEAD to the rider, and nothing here is dark and solid on the line: light, paper, glass.
// The forms and the shaders are legendforms.ts's; this file is where and when.

/** What the reel, the camera and the HUD may ask of the legend on screen. */
export interface LegendShot {
  key: string;
  name: string;
  /** 0 waiting, 1 said, 2 playing, 3 over (the sim's own phase). */
  phase: number;
  /** How far through its staging it is, 0 to 1, and how near its peak (0 to 1, 1 at the peak). */
  k: number;
  peak: number;
  /** Where to look, in three.js space, and which side of the run it keeps to. */
  x: number;
  y: number;
  z: number;
  side: 1 | -1;
  /** 'runner', 'ribbon' or 'sky', and how far ahead of the rider the thing to look at is (metres). */
  kind: string;
  ahead: number;
}

/** The legends this file stages (the fifth mountain's are the lanternworld lane's). */
const OWN: ReadonlySet<string> = new Set(['stag', 'fleet', 'aurora', 'herd', 'eruption', 'wyrm', 'dragon', 'cranes']);

/** How far out a legend is said (sim.ts's LEGEND_WARN), and how far either side of its place it is drawn. */
const WARN = 220;
const REACH_IN = 520;
const REACH_OUT = 150;

const PALE = new Color('#DDEBFF');
const LILAC = new Color('#EFE6FF');
const HALO = new Color('#B9A6FF');
const IVORY = new Color('#FFF3D8');
const ICE = new Color('#BFD9FF');
const WARM = new Color('#FFD9A0');
const MARI = new Color('#FFB84A');
const ROSE = new Color('#FF8FA8');
const VIOLET = new Color('#9A6BFF');
const MAGENTA = new Color('#FF63B8');
const LAVA = new Color('#FF6A1E');
const HOT = new Color('#FFC66A');
const WHITEHOT = new Color('#FFE9B4');
const EMBERS: readonly Color[] = [new Color('#FF7A2E').multiplyScalar(1.6), new Color('#FFC25A').multiplyScalar(1.6), new Color('#E23A12').multiplyScalar(1.4)];
const PETALS: readonly Color[] = [new Color('#FFB7C8'), new Color('#FFF3F6'), new Color('#FF8FA8')];
const DRUMS: readonly Color[] = [new Color('#FFC24A'), new Color('#FF8FA8'), new Color('#FFF1D6'), new Color('#FFA63A')];

const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const NEG_Z = new Vector3(0, 0, -1);
const POS_Z = new Vector3(0, 0, 1);
const qYaw = new Quaternion();
const qA = new Quaternion();
const qB = new Quaternion();
const v0 = new Vector3();
const v1 = new Vector3();
const v2 = new Vector3();
const vel = new Vector3();

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number): number => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};
const frac = (v: number): number => v - Math.floor(v);
/** A fixed scatter, 0 to 1, for the i-th of anything. */
const hash = (i: number, salt: number): number => frac(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

interface DeerPools {
  torso: Pool;
  head: Pool;
  upper: Pool;
  lower: Pool;
  mat: ShaderMaterial;
}

/** A body of segments laid along a line (the wyrm, the dragon): where each is this frame. */
const CHAIN = 40;

export class LegendWorld {
  readonly root = new Object3D();
  private readonly look: LegendShot = { key: '', name: '', phase: 0, k: 0, peak: 0, x: 0, y: 0, z: 0, side: 1, kind: '', ahead: 0 };
  private live = false;
  /** Seconds since the legend was said, and since it was over. */
  private tSaid = 0;
  private tOver = 0;
  private kIn = 0;
  private kExit = 0;
  /** Particles are thrown on a clock of their own, so a fast frame throws no more than a slow one. */
  private puff = 0;
  private stride = -1;
  private lastN = 0;
  private riding = 0;
  /** A runner this frame: its nearest part's place down the course, how far it has left, its way off the line. */
  private rz = 0;
  private kOut = 0;
  private off = 0;
  private readonly own: Mesh[] = [];
  private readonly chain = new Float32Array(CHAIN * 3);

  private stag: DeerPools | null = null;
  private herd: DeerPools | null = null;
  private plates: Pool | null = null;
  private wyrmHead: Pool | null = null;
  private drums: Pool | null = null;
  private dragonHead: Pool | null = null;
  private dragonTail: Pool | null = null;
  private links: Pool | null = null;

  private fleet: { field: Field; mesh: Mesh; n: number; at: Float32Array; made: Course | null; said: boolean } | null = null;
  private aurora: { curtain: Mesh; lane: Mesh; cm: ShaderMaterial; lm: ShaderMaterial; made: Course | null; one: number } | null = null;
  private cranes: { mesh: Mesh; mat: ShaderMaterial; made: Course | null; mid: Vector3 } | null = null;
  private erupt: { smoke: Mesh; fount: Mesh; bombs: Mesh; runs: Mesh } | null = null;
  /** Where Ember's cone stands from the lens (palette.ts gives its bearing; massif.ts its range and height). */
  private coneAz = 7;

  constructor(private readonly kit: MomentKit) {}

  /** Whether this file draws the legend with this key. */
  owns(key: string): boolean {
    return OWN.has(key);
  }

  setCourse(c: Course): void {
    void c;
    this.reset();
  }

  /** The hero cone's bearing, degrees right of straight down the course (the palette's massif.heroAz). */
  setConeBearing(deg: number): void {
    this.coneAz = deg;
  }

  reset(): void {
    this.live = false;
    this.tSaid = 0;
    this.tOver = 0;
    this.puff = 0;
    this.stride = -1;
    this.lastN = 0;
    this.riding = 0;
    if (this.fleet) this.fleet.said = false;
    this.hide();
  }

  private hide(): void {
    for (const m of this.own) m.visible = false;
  }

  private add(m: Mesh, order: number): Mesh {
    m.frustumCulled = false;
    m.renderOrder = order;
    m.visible = false;
    this.root.add(m);
    this.own.push(m);
    return m;
  }

  /** What this file's own draws cost this frame (the kit counts its pools, glows and marks itself). */
  cost(): { draws: number; tris: number } {
    let draws = 0;
    let tris = 0;
    for (const m of this.own) {
      if (!m.visible) continue;
      draws++;
      const g = m.geometry as BufferGeometry & { instanceCount?: number };
      const n = g.index ? Math.min(g.index.count, g.drawRange.count) : Math.min(g.getAttribute('position').count, g.drawRange.count);
      tris += (n / 3) * (g.instanceCount !== undefined && Number.isFinite(g.instanceCount) ? g.instanceCount : 1);
    }
    return { draws, tris };
  }

  update(ctx: StageCtx): void {
    this.hide();
    this.live = false;
    const sim = ctx.sim;
    const lg = sim?.legend;
    if (!sim || !lg || ctx.mode !== 'run' || !OWN.has(lg.key)) return;
    const s = ctx.s;
    if (s.z < lg.z0 - REACH_IN || s.z > lg.z1 + REACH_OUT) return;
    const st = sim.lg;
    if (st.phase === 0) {
      this.tSaid = 0;
      this.tOver = 0;
      if (this.fleet) this.fleet.said = false;
    }
    if (st.phase >= 1) this.tSaid += ctx.dt;
    if (st.phase >= 3) this.tOver += ctx.dt;
    this.kIn = st.phase === 0 ? 0 : st.phase === 1 ? clamp01((s.z - (lg.z0 - WARN)) / WARN) : 1;
    this.kExit = clamp01((s.z - lg.z1) / REACH_OUT);
    this.puff += ctx.dt;
    const throwNow = ctx.dt > 0 && this.puff >= 0.07;
    if (throwNow) this.puff = 0;
    const L = this.look;
    L.key = lg.key;
    L.name = lg.name;
    L.phase = st.phase;
    L.side = lg.side;
    L.kind = lg.kind;
    L.k = clamp01((s.z - (lg.z0 - WARN)) / (lg.z1 + REACH_OUT - (lg.z0 - WARN)));
    L.peak = st.phase === 2 ? 0.35 + 0.65 * Math.sin(Math.PI * clamp01((s.z - lg.z0) / Math.max(1, lg.z1 - lg.z0))) : st.phase === 1 ? 0.35 * this.kIn : 0.35 * (1 - this.kExit);
    // (Until a stage says otherwise: a point up the run on the legend's side.)
    this.focus(ctx, s.x + lg.side * 6, s.y + 4, s.z + 40);
    if (lg.kind === 'runner') {
      if (st.phase === 0 || !lg.path) return;
      this.runner(ctx, lg);
      if (lg.key === 'stag') this.stageStag(ctx, lg, throwNow);
      else if (lg.key === 'herd') this.stageHerd(ctx, lg, throwNow);
      else if (lg.key === 'wyrm') this.stageWyrm(ctx, lg, throwNow);
      else this.stageDragon(ctx, lg, throwNow);
    } else if (lg.key === 'fleet') this.stageFleet(ctx, lg);
    else if (lg.key === 'aurora') this.stageAurora(ctx, lg, throwNow);
    else if (lg.key === 'eruption') this.stageEruption(ctx, throwNow);
    else if (lg.key === 'cranes') this.stageCranes(ctx, lg, throwNow);
    this.live = true;
  }

  /** The legend on screen this frame, or null. */
  shot(): LegendShot | null {
    return this.live ? this.look : null;
  }

  private focus(ctx: StageCtx, x: number, y: number, z: number): void {
    this.look.x = x;
    this.look.y = y;
    this.look.z = -z;
    this.look.ahead = z - ctx.s.z;
  }

  // ---------------------------------------------------------------- runners

  /** Where a runner is this frame. As it is said it comes in from its side, far ahead, and closes to its
   *  place; while it plays it is the sim's head; past its end it keeps its distance and leaves the line. */
  private runner(ctx: StageCtx, lg: LegendPlay): void {
    const s = ctx.s;
    const st = ctx.sim!.lg;
    if (st.phase === 1) {
      const far = 1 - this.kIn;
      this.rz = s.z + LEGEND_AHEAD + 46 * far * far;
    } else {
      this.rz = Math.max(st.phase === 2 ? st.head : lg.z1, s.z + LEGEND_AHEAD);
    }
    this.kOut = clamp01((this.rz - (lg.z1 - 6)) / 100);
    const far = 1 - smooth(this.kIn);
    this.off = lg.side * (22 * far * far + 34 * smooth(this.kOut) * this.kOut);
  }

  private lineX(c: Course, lg: LegendPlay, z: number): number {
    return lg.path ? pathX(c, lg.path, z) : c.safeX(z);
  }

  private deerPools(stag: boolean): DeerPools {
    const f: DeerForms = deerForms(stag);
    const mat = stag ? spiritMaterial(0.94, 1.5) : spiritMaterial(0.74, 2.0);
    const n = stag ? 1 : 16;
    return { torso: this.kit.pool(f.torso, n, mat), head: this.kit.pool(f.head, n, mat), upper: this.kit.pool(f.upper, n * 4, mat), lower: this.kit.pool(f.lower, n * 4, mat), mat };
  }

  /** One deer in a gallop: the torso, the head, and four legs of two parts each. `ph` is where in its
   *  stride it is (0 as the forelegs reach), `move` 0 holds it in one reaching pose. */
  private deer(P: DeerPools, c: Course, x: number, z: number, yaw: number, k: number, ph: number, move: number, col: Color, lum: number, lift = 0): void {
    const a = (move > 0 ? ph : 0.12) * Math.PI * 2;
    const g = c.ground(x, z);
    const slope = Math.atan((c.ground(x, z + 1.5) - c.ground(x, z - 1.5)) / 3);
    // It is in the air as its legs gather under it, and rocks nose-down onto its forelegs.
    const bob = move * (0.16 + 0.26 * Math.max(0, -Math.sin(a))) * k;
    const pitch = slope * 0.8 + move * 0.11 * Math.cos(a);
    const y = g + lift + DEER.stand * k * 0.93 + bob;
    qYaw.setFromAxisAngle(Y, -yaw);
    qA.setFromAxisAngle(X, pitch).premultiply(qYaw);
    P.torso.put(x, y, z, qA, k, k, k, col, lum);
    v0.set(DEER.neck[0], DEER.neck[1], DEER.neck[2]).multiplyScalar(k).applyQuaternion(qA);
    qB.setFromAxisAngle(X, pitch * 0.4 + move * 0.07 * Math.sin(a + 0.6)).premultiply(qYaw);
    P.head.put(x + v0.x, y + v0.y, z - v0.z, qB, k, k, k, col, lum * 1.08);
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const sd = i % 2 === 0 ? -1 : 1;
      const hip = front ? DEER.front : DEER.hind;
      const p = a + (front ? 0 : Math.PI) + sd * 0.36;
      const sw = Math.sin(p);
      const fold = Math.max(0, Math.cos(p));
      const up = front ? 0.12 + 0.78 * sw : -0.16 + 0.7 * sw;
      const lo = front ? up - 0.1 - 1.25 * fold : up + 0.42 - 1.25 * fold;
      v0.set(hip[0] * sd, hip[1], hip[2]).multiplyScalar(k).applyQuaternion(qA);
      const hx = x + v0.x;
      const hy = y + v0.y;
      const hz = z - v0.z;
      qB.setFromAxisAngle(X, up).premultiply(qYaw);
      P.upper.put(hx, hy, hz, qB, k, k, k, col, lum);
      v1.set(0, -DEER.upper * k, 0).applyQuaternion(qB);
      qB.setFromAxisAngle(X, lo).premultiply(qYaw);
      P.lower.put(hx + v1.x, hy + v1.y, hz - v1.z, qB, k, k, k, col, lum);
    }
  }

  /** The White Stag: a great white stag running the glade ahead, a print of light at each landing. */
  private stageStag(ctx: StageCtx, lg: LegendPlay, throwNow: boolean): void {
    const P = (this.stag ??= this.deerPools(true));
    const c = ctx.course;
    const move = ctx.reduced ? 0 : 1;
    const STRIDE = 12;
    const k = 2.8;
    const z = this.rz;
    const x = this.lineX(c, lg, z) + this.off;
    const yaw = Math.atan2(this.lineX(c, lg, z + 3) - this.lineX(c, lg, z - 3) + lg.side * 3.4 * smooth(this.kOut), 6);
    const fade = (1 - smooth((this.kOut - 0.5) / 0.5)) * smooth(this.kIn * 5 + (ctx.sim!.lg.phase > 1 ? 1 : 0));
    P.mat.uniforms.uAlpha.value = fade;
    const ph = frac(z / STRIDE);
    // (Leaving, it bounds: higher and longer as it goes.)
    this.deer(P, c, x, z, yaw, k, ph, move, IVORY, 2.1, 0.6 * this.kOut * move * Math.max(0, -Math.sin(ph * 6.283)));
    const g = c.ground(x, z);
    const yb = g + DEER.stand * k;
    // Its own light: a halo that makes a white stag read on white snow, a star in its antlers.
    ctx.kit.glow(x, yb + 0.6, z + 0.5, 15, WARM, 0.42 * fade, GLOW_SOFT, 1.25);
    ctx.kit.glow(x, yb + 5.6, z - 2, 5, WARM, 0.9 * fade * (0.8 + 0.2 * move * Math.sin(ctx.time * 7)), GLOW_STAR);
    ctx.kit.decal(c, x, z, 7, 9, ICE, 0.5 * fade, DECAL_POOL);
    // Hoofprints of light where it has landed, back to the rider and past.
    const first = Math.floor(z / STRIDE);
    const from = lg.z0 - WARN;
    for (let j = 1; j <= (ctx.low ? 6 : 10); j++) {
      const zj = (first - j + 1) * STRIDE - 2.2;
      if (zj < from || zj > lg.z1 + 20) continue;
      const xj = this.lineX(c, lg, zj);
      const f = 1 - j / 11;
      ctx.kit.decal(c, xj - 0.8, zj, 2.1, 3.2, WARM, 1.7 * f, DECAL_POOL);
      ctx.kit.decal(c, xj + 0.8, zj + 1.6, 2.1, 3.2, WARM, 1.7 * f, DECAL_POOL);
      if (j < 2) ctx.kit.decal(c, xj, zj + 0.8, 4.5 + j * 1.5, 4.5 + j * 1.5, WARM, 0.7 * f, DECAL_RING);
    }
    pushLocalLight(x, yb + 1, -z, 0.8, 0.9, 1.0, 17, 1.7 * fade);
    pushLocalLight(x, g + 0.8, -(z - STRIDE * 1.2), 1.0, 0.85, 0.6, 9, 0.9 * fade);
    // Snow off its hooves at each landing, and a breath of light behind its head.
    if (ctx.dt > 0 && first !== this.stride) {
      this.stride = first;
      if (move) {
        ctx.particles.burst(v0.set(x, g + 0.2, -z), 0.55, ctx.low ? 6 : 14, vel.set(0, 1, -12));
        ctx.particles.sparkle(v0, WARM, ctx.low ? 3 : 7, 3.2, 0.6, 0.22, null, 0.6);
      }
    }
    if (throwNow && move && fade > 0.3) ctx.particles.sparkle(v0.set(x, yb + 1.9, -(z + 1.6)), PALE, 2, 1.2, 0.8, 0.16, vel.set(0, 0, -ctx.s.speed * 0.8), 0.2);
    this.focus(ctx, x, yb + 1.5, z);
  }

  /** The Ghost Herd: spirit caribou running the chute's edges and banks ahead, never on the line. */
  private stageHerd(ctx: StageCtx, lg: LegendPlay, throwNow: boolean): void {
    const P = (this.herd ??= this.deerPools(false));
    const c = ctx.course;
    const move = ctx.reduced ? 0 : 1;
    const n = tiered(ctx.tier, [6, 10, 14, 16]);
    const fade = (1 - smooth((this.kOut - 0.45) / 0.55)) * smooth(this.kIn * 4 + (ctx.sim!.lg.phase > 1 ? 1 : 0));
    P.mat.uniforms.uAlpha.value = fade;
    const depth = ctx.low ? 20 : 27;
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) {
      const sd = i % 2 === 0 ? lg.side : -lg.side;
      // The bull leads on the legend's side; the rest are strung back and out, some up the banks.
      const dz = i === 0 ? depth : hash(i, 1) * (depth - 5) + move * 2.5 * Math.sin(ctx.time * 0.7 + i * 2.1);
      const z = this.rz + Math.max(0, dz) + 2;
      const hw = c.halfWidth(z);
      const out = Math.max(3.8, hw * (0.52 + 0.74 * hash(i, 2)));
      const x = c.safeX(z) + sd * out + this.off * (0.5 + hash(i, 5));
      const k = i === 0 ? 3.0 : 2.0 + 0.7 * hash(i, 3);
      const yaw = Math.atan2(c.safeX(z + 3) - c.safeX(z - 3) + lg.side * 3 * smooth(this.kOut), 6);
      const ph = frac(z / (6.2 + 1.6 * hash(i, 4)) + hash(i, 6));
      this.deer(P, c, x, z, yaw, k, ph, move, i % 3 === 0 ? PALE : LILAC, 1.8 + 0.3 * hash(i, 7));
      const g = c.ground(x, z);
      ctx.kit.decal(c, x, z, 3.2 * k, 4.2 * k, LILAC, 0.6 * fade, DECAL_POOL);
      if (!ctx.low || i < 3) ctx.kit.glow(x, g + 1.5 * k, z + 0.4, 5.2 * k, HALO, 0.3 * fade, GLOW_SOFT, 1.2);
      // Frost breath at the muzzle.
      if (!ctx.low) ctx.kit.glow(x, g + 1.65 * k, z - 1.5 * k, 1.1 * k * (0.7 + 0.3 * Math.sin(ph * 6.283)), PALE, 0.4 * fade, GLOW_SOFT, 1.6);
      if (i === 0) {
        mx = x;
        my = g + 3;
        ctx.kit.glow(x, g + 4.7 * k * 0.6 + 1.2, z - 1, 2.8, WARM, 0.8 * fade, GLOW_STAR);
        pushLocalLight(x, g + 2, -z, 0.8, 0.76, 1.0, 18, 1.7 * fade);
      } else if (i === 1 || i === 2) pushLocalLight(x, g + 2, -z, 0.8, 0.76, 1.0, 15, 1.3 * fade);
      if (throwNow && move && i === Math.floor(ctx.time * 9) % n && fade > 0.3) ctx.particles.burst(v0.set(x, g + 0.2, -z), 0.4, 6, vel.set(0, 1, -10));
    }
    this.focus(ctx, mx, my, this.rz + depth * 0.6);
  }

  /** Lays `n` points of a body along the runner's line, head first: x, y, z in the sim's frame. */
  private lay(c: Course, lg: LegendPlay, n: number, headZ: number, step: number, fn: (i: number, x: number, g: number, z: number) => void): void {
    for (let i = 0; i < n; i++) {
      const z = headZ - i * step;
      const x = this.lineX(c, lg, z) + this.off;
      fn(i, x, c.ground(x, z), z);
    }
  }

  /** The turn that points a form built facing -z along the body at point i (toward the head). */
  private along(i: number, n: number, q: Quaternion): Quaternion {
    const P = this.chain;
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(n - 1, i + 1) * 3;
    v2.set(P[a] - P[b], P[a + 1] - P[b + 1], -(P[a + 2] - P[b + 2]));
    if (v2.lengthSq() < 1e-6) return q.identity();
    return q.setFromUnitVectors(NEG_Z, v2.normalize());
  }

  /** The Cinder Wyrm: plates of cinder swimming the ravine, in and out of the snow, a mane of sparks. */
  private stageWyrm(ctx: StageCtx, lg: LegendPlay, throwNow: boolean): void {
    const plates = (this.plates ??= this.kit.pool(wyrmPlate(), CHAIN, this.kit.lit));
    const head = (this.wyrmHead ??= this.kit.pool(wyrmHead(), 1, this.kit.lit));
    const c = ctx.course;
    const move = ctx.reduced ? 0 : 1;
    const n = tiered(ctx.tier, [14, 22, 30, 34]);
    // (Seen from behind, a body running straight away is a stack: it reads as a wyrm by how far it swings
    // across the hall and how high it arcs, so both are wide and their waves short.)
    const LEN = 30;
    const step = LEN / n;
    const K = 2.2;
    const t = ctx.time * move;
    const rise = smooth(this.kIn * 2.2);
    // It comes up out of the snow as it is said and goes back under it at the end.
    const bias = -9 * (1 - rise) - 11 * smooth(this.kOut * 1.3);
    const P = this.chain;
    const dive = this.kOut > 0.05;
    this.lay(c, lg, n, this.rz + LEN, step, (i, x, g, z) => {
      const sx = Math.min(4.4, c.halfWidth(z) - 1.6) * Math.sin(z * 0.2 + t * 1.5) * Math.min(1, 0.3 + i / 5);
      let y = g + bias + 1.7 + 4.3 * Math.sin(z * 0.16 - t * 2.3);
      // (The head rides clear of the snow while it runs.)
      if (!dive && i < 5) y = Math.max(y, g + bias + 3.6 - i * 0.7);
      P[i * 3] = x + sx;
      P[i * 3 + 1] = y;
      P[i * 3 + 2] = z;
    });
    const glow = 0.9 + 0.1 * move * Math.sin(ctx.time * 11);
    let lit = 0;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3];
      const y = P[i * 3 + 1];
      const z = P[i * 3 + 2];
      const g = c.ground(x, z);
      const up = y - g;
      this.along(i, n, qA);
      const taper = K * (1 - 0.6 * Math.pow(i / n, 1.7));
      if (i === 0) head.put(x, y, z, qA, K * 1.3, K * 1.3, K * 1.3, WHITEHOT, 1.5);
      else if (up > -2.2 * taper) plates.put(x, y, z, qA, taper, taper, taper * Math.max(1, (step * 1.5) / (1.32 * taper)), WHITEHOT, 1.35 + 0.25 * Math.sin(i * 0.9 - ctx.time * 5 * move));
      if (up > -0.5 && i % (ctx.low ? 5 : 3) === 0) ctx.kit.glow(x, y + 0.6, z, 6.5 * (taper / K), LAVA, 0.3 * glow, GLOW_SOFT, 1.3);
      // Where it breaks the snow: a ring of light, and sparks thrown.
      if (i > 0) {
        const pu = P[(i - 1) * 3 + 1] - c.ground(P[(i - 1) * 3], P[(i - 1) * 3 + 2]);
        if (pu > 0 !== up > 0) {
          ctx.kit.decal(c, x, z, 6, 6, HOT, 0.7, DECAL_RING);
          ctx.kit.glow(x, g + 1.3, z, 3.4, HOT, 0.8 * glow, GLOW_FLAME);
          if (throwNow && move) ctx.particles.sparkle(v0.set(x, g + 0.4, -z), EMBERS[i % 3], ctx.low ? 2 : 5, 4.5, 0.7, 0.2, vel.set(0, 2, -8), 1.3);
          if (lit < 2) {
            lit++;
            pushLocalLight(x, g + 1.5, -z, 1.0, 0.5, 0.16, 12, 0.9);
          }
        }
      }
    }
    const hx = P[0];
    const hy = P[1];
    const hz = P[2];
    if (hy > c.ground(hx, hz) - 2) {
      // The mane: flames streaming back off the brow.
      for (let j = 0; j < (ctx.low ? 3 : 6); j++) {
        const w = 0.5 + 0.5 * Math.sin(ctx.time * 9 * move + j * 1.9);
        ctx.kit.glow(hx + (hash(j, 9) - 0.5) * 2.4, hy + 1.6 + 0.5 * j * w, hz - 0.8 - j * 1.5, 3.4 - j * 0.3, j < 2 ? HOT : LAVA, (1.0 - j * 0.12) * glow, GLOW_FLAME, 0.9, 0.35 * (hash(j, 3) - 0.5));
      }
      ctx.kit.glow(hx, hy + 0.6, hz + 1.2, 11, LAVA, 0.5 * glow, GLOW_SOFT);
      ctx.kit.glow(hx, hy + 0.9, hz + 2.4, 2.6, HOT, 1.3, GLOW_STAR);
      pushLocalLight(hx, hy + 1, -hz, 1.0, 0.55, 0.18, 20, 1.3);
      if (throwNow && move) {
        ctx.particles.sparkle(v0.set(hx, hy + 1.4, -(hz - 2)), EMBERS[1], ctx.low ? 2 : 5, 3.2, 0.9, 0.2, vel.set(0, 0, -ctx.s.speed * 0.9), 0.8);
        ctx.particles.flakes(P[(n >> 1) * 3], P[(n >> 1) * 3 + 1] + 1, -P[(n >> 1) * 3 + 2], EMBERS, ctx.low ? 1 : 3, 2.5, 0.6, 0.13);
      }
    }
    const m = (n >> 1) * 3;
    pushLocalLight(P[m], Math.max(P[m + 1], c.ground(P[m], P[m + 2])) + 1.5, -P[m + 2], 1.0, 0.5, 0.16, 16, 0.9);
    this.focus(ctx, hx, hy + 1, hz);
  }

  /** The Lantern Dragon: a procession dragon of paper lantern drums flying the benches ahead. */
  private stageDragon(ctx: StageCtx, lg: LegendPlay, throwNow: boolean): void {
    const drums = (this.drums ??= this.kit.pool(dragonDrum(), CHAIN, this.kit.lit));
    const head = (this.dragonHead ??= this.kit.pool(dragonHead(), 1, this.kit.lit));
    const tail = (this.dragonTail ??= this.kit.pool(dragonTail(), 1, this.kit.lit));
    const links = (this.links ??= this.kit.pool(ribbonLink(), 40, this.kit.lit));
    const c = ctx.course;
    const move = ctx.reduced ? 0 : 1;
    const n = tiered(ctx.tier, [13, 20, 25, 29]);
    const LEN = 27;
    const step = LEN / (n - 1);
    const K = ctx.low ? 2.3 : 2.1;
    const t = ctx.time * move;
    // It flies in from its side, high, as it is said; at the end it climbs away up the sky and is gone.
    const far = 1 - smooth(this.kIn);
    const up = 15 * far * far + 52 * this.kOut * this.kOut;
    const gone = 1 - smooth((this.kOut - 0.62) / 0.38);
    const P = this.chain;
    this.lay(c, lg, n, this.rz + LEN + 70 * this.kOut * this.kOut, step, (i, x, g, z) => {
      // (It reads from behind by its swing across the run and its rise and fall: both wide, on short waves.)
      P[i * 3] = x + 4.8 * Math.sin(z * 0.19 - t * 1.3) * Math.min(1, 0.35 + i / 5);
      P[i * 3 + 1] = g + 7 + up + 2.3 * Math.sin(z * 0.27 - t * 2.0) + (i === 0 ? 0.6 : 0);
      P[i * 3 + 2] = z;
    });
    const flick = (i: number): number => 1.22 + 0.1 * move * Math.sin(ctx.time * 6 + i * 2.4);
    for (let i = 0; i < n; i++) {
      const x = P[i * 3];
      const y = P[i * 3 + 1];
      const z = P[i * 3 + 2];
      this.along(i, n, qA);
      if (i === 0) {
        const kh = K * 1.3 * gone;
        head.put(x, y, z, qA, kh, kh, kh, null, 1.15);
        ctx.kit.glow(x, y + 0.6, z + 1.4, 3.2, WARM, 1.2 * gone, GLOW_STAR);
        ctx.kit.glow(x, y, z, 12, MARI, 0.4 * gone, GLOW_SOFT);
        pushLocalLight(x, y - 0.5, -z, 1.0, 0.72, 0.3, 24, 1.4 * gone);
        // Whiskers: two ribbons off the muzzle, streaming back and curling.
        for (const sd of [-1, 1]) {
          v0.set(sd * 0.5 * kh, -0.25 * kh, -2.1 * kh).applyQuaternion(qA);
          let px = x + v0.x;
          let py = y + v0.y;
          let pz = z - v0.z;
          const nl = ctx.low ? 4 : 7;
          for (let j = 0; j < nl; j++) {
            const curl = 0.45 * Math.sin(t * 4.2 - j * 0.85 + sd);
            v1.set(sd * (0.75 - j * 0.07), 0.32 * curl + 0.12 * (j - 2), 1).normalize();
            v1.applyQuaternion(qA);
            qB.setFromUnitVectors(POS_Z, v2.copy(v1));
            const len = 1.25 * K;
            links.put(px, py, pz, qB, 2.4 * (1 - j / (nl + 2)) * gone, 1, len, j % 2 ? ROSE : WARM, 1.35);
            px += v1.x * len;
            py += v1.y * len;
            pz -= v1.z * len;
          }
        }
      } else if (i === n - 1) {
        const kt = K * 1.5 * gone;
        tail.put(x, y, z, qA, kt, kt, kt, null, 1.2);
      } else {
        // The drums swell to the middle of the body and fall away to the tail.
        const kd = K * (0.74 + 0.36 * Math.sin((i / (n - 1)) * Math.PI)) * gone;
        drums.put(x, y, z, qA, kd, kd, kd * Math.max(1, step / (1.3 * kd)), DRUMS[i % DRUMS.length], flick(i));
        if (i % (ctx.low ? 4 : 2) === 0) ctx.kit.glow(x, y, z, 5.2 * kd, i % 4 === 1 ? ROSE : MARI, 0.3 * gone, GLOW_SOFT);
        if (i === Math.floor(n / 3) || i === Math.floor((2 * n) / 3)) pushLocalLight(x, y - 0.5, -z, 1.0, 0.66, 0.34, 20, 1.1 * gone);
        // The light it lays on the snow under it.
        if (i % 3 === 1) ctx.kit.decal(c, x, z, 6.5, 7.5, MARI, 0.36 * gone * (1 - clamp01(up / 30)), DECAL_POOL);
      }
    }
    // Petals in its wake.
    if (throwNow && gone > 0.2) {
      const i = (1 + Math.floor(Math.random() * (n - 1))) * 3;
      ctx.particles.flakes(P[i], P[i + 1] - 0.6, -P[i + 2], PETALS, ctx.low ? 1 : 3, 1.6, 1.4, 0.17);
      const e = (n - 1) * 3;
      ctx.particles.flakes(P[e], P[e + 1], -P[e + 2], PETALS, ctx.low ? 1 : 2, 1.2, 1.0, 0.17);
    }
    this.focus(ctx, P[0], P[1], P[2]);
  }

  // ---------------------------------------------------------------- the lantern fleet

  private buildFleet(c: Course, lg: LegendPlay): NonNullable<LegendWorld['fleet']> {
    const N = 1300;
    const base = new Float32Array(N * 3);
    const seed = new Float32Array(N * 4);
    const at = new Float32Array(N * 2);
    let r = (c.seed ^ 0x51ed) >>> 0 || 1;
    const rnd = () => {
      r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
      return r / 4294967296;
    };
    const len = lg.z1 - lg.z0;
    for (let i = 0; i < N; i++) {
      // Along both shores and far beyond the lake's end, thickest near the shore, more on the legend's side.
      const sd = rnd() < 0.56 ? lg.side : -lg.side;
      const u = rnd();
      const band = rnd();
      // Most stand close along the shores; a third fill the sky past the lake's end; the rest are the depth.
      const z = band < 0.52 ? lg.z0 - 60 + rnd() * (len + 150) : band < 0.84 ? lg.z1 + 20 + rnd() * 400 : lg.z0 - 40 + rnd() * (len + 420);
      const d = c.halfWidth(z) + (band < 0.52 ? 5 + u * u * 48 : band < 0.84 ? 6 + u * 130 : 40 + u * 190);
      const x = c.centerX(z) + sd * d;
      base[i * 3] = x;
      base[i * 3 + 1] = c.ground(x, z) + 0.6;
      base[i * 3 + 2] = -z;
      // (The wind takes each toward the lake: over the ice, high above it.)
      seed.set([1.5 + rnd() * 1.7, 3.4 + rnd() * 3.8, rnd(), -sd * (0.3 + rnd() * 0.7)], i * 4);
      at[i * 2] = z - (lg.z0 - WARN) + d * 0.35;
      at[i * 2 + 1] = rnd();
    }
    const old = this.fleet;
    const field = lanternField(base, seed);
    if (old) {
      old.field.geo.dispose();
      old.mesh.geometry = field.geo;
      old.mesh.material = field.mat;
      old.field.mat.dispose();
      old.field = field;
      old.at = at;
      old.made = c;
      old.said = false;
      return old;
    }
    const mesh = this.add(new Mesh(field.geo, field.mat), 6);
    return { field, mesh, n: N, at, made: c, said: false };
  }

  /** The Lantern Fleet: paper lanterns let go from both shores in a wave that outruns the rider, a sky
   *  full of them over the lake, the wind taking them as the rider leaves. Never on the ice. */
  private stageFleet(ctx: StageCtx, lg: LegendPlay): void {
    const c = ctx.course;
    if (!this.fleet || this.fleet.made !== c) this.fleet = this.buildFleet(c, lg);
    const F = this.fleet;
    const st = ctx.sim!.lg;
    if (st.phase === 0) return;
    if (!F.said) {
      // The wave is laid out once, as the legend is said: it runs down the lake at 95 m/s from the rider.
      F.said = true;
      const a = F.field.launch.array as Float32Array;
      for (let i = 0; i < F.n; i++) a[i] = this.tSaid + Math.max(0, F.at[i * 2] / 95 - 1.2) + F.at[i * 2 + 1] * 2.6;
      F.field.launch.needsUpdate = true;
    }
    const u = F.field.mat.uniforms;
    const s = ctx.s;
    const out = smooth(this.kExit * 1.1);
    F.field.geo.instanceCount = tiered(ctx.tier, [170, 620, 1100, 1300]);
    u.uNow.value = this.tSaid;
    u.uMove.value = ctx.reduced ? 0 : 1;
    u.uSize.value = ctx.low ? 2.0 : 1.25;
    u.uFade.value = 1 - out;
    (u.uWind.value as Vector3).set(1.5 + 1.5 * out, 1.6 * out, -0.4 - 1.2 * out);
    F.mesh.visible = true;
    // Their light on the shores and the edge of the ice, where the wave has passed, and on the rider.
    const fill = smooth(this.tSaid / 5) * (1 - out);
    const z0 = Math.floor(s.z / 26) * 26;
    for (let j = 0; j < (ctx.low ? 5 : 9); j++) {
      const z = z0 + j * 26;
      if (z < lg.z0 - 60 || z > lg.z1 + 380) continue;
      const lit = fill * smooth((this.tSaid - (z - (lg.z0 - WARN)) / 95) / 2.5);
      for (const sd of [-1, 1]) {
        const x = c.centerX(z) + sd * (c.halfWidth(z) + 2 + 8 * hash(j + z0, sd + 2));
        ctx.kit.decal(c, x, z + 13 * hash(j + z0, sd + 5), 22, 28, MARI, 0.3 * lit, DECAL_POOL);
      }
    }
    for (const sd of [-1, 1]) {
      const z = s.z + 34;
      const x = c.centerX(z) + sd * (c.halfWidth(z) + 12);
      pushLocalLight(x, c.ground(x, z) + 9, -z, 1.0, 0.68, 0.3, 46, 1.5 * fill);
    }
    this.focus(ctx, c.centerX(s.z + 90) + lg.side * (c.halfWidth(s.z + 90) + 24), s.y + 12 + 14 * fill, s.z + 90);
  }

  // ---------------------------------------------------------------- the aurora

  private buildAurora(c: Course, lg: LegendPlay): NonNullable<LegendWorld['aurora']> {
    const p = lg.path!;
    const STEP = 4;
    const cols = Math.max(2, Math.floor((p.z1 - p.z0) / STEP) + 1);
    const len = (cols - 1) * STEP;
    // Three curtains: one on the lane's far edge, a taller one beyond it, one across the run.
    const hung = [
      { off: lg.side * (RIBBON_HW + 1.1), h: 1 },
      { off: lg.side * 12, h: 1.55 },
      { off: -lg.side * 15, h: 1.25 },
    ];
    const ROWS = [0, 0.1, 0.42, 1];
    const pos: number[] = [];
    const uv: number[] = [];
    const acr: number[] = [];
    const idx: number[] = [];
    let one = 0;
    hung.forEach((h, hi) => {
      const b = pos.length / 3;
      for (let i = 0; i < cols; i++) {
        const z = p.z0 + i * STEP;
        const x = pathX(c, p, z) + h.off;
        const tx = pathX(c, p, z + 2) - pathX(c, p, z - 2);
        const tl = Math.hypot(tx, 4);
        const end = Math.min(i * STEP, len - i * STEP);
        const lift = 64 * (1 - smooth(end / 46)) ** 2;
        const y = c.ground(x, z) - 0.25;
        for (const v of ROWS) {
          pos.push(x, y, -z);
          uv.push(i * STEP + hi * 37, v, h.h);
          // (Across the line, in three.js x and z.)
          acr.push(4 / tl, tx / tl, lift);
        }
      }
      const R = ROWS.length;
      for (let i = 0; i < cols - 1; i++) for (let k = 0; k < R - 1; k++) idx.push(b + i * R + k, b + (i + 1) * R + k, b + i * R + k + 1, b + i * R + k + 1, b + (i + 1) * R + k, b + (i + 1) * R + k + 1);
      if (hi === 0) one = idx.length;
    });
    const cg = new BufferGeometry();
    cg.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    cg.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 3));
    cg.setAttribute('aAcross', new BufferAttribute(new Float32Array(acr), 3));
    cg.setIndex(idx);
    // The lane: wider than the ribbon by a soft margin, its own edge drawn where the charge begins.
    const HW = 3.3;
    const lp: number[] = [];
    const lu: number[] = [];
    const li: number[] = [];
    const ACR = [-1, -0.5, 0, 0.5, 1];
    for (let i = 0; i < cols; i++) {
      const z = p.z0 + i * STEP;
      const cx = pathX(c, p, z);
      const end = smooth(Math.min(i * STEP, len - i * STEP) / 30);
      for (const v of ACR) {
        const x = cx + v * HW;
        lp.push(x, c.ground(x, z) + 0.14, -z);
        lu.push(i * STEP, v, end);
      }
    }
    for (let i = 0; i < cols - 1; i++) for (let k = 0; k < 4; k++) li.push(i * 5 + k, i * 5 + k + 1, (i + 1) * 5 + k, i * 5 + k + 1, (i + 1) * 5 + k + 1, (i + 1) * 5 + k);
    const lgm = new BufferGeometry();
    lgm.setAttribute('position', new BufferAttribute(new Float32Array(lp), 3));
    lgm.setAttribute('aUv', new BufferAttribute(new Float32Array(lu), 3));
    lgm.setIndex(li);
    const old = this.aurora;
    if (old) {
      old.curtain.geometry.dispose();
      old.lane.geometry.dispose();
      old.curtain.geometry = cg;
      old.lane.geometry = lgm;
      old.made = c;
      old.one = one;
      return old;
    }
    const cm = curtainMaterial();
    const lm = laneMaterial(RIBBON_HW / HW);
    return { curtain: this.add(new Mesh(cg, cm), 6), lane: this.add(new Mesh(lgm, lm), 5), cm, lm, made: c, one };
  }

  /** The Aurora Comes Down: curtains let down out of the sky onto the switchbacks, a lane of their light
   *  on the snow that charges the lantern, and the rider lit in it. Violet, rose and ice: never mint. */
  private stageAurora(ctx: StageCtx, lg: LegendPlay, throwNow: boolean): void {
    if (!lg.path) return;
    const c = ctx.course;
    if (!this.aurora || this.aurora.made !== c) this.aurora = this.buildAurora(c, lg);
    const A = this.aurora;
    const st = ctx.sim!.lg;
    const s = ctx.s;
    if (st.phase === 0) return;
    const move = ctx.reduced ? 0 : 1;
    // Down as it is said (the near end first, the far end as the rider rides in); back up to the sky after.
    const tp = st.phase >= 2 ? (ctx.sim!.tick - st.t0) / 60 : 0;
    const down = Math.min(1.3, this.kIn * 0.72 + tp * 0.3) * (1 - smooth(this.tOver / 3.2));
    const fade = 1 - smooth(this.kExit * 1.15);
    const cu = A.cm.uniforms;
    cu.uT.value = ctx.time;
    cu.uDown.value = down;
    cu.uMove.value = move;
    cu.uFade.value = fade * smooth(this.tSaid / 0.8);
    cu.uHeight.value = ctx.low ? 22 : 27;
    cu.uGain.value = ctx.low ? 1.25 : 1;
    A.curtain.geometry.setDrawRange(0, ctx.low ? A.one : Infinity);
    A.curtain.visible = true;
    const charge = clamp01(st.n / RIBBON_CAP);
    // Riding in it: the charge is rising.
    if (ctx.dt > 0) {
      const on = st.n > this.lastN ? 1 : 0;
      this.lastN = st.n;
      this.riding += (on - this.riding) * Math.min(1, ctx.dt * 7);
    }
    const lu = A.lm.uniforms;
    lu.uT.value = ctx.time;
    lu.uMove.value = move;
    lu.uFade.value = fade;
    lu.uDown.value = down;
    lu.uCharge.value = Math.max(charge * 0.6, this.riding);
    A.lane.visible = true;
    const p = lg.path;
    // Motes of its light rising off the lane ahead.
    const nm = tiered(ctx.tier, [8, 14, 20, 24]);
    const z0 = Math.floor(s.z / 7) * 7;
    for (let j = 0; j < nm; j++) {
      const z = z0 + 10 + j * 7;
      if (z < p.z0 + 4 || z > p.z1 - 4) continue;
      const id = z / 7;
      const up = frac(ctx.time * 0.32 * (move ? 1 : 0.2) + hash(id, 1));
      const x = pathX(c, p, z) + (hash(id, 2) - 0.5) * 2 * RIBBON_HW;
      const laid = clamp01(down * 2.2 - 0.6 - (z - p.z0) * 0.0016);
      ctx.kit.glow(x, c.ground(x, z) + 0.3 + up * 6, z, 0.9 + 0.7 * hash(id, 3), j % 3 === 0 ? PALE : j % 3 === 1 ? MAGENTA : VIOLET, 1.1 * (1 - up) * fade * laid, GLOW_STAR);
    }
    // Its light on the snow ahead, and on the rider while the sled is in it.
    for (const d of [24, 62]) {
      const z = Math.min(p.z1, Math.max(p.z0, s.z + d));
      const x = pathX(c, p, z) + lg.side * 3;
      pushLocalLight(x, c.ground(x, z) + 4, -z, 0.62, 0.36, 1.0, 26, 1.5 * fade * clamp01(down));
    }
    if (this.riding > 0.02) {
      pushLocalLight(s.x, s.y + 1.4, -s.z, 1.0, 0.5, 0.9, 9, 2.4 * this.riding);
      ctx.kit.glow(s.x, s.y + 0.9, s.z, 5.5, MAGENTA, 0.3 * this.riding, GLOW_SOFT);
      ctx.kit.decal(c, s.x, s.z, 5, 7, PALE, 0.5 * this.riding, DECAL_POOL);
      if (throwNow && move) ctx.particles.sparkle(v0.set(s.x, s.y + 0.5, -s.z), Math.random() < 0.5 ? MAGENTA : VIOLET, ctx.low ? 1 : 3, 2.2, 0.6, 0.18, vel.set(s.vx, s.vy, -s.vz), 0.9);
    }
    const fz = Math.min(p.z1, Math.max(p.z0, s.z + 46));
    const fx = pathX(c, p, fz) + lg.side * RIBBON_HW;
    this.focus(ctx, fx, c.ground(fx, fz) + 7, fz);
  }

  // ---------------------------------------------------------------- the cone wakes

  private buildEruption(): NonNullable<LegendWorld['erupt']> {
    const sm = smokeColumn(2100, 2900);
    const fo = fountain(900, 1250);
    const bo = lavaBombs(44);
    const ru = lavaRuns(7, 2100);
    return { smoke: this.add(new Mesh(sm.geo, sm.mat), 1), runs: this.add(new Mesh(ru.geo, ru.mat), 2), fount: this.add(new Mesh(fo.geo, fo.mat), 3), bombs: this.add(new Mesh(bo.geo, bo.mat), 4) };
  }

  /** The Cone Wakes: Ember's cone rumbles as it is said, then blows: a fountain of lava and a column of
   *  lit smoke off its crater, bombs on long arcs, rivers down its flank, a ring through the air, the sky
   *  and the bridge lit orange, embers coming down. It is drawn where massif.ts draws the cone. */
  private stageEruption(ctx: StageCtx, throwNow: boolean): void {
    const st = ctx.sim!.lg;
    if (st.phase === 0) return;
    const E = (this.erupt ??= this.buildEruption());
    const s = ctx.s;
    const move = ctx.reduced ? 0 : 1;
    const az = (this.coneAz * Math.PI) / 180;
    const at = ERUPT_AT.value.set(Math.sin(az) * 4400, 1322, -Math.cos(az) * 4400);
    const BLAST = 2.3;
    const te = this.tSaid;
    const tb = te - BLAST;
    const out = 1 - smooth(this.kExit);
    const power = smooth(tb / 0.7) * (0.3 + 0.7 * out);
    const pulse = 0.78 + 0.22 * move * Math.sin(te * 2.3) * Math.sin(te * 0.9 + 1);
    const su = (E.smoke.material as ShaderMaterial).uniforms;
    su.uT.value = te;
    su.uMove.value = move;
    su.uGrow.value = 0.1 * smooth(te / BLAST) + 0.9 * smooth(tb / 7.5);
    su.uGlow.value = (0.5 + 1.1 * power) * pulse;
    su.uFade.value = smooth(te / 1.2) * out;
    E.smoke.visible = true;
    const fu = (E.fount.material as ShaderMaterial).uniforms;
    fu.uT.value = te;
    fu.uMove.value = move;
    fu.uPower.value = 0.08 * smooth(te / BLAST) * (1 - power) + power;
    E.fount.visible = true;
    if (tb > 0) {
      const bu = (E.bombs.material as ShaderMaterial).uniforms;
      // (Reduced motion: the bombs hang on their arcs, barely moving.)
      bu.uT.value = move ? tb : 3.1 + tb * 0.08;
      bu.uPower.value = power * out;
      bu.uWidth.value = ctx.low ? 46 : 34;
      (E.bombs.geometry as BufferGeometry & { instanceCount: number }).instanceCount = tiered(ctx.tier, [14, 28, 40, 44]);
      E.bombs.visible = out > 0.02;
      const ru = (E.runs.material as ShaderMaterial).uniforms;
      ru.uT.value = te;
      ru.uMove.value = move;
      ru.uFlow.value = clamp01((tb - 0.4) / 6.5);
      ru.uFade.value = out;
      E.runs.visible = true;
    }
    // Where the summit is, near enough, in the sim's frame (the lens rides a few metres behind the sled).
    const cx = s.x + at.x;
    const cy = s.y + 3 + at.y;
    const cz = s.z - 7 - at.z;
    const flash = tb > 0 ? Math.exp(-tb * 1.5) : 0;
    const k = ctx.kit;
    // The crater's glow as it rumbles, the flash of the blast, the smoke deck lit from below.
    k.glow(cx, cy + 40, cz, 700 + 500 * power, HOT, (0.5 * smooth(te / BLAST) + 0.9 * power) * pulse * out, GLOW_SOFT, 1.5);
    if (flash > 0.01) k.glow(cx, cy + 200, cz, 5200, WARM, 1.5 * flash, GLOW_SOFT, 1.4);
    k.glow(cx, cy + 1250, cz, 2600, LAVA, 0.5 * power * pulse * out, GLOW_SOFT, 3.2);
    k.glow(cx + 900, cy + 1500, cz, 1900, LAVA, 0.3 * power * (1.56 - pulse) * out, GLOW_SOFT, 2.6);
    k.glow(cx - 1000, cy + 1450, cz, 2100, LAVA, 0.3 * power * pulse * out, GLOW_SOFT, 2.6);
    // (From the bridge the lens looks down the run and the summit rides the top of the frame: the glow off
    // the cone's shoulders and its lit flanks are what is always in view.)
    k.glow(cx - 1500, cy - 420, cz, 2300, LAVA, 0.34 * power * pulse * out, GLOW_SOFT, 2.2);
    k.glow(cx + 1500, cy - 420, cz, 2300, LAVA, 0.34 * power * (1.56 - pulse) * out, GLOW_SOFT, 2.2);
    // The shock: a ring through the air off the summit (reduced motion: a single still halo).
    if (tb > 0 && tb < 6) {
      if (move) k.glow(cx, cy + 150, cz, 500 + 2700 * tb, WARM, 0.9 * Math.exp(-tb * 0.55) * out, GLOW_RING, 1.0);
      else k.glow(cx, cy + 150, cz, 2400, WARM, 0.5 * Math.exp(-tb * 0.55), GLOW_RING, 1.0);
    }
    // The frame is lit: the blast, then the fountain's pulse, from the cone's side of the sky.
    const lx = s.x + Math.sin(az) * 40;
    pushLocalLight(lx, s.y + 30, -(s.z + 46), 1.0, 0.46, 0.14, 120, (1.0 * power * pulse + 2.6 * flash + 0.3 * smooth(te / BLAST)) * out);
    pushLocalLight(s.x - Math.sin(az) * 20, s.y + 16, -(s.z + 8), 1.0, 0.4, 0.12, 60, 0.5 * power * pulse * out);
    // Ember rain over the bridge once the fountain has had time to throw it this far.
    if (throwNow && tb > 1.4 && out > 0.1) {
      const n = ctx.low ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const z = s.z + 8 + Math.random() * 60;
        ctx.particles.flakes(s.x + (Math.random() - 0.5) * 34, s.y + 5 + Math.random() * 9, -z, EMBERS, 1, 3, move ? 2.2 : 0.6, 0.15);
      }
      if (!ctx.low && move) ctx.kit.glow(s.x + (Math.random() - 0.5) * 30, s.y + 10 + Math.random() * 8, s.z + 30 + Math.random() * 50, 1.2, HOT, 1.2, GLOW_STAR);
    }
    this.focus(ctx, cx, cy + 300, cz);
    this.look.ahead = 4400;
  }

  // ---------------------------------------------------------------- the thousand cranes

  private buildCranes(c: Course, lg: LegendPlay): NonNullable<LegendWorld['cranes']> {
    const N = 960;
    const C = this.cranes ?? (() => {
      const f = craneFlock(N, CRANE_RIBBONS);
      return { mesh: this.add(new Mesh(f.geo, f.mat), 0), mat: f.mat, made: null as Course | null, mid: new Vector3() };
    })();
    C.made = c;
    // The leap's lip, or the place's start when the course has none there.
    const leap = c.leaps.find((l) => l.z > lg.z0 - 40 && l.z < lg.z1 + 20);
    const lip = leap ? leap.z : lg.z0 + 20;
    const x0 = c.safeX(lip);
    const y0 = c.ground(x0, lip);
    const far = lg.z1 - lip + 70;
    // The fall of the ground from the run-in to past the landing: the ribbons follow it.
    const fall = (c.ground(c.safeX(lip + far), lip + far) - c.ground(c.safeX(lip - 110), lip - 110)) / (far + 110);
    (C.mat.uniforms.uOrigin.value as Vector3).set(x0, y0, -lip);
    const A = C.mat.uniforms.uRibA.value as Vector4[];
    const B = C.mat.uniforms.uRibB.value as Vector4[];
    const D = C.mat.uniforms.uRibC.value as Vector4[];
    const sd = lg.side;
    const rib = (i: number, x: number, swing: number, wave: number, h: number, bob: number, start: number, way: number, speed: number, len: number, ph: number, thick: number) => {
      // (A stream's height is over the falling ground where it starts; a wheel's is over its own middle.)
      A[i].set(x, swing, wave, h + fall * start);
      B[i].set(bob, way === 0 ? 0 : fall * way, start, way);
      D[i].set(speed, len, ph, thick);
    };
    // Two streams down the flight either side of the rider, one crossing over it, a great wheel over the
    // landing on the legend's side, a high stream coming back up the valley, a second wheel beyond.
    rib(0, sd * 12, 5, 26, 7, 2.4, -120, 1, 23, 430, 0.4, 4.2);
    rib(1, -sd * 16, 7, 31, 13, 3, -140, 1, 27, 450, 2.1, 5);
    rib(2, 0, 30, 15, 21, 4, -90, 1, 25, 420, 4.0, 5);
    rib(3, sd * 10, 38, 38, 27, 5, far - 20, 0, 21, 2 * Math.PI * 38, 0, 6.5);
    rib(4, -sd * 42, 12, 30, 36, 5, far + 260, -1, 19, 430, 1.3, 8);
    rib(5, -sd * 30, 27, 27, 19, 4, far + 90, 0, 18, 2 * Math.PI * 27, 2.6, 5);
    C.mid.set(x0 + sd * 10, y0 + fall * (far - 20) + 24, lip + far - 20);
    return C;
  }

  /** The Thousand Cranes: flocks of folded-paper cranes rising from under the last leap's lip, streaming
   *  down the flight beside the rider and wheeling over the landing, then climbing away. */
  private stageCranes(ctx: StageCtx, lg: LegendPlay, throwNow: boolean): void {
    const c = ctx.course;
    if (!this.cranes || this.cranes.made !== c) this.cranes = this.buildCranes(c, lg);
    const C = this.cranes;
    const st = ctx.sim!.lg;
    if (st.phase === 0) return;
    const u = C.mat.uniforms;
    const tp = st.phase >= 2 ? (ctx.sim!.tick - st.t0) / 60 : 0;
    u.uT.value = ctx.reduced ? this.tSaid * 0.3 : this.tSaid + 40;
    u.uMove.value = ctx.reduced ? 0 : 1;
    // The first flock is up as it is said, the rest by the lip; all of them leave together.
    u.uRise.value = 0.8 * smooth(this.kIn * 1.25) + 0.5 * smooth(tp / 1.2);
    u.uLeave.value = smooth((this.kExit - 0.2) / 0.8);
    u.uSize.value = ctx.low ? 2.6 : 1.7;
    (C.mesh.geometry as BufferGeometry & { instanceCount: number }).instanceCount = tiered(ctx.tier, [150, 520, 900, 960]);
    C.mesh.visible = true;
    // A few folds of loose paper coming down through the flight.
    if (throwNow && !ctx.reduced && !ctx.low && st.phase >= 2 && this.kExit < 0.5 && Math.random() < 0.5) {
      const s = ctx.s;
      ctx.particles.flakes(s.x + (Math.random() - 0.5) * 24, s.y + 8 + Math.random() * 8, -(s.z + 20 + Math.random() * 40), PETALS, 1, 2, 0.8, 0.16);
    }
    this.focus(ctx, C.mid.x, C.mid.y, C.mid.z);
  }
}
