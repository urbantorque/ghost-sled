import { TAU, clamp, dcos, dsin, lerp, smoothstep } from './dmath';
import { BiomeId, MountainParams, paramsForSeed } from './mountains';
import { fbm1, noise1, noise2 } from './noise';
import { Rng, hash32 } from './prng';

// The course is a pure function of its seed. +z is downhill, +x is the rider's right when facing
// downhill, +y is up. Chunks are generated lazily and cached, but every chunk depends only on
// (seed, index), so generation order never matters.

export const CHUNK_LEN = 64;
/** Half-width of the guaranteed obstacle-free lane around the safe line, metres. */
export const SAFE_LANE = 2.45;
/** Distance up the bank (past the corridor edge) where the treeline crashes you. */
export const FOREST_LIMIT = 10;
export const START_CLEAR_Z = 150;
/** Extra room (m) obstacles leave beside the safe lane at difficulty 0, shrinking to none at 1. */
const EARLY_MARGIN = 1.5;

export type ObstacleKind =
  | 'pine'
  | 'rock'
  | 'log'
  | 'snowman'
  | 'spire'
  | 'serac'
  | 'iceblock'
  | 'basalt'
  | 'lavarock'
  | 'charpine'
  | 'blossom'
  | 'lantern'
  | 'pillar';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Second endpoint for capsule colliders (logs). Equal to x, z for circles. */
  x2: number;
  z2: number;
  r: number;
  /** Collider height above its base. A sled whose bottom is higher clears it. */
  h: number;
  /** Ground height at the obstacle centre. */
  y: number;
  soft: boolean;
  scale: number;
  rot: number;
}

export interface Ramp {
  x: number;
  z: number;
  len: number;
  w: number;
  h: number;
}

export interface Drop {
  z: number;
  depth: number;
  len: number;
  rec: number;
}

export interface Moguls {
  z0: number;
  z1: number;
  amp: number;
  phase: number;
  wave: number;
}

