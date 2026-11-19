import { Rng, hash32 } from './prng';

// Charms (round 8, G2): every run is a build. Three times a run three spirit gates stand across the course, and the
// arch a rider is in as it crosses the gate's line is its charm for the rest of the run: no menu and no stop. The
// middle arch stands on the safe line and always holds the survival family's offer (a rider who does nothing takes
// it); speed and style take the sides, which side by a seeded coin. Picks stack, and some pairs have names.
//
// Which three a gate offers comes from the run's roll seed and the rider's charm pool (a mask the game widens through
// the Almanac; the record carries it), so a ghost replays exactly with its own offers and its own picks, which are in
// its line. What each charm does is the sim's (sim.ts, `has`); this file names them and deals the offers.
//
// Pure: no DOM, render or audio imports.

export type CharmFamily = 'speed' | 'style' | 'survival';

export const CHARM = {
  slip: 0,
  comet: 1,
  kite: 2,
  frost: 3,
  star: 4,
  drum: 5,
  step: 6,
  stride: 7,
  owl: 8,
  hearth: 9,
  paper: 10,
  whirl: 11,
  memory: 12,
  festival: 13,
  bell: 14,
  spirit: 15,
  second: 16,
  feather: 17,
  stone: 18,
  bark: 19,
  lamp: 20,
  path: 21,
  quick: 22,
  wisp: 23,
} as const;
export type CharmId = (typeof CHARM)[keyof typeof CHARM];
export const CHARM_COUNT = 24;

export interface CharmDef {
  id: CharmId;
  key: string;
  family: CharmFamily;
  name: string;
  /** What it does, in the player's words (the gate's card, the Almanac). */
  does: string;
  /** The one thing on screen that says it is working (the presentation lanes draw it). */
  signal: string;
}

