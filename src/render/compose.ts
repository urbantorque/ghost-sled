import type { Course, Section } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import type { Clearing } from './dressing';
import { facetNoise, shapeGround, smoothK } from './ground';
import type { Site } from './landmarks';
import { flankMode } from './overlook';

// Round 8, break the trench (ART.md 15, the brief's V3). From the chase lens every run opened on the same picture:
// the corridor between two banks the sim raises 9.5 m in its first 10 m past the edge, the peak or the moon dead
// centre, and the forest and the mountainside carrying the banks on up. The sim's banks are what a sled rides, so
// they stay as they are; what this module shapes is everything past the limit (where a sled is already turned
// back), and where the lens stands, at the two places a run is framed for: its opening (from the start's stands to
// the first leap) and each stage start (the threshold the charm gates stand on). Each mountain gets its own place
// out of ART.md 15:
//   Pinecrest    the valley side's bank is the crest of a long fall: the forest stands back, the snow rolls over a
//                cornice just past the limit and the mountain falls away to the valley, and the lens rises and
//                leans out over it. Open and sunlit, the world below.
//   Frostfang    a blue canyon: both banks stand up into walls of crevasse ice 30 m tall a few metres past the
//                limit, the sky a slot between them, the lens low in it; at the opening's foot the valley side's
//                wall breaks off and the overlook opens out of the canyon's mouth. A stage start is one wall and
//                an abyss.
//   Ember Peak   a ridge: one side falls away to the lava fields, the other stands up in a low wall of basalt, and
//                the lens rides high on the wall's side looking across the fall at the cone.
//   Sakura       terraces: the open side steps down in flats and dressed-stone risers (the orchards stand on the
//                flats), the other steps up the hill; the lens rises to see them step.
//   Lanternfall  a dark crest: both banks roll over and fall away, the cloud lies below them, and the lens rises
//                so the crest is a ridge in the night with the lights far down.
// Each stretch is keyed to the course's own sections (the first section after the start up to the first leap; a
// threshold, `Section.gate`), never to metres, and keeps clear of every place the landmarks stand in any mood. What
// stands past the limit stands on what is drawn (ground.ts visualGround reads this through shapeGround), steep
// faces keep the forest and the dressing off them (keeps), and the overlook's own drop gives way on a side shaped
// here (overlook.ts). Nothing here reads or moves anything a sled can touch.

/** What a bank past the limit becomes. */
export type BankKind = 'none' | 'wall' | 'fall' | 'steps' | 'rise';
/** The lens's placement over a stretch (camera.ts CamPlace). */
export type Look = 'valley' | 'canyon' | 'ridge' | 'terraces' | 'crest';

/** One bank's shape over a stretch of run: `side` +1 right (three.js +x), -1 left. */
export interface BankSeg {
  side: 1 | -1;
  kind: BankKind;
  z0: number;
  z1: number;
  /** Metres over which it eases in after z0 and out before z1. */
  rin: number;
  rout: number;
  /** A wall's height over the bank at the limit (metres). */
  h: number;
}

/** One composed place: its banks and the lens's look. `open` is the side the lens leans toward (0 none). */
export interface Composed {
  n: number;
  at: 'opening' | 'stage';
  z0: number;
  z1: number;
  look: Look;
  open: -1 | 0 | 1;
  /** The side the lens stands toward (a ridge's high side, a valley's open side), 0 centred. */
  stand: -1 | 0 | 1;
  banks: BankSeg[];
}

/** The lens's placement for a look at full weight (metres up, back and aside toward `stand`, radians of turn
 *  toward `open`, and the horizon's cap and the rider's row in the frame, as camera.ts reads them). Mutable so a
 *  tuning probe can try values live (`__gs.world.overlooks.compose.looks`). The lens keeps close: rising 2.4 m and
 *  1.2 m back left the rider a size smaller, and two blind critics preferred the old frame for its bigger hero (ART.md
 *  15's fourth rule), so a place moves the lens up a metre at most and composes by its turn and its step aside; and
 *  a critic on stills that hold the run still preferred the rider in the lower middle (ART.md 8) to one stepped 1.7 m
 *  aside, which also swept a passing ghost to a smear at the frame's edge: the step is under a metre. */
