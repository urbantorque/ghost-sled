// The title's key art (round 7): one composed shot a mountain, staged with the systems the run already has.
// Each is ART.md 15's "one image" for its mountain, as near as the title reel can stand to it: where on the
// course the reel rides (the stretch that holds the mountain's hero vista), the time of the colour script
// the light is read at, and where the lens sits, what it looks at and how far it drifts. The camera
// (render/camera.ts desktopTitle and phoneTitle) reads the lens; the app stages the reel and the light.
//
// The logo and the controls keep the left of a wide screen and the top and bottom of a tall one, so every
// lens holds the hero right of centre on a desktop and in the open band of a phone, and puts the mountain's
// landmark in the sky over the hero's shoulder.
//
// Pure data and pure functions: no DOM, render or audio imports.

/** Where a title lens sits and what it looks at. Distances in metres, angles in radians. */
export interface TitleLens {
  /** How far from the hero the lens sits, and how far above it. */
  r: number;
  up: number;
  /** The sweep the lens rests at: 0 is straight behind the hero, + swings it to the hero's right. Null
   *  keeps the sun-seeking sweep (the low sun over the hero's shoulder). */
  sweep: number | null;
  /** How far the sweep drifts either side of its rest, over the slow orbit. */
  drift: number;
  /** The look point: this far down the course from the hero, and this far above it. Further and higher
   *  lifts the horizon's landmark into the frame; nearer and lower fills it with the slope. */
  ahead: number;
  lift: number;
  /** The crane's reach, 0 to 1: how much of the rise to the wide establishing shot the loop takes. */
  crane: number;
  /** Where the hero is held across the frame, as fractions of the half width right of centre (lo, hi). */
  hero: readonly [number, number];
}

export interface TitleShot {
  /** The stretch of the course the reel rides, metres: it starts at `from` and cuts back at `to`. */
  from: number;
  to: number;
  /** The colour script's time, as metres down the run (palette.ts JOURNEY): null follows the hero. */
  light: number | null;
  desk: TitleLens;
  phone: TitleLens;
}

const DESK: TitleLens = { r: 4.7, up: 1.0, sweep: null, drift: 0.2, ahead: 5, lift: 1.25, crane: 1, hero: [0.14, 0.26] };
const PHONE: TitleLens = { r: 4.6, up: 0.95, sweep: null, drift: 0.06, ahead: 10, lift: 0.5, crane: 0, hero: [-0.08, -0.08] };

/** The reel as it was before round 7: the start of the course, the sun-seeking sweep. A Daily and a Cup
 *  keep it (their courses are built from a seed, so no vista is known ahead of time). */
export const PLAIN_SHOT: TitleShot = { from: 0, to: 1350, light: 0, desk: DESK, phone: PHONE };

/**
 * The five compositions, by mountain id. Each line names the image it is after (ART.md 15).
 */
