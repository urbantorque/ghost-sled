import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, ShaderMaterial, Vector3, Vector4 } from 'three';
import type { Beat } from '../game/beats';
import { MOODS, Mood } from '../sim/chaos';
import { CHUNK_LEN, Course, SectionKind } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { CrowdUniforms, FIGURE_H, crowdColors, crowdMaterial, figureGeometry } from './crowd';
import { ENCLOSED, Kind, Piece, Rail, SiteCtx, mergePiece, pieceFor } from './landmarkKit';
import type { Clearing } from './dressing';
import { makeToonMaterial, shared } from './materials';
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
// Between them, every 1.5 to 2.5 km the run becomes a village's street for 150 to 250 m, and every
// 1.1 to 1.9 km (where nothing launches under it) it runs enclosed for 70 to 120 m: an avalanche
// gallery, an ice or lava-rock tunnel, a corridor of torii (town.ts). These long sites are built along
// the course's own line (a rail) and hang nothing over the run lower than the highest air there plus
// the margin (airProfile: the same flights as airCeiling, binned along the run). Inside an enclosure
// the frame darkens at its edges and the way out flashes (`light`, which world.ts hands to the post).
//
// Cost: two piece meshes (each drawn only while in view) and one crowd batch: +3 draws on Medium and
// High (+2 in the shadow pass while a piece is in the shadow frustum), and in a village at night its
// lamplight pools (+1) and in Ember's its steam (+1); Low draws the spans and the long sites' shells
// and buildings, +2 at most. Pieces are made on idle time, a few parts per callback, never at a run's
// start.

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
/** Crowd instances in view at once (High; Medium draws the nearest CROWD_MED). */
const CROWD_CAP = 560;
const CROWD_MED = 380;
/** The village crowd drawn round the rider: from this far behind to this far ahead (sim metres). */
const WINDOW_BACK = 25;
const WINDOW_AHEAD = 150;

/** Villages: the first, and the spacing after it (centre to centre); half their length. */
const VILLAGE_FIRST = 820;
const VILLAGE_FIRST_SPREAD = 380;
const VILLAGE_STEP = 1500;
const VILLAGE_SPREAD = 1000;
const VILLAGE_HALF: readonly [number, number] = [75, 125];
/** Enclosed runs: the first, and the spacing after it; half their length by kind. */
const ENC_FIRST = 1350;
const ENC_FIRST_SPREAD = 450;
const ENC_STEP = 1100;
const ENC_SPREAD = 800;
const ENC_HALF: Partial<Record<Kind, readonly [number, number]>> = { gallery: [36, 55], icetunnel: [32, 46], lavatunnel: [32, 46], toriirow: [40, 60] };
/** An enclosure's roof stands at least this high over its floor (it reads as a roof, not a lid), and
 *  where it would have to stand higher than ENC_MAX the stretch is passed over. */
