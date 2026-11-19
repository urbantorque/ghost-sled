// The air's named tricks (round 8, G1): what a flight is called and what it pays, from what was done in it.
//
// One steer and one button, no new bit in the input byte. In the air:
//   steer to a side               spins (as ever)
//   the button, steer centred     flips: the press decides in its first 7 ticks, the flip's own latch
//   the button, steer to a side   grabs on that side, held as long as you dare: tiers at 0.25, 0.67 and 1.25 s
//     while grabbing, steer with the grab's side spins (a little slower), against it tweaks, centred holds still
//   let go of a grab in the last 9 ticks before touchdown    a stomp (a perfect landing), as a press there is
//   still holding a deep grab (tier 2 or more) at touchdown   a fall, on a committed flight (a short grab is
//                                                            let go by the rider itself as it sets for the landing)
//   two quick taps, steer centred  the sled's own move (its signature)
//   the button in a flight off a rail's end, or off a wall ride: a move found nowhere else
// A flight's tricks are named once it lands, from everything done in it (a spin and a grab are a Paper Wheel
// whichever came first), so a sequence of simple gestures is a named combination.
//
// The sim names each trick by id in its events; the game turns an id into a name, a sound and a pose. Names
// are this world's (spirits, lanterns, mountains) or plain sport words.
//
// Pure: no DOM, render or audio imports.

export const TRICK = {
  none: 0,
  spin: 1,
  backflip: 2,
  railGrab: 3,
  lanternReach: 4,
  spiritStretch: 5,
  paperWheel: 6,
  craneFold: 7,
  emberTwist: 8,
  spiritKnot: 9,
  crosswind: 10,
  lamppost: 11,
  snowHare: 12,
  pineBow: 13,
  spinningTop: 14,
  fireside: 15,
  cometTail: 16,
  willowisp: 17,
  teacup: 18,
} as const;
export type TrickId = (typeof TRICK)[keyof typeof TRICK];

export type TrickFamily = 'spin' | 'flip' | 'grab' | 'combo' | 'tweak' | 'special' | 'signature';

export interface TrickDef {
  id: TrickId;
  key: string;
  name: string;
  family: TrickFamily;
  /** How it is done, in the player's words (the Almanac's line). */
  how: string;
  /** The rider's pose, for the rider lane (rider.ts). */
  pose: string;
}

