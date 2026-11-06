import { describe, expect, it } from 'vitest';
import { BIG_DROP_S, CLIMAX_LIFT, STAGE_LIFT, buildLift, climaxK, openUp, stageIndex } from '../src/audio/cues';
import { finishRate } from '../src/render/moments';
import { NEAR_BANK, nearBank, sloughStart } from '../src/render/sloughs';
import { READ_S, TOP_SPEED, chaseBack, chaseFov, chaseRow, chaseUp, edgeK, fastK, flurryReach, kickK, lookLead, lookReach, nearK, roosterK, rumbleK, skimShare, speedK, streakK, windK } from '../src/render/speedfeel';
import { POST_CELL, POST_E_MAX, POST_E_MIN, POST_GAP, PostKind, placePost, postColours, postStretch, type PostCourse } from '../src/render/speedposts';
import { Color } from 'three';
import { MAX_SPEED, TUMBLE_TICKS } from '../src/sim/sim';
import { courseFor, FOREST_LIMIT } from '../src/sim/course';
import type { BiomeId } from '../src/sim/mountains';

// The feel lane's pure logic: every speed curve reaches to the cap and none runs out early, the posts
// stand where the corridor lets them, the banks shed only where they are banks, and the descent's
// arrangement climbs to the line.

const BIOMES: readonly BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom'];
const CURVES: Record<string, (v: number) => number> = { speedK, fastK, nearK, chaseFov, streakK, rumbleK, skimShare, kickK, roosterK, windK };

describe('speed curves', () => {
  it('uses the sim cap', () => {
    expect(TOP_SPEED).toBe(MAX_SPEED);
  });

  it('climbs without a dip all the way, and none is full before the cap', () => {
    for (const [name, f] of Object.entries(CURVES)) {
      let last = -Infinity;
      for (let v = 0; v <= TOP_SPEED; v += 0.5) {
        const y = f(v);
        expect(y, `${name} at ${v}`).toBeGreaterThanOrEqual(last - 1e-9);
        last = y;
      }
      // Still moving at the top of the range: 44 to 46 m/s reads as more.
      expect(f(46) - f(44), name).toBeGreaterThan(0);
      expect(f(44) - f(41), name).toBeGreaterThan(0);
    }
    expect(edgeK(46) - edgeK(44)).toBeGreaterThan(0);
  });

  it('holds still past the cap, as the sim does', () => {
    for (const [name, f] of Object.entries(CURVES)) expect(f(60), name).toBeCloseTo(f(TOP_SPEED), 9);
  });

  it('feels fast at 28 m/s and leaves room above it', () => {
    expect(fastK(15)).toBeCloseTo(0, 6);
    expect(fastK(28)).toBeGreaterThanOrEqual(0.58);
    expect(fastK(28)).toBeLessThan(0.65);
    expect(fastK(TOP_SPEED)).toBeCloseTo(1, 6);
    expect(edgeK(36)).toBeCloseTo(0, 6);
    expect(streakK(28)).toBeGreaterThan(0.1);
    expect(rumbleK(28)).toBeGreaterThan(0.15);
  });

  it('keeps the lens where the hazard read wants it', () => {
    expect(chaseFov(10)).toBeLessThan(63);
    expect(chaseFov(30)).toBeGreaterThan(72);
    expect(chaseFov(30)).toBeLessThan(74.5);
    expect(chaseFov(TOP_SPEED)).toBeLessThanOrEqual(79.01);
    // It rises with speed, never into the snow, and the rider sinks to open the road above it.
    expect(chaseUp(44)).toBeGreaterThan(chaseUp(30));
    expect(chaseUp(30)).toBeGreaterThan(1.4);
    expect(chaseRow(44)).toBeLessThan(chaseRow(20));
    expect(chaseBack(44)).toBeLessThan(chaseBack(22));
    // The look reaches the 1.5 s the brief asks for.
    expect(READ_S).toBe(1.5);
    expect(lookReach(30)).toBeCloseTo(45, 6);
    expect(lookReach(44)).toBeCloseTo(66, 6);
    expect(lookLead(44)).toBeGreaterThan(lookLead(22));
  });

  it('hangs flakes in air the lens has not yet passed', () => {
    expect(flurryReach(20)).toBe(13);
    expect(flurryReach(TOP_SPEED)).toBeCloseTo(23, 6);
  });
});

