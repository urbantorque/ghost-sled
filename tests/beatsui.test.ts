import { describe, expect, it } from 'vitest';
import type { Beat, GhostRef } from '../src/game/beats';
import { ChaosEvent } from '../src/sim/chaos';
import { BeatRouter } from '../src/ui/beatsui';
import type { Fx } from '../src/ui/fx';
import type { Hud } from '../src/ui/hud';
import { grudgeCopy, type Notices } from '../src/ui/notices';

// The overlay's half of the beats contract, against recording stand-ins for the HUD, the fx layer
// and the notice band: every beat the director emits lands in exactly one picture.

type Call = [string, ...unknown[]];

function rig() {
  const calls: Call[] = [];
  const rec =
    (tag: string) =>
    (...a: unknown[]) => {
      calls.push([tag, ...a]);
    };
  const hud = {
    flashPass: rec('hud.flashPass'),
    news: rec('hud.news'),
    retract: rec('hud.retract'),
    call: rec('hud.call'),
    lead: rec('hud.lead'),
    say: rec('hud.say'),
    paceHit: rec('hud.paceHit'),
    flashBest: rec('hud.flashBest'),
    holdDuel: rec('hud.holdDuel'),
  } as unknown as Hud;
  const fx = { pop: rec('fx.pop'), stomp: rec('fx.stomp'), stamp: rec('fx.stamp'), cashIn: rec('fx.cashIn'), lost: rec('fx.lost'), retireStamp: rec('fx.retireStamp') } as unknown as Fx;
  const notices = { toast: rec('notices.toast'), grudge: rec('notices.grudge'), grudgeSettled: rec('notices.grudgeSettled'), finale: rec('notices.finale'), unlock: rec('notices.unlock') } as unknown as Notices;
  const router = new BeatRouter(hud, fx, notices);
  return { calls, router, of: (tag: string) => calls.filter((c) => c[0] === tag) };
}

const mila: GhostRef = { id: 3, name: 'Mila', kind: 'grudge', dx: 1 };
const you: GhostRef = { id: 9, name: 'Noor Frostberg', kind: 'you', dx: -1 };
const pool: GhostRef = { id: 4, name: 'Tess', kind: 'pool', dx: 2 };

