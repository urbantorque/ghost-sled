You are the `measure` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser: Vite, TypeScript,
three.js). Your job is milestone 0's baseline for the three new mountains: **measure how the five mountains ride, draw
their profiles side by side, and write the mountain bars as scripts that fail today.** The owner's call: the five's
courses stay exactly as they are, and three new mountains must not repeat their grammar. Your numbers are what "not
the same grammar" is held to.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-measure` on branch
`r9-measure`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (lab sweeps in the heavy slot, one at a
time, workers capped; one browser on the machine, through the slot; CRLF; the trailer; no edits to DECISIONS, README
or ART; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/`; your port 4910). Then read the
brief `prompts/round-9-clear-screens-a-garage-worth-it.md` (all; section 1 "The mountains", section 2 "The three new
mountains", section 4 milestone 0 and M1 closely), DECISIONS 277, 370 and the lab's own headers
(`scripts/playtest/lab.ts`, `labpilots.ts`, `race-lab.ts`). The sim is closed: read `src/sim/course.ts`, `sim.ts`,
`mountains.ts`, `moments.ts` and `src/bot` closely, edit none of it.

## The items

1. **The lab's table for each of the five** (and each one's mirror only if it differs in anything but sign), on
   section 2's measures, for the mid pilot over at least six seeds a mountain, and the same for the novice, expert
   and clumsy pilots: the finish time, mean speed, airtime (share of the run and seconds), turns per kilometre, mean
   width and hazards per kilometre. Define each one exactly in your notes and in the script's header, and define them
   so they can tell a different course from a reskin: turns from the course's own line (its bends: direction changes
   of the safe line beyond a threshold, per km) and from the rider's (steer reversals), width from the sim's own
   corridor (the ridable width at each metre, and the share of the run under 12 m and over 30 m), hazards from what
   the sim collides with in the corridor (per km, and by kind), air from the sim's own airborne state (count of
   flights over 0.5 s, the longest, the share of time). Add the few more that the brief's eight axes imply and the
   sim can tell you: the slope's profile (mean, spread, how many pitches and flats), stages and their lengths, where
   the first leap is, how many leaps and their heights, the set pieces' share of the run, the clumsy pilot's finish
   rate and falls. Give the spread across the five for each measure (min, max), because a new mountain must sit
   outside it on at least two.
2. **A profile chart of each course, side by side,** from the sim's own course (not the render): height along the
   run, the corridor's width, the air (where leaps and kickers are, and where the mid pilot flew), the turns (the safe
   line's lateral offset), the hazards (a tick per collider, by kind), stage lines, set pieces and the finish square.
   One SVG a mountain and one sheet of all five on a shared scale, written by a node script (no browser needed), so
   anyone can see at a glance that the five are one course. Same scale so a new mountain can be laid beside them later.
3. **The mountain bars as a script, failing today:** `scripts/playtest/r9-courses.ts` (or similar) that reads every
   mountain the game registers, tells the five from any new ones by id, and prints, for each new mountain, which
   measures sit outside the five's range, whether no two new mountains are within 10% on more than half the measures,
   the clumsy pilot's finish rate against the five's hardest, and the share of the run its signature mechanic covers
   (a hook the mountain lanes will fill: a per-mountain function over a run's ticks; it reads zero today). Today it
   prints the five's baseline and "no new mountains". It must not add any work to the game's own boot.
4. **The greyscale set for "Not paintings":** with the browser (one short session in the slot), stills of each of the
   five: its opening, three places on it (one a stage, spread down the run) and its finish, desk on High, from the
   fixed-still tool (`scripts/playtest/stills.js`, `stills.sh`; a pool rider replayed as the player on a virtual
   clock), then greyscale copies (`blind-pairs.mjs --gray` or your own). Name the places by metre and section kind so
   the same set can be shot on a new mountain later. Keep the colour originals.
5. **Measure what the five share, line by line,** against section 1 "The mountains" of the brief: is it true that all
   five are 4.5 km in stages of 1,450, 1,500 and 1,550 m; the same start ramp and first leap at about 600 m; three
   leaps; the same 18 section kinds; slope 0.28 to 0.31; a mid rider home in 121 to 129 s; one corridor between 9.5 m
   banks? Say what is right, what is wrong, and what it missed, with numbers. List every constant in `src/sim` that is
   shared by all five and that a new mountain would want to vary (lengths, the start ramp, the first leap, leap sizes,
   `FINISH_SQUARE`, banks, slope, the stage count's dependants), with where it is read, so the concepts lane and the
   later groundwork can say how each could become per-mountain while the five keep their exact values.

## Deliver

Commits on `r9-measure`; `notes/r9-measure.md` with the table (every measure by mountain by pilot, the five's spread),
the measures' definitions, the line-by-line check, the shared-constants list, where the SVGs and the greyscale set
are, and how to re-run it. Write the table into your notes as soon as the mid pilot's numbers exist: the concepts lane
reads them while you work. Your final message: the table for the mid pilot, the five's spread on each measure, what
section 1 got right and wrong, and the shared constants a new mountain needs.
