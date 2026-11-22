# Round 8, milestone 4: the critic loop on Pinecrest (review lane m0)

Branch `r8-rev0` (cut from `round-8` at `9a93aa8`), port 4870. Frames in the main checkout under
`shots/r8/review/m0/pass<K>/` (`high/`, `low/`, `phone-medium/`, each with its JSON; `sheets-low/` and
`sheets-phone-medium/`, four to a sheet; `strips/`, eight frames of the same seconds tiled, with `strips.json`).

## How each pass ran

- **Capture** (`rev0/capture.sh`, kept out of the repo): the build served by `vite preview`, the 38 places of
  `frames-r7.json` for Pinecrest shot as stills that hold the run still (`stills.js`: the pool's rider 0 replayed as the
  player from a fresh save on a virtual clock, the DOM HUD hidden) on High and Low at 1280x720 and the phone (390x844,
  DPR 2) on Medium; eight strips on High (eight frames 8 ticks apart, `speedstrips.js`) at the opening (165 m), the
  First Drop's lip (598), Mirror Lake (1880), the gold's leap (2672), the covered bridge (3500), Old Town's street
  (3700), the Valley Leap (3962) and the line (4462). One browser slot held for the whole batch.
- **Critic**: a fresh subagent (Opus, high effort) each pass, given only the frames' paths (High one by one, Low and
  the phone as contact sheets, the strips as sheets), ART.md's path, a one-line map of where the course's places lie
  in metres, and the brief's instruction. Never told what changed or why.
- **Pinecrest on this course** (SIM_VERSION 10): the start 0 to 120 m, the opening (bowl and cruise) 120 to 499, the
  First Drop's leap 499 to 837 (lip 617, rings 577 to 837), Timberline Glades 837 to 1092, a fork 1092 to 1410, the
  stage line's cruise 1410 to 1600, a chute 1600 to 1785, Mirror Lake 1785 to 2095 (the slide), a bowl and a tree run
  2095 to 2567, the gold's leap 2567 to 2910 (lip 2690), the stage line's cruise 2910 to 3100, a fork 3100 to 3421, the
  covered bridge 3421 to 3636, Old Town's street 3636 to 3866 (the steps 3421 to 3866), the Valley Leap 3866 to 4200
  (lip 3980), the finish 4200 on, the line at 4500.
- **Hero vistas** (DECISIONS 342 and 372): the opening, the First Drop, Mirror Lake, Old Town's street, the Valley Leap.

<!-- SCORES -->
## The scores, pass by pass

A fresh critic each pass (Opus, high effort); half points. Per-frame scores for every tier are also in
`notes/r8-rev0-scores.json`.

| | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| High mean (min) | 7.28 (6) | 7.30 (5) | 7.57 (6) | 7.20 (5.5) | 7.20 (5) |
| Low mean (min) | 6.27 (5.5) | 6.47 (5) | 7.05 (6) | 6.50 (5) | 6.42 (5) |
| Phone mean (min) | 6.28 (5) | 6.49 (5) | 6.86 (6) | 6.16 (5) | 6.35 (5) |
| Strips mean (min) | 7.25 (6) | 7.06 (5.5) | 7.13 (6) | 6.94 (5.5) | 6.88 (5.5) |
| The opening (best frame) | 7 | 7.5 | 6.5 | 7.5 | 7 |
| The First Drop (best frame) | 7.5 | 7.5 | 7.5 | 7.5 | 7 |
| Mirror Lake (best frame) | 7.5 | 7 | 7.5 | 6.5 | 7 |
| Old Town (best frame) | 8 | 8.5 | 8 | 8 | 8 |
| The Valley Leap (best frame) | 8 | 8.5 | 8.5 | 8 | 8 |

