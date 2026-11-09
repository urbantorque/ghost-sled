import { describe, expect, it } from 'vitest';
import { emptyMastery, masteryBoard, settleMastery } from '../src/game/mastery';
import { planMarquee } from '../src/game/marquee';
import { courseFor } from '../src/sim/course';
import { RING_ID0, fallPace, fallZ, machineZ, momentPlays, planMoments } from '../src/sim/moments';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { Sim } from '../src/sim/sim';

// Set pieces (round 6, DECISIONS 240): each mountain's three biggest places, one a stage, each with a verb the
// sim plays, so every rider and every replay meets the same moment.

const VERBS: Record<string, string[]> = {
  pinecrest: ['rings', 'race', 'gates'],
  frostfang: ['collapse', 'race', 'gates'],
  ember: ['race', 'rings', 'gates'],
  sakura: ['steps', 'rings', 'gates'],
};

/** Rides the safe line, steering at each of the set piece's gates (the debug steerer the lab grew from). */
function rideAtGates(seed: number, ticks = 300 * 60): Sim {
  const sim = new Sim({ seed, chaos: { mood: 0, event: 0, seed: 0x1234 }, sled: 0 });
  const c = sim.course;
  while (!sim.finished && !sim.s.crashed && sim.tick < ticks) {
    const s = sim.s;
    let tx = c.safeX(s.z + 20);
    const p = sim.plays.find((q) => q.verb === 'gates' && s.z > q.z0 - 60 && s.z < q.z1);
    const g = p?.gates.find((q) => q.z > s.z + 1);
    if (g) tx = g.x;
    const look = s.z + 4 + s.speed * 0.35;
    const err = Math.atan2(tx - s.x, look - s.z) - s.velHeading;
    sim.step(Math.max(0, Math.min(8, Math.round(4 + err * 14))));
  }
  return sim;
}

describe('set pieces', () => {
  it('names three on every named mountain, one a stage, each with its own verb', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const list = planMoments(c);
      expect(list.map((p) => p.verb), m.id).toEqual(VERBS[m.id]);
      expect(list.map((p) => p.stage), m.id).toEqual([0, 1, 2]);
      for (const p of list) {
        expect(p.z1).toBeGreaterThan(p.z0 + 100);
        expect(p.z1).toBeLessThanOrEqual(c.finishZ);
      }
      // About 45 s apart at a cruise (and never within 900 m of each other).
      for (let i = 1; i < list.length; i++) expect(list[i].z0 - list[i - 1].z0).toBeGreaterThan(900);
    }
  });

  it('gives a Daily three too, one a stage, with no verb twice where the stage allows', () => {
    for (const k of ['2026-11-08', '2026-11-10', '2026-12-01', '2027-03-14']) {
      const list = planMoments(courseFor(dailySeed(k)));
      expect(list.length, k).toBeGreaterThanOrEqual(2);
      expect(new Set(list.map((p) => p.stage)).size).toBe(list.length);
    }
  });

  it('holds what each verb needs, and the marquee carries the same list', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const plays = momentPlays(c);
      for (const p of plays) {
        if (p.verb === 'gates') {
          expect(p.gates.length, `${m.id} ${p.key}`).toBeGreaterThanOrEqual(4);
          for (let i = 1; i < p.gates.length; i++) expect(Math.sign(p.gates[i].x - c.safeX(p.gates[i].z))).toBe(-Math.sign(p.gates[i - 1].x - c.safeX(p.gates[i - 1].z)));
        }
        if (p.verb === 'rings') {
          expect(p.rings.length).toBe(3);
          // The ring line is in the course's one list of rings, tagged with its set piece.
          for (const r of p.rings) expect(c.skyGates.some((g) => g.id === r.id && g.moment === p.index && g.id >= RING_ID0)).toBe(true);
        }
        if (p.verb === 'steps') expect(p.steps.length).toBe(4);
      }
      expect(planMarquee(c).map((q) => q.key)).toEqual(plays.map((p) => p.key));
      // The stage gates are still one a stage, none of them a set piece's ring.
      expect(c.stageGates.every((g) => g.moment === undefined)).toBe(true);
    }
  });

  it('runs the race machine and the fall on schedules of their own, the same every time', () => {
    const c = courseFor(MOUNTAINS[0].seed);
    const race = momentPlays(c).find((p) => p.verb === 'race')!;
    let last = -Infinity;
    for (let t = 0; t < 60 * 20; t += 30) {
      const z = machineZ(race, t);
      expect(z).toBeGreaterThanOrEqual(last);
      last = z;
    }
    expect(machineZ(race, 0)).toBe(race.z0 + race.lead);
    // It arrives at the far end at its average pace.
    const T = ((race.z1 - race.z0 - race.lead) / race.pace) * 60;
    expect(machineZ(race, Math.ceil(T))).toBeCloseTo(race.z1, 3);
    const span = momentPlays(courseFor(MOUNTAINS[1].seed)).find((p) => p.verb === 'collapse')!;
    expect(fallPace(span, 20)).toBe(span.pace);
    expect(fallPace(span, 44)).toBeGreaterThan(span.pace);
    expect(fallZ(span, 60, 30)).toBeCloseTo(span.z0 - span.lead + 30, 6);
  });

  it('decides a set piece in the sim: a rider who steers at the gates threads Old Town, and a replay agrees', () => {
    const seed = MOUNTAINS[0].seed;
    const a = rideAtGates(seed);
    const b = rideAtGates(seed);
    const town = a.plays.find((p) => p.key === 'oldtown')!;
    expect((a.stats.momentMask >> town.index) & 1).toBe(1);
    expect(a.stats.momentMask).toBe(b.stats.momentMask);
    expect(a.hash()).toBe(b.hash());
  });

  it('makes each set piece a star on the board, earned by its verb beaten and never by a round 5 sweep', () => {
    const c = courseFor(MOUNTAINS[0].seed);
    const rec = emptyMastery();
    rec.moments.push('mirror');
    const board = masteryBoard(c, 'pinecrest', rec, 0).filter((s) => s.group === 'moment');
    expect(board.map((s) => s.label)).toEqual(['The First Drop: Fly all three rings', 'Mirror Lake: Beat the cable car across the ice', 'Old Town: Thread every lantern gate']);
    expect(board.every((s) => !s.done)).toBe(true);
    const fresh = settleMastery(c, 'pinecrest', rec, { gates: [], moments: [{ key: 'mirror', took: 0, total: 9, clean: false, won: true }], time: null, riderTimes: new Map(), clean: false }, 0, 0);
    expect(fresh).toEqual(['Mirror Lake: Beat the cable car across the ice']);
  });
});
