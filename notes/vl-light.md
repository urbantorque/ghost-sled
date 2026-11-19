# The visual lift: the light lane (light that bounces and passes through, edges that look made)

Lane `vl-light`, branch `vl-light` cut from `visual-lift` at `c00d369`, port 4603, sessions `vl-light-desk` and
`vl-light-phone`. Render only: nothing in `src/sim`, `src/bot` or the ghost pools changed, and no geometry, batch or
draw was added. The colour roles hold: the rider vermillion and navy, the ghosts mint, marigold the lantern's (and,
on Lanternfall only, the lamps' light).

## What each fault was, and where it was drawn

1. **The shade side was one flat value.** Every toon surface lights through `toonLightK` (`materials.ts`
   `LIGHT_GLSL`): `mix(shade, lit * sun, t)`, a hemisphere term `uHemi * 0.07` added flat (not by the surface's
   colour), and the shade itself `mix(base * 0.42, uShadeTint * k, coolShade)`, half of it one cool tint whatever the
   surface. Nothing in it depended on which way a shade face was turned. The chase lens looks down the run toward
   the sun on every mountain (`sunDir` azimuths are all within 35 degrees of the fall line, ahead of the lens), so
   most of what a player sees of a building, a tree, a rock or a barrier is its shade side: one value.
2. **Nothing took the lit snow's bounce.** Only Ember had light from below (`uUnder`, the lava), and the rider a cool
   fixed bounce of its own (`rider.ts`). A balcony's underside, an eave, a trunk, a sled's underside had the same
   value as a wall.
3. **Sakura's blossom never read backlit.** The canopy glow (`uLeaf`, the `HAZARD` block of the toon fragment)
   added `0.14 + 0.9 * back * (0.3 + 0.7 * thin)` of the blossom's colour, where `back` was the square of the view's
   cosine to the sun: about a fifth of the base on a face seen square on, so a canopy against the sun was pink
   polyhedra a step lighter, not light coming through.
4. **Ice and the ghosts' glass took no light through them** with the sun behind: the ice's inner glow was a
   constant, the glass's sun term a reflected glint only.
5. **Boxes at the lens.** Nothing marked a convex edge: a kicker's lip, a stone lantern, a torii post, a barrier, a
   board's edge were two flat values meeting at a stair-stepped line. Occlusion (`postfx/ao.ts`, half the frame, a
   4x4 blur) darkens broad contact, never an edge's hairline.

## What changed, and why

(Commits on `vl-light`, oldest first: listed at the end.)

- **The sky's fill and the snow's bounce** (`materials.ts` `LIFT_GLSL liftFill`, one line in `toonLightK`). The sky
  is a light of its own: its bright half stands opposite the key and high, so on the shade side a face turned up
  and back toward the lens takes the high sky's colour and is lighter, one turned across the slope less, the side
  toward the key least: three values where there was one. What faces down and sideways takes the bounce: the snow
  round the lens as the snow shader draws it (its lit colour in the key light over the share of it in the sun,
  `lift.sun`; its shade over the rest), times the place's tint. Both are the surface's own colour lit, never a wash,
  and the shade's flat value gives back about what the fill puts in (up to 24%, less on a dark surface, nothing on
  ink, basalt or the navy coat), so the shade gains form and not milk. The sky the shade side sees is the half away
  from the key: the horizon cooled as the air cools away from the sun (`air.cool`), so a gold hour's shade stays
  blue under gold. Every material built on the shared model takes it: props, landmarks, towns (`village.ts`), the
  middle distance (`midground.ts`), life (`life.ts`), the rider and its sled.
- **Lamplight bounces too** (`localLight`, one term): what faces down over a lamp's pool takes the pool's light back
  off the snow, so eaves and balconies over a lit street, and Lanternfall's stone lamps, carry the pools' amber and
  marigold from below.
- **Light through what is thin** (`liftThrough`): a little over the whole of a surface while the lens looks toward
  the key, and most through a face turned from it at its outline (the key's direction bent by the normal, so it
  gathers toward the edge). Foliage of every kind takes it in its own colour: dark needles glow only a little at
  their tips and stay the hard dark shape; blossom (`uLeaf`) is lit through like paper, its heart a deep rose and
  its outline burning the sun's peach. Ice gathers a cold cyan-white at its thin edges and tips (never mint); the
  ghosts' glass glows in its kind colour toward the outline by day.
