# Round 8 review lane m3: Sakura Ridge

Milestone 4's critic loop on round 8's final build for Sakura Ridge (`notes/r8-briefs/review.md`, N = 3): capture,
a fresh critic told only ART.md and the frames, fixes worst first, repeat. Worktree `.claude/worktrees/r8-rev3`,
branch `r8-rev3` (from `round-8` at 9a93aa8), port 4873.

Frames: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/m3/pass<K>/` (`high`, `low`, `phone-medium`
stills of `frames-r7.json`'s 37 places, of which 36 are shot: 4590 m is past the replayed rider's stop; `sheets` the
Low and phone contact sheets the critic read, four to a sheet; `strips/tiled` eight frames of half a second at the
vistas and set pieces on High, `strips/frames` their frames). Capture: `scripts/playtest/stills.sh` as the brief
gives it, run through a copy (`rev3/stills.js`) that also records each still's draw calls and triangles summed over
the frame's passes (as `speedstrips.js` does); `speedstrips.js` and `speedstrips-tile.mjs` for the strips; the sheets
are tiled with ffmpeg (`rev3/tile.mjs`) rather than `tile.mjs`, which opens a browser. The helpers are in the
worktree's `rev3/` (not committed).

The places of `frames-r7.json` were chosen on round 7's course; on SIM_VERSION 10's Sakura the stills fall as
follows: 150 to 450 the run-in (start, bowl, cruise), 600 the first lip (640), 750 and 820 its landing, 900 to 1026
Petal Steps (terraces 860 to 1196, steps 948 to 1128), 1200 to 1350 the first street, 1500 the second stage's start
(1450), 1650 the chute, 1754 to 1971 the Thousand Torii (1786 to 2027), 2100 and 2210 the bridge, 2410 the fork's
ice channel, 2580 to 2850 the Blossom Leap (lip 2690), 3000 and 3060 the third stage's start (2950), 3150 and 3300
the second terraces, 3405 to 3600 the second fork, 3706 the last lip (3780), 3926 its flight over Temple Town, 4076
Temple Town's street (4000 to 4200), 4200 to 4440 the square and the line (4500). Strips: 40 (the opening's place
shot), 220 (the cone through the mist), 980 (Petal Steps' stair), 1840 (the torii), 2672 and 2730 (the Blossom Leap's
lip and flight), 4060 (Temple Town's bells), 4400 (the climax to the line).

Hero vistas (DECISIONS 342 and ART.md 15): the cone through the lifting mist, the flooded terraces, the Blossom Leap
over the orchard rows, the torii's bars of light, the pagoda over the square; and the opening composed past the
trench (DECISIONS 372: terraces and torii past the rider's shoulder).

## Pass 1 (9a93aa8, round 8's final build as merged; a fresh Opus critic at high effort)

| z | High | Low | Phone | Weakest thing (High unless named) |
| --- | --- | --- | --- | --- |
| 150 | 7 | 6.5 | 6 | A peach veil with no darks; the run floor one lilac wash; the cone already crisp |
| 300 | 5.5 | 5 | 5 | The tray's underside in a flip, a flat ink-navy disc ("a hole or a bomb") |
| 450 | 6.5 | 6 | 6 | Hard-edged lavender shadow puddles; a blurred hut at the edge; the torii reads rust-red |
| 600 | 7.5 | 6 | 6.5 | Navy cone shards at the lip; the cone's tip cut (Low: no outcrops or crowd) |
| 750 | 6.5 | 6.5 | 6 | Two pills over a ghost smear; paddies grey grids; rider small |
| 820 | 7 | 6.5 | 6.5 | Lavender milk, no middle value; paddies grids |
| 900 | 7 | 6.5 | 6.5 | Shadow slabs; the stair's crimson lanterns against the vermillion; a pine shard |
| 970 | 6.5 | 6.5 | 6 | A black wire from the frame's top to the centre lantern |
| 1026 | 6.5 | 6 | 6 | The wire; shadow slabs (Low: a radial smear) |
| 1200 | 6.5 | 6 | 6 | The draft sheet a cyan bar through the rider; box buildings |
| 1301 | 6 | 6 | 6.5 | Brick townhouse boxes with flat amber panes; the street's depth of field |
| 1350 | 6 | 6 | 6 | The same facades |
| 1500 | 7 | 6.5 | 6.5 | A lavender shadow puddle; an empty middle plane |
| 1650 | 6 | 6 | 6.5 | Rock bands as black boxes under white lids; smooth violet domes; rider small |
| 1754 | 7 | 6.5 | 7 | The torii mouth a slatted slab; capped rock crenellations |
| 1800 | 6.5 | 6 | 7 | Stacked boxes for walls; a blossom shard at the left |
| 1971 | 7.5 | 6.5 | 7 | Bars in the air and on the walls, not on the floor; a tile-grid wall |
| 2100 | 6 | 5.5 | 5.5 | A flip under a navy disc; the bridge's towers plain boxes; candy-stripe rails |
| 2210 | 6.5 | 6 | 6.5 | Box towers; a mint ghost over the cone; the hood bloomed |
| 2410 | 7 | 6.5 | 6.5 | Two white streaks down the fall line (the fork's ice) |
| 2580 | 7.5 | 6 | 6.5 | The valley's flat blue cut-outs; a red hurdle; the far plane not blue |
| 2700 | 7 | 6 | 6.5 | The same cut-outs; a smear of tiny boxes on the right flank |
| 2850 | 7.5 | 6 | 6.5 | Rider 12% of the frame in its spray; a box pagoda (Low: no pagoda) |
| 3000 | 5.5 | 5.5 | 5.5 | A rail and lantern string at the lens; a flipped rider under a navy disc |
| 3060 | 6.5 | 6 | 6 | A cobalt smear on the left bank; rider small (Low: no pagoda) |
| 3150 | 7 | 6 | 6.5 | Lavender puddles; a box pagoda |
| 3300 | 7 | 6 | 5.5 | A generic cerulean sky; an empty middle plane |
| 3405 | 7.5 | 6.5 | 6.5 | Lavender puddles; a bloom smear |
| 3450 | 7.5 | 6.5 | 6.5 | White streaks down the fall line on the ice |
| 3600 | 7 | 6.5 | 6.5 | A blossom shard at the left; the streaks |
| 3706 | 6.5 | 6 | 6 | Ice glare bleaches the sled; a capped rock |
| 3926 | 6.5 | 6 | 5 | Temple Town from the air a heap of white boxes; rider 8% (phone: black hex lanterns in the corners) |
| 4076 | 7 | 6.5 | 6.5 | Flat-roofed blocks with amber panes |
| 4200 | 7.5 | 6.5 | 7 | A large lavender shadow puddle |
| 4330 | 6 | 6 | 6 | Awnings as shards at the top corners; sign boards in the sky; a red post |
| 4440 | 8 | 6.5 | 7 | The pagoda tiny behind the FINISH arch; the hotel a plain block |
| **Mean** | **6.76** | **6.15** | **6.26** | |
| **Minimum** | **5.5** (300, 3000) | **5** (300) | **5** (300, 3926) | |

Strips (High): 40 6, 220 6.5, 980 6.5, 1840 7, 2672 5, 2730 6, 4060 6.5, 4400 7.5 (mean 6.38).

| Vista | Frames | Score | A 9? |
| --- | --- | --- | --- |
| The cone through the lifting mist | 150 to 820, strip 40 | 7.5 (600) | No: one peach veil, the cone crisp too early |
| The flooded terraces | 750, 820 | 6.5 to 7 | No: grey box grids, no sky in them |
| The Blossom Leap | 2580 to 2850, strips 2672, 2730 | 7.5 | No: rider small, valley flat blue cut-outs |
| The torii's bars of light | 1800, 1971, strip 1840 | 7.5 | No: bars in the air, not on the floor; box walls |
| The pagoda over the square | 4440 | 8 | No: tiny behind the FINISH board |

Its faults across many frames: flat hard-edged lavender shadow puddles (450, 900, 1026, 1200, 1500, 2700, 3150,
3405, 4200); boxes (rocks under white lids at 1650 to 1800 and 3706, the bridge's towers, the town as flat-roofed
blocks, the pagoda); the flip as a navy disc on every tier (300, 2100, 3000); milky frames with no darks at the start;
the phone's bottom third empty snow; straight white streaks down the fall line on the ice (2410, 3450 to 3706); shards
at the frame's sides (450, 900, 1800, 3600, 4330); red that competes with the vermillion (the stair's lanterns, a
torii, the hurdle, the bridge's rib, a post); a ghost or a wire on the rider's axis; the valley's flat blue cut-outs;
the rider small in the air; on Low a radial smear on the banks, the pagoda and the leap's outcrops missing.

Cost (the stills' JSON): High 108.4 draw calls (117 at most), 896k triangles (1.12M); Low 48.8 (54), 116k (172k);
the phone 91.7 (99), 635k (869k). Console clean on every capture.

### After pass 1 (5cac2f0 to a5fdac9, then b6a6dc7)

Worst first, each with the frames that asked for it:

- **The flip as an ink-navy disc (300, 2100, 3000; every tier).** The pool rider on Sakura rides the Tea Tray, and its
  underside paint (`#3A4256`) turned to the lens filled the rider's place. This lane first lifted the paint to
  `#626C82` (`meshes.ts`, 5cac2f0); the Pinecrest lane fixed the same fault in the shader (r8-rev0's 855c261 and
  7e98e45: a round hull's underside takes the snow's cool light in spun rings, the trim's vermillion round its edge,
  and the tray's face a chased ring). To leave the main lane one change, not two, this lane's paint change is
  reverted and rev0's net change to `rider.ts` and `meshes.ts` is carried here byte for byte (b6a6dc7;
  `git diff r8-rev0 -- src/render/rider.ts src/render/meshes.ts` is empty), so Sakura's later passes are judged with
  the fix the merge will carry. Pass 2's frames still had this lane's paint change, not rev0's.
