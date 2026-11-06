import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, ShaderMaterial, Vector3, Vector4 } from 'three';
import type { Beat } from '../game/beats';
import { MOODS, Mood } from '../sim/chaos';
import { CHUNK_LEN, Course, RUN_OUT, Section, SectionKind } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { CrowdUniforms, FIGURE_H, crowdColors, crowdMaterial, figureGeometry } from './crowd';
import { ENCLOSED, Kind, Piece, Rail, SPANS, SiteCtx, mergePiece, pieceFor } from './landmarkKit';
import { inClearing, liftLine, type Clearing } from './dressing';
import { Chairs } from './liftline';
import { makeToonMaterial, shared } from './materials';
import { OverlookPlan } from './overlook';
import { journeyDusk, type Palette } from './palette';

// Places: a run is a sequence of places down the fall line instead of one corridor. The course says where
// (SitePlan): a `street` section is a town you ride through, a `tunnel` an enclosed run, a `bridge` a
// bridge over the chasm, the `finish` the finish town, a leap has a crowd on its shoulders, z = 0 is the
// start, and between them lift lines and the point pieces (a gate high over the run, an ice arch, a
// basalt gateway, a giant torii; a mountain hut, a ruined watchtower, a ski jump, a frozen waterfall, an
// observatory, a stone guardian, a pagoda) close every stretch to about 300 m. Which piece is
// deterministic per course; how high it stands depends on the mood (low gravity needs more headroom).
// Crowds of toy spectators line the barriers and cheer the rider's moments.
//
// Safety (ART.md and the lane rules): nothing stands in the corridor or inside the course's own edge
// limit (edgeLimit: 9.2 m on plain ground, 2 m in a street, 0.8 m on a bridge) except high overhead, and
// what hangs over the run clears the highest air any sled can reach under it (airCeiling: every launch
// up the slope, kickers and vents included, at the fastest speed there, in this mood's gravity) by
// SPAN_MARGIN. A span that would have to stand over SPAN_MAX is swapped for a bank piece; a roof over
// ENC_MAX or over a launch comes off, and its walls stand alone. Long sites are built along the course's
// own line (a rail) and hang nothing lower than airProfile: the same flights, binned along the run.
// Inside an enclosure the frame darkens at its edges and the way out flashes (`light`, which world.ts
// hands to the post).
//
// Cost: three piece meshes (each drawn only while in view) and one crowd batch, +1 for the lift chairs,
// so +4 draws on Medium and High (+3 in the shadow pass while a piece is in the shadow frustum), and in
// a town at night its lamplight pools (+1) and in Ember's its steam (+1); Low draws the spans, the
// long sites and their shells, +3 at most. Pieces are made on idle time, a few parts per callback,
// never at a run's start.

/** A stretch of run longer than this gets a piece, or leaves room for an overlook. */
const BARE_MAX = 282;
/** The start's stretch of ramp (sim z): crowd, barriers and the start gate. */
const START_FROM = -8;
const START_TO = 118;
/** The share of a street's or finish's blend its town reaches back up: the outskirts, standing back. */
const STREET_LEAD = 0.4;
/** Metres of finish town past the end of the run-out (the hall that closes the view). */
const FINISH_TAIL = 34;
/** A town beside the run where a script holds no street: how far down at least, and the room it needs. */
const TOWN_FROM = 900;
const TOWN_MIN = 110;
const TOWN_SECTIONS: ReadonlySet<SectionKind> = new Set<SectionKind>(['chute', 'cruise', 'switchbacks', 'benches', 'split']);
/** The first lift line: at least this far down, and this far above the first leap's lip, so an overlook
 *  fits between it and the start's crowd (the first one opens by 600 m). */
const LIFT_FIRST = 505;
const LIFT_LEAD = 120;
const LIFT_SECTIONS: ReadonlySet<SectionKind> = new Set<SectionKind>(['bowl', 'split', 'benches', 'lake', 'cruise', 'switchbacks']);
/** The second lift line keeps this far from the first: it is the one near the middle, not a neighbour. */
const LIFT_APART = 900;
/** An overlook keeps this far from a piece's centre (overlook.ts SITE_KEEP and its margin). */
const SITE_ROOM = 130;
/** A piece moved off a kilometre arch keeps this far from the one before it. */
const FILL_GAP = 100;
/** How far before a ravine's end its span stands. */
const RAVINE_SPAN = 50;
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
/** The dressing rule on plain ground: nothing decorative within this edge excess. */
const BANK_KEEP = 9.4;
/** Idle building: none before this after the first frame, each callback at most this late. */
const IDLE_START_MS = 900;
const IDLE_MS = 1000;
/** Nothing is made on a frame until this long after idle time opens. */
const IDLE_GRACE_MS = 1800;
/** Piece meshes drawn at once. */
const SLOTS = 3;
/** Made pieces kept round the rider, and how far past the view pieces are made ahead. */
const KEEP_BUILT = 6;
const QUEUE_AHEAD = 500;
/** Crowd instances in view at once (High; Medium draws the nearest CROWD_MED). */
const CROWD_CAP = 560;
const CROWD_MED = 380;
/** A street's crowd drawn round the rider: from this far behind to this far ahead (sim metres). */
const WINDOW_BACK = 25;
const WINDOW_AHEAD = 150;
/** How far behind the rider a site stays drawn, and how far once something ahead wants its slot. */
const BEHIND = 160;
const BEHIND_SHORT = 30;
/** How much of the day must have gone for the windows to glow (journeyDusk). */
const DUSK_LIT = 0.45;

/** An enclosure's roof stands at least this high over its floor (it reads as a roof, not a lid), and
 *  where it would have to stand higher than ENC_MAX, over its mouth, it comes off. */
const ENC_MIN: Partial<Record<Kind, number>> = { gallery: 13.5, icetunnel: 12.5, lavatunnel: 12.5, toriirow: 11.5 };
const ENC_MAX = 42;
/** The air profile's bin, metres. */
const AIR_BIN = 2;

const SPAN_KINDS: Record<BiomeId, Kind[]> = {
  alpine: ['gate', 'bridge'],
  glacier: ['arch', 'gate'],
  volcanic: ['basalt', 'arch', 'bridge'],
  blossom: ['torii', 'bridge'],
};
// (Ember's vents throw spans high, so it gets the most bank pieces, its basalt lodge among them.)
const BANK_KINDS: Record<BiomeId, Kind[]> = {
  alpine: ['hut', 'tower', 'jump'],
  glacier: ['falls', 'dome', 'guardian'],
  volcanic: ['guardian', 'hut', 'tower', 'falls'],
  blossom: ['pagoda', 'guardian', 'hut'],
};
const ENC_KINDS: Record<BiomeId, Kind[]> = {
  alpine: ['gallery'],
  glacier: ['icetunnel', 'gallery'],
  volcanic: ['lavatunnel', 'gallery'],
  blossom: ['toriirow', 'gallery'],
};
/** How likely a section's piece is to span the run: narrow ones mostly (a ravine's walls hide anything on
 *  its banks), wide ones mostly a bank piece. */
