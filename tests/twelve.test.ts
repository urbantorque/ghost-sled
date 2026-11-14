import { describe, expect, it } from 'vitest';
import { ROSTER, riderByKey } from '../src/bot/roster';
import { type FieldInput, pickField } from '../src/game/field';
import type { PoolGhostData } from '../src/game/ghostdata';
import { nextUnlock, unlockCrossed, unlockTease } from '../src/game/progress';
import { type SaveData, defaultSave, merge } from '../src/game/save';

/** A stored blob read back the way SaveStore reads one. */
const parseSave = (json: string, name: string): SaveData => merge(defaultSave(name), JSON.parse(json) as Partial<SaveData>, '2026-11-13');
import { FINISH_Z, type Standing } from '../src/game/standing';
import {
  KING,
  TWELVE,
  TWELVE_GATE,
  type TwelveSave,
  duelMountain,
  duelOn,
  duelRecord,
  duelStartLine,
  duelWon,
  finalField,
  gateCount,
  gateLine,
  homeTime,
  ladderOrder,
  lanternfallOpen,
  lockText,
  mountainOpen,
  nextDuel,
  outcomeLine,
  poolStanding,
  readTwelve,
  settleTwelve,
  tallyLine,
  waitingRider,
} from '../src/game/twelve';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { MOUNTAINS } from '../src/sim/mountains';
import { recordToString } from '../src/sim/replay';

// The Twelve: beat each signature rider on their home ground, one duel at a time, gentlest first. The
// eleven others open Lanternfall; the King waits there, and then one race against all twelve.

const all = (): boolean => true;
const only = (...open: number[]) => (m: number): boolean => open.includes(m);
const fin = (time: number): Standing => ({ time, distance: FINISH_Z });
const wreck = (distance: number): Standing => ({ time: null, distance });
const beat = (...keys: string[]): TwelveSave => ({ beaten: keys });
const everyoneBut = (...keys: string[]): TwelveSave => beat(...TWELVE.filter((r) => !keys.includes(r.key)).map((r) => r.key));

function rec(name: string, seconds: number): string {
  return recordToString({ seed: 1, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 1 }, sled: 0, inputs: new Uint8Array([4, 4]), ticks: seconds * 60, score: 100, distance: FINISH_Z, name });
}

function ghost(name: string, seconds: number, o: Partial<PoolGhostData> = {}): PoolGhostData {
  return { name, score: 1000, distance: FINISH_Z + 100, ticks: seconds * 60 + 600, finishTick: seconds * 60, sled: 0, mood: 0, event: 0, record: rec(name, seconds), ...o };
}

/** A pool like a bundled one: a crowd every 3 s from 100 s, and the twelve among it. */
const POOL: PoolGhostData[] = [...Array.from({ length: 40 }, (_, i) => ghost(`crowd${i}`, 100 + i * 3)), ...ROSTER.map((r, i) => ghost(r.name, 110 + i * 4))];

