# Round 9, milestone 0: three new mountains, seven concepts (the concepts lane)

The owner's ask: three new mountains, each fundamentally different from the five and from each other, so the game
gets new ways to ride. This lane designed seven, each with one signature mechanic on steer and one button, drew each
one's opening and one place in a small greybox tool beside three of the five drawn from their real sim courses in the
same greys, proposes a set of three, and ranks all seven.

Nothing here has been ridden. The concepts' figures are design numbers worked from the sim's own physics (its drag,
friction and gravity), not lab runs; the five's figures are the measure lane's lab runs (`notes/r9-measure.md` in its
worktree, raw output `shots/r9/measure/r9-courses.txt`). The frames were shot by a script; I looked at every one.

- The owner's page: `prototypes/r9/concepts.html` on the dev server (`npm run dev`, then
  `/prototypes/r9/concepts.html`). It draws every frame live from the greybox and lays this file out around them.
- The greybox: `prototypes/r9/greybox.html?s=<scene>&v=<opening|place>` (dev only; `prototypes/r9/greybox/`).
- The frames: `shots/r9/concepts/<scene>-<view>.png` (1280x720), made by `scripts/r9/concepts-frames.js`.
- The five's ground, read from the sim: `scripts/r9/concepts-five.ts`.

## The five, as the baseline

The measure lane's mid pilot (six seeds a mountain) and the courses themselves. These are the ranges a new mountain
has to leave:

| measure | the five, min to max |
|---|---|
| finish time, mid pilot | 121.3 to 129.4 s |
| mean speed | 35.1 to 37.4 m/s |
| airtime, share of the run | 24.2 to 35.3% (30 to 46 s; longest flight 3.7 to 5.8 s) |
| turns per km (the safe line's bends of 2 m and more) | 1.78 to 2.67 |
| mean width | 24.6 to 31.1 m |
| hazards per km (solid colliders) | 43 to 126 |
| clumsy pilot's finishes | 27 to 29 of 30 (Pinecrest and Sakura the hardest, 27) |

On the eight axes the five share nearly everything:

| axis | the five |
|---|---|
| length and pace | 4,500 m in three stages of 1,450, 1,500 and 1,550 m; a mid rider home in 121 to 129 s at 35 to 37 m/s |
| profile | a steady plain grade of 0.30 to 0.34, stepped by three leaps' cliffs (14.5 to 24.5 m) and the odd terrace |
| width and frame | one corridor between berms that rise about 7.5 m at the turn-back, 24.6 to 31.1 m wide on average |
| the opening | the same 120 m start ramp at 0.5, a wide bowl run-in, a kicker at 286 to 296 m, the first leap's lip at 605 to 653 m |
| the air | three leaps, about one kicker a kilometre on the line, a quarter to a third of the run in the air |
| ground and dangers | snow with patches of ice, static trees and rocks (43 to 126 a km); a fall is a tree, a rock or a landing |
| the finish | a lamplit town square, 300 m at 0.08, an arch and grandstands |
| light, weather, far plane | a clear high mountain, the panorama of ranges over a sea of cloud; storms only as a mood |

Two facts from the sim matter for every concept. The five's safe line bends only about two and a half times a
kilometre (its wander is long and slow), so their steering comes from the obstacles, not the course. And their speed
is the slope's: on snow a sled settles where drag and friction meet gravity, about 31 m/s on 0.29 (the sim's
`CD` 0.0027 and `MU` 0.03), so a gentler mountain is a slower one unless something else gives it speed.

## How the concepts are drawn

