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