export const TRICKS: readonly TrickDef[] = [
  { id: 0, key: 'none', name: '', family: 'spin', how: '', pose: '' },
  { id: 1, key: 'spin', name: 'Spin', family: 'spin', how: 'Steer in the air (called by its size: 180, 360, 540, 720)', pose: 'Upper body wound into the turn, arms pulled in, the sled flat under the rider.' },
  { id: 2, key: 'backflip', name: 'Backflip', family: 'flip', how: 'Hold the button in the air, steer centred', pose: 'Tucked tight, knees to the chest, both hands on the sled.' },
  { id: 3, key: 'railGrab', name: 'Rail Grab', family: 'grab', how: 'Press the button while steering to a side, hold a quarter second', pose: 'Knees bent, one hand down on the sled\'s side rail, the other out for balance.' },
  { id: 4, key: 'lanternReach', name: 'Lantern Reach', family: 'grab', how: 'Hold a grab past two thirds of a second', pose: 'One hand on the rail, the other arm stretched straight up as if hanging a lantern.' },
  { id: 5, key: 'spiritStretch', name: 'Spirit Stretch', family: 'grab', how: 'Hold a grab past a second and a quarter', pose: 'One hand on the rail, the body laid out flat in the air beside the sled, legs trailing like a spirit\'s.' },
  { id: 6, key: 'paperWheel', name: 'Paper Wheel', family: 'combo', how: 'Spin and grab in one flight', pose: 'Crouched low, both hands on the rail, the sled spinning flat like a paper wheel.' },
  { id: 7, key: 'craneFold', name: 'Crane Fold', family: 'combo', how: 'Flip and grab in one flight', pose: 'Folded over the sled through the flip, one hand on its nose, legs tucked like a paper crane.' },
  { id: 8, key: 'emberTwist', name: 'Ember Twist', family: 'combo', how: 'Spin and flip in one flight', pose: 'An off-axis corkscrew: shoulders leading, knees in, the sled tilted through the turn.' },
  { id: 9, key: 'spiritKnot', name: 'Spirit Knot', family: 'combo', how: 'Spin, flip and grab in one flight', pose: 'Balled up on the sled, one hand on the rail, tumbling off axis.' },
  { id: 10, key: 'crosswind', name: 'Crosswind', family: 'tweak', how: 'Steer against a held grab (late in the flight it pays most)', pose: 'The grabbed sled shoved out sideways against the grab, the body leaning the other way.' },
  { id: 11, key: 'lamppost', name: 'Lamppost Swing', family: 'special', how: 'Press the button just off a rail\'s end', pose: 'One hand left on the rail\'s end, the sled swung round it a half turn.' },
  { id: 12, key: 'snowHare', name: 'Snow Hare', family: 'special', how: 'Press the button just off a wall ride', pose: 'Both legs kicked out toward the wall, the sled tipped up on its edge, a bound back into the run.' },
  { id: 13, key: 'pineBow', name: 'Pine Bow', family: 'signature', how: 'Double tap in the air on the Pine Flyer', pose: 'Standing on the sled, a slow bow with both arms out.' },
  { id: 14, key: 'spinningTop', name: 'Spinning Top', family: 'signature', how: 'Double tap in the air on the Whirl Saucer', pose: 'Sitting still and upright while the saucer spins flat under the rider.' },
  { id: 15, key: 'fireside', name: 'Fireside', family: 'signature', how: 'Double tap in the air on the Lodge Toboggan', pose: 'Lying back along the toboggan, hands behind the head, boots up.' },
  { id: 16, key: 'cometTail', name: 'Comet Tail', family: 'signature', how: 'Double tap in the air on the Comet Bob', pose: 'Let go and trailing behind the sled from one runner, body streamed out flat.' },
  { id: 17, key: 'willowisp', name: 'Will-o\'-Wisp', family: 'signature', how: 'Double tap in the air on the Wisp', pose: 'Floating a hand above the sled, both hands off, arms loose like a drifting light.' },
  { id: 18, key: 'teacup', name: 'Teacup', family: 'signature', how: 'Double tap in the air on the Tea Tray', pose: 'Sitting cross-legged, turning the tray slowly with both hands.' },
];

/** Each sled's own move, by sled id (sleds.ts): what a double tap in the air does on it. */
export const SIGNATURE: readonly TrickId[] = [TRICK.pineBow, TRICK.spinningTop, TRICK.fireside, TRICK.cometTail, TRICK.willowisp, TRICK.teacup];

/** Grab tiers: ticks held for each. */
export const GRAB_T1 = 15;
export const GRAB_T2 = 40;
export const GRAB_T3 = 75;
/** A press decides in this many ticks: a side in its first GRAB_LATCH is a grab (a key pressed with the button
 *  reaches a side in 3), and still centred at LATCH_TICKS it is a flip (the flip's own latch). A side found
 *  between the two is a spin on a flip: an Ember Twist. */
export const GRAB_LATCH = 4;
export const LATCH_TICKS = 7;
/** Steer past this either way, as a press decides, is a side. */
export const GRAB_STEER = 0.5;
/** A grab let go this close to touchdown is a stomp. */
export const LET_GO_TICKS = 9;
/** A tweak counts once held this long; one held within this many ticks of touchdown is late. */
export const TWEAK_MIN = 8;
export const TWEAK_LATE = 30;
/** Two taps: the first no longer than this, the second this soon after it. */
export const TAP_TICKS = 6;
export const DOUBLE_GAP = 12;
/** A rail's or a wall's own move: pressed within this many ticks of leaving it, and how long it lasts. */
export const SPECIAL_WINDOW = 24;
export const SPECIAL_TICKS = 24;

