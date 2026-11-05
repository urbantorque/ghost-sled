import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, Object3D, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { MOODS } from '../sim/chaos';
import { Course, FOREST_LIMIT, type Section, type SectionKind } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { noise1 } from '../sim/noise';
import { signature, type Clearing } from './dressing';
import { SNOW, merge, part, reseed, shade } from './flora';
import { SitePlan } from './landmarks';
import { makeToonMaterial } from './materials';
import type { Palette } from './palette';
import type { Tier } from './world';

// Overlooks: now and then one bank opens. From the chase lens the run is a trough between two banks,
// so the valley, its villages, the sea of clouds and the panorama hide behind the treeline most of the
// way down. On an overlook (120 to 300 m, one or two a kilometre, the first inside the first 600 m)
// the forest on one side stands back, a timber rail marks the forest limit (where the sim still
// crashes a sled), a bare snow shelf runs out to a cornice lip with rocks breaking through it, and
// past the lip the mountain falls away: the terrain rolls over into a steepening face and the
// mid-ground carries the fall on down to the valley floor, so the way ahead opens over the valley to
// the far wall and the hero peak. Now and then both banks open at once and the run rides a ridge.
// Round each one (its outer stretch) the land past the lip falls away behind the treeline as well,
// and the mid-ground takes the valley form with a lower far wall, so the open side is one long fall
// over the sea of clouds rather than a notch cut into the mountain.
//
// Safety (ART.md section 10 and the lane rules): the snow is lowered only past LIP - 6 m of edge
// excess, so the corridor and its banks out to the forest limit, and every prop the dressing sets on
// the shelf (clutter out to 27.5 m, cabins to 23 m), stand on the sim's own ground. Nothing new
// stands within 9.2 m of the corridor's edge. Overlooks keep 150 m from every set piece in every
// mood (their outer stretches 110 m) and clear of the dressing's lift lines; the forest keeps clear
// of them through Props.siteClearings.
//
// From the chase lens the sim's own bank (9.5 m high at the forest limit) still hides what lies just
// past it: what opens is the sky band over the rail and the long view down the fall line on that side.
// The lens leans toward the open side while one is open, with a short reveal as it opens (camera.ts,
// CamTarget.open).
//
// Cost: two instanced batches (the rail and the lip's rocks), drawn only while an overlook is in
// range: +2 draws on Medium and High. Low has no forest clearing (the props skip it there), so its
// banks stay closed and it draws nothing (LOW_OPENS).

/** Edge excess (metres past the corridor's edge) of the cornice's crest. Past the dressing's clutter
 *  (27.5 m) and its cabins (23 m), so nothing the dressing sets on course.ground ever floats. */
export const LIP = 31;
/** The snow is lowered (or the cornice raised) only past this edge excess. */
export const LIP_FROM = LIP - 6;
/** Where the rail stands (edge excess): right at the forest limit, past the 9.2 m keep-out. */
const RAIL_E = FOREST_LIMIT + 0.3;
/** Metres over which the drop eases in at an overlook's start, and the share of its length over which
 *  it eases out at the end (inside its z0..z1): long, so the end is a slope, not a wall across the view
 *  ahead. */
const RAMP_IN = 40;
const RAMP_OUT = 0.45;
/** How far before an overlook the mid-ground's flank on its side starts to bend down into the valley
 *  (so it never folds away in plain sight), and how far past its end the valley holds (the view from
 *  the lip runs a long way down the fall line), easing back over the last WIDE_EASE metres. */
export const WIDE = 220;
const WIDE_AFTER = 650;
const WIDE_EASE = 400;
/** The outer stretch (OverlookPlan.outer): how far before and past an overlook the land past the lip
 *  falls away behind the treeline, its ramps, and how far short of a set piece it stops. */
