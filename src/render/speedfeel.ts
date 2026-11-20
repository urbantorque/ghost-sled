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

/** The radial speed streaks (post.ts), round 8: kept to the frame's outer band, 0 to 24 m/s, about a sixth
 *  at 30 and 0.8 at the cap. It carried the speed on the lens (a quarter at 30, all of it at the cap, from a
 *  third of the way in); the world rushing past carries it now. */
export function streakK(v: number): number {
  return 0.8 * Math.pow(clamp01((v - 24) / 22), 1.2);
}

/** Round 8: the chatter of hard snow under the runners, 0 to 1 (the sled's and the lens's fine shake): none
 *  under 14 m/s, a little by 22, about half at 30, all of it only at the cap. `hard` is the surface: 0 deep
 *  powder (it swallows the runners' chatter), about 0.6 groomed, 1 ice. */
export function chatterK(v: number, hard: number): number {
  const h = clamp01(hard);
  return (0.3 + 0.7 * h) * (0.55 * smooth01((v - 14) / 16) + 0.45 * clamp01((v - 30) / 16));
}

/** The washboard's beat (cycles a metre of snow): the chatter's pitch rises with speed, about 11 Hz at 30 m/s
 *  on groomed snow, a touch finer on ice. */
export function chatterPitch(hard: number): number {
  return 0.34 + 0.12 * clamp01(hard);
}

/** Round 8: the lens breathes with the speed's change as well as the speed. Degrees of FOV for a smoothed
 *  acceleration (m/s each second): a surge (a drop, a boost, a dash) opens the lens out ahead of the speed it
 *  is gaining, a slowing (a bank, a climb) draws it in a little. Capped both ways so it never fights the hazard
 *  read: at most 3.5 degrees out and 1.5 in. */
export function surgeFov(accel: number): number {
  const a = accel / 9;
  return a > 0 ? 3.5 * (1 - Math.exp(-a)) : -1.5 * (1 - Math.exp(a));
}

/** Round 8: Spirit Flow's breath on the lens (degrees), `t` seconds after a level moved, `k` its signed size (+ a
 *  level gained, - one lost, 0 to 1 each way). A level gained is a breath in: the lens draws in a little over the
 *  first seventh of a second, then opens out past where it was and settles by about 1.3 s. A level lost is a
 *  gutter out: the lens sags in over half a second and comes back slowly. */
export function breathFov(t: number, k: number): number {
  if (t < 0 || k === 0) return 0;
  if (k > 0) {
    const draw = t < 0.14 ? Math.sin((Math.PI * t) / 0.28) : Math.max(0, 1 - (t - 0.14) / 0.12);
    const open = t < 0.14 ? 0 : Math.sin(Math.PI * Math.min(1, (t - 0.14) / 1.15)) * Math.exp(-(t - 0.14) * 0.6);
    return k * (-1.6 * draw + 3.2 * open);
  }
  const sag = t < 0.5 ? Math.sin((Math.PI * t) / 1.0) : Math.exp(-(t - 0.5) / 0.45);
  return k * 1.8 * sag;
}

/** Round 8: a dash's surge on the lens over its first seconds (degrees): a punch out to 6.5 in the first
 *  tenth of a second, held at 3 while the dash lasts. `t` is seconds since it started, `on` whether it still
 *  runs. */
export function dashFov(t: number, on: boolean): number {
  if (t < 0) return 0;
  const punch = t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) / 0.35);
  return Math.max(6.5 * punch, on ? 3 : 0);
}

/** Speed-scaled motion blur (cine.motionBlur): none to 18 m/s, a third by 28 (already fast), then an even
 *  climb that is only all of it at the cap. */
export function blurK(v: number): number {
  return 0.34 * smooth01((v - 18) / 10) + 0.66 * Math.pow(clamp01((v - 28) / 18), 1.1);
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
 *  away from the lens. Past 28 m/s it closes faster (round 7): the lag grew by a metre and a half from
 *  30 to the cap, the lens opened by five degrees, and the hero shrank by a quarter just as the run
 *  got fast. */
export function chaseBack(v: number): number {
  const s = Math.min(v, TOP_SPEED);
  return 2.2 - 0.06 * Math.min(s, 28) - 0.1 * Math.max(0, s - 28);
}

/** The chase lens's height over the sled: it rises with speed instead of dropping toward the snow, so
 *  the road ahead spreads down the frame and comes clear of the rider. */
export function chaseUp(v: number): number {
  return 1.05 + 0.2 * speedK(v) + 0.5 * fastK(v);
}

/** The rider's middle on the screen (NDC y): sinks a little with speed, opening the road above it. */
export function chaseRow(v: number): number {
  return -0.235 - 0.1 * fastK(v);
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

