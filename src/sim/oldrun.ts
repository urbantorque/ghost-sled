// The Old Run (round 9, notes/r9-ground.md section 5): an old ice track down a forest, ridden on its banked walls.
// Its descent is laid here, through course.ts's kit seam (kit.ts), never by the five's acts.
//
// Pure: no DOM, render or audio imports.

import { ChaosEvent } from './chaos';
import type { Layout } from './course';

/** Its descent: three stages of 950, 1,000 and 1,050 m; no ramp, kicker or leap in its first minute; the outrun to the
 *  timing house (120 m before the line, 200 past it); thresholds on the track's straights, as wide as the channel;
 *  the light storm and the spirit train, never an avalanche (it would catch a rider in the slush) or a yeti (no room
 *  to cross a 15 m channel). */
export const OLDRUN_LAYOUT: Layout = {
  stages: [950, 1000, 1050],
  grammar: 'oldrun',
  square: 120,
  runOut: 200,
  finish: 'outrun',
  threshold: 'track',
  thresholdHW: 7.2,
  firstKick: null,
  kickFrom: 800,
  picketsFrom: 900,
  lightRun: null,
  events: (1 << ChaosEvent.GiftStorm) | (1 << ChaosEvent.GhostTrain),
};