const OUTER_BEFORE = 160;
const OUTER_AFTER = 520;
const OUTER_RAMP_IN = 120;
const OUTER_RAMP_OUT = 200;
const OUTER_SITE = 110;
/** Overlook length range and the gap after one (metres). */
const LEN_MIN = 120;
const LEN_MAX = 300;
const GAP_MIN = 260;
const GAP_SPREAD = 340;
/** The first overlook starts here at the earliest and inside the first FIRST_BY metres. */
const FIRST_Z = 90;
const FIRST_BY = 600;
/** Every set piece (any kind, present or future) keeps this far from an overlook. */
const SITE_KEEP = 150;
/** One overlook in this many opens both banks (a ridge), never the first. */
const RIDGE_CHANCE = 0.2;
/** The sections an overlook prefers: the open, flowing ones. */
const PREFERRED: ReadonlySet<SectionKind> = new Set<SectionKind>(['cruise', 'benches', 'switchbacks']);
/** Caps: rail sections and lip rocks alive at once (two or three overlooks in range, ridges both sides). */
const RAIL_CAP = 260;
const ROCK_CAP = 320;
/** Rail sections are modelled this long. */
const RAIL_LEN = 6;
/** Whether Low opens its overlooks too (the rail alone, one draw). Off until props.ts keeps the forest
 *  out of Props.siteClearings on Low as well: today it asks for them only with its dressing (Medium
 *  and High), and Low's far forest would stand in the air over the drop. */
export const LOW_OPENS = false;
/** How far ahead of the rider (metres) the plan is kept on idle time. */
const PLAN_AHEAD = 2400;

/** Runs fn on idle time (at most a second late), or soon after where there is none (Safari). */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 1000 });
  else setTimeout(fn, 50);
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** 0 where a side of the mountain falls away into the valley, 1 where it climbs into a spur
 *  (midground.ts): one slow noise, the two sides opposed. */
export function flankMode(seed: number, z: number, side: number): number {
  const a = noise1(seed ^ 0x51ed, z / 820) * 0.7 + noise1(seed ^ 0x2a17, z / 330) * 0.3;
  const m = side * a * 1.6 + 0.12 + noise1(seed ^ (side > 0 ? 0x77a1 : 0x19c3), z / 600) * 0.35;
  return smooth(-0.35, 0.35, m);
}

/** The lip's profile at full weight: metres the visual snow is lowered `e` past the corridor's edge
 *  (negative where the cornice stands proud). Zero inside LIP_FROM; a rounded crest of wind-packed
 *  snow at LIP, then a rollover that steepens all the way out (a convex face, so from the shelf the
 *  face itself drops out of sight and the eye goes straight to the valley). */
export function lipDrop(e: number): number {
  if (e <= LIP_FROM) return 0;
  if (e < LIP) return -0.8 * smooth(LIP_FROM, LIP, e);
  const d = e - LIP;
  return d * d * 0.0125 + 0.35 * d * smooth(0, 4, d) - 0.8;
}

/** lipDrop's slope (metres down per metre out). */
export function lipSlope(e: number): number {
  return (lipDrop(e + 0.5) - lipDrop(e - 0.5)) / 1;
}

/** The dressing's lift lines (dressing.ts liftOf, kept in step by hand): a lift's towers stand 24 to
 *  38 m out, across the lip, so an overlook never opens over one. */
function liftOf(sec: Section): { side: number; z0: number; z1: number } | null {
  const h = hashf(Math.round(sec.z0), 0x11f7, 1);
  const chance = sec.kind === 'bowl' || sec.kind === 'split' ? 0.55 : sec.kind === 'cruise' ? 0.2 : 0;
  if (h >= chance || sec.z1 - sec.z0 < 180) return null;
  return { side: hashf(Math.round(sec.z0), 0x11f7, 2) < 0.5 ? -1 : 1, z0: sec.z0 + 30, z1: sec.z1 - 30 };
}

/** One overlook: sim z0..z1, and the side that opens (0: both, a ridge); oz0..oz1, the stretch
 *  round it where the mountain past the lip falls away behind the treeline too. */
export interface Overlook {
  n: number;
  z0: number;
  z1: number;
  side: -1 | 0 | 1;
  oz0: number;
  oz1: number;
}

/** The deterministic list of a course's overlooks (planned lazily, in order). The same for every mood:
 *  the set pieces move with a mood's gravity and pop, so an overlook keeps clear of where they stand
 *  in each (and a mood change at a run's start never rebuilds the terrain). */
