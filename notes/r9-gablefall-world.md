# Round 9, Gablefall's world (the `gablefall` lane's world builder)

The brief is `notes/r9-briefs/gablefall.md` sections 0 and 2 and section 3's visual items; the rules `notes/r9-lanes.md`.
This file is the world's: Low's cost before the world, what was built, why a player would feel it, what the critics
said, what is short. The lane's own notes (the sim, the bot, the set pieces' sim, the score, the pool, registration)
are `notes/r9-gablefall.md`. Frames are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gablefall/world/`.
Nobody has ridden Gablefall by hand, and every frame here is staged (a sled held on a line at a speed,
`scripts/r9/gablefall-world-frames.js`), not a ride.

## 0. Low's cost, before the world (DECISIONS 392)

**The risk.** The town is everywhere: two rows of houses down the whole run and the town past them, about 400 m of
houses in view on both sides, where the five's street piece (`town.ts`) is 30k triangles on Low and 66k on High for
120 to 200 m of street. Drawn as the five draw a town (a house a part, a few draws a piece), Gablefall would be two or
three of those pieces at once all run long.

**The design measured** (the stand-in, `src/render/gablefallworld.ts` at its first commit, built the way the world is
built, not a mock-up):

- The roofs' snow is the terrain: the sim's ground *is* the snow on the roofs, the street and the drifts, so the
  terrain draws it with no new draw. Its only change on Gablefall is a pair of columns either side of the house fronts,
  a corner drift's inner side and the rows' backs, and a pair of rows at each end of a roof's step
  (`gablefallplan.ts townColumns`, `townRows`), so a front and a step are drawn sheer (at Low's 1.6 m spacing a house
  front was a snow ramp reaching 1.5 m into the street). That costs triangles, not draws.
- The houses are not objects. The course is cut into 128 m segments; each segment's near rows (every house's front on
  the street with its windows, door and plinth, its back on the lane, the slate fascia and the lip of snow along both
  eaves) are one mesh, and the town past them (two rows deep on Low, three above, of houses with steep slate roofs
  under snow, a chimney, their windows toward the run) is the baked far piece: one more mesh a segment on Medium and
  High (it casts no shadow), merged into the near one on Low. Built once from the course; no per-frame work but a
  segment's visibility by reach (420 m ahead on Low, 640 Medium, 760 High; 60 behind).
- One material for all of it (`makeToonMaterial`, `glowMask`): the windows are glass painted a warm lamp colour that the
  house material lights from its own colour (GLOW_MASK reads bright, saturated vertex colour), not lights. Plaster, slate
  and snow do not glow.
- The five's grammar is off on Gablefall, as on the Old Run and Gullhaven: no forest or dressing (the clearings), no
  grandstands, gate, lift or huts (`landmarks.ts`), no overlook or composed place, no stakes or flags
  (`speedposts.ts`), no villages, hamlets or forest in the mid-ground (its own town mode). Those draws pay for the town.
- Chimneys are the sim's obstacles in the props' one instanced draw for their kind.

**The count** (a held Low run, the `fresh` save, the sled held at 30 m/s on its line, 300 m windows,
`scripts/r9/gablefall-world-glcount.js`, which now also sums the triangles and points drawn from the draw calls
themselves; counts, never frames a second; `gl/s0-standin.txt`):

| What | Stretch (sim m) | Calls a frame | Draws | Triangles |
| --- | --- | --- | --- | --- |
| Pinecrest | 543 to 844 | 349.8 | 37.3 | 150,335 |
| Pinecrest | 1,373 to 1,673 | 417.4 | 42.8 | 104,061 |
| Gablefall as Pinecrest's look (before) | 541 to 840, street | 348.0 | 35.3 | 74,476 |
| Gablefall, the stand-in | 544 to 844, street | 314.7 | 34.3 | 62,409 |
| Gablefall, the stand-in | 541 to 841, roof | 310.3 | 33.2 | 62,347 |
| Gablefall, the stand-in | 1,441 to 1,741, street | 312.2 | 33.7 | 64,501 |
| Gablefall, the stand-in | 1,442 to 1,742, roof | 313.5 | 33.7 | 64,765 |

On Low at 583 m the town's segments in view were four (512 to 1,024 m), 2,252 + 2,236 + 1,418 + 990 triangles, 6.9k
in all; the whole run's town 38k; the terrain 35.5k in nine chunks (the steps' rows and the fronts' columns about double
the five's terrain there).

**What it says.** At the planned density the town costs four draws in view on Low (one a segment), and with the five's
forest, dressing and places gone Gablefall's held Low run is 10 to 25% *under* Pinecrest's calls (310 to 315 against 350
to 417) and 3 to 9 draws under, at under half its triangles. **The design that keeps it level with Pinecrest's:** the
segments as built (one draw a segment for the town, near and far merged on Low; never a draw a house), one glowing
material, the far piece built once, and the places that are not the street (the church, the market halls, the quay, the
bridge, the valley's far side and the viaduct, the set pieces' props) each one merged draw drawn only within reach.
Those places and the set pieces have about 30 to 35 calls of headroom (four or five draws) before Gablefall reaches
Pinecrest's lower stretch. The world below is built to that budget and counted again as built (section 6).

## 1. What the world is (each decision, and the reason a player would feel it)

**The idea.** A hill town of steep roofs packed down a valley side, so snowed in that the roofs are the way down, in a
snowfall on a grey afternoon. The run starts on the snow along the church's nave, crosses the close, then rides the
roofs (or the street between them, the slow way) down three stages of town, through two market squares, to the quay
and onto the river's ice, where the line lies under the old stone bridge. Across the valley the town's other half
climbs the far side behind a railway viaduct. Nothing of the five's grammar (no pine, no peak, no panorama, no sea of
cloud, no lamplit square at the line) and nothing of the Old Run's (no wood, no track, no lake town under a setting
sun) or Gullhaven's (no sea, no cliff, no storm deck with a low sun under it).

**Where it lives.** `src/render/gablefallworld.ts` (everything that stands, loaded with `import()` the first time its
course is drawn: nothing of it is in the first download), `src/render/gablefallplan.ts` (small and static: whether a
course is Gablefall's, the ground drawn past the corridor, the terrain's extra columns and rows, the street's and the
river's shares, the clearings), and rows and branches in the shared files (section 2).

- **The roofs are the terrain's snow; the houses stand under it.** The sim's ground *is* the snow on the roofs, the
  alleys, the drifts and the street, so the terrain draws it. Its fronts, a drift's inner side and the rows' backs are
  drawn sheer (a pair of columns either side of each, and a pair of rows at each end of a step), and every wall the
  world stands in front of such a step stands 6 cm proud of it (in the step's own plane the snow's face ate the lower
  half of every front). Each house: its front on the street from the cobbles to its eave, painted from a damp foot to a
  pale head (one flat colour read as an untextured box), a stone plinth, a string course between the storeys, two
  storeys of windows in bays with pale surrounds, glazing bars, shutters on some, a sill of snow, now and then a
  townsman at an upper window, a door, on some a lamp on a short bracket close to the wall; its back on the lane; a
  slate fascia along both eaves standing past the snow's lip, so from the roofs the eave's edge is a dark line over the
  drop and the roof's end is read before it is ridden off; icicles under it here and there.
- **The roofs read as the way down, the street as the slow way.** From a roof the lens looks along the row's ridge,
  the chimneys (the hazards, stone stacks as tall as their colliders, dark and hard, half of them smoking) to weave, the
  opposite row's lit fronts across the street's canyon below, and the town's steep roofs all round; the eaves' slate
  edges say where the roof ends. From the street the lens is between six-metre fronts in their shade, on trodden snow
  over cobbles (`materials.ts` STREET: the setts rounded, laid in arcs, showing only where the snow is scuffed, a step
  cooler than the roofs' fresh snow, no runners' old tracks down it), the alleys' mouths walled with arched timber gates
  (the alleys are drifted full to the eaves: as bare faces of snow the shader drew them as curtains), the corner drifts
  held by a wall of weathered boards rising with them, flags over their upper posts so the way up is marked from down
  the street.
- **The town past the rows** is the baked far piece (section 0): houses with steep slate roofs under snow, a chimney,
  windows toward the run, two or three rows deep, a little lower than the ridden roofs so these stay the high ground.
- **The church** at the head: the run starts on the snow along its nave (the sim's deck, 12 m wide), its roof falling
  steeply either side past the limit to the eaves over buttressed walls with tall lit windows standing from the hill;
  slim pale pinnacles on the buttresses standing over the nave's snow down both sides with bunting strung between them
  (dark, they read to the sort's critic as obelisks and grave markers); the west tower behind the start with its belfry,
  a clock with hands and no figures, pinnacles and a slate spire with snow on its faces, a weathervane; the churchyard's
  stones under the snow and the townsfolk in it to see the riders off (the start is the town's occasion, not a gate).
- **The market squares** at the two stage lines: a market hall either side past the limit, an arcade with lit stalls,
  braced timber framing over it, a steep roof with a bell-cote; between them the gallery bridged high over the square
  on a deep beam, its underside 10.5 m up, framed in timber, with three arched lights in each face, one over each lane
  of the charm gate (`charms.ts laneX`), so the gate's arches stand in the market's. Stalls under striped awnings in
  muted colours and barrows round the square's edges, past the limit.
- **The quay, the river and the bridge.** The quay's stone wall at the limit on the town's side with tall narrow houses
  on it, steep gables to the river; the boathouse at the quay's head where the last roofs come down; the river's ice
  drawn as the frozen lake is (black ice and blown snow, `riverAt`), its mirror the sky alone (a treeline is the five's;
  a roofline of gables drawn there read as a black sawtooth); the far bank's sheds low across the ice; and at the line
  the old stone bridge: a great segmental arch over the run (its soffit 8.5 m or more over the snow anywhere a sled
  can be), two more over the river, piers with cutwaters, courses on both faces, a gatehouse at the town's end, lamps
  and bunting along its parapets, the townsfolk on it, a banner of ink and cream checks hung from the parapet over the
  arch's crown toward the riders coming down, and the line's four rows of checks on the ice under it. In daylight and
  the snowfall: no grandstands, no board with a word, no lamplit square.
- **Across the valley** (`hazeMaterial`, one draw): the far hillside rising out of the snow past the run's end, the
  town's other half on it in terraces along the contours (house by house it read as dice thrown on the snow, then as
  speckle), its church and spire, and the viaduct striding across the valley on tall piers and round arches in front of
  it. Its own haze on a long scale (the scene's fog would take it whole from the head of the town), in the hour's light.
- **The light** (`palette.ts`): a snowfall in a grey afternoon. A pale snow cloud over the whole sky, a pale coin of sun
  through it ahead and to the left (with no disc the first critic found nothing lighting the picture), soft shadows
  that still give the roofs and the street their form, the windows a lamp behind glass by day and lamplit from dusk
  (glowing orange by day they read as stickers). The run is a sequence of pictures: the snow thickest over the Market,
  the cloud breaking over the river at the Water Stairs, the line crossed in daylight with the snow still falling. Its
  places (`PLACES`): the nave and the squares a little warmer with the lamps telling, the quay open under the sky. A
  steady fall, not a storm (heavier, its big flakes at the lens read to the critics as smudges). No crows in its
  snowfall (a flock at the vanishing point read as noise, `life.ts`).

**Its other hour: Evensong** (`ALT_HOURS.gablefall`, dusk 0.85). Drawn, not wired (the main lane decides how a player
reaches it): the same snowfall at the day's end, the cloud deep blue-violet lit faintly warm from under by the town,
the snow lilac-blue, every window lit, the lamps' soft pools, the church's windows at the head and the bridge's lamps at
the line, no moon and no stars.

**HUD.** No signal added (the concept says none new).

## 1b. The set pieces as the world draws them (`src/render/gablefallpieces.ts`)

The lane's three verbs (`chain`, `awnings`, `washing`) and two legends landed in `src/sim/moments.ts` with the
registration (1a7cda8). Their props are `gablefallpieces.ts`, loaded with the world and built from the plays on the
first frame (a run's own, or `momentPlays(c)` on the title), as `gullhavenpieces.ts` does; `verbworld.ts owns` and
`marqueeworld.ts standIns` leave the three verbs to it. Nothing stands on the snow a sled rides (`tests/gablefallworld.test.ts`:
nothing on the roofs' snow, nothing in the street under 2.6 m inside where a sled is held), and no HUD signal is added.

- **The Roof Run (chain, 240 to 830 m).** A little iron lantern on a bracket under the front eave of every house of the
  play, both rows (53 on the lab course): pale glass until the rider lands that roof, then lit (a marigold sparkle as
  it takes); the next roof's lantern on the rider's side breathes while the chain is on or coming; a chain broken
  gutters every lantern it lit to an ember; won, they flare. From the roofs a rider sees the other row's lanterns
  across the street, so the chain reads as a line of lights. (The plan had them on stalks over the roofs: anything on a
  roof is on the run, so they hang under the eaves.)
- **Market Day (awnings, 1,080 to 1,450 m).** At each of the sim's stalls (every 40 m, AWNING_STEP), a pair of striped
  canvas awnings from the fronts that stand there, in the stalls' muted stripes and cream (never vermillion), a
  valance, their snow on top and two iron struts each; the edge three metres over the street and following its grade;
  a pool of lamplight on the street between the pair. The next pair's pool breathes; a stomp there shakes the snow off
  both awnings in a puff and flares the pool. (The sim counts a stomp anywhere on the market street; the stall nearest
  the rider answers it.)
- **The Washing Lines (washing, 2,060 to 2,460 m).** At each line the sim rings (one an alley, both rows, washingOf), a
  line from a pole standing on the alley's gate to a pole in the back lane, sagging lowest where the sim rings it, a
  metre over the alley's drift; sheets, shirts and a long scarf in cream, pale blue, sage and lilac pegged along it,
  never hanging into the snow; a pool on the drift under its lowest point. Rung, the line jumps and settles and throws
  its frost; the next line's pool breathes; a missed one goes dark. On Low the lines are in the props' one mesh and do
  not jump.
- **The legends** (Candlemas, the Lamplighter) are the lane's kinds (`sky`, `runner`), drawn by the legends' own
  system: nothing of the world's.
- **Cost**: one mesh for all the props, an instanced draw for the lanterns and one for the pools; on High and Medium a
  mesh a washing line, drawn only within 380 m ahead (260 on Low).

## 2. Every hunk in a file other systems share

- `src/sim/mountains.ts` (the one sim change, its own commit f558200): `BiomeId` gains `'gablefall'`, `CourseBiome =
  BiomeId`, `LOOK` empty. Nothing else in `src/sim` is the world's.
- `src/audio/score.ts` `SONGS.gablefall` and `src/audio/theory.ts` `CLEAR.gablefall`, `ACCENTS.gablefall`: Pinecrest's
  rows as placeholders, commented "until Gablefall's score" (f558200); the score's own commit (99b375a) has replaced
  them, so none of mine is left in `src/audio`.
- `src/ui/contract.ts`: `'gablefall'` in `MountainCard['biome']` (f558200; it is what `app.ts cardArt`, `progress.ts
  nextUnlock` and `beatsui.ts` asked for: no hunk in those three).
- `src/ui/art.ts`: `RIDGES.gablefall` (the card: a snowfall over steep gables stepping down to the right, the steeple at
  the head, lit windows, the viaduct across the valley) and `SKY.gablefall` (a lilac-grey snow cloud down to a warm
  grey). No `.b-<biome>` rule.
- `src/game/keyart.ts`: `TITLE_SHOTS.gablefall` (the Water Stairs' roofs where the cloud breaks over the river; the lens
  high and swung over the street).
- `src/render/palette.ts`: Gablefall's rows in `biomeBase`, `clearSkies`, `round7`, `visualLift`, `JOURNEY.gablefall`
  (two stops), `ALT_HOURS.gablefall` (Evensong), `PLACES.gablefall` (nave, square, rooftops, quay). Once registered,
  `tests/palette.test.ts` found Gablefall's air and shade within its 0.7 of Gullhaven's from the opening to the Market
  (0.53 at its closest, over the Market stretch): the snowfall's air is now whiter (`fog` #D8D4DE, the Market's
  #D2CEDC) and its shade a lighter lilac (`snowShade` #9A96C6), 0.745 at the closest; looked at in `pieces/v3-*`, by
  me only.
- `src/render/materials.ts`: `makeSnowMaterial(track, street)`: a `STREET` define (Gablefall's terrain only): the
  street's trodden snow on `aPaint.w` (the tree run's canopy channel, unused there: its block is `#ifndef STREET`; the
  setts it once drew are gone, b6dd1be), no runners' old tracks on the street, and no treeline in the frozen water's
  mirror. No line of the five's program changes.