export interface LookSet {
  up: number;
  back: number;
  aside: number;
  yaw: number;
  /** Added to the horizon's cap (camera.ts: the highest the horizon may climb, as a share of the frame from its top);
   *  - lets the lens look further down, onto the world below. */
  horizon: number;
  /** Added to the rider's row (NDC; - sinks the rider). */
  row: number;
}
export const LOOKS: Record<Look, LookSet> = {
  valley: { up: 0.7, back: 0, aside: 0.3, yaw: 0.1, horizon: -0.02, row: -0.04 },
  canyon: { up: 0.2, back: 0, aside: 0, yaw: 0, horizon: 0.03, row: -0.05 },
  ridge: { up: 0.5, back: 0, aside: 0.6, yaw: 0.06, horizon: 0.02, row: -0.03 },
  terraces: { up: 0.5, back: 0, aside: 0, yaw: 0.07, horizon: 0.02, row: -0.03 },
  crest: { up: 1.2, back: 0.2, aside: 0, yaw: 0, horizon: 0.02, row: -0.04 },
};

/** A wall: how far past the limit it takes to stand up, and where (past the limit) its back has come down again to
 *  the bank's own (it is a rim, not a mountain: the mid-ground past it is untouched). */
const WALL_UP = 9;
const WALL_BACK0 = 26;
const WALL_BACK1 = 52;
/** A fall: the cornice's height and how far out its crest stands past the limit, the face's slope there and how
 *  fast it steepens, and its steepest (the mid-ground's own valley face, midground.ts OV_SLOPE). */
const CORNICE = 0.6;
const CORNICE_E = 2.5;
const FALL_S0 = 0.45;
const FALL_K = 0.03;
const FALL_MAX = 1.8;
/** Terraces: a flat this wide, a riser this tall over this run, the first flat's width at the bank's top, and how
 *  many steps before the ground carries on falling (down) or levels out and gives back to the bank (up). */
const STEP_FLAT = 8;
const STEP_H = 4;
const STEP_RUN = 2.4;
const STEP_FIRST = 3;
const STEPS_DOWN = 9;
const STEPS_UP = 6;
const RISE_BACK0 = 70;
const RISE_BACK1 = 100;
/** Where the shaping starts past the limit (nothing at or inside it moves). */
const FROM = 0.3;
/** Metres kept from a landmark's footprint (any mood's), and from the start's stands. */
const SITE_KEEP = 40;
const START_KEEP = 8;
/** A stretch's ramps at its ends. */
const RAMP_IN = 34;
const RAMP_OUT = 46;
/** A fall comes in longer: over 34 m its first metres stood as a pale slab across the view from the air. */
const FALL_RAMP_IN = 80;
/** Frostfang's canyon stands up this far before the overlook it opens onto: only short, at the overlook's mouth (the
 *  critics on stills chose the open run, its lit floor and its long shadows, over the walls five times in six). */
const CANYON_BEFORE = 20;
/** A stretch shorter than this is not composed. */
const LEN_MIN = 90;
/** Ahead of a fall the mid-ground starts taking the valley form this far before, and holds it this far after, so the
 *  far mountainside never folds away in plain sight (overlook.ts WIDE). */
const WIDE_BEFORE = 180;
const WIDE_AFTER = 260;

const smooth = smoothK;

/** A fall's profile: metres over the bank's height at the limit, `t` metres past it. */
export function fallProf(t: number): number {
  const c = CORNICE * smooth(0, CORNICE_E, t);
  const u = t - CORNICE_E;
  if (u <= 0) return c;
  const uk = (FALL_MAX - FALL_S0) / (2 * FALL_K);
  const d = u < uk ? FALL_S0 * u + FALL_K * u * u : FALL_S0 * uk + FALL_K * uk * uk + FALL_MAX * (u - uk);
  return c - d;
}

/** A terraced bank's profile, stepping down (`dir` 1) or up the hill (-1): flats at the bank's height at the limit
 *  less a riser each, the risers steep and dressed. Past the last step a down flight carries on falling at the
 *  steps' own mean slope; an up flight levels out. */
export function stepsProf(t: number, dir: 1 | -1): number {
  const u = t - STEP_FIRST;
  if (u <= 0) return 0;
  const p = STEP_FLAT + STEP_RUN;
  const n = dir > 0 ? STEPS_DOWN : STEPS_UP;
  const k = Math.min(n, Math.floor(u / p));
  const f = u - k * p;
  let h = k * STEP_H;
  if (k < n) h += STEP_H * smooth(STEP_FLAT, p, f);
  else if (dir > 0) h += (STEP_H / p) * f;
  return -dir * h;
}

