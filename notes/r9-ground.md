# Round 9, the ground lane: one sim design for the Old Run, Gullhaven and Gablefall (milestone 3, M1)

Phase 1 of the lane's brief (`notes/r9-briefs/ground.md`): the design, before any sim code. **Nothing here has been
built or ridden.** The figures marked *worked* are arithmetic from the sim's own constants (`CD` 0.0027, `MU` 0.03,
`G` 9.81, the drift and tuck factors), done by a throwaway script in my scratchpad, not a lab run; every one is for
the lab prototype to confirm or correct. Line numbers are the base commit's (`round-9` at 6255b8d).

The read sites are listed by a script that stays in the worktree for Phase 2 to re-run after every step:
`node scripts/r9/ground-readsites.mjs [length|opening|thresholds|list|tables|leaps]` (read-only; it prints
`file:line` and the line, grouped, with counts by area).

Contents: 0 the rule that keeps the five; 1 the course table; 2 the kit seam (one file a mountain); 3 the sim's
hooks; 4 the bot's hooks; 5 the Old Run; 6 Gullhaven; 7 Gablefall; 8 chaos, moods and charms on the three;
9 `FINISH_Z` from the course; 10 the game layer making room for eight; 11 the suites; 12 the order of work and what
the mountain lanes add; 13 the review; 14 questions for the main lane.

---

## 0. How the five stay byte for byte

Four rules, each checkable in the diff, and one test that proves the sum.

