import { Rng } from '../sim/prng';

// Friendly ghost handles. Everything is drawn from curated lists so a seeded roll can never
// produce anything rude, and every result fits the run record's name rules.

export const NAME_MAX = 16;
const VALID = /^[A-Za-z0-9 _.\-]{1,16}$/;
/** Accidental joins that read badly in lowercase or trip platform word filters ("TundraPeak",
 *  "CometHusky", "PuffinIgloo"), and numbers with unwanted meanings. Matching names are rerolled. */
const AVOID = /rape|nig|anal|tit|meth|ass|sex|cum|fag|poo|69|88|420|666/;

const FIRST: readonly string[] = [
  'Mila', 'Pete', 'Juno', 'Sven', 'Aiko', 'Tess', 'Ravi', 'Amara', 'Kenji', 'Lena', 'Mateo', 'Zara',
  'Noor', 'Ingrid', 'Kofi', 'Yuki', 'Priya', 'Lars', 'Ana', 'Diego', 'Sora', 'Femi', 'Olga', 'Tariq',
  'Leilani', 'Nils', 'Wei', 'Mei', 'Hana', 'Arjun', 'Chloe', 'Emil', 'Freya', 'Gus', 'Ines', 'Jonas',
  'Kai', 'Liv', 'Malik', 'Nia', 'Oskar', 'Paz', 'Quinn', 'Rosa', 'Sami', 'Tomas', 'Uma', 'Vera',
  'Wren', 'Xavi', 'Yara', 'Zane', 'Ayla', 'Bo', 'Cleo', 'Dara', 'Eli', 'Faye', 'Gio', 'Hugo', 'Ida',
  'Jin', 'Kira', 'Luca', 'Maya', 'Nico', 'Omar', 'Pia', 'Rumi', 'Suki', 'Teo', 'Ulla', 'Vik', 'Yusuf',
  'Zoe', 'Aksel', 'Bea', 'Chidi', 'Dev', 'Esme', 'Farah', 'Hiro', 'Iker', 'Jules', 'Kalani', 'Lupe',
  'Mira', 'Nadia', 'Otto', 'Petra', 'Rafa', 'Thabo', 'Valo', 'Yaw', 'Ada', 'Bjorn', 'Coco', 'Dmitri',
  'Elif', 'Fynn', 'Greta', 'Hamid', 'Isla', 'Joon', 'Kemal', 'Lucia', 'Mosi', 'Nell', 'Oona', 'Pablo',
  'Rhea', 'Sanjay', 'Tove', 'Umar', 'Vida', 'Wiremu', 'Ximena', 'Yosef', 'Zeynep', 'Anouk', 'Bilal',
];

/** Snowy nouns, used as prefixes, suffixes and stand-alone handles. */
const SNOW: readonly string[] = [
  'Ice', 'Powder', 'Frost', 'Flurry', 'Tundra', 'Summit', 'Glacier', 'Sleet', 'Blizzard', 'Pine',
  'Cocoa', 'Mitten', 'Igloo', 'Alpine', 'Slope', 'Peak', 'Ridge', 'Comet', 'Aurora', 'Polar', 'Chill',
  'Icicle', 'Sledge', 'Mogul', 'Crystal', 'Flake', 'Winter', 'Yeti', 'Penguin', 'Husky', 'Lynx',
  'Kestrel', 'Fox', 'Owl', 'Marmot', 'Puffin', 'Ermine', 'Boreal', 'Fjord', 'Rime', 'Cornice',
  'Crest', 'Sparkle', 'Breeze', 'Gust', 'Zephyr', 'Snowdrop', 'Toboggan', 'Avalanche', 'Lantern',
  'Cedar', 'Spruce', 'Birch', 'Ptarmigan', 'Bobsled', 'Scarf', 'Beanie', 'Hailstone', 'Starling',
];

/** Adjective-ish words that read well before a name ("Tundra Tess", "Frosty Femi"). */
const EPITHET: readonly string[] = [
  'Tundra', 'Frosty', 'Powder', 'Speedy', 'Breezy', 'Snowy', 'Chilly', 'Swift', 'Lucky', 'Sunny',
  'Brave', 'Jolly', 'Cosmic', 'Turbo', 'Mighty', 'Comet', 'Polar', 'Alpine', 'Sparky', 'Zippy',
];

