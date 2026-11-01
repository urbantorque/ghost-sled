import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import type { PoolGhostData } from '../src/game/ghostdata';
import { ANCHOR_DEFAULT, anchorFor, FIELD_SPACING, FINISH_TICKS, PACE_MIN, PACE_SPEED, pickField, poolSpeed, type FieldInput, type FieldPick } from '../src/game/field';

// The race field is built around where you usually crash (field.ts). Names are never asserted:
// candidates within 30 m of a target tie and the run's chaos seed picks among them.

const MOUNTAINS = ['pinecrest', 'ember', 'sakura', 'frostfang'];
const POOLS: Record<string, PoolGhostData[]> = {};
for (const m of MOUNTAINS) POOLS[m] = (JSON.parse(readFileSync(join('src/data/ghosts', `${m}.json`), 'utf8')) as { ghosts: PoolGhostData[] }).ghosts;

const A = 420;
/** Role windows at anchor a; both pace picks (pace and the stretch rider) start at the pace floor. */
const windows = (a: number) =>
  ({
    opener: [0.5 * a, 0.75 * a],
    pack: [0.8 * a, 1.3 * a],
    pace: [Math.max(1.7 * a, a + 250, PACE_MIN), Infinity],
  }) as const;
const WIN = windows(A);
/** The pool ghost behind a pick. */
const ghostOf = (m: string, p: FieldPick) => POOLS[m].find((g) => g.record === p.record)!;

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

  it('falls back to 0.8 of the other keys, then 700 m', () => {
    expect(ANCHOR_DEFAULT).toBe(700);
    expect(anchorFor({ ember: [1000, 1200, 1400] }, 'pinecrest')).toBeCloseTo(960, 6);
    expect(anchorFor({}, 'pinecrest')).toBe(700);
    expect(anchorFor({ pinecrest: [] }, 'pinecrest')).toBe(700);
  });

  it('lifts to 0.7 of one long last run, so the next field is not left behind', () => {
    // One long first run: the field is built around it.
    expect(anchorFor({ pinecrest: [2100] }, 'pinecrest')).toBe(2100);
    // A short run, then a long one: 0.7 x 2,100 beats the median of 1,200.
    expect(anchorFor({ pinecrest: [300, 2100] }, 'pinecrest')).toBeCloseTo(1470, 6);
    // A long run, then a short one: the median holds.
    expect(anchorFor({ pinecrest: [2100, 300] }, 'pinecrest')).toBe(1200);
    expect(anchorFor({ pinecrest: [400, 500, 600, 450, 2000] }, 'pinecrest')).toBeCloseTo(1400, 6);
    expect(anchorFor({ pinecrest: [400, 500, 600, 2000, 450] }, 'pinecrest')).toBe(500);
  });

  it('clamps to 200 to 5,000 m and ignores junk', () => {
    expect(anchorFor({ pinecrest: [50, 60, 70] }, 'pinecrest')).toBe(200);
    expect(anchorFor({ pinecrest: [9000, 9500] }, 'pinecrest')).toBe(5000);
    expect(anchorFor({ pinecrest: [NaN, -5, 0, 640] as number[] }, 'pinecrest')).toBe(640);
    expect(anchorFor({ pinecrest: 'x' as unknown as number[] }, 'pinecrest')).toBe(700);
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
        expect(roles.filter((r) => r === 'pack').length).toBe(2);
        // Pace and the stretch rider.
        expect(roles.filter((r) => r === 'pace').length).toBe(2);
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

  it('flags the opener widened exactly when no plain pool ghost sits in its window', () => {
    const [lo, hi] = WIN.opener;
    for (const m of MOUNTAINS) {
      const opener = pickField(input(POOLS[m])).find((p) => p.role === 'opener')!;
      const plain = POOLS[m].some((g) => g.mood === Mood.None && g.event === ChaosEvent.None && g.distance >= lo && g.distance <= hi);
      expect(opener.widened === true, m).toBe(!plain);
    }
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
    // No 1,500 m runner: the pace windows widen down to the pool's longest two.
    const pace = out.filter((p) => p.role === 'pace');
    expect(pace.map((p) => p.distance)).toEqual([1300, 820]);
    expect(pace.every((p) => p.widened)).toBe(true);
  });

  it('handles an empty pool', () => {
    expect(pickField(input([]))).toEqual([]);
    const out = pickField(input([], { you: { name: 'Me', score: 5, distance: 300, record: REC('ember', 1) } }));
    expect(out.map((p) => p.kind)).toEqual(['you']);
  });

  it('rides capped finishers only as pace or stretch', () => {
    const pool: PoolGhostData[] = [
      { name: 'fin', score: 1, distance: 441, ticks: FINISH_TICKS, sled: 0, mood: 0, event: 0, record: 'f' },
      { name: 'a', score: 1, distance: 260, ticks: 900, sled: 0, mood: 0, event: 0, record: 'a' },
      { name: 'b', score: 1, distance: 357, ticks: 1200, sled: 0, mood: 0, event: 0, record: 'b' },
      { name: 'c', score: 1, distance: 525, ticks: 1700, sled: 0, mood: 0, event: 0, record: 'c' },
      { name: 'far', score: 1, distance: 7300, ticks: FINISH_TICKS, sled: 0, mood: 0, event: 0, record: 'g' },
    ];
    const out = pickField(input(pool));
    expect(out.filter((p) => p.record === 'f' || p.record === 'g').every((p) => p.role === 'pace')).toBe(true);
    // The pack slot near 441 m passes the finisher over for c.
    expect(out.find((p) => p.record === 'c')!.role).toBe('pack');
    expect(out.find((p) => p.role === 'pace')!.record).toBe('g');
  });
});

