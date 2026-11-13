# Round 7, the hero lane: notes for the main lane

Branch `r7-hero`. Files I own: `src/render/rider.ts`, `ghosts.ts`, `portrait.ts`, `camera.ts`, `speedfeel.ts`,
`nearfield.ts`, `cine.ts`, `src/game/timescale.ts`. Kept current as the work goes; the section "Not done, and fragile" says what is
not done.

## Decisions

1. **The hero and every ghost are drawn 1.2 times their modelled size** (`RIDER_SCALE` in meshes.ts; rider.ts and
   ghosts.ts scale their rigs). Reason a player feels: the rider is in every frame and was a tenth of its height at
   speed. The sim's sled is a 0.55 m disc whatever is drawn, so nothing about a run changes. Measured with
   `scripts/playtest/readability.js` on High at 1280x720 (the probe now reads the rider's own drawn height,
   `world.rider.height`, where it assumed 1.25 m):

   | Mountain | Speed | Rider px before | Rider px after | Road m before (median, worst) | Road m after |
   | --- | --- | --- | --- | --- | --- |
   | Pinecrest (inside the First Drop's wide shot) | 30 | 76 | 98 | 61, 17 | 59, 16 |
   | Pinecrest | 44 | 75 | 116 | 61, 39 | 63, 40 |
   | Frostfang | 30 | 113 | 152 | 71, 34 | 71, 34 |
   | Frostfang | 44 | 81 | 121 | 63, 0 | 64, 0 |
   | Ember | 30 | 120 | 154 | 70, 12 | 68, 12 |
   | Ember | 44 | 81 | 115 | 63, 9 | 64, 9 |
   | Sakura | 30 | 112 | 152 | 63, 0 | 63, 0 |
   | Sakura | 44 | 79 | 119 | 60, 0 | 57, 0 |

   The rider is 16% of the frame's height at 30 m/s before and 21% after; 11% and 16.5% at 44. The road read is
   level inside the probe's run-to-run spread (about 2 m) except Sakura at 44 (60 to 57): see "Speed" below for
   the lens lift that answers it. The review's "5%" was a hand estimate: the measured figure was 10 to 16%.
2. **The chase lens closes faster past 28 m/s** (`chaseBack`). The follow's lag grew by 1.5 m from 30 m/s to the
   cap while the lens opened by five degrees, so the hero shrank by 28% exactly as the run got fast.
3. **The hero is rebuilt inside the toy** (meshes.ts, the rider's section only): shoulders broader than the chest
   (the coat's lathe pushed out of round), a hood on the back with a cream fur horseshoe (the one big shape the
   chase lens sees), a belt, a zip with three toggles and two pocket flaps for the front lenses, knee and elbow
   patches, fur cuffs, boots with turned-up feet and treaded soles, a face (nose, mouth, two catchlights, a lock
   of fringe), a bigger pom-pom. **The mitts are vermillion**: at speed a navy arm on a navy coat said nothing, so a
   fist, a wave or a flail now reads by its mitt. This pushes ART.md 1 (vermillion is still only ever you).
4. **The sled has a shape of its own**: five grained slats, runners that scroll up and back to a foot bar (the
   old curl was an arch standing on the runner), tails that flick up, and a bow of bent wood behind the seat.
5. **Elbows.** Each arm is one mesh as before; the vertex shader bends the forearm about the elbow and flops the
   mitt about the wrist (`aSway.w`, per-arm `uJoint`). No extra draw.
6. **Secondary motion**: the hood, a hat's tail and the boots' toes ride a soft spring (2.4 Hz) kicked by every
   change of height, bank and speed; the hem swings out late on a carve; mitts lag the arm they hang from; a
   carve opens the shoulders, slides the hips 7.5 cm to the inside and turns the head into the turn; leaving the
   snow extends the body (most from a held crouch into a lip); a touchdown compresses by its impact and takes
   longer to recover from a harder one; the drift posture puts the inside mitt to the snow and the outside arm up
   and bent.
7. **Reactions** (`RiderCue`): `glance` (passing: a look across and a lean), `pump` (a pass worth a fist), `cheer`
   (both arms: a double, a duel won, a set piece swept), `look` (passed: over the shoulder, a lean in, a small
   shake), `flinch` (a near miss, harder for a whisker, away from the obstacle's side), `slump` (a set piece
   lost), `dust` (after a fall). All from director beats, mapped in `src/render/moments.ts`.
8. **A fall is played whole** when the sim's fall lasts 1.3 s or more (`RiderAct.tumbleS`, `tumbleCuts`): thrown
   off to one side and rolling while the sled skids on askew, on its back in the snow, a sit-up with a shake of
   the head and a look across at the sled, a hop back onto the seat, a settle. A shorter one is the old roll of
   the whole rig. The run-ending crash is unchanged (the physics wreck and the results shot).
9. **Three finishes**: a win stands, pumps both fists, spins and lands with both arms flung wide; a podium (2nd,
   3rd) stands, punches one fist up twice, then waves with a hand on its hip; any other finish keeps its seat,
   leans back and stretches both arms over its head, then waves and nods.

## Cost

| | Before | After (High, Medium) | After (Low) |
| --- | --- | --- | --- |
| Hero triangles (5 draws, plus the scarf's 76) | 6,210 | 9,652 | 3,778 |
| Hero draws | 5 + scarf | 5 + scarf | 5 + scarf |
| A ghost's body (before the weld) | 2,562 | 1,802 | 1,802 |

`npx tsx scripts/playtest/rider-tris.ts` prints them. The arms' two materials share one program.

## Touched outside my files

- `src/render/meshes.ts`: the rider's and ghosts' section only (from `// ---- rider` down), plus `RIDER_SCALE`,
  `RIDER_HEIGHT`, `RIDER_SHOULDER`, `ARM_*` exports. `aSway` is now four components on rider parts.
- `src/render/world.ts`: two lines, `this.rider.setDetail(...)` in the constructor and in `setQuality`.
- `src/render/moments.ts` (the render one): `act.tumbleS`, and the new cues on `pass`, `nearMiss` and `moment`.
- `scripts/playtest/readability.js`: reads the rider's drawn height. New: `scripts/playtest/hero.js` (a turntable
  round the pinned rider, with forced acting), `read.sh`, `rider-tris.ts`.

## For the main lane to wire

- (Superseded by decision 18: the cuts are now read off the sim's constants, nothing to wire.) **The feel lane's fall** (r7-feel 0facfea): its `TUMBLE_TICKS` is 90 (1.5 s) in three phases. After the merge set,
  in `src/render/moments.ts` beside `act.tumbleS`:
  `act.tumbleCuts = [FALL_TICKS / TUMBLE_TICKS, (FALL_TICKS + DOWN_TICKS) / TUMBLE_TICKS]`
  so the picture's phases land on the sim's (thrown and sliding, down, up). Without it the cuts are 0.4 and 0.7.

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\hero\`: `before/` (the baseline's probe shots), `turn/`
(turntables: `sheet-a.png` the build, `sheet-b.png` poses, `sheet-wipe.png` the fall and get-up).

## The camera (second half of the lane)

10. **Directed shots are data keyed to a place** (`src/game/shots.ts`, `planShots(course)`; pure, so a Daily, a
    Cup and a replay get the same shots). Three kinds, at most one of each a run:

    | Shot | Where | Pinecrest | Frostfang | Ember | Sakura |
    | --- | --- | --- | --- | --- | --- |
    | `wide` (and the slow hero frame) | the tallest leap on the descent | the Valley Leap, 3,980 m | the last leap, 3,980 m | the last leap, 3,980 m | the last leap, 3,746 m |
    | `track` | the first street | Old Town, 3,462 m | Station Street, 1,474 m | Ash Market, 3,655 m | the first street, 1,215 m |
    | `whip` | the reveal (`REVEALS`) | the First Drop's lip, 591 m | the cavern's far mouth, 3,443 m | the caldera's lip, 2,325 m | the Blossom Leap's lip, 2,464 m |

    Lanternfall has its row in `REVEALS` (`lanternfall`: its second leap, the break out under the deck, the lip
    `Course.cloud` ends on in r7-moments); it plays as soon as the mountain is in `MOUNTAINS` under that id. A
    Daily or a Cup whips onto its first leap.
    The brief said "each mountain's biggest leap"; I took that literally (the tallest cliff), which on all four
    is the last leap before the line, where ART.md 15 asks for a held wide (Pinecrest's "held wide over the
    valley", Frostfang's "the Fang at dawn from the last leap"). The reveals are the jaw-drops ART.md 15 names.
11. **The held wide** rides the big-air vista's own weight (in as the flight opens, home 0.35 s before
    touchdown, the landing spot kept in frame): 3.0 m further back, 1.5 m higher, 2.0 m further aside and 4
    degrees wider than the vista, under a letterbox of 0.8. Reason a player feels: the biggest jump on the
    mountain is the one frame where the rider is small and the valley is the subject.
12. **The slow hero frame** is the director's (`director.ts heroFrameStep`), so music can land on it. Leaving
    the biggest lip it marches the flight over the real ground (`flightSeconds`); a flight of 1.9 s or more gets
    the frame at two fifths of the way, never inside its last 0.5 s. Three beats, type `heroFrame`:
    - `lip` on take-off: `inS` is the seconds of sim time until the frame starts, `secs` how long it lasts (0.8);
    - `apex` as it starts: `time.curve(APEX_CURVE, 'render')` (render time to 0.32 by 0.1 s, held to 0.5 s,
      back to 1 by 0.8 s). **Render channel only**: the feed stays 1, the sim never slows, the stomp is timed
      at full speed. Measured in the capture's probe: `feed` 1 on every frame, `render` down to 0.32;
    - `out` as it ends (or alone after `lip` if a crash or a fall cancelled it).
    The camera answers `apex` by pushing in from the wide to 0.6 m behind its set point, 1.5 m up, 2.4 m round
    to the vista's side on a 56 degree lens, with `cine.dof` 1 focused on the rider and a full letterbox; the
    follow runs on real time through it (on the slowed render clock the lens fell metres behind the sled).
    The frame is the air only: touching down ends it at once. A phone pushes in 60% of the way on a 78
    degree lens (its chase stands at 96): the first cut left the phone's lens at 96 and the frame barely
    differed from the wide (probe: fov 96 then, 78.5 now).
    **What "slow" is, honestly:** because the sim is never slowed, the sled keeps flying at full speed. What
    slows is everything that integrates on render time (the scarf, powder, petals, embers, the rider's acting),
    and `cine.slow` carries the scale for the pipeline. It reads as a breath, not as bullet time. A true slow
    of the flight would need the feed channel (as the ward's beat does), which is the main lane's call.
13. **The tracking shot** eases in 24 m into the street and holds for 120 m: 0.75 m lower (never under the
    chase's 0.8 m floor over the sled), 1.5 m toward the street's middle, 1.1 m further back on a lens 8
    degrees longer, letterbox 0.45, `cine.dof` 0.3. The first cut of it sat closer (focus 3.6 m) and the rider
    filled a third of the frame; pulled back it stacks the street up behind the rider.
    **Sightline (ART.md 8), measured with `readability.js` and its new `force` switch (the shot held on, or
    none), High, 1280x720, road metres median and worst:**

    | Street | Speed | Plain chase | Tracking shot |
    | --- | --- | --- | --- |
    | Pinecrest, Old Town | 30 | 24, 24 | 72, 37 |
    | Pinecrest, Old Town | 44 | 54, 16 | 54, 13 |
    | Ember, Ash Market | 30 | 24, 24 | 84, 53 |
    | Ember, Ash Market | 44 | 68, 54 | 68, 48 |

    At 30 m/s the plain chase on a flat street hides the road behind the rider's own back (the probe's
    `rider` reason, 6 of 9 reads); the step aside clears it. At 44 it is level. The plain chase's 24 m on a
    street at 30 is under the 45 m target and is not this shot's doing: see "not done".
14. **The whip-pan**: over the last second before the place the look drifts 0.2 rad off the road, then whips
    back across in 0.22 s, 0.07 rad past dead ahead toward the course's middle, and settles in 0.6 s, with a
    small FOV kick and `cine.motionBlur` at 1 through the snap. Once a run. The look never turns more than
    0.32 rad for a shot and an overlook together; the lens sees over 50 degrees to each side, so the road stays
    on screen (a test holds it under half the half-width). A phone takes half.
15. **The cine state is written every frame** (`cine.ts`, the round's contract, untouched): `motionBlur` from
    `speedfeel.ts blurK` (0 to 18 m/s, 0.34 at 28, 1 only at the cap; held back to 30% in the hero frame, 1 on
    the whip, 0 off the chase), `dof` and `focus` (the lens to the rider; 1 in the hero frame, 0.3 tracking, 0.6
    on the results hero shot, 0.45 on the finish swing), `letterbox`, and `slow`. Every field is eased in the
    camera. `ChaseCamera.cineNow` and `wideNow`, `heroNow`, `trackNow`, `whipNow` are the probes.
16. **Reduced motion** keeps every beat and drops the motion: the lens is exactly where it would be with no
    shots (tests compare frame for frame), nothing slows, the whip does not play; the `heroFrame` beats still go
    out on the same ticks, the letterbox and depth of field still mark the wide, the hero frame and the street,
    and speed's blur is halved, as the streaks are.
17. **Speed: the curves stay, on evidence.** The brief asked for FOV, shake and streaks retuned so 28 m/s is
    fast and 46 the edge. `speedfeel.ts` already holds exactly that shape (fastK 0.6 at 28 and 1 only at the
    cap, FOV 62 to 72 to 79, streaks and rumble from 22 to 24 m/s to the cap, the edge shiver from 36), pinned
    by `tests/feel.test.ts`. I shot the chase at 15, 28 and 46 m/s on the same two metres of Pinecrest
    (`shots/r7/hero/speed/sheet-before.png`): 15 is calm and close, 28 has the rider at a third of that size
    with streaks in the corners, 46 smears the whole near field. The read is there; a retune would have been
    change for its own sake. What I added is the motion blur's curve (15) and the lens closing past 28 (2).
    Whether 46 feels like "the edge" in the hand needs a human.
18. **The fall's phases come off the sim** (`render/moments.ts fallCuts`): the picture's cuts are read from the
    sim's `FALL_TICKS` and `DOWN_TICKS` when it exports them, so after the merge the rider is thrown, down and
    up on the feel lane's own ticks (42, 18, 30 of 90: cuts at 0.467 and 0.667) with nothing to wire. On this
    branch the sim has one 66-tick tumble (1.1 s, under the 1.3 s the whole fall needs), so the whole fall has
    only been seen forced, in the turntable.

### Cost of the camera work

No geometry, no draws, no materials: the shots move one lens. Triangles and draw calls a tier are unchanged
(the table above stands). Frame JS: `stepShots` and `writeCine` are a loop over three shots and a dozen
exponentials a frame; not timed apart from the frame (under the noise on this shared machine).

## ART.md text to fold in (section 8)

- Each mountain has three directed shots, keyed to a place (`src/game/shots.ts`), and none of them takes the
  steering. Over its tallest leap the lens holds wider than the big-air vista under a letterbox, and at two
  fifths of the flight pushes in for a slow hero frame: a longer lens, the rider sharp and the valley soft,
  render time at a third for half a second while the sim flies on at full speed. Down its first street the lens
  drops low and steps toward the middle of the street on a longer lens. Coming up on its reveal (Pinecrest's
  First Drop, Frostfang's cavern mouth at dawn, Ember's caldera, Sakura's Blossom Leap, Lanternfall's break out
  of the cloud) the look drifts a little off the road and whips back onto it as the place opens.
- The camera writes what the lens is doing for the pipeline (`src/render/cine.ts`): depth of field and its
  focus, motion blur from the speed curve, the letterbox and the slow frame's scale.
- Reduced motion keeps the letterbox, the depth of field and the director's beats and drops the swing, the push
  and the slow.

README (dev switches): `scripts/playtest/beats.js` shoots every directed shot with a probe a frame;
`readability.js` takes `force: 'track' | 'none'`.

## Touched outside my files (second half)

- `src/game/shots.ts` (new, pure): the shots' plan. `src/game/timescale.ts` is mine: `APEX_CURVE`, `APEX_S`.
- `src/game/beats.ts`: one line, the `heroFrame` beat in the union (not added to `NAMED`: it is not a
  telemetry moment).
- `src/game/director.ts`: `heroFrameStep`, `flightSeconds`, five `HERO_*` constants, five fields and their
  reset, one call beside `marqueeStep`. It reads the sim and writes nothing to it.
- `src/render/world.ts`: `this.cam.shots = planShots(...)` in the constructor and in `setCourse`, and the import.
- `src/render/moments.ts`: `fallCuts` and `act.tumbleCuts`.
- `scripts/playtest/readability.js`: the `force` switch. New: `scripts/playtest/beats.js`.

## For the main lane to wire (second half)

- **The pipeline reads `cine`.** On this branch nothing draws the letterbox, the depth of field or the motion
  blur (they are the pipe lane's passes), so my frames show the lens work only. After the merge, look at the
  hero frame on Ultra with `dof` 1 and at a street with `dof` 0.3 and the letterbox at 0.45: both numbers were
  chosen blind. If the letterbox over a steering shot (the street, 0.45) bothers a player, set `TRACK_BOX` to 0
  in `camera.ts`; the wide's and the hero frame's are in the air.
- **Music lands on the hero frame**: `audio.beats` gets `heroFrame` `lip` with `inS` (0.45 to about 1.1 s of
  lead) and `apex`. Nothing in `src/audio` reads it yet.
- **`cine.slow`** is for effects that should hang in the slow frame; the world's render dt is already scaled by
  the director's render channel, so most of it is free.
- The feel lane's fall needs no wiring any more (18 replaces the earlier note above).
- If the moments lane's Lanternfall changes which leap is the break, change one row of `REVEALS`.

## Not done, and fragile

- **The slow frame slows the picture, not the flight** (12). If the owner wants the flight itself slowed, play
  `APEX_CURVE` on `'both'` in `heroFrameStep`: one word, and the sim stays tick-exact as it does for the ward.
- **A flight at a pinned 30 m/s is about 2.3 s**, so the wide has about half a second fully open before the
  push-in. A fast run flies longer and holds it longer; I have not seen one at 44.
- **Streets at 30 m/s: the plain chase reads 24 m of road** on Old Town and Ash Market (the rider's back
  covers the street's vanishing point on flat ground). The tracking shot fixes its own 120 m; the rest of each
  street is as round 6 left it, now with a rider a fifth bigger. Worth a look by whoever owns the hazard read.
- Pop-in, shimmer and z-fighting in my files: I read the turntables and every beat frame and found none on
  the rider, the sled or the ghosts. I did not run a dedicated hunt with motion (no video on this machine).
  One thing seen that is not mine: dotted vertical lines top left in Old Town (`beats/m0-high-track-02.png`),
  which look like a bunting string's dashes.
- The three finishes differ and were shot forced on the turntable (`shots/r7/hero/finish/sheet.png`, a row a
  rank at 1.0, 1.8 and 3.4 s): a win stands with both fists up and ends arms flung wide; a podium stands, one
  fist up, then a hand on its hip and a wave; any other place keeps its seat, both arms over its head, then
  waves. Not seen in a real finish with the swing round it this half (the turntable crops a standing rider's head).
- The capture's frames are about 0.5 s apart (a screenshot costs that here), so the whip's 0.22 s snap is caught
  by luck: tests hold its shape.
- `playwright-cli close-all` was not run (the lanes' rule forbids it while others capture); only `r7-hero` was closed.

## Frames (second half)

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\hero\beats\`: every shot on every mountain on High
(`sheet-high.png`: a row a mountain: the whip, the street, the wide, the hero frame), Pinecrest and Ember on
Low, Pinecrest and Sakura on a phone, with the probes in `high.json`, `low.json`, `phone.json`.
`shots\r7\hero\speed\sheet-before.png`: the chase at 15, 28 and 46 m/s.
