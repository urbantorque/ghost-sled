// The garage (round 9, the shop lane; round 6's shelves grown into a place). Every piece is bought with gifts,
// found on an Almanac page, earned from a mountain's mastery board or a month's chapter, and every one is a look
// or a sound, never an edge: nothing here reaches the sim, a sled's handling or the lantern, and nothing a ghost
// wears or makes. The rider's vermillion stays the player's signal (ART.md sections 1 and 5), so pieces differ by
// silhouette, material, pattern, motion and light, never by a new hue: a hat by its outline from behind, a scarf
// by how many tails and of what form, what weights their ends and a pattern in value (cream or ink) that the
// Spirit Flow burn keeps; a trail by its shape and how it moves in the air (never a mark on the snow: DECISIONS
// 392), in the lantern's warm family only; a sound is the audio lane's (sledsounds.ts).
//
// Round 9's second pass (notes/r9-shop.md): the five hats two critics could not tell apart were reworked (the
// Bobble Crown read as The Twelve's crown and is now a hem of bobbles hanging round the back; the Twin Pom's poms
// hang over the ears), today's four look-alike trails became four shapes, and the near-duplicates catalogue.ts
// listed went. An id a save may hold is never taken away: a reworked piece keeps its id under its new look.
//
// Pure data: no DOM, render or audio engine imports.

import { SLED_SOUNDS, type SledSoundId } from '../audio/sledsounds';

export type ShelfId = 'scarf' | 'hat' | 'trail' | 'sound';

/** Where a piece comes from. A shop piece's price is on the def; a found piece's price is 0 (a chapter's is its
 *  price on the shelf from its month, and its page gives it too). */
export type Source =
  | { kind: 'free' }
  | { kind: 'shop' }
  /** Found on an Almanac page, never sold. */
  | { kind: 'almanac'; page: number }
  /** A mountain's set: earned at a third, two thirds and all of its mastery board. Never sold. */
  | { kind: 'set'; mountain: string; piece: 0 | 1 | 2 }
  /** A month's chapter: sold from its month on, and found on its page. */
  | { kind: 'chapter'; month: number };

/** The scarf's accent: none, a cream knit or an ink knit (ART.md section 5: at most one). */
export type ScarfAccent = 'none' | 'cream' | 'ink';
/** The knit's pattern, along each tail (rows) and across it (the edges and the middle). */
export type ScarfPattern =
  | 'tipStripes'
  | 'bars'
  | 'tip'
  | 'bands'
  | 'rib'
  | 'plain'
  | 'piping'
  | 'chevron'
  | 'braid'
  | 'graded'
  | 'rays'
  | 'flameBand'
  | 'dots'
  | 'crescent'
  | 'holes'
  | 'fold'
  | 'scallop'
  | 'teeth';
/** How many tails, and of what lengths: two (one a little longer, a real knot off centre), one long and one short,
 *  four (two pairs), or one thick rope. */
export type ScarfForm = 'two' | 'long' | 'four' | 'one';
/** What weights each tail's end. */
export type ScarfEnds = 'none' | 'fringe' | 'pom' | 'lamp' | 'ball' | 'drop' | 'point' | 'flame' | 'tassel';

export interface ScarfDef {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** Tail length against the classic (1). */
  length: number;
  /** Ribbon width against the classic (1). */
  width: number;
  pattern: ScarfPattern;
  accent: ScarfAccent;
  /** A fringe of strands at each tip (round 6's field; true when `ends` is a fringe). */
  tassels: boolean;
  form: ScarfForm;
  ends: ScarfEnds;
  /** A big bow at the throat over the knot. */
  bow?: boolean;
  source: Source;
}

/** A hat's silhouette (meshes.ts playerHat builds each). */
export type HatId = 'beanie' | 'watch' | 'twinpom' | 'trapper' | 'bobbles' | 'chullo' | 'longcap' | 'crest' | 'muffs' | 'downcap' | 'twintails' | 'floppeak';