const SPAN_CHANCE: Record<SectionKind, number> = { chute: 0.8, gully: 0.85, ravine: 1, treerun: 0.7, cruise: 0.55, switchbacks: 0.5, benches: 0.35, bowl: 0.3, split: 0.3, fork: 0.3, lake: 0.15, terraces: 0.2, leap: 0.15, start: 0, street: 0, bridge: 0, tunnel: 0, finish: 0 };
/** Sections whose walls stand close: a tall bank piece behind one rears over the run. */
const WALLED: ReadonlySet<SectionKind> = new Set<SectionKind>(['ravine', 'gully', 'tunnel', 'treerun']);
/** Kinds that gather a crowd on the banks (both banks for spans, mostly their own side otherwise). */
const CROWDED: ReadonlySet<Kind> = new Set<Kind>(['gate', 'torii', 'basalt', 'bridge', 'hut', 'jump', 'pagoda', 'village', 'finish', 'start', 'lip', 'lift']);
/** Kinds whose whole crowd is the piece's own spots. */
const OWN_CROWD: ReadonlySet<Kind> = new Set<Kind>(['village', 'finish', 'start', 'lip', 'lift']);
/** Kinds whose crowd is long: drawn in a window round the rider. */
const STREETS: ReadonlySet<Kind> = new Set<Kind>(['village', 'finish', 'start']);

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
  let top = -Infinity;
  flights(c, za, zb, gravity, popK, (z, y) => {
    if (z >= za && y > top) top = y;
  });
  return top;
}

/** The highest air over sim z in [za, zb] as a profile: the same flights as airCeiling, each kept in
 *  every AIR_BIN-metre bin it passes over (between two of its steps the height is interpolated, so a
 *  fast flight marks every bin it crosses). Bin i covers za + i * AIR_BIN onward; -Infinity where
 *  nothing flies. */
export function airProfile(c: Course, za: number, zb: number, gravity: number, popK: number): Float32Array {
  const n = Math.max(1, Math.ceil((zb - za) / AIR_BIN));
  const out = new Float32Array(n).fill(-Infinity);
  const mark = (z: number, y: number) => {
    const i = Math.floor((z - za) / AIR_BIN);
    if (i >= 0 && i < n && y > out[i]) out[i] = y;
  };
  flights(c, za, zb, gravity, popK, (z, y, z0, y0) => {
    mark(z, y);
    // (The bins between the last step and this one, at the higher end of the two.)
    for (let zz = Math.ceil(z0 / AIR_BIN) * AIR_BIN; zz < z; zz += AIR_BIN) mark(zz, Math.max(y, y0));
  });
  return out;
}

/** Flies every launch that can still be in the air over [za, zb] (see airCeiling), calling `visit`
 *  with each step's sim z and height and the step before it; `pops` false flies only the kickers and
 *  vents (a cheap first look). */