export class OverlookPlan {
  private list: Overlook[] = [];
  private nextZ = FIRST_Z;
  /** The set pieces' plan for each distinct gravity and pop among the moods. */
  private sites: SitePlan[] = [];

  constructor(readonly course: Course) {
    const seen = new Set<string>();
    for (const m of MOODS) {
      const key = m.params.gravity + ':' + m.params.pop;
      if (seen.has(key)) continue;
      seen.add(key);
      this.sites.push(new SitePlan(course, m.id));
    }
  }

  /** Overlooks planned so far. */
  get planned(): readonly Overlook[] {
    return this.list;
  }

  /** How far the plan is final (sim z): every overlook starting before it is planned. */
  get reach(): number {
    return this.nextZ;
  }

  /** One small step of planning toward sim z, for idle time: one set piece in one mood (the costly
   *  part, up to about 20 ms for a span), else the overlooks themselves. False once it is there. */
  prefetch(z: number): boolean {
    const need = z + LEN_MAX + OUTER_AFTER + OUTER_SITE + 170;
    let low: SitePlan | null = null;
    for (const sp of this.sites) if (sp.reach <= need && (!low || sp.reach < low.reach)) low = sp;
    if (low) {
      low.planNext();
      return true;
    }
    if (this.nextZ > z) return false;
    this.planNext();
    return true;
  }

  /** Plans every overlook starting before sim z. */
  planTo(z: number): void {
    while (this.nextZ <= z) this.planNext();
  }

  /** Whether an overlook may stand at sim z on `side` (0: both), in a section `pick` allows (0: the
   *  preferred ones, 1: any but a gully, 2: any). */
  private ok(z: number, side: number, pick: number): boolean {
    const c = this.course;
    const sec = c.section(z);
    if (pick === 0 && !PREFERRED.has(sec.kind)) return false;
    if (pick === 1 && sec.kind === 'gully') return false;
    const lift = liftOf(sec);
    if (lift && (side === 0 || lift.side === side) && z > lift.z0 - 40 && z < lift.z1 + 40) return false;
    // (A span can move up to 140 m back from where it was due, so plan well past.)
    for (const sp of this.sites) {
      sp.planTo(z + SITE_KEEP + 160);
      // (A long site, a village or an enclosed run, keeps the distance from its own ends.)
      for (const s of sp.planned) if (Math.abs(s.z - z) < SITE_KEEP + 10 + s.len) return false;
    }
    return true;
  }

  /** The first stretch from z0 to z1 that fits (at least LEN_MIN, up to `want` metres), or null. */
  private find(n: number, z0: number, z1: number, want: number, pick: number, ridge: boolean): Overlook | null {
    const seed = this.course.seed;
    for (let z = z0; z <= z1; z += 10) {
      // The side that falls away there (the valley side), or both on a ridge.
      const zm = z + want / 2;
      const side: -1 | 0 | 1 = ridge ? 0 : flankMode(seed, zm, -1) <= flankMode(seed, zm, 1) ? -1 : 1;
      if (!this.ok(z, side, pick)) continue;
      let e = z;
      while (e - z < want && this.ok(e + 10, side, pick)) e += 10;
      if (e - z >= LEN_MIN) return { n, z0: z, z1: e, side, oz0: z, oz1: e };
      z = e;
    }
    return null;
  }

  private planNext(): void {
    const c = this.course;
    const n = this.list.length;
    const want = LEN_MIN + hashf(c.seed, n, 71) * (LEN_MAX - LEN_MIN);
    let placed: Overlook | null;
    if (this.nextZ === FIRST_Z) {
      // The first is the reveal: any section will do, as long as it opens inside the first 600 m.
      placed = this.find(n, FIRST_Z, FIRST_BY - LEN_MIN, want, 2, false);
      if (!placed) {
        this.nextZ = FIRST_BY;
        return;
      }
    } else {
      // A preferred section within the next 700 m, else (to keep one or two a kilometre) any open one.
      const ridge = hashf(c.seed, n, 72) < RIDGE_CHANCE;
      placed = this.find(n, this.nextZ, this.nextZ + 700, want, 0, ridge) ?? this.find(n, this.nextZ, this.nextZ + 3000, want, 1, ridge);
      if (!placed) {
        this.nextZ += 3000;
        return;
      }
    }
    this.outer(placed);
    this.list.push(placed);
    this.nextZ = placed.z1 + GAP_MIN + hashf(c.seed, n, 73) * GAP_SPREAD;
  }