One greybox tool draws every frame the same way (`prototypes/r9/greybox/kit.ts`): flat-shaded greys, one key light
and a flat fill, a grey sky dome and fog, the chase lens 1.5 m over the snow 5 m behind the rider, its field of view
from the game's own speed curve (62 to 79 degrees), the rider's middle at the game's row (-0.30), and the rider as
a few dark blocks at the game's size. The five are drawn from `new Course(seed)` itself (`five.ts`): the sim's own
ground (corridor, banks, walls, falls, leaps, terraces, kickers), every obstacle where the sim lays it, and what the
world stands beside every one of the five (the start's gate and stands, the forest past the treeline, a street's
houses, a tunnel's gallery, the panorama of ranges over a sea of cloud). The concepts are ground functions and
pieces built to their own design numbers (`concepts.ts`). Three of the five are drawn (Pinecrest, Frostfang, Sakura):
their openings and a place on each.

![Pinecrest: the opening](frame:pinecrest/opening)
![Frostfang: the opening](frame:frostfang/opening)
![Sakura: the opening](frame:sakura/opening)
![Pinecrest: Mirror Lake](frame:pinecrest/place)
![Frostfang: the ravine](frame:frostfang/place)
![Sakura: Petal Steps](frame:sakura/place)

---

## 1. The Old Run: ride the wall

*An ice track cut down a forest a century ago for the grand hotel at its head, iced again every winter by the lake
town below. Riding high on the banked wall is the line.*

![The Old Run: the opening](frame:oldrun/opening)
![The Old Run: the Horseshoe](frame:oldrun/place)

**What is different.**

| axis | the Old Run | against the five |
|---|---|---|
| length and pace | 3,000 m (950 / 1,000 / 1,050); a mid rider about 85 to 90 s at about 34 m/s, 36 to 39 on the glaze | a third shorter; out on time |
| profile | steady at 0.17, no cliffs and no steps | half the five's grade, and none of their stepped cliffs |
| width and frame | a U channel: a 5.2 m floor, curved walls 2.6 to 7.5 m high, 15 m lip to lip; the walls are ridden | a narrow channel against a 25 to 31 m corridor; out on width |
| the opening | under the start house, inside the track: a flat 160 m straight and the first bend; no ramp, no leap | none of the shared opening |
| the air | none on the line (no leaps, no kickers) | out on air (under 2% against 24 to 35%) |
| ground and dangers | ice; slush in the floor of a bend; the lip at the top of the wall; no collider in the track | out on hazards (none against 43 to 126) |
| the finish | the outrun: the track flattens to the timing house and a sled coasts to a stop in it | no square, no town |
| light and far plane | a low late sun through a forest, the run lit by iron lamps on its parapet; the lake and its town far below | a mid-mountain forest; no panorama, no sea of cloud |

Different on all eight. Of section 2's six figures it is outside the five on five by design: time (about 88 s), air,
turns (about 12 bends a km against 2.7), width (15 m) and hazards (none); its mean speed (about 34 m/s) sits just
under the five's 35.1, the glaze line faster and the floor much slower.

**The course.** Three stages of track: the Hotel Straights (the start and two long S-bends), the Labyrinth (three
short S-bends close together) and the Horseshoe (one long hook of about 60 degrees, the deepest bank on the run) into
the outrun. New section kinds `track` (the channel; its bends authored a seed at a time, radii 40 to 120 m), `labyrinth`
(the tight S-bends) and `outrun` (the flat finish). Nothing of the five's kinds but a threshold at each stage line,
where the track runs straight and wide enough for three arches (one on the floor and one up each wall).

**Its signature mechanic: ride the wall.** A bend carries the sled up its outside wall by itself: the track turns,
the sled runs straight on, and gravity holds it on the bank. The steer sets how high: steer into the wall to climb,
let go and it settles, steer down to drop. In a bend the wall has three bands: low in the floor the snow the sleds
have scraped off lies as slush (slow: drag about 1.6, where a sled settles near 18 m/s); high on the wall is the
glaze, the polished band a fast line keeps to (drag 0.4: about 36 m/s on the run's grade, 39 in a tuck); at the very
top the lip turns a sled back with a scrape (speed and the combo, never a fall). On a straight the whole floor is fast
ice and the button is the tuck. So a run is: tuck down the straight, let the bend take you up, hold the glaze
through it, drop off the wall into the next bend's entry (the drop pays speed), and never touch the lip. It runs
through most of the run: about 60% of the track is bends.
- A novice is turned by the walls without steering at all and finishes, slower, low in the slush.
- An expert holds the glaze through every bend, takes the Labyrinth's three bends without dropping to the floor, and
  rides the Horseshoe high to its exit.
- The bot learns it from the course, not from a pool: a racing line written beside the safe line (the floor's
  middle), high on the outside of each bend by the rider's skill, which the bot's line-follower aims for as it aims
  for a slalom's line today (`bot.ts` `lineX`), and a wall term in its controller (on a bank it steers to hold a
  height, not a heading). Tuned in the lab against the mid pilot's figures before any pool is made.
- One HUD signal: none new. The world says it (the glaze shines and the runners hiss on it; the slush sprays dull);
  the stage line's one-line card carries each named bend's split against your best.
- Charms: on an all-ice run Frost Runners (ice holds and runs fast) and its Black Ice pair would decide too much;
  the charm races have to be ridden here before it ships, and the gates may keep those two off the Old Run's offers.

**What it takes.**
- *Sim, all additive.* A new biome id and seed, a `MOUNTAINS` entry, a `BIOME_PARAMS` entry (no trees, kickers,
  drops, moguls, vents or gates). New section kinds `track`, `labyrinth`, `outrun`. New shape fields `pipe` (the
  wall's height) and `bank` (the outside's rise with the bend), 0 in `PLAIN`, so every one of the five's shapes holds
  0 and `shapeAt`'s blend of the five's fields is unchanged. `bareGround` adds the channel's cross-section only where
  `pipe > 0`; `surface` returns the new slush, glaze and track-ice surfaces only where `pipe > 0`; neither branch is
  entered by the five. The centre line adds an authored bend term only on `track` kinds. The lip is the sim's own
  edge turn-back (`edge()`, a section `limit` of 0.6 m, near a bridge's 0.8). No new crash cause: nothing on the Old Run
  can floor a rider. Per mountain: stage lengths `[950, 1000, 1050]`, an opening of a start-house straight and no
  first kicker or leap, a finish of a 120 m outrun and a 200 m coast. Today's `STAGE_LENGTHS`, `opening()`,
  `FINISH_SQUARE` and `RUN_OUT` become the five's entries in a per-mountain table, holding today's exact values.
- *Set pieces.* Three on new verbs appended to `VERBS` (order kept): hold the glaze through the whole Horseshoe; ring
  the bend bells (be high at each bend's exit); beat the Labyrinth's split.
- *Fairness and budget.* The five's first-minute and leap tests do not apply; its own promises do: a sled that never
  steers reaches the line on every seed (the walls turn it); the floor is clear for the track's whole length; the lip
  never launches a sled; the glaze line beats the floor line by 10 to 20% for the mid pilot. The clumsy pilot should
  finish 30 of 30 (nothing here wrecks). No street or town piece; the start and timing houses are small.
- *Size.* A short, quick score: a galop for brass and snare at about 150 bpm, original, about 8.5 MB (the five's
  packs 9.0 to 14.0 MB; a faster tempo renders fewer seconds, as Ember's 138 bpm pack is the smallest). Its world:
  the track's mesh, the parapet, the start and timing houses, the hotel, the far lake and town; about Lanternfall's
  world's size in code (2,500 lines), loaded with the mountain.
- *Low.* Cheaper than the five: one channel mesh a chunk, the forest the five already draw (instanced), lamps in one
  draw, no crowd but two stands at the Horseshoe, no sea of cloud. Estimated 10% under Pinecrest's GL calls on Low; the
  ghost field (the round 8 cost) is the same.
- *Unlocks* after Ember: at 18 ghosts.
- *Risk.* If the glaze pays too little it is a narrow corridor with no trees, and rides like the five's gullies; the
  10 to 20% the glaze must pay is the bar. The sim's sled on a 60-degree wall is untried: the ground step follows a
  heightfield and its heading is held within 60 degrees of the line, which may fight a bank. The first job is a
  prototype section in the lab with the mid pilot on it.

---

## 2. Gullhaven: ride the sea wind

*A run down the seaward flank of a cape: from the old beacon on its 1,000 m head along the clifftop shelves to the
harbour at its foot, the sea always on your right. A storm is out at sea. Where the cliff is cut by a gully, the sea
wind climbs it.*

![Gullhaven: the opening](frame:gullhaven/opening)
![Gullhaven: at the second gully's lip, the sea below](frame:gullhaven/place)

**What is different.**

| axis | Gullhaven | against the five |
|---|---|---|
| length and pace | 4,800 m (1,550 / 1,600 / 1,650); a mid rider about 160 s at about 30 m/s | the longest and slowest on the ground; out on time and speed |
| profile | shelves at 0.16 stepped down 26 m at each gully (about ten of them), 0.22 overall | stepped by gullies every 450 m, not by three cliffs |
| width and frame | a 20 m clifftop path, open on one side: the cliff falls to the sea on the right, the moor rises on the left | one bank only, and a fall of hundreds of metres beside it |
| the opening | from the beacon on the cape's head; the first gully at 330 m | none of the shared opening |
| the air | ten crossings of 3 to 5 s, lifted by the updraft; no leaps | long, slow, chosen flights where the five have three forced cliffs |
| ground and dangers | wind-packed snow, glazed rock slabs, the cliff edge (a fence turns a sled back); rocks and fishermen's huts | about 20 colliders a km against 43 to 126 |
| the finish | down the slipway onto the harbour's ice, the line between the two pier-head lights | no square |
| light and far plane | a storm deck over the sea, a low sun under its edge, the lighthouse's beam; the sea to the horizon | sea level, not a high mountain; no panorama, no sea of cloud |

Different on all eight. Outside the five on time (about 160 s), mean speed (about 30 m/s), turns (the path's
detours inland round each gully head, about 5 bends a km), width (20 m) and hazards (about 20 a km). Its airtime
share depends on how many gullies a rider soars: a mid rider who soars most of them is about 30 to 35% in the air,
inside the five, but in flights twice as long.

**The course.** Three stages: the Cape (the beacon, the high shelves, the first four gullies), the Geos (the steepest
cliffs and the Great Geo, the widest crossing), the Harbour Road (the last gullies, down through the fish sheds to the
slipway and the harbour). New kinds: `cliffpath` (a corridor whose right side falls to the sea and whose left climbs),
`geo` (a gully crossing: the path bends inland round its head; the straight line crosses its mouth), `harbour` (the
finish on flat sea ice between frozen-in boats, off the line). The five's kinds it uses: `cruise` (the thresholds),
`chute` (down to the harbour), `street` (the fish sheds).

**Its signature mechanic: ride the sea wind.** Where the wind meets a gully it climbs, and over each gully's mouth
the air lifts a sled in flight (a fixed column, always the same, shown by spindrift streaming up and gulls hanging
still in it). Second by second: on the shelf the path swings inland round the gully's head; hold the straight line at
the gully's lip instead, pop off the edge, and in the air steer to keep the column under you (its lane of lift is
narrower than the gully: leave it and you drop); the lift holds you for three to five seconds, time for a grab, a
spin, a flip; come down on the far shelf and stomp it. It runs through the whole run: about ten gullies, one every
450 m.
- A novice rides the path round every gully head, slower and safe; one who falls short of a far shelf lands in the
  gully's chute, a face no steeper than a leap's, and rides it down onto the far shelf.
- An expert soars every gully and chains tricks across them; the lift gives the longest flights in the game.
- The bot learns it from the course: its flight model (`model.ts predictFlight`) adds the column's lift, a pure
  function of position; whether to take the straight line is its nerve and its speed at the lip (as the fork's bold
  route is today); in the air it steers toward the column's middle as it steers toward a ring today.
- One HUD signal: none new. The world shows the lift (spindrift, gulls, the snow fence's flags standing up); the
  stage line's card names a gully as you come to it.

**What it takes.**
- *Sim, all additive.* A new biome id and seed, `MOUNTAINS` and `BIOME_PARAMS` entries. New section kinds
  `cliffpath`, `geo`, `harbour`. A new shape field `seaward` (which side a `fall` takes: 0, both, for the five's
  bridges, so the five's `edgeRise` is unchanged). A new optional zone feature, the updraft (a box of rising air with
  its lift), and the gully's notch (where the ground seaward of the head is the gully's floor): both arrays absent from
  the five's zones, so `ground()` and `airStep()` loop over nothing for them. In `airStep`, inside an updraft,
  `vy += lift * DT`, only where a zone holds one. Per mountain: stage lengths `[1550, 1600, 1650]`, an opening at the
  beacon (no ramp, no first kicker or leap), a finish on the harbour ice with a 200 m coast along the pier.
- *Set pieces.* New verbs: soar (stay aloft across the Great Geo); the stacks (thread the sea stacks on the
  shore road below the cliff); the beam (be in the lighthouse's beam as it sweeps the harbour road, a timing gate
  that moves on a clock, as the swinging lanterns do, never a hazard).
- *Fairness and budget.* New promises: the path's lane is clear and never leaves the clifftop; the sea's edge turns
  a sled back and never over; every gully's lip, ridden straight at 24 m/s or more, lands on its far shelf, and
  slower lands in its chute on a face no steeper than a leap's; the lift acts only in the air and is the same for every
  rider. The harbour's boats and sheds are a finish town's budget (78k triangles on Low, 155k on High).
- *Size.* A reel for squeezebox and fiddle over a deep drum and a low choir, about 104 bpm, original: about 11.5 MB.
  Its world: the clifftop, the sea plane and its swell lines, sea stacks, the storm deck (Ember's deck pass), the
  beacon, the lighthouse and its beam, the harbour.
- *Low.* About Ember's cost: the sea is one plane (painted on Low), the storm deck is Ember's (Low drops its fine
  octave), few trees (a moor), sea stacks instanced, spray pooled. The harbour is a finish town. Estimated level with
  Ember's GL calls on Low (about 500).
- *Unlocks* after Sakura: at 32 ghosts, the last before the finale.
- *Risk.* DECISIONS 277 kept the storm coast back because "a harbour is a fifth day-lit snowfield": the storm light,
  the sea beside the whole run and the soaring are the answer. The risks are the lift's strength (too weak and the
  gullies are the five's leaps turned sideways; too strong and nobody rides the path) and the lens: a long flight
  beside a 1,000 m fall needs the vista beat the five already have.

---

## 3. Gablefall: roof to roof

*A hill town of steep roofs packed down a valley side, so snowed in that the roofs are the way down. You start on
the church's roof at the top of the town and ride the roofs down to the river.*

![Gablefall: the opening](frame:gablefall/opening)
![Gablefall: roof to roof](frame:gablefall/place)

**What is different.**

| axis | Gablefall | against the five |
|---|---|---|
| length and pace | 2,800 m (900 / 950 / 950); a mid rider about 100 s at about 28 m/s | the shortest; out on time and speed |
| profile | a staircase: each house's roof a 1.9 m step under the last, an alley's drop of about 3 m between blocks; 0.22 overall | stepped every ten metres, not by three cliffs |
| width and frame | two levels: a 9 m street between two rows of roofs 11 m deep (31 m in all); house fronts at the lens | the run is architecture, above a street |
| the opening | on the ridge of the church's nave, the steeple behind; the first roof 6 m on | none of the shared opening |
| the air | 30 to 40 short hops (0.5 to 1 s) across the alleys and off the steps; no leaps | many short flights, no cliffs |
| ground and dangers | snow on slate; chimneys and dormers; the alleys; the street's cobbles and barrows | out on hazards (chimneys and house fronts, about 150 a km) |
| the finish | off the boathouse roof onto the frozen river, the line under the old stone bridge | no square: the river |
| light and far plane | a snowfall in a grey afternoon, windows lit; the far plane is the town's other half across the valley and a viaduct | low down, no peaks, no panorama |

Different on all eight. Outside the five on time (about 100 s), mean speed (about 28 m/s) and hazards (about 150 a
km); its width (31 m with the roofs) and air (about 26% of the run) sit inside the five's range, so its two are time
and speed, with hazards a clear third.

**The course.** Three stages: Church Hill (the nave, the steep old town), the Market (the widest street, a square at
the stage line for the charm gate), the Water Stairs (the last rows down to the boathouse and the river). New kinds:
`rooftops` (the street and its two rows of roofs, blocks and alleys from the seed), `square` (a small plaza at each
stage line, where the rows open for the gate's three arches), `quay` (the finish on the river ice).

**Its signature mechanic: roof to roof.** The roofs are the fast line and the street the slow one. Along a row each
house's roof is a step down from the last; every 35 to 60 m an alley cuts the row. Second by second: ride the snow on
the ridge (it falls away to the eaves either side), weave the chimneys, hold the button into each alley and let go
at the eave; the next roof is usually lower (the flight carries you), sometimes level or higher (a pop is needed),
and every landing stomped pays the perfect landing's boost, which is what keeps a rider fast on a 0.22 grade. Miss an
alley, or ride off the eave, and you drop into the street: you land, you ride on between the house fronts, slower on
the cobbles, until a drift banked against a corner takes you back up onto the roofs (one at least every 250 m).
- A novice rides much of it in the street and finishes; the street is its safe line, clear and gentle.
- An expert never touches the street and stomps every roof.
- The bot learns it from the course: it plans pops at the alleys with the flight model it already flies kickers with
  (`popFlight`, which reads `course.ground`), keeps to the ridge as it keeps to a fork's channel (`backX` learns the
  row's crest), and chooses roofs or street by its nerve.
- One HUD signal: none new. The roof run reads as the combo's chain; the stage line's card says the row ahead.

**What it takes.**
- *Sim, all additive.* A new biome id and seed, `MOUNTAINS` and `BIOME_PARAMS` entries. New section kinds `rooftops`,
  `square`, `quay`. A new zone feature, the block (one side's run of roofs: where it starts and ends, its roofs'
  heights), absent from the five's zones; `ground()` raises the ground over a block's footprint to its roof only where
  a zone holds one. New obstacle kinds `facade` (a house front as a capsule along the street, as tall as its eave:
  solid to a sled in the street, cleared by one on the roof, by the sim's own rule that a sled over a collider's top
  clears it) and `chimney`. The drifts back onto the roofs are the existing ramp. Per mountain: stage lengths
  `[900, 950, 950]`, an opening on the nave (no ramp, kicker or leap), a finish on the quay.
- *Set pieces.* New verbs: a chain (land five roofs in a row without touching the street); the washing lines (pop up
  through the lines strung across an alley, as a bell is rung); the market awnings (stomp the awnings down the market
  street; `steps` is already used twice).
- *Fairness and budget.* New promises: the street's lane is clear (every facade SAFE_LANE and a sled's radius off
  the line); every drop from a roof into an alley or the street lands on flat ground from 9 m at most; a drift back up
  at least every 250 m; a facade never floors a sled turned along the street (the street's bends are gentle enough
  that a sled meets a front only glancing). The budget is the risk: the town is everywhere, where the five's street
  piece is 30k triangles on Low and 66k on High for 120 to 200 m.
- *Size.* A march for hand-bells, pizzicato strings and a toy piano at about 128 bpm, original: about 10 MB. Its world
  is the biggest of the three: houses down the whole run, chimneys, the church, the far town and viaduct, the river.
- *Low.* The costliest of the three: about 400 m of town in view both sides, which is two or three of the five's
  street pieces at once. Estimated 5 to 10% over Pinecrest's GL calls on Low unless the town past the first row is a
  baked far piece (a card a chunk); with that, level. The windows are emissive in the house material, not lights.
- *Unlocks* after Frostfang: at 8 ghosts, the first new mountain a player meets. It teaches the pop and the stomp, the
  game's air skills, on a run as short as any.
- *Risk.* If the roofs do not pay, riders drop to the street and ride a 9 m corridor between house fronts for 2.8 km:
  the five's street, stretched. The stomp's boost and the street's cobbles must make the roofs clearly faster. And
  every finish of the five is already a lamplit town: Gablefall must look like nothing the five finish in (snowfall,
  daylight, the roofs from above, no square at the line).

---

## 4. Windfall: duck and hop

*An old forest on a valley flank that a great storm felled in swathes, years ago: trunks lying across the slope, more
hung up on each other at chest height, root plates standing like walls. The loggers' slide brings you in; their
sawmill by the frozen millpond is the finish.*

![Windfall: the opening](frame:windfall/opening)
![Windfall: the hung-up gallery](frame:windfall/place)

**What is different.**

| axis | Windfall | against the five |
|---|---|---|
| length and pace | 3,900 m; a mid rider about 125 s at about 31 m/s | inside on time; out on speed |
| profile | rolling forest floor at 0.24, no cliffs | gentler, no cliffs |
| width and frame | a 16 to 24 m way through the forest, trunks overhead at chest height and higher | a corridor, as the five's; narrower |
| the opening | down the loggers' timber slide, a plank trough 140 m long, into the forest | none of the shared opening |
| the air | 25 to 35 hops over lying trunks; a root-plate kicker a stage; no leaps | many short flights, no cliffs |
| ground and dangers | lying trunks (hop), hung-up trunks (duck), root plates, stumps, snags | a new kind of danger: overhead |
| the finish | the sawmill's log ramp onto the millpond's ice | no square |
| light and far plane | a low sun through a broken canopy: hard bars of light and shade; the valley's far side through the gaps | mid-mountain; no panorama |

Different on six of eight (not on width and frame, nor really on profile). Outside the five on speed, air (about 15%),
turns (about 5 bends a km) and hazards (about 200 a km).

**Its signature mechanic: hold to duck, let go to hop.** The button already crouches while held and pops when let go.
Here that is the whole rhythm: a hung-up trunk across the line at chest height is ridden under crouched (held); a
trunk lying across is hopped (let go just before it); and the two come close together, so a pop let go too early rises
into the next beam. A new obstacle kind, the beam, collides only with a sled whose rider is upright or in the air at
its height. Every 25 to 60 m down most of the run.
- A novice holds the crouch (it is also the tuck) and rides the line, where every lying trunk is broken; it ducks
  every beam by holding and never hops.
- An expert takes the straighter line over the lying trunks and pops between beams for the lights and the tricks.
- The bot learns it from the course: hold through a beam's band (the scene already gives it every collider ahead),
  release for a hop with the flight model it pops kickers with. The simplest bot work of the seven.
- One HUD signal: none new. A beam reads as a dark bar across the run at chest height, the hardest silhouette in the
  frame (ART.md 1: a danger is a dark, hard shape).

**What it takes.**
- *Sim, additive.* A biome, seed and `MOUNTAINS` entry; a new obstacle kind `beam` whose collision reads the rider's
  height (crouched while the button is held on the ground, upright otherwise, and the sled's own height in the air),
  entered only for that kind; lying trunks are the existing `log` (a sled over its top already clears it); root plates
  are a new hard kind. Per mountain: 3,900 m in three stages, an opening down the `slide` (a plank trough, no ramp, no
  leap) and a `millpond` finish.
- *Fairness.* A new promise: the line is clear of every collider but beams, every lying trunk across it is broken
  where it runs, and a rider holding the button passes every beam. The five's line-follower never presses, so Windfall's
  own driver holds.
- *Size and Low.* A score of about 9 MB (a woodblock-and-low-strings piece near 140 bpm). Cheap on Low: trunks are
  instanced like trees; the forest is the five's.
- *Unlocks* where Gablefall would (at 8 ghosts): the duck is a first-hour lesson.
- *Risk, and why it is last.* In the five's colours it is a forest corridor with logs: the grammar of Pinecrest's
  tree runs. The blind sort bore it out: the critic put Windfall's frames with the five's alpine family ("in a
  thumbnail they read as one mountain"). Holding the button is also the tuck (faster), so a novice
  who holds through everything is not punished; the beams bite only on a rider who pops, which is the point, but it
  makes the duck an expert's problem more than a novice's.

---

## 5. Longswell: pump the swells

*The ice cap's edge, where it runs down to the sea in long wind-carved swells: a research party's camp at the top, the
calving front at the bottom, nothing but ice to a flat horizon.*

![Longswell: the opening](frame:longswell/opening)
![Longswell: on a swell, the next ones to the horizon](frame:longswell/place)

**What is different.** 5,000 m at 0.17 with swells 3.2 m crest to trough every 45 m, skewed 15 degrees off the fall
line; open, 60 to 120 m wide between wands; flat horizon, no mountains; a low midnight sun skimming the swells; no
leaps; crevasses crossed on snow bridges; the finish at the calving front. Different on all eight. Outside the five on
time (about 165 s), speed (about 30 m/s), air (under 15%), turns (under 1 a km), width and hazards (under 10 a km).

**Its signature mechanic: pump.** On 0.17 a sled on snow settles at about 24 m/s; the swells give the rest. Hold the
button down each swell's face (the tuck, pressing into the trough) and let it go at the trough (the small pop
unweights you up the next face); a new pump term in the sim pays speed for a hold that spans a face and a release near
its trough, only on the `swells` kind. Hold through a crest at speed instead and you take off. A novice rides at the
slope's speed and finishes; an expert pumps to 36 m/s. The bot reads each trough and crest from the ground ahead (a
pure function of the course) and times its holds; the one HUD signal is none new (the swells' long shadows in the low
sun show every face).

**What it takes.**
- *Sim, additive.* A biome; a `swells` kind (the swells in `bareGround` where its new shape field is set); the pump
  term in the ground step, entered only on that kind; crevasses as ground with snow bridges on the line. Per mountain:
  5,000 m, an opening at the camp (a flat push onto the first swells), a finish 300 m short of the calving front.
- *Fairness.* The line crosses every crevasse on a bridge; a rider who never pumps reaches the line at the slope's
  speed; no swell launches a sled that does not press.
- *Size and Low.* A score of about 9 MB (a slow drone with bowed metal and a pulse, near 90 bpm, kept lean by few
  sections). The cheapest world of the seven on Low: almost nothing stands on it.
- *Unlocks* after Sakura (at 32), if chosen.
- *Risk.* The button's release is already a pop, so the pump and the pop share a press and the timing is subtle on a
  keyboard and a phone; five kilometres of one rhythm may be monotonous; and a polar ice cap sits near Frostfang's
  fiction (the light is the difference: a midnight sun, not a blue hour).

---

## 6. Whitemantle: read the face

*No corridor: a whole snowfield 400 m wide under a summit in cloud. Bands of rock and cliff cross the face every 300 m,
each with a few passages; you read the face and pick your line.*

![Whitemantle: the drop-in](frame:whitemantle/opening)
![Whitemantle: the second band](frame:whitemantle/place)

**What is different.** 3,300 m, steepening from 0.40 to 0.57 then a run-out on the glacier (about 88 s at about 38
m/s); open, 400 m between arêtes; a drop-in over the summit cornice instead of the ramp; air you choose (cliffs of 3 to
13 m along each band, passages where there are none); rock bands and séracs; the finish at a bivouac hut on the
glacier. Different on seven of eight (it is the one high mountain; its cloud is above, not below). Outside on time,
speed, width and hazards.

**Its signature mechanic: read the face.** Every band can be passed at several places: a marked passage (the safe
line, poles down it), a cut through a lower cliff, a drop off a high one straight down the fall line. A novice follows
the poles; an expert reads 300 m ahead and takes the fall line over the cliffs. The bot needs a route planner: each
band's passages and drops as a small graph, a rider's nerve choosing among them (as `bold` chooses a fork's channel
today). The one HUD signal: the next marker pole's bearing on the edge chip.

**What it takes.**
- *Sim.* The most of any concept: a `face` kind hundreds of metres wide; cliff bands whose height varies across the
  run (the sim's ledges are across the whole corridor today, so a new x-local ledge in `ground()`, entered only where
  a zone holds one); per mountain, a drop-in opening and a glacier finish.
- *Render.* A terrain mesh fine out to 200 m from the line (today it is fine out to 12.6 m past the corridor's start
  width), and a far plane that is the face itself.
- *Fairness.* The marked route is the safe line, clear and smooth; every cliff off it lands on a face no steeper than
  a leap's; a passage at least every 120 m along a band.
- *Size and Low.* A score of about 10 MB. Few props (rock along the bands), but much more ground in view: about the
  five's cost if the far face is a coarse mesh.
- *Unlocks* behind the finale (Almanac page), if chosen: the hardest read.
- *Risk.* The chase lens is 1.5 m over the snow; from there a 400 m face does not read, and "find your own line" can
  become "hold the fall line" if the bands are weak.

---

## 7. Rimewater Gorge: turn on the snow

*A river that goes under the ice: a gorge 30 to 50 m deep, roofed over half its length by bridges of snow and ice,
light falling through the gaps. Frozen falls step it down to a lake.*

![Rimewater Gorge: the mouth](frame:rimewater/opening)
![Rimewater Gorge: under the ice](frame:rimewater/place)

**What is different.** 3,600 m on glare ice at 0.09 stepped by frozen falls of 5 to 9 m (about 128 s at about 28
m/s); a 22 to 28 m river between vertical walls, a ceiling over half of it; no leaps but the falls; ice columns; the
finish on the lake at the gorge's mouth; light from above in shafts. Different on seven of eight. Outside on speed,
turns (about 8 a km), width and hazards; inside on time.

**Its signature mechanic: turn on the snow, glide on the ice.** The glare ice holds almost no grip; snow lies in bars
on the inside of each meander. A sled turns where there is snow and carries its heading over the ice; the drift is the
tool on the ice. A novice slides wide into the walls (which turn it back, as a ravine's do) and finishes slower; an
expert sets every turn on a bar and drifts the ice between. The bot reads the surface along its planned line (the
course says it, a pure function) and plans its turns on the bars. The one HUD signal: none new (snow is white and
matt, glare ice dark and glossy).

**What it takes.**
- *Sim, additive.* A `gorge` kind (vertical walls through its section `limit`), a grip map (a surface by place,
  entered only on that kind), falls as the terraces' steps; per mountain, an opening at the mouth on the snowfield and
  a finish on the lake.
- *Fairness.* The line runs over snow where it turns; the falls are steps a sled at 20 m/s and more clears onto flat
  ice; columns stand off the line.
- *Size and Low.* A score of about 9 MB. The ceiling is the cost: a roof the length of half the run, its shafts painted
  on Low as the five's tunnels' are. About the five's cost.
- *Unlocks* after Ember (at 18), if chosen.
- *Risk.* An ice slot that bursts out into light is Frostfang's fiction (its ravines and its Ice Cavern), though the
  blind sort put the gorge apart from every frame of the five; grip by place is subtle at speed on a keyboard; and on
  an all-ice run the ice charms decide too much. The ceiling must read as a ceiling: the critic could not tell the
  mouth's roof from a wall or a bridge, nor which side of a column on the line to take.

---

## The three I propose: the Old Run, Gullhaven, Gablefall

Three verbs nobody has ridden here: carve the wall, fly the wind, hop the roofs. Each is a different frame (a channel,
an edge, a town from above), a different length (2.8, 3.0 and 4.8 km) and a different light (a forest's low sun, a
storm over the sea, a snowfall).

| axis | the Old Run | Gullhaven | Gablefall |
|---|---|---|---|
| length and pace | 3,000 m, about 88 s, quick on the glaze | 4,800 m, about 160 s, slow on the ground | 2,800 m, about 100 s, slow |
| profile | steady 0.17 | shelves stepped by gullies | a staircase of roofs |
| width and frame | a 15 m channel, walls ridden | a one-sided clifftop | two levels: street and roofs |
| the opening | the start house, in the track | the beacon on the cape | the church's roof |
| the air | none | ten long lifted flights | thirty-odd short hops |
| ground and dangers | ice, slush, the lip | snow, glazed slabs, the edge | snow on slate, chimneys, house fronts |
| the finish | the outrun to the timing house | the harbour ice | the river under the bridge |
| light and far plane | forest at a low sun; the lake far below | a storm over the sea | a snowfall; the town across the valley |

- *Each pair differs on all eight axes* (the brief asks for four). On section 2's six figures no pair is within 10%
  on more than one (the Old Run and Gablefall are both short: 88 and 100 s are 12% apart).
- *None is a high mountain above cloud* (the brief asks for two of three): a mid-mountain forest, a sea cape, a hill
  town.
- *None unlocks behind the finale.* With the five: Pinecrest (0), Frostfang (4), **Gablefall (8)**, Ember (12), **the
  Old Run (18)**, Sakura (24), **Gullhaven (32)**, Lanternfall (The Twelve, or Almanac page 21). Gablefall comes first
  because it teaches the pop and the stomp on a short run; the Old Run is a carving skill mid-game; Gullhaven is the
  longest and airiest ride and the last before the finale, its storm and its sea at dusk a step toward the night.
- *Trials.* The four measures are time, a clean run, style points and perfect landings. The Old Run brings time and
  the clean run (style is wall rides and drifts; it has no perfect landings, so the rotation skips that measure on it);
  Gullhaven style and perfect landings (the longest flights in the game); Gablefall perfect landings above all (dozens
  a run) and the clean run.
- *The Long Night.* The Old Run is the sprint leg (floodlit at night by its parapet lamps), Gullhaven the long leg (the
  lighthouse's beam), Gablefall a leg of lit windows in the snowfall.
- *What each is not.* The Old Run is not a long gully: the glaze has to pay. Gullhaven is not a day-lit snowfield
  with the five's cliffs turned sideways: the lift has to be felt and the storm has to be the light. Gablefall is not
  the five's street stretched: the roofs have to be the fast way.

The swap if the owner wants a cheaper third than Gablefall: **Rimewater Gorge**, which the blind sort set apart from
the five and which costs about what the five cost on Low; or **Longswell**, the cheapest world of the seven and also
set apart, if a subtle mechanic and an empty frame are acceptable. Not Windfall: the blind sort put it with the five.

The sort's warning for the set: the Old Run's frames went with Windfall's, beside the five's alpine family, as "a
lesser outlier" that "rides as a luge or wall ride". The channel was read; the pine forest and the faint peak at its
vanishing point were the five's. Its world has to be its own: no pine cones, no hero peak at the end of the track (the
lake and its town instead), and the run's lamps and parapet carrying the place.

## The ranking, all seven

1. **The Old Run.** The strongest new verb for the least sim: the physics are already there (gravity on a banked
   cross-section carries a sled up the wall), the danger is time and never a fall, and it is cheaper than the five on
   Low. Its channel was read blind as a luge; its forest was not new, which the world lane can fix and the sim cannot
   break. Its risk is a lab question, answered early.
2. **Gullhaven.** The biggest new feeling (the longest flights in the game, by choice) and the direction the owner
   named that lost in round 7 for a reason this concept answers. Moderate sim (a lift in the air, a notch in the
   ground); its world and its lens are the work.
3. **Gablefall.** The strongest place and different on every axis, with the game's own air skills as its verb. The
   costliest world of the three and a risk on Low; its fallback street must not become the ride.
4. **Rimewater Gorge.** A real mechanic (grip by place) and a frame the blind sort set apart from all five, where I had
   expected it to go with Frostfang; about the five's cost. Its grip is subtle on a keyboard and its ceiling has to
   read.
5. **Longswell.** A place unlike anything (the critic: "the most empty frames of the set") and almost free on Low; but
   its mechanic shares a press with the pop, may be subtle and long, and "nothing to steer round" is a ride's risk too.
6. **Whitemantle.** The freest idea (no corridor) and set apart blind, but the most sim and render work, the low chase
   lens works against reading a face, and its far plane (a valley and a saw of ranges) is nearest the five's panorama.
7. **Windfall.** The best use of the one button (hold and let go as a rhythm) and the cheapest to build; but its frame
   is the five's corridor and the blind sort put it with them, which is the one thing a new mountain must not be.

## The directions weighed

- *A storm coast:* Gullhaven.
- *A rooftop run:* Gablefall.
- *A gorge under the ice:* Rimewater Gorge.
- *A banked ice run:* the Old Run.
- *An open face:* Whitemantle.
- *A descent by your own light:* not made a concept of its own. Its difference is the light, and Lanternfall and
  Lantern Night already own the dark and the lantern's marigold; as a mechanic, either the fairness rule (every hazard
  shows in time) leaves the lantern's reach nothing to decide, or it becomes a third use of the lantern, which DECISIONS
  277 rejected. Its look lives on in Rimewater's dark between the shafts.
- *My own:* Windfall (duck and hop) and Longswell (pump).

## The critic's sort

The twenty frames (the seven concepts' openings and places, and the openings and places of Pinecrest, Frostfang and
Sakura), greyscale, unlabelled and shuffled under neutral names (`scripts/r9/concepts-blind.mjs`, seed 9091; the
key in `shots/r9/concepts/blind-key.json`, outside the folder the critic saw), went to a fresh critic (Opus, extra
high effort) given only ART.md and the frames, asked to sort them into courses, say which are unlike the rest and why,
and say what it could not read. It was told neither how many courses there were nor that any were new.

What it got, decoded:
- **The five are one mountain.** All six of the five's frames went into one group, "alpine valley", sure it is one
  mountain; the three openings it called "literally one opening", wondering only whether it was one course rolled
  three times. It told Pinecrest, Frostfang and Sakura apart only by which side the sun was on.
- **Every concept's two frames were put together**, all seven.
- **Set apart from the rest, with two or more differences that are not colour:** Rimewater Gorge ("walls fill both
  sides", "a dark wall or roof instead of peaks", columns, no trees, "threading pillars in a tube"), Longswell ("no
  banks, no corridor", "dead flat to a straight horizon", "a faint low skyline with no hero peak"), Gullhaven ("an
  exposed, rolling crest with no trees", snow fences, "a vast flat lower plane with pillars", "no mountains at all"),
  Gablefall ("long gabled houses, chimneys", "the run is a ledge or street above roofs", "a hazy valley floor with a
  scattered village, not peaks") and Whitemantle ("a flat lake fills the middle distance", "no trees", "a wide open
  slope falling to a shore"; it read the glacier as a lake).
- **Not set apart:** Windfall and the Old Run went into one group ("foggy forest luge") beside the five's, which "in a
  thumbnail read as one mountain" with them; the Old Run singled out within it as "a lesser outlier": "built concave
  walls with a rounded lip", "it rides as a luge or wall ride".
- **Kinds it saw shared:** Whitemantle, Gablefall and Gullhaven as "a run on a high shelf with a broad flat plane
  falling away to one side"; Longswell and Gullhaven's opening as open, bank-less expanses with a line of markers.
- **What it could not read:** the gorge's roof at the mouth (a wall, a roof or a bridge?) and a column on the line
  under it; Gullhaven's lip (a leap, a drop or a turn?) and its sea (cloud, water or ground?); Windfall's hung trunk
  (a log to hop, a rail, or a gate to duck under?); the Old Run's tree shadows across the trough (read as ridges); a
  kicker's plates in the five's openings; Longswell's way (no edges say where the run goes).

So in greyscale five of the seven pass the round's "not paintings" bar as drawn here, the Old Run half passes on its
channel alone, and Windfall fails. Of the proposed three, Gablefall and Gullhaven passed; the Old Run's world must be
drawn as its own. A greybox is a shape, and the critic is not a player.

## What the main lane must decide (and the owner)

1. **Which three.** The proposal is the Old Run, Gullhaven and Gablefall; Rimewater Gorge (or Longswell) is the cheaper
   swap for Gablefall.
2. **The Old Run's world.** The blind sort read its channel but put its forest with the five's: if it is chosen, its
   world lane starts from "not pines, no hero peak at the end of the track", and the sorting test is run on its first
   frames, not its last.
3. **What "it only descends" allows.** None of the three climbs on the line. Gullhaven's gullies and Gablefall's
   alleys are local drops a flight crosses. If the owner reads the rule as "never a rise at all", nothing changes for
   these three.
4. **A per-mountain course table.** Every concept needs its own stage lengths, opening and finish. Today those are
   shared constants (`STAGE_LENGTHS`, `opening()`, `FINISH_SQUARE`, `RUN_OUT`, and the first kicker at 286 to 312 m in
   `layKicks`); the groundwork makes them a table whose five rows hold today's values exactly.
5. **The fairness suite's shared promises** (the first minute, the leaps, the kickers) become the five's; each new
   mountain brings its own (written above), so the suite proves each on its own terms.
6. **New verbs.** Nine set pieces need verbs; `race`, `gates` and `steps` are used twice already and `follow`,
   `kindle` and `carry` are Lanternfall's, so the new mountains bring their own, appended to `VERBS` (the music's
   stingers key on its order, which is kept).
7. **The ice charms** on the Old Run (Frost Runners and its Black Ice pair would decide too much there): race them in
   the lab, and keep them off its gates if they do.
8. **The size cap.** The three scores are about 30 MB (8.5, 11.5 and 10 MB): the build goes from 60.33 MB to about
   91 MB, inside the proposed 110 MB cap and over today's 80 MB. Each full pack stays under Sakura's (6.0 MB), so the
   initial download does not grow.
9. **Gablefall's cost on Low** is the one estimate I would want measured before it is built: a baked far town is the
   plan.

## What only a person can judge

Whether riding a wall feels like the line or like a gutter; whether the lift over a gully feels like flying or like
floating; whether thirty hops down a town feel like a rhythm or a chore. The greybox frames show shapes from the chase
lens, not a ride.

## What is short

- Every concept figure (times, speeds, air, turns, widths, hazards, pack sizes, Low's cost) is a design estimate from
  the sim's physics and the five's measured figures, not a lab run: no concept exists in the sim. The first job of
  milestone 3 is a prototype section of the chosen mechanic in the lab.
- The greybox draws shapes, not the game: no colour, no grade, no particles, no crowd. Its frames are a fair comparison
  of shape (the five are drawn by the same kit from their real courses), not a picture of what a mountain would look
  like finished.
- Several greybox frames have readings the critic could not make (above). They are the greybox's, and they are also the
  first notes for each world: what must read at speed.
- Only scripts and one critic have seen any of it.

## Frames and files

- Frames: `shots/r9/concepts/<scene>-<opening|place>.png` (twenty, 1280x720), the blind set in `blind/` with its key
  beside it, and the owner's page as shot on desk and phone in `page/`. The page's console was clean on both; the
  greybox page's too, once its favicon and its shadow type were fixed.
- `prototypes/r9/greybox.html` and `prototypes/r9/greybox/` (the kit, the five from the sim, the seven concepts),
  `prototypes/r9/concepts.html` and `concepts-page.ts` (the owner's page, which renders this file and draws every
  frame live), `scripts/r9/concepts-frames.js` (the frames), `scripts/r9/concepts-blind.mjs` (the blind set),
  `scripts/r9/concepts-five.ts` (the five's ground read from the sim). Nothing in the game's boot path; no sim file
  touched.

## For DECISIONS (the text I would add; the main lane owns the file)

**The three new mountains: seven concepts, three proposed** (`notes/r9-concepts.md`; frames under
`shots/r9/concepts/`; the owner's page `prototypes/r9/concepts.html`). Seven concepts on the brief's eight axes, each
with one mechanic on steer and one button: the Old Run (ride the banked wall), Gullhaven (the sea wind lifts you over
the gullies), Gablefall (roof to roof down a hill town), Windfall (hold to duck, let go to hop), Longswell (pump the ice
cap's swells), Whitemantle (read an open face) and Rimewater Gorge (turn on the snow, glide on the ice). Proposed: the
Old Run, Gullhaven, Gablefall, which differ from each other on all eight axes, none above cloud, unlocking at 8, 18
and 32 ghosts between the five. A greybox tool drew each concept's opening and one place beside Pinecrest, Frostfang
and Sakura from their real sim courses; a fresh critic, blind, put all six of the five's frames in one mountain, set
five concepts apart, read the Old Run's channel but put its forest with the five's, and put Windfall with the five.
*Rejected:* a descent by your own light as a concept of its own (its difference is light, which Lanternfall owns, and
its mechanic is either empty under the fairness rule or a third lantern use, which 277 rejected).
