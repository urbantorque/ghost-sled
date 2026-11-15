# Round 7, the review lane for Lanternfall (mountain 4)

Branch `r7-review-m4`, cut from `round-7` at ead6196. Render only: nothing in `src/sim` or `src/bot`.
Frames are in the main checkout under `shots/r7/review/m4/pass<K>/` (git-ignored):
`high`, `low`, `phone-medium` (the fixed 35), `high-motion` (a pool rider's own run, `demo=2`, shot at the vistas
and through each set piece, then a pinned pass that lights the kindle and holds the gutter by hand, then the
title) and `high-legends` (the Great Rising and the Tall Lamplighter, `legends-r7.js`). One pass is
`scripts/playtest/review-m4-all.sh <base> <out>` on a served build.

There is no round 6 baseline for this mountain: the before sheet is pass 1.

The lane was run by two agents: the first scored pass 1 and made its fixes (uncommitted when it stopped); the
second committed them, made more, and ran passes 2 onward. `pass2-stale/` is the first agent's pass 2,
captured from a build older than its last edits: no critic saw it.

## The critic's scores, pass by pass

Each pass a new general-purpose subagent given only the frames' folders, the path of `ART.md` and the brief's
instruction: pass 1 on the first agent's model at medium effort, passes 2 to 5 on Opus at extra-high effort.
A different critic each pass, so a score is that critic's: read the trend with the sheets, not alone.

### High, the fixed 35 (per frame)

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0150 | 6 | 6.5 | 6.5 | 6.5 | 6.5 |
| z0300 | 6.5 | 6 | 6 | 7 | 6.5 |
| z0450 | 6 | 6 | 5.5 | 6.5 | 6.5 |
| z0565 | 6.5 | 6.5 | 6 | 6.5 | 7 |
| z0785 | 6 | 6 | 6 | 6 | 6 |
| z0900 | 6.5 | 5.5 | 5.5 | 6 | 6 |
| z0945 | 6.5 | 6 | 5.5 | 6.5 | 6.5 |
| z0991 | 7 | 6.5 | 6 | 7 | 6.5 |
| z1050 | 6 | 5.5 | 4.5 | 5.5 | 5.5 |
| z1138 | 6.5 | 5 | 5.5 | 6 | 6.5 |
| z1200 | 6.5 | 5.5 | 5.5 | 6 | 5.5 |
| z1350 | 6 | 6 | 5.5 | 6 | 5.5 |
| z1528 | 7.5 | 6.5 | 7 | 7 | 7 |
| z1650 | 7 | 6.5 | 6.5 | 7 | 7 |
| z1800 | 6 | 6 | 6 | 6.5 | 6.5 |
| z1938 | 6.5 | 6.5 | 6 | 7 | 6.5 |
| z2059 | 6.5 | 6.5 | 6.5 | 7 | 6.5 |
| z2209 | 7 | 7 | 7 | 7 | 7 |
| z2405 | 6.5 | 7.5 | 7 | 7 | 7 |
| z2550 | 7 | 6.5 | 6.5 | 7 | 6 |
| z2700 | 6.5 | 6 | 6 | 6.5 | 6 |
| z2850 | 7 | 6.5 | 6 | 7 | 5.5 |
| z3000 | 7 | 7 | 7 | 7 | 7 |
| z3150 | 6.5 | 6.5 | 6 | 6.5 | 6 |
| z3297 | 7 | 7 | 7 | 7 | 7 |
| z3450 | 7.5 | 7.5 | 6.5 | 7 | 7 |
| z3500 | 7.5 | 7 | 5 | 7 | 7 |
| z3581 | 7.5 | 7 | 6.5 | 7 | 7 |
| z3750 | 6.5 | 6 | 6 | 6 | 6 |
| z3940 | 6.5 | 6 | 6 | 6.5 | 6.5 |
| z4061 | 7 | 7 | 7 | 7.5 | 7 |
| z4200 | 7.5 | 6.5 | 7 | 6.5 | 6.5 |
| z4330 | 7.5 | 7.5 | 6.5 | 7 | 7 |
| z4440 | 7.5 | 7 | 5.5 | 7 | 7 |
| z4590 | 6.5 | 6 | 6 | 6.5 | 6.5 |

