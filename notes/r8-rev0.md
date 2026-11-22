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

## Cost (the stills' JSON, mean / max draw calls, mean triangles)

| Tier | Pass 1 (`9a93aa8`) | Pass 2 (`855c261`) |
| --- | --- | --- |
| High | 110.0 / 120, 1,044,136 | 110.2 / 120, 1,044,413 |
| Low | 50.3 / 54, 147,350 | 50.2 / 54, 147,093 |
| Phone, Medium | 92.6 / 101, 740,371 | 92.6 / 101, 740,610 |

Every change is palette data, a shader term or a few triangles in a batch already drawn: no draw, pass or program, no
uniform added (the glaze's warmth reads the mirrored colour it already has). Low's GL calls were not counted with
`glcount.js` (nothing new draws on Low; `dist/r8-rev0-base` is kept in the worktree for that count).

## Shared code touched

| File | Change | Effect on the other mountains |
| --- | --- | --- |
| `scripts/playtest/stills.js` | records each frame's draw calls and triangles in the JSON | none (tooling) |
| `materials.ts` | a glaze (not the lake) mirroring a warm sky takes half its mirror from the deep upper sky, by how warm (`(r - b) * 2.5`) | warm-sky ice everywhere holds a cooler tint (Frostfang's dawn glaze, Ember, an hour's rose); cool skies untouched |
| `materials.ts` | the lake's near plates 0.32 to 0.18 | lakes only |
| `rider.ts` | a round hull's underside (above) | every saucer and tray rider in a flip; see the Sakura lane's change |
| `meshes.ts` | the Tea Tray's face rings | the Tea Tray everywhere, the garage too |
| `trails.ts` | frost scratches on ice x0.42 (was x0.6) | every ice rut, Frostfang's most |

## Text for DECISIONS (draft), ART.md 15 and the README

DECISIONS: "Pinecrest's review loop (milestone 4): two passes judged of the five, High 7.28 to 7.30, Low 6.27 to 6.47,
the phone 6.28 to 6.49, strips 7.25 to 7.06; no frame a 9; the hero vistas at their best 7.5 (the opening, the First
Drop), 7 (Mirror Lake), 8.5 (Old Town, the Valley Leap). Fixed: the gold's orange cloud crown, salmon ice under a warm
sky, Low's white pools, the empty foot of the phone's frame, a flipped tray as an ink disc, unlit street snow, the lip's
cube rocks, ruled frost scratches. Unjudged after pass 2's fixes." ART.md 15, Pinecrest, "As built in round 8": "In the
gold the cumulus sit as shoulders on the ridges, never a crown over the road; a glaze under a warm sky keeps its cool
tint; Old Town's lanterns pool amber on the street." README: nothing until the loop is finished.