export const TITLE_SHOTS: Readonly<Record<string, TitleShot>> = {
  // A red-scarfed rider over a gold valley, the spired town below: down Old Town's lamplit street at golden
  // hour and out over the Valley Leap, the lens high and wide so the valley lies under the hero.
  pinecrest: {
    from: 3640,
    to: 4150,
    light: null,
    desk: { r: 6.2, up: 1.9, sweep: 0.42, drift: 0.16, ahead: 34, lift: 0.4, crane: 0.45, hero: [0.08, 0.2] },
    phone: { r: 7.6, up: 1.7, sweep: 0.2, drift: 0.05, ahead: 26, lift: 0.3, crane: 0, hero: [-0.06, -0.06] },
  },
  // The Fang over the aurora: the polar night of the Crevasse Fields, the lens low so the sky owns two
  // thirds of the frame and the aurora lights the snow.
  frostfang: {
    from: 1760,
    to: 2620,
    light: 2200,
    desk: { r: 5.4, up: 0.85, sweep: -0.3, drift: 0.14, ahead: 30, lift: 3.4, crane: 0.25, hero: [0.08, 0.2] },
    phone: { r: 7.4, up: 1.3, sweep: -0.12, drift: 0.05, ahead: 22, lift: 1.1, crane: 0, hero: [-0.08, -0.08] },
  },
  // The cone dead ahead under the smoke deck: the run-in, straight behind the hero, the cone over its head.
  ember: {
    from: 60,
    to: 900,
    light: 120,
    desk: { r: 5.6, up: 1.1, sweep: 0.2, drift: 0.1, ahead: 40, lift: 2.6, crane: 0.3, hero: [0.08, 0.2] },
    phone: { r: 8.0, up: 1.5, sweep: 0.06, drift: 0.04, ahead: 30, lift: 1.0, crane: 0, hero: [-0.06, -0.06] },
  },
  // The cone through blossom: the last orchard rows and the Blossom Leap in the clear high light, the lens
  // low under the canopies.
  sakura: {
    from: 1980,
    to: 2620,
    light: 2580,
    desk: { r: 5.0, up: 0.9, sweep: 0.34, drift: 0.14, ahead: 30, lift: 1.3, crane: 0.2, hero: [0.08, 0.2] },
    phone: { r: 7.0, up: 1.3, sweep: 0.14, drift: 0.05, ahead: 22, lift: 0.8, crane: 0, hero: [-0.08, -0.08] },
  },
  // A rider coming out of the cloud above a valley of rising lanterns (ART.md 15, the one image): the break,
  // from the lip and down into the Lamp Road, under the deck's light. No crane, the lens near and swung to
  // the valley side, the look low: the rider large in the air over the lanterns with the peak behind, and the
  // duel partner out past the frame's edge (at 0.3 and a crane it stood beside the hero, and the hero was
  // cut by the frame's foot).
  lanternfall: {
    from: 1540,
    to: 1950,
    light: 1600,
    desk: { r: 4.8, up: 1.3, sweep: 0.4, drift: 0.14, ahead: 40, lift: 0.6, crane: 0, hero: [0.08, 0.2] },
    phone: { r: 7.2, up: 1.5, sweep: 0.12, drift: 0.05, ahead: 30, lift: 0.8, crane: 0, hero: [-0.06, -0.06] },
  },
  // Round 9, the Old Run (notes/r9-oldrun-world.md): a rider down the old ice track into the setting sun, the bare
  // wood either side and the lake far below at the end of the channel. The reel rides the Horseshoe's lead bend in the
  // sunset over the lake; the lens high over the channel and swung to the hero's left, the look far down the track, so
  // the sun sits in the channel's mouth. (Swung to the right and low, as the first composition had it, the lens filled
  // with the wall's ice and the hero stood behind the title's right column.)
  oldrun: {
    from: 2170,
    to: 2560,
    light: 2350,
    desk: { r: 6.4, up: 3, sweep: -0.3, drift: 0.12, ahead: 42, lift: 0.4, crane: 0.2, hero: [0.08, 0.2] },
    phone: { r: 7.4, up: 2.4, sweep: -0.12, drift: 0.05, ahead: 30, lift: 0.5, crane: 0, hero: [-0.06, -0.06] },
  },
  // Round 9, Gullhaven (notes/r9-gullhaven-world.md): a rider soaring the Great Geo's column over its cleft, the sea a
  // thousand metres down and the low sun under the storm deck's edge ahead. The reel rides from the shelf before its lip
  // out over the mouth, in the Great Geo's own light (the squall broken); the lens high and swung to the hero's right,
  // seaward, the look far ahead and low, so the cleft and the sun's path on the sea lie past the hero's shoulder.
  gullhaven: {
    from: 2120,
    to: 2480,
    light: 2260,
    desk: { r: 6.6, up: 2.6, sweep: 0.45, drift: 0.12, ahead: 40, lift: 0.2, crane: 0.25, hero: [0.08, 0.2] },
    phone: { r: 7.6, up: 2.2, sweep: 0.18, drift: 0.05, ahead: 30, lift: 0.4, crane: 0, hero: [-0.06, -0.06] },
  },
  // Round 9, Gablefall (notes/r9-gablefall-world.md): a rider on the snowed-in roofs high over the street, the roofs
  // stepping down toward the river and the viaduct across the valley in the snow. The reel rides the Water Stairs where
  // the cloud breaks over the river; the lens high and swung to the hero's right, over the street, so the roof run, the
  // street's canyon below it and the far side of the valley lie past the hero's shoulder.
  gablefall: {
    from: 2040,
    to: 2460,
    light: 2300,
    desk: { r: 6.4, up: 2.8, sweep: 0.4, drift: 0.12, ahead: 40, lift: 0.3, crane: 0.2, hero: [0.08, 0.2] },
    phone: { r: 7.4, up: 2.4, sweep: 0.16, drift: 0.05, ahead: 30, lift: 0.4, crane: 0, hero: [-0.06, -0.06] },
  },
};

/** The shot for a mountain id (a Daily, a Cup and anything unknown get the plain reel). */
export function titleShot(id: string): TitleShot {
  return TITLE_SHOTS[id] ?? PLAIN_SHOT;
}

/**
 * Dev overrides for composing a shot in the browser without a rebuild (`?debug&m=2&kz=1200&kr=6...`): kz
 * and kto move the reel, kl the light, and kr, ku, ks, kd, ka, kh (lift), kc, kx (hero lo) and ky (hero hi)
 * the lens of whichever screen is up. Returns the shot unchanged when none is given.
 */
export function devShot(shot: TitleShot, q: URLSearchParams): TitleShot {
  const n = (k: string): number | null => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : null);
  const lens = (l: TitleLens): TitleLens => ({
    r: n('kr') ?? l.r,
    up: n('ku') ?? l.up,
    sweep: n('ks') ?? l.sweep,
    drift: n('kd') ?? l.drift,
    ahead: n('ka') ?? l.ahead,
    lift: n('kh') ?? l.lift,
    crane: n('kc') ?? l.crane,
    hero: [n('kx') ?? l.hero[0], n('ky') ?? l.hero[1]],
  });
  if (![...q.keys()].some((k) => /^k[a-z]{1,2}$/.test(k))) return shot;
  const from = n('kz') ?? shot.from;
  return { from, to: n('kto') ?? Math.max(shot.to, from + 500), light: q.has('kl') ? n('kl') : shot.light, desk: lens(shot.desk), phone: lens(shot.phone) };
}
