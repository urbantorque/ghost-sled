import { describe, expect, it } from 'vitest';
import { classic, spenderFor } from '../scripts/playtest/labpilots';
import { emptyMastery, masteryBoard, settleMastery } from '../src/game/mastery';
import { planMarquee } from '../src/game/marquee';
import { type ChaosRoll, rollChaos } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { InputRecorder } from '../src/sim/input';
import { RING_ID0, VERBS, climaxOf, fallPace, fallZ, gateX, legendFor, machineZ, momentPlays, pathX, planLegends, planMoments, rollForVariant, variantOf } from '../src/sim/moments';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { type RunRecord, recordFromString, recordToString, replayRecord } from '../src/sim/replay';
import { Sim } from '../src/sim/sim';
import { momentLine } from '../src/ui/momentcopy';

// Set pieces (round 6, DECISIONS 240; round 7, DECISIONS 277 and notes/r7-moments.md): each mountain's three
// biggest places, one a stage, each with a verb the sim plays, so every rider and every replay meets the same
// moment. Round 7: twelve verbs, none more than twice in the game; two or three seeded variants of each set
// piece; one or two legend moments a mountain.

const VERBS_OF: Record<string, string[]> = {
  pinecrest: ['rings', 'slide', 'steps:hops'],
  frostfang: ['collapse', 'race:chase', 'gates:sit'],
  ember: ['race:sprint', 'surge', 'gates:swing'],
  sakura: ['steps:stair', 'flourish', 'shatter'],
  lanternfall: ['follow', 'kindle', 'carry'],
};

const KIT = { gateX, pathX, machineZ };
const PLAIN: ChaosRoll = { mood: 0, event: 0, seed: 0x1234 };

/** A lab pilot's whole ride on a roll (scripts/playtest/labpilots.ts: the pilots the lab's tables are made of),
 *  with its inputs recorded. `hits`: its wipeouts and wards spent; `hitsIn`: the ones inside a set piece; `fallsIn`: the wipeouts there. */
function ride(skill: 'mid' | 'expert' | 'line', m: number, roll: ChaosRoll, seed: number): { sim: Sim; rec: InputRecorder; hits: number; hitsIn: number; fallsIn: number } {
  // (Round 8: with no charm, so what is proved is the set piece: a charm is a trade the rider chose, and Second Wind
  // or a Guardian Wisp, taken by riding the middle, can leave a pilot with no lantern for the surge.)
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: roll, sled: 0, charmPool: 0 });
  const pilot = classic(skill, sim, seed, KIT);
  const spend = spenderFor(skill, sim, seed);
  const rec = new InputRecorder();
  let hits = 0;
  let hitsIn = 0;
  let fallsIn = 0;
  while (!sim.finished && !sim.s.crashed && sim.tick < 240 * 60) {
    const inPiece = sim.mo.active >= 0;
    const o = pilot();
    const byte = (o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0);
    rec.push(byte);
    sim.step(byte);
    for (const e of sim.events) {
      if ((e.type === 'tumble' && e.phase === 'start') || e.type === 'ward') {
        hits++;
        if (inPiece || sim.mo.active >= 0) {
          hitsIn++;
          if (e.type === 'tumble') fallsIn++;
        }
      }
    }
  }
  return { sim, rec, hits, hitsIn, fallsIn };
}