  /** The stretch round an overlook where the land past the lip falls away behind the treeline as well
   *  (so the open side is one long fall, not a notch cut into the mountain): OUTER_BEFORE before it to
   *  OUTER_AFTER past it, stopping OUTER_SITE short of any set piece and clear of the lift lines. */
  private outer(o: Overlook): void {
    let a = o.z0 - OUTER_BEFORE;
    let b = o.z1 + OUTER_AFTER;
    for (const sp of this.sites) {
      sp.planTo(b + OUTER_SITE + 160);
      for (const st of sp.planned) {
        if (st.z < o.z0 && st.z + st.len > a - OUTER_SITE) a = Math.max(a, st.z + st.len + OUTER_SITE);
        if (st.z > o.z1 && st.z - st.len < b + OUTER_SITE) b = Math.min(b, st.z - st.len - OUTER_SITE);
      }
    }
    const c = this.course;
    for (let z = a; z <= b; z += 20) {
      const lift = liftOf(c.section(z));
      if (!lift || (o.side !== 0 && lift.side !== o.side) || z < lift.z0 - 40 || z > lift.z1 + 40) continue;
      if (lift.z1 + 40 < o.z0) a = Math.max(a, lift.z1 + 40);
      else if (lift.z0 - 40 > o.z1) b = Math.min(b, lift.z0 - 40);
    }
    o.oz0 = Math.min(a, o.z0);
    o.oz1 = Math.max(b, o.z1);
  }

  /** How fully an overlook opens `side` at sim z (0..1), eased in and out at its ends. */
  weight(z: number, side: number): number {
    this.planTo(z + 10);
    let w = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.z1 < z - 10) break;
      if (z <= o.z0 || z >= o.z1 || (o.side !== 0 && o.side !== side)) continue;
      w = Math.max(w, smooth(o.z0, o.z0 + RAMP_IN, z) * (1 - smooth(o.z1 - (o.z1 - o.z0) * RAMP_OUT, o.z1, z)));
    }
    return w;
  }

  /** Where the mid-ground takes the valley form on `side` (0..1): from WIDE metres before an overlook
   *  to WIDE_AFTER past it. */
  wide(z: number, side: number): number {
    this.planTo(z + WIDE + 10);
    let w = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.z1 + WIDE_AFTER < z) break;
      if (o.side !== 0 && o.side !== side) continue;
      w = Math.max(w, smooth(o.z0 - WIDE, o.z0 + 20, z) * (1 - smooth(o.z1 + WIDE_AFTER - WIDE_EASE, o.z1 + WIDE_AFTER, z)));
    }
    return w;
  }

  /** How fully the land past the lip falls away on `side` at sim z (0..1): the overlook's own weight,
   *  carried on behind the treeline over its outer stretch. */
  fall(z: number, side: number): number {
    this.planTo(z + OUTER_BEFORE + 10);
    let w = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.oz1 < z - 10) {
        // (Outer stretches can overlap the next overlook's; one that ends this early is the last.)
        if (o.z1 + OUTER_AFTER < z) break;
        continue;
      }
      if (z <= o.oz0 || (o.side !== 0 && o.side !== side)) continue;
      const rin = Math.min(OUTER_RAMP_IN, Math.max(1, o.z0 + RAMP_IN - o.oz0));
      const rout = Math.min(OUTER_RAMP_OUT, Math.max(1, o.oz1 - o.z1 + (o.z1 - o.z0) * RAMP_OUT));
      w = Math.max(w, smooth(o.oz0, o.oz0 + rin, z) * (1 - smooth(o.oz1 - rout, o.oz1, z)));
    }
    return Math.max(w, this.weight(z, side));
  }

  /** Metres the visual snow is lowered at sim z, `e` past the corridor's edge on `side` (negative on
   *  the cornice's crest). Zero inside LIP_FROM and away from overlooks. */
  drop(z: number, side: number, e: number): number {
    if (e <= LIP_FROM) return 0;
    const w = this.fall(z, side);
    return w > 0 ? w * lipDrop(e) : 0;
  }

  /** The forest kept clear between sim z0 and z1: the whole band past the treeline on an open side,
   *  and past the shelf (from LIP_FROM - 1) over the outer stretch, where the land falls away. */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    this.planTo(z1 + OUTER_BEFORE + 10);
    for (const o of this.list) {
      if (o.oz1 < z0 - 10 || o.oz0 > z1 + 10) continue;
      for (const side of o.side === 0 ? [-1, 1] : [o.side]) {
        if (o.z1 >= z0 - 10 && o.z0 <= z1 + 10) out.push({ side, e: 55, z0: o.z0 - 6, z1: o.z1 + 6, w: 46 });
        out.push({ side, e: (LIP_FROM - 1 + 101) / 2, z0: o.oz0 - 6, z1: o.oz1 + 6, w: (101 - LIP_FROM + 1) / 2 });
      }
    }
  }

  /** The open side the lens may lean toward at sim z (signed weight; a ridge opens both, so none). */
  open(z: number): number {
    const l = this.weight(z, -1);
    const r = this.weight(z, 1);
    return r - l;
  }

  /** How open the view is at sim z, 0..1, either bank (a ridge counts: the soundscape's wind). */
  openness(z: number): number {
    return Math.max(this.weight(z, -1), this.weight(z, 1));
  }
}