export interface HatDef {
  id: HatId;
  name: string;
  blurb: string;
  price: number;
  source: Source;
}

/** A trail's shapes (render/trailforms.ts draws them): flat cut shapes, each with a body and an edge in the warm
 *  family. */
export type FlakeShape =
  | 'snowflake'
  | 'petal'
  | 'leaf'
  | 'strip'
  | 'ember'
  | 'ray'
  | 'icicle'
  | 'drop'
  | 'blossom'
  | 'tongue'
  | 'sun'
  | 'bow'
  | 'fan'
  | 'crescent'
  | 'hollow'
  | 'ball'
  | 'star'
  | 'crane'
  | 'frond'
  | 'lantern'
  | 'spark';
/** How a shape moves once it leaves the sled: falls fluttering and turning, sails out flat and spinning, rises,
 *  is flicked up and out and falls, drops from the stern and bursts, pops out sideways and drifts, rolls along the
 *  snow, bobs behind and winks out, tumbles end over end, or bounds alongside in arcs. */
export type FlakeMotion = 'flutter' | 'sail' | 'rise' | 'flick' | 'drop' | 'pop' | 'roll' | 'bob' | 'tumble' | 'hop';

export type TrailForm =
  | { kind: 'flakes'; shape: FlakeShape; motion: FlakeMotion; rate: number; size: number; body: string; edge: string; glow?: boolean }
  /** Two ribbons of light off the runners' tails that rise and bend with the carve and hang a second and a half. */
  | { kind: 'ribbons'; head: string; tail: string }
  /** Strings of cut shapes streaming back off the stern on a line that flies and swings. */
  | { kind: 'kites'; shape: 'bow' | 'star'; body: string; alt: string }
  /** Three soft lights that loop round the rider and follow. */
  | { kind: 'moths'; body: string }
  /** A paper lantern riding behind on a line, its light on the snow. */
  | { kind: 'keeper'; body: string };

export type TrailId = string;

export interface TrailDef {
  id: TrailId;
  name: string;
  blurb: string;
  price: number;
  /** The spray's tint (mixed into the snow's white), '' for plain snow. */
  tint: string;
  /** How much of the tint the spray takes, 0 to 1. */
  tintK: number;
  /** Motes the runners throw, '' for none. */
  mote: string;
  /** How many motes a second at cruise. */
  motes: number;
  /** How the motes move: flicked up off the runners, twinkling low beside the groove, or streaming straight back. */
  moteStyle: 'flick' | 'twinkle' | 'stream';
  /** The spray thrown up, against plain snow's (1): Honey Plume's rooster tail is twice as tall. */
  plume?: number;
  /** The trail's own shapes, or null for spray and motes only. */
  form: TrailForm | null;
  source: Source;
}

export interface SoundDef {
  id: SledSoundId;
  name: string;
  blurb: string;
  price: number;
  source: Source;
}

/** An ornament: what stands on a sled's stern post once its fourth tier is fitted (meshes.ts ornamentGeometry). The
 *  lamp is the post's own; the rest come from the mountains' sets, the months' chapters and the Almanac. */
export interface OrnamentDef {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** Lit from inside: it glows and lights the snow behind (Medium and High). */
  lit: boolean;
  source: Source;
}

const FREE: Source = { kind: 'free' };
const SHOP: Source = { kind: 'shop' };

// ---------------------------------------------------------------- scarves

const sc = (id: string, name: string, blurb: string, price: number, look: Partial<ScarfDef>, source: Source = SHOP): ScarfDef => {
  const ends = look.ends ?? 'none';
  return { id, name, blurb, price, length: 1, width: 1, pattern: 'plain', accent: 'none', form: 'two', ...look, ends, tassels: ends === 'fringe', source };
};