export const CHARMS: readonly CharmDef[] = [
  { id: 0, key: 'slip', family: 'speed', name: 'Slipstream Lantern', does: 'Drafting lights your lantern', signal: "The lantern's flame leans toward the ghost ahead as it fills" },
  { id: 1, key: 'comet', family: 'speed', name: "Comet's Tail", does: 'Dashes last far longer and run faster, but a full lantern never wards', signal: 'The lantern drawn without its ward ring' },
  { id: 2, key: 'kite', family: 'speed', name: 'Kite String', does: 'Slingshots come twice as quick, pay more and light more', signal: 'A taut thread of light to the ghost while drafting' },
  { id: 3, key: 'frost', family: 'speed', name: 'Frost Runners', does: 'Ice holds and runs fast under you; drifts on snow charge slower', signal: 'Blue sparks off the runners on ice' },
  { id: 4, key: 'star', family: 'speed', name: 'Falling Star', does: 'A drop landed well becomes far more speed; a sketchy landing costs more', signal: 'A streak off the sled on a big landing' },
  { id: 5, key: 'drum', family: 'speed', name: 'Drift Drum', does: 'Drifts charge faster and pay more, but only start at speed', signal: 'The drift ring beats with its tiers' },
  { id: 6, key: 'step', family: 'speed', name: 'Ember Step', does: 'A dash right after a perfect landing costs half a lantern', signal: 'The lantern pulses while the half price is open' },
  { id: 7, key: 'stride', family: 'speed', name: 'Long Stride', does: 'A deeper tuck, but you hardly steer while tucked', signal: 'The rider tucked lower, a wind line off the helmet' },
  { id: 8, key: 'owl', family: 'style', name: "Owl's Breath", does: 'Near misses keep your combo going longer', signal: 'The combo ring refills on a whisker' },
  { id: 9, key: 'hearth', family: 'style', name: 'Hearthstone', does: 'The first perfect landing after a dash gives the lantern back', signal: 'An empty cell outlined after a dash, filled by the stomp' },
  { id: 10, key: 'paper', family: 'style', name: 'Paper Kite', does: 'Grabs come sooner and pay more; spins turn slower', signal: 'Paper ribbons off the rider at each grab tier' },
  { id: 11, key: 'whirl', family: 'style', name: 'Whirlwind', does: 'Spins faster and big spins pay more; flips turn slower', signal: 'A ring of snow off a spin' },
  { id: 12, key: 'memory', family: 'style', name: "Crane's Memory", does: 'A trick new to the run pays triple; a repeat pays half', signal: "A new trick's call drawn gilded" },
  { id: 13, key: 'festival', family: 'style', name: 'Festival Drum', does: 'The multiplier climbs faster, but a bump loses the combo', signal: 'The multiplier beats on each step' },
  { id: 14, key: 'bell', family: 'style', name: 'Bell Rope', does: 'Rails take you from further off and pay double', signal: 'Rails ring as you near them' },
  { id: 15, key: 'spirit', family: 'style', name: 'Spirit Drum', does: 'Spirit Flow climbs twice as fast; a bump costs more of it', signal: "The flow state's picture comes sooner" },
  { id: 16, key: 'second', family: 'survival', name: 'Second Wind', does: 'A fall costs no get-up, but empties the lantern', signal: 'The lantern gutters out on a fall' },
  { id: 17, key: 'feather', family: 'survival', name: 'Featherfall', does: 'Once a stage a landing that would floor you is only sketchy; tricks pay less', signal: "A feather on the lantern while the stage's spare is held" },
  { id: 18, key: 'stone', family: 'survival', name: 'Stone Lantern', does: 'A ward costs half a lantern and keeps your speed; a dash costs one and a half', signal: "The lantern's cells drawn in halves" },
  { id: 19, key: 'bark', family: 'survival', name: 'Bark Skin', does: 'Bumps keep your combo and hardly shake you; a little less top speed', signal: 'Snow shed off the rider on a bump instead of a stagger' },
  { id: 20, key: 'lamp', family: 'survival', name: 'Last Lamp', does: 'Out of get-ups, the next fall is warded even with an empty lantern, once a stage', signal: 'A small ember in the empty lantern when the get-ups run out' },
  { id: 21, key: 'path', family: 'survival', name: 'Lamplit Path', does: 'The safe line carries sparks for you; great lights off it light less', signal: 'The sparks themselves' },
  { id: 22, key: 'quick', family: 'survival', name: 'Quick Feet', does: "Falls are shorter and you get up faster, but a fall loses the lantern's part-lit cell", signal: 'The rider springs up' },
  { id: 23, key: 'wisp', family: 'survival', name: 'Guardian Wisp', does: 'A wisp takes the first hit each stage; lights fill the lantern slower', signal: 'A wisp circling the rider until it is spent' },
];

export interface Synergy {
  id: number;
  key: string;
  name: string;
  a: CharmId;
  b: CharmId;
  adds: string;
}

/** Pairs with a name: held together they add one rule (sim.ts). */
export const SYNERGIES: readonly Synergy[] = [
  { id: 0, key: 'ghostRider', name: 'Ghost Rider', a: CHARM.slip, b: CHARM.kite, adds: 'Every slingshot lights a whole cell' },
  { id: 1, key: 'cometChain', name: 'Comet Chain', a: CHARM.comet, b: CHARM.step, adds: 'A perfect landing during a dash adds a second to it' },
  { id: 2, key: 'phoenix', name: 'Phoenix', a: CHARM.second, b: CHARM.quick, adds: 'You get up from a fall into a short dash, no lantern spent' },
  { id: 3, key: 'paperStorm', name: 'Paper Storm', a: CHARM.paper, b: CHARM.whirl, adds: 'Paper Wheels pay double' },
  { id: 4, key: 'nightChorus', name: 'Night Chorus', a: CHARM.owl, b: CHARM.festival, adds: 'A near miss counts two links' },
  { id: 5, key: 'shrineKeeper', name: 'Shrine Keeper', a: CHARM.stone, b: CHARM.wisp, adds: 'A ward lights a third of a cell back' },
  { id: 6, key: 'blackIce', name: 'Black Ice', a: CHARM.frost, b: CHARM.drum, adds: 'Drifts on ice charge double and never wobble' },
];

