You are the `ground` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; a deterministic sim in `src/sim`, `SIM_VERSION` 10). Your job is **milestone 3's M1, the
groundwork for the three new mountains the owner picked: the Old Run, Gullhaven and Gablefall.** The owner's call:
the five stay exactly as they are; the game gets new ways to ride from three new mountains, which must not repeat the
five's grammar.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-ground` on branch
`r9-ground`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite,
lab sweep and build; one browser through the slot; CRLF; the trailer; shared files; no edits to DECISIONS, README or
ART; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/ground/`; your port 4970). Then read
DECISIONS 149, 203, 277, 370, 376 and 388 to 393; the brief `prompts/round-9-clear-screens-a-garage-worth-it.md`
(sections 2 "The three new mountains", 3 "Changed for this round", 4 milestone 3, 6 and 8); `notes/r9-concepts.md`
(pages 1 to 3 closely: each concept's course, mechanic, bot, fairness, size, Low and risk, and its "What the main
lane must decide"); `notes/r9-measure.md` (the five's figures, the line-by-line, **the shared-constants list with
where each is read**, and the bars in `scripts/playtest/r9-courses.ts`); and the sim and bot closely: `src/sim`
(`course.ts` all of it, `sim.ts`, `mountains.ts`, `moments.ts`, `chaos.ts`, `tricks.ts`, the surfaces and
colliders), `src/bot`, `src/game` where a course's length or the mountain list is read, and the fairness, budget,
determinism, pool and migration suites in `tests/`.

## The rules (binding; section 3 of the brief)

Everything enters the sim as new entries under new ids (section kinds, surfaces, hazards, mechanics only the new
mountains use). A shared constant becomes per mountain only if the five keep their exact value. The five's seeds,
pools and records replay byte for byte. The rules a rider plays by stay: steer and one button (the input byte has no
spare bit), tricks, charms and scoring. The course is a function of distance downhill: it only descends and forks
rejoin; a static gust or a feature always in the same place is fine, anything that moves the safe line is not. If
something shared truly has to change, stop and say so: that is a `SIM_VERSION` 11 break and needs the owner's word.

## Phase 1: one sim design for all three, written and reviewed, before any code (then stop)

Write `notes/r9-ground.md` as the design, with code-level precision (types, functions, files, lines):
- **The per-mountain course table:** stage lengths, the opening (the start ramp and the first kicker at 286 to 312 m,
  `layKicks`), the first leap, the finish (`FINISH_SQUARE`, `RUN_OUT`, the `finish` kind), the banks and widths, the
  grade's ramp (`DESCENT`, `GRADE`), the collider budget, thresholds and charm gates: one table whose five rows hold
  today's values exactly, read where the constants are read today. List every read site (the measure lane's list)
  and how each changes.
- **`FINISH_Z` from the course** in the game layer (`app.ts`, `challenge.ts`, `field.ts`, `ghosts.ts`,
  `graveyards.ts`, `missions.ts`, `settle.ts`, `standing.ts`) and wherever else a course's length is assumed (the HUD's
  stage line, splits, the Long Night's legs, the reel and photo, records and links).
- **Each mountain's new entries:** the Old Run's banked channel (the glaze high on the wall, slush in the floor, the
  lip that only scrapes; how gravity on the banked cross-section carries a sled up the wall in the sim as it is);
  Gullhaven's static updraft zones over the gullies and the gully lips (`vy += lift * DT` only inside a zone, never
  moving); Gablefall's roofs and alley gaps, the street below and the drifts back up, the chimneys. For each: the
  section kinds, surfaces, hazards and mechanics, the code path the five never enter (and the test that proves it),
  what a fall is there, the one HUD signal, and how the bot learns it before any pool is generated (its reads, its
  lookahead, and the lab check that its ghosts ride it well).
- **The suites:** the fairness suite's shared promises (the first minute, the leaps, the kickers) become the five's,
  each new mountain bringing its own written promises; the budget tests; determinism and the five's pools byte for
  byte (which tests, run how).
- **The game layer making room for eight:** the title's mountain strip, the Trials rotation (a hard-coded `% 5`:
  change it from a set week so past weeks keep their Trial), the Long Night's legs, the graveyard names (hashed over
  the list's length: make them stable first, so adding names renames nothing), `VERBS` appended (the music's stingers
  key on its order), unlocks at 8, 18 and 32 ghosts (Gablefall, the Old Run, Gullhaven), out of the Daily and Cup mix
  (`BIOMES`), into Trials and the Long Night, home riders and no new Twelve.
- **The order of work after review,** and what the mountain lanes will add on top (world, score, pools).

Then give the design to a **fresh reviewer** (`model: "opus"`, `effort: "xhigh"`, given the design file, the brief's
sections 3 and 4 milestone 3, and read access to `src/sim`, `src/bot` and `tests/`; not your reasoning) and ask it
to find, adversarially: anything that changes the five by a bit; anything that moves the safe line or climbs; any
mechanic the bot cannot learn or a novice cannot survive; any read site the design misses. Record its findings and
your answers in the notes, revise, commit, and **stop: your final message is the design in brief, the reviewer's
findings and what you changed, and the questions for the main lane.** The main lane reviews it and sends you the word
to build.

## Phase 2: the groundwork (only after the main lane's word, sent to you as a message)

Build the design: the course table and its read sites, `FINISH_Z` from the course, the suites' per-mountain
promises, the stable graveyard names, the Trials rotation, the strip and the legs, `VERBS`; then a **lab prototype of
the Old Run's wall** as a lab-only course (not yet registered as a mountain a player can pick): does the sled ride up
the bank on the glaze and sink to the slush, at the speeds the concept worked out (about 36 m/s on the glaze, about 18
in the slush), can the mid and novice pilots and the bot ride it, what does the clumsy pilot do. After every step:
`tsc`, the determinism, fairness, pool and migration suites, and the five's records byte for byte; the full suite in
the heavy slot before your last commit. Notes as you go; frames of the lab course from the chase camera under
`shots/r9/ground/`.

## Not yours

The UI (`src/ui`), the garage, the render of the new mountains' worlds, their scores and pools (the mountain lanes'),
and the five's courses.