### Means and minimums by folder

| Folder | P1 mean | P1 min | P2 mean | P2 min | P3 mean | P3 min | P4 mean | P4 min | P5 mean | P5 min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| high (35) | 6.73 | 6 | 6.4 | 5 (z1138) | 6.1 | 4.5 (z1050) | 6.66 | 5.5 (z1050) | 6.49 | 5.5 (z1050, z1200, z1350, z2850) |
| high-motion (45, then 49) | 6.26 | 4 | 5.9 | 3.5 (i-finish-2) | 6.1 | 3.5 (b-lip1-2) | 6.47 | 4.5 (j-kindle-1) | 6.38 | 4.5 (h-lip3-0) |
| high-legends (20) | 6.9 | 5.5 | 6.7 | 5 (rising-2) | 6.5 | 5.5 (rising-0, 1, 2, 8) | 6.80 | 5.5 (lamplighter-7) | 6.73 | 5.5 (rising-2) |
| low (35) | 6.73 | 6 | 6.0 | 5 (z1138) | 6.0 | 4 (z2850) | 6.27 | 5.5 (z1138, z1200, z2850) | 6.23 | 5 (z2850) |
| phone-medium (35) | 7.1 | 5 | 6.5 | 4.5 (z4590) | 6.3 | 4.5 (z2850, z4590) | 6.51 | 4.5 (z4590) | 6.66 | 5 (z4590) |

### Hero vistas

| Vista | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| (1) The Crown over the cloud sea | 6.5 in play, 7.5 on the title | 6.5 in play, 7.5 on the title | 6.5 (title 7.5) | 7 (title 7.5) | 7 (title 7) |
| (2) The break under the deck | 7.5 (8 in the Great Rising) | 6.5 (8 in the Great Rising) | 7 (7.5 in the Great Rising) | 7.5 (rising-3, 4, 6) | 7 (7.5 rising-6) |
| (3) The Lamp Road with the river of lights | 7 to 7.5 (no river in any frame) | 7.5 (no river in any frame) | 7.5 (no river seen) | 7.5 (no river seen) | 7 (7.5 j-kindle; no river seen) |
| (4) The great lantern lit over the square | 4 to 6 lit, 7.5 before it lights | 5.5 at best | 6.5 at best, never seen lit | 5 for the lit beat (7 unlit) | 5.5 (never framed lit) |

## Pass 1: what the critic found

No frame a 9. The worst five: `b-lip1-2` (4, a banded rectangle on the slope in the first flight), `i-finish-2`
and `i-finish-3` (4 and 4.5, the finish whites out to cream and the great lantern is a dark barrel while the
caption says it is lit), `j-gutter-1` (5, a square glow round the rider), `a-crown-1` (5, the rider bleached on a
landing, green and magenta fringe). Recurring: chromatic fringe in calm frames and lanterns streaked into dashed
red and green lines at the frame's edges; highlights clipping to cream; the hero bleached by the flame, the
lantern's lane and landing glows; visible glow quads; standing stones as untextured ink boxes; windows as flat
orange slabs; the river of lights in no frame; the Cloud Sea one value; one violet grade from the break to the
line; Low's hard-edged dome round the guide light; the Tall Lamplighter a grey cone; a cross-hatched bokeh on
the lanterns in the directed shot at the break.

## Pass 2: what the critic found

