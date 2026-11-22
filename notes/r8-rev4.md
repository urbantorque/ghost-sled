# Round 8, milestone 4: the review lane for Lanternfall (m4)

Branch `r8-rev4`, cut by hand from `round-8` at 9a93aa8. Render, UI scripts and data only: nothing in `src/sim`,
`src/bot` or the pools. Brief: `notes/r8-briefs/review.md` with N = 4. Frames are in the main checkout under
`shots/r8/review/m4/pass1` to `pass5` (git-ignored), each pass holding:

- `high/`, `low/`, `phone-medium/`: the 34 places of `frames-r7.json` that a demo-0 replay reaches as stills (4590 m lies
  past the line, where the run has left `run`; the finish is covered by the finish frames below);
- `motion/`: strips at the vistas and set pieces (eight frames four ticks apart) and six finish frames at 400 to
  6000 ms past the line (`m4-fin-*.png`, the results card hidden);
- `rising/`: the break's strips with The Great Rising forced (`&legend=1`);
- `sheets/`: what the critic read (strips tiled, Low and the phone four to a sheet, the finish);
- the JSON of every capture (console errors, each frame's draw calls and triangles, and for the finish the great
  lantern's place on screen).

One pass is `bash scripts/playtest/rev4-pass.sh <K> [base]` on a served build (it takes and gives the browser slot).

## How the loop ran

Five passes, each on a fresh build of the branch at that point, the captures held still by `stills.sh` (a pool rider,
demo 0, replayed on a virtual clock, the same ticks every pass). Each pass a new critic (general-purpose, Opus at high
effort) given only the frames' paths, the path of ART.md and the brief's instruction; never told what changed. The
stopping rule's second arm ends the loop: no critic gave a 9 or an 8 to more than one frame, and no hero vista reached 9.

A fresh critic moves a frame by about half a point on its own (DECISIONS 342), and these five ran in a band of about
half a point a tier: pass 5's critic was the harshest of the five (it scored frames that had not changed a third to
half a point under pass 4's). Read the trend with the frames, not alone.

One thing the round's own work changed under the frame list: the sim batch moved Lanternfall's break from 1568 to 1715 m,
so `frames-r7.json`'s "lip" at 1528 m and the strips I first placed at 1540 and 1600 were still inside the cloud in
pass 1. The strips moved to the real lip from pass 2 (1460, 1600, 1690, 1730 m); the fixed frames stay where they are.

## The scores, pass by pass

### Means and minimums

| Tier | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| High, the 34 stills: mean (min) | 6.72 (5.5) | 6.88 (5.5) | 6.75 (5.5) | 7.08 (6.0) | 6.56 (5.8) |
| High, the finish (6): mean (min) | 6.50 (6.0) | 7.25 (6.5) | 6.83 (6.0) | 7.25 (6.5) | 6.60 (5.6) |
| High, stills and finish (40) | 6.69 (5.5) | 6.94 (5.5) | 6.76 (5.5) | 7.10 (6.0) | 6.57 (5.6) |
| High in motion, strips: mean (min) | 5.93 (4.5) | 6.35 (5.5) | 6.38 (5.0) | 6.74 (5.5) | 6.22 (4.8) |
| Low: mean (min) | 6.32 (5.5) | 5.93 (5.0) | 5.97 (5.0) | 6.36 (5.8) | 5.98 (5.5) |
| Phone, Medium: mean (min) | 6.49 (5.5) | 6.19 (5.5) | 6.12 (5.0) | 6.35 (5.5) | 6.18 (5.6) |

Round 7's last pass on this mountain (DECISIONS 342): High 6.49 (5.5), motion 6.38, Low 6.23, phone 6.66.

### Hero vistas (the best frame of each, any tier)

| Vista | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| The opening, a crest over the cloud (ART.md 12, DECISIONS 372) | 7.5 | 7.5 | 7.5 | 7.2 | 6.8 |
| (1) The Crown over the cloud sea | 7.5 | 7.5 | 7.5 | 7.2 | 6.8 |
| (2) The break under the deck | 8.0 | 8.0 | 7.5 | 8.0 | 7.6 |
| (3) The Lamp Road with the river of lights | 7.5 | 7.5 | 7.5 | 7.6 | 6.8 |
| (4) The great lantern lit over the square | 7.0 | 7.5 | 7.5 | 7.6 | 7.1 |

No vista reached 9 in any pass. The best single frames: High z1800 (8, 8, 7.5, 8, 7.6), z3297 (7.5 to 8), z4061.

### Every frame, High

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0150 | 6.5 | 6.5 | 6 | 6.5 | 6 |
| z0300 | 7 | 6.5 | 6.5 | 6.6 | 6.8 |
| z0450 | 7 | 7.5 | 7 | 7.2 | 6.5 |
| z0565 | 7.5 | 7 | 7.5 | 6.8 | 5.8 |
| z0785 | 7 | 6.5 | 7 | 7 | 6.6 |
| z0900 | 6.5 | 6 | 6.5 | 6.3 | 6 |
| z0945 | 6 | 5.5 | 5.5 | 6 | 5.8 |
| z0991 | 7 | 6.5 | 7 | 7.3 | 6.8 |
| z1050 | 5.5 | 6 | 6 | 6 | 5.8 |
| z1138 | 6.5 | 6.5 | 6.5 | 6.5 | 6 |
| z1200 | 6.5 | 6.5 | 6.5 | 6.7 | 6 |
| z1350 | 6.5 | 6.5 | 6 | 6.5 | 6 |
| z1528 | 6 | 7 | 7.5 | 7.5 | 7.3 |
| z1650 | 7 | 7.5 | 7.5 | 7.6 | 7.1 |
| z1800 | 8 | 8 | 7.5 | 8 | 7.6 |
| z1938 | 7.5 | 7.5 | 7 | 7.4 | 7 |
| z2059 | 7 | 7 | 6.5 | 7 | 6.4 |
| z2209 | 5.5 | 6.5 | 6 | 7 | 6 |
| z2405 | 6.5 | 7.5 | 7 | 7.4 | 6.8 |
| z2550 | 6.5 | 7 | 6.5 | 7.2 | 6.5 |
| z2700 | 7 | 7.5 | 7.5 | 7.3 | 6.8 |
| z2850 | 6.5 | 6.5 | 6.5 | 7 | 6.4 |
| z3000 | 7 | 7 | 7 | 7.4 | 6.6 |
| z3150 | 7.5 | 7.5 | 7 | 7.6 | 7 |
| z3297 | 7.5 | 8 | 7.5 | 7.9 | 7.6 |
| z3450 | 7 | 6.5 | 6.5 | 7.2 | 6.8 |
| z3500 | 6.5 | 6.5 | 6.5 | 7 | 6.8 |
| z3581 | 5.5 | 6 | 5.5 | 6.8 | 6.2 |
| z3750 | 5.5 | 6 | 6 | 6.4 | 6 |
| z3940 | 5.5 | 7 | 6.5 | 7.2 | 6.5 |
| z4061 | 8 | 7.5 | 7.5 | 7.8 | 7.2 |
| z4200 | 7.5 | 7.5 | 7.5 | 7.8 | 7 |
| z4330 | 6.5 | 7.5 | 7 | 7.2 | 6.6 |
| z4440 | 7.5 | 7.5 | 7.5 | 7.5 | 6.9 |
| fin-00400 | 6.5 | 6.5 | 6 | 6.5 | 5.6 |
| fin-01200 | 6.5 | 7.5 | 7 | 7.3 | 6.6 |
| fin-02200 | 6.5 | 7.5 | 6 | 7.2 | 6.6 |
| fin-03400 | 6.5 | 7 | 7 | 7.4 | 6.8 |
| fin-04500 | 6 | 7.5 | 7.5 | 7.6 | 7.1 |
| fin-06000 | 7 | 7.5 | 7.5 | 7.5 | 6.9 |

### Strips (High in motion)

Pass 1's break strips stood at 1540 and 1600 m, in the cloud (the lip had moved, above); from pass 2 they are at the
lip. `r` is the same run with The Great Rising forced.

| Strip | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0080 (the opening) | 7 | 6.5 | 6.5 | 7 | 6.2 |
| z0450 | 6.5 | 7 | 7 | 7 | 6.4 |
| z0565 (the dive) | 6.5 | 6 | 6 | 6 | 5.4 |
| z1000 (the Cloud Sea) | 5.5 | 5.5 | 6 | 5.8 | 5.8 |
| z1300 | 6 | 6 | 6 | 6.2 | 5.8 |
| z1460 (the cloud lets go) | - | 6 | 6.5 | 6.6 | 6.3 |
| z1540 (in cloud, pass 1 only) | 6 | - | - | - | - |
| z1600 | 5 | 6.5 | 7 | 7.3 | 6.8 |
| z1690 (the whip) | - | 6 | 6 | 6.4 | 6 |
| z1730 (over the break) | - | 7.5 | 7 | 7.9 | 7 |
| z2209 (kindle) | 5 | 6.5 | 6.5 | 6.5 | 6 |
| z2600 (the bridge of lights) | 6.5 | 6.5 | 6.5 | 6.6 | 6.2 |
| z3297 | 7.5 | 7.5 | 7.5 | 7.8 | 7.4 |
| z3500 (the street) | 6.5 | 6.5 | 6 | 7 | 6.6 |
| z3950 (the last leap's approach) | 4.5 | 5.5 | 5 | 5.5 | 4.8 |
| z4300 (carry, the square's barrier) | 5.5 | 5.5 | 5.5 | 6 | 5.4 |
| r z1540 / z1600 (pass 1, in cloud) | 6 / 5 | - | - | - | - |
| r z1600 | - | 6 | 6.5 | 7.2 | 6.6 |
| r z1730 | - | 7 | 7 | 7.7 | 7 |

### Every frame, Low and the phone

| Frame | Low P1 | P2 | P3 | P4 | P5 | Phone P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| z0150 | 6 | 6 | 6 | 6.6 | 6 | 6.5 | 6 | 6 | 6.3 | 6.2 |
| z0300 | 6.5 | 5.5 | 6.5 | 6.3 | 6.3 | 6.5 | 5.5 | 6 | 5.8 | 6.4 |
| z0450 | 7 | 7 | 6.5 | 6.8 | 6.3 | 7 | 7 | 6.5 | 6.8 | 6.6 |
| z0565 | 7 | 6.5 | 6.5 | 6.6 | 5.6 | 6.5 | 6.5 | 6.5 | 6.5 | 6 |
| z0785 | 6.5 | 6 | 6 | 6.3 | 6 | 6.5 | 6 | 6 | 6 | 5.8 |
| z0900 | 6 | 5.5 | 5.5 | 6 | 5.6 | 6 | 5.5 | 5.5 | 5.8 | 5.8 |
| z0945 | 6 | 5.5 | 5.5 | 5.8 | 5.5 | 6 | 5.5 | 5.5 | 5.5 | 5.6 |
| z0991 | 6 | 5.5 | 6 | 6 | 5.6 | 6 | 6 | 6 | 6.2 | 6 |
| z1050 | 6 | 5.5 | 5.5 | 5.8 | 5.5 | 5.5 | 5.5 | 5.5 | 5.8 | 5.6 |
| z1138 | 6.5 | 6 | 6 | 6 | 5.8 | 6.5 | 6 | 6 | 6 | 5.8 |
| z1200 | 6 | 5.5 | 5.5 | 6 | 5.6 | 6.5 | 6 | 6 | 6 | 5.8 |
| z1350 | 6 | 6 | 6 | 6 | 5.8 | 6.5 | 6 | 6 | 6 | 5.8 |
| z1528 | 6 | 6.5 | 6.5 | 6.8 | 6.2 | 6 | 6.5 | 6.5 | 6.6 | 6.4 |
| z1650 | 6.5 | 5.5 | 6 | 6.6 | 6 | 6.5 | 6.5 | 6.5 | 6.8 | 6.4 |
| z1800 | 7 | 6 | 6 | 6.8 | 6.4 | 7.5 | 6.5 | 6.5 | 6.8 | 6.6 |
| z1938 | 6.5 | 6.5 | 6.5 | 6.8 | 6.3 | 7 | 6.5 | 6.5 | 6.6 | 6.3 |
| z2059 | 6.5 | 6 | 6 | 6.3 | 6 | 6.5 | 6 | 6 | 6.2 | 6.2 |
| z2209 | 5.5 | 6 | 5.5 | 6 | 6 | 5.5 | 6.5 | 5.5 | 6 | 6.2 |
| z2405 | 6.5 | 6.5 | 6.5 | 6.8 | 6.3 | 6.5 | 7 | 6.5 | 6.8 | 6.6 |
| z2550 | 6.5 | 6 | 6 | 6.3 | 6 | 6 | 6 | 6 | 6.3 | 6 |
| z2700 | 6.5 | 6.5 | 6.5 | 6.7 | 6.4 | 7 | 7 | 6.5 | 6.8 | 6.4 |
| z2850 | 6.5 | 5.5 | 5.5 | 6 | 6 | 6 | 5.5 | 5.5 | 5.8 | 5.6 |
| z3000 | 6 | 6 | 6 | 6.4 | 5.8 | 6 | 6 | 6 | 6.3 | 6 |
| z3150 | 7 | 6.5 | 6.5 | 6.9 | 6.3 | 7 | 6.5 | 6.5 | 6.8 | 6.5 |
| z3297 | 7 | 6.5 | 6.5 | 6.9 | 6.4 | 7 | 7 | 6.5 | 6.9 | 6.5 |
| z3450 | 6.5 | 5.5 | 5.5 | 6.4 | 6.2 | 6.5 | 6 | 6.5 | 6.3 | 6.2 |
| z3500 | 6.5 | 5.5 | 5.5 | 6.4 | 6.3 | 6.5 | 6 | 6.5 | 6.6 | 6.6 |
| z3581 | 6 | 5.5 | 5.5 | 6.5 | 6 | 7 | 6.5 | 6.5 | 6.7 | 6.4 |
| z3750 | 5.5 | 5 | 5.5 | 6 | 5.8 | 6 | 5.5 | 5 | 5.8 | 5.6 |
| z3940 | 5.5 | 5 | 5 | 5.8 | 5.6 | 7 | 6.5 | 6.5 | 6.7 | 6.4 |
| z4061 | 6 | 6 | 6 | 6 | 5.6 | 6 | 6 | 6 | 6 | 6 |
| z4200 | 7 | 6.5 | 6.5 | 6.8 | 6.3 | 7.5 | 7 | 6.5 | 6.9 | 6.6 |
| z4330 | 5.5 | 5.5 | 5.5 | 6 | 5.6 | 7 | 6.5 | 6 | 6.5 | 6.4 |
| z4440 | 7 | 6.5 | 6.5 | 6.8 | 6.2 | 6.5 | 5.5 | 6 | 6.9 | 6.8 |

## What each critic named, and what I did

### Pass 1 (High 6.72, strips 5.93, Low 6.32, phone 6.49)

Named worst: the wall ride at 3940 m, where spires and stones passing the lens went milky over the rider (strip 4.5); the
break never opening on camera (the cloud still closed at 1528 to 1600 m); flat yellow quads over the rider at 2209 and
3750 m (the ward's broken lantern); a translucent second sled under the rider in the cloud (1050 m); toy heads at the
lens in Firstlight's street (3581 m). Also: the great lantern cut by the results frame's top edge and a dim brown barrel
before it lights; the rider with no rim in the cloud; Low's cloud sea read as dark water or lava; the lift station on the
Crown as an office block; flips unreadable from behind; label clutter.

Fixed (commits 796afaa to c00c29d, 0b3cabb):

- **The break opens where ART.md 15 puts it.** The cloud followed the break's lip, which the sim batch had moved to
  1715 m, so it closed over the run to 1635 m and the colour script's "about 1500" was ridden blind. It now lets go as the
  Cloud Sea's set piece ends: `CLOUD_BREAK` 80 to 260 m with `cloudLetGo()` (never sooner than 360 m into the cloud nor
  later than 80 m above the lip, for a Daily), used by the palette's place, `cloudDepth`, the valley's show and the way
  lamps. The run comes out under the deck at about 1455 m with the valley opening ahead, and the whip still lands on it
  open. `tests/lanternworld.test.ts` holds the cloud gone by 1520 m. Moved 1528 m from 6 to 7 to 7.5, 1650 m 7 to 7.5.
- **No milky glass at the lens** (shared, `materials.ts`): with MSAA coverage (High, Ultra, the phone's Medium) a prop's
  near and line-of-sight fade wrote its whole 0..1 into coverage, which the rebuild held as a see-through slab for metres;
  it now goes through the same narrow middle of the fade the dither uses: solid, then gone (ART.md 12).
- **The ward breaks into paper, not cards** (shared, `wardfx.ts`): the broken shards are lit paper with amber torn edges
  (`#FF9E1A`, ART.md 14), every other panel flies (25, not 50), they live 0.6 to 0.95 s (0.85 to 1.35), and none draws
  within 1.6 to 4.2 m of the lens.
- **A dash's after-images faint at night** (`Rider.echoK` from the grade's flash dial, as `spirit.lightK` is): on
  Lanternfall 0.35. Added white-gold over the cloud read as a milky second sled.
- **The rider is rimmed in the cloud and under the moon**: a palette `heroRim` (1 everywhere) drives the rider's key-light
  rim (`uHero.y`); Lanternfall 1.4, the Cloud Sea 2.1.
- **The cloud sea on Low**: Low draws the floor sheet alone, at the floor's value; it takes the crests' light, and a warm
  pool over it mixes toward the lit value (peach, not maroon). The warm pools quieter on High.
- **The great lantern**: banked at 0.34 (0.14), a lamp turned down rather than a dark cage; 14 m past the line (35), since
  a slow finisher stopped under it.
- **The lift station on the Crown** (`places.ts liftPiece`, Lanternfall only): coursed stone with snow on each course and a
  hall of lit paper in a timber lattice, no row of windows.
- **The street's front row** (shared, `crowd.ts`): figures go whole from 5 m to 3.4 m (1.8 to 3.6).

### Pass 2 (High 6.88, finish 7.25, strips 6.35, Low 5.93, phone 6.19)

The break now opened; named worst: the Cloud Sea's walls as smeared slabs in one milky value on every tier; the wall
ride at 3940 m still; the 3750 m bridge piers as dark boxes; the crowd stippled at the lens; the great lantern still cut
by the top edge in the results; a white glare pool beside the sled on Low in the cloud; the kilometre pillars as boxes
capped with orange cubes; the FINISH board's back blown out to a cream slab over the results; the snowboarder on the bank
built of boxes.

Fixed (34eea43 to ee91362):

- **The great lantern is let down on its chains** (`GREAT_DROP` 3.6 m) as the lamplighters walk it off the run, which it
  only does once the rider is under and past it. Measured from the lens in the results (`rev4-motion.js` probe): its
  paper's middle from NDC y 0.99 and 0.88 to 0.78 and 0.70, in the top third over the rider.
- **The Cloud Sea's near walls keep their own value** (fog from 12 m, 7).
- **Low's guide-light wake** at 0.45 of High's (it clipped to white with no tone curve); Low's valley 2100 lanterns (1500).
- **The kilometre pillars** (`meshes.ts kmArchGeometry`, Lanternfall's branch): two string courses with snow, a head of
  paper graded from its flame up in a timber frame.
- **The FINISH board** on Lanternfall is a lilac paper a step under cream (`places.ts finishArch`).
- **The skier and the bank's snowboarder** (shared, `life.ts`): a tapered coat, round limbs and head, arms out.
- **The ward's broken flakes** a little over half a panel's size.

### Pass 3 (High 6.75, finish 6.83, strips 6.38, Low 5.97, phone 6.12)

Named worst: the 3950 m wall ride; Low's stippled stone at 3940 m; the bleached lower frame at 3750 m; the crowd at the
lens; the Cloud Sea's walls. Also: the valley's lanterns read as dots and bokeh, never paper; the cloud sea from the Crown a
mottled sheet; the climax strings over the FINISH board's letters on the phone.

Fixed (89f3994 to 7bdc40b):

- **Paper lanterns** in the valley material: ribs, palest at the waist, rounding away at the sides, an ink cap, foot and
  tassel where a lantern is big enough to read; the near band 8 to 68 m off the run (11 to 81) and 2.6 to 4.4 m tall.
- **The cloud sea from the Crown**: billows two thirds the size with a stronger moonlit rim, the warm pools at 0.55 (0.75);
  Low's floor lit further, its shade a step lighter.
- **The Cloud Sea** a step deeper (fog `#8E86D2`), bloom 0.5 (0.62), contrast 1.16 (1.1).
- **Lanternfall's climax strings stop 70 m short of the line** (40), so none hangs across the board (`climaxworld.ts`,
  Lanternfall only).
- **The dither's middle a third as wide** (shared, `materials.ts`): a prop that dithers out at the lens spends a third as
  long stippled.

### Pass 4 (High 7.08, finish 7.25, strips 6.74, Low 6.36, phone 6.35: the best of the five)

Named worst: the 3950 m wall ride; the Cloud Sea's walls (Low included, so in the walls themselves, not the blur); the
plank by the sled at 300 m; the 3750 m piers as black striped boxes with paper quads over a bleached foreground. The far sea
from the Crown still read as dark water on Low.

Fixed (d5f28ac to d5c0949):

- **The far sea's gaps** (`massif.ts paletteSea`, gated on a moonlit sea with warm pools: Lanternfall's alone; Ember's smoke
  sea has no moon and keeps its dark gaps) open onto the cloud's own shade, not the night's navy.
- **The bridge of lights' piers** (`lanternkit.ts lightBridgePiece`): a lantern storey and roof on each, and a slot of lit
  paper up the face toward the run.
- **Way-lamp pools** a fifth stronger on Medium and High.

### Pass 5 (High 6.56, finish 6.60, strips 6.22, Low 5.98, phone 6.18)

The harshest critic: frames unchanged since pass 4 scored a third to a half point lower. It named the same layer: the 3950
m wall ride (4.8), the dive's pine under the sled at 565 m, the crowd at the lens on a barrier scrape (4300 m), the Cloud
Sea's one value, the pale quad over the finish line's checks at 400 ms. Still box-read: the 3750 m piers ("office blocks"),
a black cube at 2209 m, the tower at 450 m. No changes after pass 5 (the last).

## Cost

From the stills' JSON (`renderer.info` summed over a frame's passes; the same ticks every pass):

| Tier | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| High, mean calls / triangles | 110.8 / 931k | 110.6 / 932k | 110.7 / 943k | 110.5 / 939k | 110.4 / 939k |
| High, worst (3297 m) | 121 / 971k | 121 / 975k | 121 / 983k | 121 / 985k | 120 / 983k |
| Low, mean | 53.1 / 128k | 53.0 / 128k | 53.0 / 129k | 53.0 / 128k | 52.7 / 128k |
| Low, worst (3450 m) | 61 / 144k | 61 / 143k | 61 / 144k | 61 / 143k | 61 / 145k |
| Phone (Medium), mean | 94.0 / 640k | 93.9 / 640k | 93.9 / 646k | 93.6 / 647k | 93.8 / 645k |

- Draws level on every tier; triangles +0.9% on High and +0.8% on the phone (the lift station's courses and lattice, the
  pillars' courses, the piers' storeys, the round snowboarder), level on Low. The worst High frame is the base's.
- **Low's GL calls a frame** (`glcount.js`, a live ride, two runs each; the round-8 base 9a93aa8 built from the tree and
  served on the same port): the opening (warm 8 s, about 200 to 560 m) base 511.9 and 493.0, final 494.3 and 502.6; the
  break (warm 48 s, about 1680 to 2130 m) base 494.6 and 496.2, final 496.6 and 495.5. Draw calls 22.3 to 24.8 on both,
  76 programs on both. Level within the ride's spread; no new uniform upload.
