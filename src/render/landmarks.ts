import { BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, ShaderMaterial, Vector3, Vector4 } from 'three';
import type { Beat } from '../game/beats';
import { MOODS, Mood } from '../sim/chaos';
import { CHUNK_LEN, Course, SectionKind } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { CrowdUniforms, FIGURE_H, crowdColors, crowdMaterial, figureGeometry } from './crowd';
import { Kind, Piece, SiteCtx, mergePiece, pieceFor } from './landmarkKit';
import type { Clearing } from './dressing';
import { makeToonMaterial } from './materials';
import type { Palette } from './palette';

// Set pieces: every 500 to 900 m the course runs past, beside or under one big, memorable place (a
// start gate high over the run, a trestle footbridge, an ice arch, a basalt gateway, a giant torii;
// a mountain hut, a ruined watchtower, a ski jump, a frozen waterfall, an observatory, a stone
// guardian, a pagoda), so a run is a sequence of places down the fall line instead of one corridor.
// Where they are and what they are is deterministic per course (and mood: low gravity needs more
// headroom), keyed to the section each stands in. Crowds of toy spectators line the banks at the
// gates and huts and cheer the rider's moments.
//
// Safety (ART.md and the lane rules): nothing stands in the corridor or within 9.2 m of its edge
// except high overhead, and a span's lowest point clears the highest air any sled can reach under it
// (airCeiling: every launch up the slope, kickers and vents included, at the fastest speed there, in
// this mood's gravity) by SPAN_MARGIN; a span that would have to stand over SPAN_MAX is swapped for
// a bank piece.
//
// Cost: two piece meshes (each drawn only while in view) and one crowd batch: +3 draws on Medium and
// High (+2 in the shadow pass while a piece is in the shadow frustum); Low draws the spans only,
// +2 at most. Pieces are made on idle time, a few parts per callback, never at a run's start.

/** The first site's distance range, and the spacing after it. */
const FIRST_Z = 380;
const FIRST_SPREAD = 180;
const STEP_MIN = 500;
const STEP_SPREAD = 400;
/** Sites keep this far from a kilometre arch. */
const KM_KEEP = 90;
/** Metres of clear air between the highest sled and a span's lowest point. */
export const SPAN_MARGIN = 6;
/** A span stands at least this far over the corridor's floor, so it reads as high overhead. */
const SPAN_MIN = 22;
/** A span that would have to stand higher than this over the floor is swapped for a bank piece. */
const SPAN_MAX = 56;
/** How far up the slope a launch can still be in the air at a span. */
const REACH = 380;
/** Half the depth (along the run) of the span's footprint the air is checked over. */
const SPAN_DEPTH = 7;
/** The dressing rule: nothing decorative within this edge excess. */
const BANK_KEEP = 9.4;
/** Idle building: none before this after the first frame, each callback at most this late. */
const IDLE_START_MS = 900;
const IDLE_MS = 1000;
/** Crowd instances in view at once. */
const CROWD_CAP = 420;

const SPAN_KINDS: Record<BiomeId, Kind[]> = {
  alpine: ['gate', 'bridge'],
  glacier: ['arch', 'gate'],
  volcanic: ['basalt', 'arch', 'bridge'],
  blossom: ['torii', 'bridge'],
};
const BANK_KINDS: Record<BiomeId, Kind[]> = {
  alpine: ['hut', 'tower', 'jump'],
  glacier: ['falls', 'dome', 'guardian'],
  volcanic: ['guardian', 'tower', 'falls'],
  blossom: ['pagoda', 'guardian', 'hut'],
};
/** How likely a section is to carry a span: narrow ones mostly, wide ones mostly a bank piece. */
const SPAN_CHANCE: Record<SectionKind, number> = { chute: 0.8, gully: 0.85, cruise: 0.55, switchbacks: 0.5, benches: 0.35, bowl: 0.3, split: 0.3 };
/** Kinds that gather a crowd on the banks (both banks for spans, mostly their own side otherwise). */
const CROWDED: ReadonlySet<Kind> = new Set<Kind>(['gate', 'torii', 'basalt', 'bridge', 'hut', 'jump', 'pagoda']);

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function whenIdle(fn: (deadline: IdleDeadline | null) => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback((d) => fn(d.didTimeout ? null : d), { timeout: IDLE_MS });
  else setTimeout(() => fn(null), 50);
}

