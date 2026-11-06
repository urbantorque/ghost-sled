import type { Mood } from '../sim/chaos';
import type { Course, Section, SectionKind } from '../sim/course';
import type { BiomeId } from '../sim/mountains';

// What the soundscape hears of the world: the places and the life near the rider, reduced each frame
// to a few numbers (how present, which side, ahead or behind) that scape.ts turns into levels, pans
// and one-shots. Pure and allocation-free; the world hands it read-only views of what it already
// keeps (World.listenSources): the set-piece plan, the bird flocks, the lift lines, the villages'
// chimneys, the camera's vista.
//
// Places are read by their kind, so a new kind only needs a line in PLACES: a crowd (and how big),
// a bustle (a ride-through village), a bell rung once as you come, an enclosure (a gallery or a
// tunnel: the echo send and the entry and exit whooshes). An unknown kind is silent.

/** A set piece as the plan keeps it (landmarks.ts Site). A long site (a village street, a gallery, a
 *  tunnel) covers sim z - len to z + len; without `len` (or at 0) PLACES gives its half length. */
export interface SiteLike {
  readonly n: number;
  readonly kind: string;
  readonly span: boolean;
  readonly side: number;
  readonly z: number;
  readonly x: number;
  readonly len?: number;
}

/** A bird flock (life.ts): the sim z it wheels over, its bank side, its size and whether it is the
 *  high crossing flock. */
export interface FlockLike {
  readonly z: number;
  readonly side: number;
  readonly n: number;
  readonly cross: boolean;
}

export interface ListenSources {
  course: Pick<Course, 'centerX' | 'halfWidth' | 'section'> & { readonly params: { readonly halfWidthStart: number }; readonly stages?: readonly { readonly z0: number; readonly z1: number }[] };
  biome: BiomeId;
  mood: Mood;
  tier: 'low' | 'medium' | 'high';
  /** The set-piece plan so far, in z order. */
  sites: readonly SiteLike[];
  /** The crowds are drawn (Medium and High). */
  crowds: boolean;
  flocks: readonly FlockLike[];
  birds: 'crow' | 'crane' | 'owl' | null;
  /** The chairs run on the lift lines (Medium and High). */
  lifts: boolean;
  lift(sec: Section): { side: number; e: number; z0: number; z1: number } | null;
  /** The standing villages' chimney tops (three.js world space: z is minus sim z), and how many. */
  chimneys: ReadonlyArray<{ readonly x: number; readonly z: number }>;
  chimneyCount: number;
  /** The camera's big-air vista (0..1). */
  vista: number;
  /** 0 by day, rising through the alpenglow, 1 at blue hour and on night moods. */
  dusk: number;
  night: boolean;
}

/** What one kind of place sounds like. */
export interface PlaceSound {
  /** Its crowd's size (0: none). A span's lines both banks; a bank piece's mostly its own. */
  crowd?: number;
  /** A ride-through village's bustle (0..1). */
  bustle?: number;
  /** Rung once as you come within 140 m (a church bell is a temple bell at Sakura). */
  bell?: 'church' | 'temple';
  /** Roofed over the run (1 a gallery or a tunnel; less for a corridor of open gates): the echo's
   *  strength inside it, and the whooshes through its mouths. */
  roof?: number;
  /** A long site's half length along the run, where the site does not give one. */
  half?: number;
}

/** The kinds of place, by the plan's name (landmarkKit.ts Kind, and the long sites of town.ts). */
export const PLACES: Readonly<Record<string, PlaceSound>> = {
  gate: { crowd: 1 },
  bridge: { crowd: 0.9 },
  torii: { crowd: 0.9, bell: 'temple' },
  basalt: { crowd: 0.8 },
  hut: { crowd: 0.75 },
  jump: { crowd: 1 },
  pagoda: { crowd: 0.7, bell: 'temple' },
  village: { crowd: 0.35, bustle: 1, bell: 'church', half: 60 },
  town: { crowd: 0.35, bustle: 1, bell: 'church', half: 60 },
  gallery: { roof: 1, half: 45 },
  icetunnel: { roof: 1, half: 40 },
  lavatunnel: { roof: 1, half: 40 },
  tunnel: { roof: 1, half: 40 },
  toriirow: { roof: 0.35, half: 50, bell: 'temple' },
  finish: { crowd: 1, bustle: 1, bell: 'church', half: 270 },
  start: { crowd: 0.7, half: 60 },
  lip: { crowd: 0.7 },
  lift: { crowd: 0.3 },
  viaduct: { half: 50 },
};