// ---------------------------------------------------------------- the rail and the lip's rocks

/** The rail's timber per biome: weathered larch, pale boards and dark posts, charred posts, lacquer. */
function railColors(biome: BiomeId, p: Palette): { post: Color; rail: Color } {
  if (biome === 'glacier') return { post: new Color('#3A3C52'), rail: new Color('#B9C4D6').lerp(p.lowLit, 0.2) };
  if (biome === 'volcanic') return { post: new Color('#2E2834'), rail: new Color('#4A3E44') };
  if (biome === 'blossom') return { post: new Color('#3A2A36'), rail: shade(p.accentProp, 0.5).lerp(new Color('#3A2A36'), 0.4) };
  return { post: new Color('#5A4438'), rail: new Color('#7A5A44') };
}

/** One rail section, RAIL_LEN long along local x, its posts' feet at y = 0, local +z toward the run:
 *  stout posts, two split rails and a snow cap, low enough to read as a viewpoint rail, not a wall. */
function railGeometry(biome: BiomeId, p: Palette): BufferGeometry {
  const { post, rail } = railColors(biome, p);
  const parts: BufferGeometry[] = [];
  for (const x of [-RAIL_LEN / 2 + 0.1, 0]) {
    parts.push(part(new CylinderGeometry(0.09, 0.11, 1.55, 6), post, { pos: [x, 0.5, 0] }));
    parts.push(part(new CylinderGeometry(0.13, 0.1, 0.12, 6), SNOW, { pos: [x, 1.31, 0] }));
  }
  parts.push(part(new BoxGeometry(RAIL_LEN + 0.2, 0.12, 0.08), rail, { pos: [0, 0.62, 0.11], rot: [0.05, 0, 0] }));
  parts.push(part(new BoxGeometry(RAIL_LEN + 0.2, 0.14, 0.1), rail, { pos: [0, 1.1, 0.11] }));
  parts.push(part(new BoxGeometry(RAIL_LEN + 0.1, 0.07, 0.17), SNOW, { pos: [0, 1.2, 0.11] }));
  return merge(parts);
}

/** A rock breaking through the cornice: a faceted boulder with snow lying on its top, a unit across. */
function rockGeometry(p: Palette): BufferGeometry {
  reseed(5303);
  const rock = p.low.clone().lerp(p.lowLit, 0.25);
  return merge([
    part(new IcosahedronGeometry(0.55, 0), rock, { pos: [0, 0.18, 0], scale: [1.25, 0.9, 1.05], jitter: 0.16 }),
    part(new IcosahedronGeometry(0.34, 0), shade(rock, 0.86), { pos: [0.42, 0.05, 0.22], rot: [0.4, 1.1, 0], jitter: 0.1 }),
    part(new IcosahedronGeometry(0.5, 0), SNOW, { pos: [-0.05, 0.52, 0], scale: [1.2, 0.32, 0.95], jitter: 0.07 }),
  ]);
}