export function grabTier(ticks: number): number {
  return ticks >= GRAB_T3 ? 3 : ticks >= GRAB_T2 ? 2 : ticks >= GRAB_T1 ? 1 : 0;
}

/** What one flight held, read at touchdown. */
export interface FlightTricks {
  halfTurns: number;
  flips: number;
  /** Longest grab held, ticks (0: none). */
  grabTicks: number;
  /** Ticks a tweak was held, and whether it was held late. */
  tweakTicks: number;
  tweakLate: boolean;
  /** A rail's or a wall's move (TRICK.lamppost, TRICK.snowHare), or 0. */
  special: number;
  /** The sled's own move held this long (0: none), and which it was. */
  sigTicks: number;
  sig: number;
}

export interface TrickLanded {
  id: TrickId;
  /** Points before the landing's quality and the run's multipliers. */
  points: number;
  /** Lantern charge (sim.ts charge units). */
  units: number;
  /** For the call: the spin's half turns, the flips, the grab's tier, a late tweak. */
  halfTurns: number;
  flips: number;
  tier: number;
  late: boolean;
}

function spinPoints(h: number): number {
  return h > 0 ? 150 * h * (1 + 0.25 * (h - 1)) : 0;
}

/** The sled's own move, by sled (round 8, G1): each a sidegrade, and none touches speed or the lantern beyond what
 *  any trick lights.
 *    Pine Bow       pays as a second-tier grab from the first tier on; held at touchdown it is deep from there
 *    Spinning Top   while held the saucer spins at full rate by itself (the steer is free) and the landing set
 *                   cannot stop it: let go in time. Each half turn pays half again over a spin
 *    Fireside       held at touchdown it is sketchy, never a fall; it pays only to the second tier
 *    Comet Tail     tiers 30% sooner and pays 1.3x, but held at touchdown it is a fall from the first tier
 *    Will-o'-Wisp   pays as the third tier from the second, but no air control and no spin while held
 *    Teacup         a slow spin at half rate by itself that the set always lands; each half turn pays double, and
 *                   held at touchdown the rider lets go as it lands */
export function sigTier(sig: number, ticks: number): number {
  if (ticks < GRAB_T1) return 0;
  const t = grabTier(sig === TRICK.cometTail ? Math.floor((ticks * 10) / 7) : ticks);
  if (sig === TRICK.pineBow) return t < 2 ? 2 : t;
  if (sig === TRICK.fireside) return t > 2 ? 2 : t;
  if (sig === TRICK.willowisp) return t >= 2 ? 3 : t;
  return t;
}

/** The tier at which the sled's own move, still held at touchdown on a committed flight, is a fall (99: never). */
export function sigFallTier(sig: number): number {
  return sig === TRICK.fireside || sig === TRICK.teacup ? 99 : sig === TRICK.cometTail ? 1 : 2;
}

function sigNamed(f: FlightTricks): boolean {
  return f.sig > 0 && f.sigTicks >= GRAB_T1;
}

function sigPoints(sig: number, ticks: number, halfTurns: number): number {
  if (sig === TRICK.spinningTop) return 60 + spinPoints(halfTurns) * 1.5;
  if (sig === TRICK.teacup) return 60 + spinPoints(halfTurns) * 2;
  const t = sigTier(sig, ticks);
  const base = t === 3 ? 280 : t === 2 ? 150 : t === 1 ? 60 : 0;
  const past = sig === TRICK.fireside || ticks <= GRAB_T3 ? 0 : ((ticks - GRAB_T3) * 120) / 60;
  return (base + past) * (sig === TRICK.cometTail ? 1.3 : 1.2);
}