- No new draw, program, pass, texture or uniform array; nothing before the first frame. Per pixel: a handful of ALU in the
  valley's paper lanterns (only where a point is over 4 px) and in the cloud sheet (unchanged sample count).
- Not measured: `?gpu` pass times and Low's script at 6x (the machine was shared all day; the quiet sitting is the main
  lane's).

## Shared code touched

- `src/render/materials.ts`: the toon fragment's near fade. Coverage (MSAA) path: `keep = smoothstep(0.42, 0.58, keep)`
  before the discard; dither path: band 0.475 to 0.525 (0.42 to 0.58). Every mountain: a prop at the lens is solid then
  gone, never milky or stippled for metres.
- `src/render/wardfx.ts`: every mountain's ward. Torn amber edges on the broken paper, every other panel flies, shorter
  lives, 0.6 of a panel's size broken, nothing within about 2 m of the lens.
- `src/render/rider.ts`: `echoK` (after-images, 1 unless the grade's flash is under 1) and `setHeroRim()` (the palette's
  `heroRim`, 1 by default).
- `src/render/world.ts`: four lines beside each `spirit.lightK` set: `rider.echoK` and `rider.setHeroRim`.
- `src/render/palette.ts`: `Palette.heroRim` (default 1), `CLOUD_BREAK` 260 and `cloudLetGo()`; the rest is Lanternfall's
  own rows.
