import { describe, expect, it } from 'vitest';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { recordToString } from '../src/sim/replay';
import type { PoolGhostData } from '../src/game/ghostdata';
import { ANCHOR_DEFAULT, ANCHOR_MAX, ANCHOR_MIN, FIELD_CARROT, FIELD_FAST_MIN, FIELD_SLOW_MAX, FIELD_SLOW_MIN, FIELD_SPACING, FIELD_SPACING_S, anchorFor, fieldCandidates, fieldPace, pickField, poolTime, recentFor, type FieldInput, type FieldPick } from '../src/game/field';
import { FINISH_Z } from '../src/game/standing';

// The race field is built around when you would finish (field.ts). Names are never asserted:
// candidates within a moment of a target tie and the run's chaos seed picks among them. Every pool here
// is synthetic: the bundled pools are regenerated in a later step, and a field is logic, not data.

/** A finisher: the record runs on past the line, so `ticks` says nothing about its time. */
function fin(time: number, o: Partial<PoolGhostData> = {}): PoolGhostData {
  const name = `f${time}`;
  return { name, score: 1000, distance: FINISH_Z + 120, ticks: 18000, finishTick: Math.round(time * 60), sled: 0, mood: 0, event: 0, record: `rec-${name}`, ...o };
}

/** A rider who crashed at `distance` after `seconds`. */
function wreck(distance: number, seconds: number, o: Partial<PoolGhostData> = {}): PoolGhostData {
  const name = `w${distance}`;
  return { name, score: 500, distance, ticks: seconds * 60, sled: 0, mood: 0, event: 0, record: `rec-${name}`, ...o };
}

/** A pool from experts to beginners, finishers and riders who fell, 2 s apart on the clock. */
const POOL: PoolGhostData[] = (() => {
  const out: PoolGhostData[] = [];
  for (let t = 104; t <= 320; t += 2) out.push(t % 6 === 0 ? wreck(1500 + t, ((1500 + t) * t) / FINISH_Z) : fin(t));
  return out;
})();

const A = 200;
/** Role windows at anchor a. */
const windows = (a: number) => ({ opener: [1.05 * a, 1.22 * a], pack: [0.93 * a, 1.07 * a], pace: [0.75 * a, 0.97 * a] }) as const;

function input(pool: readonly PoolGhostData[], p: Partial<FieldInput> = {}): FieldInput {
  return { pool, kind: 'pool', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: A, seed: 7, bestScore: 0, you: null, grudge: null, friend: null, ...p };
}

const poolPicks = (out: FieldPick[]) => out.filter((p) => p.kind === 'pool' || p.kind === 'daily' || (p.kind === 'grudge' && p.role));

/** A record this game version still replays, for you, the grudge and a friend. */
function rec(distance: number, ticks: number, name = 'Rider'): string {
  return recordToString({ seed: 1, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 1 }, sled: 0, inputs: new Uint8Array([4, 4]), ticks, score: 100, distance, name });
}

function spacedOk(out: FieldPick[], extra: number[] = []): boolean {
  const t = poolPicks(out).map((p) => p.time!);
  const all = [...t, ...extra];
  for (let i = 0; i < t.length; i++) for (let j = 0; j < all.length; j++) if (i !== j && Math.abs(t[i] - all[j]) < FIELD_SPACING_S) return false;
  return true;
}

describe('predicted time', () => {
  it('reads a finish tick when the pool has one, however long the record runs on', () => {
    expect(poolTime(fin(171.5))).toBeCloseTo(171.5, 6);
  });

  it('carries an unfinished run to the line at its own pace', () => {
    expect(poolTime(wreck(1500, 75))).toBeCloseTo((75 * FINISH_Z) / 1500, 6);
  });
});