/**
 * The course's overlooks: the plan (which the terrain, the mid-ground and the forest read) and the
 * rail and rocks along each one in range. World-anchored, made per overlook as it comes into range.
 */
export class Overlooks {
  readonly root = new Object3D();
  plan: OverlookPlan;
  /** Idle planning is queued. */
  private waiting = false;
  private mat: ShaderMaterial;
  private rails: InstancedMesh;
  private rocks: InstancedMesh;
  /** The overlooks whose pieces stand now (by n), and the window they were placed for. */
  private shown = '';
  private enabled: boolean;
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private a = new Vector3();
  private b = new Vector3();
  private xa = new Vector3();
  private ya = new Vector3();
  private za = new Vector3();
  private up = new Vector3(0, 1, 0);
  private col = new Color();

  /** Low draws the rail alone (one draw), when it opens at all (LOW_OPENS). */
  private rocksOn = true;

  constructor(
    private course: Course,
    palette: Palette,
    tier: Tier,
  ) {
    this.root.name = 'overlooks';
    this.enabled = tier !== 'low' || LOW_OPENS;
    this.rocksOn = tier !== 'low';
    this.plan = new OverlookPlan(course);
    this.mat = makeToonMaterial({ coolShade: 0.5, nearFade: [0.9, 3.2] });
    this.rails = new InstancedMesh(railGeometry(course.biome, palette), this.mat, RAIL_CAP);
    this.rocks = new InstancedMesh(rockGeometry(palette), this.mat, ROCK_CAP);
    for (const im of [this.rails, this.rocks]) {
      im.count = 0;
      im.frustumCulled = false;
      im.visible = false;
      this.root.add(im);
    }
    this.rocks.setColorAt(0, this.col.setRGB(1, 1, 1));
  }

  /** Whether overlooks open on this tier (the plan still exists, empty of effect, when they do not). */
  get open(): boolean {
    return this.enabled;
  }

  setCourse(course: Course, palette: Palette): void {
    if (course !== this.course) {
      this.course = course;
      this.plan = new OverlookPlan(course);
      this.shown = '';
    }
    this.setPalette(palette);
  }

  setPalette(p: Palette): void {
    this.rails.geometry.dispose();
    this.rails.geometry = railGeometry(this.course.biome, p);
    this.rocks.geometry.dispose();
    this.rocks.geometry = rockGeometry(p);
  }

  setTier(tier: Tier): void {
    this.enabled = tier !== 'low' || LOW_OPENS;
    this.rocksOn = tier !== 'low';
    this.shown = '';
  }

  /** The signed open side at sim z for the chase lens: + right, - left, 0 none (or a ridge). */
  lean(z: number): number {
    return this.enabled ? this.plan.open(z) : 0;
  }

  /** How open the view is at sim z, 0..1 (OverlookPlan.openness); zero on a tier without overlooks. */
  openness(z: number): number {
    return this.enabled ? this.plan.openness(z) : 0;
  }

  /** Metres the visual snow is lowered (see OverlookPlan.drop); zero on a tier without overlooks. */
  drop(z: number, side: number, e: number): number {
    return this.enabled ? this.plan.drop(z, side, e) : 0;
  }

