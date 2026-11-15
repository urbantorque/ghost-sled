# Round 7, phase 3: Ember Peak's review loop (mountain 2)

The loop of `notes/r7-review.md`: capture, an independent critic, fix, repeat. Every pass had a new critic, a
fresh general-purpose agent (pass 1 at medium effort on the first lane's model; from pass 2 on `model: "opus"`,
`effort: "xhigh"`), given only the frames' folders, `ART.md` and the brief's instruction, and told nothing of
what had changed. Frames: `shots/r7/review/m2/pass<K>/{high,low,phone-medium,motion,motion-low,motion-phone}`
in the main checkout. `motion` is six stills through the flight off each of the three leaps, on High: the sled
is pinned to the safe line at 47 m/s until 14 m short of the lip and let go, so the sim flies it
(`scripts/playtest/flights-r7.js`), because a pool rider (`demo=N`) rides its own chaos mood and not Clear
Skies. `motion-low` and `motion-phone` are the Caldera Leap's flight on Low and on the phone (from pass 2).

The lane was taken over part way: the first agent ran pass 1 and began the Caldera's lava lake; the second
finished it, committed it and ran passes 2 to 5.

**In short:** five passes, the brief's limit; the stop rule was not met. No frame is a 9 and no hero vista
is one; the best frames are 8.5 on the phone and 8 on High. Under one critic's standard (passes 2 to 5)
every set climbed every pass: High 6.46 to 6.97, motion 6.23 to 7.38, Low 6.59 to 7.01, phone 6.90 to 7.79.
The score table, what is still short, the shared code touched and the cost are at the end of the file.

## Pass 1: what the critic saw

High mean 7.19, minimum 5.5 (3450 m). Motion mean 7.22, minimum 6.0. Low mean 7.61, minimum 6.5. Phone
mean 7.90, minimum 5.5 (3450 m). No High frame a 9. Hero vistas on High: the cone from the start 7.5,
Cinder Gate's throat 7.5, the Caldera Leap 7, Ash Market's bridge 8.5.

Its findings, worst first:

1. 3450 m (High and phone): a flat grey-mauve veil over the cone, the sky and the walls.
2. The Caldera Leap: no lake from the approach or the lip, the rider flies along a snow tongue with lava
   either side, the lava a uniform tiling with olive corners, the smoke overhead not lit, the rider 60 px.
3. The snow on High a pale grey-peach over half of every frame; the orange and plum split only on a bank.
4. The grade barely moves between 0 and 3300 m. The basalt slots (900 to 1040 m, 2690 to 2850 m) are the
   same striped canyon with no lava in them and nothing lit from below.
5. The cone's summit and crater are above the top of a wide frame for most of the run.
6. Chimney smoke in the town is cold white against a red sky.
7. Low: a mustard patch on the slot's floor under a ring (993, 2691, 2850 m).

## After pass 1: what changed (commits 6da1990, 6d6013b)

