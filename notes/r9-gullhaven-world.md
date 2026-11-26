# Round 9, Gullhaven's world (the `gullhaven` lane's world builder)

The brief is `notes/r9-briefs/gullhaven.md` section 2 ("A place of its own"); the rules `notes/r9-lanes.md`. This file is
the world's: what was built, why a player would feel it, what the critics said, what Low costs, what is short. The
lane's own notes (the sim, the set pieces' sim, the score, the pool, registration) are `notes/r9-gullhaven.md`. Frames
are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gullhaven/world/`. Nobody has ridden Gullhaven by hand,
and every frame here is staged (a sled held on a line at a speed, `scripts/r9/gullhaven-world-frames.js`), not a ride.

Commits (the world's): 82192fd (the first world), 9dd0adf (the camera beat, the deck's edge, the stacks, the harbour),
6682fa7 (card, sky, title, Low), 461f63b (the cliff in clear air), bd07438 (after the critics), 7ed1aef (the render
suites answered, the limit), 3fcc0a5 (the set pieces' props, tests/gullhavenworld.test.ts), a682e30 (the placeholder
rows said for what they are), and this file.

## 1. What the world is (each decision, and the reason a player would feel it)

**The idea.** A clifftop run in a storm's light: a path along the top of a sea cliff a thousand metres over the sea, a
snow fence between the run and the drop, the moor rising on the other hand, the sea out to the horizon under a slate
storm deck with the low sun burning under its edge. The run comes down the coast past clefts in the cliff (the geos,
the gullies the sim lets a rider soar), a lighthouse, the fish sheds and down onto the harbour's ice, where the line
runs between two pier-head lights. Nothing of the five's grammar (no pine, no hero peak, no sea of cloud under a
panorama, no town square) and nothing of the Old Run's (no wood, no track, no lake).

**Where it lives.** `src/render/gullhavenworld.ts` (everything that stands, loaded with `import()` the first time its
course is drawn: nothing of it is in the first download), `src/render/gullhavenpieces.ts` (the set pieces' props,
loaded with it), `src/render/gullhavenplan.ts` (small and static: the sea's level, the clefts, the beacon's and
lighthouse's points, the clearings the five's dressing keeps off), and rows and branches in the shared files (section
2).

- **The sea at its own level, and read as water.** `seaLevelOf(c)` is the ground 200 m past the line less 0.6 m, so
  the harbour's ice stands on it and the cape's head is 1,163 m above it. The sky's dome draws the sea at that level
  from the first frame (`sky.ts setSeaLevel`, `uSeaY` = sea - camera each frame), and the world's sea plane (a 4.8 km
  disc under the lens, the same `SEA_GLSL`) joins it seamlessly. The water is the massif's `seaOcean`: a long swell
  from the south-west with crests only at its tops, a second swell across it, shallow troughs, sparse whitecaps,
  shoal patches near the cliff, the sun's path broken into glints, the far sea a step under the sky at the horizon.
  Why: the brief's first "not" (no panorama over a sea of cloud) is only met if the eye reads water; the sort's
  critic still could not always tell water from black ice (section 4), so the swell and the glints carry it.
- **The coast round it.** The massif's panorama in coast mode (`massif.ts` VERT `uCoast`): its heights from the sea's
  level, the coastline running on ahead of the run and turning out to sea past 2.4 km, a moor over 140 m cliffs, bare
  rock on the cliffs (snow only on the gentle tops) down to a dark wet foot at the waterline, and one island well round
  from the sun's bearing. Why: a sea needs a far shore to be a sea and not a plain; an island under the sun covered its
  disc (the second critic).
- **The storm deck and the low sun.** The sky's deck is slate with its lit edge only along its lifted rim toward the
  sun (`sky.ts uDeckEdge`), the sun low under it and a warm band at the horizon. Why: the brief's light; a deck glowing
  all over read as a lamp shade.
- **The ground past the edges.** `ground.ts cliffGround`: inside the corridor and out to the limit, the sim's to the
  millimetre (a test holds it); seaward past the fence the sim's own fall, stopped on a sea floor 30 m under the water,
  cut back to the fence in a cleft at each gully (a sheer 30 m under the fence, then the back wall to the sea), and
  held at the cliff top over the beacon's knoll and the lighthouse's point; landward the sim's bank for its first
  metres, then the moor's long rise in hummocks. The sim's own moor steepens into a wall nobody meets; drawn, it was a
  green wall over the run. The terrain lays no drifts past the seaward edge and bares its rock where it falls
  (`terrain.ts`); the mid-ground draws the cliff falling under the sea and the moor rising, no village, no forest
  (`midground.ts`).
- **The fence.** A snow fence the whole way along the seaward edge: pale weathered posts every 3.2 m with their inner
  face at the run's limit (7ed1aef: they stood a metre inside it, and a sled at the limit ran through them), two rails,
  a panel of laths between, a blue or cream pennant on every fourth post streaming inland on the wind and standing
  straight up over a gully's column. It is the run's strobe at speed where the five have stakes. No light of its own
  (the second critic: "lit from nowhere", orange under the moon), no shadow from the laths or the pennants (a barcode
  along the edge; figures with an arm raised laid across the run).
- **The moor.** Coursed dry-stone walls up the moor (stones in courses with a snow strip), loose stones, cairns on its
  knolls. No forest: the five's forest and dressing keep off both sides (`gullhavenplan.ts gullhavenClearings`).
- **The gullies.** At each lip a cornice of wind-packed snow flush with the shelf (a raised bar read as a wall to stop
  at, the first critic) whose brow overhangs the drop, torn by the wind, its underside in shade, so the edge reads as a
  lip a rider can leave. A windsock on a slim pole at the fence by the lip, filled by the wind climbing the gully.
  Spindrift streaming up the column beside the line and out over the slot (up the line itself it rose out of the
  rider's beanie). The cleft's two walls, bedded rock with snow ledges, so the slot reads as a slot in the cliff with
  the sea in it.
- **The wind shows.** The spindrift up each column, the gulls hanging in the columns facing into the sea wind (a gull's
  M, still but for a rock), others wheeling over the cliffs, the pennants and windsocks standing up over a column, the
  beacon's smoke pale and thin and leaning inland.
- **The sea stacks.** The cliff's rock in beds at three proportions (a needle, a column, a squat block), each scaled
  whole (stretched, their ledges turned up and drew them white), in the cliff's dark rock with no stone shader's snow,
  surf round each. The low mist that settles on the five's course floor would have drawn them as pale posts a
  thousand metres under the run: it keeps off what lies far under the floor on Gullhaven (`materials.ts uMistDeep`).
- **The old beacon.** At the head, past the fence on its knoll (the cliff top held out, `BEACON`), an iron drum on a
  stone base with its fire burning and its smoke leaning inland: the opening's first thing ahead and to the right.
- **The lighthouse.** A limewashed tower in courses with a slate band, a door, windows climbing it, a railed gallery
  and its lantern, a keeper's cottage with a chimney, on its point past the fence at the end of the Cape's second shelf,
  where The Lighthouse set piece is (3fcc0a5: it stood a kilometre on). Its beam a soft long cone turning over the sea
  at dusk and night only (by day it read as a hard milky slab, the third critic).
- **The sheds and the harbour.** Tarred fish sheds along the lane down the descent, gable ends to the lane, lit windows
  as the day goes, a few on posts over the drop on the seaward edge past the limit; the slipway at the harbour's head;
  the harbour's ice from the run's edge to the pier, the boats frozen into it; the quay along the landward edge, its
  face at the limit and its top over the bank the sim raises there, the pier seaward, each ending at the line in a
  round head and a short white light tower; the line's four rows of ink and cream checks across the ice in paint; the
  harbour's houses stepping up the moor's foot; the harbour's folk on the quay in knitwear and oilskins, still, facing
  the ice (`crowd.ts stillCrowd`, DRESS.gullhaven). All in a paint material (the stone shader laid snow on the ink
  checks and the line vanished: "the run read as riding into the sea", the second critic). The roofs are hip roofs on
  their walls' own rectangle (7ed1aef: stretched after turning they were diamonds reaching metres past their walls).
- **The light down the run** (`palette.ts`: clearSkies, round7, visualLift, JOURNEY, PLACES): see section 9's colour
  script. The snow keeps only a trace of the low sun's colour and half the broad dunes' rings (`materials.ts
  uSnowBands`): a flight over the moor read them as sand.

**The camera beat** (`camera.ts`, 9dd0adf). Over a gully the lens steps out over the cleft and leans to the sea far
below it: while the rider is airborne over a gully's mouth (`fallSide`, set by `world.ts` from the sim's lift line
`liftX`), the vista's pick turns seaward and the lean (`FALL_YAW`, `FALL_ROLL`) is the five's opening allowance
(`OPEN_YAW`, `OPEN_ROLL`), eased in at 2.5/s and home before the stomp, halved on a phone, off under reduced motion.
Nothing past the vista's allowance.

**Its other hour: Moonrise** (`palette.ts ALT_HOURS.gullhaven`, "at Moonrise", dusk 1). Drawn, not wired (the main
lane decides how a player reaches it): the moon up over the sea, its path on the swell, the lighthouse's beam turning,
the beacon's fire, the sheds' windows and the pier-head lights. Frames `alt/` (five spots).

**Its mirror.** `World.setMirrored` turns it over; three frames (`mir/`) checked: the sea on the left, the fence and
the beam with it, no lettering in the world to read backwards.

**HUD.** No signal added. The set pieces say themselves in the world (section 1b).

## 1b. The set pieces as the world draws them (3fcc0a5, `gullhavenpieces.ts`)

Stood from the plays (`moments.ts`: the run's own, or the course's plain ones on the title), as `oldrunpieces.ts` does.
Nothing stands on the run but paint and light; the five's verb props and stand-ins draw nothing for these three
(`verbworld.ts owns`, `marqueeworld.ts standIns`).

- **The Lighthouse (beam).** At each mark a limewashed daymark with a slate band each side, past the limit (the
  harbour's leading marks), and on High a short cream bar of paint at each edge of the path. The beam falls on the
  path as a pool of the lantern's warm white, swinging across it where the sim's sway has it on this tick (`gateX`,
  ticks from the play's start), at rest until the rider arrives, held once the mark is decided. The next mark's pool
  breathes; a mark ridden in the beam flares white-gold with a marigold sparkle; a missed one goes dark. A shaft from
  the lantern down to the next pool, faint by day (0.14) and plainer once the lamps are lit (0.5).
- **The Great Geo (soar).** Its far line (`p.far`): two tall poles banded in the fence's blue past the limit either
  side, a lamp at their heads, and a dashed blue and cream line across the far shelf between them. The lamps rest at
  0.35, breathe while the play is on and brighter while the rider is in the air off the lip (`mo.aux`), flare with
  sparkle for the win, gutter for the loss.
- **The Sea Stacks (stacks).** Each gap (`p.targets`) between two jaws of ink in the snow, with a pool in the gap (the
  next breathing, a threaded one flaring, a missed one dark), and a stack in the sea off each gap down the shore road
  (columns and squat blocks, a little lower than the road at its foot), so the road threads among them.
- **The legends** (The Beacon Keeper, a runner over the Cape's end; The Herring Lights, a sky over the Geos) are drawn
  by the marquee's generic stand-ins (orbs on the runner's line, lanterns rising). Not stood: what I would stand is the
  keeper as a figure in oilskins with a lamp walking the runner's path ahead of the rider, and the fleet as the harbour's
  boats coming home lit across the sea below the Geos (hulls from the harbour's boats, a lamp each, on the swell).

## 2. Every hunk in a file other render systems share

- `src/render/ground.ts`: `cliffGround`, `CLIFF_FROM`, `MOOR_SIM`, `MOOR_OWN`, `moorRise` (new); `groundOf` and
  `visualGround` branch to it for `kit.id === 'gullhaven'`. 7ed1aef holds it to the sim out to the limit (from
  `max(CLIFF_FROM, limit)` seaward and `max(MOOR_SIM, limit)` landward; the points blend in over a metre and a half).
- `src/render/terrain.ts`: imports `CLIFF_FROM`; a `cliff` flag (Gullhaven's kit); no drifts past the seaward edge, and
  rock where the drawn cliff falls (`smoothK(0.7, 1.5, |gradient|)`).
- `src/render/midground.ts`: `coast` and `sea` fields; no villages or hamlets on the coast; `modeRaw` (the cliff side
  always falls, the moor side always climbs); `sideInfo` (the sea's floor past the cliff, no far wall, a gentle moor);
  no forest; the corridor fill under the sea past the cliff.
- `src/render/massif.ts`: the coast records (`uCoast`, coast mode in VERT: coastline, moor, cliffs, one island); the
  ocean (`uSeaOcean`, `uSeaWater`, `seaOcean()`), the sea's dispatcher (`uSeaOcean > 0 ? seaOcean : uSeaLake > 0 ?
  seaLake : seaClouds`); FRAG for the coast (snow line from the sea, cliffs bare, haze, a dark waterline, crisp surf).
- `src/render/sky.ts`: `uDeckEdge` (the deck's lit rim only), `seaDepth`/`seaLevel`, `setSeaLevel`, `uSeaY` each frame
  in `follow`, `get seaUniforms()`.
- `src/render/palette.ts`: types (`massif.seaOcean`, `water`, `deck.edge?`, `HeroPeak 'coast'`); Gullhaven's rows in
  `biomeBase`, `clearSkies`, `round7`, `visualLift`, `JOURNEY.gullhaven` (three stops), `ALT_HOURS.gullhaven`,
  `PLACES.gullhaven`. 7ed1aef: the sunset's haze `#A8A4C6` (warmer, the descent's frame came within 0.697 of Pinecrest's
  dusk against the suite's 0.7).