describe('set pieces', () => {
  it('names three on every named mountain, one a stage, each with its own verb', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const list = planMoments(c);
      expect(list.map((p) => (p.style ? `${p.verb}:${p.style}` : p.verb)), m.id).toEqual(VERBS_OF[m.id]);
      expect(list.map((p) => p.stage), m.id).toEqual([0, 1, 2]);
      for (const p of list) {
        expect(p.z1).toBeGreaterThan(p.z0 + 100);
        expect(p.z1).toBeLessThanOrEqual(c.finishZ);
        expect(p.variants, `${m.id} ${p.key}`).toBeGreaterThanOrEqual(2);
        expect(p.variants).toBeLessThanOrEqual(3);
      }
      // About 45 s apart at a cruise (and never within 900 m of each other).
      for (let i = 1; i < list.length; i++) expect(list[i].z0 - list[i - 1].z0).toBeGreaterThan(900);
    }
  });

  it('uses no verb more than twice in the game, three different verbs a mountain, and two ways where a verb is twice', () => {
    const uses = new Map<string, string[]>();
    for (const m of MOUNTAINS) {
      const list = planMoments(courseFor(m.seed));
      expect(new Set(list.map((p) => p.verb)).size, m.id).toBe(3);
      for (const p of list) uses.set(p.verb, [...(uses.get(p.verb) ?? []), p.style]);
    }
    // Every verb the sim knows is played somewhere.
    expect([...uses.keys()].sort()).toEqual([...VERBS].sort());
    for (const [verb, styles] of uses) {
      expect(styles.length, verb).toBeLessThanOrEqual(2);
      if (styles.length === 2) {
        expect(styles[0], verb).not.toBe(styles[1]);
        expect(styles.every((s) => s !== ''), verb).toBe(true);
      }
    }
  });

  it('gives a Daily three too, one a stage, with no verb twice where the stage allows', () => {
    for (const k of ['2026-11-08', '2026-11-10', '2026-12-01', '2027-03-14']) {
      const list = planMoments(courseFor(dailySeed(k)));
      expect(list.length, k).toBeGreaterThanOrEqual(2);
      expect(new Set(list.map((p) => p.stage)).size).toBe(list.length);
      expect(new Set(list.map((p) => p.verb)).size, k).toBe(list.length);
    }
  });

  it('holds what each verb needs in every variant, no two variants alike, and the marquee carries the same list', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const seen = new Map<string, Set<string>>();
      for (let v = 0; v < 3; v++) {
        const roll = rollForVariant(c, PLAIN, v);
        const plays = momentPlays(c, roll);
        for (const p of plays) {
          const tag = `${m.id} ${p.key} ${p.variantKey}`;
          expect(p.variant, tag).toBe(v % p.variants);
          expect(p.say.length, tag).toBeGreaterThan(8);
          expect(p.say, tag).not.toContain('{');
          if (p.verb === 'gates') {
            expect(p.gates.length, tag).toBeGreaterThanOrEqual(4);
            if (p.style === 'swing') expect(p.gates.every((g) => g.amp > 1 && g.period > 60), tag).toBe(true);
            else expect(p.gates.every((g) => g.amp === 0 && g.x !== c.safeX(g.z)), tag).toBe(true);
          }
          if (p.verb === 'rings') {
            expect(p.rings.length, tag).toBe(3);
            for (const r of p.rings) expect(r.id).toBeGreaterThanOrEqual(RING_ID0);
          }
          if (p.verb === 'steps') {
            expect(p.steps.length, tag).toBe(p.style === 'stair' ? 4 : 0);
            expect(p.need, tag).toBeGreaterThanOrEqual(2);
          }
          if (p.verb === 'slide') expect(p.need, tag).toBeGreaterThanOrEqual(40);
          if (p.verb === 'shatter') {
            expect(p.targets.length, tag).toBeGreaterThanOrEqual(2);
            expect(p.need, tag).toBe(p.targets.length);
          }
          if (p.verb === 'surge') {
            expect(p.speed, tag).toBeGreaterThanOrEqual(44);
            expect(p.far, tag).toBeGreaterThan(p.lip + 100);
          }
          if (p.verb === 'flourish') expect(p.half + 2 * p.flips, tag).toBeGreaterThanOrEqual(4);
          if (p.verb === 'race') expect(p.style === 'chase' ? p.cars.length : p.pace, tag).toBeGreaterThan(0);
          if (p.verb === 'follow') {
            expect(p.path, tag).not.toBeNull();
            // A wake worth following: at least 40 m to ride of it, all of it off the careful line.
            expect(p.need, tag).toBeGreaterThanOrEqual(40);
          }
          if (p.verb === 'kindle') {
            const dark = p.lamps.filter((l) => l.dark).length;
            expect(p.need, tag).toBeGreaterThanOrEqual(3);
            expect(p.need, tag).toBeLessThan(dark);
          }
          if (p.verb === 'carry') {
            expect(p.flameTicks, tag).toBeGreaterThan(15 * 60);
            expect(p.variantKey === 'ember', tag).toBe(p.relight !== null);
          }
          const { variant: _v, variantKey: _k, variantName: _n, say: _s, ...rest } = p;
          const shape = JSON.stringify(rest);
          const set = seen.get(p.key) ?? new Set<string>();
          if (v < p.variants) {
            expect(set.has(shape), `${tag} plays as another variant does`).toBe(false);
            set.add(shape);
          }
          seen.set(p.key, set);
        }
        expect(planMarquee(c, m.id, roll).map((q) => `${q.key}/${q.variant}/${q.line}`)).toEqual(plays.map((p) => `${p.key}/${p.variantKey}/${p.say}`));
      }
      // The ring line of the plain day is in the course's one list of rings, tagged with its set piece.
      for (const p of momentPlays(c)) for (const r of p.rings) expect(c.skyGates.some((g) => g.id === r.id && g.moment === p.index)).toBe(true);
      // The stage gates are still one a stage, none of them a set piece's ring.
      expect(c.stageGates.every((g) => g.moment === undefined)).toBe(true);
    }
  });

  it('picks a variant from the run\'s own roll, evenly, on a first run as on any other', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[variantOf(rollChaos(0x9e3779b1 * (i + 1), i % 7), 1, 3)]++;
    for (const n of counts) {
      expect(n).toBeGreaterThan(850);
      expect(n).toBeLessThan(1150);
    }
    expect(variantOf(undefined, 0, 3)).toBe(0);
  });

  it('runs the race machine and the fall on schedules of their own, the same every time', () => {
    const race = momentPlays(courseFor(MOUNTAINS[2].seed)).find((p) => p.verb === 'race')!;
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
    const c1 = courseFor(MOUNTAINS[1].seed);
    const span = momentPlays(c1).find((p) => p.verb === 'collapse')!;
    expect(fallPace(span, 20)).toBe(span.pace);
    expect(fallPace(span, 44)).toBeGreaterThan(span.pace);
    expect(fallZ(span, 60, 30)).toBeCloseTo(span.z0 - span.lead + 30, 6);
    // A chase's cars all leave ahead of the rider and slower than a skilled one rides.
    const chase = momentPlays(c1, rollForVariant(c1, PLAIN, 2)).find((p) => p.style === 'chase')!;
    expect(chase.cars.length).toBe(2);
    for (let k = 0; k < 2; k++) expect(machineZ(chase, 0, k)).toBeGreaterThan(chase.z0 + 30);
  });

  for (let m = 0; m < MOUNTAINS.length; m++) {
    it(`${MOUNTAINS[m].id}: every variant of every set piece is won by a skilled pilot, and the careful line rides them all unhurt`, () => {
      const c = courseFor(MOUNTAINS[m].seed);
      let lineHits = -1;
      for (let v = 0; v < 3; v++) {
        const roll = rollForVariant(c, PLAIN, v);
        const plays = momentPlays(c, roll);
        const won = new Set<number>();
        // Up to four rides a pilot: a set piece is winnable if either skilled pilot wins it on any of them.
        for (const seed of [1234, 1271, 1308, 1345]) {
          for (const skill of ['expert', 'mid'] as const) {
            if (won.size === plays.length) break;
            const { sim } = ride(skill, m, roll, seed);
            for (const p of plays) if ((sim.stats.momentMask >> p.index) & 1) won.add(p.index);
          }
        }
        for (const p of plays) expect(won.has(p.index), `${MOUNTAINS[m].id} ${p.key} ${p.variantKey}: no skilled pilot won it`).toBe(true);
        // The careful line does nothing a set piece asks, and nothing a set piece adds hurts it: it finishes
        // every variant, is never wiped out inside a set piece, and no variant costs it a ward another does
        // not (the lab's line rider lands wide off the big leaps and spends a ward on the course's own trees
        // now and then, in a set piece or out of one: that is the course's, and the same in every variant).
        const line = ride('line', m, roll, 1234);
        expect(line.sim.finished, `${MOUNTAINS[m].id} v${v}: the careful line finishes`).toBe(true);
        expect(line.fallsIn, `${MOUNTAINS[m].id} v${v}: the careful line is never wiped out in a set piece`).toBe(0);
        if (lineHits < 0) lineHits = line.hitsIn;
        expect(line.hitsIn, `${MOUNTAINS[m].id} v${v}: no variant hits the careful line`).toBe(lineHits);
      }
    });
  }

  it('is never a gift: the careful line wins no set piece but a span it is fast enough to outrun', () => {
    for (let m = 0; m < MOUNTAINS.length; m++) {
      const c = courseFor(MOUNTAINS[m].seed);
      for (let v = 0; v < 3; v++) {
        const roll = rollForVariant(c, PLAIN, v);
        const { sim } = ride('line', m, roll, 1271);
        for (const p of momentPlays(c, roll)) {
          if (p.verb === 'collapse') continue;
          expect((sim.stats.momentMask >> p.index) & 1, `${MOUNTAINS[m].id} ${p.key} ${p.variantKey}`).toBe(0);
        }
      }
    }
  });

  it('decides a set piece in the sim: a replay of the record agrees, variant, legend and all', () => {
    for (let m = 0; m < MOUNTAINS.length; m++) {
      const c = courseFor(MOUNTAINS[m].seed);
      const roll: ChaosRoll = { ...rollForVariant(c, PLAIN, (m % 2) + 1), legend: 1 + (m % 2) };
      const a = ride('expert', m, roll, 1271);
      const record: RunRecord = { seed: MOUNTAINS[m].seed, chaos: roll, sled: 0, charmPool: 0, inputs: a.rec.encode(), ticks: a.rec.tickCount, score: a.sim.score, distance: a.sim.distance, name: 'Lab' };
      // Through the string a link or a pool carries, so the roll's legend and seed make the trip too.
      const b = replayRecord(recordFromString(recordToString(record)));
      expect(b.plays.map((p) => p.variantKey), MOUNTAINS[m].id).toEqual(a.sim.plays.map((p) => p.variantKey));
      expect(b.legend?.key).toBe(a.sim.legend?.key);
      expect(b.stats.momentMask).toBe(a.sim.stats.momentMask);
      expect(b.stats.momentsWon).toBe(a.sim.stats.momentsWon);
      expect(b.stats.legend).toBe(a.sim.stats.legend);
      expect(b.stats.legendLit).toBe(a.sim.stats.legendLit);
      expect(b.hash(), MOUNTAINS[m].id).toBe(a.sim.hash());
      expect(a.sim.stats.momentsWon, `${MOUNTAINS[m].id}: the expert wins something`).toBeGreaterThan(0);
    }
  });

  it('makes each set piece a star on the board, earned by its verb beaten in any variant', () => {
    const c = courseFor(MOUNTAINS[0].seed);
    const rec = emptyMastery();
    // A round 5 sweep, and a round 6 win of a set piece that asks something else now, claim nothing.
    rec.moments.push('mirror', 'mirror:won', 'firstdrop:won');
    const board = masteryBoard(c, 'pinecrest', rec, 0).filter((s) => s.group === 'moment');
    expect(board.map((s) => s.label)).toEqual(['The First Drop: Fly all three rings', 'Mirror Lake: Hold a long slide across the ice', 'Old Town: Pop and stomp your landings through the town']);
    // (The First Drop asks what it asked in round 6, so its star stands.)
    expect(board.map((s) => s.done)).toEqual([true, false, false]);
    const fresh = settleMastery(c, 'pinecrest', rec, { gates: [], moments: [{ key: 'mirror', took: 0, total: 9, clean: false, won: true }], time: null, riderTimes: new Map(), clean: false }, 0, 0);
    expect(fresh).toEqual(['Mirror Lake: Hold a long slide across the ice']);
    // Lanternfall's board has its three, and the Hollow King's star.
    const lf = masteryBoard(courseFor(MOUNTAINS[4].seed), 'lanternfall', emptyMastery(), 0);
    expect(lf.filter((s) => s.group === 'moment').map((s) => s.key)).toEqual(['mq:cloudsea', 'mq:lamproad', 'mq:firstflame']);
    expect(lf.some((s) => s.key === 'rider:crown')).toBe(true);
  });

  it('has a chip line for every verb as it starts and as it is decided', () => {
    for (const verb of VERBS) {
      for (const phase of ['start', 'won', 'lost'] as const) {
        const line = momentLine(verb, 'x', phase, 1, 3);
        expect(line, `${verb} ${phase}`).toBeTruthy();
        expect(line!.length, `${verb} ${phase}: fits a chip at 390 px`).toBeLessThanOrEqual(28);
        expect(line).not.toMatch(/[—–]/);
      }
    }
  });

  it('gives the last stage a climax to score and frame: the last set piece, the last leap, the town, the line', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const k = climaxOf(c);
      const last = planMoments(c)[2];
      expect(k.piece, m.id).toBe(last.index);
      expect(k.pieceZ0).toBe(last.z0);
      expect(k.peakZ, m.id).toBeGreaterThan(c.stages[2].z0);
      expect(k.landZ).toBeGreaterThan(k.peakZ + 40);
      expect(k.townZ).toBeLessThan(k.lineZ);
      expect(k.lineZ).toBe(c.finishZ);
    }
  });
});