export interface IcePatch {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

export interface Vent {
  id: number;
  x: number;
  z: number;
  r: number;
  power: number;
}

export interface Gate {
  id: number;
  x1: number;
  x2: number;
  z: number;
}

export interface Gift {
  id: number;
  x: number;
  z: number;
  /** Height above the ground at x, z. */
  hover: number;
  value: number;
}

interface Box {
  z0: number;
  z1: number;
  x0: number;
  x1: number;
}

export interface Zones {
  ramps: Ramp[];
  drops: Drop[];
  moguls: Moguls[];
  ice: IcePatch[];
  vents: Vent[];
  keepOut: Box[];
}

export interface Chunk {
  index: number;
  z0: number;
  z1: number;
  zones: Zones;
  obstacles: Obstacle[];
  gates: Gate[];
  gifts: Gift[];
}

export interface Surface {
  grip: number;
  drag: number;
  ice: boolean;
}

const TALL: Record<BiomeId, ObstacleKind[]> = {
  alpine: ['pine', 'pine', 'pine'],
  glacier: ['spire', 'spire', 'serac'],
  volcanic: ['basalt', 'charpine', 'basalt'],
  blossom: ['blossom', 'blossom', 'pine'],
};

const LOW: Record<BiomeId, ObstacleKind[]> = {
  alpine: ['rock', 'rock', 'log'],
  glacier: ['iceblock', 'iceblock', 'rock'],
  volcanic: ['lavarock', 'lavarock', 'log'],
  blossom: ['lantern', 'rock', 'log'],
};

/** Corridor bank profile: a rounded rise past the edge that eases into a gentle forest floor. */
function bank(e: number): number {
  if (e < 5) return 0.16 * e * e;
  if (e < 12) {
    const t = e - 5;
    return 4 + 1.6 * t - 0.1 * t * t;
  }
  return 10.3 + 0.2 * (e - 12);
}

/**
 * Sections give a course its shape. Each is 200 to 500 m of one kind, drawn per seed from the biome's
 * deck, and blends into the next over SECTION_BLEND metres:
 *   cruise       the plain corridor
 *   chute        steeper, narrower and straighter: speed, fewer kickers
 *   bowl         a wide, gentler basin, open, with kickers and moguls
 *   switchbacks  tight S-bends at a shorter wavelength
 *   benches      flatter terraces over rollers (they lift a boosted sled off the crests)
 *   gully        narrow between high banks, few obstacles
 *   split        wide, with a line of trees down the middle: the safe line takes one side
 */
export type SectionKind = 'cruise' | 'chute' | 'bowl' | 'switchbacks' | 'benches' | 'gully' | 'split';
export const SECTION_KINDS: readonly SectionKind[] = ['cruise', 'chute', 'bowl', 'switchbacks', 'benches', 'gully', 'split'];
export const SECTION_BLEND = 140;

/** What a section does to the course; every field is a multiplier (1 = the plain corridor) except
 *  `width` (metres added to the half-width), `split` (share of the half-width the safe line moves to
 *  one side) and `roller` (roller height, metres). */
export interface SectionShape {
  slope: number;
  width: number;
  wander: number;
  wave: number;
  span: number;
  split: number;
  roller: number;
  obstacles: number;
  kickers: number;
  moguls: number;
  drops: number;
}

const SHAPES: Record<SectionKind, SectionShape> = {
  cruise: { slope: 1, width: 0, wander: 1, wave: 1, span: 1, split: 0, roller: 0, obstacles: 1, kickers: 1, moguls: 1, drops: 1 },
  chute: { slope: 1.3, width: -3, wander: 0.4, wave: 1.4, span: 0.6, split: 0, roller: 0, obstacles: 0.75, kickers: 0.5, moguls: 0.5, drops: 1.6 },
  bowl: { slope: 0.88, width: 7, wander: 0.45, wave: 1.2, span: 0.8, split: 0, roller: 0, obstacles: 0.55, kickers: 1.8, moguls: 1.6, drops: 0.5 },
  switchbacks: { slope: 1, width: -1, wander: 0.62, wave: 0.55, span: 0.45, split: 0, roller: 0, obstacles: 0.85, kickers: 0.8, moguls: 0.8, drops: 0.5 },
  benches: { slope: 0.9, width: 2, wander: 0.8, wave: 1, span: 0.9, split: 0, roller: 1.6, obstacles: 0.8, kickers: 1.2, moguls: 0.3, drops: 0 },
  gully: { slope: 1.1, width: -4.5, wander: 0.85, wave: 0.9, span: 0.5, split: 0, roller: 0, obstacles: 0.6, kickers: 0.6, moguls: 1, drops: 0.6 },
  split: { slope: 1, width: 6, wander: 0.55, wave: 1.2, span: 0.35, split: 0.42, roller: 0, obstacles: 0.6, kickers: 0.7, moguls: 0.5, drops: 0 },
};

/** Section length range (m) per kind. */
const SECTION_LEN: Record<SectionKind, readonly [number, number]> = {
  cruise: [300, 480],
  chute: [200, 320],
  bowl: [220, 360],
  switchbacks: [300, 440],
  benches: [240, 380],
  gully: [200, 300],
  split: [220, 320],
};

/** Each biome's deck, in SECTION_KINDS order: its signature kinds come up most. */
const SECTION_DECK: Record<BiomeId, readonly number[]> = {
  alpine: [3, 1, 2, 3, 2, 1, 2.5],
  glacier: [2, 3, 3, 1, 1, 1.2, 1],
  volcanic: [2, 2, 1, 1.5, 1, 3, 2],
  blossom: [2, 1, 1.2, 2, 4, 1, 1.2],
};

/** Chutes and gullies are the hard sections: none before this distance, and never two in a row. */
const HARD_FROM = 900;
const HARD: ReadonlySet<SectionKind> = new Set(['chute', 'gully']);
/** The first section is a cruise at least this long, so the start is always the plain corridor. */
const FIRST_SECTION = 450;
const ROLLER_WAVE = 80;

export interface Section {
  kind: SectionKind;
  z0: number;
  z1: number;
  /** The side the safe line takes in a split (+1 right, -1 left). */
  side: 1 | -1;
  /** Slope-weighted descent from z = 0 to z0, in units of the mountain's slope. */
  drop0: number;
  /** The centre line's bend phase at z0 (the integral of 1 / (300 x wave)). */
  phase0: number;
  prev: Section | null;
}

/** A blended shape at one z, written into by Course.shapeAt. */
export interface ShapeAt extends SectionShape {
  /** The split offset with its side (split x side, blended). */
  splitSigned: number;
}

/** Rounded min and max: within k of each other they blend along a parabola (no corner). */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}
function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** The last two z values a z-only function was asked for, and its answers (most recent first). */
interface Memo {
  a: number;
  va: number;
  b: number;
  vb: number;
}

const slopeOf = (s: SectionShape): number => s.slope;
const freqOf = (s: SectionShape): number => 1 / (300 * s.wave);