const ENC_MIN: Partial<Record<Kind, number>> = { gallery: 13.5, icetunnel: 12.5, lavatunnel: 12.5, toriirow: 11.5 };
const ENC_MAX = 33;
/** Sections an enclosure can roof: not the wide ones, nor a gully (its rock walls stand at the keep line). */
const ENC_SECTIONS: ReadonlySet<SectionKind> = new Set<SectionKind>(['chute', 'cruise', 'switchbacks', 'benches']);
/** Sections a village keeps out of: their cornices and rock walls own the crest (dressing.ts). */
const VILLAGE_SHUNS: ReadonlySet<SectionKind> = new Set<SectionKind>(['bowl', 'gully']);
/** Metres kept clear between a long site's ends and its neighbours. */
const LONG_GAP = 300;
/** ...but a village and an enclosed run may follow each other closer: out of the street into the shed. */
const LONG_PAIR = 100;
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
/** How likely a section is to carry a span: narrow ones mostly, wide ones mostly a bank piece. */
const SPAN_CHANCE: Record<SectionKind, number> = { chute: 0.8, gully: 0.85, cruise: 0.55, switchbacks: 0.5, benches: 0.35, bowl: 0.3, split: 0.3 };
/** Kinds that gather a crowd on the banks (both banks for spans, mostly their own side otherwise). */
const CROWDED: ReadonlySet<Kind> = new Set<Kind>(['gate', 'torii', 'basalt', 'bridge', 'hut', 'jump', 'pagoda', 'village']);

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
  for (let zl = z0; pops && zl <= zb; zl += 5) {
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

/** The deterministic list of a course's sites (planned lazily, in order). */
export class SitePlan {
  private list: Site[] = [];
  private nextZ: number;
  private gravity: number;
  private pop: number;
  private spanI = 0;
  private bankI = 0;
  private encI = 0;
  /** Where the next village and the next enclosed run are due (sim z). */
  private nextVillage: number;
  private nextEnc: number;
  /** Play-tests: the longest planNext, ms. */
  readonly stats = { maxPlanMs: 0 };

  constructor(
    readonly course: Course,
    mood: Mood,
  ) {
    const mp = (MOODS[mood] ?? MOODS[0]).params;
    this.gravity = mp.gravity;
    this.pop = mp.pop;
    this.nextZ = FIRST_Z + hashf(course.seed, 1, 1) * FIRST_SPREAD;
    this.nextVillage = VILLAGE_FIRST + hashf(course.seed, 2, 21) * VILLAGE_FIRST_SPREAD;
    this.nextEnc = ENC_FIRST + hashf(course.seed, 3, 22) * ENC_FIRST_SPREAD;
  }

  /** Whether a stretch is clear of kilometre arches. */
  private offKm(z0: number, z1: number): boolean {
    for (let km = Math.max(1, Math.ceil((z0 - KM_KEEP) / 1000)); km * 1000 <= z1 + KM_KEEP; km++) {
      if (km * 1000 > z0 - 40 && km * 1000 < z1 + 40) return false;
    }
    return true;
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
    for (let z = z0; z <= z1; z += 20) if (!ENC_SECTIONS.has(c.section(z).kind) || c.halfWidth(z) > 17) return false;
    return true;
  }

  /** Whether the last site planned is a long one (a village or an enclosure). */
  private afterLong(): boolean {
    const n = this.list.length;
    return n > 0 && this.list[n - 1].len > 0;
  }

  /** A long site centred at z with half length `len`, its air profile flown. */
  private longSite(n: number, kind: Kind, z: number, len: number): Site {
    const c = this.course;
    const dx = (c.centerX(z + 1) - c.centerX(z - 1)) / 2;
    const side: 1 | -1 = hashf(c.seed, n, 6) < 0.5 ? -1 : 1;
    const airZ = z - len - 8;
    const air = airProfile(c, airZ, z + len + 8, this.gravity, this.pop);
    const site: Site = { n, kind, span: false, side, z, x: c.centerX(z), y: c.ground(c.centerX(z), z), yaw: -Math.atan(dx), post: 0, clear: 0, len, air, airZ };
    site.post = c.halfWidth(z) + BANK_KEEP;
    return site;
  }

  /** An enclosure's roof over its floor: the highest air over the stretch plus the margin, and at
   *  least ENC_MIN over the corridor's highest ground (plus a metre for the roof's pitch). */
  private roofNeed(s: Site, kind: Kind): number {
    const c = this.course;
    let need = 0;
    for (let dz = -s.len - 6; dz <= s.len + 6; dz += AIR_BIN) {
      const z = s.z + dz;
      const base = c.baseY(z);
      need = Math.max(need, siteAir(s, z - 2 * AIR_BIN, z + 2 * AIR_BIN) + SPAN_MARGIN - base);
      const cx = c.centerX(z);
      const hw = c.halfWidth(z);
      for (let k = -4; k <= 4; k++) need = Math.max(need, c.ground(cx + (k / 4) * hw, z) - base + (ENC_MIN[kind] ?? 13));
    }
    return need + 1;
  }

  /** Plans a village at or after z, or null where it cannot go. */
  private planVillage(n: number, z: number, prevEnd: number): Site | null {
    const c = this.course;
    const len = VILLAGE_HALF[0] + hashf(c.seed, n, 23) * (VILLAGE_HALF[1] - VILLAGE_HALF[0]);
    // The nearest stretch off the kilometre arches and clear of a bowl or a gully (whose cornices and
    // rock walls own the crest the crowd stands on); none within 600 m tries again 300 m on.
    const base = this.afterLong() ? prevEnd + LONG_PAIR + len : Math.max(z, prevEnd + LONG_GAP + len);
    let zc = NaN;
    for (let zt = base; zt < base + 600 && Number.isNaN(zc); zt += 20) {
      if (!this.offKm(zt - len, zt + len)) continue;
      let ok = true;
      for (let q = zt - len - 20; q <= zt + len + 20 && ok; q += 20) ok = !VILLAGE_SHUNS.has(c.section(q).kind);
      if (ok) zc = zt;
    }
    if (Number.isNaN(zc)) {
      this.nextVillage = z + 300;
      return null;
    }
    const site = this.longSite(n, 'village', zc, len);
    this.nextVillage = zc + VILLAGE_STEP + hashf(c.seed, n, 24) * VILLAGE_SPREAD;
    return site;
  }

  /** Plans an enclosed run near z, or null where none fits (no quiet stretch, or the air too high). */
  private planEnclosed(n: number, z: number, prevEnd: number): Site | null {
    const c = this.course;
    const kinds = ENC_KINDS[c.biome];
    const kind = kinds[this.encI % kinds.length];
    const [a, b] = ENC_HALF[kind] ?? [40, 50];
    const len = a + hashf(c.seed, n, 25) * (b - a);
    const base = this.afterLong() ? prevEnd + LONG_PAIR + len : Math.max(z - 150, prevEnd + LONG_GAP + len);
    // (Low gravity flies every launch far over any roof: no enclosures there.)
    if (this.gravity < 0.95) return null;
    // Every stretch in reach with nothing launching under it and no kicker in the 220 m above it (whose
    // flights would carry far over its roof), nearest first; the air is flown for at most five, and
    // a search that finds none waits 500 m before the next.
    let tries = 0;
    let lastTry = -Infinity;
    for (let zc = base; zc < base + 1200 && tries < 5; zc += 20) {
      if (zc - lastTry < 60 || !this.offKm(zc - len, zc + len) || !this.quiet(zc - len, zc + len) || this.kicksOver(zc - len - 6, zc + len + 6, kind)) continue;
      lastTry = zc;
      tries++;
      const site = this.longSite(n, kind, zc, len);
      const need = this.roofNeed(site, kind);
      if (need <= ENC_MAX) {
        site.clear = need;
        this.encI++;
        this.nextEnc = zc + ENC_STEP + hashf(c.seed, n, 26) * ENC_SPREAD;
        return site;
      }
    }
    this.nextEnc = z + 500;
    return null;
  }

  /** Whether a kicker's or a vent's flight from up the slope passes too high over [z0, z1] for any
   *  roof (a few flights: the cheap look before the whole profile). */
  private kicksOver(z0: number, z1: number, kind: Kind): boolean {
    const c = this.course;
    let over = false;
    flights(
      c,
      z0,
      z1,
      this.gravity,
      this.pop,
      (z, y) => {
        if (!over && y + SPAN_MARGIN + 0.5 - c.baseY(z) > ENC_MAX) over = true;
      },
      false,
    );
    return over || (ENC_MIN[kind] ?? 13) > ENC_MAX;
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
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const site = this.planOne();
    if (t0) this.stats.maxPlanMs = Math.max(this.stats.maxPlanMs, performance.now() - t0);
    return site;
  }

  private planOne(): Site {
    const c = this.course;
    const n = this.list.length;
    const prevZ = n > 0 ? this.list[n - 1].z : -Infinity;
    const prevEnd = n > 0 ? this.list[n - 1].z + this.list[n - 1].len : -Infinity;
    const offKm = (z: number) => {
      const km = Math.round(z / 1000);
      return km >= 1 && Math.abs(z - km * 1000) < KM_KEEP ? km * 1000 + KM_KEEP : z;
    };
    let z = offKm(this.nextZ);
    // A village when one is due, else an enclosed run when one is due and fits (never right before a
    // village); the next site after either keeps LONG_GAP past its end.
    if (n > 0) {
      let long: Site | null = null;
      if (z >= this.nextVillage) long = this.planVillage(n, z, prevEnd);
      else if (z >= this.nextEnc && this.nextVillage - z > 350) long = this.planEnclosed(n, z, prevEnd);
      if (long) {
        this.nextZ = long.z + long.len + LONG_GAP + hashf(c.seed, n + 2, 2) * 300;
        this.list.push(long);
        return long;
      }
    }
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
        // (After a long site the gap counts from its end.)
        const gap = zc - prevEnd;
        if (gap < (prevEnd > prevZ ? LONG_GAP : STEP_MIN) || gap > STEP_MIN + STEP_SPREAD + KM_KEEP) continue;
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
    const site: Site = { n, kind, span, side, z, x: c.centerX(z), y: c.ground(c.centerX(z), z), yaw: -Math.atan(dx), post: 0, clear, len: 0, air: null, airZ: 0 };
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
      if (s.z + s.len < z0 - 60 || s.z - s.len > z1 + 60) continue;
      if (s.len > 0) {
        // A village clears both banks deep for its houses; an enclosure its walls and pillars.
        const [a, b] = siteSpan(s);
        for (const side of [-1, 1]) out.push(s.kind === 'village' ? { side, e: 35, z0: a - 12, z1: b + 12, w: 26 } : { side, e: 16, z0: a - 8, z1: b + 8, w: 7 });
      } else if (s.span) {
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

/** Lamplight pools drawn at once (each a two-ring disc laid on the snow), and steam puffs. */
const POOL_CAP = 160;
const POOL_SEG = 10;
const POOL_V = 1 + 2 * POOL_SEG;
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
  private shown: Array<Site | null> = [null, null];
  private plain: ShaderMaterial;
  private iceMat: ShaderMaterial;
  private crowdMat: ShaderMaterial;
  private crowd: InstancedMesh;
  private aCoat: InstancedBufferAttribute;
  private aHat: InstancedBufferAttribute;
  private aSeed: InstancedBufferAttribute;
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
    this.extras.clear();
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
      rail: site.len > 0 ? siteRail(this.course, site) : undefined,
    };
  }

  /** Whether this tier draws a site (Low: the spans and the long sites' shells and buildings). */
  private drawn(site: Site): boolean {
    return this.tier !== 'low' || site.span || site.len > 0;
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
    return this.finish(b);
  }

  private finish(b: Build): BufferGeometry {
    const g = mergePiece(b.made);
    b.made = [];
    this.built.set(b.site.n, g);
    this.pieceIce.set(b.site.n, b.piece.ice);
    this.extras.set(b.site.n, { glows: b.piece.glows, steam: b.piece.steam, spots: b.piece.spots });
    // Keep the pieces round the rider; drop the oldest.
    if (this.built.size > 4) {
      for (const [n, old] of this.built) {
        if (this.built.size <= 4) break;
        if (this.shown.some((s) => s && s.n === n)) continue;
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
    if (!this.idleOpen || this.idleBusy || (this.queue.length === 0 && this.plan.reach >= this.wantReach)) return;
    this.idleBusy = true;
    whenIdle((deadline) => {
      this.idleBusy = false;
      // As many jobs as the idle period has room for (one where there is no deadline).
      for (let k = 0; k < 6; k++) {
        const t0 = performance.now();
        const b = this.queue[0];
        // A piece already in view is made before the plan reaches further ahead.
        if (this.plan.reach < this.wantReach && !(b && b.site.z - b.site.len < this.viewEnd)) this.plan.planNext();
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
    const dt = Math.max(0, Math.min(0.1, time - this.lastT));
    this.lastT = time;
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
    let village: Site | null = null;
    for (const s of plan.planned) {
      if (s.z + s.len < z - 160 || s.z - s.len > z + ahead + 60 || !this.drawn(s)) continue;
      // Queue it for idle time as soon as it is planned; a site within 3 chunks unmade is made now.
      if (!this.built.has(s.n)) {
        if (s.z - s.len - z < 3 * CHUNK_LEN + 60) {
          this.makeNow(s);
          this.stats.madeNow++;
        } else this.enqueue(s);
      }
      if (k < 2) {
        want[k++] = s;
        if (s.kind === 'village') village = s;
      }
    }
    // The next site past the view is queued ahead.
    for (const s of plan.planned) if (s.z - s.len > this.viewEnd && s.z - s.len < z + ahead + 1000 && this.drawn(s)) this.enqueue(s);
    if (want[0] !== this.shown[0] || want[1] !== this.shown[1]) this.show(want, z);
    // A village's crowd is drawn round the rider: refilled every 12 m down the street.
    else if (village && Math.abs(z - this.windowZ) > 12) this.fillCrowd(want, z);
    // In a village the street does the wave alongside the rider.
    const inVillage = village && z > village.z - village.len - 30 && z < village.z + village.len ? 1 : 0;
    this.uniforms.uWave.value += (inVillage - this.uniforms.uWave.value) * Math.min(1, dt * 2);
    this.enclosure(z, dt);
  }

  /** The light of an enclosed run on the frame: darker edges inside, a strobe past a gallery's
   *  pillars or a torii's gates where the light comes in, and a flash of daylight on the way out. */
  private enclosure(z: number, dt: number): void {
    let into = 0;
    let strobe = 0;
    let site: Site | null = null;
    for (const s of this.plan.planned) {
      if (!ENCLOSED.has(s.kind) || z < s.z - s.len - 10 || z > s.z + s.len + 10) continue;
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
      // Spans and enclosures cast (the dark of a gallery is its shadow); a village's houses on High.
      mesh.castShadow = this.shadows && (s.span || ENCLOSED.has(s.kind) || (s.kind === 'village' && this.tier === 'high'));
      mesh.visible = true;
      const ex = this.extras.get(s.n);
      if (!ex) continue;
      // Lamplight pools, laid on the snow vertex by vertex.
      if (ex.glows && this.night && this.tier !== 'low') {
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
    const village = want.some((s) => s && s.kind === 'village');
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
        if (s.kind === 'village') while (i0 < list.length && -list[i0].z < rz - WINDOW_BACK) i0++;
        for (let i = i0; i < list.length; i++) {
          const f = list[i];
          if (n >= cap) break;
          if (s.kind === 'village' && -f.z > rz + WINDOW_AHEAD) break;
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
      const sides = site.kind === 'village' ? [] : site.span ? [-1, 1] : [site.side, -site.side];
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
      if (site.kind === 'village') list.sort((a, b) => b.z - a.z);
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
