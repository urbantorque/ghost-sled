import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import type { PoolGhostData } from '../src/game/ghostdata';
import { anchorFor, FIELD_SPACING, FINISH_TICKS, pickField, type FieldInput, type FieldPick } from '../src/game/field';

// The race field is built around where you usually crash (field.ts). Names are never asserted:
// candidates within 30 m of a target tie and the run's chaos seed picks among them.

const MOUNTAINS = ['pinecrest', 'ember', 'sakura', 'frostfang'];
const POOLS: Record<string, PoolGhostData[]> = {};
for (const m of MOUNTAINS) POOLS[m] = (JSON.parse(readFileSync(join('src/data/ghosts', `${m}.json`), 'utf8')) as { ghosts: PoolGhostData[] }).ghosts;

const A = 420;
const WIN = {
  opener: [0.5 * A, 0.75 * A],
  pack: [0.8 * A, 1.3 * A],
  pace: [Math.max(1.7 * A, A + 250), Infinity],
} as const;

function input(pool: readonly PoolGhostData[], p: Partial<FieldInput> = {}): FieldInput {
  return { pool, kind: 'pool', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: A, seed: 7, bestScore: 0, you: null, grudge: null, friend: null, ...p };
}

const poolPicks = (out: FieldPick[]) => out.filter((p) => p.kind === 'pool' || p.kind === 'daily' || (p.kind === 'grudge' && p.role));

function spacedOk(out: FieldPick[], extra: number[] = []): boolean {
  const d = poolPicks(out).map((p) => p.distance!);
  const all = [...d, ...extra];
  for (let i = 0; i < d.length; i++) for (let j = 0; j < all.length; j++) if (i !== j && Math.abs(d[i] - all[j]) < FIELD_SPACING) return false;
  return true;
}

/** A record this game version still replays (another mountain's pool ghost), for you, grudge and friend. */
const REC = (m: string, k: number) => POOLS[m][k].record;

describe('anchorFor', () => {
  it('takes the median of the last five runs on this key', () => {
    expect(anchorFor({ pinecrest: [100, 900, 300, 500, 700, 600] }, 'pinecrest')).toBe(600);
    expect(anchorFor({ pinecrest: [400, 500] }, 'pinecrest')).toBe(450);
  });

  it('falls back to 0.8 of the other keys, then 420 m', () => {
    expect(anchorFor({ ember: [1000, 1200, 1400] }, 'pinecrest')).toBeCloseTo(960, 6);
    expect(anchorFor({}, 'pinecrest')).toBe(420);
    expect(anchorFor({ pinecrest: [] }, 'pinecrest')).toBe(420);
  });

  it('clamps to 200 to 5,000 m and ignores junk', () => {
    expect(anchorFor({ pinecrest: [50, 60, 70] }, 'pinecrest')).toBe(200);
    expect(anchorFor({ pinecrest: [9000, 9500] }, 'pinecrest')).toBe(5000);
    expect(anchorFor({ pinecrest: [NaN, -5, 0, 640] as number[] }, 'pinecrest')).toBe(640);
    expect(anchorFor({ pinecrest: 'x' as unknown as number[] }, 'pinecrest')).toBe(420);
  });
});

