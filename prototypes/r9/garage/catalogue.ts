// Round 9, the garage lane (milestone 0): the proposed garage as data. Every item, today's and proposed, with where
// it comes from (the shop, a sled's track, the Almanac, a mountain's set, a month's chapter), its price, and the one
// thing that tells it from its shelf-mates at race distance (the chase lens, the rider about a fifth of the frame and
// seen from behind, a hat about a fifteenth). Colour roles stay locked (ART.md 1 and 5): a piece differs by
// silhouette, material, pattern, motion or light, never by a new hue.
//
// Nothing here reaches the game: the economy script (scripts/playtest/r9-garage-economy.ts) and the prototype page
// (prototypes/r9/garage.html) read it. Milestone 2 would move the parts that ship into src/game/garage.ts.
//
// Pure data: no DOM, render or audio imports.

export type ShelfId = 'sled' | 'track' | 'hat' | 'scarf' | 'trail' | 'finish' | 'ornament' | 'sound' | 'lantern';

export type Source =
  | { kind: 'free' }
  | { kind: 'shop'; price: number }
  /** Found on an Almanac page, never sold. */
  | { kind: 'almanac'; page: number }
  /** A mountain's set, earned by mastering it: opened at a share of its mastery board's stars. Never sold. */
  | { kind: 'set'; mountain: string; share: number }
  /** A month's chapter: found on its page, and sold for gifts from its month on (DECISIONS 371, the owner's 3). */
  | { kind: 'chapter'; month: number; page: number; price: number }
  /** A tier of a sled's track: opened by riding that sled (stage lines crossed on it), then fitted for gifts. */
  | { kind: 'track'; sled: string; tier: number; lines: number; price: number };

/** The five levers a piece may differ by (colour is not one of them). */
export type Lever = 'silhouette' | 'material' | 'pattern' | 'motion' | 'light';

export interface Item {
  id: string;
  shelf: ShelfId;
  name: string;
  source: Source;
  /** Against today's garage: kept as it is, reworked (same name and place, a new look), new, or moved. */
  status: 'kept' | 'reworked' | 'new' | 'moved';
  /** Today's piece this replaces or reworks (garage.ts, paints.ts, almanac.ts id). */
  was?: string;
  /** What tells it apart at race distance, in one line. */
  reads: string;
  levers: Lever[];
  /** Shot in the race-distance sheet (prototypes/r9/garage/items.ts builds it). */
  proto?: boolean;
}

// ---------------------------------------------------------------- the price curve

/** A sled's track: five tiers, each opened by stage lines ridden on that sled (a finish is three), each fitted for
 *  gifts. The lines are cumulative on that sled: 1, 3, 6, 10 and 15 finishes' worth. */
export const TRACK_LINES = [3, 9, 18, 30, 45] as const;
/** The Pine Flyer's tier prices; every other sled's are these times its factor, to the nearest ten. */
export const TRACK_BASE = [80, 150, 240, 360, 520] as const;
export const TRACK_FACTOR: Readonly<Record<string, number>> = { flyer: 1, whirl: 1, lodge: 1.1, comet: 1.25, wisp: 1.4, crumpet: 1.6 };
export const TIER_NAMES = ['Runners', 'Deck', 'Crest', 'Stern lamp', 'Spirit inlay'] as const;

export function trackPrice(sled: string, tier: number): number {
  return Math.round((TRACK_BASE[tier] * (TRACK_FACTOR[sled] ?? 1)) / 10) * 10;
}

/** A mountain set's three pieces open at these shares of its mastery board (mastery.ts masteryBoard): a scarf at a
 *  third, a trail at two thirds, the ornament with the whole board. */
export const SET_SHARES = [1 / 3, 2 / 3, 1] as const;

/** A chapter piece's price on the shelf (it is also on its page, which pays the price back if you bought it first). */
export const CHAPTER_PRICES = { scarf: 260, trail: 380, ornament: 320 } as const;

// ---------------------------------------------------------------- sleds and their tracks

export interface SledLook {
  id: string;
  /** sim/sleds.ts index. */
  index: number;
  name: string;
  source: Source;
  /** The sled's own move (sim/tricks.ts SIGNATURE), named on its card and shown in a short loop. */
  signature: string;
  signatureHow: string;
  /** What each tier puts on this sled, where the chase lens sees it (the tail, the runners' tails, the sides past
   *  the hips, a post over the stern). */
  tiers: [string, string, string, string, string];
}

