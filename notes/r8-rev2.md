# Round 8, milestone 4: Ember Peak's critic loop (review lane m2)

Brief: `notes/r8-briefs/review.md` with N = 2. Branch `r8-rev2`, cut from `round-8` at 9a93aa8. Frames under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/m2/pass<K>/` in the main checkout: `high/`, `low/`,
`phone-medium/` (the 35 places of `frames-r7.json` as stills that hold the run still, `stills.js`), `sheets/` (Low and
the phone four to a sheet, as the critic saw them), `strips/` (eight frames in motion on High, `speedstrips.js`, at the
cone, Cinder Gate's slot, the Caldera's lip, Ash Market's bridge and the third leap), and each capture's JSON (the
console's errors and every frame's draw calls and triangles).

Every pass had a new critic: a general-purpose agent on opus at high effort, given only ART.md's path, the frames'
paths and the brief's instruction (scores out of 10 against the direction, the weakest thing in each frame, the five
worst and what would lift them, each hero vista and the opening judged for a 9). It was told nothing of what changed.

The fixed set's 35th place (4590 m, the square) is not shot: the replayed pool rider (`demo=0`) has finished and the
run has left the `run` phase by then, so every pass has 34 frames a tier.

## Pass 1: what the critic saw

High mean 7.0, minimum 5 (1316 m). Low mean 6.6, minimum 4.5 (1316 m). Phone mean 6.6, minimum 5 (1166, 1316, 2441,
2550 m). Strips mean 6.9, minimum 6 (Cinder Gate's slot, the Caldera's lip). No frame a 9; the best 8 (High 613,
1766, 3591, 4440 m). Hero vistas: the cone from the start 7.5, Cinder Gate's throat 6, the Caldera Leap 5.5, Ash
Market's bridge 7.5, the opening (ART.md 12, "Places of their own") 7.

Its findings, worst first:

1. 1316 m on every tier: "a flat saturated red over the whole slope", on Low "a pure red polygon". The replayed rider
   is thrown about 120 m up by Cinder Gate's steam vent (air 191 ticks at 1316 m, 124 m over the snow); the roof gives
   way where a vent's flight needs it, but the tunnel's place grade (the hall's red air, thick from 24 m) still held,
   so everything under the lens was the hall's fog.
2. 2441 and 2550 m (High, Low and phone, and the lip's strip): the line is black crust with glowing cracks, so "the run
   reads as a hazard" (ART.md 6), the thrown snow over it as smoke; the basin past the lip a grey cloud sea, not lava.
   The crust floor ran from the cliff's foot to 48 m past the end of the landing face (2405 to 2654 m): every rider,
   landed or not, rode 200 m of crust.
3. 2024 m on every tier: "a red-vermillion smear band" across the snow: the fork's strip of ice mirroring Ember's red
   horizon (vermillion is the rider's).
4. 1166 m (every tier and the strip): the replayed rider flips over the slot's bump and the saucer's underside faces
   the lens, "a blue disc with a face". The trick pose and the chase lens are shared; not this lane's to change.
5. Low 2691 to 2850 and 3323 m: the halls' banks "smeared into stretched pink streaks"; Low 4200 and 4440 m: the
   lamps' pools "hard-edged pale ellipses, like a stain or spotlight".
6. Also: the opening has no ridge at 150 to 300 m (a plain bank with a rail on one hand, a dark tower of columns on the
   other); slab walls with white scratches in the slots; a flat orange rectangle on the halls' wall (3150 m); basalt
   columns as clean prisms; the snow sand or peach on Low and in places on High; small riders in the wides; Ash
   Market's houses plain boxes; ghosts and spray at the lens on the phone.

## After pass 1: what changed (d5af13d)

- **The Caldera's landing is snow** (`stages.ts makeCaldera`). The crust floor lies under the gap and the foot of the
  landing and gives the corridor back to the landing's groomed snow from 6 to 18 m past the landing face's start, on
  ragged whole plates; the banks' crust and the fields run on as before. The floor's light under the rider and the
  embers off the run end with it.
- **A tunnel's light holds a sled under its roof** (`palette.ts overRoof`, `journeyPalette(..., over)`,
  `world.ts journey`). A sled more than 46 m over the snow (higher than any roof stands, landmarks.ts ENC_MAX 44) is
  in the open air, and a tunnel's place grade lets go of it over the next 20 m. Shared, for every mountain's tunnels;
  it changes nothing for a sled under a roof.
- **Ember's ice holds the cold of the deep sky** (`palette.glazeCool`, `materials.ts uGlazeCool`; 0 on every other
  mountain, 0.8 on Ember): what a glaze mirrors leans to the dark upper sky and the snow's deep, so the fork's strip is
  a cold dark lane, never a vermillion band.
- **The basin past the Caldera's lip** (the Caldera's place): its smoke near black (`clouds.lit #3A1610`, shade
  `#160808`) and the fire's pools under it at 1.1 (were 2.2, which went past the film curve to cream: the "grey cloud
  sea" was overexposed orange). Found by hiding the scene's objects one by one at 2441 m and reading the pixels.
