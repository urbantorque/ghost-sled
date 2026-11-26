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