export const SLEDS: readonly SledLook[] = [
  {
    id: 'flyer',
    index: 0,
    name: 'Pine Flyer',
    source: { kind: 'free' },
    signature: 'Pine Bow',
    signatureHow: 'Standing on the sled, a slow bow with both arms out',
    tiers: [
      'The runner tails run on and scroll up into two curls behind the seat',
      'A cream quilted pad over the seat slats, its stitched edge proud past the hips',
      'The bent-wood bow becomes a carved crest, a scalloped backboard twice its height',
      'A stern post with a paper lamp: cream paper, an ink cap, a warm heart that lights the snow behind',
      'Ink inlay down both runners and round the crest that burns with the scarf at Spirit Flow',
    ],
  },
  {
    id: 'whirl',
    index: 1,
    name: 'Whirl Saucer',
    source: { kind: 'almanac', page: 5 },
    signature: 'Spinning Top',
    signatureHow: 'Sitting still and upright while the saucer spins flat under the rider',
    tiers: [
      'A chased steel skid ring under the rim, a bright line round the whole disc',
      'A cream quilted cushion in the dish, round the rider',
      'Six raised fins round the rim, a crown-like silhouette from behind',
      'A short mast at the back of the rim with a paper lamp',
      'An ink spiral inlaid in the dish that burns outward with the scarf at Spirit Flow',
    ],
  },
  {
    id: 'lodge',
    index: 2,
    name: 'Lodge Toboggan',
    source: { kind: 'shop', price: 300 },
    signature: 'Fireside',
    signatureHow: 'Lying back along the toboggan, hands behind the head, boots up',
    tiers: [
      'Steel-shod runner strips along the underside, their ends curled up at the tail',
      'A cream blanket roll strapped across the deck behind the rider',
      'The nose curl carved into a scroll with a crest board at the tail',
      'A lantern on a bent-wood hoop over the tail',
      'Ink inlay along the slats that burns with the scarf at Spirit Flow',
    ],
  },
  {
    id: 'comet',
    index: 3,
    name: 'Comet Bob',
    source: { kind: 'shop', price: 600 },
    signature: 'Comet Tail',
    signatureHow: 'Let go and trailing behind the sled from one runner, body streamed out flat',
    tiers: [
      'Polished steel runners with a second, raised shoe at the tail',
      'Quilted cream backrest panels inside the sideboards',
      'A tall tail fin on the cowl\'s spine, the comet streaking up it',
      'Twin lamps on the push bars',
      'The cream comet inlaid in ink that burns from its head to its tail at Spirit Flow',
    ],
  },
  {
    id: 'wisp',
    index: 4,
    name: 'Wisp',
    source: { kind: 'shop', price: 950 },
    signature: "Will-o'-Wisp",
    signatureHow: 'Floating a hand above the sled, both hands off, arms loose like a drifting light',
    tiers: [
      'Runners drawn out into long thin curls at both ends',
      'A pale pad with three cream cords laced across it',
      'Two swept wings off the deck\'s sides behind the rider',
      'A hanging lamp on a long bent stalk that sways',
      'Ink filigree on the wings that burns with the scarf at Spirit Flow',
    ],
  },
  {
    id: 'crumpet',
    index: 5,
    name: 'Tea Tray',
    source: { kind: 'shop', price: 1400 },
    signature: 'Teacup',
    signatureHow: 'Sitting cross-legged, turning the tray slowly with both hands',
    tiers: [
      'A raised gallery rail round the rim, pierced in a fretwork',
      'A cream embroidered cloth in the tray under the rider',
      'Two tall curled handles, fore and aft, the aft one a crest behind the rider',
      'A small lamp on the aft handle',
      'The chased ring and the fretwork inlaid in ink that burns at Spirit Flow',
    ],
  },
];

// ---------------------------------------------------------------- the shelves

const shop = (price: number): Source => ({ kind: 'shop', price });

