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

## Second pass (the main lane's calls of 22 November, after the merge as bec2ece)

The calls: (1) Low draws a far ghost without its depth pass; (2) the duel heartbeat and the fuse tick through
prerender.ts, proven to sound the same; (3) Low's coarser rock once more, with the finer cut's lighter jitter; (4) the
HUD's race pill, its delta and ring, the draft pill and the combo bar written only on change; (5) only if those do
not reach the bar, every ghost body in one draw a pass on Low. Builds: pass 1 = r8-lowperf at 37717f2 (`dist/lp1`),
pass 2 = this branch (`dist/lp2`); raw output in `shots/r8/lowperf/h` to `k` and `stills2/`.

1. **A far ghost on Low is its glass alone** (d4eea25, `src/render/ghosts.ts`, Low only). Under 1/12 of the frame's
   height (its 1.7 m at its chest's depth) its depth pass is not drawn; on Medium and up, and for any ghost larger on
   Low, nothing changes. Held run, Low, z 230 to 1230 (`h/gv-*.json`), depth passes and GL calls a frame:

   | mountain | depth passes pass 1 / pass 2 | GL calls pass 1 / pass 2 | round 7 |
   |---|---|---|---|
   | Pinecrest | 1.55 / 0.15 | 467.7 / **450.2** | 463.2 |
   | Ember | 2.8 / 0.4 | 537.4 / **504.4** | 476.6 |
   | Sakura | 0.4 / 0.05 | 464.7 / **461.2** | 478.4 |

   Nearly nine in ten of the ghosts Low draws are far ones. Looked at in the stills (`stills2/lp2-low/`, `lp2f-low/`): the
   worst case is a ghost just under the line (Nessa Lumen mid-flip at Ember's 1500 m, about 55 px of 720): a mint
   silhouette with its rim and sled, its wisp streaming; no limb rim or wisp reads through its chest at that size.
   Near ghosts keep both passes. The threshold stays at 1/12.
2. **The heartbeat and the fuse tick from takes** (a749b9c, `src/audio/sfx.ts`, `prerender.ts`, every tier). Both are
   linear in their loudness, so a take is rendered at unit loudness and played through a voice set to the beat's
   (the live path is built the same way, so it is the same sound too). Two things the gifts never met: their noise is
   the bank's stereo noise (a mono take folded it to one channel: these render in two, Prerender.want's `channels`), and a
   pulse on the band's grid falls anywhere in a render quantum, where play() refuses any phase but the take's own
   (in a ride the first build of this played no take at all), so they play through Prerender.playNear: started on
   the frame nearest, their parts land within half a frame (10 us). Each pulse keeps four takes with their noise at
   four places, as live hits never match. The proof, `engine.debugRender('pulseTakes')`
   (`scripts/playtest/lowperf/pulse.js`, `j/pulse.json`): each pulse at two loudnesses, the take rendered at one phase
   and played at four against the beat built live, the noise held at the same place:

   | pulse | at the take's phase: residual, largest sample difference | at other phases: residual, largest difference | worst block level |
   |---|---|---|---|
   | heartbeat, duel 0.2 and 1 | -147 / -149 dB, -143 / -142 dB | -40.8 to -48.5 dB, -34.7 to -40.1 dB | 0.10 dB |
   | fuse tick, fuse 0.1 and 0.9 | -64.7 / -73.6 dB, -53.9 / -62.8 dB | -13.6 to -26.6 dB, -15.1 to -18.7 dB | 0.09 dB |

   (Differences against the live beat's RMS and peak.) The fuse tick's residual off its phase is its click: high-passed
   noise moved by under half a sample decorrelates (the click alone: -1 to -2 dB at a fractional phase, -194 to -272
   dB at a whole one), and two live clicks with their noise at two places differ more than that (+3.4 dB): no two live
   ticks ever matched. Its ping alone off phase is -24 to -30 dB (its sine moved by under half a sample) and at a whole phase
   -115 dB or better; at the take's own phase the tick is -65 to -74 dB, the click's level a step's own (within 1.3%).
   Node rate in a ride (Ember, prof.js, two runs each, `i/prof-*`): the heartbeat's connects 5.7 and 3.9 a second to
   1.4 and 1.7; all nodes made, gains 21 to 24 a second either side (the ride's duels and fuses vary run to run more
   than this moves).
3. **Low's rock with the lighter jitter**: tried and withdrawn (8b5ca62 keeps only a comment). Twenty facets with the
   finer cut's jitter still read as shards at Ember's 1260 m (`stills2/lp2-low/m2-z1260.png` against
   `stills2/lp1-low/m2-z1260.png`), not round 8's rounded rock.
4. **The HUD**: nothing to fix. Every element named writes only when what it shows changes: the race pill's number,
   its "of N" and its delta through `Txt` (text written only when it differs), its ring and crown as animations played
   on a rank change, the draft pill's chevrons and state through `Flag` (a class toggled only when it flips), the combo
   bar's fill on the page's beat and only past 0.004 of change. In a ride on Ember (`k/lt-*.json`), per frame against round 7's: the combo bar's inline style 0.25 (0.28), text
   replaced 0.3 (0.22), the chevrons' style 0.08; nothing in the HUD is restyled every frame. What remains above round
   7's (0.9 paints a frame against 0.58, 4.1 elements styled against 2.0) is the HUD saying more (more passes, banks
   and calls), not one element writing when nothing changed.
5. **(b), every ghost body in one draw a pass**: not done, because its bound is under the noise. A workcal build that
   draws no far ghost at all on Low (`scripts/playtest/lowperf/wcx.js`, `#hidefar`: the most merging their glass into
   one draw could save) read no cheaper than pass 2 in the same sitting (Pinecrest 2.87 against 2.82, Ember 2.89
   against 2.73, raw, `j/wcx.json`); after (1) a far ghost costs Low one draw, and the rest of its cost (its pose,
   wisp and tag) stays whatever draws it.

**Work a Low frame at 6x, this pass** (workcal, two rounds a mountain, interleaved; at 45 fps as before):

| sitting | round 7 | pass 1 | pass 2 |
|---|---|---|---|
| 13:30 to 13:42 (`i/wc.json`; pass 2 with the rock trial in) | 2.18 / 2.27 / 2.18 (mean 2.21) | 2.31 / 2.36 / 2.38 (2.35) | 2.26 / 2.39 / 2.44 (2.36) |
| 14:57 to 15:07 (`j/wcx.json`, raw, Pinecrest / Ember) | 2.34 / 2.45 | | 2.82 / 2.73 |

(Mountains Pinecrest / Ember / Sakura.) The machine ran slow in both (26 to 42 fps) and the slope that reads a run
at 45 fps came out 1.23 in one sitting and 0.25 in the other, so neither says more than this: **the bar is not met**,
Low at 6x stays about 6 to 15% over round 7's work, and nothing this pass did shows above the sittings' noise.
**The rest unharmed** (held run, Pinecrest, z 230 to 830, `k/gv-*`, GL calls a frame, pass 1 to pass 2): High 1,049.0
to 1,010.7 (nothing of this pass touches High's draws; the held run's field is not exactly the same run to run),
Medium 833.2 to 833.1, a phone's frame 785.8 to 790.0. No tier draws more; the takes save audio nodes on every tier.

## For DECISIONS (to paste)

**Low at 6x after the play and screens merges: the cost is the field on screen; two passes give part of it back and
the bar is not met** (`notes/r8-lowperf.md`, the lowperf lane; raw output in `shots/r8/lowperf/`). The bisect's fast
point, 9685d8b, was a build whose pools were still SIM_VERSION 9's (a95ad26 regenerated them after it): its Low frame
drew no ghost at all and its rider, with nothing to draft, rode a quarter slower, so its work and its GL calls are a
frame without the field; round 7 is the bar (the GL half now counted on a held run, glv.js: a pool rider replayed on
exact steps, so two builds draw nearly the same frames). What a Low frame draws more than round 7's is the field:
2.85 ghosts a frame on Ember against round 7's 0.7, each two draws, plus one draw each for the composed places'
framing, the poster and a gate in reach; profiled at matched machine speed the frame callback is 9% over round 7's
and spread thin; audio makes 2.2 times the nodes a second (the same engine, the duel heartbeat and the fuse ticks
played more); the HUD paints more because it says more, with no element written when nothing changed. *First pass*
(every tier, nothing on screen changes): a ghost off screen is not posed or given its wisp, shadow, halo and glass
sled, and with none on screen those four draws and six uploads rest; a rock's mass is copied, not built; gates out of
reach skip their slope. *Second pass:* on Low a ghost under a twelfth of the frame's height is drawn as its glass
alone, without its depth pass (nearly nine in ten of Low's ghosts; at that size no limb or wisp reads through its
chest); the duel heartbeat and the fuse tick play from rendered takes on every tier (in two channels for the bank's
stereo noise, started on the frame nearest wherever the grid puts them: at the take's own phase sample-exact, off it
within half a frame, block levels within 0.1 dB of the live beat). Held-run GL calls a Low frame, round 7 / before /
after: Pinecrest 463.2 / 491.6 / 450.2, Ember 476.6 / 537.6 / 504.4, Sakura 478.4 / 511.9 / 461.2; High, Medium and a
phone's frame draw no more. Work a Low frame at a common 45 fps, interleaved on shared sittings: round 7 2.14 to 2.21,
this branch 2.36 to 2.40. *Not met:* Low at 6x is still about 6 to 15% over round 7's work, and Ember draws two more
ghosts than round 7 did. Rejected: round 7's coarser rock on Low, twice (shards at the lens); every ghost body in one
draw on Low (a build drawing no far ghost at all was no cheaper within the noise, so merging their glass could not
reach the bar); fewer ghosts in glass on Low (the field in glass is the round's design).

## For the README

For the performance section, beside the perf lane's Low numbers:

> Ghosts off screen cost a frame nothing: only a ghost the lens can see is posed and given its wisp, shadow, halo and
> glass sled, and with none in view those draws rest. On Low a far ghost, under a twelfth of the frame's height, is
> drawn as its glass alone, one draw where a near one takes two. The duel heartbeat and the fuse tick play from
> rendered takes, as the gift pickups do. A Low frame asks WebGL for 450 calls on Pinecrest and 461 on Sakura (round
> 7: 463 and 478); on Ember, where round 8's field races beside you, 504 (477).

And under the tools: `scripts/playtest/lowperf/glv.js` (GL calls over a held run, nearly the same frames on any build
with the same pools), `scripts/playtest/lowperf/drawlist.js` (GL calls by the draw they belong to),
`scripts/playtest/lowperf/prof.js` with `scripts/playtest/lowperf/tree.cjs` (a profile kept as a tree, with a ruler
and the stacks that make audio nodes), `scripts/playtest/lowperf/pulse.js` (the pulses' takes against the live beat).

## Touched

- `src/render/ghosts.ts` (the ghosts lane's and the play lane's): the update's order (visibility before the pose),
  `restGhost`, `wispPath` and `reactMotes` split out of `poseGhost` and `updateWisp`, a `snap` through `poseGhost`
  and `moveGhost`, `hideFx` once per ghost, the shared fx meshes' `visible` and their uploads. Item gains `posed`
  and `fxOn`. Second pass: `LOW_DEPTH_FROM` and `it.depth.visible` (Low's far ghosts).
- `src/audio/sfx.ts` (the music and sound lane's): `heartbeat` and `fuseTick` through takes; `heartParts`,
  `fuseParts`, `tickClick`, `heartKey`, `fuseKey`, `fuseClickK`, `PULSE_TAKES`, `HEART_TAIL`, `FUSE_S` exported
  (the private `click` calls `tickClick`). `src/audio/prerender.ts`: `want(..., channels)` (two-channel takes; the
  memory cap counts both), `playNear`. `src/audio/probe.ts`: `'pulseTakes'`.
- `src/render/town.ts` (the forest lane's rock): `rockCut()`, the two cuts made once and copied (the Low cuts tried
  in 2966514 and in the second pass are undone; a comment says why).
- `src/render/charmgates.ts` (the play lane's): the reach test before the slope.
- New tools in `scripts/playtest/lowperf/`: prof.js, tree.cjs, drawlist.js, lifetrace.js, paintwho.js, scenestat.js,
  gates.js, glz.js, glv.js, pixdiff.mjs, pulse.js, wcx.js, batch.sh (one slot, one browser, a jobs file of
  `script|config|output` lines), profdiff.cjs (the main lane's, renamed for this package's ES modules).

## What the main lane must decide

1. **Whether the bar holds as written.** Two passes leave Low at 6x about 6 to 15% over round 7's work (the shared
   sittings cannot narrow it), and what remains is Ember's field on screen and a frame callback 9% heavier in a dozen
   small places. The next Low saving would change what Low shows: fewer ghosts in glass (your call: not), or a
   cheaper ghost body (a merged draw's bound is under the noise). The alternatives are to accept round 8's field as
   Low's cost and restate V9 for Low against round 7 plus the field, or to keep the bar open into the next round.
2. **The confirming sitting.** Only a quiet one can say where Low stands: `workcal.js` with five rounds,
   `window.__wcCfg = { builds: ['<round 7>', '<round-8 head>'], ms: [0, 2, 3], rounds: 5 }`, and perf-vl.sh's Low loop.
3. **The audio lane**, if it wants takes elsewhere: Prerender.playNear and two-channel takes now exist for any fixed
   sound on the band's grid (the draft's breath note, the stomp tick).

## Still short

- **The bar.** Work a Low frame at 6x is over round 7's at a common frame rate in every sitting (2.36 to 2.40 against
  2.14 to 2.21); GL calls are under round 7's on Pinecrest and Sakura and 28 over on Ember. Not proven in fps: no quiet
  sitting.
- The frame callback's own excess (about 9% at matched speed) is spread over a dozen systems of 0.1 to 0.3 ms at 6x
  each (the sim's ticks, the chase, the far field's update, Spirit Flow, the journey's palette); none is one fix.
- The HUD paints and lays out more than round 7's in a ride because it says more; Low draws the running figures in
  the canvas, and the race pill could follow (a HUD lane's call).
- The fuse tick's takes are keyed by pitch step, music key and four noise places, so a ride's first ticks of each are
  still built live until their takes are ready.
- **Stills.** First pass: `stills/{base,lp}-{low,high}/` and `stills/{base,lp}-low-tunnel/`. Second pass:
  `stills2/lp1-low/`, `stills2/lp2-low/`, `stills2/lp2-high/` (the rock trial in), and `stills2/lp2f-{low,high}/`
  (the branch as committed: Ember 900, 1260, 1500 and 1552 m, Pinecrest 130). A gate coming up (1500) and ridden
  (1552), the rider's flip at Pinecrest's 130, a charm held past the first gate, near and far ghosts with wisps and
  tags, the tunnel's rock as round 8's. The console is clean on every still (`errors: []`). The held run holds the
  player's run but not the field exactly (two runs of one build differ in which ghosts are where), so a pair is
  judged by eye, not by pixel; no showdown fell inside these frames (the play lane's r8-play.js shoots one).
