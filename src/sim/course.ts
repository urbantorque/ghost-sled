import { TAU, clamp, dcos, dsin, lerp, smoothstep } from './dmath';
import { BiomeId, MountainParams, isNamedSeed, paramsForSeed } from './mountains';
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
  /** An authored kicker on the safe line, with a clear landing. Scattered ones stay off the line. */
  online?: boolean;
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

/** A rail a sled can grind: a straight bar, rising from the snow at (x0, z0), h metres over it at the far
 *  end. Decorative until the sim rides it; never a collider. */
export interface Rail {
  id: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
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
  /** Keeps obstacles out, but a vent may stand here. */
  vents?: boolean;
}

export interface Zones {
  ramps: Ramp[];
  drops: Drop[];
  moguls: Moguls[];
  ice: IcePatch[];
  vents: Vent[];
  rails: Rail[];
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

const SNOW: Surface = { grip: 1, drag: 1, ice: false };
const PATCH_ICE: Surface = { grip: 0.45, drag: 0.82, ice: true };
/** A frozen lake, or the fork's strip: slick, and the speed carries. */
const GLASS: Surface = { grip: 0.5, drag: 0.25, ice: true };

/** A run has an end. Stages are the descent's chapters; the last one ends on the finish line. */
export interface Stage {
  index: number;
  name: string;
  z0: number;
  z1: number;
}

/** The descent's length: the stages' metres in order (the finish line is at their sum). */
export const STAGE_LENGTHS: readonly number[] = [1450, 1500, 1550];
/** Easy ground past the finish line, where a sled coasts to a stop in the town square. */
export const RUN_OUT = 260;
/** The last metres before the finish line: the town square. */
export const FINISH_SQUARE = 300;

/** A place the ground steps down: a leap's cliff, one of a terrace's steps, or a lake's outlet. It lives
 *  in baseY, so the ground stays down past it. */
export type LedgeKind = 'leap' | 'step' | 'outlet';

export interface Ledge {
  kind: LedgeKind;
  /** The lip. */
  z: number;
  /** The foot of the face. */
  foot: number;
  /** Lip to foot, metres of ground fallen. */
  height: number;
  /** Where sleds come down: nothing stands across the corridor between these. */
  land0: number;
  land1: number;
  /** The brow: how far the lip stands over the plain slope, and the run-up it takes. */
  kick: number;
  kickLen: number;
  /** The plain slope the ledge is cut into. */
  grade: number;
  /** Metres under the plain slope at the foot, and under it for good once the landing is over. */
  sink: number;
  total: number;
  /** The landing face: its slope at the foot, how fast that steepens, where it stops steepening, how
   *  long it holds and how long it takes to ease back to the plain slope. None on a step. */
  face0: number;
  faceBend: number;
  faceEnd: number;
  faceHold: number;
  faceEase: number;
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
 * Sections give a course its shape and its places. Each comes from the biome's authored script
 * (SCRIPTS below), the seed choosing its order and length inside the script's rules, and blends in from
 * the last one over its own `blend` metres; z0 + blend is where its body starts:
 *   start        the steep ramp out of the gate
 *   cruise       the plain corridor, never for long
 *   chute        steeper, narrower and straighter: speed, fewer kickers
 *   bowl         a wide, gentler basin, open, with kickers and moguls
 *   switchbacks  tight S-bends at a shorter wavelength
 *   benches      flatter terraces over rollers (they lift a boosted sled off the crests)
 *   gully        narrow between high banks, few obstacles
 *   split        wide, with a line of trees down the middle: the safe line takes one side
 *   ravine       a slot between rock walls, fast and steep
 *   treerun      narrow, the trees standing right beside the lane
 *   lake         flat, very wide, an ice sheet that carries speed, and a lip at its far end
 *   fork         two channels either side of a ridge: safeX takes one, altX the faster, riskier other
 *   street       gentle and narrow between houses: no kickers, no vents
 *   bridge       a narrow deck over a fall: nothing on it
 *   tunnel       under a roof: gentle bends, and nothing launches in it or for 120 m uphill of it
 *   terraces     a stair of steps, spaced to be jumped one to the next
 *   leap         a cliff across the corridor, and the steep landing face under it
 *   finish       the town square over the finish line, and the run-out
 */
export type SectionKind =
  | 'cruise'
  | 'chute'
  | 'bowl'
  | 'switchbacks'
  | 'benches'
  | 'gully'
  | 'split'
  | 'start'
  | 'ravine'
  | 'treerun'
  | 'lake'
  | 'fork'
  | 'street'
  | 'bridge'
  | 'tunnel'
  | 'terraces'
  | 'leap'
  | 'finish';
export const SECTION_KINDS: readonly SectionKind[] = [
  'cruise',
  'chute',
  'bowl',
  'switchbacks',
  'benches',
  'gully',
  'split',
  'start',
  'ravine',
  'treerun',
  'lake',
  'fork',
  'street',
  'bridge',
  'tunnel',
  'terraces',
  'leap',
  'finish',
];
/** What a section does to the course. `slope`, `wander`, `wave`, `span`, `obstacles`, `kickers`,
 *  `moguls`, `drops` and `relief` are multipliers (1 = the plain corridor); the rest are as noted. */
export interface SectionShape {
  slope: number;
  /** Metres added to the half-width (what is left of the plain corridor after `pin`). */
  width: number;
  wander: number;
  wave: number;
  span: number;
  /** Share of the half-width the safe line moves to one side. */
  split: number;
  /** Roller height, metres. */
  roller: number;
  obstacles: number;
  kickers: number;
  moguls: number;
  drops: number;
  /** Share of the plain corridor's width the section replaces: at 1 the half-width is `width` itself. */
  pin: number;
  /** Metres of rock wall added past the edge (see WALL_FOOT and WALL_TOP). */
  wall: number;
  /** Metres the ground falls away past the edge (see FALL_LIP and FALL_RUN). */
  fall: number;
  /** The share of the ground's noise that survives. */
  relief: number;
  /** Metres past the edge at which something solid stands: edgeLimit. */
  limit: number;
  /** 1 when the whole corridor is ice. */
  ice: number;
  /** The fork's ridge, metres. */
  ridge: number;
  /** Metres added to the room obstacles leave beside the safe lane. */
  lane: number;
  /** Set per section from `split` and `span` and its width: how far the safe line stands off the centre,
   *  and how far it may wander either side of that. In metres, so a blend moves the line evenly: as
   *  shares of a width that is itself blending they would multiply up into a bend at the blend's end. */
  shift: number;
  reach: number;
}

const PLAIN: SectionShape = {
  slope: 1,
  width: 0,
  wander: 1,
  wave: 1,
  span: 1,
  split: 0,
  roller: 0,
  obstacles: 1,
  kickers: 1,
  moguls: 1,
  drops: 1,
  pin: 0,
  wall: 0,
  fall: 0,
  relief: 1,
  limit: FOREST_LIMIT,
  ice: 0,
  ridge: 0,
  lane: 0,
  shift: 0,
  reach: 0,
};
const BARE = { kickers: 0, moguls: 0, drops: 0 };
const shaped = (s: Partial<SectionShape>): SectionShape => ({ ...PLAIN, ...s });

/** How far a ravine or tunnel wall takes to rise, in metres past the edge. */
const WALL_FOOT = 0.5;
const WALL_TOP = 6;
/** How far past the edge the ground lets go, and where it has finished falling. */
const FALL_LIP = 1;
const FALL_RUN = 9;
/** A fall this deep has taken the whole bank with it. */
const FALL_FULL = 10;
/** The fork's ridge: its height, the crest's half-width and where its flanks meet the channels. */
const RIDGE_H = 3.2;
const RIDGE_CREST = 0.6;
const RIDGE_RUN = 5.4;
/** The ice strip down the fork's risk channel, half-width in metres. */
const STRIP = 4.2;

const SHAPES: Record<SectionKind, SectionShape> = {
  cruise: shaped({}),
  start: shaped({ wander: 0.3, span: 0.35, obstacles: 0, ...BARE }),
  chute: shaped({ slope: 1.55, width: -4, wander: 0.35, wave: 1.7, span: 0.5, obstacles: 0.75, kickers: 0.4, moguls: 0.4, drops: 1.4 }),
  bowl: shaped({ slope: 0.66, width: 8, wander: 0.4, wave: 1.3, span: 0.8, obstacles: 0.8, kickers: 1.7, moguls: 1.5, drops: 0.3 }),
  switchbacks: shaped({ slope: 0.92, width: -1, wander: 0.62, wave: 0.55, span: 0.45, obstacles: 0.85, kickers: 0.8, moguls: 0.8, drops: 0.4 }),
  benches: shaped({ slope: 0.72, width: 2, wander: 0.7, span: 0.9, roller: 1.1, obstacles: 0.8, kickers: 1.2, moguls: 0.3, drops: 0, relief: 0.65 }),
  gully: shaped({ slope: 1.28, width: -5.5, wander: 0.6, span: 0.5, obstacles: 0.6, kickers: 0.5, drops: 0.6 }),
  split: shaped({ width: 6, wander: 0.5, wave: 1.2, span: 0.35, split: 0.42, obstacles: 0.6, kickers: 0.7, moguls: 0.5, drops: 0 }),
  ravine: shaped({ pin: 1, wander: 0.4, wave: 1.6, span: 0.2, obstacles: 0, wall: 13, relief: 0.4, limit: 5, ...BARE }),
  treerun: shaped({ pin: 1, wander: 0.5, wave: 1.1, span: 0.3, obstacles: 0.25, relief: 0.6, limit: 7, ...BARE }),
  lake: shaped({ pin: 1, wander: 0.25, wave: 1.6, span: 0.25, obstacles: 0.3, relief: 0, ice: 1, lane: 5.6, ...BARE }),
  fork: shaped({ pin: 1, wander: 0.4, wave: 1.4, span: 0.08, split: 0.55, obstacles: 0.45, relief: 0.35, ridge: RIDGE_H, ...BARE }),
  street: shaped({ pin: 1, wander: 0.3, wave: 1.4, span: 0.25, obstacles: 0.15, relief: 0.2, limit: 2, ...BARE }),
  bridge: shaped({ pin: 1, wander: 0.15, wave: 2, span: 0.08, obstacles: 0, fall: 34, relief: 0.15, limit: 0.8, ...BARE }),
  tunnel: shaped({ pin: 1, wander: 0.35, wave: 1.5, span: 0.2, obstacles: 0.15, wall: 6, relief: 0.35, limit: 3, ...BARE }),
  // A flight runs straight over the ground, and a line bending only 0.0005 under one is 9 m away by the
  // end of a 190 m flight. So these freeze the bend's phase (`wave`) and drop the line's own wander.
  terraces: shaped({ pin: 0.5, width: 8, wander: 0.25, wave: 8, span: 0.05, obstacles: 0.2, relief: 0.2, ...BARE }),
  leap: shaped({ pin: 0.5, width: 8, wander: 0.2, wave: 14, span: 0, obstacles: 0.3, relief: 0.3, ...BARE }),
  finish: shaped({ pin: 1, wander: 0.15, wave: 2, span: 0.15, obstacles: 0, relief: 0.2, limit: 3, ...BARE }),
};

/** The ground's real gradient for the kinds that promise one; the rest scale the mountain's own slope. */
const GRADE: Partial<Record<SectionKind, readonly [number, number]>> = {
  start: [0.5, 0.5],
  ravine: [0.38, 0.42],
  treerun: [0.27, 0.33],
  lake: [0.03, 0.045],
  fork: [0.28, 0.32],
  street: [0.18, 0.22],
  bridge: [0.12, 0.16],
  tunnel: [0.28, 0.32],
  terraces: [0.1, 0.1],
  leap: [0.38, 0.42],
  finish: [0.08, 0.08],
};

/** The half-width of the kinds that pin it. */
const WIDTH: Partial<Record<SectionKind, readonly [number, number]>> = {
  ravine: [6.2, 7.8],
  treerun: [8.2, 9.8],
  lake: [26, 27],
  fork: [15.5, 16.5],
  street: [8.2, 9.8],
  bridge: [5.2, 5.8],
  tunnel: [7.2, 8.8],
  finish: [11.6, 12.4],
};

const BLEND: Record<SectionKind, number> = {
  cruise: 90,
  start: 1,
  chute: 90,
  bowl: 100,
  switchbacks: 110,
  benches: 100,
  gully: 90,
  split: 110,
  ravine: 90,
  treerun: 80,
  lake: 100,
  fork: 120,
  street: 80,
  bridge: 80,
  tunnel: 80,
  terraces: 80,
  leap: 100,
  finish: 100,
};

/** The metres of a section's body past its blend. Terraces and leaps work theirs out from what they hold. */
const BODY: Record<SectionKind, readonly [number, number]> = {
  cruise: [50, 140],
  start: [120, 120],
  chute: [90, 180],
  bowl: [100, 190],
  switchbacks: [130, 190],
  benches: [120, 200],
  gully: [90, 170],
  split: [90, 170],
  ravine: [190, 290],
  treerun: [120, 210],
  lake: [140, 210],
  fork: [190, 250],
  street: [120, 200],
  bridge: [85, 135],
  tunnel: [140, 210],
  terraces: [178, 256],
  leap: [232, 250],
  finish: [0, 0],
};

/** A slope that steepens is a crest: the blend takes long enough to stay under this curvature (a sled
 *  leaves the ground above about g / v^2, which is 0.011 at 30 m/s). */
const CREST_LIMIT = 0.007;

/** A leap: the lip's own slope (a sled leaves with this), the face and the metres of landing past the foot. */
const LIP_SLOPE = 0.27;
const LIP_RUN = 26;
const LEAP_FACE = 4;
/** How fast the landing face steepens, and the slope it stops at. */
const FACE_BEND = 0.0026;
const FACE_TOP = 0.8;
const LEAP_HOLD = 186;
const LEAP_EASE = 30;
/** Metres past a leap's section that stay clear. */
const LEAP_CLEAR = 40;
/** The metres from a leap's lip to the end of its section. */
const LEAP_TAIL = LEAP_FACE + LEAP_HOLD + LEAP_EASE;
/** Cliff heights: a mountain's ordinary leaps, its first and its last. */
const CLIFFS: Record<BiomeId, { first: readonly [number, number]; plain: readonly [number, number]; last: readonly [number, number] }> = {
  alpine: { first: [15, 17], plain: [13.5, 16], last: [18, 21] },
  glacier: { first: [20, 22], plain: [18, 22], last: [24, 25] },
  volcanic: { first: [16, 18], plain: [14, 18], last: [20, 22] },
  blossom: { first: [14, 16], plain: [13.5, 15], last: [16, 19] },
};

/** Terraces: the lead to the first lip, the step spacing and the steps' fall. */
const STEP_LEAD = 8;
const STEP_TAIL = 8;
const STEP_RUN = [54, 60] as const;
const STEP_DROP = [2.6, 3.8] as const;
const STEP_FACE = 2.5;
const STEP_KICK = 1;
const STEP_KICK_RUN = 16;

/** A lake's outlet: the natural lip it ends in. */
const OUTLET_DROP = 5;
const OUTLET_KICK = 1.1;
const OUTLET_RUN = 30;
const OUTLET_LAND = 95;

/** Kicker flights at 30 m/s, metres from the lip: small ones, big ones. A real sled lands about a tenth
 *  short of this flat model (it sheds speed on the face and leaves a tick before the lip), so these
 *  aim a tenth long of the 40 to 70 m that is wanted. */
const KICK_V = 30;
const KICK_SMALL = [48, 58] as const;
const KICK_BIG = [58, 68] as const;
/** A landing box runs this far past the flight at 30 m/s, for the sleds that come in faster. */
const KICK_OVERRUN = 1.5;
/** A kicker's flight comes down this close to the safe line at 30 m/s. */
const KICK_TRUE = 3.6;
const G = 9.81;

/** A place, as the first minute promises one by 900 m. */
const PLACES: ReadonlySet<SectionKind> = new Set<SectionKind>(['ravine', 'treerun', 'lake', 'fork', 'street', 'bridge', 'tunnel', 'terraces']);
/** Kinds a kicker may stand on the safe line of. */
const KICK_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>(['cruise', 'bowl', 'benches', 'split', 'switchbacks', 'chute', 'gully']);
/** Kinds narrow enough that a kicker there must land inside them: a ravine's floor, a fork's channel. */
const KICK_WITHIN: ReadonlySet<SectionKind> = new Set<SectionKind>(['ravine', 'fork']);
/** Open ground is about a quarter of a descent now, so the drops, moguls and vents that used to spread
 *  over all of it gather there. */
const OPEN_GATHER = 2.5;
const KICK_GATHER = 1.7;
/** Open kinds that may carry a mogul field, besides every bowl. */
const MOGUL_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>(['cruise', 'switchbacks', 'benches', 'gully', 'split']);
/** Where a vent can blow. */
const VENT_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>(['cruise', 'bowl', 'benches', 'split', 'switchbacks', 'chute', 'gully', 'ravine', 'fork']);
/** Where rails go, and where they go when a stage has too little of that. */
const RAIL_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>(['street', 'treerun', 'lake']);
const RAIL_SPARE: ReadonlySet<SectionKind> = new Set<SectionKind>(['cruise', 'bowl', 'benches', 'split', 'switchbacks']);
const RAIL_LAST: ReadonlySet<SectionKind> = new Set<SectionKind>(['bridge', 'ravine', 'tunnel', 'fork', 'chute', 'gully']);
/** Pads an act out when its beats cannot fill the stage. */
const FILLERS: readonly SectionKind[] = ['cruise', 'bowl', 'chute'];

/** Two sections may not meet like this. */
function legalPair(a: SectionKind, b: SectionKind): boolean {
  if (a === b) return false;
  // A lip's flights come down in what follows: it needs room, and a roof over them is out.
  if (a === 'lake' && (b === 'tunnel' || b === 'bridge' || b === 'ravine' || b === 'street' || b === 'treerun')) return false;
  if (a === 'terraces' && (b === 'tunnel' || b === 'bridge' || b === 'ravine')) return false;
  if (a === 'benches' && b === 'tunnel') return false;
  if (a === 'leap' && (b === 'bridge' || b === 'tunnel' || b === 'lake')) return false;
  if (b === 'leap' && (a === 'terraces' || a === 'lake' || a === 'bridge')) return false;
  return true;
}

/** One chapter of a mountain's descent: a name and its beats in order. Beats in one block trade places
 *  by seed; 'a|b' picks one of two. */
interface Act {
  name: string;
  blocks: readonly (readonly string[])[];
}

/** The mountains' descents, three acts each: every act fits its stage as written, and the opening
 *  (start, run-in, first leap) comes before the first. Daily seeds deal their biome's acts in any order. */
const SCRIPTS: Record<BiomeId, readonly [Act, Act, Act]> = {
  alpine: [
    { name: 'Timberline Glades', blocks: [['treerun'], ['fork']] },
    { name: 'Mirror Lake', blocks: [['chute|gully'], ['lake'], ['bowl|cruise'], ['treerun'], ['leap'], ['benches']] },
    { name: 'Old Town Run', blocks: [['switchbacks|split'], ['street'], ['chute'], ['leap'], ['treerun|split']] },
  ],
  glacier: [
    { name: 'Serac Gate', blocks: [['ravine'], ['bridge'], ['cruise']] },
    { name: 'The Crevasse Fields', blocks: [['chute'], ['leap'], ['ravine'], ['bridge'], ['fork']] },
    { name: 'The Fang', blocks: [['switchbacks|bowl'], ['ravine'], ['bridge'], ['chute'], ['leap']] },
  ],
  volcanic: [
    { name: 'Cinder Gate', blocks: [['ravine'], ['tunnel']] },
    { name: 'Ash Caldera', blocks: [['chute'], ['bridge'], ['fork'], ['leap'], ['ravine']] },
    { name: 'Basalt Halls', blocks: [['cruise|bowl'], ['tunnel'], ['bridge'], ['switchbacks|gully'], ['leap']] },
  ],
  blossom: [
    { name: 'Petal Steps', blocks: [['terraces'], ['street']] },
    { name: 'The Thousand Torii', blocks: [['chute'], ['tunnel'], ['cruise'], ['fork'], ['leap']] },
    { name: 'Temple Town', blocks: [['benches'], ['terraces'], ['bowl|cruise'], ['leap'], ['street']] },
  ],
};

/** What each mountain promises to hold, on every seed. */
const SIGNATURES: Record<BiomeId, readonly SectionKind[]> = {
  alpine: ['treerun', 'lake', 'street', 'fork'],
  glacier: ['ravine', 'bridge', 'fork'],
  volcanic: ['ravine', 'tunnel', 'bridge', 'fork'],
  blossom: ['terraces', 'tunnel', 'street', 'fork'],
};

const ROLLER_WAVE = 80;
/** Where the corridor's middle starts to fill up. */
const PICKETS_FROM = 900;

/** The run-in's gift line: where it starts, how long, its spacing and its swing. */
const GIFT_RUN_Z = 130;
const GIFT_RUN_LEN = 160;
const GIFT_RUN_STEP = 5;
const GIFT_RUN_WAVE = 110;

export interface Section {
  kind: SectionKind;
  z0: number;
  z1: number;
  /** The side the safe line takes in a split or a fork (+1 right, -1 left). */
  side: 1 | -1;
  /** Slope-weighted descent from z = 0 to z0, in units of the mountain's slope. */
  drop0: number;
  /** The centre line's bend phase at z0 (the integral of 1 / (300 x wave)). */
  phase0: number;
  /** Metres the ledges above z0 have taken the ground down by. */
  fall0: number;
  /** Metres its shape takes to come in: its body starts at z0 + blend. */
  blend: number;
  /** This section's own numbers (its kind's, with the seed's choice of width and gradient). */
  shape: SectionShape;
  /** The ledges inside it, in order. */
  ledges: readonly Ledge[];
  prev: Section | null;
}

/** A blended shape at one z, written into by Course.shapeAt. */
export type ShapeAt = SectionShape;

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

/** Metres under the plain slope at z, for a ledge (negative: the brow stands over it). */
function ledgeSink(l: Ledge, z: number): number {
  const up = z - (l.z - l.kickLen);
  if (up <= 0) return 0;
  if (z < l.z) {
    const t = up / l.kickLen;
    return -l.kick * t * t;
  }
  if (z < l.foot) {
    const t = (z - l.z) / (l.foot - l.z);
    return -l.kick + (l.kick + l.sink) * t * t * (3 - 2 * t);
  }
  if (l.faceHold <= 0) return l.sink;
  const u = z - l.foot;
  const a = l.face0 - l.grade;
  const c = l.faceBend;
  if (u <= l.faceEnd) return l.sink + a * u + c * u * u;
  const e = a + 2 * c * l.faceEnd;
  const m = l.sink + a * l.faceEnd + c * l.faceEnd * l.faceEnd;
  if (u <= l.faceHold) return m + e * (u - l.faceEnd);
  const n = m + e * (l.faceHold - l.faceEnd);
  const t = (u - l.faceHold) / l.faceEase;
  if (t >= 1) return n + 0.5 * e * l.faceEase;
  return n + e * l.faceEase * (t - t * t * t + 0.5 * t * t * t * t);
}

/** The bank past the edge, with a section's wall and fall on it. */
function edgeRise(e: number, sh: SectionShape): number {
  let h = bank(e);
  if (sh.wall > 0) h += sh.wall * smoothstep(WALL_FOOT, WALL_TOP, e);
  if (sh.fall > 0) {
    const k = sh.fall >= FALL_FULL ? 1 : sh.fall / FALL_FULL;
    h = h * (1 - k) - sh.fall * smoothstep(FALL_LIP, FALL_RUN, e);
  }
  return h;
}

/** A stretch of z. */
interface Band {
  z0: number;
  z1: number;
  /** A clear band a vent may still stand in. */
  vents?: boolean;
}

/** An authored kicker on the safe line, before it is built. */
interface Kick {
  z: number;
  big: boolean;
  /** Metres of flight at 30 m/s. */
  flight: number;
}

/** An obstacle on the fork's risk line. */
interface Risk {
  z: number;
  off: number;
  tall: boolean;
}

/** What the script puts where, all of it worked out before the first chunk. */
interface Plan {
  ledges: Ledge[];
  leaps: Ledge[];
  kicks: Kick[];
  rails: Rail[];
  risks: Risk[];
  /** Nothing stands across the corridor here. */
  clear: Band[];
  /** Nothing launches here: lips and their landings, tunnels and the run up to them, streets, bridges. */
  busy: Band[];
  /** Narrow places where nothing scattered but a vent goes: ravines, tree runs, forks. */
  narrow: Band[];
  /** The line's own kickers and flights: scattered drops and moguls keep out, off-line kickers need not. */
  flights: Band[];
  /** Authored mogul fields: every bowl has one, where nothing lands on it. */
  fields: Band[];
}

const slopeOf = (s: SectionShape): number => s.slope;
const freqOf = (s: SectionShape): number => 1 / (300 * s.wave);

/** A section before it is laid. */
interface Beat {
  kind: SectionKind;
  len: number;
  blend: number;
}

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
  private readonly plan: Plan = { ledges: [], leaps: [], kicks: [], rails: [], risks: [], clear: [], busy: [], narrow: [], flights: [], fields: [] };
  private readonly shapeA: ShapeAt = { ...SHAPES.cruise };
  private readonly shapeB: ShapeAt = { ...SHAPES.cruise };
  // Two-entry memos for the z-only functions: the terrain asks for a whole row of x at one z (and its
  // slope at z + 0.25), and ground(), edgeExcess() and safeX() each ask again, so most calls repeat.
  // shapeAt has two entries too: ground() reads it on every call, and the terrain's rows alternate
  // between z and z + 0.25. Each entry remembers the section whose body it holds as it stands, so the
  // next z in that body costs no copying at all.
  private shapeZA = NaN;
  private shapeZB = NaN;
  private shapeBodyA: Section | null = null;
  private shapeBodyB: Section | null = null;
  private shapeNextA = true;
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