/** A plain corridor: straight, 12 m half width, banks rising from the edge. */
function corridor(over: Partial<PostCourse> = {}): PostCourse {
  const c: PostCourse = {
    centerX: () => 100,
    halfWidth: () => 12,
    edgeExcess: (x) => Math.abs(x - 100) - 12,
    edgeLimit: () => FOREST_LIMIT,
    ground: (x) => {
      const e = Math.abs(x - 100) - 12;
      return e > 0 ? 0.16 * e * e : 0;
    },
    ...over,
  };
  return c;
}

describe('speed posts', () => {
  it('stands just past the edge on both sides', () => {
    const c = corridor();
    for (const side of [-1, 1] as const) {
      for (const e of [POST_E_MIN, 1.7, POST_E_MAX]) {
        const p = placePost(c, 500, side, e);
        expect(p).not.toBeNull();
        expect(p!.e).toBeCloseTo(e, 6);
        expect(Math.sign(p!.x - 100)).toBe(side);
        expect(p!.y).toBeGreaterThan(0);
      }
    }
  });

  it('never reaches past something solid at the edge', () => {
    // A street's wall 2 m out: the post stops short of it.
    const street = corridor({ edgeLimit: () => 2 });
    const p = placePost(street, 500, 1, POST_E_MAX);
    expect(p).not.toBeNull();
    expect(p!.e).toBeLessThanOrEqual(1.6 + 1e-6);
    // Hard up against the corridor there is no room for one at all.
    expect(placePost(corridor({ edgeLimit: () => 0.9 }), 500, 1, POST_E_MAX)).toBeNull();
  });

  it('skips where the ground past the edge falls away', () => {
    // A ravine or a bridge: the ground drops off the corridor's edge.
    const ravine = corridor({ ground: (x) => (Math.abs(x - 100) > 12 ? -3 * (Math.abs(x - 100) - 12) : 0) });
    expect(placePost(ravine, 500, 1, 1.5)).toBeNull();
    expect(placePost(ravine, 500, -1, 1.5)).toBeNull();
    // A lip: level at the post, gone a metre and a half on.
    const lip = corridor({ ground: (x) => (Math.abs(x - 100) > 14 ? -2 : 0) });
    expect(placePost(lip, 500, 1, 1.5)).toBeNull();
  });

  it('spaces each kind for a strobe at speed', () => {
    for (const k of [PostKind.Stake, PostKind.Pole, PostKind.Flag, PostKind.Fence]) {
      const [a, b] = POST_GAP[k];
      expect(a).toBeGreaterThanOrEqual(10);
      expect(b).toBeLessThanOrEqual(18);
    }
    const seen = new Set<PostKind>();
    for (const b of BIOMES) {
      for (let cell = 0; cell < 200; cell++) {
        const s = postStretch(77, b, cell);
        const [lo, hi] = POST_GAP[s.kind];
        expect(s.gap).toBeGreaterThanOrEqual(lo);
        expect(s.gap).toBeLessThanOrEqual(hi);
        expect(s.from).toBeLessThan(POST_CELL);
        seen.add(s.kind);
        expect(postStretch(77, b, cell)).toEqual(s);
      }
    }
    expect(seen.size).toBe(4);
  });

  it('holds on a real course: all past the edge, inside the limit', () => {
    const c = courseFor(1234);
    let placed = 0;
    for (let z = 100; z < 2000; z += 13) {
      for (const side of [-1, 1] as const) {
        const p = placePost(c, z, side, 2);
        if (!p) continue;
        placed++;
        expect(p.e).toBeGreaterThan(POST_E_MIN - 0.2);
        expect(p.e).toBeLessThan(c.edgeLimit(z));
      }
    }
    expect(placed).toBeGreaterThan(200);
  });

  it('borrows no locked colour role', () => {
    const locked = ['#FF4D2E', '#FFD34D', '#8FF3E4', '#FF5A7A', '#FFE08A', '#FF8A5C'].map((h) => new Color(h));
    const hsl = { h: 0, s: 0, l: 0 };
    for (const hex of postColours()) {
      const c = new Color(hex);
      for (const l of locked) expect(Math.hypot(c.r - l.r, c.g - l.g, c.b - l.b), hex).toBeGreaterThan(0.3);
      c.getHSL(hsl);
      // Slim and light: never a dark hazard.
      expect(hsl.l, hex).toBeGreaterThan(0.25);
    }
  });
});