- **Low**: the slots' place keeps the snow's light as one smooth ramp (`poster.steps` 0 there); Ember's painted pools
  (`uPoolSoft`, Ember only) ramp over a wider band at both steps and keep more of the lamp's hue.
- **The rivers' light up the walls** (`makeRivers`) uses the near-fading air material: it fades over the last 30 m to
  the lens, so it is light down the slot and never a flat orange slab beside the rider.

## Pass 2: what the critic saw

High mean 6.6, minimum 5 (1650 m). Low mean 6.09, minimum 5. Phone mean 6.34, minimum 5. Strips mean 6.08, minimum
4 (the Caldera's lip, a new strip this pass). No frame a 9; the best 8 (High 3591 m). Hero vistas: the cone 7,
Cinder Gate 6.5, the Caldera 5, the bridge 7.5, the opening 6.5.

A harder critic than the first: frames nothing touched fell half a point to a point (300 m 7 to 6, 450 m 7 to 6, 750 m
6.5 to 5.5, 3741 m and 3940 m level or lower), while the frames the fixes reached rose against that tide (1316 m 5 to
6 on High, 4.5 to 5.5 on Low; 2024 m 5.5 to 6; Cinder Gate's vista 6 to 6.5). Nobody named a red wash or a vermillion
band again; the fork's strip now reads only as "hex crack lines... a tile grid".

Its findings, worst first:

1. The new strip at the Caldera's lip (4): the replayed rider reaches the lip at 15.8 m/s, and in its last frames the
   lens passes through the lip's cornice: "a hard seam, then pale shards and a cut hole into dark lava-cracked
   geometry". The chase lens and the leap's kit are shared.
2. 1650 m (5 on every tier): the ward's burst washes the frame orange with flat yellow quads (the events lane's ward).
3. 2441 and 2550 m: "the caldera is grey-beige mud, not a lava lake", and the landing's snow sand-orange; a "ruler-
   straight seam" across the snow at 2550 m.
4. The snow turns sand-orange from 1650 to 3000 m on every tier and across Low's first half ("desert dunes").
5. 1166 m's flip (as pass 1), 750 m's small rider, 4050 m's murk and cotton-wool powder.
6. Also: a milky translucent sheet over the right bank at 2850 and 3323 m; Low's halls' banks still streaked; the grey
   slab pillar at 300 m; the halls' flat orange rectangle (3150 m, still there with the rivers' sheets fading near the lens, so not theirs); a hollow mint ring for a
   near ghost (450, 750 m) and a ghost's tag with no body (2100 m); Ash Market's windows as sticker squares.

## After pass 2: what changed

