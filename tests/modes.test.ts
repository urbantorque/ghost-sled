import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { InputController } from '../src/game/input';
import { CARRIED_CHARMS, LEGS, depthWords, isNightKey, legChaos, legStep, mirrorKey, mirrorSteer, nightBeat, nightDepth, nightKey, nightLeg, nightOn, settleLongNight, startNight } from '../src/game/modes';
import { LabelBatch } from '../src/render/labels';
import { builtLetters, setLetteringMirror } from '../src/render/lettering';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { STEER_CENTER } from '../src/sim/input';
import { Color } from 'three';
import { rideNight } from '../scripts/playtest/r8night';

// Round 8, the modes lane: the Long Night (whole mountains back to back, what a rider holds at one line carried into
// the next, chaos rising leg by leg, a best depth) and the mirror mountains (the picture and the steering flipped, the
// sim untouched, the words that would read backwards built turned over to meet the flip).

describe('the Long Night', () => {
  it('opens only with legs to ride, never more than its ten', () => {
    expect(startNight(1, 0)).toBeNull();
    expect(startNight(1, 3)).toMatchObject({ leg: 0, legs: 3, carry: null });
    expect(startNight(1, 99)?.legs).toBe(LEGS.length);
  });

  it('rides whole mountains in order, the second five mirrored, each leg under its own key', () => {
    const n = startNight(7, 10)!;
    const first = nightLeg(n);
    expect(first).toMatchObject({ mountain: 'pinecrest', mirror: false, key: 'night:pinecrest', n: 1, of: 10, carry: undefined });
    const sixth = nightLeg({ ...n, leg: 5 });
    expect(sixth).toMatchObject({ mountain: 'pinecrest', mirror: true, key: `night:${mirrorKey('pinecrest')}`, n: 6 });
    expect(isNightKey(sixth.key)).toBe(true);
    expect(nightKey('ember', false)).toBe('night:ember');
  });

  it('rises: plain, then a mood, then a mood and an event from the third leg on', () => {
    expect([0, 1, 2, 3, 9].map(legStep)).toEqual([0, 1, 2, 2, 2]);
    for (const seed of [1, 99, 123456]) {
      expect(legChaos(seed, 0)).toMatchObject({ mood: Mood.None, event: ChaosEvent.None });
      expect(legChaos(seed, 1).mood).not.toBe(Mood.None);
      expect(legChaos(seed, 1).event).toBe(ChaosEvent.None);
      expect(legChaos(seed, 2).mood).not.toBe(Mood.None);
      expect(legChaos(seed, 2).event).not.toBe(ChaosEvent.None);
      // (The same night draws the same legs.)
      expect(legChaos(seed, 4)).toEqual(legChaos(seed, 4));
    }
  });

  it('carries what the line held into the next leg: the lantern, the get-ups and the last three charms taken', () => {
    const n = startNight(5, 3)!;
    const two = nightOn(n, { lantern: 182.4, getUps: 2, charms: [19, 17, 23, 16, 6] })!;
    expect(two.leg).toBe(1);
    expect(two.carry).toEqual({ lantern: 182.4, getUps: 2, charms: [23, 16, 6], chaos: 1 });
    expect(two.carry!.charms).toHaveLength(CARRIED_CHARMS);
    expect(nightLeg(two).carry).toEqual({ lantern: 182.4, getUps: 2, charms: [23, 16, 6] });
    const three = nightOn(two, { lantern: 0, getUps: 3, charms: [] })!;
    expect(three.carry?.chaos).toBe(2);
    // Past the last open leg, the night is done.
    expect(nightOn(three, { lantern: 50, getUps: 3, charms: [1] })).toBeNull();
  });

  it('is as deep as its legs finished and the metres into the one it ended on', () => {
    const n = { ...startNight(5, 3)!, leg: 2 };
    expect(nightDepth(n, false, 640.4)).toEqual({ legs: 2, z: 640 });
    expect(nightDepth(n, true, 3100)).toEqual({ legs: 3, z: 0 });
    expect(depthWords({ legs: 2, z: 640 })).toBe('2 legs and 640 m');
    expect(depthWords({ legs: 1, z: 0 })).toBe('1 leg');
    expect(depthWords({ legs: 0, z: 1230 })).toBe('1,230 m into the first leg');
    expect(settleLongNight({ legs: 2, z: 640 }, 2, 600)).toEqual({ save: { legs: 2, z: 640 }, newBest: false });
    expect(settleLongNight({ legs: 2, z: 640 }, 3, 0)).toEqual({ save: { legs: 3, z: 0 }, newBest: true });
  });

  it('says between legs where the next one is, how the night deepens and what rides in', () => {
    const two = nightOn(startNight(5, 10)!, { lantern: 150, getUps: 3, charms: [0, 1] })!;
    const v = nightBeat(two);
    expect(v).toMatchObject({ n: 2, of: 10, mountain: 'Frostfang', mirror: false, event: '', lantern: 1.5, getUps: 3 });
    expect(v.mood.length).toBeGreaterThan(0);
    expect(v.charms).toHaveLength(2);
  });

  it('three legs ridden by the lab’s mid pilot through the game layer: every carry exact, every leg replays alone, the depth kept', () => {
    const r = rideNight({ seed: 0x6e19, pilotSeed: 1234, legs: 3 });
    expect(r.legs).toHaveLength(3);
    expect(r.ok).toEqual({ carries: true, replays: true, chaosRises: true });
    expect(r.legs.map((l) => l.step)).toEqual([0, 1, 2]);
    // The second and third legs started holding what the leg before held at its line.
    for (let i = 1; i < r.legs.length; i++) {
      const before = r.legs[i - 1].heldOut;
      expect(r.legs[i].startHeld.getUps).toBe(before.getUps);
      expect(r.legs[i].startHeld.charms).toEqual(before.charms.slice(-CARRIED_CHARMS));
    }
    expect(r.depth.legs).toBe(r.legs.filter((l) => l.finished).length);
    expect(r.best.after).toEqual(r.depth);
  }, 60000);
});