- `src/render/terrain.ts`: imports from `gablefallplan.ts`; `lateralOffsets` adds `townColumns()` on Gablefall;
  `rowPositions` adds `townRows`; a `town` flag (no drifts heaped past the edges, no rock weight); the street's share in
  `aPaint.w` and the river's in the lake channel (`riverAt`); the street, the squares' middles and the nave's approach
  groomed by the vertex on Gablefall (`streetShare`: grooming by the row flattened the roofs and the nave too);
  `geo.userData.street` and `Terrain.streetMat`. (`src/render/snowsurf.ts`: a Gablefall row added in b6dd1be and taken
  back in a0629ce; no change to it is left.)
- `src/render/ground.ts`: `groundOf` and `visualGround` branch to `townGround` on Gablefall.
- `src/render/midground.ts`: a `town` flag: no villages or hamlets, no forest, both sides gently rolling (`modeRaw`
  0.3), no far wall (`sideInfo`).
- `src/render/world.ts`: the `GablefallWorld` type import and `gablefallplan` import; three fields (`gablefall`,
  `gablefallLoading`, `gablefallRoot`); `gablefallClearings` in the dressing's keep list; the root in the scene;
  `syncGablefall()` in the constructor and `setCourse`; `setDetail`, `reset`, `update`, `beats` calls; the method
  `syncGablefall` (the dynamic `import('./gablefallworld')`, the world given the particles for its set pieces); in
  `applyWeather` Gablefall's flakes at a size of 0.055 for the five's 0.08 (its big near flakes read as smudges at the
  lens).
