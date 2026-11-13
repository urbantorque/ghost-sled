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

F4. **Trees live** (`treelife.ts`, `props.ts`, commit 5a74a53). Every foliage material is patched to bend in
    fronts of wind that cross the slope (about every twelve seconds, 150 m apart), each tree in its own
    phase, the lean growing with the square of the height (about 0.25 m at a pine's tip in a gust), bough
    ends bobbing by their reach from the trunk. A tree a rider shaves or passes within 2.5 m at 18 m/s or
    more shakes for a second and a half (a fast decaying tremble, the boughs dipping as the load goes), up
    to four at once. Ghosts shake theirs too (one ghost is looked at a frame), and a ghost's tree lets its
    snow go at the tree itself, down the run where you watch it. The player's own sift (world.ts's, thrown
    beside the lens) is 1.7 times bigger with fuller clumps. Sakura's blossom sheds petals when passed and
    all the time in the wind, Ember's charred pines shed ash, Pinecrest's boughs let a sift go now and then.
    Low bends only (no bob, no shiver: a define); reduced motion stills the wind, the base sway, the shiver
    and the ambient shedding and keeps the sheds. *Not moved:* Ember's wall (charred pines share a no-sway
    material with the basalt) and Frostfang's ice. The shadow pass does not sway (a tree's shadow stands
    still while its top moves 0.25 m).

F5. **Weather has volume** (`particles.ts Weather`, commit 5a74a53). One draw, as before, now in three depth
    layers: 6% of the flakes in a 12 m box right ahead of the lens (big, fast, strong parallax), the body
    in round 6's 60 by 34 by 70 m box, and a third in a box 2.2 by 1.6 by 2.5 times that, reaching on down
    the run (fine, slow on screen, never under 1.5 px: it thins instead). Gusts are sheets of displacement
    crossing the slope along the wind, bands of thicker air follow them (the density swings from half to
    one and a half times), and every flake takes the frame's light (the snow's lit colour, a trace of the
    key light's, a forward-scatter lift toward the sun; backlit blossom glows past its own pink and turns
    as it falls). Ember's air is 45% ash that falls on the wind and embers that rise, flicker and jitter, in
    the one draw (a premultiplied blend: ash lies over the picture, embers add to it). Low keeps the three
    layers with 20% in the far box and each flake 1.35 times larger. Reduced motion stills the gusts and
    the breathing and keeps the fall. *Not done:* spindrift off crests is still nearfield.ts's (the hero
    lane's file); the blizzard's fog does not breathe (the fog is the light lane's), only the fall does.

F6. **The world breaks** (`breaks.ts`, commit 4 of the lane). One pooled instanced draw of small faceted
    shards, visible only while something is broken (24 / 72 / 128 pieces on Low / Medium / High; a new break
    takes the oldest slots). A snowman bursts into lumps of snow, its carrot, coals and scarf; a scrape off
    a street's, bridge's or finish's barrier throws splinters, off a glacier's wall ice, anywhere else
    blocks of the bank's snow; ice shaved in a near miss throws glinting shards away from the rider; a
    gully's icicles drop ahead of a passing rider (Medium and High, where the walls that carry them are
    drawn; none under reduced motion); and while the collapse set piece's fall runs (`moments.ts fallZ`,
    read, never written), blocks of snow and ice break off the span's edges on top of marqueeworld's own
    chunks. Each piece tumbles, bounces once with a puff and shrinks away in about a second. Nothing is a
    collider and nothing reads back into the sim.

F7. **Spirit effects light the snow** (`spirit.ts`). The lane pushes local lights through `lights.ts`'s
    contract: a dash's own light on the rider while it lasts (radius 10 m) and a hard beat as it starts
    (16 m, 0.4 s); a ward's crack (15 m, 0.7 s); a sky gate's burst (18 m, 0.55 s) and a steady light under
    every gate within 110 m ahead; a lantern filling (9 m), a light taken (5.5 m, a great light 9 m), a
    lantern gate threaded (14 m). At most eight pulses are alive (a pool), each fading with the square of
    its life; reduced motion keeps them at 60%. The dash itself gains a ring of white-gold thrown out flat
    as the air opens with a marigold ring behind it, two lines of light laid on the snow off the runners
    that hold for most of a second (the wake), a marigold stream at scarf height that falls back slower
    (the tail), and a last ring as the sled is solid again.