### High (1280x720)

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0150 | 7 | 6 | 6.5 | 5.5 | 6 |
| z0300 | 7 | 6.5 | 6.5 | 6.5 | 7 |
| z0450 | 7.5 | 7 | 7 | 7 | 7 |
| z0537 | 7.5 | 7.5 | 7.5 | 7.5 | 7 |
| z0600 | 7 | 7 | 7 | 7.5 | 6.5 |
| z0707 | 7 | 6 | 6 | 5.5 | 6.5 |
| z0900 | 8 | 8 | 8 | 7.5 | 7.5 |
| z1050 | 6.5 | 5 | 7.5 | 6.5 | 6.5 |
| z1200 | 7.5 | 8 | 8.5 | 8 | 8 |
| z1261 | 7 | 7 | 7.5 | 7 | 7 |
| z1350 | 8 | 8 | 8 | 8 | 8 |
| z1500 | 6 | 5.5 | 7 | 6.5 | 6.5 |
| z1593 | 8 | 8 | 8.5 | 8 | 8 |
| z1650 | 7.5 | 8 | 8 | 8 | 7 |
| z1763 | 7 | 7.5 | 8 | 7 | 7.5 |
| z1950 | 7 | 7 | 7 | 6.5 | 7 |
| z2100 | 7.5 | 7 | 7.5 | 6.5 | 7 |
| z2250 | 6.5 | 6.5 | 7.5 | 7 | 7.5 |
| z2429 | 6 | 7.5 | 8 | 6.5 | 7 |
| z2550 | 7.5 | 8 | 8.5 | 7.5 | 7.5 |
| z2700 | 8 | 8.5 | 8 | 8.5 | 8 |
| z2850 | 6 | 6 | 6 | 6.5 | 5 |
| z3000 | 7.5 | 7.5 | 7.5 | 7 | 7.5 |
| z3100 | 7.5 | 7.5 | 7.5 | 7.5 | 7.5 |
| z3150 | 7 | 7.5 | 8 | 7 | 7.5 |
| z3229 | 7.5 | 7 | 8 | 7 | 7.5 |
| z3300 | 7 | 7 | 7 | 7 | 6.5 |
| z3354 | 7.5 | 8 | 8 | 7.5 | 7.5 |
| z3464 | 7.5 | 7.5 | 7.5 | 7.5 | 7.5 |
| z3548 | 7.5 | 7.5 | 7.5 | 7.5 | 7 |
| z3600 | 8 | 8 | 8 | 8 | 8 |
| z3750 | 8 | 8 | 8 | 8 | 7.5 |
| z3940 | 6.5 | 7 | 7 | 7 | 6.5 |
| z4050 | 8 | 8.5 | 8.5 | 8 | 8 |
| z4200 | 7 | 7 | 7.5 | 6.5 | 7 |
| z4330 | 8 | 8.5 | 8 | 8 | 8 |
| z4440 | 8 | 8 | 8 | 8 | 8 |
| **mean** | 7.28 | 7.30 | 7.57 | 7.20 | 7.20 |
| **minimum** | 6 | 5 | 6 | 5.5 | 5 |

### Low

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0150 | 5.5 | 5.5 | 6.5 | 5.5 | 5.5 |
| z0300 | 6 | 6 | 7 | 6.5 | 6 |
| z0450 | 6.5 | 6.5 | 6.5 | 6.5 | 6.5 |
| z0537 | 6.5 | 6.5 | 7 | 6.5 | 6.5 |
| z0600 | 6 | 6.5 | 6.5 | 6.5 | 6.5 |
| z0707 | 5.5 | 5.5 | 6 | 5 | 5.5 |
| z0900 | 6.5 | 7 | 7.5 | 7 | 7 |
| z1050 | 5.5 | 5 | 7 | 6 | 6 |
| z1200 | 6.5 | 7 | 7.5 | 7 | 7 |
| z1261 | 6.5 | 6.5 | 7.5 | 6.5 | 6.5 |
| z1350 | 7 | 7 | 7.5 | 7 | 7 |
| z1500 | 5.5 | 5 | 6.5 | 6 | 6 |
| z1593 | 6.5 | 7 | 7.5 | 7 | 7 |
| z1650 | 6.5 | 7 | 7 | 7 | 6.5 |
| z1763 | 6.5 | 6.5 | 7.5 | 6.5 | 6.5 |
| z1950 | 6 | 6.5 | 7 | 6.5 | 6.5 |
| z2100 | 6.5 | 6 | 6.5 | 6 | 6.5 |
| z2250 | 6 | 6.5 | 7 | 6.5 | 6.5 |
| z2429 | 6 | 7 | 7.5 | 6.5 | 6.5 |
| z2550 | 7 | 7 | 7.5 | 7 | 7 |
| z2700 | 7 | 7.5 | 7.5 | 7.5 | 7 |
| z2850 | 6 | 5.5 | 6 | 6 | 5 |
| z3000 | 6.5 | 6.5 | 7 | 6.5 | 6.5 |
| z3100 | 6.5 | 7 | 7 | 6.5 | 7 |
| z3150 | 6 | 6.5 | 7 | 6.5 | 6 |
| z3229 | 6.5 | 6.5 | 7 | 7 | 6.5 |
| z3300 | 6 | 6 | 6.5 | 6 | 6 |
| z3354 | 6.5 | 6.5 | 7.5 | 6.5 | 6.5 |
| z3464 | 6 | 6.5 | 7 | 7 | 6.5 |
| z3548 | 6.5 | 7 | 7 | 7 | 6.5 |
| z3600 | 6.5 | 7 | 7.5 | 7 | 7 |
| z3750 | 6.5 | 7 | 7.5 | 6.5 | 6 |
| z3940 | 5.5 | 6 | 6.5 | 6 | 5.5 |
| z4050 | 6.5 | 6.5 | 7.5 | 6.5 | 6.5 |
| z4200 | 5.5 | 6 | 7 | 5.5 | 6 |
| z4330 | 7 | 7 | 7.5 | 6.5 | 7 |
| z4440 | 6.5 | 7 | 7.5 | 7 | 7 |
| **mean** | 6.27 | 6.47 | 7.05 | 6.50 | 6.42 |
| **minimum** | 5.5 | 5 | 6 | 5 | 5 |