/** The classic knit comes first: every rider has it, and it is what the rider wore before round 6. */
export const SCARVES: readonly ScarfDef[] = [
  sc('classic', 'Classic Knit', 'Two tails, two deeper stripes near the tips', 0, { pattern: 'tipStripes' }, FREE),
  sc('creambar', 'Cream Bar', 'Two cream bars across each tail', 80, { pattern: 'bars', accent: 'cream' }),
  sc('chunky', 'Chunky Rib', 'Short and twice as broad, ribbed in ink', 110, { pattern: 'rib', accent: 'ink', length: 0.72, width: 1.75 }),
  sc('tassel', 'Fringe Knit', 'A long fringe at each tip that splays as it streams', 150, { pattern: 'tipStripes', length: 0.9, ends: 'fringe' }),
  sc('inkband', 'Ink Bands', 'Broad ink bands all down its length', 190, { pattern: 'bands', accent: 'ink', length: 1.12 }),
  sc('snowtip', 'Snow Tip', 'The last third of each tail dipped in cream, a cream tassel', 240, { pattern: 'tip', accent: 'cream', length: 1.1, ends: 'tassel' }),
  sc('streamer', 'Long Streamer', 'One tail half as long again, the other short', 300, { pattern: 'plain', width: 0.82, form: 'long' }),
  sc('double', 'Double Wrap', 'Four tails in two pairs, the deeper stripes on each', 380, { pattern: 'tipStripes', length: 1.02, form: 'four' }),
  sc('pomtails', 'Pom Tails', 'Each tail swung low by a big knit pom', 480, { pattern: 'tipStripes', length: 0.92, ends: 'pom' }),
  sc('rope', 'Rope Braid', 'Both tails braided into one thick rope, a cream strand through it', 640, { pattern: 'braid', accent: 'cream', length: 1.25, width: 1.3, form: 'one', ends: 'tassel' }),
  // The Almanac's, never sold.
  sc('almanacknot', 'Almanac Knot', 'A big bow at the throat, two short ink-tipped tails', 0, { pattern: 'tip', accent: 'ink', length: 0.62, width: 1.05, bow: true }, { kind: 'almanac', page: 17 }),
  sc('almanacveil', 'Night Veil', 'Long fine tails, each weighted by a little paper lamp', 0, { pattern: 'plain', length: 1.35, width: 0.62, ends: 'lamp' }, { kind: 'almanac', page: 42 }),
  // The mountains' sets.
  sc('firchevron', 'Fir Chevron', 'Cream chevrons down each tail like fir boughs', 0, { pattern: 'chevron', accent: 'cream' }, { kind: 'set', mountain: 'pinecrest', piece: 0 }),
  sc('fangedge', 'Fang Edge', 'Tails cut to a fang at the tip, ink teeth along it', 0, { pattern: 'teeth', accent: 'ink', ends: 'point', length: 1.05 }, { kind: 'set', mountain: 'frostfang', piece: 0 }),
  sc('ashmarket', 'Ash Market', 'Flame-cut tips under charcoal ink bands', 0, { pattern: 'bands', accent: 'ink', ends: 'flame', length: 0.95 }, { kind: 'set', mountain: 'ember', piece: 0 }),
  sc('petalhem', 'Petal Hem', 'Cream petals down both edges', 0, { pattern: 'scallop', accent: 'cream', width: 1.15 }, { kind: 'set', mountain: 'sakura', piece: 0 }),
  sc('lamproad', 'Lamp Road', 'One long streamer barred in cream like a row of lamps', 0, { pattern: 'graded', accent: 'cream', form: 'long', width: 0.9 }, { kind: 'set', mountain: 'lanternfall', piece: 0 }),
  // The months' chapters: each its own form, never a shop knit in another tint.
  sc('ch1scarf', 'Sunrise Bars', 'Cream bars widening toward the tips like rays', 260, { pattern: 'rays', accent: 'cream' }, { kind: 'chapter', month: 1 }),
  sc('ch2scarf', 'Icicle Fringe', 'A fringe of stiff cream points', 260, { pattern: 'tip', accent: 'cream', ends: 'point', length: 0.95 }, { kind: 'chapter', month: 2 }),
  sc('ch3scarf', 'Drip Hem', 'Tails that end in round drops', 260, { pattern: 'tipStripes', ends: 'drop' }, { kind: 'chapter', month: 3 }),
  sc('ch4scarf', 'Blossom Knit', 'Cream blossoms knitted down the middle', 260, { pattern: 'dots', accent: 'cream', width: 1.1 }, { kind: 'chapter', month: 4 }),
  sc('ch5scarf', 'Ember Knit', 'Ink-dipped tips under a cream flame band', 260, { pattern: 'flameBand', accent: 'ink', ends: 'flame' }, { kind: 'chapter', month: 5 }),
  sc('ch6scarf', 'Midsummer Ribbons', 'Four slim ribbons', 260, { pattern: 'plain', width: 0.6, length: 1.15, form: 'four' }, { kind: 'chapter', month: 6 }),
  sc('ch7scarf', 'Market Tassels', 'Short tails ending in heavy cream tassels', 260, { pattern: 'plain', accent: 'cream', length: 0.7, ends: 'tassel' }, { kind: 'chapter', month: 7 }),
  sc('ch8scarf', 'Folded Fan', 'Pleated in folds that open as they stream', 260, { pattern: 'fold', width: 1.3, length: 0.9 }, { kind: 'chapter', month: 8 }),
  sc('ch9scarf', 'Crescent Knit', 'Ink crescents down the tails', 260, { pattern: 'crescent', accent: 'ink' }, { kind: 'chapter', month: 9 }),
  sc('ch10scarf', 'Hollow Stitch', 'Open-work holes knitted through it', 260, { pattern: 'holes', accent: 'ink', width: 1.1 }, { kind: 'chapter', month: 10 }),
  sc('ch11scarf', 'Snowball Tails', 'Each tail ending in a round cream snowball', 260, { pattern: 'plain', accent: 'cream', ends: 'ball', length: 0.9 }, { kind: 'chapter', month: 11 }),
  sc('ch12scarf', 'Star Knit', 'Cream stars knitted down the tails', 260, { pattern: 'dots', accent: 'cream', length: 1.15, width: 0.9 }, { kind: 'chapter', month: 12 }),
];