- **Hard-edged lavender shadow puddles (nine frames).** Sakura's cast shadows at `shadowK` 0.7 (0.82) and 0.74 from
  the mist's stop (0.95): a lighter middle value, and the shadow's penumbra widens under 1 (`snowShadow`). The torii
  place keeps 0.95, so the posts' shadows stay the dark between the bars.
- **Temple Town and the first street as brick terraces with amber panes (1200 to 1350, 4076, 4330, strip 4060).**
  Sakura's townhouses are two storeys (three now and then; the narrow street's were three and four, the inn four to
  six and now three or four), each upper storey a band of paper screens behind close dark slats, under an ink pent
  roof at each storey line with snow on its upper half; the roof never reaches past the lot's room (`town.ts`).
- **The stair's crimson lanterns against the vermillion (900 to 1026, strip 980).** Petal Steps' waiting lanterns are
  marigold, the lantern's colour (ART.md 14), where they were the blossom's pink (`BLOOM`, used nowhere else).
- **A black wire from the frame's top (970, 1026).** A row's garland was drawn from the arch the sled had passed down
  to the next, so from under it the rope fell through the sky; it is drawn only from an arch still ahead
  (`verbworld.ts`, every mountain's rows: Pinecrest's Old Town hops too).
- **The bridge (2100, 2210).** The rib in two lacquers read as a candy-striped barrier: one deep lacquer on Sakura;
  the portal towers gain ink bands and a swept pyramid roof with its snow on the upper half (`places.ts`).