- **The Caldera is a lake of lava** (`massif.ts` `uSeaLava`, palette `massif.seaLava`, 1 in the Caldera's place and 0
  everywhere else). The valley under the smoke, seen from the lip, the landing and the air, is crust near black in
  rafts with melt in the fire's colour along the cracks between them, wider in the hot pools; it gives way to the far
  haze past 2.5 km. Nothing new is drawn: the sky dome and the panorama already paint the sea, and this paints it
  as lava where the palette asks. (Pass 1's darker smoke alone left it mud.)
- **Snow, not sand.** High: Ember's grade keeps less of the fire (saturation 1.12, was 1.18; its warm split `#FFEEDA`,
  was `#FFE8CE`; the Caldera's `#FFE8D2`, was `#FFDCB4`); the dusk stop from the halls on has a paler key
  (`#FFC4A4`, was `#FFB490`) on a snow bright enough to read as day (`#FFEEE4`, was `#FCE6DA`), so the snow shader
  takes only a trace of the light's colour there and the lava's pools are the orange. Low: a new palette field
  `posterSunSat` (1 everywhere else) keeps 0.45 of the key's colour on Ember's poster, `posterSnowSat` 0.5 of the
  graded snow's, and `grade.posterCool` 0.12 leans the lit snow to the cold shade's hue; Ember at Night keeps its own
  (all three reset).
- Investigated, not this lane's: the "milky sheet" over the right bank at 2850 and 3323 m is the speed blur of the
  frame's outer band over the lava-lit bank (hiding every object at that pixel left only the terrain); the seam at
  2550 m is the sim's drop lip there; Low's streaks in the halls are the terrain itself (Low's coarse columns and rows
  on the slot's steep foot), and the smooth ramp of pass 1 did not touch them.

## Pass 3: what the critic saw

High mean 6.85, minimum 5.5 (1166 m). Low mean 6.04, minimum 5. Phone mean 6.19, minimum 5.5. Strips mean 6.33,
minimum 4.5 (the Caldera's lip). The best frame on the mountain is now **2441 m at 8** ("the lava lake now reads under
the cone"), and the Caldera Leap's vista rose from 5 to 7.5. Hero vistas: the cone 7.5, Cinder Gate 6, the Caldera
7.5, the bridge 7.5, the opening 6.5. No frame a 9.

Its findings, worst first:

1. The lip's strip (4.5): the lens passes through the lip as pale shards and a black gap (as pass 2).
2. 1950 m: a near ghost milky and oversize at the frame's edge on Low and the phone (the ghost's size rule is shared).
3. 2024 m: "polygon cell lines drawn across the snow": the plates' pale borders in the fork's strip, which now lies
   dark under the cold glaze.
4. 2850 m and Low's halls: the bank a smeared salmon slab (the edge blur on High; Low's terrain, as before).
5. 1166 m: the flip; Cinder Gate's slot "nothing lights the walls or the rider from below", the throat never a hot
   disc; out-of-focus grey flakes like dirt on the lens.
6. Also: the opening still "a tall snow bank with a rail, not a low basalt wall with organ pipes"; the halls' wall
   "flat glowing orange rectangles" (3150 m); the near flakes grey across the run; the snow sand at 1650 and 3000 m.

## After pass 3: what changed

- **The halls' rectangle is lava** (found by the hide-and-read probe at 3150 m: the river's own mesh, not its light):
  within 8 to 18 m of the lens a raft never goes under whole (`stages.ts` lava shader, `gone` faded near the lens),
  so beside the rider the melt is cracks between plates; the halls' rivers under the roof run cooler
  (`HEAT` 0.24 to 0.46, was 0.3 to 0.6).
- **The opening's wall is a rank of organ pipes** (`framing.ts`, Ember's `wall` bank): a stand about every 20 m along
  the wall's crest, each its own height and turn, 8 to 10.5 m past the limit, where three outcrops a place stood.
  Every composed place on Ember (the opening and the stage starts) takes it; one draw as before.
- **The fork's ice plates** on Ember's cold glaze keep a quarter of their pale border (`uGlazeCool`): a faint seam,
  never a grid.
- **Cinder Gate's slot** is lit harder from below (the slots' `under.k` 0.65, was 0.5).

## Pass 4: what the critic saw

High mean 6.54, minimum 5.5 (993, 1166, 1650 m). Low mean 6.03, minimum 5. Phone mean 6.04, minimum 5. Strips mean
6.0, minimum 3.5 (the lip). "No frame on any tier is above 7.5." Hero vistas: the cone 7.5, Cinder Gate 5.5, the
Caldera 6.5, the bridge 7.5, the opening 6.5.