describe('the ladder', () => {
  it('is all twelve signature riders once each and ends with The Hollow King', () => {
    expect(TWELVE).toHaveLength(12);
    expect(new Set(TWELVE.map((r) => r.key)).size).toBe(12);
    expect(KING.key).toBe('crown');
    expect(TWELVE[TWELVE.length - 1]).toBe(KING);
  });

  it('asks for a quicker time at every rung: the eleven stand by their home records, slowest first', () => {
    // Read from the bundled pools, so this holds through any re-ride that leaves each of them a finish at home.
    const times = TWELVE.map((r) => homeTime(r));
    for (const t of times) expect(t).not.toBeNull();
    for (let i = 1; i < TWELVE.length - 1; i++) expect(times[i]!, `${TWELVE[i].name} after ${TWELVE[i - 1].name}`).toBeLessThanOrEqual(times[i - 1]!);
  });

  it('orders any roster by the times it is given, the rider of the finale last whatever their time', () => {
    const t: Record<string, number> = { rosa: 100, bram: 140, juno: 120, crown: 300, mila: 120 };
    const some = ['mila', 'crown', 'rosa', 'juno', 'bram'].map((k) => riderByKey(k)!);
    // (Juno and Mila tie: the roster's skill breaks it, the gentler first.)
    expect(ladderOrder(some, (r) => t[r.key]).map((r) => r.key)).toEqual(['bram', 'juno', 'mila', 'rosa', 'crown']);
    // The King needs no time to be last.
    expect(ladderOrder(some, (r) => (r.key === 'crown' ? null : t[r.key])).map((r) => r.key)).toEqual(['bram', 'juno', 'mila', 'rosa', 'crown']);
  });

  it('falls back on the skill of the roster when one of the eleven has no finished record at home', () => {
    const order = ladderOrder(ROSTER, (r) => (r.key === 'pip' ? null : 120));
    for (let i = 1; i < order.length; i++) expect(order[i].skill).toBeGreaterThanOrEqual(order[i - 1].skill);
    expect(order[order.length - 1].key).toBe('crown');
    expect(order[0].key).toBe('rosa');
  });

  it('a save made on another order keeps everyone it beat, whatever rung they stand on now', () => {
    // Progress is kept by rider. The old ladder (by skill) began Rosa, Bram, Pip: three beaten there are three
    // beaten here, and the next duel is the first rung still standing.
    const old = readTwelve({ beaten: ['rosa', 'bram', 'pip'] });
    expect(old.beaten).toEqual(['rosa', 'bram', 'pip']);
    expect(gateCount(old)).toBe(3);
    const next = nextDuel(old, all);
    expect(next).toEqual({ kind: 'duel', rider: TWELVE.find((r) => !old.beaten.includes(r.key)) });
  });

  it("the King's home is the finale, and nobody else's is", () => {
    expect(MOUNTAINS[KING.home].finale).toBe(true);
    for (const r of TWELVE) if (r !== KING) expect(MOUNTAINS[r.home].finale ?? false).toBe(false);
    expect(TWELVE_GATE).toBe(11);
  });

  it('every one of them has a real finished record on their home ground in the bundled pools', async () => {
    for (const r of TWELVE) {
      const id = MOUNTAINS[r.home].id;
      const pool = ((await import(`../src/data/ghosts/${id}.json`)) as { default: { ghosts: PoolGhostData[] } }).default.ghosts;
      const g = duelRecord(pool, r);
      expect(g, `${r.name} on ${id}`).not.toBeNull();
      expect(poolStanding(g!).time, `${r.name} finished`).not.toBeNull();
    }
  });
});

describe('the next duel', () => {
  it('is the gentlest unbeaten rider whose home is open', () => {
    // A new player has Pinecrest alone: Rosa (Sakura) and Pip (Frostfang) wait, Bram rides.
    expect(nextDuel(undefined, only(0))).toEqual({ kind: 'duel', rider: riderByKey('bram') });
    expect(nextDuel(beat('bram'), only(0))).toEqual({ kind: 'duel', rider: riderByKey('juno') });
    // Frostfang opens: the first of its riders on the ladder stands before Juno, so they are next.
    const reach = TWELVE.filter((r) => r.key !== 'bram' && (r.home === 0 || r.home === 1));
    expect(nextDuel(beat('bram'), only(0, 1))).toEqual({ kind: 'duel', rider: reach[0] });
    // Everything open: the ladder's own order.
    expect(nextDuel(undefined, all)).toEqual({ kind: 'duel', rider: TWELVE[0] });
  });

  it('walks the whole ladder in order with every mountain open', () => {
    const t: TwelveSave = { beaten: [] };
    const open = (m: number): boolean => !MOUNTAINS[m].finale || lanternfallOpen(t);
    const order: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = nextDuel(t, open);
      expect(d?.kind).toBe('duel');
      if (d?.kind !== 'duel') break;
      order.push(d.rider.key);
      t.beaten.push(d.rider.key);
    }
    expect(order).toEqual(TWELVE.map((r) => r.key));
    expect(nextDuel(t, open)).toEqual({ kind: 'final' });
    t.crowned = true;
    expect(nextDuel(t, open)).toBeNull();
  });

  it('with every reachable rider beaten, the one whose home is locked waits and is named', () => {
    const t = beat('bram', 'juno', 'wren');
    expect(nextDuel(t, only(0))).toBeNull();
    expect(waitingRider(t, only(0))?.key).toBe('rosa');
    expect(waitingRider(undefined, only(0))).toBeNull();
  });

  it('a run is a duel only on the next rider’s own home ground', () => {
    expect(duelOn(undefined, 0, only(0))).toEqual({ kind: 'duel', rider: riderByKey('bram') });
    expect(duelOn(undefined, 1, only(0, 1))).toBeNull();
    expect(duelOn(beat('bram'), 1, only(0, 1))).toEqual({ kind: 'duel', rider: riderByKey('pip') });
    expect(duelMountain({ kind: 'final' })).toBe(KING.home);
  });

  it('the King cannot be duelled until the eleven others have fallen', () => {
    const ten = everyoneBut('crown', 'mila');
    const open = (t: TwelveSave) => (m: number): boolean => !MOUNTAINS[m].finale || lanternfallOpen(t);
    expect(lanternfallOpen(ten)).toBe(false);
    expect(nextDuel(ten, open(ten))).toEqual({ kind: 'duel', rider: riderByKey('mila') });
    const eleven = everyoneBut('crown');
    expect(gateCount(eleven)).toBe(11);
    expect(lanternfallOpen(eleven)).toBe(true);
    expect(nextDuel(eleven, open(eleven))).toEqual({ kind: 'duel', rider: KING });
  });
});