export const ALL_CHARMS = (1 << CHARM_COUNT) - 1;

/** What a first-timer may be offered: two a family. The Almanac adds the rest (the game layer's charmPoolOf). */
export const STARTER_POOL = (1 << CHARM.comet) | (1 << CHARM.stride) | (1 << CHARM.owl) | (1 << CHARM.hearth) | (1 << CHARM.second) | (1 << CHARM.wisp);

/** A gate's arches: the middle one is centred on the safe line, the others this far either side, each this wide.
 *  Lane 0 is toward -x, 1 the middle, 2 toward +x; the outer lanes run on to the walls. */
export const LANE_W = 4.6;
/** Where the gates stand: the start's on its run-in, the rest this far past each stage line. */
export const START_GATE_Z = 110;
export const GATE_PAST_LINE = 100;

/** Lamplit Path's sparks: one on the safe line (0.8 m up) at every multiple of PATH_STEP metres from where the charm
 *  was taken to the finish, for the rider who holds it; their light ids are PATH_ID0 + z / PATH_STEP. */
export const PATH_STEP = 15;
export const PATH_ID0 = 20_000_000;

/** A charm gate as the run meets it: where, which charm each lane offers (-1 none), and what was taken. */
export interface CharmGate {
  index: number;
  z: number;
  /** The safe line's x at the gate: the middle arch's centre. */
  x: number;
  offers: [number, number, number];
  /** The lane taken (-1 not yet), and the charm it gave (-1 none). */
  lane: number;
  pick: number;
}

/** The lane x is in at a gate whose middle arch is centred at `cx`. */
export function laneOf(cx: number, x: number): 0 | 1 | 2 {
  return x < cx - LANE_W / 2 ? 0 : x > cx + LANE_W / 2 ? 2 : 1;
}

/** The lane's arch centre. */
export function laneX(cx: number, lane: number): number {
  return cx + (lane - 1) * LANE_W;
}

export function charmFamily(id: number): CharmFamily {
  return CHARMS[id]?.family ?? 'survival';
}

/** The three a gate offers, by lane (left, middle, right; -1 for an empty arch): one of each family drawn from the
 *  pool less what is held, survival in the middle, a family with none left filled from the others. */
export function offersFor(chaosSeed: number, gate: number, pool: number, held: readonly number[]): [number, number, number] {
  const rng = new Rng(hash32(chaosSeed >>> 0, gate, 0xc4a2));
  const has = (id: number) => (pool & (1 << id)) !== 0 && !held.includes(id);
  const of = (f: CharmFamily) => CHARMS.filter((c) => c.family === f && has(c.id)).map((c) => c.id as number);
  const taken = new Set<number>();
  const draw = (list: number[]): number => {
    const free = list.filter((id) => !taken.has(id));
    if (!free.length) return -1;
    const id = free[rng.int(0, free.length - 1)];
    taken.add(id);
    return id;
  };
  let mid = draw(of('survival'));
  let a = draw(of('speed'));
  let b = draw(of('style'));
  const rest = CHARMS.filter((c) => has(c.id)).map((c) => c.id as number);
  if (mid < 0) mid = draw(rest);
  if (a < 0) a = draw(rest);
  if (b < 0) b = draw(rest);
  return rng.chance(0.5) ? [a, mid, b] : [b, mid, a];
}

/** The named pairs a mask of held charms makes. */
export function synergiesOf(mask: number): Synergy[] {
  return SYNERGIES.filter((s) => (mask & (1 << s.a)) !== 0 && (mask & (1 << s.b)) !== 0);
}
