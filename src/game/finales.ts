import { ChaosEvent } from '../sim/chaos';
import type { Sim, SimEvent } from '../sim/sim';
import type { BeatOf } from './beats';

// Event finales: every chaos event counts down while it is coming and ends on a graded finale.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: today's only payoff, the avalanche escape banner ('Outran the avalanche', '+2,000
// style'; the points are the sim's own style event, so the finale pays no gifts). No countdown, no
// other finales, no event note.

export class FinaleTracker {
  private event: ChaosEvent = ChaosEvent.None;
  private triggerZ = Infinity;

  begin(event: ChaosEvent, triggerZ: number): void {
    this.event = event;
    this.triggerZ = triggerZ;
  }

  revive(): void {
    // (Scaffold: nothing is tracked across the crash yet.)
  }

  /** This frame's finales from this frame's sim events. */
  step(sim: Sim, events: ReadonlyArray<SimEvent>, _dt: number): Array<BeatOf<'finale'>> {
    const out: Array<BeatOf<'finale'>> = [];
    for (const e of events) {
      if (e.type !== 'chaos' || e.phase !== 'success') continue;
      out.push({ type: 'finale', tick: sim.tick, event: e.event, outcome: 'outran', text: 'Outran the avalanche', sub: '+2,000 style', gifts: 0, grade: 1, banner: true, stamp: false });
    }
    return out;
  }

  /** The rolled event coming up: metres to it in 10 m steps from 400 m, else null. Scaffold: null. */
  countdown(_sim: Sim): { event: ChaosEvent; metres: number } | null {
    return null;
  }

  /** A results line for an event the run never reached ('The yeti was 220 m away.'). Scaffold: null. */
  eventNote(_sim: Sim): string | null {
    return null;
  }

  /** The event this run rolled and where it triggers (for the countdown and the note). */
  get rolled(): { event: ChaosEvent; triggerZ: number } {
    return { event: this.event, triggerZ: this.triggerZ };
  }
}
