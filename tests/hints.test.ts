import { describe, expect, it } from 'vitest';
import { AIR_LESSON_S, DRIFT_AFTER_Z, DRIFT_SHOWS, DRIFT_UP_S, HINT_MIN_S, HintCoach, LIP_SHOWS, RETIRE_RING_RUNS, RETIRE_RUNS, RING_AFTER_Z, SPIN_SHOWS, STEER_REST_S, STEER_SHOWS, STEER_UP_S, type HintCounts, type HintFrame } from '../src/game/hints';
import { defaultSave, merge } from '../src/game/save';
import type { HintKind } from '../src/ui/contract';

// Teach-move hints: what shows, for how long, and the per-run caps on the nags.

const DT = 1 / 60;
const ground = (o: Partial<HintFrame> = {}): HintFrame => ({
  dt: DT,
  timer: 10,
  steered: false,
  grounded: true,
  drifting: false,
  action: false,
  drafting: false,
  airTicks: 0,
  ttl: Infinity,
  runs: 3,
  z: 2000,
  kickerAhead: false,
  heldLip: false,
  draftTarget: false,
  chased: false,
  ...o,
});
const air = (ttl: number, o: Partial<HintFrame> = {}): HintFrame => ground({ grounded: false, airTicks: 20, ttl, ...o });

/** Steps `secs` of frames, returning every hint change in order. */
function play(c: HintCoach, h: HintCounts, frames: (i: number) => HintFrame, secs: number, seen: HintCounts = {}): Array<{ t: number; show: HintKind | null }> {
  const out: Array<{ t: number; show: HintKind | null }> = [];
  for (let i = 0; i < Math.round(secs * 60); i++) {
    const s = c.step(frames(i), h, seen);
    if (s.show !== undefined) out.push({ t: i * DT, show: s.show });
  }
  return out;
}

describe('the taught first minute', () => {
  const first = (o: Partial<HintFrame> = {}): HintFrame => ground({ runs: 0, timer: 8, z: 100, ...o });

  it('teaches steering at once', () => {
    const c = new HintCoach();
    expect(c.step(first({ timer: 0, z: 0 }), {}).show).toBe('steer');
  });

  it('runs in order: steer, the lip, the ring, the air', () => {
    const c = new HintCoach();
    const h: HintCounts = {};
    const seen: Array<HintKind | null> = [];
    const go = (f: (i: number) => HintFrame, secs: number) => {
      for (const x of play(c, h, f, secs)) if (x.show) seen.push(x.show);
    };
    // The first seconds: only steering, and the drift nag keeps off.
    go(() => first({ timer: 1, z: 20 }), 2);
    h.steer = 1;
    go(() => first({ steered: true, timer: 8, z: 150 }), 1);
    go(() => first({ timer: 9, z: 250 }), 2);
    // About 300 m: the first kicker, with nothing failed yet.
    go(() => first({ timer: 12, z: 290, kickerAhead: true }), 1.7);
    // Off its lip: a flight, the ring as it comes down.
    go((i) => air(1.15 - i * DT, { runs: 0, timer: 14, z: 330 }), 1.1);
    go(() => first({ timer: 16, z: 400 }), 1);
    // The first leap by about 700 m: the air. No stomp landed yet: the lesson does not wait for one.
    go((i) => air(2.6 - i * DT, { runs: 0, timer: 26, z: 690 }), 2.5);
    expect(seen.slice(0, 4)).toEqual(['steer', 'boostPop', 'stomp', 'spin']);
  });

  it('never waits for a failed kicker: the lip is taught on a first approach', () => {
    const c = new HintCoach();
    expect(c.step(first({ kickerAhead: true }), { steer: 1 }).show).toBe('boostPop');
  });

  it('never waits for steering either: a kicker in reach takes the slot', () => {
    const c = new HintCoach();
    expect(c.step(first({ timer: 1, z: 20 }), {}).show).toBe('steer');
    const out = play(c, {}, () => first({ timer: 3, z: 280, kickerAhead: true }), 2);
    expect(out.map((x) => x.show)).toEqual(['boostPop']);
  });

  it('teaches nothing in a tumble, airborne or not', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, boostPop: 1 };
    expect(play(c, h, (i) => air(0.9 - i * DT, { tumbling: true }), 0.5)).toEqual([]);
    // Already up, it goes at once.
    expect(c.step(air(0.9), h).show).toBe('stomp');
    expect(c.step(air(0.88, { tumbling: true }), h).show).toBeNull();
  });

  it('keeps the drift nag off the first run until the air is taught', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1 };
    expect(play(c, h, () => first({ z: DRIFT_AFTER_Z - 1 }), 3).map((x) => x.show)).not.toContain('drift');
    expect(play(c, h, () => first({ z: DRIFT_AFTER_Z }), 1).map((x) => x.show)).toContain('drift');
  });

  it('holds the ring for the lip, but not past the first stretch with no kicker in reach', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1 };
    expect(play(c, h, (i) => air(0.9 - i * DT, { runs: 0, z: 100 }), 0.5)).toEqual([]);
    c.reset();
    expect(play(c, h, (i) => air(0.9 - i * DT, { runs: 0, z: RING_AFTER_Z }), 0.5).map((x) => x.show)).toEqual(['stomp']);
  });

  it('stops teaching the lip after a few kickers', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, drift: 2 };
    let shows = 0;
    for (let k = 0; k < 6; k++) {
      shows += play(c, h, () => ground({ kickerAhead: true }), 2).filter((x) => x.show === 'boostPop').length;
      play(c, h, () => air(0.2, { airTicks: 3 }), 0.3);
      play(c, h, () => ground(), 2);
    }
    expect(shows).toBe(LIP_SHOWS);
  });
});

