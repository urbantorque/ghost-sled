# Round 7, the fx lane: notes for the main lane to fold in

Branch `r7-fx`, cut from `round-7` at e503f1e. Render only: nothing in `src/sim` or `src/bot`, no collider
added, moved or resized, nothing that feeds back into a run. Frames are in the main checkout under
`shots/r7/fx/` (git-ignored). This file is kept up to date as the lane works; the last section says what is
not done.

## Decisions (numbered from F1; renumber as you fold them in)

F1. **Rock is laid down in beds, basalt stands in organ pipes, and neither is ever a prism** (`rockforms.ts`,
    commit fea28e5). The review's boxes were three things: a leap's shoulders (one 8-sided cylinder scaled
    to 8 by 7 by 17 m under a white lid), Ember's basalt (four fat hexagonal prisms under white lids, in the
    palette's browns) and the icosahedron boulders. Two builders replace them, both flat-shaded and
    vertex-coloured so they read under any material the light lane ships:
    `strata()` stacks beds, each its own thickness and value, each shifted a little off the one under it, so
    one side of a bed steps in (a ledge, with snow banked against the wall behind it) and the other juts out
    (an overhang, its soffit in the rock's darkest value); the beds dip; a drift is banked round the foot (the
    clean seam with the slope) and, where the builder knows the ground, the foot follows it a metre under
    the snow. `columns()` packs hexagonal columns, each broken off at its own height on its own slant, ash on
    the flatter tops, two values round every column so its joints read.
    What changed: a leap's shoulders (`places.ts lipPiece`: an outcrop in five beds with a slab of snow on
    top whose lip droops over the edge, a broken crown of rock behind the crowd, two blocks stepping down at
    the end the rider comes to, four boulders buttressing the foot; on Ember a palisade of broken columns
    with a lower rank of stubs in front); the run's rock and Ember's boulder (three beds, a ledge, a crown);
    Ember's basalt on the run (one tall column with six slim ones packed round it, graded round the ring);
    Ember's formations (`flora.ts`: the organ pipes are three ranks in a honeycomb, 27 columns, where there
    were 15 in two); its fallen columns (three drums broken where they hit); its gateway's columns
    (`landmarkKit.ts basaltPiece`); the chute's rock bands, the gully's walls, the bank boulders and Ember's
    bank stubs (`dressing.ts`). Basalt is near black and cold now (`flora.ts basaltTones`: the palette's own
    darks pulled toward `#15121B`), per ART.md 15.
    *A player would feel:* the edges of the First Drop are the mountain, and Ember's hazards are organ
    pipes, not crates. *Measured:* `tests/rockforms.test.ts` holds every bed inside its bounds for 59 seeds,
    every hazard's drawn form inside its collider on all four mountains (and filling at least 85% of its
    radius, so a sled is never stopped by clear air), walls facing out, and the triangle budgets. A rock and
    a basalt cluster are now stretched to their collider's own height (`props.ts`), where a rock used to be
    drawn up to 0.4 m taller or shorter than what the sim collides with.
    *Cost (High, the fixed frames, before and after):* Pinecrest 537 m 1,046,742 to 1,042,590 triangles (90
    calls both), 2429 m 989,552 to 983,336, 3940 m 934,596 to 928,621; Ember 450 m 705,207 to 713,813, 2271
    m 691,863 to 695,390, 3150 m 628,350 to 586,571. No draw call added. Per form (triangles, round 6 to now): the
    run's rock 60 to 91 (Low: 54, two beds and six corners), basalt 192 to 124, Ember's boulder 80 to 78
    (Low 54), a fallen column 108, an organ pipe 362 to 482, a cluster 104 to 126, a sentinel 92 to 94, the
    chute's rock band 180 to 273 and the gully's wall about 220 to 365 (Medium and High only: Low draws no
    dressing), a shoulder 224 to about 620 (Low about 250; two a leap).
    *Rejected:* a rock texture or a triplanar shader (the light lane owns the material, and a form that needs
    one is still a box in the fog); rebuilding `crag()` (it is also blossom canopies and ice arches); moving
    or resizing any collider to suit a nicer shape.

F2. **Ruts last the run** (`trails.ts`, commit ba5dfff). Round 6's groove aged out in 26 s and thinned to
    60% toward the lens; a ghost left two lines of light that were gone in 7 s. Now your own groove does not
    age (it settles 16% over its first seconds, wind softening its lips, and stays) and is at full strength
    to the bottom edge, with clods thrown out past the lip of a deep carve; and every ghost cuts real ruts
    (two runner cuts in the snow's own shade, a lit lip outside each) under its light, in the same strip and
    the same draw, which lie on the snow ahead until you ride over them. A rut is kept from 60 m behind the
    rider (the mirror, a wreck's orbit, the finish's swing and the reel look back) to the tier's range
    ahead. *Budgets* (`fxhub.ts BUDGET`): samples a ghost keeps 360 / 480 / 720 (Low, Medium, High), spaced
    0.9 / 0.75 / 0.6 m, drawn to 330 / 420 / 520 m ahead, every third sample past 70 / 110 / 140 m (the far
    rut is the shader's own pixel-wide line). Low's vertex count is round 6's. Only the samples added since
    the last flush are uploaded and the index goes up as 16-bit and only as far as it is used: round 6 sent
    every ghost's whole buffer every frame (69 KB a frame for eight ghosts, 72 KB for your own groove), so
    this is lighter on every tier. `tests/ruts.test.ts` holds the budgets, that a rut does not age, and
    that an airborne stretch leaves none.

F3. **Powder is lit by the key light** (`particles.ts`, commit ba5dfff). A billow's rim takes the key
    light's own colour and, backlit, burns past white (it is what the bloom picks out of a plume: gold at
    golden hour, lemon on Frostfang, orange under Ember's deck); one grain in ten is a crystal that glints,
    which ones changing as the spray moves; a hard carve or drift at speed adds a trailing body of soft lit
    lumps that keep 93% of the sled's pace and hang a sled's length behind the runner; a landing with weight
    leaves a few broad thin lumps hanging in the light; a big touchdown's wave gets a second act (a ring of
    heavier lumps rolling out behind the front, and a veil that climbs out of the crater and hangs for over
    a second). Low throws under half as many billows, so each is drawn 1.3 times fuller: a designed, sparser
    plume. No draw call, no new material: the same two point layers and their caps.
