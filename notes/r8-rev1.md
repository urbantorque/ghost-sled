# Round 8, milestone 4: the critic loop on Frostfang Glacier (review lane m1)

Lane `r8-rev1`, worktree `.claude/worktrees/r8-rev1`, port 4871, cut from `round-8` at `9a93aa8`. The brief is
`notes/r8-briefs/review.md`: round 7's loop (DECISIONS 342) on round 8's final build, five passes at most.

Frames are under `shots/r8/review/m1/pass<K>/` in the main checkout: `high/`, `low/`, `phone-medium/` (the 35 places of
`frames-r7.json` that a replayed run reaches, as stills that hold the run still, `stills.js`), `strips/` (eight frames
1/15 s apart on High at the vistas and set pieces: 200, 1230, 2300, 2650, 3400 and 3880 m), the Low and phone contact
sheets the critic read, and each set's JSON (console, and each frame's draw calls and triangles: the lane's copy of
`stills.js` reads `renderer.info` over the last frame stepped). `glcount-low-w8.json` and `-w100.json` are Low's GL
calls a frame over 10 s from the start (about 200 to 560 m) and from about 3400 m (the cavern's mouth to the bridge).

## How each pass ran

- A build in the heavy slot, served on 4871; the captures in one browser slot (`rev1/capture.sh`: High and Low stills,
  the strips, the phone, Low's GL count, the sheets), the slot given back as soon as the browser closed. The lane's
  scripts wait until the main lane holds neither slot for two minutes running before they take one, since a sitting gives
  a slot back and takes it again between its phases.
- A fresh critic each pass (general-purpose, `opus`, effort high), told only the frames' paths, ART.md's path and the
  brief's instruction (`rev1/critic-prompt.txt`, the same words every pass).

## Pass 1 (`9a93aa8`, round 8 as merged)

Console clean on every set.

| Group | Mean | Min |
| --- | --- | --- |
| High (35) | 6.6 | 4.5 (2250) |
| Low (35) | 6.2 | 4.0 (2250) |
| Phone, Medium (35) | 6.5 | 5.0 (3000) |
| Strips (6) | 6.8 | 5.5 (1230) |

High, frame by frame: 150 7, 300 6, 450 7.5, 595 7, 750 6.5, 900 6, 975 5.5, 1045 6, 1195 5.5, 1343 7, 1500 5,
1550 6.5, 1650 7, 1800 5.5, 1917 6.5, 2137 6.5, 2250 4.5, 2297 7, 2405 5.5, 2548 6, 2700 7.5, 2783 7.5, 2850 6, 3000 7,
3154 6, 3304 6, 3418 5.5, 3549 8, 3600 8, 3750 8, 3940 8.5, 4050 7.5, 4200 8, 4330 7, 4440 7.

Low: 150 6.5, 300 6, 450 7, 595 6, 750 6, 900 6, 975 5.5, 1045 6, 1195 5.5, 1343 6.5, 1500 5, 1550 6.5, 1650 6.5,
1800 5.5, 1917 6.5, 2137 7, 2250 4, 2297 6.5, 2405 5.5, 2548 6.5, 2700 6.5, 2783 6.5, 2850 5, 3000 6, 3154 5.5, 3304 6,
3418 5, 3549 7.5, 3600 7.5, 3750 7.5, 3940 7, 4050 7.5, 4200 6.5, 4330 6.5, 4440 7.

Phone: 150 7, 300 6.5, 450 7, 595 6.5, 750 6, 900 6.5, 975 6.5, 1045 6.5, 1195 6, 1343 6.5, 1500 5.5, 1550 6.5,
1650 7, 1800 5.5, 1917 6.5, 2137 7, 2250 5.5, 2297 7, 2405 6, 2548 6, 2700 6.5, 2783 6.5, 2850 6, 3000 5, 3154 5.5,
3304 6.5, 3418 6.5, 3549 7, 3600 7, 3750 7.5, 3940 6.5, 4050 7.5, 4200 7, 4330 7, 4440 7.

Strips: 200 7, 1230 5.5, 2300 6.5, 2650 6.5, 3400 7.5, 3880 8.

Hero vistas (none a 9): the opening's canyon under the arch 7 (150); Serac Gate's span 7 (1343); the aurora over the
Crevasse Fields 7.5 (2700, 2783); the cavern mouth at sunrise 8 (3549, already out: no fixed frame stands on the mouth);
the Fang at dawn from the last leap 8.5 (3940, the best frame of the run).

What it named, worst first: 2250 (the lens beside the bank in a wall ride, the race's gondola crossing the top of the
frame as a smeared red block); 1500 (a ward's shards as flat marigold cards a fifth of the frame wide, over the
picture); the phone's 3000 (the kilometre arch's beam across the lens); 3418 (two gate lanterns hanging 5 to 7 m ahead
as great blocks over the top of the frame, and a gold floor down the cavern); the crevasse and canyon walls as
"stretched, smeared facets" in about a dozen frames on every tier; the dawn's snow lilac-grey, never rose-gold; the
aurora flooding the floor one teal with no violet; milky parapet pillows on the ice spans; white plinth rings under the
seracs; a landing's veil as a milky sheet at night (3154); radial shafts over the near snow at dawn; Low's pools as hard
white ovals; boxes for buildings; flipped or tiny riders in the pool rider's tricks.

### After pass 1

Worst first among what the lane can reach.

- **The crevasse walls** (`materials.ts`, the snow shader's bare ground, only the fluted ice, `uRockStyle.z` 1, which is
  Frostfang's alone). A wall's mesh is stretched up a face 30 m tall, so its own flat facets were the long smears of
  light and dark the critic named in a dozen frames on every tier. Near the lens the fluted ice now keeps a fifth of the
  mesh's facets (every other cut keeps its 0.6) and the painted shards carry the form: wider and taller (2.4 m by 9.5 m,
  were 1.8 by 8.5), each tilted a step harder, and the pale fractures down their splits wide enough to read past the lens.
- **The aurora** on the snow covers less of the floor (its curtains from 0.3 to 0.6 of the noise, were 0.22 to 0.52), so
  the violet shade shows between them (`key2`, Frostfang's alone).
- **The Ice Cavern**: the place's lamps at 1 (were 1.35), so a gate's light is a pool in the dark and not a gold floor;
  the gates' lanterns that hang over the lens dissolve over ART.md 14's last 7 m (solid to 7.4 m, gone by 6.6 m; a bell
  or a paper wheel by the snow, which the rider meets, keeps round 8's 4.4 to 5.2: `momentkit.ts`, shared, below).
- **The dawn** (`JOURNEY`, the last stop): the light a step more gold (`#FFBE90`), the lit snow `#FFD2B2`, the rim
  `#FFC89C`, the air `#9A86BE`, the highlights' split `#FFE0C2`; the sun's shafts at 0.7 and its rays at 0.8, so the
  radial streaks stay in the air over the bridge and the last leap and off the near snow. (A warm bounce tint under the
  coat was tried and dropped: with the lilac shade it went to the grudge's rose, `tests/lift.test.ts`.)
- **The night's sled lantern** at 0.4 and 0.42 (were 0.55 and 0.6): a landing's veil of powder inside its light went to one
  milky sheet over the lower frame.
- **Low's pools** on Frostfang a paler, warmer step of the snow, kept under white (`poolSoft` 0.8, as Ember's 1): they were
  hard white ovals in Fang Town.
- **The ice span's parapet** (`places.ts`, Frostfang's ice only): clear blue blocks in two values (`#78B4E6`, `#A6D4F4`),
  where the span's two palest blues read as milky pillows.
- **The seracs' drift** (`meshes.ts seracGeometry`, Frostfang's alone): off to the lee side, smaller, where a drift all round
  the foot read as a white plinth under each.
- **A ward's shards** (`wardfx.ts`, shared): a broken panel flies as a flake six tenths its size, and a shard thins out
  inside 5 m of the lens and is gone by 2.5 m; they were flat marigold cards a fifth of the frame wide.
- **The race's cabin** (`marqueeworld.ts`, shared): once the rider has passed it (1 to 14 m behind) it goes whole while it
  is beside the chase lens, as a tree behind the rider does; level or ahead, it stays.

Not done, and why: the lens inside the bank in a wall ride (2250; `camera.ts`'s wall-ride step, every mountain's, and the
pool rider's line); the kilometre arch's beam over the phone's lens at 3000 m (every mountain has that frame); flipped and
tiny riders (the replayed pool rider's own tricks); Station Street's and Fang Town's houses as boxes, the cavern's vault
bays as stacked cubes and the span's missing abyss (geometry too big and too shared for a review lane); the dash's
after-images (the events lane's).

## Pass 2 (`7fd14da`)

Console clean on every set.

| Group | Mean | Min |
| --- | --- | --- |
| High (35) | 6.96 | 5.5 (2250, 3304) |
| Low (35) | 6.46 | 5.0 (2250, 3418) |
| Phone, Medium (35) | 6.63 | 5.0 (3000) |
| Strips (6) | 6.67 | 5.5 (1230) |

High: 150 7, 300 7, 450 7.5, 595 7.5, 750 7, 900 7.5, 975 6.5, 1045 7, 1195 6.5, 1343 7.5, 1500 7, 1550 7, 1650 6.5,
1800 6.5, 1917 6, 2137 7, 2250 5.5, 2297 7.5, 2405 6, 2548 6.5, 2700 7.5, 2783 7.5, 2850 6.5, 3000 7, 3154 6.5,
3304 5.5, 3418 6, 3549 7.5, 3600 8, 3750 8, 3940 8, 4050 7, 4200 7.5, 4330 7, 4440 7.5.

Low: 150 6.5, 300 7, 450 7, 595 6.5, 750 6.5, 900 7, 975 6, 1045 6.5, 1195 6, 1343 6.5, 1500 5.5, 1550 6.5, 1650 6.5,
1800 6, 1917 6, 2137 6.5, 2250 5, 2297 6.5, 2405 6, 2548 6.5, 2700 6, 2783 6.5, 2850 6, 3000 7, 3154 6.5, 3304 6,
3418 5, 3549 7, 3600 7, 3750 7.5, 3940 7, 4050 7.5, 4200 7, 4330 6.5, 4440 7.

Phone: 150 6.5, 300 7.5, 450 7, 595 6.5, 750 6.5, 900 7.5, 975 6.5, 1045 7, 1195 6.5, 1343 6.5, 1500 6.5, 1550 7,
1650 7, 1800 6.5, 1917 6.5, 2137 7, 2250 6, 2297 7, 2405 6.5, 2548 6, 2700 7, 2783 7, 2850 6.5, 3000 5, 3154 5.5,
3304 6.5, 3418 5.5, 3549 7, 3600 7, 3750 7, 3940 6.5, 4050 7.5, 4200 6.5, 4330 6.5, 4440 7.

Strips: 200 7.5, 1230 5.5, 2300 6, 2650 6.5, 3400 7.5, 3880 7.

Hero vistas (none a 9): the opening 7.5 (strip 200); the span 7.5 (1343); the aurora 7.5 (2700, 2783); the cavern mouth
7.5 (3549; no frame on the mouth itself); the Fang at dawn 8 (3940, 3600, 3750).

Every High mean rose but the strips' (6.6 to 6.96; Low 6.2 to 6.46; phone 6.5 to 6.63): the ward's shards (5 to 7), the
walls' frames (300 6 to 7, 900 6 to 7.5), the parapet (1343 7 to 7.5). What it named now, worst first: shafts over the
near snow in most dawn frames and the phone's lower half (and Low's painted shaft cards, even at night); the walls still
"huge stretched flat facets with no fractures"; 3418's floor still a gold carpet and its lanterns now "flat blocks with
jagged tops" (the pixel-by-pixel height test cut through them); 3304's vault masses floating as cubes over an upright
rider who hides the mouth; the phone's 3000 arch beam; the hero frame over the last leap (4050) lost to depth of field;
the Fang a straight slab, not a curved needle; the ice floor's cracks a hexagon grid at 2700.

### After pass 2

- **The walls, again** (`materials.ts rockCells`, the fluted ice only): each flute split along its own diagonal drew long
  thin triangles up a 30 m face, and that, not only the mesh, was the "stretched facets". The ice is now upright flutes,
  each with a face turned to the light and one from it, broken across into drums at uneven heights (2.2 m wide, about
  6.5 m tall), with pale fractures along some breaks and down some seams.
- **Shafts stay in the air** (`postfx/shafts.ts`, shared): the first 8 m from the lens take none of a shaft's light and it
  comes in by 30 m, ART.md 12's "never on the near snow". Low's painted shaft cards on Frostfang at half (`poster.shafts`
  0.5).
- **The Ice Cavern's floor**: the place's lamps at 0.7 (1 still ran the gates' pools into one gold floor). The overhead
  lanterns' dissolve is measured at each lantern's own origin, so a lantern goes whole, never cut through with a ragged
  top.

## Pass 3 (`ef256e8`)

Console clean on every set.

| Group | Mean | Min |
| --- | --- | --- |
| High (35) | 6.81 | 5.0 (2250) |
| Low (35) | 6.11 | 4.5 (2250) |
| Phone, Medium (35) | 6.16 | 5.0 (2250, 3000) |
| Strips (6) | 6.58 | 6.0 (1230, 2650) |

High: 150 7, 300 7, 450 7.5, 595 7.5, 750 7, 900 7, 975 6.5, 1045 7, 1195 6, 1343 7.5, 1500 6.5, 1550 7, 1650 8,
1800 5.5, 1917 6.5, 2137 6.5, 2250 5, 2297 7.5, 2405 6, 2548 6.5, 2700 7.5, 2783 7.5, 2850 6, 3000 7, 3154 6.5,
3304 6.5, 3418 6.5, 3549 7, 3600 7.5, 3750 7.5, 3940 7, 4050 5.5, 4200 7.5, 4330 7, 4440 7.

Low: 150 6.5, 300 6.5, 450 6.5, 595 6, 750 6, 900 6.5, 975 6, 1045 6.5, 1195 5.5, 1343 6.5, 1500 6, 1550 6, 1650 7,
1800 5.5, 1917 6, 2137 6, 2250 4.5, 2297 6.5, 2405 5.5, 2548 6, 2700 6, 2783 6, 2850 5.5, 3000 6.5, 3154 6.5, 3304 6,
3418 6, 3549 6.5, 3600 6.5, 3750 7, 3940 6.5, 4050 6, 4200 5.5, 4330 6, 4440 6.

Phone: 150 6.5, 300 6.5, 450 6.5, 595 6, 750 6, 900 6.5, 975 6, 1045 6.5, 1195 5.5, 1343 6.5, 1500 6, 1550 6.5,
1650 7, 1800 5.5, 1917 6, 2137 6, 2250 5, 2297 7, 2405 5.5, 2548 5.5, 2700 6.5, 2783 6.5, 2850 6, 3000 5, 3154 6,
3304 6.5, 3418 5.5, 3549 6, 3600 6.5, 3750 6.5, 3940 6, 4050 6.5, 4200 6.5, 4330 6.5, 4440 6.5.

Strips: 200 7.5, 1230 6, 2300 6.5, 2650 6, 3400 7, 3880 6.5.

Hero vistas (none a 9): the opening 7.5 (strip 200); the span 7.5 (1343); the aurora 7.5 (2297, 2700, 2783); the cavern
mouth 7 (3549); the Fang at dawn 5.5 at its own frame (4050, the hero frame over the last leap, "depth of field turns the
whole vista to mush"; its approaches 3750 at 7.5 and 3940 at 7).

This critic was the harshest of the three on Low and the phone (6.11 and 6.16), and every mean fell a little. Read
against pass 2 frame by frame, two things are this lane's: the fluted ice read as "stripes" and, from the air at 1195, "a
plaid tile grid" (1195 6.5 to 6, 900 7.5 to 7: the cut is back to pass 2's); and the near-snow shafts were still there,
because the composite's own screen-space shafts (round 6's, under the depth-marched ones) still laid 30% of their light
below the horizon. The rest moved by about the half point a fresh critic moves a frame on its own.

### After pass 3

- **The walls back to pass 2's cut** (diagonal shards 2.4 m by 9.5 m, a fifth of the mesh's facets): the fluted drums lost.
- **Shafts off the near snow, the other half** (`post.ts`, shared): the screen-space shafts lay a tenth of their light under
  the horizon, not 0.3. The dawn's lens ghosts at 0.1 (one lay as an orange disc on the near snow).
- **The dawn's key light at 25 degrees** (was 20; the disc and the shadows' height unchanged), so more of the slope facing
  down the run takes the rose-gold and less sits mauve on the shade's side.
- **The hero frame's depth of field at half** (`camera.ts HERO_DOF` 0.5, shared): over the last leap, at a beat's full blur
  the town and the Fang were unreadable.
- **The overhead lanterns go by 8.2 m** (were 6.6): at 6.6 a gate's pair still filled the top of the cavern frame.
- Tried and dropped: Fang Town's pools as warm lifts of the snow (`poolSilver` in the finish place) to answer Low's white
  ovals; the hours lane's test keeps silver pools to Lanternfall, and the ovals are left for the main lane (Low's painted
  pool steps are shared).

## Pass 4 (`f92758f`)

Console clean on every set. (Its first critic was cut off by a usage limit; a fresh one judged the same frames.)

| Group | Mean | Min |
| --- | --- | --- |
| High (35) | 6.83 | 5.0 (3304) |
| Low (35) | 6.21 | 5.0 (2250, 3304) |
| Phone, Medium (35) | 6.33 | 4.5 (3000) |
| Strips (6) | 6.58 | 5.5 (1230) |

High: 150 7, 300 6.5, 450 7, 595 7, 750 6.5, 900 7.5, 975 6.5, 1045 6.5, 1195 6, 1343 7.5, 1500 7, 1550 6.5, 1650 7,
1800 6, 1917 6, 2137 7.5, 2250 5.5, 2297 7.5, 2405 6, 2548 6, 2700 7.5, 2783 7.5, 2850 6.5, 3000 7, 3154 6, 3304 5,
3418 6.5, 3549 7.5, 3600 8, 3750 8, 3940 7.5, 4050 7.5, 4200 7.5, 4330 7, 4440 7.

Low: 150 6, 300 6.5, 450 6.5, 595 6.5, 750 6, 900 6.5, 975 6, 1045 6.5, 1195 6, 1343 6, 1500 6, 1550 6.5, 1650 6.5,
1800 5.5, 1917 5.5, 2137 6.5, 2250 5, 2297 6.5, 2405 5.5, 2548 6.5, 2700 6.5, 2783 6.5, 2850 5.5, 3000 6.5, 3154 6.5,
3304 5, 3418 6, 3549 6.5, 3600 7, 3750 7, 3940 6.5, 4050 6.5, 4200 6.5, 4330 6, 4440 6.5.

Phone: 150 6.5, 300 6, 450 7, 595 6.5, 750 6, 900 6.5, 975 6.5, 1045 6, 1195 6.5, 1343 6.5, 1500 6.5, 1550 6.5, 1650 7,
1800 5.5, 1917 6, 2137 7, 2250 5.5, 2297 7, 2405 6, 2548 5.5, 2700 6.5, 2783 6.5, 2850 6, 3000 4.5, 3154 5.5, 3304 6.5,
3418 6, 3549 7, 3600 6.5, 3750 7, 3940 6.5, 4050 6.5, 4200 6.5, 4330 6.5, 4440 7.

Strips: 200 7, 1230 5.5, 2300 6.5, 2650 6.5, 3400 7, 3880 7.

Hero vistas (none a 9): the opening 7 (150, strip 200); the span 7.5 (1343); the aurora 7.5 (2700, 2137, 2297, 2783);
the cavern mouth not in any frame (3549 7.5 just out of it, the bridge at 3600 8, the best on the mountain); the Fang at
dawn 7.5 at its own hero frame (4050, was 5.5: the halved depth of field reads now, though "the Fang and the town melt to
one lilac value").

Against pass 3: the walls back to pass 2's held (900 7 to 7.5, 2137 6.5 to 7.5, 1195 6); 4050 rose two points; 3304
fell to 5 (the pool rider standing at the lens in front of the cavern's entrance: the same tick every pass, this critic
named it worst). No critic named shafts on the near snow this pass; it named the radial streaks on the phone's lower half
and "milky" night frames (1800, 2548, 3154: the dash's glow and the landing's veil blooming), the dawn's snow still mauve
at 3549 (the cavern's violet lets go over 85 m and still lay on the bridge 26 m past the mouth), and a flat lilac panel
past the last leap's lip (3750, 3940: the landing below the lip, seen from above in one value).

### After pass 4

- **The cavern lets go over 62 m** (was 85; the places' blend test, no step over 0.2 between neighbouring metres, allows no
  less), so the dawn is the dawn on the bridge out of the mouth and not the cavern's violet. A place that lets go faster
  than a roof steps the re-blend stamp finer (`laidPlaces`, shared, only where a place sets `fall` under 75: this one).
- **The night's bloom at 0.5** (was 0.7, Frostfang's polar night and the deep night after it).

## Pass 5 (`1a2d65f`), the last

Console clean on every set.

| Group | Mean | Min |
| --- | --- | --- |
| High (35) | 6.94 | 5.5 (2250) |
| Low (35) | 6.27 | 5.0 (2250) |
| Phone, Medium (35) | 6.37 | 5.0 (3000) |
| Strips (6) | 6.50 | 5.5 (1230) |

High: 150 7, 300 6.5, 450 7, 595 6.5, 750 6.5, 900 7.5, 975 6.5, 1045 7, 1195 6.5, 1343 7.5, 1500 6.5, 1550 7, 1650 7.5,
1800 6.5, 1917 6, 2137 7, 2250 5.5, 2297 7.5, 2405 6, 2548 6.5, 2700 7.5, 2783 7.5, 2850 7, 3000 7, 3154 6.5, 3304 6.5,
3418 7, 3549 7.5, 3600 8, 3750 7.5, 3940 7, 4050 7, 4200 7.5, 4330 7.5, 4440 7.5.

Low: 150 6.5, 300 6.5, 450 6.5, 595 5.5, 750 6, 900 6.5, 975 5.5, 1045 6.5, 1195 5.5, 1343 6.5, 1500 6, 1550 6.5,
1650 6.5, 1800 5.5, 1917 6, 2137 6.5, 2250 5, 2297 6.5, 2405 5.5, 2548 6.5, 2700 6, 2783 6.5, 2850 6.5, 3000 6.5,
3154 6, 3304 6, 3418 6.5, 3549 7, 3600 7, 3750 6.5, 3940 6.5, 4050 6.5, 4200 6.5, 4330 6.5, 4440 7.

Phone: 150 6.5, 300 7, 450 7, 595 6, 750 5.5, 900 7, 975 6.5, 1045 6.5, 1195 6, 1343 6.5, 1500 6.5, 1550 6.5, 1650 7,
1800 5.5, 1917 6, 2137 6.5, 2250 5.5, 2297 7, 2405 6, 2548 5.5, 2700 6.5, 2783 6.5, 2850 6.5, 3000 5, 3154 5.5, 3304 6.5,
3418 6, 3549 7, 3600 7, 3750 7, 3940 6.5, 4050 6.5, 4200 6.5, 4330 6.5, 4440 7.

Strips: 200 7, 1230 5.5, 2300 6.5, 2650 6, 3400 7, 3880 7.

Hero vistas (none a 9): the opening 7 (150); the span 7.5 (1343); the aurora 7.5 (2700, 2783, 2297); the cavern mouth
7.5 (3549, past it; 3418 inside at 7); the Fang at dawn 7 at the leap's own frame (4050: "the letterbox crops the Fang out
of its own vista") and 8 on the dawn span at 3600, the best frame on the mountain.

## All passes

Every critic was a fresh general-purpose agent on `opus` at high effort given the same words (`rev1/critic-prompt.txt`),
so unlike round 7's table the columns stand on one standard throughout; a fresh critic still moves a frame by about half a
point on its own, and pass 3's was much the harshest on Low and the phone.

| Pass | Build | High mean / min | Low | Phone | Strips | Opening | Span | Aurora | Cavern mouth | Fang at dawn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `9a93aa8` | 6.60 / 4.5 | 6.20 / 4.0 | 6.50 / 5.0 | 6.80 / 5.5 | 7 | 7 | 7.5 | 8 (3549) | 8.5 (3940) |
| 2 | `7fd14da` | 6.96 / 5.5 | 6.46 / 5.0 | 6.63 / 5.0 | 6.67 / 5.5 | 7.5 | 7.5 | 7.5 | 7.5 | 8 |
| 3 | `ef256e8` | 6.81 / 5.0 | 6.11 / 4.5 | 6.16 / 5.0 | 6.58 / 6.0 | 7.5 | 7.5 | 7.5 | 7 | 5.5 (4050), 7.5 (3750) |
| 4 | `f92758f` | 6.83 / 5.0 | 6.21 / 5.0 | 6.33 / 4.5 | 6.58 / 5.5 | 7 | 7.5 | 7.5 | 7.5 | 7.5 (4050) |
| 5 | `1a2d65f` | 6.94 / 5.5 | 6.27 / 5.0 | 6.37 / 5.0 | 6.50 / 5.5 | 7 | 7.5 | 7.5 | 7.5 | 7 (4050), 8 (3600) |

The stopping rule (no frame under 8, every hero vista 9) was not met; the lane stopped at five passes. High's mean rose from
6.60 to 6.94 and its minimum from 4.5 to 5.5; Low's from 6.20 to 6.27 (minimum 4.0 to 5.0); the phone ended a little under
its first pass (6.50 to 6.37: its 3000 and the night's dash frames, below, were never this lane's to fix) and the strips
level within a critic's spread. Against round 7's last pass on this mountain (DECISIONS 342: High 6.69 / 5.5, Low 6.50,
phone 6.72, under an `xhigh` critic) High is a quarter point up, Low and the phone a third to a half down.

What moved on High from pass 1 to pass 5: the ward at 1500 (5 to 6.5, 7 in passes 2 and 4), the opening's walls at 300
(6 to 6.5, 7 in passes 2 and 3), the slot at 900 (6 to 7.5), 975 (5.5 to 6.5), 1195 (5.5 to 6.5), 2850 (6 to 7), the
cavern at 3418 (5.5 to 7, its gold floor named less each pass), the wall ride at 2250 (4.5 to 5.5). What fell: 3940 (8.5
to 7, named every pass for its seracs' plinths and a lens disc) and 3750 (8 to 7.5).

## What changed for a player

- Serac Gate's and the Crevasse Fields' walls are cut ice, a few planes a step apart with pale fractures, where the wall's
  own stretched mesh drew long smears of light and dark. The aurora's green lies in curtains with the violet shade between.
- The Ice Cavern is dark with the gates' lanterns as pools of light in it, and a gate's lanterns leave the top of the frame
  before the lens passes under them. Out of the mouth the dawn is on the bridge at once.
- The dawn takes more of the slope in rose-gold light, its shafts stay in the air over the bridge and the last leap and off
  the near snow, and the hero frame over the last leap keeps the town and the Fang readable.
- The night's sled lantern and bloom are lower, so a landing's powder is snow and not a milky sheet.
- A ward breaks into smaller flakes that never fill the lens; a race's cabin the rider has passed never crosses the lens.
- The ice spans' parapets are clear blue blocks; the seracs' snow lies on their lee side.
- Low: Frostfang's pools a soft warm step (still read as ovals in Fang Town), its painted shaft cards at half.

## Cost

From the frames' JSON (mean over the 35 frames, draw calls and triangles summed over a frame's passes), pass 1 against
pass 5: High 109.4 calls (max 124), 965.0k triangles against 109.7 (max 124), 965.1k; Low 51.5 (max 61), 163.0k against
51.8 (max 61), 163.0k; the phone on Medium 90.9 (max 103), 657.4k against 90.9 (max 103), 658.8k. The run to run spread is
about a call (ghosts, particles). Low's GL calls a frame (`glcount.js`, 10 s on a real clock, so each window lands a few
tens of metres differently): from the start (about 205 to 550 m) 472.6 against 463.2; from about 3420 m (the cavern's
mouth, the bridge, the chute) 564.5 against 558.3. No draw, program, pass, texture or uniform was added on any tier, no
uniform array anywhere, nothing new before the first frame. The shaders gain a varying (a lantern's height over the lens,
a shard's distance to it) and a multiply or two; the cabin's test is two compares a cabin a frame. Frame rates were not
judged (the main lane's quiet sittings own them).

## Shared code touched

Each is small, and either a no-op off Frostfang or general and safe for the other mountains.

- `materials.ts` (snow shader, bare ground): the mesh's own facets keep 0.2 of the normal near the lens for the fluted ice
  only (`uRockStyle.z` 1, Frostfang's; every other cut keeps 0.4); the fluted ice's shard cut (tilt, crack width) and
  `ROCK.fang`'s cell (2.4 by 9.5 m); the aurora's curtain threshold (`uKey2`, set only on Frostfang's night).
- `momentkit.ts litMaterial` (every verb's lanterns, bells and wheels, the climax's lanterns, the legends' lit forms): what
  hangs over the lens (its origin 0.2 to 1.4 m over it) dissolves from 9 m and is gone by 8.2 m, measured at the form's
  origin; what is at or under the lens (a bell, a paper wheel) keeps round 8's 5.2 to 4.4 m. Other mountains' gate and
  street lanterns leave the top of the frame about 3 m sooner.
- `wardfx.ts`: a broken shard is 0.6 of its panel and thins out inside 5 m of the lens, gone by 2.5 m. Every mountain.
- `marqueeworld.ts`: a race's cabin 1 to 14 m behind the rider is hidden in a run (restored to its stage's visibility
  after). Every race.
- `postfx/shafts.ts`: the depth-marched shafts take nothing in the first 8 m and come in by 30. **The main lane has merged
  "no shaft light in the first 10 m" from another lane: keep one of the two, not both.**
- `post.ts`: the composite's screen-space shafts lay a tenth of their light under the horizon (was 0.3). Every mountain.
- `camera.ts HERO_DOF` 0.5: the slow hero frame's depth of field at half a beat's; `tests/camera.test.ts` now expects over
  0.45 where it expected over 0.9. Every mountain's tallest leap.
- `palette.ts laidPlaces`: a place that sets `fall` under 75 steps the re-blend stamp at 160 (only Frostfang's cavern does).
- `places.ts` (the ice span's parapet, `ice` styles only: Frostfang's) and `meshes.ts seracGeometry` (Frostfang's).
- Mountain data only (`palette.ts`): Frostfang's clear skies (`poolSoft` 0.8, Low's `poster.shafts` 0.5); the night stops
  (lantern 0.4 and 0.42, bloom 0.5); the dawn (light `#FFBE90`, lit snow `#FFD2B2`, rim `#FFC89C`, air `#9A86BE`, the split
  tone's `hi` `#FFE0C2`, the key light at 25 degrees, shafts 0.7, rays 0.8, lens 0.1); the cavern place (lamps 0.7, fall 62).

The merges since this lane was cut (the flipped hull in `rider.ts`, the warm-sky glaze tint and the props' near fade in
`materials.ts`, the shafts' first 10 m, the dash's after-images by the grade's flash) are not on this branch, so no frame
here shows them; several of this lane's last faults are theirs to answer: the sled's underside in every leap frame (595,
750, 1917, 2405) is the flipped hull's; the kilometre arch's beam over the phone's lens at 3000 may be the props' near
fade's; the dashing rider doubled and milky (1800, 2548, 2250) is the after-images'. `materials.ts` needs care at the
merge: this lane's lines are in the bare-ground branch, `ROCK` and the aurora block, not the glaze.

## Still short, and why

- **No hero vista reached 9 and no critic gave any frame a 9.** The best frames are the dawn span at 3600 (8 in every pass
  after the first) and 3750, then the bridge at 3549 and the aurora at 2700 to 2783 (7.5).
- **The cavern mouth is in no fixed frame.** 3418 is 80 m inside, 3549 26 m past the mouth; the reveal shot (`shots.ts`)
  turns to it in a real run, but no still lands there. `frames-r7.json` would need a frame at about 3505 m to judge ART.md
  15's "one image".
- **2250, the worst frame every pass:** the pool rider wall-rides the right bank while it dashes, and the lens sits beside
  the bank's face (a pale or blurred plane over a third of the frame). The wall ride's lens (`camera.ts`) is every
  mountain's and the dash is the events lane's; hiding the passed cabin moved it only half a point.
- **The span has no abyss** (strip 1230, 1195, 1343: "a road with rails"): the ground beside Serac Gate's bridge is level
  with its deck, and an abyss is a terrain change round a bridge, too big and shared for this lane (round 7 said the same).
- **The walls** read better (900 6 to 7.5) but still as "gradient facets" from the air (975, 1195, 2405, where the rider
  looks down a 30 m wall). What would lift them is geometry: walls built of shards, as `rockforms.ts` builds strata, not
  paint on the heightfield's stretched face. Upright flutes in paint were tried (pass 3) and read as a plaid.
- **The dawn's snow** still reads lilac-grey at 3549 to most critics; the cavern's grade now lets go as fast as the places'
  blend test allows.
- **Low:** white oval pools in Fang Town (Low's painted pool steps are shared; silver pools are Lanternfall's alone by
  `tests/hours.test.ts`); a leap's crowd and shoulders not drawn on Low (595, 3940); the cavern's lanterns few on Low.
- **Every mountain's:** the tricks seen from behind as the sled's underside; box houses in Station Street and Fang Town; the
  cavern's vault bays as stacked cubes from outside (3304); the stomp's shockwave read as a graphic over the near plane
  (150); powder billows as cotton balls (1045); radial streaks over the phone's lower half at speed; a flat lilac panel
  past the last leap's lip (3750, 3940: the landing seen from above in one value).

## Text for DECISIONS (the main lane's to place)

> **The critic loop on Frostfang, round 8** (`notes/r8-rev1.md`; frames `shots/r8/review/m1/`). Five passes, a fresh
> critic each (`opus`, high effort, the same words every pass). High 6.60 to 6.94 (minimum 4.5 to 5.5), Low 6.20 to 6.27,
> the phone 6.50 to 6.37, strips 6.80 to 6.50. No frame reached 9 and no hero vista did: the opening 7, Serac Gate's span
> 7.5, the aurora 7.5, the cavern mouth 7.5 (no fixed frame stands on it), the Fang at dawn 7 at the leap's hero frame and
> 8 on the dawn span (3600, the mountain's best). What changed: the crevasse walls as cut shards of ice (the wall's
> stretched mesh facets eased off, wider shards, fractures); the aurora's curtains narrower; the cavern's gates pools in
> the dark (its lamps at 0.7) and their lanterns gone from the top of the frame before the lens is under them; the cavern
> letting go over 62 m, so the dawn is on the bridge; the dawn's light more gold and its key higher; the night's lantern
> and bloom lower. Shared: shafts off the near snow (the screen-space ones under the horizon at a tenth), the hero frame's
> depth of field at half, a ward's shards smaller and gone near the lens, a passed race cabin hidden beside the lens.
> Tried and dropped: upright fluted ice (a plaid from the air), a warm bounce at dawn (the grudge's rose), Fang Town's pools
> in silver (Lanternfall's alone). Cost level on every tier. Short: the span's abyss and the walls want geometry; the
> cavern mouth wants a fixed frame; 2250's wall ride and the dash are every mountain's.

## Text for ART.md 15, Frostfang ("As built in round 8")

> **As built in round 8.** A crevasse wall is cut ice: a few planes a step apart in the wall's three values, a pale
> fracture down some of the splits, and none of the stretched faceting of the ground it stands on. The aurora lies on the
> snow in curtains with the violet shade between them, never one teal floor. In the Ice Cavern each gate is a pool of its
> light with the cobalt dark between, and the lanterns over the run leave the frame before the lens passes under them; the
> cavern's dark lets go within two seconds of the mouth, so the bridge out of it is the dawn. The dawn's key stands at 25
> degrees, gold enough that the slope facing down the run takes rose-gold, and its shafts hang over the bridge and the
> leap, never on the near snow. At night the sled's lantern is low, so a landing's powder is snow and not a sheet of milk.

And for ART.md 8 or 12 (shared): the slow hero frame's depth of field is half a beat's, so the valley the flight is over
reads; a shaft's light starts past the first 8 to 10 m from the lens; a ward's shards are flakes, gone near the lens; a
race's cabin the rider has passed goes whole beside the lens, as a tree does.

## Text for the README

> Round 8's critic loop on Frostfang (five passes, a fresh critic each): High 6.60 to 6.94, Low 6.20 to 6.27, the phone
> 6.50 to 6.37; no frame a 9. The crevasse walls are cut ice, the cavern's gates pools in the dark, the dawn on the bridge
> out of the cavern, and shafts off the near snow on every mountain. Cost level on every tier.

## Frames and helpers

- `shots/r8/review/m1/pass1` to `pass5`: `high/`, `low/`, `phone-medium/`, `strips/` (and `strip-frames/`), the sheets the
  critic read, each set's JSON (console and cost) and Low's GL counts.
- The lane's helpers are in the worktree's `rev1/` (not committed): `capture.sh` (one slot a pass, waits out the main
  lane's sittings, checks the browser session opened), `heavy.sh`, `stills.js` (the shared one plus each frame's cost),
  `critic-prompt.txt` and the filled prompts, `digest.cjs`, and `critics/pass1.md` (every pass's scores as given).