/** The fastest a sled can be going at sim z (it starts from rest; boosts and a steep start allowed). */
export function speedCap(z: number): number {
  return Math.min(46, 6 + Math.sqrt(2 * 9.81 * 0.4 * Math.max(0, z)));
}

/**
 * The highest a sled can be (world y, its runners) anywhere over sim z in [za, zb], in a mood with
 * this gravity and pop multiplier. Every launch up to REACH metres up the slope is flown: a fully
 * charged pop from the best sled at the fastest speed there (and at three quarters of it) on the
 * centre line, every kicker's lip (the pop off a ramp top is 1.3 times), and every steam vent, over
 * the real ground (drops let a flight carry further). Horizontal speed is held through the air.
 * Generous by design: it takes the sim's pop on a falling slope, max(vy, 0) + pop, at face value.
 */
export function airCeiling(c: Course, za: number, zb: number, gravity: number, popK: number): number {
  const g = 9.81 * gravity;
  const pop = 5.6 * popK;
  let top = -Infinity;
  const fly = (x: number, zl: number, vy0: number, v: number) => {
    let y = c.ground(x, zl);
    let vy = vy0;
    let z = zl;
    const dt = 0.08;
    for (let k = 0; k < 200; k++) {
      z += v * dt;
      y += vy * dt;
      vy -= g * dt;
      if (z > zb) return;
      if (z >= za && y > top) top = y;
      if ((k & 1) === 1 && y < c.ground(x, z)) return;
    }
  };
  const z0 = Math.max(0, za - REACH);
  for (let zl = z0; zl <= zb; zl += 5) {
    const x = c.centerX(zl);
    const vmax = speedCap(zl);
    const gz = (c.ground(x, zl + 0.6) - c.ground(x, zl - 0.6)) / 1.2;
    for (const f of [1, 0.75]) {
      const v = vmax * f;
      fly(x, zl, Math.max(0, v * gz) + pop, v);
    }
  }
  for (let i = Math.floor(z0 / CHUNK_LEN); i <= Math.floor(zb / CHUNK_LEN); i++) {
    if (i < 0) continue;
    const zn = c.zones(i);
    for (const r of zn.ramps) {
      const lip = r.z + r.len;
      if (lip > zb || lip < z0) continue;
      const v = speedCap(lip);
      const face = (c.ground(r.x, lip - 0.3) - c.ground(r.x, lip - 0.9)) / 0.6;
      for (const f of [1, 0.75]) fly(r.x, lip, Math.max(0, v * f * face) + pop * 1.3, v * f);
    }
    for (const vt of zn.vents) {
      if (vt.z > zb || vt.z < z0) continue;
      const v = speedCap(vt.z);
      for (const f of [1, 0.6]) fly(vt.x, vt.z, vt.power * (gravity < 1 ? 0.8 : 1) + pop, v * f);
    }
  }
  return top;
}

/** One set piece's place on the course. */
export interface Site {
  n: number;
  kind: Kind;
  span: boolean;
  /** The bank a bank piece stands on (+1 right). */
  side: 1 | -1;
  /** Sim z of the site, and its frame: origin (world) and yaw. */
  z: number;
  x: number;
  y: number;
  yaw: number;
  /** Local x of the post line, and (spans) the lowest local height over the corridor. */
  post: number;
  clear: number;
}

