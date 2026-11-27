// The seam a new mountain lays its own ground through (round 9, notes/r9-ground.md section 2). The five are laid by
// course.ts's own acts (compose, pour); a mountain whose grammar is nothing like theirs (a track, a cape, a town's roofs)
// lays its descent in its own file and hands course.ts a Kit, which course.ts calls only where the kit defines a hook,
// behind flags set as the course is built. On the five, every Daily and every Cup there is no kit, and nothing here runs.
//
// Types only from course.ts (`import type`), so a mountain's file never imports course.ts's values and can be loaded
// first; what it shares with course.ts (bank, the thresholds' bounds, the chunk's length) is in courseparts.ts.
//
// Pure: no DOM, render or audio imports.

import type { Band, Chunk, Course, KitId, Layout, ObstacleKind, Section, SectionKind, Surface } from './course';
import type { Rng } from './prng';

/** A section as a kit lays it: as course.ts's own beats. */
export interface KitBeat {
  kind: SectionKind;
  len: number;
  blend: number;
  /** A stage line's threshold: the calm ground a charm gate stands on. */
  gate?: true;
}

/** course.ts's bands, for a kit to keep things out: nothing stands across `clear`; nothing launches in `busy`; nothing
 *  scattered goes in `narrow`. */
export interface KitPlan {
  clear: Band[];
  busy: Band[];
  narrow: Band[];
}

/** How a kit stands something on its course: the five's own rule for room (clearOf), and the obstacle itself. */
export interface Placer {
  clearOf(x: number, z: number, r: number): boolean;
  add(kind: ObstacleKind, x: number, z: number, r: number, h: number): void;
}

/** What a rider is, for the line it rides here and now (the bot and the lab's pilots ask; nothing is drawn). */
export interface KitRider {
  x: number;
  y: number;
  z: number;
  /** Its speed, m/s. */
  v: number;
  /** 0 a first-timer to 1 an expert. */
  skill: number;
  /** How bold it is, 0 to 1. */
  nerve: number;
}

/** A street between rows of houses (Gablefall, hook D): its sides at z, its level, and how far over its level a sled must
 *  be to ride on past its sides (under that it is held to the street, the sim's levelHold). */
export interface Street {
  x0: number;
  x1: number;
  y: number;
  hold: number;
}

export interface Kit {
  readonly id: KitId;
  /** Its descent, as course.ts lays a layout's. */
  readonly layout: Layout;
  /** The descent: beats in order, the stages' room filled exactly, a threshold (gate: true) across each stage line within
   *  THRESHOLD_BEFORE..BEFORE_MAX above it and AFTER_MIN..AFTER below, ending with layout.finish of square + runOut.
   *  `blendOf` is course.ts's (a steepening slope blends long enough to stay a roll). */
  compose(c: Course, rng: Rng, blendOf: (k: SectionKind, prev: SectionKind | null) => number): KitBeat[];
  /** Each section as it is laid (where course.ts lays the five's leaps and the rest). It pushes the bands its kinds
   *  need: a threshold's clear and busy band, the finish's to the run-out's end. */
  lay(c: Course, sec: Section, rng: Rng, plan: KitPlan): void;

  // Each of these is called only where it is defined.
  /** The centre line at z, replacing the five's wander, and its slope dx/dz. */
  centre?(c: Course, z: number): number;
  slope?(c: Course, z: number): number;
  /** The corridor's half-width at z, in x. */
  halfWidth?(c: Course, z: number): number;
  /** The bare ground at (x, z), given the plain slope's height there (baseY and its relief): the cross-section is the
   *  kit's, past the corridor's edge too. */
  ground?(c: Course, x: number, z: number, base: number): number;
  /** The surface at (x, z), or null for course.ts's own. */
  surface?(c: Course, x: number, z: number): Surface | null;
  /** Upward acceleration of the air at (x, y, z), m/s^2 at full gravity; 0 outside every zone. */
  lift?(c: Course, x: number, y: number, z: number): number;
  /** A lift column's middle at z, or null where there is none. */
  liftX?(c: Course, z: number): number | null;
  /** The street at z, where rows stand either side of it (Gablefall), or null. */
  street?(c: Course, z: number): Street | null;
  /** The obstacles this mountain stands on a chunk, after course.ts's own. */
  obstacles?(c: Course, chunk: Chunk, rng: Rng, p: Placer, diff: number): void;
  /** The spirit lights this mountain lays on a chunk, after course.ts's own. */
  lights?(c: Course, chunk: Chunk, rng: Rng, diff: number, push: (x: number, z: number, hover: number, value: number) => void): void;
  /** The line a rider of this kind, here and now, rides at z (the safe line where it would ride that). */
  lineFor?(c: Course, z: number, r: KitRider): number;
  /** The track's settling line for a speed (the Old Run). */
  raceX?(c: Course, z: number, v: number): number;
  /** Where a pop pays (a gully's lip, a roof's end), from z0 to z1. */
  lips?(c: Course, z0: number, z1: number): readonly { z: number; x0: number; x1: number }[];
}