  private stageList: Stage[] | null = null;

  /** The acts of this seed's descent, in order. A named mountain rides them as written; a daily deals
   *  its biome's three in the seed's order. */
  private actOrder(): readonly number[] {
    const order = [0, 1, 2];
    if (isNamedSeed(this.seed)) return order;
    const rng = new Rng(hash32(this.seed, 0xac75));
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    return order;
  }

  /** The descent's stages, in order. */
  get stages(): readonly Stage[] {
    if (!this.stageList) {
      const list: Stage[] = [];
      const acts = this.actOrder();
      let z = 0;
      STAGE_LENGTHS.forEach((len, index) => {
        list.push({ index, name: SCRIPTS[this.biome][acts[index]].name, z0: z, z1: z + len });
        z += len;
      });
      this.stageList = list;
    }
    return this.stageList;
  }

  /** The finish line. */
  get finishZ(): number {
    const st = this.stages;
    return st[st.length - 1].z1;
  }

  /** The stage that holds z (past the finish, the last). */
  stageAt(z: number): Stage {
    const st = this.stages;
    for (const s of st) if (z < s.z1) return s;
    return st[st.length - 1];
  }

  /** Metres past the corridor's edge at which something solid stands: the treeline by default, much
   *  nearer in a ravine, on a bridge or along a street. A sled is turned back there, never crashed. */
  edgeLimit(z: number): number {
    return this.shapeAt(z).limit;
  }

