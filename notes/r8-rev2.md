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
