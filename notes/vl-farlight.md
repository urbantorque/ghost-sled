# The visual lift: farlight (shadows and light out to the horizon)

Lane `farlight`, branch `vl-farlight` cut from `visual-lift` at `c00d369`, port 4602, sessions `vl-farlight-*`. Render
only: nothing in `src/sim`, `src/bot` or the ghost pools changed, and nothing drawn here moves where anything is or
what it does. The colour roles hold (a shadow darkens a surface's light term only; emissive windows, lamps and
flames are added after it and keep their glow).

## What the fault was, and where it was drawn

- **One cascade, then nothing.** `world.ts configureShadow/fitShadow`: one 1024/2048/4096 shadow map over 26/34/44 m
  of light space, pushed down the lens's heading (DECISIONS 286). Past its box nothing casts: the treeline's raking
  shadows stopped in a hard line about 60 to 80 m down the run, and every vista (the leaps' lips, the overlooks,
  Fang Town at dawn) was lit evenly to the horizon.
- **The terrain never cast.** `palette.ts shadowFrom` says it: "Shadows are only cast by props and riders (the terrain
  never casts)". The banks, the walls, a spur over the run and the far wall of a valley threw no shadow at all; only a
  ravine's wall had a painted stand-in (`materials.ts` snow, `vRock.w`).
- **Low had no cast shadow of any kind** (`QUALITY.low.shadows: false`): the rider's painted blob was all.
- **Nothing standing far off was in shade**: a tree, a house, the rider or a ghost down a shaded valley was lit like
  one on the open snow.

## What changed, and why

### The field (`src/render/farshadow.ts`, new)

A world-space field of how much of the key light reaches anything over the course window, baked on idle time for
each stretch's own sun (`world.ts` hands it `journeyPalette(...).shadowDir` at the stretch's metres, the title's own
light while the title plays, the mood's sun in a chaos mood).

- **What a texel holds.** Not "lit or not": the *ceiling* of the shadow there (the world height under which the
  light is hidden) and its soft band, twice: once for the terrain and once for what stands on it. Anything at that
  place compares its own height with the ceiling, so the snow, a tree, a house, the rider or a ghost down a shaded
  valley all take it, and a tall thing's top stands out of a low shadow. A ceiling is smooth where a shadow's edge
  is not, so a coarse texel still draws a clean edge. The two are kept apart because the near shadow map has the
  casters but never had the terrain.
- **Two scales.** Fine tiles, one a chunk (64 m) of course and 282 m across, 1.1 m by 2 m a texel, a ring of 12 over
  the terrain's own window (a chunk behind the rider to the end of the streamed terrain); coarse tiles, 256 m of
  course and 2.56 km across, 10 m by 16 m a texel, a ring of 8 over the mid-ground's window (200 m behind to 900 to
  1300 m ahead by tier). The fine tiles take the coarse tiles' terrain ceiling where it is higher, so a far ridge
  shades the run too. One RGBA16F atlas, 256 by 552 texels (1.1 MB), one texture read a fragment.
- **How a tile is baked.** The casters are laid into a grid turned to the sun (rows run toward it) and one walk
  down each row toward the lens carries the highest ray that has passed over something (a sweep): a cell's ceiling
  is the highest thing strictly upwind of it, lowered by the ray's slope for every metre between, and the distance
  to it sets the soft band. A turned grid keeps a thin tree's shadow whole whatever the sun's bearing to the course
  (a world-aligned sweep blurred and shortened them); a cell holds the highest point of a cone over its own area, so
  a tree's tip is never lost between cell centres. Soft edges widen with the distance from the caster (0.1 m of
  height at the caster, 0.028 m more a metre on for casters, 0.25 and 0.018 for the terrain), and a caster's
  shadow thins as it reaches away from it (to 42% light at 70 m, as the near map's own `snowShadow` does).
- **What casts.** The terrain as drawn near the run (`visualGround` with the overlooks' fall, a 4 m grid kept a
  chunk at a time), the mid-ground's built rows past it (a 10 m row each mid-ground row); the run's hazards, the
  forest and groves and the bank's large dressing (`props.ts farCasters`: each instance a cone or a box sized from
  the variant it draws); the set pieces' made geometry (`landmarks.ts farSites`: towns, towers, stations, galleries,
  sampled into a grid of what stands over each metre; what hangs over the corridor on a span casts nothing, a roof
  over the run casts whole).