  /** Every ledge on the descent in order: leaps' cliffs, terrace steps and lake outlets. */
  get ledges(): readonly Ledge[] {
    this.section(0);
    return this.plan.ledges;
  }

  /** The leaps: the renderer dresses their lips. */
  get leaps(): readonly Ledge[] {
    this.section(0);
    return this.plan.leaps;
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
    if (list.length === 0) this.lay();
    while (list[list.length - 1].z1 <= z) this.pushSection('finish', 400, 40);
    let i = this.lastSection;
    if (i >= list.length) i = list.length - 1;
    while (i > 0 && list[i].z0 > z) i--;
    while (list[i].z1 <= z) i++;
    this.lastSection = i;
    return list[i];
  }

  private nominalGrade(kind: SectionKind): number {
    const g = GRADE[kind];
    return g ? (g[0] + g[1]) / 2 : SHAPES[kind].slope * this.params.slope;
  }

  /** A section's blend after the kind before it: a slope that steepens takes long enough to stay a roll
   *  rather than a crest. */
  private blendOf(kind: SectionKind, prev: SectionKind | null): number {
    if (!prev) return BLEND[kind];
    const rise = this.nominalGrade(kind) - this.nominalGrade(prev);
    return Math.max(BLEND[kind], Math.ceil((1.5 * rise) / CREST_LIMIT));
  }

