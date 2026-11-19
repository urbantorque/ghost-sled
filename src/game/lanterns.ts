import type { SaveData } from './save';

// The Lantern Row (round 8): the long thing gifts buy. Each named mountain's finish town has a row of eight lanterns
// to light, one after another, each dearer than the last; a lit lantern hangs in that town at the finish and on the
// mountain's title shot for good. It is a look and nothing else: no lantern reaches the sim, a sled, the lantern's
// charge or a ghost. It exists because gifts outrun the garage: the mid pilot can buy the whole garage, sleds and
// shelves and paints, by about its 25th run, and a month's chapter set adds under a thousand gifts, so without a
// long sink a run 100 player has gifts and nothing to want (scripts/playtest/r8-bars.ts shows the table).
//
// The lanterns are marigold, the lantern's and the gifts' colour role (ART.md section 1).
//
// Pure: no DOM, render or audio imports.

export const LANTERN_TOWNS: readonly { mountain: string; town: string }[] = [
  { mountain: 'pinecrest', town: 'Old Town' },
  { mountain: 'frostfang', town: 'the Ice Hall' },
  { mountain: 'ember', town: 'the Ash Market' },
  { mountain: 'sakura', town: 'Temple Town' },
  { mountain: 'lanternfall', town: 'Firstlight' },
];

/** Lanterns in each town's row. */
export const ROW_LENGTH = 8;

/** What the nth lantern of a row costs (0-based): 150, 225, 300 ... 675. */
export function lanternPrice(i: number): number {
  return 150 + 75 * i;
}

export function lanternId(mountain: string, i: number): string {
  return `${mountain}:${i}`;
}

/** Every lantern, town by town. */
export const LANTERNS: readonly { id: string; mountain: string; town: string; index: number; price: number }[] = LANTERN_TOWNS.flatMap((t) =>
  Array.from({ length: ROW_LENGTH }, (_, i) => ({ id: lanternId(t.mountain, i), mountain: t.mountain, town: t.town, index: i, price: lanternPrice(i) })),
);

/** The lanterns lit in a town, as a count (a row is lit in order). */
export function litIn(d: Pick<SaveData, 'lit'>, mountain: string): number {
  let n = 0;
  while (n < ROW_LENGTH && (d.lit ?? []).includes(lanternId(mountain, n))) n++;
  return n;
}

/** What each finish town hangs: its lanterns lit, by mountain id (the world's whole read of the row). */
export function litByTown(d: Pick<SaveData, 'lit'>): Record<string, number> {
  return Object.fromEntries(LANTERN_TOWNS.map((t) => [t.mountain, litIn(d, t.mountain)]));
}

/** The next lantern each town can light: its row's first unlit one, on a mountain that is open. */
export function lanternShelf(d: Pick<SaveData, 'lit'>, open: (mountain: string) => boolean): Array<(typeof LANTERNS)[number]> {
  const out: Array<(typeof LANTERNS)[number]> = [];
  for (const t of LANTERN_TOWNS) {
    if (!open(t.mountain)) continue;
    const n = litIn(d, t.mountain);
    if (n < ROW_LENGTH) out.push(LANTERNS.find((l) => l.id === lanternId(t.mountain, n))!);
  }
  return out;
}

/** Lights a lantern for its price: only the next in its row, only with the gifts. */
export function lightLantern(d: SaveData, id: string, open: (mountain: string) => boolean): boolean {
  const l = lanternShelf(d, open).find((x) => x.id === id);
  if (!l || d.gifts < l.price) return false;
  d.gifts -= l.price;
  d.lit = [...(d.lit ?? []), id];
  return true;
}

/** A saved list read safely: known lanterns only, each once, and a row only as far as it is lit in order. */
export function readLit(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const set = new Set(v.filter((x): x is string => typeof x === 'string' && LANTERNS.some((l) => l.id === x)));
  const out: string[] = [];
  for (const t of LANTERN_TOWNS) for (let i = 0; i < ROW_LENGTH && set.has(lanternId(t.mountain, i)); i++) out.push(lanternId(t.mountain, i));
  return out.length ? out : null;
}