- **The snow's sheen** (the snow fragment): snow seen at a grazing angle toward the light takes a soft sheen of it,
  from 5 m past the lens to the middle distance, on the lit snow only, breaking over the ripples (their relief is in
  the normal), a trace of the key's hue in it.
- **The crease light** (`postfx/ao.ts` `pipeCrease`, called from `pipeAO`, so `post.ts` is untouched): from the
  frame's own depth at full resolution, near the lens a convex edge catches a hairline of the key light's colour and
  an inner crease darkens toward the mood's shade. The fold is found from how the surface turns along each screen
  axis: the outer chords (two pixels out) give its whole turn, which holds along an edge, and the inner ones the part
  of it at this pixel, so a fold between two pixels is shared by both by where it falls (a hairline that does not
  stair-step). A step in depth (an outline, a gap behind a rail) is no fold and draws nothing; the rider and its
  sled (a reach of 1.5 m round `uFocus`, in view space), the sky and lights (the occlusion's luminance guard) take
  none. It fades from about 33 m to 60 m (sooner in a thick fog). High and Ultra only, with the occlusion.
- **By tier.** Ultra and High: all of it. Medium (the phone): the fill, the bounce, the light through and the sheen,
  which are a handful of sums a pixel and no taps; no crease (no depth pass). Low: none of the GLSL runs
  (`uLiftK` is 0 and every function returns at its first line); a little over half the bounce rides in `uUnder`,
  the light from below Low already draws, added to Ember's lava, so it costs Low nothing.
- **Palettes** (`palette.ts`): a new field `lift` (`bounce`, `sun`, `tint`, `sky`, `through`, `sheen`), all 0 and a
  white tint by default, so every chaos mood keeps round 7's light. `visualLift()` sets each mountain's Clear Skies;
  the places shade it to ART.md 15: Old Town's street and Frostfang's slots bounce cooler (less of their snow in
  the sun), Station Street the windows' amber, the Ice Cavern little and cold, Ember's slots, halls and caldera the
  lava's orange, Sakura's orchards the most light through the blossom, Lanternfall's avenue, lamp grove, bridge and
  square marigold.

## How it was judged

- **Same frame, on and off.** While tuning, a frozen frame was drawn twice, as the build draws it and with the lift's
  terms (`uLiftK`) and the crease at 0, which is exactly round 7's shading (every term is gated on them; on Low the
  bounce was also taken out of `uUnder`). Thirty-odd such pairs on all five mountains (`shots/vl/light/ab1` to
  `ab4`, `lowchk`), measured for the frame's mean luma and its darkest and brightest tenths, with a diff image of
  where light moved, then read by eye at 1.5x to 3x crops.
- **The fixed frames.** Round 7's final set (`shots/r7/final`) is the before; the after is the same list
  (`frames-r7.json`) on this build: High and Low on the desk, Medium on the phone, all five mountains
  (`shots/vl/light/after`). Contact sheets, round 7 beside the lift (labelled `r7-` and `vl-`), in
  `shots/vl/light/sheets` (`round-sheets.sh`, which now takes its labels).
