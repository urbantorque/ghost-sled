import { describe, expect, it } from 'vitest';
import { COUNT_IN_MAX, FLOOR_FROM, FLOW_FULL, RUN_FLOOR, earnedFlow, intensity, intensityTerms, skillMult, type IntensityInput } from '../src/game/intensity';

// The groove curve: the band grooves from the first cruise, and skill, earned flow and the pack add
// layers; drafting alone never does.

const base = (o: Partial<IntensityInput> = {}): IntensityInput => ({
  speed: 0,
  mult: 1,
  skillChain: 0,
  earnedFlow: 0,
  raceNear: false,
  danger: 0,
  eventRolled: false,
  lift: 0,
  runTime: 10,
  countIn: false,
  ...o,
});

const near = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6);

describe('intensity', () => {
  it('anchors speed to measured novice cruising: 0.36 at 18 m/s, capped at 0.52 from 42 m/s', () => {
    near(intensityTerms(base({ speed: 8 })).speedK, 0);
    near(intensityTerms(base({ speed: 13 })).speedK, 0.18);
    near(intensityTerms(base({ speed: 18 })).speedK, 0.36);
    near(intensityTerms(base({ speed: 22 })).speedK, 0.36);
    near(intensityTerms(base({ speed: 42 })).speedK, 0.52);
    near(intensityTerms(base({ speed: 60 })).speedK, 0.52);
    near(intensity(base({ speed: 18 })), 0.36);
  });

  it('caps the skill multiplier at 10, one step per three skill events', () => {
    expect(skillMult(0)).toBe(1);
    expect(skillMult(2)).toBe(1);
    expect(skillMult(3)).toBe(2);
    expect(skillMult(27)).toBe(10);
    expect(skillMult(500)).toBe(10);
    expect(skillMult(-4)).toBe(1);
    near(intensityTerms(base({ skillChain: 27 })).skill, 0.22);
    near(intensityTerms(base({ skillChain: 500 })).skill, 0.22);
    near(intensityTerms(base({ skillChain: 6 })).skill, 0.22 * Math.log10(3));
  });

  it('leaves the skill and flow terms at 0 on a draft-only chain', () => {
    // Drafting fills the sim's flow to 6 and the sim's multiplier to x10, but earns nothing.
    const flow = earnedFlow(6, 0, 0);
    expect(flow).toBe(0);
    const t = intensityTerms(base({ speed: 24, mult: 10, skillChain: 0, earnedFlow: flow }));
    expect(t.skill).toBe(0);
    expect(t.flowK).toBe(0);
    // The sim multiplier alone moves nothing.
    near(intensity(base({ speed: 24, mult: 10 })), intensity(base({ speed: 24, mult: 1 })));
  });

  it('raises a 20 s draft-only stint by no more than the race term plus the speed it brings', () => {
    const before = base({ speed: 18, runTime: 10 });
    const after = base({ speed: 26, mult: 10, earnedFlow: earnedFlow(6, 0, 0), raceNear: true, runTime: 30 });
    const tb = intensityTerms(before);
    const ta = intensityTerms(after);
    expect(intensity(after) - intensity(before)).toBeLessThanOrEqual(ta.race + (ta.speedK - tb.speedK) + 1e-9);
  });

  it('earns flow with skill: a quarter per skill event plus half per perfect, never past the sim', () => {
    near(earnedFlow(6, 8, 0), 2);
    near(earnedFlow(6, 8, 2), 3);
    near(earnedFlow(1.5, 40, 4), 1.5);
    near(earnedFlow(9, 40, 4), 6);
    // Full at FLOW_FULL (3.5), where the glow peaks: an expert combo's flow is felt in the band too.
    near(intensityTerms(base({ earnedFlow: 6 })).flowK, 0.18);
    near(intensityTerms(base({ earnedFlow: FLOW_FULL })).flowK, 0.18);
    near(intensityTerms(base({ earnedFlow: 1.75 })).flowK, 0.09);
  });

  it('holds the boost term above 22 m/s at 0 while drafting or slung (the arp stays earned)', () => {
    // 31 m/s in the pack: the slipstream's speed alone stays under the arp's entry (0.48).
    const pack = intensity(base({ speed: 31, raceNear: true, drafting: true }));
    near(intensityTerms(base({ speed: 31, drafting: true })).speedK, 0.36);
    expect(pack).toBeLessThan(0.48);
    // The same speed out of the slipstream (earned by a drift boost, say) keeps its term.
    near(intensityTerms(base({ speed: 31 })).speedK, 0.36 + 0.16 * 0.45);
  });

  it('holds the run floor only from 2.5 s of run time', () => {
    near(intensity(base({ speed: 9, runTime: FLOOR_FROM - 0.01 })), 0.036);
    near(intensity(base({ speed: 9, runTime: FLOOR_FROM })), RUN_FLOOR);
    near(intensity(base({ speed: 0, runTime: 60 })), RUN_FLOOR);
    // Above the floor, the floor changes nothing.
    near(intensity(base({ speed: 18, runTime: 60 })), 0.36);
  });

  it('clamps to 0.25 while a chaos reveal counts the band in', () => {
    expect(intensity(base({ speed: 30, skillChain: 30, runTime: 1.5, countIn: true }))).toBe(COUNT_IN_MAX);
    expect(intensity(base({ speed: 30, runTime: 5, countIn: true }))).toBe(COUNT_IN_MAX);
    // Below the ceiling it is left alone.
    near(intensity(base({ speed: 10, runTime: 1, countIn: true })), 0.072);
  });

  it('adds the race, event, danger and lift terms, and clamps to 1', () => {
    const cruise = intensity(base({ speed: 18 }));
    near(intensity(base({ speed: 18, raceNear: true })) - cruise, 0.06);
    near(intensity(base({ speed: 18, eventRolled: true })) - cruise, 0.04);
    near(intensity(base({ speed: 18, danger: 0.5 })) - cruise, 0.175);
    near(intensity(base({ speed: 18, lift: 0.08 })) - cruise, 0.08);
    near(intensity(base({ speed: 18, lift: 0.28 })) - cruise, 0.28);
    expect(intensity(base({ speed: 50, skillChain: 40, earnedFlow: 6, raceNear: true, danger: 1, lift: 0.3 }))).toBe(1);
  });

  it('builds layer by layer with earned skill', () => {
    // Cruise alone: bass and hats (0.36). A x4 skill combo with some flow and the pack: the arp (0.58+).
    const cruise = intensity(base({ speed: 20 }));
    const skilled = intensity(base({ speed: 24, skillChain: 9, earnedFlow: 3, raceNear: true }));
    const peak = intensity(base({ speed: 32, skillChain: 27, earnedFlow: 6, raceNear: true }));
    expect(cruise).toBeGreaterThanOrEqual(0.34);
    expect(cruise).toBeLessThan(0.4);
    expect(skilled).toBeGreaterThan(0.58);
    expect(peak).toBeGreaterThan(0.85);
  });

  it('never returns NaN for missing or bad input', () => {
    const v = intensity(base({ speed: Number.NaN, skillChain: Number.NaN, earnedFlow: Number.NaN, danger: Number.NaN, lift: Number.NaN, runTime: Number.NaN }));
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(0);
  });
});
