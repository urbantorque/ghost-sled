import { describe, expect, it } from 'vitest';
import { LEGS } from '../src/game/modes';
import { INTROS_KEPT, INTROS_SEEN_KEPT, SAVE_KEY, SaveStore, defaultSave } from '../src/game/save';
import { rewardGlyph } from '../src/ui/almanac';
import { iconSvg } from '../src/ui/icons';

// Round 9, the u4 lane (notes/r9-u4.md): what can be held without a page. The title's "New" kept in the save (an old
// save loads whole, a strange one is read safely); a garage piece drawn with its shelf's glyph; the Long Night's legs
// said in words however many are open (sixteen once the three new mountains are in).

class MemStorage {
  map = new Map<string, string>();
  constructor(raw?: unknown) {
    if (raw !== undefined) this.map.set(SAVE_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

describe('the title\'s "New" in the save', () => {
  it('loads an old save whole, with no intros written', () => {
    const d = new SaveStore(new MemStorage({ v: 1, name: 'Ilse', gifts: 30, runs: 4, best: {}, grudge: {}, missions: { active: [], cursor: 0, completed: 0 }, settings: {}, stats: {}, hints: {}, daily: {} }), 'x').data;
    expect(d.intros).toBeUndefined();
    expect(d.introsSeen).toBeUndefined();
    expect(d.gifts).toBe(30);
  });

  it('round-trips what a run opened and the lines opened, and drops what it cannot read', () => {
    const raw = {
      ...defaultSave('A'),
      intros: [{ door: 'garage', line: 'New: a sled of your own, in the garage.' }, { door: 'garage', line: 'New: a sled of your own, in the garage.' }, { door: 'attic', line: 'x' }, { door: 'events', line: '<b>no</b>' }, 'nope', { door: 'progress', line: 'New: the Spirit Album. A sticker for all you do.' }],
      introsSeen: ['2026-11-26 Three new contracts today.', 7, '', '2026-11-26 Three new contracts today.'],
    };
    const d = new SaveStore(new MemStorage(raw), 'x').data;
    expect(d.intros).toEqual([
      { door: 'garage', line: 'New: a sled of your own, in the garage.' },
      { door: 'progress', line: 'New: the Spirit Album. A sticker for all you do.' },
    ]);
    expect(d.introsSeen).toEqual(['2026-11-26 Three new contracts today.']);
  });

  it('keeps the newest few of each', () => {
    const many = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    const d = new SaveStore(new MemStorage({ ...defaultSave('A'), intros: many.map((line) => ({ door: 'events', line })), introsSeen: many }), 'x').data;
    expect(d.intros?.length).toBe(INTROS_KEPT);
    expect(d.intros?.[INTROS_KEPT - 1].line).toBe('line 39');
    expect(d.introsSeen?.length).toBe(INTROS_SEEN_KEPT);
    expect(d.introsSeen?.[0]).toBe(`line ${40 - INTROS_SEEN_KEPT}`);
  });
});

describe('a garage piece on the results', () => {
  it('is drawn with its shelf\'s glyph, never the sled\'s', () => {
    expect(rewardGlyph('garage', { shelf: 'scarf' })).toBe('scarf');
    expect(rewardGlyph('garage', { shelf: 'trail' })).toBe('trail');
    expect(rewardGlyph('garage', { shelf: 'ornament' })).toBe('ornament');
    expect(rewardGlyph('garage', { shelf: 'paint' })).toBe('brush');
    for (const g of ['scarf', 'trail', 'ornament', 'brush'] as const) expect(iconSvg(g)).toMatch(/<path/);
    expect(rewardGlyph('sled')).toBe('sledBold');
  });
});

describe('the Long Night in words', () => {
  it('says any number of legs, up to every one there is', async () => {
    const { nightLegs } = await import('../src/ui/rooms');
    const half = LEGS.length / 2;
    expect(nightLegs(3)).toBe('3 mountains back to back.');
    expect(nightLegs(half + 1)).toMatch(/then the first mirrored\.$/);
    expect(nightLegs(LEGS.length)).toBe(`${LEGS.length} legs: every mountain back to back, then all of them mirrored.`);
    // (Sixteen legs once Gablefall, the Old Run and Gullhaven are all registered: the words need no second pass.)
    expect(nightLegs(16).startsWith('16 legs: every mountain back to back')).toBe(true);
  });
});