### Phone on Medium (390x844)

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0150 | 6 | 6 | 6 | 5.5 | 6 |
| z0300 | 6 | 6 | 6.5 | 6 | 6.5 |
| z0450 | 6.5 | 6.5 | 6.5 | 6 | 6.5 |
| z0537 | 6.5 | 6.5 | 6.5 | 6 | 6.5 |
| z0600 | 6 | 6.5 | 6.5 | 6 | 6 |
| z0707 | 6 | 6 | 6.5 | 5 | 6 |
| z0900 | 7 | 7.5 | 7.5 | 7 | 7 |
| z1050 | 5.5 | 5 | 7 | 6 | 6 |
| z1200 | 6.5 | 7.5 | 7.5 | 7 | 6.5 |
| z1261 | 6 | 6 | 7.5 | 6 | 6 |
| z1350 | 6.5 | 7.5 | 7.5 | 7 | 6.5 |
| z1500 | 5.5 | 5 | 6.5 | 5.5 | 5.5 |
| z1593 | 6.5 | 7 | 7 | 6.5 | 6.5 |
| z1650 | 6.5 | 7 | 7 | 6.5 | 6 |
| z1763 | 6.5 | 7 | 7 | 6 | 6.5 |
| z1950 | 6.5 | 6.5 | 7 | 6 | 6.5 |
| z2100 | 6 | 5.5 | 6 | 5.5 | 5.5 |
| z2250 | 6 | 6.5 | 7 | 6.5 | 7 |
| z2429 | 6 | 7 | 7.5 | 6.5 | 7 |
| z2550 | 7 | 7 | 7.5 | 7 | 7 |
| z2700 | 7 | 7 | 7 | 7 | 6.5 |
| z2850 | 5.5 | 5.5 | 6 | 5.5 | 5.5 |
| z3000 | 5.5 | 6 | 6.5 | 6 | 5.5 |
| z3100 | 6.5 | 6.5 | 7 | 6.5 | 6.5 |
| z3150 | 6.5 | 6.5 | 6.5 | 6 | 6.5 |
| z3229 | 6.5 | 6.5 | 6.5 | 6 | 6.5 |
| z3300 | 6.5 | 6.5 | 6.5 | 6 | 6.5 |
| z3354 | 6.5 | 7 | 7 | 6 | 6.5 |
| z3464 | 6 | 6.5 | 7 | 6 | 6.5 |
| z3548 | 6.5 | 7 | 7 | 6.5 | 6 |
| z3600 | 7 | 7 | 7.5 | 6.5 | 7 |
| z3750 | 6.5 | 6.5 | 6 | 5 | 6 |
| z3940 | 5 | 5.5 | 6.5 | 5.5 | 5 |
| z4050 | 6.5 | 7 | 7.5 | 6.5 | 7 |
| z4200 | 6 | 6.5 | 7 | 6 | 6.5 |
| z4330 | 7 | 7 | 7.5 | 6.5 | 7 |
| z4440 | 6.5 | 6 | 7 | 7 | 7 |
| **mean** | 6.28 | 6.49 | 6.86 | 6.16 | 6.35 |
| **minimum** | 5 | 5 | 6 | 5 | 5 |

### Strips in motion (High)

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0165 | 6 | 5.5 | 6 | 5.5 | 5.5 |
| z0598 | 7 | 6.5 | 7 | 6.5 | 6.5 |
| z1880 | 7.5 | 7 | 7 | 6.5 | 6.5 |
| z2672 | 7.5 | 7.5 | 7.5 | 7.5 | 7 |
| z3500 | 7.5 | 7.5 | 7.5 | 7.5 | 7.5 |
| z3700 | 7.5 | 7.5 | 7 | 7.5 | 7.5 |
| z3962 | 7 | 7 | 7.5 | 7 | 7 |
| z4462 | 8 | 8 | 7.5 | 7.5 | 7.5 |
| **mean** | 7.25 | 7.06 | 7.13 | 6.94 | 6.88 |
| **minimum** | 6 | 5.5 | 6 | 5.5 | 5.5 |
<!-- /SCORES -->

## Pass 1 (the round's build as merged, `9a93aa8`)

Means: High 7.28 (minimum 6), Low 6.27 (5.5), phone 6.28 (5), strips 7.25 (6). Hero vistas: the opening 7, the First
Drop 7.5, Mirror Lake 7.5, Old Town 8, the Valley Leap 8. No frame a 9. The console clean in every capture (High, Low,
phone, strips). The 38th place (4590 m, "finish-square") is past this course's line (4500 m), where the run has ended
and the stills script stops: 37 places a tier.