  /** The least and the most a run of kinds can take, in metres. */
  private reach(list: readonly SectionKind[], before: SectionKind): { lo: number; hi: number } {
    let lo = 0;
    let hi = 0;
    let prev: SectionKind = before;
    for (const k of list) {
      const b = this.blendOf(k, prev);
      lo += b + BODY[k][0];
      hi += b + BODY[k][1];
      prev = k;
    }
    return { lo, hi };
  }

  /** The script's beats for one act, its alternatives picked and its blocks' beats shuffled. */
  private drawAct(act: Act, rng: Rng | null): SectionKind[] {
    const out: SectionKind[] = [];
    for (const block of act.blocks) {
      const beats = block.map((b) => {
        const opts = b.split('|') as SectionKind[];
        return rng ? rng.pick(opts) : opts[0];
      });
      for (let i = beats.length - 1; rng && i > 0; i--) {
        const j = rng.int(0, i);
        const t = beats[i];
        beats[i] = beats[j];
        beats[j] = t;
      }
      out.push(...beats);
    }
    return out;
  }

  /** The first minute, the same on every mountain: the start ramp, a wide run-in, a short lead and the
   *  first leap, whose lip falls between 590 and 670 m. */
  private opening(rng: Rng): Beat[] {
    const leapBlend = this.blendOf('leap', 'cruise');
    return [
      { kind: 'start', len: 120, blend: BLEND.start },
      { kind: 'bowl', len: rng.range(240, 270), blend: this.blendOf('bowl', 'start') },
      { kind: 'cruise', len: rng.range(120, 150), blend: this.blendOf('cruise', 'bowl') },
      { kind: 'leap', len: leapBlend + rng.range(12, 30) + LEAP_TAIL, blend: leapBlend },
    ];
  }

  /** Every length in its range, summing to total: drawn free, then drawn in toward whichever end fits. */
  private stretch(spans: readonly (readonly [number, number])[], total: number, rng: Rng): number[] {
    const at = spans.map(() => rng.next());
    const value = (u: number[]): number => spans.reduce((sum, [lo, hi], i) => sum + lo + (hi - lo) * u[i], 0);
    const least = value(spans.map(() => 0));
    const most = value(spans.map(() => 1));
    const now = value(at);
    const fit = now > total ? at.map((u) => (u * (total - least)) / (now - least)) : at.map((u) => 1 - ((1 - u) * (most - total)) / (most - now));
    return spans.map(([lo, hi], i) => lo + (hi - lo) * fit[i]);
  }

  /** Pours a descent's acts into its stages. An act that overflows its stage hands its last beats on and
   *  one that falls short takes the next stage's first, or a filler. Null if the result breaks a rule. */
  private pour(acts: SectionKind[][], rng: Rng): Beat[] | null {
    const beats = this.opening(rng);
    const openLen = beats.reduce((sum, b) => sum + b.len, 0);
    const caps = [STAGE_LENGTHS[0] - openLen, STAGE_LENGTHS[1], STAGE_LENGTHS[2] - FINISH_SQUARE];
    const slots = acts.map((a) => a.slice());
    const first = slots[0].findIndex((k) => PLACES.has(k) && legalPair('leap', k));
    if (first < 0) return null;
    slots[0].unshift(slots[0].splice(first, 1)[0]);
    const must = SIGNATURES[this.biome];
    let before: SectionKind = 'leap';
    for (let n = 0; n < slots.length; n++) {
      const list = slots[n];
      const cap = caps[n];
      while (this.reach(list, before).lo > cap) {
        if (n < slots.length - 1) {
          const k = list.pop();
          if (k === undefined) return null;
          slots[n + 1].unshift(k);
          continue;
        }
        // Nowhere left to hand it on: the last beat nothing promises goes.
        let spare = list.length - 1;
        while (spare >= 0 && (list[spare] === 'leap' || must.includes(list[spare]))) spare--;
        if (spare < 0) return null;
        list.splice(spare, 1);
      }
      while (this.reach(list, before).hi < cap) {
        const last = list.length > 0 ? list[list.length - 1] : before;
        const next = n < slots.length - 1 ? slots[n + 1].shift() : undefined;
        const k = next ?? FILLERS.find((c) => legalPair(last, c));
        if (k === undefined) return null;
        list.push(k);
      }
      const r = this.reach(list, before);
      if (r.lo > cap || r.hi < cap || list.length === 0) return null;
      let prev: SectionKind = before;
      const spans = list.map((k) => {
        const b = this.blendOf(k, prev);
        prev = k;
        return [b + BODY[k][0], b + BODY[k][1]] as const;
      });
      const lens = this.stretch(spans, cap, rng);
      prev = before;
      list.forEach((k, i) => {
        beats.push({ kind: k, len: lens[i], blend: this.blendOf(k, prev) });
        prev = k;
      });
      before = prev;
    }
    beats.push({ kind: 'finish', len: FINISH_SQUARE + RUN_OUT, blend: this.blendOf('finish', before) });
    for (let i = 1; i < beats.length; i++) if (!legalPair(beats[i - 1].kind, beats[i].kind)) return null;
    for (const k of must) if (!beats.some((b) => b.kind === k)) return null;
    return beats;
  }

  /** The seed's descent: the script's order, tried until it meets every rule. The authored order always does. */
  private compose(): Beat[] {
    const script = SCRIPTS[this.biome];
    const order = this.actOrder();
    const rng = new Rng(hash32(this.seed, 0x5c71));
    for (let tries = 0; tries < 48; tries++) {
      const seq = this.pour(
        order.map((a) => this.drawAct(script[a], rng)),
        rng,
      );
      if (seq) return seq;
    }
    const authored = this.pour(
      script.map((a) => this.drawAct(a, null)),
      rng,
    );
    if (!authored) throw new Error(`no descent for seed ${this.seed}`);
    return authored;
  }

  /** Lays the whole descent out at once, a pure function of the seed: sections first, then what stands
   *  on them. */
  private lay(): void {
    const beats = this.compose();
    let leapsLeft = beats.filter((b) => b.kind === 'leap').length;
    let leapNo = 0;
    beats.forEach((b, i) => {
      const sec = this.pushSection(b.kind, b.len, b.blend);
      const rng = new Rng(hash32(this.seed, i, 0xed6e));
      // The run-in is wide, but a first run's line through it is calm.
      if (i === 1) sec.shape.reach *= 0.4;
      if (b.kind === 'leap') {
        leapsLeft--;
        this.layLeap(sec, rng, leapNo === 0 ? 'first' : leapsLeft === 0 ? 'last' : 'plain');
        leapNo++;
      } else if (b.kind === 'terraces') this.layTerraces(sec, rng);
      else if (b.kind === 'lake') this.layOutlet(sec, rng);
      else if (b.kind === 'fork') this.layFork(sec, rng);
      this.layBands(sec);
    });
    this.layKicks();
    this.layFields();
    this.layRails();
  }