/** A wall's profile (crevasse ice, basalt): `h` metres over the bank at the limit, its crest broken into facets
 *  along the run, its face planed. */
export function wallProf(t: number, h: number, z: number, side: number): number {
  const up = Math.pow(smooth(FROM, WALL_UP, t), 0.8);
  const s = side > 0 ? 1 : 0;
  const crest = facetNoise(z / 8.5 + s * 31, t / 6, 401 + s);
  const fine = facetNoise(z / 3.3 + s * 13, t / 2.6, 409 + s);
  // (Its face in big planes, a shard of a few metres each, so a wall is cut ice or jointed basalt and never one slab.)
  const shard = facetNoise(z / 5.2 + s * 7, t / 3.4, 417 + s);
  return up * (h * (0.62 + 0.55 * crest) + 2.4 * fine + 4.5 * (shard - 0.5) * smooth(2, 7, t));
}

/** How much of a bank's shape holds `t` metres past the limit (a wall's and an up flight's backs give back to the
 *  bank, so the mid-ground past them is untouched). */
function holds(kind: BankKind, t: number): number {
  if (kind === 'wall') return 1 - smooth(WALL_BACK0, WALL_BACK1, t);
  if (kind === 'rise') return 1 - smooth(RISE_BACK0, RISE_BACK1, t);
  return 1;
}

function prof(seg: BankSeg, t: number, z: number): number {
  if (seg.kind === 'wall') return wallProf(t, seg.h, z, seg.side);
  if (seg.kind === 'fall') return fallProf(t);
  if (seg.kind === 'steps') return stepsProf(t, 1);
  if (seg.kind === 'rise') return stepsProf(t, -1);
  return 0;
}

/** A bank's weight over its stretch at sim z (0..1). */
export function segWeight(s: BankSeg, z: number): number {
  if (z <= s.z0 || z >= s.z1) return 0;
  return smooth(s.z0, s.z0 + s.rin, z) * (1 - smooth(s.z1 - s.rout, s.z1, z));
}

/** A bank's weight `t` metres past the limit: a fall's and a flight's far ground comes down over a longer stretch
 *  than its crest (FAR_RAMP more metres of run per metre out, up to half the stretch), so the cut's ends are long
 *  slopes across the view and never a cliff standing across the fall line. */
const FAR_RAMP = 1.4;
function reachWeight(s: BankSeg, z: number, t: number): number {
  if (s.kind !== 'fall' && s.kind !== 'steps') return segWeight(s, z);
  if (z <= s.z0 || z >= s.z1) return 0;
  const half = (s.z1 - s.z0) / 2;
  const rin = Math.min(half, s.rin + t * FAR_RAMP);
  const rout = Math.min(half, s.rout + t * FAR_RAMP);
  return smooth(s.z0, s.z0 + rin, z) * (1 - smooth(s.z1 - rout, s.z1, z));
}

/** What each mountain makes of a stretch. `valley` is the side that falls away there (the overlook's, or the
 *  mid-ground's valley side). */
function recipe(biome: BiomeId, at: 'opening' | 'stage', valley: -1 | 1): { look: Look; open: -1 | 0 | 1; stand: -1 | 0 | 1; banks: Array<{ side: 1 | -1; kind: BankKind; h: number }> } {
  const other = valley > 0 ? -1 : 1;
  switch (biome) {
    case 'alpine':
      return { look: 'valley', open: valley, stand: valley, banks: [{ side: valley, kind: 'fall', h: 0 }] };
    case 'glacier':
      // The opening is the canyon itself; a stage start is a wall over an abyss.
      if (at === 'opening') return { look: 'canyon', open: 0, stand: 0, banks: [{ side: -1, kind: 'wall', h: 30 }, { side: 1, kind: 'wall', h: 30 }] };
      return { look: 'ridge', open: valley, stand: other, banks: [{ side: valley, kind: 'fall', h: 0 }, { side: other, kind: 'wall', h: 26 }] };
    case 'volcanic':
      return { look: 'ridge', open: valley, stand: other, banks: [{ side: valley, kind: 'fall', h: 0 }, { side: other, kind: 'wall', h: 11 }] };
    case 'blossom':
      // (The lens turns a little toward the open side, so the hero cone stands off the frame's middle and the flight up
      // the hill fills the far side.)
      return { look: 'terraces', open: valley, stand: 0, banks: [{ side: valley, kind: 'steps', h: 0 }, { side: other, kind: 'rise', h: 0 }] };
    case 'lantern':
    default:
      return { look: 'crest', open: 0, stand: 0, banks: [{ side: -1, kind: 'fall', h: 0 }, { side: 1, kind: 'fall', h: 0 }] };
  }
}

