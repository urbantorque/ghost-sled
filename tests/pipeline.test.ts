import { describe, expect, it } from 'vitest';
import { cine, resetCine } from '../src/render/cine';
import { CINE_EPS, PASSES, SWITCH_NAMES, TIERS, allSwitches, detailOf, letterboxShare, parseSwitches, planFrame, wantsDepth, type FrameSignals, type PassSettings, type Tier } from '../src/render/postfx/tiers';

// The frame's passes without a GPU: every tier has a full row, Low runs nothing, and the camera's cine
// state at rest (cine.ts) schedules no pass at all. post.ts runs exactly the plan these functions return.

const ON = allSwitches(true);
const rest = (over: Partial<FrameSignals> = {}): FrameSignals => ({ post: true, dof: 0, motionBlur: 0, letterbox: 0, shafts: 0, reduced: false, ...over });
const fromCine = (over: Partial<FrameSignals> = {}): FrameSignals => rest({ dof: cine.dof, motionBlur: cine.motionBlur, letterbox: cine.letterbox, ...over });

describe('the tier tables', () => {
  it('has a complete row of passes for every tier, Ultra included', () => {
    const keys: Array<keyof PassSettings> = ['ao', 'contact', 'shaftTaps', 'shaftDiv', 'dofTaps', 'blurTaps', 'mirror', 'taa', 'shadowReach'];
    expect([...TIERS]).toEqual(['low', 'medium', 'high', 'ultra']);
    for (const t of TIERS) {
      const p = PASSES[t];
      expect(p, t).toBeDefined();
      for (const k of keys) expect(p[k], `${t}.${k}`).not.toBeUndefined();
      expect(Object.keys(p).sort(), t).toEqual([...keys].sort());
    }
  });

  it('dresses Ultra as High, and every other tier as itself', () => {
    expect(detailOf('ultra')).toBe('high');
    for (const t of ['low', 'medium', 'high'] as const) expect(detailOf(t)).toBe(t);
  });

  it('never gives a lower tier more than the one above it', () => {
    const rank = (p: PassSettings) => [p.ao === 'off' ? 0 : p.ao === 'lite' ? 1 : 2, p.contact ? 1 : 0, p.shaftTaps * p.shaftTaps * (16 / (p.shaftDiv * p.shaftDiv)), p.dofTaps, p.blurTaps, p.mirror === 'sky' ? 0 : p.mirror === 'bake' ? 1 : 2, p.shadowReach];
    for (let i = 1; i < TIERS.length; i++) {
      const lo = rank(PASSES[TIERS[i - 1]]);
      const hi = rank(PASSES[TIERS[i]]);
      for (let k = 0; k < lo.length; k++) expect(hi[k], `${TIERS[i]} row ${k}`).toBeGreaterThanOrEqual(lo[k]);
    }
  });

  it('turns every pass off on Low', () => {
    const p = PASSES.low;
    expect(p.ao).toBe('off');
    expect(p.contact).toBe(false);
    expect(p.shaftTaps).toBe(0);
    expect(p.dofTaps).toBe(0);
    expect(p.blurTaps).toBe(0);
    expect(p.mirror).toBe('sky');
    expect(p.taa).toBe(false);
    expect(wantsDepth(p, ON)).toBe(false);
    // Whatever the camera and the light ask for, Low draws none of it.
    const loud = rest({ dof: 1, motionBlur: 1, letterbox: 1, shafts: 1 });
    for (const post of [false, true]) {
      const plan = planFrame(p, ON, { ...loud, post });
      expect(plan.added).toBe(0);
      expect(plan.depth).toBe(false);
      expect(plan.ao || plan.contact || plan.shafts || plan.dof || plan.blur || plan.lens).toBe(false);
    }
  });

  it('keeps Medium to the shafts: no occlusion, no lens pass', () => {
    const plan = planFrame(PASSES.medium, ON, rest({ dof: 1, motionBlur: 1, shafts: 1 }));
    expect(plan.shafts).toBe(true);
    expect(plan.ao || plan.dof || plan.blur || plan.lens).toBe(false);
  });
});