What the critic named, by cost:

1. A flat orange "crown" over the vanishing point in every frame of the gold and the dusk (2550 m on), every tier.
   Looked at: the painted cumulus banks, which the gold stop leaves at the cloud stop's 0.95 coverage, standing to
   the top of their band with the low sun's rim colour from foot to top.
2. A bleached or empty near plane: the phone's lower 40 to 50% and Low's foreground blank white snow.
3. The rider as a navy disc in a flip (the saucer's underside over the rider): 1050, 1500 m, strips 165 and 598.
4. Boxes: the leap outcrops as lilac cubes under white lids (600, 3940), a rock with a lid (3229), slabs on the lake's
   bank, the hotel, the bridge's towers.
5. Ghosts in the sky (1650, 3750: pool riders in the air over a lip) and at the rider's shoulder (2550, 2700).
6. Ice gone salmon or copper under the gold: the second fork's strip (3150, 3464) and the glazed patch before the
   Valley Leap's lip (3940, the floor of the frame; the worst frame on every tier: 6.5, 5.5, 5).
7. Radial streaks over the lane (300, 1950, 3940, 4200): at 1950 the lake's shafts fanned over the ice; at 4200 the
   ghosts' converging ruts and the edge blur.
8. Mirror Lake: the ice mid-blue, its plates a regular hexagonal mesh, the reflection missing on High.
9. The hero lost in a tumble (2429, 2850: the pool rider falls there).
10. Near lanterns big or cropped (3548; the phone at 3000 and 4440, where the climax's strings hang in front of the
    FINISH board).
11. Dark tree shards at the frame's edges (537, 1200, 1350).

Low's worst: hard white pools at 4200 and 4440 (lamp pools clipped on cream snow), glass-pane shaft cards over the
opening's crest, the opening white on white.

### What changed after pass 1 (`855c261`)

- **The gold's cloud banks sink to the ridges** (palette.ts, `JOURNEY.alpine` gold stop: `clouds.low` 0.95 to 0.42; the
  dusk stop and the Dusk hour inherit it). The banks are shoulders on the ridges, the faceted peaks hold the sky's
  middle, the high wisps stay.
- **A glaze under a warm sky keeps a cool tint** (materials.ts, shared, three lines): where what the glaze mirrors is
  warm (red over blue), half of it becomes the deep upper sky, as the fork's strip already did by half. A cool sky
  (Frostfang, Glass Ice) is untouched; the lake is untouched.
- **A deeper frame foot** (palette.ts `round7` alpine): the grade's foot 0.26 to 0.38 (the phone takes 1.3 of it), Low's
  painted foot 0.3 to 0.44; Low's shaft cards 1 to 0.6 of the grade's.
- **Low's pools soft at the Valley Leap and the square** (`PLACES.alpine` leap 2 and finish: `poolSoft` 1, as Ember's):
  a paler, warmer step of the snow, kept under white. Low only.
- **Mirror Lake's shafts keep off the ice** (`PLACES.alpine` lake: shafts 0.7 to 0.35, rays 0.35), and the lake's near
  plates are fainter (materials.ts, lake only: 0.32 to 0.18).
- **The second stage line's cruise a step down** (a new `PLACES.alpine` row, cruise 2: exposure x0.95, contrast +0.03):
  the bank facing the low sun at 3000 to 3100 m. (Tried first on the gold stop itself, 0.97 to 0.93: the Dusk hour
  builds on that stop and fell under the hours' exposure floor at the chute, `tests/hours.test.ts`.)
- **A saucer's underside takes the snow's bounce at 0.8** (rider.ts, shared: 0.5, the round hulls only).

## Pass 2 (`855c261`)

Means: High 7.30 (minimum 5), Low 6.47 (5), phone 6.49 (5), strips 7.06 (5.5). Hero vistas: the opening 7.5, the First
Drop 7.5, Mirror Lake 7, Old Town 8.5 (z4330), the Valley Leap 8.5 (z4050). The best frames 8.5 (z2700, z4050, z4330).
Console clean. (Pass 1's Low and phone sheets held 36 frames: the tenth sheet, z4440 alone, failed to tile, and that
critic scored z4440 on Low and the phone without seeing it. Fixed for pass 2 on; pass 1's two z4440 scores stand
in the table but mean nothing.)

Against pass 1 (a fresh critic, about half a point of its own either way): the orange crown and the salmon ice were
named by no one; Low +0.20 and the phone +0.21; the gold half the "close" part. What it named, by cost:

1. The hero lost in the air and in a fall: the flipped tray's underside (the demo rider rides the Tea Tray, whose
   underside is painted `#3A4256`) an ink disc over the rider at 1050 and 1500 m on every tier (5 everywhere), the
   tumble at 2850 m a heap at the frame's foot. The pass 1 bounce change did not move it: the bounce is the paint's
   own colour, and the paint is navy.