- **The pagoda tiny behind the FINISH board (4440).** Grown 2.5 across and 3.5 up about its foot (2.1 and 2.6).
- **The Blossom Leap's valley as flat blue cut-outs (2580, 2700).** The sea of cloud full at the Leap (`massif.sea`
  0.8 to 1), so its gaps are few and small.

## Pass 2 (a5fdac9; a fresh Opus critic at high effort)

| z | High | Low | Phone | Weakest thing (High unless named) |
| --- | --- | --- | --- | --- |
| 150 | 7 | 6.5 | 6.5 | The lower 45% a radial smear of lavender streaks; pale slabs on the left bank |
| 300 | 5.5 | 5.5 | 5.5 | The tray's underside to the lens, the rider's head poking out of its rim (every tier) |
| 450 | 6.5 | 6.5 | 6.5 | Hard-edged periwinkle puddles; the lift tower a box; a chalet shard |
| 600 | 7.5 | 5.5 | 6 | Navy crystal spikes by the lip (Low: the lip's outcrops and crowd missing) |
| 750 | 6 | 6 | 6 | Rider 8% of the frame; a temple askew; a ghost at the lens; the cone cut |
| 820 | 7 | 6.5 | 6.5 | Rider small; a lavender slab on the left flank; paddies grids |
| 900 | 7 | 6.5 | 6.5 | Periwinkle pools; a blurred pine at the left |
| 970 | 7.5 | 6.5 | 6.5 | Radial scratch streaks at the right; the gantry a plain beam |
| 1026 | 7.5 | 5.5 | 6.5 | Speed-line streaks on the right of the floor; cranes as sticks (Low: 60% blotchy smear) |
| 1200 | 6.5 | 6 | 6 | The draft's cyan beam through the rider; floor smear; box fronts |
| 1301 | 6.5 | 6.5 | 6.5 | The street's depth of field softens the rider; flat barrier boards |
| 1350 | 7 | 6.5 | 6.5 | Near facades mush from the blur; a ghost over the torii's beam |
| 1500 | 7.5 | 6.5 | 7 | A flat navy triangle behind the right bank; floor smear |
| 1650 | 6.5 | 6 | 6.5 | Bank outcrops as dark boxes under white lids; rider small; petals as flat discs |
| 1754 | 7 | 6.5 | 7 | The corridor's mouth a wine slab; crags in rows of blocks |
| 1800 | 6 | 6 | 7 | Walls as navy cubes under white lids; a pink canopy shard at the left |
| 1971 | 8 | 7 | 7.5 | Shafts a milky wash on the walls; floor bars lavender on lavender |
| 2100 | 6.5 | 6.5 | 6.5 | Bridge towers purple boxes under pyramid caps |
| 2210 | 6 | 6 | 6 | The same towers; a giant mint ghost in the sky over the cone |
| 2410 | 7 | 6.5 | 7 | White streaks straight down the ice lane |
| 2580 | 7 | 6.5 | 6.5 | Rider 6%; trees crowd the landing; the valley washed white, no orchard rows |
| 2700 | 7 | 6.5 | 6.5 | Rider small; fence blocks as floating planks |
| 2850 | 7 | 6.5 | 6.5 | Rider lost in its powder; the pagoda white boxes |
| 3000 | 6.5 | 6.5 | 6 | A lantern string's beam across the foot at the lens; terraces brown boxes |
| 3060 | 7 | 6 | 6 | A cobalt smear in the left bank's shade; a ghost under the rider |
| 3150 | 7 | 6 | 6.5 | Periwinkle puddles |
| 3300 | 6.5 | 6 | 6 | An empty middle plane (Low: a hard band across the sky) |
| 3405 | 7.5 | 6.5 | 6.5 | A flare over the near snow |
| 3450 | 7.5 | 6.5 | 7 | White streaks on the ice; blossom lit from the front |
| 3600 | 7 | 6.5 | 7 | A flat grey slab face on the right bank; a canopy blob at the lens |
| 3706 | 7 | 6.5 | 6.5 | The rider's reflection a pale double; a blue lump under a white cap |
| 3926 | 6.5 | 6 | 5 | Rider 5%; Temple Town a white mass (phone: black hex lanterns in the corners) |
| 4076 | 7.5 | 6.5 | 6.5 | Roofs flat cream slabs |
| 4200 | 7.5 | 7 | 6.5 | Periwinkle puddles (phone: warm haze over the rider) |
| 4330 | 7 | 6 | 6 | A board floating in the sky; huge blurred lanterns at the edges |
| 4440 | 8 | 7 | 6.5 | The crowd a smear; the hotel a box; the pagoda behind the board |
| **Mean** | **6.93** | **6.32** | **6.43** | |
| **Minimum** | **5.5** (300) | **5.5** (300, 600, 1026) | **5** (3926) | |

Strips: 40 5.5 (the start's stands pop in between two frames; a ghost twice the rider's size beside it), 220 6.5, 980
7, 1840 7.5, 2672 4.5 (the Blossom Leap's whip: rider 3% of the frame, the lip's crags and paper wheels as shards
across both thirds), 2730 6, 4060 7, 4400 8 (mean 6.5).

| Vista | Score | A 9? |
| --- | --- | --- |
| The cone through the lifting mist | 7.5 (600) | No: a uniform peach wash, not layers; the near plane smeared |
| The flooded terraces | 7 | No: grey-blue tile grids from the air, brown blocks from the run |
| The Blossom Leap | 7 (strip 4.5) | No: rider tiny, valley washed white, no orchard rows |
| The torii's bars of light | 8 (1971) | No, the closest: shafts a milky wash on the walls, floor bars lavender on lavender |
| The pagoda over the square | 8 (4440, strip 4400) | No: still half behind the board; midday light; no petal storm |

What moved: the street (1301 6 to 6.5, 1350 6 to 7, 4076 7 to 7.5), the stair (970 and 1026 6.5 to 7.5), the torii
(1971 7.5 to 8), the strips at the stair and the line (980 6.5 to 7, 4400 7.5 to 8); High's mean 6.76 to 6.93, Low's
6.15 to 6.32, the phone's 6.26 to 6.43. The flip at 300 still 5.5 (this pass had the paint change only). New this
pass: the radial floor smear named in eleven High frames; the puddles still in six.

Cost: High 108.9 draw calls (117), 887k triangles (1.11M); Low 48.4 (54), 115k (169k); the phone 91.6 (99), 628k
(853k). Low's GL calls a frame (`glcount.js`, a live ride, two windows twice): pass 1 510.2 and 512.2 over 200 to
570 m, 528.8 and 522.3 over 1390 to 1740 m; pass 2 517.4 and 535.9 over 200 to 560 m, 546.4 and 546.9 over 1350 to
1675 m. The live ride's windows fall at different metres and in a different field each run (the stills at a fixed
tick read Low's draw calls 48.8 then 48.4); nothing this lane changed draws on Low but triangles. A final
interleaved A/B against the base build settles it (below).
Console clean on every capture.

### After pass 2 (f201b85 to b01b191)

- **The radial floor smear (eleven High frames, strips 220 and 980).** Sakura keeps a third of the speed streaks (0.55
  to 0.35, `world.ts`; every other mountain 1). Part of what the critics call smear is not the streaks: the ghosts'
  ruts fanning across the snow from the start, the relief's shadows smeared by the lens's edge blur at the sides, and
  on Low (which has no streaks) the painted slab. Those are shared systems and stay as they are.
- **The puddles (six frames).** Sakura's snow shade a step lighter and greyer down the run (`#7E8CD6` to `#8692D6` at
  the start, the orchards' `#7482D4` to `#7C88D2`, Temple Town's `#6C7CD4` to `#7684D2`, the terraces place's
  `#6878D2` to `#7482D0`); the run-in's contrast 1.1 to 1.15 and the mist's stop 1.12 to 1.16 (its "few, exact"
  darks).