- **Close stills** of props at the lens (Pinecrest's kicker and FINISH board, Sakura's stone lanterns and torii,
  Lanternfall's stone lamps) and of Sakura's blossom against the light, on and off on one frozen frame
  (`shots/vl/light/close`).

## Cost

Nothing here adds a mesh, a batch, a material, a program or a pass: the shading terms are uniforms and sums in
programs every surface already runs, and the crease light is a function in the composite that already reads the
depth. Four uniforms join the shared set (`uLiftK`, `uBounce`, `uSkyUp`, `uSkySide`) and four the composite
(`uCrease`, `uCreaseC`, `uCreaseV`, `uCreaseHero`).

**Draw calls and triangles** (the frames' JSON, summed over every pass of a frame; 181 frames a tier, the console's
errors in every capture):

| Tier | Round 7 final: calls mean / max, triangles | The lift (set) | Errors |
| --- | --- | --- | --- |
| High | 98.7 / 112, 884,712 | 99.5 / 113, 883,126 (`after3`, the final build) | 0 |
| Low | 49.1 / 63, 131,165 | 51.1 / 62, 137,275 (`after`) | 0 |
| Phone, Medium | 89.0 / 103, 618,896 | 88.9 / 101, 619,524 (`after2`); Frostfang and Sakura 89.4 / 101 against 90.0 / 103 (`after3`) | 0 |

The first after set was shot while the phone set ran beside it on a shared GPU, so its race (the clock at each
distance, which ghosts are in view) ran behind round 7's, by up to 11 s on Ember. Low's gap there is all Ember (53.1
against 47.5) and Pinecrest (48.9 against 45.8), frame by frame +6 to +10 calls with ghosts and set pieces in other
places, so Ember on Low was shot again on both builds one after the other in one sitting: **base 46.9 calls and
105,452 triangles a frame, the lift 46.7 and 104,918** (and Sakura's Low in `after2`, 47.5 against round 7's 49.4).
The lift adds no draw on any tier; the table's differences are the runs'.

**The console** was clean in every capture (the frames' JSON: page errors and console errors, all 0 on every tier
and set), and on a cold start (an emptied save, the title, then a run, six and eight seconds) on Low, Medium, High
and Ultra: no error and no warning on any tier, so every program the lift touches compiles without a D3D warning.

(GPU_AND_SCRIPT)

## The critic's verdict

One fresh critic (general-purpose, Opus at extra-high effort), given only ART.md, the 26 exact pairs and the
fixed frames' sheets and folders, and asked for each pair whether the after is better, worse or the same in light,
form and polish, and what broke. It measured regions of the exact pairs as well as looking.

- **Exact pairs (High, build `b707721`):** 15 of 26 the same by eye; Ember and Lanternfall untouched (their nights
  and smoke throw little light back, as built), Pinecrest barely. Better: Frostfang's ice spires (a richer cobalt in
  their shade, still dark), the Serac Gate parapet (glows through, reads as ice), Sakura's blossom backlit at
  0970, 1350, 1650, 2580. Worse: Sakura's near canopies (shade facets lifted to nearly the lit value, one hot-pink
  shape, the hue sliding from orchid toward the grudge's rose), Sakura's darks (trunks 47 to 64 levels, pines and
  terrace walls at 0600, gantry posts, the lift's pylon; the torii's plum going toward crimson), Frostfang's ice
  ribs at 2548 and 3549 (the shade plane lifted about 30 levels into the lit top, the lit top a step dimmer), the
  Pinecrest finish's far shade warmed (the blue between the amber pools eroded), the coat a little bluer.
- **Fixed frames:** race state swamps the change (pairs up to 70 m apart); High Sakura 5 better, 7 worse, 25 same;
  High Frostfang 2 better, 1 worse; every other mountain and tier the same; Low nothing attributable.
- **Not found anywhere:** haloes or outlines on edges, added noise or shimmer, a hazard losing its dark, the rider
  washed out or sunk, the vermillion or the mint moved.
- **Its verdict:** "not yet a visual lift; it is the same picture with the blossom turned up. Nothing broke on
  Pinecrest, Ember or Lanternfall. Fix faults 1 to 3 before shipping."

### What changed after it (`26f8a54`)

1. **Blossom** (fault 1): light through a thin thing now gathers at its outline only (the term that lit a whole
   face while the lens looked toward the sun is gone), the blossom's in its petals' own pink (toward `#FFC9DA`,
   never warmed by the sun, so it cannot slide toward rose), a canopy's underside keeps 70% of its shade, and a
   canopy inside 7 to 18 m of the lens takes a third of it.
2. **Darks** (fault 2): the fill's colour holds half its hue back (a plum lacquer stays plum), a dark surface takes a
   quarter of it (trunks, ink, basalt, the coat: fault 5 too), and Sakura's fill is softer and its bounce has no
   warmth of its own.
3. **Ice ribs** (fault 3): the ice's light through gathers at the rim (thin squared) at 0.8, so a rib's face keeps
   its plane; the fill no longer dims the lit side at all (it took about 6% off a lit top).
4. **The finish's far shade** (fault 4): the low sky the shade sees is the horizon pulled further toward the high sky
   and cooled, so a gold hour's shade stays blue.
5. The crease light's edge from 0.9 to 1.3: the critic saw no edge either way, and no outline.

