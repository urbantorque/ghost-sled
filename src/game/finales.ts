import { ChaosEvent } from '../sim/chaos';
import type { Sim, SimEvent } from '../sim/sim';
import type { BeatOf } from './beats';

// Event finales: every chaos event counts down while it is coming and ends on a graded finale.
//
// Pure: no DOM, render or audio imports.
//
// The sim already pays each event's style (the avalanche's 2,000, the yeti hop's 1,500): those
// finales carry no gifts and replace the style's own callout (decision 35, every number once). The
// extra gifts here (a clean Gift Storm sweep, a dodged yeti, a ridden Spirit Train) are credited by
// the app, inside the run's extras cap.

/** The countdown chip shows from this far out (metres to the trigger). */
export const COUNTDOWN_M = 400;
/** The Gift Storm finale waits for the last gifts to fall behind you, at most this long after 'end'.
 *  (The 48th gift drops 62 to 84 m ahead on the very tick of 'end', so it reaches you 2.5 to 5.5 s
 *  later: a shorter wait would count before the last catches, and a clean sweep could never pay.) */
export const STORM_WAIT_TICKS = 360;
/** Drafted ticks inside the Spirit Train's run that make it a ride. */
export const TRAIN_RIDE_TICKS = 60;
export const STORM_SWEEP_GIFTS = 10;
export const YETI_DODGE_GIFTS = 5;
export const TRAIN_GIFTS_CAP = 10;

const NOTE_NAME: Record<number, string> = {
  [ChaosEvent.Avalanche]: 'avalanche',
  [ChaosEvent.Yeti]: 'yeti',
  [ChaosEvent.GiftStorm]: 'Gift Storm',
  [ChaosEvent.GhostTrain]: 'Spirit Train',
};

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

type Finale = BeatOf<'finale'>;

export class FinaleTracker {
  private event: ChaosEvent = ChaosEvent.None;
  private triggerZ = Infinity;
  /** A revive since the event's warn (the revive itself ends a chasing yeti). */
  private revivedSinceWarn = false;
  private stormEndTick = -1;
  private stormDone = false;
  private trainDraft0 = -1;
  /** For each finale of the last step, the sim event it answers (placement in the beat list), or null. */
  readonly sources: Array<SimEvent | null> = [];
  private readonly out: Finale[] = [];

  begin(event: ChaosEvent, triggerZ: number): void {
    this.event = event;
    this.triggerZ = triggerZ;
    this.revivedSinceWarn = false;
    this.stormEndTick = -1;
    this.stormDone = false;
    this.trainDraft0 = -1;
  }

  revive(): void {
    this.revivedSinceWarn = true;
  }