/** How open a section's banks are: a bowl or benches open to the sky, a gully shelters you. */
const OPEN: Readonly<Record<SectionKind, number>> = { bowl: 1, benches: 0.8, cruise: 0.55, split: 0.5, switchbacks: 0.45, chute: 0.3, gully: 0.1, start: 0.6, ravine: 0.05, treerun: 0.2, lake: 1, fork: 0.4, street: 0.25, bridge: 0.9, tunnel: 0, terraces: 0.7, leap: 0.8, finish: 0.5 };

/** The longest half length a long site is looked for at (a site may give its own up to this). */
const LONG_MAX = 120;
/** Crowds stand past the corridor's edge (landmarks.ts BANK_KEEP plus their rows). */
const CROWD_E = 10.5;
/** A flock wheels this far past the edge (a crossing flock much further, and high). */
const FLOCK_E = 20;
const CROSS_E = 100;

export interface ScapeView {
  /** The nearest crowd: presence (0..1, its size over distance), pan (-1 left .. 1 right), how far
   *  behind you it is (0 ahead or abreast .. 1 well behind: darker), and wide (a span's: both banks). */
  crowd: number;
  crowdPan: number;
  crowdBehind: number;
  crowdWide: boolean;
  /** A ride-through village's bustle (0..1). */
  bustle: number;
  /** A bell to ring now: a place just came within reach (null: none this frame). */
  bell: 'church' | 'temple' | null;
  bellPan: number;
  /** Inside a gallery or a tunnel (0..1, eased over its mouth). */
  enclosed: number;
  /** The nearest flock: presence, pan and its distance (m). */
  flock: number;
  flockPan: number;
  flockD: number;
  /** A lift line beside the run: presence and pan. */
  lift: number;
  liftPan: number;
  /** The nearest village (valley or flank): presence over a kilometre, and pan. */
  village: number;
  villagePan: number;
  /** How exposed the rider is (0 sheltered .. 1 open: the section's banks and the height in the air). */
  exposure: number;
  vista: number;
  dusk: number;
  night: boolean;
}

export function newView(): ScapeView {
  return { crowd: 0, crowdPan: 0, crowdBehind: 0, crowdWide: false, bustle: 0, bell: null, bellPan: 0, enclosed: 0, flock: 0, flockPan: 0, flockD: Infinity, lift: 0, liftPan: 0, village: 0, villagePan: 0, exposure: 0, vista: 0, dusk: 0, night: false };
}

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
/** 1 at or inside `near`, 0 at or past `far` (near < far), smooth between. */
function within(d: number, near: number, far: number): number {
  const t = clamp01((far - d) / (far - near));
  return t * t * (3 - 2 * t);
}
/** A source `lat` metres to the side and `d` metres away pans by the angle it subtends: ahead it sits
 *  near the middle, abreast it is hard to its side. */
function panOf(lat: number, d: number): number {
  const p = lat / Math.max(d, 6);
  return p > 0.95 ? 0.95 : p < -0.95 ? -0.95 : p;
}

export class Listener {
  /** Sites whose bell has rung (by n), so each rings once a run. */
  private rung = new Set<number>();
  private sites: readonly SiteLike[] | null = null;

  /** A new run: every bell may ring again. */
  reset(): void {
    this.rung.clear();
  }

