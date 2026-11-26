import type { RewardCard } from './contract';
import { GARAGE_EXTRAS } from '../game/almanac';

// Round 9 (U1, U2): an Almanac reward named as a player would name the prize, for the title's quiet line, the
// Progress room and the results' reward card. "Charm: Kite String" reads "The Kite String charm"; a garage piece names
// its shelf ("The Almanac Knot scarf"); never "+1", never "Page 5". From prototypes/r9/words.ts (milestone 0).

const SHELF: Record<string, string> = { scarf: 'scarf', trail: 'trail', paint: 'paint' };

/** The prize, as a noun phrase that can start a sentence. */
export function prize(r: { kind?: RewardCard['kind']; name: string }): string {
  const charm = /^Charm: (.+)$/.exec(r.name);
  if (charm) return `The ${charm[1]} charm`;
  const title = /^Title: (.+)$/.exec(r.name);
  if (title) return `The title ${title[1]}`;
  // (Without a kind, a name alone: fmt.ts rewardsLine names a page's rewards from their names.)
  const g = r.kind === 'garage' || r.kind === undefined ? GARAGE_EXTRAS.find((x) => x.name === r.name) : undefined;
  if (g) return `The ${g.name} ${SHELF[g.shelf] ?? ''}`.trim();
  if (r.kind === 'mirror' || (r.kind === undefined && /^Mirror /.test(r.name))) return `${r.name.replace(/^Mirror /, '')}, mirrored`;
  return r.name.charAt(0).toUpperCase() + r.name.slice(1);
}

/** The same prize inside a sentence: "a new sled", "the Kite String charm" (a mountain's name keeps its capital). */
export function prizeLower(r: { kind?: RewardCard['kind']; name: string }): string {
  const p = prize(r);
  return /^(A|An|The|Every) /.test(p) ? p.charAt(0).toLowerCase() + p.slice(1) : p;
}

/** A page's prizes in one line of words: "A new sled and a flourish for Spinning Top". */
export function prizesLine(list: ReadonlyArray<{ kind?: RewardCard['kind']; name: string }>): string {
  const words = list.map((r, i) => (i === 0 ? prize(r) : prizeLower(r)));
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** What a newly opened system is, in one line: said once, on the results that open it and in its door's room. */
export const SAYS: Readonly<Record<string, string>> = {
  'Daily contracts': 'Three small goals a day',
  'The Spirit Album': 'A sticker for all you do',
  'The Long Night': 'Mountains back to back',
  'Call your rival': 'Pick who you race',
  Trials: 'A new rule every week',
};

/** "0.4 s" and "85 m" never break between the number and the unit. */
export const nb = (s: string): string => s.replace(/(\d) ([ms])\b/g, '$1 $2');

/** First letter lower, for a phrase set inside a sentence. */
export const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Curly apostrophes in what a player reads (a straight one reads as a backtick in bold italic). */
export const curly = (s: string): string => s.replace(/'/g, '’');