- `src/render/verbworld.ts` (`owns`) and `src/render/marqueeworld.ts` (`standIns`): `chain`, `awnings` and `washing`
  beside Gullhaven's three, a comment each: Gablefall's props are its own (`gablefallpieces.ts`).
- `src/render/landmarks.ts` (`layout` empty), `overlook.ts` (`planTo` plans none), `compose.ts` (`plan` composes none),
  `speedposts.ts` (`update` returns): `|| c.kit?.id === 'gablefall'` beside the Old Run's and Gullhaven's, a comment each.
- `src/render/life.ts`: no birds on Gablefall's Clear Skies (`applyMood`).
- `src/render/meshes.ts`: the lane's stand-in `chimneyGeometry` replaced by the stone stack; `CHIMNEY_MODEL_R`,
  `CHIMNEY_MODEL_H`; `obstacleModelRadius('chimney')`. `src/render/props.ts`: a chimney's height scaled to its
  collider's (`CHIMNEY_MODEL_H`).
- `src/render/crowd.ts`: `DRESS.gablefall` (townsfolk in winter wool); `CUT` and `PROP_REST` rows (Pinecrest's, never
  stood, commented).
- Rows commented as Pinecrest's and never read: `flora.ts VARIANT_SHARE`, `landmarks.ts LAMP_LIGHT`, `SPAN_KINDS`,
  `BANK_KINDS`, `ENC_KINDS`, `speedposts.ts STYLES`, `village.ts STYLE`, `places.ts spanStyle`, `town.ts townStyle`.
