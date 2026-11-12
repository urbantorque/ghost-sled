# Round 7, the hero lane: notes for the main lane

Branch `r7-hero`. Files I own: `src/render/rider.ts`, `ghosts.ts`, `portrait.ts`, `camera.ts`, `speedfeel.ts`,
`nearfield.ts`, `cine.ts`, `src/game/timescale.ts`. Kept current as the work goes; the last section says what is
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

- **The feel lane's fall** (r7-feel 0facfea): its `TUMBLE_TICKS` is 90 (1.5 s) in three phases. After the merge set,
  in `src/render/moments.ts` beside `act.tumbleS`:
  `act.tumbleCuts = [FALL_TICKS / TUMBLE_TICKS, (FALL_TICKS + DOWN_TICKS) / TUMBLE_TICKS]`
  so the picture's phases land on the sim's (thrown and sliding, down, up). Without it the cuts are 0.4 and 0.7.

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\hero\`: `before/` (the baseline's probe shots), `turn/`
(turntables: `sheet-a.png` the build, `sheet-b.png` poses, `sheet-wipe.png` the fall and get-up).
