import { describe, expect, it } from 'vitest';
import { MISSIONS, MissionState, RunSummary, applyRun, cycleOrder, missionDef, missionTier, missionViews, newMissionState, topUp, unlockedBiomes } from '../src/game/missions';
import { missionsCrossed } from '../src/game/progress';
import { SaveStore, defaultSave } from '../src/game/save';
import { hashString } from '../src/sim/prng';

function summary(p: Partial<RunSummary> = {}): RunSummary {
  return {
    mountain: 'pinecrest',
    biome: 'alpine',
    score: 0,
    distance: 0,
    gifts: 0,
    perfects: 0,
    maxAirtime: 0,
    maxHalfTurns: 0,
    flips: 0,
    driftSeconds: 0,
    draftSeconds: 0,
    nearMisses: 0,
    bestCombo: 0,
    maxSpeed: 0,
    smashes: 0,
    gates: 0,
    yetiHop: false,
    outranAvalanche: false,
    ghostsPassed: 0,
    grudgeBeaten: false,
    chaos: false,
    ...p,
  };
}

class MemStorage {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

const L = MISSIONS.length;
const ALL = { unlockedBiomes: new Set(['alpine', 'glacier', 'volcanic', 'blossom']) };

/** The ids the rotation visits at cursors [from, to). */
function visited(seed: number, from: number, to: number): string[] {
  const out: string[] = [];
  for (let c = from; c < to; c++) out.push(MISSIONS[cycleOrder(seed, Math.floor(c / L))[c % L]].id);
  return out;
}

/** Fills one slot at a time (two placeholders hold the others) until the cursor reaches `until`,
 *  returning the ids in the order the rotation handed them out. */
function drain(s: MissionState, ctx: { unlockedBiomes: ReadonlySet<string> }, until: number): string[] {
  const out: string[] = [];
  while (s.cursor < until) {
    s.active = [
      { id: '_a', best: 0 },
      { id: '_b', best: 0 },
    ];
    topUp(s, ctx);
    if (s.active[2]) out.push(s.active[2].id);
  }
  return out;
}

describe('missions', () => {
  it('always keeps three distinct missions active', () => {
    const s = newMissionState();
    expect(s.active).toHaveLength(3);
    expect(new Set(s.active.map((a) => a.id)).size).toBe(3);
  });

  it('a fresh save starts on the onboarding trio', () => {
    expect(defaultSave('Anyone').missions.active.map((a) => a.id)).toEqual(['dist800', 'perfect2', 'pass1']);
  });

  it('completing a mission pays its reward and rotates in a new one', () => {
    const s = newMissionState();
    const first = s.active[0].id;
    const def = MISSIONS.find((m) => m.id === first)!;
    const r = applyRun(s, summary({ distance: 99999, perfects: 99, ghostsPassed: 9 }));
    expect(r.reward).toBeGreaterThanOrEqual(def.reward);
    expect(s.active).toHaveLength(3);
    expect(s.active.map((a) => a.id)).not.toContain(first);
    expect(r.views.find((v) => v.id === first)?.justCompleted).toBe(true);
  });

  it('progress is the best single run, not a running total', () => {
    const s = newMissionState();
    s.active = [{ id: 'gifts20', best: 0 }];
    applyRun(s, summary({ gifts: 12 }));
    expect(s.active.find((a) => a.id === 'gifts20')?.best).toBe(12);
    applyRun(s, summary({ gifts: 9 }));
    expect(s.active.find((a) => a.id === 'gifts20')?.best).toBe(12);
  });

  it('biome missions only count on their biome', () => {
    const s = newMissionState();
    s.active = [{ id: 'gates3', best: 0 }];
    const r = applyRun(s, summary({ gates: 5, biome: 'alpine' }));
    expect(r.reward).toBe(0);
    const r2 = applyRun(s, summary({ gates: 5, biome: 'blossom' }));
    expect(r2.reward).toBeGreaterThan(0);
  });
});

describe('mission rotation', () => {
  it('each cycle is a permutation of every mission, shuffled per cycle', () => {
    const ids = MISSIONS.map((m) => m.id).sort();
    for (const seed of [1, 0xdeadbeef, hashString('Mila')]) {
      const orders: string[] = [];
      for (let cycle = 0; cycle < 5; cycle++) {
        const v = visited(seed, cycle * L, (cycle + 1) * L);
        expect([...v].sort()).toEqual(ids);
        orders.push(v.join());
      }
      // Shuffled: the cycles do not all repeat one order.
      expect(new Set(orders).size).toBeGreaterThan(1);
    }
  });

  it('the first cycle opens on the onboarding trio and later cycles are shuffled', () => {
    expect(visited(42, 0, 3)).toEqual(['dist800', 'perfect2', 'pass1']);
    const later = [1, 2, 3, 4].map((c) => visited(42, c * L, c * L + 3).join());
    expect(later.some((o) => o !== 'dist800,perfect2,pass1')).toBe(true);
  });

  it('a name change after the first fill never reorders the cycle (the seed is captured once)', () => {
    // An old save with no captured seed, part way through its first cycle.
    const old = defaultSave('Mila');
    const store0 = new MemStorage();
    old.missions = { active: [{ id: 'pass1', best: 0 }], cursor: 5, completed: 2 };
    store0.setItem('ghostsled.save.v1', JSON.stringify(old));
    const a = new SaveStore(store0, 'Fallback');
    const seed = a.data.missions.seed!;
    expect(seed).toBe(hashString('Mila'));
    const order = cycleOrder(seed, 0).join();
    // The platform username arrives and replaces the name; the save is written and read back.
    a.data.name = 'SomebodyElse';
    a.flush();
    const b = new SaveStore(store0, 'Fallback2');
    expect(b.data.missions.seed).toBe(seed);
    expect(cycleOrder(b.data.missions.seed!, 0).join()).toBe(order);
    // The rotation carries on exactly where it stopped.
    const s = b.data.missions;
    const c = s.cursor;
    s.active = [];
    topUp(s, ALL);
    expect(s.active.map((x) => x.id)).toEqual(visited(seed, c, c + 3));
  });

  it('a biome mission is skipped while its mountain is locked and returns in a later cycle', () => {
    const s: MissionState = { active: [], cursor: 0, completed: 0, seed: 7 };
    const alpineOnly = { unlockedBiomes: unlockedBiomes(0) };
    expect([...alpineOnly.unlockedBiomes]).toEqual(['alpine']);
    const cycle0 = drain(s, alpineOnly, L);
    expect(cycle0).not.toContain('gates3');
    expect(cycle0).toContain('smash3');
    // Sakura opens (24 passes): gates3 comes back in the next cycle.
    const cycle1 = drain(s, { unlockedBiomes: unlockedBiomes(24) }, 2 * L);
    expect(cycle1).toContain('gates3');
  });

  it('an unknown mission id is dropped without throwing', () => {
    const s: MissionState = { active: [{ id: 'retired-mission', best: 3 }, { id: 'pass1', best: 0 }], cursor: 3, completed: 0, seed: 9 };
    expect(() => missionViews(s)).not.toThrow();
    expect(missionViews(s).map((v) => v.id)).toEqual(['pass1']);
    const r = applyRun(s, summary({ ghostsPassed: 0 }));
    expect(r.views.map((v) => v.id)).toEqual(['pass1']);
    expect(s.active.map((a) => a.id)).not.toContain('retired-mission');
    expect(s.active).toHaveLength(3);
  });
});

describe('mission tiers', () => {
  const def = (id: string) => missionDef(id)!;

  it('tier text, targets and rewards per metric', () => {
    expect(missionTier(def('dist800'), 2)).toEqual({ tier: 2, text: 'Ride 1,600 m in one run (II)', target: 1600, reward: 40 });
    expect(missionTier(def('dist800'), 3)).toEqual({ tier: 3, text: 'Ride 3,200 m in one run (III)', target: 3200, reward: 55 });
    expect(missionTier(def('score12k'), 2)).toMatchObject({ text: 'Score 24,000 in one run (II)', target: 24000, reward: 90 });
    expect(missionTier(def('combo3k'), 3)).toMatchObject({ text: 'Bank a 12,000 point combo (III)', target: 12000 });
    expect(missionTier(def('perfect2'), 2)).toMatchObject({ text: 'Land 3 perfect landings (II)', target: 3, reward: 45 });
    expect(missionTier(def('pass1'), 2)).toMatchObject({ text: 'Pass 2 ghosts in one run (II)', target: 2 });
    expect(missionTier(def('flip1'), 3)).toMatchObject({ text: 'Land 3 backflips in one run (III)', target: 3 });
    expect(missionTier(def('spin360'), 2)).toMatchObject({ text: 'Land a 540 spin (II)', target: 3 });
    expect(missionTier(def('air15'), 2)).toMatchObject({ text: 'Get 2 seconds of air (II)', target: 2 });
    // Ceilings keep a tier III ridable.
    expect(missionTier(def('dist4000'), 3)).toMatchObject({ target: 6000, text: 'Ride 6,000 m in one run (III)' });
    expect(missionTier(def('score40k'), 3).target).toBe(100000);
    // The grudge mission cannot grow, so it stays tier I.
    expect(missionTier(def('grudge'), 3)).toEqual({ tier: 1, text: 'Beat your grudge ghost', target: 1, reward: 60 });
  });

  it('an old save without tiers reads as tier I', () => {
    expect(missionTier(def('dist800'), undefined)).toEqual({ tier: 1, text: 'Ride 800 m in one run', target: 800, reward: 25 });
    const s: MissionState = { active: [{ id: 'dist800', best: 0 }], cursor: 50, completed: 0, seed: 3 };
    expect(missionViews(s)[0]).toMatchObject({ text: 'Ride 800 m in one run', target: 800, reward: 25 });
  });

  it('entries filled from the second cycle on carry their tier, and applyRun pays the tiered reward', () => {
    const s: MissionState = { active: [], cursor: L, completed: 0, seed: 11 };
    topUp(s, ALL);
    for (const a of s.active) expect(a.tier ?? 1).toBe(def(a.id).grow ? 2 : 1);
    const s3: MissionState = { active: [], cursor: 5 * L, completed: 0, seed: 11 };
    topUp(s3, ALL);
    for (const a of s3.active) expect(a.tier ?? 1).toBe(def(a.id).grow ? 3 : 1);
    const t: MissionState = { active: [{ id: 'dist800', best: 0, tier: 2 }], cursor: L, completed: 0, seed: 11 };
    expect(applyRun(t, summary({ distance: 1200 })).reward).toBe(0);
    const r = applyRun(t, summary({ distance: 1650 }));
    expect(r.reward).toBe(40);
    expect(r.views[0].text).toBe('Ride 1,600 m in one run (II)');
  });
});

describe('mid-run mission pops (missionsCrossed)', () => {
  it('returns each newly met mission once, on its biome, at its tier', () => {
    const s: MissionState = { active: [{ id: 'pass1', best: 0 }, { id: 'gates3', best: 0 }, { id: 'dist800', best: 0, tier: 2 }], cursor: 0, completed: 0, seed: 1 };
    const ctx = { unlockedBiomes: unlockedBiomes(30) };
    const popped = new Set<string>();
    expect(missionsCrossed(s, summary({ ghostsPassed: 0, distance: 900 }), popped, ctx)).toEqual([]);
    const a = missionsCrossed(s, summary({ ghostsPassed: 1, distance: 900, gates: 4 }), popped, ctx);
    expect(a).toEqual([{ id: 'pass1', text: 'Pass a ghost', reward: 25 }]);
    for (const x of a) popped.add(x.id);
    expect(missionsCrossed(s, summary({ ghostsPassed: 2, distance: 1000 }), popped, ctx)).toEqual([]);
    expect(missionsCrossed(s, summary({ ghostsPassed: 2, distance: 1700 }), popped, ctx)).toEqual([{ id: 'dist800', text: 'Ride 1,600 m in one run (II)', reward: 40 }]);
    expect(missionsCrossed(s, summary({ biome: 'blossom', gates: 3 }), popped, ctx).map((x) => x.id)).toEqual(['gates3']);
  });

  it('never mutates the mission state', () => {
    const s = newMissionState();
    const before = JSON.stringify(s);
    missionsCrossed(s, summary({ distance: 5000, perfects: 9, ghostsPassed: 9 }), new Set(), { unlockedBiomes: unlockedBiomes(0) });
    expect(JSON.stringify(s)).toBe(before);
  });
});