describe('anchorFor', () => {
  it('has nothing to go on with no runs: pickField then reads a mid-pack time', () => {
    expect(anchorFor({}, 'pinecrest')).toBe(0);
    expect(anchorFor({ pinecrest: [] }, 'pinecrest')).toBe(0);
  });

  it('is the median of the last five, and one quick run lifts it at once', () => {
    expect(anchorFor({ pinecrest: [200, 210, 220] }, 'pinecrest')).toBe(210);
    // Only the last five count.
    expect(anchorFor({ pinecrest: [900, 300, 200, 210, 220, 230] }, 'pinecrest')).toBe(220);
    expect(anchorFor({ pinecrest: [240, 250, 260, 170] }, 'pinecrest')).toBeCloseTo(187, 6);
    // A slow run, then a quick one: 1.1 times it. A quick run, then a slow one: the median holds.
    expect(anchorFor({ pinecrest: [200, 300] }, 'pinecrest')).toBe(250);
  });

  it('reads a little slower than your other mountains on one you have not ridden', () => {
    expect(anchorFor({ ember: [200], sakura: [220] }, 'pinecrest')).toBeCloseTo(1.1 * 210, 6);
  });

  it('clamps, and ignores junk', () => {
    expect(anchorFor({ pinecrest: [60, 70, 80] }, 'pinecrest')).toBe(ANCHOR_MIN);
    expect(anchorFor({ pinecrest: [900, 950] }, 'pinecrest')).toBe(ANCHOR_MAX);
    expect(anchorFor({ pinecrest: [NaN, -5, 0, 240] as number[] }, 'pinecrest')).toBe(240);
    expect(anchorFor({ pinecrest: 'x' as unknown as number[] }, 'pinecrest')).toBe(0);
  });
});