The fourth critic was the harshest yet on the frames nothing changed (993 m 7 to 5.5, 2271 m 7 to 6, 2100 m 6.5 to 6),
and it judged the Caldera a point under the third ("the lava basin under the cone reads... but the lake is not under
the flight", which no fixed frame shows: the replayed rider is too slow to fly the gap). It saw the opening's new rank
of organ pipes and did not credit it: "a snow bank with a guardrail on the left and distant crags on the right"; the
sim's bank on the fall side (9.5 m in its first 10 m) still hides the fall from the low lens.

Its findings, worst first: the lip's strip (the snow "tears into large pale polygons and a black void"); the saucer's
underside in the flip at 1166 m ("a blue face in goggles"); Low's rider at the frame's foot at 2550 m and the seam
there; 993 m's radial streaks and pale blocks on the walls; 1650 m's ward burst; the slots' walls as "stacked shingle
slabs" with white lines; the charred pines at 2024 m as "fence posts with white cone caps"; the halls' floor "cool
lilac" with no lava light; the grey monolith (the ropeway's station) before the cone at 300 m.

## After pass 4: what changed

- **Ember's charred snags** (`flora.ts charSnagGeometry`) hold no snow on their splintered tips, only at their feet:
  a white cone on every broken top read as a field of pencils.
- **The slots' floor** takes the lava's light harder (the slots' place `lamps` 1.55, was 1.25): the pools by the
  rivers reach the snow beside the line.

## Pass 5: what the critic saw (the last pass)

High mean 6.96, minimum 6 (1650, 3000 m). Low mean 6.21, minimum 5.5 (the critic skipped Low's 2691 m: 33 frames).
Phone mean 6.49, minimum 5.5 (1166 m). Strips mean 6.58, minimum 5 (the lip). The best frames 8 (High 3591 and
4440 m). Hero vistas: the cone 7, Cinder Gate 7 ("the walls are lit from below and the slot is graphic"), the Caldera
6.5 on the strips and 7.5 on the stills ("the lava lake now reads under the cone"), the bridge 7.5, the opening 6.5.
No frame a 9 and no hero vista one.

Its findings, worst first: the lip's strip (the lens through the lip, as passes 2 to 4); the flip at 1166 m; Low's
tunnel wall at 3150 m a flat cream slab; Low's slot banks "shredded into stretched shards"; 1316 m on Low murky with
no value separation; on High, 1650 and 3000 m's big flat banks under the edge blur, and "grey out-of-focus flake
discs" over the slots. Named again: the charred snags still read as "pencils" at 2024 m (the white cone is gone; the
snags are slim black posts with a pale foot and read as posts at that size), the slots' walls as ruled slabs, the
halls' roof grid as "a car park", Ash Market's windows and lanterns clipped to flat blocks, the seam at 2550 m.

The loop stops here: five passes, the brief's limit. The stop rule (no frame under 8, every hero vista 9) was not met.

## Scores

Each pass a new critic (general-purpose, opus, high effort), told only ART.md and the frames' paths. A fresh critic
moves an unchanged frame by half a point to a point on its own (DECISIONS 342 found the same): 993 m went 7.5, 7.5,
7, 5.5, 7 with nothing changed there, so read the means as a band, not a line. Pass 1's strips are five (the lip's
strip was added from pass 2); from pass 2 on, six. The hero vista columns are the critic's own judgement of each
vista over all the frames it named.

| Pass | High mean (min) | Low mean (min) | Phone mean (min) | Strips mean (min) | Cone | Cinder Gate | Caldera | Bridge | Opening |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 7.00 (5) | 6.56 (4.5) | 6.65 (5) | 6.90 (6) | 7.5 | 6 | 5.5 | 7.5 | 7 |
| 2 | 6.60 (5) | 6.09 (5) | 6.34 (5) | 6.08 (4) | 7 | 6.5 | 5 | 7.5 | 6.5 |
| 3 | 6.85 (5.5) | 6.04 (5) | 6.19 (5.5) | 6.33 (4.5) | 7.5 | 6 | 7.5 | 7.5 | 6.5 |
| 4 | 6.54 (5.5) | 6.03 (5) | 6.04 (5) | 6.00 (3.5) | 7.5 | 5.5 | 6.5 | 7.5 | 6.5 |
| 5 | 6.96 (6) | 6.21 (5.5) | 6.49 (5.5) | 6.58 (5) | 7 | 7 | 6.5 | 7.5 | 6.5 |

High, frame by frame:

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| 1039 | 7.5 | 7 | 6.5 | 6 | 7 |
| 1166 | 6 | 5.5 | 5.5 | 5.5 | 6.5 |
| 1316 | 5 | 6 | 7.5 | 7 | 6.5 |
| 1500 | 7.5 | 7 | 7.5 | 7 | 6.5 |
| 1650 | 6 | 5 | 6 | 5.5 | 6 |
| 1766 | 8 | 6.5 | 7.5 | 7.5 | 7.5 |
| 1950 | 7 | 7 | 6 | 6.5 | 7 |
| 2024 | 5.5 | 6 | 6 | 6 | 6.5 |
| 2100 | 7.5 | 6.5 | 6.5 | 6 | 6.5 |
| 2271 | 7.5 | 7 | 7 | 6 | 7 |
| 2441 | 5.5 | 5.5 | 8 | 7.5 | 7.5 |
| 2550 | 6.5 | 5.5 | 7.5 | 7 | 7 |
| 2691 | 7 | 7 | 6.5 | 6 | 7.5 |
| 2761 | 7 | 7 | 6.5 | 6 | 7 |
| 2850 | 6.5 | 6 | 6 | 6 | 6.5 |
| 3000 | 7 | 6.5 | 7 | 6.5 | 6 |
| 3150 | 6.5 | 6.5 | 6 | 6 | 6.5 |
| 3323 | 7 | 7 | 7 | 6 | 7.5 |
| 3450 | 7.5 | 7.5 | 7.5 | 7.5 | 7.5 |
| 3540 | 7.5 | 7 | 7.5 | 7.5 | 7.5 |
| 3591 | 8 | 8 | 7.5 | 7.5 | 8 |
| 3741 | 7 | 7 | 7 | 7 | 7 |
| 3940 | 7.5 | 7 | 7 | 7 | 7 |
| 4050 | 6.5 | 5.5 | 6 | 6 | 6.5 |
| 4200 | 7.5 | 7.5 | 7.5 | 6.5 | 7 |
| 4330 | 7.5 | 7.5 | 7.5 | 7 | 7.5 |
| 4440 | 8 | 7.5 | 7.5 | 7.5 | 8 |
| 0150 | 7.5 | 7 | 7.5 | 7.5 | 7 |
| 0300 | 7 | 6 | 6.5 | 6.5 | 6.5 |
| 0450 | 7 | 6 | 6.5 | 6 | 6.5 |
| 0613 | 8 | 7 | 7 | 7 | 7 |
| 0750 | 6.5 | 5.5 | 7 | 6.5 | 6.5 |
| 0900 | 7 | 6.5 | 6 | 6 | 7.5 |
| 0993 | 7.5 | 7.5 | 7 | 5.5 | 7 |

Low, frame by frame:

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| 1039 | 7 | 6.5 | 6 | 6 | 6.5 |
| 1166 | 5.5 | 5 | 5.5 | 5 | 6 |
| 1316 | 4.5 | 5.5 | 5.5 | 6.5 | 5.5 |
| 1500 | 7 | 6 | 6.5 | 6.5 | 6 |
| 1650 | 6 | 5 | 6 | 5.5 | 6 |
| 1766 | 7.5 | 6 | 6.5 | 6.5 | 6 |
| 1950 | 7 | 7 | 5 | 6 | 6 |
| 2024 | 6 | 6 | 5 | 6 | 6 |
| 2100 | 7 | 6.5 | 6 | 6 | 6 |
| 2271 | 7 | 6.5 | 6.5 | 6 | 6 |
| 2441 | 6 | 5 | 7 | 7 | 7 |
| 2550 | 6 | 5.5 | 6.5 | 5 | 6.5 |
| 2691 | 6 | 6 | 5.5 | 5.5 | - |
| 2761 | 5.5 | 6 | 5.5 | 5.5 | 6 |
| 2850 | 5.5 | 6 | 5 | 5.5 | 5.5 |
| 3000 | 7 | 5.5 | 6.5 | 6.5 | 6 |
| 3150 | 6 | 5.5 | 5.5 | 5.5 | 5.5 |
| 3323 | 6.5 | 6 | 5.5 | 5.5 | 6 |
| 3450 | 7.5 | 7 | 6.5 | 6.5 | 6.5 |
| 3540 | 7.5 | 7 | 6.5 | 6.5 | 6.5 |
| 3591 | 7.5 | 7 | 6.5 | 6.5 | 6.5 |
| 3741 | 7 | 7 | 6.5 | 6.5 | 6.5 |
| 3940 | 7 | 6.5 | 6 | 6.5 | 6 |
| 4050 | 6.5 | 6 | 5.5 | 5.5 | 6 |
| 4200 | 6.5 | 6.5 | 6 | 5.5 | 6.5 |
| 4330 | 7 | 7 | 6.5 | 6.5 | 6.5 |
| 4440 | 7 | 7 | 6.5 | 7 | 7 |
| 0150 | 7 | 6 | 6.5 | 6.5 | 6.5 |
| 0300 | 7 | 5.5 | 6 | 6 | 6 |
| 0450 | 6.5 | 5.5 | 6 | 6 | 6 |
| 0613 | 7 | 6 | 6.5 | 6.5 | 6.5 |
| 0750 | 6.5 | 5 | 6 | 6 | 6 |
| 0900 | 6.5 | 6 | 6 | 5.5 | 7 |
| 0993 | 6 | 6.5 | 6.5 | 5.5 | 6.5 |

Phone, frame by frame:

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| 1039 | 7 | 7 | 6.5 | 6 | 7 |
| 1166 | 5 | 5 | 5.5 | 5 | 5.5 |
| 1316 | 5 | 5.5 | 6.5 | 6.5 | 6 |
| 1500 | 7.5 | 6.5 | 6.5 | 6.5 | 6.5 |
| 1650 | 6 | 5 | 5.5 | 5.5 | 6 |
| 1766 | 7.5 | 6.5 | 6.5 | 6.5 | 6.5 |
| 1950 | 7 | 7 | 6 | 6.5 | 7 |
| 2024 | 5.5 | 6 | 5.5 | 6 | 6 |
| 2100 | 5.5 | 6 | 5.5 | 5.5 | 6 |
| 2271 | 7.5 | 6.5 | 6.5 | 6 | 6.5 |
| 2441 | 5 | 5 | 7 | 6.5 | 7 |
| 2550 | 5 | 5.5 | 6.5 | 5.5 | 6.5 |
| 2691 | 7 | 6.5 | 6 | 6 | 7 |
| 2761 | 6.5 | 6.5 | 6 | 5.5 | 6.5 |
| 2850 | 6.5 | 6 | 5.5 | 5.5 | 6.5 |
| 3000 | 7 | 6 | 6 | 6 | 6 |
| 3150 | 6.5 | 6.5 | 6 | 5.5 | 6.5 |
| 3323 | 7 | 6.5 | 6 | 5.5 | 6.5 |
| 3450 | 7 | 7 | 6.5 | 6.5 | 6.5 |
| 3540 | 7.5 | 7 | 6.5 | 6.5 | 6.5 |
| 3591 | 7.5 | 7.5 | 7 | 6.5 | 7 |
| 3741 | 7 | 7 | 7 | 6.5 | 6.5 |
| 3940 | 7 | 6.5 | 6 | 6 | 6 |
| 4050 | 6.5 | 5.5 | 5.5 | 5.5 | 6 |
| 4200 | 7.5 | 7 | 6.5 | 6.5 | 7 |
| 4330 | 7 | 7 | 7 | 6.5 | 7 |
| 4440 | 7 | 7.5 | 7 | 7 | 7 |
| 0150 | 7 | 6 | 6.5 | 6 | 6.5 |
| 0300 | 6.5 | 5.5 | 5.5 | 6 | 6.5 |
| 0450 | 7 | 6.5 | 6.5 | 6 | 6 |
| 0613 | 7.5 | 6.5 | 6.5 | 6.5 | 6.5 |
| 0750 | 6.5 | 6 | 5.5 | 6 | 6 |
| 0900 | 7 | 6.5 | 6 | 6 | 7 |
| 0993 | 6.5 | 7 | 5.5 | 5.5 | 7 |

Strips (High, eight frames in motion):

| Strip | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| 0150 | 7.5 | 7 | 7.5 | 7 | 7 |
| 1166 | 6 | 6 | 5.5 | 5.5 | 6.5 |
| 2340 | 6 | 5.5 | 6.5 | 6.5 | 7 |
| 2395 | - | 4 | 4.5 | 3.5 | 5 |
| 3540 | 7.5 | 7.5 | 7.5 | 7 | 7.5 |
| 3940 | 7.5 | 6.5 | 6.5 | 6.5 | 6.5 |

What moved for the fixes, under five different critics: 1316 m (High 5, 6, 7.5, 7, 6.5; Low 4.5 to 5.5 to 6.5);
2024 m (High 5.5 to 6 to 6.5; nobody names a vermillion band after pass 1); 2441 m (High 5.5, 5.5, 8, 7.5, 7.5: the
best frame on the mountain in pass 3); the Caldera's vista 5.5, 5, 7.5, 6.5, 6.5; 3150 m's "flat orange rectangle"
named in passes 1 to 3 and not after; Cinder Gate's vista 6, 6.5, 6, 5.5, 7 (pass 5's "the walls are lit from
below"). What no pass moved: the flip at 1166 m, the opening (6.5 to 7 throughout), the bridge (7.5 throughout).

## What is still short, and why

- **No frame is a 9 and no hero vista is one.** The best frames are 8 (High 3591, 4440, and 2441 m in pass 3).
- **The Caldera's lip, in motion** (the strip at 2395 m, 3.5 to 5 every pass): the replayed rider reaches the lip at
  15.8 m/s, drops the 4 m cliff, and the chase lens follows it down through the lip's own ground: the near plane cuts
  the lip's snow into pale shards with the pit's crust showing between them. This is the chase lens (`camera.ts`) at
  any leap's lip for a slow rider, not Ember's data; the main lane should keep the lens over the lip's ground (or fade
  what is within a metre of the lens) for every mountain.