describe('mirror mountains', () => {
  it('reads the steer the other way about the centre, and back again', () => {
    for (let s = 0; s <= 8; s++) {
      expect(mirrorSteer(mirrorSteer(s))).toBe(s);
      expect(mirrorSteer(s) - STEER_CENTER).toBe(STEER_CENTER - s);
    }
    expect(mirrorKey('sakura')).toBe('mirror:sakura');
  });

  it('the input sends the sim the mirrored steer only on a mirrored run', () => {
    const key = (type: string, code: string): Event => Object.assign(new Event(type), { code, repeat: false, preventDefault() {} });
    (globalThis as { window?: unknown }).window = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720 });
    const input = new InputController(new EventTarget() as unknown as HTMLElement);
    window.dispatchEvent(key('keydown', 'ArrowRight'));
    const plain = input.sample().steer;
    expect(plain).toBeGreaterThan(STEER_CENTER);
    input.mirrored = true;
    const flipped = input.sample().steer;
    expect(flipped).toBeLessThan(STEER_CENTER);
    window.dispatchEvent(key('keyup', 'ArrowRight'));
    expect(input.sample().steer).toBe(STEER_CENTER);
    input.dispose();
  });

  it('a board built on a mirrored run is in mirror writing: its letters in the other order, each one turned over', () => {
    const ink = new Color('#121933');
    const mid = (g: { computeBoundingBox(): void; boundingBox: Box3 | null }): number => {
      g.computeBoundingBox();
      return g.boundingBox!.getCenter(new Vector3()).x;
    };
    // The F's weight is its stem, at the left of its box; turned over it is at the right.
    const lean = (g: { getAttribute(n: string): { count: number; getX(i: number): number } }, box: Box3): number => {
      const p = g.getAttribute('position');
      let s = 0;
      for (let i = 0; i < p.count; i++) s += p.getX(i);
      return s / p.count - box.getCenter(new Vector3()).x;
    };
    setLetteringMirror(false);
    const plain = builtLetters('FIN', 0, 0, 0.5, ink);
    expect(setLetteringMirror(true)).toBe(true);
    const mirror = builtLetters('FIN', 0, 0, 0.5, ink);
    expect(setLetteringMirror(true)).toBe(false);
    setLetteringMirror(false);
    expect(mirror).toHaveLength(3);
    // Turned over with the picture, each letter stands where the plain board has it: the last letter first.
    for (let i = 0; i < 3; i++) expect(-mid(mirror[i])).toBeCloseTo(mid(plain[2 - i]), 3);
    const boxOf = (g: (typeof plain)[number]): Box3 => {
      g.computeBoundingBox();
      return g.boundingBox!.clone();
    };
    // The mirrored board's first slot holds an N (its outline the plain N's turned over: N is its own mirror image
    // only when turned about both axes), its last an F with its stem on the right.
    const fPlain = lean(plain[0], boxOf(plain[0]));
    const fMirror = lean(mirror[2], boxOf(mirror[2]));
    expect(fPlain).toBeLessThan(0);
    expect(fMirror).toBeGreaterThan(0);
  });

  it('the labels are drawn turned back over a flipped canvas', () => {
    const b = new LabelBatch();
    expect(b.flipped).toBe(false);
    b.setFlip(true);
    expect(b.flipped).toBe(true);
    b.setFlip(false);
    expect(b.flipped).toBe(false);
    b.dispose();
  });
});