describe('pickField on the bundled pools at A = 420', () => {
  for (const m of MOUNTAINS) {
    it(`${m}: every role in its window or flagged widened, 25 m apart`, () => {
      for (const seed of [1, 7, 99, 4242]) {
        const out = pickField(input(POOLS[m], { seed }));
        expect(out.length).toBe(5);
        const roles = out.map((p) => p.role);
        expect(roles.filter((r) => r === 'opener').length).toBe(1);
        expect(roles.filter((r) => r === 'pack').length).toBe(3);
        expect(roles.filter((r) => r === 'pace').length).toBe(1);
        for (const p of out) {
          const [lo, hi] = WIN[p.role!];
          const inside = p.distance! >= lo && p.distance! <= hi;
          expect(inside || p.widened === true, `${m} ${p.role} ${p.distance}`).toBe(true);
          if (p.role !== 'pace') expect(POOLS[m].find((g) => g.record === p.record)!.ticks).toBeLessThan(FINISH_TICKS);
        }
        expect(spacedOk(out)).toBe(true);
      }
    });
  }

  it('keeps Frostfang honest: no plain opener in [210, 315], so the opener is flagged widened', () => {
    const out = pickField(input(POOLS.frostfang));
    const opener = out.find((p) => p.role === 'opener')!;
    expect(opener.widened).toBe(true);
  });

  it('keeps every pick 25 m from where your best crashed', () => {
    for (const m of MOUNTAINS) {
      // Your best crashed right on a pack target.
      const you = { name: 'Me', score: 1, distance: 441, record: REC(m === 'pinecrest' ? 'ember' : 'pinecrest', 0) };
      const out = pickField(input(POOLS[m], { you }));
      expect(out.filter((p) => p.kind === 'you').length).toBe(1);
      expect(spacedOk(out, [441])).toBe(true);
    }
  });

  it('never rides a ghost of a different non-plain mood', () => {
    for (const m of MOUNTAINS) {
      for (let mood = 0; mood <= 6; mood++) {
        for (let event = 0; event <= 4; event++) {
          const out = pickField(input(POOLS[m], { mood: mood as Mood, event: event as ChaosEvent, count: mood === Mood.Haunted ? 9 : 5 }));
          for (const p of out) {
            const g = POOLS[m].find((x) => x.record === p.record)!;
            expect(g.mood === Mood.None || g.mood === mood, `${m} run ${mood}/${event} rode a mood ${g.mood} ghost`).toBe(true);
          }
        }
      }
    }
  });

  it('rides Haunted Hollow nine strong', () => {
    for (const m of MOUNTAINS) {
      const out = pickField(input(POOLS[m], { mood: Mood.Haunted, count: 9 }));
      expect(out.length, m).toBe(9);
      expect(out.filter((p) => p.role === 'opener').length).toBe(2);
      expect(out.filter((p) => p.role === 'pack').length).toBe(5);
      expect(out.filter((p) => p.role === 'pace').length).toBe(2);
      expect(spacedOk(out)).toBe(true);
    }
  });

  it('gives equal fields for equal input and seed', () => {
    for (const m of MOUNTAINS) {
      for (const seed of [3, 12345]) {
        const a = pickField(input(POOLS[m], { seed, mood: Mood.Blizzard }));
        const b = pickField(input(POOLS[m], { seed, mood: Mood.Blizzard }));
        expect(a).toEqual(b);
      }
    }
  });
});