// ---------------------------------------------------------------- hats

export const HATS: readonly HatDef[] = [
  { id: 'beanie', name: 'Pom Beanie', blurb: 'A round crown and one big cream pom on top', price: 0, source: FREE },
  { id: 'watch', name: 'Watch Cap', blurb: 'Low and flat-topped, a thick rolled cuff, nothing on top', price: 80, source: SHOP },
  { id: 'twinpom', name: 'Twin Pom', blurb: 'Two cream poms hung low over the ears', price: 110, source: SHOP },
  { id: 'trapper', name: 'Trapper', blurb: 'Broad, a cream fur band and two long flaps to the scarf', price: 150, source: SHOP },
  { id: 'bobbles', name: 'Bobble Hem', blurb: 'A hem of cream bobbles hanging round the back of the cuff', price: 200, source: SHOP },
  { id: 'chullo', name: 'Braided Chullo', blurb: 'A point on top and two braids hanging past the jaw', price: 260, source: SHOP },
  { id: 'longcap', name: 'Long Knit Cap', blurb: 'A tail streaming back off one side, a pom at its end', price: 320, source: SHOP },
  { id: 'crest', name: 'Crest Knit', blurb: 'A tall cream fin standing from brow to nape', price: 400, source: SHOP },
  { id: 'muffs', name: 'Pom Muffs', blurb: 'No crown: a knit band and two big fur muffs', price: 480, source: SHOP },
  { id: 'downcap', name: 'Down Cap', blurb: 'A big puffed dome in fat quilted rings, a real brim', price: 580, source: SHOP },
  { id: 'twintails', name: 'Twin Tails', blurb: 'Two soft knit tails hanging and streaming off the back', price: 700, source: SHOP },
  { id: 'floppeak', name: 'Flop Peak', blurb: 'A tall felt cone flopped forward over the brow, a pom swinging', price: 850, source: SHOP },
];

