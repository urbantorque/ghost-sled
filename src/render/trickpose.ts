import { TRICK } from '../sim/tricks';

// The rider's pose for every named trick (round 8, G1; the lines are the sim's, tricks.ts TRICKS[id].pose). What the
// sim says the rider is doing in the air (a grab, its side and tier, a tweak, a rail's or a wall's move, the sled's
// own move) and how the sled is turning become one target pose, which rider.ts blends over its airborne pose. A
// combination is read from what is happening at once: a grab while the sled spins is a Paper Wheel, while it flips a
// Crane Fold, both a Spirit Knot; a spin and a flip together an Ember Twist. Presentation only: nothing here is read
// back, and the sim never sees it.
//
// The rig's terms (rider.ts): the body's pitch (negative folds it forward over the knees), roll (negative tips it to
// three.js +x) and yaw; its lift and its shift back off the seat (metres); the crouch; how far it stands on the deck;
// the sled's own roll and yaw under it; each arm's swing (forward), out (away from the side; about 2.5 is straight
// up) and elbow bend (0.18 near straight, about 1.3 folded). Arm 0 is the left (three.js -x), 1 the right.
//
// Pure: no three.js objects, no DOM.

/** What the sim says the rider is doing in the air this frame, as rider.ts reads it. */
export interface TrickIn {
  /** The trick posed now (sim s.move; 0 none). */
  move: number;
  /** A grab's side (-1 three.js -x, 1 +x; 0 none), and its tier (0 to 3). */
  grab: number;
  tier: number;
  /** Ticks a tweak (steer against the grab) has been held. */
  tweak: number;
  /** The sled's turn in the air, rad/s, signed (+ turns toward +x), and its flip, rad/s (either way). */
  spin: number;
  flip: number;
  /** 0 to 1: a deep grab still held as the snow comes up (the rider strains, looks down). */
  danger: number;
  /** Real seconds, for the slow sways (none under reduced motion). */
  time: number;
  calm: boolean;
}

export interface TrickPose {
  /** How much of the pose to take (0: none). The rider eases toward it. */
  k: number;
  /** NaN: keep the flight's own pitch. */
  pitch: number;
  roll: number;
  yaw: number;
  lift: number;
  back: number;
  crouch: number;
  stand: number;
  sledRoll: number;
  sledYaw: number;
  /** Swing, out and bend, left then right. */
  arm: [number, number, number, number];
  bend: [number, number];
  /** How much of each arm the pose takes (a free arm may keep some of the flight's balance). */
  armK: [number, number];
  /** The head's nod (+ down) and the strain's tremble (radians of roll this frame). */
  nod: number;
  shake: number;
  /** The body turns against the sled's own turn by this share (a Spinning Top's rider sits still while the
   *  saucer spins under it). */
  counter: number;
  /** Which family the pose is (for tests and the play-test readout). */
  name: string;
}

/** A spin or a flip is under way past these rates (rad/s). */
export const SPIN_ON = 2.5;
export const FLIP_ON = 2.5;

export function emptyTrickPose(): TrickPose {
  return { k: 0, pitch: NaN, roll: 0, yaw: 0, lift: 0, back: 0, crouch: 0, stand: 0, sledRoll: 0, sledYaw: 0, arm: [0, 0, 0, 0], bend: [0, 0], armK: [0, 0], nod: 0, shake: 0, counter: 0, name: '' };
}

function setArm(o: TrickPose, i: 0 | 1, swing: number, out: number, bend: number, k = 1): void {
  o.arm[i * 2] = swing;
  o.arm[i * 2 + 1] = out;
  o.bend[i] = bend;
  o.armK[i] = k;
}

/** The hand on the rail: straight down beside the knee on the grab's side, the body tipped toward it. */
function railHand(o: TrickPose, side: number, reach = 0.4): void {
  setArm(o, side < 0 ? 0 : 1, reach, 0.12, 0.12);
}

function freeIndex(side: number): 0 | 1 {
  return side < 0 ? 1 : 0;
}

/**
 * The target pose for this frame, into `o` (reused). Returns `o`. A frame with nothing done in the air has k 0.
 */