/** Where the plan reads the course's landmarks and overlooks from (overlook.ts OverlookPlan): what any mood's plan
 *  stands, and the overlooks' open sides. */
export interface ComposeSource {
  sites(): readonly Site[];
  overlooks(): ReadonlyArray<{ z0: number; z1: number; side: -1 | 0 | 1 }>;
}

/**
 * A course's composed places, planned at the first asking (a few sections and the landmark plans the overlooks have
 * already laid). Deterministic: the course and its plans only.
 */
export class ComposePlan {
  /** The looks' table (LOOKS), for a tuning probe. */
  readonly looks = LOOKS;
  private list: Composed[] = [];
  private segs: BankSeg[] = [];
  private done = false;
  /** The span any bank is shaped over (sim z), for a quick miss. */
  private lo = Infinity;
  private hi = -Infinity;

  constructor(
    readonly course: Course,
    private src: ComposeSource,
  ) {}

  get planned(): readonly Composed[] {
    this.plan();
    return this.list;
  }

  private plan(): void {
    if (this.done) return;
    this.done = true;
    const c = this.course;
    // (Round 9: the Old Run composes its own places in its own world, oldrunworld.ts: its banks are never reshaped.)
    if (c.kit?.id === 'oldrun') return;
    const secs: Section[] = [];
    for (let z = 0; z < c.finishZ; ) {
      const s = c.section(z);
      secs.push(s);
      z = s.z1;
    }
    const sites = this.src.sites();
    const looks = this.src.overlooks();
    const spans: Array<[number, number, 'opening' | 'stage']> = [];
    // The opening: from the start's stands to the first leap.
    const start = secs[0];
    const leap = secs.find((s) => s.kind === 'leap' || s.kind === 'terraces');
    if (start && start.kind === 'start' && leap) spans.push([start.z1, leap.z0, 'opening']);
    // Each stage start: the threshold under its charm gate.
    for (const s of secs) if (s.gate) spans.push([s.z0, s.z1, 'stage']);
    for (const [a0, b0, at] of spans) {
      let a = a0;
      let b = b0;
      for (const st of sites) {
        const keep = st.kind === 'start' ? START_KEEP : SITE_KEEP;
        const s0 = st.z - st.len - keep;
        const s1 = st.z + st.len + keep;
        if (s1 <= a || s0 >= b) continue;
        // (A site inside the stretch keeps the longer half of it.)
        if (st.z <= (a + b) / 2) a = Math.max(a, s1);
        else b = Math.min(b, s0);
      }
      if (b - a < LEN_MIN) continue;
      // The side the valley falls on here: the overlook's, else the mid-ground's own.
      let valley: -1 | 1 = flankMode(c.seed, (a + b) / 2, -1) <= flankMode(c.seed, (a + b) / 2, 1) ? -1 : 1;
      let best = 0;
      for (const o of looks) {
        const ov = Math.min(b, o.z1) - Math.max(a, o.z0);
        if (o.side !== 0 && ov > best) {
          best = ov;
          valley = o.side;
        }
      }
      const r = recipe(c.biome, at, valley);
      const n = this.list.length;
      const banks: BankSeg[] = r.banks.map((k) => ({ side: k.side, kind: k.kind, z0: a, z1: b, rin: Math.min(k.kind === 'fall' ? FALL_RAMP_IN : RAMP_IN, (b - a) / 3), rout: Math.min(RAMP_OUT, (b - a) / 3), h: k.h }));
      // Frostfang's opening: the valley side's wall breaks off where the overlook there opens, and the mountain falls
      // away out of the canyon's mouth (the overlook's own lip gives way to it).
      if (c.biome === 'glacier' && at === 'opening') {
        const o = looks.find((l) => l.side !== 0 && l.z1 > a && l.z0 < b);
        if (o) {
          const mouth = Math.max(a + LEN_MIN, Math.min(b - 60, o.z1 - 20));
          const w = banks.find((k) => k.side === o.side);
          if (w) {
            w.z1 = mouth + 20;
            w.rout = 40;
            // (And it stands up only a little before the overlook: the run in from the start keeps its lit floor and
            // the long shadows down it, which three critics on stills preferred to walls the whole way; the canyon
            // frames the reveal at its foot.)
            const from = Math.max(a, Math.min(mouth - LEN_MIN, o.z0 - CANYON_BEFORE));
            for (const k of banks) if (k.kind === 'wall') k.z0 = from;
            banks.push({ side: o.side as 1 | -1, kind: 'fall', z0: mouth - 10, z1: b, rin: 40, rout: Math.min(RAMP_OUT, (b - mouth) / 3), h: 0 });
          }
        }
      }
      this.list.push({ n, at, z0: a, z1: b, look: r.look, open: r.open, stand: r.stand, banks });
      for (const k of banks) {
        this.segs.push(k);
        this.lo = Math.min(this.lo, k.z0);
        this.hi = Math.max(this.hi, k.z1);
      }
    }
  }