/** The site frame's ground sampler: local (x, z) to the ground's height over the origin. */
export function siteGround(c: Course, s: { x: number; y: number; z: number; yaw: number }): (lx: number, lz: number) => number {
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  return (lx, lz) => {
    const wx = s.x + lx * cy + lz * sy;
    const sz = s.z + lx * sy - lz * cy;
    return c.ground(wx, sz) - s.y;
  };
}

/** A site-local point in world coordinates. */
export function siteToWorld(s: { x: number; y: number; z: number; yaw: number }, lx: number, ly: number, lz: number, out: Vector3): Vector3 {
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  return out.set(s.x + lx * cy + lz * sy, s.y + ly, -s.z - lx * sy + lz * cy);
}

/** The deterministic list of a course's sites (planned lazily, in order). */
export class SitePlan {
  private list: Site[] = [];
  private nextZ: number;
  private gravity: number;
  private pop: number;
  private spanI = 0;
  private bankI = 0;

  constructor(
    readonly course: Course,
    mood: Mood,
  ) {
    const mp = (MOODS[mood] ?? MOODS[0]).params;
    this.gravity = mp.gravity;
    this.pop = mp.pop;
    this.nextZ = FIRST_Z + hashf(course.seed, 1, 1) * FIRST_SPREAD;
  }

  /** Sites planned so far. */
  get planned(): readonly Site[] {
    return this.list;
  }

  /** How far the plan reaches (the next site's z). */
  get reach(): number {
    return this.nextZ;
  }

  /** How high a span at sim z must stand over its origin's floor. */
  private spanNeed(z: number): number {
    const c = this.course;
    const air = airCeiling(c, z - SPAN_DEPTH, z + SPAN_DEPTH, this.gravity, this.pop);
    let floor = -Infinity;
    for (const dz of [-SPAN_DEPTH, 0, SPAN_DEPTH]) {
      for (let k = -4; k <= 4; k++) {
        const sz = z + dz;
        const x = c.centerX(sz) + (k / 4) * c.halfWidth(sz);
        floor = Math.max(floor, c.ground(x, sz));
      }
    }
    return Math.max(air + SPAN_MARGIN, floor + SPAN_MIN) - c.ground(c.centerX(z), z);
  }

  /** Plans the next site. Each kind list is walked round from a per-course start, so a run sees every
   *  piece its mountain has before one repeats; a span looks up to 90 m either way for the quietest
   *  air (the lowest it can stand), and a stretch where none fits gets a bank piece instead. */
  planNext(): Site {
    const c = this.course;
    const n = this.list.length;
    const prevZ = n > 0 ? this.list[n - 1].z : -Infinity;
    const offKm = (z: number) => {
      const km = Math.round(z / 1000);
      return km >= 1 && Math.abs(z - km * 1000) < KM_KEEP ? km * 1000 + KM_KEEP : z;
    };
    let z = offKm(this.nextZ);
    const biome = c.biome;
    const prev = n > 0 ? this.list[n - 1].kind : null;
    const spans = SPAN_KINDS[biome];
    const banks = BANK_KINDS[biome];
    const next = (list: Kind[], salt: number, i: number): Kind => {
      // (Spans start from the mountain's signature, the first in its list.)
      const start = list === spans ? 0 : Math.floor(hashf(c.seed, salt, 9) * list.length);
      let k = list[(start + i) % list.length];
      if (k === prev && list.length > 1) k = list[(start + i + 1) % list.length];
      return k;
    };
    const sec = c.section(z);
    let span = hashf(c.seed, n, 3) < SPAN_CHANCE[sec.kind];
    // Never three of a sort in a row: after two bank pieces try a span, after two spans a bank piece.
    if (n >= 2 && this.list[n - 1].span === this.list[n - 2].span) span = !this.list[n - 1].span;
    let kind: Kind = span ? next(spans, 4, this.spanI) : next(banks, 5, this.bankI);
    // A gully's high banks carry a bridge where there is one.
    if (sec.kind === 'gully' && spans.includes('bridge') && prev !== 'bridge') {
      span = true;
      kind = 'bridge';
    }
    let clear = 0;
    if (span) {
      let best = Infinity;
      let bz = z;
      for (const dz of [0, -45, 45, -90, 90, -140, 140]) {
        const zc = offKm(z + dz);
        if (zc - prevZ < STEP_MIN || zc - prevZ > STEP_MIN + STEP_SPREAD + KM_KEEP) continue;
        const need = this.spanNeed(zc);
        if (need < best) {
          best = need;
          bz = zc;
        }
        if (best <= SPAN_MIN + 6) break;
      }
      if (best > SPAN_MAX) {
        span = false;
        kind = next(banks, 5, this.bankI);
      } else {
        z = bz;
        clear = best;
      }
    }
    // (A gully's bridge is extra: the round of spans carries on where it was.)
    if (span && !(kind === 'bridge' && sec.kind === 'gully')) this.spanI++;
    else this.bankI++;
    this.nextZ = z + STEP_MIN + hashf(c.seed, n + 2, 2) * STEP_SPREAD;
    const side: 1 | -1 = hashf(c.seed, n, 6) < 0.5 ? -1 : 1;
    const dx = (c.centerX(z + 1) - c.centerX(z - 1)) / 2;
    const site: Site = { n, kind, span, side, z, x: c.centerX(z), y: c.ground(c.centerX(z), z), yaw: -Math.atan(dx), post: 0, clear };
    site.post = postLine(c, site);
    this.list.push(site);
    return site;
  }

