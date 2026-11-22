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