A new critic, harsher than the first on the same direction: every folder's mean is lower although the frames
are better on what pass 1 named (the finish's cream line, the fringe's corner split, the carried flame), so
the passes are not a straight line. No frame a 9; best 8 (rising-5, rising-6). The worst five: `i-finish-2`
(3.5) and `i-finish-3` (4), a peach flood when the great lantern lights in a won run and the lantern itself
dark in that instant; `h-lip3-0` (4) and `a-crown-1` (4.5), the perfect landing's white flash bleaching the
rider; `d-break-0` (4.5), the rider bleached at the cloud's exit. Recurring: lanterns streaked green and
magenta in motion (mint in the sky), fuel lights passing the lens as flat yellow slabs, ink posts and stone
lamps as untextured slabs, a block of flats with a window grid (the Crown, the Lamp Road), the fork's gantry
of shapes, two-post gates read as torii, the Cloud Sea one lilac wash, Low's lanterns square pixels and its
cloud sea read as lava, the moon cut by the frame's top, the great lantern never composed with the rider, no
river under the bridges, the rider small in wides (the camera's, shared) and the phone's empty lower half.

## Pass 3: what the critic found

Means held at about 6 (High 6.1, motion 6.1, legends 6.5, Low 6.0, phone 6.3); no frame at 8. What pass 2 named
is gone (green tails, the peach flood in the fixed frames, the torii read of the street gate, Low's lemon lights,
the cut moon on High), and the critic found the next layer. Worst five: `b-lip1-2` (3.5), a rounded-rectangle
hole in the cloud sheet under the first flight; `i-finish-2` (4), a peach flood in a won run's finish and
the great lantern not in that frame; Low and phone `z2850` (4, 4.5), a kicker's ramp between the lens and the
rider with a dithered edge; High `z1050` (4.5), a mint ghost huge at the lens. Recurring: mint ghosts large,
over the hero or in the lantern sky; the hero bleached by the landing, flow and stomp glows; lamps that light no
pool on the line; stone lamps as dark boxes; the lift's gondolas and a window-grid station; Firstlight never
reaching rose on High; balloons over the town; Low's carried flame a white triangle and the phone's a card; the
rider small in wides and the phone's empty lower third (the camera's, shared).

## Pass 4: what the critic found

Every folder up (High 6.66, motion 6.47, legends 6.80, Low 6.27, phone 6.51), minimums up to 4.5 to 5.5; the
Firstlight rose "the script's best-delivered row". Still no frame at 8 and no vista at 9. Worst: `j-kindle-1`
(4.5), a peach haze over the near plane as the kindled lamps catch; phone `z4590` (4.5), the results lens
crops the hero's head; `i-finish-2` and `i-finish-lantern` (5), the great lantern cropped off the top or in a
corner behind the depth of field, a halo arc in the sky, red fireworks; `f-road-2`, `h-lip3-0` (5), the dash
and flow light bleaching the rider. Recurring: the moon's 22 degree halo as a giant arc, stone posts as boxes,
paper windows clipped flat, the near snow without sparkle, the Cloud Sea six frames of the same murk, Low's
carried flame white and its pools pink, the motion run's sled a white card (the garage's), ghosts over the
rider and the rider small in wides (shared).

## Pass 5: what the critic found (the last pass)

High 6.49, motion 6.38, legends 6.73, Low 6.23, phone 6.66; minimums 4.5 to 5.5; no frame at 8, no vista at 9.
The stopping rule's second arm ends the loop here (five passes). Worst: `h-lip3-0` and `h-lip3-1` (4.5, 5),
the rider washed by the flow's own glow and its after-images on a landing; `f-road-2` (5), the same flow
state; `i-finish-2` (5), the lantern lights while the lens faces the line; Low `z2850` and phone `z4590` (5),
a lip between the lens and the rider, and the results lens cropping the head. Recurring as in pass 4, plus the
snow's new glints read as glitter in three frames, the great lantern a dull grey egg before it lights, and
Low's fog cards showing a hard edge in the Cloud Sea.

## What changed after pass 1, and why