export class Course {
  readonly seed: number;
  readonly params: MountainParams;
  private readonly sC: number;
  private readonly sW: number;
  private readonly sS: number;
  private readonly sY: number;
  private readonly sR: number;
  private zoneCache = new Map<number, Zones>();
  private featureCache = new Map<number, Zones>();
  private chunkCache = new Map<number, Chunk>();
  private readonly sections: Section[] = [];
  private lastSection = 0;
  private readonly shapeTmp: ShapeAt = { ...SHAPES.cruise, splitSigned: 0 };
  // Two-entry memos for the z-only functions: the terrain asks for a whole row of x at one z (and its
  // slope at z + 0.25), and ground(), edgeExcess() and safeX() each ask again, so most calls repeat.
  private shapeZ = NaN;
  private readonly mcenterX: Memo = { a: NaN, va: 0, b: NaN, vb: 0 };
  private readonly mhalfWidth: Memo = { a: NaN, va: 0, b: NaN, vb: 0 };
  private readonly msafeX: Memo = { a: NaN, va: 0, b: NaN, vb: 0 };
  private readonly mbaseY: Memo = { a: NaN, va: 0, b: NaN, vb: 0 };

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.params = paramsForSeed(this.seed);
    this.sC = hash32(this.seed, 1);
    this.sW = hash32(this.seed, 2);
    this.sS = hash32(this.seed, 3);
    this.sY = hash32(this.seed, 4);
    this.sR = hash32(this.seed, 5);
  }

  get biome(): BiomeId {
    return this.params.biome;
  }

  /** 0 at the top, 1 once the ramp distance is reached. It eases in: the first kilometre stays
   *  close to the start's open corridor, and most of the climb comes in the middle of the ramp. */
  difficulty(z: number): number {
    const t = clamp((z - START_CLEAR_Z) / (this.params.rampDistance - START_CLEAR_Z), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** The section that holds z (z < 0 reads as the first). */
  section(z: number): Section {
    const list = this.sections;
    if (list.length === 0) this.pushSection();
    while (list[list.length - 1].z1 <= z) this.pushSection();
    let i = this.lastSection;
    if (i >= list.length) i = list.length - 1;
    while (i > 0 && list[i].z0 > z) i--;
    while (list[i].z1 <= z) i++;
    this.lastSection = i;
    return list[i];
  }

  /** Sections are drawn in order, each from its own hash, so the list is a pure function of the
   *  seed whatever order it is read in. */
  private pushSection(): void {
    const list = this.sections;
    const i = list.length;
    const prev = i > 0 ? list[i - 1] : null;
    const rng = new Rng(hash32(this.seed, i, 0x5ec7));
    let kind: SectionKind = 'cruise';
    let len = rng.range(FIRST_SECTION, FIRST_SECTION + 120);
    if (prev) {
      const deck = SECTION_DECK[this.params.biome];
      const weights = SECTION_KINDS.map((k, n) => {
        if (k === prev.kind) return 0;
        if (HARD.has(k) && (prev.z1 < HARD_FROM || HARD.has(prev.kind))) return 0;
        return deck[n];
      });
      kind = SECTION_KINDS[rng.weighted(weights)];
      const [lo, hi] = SECTION_LEN[kind];
      len = rng.range(lo, hi);
    }
    const z0 = prev ? prev.z1 : 0;
    const drop0 = prev ? prev.drop0 + this.sectionInt(prev, prev.z1 - prev.z0, slopeOf) : 0;
    const phase0 = prev ? prev.phase0 + this.sectionInt(prev, prev.z1 - prev.z0, freqOf) : 0;
    list.push({ kind, z0, z1: z0 + len, side: rng.chance(0.5) ? 1 : -1, drop0, phase0, prev });
  }

  /** The integral of a section field over the first `d` metres of a section, the field easing in
   *  from the previous section's value over SECTION_BLEND (the integral of the smoothstep blend). */
  private sectionInt(sec: Section, d: number, field: (s: SectionShape) => number): number {
    const b = field(SHAPES[sec.kind]);
    const a = sec.prev ? field(SHAPES[sec.prev.kind]) : b;
    const B = SECTION_BLEND;
    if (d < B) {
      const u = d / B;
      return a * d + (b - a) * B * (u * u * u - (u * u * u * u) / 2);
    }
    return a * B + 0.5 * (b - a) * B + b * (d - B);
  }

  /** The blended section shape at z (the returned object is reused: copy what you keep). */
  shapeAt(z: number): ShapeAt {
    if (z === this.shapeZ) return this.shapeTmp;
    this.shapeZ = z;
    const sec = this.section(z);
    const cur = SHAPES[sec.kind];
    const out = this.shapeTmp;
    const prevSec = sec.prev;
    const w = prevSec ? smoothstep(sec.z0, sec.z0 + SECTION_BLEND, z) : 1;
    const pre = prevSec ? SHAPES[prevSec.kind] : cur;
    out.slope = lerp(pre.slope, cur.slope, w);
    out.width = lerp(pre.width, cur.width, w);
    out.wander = lerp(pre.wander, cur.wander, w);
    out.wave = lerp(pre.wave, cur.wave, w);
    out.span = lerp(pre.span, cur.span, w);
    out.split = lerp(pre.split, cur.split, w);
    out.roller = lerp(pre.roller, cur.roller, w);
    out.obstacles = lerp(pre.obstacles, cur.obstacles, w);
    out.kickers = lerp(pre.kickers, cur.kickers, w);
    out.moguls = lerp(pre.moguls, cur.moguls, w);
    out.drops = lerp(pre.drops, cur.drops, w);
    out.splitSigned = lerp(prevSec ? pre.split * prevSec.side : 0, cur.split * sec.side, w);
    return out;
  }

  centerX(z: number): number {
    const m = this.mcenterX;
    if (z === m.a) return m.va;
    if (z === m.b) return m.vb;
    const v = this.centerXAt(z);
    m.b = m.a;
    m.vb = m.va;
    m.a = z;
    m.va = v;
    return v;
  }

  private centerXAt(z: number): number {
    const amp = this.params.wander * (0.35 + 0.65 * this.difficulty(z)) * smoothstep(0, 220, z);
    // Each section bends at its own wavelength. The bend's phase is the integral of its frequency,
    // so a change of wavelength speeds the bends up or slows them down without a kink.
    const sec = this.section(z);
    const phase = z <= 0 ? z / 300 : sec.phase0 + this.sectionInt(sec, z - sec.z0, freqOf);
    return amp * this.shapeAt(z).wander * fbm1(this.sC, phase);
  }

  halfWidth(z: number): number {
    const m = this.mhalfWidth;
    if (z === m.a) return m.va;
    if (z === m.b) return m.vb;
    const v = this.halfWidthAt(z);
    m.b = m.a;
    m.vb = m.va;
    m.a = z;
    m.va = v;
    return v;
  }

  private halfWidthAt(z: number): number {
    const p = this.params;
    const base = lerp(p.halfWidthStart, p.halfWidthEnd, this.difficulty(z)) + 2.5 * noise1(this.sW, z / 180);
    // The terrain mesh is fine out to halfWidthStart + 12.6 m: a wide section stays inside it. The
    // caps are rounded, so the width (and the safe line, which follows it) never turns a corner.
    const w = smax(base + this.shapeAt(z).width, Math.min(base, 8.5), 3);
    return smin(w, p.halfWidthStart + 3, 4);
  }

  /** The guaranteed passable line: no collider comes within SAFE_LANE of it. */
  safeX(z: number): number {
    const m = this.msafeX;
    if (z === m.a) return m.va;
    if (z === m.b) return m.vb;
    const v = this.safeXAt(z);
    m.b = m.a;
    m.vb = m.va;
    m.a = z;
    m.va = v;
    return v;
  }

  private safeXAt(z: number): number {
    const hw = this.halfWidth(z);
    const sh = this.shapeAt(z);
    const span = Math.max(0, hw - 4.2) * 0.8 * sh.span * smoothstep(0, 120, z);
    return this.centerX(z) + sh.splitSigned * hw + span * fbm1(this.sS, z / 150);
  }

  baseY(z: number): number {
    const m = this.mbaseY;
    if (z === m.a) return m.va;
    if (z === m.b) return m.vb;
    const v = this.baseYAt(z);
    m.b = m.a;
    m.vb = m.va;
    m.a = z;
    m.va = v;
    return v;
  }

  private baseYAt(z: number): number {
    const sec = this.section(z);
    const drop = z <= 0 ? z : sec.drop0 + this.sectionInt(sec, z - sec.z0, slopeOf);
    const roller = this.shapeAt(z).roller;
    const roll = roller > 0 ? roller * dsin((TAU * z) / ROLLER_WAVE) : 0;
    return -this.params.slope * drop + 10 * noise1(this.sY, z / 260) * smoothstep(0, 300, z) + roll;
  }

  /** Distance past the corridor edge (negative inside the corridor). */
  edgeExcess(x: number, z: number): number {
    return Math.abs(x - this.centerX(z)) - this.halfWidth(z);
  }

  ground(x: number, z: number): number {
    let h = this.baseY(z) + 1.1 * noise2(this.sR, x / 36, z / 44);
    const e = this.edgeExcess(x, z);
    if (e > 0) h += bank(e);
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 2; k <= ci; k++) {
      if (k < 0) continue;
      const zn = this.zones(k);
      for (const d of zn.drops) {
        if (z < d.z) continue;
        const a = z - d.z;
        if (a < d.len) h -= d.depth * smoothstep(0, d.len, a);
        else if (a < d.len + d.rec) h -= d.depth * (1 - smoothstep(d.len, d.len + d.rec, a));
      }
      for (const r of zn.ramps) {
        const u = (z - r.z) / r.len;
        if (u < 0 || u > 1 + 1.4 / r.len) continue;
        const dx = Math.abs(x - r.x);
        const side = 1 - smoothstep(r.w * 0.5, r.w * 0.5 + 1.4, dx);
        if (side <= 0) continue;
        let f: number;
        if (u <= 1) f = u * u;
        else {
          const b = 1 - ((u - 1) * r.len) / 1.4;
          f = b * b;
        }
        h += r.h * f * side;
      }
      for (const m of zn.moguls) {
        if (z < m.z0 || z > m.z1) continue;
        const env = smoothstep(m.z0, m.z0 + 8, z) * (1 - smoothstep(m.z1 - 8, m.z1, z));
        const s1 = dsin(x / m.wave + m.phase);
        const s2 = dsin(z / m.wave + m.phase * 1.7);
        h += m.amp * env * s1 * s1 * s2 * s2;
      }
    }
    return h;
  }

  /** Writes the ground gradient (dh/dx, dh/dz) into out. */
  gradient(x: number, z: number, out: { x: number; z: number }): void {
    const e = 0.2;
    out.x = (this.ground(x + e, z) - this.ground(x - e, z)) / (2 * e);
    out.z = (this.ground(x, z + e) - this.ground(x, z - e)) / (2 * e);
  }

  surface(x: number, z: number): Surface {
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci; k++) {
      if (k < 0) continue;
      for (const p of this.zones(k).ice) {
        const dx = (x - p.x) / p.rx;
        const dz = (z - p.z) / p.rz;
        if (dx * dx + dz * dz < 1) return { grip: 0.45, drag: 0.82, ice: true };
      }
    }
    return { grip: 1, drag: 1, ice: false };
  }

  zones(i: number): Zones {
    let zn = this.zoneCache.get(i);
    if (!zn) {
      zn = this.buildZones(i);
      this.zoneCache.set(i, zn);
    }
    return zn;
  }

  chunk(i: number): Chunk {
    let c = this.chunkCache.get(i);
    if (!c) {
      c = this.buildChunk(i);
      this.chunkCache.set(i, c);
    }
    return c;
  }

  /** Pure per-index decision used to keep drops apart without recursion. */
  private wantsDrop(i: number): boolean {
    if (i < 5) return false;
    const mid = i * CHUNK_LEN + CHUNK_LEN / 2;
    return hash32(this.seed, i, 0xd409) / 4294967296 < this.params.dropChance * this.shapeAt(mid).drops * (0.6 + 0.6 * this.difficulty(i * CHUNK_LEN));
  }

  /** Terrain features (drops, kickers, moguls, ice) and their keep-out boxes. Pure per index. */
  private features(i: number): Zones {
    let f = this.featureCache.get(i);
    if (!f) {
      f = this.buildFeatures(i);
      this.featureCache.set(i, f);
    }
    return f;
  }

  private buildFeatures(i: number): Zones {
    const p = this.params;
    const rng = new Rng(hash32(this.seed, i, 0x20e5));
    const z0 = i * CHUNK_LEN;
    const diff = this.difficulty(z0);
    const sh = this.shapeAt(z0 + CHUNK_LEN / 2);
    const kickMul = sh.kickers;
    const mogulMul = sh.moguls;
    const zn: Zones = { ramps: [], drops: [], moguls: [], ice: [], vents: [], keepOut: [] };
    if (z0 < START_CLEAR_Z - CHUNK_LEN) return zn;

    const drop = this.wantsDrop(i) && !this.wantsDrop(i - 1) && !this.wantsDrop(i - 2);
    if (drop) {
      const dz = z0 + rng.range(16, 40);
      const d: Drop = { z: dz, depth: lerp(3.5, 7.5, diff) * rng.range(0.85, 1.15), len: rng.range(7, 10), rec: rng.range(90, 120) };
      zn.drops.push(d);
      zn.keepOut.push({ z0: dz - 22, z1: dz + d.len + 52, x0: -1e9, x1: 1e9 });
    }

    if (!drop && rng.chance(p.kickerChance * kickMul * (0.75 + 0.5 * diff))) {
      const count = diff > 0.55 && rng.chance(0.35) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const rz = z0 + rng.range(8, 36) + k * 22;
        const big = rng.chance(0.2 + 0.35 * diff);
        const rel = big ? rng.range(0.36, 0.44) : rng.range(0.22, 0.32);
        const len = big ? rng.range(8.5, 10) : rng.range(8, 11);
        const h = (rel * len) / 2;
        const w = rng.range(4.2, 6.5);
        const hw = this.halfWidth(rz);
        const sx = this.safeX(rz);
        const cx = this.centerX(rz);
        // Off the safe line: centre at least SAFE_LANE + half width + 1 away, inside the corridor.
        const minOff = SAFE_LANE + w * 0.5 + 1.2;
        let side = rng.chance(0.5) ? 1 : -1;
        let room = side > 0 ? cx + hw - 1 - (sx + minOff) : sx - minOff - (cx - hw + 1);
        if (room < 0) {
          side = -side;
          room = side > 0 ? cx + hw - 1 - (sx + minOff) : sx - minOff - (cx - hw + 1);
        }
        if (room < 0) continue;
        const rx = sx + side * (minOff + rng.next() * room);
        // The safe line moves along the ramp; keep the whole footprint clear of the lane.
        let clear = true;
        for (let zz = rz - 1.5; zz <= rz + len + 2; zz += 1) {
          if (Math.abs(rx - this.safeX(zz)) < w * 0.5 + 1.4 + SAFE_LANE * 0.5 + 0.4) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        zn.ramps.push({ x: rx, z: rz, len, w, h });
        zn.keepOut.push({ z0: rz - 14, z1: rz + len + 2, x0: rx - w * 0.5 - 1.6, x1: rx + w * 0.5 + 1.6 });
        zn.keepOut.push({ z0: rz + len, z1: rz + len + (big ? 62 : 46), x0: rx - 6.5, x1: rx + 6.5 });
      }
    }

    // No moguls in the first 300 m: a new rider stomping into them is thrown straight back up.
    if (!drop && rng.chance(p.mogulChance * mogulMul * (0.6 + 0.8 * diff)) && z0 >= 300) {
      const mz = z0 + rng.range(0, 24);
      zn.moguls.push({ z0: mz, z1: mz + rng.range(28, 48), amp: lerp(0.32, 0.55, diff), phase: rng.range(0, 6.28), wave: rng.range(2.6, 3.4) });
    }

    if (rng.chance(p.iceChance)) {
      const iz = z0 + rng.range(10, 50);
      const off = rng.signed() * this.halfWidth(iz) * 0.5;
      zn.ice.push({ x: this.centerX(iz) + off, z: iz, rx: rng.range(5, 10), rz: rng.range(14, 30) });
    }

    return zn;
  }

  /** Zones = terrain features plus vents. Vents are placed in a second pass that checks the
   *  feature keep-out boxes of neighbouring chunks, so nobody lands on a geyser by surprise. */
  private buildZones(i: number): Zones {
    const f = this.features(i);
    const zn: Zones = { ...f, vents: [], keepOut: f.keepOut.slice() };
    const p = this.params;
    const z0 = i * CHUNK_LEN;
    if (z0 < START_CLEAR_Z - CHUNK_LEN || p.ventChance <= 0) return zn;
    const rng = new Rng(hash32(this.seed, i, 0x7e47));
    const diff = this.difficulty(z0);
    const blocked = (x: number, z: number): boolean => {
      for (let k = i - 2; k <= i + 1; k++) {
        if (k < 0) continue;
        for (const b of this.features(k).keepOut) if (z + 4 > b.z0 && z - 4 < b.z1 && x + 6 > b.x0 && x - 6 < b.x1) return true;
      }
      for (const b of zn.keepOut) if (z + 4 > b.z0 && z - 4 < b.z1 && x + 6 > b.x0 && x - 6 < b.x1) return true;
      return false;
    };
    if (rng.chance(p.ventChance)) {
      const n = rng.int(1, 2 + Math.floor(diff * 2));
      for (let k = 0; k < n; k++) {
        const vz = z0 + rng.range(6, 56);
        const hw = this.halfWidth(vz);
        const sx = this.safeX(vz);
        const off = (rng.chance(0.5) ? 1 : -1) * rng.range(SAFE_LANE + 1.6, Math.max(SAFE_LANE + 1.7, hw - 2));
        const vx = clamp(sx + off, this.centerX(vz) - hw + 2, this.centerX(vz) + hw - 2);
        if (Math.abs(vx - sx) < SAFE_LANE + 1.6 || blocked(vx, vz)) continue;
        zn.vents.push({ id: i * 16 + k, x: vx, z: vz, r: 1.5, power: rng.range(8.5, 10.5) });
        zn.keepOut.push({ z0: vz - 6, z1: vz + 44, x0: vx - 6, x1: vx + 6 });
      }
    }
    return zn;
  }

  private inKeepOut(x: number, z: number, r: number, i: number): boolean {
    // Big kicker landing zones reach two chunks forward, so look two chunks back.
    for (let k = i - 2; k <= i + 1; k++) {
      if (k < 0) continue;
      for (const b of this.zones(k).keepOut) {
        if (z + r > b.z0 && z - r < b.z1 && x + r > b.x0 && x - r < b.x1) return true;
      }
    }
    return false;
  }

  private buildChunk(i: number): Chunk {
    const p = this.params;
    const zones = this.zones(i);
    const z0 = i * CHUNK_LEN;
    const z1 = z0 + CHUNK_LEN;
    const chunk: Chunk = { index: i, z0, z1, zones, obstacles: [], gates: [], gifts: [] };
    const rng = new Rng(hash32(this.seed, i, 0x0b57));
    const diff = this.difficulty(z0);
    const beyond = clamp((z0 - p.rampDistance) / 4000, 0, 0.5);
    const obs = chunk.obstacles;
    let nextId = i * 256;

    const clearOf = (x: number, z: number, r: number): boolean => {
      if (z - r < START_CLEAR_Z) return false;
      // Early on the lane is wider than promised: a rider still learning to hold a bend has room.
      if (Math.abs(x - this.safeX(z)) < r + SAFE_LANE + EARLY_MARGIN * (1 - diff)) return false;
      if (this.edgeExcess(x, z) > 1.5 - r) return false;
      if (this.inKeepOut(x, z, r, i)) return false;
      for (const o of obs) {
        const dx = o.x - x;
        const dz = o.z - z;
        const min = o.r + r + 1.0;
        if (dx * dx + dz * dz < min * min) return false;
        if (o.x2 !== o.x || o.z2 !== o.z) {
          const ex = o.x2 - x;
          const ez = o.z2 - z;
          if (ex * ex + ez * ez < min * min) return false;
        }
      }
      return true;
    };

    const add = (kind: ObstacleKind, x: number, z: number, r: number, h: number, soft = false, x2 = x, z2 = z): Obstacle => {
      const o: Obstacle = {
        id: nextId++,
        kind,
        x,
        z,
        x2,
        z2,
        r,
        h,
        y: this.ground((x + x2) / 2, (z + z2) / 2),
        soft,
        scale: rng.range(0.85, 1.2),
        rot: rng.range(0, 6.283),
      };
      obs.push(o);
      return o;
    };

    const tallKinds = TALL[p.biome];
    const lowKinds = LOW[p.biome];
    const template = rng.weighted([1, 1.25, 0.9, 1.4]); // open, forest, rocks, mixed
    const templateMul = [0.45, 1.3, 1.15, 1.0][template];
    const obsMul = this.shapeAt(z0 + CHUNK_LEN / 2).obstacles;
    const target = Math.round((3 + 13 * diff) * p.density * templateMul * obsMul * (1 + beyond));

    const placeOne = (kind: ObstacleKind, x: number, z: number): boolean => {
      switch (kind) {
        case 'pine':
        case 'blossom':
        case 'charpine': {
          const r = rng.range(0.7, 0.95);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, kind === 'blossom' ? 5.5 : 6.5);
          return true;
        }
        case 'spire':
        case 'basalt': {
          const r = rng.range(0.7, 1.1);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, rng.range(3.5, 6.5));
          return true;
        }
        case 'serac': {
          const r = rng.range(1.5, 2.2);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, rng.range(3, 4.5));
          return true;
        }
        case 'rock':
        case 'iceblock':
        case 'lavarock': {
          const r = rng.range(0.75, 1.3);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, rng.range(0.8, 1.25));
          return true;
        }
        case 'lantern': {
          if (!clearOf(x, z, 0.6)) return false;
          add(kind, x, z, 0.6, 1.4);
          return true;
        }
        case 'log': {
          // Logs lie mostly across the slope.
          const hx = rng.range(3, 5.2) * 0.5;
          const ang = rng.range(-0.5, 0.5);
          const ca = dcos(ang);
          const sa = dsin(ang);
          const ax = x - ca * hx;
          const az = z - sa * hx;
          const bx = x + ca * hx;
          const bz = z + sa * hx;
          const rr = 0.42;
          for (let s = 0; s <= 4; s++) {
            const t = s / 4;
            if (!clearOf(ax + (bx - ax) * t, az + (bz - az) * t, rr)) return false;
          }
          add('log', ax, az, rr, 0.75, false, bx, bz);
          return true;
        }
        default:
          return false;
      }
    };

    // Soft snowmen: smash for points, slow you a little. Placed first, so the fill cannot crowd
    // Pinecrest's signature out.
    if (rng.chance(p.snowmanChance)) {
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const z = z0 + rng.next() * CHUNK_LEN;
        const x = this.centerX(z) + rng.signed() * this.halfWidth(z) * 0.8;
        if (clearOf(x, z, 0.65)) add('snowman', x, z, 0.65, 1.7, true);
      }
    }

    if (template === 1) {
      // Forest slalom: staggered rows of tall obstacles leaving the lane open.
      let z = z0 + rng.range(2, 8);
      let flip = rng.chance(0.5) ? 1 : -1;
      while (z < z1 - 2) {
        const sx = this.safeX(z);
        const cx = this.centerX(z);
        const hw = this.halfWidth(z);
        const n = rng.int(1, 2 + Math.floor(diff * 2));
        for (let k = 0; k < n; k++) {
          const off = SAFE_LANE + 1.4 + rng.range(0, 5) + k * rng.range(3.5, 6);
          const x = sx + flip * off;
          if (Math.abs(x - cx) > hw + 0.5) continue;
          placeOne(rng.pick(tallKinds), x, z + rng.range(-1.5, 1.5));
        }
        flip = -flip;
        z += rng.range(9, 15) - diff * 3;
      }
    }

    let tries = target * 6;
    let placed = obs.length;
    while (placed < target && tries-- > 0) {
      const z = z0 + rng.next() * CHUNK_LEN;
      const x = this.centerX(z) + rng.signed() * (this.halfWidth(z) + 0.5);
      let kind: ObstacleKind;
      const roll = rng.next();
      if (template === 2) kind = roll < 0.75 ? rng.pick(lowKinds) : rng.pick(tallKinds);
      else if (template === 1) kind = roll < 0.75 ? rng.pick(tallKinds) : rng.pick(lowKinds);
      else kind = roll < 0.55 ? rng.pick(tallKinds) : rng.pick(lowKinds);
      if (placeOne(kind, x, z)) placed++;
    }

    // A split: a line of trees down the middle. The safe line keeps to one side; the other side is
    // a second way down, open but not promised.
    for (let z = z0 + rng.range(1, 5); z < z1; z += rng.range(4.5, 7)) {
      if (this.shapeAt(z).split < 0.3) continue;
      placeOne(rng.pick(tallKinds), this.centerX(z) + rng.range(-1.6, 1.6), z);
    }

    // Spirit gates: two pillars straddling the safe line.
    if (p.gateChance > 0 && rng.chance(p.gateChance)) {
      const gz = z0 + rng.range(10, 54);
      const sx = this.safeX(gz);
      const half = SAFE_LANE + 0.45 + 0.75;
      const gx = sx + rng.range(-0.6, 0.6);
      const x1 = gx - half;
      const x2 = gx + half;
      if (clearOf(x1, gz, 0.45) && clearOf(x2, gz, 0.45)) {
        add('pillar', x1, gz, 0.45, 5);
        add('pillar', x2, gz, 0.45, 5);
        chunk.gates.push({ id: i * 8, x1, x2, z: gz });
      }
    }

    this.placeGifts(chunk, rng, diff);
    return chunk;
  }

  private placeGifts(chunk: Chunk, rng: Rng, diff: number): void {
    const gifts = chunk.gifts;
    let id = chunk.index * 64;
    const blocked = (x: number, z: number): boolean => {
      for (const o of chunk.obstacles) {
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < (o.r + 1.1) * (o.r + 1.1)) return true;
      }
      return this.edgeExcess(x, z) > 0.5;
    };
    if (chunk.z0 < 40) return;

    // Lines: one follows the safe line, another (later) tempts you off it.
    const lines = rng.int(1, 2);
    for (let l = 0; l < lines; l++) {
      // The line that tempts you off the safe one waits until 400 m: a first run learns the line first.
      if (l > 0 && chunk.z0 < 400) break;
      const startZ = chunk.z0 + rng.range(4, 30);
      const n = rng.int(5, 8);
      const risky = l > 0 || rng.chance(0.35 * diff);
      const off = risky ? rng.signed() * this.halfWidth(startZ) * 0.6 : rng.range(-0.8, 0.8);
      const sway = rng.range(-0.08, 0.08);
      for (let k = 0; k < n; k++) {
        const z = startZ + k * 3.4;
        const x = (risky ? this.centerX(z) : this.safeX(z)) + off + sway * k * 3.4;
        if (blocked(x, z)) continue;
        gifts.push({ id: id++, x, z, hover: 0.8, value: 1 });
      }
    }

    // Arcs over kickers at a typical takeoff speed.
    for (const r of chunk.zones.ramps) {
      const v = lerp(20, 27, diff);
      const lipZ = r.z + r.len;
      const lipY = this.ground(r.x, lipZ - 0.05);
      const faceSlope = (2 * r.h) / r.len + (this.baseY(lipZ) - this.baseY(lipZ - 1));
      const vy = v * faceSlope;
      const count = 5;
      for (let k = 1; k <= count; k++) {
        const t = k * 0.22;
        const z = lipZ + v * t;
        const y = lipY + vy * t - 4.9 * t * t;
        const hover = y - this.ground(r.x, z);
        if (hover < 0.8) break;
        const golden = k === 3 && rng.chance(0.3 + diff * 0.3);
        gifts.push({ id: id++, x: r.x, z, hover: Math.min(hover, 9), value: golden ? 5 : 1 });
      }
    }

    // A rare golden gift squeezed between obstacles.
    if (chunk.obstacles.length >= 2 && rng.chance(0.12 + 0.12 * diff)) {
      const a = rng.pick(chunk.obstacles);
      let best: Obstacle | null = null;
      let bestD = 1e9;
      for (const o of chunk.obstacles) {
        if (o === a) continue;
        const ddx = o.x - a.x;
        const ddz = o.z - a.z;
        const d = ddx * ddx + ddz * ddz;
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      if (best && bestD < 64) {
        const x = (a.x + best.x) / 2;
        const z = (a.z + best.z) / 2;
        if (!blocked(x, z)) gifts.push({ id: id++, x, z, hover: 0.9, value: 5 });
      }
    }
  }
}

/** Shared course cache so worker replays and the live run reuse generated chunks. */
const courses = new Map<number, Course>();
export function courseFor(seed: number): Course {
  const key = seed >>> 0;
  let c = courses.get(key);
  if (!c) {
    c = new Course(key);
    courses.set(key, c);
    if (courses.size > 8) {
      const first = courses.keys().next().value;
      if (first !== undefined && first !== key) courses.delete(first);
    }
  }
  return c;
}