2. The empty near plane (the phone's lower half, Low's foreground) and radial smear.
3. The tray an untextured grey coaster in every chase frame: no grain, no vermillion trim.
4. Ruled white stripes over ice: the frost scratches from the sled to the frame's foot (3940), the sun's path on the
   lake (1950, 2100).
5. Boxes: the lip's rocks as stacked cubes, a rock with a lid (3229), the gantry's panels, the bridge's pylons.
6. Lamps that do not light the snow: the covered bridge and Old Town's floor plain lilac, lanterns lit from outside.
7. The valley floor a featureless haze (no lake, no gold pool for the town).
8. Ghosts in the wrong place (in the sky over a lip, fused to the rider, cut at the frame's edge).
9. Blurred near trees at the edges; one stippled (2550).

### What changed after pass 2 (`7e98e45`, `75c1068`)

- **A flipped round hull is the player's sled, not an ink disc** (rider.ts, shared, every mountain; the round hulls
  only, `aSway.w` -5: the Whirl Saucer and the Tea Tray). Exactly: the pass-1 bounce change is undone (`bounceU` is
  0.5 again, as round 8 merged it); inside the underside branch, for a round hull only, `underC` is mixed 0.42 toward
  `mix(uSnowLit, uShadeTint, 0.62) * (0.66 + 0.08 * sin(r * 46))` (the snow's cool light in faint spun rings, whatever
  the paint), and a band from r 0.5 to 0.68 (r measured with z scaled 0.9 for the tray's oval) is mixed to vermillion
  `vec3(0.66, 0.06, 0.025)`. Nothing changes on the upright sled or any slatted one. **The Sakura lane (rev3, 5cac2f0)
  also changed a flipped Tea Tray's underside in rider.ts; the main lane should keep one of the two.** Mine aims at
  the rider hidden behind a navy disc (the worst frames on Pinecrest, 5 on every tier at 1050 and 1500 m); the
  vermillion band is the part that puts the hero's colour back in the frame.
- **The Tea Tray's face** (meshes.ts, shared, the garage too): two thin tori on the face, a pewter one (r 0.52) and a
  vermillion one (r 0.45, `RIDER_COLORS.accent`, which `paintSled` keeps), so the tray is not a plain grey coaster.
  About 400 triangles on that sled only; no draw.
- **Old Town's street and the covered bridge pool amber** (`PLACES.alpine` street lamps 1.6 to 2.3, bridge 1.2 to 1.8,
  both `poolSoft` 1 so Low paints a soft step).
- **The lip's outcrops** (rails.ts, alpine only): beds 4 to 5 and 3 to 4, nine sides, harder dip (0.2), more jut (0.32),
  a rougher plan with bays, instead of the cube-like stacks.
- **Frost scratches on a glaze fainter** (trails.ts, shared: the cut's alpha on ice x0.42, was x0.6): from the sled to
  the frame's foot they read as ruled white stripes on the Valley Leap's glazed patch.

## Pass 3 (`75c1068`)

Means: High 7.57 (minimum 6), Low 7.05 (6), phone 6.86 (6), strips 7.13 (6). Hero vistas: the opening 6.5, the First Drop
7.5, Mirror Lake 7.5, Old Town 8, the Valley Leap 8.5. The best frames 8.5 (z1200, z1593, z2550, z4050). Console clean.
(Its High stills were shot twice: the first try's browser did not open after a usage-limit stop, and the capture script
now checks the session is open after `open` and retries.)

Against pass 2: High +0.27 and its minimum 5 to 6, Low +0.58, the phone +0.37. The flipped tray read as "a vermillion
ring" (High 1050 from 5 to 7.5, 1500 from 5.5 to 7; Low 5 to 7 and 6.5). Low "reads as a poster and almost never
breaks". What it named, by cost:

1. The morning bleached and milky, 0 to 1500 m: no darks, the shade a pale wash, the First Drop's lake white milk.
2. The gold turned to the old lilac from 2550 m: snow, banks and street floors lavender or mauve-grey.
3. Empty snow planes (the phone's lower half above all) and torn-paper shadows.
4. The hero unreadable in the opening's aerial lens (150, 707, strip 165) and the tumble at 2850.
5. Boxes: the mauve retaining slab of the opening's fall, the hotel, the lip's cubes, the lake bank's grey blocks, the
   cornice's white boxes at the lips.
6. Ghosts in the sky (1650, 3750) and an opaque one (2429).
7. Lanterns as flat drums; one dissolving as a stipple by the lens on the phone (3750).
8. The rider dead centre over the vanishing point.
9. The lake's crack net and a detached reflection on the phone.

### What changed after pass 3

- **The morning a step down with darks** (palette.ts `round7` alpine): exposure 1.0 to 0.97 (the places' floor of 0.85 under the chute's 0.88), contrast 1.12 to 1.17,
  the shade a clean blue (`#7CA6EC` to `#6E9CEA`, deep `#2F62C8` to `#2856C0`).
- **The gold's shade violet-blue, not violet** (`JOURNEY.alpine` gold stop: shade `#6670C6` to `#5E76CA`, deep
  `#3A44A4` to `#3048A8`, the split tone's low `#DCD8FF` to `#D8E0FF`; the dusk stop's shade `#6068B8` to
  `#5A6EBE`, deep `#2A389C` to `#2A3CA0`, low to `#D8E0FF`). The Dusk hour builds on both stops and moves with them.
- **The frame's foot again** (grade 0.38 to 0.44, Low's painted 0.44 to 0.5).
- **The flipped hull's vermillion band softer** (rider.ts, at the main lane's word: the Sakura lane's pass 3 critic read it
  side-on in a spin as "a red target disc"): r 0.54 to 0.67 (was 0.5 to 0.68), `vec3(0.56, 0.05, 0.022)` (was 0.66, 0.06,
  0.025), and weighted by `smoothstep(0.35, 0.75, dot(n, v))`, so it fades as the hull turns edge-on to the lens.

