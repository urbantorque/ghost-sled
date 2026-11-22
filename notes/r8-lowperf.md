# Round 8: the lowperf lane (Low at 6x against round 7, after the play and screens merges)

The item: Low at 6x at or over round 7's frame rate (V9), with the main lane's finding that round 8's final build
did 8 to 12 fps less there and that workcal put almost all of it between `9685d8b` and `9cafb5b`.

Builds: round 7 = `dist/r7-main` (88d3663, port 4881); the bisect's fast point = `dist/bis-9685d8b` (4882); base =
this branch's root, round-8 at 4332087 (`dist/r8-lowperf-base`, 4885; its code is the final build's, fb16ec5, plus
two lines of roster and a CSS block); this lane = `dist/r8-lowperf` (4880). Unminified twins for profiles: round 7
rebuilt from 88d3663's tree (`dist/nomin-r7`, 4884), base (`dist/nomin-head`, 4887), this lane (`dist/nomin-lp`,
4886). Raw output: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/lowperf/` (`a` to `g` by batch).

## Method (and what it could and could not see)

Every sitting was shared: five review lanes took the one browser slot in turn, and the machine's speed swung by two
between runs a minute apart (one unminified base ran a frame callback of 11.8 ms, the next 25.1 ms, same build, same
mountain). So causes were found with measures that do not move with the machine, and per-frame milliseconds were
only compared inside one profile or between runs of matched speed (the tools are in `scripts/playtest/lowperf/`):

- **A held run's GL count** (`glv.js`, new): stills.js's virtual clock (a pool rider replayed as the player on exact
  1/60 s steps from a fresh save) with glcount.js's counter, over sim z 230 to 1230. Two runs of one build agree to 0.6%
  (537.0 and 540.3 on Ember). glcount.js rides a live pilot, and the field's pacing follows the frame times, so one
  ghost more or less on screen moved its count by 30 between runs of the same build (`glz.js`, the same counter over a
  fixed stretch, showed it: Ember 509.6 and 521.0 for builds whose difference cannot add a draw).
- **Draws by what they are** (`drawlist.js`, new): every GL call put down to the three.js draw it belongs to (object
  name, material, its first uniforms), and the calls outside any draw by name.
- **CPU profiles with a ruler** (`prof.js`, new): profile.js's ride, the call tree merged by path and kept whole (read
  offline with `tree.cjs`: flat, a subtree, a diff by function), workcal's arithmetic timed in the same run so a run's
  milliseconds can be read in rulers (`R=1`), and per-frame counts of audio nodes made and connected, canvas text, GL
  uploads and DOM mutations, with the stacks that made them when asked.
- **The page's lifecycle** (`lifetrace.js`, new): a trace with invalidation tracking, read per frame (style recalcs
  and the elements they styled, layouts, paints) with the nodes invalidated and why, and the CSS animations seen
  running; `paintwho.js` (new) lists the composited layers and why each is one.
- **The scene graph** (`scenestat.js`, new), **gate and set piece places** (`gates.js`, new).
- workcal.js and frametrace.js as the perf lane left them.

## What was found

1. **The bisect's fast point drew no ghosts.** At `9685d8b` the pools were still the SIM_VERSION 9 records
   (a95ad26 regenerated them on 10 only after this merge), replayed on the new sim: in 10 s of Ember's Low frame
   there is no ghost glass and no ghost depth draw at all (`b/dl2-9685-m2.json`; round 7 has both, 0.98 a frame,
   `b/dl2-r7-m2.json`), and the rider, with no field to draft, rode a quarter slower (583 m in 20 s against 769 for
   the base, `a/prof-*-m2.json`; workcal's own rows show it too, z 1026 to 1077 against 1180 to 1250). So its
   workcal (2.14 to 2.21, under round 7's) and its GL count (446 on Ember) are a frame without the field, not a
   target a build with ghosts can meet, and "between 9685d8b and 9cafb5b" is where the field came back, not where a
   fault went in. Round 7 is the bar.
2. **What a Low frame draws more than round 7's is mostly ghosts on screen.** In the held run (`f/gv-*.json`) round
   8 shows its field far more: on Ember 2.85 ghosts drawn a frame against round 7's 0.7, Pinecrest 1.6 against 1.25,
   Sakura 0.4 against 0.25 (from colorMask, two calls a ghost's depth pass). Each ghost on screen is two draws (its
   depth pass and its glass), about 27 GL calls and about 0.09 rulers of a frame's work (draws and its pose), and the
   field's wisps, shadows, halos and glass sleds are four more draws whenever any ghost is. Everything else round 8
   added to a Low frame's draws is designed and one draw each: the composed places' framing (`compose-frames`, 13
   calls), the poster (8), a charm gate in reach (8, about half the run), and two more uniforms on the glass. This is
   the field racing beside you (the pacer, the pools drafting each other, showdowns): what round 8 is about.
3. **The frame callback itself is near round 7's.** In profiles taken at matched machine speed (`b/prof-r7n-m2r` 31.1
   fps and `b/prof-head-m2r` 32.0 fps, Ember) the game's frame callback is 16.8 ms against 18.3 (+9%), spread thin:
   the renderer +0.3 ms (it is 59% of the callback on both), the sim's ticks +0.24 (SIM_VERSION 10 does more), the
   chase +0.14, the far field's update +0.17 (the visual lift), Spirit Flow +0.08, journey +0.08, none of them one
   thing. The whole main thread per frame (idle excluded) is level: 28.8 against 29.1 ms. A first workcal of my own
   (two rounds, Ember, `b/wc-r7-base-m2.json`) read round 7 2.85 and the base 2.66: in this machine's swings two
   rounds cannot tell 10% apart, and a build that runs while the machine is slow also does more ticks a frame, which
   workcal counts as work.
4. **Idle work: a tunnel's rock cost 2.7 times round 7's to build.** The forest lane cut every rock mass over 2.2 m a
   step finer (07938de: 80 faces for 20), and a tunnel's vault asks for hundreds: at matched speed the set pieces'
   idle builds ran 2.3 ms a frame against round 7's 0.8 on Ember (`vault` 1.05 against 0.39), on the 200 ms timeout,
   since a saturated Low frame leaves no idle time.
5. **Ghosts off screen were posed every frame.** The ghost layer (render/ghosts.ts, 1.3 to 1.6 ms a frame at 6x) posed
   every ghost with a record (springs at 240 Hz, the trick pose, a slope sample), built its two ribbons and its
   shadow (three snow samples) and its halo whether or not it was drawn, and the field's four shared draws ran and
   uploaded with every alpha at zero when none was on screen.
6. **Charm gates out of reach asked the course for the line twice a frame each**, on every tier (a course sample is
   a noise sum: the course's two-entry memos miss for scattered z).
7. **Audio makes 2.2 times round 7's nodes a second** (createGain 23 a second against 11, connect 58 against 26:
   `b/stk-head-m2.json`, `b/prof-r7-m2.json`), but the sound engine is round 7's (sfx.ts only added beats): the duel
   heartbeat (a dozen nodes a beat), the fuse tick (about six, at up to 7.5 Hz), the draft's breath note, all
   played more because the field is near. About 0.3 ms a frame at 6x. Not changed (see Still short).
8. **The page's lifecycle does more because the HUD reacts more.** Per frame, base against round 7 (`b/lt-*.json`):
   1.11 paints against 0.56, 0.37 layouts against 0.20, 4.5 elements styled against 2.1; the invalidations are the
   race pill's rank and its delta and ring, the draft pill and the combo bar (hud.ts changed by 20 lines since round
   7): the same HUD told more often. Composited layers are the same set (38 against 48 at one moment, `c/pw2-*`).
   Ruled out: DOM growth (381 nodes against 362), the round's 2,500 new lines of CSS for hidden screens (styled only
   when shown), garbage (0.5 ms a second), the scene graph (190 objects against 181, 81 walked against 77,
   `d/ss-*.json`), the label atlas churning (25 uploads in 20 s).

## The changes (each small, render only; nothing in the sim, the bots, the pools or a record)

1. **Only a ghost on screen is posed and has its wisp, shadow, halo and glass sled built** (`src/render/ghosts.ts`,
   4101b79, every tier). One off screen keeps its pass reaction's clock and its motes (they play out beside the
   rider, where the ghost itself may be out of the lens), and its wisp keeps the path its body takes, upright; it
   snaps to its pose the frame it comes back (springs at rest, tilt and trick pose eased in at once), which is what
   the first frame of a run already did. The four shared draws (wisp, shadow, halo, sleds) are drawn only while a
   ghost on screen has them, and their buffers are sent only when one was written (a ghost leaving the screen clears
   its share once, not every frame). Nothing on screen changes: a ghost that is not drawn had every alpha at zero.
   - Held run, Low, GL calls a frame (`f/gv-*`): Pinecrest 491.6 to 474.4, Sakura 511.9 to 465.2, Ember 537.6 to
     537.0 (a ghost is on screen nearly every Ember frame, so nothing rests there).
   - The layer's update in rulers, Ember: 0.164 and 0.203 (base) to 0.172 (a run at 18 fps) and 0.119 (`c/prof-*`).
2. **A rock's mass is copied, not made** (`src/render/town.ts`, 2966514 and d133b57, every tier): a vault's few
   hundred masses are copies of the two cuts made once (the same vertices, checked equal), where each was an
   icosahedron built from scratch (about half of a vault's build in the profiles).
   - Tried and withdrawn: Low kept round 7's cut (twenty facets to every mass). Measured with it, the set pieces'
     idle builds on Ember fell from 0.165 and 0.224 rulers a frame to 0.084 (and 0.167 in an 18 fps run), the vault
     from 0.108 and 0.148 to 0.043 and 0.074. But at the lens it brought back what the forest lane's cut removed:
     Ember's lava tunnel at 1260 m is a wall of shards a tenth of the frame wide on Low
     (`stills/lp-low-tunnel/m2-z1260.png` against `stills/base-low-tunnel/m2-z1260.png`), a changed look rather than
     less detail, so every tier keeps the finer cut (d133b57). The workcal and profiles below were taken with it in;
     the GL counts do not depend on it (the same draws).
3. **Charm gates out of reach skip the line's slope** (`src/render/charmgates.ts`, 3002f74, every tier).
4. **Nothing given up on Low.** What a frame shows is unchanged on every tier.

## Tables

**Work a Low frame at 6x** (workcal.js, two rounds a mountain, round 7 / base / this lane interleaved, 12:20 to 12:35
on 22 November with the review lanes between my slots; `g/wc-final.json`). The raw mean, the fps each run got, and the
same work at one frame rate: workcal counts a frame's ticks as its work, and a run that lands on a slow stretch does
more ticks a frame (within one build and mountain the two rounds' work moved about one ruler per extra tick a frame,
pooled over all nine pairs), so each run is also read at 45 fps (1.33 ticks a frame):

| mountain | round 7 raw (fps) | base raw (fps) | this lane raw (fps) | round 7 at 45 | base at 45 | this lane at 45 |
|---|---|---|---|---|---|---|
| Pinecrest | 2.73 (23, 45) | 3.54 (17, 49) | 3.00 (23, 39) | 2.10 | 2.48 | 2.26 |
| Ember | 2.30 (54, 32) | 2.63 (37, 52) | 2.29 (52, 54) | 2.15 | 2.57 | 2.49 |
| Sakura | 1.95 (55, 51) | 2.46 (46, 42) | 2.83 (36, 35) | 2.16 | 2.41 | 2.46 |
| mean | 2.33 | 2.88 | 2.71 | 2.14 | 2.49 (+17%) | 2.40 (+13%) |

So the bar is **not met**: at a common frame rate this lane takes back about a quarter of the base's excess over round 7
(Pinecrest most, where the field is off screen most; these runs had Low's coarser tunnel rock in, since withdrawn,
which only Ember's tunnel stretch felt), and the raw means move with the machine more than with the
build (one build ran 17 and 49 fps on one mountain a minute apart). The main lane's quiet sitting settles it.

**GL calls a Low frame** (exact counts). Held run (`scripts/playtest/lowperf/glv.js`: the same pool rider replayed on exact steps, sim z
230 to 1230, `f/gv-*.json`; two runs of one build agree to 0.6%), and the live pilot over the same stretch
(`scripts/playtest/lowperf/glz.js`, `e/gzl-*.json`, where the field's pacing follows frame times and a ghost more or less on screen moves
a count by about 30; the only way to count 9685d8b, whose pool riders cannot be replayed):

| mountain | round 7 held | base held | this lane held | ghosts drawn a frame (r7 / r8) | 9685d8b live | round 7 live | base live | this lane live |
|---|---|---|---|---|---|---|---|---|
| Pinecrest | 463.2 | 491.6 | **474.4** | 1.25 / 1.6 | 442.3 | 467.6 | 494.8 | 468.2 |
| Ember | 476.6 | 537.6 | **537.0** | 0.7 / 2.85 | 462.3 | 483.3 | 509.6 | 521.0 |
| Sakura | 478.4 | 511.9 | **465.2** | 0.25 / 0.4 | (468.2, z 230 to 550) | 480.0 | 521.6 | 515.3 |

The 9685d8b bar is under round 7's because it drew no ghost at all (finding 1); this lane meets it on no mountain and
meets round 7's on Sakura, within 11 calls of it on Pinecrest, and not on Ember, where round 8 draws two more ghosts a
frame than round 7 (about 58 calls).

**The rest unharmed** (held run, Pinecrest, z 230 to 830, `g/gv-*.json`): GL calls a frame High 1,096.3 to 1,049.9,
Medium 888.6 to 838.4, a phone's frame (390 by 844, Medium) 841.0 to 790.2. Nothing is added on any tier; the ghosts'
saving is on every tier.

## For DECISIONS (to paste)

**Low at 6x after the play and screens merges: the cost is the field on screen, and a quarter of it is given back**
(`notes/r8-lowperf.md`, the lowperf lane; raw output in `shots/r8/lowperf/`). The bisect's fast point, 9685d8b, was a
build whose pools were still SIM_VERSION 9's (a95ad26 regenerated them after it): its Low frame drew no ghost at all and
its rider, with nothing to draft, rode a quarter slower, so its work (2.14 to 2.21) and its GL calls (446 on Ember) are a
frame without the field, not a bar a build with ghosts can meet; round 7 is the bar. Counted on a held run (a pool
rider replayed on exact steps, so two builds draw the same frames; a live pilot's count moved by 30 with one ghost
more or less on screen), what a Low frame draws more than round 7's is the field: round 8 draws 2.85 ghosts a frame on
Ember against round 7's 0.7 (two draws and about 27 GL calls each, and four shared draws whenever any is), and one draw
each for the composed places' framing, the poster and a charm gate in reach. Profiled at matched machine speed the
frame callback is 9% over round 7's and spread thin (the renderer is 59% of it on both builds); the idle builds of a
tunnel cost 2.7 times round 7's (the forest lane's finer rock cut); audio makes 2.2 times the nodes a second (the same
engine, the duel heartbeat and fuse ticks played more); the page's lifecycle paints twice as often (the race pill and
draft pill told more often). *The fix, render only:* a ghost off screen is no longer posed or given its wisp, shadow,
halo and glass sled, and with none on screen those four draws and six uploads rest (every tier; nothing on screen
changes); every tier copies a rock's mass instead of building it (round 7's coarser rock on Low
halved a tunnel's build but brought back shards a tenth of the frame wide at the lens, and was withdrawn); gates out of
reach skip their slope. Held-run GL calls a Low frame: Pinecrest 491.6 to 474.4 (round 7 463.2), Sakura
511.9 to 465.2 (478.4), Ember 537.6 to 537.0 (476.6); High, Medium and a phone's frame each 46 to 51 fewer. Work a frame
at a common 45 fps, two rounds interleaved on a shared machine: round 7 2.14, base 2.49, this lane 2.40. *Not met:* Low
at 6x is still about 13% over round 7's work, most of it Ember's field on screen. Rejected: drawing far ghosts without
their depth pass, or fewer ghosts in glass on Low (a look change the owner should see first); prerendering the
heartbeat and fuse ticks (an audio lane's work, about 0.3 ms a frame at 6x).

## For the README

For the performance section, beside the perf lane's Low numbers:

> Ghosts off screen cost a frame nothing: only a ghost the lens can see is posed and given its wisp, shadow, halo and
> glass sled, and with none in view those draws rest (a Low frame on Pinecrest asks WebGL for 474 calls, round 7's
> 463). Round 8's field races beside you, so a Low frame on Ember draws about two more ghosts than round 7's did;
> each is two draws.

And under the tools: `scripts/playtest/lowperf/glv.js` (GL calls over a held run, the same frames on any build with
the same pools), `scripts/playtest/lowperf/drawlist.js` (GL calls by the draw they belong to),
`scripts/playtest/lowperf/prof.js` with `scripts/playtest/lowperf/tree.cjs` (a profile kept as a tree, with a ruler
and the stacks that make audio nodes).

## Touched

- `src/render/ghosts.ts` (the ghosts lane's and the play lane's): the update's order (visibility before the pose),
  `restGhost`, `wispPath` and `reactMotes` split out of `poseGhost` and `updateWisp`, a `snap` through `poseGhost`
  and `moveGhost`, `hideFx` once per ghost, the shared fx meshes' `visible` and their uploads. Item gains `posed`
  and `fxOn`.
- `src/render/town.ts` (the forest lane's rock): `rockCut()`, the two cuts made once and copied (the Low cut tried
  in 2966514 is undone in d133b57).
- `src/render/charmgates.ts` (the play lane's): the reach test before the slope.
- New tools in `scripts/playtest/lowperf/`: prof.js, tree.cjs, drawlist.js, lifetrace.js, paintwho.js, scenestat.js,
  gates.js, glz.js, glv.js, pixdiff.mjs, batch.sh (one slot, one browser, a jobs file of `script|config|output`
  lines), profdiff.cjs (the main lane's, renamed for this package's ES modules).

## What the main lane must decide

1. **The bar's second half.** "glcount at or under the 9685d8b count" asks for a frame with no ghosts (finding 1).
   Restate it against round 7 (held-run counts, `scripts/playtest/lowperf/glv.js`), or keep it knowing no build with a
   field meets it.
2. **Whether Low gets a cheaper ghost.** The rest of the gap is round 8's field on screen, which is the round's
   design (the pacer keeps riders in frame, the pools draft each other, showdowns). If Low must reach round 7's work,
   the next steps are a Low ghost of its own, each a look change to show the owner first: (a) a ghost under about a
   twelfth of the frame's height drawn without its depth pass (one draw, not two; at that size its limbs' rims and its
   wisp behind its chest are a few pixels), about 12 calls and 0.03 rulers a far ghost; (b) every ghost body in one
   draw a pass, laid end to end as the glass sleds already are (two draws for the field, not two a ghost: a lane's
   work, and blending between overlapping ghosts must be looked at); (c) at most two ghosts in glass on Low, the rest
   as their wisp and tag. I did none of them.
3. **The confirming sitting.** On this machine's shared sittings the raw workcal moved with the machine (one build 17
   and 49 fps on one mountain a minute apart) more than with the build; only a quiet sitting can say whether the 13%
   that remains at a common frame rate is real. Suggested: `workcal.js` with five rounds,
   `window.__wcCfg = { builds: ['<round 7>', '<base>', '<this branch>'], ms: [0, 2, 3], rounds: 5 }`, and perf-vl.sh's
   Low loop, round 7 against this branch.
4. **Audio** (an audio lane's, if anyone's): the duel heartbeat and the fuse tick through prerender.ts as the gifts
   are (a heartbeat is linear in its loudness, so one take at unit level played through the voice's gain is the live
   sound), from about twelve nodes a beat to three.
5. **Low's tunnel rock**, if a look call can take it: round 7's twenty-facet cut on Low halves a tunnel's idle build
   (finding 4) but reads as shards at the lens (`stills/{base,lp}-low-tunnel/m2-z1260.png`); a coarser cut with the
   finer cut's lighter jitter might hold the look. Withdrawn here.

## Still short

- **The bar.** Work a Low frame at 6x is about 13% over round 7's at a common frame rate (2.40 against 2.14), and GL
  calls are over round 7's on Ember (537 against 477) and Pinecrest (474 against 463), under on Sakura. Not proven in
  fps: no quiet sitting.
- The frame callback's own excess (about 9% at matched speed) is spread over a dozen systems of 0.1 to 0.3 ms at 6x
  each (the sim's ticks, the chase, the far field's update, Spirit Flow, the journey's palette); none is one fix.
- The page's lifecycle paints and lays out twice as often as round 7's in a ride, from the race and draft pills
  told more often; Low draws the running figures in the canvas, and the race pill could follow (a HUD lane's call).
- Audio's node rate (item 4 above).
- **Stills** (`stills/{base,lp}-{low,high}/`, stills-at.sh, demo rider 0, Ember 130 to 1552 m, Pinecrest 130 to
  1552, Sakura 1500 and 1552: past the first gate with a charm held, a gate coming up at 1500 and ridden at 1552, the
  rider's flip at Pinecrest's 130, ghosts beside and ahead with wisps, tags and the edge chip; Ember's lava tunnel on
  Low in `stills/{base,lp}-low-tunnel/`). Looked at side by side: ghosts, wisps, tags, gates and glyphs draw as on the
  base; the console is clean on every still of both builds (`errors: []`). A pair is not the same frame, though:
  stills.js holds the player's run (the same tick, score and clock on both builds) but not the field, which differs
  between two runs of one build too (base Low and base High at Ember's 600 m show different ghosts), so no pixel
  comparison proves "nothing changed"; what the code does for a ghost on screen is unchanged by construction, and a
  ghost off screen had every alpha at zero before. No showdown fell inside these frames; the play lane's r8-play.js
  shoots one.