  /** Metres the drawn ground at sim (x, z) stands over (+) or under (-) the sim's `g` (its ground there): zero at
   *  and inside the limit and away from the composed stretches. */
  delta(x: number, z: number, g: number): number {
    this.plan();
    if (z <= this.lo || z >= this.hi) return 0;
    const c = this.course;
    const cx = c.centerX(z);
    const hw = c.halfWidth(z);
    const off = x - cx;
    const side = off < 0 ? -1 : 1;
    const lim = c.shapeAt(z).limit;
    const t = Math.abs(off) - hw - lim;
    if (t <= FROM) return 0;
    let acc = 0;
    let ref = NaN;
    for (const s of this.segs) {
      if (s.side !== side || s.kind === 'none') continue;
      const w = reachWeight(s, z, t);
      if (w <= 0) continue;
      const k = holds(s.kind, t) * smooth(FROM, FROM + 0.6, t);
      if (k <= 0) continue;
      if (Number.isNaN(ref)) ref = c.ground(cx + side * (hw + lim), z);
      acc += w * k * (ref + prof(s, t, z) - g);
    }
    return acc;
  }

  /** How bare a composed face is at sim (x, z): 0 snow, 1 rock (a wall's ice or basalt, a riser's dressed stone,
   *  a fall's face where it steepens past snow's hold). From the face's own slope. */
  rock(x: number, z: number): number {
    this.plan();
    if (z <= this.lo || z >= this.hi) return 0;
    const c = this.course;
    const off = x - c.centerX(z);
    const side = off < 0 ? -1 : 1;
    const t = Math.abs(off) - c.halfWidth(z) - c.shapeAt(z).limit;
    if (t <= FROM) return 0;
    let r = 0;
    for (const s of this.segs) {
      if (s.side !== side) continue;
      const w = segWeight(s, z);
      if (w <= 0) continue;
      // (The face as drawn, at its weight: where a stretch ramps in, a fall's face is a gentle slope of snow, not a
      // pale slab of rock seen side on from the air.)
      const slope = (w * Math.abs(prof(s, t + 0.4, z) - prof(s, t - 0.4, z))) / 0.8;
      const k = s.kind === 'wall' ? smooth(0.7, 1.3, slope) * holds(s.kind, t) : s.kind === 'fall' ? smooth(1.15, 1.7, slope) : smooth(0.6, 1.1, slope);
      r = Math.max(r, k);
    }
    return r;
  }

  /** How fully sim z's `side` is shaped here (0..1): the overlook's own drop gives way by this much. */
  shaped(z: number, side: number): number {
    this.plan();
    if (z <= this.lo || z >= this.hi) return 0;
    let w = 0;
    for (const s of this.segs) if (s.side === side && s.kind !== 'none') w = Math.max(w, segWeight(s, z));
    return w;
  }

  /** The kind the bank on `side` mostly is at sim z ('none' away from a composed place). */
  kindAt(z: number, side: number): BankKind {
    this.plan();
    if (z <= this.lo || z >= this.hi) return 'none';
    let w = 0;
    let k: BankKind = 'none';
    for (const s of this.segs) {
      const sw = s.side === side ? segWeight(s, z) : 0;
      if (sw > w) {
        w = sw;
        k = s.kind;
      }
    }
    return w > 0.3 ? k : 'none';
  }