describe('sloughs', () => {
  const stub = (limit = FOREST_LIMIT, rise = 1) => ({
    centerX: () => 100,
    halfWidth: () => 12,
    edgeExcess: (x: number) => Math.abs(x - 100) - 12,
    edgeLimit: () => limit,
    ground: (x: number) => {
      const e = Math.abs(x - 100) - 12;
      return e > 0 ? rise * 0.16 * e * e : 0;
    },
  });

  it('knows which bank a rider is near', () => {
    const c = stub();
    expect(nearBank(c, 100, 0)).toBeNull();
    expect(nearBank(c, 100 + 12 - NEAR_BANK - 0.5, 0)).toBeNull();
    expect(nearBank(c, 100 + 12 - NEAR_BANK + 0.5, 0)?.side).toBe(1);
    expect(nearBank(c, 100 - 12 + 1, 0)?.side).toBe(-1);
  });

  it('starts only on a real bank', () => {
    expect(sloughStart(stub(), 500, 1, 7)).toBe(7);
    // No bank: a ravine, a bridge.
    expect(sloughStart(stub(FOREST_LIMIT, -1), 500, 1, 7)).toBeNull();
    // A wall close in: no room to run.
    expect(sloughStart(stub(3), 500, 1, 7)).toBeNull();
    // Further out a wall only shortens it.
    expect(sloughStart(stub(6), 500, 1, 7)).toBeCloseTo(5.4, 6);
  });
});

describe('the finish', () => {
  it('eases render time down and all the way back', () => {
    expect(finishRate(0)).toBeCloseTo(1, 6);
    expect(finishRate(0.5)).toBeCloseTo(0.38, 6);
    expect(finishRate(1)).toBeCloseTo(0.38, 6);
    expect(finishRate(2.2)).toBeCloseTo(1, 6);
    expect(finishRate(9)).toBeCloseTo(1, 6);
    for (let t = 0; t < 3; t += 0.05) {
      expect(finishRate(t)).toBeGreaterThan(0.3);
      expect(finishRate(t)).toBeLessThanOrEqual(1);
    }
  });

  it('knows a tumble is the sim\'s length', () => {
    expect(TUMBLE_TICKS / 60).toBeCloseTo(1.1, 6);
  });
});

describe('the descent in the band', () => {
  const stages = [
    { z0: 0, z1: 1450 },
    { z0: 1450, z1: 2950 },
    { z0: 2950, z1: 4500 },
  ];

  it('finds the stage', () => {
    expect(stageIndex(0, stages)).toBe(0);
    expect(stageIndex(1449, stages)).toBe(0);
    expect(stageIndex(1450, stages)).toBe(1);
    expect(stageIndex(4499, stages)).toBe(2);
    expect(stageIndex(4600, stages)).toBe(2);
    expect(stageIndex(10, [])).toBe(0);
  });

  it('climbs only in the last stage, to the line', () => {
    expect(climaxK(1000, stages)).toBe(0);
    expect(climaxK(2960, stages)).toBe(0);
    expect(climaxK(4500, stages)).toBeCloseTo(1, 6);
    expect(climaxK(4800, stages)).toBeCloseTo(1, 6);
    let last = 0;
    for (let z = 2950; z <= 4500; z += 25) {
      const k = climaxK(z, stages);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
    }
  });

  it('lifts a plain cruise through the arrangement: the arp by the last stage, the kick at the climax', () => {
    const CRUISE = 0.36;
    expect(buildLift(0, 0)).toBe(0);
    expect(buildLift(1, 0)).toBe(STAGE_LIFT[1]);
    expect(CRUISE + buildLift(2, 0)).toBeGreaterThan(0.48); // into the arp
    expect(CRUISE + buildLift(2, 0)).toBeLessThan(0.54); // short of the kick
    expect(CRUISE + buildLift(2, 1)).toBeGreaterThan(0.6); // into the kick
    expect(CRUISE + buildLift(2, 1)).toBeLessThan(0.72); // the clap and sparkle stay earned by skill
    expect(buildLift(2, 1)).toBeCloseTo(STAGE_LIFT[2] + CLIMAX_LIFT, 9);
    expect(buildLift(9, 0)).toBe(STAGE_LIFT[2]);
  });

  it('opens up on a stomp streak or earned flow, and on nothing else', () => {
    expect(openUp(0, 0)).toBe(0);
    expect(openUp(undefined, undefined)).toBe(0);
    expect(openUp(0, 2)).toBe(0);
    expect(openUp(0, 3)).toBeGreaterThan(0.4);
    expect(openUp(0, 5)).toBe(1);
    expect(openUp(0, 9)).toBe(1);
    expect(openUp(0.1, 0)).toBe(0);
    expect(openUp(0.7, 0)).toBeCloseTo(1, 6);
    expect(openUp(NaN, 0)).toBe(0);
  });

  it('calls a touchdown a big drop only after a real flight', () => {
    expect(BIG_DROP_S).toBeGreaterThan(1.4);
    expect(BIG_DROP_S).toBeLessThan(2);
  });
});