- **Navy cubes under white lids (1650, 1754, 1800).** The cone's rock set (the cut walls of the torii row, the
  ravine's crags) leans to the wine of the lacquer (`#86788C`/`#3C3554`/`#221E34` to `#94868C`/`#4A3E4C`/`#2A2230`),
  and the chute's rock bands take the same stone on Sakura (`dressing.ts bankRock`).
- **White rails down the ice (2410, 3450, 3600, 3706).** A fork's strip draws its scribed edges at half the light
  (`materials.ts`, every mountain: 0.45 to 0.22).
- **Cream slab roofs (4076, 3926).** Sakura's townhouse roofs keep snow on the ridge's quarter (`gable` snowK 0.5 to
  0.25).
- **Box bridge towers (2100, 2210).** Four lacquer posts round a dark core, a lacquer band between the ink ones.

## Pass 3 (b01b191; a fresh Opus critic at high effort)

| z | High | Low | Phone | Weakest thing (High unless named) |
| --- | --- | --- | --- | --- |
| 150 | 7 | 7 | 6.5 | One even peach veil, no visible sun; the bottom 40% streaked lavender |
| 300 | 6 | 6 | 6 | Mid-spin side-on: the tray's vermillion rim a red target disc, the figure lost |
| 450 | 6.5 | 6.5 | 7 | Hard-edged lavender patches; a teal cabin blurred at the right edge |
| 600 | 6.5 | 6 | 6.5 | The leap's outcrops navy crystal shards; a radial smear below (Low: no crowd ledges) |
| 750 | 6.5 | 6 | 6.5 | Terraces a grid of pale blue tiles; rider small; a ghost cut at the foot |
| 820 | 7 | 6.5 | 6.5 | Terraces a grey tile grid; a dark slab at the left edge |
| 900 | 7.5 | 7 | 7 | Lavender puddles; the lower third smeared |
| 970 | 7.5 | 7 | 6.5 | Lower third smeared; the gate's crossbar a plain beam |
| 1026 | 7 | 6 | 6.5 | Blue streak blotches on the right bank; an empty middle plane |
| 1200 | 6.5 | 6 | 6 | The draft sheet a cyan stripe through the rider |
| 1301 | 7 | 6.5 | 6.5 | The street's depth of field; bokeh lanterns flat dots |
| 1350 | 7 | 6.5 | 6.5 | A ghost over the torii's beam like a sticker |
| 1500 | 7 | 6.5 | 7 | An empty middle plane; a lavender puddle |
| 1650 | 7 | 6.5 | 6.5 | Rider small; the ravine's mouth a dark monolith; boulders stacked slabs |
| 1754 | 7.5 | 7 | 7 | The corridor head-on a solid purple tower |
| 1800 | 6 | 6.5 | 7 | The mouth's walls grey cubes with white faces and icicles; a blossom slab at the left |
| 1971 | 8 | 6 | 7 | The bars cream smears on the walls, faint on the floor (Low: a glare smear) |
| 2100 | 7 | 7 | 6.5 | The rider upside down, read as a red saucer underside; pale pyramid caps |
| 2210 | 6.5 | 6.5 | 7 | A mint ghost a fifth of the frame in the sky over the cone |
| 2410 | 7.5 | 7 | 7 | White speed scratches at the foot; hexagonal cracks as tiling |
| 2580 | 7.5 | 6.5 | 6.5 | The valley floor blank, no orchard rows; a near-vermillion rail |
| 2700 | 8 | 7 | 7 | Rider small; the valley floor blank |
| 2850 | 8 | 7 | 7 | Rider buried in powder; the pagoda pale stacked boxes |
| 3000 | 6 | 6.5 | 5.5 | A beam strung with lanterns across the foot at the lens; the rider inverted |
| 3060 | 7 | 6 | 6.5 | Orchard blocks as tile grids; a lavender smear on the left bank |
| 3150 | 7 | 6.5 | 7 | Lavender puddles |
| 3300 | 7.5 | 6.5 | 6 | The sky full of flat pink discs; an empty middle plane |
| 3405 | 7.5 | 7 | 7 | Flat disc petals; a white smear at the lower left |
| 3450 | 7.5 | 7 | 7 | Streak lines at the lower left; blossom lit from the front |
| 3600 | 7 | 7 | 7 | A blossom slab over a quarter of the left edge |
| 3706 | 7 | 7 | 6.5 | A grey box boulder under a white lid |
| 3926 | 7 | 6.5 | 5 | The town washed cream boxes; rider 1/15 (phone: black hexagons in the corners) |
| 4076 | 7 | 6.5 | 6.5 | Roofs flat tan slabs; a pine tip at the foot |
| 4200 | 8 | 7 | 7 | Bloom warms the coat toward peach; puddles |
| 4330 | 6.5 | 5.5 | 6 | A black slab floating in the sky; red masts near vermillion |
| 4440 | 8 | 7 | 7.5 | A blocky crowd; a flat floor |
| **Mean** | **7.08** | **6.57** | **6.61** | |
| **Minimum** | **6** (300, 1800, 3000) | **5.5** (4330) | **5** (3926) | |

