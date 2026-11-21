# Round 8, the modes lane: somewhere to go after The Twelve (G9)

Branch `r8-modes`, cut from `round-8` at 3675f72. The brief: `notes/r8-briefs/modes.md`. Render, UI, input and audio
only: the sim, the bots and the pools are untouched (the Long Night rides `SimConfig.carry`, which the sim lane put in
the record; a mirror needs nothing of the sim). Frames and raw output under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/modes/`.

## What a player gets, and why they would feel it

### Mirror mountains

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **The picture is flipped by the page, not by the renderer.** The canvas is shown with a CSS `scaleX(-1)` (`world.ts setMirrored`): no pass, no draw, the same frame on every tier, so Low and the phone mirror for nothing and nothing in the look changes but its side. Flipping the projection instead would have turned every triangle's winding and every screen-space derivative (the massif's, the midground's and the life's flat normals, `dFdx`/`dFdy`) inside out. | Five more courses that look exactly as good as the five they mirror. | Low, Pinecrest, a frame's GL calls: base 483.9, mirrored 487.7 (see Cost). |
| **The steering is read the other way where the sim takes it** (`input.ts`'s `mirrored`, `modes.ts mirrorSteer`). Left on the keys, the stick, the mouse or the screen is still left on the screen; the record holds the steer the sim took, so a mirrored run is an ordinary record and replays as one. | Nothing to relearn: the hands do what the eyes ask. | `tests/modes.test.ts`; the browser's mirrored legs replayed in node to the same hash. |
| **Every ghost is mirrored with you**: they replay their own records and are drawn in the flipped picture. Their name tags, the edge chip and the HUD's figures on Low are laid out on the screen as the player sees it and drawn turned back over (`labels.ts uFlip`; the lens's projection turned over only while the ghosts lay out their labels, `world.ts mirrorView`; the edge chip's view-space side, `ghosts.ts mirrored`). The HUD's callouts that follow the rider read its place on screen as shown; the avalanche's rear-view inset is drawn at its box's mirror image. | A tag sits over its ghost and reads; the chip points at the rival off the side it really is. | Frames on every mountain, three tiers. |
| **Words built into the world are built in mirror writing** (`lettering.ts`): the FINISH and START boards' letters in the other order, each turned over in its own box, so flipped with the picture they read. The pieces that carry them are remade when the mirror changes, as a new mood remakes them. **The medallions' glyphs** are drawn turned over in their cells (`charmglyphs.ts`, `charmgates.ts setMirrored`). **The gate's offers are named left to right as the player sees the arches** (`director.ts mirrored`). The gantry's arrows and the shop boards' bars are not words: they follow the flip, so an arrow still points at its channel. | Nothing reads backwards. | A fresh critic over 45 mirrored frames: nothing reads backwards. |
| **Heard mirrored too**: left and right change places after the master ceiling, the last node (`graph.ts mirror`), so a ghost passing on the screen's left is heard on the left. | With headphones the flip is whole. | |
| **Its records are its own** (`mirror:<id>`: best, grudge, ladder, mastery board, run times), its riders the mountain's pool. No duel of The Twelve rides a mirror (their ground is their ground as it stands). Finishing one sticks the album's mirror sticker (`rank.ts`'s `run.mirror`). | A mirrored mountain is a new ladder to climb, not a way round the old one. | |
| **Where it is found**: its Almanac page (9, 15, 20, 25, 30) carries a **Ride** (the mirror ridden at once), and once a mountain's mirror is open its title card's Ride has a **Mirrored** toggle under it; Ride's line then says "Pinecrest, mirrored". The title's scene stays the mountain's key art: mirrored, its hero and its landmark would stand behind the logo's column. | Found where it opened, picked where the mountain is picked. | UI frames. |

### The Long Night

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **A night is whole mountains back to back** (`modes.ts LEGS`: Pinecrest, Frostfang, Ember Peak, Sakura Ridge, Lanternfall, then the five mirrored), as many as the Almanac has opened (3 at page 10, 6 at 22, all ten at 33). Each leg is an ordinary run with its own record, under its own key (`night:<id>`, `night:mirror:<id>`), so your best leg on a mountain rides as your ghost the next night and the reel replays any leg. A leg stands on no ladder and fills no mastery board: its lantern and its chaos came from the leg before. | A gauntlet, not a stitched course: each leg opens on its own mountain's place. | |
| **What you hold at the line rides into the next leg** (`SimConfig.carry` through `nightOn`/`carryFrom`): the lantern, the get-ups, and the **last three charms you took**. The spine carried the first three; then a night's charms were set on its first leg and every later gate was a pick for one leg only. Now each leg's gates add to what you hold and the oldest gives way, so the start's gate on each leg is the pick between legs: steered, never a menu. | The choice between legs is made on the snow, and it lasts. | Node: 4 nights a pilot, every carry equal to the line it came from, every leg's record replayed alone to the same hash. |
| **Chaos rises every leg of the first night**: plain, then a mood, then a mood and an event from the third leg on (`legStep`; the spine had the event from the fourth, which a three-leg night never met). The night's seed draws every leg's roll, and the leg's reveal card names it. | The night gets harder as it goes, from the first night a player rides. | `tests/modes.test.ts`. |
| **Between legs, a breath over the live scene** (`ui/nightbeat.ts`): the sled coasts into the finish town, and one ink panel says the leg to come and where ("Leg 2 of 3 · Frostfang"), how the night deepens ahead ("Comet Night · Yeti Crossing") and what rides in with you (Lantern in marigold, Get-ups as the HUD's pips, the charms by name), and a thin bar drains to the next leg with "Tap or Space to go now". 2.4 s; a tap, Space or Enter goes at once; reduced motion keeps the beat and the bar, still. Each leg is settled as any run (gifts, missions, the spine's XP) with no results screen. | Momentum: one breath between mountains, never a menu. | Line to the next leg's first tick: 3.0 s of coast (FINISH_RESULTS_MS) + 2.4 s. |
| **The night ends on a fall with no get-up left, or its last open leg crossed**, and its depth (legs finished, metres into the next) is settled against the best (`settleLongNight`, `d.longNight`). That leg's results end on **Ride the Long Night** with the depth under it ("2 legs and 640 m: your deepest night", or "... Your deepest: 3 legs"); the album's night stickers are filled from it. | A best depth to beat, said where the next run is chosen. | |

## How it was checked

**A Long Night in node, through the game layer** (`scripts/playtest/r8night.ts`, `r8-night.ts`; `tests/modes.test.ts`
rides one). Each leg is a `Run` (src/game/run.ts) on its mountain with its leg's chaos and the carry the last leg held
at its line (`nightLeg`, `nightOn`, as the app's `startRun` and `nightBetween` take them); its record is replayed alone
from its string; the depth is settled with `settleLongNight`.

| Pilot, legs | Nights | Depths | Carries | Replays | Chaos steps |
| --- | --- | --- | --- | --- | --- |
| mid, 3 | 4 | 3, 3, 3, 3 legs | every one the line it came from | every leg the same hash | 0, 1, 2 |
| novice, 10 | 4 | 10 legs; 7 legs and 933 m; 10 legs; 6 legs and 1,381 m | exact | exact | 0, 1, then 2 |

**A Long Night in the browser by a scripted pilot** (`modes-night.js`: a fresh save, `?night&legs=3`, desk High, a
virtual clock; the pilot holds the safe line by the picture, so on a mirrored leg its left is the sim's right;
`modes-night-check.ts` replays the records in node): three legs (Pinecrest plain, Frostfang in a mood, Ember in a mood
and an event), each finished; **every leg's record replayed to the browser's hash on the same tick; each leg's carry in
equal to what the leg before held at its line** (lantern 54 and 69 points, get-ups 3, charms [23] and then
[23, 16, 9]); the save's `longNight` `{ legs: 3, z: 0 }`, the legs' bests under `night:pinecrest`, `night:frostfang`,
`night:ember`, the album's night stickers 1 to 3; the last results' one button "Ride the Long Night" over "3 legs: your
deepest night"; the console clean. A second, two-leg browser night on the final build: see Frames.

**Mirrored runs on every mountain, High, Low and the phone** (`modes-mirror.js`: a pool rider replayed from a fresh
save with `&mirror`, the HUD's DOM shown, frames at the start's charm gate, the second gate close, and the FINISH board
coming up): 45 frames, 15 loads, the console clean on every one. **A fresh critic** (opus, high effort), told only "find
anything that reads backwards or looks wrong", looked at all 45: "Nothing in the 3D scene reads backwards. Every FINISH
banner, ghost name tag, rival name and HUD string reads the right way round." What else it named is not the mirror's
and is the same on a plain run (left for the lanes that own it): HUD callouts drawn over each other at the top centre
(a pot over its total, two landing stamps at once, a split card over a fading one); Sakura's and Lanternfall's lanterns
hanging in front of FINISH (Lanternfall's a dark unlit one); a straight edge across the phone's snow on Frostfang at
1,535 m. One it named might have been the mirror's: Low's clock and distance touching ("3:13.94,442 m"); checked plain
against mirrored on the final build (Frames).

**The places it is found, and the beat** (UI frames, a second fresh critic given ART.md and asked what each frame tells
the player, and what is broken): the Almanac's Ride on the pages that open each mode read as part of the books; the
beat between legs read as part of the game but did not say what "54 %" and three dots were, nor that it goes on by
itself, and it covered the sled's runner. Fixed: "Lantern" and "Get-ups" name the figures, a bar drains to the next leg
over "Tap or Space to go now", the panel is 400 px wide. It also named the title's mirrored scene earlier in the work
(the key art's hero behind the logo's column): the title is never shown mirrored now. Named and not this lane's: the
results' "+0 XP" over its own ticks (a virtual clock's frame), the title's hero behind its cards.

**Suites:** `npx tsc --noEmit -p .` clean; the full `npx vitest run --maxWorkers=3` green, 95 files, 1,803 tests (the
guard that every way into a run goes through `ride()` or `runAgain()` caught the first build of the beat, which started
the next leg itself; it now goes through Run Again).

## Cost

- **A plain run:** no new draw, pass, texture or uniform array. Two calls a frame that return at once (`mirrorView`), one
  float uniform in the labels' material (never re-sent unchanged). Low, Pinecrest, GL calls a frame (`glcount.js`, 10 s
  of a steered ride): the round-8 base 483.9; this branch LOWNUMBERS.
- **A mirrored run:** the same frame as a plain one, shown turned over by the compositor: 487.7 GL calls a frame on Low
  (base 483.9; the difference is the ride's path, as the plain runs show). The pieces with boards are remade once as a
  mirrored run starts (as a new mood remakes them), on the run's start, not in a ride.
- **The first frame:** nothing new runs before `gs-first-frame` (the title never mirrors; the toggle's model is a page
  look-up).
- **The bundle:** JS 3,343,729 to 3,355,042 bytes (+11.3 KB), CSS 189,492 to 192,313 (+2.8 KB).
- **Audio:** a mirrored run adds one splitter and one merger after the ceiling; none otherwise.

## Low and the phone

The same mirror, at the same cost: the flip is the page's, so Low's poster, its HUD figures in the canvas and the
phone's tall frame are turned over exactly as High's (Low's figures and the phone's labels checked in the frames). The
beat between legs is DOM over the scene on every tier; on a phone held upright it spans the width a quarter of the way
up, clear of the rider.

## Touched outside my files

- `src/game/app.ts` (in my own functions, the block "the modes lane: mirrors and the Long Night", and a few lines in
  `startRun`, `showResults`, `crossedLine`, `runAgain`, `enterTitle`, `duelHere`, `mountainKey`, the title's model and
  the UI's handlers): the mirror's key, steer and picture; a night's legs, its beat and its end.
- `src/render/world.ts`: `setMirrored`, `mirrorView` and two lines (the rider's place on screen for the DOM, the
  rear-view inset's box). Not the speed lane's functions.
- `src/render/ghosts.ts`: `mirrored` and one line in `placeRival` (the edge chip's side).
- `src/render/charmgates.ts`: `setMirrored` (draws the glyph atlas again).
- `src/game/director.ts`: `mirrored`, and the gate's offers named in the order the player sees them.
- `src/audio/graph.ts` (`mirror`), `src/audio/engine.ts` (`setMirror`): left for right after the ceiling. The music is
  not touched; on a mirrored run its stereo image turns over with everything else.
- `src/ui/title.ts` (the Mirrored toggle under Ride, Ride's line), `src/ui/almanac.ts` (an opened page's Ride),
  `src/ui/menus.ts` (passes the Ride through), `src/ui/contract.ts` (`TitleModel.mirror`, `AlmanacModel.modes`,
  `RewardCard.mountain`, `onMirror`, `onRideMode`), `src/game/spineview.ts` (a mirror's card carries its mountain's id).
- `src/game/modes.ts` (the spine's): `legStep` puts the event on the third leg; `carryFrom` carries the last three
  charms; the night's own functions (`startNight`, `nightLeg`, `nightOn`, `nightDepth`, `nightBeat`, `depthWords`,
  `nightKey`).

## For the main lane

- Nothing to wire: the entries are in (the Almanac's pages, the title's toggle), and the night and the mirrors settle
  through the spine as any run. Dev switches: `?mirror` (any named mountain mirrored), `?night&autoride=1` (a night from
  a fresh save, three legs), `?legs=N`.
- **Decide:** the Long Night is long rather than hard for the pilots. The sim gives every get-up back at each stage line,
  so carried get-ups rarely bite, and the lab's novice rode all ten legs on two nights of four. A best depth will be
  "all ten" for many players; a later sim round could keep a night's get-ups across stage lines (a `SimConfig` flag), or
  the night could keep a second best (its whole time). Not done here: the sim is closed and the save's `LongNightSave`
  is the spine's.
- The light lane's hours and the Lantern Row are not wired here (the main lane does that on round-8).

## What is still short

- Only scripts have ridden it. A person should say whether a mirrored mountain feels new or only strange, whether the
  beat between legs is a breath or a wait (5.4 s from the line to the next leg: 3.0 s of the coast the game already had,
  then 2.4 s), and whether a three-leg night is worth starting.
- A night's middle legs pay as runs but show no results, so an Almanac page turned mid-night is not turned over on a
  card (it is in the book).
- Trials (the stretch) were not built.
- The night's depth on a crash beat skipped straight into Run Again is settled, but a night left from the pause menu is
  not (as a run quit from the pause menu is not).

## Text to fold into ART.md and the README

**ART.md (section 10, round 8):**
- **A mirror mountain is the picture turned over, never a second look.** The canvas is shown flipped; every word in the
  world is built in mirror writing to meet it (the boards' letters, the medallions' glyphs) and every label is laid out
  as the player sees the screen, so nothing reads backwards and nothing else changes. The title is never mirrored: its
  key art is composed for the logo's side. A mirror is found as a soft "Ride" on the Almanac page that opens it and a
  "Mirrored" toggle under the picked mountain's Ride.
- **The Long Night's beat between legs** is one ink panel low at the reading edge over the finish town: the leg and its
  mountain in the italic of speed words, the night deepening, then what rides in (the lantern in marigold, the get-up
  pips, the charms by name) and a bar draining to the next leg. It is never a menu: it goes on by itself.

**README:**
- **Mirror mountains:** each mountain's mirror opens on its Almanac page (or once its home riders have all fallen in
  duels): the same course turned left for right, picture, steering and sound, with its own bests and ladder. Turn it on
  with the Mirrored toggle under Ride.
- **The Long Night** (Almanac page 10): the mountains back to back, three legs at first and up to all five and their
  mirrors. What you hold at each finish line (the lantern, get-ups, your last three charms) rides into the next leg, and
  each leg is wilder than the last. Fall with no get-up left and the night is over; your deepest night is kept.

## Frames and output

All under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/modes/`:
- `mirror/{high,low,phone-medium}/m<0-4>-z{0095,1535,4440}.png`: the mirrored runs the critic read (JSON beside each).
- `night-desk-high/`: the browser night (beats, results, `night.json`); `night-last/`: the two-leg night on the final
  build.
- `ui/`: the title's toggle, the Almanac's Rides (an earlier build, whose title still turned its scene over);
  `critic-ui/`: the frames the UI critic read.
- `figs/{plain,mirror}/`: Low's canvas figures plain against mirrored.
- `cost/gl-*.json`: GL calls; `night-node*.json`: the node nights; `vitest-2.txt`: the full suite.
