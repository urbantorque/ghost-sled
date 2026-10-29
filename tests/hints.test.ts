import { describe, expect, it } from 'vitest';
import { DRIFT_SHOWS, DRIFT_UP_S, HINT_MIN_S, HintCoach, SPIN_SHOWS, type HintCounts, type HintFrame } from '../src/game/hints';
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
  kickerAhead: false,
  heldLip: false,
  draftTarget: false,
  chased: false,
  ...o,
});
const air = (ttl: number, o: Partial<HintFrame> = {}): HintFrame => ground({ grounded: false, airTicks: 20, ttl, ...o });

/** Steps `secs` of frames, returning every hint change in order. */
function play(c: HintCoach, h: HintCounts, frames: (i: number) => HintFrame, secs: number): Array<{ t: number; show: HintKind | null }> {
  const out: Array<{ t: number; show: HintKind | null }> = [];
  for (let i = 0; i < Math.round(secs * 60); i++) {
    const s = c.step(frames(i), h);
    if (s.show !== undefined) out.push({ t: i * DT, show: s.show });
  }
  return out;
}

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

  it('while the stomp is being learned, the spin lesson needs 2 s left and holds 0.8 s before the stomp cue', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, drift: 2, stomp: 1, spin: 0 };
    // A 1.9 s flight: too short to read the spin lesson before the stomp cue: no spin at all.
    const short = play(c, h, (i) => air(1.9 - i * DT), 1.9);
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

  it('the avalanche clears every hint', () => {
    const c = new HintCoach();
    const h: HintCounts = { steer: 1, pop: 1, stomp: 3, drift: 0 };
    play(c, h, () => ground(), 0.5);
    expect(c.shown).toBe('drift');
    expect(c.step(ground({ chased: true }), h).show).toBeNull();
  });
});