// ---------------------------------------------------------------- trails

const tr = (id: string, name: string, blurb: string, price: number, look: Partial<TrailDef>, source: Source = SHOP): TrailDef => ({
  id,
  name,
  blurb,
  price,
  tint: '',
  tintK: 0,
  mote: '',
  motes: 0,
  moteStyle: 'flick',
  form: null,
  ...look,
  source,
});
const flakes = (shape: FlakeShape, motion: FlakeMotion, rate: number, size: number, body: string, edge: string, glow = false): TrailForm => ({ kind: 'flakes', shape, motion, rate, size, body, edge, glow });

// The warm family (ART.md 5): paper and cream, honey, gold, marigold and amber. Never mint, rose, coral or
// vermillion (tests/garage.test.ts holds every colour here to hue 30 to 60 or barely tinted).
const PAPER = '#FFF4DE';
const CREAMY = '#FFE9C2';
const GOLD = '#F5C542';
const MARIGOLD = '#FFD34D';
const AMBER = '#FFA545';
const HONEY = '#FFE6B3';

export const TRAILS: readonly TrailDef[] = [
  tr('powder', 'Fresh Powder', 'Snow, and only snow', 0, {}, FREE),
  tr('honey', 'Honey Plume', 'A rooster tail of big honey billows, twice as tall', 80, { tint: '#FFE2A8', tintK: 0.7, plume: 2 }),
  tr('sparks', 'Lantern Sparks', 'Marigold sparks flicked off the runners', 130, { tint: '#FFF1D6', tintK: 0.2, mote: MARIGOLD, motes: 70, moteStyle: 'flick' }),
  tr('glints', 'Gold Leaf', 'Flakes of gold leaf that spiral up behind and flash', 180, { form: flakes('leaf', 'rise', 34, 0.13, GOLD, '#FFF0B8', true) }),
  tr('stardust', 'Paper Snow', 'Cut-paper snowflakes that flutter and turn as they fall', 250, { form: flakes('snowflake', 'flutter', 40, 0.24, PAPER, CREAMY) }),
  tr('comet', 'Comet Tail', 'Two ribbons of light that rise off the runners and bend with the carve', 340, { form: { kind: 'ribbons', head: AMBER, tail: MARIGOLD } }),
  tr('petals', 'Petal Drift', 'Cream and gold petals that spin flat and sail out sideways', 450, { form: flakes('petal', 'sail', 42, 0.2, PAPER, GOLD) }),
  tr('streamers', 'Paper Streamers', 'Strips of festival paper that tear off the stern and flap behind', 580, { form: flakes('strip', 'tumble', 16, 0.42, CREAMY, MARIGOLD) }),
  tr('kitetails', 'Kite Tails', 'Two strings of paper bows flying high off the stern', 750, { form: { kind: 'kites', shape: 'bow', body: PAPER, alt: MARIGOLD } }),
  // The Almanac's, never sold.
  tr('almanacmoth', 'Lamp Moths', 'Three soft lights that loop round you and follow', 0, { form: { kind: 'moths', body: '#FFE6A8' } }, { kind: 'almanac', page: 28 }),
  tr('almanacember', 'Banked Embers', 'Embers that lift off the runners in a glowing column', 0, { form: flakes('ember', 'rise', 30, 0.1, AMBER, MARIGOLD, true) }, { kind: 'almanac', page: 46 }),
  tr('almanackeeper', "Keeper's Lantern", 'A paper lantern riding behind on a line', 0, { form: { kind: 'keeper', body: PAPER } }, { kind: 'almanac', page: 50 }),
  // The mountains' sets (in the air: DECISIONS 392 keeps marks off the snow).
  tr('staglights', 'Stag Lights', 'Little lights that bound alongside in arcs, the White Stag\'s', 0, { form: flakes('spark', 'hop', 9, 0.16, '#FFF0C8', MARIGOLD, true) }, { kind: 'set', mountain: 'pinecrest', piece: 1 }),
  tr('frostfeathers', 'Frost Feathers', 'Fronds of cream-gold frost that drift up and melt', 0, { form: flakes('frond', 'rise', 24, 0.26, '#FFF6E8', GOLD) }, { kind: 'set', mountain: 'frostfang', piece: 1 }),
  tr('lavadrops', 'Lava Drops', 'Glowing drops that arc off the runners', 0, { form: flakes('drop', 'flick', 26, 0.12, AMBER, MARIGOLD, true) }, { kind: 'set', mountain: 'ember', piece: 1 }),
  tr('papercranes', 'Paper Cranes', 'Folded cranes that climb off the wake in pairs', 0, { form: flakes('crane', 'rise', 8, 0.3, PAPER, CREAMY) }, { kind: 'set', mountain: 'sakura', piece: 1 }),
  tr('skylanterns', 'Sky Lanterns', 'Little paper lanterns that lift off the stern and rise', 0, { form: flakes('lantern', 'rise', 3, 0.3, CREAMY, MARIGOLD, true) }, { kind: 'set', mountain: 'lanternfall', piece: 1 }),
  // The months' chapters: a shape of their own each.
  tr('ch1trail', 'Dawn Fans', 'Fans of light flicked off each carve', 380, { form: flakes('ray', 'flick', 40, 0.22, '#FFF0C8', MARIGOLD, true) }, { kind: 'chapter', month: 1 }),
  tr('ch2trail', 'Icicle Chimes', 'Icicles that drop off the runners and burst', 380, { form: flakes('icicle', 'drop', 22, 0.2, '#FFF8EC', HONEY) }, { kind: 'chapter', month: 2 }),
  tr('ch3trail', 'Drip Lights', 'Drops of light falling from the stern', 380, { form: flakes('drop', 'drop', 18, 0.14, '#FFE6A8', MARIGOLD, true) }, { kind: 'chapter', month: 3 }),
  tr('ch4trail', 'Blossom Pops', 'Cream blossoms that pop out and drift', 380, { form: flakes('blossom', 'pop', 18, 0.22, PAPER, GOLD) }, { kind: 'chapter', month: 4 }),
  tr('ch5trail', 'Ember Tongues', 'Flame-shaped tongues licking up off the runners', 380, { form: flakes('tongue', 'flick', 30, 0.2, AMBER, MARIGOLD, true) }, { kind: 'chapter', month: 5 }),
  tr('ch6trail', 'Sun Motes', 'Rayed suns that roll beside you and fade', 380, { form: flakes('sun', 'roll', 10, 0.24, MARIGOLD, '#FFF0C8') }, { kind: 'chapter', month: 6 }),
  tr('ch7trail', 'Market Ribbons', 'Cream paper bows that tumble off', 380, { form: flakes('bow', 'tumble', 16, 0.24, PAPER, MARIGOLD) }, { kind: 'chapter', month: 7 }),
  tr('ch8trail', 'Folded Fans', 'Paper fans that flutter as they fall', 380, { form: flakes('fan', 'flutter', 16, 0.3, PAPER, GOLD) }, { kind: 'chapter', month: 8 }),
  tr('ch9trail', 'Moon Slivers', 'Thin crescents of light tumbling end over end', 380, { form: flakes('crescent', 'tumble', 16, 0.24, '#FFF0C8', GOLD, true) }, { kind: 'chapter', month: 9 }),
  tr('ch10trail', 'Hollow Lights', 'Round paper lanterns with cut eyes that bob and wink out', 380, { form: flakes('hollow', 'bob', 6, 0.3, CREAMY, AMBER, true) }, { kind: 'chapter', month: 10 }),
  tr('ch11trail', 'Snowballs', 'Little snowballs that roll off the runners and burst', 380, { form: flakes('ball', 'roll', 14, 0.18, '#FFFDF6', HONEY) }, { kind: 'chapter', month: 11 }),
  tr('ch12trail', 'Star Strings', 'Strings of paper stars fluttering off the stern', 380, { form: { kind: 'kites', shape: 'star', body: PAPER, alt: GOLD } }, { kind: 'chapter', month: 12 }),
];