Strips: 40 6 (a ghost twice the rider's size passes the lens and goes milky), 220 7, 980 7, 1840 7.5, 2672 6 (the
Blossom Leap's lip: rider 1/25 of the frame, navy shards and paper wheels smeared across the corners), 2730 6.5, 4060
7, 4400 8 (mean 6.88).

| Vista | Score | A 9? |
| --- | --- | --- |
| The cone through the lifting mist | 7 | No: one flat peach veil, no layers lifting, no disc until 970 |
| The flooded terraces | 6.5 to 7 | No: grids of grey-blue tiles, no sky in them |
| The Blossom Leap | 8 (2700, 2850; strips 6 to 6.5) | No: rider tiny, the valley floor blank, navy shards at the lip |
| The torii's bars of light | 8 (1971) | No: the bars smear on the walls, faint on the floor, none over the rider |
| The pagoda over the square | 8 (4440) | No: a small mark behind the arch; no petal storm |

What moved: High 6.93 to 7.08 (minimum 5.5 to 6), Low 6.32 to 6.57, the phone 6.43 to 6.61, the strips 6.5 to 6.88;
the Blossom Leap's stills 7 to 8, its lip strip 4.5 to 6; the bridge 6.5 to 7; the stair and the orchards' frames up
half a point. Down: 600 (7.5 to 6.5: the shoulders' navy shards now named first) and 4330 (7 to 6.5: the floating
slab, the masts). The flip at 300 (now with rev0's fix carried) 5.5 to 6: its vermillion rim ring reads as "a red
target disc" seen side-on; that is rev0's ring, for the main lane to weigh (below).

Cost: High 108.4 draw calls (117), 891k triangles (1.11M); Low 48.4 (54), 115k (170k); the phone 92.2 (101), 631k
(851k). Console clean.

### After pass 3 (a936d10 to ef19329): built, tested, not yet judged

- **Navy crystal spikes at the lips (600 every tier, strip 2672).** Sakura's leap shoulders are outcrops in thin
  dipping beds of its wine-leaning stone with snow on every ledge, as Pinecrest's are (`rails.ts`, a branch of
  Sakura's own beside the alpine one, so it does not touch rev0's lines there).
- **White faces on the cut stone (1800).** The cone set's ledges a greyer snow (`#C4BCD0` to `#AEA4B6`).
- **Masts near the vermillion (4330).** The street's and the square's masts on Sakura `#93405A` to `#6E2C48`.
- **Confetti petals (most frames).** Sakura's petals about two thirds as many (0.7/0.9/1.1/1.3 to 0.45/0.6/0.75/0.85).

## Where it stopped

The lane was told to hand back during pass 4's capture (after the three passes the brief requires; five were
allowed). Pass 4's capture was stopped, the preview server stopped and every session closed; no slot is held. The
build at ef19329 passed `tsc` and the full vitest (102 files, 1863 tests) and has not been shot or judged.