export const ITEMS: readonly Item[] = [
  // Hats: told apart by outline from behind (ART.md 5), each in the player's vermillion with the cream knit or an
  // ink trim. None is one of The Twelve's hats (ART.md 13: a felt hood, antlers, a topknot, a wide brim, a stovepipe,
  // a giant bobble, a beak hood, a lantern on a headband, curled horns, an aviator cap, fox ears, a crown).
  { id: 'beanie', shelf: 'hat', name: 'Pom Beanie', source: { kind: 'free' }, status: 'kept', reads: 'Round crown, one big cream pom on top', levers: ['silhouette'], proto: true },
  { id: 'watch', shelf: 'hat', name: 'Watch Cap', source: shop(80), status: 'kept', reads: 'Low and flat-topped, a thick rolled cuff, nothing on top', levers: ['silhouette'], proto: true },
  { id: 'twinpom', shelf: 'hat', name: 'Twin Pom', source: shop(110), status: 'kept', reads: 'Two poms over the ears, a dip between them', levers: ['silhouette'], proto: true },
  { id: 'trapper', shelf: 'hat', name: 'Trapper', source: shop(150), status: 'kept', reads: 'Broad, a cream fur band and two long flaps to the scarf', levers: ['silhouette', 'material'], proto: true },
  { id: 'bobbles', shelf: 'hat', name: 'Bobble Crown', source: shop(200), status: 'reworked', reads: 'A ring of six bobbles stood on short stalks, so the crown reads as a spiky ring, not a pom', levers: ['silhouette'], proto: true },
  { id: 'chullo', shelf: 'hat', name: 'Braided Chullo', source: shop(260), status: 'kept', reads: 'A point on top and two braids hanging past the jaw', levers: ['silhouette', 'motion'], proto: true },
  { id: 'longcap', shelf: 'hat', name: 'Long Knit Cap', source: shop(320), status: 'kept', reads: 'A tail streaming back off one side, a pom at its end', levers: ['silhouette', 'motion'], proto: true },
  { id: 'crest', shelf: 'hat', name: 'Crest Knit', source: shop(400), status: 'new', reads: 'A fin of seven cream bobbles from brow to nape: a vertical stripe over the head', levers: ['silhouette', 'pattern'], proto: true },
  { id: 'muffs', shelf: 'hat', name: 'Pom Muffs', source: shop(480), status: 'new', reads: 'A knit band and two big fur muffs: wide at the ears, the dark hair showing on top', levers: ['silhouette', 'material'], proto: true },
  { id: 'downcap', shelf: 'hat', name: 'Down Cap', source: shop(580), status: 'new', reads: 'A big puffed dome in three fat quilted channels, stepped sides, no pom', levers: ['silhouette', 'material'], proto: true },
  { id: 'twintails', shelf: 'hat', name: 'Twin Tails', source: shop(700), status: 'new', reads: 'Two long knit tails off the back of the crown, streaming in a V above the scarf', levers: ['silhouette', 'motion'], proto: true },
  { id: 'floppeak', shelf: 'hat', name: 'Flop Peak', source: shop(850), status: 'new', reads: 'A tall soft felt cone that flops over to one side, a cream pom swinging at its tip', levers: ['silhouette', 'material', 'motion'], proto: true },

  // Scarves: the knot and the wrap stay the classic vermillion; what differs is how many tails and of what form,
  // what weights their ends, and a pattern in value (cream or ink) that the Spirit Flow burn keeps (the burn takes
  // each stitch's value, so an ink band burns dark and a cream one pale gold).
  { id: 'classic', shelf: 'scarf', name: 'Classic Knit', source: { kind: 'free' }, status: 'kept', reads: 'Two tails, two deeper stripes near the tips', levers: ['pattern'], proto: true },
  { id: 'creambar', shelf: 'scarf', name: 'Cream Bar', source: shop(80), status: 'kept', reads: 'Two tails, two cream bars across each near the tip', levers: ['pattern'], proto: true },
  { id: 'chunky', shelf: 'scarf', name: 'Chunky Rib', source: shop(110), status: 'reworked', reads: 'Short and twice as broad, ribbed in ink-deep rows so the rib reads past 5 m', levers: ['silhouette', 'pattern'], proto: true },
  { id: 'tassel', shelf: 'scarf', name: 'Fringe Knit', source: shop(150), status: 'reworked', reads: 'Tails ending in a long fringe, a third of the tail, that splays as it streams', levers: ['silhouette', 'motion'] },
  { id: 'inkband', shelf: 'scarf', name: 'Ink Bands', source: shop(190), status: 'kept', reads: 'Narrow ink bands all down its length: a dark-striped ribbon', levers: ['pattern'], proto: true },
  { id: 'snowtip', shelf: 'scarf', name: 'Snow Tip', source: shop(240), status: 'kept', reads: 'Cream-dipped ends and a cream fringe: pale tips', levers: ['pattern'] },
  { id: 'streamer', shelf: 'scarf', name: 'Long Streamer', source: shop(300), status: 'reworked', reads: 'One tail half as long again as the other: a long single line behind the rider', levers: ['silhouette', 'motion'], proto: true },
  { id: 'double', shelf: 'scarf', name: 'Double Wrap', source: shop(380), status: 'new', reads: 'Four tails, two pairs of two lengths, cream piping down their edges', levers: ['silhouette', 'pattern'], proto: true },
  { id: 'pomtails', shelf: 'scarf', name: 'Pom Tails', source: shop(480), status: 'new', reads: 'Each tail ends in a big knit pom that swings it low and heavy', levers: ['silhouette', 'motion'], proto: true },
  { id: 'cape', shelf: 'scarf', name: 'Wanderer\'s Cape', source: shop(800), status: 'new', reads: 'One broad knit panel down the back to the waist, its hem a cream chevron that flaps', levers: ['silhouette', 'pattern', 'motion'], proto: true },
  { id: 'almanacknot', shelf: 'scarf', name: 'Almanac Knot', source: { kind: 'almanac', page: 17 }, status: 'reworked', reads: 'A big bow at the throat with two short ink-tipped tails', levers: ['silhouette'] },
  { id: 'almanacveil', shelf: 'scarf', name: 'Night Veil', source: { kind: 'almanac', page: 42 }, status: 'reworked', reads: 'Long fine tails each weighted by a small paper lamp that glows from dusk', levers: ['silhouette', 'motion', 'light'], proto: true },

  // Trails: what the sled leaves, by shape and behaviour (billows, streaks, lines in the groove, paper, petals,
  // strings of bows), in the lantern's warm family only (ART.md 5): marigold, gold, cream, honey, white-gold paper.
  { id: 'powder', shelf: 'trail', name: 'Fresh Powder', source: { kind: 'free' }, status: 'kept', reads: 'Snow and only snow', levers: [], proto: true },
  { id: 'honey', shelf: 'trail', name: 'Honey Plume', source: shop(80), status: 'reworked', was: 'Honey Spray', reads: 'The spray thrown up in a rooster tail of big honey billows, twice as tall', levers: ['silhouette', 'motion'], proto: true },
  { id: 'sparks', shelf: 'trail', name: 'Lantern Sparks', source: shop(130), status: 'reworked', reads: 'Short marigold streaks that skip and bounce along the snow', levers: ['motion', 'light'], proto: true },
  { id: 'glints', shelf: 'trail', name: 'Gilt Groove', source: shop(180), status: 'reworked', was: 'Gold Glints', reads: 'Each rut takes a thin gold edge that glitters and fades over two seconds: two lines, not specks', levers: ['pattern', 'light'], proto: true },
  { id: 'papersnow', shelf: 'trail', name: 'Paper Snow', source: shop(250), status: 'new', was: 'Stardust (retired)', reads: 'Cut-paper snowflakes, palm-sized, that flutter and turn as they fall', levers: ['silhouette', 'motion'], proto: true },
  { id: 'comet', shelf: 'trail', name: 'Comet Tail', source: shop(340), status: 'reworked', reads: 'Two long light streaks off the runner tails that hang a second and a half: a long exposure', levers: ['silhouette', 'light'], proto: true },
  { id: 'petals', shelf: 'trail', name: 'Petal Drift', source: shop(450), status: 'new', reads: 'Cream and gold petals that spin flat and sail out sideways off the wake', levers: ['silhouette', 'motion'] },
  { id: 'streamers', shelf: 'trail', name: 'Paper Streamers', source: shop(580), status: 'new', reads: 'Strips of festival paper that tear off the stern and flap behind', levers: ['silhouette', 'motion'], proto: true },
  { id: 'kitetails', shelf: 'trail', name: 'Kite Tails', source: shop(750), status: 'new', reads: 'Two strings of paper bows streaming three metres back off the stern', levers: ['silhouette', 'motion'], proto: true },
  { id: 'almanacmoth', shelf: 'trail', name: 'Lamp Moths', source: { kind: 'almanac', page: 28 }, status: 'reworked', reads: 'Three soft lights that loop round the rider and follow: the only trail that circles', levers: ['motion', 'light'] },
  { id: 'almanacember', shelf: 'trail', name: 'Banked Embers', source: { kind: 'almanac', page: 46 }, status: 'reworked', reads: 'Coals dropped in the groove every metre that glow for three seconds: a dotted line left on the snow', levers: ['pattern', 'light'] },
  { id: 'almanackeeper', shelf: 'trail', name: "Keeper's Lantern", source: { kind: 'almanac', page: 50 }, status: 'reworked', reads: 'A paper lantern rides two metres behind on a line, its pool of light on the snow', levers: ['silhouette', 'light', 'motion'], proto: true },

  // Finishes (today's paints): a finish and a motif where the lens sees the sled (the tail, the slats' ends, the
  // sides, a round sled's rim and face), never a flat hex. No paint takes a role's colour (ART.md 13).
  { id: 'natural', shelf: 'finish', name: 'Natural', source: { kind: 'free' }, status: 'kept', reads: 'Oiled wood: two browns and the grain', levers: ['material'], proto: true },
  { id: 'pine', shelf: 'finish', name: 'Pine Lacquer', source: shop(80), status: 'reworked', reads: 'Deep green lacquer with a cream pinstripe round the deck\'s edge', levers: ['material', 'pattern'], proto: true },
  { id: 'glacier', shelf: 'finish', name: 'Glacier Enamel', source: shop(110), status: 'reworked', reads: 'A pale enamel: the one light sled under a dark rider, an ink pinstripe', levers: ['pattern'], proto: true },
  { id: 'midnight', shelf: 'finish', name: 'Midnight Stars', source: shop(150), status: 'reworked', reads: 'Navy with cream star specks across the tail', levers: ['pattern'], proto: true },
  { id: 'plum', shelf: 'finish', name: 'Plum Two-Tone', source: shop(200), status: 'reworked', reads: 'Plum slats, cream rails and crest: a light frame round a dark deck', levers: ['pattern'], proto: true },
  { id: 'cocoa', shelf: 'finish', name: 'Burnt Scroll', source: shop(250), status: 'reworked', was: 'Cocoa', reads: 'Dark stain with burnt-in scrolls down the slats\' ends', levers: ['material', 'pattern'] },
  { id: 'snow', shelf: 'finish', name: 'Finish Chequer', source: shop(310), status: 'reworked', was: 'Snowfield', reads: 'White with an ink chequer band across the tail: the finish line on your sled', levers: ['pattern'], proto: true },
  { id: 'ash', shelf: 'finish', name: 'Basalt Hex', source: shop(380), status: 'reworked', was: 'Basalt', reads: 'Near black with a fine cream hex lattice', levers: ['pattern', 'material'] },
  { id: 'stripes', shelf: 'finish', name: 'Twin Stripe', source: shop(480), status: 'new', reads: 'Two broad cream stripes down the outer slats, ink between: a racing stripe either side of the rider', levers: ['pattern'], proto: true },
  { id: 'gilt', shelf: 'finish', name: 'Gilt Scroll', source: shop(650), status: 'new', reads: 'Ink lacquer, cream scrollwork along the rails and crest catching the rim light', levers: ['material', 'pattern', 'light'] },
  { id: 'almanacdusk', shelf: 'finish', name: 'Almanac Pages', source: { kind: 'almanac', page: 38 }, status: 'reworked', was: 'Almanac Dusk', reads: 'Cream deck ruled in ink lines like a page of the Almanac', levers: ['pattern', 'material'] },

  // Ornaments: what stands on the stern post once a sled's fourth tier is fitted (the lamp is the post's own). Never
  // sold in the shop: sets, chapters and the Almanac.
  { id: 'lamp', shelf: 'ornament', name: 'Stern Lamp', source: { kind: 'free' }, status: 'new', reads: 'A cream paper lamp with an ink cap: a small light over the tail', levers: ['silhouette', 'light'], proto: true },

  // Sounds: unchanged in kind (the audio lane owns how they sound); the garage plays each as you browse.
  { id: 'runners', shelf: 'sound', name: 'Steel Runners', source: { kind: 'free' }, status: 'kept', reads: 'The hiss of steel on packed snow', levers: [] },
  { id: 'timber', shelf: 'sound', name: 'Old Timber', source: shop(100), status: 'kept', reads: 'Creaking boards, a wooden knock on landing', levers: [] },
  { id: 'bells', shelf: 'sound', name: 'Sleigh Bells', source: shop(140), status: 'kept', reads: 'Bells that ring with every turn', levers: [] },
  { id: 'glass', shelf: 'sound', name: 'Glass Chime', source: shop(180), status: 'kept', reads: 'Runners that sing like a rubbed glass', levers: [] },
  { id: 'lantern', shelf: 'sound', name: 'Lantern Song', source: shop(240), status: 'kept', reads: 'A warm hum that brightens as the lantern fills', levers: [] },
];