  /** Keeps the rail and rocks of the overlooks round sim z standing (placed only when the set in
   *  range changes: a few hundred matrices, once per overlook). */
  update(z: number): void {
    if (!this.enabled) {
      this.rails.visible = this.rocks.visible = false;
      return;
    }
    const lo = z - 260;
    const hi = z + 900;
    // Planned well ahead on idle time (the terrain and the mid-ground ask up to about 1.5 km on); what
    // they ask for before that is planned on the spot.
    if (!this.waiting && this.plan.reach < z + PLAN_AHEAD) {
      this.waiting = true;
      const plan = this.plan;
      whenIdle(() => {
        this.waiting = false;
        if (plan === this.plan) plan.prefetch(z + PLAN_AHEAD);
      });
    }
    this.plan.planTo(hi);
    let key = '';
    for (const o of this.plan.planned) if (o.z1 > lo && o.z0 < hi) key += o.n + ',';
    if (key === this.shown) return;
    this.shown = key;
    let nr = 0;
    let nk = 0;
    for (const o of this.plan.planned) {
      if (o.z1 <= lo || o.z0 >= hi) continue;
      for (const side of o.side === 0 ? [-1, 1] : [o.side]) {
        const c = this.course;
        // The rail, end to end along the forest limit (where the benches' own fence runs, that fence
        // marks it).
        for (let zz = o.z0 + RAIL_LEN / 2; zz < o.z1 && nr < RAIL_CAP; zz += RAIL_LEN) {
          const sig = signature(c, zz);
          if (sig.kind === 'benches' && sig.k > 0.2) continue;
          this.rails.setMatrixAt(nr++, this.alongBank(side, RAIL_E, zz, RAIL_LEN));
        }
        // Rocks breaking through the cornice where the lip is open, bigger and more of them on the face.
        for (let k = 0, zz = o.z0 + 8; this.rocksOn && zz < o.z1 - 8 && nk < ROCK_CAP; k++) {
          const h = hashf(o.n * 31 + side, k, 81);
          zz += 4 + 9 * h;
          const w = this.plan.weight(zz, side);
          if (w < 0.35) continue;
          const e = LIP - 2.5 + hashf(o.n * 31 + side, k, 82) * 6.5;
          const x = c.centerX(zz) + side * (c.halfWidth(zz) + e);
          const y = c.ground(x, zz) - this.plan.drop(zz, side, e);
          const sc = (1.1 + 2.2 * Math.pow(hashf(o.n * 31 + side, k, 83), 1.6)) * (0.6 + 0.4 * w);
          this.q.setFromAxisAngle(this.up, hashf(o.n * 31 + side, k, 84) * 6.28);
          this.v.set(x, y - sc * 0.32, -zz);
          this.s.set(sc * (0.9 + 0.5 * hashf(o.n * 31 + side, k, 85)), sc, sc);
          this.m.compose(this.v, this.q, this.s);
          this.rocks.setMatrixAt(nk, this.m);
          const t = 0.88 + 0.16 * hashf(o.n * 31 + side, k, 86);
          this.rocks.setColorAt(nk, this.col.setRGB(t, t, t * 1.02));
          nk++;
        }
      }
    }
    this.rails.count = nr;
    this.rocks.count = nk;
    this.rails.instanceMatrix.needsUpdate = true;
    this.rocks.instanceMatrix.needsUpdate = true;
    if (this.rocks.instanceColor) this.rocks.instanceColor.needsUpdate = true;
    this.rails.visible = nr > 0;
    this.rocks.visible = nk > 0;
  }

  /** A rail section laid along the bank on `side`, `e` past the edge, centred at sim z: local x along
   *  the run, pitched to the ground between its ends, its face toward the run. */
  private alongBank(side: number, e: number, z: number, len: number): Matrix4 {
    const c = this.course;
    const pt = (zz: number, out: Vector3) => {
      const x = c.centerX(zz) + side * (c.halfWidth(zz) + e);
      return out.set(x, c.ground(x, zz), -zz);
    };
    pt(z - len / 2, this.a);
    pt(z + len / 2, this.b);
    this.xa.subVectors(this.b, this.a).normalize();
    if (side > 0) this.xa.negate();
    this.ya.copy(this.up).addScaledVector(this.xa, -this.xa.dot(this.up)).normalize();
    this.za.crossVectors(this.xa, this.ya);
    pt(z, this.v);
    const mid = Math.min(this.v.y, (this.a.y + this.b.y) / 2);
    this.m.makeBasis(this.xa, this.ya, this.za);
    this.m.setPosition(this.v.x, mid - 0.05, this.v.z);
    return this.m;
  }

  /** The forest kept clear between sim z0 and z1 (none on a tier without overlooks). */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    if (this.enabled) this.plan.clearings(z0, z1, out);
  }
}
