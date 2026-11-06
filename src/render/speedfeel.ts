// How fast it feels, in one place. Cruise rose to about 30 m/s with peaks at 41 to 46, and every
// presentation system was tuned for 22 and full by 36 to 38, so a run sat on the end stop. Every speed
// curve now reads off the same range: 28 m/s already feels fast, 46 is on the edge of control, and
// nothing runs out early. All of it is pure and presentation only: it reads a speed and never the sim.

/** The sim's speed cap (sim.ts MAX_SPEED; a test holds them together). */
export const TOP_SPEED = 46;
/** Metres of road a player needs to see at speed: this many seconds' worth (the readability target). */
export const READ_S = 1.5;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/** The even climb from a crawl to the cap: 0 at 8 m/s, 1 at 46. */
export function speedK(v: number): number {
  return clamp01((v - 8) / 38);
}

/** How fast this feels: calm to 15 m/s, 0.6 by 28 (already fast), then a long even climb that only
 *  reaches 1 at the cap. It never flattens before the cap. */
export function fastK(v: number): number {
  return 0.6 * smooth01((v - 15) / 13) + 0.4 * Math.pow(clamp01((v - 28) / 18), 1.15);
}

/** The last stretch, 0 to 36 m/s and 1 at the cap: the edge of control. */
export function edgeK(v: number): number {
  return smooth01((v - 36) / 10);
}

/** The chase lens's vertical FOV for a speed (degrees), before kicks: 62 at a calm 15 m/s or under,
 *  about 73 at 30 and 79 at the cap. */
export function chaseFov(v: number): number {
  return 62 + 3 * speedK(v) + 14 * fastK(v);
}

/** The radial speed streaks (post.ts): 0 to 24 m/s, about a quarter at 30, all of it only at the cap. */
export function streakK(v: number): number {
  return Math.pow(clamp01((v - 24) / 22), 1.2);
}

/** The lens's rumble over the snow: 0 to 22 m/s, under half at 30, all of it only at the cap. */
export function rumbleK(v: number): number {
  return Math.pow(clamp01((v - 22) / 24), 1.1);
}

/** The near field's flake density (nearfield.ts), 0 to 1. */
export function nearK(v: number): number {
  return fastK(v);
}

/** The share of flakes that skim the snow beside the sled: none at 18 m/s, 0.3 at 30, 0.55 at the cap. */
export function skimShare(v: number): number {
  return 0.55 * smooth01((v - 18) / 28);
}

/** How far ahead of the lens flakes are hung (metres). The lens covers 16 m in a third of a second at
 *  the cap, so a fixed band of air was gone before a flake could streak: it holds about half a second. */
export function flurryReach(v: number): number {
  return Math.max(13, v * 0.5);
}

/** The runners' kick off their tails: 0 to 16 m/s, half by 24, full at the cap. */
export function kickK(v: number): number {
  return 0.55 * smooth01((v - 16) / 10) + 0.45 * clamp01((v - 26) / 20);
}

/** Past a full rooster tail (fastK's end): how much bigger the spray stands at speed, 0 to 28 m/s, 1 at
 *  the cap. */
export function roosterK(v: number): number {
  return clamp01((v - 28) / 18);
}

/** How far the chase lens sits behind its set point (the follow's lag adds speed / FOLLOW_RATE metres
 *  on top): closes in with speed, so the rider keeps its size while the lag still lets a boost surge
 *  away from the lens. */
export function chaseBack(v: number): number {
  return 2.2 - 0.06 * Math.min(v, TOP_SPEED);
}

/** The chase lens's height over the sled: it rises with speed instead of dropping toward the snow, so
 *  the road ahead spreads down the frame and comes clear of the rider. */
export function chaseUp(v: number): number {
  return 1.05 + 0.2 * speedK(v) + 0.5 * fastK(v);
}

/** The rider's middle on the screen (NDC y): sinks a little with speed, opening the road above it. */
export function chaseRow(v: number): number {
  return -0.22 - 0.1 * fastK(v);
}

/** Metres down the road the chase's look reaches for: 1.5 s of travel, so the corner coming is framed
 *  before it arrives. */
export function lookReach(v: number): number {
  return Math.max(20, v * READ_S);
}

/** How much of the way the look turns toward that point: a touch at a cruise, a good part at speed. */
export function lookLead(v: number): number {
  return 0.12 + 0.33 * fastK(v);
}

/** Wind and roar audio: how full the bed stands, 0 at 6 m/s and 1 only at the cap. */
export function windK(v: number): number {
  return smooth01((v - 6) / (TOP_SPEED - 6));
}