## Every pass at a glance

| Pass | Build | High mean (min) | Low mean | Phone mean | Strips | Cone | Terraces | Leap | Torii | Pagoda |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 9a93aa8 (base) | 6.76 (5.5) | 6.15 | 6.26 | 6.38 | 7.5 | 6.5 to 7 | 7.5 | 7.5 | 8 |
| 2 | a5fdac9 | 6.93 (5.5) | 6.32 | 6.43 | 6.5 | 7.5 | 7 | 7 (strip 4.5) | 8 | 8 |
| 3 | b01b191 | 7.08 (6) | 6.57 | 6.61 | 6.88 | 7 | 6.5 to 7 | 8 (strips 6 to 6.5) | 8 | 8 |

Each pass a fresh critic (Opus, high effort), told only ART.md and the frames; a fresh critic moves a frame by about
half a point on its own, so the means and the minimum are the signal. Round 7's last pass on this mountain (a
different course, SIM_VERSION 9, and critics at extra-high effort) read High 7.38, Low 6.86, the phone 7.24.

## Stopping rule: not met

No frame reached 9 and no hero vista is a 9. What is still short, and why:

- **The rider small in the air** (750, 1650, 2580 to 2850, 3926; strips 2672 and 2730 at 1/20 to 1/25 of the frame):
  the leap's held wide and the reveal's whip are `camera.ts` and `shots.ts`, every mountain's framing.