- **The flip at 1166 m** (5 to 6.5 every pass, every tier): the replayed rider flips over the slot's bump and the
  saucer's underside faces the lens, "a blue disc with a face". The trick pose and the lens are shared. (Round 8's
  merge has since landed "the flipped hull in rider.ts" from the other review lanes; this lane's frames were shot
  before it, so pass 5 does not show it, and the main lane's next look at 1166 m should.)
- **The opening** (6.5 to 7): the composed wall now carries a rank of organ pipes, but the sim's bank on the fall
  side (9.5 m in its first 10 m) hides the fall to the lava from the low lens, and Ember has no place shot (the compose
  lane cut it). The low bank is the sim request round 8's compose lane listed (`notes/r8-compose.md`).
- **The slots** (900 to 1039 m and 2691 to 2850 m): walls read as ruled slabs or planks with white lines; the halls
  repeat Cinder Gate's slot (round 7's open item). Low's slot banks are the terrain itself: on Low's coarse columns and
  rows the V-shaped foot of the wall is drawn as long thin triangles (the hide-and-read probe found only the terrain at
  those pixels); a finer Low grid there would cost triangles on every mountain, so it is left.
- **Shared, named by every critic:** the ward's burst at 1650 m washing the frame (the events lane); the speed blur of
  the frame's outer band over a bright bank (2850, 3323 m: "a milky sheet", "an orange smudge"); grey out-of-focus
  flakes near the lens on Ember (`nearfield.ts` mixes them to Ember's dark red fog); ghosts at the lens (450, 750, 1950
  m); grey powder puffs as smoke over dark ground; Low's dark round contact shadow by the sled "like a hole".