function flights(c: Course, za: number, zb: number, gravity: number, popK: number, visit: (z: number, y: number, z0: number, y0: number) => void, pops = true): void {
  const g = 9.81 * gravity;
  const pop = 5.6 * popK;
  const fly = (x: number, zl: number, vy0: number, v: number) => {
    let y = c.ground(x, zl);
    let vy = vy0;
    let z = zl;
    const dt = 0.08;
    for (let k = 0; k < 200; k++) {
      const pz = z;
      const py = y;
      z += v * dt;
      y += vy * dt;
      vy -= g * dt;
      if (z > zb) return;
      if (z >= za) visit(z, y, pz, py);
      if ((k & 1) === 1 && y < c.ground(x, z)) return;
    }
  };
  const z0 = Math.max(0, za - REACH);
  // (Past the finish a sled coasts: nothing leaves the ground there.)
  const zEnd = Math.min(zb, c.finishZ);
  for (let zl = z0; pops && zl <= zEnd; zl += 5) {
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
  /** Local x of the post line, and (spans) the lowest local height over the corridor (an enclosure:
   *  its roof's underside over its floor, the course's base height). */
  post: number;
  clear: number;
  /** A long site's half length along the run (0 for one at a point): it covers z - len to z + len. */
  len: number;
  /** A long site's air profile (world y per AIR_BIN metres from airZ), or null. */
  air: Float32Array | null;
  airZ: number;
  /** Its air has been flown in this plan's mood: `clear`, `post` and a span's kind are final. */
  flown: boolean;
}

/** A site's first and last sim z. */
export function siteSpan(s: Site): [number, number] {
  return [s.z - s.len, s.z + s.len];
}

/** The highest air over sim z in [a, b] from a long site's profile (world y). */
export function siteAir(s: Site, a: number, b: number): number {
  if (!s.air) return -Infinity;
  const i0 = Math.max(0, Math.floor((a - s.airZ) / AIR_BIN));
  const i1 = Math.min(s.air.length - 1, Math.floor((b - s.airZ) / AIR_BIN));
  let top = -Infinity;
  for (let i = i0; i <= i1; i++) top = Math.max(top, s.air[i]);
  return top;
}

/** A long site's stretch of run in its own frame (landmarkKit Rail). */
export function siteRail(c: Course, s: Site): Rail {
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  const lx = (x: number, z: number) => (x - s.x) * cy + (z - s.z) * sy;
  const lz = (x: number, z: number) => (x - s.x) * sy - (z - s.z) * cy;
  return {
    len: s.len,
    at(dz, side, e) {
      const z = s.z + dz;
      const cx = c.centerX(z);
      const hw = c.halfWidth(z);
      const x = side === 0 ? cx : cx + side * (hw + e);
      // Up the run's line here, in the site frame, and (on a bank) the way in across it.
      const xa = c.centerX(z - 1);
      const xb = c.centerX(z + 1);
      let ux = lx(xa, z - 1) - lx(xb, z + 1);
      let uz = lz(xa, z - 1) - lz(xb, z + 1);
      const l = Math.hypot(ux, uz) || 1;
      ux /= l;
      uz /= l;
      const fx = side === 0 ? ux : -side * uz;
      const fz = side === 0 ? uz : side * ux;
      return { x: lx(x, z), z: lz(x, z), y: c.ground(x, z) - s.y, yaw: Math.atan2(fx, fz), hw };
    },
    floor: (dz) => c.baseY(s.z + dz) - s.y,
    limit: (dz) => c.edgeLimit(s.z + dz),
    air: (a, b) => siteAir(s, s.z + a, s.z + b) - s.y,
    edge(x, z) {
      return c.edgeExcess(s.x + x * cy + z * sy, s.z + x * sy - z * cy);
    },
  };
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

/** A lift line of the dressing's at sim z, or null. */
function liftAt(c: Course, z: number): { side: number; e: number; z0: number; z1: number } | null {
  const l = liftLine(c.section(z));
  return l && z > l.z0 - 40 && z < l.z1 + 40 ? l : null;
}

/** Set while a plan works out its overlooks: the plans they read lay only what the sections fix. */
let probing = false;
/** A course's layout, and how far its round of bank pieces had got. */
const LAID = new WeakMap<Course, { drafts: Draft[]; bankI: number }>();

/** A site as the script lays it, before any air is flown. */
interface Draft {
  kind: Kind;
  z: number;
  len: number;
  span: boolean;
  side: 1 | -1;
}

const startOf = (d: Draft): number => d.z - d.len;
const endOf = (d: Draft): number => d.z + d.len;

/**
 * A course's sites. The course's own sections are the plan: a `street` is a town, a `tunnel` an
 * enclosure, a `bridge` a bridge, the `finish` the finish town, every leap a crowd on its shoulders, and
 * z = 0 the start. What is left is filled with lift lines, overlooks and point pieces so no bare stretch
 * runs past BARE_MAX. All of that is known at once, from the sections
 * and hashes alone, and is the same in every mood (`planned`, `clearings`). What depends on the mood is
 * how high things stand: `flyNext` flies a site's air on idle time, and a span or a roof that cannot
 * clear it in this mood's gravity comes down (spanNeed, roofNeed, quiet).
 */
export class SitePlan {
  private list: Site[] = [];
  private laid = false;
  private next = 0;
  private gravity: number;
  private pop: number;
  private spanI = 0;
  private bankI = 0;
  /** Play-tests: the longest flight of one site, ms. */
  readonly stats = { maxPlanMs: 0 };

  constructor(
    readonly course: Course,
    mood: Mood,
  ) {
    const mp = (MOODS[mood] ?? MOODS[0]).params;
    this.gravity = mp.gravity;
    this.pop = mp.pop;
  }

  /** Every site on the course, in z order, flown or not. */
  get planned(): readonly Site[] {
    this.lay();
    return this.list;
  }

  /** How far the plan reaches: all of the course, from the start (see the class's head). */
  get reach(): number {
    return Infinity;
  }

  /** (The positions are all known: what keeps clear of them has nothing to wait for.) */
  planNext(): void {
    this.lay();
  }

  planTo(_z: number): void {
    this.lay();
  }

  /** The start of the next site still to fly (Infinity once all are). */
  get flownTo(): number {
    this.lay();
    const s = this.list[this.next];
    return s ? s.z - s.len : Infinity;
  }

  /** Flies the next site: a few ms for a span, more for a long site. */
  flyNext(): void {
    this.lay();
    const s = this.list[this.next];
    if (!s) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    this.fly(s);
    this.next++;
    if (t0) this.stats.maxPlanMs = Math.max(this.stats.maxPlanMs, performance.now() - t0);
  }

  /** Flies every site that starts before sim z. */
  flyTo(z: number): void {
    while (this.flownTo <= z) this.flyNext();
  }

  /** A kind list walked round from a per-course start, so a run sees every piece its mountain has
   *  before one repeats. */
  private round(list: readonly Kind[], salt: number, i: number, avoid: Kind | null): Kind {
    // (Spans start from the mountain's signature, the first in its list.)
    const start = salt === 4 ? 0 : Math.floor(hashf(this.course.seed, salt, 9) * list.length);
    const k = list[(start + i) % list.length];
    return k === avoid && list.length > 1 ? list[(start + i + 1) % list.length] : k;
  }

  /** The next bank piece that suits the section at z: a frozen fall stands only where it stands well
   *  back from the run, never behind a ravine's rim, where it rears right over the lens. */
  private nextBank(z: number, avoid: Kind | null): Kind {
    const banks = BANK_KINDS[this.course.biome];
    const walled = WALLED.has(this.course.section(z).kind);
    for (let t = 0; t <= banks.length; t++) {
      const k = this.round(banks, 5, this.bankI++, avoid);
      if (!(walled && k === 'falls')) return k;
    }
    return banks[0];
  }

  /** The sections' sites, then the lift lines, then a piece in every stretch still too long. */
  private lay(): void {
    if (this.laid) return;
    this.laid = true;
    const c = this.course;
    // (Where things stand is the same in every mood, so a course lays it out once.)
    const done = probing ? undefined : LAID.get(c);
    const drafts = done ? done.drafts : this.layout();
    if (!done && !probing) LAID.set(c, { drafts, bankI: this.bankI });
    if (done) this.bankI = done.bankI;
    drafts.forEach((d, n) => {
      const x = c.centerX(d.z);
      const dx = (c.centerX(d.z + 1) - c.centerX(d.z - 1)) / 2;
      this.list.push({ n, kind: d.kind, span: d.span, side: d.side, z: d.z, x, y: c.ground(x, d.z), yaw: -Math.atan(dx), post: c.halfWidth(d.z) + BANK_KEEP, clear: 0, len: d.len, air: null, airZ: 0, flown: false });
    });
  }

  /** Where everything stands (see the class's head). */
  private layout(): Draft[] {
    const c = this.course;
    const end = c.finishZ + RUN_OUT;
    const seed = c.seed;
    const secs: Section[] = [];
    for (let z = 0; z < end; ) {
      const sec = c.section(z);
      secs.push(sec);
      z = sec.z1;
    }
    const sideOf = (n: number): 1 | -1 => (hashf(seed, n, 6) < 0.5 ? -1 : 1);
    const long = (kind: Kind, a: number, b: number, n: number): Draft => ({ kind, z: (a + b) / 2, len: (b - a) / 2, span: false, side: sideOf(n) });
    const drafts: Draft[] = [long('start', START_FROM, START_TO, 0)];
    let encI = 0;
    secs.forEach((sec, i) => {
      const body = sec.z0 + sec.blend;
      if (sec.kind === 'street') drafts.push(long('village', sec.z0 + sec.blend * STREET_LEAD, sec.z1 - 1, i));
      else if (sec.kind === 'tunnel') {
        const kinds = ENC_KINDS[c.biome];
        drafts.push(long(kinds[encI++ % kinds.length], body + 1, sec.z1 - 1, i));
      } else if (sec.kind === 'bridge') drafts.push(long('viaduct', body, sec.z1, i));
      else if (sec.kind === 'finish') drafts.push(long('finish', sec.z0 + sec.blend * STREET_LEAD, end + FINISH_TAIL, i));
      else if (sec.kind === 'leap') drafts.push({ kind: 'lip', z: sec.ledges[0].z, len: 0, span: false, side: sideOf(i) });
      // A ravine's walls hide anything on its banks: what it holds is a span across its slot, near its end.
      else if (sec.kind === 'ravine') {
        const prev = drafts[drafts.length - 1];
        const kind = this.round(SPAN_KINDS[c.biome], 4, this.spanI++, prev.span ? prev.kind : null);
        drafts.push({ kind, z: this.offKm(sec.z1 - RAVINE_SPAN, Infinity), len: 0, span: true, side: sideOf(i) });
      }
    });
    // A mountain whose script holds no street still has a town beside the run, in the stretch that suits
    // it best: where the banks stand open and the run is narrow enough to feel the houses.
    if (!secs.some((s) => s.kind === 'street')) {
      let best: Section | null = null;
      for (const sec of secs) {
        const room = sec.z1 - sec.z0 - sec.blend;
        if (sec.z0 < TOWN_FROM || !TOWN_SECTIONS.has(sec.kind) || room < TOWN_MIN) continue;
        if (!best || room > best.z1 - best.z0 - best.blend) best = sec;
      }
      if (best) drafts.push(long('village', best.z0 + best.blend, best.z1 - 2, 99));
    }
    drafts.sort((a, b) => a.z - b.z);
    this.addLifts(secs, drafts);
    if (!probing) this.fill(drafts);
    drafts.sort((a, b) => a.z - b.z);
    // Filled round the fixed pieces, two of a kind can still meet: the second moves on a kind.
    for (let i = 1; i < drafts.length; i++) {
      const d = drafts[i];
      if (d.kind !== drafts[i - 1].kind || d.len > 0 || d.kind === 'lip' || d.kind === 'lift') continue;
      if (d.span) {
        const list = SPAN_KINDS[c.biome];
        d.kind = list[(list.indexOf(d.kind) + 1) % list.length];
      } else d.kind = this.nextBank(d.z, d.kind);
    }
    return drafts;
  }

  /** Lift lines over the wide ground: one just ahead of the first leap, one wherever the wide sections
   *  are about halfway down. */
  private addLifts(secs: readonly Section[], drafts: Draft[]): void {
    const c = this.course;
    const firstLip = c.leaps.length > 0 ? c.leaps[0].z : 620;
    const put = (z0: number, n: number) => {
      const z = this.offKm(z0);
      // (The station keeps off the bank the dressing's own lift line runs on.)
      const l = liftAt(c, z);
      const side: 1 | -1 = l ? (l.side > 0 ? -1 : 1) : hashf(c.seed, n, 61) < 0.5 ? -1 : 1;
      drafts.push({ kind: 'lift', z, len: 0, span: true, side });
    };
    const first = Math.max(LIFT_FIRST, firstLip - LIFT_LEAD);
    put(first, 1);
    let best: Section | null = null;
    let score = -Infinity;
    for (const sec of secs) {
      if (!LIFT_SECTIONS.has(sec.kind)) continue;
      const body = sec.z0 + sec.blend;
      if (sec.z1 - body < 90) continue;
      const mid = (body + sec.z1) / 2;
      if (Math.abs(mid - first) < LIFT_APART || drafts.some((d) => mid > startOf(d) - 130 && mid < endOf(d) + 130)) continue;
      const k = (sec.kind === 'bowl' ? 300 : 0) - Math.abs(mid - c.finishZ * 0.55);
      if (k > score) {
        score = k;
        best = sec;
      }
    }
    if (best) put(Math.round((best.z0 + best.blend + best.z1) / 2), 2);
    drafts.sort((a, b) => a.z - b.z);
  }

  /** z moved off a kilometre arch's stretch, if it stands in one: on past it if that stays within
   *  BARE_MAX of `after`, else back up the run. */
  private offKm(z: number, after = -Infinity): number {
    const km = Math.round(z / 1000);
    if (km < 1 || Math.abs(z - km * 1000) >= KM_KEEP) return z;
    const on = km * 1000 + KM_KEEP;
    const back = km * 1000 - KM_KEEP;
    return on - after <= BARE_MAX || back - after < FILL_GAP ? on : back;
  }

  /** A piece in every stretch longer than BARE_MAX, keeping off the overlooks, which are places too.
   *  Overlooks keep 120 m from every piece and are planned round them, so they would never find room
   *  if the pieces came first. So the overlooks are worked out first, against what the sections fix
   *  alone, and the pieces fill round them: the real overlook plan then lands on the same stretches,
   *  because it looks in the same order and the pieces only take ground it had already passed over. */
  private fill(drafts: Draft[]): void {
    const c = this.course;
    const seed = c.seed;
    const end = c.finishZ + RUN_OUT;
    probing = true;
    const looks = new OverlookPlan(c);
    looks.planTo(end);
    probing = false;
    const out: Draft[] = [];
    let n = 0;
    const add = (z0: number, after: number): number => {
      const z = this.offKm(z0, after);
      const span = SPAN_CHANCE[c.section(z).kind] > hashf(seed, n + 100, 3);
      const prev = out.length > 0 ? out[out.length - 1].kind : null;
      const kind = span ? this.round(SPAN_KINDS[c.biome], 4, this.spanI++, prev) : this.nextBank(z, prev);
      out.push({ kind, z, len: 0, span, side: hashf(seed, n + 100, 6) < 0.5 ? -1 : 1 });
      n++;
      return z;
    };
    /** Evenly from one spot to the next, each measured from the last as it landed. */
    const spread = (from: number, to: number, salt: number) => {
      for (let k = 0, at = from; to - at > BARE_MAX; k++) {
        const parts = Math.ceil((to - at) / BARE_MAX);
        const z = at + (to - at) / parts + (hashf(seed, salt, k + 7) - 0.5) * 24;
        // (The wander stops where a stretch either side of it would run past the limit.)
        at = add(Math.max(to - (parts - 1) * BARE_MAX, Math.min(at + BARE_MAX, z)), at);
      }
    };
    for (let i = 0; i + 1 < drafts.length; i++) {
      const b = startOf(drafts[i + 1]);
      let at = endOf(drafts[i]);
      for (const v of looks.planned) {
        if (v.z1 < at || v.z0 > b) continue;
        // A piece up to the overlook's keep at each end, where the stretch still needs one.
        const head = v.z0 - SITE_ROOM - 1;
        if (v.z0 - at > BARE_MAX) {
          spread(at, head, i + v.n * 100);
          add(head, -Infinity);
        }
        at = v.z1;
        const tail = at + SITE_ROOM + 1;
        if (b - tail > BARE_MAX - SITE_ROOM) at = add(tail, Infinity);
      }
      spread(at, b, i);
    }
    drafts.push(...out);
  }

  /** Flies a site: how high what stands over the run must stand in this mood, or that it cannot. */
  private fly(s: Site): void {
    const c = this.course;
    s.flown = true;
    if (s.len > 0) {
      s.airZ = s.z - s.len - 8;
      s.air = airProfile(c, s.airZ, s.z + s.len + 8, this.gravity, this.pop);
      if (ENCLOSED.has(s.kind)) {
        // (Low gravity flies every launch far over any roof: the walls stand, the roof does not.)
        const [air, least] = this.roofNeed(s, s.kind);
        s.clear = this.gravity >= 0.95 && air <= ENC_MAX && this.quiet(s.z - s.len, s.z + s.len) ? least : 0;
      }
      return;
    }
    s.post = postLine(c, s);
    if (!s.span) return;
    const need = this.spanNeed(s.z);
    if (need > SPAN_MAX) {
      // The air here in this mood is too high for it: a bank piece instead.
      s.span = false;
      s.kind = this.nextBank(s.z, s.n > 0 ? this.list[s.n - 1].kind : null);
    } else s.clear = need;
  }

  /** Nothing launches under the stretch: no kicker, drop or vent under it or just above its mouth
   *  (what flies in from further up the slope, the air profile lifts the roof over). */
  private quiet(z0: number, z1: number): boolean {
    const c = this.course;
    for (let i = Math.floor((z0 - 40) / CHUNK_LEN); i <= Math.floor(z1 / CHUNK_LEN); i++) {
      if (i < 0) continue;
      const zn = c.zones(i);
      for (const r of zn.ramps) if (r.z + r.len + 2 > z0 - 12 && r.z < z1 + 6) return false;
      for (const d of zn.drops) if (d.z + d.len + d.rec > z0 - 10 && d.z < z1 + 6) return false;
      for (const v of zn.vents) if (v.z + v.r > z0 - 20 && v.z - v.r < z1 + 6) return false;
    }
    return true;
  }

  /** What an enclosure's roof must clear over its floor: the highest air over the stretch plus the margin,
   *  and the least it may stand anywhere, ENC_MIN over the corridor's highest ground (each plus a metre
   *  for the roof's pitch). The roof follows the air down the stretch (town.ts bays): a run's air is at
   *  its highest over a tunnel's mouth, so the mouth stands tallest and the roof comes down inside. */
  private roofNeed(s: Site, kind: Kind): [number, number] {
    const c = this.course;
    let air = 0;
    let least = 0;
    for (let dz = -s.len - 6; dz <= s.len + 6; dz += AIR_BIN) {
      const z = s.z + dz;
      const base = c.baseY(z);
      air = Math.max(air, siteAir(s, z - 2 * AIR_BIN, z + 2 * AIR_BIN) + SPAN_MARGIN - base);
      const cx = c.centerX(z);
      const hw = c.halfWidth(z);
      for (let k = -4; k <= 4; k++) least = Math.max(least, c.ground(cx + (k / 4) * hw, z) - base + (ENC_MIN[kind] ?? 13));
    }
    return [air + 1, least + 1];
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

  /** The ground kept clear between sim z0 and z1, of the forest and of the dressing. Positions only, so a
   *  chunk being made never waits for a flight: a span's piers and the bank piece that replaces it
   *  where it cannot stand are both kept. */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    this.lay();
    for (const s of this.list) {
      if (s.z + s.len < z0 - 60 || s.z - s.len > z1 + 60) continue;
      const [a, b] = siteSpan(s);
      if (s.kind === 'lip') {
        for (const side of [-1, 1]) out.push({ side, e: 16, z0: s.z - 26, z1: s.z + 20, w: 7 });
      } else if (s.kind === 'lift') {
        // The station's ground, and the cut the far towers stand in.
        out.push({ side: s.side, e: 26, z0: s.z - 20, z1: s.z + 20, w: 17 });
        out.push({ side: -s.side, e: 56, z0: s.z - 9, z1: s.z + 9, w: 48 });
        for (const side of [-1, 1]) out.push({ side, e: 12, z0: s.z - 12, z1: s.z + 12, w: 3.2 });
      } else if (s.len > 0) {
        for (const side of [-1, 1]) {
          if (s.kind === 'village' || s.kind === 'finish') out.push({ side, e: 26, z0: a - 12, z1: b + 12, w: 26 });
          else if (s.kind === 'start') out.push({ side, e: 24, z0: a - 12, z1: b + 12, w: 16 });
          else if (s.kind === 'viaduct') out.push({ side, e: 14, z0: a - 8, z1: b + 8, w: 14 });
          else out.push({ side, e: 9, z0: a - 8, z1: b + 8, w: 9 });
        }
      } else {
        for (const side of [-1, 1]) out.push({ side, e: 12, z0: s.z - 36, z1: s.z + 30, w: 3.2 });
        out.push({ side: s.side, e: 30, z0: s.z - 32, z1: s.z + 30, w: 21 });
        out.push({ side: -s.side, e: 12, z0: s.z - 20, z1: s.z + 16, w: 3.2 });
        if (SPANS.has(s.kind)) for (const side of [-1, 1]) out.push({ side, e: BANK_KEEP + 4, z0: s.z - SPAN_DEPTH - 4, z1: s.z + SPAN_DEPTH + 4, w: 9 });
      }
    }
  }
}

/** What a site's builder knows. */
export function pieceCtx(c: Course, s: Site, p: Palette, night: boolean, low: boolean): SiteCtx {
  return {
    p,
    biome: c.biome,
    gy: siteGround(c, s),
    post: s.post,
    clear: s.clear,
    side: s.side,
    night,
    seed: (c.seed ^ (s.n * 7919)) >>> 0,
    rail: s.len > 0 ? siteRail(c, s) : undefined,
    low,
    line: c.finishZ - s.z,
    lastZ: c.finishZ + RUN_OUT - s.z,
  };
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

/** Lamplight pools drawn at once (each a two-ring disc laid on the snow), and steam puffs. */
const POOL_CAP = 160;
const POOL_SEG = 10;
const POOL_V = 1 + 2 * POOL_SEG;
/** Their strength at night, and where only the journey's dusk has lit them. */
const POOL_NIGHT = 0.8;
const POOL_DUSK = 0.3;
const STEAM_CAP = 72;
const STEAM_PER = 4;

/** The pools' material: warm light added over the snow, fading into the fog. */
function poolMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color('#FFB060') }, uK: { value: 0.8 }, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      attribute float aK;
      varying float vK;
      varying vec3 vW;
      void main() {
        vK = aK;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uK;
      uniform float uFogNear;
      uniform float uFogFar;
      varying float vK;
      varying vec3 vW;
      void main() {
        float a = vK * vK * (3.0 - 2.0 * vK);
        float fog = 1.0 - smoothstep(uFogNear, uFogFar, length(vW - cameraPosition));
        gl_FragColor = vec4(uColor * a * uK * fog, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    // (A disc laid on the snow by angle winds clockwise seen from above.)
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Steam: soft camera-facing puffs that rise, swell and thin off the shared clock. */
function steamMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: shared.uTime, uFog: shared.uFog, uSunColor: shared.uSunColor, uHemi: shared.uHemi, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      attribute vec3 aBase;
      attribute vec2 aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vA;
      varying vec3 vW;
      void main() {
        float t = fract(uTime * (0.11 + 0.05 * aSeed.y) + aSeed.x);
        vec3 c = aBase + vec3(sin(t * 3.0 + aSeed.x * 9.0) * 1.2 * t, t * 9.0, cos(t * 2.0 + aSeed.y * 7.0) * 0.8 * t);
        float size = (1.2 + 3.4 * t) * (0.8 + 0.4 * aSeed.y);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 w = c + (right * position.x + up * position.y) * size;
        vUv = position.xy;
        vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.45, 1.0, t));
        vW = w;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      uniform vec3 uSunColor;
      uniform vec3 uHemi;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying float vA;
      varying vec3 vW;
      void main() {
        float r = length(vUv);
        float a = (1.0 - smoothstep(0.3, 1.0, r)) * vA * 0.55;
        vec3 col = mix(vec3(0.94, 0.95, 1.0) * (0.55 + 0.45 * uSunColor), uFog, 0.3) + uHemi * 0.08;
        float fog = smoothstep(uFogNear, uFogFar, length(vW - cameraPosition));
        gl_FragColor = vec4(mix(col, uFog, fog), a * (1.0 - fog));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
}

export class SetPieces {
  readonly root = new Object3D();
  private plan: SitePlan;
  private slots: Mesh[] = [];
  private shown: Array<Site | null> = new Array<Site | null>(SLOTS).fill(null);
  private plain: ShaderMaterial;
  private iceMat: ShaderMaterial;
  private crowdMat: ShaderMaterial;
  private crowd: InstancedMesh;
  private aCoat: InstancedBufferAttribute;
  private aHat: InstancedBufferAttribute;
  private aSeed: InstancedBufferAttribute;
  /** The lift lines' chairs, on the lines in view (Medium and High). */
  private chairs: Chairs;
  /** A village's lamplight on the snow (night, Medium and High) and Ember's steam. */
  private pools: Mesh;
  private poolPos: BufferAttribute;
  private steam: Mesh;
  private steamBase: BufferAttribute;
  private steamSeed: BufferAttribute;
  /** Made pieces by site, and the ones being made (one step per idle callback). */
  private built = new Map<number, BufferGeometry>();
  private pieceIce = new Map<number, boolean>();
  private extras = new Map<number, Pick<Piece, 'glows' | 'steam' | 'spots'>>();
  private queue: Build[] = [];
  /** How far ahead the plan should reach (planned on idle time). */
  private wantReach = 0;
  /** The far end of the view (sim z). */
  private viewEnd = 0;
  /** Play-tests: idle jobs run, the longest one (ms), and pieces made on the frame that needed them. */
  readonly stats = { jobs: 0, maxJobMs: 0, madeNow: 0 };
  private figures = new Map<number, Figure[]>();
  private crowdKey = '';
  /** The village crowd's window: the rider's sim z it was last filled round. */
  private windowZ = -1e9;
  private idleOpen = false;
  private madeOpen = false;
  private idleBusy = false;
  private started = false;
  private tier: 'low' | 'medium' | 'high';
  private shadows: boolean;
  private night = false;
  readonly uniforms: CrowdUniforms = { uCheer: { value: new Vector4(0, 0, -99, 0) }, uRider: { value: new Vector3() }, uLamps: { value: 0 }, uWave: { value: 0 } };
  /** An enclosed run's light on the frame, for the post (world.ts): `shade` darkens the frame's edges
   *  inside (0 to 1), `flash` is the way out's burst of daylight and the bars of light strobing past
   *  a gallery's pillars. */
  readonly light = { shade: 0, flash: 0 };
  private exitFlash = 0;
  private inside: Site | null = null;
  private lastT = 0;
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private up = new Vector3(0, 1, 0);
  private keepBuf: Clearing[] = [];
  private nearBuf: Site[] = [];
  private riderZ = 0;

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
    for (let i = 0; i < SLOTS; i++) {
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
    this.chairs = new Chairs(this.plain, course.biome);
    this.root.add(this.chairs.mesh);
    // The pools: a fixed buffer of discs (world coordinates), refilled when the shown sites change.
    const pg = new BufferGeometry();
    this.poolPos = new BufferAttribute(new Float32Array(POOL_CAP * POOL_V * 3), 3);
    const k = new Float32Array(POOL_CAP * POOL_V);
    const idx: number[] = [];
    for (let i = 0; i < POOL_CAP; i++) {
      const b = i * POOL_V;
      k[b] = 1;
      for (let j = 0; j < POOL_SEG; j++) {
        k[b + 1 + j] = 0.5;
        k[b + 1 + POOL_SEG + j] = 0;
        const j2 = (j + 1) % POOL_SEG;
        idx.push(b, b + 1 + j, b + 1 + j2);
        idx.push(b + 1 + j, b + 1 + POOL_SEG + j, b + 1 + POOL_SEG + j2);
        idx.push(b + 1 + j, b + 1 + POOL_SEG + j2, b + 1 + j2);
      }
    }
    pg.setAttribute('position', this.poolPos);
    pg.setAttribute('aK', new BufferAttribute(k, 1));
    pg.setIndex(idx);
    pg.setDrawRange(0, 0);
    this.pools = new Mesh(pg, poolMaterial());
    this.pools.frustumCulled = false;
    this.pools.visible = false;
    this.pools.renderOrder = 2;
    this.root.add(this.pools);
    // The steam: quads (corner in position.xy) round a base each.
    const sg = new BufferGeometry();
    const corner = new Float32Array(STEAM_CAP * 4 * 3);
    const sidx: number[] = [];
    for (let i = 0; i < STEAM_CAP; i++) {
      for (let j = 0; j < 4; j++) {
        corner[(i * 4 + j) * 3] = j === 0 || j === 3 ? -1 : 1;
        corner[(i * 4 + j) * 3 + 1] = j < 2 ? -1 : 1;
      }
      sidx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    sg.setAttribute('position', new BufferAttribute(corner, 3));
    this.steamBase = new BufferAttribute(new Float32Array(STEAM_CAP * 4 * 3), 3);
    this.steamSeed = new BufferAttribute(new Float32Array(STEAM_CAP * 4 * 2), 2);
    sg.setAttribute('aBase', this.steamBase);
    sg.setAttribute('aSeed', this.steamSeed);
    sg.setIndex(sidx);
    sg.setDrawRange(0, 0);
    this.steam = new Mesh(sg, steamMaterial());
    this.steam.frustumCulled = false;
    this.steam.visible = false;
    this.steam.renderOrder = 3;
    this.root.add(this.steam);
    this.setPalette(palette);
  }

  /** A new course or mood (the plan depends on the mood's gravity; the pieces bake the palette). */
  setCourse(course: Course, palette: Palette, mood: Mood): void {
    const replan = course !== this.course || (MOODS[mood] ?? MOODS[0]).params.gravity !== (MOODS[this.mood] ?? MOODS[0]).params.gravity || (MOODS[mood] ?? MOODS[0]).params.pop !== (MOODS[this.mood] ?? MOODS[0]).params.pop;
    this.course = course;
    this.mood = mood;
    if (replan) this.plan = new SitePlan(course, mood);
    this.chairs.setBiome(course.biome);
    this.palette = palette;
    this.setPalette(palette);
  }

  /** The sites planned so far (other systems keep their own pieces clear of them). */
  get planned(): readonly Site[] {
    return this.plan.planned;
  }

  /** The forest the props must keep clear between sim z0 and z1 (SitePlan.clearings). */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    this.plan.clearings(z0, z1, out);
  }

  /** Whether a set piece keeps the bank clear at world x and sim z (a cabin's smoke asks: the dressing
   *  drops a cabin there). */
  keeps(x: number, z: number): boolean {
    const c = this.course;
    const list = this.keepBuf;
    list.length = 0;
    this.plan.clearings(z - 1, z + 1, list);
    const off = x - c.centerX(z);
    return inClearing(list, off < 0 ? -1 : 1, Math.abs(off) - c.halfWidth(z), z);
  }

  setQuality(tier: 'low' | 'medium' | 'high', shadows: boolean): void {
    // (What is made stays as it is: a tier that changes mid-run must not rebuild the street in view.)
    this.tier = tier;
    this.shadows = shadows;
    this.crowdKey = '';
    this.shown = this.shown.map(() => null);
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
    this.extras.clear();
    this.queue = [];
    this.figures.clear();
    this.crowdKey = '';
    this.shown = this.shown.map(() => null);
  }

  /** Windows lit at this site: a night mood, or where the journey's light has gone by. */
  private litAt(z: number): boolean {
    return this.night || (this.mood === Mood.None && journeyDusk(this.course.biome, z) >= DUSK_LIT);
  }

  private ctxFor(site: Site): SiteCtx {
    return pieceCtx(this.course, site, this.palette, this.litAt(site.z), this.tier === 'low');
  }

  /** Whether this tier draws a site (Low: the spans and the long sites' shells and buildings). */
  private drawn(site: Site): boolean {
    return site.flown && (this.tier !== 'low' || site.span || site.len > 0);
  }

  /** Queues a site's piece for idle time. */
  private enqueue(site: Site): void {
    if (this.built.has(site.n) || this.queue.some((b) => b.site.n === site.n)) return;
    this.queue.push({ site, piece: pieceFor(site.kind, this.ctxFor(site)), made: [], step: 0 });
    // Nearest first.
    this.queue.sort((a, b) => a.site.z - a.site.len - (b.site.z - b.site.len));
    this.pump();
  }

  /** Makes a site's piece there and then (only one about to come into view unmade). */
  private makeNow(site: Site): BufferGeometry {
    let b = this.queue.find((q) => q.site.n === site.n);
    if (!b) b = { site, piece: pieceFor(site.kind, this.ctxFor(site)), made: [], step: 0 };
    while (b.step < b.piece.steps.length) b.made.push(...b.piece.steps[b.step++]());
    this.queue = this.queue.filter((q) => q !== b);
    // (A slot may already hold this site, shown empty: the idle path redraws them for the same reason.)
    this.shown = this.shown.map(() => null);
    return this.finish(b);
  }

  private finish(b: Build): BufferGeometry {
    const g = mergePiece(b.made);
    b.made = [];
    this.built.set(b.site.n, g);
    this.pieceIce.set(b.site.n, b.piece.ice);
    this.extras.set(b.site.n, { glows: b.piece.glows, steam: b.piece.steam, spots: b.piece.spots });
    // Keep the pieces round the rider; drop the oldest.
    if (this.built.size > KEEP_BUILT) {
      const list = this.plan.planned;
      for (const [n, old] of this.built) {
        if (this.built.size <= KEEP_BUILT) break;
        if (this.shown.some((s) => s && s.n === n) || list[n].z + list[n].len > this.riderZ - BEHIND) continue;
        old.dispose();
        this.built.delete(n);
        this.pieceIce.delete(n);
        this.extras.delete(n);
        this.figures.delete(n);
      }
    }
    return g;
  }

  /** Idle jobs (as many as each idle period has room for): plan the next site ahead, or make one
   *  step of the nearest queued piece. */
  private pump(): void {
    if (!this.idleOpen || this.idleBusy || (this.queue.length === 0 && this.plan.flownTo >= this.wantReach)) return;
    this.idleBusy = true;
    whenIdle((deadline) => {
      this.idleBusy = false;
      // As many jobs as the idle period has room for (one where there is no deadline).
      for (let k = 0; k < 6; k++) {
        const t0 = performance.now();
        const b = this.queue[0];
        // A piece already in view is made before the plan reaches further ahead.
        if (this.plan.flownTo < this.wantReach && !(b && b.site.z - b.site.len < this.viewEnd)) this.plan.flyNext();
        else if (b) {
          if (b.step < b.piece.steps.length) b.made.push(...b.piece.steps[b.step++]());
          else {
            this.queue.shift();
            this.finish(b);
            this.shown = this.shown.map(() => null);
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
      // (The start stands where the rider does: idle time gets its chance to make it first.)
      setTimeout(() => {
        this.madeOpen = true;
      }, IDLE_START_MS + IDLE_GRACE_MS);
    }
    const dt = Math.max(0, Math.min(0.1, time - this.lastT));
    this.lastT = time;
    this.uniforms.uRider.value.copy(rider);
    for (const b of beats) this.cheer(b, rider, time);
    this.riderZ = z;
    const plan = this.plan;
    // A site's air is flown on idle time (a few ms each), a site or two past the view, and only one about
    // to be made here and now: never a whole view's worth on the frames a run starts on.
    this.wantReach = z + ahead + 1400;
    this.viewEnd = z + ahead + 60;
    plan.flyTo(z + 3 * CHUNK_LEN + 60);
    this.pump();
    this.uniforms.uLamps.value = this.litAt(z) ? 1 : 0;
    // The sites in view, nearest first.
    const near = this.nearBuf;
    near.length = 0;
    for (const s of plan.planned) {
      if (s.z + s.len < z - BEHIND || s.z - s.len > z + ahead + 60 || !this.drawn(s)) continue;
      // Queue it for idle time as soon as it is flown; a site within 3 chunks unmade is made now.
      if (!this.built.has(s.n)) {
        if (s.z - s.len - z < 3 * CHUNK_LEN + 60 && this.madeOpen) {
          this.makeNow(s);
          this.stats.madeNow++;
        } else this.enqueue(s);
      }
      near.push(s);
    }
    // Too many for the slots: what is behind the rider goes first, then the furthest ahead, but the
    // finish town stays from as far off as it can be seen: it is where the run is going.
    while (near.length > SLOTS && near[0].z + near[0].len < z - BEHIND_SHORT) near.shift();
    const last = near[near.length - 1];
    while (near.length > SLOTS) near.splice(SLOTS - 1, 1);
    if (last && near.length === SLOTS && near[SLOTS - 1] !== last && last.kind === 'finish') near[SLOTS - 1] = last;
    const want: Array<Site | null> = new Array<Site | null>(SLOTS).fill(null);
    let village = null as Site | null;
    for (let k = 0; k < near.length; k++) {
      const s = near[k];
      want[k] = s;
      if (STREETS.has(s.kind) && (!village || s.kind !== 'start')) village = s;
    }
    // The next site past the view is queued ahead.
    for (const s of plan.planned) if (s.z - s.len > this.viewEnd && s.z - s.len < z + ahead + QUEUE_AHEAD && this.drawn(s)) this.enqueue(s);
    if (want.some((s, k) => s !== this.shown[k])) this.show(want, z);
    // A street's crowd is drawn round the rider: refilled every 12 m down it.
    else if (village && Math.abs(z - this.windowZ) > 12) this.fillCrowd(want, z);
    // In a street the crowd does the wave alongside the rider.
    const inVillage = village && z > village.z - village.len - 30 && z < village.z + village.len ? 1 : 0;
    this.uniforms.uWave.value += (inVillage - this.uniforms.uWave.value) * Math.min(1, dt * 2);
    this.chairs.update(time);
    this.enclosure(z, dt);
  }

  /** The light of an enclosed run on the frame: darker edges inside, a strobe past a gallery's
   *  pillars or a torii's gates where the light comes in, and a flash of daylight on the way out. */
  private enclosure(z: number, dt: number): void {
    let into = 0;
    let strobe = 0;
    let site: Site | null = null;
    for (const s of this.plan.planned) {
      // (A site whose roof could not clear this mood's air has only its walls.)
      if (!ENCLOSED.has(s.kind) || s.clear <= 0 || z < s.z - s.len - 10 || z > s.z + s.len + 10) continue;
      const a = s.z - s.len;
      const k = smooth01((z - a) / 10) * (1 - smooth01((z - (s.z + s.len - 6)) / 6));
      if (k > into) {
        into = k;
        site = s;
      }
      if (!this.night && (s.kind === 'gallery' || s.kind === 'toriirow')) {
        const bay = s.kind === 'gallery' ? 6 : 4.2;
        const c = Math.cos((2 * Math.PI * (z - a)) / bay);
        strobe = Math.max(strobe, k * 0.07 * c * c * c * c);
      }
    }
    if (into > 0.5) this.inside = site;
    else if (this.inside) {
      // Out the far end (not a crash and a new run): the burst of daylight.
      const end = this.inside.z + this.inside.len;
      if (z > end - 12 && z < end + 15) this.exitFlash = this.night ? 0.25 : 0.6;
      this.inside = null;
    }
    this.exitFlash = Math.max(0, this.exitFlash - dt * 1.3);
    this.light.shade += (into - this.light.shade) * Math.min(1, dt * 5);
    this.light.flash = this.exitFlash + strobe;
  }

  private show(want: Array<Site | null>, z: number): void {
    this.shown = want;
    let np = 0;
    let ns = 0;
    const w = this.v;
    this.chairs.clear();
    for (let i = 0; i < SLOTS; i++) {
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
      // Spans and enclosures cast (the dark of a gallery is its shadow); a town's houses on High.
      // (Only the nearest two: the third is too far for the shadow map to reach.)
      mesh.castShadow = this.shadows && i < 2 && ((s.span && s.kind !== 'lift') || ENCLOSED.has(s.kind) || ((s.kind === 'village' || s.kind === 'finish' || s.kind === 'viaduct') && this.tier === 'high'));
      mesh.visible = true;
      if (s.kind === 'lift' && this.tier !== 'low') this.chairs.add(this.course, s);
      const ex = this.extras.get(s.n);
      if (!ex) continue;
      // Lamplight pools, laid on the snow vertex by vertex.
      if (ex.glows && this.litAt(s.z) && this.tier !== 'low') {
        const gy = siteGround(this.course, s);
        const arr = this.poolPos.array as Float32Array;
        for (const gl of ex.glows) {
          if (np >= POOL_CAP) break;
          let o = np * POOL_V * 3;
          const put = (lx: number, lz: number) => {
            siteToWorld(s, lx, gy(lx, lz) + 0.12, lz, w);
            arr[o++] = w.x;
            arr[o++] = w.y;
            arr[o++] = w.z;
          };
          put(gl.x, gl.z);
          for (const r of [0.5, 1]) for (let j = 0; j < POOL_SEG; j++) put(gl.x + Math.cos((j / POOL_SEG) * 6.2832) * gl.r * r, gl.z + Math.sin((j / POOL_SEG) * 6.2832) * gl.r * r);
          np++;
        }
      }
      // Steam puffs, a few per source, each on its own phase.
      if (ex.steam && this.tier !== 'low') {
        const base = this.steamBase.array as Float32Array;
        const sd = this.steamSeed.array as Float32Array;
        for (let si = 0; si < ex.steam.length; si++) {
          const p = ex.steam[si];
          siteToWorld(s, p[0], p[1], p[2], w);
          for (let j = 0; j < STEAM_PER && ns < STEAM_CAP; j++, ns++) {
            for (let c = 0; c < 4; c++) {
              const o = ns * 4 + c;
              base[o * 3] = w.x;
              base[o * 3 + 1] = w.y;
              base[o * 3 + 2] = w.z;
              sd[o * 2] = j / STEAM_PER + hashf(si, j, 31) * 0.2;
              sd[o * 2 + 1] = hashf(si, j, 32);
            }
          }
        }
      }
    }
    (this.pools.material as ShaderMaterial).uniforms.uK.value = this.night ? POOL_NIGHT : POOL_DUSK;
    this.poolPos.needsUpdate = true;
    this.pools.geometry.setDrawRange(0, np * POOL_SEG * 9);
    this.pools.visible = np > 0;
    this.steamBase.needsUpdate = true;
    this.steamSeed.needsUpdate = true;
    this.steam.geometry.setDrawRange(0, ns * 6);
    this.steam.visible = ns > 0;
    this.fillCrowd(want, z);
  }

  /** The crowd batch: every figure at the shown sites (Medium and High), a village's round the rider. */
  private fillCrowd(want: Array<Site | null>, rz: number): void {
    const village = want.some((s) => s && STREETS.has(s.kind));
    const key = want.map((s) => (s && this.built.has(s.n) ? s.n : -1)).join(',') + this.tier + (village ? ':' + Math.round(rz / 12) : '');
    if (key === this.crowdKey) return;
    this.crowdKey = key;
    this.windowZ = rz;
    const cap = this.tier === 'high' ? CROWD_CAP : CROWD_MED;
    let n = 0;
    if (this.tier !== 'low') {
      for (const s of want) {
        if (!s || !this.built.has(s.n)) continue;
        const list = this.figuresFor(s);
        // (A village's list is sorted down the run: the window is the run of it round the rider.)
        let i0 = 0;
        const street = STREETS.has(s.kind);
        if (street) while (i0 < list.length && -list[i0].z < rz - WINDOW_BACK) i0++;
        for (let i = i0; i < list.length; i++) {
          const f = list[i];
          if (n >= cap) break;
          if (street && -f.z > rz + WINDOW_AHEAD) break;
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

  /** A site's spectators: along the bank crests round it (both banks at a span) and on the piece; a
   *  village's are its street crowd (the piece's spots), sorted down the run. */
  private figuresFor(site: Site): Figure[] {
    let list = this.figures.get(site.n);
    if (list) return list;
    list = [];
    if (CROWDED.has(site.kind)) {
      const c = this.course;
      const { coats, hats } = crowdColors(c.biome, this.palette);
      const seed = (c.seed ^ (site.n * 2654435761)) >>> 0;
      let k = 0;
      const add = (x: number, y: number, z: number, yaw: number, flag = false) => {
        const h = (salt: number) => hashf(seed, k, salt);
        list!.push({
          x,
          y,
          z,
          yaw,
          scale: (h(1) < 0.12 ? 0.74 : 0.92 + h(2) * 0.16) * (FIGURE_H / 1.62),
          coat: coats[Math.floor(h(3) * coats.length)],
          hat: hats[Math.floor(h(4) * hats.length)],
          seed: new Vector4(h(5), h(6), h(7) < 0.3 ? 1 : 0, flag ? 1 : 0),
        });
        k++;
      };
      const sides = OWN_CROWD.has(site.kind) ? [] : site.span ? [-1, 1] : [site.side, -site.side];
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
      // Those standing on the piece itself (a bridge's deck, a hut's terrace, a village's street).
      const spots = this.extras.get(site.n)?.spots ?? pieceFor(site.kind, this.ctxFor(site)).spots;
      for (const sp of spots) {
        const w = siteToWorld(site, sp.x, sp.y, sp.z, this.v);
        add(w.x, w.y, w.z, sp.yaw + site.yaw, sp.flag);
      }
      if (STREETS.has(site.kind)) list.sort((a, b) => b.z - a.z);
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

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