// ---------------------------------------------------------------- the mountains' sets

export interface MountainSet {
  mountain: string;
  name: string;
  /** The motif all three pieces share. */
  motif: string;
  scarf: { name: string; reads: string };
  trail: { name: string; reads: string };
  ornament: { name: string; reads: string };
}

export const SETS: readonly MountainSet[] = [
  {
    mountain: 'pinecrest',
    name: 'The Pinecrest Set',
    motif: 'the fir bough and the White Stag',
    scarf: { name: 'Fir Chevron', reads: 'Cream chevrons pointing down each tail like fir boughs' },
    trail: { name: 'Stag Prints', reads: 'Hoofprints of light pressed beside the groove, in bounds, fading behind (the White Stag\'s own)' },
    ornament: { name: 'Cowbell', reads: 'A big cream-and-ink bell on the stern post that swings and rings on landings' },
  },
  {
    mountain: 'frostfang',
    name: 'The Frostfang Set',
    motif: 'the Fang and the crevasse ice',
    scarf: { name: 'Fang Edge', reads: 'Tails cut into a sawtooth hem, ink at the teeth' },
    trail: { name: 'Frost Feathers', reads: 'Fern-like frost growing out from the ruts in cream-gold, then melting' },
    ornament: { name: 'Ice Fang', reads: 'A curved crystal tooth on the post that throws a glint' },
  },
  {
    mountain: 'ember',
    name: 'The Ember Set',
    motif: 'the basalt pipes and the lava threads',
    scarf: { name: 'Ash Market', reads: 'Tails cut into flame tongues at the tips, charcoal ink bands above' },
    trail: { name: 'Molten Cracks', reads: 'Branching marigold cracks open in the snow behind and seal over' },
    ornament: { name: 'Basalt Crown', reads: 'A cluster of three hex columns with a glowing seam' },
  },
  {
    mountain: 'sakura',
    name: 'The Sakura Set',
    motif: 'the torii, paper and cranes',
    scarf: { name: 'Petal Hem', reads: 'Scalloped edges down both tails, cream dots' },
    trail: { name: 'Paper Cranes', reads: 'Folded cranes that flap up off the wake in pairs: the only trail that climbs' },
    ornament: { name: 'Paper Crane', reads: 'A cream folded crane on the post, its wings lifting with speed' },
  },
  {
    mountain: 'lanternfall',
    name: 'The Lanternfall Set',
    motif: 'the lamplighters\' lanterns',
    scarf: { name: 'Lamp Road', reads: 'A long streamer with cream bars graded like a row of lamps' },
    trail: { name: 'Sky Lanterns', reads: 'Small paper lanterns lift off the stern every few seconds and rise into the sky' },
    ornament: { name: 'Great Lantern', reads: 'A small storeyed lantern of lit paper on the post, the finale\'s own' },
  },
];