export function trickPose(t: TrickIn, o: TrickPose = emptyTrickPose()): TrickPose {
  o.k = 0;
  // (NaN: the pose keeps the flight's own pitch, a backflip's tuck.)
  o.pitch = NaN;
  o.roll = o.yaw = o.lift = o.back = o.crouch = o.stand = o.sledRoll = o.sledYaw = o.nod = o.shake = o.counter = 0;
  o.arm[0] = o.arm[1] = o.arm[2] = o.arm[3] = 0;
  o.bend[0] = o.bend[1] = 0;
  o.armK[0] = o.armK[1] = 0;
  o.name = '';
  const spinning = Math.abs(t.spin) >= SPIN_ON;
  const flipping = Math.abs(t.flip) >= FLIP_ON;
  const dir = t.spin >= 0 ? 1 : -1;
  const sway = t.calm ? 0 : Math.sin(t.time * 2.2);
  const m = t.move;
  // The rail's and the wall's moves, and the sled's own, own the pose while they last.
  if (m === TRICK.lamppost) {
    const s = t.grab !== 0 ? t.grab : dir;
    o.name = 'lamppost';
    o.k = 1;
    // One hand left behind on the rail's end, the body leaning out from it as the sled swings round.
    setArm(o, s < 0 ? 0 : 1, -0.45, 1.75, 0.05);
    setArm(o, s < 0 ? 1 : 0, 0.5, 1.1, 0.35, 0.8);
    o.roll = s * 0.45;
    o.pitch = -0.2;
    o.sledRoll = -s * 0.25;
    return o;
  }
  if (m === TRICK.snowHare) {
    const s = t.grab !== 0 ? t.grab : dir;
    o.name = 'snowHare';
    o.k = 1;
    // The sled tipped up on its edge, both legs kicked toward the wall it bounds off, the arms flung out.
    o.sledRoll = s * 0.95;
    o.roll = -s * 0.45;
    o.pitch = 0.1;
    setArm(o, 0, 0.6, 1.45, 0.25);
    setArm(o, 1, 0.6, 1.45, 0.25);
    return o;
  }
  if (m === TRICK.pineBow) {
    o.name = 'pineBow';
    o.k = 1;
    // Up on the sled, a slow bow with both arms out.
    o.stand = 1;
    o.pitch = -0.7 - 0.12 * sway;
    setArm(o, 0, 0.25, 1.65, 0.1);
    setArm(o, 1, 0.25, 1.65, 0.1);
    o.nod = 0.25;
    return o;
  }
  if (m === TRICK.spinningTop) {
    o.name = 'spinningTop';
    o.k = 1;
    // Upright and still, arms folded, while the saucer spins flat under it.
    o.pitch = 0.08;
    o.counter = 1;
    setArm(o, 0, 1.25, 0.08, 1.55);
    setArm(o, 1, 1.25, 0.08, 1.55);
    return o;
  }
  if (m === TRICK.fireside) {
    o.name = 'fireside';
    o.k = 1;
    // Sitting back at ease in the seat, hands behind the head, elbows wide, chin up: held and relaxed, the sled
    // level under it. (From the chase lens any real lean back brings the head toward the lens: laid flat, and even
    // half back, it read as a wipeout.)
    o.pitch = 0.18;
    setArm(o, 0, -0.2, 2.35, 2.05);
    setArm(o, 1, -0.2, 2.35, 2.05);
    o.nod = -0.12;
    return o;
  }
  if (m === TRICK.cometTail) {
    o.name = 'cometTail';
    o.k = 1;
    // Stretched back off the seat over the sled's tail, one hand firm on the runner and the other arm out wide for
    // balance, head up to the way ahead: a streamed, held line, the sled under it. (Streamed out flat behind and off it,
    // or even half back, it read as a fall from the chase lens.)
    o.back = 0.14;
    o.lift = 0.06;
    o.pitch = 0.3;
    setArm(o, 0, 2.2, 0.25, 0.15);
    setArm(o, 1, 0.5, 1.6, 0.15, 0.9);
    o.nod = 0.05;
    return o;
  }
  if (m === TRICK.willowisp) {
    o.name = 'willowisp';
    o.k = 1;
    // Floating a hand above the seat, both hands off, the arms loose like a drifting light.
    o.lift = 0.22 + 0.04 * sway;
    o.pitch = -0.05;
    setArm(o, 0, 0.45 + 0.1 * sway, 1.25, 0.45);
    setArm(o, 1, 0.45 - 0.1 * sway, 1.25, 0.45);
    return o;
  }
  if (m === TRICK.teacup) {
    o.name = 'teacup';
    o.k = 1;
    // Cross-legged, turning the tray slowly with both hands on its rim.
    o.pitch = -0.32;
    o.counter = 0.5;
    setArm(o, 0, 1.1, 0.45, 0.6);
    setArm(o, 1, 1.1, 0.45, 0.6);
    return o;
  }
  if (t.grab !== 0) {
    const s = t.grab;
    const free = freeIndex(s);
    o.k = 1;
    railHand(o, s);
    o.roll = -s * 0.3;
    if (spinning && flipping) {
      // Spirit Knot: balled up, one hand on the rail, tumbling off axis.
      o.name = 'spiritKnot';
      o.crouch = 1;
      o.pitch = -0.75;
      o.roll = -s * 0.45 + dir * 0.25;
      setArm(o, free, 1.0, 0.18, 1.3);
    } else if (flipping) {
      // Crane Fold: folded over the sled, a hand on its nose, legs tucked.
      o.name = 'craneFold';
      o.crouch = 1;
      o.pitch = -1.0;
      setArm(o, s < 0 ? 0 : 1, 1.55, 0.14, 0.1);
      setArm(o, free, 0.95, 0.2, 1.25);
    } else if (spinning) {
      // Paper Wheel: crouched low, both hands on the rail, the sled spinning flat.
      o.name = 'paperWheel';
      o.crouch = 1;
      o.pitch = -0.55;
      o.roll = -s * 0.42;
      setArm(o, free, 0.75, -0.05, 0.3);
    } else if (t.tier >= 3) {
      // Spirit Stretch: one hand on the rail, the body laid out flat in the air beside the sled.
      o.name = 'spiritStretch';
      o.pitch = -0.45;
      o.roll = s * 0.95;
      o.lift = 0.12;
      setArm(o, free, 1.95, 1.15, 0.05);
    } else if (t.tier >= 2) {
      // Lantern Reach: one hand on the rail, the other straight up as if hanging a lantern.
      o.name = 'lanternReach';
      o.pitch = -0.3;
      setArm(o, free, 0.15, 2.9, 0.05);
    } else {
      // Rail Grab: knees bent, a hand on the rail, the other out for balance.
      o.name = 'railGrab';
      o.crouch = 0.8;
      o.pitch = -0.5;
      setArm(o, free, 0.3, 1.4, 0.25, 0.85);
    }
    // Crosswind: the grabbed sled shoved out sideways against the grab, the body leaning the other way.
    if (t.tweak > 0) {
      const w = Math.min(1, t.tweak / 8);
      o.name = o.name + '+crosswind';
      o.sledYaw = -s * 0.6 * w;
      o.sledRoll = s * 0.38 * w;
      o.roll += s * 0.55 * w;
    }
    // A deep grab still held as the snow comes up: the rider strains against it and looks down at the snow.
    if (t.danger > 0) {
      o.nod = 0.4 * t.danger;
      o.shake = t.calm ? 0 : Math.sin(t.time * 43) * 0.07 * t.danger;
      // (The free hand claws at the air.)
      if (!t.calm) o.arm[free * 2 + 1] += Math.sin(t.time * 29) * 0.25 * t.danger;
    }
    return o;
  }
  if (spinning && flipping) {
    // Ember Twist: an off-axis corkscrew, shoulders leading, knees in.
    o.name = 'emberTwist';
    o.k = 1;
    o.crouch = 0.9;
    o.roll = dir * 0.5;
    o.yaw = dir * 0.4;
    o.sledRoll = dir * 0.35;
    setArm(o, 0, 0.95, 0.22, 1.25);
    setArm(o, 1, 0.95, 0.22, 1.25);
    return o;
  }
  if (flipping) {
    // Backflip: tucked tight, knees to the chest, both hands on the sled.
    o.name = 'backflip';
    o.k = 1;
    o.crouch = 1;
    setArm(o, 0, 1.15, 0.22, 0.65);
    setArm(o, 1, 1.15, 0.22, 0.65);
    return o;
  }
  if (spinning) {
    // Spin: the upper body wound into the turn, arms pulled in, the sled flat.
    o.name = 'spin';
    o.k = 1;
    o.pitch = -0.25;
    o.yaw = dir * 0.38;
    setArm(o, 0, 0.9, 0.25, 1.3);
    setArm(o, 1, 0.9, 0.25, 1.3);
    return o;
  }
  return o;
}

/** A deep grab (tier 2 on, or the sled's own move held to the tier where it falls) still held as the snow comes
 *  up: 0 until `lead` seconds out, 1 at touchdown. */
export function grabDanger(deep: boolean, timeToLand: number, lead = 0.55): number {
  if (!deep || !(timeToLand < lead)) return 0;
  return Math.max(0, Math.min(1, 1 - timeToLand / lead));
}