Commits bc73ef8, ed46f32, a5dc105 (the first agent's work, finished and committed) and 0f1e284.

- **No glass on a night of small lights** (`post.ts` `GradeParams.glass`, `palette.ts` `Grade.glass`,
  Lanternfall 0.15). The fringe, the punch's colour split and half the speed streaks scale by it; every other
  grade leaves it out and is unchanged. *Why:* each lantern split into a red, a green and a blue one at speed.
- **The finish no longer washes to cream.** The climax's lights on Lanternfall lay a third of their light, its
  two beams a fifth (`climaxworld.ts`, `lay`); the line's light check is a lilac a value under the snow
  (`places.ts` `finishLine`); the finish place's bloom is 0.2 lower and its exposure 0.94 of the journey's.
  *Found by:* holding the sled at the line and hiding one layer at a time: the cream was the line's paint and
  the stands in warm light under the journey's bloom, then smeared by the finish kick's motion blur.
- **The night is a value darker.** Snow lit #E8EAFC to #D4D6F4 (shade #685CC0 to #5E52B8), exposure 1.08 to
  1.0 (the deck's stop 1.08 to 1.0, Firstlight's 1.1 to 1.02). *Why:* the snow was the brightest thing in a
  night frame, brighter than the lamps, and the moon's rim could not be read on it. `tests/lanternworld.test.ts`
  now holds the lit snow between 0.65 and 0.75 in luminance.
- **The carried flame is marigold and off the coat** (never white-gold; smaller, its halo a third, its light on
  the rider under half), so it no longer bleaches the vermillion.
- **The guide light, the Tall Lamplighter's lane and the great lantern**: the lane's light on the snow under
  half; he is drawn 1.4 times larger in a lighter robe, 27 m ahead; the great lantern lights in a third of a
  second at 1.9 and its light is marigold, not white-gold.
- **Painted detail.** Standing stones carry two more courses with snow on their ledges; paper panes are graded
  (bright low, amber under the rail) and carry a rail and a bar, so a pane is four of paper in a lattice.
- **The river of lights exists.** The canal's bank test asked for a shoulder wider than its far kerb, which no
  metre of the course has, so no reach was ever built; it now asks for an open bank of 7 m (`CANAL_E` 13,
  `CANAL_W` 5.5), and its floats are larger.
- **The break.** Hamlets on the valley floor (eighteen wide pools of lamplight with a few windows, drawn last so
  a full budget never drops the guide light); the valley's lanterns larger in every band; the deck's underside
  rose-violet and the sky's band halved; the valley's haze warm.
- **The cloud sea** reads as cloud, not one more snowfield: its lit value is nearer the cloud's violet, its
  billows finer, the warm pools half as strong again.
- **The title rides the break** (`keyart.ts`: 1490 to 2050 m, the light at 1600, the lens nearer). The
  valley and the cloud now follow the reel's own metres on the title.
- **The depth of field turns its spiral at each pixel** (`postfx/lens.ts`). A light behind the focus was printed
  as the spiral's eight dots; turned, they fill a soft disc. One line, every mountain.
- **Low:** the lights' glow leans amber on Lanternfall (lemon before); the poster flames have a soft edge.

## What changed after pass 2, and why

Commit 96c4b7d.

- **No green tails on lights at speed** (`post.ts`, every mountain). The punch and the corner fringe set red
  and blue from the unstreaked frame, so inside the speed streaks only green kept its smear: every small light
  trailed a green tail and led with a magenta head, which the critic read as chromatic aberration in calm
  frames and as mint in the sky. They now add their split to the streaked colour as a difference. *Found by:*
  `?post=` with one switch at a time at the break: only `lens` (the fringe) made the tails, although its
  offset is a tenth of a pixel. Same result where there is no streak; one more texture read while either is on.
- **A beat's flash has a grade dial** (`GradeParams.flash`, `Grade.flash`; Lanternfall 0.3). The perfect
  landing's and the stomp's white lift bleached the rider to cream on a night frame (`a-crown-1`, `h-lip3-0`).
- **The great lantern hangs over the square, 28 m before the line** (`GREAT_Z`). The finish lens swings round
  to a three-quarter front and looks back up the run: 36 m past the line, the lantern was behind it in every
  finish and results frame. Its light on the square is softer (36 m, 0.3), and the climax's line light on
  Lanternfall is an eighth of the stock one: in a won run the two together flooded the square peach at the line.
- **The moon in the frame**: at 9.5 degrees and 17 to the right (it stood at the top edge or under the HUD at 15),
  and the lens character round it a third (`lens` 0.1).
- **Lights that pass the lens shrink away sooner** on Lanternfall (`uNearFade` 5.5 to 9 m, stock 3 to 5.2): at
  night a light is the brightest thing in the frame and filled a corner as a flat slab.
- **Shapes of its own, no lintels.** The kilometre arch is two stone lamp pillars with lit heads and the string
  of lanterns between them (`meshes.ts kmArchGeometry`, its own cache key); a street is entered between two
  lamp towers with a string of lanterns (`town.ts`); the lift station is a plum timber hall on stone, its
  windows lit paper in a lattice, a lantern storey on its roof, timber towers on the line (`places.ts
  liftPiece`): in white plaster with a grid of glass it read as a block of flats on the Crown. The fork's
  gantry has ink timber, a lit paper board under an eave and a lantern at each post (`rails.ts`).
- **Stones with the moon on their edges**: Lanternfall's standing stones, rows, marker stones and stone lamps
  take a material with a strong cool rim (0.7), so an ink stone has a silver edge and is not one flat value.
- **The Tall Lamplighter has a robe**: a dark hem, five folds, a bronze cord with a small lantern on it, the
  other sleeve hanging long.
- **The valley's near lanterns stay near**: a sixth of them drift slowly (0.5 to 1.4 m/s) through the first 26
  to 70 m beside the run, so a frame at the break holds paper lanterns at the rider's height, not only dots.
  Low draws them as round dabs (squares read as pixels); Low's cloud sea has half the warm pools (lava).
- **A river of lights you can see**: the canal's painted lights are three times the area with long streaks,
  four in five lit, a cell every 4 m; the channel 6.5 m; 72 floats on High (44), 36 on Medium (24).
- **The Cloud Sea is firmer**: fog from 7 m (2), shade a value deeper, bloom 0.62 (0.85), contrast 1.1 (1.02),
  lamps 1.3 (1.5).
- **Grade by place after the break**: the Lamp Road has less of the sky's light between its lamps (hemi a value
  down, lamps 1.3) and the break's air is lit rose-violet; Firstlight is a different hour, the air lighter and
  bluer, the shade a cold blue-violet, the rim rose, the lamps back to 1.05.
