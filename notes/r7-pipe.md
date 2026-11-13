# Round 7, the pipe lane: the frame's passes

Branch `r7-pipe`. This file is kept as the work goes, so it is true at every commit. Frames are in
`shots/r7/pipe/` of the main checkout. Every timing in here is a lane measurement taken with other lanes
running on the same laptop, not a verdict: the main lane measures again after the merge.

## Decisions

### 1. An Ultra tier above High, and who gets it

`Tier` is now `'low' | 'medium' | 'high' | 'ultra'` (`src/render/postfx/tiers.ts`, re-exported by
`world.ts`). Ultra dresses the world exactly as High does (`Detail`, `detailOf`): forests, crowds, life and
the far ranges keep their three levels, so no other lane's tables had to grow a meaning for a fourth. What
Ultra adds is in the frame: four MSAA samples, a 4096 shadow map over a wider reach, and every pass in
`PASSES.ultra` at its full count.

**The rule for the automatic controller: opt-in, except on a GPU named as discrete.** `guessTier()` never
returns Ultra. `TierController` has a `ceiling` (default `'high'`) and steps up only to it.
`deviceCeiling()` raises it to `'ultra'` only when `WEBGL_debug_renderer_info` names a discrete card (a
GeForce RTX, a GTX 10 or 16 series, a Radeon RX, an Arc A or B card), and then asks for the headroom to be
held 12 s, twice what a step to High asks. On an integrated GPU, an Apple GPU or a masked name, Ultra is
only ever the player's own choice (Settings, Quality, Ultra; or `?tier=ultra`).

*Why.* The controller's headroom rule measures the main thread's work. That says nothing about fill rate,
which is what Ultra spends. On this laptop's Arc 130V a step up would be a rebuild hitch, a second of long
frames, and a step back down, in the middle of a run: the player would feel two hitches and gain nothing.
A wrong guess on a discrete card costs the same two hitches once, and the controller never climbs back to a
tier it left.

*What shows it works.* `tests/quality.test.ts`: under the default ceiling 100 s of perfect headroom leaves
High at High; under an Ultra ceiling it takes the longer hold; Ultra steps down to High on long frames and
never returns; the GPU names (this laptop's `Arc(TM) 130V` among them) classify as the rule says.

Ultra is offered in the settings row on a mouse-and-keyboard device and hidden on a touch one (a phone at
four samples a pixel is a trap), unless the save already chose it.

## Touched outside my files

- `src/render/chaos.ts`, `life.ts`, `nearfield.ts`, `speedposts.ts`: one `ultra:` row each in their
  `Record<Tier, ...>` tables, equal to High's. Nothing reads them today (the world hands every system
  `quality.detail`, which is `'high'` on Ultra); they exist so the type is complete.
- `src/game/app.ts`: `?tier=ultra` is accepted (an unknown `?tier=` value is now ignored instead of
  crashing the tables), the controller gets `deviceCeiling()`, audio gets `detailOf(tier)`.
- `src/game/save.ts`, `src/ui/contract.ts`, `src/ui/settings.ts`, `src/ui/style.css`: `'ultra'` in the
  quality setting, a fifth button, its caption, and `.gs-seg` laid out for any number of buttons.

## Dev switches (text for the README's table)

| Switch | Effect |
| --- | --- |
| `?tier=low\|medium\|high\|ultra` | Force a quality tier instead of the automatic one |

(More rows are added below as each pass lands.)

## Cost

(Filled in pass by pass.)

## What the main lane must wire or decide

(Filled in as the work goes.)

## Progress log (kept current; folded into the sections above at the end)

- **Depth** (commit 1fbdcef). The scene target carries a D24S8 depth texture when a tier's passes read it
  (`wantsDepth`). Under MSAA it is resolved with the colour (depth only: the stencil resolve stays off);
  a frame whose plan reads no depth does not resolve it. `postfx/depth.ts` holds the shared uniforms and
  GLSL. Ghosts, particles and the sky dome write no depth: passes see the opaque world behind them.
- **Ambient occlusion and contact shadows** (1fbdcef). `postfx/ao.ts`. Half-frame RGBA8, two passes (the
  search, a 4x4 depth-aware blur), then four taps in the composite. Ultra: 3 slices x 3 steps and an 8-step
  contact ray; High: 1 slice x 2 steps. Lane GPU time at 1280x720 (timer query, other lanes running): High
  0.2 to 0.3 ms, Ultra 0.4 to 0.7 ms, plus about 0.1 ms in the composite. +2 draw calls, +2 triangles. It
  scales with pixels: about 4x that at a 2560x1440 frame. Frames: `shots/r7/pipe/ao/sheet-*.png`.
  Limits: it is applied in the composite, so powder thrown over the sled's contact takes the tint too; a
  luminance guard keeps it off anything brighter than lit snow (lamps, windows, glints).