  /**
   * Fills `out` for a rider at sim (x, z), `height` metres over the snow. Reads every source in
   * place; makes nothing.
   */
  hear(src: ListenSources, x: number, z: number, height: number, out: ScapeView): ScapeView {
    const c = src.course;
    if (src.sites !== this.sites) {
      // A new plan (a new course or mood: the plan keeps one list and only adds to it): its sites are
      // numbered afresh.
      this.rung.clear();
      this.sites = src.sites;
    }
    out.crowd = 0;
    out.crowdPan = 0;
    out.crowdBehind = 0;
    out.crowdWide = false;
    out.bustle = 0;
    out.bell = null;
    out.bellPan = 0;
    out.enclosed = 0;
    // Places: the plan is in z order (by centre), so only those within 200 m of their ends are
    // looked at closely.
    for (const s of src.sites) {
      const dz = s.z - z;
      if (dz < -LONG_MAX - 200) continue;
      if (dz > LONG_MAX + 200) break;
      const p = PLACES[s.kind];
      if (!p) continue;
      // A long site covers z - half to z + half: how far outside it the rider is (0 inside), and how
      // far past its far end.
      const half = s.len && s.len > 0 ? s.len : (p.half ?? 0);
      const out1 = Math.max(0, Math.abs(dz) - half);
      if (out1 > 200) continue;
      const past = -(dz + half);
      if (p.roof) out.enclosed = Math.max(out.enclosed, p.roof * within(Math.abs(dz), half - 3, half + 3));
      if (p.bustle) out.bustle = Math.max(out.bustle, p.bustle * within(out1, 0, 140));
      if (p.bell && !this.rung.has(s.n) && dz - half < 140 && past < 0) {
        this.rung.add(s.n);
        out.bell = p.bell === 'church' && src.biome === 'blossom' ? 'temple' : p.bell;
        out.bellPan = s.span || half > 0 ? 0 : s.side * 0.5;
      }
      // A crowd is only heard where it is drawn.
      if (p.crowd && src.crowds) {
        const wide = s.span || half > 0;
        // A span's crowd lines both banks, and a street's both sides: heard from the middle. A bank
        // piece's stands on its side.
        const lat = wide ? 0 : c.centerX(s.z) + s.side * (c.halfWidth(s.z) + CROWD_E) - x;
        const d = Math.hypot(out1, lat);
        const k = p.crowd * within(d, 22, 150);
        if (k > out.crowd) {
          out.crowd = k;
          out.crowdPan = wide ? 0 : panOf(lat, d);
          out.crowdBehind = past > 0 ? within(past, 60, 0) : 0;
          out.crowdWide = wide;
        }
      }
    }
    // Birds.
    out.flock = 0;
    out.flockPan = 0;
    out.flockD = Infinity;
    if (src.birds) {
      for (const f of src.flocks) {
        if (f.n <= 0) continue;
        const lat = c.centerX(f.z) + f.side * (c.halfWidth(f.z) + (f.cross ? CROSS_E : FLOCK_E)) - x;
        const d = Math.hypot(f.z - z, lat, f.cross ? 55 : 15);
        if (d >= out.flockD) continue;
        out.flockD = d;
        out.flock = within(d, 30, 170) * (f.cross ? 0.6 : 1);
        out.flockPan = panOf(lat, d);
      }
    }
    // A lift line: its cable runs beside the run between z0 and z1.
    out.lift = 0;
    out.liftPan = 0;
    if (src.lifts) {
      const sec = c.section(z);
      const l = src.lift(sec);
      if (l) {
        const dz = z < l.z0 ? l.z0 - z : z > l.z1 ? z - l.z1 : 0;
        const lat = c.centerX(z) + l.side * (c.halfWidth(z) + l.e) - x;
        const d = Math.hypot(dz, lat);
        out.lift = within(d, 12, 90);
        out.liftPan = panOf(lat, d);
      }
    }
    // Villages, by their chimneys (world space: sim z is -z).
    out.village = 0;
    out.villagePan = 0;
    let best = Infinity;
    for (let i = 0; i < src.chimneyCount && i < src.chimneys.length; i++) {
      const ch = src.chimneys[i];
      const lat = ch.x - x;
      const d = Math.hypot(lat, -ch.z - z);
      if (d >= best) continue;
      best = d;
      out.village = within(d, 220, 1100);
      out.villagePan = panOf(lat, d) * 0.8;
    }
    // Exposure: the section's banks, wide stretches, and the air under you.
    const sec = c.section(z);
    const wide = clamp01((c.halfWidth(z) / Math.max(1, c.params.halfWidthStart) - 0.8) / 0.8);
    const air = clamp01((height - 1.5) / 10);
    out.exposure = clamp01(Math.max(OPEN[sec.kind] * 0.7 + wide * 0.3, air) * (1 - out.enclosed));
    out.vista = clamp01(src.vista);
    out.dusk = clamp01(src.dusk);
    out.night = src.night;
    return out;
  }
}
