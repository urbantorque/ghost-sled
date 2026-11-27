# Round 9, the look lane: milestone 4's feel pass on the three new worlds

The brief is `notes/r9-briefs/look.md`; the rules `notes/r9-lanes.md`. Worktree `.claude/worktrees/r9-look`, branch
`r9-look`, cut by hand from `round-9` at bd2ef9a. Frames are under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/` (`sets/<pass>/<mountain>/` the passes, `probe/` the traces,
`crops/` close looks, `legends/` Gullhaven's legends, `five/` the five's frames before and after, `gl/` Low's counts); the
critics' folders `shots/r9/crit-k<n>/` and `shots/r9/sort-k<n>/`, their keys and picks `shots/r9/look/keys/`.

**The dev server ran on 5044, not 5040**: 5040 is held by Windows' own Connected Devices Platform service (svchost,
PID 7668), so vite could not listen there (EACCES). 5044 was free and nobody's.

**The browser slot, once.** The slot is taken as stale after 90 minutes; I held it for 89 through a long probing session,
and the feelui lane took it as stale while my p2 shoot was starting. I stopped my shoot and closed my browser at once (no
second browser ran beyond the minute it took to see), waited for the slot, and from then on gave it back after every batch.

Every frame here is staged (a sled held on a line at a speed, `scripts/r9/look-frames.js` through
`scripts/r9/look-shoot.mjs`), on the registered mountains (`?debug&m=5`, `6`, `7`), headless Chrome at 1280 by 720.
Nobody has ridden any of it by hand.

## How the work was done

- `scripts/r9/look-frames.js`: the three world builders' frame scripts merged into one (their lines: the middle, the Old
  Run's glaze at skill 0.9, Gullhaven's bold line and its air over a gully, Gablefall's ridge), saving frames by name so a
  pass pairs with the last by name.
- `scripts/r9/look-shoot.mjs`: one pass's frames, every pass at the same spots: the opening, three places, the finish,
  each set piece, the other hour and Low, as the world notes shot them (spots in the file). Pass `p0` is the base as the
  lanes left it (bd2ef9a); `p1`, `p2`, `p3` after each round of fixes.
- `scripts/r9/look-probe.js` (through `look-run.mjs`, configs in `scripts/r9/probes/`): the tracing tool. A sled held at
  one spot, or ridden through it again for each variant (`pass`), a variant's page code run before each frame: a mesh
  hidden, a uniform held, and, where the world sets a value every frame, the override laid on in a hook on
  `renderer.render` so nothing the frame does can undo it (the first probes, without it, wrongly cleared the house
  material's emissive and the lamps at Evensong). Inside a shader, a temporary `uLookDbg` switch drew one term at a time:
  it was removed before any commit, so the configs that set it (`oldrun-band2/3`, `gull-shadows2`, `gable4/5/7`) are now
  no-ops and are kept as the record of what was probed.
- `scripts/r9/look-sheet.mjs` contact sheets; `look-pairs.mjs` a pass's blind pairs (blind-pairs.mjs, ART.md beside them);
  `look-sort.mjs` the sorting test; `look-glcount.mjs` Low's counts.

## 1. The faults, worst first: their causes, their fixes, before and after

Before is `sets/p0/`, after `sets/p1/` and on (same names). Every cause below was found by turning things off one at a
time until the fault went, not guessed.

### The Old Run

- **The pale band down the near wall in a wall ride** (worst; DECISIONS 397 "cause not found"). Cause: the glaze's scribed
  edges (`materials.ts`, TRACK only), a hairline in the wall's own shares with a floor of about 0.015 of the wall, so 10 to
  20 cm of ice; seen along the wall from a lens a metre or two off it, that is tens of pixels: the band from the vanishing
  point to the frame's edge (probe `oldrun-band3`: `noscribe` takes it away, the rime and everything else leave it).
  Found by: hiding the scene's children (only the terrain draws it), then drawing the track shader's terms one at a time
  (it is added after the ice's mirror, in the track's own block), then the scribe and the rime off in turn. Fix: the
  hairline is sized on screen (`tFw * 1.5`, a pixel or two wherever it is) and fades out within 3 to 9 m of the lens.
  Seen gone in b-bell, c-q1, d-q2, f-q3, g-hook and Low's l-low-q2; the third critic picked the new side in all six of
  the pairs where it had been.
- **Low's runner lines converging down the track**: the ghosts' lights (`trails.ts GhostTrails`), which every ghost lays
  down the same glaze on the same straights, so they run on as straight lines to the vanishing point. Fix: on the Old Run
  (its kit id) a ghost's light thins from 16 m and is gone by 55 m (the five keep 25 to 80 m and half). Seen shorter in
  k-low-opening and a-opening; the third critic still names the ghosts' runner lines and their sleds' discs (the ghosts'
  look, not the world's: not changed).
- From the third pass (below): the moon by Lamplight a half moon (`moonPhase` 0.52; at 0.35 a crescent); the sled
  lantern's pool held within 0.6 to 1.5 m of the sled's height on the walls (up to 2.6 m it lay up the wall behind a
  wall-riding sled as a warm smear); no shafts at the outrun once the sun is behind the ridge (they fanned across the snow
  and the rider); a glint on the track's ice a point, never a four-point star.
- From the fourth pass, its rider's frost scratches half as strong on the Old Run's ice (`trails.ts` `uScratch` 0.5; they
  ran down the near wall as bright parallel streaks with kinks). Seen fainter in p3; the fifth critic did not name them.
- **A dotted mast in the sky over the Hotel Straights** (the fourth critic's c-q1, "drawn dotted on one side and solid on
  the other"). Not resolved. A thin vertical line of dashes stands in the sky over the valley from about 228 m (probe
  `oldrun-mast`, ghosts off, ridden through the spot for each variant). Hiding the scene's children 0 to 8 (the sky goes
  black) or 20 to 60 leaves it; hiding 9 to 19 all together takes it away. Probe `oldrun-mast2` hid those eleven in four
  groups (9; 10 and 11; 12 to 14, which holds the trees; 15 to 19): it stays in every one. So either two of them draw it,
  each alone enough, or the children's order differs between loads (the worlds' chunks arrive when they arrive). My guess,
  not tested: something under a pixel wide (a pole or a cable seen end-on far off), which rasterizes as dashes and
  flickers between frames. Left to the main lane with the two probes' sheets (`probe/oldrun-mast*/sheet.png`).

### Gullhaven

- **Pale upright marks on the sea under the Great Geo and on the title (posts).** Cause: its sea stacks. They are the
  cliff's dark rock, 80 to 180 m tall, a thousand metres under the run, and the scene's fog (the distance's, and the air
  lying thicker below the course's floor) took them to the sky's pale air, while the sea plane round them keeps its own
  dark (SEA_GLSL draws its own haze). Probe `gull-marks`: `nostacks` takes the posts away; the spindrift's motes are the
  smaller white flecks. Fix: a `deepClear` option on the toon material (a `DEEP_CLEAR` define in LIGHT_GLSL's `fogged`,
  compiled only by Gullhaven's rock material): what stands far under the floor keeps the sea's clear air out to a few
  kilometres. Seen: dark rock stacks with their surf rings (crops/`p1-gull-*`, legends/v1 `crop-air`); the fourth critic
  picked the new side in both pairs ("the stacks in the sea read as the cliff's dark rock. A's are chalk-white pegs").
- **The far coast's pale streaks (the frosted cake with icicle teeth).** Cause: the panorama's coast (`massif.ts`; probe
  `gull-coast`: `nomassif` takes the headland away, the mid-ground and the terrain do not). Far off its facets span a
  cliff from the moor's edge to the sea, gentle enough to take snow on their upper part, each lit on its own step: pale
  teeth hanging from the moor's edge and stripes on the face. The first fix (a band 110 to 135 m over the sea) missed:
  the moor's edge stands far higher than that ahead of the run, and the fourth critic still saw ice shelves with icicles.
  Second fix: the face is told by its vertices (a varying `vFace`, set in VERT's coast branch for the coast's first 90 m
  inland), and there the snow is cut and the light is one value, so the moor's snow ends along a line between vertices,
  not at a facet's edge. On every other panorama `vFace` is 0 and nothing changes. Seen in p2.
- **Soft figure-like shadows on the snow.** Cause: the snow's own ripple troughs (`materials.ts`, "Periwinkle settles in
  the ripple troughs"): under Gullhaven's low sun their lobes lie across the shelves as soft blue figures. Probe
  `gull-shadows` (no caster's `castShadow`, the relief's shadows or the far shadow field took them away) and
  `gull-shadows2` (the troughs term draws exactly those lobes). Fix: where `uSnowBands` is under 1 (Gullhaven alone) the
  troughs are half as deep (a third, at p1, and the fourth critic then preferred the old frames' "long blue shadows" of
  the fence, which were these lobes: so half), and its shelf's dune bands at 0.3 (at 0.5 the critic still saw even wavy
  bands from the air).
- **Its legends the marquee's stand-ins.** Worse than that: the Herring Lights share Pinecrest's legend key `fleet`, so
  `legendworld.ts` staged Pinecrest's Lantern Fleet at the Geos, lanterns rising from a lake that is not there; the
  Beacon Keeper was the marquee's orbs. Fix: `src/render/gullhavenlegends.ts` (in the world's on-demand chunk): the keeper
  a pale figure of light in an oilskin and sou'wester, twice a man's height, walking the legend's line ahead of the rider
  with his lamp held out and its pool on the snow (a legend's size: at a man's, where the sim's runner keeps him tens of
  metres ahead, he could not be seen); the fleet sixteen boats (Low eight) strung along the coast far below the Geos, each
  a dark hull with a lamp at its masthead and the lamp's light lying on the swell, sailing on down the coast, lit as the
  legend is said, full while it plays, going on after. `legendworld.ts` and `marqueeworld.ts` leave both to the world on
  Gullhaven (its kit id). Shot staged (`?legend=1`, `2`) in `legends/v3` and `legends/p2`; seen by me, and by the fifth
  pass as single frames.
- From the fourth pass: halos on the two pier-head lamps at the line, lit as the harbour's lamps are (a lamp's glass a
  metre across read as a pale tower with no light at the line).
- From the sixth pass (its last commit, 6b99145): the keeper walks 7 m beside his line (from the chase lens at 4.5 m he
  still stood over the rider's head, as the sixth critic saw), and his lamp's pool is soft from its heart outward (a plain
  square of light read as a hard quad). `legends/v4/`: he stands on the lip ahead, right of the rider, the lamp's glow at
  his hand, clear of the hat. Seen by me only.
- After the sixth pass, the fleet's lamps "joined by a wire-like line rather than a dotted line of motes": the wakes
  (probe `gull-fleet-wire`, from the air: the lamps' light on the swell off leaves the lines, the wakes off takes them
  away). Each wake was 52 m long and a column's boats sail 68 m apart, so each reached nearly to the boat astern. Fix
  (`gullhavenlegends.ts`, its own module): a wake 24 m long, 3 to 27 m behind the hull, a little wider. From the air
  the column is now lamps each with a short tick of wake (`probe/gull-fleet-wire/sheet-before-after.png`). Seen by me
  only.

### Gablefall

- **The far hills reading as peaks in the haze.** Cause: Gablefall's panorama was the Old Run's `hills`, whose ridges
  stand up to a few hundred metres over the lens; behind the snowfall's flat valley they read as peaks (probe `gable`:
  `nomassif` takes them away, the valley's far side does not). Fix: its own `vale` (`massif.ts` RANGE 0.06, 0.38, 3.2,
  0.08: low, rounded, the finer octaves faint), `palette.ts` and the two render tests that named `hills` for it. The sixth
  critic picked the new side in all four pairs that showed the horizon ("low hills, as Gablefall asks").
- **The nave reading as a snowfield more than a church's roof.** Fix: the nave's pinnacles stand 2.6 m over its snow (1 m
  before), a moulded cap and a pale point, the bunting swagged from them higher. Seen in a-opening; the critic picked the
  new opening (for its hills; it also called the pinnacles pale). Not traced further: the sim's nave is a 12 m flat deck,
  so the roof's fall is out of sight from the lens whatever is drawn past it.
- **A dotted seam at the nave's brink.** Not resolved. Traced: not the snow's glints (`uSparkle` off leaves it), not the
  town's near or far rows, the valley, the church, the market or the set pieces alone (each hidden in turn, probe
  `gable8`); a row of short regular dashes about 44 m out, present only in some frames, fainter at p1. Most likely the
  terrain's sliver at a long grazing edge, as the world builder thought. No critic named it in the sixth pass.
- **The near snowflakes as smudges at the lens.** Cause: the snowfall's near layer, flakes a step darker than Gablefall's
  pale snow-cloud sky (so smudges on the glass against it) and soft discs against the dark walls. Fix (`particles.ts
  Weather.configure`, `world.ts applyWeather`, Gablefall only): a third as many in the near layer, and no flake darker than
  the air behind it. Fewer smudges in p1; no critic named them in the sixth pass.
- **A streak on the river's ice.** Cause: the ice's anisotropic sun sheen (`materials.ts`, the ice branch): probe `gable7`,
  `d29` takes it away (the gold path, the mirror, the wind's tongues and the spindrift do not; nor do the climax's beams or
  the fireworks, probe `gable6`). Fix: under STREET (Gablefall's terrain alone) the sheen is 0.12 of itself: under a snow
  cloud the sun is a pale coin. Gone in g-finish and i-alt-finish; the sixth critic still saw rays and "a long straight
  bright band" on the near ice at the finish on both sides (see what is left).
- **The fronts orange at Evensong.** Cause: the sled's lantern (`materials.ts lanternLight`, every prop within 34 m of the
  sled): at Evensong `lanternGlow` 0.8, and in a street six metres across that lit both rows of fronts peach. Found the
  long way: the toon shader's terms drawn one at a time (`gable4`, `gable5`) showed the walls cool after the light and
  peach before the fog, then the lantern. Fix: `lanternGlow` 0.28 in Gablefall's Evensong row; and the door and gate lamps'
  light laid low and out in the street (`LAMP_AT`: 1.6 m out, 1.1 m up, reach 8), a little less orange (`#FFDCB4`), so it
  pools on the snow before the door. The sixth critic picked the new Evensong street ("the walls keep a night value, so the
  lit windows read as the light"). From the same pass: Evensong's cloud over the whole sky (deck 0.86).
- **The quay's folk as boxes.** Cause: still figures (`crowd.ts stillCrowd`, built for far rows) a few metres from a lens
  on the ice. Fix, twice: first stood 2.4 to 5 m back so the quay's lip took them to the shoulders, which the sixth critic
  read as an empty quay (it picked the old side for both finish pairs, liking "a baked crowd with flags up"); then 1.4 to
  3 m back, half as many, so the lens sees them from the waist. Seen by me only.
- **The far town's speckle.** Cause: the valley's far side's windows glowing all afternoon (`uGlowK` 0.45 to 0.85 by day)
  and its faces two steps apart. Fix: the windows a breath by day and points of light from dusk; the faces a step apart.
- **The set pieces' props, seen by no critic**: b-roofrun (the Roof Run's lanterns), d-market (Market Day's awnings),
  f-washing (the washing lines) went to the sixth critic in pairs: picked for the new side in two of three, the third
  (f-washing) on the scarf's shape. It named no fault in the props.

### What only scripts have seen, and the five's frames

Every shared-path change reduces to the five's own on the five, by construction: a define only a new world's material
compiles (`DEEP_CLEAR`, `TRACK`, `STREET`), a uniform at the five's value (`uSnowBands` 1 behind an `if`, the weather's near
share 1 and paleness 0, the ghost trails' thinning 25, 80, 0.5 as the constants were), a varying that is 0 off the coast
(`vFace`), a branch on a course's kit id. As frames: Pinecrest and Ember on High and Low at 620 m and 1500 m, shot on the
base (git stash) twice and on this build (`five/`, `sheet-base-vs-mine.png`): the PSNR between this build and the base
(16.7 to 23.2 dB) sits inside the spread between two shots of the base itself (16.7 to 22.7 dB): a staged frame's own
noise (the lens's settling, the snow, the particles) is larger than anything the lane could have changed, and none shows.
The rider's scratches (`uScratch` 1 on the five, as the constant was) were shot apart, on Pinecrest's Mirror Lake ice
(the only place the five's sleds scratch ice), base and this build: PSNR 21.1 and 21.5 dB, inside the same capture
noise (`five/sheet-ice-base-vs-mine.png`).

The title reels: the three new mountains bare at 4 and 8 s, and Gullhaven's with its title and menu
(`title/p3/sheet.png`); the console clean in all four. On Gullhaven's title the stacks stand dark on the sea with their
surf: the pale posts are gone; the pale marks left on the water slant with the snowfall (the flakes). Seen by me only.

What only scripts and I have seen (no critic): the keeper's last change and the fleet's shorter wakes (above), Gablefall's quay folk brought forward
and Evensong's cloud (the sixth pass judged the frames before them), the titles, Low's counts (section 4). Every frame is
staged; nobody has ridden any of it by hand, on a desk or a phone.

## 2. The critic passes

Each pass: a fresh critic (a general-purpose subagent, Opus at extra effort) given only ART.md and the blind pairs of the
last pass's frames against this one's (`look-pairs.mjs`: the new frame on a seeded side, the key outside the folder), told
to pick the frame that better meets ART.md and list the faults worst first, read nothing else and run nothing. Picks and
keys: `shots/r9/look/keys/`. The passes number on from the world lanes' (the Old Run had two, Gullhaven three, Gablefall
five).

### The Old Run's third pass (`crit-k1`, p0 against p1, 12 pairs): the new side in 10 of 12

- The six pairs where the pale band had been (b-bell, c-q1, d-q2, f-q3, g-hook, l-low-q2), the new side in all six: "one
  side has a long pale band on the bobsled wall and the other does not". Lost: j-alt-q2 (Lamplight; the scarf's shape, a
  weak pick) and h-finish (the bank's snow toward sand, weak). The other four the critic called close to identical.
- Faults, worst first (both sides unless said): the band (old side only); a warm smear up the wall behind the sled by
  Lamplight (the lantern's pool: fixed); rays fanning over the outrun's snow and the rider (the outrun's shafts: fixed);
  Low bleaching the hero (the rider's, not the world's); the track not reading as ice, "matte lavender snow" (the plain
  ice a step more of a mirror and its body clearer: p2); the ghosts' sleds as bright opaque discs and their runner lines
  as ruler lines (the ghosts'); the charm gates' medallions behind the rider's head (the gate's place is the sim's, 397);
  the rider's own runner scratches as bright ruler lines on the wall; spray over the rider; a crescent moon for a half
  (fixed); a dark slab on the left bank by Lamplight (not traced); a thin dotted vertical line in the sky (not traced:
  most likely a far village's chimney smoke); a four-point star glint on a wall (fixed); an orange pool under the sled by
  Lamplight (the lantern's pool, lower now); a crossbar with bunting over the line read as an arch (the climax's beams and
  its last lantern string over the run, shared: not changed).

### Gullhaven's fourth pass (`crit-k2`, p0 against p1, 11 pairs): the new side in 6 of 11

- Won: d-air and k-low-air (the stacks "read as the cliff's dark rock", where the old were "chalk-white pegs"), and four
  others on small differences. Lost: b-lighthouse and h-alt-light (the old frames' "long blue shadows" of the fence and
  pennants across the run, which were the trough lobes the brief calls figure-like shadows: halved now, not a third),
  g-finish ("blue mottling" on the new snow at the right), i-alt-finish (flatter), j-low-opening (the lens: the p1 Low
  capture began with the lens close behind the rider, a capture's difference, not the world's).
- Faults, worst first: the Low lens crowding the rider (capture); the far cliffs as ice shelves with icicles on both
  sides (the panorama's coast: the first fix missed, refixed by its vertices); the lip and the shelf's edge as flat slabs
  with ruler edges (not changed); the sea as haze toward the sun at the opening and the lighthouse (the low sun's glare:
  not changed); the ghosts' ruts as straight lines (the ghosts'); speed blur reaching the middle (the lens's); even wavy
  bands on the shelf from the air (the dunes: lower now); the harbour's lights dead at the line (halos on the pier-head
  lamps now); the fence dark against the low sun and tan at night (not changed: a light of its own read as lit from
  nowhere in the world lane's second pass); a shed as a bare box; a repeating pattern on the far clifftop.

### Gablefall's sixth pass (`crit-k3`, p0 against p1, 11 pairs): the new side in 7 of 11

- Won: every pair showing the horizon (a-opening, b-roofrun, c-roof, j-low-roof: "low, rounded hills, as Gablefall asks"),
  the Evensong street ("the walls keep a night value, so the lit windows read as the light"), k-low-street and d-market
  (Market Day's awnings: the lens stood clear over the street). Lost: e-street (the lens low and close, a capture's difference), f-washing (the
  scarf's shape, the weakest pick), g-finish and i-alt-finish (the quay empty: its folk stood back behind the lip; a step
  forward again now).
- Its set pieces' props (b-roofrun, d-market, f-washing): no fault named in any of them.
- Faults, worst first: the low lens and an oversized rider in two captures (capture); peaks on the old side's horizon
  (fixed); the rider's coat royal blue (the rider's); shafts and a straight pale band on the near ice at the finish (the
  sheen is gone; what is left is the rider's own runner groove and the climax's light, not traced further); Evensong
  "broken cloud with clear gaps", some dark windows, no pools (the cloud closed; the pools laid in the street); chimneys
  as plain blocks, the near gable walls flat with one window, the quay houses' windows blank (the world's dressing: not
  changed); no contact shadow and no grooves under the sled in two frames (the rider's); hard straight stripes on the nave
  converging like speed lines (the pinnacles' and the rider's long shadows under the low sun: not changed); regular
  diagonal bands on the river's left bank (not traced); the ice reading as lilac snow; no townsfolk seen on the bridge.

### The Old Run's fourth pass (`crit-k4`, p1 against p2, 12 pairs): the new side in 5 of 12

- p2 carried a stronger mirror on the plain ice (0.42 from 0.32, the body a step bluer) for the third critic's "matte
  lavender snow". It lost: b-bell ("a warm pink-gold streak high on the left wall ... B's streak is smaller": the sun's
  gold path, which iceM scales, grew with it) and f-q3 ("regular pale diagonal bands on the right wall": the sun's sheen
  on more mirror), and the critic still found the track snow on both sides. Taken back after the pass; the track's ice
  is where the world builder left it and is said below as still short.
- The other losses were captures: a ghost's name pill over the rider's hat (a-opening, i-alt-opening, k-low-opening: a
  ghost's place on the frame's clock), the scarf's shape (d-q2) and the dotted mast in the sky (c-q1, drawn dotted on one
  side and solid on the other). Won: the Lamplight frame without the four-point star (j-alt-q2), the outrun, the hook,
  e-split's wall with fewer streaks.
- Faults, worst first (both sides unless said): name pills over the hat (the HUD's); the ghost straight ahead as a
  mint fin out of the pom (the lens and the ghosts'); the ghosts' runner lines as long straight lines (shorter now; still
  the ghosts' look); shafts fanning over the outrun's snow and the rider (still: not the grade's shafts, which are 0 there
  now; the radial streaks are the lens's speed blur over the bright snow toward the low sun, the lens's, not changed);
  bright parallel white streaks with kinks on the near wall (the rider's own frost scratches on the ice: half as strong on
  the Old Run now, `trails.ts` uScratch); spray over the rider (the rider's); the ghosts' glass discs (the ghosts'); the
  track reading as snow (above); a warm streak on the wall (the gold path, as above); the four-point star (the old side);
  patterned walls and a crazy-paved floor in f-q3 (the slush's lumps and the plates' borders: not changed); the sled
  bleached on Low (the rider's); lens-dirt flakes (the weather's near layer on the Old Run: not changed); the dotted mast
  (traced, not resolved: section 1); the moon gibbous on one side and a crescent on the other (now 0.52); hotel shutters brown.

### Gullhaven's fifth pass (`crit-k5`, p1 against p2, 11 pairs, and its legends as single frames): the new side in 7 of 11

- Won: d-air and k-low-air ("B lays regular, evenly spaced bands across the shelf": the old side, so the lower bands
  read), the lighthouse, the shore road, the finish, both Moonrise frames. Lost: a-opening and j-low-opening (a ghost
  out of the frame and the Low lens: captures), c-lip ("the shelf at the lip reads flatter and less like a raised box" on
  the old side), e-shelf (the scarf).
- The legends, as singles: the keeper's three frames read as "a marigold orb and a white cross shape sit right on the
  pom" (he walked the legend's line itself, so from the chase lens he stood on the rider's hat: he walks 4.5 m to its
  side now); the fleet over the sea "fails as a spectacle ... small marigold dots scattered over the sea at random, with
  no form" (they come home in two columns now, boat behind boat at a steady spacing, each with a pale wake astern).
- Faults, worst first: the sea cliffs still pale lilac ice slabs with a comb of teeth along the brow (the vertex fix cut
  the face's snow, but the teeth are the moor's edge itself, zigzagging where the panorama's columns cross the coast: the
  cliff's rock now runs 240 m inland over the brow, so the zigzag is rock on rock, and the face is darker, 0.14 from
  0.34); the shelf and the gully lip as a box or a knife edge (not changed); the hero crowded by a ghost and a charm chip
  in 10-B (the ghosts' and the HUD's); straight ruts down the fall line (the ghosts' and the rider's); the sea as haze
  toward the sun at the Cape (not changed); stepped grey blocks on the bank (the moor's dry-stone walls under snow lids:
  not changed, against ART.md 3's "nothing is a prism under a white lid"); the harbour's windows dark at the line (the
  pier-head halos are in p2; the sheds' windows not changed); lens dirt (the near flakes); the fleet as specks (above);
  the finish spectacle thin (the climax's); the landing ring at the rider's waist (the game's); the fence orange at
  Moonrise and no beam (the fence's timber in the moon and the sheds' lamps: not changed; the beam turns at dusk and
  night only, and the frame caught it pointed away).

### The Old Run's fifth pass (`crit-k6`, p2 against p3, 12 pairs): the new side in 9 of 12

- Won: the opening (no pill on the hat), b-bell, c-q1 ("A has a thin vertical line hanging in the sky ... B is clean"),
  f-q3, the outrun, both Lamplight frames, both Low frames. Lost: d-q2 ("two long white lens slashes" and a dark blot: the
  near flakes), e-split (the scarf over the coat as a red mass, a chevron of white streaks: the rider's and its runner
  scratches), g-hook (a scratch and a white blob: the near flakes). Close calls by its own account: 02, 07, 08, 10, 12.
- Faults, worst first: name pills on the hat (the HUD's); the hero's vermillion damaged by spray and the scarf (the
  rider's); **the track still not reading as ice** (both sides, every bend: the one world fault every Old Run pass has
  named; tried once, taken back, and left for the main lane, below); the ghosts' runner lines as straight mint stripes
  (shorter, still the ghosts'); the sled's runner scratches as bright straight lines on the walls (half as strong now,
  still named); the radial streaks over the outrun's snow (the lens's blur); a rose-warm smear high on the outside wall
  in b-bell (the sun's gold path on the glaze, both sides: not changed) and an orange streak up the wall by Lamplight
  (both sides, smaller than at p1); Low's sled bleached (the rider's); a ghost's dark body on Low (the ghosts'); lens
  scratches (the near flakes); the thin line in the sky (traced below); crazy-paved floor cells (the ice's plates); a
  firework as a ringed planet (the climax's); the moon "nearly full" (0.52: the third critic saw a crescent at 0.35, the
  fifth a full moon at 0.52: the disc's bite never makes a half; left at 0.52); medallions and pills at the vanishing
  point (the gates' and the HUD's).

### Gullhaven's sixth pass, one beyond the five (`crit-k7`, p2 against p3, and the legends as singles): 6 of 11

- Run because the two worst Gullhaven faults left after the fifth pass (the far cliffs, the legends) were changed after
  it. Won: the opening, the lighthouse, the lip (the fence and pennant at the lip), **d-air ("the far headland's face is
  dark slate ... In A it is hung with a white icicle fringe that reads as an ice shelf")**, the finish and the Moonrise
  light. Lost: e-shelf (the pom), f-shore (the lens), i-alt-finish (a gold ring at the hips: the landing ring), both Low
  frames (the grade: "the picture goes grey" on Low, both sides, and the lens).
- The legends: the keeper still "a small pale figure with a gold glow on the centre line just above the rider's head",
  "a smudge, not a spectacle", his pool "a hard pale rectangle" (it was a plain square of light: a soft pool now, and he
  walks 7 m to the side; seen by me only, `legends/v4`); the fleet "a trail of marigold lights strung out over the sea.
  The intent is right", but "joined by a wire-like line rather than a dotted line of motes" (the wakes: shorter now, section 1) and the sea reading a few
  metres down from the air, the shelf ending in a thin white edge with no cliff under it.
- Faults, worst first: no cliff at the sea's edge from the air over the Great Geo (the run's own cliff under the fence is
  out of sight from a lens over the shelf; the stacks are now dark, so the sea's depth rests on them and the swell: not
  changed); a gold ring round the rider (the landing aid's); Low gone grey (both sides); a ghost in the sky (the ghosts');
  the pom; the rider over the road (the lens); ruts as stripes (the ghosts'); the sea as haze toward the sun; untextured
  sheds and dry-stone walls as "stacked concrete bleachers"; the gully lip a flat plate; the keeper; the coat; the fence
  tan at night; "craggy mountain peaks on the moor side" (the coast panorama's moor ridges: not changed); regular bands on
  the shelf from the air (fainter); the far headland as ice in 04-A, 05-B and 11 (the old side and two frames still);
  a pole as a silhouette; speed smear; hard shadows.

## 3. The sort across all eight

`look-sort.mjs`: the five's stills (`shots/r9/measure/stills/gray/` and `colour/`: each one's opening, three places and its
finish) and each new mountain's opening, three places and finish from p3, 40 frames shuffled under neutral names in a
folder named for nothing (`shots/r9/sort-k8/` greyscale, `sort-k9/` colour), ART.md beside them, the keys outside
(`look/keys/k8-sort-gray.json`, `k9-sort-colour.json`). One fresh critic each, told only that the frames came five from
each course.

- **Greyscale: eight sets, 40 of 40 frames placed right.** Most unlike the rest, in its order: the Old Run ("the ground
  has a different shape: a curved channel wall dominates and tilts the horizon"), Gablefall ("straight-edged buildings:
  roofs, streets and a viaduct, with no mountain and no pines"), Gullhaven ("a flat sea horizon and a sheer cliff edge,
  and no trees"); "None of these three has the shared finish of the other five". It confused only the five among
  themselves: the shared-template finishes (Pinecrest's and Frostfang's by day, Lanternfall's and Ember's by night, "my
  least certain calls"), Lanternfall's fog canyon against Frostfang's slots, its moonlit Crown against Frostfang and
  Pinecrest, Frostfang's cavern against Ember's tunnel.
- **Colour: eight sets, 40 of 40.** Most unlike: Gablefall ("its ground is roofs and streets, everything is
  rectilinear, there is no mountain"), the Old Run ("the only enclosed channel"), Gullhaven ("split by a sea horizon
  and a cliff edge"); "The five original mountains share one template". Hardest: Pinecrest's and Frostfang's finishes
  ("the same square"), Lanternfall's Crown and its Cloud Sea, Frostfang's ice arch against Pinecrest's day.
- So the three new mountains sort apart from the five and from each other with and without colour, and neither critic
  confused one with another or with any of the five; the only confusions are among the five's shared finishes.

## 4. Low: GL calls and draws on a held Low run, against Pinecrest on the same stretches

`scripts/r9/look-glcount.mjs` runs the Gablefall world's counter (`scripts/r9/gablefall-world-glcount.js`, glcount.js's:
every WebGL call of a frame counted; never frames a second) in the lane's browser, one stretch at a time: `tier=low`, the
`mid-100` save, the sled held on a line at 30 m/s from z0 (the middle; Gablefall's street; Pinecrest's safe line), 8 s let
go by, then 10 s counted (about 600 frames; the counted window starts some 240 m past z0). Triangles are summed from the
draw calls themselves; programs are the page's so far. The set pieces are the sim's own on the registered course, read
from `run.sim.plays` on Low: the Old Run's Bend Bells 171 to 879 m, the Labyrinth 1,149 to 1,861, the Horseshoe 2,559 to
2,870 (the line at 3,000); Gullhaven's Lighthouse 551 to 718, the Great Geo 2,174 to 2,424, the Sea Stacks 4,030 to
4,510; Gablefall's Roof Run 240 to 830, Market Day 1,080 to 1,450, the Washing Lines 2,060 to 2,460. The legends were
left to the roll, not forced. Readings: `shots/r9/look/gl/now.json`, `p1100.json`, `pieces.json`.

| Stretch (sim m, counted) | The mountain: calls, draws, triangles (programs) | Pinecrest, same window | Calls |
| --- | --- | --- | --- |
| Old Run, the Bend Bells, 391 to 691 | 386.0, 40.8, 224,721 (75) | 428.4, 44.0, 143,688 (75) | 9.9% under |
| Old Run, the Labyrinth, 1,491 to 1,791 | 387.9, 41.8, 225,991 (69) | 415.8, 43.4, 111,534 (71) | 6.7% under |
| Old Run, the Horseshoe, 2,591 to 2,892 | 402.0, 44.4, 223,386 (70) | 382.5, 41.0, 116,652 (69) | 5.1% over |
| Old Run, the hook's end and the line, 2,790 to 3,073 | 427.0, 44.6, 218,960 (70) | 393.1, 42.9, 108,337 (69) | 8.6% over |
| Gullhaven, the Lighthouse, 570 to 870 | 454.8, 47.6, 177,079 (77) | 367.6, 39.6, 152,765 (69) | 23.7% over |
| Gullhaven, past the Lighthouse, 784 to 1,084 | 431.4, 45.4, 176,815 (83) | 393.9, 41.3, 157,128 (69) | 9.5% over |
| Gullhaven, the Great Geo, 2,201 to 2,501 | 439.2, 46.0, 175,679 (77) | 390.1, 41.6, 154,337 (71) | 12.6% over |
| Gullhaven, the Geo's end, 2,340 to 2,641 | 436.8, 45.5, 175,975 (77) | 382.0, 40.7, 150,229 (71) | 14.3% over |
| Gullhaven, the Sea Stacks, 4,191 to 4,490 | 469.6, 47.2, 82,936 (78) | 410.0, 41.5, 138,834 (69) | 14.5% over |
| Gablefall, the Roof Run, 484 to 784 | 369.5, 40.4, 77,709 (72) | 379.8, 40.3, 148,163 (69) | 2.7% under |
| Gablefall, Market Day, 1,140 to 1,441 | 368.8, 40.5, 89,270 (72) | 418.9, 43.5, 112,610 (71) | 12.0% under |
| Gablefall, Market Day's end, 1,340 to 1,641 | 362.7, 39.8, 83,984 (72) | 425.2, 43.6, 104,177 (71) | 14.7% under |
| Gablefall, the Washing Lines, 2,140 to 2,440 | 369.6, 41.5, 86,709 (72) | 398.1, 42.1, 152,295 (71) | 7.2% under |
| Gablefall, the Lines' end, 2,321 to 2,622 | 360.7, 39.3, 73,715 (72) | 387.4, 41.4, 153,556 (71) | 6.9% under |

(Pinecrest's 1,100 window was counted twice: the first ran short, 316 frames to 1,504 m while the machine was slow,
429.4 calls; the table has the second, a full window. The first set's windows met some set pieces only in part, so a
second set, `--set pieces`, centred a window on each one's span.)

- **The Old Run**: 5 to 10% under Pinecrest on the Bells and the Labyrinth, 5 to 9% over at the Horseshoe and the line
  (not traced which of what is in reach there), 1 to 4 draws either way. Its triangles are 1.5 to 2 times Pinecrest's on Low (219k
  to 226k against 108k to 153k; not traced, the world builder's Low as built).
- **Gullhaven**: over Pinecrest on every stretch, 9.5 to 23.7% in calls and 4 to 8 draws; the most at the Lighthouse
  (454.8 calls, 47.6 draws, 77 programs against 69; within reach there, by the world notes' account, the set
  piece's paint, pools, shaft and lamps: not traced further). Its world notes counted 5 to 24% over before the set pieces were added; with them live it is the same
  band. More programs and a few more draws, so more `uniform*` and `useProgram` calls each frame: the sea plane, the
  surf, the spindrift and the coast's own programs (the world notes' account), the pieces on top.
- **Gablefall**: under Pinecrest on every stretch, 2.7 to 14.7% in calls, at about half its triangles: its world notes'
  8 to 24% under holds with the set pieces live.
- Both builds' numbers have risen since the world notes (Pinecrest counted 351.9 and 353.0 at 533 to 841 m then, 379.8
  to 393.9 near there now, on this branch's base), so only counts on one build compare.
- The lane's own changes add no draw on the five or the Old Run and Gablefall (shader terms, uniforms set once a course);
  on Gullhaven the legends add their draws only once one is said (the fleet sails on after; the counts left the
  legends to the roll), and the pier-head halos one instanced draw near the line.

## 5. Every hunk in a shared file

None of the files the brief calls shared (`app.ts`, `save.ts`, `spineview.ts`, `src/ui/contract.ts`, `ui.ts`) was touched,
nor `src/sim`, `src/bot`, `src/data/ghosts`, `src/ui` or the title reel's camera. Render files the five also draw through:

- `src/render/materials.ts`: `fogged()` gains a `#ifdef DEEP_CLEAR` block (compiled only by a toon material made with the
  new `deepClear` option, Gullhaven's rock); `ToonOptions.deepClear` and its define; the troughs halved `if (uSnowBands <
  1.0)` (Gullhaven alone) and `uSnowBands` 0.3 on Gullhaven in `applyPalette` (0.5 before; 1 everywhere else as before);
  under `#ifdef TRACK` (the Old Run's terrain alone) the scribe sized on screen and faded at the lens, the lantern's pool
  held to the sled's height on the walls, the glints' rays off on the ice; under `#ifdef STREET` (Gablefall's terrain
  alone) the ice's sun sheen at 0.12.
- `src/render/massif.ts`: `HeroPeak 'vale'` in the four records (PEAK_ID, HERO_REACH, RANGE, SUMMIT_Y); a varying `vFace`
  (0 off the coast branch) and, in FRAG, `cliffK` (0.0 unless `uCoast`) cutting the coast's cliff snow and light.
- `src/render/palette.ts`: `HeroPeak` gains `'vale'`; Gablefall's `biomeBase` takes it; the Old Run's other hour's
  `moonPhase` 0.52; the Old Run's outrun journey row `grade.shafts` 0; Gablefall's Evensong `lanternGlow` 0.28 and its
  deck `k` 0.86.
- `src/render/particles.ts` (`Weather`): `uPale` (0 by default) and `nearK` (1 by default) from two optional `configure`
  fields; `follow` scales the tier's near share by `nearK`.
- `src/render/world.ts` (`applyWeather`): Gablefall's snowfall passes `near: 0.35, pale: 1`.
- `src/render/trails.ts`: `GhostTrails` `uThin` (25, 80, 0.5 as the constants were; 16, 55, 0 on the Old Run) set in
  `setCourse`, now also called from the constructor; the rider's `Trail` `uScratch` (1; 0.5 on the Old Run) in `setCourse`.
- `src/render/legendworld.ts`: `update` returns for the key `fleet` on Gullhaven's kit. `src/render/marqueeworld.ts`: no
  stand-ins for `keeper` and `fleet` on Gullhaven's kit.
- The new worlds' own files: `gablefallworld.ts` (pinnacles, `LAMP_AT`, lamp colour, quay folk, the valley's windows
  and faces), `gullhavenworld.ts` (`deepClear` rock, the legends' module, the pier-head halos), new `gullhavenlegends.ts`.
- Tests: `tests/compose.test.ts` and `tests/overlook.test.ts` name Gablefall's panorama `vale` (they named `hills`).

The five's frames: see section 1's last part (Pinecrest and Ember at 620 and 1500 m, High and Low, base twice and this
build; Pinecrest on Mirror Lake's ice for the rider's scratches, base and this build, PSNR 21.1 and 21.5 dB against a
capture noise of 16.7 to 22.7): nothing visible changed, and by construction nothing can.

## 6. For ART.md section 15 (the text I would add; the main lane owns the file)

Under **The Old Run**, after "The track.":
- **The glaze's edges** are a hairline on screen, a pixel or two wherever they are, gone within a few metres of the lens:
  measured in the wall's own shares, the hairline was 10 to 20 cm of ice at the lens and lay down the near wall in a wall
  ride as a pale band from the vanishing point to the frame's edge. A glint on the ice is a point, never a star; the
  sled's lantern lights the walls only near the sled's height; the ghosts' lights keep to the near track (a field of them
  down the same glaze ran on as straight lines to the vanishing point).

Under **Gullhaven**, after "The edge.":
- **The sea's air.** What stands in the sea far under the cliff (the stacks, the clefts' walls) keeps the sea's own clear
  air, so a stack is the cliff's dark rock on the dark water, never a pale post. The far coast's cliffs are bare rock in
  one value up over the moor's brow; the moor's snow begins inland of the brow. The snow's ripples lie half as deep as
  elsewhere (under the low sun their troughs lay on the shelves as figures).
- **Its legends.** The Beacon Keeper, a pale figure of light twice a man's height in an oilskin and sou'wester, walks the
  clifftop beside the legend's line ahead of the rider, his lamp held out and its pool soft on the snow. The Herring
  Lights: the harbour's boats coming home along the coast far below the Geos in two columns, a lamp at each masthead and
  its light lying on the swell, a pale wake astern.

Under **Gablefall**:
- In "What it is not": "low rounded hills in the snow" (its own panorama, never another mountain's ridges, which stood in
  its haze as peaks).
- In "The town": "the lamps' light pools on the snow before the doors"; in "Its other hour": "the sled's lantern low, so
  the street's fronts keep the night's value and the windows are the light; the snow cloud over the whole sky".
- "The near flakes few and never darker than the air behind them" (darker than its pale sky, they were smudges on the lens);
  "the river's ice holds no streak of the sun, which is a pale coin behind the cloud".

## 7. For DECISIONS (the text I would add; the main lane owns the file)

**The three new worlds' feel pass** (`r9-look`, 6305d33 to the last commit; `notes/r9-look.md`; frames under
`shots/r9/look/`).
- *The faults, traced:* the Old Run's pale band was the glaze's scribed edges at the lens (a hairline in the wall's shares,
  10 to 20 cm of ice); Gullhaven's posts on the sea were its stacks fogged to the sky's pale air a thousand metres down,
  its far coast's teeth the moor's edge zigzagging across the panorama's columns, its figure-like shadows the snow's own
  ripple troughs under the low sun, and its Herring Lights Pinecrest's Lantern Fleet (a shared key); Gablefall's peaks the
  Old Run's ridges in its haze, its orange fronts at Evensong the sled's lantern lighting everything within 34 m, its
  river's streak the ice's sun sheen, its smudges near flakes darker than its sky. Each fixed in its own world, look table,
  a define only it compiles, or its kit id; the five's frames unchanged.
- *The passes:* the Old Run's third, fourth and fifth (10 of 12, 5 of 12, 9 of 12 new), Gullhaven's fourth and fifth (6 of
  11, 7 of 11) and a sixth on what changed after (6 of 11), Gablefall's sixth (7 of 11). The losses were the lens, the
  pills and the scarf of the capture, two taken-back tries (a stronger ice mirror on the Old Run; Gablefall's quay folk set
  too far back) and Gullhaven's troughs at a third.
- *The sort:* greyscale and colour, eight sets of five, 40 of 40 each; the three new ones named most unlike the rest in
  both; the only confusions among the five's shared finishes.
- *Short:* the Old Run's track still reads as snow to every critic; Gullhaven's lip and shelf edge as slabs, its sea as
  haze toward the sun, its dry-stone walls as blocks under white lids; Gablefall's dotted seam at the nave's brink (not
  traced), the stripes of long shadows on the nave, its chimneys and gable ends plain; the keeper's last change and
  Gablefall's last two (the quay folk forward, Evensong's cloud) and the fleet's shorter wakes seen by no critic.
- *Low:* on a held Low run with the set pieces live, against Pinecrest on the same windows: the Old Run 10% under to 9%
  over (over at the Horseshoe and the line), Gullhaven 9.5 to 23.7% over (the most at the Lighthouse, 454.8 calls, 47.6
  draws), Gablefall 2.7 to 14.7% under. Counts only; the main lane times frames a second.

## 8. What the main lane must decide

1. **The Old Run's ice.** Every critic in every pass read the track as snow (matte lavender). A stronger mirror and a
   bluer body (p2) grew the sun's gold path and its sheen into streaks on the wall and lost; it was taken back, so the
   ice is the world builder's. Making the glaze read as ice is a design change (its own body, what it mirrors), not a
   fault's fix: take it on, or accept the track as it is.
2. **The lane's choices in shared render files**, each reducing to the five's own on the five (section 5): Gablefall's
   own `vale` panorama (a new `HeroPeak` in `massif.ts` and `palette.ts`; `compose.test.ts` and `overlook.test.ts` now
   expect `vale` for it); `DEEP_CLEAR` in `fogged()`; the troughs halved where `uSnowBands` is under 1, which the base
   already keys on `massif.seaOcean > 0` (Gullhaven alone today; a future sea mountain inherits both); the `TRACK` and
   `STREET` hunks; the weather's `near` and `pale`; the ghosts' trails' and the rider's scratches' per-course values.
3. **The text for ART.md 15 and DECISIONS** (sections 6 and 7): take, change or leave. Gullhaven's two legends as built
   (the keeper twice a man's height beside his line; the fleet homeward in two columns) are this lane's design inside
   the world's chunk: ART.md 15 says nothing of their look yet.
4. **What is short**, traced but not resolved: the Old Run's dotted mast in the sky (two probes, section 1) and the sun's
   warm gold path on the glaze; Gablefall's dotted seam at the nave's brink and the long shadow stripes on the nave, its
   chimneys and gable ends plain; Gullhaven's lip and shelf edge as flat slabs, its sea as haze toward the sun, its
   dry-stone walls as blocks under white lids, its Low grey. Outside the lane, named by critics: ghosts' name pills over
   the rider's hat (the HUD), the ghosts' runner lines and glass discs, the rider's spray and scarf, the outrun's radial
   streaks (the lens's speed blur over the bright snow).
5. **What no critic has seen**: the keeper's last change, the fleet's shorter wakes, Gablefall's quay folk brought forward and Evensong's cloud
   over the whole sky. A seventh pass on those, or accept them on my frames (`legends/v4`, `sets/p3/gablefall`).
6. **Low** (section 4): Gullhaven is over Pinecrest on every stretch (9.5 to 23.7% in calls, 4 to 8 draws, the most
   at the Lighthouse) and the Old Run over at the Horseshoe and the line (5 to 9%); whether either needs cutting is for
   the main lane's frames-a-second sittings to say.
7. **The port.** 5040 is held by Windows' Connected Devices Platform on this machine (svchost); this lane ran on 5044.
   `notes/r9-lanes.md` names 5040 for the look lane.
8. **The probes** in `scripts/r9/probes/` that set the removed `uLookDbg` switch are no-ops now, kept as the record of
   what was probed; keep or drop them.