- **Low's lights are marigold** (a warmer skin on the flame, `lightGeometry(great, warm)`).

## What changed after pass 3, and why

Commit 7e7dd78.

- **No hole in the cloud under the first flight** (`b-lip1-2`, 3.5). The cloud sheets drew from 26 m under
  their top; on the dive the slope stood up through them and cut a hard rounded hole. They now show only from
  4 m above their top and are gone 50 m into the cloud. *Found by:* hiding one root at a time in the pool
  rider's flight: only `lantern.root` took it away.
- **Fireworks at the line no longer flood the square** (`i-finish-2`, 4). Each burst pushes a light 150 m
  wide at up to 3.1; in a won run the volley timed to the line lit the square and the snow peach.
  `Fireworks.lightK` takes the grade's flash dial (world.ts sets it wherever it sets the grade): 0.3 here,
  1 on every other mountain.
- **Ghosts quieter against the night**: ghost glow 1.1 (1.6) at the Crown, 1.2 (1.75) under the deck, 1.6 (2.6)
  in the cloud. A ghost near the lens was a mint blaze over the rider and in the lantern sky.
- **Lamps lay pools of marigold on the snow** (Medium and High): each way lamp within 150 m lays an 11 by 12 m
  pool reaching 3 m in toward the line. The local light alone fell off before the line.
- **Firstlight reaches rose**: the last stop of the journey comes in from 3650 m (3900) and is full at 4300
  (4460), the band wider and the sky's middle rose-violet, so the leap into Firstlight and the town are under it.