/** The three new mountains get a set each, designed with the mountain (the concepts lane's pick, at the round's stop). */
export const NEW_MOUNTAIN_SETS = 3;

// ---------------------------------------------------------------- the months' chapters

export interface ChapterSet {
  month: number;
  name: string;
  motif: string;
  scarf: { name: string; reads: string };
  trail: { name: string; reads: string };
  ornament: { name: string; reads: string };
}

/** Each month's set looks like its month (today's are made by turning a pattern list and two colour lists, so four
 *  of the twelve paints repeat shop paints and every trail is a shop trail's motes in another tint). Scarf on page 3,
 *  trail on page 6, ornament on page 8 (today's paint page), the title on page 10. */
export const CHAPTERS: readonly ChapterSet[] = [
  { month: 1, name: 'First Light', motif: 'the sunrise', scarf: { name: 'Sunrise Bars', reads: 'Cream bars widening toward the tips like rays' }, trail: { name: 'Dawn Fans', reads: 'Little fans of light flicked off each carve' }, ornament: { name: 'Sun Disc', reads: 'A rayed cream disc on the post' } },
  { month: 2, name: 'The Long Frost', motif: 'the icicle', scarf: { name: 'Icicle Fringe', reads: 'A fringe of stiff cream points that do not splay' }, trail: { name: 'Icicle Chimes', reads: 'Small icicles drop off the runners and shatter on the snow' }, ornament: { name: 'Icicle Crown', reads: 'A ring of hanging icicles round the post\'s head' } },
  { month: 3, name: 'Thaw Lanterns', motif: 'the lantern and the drip', scarf: { name: 'Drip Hem', reads: 'Tails with rounded drop-shaped ends' }, trail: { name: 'Drip Lights', reads: 'Drops of light fall from the stern and splash in rings' }, ornament: { name: 'Thaw Lantern', reads: 'A tall narrow lantern with a dripping wax foot' } },
  { month: 4, name: 'Blossom Run', motif: 'the five-petalled blossom', scarf: { name: 'Blossom Knit', reads: 'Cream five-petal flowers knitted at the tips' }, trail: { name: 'Blossom Pops', reads: 'Cream blossoms pop open on every landing and drift off' }, ornament: { name: 'Blossom Sprig', reads: 'A sprig of three cream blossoms on the post' } },
  { month: 5, name: 'Ash and Ember', motif: 'the flame tongue', scarf: { name: 'Ember Knit', reads: 'Ink-dipped tips with a cream flame band' }, trail: { name: 'Ember Tongues', reads: 'Short flame-shaped tongues that lick up off the runners' }, ornament: { name: 'Brazier', reads: 'A small iron brazier on the post with a lit bed' } },
  { month: 6, name: 'Midsummer Snow', motif: 'the high sun', scarf: { name: 'Midsummer Ribbons', reads: 'Two long thin ribbons per tail, braided at the knot' }, trail: { name: 'Sun Motes', reads: 'Round rayed suns that roll along the snow and fade' }, ornament: { name: 'Sun Wheel', reads: 'A spoked wheel of cream rays that turns with speed' } },
  { month: 7, name: 'Night Market', motif: 'the market string', scarf: { name: 'Market Tassels', reads: 'Short tails ending in heavy cream tassels' }, trail: { name: 'Market Ribbons', reads: 'Ribbons of cream paper tied in bows tumble off' }, ornament: { name: 'Lantern String', reads: 'A short string of three tiny lanterns hung from the post' } },
  { month: 8, name: 'Paper Cranes', motif: 'the folded fan', scarf: { name: 'Folded Fan', reads: 'Tails pleated in fan folds that open as they stream' }, trail: { name: 'Folded Fans', reads: 'Paper fans that flutter open and shut as they fall' }, ornament: { name: 'Paper Fan', reads: 'An open paper fan stood on the post' } },
  { month: 9, name: 'Harvest Moon', motif: 'the crescent', scarf: { name: 'Crescent Knit', reads: 'Ink crescents down the tails' }, trail: { name: 'Moon Slivers', reads: 'Thin crescents of light that tumble end over end' }, ornament: { name: 'Crescent Moon', reads: 'A cream crescent on the post, horns up' } },
  { month: 10, name: 'The Haunting', motif: 'the hollow lantern', scarf: { name: 'Hollow Stitch', reads: 'Tails with open-work holes knitted through them' }, trail: { name: 'Hollow Lights', reads: 'Round paper lanterns with cut eyes bob behind and wink out' }, ornament: { name: 'Hollow Lantern', reads: 'A round lantern with cut eyes, lit' } },
  { month: 11, name: 'First Snow', motif: 'the snowball', scarf: { name: 'Snowball Tails', reads: 'Tails ending in round cream snowballs that bounce' }, trail: { name: 'Snowballs', reads: 'Little snowballs roll off the runners and burst' }, ornament: { name: 'Snow Ball', reads: 'A stacked pair of snowballs with a stick arm' } },
  { month: 12, name: 'Lantern Night', motif: 'the star', scarf: { name: 'Star Knit', reads: 'Cream stars knitted down the tails' }, trail: { name: 'Star Strings', reads: 'Strings of small paper stars fluttering off the stern' }, ornament: { name: 'Lantern Star', reads: 'A cut-paper star lantern, lit' } },
];