describe('the field at every skill', () => {
  for (const a of [150, 200, 260]) {
    it(`A = ${a}: an opener a bit slower, a pack around you, pace a bit faster, a stretch rider beyond`, () => {
      for (const seed of [1, 7, 99, 4242]) {
        const out = pickField(input(POOL, { anchor: a, seed }));
        expect(out.length).toBe(5);
        expect(out.map((p) => p.role)).toEqual(['opener', 'pack', 'pack', 'pace', 'pace']);
        const W = windows(a);
        for (const p of out) {
          const [lo, hi] = W[p.role!];
          expect(p.widened, `${a} ${p.role} ${p.time}`).toBeUndefined();
          expect(p.time!).toBeGreaterThanOrEqual(lo);
          expect(p.time!).toBeLessThanOrEqual(hi);
        }
        const opener = out.find((p) => p.role === 'opener')!;
        const pace = out.filter((p) => p.role === 'pace').map((p) => p.time!);
        expect(opener.time!).toBeGreaterThan(a);
        for (const t of pace) expect(t).toBeLessThan(a);
        expect(spacedOk(out)).toBe(true);
      }
    });
  }

  it('lets the riders of a very first run read you, on a bundled mountain only', () => {
    const first = pickField(input(POOL, { anchor: 0 }));
    expect(first.length).toBeGreaterThan(0);
    for (const p of first) expect(p.reads).toBe(true);
    // A second run rides the riders as they are, and a Daily or a Cup shares its field with everyone.
    for (const p of pickField(input(POOL, { anchor: 150 }))) expect(p.reads).toBeUndefined();
    for (const p of pickField(input(POOL, { anchor: 0, kind: 'daily' }))) expect(p.reads).toBeUndefined();
  });

  it('never lets a promised rider read you', () => {
    const friend = { name: 'Fr', score: 9, record: rec(4500, 9000) };
    const out = pickField(input(POOL, { anchor: 0, friend }));
    const f = out.find((p) => p.kind === 'friend');
    expect(f).toBeDefined();
    expect(f?.reads).toBeUndefined();
  });

  it('leaves the beginners out of a first run whose riders read you', () => {
    const out = pickField(input(POOL, { anchor: 0 }));
    expect(Math.max(...out.map((p) => p.time!))).toBeLessThan(ANCHOR_DEFAULT * 1.25);
  });

  it('rides where most riders land with no runs, with beginners far behind on a shared field', () => {
    const out = pickField(input(POOL, { anchor: 0, kind: 'daily' }));
    const pack = out.filter((p) => p.role === 'pack').map((p) => p.time!);
    expect(pack.length).toBe(2);
    for (const t of pack) expect(Math.abs(t - ANCHOR_DEFAULT) / ANCHOR_DEFAULT).toBeLessThan(0.08);
    // Nobody knows yet how a first run will go, so someone is near whoever it turns out to be.
    const slowest = Math.max(...out.map((p) => p.time!));
    expect(slowest).toBeGreaterThan(ANCHOR_DEFAULT * 1.25);
  });

  it('takes the nearest available when the pool holds nothing near you, and says so', () => {
    const out = pickField(input([fin(150), fin(155), fin(160), fin(170), fin(175)], { anchor: 300 }));
    expect(out.length).toBe(5);
    expect(out.every((p) => p.widened === true)).toBe(true);
  });

  it('rides finishers together: they all end at one line, so only time spaces them', () => {
    const pool = [170, 180, 190, 200, 210, 220, 230].map((t) => fin(t));
    const out = pickField(input(pool));
    expect(out.length).toBe(5);
    expect(new Set(out.map((p) => p.time)).size).toBe(5);
    expect(out.every((p) => p.distance! >= FINISH_Z)).toBe(true);
  });

  it('never rides twin wrecks together, at any anchor or seed', () => {
    const pool = [wreck(604.4, 26), wreck(604.4, 30), wreck(610, 34), wreck(900, 41), wreck(1500, 75), wreck(1510, 80), fin(190), fin(210), fin(230)];
    for (const anchor of [150, 200, 300, 400]) {
      for (const seed of [1, 2, 3, 5, 8, 13]) {
        const crashes = pickField(input(pool, { anchor, seed }))
          .map((p) => p.distance!)
          .filter((d) => d < FINISH_Z);
        for (let i = 0; i < crashes.length; i++) for (let j = i + 1; j < crashes.length; j++) expect(Math.abs(crashes[i] - crashes[j]), `A=${anchor} seed ${seed}`).toBeGreaterThanOrEqual(FIELD_SPACING);
      }
    }
  });

  it('keeps every pick clear of your best', () => {
    const you = { name: 'Me', score: 1, distance: FINISH_Z + 100, record: rec(FINISH_Z + 100, 203 * 60) };
    const out = pickField(input(POOL, { you }));
    expect(out.filter((p) => p.kind === 'you').length).toBe(1);
    expect(spacedOk(out, [203])).toBe(true);
  });

  it('never rides a ghost of a different non-plain mood', () => {
    const pool = POOL.map((g, k) => ({ ...g, mood: k % 3 === 0 ? Mood.Blizzard : k % 3 === 1 ? Mood.Haunted : Mood.None }));
    for (let mood = 0; mood <= 6; mood++) {
      for (let event = 0; event <= 4; event++) {
        for (const p of pickField(input(pool, { mood: mood as Mood, event: event as ChaosEvent, count: mood === Mood.Haunted ? 9 : 5 }))) {
          const g = pool.find((x) => x.record === p.record)!;
          expect(g.mood === Mood.None || g.mood === mood, `run ${mood}/${event} rode a mood ${g.mood} ghost`).toBe(true);
        }
      }
    }
  });

  it('climbs the candidate ladder only as far as it needs', () => {
    const plain = POOL.slice(0, 8);
    const storm = POOL.slice(8, 16).map((g) => ({ ...g, event: ChaosEvent.GiftStorm }));
    expect(fieldCandidates([...plain, ...storm], Mood.None, ChaosEvent.None, 8).length).toBe(8);
    expect(fieldCandidates([...plain, ...storm], Mood.None, ChaosEvent.None, 9).length).toBe(16);
  });

  it("rides Haunted Hollow's nine: two openers, five pack, pace and stretch", () => {
    const out = pickField(input(POOL, { mood: Mood.Haunted, count: 9 }));
    expect(out.length).toBe(9);
    expect(out.filter((p) => p.role === 'opener').length).toBe(2);
    expect(out.filter((p) => p.role === 'pack').length).toBe(5);
    expect(out.filter((p) => p.role === 'pace').length).toBe(2);
    expect(spacedOk(out)).toBe(true);
  });

  it('is reproducible with the run seed', () => {
    for (const seed of [3, 40, 12345]) expect(pickField(input(POOL, { seed }))).toEqual(pickField(input(POOL, { seed })));
  });
});

