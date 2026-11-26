import { describe, expect, it } from 'vitest';
import { EIGHT_FROM, EIGHT_START, EIGHT_TURN, FIVE_TURN, trialFor, trialMountainId, weekIndex } from '../src/game/trial';
import { LEGS, startNight } from '../src/game/modes';
import { ALL_EVENTS, ChaosEvent, Mood, eventAllowed, rollChaos, withEvents } from '../src/sim/chaos';
import { MOUNTAINS } from '../src/sim/mountains';

// Round 9, the game making room for eight mountains (notes/r9-ground.md section 10), while the five's weeks, nights and
// rolls stay what they were until all three new mountains are registered and the main lane sets the week.

const registered = (id: string): boolean => MOUNTAINS.some((m) => m.id === id);

describe('the Trials turn', () => {
  it('turns over the five as before every week before EIGHT_FROM', () => {
    const until = EIGHT_FROM === null ? weekIndex('2032-W52') : weekIndex(EIGHT_FROM) - 1;
    for (let i = weekIndex('2026-W01'); i <= until; i++) expect(trialMountainId(i)).toBe(FIVE_TURN[(((i * 2) % 5) + 5) % 5]);
  });

  it('turns over all eight from EIGHT_FROM, every one of them registered, never the same two weeks running', () => {
    // Three a week steps through all eight.
    const seen = new Set<string>();
    for (let k = 0; k < 8; k++) seen.add(EIGHT_TURN[(k * 3 + EIGHT_START) % 8]);
    expect(seen.size).toBe(8);
    expect(EIGHT_TURN.slice(0, 5)).toEqual(FIVE_TURN);
    if (EIGHT_FROM === null) return;
    for (const id of EIGHT_TURN) expect(registered(id), id).toBe(true);
    const from = weekIndex(EIGHT_FROM);
    for (let i = from - 2; i < from + 60; i++) expect(trialMountainId(i + 1), `week ${i + 1}`).not.toBe(trialMountainId(i));
    // (Its first week's Trial is named: every mountain the turn reaches has its words.)
    expect(trialFor(EIGHT_FROM).name).not.toMatch(/undefined/);
  });
});

describe("the Long Night's legs", () => {
  it('are the five and the five mirrored until all three new mountains are registered', () => {
    const all = ['oldrun', 'gullhaven', 'gablefall'].every(registered);
    const order = all ? ['pinecrest', 'frostfang', 'gablefall', 'ember', 'oldrun', 'sakura', 'gullhaven', 'lanternfall'] : ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
    expect(LEGS).toEqual([...order, ...order].map((mountain, i) => ({ mountain, mirror: i >= order.length })));
    expect(LEGS[order.length - 1].mountain).toBe('lanternfall');
  });

  it("the Almanac's last night page opens every leg there is", () => {
    expect(startNight(1, 3)?.legs).toBe(3);
    expect(startNight(1, 6)?.legs).toBe(6);
    expect(startNight(1, 10)?.legs).toBe(LEGS.length);
    expect(startNight(1, 0)).toBeNull();
  });
});

describe("a mountain's events", () => {
  it('a roll with every event allowed is the roll as it was', () => {
    for (let s = 0; s < 500; s++) expect(rollChaos(s * 7919, 3, Mood.None, ALL_EVENTS)).toEqual(rollChaos(s * 7919, 3));
  });

  it('an event the mountain cannot meet is none, and nothing else about the roll moves', () => {
    const noAvalanche = ALL_EVENTS & ~(1 << ChaosEvent.Avalanche);
    let dropped = 0;
    for (let s = 0; s < 2000; s++) {
      const a = rollChaos(s * 104729, 2);
      const b = rollChaos(s * 104729, 2, Mood.None, noAvalanche);
      expect(b.mood).toBe(a.mood);
      expect(b.seed).toBe(a.seed);
      if (a.event === ChaosEvent.Avalanche) {
        dropped++;
        expect(b.event).toBe(ChaosEvent.None);
      } else expect(b.event).toBe(a.event);
      expect(eventAllowed(b.event, noAvalanche)).toBe(true);
    }
    expect(dropped).toBeGreaterThan(50);
    expect(withEvents({ mood: Mood.Comet, event: ChaosEvent.Yeti, seed: 3 }, noAvalanche & ~(1 << ChaosEvent.Yeti))).toEqual({ mood: Mood.Comet, event: ChaosEvent.None, seed: 3 });
  });
});