F8. **Fireworks are layered, light the square, and a win ends on a finale** (`fireworks.ts`, `spirit.ts`).
    Inside a shell's break a smaller, slower heart opens in its second colour; a willow carries a crown of
    white-gold glitter; a ring has a second ring inside it turned the other way. Every burst offers a local
    light where it broke (150 m reach, a hard flash that falls away with the sixth power of its life, then
    a glow that fades with the stars; no flash under reduced motion): 1 / 2 / 3 at once on Low / Medium /
    High. A win's eight shells are followed by a finale of eleven in two seconds (willows low, peonies
    high, crackle, then one great ring with a crackling heart; Low sends up six of them). Sparks alive at
    once are capped at 420 / 900 / 1700 by tier. Colours unchanged: vermillion, coral, marigold,
    white-gold, never mint or rose.

F9. **The final read found the rock still built, not grown, and fixed it** (`rockforms.ts`, commits c7c065b,
    1401b2a). Shot at the round's fixed distances and read beside the baseline, F1's forms failed the
    owner's test in three ways. A leap's shoulder (Valley Leap at 3940 m and 2429 m, the First Drop at 537
    m) was five level courses, every joint a ruled line parallel to the top's edge, a white stripe of snow
    on each: stacked slabs, a grandstand of laid stone. Its crown behind the crowd and every rock's top
    were level (the "broken crown" put its rim at the peak's own height), so the crown read as stacked
    boxes. The run's rock was three rings with a stripe round each. And a basalt column was one unbroken
    face from snow to break. Now: a joint between two beds has a dip along the outcrop as well as across
    it (`dipZ`), wanders up and down round the rock (`warp`), pinches out against the bed over it and is
    cut off by a level top, so on a shoulder no joint is parallel to the top and the beds visibly run up
    out of the slope; each bed's corners stand in or out on their own (`jut`) and a long wall is cut into
    bays and buttresses (`bays`), so one joint is a ledge here, flush there and an overhang past it; a
    crown's rim is broken, every corner its own drop under the peak; snow lies only on a ledge wide
    enough to hold it (`lieMin`), which on a boulder is its lee side. A shoulder on Medium and High is six
    beds and eighteen corners (Low keeps three and eight). Basalt is cross-jointed into drums
    (`ColumnSpec.drums`, `ColumnsSpec.drum`): each drum over the first a little slimmer and turned off
    the one under it, the lower drum's break showing as a lip (the hot edge the light finds), its own dark
    foot over it. Drums are on the run's basalt, the cluster, the sentinel, a leap's palisade and the
    gateway's columns, on Medium and High only; Low's columns are whole. The organ pipes are not jointed
    (they are Low's one formation and have no cheaper build).
    *Measured:* `tests/rockforms.test.ts` gained three cases (a column in drums is 16 triangles a drum,
    faces out, stays inside its radius and height for 19 seeds; a long outcrop's corners stand on more
    than twenty heights where five level courses would give four, its top still level at `h`; a rock's
    rim stands under its peak). Triangles a form, F1 to now: the run's rock 91 (Low 54) unchanged, basalt
    124 to 156 (Low 124), a cluster 126 to 174, a sentinel 94 to 190, a shoulder about 620 to about 880
    (Low unchanged). Frame cost is in the table under "The final capture".

## Text for ART.md

Section 3, the hazards' row, add: "Rock is laid down in beds: each bed its own value and thickness, shifted
off the one under it, so it has ledges that hold snow and overhangs in shade; the beds dip, and on
a long outcrop they run up out of the slope and are cut off by its top, so no joint is level; a crown is
broken, never flat; snow lies on a boulder's lee side, never in a ring. Basalt
stands in organ pipes: slim hexagonal columns packed shoulder to shoulder, each broken off at its own height
on its own slant and cross-jointed into drums, near black and cold, ash on the flatter tops. Nothing is a prism under a white lid."

Section 4, replace the groove's "running to the bottom of the frame and fading toward the lens" with:
"running to the bottom of the frame at full strength, and lasting the run: a rut does not age. A deep carve
throws clods out past its lip. Every ghost cuts ruts too, two runner cuts in the snow's own shade with a lit
lip, under its line of light; they lie on the snow ahead until you ride over them." Replace "Ghost trails are
faint luminous mint lines" with "A ghost's light fades in seven seconds; its rut stays." Add to "Trees shed
snow as you pass": "A shaved or passed tree shakes for a second and a half. Ghosts shake theirs too. Sakura's
blossom sheds petals, Ember's charred pines ash."

Section 6, the leaps' line: "Fins of the mountain's rock" becomes "Outcrops of the mountain's rock in beds
(on Ember, a palisade of broken basalt columns), a broken crown behind the crowd".

Section 8 or 12, weather: "Weather falls in depth: a few big flakes at the lens, the body of the fall, and
a far layer down the run; gusts cross the slope and the air thickens and thins with them; every flake takes
the frame's light. Ember's air is ash that falls and embers that rise. Trees bend in the same fronts of
wind, tips most. Reduced motion stills the gusts and the wind and keeps the fall."

Section 12, "The world answers skill", add: "And it breaks: a snowman bursts into lumps, a carrot and a
scarf; a barrier scraped at speed splinters; shaved ice throws shards; icicles drop in a gully as you pass;
a span's snow breaks off in blocks as it falls. Pieces are light and paint, never a hazard."

Section 13: "Powder's rim takes the key light's colour and is what blooms in a plume." "A dash throws a ring
as the air opens, lays a wake of light off the runners and trails a comet's tail; the lantern's moments (a
dash, a ward, a gate, a light taken, a lantern filled) each light the snow and the rider for a beat." "A
burst has a heart inside it, lights the square, and a win ends on a finale."

## What the main lane must wire, decide or re-tune

- **Local lights.** This lane only pushes (`pushLocalLight`); nothing shows until the light lane's
  implementation is merged and `beginLocalLights` runs each frame before `spirit.update`. Radii and powers
  above were chosen blind: re-tune them against the merged lighting (the fireworks' 150 m reach above all).
  The powder and weather shaders do not read local lights; if the light lane exposes a GLSL chunk for
  them, the billow branch in `particles.ts` is where it goes.
- **Tier.** The lane reads its tier from the particle budget (`fxhub.ts setFxBudget`, called by
  `Particles.setQuality`): under 0.6 Low, under 0.9 Medium, to 1 High, over 1 Ultra. If the pipe lane's
  Ultra keeps a budget of 1, give it more than 1 or call `setFxBudget` yourself.
- **The collapse.** `SpiritFx` already throws blocks along the fall. For a set piece that wants a whole
  edge to go at once, call `world.spirit.breaks.cornice(x, y, z, len, dx)`.
- **A rock's height** now follows its collider (`props.ts`): if the moments or feel lane changes a rock's
  `h` in the sim, the drawn rock follows without a change here.
- **meshes.ts** is shared with the hero lane: this lane touched only `rockGeometry`, `basaltGeometry`,
  `lavaRockGeometry`, a new `fallenColumn` (and the one line in `logGeometry` that calls it),
  `obstacleGeometry`'s `low` argument, `obstacleModelRadius` and two imports at the top.

## Touched outside my files

- `src/render/places.ts` (unowned): `lipPiece` rebuilt (the leap's shoulders) and two imports.
- `src/render/dressing.ts` (unowned): `outcrop`, `rockBand`, `rockWall`, `basaltPair` rebuilt; its private
  `crag` and `drift` removed (unused after that); two imports.
- `src/render/meshes.ts` (shared with hero): the rock and prop meshes listed above only.
- New files, all this lane's: `rockforms.ts`, `fxhub.ts`, `treelife.ts`, `breaks.ts`,
  `scripts/playtest/fxshots.js`, `tests/rockforms.test.ts`, `tests/ruts.test.ts`, `tests/fxbudget.test.ts`.
- `world.ts` was not edited: everything new hangs off `SpiritFx`, `Particles` and `Props`.

## The final capture (the build at 1401b2a, one headless browser, session `r7-fx`, port 4470)

Frames are in the main checkout under `shots/r7/fx/final/`: the fixed set in `high/` (all four mountains),
`low/` and `phone-medium/` (Pinecrest and Ember), each run's numbers and console in `<tier>-m<n>.json`,
contact sheets `sheet-<tier>-m<n>-a|b.png`, and before and after at the same distance in
`pair-m2-z0450.png`, `pair-m2-z3150.png`, `pair-low.png` and `pair-phone.png`. The effects in motion:
`fx/` (fxshots.js: carve, landing, sheds, breaks, dash, ward, gate on High; Ember's air; Low's landing,
shed and breaks), `moments/` (moments.js: tumble, scrape, leap, finish), `feel/` (feelfx.js: a replayed
winning run's dashes, ward, gates and finish), `fw/` (fireworks.js: the street's show and a win's),
`strips/` (strips.js, plan `flow` on Sakura), with `sheet-fx-high-m0-a|b.png`, `sheet-moments-a.png`,
`sheet-feel.png`, `sheet-fw.png`, `sheet-strips-flow.png`. The lane as it was handed over (before F9) is
kept beside it in `shots/r7/fx/handover/`.

**Cost, the fixed frames against `shots/r7/before`** (frame by frame at the same distance, summed over
every pass; mean of the run, then the median and the worst single frame's difference):

| Tier, mountain | Frames | Draw calls | Triangles | Median difference | Worst frame |
| --- | --- | --- | --- | --- | --- |
| High, Pinecrest | 38 | 92.3 to 92.2 | 1,006,169 to 1,008,065 | 0 calls, +420 | +3 calls, +47,373 |
| High, Frostfang | 36 | 93.1 to 95.0 | 830,714 to 841,862 | +2 calls, +17,085 | +7 calls, +59,486 |
| High, Ember | 35 | 91.9 to 92.3 | 708,751 to 720,509 | 0 calls, +14,820 | +4 calls, +54,910 |
| High, Sakura | 37 | 93.2 to 93.4 | 946,316 to 952,231 | 0 calls, +912 | +3 calls, +49,580 |
| Low, Pinecrest | 38 | 45.6 to 45.4 | 148,251 to 143,741 | 0 calls, -3,598 | +5 calls, +2,082 |
| Low, Ember | 35 | 43.3 to 43.6 | 114,363 to 111,506 | 0 calls, -3,228 | +4 calls, +8,438 |
| Phone (Medium), Pinecrest | 38 | 86.3 to 86.6 | 708,037 to 707,592 | 0 calls, -502 | +6 calls, +26,461 |
| Phone (Medium), Ember | 35 | 85.9 to 86.5 | 494,600 to 504,220 | 0 calls, +6,267 | +4 calls, +47,921 |

Low is lighter on both mountains shot (3% fewer triangles, the same calls). High and Medium are within
1.7% of the baseline in triangles. A single frame swings by tens of thousands of triangles either way
between two runs of the same build (ghosts in view, a set piece's state), so the worst-frame column is the
run's noise more than the lane's cost. The owner's six frames, calls and triangles, baseline to now: 537 m
90 / 1,046,742 to 88 / 1,032,720; 2429 m 92 / 989,552 to 94 / 991,920; 3940 m 86 / 934,596 to 84 /
915,420; Ember 450 m 95 / 705,207 to 94 / 720,959; 2271 m 89 / 691,863 to 91 / 709,454; 3150 m 101 /
628,350 to 99 / 631,377.
**Not explained:** Frostfang on High carries two calls more than the baseline at the median, and four to
seven through the Crevasse Fields (1650 to 3300 m). No effect was staged there; it is steady, so it is
something of this lane's drawn in more than one pass (the ruts or the weather in the ice's reflection is
the first thing to look at). The main lane should count that stretch's passes after the merge.

**The console** was clean in every capture: no error in any of the eight frame runs, and no error or
warning in fxshots (four runs), moments, feelfx, both fireworks runs and the strip.

**Read as an art director, at the owner's distances:**
- *Pinecrest, the First Drop (537 m, and close at 600 m).* Passes. From the approach each shoulder is an
  outcrop with a pinnacle behind its crowd; at the lip the walls either side are dark tilted beds with
  snow lodged on their ledges. Nothing is a slab under a lid.
- *Pinecrest, the Valley Leap (3940 m) and the leap at 2429 m.* Passes after F9, failed before it (stacked
  courses with white stripes). The top edge under the crowd is still a level line 35 m long, because a
  crowd stands on it; the crown behind and the beds under it break it up, but it is the weakest line left.
- *Ember (450 m, 2271 m, 3150 m).* Passes. The run's basalt is a cluster of slim columns broken at their
  own heights with a lit lip at each joint; a leap's shoulders are a palisade round the crowd. Basalt is
  near black by direction, so the two values round a column barely show in Ember's light: the form reads
  by its silhouette and its hot edges, not by its faces.
- *The run's rock.* Now a dark boulder with snow on one side and a broken crown. It is small in the frame
  and has 91 triangles; close to the lens it is still plainly facets.
- *Low.* Draws no leap shoulders (as before this round); its rock and basalt are the cheaper builds and
  read as a boulder and as columns.
- *Effects.* The landing's burst and hanging lumps, a tumble's and a scrape's snow, the ward's crack, the
  dash's ring under the rider (feel/dash1-a), a carve's lit spray (strips/flow), the ruts ahead, Ember's
  embers, the win's fireworks in layers and the finish's all show. The staged breaks are small in the
  frame. See what is not verified below.

## What was measured, what was only seen, what needs a human

- *Measured:* the tests above; triangles and draw calls in the frames below; the console in every capture
  (clean, but for one warning that is not this lane's: `Oscillator.frequency.value ... outside nominal
  range`, from the audio engine, in a full replayed run).
- *Only seen in staged stills:* the landing burst and its hanging powder, ghost ruts, the breaks, the
  blizzard's layers, petals and ash in depth, the fireworks at a real finish, a dash's plume. Stills
  cannot show the wind, the shiver, the gusts, the breathing or any timing.
- *Needs a human:* whether the wind's lean reads as alive or as wobble at 40 m/s; whether the ruts ahead
  help or clutter a line of lights; whether a shed is now visible in play; the dash's wake and tail in
  motion; every local light once it is wired; frame rate (never judged from this lane's runs).

## Not finished, and fragile

- The dash's ring shows in the replayed run (`final/feel/desk-high-m0-dash1-a.png`); its wake and tail are
  not told apart from the powder in any still. fxshots.js's own `dash` plan still does not start a dash
  (the lantern is empty in its frames) and its `carve` plan throws the sled into the air instead of
  carving: both plans need mending before they are evidence of anything. The carve's spray is seen in
  the `flow` strip instead.
- fireworks.js fires the shows a few seconds into a run, in daylight, where they wash out; the show at a
  real finish is in `final/feel/desk-high-m0-finish-a.png` and `final/moments/finish-200.png`.
- The organ pipes are not cross-jointed (Low draws them and they have no cheaper build): give
  `forestSteps` a lod for Ember's second set and they can be.
- A shoulder's top edge is level for its whole length (see the read above).
- Wall crests in `terrain.ts` and the ravine's big flat ice planes are the light lane's and were not
  touched; `crag()` users (arches, spurs, falls) keep their icosahedra.
- No Ultra-specific look beyond larger pools.
- `liveTree` patches the toon material's vertex shader by its `#include <begin_vertex>` anchor (as
  `variantMaterial` does). If the light lane removes that include, both throw at start-up rather than fail
  quietly.
- Ghost ruts read `shared.uFocus` for the rider's place when they rebuild their index: a camera far from
  the focus sees ruts only from 60 m behind the focus to the tier's range ahead of it.
- No local light is in any frame: nothing draws them until the light lane's implementation is merged.
- Frostfang's extra calls on High (the cost table) are not explained.