// ---------------------------------------------------------------- today's near-duplicates, and what becomes of each

export interface NearDuplicate {
  a: string;
  b: string;
  why: string;
  fate: string;
}

export const NEAR_DUPLICATES: readonly NearDuplicate[] = [
  { a: 'Night Market Paint (chapter 7, #6B4A3A)', b: 'Cocoa (#6A4636)', why: 'Delta E 2.1: the same brown', fate: 'Chapter paints leave: each chapter\'s third piece is an ornament in its month\'s motif' },
  { a: 'First Snow Paint (chapter 11, #D8DEE9)', b: 'Snowfield (#E9ECF5)', why: 'Delta E 5.3', fate: 'As above; Snowfield becomes Finish Chequer' },
  { a: 'The Long Frost Paint (chapter 2, #8FB4D9)', b: 'Glacier (#9FC4E8)', why: 'Delta E 5.9', fate: 'As above; Glacier becomes Glacier Enamel with an ink pinstripe' },
  { a: 'Ash and Ember Paint (chapter 5, #5A3B36)', b: 'Cocoa (#6A4636)', why: 'Delta E 8.9 (and 9.2 from Night Market)', fate: 'As above; Cocoa becomes Burnt Scroll' },
  { a: 'The Haunting, Thaw Lanterns, Midsummer and First Light paints', b: 'Basalt, Almanac Dusk, Glacier, Pine', why: 'Delta E 9.4 to 10.7: hue-only steps a rider covers', fate: 'As above' },
  { a: 'Midnight (#2A3570)', b: 'Almanac Dusk (#46507E)', why: 'Delta E 15 on a deck the rider hides', fate: 'Midnight Stars (motif) and Almanac Pages (ruled cream): one dark, one light' },
  { a: "Keeper's Lantern (Almanac 50)", b: 'Comet Tail', why: 'Both stream marigold motes off the runners (64 a second against 60, tint #FFEFC2 0.4 against #FFE6B3 0.35)', fate: "Keeper's Lantern becomes a paper lantern on a line behind the sled; Comet Tail two long light streaks" },
  { a: 'Banked Embers (Almanac 46)', b: 'Gold Glints', why: 'Both twinkle marigold specks low in the groove (36 a second against 34)', fate: 'Banked Embers drops coals that stay and glow; Gold Glints becomes Gilt Groove, a gold edge on the ruts' },
  { a: 'Lamp Moths (Almanac 28)', b: 'Stardust', why: 'Both twinkle cream specks (30 against 48 a second)', fate: 'Lamp Moths circle the rider; Stardust retires into Paper Snow' },
  { a: 'Honey Spray', b: 'Fresh Powder', why: 'A tint of the same spray: a hue, not an item', fate: 'Honey Plume: a rooster tail twice as tall' },
  { a: 'The twelve chapter trails', b: 'Gold Glints or Comet Tail', why: 'Every one is marigold motes, twinkle or stream, over a near-white tint', fate: 'Each month a trail of its own shape (fans, icicles, drops, blossoms ...)' },
  { a: 'Chapter scarves 5 and 11', b: 'Classic Knit and Fringe Knit', why: 'tipStripes ignores the accent: the same knit at 1.1 length', fate: 'Each month a scarf of its own form (sunrise bars, icicle fringe, drip hem ...)' },
  { a: 'Chapter scarves 6 and 12', b: 'each other, and Long Streamer', why: 'plain ignores the accent', fate: 'As above' },
  { a: 'Chapter scarves 2 and 8', b: 'Chunky Rib', why: 'rib ignores the accent', fate: 'As above' },
  { a: 'Chapter scarf 9 (tip, ink)', b: 'Almanac Knot (tip, ink)', why: 'The same pattern and accent, 0.1 longer', fate: 'Almanac Knot becomes a bow at the throat' },
  { a: 'Classic Knit, Cream Bar, Ink Bands, Chunky Rib', b: 'each other', why: 'One structure, a stripe apart (to be judged at race distance)', fate: 'Kept as the entry rung, reworked where the critic cannot tell them' },
];