describe('pickField: the fresh-save race (anchor 700 m, no history)', () => {
  const fresh = (m: string, p: Partial<FieldInput> = {}) => pickField(input(POOLS[m], { anchor: anchorFor({}, m), ...p }));

  it('keeps the roles: an opener, two pack ghosts, a fast pace rider and a stretch rider, all spaced', () => {
    const W = windows(ANCHOR_DEFAULT);
    for (const m of MOUNTAINS) {
      for (const seed of [1, 7, 99, 4242, 31337]) {
        const out = fresh(m, { seed });
        expect(out.map((p) => p.role)).toEqual(['opener', 'pack', 'pack', 'pace', 'pace']);
        for (const p of out) {
          // A role whose window holds no usable pool ghost takes a widened one, and says so.
          const [lo, hi] = W[p.role!];
          const inside = p.distance! >= lo && p.distance! <= hi;
          expect(inside || p.widened === true, `${m} ${p.role} ${p.distance}`).toBe(true);
        }
        expect(spacedOk(out)).toBe(true);
      }
    }
  });

  it('makes pace and stretch long runners (1,500 m or more) whatever the anchor', () => {
    for (const m of MOUNTAINS) {
      for (const anchor of [200, 300, 420, 700, 900]) {
        const pace = pickField(input(POOLS[m], { anchor })).filter((p) => p.role === 'pace');
        expect(pace.length).toBe(2);
        for (const p of pace) expect(p.distance!, `${m} A=${anchor}`).toBeGreaterThanOrEqual(PACE_MIN);
      }
    }
  });

  it('gives pace a rider who averaged 23 m/s or more, the nearest such past the floor', () => {
    for (const m of MOUNTAINS) {
      const out = fresh(m);
      const pace = out.find((p) => p.role === 'pace')!;
      const g = ghostOf(m, pace);
      expect(poolSpeed(g), `${m} pace ${pace.distance}`).toBeGreaterThanOrEqual(PACE_SPEED);
      // No faster rider sat nearer the floor (outside the 30 m tie band) and went unused.
      const floor = windows(ANCHOR_DEFAULT).pace[0];
      const nearer = POOLS[m].filter((x) => x.mood === Mood.None && x.event === ChaosEvent.None && x.distance >= floor && x.distance < pace.distance! - 30 && poolSpeed(x) >= PACE_SPEED);
      expect(nearer.filter((x) => !out.some((p) => p.record === x.record)), m).toEqual([]);
    }
  });

  it('falls back to the nearest long runner when none is that fast', () => {
    const pool: PoolGhostData[] = [300, 450, 560, 640, 760, 1600, 1900, 2400].map((d, k) => ({ name: `s${k}`, score: d, distance: d, ticks: Math.round((d / 18) * 60), sled: 0, mood: 0, event: 0, record: `s${k}` }));
    const out = pickField(input(pool, { anchor: ANCHOR_DEFAULT }));
    expect(out.filter((p) => p.role === 'pace').map((p) => p.distance)).toEqual([1600, 1900]);
  });

  it('builds the second run around one long first run', () => {
    for (const m of MOUNTAINS) {
      const anchor = anchorFor({ [m]: [2100] }, m);
      const out = pickField(input(POOLS[m], { anchor }));
      expect(anchor).toBe(2100);
      expect(out.length).toBe(5);
      // Both pace riders go on past the run you just made (their windows open no lower than 1.3A).
      for (const p of out.filter((q) => q.role === 'pace')) expect(p.distance!, m).toBeGreaterThanOrEqual(1.3 * anchor);
      // The pack fights around it.
      for (const p of out.filter((q) => q.role === 'pack')) expect(Math.abs(p.distance! - anchor), m).toBeLessThan(0.5 * anchor);
      expect(spacedOk(out)).toBe(true);
    }
  });

  it("keeps Haunted Hollow's four extra ghosts: nine strong, two openers, five pack, pace and stretch", () => {
    for (const m of MOUNTAINS) {
      for (const seed of [2, 77]) {
        const out = fresh(m, { mood: Mood.Haunted, count: 9, seed });
        expect(out.length, m).toBe(9);
        expect(out.filter((p) => p.role === 'opener').length).toBe(2);
        expect(out.filter((p) => p.role === 'pack').length).toBe(5);
        const pace = out.filter((p) => p.role === 'pace');
        expect(pace.length).toBe(2);
        for (const p of pace) expect(p.distance!).toBeGreaterThanOrEqual(PACE_MIN);
        expect(spacedOk(out)).toBe(true);
        for (const p of out) {
          const g = ghostOf(m, p);
          expect(g.mood === Mood.None || g.mood === Mood.Haunted).toBe(true);
        }
      }
    }
  });

  it('never rides twin wrecks together, at any anchor, mood or seed', () => {
    for (const m of MOUNTAINS) {
      for (const anchor of [200, 420, 700, 1200, 2100, 3500]) {
        for (const mood of [Mood.None, Mood.Blizzard, Mood.Haunted, Mood.Powder]) {
          for (const seed of [1, 2, 3, 5, 8, 13]) {
            const out = pickField(input(POOLS[m], { anchor, mood, seed, count: mood === Mood.Haunted ? 9 : 5 }));
            expect(spacedOk(out), `${m} A=${anchor} mood ${mood} seed ${seed}`).toBe(true);
          }
        }
      }
    }
  });

  it('is reproducible with the run seed', () => {
    for (const m of MOUNTAINS) {
      for (const seed of [4, 40, 400]) expect(fresh(m, { seed })).toEqual(fresh(m, { seed }));
    }
  });
});