1. **Every new path sits behind a per-course constant set at construction**, false on the five: `Course.kit` is
   `null` for the five's biomes and every Daily and Cup; `Sim`'s `trackOn`, `liftOn` and `levelOn` are read from it
   once in the constructor. A new branch is `if (this.trackOn ...)`, never a test of a shape field the five also
   carry. On the five the same instructions run in the same order: no new arithmetic (not even `+ 0`, which turns a
   `-0` into `+0` and changes `Sim.hash`'s bits), no new call that reads the course, and no new draw on any `Rng`.
2. **New things go in under new names only**: new `CourseBiome` values, `SectionKind`s, a `LedgeKind`, `Surface`
   constants, obstacle kinds and (with the mountain lanes) `MomentVerb`s, each appended to its union and list.
   Nothing the five use is renamed, reordered or re-valued. `SectionShape`, `Zones`, `Obstacle`, `Section` and
   `Chunk` gain no field: what a new mountain needs about its own ground lives in its own kit (section 2), so the
   five's objects, their JSON and `shapeAt`'s blend are untouched.
3. **A shared constant becomes a table row only where the five's row holds its exact value**, read where the
   constant is read today (section 1). The constants stay exported under their names, defined from the five's row
   (`STAGE_LENGTHS = FIVE.stages`), so every test and render file that imports them reads what it read.
4. **`SIM_VERSION` stays 10 and the record's bytes do not change.** A new mountain is a new seed; its records are
   ordinary version 3 records.

**The proof: `tests/five.test.ts`, written first, before any sim edit** (step 0 of section 12). A script,
`scripts/r9/five-fingerprint.ts`, run on 6255b8d, prints one FNV-1a digest (float64 bits, as `Sim.hash` mixes
them) per course and per ride; the test holds those literals and recomputes them:

| Digest | What it folds in | Over |
| --- | --- | --- |
| course | every section (kind, z0, z1, blend, side, drop0, phase0, fall0, the shape's 21 fields in `PLAIN`'s key order, gate), `stages`, `ledges`, `leaps`, `charmGateZs`, `stageGates`, `skyGates`, `wallLines`; every chunk to the run-out's end (obstacles, every zone array, gates, lights, in order); on a grid (z every 2.5 m to `finishZ + RUN_OUT + 200`, x at the centre and +-2, 5, 9, 14, 20 m) `ground`, `safeX`, `centerX`, `halfWidth`, `baseY`, `edgeLimit`, `edgeExcess`, `altX`, `backX`, and `surface`'s grip, drag and ice; `planMoments`, `momentPlays` for the rolls `rollForVariant` gives for variants 0, 1, 2 and under Comet Night's gravity, `planLegends`, `climaxOf` | the five and the fairness suite's six Dailies |
| scripted ride | `determinism.test.ts`'s busy scripted rider (exported, not copied), 90 s, the `Sim.hash` of every 30th tick | the five, three chaos rolls each (plain, a mood and an event, a legend) |
| bot ride | `runBot` with skills 0.25, 0.55 and 0.9 and two styles (`racer`, `stunt`): the record's input bytes, ticks, score, distance and the final `Sim.hash` | the five, one roll each |
| lab pilots | `labpilots.ts`'s `classic('mid')` and `clumsy` on one seed: the final `Sim.hash` | the five |

The pool replays (`tests/ghostpool.test.ts`) already prove the stored records; this adds the courses themselves, the
bot (whose every draw must stay where it is, or a later pool for the five would differ) and the lab's pilots (the
measure lane's baseline). Expected cost: about 6 to 10 s of one worker. Every Phase 2 step runs it.

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
export const THRESHOLD_HW = FIVE.thresholdHW;
const LAYOUTS: Record<CourseBiome, Layout> = { alpine: FIVE, glacier: FIVE, volcanic: FIVE, blossom: FIVE, lantern: FIVE, oldrun: OLDRUN_LAYOUT, gullhaven: GULLHAVEN_LAYOUT, gablefall: GABLEFALL_LAYOUT };
/** The finish line of any seed, without building its course (the game layer's records and links). */
export function finishZFor(seed: number): number { const s = LAYOUTS[courseBiomeForSeed(seed)].stages; return s[0] + s[1] + s[2]; }
```

`Course` gains `readonly layout: Layout` (set in the constructor, line 863, from `this.params.biome`) and
`get runOut(): number`. The three rows (`*_LAYOUT`) live in each mountain's own file and are imported here.

**The table, with the five's row as today and the three proposed** (stage lengths from the concepts; the mountain
lanes may move them, the five's never):

| Field | The five (today) | The Old Run | Gullhaven | Gablefall |
| --- | --- | --- | --- | --- |
| stages | 1450 / 1500 / 1550 (4,500) | 950 / 1000 / 1050 (3,000) | 1550 / 1600 / 1650 (4,800) | 900 / 950 / 950 (2,800) |
| grammar | acts (`compose`, `pour`) | kit `oldrun` | kit `gullhaven` | kit `gablefall` |
| opening | start 120 m at 0.5, bowl 240 to 270, cruise 120 to 150, the first leap (lip 590 to 670) | the start house's straight, 160 m in the track | the beacon's moor, wide, the first gully's lip 330 m or later | the church's nave (the start ramp), then the close (a square), rows from about 200 m |
| first leap | the opening's | none | none (the gullies are not leaps) | none |
| first kicker | 286 to 312 (296) | none | none | none |
| kickFrom, picketsFrom | 800, 900 | 800, 900 (unused: no kickers, no pickets) | the same | the same |
| run-in light line | 130 m, 160 m long, 8 m apart, swing 110 m | none (the kit lays its own line up the first bend's wall) | the five's (the moor is open) | none (the kit lays one down the close) |
| finish kind, square, run-out | `finish`, 300, 260 | `outrun`, 120, 200 | `harbour`, 260, 200 | `quay`, 240, 240 |
| threshold kind, least half-width | `cruise`, 11 | `track` (straight), 7.2 | `cliffpath`, 11 | `square`, 11 |
| banks and walls | per kind (`limit`, `wall`, `fall`); `bank()` past the edge | the track's own cross-section and parapet (kit) | the path's sea side falls, the moor side banks (kit) | the street's fronts and the rows' backs (kit, section 7) |
| widths (`BIOME_PARAMS`) | 18 to 21 easing to 12 to 14 | 7.5 (pinned by `WIDTH.track`) | 10, 15 at a gully (pinned) | 16 (pinned) |
| grade (`params.slope`; `rampDistance`) | 0.28 to 0.31; 4,500 (`DESCENT`) | 0.17; 3,000 | 0.16 (shelves) and the gullies' drops; 4,800 | 0.22; 2,800 |
| colliders | `(7 + 15 d) x density x template x kind` | none (density 0; nothing in the track) | about 20 a km off the path (kit) | chimneys on the roofs, about 60 to 90 a km (kit) |
| charm gates | 110 m (`START_GATE_Z`), each line + 100 (`GATE_PAST_LINE`) | the same rule | the same | the same |
| events (section 8) | all four | the light storm, the spirit train | avalanche, storm, train | all four (the avalanche to be proved) |

**What stays shared on purpose** (rules a rider plays by, or promises every mountain keeps): `START_CLEAR_Z` 150,
`FREE_TUMBLE_Z` 700 (every fall before 700 m is free on all eight), `START_SPEED` 14, `START_GATE_Z` 110 and
`GATE_PAST_LINE` 100 (charms are a rule), `SAFE_LANE` 2.45, `EARLY_MARGIN`, get-ups and their 200 m, par's 24 m/s,
`MAX_SPEED`, the drag and friction, `bank()`'s curve, `CREST_LIMIT`, the leap and kicker constants (the three new
mountains use none), the threshold's `THRESHOLD_BEFORE`/`_AFTER` bounds (the kits lay their thresholds to them).

**Every read site in `src/sim` and how it changes** (from `ground-readsites.mjs length|opening|thresholds`):

| Site (6255b8d) | Today | After |
| --- | --- | --- |
| `course.ts` 189, 191, 193 | `STAGE_LENGTHS`, `RUN_OUT`, `FINISH_SQUARE` | defined from `FIVE` (same values, same exports) |
| `course.ts` 913 to 927 `get stages` | `STAGE_LENGTHS.forEach`, names from `SCRIPTS[biome][acts[i]]` | `this.layout.stages.forEach`; names unchanged (the three get `SCRIPTS` rows naming their acts) |
| `course.ts` 971 `section()` | past the last section, `pushSection('finish', 400, 40)` | `pushSection(this.layout.finish, 400, 40)` |
| `course.ts` 1028 `opening()` | the five's opening | unchanged; only `pour` (the acts grammar) calls it |
| `course.ts` 1087, 1173, 1178 `pour()` | room from `STAGE_LENGTHS` and `FINISH_SQUARE`; threshold `'cruise'`; finish beat `'finish'`, `FINISH_SQUARE + RUN_OUT` | the same expressions on `this.layout` (only the acts grammar runs `pour`, so only the five's row is read) |
| `course.ts` 1237 `lay()` | `compose()`, then per beat `layLeap`/`layTerraces`/`layOutlet`/`layFork`, `layBands` | `const beats = this.kit ? this.kit.compose(...) : this.compose()`; per beat the five's branch as is, or `this.kit.lay(...)` (section 2) |
| `course.ts` 1276 `pushSection` | `THRESHOLD_HW` | `this.layout.thresholdHW` (kits push their sections through it) |
| `course.ts` 1463 to 1472 `layKicks` | the first kicker at 286 to 312, always | `if (this.layout.firstKick) { ...the same loop on its from, to, at... }` |
| `course.ts` 1476, 1488, 1508, 1523, 2405 | `800` | `this.layout.kickFrom` |
| `course.ts` 2325 | `PICKETS_FROM` | `this.layout.picketsFrom` |
| `course.ts` 2485 to 2490 `placeLights` | `LIGHT_RUN_*` | `const run = this.layout.lightRun; if (run) for (...)` with its fields |
| `course.ts` 1854 `surface()` | a threshold's body is plain snow | unchanged for the five; the kit's surface is asked first (section 3) |
| `mountains.ts` 53 `DESCENT` | `rampDistance` of all five | unchanged; the three set theirs to their own length |
| `mountains.ts` 7 | `CourseBiome = BiomeId` | `BiomeId \| KitId`; `lookOf` maps a new biome to a borrowed look until its world lane widens `BiomeId` (Lanternfall's round 7 path) |
| `charms.ts` 112, 113 | `START_GATE_Z`, `GATE_PAST_LINE` | unchanged (shared rule) |
| `sim.ts` 69 `FREE_TUMBLE_Z` | 700 | unchanged (shared rule) |
| `sim.ts` 2133 par, 3044 `cruiseSpeed` | `course.finishZ`, `course.params.slope` | unchanged: both already read the course |

---

## 2. The kit seam: one file a mountain (`src/sim/kit.ts`, then `oldrun.ts`, `gullhaven.ts`, `gablefall.ts`)

The three grammars have nothing in common with each other or with `pour` (the acts machinery assumes a first leap
and places to pull up to meet it, and would throw `no descent` for a track). So each new mountain lays its own
descent in its own file, and `course.ts` calls it through one narrow seam. This also lets the three mountain lanes
work in their own files, as the brief's M2 asks, with `course.ts` and `sim.ts` edited once, here.

```ts
// src/sim/kit.ts (types only from course.ts: `import type`, so there is no runtime cycle)
export interface KitBeat { kind: SectionKind; len: number; blend: number; gate?: true }
export interface KitPlan { clear: Band[]; busy: Band[]; narrow: Band[] }   // course.ts's own bands, to keep features out
export interface Placer { clearOf(x: number, z: number, r: number): boolean; add(kind: ObstacleKind, x: number, z: number, r: number, h: number, y?: number): void }
export interface Kit {
  readonly id: KitId;
  /** The descent: beats in order, stage room filled exactly, a threshold (gate: true) across each stage line within
   *  THRESHOLD_BEFORE..BEFORE_MAX above it and AFTER_MIN..AFTER below, ending with layout.finish of square + runOut. */
  compose(c: Course, rng: Rng, blendOf: (k: SectionKind, prev: SectionKind | null) => number): KitBeat[];
  /** Each section as it is laid (where lay() calls layLeap and the rest for the five); may push bands and ledges. */
  lay(c: Course, sec: Section, rng: Rng, plan: KitPlan, addLedge: (sec: Section, l: Omit<Ledge, 'total'>) => void): void;
  /** Optional hooks, each called only where it is defined (constructor-time booleans on Course): */
  centre?(c: Course, z: number): number;                      // the centre line, replacing the wander
  ground?(c: Course, x: number, z: number, h: number): number; // the bare ground's own term (cross-sections, roofs, gullies)
  surface?(c: Course, x: number, z: number): Surface | null;
  lift?(c: Course, x: number, y: number, z: number): number;  // upward m/s^2 at full gravity; 0 outside every zone
  street?(c: Course, z: number): { x0: number; x1: number; y: number; open: (side: 1 | -1) => boolean } | null; // Gablefall
  obstacles?(c: Course, chunk: Chunk, rng: Rng, p: Placer, diff: number): void;
  lights?(c: Course, chunk: Chunk, rng: Rng, diff: number, push: (x: number, z: number, hover: number, value: number) => void): void;
  boldX?(c: Course, z: number): number | null;                // the line a bold rider takes (a soar, a ridge)
  raceX?(c: Course, z: number, v: number): number;            // the Old Run's racing line for a speed
  lips?(c: Course, z0: number, z1: number): readonly { z: number; x0: number; x1: number }[]; // where a pop pays
}
const KITS: Partial<Record<CourseBiome, Kit>> = { oldrun: OLDRUN_KIT /*, gullhaven, gablefall with their lanes */ };
```

**Where `course.ts` calls it** (each guarded by a field set in the constructor from `KITS[this.params.biome]`, all
`null` or `false` for the five):

| Hook | Call site | Guard |
| --- | --- | --- |
| `compose`, `lay` | `lay()` (1237): the kit's beats replace `compose()`; per beat `kit.lay` replaces the leap/terraces/lake/fork branch; `layBands` runs for every beat as today; `layKicks`, `layFields`, `layRails` still run (they find no kinds of theirs on a kit course, and `layKicks`' first kicker is the layout's `null`) | `this.kit` |
| `centre` | first line of `centerXAt` (1697) | `this.ownCentre` |
| `ground` | last line of `bareGround` (1794), so `ground()`'s zones (kickers, drops, moguls) still add on top | `this.ownGround` |
| `surface` | first line of `surface` (1851), before the threshold's snow | `this.ownSurface` |
| `lift` | new `liftAt(x, y, z)` (0 without) and `hasLift` | `this.hasLift` |
| `street` | new `streetAt(z)` (null without) and `hasLevels` | `this.hasLevels` |
| `obstacles` | `buildChunk` (2139), after the five's placements, before `placeLights` | `this.kit?.obstacles` |
| `lights` | the end of `placeLights` (2469) | `this.kit?.lights` |
| `boldX`, `raceX`, `lips` | new public `boldX(z)` (null without), `raceX(z, v)` (the safe line without), `lips(z0, z1)` ([] without) | `this.kit?.x` |

The new kinds' `SHAPES` rows carry what the shared code reads (`pin`, `width` through `WIDTH`, `limit`, `wall`,
`fall`, `relief`, `ice`, `span`, `wave`, `wander`, and `obstacles: 0` so the shared fill places nothing), plus their
`BLEND`, `BODY` and `GRADE` rows. Two `Record<SectionKind, number>` tables outside the sim must gain the new keys to
keep `tsc` green: `src/audio/listen.ts` 102 (`OPEN`) and `src/render/landmarks.ts` 150 (`SPAN_CHANCE`). The
groundwork adds neutral values there (0 spans; `OPEN` 0.3) and lists the hunks; the world lanes tune them.

---

## 3. The sim's hooks (`src/sim/sim.ts`)

Constructor (474): `private readonly trackOn = this.course.layout.grammar === 'oldrun'` (the wall term below),
`liftOn = this.course.hasLift`, `levelOn = this.course.hasLevels`. Nothing else in the constructor changes.

**A. The wall term (the Old Run).** In `groundStep`, after the berm turn-back (1173 to 1178), before the wall-ride
count:

```ts
if (this.trackOn) {
  // On a banked track the bank turns the sled, as the wall's push turns a real one: its cross slope over its speed.
  // (Gravity alone, which is all the five's ground gives, can turn a gripping sled at most g/2/v; a track's bend at
  // 36 m/s needs v^2/R, about 4.4 times that at R 60, so without this a bend only throws a sled at its lip.)
  s.heading -= wallYaw(vec, line, s.speed) * DT;   // `line`: the heading groundStep already holds (1146)
}
// sim.ts, exported for the bot: the ground's rise toward the line's right, times g, over the speed (8 m/s at least).
export function wallYaw(grad: { x: number; z: number }, line: number, speed: number): number {
  return (G * (grad.x * dcos(line) - grad.z * dsin(line))) / (speed > 8 ? speed : 8);
}
```

and the let-go ease (1170) runs at `TRACK_EASE` (0.5, to tune; 1.6 today) on the track, so the walls, not the
ease, do the turning: `const ease = this.trackOn ? TRACK_EASE : 1.6;` written as a separate statement inside the
guard so the five's line is untouched. In a bend of radius R a sled settles on the outside wall where
`g tan(theta) / v = v / R`, that is `tan(theta) = v^2 / (g R)`: the real banked turn. Steering into the wall at the
turn rate (0.77 rad/s at 36 m/s) beats the wall's 0.6 there, so a rider can hold the glaze above its settling
height; letting go settles; steering down drops.

**B. The launch on a wall.** The ground step launches a sled when the ground's follow speed drops faster than gravity
(1258). On a wall that test fires whenever the sled turns, because turning within a tilted surface moves the follow
height by the slope times the lateral change. *Worked:* steering down a 30 degree wall at 36 m/s gives 16 m/s^2
against the 14.7 that launches; 60 degrees gives 48. The five already do this off their berms (the measure lane's
clumsy pilot: 138 of 206 takeoffs past the edge). On the track the test subtracts the in-surface part, so only the
ground falling away from the sled's own path launches it (a crest, a pop):

```ts
const launch = this.trackOn
  ? vyFollow - (vec.x * (s.vx - vx0) + vec.z * (s.vz - vz0)) < s.vy - g * stick * DT * 1.5
  : vyFollow < s.vy - g * stick * DT * 1.5;   // (the five's line, unchanged)
```

where `vx0`, `vz0` are the velocity the sled's last ground move used (a field set after the move, 1260, inside
`if (this.trackOn)`), so a turn-back between two ground steps reads as a change within the surface too. On flat
ground the two tests agree. And `edge()` (2077), on the track only, puts the sled back on the ground it was turned
back onto (`s.y = ground(x, z)`, `s.vy` from the gradient and its new velocity): today it moves `x` and leaves `y`
where the wall was, which on a 72 degree wall is a 0.3 m mismatch the next step reads as the ground falling away.

**C. Lift (Gullhaven).** In `airStep`, right after gravity (1569):

```ts
if (this.liftOn) { const a = this.course.liftAt(s.x, s.y, s.z); if (a > 0) s.vy += a * this.mood.gravity * DT; }
```

Scaled by the mood's gravity, so Comet Night's lift keeps its share and a flight is long there as every flight is.
`landingWithin` (1647), which sets the rider for touchdown and guards flips, integrates tick by tick with the lift
when `this.liftOn` (else its closed form, unchanged), or the rider would set for a landing the column is still
holding off.

**D. The street's level (Gablefall).** In `edge()` (2077), before the five's turn-back:

```ts
if (this.levelOn) {
  const st = this.course.streetAt(s.z);
  // A sled at the street's level is turned back by the house fronts as a street's walls turn one back (a scrape,
  // never a fall); one on the roofs, or in the air above the eaves, rides past them.
  if (st && s.y < st.y + LEVEL_H) { ...the same reflection as below, against st.x0 or st.x1, unless st.open(side)... }
}
```

**E. What stays.** `collide`, `pickups`, `tumbleStep`, `lines`, `coast`, `crossGates`, `chaos` (but see section 8),
`momentStep` (new verbs come with the mountain lanes as new `case`s), the record, the input byte, tricks, charms,
scoring. A new obstacle kind floors a rider by today's rule (`HIT_HARD`, `HIT_FAST`); its cause stays `'rock'`
until Gablefall's lane names chimneys in `CrashCause` and the game's `crashText`.

---

## 4. The bot's hooks (`src/bot`)

Every new branch is guarded by the course, and **no new branch draws on `this.rng` unless its guard is true**, so a
bot on the five draws the same numbers in the same order (the fingerprint's bot rides prove it).

- `lines.ts` 28: `this.bold ? (c.altX(i) ?? c.boldX(i) ?? c.safeX(i)) : c.safeX(i)`. `boldX` is `null` on the five
  (one property test, no arithmetic). A bold rider (chosen at 425 by ambition and skill, as for a fork) soars the
  gullies and rides the ridges.
- `model.ts` `predictFlight` (24) takes an optional `lift?: (x, y, z) => number` and adds `lift * (gravity / G) * DT`
  to `vy` right after gravity, mirroring the sim; the bot passes it only when `course.hasLift`. Every pop, kicker and
  landing the bot plans then sees the column.
- `bot.ts` `groundThink` (1032): on the track, the heading it predicts over its reaction lead adds the wall term
  (`hp -= wallYaw(grad, lineDir, v) * lead`, the gradient read at its predicted point), so its steering is not always
  a beat behind the wall. It calls the sim's own exported `wallYaw`, so bot and sim cannot drift apart.
- `bot.ts` `lineX` (559): `+ this.raceOff(z)` where `raceOff = (course.raceX(z, vHere) - lines.safeX(z)) * reach`,
  `reach` by skill (0 for the careful and the clumsy, up to 1 for an expert): the bot aims at the height on the
  outside wall it would settle at, and higher by its nerve. Guarded by `course.kit?.raceX`.
- A `lip` goal beside `kicker` (`lookForGoals`, 937): from `course.lips(z, z + speed * 2.5)`, pressed before the lip
  and released at it, judged by `popFlight` with the lift and `flightClear` against the bold line. Built by
  Gullhaven's lane, used by Gablefall's.
- The lab's own pilots (`scripts/playtest/labpilots.ts`) import nothing from `src`; they read the course they are
  given, so the same three methods (`raceX`, `boldX`, `lips`) reach them through `sim.course` when present.

---

## 5. The Old Run: ride the wall

**Course** (kit `oldrun`, `src/sim/oldrun.ts`). New section kinds:

| Kind | Shape (`SHAPES`) | Grade | Width (half) | What it is |
| --- | --- | --- | --- | --- |
| `track` | `pin 1, span 0, wander 0, relief 0, obstacles 0, limit 0.5, ...BARE` | `[0.17, 0.17]` | `[7.5, 7.5]` | the channel: straights and bends of radius 60 to 140 m |
| `labyrinth` | as `track` | `[0.17, 0.17]` | `[7.5, 7.5]` | three S-bends close together, radius 40 to 60 m |
| `outrun` | `pin 1, span 0, relief 0, obstacles 0, limit 0.5` | `[0.04, 0.06]` | `[7.5, 9]` | the flattening to the timing house, the finish |

`BLEND` 60 for each (the kit joins bends itself), `BODY` per the kit. Acts: the Hotel Straights (the start house's
160 m straight, two long S-bends), the Labyrinth, the Horseshoe (one long hook, the deepest bank) into the outrun.
Each stage line's threshold is a `track` straight (gate), at least 190 m, the floor and both walls clear.

*The centre line* is the kit's (`centre`): a sum of turns, each easing the line's slope `p = dx/dz` from one value to
the next over its length with a smoothstep, so `x(z)` is that sum's integral in closed form and its curvature is at
most `1.5 dp / len`. Bends keep `|p| <= 0.7` (35 degrees off the fall line, the five's own limit: the chase camera,
the terrain's fine band and everything that measures progress in z assume it) and radius `>= 40 m`. *The concept's
60 degree Horseshoe becomes a hook of about 35 degrees that holds for 150 m and turns back*: a 60 degree turn in a
course measured in metres downhill halves the sled's progress in z for its length and runs the track out of the
terrain's fine band. The Horseshoe's depth is its wall (7.5 m) and its length, not its angle.

*The cross-section* (`ground`), with `d = |x - cx|`, floor half-width `F = 2.6`, wall width `W = 4.9`, lip at
`hw = 7.5`: floor `d <= F` flat; wall `H_side * ((d - F) / W)^2`; past the lip the parapet keeps rising (`+ 1.2 m`
over `0.6 m`, concave) so the lip is never a crest. `H_side` is 2.6 on a straight; in a bend the outside wall grows
with the bend's curvature to 7.5 at radius 60 or tighter and the inside stays 2.6 (the outside is the side the
channel turns away from: `-sign(dp/dz)`). The wall's slope at the lip is `2H/W`: 1.06 (47 degrees) on a straight,
3.06 (72 degrees) at the deepest. `edgeLimit` 0.5 turns a sled back at the parapet with the five's own scrape (speed
x0.93 above 3 m/s out, the combo banked, a wobble), never a fall.

*Where a sled settles* (*worked*, `tan(theta) = v^2 / (g R)` on that wall; u is the share of the wall's width up):

| Wall, bend | 18 m/s | 24 | 30 | 36 |
| --- | --- | --- | --- | --- |
| 7.5 m, R 60 | 0.18 | 0.32 | 0.50 | 0.72 |
| 7.5 m, R 90 | 0.12 | 0.21 | 0.33 | 0.48 |
| 5 m, R 90 | 0.18 | 0.32 | 0.50 | 0.72 |
| 7.5 m, R 40 | 0.27 | 0.48 | 0.75 | the lip |

So the slush rider sits low, the glaze rider high, and at 36 m/s the Labyrinth's tightest bends reach the lip: speed
there has to be scrubbed (a drift) or the lip scrapes it off. That is the Labyrinth's skill.

*Surfaces* (new constants; `ice` decides the ice charms, section 8):

| Surface | grip | drag | ice | Where | Settles at on 0.17 (*worked*) |
| --- | --- | --- | --- | --- | --- |
| `TRACK_ICE` | 0.8 | 0.55 | false | straights, floor and walls; a bend's walls below the glaze | 29.9 m/s, tucked 33.0 |
| `GLAZE` | 0.85 | 0.4 | true | a bend's outside wall, u 0.5 to 0.85, where the wall is 4 m or more | 35.0, tucked 38.7 |
| `SLUSH` | 1 | 1.6 | false | a bend's floor (curvature over a third of the deepest) | 17.5 |

The concept's figures (about 36 on the glaze, about 18 in the slush) hold on paper.

*Style on the track.* The five's wall ride counts only 1.2 m past the corridor's edge (1180), and the track's walls
are inside its corridor, so as written the Old Run pays no wall ride at all. Proposed: on the track, `wallTicks`
counts ticks on the `GLAZE` at 15 m/s or more instead of past the edge (inside `if (this.trackOn)`), so the five's
own style (`wallRide`, 220 at 30 ticks, then 90 every 36) pays the glaze and holds the combo there, and Snow Hare
(off a wall ride) works as it does on a berm. The lab counts what it adds to a run's points against the five's; if
it is too rich, a bend pays once (question 4).

*What a fall is here:* nothing in the track floors a rider. No colliders (density 0), the lip scrapes, no kicker.
Only a pop's flight of 0.75 s or more landed badly falls, by the five's rule. *The HUD signal:* none new; the glaze
shines and hisses, the slush sprays dull (the world lane's), and the stage card names each bend's split.

*The five never enter:* `trackOn` is false on every five-grammar course; the kit's hooks are not installed on them;
the fingerprint proves it. A test also asserts `new Sim({ seed }).trackOn === false` for the five and every Daily.

**The bot.** It reads the wall from the course, not a pool: `raceX(z, v)` is the outside wall's settling height for
the speed it carries (the table above), clamped below u 0.85; it aims there by skill (section 4) and its heading
prediction carries the wall term. A careful or novice bot aims at the floor and lets the walls turn it. *The lab
check before any pool:* the mid and expert bots on the lab Old Run spend most of each bend on the glaze, scrape the
lip under once a bend, and beat the floor line (the careful pilot) by 10 to 20% on time.

**Its own promises** (`tests/oldrun.test.ts`): the floor's middle (the safe line) is clear for the whole track; a
sled that never steers reaches the line on every seed (the walls turn it); no wall launches a sled that does not
press (the lab's careful and clumsy pilots leave the ground only on their own pops: launches off a wall per run 0);
the lip never launches (every `edgeLimit` turn-back leaves the sled grounded); `|p| <= 0.7` and radius `>= 40 m`
everywhere; the glaze line beats the floor line by 10 to 20% for the mid pilot; the clumsy pilot finishes 30 of 30.

---

## 6. Gullhaven: ride the sea wind

**Course** (kit `gullhaven`). The sea is on the rider's right (+x) all the way down (a mirror flips it, as it flips
everything). New kinds:

| Kind | Shape | Grade | Width (half) | What it is |
| --- | --- | --- | --- | --- |
| `cliffpath` | `pin 1, span 0.25, wander 0.4, relief 0.5, obstacles 0, limit 0.8, fall 0, ...BARE` | `[0.15, 0.17]` | `[9.5, 10.5]` | the clifftop path: the moor rises on the left, the cliff falls to the sea on the right past a fence |
| `geo` | `pin 1, span 0.1, limit 0.8, obstacles 0, ...BARE` | `[0.15, 0.17]` plus its drop | `[14, 16]` | a gully crossing: the path round its head on the left, its lip and mouth on the right |
| `harbour` | `pin 1, span 0.15, relief 0, obstacles 0, limit 3` | `[0.02, 0.03]` | `[13, 15]` | the finish on the harbour's ice |

It also uses the five's `chute` (down to the harbour) and `street` (the fish sheds), which behave as they do on the
five, and `cliffpath` as its threshold. About ten gullies, one every 450 m, the first lip at 330 m or later.

*The sea side* (`ground`): seaward of the path's edge the bank is replaced by the cliff: `h - bank(e) - SEA_DROP *
smoothstep(1, 9, e)` (`bank` exported from `course.ts`), SEA_DROP a hundred metres or more. The fence is the
`edgeLimit` 0.8, so a sled is turned back (a scrape) before the fall's lip at 1 m, on the ground or in the air
(`edge()` runs for a flying sled too, `sim.ts` 820). `limit` is one number for both sides, so the moor side is
turned back at 0.8 too: a dyke along the path, which the world draws.

*A gully* (`geo`), laid by the kit with a lip `zL`, a drop `S` (about 26 m), a head at `xH` (a metre or two seaward
of the centre) and a mouth `M` long (about 90 m):
- *Inland, round the head:* a new `LedgeKind` `'geo'` added to the section (`addLedge`): `kick 0`, from the section's
  body to its end, `faceHold 0`, `sink S`. `ledgeSink` already makes that a smoothstep descent, it lives in `baseY`,
  `fall0` carries it on, and it is not a leap (`plan.leaps` takes only `'leap'`). The path's steepest grade is about
  `0.16 + 1.5 S / L`: 0.32 over a 250 m section; its crest curvature `6 S / L^2` is 0.0025, under the launch limit.
- *Seaward of the head:* the shelf holds its level to the lip, then a leap's landing face falls `S` (the five's
  `ledgeSink` profile with `kick 0`, `face0` 0.3, `FACE_BEND`, `FACE_TOP` 0.8, held, eased), reaching the far
  shelf's level by the section's end. In `ground`: `h += w(x) * (inlandSink(z) - faceSink(z))`, with
  `w(x) = smoothstep(xH - 4, xH + 4, x - cx)`. At the section's ends both sinks are 0 or both `S`, so nothing jumps.
- *The safe line* goes round the head: the kit sets the section's `side` landward and its `shift` so the line stays
  `SAFE_LANE + 2` inland of `xH - 4` (where `w` is 0). *The bold line* (`boldX`) runs straight over the mouth, 6 m
  seaward of the head.
- *The lift* (`lift`): one static box a gully, over the mouth, `x` from `cx + xH + 2` to `cx + hw - 2`, `z` from `zL`
  to `zL + M`; inside it `LIFT * G` with LIFT about 0.65, outside 0. Always below gravity, so the air never carries a
  sled up: it slows the fall. Pure in `(x, z)` (and so the same for every rider and every replay).

*Worked flights* off a 26 m face, the column 90 m long: no lift, 24 m/s plain: 2.3 s, 55 m (the five's leap face
catches it); 0.6 g, 28 m/s popped: 4.8 s, 135 m; 0.7 g: 5.3 s, 148 m; 0.7 g, 24 m/s plain: 4.2 s, 100 m. The
concept's three to five seconds sit at about 0.6 to 0.7 g; the lab sets it.

*What a fall is here:* the five's. Rocks and fishermen's huts off the path (about 20 a km, by the kit; nothing within
the lane). A soared flight of 0.75 s or more landed with the board wrong. A rider short of the far shelf comes down
on the gully's face, a leap's face, no steeper than 0.8, and rides it to the shelf. Nobody goes over the cliff: the
fence turns every sled back. *The HUD signal:* none new (spindrift streaming up the column, gulls hanging in it,
the fence's flags standing up: the world lane's).

*The five never enter:* `liftOn` false, `liftAt` returns 0 without ever being called (the guard), `landingWithin`
keeps its closed form, the `'geo'` ledge kind is laid by no five's code.

**The bot.** `predictFlight` carries the lift. A bold bot rides `boldX` into a gully when its speed at 60 m out is 24
m/s or more (its nerve sets the margin), else the path; it pops at the lip (a `lip` goal), and in the air its steer
holds the column's middle (`liftX(z)`, the box's centre) as it holds a ring's line today. *The lab check:* the mid
and expert bots soar most gullies (at least 7 of 10) and land on the far face or shelf; the novice takes the path
round and soars none; nobody goes past the fence.

**Its own promises** (`tests/gullhaven.test.ts`): the safe line never meets a lip (`w(safeX) = 0` everywhere) and
its lane is clear; every gully's lip, ridden on `boldX` at 24, 30 and 36 m/s plain and popped on the real sim,
comes down on its face or the far shelf with the landing's slope no steeper than 0.8; slower, it lands on the face;
the fence turns back every sled (no `y` below the shelf's level less 30 m on any pilot, ever); the lift acts only on
a sled in the air (no ground step reads it) and is the same for every rider (a pure function); a gully at least
every 600 m; the clumsy pilot finishes 27 of 30 or better.

---

## 7. Gablefall: roof to roof

The hardest of the three for this sim, because the sim's ground is one height a point: a roof over a street is a
step in it, and a sled that meets a step from below is lifted onto it in one tick. The design keeps every step
something a sled only ever leaves from above.

**Course** (kit `gablefall`). New kinds:

| Kind | Shape | Grade | Width (half) | What it is |
| --- | --- | --- | --- | --- |
| `nave` | `pin 1, span 0, obstacles 0, limit 1` | `[0.4, 0.4]` | `[6, 6]` | the start: down the church's nave from the steeple, 80 m |
| `square` | `pin 1, span 0.25, obstacles 0, limit 2` | `[0.08, 0.12]` | `[11, 13]` | the close at the top, each stage line's threshold (the rows open into a market place) |
| `rooftops` | `pin 1, span 0, wander 0.3, wave 1.6, relief 0, obstacles 0, limit 0.6` | `[0.21, 0.23]` | `[16, 16]` | the street and a row of roofs either side |
| `quay` | `pin 1, span 0.15, relief 0, obstacles 0, limit 2` | `[0.03, 0.05]` | `[12, 14]` | the finish: off the last roofs onto the quay and the river's ice |

*The street:* the middle of `rooftops`, `|x - cx| <= 4.5`, at the course's own level (`baseY`); the safe line is its
middle (`span 0`). Its surface is `COBBLES` (grip 1, drag 1.25: the street is the slow way).

*The rows:* each side, a row of houses from `4.5 + 1.5` (the fronts stand back 1.5 m) to `hw` (16), so 10 m deep.
The kit lays the rows as blocks between alleys, each block 2 to 4 houses of 14 to 20 m. A house's roof: eave 6 m
over the street at the house's top, falling along z at `ROOF_GRADE` (about 0.14) so it drops less than the street,
then a step down to the next house of the difference (`(0.22 - 0.14) x L`, 1.1 to 1.6 m); across, a gable whose
ridge runs down the row's middle, pitch about 0.35, rounded over 4 m so a sled crossing it sideways is not thrown
(*worked:* it stays on below 7.7 m/s across). *Worked hops:* a 1.4 m step at 28 m/s flies 0.53 s and 15 m, so a
rider on the roofs is landing every house; a perfect landing's boost (2.5 m/s and more with a trick) is what keeps
the roofs faster than the street, since a landing on a level roof keeps none of the drop (`land()`'s along-slope
gain is for falling ground: a roof falling at 0.14 gives some back).
- *Alleys* cross each row between blocks, 4 to 8 m: the ground drops to a snow-filled floor 2.5 m under the eave,
  then rises up a drift against the next block's gable to its first roof, which is lower than the last one. A rider
  who pops and stomps crosses it; one who drops in rides up the drift, slower. *Never a roof higher than the last*
  (the concept's "sometimes level or higher"): a sled flying short of a higher roof would be lifted onto it.
- *Corner drifts* from the street up onto a row: one at least every 250 m, sides alternating; a ramp along z from
  the street at its foot to the row's eave level at its top, about 24 m long. Because the street falls at 0.22 the
  drift is nearly level in absolute height (it rises 6 m over a street that has fallen 5.3 m): a street rider steers
  onto it and is on the roofs.
- *Chimneys* (`ObstacleKind 'chimney'`, radius 0.5 to 0.7, 1.6 to 2.2 m over the roof) stand on the roofs beside the
  ridge, never within 1.5 m of it; weave them, or be over them in the air.

*How a step is only ever left from above:* the street's fronts turn a sled back (hook D, `streetAt`): a sled below
`street + LEVEL_H` (2 m) is held to `|x - cx| <= 4.8` except at a corner drift's opening, by the street's own scrape.
The roofs start at 6.0, so a street sled, even moving sideways at 70 m/s, never samples a roof. A roof sled that
goes off the front eave falls into the street; one that goes off the back is turned back by the corridor's edge
(`hw`, `limit` 0.6). No facade is a collider (a house front would be a capsule 14 to 60 m long, which neither the
sim's three-chunk collision window nor the bot's 3.2 m `REACH` can hold, and as colliders the street would hold
about 670 a km).

*What a fall is here:* a chimney met head on (the five's rule); a flight of 0.75 s or more landed wrong (off a roof
into the street is 1.1 s). A house front never floors anyone (a scrape). *The HUD signal:* none new (the roof run
reads as the combo's chain; the stage card says the row ahead).

*The five never enter:* `levelOn` false; `streetAt` is null without being called; `'chimney'` is placed by the kit
alone.

**The bot.** Its line is its level: on a roof (its `y` 2 m or more over the street) the bold line is the ridge of
the row it is on (`boldX`, by side), in the street it is the street until the next corner drift on a side it can
reach, then the drift. It pops at each house step and alley (`lips`), judged by `popFlight` on the real ground
(`course.ground` holds the roofs), stomps by its timing, and weaves chimneys with its own collider scene (they are
ordinary obstacles). *The lab check:* the expert spends 85% of the run on the roofs and the novice under 30%; the
roofs beat the street by 10% or more for the mid pilot; the clumsy pilot finishes.

**Its own promises** (`tests/gablefall.test.ts`): the street's lane is clear; along every row's ridge the ground never
rises in z except on a drift (so no roof is met from below); every drop from a roof lands on ground at most 9 m
lower; a corner drift at least every 250 m; the ridge line is clear of chimneys by 1.5 m; the street's fronts hold a
sled below the eaves everywhere but a drift's opening; the clumsy pilot finishes 27 of 30 or better. *Low's cost* is
the world lane's and is measured before the world is built (DECISIONS 392); the sim adds no draw.

---

## 8. Chaos, moods and charms on the three

- *Events.* `Layout.events` (a bit each by `ChaosEvent`) says which mid-run events a mountain can meet.
  `rollChaos(seed, runIndex, lastMood, allowed = ALL_EVENTS)` (`chaos.ts` 157) turns an event its mountain cannot
  meet into `None` right after drawing it, before the legend's own stream is read, so such a run may roll a legend;
  with every bit set (the five, every Daily and Cup) it draws and returns exactly what it does today. Its callers pass
  `eventsFor(seed)` (a pure function beside `finishZFor`): `app.ts` 1522 and the pool generator's `bot/pool.ts` 77;
  the Trials' pick (`trial.ts` 150) and the Long Night's `legChaos` (`modes.ts`) filter the same way. The sim also
  ignores a disallowed event (its `triggerZ` is `Infinity`), so a crafted record cannot run one. Proposed: the Old Run meets the light storm and the spirit train (an avalanche at 0.87 of the 22 m/s
  cruise catches a slush rider, and a yeti has no room to cross a 15 m channel); Gullhaven the avalanche, storm and
  train (a yeti would walk out of the sea); Gablefall all four, the avalanche only if the fairness suite's
  "a clean, boost-free rider outruns it in every mood" holds there.
- *Moods.* All six, unchanged. The lift scales with Comet Night's gravity (section 3C). Glass Ice's grip makes the
  wall slip more and the roofs harder to stomp: the lab rides each mood once per mountain.
- *Charms.* Dealt as everywhere from the record's pool. Frost Runners and the Black Ice pair bite only where a
  surface says `ice` (the glaze, the harbour, the river). Charms with nothing to act on (Bell Rope where there are no
  rails) are a choice a rider can misjudge, as Ember's lack of ice already makes Frost Runners there. If the mountain
  lanes' charm races show one decides too much, the game layer narrows that mountain's pool (`SimConfig.charmPool`,
  which the record carries); the sim is not touched.
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
| `app.ts` 2510 | `recordStanding(fr)` | unchanged (the record's seed) |
| `challenge.ts` 44 `targetZ(o)` | `min(o.distance, FINISH_Z)` | `min(o.distance, finishZOf(o.seed))` (an `OldLink` has its seed) |
| `challenge.ts` 77 | `recordStanding(rec)` | unchanged (the seed is in the `Pick`) |
| `field.ts` 147 `poolTime(g)` | `predictedTime(g.distance, g.ticks / 60)` | `poolTime(g, finishZ = FINISH_Z)`; `pickField` passes `i.finishZ` (a new optional `FieldInput` field, set by `app.ts` 1190 from the course); `league.ts` 33 is the Cup's (five grammar) |
| `field.ts` 301 `check()` | `recordStanding(r)`, `predictedTime(...)` | the record's seed for both |
| `field.ts` 353 `wreckOf`, 480 `rivalOf` | `>= FINISH_Z` | `>= (i.finishZ ?? FINISH_Z)`; `rivalOf(field, anchor, promised, finishZ = FINISH_Z)` |
| `field.ts` 169 `anchorFor` | other keys' times x1.1 when this key has none; clamped 100 to 420 s; `FIRST_RUN_PACE` per key (113) | another key's times scaled by `finishZOf(this) / finishZOf(that)` before the median; the clamp scaled by `finishZ / 4500`; `FIRST_RUN_PACE` gains the three (the mountain lanes' lab medians) |
| `ghosts.ts` 468, 487 | `reading(z, FINISH_Z)`, `stringOffset(..., FINISH_Z)` | the field's own `finishZ` and last stage's length, set at the race's start (as `rivalProbe` already takes `course.finishZ`, `app.ts` 1613) |
| `pacer.ts` 47, 130 | `PACE_OPEN` = the last stage's 1,550 | `reading(z, finishZ, open = PACE_OPEN)`; the caller passes the course's last stage length |
| `graveyards.ts` 90, 91 | falls before `FINISH_Z` | `graveyards(pool, key, taken, finishZ = FINISH_Z)`; `bundledGraveyards` passes each mountain's `finishZOf(seed)` |
| `missions.ts` 82, 95, 111 | distance missions capped at `FINISH_Z` | unchanged: the five's length caps them; on a shorter mountain a long one is simply not met that run |
| `missions.ts` 79, 105 to 114 | `under(210)`, `under(185)`, `under(160)` | a time mission counts only on a course of the five's length (`r.finishZ === FINISH_Z`, a new optional `RunSummary` field): a 100 s Gablefall must not meet "under 2:40" |
| `settle.ts` 361 | `predictedTime(..., FINISH_Z)` | `sum.finishZ ?? FINISH_Z` |
| `scripts/playtest/race-lab.ts` 28 | `FINISH = 4500` | the course's |

Already read from the course, no change: the HUD's stage line (`app.ts` 3825), `canRideHome` (2965), the rivals'
watch (`app.ts` 1613, `bot.ts` 2092), `render/ghosts.ts` 1670 `rodeHome`, `results.ts` and `sequence.ts`
(`m.finishZ`), splits (per stage, from `course.stages`), the Long Night's depth (metres into a leg's own course),
the reel (`game/shots.ts`, `render/shots.ts`: they plan from `course.finishZ` and `course.leaps`, which is empty on
the three: the hero leap shot falls back to none, `director.ts` 575). The render's four `RUN_OUT` reads
(`landmarks.ts` 501, 606, 776, `overlook.ts` 217) become `c.runOut` in the groundwork (four mechanical hunks).

**A test for it** (`tests/finishz.test.ts`): for every registered mountain and the lab Old Run, a record that crossed
its line reads as finished and one a metre short does not, through `recordStanding`, `poolTime`, `pickField`,
`targetZ`, `graveyards` and `settleRun`; and for the five, every one of those returns what it returns today.

---

## 10. The game layer making room for eight

- **The mountain list.** The three are *appended* to `MOUNTAINS` (indices 5 to 7), never inserted: `MOUNTAINS[i]` is
  read by index in the Trials rotation, The Twelve's `home`, `?debug&m=`, the pool generator's `mountain`
  (`generate-ghosts.ts` 96), `masteryBoard`, `trialfield.ts` 43 and the graveyard naming order. A mountain registers
  in its lane once its pool exists (`ghostpool.test.ts` asks for a pool for every mountain). Until then the course
  table carries its row and the lab its seed. `MountainId` gains each id as it registers.
- **The title's strip** (the ui lane's picker): the model (`app.ts` 908) lists `MOUNTAINS` in its order; the picker
  shows them by `unlockGhosts`, the finale last: Pinecrest 0, Frostfang 4, **Gablefall 8**, Ember 12, **the Old Run
  18**, Sakura 24, **Gullhaven 32**, Lanternfall. Eight chips must fit a desk and a 390 px phone: a note for the ui
  lane, which is building that picker now.
- **Unlocks** at 8, 18 and 32 ghosts: each `MountainDef.unlockGhosts`; `mountainOpen`, `lockText`, the ghost ladder
  (`progress.ts` 20, sorted by `unlockGhosts`) and `unlockedBiomes` read it as they are. A returning player past 32
  opens all three at once: the ui lane's "New" says it once.
- **Trials** (`trial.ts` 131, `% 5`): from a set week the mountain turns over the eight; every earlier week keeps its
  Trial.
  ```ts
  /** From this ISO week the Trial's mountain turns over all eight (round 9); every week before keeps the five's. */
  export const EIGHT_FROM = '2027-W06';   // the main lane sets it to the first full week after release
  const FIVE_TURN = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
  const EIGHT_TURN = [...FIVE_TURN, 'gablefall', 'oldrun', 'gullhaven'];
  const eight = i >= weekIndex(EIGHT_FROM) && EIGHT_TURN.every((id) => MOUNTAINS.some((m) => m.id === id));
  const mountain = eight ? EIGHT_TURN[(((i - weekIndex(EIGHT_FROM)) * 3) % 8 + 8) % 8] : FIVE_TURN[(((i * 2) % 5) + 5) % 5];
  ```
  (`* 3` steps through all eight and never repeats a week; the five's list is written out, not read off `MOUNTAINS`.)
  The measure stays `MEASURES[i % 4]`, except that a 'perfects' week on the Old Run (no landings to stomp) takes
  'score'. `NAMES` and `HOURS` (82, 84) gain the three (a test: every id the rotation can reach has both). A Trial
  rides its mountain whether or not the player has opened it, as today (Trials open after every one of the five).
- **The Long Night's legs** (`modes.ts` 21): built from the registered ids in the ladder's order, then mirrored:
  ```ts
  const NIGHT = ['pinecrest', 'frostfang', 'gablefall', 'ember', 'oldrun', 'sakura', 'gullhaven', 'lanternfall'];
  const order = NIGHT.filter((id) => MOUNTAINS.some((m) => m.id === id));
  export const LEGS = [...order, ...order].map((mountain, i) => ({ mountain, mirror: i >= order.length }));
  ```
  With the five alone this is today's list exactly. With eight it is sixteen legs. `legsOpen` (`almanac.ts` 195)
  reads the pages' 3, 6 and 10; `startNight` clamps to `LEGS.length`, so the page that opened "all ten" must open all
  sixteen (its reward becomes `legs: 99`, read as "all"). A saved best depth stays a count of legs: deeper is still
  deeper. The Old Run is the sprint leg, Gullhaven the long one.
- **Graveyard names, stable first** (`graveyards.ts` 41, 127): `GRAVE_NAMES` is frozen at its 22 names (a comment says
  never append) and keeps naming the five and the Dailies over `N = 22` exactly as now. The three name theirs from
  `[...GRAVE_NAMES, ...GRAVE_MORE]` (new names, their own `N`), and since `bundledGraveyards` names in `MOUNTAINS`
  order and the three come after the five, the shared `taken` set the five fill is the same as today. A test holds
  the five's bundled names as literals before and after.
- **`VERBS` appended** (`moments.ts` 38): each mountain lane appends its three verbs when its mountain registers, in
  the order the Old Run, Gullhaven, Gablefall, never reordering (the music's stingers key on the name and fall back to
  `st.any`, `stemdeck.ts` 275; the boards on the set piece's key). `moments.test.ts` 87 ("every verb is played
  somewhere") then holds because each verb arrives with its mountain.
- **Daily and Cup:** `BIOMES` stays the four (`mountains.ts` 160); a Daily or Cup seed reads `FIVE` and its biome's
  rows as now. Proved by the fingerprint's Dailies.
- **Home riders, no new Twelve:** each new pool's home riders are its lane's (the generator's `mountain` index);
  `ROSTER`'s twelve `home` values stay 0 to 4.
- **The generator** (`scripts/generate-ghosts.ts` 93) regenerates every mountain in `MOUNTAINS`. It gains `--only
  <id>` and refuses to write any of the five's files (a guard on the five's ids), so "only the three new pools are
  generated" is enforced, one mountain at a time in the heavy slot.
- **Missions' biomes** (`missions.ts` 160): a new mountain's borrowed look (until its world lane widens `BiomeId`)
  would count it as that biome's; harmless (it opens later than the biome), and gone once the look is its own.

---

## 11. The suites

- `tests/five.test.ts` (new, first): the fingerprint (section 0).
- `tests/fairness.test.ts`: the shared promises become the five's. `SEEDS` (14) becomes `FIVE_SEEDS`, the
  acts-grammar mountains and the six Dailies, for the first minute (322), ravines, tree runs, lakes, forks, streets,
  bridges, tunnels, terraces, leaps, the finish square, kickers, rails, the rhythm (`FINISH`, `RUN_OUT`,
  `rampDistance` checks at 248 to 250), signatures and contrast. What every mountain must keep runs on all eight:
  the lane clear to the run-out (102), the line smooth (137) with the five's 0.018 curvature as the five's and each
  layout's own limit for its own, the ground launching only where it means to (153, with each kit's meant spans),
  the line-following driver (178) and the avalanche on each mountain that can meet one (200).
- `tests/oldrun.test.ts`, `tests/gullhaven.test.ts`, `tests/gablefall.test.ts`: each mountain's promises (sections 5
  to 7), written by its lane as its mountain is built; the Old Run's in Phase 2 on the lab seed.
- `tests/charmgates.test.ts` 47: `THRESHOLD_HW` becomes the course's `layout.thresholdHW`; "no ice at a gate" holds
  (the thresholds' surfaces are not ice on any of the three).
- `tests/moments.test.ts` 75: set pieces at least 900 m apart is the five's; a new mountain's are a stage apart.
- `tests/determinism.test.ts`: its four cases gain each new seed as it registers, and the lab Old Run in Phase 2.
- `tests/ghostpool.test.ts`, `tests/migration.test.ts`: unchanged; they must stay green untouched.
- The budget tests (`tests/setpieces.test.ts` 350, the street and finish triangle budgets) run on every mountain: the
  world lanes'.
- **Run how:** after every Phase 2 step, `npx tsc --noEmit -p .` and `npx vitest run --maxWorkers=3 tests/five.test.ts
  tests/determinism.test.ts tests/fairness.test.ts tests/ghostpool.test.ts tests/migration.test.ts
  tests/charmgates.test.ts tests/moments.test.ts` (in the heavy slot: fairness alone is a full minute of one worker);
  the full suite in the heavy slot before the last commit; `npx tsx scripts/playtest/r9-courses.ts` in the heavy slot
  at the end, whose five's table must match `shots/r9/measure/r9-courses.txt` figure for figure.

---

## 12. The order of work, and what the mountain lanes add

**Phase 2, the groundwork** (each step its own commit, each green on the list above):

0. `scripts/r9/five-fingerprint.ts` and `tests/five.test.ts`, captured on 6255b8d with no other change.
1. The course table: `Layout`, `FIVE`, `LAYOUTS` (the five's rows only), `Course.layout`, `runOut`, `finishZFor`, and
   every `src/sim` read site of section 1. The render's four `RUN_OUT` reads.
2. `FINISH_Z` from the course: every game-layer site of section 9, `tests/finishz.test.ts`.
3. The game layer's room for eight: `EIGHT_FROM` and the Trials turn, `LEGS` from the registered ids, frozen
   graveyard names, the generator's `--only` and its guard, `anchorFor`'s scaling, the time missions' rule,
   `allowedEvent` and the rollers' masks.
4. The fairness suite split (`FIVE_SEEDS`; per-layout limits), charm gates and moments per layout.
5. The kit seam: `CourseBiome` widened by `'oldrun'` only, `lookOf`'s borrowing, `kit.ts`, the hooks in `course.ts`,
   the sim's hooks A and B (C and D are written with their mountains, by Gullhaven's and Gablefall's lanes, to this
   design), the bot's hooks for the track (`raceX`, the wall term in its heading), `wallYaw` exported.
6. The lab Old Run (`src/sim/oldrun.ts`): its kinds, composer, centre line, cross-section, parapet, surfaces; seed
   `0x9b05688c` (SHA-256's sixth initial word, beside the five's) in `BIOME_BY_SEED` only, not in `MOUNTAINS`; lab
   support (`lab.ts` and `r9-courselib.ts` take `--seed`); `tests/oldrun.test.ts`.
7. The lab: does a sled ride up the bank on the glaze and sink to the slush at about 36 and 18 m/s; the mid, novice,
   careful and clumsy pilots and the bot on it (time, speed on each surface, share of each bend on the glaze, lip
   scrapes, launches off a wall, falls); then the full suite and the five's measure table in the heavy slot. Frames
   of the lab course from the chase camera under `shots/r9/ground/` (a `?debug&seed=` dev switch, the borrowed look).

**What each mountain lane adds on top** (in its own files where it can): its `CourseBiome`, `BiomeId` and
`MountainId` id; its `BIOME_PARAMS`, `TALL`, `LOW`, `CLIFFS`, `SCRIPTS`, `SIGNATURES`, `LAYOUTS` rows; its kit (the
Old Run's grows from the lab's); its seed, chosen through the fairness and budget tests and checked against every
Daily and Cup key to 2040; hooks C or D (Gullhaven, Gablefall) and the bot's `lip` goal and line-by-level; its
promises' test; its three set pieces (`AUTHORED`, `FAMILY`, `VERBS` appended, `MomentVerb`, the builder, the sim's
`momentStep` and `momentCount` cases, the bot's `momentRide`/`momentOff`, `momentcopy.ts`) and two legends; its
`MECHANICS` hook in `r9-courselib.ts` (the Old Run: on a bend's wall at u 0.3 or more; Gullhaven: in the air inside
a column; Gablefall: 2 m or more above the street); its world and the render and audio tables keyed by biome, kind
and obstacle; its score; its pool (`--only`, the heavy slot, nothing else open) and home riders; its registration in
`MOUNTAINS` with `unlockGhosts`; the Trials' `NAMES` and `HOURS`, `FIRST_RUN_PACE`, the album, the Almanac, mastery,
mirror and hour, photo and clip, the key art's card. The order is DECISIONS 392's: the Old Run, then Gullhaven, then
Gablefall (whose Low cost is measured before its world is built).

---

## 13. The review

*(To be filled after the fresh adversarial review: its findings, my answer to each, and what changed.)*

---

## 14. Questions for the main lane

*(To be filled after the review.)*

---

## Appendix: the read sites as the script counts them (6255b8d)

`node scripts/r9/ground-readsites.mjs`: length 160 reads (src/game 26, src/render 6, src/sim 16, scripts 10, tests
102); opening 45 (src/sim 32, src/game 2, src/render 2 of which are a shader's own `opening()`, tests 8); thresholds
20 (src/sim 16, tests 3); the mountain list 268 (src/game 46, src/sim 11, src/audio 3, src/render 6 of which are
`% 5` in shaders and particles, not the list, tests 154, scripts 46); tables keyed by biome, kind or verb 35
(src/render 15, src/sim 15, src/audio 4); leaps 66 (src/render 7, src/game 5, src/audio 2, src/bot 1, src/sim 12).
Every `src` read of the length, opening and threshold groups is in sections 1 and 9; the list's in section 10; the
tables' are the world lanes' but for the two `Record<SectionKind>` tables named in section 2.