- **Only what the game has made.** The bake reads the mid-ground's built rows and the props' laid-out chunks and
  never plans, generates or lays out anything for the asking (its first version paid for other systems' first
  looks: a village planned, a course zone generated, a chunk's forest laid out, 20 to 90 ms each). What is missing
  is noted and the tile baked again once it has come (all of a tile's missing chunks, half its missing rows, a set
  piece made upwind of it).
- **Jobs.** Idle callbacks run slices of at most 1.6 ms of work; a frame with no idle time still gets one slice
  every 200 ms, so a busy device never starves the field. Nothing runs before 900 ms after the first update (so
  never before `gs-first-frame`), and the atlas is made on the first upload (a 1x1 stand-in until then). A tile is
  copied straight into the atlas with `texSubImage2D` through three's state cache: `copyTextureToTexture` reads the
  GL's unpack state back, a stall that cost the first tile about 100 ms.

### Every lit material reads it (`materials.ts`, one function and the call)

`farShadow(wp, nearShadow)` in `LIGHT_GLSL` (from `FAR_GLSL`, one uniform set: `uFarMap`, `uFarSlot[20]`,
`uFarBox[3]`, `uFarK`). It returns the light that reaches a world position: inside the near shadow map's box the
near map's casters, handed over to the field's over the last part of the box (0.72 to 0.96 of its half size in
light space, the box the shadow camera really draws, so the two never cut), everywhere the terrain's own shadow,
and on Low (no box) the field alone. Strength and softness follow the frame's key light: `palette.shadowK` times
`1 - 0.45 sunSoft`, every soft band `1 + 1.5 sunSoft + 1.5 (1 - shadowK)` wider, so Blizzard's flat grey day casts
faint, soft shadows, the moon casts at night and Ember's deck (soft sun, places at 0.6 to 0.95) casts gently.

Callers: the snow (`farShadow(vWorldPos, mix(1.0, snowShadow(), uShadowK))`), the toon material (props, trees,
hazards, set pieces, rails, the rider), the mid-ground's shoulders, its forest carpet and its villages, and the
ghosts' glass (by day a ghost in shade loses its glint and a step of its face; its rim and night glow are its own).

## Shared code touched

Each edit is the smallest that does the job and carries a comment saying why.

| File (owner) | Change |
| --- | --- |
| `materials.ts` (light) | An import; `...farUniforms` in `shared`; `${FAR_GLSL}` at the end of `LIGHT_GLSL` (the one function); the snow's `shadow` line and the toon material's line after its `USE_SHADOWMAP` block call `farShadow`; the ghost material spreads `farUniforms`, includes `FAR_GLSL` and multiplies its face and glint by it (four lines). No shading term changed. |
| `world.ts` (temporal: render targets; farlight: shadow setup) | `far: FarShadow` made in the constructor with its `FarWorld` (the stretch's sun, the ground with the overlooks' fall, the accessors below); `updateFar()` after the shadow box is fitted (the near box, the strength and softness from the palette, the window); `invalidate()` on a new course, mood, tier, the title's light or a play-test's `journeyAt`; `?far=0` / `world.farOff` draws it at no strength (A/B). |
| `props.ts` (props: batches) | `farCasters(i, out)`, read only: a chunk's packed batches as cones and boxes from each variant's bounds (`variantDims`, cached a geometry). |
| `midground.ts` | `shoulders(r, ...)`, read only (the built row's own columns), and the window it keeps (`win0`, `win1`, two lines in `update`); one call each in the shoulder and forest shaders. |
| `landmarks.ts` | `farSites(z0, z1, cb)`, read only: the made pieces with their frames. |
| `village.ts` | One call in its shader. |
| `scripts/playtest/frames.js` | After a jump down the course the rider is held until the field is in (a build without it goes straight on). |
| `scripts/playtest/systime.js` | `far` among the systems it times. |

(The rest of this file is filled in as the lane closes: see below.)
