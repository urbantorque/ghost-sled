# Round 9, the ground lane: one sim design for the Old Run, Gullhaven and Gablefall (milestone 3, M1)

Phase 1 of the lane's brief (`notes/r9-briefs/ground.md`): the design, before any sim code, revised after a fresh
adversarial review (section 13 holds its findings and the answer to each). **Nothing here has been built or
ridden.** Figures marked *worked* are arithmetic from the sim's own constants (`CD` 0.0027, `MU` 0.03, `G` 9.81, the
tuck's 0.82), done by a throwaway script, not a lab run; every one is for the lab prototype to confirm or correct.
Line numbers are the base commit's (`round-9` at 6255b8d).

The read sites are listed by a script that stays in the worktree for Phase 2 to re-run after every step:
`node scripts/r9/ground-readsites.mjs [length|opening|thresholds|list|tables|leaps]` (read-only; `file:line` and the
line, grouped, with counts by area).

Contents: 0 the rule that keeps the five; 1 the course table; 2 the kit seam (one file a mountain); 3 the sim's
hooks; 4 the bot's hooks; 5 the Old Run; 6 Gullhaven; 7 Gablefall; 8 chaos, moods, charms and style on the three;
9 `FINISH_Z` from the course; 10 the game layer making room for eight; 11 the suites; 12 the order of work and what
the mountain lanes add; 13 the review; 14 questions for the main lane.

---

## 0. How the five stay byte for byte

Four rules, each checkable in the diff, and one test that proves the sum.

1. **Every new path sits behind a per-course constant set at construction**, false on the five: `Course.kit` is
   `null` for the five's biomes and every Daily and Cup; `Sim`'s `trackOn`, `liftOn` and `levelOn` are assigned from
   it in the constructor's body (not as class-field initialisers, which run before `this.course` exists). A new
   branch is `if (this.trackOn ...)`, never a test of a field the five also carry. On the five the same instructions
   run in the same order: no new arithmetic (not even `+ 0`, which turns a `-0` into `+0` and changes `Sim.hash`'s
   bits), no new call that reads the course, no new draw on any `Rng` (course, sim, bot, pool generator). Where a five's
   statement moves into the `else` of a new guard, its expression and order stay as they are.
2. **New things go in under new names only**: new `CourseBiome` values, `SectionKind`s, `Surface` constants, obstacle
   kinds and (with the mountain lanes) `MomentVerb`s, each appended to its union and list. Nothing the five use is
   renamed, reordered or re-valued. `SectionShape`, `Zones`, `Obstacle`, `Section`, `Chunk` and `Ledge` gain no field
   and `LedgeKind` no value: what a new mountain needs about its own ground lives in its own kit (section 2).
3. **A shared constant becomes a table row only where the five's row holds its exact value**, read where the
   constant is read today (section 1). The constants stay exported under their names, defined from the five's row
   (`STAGE_LENGTHS = FIVE.stages`), so every test and render file that imports them reads what it read.
4. **`SIM_VERSION` stays 10 and the record's bytes do not change.** A new mountain is a new seed; its records are
   ordinary version 3 records.

**The proof: `tests/five.test.ts`, written first, before any sim edit** (step 0 of section 12). A script,
`scripts/r9/five-fingerprint.ts`, run on 6255b8d, prints one FNV-1a digest (float64 bits, as `Sim.hash` mixes them)
per item; the test holds those literals and recomputes them:

| Digest | What it folds in | Over |
| --- | --- | --- |
| course | every section (kind, z0, z1, blend, side, drop0, phase0, fall0, the shape's 21 fields in `PLAIN`'s key order, gate), `stages`, `ledges`, `leaps`, `charmGateZs`, `stageGates`, `skyGates`, `wallLines`; every chunk to the run-out's end (obstacles, every zone array, gates, lights, in order); on a grid (z every 2.5 m to `finishZ + RUN_OUT + 200`; x at the centre and +-2, 5, 9, 14, 20 m) `ground`, `safeX`, `centerX`, `halfWidth`, `baseY`, `edgeLimit`, `edgeExcess`, `altX`, `backX`, and `surface`'s grip, drag and ice; `planMoments`, `momentPlays` for the rolls `rollForVariant` gives for variants 0, 1, 2 and under Comet Night's gravity, `planLegends`, `climaxOf` | the five and the fairness suite's six Dailies |
| chaos | `rollChaos(seed, runIndex, lastMood)` for 2,000 seeds x runIndex 0, 1, 3 x lastMood 0, 3 (mood, event, seed, legend); `eventTriggerZ`; `cupChaos` for 60 weeks; `trialFor` for 60 weeks; `legChaos` for 20 nights x 10 legs | the roll's whole surface the game reads |
| scripted ride | `determinism.test.ts`'s busy scripted rider (exported, not copied), 90 s, `Sim.hash` every 30th tick | the five, three rolls each (plain, a mood and an event, a legend) |
| bot ride | `runBot` with skills 0.25, 0.55, 0.9 and styles `racer` and `stunt`: input bytes, ticks, score, distance and the final `Sim.hash` | the five and one Daily, one roll each |
| lab pilots | `labpilots.ts`'s `classic('mid')` and `clumsy` on one seed: the final `Sim.hash` | the five |

The pool replays (`tests/ghostpool.test.ts`) already prove the stored records; this adds the courses, the chaos the
game rolls, the bot (whose every draw must stay where it is, or a later pool, a Daily's runtime field or a Trial's
would differ) and the lab's pilots (the measure lane's baseline). Its cost is measured in step 0 before it joins
every step's run: the bot rides are about thirty full runs (`bot.test.ts`'s one Daily pool is about twenty-four), so
if the file takes more than about 20 s the bot and pilot rides move to `tests/five-rides.test.ts`, run in the heavy
slot at the end of each step rather than with every edit.

---

## 1. The per-mountain course table (`Layout`, in `src/sim/course.ts`)

```ts
/** What a descent is made of beyond its BIOME_PARAMS: the stages, who composes them, the finish, the threshold a
 *  charm gate stands on and the first minute's promises. One row a course biome; the five and every Daily and Cup
 *  read FIVE, whose values are the constants they read before round 9. */
export interface Layout {
  /** The stages' metres in order; the finish line is their sum. Three (DECISIONS 392, the owner's default 5). */
  stages: readonly [number, number, number];
  /** Who lays the descent: the five's acts (compose, pour), or the mountain's own kit (section 2). */
  grammar: 'acts' | KitId;
  /** The last metres of stage 3 that are the finish place (the five's square), and the easy ground past the line. */
  square: number;
  runOut: number;
  /** The section kind the finish is laid as, and the kind laid past the run-out when something reads beyond it. */
  finish: SectionKind;
  /** The kind a stage line's threshold is laid as, and its least half-width. */
  threshold: SectionKind;
  thresholdHW: number;
  /** The first kicker on the line: the best-true z in [from, to] at 2 m steps, `at` when none is better; null: none. */
  firstKick: { from: number; to: number; at: number } | null;
  /** Nothing scattered launches on the line, no mogul field and no sky gate before this. */
  kickFrom: number;
  /** Where the corridor's middle starts to fill (pickets). */
  picketsFrom: number;
  /** The run-in's light line (a first run learns to steer on it); null: none. */
  lightRun: { z: number; len: number; step: number; wave: number } | null;
  /** The mid-run events a run here may meet, a bit each by ChaosEvent (section 8). */
  events: number;
}
export type KitId = 'oldrun' | 'gullhaven' | 'gablefall';
export const FIVE: Layout = {
  stages: [1450, 1500, 1550], grammar: 'acts', square: 300, runOut: 260, finish: 'finish', threshold: 'cruise',
  thresholdHW: 11, firstKick: { from: 286, to: 312, at: 296 }, kickFrom: 800, picketsFrom: 900,
  lightRun: { z: 130, len: 160, step: 8, wave: 110 }, events: 0b11110,
};
export const STAGE_LENGTHS: readonly number[] = FIVE.stages;  // (kept: tests and render import it)
export const RUN_OUT = FIVE.runOut;
export const FINISH_SQUARE = FIVE.square;
const LAYOUTS: Record<CourseBiome, Layout> = { alpine: FIVE, glacier: FIVE, volcanic: FIVE, blossom: FIVE, lantern: FIVE, oldrun: OLDRUN_LAYOUT /* , the other two with their lanes */ };
/** The finish line and the events of any seed, without building its course (the game layer's records and rolls). */
export function finishZFor(seed: number): number { const s = LAYOUTS[courseBiomeForSeed(seed)].stages; return s[0] + s[1] + s[2]; }
export function eventsFor(seed: number): number { return LAYOUTS[courseBiomeForSeed(seed)].events; }
```

`Course` gains `readonly layout: Layout` (set in the constructor, 863, from `this.params.biome`) and
`get runOut(): number`. **No runtime import cycle:** `bank()`, the `THRESHOLD_*` constants, `SAFE_LANE`,
`FOREST_LIMIT` and `CHUNK_LEN` move to a new leaf module, `src/sim/courseparts.ts`, which imports only `dmath`,
`noise` and `prng`; `course.ts` re-exports them under the same names (`export { SAFE_LANE, ... } from
'./courseparts'`, so no importer changes and no value moves). Each mountain's file imports values only from the leaf,
`dmath`, `noise` and `prng`, and types only (`import type`) from `course.ts`, so it can be imported first (its own
test does) and `course.ts` can build `LAYOUTS` and `KITS` from it at module top.

**The table, with the five's row as today and the three proposed** (stage lengths from the concepts; the mountain
lanes may move theirs, never the five's):