describe('Lanternfall opens by The Twelve, not by ghosts passed', () => {
  const lantern = MOUNTAINS.find((m) => m.finale)!;

  it('stays locked however many ghosts are passed, and opens on the eleventh rider', () => {
    expect(mountainOpen({ ghostsPassed: 9999 }, lantern)).toBe(false);
    expect(mountainOpen({ ghostsPassed: 0, twelve: everyoneBut('crown') }, lantern)).toBe(true);
    expect(lockText({ ghostsPassed: 9999, twelve: beat('bram', 'rosa') }, lantern)).toBe('Beat 9 more of The Twelve to unlock');
    expect(lockText({ ghostsPassed: 0, twelve: everyoneBut('crown') }, lantern)).toBe('');
  });

  it('the other mountains still open by ghosts passed', () => {
    expect(mountainOpen({ ghostsPassed: 3 }, MOUNTAINS[1])).toBe(false);
    expect(mountainOpen({ ghostsPassed: 4 }, MOUNTAINS[1])).toBe(true);
    expect(lockText({ ghostsPassed: 3 }, MOUNTAINS[1])).toBe('Pass 1 more ghost to unlock');
    expect(lockText({ ghostsPassed: 1 }, MOUNTAINS[1])).toBe('Pass 3 more ghosts to unlock');
  });

  it('the ghost ladder never names the finale: no "next unlock", no mid-run pop, no tease', () => {
    const d = { ...defaultSave('Rider'), runs: 9, ghostsPassed: 30 };
    d.ownedSleds = [0, 1, 2, 3, 4, 5];
    expect(nextUnlock(d)?.kind).not.toBe('mountain');
    expect(unlockCrossed(40, 60)).toBeNull();
    expect(unlockTease(47)).toBeNull();
    // The four it does name are untouched.
    expect(unlockCrossed(3, 4)?.id).toBe('frostfang');
    expect(unlockTease(23)).toBe('1 more ghost opens Sakura Ridge');
  });
});

describe('a duel', () => {
  it('is won by reaching the line ahead of the rider’s time, never by a wreck', () => {
    expect(duelWon(fin(120), fin(121))).toBe(true);
    expect(duelWon(fin(121), fin(120))).toBe(false);
    expect(duelWon(wreck(4000), fin(200))).toBe(false);
    // A rider who wrecked is behind anyone who finished.
    expect(duelWon(fin(300), wreck(4400))).toBe(true);
    expect(duelWon(wreck(4400), wreck(1000))).toBe(false);
  });

  it('puts the rider’s real record in the field as the rival, whatever pace the player rides', () => {
    for (const r of TWELVE) {
      const g = duelRecord(POOL, r)!;
      for (const anchor of [0, 105, 150, 240, 400]) {
        const i: FieldInput = { pool: POOL, kind: 'pool', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor, seed: 7 + anchor, bestScore: 0, you: null, grudge: null, friend: null, promised: { name: g.name, score: g.score, record: g.record } };
        const out = pickField(i);
        const mine = out.filter((p) => p.record === g.record);
        expect(mine, `${r.name} at ${anchor}`).toHaveLength(1);
        expect(mine[0].name).toBe(r.name);
        expect(mine[0].rival).toBe(true);
        expect(out.filter((p) => p.rival)).toHaveLength(1);
      }
    }
  });

  it('still rides with a grudge and your best in the field, and stays the rival', () => {
    const g = duelRecord(POOL, riderByKey('bram')!)!;
    const out = pickField({
      pool: POOL,
      kind: 'pool',
      mood: Mood.Comet,
      event: ChaosEvent.None,
      count: 7,
      anchor: 180,
      recent: [176, 184],
      seed: 3,
      bestScore: 10,
      you: { name: 'Me', score: 10, distance: FINISH_Z, record: rec('Me', 181) },
      grudge: { name: 'crowd9', score: 1000, record: POOL[9].record, distance: POOL[9].distance },
      friend: null,
      promised: { name: g.name, score: g.score, record: g.record },
    });
    expect(out.find((p) => p.rival)?.name).toBe('Bram Oakhollow');
    expect(out.some((p) => p.kind === 'grudge')).toBe(true);
    expect(out.some((p) => p.kind === 'you')).toBe(true);
  });

  it('says who and what time to beat as it starts', () => {
    expect(duelStartLine({ kind: 'duel', rider: riderByKey('bram')! }, fin(132.8))).toEqual({ text: 'Duel: Bram Oakhollow', sub: 'Finish ahead of 2:12.8 on Pinecrest' });
    expect(duelStartLine({ kind: 'duel', rider: riderByKey('bram')! }, null).sub).toBe('Finish ahead on Pinecrest');
    expect(duelStartLine({ kind: 'final' }, null).text).toBe('The last race');
  });
});

