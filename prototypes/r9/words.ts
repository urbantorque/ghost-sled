// Round 9, the screens lane: an Almanac reward named as a player would name the prize, for the title's quiet line, the
// Progress room and the results' reward card. "Charm: Kite String" reads "the Kite String charm"; a garage piece names
// its shelf ("the Almanac Knot scarf"); never "+1", never "Page 5".
import type { RewardCard } from '../../src/ui/contract';
import { GARAGE_EXTRAS } from '../../src/game/almanac';

const SHELF: Record<string, string> = { scarf: 'scarf', trail: 'trail', paint: 'paint' };

/** The prize, as a noun phrase that can start a sentence. */
export function prize(r: Pick<RewardCard, 'kind' | 'name'>): string {
  const charm = /^Charm: (.+)$/.exec(r.name);
  if (charm) return `The ${charm[1]} charm`;
  const title = /^Title: (.+)$/.exec(r.name);
  if (title) return `The title ${title[1]}`;
  if (r.kind === 'garage') {
    const g = GARAGE_EXTRAS.find((x) => x.name === r.name);
    return g ? `The ${g.name} ${SHELF[g.shelf] ?? ''}`.trim() : r.name;
  }
  if (r.kind === 'mirror') return `${r.name.replace(/^Mirror /, '')}, mirrored`;
  return r.name.charAt(0).toUpperCase() + r.name.slice(1);
}

/** What a newly opened system is, in one line: said once, on the results that open it and in its door. */
export const SAYS: Readonly<Record<string, string>> = {
  'Daily contracts': 'Three small goals a day',
  'The Spirit Album': 'A sticker for all you do',
  'The Long Night': 'Mountains back to back',
  'Call your rival': 'Pick who you race',
  Trials: 'A new rule every week',
};