describe('legend moments', () => {
  it('never roll on a session\'s first run, and roll on about one run in ten after it', () => {
    for (let i = 0; i < 2000; i++) expect(rollChaos(0x9e3779b1 * (i + 1), 0).legend ?? 0).toBe(0);
    let n = 0;
    let slots = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const roll = rollChaos((0x85ebca6b * (i + 1)) >>> 0, 1 + (i % 9));
      if (roll.legend) {
        n++;
        slots += roll.legend;
        // A legend never shares a run with a mid-run event.
        expect(roll.event).toBe(0);
        expect(roll.legend === 1 || roll.legend === 2).toBe(true);
      }
    }
    // One run in 8 to 15.
    expect(N / n).toBeGreaterThan(8);
    expect(N / n).toBeLessThan(15);
    // Both of a mountain's legends come up.
    expect(slots / n).toBeGreaterThan(1.35);
    expect(slots / n).toBeLessThan(1.65);
  });

  it('gives every named mountain two, off its set pieces, and a run that rolled one meets it', () => {
    for (let m = 0; m < MOUNTAINS.length; m++) {
      const c = courseFor(MOUNTAINS[m].seed);
      const legends = planLegends(c);
      expect(legends.length, MOUNTAINS[m].id).toBe(2);
      const pieces = planMoments(c);
      for (const lg of legends) {
        expect(lg, MOUNTAINS[m].id).not.toBeNull();
        if (lg!.kind !== 'sky') expect(pieces.some((p) => p.z0 < lg!.z1 && p.z1 > lg!.z0), lg!.key).toBe(false);
        // What a legend lays is off nothing's toes: every light stands clear inside the corridor.
        for (const l of lg!.lights) expect(c.edgeExcess(l.x, l.z), lg!.key).toBeLessThan(0);
      }
      expect(legendFor(c, PLAIN)).toBeNull();
      for (const slot of [1, 2]) {
        const roll: ChaosRoll = { ...PLAIN, legend: slot };
        const plain = ride('line', m, PLAIN, 1234);
        const withIt = ride('line', m, roll, 1234);
        expect(withIt.sim.stats.legend, `${MOUNTAINS[m].id} slot ${slot}`).toBe(slot);
        // Spectacle that only ever gives: the careful line finishes it, hit no more and no slower than on a
        // plain day.
        expect(withIt.sim.finished).toBe(true);
        expect(withIt.hits).toBeLessThanOrEqual(plain.hits);
        expect(withIt.sim.tick).toBeLessThanOrEqual(plain.sim.tick + 30);
        expect(withIt.sim.stats.legendLit).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