## Pass 4 (`742418a`)

Means: High 7.20 (minimum 5.5), Low 6.50 (5), phone 6.16 (5), strips 6.94 (5.5). Hero vistas: the opening 7.5, the First
Drop 7.5, Mirror Lake 6.5, Old Town 8, the Valley Leap 8. Best frame 8.5 (z2700). Console clean.

A harsher critic than pass 3's (it marked down frames pass 3 had marked up with nothing changed in them, such as z1593
from 8.5 to 8 and z2429 from 8 to 6.5); the fixes it saw held: no frame of the gold was called lilac snow, only the left
massif "lavender". What it named, by cost:

1. Aerial whiteout: from a lens in the air (150, 707, strips 165 and 598) the valley, its lake and the far range one
   pale value; the rider a dot. Two vistas lost to it.
2. The phone's lower 40 to 50% empty snow (the main reason for its mean).
3. Shafts lying on the near ice and snow as white fans (1950, 2100, 3940 on every tier).
4. Boxes: the lip's rocks (still read as cubes after pass 2's beds), the cornice's blocks, the lake bank's crates, the
   bridge's towers.
5. The hero unreadable in flips ("a beetle shell") and the tumble at 2850.
6. Streak smear across the lower frame (4200, 3300).
7. A translucent peach mound behind the far peaks in the gold (what pass 1's change left of the cloud banks), most on
   Low and the phone.
8. Ghosts in the sky over Old Town, on the trestle, smeared at the lens.
9. A lantern dissolving as a checkerboard at the top of the phone's frame (3750, named twice now).
10. Mirror Lake mid-cobalt with a hex grid; no cable car; the reflection once.

### What changed after pass 4

- **No banks in the gold** (`JOURNEY.alpine` gold stop: `clouds.low` 0.42 to 0): the high wisps stay; the sun has dropped
  under the cloud.
- **The morning's valley haze blue and thinner** (`round7` alpine: `atmo.valleyColor` `#E8F3FC` to `#A6C6EE`,
  `atmo.valley` 0.5 to 0.38, `air.low` 0.5 to 0.36).
- **No shaft light in the first 10 m of air** (postfx/shafts.ts, shared: `1 - exp(-max(reach - 10, 0) / uShaftAir)`),
  so a low sun ahead lays no fan of rays over the near snow and ice (ART.md 12).
- **A set piece's lantern by the lens is solid, then gone** (momentkit.ts, shared: discarded inside 4.8 m, was a 2x2
  dither from 5.2 to 4.4 m).