// ---------------------------------------------------------------- sounds and ornaments

export const SOUNDS: readonly SoundDef[] = SLED_SOUNDS.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, price: s.price, source: s.price === 0 ? FREE : SHOP }));

const orn = (id: string, name: string, blurb: string, lit: boolean, source: Source, price = 0): OrnamentDef => ({ id, name, blurb, price, lit, source });

/** The stern lamp is the post's own; the rest are never sold in the shop (the chapters' from their month). */
export const ORNAMENTS: readonly OrnamentDef[] = [
  orn('lamp', 'Stern Lamp', 'A cream paper lamp with an ink cap, lit', true, FREE),
  orn('cowbell', 'Cowbell', 'A big cream-and-ink bell that swings', false, { kind: 'set', mountain: 'pinecrest', piece: 2 }),
  orn('icefang', 'Ice Fang', 'A curved crystal tooth that throws a glint', true, { kind: 'set', mountain: 'frostfang', piece: 2 }),
  orn('basaltcrown', 'Basalt Pipes', 'Three basalt columns with a glowing seam', true, { kind: 'set', mountain: 'ember', piece: 2 }),
  orn('papercrane', 'Paper Crane', 'A folded cream crane, its wings lifting', false, { kind: 'set', mountain: 'sakura', piece: 2 }),
  orn('greatlantern', 'Great Lantern', 'A storeyed lantern of lit paper, the finale\'s own', true, { kind: 'set', mountain: 'lanternfall', piece: 2 }),
  orn('ch1orn', 'Sun Disc', 'A rayed cream disc', false, { kind: 'chapter', month: 1 }, 320),
  orn('ch2orn', 'Icicle Crown', 'A ring of hanging icicles', false, { kind: 'chapter', month: 2 }, 320),
  orn('ch3orn', 'Thaw Lantern', 'A tall narrow lantern with a dripping foot', true, { kind: 'chapter', month: 3 }, 320),
  orn('ch4orn', 'Blossom Sprig', 'A sprig of three cream blossoms', false, { kind: 'chapter', month: 4 }, 320),
  orn('ch5orn', 'Brazier', 'A small iron brazier with a lit bed', true, { kind: 'chapter', month: 5 }, 320),
  orn('ch6orn', 'Sun Wheel', 'A spoked wheel of cream rays that turns', false, { kind: 'chapter', month: 6 }, 320),
  orn('ch7orn', 'Lantern String', 'Three tiny lanterns on a string', true, { kind: 'chapter', month: 7 }, 320),
  orn('ch8orn', 'Paper Fan', 'An open paper fan', false, { kind: 'chapter', month: 8 }, 320),
  orn('ch9orn', 'Crescent Moon', 'A cream crescent, horns up', false, { kind: 'chapter', month: 9 }, 320),
  orn('ch10orn', 'Hollow Lantern', 'A round lantern with cut eyes, lit', true, { kind: 'chapter', month: 10 }, 320),
  orn('ch11orn', 'Snow Pair', 'Two stacked snowballs with a stick arm', false, { kind: 'chapter', month: 11 }, 320),
  orn('ch12orn', 'Lantern Star', 'A cut-paper star lantern, lit', true, { kind: 'chapter', month: 12 }, 320),
];