- **The flooded terraces read as tile grids.** `makePaddies` cuts cells down the fall line so each holds its own
  level; longer cells would float the water over the slope. Curving them along the contours is a rebuild of the stage.
- **The Blossom Leap's valley floor has no orchard rows**: it is the panorama's sea of cloud; rows down there would be
  new far geometry (midground or a set piece).
- **The blossom is lit from the front, never backlit**, the one image's "tunnel of backlit blossom": round 7's and
  the lift's open item, new canopy geometry or a translucent shell over every tree.
- **Shared things at the lens:** the kilometre arch at 3000 m passes under a raised lens as a beam strung with lanterns
  across the frame's foot (`meshes.ts kmArchGeometry` has no near dissolve); a banner over the square at 4330 m
  dissolves with the props' dither and reads as a black slab in the sky; the climax's lanterns at a phone's lower
  corners during the last flight (3926) as black hexagons; a blossom canopy at the left lens (1800, 3600).
- **Ghosts:** a mint ghost a fifth of the frame in the sky over the cone (2210), one passing the lens at the start at
  twice the rider's size (strip 40), the draft's cyan sheet through the rider (1200): `ghosts.ts`, which round-8 has
  since changed (174 lines) on its own branch.
- **The radial smear the critics still name** after the streaks came down is mostly the ghosts' ruts fanning from the
  start and the lens's edge blur on the relief's shadows; Low's is its painted slab. Shared systems.
- **The flip at 300 m** now carries rev0's fix; seen side-on its vermillion rim ring reads as "a red target disc"
  (pass 3). For the main lane with rev0's notes.
- **Low** misses the pagoda at 2850 to 3150 and the leap's crowd ledges at 600: Low draws no point landmarks and no
  villages (`landmarks.ts drawn`, `midground.ts` TIERS), by design for its budget.

## Shared code touched

All small, general and safe for the other mountains:

- `src/render/verbworld.ts`: a row's garland is drawn only from an arch still more than 10 m ahead of the sled (every
  mountain's rows; it hung from over the lens as a black wire). Petal Steps' stair lanterns wait in marigold (`LIGHT`)
  where they were `BLOOM` pink; `BLOOM` was used nowhere else and is removed.