describe('pickField: grudge, friend and your best', () => {
  it('turns a picked grudge into the grudge, keeping its role, with the nemesis flag', () => {
    const target = pickField(input(POOL)).find((p) => p.role === 'pack')!;
    // (Its record is the pool's; pickField keeps a grudge only on a record that decodes.)
    const record = rec(FINISH_Z + 120, Math.round(target.time! * 60));
    const pool = POOL.map((g) => (g.record === target.record ? { ...g, record } : g));
    const out = pickField(input(pool, { grudge: { name: target.name, score: target.score, record, distance: target.distance, nemesis: true } }));
    const g = out.filter((p) => p.kind === 'grudge');
    expect(g.length).toBe(1);
    expect(g[0].record).toBe(record);
    expect(g[0].role).toBe('pack');
    expect(g[0].nemesis).toBe(true);
    expect(out.length).toBe(5);
  });

  it('puts an unpicked grudge in the pack slot nearest its own pace', () => {
    const record = rec(FINISH_Z + 120, 203 * 60);
    const out = pickField(input(POOL, { grudge: { name: 'Mila', score: 100, record, distance: FINISH_Z + 120 } }));
    expect(out.length).toBe(5);
    const g = out.find((p) => p.kind === 'grudge')!;
    expect(g.role).toBe('pack');
    expect(g.time).toBeCloseTo(203, 6);
    expect(g.nemesis).toBeUndefined();
    const plain = pickField(input(POOL)).filter((p) => p.role === 'pack');
    const nearest = plain.reduce((b, p) => (Math.abs(p.time! - 203) < Math.abs(b.time! - 203) ? p : b));
    expect(out.some((p) => p.record === nearest.record)).toBe(false);
  });

  it('appends a grudge with no distance', () => {
    const out = pickField(input(POOL, { grudge: { name: 'Mila', score: 100, record: rec(900, 2400) } }));
    expect(out.length).toBe(6);
    expect(out[out.length - 1].kind).toBe('grudge');
  });

  it('never lets friend and grudge share a record: the friend wins', () => {
    const record = rec(900, 2400, 'Mila');
    const out = pickField(input(POOL, { grudge: { name: 'Mila', score: 10, record, distance: 900 }, friend: { name: 'Mila', score: 10, record } }));
    const same = out.filter((p) => p.record === record);
    expect(same.length).toBe(1);
    expect(same[0].kind).toBe('friend');
    expect(out.some((p) => p.kind === 'grudge')).toBe(false);
  });

  it('drops stale records silently, with no splice', () => {
    const bad = 'not-a-record';
    const out = pickField(input(POOL, { you: { name: 'Me', score: 5, distance: 300, record: bad }, grudge: { name: 'Mila', score: 5, record: bad, distance: 400 }, friend: { name: 'Bo', score: 5, record: bad } }));
    expect(out.length).toBe(5);
    expect(out.every((p) => p.kind === 'pool')).toBe(true);
    expect(out).toEqual(pickField(input(POOL)));
  });

  it('keeps the order: pool picks, your best, an appended grudge, then the friend', () => {
    const out = pickField(input(POOL, { you: { name: 'Me', score: 5, distance: 900, record: rec(900, 2400) }, grudge: { name: 'Mila', score: 5, record: rec(910, 2300) }, friend: { name: 'Bo', score: 5, record: rec(920, 2200) } }));
    expect(out.map((p) => p.kind)).toEqual(['pool', 'pool', 'pool', 'pool', 'pool', 'you', 'grudge', 'friend']);
  });
});