- **Ember's own, not reached:** Ash Market's windows and lanterns clip to flat blocks; the halls' roof reads as a
  beam grid; the grey ropeway station before the cone at 300 m; the charred snags as posts at a distance; no frame of
  the fixed set shows the flight over the lake (the replayed rider is too slow to fly the gap; the lake reads from the
  lip, the landing and the approach).

## Shared code touched

All small; each is 0 or a no-op on every other mountain unless said.

- `palette.ts`: `overRoof` and `journeyPalette`/`journeyStamp`'s `over` (a tunnel's place lets go of a sled more than
  46 m over the snow; every mountain's tunnels, nothing changes under a roof); the fields `glazeCool` (0 default),
  `posterSunSat` (1 default) and `massif.seaLava` (0 default), and `tierLook` applying `posterSunSat`. Otherwise
  Ember's palette, journey and places only.
- `world.ts`: `journey()` takes the sled's height over the snow (one `course.ground` a frame on Clear Skies).
- `materials.ts`: the shared float `uGlazeCool` in the snow material (the glaze's mirror and its plates' borders; 0
  elsewhere); Low's painted pools' ramps in the `uPoolSoft` branch (Ember alone sets `poolSoft`).
- `massif.ts`: the sea's `uSeaLava` (a float in the sea's own uniforms; the shader's branch is skipped at 0).
- `stages.ts`: Ember's caldera and rivers (Ember only); the lava shader's rafts held whole within 18 m of the lens
  (Ember only).