// ---------------------------------------------------------------- what the economy spends

/** Everything priced in gifts that a spender may buy, with what it needs first. */
export interface Buyable {
  id: string;
  shelf: ShelfId;
  price: number;
  /** A sled's track tier: the sled and the stage lines on it it needs. */
  track?: { sled: string; tier: number; lines: number };
  /** A chapter piece: its month (on sale from then). */
  month?: number;
}

export function proposedBuyables(): Buyable[] {
  const out: Buyable[] = [];
  for (const s of SLEDS) if (s.source.kind === 'shop') out.push({ id: `sled:${s.id}`, shelf: 'sled', price: s.source.price });
  for (const s of SLEDS) for (let t = 0; t < 5; t++) out.push({ id: `track:${s.id}:${t}`, shelf: 'track', price: trackPrice(s.id, t), track: { sled: s.id, tier: t, lines: TRACK_LINES[t] } });
  for (const it of ITEMS) if (it.source.kind === 'shop') out.push({ id: `${it.shelf}:${it.id}`, shelf: it.shelf, price: it.source.price });
  for (const ch of CHAPTERS) {
    out.push({ id: `chapter:${ch.month}:scarf`, shelf: 'scarf', price: CHAPTER_PRICES.scarf, month: ch.month });
    out.push({ id: `chapter:${ch.month}:trail`, shelf: 'trail', price: CHAPTER_PRICES.trail, month: ch.month });
    out.push({ id: `chapter:${ch.month}:ornament`, shelf: 'ornament', price: CHAPTER_PRICES.ornament, month: ch.month });
  }
  return out;
}

/** Counts by shelf of what the proposal holds (the shop's, the Almanac's, the sets' and the chapters'). */
export function shelfCounts(): Record<string, { shop: number; almanac: number; sets: number; chapters: number; free: number }> {
  const c: Record<string, { shop: number; almanac: number; sets: number; chapters: number; free: number }> = {};
  const at = (s: string) => (c[s] ??= { shop: 0, almanac: 0, sets: 0, chapters: 0, free: 0 });
  for (const it of ITEMS) {
    const k = it.source.kind;
    if (k === 'shop') at(it.shelf).shop++;
    else if (k === 'almanac') at(it.shelf).almanac++;
    else if (k === 'free') at(it.shelf).free++;
  }
  for (const shelf of ['scarf', 'trail', 'ornament'] as const) {
    at(shelf).sets += SETS.length + NEW_MOUNTAIN_SETS;
    at(shelf).chapters += CHAPTERS.length;
  }
  for (const s of SLEDS) {
    if (s.source.kind === 'shop') at('sled').shop++;
    else if (s.source.kind === 'almanac') at('sled').almanac++;
    else at('sled').free++;
  }
  at('track').shop = SLEDS.length * 5;
  return c;
}