describe('the hint coach', () => {
  it('a kicker ahead teaches the boosted pop before the drift nag on that approach', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3, drift: 0 };
    const out = play(c, h, () => ground({ kickerAhead: true }), 0.5);
    expect(out[0].show).toBe('boostPop');
    // Off the kicker's approach, the drift nag comes back.
    const later = play(c, h, () => ground(), 2);
    expect(later.map((x) => x.show)).toContain('drift');
  });

  it('the drift nag shows at most 3 times a run', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3, drift: 0 };
    let shows = 0;
    for (let k = 0; k < 6; k++) {
      // 2 s on the ground, then a 2 s flight (which takes the drift hint down).
      shows += play(c, h, () => ground(), 2).filter((x) => x.show === 'drift').length;
      play(c, h, () => air(4, { airTicks: 3 }), 2);
    }
    expect(shows).toBe(DRIFT_SHOWS);
  });

  it('...and at most 20 s on screen, whichever comes first', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3, drift: 0 };
    const out = play(c, h, () => ground(), 40);
    expect(out.map((x) => x.show)).toEqual(['drift', null]);
    expect(out[1].t).toBeCloseTo(DRIFT_UP_S, 0);
    // A new run starts over.
    c.reset();
    expect(play(c, h, () => ground(), 1)[0].show).toBe('drift');
  });

  it('while the stomp is being learned, the spin lesson needs room and holds 0.8 s before the stomp cue', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, stomp: 1, spin: 0 };
    // A short flight: too short to read the spin lesson before the stomp cue: no spin at all.
    const short = play(c, h, (i) => air(AIR_LESSON_S - 0.1 - i * DT), AIR_LESSON_S - 0.1);
    expect(short.map((x) => x.show)).toEqual(['stomp']);
    c.reset();
    // A 2.5 s flight: the spin lesson shows, holds its 0.8 s, then the stomp cue takes over.
    const long = play(c, h, (i) => air(2.5 - i * DT), 2.5);
    expect(long.map((x) => x.show)).toEqual(['spin', 'stomp']);
    expect(long[1].t - long[0].t).toBeGreaterThanOrEqual(HINT_MIN_S - 1e-9);
  });

  it('the spin lesson shows at most 3 times a run', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, stomp: 3, spin: 0 };
    let shows = 0;
    for (let k = 0; k < 6; k++) {
      shows += play(c, h, (i) => air(3 - i * DT), 2.9).filter((x) => x.show === 'spin').length;
      play(c, h, () => ground(), 1);
    }
    expect(shows).toBe(SPIN_SHOWS);
  });

  it('steering while the steer hint is wanted teaches it; a slipstream teaches drafting', () => {
    const c = new HintCoach();
    expect(c.step(ground({ timer: 1, steered: true }), {}).learned).toContain('steer');
    expect(c.step(ground({ drafting: true }), { steer: 1, drift: 2, pop: 1 }).learned).toContain('draft');
  });

  it('the stomp cue never blinks on a micro-hop: more than 6 air ticks, or 0.3 s still to fall', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, stomp: 0 };
    // A bump's hop: 4 ticks in the air, 0.07 s predicted at takeoff, then the snow again.
    const hop = (i: number) => (i < 4 ? air(0.07 - i * DT, { airTicks: i + 1 }) : ground());
    expect(play(c, h, hop, 0.5)).toEqual([]);
    // A real flight shows it from takeoff when 0.3 s or more is left, or after 6 air ticks.
    c.reset();
    expect(play(c, h, (i) => air(0.6 - i * DT, { airTicks: i + 1 }), 0.1)[0]).toMatchObject({ show: 'stomp', t: 0 });
    c.reset();
    const late = play(c, h, (i) => air(0.25 - i * DT, { airTicks: i + 1 }), 0.15);
    expect(late.map((x) => x.show)).toEqual(['stomp']);
    expect(late[0].t).toBeCloseTo(6 * DT, 5);
  });

  it('a shown stomp cue holds through a quick hop and goes after 0.2 s on the snow', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, stomp: 0 };
    // A 0.3 s flight, 65 ms on the snow, another 0.3 s flight, then the snow for good.
    const seq = (i: number): HintFrame => {
      if (i < 18) return air(0.3 - i * DT, { airTicks: i + 1 });
      if (i < 22) return ground();
      if (i < 40) return air(0.3 - (i - 22) * DT, { airTicks: i - 21 });
      return ground();
    };
    const out = play(c, h, seq, 1.5);
    // One showing: up at takeoff, down HINT_MIN_S later or 0.2 s after the last touchdown.
    expect(out.map((x) => x.show)).toEqual(['stomp', null]);
    expect(out[1].t).toBeGreaterThanOrEqual(HINT_MIN_S - 1e-9);
    expect(out[1].t).toBeLessThanOrEqual(40 * DT + 0.2 + 2 * DT);
    // Landing after a long cue (up HINT_MIN_S or more): it goes at touchdown.
    c.reset();
    const long = play(c, h, (i) => (i < 66 ? air(1.1 - i * DT, { airTicks: i + 1 }) : ground()), 1.4);
    expect(long.map((x) => x.show)).toEqual(['stomp', null]);
    expect(long[1].t).toBeCloseTo(66 * DT, 5);
  });

  it('a stomp straight into the next flight brings the cue back after 0.2 s, not a frame later', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, stomp: 1 };
    expect(play(c, h, (i) => air(0.6 - i * DT, { airTicks: 30 + i }), 0.2)[0].show).toBe('stomp');
    // Stomped (the app counts it and drops the cue), and the sled is already in the air again.
    h.stomp = 2;
    c.drop();
    const next = play(c, h, (i) => air(1.0 - i * DT, { airTicks: i + 1 }), 0.5);
    expect(next.map((x) => x.show)).toEqual(['stomp']);
    expect(next[0].t).toBeGreaterThanOrEqual(0.2 - DT - 1e-9);
  });

  it('the avalanche clears every hint', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3, drift: 0 };
    play(c, h, () => ground(), 0.5);
    expect(c.shown).toBe('drift');
    expect(c.step(ground({ chased: true }), h).show).toBeNull();
  });
});