- `framing.ts`: Ember's composed wall. `flora.ts`: Ember's charred snag.
- `scripts/playtest/stills.js`: each frame's draw calls and triangles in its JSON (commit 89c5c0a).

No uniform array of vectors anywhere; no new draw, pass or program; nothing before the first frame.

## Cost

The frames' JSON (draw calls and triangles summed over every pass of the shot frame, 34 places a tier), pass 1 (the
base, 9a93aa8 plus the stills' cost record) against pass 5 (54da13e):

| Tier | Calls, mean (max) | Triangles, mean |
| --- | --- | --- |
| High | 111.5 (120) to 111.6 (120) | 718k to 722k |
| Low | 52.8 (60) to 52.9 (60) | 120k to 122k |
| Phone on Medium | 94.4 (103) to 95.0 (103) | 497k to 507k |

No new draw anywhere. The triangles are the opening's rank of organ pipes (Low 87k to 94k at 150 m, 116k to 123k at
300 m; High 588k to 605k at 150 m, 640k to 740k at 300 m, where the composed wall is in view) and nothing else of
note. The lava sea, the over-roof weight, the cold glaze, the paler poster and the pools are shader and palette work.

Low's GL calls a frame (`glcount.js`, Ember on Low, an autoride's live ride, so the windows differ a little): the
opening (about 200 to 560 m), base 515.1 and 510.3 against head 497.1 and 512.7, interleaved base, head, head, base;
the Caldera's stretch, base 546.7 (2269 to 2681 m) against head 514.2 (2427 to 2929 m); the halls and the market's
bridge, base 526.6 (2934 to 3440 m) against head 532.0 (2833 to 3386 m). Level within the ride's spread: Low is not
heavier. Raw output in `shots/r8/review/m2/cost/`. Frame rates were not judged (other lanes shared the machine);
the GPU's pass times were not measured.

## For the main lane

- **Merging:** `palette.ts` is the one file every review lane edits. Mine adds three fields to `Palette` (`glazeCool`,
  `posterSunSat`, `massif.seaLava`) with their defaults in the base palette, `overRoof`, the `over` argument of
  `journeyPalette` and `journeyStamp`, and `roof` on `LaidPlace`; everything else is inside Ember's own cases
  (`clearSkies`/`round7`/`valuePass` volcanic, the volcanic `JOURNEY` stops, the volcanic `PLACES`, `ALT_HOURS`
  volcanic). `materials.ts` adds `uGlazeCool` beside `uIceMood` and two lines in the ice block; the other lanes' "warm-sky
  glaze tint" (merged on round-8) sits in the same block: keep both (mine is the last `sky = mix(...)` before the
  mirror is laid on).