// ---------------------------------------------------------------- lookups

export function scarfById(id: string | null | undefined): ScarfDef {
  return SCARVES.find((s) => s.id === id) ?? SCARVES[0];
}

export function hatById(id: string | null | undefined): HatDef {
  return HATS.find((h) => h.id === id) ?? HATS[0];
}

export function trailById(id: string | null | undefined): TrailDef {
  return TRAILS.find((t) => t.id === id) ?? TRAILS[0];
}

export function soundById(id: string | null | undefined): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS.find((s) => s.price === 0) ?? SOUNDS[0];
}

export function ornamentById(id: string | null | undefined): OrnamentDef {
  return ORNAMENTS.find((o) => o.id === id) ?? ORNAMENTS[0];
}

/** Every shelf's items by id, for the save's sanitising and the shop. */
export const SHELVES: Readonly<Record<ShelfId, readonly { id: string; name: string; blurb: string; price: number; source: Source }[]>> = {
  scarf: SCARVES,
  hat: HATS,
  trail: TRAILS,
  sound: SOUNDS,
};

/** The one every rider starts with on a shelf. */
export function freeItem(shelf: ShelfId): string {
  return (SHELVES[shelf].find((i) => i.source.kind === 'free') ?? SHELVES[shelf][0]).id;
}