describe('BeatRouter', () => {
  it('prints the say of every beat that has no picture of its own in the callout slot', () => {
    const { router, of } = rig();
    const list: Beat[] = [
      { type: 'nearMiss', tick: 1, grade: 'whisker', gap: 0.2, side: 1, x: 0, z: 0, obs: 'pine', speed: 22, say: { label: 'Whisker', points: 120, tone: 'big' } },
      { type: 'nearMiss', tick: 2, grade: 'near', gap: 0.8, side: -1, x: 0, z: 0, obs: 'rock', speed: 20, say: { label: 'Near miss', points: 120, tone: 'normal' } },
      { type: 'km', tick: 3, km: 1, say: { label: '1 km', points: 0, tone: 'big' } },
      { type: 'flow', tick: 4, phase: 'in', say: { label: 'In the flow', points: 0, tone: 'big' } },
      { type: 'flow', tick: 5, phase: 'snuff', say: { label: 'Flow broken', points: 0, tone: 'lost' } },
      { type: 'newGround', tick: 6, z: 700, say: { label: 'New ground', points: 0, tone: 'best' } },
      { type: 'callout', tick: 7, source: 'drift', say: { label: 'Max drift', points: 300, tone: 'big' } },
      // No say, no picture: nothing.
      { type: 'driftRelease', tick: 8, tier: 3, x: 0, z: 0, heading: 0, driftDir: 1 },
      { type: 'crash', tick: 9, cause: 'tree', stake: 0, orbitFrom: null },
      { type: 'stompTick', tick: 10, step: 3, open: false },
    ];
    router.handle(list);
    expect(of('fx.pop').map((c) => c[1])).toEqual(['Whisker', 'Near miss', '1 km', 'In the flow', 'Flow broken', 'New ground', 'Max drift']);
    expect(of('fx.pop')[0]).toEqual(['fx.pop', 'Whisker', 120, 'big']);
  });

  it('gives streak broken, best combo pace, new best and a friend beaten their words', () => {
    const { router, of } = rig();
    router.handle([
      { type: 'streakBroken', tick: 1, was: 3, say: { label: 'Streak broken', points: 0, tone: 'lost' } },
      { type: 'streakBroken', tick: 2, was: 4 },
      { type: 'bestComboPace', tick: 3, stake: 2400 },
      { type: 'newBest', tick: 4, score: 9000 },
      { type: 'friendBeaten', tick: 5, name: 'Mila', distance: 2340 },
    ]);
    expect(of('fx.pop').map((c) => [c[1], c[3]])).toEqual([
      ['Streak broken', 'lost'],
      ['Streak broken', 'lost'],
      ['Best combo pace', 'best'],
      ['New best', 'best'],
      ["Beat Mila's 2,340 m", 'big'],
    ]);
    expect(of('hud.paceHit')).toHaveLength(1);
    expect(of('hud.flashBest')).toHaveLength(1);
  });

  it('heads a stomp with its own stamp and hands banks and lost combos their figures', () => {
    const { router, of } = rig();
    const lead = [{ label: '2 in a row', points: 0 }];
    router.handle([
      { type: 'stomp', tick: 1, streak: 2, late: false, title: 'Double stomp', lead, x: 0, z: 0, heading: 0, yetiHop: false },
      { type: 'bank', tick: 2, points: 9000, mult: 6, origin: 1500, tier: 2, header: null, bump: false },
      { type: 'comboLost', tick: 3, points: 4960, stake: 4960, best: true, crack: true, say: { label: 'Best combo lost', points: 4960, tone: 'lost' } },
      { type: 'comboLost', tick: 4, points: 120, stake: 120, best: false, crack: false },
    ]);
    expect(of('fx.stomp')).toEqual([['fx.stomp', 'Double stomp', lead, 2]]);
    expect(of('fx.cashIn')[0][1]).toMatchObject({ tier: 2, origin: 1500, points: 9000 });
    expect(of('fx.lost')).toEqual([
      ['fx.lost', 4960, 4960, true, true],
      ['fx.lost', 120, 120, false, false],
    ]);
    // Their says are never printed twice.
    expect(of('fx.pop')).toHaveLength(0);
  });

  it('retires a live stamp on a crash and on a broken streak, before the loss line', () => {
    const { router, calls } = rig();
    router.handle([
      { type: 'stomp', tick: 1, streak: 4, late: false, title: 'Quad stomp', lead: [{ label: '4 in a row', points: 0 }], x: 0, z: 0, heading: 0, yetiHop: false },
      { type: 'streakBroken', tick: 2, was: 4, say: { label: 'Streak broken', points: 0, tone: 'lost' } },
      { type: 'crash', tick: 3, cause: 'tree', stake: 900, orbitFrom: null },
      { type: 'comboLost', tick: 3, points: 900, stake: 900, best: false, crack: true },
    ]);
    expect(calls.map((c) => c[0])).toEqual(['fx.stomp', 'fx.retireStamp', 'fx.pop', 'fx.retireStamp', 'fx.lost']);
  });

  it('retires a live stamp on a sketchy landing before its line, and leaves it for other callouts', () => {
    const { router, calls } = rig();
    router.handle([
      { type: 'stomp', tick: 1, streak: 1, late: false, title: 'Perfect landing', lead: [{ label: 'Stomp', points: 250 }], x: 0, z: 0, heading: 0, yetiHop: false },
      { type: 'callout', tick: 2, source: 'drift', say: { label: 'Max drift', points: 300, tone: 'big' } },
      { type: 'callout', tick: 40, source: 'sketchy', say: { label: 'Sketchy', points: 0, tone: 'lost' } },
    ]);
    expect(calls.map((c) => c[0])).toEqual(['fx.stomp', 'fx.pop', 'fx.retireStamp', 'fx.pop']);
  });

  it("retires a live stamp before 'Flow broken' (a sketchy landing's line in place of Sketchy), not for a wordless snuff or In the flow", () => {
    const { router, calls } = rig();
    router.handle([
      { type: 'stomp', tick: 1, streak: 2, late: false, title: 'Double stomp', lead: [{ label: '2 in a row', points: 0 }], x: 0, z: 0, heading: 0, yetiHop: false },
      { type: 'flow', tick: 2, phase: 'in', say: { label: 'In the flow', points: 0, tone: 'big' } },
      { type: 'flow', tick: 3, phase: 'snuff' },
      { type: 'flow', tick: 40, phase: 'snuff', say: { label: 'Flow broken', points: 0, tone: 'lost' } },
    ]);
    expect(calls.map((c) => [c[0], c[1]])).toEqual([
      ['fx.stomp', 'Double stomp'],
      ['fx.pop', 'In the flow'],
      ['fx.retireStamp', undefined],
      ['fx.pop', 'Flow broken'],
    ]);
  });

  it("holds the pill on a duel's ghost for its result (won, held off, lost), before the result's flash", () => {
    const { router, calls } = rig();
    router.handle([
      { type: 'duel', tick: 1, phase: 'open', ghost: pool, gifts: 0 },
      { type: 'duel', tick: 2, phase: 'heldOff', ghost: pool, gifts: 10 },
      { type: 'duel', tick: 3, phase: 'lost', ghost: mila, gifts: 0 },
      { type: 'duel', tick: 4, phase: 'closed', ghost: you, gifts: 0 },
    ]);
    expect(calls.filter((c) => c[0] !== 'hud.say').map((c) => c.slice(0, 2))).toEqual([
      ['hud.holdDuel', 'Tess'],
      ['hud.flashPass', 'Tess'],
      ['hud.holdDuel', 'Mila'],
      ['hud.news', 'Mila'],
    ]);
  });

  it('flashes shown passes in the pill, keeps muted ones silent, and names a settled grudge once', () => {
    const { router, of } = rig();
    router.handle([
      { type: 'pass', tick: 1, ghost: pool, word: 'jostle', text: 'Passed', first: true, chain: 0, ladder: 1, octave: false, gifts: 5, muted: true },
      { type: 'grudgeSettled', tick: 2, ghost: mila, nemesis: true, after: 3, paid: 20 },
      { type: 'pass', tick: 2, ghost: mila, word: 'double', text: 'Double pass', first: true, chain: 2, ladder: 2, octave: false, gifts: 20, muted: false },
      { type: 'passedBy', tick: 3, ghost: pool, muted: false },
      { type: 'passedBy', tick: 4, ghost: pool, muted: true },
    ]);
    expect(of('hud.flashPass')).toEqual([
      ['hud.flashPass', 'Mila', 'grudge', true, 'Double pass', 'double'],
      ['hud.flashPass', 'Tess', 'pool', false],
    ]);
    expect(of('notices.grudgeSettled')).toStrictEqual([['notices.grudgeSettled', 'Mila', true, 3, 20, undefined]]);
  });

  it("puts a merged grudge wipeout on the settle banner's sub-line, not in the callout slot", () => {
    const { router, of } = rig();
    router.handle([{ type: 'grudgeSettled', tick: 2, ghost: mila, nemesis: false, after: 1, paid: 10, say: { label: 'Wiped out behind you', points: 0, tone: 'normal' } }]);
    expect(of('notices.grudgeSettled')).toStrictEqual([['notices.grudgeSettled', 'Mila', false, 1, 10, 'Wiped out behind you']]);
    expect(of('fx.pop')).toEqual([]);
    expect(of('hud.say')).toEqual([]);
  });

  it('says a lost duel once, never by your own name, as the duel result that keeps the pill', () => {
    const { router, of } = rig();
    router.handle([
      { type: 'duel', tick: 1, phase: 'lost', ghost: you, gifts: 0 },
      { type: 'raceNews', tick: 1, ghost: you, news: 'pulledAway', text: 'Noor Frostberg pulled away', pan: 0, gain: 0.6 },
    ]);
    // The last argument marks it the duel's result: other news goes to the callout line in a duel.
    expect(of('hud.news')).toEqual([['hud.news', 'Noor Frostberg', 'you', 'Your best pulled away', undefined, true]]);
  });

  it('keeps race news about your best as "Your best", and lets the unlock tease wait out its pass', () => {
    const { router, of } = rig();
    router.handle([
      { type: 'raceNews', tick: 1, ghost: you, news: 'pulledAway', text: 'Noor Frostberg pulled away', pan: 0, gain: 0.6 },
      { type: 'raceNews', tick: 2, ghost: pool, news: 'wipeout', text: 'Tess wiped out', pan: 0, gain: 1 },
      { type: 'raceNews', tick: 3, ghost: pool, news: 'unlockTease', text: '1 more ghost opens Frostfang Glacier', pan: 0, gain: 0 },
    ]);
    const news = of('hud.news');
    expect(news[0]).toEqual(['hud.news', 'Noor Frostberg', 'you', 'Your best pulled away']);
    expect(news[1]).toEqual(['hud.news', 'Tess', 'pool', 'Tess wiped out']);
    expect(news[2][3]).toBe('1 more ghost opens Frostfang Glacier');
    expect(news[2][4]).toBeGreaterThanOrEqual(2600);
  });

  it('takes the unlock tease back once the next first pass (or the unlock itself) makes it untrue', () => {
    const tease = '1 more ghost opens Frostfang Glacier';
    const pass = (g: GhostRef, first: boolean, muted: boolean): Beat => ({ type: 'pass', tick: 1, ghost: g, word: muted ? 'jostle' : 'passed', text: 'Passed', first, chain: 0, ladder: 1, octave: false, gifts: 5, muted });
    const a = rig();
    // The pass that leaves one to go comes before its tease in the same list: it does not retract it.
    a.router.handle([pass(pool, true, false), { type: 'raceNews', tick: 1, ghost: pool, news: 'unlockTease', text: tease, pan: 0, gain: 0 }]);
    expect(a.of('hud.retract')).toHaveLength(0);
    // A repeat pass of a ghost already passed opens nothing.
    a.router.handle([pass(pool, false, false)]);
    expect(a.of('hud.retract')).toHaveLength(0);
    // A start-line jostle (muted) still counts toward the unlock.
    a.router.handle([pass(mila, true, true)]);
    expect(a.of('hud.retract')).toEqual([['hud.retract', tease]]);
    a.router.handle([{ type: 'unlockPop', tick: 2, id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier' }]);
    expect(a.of('hud.retract')).toHaveLength(1);

    const b = rig();
    b.router.handle([{ type: 'raceNews', tick: 1, ghost: pool, news: 'unlockTease', text: tease, pan: 0, gain: 0 }]);
    b.router.handle([{ type: 'unlockPop', tick: 2, id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier' }]);
    expect(b.of('hud.retract')).toEqual([['hud.retract', tease]]);
  });

  it('routes duels, the lead, the start-line call, finales and the pops', () => {
    const { router, of } = rig();
    router.handle([
      { type: 'duel', tick: 1, phase: 'open', ghost: pool, gifts: 0 },
      { type: 'duel', tick: 2, phase: 'won', ghost: pool, gifts: 10 },
      { type: 'duel', tick: 3, phase: 'heldOff', ghost: you, gifts: 10 },
      { type: 'lead', tick: 4, of: 6 },
      { type: 'raceCall', tick: 5, ghost: mila, word: 'Nemesis', sr: 'Nemesis Mila. Mila beat you 3 runs running.' },
      { type: 'finale', tick: 6, event: ChaosEvent.Avalanche, outcome: 'outran', text: 'Outran the avalanche', sub: '+2,000 style', gifts: 0, grade: 1, banner: true, stamp: false },
      { type: 'finale', tick: 7, event: ChaosEvent.Yeti, outcome: 'hopped', text: 'Yeti hop', sub: '+1,500', gifts: 0, grade: 1, banner: false, stamp: true },
      { type: 'finale', tick: 8, event: ChaosEvent.GiftStorm, outcome: 'caught', text: 'Caught 31 of 48', sub: null, gifts: 0, grade: 1, banner: false, stamp: false },
      { type: 'missionPop', tick: 9, id: 'pass1', text: 'Pass a ghost', reward: 25 },
      { type: 'unlockPop', tick: 10, id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier' },
    ]);
    expect(of('hud.say')).toEqual([['hud.say', 'Duel with Tess']]);
    expect(of('hud.flashPass')).toEqual([
      ['hud.flashPass', 'Tess', 'pool', true, 'Duel won', 'duelWon'],
      ['hud.flashPass', 'Noor Frostberg', 'you', true, 'Held off', 'heldOff'],
    ]);
    expect(of('hud.lead')).toHaveLength(1);
    expect(of('hud.call')).toEqual([['hud.call', 'Nemesis', 'Mila', 'grudge', 'Nemesis Mila. Mila beat you 3 runs running.']]);
    expect(of('notices.finale')).toEqual([['notices.finale', 'Outran the avalanche', '+2,000 style', ChaosEvent.Avalanche]]);
    expect(of('fx.stamp')).toEqual([['fx.stamp', 'Yeti hop', [{ label: 'Yeti hop', points: 1500 }]]]);
    expect(of('fx.pop')).toEqual([['fx.pop', 'Caught 31 of 48', 0, 'big']]);
    expect(of('notices.toast')).toEqual([['notices.toast', 'Mission done: Pass a ghost', 'mission', '+25 gifts']]);
    expect(of('notices.unlock')).toEqual([['notices.unlock', 'Frostfang Glacier', 'glacier']]);
  });
});

describe('grudgeCopy', () => {
  it('reads a nemesis down as one line with the gifts after a middle dot', () => {
    const c = grudgeCopy('Mila', true, 3, 20);
    expect(c.text).toBe('Nemesis down');
    expect(c.note).toBe('after 3 runs');
    expect(c.sub).toBe('+20 gifts');
    expect(c.said).toBe('Nemesis down. Beat Mila after 3 runs · +20 gifts');
  });

  it('settles a plain grudge with the name and its reward, a run count only past one run', () => {
    expect(grudgeCopy('Tess', false, 1, 10)).toEqual({ text: 'Grudge settled', note: undefined, sub: '+10 gifts', said: 'Grudge settled. Tess · +10 gifts' });
    expect(grudgeCopy('Tess', false, 2, 20).said).toBe('Grudge settled. Tess after 2 runs · +20 gifts');
  });

  it('reads the moment that settled it after the name, and keeps it off the copy when absent', () => {
    expect(grudgeCopy('Tess', false, 1, 10, 'Wiped out behind you')).toEqual({ text: 'Grudge settled', note: undefined, why: 'Wiped out behind you', sub: '+10 gifts', said: 'Grudge settled. Tess. Wiped out behind you · +10 gifts' });
    expect(grudgeCopy('Mila', true, 3, 15, 'Wiped out behind you').said).toBe('Nemesis down. Beat Mila after 3 runs. Wiped out behind you · +15 gifts');
    expect(grudgeCopy('Tess', false, 2, 10, '  ').why).toBeUndefined();
  });

  it('never prints an em or en dash, and formats big numbers', () => {
    const c = grudgeCopy('Mila', true, 12, 1200);
    expect(c.said).toBe('Nemesis down. Beat Mila after 12 runs · +1,200 gifts');
    for (const s of [c.said, grudgeCopy('A', false, 1, 0).said]) expect(s).not.toMatch(/[–—]/);
  });
});