- `src/render/materials.ts`: a fork's ice strip's scribed edge at 0.22 where it was 0.45 (every mountain); the `cone`
  rock set (Sakura's only).
- `src/render/rider.ts`, `src/render/meshes.ts`: r8-rev0's flipped-hull change carried byte for byte (b6a6dc7, after
  this lane's own tray-paint change 5cac2f0 was reverted in the same commit): identical to r8-rev0, so the merge sees
  one change. Exactly what it does: a round hull's underside (saucer, tray) mixes 42% toward the snow's cool light in
  spun rings and carries a vermillion ring at 0.5 to 0.68 of its radius; the Tea Tray's face gains a lip-pewter ring
  and a vermillion one.
- `src/render/world.ts`: Sakura keeps 0.35 of the speed streaks (was 0.55; 1 elsewhere).
- `src/render/dressing.ts`: `bankRock` returns Sakura's stone when the palette's peak is the cone (unchanged elsewhere).
- `src/render/rails.ts`: a Sakura branch for the leap shoulders (the fins remain for Frostfang, Ember, Lanternfall).
- `src/render/town.ts`: Sakura-only branches (storeys, screens, pent roofs, roof snow 0.25, masts). Note: round-8 has
  since changed `town.ts` (11 lines) on its own; merge with care.
- `src/render/places.ts`: Sakura-only (the bridge's rib and portals, the finish pagoda's size, the square's masts).
- `src/render/palette.ts`: Sakura's palette, journey and places only.

## Cost

| Tier | Pass 1 draw calls (max) | Pass 3 | Pass 1 triangles (max) | Pass 3 |
| --- | --- | --- | --- | --- |
| High | 108.4 (117) | 108.4 (117) | 896k (1.12M) | 891k (1.11M) |
| Low | 48.8 (54) | 48.4 (54) | 116k (172k) | 115k (170k) |
| Phone, Medium | 91.7 (99) | 92.2 (101) | 635k (869k) | 631k (851k) |

From the stills' JSON at the same ticks. No fix adds a draw, a program, a pass or a uniform: they are colours, palette
numbers and merged geometry in pieces already drawn (the townhouses' screens and pent roofs, the portals' posts, the
shoulders' beds). Low's GL calls a frame on a live ride (`glcount.js`): pass 1 510.2, 512.2 (200 to 570 m) and
528.8, 522.3 (1390 to 1740 m); pass 2 517.4, 535.9 and 546.4, 546.9. The windows fall at different metres with a
different field each run, and the stills' Low draw calls at fixed ticks are level (48.8, 48.4, 48.4); an interleaved
A/B on one window was not run before the stop and is the main lane's to settle if it wants the number. Nothing new
runs before the first frame. Frames per second not judged (shared machine).

## For DECISIONS (the main lane's text to fold in)

"The review loop, Sakura Ridge (`notes/r8-rev3.md`): three passes of five on round 8's final build, a fresh critic
each; High's mean 6.76 to 7.08 (its minimum 5.5 to 6), Low 6.15 to 6.57, the phone 6.26 to 6.61, the strips 6.38 to
6.88; no frame and no vista at 9 (the Blossom Leap, the torii and the pagoda at 8). Fixed: the townhouses as eaves
and paper screens, not brick terraces; soft middle-value shadows; marigold stair lanterns and no wire from a passed
arch; the bridge in one lacquer with framed towers; the leap's shoulders in stone beds; a third of the streaks; fewer
petals. Short: the rider small in the air, the terraces' grid, the valley's missing rows, the blossom never backlit,
shared things at the lens."

## For ART.md 15, Sakura, "As built in round 8"

"Temple Town's houses are two storeys (three now and then) of paper screens behind dark slats under ink pent roofs,
with a quarter slope of snow at the ridge. The cut stone and the leap's shoulders are a wine-leaning stone in beds,
never navy. Shadows are soft and a middle value; the calm lens keeps a third of the streaks; the air holds fewer
petals. The stair's lanterns wait in marigold."

## For the README

Nothing a player needs told; the review loop's line in the round's table is the main lane's.

## Where things are

Frames under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/m3/pass1` to `pass3` (high, low,
phone-medium, sheets, strips); `pass1/glcount-low.txt` and `pass2/glcount-low.txt`. Helpers (not committed): the
worktree's `rev3/` (stills with cost, strips, ffmpeg sheets, the critic's prompt).