  /** This frame's finales from this frame's sim events (and the Gift Storm's delayed count). */
  step(sim: Sim, events: ReadonlyArray<SimEvent>, _dt: number): Array<BeatOf<'finale'>> {
    const out = this.out;
    out.length = 0;
    this.sources.length = 0;
    if (this.event === ChaosEvent.None) return out;
    const push = (f: Finale, src: SimEvent | null) => {
      out.push(f);
      this.sources.push(src);
    };
    for (const e of events) {
      if (e.type === 'style' && e.kind === 'yetiHop') {
        // The hop is a stamp of its own (the style callout is suppressed); the sim pays the 1,500.
        push({ type: 'finale', tick: sim.tick, event: ChaosEvent.Yeti, outcome: 'hopped', text: 'Yeti hop', sub: '+1,500 style', gifts: 0, grade: 1, banner: false, stamp: true }, e);
        continue;
      }
      if (e.type !== 'chaos' || e.event !== this.event) continue;
      if (e.phase === 'warn') this.revivedSinceWarn = false;
      if (e.event === ChaosEvent.Avalanche && e.phase === 'success') {
        push({ type: 'finale', tick: sim.tick, event: e.event, outcome: 'outran', text: 'Outran the avalanche', sub: '+2,000 style', gifts: 0, grade: 1, banner: true, stamp: false }, e);
      } else if (e.event === ChaosEvent.Yeti && e.phase === 'end') {
        if (!sim.dyn.yeti.hopped && !sim.stats.yetiHop && !sim.s.crashed && !this.revivedSinceWarn) {
          push(
            { type: 'finale', tick: sim.tick, event: e.event, outcome: 'dodged', text: 'Yeti dodged', sub: null, gifts: YETI_DODGE_GIFTS, grade: 1, banner: false, stamp: false, say: { label: 'Yeti dodged', points: 0, tone: 'big' } },
            e,
          );
        }
      } else if (e.event === ChaosEvent.GiftStorm && e.phase === 'end') {
        this.stormEndTick = sim.tick;
      } else if (e.event === ChaosEvent.GhostTrain && e.phase === 'start') {
        this.trainDraft0 = sim.stats.draftTicks;
      } else if (e.event === ChaosEvent.GhostTrain && e.phase === 'end') {
        const drafted = this.trainDraft0 >= 0 ? Math.max(0, sim.stats.draftTicks - this.trainDraft0) : 0;
        this.trainDraft0 = -1;
        if (drafted >= TRAIN_RIDE_TICKS) {
          const secs = drafted / 60;
          const gifts = Math.min(TRAIN_GIFTS_CAP, Math.floor(secs));
          push({ type: 'finale', tick: sim.tick, event: e.event, outcome: 'rode', text: `Rode the Spirit Train ${secs.toFixed(1)} s`, sub: gifts > 0 ? `+${gifts} gifts` : null, gifts, grade: 1, banner: true, stamp: false }, e);
        } else {
          // Always a finale: a quiet one when you let it go by.
          push({ type: 'finale', tick: sim.tick, event: e.event, outcome: 'passed', text: 'The Spirit Train passed', sub: null, gifts: 0, grade: 0, banner: false, stamp: false, say: { label: 'The Spirit Train passed', points: 0, tone: 'normal' } }, e);
        }
      }
    }
    // The storm's 'end' comes before its last gifts can be reached: count once they are all behind you.
    if (this.stormEndTick >= 0 && !this.stormDone && !sim.s.crashed) {
      const storm = sim.dyn.storm;
      const z = sim.s.z;
      let ahead = false;
      for (const g of storm) if (!g.collected && g.z >= z - 3) ahead = true;
      if (!ahead || sim.tick - this.stormEndTick >= STORM_WAIT_TICKS) {
        this.stormDone = true;
        const total = storm.length;
        let caught = 0;
        for (const g of storm) if (g.collected) caught++;
        if (total > 0) {
          const sweep = caught >= total && total >= 48;
          const haul = !sweep && caught >= 36;
          push(
            {
              type: 'finale',
              tick: sim.tick,
              event: ChaosEvent.GiftStorm,
              outcome: 'caught',
              text: `Caught ${caught} of ${total}`,
              sub: sweep ? `Clean sweep: +${STORM_SWEEP_GIFTS} gifts` : haul ? 'Big haul' : null,
              gifts: sweep ? STORM_SWEEP_GIFTS : 0,
              grade: sweep ? 3 : haul ? 2 : caught > 0 ? 1 : 0,
              banner: true,
              stamp: false,
            },
            null,
          );
        }
      }
    }
    return out;
  }

  /** The rolled event coming up: metres to its trigger in 10 m steps from 400 m, else null. */
  countdown(sim: Sim): { event: ChaosEvent; metres: number } | null {
    if (this.event === ChaosEvent.None || sim.s.crashed || !this.waiting(sim)) return null;
    const d = this.triggerZ - sim.s.z;
    if (!(d > 0) || d > COUNTDOWN_M) return null;
    return { event: this.event, metres: Math.max(10, Math.ceil(d / 10) * 10) };
  }

  /** A results line for an event the run never reached ('The yeti was 220 m away.'), else null. */
  eventNote(sim: Sim): string | null {
    if (this.event === ChaosEvent.None || !this.waiting(sim)) return null;
    const d = this.triggerZ - sim.s.z;
    if (!(d > 0) || !Number.isFinite(d)) return null;
    const name = NOTE_NAME[this.event];
    if (!name) return null;
    return `The ${name} was ${fmtInt(Math.max(10, Math.round(d / 10) * 10))} m away.`;
  }

  /** The event has not started yet (its phase is still 0). */
  private waiting(sim: Sim): boolean {
    const d = sim.dyn;
    switch (this.event) {
      case ChaosEvent.Avalanche:
        return d.avalanche.phase === 0;
      case ChaosEvent.Yeti:
        return d.yeti.phase === 0;
      case ChaosEvent.GiftStorm:
        return d.stormPhase === 0;
      case ChaosEvent.GhostTrain:
        return d.trainPhase === 0;
      default:
        return false;
    }
  }

  /** A finale is still to come for an event that has ended (the Gift Storm's count waits). */
  get pending(): boolean {
    return this.stormEndTick >= 0 && !this.stormDone;
  }

  /** The event this run rolled and where it triggers (for the countdown and the note). */
  get rolled(): { event: ChaosEvent; triggerZ: number } {
    return { event: this.event, triggerZ: this.triggerZ };
  }
}