describe('the cine contract', () => {
  it('costs nothing at rest: no depth of field, no motion blur, no lens pass, no letterbox', () => {
    resetCine();
    expect(cine.dof).toBe(0);
    expect(cine.motionBlur).toBe(0);
    expect(cine.letterbox).toBe(0);
    for (const t of TIERS) {
      const p = PASSES[t];
      const plan = planFrame(p, ON, fromCine());
      expect(plan.dof, t).toBe(false);
      expect(plan.blur, t).toBe(false);
      expect(plan.lens, t).toBe(false);
      expect(plan.letterbox, t).toBe(0);
      // What is left is the tier's standing passes and nothing else.
      const standing = planFrame(p, { ...ON, dof: false, blur: false, letterbox: false }, rest({ dof: 1, motionBlur: 1, letterbox: 1 }));
      expect(plan.added, t).toBe(standing.added);
    }
  });

  it('draws a beat only on the tiers that have its pass, and only while the beat is on', () => {
    const beat = rest({ dof: 0.8, motionBlur: 0.6, letterbox: 1 });
    const added = (t: Tier, f: FrameSignals) => planFrame(PASSES[t], ON, f).added;
    for (const t of ['high', 'ultra'] as const) {
      const plan = planFrame(PASSES[t], ON, beat);
      expect(plan.dof && plan.blur && plan.lens, t).toBe(true);
      expect(plan.depth, t).toBe(true);
      expect(plan.letterbox, t).toBeGreaterThan(0.1);
      expect(added(t, beat) - added(t, rest()), t).toBe(3);
      // A value under the rest threshold is rest.
      expect(added(t, rest({ dof: CINE_EPS / 2, motionBlur: CINE_EPS / 2 })), t).toBe(added(t, rest()));
    }
    expect(planFrame(PASSES.medium, ON, beat).lens).toBe(false);
  });

  it('turns motion blur off under reduced motion and keeps the rest of the beat', () => {
    const plan = planFrame(PASSES.ultra, ON, rest({ dof: 1, motionBlur: 1, letterbox: 1, reduced: true }));
    expect(plan.blur).toBe(false);
    expect(plan.dof).toBe(true);
    expect(plan.letterbox).toBeGreaterThan(0);
  });

  it('blurs nothing behind a lens that is not moving', () => {
    expect(planFrame(PASSES.ultra, ON, rest({ motionBlur: 1, motionPx: 0.1 })).blur).toBe(false);
    expect(planFrame(PASSES.ultra, ON, rest({ motionBlur: 1, motionPx: 6 })).blur).toBe(true);
  });

  it('letterboxes a wide frame to 2.39:1 at most, and a portrait one not at all', () => {
    expect(letterboxShare(1, 16 / 9)).toBeCloseTo((1 - 16 / 9 / 2.39) / 2, 5);
    expect(letterboxShare(0.5, 16 / 9)).toBeCloseTo((1 - 16 / 9 / 2.39) / 4, 5);
    expect(letterboxShare(1, 2.39)).toBe(0);
    expect(letterboxShare(1, 21 / 9)).toBeLessThan(0.02);
    expect(letterboxShare(1, 390 / 844)).toBe(0);
    expect(letterboxShare(0, 16 / 9)).toBe(0);
    expect(letterboxShare(1, 4 / 3)).toBeLessThanOrEqual(0.13);
  });
});

describe('the ?post= switch', () => {
  it('reads as everything on when absent', () => {
    for (const spec of [null, undefined, '', 'all']) expect(parseSwitches(spec)).toEqual(ON);
  });

  it('turns everything off for none, which is the stack of round 6', () => {
    const off = parseSwitches('none');
    for (const k of SWITCH_NAMES) expect(off[k], k).toBe(false);
    for (const t of TIERS) {
      const plan = planFrame(PASSES[t], off, rest({ dof: 1, motionBlur: 1, letterbox: 1, shafts: 1 }));
      expect(plan.added, t).toBe(0);
      expect(plan.depth, t).toBe(false);
      expect(wantsDepth(PASSES[t], off), t).toBe(false);
    }
  });

  it('keeps only the names listed, or drops the names with a minus', () => {
    const only = parseSwitches('ao,shafts');
    expect(only.ao && only.shafts).toBe(true);
    expect(only.dof || only.blur || only.mirror || only.contact).toBe(false);
    const drop = parseSwitches('-ao, -blur');
    expect(drop.ao || drop.blur).toBe(false);
    expect(drop.shafts && drop.dof && drop.mirror).toBe(true);
    expect(parseSwitches('nonsense,-also')).toEqual(ON);
  });

  it('takes a pass out of the plan when its switch is off', () => {
    const f = rest({ dof: 1, motionBlur: 1, shafts: 1 });
    const full = planFrame(PASSES.ultra, ON, f);
    expect(full.ao && full.contact && full.shafts && full.dof && full.blur).toBe(true);
    expect(planFrame(PASSES.ultra, parseSwitches('-ao'), f).contact).toBe(false);
    expect(planFrame(PASSES.ultra, parseSwitches('-shafts'), f).added).toBe(full.added - 2);
    expect(planFrame(PASSES.ultra, parseSwitches('-dof,-blur'), f).lens).toBe(false);
  });
});