describe('settling a run', () => {
  const bram = riderByKey('bram')!;
  const standings = (o: Record<string, Standing>) => new Map(Object.entries(o));

  it('a win beats the rider once: a second settle of the same run changes nothing', () => {
    const t: TwelveSave = { beaten: [] };
    const duel = { kind: 'duel' as const, rider: bram };
    const o = settleTwelve(t, duel, fin(130), standings({ [bram.name]: fin(132.8) }));
    expect(o.fell).toBe(bram);
    expect(o.beaten).toBe(1);
    expect(o.by).toBe('by 2.8 s');
    expect(t.beaten).toEqual(['bram']);
    expect(outcomeLine(o)).toBe('Bram Oakhollow falls. 1 of 12 beaten.');
    const again = settleTwelve(t, duel, fin(130), standings({ [bram.name]: fin(132.8) }));
    expect(again.fell).toBeNull();
    expect(t.beaten).toEqual(['bram']);
  });

  it('a loss or a wreck beats nobody, and says how close it was', () => {
    const t: TwelveSave = { beaten: [] };
    const duel = { kind: 'duel' as const, rider: bram };
    const o = settleTwelve(t, duel, fin(134), standings({ [bram.name]: fin(132.8) }));
    expect(o.fell).toBeNull();
    expect(o.lost).toBe(true);
    expect(outcomeLine(o)).toBe('Bram Oakhollow held you off by 1.2 s.');
    expect(settleTwelve(t, duel, wreck(4000), standings({ [bram.name]: fin(132.8) })).fell).toBeNull();
    expect(t.beaten).toEqual([]);
  });

  it('a run that is no duel, or whose rider never rode, settles nothing', () => {
    const t: TwelveSave = { beaten: [] };
    expect(settleTwelve(t, null, fin(100), standings({ [bram.name]: fin(132.8) })).fell).toBeNull();
    expect(settleTwelve(t, { kind: 'duel', rider: bram }, fin(100), standings({})).fell).toBeNull();
    expect(t.beaten).toEqual([]);
    expect(outcomeLine(settleTwelve(t, null, fin(100), standings({})))).toBeNull();
  });

  it('the eleventh rider opens Lanternfall, and the card says so', () => {
    const t = everyoneBut('crown', 'mila');
    const mila = riderByKey('mila')!;
    const o = settleTwelve(t, { kind: 'duel', rider: mila }, fin(120), standings({ [mila.name]: fin(123.7) }));
    expect(o.opened).toBe(true);
    expect(lanternfallOpen(t)).toBe(true);
    expect(outcomeLine(o)).toBe('Mila Frost falls. Lanternfall is open.');
  });

  it('the King falls last, and one race is left', () => {
    const t = everyoneBut('crown');
    const o = settleTwelve(t, { kind: 'duel', rider: KING }, fin(110), standings({ [KING.name]: fin(113.7) }));
    expect(o.fell).toBe(KING);
    expect(o.opened).toBe(false);
    expect(outcomeLine(o)).toBe('The Hollow King falls. One race is left: all twelve at once.');
    expect(nextDuel(t, all)).toEqual({ kind: 'final' });
  });

  it('the last race is won only ahead of every one of the twelve', () => {
    const t = everyoneBut();
    const field = (kingTime: number) => new Map(TWELVE.map((r, i) => [r.name, fin(r === KING ? kingTime : 120 + i)] as const));
    const lost = settleTwelve(t, { kind: 'final' }, fin(115), field(113.7));
    expect(lost.crowned).toBe(false);
    expect(t.crowned).toBeUndefined();
    expect(outcomeLine(lost)).toBe('The last race stands. Finish ahead of all twelve.');
    // One of them missing from the field is not a win either.
    const short = field(118);
    short.delete(TWELVE[3].name);
    expect(settleTwelve(t, { kind: 'final' }, fin(110), short).crowned).toBe(false);
    const won = settleTwelve(t, { kind: 'final' }, fin(112), field(113.7));
    expect(won.crowned).toBe(true);
    expect(t.crowned).toBe(true);
    expect(outcomeLine(won)).toBe('All twelve beaten in one race. The crown is yours.');
    expect(settleTwelve(t, { kind: 'final' }, fin(112), field(113.7)).crowned).toBe(false);
  });
});