  /** Sections are made in order, each from its own hash. */
  private pushSection(kind: SectionKind, len: number, blend: number): Section {
    const list = this.sections;
    const i = list.length;
    const prev = i > 0 ? list[i - 1] : null;
    const rng = new Rng(hash32(this.seed, i, 0x5ec7));
    const shape = { ...SHAPES[kind] };
    const grade = GRADE[kind];
    if (grade) shape.slope = rng.range(grade[0], grade[1]) / this.params.slope;
    const width = WIDTH[kind];
    if (width) shape.width = rng.range(width[0], width[1]);
    const z0 = prev ? prev.z1 : 0;
    const side = rng.chance(0.5) ? 1 : -1;
    // The width this section mostly has: what the safe line's reach and shift are measured against.
    const wide = lerp(this.params.halfWidthStart, this.params.halfWidthEnd, this.difficulty(z0 + len / 2)) * (1 - shape.pin) + shape.width;
    shape.reach = Math.max(0, wide - 4.2) * 0.8 * shape.span;
    shape.shift = shape.split * wide * side;
    const drop0 = prev ? prev.drop0 + this.sectionInt(prev, prev.z1 - prev.z0, slopeOf) : 0;
    const phase0 = prev ? prev.phase0 + this.sectionInt(prev, prev.z1 - prev.z0, freqOf) : 0;
    const fall0 = prev ? prev.ledges.reduce((sum, l) => sum + l.total, prev.fall0) : 0;
    const sec: Section = { kind, z0, z1: z0 + len, side, drop0, phase0, fall0, blend, shape, ledges: [], prev };
    list.push(sec);
    return sec;
  }

  private addLedge(sec: Section, l: Omit<Ledge, 'total'>): void {
    const ledge: Ledge = { ...l, total: 0 };
    ledge.total = ledgeSink(ledge, l.foot + l.faceHold + l.faceEase + 1);
    (sec.ledges as Ledge[]).push(ledge);
    this.plan.ledges.push(ledge);
    if (ledge.kind === 'leap') this.plan.leaps.push(ledge);
  }

  /** A leap: a brow, a cliff, and a landing face that keeps steepening under the falling sled. The face
   *  starts gentle and ends at FACE_TOP, so a slow sled comes down on it early and a fast one far down,
   *  each on ground falling away nearly as fast as it is. A higher cliff starts it gentler. */
  private layLeap(sec: Section, rng: Rng, which: 'first' | 'plain' | 'last'): void {
    const grade = sec.shape.slope * this.params.slope;
    const [lo, hi] = CLIFFS[this.biome][which];
    const height = rng.range(lo, hi);
    const z = sec.z1 - LEAP_TAIL;
    const kick = (LIP_RUN * (grade - LIP_SLOPE)) / 2;
    const face0 = 0.3 - 0.01 * (height - 13);
    const faceBend = FACE_BEND;
    this.addLedge(sec, {
      kind: 'leap',
      z,
      foot: z + LEAP_FACE,
      height,
      land0: z + 20,
      land1: z + 206,
      kick,
      kickLen: LIP_RUN,
      grade,
      sink: height - kick - grade * LEAP_FACE,
      face0,
      faceBend,
      faceEnd: (FACE_TOP - face0) / (2 * faceBend),
      faceHold: LEAP_HOLD,
      faceEase: LEAP_EASE,
    });
  }

  /** Terraces: three or four steps, spaced so a sled at 28 to 34 m/s comes down on the next one's ramp. */
  private layTerraces(sec: Section, rng: Rng): void {
    const grade = sec.shape.slope * this.params.slope;
    const body = sec.z0 + sec.blend;
    const room = sec.z1 - body - STEP_LEAD - STEP_TAIL;
    const n = room >= 4 * STEP_RUN[0] ? 4 : 3;
    const run = Math.min(STEP_RUN[1], room / n);
    for (let i = 0; i < n; i++) {
      const z = body + STEP_LEAD + i * run;
      const height = rng.range(STEP_DROP[0], STEP_DROP[1]);
      this.addLedge(sec, {
        kind: 'step',
        z,
        foot: z + STEP_FACE,
        height,
        land0: z + 18,
        land1: z + run,
        kick: STEP_KICK,
        kickLen: STEP_KICK_RUN,
        grade,
        sink: height - STEP_KICK - grade * STEP_FACE,
        face0: 0,
        faceBend: 0,
        faceEnd: 0,
        faceHold: 0,
        faceEase: 0,
      });
    }
  }

  /** The lake ends in a natural lip: the sheet's speed goes out over it. */
  private layOutlet(sec: Section, rng: Rng): void {
    const grade = sec.shape.slope * this.params.slope;
    const z = sec.z1 - 5;
    const height = OUTLET_DROP + rng.range(0, 1.5);
    this.addLedge(sec, {
      kind: 'outlet',
      z,
      foot: z + 3,
      height,
      land0: z + 20,
      land1: z + OUTLET_LAND,
      kick: OUTLET_KICK,
      kickLen: OUTLET_RUN,
      grade,
      sink: height - OUTLET_KICK - grade * 3,
      face0: 0,
      faceBend: 0,
      faceEnd: 0,
      faceHold: 0,
      faceEase: 0,
    });
  }