- `src/render/crowd.ts`: the crowd's near fade 3.4 to 5 m (1.8 to 3.6): every street's front row.
- `src/render/life.ts`: the skier and snowboarder figure (`skier()`), every mountain: rounded parts, arms on the board.
- `src/render/massif.ts`: one line in `paletteSea`, gated on `seaWarm > 0 && moon` (Lanternfall only).
- `src/render/climaxworld.ts`: the strings' stop 70 m short on Lanternfall, 40 elsewhere (unchanged).
- `src/render/places.ts` (`liftPiece`, `finishArch`), `src/render/meshes.ts` (`kmArchGeometry`'s Lanternfall branch),
  `src/render/lanternkit.ts` (`lightBridgePiece`): Lanternfall's branches only.
- `scripts/playtest/stills.js`: each still's draw calls and triangles in its JSON (the brief asks for cost from the
  frames' JSON and stills recorded none). New: `scripts/playtest/rev4-motion.js`, `rev4-pass.sh`.

## What is still short, and why

No frame reached 9 and no hero vista 9; the stopping rule's second arm ends the loop after five passes. The numbers moved
less than the frames: pass 4's critic scored High 7.08 with a minimum of 6, pass 5's (harsher) 6.56 on near the same build.

- **The Cloud Sea (785 to 1450 m), 5.5 to 6.5 on every tier in every pass.** One lilac value with the ravine walls as long
  stretched slabs. Low shows the same streaks with no blur, so it is in the walls' geometry and paint (the ravine's bare
  ground and banks), not only High's edge blur. Deeper fog, nearer full colour and a rim on the rider moved it little. It
  needs the walls cut as bedded rock with painted strata (ART.md 3) and a way lamp's halo as the frame's light; Lanternfall
  has no bare-ground set of its own in ART.md 4's table (it takes Pinecrest's summit strata).