/** Verbs and moves for dotted handles ("juno.glide"). */
const MOVE: readonly string[] = [
  'glide', 'drift', 'carve', 'flips', 'spins', 'slides', 'sends', 'shreds', 'rides', 'floats',
  'zooms', 'swoosh', 'hops', 'cruise', 'loops', 'twirl', 'dash', 'soar',
];

/** Playful surnames for "First Lastname" handles ("Sven Sledsen"). */
const SURNAME: readonly string[] = [
  'Sledsen', 'Frostberg', 'Snowfield', 'Iceland', 'Pinewood', 'Drifter', 'Coldwell', 'Wintergreen',
  'Hillman', 'Glider', 'Slopes', 'Powders', 'Carver', 'Northwind', 'Snowberg', 'Flakeson',
];

function sameInitial(list: readonly string[], letter: string, rng: Rng): string | null {
  const opts = list.filter((w) => w[0].toUpperCase() === letter);
  return opts.length ? rng.pick(opts) : null;
}

function digits(rng: Rng): string {
  return rng.chance(0.5) ? String(rng.int(2, 99)) : String(rng.int(100, 999));
}

function compose(rng: Rng): string {
  const first = rng.pick(FIRST);
  switch (rng.int(0, 9)) {
    case 0:
      // Mila_on_Ice
      return `${first}_on_${rng.pick(['Ice', 'Snow', 'Skis', 'Air', 'Fire', 'Powder', 'Tour'])}`;
    case 1: {
      // PowderPete: alliterate when the lists allow it.
      const word = sameInitial(SNOW, first[0], rng) ?? rng.pick(SNOW);
      return word + first;
    }
    case 2:
      // juno.glide
      return `${first.toLowerCase()}.${rng.pick(MOVE)}`;
    case 3:
      // Sven Sledsen
      return `${first} ${rng.pick(SURNAME)}`;
    case 4:
      // kestrel22
      return rng.pick(SNOW).toLowerCase() + digits(rng);
    case 5:
      // Aiko Drift
      return `${first} ${rng.pick(['Drift', 'Glide', 'Carve', 'Spin', 'Flip', 'Rush', 'Frost', 'Blaze', 'Dash'])}`;
    case 6: {
      // Tundra Tess
      const ep = sameInitial(EPITHET, first[0], rng) ?? rng.pick(EPITHET);
      return `${ep} ${first}`;
    }
    case 7:
      // nia_sleds
      return `${first.toLowerCase()}_${rng.pick(['sleds', 'rides', 'flies', 'skis', 'goes', 'runs'])}`;
    case 8: {
      // FrostFox
      const a = rng.pick(SNOW);
      const b = rng.pick(SNOW);
      return a === b ? a + digits(rng) : a + b;
    }
    default:
      // Ravi-77
      return `${first}${rng.pick(['-', '_', ''])}${digits(rng)}`;
  }
}

export function isValidGhostName(name: string): boolean {
  return VALID.test(name) && name.trim() === name;
}

/** A friendly, varied handle (16 characters max, only [A-Za-z0-9 _.-]). */
export function ghostName(rng: Rng): string {
  for (let i = 0; i < 8; i++) {
    const n = compose(rng);
    if (n.length <= NAME_MAX && isValidGhostName(n) && !AVOID.test(n.toLowerCase())) return n;
  }
  // A bare first name and one digit can never hit the avoid list.
  return rng.pick(FIRST) + rng.int(2, 9);
}

/** Names that are unique within one pool: rerolls collisions, then falls back to a numbered name. */
export function uniqueGhostName(rng: Rng, taken: Set<string>): string {
  for (let i = 0; i < 24; i++) {
    const n = ghostName(rng);
    if (!taken.has(n.toLowerCase())) {
      taken.add(n.toLowerCase());
      return n;
    }
  }
  for (let k = 2; ; k++) {
    const n = (rng.pick(FIRST) + k).slice(0, NAME_MAX);
    if (!taken.has(n.toLowerCase()) && !AVOID.test(n.toLowerCase())) {
      taken.add(n.toLowerCase());
      return n;
    }
  }
}