- `tests/ground.test.ts`: Gablefall's branch in each of the four tests that walk every mountain's edge, before the
  generic `if (c.kit)` that is the Old Run's (the handover meets the town's ground exactly; nothing stands on a wall or
  a ledge, the five's dressing is kept off both sides, the drawn ground is the sim's out to the limit and the lanes past
  the church sit at the street's level; no animal at a treeline and no gorge, twice).
- The other render suites that walk every mountain, each a Gablefall branch beside Gullhaven's: `tests/compose.test.ts`
  (composes none, its nave at the head and its quay at the line, its clearings round the line; its far hills the Old
  Run's low ones but dry, its own look past the banks being its world's), `tests/midground.test.ts` (no tree stands),
  `tests/overlook.test.ts` (no lip or drop, the town's ground past the edges; no lift at its head, the nave),
  `tests/setpieces.test.ts` (its sections; its line's checks over the ice between the corridor's edges, 3.5 cm up; its
  church and churchyard as its start on both tiers; its folk past the limit or high on the bridge). `tests/modes.test.ts`
  (the Long Night's legs, 16 now) fails on the lane's change, not the world's.
- Not touched by this lane: `src/render/rider.ts`, `spiritflow.ts`, `ghosts.ts`, `src/game/garage.ts`, `twelve.ts`;
  `src/render/meshes.ts` only as above (the chimney).
- New: `src/render/gablefallworld.ts`, `src/render/gablefallplan.ts`, `src/render/gablefallpieces.ts`,
  `tests/gablefallworld.test.ts`,
  `scripts/r9/gablefall-world-frames.js`, `gablefall-world-glcount.js`, `gablefall-world-photo.js`,
  `gablefall-world-title.js`, `gablefall-world-sort.mjs`, `gablefall-world-rows.ts`, `gablefall-world-spike.ts`.

## 3. Frames (`shots/r9/gablefall/world/`)

- `before/`: the lab course as it was drawn before the world (Pinecrest's look on Gablefall's ground). `s0/`: section
  0's stand-in (High and Low). `w1/`: the first full world.
- `sort-colour/` (the sort's five in colour), `sort1-key.json` (the sort's key; the folder shown was
  `shots/r9/blindsort-k8/`).
- `r1/` to `r6/`: each critic round's set (a to f down the run on High, g and h on Low, i and j at Evensong), `r6/` the
  last looked at by me only; `pairs-src2/` to `pairs-src5/` and `r2-` to `r5-pairs-key.json`, `r2-` to
  `r5-picks.json`; the critics' folders `shots/r9/crit-g1/` to `crit-g5/`.
- `mir/` (mirrored), `med/` (Medium, on the registered mountain), `photo/` (photo mode from pause and Save Clip from
  the results), `title/` (the picker, the unlock notice and the key art once registered, section 10), `pieces/` (the
  set pieces' props, staged), `gl/` (`s0-standin.txt`, `built.txt`), `dev/` (contact sheets and crops; `dev/stray/`
  holds frames a script wrote to the default folder when its settings were lost to a reload).

## 4. The greyscale sort

Gablefall's first frames (its opening on the nave at 26 m, a roof at 700, the street at 1,400, a roof at 2,100 and the
finish at 2,780) in greyscale, shuffled with the five's set (`shots/r9/measure/stills/gray/`), the Old Run's and
Gullhaven's (`scripts/r9/gablefall-world-sort.mjs`, seed 4471, 40 frames, the key in `sort1-key.json` outside the
folder, the folder `shots/r9/blindsort-k8/` named for nothing), given to a fresh critic (Opus, extra effort) with
ART.md alone. It sorted all eight groups right and put Gablefall's five together (frames 04, 08, 09, 27, 33) as **the
group most unlike the rest**: "no mountain" (the horizon flat in every frame), "buildings fill the near plane", "the
run is architecture: the rider is on a roof ridge or a street, not in a snow corridor between banks", and no light
source. The runner-up for unlike was the Old Run. It read the roofs as "the run goes along roof ridges among chimneys"
and the street as "a street of plain terraced houses". (ART.md's path named the worktree; the critic used it only to
name the group after it had sorted them by sight. The critics' folders after it carry their own copy of ART.md.)

What it could not read went into the critics' loop: the sim's spike (a mill chimney dead ahead, a pale column: the
row-end bug, fixed by the lane in c1c8811), untextured fronts and arches, the setts as a square grid, two dark ruts
down the street like tram rails (the packed lane's old runner tracks), the pinnacles as dark spikes, no finish, no
light.

## 5. The critic loop (fresh Opus critics at extra effort, given only ART.md and the frames)

- **Round 1** (open critique, ten frames: six down the run on High, two on Low, two at Evensong; `r1/`, the key
  `r1-key.txt`, the folder `shots/r9/crit-g1/`). Worst first: the giant column (the sim's spike); one flat unmotivated
  light down the whole run, milky values, no three planes; nothing saying what is rideable on the roofs or which way is
  faster; windows saturated orange by day ("stickers"); a finish that does not say finish; the setts as graph paper;
  the opening not an occasion and its pinnacles as dark obelisks; specks of noise at the vanishing point (the crows)
  and on the far plain; smudges at the lens (the snowfall's big flakes); an empty town (no crowd, no bunting, no smoke
  showing); the finish's ice pale and matte, the rider's reflection a red smear; untextured architecture (flat fronts,
  a ruled grid of timbers, quoins floating as cards); at Evensong both walls lit peach. It found the place its own in
  its architecture ("a terraced hill town with a viaduct over a white valley and a finish at a bridge over a river looks
  like nothing ART.md describes") and the streets "strong one-point corridors".
  Fixed (e66e661): the pale sun coin and firmer shadows, the run's journey (thicker snow over the Market, the cloud
  breaking at the Water Stairs), walls painted from foot to head, glazing bars, shutters, figures at windows, quoins
  out, the windows a lamp behind glass by day, the eave's slate edge from above, setts rounded in arcs and only where
  scuffed, no old tracks on the street, pale pinnacles over the snow with bunting and the churchyard's folk, flags on
  the drifts' boards, braced framing, the line's banner and the bridge's bunting and courses, smoke that shows, no
  treeline in the river's mirror, the far side taking the hour's light, no crows.
- **Round 2** (blind pairs, round 1 against round 2, ten pairs, `pairs-src2/`, key `r2-pairs-key.json`, picks
  `r2-picks.json`, folder `shots/r9/crit-g2/`): **9 of 10 picked the new**. Lost pair 08 (Low's street: the new frame's
  lens held the rider dead centre over the vanishing point and its setts read stronger). Remaining, worst first: the
  smoke drawn as a translucent box; smudges at the lens; setts still a grid on Low; a spirit light sitting on the
  beanie (the sim's light on the line); the pinnacles still dark; the finish's ice pale, a ring under the sled (the
  landing aid, held sled), a beam's streak on the ice; far towns as speckle; the gallery a plain box; shutters at a
  grazing angle like cracks; at Evensong a warm wash over the street. Fixed (c310b6a): the smoke in round separate
  puffs, a lighter snowfall, rarer fainter setts, pale slim pinnacles, softer pools, the far side in terraces under one
  roofline each and hazed on its own scale, the gallery framed in timber.
- **Round 3** (blind pairs, round 2 against round 3, `pairs-src3/`, key `r3-pairs-key.json`, picks `r3-picks.json`,
  folder `shots/r9/crit-g3/`): **4 of 10 picked the new**. Most of the losses were the lens (the chase camera stood
  lower in one capture than the other, and the critic chose the higher lens each time, `scripts/r9/gablefall-world-
  frames.js` holds the sled, not the camera's own state) and the far town: as long terraces under one roof it read as
  "pale slabs, an unfinished distant version", where round 2's houses read as "a hillside of houses". Remaining, worst
  first: on the roofs a white curb along the eave read as a rail to ride; light streaks on the river's ice toward the
  lens (the line's beams in its mirror); the start's runner grooves (the rider's own trench, not the world's) and a
  dotted seam across the brow (the viaduct three kilometres off); empty flat streets; smudges at the lens; setts under
  the lens as a grid; speckle in the far town; no painted line visible on the ice. Fixed (51070c1): the roofs end on the
  slate's dark edge (no white lip), shops and window boxes, the far town house by house again under a deeper haze, the
  line's checks twice as long, the river less of a mirror, the setts kept from under the lens, a lighter snowfall, deeper
  far ranges.
- **Round 4** (blind pairs, round 3 against round 4, told to judge the world and not the lens's height, `pairs-src4/`,
  key `r4-pairs-key.json`, picks `r4-picks.json`, folder `shots/r9/crit-g4/`): **7 of 10 picked the new**. Lost: the
  opening (no difference it could see: a coin toss), a roof frame (the deeper haze had taken the viaduct out of the
  frame at 2.5 km: "B has a far landmark that A lacks"), and the Evensong street (the smaller lamp pools: it wanted the
  street's own light on the snow). It read setts showing through the street's snow as "bare ground on the ride line"
  (ART.md 4) and as a lane of their own. Remaining, worst first: smudges at the lens (the snowfall's big near flakes
  drawn darker than what is behind them); on the roofs the run the same white as the roof beside it; a pale streak on
  the ice; empty streets (no bunting, signs, awnings); facades lit orange at night; the drifts' boards and a stage
  gantry as possible hazards; even diagonal bands on the quay's wall; hummocks on the street (the wind's relief, as on
  powder); speckle; the start weak. It called Gablefall "a town you ride through ... none of the seven mountains in
  ART.md is like it", the light the one thing that does not say where you are.
  Fixed after it (this commit and the next): the setts gone (the street is trodden snow, a step cooler and duller, its
  noise its own), the street, the squares and the nave groomed (`snowsurf.ts`: a made place's whisper of relief), the
  far side's haze a soft air near and a fade into the snow past 2.4 km (the viaduct back in view from Church Hill, gone
  from the head of the town where it was the seam), the lamps' pools a little larger again, the quay's wall one stone
  with its courses, smaller flakes on Gablefall (`world.ts applyWeather`), bunting swagged along some fronts under the
  eaves, the river's mirror less again.
- **Round 5** (blind pairs, round 4 against round 5, `pairs-src5/`, key `r5-pairs-key.json`, picks `r5-picks.json`,
  folder `shots/r9/crit-g5/`): **5 of 10 picked the new** (nine of ten frames went to one side, B). Read against the
  key, it chose the groomed street every time and the powder roofs and nave every time: round 5 groomed by the row
  (`snowsurf.ts`), which flattened the roofs and the nave with the street, and the roofs lost the wind's relief that the
  light draws. Fixed (a0629ce): the street groomed by the vertex, so the street and the squares' middles are trodden and
  swept while the roofs and the nave keep their relief (`snowsurf.ts` takes back its rows); the river's ice as much a
  mirror as round 4's (its fractures and crust read as ice); one door lamp in three lays its pool, so the street at
  Evensong is pools with the blue between, not both walls washed peach.
- **`r6/`** (the set after a0629ce) went to no critic: I looked at it myself, the groomed street and the powder roofs
  side by side as round 5 asked, the Evensong street in pools.

## 6. Low as built

Designed, not cut: the town past the rows merged into each segment's one mesh (two rows deep, not three), wider window
bays and no surrounds, glazing bars, shutters, shops, window boxes, icicles, quoins or the street's lamps; the
churchyard's stones off; fewer townsfolk, bolder; the valley's far town in four rows of houses, not seven, every other
house; fewer smoke puffs a chimney (three, not four); the places drawn only within reach (420 m on Low, 640 Medium,
760 High).

GL calls on a held Low run as built (the `fresh` save, the sled held at 30 m/s, 300 m windows,
`scripts/r9/gablefall-world-glcount.js`; counts, never frames a second; `gl/built.txt`), at c310b6a:

| Stretch (sim m) | Gablefall: calls, draws, triangles | Pinecrest (same z0): calls, draws, triangles |
| --- | --- | --- |
| The opening, 10 to 311 | 416.6, 43.5, 88,573 | 491.0, 49.1, 137,866 |
| Church Hill's street, 541 to 841 | 327.2, 35.5, 67,801 | 356.5, 38.2, 150,290 (540 to 841) |
| Church Hill's roofs, 541 to 841 | 328.9, 35.5, 68,138 | |
| The Market, 941 to 1,241 | 315.0, 34.6, 76,007 | |
| The Market's street, 1,441 to 1,742 | 313.6, 35.6, 71,462 | 412.3, 42.6, 108,679 (1,440 to 1,741) |
| The Market's roofs, 1,441 to 1,740 | 319.0, 36.3, 72,218 | |
| The quay and the line, 2,691 to 2,873 (the run ends) | 363.5, 35.2, 52,305 | |

Programs 78 against Pinecrest's 68 to 74 (the street's snow, the town's material, the haze and the smoke). So as
built, Gablefall's held Low run is 8 to 24% under Pinecrest's calls on the same stretches (15% under at the opening),
2 to 7 draws under, at half its triangles or less: section 0's design held with its places in. The finish stretch's
363 calls are the climax's and the fireworks' (Pinecrest's own finish was not counted). The main lane times frames a
second.

## 7. What only scripts have seen

Everything. Nobody has ridden Gablefall by hand, through this world or before it. What has been looked at, and how:

- **The run, by frames**: the chase camera's frames with the sled held on a line at a speed by
  `scripts/r9/gablefall-world-frames.js` (on the street's middle, a row's ridge, or an offset), on High, Low and
  Medium, at the day and at Evensong (`setHour('alt')` from the page, not a player's way in), and mirrored
  (`World.setMirrored`). I looked at every set myself before it went to a critic; the critics saw only the frames.
- **Low's cost**: GL calls, draws and triangles counted on a held Low run (`gablefall-world-glcount.js`), never frames a
  second.
- **Photo mode and Save Clip** (`gablefall-world-photo.js`): photo mode opened from pause as a player opens it, its
  picture shot with its bar; Save Clip started from the results, shot while it records, and cancelled; the console
  clean. On the lab seed, before the mountain was registered.
- **The title with Gablefall registered** (`gablefall-world-title.js`, after the lane's 1a7cda8): the picker on the
  save fixtures on desk and phone, Gablefall's chip pressed, and a run on `novice-1` from the title until the unlock
  notice came, then the results. Section 10 has what each showed, and how the run went.
- **The set pieces' props**: staged frames with the sled held, the lit lanterns lit by the script (section 10).
- **Medium**: six frames on the registered mountain (`?debug&m=7`), the console clean.
- **Never seen at all**: the world in motion under a rider's own line (landings, hops, drops off an eave, the corner
  drifts taken back up), its beats, the set pieces answering a rider, the phone's run (only its title), a Cup or a Daily
  on Gablefall's ground (it has none to 2040).

## 8. What is short

Worst first.

- **Nobody has ridden it by hand.** Every frame is a sled held by a script on a line at a speed; the hops, the drops
  off the eaves, the stomps and the corner drifts have never been seen through this world in motion, and its beats
  (`GablefallWorld.beats`, the set pieces' answers) never seen to fire.
- **The set pieces' props have been seen only staged** (section 10): no lantern lit by a landing, no stall stomped,
  no line rung, and no critic has seen them.
- **The palette's last change went to no critic**: the whiter air and lighter lilac shade the palette test asked for
  (section 2) I have looked at in three frames only.
- **A dotted seam across the run at the nave's brink** (about 8 px at 1280 wide, at 44 m on the opening): not the
  viaduct (faded out of that frame since b6dd1be) and not the world's; most likely the terrain's own shading along the
  long depth edge where the nave's snow meets the drop. Not traced to its line.
- **Smudges at the lens.** The snowfall's big near flakes are drawn darker than the sky behind them (the weather's, not
  the world's: `world.ts applyWeather` only makes Gablefall's smaller). Every critic named them.
- **A pale streak on the river's ice toward the lens**: the climax's beams over the line in the ice's mirror, less since
  the mirror was cut twice, still there.
- **At Evensong the fronts read warm orange** to the critics; the windows and the pools are right, the walls take the
  hour's warm fill (palette's, shared with every mountain's other hour).
- **The quay's townsfolk read as boxes** at speed, and the far town speckles at the vanishing point on High.
- **Things not mine that a critic laid at the world's door**: the landing aid's marigold ring on the roofs, the rider's
  coat, a stage gantry's dark bar over the street (read as a hazard), the runner grooves at the start.
- **The key art depends on the hero the pool gives**: on one save it rides the roofs and the shot is the one composed;
  on another it rides the street and a front fills a third of the frame (section 10). The lens cannot choose the line.
- **No camera beat.** Decided against: the roof lens already shows the run of roofs and the street below (frames
  `r6/b-roof`, `e-roof`); a crane over the roofs would compete with the run for the eye. The brief allowed one only if
  it served the roofs.
- **Evensong is drawn, not wired**, and the mirror is drawn, not wired, as the brief asked: neither has a way in for a
  player yet.
- **Frames a second were never judged** (the brief): the GL counts are counts.

## 9. For ART.md section 15 (the text I would add; the main lane owns the file)

### Gablefall: a snowfall over the roofs of a hill town (new in round 9)

- **Feeling.** A winter afternoon in a hill town so snowed in that its roofs are the way down: from the church's nave
  at the head of the town over the roofs, the street below between the lit fronts, down to the frozen river, the snow
  falling the whole way. It ends in daylight under the old stone bridge.
- **How it rides.** Two rows of houses down a street; each roof a gable of snow on slate a step under the last, the
  alleys drifted full between blocks, corner drifts from the street up onto the rows. A rider on the roofs hops each
  step and alley and stomps the landings; one who drops off an eave rides the street until a drift takes it back up.
  The roofs are the line, the street the slow way.
- **Colour script.** A snowfall in a grey afternoon: a pale lilac-grey snow cloud over the whole sky, a pale coin of
  sun through it ahead and to the left, soft shadows, the snow white with a lilac-grey shade; the windows a lamp behind
  glass, lamplit as the day goes.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 180 | The church and the close | The nave's snow between its pale pinnacles, bunting strung between them, the town's roofs below in the falling snow. |
  | 180 to 900 | Church Hill | The grey afternoon, the far side of the valley a ghost in the snow, chimneys smoking. |
  | 900 to 1,850 | The Market | The snow thickest, the windows and the market's arcades telling, the gallery over the square lit. |
  | 1,850 to 2,660 | The Water Stairs | The cloud breaking over the river, a pale sun through the gap, the viaduct across the valley clear. |
  | 2,660 to the line at 2,800 | The quay and the river | Daylight on the river's ice, the bridge's banner of checks over the line, the snow still falling. |

- **What it is not.** No peak, no panorama, no sea of cloud, no pine: low hills in the snow, the town's other half on
  the valley's far side behind a viaduct. No square and no lamplit town at the line: the river under the bridge, in
  daylight.
- **The town.** The roofs are the run's snow on slate; their eaves end on a dark slate edge (never a white lip, which
  reads as a rail); fronts painted from a damp foot to a pale head, windows with glazing bars and shutters, shops and
  window boxes, the alleys' mouths walled with timber gates, the corner drifts held by boards with flags over them; the
  street trodden and swept, a step cooler and duller than the roofs (no setts showing: bare stone on the ridden line);
  chimneys the hazards, stone stacks as tall as their colliders, half of them smoking in round puffs.
- **Its places.** The church at the head, the run starting on its nave between pinnacles; two market squares with a
  gallery bridged high over each, three arched lights in it over the charm gate's three lanes; the quay's tall gabled
  houses and the boathouse; the old stone bridge at the line, a banner of checks hung from its parapet, the townsfolk on
  it; the viaduct and the town's other half across the valley, fading into the snow from the head of the town.
- **Its other hour: Evensong.** The same snowfall at the day's end, the cloud lit faintly warm from under by the
  town, every window lit, the lamps' pools on the snow with the blue between, the church's windows at the head and the
  bridge's lamps at the line; no moon, no stars.
- **The set pieces.** The Roof Run's lanterns under the eaves lit roof by roof, an ember when the chain breaks; Market
  Day's striped awnings shaking their snow off when a stomp lands under them; the washing lines across the alleys,
  jumping and throwing their frost when rung (section 1b). Never on the snow a sled rides.
- **Low** is a poster of it: the town past the rows merged into each segment's one draw, two rows deep, no window
  dressing; on a held Low run 8 to 24% under Pinecrest's GL calls on the same stretches, at half its triangles.

## 10. Once MOUNTAINS held Gablefall (the lane's 1a7cda8)

All by script, on the dev server with the save fixtures (`scripts/r9/gablefall-world-title.js`, frames in
`title/`, the readings in `title/desk.json`, `desk-unlock.json`, `phone.json`); the console clean in every one but
where noted.

- **The picker**: eight chips in two rows of four on the desk (1280 by 720) and the phone (390 by 844), none clipped,
  in the unlock path's order: Pinecrest, Frostfang, Gablefall, Ember; the Old Run, Sakura, Gullhaven, Lanternfall.
  Gablefall's chip is its own card (`RIDGES.gablefall`: the steeple, the gables stepping down, lit windows, the
  viaduct). A first visit (`fresh`) shows no picker, as before.
- **Gablefall at 8, between Frostfang (4) and Ember (12)**: on `mid-1` (3 ghosts) its chip is locked, "Pass 5 more
  ghosts to unlock", and pressed, the quiet line says "Gablefall: pass 5 more ghosts to open it" (the quiet line
  itself names Frostfang first, 1 more); on `novice-1` (5 ghosts) "3 more ghosts open Gablefall" is the quiet line; on
  `novice-5` (15) and `mid-100` it is open and pressed it travels: the title's key art goes to the Water Stairs.
- **The unlock notice**: on `novice-1`, a run on Pinecrest from the title (`autoride`), three ghosts overtaken, the
  band said "Gablefall unlocked . Ride it from the title" with its snowflake on a swatch of sky
  (`title/desk-results-2.png`, at 263 m). The dev server reloaded the page once under the run (another lane's edit), so
  the sled the script held was let go and the notice came on the reloaded run, the sled riding on its own; the swatch
  is too small in the frame to judge its colour. One page error in that run was my script's own (it polled
  `window.__gs` across the reload).
- **The key art**: on `mid-100` the hero rides the roofs at the Water Stairs and the lens shows what it was set for:
  the rider on a roof, the roofs stepping down, the street's canyon to the right, the viaduct and the far town across
  the valley (`title/keyart-now-b.png`). On `novice-5` the hero rode the street there and the frame is the street
  between its fronts with the viaduct at its end, a front filling the left third (`title/desk-novice-5-gablefall.png`).
  Two higher lenses (`keyart-high`, `keyart-higher`) lost the rider into the corner or off the frame, so the lens
  stays. The pool's riders choose the line, not the world: sampled over a long reel, the hero I sampled rode the street
  most of the way.
- **The phone's title**: the same eight chips; Ride's line "A town under snow: ride the roofs, stomp each land" is
  cut at the button's edge (the tagline is the lane's, the button the main lane's).
- **Medium**: six frames on the registered mountain (`med/`, `?debug&m=7`), the console clean.
- **The set pieces' props** (`pieces/`, the sled held as for the world's frames; no landing is made by a held sled, so
  every lit lantern in `v2-alt-b-roofrun-street` was lit by the script, and no stall is stomped or line rung in any
  frame): the Roof Run's lanterns under the eaves down both rows, the next breathing; Market Day's striped awnings in
  pairs with their snow and struts and the pool between (`v2-c2-market`); the washing lines across the alleys from
  their poles, the washing hanging (`v2-alt-d-washing-roof`, `dbg-line-z2085`). The awnings were made to follow the
  street's grade after these frames (a level awning came to 2.4 m over the street at its uphill end), seen again in
  `v3-c2-market`. No critic has seen the props.