function grabPoints(ticks: number): number {
  const t = grabTier(ticks);
  if (t === 0) return 0;
  const base = t === 3 ? 280 : t === 2 ? 150 : 60;
  // As long as you dare: past the third tier every second held is worth more.
  return base + (ticks > GRAB_T3 ? ((ticks - GRAB_T3) * 120) / 60 : 0);
}

/** Names a flight: the rotation and the grab as one named trick, then a tweak, a rail's or wall's move and the
 *  sled's own move each as their own. Nothing named for a flight with nothing done in it. */
export function nameFlight(f: FlightTricks): TrickLanded[] {
  const out: TrickLanded[] = [];
  const tier = grabTier(f.grabTicks);
  // (The swing round a rail's end is its own half turn: not a spin as well. Nor is a Spinning Top's or a Teacup's
  // spin: the sled's own move is the spin.)
  const own = sigNamed(f) && (f.sig === TRICK.spinningTop || f.sig === TRICK.teacup);
  const h = own ? 0 : f.special === TRICK.lamppost && f.halfTurns > 0 ? f.halfTurns - 1 : f.halfTurns;
  const fl = f.flips;
  const sp = spinPoints(h);
  const fp = 600 * fl;
  const gp = grabPoints(f.grabTicks);
  const gu = tier === 3 ? 14 : tier === 2 ? 8 : tier === 1 ? 4 : 0;
  const t = (id: TrickId, points: number, units: number): void => {
    out.push({ id, points: Math.round(points), units, halfTurns: h, flips: fl, tier, late: false });
  };
  if (tier > 0 && h > 0 && fl > 0) t(TRICK.spiritKnot, (sp + fp + gp) * 1.1, 4 + 8 * fl + gu);
  else if (tier > 0 && h > 0) t(TRICK.paperWheel, sp + gp, 4 + gu);
  else if (tier > 0 && fl > 0) t(TRICK.craneFold, fp + gp, 8 * fl + gu);
  else if (h > 0 && fl > 0) t(TRICK.emberTwist, sp + fp, 4 + 8 * fl);
  else if (tier > 0) t(tier === 3 ? TRICK.spiritStretch : tier === 2 ? TRICK.lanternReach : TRICK.railGrab, gp, gu);
  else if (h > 0) t(TRICK.spin, sp, 4);
  else if (fl > 0) t(TRICK.backflip, fp, 8);
  if (f.tweakTicks >= TWEAK_MIN && tier > 0) {
    out.push({ id: TRICK.crosswind, points: f.tweakLate ? 350 : 150, units: f.tweakLate ? 10 : 6, halfTurns: h, flips: fl, tier, late: f.tweakLate });
  }
  if (f.special === TRICK.lamppost) t(TRICK.lamppost, 300, 10);
  else if (f.special === TRICK.snowHare) t(TRICK.snowHare, 250, 10);
  if (sigNamed(f)) {
    const st = sigTier(f.sig, f.sigTicks);
    const units = st === 3 ? 14 : st === 2 ? 8 : 4;
    out.push({ id: f.sig as TrickId, points: Math.round(sigPoints(f.sig, f.sigTicks, f.halfTurns)), units, halfTurns: f.halfTurns, flips: fl, tier: st, late: false });
  }
  return out;
}

/** A trick's call on screen: its name, a spin's size, a double flip, a late tweak. */
export function trickCall(id: number, halfTurns = 0, flips = 0, late = false): string {
  const t = TRICKS[id];
  if (!t || id === TRICK.none) return '';
  if (id === TRICK.spin) return `Spin ${halfTurns * 180}`;
  if (id === TRICK.backflip) return flips >= 3 ? `${flips} Backflips` : flips === 2 ? 'Double Backflip' : 'Backflip';
  if (id === TRICK.crosswind) return late ? 'Late Crosswind' : t.name;
  if ((id === TRICK.paperWheel || id === TRICK.emberTwist || id === TRICK.spiritKnot) && halfTurns > 1) return `${t.name} ${halfTurns * 180}`;
  return t.name;
}