  /** Plans up to sim z. */
  planTo(z: number): void {
    while (this.nextZ <= z) this.planNext();
  }

  /** The forest kept clear between sim z0 and z1: a bank piece's ground and its crowd's rows on
   *  both banks, and a span's piers. Planned as far as it needs, so the props can ask on idle time. */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    this.planTo(z1 + 60);
    for (const s of this.list) {
      if (s.z < z0 - 60 || s.z > z1 + 60) continue;
      if (s.span) {
        for (const side of [-1, 1]) {
          out.push({ side, e: 12, z0: s.z - 36, z1: s.z + 30, w: 3.2 });
          out.push({ side, e: s.post - 2, z0: s.z - SPAN_DEPTH - 4, z1: s.z + SPAN_DEPTH + 4, w: 9 });
        }
      } else {
        out.push({ side: s.side, e: 30, z0: s.z - 32, z1: s.z + 30, w: 21 });
        out.push({ side: -s.side, e: 12, z0: s.z - 20, z1: s.z + 16, w: 3.2 });
      }
    }
  }
}

/** The local x past which everything stands at least BANK_KEEP past the corridor's edge, over the
 *  span's whole depth, on both sides. */
function postLine(c: Course, s: Site): number {
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  let post = 0;
  for (const side of [-1, 1]) {
    let lx = c.halfWidth(s.z) * 0.8;
    for (; lx < 200; lx += 0.25) {
      let ok = true;
      for (const lz of [-SPAN_DEPTH, -3, 0, 3, SPAN_DEPTH]) {
        const wx = s.x + side * lx * cy + lz * sy;
        const sz = s.z + side * lx * sy - lz * cy;
        if (c.edgeExcess(wx, sz) < BANK_KEEP) {
          ok = false;
          break;
        }
      }
      if (ok) break;
    }
    post = Math.max(post, lx);
  }
  return post;
}

/** Whether a palette is a night one (windows and lamps lit, lanterns in the crowd). */
function isNight(p: Palette): boolean {
  return p.lantern || p.moon || p.comet || p.stars > 0.5;
}

interface Build {
  site: Site;
  piece: Piece;
  made: BufferGeometry[];
  step: number;
}

/** A crowd figure in world space. */
interface Figure {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  coat: Color;
  hat: Color;
  seed: Vector4;
}