- **The break's valley is lit, not a hole**: the dome's below under the deck is a dusky violet (#4A3268) and a
  rose-violet at the break (#644678), so the lanterns stand in their own lit haze.
- **The cloud a value under white** (fog #9A92D8, lit snow #E0DEFA) so the lamps' halos loom out of it, and the
  cloud sea's shade a mid violet, not navy (it read as a frozen lake).
- **The lift station is a stone stem with its lit hall at the top**, and the gates' posts are lamp posts with a
  cord between their heads (`pillarGeometry`, `gateBeamGeometry` take Lanternfall's): two posts and a lintel
  read as torii.
- **No balloons over Firstlight** (its sky is the lanterns').
- **Near lights have no card**: every sprite's halo now reaches nothing inside the point's circle (a near flame
  on the phone was a glowing rectangle); Low's painted flame is marigold, not a white triangle.

## What changed after pass 4, and why

Commit 61128e4.

- **The valley under the break is lit air, not a hole.** Each far lantern mote covered 85% of the air behind it
  before adding its light; thousands of them made the lit haze under the deck a navy hole full of dots (the
  dome's own below was not it: lifting it changed nothing). A far mote now covers 28%; a near paper lantern
  still covers what is behind it.
- **No halo ring**: the moon, in the frame since pass 3, drew the 22 degree halo as a ring across the sky
  (`atmo.halo` 0).
- **The near snow has the moon's glints** (`sparkle` 1.7, 1.15): the near plane was a featureless lilac wash.
- **Kindled lamps flare in the lamp**: the catch's burst is 1.3 (2.4) and a stone lamp's light is capped at 1.15
  (1.9). A row catching at once washed the near plane peach (`j-kindle-1`, 4.5).
- **A dash and the spirit pulses light the rider less** (`SpiritFx.lightK`, at least 0.5, from the grade's
  flash): a dash's white-gold light washed the rider to peach (`f-road-2`, `h-lip3-0`).
- **No red in the fireworks** on Lanternfall (`Fireworks.noRed`: vermillion stars marigold, coral ones lilac):
  the rider's vermillion is the one red here.
- **The great lantern hangs 3 m lower** (foot 6.5 m), toward the middle of the results lens.
- **The cloud's halos loom larger** (a far glow 4.6 times its size in the cloud, 3.6) and the guide light's
  halo 9 m (6.5).
- **Paper panes under the clip** (0.62 to 0.84 of lit paper, 0.8 to 1.1), so a pane's grade reads instead of
  rolling off to one flat orange.
- **Low's lights keep their hue at full value**: no tone curve there, so a flame or a lantern over 1 was a white
  shape; it is now divided down to its brightest channel.

## Shared code touched

- `src/render/post.ts`: `GradeParams.glass` and `GradeParams.flash` (default 1, no change where they are left
  out); the punch and the fringe add their colour split as a difference (every mountain: no green tails in the
  speed streaks; identical where there is no streak).
- `src/render/postfx/lens.ts`: the gather's spiral turned per pixel (all mountains, High and Ultra's depth of
  field; no cost beyond one hash a pixel of the half-frame pass).
- `src/render/palette.ts`: `Grade.glass`, `Grade.flash` and their defaults; everything else Lanternfall's own rows.
- `src/render/climaxworld.ts`: a Lanternfall factor on the climax's lights and beams (`lay`).
- `src/render/places.ts`: `finishLine` takes the light check's colour (cream unless Lanternfall); `liftPiece` has
  a Lanternfall look; no balloons over Lanternfall's finish town.
- `src/render/props.ts`: on Lanternfall only, small obstacle kinds cast no shadow, its stones take a moonlit
  material, its lights shrink from further out and glow amber on Low, its km arches are built and cached apart.
- `src/render/meshes.ts`: `kmArchGeometry(span, lantern)`, `lightGeometry(great, warm)`, `pillarGeometry(p, lantern)`,
  `gateBeamGeometry(p, lantern)` (defaults unchanged); `obstacleGeometry` gives Lanternfall its pillar.
- `src/render/fireworks.ts`: `lightK` (1 unless a grade says otherwise) on the bursts' light; `noRed` (off unless
  world.ts sets it for Lanternfall).
- `src/render/spirit.ts`: `lightK` on the pulses' and a dash's light (1 unless a grade's flash is under 1).
- `src/render/world.ts`: sets `spirit.fireworks.lightK`, `spirit.lightK` and `spirit.fireworks.noRed` where it sets
  the grade.
- `src/render/rails.ts`: `signGeometry(bold, lantern)` (default unchanged).
- `src/render/life.ts`: no birds on Lanternfall.
- `src/render/town.ts`: Lanternfall's crest keeps every other back lot; its street gates are two lamp towers.
- `src/game/keyart.ts`: Lanternfall's title shot.

## The title (after the last pass)

`keyart.ts` (commit 9fdb645): the break from 1540 to 1950 m, the light at 1600, the desk lens r 4.8, up 1.3, sweep
0.4, ahead 40, lift 0.6, no crane. Chosen from four lenses shot with `?debug&m=4&k*`: the rider in the air over
the valley of rising lanterns with the peak behind it, and the duel partner swung out of the frame (with the old
lens it stood beside the hero, and the hero was cut by the frame's foot; pass 5 scored `k-title-0` 6 and
`k-title-1` 7). The phone's lens is unchanged and looked right. No critic saw the new title: it is my call.

## What is still short (five passes, the stopping rule's second arm)

No frame reached 8 and no hero vista 9. Pass 5's means are 6.2 to 6.7 a folder; pass 4's were 6.3 to 6.8.
The critics changed every pass and each found the next layer, so the numbers move less than the frames did
(set `sheet-before.png` beside `sheet-after.png`).

- **(4) The great lantern lit over the square, about 5.5.** The lantern lights at the line, but the finish lens
  swings round the rider and then holds on it low, so no frame shows the lit lantern composed over the square
  with the rider: it is behind the lens at the crossing, and a glow at the frame's edge or behind the depth of
  field in the results. Moving it before the line and lower got it into the results frame's corner, not more.
  It needs a camera beat (the hero lane's `camera.ts` finish shot, or a held look up at it as it lights), and
  before it lights it reads as a dull grey drum.
- **(2) The break, about 7 (7.5 in the Great Rising).** The valley now stands in lit air, but the lanterns are
  still read as dots and confetti, not paper lanterns at a range of sizes; the deck overhead is never in frame
  (the lens looks down the valley); the rider is small in the held wide (the camera's) and blurred in the
  directed shot.
- **(3) The Lamp Road, about 7 (7.5).** No critic saw a river of lights in any frame. The canal exists on the
  open banks and its lights are now large, but no fixed or played frame looks along it, and the bridges span
  snow (the river is not under them). Stone posts and the sim's standing stones still read as boxes.
- **(1) The Crown, about 7.** The cloud sea still reads as a flat frozen lake from the run; the moon is in the
  frame but is not read as the key light on the snow or the rider.
- **The hero.** The flow state's glow and after-images still wash the rider to peach on a landing (`h-lip3-0`,
  4.5, the worst frame of pass 5), the rider is small in wides and aerial frames, and the phone's lower third is
  empty: the rider's materials and the camera are the hero lane's.
- **Shared things the critics marked down here:** the played run's sled is a blank white card (the garage
  sled's material), ghosts drawn over the rider and into the lantern sky, a kicker's lip hiding the rider
  (`z2850` on every tier), the results lens cropping the rider's head on a phone (`z4590`), Low's fog cards
  showing a hard edge in the Cloud Sea, and the fork's sign boards as flat graphics (kept: they are the route's
  legend).
- **The snow's glints** (sparkle 1.7, pass 4's fix) read as glitter in three of pass 5's frames: one to re-tune.

## Cost

Measured from the fixed set's JSON (`frames.js`, `renderer.info` summed over a frame's passes, 30 m/s, the
lane's builds, headless on the shared GPU). The race state round the sled differs a little run to run (ghosts in
view), so a frame moves by one to three draws between runs of the same build.

| Tier | Pass 1 | Pass 2 | Pass 3 | Pass 4 | Pass 5 |
| --- | --- | --- | --- | --- | --- |
| High, mean calls / triangles | 103 / 947k | 99 / 914k | 100 / 920k | 100 / 922k | 99 / 924k |
| High, worst | 111 / 1,125k | 109 / 1,106k | 108 / 1,109k | 108 / 1,108k | 110 / 1,107k |
| Low, mean | 51 / 144k | 51 / 127k | 50 / 127k | 51 / 126k | 51 / 128k |
| Low, worst | 55 / 195k | 57 / 181k | 57 / 177k | 58 / 180k | 59 / 180k |
| Phone (Medium), mean | 94 / 659k | 89 / 631k | 89 / 638k | 90 / 632k | 90 / 635k |

- **High** is four draws lighter and 2 to 3% fewer triangles than pass 1, still about 4 over the brief's 95, and
  four frames (3450 to 3581 m, the second street, and the square) pass a million triangles. Cuts: way-lamp posts
  drawn within 470 m of the rider (they were the whole mountain's, up to 46k triangles), the first street's back
  row thinned, no shadow from Lanternfall's small stones (four shadow draws where they stand), no birds, the
  canal only within 420 m. Added: the way lamps' pools on the snow (one draw where no set piece already lays
  pools, Medium and High), the gates' lamp towers and the panes' lattice (a few thousand triangles a street).
  What is left over 95 is the course's own furniture (terrain chunks, forest pairs, props' kinds, ghosts, post),
  which this lane did not cut.
- **Low** is unchanged in the mean and lighter in triangles (128k from 144k). Its worst frame is 3 to 4 draws
  over pass 1's at 3450 to 3500 m; nothing this lane added draws on Low there (the pools, the canal and the
  hamlets' windows are not drawn on Low; the gates, arches and station merge into their sites), so I read it as
  the race state, but it was not proven frame by frame.
- **Frame time** was not measured (the rules: six lanes share the GPU). Per pixel: one hash in the depth of
  field's half-frame gather, and one texture read in the composite while the punch or the fringe is on.

## What the main lane must wire, decide or re-tune

1. **Merge**: `post.ts` (the colour split as a difference, `glass`, `flash`), `postfx/lens.ts` (the turned
   spiral), `fireworks.ts` and `spirit.ts` (`lightK`, `noRed`) and their lines in `world.ts` are shared; the rest
   is behind `biome === 'lantern'` or Lanternfall's own rows. The green tails at speed were every mountain's: the
   other review lanes may have seen them as "chromatic aberration".
2. **Decide the finish beat for vista 4** with the hero lane: a look up at the great lantern as it lights.
3. **Re-tune after the merge**: the snow's glints (1.7), the way-lamp pools' strength, the valley's near band (a
   sixth of its lanterns now drift low and slow beside the run), the ghost glow (1.1 to 1.6).
4. **Cost on High** is about 99 draws mean; the course's shared furniture is where the rest is.

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\review\m4\`: `pass1` to `pass5` (each `high`, `low`,
`phone-medium`, `high-motion`, `high-legends`, and the reports `<tier>-m4.json`, `high-motion.json`,
`high-legends.json`), `pass2-stale` (the first agent's, never judged), `sheet-before.png` (pass 1) and
`sheet-after.png` (pass 5) at the same twelve distances and four played moments. The hero frames are in
`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\hero\m4\` (the Crown with the moon, the break in the Great
Rising, the title on desk and phone, the Lamp Road's street, Firstlight under the rose, the square).
`scripts/playtest/review-m4-all.sh <base> <out>` shoots a whole pass.