- **The Caldera Leap's lava lake** (`stages.ts`). A crust floor under the flight, shore to shore across the
  run, from the foot of the cliff to the end of the landing face; the side fields lifted up the bowl to the
  rim (11 m at the outer shore) so they face the lens; the fields run on 50 m past the landing
  (`CALDERA_RUNOUT`, with the forest clearing to match in `landmarks.ts`); the lava shader rewritten as
  warped rafts on rivers of melt (thin cracks at a cool shore, wide channels and sunken rafts at the heart,
  most of a cool crust's cracks dulled to a dark seam and the lit ones broken along their length) where it
  was an even Voronoi honeycomb; a mark on the lava under whoever flies over it; embers through the flight
  in depth (420 on High, 200 on Medium); the glow sheets over the fields 26 m tall. One fix of the first
  lane's work: the field's first column clamped onto the terrain's first column past the shore instead of
  the shore itself, so a strip of bare snow ran between the floor and the fields the length of the flight
  (it was read as the terrain poking through; a probe that hid every other mesh showed the gap).
- **Lava at the walls' feet** in the basalt slots and the halls (`stages.ts` `makeRivers`): a crusted river
  along each wall's foot in runs, a faint breath of its light up the rock, organ pipes of basalt standing
  in it in the open slots. The lava joints' ground lights a little wider and stronger (`terrain.ts`).
- **The forge gate's flames** a bowl high or more, the soft glow round each mast wider; a cold bowl
  smoulders (`verbworld.ts`, the surge verb: also the generic Big Leap's host, where it is the same win).
- **3450 m**: the halls' mouth no longer throws the daylight burst (`landmarks.ts` exitFlash 0.12 on Ember),
  and the tunnel place lets go 46 m short of its section, so the halls' dark air and bloom do not lie over
  the slope past the mouth as a grey veil.
- **The cone** stands at 1040 m over the lens (was 1360), so its crater is inside a wide frame; the eruption
  is placed from it (`massif.ts` `VOLCANO_TOP`, `legendworld.ts`), and `LegendWorld.setConeBearing` is now
  called from `World.setCourse` with the palette's `massif.heroAz` (7 on Ember, which was the default).
- **Grade**: the deck closes from 500 m (dark zenith, the fire drawn down to a band, a stop lower); the
  shield's deck lit from below; the town's night begins at 3400 m so the bridge has it; Ember's smoke in
  the town is dark and lit from below (`life.ts`); the deck's cloud shadows drift over the snow; sparkle
  0.9; the valley under the smoke glows in pools.
- **Low's light pools on Ember** (`materials.ts`, palette `poolSoft`, 0 everywhere else): a paler, warm step
  of the snow they lie on, never added past white. The marigold of a sky gate or a pickup on Ember's warm
  snow had clipped to mustard. On Low the lava joints' light is redder and nearer the wall.

## Pass 2: what the critic saw (opus, xhigh)

A much harder critic than pass 1's (the brief moved critics to opus at xhigh effort between the passes),
so the means are not comparable with pass 1's and are not a regression on their own: the same frames it
scored lower everywhere, on the cone and the bridge as much as on the caldera.

High mean 6.46, minimum 5.5 (z0300). Motion (30 frames over three folders) mean 6.23, minimum 4 (fly2-2).
Low mean 6.59, minimum 6. Phone mean 6.90, minimum 5 (z2441). No frame a 9; the best 7.5. Hero vistas on
High: the cone 6.5, Cinder Gate's throat 6.5, the Caldera Leap 6.3, Ash Market's bridge 7.

Its findings, worst first:

1. The middle plane of every vista is a purple-black and peach "camo" field (the sea of cloud at half
   cover over Ember's dark valley): neither lava nor cloud, and unlit.
2. Snow: the lit side lilac-grey on High in the run-in, mauve-brown mud in the halls and the town; the
   shade a flat saturated ultramarine wedge, not plum-teal.
3. The grade barely moves: the sky is the same orange deck from 150 m to 4440 m; Ash Market never reaches
   dusk or night.
4. The caldera's floor reads as a neon Voronoi wireframe (High z2441, Low's yellow net, phone's near-black
   void with neon lines); the lake beyond unlit.
5. High's post: corner fringe at speed, bloom that bleaches the coat (fly1-6) and washes the planes,
   dithered depth of field in the close flight shot (fly2-2). Low out-scores High.
6. The rider is 6 to 9% of the frame's height in the wide flights and several High frames.
7. Untextured black prisms and boxes near the lens; the slots are one generic slab canyon; Cinder Gate's
   far mouth is never the hot disc.

## After pass 2: what changed (commit e491826)

- **The valley under the smoke** (palette): the sea of cloud at 0.92 cover, lit from beneath in pools.
- **Snow**: the lit side a warm cream on every stop (`#FFE6D6` at the start, cream-peach through the shield
  and halls), the shade a cold plum-slate (`#3C4462`, `#343C58`, `#30365A`) where it was a saturated
  ultramarine; the caldera's shade cold under the fire (`#423A5C`) so the landing is not one orange
  mid-value; the town's night snow a cold lilac under the lamps. Low takes the light's colour on the snow at
  full strength, so the start's lit side was pulled back from `#FFE0CA` after Low read as dunes.
- **The town's night**: the deck darkens to embers, exposure 1.04 (was 1.14), lamps 1.5.
- **Bloom** held back on every Ember stop (0.42 to 0.6, was 0.5 to 0.8): it bleached the coat in fly1-6.
- **Cinder Gate's and the halls' far mouths** (`stages.ts` `makeMouth`, now also for `lavatunnel` sites on
  Medium and High): a hot veil in the opening, the heat spilling in along the floor, faint shafts.
- **The caldera's crust** a dark basalt (no longer a near-black void) with most cracks dulled and the lit
  ones broken and dim on a cool crust; Low's lava rewritten the same way (it was a lit yellow net).
- **The rivers** culled like any static mesh (they were drawn from 420 m ahead), and on Low only the river
  itself is drawn (no glow sheet, no organ pipes). Organ pipes stand in the river in front of the wall.

## Pass 3: what the critic saw

High mean 6.54, minimum 5.5 (z0300). Motion mean 6.47, minimum 5.0 (fly2-3). Low mean 6.67, minimum 6.
Phone mean 7.03, minimum 5.5 (z4590). No frame 8 or more; the best 7.5 (High z1766, z3591, z4330, z4440,
fly1-1). Hero vistas on High: the cone 6.5 and 5.5, Cinder Gate 6.5 and 7, the Caldera 6 to 7.5, Ash
Market's bridge 7 and 7.5. Every set moved up a little on pass 2 under a critic as hard.

Its findings, worst first:

1. The caldera: "no lava lake": the basin past the lip is a beige plain with black blots (the sea of cloud
   seen from the lip, pale billows over dark gaps), and the rider flies over a chute of snow (the crust
   floor ended 26 m short of the landing face's end, so the last part of a fast flight was over snow).
2. Grey-mauve snow still in about a third of the frames: a slope turned downhill from a 30 degree key
   light sits half lit, and a warm lit side mixed with a cold shade is grey.
3. Basalt Halls has no identity: no organ pipes, no lava river beside the line (they were there, laid on
   the true surface at the wall's foot, where the terrain's drawn chord stands metres over it: inside the
   drawn bank, unseen).
4. Cinder Gate's far mouth still pale beige, not a hot disc.
5. Brown cotton-ball smoke over the cone at the bridge; candy-pink night snow on Low; a blown orange wash
   in the Ash Market street that the coat sinks into.
6. Out of this lane: the corner fringe at speed on High, the dithered depth of field and blur in the third
   leap's close flight shot, the rider 5 to 12% of the frame's height in the wide flights, the fuel drops'
   flat yellow shapes near the lens, the results card over the rider on the phone.

## After pass 3: what changed (commit c915d75)

- **The key light** stands at 40 to 44 degrees on every Ember stop (was 24 to 30), the disc where it was:
  decision 27's rule. A slope turned downhill sat half lit, and Ember's warm lit side mixed with its cold
  shade to grey-mauve; now the run's snow is a warm lit white with cold shade.
- **The cone** glows and runs from the start line (`massif.lava` 0.72, `flow` 0.75; was 0.6 and 0.5; kept
  under the 0.75 that wakes the night moods' lightning).
- **The valley under the smoke**: cover 1.25 (no gaps), the billows dark ember smoke (`clouds.lit`
  `#5A2A26`, which also darkens the low clouds over the run), lit from beneath at 1.4 and at 2.2 over the
  caldera, so the basin past the lip burns.
- **The crust floor** runs on with the fields to 48 m past the landing face, so all of a fast flight is
  over lava, and its ragged last plates are ahead of a rider landed there, not round them; the crust a
  shade lighter (basalt, not a void).
- **The slots' lava and organ pipes on the drawn rock** (`stages.ts` `drawnY`, from `terrain.ts`'s own
  columns, now exported as `lateralOffsets`): the slots are V-shaped, the walls rise fourteen metres in
  five past the corridor's edge, and the terrain's chord stands metres over the true surface there; laid
  on the surface, the pipes were wholly inside the rock and the river half in it.
- **Cinder Gate's air** thickens to the fire's colour with distance (fog `#6A1E0A`, far air `#A0360E`), so
  the far mouth is a hot disc and not the pale slope beyond.
- **The forge smoke** thinner (alpha 0.55) and lit a hotter orange; **the town's night key** dim
  (`#D8B0A8`), lamps back to 1.3 (1.5 flooded the street orange and the coat sank into it).
- **Light from below** 0.3 at the start and 0.34 under the closing deck (was 0.1 and 0.16): basalt and the
  rider take a hot edge.

## Pass 4: what the critic saw

High mean 6.8, minimum 6.0. Motion mean 7.0, minimum 6.0. Low mean 7.0, minimum 6.0. Phone mean 7.4,
minimum 5.5 (z2441). No frame a 9; eleven frames at 8 (phone z0900, z1316, z1650, z1766, z3450, z3540,
z4050, z4200 and phone flight 2 to 5). Hero vistas on High: the cone 7 and 6, Cinder Gate 6 and 7.5, the
Caldera 6 to 7.5 (phone 8), Ash Market's bridge 7.5 and 7.5. Every set up again (High +0.26, motion
+0.53, Low +0.33, phone +0.37).

Its findings, worst first:

1. Phone z2441: the crust under the phone's high lens fills the lower 40% as one dark slab.
2. The corner fringe at speed splits near trees and the chalet into green and magenta copies (fly0-5,
   fly0-6): it looks broken (the pipe lane's lens character, not this lane's).
3. The Caldera's approach shows grey haze past the lip, no reveal.
4. Cinder Gate's entrance: brown walls in an even light.
5. The third leap into Ash Market: murky maroon-lilac slopes with no value structure, the town two grey
   strips, the rider 40 px.
6. Still: grey-mauve snow in places, the shade navy rather than plum-teal, the bridge's sky still an
   afternoon orange, the forge smoke olive puffs over the cone, Low's lava and fuel a sour lemon.

## After pass 4: what changed (commits 6c2867a, 91e3727)

- **The lit snow bright enough to read as day** (`#FFF0E6` at the start, `#FAE8DE`, `#FFEEE2`, `#FCE6DA`,
  `#FFE8D8` through the journey and the caldera). The snow shader takes only a trace of the key's colour
  when the lit snow's luminance reads as day (`dayK`); the darker warm whites of pass 2 dropped under it,
  took the key's orange as well and read as sand (twice tinted, as the first comment in the palette warned).
- **The shade plum** (`#463E60`, `#3E3858`, `#3A3456`, `#383254`), not navy.
- **Basalt near black** (`materials.ts` ROCK.volcano, Ember's own set): modelled by the lava's light and the
  sky's edge, where a grey-mauve rock read as brown walls in an even light.
- **Ash Market's night** whole by the bridge (from 3400 m, whole at 3540 m; was 3760 m), the horizon and the
  deck's glow down to embers, the night snow darker than the lamps' pools so the slopes are the dark plane
  and the town the light, the cone at 0.74 lava behind the roofs.
- **The forge smoke** thinner (0.42) and darker, never olive.
- **The crust under the lens** keeps its cracks awake (High and Medium), so the phone's high lens never
  sees a black slab; **Low's lava** red to orange (a hotter fire clipped to lemon on Low's ungraded frame)
  and its crust darker.
- One slip: 6c2867a moved the town's stop to begin at 3380 m, under the halls' stop's end, and the journey
  table's order test failed; the commit went in on a test run whose failure a filter hid. 91e3727 begins it
  at 3400 m and the suite is green again (1542 of 1542). Pass 5 was captured from 91e3727.

## Pass 5: what the critic saw (the last pass)

High mean 6.97, minimum 6. Motion (30) mean 7.38, minimum 6 (High flights 6.97, Low flight 7.67, phone
flight 8.33). Low mean 7.01, minimum 6. Phone mean 7.79, minimum 6. No frame a 9; the best 8.5 (phone
z0750, z0900, z1316, z1766, z1950, z2271, z4200 and the phone's Caldera flight). Hero vistas on High: the
cone 7 and 6, Cinder Gate 6.5 and 7.5, the Caldera 7 to 8, Ash Market's bridge 7.5 and 8.

Its findings, worst first: grey ash snow on High away from a lava source and a one-value sand on Low; the
Basalt Halls stretch still the slab canyon of 900 to 1316 m; the corner fringe tearing the chalet and the
rim columns in flight; the rider 30 to 90 px on High; flat fuel drops near the lens and neon window slabs;
the late run (3940 m, the third leap) purple snow lit by nothing; no dim coin in the deck.

The loop stops here: five passes, the brief's limit. The stop rule (no frame under 8, every hero vista 9)
was not met.

After pass 5, one change with no change to the picture: the caldera's lake, rim and glow and the forge
mouth are culled like any still mesh (they were drawn from behind the lens while the stage was kept, now
for the 50 m the lava runs on past the landing). See Cost.

## Scores

Each pass a new critic. Pass 1's on the first lane's model at medium effort; 2 to 5 on opus at xhigh. The
critics differ in calibration, so pass 1 against pass 2 says nothing; passes 2 to 5 held one standard and
every set climbed every pass.

| Pass | High mean (min) | Motion mean (min) | Low mean (min) | Phone mean (min) | Cone | Cinder Gate | Caldera | Ash Market bridge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 7.19 (5.5) | 7.22 (6.0), High only | 7.61 (6.5) | 7.90 (5.5) | 7.5 | 7.5 | 7 | 8.5 |
| 2 | 6.46 (5.5) | 6.23 (4.0) | 6.59 (6.0) | 6.90 (5.0) | 6.5 | 6.5 | 6.3 | 7 |
| 3 | 6.54 (5.5) | 6.47 (5.0) | 6.67 (6.0) | 7.03 (5.5) | 6.5 / 5.5 | 6.5 / 7 | 6 to 7.5 | 7 / 7.5 |
| 4 | 6.80 (6.0) | 7.00 (6.0) | 7.00 (6.0) | 7.40 (5.5) | 7 / 6 | 6 / 7.5 | 6 to 7.5 (phone 8) | 7.5 / 7.5 |
| 5 | 6.97 (6.0) | 7.38 (6.0) | 7.01 (6.0) | 7.79 (6.0) | 7 / 6 | 6.5 / 7.5 | 7 to 8 (phone 8.5) | 7.5 / 8 |

The hero vista columns are High's frames: the cone z0150 / z0300, Cinder Gate z1166 / z1316, the Caldera
over z2271, z2441, z2550 and fly1, the bridge z3540 / z3591.

High, frame by frame:

| Frame | P1 | P2 | P3 | P4 | P5 |
| --- | --- | --- | --- | --- | --- |
| z0150 | 7 | 6.5 | 6.5 | 7 | 7 |
| z0300 | 7.5 | 5.5 | 5.5 | 6 | 6 |
| z0450 | 6.5 | 6.5 | 6.5 | 7 | 7 |
| z0613 | 7 | 6.5 | 6 | 7 | 7 |
| z0750 | 7.5 | 7 | 6 | 7 | 7.5 |
| z0900 | 6.5 | 7 | 7 | 7.5 | 7.5 |
| z0993 | 6 | 6.5 | 7 | 6.5 | 6.5 |
| z1039 | 6.5 | 6 | 6 | 6 | 6 |
| z1166 | 7 | 6 | 6.5 | 6 | 6.5 |
| z1316 | 7.5 | 7 | 7 | 7.5 | 7.5 |
| z1500 | 7.5 | 6 | 6 | 6.5 | 7 |
| z1650 | 7 | 6.5 | 6.5 | 7 | 7.5 |
| z1766 | 8 | 7 | 7.5 | 7.5 | 8 |
| z1950 | 7.5 | 7 | 7 | 6.5 | 7 |
| z2024 | 7 | 6.5 | 6 | 6 | 6.5 |
| z2100 | 7 | 6.5 | 6.5 | 6.5 | 7 |
| z2271 | 7 | 6 | 6 | 6 | 7 |
| z2441 | 7 | 6.5 | 7 | 7 | 7.5 |
| z2550 | 6.5 | 6 | 6.5 | 6.5 | 7 |
| z2691 | 6.5 | 6 | 6.5 | 6.5 | 6.5 |
| z2761 | 6.5 | 6 | 6.5 | 6.5 | 6.5 |
| z2850 | 7 | 6.5 | 6.5 | 7 | 6.5 |
| z3000 | 7.5 | 6.5 | 7 | 7.5 | 7 |
| z3150 | 7.5 | 6 | 6.5 | 7 | 7 |
| z3323 | 6.5 | 6.5 | 6 | 6.5 | 6.5 |
| z3450 | 5.5 | 6.5 | 7 | 7 | 7.5 |
| z3540 | 8.5 | 7 | 7 | 7.5 | 7.5 |
| z3591 | 8.5 | 7 | 7.5 | 7.5 | 8 |
| z3741 | 8 | 6 | 6 | 7 | 7 |
| z3940 | 7 | 6 | 6 | 6 | 6.5 |
| z4050 | 7 | 6.5 | 6.5 | 6.5 | 6 |
| z4200 | 8 | 7 | 6 | 7 | 7.5 |
| z4330 | 8.5 | 7 | 7.5 | 7.5 | 7.5 |
| z4440 | 8 | 7 | 7.5 | 7.5 | 7.5 |
| z4590 | 7.5 | 6 | 6 | 7.5 | 6 |

The critics' full reports (every Low, phone and motion frame) are in the lane's transcript; their
summaries are the pass sections above.

## What is still short, and why

- **No frame is a 9 and none of the four hero vistas is one.** The best frames are 8.5, all on the phone,
  where the portrait frame makes the cone and the rider large. High's best are 8 (z1766, z3591, fly1-1 and
  fly1-2).
- **Out of this lane, and the largest single cost on High:** the corner fringe at speed (the pipe lane's
  lens character, `postfx/tiers.ts` fringe 0.7 on High) tears near trees, the chalet and the caldera's rim
  columns into green and magenta; every critic named it, "looks broken" in fly0-4 to fly0-6. The main lane
  should cap it, or zero it in flight and over near geometry, for every mountain.
- **Out of this lane:** the rider is 30 to 90 px of 720 on High's open slopes and wide flights (the hero
  lane's camera; the phone shows what a larger rider buys); the dithered depth of field in the third leap's
  close flight shot; fuel drops near the lens drawn as flat unshaded shapes, one of them over the cone at
  300 m on every pass; ghosts and slipstream lines over the rider at the bridge; the results card over the
  rider on the phone; the town's windows as flat emissive slabs.
- **In this lane, not reached:** the Basalt Halls stretch (2690 to 2850 m) is still the slab canyon of the
  first slot. The slots are V-shaped: the walls rise fourteen metres in the five past the corridor's edge,
  inside which nothing may stand, so the lava and the organ pipes stand metres up the wall and read as seams
  in the rock, not as rivers beside the line. A river beside the line needs a section with a flat floor
  past the limit, which is the sim's shape (closed). The snow away from lava still reads grey-lilac in some
  High frames and as one sand value on Low (Low has no grade pass and takes the palette straight). No dim
  coin of a disc shows under the deck: the disc is placed 34 degrees right, mostly outside the frame.
- **Fragile:** the caldera floor is render only over the sim's own ground: a sled that lands short of the
  landing face rides across crust. It is dark and reads as cooled lava, never as melt, but a player could
  read it as danger; the main lane should look at a short landing on it.

## Shared code touched

All small and keyed to Ember unless said.

- `materials.ts`: `uPoolSoft` (palette `poolSoft`, default 0, so no other mountain changes), Low's painted
  pools on Ember; ROCK.volcano (Ember's own rock set) darker.
- `palette.ts`: the new field `poolSoft` (default 0); otherwise Ember's palette, journey and places only.
- `terrain.ts`: `lateralOffsets` exported (unchanged); the lava joints' ground light (volcanic only),
  wider and stronger, and on Low redder and nearer the wall.
- `stages.ts`: Ember's caldera and rivers; `makeMouth` takes a `forge` flag for Ember's `lavatunnel` sites
  (the cavern's dawn unchanged); the lava shader is used only by Ember.
- `verbworld.ts`: the surge verb's flames larger. Surge is Ember's Caldera Leap and also a host verb of the
  generic Big Leap (dailies), where the gate gets the same larger flames.
- `landmarks.ts`: exitFlash 0.12 on volcanic only; the caldera's forest clearing runs 50 m further.
- `life.ts`: Ember's forge smoke (volcano peak only).
- `massif.ts`: `VOLCANO_TOP` 1040 (Ember's cone only); `legendforms.ts`, `legendworld.ts`: the eruption
  placed from it; `marqueeworld.ts`, `world.ts`: `setConeBearing` wired from `massif.heroAz` (every
  mountain passes its bearing; only Ember's legend erupts).

## Cost

Draw calls and triangles, the base (ead6196, the round's merge) against this branch's head, at the same
distances, two interleaved rounds each, ghosts hidden (their number varies from run to run and swamped the
passes' own JSON: Low read +4 there in places with nothing of this lane's in view).

| Tier | Where | Base calls | Head calls | Triangles |
| --- | --- | --- | --- | --- |
| High | open slopes (150, 1950, 3540, 4440 m) | 76 to 97 | the same | +0 to +5k |
| High | the first slot and Cinder Gate (993 to 1316 m) | 91 to 94 | 97 to 99 (+5 to +7) | +0 to +8k |
| High | the Caldera (2271 to 2550 m) | 97 to 100 | 98 to 102 (+1 to +2) | +9 to +11k |
| High | the second slot and the halls (2761, 3323 m) | 88 to 96 | 90 to 100 (+2 to +4) | +1 to +8k |
| Low | open slopes | 36 to 45 | the same | +0 to +3k |
| Low | the slots and Cinder Gate | 41 to 44 | 42 to 47 (+1 to +2.8) | +1 to +2k |
| Low | the Caldera | 37 to 41 | 38 to 42 (+0.5 to +1) | +2 to +3k |

High's heaviest frame is the Caldera at 102 (base 100). In the first slot the rivers (the lava, its glow up
the wall and the organ pipes, three draws a river, two rivers in view) and the forge mouth's one draw take
High from 91 to 98. **Low is heavier by one draw a river in view** (one or two in a slot: the river alone,
culled; no glow and no pipes on Low) and by under one in the caldera; nothing else on Low. Frames per
second were never judged (six lanes share the GPU).

## Where the frames are

- Passes: `shots/r7/review/m2/pass1` to `pass5` in the main checkout (`high`, `low`, `phone-medium`,
  `motion`; `motion-low` and `motion-phone` from pass 2), each with its frames' JSON (calls, triangles,
  console errors: none in any pass).
- Contact sheets: `shots/r7/review/m2/sheet-before.png` (pass 1, High) and `sheet-after.png` (pass 5,
  High), the same 35 distances; `sheet-motion-before.png` and `sheet-motion-after.png` for the flights.
- Hero frames: `shots/r7/hero/m2/`: the Caldera flight on the phone and on High, the cone over the smoke at
  750 m and the forge town's lanterns at 4200 m on the phone, Cinder Gate's throat on the phone, the bridge
  to the cone at 1766 m and Ash Market's bridge at 3591 m on High.
- Capture: `scripts/playtest/flights-r7.js` (stills through the flight off each leap, in the frames' mood).