### The second critic (build `26f8a54`)

A second fresh critic, told the same and nothing more, on the 26 exact pairs reshot on the fixed build and the
fixed frames reshot on High and the phone (`shots/vl/light/after2`; all 362 pairs measured, 13 looked at).

- **Better than the first critic's build:** darks hold (every band under 55 levels moved 0 to +2: trunks, the
  Thousand Torii's lacquer, basalt, ink); the blossom no longer nears rose; the coat stays navy (0 to +3 blue);
  vermillion, mint and marigold unchanged; no hazard loses its dark; the rider never washed out or sunk.
  Better pairs: Pinecrest's boulder and cliff strata at 2429 (shade faces +5 to +17, darks and pines unchanged:
  better in light and form), Sakura's pines at 0600 (their sky-facing faces lift, so they read with two faces, the
  dark faces held), the blossom's glow at 0970, 1350, 1650, 2580.
- **Still faults, worst first:** (1) Frostfang's thin and far ice (a far rib at 2548, the hangers at 3549, a far
  rib at 1343): a thin member is all rim on screen, so the light through lifted its whole face and it lost its
  cobalt core; (2) Sakura's canopies flatten a little from the shade side (the darkest facets +5 to +26, value range
  down 16 to 36%, a few degrees pinker), on about half the Sakura frames on both tiers; (3) **a hairline along the
  bottom row of every High frame** (and the side columns, and the top where geometry meets it): the crease's outer
  taps read the frame's edge again; (4) Old Town's blue between the amber possibly eroding (fixed frames only,
  confounded by the lantern gates' state); (5) a light, dark, light ring two pixels apart beside a few near edges
  (a rail at Lanternfall 2059), and the kicker's lip softened a little; (6) watch for milk on the lifted faces.
- **Its verdict:** "Better than the first critic's build. Darks now hold and the blossom no longer nears rose. The
  ice ribs are only partly fixed, and the crease added a new border artefact. At gameplay scale it is still the
  same picture, a little more lit, not yet a visible lift." High: "a modest, mostly safe lift"; the phone: only
  Sakura's canopies attributable, smaller at that scale.

### What changed after it (`220a317`)

1. **Ice:** the light through is held to half the step from a face to the ice lit (so a thin or far member keeps a
   plane under its lit one), in a deeper cyan, so it cannot pale a rib to steel.
2. **Blossom:** rim-only where a canopy is thin on screen (`smoothstep(0.35, 0.8, thin)`), a quarter softer.
3. **The border line:** the crease skips the 2.5 pixels inside the frame's edge.
4. **Ringing:** a crease asks a sharper fold than an edge (0.75 to 1.2 against 0.5 to 1.0), its darkening 0.35.

(THIRD_LOOK)

## Shared code touched

Every edit below is in this lane's own new code, or the smallest change to shared code with a comment saying why.
`post.ts` is untouched: the crease light lives in `ao.ts`'s composite function, which the composite already calls.

| File (owner) | Change |
| --- | --- |
| `materials.ts` (this lane's shading terms) | New chunk `LIFT_GLSL` (`liftFill`, `liftThrough`) inside `LIGHT_GLSL`; **one line in `toonLightK`** (`col = liftFill(col, lit, n, t)`) and **one term in `localLight`** (a lamp's pool bounced onto what faces down, times `uLiftK.x`), the two shared functions; four uniforms in `shared` (`uLiftK`, `uBounce`, `uSkyUp`, `uSkySide`); `applyLift()`, called from `applyPalette` and `setCloudShadows` (one line there), which also takes over setting `uUnder` (Low's bounce rides in it); in the toon fragment a foliage block after round 7's `uLeaf` block and a few lines in the `ICE` block; in the snow fragment the sheen after the far sheen; in the ghosts' glass one uniform and two lines. Every other material that includes `LIGHT_GLSL` (`life.ts`, `midground.ts`, `village.ts`, `rider.ts`'s patch over the toon) takes the fill through `toonLightK` and was not edited. |
| `palette.ts` (new fields, neutral by default) | `Palette.lift` and its default (all 0: every chaos mood keeps round 7's light); `visualLift()` after `round7()` for Clear Skies; `lift` lines in one `JOURNEY` stop (Sakura's orchards) and in eleven `PLACES` rows (Old Town; Frostfang's ravine, Station Street, Ice Cavern; Ember's ravine, tunnel, Caldera Leap; Lanternfall's avenue, lamp grove, bridge, square). `tierLook` untouched. |
| `postfx/ao.ts` (this lane's) | `creaseAxis` and `pipeCrease` in `AO_COMPOSITE_GLSL`, called at the end of `pipeAO`; four composite uniforms; `AOPass.crease`, `creaseEdge`, `creaseDark` and `aimCrease()`; `rest()` zeroes the crease. |
| `scripts/playtest/round-sheets.sh` | Optional fourth and fifth arguments, the pair's labels (and so Lanternfall paired too); round 7's call is unchanged. |
| `scripts/playtest/tile.mjs` | A three-minute wait for a sheet's content (forty frames on a busy machine took longer than the default). |
| `tests/lift.test.ts` | New: the palettes (neutral in every chaos mood, inside bounds all the way down every run, a bounce never in a ghost's colour and never brighter than the lit snow), the tiers (all of it on Medium and up, none on Low but the bounce in `uUnder`, Ember's lava kept), the crease's reach (at most 60 m, nearer in fog, the rider's place and reach, off with the pass and when asked). |

**For the merge.** The `farlight` lane also adds a function and a uniform to `LIGHT_GLSL`; the `poster` lane owns
`tierLook` and Low's branches: this lane's Low share is `applyLift()`'s `uUnder` fold in `materials.ts`, not
`tierLook`. The `temporal` lane owns `post.ts` and `pipeline.ts`: `pipeCrease` reads `uDepthTexel` (the depth's own
texel), so it holds if the frame is drawn at part resolution; if the depth it reads is jittered, the hairline
belongs before the history, where the reconstruction can antialias it. The `props` lane's rounded blossom will
change what `liftThrough`'s rim finds; the term follows the outline as seen, so it should suit rounder canopies,
but it wants a look after the merge.

## What is still short

- **A modest lift, not a visible one at gameplay scale.** Both critics: Ember and Lanternfall are the same picture
  (their night and smoke throw little light back, and the lamps' bounce is small), Pinecrest moves a little; the
  gains are Sakura's blossom glow and pines, Frostfang's ice spires and parapet, Pinecrest's rock strata. A stronger
  fill was tried in tuning and read as milk; the critics asked for less, not more.
- **The crease light is subtle.** Neither critic saw a hand-bevelled edge at 1280x720 (the second measured hairlines
  on basalt columns, building corners and a rail); a 1 to 2 pixel line is near what a still at that size shows. The
  `props` lane's chamfers carry this read on every tier.
- **The snow's sheen** barely shows: lit snow sits high on the film curve, where a sheen of 0.2 rolls off to almost
  nothing. It costs a few sums and was left in at a low strength.
- **The rider stencil is not read**: the crease keeps off a 1.5 m reach round the rider in view space instead (it
  also keeps it off the snow under the sled, where there is no fold). Ghosts write depth only for their head and
  shoulders, smooth lathes under the fold threshold; no crease was seen on one.
- **Not measured on a quiet machine** (see Cost): the last sitting was on battery.

## Where the frames are

All under `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\vl\light\`:

- `after` (build `b707721`, the first critic's): High, Low and the phone, all five mountains, 181 frames each.
- `after2` (build `26f8a54`, the second critic's): High and the phone, all five; Low Sakura.
- `after3` (the final build, `220a317`): High, all five; the phone's Frostfang and Sakura. The phone's other three
  mountains are as in `after2` and Low as in `after` (Low Sakura `after2`): the last round changed High's crease and
  the blossom and ice terms, which those frames do not hold.
- `sheets` (round 7 beside `after`) and `sheets3` (round 7 beside `after3`), a mountain and a tier a sheet.
- Exact pairs, one frozen frame drawn with the lift off and on: `critic/exact` (first build), `critic2/exact`
  (second), `exact3` (final: Frostfang's bridges, Old Town, the kicker, Sakura's canopies, Lanternfall's rail,
  Ember's frame border); tuning pairs in `ab1` to `ab4`, `lowchk`, `dbg`.
- `basecheck`, `aftercheck`: Ember on Low on both builds in one sitting (the draw-call check).

## Commits

(COMMITS)