// Round 7: a hint leaves once the control has been shown, and does not wait for that for ever.
describe('hints that leave', () => {
  const first = (o: Partial<HintFrame> = {}): HintFrame => ground({ runs: 0, timer: 2, z: 60, ...o });

  /** Plays whole runs of `frames`, counting each run's first showings into `seen` as the app does. */
  function runs(n: number, h: HintCounts, seen: HintCounts, frames: (i: number) => HintFrame, secs: number): HintKind[][] {
    const out: HintKind[][] = [];
    const c = new HintCoach();
    for (let r = 0; r < n; r++) {
      c.reset();
      const shown: HintKind[] = [];
      for (let i = 0; i < Math.round(secs * 60); i++) {
        const st = c.step(frames(i), h, seen);
        if (st.show) shown.push(st.show);
        if (st.seen) seen[st.seen] = (seen[st.seen] ?? 0) + 1;
      }
      out.push(shown);
    }
    return out;
  }

  it('the steer lesson goes the moment the rider steers, and the save keeps it gone', () => {
    const c = new HintCoach();
    const h: HintCounts = {};
    expect(c.step(first(), h).show).toBe('steer');
    const st = c.step(first({ steered: true }), h);
    expect(st.show).toBeNull();
    expect(st.learned).toContain('steer');
    // The app counts it; from then on it never shows, this run or any other.
    h.steer = 1;
    expect(play(c, h, () => first({ astray: true }), 5)).toEqual([]);
    c.reset();
    expect(play(c, h, () => first(), 30).map((x) => x.show)).not.toContain('steer');
  });

  it('a rider who never steers is not told for a whole run: it is up for its time, then gone', () => {
    const c = new HintCoach();
    const out = play(c, {}, (i) => first({ timer: i * DT, z: i * 0.4 }), 90).filter((x) => x.show === 'steer' || x.show === null);
    expect(out[0]).toMatchObject({ show: 'steer', t: 0 });
    const down = out.find((x) => x.show === null)!;
    expect(down.t).toBeGreaterThanOrEqual(STEER_UP_S - 2 * DT);
    expect(down.t).toBeLessThan(STEER_UP_S + 0.5);
    expect(out.filter((x) => x.show === 'steer').length).toBe(1);
  });

  it('it comes back only when plainly needed: off the corridor, having still never steered', () => {
    const c = new HintCoach();
    const h: HintCounts = {};
    play(c, h, () => first(), STEER_UP_S + 2);
    expect(c.shown).not.toBe('steer');
    // On the corridor: nothing, however long.
    expect(play(c, h, () => first(), 20).map((x) => x.show)).not.toContain('steer');
    // In the bank: it is back, it has its time again and no more, and it does not blink: once gone it
    // rests, and a run shows it STEER_SHOWS times at most however long the rider sits there.
    const back = play(c, h, () => first({ astray: true }), 300).filter((x) => x.show === 'steer' || x.show === null);
    expect(back.map((x) => x.show)).toEqual(['steer', null, 'steer', null]);
    expect(back[1].t - back[0].t).toBeCloseTo(STEER_UP_S, 0);
    expect(back[2].t - back[1].t).toBeGreaterThanOrEqual(STEER_REST_S - 2 * DT);
    expect(1 + back.filter((x) => x.show === 'steer').length).toBe(STEER_SHOWS);
  });

  it('a lesson shown in three runs and never taken up is not shown in a fourth', () => {
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3 };
    const seen: HintCounts = {};
    const shows = runs(RETIRE_RUNS + 2, h, seen, () => ground(), 8);
    for (let r = 0; r < RETIRE_RUNS; r++) expect(shows[r]).toContain('drift');
    expect(shows[RETIRE_RUNS]).toEqual([]);
    expect(shows[RETIRE_RUNS + 1]).toEqual([]);
    // The run is counted once however often the lesson showed in it.
    expect(seen.drift).toBe(RETIRE_RUNS);
  });

  it('the run a lesson retires in still shows it to the end', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3 };
    const seen: HintCounts = { drift: RETIRE_RUNS - 1 };
    let shows = 0;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 120; i++) {
        const st = c.step(ground(), h, seen);
        if (st.show === 'drift') shows++;
        if (st.seen) seen[st.seen] = (seen[st.seen] ?? 0) + 1;
      }
      play(c, h, () => air(4, { airTicks: 3 }), 2);
    }
    expect(seen.drift).toBe(RETIRE_RUNS);
    expect(shows).toBe(DRIFT_SHOWS);
  });

  it('a retired lip lesson comes back when the button was held through a lip', () => {
    const h: HintCounts = { steer: 1, drift: 2 };
    const seen: HintCounts = { boostPop: RETIRE_RUNS };
    const c = new HintCoach();
    expect(play(c, h, () => ground({ kickerAhead: true }), 2, seen)).toEqual([]);
    expect(play(c, h, () => ground({ kickerAhead: true, heldLip: true }), 1, seen).map((x) => x.show)).toEqual(['boostPop']);
  });

  it('the landing ring has longer, and the air lessons do not wait for a ring that has retired', () => {
    const h: HintCounts = { steer: 1, pop: 1, drift: 2 };
    const c = new HintCoach();
    expect(play(c, h, (i) => air(0.9 - i * DT), 0.5, { stomp: RETIRE_RING_RUNS - 1 }).map((x) => x.show)).toEqual(['stomp']);
    c.reset();
    const out = play(c, h, (i) => air(2.5 - i * DT), 2.4, { stomp: RETIRE_RING_RUNS });
    expect(out.map((x) => x.show)).toEqual(['spin', null]);
  });

  it('a lesson taken up leaves at once and the count of runs no longer matters', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3 };
    play(c, h, () => ground(), 1);
    expect(c.shown).toBe('drift');
    // Drifting takes it down without the hold; two releases and it is learned for good.
    expect(c.step(ground({ drifting: true }), h).show).toBeNull();
    h.drift = 2;
    c.reset();
    expect(play(c, h, () => ground(), 30)).toEqual([]);
  });

  it('the save carries the runs each lesson was shown in, and an old save starts them at none', () => {
    expect(defaultSave('Ada').hintsSeen ?? {}).toEqual({});
    const old = merge(defaultSave('Ada'), { v: 1, name: 'Ada', hints: { steer: 1 } } as never, '2026-01-01');
    expect(old.hints).toEqual({ steer: 1 });
    expect(old.hintsSeen).toEqual({});
    const kept = merge(defaultSave('Ada'), { v: 1, name: 'Ada', hints: { steer: 1 }, hintsSeen: { drift: 3, spin: 1 } } as never, '2026-01-01');
    expect(kept.hintsSeen).toEqual({ drift: 3, spin: 1 });
    expect(merge(defaultSave('Ada'), { v: 1, name: 'Ada', hintsSeen: 7 } as never, '2026-01-01').hintsSeen).toEqual({});
  });
});