- **Mirror Lake darker under the lens** (materials.ts, lake only: the mirror's floor 0.5 to 0.34, its reach 0.5 to 0.64)
  **and its plates fainter again** (0.18 to 0.1).

## Pass 5 (`593be51`, the branch's last fixes)

Means: High 7.20 (minimum 5), Low 6.42 (5), phone 6.35 (5), strips 6.88 (5.5). Hero vistas: the opening 7, the First
Drop 7, Mirror Lake 7, Old Town 8 (z4330), the Valley Leap 8 (z4050). Best frames 8 (z1200, z1350, z1593, z2700,
z3600, z4050, z4330, z4440). Console clean in every capture. No fix was made after it (five passes, the brief's most).

What it named, by cost: ghosts in the sky over Old Town and the trestle, smeared at the frame's edge, or over the
rider; blank or edge-blurred banks, and the phone's empty lower third; the old lilac in the shade from 2700 m to the
line; boxes (the lip's rocks, the opening's slab wall, the lake bank's slabs, a rail's white slab, the hotel, the
cornices); straight radial streaks on ice and a hex crack grid; the First Drop's valley a white sheet; the hero
unreadable in flips and the tumble; lanterns as flat plastic at the lens; name pills stacked at the vanishing point.

## The verdict

**The stopping rule was not met.** Five passes, and no critic gave any frame a 9 on any tier, nor any hero vista. The
best frames are 8.5 (z2700, z4050 and z4330 in pass 2; z1200, z1593, z2550 and z4050 in pass 3) and 8 in pass 5. The
means did not move beyond the critics' own spread: High 7.28, 7.30, 7.57, 7.20, 7.20; Low 6.27 to 6.42 (7.05 in
pass 3); the phone 6.28 to 6.35 (6.86 in pass 3). Pass 3's critic was the most generous and passes 4 and 5 the
harshest (pass 4 marked z2429 from 8 to 6.5 and z1593 from 8.5 to 8 with nothing changed in either). Read pass by pass,
what was fixed stopped being named, and each new critic named what it found next:

- *Named, then not again after the fix:* the orange crown in the gold's sky (pass 1), salmon ice before the Valley
  Leap (pass 1), Low's white pools at the square (pass 1; passes 4 and 5 saw one at 4200 m, the Valley Leap's own lamp),
  the morning's grey-lilac shade (pass 3). The flipped tray as an ink disc (pass 2: 5 on every tier at 1050 and 1500 m)
  rose to 7 to 7.5 in pass 3 ("a vermillion ring") and was 6 to 6.5 after (a "beetle shell", "a grey disc with a navy
  X"): the hero's colour is back in the flip, the hero's figure is not.
- *Named every pass, and out of reach of data:* the hero lost in the opening's air lens (150, 707 and strip 165: the
  demo rider is in the air over the bowl and the First Drop, where the place shot gives way to the big-air vista) and
  in the tumble at 2850 m (the pool rider falls there; the crash lens leaves it at the frame's foot); ghosts in the sky
  (pool riders in the air over a lip, the sim's) and fused to the rider; the phone's empty lower third (the portrait
  lens's own height); the lip's rocks as cubes (thinner beds in pass 2 did not change the read); Mirror Lake without a
  cable car or a true reflection, its ice never black under a blue sky; lanterns as flat drums at the lens; the
  hotel's window grid; the bank blur at the frame's edge (the speed lane's band, judged on stills).

## Still short, and why

1. **The opening and the First Drop seen from the air** (the worst High frames every pass, 5.5 to 6.5). The rider flies
   off the start's ramp and over the First Drop's lip, and the big-air vista lifts the lens high and back, so the
   composed place (the rail, the fall, the leaning spruces) is seen from above as a white field with a slab. A camera
   change: let the opening's place shot hold through a short flight, or keep the vista low over the opening (camera.ts,
   shared). Not done here: it changes every mountain's air.
2. **The tumble at 2850 m** (5 to 6.5): ART.md 8's crash lens should hold the rolling rider mid-frame; a camera fault.
3. **Ghosts in the sky and fused to the rider:** the pool riders' own positions (the sim is closed).
4. **The phone's lower third:** the deeper foot lifted it a little (pass 3: 6.86); the empty snow is the portrait
   lens's framing, which every mountain shares.
5. **Mirror Lake's "rider and cable car doubled":** no cable car crosses the lake on this course's layout, and High
   mirrors only a soft figure; Ultra's screen mirror is the path.
6. **Boxes:** the lip's outcrops (a geometry pass on `strataInto` or a new form), the hotel's window grid, the
   cornices' blocks, the lake bank's slabs, a rail's white mound across the lens at 2250 m.
7. **The old lilac at the line:** the shade went violet-blue after pass 3 and pass 4 named only the massif; pass 5 saw
   lilac again from 2700 m. The dusk stop's sky (`#7A7CB8` mid) and fog (`#D8B4B0`) are what the shade takes there.
8. **Lanterns as flat drums at the lens** (the bridge's steps; the climax strings over FINISH on the phone).

## Cost

From the stills' JSON (draw calls summed over a frame's passes; mean / max, and mean triangles, 37 frames a tier):

| Tier | Pass 1 (`9a93aa8`) | Pass 2 (`855c261`) | Pass 3 (`75c1068`) | Pass 4 (`742418a`) | Pass 5 (`593be51`) |
| --- | --- | --- | --- | --- | --- |
| High | 110.0 / 120, 1,044,136 | 110.2 / 120, 1,044,413 | 110.2 / 120, 1,055,852 | 110.2 / 120, 1,056,374 | 110.2 / 120, 1,056,104 |
| Low | 50.3 / 54, 147,350 | 50.2 / 54, 147,093 | 50.2 / 54, 151,078 | 50.2 / 54, 151,174 | 50.3 / 54, 151,263 |
| Phone, Medium | 92.6 / 101, 740,371 | 92.6 / 101, 740,610 | 92.5 / 101, 750,701 | 92.6 / 101, 749,942 | 92.6 / 101, 749,553 |

Draw calls level on every tier. Triangles +1.1% on High, +2.7% on Low and +1.2% on the phone from pass 3 on: the lip's
outcrops in more, thinner beds of nine sides (pass 2's fix; in a batch already drawn) and the tray's two rings (about
400 triangles on one sled). No new draw, pass, program or uniform, and nothing before the first frame; the glaze's
warmth reads the mirrored colour it already has, and the shafts' near metres are one subtraction.
GLCOUNT_LINE

## Shared code touched

| File | Change | Effect on the other mountains |
| --- | --- | --- |
| `scripts/playtest/stills.js` | records each frame's draw calls and triangles in the JSON | none (tooling) |
| `materials.ts` | a glaze (not the lake) mirroring a warm sky takes up to half its mirror from the deep upper sky, by `(r - b) * 2.5` | warm-sky ice everywhere holds a cooler tint (Frostfang's dawn glaze, Ember, the hours' rose); cool skies untouched |
| `materials.ts` | the lake's mirror floor 0.5 to 0.34 (reach 0.64), its near plates 0.32 to 0.1 | lakes only |
| `postfx/shafts.ts` | no shaft light in the first 10 m of air (`max(reach - 10, 0)`) | every mountain's marched shafts (Medium and up) stand off the near snow under the lens |
| `momentkit.ts` | a set piece's lantern is discarded inside 4.8 m (was a 2x2 dither from 5.2 to 4.4 m) | every lantern gate and street lantern: solid, then gone |
| `rider.ts` | a round hull's underside in a flip (above; `e5bfba2` softened the band) | every saucer and tray rider; carried byte for byte by the Sakura lane, whose own tray change the main lane drops |
| `meshes.ts` | the Tea Tray's face: a pewter ring and a vermillion one | the Tea Tray everywhere, the garage too |
| `trails.ts` | frost scratches on ice x0.42 (was x0.6) | every ice rut, Frostfang's most |
| `rails.ts` | Pinecrest's lip outcrops (alpine only) | none |

Everything else is Pinecrest's own data in `palette.ts` (`clearSkies`/`round7` alpine, `JOURNEY.alpine`, `PLACES.alpine`).
The Dusk hour builds on `JOURNEY.alpine`'s gold and dusk stops, so it took their bluer shade and lost the gold's banks too.

## Text for DECISIONS

"Pinecrest's review loop (milestone 4, `notes/r8-rev0.md`): five passes, a fresh critic each, on stills that hold the
run still. No frame and no hero vista reached 9; the stopping rule was not met. High 7.28, 7.30, 7.57, 7.20, 7.20; Low
6.27, 6.47, 7.05, 6.50, 6.42; the phone 6.28, 6.49, 6.86, 6.16, 6.35; strips 7.25, 7.06, 7.13, 6.94, 6.88; the vistas'
best frames 6.5 to 8.5 (Old Town and the Valley Leap 8 to 8.5 throughout, the opening and the First Drop 6.5 to 7.5,
Mirror Lake 6.5 to 7.5). The means sit inside the critics' own spread, and what each pass fixed stopped being named:
the gold's cloud banks that stood over the road as an orange crown (gone from the gold), ice that mirrored a warm sky
as a salmon slab (a cool tint, every mountain), Low's lamp pools as white ovals (soft steps), the phone's empty foot (a
deeper periwinkle foot), a flipped saucer or tray as an ink disc over the rider (the snow's light and a vermillion
band, every mountain), unlit snow in Old Town's street and the covered bridge, the morning's grey-lilac shade, the
gold's lilac shade (violet-blue), shafts fanned over the near ice (none in the first 10 m of air, every mountain), a
lantern dithered by the lens (solid, then gone). What data could not reach: the opening and the First Drop seen from
the big-air lens, the tumble at 2850 m left at the frame's foot (camera), ghosts in the sky (the sim's), the phone's
portrait framing, Mirror Lake's cable car and true reflection, the lip's rocks and the props that read as boxes.
Cost: draw calls level on every tier; triangles +1 to +3%."

## Text for ART.md 15 ("As built in round 8", Pinecrest)

"The gold keeps its high wisps and no cumulus banks: the sun has dropped under the cloud, and a bank lit from below
stood over the road as one flat orange crown. Its shade is violet-blue, never lilac. A glaze under a warm sky keeps a
cool tint (half its mirror the deep upper sky), so ice before the Valley Leap is ice, not a salmon slab. Old Town's
lanterns and the covered bridge's pool amber on the snow; Low paints the pools as a soft step under white. Shafts keep
to the air: none in the first ten metres before the lens. A flipped saucer or tray shows the snow's light on its hull
and the trim's vermillion round its rim."

README: one line under the round's look: "Pinecrest's last review: the gold without its orange cloud crown, ice that
stays ice under a warm sky, a lit Old Town street, the hero's colour on a flipped sled."