- `src/render/materials.ts`: shared `uMistDeep` (the low mist keeps off what lies far under the floor) and `uSnowBands`
  (the dunes' rings), both 1 on every other mountain, set in `applyPalette` from `massif.seaOcean`.
- `src/render/camera.ts`: `FALL_YAW`, `FALL_ROLL` (= the opening's), `fallSide`, `fallK`, the vista's pick and the lean
  in `stepVista`.
- `src/render/world.ts`: imports; the `gullhaven` fields and root; its clearings in the dressing's keep list;
  `syncGullhaven` (the sea's level, `cam.fallSide`, the dynamic import); `setDetail`, `reset`, `update`, `beats` calls.
- `src/render/landmarks.ts`, `overlook.ts`, `compose.ts`, `speedposts.ts`: `|| kit.id === 'gullhaven'` beside the Old
  Run's early returns, with a comment each.
- `src/render/crowd.ts`: `DRESS.gullhaven` (knitwear and oilskins); comments on CUT and PROP_REST (never stood).
- `src/render/flora.ts`, `places.ts`, `town.ts`, `village.ts`, `landmarks.ts`, `speedposts.ts`: the lane's placeholder
  rows' comments now say they are Pinecrest's and never read (a682e30; comments only).
- `src/render/verbworld.ts` (`owns`) and `src/render/marqueeworld.ts` (`standIns`): `beam`, `soar`, `stacks` excluded.
- `src/game/keyart.ts`: `TITLE_SHOTS.gullhaven` (the Great Geo's column over its cleft, 2120 to 2480, lit at 2260; desk
  high and seaward, phone lower).
- `src/ui/art.ts`: `RIDGES.gullhaven` (the card: the deck over the sea with its lit edge, the sun, the sun's path and
  swell lines, the cape's cliff and the lighthouse).
- `src/ui/style.css`: `.b-gullhaven .gs-mtn-sky` and `.gs-toast-sky.b-gullhaven` (the deck's slate down to the sun's
  band).
- Tests answered for Gullhaven (7ed1aef, as 5fbd460 did for the Old Run): `tests/ground.test.ts` (four),
  `overlook.test.ts` (two), `midground.test.ts`, `compose.test.ts` (two), `setpieces.test.ts` (four). New:
  `tests/gullhavenworld.test.ts` (12).

## 3. Frames (`shots/r9/gullhaven/world/`)

- `base/`: the first frames as built (opening 60 m, a lip 1336, in the air over the Great Geo 2262, a shelf 3240, the
  finish 4761). `sort-colour/`, `blind-a/` (the greyscale sort's set and its key).
- `r1/`, `r2/`, `r3/`: the critics' rounds (round 1 open; rounds 2 and 3 blind pairs, `pairs-src*`, keys
  `r2-pairs-key.json`, `r3-pairs-key.json`, picks `r2-picks.json`, `r3-picks.json`).
- `alt/` (Moonrise), `mir/` (mirrored), `gl/` (the Low GL counts), `photo/` (photo mode and Save Clip), `dev/` (working
  frames and `cards.png`, the picker's card), `title/` (the title on Gullhaven, `?m=6`).
- `pieces/` (after 7ed1aef and 3fcc0a5, High): `1-cape-mark-z619` and `2-cape-lighthouse-z690` (the lighthouse at its
  set piece, the next mark's pool on the path), `3-fence-z1001` (the fence at the limit), `4-geo-far-z2320` (in the
  air over the Great Geo, its far line ahead), `5-shore-gaps-z4140` (the shore road, the sheds' square roofs),
  `6-quay-z4770` (the line between the pier-head lights, the quay's folk), `probe-x-overhead-z1001`.

## 4. The greyscale sort

Gullhaven's first frames (opening, three places, finish) in greyscale, shuffled with the five's set
(`shots/r9/measure/stills/gray/`) and the Old Run's, given to a fresh critic to sort by mountain. It sorted Gullhaven
alone as the outlier: "no mountain at all, only a flat horizon"; "the run runs along the top of a high bank with water
or ice on one side"; the harbour. It could not always read water from black ice, a ridge from a sea wall or pier, or
air over a cliff, nor the wall's blocks, the land past the fence or the banded tower. So the value structure is its
own (the brief's test); what it could not read went into the critics' loop: the swell and glints, the cliff's dark
rock to a wet waterline, the coursed walls, the tower in courses.

## 5. The critic loop (fresh Opus critics at extra effort, given only ART.md and the frames)

- **Round 1** (open critique of the first frames). The snow read as sand from a flight; phantom figure shadows across
  the run; the lip read as a wall to stop at; the fence's edge floated; blockout; the lighthouse lit by nothing; the
  planes collapsed under the low sun; the dark fence read as a hazard; regular patterns. Fixed worst first (9dd0adf,
  461f63b, bd07438): the snow's trace of the sun, the pennants' and laths' shadows off, the cornice flush and torn, the
  fence pale, the lighthouse in courses with its cottage, the stacks in clear air.
- **Round 2** (blind pairs, round 1 against round 2, 12 pairs): 5 of 12 picked the new. Lost on: the stacks and an ice
  shelf as "frosted cake with icicle teeth", an island over the sun, the fence's own light ("lit from nowhere", orange
  at night), flat blocks on the brow. Fixed: the panorama's cliffs bare rock, the island off the sun's bearing, the
  fence's light removed.
- **Round 3** (blind pairs, round 2 against round 3, 12 pairs): 2 of 12 picked the new. Lost on: the brow's outcrops
  ("pale untextured stubs" lining the edge), the cone beam by day ("a hard milky slab"), the troughs read as cracks in
  ice. Kept: the fence's fix, the island off the sun. Fixed after (bd07438): no outcrops on the brow, the beam at dusk
  and night only and narrower, the troughs shallow, the dunes' rings halved. These fixes have been seen in frames since
  (`pieces/`: the clean edge, the sea's swell), not by a fourth critic.
- Every cited frame was looked at.

## 6. Low

Designed, not cut: one pennant colour on the posts themselves (no staffs), the laths off, posts every 6.4 m, the
stacks one form, the windsocks still in the cornices' draw, the moor wall as one block per stretch, fewer stones,
fewer folk (bolder), fewer boats and houses, the places drawn only within reach (520 m), the sea's detail
`SEA_Q 0`, the beam's cone and the pieces' shaft at fewer sides.

GL calls on a held Low run (mid-100 save, held at 30 m/s, 300 m windows; `scripts/r9/gullhaven-world-glcount.js`;
counts, not fps):

| Mountain | Window | Calls | Draws |
| --- | --- | --- | --- |
| Gullhaven (first) | 542 to 842 | 423.1 | 50.9 |
| Gullhaven (first) | 1540 to 1841 | 420.6 | 48.5 |
| Gullhaven (Low designed) | 540 to 841 | 438.5 | 46.7 |
| Gullhaven (Low designed) | 1540 to 1841 | 433.8 | 45.2 |
| Pinecrest | 533 to 834 | 353.0 | 37.5 |
| Pinecrest | 1370 to 1671 | 414.7 | 42.1 |
| Ember | 541 to 842 | 402.0 | 40.5 |
| Ember | 1542 to 1843 | 391.2 | 40.7 |

Programs 76 on Gullhaven against 66 to 68. Gullhaven's Low makes 3 to 9 more draws than Pinecrest's and 4 to 6 more
than Ember's. Most of that is the sea plane, the surf, the spindrift's points and the coast's own programs. The calls
are 5 to 24% over. Since these counts were taken, the set pieces added up to four draws within reach of each set
piece: the paint, the pools, the shaft and the lamps. They were not re-counted.

## 7. Seen and only scripted

- **Seen in frames:** everything in section 1 at High on a desk (the `base/`, `r1` to `r3`, `pieces/` sets); the
  other hour and the mirror; the title on Gullhaven (`title/`): the rider over the Great Geo's approach with its far
  poles' lamps and the sea; the card (`dev/cards.png`); photo mode (opened from pause with P, the HUD gone, its bar,
  the lens turned by a drag, Escape left it; no errors) and Save Clip (from the results, "Recording" with Cancel,
  cancelled before anything was saved).
- **Only scripted:** the set pieces' live states (a mark flaring, a gap missed, the Great Geo's lamps while in the
  air and on the win), which were never ridden; the pieces on Low; the phone; the camera beat in motion (its frames are
  held). The `pieces/` frames show the pools at rest and the next mark breathing.
- Once, the first title frame (`title/title-m6-desk.png`) showed a pale diagonal shaft from the top of the frame down to
  the fence. Checked live: neither the lighthouse's beam nor the pieces' shaft was visible then or after, and the
  next frame and five later reads were clean. It is not the world's. Worth the main lane's look in the title's first
  second.

## 8. What is short, and what the lane or the main lane must do

- **The sim's seaward limit past the descent (the lane's; sent to it).** From 4040 the limit widens 0.8 to 2 (sheds)
  and 3 (harbour), but the cliff's fall past the edge goes on: the ground at the seaward limit is -5.6 m at 4100 to
  4500 and -19.7 m from 4600, so a sled pressed to the right on the harbour ice sits about 13 m under the sea's level,
  under the drawn ice. Holding the seaward limit at 0.8, or no fall where the harbour's ice lies, closes it. Until
  then the fence is held at 0.8 past the descent (a sled can pass it there) and the slipway lies inside the wide limit.
- The panorama's far coast still shows pale streaks down its cliff face from the run (`pieces/4-geo-far`,
  `5-shore-gaps`): the "frosted cake" read, softer than round 2's.
- Soft figure-like shadow blobs on the snow remain in some frames. They are not the gates, the ghosts or the
  lighthouse, and the pennants and staffs cast none. Most likely they are the snow's relief shadows.
- No ruts of its own.
- The legends are the marquee's stand-ins (section 1b says what I would stand).
- The Moonrise hour and the mirror are drawn, not wired.
- Low is over Pinecrest and Ember on draws (section 6).
- The full suite was green in the heavy slot at a682e30, with the world's last code in: 114 files and 2,065 passed.
- `npx tsc` fails only in the lane's `scripts/r9/gullhaven-floor.ts` (a `time: number | null` filter), not the world's.

## 9. For ART.md section 15 (the text I would add; the main lane owns the file)

### Gullhaven: the storm's light on the sea cliff (new in round 9)

- **Feeling.** A winter's day on a sea cliff: the path along the clifftop with the fence between it and the drop, the
  moor rising on the left, the sea a thousand metres down on the right to the horizon under a slate storm deck, and the
  sun burning low under its edge. Wind you can see. It comes down off the cliffs to a harbour at dusk, its lights lit.
- **Colour script.** A low sun ahead and to the right over the sea under a slate deck lit only along its rim; snow with
  only a trace of the sun's colour, cool violet shade; the sea dark slate-blue with a broken path of glints.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 200 | The beacon | The low sun under the deck's edge, the beacon's fire on its knoll the warm note. |
  | 200 to 1450 | The Cape and its geos | Clear storm light: the sun's path on the sea, the lighthouse limewashed at the Cape's end. |
  | 1450 to 2050 | The squall | The deck lowers onto the sun, snow drives in on the wind, the far sea in haze. |
  | 2050 to 2800 | The Great Geo | The sun breaks under the deck over the Great Geo, its column lit, spindrift streaming. |
  | 2800 to 4050 | The rose sunset | The sun sets under the deck in rose, the sea a path of fire, the shade slate-violet. |
  | 4050 to 4800 | The descent, the sheds, the harbour | Dusk: an amber band under the deck, the sheds' windows and the pier-head lights the light at the line. |

- **What it is not.** No mountain peak and no sea of cloud: the sea itself, at its own level, read as water. No pine:
  a moor of snow over dry-stone walls. No square: a harbour with its quay, its pier and the line between two pier-head
  lights.
- **The edge.** A pale weathered snow fence on the cliff's brink, at the run's limit, its pennants streaming inland
  and standing up over a gully's column; past it the cliff's dark rock in beds to a wet foot at the sea. A gully's lip
  is a corniced edge flush with the shelf, its brow overhanging the drop: a lip a rider can leave, never a wall.
- **The wind.** Spindrift up each column, gulls hanging in it into the wind, pennants and windsocks standing up, the
  beacon's smoke leaning inland.
- **Its other hour: Moonrise.** The moon over the sea and its path on the swell, the lighthouse's beam turning, the
  beacon's fire, the harbour's windows and lights.
- **The set pieces as light.** The lighthouse's beam a pool of lamplight swinging across the path at each mark, the next
  breathing; the Great Geo's far line two blue-banded poles with lamps, lit while the rider is in the air; the sea
  stacks' gaps in ink jaws with a pool in each, a stack in the sea off every gap.
- **Low** is a poster of it: the fence's posts and rails with one pennant colour, one stack form, the places drawn
  only within reach; a few draws over Pinecrest's on a held Low run.