describe('pickField: grudge, friend and your best', () => {
  const pool = POOLS.pinecrest;

  it('turns a picked grudge into the grudge, keeping its role, with the nemesis flag', () => {
    const plain = pickField(input(pool));
    const target = plain.find((p) => p.role === 'pack')!;
    const out = pickField(input(pool, { grudge: { name: target.name, score: target.score, record: target.record, distance: target.distance, nemesis: true } }));
    const g = out.filter((p) => p.kind === 'grudge');
    expect(g.length).toBe(1);
    expect(g[0].record).toBe(target.record);
    expect(g[0].role).toBe('pack');
    expect(g[0].nemesis).toBe(true);
    expect(out.length).toBe(5);
    expect(out.filter((p) => p.record === target.record).length).toBe(1);
  });

  it('puts an unpicked grudge in the pack slot nearest where it crashed', () => {
    const rec = REC('ember', 3);
    const out = pickField(input(pool, { grudge: { name: 'Mila', score: 100, record: rec, distance: 470 } }));
    expect(out.length).toBe(5);
    const g = out.find((p) => p.kind === 'grudge')!;
    expect(g.role).toBe('pack');
    expect(g.distance).toBe(470);
    expect(g.nemesis).toBeUndefined();
    // The pack pick nearest 470 m is the one that gave way.
    const plain = pickField(input(pool)).filter((p) => p.role === 'pack');
    const nearest = plain.reduce((b, p) => (Math.abs(p.distance! - 470) < Math.abs(b.distance! - 470) ? p : b));
    expect(out.some((p) => p.record === nearest.record)).toBe(false);
  });

  it('appends a grudge with no distance', () => {
    const out = pickField(input(pool, { grudge: { name: 'Mila', score: 100, record: REC('ember', 3) } }));
    expect(out.length).toBe(6);
    expect(out[out.length - 1].kind).toBe('grudge');
  });

  it('never lets friend and grudge share a record: the friend wins', () => {
    const rec = REC('sakura', 5);
    const out = pickField(input(pool, { grudge: { name: 'Mila', score: 10, record: rec, distance: 450 }, friend: { name: 'Mila', score: 10, record: rec } }));
    const same = out.filter((p) => p.record === rec);
    expect(same.length).toBe(1);
    expect(same[0].kind).toBe('friend');
    expect(out.some((p) => p.kind === 'grudge')).toBe(false);
  });

  it('drops stale records silently, with no splice', () => {
    const bad = 'not-a-record';
    const out = pickField(input(pool, { you: { name: 'Me', score: 5, distance: 300, record: bad }, grudge: { name: 'Mila', score: 5, record: bad, distance: 400 }, friend: { name: 'Bo', score: 5, record: bad } }));
    expect(out.length).toBe(5);
    expect(out.every((p) => p.kind === 'pool')).toBe(true);
    // Your best crashed at 300 m, but its stale record keeps no spot either.
    expect(out).toEqual(pickField(input(pool)));
  });

  it('keeps the old order: pool picks, your best, an appended grudge, then the friend', () => {
    const out = pickField(input(pool, { you: { name: 'Me', score: 5, distance: 900, record: REC('ember', 1) }, grudge: { name: 'Mila', score: 5, record: REC('ember', 2) }, friend: { name: 'Bo', score: 5, record: REC('ember', 4) } }));
    expect(out.map((p) => p.kind)).toEqual(['pool', 'pool', 'pool', 'pool', 'pool', 'you', 'grudge', 'friend']);
  });
});

describe('pickField: other pools', () => {
  it('handles a 10-ghost Daily pool', () => {
    const daily: PoolGhostData[] = [150, 240, 290, 350, 420, 470, 560, 690, 820, 1300].map((d, k) => ({ name: `d${k}`, score: d * 3, distance: d, ticks: Math.round(d * 3), sled: 0, mood: 0, event: 0, record: `r${k}` }));
    const out = pickField(input(daily, { kind: 'daily' }));
    expect(out.length).toBe(5);
    expect(out.every((p) => p.kind === 'daily')).toBe(true);
    expect(spacedOk(out)).toBe(true);
    expect(out.find((p) => p.role === 'pace')!.distance).toBe(820);
  });

  it('handles an empty pool', () => {
    expect(pickField(input([]))).toEqual([]);
    const out = pickField(input([], { you: { name: 'Me', score: 5, distance: 300, record: REC('ember', 1) } }));
    expect(out.map((p) => p.kind)).toEqual(['you']);
  });

  it('rides capped finishers only as pace', () => {
    const pool: PoolGhostData[] = [
      { name: 'fin', score: 1, distance: 441, ticks: FINISH_TICKS, sled: 0, mood: 0, event: 0, record: 'f' },
      { name: 'a', score: 1, distance: 260, ticks: 900, sled: 0, mood: 0, event: 0, record: 'a' },
      { name: 'b', score: 1, distance: 357, ticks: 1200, sled: 0, mood: 0, event: 0, record: 'b' },
      { name: 'c', score: 1, distance: 525, ticks: 1700, sled: 0, mood: 0, event: 0, record: 'c' },
      { name: 'far', score: 1, distance: 7300, ticks: FINISH_TICKS, sled: 0, mood: 0, event: 0, record: 'g' },
    ];
    const out = pickField(input(pool));
    expect(out.find((p) => p.record === 'f')).toBeUndefined();
    expect(out.find((p) => p.role === 'pace')!.record).toBe('g');
  });
});