- **The last leap's approach (3940 m, strip 3950: 4.5 to 5.5).** The demo rider wall-rides into the leap's outcrop of dark
  spires; the lens goes in among them. The coverage fix stopped the milky slabs; the spires still cross the lens whole. A
  bank outcrop is placed by the leap's kit; moving it is a sim-adjacent layout change, and the lens on a wall ride is the
  camera's (shared).
- **(2) The break, best 7.5 to 8.** It now opens on the valley in every pass from 2 on. Still: the thousands read as dots
  (the near ones are paper lanterns now; the far are motes by design and by budget), the rider is small under the hero
  frame's letterbox, and **The Great Rising cannot be told from a plain run in any pass** (doubling, faster, a fifth
  larger is too little at these sizes, or the legend's peak falls outside the strips: not traced).
- **(3) The Lamp Road, best 7.5.** No critic ever saw the canal of floating lights: no fixed frame or strip looks along it
  (as round 7 found). The stone avenue reads as bollards from the chase lens (the sim's obstacles, ink by ART.md 1), and
  three frames there catch the demo rider inverted in a flip (the trick poses are the play lane's).
- **(4) The great lantern, best 7.5 to 7.6.** It is now in the results frame over the rider (measured), lit, with shafts.
  The critics want shells (a demo-0 finish is sixth of six: ART.md 16 gives an ordinary finish no festival) and read the
  lit drum as a flat orange lattice.
- **The opening and the Crown, 7.5 falling to 6.8.** The cloud sea from above still reads as a mottled sheet, and the
  crest frame (150 m) is the high place shot with a small, tumbling rider; at 300 m the run is a trough.
- **Shared things every critic named here, not this mountain's to fix:** the street lens at low speed (3450, 3500 m: the
  rider half the frame), flips and grabs unreadable from behind (2059, 2550, 2850, 3000 m), trick callouts in the same
  pill as a ghost's name (2209 m), the pale quad over the finish line's checks at the crossing (it carries the runners'
  grooves, so it looks like the sled's rut drawn over the painted line, `trails.ts`; not traced), a black snow-capped
  cube by the sled at 2209 m (not traced),
  the dive at 565 m landing over a pine's tip (the course's dressing under the flight), the snowboarder's pose.
- **The cairn "Cinder Rest"** on Lanternfall (an Ember-sounding name from `graveyards.ts`' one list): not changed, since
  the names are hashed per mountain and a change moves every mountain's.

## For the main lane to decide or merge with care

1. **`materials.ts`'s near fade** (both paths) changes every mountain's props at the lens: solid then gone. It answers
   ART.md 12 as written; other review lanes may have touched the same lines.
2. **`wardfx.ts`** changes every mountain's ward (fewer, smaller, shorter-lived paper with torn amber edges). The events
   lane's look; judged here only on Lanternfall's night.
3. **`CLOUD_BREAK` 260** changes where Lanternfall's cloud ends (about 1455 m, not 1635) for the title too
   (`keyart.ts` rides 1540 to 1950 m on the break: it is now out of the cloud throughout, which is what it was chosen for
   before the sim batch moved the lip; not re-shot).
4. **`crowd.ts`** front rows go at 5 m on every mountain's street.
5. Not this lane's but named every pass: the finish line's rut quad, the street lens at low speed, the flip poses from
   behind, the Cloud Sea walls' geometry.
6. **My preview server and scratch builds**: stopped at the end; `dist/r8-rev4*` and the untracked `rev4/` (logs, the
   score sheet `rev4/scores.json`, the base tree used for the GL count) are in the worktree and can go.

## Text for DECISIONS (the main lane's)

"Lanternfall's review (milestone 4, m4): five passes, a fresh critic each. High 6.72 (5.5) to 7.08 (6.0) at pass 4 and
6.56 (5.8) under pass 5's harsher critic; motion 5.93 to 6.74, then 6.22; Low 6.32 to 6.36, then 5.98; the phone 6.49
to 6.35, then 6.18 (round 7 ended at 6.49, 6.38, 6.23, 6.66). No frame a 9, no vista a 9; the break 8, the great lantern
7.6, the Lamp Road 7.6, the Crown and the opening 7.5. Landed: the cloud lets go as the Cloud Sea ends (about 1455 m, not
1635: the sim batch had moved the lip and the break was ridden blind); props at the lens solid then gone, never milky or
stippled (every mountain); the ward's paper broken into fewer, smaller, torn flakes (every mountain); the great lantern
let down and in the results' top third; the valley's near lanterns paper with ribs and caps; the rider rimmed in the
cloud; Lanternfall's lift station, kilometre pillars, bridge piers and FINISH board as lit paper and coursed stone, not
boxes. Short: the Cloud Sea's walls (one milky value with stretched facets on every tier), the last leap's wall ride
among spires, the canal never seen, The Great Rising indistinguishable from a plain run. Draws level, triangles +0.9%
on High, Low's GL calls level with the base."

## Text for ART.md 15 ("Lanternfall as built", round 8)

"The cloud lets go as the Cloud Sea's guide light leaves the run, about 300 m above the break's lip (wherever the course
puts the lip), so the last of the high ground is ridden out under the deck with the valley opening ahead and the whip
lands on it open. The valley's near lanterns are paper with ribs, palest at the waist, under an ink cap and over a foot
and tassel. The rider is rimmed by the moon on the Crown and more strongly in the cloud, where the light has no side.
The great lantern, walked off the run, is let down on its chains so that in the results it burns in the top third over
the rider. The lift station is coursed stone under a hall of lit paper; the kilometre pillars carry string courses and a
graded paper head; the bridge of lights' piers carry a lantern storey and a slot of light; the FINISH board is lilac
paper."

And ART.md 12 ("Nothing fills the frame's side as a shard"): "Whatever fades at the lens fades through the middle of its
fade in a few centimetres of travel, whether by dither or by coverage: solid, then gone."

## Text for the README

"Round 8's review of Lanternfall: the break opens where the colour script has it again (the cloud ends with the Cloud
Sea), the great lantern burns over the rider in the results, the valley's near lanterns are paper, and nothing at the lens
turns to milky glass. High at 6.6 to 7.1 under five critics, no frame a 9: the Cloud Sea and the last leap's approach are
the weakest stretches."