  /** The risk line's obstacles stand either side of the strip's middle, so a lane weaves between them.
   *  It is threadable at full speed, and the ice is what makes it hard: nothing here is a wall. */
  private layFork(sec: Section, rng: Rng): void {
    const body = sec.z0 + sec.blend;
    const n = rng.int(3, 4);
    let side = rng.chance(0.5) ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.3 + 0.4 * rng.next()) / n;
      this.plan.risks.push({ z: body + (sec.z1 - body) * u, off: side * rng.range(2.3, 3.1), tall: rng.chance(0.4) });
      side = -side;
    }
  }

  /** Where nothing stands, and where no scattered feature goes. */
  private layBands(sec: Section): void {
    const { clear, busy, narrow } = this.plan;
    const body = sec.z0 + sec.blend;
    switch (sec.kind) {
      case 'start':
        busy.push({ z0: 0, z1: START_CLEAR_Z + 8 });
        break;
      case 'leap': {
        // Past the last landing it stays clear for a beat: a sled that spun lands wide and at full speed.
        const l = sec.ledges[0];
        clear.push({ z0: l.z - 2, z1: sec.z1 + LEAP_CLEAR });
        busy.push({ z0: sec.z0, z1: sec.z1 + LEAP_CLEAR });
        break;
      }
      case 'terraces':
        clear.push({ z0: body - 2, z1: sec.z1 + 30 });
        busy.push({ z0: sec.z0, z1: sec.z1 + 30 });
        break;
      case 'lake': {
        const l = sec.ledges[0];
        clear.push({ z0: l.z - 2, z1: l.land1 });
        busy.push({ z0: sec.z0, z1: l.land1 });
        break;
      }
      case 'bridge':
        clear.push({ z0: sec.z0 - 30, z1: sec.z1 + 30 });
        busy.push({ z0: sec.z0, z1: sec.z1 + 30 });
        break;
      case 'tunnel':
        // Nothing launches inside, or for the 120 m up the hill of it.
        busy.push({ z0: sec.z0 - 120, z1: sec.z1 + 10 });
        break;
      case 'finish':
        clear.push({ z0: sec.z0, z1: 1e9 });
        busy.push({ z0: sec.z0, z1: 1e9 });
        break;
      case 'ravine':
        clear.push({ z0: sec.z0 + sec.blend * 0.3, z1: sec.z1, vents: true });
        narrow.push({ z0: sec.z0, z1: sec.z1 });
        break;
      case 'treerun':
      case 'fork':
        narrow.push({ z0: sec.z0, z1: sec.z1 });
        break;
      case 'street':
        busy.push({ z0: sec.z0, z1: sec.z1 });
        break;
      default:
        break;
    }
  }

  /** The kickers on the line. The first stands at about 300 m on every mountain, small; the rest take
   *  the open sections, one a section, where their landing runs clear. */
  private layKicks(): void {
    const plan = this.plan;
    const rng = new Rng(hash32(this.seed, 0x1c4e));
    const add = (z: number, big: boolean): void => {
      const flight = big ? rng.range(KICK_BIG[0], KICK_BIG[1]) : rng.range(KICK_SMALL[0], KICK_SMALL[1]);
      plan.kicks.push({ z, big, flight });
      plan.flights.push({ z0: z - 20, z1: z + 10 + flight });
    };
    let first = 296;
    let best = Infinity;
    for (let z = 286; z <= 312; z += 2) {
      const off = this.trueness(z);
      if (off < best) {
        best = off;
        first = z;
      }
    }
    add(first, false);
    for (const sec of this.sections) {
      if (sec.z0 < 800 || sec.z0 >= this.finishZ || !KICK_KINDS.has(sec.kind)) continue;
      const body = sec.z0 + sec.blend;
      let made = 0;
      for (let t = 0; t < 24 && made < 2; t++) {
        const z = rng.range(body - 30, sec.z1 - 16);
        if (this.busy(z - 24, z + 10 + KICK_SMALL[1]) || !this.lineRunsOn(z)) continue;
        // A big one only where its longer flight has room to come down.
        add(z, rng.chance(0.5) && !this.busy(z - 24, z + 10 + KICK_BIG[1]));
        made++;
      }
    }
    for (const sec of this.sections) {
      if (sec.z0 < 800 || !KICK_WITHIN.has(sec.kind)) continue;
      const first = sec.z0 + sec.blend + 8;
      const last = sec.z1 - 12 - KICK_BIG[1] * KICK_OVERRUN;
      const others = [...plan.busy, ...plan.flights];
      for (let t = 0; t < 8 && last > first; t++) {
        const z = rng.range(first, last);
        if (others.some((b) => z + 10 + KICK_BIG[1] > b.z0 && z - 24 < b.z1) || !this.lineRunsOn(z)) continue;
        add(z, false);
        break;
      }
    }
    plan.kicks.sort((a, b) => a.z - b.z);
  }

  /** Mogul fields, laid after the kickers so none sits on one: a bowl always has its field, and some of
   *  the other open sections do. (The run-in keeps its promise of none in the first 300 m.) */
  private layFields(): void {
    const plan = this.plan;
    const rng = new Rng(hash32(this.seed, 0x3061));
    for (const sec of this.sections) {
      if (sec.z0 < 800 || sec.z0 >= this.finishZ) continue;
      const bowl = sec.kind === 'bowl';
      if (!bowl && !(MOGUL_KINDS.has(sec.kind) && rng.chance(0.5))) continue;
      for (let t = 0; t < 16; t++) {
        const z = rng.range(sec.z0 + sec.blend * 0.5, sec.z1 - 40);
        const end = z + rng.range(28, 44);
        if (end > sec.z1 || this.busy(z - 8, end + 8) || this.hits(plan.fields, z - 8, end + 8)) continue;
        plan.fields.push({ z0: z, z1: end });
        break;
      }
    }
  }

  /** Whether the safe line holds true over a kicker at z and the flight off it, so the sled comes down on it. */
  private lineRunsOn(z: number): boolean {
    const lip = z + 10;
    return Math.abs(this.safeX(lip) - this.safeX(z)) <= 1.3 && this.trueness(z) <= KICK_TRUE;
  }

  /** How far the safe line strays from a straight flight off a kicker at z. */
  private trueness(z: number): number {
    const lip = z + 10;
    const lean = (this.safeX(lip) - this.safeX(z)) / 10;
    let off = 0;
    for (let d = 20; d <= 70; d += 25) off = Math.max(off, Math.abs(this.safeX(lip + d) - this.safeX(lip) - lean * d));
    return off;
  }

  /** Grindable rails, four to eight a stage, 3 to 5 m off the safe line: along streets and tree runs
   *  and by lakes, then wherever else the stage is open if it holds too little of those. */
  private layRails(): void {
    const plan = this.plan;
    for (const stage of this.stages) {
      const rng = new Rng(hash32(this.seed, stage.index, 0x4a11));
      const target = rng.int(4, 8);
      let made = 0;
      for (const kinds of [RAIL_KINDS, RAIL_SPARE, RAIL_LAST]) {
        const sites: { z: number; side: 1 | -1 }[] = [];
        for (const sec of this.sections) {
          if (sec.z0 >= stage.z1 || sec.z1 <= stage.z0 || !kinds.has(sec.kind)) continue;
          const z0 = Math.max(sec.z0 + sec.blend + 4, stage.z0);
          const z1 = Math.min(sec.z1 - 26, stage.z1 - 34);
          let side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
          for (let z = z0 + rng.range(0, 8); z < z1; z += rng.range(40, 52)) {
            sites.push({ z, side });
            side = side > 0 ? -1 : 1;
          }
        }
        // Spread the picks over the stage, then take what is left if some sites would not do.
        const stride = Math.max(1, sites.length / (target - made));
        const picks: number[] = [];
        for (let k = 0; k * stride < sites.length; k++) picks.push(Math.floor(k * stride));
        for (let k = 0; k < sites.length; k++) if (!picks.includes(k)) picks.push(k);
        for (const k of picks) {
          if (made >= target) break;
          const site = sites[k];
          const rail = this.railAt(site.z, site.side, rng) ?? this.railAt(site.z, site.side > 0 ? -1 : 1, rng);
          if (!rail || plan.rails.some((r) => Math.abs(r.z0 - rail.z0) < 12)) continue;
          plan.rails.push(rail);
          made++;
        }
      }
    }
    plan.rails.sort((a, b) => a.z0 - b.z0);
    plan.rails.forEach((r, i) => {
      r.id = i;
    });
  }

  /** A rail along the safe line, if it stays 3 to 5 m off it, on the snow and off every other piece. */
  private railAt(z: number, side: 1 | -1, rng: Rng): Rail | null {
    const len = rng.range(20, 32);
    const off = rng.range(3.4, 4.6);
    const end = z + len;
    const x0 = this.safeX(z) + side * off;
    const x1 = this.safeX(end) + side * off;
    for (let u = 0; u <= 1; u += 0.125) {
      const zz = z + len * u;
      const x = x0 + (x1 - x0) * u;
      const d = Math.abs(x - this.safeX(zz));
      if (d < 3 || d > 5 || this.edgeExcess(x, zz) > -0.4) return null;
    }
    for (const k of this.plan.kicks) if (z < k.z + 14 && end > k.z - 6) return null;
    return { id: 0, x0, z0: z, x1, z1: end, h: 1.1 };
  }

  private hits(bands: readonly Band[], z0: number, z1: number): boolean {
    for (const b of bands) if (z1 > b.z0 && z0 < b.z1) return true;
    return false;
  }

  /** Whether a stretch holds anything a scattered feature should keep out of. */
  private busy(z0: number, z1: number): boolean {
    this.section(0);
    const p = this.plan;
    return this.hits(p.busy, z0, z1) || this.hits(p.narrow, z0, z1) || this.hits(p.flights, z0, z1);
  }

  /** The integral of a section field over the first `d` metres of a section, the field easing in
   *  from the previous section's value over its blend (the integral of the smoothstep blend). */
  private sectionInt(sec: Section, d: number, field: (s: SectionShape) => number): number {
    const b = field(sec.shape);
    const a = sec.prev ? field(sec.prev.shape) : b;
    const B = sec.blend;
    if (d < B) {
      const u = d / B;
      return a * d + (b - a) * B * (u * u * u - (u * u * u * u) / 2);
    }
    return a * B + 0.5 * (b - a) * B + b * (d - B);
  }

  /** The blended section shape at z (the returned object is reused: copy what you keep). */
  shapeAt(z: number): ShapeAt {
    if (z === this.shapeZA) return this.shapeA;
    if (z === this.shapeZB) return this.shapeB;
    const a = this.shapeNextA;
    this.shapeNextA = !a;
    const out = a ? this.shapeA : this.shapeB;
    if (a) this.shapeZA = z;
    else this.shapeZB = z;
    const sec = this.section(z);
    const cur = sec.shape;
    const prevSec = sec.prev;
    const w = prevSec ? smoothstep(sec.z0, sec.z0 + sec.blend, z) : 1;
    if (w === 1) {
      // In a section's body the shape is the section's: most calls end here.
      if ((a ? this.shapeBodyA : this.shapeBodyB) === sec) return out;
      if (a) this.shapeBodyA = sec;
      else this.shapeBodyB = sec;
      Object.assign(out, cur);
      return out;
    }
    if (a) this.shapeBodyA = null;
    else this.shapeBodyB = null;
    const pre = prevSec ? prevSec.shape : cur;
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
    out.pin = lerp(pre.pin, cur.pin, w);
    out.wall = lerp(pre.wall, cur.wall, w);
    out.fall = lerp(pre.fall, cur.fall, w);
    out.relief = lerp(pre.relief, cur.relief, w);
    out.limit = lerp(pre.limit, cur.limit, w);
    out.ice = lerp(pre.ice, cur.ice, w);
    out.ridge = lerp(pre.ridge, cur.ridge, w);
    out.lane = lerp(pre.lane, cur.lane, w);
    out.shift = lerp(pre.shift, cur.shift, w);
    out.reach = lerp(pre.reach, cur.reach, w);
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
    const sh = this.shapeAt(z);
    // What a section pins it does not leave to the plain corridor (and an authored width needs no cap).
    // The terrain mesh is fine out to halfWidthStart + 12.6 m: a wide section stays inside it. The caps
    // are rounded, so the width (and the safe line, which follows it) never turns a corner.
    const free = 1 - sh.pin;
    const w = smax(base * free + sh.width, Math.min(base, 8.5) * free, 3);
    return smin(w, p.halfWidthStart + 3 + 40 * sh.pin, 4);
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
    const cx = this.centerX(z);
    const sh = this.shapeAt(z);
    return cx + sh.shift + sh.reach * smoothstep(0, 120, z) * fbm1(this.sS, z / 150);
  }

  /** The fork's risk line: the channel safeX did not take. Null where the course does not fork. */
  altX(z: number): number | null {
    const sh = this.shapeAt(z);
    if (sh.ridge < 0.15) return null;
    return this.safeX(z) - 2 * this.shapeAt(z).shift;
  }

  /** The centre of the channel a sled at x belongs to, which it steers back to: the corridor's own
   *  centre, or in a fork the centre of the channel on its side of the ridge. */
  backX(z: number, x: number): number {
    const cx = this.centerX(z);
    const sh = this.shapeAt(z);
    if (sh.ridge <= 0) return cx;
    return x >= cx ? cx + Math.abs(sh.shift) : cx - Math.abs(sh.shift);
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
    const sh = this.shapeAt(z);
    const roll = sh.roller > 0 ? sh.roller * dsin((TAU * z) / ROLLER_WAVE) : 0;
    const hum = sh.relief > 0 ? 10 * sh.relief * noise1(this.sY, z / 260) * smoothstep(0, 300, z) : 0;
    let y = -this.params.slope * drop - sec.fall0 + hum + roll;
    for (const l of sec.ledges) y -= ledgeSink(l, z);
    return y;
  }

  /** Distance past the corridor edge (negative inside the corridor). */
  edgeExcess(x: number, z: number): number {
    return Math.abs(x - this.centerX(z)) - this.halfWidth(z);
  }

  /** The ground without its zones: what a feature can read while the zones are being built. */
  private bareGround(x: number, z: number): number {
    const sh = this.shapeAt(z);
    let h = this.baseY(z);
    if (sh.relief > 0) h += 1.1 * sh.relief * noise2(this.sR, x / 36, z / 44);
    const e = this.edgeExcess(x, z);
    if (e > 0) h += edgeRise(e, sh);
    if (sh.ridge > 0) {
      const dx = Math.abs(x - this.centerX(z));
      if (dx < RIDGE_RUN) h += RIDGE_H * smoothstep(0.35 * RIDGE_H, RIDGE_H, sh.ridge) * (1 - smoothstep(RIDGE_CREST, RIDGE_RUN, dx));
    }
    return h;
  }

  ground(x: number, z: number): number {
    let h = this.bareGround(x, z);
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
    const sh = this.shapeAt(z);
    if (sh.ice >= 0.5 && this.edgeExcess(x, z) < 0.5) return GLASS;
    if (sh.ridge >= 0.5 * RIDGE_H) {
      const alt = this.altX(z);
      if (alt !== null && Math.abs(x - alt) < STRIP) return GLASS;
    }
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci; k++) {
      if (k < 0) continue;
      for (const p of this.zones(k).ice) {
        const dx = (x - p.x) / p.rx;
        const dz = (z - p.z) / p.rz;
        if (dx * dx + dz * dz < 1) return PATCH_ICE;
      }
    }
    return SNOW;
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
  private wantsDrop(i: number, mul?: number): boolean {
    if (i < 5) return false;
    const mid = i * CHUNK_LEN + CHUNK_LEN / 2;
    return hash32(this.seed, i, 0xd409) / 4294967296 < OPEN_GATHER * this.params.dropChance * (mul ?? this.shapeAt(mid).drops) * (0.6 + 0.6 * this.difficulty(i * CHUNK_LEN));
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

  /** How far a kicker's sled flies at 30 m/s from a lip at (x, z), over the ground there: the ground's
   *  ripple at the lip alone moves a flight by 9 m, so this reads the real ground, not the plain slope. */
  private flightOf(x: number, lip: number, face: number, len: number): number {
    const dt = 0.05;
    const y0 = this.bareGround(x, lip);
    let z = lip;
    let y = y0 + (face * len) / 2;
    let vy = KICK_V * (face + y0 - this.bareGround(x, lip - 1));
    for (let t = 0; t < 8; t += dt) {
      vy -= G * dt;
      y += vy * dt;
      z += KICK_V * dt;
      if (y <= this.bareGround(x, z)) return z - lip;
    }
    return z - lip;
  }

  /** The kicker face (its slope at the lip) whose flight at 30 m/s comes down `flight` metres out: a
   *  ramp's lift is speed times face slope, so the face is what sets the flight. */
  private faceFor(x: number, lip: number, len: number, flight: number): number {
    let lo = 0.05;
    let hi = 0.6;
    for (let n = 0; n < 9; n++) {
      const m = (lo + hi) / 2;
      if (this.flightOf(x, lip, m, len) < flight) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }

  private buildFeatures(i: number): Zones {
    const p = this.params;
    const rng = new Rng(hash32(this.seed, i, 0x20e5));
    const z0 = i * CHUNK_LEN;
    const z1 = z0 + CHUNK_LEN;
    const diff = this.difficulty(z0);
    const sh = this.shapeAt(z0 + CHUNK_LEN / 2);
    const kickMul = sh.kickers;
    const mogulMul = sh.moguls;
    const dropMul = sh.drops;
    const zn: Zones = { ramps: [], drops: [], moguls: [], ice: [], vents: [], rails: [], keepOut: [] };
    const plan = this.plan;

    // A ledge is cut into baseY: the depth-free drop only asks the terrain for its fine rows.
    for (const l of plan.ledges) if (l.z >= z0 && l.z < z1) zn.drops.push({ z: l.z, depth: 0, len: l.foot - l.z, rec: 0 });
    for (const b of plan.clear) {
      const lo = Math.max(b.z0, z0);
      const hi = Math.min(b.z1, z1);
      if (lo < hi) zn.keepOut.push({ z0: lo, z1: hi, x0: -1e9, x1: 1e9, vents: b.vents });
    }
    for (const r of plan.rails) {
      if (r.z0 >= z0 && r.z0 < z1) zn.rails.push(r);
      const lo = Math.max(r.z0 - 2, z0);
      const hi = Math.min(r.z1 + 2, z1);
      if (lo < hi) zn.keepOut.push({ z0: lo, z1: hi, x0: Math.min(r.x0, r.x1) - 1.6, x1: Math.max(r.x0, r.x1) + 1.6 });
    }
    for (const m of plan.fields) {
      if (m.z0 >= z0 && m.z0 < z1) zn.moguls.push({ z0: m.z0, z1: m.z1, amp: lerp(0.32, 0.55, diff), phase: rng.range(0, 6.28), wave: rng.range(2.6, 3.4) });
    }
    for (const k of plan.kicks) {
      if (k.z >= z0 && k.z < z1) {
        const len = rng.range(8.5, 10);
        const w = 6.4;
        const x = this.safeX(k.z + len * 0.5);
        const face = this.faceFor(x, k.z + len, len, k.flight);
        zn.ramps.push({ x, z: k.z, len, w, h: (face * len) / 2, online: true });
        zn.keepOut.push({ z0: k.z - 14, z1: k.z + len + 2, x0: x - w * 0.5 - 1.6, x1: x + w * 0.5 + 1.6 });
      }
      // The line's landing: a band along it, each chunk keeping out its own share.
      const lo = Math.max(k.z + 8, z0);
      const hi = Math.min(k.z + 16 + k.flight * KICK_OVERRUN, z1);
      if (lo < hi) {
        let x0 = Infinity;
        let x1 = -Infinity;
        for (let z = lo; z <= hi; z += 4) {
          const x = this.safeX(z);
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
        zn.keepOut.push({ z0: lo, z1: hi, x0: x0 - 5.5, x1: x1 + 5.5 });
      }
    }
    // The terrain lights ice row by row near a patch, so the sheet and the strip carry one a chunk.
    for (const q of [z0, z0 + CHUNK_LEN / 2, z1]) {
      if (this.shapeAt(q).ice > 0) {
        zn.ice.push({ x: this.centerX(q), z: z0 + CHUNK_LEN / 2, rx: 2, rz: CHUNK_LEN / 2 + 3 });
        break;
      }
    }
    const strip = this.altX(z0 + CHUNK_LEN / 2);
    if (strip !== null) zn.ice.push({ x: strip, z: z0 + CHUNK_LEN / 2, rx: 1.5, rz: CHUNK_LEN / 2 + 3 });

    if (z0 < START_CLEAR_Z - CHUNK_LEN) return zn;

    const dz = z0 + rng.range(16, 40);
    const drop = this.wantsDrop(i, dropMul) && !this.wantsDrop(i - 1) && !this.wantsDrop(i - 2) && !this.busy(dz - 26, dz + 130);
    if (drop) {
      const d: Drop = { z: dz, depth: lerp(3.5, 7.5, diff) * rng.range(0.85, 1.15), len: rng.range(7, 10), rec: rng.range(90, 120) };
      zn.drops.push(d);
      zn.keepOut.push({ z0: dz - 22, z1: dz + d.len + 52, x0: -1e9, x1: 1e9 });
    }

    if (!drop && rng.chance(KICK_GATHER * p.kickerChance * kickMul * (0.75 + 0.5 * diff))) {
      const count = diff > 0.55 && rng.chance(0.35) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const rz = z0 + rng.range(8, 36) + k * 22;
        const big = rng.chance(0.2 + 0.35 * diff);
        const flight = big ? rng.range(KICK_BIG[0], KICK_BIG[1]) : rng.range(KICK_SMALL[0], KICK_SMALL[1]);
        const len = big ? rng.range(8.5, 10) : rng.range(8, 11);
        const w = rng.range(4.2, 6.5);
        if (this.hits(plan.busy, rz - 6, rz + len + flight) || this.hits(plan.narrow, rz - 6, rz + len + flight)) continue;
        // Moguls under a kicker would throw the sled before it reached the lip.
        if (this.hits(plan.fields, rz - 16, rz + len + 4) || (i > 0 && this.features(i - 1).moguls.some((m) => m.z1 > rz - 16))) continue;
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
        // ...and its flight has to come down on the snow, not on a bank the corridor narrowed into.
        if (this.edgeExcess(rx, rz + len + flight * 0.5) > -1 || this.edgeExcess(rx, rz + len + flight) > -1) continue;
        const h = (this.faceFor(rx, rz + len, len, flight) * len) / 2;
        zn.ramps.push({ x: rx, z: rz, len, w, h });
        zn.keepOut.push({ z0: rz - 14, z1: rz + len + 2, x0: rx - w * 0.5 - 1.6, x1: rx + w * 0.5 + 1.6 });
        zn.keepOut.push({ z0: rz + len, z1: rz + len + flight * KICK_OVERRUN, x0: rx - 6.5, x1: rx + 6.5 });
      }
    }

    // No moguls in the first 300 m: a new rider stomping into them is thrown straight back up.
    const mz = z0 + rng.range(0, 24);
    if (!drop && zn.ramps.length === 0 && rng.chance(1.6 * OPEN_GATHER * p.mogulChance * mogulMul * (0.6 + 0.8 * diff)) && z0 >= 300 && !this.busy(mz, mz + 48)) {
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
        for (const b of this.features(k).keepOut) if (!b.vents && z + 4 > b.z0 && z - 4 < b.z1 && x + 6 > b.x0 && x - 6 < b.x1) return true;
      }
      for (const b of zn.keepOut) if (!b.vents && z + 4 > b.z0 && z - 4 < b.z1 && x + 6 > b.x0 && x - 6 < b.x1) return true;
      return false;
    };
    if (rng.chance(OPEN_GATHER * p.ventChance)) {
      const n = rng.int(1, 3 + Math.floor(diff * 2));
      for (let k = 0; k < n; k++) {
        const vz = z0 + rng.range(6, 56);
        const hw = this.halfWidth(vz);
        const sx = this.safeX(vz);
        const off = (rng.chance(0.5) ? 1 : -1) * rng.range(SAFE_LANE + 1.6, Math.max(SAFE_LANE + 1.7, hw - 2));
        const vx = clamp(sx + off, this.centerX(vz) - hw + 2, this.centerX(vz) + hw - 2);
        if (Math.abs(vx - sx) < SAFE_LANE + 1.6 || blocked(vx, vz) || this.hits(this.plan.busy, vz - 6, vz + 44) || !VENT_KINDS.has(this.section(vz).kind)) continue;
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

    // While the risk route's own obstacles go down: everything else keeps off its strip.
    let laying = false;
    const clearOf = (x: number, z: number, r: number): boolean => {
      if (z - r < START_CLEAR_Z) return false;
      // A fork's risk strip keeps its own few obstacles (risk: true places them).
      if (!laying) {
        const strip = this.altX(z);
        if (strip !== null && Math.abs(x - strip) < STRIP + r) return false;
      }
      // Early on the lane is wider than promised: a rider still learning to hold a bend has room.
      if (Math.abs(x - this.safeX(z)) < r + SAFE_LANE + EARLY_MARGIN * (1 - diff) + this.shapeAt(z).lane) return false;
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
    // Hazards ask for the steering at 30 m/s: even the first kilometre has something to read every
    // second or so, and the last stage has the most.
    const target = Math.round((7 + 15 * diff) * p.density * templateMul * obsMul * (1 + beyond));

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

    if (template === 1 && obsMul >= 0.5) {
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

    // Pickets down the corridor's middle: the safe line weaves past them, so nobody finishes by letting go.
    // Nothing here before the first leap has been ridden: the first minute stays open.
    if (z0 >= PICKETS_FROM && obsMul >= 0.5) {
      for (let z = z0 + rng.range(4, 20); z < z1 - 1; z += rng.range(26, 40) - diff * 10) {
        const roll = rng.next();
        placeOne(roll < 0.6 ? rng.pick(tallKinds) : rng.pick(lowKinds), this.centerX(z) + rng.range(-2.6, 2.6), z);
      }
    }

    // A split: a line of trees down the middle. The safe line keeps to one side; the other side is
    // a second way down, open but not promised.
    for (let z = z0 + rng.range(1, 5); z < z1; z += rng.range(4.5, 7)) {
      if (this.shapeAt(z).split < 0.3) continue;
      placeOne(rng.pick(tallKinds), this.centerX(z) + rng.range(-1.6, 1.6), z);
    }

    // A tree run: both sides of the lane lined close, and a second rank behind.
    for (let z = z0 + rng.range(0.5, 2.5); z < z1; z += rng.range(3.4, 4.6)) {
      const sec = this.section(z);
      if (sec.kind !== 'treerun' || z < sec.z0 + sec.blend) continue;
      const sx = this.safeX(z);
      const near = SAFE_LANE + EARLY_MARGIN * (1 - diff) + 1.05;
      for (let side = -1; side <= 1; side += 2) {
        const off = near + rng.range(0.05, 0.8);
        placeOne(rng.pick(tallKinds), sx + side * off, z + rng.range(-0.8, 0.8));
        if (rng.chance(0.65)) placeOne(rng.pick(tallKinds), sx + side * (off + rng.range(2.6, 4)), z + rng.range(-1.6, 1.6));
      }
    }

    // A fork: the channels' outer sides are tree-lined too, and the risk line is not clear.
    for (let z = z0 + rng.range(1, 6); z < z1; z += rng.range(6.5, 9)) {
      const sh = this.shapeAt(z);
      if (sh.ridge < 0.8 * RIDGE_H) continue;
      const cx = this.centerX(z);
      const hw = this.halfWidth(z);
      for (let side = -1; side <= 1; side += 2) placeOne(rng.pick(tallKinds), cx + side * (hw - rng.range(0.6, 1.6)), z + rng.range(-1, 1));
    }
    for (const r of this.plan.risks) {
      if (r.z < z0 || r.z >= z1) continue;
      const alt = this.altX(r.z);
      if (alt === null) continue;
      const kind = r.tall ? rng.pick(tallKinds) : lowKinds.filter((k) => k !== 'log')[0];
      laying = true;
      placeOne(kind, alt + r.off, r.z);
      laying = false;
    }

    // Spirit gates: two pillars straddling the safe line.
    if (p.gateChance > 0 && rng.chance(p.gateChance)) {
      const gz = z0 + rng.range(10, 54);
      const sx = this.safeX(gz);
      const half = SAFE_LANE + 0.45 + 0.75 + EARLY_MARGIN * (1 - diff);
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
    if (chunk.z0 < 40 || chunk.z0 >= this.finishZ) return;

    // The run-in's gift line swings side to side across the safe line: a first run learns to steer on it.
    for (let k = 0; k * GIFT_RUN_STEP < GIFT_RUN_LEN; k++) {
      const z = GIFT_RUN_Z + k * GIFT_RUN_STEP;
      if (z < chunk.z0 || z >= chunk.z1) continue;
      const u = (k * GIFT_RUN_STEP) / GIFT_RUN_WAVE;
      gifts.push({ id: id++, x: this.safeX(z) + 3.6 * dsin(TAU * u), z, hover: 0.8, value: 1 });
    }

    // Golden gifts down the fork's risk line, the pay for taking it.
    for (let z = chunk.z0 + 8; z < chunk.z1; z += 22) {
      const sh = this.shapeAt(z);
      if (sh.ridge < 0.8 * RIDGE_H) continue;
      const alt = this.altX(z);
      if (alt !== null && !blocked(alt, z)) gifts.push({ id: id++, x: alt, z, hover: 0.8, value: 5 });
    }

    // Gifts along a leap's flight at 30 m/s.
    for (const l of this.plan.leaps) {
      if (l.z + 66 < chunk.z0 || l.z >= chunk.z1) continue;
      const lipY = this.baseY(l.z);
      const sx = this.safeX(l.z);
      const lean = (this.safeX(l.z + 1) - this.safeX(l.z - 1)) / 2;
      for (let k = 1; k <= 6; k++) {
        const t = k * 0.34;
        const z = l.z + 30 * t;
        if (z < chunk.z0 || z >= chunk.z1) continue;
        const y = lipY - LIP_SLOPE * 30 * t - 4.9 * t * t;
        const x = sx + lean * 30 * t;
        gifts.push({ id: id++, x, z, hover: y - this.ground(x, z), value: k === 3 ? 5 : 1 });
      }
    }

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
      const v = lerp(27, 31, diff);
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