- **Shafts** (this commit). `postfx/shafts.ts`. Two zoom-blur passes at 1/4 (Medium) or 1/2 (High, Ultra)
  of the frame, R8. 6, 8 and 12 taps a pass. The sun's are driven exactly as before by `GradeParams.shafts`
  and the disc; `pushShaftSource(x, y, z, r, g, b, strength, radius)` offers one bright place a frame
  (a cavern mouth). Lane GPU time at 1280x720: 0.15 to 0.4 ms; +2 draws a source. Round 6's fan in the
  composite still exists behind `?post=-shafts` (the before); the main lane may delete it.
  Ember and Sakura have `shafts: 0` in their grades, so nothing shows there until the light lane raises it.
  Frames: `shots/r7/pipe/shafts/sheet-high.png`.
- **Depth of field, motion blur, letterbox** (this commit). `postfx/lens.ts`, read from `cine.dof`,
  `cine.focus`, `cine.motionBlur`, `cine.letterbox`. At rest nothing is drawn and the two float targets
  are never even sized (`tests/pipeline.test.ts`: the plan adds 0 passes at rest on every tier). In a beat:
  a half-frame gather (22 taps with bright taps weighted up on Ultra, 8 on High) and one full-frame pass
  that mixes the blur in by each pixel's own circle and gathers 9 (Ultra) or 5 (High) taps along the
  depth-reprojected motion. The rider's ellipse on screen is never blurred or gathered from; the HUD is
  the page's and is untouched; reduced motion drops the blur; a lens that moved under half a pixel skips
  it. Medium and Low have neither. Lane GPU time at 1280x720: depth of field 0.6 to 0.9 ms, motion blur
  0.25 to 0.3 ms, +3 draws in a full beat. The letterbox is in the composite: 2.39:1 inside 16:9 at most,
  none in portrait; the HUD draws over the bars (the main lane should check the HUD's rows read on black).
  Ghosts and particles write no depth, so they blur with what is behind them.
  Dev: `?cine=dof:1,focus:7,blur:1,box:1` holds cine values. Frames: `shots/r7/pipe/lens/sheet-ultra.png`.
  Shafts tiers as shipped: Medium 6 taps at 1/4, High 8 at 1/2, Ultra 12 at 1/2.
- **Shadows** (commit after 981979a). `world.ts fitShadow`: the shadow box is pushed half its reach down
  the lens's heading (so it covers what the frame looks at, not the slope behind the lens) and its middle
  moves in whole texels along the light's axes, so shadow edges stop crawling at speed. Reach by tier
  (`PASSES.shadowReach`): Medium 26 m (1024), High 34 m (2048), Ultra 44 m (4096: 46 texels a metre against
  High's 30). No pass added, no draw added. The soften-with-distance filter and the sled's crisp contact
  blob are untouched (materials.ts, landing.ts). No second cascade: it would mean a second shadow lookup
  in every material, which is the light lane's file this round. `?post=-fit` is round 6's box.
  Frames: `shots/r7/pipe/shadow/sheet.png`.
- **Reflections on ice and the lakes** (this commit). `postfx/reflect.ts`, spliced into the snow shader's
  ice branch (one call in `materials.ts`). Low: round 6's painted gradient. Medium and High (`bake`): the
  lake's baked sky and peaks on every glaze (an ice patch, Glass Ice, the fork's strip), faded out toward
  the bake's foot so a glaze on a slope has no edge, and the rider's soft figure standing in it; the bake
  (768x200, the sky's own few draws) is now refreshed every 3.5 s on any stretch instead of only near a
  lake. No pass, no draw a frame. Ultra (`screen`): the snow shader marches the mirrored ray through last
  frame's depth (24 growing steps, 100 m, then five halvings to the crossing) and reads last frame's
  picture there: trees, pylons, the hut, gifts, the rider and the ghosts stand in the ice, and a ray that
  leaves for the sky reads the real sky. Last frame's picture and depth are the scene target's own
  resolved textures (under MSAA the scene draws into renderbuffers, so there is no copy and no feedback).
  It runs on ice pixels only. A hit is accepted only where the ray's depth meets the depth buffer's at the
  crossing: a thickness test smeared gifts down the ice and, with a jittered start, stippled the rider.
  The first frame after a resize or a tier change, and the results inset, fall back to the bake.
  Limits: what is off screen is not in the ice (the mirror fades over the last 6% of the frame); things
  that write no depth (ghost glass, particles) are mirrored only where they overlap something that does.
  `?post=-mirror` is round 6's. Frames: `shots/r7/pipe/mirror/` (`*-r6.png` against `*-r7.png`: the lake
  at 1800 m, Glass Ice at 900 m).