  /** Where the mid-ground takes the valley form on `side` (0..1): round a fall or a down flight, eased in well
   *  before it and out well after. */
  wide(z: number, side: number): number {
    this.plan();
    if (z <= this.lo - WIDE_BEFORE || z >= this.hi + WIDE_AFTER) return 0;
    let w = 0;
    for (const s of this.segs) {
      if (s.side !== side || (s.kind !== 'fall' && s.kind !== 'steps')) continue;
      w = Math.max(w, smooth(s.z0 - WIDE_BEFORE, s.z0 + s.rin, z) * (1 - smooth(s.z1 - s.rout, s.z1 + WIDE_AFTER, z)));
    }
    return w;
  }

  /** The ground the forest and the dressing keep off between sim z0 and z1 (props.ts siteKeep): a wall's face and
   *  crest, a fall's cornice and steep face, each riser of a flight (its flats are planted). */
  keeps(z0: number, z1: number, out: Clearing[]): void {
    this.plan();
    if (z1 <= this.lo || z0 >= this.hi) return;
    const lim = 10;
    for (const s of this.segs) {
      if (s.z1 < z0 - 10 || s.z0 > z1 + 10 || s.kind === 'none') continue;
      const a = s.z0 + s.rin * 0.25;
      const b = s.z1 - s.rout * 0.25;
      if (s.kind === 'wall') out.push({ side: s.side, e: lim + WALL_BACK0 / 2 + 2, z0: a, z1: b, w: WALL_BACK0 / 2 + 2 });
      // (Only the crest: past it the forest stands on down the fall, dark ranks below the rail, as a critic on stills
      // asked when the cleared face read as a bare bank.)
      else if (s.kind === 'fall') out.push({ side: s.side, e: lim + 3, z0: a, z1: b, w: 3.2 });
      else {
        const n = s.kind === 'steps' ? STEPS_DOWN : STEPS_UP;
        for (let k = 0; k < n; k++) {
          const e = lim + STEP_FIRST + k * (STEP_FLAT + STEP_RUN) + STEP_FLAT + STEP_RUN / 2;
          out.push({ side: s.side, e, z0: a, z1: b, w: STEP_RUN / 2 + 1.4 });
        }
      }
    }
  }

  /** The composed place at sim z and its weight there (its strongest bank's), or null. */
  at(z: number): { c: Composed; w: number } | null {
    this.plan();
    if (z <= this.lo || z >= this.hi) return null;
    for (const p of this.list) {
      if (z <= p.z0 || z >= p.z1) continue;
      let w = 0;
      for (const s of p.banks) w = Math.max(w, segWeight(s, z));
      return { c: p, w };
    }
    return null;
  }

  /** The directed shots (game/shots.ts) with each place shot given the sides of the composed place it opens on (the
   *  nearest within 80 m of its start): where none is composed (a course whose opening has no room) it is dropped. */
  sideShots<T extends { kind: string; at: number; z1: number; open?: number; stand?: number }>(shots: T[]): T[] {
    this.plan();
    const out: T[] = [];
    for (const sh of shots) {
      if (sh.kind !== 'place') {
        out.push(sh);
        continue;
      }
      const p = this.list.find((q) => sh.at > q.z0 - 80 && sh.at < q.z1);
      if (!p) continue;
      sh.open = p.open;
      sh.stand = p.stand;
      out.push(sh);
    }
    return out;
  }

  /** The lens's placement at sim z (camera.ts CamTarget.place), written into `out` at the place's weight: zero
   *  away from a composed place. Signs: `aside` and `yaw` are toward three.js +x. */
  place(z: number, out: LookSet): LookSet {
    const p = this.at(z);
    const w = p ? p.w : 0;
    const L = p ? LOOKS[p.c.look] : LOOKS.valley;
    out.up = L.up * w;
    out.back = L.back * w;
    out.aside = p ? L.aside * w * p.c.stand : 0;
    out.yaw = p ? L.yaw * w * p.c.open : 0;
    out.horizon = L.horizon * w;
    out.row = L.row * w;
    return out;
  }
}

/** The course's plan, made once and registered with ground.ts so whatever stands past the limit stands on what is
 *  drawn (visualGround). */
export function composeFor(course: Course, src: ComposeSource): ComposePlan {
  const p = new ComposePlan(course, src);
  shapeGround(course, (x, z, g) => p.delta(x, z, g));
  return p;
}