describe('pickField: other pools', () => {
  it('handles a 10-ghost Daily pool', () => {
    const daily = [160, 170, 180, 190, 200, 210, 220, 230, 240, 250].map((t, k) => fin(t, { name: `d${k}`, record: `r${k}` }));
    const out = pickField(input(daily, { kind: 'daily' }));
    expect(out.length).toBe(5);
    expect(out.every((p) => p.kind === 'daily')).toBe(true);
    expect(spacedOk(out)).toBe(true);
  });

  it('handles an empty pool', () => {
    expect(pickField(input([]))).toEqual([]);
    const out = pickField(input([], { anchor: 0, you: { name: 'Me', score: 5, distance: 300, record: rec(300, 900) } }));
    expect(out.map((p) => p.kind)).toEqual(['you']);
    expect(ANCHOR_DEFAULT).toBeGreaterThan(ANCHOR_MIN);
  });
});

// Round 7: once you have ridden a mountain the field is laid across where you finish.
describe('a field laid across your own runs', () => {
  /** A dense pool, a finisher every half second from 100 s to 200 s. */
  const DENSE: PoolGhostData[] = (() => {
    const out: PoolGhostData[] = [];
    for (let t = 100; t <= 200; t += 0.5) out.push(fin(t));
    return out;
  })();
  const laid = (recent: number[], p: Partial<FieldInput> = {}): FieldPick[] => pickField(input(DENSE, { anchor: anchorFor({ m: recent }, 'm'), recent, ...p }));
  const times = (out: FieldPick[]): number[] => poolPicks(out).map((p) => p.time!).sort((x, y) => x - y);
  /** How far a finish at t is from the nearest rider of the field, seconds. */
  const nearest = (ts: number[], t: number): number => Math.min(...ts.map((x) => Math.abs(x - t)));

  it('reads your last runs for a key, and the pace follows the last three when they are quicker', () => {
    expect(recentFor({ m: [9, 8, 7, 130, 125, 120, 115, 110] }, 'm')).toEqual([130, 125, 120, 115, 110]);
    expect(recentFor({}, 'm')).toEqual([]);
    // Improving run by run: the median of five says 120, the last three say 115.
    expect(anchorFor({ m: [130, 125, 120, 115, 110] }, 'm')).toBe(120);
    expect(fieldPace(120, [130, 125, 120, 115, 110])).toBe(115);
    // Getting slower: never slower than the anchor.
    expect(fieldPace(118, [110, 115, 120, 125, 130])).toBe(118);
    expect(fieldPace(118, [])).toBe(118);
  });

  it('a steady player gets a tight pack: everyone within a few seconds, nobody a minute up the road', () => {
    const recent = [119.2, 113.6, 112.5, 116.8, 114.1];
    const ts = times(laid(recent));
    expect(ts.length).toBe(5);
    // From the carrot (a little quicker than the quickest of them) to 1.05 of the pace.
    expect(ts[0]).toBeGreaterThanOrEqual(FIELD_CARROT[2] * 112.5 - 1.5);
    expect(ts[0]).toBeLessThan(112.5);
    expect(ts[4]).toBeLessThanOrEqual(FIELD_SLOW_MIN * 114.1 + 1.5);
    // Any finish this player has had lately lands within 2 s of a rider.
    for (const t of recent) expect(nearest(ts, t), String(t)).toBeLessThanOrEqual(2);
  });

  it('an erratic player gets a long string that still reaches the slow day and the quick one', () => {
    // The expert pilot's five runs on Pinecrest (the baseline telemetry).
    const recent = [126.5, 127.4, 115.8, 139.1, 123];
    const out = laid(recent);
    const ts = times(out);
    // The fixed roles left the 139 s run 9 s behind the slowest rider and the 115.8 s run alone in front.
    const fixed = times(pickField(input(DENSE, { anchor: anchorFor({ m: recent }, 'm') })));
    expect(nearest(fixed, 139.1)).toBeGreaterThan(3);
    for (const t of recent) expect(nearest(ts, t), String(t)).toBeLessThanOrEqual(3.6);
    expect(ts[0]).toBeLessThan(115.8);
    expect(ts[4]).toBeGreaterThanOrEqual(135);
    expect(spacedOk(out)).toBe(true);
  });

  it('names the roles off the targets, and always keeps a pack slot for a grudge', () => {
    const out = laid([126.5, 127.4, 115.8, 139.1, 123]);
    const a = fieldPace(anchorFor({ m: [126.5, 127.4, 115.8, 139.1, 123] }, 'm'), [126.5, 127.4, 115.8, 139.1, 123]);
    for (const p of poolPicks(out)) {
      if (p.role === 'opener') expect(p.time!).toBeGreaterThan(a);
      if (p.role === 'pace') expect(p.time!).toBeLessThan(a);
    }
    expect(out.some((p) => p.role === 'opener')).toBe(true);
    expect(out.some((p) => p.role === 'pace')).toBe(true);
    for (const recent of [[150], [120, 121, 119], [200, 140, 139], [104, 180, 104, 180, 104]]) expect(laid(recent).some((p) => p.role === 'pack'), String(recent)).toBe(true);
    // Slowest first, as the fixed roles are filled.
    const order = poolPicks(out).map((p) => p.time!);
    expect(order).toEqual([...order].sort((x, y) => y - x));
  });

  it('hangs the carrot further out for a new player, who is still getting quicker fast', () => {
    const one = times(laid([150]));
    const many = times(laid([150, 150, 150, 150]));
    expect(Math.abs(one[0] - FIELD_CARROT[0] * 150)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(many[0] - FIELD_CARROT[2] * 150)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(one[4] - FIELD_SLOW_MIN * 150)).toBeLessThanOrEqual(1.5);
  });

  it('is not stretched by one disaster, nor by a short wreck that predicted a record', () => {
    // A run that took twice as long: the slow end stops at 1.12 of the pace.
    const slow = times(laid([120, 121, 119, 122, 240]));
    const pace = fieldPace(anchorFor({ m: [120, 121, 119, 122, 240] }, 'm'), [120, 121, 119, 122, 240]);
    expect(slow[4]).toBeLessThanOrEqual(FIELD_SLOW_MAX * pace + 1);
    // A wreck at 300 m that predicted 80 s: the fast end stops at FIELD_FAST_MIN of the pace.
    const fast = times(laid([150, 152, 80, 151, 149]));
    const p2 = fieldPace(anchorFor({ m: [150, 152, 80, 151, 149] }, 'm'), [150, 152, 80, 151, 149]);
    expect(fast[0]).toBeGreaterThanOrEqual(FIELD_FAST_MIN * p2 - 1);
  });

  it('still keeps clear of your best, rides every extra ghost, and is the same for the same seed', () => {
    const recent = [126.5, 127.4, 115.8, 139.1, 123];
    const mine = rec(FINISH_Z + 50, Math.round(115.8 * 60) + 300);
    const out = laid(recent, { you: { name: 'You', score: 9, distance: FINISH_Z + 50, record: mine } });
    const you = out.find((p) => p.kind === 'you')!;
    expect(you).toBeDefined();
    for (const p of poolPicks(out)) expect(Math.abs(p.time! - you.time!)).toBeGreaterThanOrEqual(FIELD_SPACING_S);
    expect(poolPicks(laid(recent, { count: 9 })).length).toBe(9);
    expect(laid(recent, { seed: 31 })).toEqual(laid(recent, { seed: 31 }));
  });

  it('a thin pool rides the nearest it has and says so; no runs here means the fixed roles', () => {
    const thin = [fin(108), fin(110), fin(112), fin(125), fin(150)];
    const out = pickField(input(thin, { anchor: 111, recent: [111, 110, 112] }));
    expect(poolPicks(out).length).toBe(5);
    expect(out.some((p) => p.widened)).toBe(true);
    // A mountain you have not ridden (the anchor came from your others): the roles around the anchor.
    expect(pickField(input(POOL, { anchor: 200, recent: [] })).map((p) => p.role)).toEqual(['opener', 'pack', 'pack', 'pace', 'pace']);
    // A very first run still reads you.
    expect(pickField(input(POOL, { anchor: 0, recent: [] })).every((p) => p.reads)).toBe(true);
  });
});
