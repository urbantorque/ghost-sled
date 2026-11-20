import { CHARM, CHARMS } from '../sim/charms';

// Round 8, G2: what a charm does, in a few words, for the callout as it is taken ("Slipstream Lantern: drafting fills
// your lantern"). The sim's own line (CHARMS[id].does) is the Almanac's, a sentence too long to read at speed; this is
// its short form, said once, after the name. The offers line as a gate comes up keeps the names alone.
//
// Pure: no DOM, render or audio imports.

export const CHARM_SHORT: Readonly<Record<number, string>> = {
  [CHARM.slip]: 'drafting fills your lantern',
  [CHARM.comet]: 'longer dashes, but no ward',
  [CHARM.kite]: 'quicker, bigger slingshots',
  [CHARM.frost]: 'ice holds and runs fast',
  [CHARM.star]: 'big drops become speed',
  [CHARM.drum]: 'drifts charge faster at speed',
  [CHARM.step]: 'a dash after a stomp costs half',
  [CHARM.stride]: 'a deeper tuck, less steering',
  [CHARM.owl]: 'near misses hold the combo',
  [CHARM.hearth]: 'a stomp after a dash refills it',
  [CHARM.paper]: 'grabs come sooner and pay more',
  [CHARM.whirl]: 'faster spins that pay more',
  [CHARM.memory]: 'new tricks pay triple',
  [CHARM.festival]: 'the multiplier climbs faster',
  [CHARM.bell]: 'rails catch you and pay double',
  [CHARM.spirit]: 'flow climbs twice as fast',
  [CHARM.second]: 'a fall costs no get-up',
  [CHARM.feather]: 'one bad landing a stage forgiven',
  [CHARM.stone]: 'a ward costs half a lantern',
  [CHARM.bark]: 'bumps keep your combo',
  [CHARM.lamp]: 'a last ward when get-ups run out',
  [CHARM.path]: 'sparks along the safe line',
  [CHARM.quick]: 'back up faster after a fall',
  [CHARM.wisp]: 'a wisp takes the first hit',
};

/** Its gist, two or three words, for the offers line as a gate comes up ("Drift Drum: faster drifts"): a choice the
 *  player cannot read is not a decision, and the full line is the take's. */
export const CHARM_GIST: Readonly<Record<number, string>> = {
  [CHARM.slip]: 'drafting fills',
  [CHARM.comet]: 'long dashes',
  [CHARM.kite]: 'big slingshots',
  [CHARM.frost]: 'grip on ice',
  [CHARM.star]: 'drops to speed',
  [CHARM.drum]: 'faster drifts',
  [CHARM.step]: 'cheap dashes',
  [CHARM.stride]: 'a deep tuck',
  [CHARM.owl]: 'near misses',
  [CHARM.hearth]: 'dashes back',
  [CHARM.paper]: 'grabs pay',
  [CHARM.whirl]: 'spins pay',
  [CHARM.memory]: 'new tricks pay',
  [CHARM.festival]: 'quick multiplier',
  [CHARM.bell]: 'rails pay',
  [CHARM.spirit]: 'faster flow',
  [CHARM.second]: 'free get-ups',
  [CHARM.feather]: 'soft landings',
  [CHARM.stone]: 'cheap wards',
  [CHARM.bark]: 'tough bumps',
  [CHARM.lamp]: 'a last ward',
  [CHARM.path]: 'a lit path',
  [CHARM.quick]: 'quick get-ups',
  [CHARM.wisp]: 'a free hit',
};

/** The offers line as a gate comes up, left to right as its arches stand: each charm's name and gist. */
export function offersGistLine(offers: readonly number[]): string {
  return offers
    .filter((id) => id >= 0 && CHARMS[id])
    .map((id) => `${CHARMS[id].name}: ${CHARM_GIST[id] ?? ''}`)
    .join('  ·  ');
}

/** The take's callout: the charm's name and what it does. */
export function charmTakeLine(id: number): string {
  const c = CHARMS[id];
  if (!c) return '';
  const short = CHARM_SHORT[id];
  return short ? `${c.name}: ${short}` : c.name;
}