describe('the last race’s field', () => {
  it('is all twelve on their real records, quickest first, the King the rival', () => {
    const f = finalField(POOL);
    expect(f).toHaveLength(12);
    expect(new Set(f.map((p) => p.name))).toEqual(new Set(TWELVE.map((r) => r.name)));
    for (const p of f) expect(p.record).toBe(POOL.find((g) => g.name === p.name)!.record);
    for (let i = 1; i < f.length; i++) expect(f[i].time!).toBeGreaterThanOrEqual(f[i - 1].time!);
    expect(f.filter((p) => p.rival).map((p) => p.name)).toEqual([KING.name]);
  });

  it('rides short rather than invent a rider the pool does not hold', () => {
    expect(finalField(POOL.filter((g) => g.name !== 'Pip Thistle'))).toHaveLength(11);
  });
});

describe('the card’s lines', () => {
  it('counts what is beaten and what is left before the King', () => {
    expect(tallyLine(undefined)).toBe('0 of 12 beaten');
    expect(tallyLine(beat('bram', 'rosa', 'pip'))).toBe('3 of 12 beaten');
    expect(gateLine(beat('bram', 'rosa', 'pip'))).toBe('8 more open Lanternfall');
    expect(gateLine(everyoneBut('crown', 'mila'))).toBe('1 more opens Lanternfall');
    expect(gateLine(everyoneBut('crown'))).toBe('The Hollow King waits on Lanternfall');
    expect(gateLine(everyoneBut())).toBeNull();
    expect(tallyLine(everyoneBut())).toBe('The Twelve are beaten');
    expect(tallyLine({ ...everyoneBut(), crowned: true })).toBe('You hold the crown');
  });
});

describe('the save', () => {
  it('an older save loads with nobody beaten and no field written', () => {
    const d = parseSave(JSON.stringify({ ...defaultSave('Old'), runs: 12, ghostsPassed: 30 }), 'Old');
    expect(d.twelve).toBeUndefined();
    expect(d.runs).toBe(12);
    expect(nextDuel(d.twelve, only(0))).toEqual({ kind: 'duel', rider: riderByKey('bram') });
  });

  it('keeps who is beaten across a save and a load', () => {
    const d = { ...defaultSave('R'), runs: 3, twelve: { beaten: ['bram', 'juno'] } };
    expect(parseSave(JSON.stringify(d), 'R').twelve).toEqual({ beaten: ['bram', 'juno'] });
  });

  it('drops what it cannot read: strangers, repeats, a crown without the King', () => {
    expect(readTwelve({ beaten: ['bram', 'nobody', 'bram', 7, null], crowned: true })).toEqual({ beaten: ['bram'] });
    expect(readTwelve('nope')).toEqual({ beaten: [] });
    expect(readTwelve({ beaten: TWELVE.map((r) => r.key), crowned: true })).toEqual({ beaten: TWELVE.map((r) => r.key), crowned: true });
    const d = parseSave(JSON.stringify({ ...defaultSave('R'), twelve: { beaten: 'x' } }), 'R');
    expect(d.twelve).toBeUndefined();
  });
});