export class SetPieces {
  readonly root = new Object3D();
  private plan: SitePlan;
  private slots: Mesh[] = [];
  private shown: Array<Site | null> = [null, null];
  private plain: ShaderMaterial;
  private iceMat: ShaderMaterial;
  private crowdMat: ShaderMaterial;
  private crowd: InstancedMesh;
  private aCoat: InstancedBufferAttribute;
  private aHat: InstancedBufferAttribute;
  private aSeed: InstancedBufferAttribute;
  /** Made pieces by site, and the ones being made (one step per idle callback). */
  private built = new Map<number, BufferGeometry>();
  private pieceIce = new Map<number, boolean>();
  private queue: Build[] = [];
  /** How far ahead the plan should reach (planned on idle time). */
  private wantReach = 0;
  /** The far end of the view (sim z). */
  private viewEnd = 0;
  /** Play-tests: idle jobs run, the longest one (ms), and pieces made on the frame that needed them. */
  readonly stats = { jobs: 0, maxJobMs: 0, madeNow: 0 };
  private figures = new Map<number, Figure[]>();
  private crowdKey = '';
  private idleOpen = false;
  private idleBusy = false;
  private started = false;
  private tier: 'low' | 'medium' | 'high';
  private shadows: boolean;
  private night = false;
  readonly uniforms: CrowdUniforms = { uCheer: { value: new Vector4(0, 0, -99, 0) }, uRider: { value: new Vector3() }, uLamps: { value: 0 } };
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private up = new Vector3(0, 1, 0);

  constructor(
    private course: Course,
    private palette: Palette,
    private mood: Mood,
    tier: 'low' | 'medium' | 'high',
    shadows: boolean,
  ) {
    this.tier = tier;
    this.shadows = shadows;
    this.plan = new SitePlan(course, mood);
    const near: [number, number] = [1.8, 3.6];
    this.plain = makeToonMaterial({ coolShade: 0.5, nearFade: near });
    this.iceMat = makeToonMaterial({ coolShade: 0.5, nearFade: near, ice: true });
    for (let i = 0; i < 2; i++) {
      const mesh = new Mesh(new BufferGeometry(), this.plain);
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      this.slots.push(mesh);
      this.root.add(mesh);
    }
    this.crowdMat = crowdMaterial(this.uniforms);
    const geo = figureGeometry();
    this.aCoat = new InstancedBufferAttribute(new Float32Array(CROWD_CAP * 3), 3);
    this.aHat = new InstancedBufferAttribute(new Float32Array(CROWD_CAP * 3), 3);
    this.aSeed = new InstancedBufferAttribute(new Float32Array(CROWD_CAP * 4), 4);
    geo.setAttribute('aCoat', this.aCoat);
    geo.setAttribute('aHat', this.aHat);
    geo.setAttribute('aSeed', this.aSeed);
    this.crowd = new InstancedMesh(geo, this.crowdMat, CROWD_CAP);
    this.crowd.count = 0;
    this.crowd.castShadow = false;
    this.root.add(this.crowd);
    this.setPalette(palette);
  }

  /** A new course or mood (the plan depends on the mood's gravity; the pieces bake the palette). */
  setCourse(course: Course, palette: Palette, mood: Mood): void {
    const replan = course !== this.course || (MOODS[mood] ?? MOODS[0]).params.gravity !== (MOODS[this.mood] ?? MOODS[0]).params.gravity || (MOODS[mood] ?? MOODS[0]).params.pop !== (MOODS[this.mood] ?? MOODS[0]).params.pop;
    this.course = course;
    this.mood = mood;
    if (replan) this.plan = new SitePlan(course, mood);
    this.palette = palette;
    this.setPalette(palette);
  }

