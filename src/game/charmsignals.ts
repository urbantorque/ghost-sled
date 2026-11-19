import { CHARM } from '../sim/charms';
import type { Sim } from '../sim/sim';

// Round 8, G2: a held charm's one signal (charms.ts CHARMS[id].signal), read off the sim each frame for the HUD's
// lantern and the world's effects. Nothing else on screen says a charm is held: no list, no icons in a corner.
//
// Most signals are what the sim already shows (Lamplit Path's sparks, a showdown's cell). The lantern's own (a ward
// ring gone, cells in halves, a half price open, a lantern owed back, a stage's spare held) need state the sim keeps to
// itself; this reads it through a narrow view of those fields, for drawing only. Nothing here is written back, and a
// replay never sees it. (The main lane may prefer public getters on Sim for these: the names are in `Peek`.)
//
// Pure: no DOM, render or audio imports.

/** The sim's own charm state, as the drawing reads it (sim.ts: private, presentation reads only). */
interface Peek {
  lastPerfect: number;
  hearthOwed: number;
  featherStage: number;
  lampStage: number;
  wispStage: number;
}

/** The lantern's signals, a bit each (HudModel.lantern.sig). */
export const SIG = {
  /** Comet's Tail: the lantern drawn without its ward ring (a full lantern never wards). */
  noWard: 1,
  /** Stone Lantern: its cells drawn in halves (a ward costs half). */
  halves: 2,
  /** Ember Step: the lantern pulses while a dash costs half (just after a perfect landing). */
  step: 4,
  /** Hearthstone: the cell a dash spent is outlined until a stomp gives it back. */
  owed: 8,
  /** Featherfall: a feather on the lantern while this stage's spare landing is held. */
  feather: 16,
  /** Last Lamp: a small ember in the empty lantern once the get-ups are gone, while its stage's ward is unspent. */
  ember: 32,
  /** Slipstream Lantern: the lantern's light leans toward the ghost it drafts (with lean -1 or 1). */
  lean: 64,
} as const;

/** Ember Step's half price lasts this long after a perfect landing (sim.ts: 30 ticks). */
const STEP_TICKS = 30;

/** The lantern's signal bits for this frame. `drafting`: in a slipstream (the HUD's own flag). */
export function lanternSignals(sim: Sim, drafting: boolean): number {
  if (sim.charms.length === 0) return 0;
  const p = sim as unknown as Peek;
  const stage = sim.stageTicks.length;
  let sig = 0;
  if (sim.has(CHARM.comet)) sig |= SIG.noWard;
  if (sim.has(CHARM.stone)) sig |= SIG.halves;
  if (sim.has(CHARM.step) && sim.tick - p.lastPerfect <= STEP_TICKS && sim.s.lantern >= 50) sig |= SIG.step;
  if (sim.has(CHARM.hearth) && p.hearthOwed > 0) sig |= SIG.owed;
  if (sim.has(CHARM.feather) && p.featherStage !== stage) sig |= SIG.feather;
  if (sim.has(CHARM.lamp) && sim.s.getUps <= 0 && p.lampStage !== stage) sig |= SIG.ember;
  if (sim.has(CHARM.slip) && drafting) sig |= SIG.lean;
  return sig;
}

/** Guardian Wisp: its wisp still circles the rider (this stage's hit not yet taken). */
export function wispUp(sim: Sim): boolean {
  if (!sim.has(CHARM.wisp)) return false;
  return (sim as unknown as Peek).wispStage !== sim.stageTicks.length;
}