| Field | The five (today) | The Old Run | Gullhaven | Gablefall |
| --- | --- | --- | --- | --- |
| stages | 1450 / 1500 / 1550 (4,500) | 950 / 1000 / 1050 (3,000) | 1550 / 1600 / 1650 (4,800) | 900 / 950 / 950 (2,800) |
| grammar | acts (`compose`, `pour`) | kit `oldrun` | kit `gullhaven` | kit `gablefall` |
| opening | start 120 m at 0.5, bowl 240 to 270, cruise 120 to 150, the first leap (lip 590 to 670) | the start house's straight, 160 m in the track | the beacon's moor, wide; the first gully's lip at 330 m or later | the church's nave (80 m, the start ramp), then the close (a square, the start gate), rows from about 200 m |
| first leap | the opening's | none | none (a gully is not a leap) | none |
| first kicker | 286 to 312 (296) | none | none | none |
| kickFrom, picketsFrom | 800, 900 | 800, 900: nothing reads them (no kind of the five's) | the same | the same |
| run-in light line | 130 m, 160 m long, 8 m apart, swing 110 m | none (the kit lays one up the first bend's wall) | the five's (the moor is open) | none (the kit lays one down the close) |
| finish kind, square, run-out | `finish`, 300, 260 | `outrun`, 120, 200 | `harbour`, 260, 200 | `quay`, 240, 240 |
| threshold kind, least half-width | `cruise`, 11 | `track` (a straight), 7.2 | `cliffpath`, 11 | `square`, 11 |
| banks and walls | per kind (`limit`, `wall`, `fall`); `bank()` past the edge | the track's cross-section and parapet (kit) | the sea side falls past a fence, the moor side banks (kit) | the street's fronts by level, the rows' backs (kit, section 7) |
| widths | `BIOME_PARAMS` 18 to 21 easing to 12 to 14 | the kit's: 7.5 square to the channel | 10 on the path, 18 at a gully (pinned) | 16 (pinned) |
| grade (`params.slope`; `rampDistance`) | 0.28 to 0.31; 4,500 (`DESCENT`) | 0.17; 3,000 | 0.16 (shelves) and each gully's grade; 4,800 | 0.22; 2,800 |
| colliders | `(7 + 15 d) x density x template x kind` | none | about 20 a km off the path (kit) | chimneys on the roofs, about 60 to 90 a km (kit) |
| charm gates | 110 m (`START_GATE_Z`), each line + 100 (`GATE_PAST_LINE`) | the same rule | the same | the same |
| events (section 8) | all four | the light storm, the spirit train | avalanche, storm, train | all four, the avalanche if proved |

**What stays shared on purpose** (rules a rider plays by, or promises every mountain keeps): `START_CLEAR_Z` 150,
`FREE_TUMBLE_Z` 700 (every fall before 700 m is free on all eight), `START_SPEED` 14, `START_GATE_Z` 110 and
`GATE_PAST_LINE` 100, `SAFE_LANE` 2.45, `EARLY_MARGIN`, get-ups and their 200 m, par's 24 m/s, `MAX_SPEED`, the
drag and friction, `bank()`'s curve, `CREST_LIMIT`, the leap and kicker constants (the three use none), the
threshold's `THRESHOLD_BEFORE`/`_AFTER` bounds (the kits lay their thresholds to them). Three more first-minute
numbers stay shared and do nothing on the three: no moguls before 300 m (2062; their `mogulChance` is 0), no wall
line before 500 m (2450; no `WALL_KINDS`), the tempting light line from 400 m (2588: it lays lights at
`centerX + 0.62 hw`, on the Old Run's walls, Gullhaven's moor and Gablefall's roofs, where its lights are fair).

**Every read site in `src/sim` and how it changes** (from `ground-readsites.mjs length|opening|thresholds`):

| Site (6255b8d) | Today | After |
| --- | --- | --- |
| `course.ts` 189, 191, 193 | `STAGE_LENGTHS`, `RUN_OUT`, `FINISH_SQUARE` | defined from `FIVE` (same values, same exports) |
| `course.ts` 913 to 927 `get stages` | `STAGE_LENGTHS.forEach`, names from `SCRIPTS[biome][acts[i]]` | `this.layout.stages.forEach`; names unchanged (each new biome's `SCRIPTS` row names its acts) |
| `course.ts` 971 `section()` | past the last section, `pushSection('finish', 400, 40)` | `pushSection(this.layout.finish, 400, 40)` |
| `course.ts` 1028 `opening()` | the five's opening | unchanged; only `pour` calls it |
| `course.ts` 1087, 1173, 1178 `pour()` | room from `STAGE_LENGTHS`, `FINISH_SQUARE`; threshold `'cruise'`; finish beat `'finish'` of `FINISH_SQUARE + RUN_OUT` | the same expressions on `this.layout` (only the acts grammar runs `pour`, so only the five's row is read) |
| `course.ts` 1237 `lay()` | `compose()`, then per beat the leap, terraces, lake and fork layers, `layBands` | `const beats = this.kit ? this.kit.compose(...) : this.compose()`; per beat the five's branch as is, else `this.kit.lay(...)`; `layBands` as is (section 2) |
| `course.ts` 1276 `pushSection` | `THRESHOLD_HW` | `this.layout.thresholdHW` (kits push their sections through it) |
| `course.ts` 1463 to 1472 `layKicks` | the first kicker at 286 to 312, always | `if (this.layout.firstKick) { ...the same loop on its from, to, at... }` |
| `course.ts` 1476, 1488, 1508, 1523, 2405 | `800` | `this.layout.kickFrom` |
| `course.ts` 2325 | `PICKETS_FROM` | `this.layout.picketsFrom` |
| `course.ts` 2485 to 2490 `placeLights` | `LIGHT_RUN_*` | `const run = this.layout.lightRun; if (run) for (...)` with its fields |
| `course.ts` 1718 `halfWidthAt` | the corridor's width | the kit's `halfWidth` first, where it has one (section 2) |
| `course.ts` 1854 `surface()` | a threshold's body is plain snow | unchanged for the five; the kit's surface is asked first (section 2) |
| `mountains.ts` 53 `DESCENT` | `rampDistance` of all five | unchanged; the three set theirs to their own length |
| `mountains.ts` 7 | `CourseBiome = BiomeId` | `BiomeId \| KitId`; `lookOf` maps a new biome to a borrowed look until its world lane widens `BiomeId` (Lanternfall's round 7 path) |
| `charms.ts` 112, 113; `sim.ts` 69 | `START_GATE_Z`, `GATE_PAST_LINE`, `FREE_TUMBLE_Z` | unchanged (shared rules) |
| `sim.ts` 2133 par, 3044 `cruiseSpeed` | `course.finishZ`, `course.params.slope` | unchanged: both read the course already |

---

## 2. The kit seam: one file a mountain (`src/sim/kit.ts`, then `oldrun.ts`, `gullhaven.ts`, `gablefall.ts`)

The three grammars share nothing with each other or with `pour` (the acts machinery assumes a first leap and a place
to pull up to meet it, and would throw `no descent` for a track). So each new mountain lays its own descent in its
own file and `course.ts` calls it through one narrow seam. It also lets the three mountain lanes work in their own
files, as the brief's M2 asks, with `course.ts` and `sim.ts` edited once, here.

```ts
// src/sim/kit.ts (types only from course.ts)
export interface KitBeat { kind: SectionKind; len: number; blend: number; gate?: true }
export interface KitPlan { clear: Band[]; busy: Band[]; narrow: Band[] }   // course.ts's own bands, to keep features out
export interface Placer { clearOf(x: number, z: number, r: number): boolean; add(kind: ObstacleKind, x: number, z: number, r: number, h: number, y?: number): void }
/** What a rider is, for the line it rides (the bot and the lab's pilots ask; nothing is drawn from a generator). */
export interface Rider { x: number; y: number; z: number; v: number; skill: number; nerve: number }
export interface Kit {
  readonly id: KitId;
  /** The descent: beats in order, stage room filled exactly, a threshold (gate: true) across each stage line within
   *  THRESHOLD_BEFORE..BEFORE_MAX above it and AFTER_MIN..AFTER below, ending with layout.finish of square + runOut. */
  compose(c: Course, rng: Rng, blendOf: (k: SectionKind, prev: SectionKind | null) => number): KitBeat[];
  /** Each section as it is laid (where lay() calls the leap and the rest for the five). It pushes the bands its kinds
   *  need: a threshold's clear and busy band over the section and its finish's to the run-out's end, as layBands does
   *  for the five's 'cruise' gate and 'finish' (1426 to 1436), which it does not for a kit's kinds. */
  lay(c: Course, sec: Section, rng: Rng, plan: KitPlan): void;
  /** Optional hooks, each called only where it is defined (constructor-time booleans on Course): */
  centre?(c: Course, z: number): number;                      // the centre line, replacing the wander
  slope?(c: Course, z: number): number;                       // the centre line's dx/dz (the track's p)
  halfWidth?(c: Course, z: number): number;                   // the corridor's half-width in x
  ground?(c: Course, x: number, z: number, h: number): number; // the bare ground's own term
  surface?(c: Course, x: number, z: number): Surface | null;
  lift?(c: Course, x: number, y: number, z: number): number;  // upward m/s^2 at full gravity; 0 outside every zone
  liftX?(c: Course, z: number): number | null;                // a column's middle at z, or null
  street?(c: Course, z: number): Street | null;               // Gablefall's held street (section 7)
  obstacles?(c: Course, chunk: Chunk, rng: Rng, p: Placer, diff: number): void;
  lights?(c: Course, chunk: Chunk, rng: Rng, diff: number, push: (x: number, z: number, hover: number, value: number) => void): void;
  lineFor?(c: Course, z: number, r: Rider): number;           // the line a rider of this kind, here and now, rides at z
  raceX?(c: Course, z: number, v: number): number;            // the Old Run's settling line for a speed
  lips?(c: Course, z0: number, z1: number): readonly { z: number; x0: number; x1: number }[]; // where a pop pays
}
const KITS: Partial<Record<CourseBiome, Kit>> = { oldrun: OLDRUN_KIT /* , the other two with their lanes */ };
```

**Where `course.ts` calls it** (each behind a field set in the constructor from `KITS[this.params.biome]`, all `null`
or `false` for the five):

| Hook | Call site | Guard |
| --- | --- | --- |
| `compose`, `lay` | `lay()` (1237): the kit's beats replace `compose()`; per beat `kit.lay` replaces the leap/terraces/lake/fork branch; `layBands`, `layKicks`, `layFields`, `layRails` still run and find no kind of theirs (every kind a kit lays is its own) | `this.kit` |
| `centre`, `slope` | first line of `centerXAt` (1697); new `channelSlope(z)` (0 without) | `this.ownCentre` |
| `halfWidth` | first line of `halfWidthAt` (1718) | `this.ownWidth` |
| `ground` | last line of `bareGround` (1794), so `ground()`'s zones still add on top | `this.ownGround` |
| `surface` | first line of `surface` (1851), before the threshold's snow | `this.ownSurface` |
| `lift`, `liftX` | new `liftAt(x, y, z)` (0 without), `liftX(z)`, `hasLift` | `this.hasLift` |
| `street` | new `streetAt(z)` (null without), `hasLevels` | `this.hasLevels` |
| `obstacles` | `buildChunk` (2139), after the five's placements, before `placeLights` | `this.kit?.obstacles` |
| `lights` | the end of `placeLights` (2469) | `this.kit?.lights` |
| `lineFor`, `raceX`, `lips` | new public `lineFor(z, r)` (the safe line without), `raceX(z, v)` (the safe line without), `lips(z0, z1)` ([] without) | `this.kit?.x` |

The kits lay **only kinds of their own**: every kind a new mountain uses is new, so the five's shared fill
(`buildChunk`'s slalom rows, pickets, splits, tree runs, fork risks), `layKicks` (`KICK_KINDS`, `KICK_WITHIN`),
`layFields` (`MOGUL_KINDS`, bowls, the fallback field), `layRails` (`RAIL_KINDS`, `RAIL_SPARE`, `RAIL_LAST`),
`wallLines` (`WALL_KINDS`) and `PLACE_LINES` never find one. Each new kind's `SHAPES` row carries `obstacles: 0` and
`BARE`, and its `BLEND`, `BODY`, `GRADE` and `WIDTH` rows. Two `Record<SectionKind, number>` tables outside the sim
must gain the new keys to keep `tsc` green: `src/audio/listen.ts` 102 (`OPEN`) and `src/render/landmarks.ts` 150
(`SPAN_CHANCE`); the groundwork adds neutral values (`OPEN` 0.3, no spans) and lists the hunks for the world lanes.

---

## 3. The sim's hooks (`src/sim/sim.ts`)

Constructor (474), in its body after `this.course` is set: `this.trackOn = this.course.layout.grammar === 'oldrun'`,
`this.liftOn = this.course.hasLift`, `this.levelOn = this.course.hasLevels`. Nothing else in the constructor changes.

**A. The track's ground step (the Old Run).** Inside `groundStep` (1109), four changes, each inside `if
(this.trackOn)` with the five's statements as they are in the `else`. `phi = atan(course.channelSlope(z))` is the
channel's own direction at the sled (not `lineHeading()`, which looks 9 + 0.45v m ahead and so leads a bend's
tangent by up to 0.4 rad).

1. *Gravity along the runners* (1116 to 1118). The five's step moves the sled by the heightfield's gradient divided
   by `n2 = 1 + |grad|^2`; on a wall with cross slope 2, `n2` is 5 and the drive along the track falls to a fifth, so
   the glaze would be the slow line (the review's blocker). On the track gravity acts along the sled's own path,
   as on a runner: `const sv = (vec.x * s.vx + vec.z * s.vz) / speed; s.speed -= (g * sv) / (1 + sv * sv) * DT;`
   with its direction unchanged. Running along a wall's contour the drive is the channel's grade, whatever the wall;
   climbing the wall costs speed and coming down pays it back ("the drop pays speed").
2. *The bank turns the sled* (after the berm turn-back, 1178): `s.heading -= wallYaw(vec, phi, s.speed, g) * DT`,
   exported for the bot:
   ```ts
   /** How fast a banked surface turns a carving sled: its rise toward the channel's right, times g, over the speed. */
   export function wallYaw(grad: { x: number; z: number }, phi: number, speed: number, g: number): number {
     return (g * (grad.x * dcos(phi) - grad.z * dsin(phi))) / (speed > 8 ? speed : 8);
   }
   ```
   With the mood's gravity (`this.gravity`), as the lift takes it. In a bend of radius R a sled holds a height on the
   outside wall where `g tan(theta) / v = v / R`: `tan(theta) = v^2 / (g R)`, the real banked turn. Steering into the
   wall at the turn rate (0.77 rad/s at 36 m/s) beats the wall's yaw there, so a rider can hold the glaze above its
   settling height.
3. *Damping, not the ease* (1165 to 1172). Wall yaw alone is a spring: lateral motion obeys
   `d'' = v^2/R - g * gx(d)`, with a period of 2.5 s on the deepest wall, and a bend is shorter than that, so a sled
   let go would overshoot its height by half and reach the lip (the review's finding 2). On the track the let-go
   ease and its lean are replaced by `s.heading += clamp(phi - s.heading, -1, 1) * TRACK_DAMP * DT`, always on
   (steering or not). It works on the heading's difference from the channel's direction, which is the sled's sideways
   speed over its speed, so it damps the swing and leaves the settling height alone (at a held height the heading is
   the channel's). `TRACK_DAMP` about 3.5 gives a damping ratio near 0.7 on the 7.5 m wall (`omega = sqrt(2 g H) / W
   = 2.47`); a rider steering against it at 0.77 rad/s still climbs at about 8 m/s.
4. *The launch* (1259). The five's test launches when the ground's follow speed drops faster than gravity. On a
   tilted surface a turn changes the follow height by the slope times the sideways change, and *worked*, steering down
   a 30 degree wall at 36 m/s gives 16 m/s^2 against the 14.7 that launches. On the track the test asks only whether
   the ground fell away below the plane the sled is on, with no stored state:
   ```ts
   const launch = this.trackOn
     ? ny < s.y + (vec.x * s.vx + vec.z * s.vz) * DT - g * stick * DT * DT * 1.5   // below the slope's own prediction
     : vyFollow < s.vy - g * stick * DT * 1.5;                                      // (the five's, unchanged)
   ```
   On flat ground it is the five's test. A crest (the ground curving away along the path) launches; a turn within a
   wall does not.

**B. The track's turn-back.** `edge()` (2077), inside `if (this.trackOn)`: the excess is measured square to the
channel (`(|x - cx| / sqrt(1 + p^2)) - 7.5`), and the reflection takes the velocity's part along the channel's
outward normal `side * (1, -p) / sqrt(1 + p^2)`, not `vx` (at `p` 0.7 a sled running beside the wall has `vx` of
0.57 of its speed, which the five's reflection would read as 20 m/s into the wall). For a grounded sled it also puts
the sled back on the ground it is turned back onto (`s.y = ground(x, z)`, `s.vy` from the gradient and the new
velocity): the five's turn-back moves `x` and leaves `y`. A sled in the air keeps its `y`.

**C. Lift (Gullhaven).** In `airStep`, right after gravity (1569):
`if (this.liftOn) { const a = this.course.liftAt(s.x, s.y, s.z); if (a > 0) s.vy += a * this.mood.gravity * DT; }`.
Scaled by the mood's gravity, so Comet Night's lift keeps its share. `landingWithin` (1647), which sets the rider for
touchdown and guards flips, integrates tick by tick with the lift when `this.liftOn` (else its closed form, as now).

**D. The held street (Gablefall).** In `edge()`, before the five's turn-back: `if (this.levelOn)`, a sled below the
street's hold height is turned back at the street's sides by the street's own scrape unless the side is open there
(section 7). A sled above it rides on.

**E. What stays.** `collide`, `pickups`, `tumbleStep`, `lines`, `coast`, `crossGates`, `chaos` (but see section 8),
`momentStep` (new verbs come with the mountain lanes as new `case`s), the record, the input byte, tricks, charms and
scoring (section 8 on the Old Run's style). A new obstacle kind floors a rider by the five's rule (`HIT_HARD`,
`HIT_FAST`); its cause stays `'rock'` until Gablefall's lane names chimneys in `CrashCause` and the game's
`crashText`.

---

## 4. The bot's hooks (`src/bot`)

Every new branch is guarded by the course, and **no new branch draws on `this.rng` unless its guard is true**, so a
bot on the five draws the same numbers in the same order (the fingerprint's bot rides prove it). `lines.ts` does not
change: its cache holds the safe line, and the kits' lines are asked per thought instead.

- *The line, per thought* (`bot.ts` `lineX`, 559): on a course with `lineFor`, `+ this.kitOff(z)`, where `kitOff =
  course.lineFor(z, rider) - lines.safeX(z)` for the rider as it is at this thought (`x`, `y`, `z`, `v`, `skill`,
  and `nerve = t.ambition * (0.2 + 0.8 * t.skill)`, the fork coin's own odds but read, not drawn), cached for the
  thought. So Gullhaven's per-gully choice (soar it if the speed 60 m out allows, by nerve) and Gablefall's level
  (the ridge of the row it is on, or the street until the next drift it can reach) follow the rider, not a coin at
  birth. A choice once made for a gully or a row is kept until it is passed (a small map in the bot, made only on a
  kit course).
- *The air* (`model.ts` `predictFlight`, 24): an optional `lift?: (x, y, z) => number`, added as
  `lift * (gravity / G) * DT` right after gravity, as the sim does; the bot passes it only when `course.hasLift`.
  In the air over a column its nudge holds `course.liftX(z)` as it holds a ring's line.
- *The track* (`groundThink`, 1032): the heading it predicts over its reaction lead adds the sim's own `wallYaw` and
  `TRACK_DAMP` terms, so its steering is not a beat behind the wall; its line is `raceX(z, v)` scaled by skill
  (section 5).
- *Lips* (`lookForGoals`, 937): a `lip` goal beside `kicker`, from `course.lips(z, z + speed * 2.5)`, pressed before
  the lip and released at it, judged by `popFlight` (with the lift) and `flightClear` against the rider's line. Built
  by Gullhaven's lane, used by Gablefall's.
- The lab's pilots (`scripts/playtest/labpilots.ts`) import nothing from `src` and read the course they are given, so
  the same `lineFor`, `raceX` and `lips` reach them through `sim.course` where present.

---

## 5. The Old Run: ride the wall

**Course** (kit `oldrun`, `src/sim/oldrun.ts`). New kinds:

| Kind | Shape (`SHAPES`) | Grade | What it is |
| --- | --- | --- | --- |
| `track` | `pin 1, span 0, wander 0, relief 0, obstacles 0, limit 0.5, ...BARE` | `[0.17, 0.17]` | the channel: straights, and bends of radius 60 to 140 m |
| `labyrinth` | as `track` | `[0.17, 0.17]` | three S-bends close together, radius 40 to 60 m |
| `outrun` | `pin 1, span 0, relief 0, obstacles 0, limit 0.5` | `[0.04, 0.06]` | the flattening to the timing house: the finish |

Acts: the Hotel Straights (the start house's 160 m straight, two long S-bends), the Labyrinth, the Horseshoe (one
long hook, the deepest bank) into the outrun. Each stage line's threshold is a `track` straight (gate), at least
190 m, its floor and both walls clear; the arches' sides (4.6 m off the line) sit low on the straight's walls.

*The centre line* (`centre`, `slope`): a sum of turns, each easing the line's slope `p = dx/dz` from one value to
the next over its length with a smoothstep, so `x(z)` is that sum's integral in closed form and its curvature is at
most `1.5 dp / len`. Bends keep `|p| <= 0.7` (35 degrees off the fall line, the five's own limit: the chase camera,
the terrain's fine band and everything that measures progress in z assume it) and radius `>= 40 m`. *The concept's
60 degree Horseshoe becomes a hook of about 35 degrees that holds for 150 m and turns back*: a 60 degree turn in a
course measured in metres downhill halves progress in z for its length and runs the track out of the terrain's fine
band. The Horseshoe's depth is its wall (7.5 m) and its length, not its angle.

*The cross-section* (`ground`), square to the channel: with `q = sqrt(1 + p^2)`, `d = |x - cx| / q`, floor
half-width `F = 2.6`, wall width `W = 4.9`, lip at `d = 7.5`: floor `d <= F` flat; wall `H_side(z) * ((d - F) / W)^2`;
past the lip a parapet that keeps rising (1.2 m over 0.6 m, concave) so the lip is never a crest. `halfWidth` (kit)
is `7.5 q`, the channel's lip in x. `H_side` is 2.6 on a straight and on a bend's inside; the outside wall (the side
the channel turns away from, `-sign(dp/dz)`) rises to its bend's height (up to 7.5 at radius 60 or tighter) on **its
own smooth profile, authored a bend at a time**: a smootherstep over at least 70 m before the bend and 70 m after,
the cap applied to the authored target, not to a curvature read at each z. *Why:* tied to curvature with a hard cap,
the wall's slope under a sled at u 0.75 jumped by about 0.23 in a tick at the cap, a 0.25 m/s launch threshold met
by 8 m/s (the review's finding 4). The rule is `u^2 |H''| v^2 < 1.5 g` at u 1 and 46 m/s: `|H''| <= 0.0069`, which a
4.9 m rise over 65 m or more meets. The wall's slope at the lip is `2H/W`: 1.06 (47 degrees) on a straight, 3.06 (72
degrees) at the deepest.

*Where a sled settles* (*worked*, `tan(theta) = v^2 / (g R)`; u is the share of the wall's width up):

| Wall, bend | 18 m/s | 24 | 30 | 36 |
| --- | --- | --- | --- | --- |
| 7.5 m, R 60 | 0.18 | 0.32 | 0.50 | 0.72 |
| 7.5 m, R 90 | 0.12 | 0.21 | 0.33 | 0.48 |
| 5 m, R 90 | 0.18 | 0.32 | 0.50 | 0.72 |
| 7.5 m, R 40 | 0.27 | 0.48 | 0.75 | the lip |

The slush rider sits low, the glaze rider high, and at 36 m/s the Labyrinth's tightest bends reach the lip: speed
there is scrubbed (a drift) or the lip scrapes it off. That is the Labyrinth's skill.

*Surfaces* (new constants; `ice` decides the ice charms, section 8):

| Surface | grip | drag | ice | Where | Settles at on 0.17, along the contour (*worked*) |
| --- | --- | --- | --- | --- | --- |
| `TRACK_ICE` | 0.8 | 0.55 | false | straights, floor and walls; a bend's walls below the glaze | 29.9 m/s, tucked 33.0 |
| `GLAZE` | 0.85 | 0.4 | true | a bend's outside wall, u 0.5 to 0.85, where the wall is 4 m or more | 35.0, tucked 38.7 |
| `SLUSH` | 1 | 1.6 | false | a bend's floor (curvature over a third of the deepest) | 17.5 |

With gravity along the runners (hook A1) these hold on the wall as on the floor: the concept's figures (about 36 on
the glaze, about 18 in the slush) stand on paper.

*What a fall is here:* nothing in the track floors a rider. No colliders, the lip scrapes (hook B), no kicker. Only
a pop's flight of 0.75 s or more landed badly falls, by the five's rule. *The HUD signal:* none new; the glaze shines
and hisses, the slush sprays dull (the world lane's), and the stage card names each bend's split.

*The five never enter:* `trackOn` is false on every acts-grammar course; the kit's hooks are not installed on them;
the fingerprint proves it, and a test asserts `trackOn`, `liftOn` and `levelOn` are false for the five and every
Daily.

**The bot.** It reads the wall from the course, not a pool: `raceX(z, v)` is the outside wall's settling height for
the speed it carries (the table above), clamped under u 0.85. It aims there by skill (`lineFor`: the floor for the
careful and the novice, who let the walls turn them; up to the glaze band's top for an expert), and its heading
prediction carries the wall's yaw and damping. *The lab checks before any pool:* a sled let go on the floor into each
bend overshoots its settling height by 15% or less and never reaches the lip at the course's own speeds; the mid and
expert bots spend most of each bend on the glaze and scrape under once a bend; the glaze line beats the floor line
(the careful pilot) by 10 to 20%.

**Its own promises** (`tests/oldrun.test.ts`): the floor's middle (the safe line) is clear for the whole track; a
sled that never steers reaches the line on every seed (the walls turn it); along lines at u 0.3, 0.5, 0.7, 0.85 and 1
on both walls the ground has no crest over the launch limit at 46 m/s; no wall launches a sled that does not press
(the lab's careful and clumsy pilots leave the ground only on their own pops); the lip never launches (every
turn-back leaves a grounded sled grounded); `|p| <= 0.7` and radius `>= 40 m` everywhere; the clumsy pilot finishes
30 of 30.

---

## 6. Gullhaven: ride the sea wind

**Course** (kit `gullhaven`). The sea is on the rider's right (+x) all the way down (a mirror flips it as it flips
everything). New kinds, and only these (the concept's `chute` and `street` become kinds of its own, so the five's
shared fill, kickers, fields, rails and place lines never reach Gullhaven):

| Kind | Shape | Grade | Width (half) | What it is |
| --- | --- | --- | --- | --- |
| `cliffpath` | `pin 1, span 0.25, wander 0.4, relief 0.5, obstacles 0, limit 0.8, ...BARE` | `[0.15, 0.17]` | `[9.5, 10.5]` | the clifftop path: the moor rises on the left, the cliff falls to the sea on the right past a fence; also the threshold |
| `geo` | `pin 1, span 0.1, limit 0.8, relief 0.3, obstacles 0, ...BARE` | its own (below) | `[17, 19]` | a gully crossing: the path round its head, its lip and mouth to the right |
| `descent` | `pin 1, span 0.3, wander 0.35, wave 1.7, obstacles 0, limit 3, ...BARE` | `[0.36, 0.4]` | `[7, 8]` | the cut down to the harbour |
| `sheds` | `pin 1, span 0.25, relief 0.2, obstacles 0, limit 2, ...BARE` | `[0.18, 0.22]` | `[8, 9.5]` | between the fish sheds |
| `harbour` | `pin 1, span 0.15, relief 0, obstacles 0, limit 3` | `[0.02, 0.03]` | `[13, 15]` | the finish on the harbour's ice |

About ten gullies, one every 450 m, the first lip at 330 m or later.

*The sea side* (`ground`): seaward of the path's edge the bank is replaced by the cliff,
`h - bank(e) - SEA_DROP * smoothstep(1, 9, e)` (`bank` from the leaf module), SEA_DROP a hundred metres or more. The
fence is the `edgeLimit` 0.8, so a sled is turned back (a scrape) before the fall's lip at 1 m, on the ground or in
the air (`edge()` runs for a flying sled too, `sim.ts` 820). `limit` is one number for both sides, so the moor side
is turned back at 0.8 too: a dyke along the path, which the world draws.

*A gully* (`geo`), laid by the kit with a lip `zL`, a drop `S` (about 26 m), a head and a mouth `M` long (about 90
m). Its geometry is chosen so a rider who is not steering stays on the path:
- *The corridor follows the path.* The kit's `centre` goes round the head with the path: the path's middle is the
  corridor's centre and the safe line (`span 0.1`, no shift). The gully's mouth lies seaward of it as an annex inside
  the corridor's 18 m half-width: its head's inner edge 7 m seaward of the centre, the soaring lane from 9 to 16 m.
  So the let-go heading and `lineHeading` (which follow `centerX`, 1101 to 1106 and 1165 to 1171) and the clumsy
  pilot (which aims at `centerX` +-2.5 m, `labpilots.ts` 77 to 79) all hold the path. (In the first draft the centre
  ran along the head's edge and every rider not actively steering the safe line rode into the gully: the review's
  finding 5.)
- *Inland, round the head:* the geo's own grade carries the drop: `GRADE` for the section is the shelf's 0.16 plus
  `S` over its body, so `baseY`'s own slope integral descends `S` across the section, blended in and out by
  `blendOf` (which keeps every grade change under `CREST_LIMIT`). No ledge, so nothing that reads `ledges` or
  `zones.drops` (the terrain's fine rows, `bot.dropAhead`, the fairness suite's meant spans, `railAt`) sees a 250 m
  drop that is not one. The path's steepest grade is about 0.32; it has no crest.
- *Seaward of the head:* the shelf holds its level to the lip (the kit adds back the descent the geo's grade made
  since its start), then a leap's landing face falls `S` (the five's face profile: `face0` 0.3, `FACE_BEND`,
  `FACE_TOP` 0.8, held, eased), reaching the far shelf's level by the section's end:
  `h += w(x) * (extra(z) - face(z))`, `w(x) = smoothstep(7, 19, x - cx)`. Before the lip the seaward shelf stands
  above the path, a bank the rider climbs (concave from the path: no launch); after it the head's inner edge falls
  away over 12 m, which a sled drifting off the path at up to 6 m/s sideways rides down without leaving the ground
  (its crest curvature under `CREST_LIMIT` at that speed). At the section's ends both terms are 0 or both `S`.
- *The bold line* runs straight over the mouth, 12 m seaward of the centre. *The lift* (`lift`, `liftX`): one static
  box a gully over the mouth, `x` from `cx + 9` to `cx + 16`, `z` from `zL` to `zL + M`; inside it `LIFT * G` with
  LIFT about 0.65, outside 0. Always below gravity, so the air never carries a sled up: it slows the fall. Pure in
  `(x, z)`, so the same for every rider and every replay.

*Worked flights* off a 26 m face, the column 90 m long: no lift, 24 m/s plain: 2.3 s, 55 m (the leap face catches
it); 0.6 g, 28 m/s popped: 4.8 s, 135 m; 0.7 g: 5.3 s, 148 m; 0.7 g, 24 m/s plain: 4.2 s, 100 m. The concept's three
to five seconds sit at about 0.6 to 0.7 g; the lab sets it.

*What a fall is here:* the five's. Rocks and fishermen's huts off the path (about 20 a km, by the kit's `obstacles`;
nothing within the lane). A soared flight of 0.75 s or more landed with the board wrong. A rider short of the far
shelf comes down on the gully's face (no steeper than 0.8) and rides it to the shelf. Nobody goes over the cliff: the
fence turns every sled back. *The HUD signal:* none new (spindrift up the column, gulls hanging in it, the fence's
flags standing up: the world lane's). The terrain's fine rows over the face are the world lane's to ask of the kit
(it has the face's span), not a drop zone.

*The five never enter:* `liftOn` false, `liftAt` not called (the guard), `landingWithin` keeps its closed form, the
geo's grade and face are a kit's.

**The bot.** `predictFlight` carries the lift. `lineFor` gives a rider the bold line into a gully when its speed 60 m
out is at least 24 m/s plus a margin its nerve lowers, else the path; it pops at the lip (a `lip` goal), and in the
air its nudge holds `liftX`. *The lab check:* the mid and expert soar most gullies (7 of 10 or more) and land on the
far face or shelf; the novice takes the path and soars few; nobody passes the fence.

**Its own promises** (`tests/gullhaven.test.ts`): the safe line never meets the mouth (`w(safeX) = 0` with 4 m to
spare) and its lane is clear; a sled let go on the path from 20 m before each gully stays on it; every lip, ridden on
the bold line at 24, 30 and 36 m/s plain and popped on the real sim, comes down on its face or the far shelf with the
landing's slope no steeper than 0.8, and slower lands on the face; the fence turns back every sled (no pilot's `y`
ever below the shelf's level less 30 m); the lift acts only on a sled in the air and is a pure function; a gully at
least every 600 m; the clumsy pilot finishes 27 of 30 or better.

---

## 7. Gablefall: roof to roof

The hardest of the three for this sim, because its ground is one height a point: a roof over a street is a step in
it, and a sled that meets a step from below is lifted onto it in one tick (`land()` and the ground step both set `y`
to the ground). The design makes every step one a sled can only leave from above, and holds every sled that could
meet one from below.

**Course** (kit `gablefall`). New kinds:

| Kind | Shape | Grade | Width (half) | What it is |
| --- | --- | --- | --- | --- |
| `nave` | `pin 1, span 0, obstacles 0, limit 1, ...BARE` | `[0.4, 0.4]` | `[6, 6]` | the start: down the church's nave from the steeple, 80 m |
| `square` | `pin 1, span 0.25, obstacles 0, limit 2, ...BARE` | `[0.08, 0.12]` | `[11, 13]` | the close at the top, and each stage line's threshold (a market place) |
| `rooftops` | `pin 1, span 0, wander 0.3, wave 1.6, relief 0, obstacles 0, limit 0.6, ...BARE` | `[0.21, 0.23]` | `[16, 16]` | the street and a row of roofs either side |
| `quay` | `pin 1, span 0.15, relief 0, obstacles 0, limit 2, ...BARE` | `[0.03, 0.05]` | `[12, 14]` | the finish: the quay and the river's ice |

*The street:* the middle of `rooftops`, `|x - cx| <= 4.5`, at the course's own level (`baseY`); the safe line is its
middle (`span 0`). Its surface is `COBBLES` (grip 1, drag 1.25: the street is the slow way).

*The rows:* each side a row of houses from `6.0` (the fronts stand 1.5 m back from the street's edge) to `hw` 16, so
10 m deep, laid as blocks between alleys, each block 2 to 4 houses of 14 to 20 m. A house's roof: eave 6 m over the
street at the house's top, falling along z at `ROOF_GRADE` (about 0.14), then a step down to the next house of the
difference (`(0.22 - 0.14) x L`, 1.1 to 1.6 m); across, a gable whose ridge runs down the row's middle, pitch about
0.35, rounded over 4 m so a sled crossing it sideways is not thrown (*worked:* it stays on below 7.7 m/s across).
*Worked hops:* a 1.4 m step at 28 m/s flies 0.53 s and 15 m, so a roof rider lands every house; a perfect landing's
boost (2.5 m/s and more with a trick) is what keeps the roofs faster than the street, since a landing on level ground
keeps none of the drop (`land()`'s along-slope gain is for falling ground; a roof falling at 0.14 gives some back).
The rows end at least 60 m before the line, so nobody crosses it on a roof (`coast()` snaps a sled to the ground).
- *Alleys* cross each row between blocks, 4 to 8 m: the ground drops to a snow-filled floor 2.5 m under the eave,
  then rises up a drift against the next block's gable to its first roof, which is lower than the last. The drift's
  surface at its top **is the next roof's surface at every x** (gable and all), blended along z from the alley's
  floor, so no x along it meets a step. *Never a roof higher than the last* (the concept's "sometimes level or
  higher"): a sled flying short of a higher roof would be lifted onto it.
- *Corner drifts* from the street onto a row: one at least every 250 m, sides alternating, about 24 m long. At every
  x across the row the drift rises along z from the street's level at its foot to the roof's surface at that x at its
  top (gable and all), and across x at its foot it meets the street flush. Because the street falls at 0.22 the drift
  is nearly level in absolute height (it rises 6 m over a street that has fallen 5.3 m).
- *Chimneys* (`ObstacleKind 'chimney'`, radius 0.5 to 0.7, 1.6 to 2.2 m over the roof) stand beside the ridge,
  never within 1.5 m of it; weave them, or be over them in the air.

*The held street* (`street`, hook D): `{ x0: cx - 4.8, x1: cx + 4.8, y: street level, hold: 5, open(side) }`. A sled
whose `y` is under `street + 5` (the eave less 1 m, above any pop's peak: Powder Day's 2.2 m, Comet Night's 2.1 m)
is held between `x0` and `x1` by the street's own scrape, on the ground or in the air, **except where `open(side)`**:
over a corner drift's first metres, where the drift is within 0.1 m of the street's level, so a street sled can only
steer onto a drift at its foot. The roofs begin at 6.0, so a held sled, even moving sideways at 70 m/s, never samples
a roof. A roof sled that leaves the front eave falls into the street (it is above the hold until it has fallen past
the eaves, then held); one that leaves the back is turned back by the corridor's edge (`hw`, `limit` 0.6). No house
front is a collider: one would be a capsule 14 to 60 m long, which neither the sim's three-chunk window nor the bot's
3.2 m `REACH` can hold, and as short colliders the street would hold about 670 a km.

*What a fall is here:* a chimney met head on (the five's rule); a flight of 0.75 s or more landed wrong (off a roof
into the street is 1.1 s). A house front never floors anyone (a scrape). *The HUD signal:* none new (the roof run
reads as the combo's chain; the stage card says the row ahead).

*The five never enter:* `levelOn` false; `streetAt` not called; `'chimney'` is placed by the kit alone.

**The bot.** `lineFor` gives a rider its level's line: on a roof (its `y` 2 m or more over the street) the ridge of
the row it is on; in the street the street, until a corner drift on a side it can reach comes within its look, then
the drift's foot. It pops at each step and alley (`lips`), judged by `popFlight` on the real ground (`course.ground`
holds the roofs), and weaves chimneys with its own collider scene (they are ordinary obstacles). The held street
reaches its planning as the street's bounds while it is low (`Lines.edgeExcess` is the corridor's 16 m; `lineFor`
keeps a street rider's line inside 4.8). *The lab check:* the expert spends 85% of the run on the roofs and the novice
under 30%; the roofs beat the street by 10% or more for the mid pilot; the clumsy pilot finishes.

**Its own promises** (`tests/gablefall.test.ts`): the street's lane is clear; along every line across the rows (every
0.5 m of x) the ground never rises in z by more than a drift's own slope, and only on a drift; every drop from a roof
lands on ground at most 9 m lower; a corner drift at least every 250 m; the ridge is clear of chimneys by 1.5 m; a
sled under the hold is held everywhere but a drift's foot, and no pilot's `y` ever jumps up by more than 0.5 m in a
tick; the clumsy pilot finishes 27 of 30 or better. *Low's cost* is the world lane's and is measured before the world
is built (DECISIONS 392); the sim adds no draw.

---

## 8. Chaos, moods, charms and style on the three

- *Events.* `Layout.events` (a bit each by `ChaosEvent`) says which mid-run events a mountain can meet.
  `rollChaos(seed, runIndex, lastMood, allowed = ALL_EVENTS)` (`chaos.ts` 157) turns an event its mountain cannot
  meet into `None` right after drawing it, before the legend's own stream is read, so such a run may roll a legend;
  with every bit set (the five, every Daily and Cup) it draws and returns exactly what it does today (the
  fingerprint's chaos digest). Its callers pass `eventsFor(<the mountain's seed>)`: `app.ts` 1522 (whose `seed`
  argument there is the chaos seed, so the mountain's comes from `this.mountain.seed`) and `bot/pool.ts` 77 (the
  pool's course seed); the Trials' pick (`trial.ts` 150) and the Long Night's `legChaos` (`modes.ts` 39) filter the
  same way. The sim also ignores a disallowed event (its `triggerZ` is `Infinity`), so a crafted record cannot run
  one. Proposed: the Old Run meets the light storm and the spirit train (an avalanche at 0.87 of its 22 m/s cruise
  catches a slush rider, and a yeti has no room to cross a 15 m channel); Gullhaven the avalanche, storm and train
  (a yeti would walk out of the sea); Gablefall all four, the avalanche only if the fairness suite's "a clean,
  boost-free rider outruns it in every mood" holds there.
- *Moods.* All six, unchanged. The lift and the wall's yaw take the mood's gravity. Glass Ice's grip makes the wall
  slip more and the roofs harder to stomp: the lab rides each mood once a mountain.
- *Charms.* Dealt as everywhere from the record's pool. Frost Runners and the Black Ice pair bite only where a surface
  says `ice` (the glaze, the harbour, the river). Charms with nothing to act on (Bell Rope with no rails) are a pick a
  rider can misjudge, as Frost Runners already is on Ember. If the mountain lanes' charm races show one decides too
  much, the game layer narrows that mountain's pool (`SimConfig.charmPool`, which the record carries); the sim is not
  touched.
- *Style on the Old Run.* The five's wall ride counts only 1.2 m past the corridor's edge (1180) and the track's walls
  are inside its corridor, so as the rules stand the Old Run pays no wall ride: its style is drifts, carves, pops and
  the set pieces. Counting ticks on the glaze as a wall ride would pay it and hold the combo (`hold`, 832) through
  about 60% of the run: that changes what scores on one mountain, which the rules keep as they are, so it is a
  question for the owner (question 3), not a tuning. The design builds without it.
- *The Long Night's carry and the get-ups* are unchanged; `cruiseSpeed()` reads the mountain's slope, so a get-up on
  the Old Run pushes off at 11.1 m/s (22.2 x 0.5) where the five give about 14.7.

---

## 9. `FINISH_Z` from the course (the game layer)

`standing.ts` keeps `FINISH_Z` (the five's 4,500, the distance missions' cap, every test's fixture) and gains
`finishZOf(seed) = finishZFor(seed)`. Each read, and how it changes (every change defaults to today's value, so the
five's figures are identical):

| Site | Today | After |
| --- | --- | --- |
| `standing.ts` 47 `recordStanding(r)` | finished when `distance >= FINISH_Z` | `recordStanding(r: { ticks; distance; seed?: number }, finishZ = r.seed !== undefined ? finishZOf(r.seed) : FINISH_Z)`: every record carries its seed, so links, grudges, bests and friends need no caller change |
| `standing.ts` 116 `predictedTime` | default `FINISH_Z` | unchanged; callers below pass the course's |
| `app.ts` 2901 results' `finishZ` | `FINISH_Z` | `sim.course.finishZ` |
| `app.ts` 3202 | `predictedTime(you.distance, t)` | `predictedTime(you.distance, t, this.run.sim.course.finishZ)` |
| `app.ts` 2510, `challenge.ts` 77 | `recordStanding(fr)`, `recordStanding(rec)` | unchanged (the record's seed) |
| `challenge.ts` 44 `targetZ(o)` | `min(o.distance, FINISH_Z)` | `min(o.distance, finishZOf(o.seed))` (an `OldLink` has its seed) |
| `field.ts` 147 `poolTime(g)` | `predictedTime(g.distance, g.ticks / 60)` | `poolTime(g, finishZ = FINISH_Z)`; `pickField` passes `i.finishZ` (a new optional `FieldInput` field, set at `app.ts` 1188 from the course); `league.ts` 33 is the Cup's (five grammar) |
| `field.ts` 301 `check()` | `recordStanding(r)`, `predictedTime(...)` | the record's seed for both |
| `field.ts` 353 `wreckOf`, 480 `rivalOf` | `>= FINISH_Z` | `>= (i.finishZ ?? FINISH_Z)`; `rivalOf(field, anchor, promised, finishZ = FINISH_Z)` |
| `field.ts` 169 `anchorFor`, 113 `FIRST_RUN_PACE` | other keys' times x1.1 when this key has none; clamped 100 to 420 s; a first run's pace per key | another key's times scaled by `finishZOf(this) / finishZOf(that)` before the median; the clamp scaled by `finishZ / 4500`; `FIRST_RUN_PACE` gains the three (the lanes' lab medians) |
| `ghosts.ts` 468, 487 | `reading(z, FINISH_Z)`, `stringOffset(..., FINISH_Z)` | the field's own `finishZ` and last stage's length, set at the race's start (as `rivalProbe` takes `course.finishZ`, `app.ts` 1613) |
| `pacer.ts` 47, 131 | `PACE_OPEN` = the last stage's 1,550 | `reading(z, finishZ, open = PACE_OPEN)`; the caller passes the course's last stage length |
| `graveyards.ts` 90, 91 | falls before `FINISH_Z` | `graveyards(pool, key, taken, finishZ = FINISH_Z)`; `bundledGraveyards` passes each mountain's `finishZOf(seed)` |
| `missions.ts` 82, 95, 111 | distance missions capped at `FINISH_Z` | unchanged: the five's length caps them; on a shorter mountain a long one is not met that run |
| `missions.ts` 79, 105 to 114 | `under(210)`, `under(185)`, `under(160)` | a time mission counts only on a course of the five's length: `(r.finishZ ?? FINISH_Z) === FINISH_Z` (a new optional `RunSummary` field; absent, as on every path today, it counts) |
| `settle.ts` 361 | `predictedTime(..., FINISH_Z)` | `sum.finishZ ?? FINISH_Z` |
| `scripts/playtest/race-lab.ts` 28 | `FINISH = 4500` | the course's |

Already read from the course, no change: the HUD's stage line (`app.ts` 3825), `canRideHome` (2965), the rivals'
watch (`app.ts` 1613, `bot.ts` 2092), `render/ghosts.ts` 1670, `results.ts` and `sequence.ts` (`m.finishZ`), splits
(per stage, from `course.stages`), the Long Night's depth (metres into a leg's own course), the reel (`game/shots.ts`,
`render/shots.ts`: they plan from `course.finishZ` and `course.leaps`, which is empty on the three: the hero leap shot
falls back to none, `director.ts` 575). The render's four `RUN_OUT` reads (`landmarks.ts` 501, 606, 776,
`overlook.ts` 217) become `c.runOut` in the groundwork (four mechanical hunks).

**A test for it** (`tests/finishz.test.ts`): for every registered mountain and the lab Old Run, a record that crossed
its line reads as finished and one a metre short does not, through `recordStanding`, `poolTime`, `pickField`,
`targetZ`, `graveyards` and `settleRun`; and for the five, each returns what it returns today.

---

## 10. The game layer making room for eight

- **The mountain list.** The three are *appended* to `MOUNTAINS` (indices 5 to 7), never inserted: `MOUNTAINS[i]` is
  read by index in the Trials turn, The Twelve's `home`, `?debug&m=`, the pool generator's `mountain`
  (`generate-ghosts.ts` 96), `masteryBoard`, `trialfield.ts` 43 and the graveyard naming order. A mountain registers
  in its lane once its pool exists (`ghostpool.test.ts` asks for a pool for every mountain); until then the course
  table carries its row and the lab its seed. `MountainId` gains each id as it registers.
- **The title's strip** (the ui lane's picker): the model (`app.ts` 908) lists `MOUNTAINS` in its order; the picker
  shows them by `unlockGhosts`, the finale last: Pinecrest 0, Frostfang 4, **Gablefall 8**, Ember 12, **the Old Run
  18**, Sakura 24, **Gullhaven 32**, Lanternfall. Eight chips must fit a desk and a 390 px phone: a note for the ui
  lane, which is building that picker now.
- **Unlocks** at 8, 18 and 32 ghosts: each `MountainDef.unlockGhosts`; `mountainOpen`, `lockText`, the ghost ladder
  (`progress.ts` 20) and `unlockedBiomes` read it as they are. A returning player past 32 opens all three at once.
- **Trials** (`trial.ts` 131, `% 5`): from a set week the mountain turns over the eight; every earlier week keeps its
  Trial, and nothing about a week depends on what is registered.
  ```ts
  /** From this ISO week the Trial's mountain turns over all eight (round 9). Null until the commit that registers the
   *  last of the three sets it to a week after that build ships; every week before it keeps the five's turn. */
  export const EIGHT_FROM: string | null = null;
  const FIVE_TURN = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
  const EIGHT_TURN = [...FIVE_TURN, 'gablefall', 'oldrun', 'gullhaven'];
  const from = EIGHT_FROM === null ? Infinity : weekIndex(EIGHT_FROM);
  const mountain = i >= from ? EIGHT_TURN[(((i - from) * 3 + EIGHT_START) % 8 + 8) % 8] : FIVE_TURN[(((i * 2) % 5) + 5) % 5];
  ```
  `* 3` steps through all eight and never repeats a week; `EIGHT_START` is chosen with `EIGHT_FROM` so the first
  eight week differs from the last five week. Tests: if `EIGHT_FROM` is set, every id of `EIGHT_TURN` is registered
  and has `NAMES` and `HOURS` (82, 84); no two consecutive weeks from 2026 to 2032 share a mountain; every week before
  `EIGHT_FROM` gives what the five's turn gives. The measure stays `MEASURES[i % 4]`, except that a 'perfects' week on
  the Old Run (no landings to stomp) takes 'score'. A Trial rides its mountain whether or not the player has opened
  it, as today.
- **The Long Night's legs** (`modes.ts` 21): the five's ten until all three are registered, then sixteen, in one
  change:
  ```ts
  const NIGHT = ['pinecrest', 'frostfang', 'gablefall', 'ember', 'oldrun', 'sakura', 'gullhaven', 'lanternfall'];
  const FIVE_NIGHT = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
  const order = NIGHT.every((id) => MOUNTAINS.some((m) => m.id === id)) ? NIGHT : FIVE_NIGHT;
  export const LEGS = [...order, ...order].map((mountain, i) => ({ mountain, mirror: i >= order.length }));
  ```
  `LEG_NAMES` (142) gains the three. `legsOpen` (`almanac.ts` 195) reads the pages' 3, 6 and 10 and `startNight`
  clamps to `LEGS.length`, so the page that opened "all ten" opens all sixteen (its reward becomes `legs: 99`, read as
  "all"). A saved best depth stays a count of legs: deeper is still deeper, though leg 3 is Gablefall where it was
  Ember (question 6). `tests/spine.test.ts` 256 (ten legs) moves with it.
- **Graveyard names, stable first** (`graveyards.ts` 41, 127): `GRAVE_NAMES` is frozen at its 22 (a comment says never
  append) and keeps naming the five and the Dailies over `N = 22` exactly as now. The three name theirs from
  `[...GRAVE_NAMES, ...GRAVE_MORE]` (their own `N`); `bundledGraveyards` names in `MOUNTAINS` order and the three come
  after the five, so the `taken` set the five fill is today's. A test holds the five's bundled names as literals.
- **`VERBS` appended** (`moments.ts` 38): each mountain lane appends its three verbs when its mountain registers, the
  Old Run's, then Gullhaven's, then Gablefall's, never reordering (the stingers key on the name and fall back to
  `st.any`, `stemdeck.ts` 275; the boards key on the set piece). `moments.test.ts` 87 ("every verb is played
  somewhere") holds because each verb arrives with its mountain.
- **Daily and Cup:** `BIOMES` stays the four (`mountains.ts` 160); a Daily or Cup seed reads `FIVE` and its biome's
  rows as now (the fingerprint's Dailies prove it).
- **Home riders, no new Twelve:** `riderSkill` (`roster.ts` 140) gives the twelve their home touch where `home` is the
  mountain's index, and their homes stay 0 to 4 (their duels stand where they are), so none of the twelve is at home
  on the three. A new mountain's home riders are therefore new: a `HOME` list a mountain (a name, hat, emblem, sled,
  style and skill, never a duel), which the generator rides for that mountain's pool alone (question 5).
- **The generator** (`scripts/generate-ghosts.ts` 93) regenerates every mountain in `MOUNTAINS`. It gains `--only
  <id>` and refuses to write any of the five's files (a guard on their ids), so only the three new pools are
  generated, one at a time in the heavy slot.
- **Missions' biomes** (`missions.ts` 160): a new mountain's borrowed look (until its world lane widens `BiomeId`)
  counts it as that biome's; harmless (it opens later than the biome), gone once the look is its own.

---

## 11. The suites

- `tests/five.test.ts` (new, first): the fingerprint (section 0).
- `tests/fairness.test.ts`: the shared promises become the five's. `SEEDS` (14) becomes `FIVE_SEEDS` (the
  acts-grammar mountains and the six Dailies) for the first minute (322), ravines, tree runs, lakes, forks, streets,
  bridges, tunnels, terraces, leaps, the finish square, kickers, rails, the rhythm (`FINISH`, `RUN_OUT`,
  `rampDistance` at 248 to 250), signatures and contrast. What every mountain keeps runs on all eight: the lane clear
  to the run-out (102); the line smooth (137) with the five's 0.018 curvature for the five and each layout's own
  limit for its own; the ground launching only where it means to (153, each kit's meant spans); the line-following
  driver (178, on every mountain, not `SEEDS.slice(0, 6)`, and to each course's own line, not `z < 3000`, which
  Gablefall's 2,800 m and its coast would fail); the avalanche (200) on each mountain that can meet one.
- `tests/oldrun.test.ts`, `tests/gullhaven.test.ts`, `tests/gablefall.test.ts`: each mountain's promises (sections 5
  to 7), written by its lane as its mountain is built; the Old Run's in Phase 2 on the lab seed.
- `tests/charmgates.test.ts` 47: `THRESHOLD_HW` becomes the course's `layout.thresholdHW`; "no ice at a gate" holds
  (no threshold of the three is ice).
- `tests/moments.test.ts` 75: set pieces at least 900 m apart is the five's; a new mountain's are a stage apart.
- `tests/determinism.test.ts`: its four cases gain each new seed as it registers, and the lab Old Run in Phase 2.
- `tests/ghostpool.test.ts`, `tests/migration.test.ts`: unchanged; they stay green untouched.
- `tests/spine.test.ts` 256 and `tests/trials.test.ts`: move when the three register (`LEGS`, the turn).
- The budget tests (`tests/setpieces.test.ts` 350, the street and finish triangle budgets) run on every mountain: the
  world lanes'.
- **Run how:** after every Phase 2 step, `npx tsc --noEmit -p .`, then in the heavy slot `npx vitest run
  --maxWorkers=3 tests/five.test.ts tests/determinism.test.ts tests/fairness.test.ts tests/ghostpool.test.ts
  tests/migration.test.ts tests/charmgates.test.ts tests/moments.test.ts` (fairness alone is about a minute of one
  worker); the full suite in the heavy slot before the last commit; `npx tsx scripts/playtest/r9-courses.ts` in the
  heavy slot at the end, whose five's table must match `shots/r9/measure/r9-courses.txt` figure for figure.

---

## 12. The order of work, and what the mountain lanes add

**Phase 2, the groundwork** (each step its own commit, each green on the list above):

0. `scripts/r9/five-fingerprint.ts` and `tests/five.test.ts`, captured on 6255b8d with no other change; its cost
   measured, and the rides split off if it is slow (section 0).
1. The leaf module (`courseparts.ts`) and the course table: `Layout`, `FIVE`, `LAYOUTS` (the five's rows), `Course.
   layout`, `runOut`, `finishZFor`, `eventsFor`, every `src/sim` read site of section 1; the render's four `RUN_OUT`
   reads.
2. `FINISH_Z` from the course: every game-layer site of section 9, `tests/finishz.test.ts`.
3. The game layer's room for eight: the Trials turn (`EIGHT_FROM` null), `LEGS` and `LEG_NAMES`, frozen graveyard
   names, the generator's `--only` and its guard, `anchorFor`'s scaling, the time missions' rule, `rollChaos`'s mask
   and its callers.
4. The fairness suite split (`FIVE_SEEDS`; per-layout limits; the driver to each course's line), charm gates and
   moments per layout.
5. The kit seam: `CourseBiome` widened by `'oldrun'` only, `lookOf`'s borrowing, `kit.ts`, the hooks in `course.ts`,
   the sim's hooks A and B (C and D are written with their mountains, by Gullhaven's and Gablefall's lanes, to this
   design), the bot's track and per-thought line seams, `wallYaw` exported.
6. The lab Old Run (`src/sim/oldrun.ts`): its kinds, composer, centre line, cross-section, wall profiles, parapet,
   surfaces; seed `0x9b05688c` (SHA-256's sixth initial word, beside Lanternfall's fifth) in `BIOME_BY_SEED` only,
   not in `MOUNTAINS`; lab support (`lab.ts` and `r9-courselib.ts` take `--seed`); `tests/oldrun.test.ts`.
7. The lab: does a sled ride up the bank on the glaze and sink to the slush at about 36 and 18 m/s; does a sled let go
   into a bend settle without reaching the lip; the mid, novice, careful and clumsy pilots and the bot on it (time,
   speed on each surface, share of each bend on the glaze, lip scrapes, launches off a wall, falls); each mood once;
   then the full suite and the five's measure table in the heavy slot. Frames of the lab course from the chase camera
   under `shots/r9/ground/` (a `?debug&seed=` dev switch, the borrowed look).

**What each mountain lane adds on top** (in its own files where it can): its `CourseBiome`, `BiomeId` and
`MountainId` id; its `BIOME_PARAMS`, `TALL`, `LOW`, `CLIFFS`, `SCRIPTS`, `SIGNATURES`, `LAYOUTS` rows; its kit (the Old
Run's grows from the lab's); its seed, chosen through the fairness and budget tests and checked against every Daily
and Cup key to 2040; hooks C or D and the bot's `lip` goal and `lineFor`; its promises' test; its three set pieces
(`AUTHORED`, `FAMILY`, `VERBS` appended, `MomentVerb`, the builder, the sim's `momentStep` and `momentCount` cases,
the bot's `momentRide`/`momentOff`, `momentcopy.ts`) and two legends; its `MECHANICS` hook in `r9-courselib.ts` (the
Old Run: on a bend's wall at u 0.3 or more; Gullhaven: in the air inside a column; Gablefall: 2 m or more above the
street); its world and the render and audio tables keyed by biome, kind and obstacle (the terrain's fine rows over
Gullhaven's faces among them); its score; its home riders and its pool (`--only`, the heavy slot, nothing else open);
its registration in `MOUNTAINS` with `unlockGhosts`; the Trials' `NAMES` and `HOURS`, `LEG_NAMES`,
`FIRST_RUN_PACE`, the album, the Almanac, mastery, mirror and hour, photo and clip, the key art's card. The order is
DECISIONS 392's: the Old Run, then Gullhaven, then Gablefall (whose Low cost is measured before its world is built).
The last of the three to register sets `EIGHT_FROM` and the Long Night's sixteen legs.

---

## 13. The review

A fresh reviewer (Opus, extra-high effort) was given this file's first draft, the brief's sections 2 to 4 and the
concepts' pages, and read access to the worktree, and asked to break it: anything that changes the five by a bit,
anything that moves the safe line or climbs, any mechanic the bot cannot learn or a novice cannot survive, any read
site missed. It read the code at the draft's commit (49700db, the base's `src`, `tests` and `scripts`), edited
nothing, and ran nothing (one measurement hung behind other lanes' servers and it stopped it). Its seventeen
findings, worst first, and what I did with each:

| # | Finding | Severity | Answer |
| --- | --- | --- | --- |
| 1 | The glaze is slow in this sim: `groundStep` divides gravity by `1 + |grad|^2` (1116 to 1118), so high on a steep wall the drive along the track falls to a fifth; the glaze would settle near 25 m/s at best and lose speed above a cross slope of 1.75. The "35 on the glaze" column was flat ground. | blocker | Agreed (checked at 1116 to 1118). Hook A1: on the track gravity acts along the sled's path, as on runners; along a contour the drive is the channel's grade whatever the wall, so the column stands. |
| 2 | The wall's yaw with the weak ease is an underdamped spring (period 2.5 s, damping ratio about 0.1); a bend is shorter than the period, so a sled let go overshoots its height by half and reaches the lip. "Let go and it settles" was false. | serious | Agreed. Hook A3: on the track an always-on damping on the heading's difference from the channel's own direction (`TRACK_DAMP` about 3.5, ratio about 0.7), which leaves the settling height alone; the lab checks the overshoot. I also took the channel's direction from its own slope, not `lineHeading()`'s look-ahead, which leads a bend by up to 0.4 rad. |
| 3 | The cross-section and `edge()` measure across world x, but the channel runs at up to `p` 0.7: a sled beside the wall reads 20 m/s into it and is flung 50 degrees across; the channel is 18% narrower than stated. | serious | Agreed. The cross-section is square to the channel (`d = |x - cx| / sqrt(1 + p^2)`), the kit's `halfWidth` is `7.5 sqrt(1 + p^2)`, and hook B reflects against the channel's normal. |
| 4 | The outside wall's height tied to curvature with a hard cap puts crests on any line up the wall (a slope jump of 0.23 in a tick at the cap); the fairness suite checks crests only on the floor. | serious | Agreed. Each bend's wall has its own smootherstep profile over 70 m or more each side (`|H''| <= 0.0069`); the Old Run's test checks crests along u 0.3 to 1 on both walls. |
| 5 | Gullhaven's corridor centre ran along the gully head's edge, and the let-go, `lineHeading` and the clumsy pilot follow the centre, so riders not steering ride into the gully; the head's edge is a 17 m side slope. | serious | Agreed. The centre follows the path round the head; the mouth is a seaward annex 7 m out; the head's edge falls over 12 m, under the crest limit at 6 m/s sideways; a test lets a sled go on the path before each gully. |
| 6 | Gullhaven's `chute` and `street` would get the five's shared fill (pickets, slalom rows, on-line kickers and a sky gate, a mogul field, rails, wall and place lines). | serious | Agreed. Gullhaven uses only kinds of its own (`descent`, `sheds`); every kit lays only its own kinds, which the shared layers never find. |
| 7 | The bot seams could not express the choices: `Lines` caches `boldX` per z for life, boldness is one coin at birth (so most mid bots never soar), and Gullhaven's and Gablefall's choices depend on state; `liftX` was missing from the interface. | serious | Agreed. `lines.ts` no longer changes; `lineFor(z, rider)` is asked per thought with the rider's state and a nerve read from its traits (no draw); choices stick per gully or row; `liftX` added. |
| 8 | Gablefall still met roofs from below three ways: a drift topping out at the eave under a ridge 1.75 m higher; a street sled turning into a drift's side mid-ramp; a 2 m hold under Powder Day's and Comet Night's 2.1 to 2.2 m pop peaks. | serious | Agreed. A drift's top is the roof's surface at every x; the street opens only over a drift's foot (within 0.1 m of its level); the hold is the eave less 1 m (5 m); the test walks every 0.5 m of x and checks no pilot's `y` jumps more than 0.5 m in a tick. |
| 9 | The Trials guard on registration would rewrite past weeks if the three register after `EIGHT_FROM`; `LEGS` rebuilt from registered ids would shift saved depths each time; the switch week could repeat a mountain. | serious | Agreed. `EIGHT_FROM` is null until the commit registering the last of the three sets it, with no registration guard; `LEGS` changes once, when all three are in; `EIGHT_START` keeps the switch week from repeating. |
| 10 | Building `LAYOUTS` and `KITS` at module top from the mountain files, which need values from `course.ts`, is a runtime import cycle (a TDZ error when a mountain file is imported first). | minor to serious | Agreed. The shared values move to a leaf module re-exported by `course.ts` under the same names; mountain files import values from the leaf only. |
| 11 | The launch test's stored `vx0`/`vz0` go stale across a landing, a get-up, a revive, a grind, the stuck reset and a ward; `edge()`'s ground reset must not apply in the air. | minor | Agreed. The track's launch test now has no stored state (the ground against the plane's own prediction); the reset applies to a grounded sled only. |
| 12 | `trackOn` as a class-field initialiser runs before `this.course` exists and would throw on every Sim. | minor | Agreed: assigned in the constructor's body (section 0, rule 1). |
| 13 | A `'geo'` ledge would become a 250 m drop zone read by the terrain's fine rows, `bot.dropAhead`, the fairness suite's meant spans, `railAt` and every render loop over `ledges`. | minor | Agreed. No new ledge kind: the inland descent is the geo section's own grade, the seaward face the kit's ground. |
| 14 | `layBands` bands a threshold only as a gated `'cruise'` and the finish only as `'finish'`, so a kit's thresholds and finish got no bands. | minor | Agreed: `kit.lay` pushes them, as `layBands` does for the five (`layBands` itself is not touched). |
| 15 | Counting glaze ticks as a wall ride changes scoring on one mountain (and holds the combo through 60% of the run): an owner's call, not a tuning. `wallYaw` used a fixed G. | minor | Agreed. The design builds without it and asks (question 3). `wallYaw` takes the mood's gravity. |
| 16 | The fingerprint missed `rollChaos` (whose signature changes, and which the runtime Daily, Cup and Trial pools use); `app.ts` 1522's `seed` is the chaos seed; the bot rides covered no Daily; thirty full bot rides are not "6 to 10 s". | minor | Agreed. The chaos digest covers `rollChaos`, `eventTriggerZ`, `cupChaos`, `trialFor` and `legChaos`; the mask at 1522 takes the mountain's seed; a Daily joins the bot rides; the cost is measured in step 0 and the rides split off if slow. |
| 17 | Read sites missed or wrong: `modes.ts` 142 `LEG_NAMES`; `course.ts` 2062, 2450, 2588; the fairness driver's `SEEDS.slice(0, 6)` and `z < 3000`; `spine.test.ts` 256; the time missions' optional field would silently drop the five's; the home riders contradiction (`riderSkill` matches `home` by index); `coast()` snapping a roof rider 6 m. | minor | Agreed, each: `LEG_NAMES` gains the three; the three course lines are listed as shared and harmless on the three (section 1); the driver runs every mountain to its own line; spine's test moves with `LEGS`; the rule reads `?? FINISH_Z`; home riders are a new list a mountain (question 5); Gablefall's rows end 60 m before its line. |

What it checked and found sound: every cited line number (a few off by one, now fixed: the launch is 1259, `reading`
131); `FIVE`'s values against the constants, and the rewrites of `get stages`, `pour`, `section()`, `layKicks`,
`placeLights`, `pushSection`'s threshold width and `stageGates` as bit-identical for the five; `Sim.hash` mixing named
fields only; `Section`, `Chunk`, `Zones` and `Obstacle` keeping their shape; `rollChaos` with every bit set; mirrors
and `finishZFor`; the five's graveyard names; `climaxOf` and the moments code on a course with no leaps; the
flat-ground settle speeds, `cruiseSpeed` and the launch test's worked figures; pinned widths being exact; the charm
arches in the 7.5 m channel; Gullhaven's fence against its fall; the lift behind its guard; Gablefall's 1.2 m margin
at ordinary pops.

**Left open by the review, for the lab:** whether the runner drive, the wall's yaw and the damping together feel like
a bank or like a rail (only riding shows it); `TRACK_DAMP`, `LIFT` and `ROOF_GRADE` are design values.

---

## 14. Questions for the main lane

1. **Approve the seam.** Each new mountain lays its own ground in its own file behind a constructor-time flag, and
   `course.ts`, `sim.ts` and the bot are opened once, by this lane. This is more than the concepts' "new shape fields"
   but touches the five's paths less (no field added to `SectionShape` or `Zones`, `shapeAt` untouched).
2. **Three physics departures, on the track only.** Gravity along the runners, the bank's yaw, and a damped heading
   (hooks A1 to A3) make the Old Run a different ground model from the five's heightfield, though no rule a rider plays
   by changes. They are additive and never run on the five, but they are new sim behaviour beyond "new numbers": say
   if they need the owner's word.
3. **Style on the Old Run** (section 8). As the rules stand it pays no wall ride, since its walls are inside its
   corridor. Should the glaze count as a wall ride (the five's own style, a new trigger, holding the combo through
   about 60% of the run)? The default is no: scoring stays as it is.
4. **Concept changes the sim forces**, to confirm with the mountain lanes: the Horseshoe is a 35 degree hook, not 60;
   Gablefall's roofs are never higher than the last; Gablefall's opening is the nave then a close (the start gate needs
   calm ground at 110 m), not "the first roof 6 m on"; Gullhaven's chute and fish sheds are kinds of its own.
5. **Home riders** (section 10). None of the twelve is at home on the three. A new list of home riders a mountain
   (named, styled, never a duel), or none?
6. **The Long Night at sixteen legs.** Inserted in the ladder's order, so a saved best of "3 legs" was Ember's and
   would now be Gablefall's. Keep the count as it is, archive old bests, or append the three after the five instead
   (Pinecrest to Lanternfall, then the three, then the mirrors)?
7. **Events per mountain** (section 8): the Old Run without the avalanche and the yeti, Gullhaven without the yeti.
8. **`EIGHT_FROM` and Trials on unopened mountains.** The last mountain's commit sets the week; a Trial rides its
   mountain even if the player has not opened it (as today, though Gullhaven opens at 32 and Trials can open on page
   35 before that).
9. **The fingerprint's cost** decides whether it runs with every step or in the heavy slot at the end of each.
10. **The lab Old Run's seed** `0x9b05688c` lives in `BIOME_BY_SEED` without a `MOUNTAINS` entry until the Old Run's
    lane registers the mountain (it may keep that seed or choose another).

---

## Appendix: the read sites as the script counts them (6255b8d)

`node scripts/r9/ground-readsites.mjs`: length 160 reads (src/game 26, src/render 6, src/sim 16, scripts 10, tests
102); opening 45 (src/sim 32, src/game 2, src/render 2 of which are a shader's own `opening()`, tests 8); thresholds
20 (src/sim 16, tests 3); the mountain list 268 (src/game 46, src/sim 11, src/audio 3, src/render 6 of which are
`% 5` in shaders and particles, not the list, tests 154, scripts 46); tables keyed by biome, kind or verb 35
(src/render 15, src/sim 15, src/audio 4); leaps 66 (src/render 7, src/game 5, src/audio 2, src/bot 1, src/sim 12).
The review added what a text search does not find: the time constants tuned to a run of about 125 s (`field.ts`'s
anchor clamp and `FIRST_RUN_PACE`, the time missions), `riderSkill`'s home by index, and every reader of `ledges` and
`zones.drops` (which no new mountain now adds to). Every `src` read of the length, opening and threshold groups is in
sections 1 and 9; the list's in section 10; the tables' are the world lanes' but for the two `Record<SectionKind>`
tables named in section 2.