  /** The forest the props must keep clear between sim z0 and z1 (SitePlan.clearings). */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    this.plan.clearings(z0, z1, out);
  }

  setQuality(tier: 'low' | 'medium' | 'high', shadows: boolean): void {
    this.tier = tier;
    this.shadows = shadows;
    this.crowdKey = '';
    this.shown = [null, null];
  }

  /** Every made piece bakes the palette's colours: drop them all and make them again. */
  private setPalette(p: Palette): void {
    this.palette = p;
    this.night = isNight(p);
    this.uniforms.uLamps.value = this.night ? 1 : 0;
    for (const s of this.slots) {
      s.visible = false;
      s.geometry = new BufferGeometry();
    }
    for (const g of this.built.values()) g.dispose();
    this.built.clear();
    this.pieceIce.clear();
    this.queue = [];
    this.figures.clear();
    this.crowdKey = '';
    this.shown = [null, null];
  }

  private ctxFor(site: Site): SiteCtx {
    return {
      p: this.palette,
      biome: this.course.biome,
      gy: siteGround(this.course, site),
      post: site.post,
      clear: site.clear,
      side: site.side,
      night: this.night,
      seed: (this.course.seed ^ (site.n * 7919)) >>> 0,
    };
  }

  /** Whether this tier draws a site (Low: the spans only). */
  private drawn(site: Site): boolean {
    return this.tier !== 'low' || site.span;
  }

  /** Queues a site's piece for idle time. */
  private enqueue(site: Site): void {
    if (this.built.has(site.n) || this.queue.some((b) => b.site.n === site.n)) return;
    this.queue.push({ site, piece: pieceFor(site.kind, this.ctxFor(site)), made: [], step: 0 });
    // Nearest first.
    this.queue.sort((a, b) => a.site.z - b.site.z);
    this.pump();
  }

  /** Makes a site's piece there and then (only one about to come into view unmade). */
  private makeNow(site: Site): BufferGeometry {
    let b = this.queue.find((q) => q.site.n === site.n);
    if (!b) b = { site, piece: pieceFor(site.kind, this.ctxFor(site)), made: [], step: 0 };
    while (b.step < b.piece.steps.length) b.made.push(...b.piece.steps[b.step++]());
    this.queue = this.queue.filter((q) => q !== b);
    return this.finish(b);
  }

  private finish(b: Build): BufferGeometry {
    const g = mergePiece(b.made);
    b.made = [];
    this.built.set(b.site.n, g);
    this.pieceIce.set(b.site.n, b.piece.ice);
    // Keep the pieces round the rider; drop the oldest.
    if (this.built.size > 4) {
      for (const [n, old] of this.built) {
        if (this.built.size <= 4) break;
        if (this.shown.some((s) => s && s.n === n)) continue;
        old.dispose();
        this.built.delete(n);
        this.pieceIce.delete(n);
      }
    }
    return g;
  }

  /** Idle jobs (as many as each idle period has room for): plan the next site ahead, or make one
   *  step of the nearest queued piece. */
  private pump(): void {
    if (!this.idleOpen || this.idleBusy || (this.queue.length === 0 && this.plan.reach >= this.wantReach)) return;
    this.idleBusy = true;
    whenIdle((deadline) => {
      this.idleBusy = false;
      // As many jobs as the idle period has room for (one where there is no deadline).
      for (let k = 0; k < 6; k++) {
        const t0 = performance.now();
        const b = this.queue[0];
        // A piece already in view is made before the plan reaches further ahead.
        if (this.plan.reach < this.wantReach && !(b && b.site.z < this.viewEnd)) this.plan.planNext();
        else if (b) {
          if (b.step < b.piece.steps.length) b.made.push(...b.piece.steps[b.step++]());
          else {
            this.queue.shift();
            this.finish(b);
            this.shown = [null, null];
          }
        } else break;
        const ms = performance.now() - t0;
        this.stats.jobs++;
        this.stats.maxJobMs = Math.max(this.stats.maxJobMs, ms);
        if (!deadline || deadline.timeRemaining() < Math.max(6, ms * 1.5)) break;
      }
      this.pump();
    });
  }

  /**
   * Per frame. `z` is the rider's sim z (the view runs from a little behind it to `ahead` metres
   * down), `rider` its world position, `time` the shared clock, and `beats` this frame's named
   * moments (run frames only), which set the crowds cheering.
   */
  update(z: number, ahead: number, rider: Vector3, time: number, beats: readonly Beat[]): void {
    if (!this.started) {
      this.started = true;
      setTimeout(() => {
        this.idleOpen = true;
        this.pump();
      }, IDLE_START_MS);
    }
    this.uniforms.uRider.value.copy(rider);
    for (const b of beats) this.cheer(b, rider, time);
    const plan = this.plan;
    // Plan a site or two past the view on idle time (planning a span flies its launches: a few ms),
    // and only what is already in view there and then.
    this.wantReach = z + ahead + 1400;
    this.viewEnd = z + ahead + 60;
    plan.planTo(this.viewEnd);
    this.pump();
    // The sites in view, nearest first, at most two.
    let k = 0;
    const want: Array<Site | null> = [null, null];
    for (const s of plan.planned) {
      if (s.z < z - 160 || s.z > z + ahead + 60 || !this.drawn(s)) continue;
      // Queue it for idle time as soon as it is planned; a site within 3 chunks unmade is made now.
      if (!this.built.has(s.n)) {
        if (s.z - z < 3 * CHUNK_LEN + 60) {
          this.makeNow(s);
          this.stats.madeNow++;
        } else this.enqueue(s);
      }
      if (k < 2) want[k++] = s;
    }
    // The next site past the view is queued ahead.
    for (const s of plan.planned) if (s.z > this.viewEnd && s.z < z + ahead + 1000 && this.drawn(s)) this.enqueue(s);
    if (want[0] !== this.shown[0] || want[1] !== this.shown[1]) this.show(want);
  }

  private show(want: Array<Site | null>): void {
    this.shown = want;
    for (let i = 0; i < 2; i++) {
      const s = want[i];
      const mesh = this.slots[i];
      const g = s ? this.built.get(s.n) : undefined;
      if (!s || !g) {
        mesh.visible = false;
        continue;
      }
      mesh.geometry = g;
      mesh.material = this.pieceIce.get(s.n) ? this.iceMat : this.plain;
      mesh.position.set(s.x, s.y, -s.z);
      mesh.quaternion.setFromAxisAngle(this.up, s.yaw);
      mesh.updateMatrix();
      mesh.updateMatrixWorld(true);
      mesh.castShadow = this.shadows && s.span;
      mesh.visible = true;
    }
    this.fillCrowd(want);
  }

  /** The crowd batch: every figure at the shown sites (Medium and High). */
  private fillCrowd(want: Array<Site | null>): void {
    const key = want.map((s) => (s && this.built.has(s.n) ? s.n : -1)).join(',') + this.tier;
    if (key === this.crowdKey) return;
    this.crowdKey = key;
    let n = 0;
    if (this.tier !== 'low') {
      for (const s of want) {
        if (!s || !this.built.has(s.n)) continue;
        for (const f of this.figuresFor(s)) {
          if (n >= CROWD_CAP) break;
          this.q.setFromAxisAngle(this.up, f.yaw);
          this.v.set(f.x, f.y, f.z);
          this.s.setScalar(f.scale);
          this.m.compose(this.v, this.q, this.s);
          this.crowd.setMatrixAt(n, this.m);
          this.aCoat.setXYZ(n, f.coat.r, f.coat.g, f.coat.b);
          this.aHat.setXYZ(n, f.hat.r, f.hat.g, f.hat.b);
          this.aSeed.setXYZW(n, f.seed.x, f.seed.y, f.seed.z, f.seed.w);
          n++;
        }
      }
    }
    this.crowd.count = n;
    this.crowd.instanceMatrix.needsUpdate = true;
    this.aCoat.needsUpdate = true;
    this.aHat.needsUpdate = true;
    this.aSeed.needsUpdate = true;
    if (n > 0) this.crowd.computeBoundingSphere();
    this.crowd.visible = n > 0;
  }

  /** A site's spectators: along the bank crests round it (both banks at a span) and on the piece. */
  private figuresFor(site: Site): Figure[] {
    let list = this.figures.get(site.n);
    if (list) return list;
    list = [];
    if (CROWDED.has(site.kind)) {
      const c = this.course;
      const { coats, hats } = crowdColors(c.biome, this.palette);
      const seed = (c.seed ^ (site.n * 2654435761)) >>> 0;
      let k = 0;
      const add = (x: number, y: number, z: number, yaw: number) => {
        const h = (salt: number) => hashf(seed, k, salt);
        list!.push({
          x,
          y,
          z,
          yaw,
          scale: (h(1) < 0.12 ? 0.74 : 0.92 + h(2) * 0.16) * (FIGURE_H / 1.62),
          coat: coats[Math.floor(h(3) * coats.length)],
          hat: hats[Math.floor(h(4) * hats.length)],
          seed: new Vector4(h(5), h(6), h(7) < 0.3 ? 1 : 0, 1),
        });
        k++;
      };
      const sides = site.span ? [-1, 1] : [site.side, -site.side];
      for (const side of sides) {
        const own = site.span || side === site.side;
        for (let row = 0; row < 2; row++) {
          const e = BANK_KEEP + 0.15 + row * 1.25;
          const span = own ? 34 : 18;
          for (let dz = -span; dz <= span * 0.8; dz += 2.2) {
            if (site.span && Math.abs(dz) < 5.5) continue;
            if (hashf(seed, Math.round(dz * 10) + row * 1000 + side * 5000, 9) < (own ? 0.28 : 0.5)) continue;
            const z = site.z + dz + (row ? 0.95 : 0) + (hashf(seed, k, 10) - 0.5) * 0.8;
            const x = c.centerX(z) + side * (c.halfWidth(z) + e + hashf(seed, k, 11) * 0.5);
            // Facing the run and up the slope, where the rider comes from.
            const yaw = Math.atan2(-side, 0.55) + (hashf(seed, k, 12) - 0.5) * 0.5;
            add(x, c.ground(x, z) - 0.03, -z, yaw);
          }
        }
      }
      // Those standing on the piece itself (a bridge's deck, a hut's terrace).
      const piece = pieceFor(site.kind, this.ctxFor(site));
      for (const sp of piece.spots) {
        const w = siteToWorld(site, sp.x, sp.y, sp.z, this.v);
        add(w.x, w.y, w.z, sp.yaw + site.yaw);
      }
    }
    this.figures.set(site.n, list);
    return list;
  }

  /** A moment near the crowds: the rider's pass, stomp, bank and the like set them cheering, harder
   *  for a bigger one. The cheer ripples out from where it was made (crowd.ts). */
  private cheer(b: Beat, rider: Vector3, time: number): void {
    let k = 0;
    switch (b.type) {
      case 'stomp':
      case 'grudgeSettled':
      case 'finale':
        k = 1;
        break;
      case 'pass':
        k = b.muted ? 0 : 1;
        break;
      case 'bank':
        k = 0.45 + 0.18 * b.tier;
        break;
      case 'nearMiss':
        k = b.grade === 'whisker' ? 0.7 : 0;
        break;
      case 'driftRelease':
        k = b.tier >= 3 ? 0.8 : b.tier === 2 ? 0.5 : 0;
        break;
      case 'flow':
        k = b.phase === 'in' ? 0.75 : 0;
        break;
      case 'newGround':
      case 'km':
        k = 0.7;
        break;
      default:
        break;
    }
    if (k <= 0) return;
    const c = this.uniforms.uCheer.value;
    // A new moment takes over unless a bigger one is still ringing.
    const left = c.w * Math.max(0, 1 - (time - c.z) / 2.6);
    if (k < left) return;
    c.set(rider.x, rider.z, time, k);
  }
}