export function isItem(shelf: ShelfId, id: unknown): id is string {
  return typeof id === 'string' && SHELVES[shelf].some((i) => i.id === id);
}

export function isOrnament(id: unknown): id is string {
  return typeof id === 'string' && ORNAMENTS.some((o) => o.id === id);
}

/** Whether the shop sells a piece today: a shop piece always, a chapter's from its month on (almanac.ts monthsOpen
 *  says which), never a found one. */
export function onSale(src: Source, months: ReadonlySet<number>): boolean {
  return src.kind === 'shop' || (src.kind === 'chapter' && months.has(src.month));
}

/** A piece's chapter, set or Almanac source in a few words, for its card ("Almanac page 42", "Frostfang's set"). */
export function sourceLine(src: Source): string {
  switch (src.kind) {
    case 'almanac':
      return `Found on Almanac page ${src.page}`;
    case 'set':
      return `${SET_MOUNTAIN_NAMES[src.mountain] ?? src.mountain}'s set: ${['a third', 'two thirds', 'all'][src.piece]} of its mastery board`;
    case 'chapter':
      return `${MONTH_NAMES[src.month - 1]}'s chapter`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------- the mountains' sets

/** The five's sets, a scarf, a trail and an ornament each, opened at a third, two thirds and all of each mastery
 *  board (DECISIONS 391). The three new mountains' sets come with them (G6, a later lane's). */
export const SETS: Readonly<Record<string, readonly [string, string, string]>> = {
  pinecrest: ['firchevron', 'staglights', 'cowbell'],
  frostfang: ['fangedge', 'frostfeathers', 'icefang'],
  ember: ['ashmarket', 'lavadrops', 'basaltcrown'],
  sakura: ['petalhem', 'papercranes', 'papercrane'],
  lanternfall: ['lamproad', 'skylanterns', 'greatlantern'],
};
export const SET_SHARES = [1 / 3, 2 / 3, 1] as const;
const SET_MOUNTAIN_NAMES: Readonly<Record<string, string>> = { pinecrest: 'Pinecrest', frostfang: 'Frostfang', ember: 'Ember Peak', sakura: 'Sakura Ridge', lanternfall: 'Lanternfall' };
const MONTH_NAMES = ['First Light', 'The Long Frost', 'Thaw Lanterns', 'Blossom Run', 'Ash and Ember', 'Midsummer Snow', 'Night Market', 'Paper Cranes', 'Harvest Moon', 'The Haunting', 'First Snow', 'Lantern Night'];

/** Set pieces held for a share of a mastery board (0 to 3). */
export function setPiecesFor(done: number, total: number): number {
  if (total <= 0) return 0;
  const k = done / total;
  return SET_SHARES.filter((s) => k >= s - 1e-9).length;
}

/** A chapter's three pieces (scarf, trail, ornament), by month. */
export function chapterPieces(month: number): { scarf: ScarfDef; trail: TrailDef; ornament: OrnamentDef } {
  return { scarf: scarfById(`ch${month}scarf`), trail: trailById(`ch${month}trail`), ornament: ornamentById(`ch${month}orn`) };
}