- **Decide:** the chase lens at a leap's lip for a slow rider (it goes through the lip's ground: every mountain);
  the flip's saucer underside (merged since, by the other lanes, as "the flipped hull"); whether Ember's near flakes
  should keep their brightness rather than mixing to Ember's dark fog; the ward's burst on Ember's warm snow.
- **Nothing reaches the sim.** SIM_VERSION 10 untouched; the stills replay the same ticks on every pass.

## Text for DECISIONS (a new item)

> **Ember's critic loop, milestone 4: five passes, the Caldera a lake of lava at last, short of the stop rule**
> (`notes/r8-rev2.md`; frames under `shots/r8/review/m2/`). The fixed frames as stills on High, Low and the phone, six
> strips in motion, a fresh opus critic each pass told only ART.md. High's mean 7.0, 6.6, 6.85, 6.54, 6.96 (minimum 5
> to 6); Low 6.56 to 6.21; the phone 6.65 to 6.49; no frame a 9 and no hero vista one; the best frames 8 (2441 m, the
> Caldera's lava lake under the cone, in pass 3; 3591 and 4440 m in pass 5). The critics moved unchanged frames by up
> to a point and a half, so the means are a band. *What a player sees:* the Caldera's valley is a lake of lava from
> the lip, the landing and the air (crust rafts on cracks of the fire's colour, `massif.ts uSeaLava`), and its landing
> is groomed snow with the lava in the fields either side (the crust had run the length of the landing face, so every
> rider rode 200 m of crust: the line read as a hazard); thrown a hundred metres up by Cinder Gate's vent, the slope
> below is the open air's, not one red wash of the hall's fog (a tunnel's place now holds only a sled under its roof,
> `palette.ts overRoof`, every mountain); the fork's ice is a cold lane, never a vermillion band; the snow from the
> halls on and on Low is snow in firelight, not sand (`posterSunSat`); the opening rides beside a rank of organ
> pipes; the halls' lava is plates on cracks beside the rider, not a flat orange slab; charred snags hold no snow on
> their tips. *Cost:* no draw; triangles +0.6% on High, +1.7% on Low (the organ pipes); Low's GL calls level.
> *Short:* the lens goes through a leap's lip for a slow rider (shared); the flip's saucer at 1166 m (shared); the
> opening's fall is hidden by the sim's bank (a sim request); the slots read as ruled slabs and Low's slot banks as
> the terrain's long triangles; Ash Market's windows clip to flat blocks.

## Text for ART.md 15 (Ember Peak, "As built in round 8", to add)

> The Caldera's valley is a lake of lava: from the lip, the landing and the air the sea under the smoke is crust in
> rafts with melt along the cracks between them in the fire's colour, wider in the hot pools. The crust floor lies under
> the gap and the foot of the landing; the landing face is groomed snow, the lava in its fields either side. Ice under
> the fire holds the cold of the deep sky: a cold dark lane, never the red horizon. From the halls on, the key is a
> step paler on a brighter snow, so the light's orange is a tint and the lava's pools are the orange; Low keeps less of
> the key's colour and leans its lit snow toward the cold shade. The opening's high side is a rank of organ pipes along
> the wall's crest; beside the lens no raft of lava goes under whole. A charred snag holds snow at its foot, never on
> its splintered tip.

And ART.md 15's earlier note ("It is not yet a lake under the flight, and no smoke ceiling is lit from below") can lose
its first half: the lake is built; the ceiling is lit from below in the Caldera's place (the deck `#C8501C`), which
no critic credited.

## Text for the README (round 8's look, one line)

> Ember Peak's Caldera Leap flies over a lake of lava and lands on groomed snow between the fields; a tunnel's light
> lets go of a rider thrown high over it; on Low, Ember's snow reads as snow in firelight.

## Where the frames are

- `shots/r8/review/m2/pass1` to `pass5` in the main checkout: `high/`, `low/`, `phone-medium/`, `sheets/` (as each
  critic saw Low and the phone), `strips/` and `strips-raw/`, and each capture's JSON (console errors: none in any
  capture on any tier; draw calls and triangles per frame).
- `shots/r8/review/m2/cost/`: Low's GL calls, base and head.
- `notes/r8-rev2-scores.json`: every critic's score for every frame on every tier, pass by pass.
