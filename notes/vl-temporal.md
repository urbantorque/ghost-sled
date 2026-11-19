# The visual lift: the temporal lane (temporal reconstruction)

Lane `temporal`, branch `vl-temporal` cut from `visual-lift` at `c00d369`, port 4601 (both builds served from `dist/`:
`/vl-temporal/` and round 7's `/vl-temporal-before/`, built from the first commit), sessions `vl-temporal*`. Render
only: nothing in `src/sim`, `src/bot` or the ghost pools changed, and nothing moves where anything is. The colour roles
hold.

## What the fault was, and where it was drawn

DECISIONS 360's first lift. High drew at up to twice the page's pixel density with 2x MSAA and the composite's edge walk
(`post.ts fxaaWalk`), Ultra with 4x; Medium the walk alone; Low the canvas's MSAA. Thin things still crawled at speed:
the gondola and lift cables (Frostfang 2405 m: a stair-stepped line), Old Town's bunting and lantern outlines, rails, the
tree edges (Pinecrest 900 m), and a wire thinner than a pixel was dashes. Round 7's temporal blend (`postfx/taa.ts`,
DECISIONS 287) steadied a still frame and went soft in motion: it read the history through one bilinear tap a frame (a
little softer every frame), knew only the lens's motion (the rider, who rides with the lens, was read in place inside
an ellipse), kept particles in its history, and ran at the frame's own size, so it bought no GPU time back.

## What changed, and why

Commits on `vl-temporal`, oldest first.

- **The temporal reconstruction** (`postfx/taa.ts`, rewritten; `postfx/after.ts`, new; `pipeline.ts`, `post.ts`,
  `tiers.ts`, `depth.ts`, `quad.ts`; hooks in `world.ts`, `rider.ts`, `ghosts.ts`, `materials.ts`).
  - *The scene* is drawn with the lens moved to one of 8 places inside a scene pixel each frame (16 when the scene is
    smaller than the frame; a Halton set on 2 and 3), with two MSAA samples (round 7 drew two on High and four on
    Ultra, at the frame's full size; first shipped with none, see the critic), at `renderScale()` of the frame: High 0.7, Ultra
    0.85 on a dense screen, never fewer scene pixels than page pixels (`SCALE_FLOOR`), so at a pixel ratio of 1 it is
    the frame's own size, at 1.25 0.8, at 1.5 and 2 the tier's share.
  - *The rebuild* (one pass at the frame's size, into a half-float history kept in turn in two targets): this frame at
    each frame pixel from its 3x3 scene pixels, each weighed by how near it fell to the pixel's middle; the history read
    where the pixel's point of the world was a frame ago (the nearest depth of a cross, reprojected with the lens
    without its move) through a five-tap Catmull-Rom; the history held inside this frame's colours round the pixel (a
    YCoCg variance box, its corners drawn halfway to the cross's, 1.25 sigma at rest and 0.9 in motion, clipped toward
    its middle); this frame's share 0.08 at rest rising to 0.16 at 40 pixels of motion, less where no scene pixel fell
    near; all of it where last frame's depth says the point was not what the lens saw there (a disocclusion: the
    nearest of four depths more than 6 to 18% off); a new highlight (a glint's flash) taken as it comes. The history is
    kept in a compressed range (`c / (1 + max(c))`), where the filter's negative lobe cannot take a dark pennant under a
    bright sky below black (kept linear, it did, and the clamp left black specks along the bunting).
  - *Motion of its own*: the rider's rig, its scarf (a box round the scarf's points each frame, carried by the rig's
    motion), a wreck's body and sled, and the ghosts nearest the lens (six bodies in all) each carry a box in their
    sled's frame. A pixel whose point of the world is inside one is reprojected by that body's own last pose. So the
    rider is not smeared by the world streaming past behind it, and the ghosts' glass (which writes depth in its
    prepass) does not trail.
  - *The occlusion* is laid on this frame inside the rebuild, not in the composite, so it is rebuilt with the picture
    instead of crawling with the lens's moves (the box moves with it).
  - *The sharpen and the depth*: a second pass sharpens the rebuilt frame (after RCAS, in the compressed range: High
    0.8, Ultra 0.7) into the frame the bloom, the lens pass and the composite read, and writes the scene's depth at the
    frame's size (`gl_FragDepth`).
  - *What the history cannot know* (`postfx/after.ts`): after each scene pass the frame's transparent draws (three's own
    render list) are read once, and point sprites and additive or premultiplied glows that write no depth, use no scene
    light and are not under the rider's stencil (contract C10) move to a layer of their own for good. The lens draws
    that layer over the rebuilt frame, at the frame's size, depth-tested against the world and never kept in the
    history: powder, spray, sparks, weather, the near field's flakes, embers, fireworks, a ward's ring, the spirit
    lights' glows and motes, the life's motes, the lantern world's sprites. The ghosts' glass, wisps, aura and shadow,
    the rider's echo and the chaos spirits stay in the scene (only the scene's stencil keeps them off the rider), and so
    do the sky and the far ranges (`kept`: the lake's mirror bakes the sky with a lens of its own). Every other lens
    (the avalanche's mirror, Low, Medium) draws both layers in one pass as before.
  - *The dithers move*: while the reconstruction runs, the near-prop fade's dither and the soft shadow's tap rotation
    (`materials.ts`, one shared uniform `uNoiseFrame`, 0 everywhere else) move each frame, so the rebuild averages them
    into a fade and a penumbra. A near prop fades through MSAA coverage, as on round 7, wherever the scene is
    multisampled; with `?tmsaa=0` it falls back to the moving dither (`world.ts smoothFade`).
  - *Every pass that reads depth* reads it with the projection it was drawn with (`depth.ts aimDepth`'s `drawnWith`),
    and what is kept for next frame (the reprojection, the lens pass's motion, the ice's mirror) is the lens without
    its move. Checked one by one (`shots/vl/temporal/passes/`): the occlusion and Ultra's contact shadows, the shafts,
    depth of field, the lens pass's motion blur (it reads the rebuilt frame; the history never holds blur, so they do
    not double up), and Ultra's ice mirror (last frame's finished picture and the other scene target's depth: the trees
    and the rider stand in the lake as on round 7's path).
  - *It compiles on idle*: the two programs are built with three's `compileAsync` on idle time after the first frame;
    until they are, the composite's edge walk stands in (`FrameSignals.taaReady`). Nothing runs before the first frame.
  - *Switches*: `?post=-taa` is round 7's tier (its MSAA and the walk), `-scale` rebuilds from a scene at the frame's
    own size, `-sharpen` drops the sharpen; `?tscale=0.75`, `?tsharp=0.6` and `?taa` (any tier with a post stack) tune
    it; `?postview=taa` shows the rebuild's reading (red: a body's own motion, green: a disocclusion, blue: motion);
    `world.post.pipe.taa.k` holds the tuning.
- **Tuned by eye on the same replayed frames** (`efe095e`): a narrower reconstruction filter (4 per pixel squared,
  where a Blackman-Harris's 2.29 laid a half-pixel blur on every frame) and the stronger sharpen brought the trees at
  900 m back to round 7's crispness without its stair-steps; the scarf's own box.

- **Tools** (`scripts/playtest/`): `motion-vl.js` shoots the same frames of the same replayed run on any build (a
  pool rider as the player, a fresh save each time so the field is the same, a virtual clock in long steps to a
  lead-in and exact 1/60 s frames from there; each shot reports its sim tick, so a pair is the same moment when the
  ticks match). `pipe.js` takes `prime` (draws of the frozen frame before a still is shot and measured, so a history
  settles on it) and reports `grad` with the shimmer (the mean luma step between neighbours: a steadier frame bought
  with blur shows as a lower `grad`). `frames.js` takes `hold` (`FRAMES_HOLD=true` in `frames.sh`): on this loaded
  machine the fixed frames landed tens of metres late ("3548 m" read 3,641 m) because the run rode on while the shot
  was taken; with the hold the page stops on the frame the run reaches the distance.

## How it was judged

**In motion, by eye** (`shots/vl/temporal/motion/{before,after}/`, the same sim tick on both builds, High, the HUD
hidden; Pinecrest 900, 1763, 3464 m, Frostfang 1045, 1550, 2405 m, Ember 2271, 2441 m, Lanternfall 2209, 3500 m, each
with two more frames three apart; Old Town's are one or two ticks apart, everything else the same tick). Read at 2x to
3x:
- Frostfang's gondola cable at 2405 m is one continuous line where round 7's is a stair-stepped one, and the gondola's
  edges are clean.
- Pinecrest's trees at 900 m: round 7 crisp and stair-stepped; the first tuning steady but soft (a Blackman-Harris
  filter blurred each frame by half a pixel before it was blended); the shipped one (a narrower filter, sharpen 0.8) as
  crisp as round 7 without the steps.
- The rider at the lake (1763 m) is crisper than round 7's (the coat's panels, the saucer's rim). Its scarf, which
  streams outside the rig's box, was serrated until it had a box of its own.
- Ember's embers and sparks are round and unsmeared (drawn after the rebuild); the lava's crack lines are smoother.
- Draw calls: +2 on every frame against round 7 at the same tick (92 against 90 at Pinecrest 900 m, 101 against 99
  at 1763 m, 99 against 97 at Frostfang 2405 m, 110 against 108 at Ember 2441 m, 100 against 98 at Lanternfall
  3500 m). No console error or warning in any capture.
- The tuning was chosen on the same frames: this frame's share in motion 0.22 (aliased right after a fast pan) against
  0.12 (soft), the box's corners drawn halfway to the cross's (the bunting's dark specks), the filter and sharpen above.

**Shimmer, DECISIONS 287's metric** (`pipe.js`, `shimmer: 8`: a frozen frame drawn eight times with the lens moved by
parts of a pixel, the 99th percentile of each pixel's luma deviation, thousandths of white; Pinecrest 900 m trees,
1800 m the lake's cables, 3464 m Old Town's bunting; `prime: 16`, so the history has settled on the still frame;
`grad` is the mean luma step between neighbours, higher is sharper; a pixel ratio of 1, so High and Ultra rebuild at
the frame's own size; `shots/vl/temporal/measure/shim-*.json`):

| Frame | Round 7 p99 | Shipped p99 | Round 7 grad | Shipped grad | Before the critic (p99, grad) | `?post=-taa` in this build |
| --- | --- | --- | --- | --- | --- | --- |
| High 900 m | 95.4 | **61.2** (-36%) | 31.0 | 31.0 | 71.0, 33.1 | 88.6 |
| High 1800 m | 67.8 | **53.3** (-21%) | 25.9 | **28.3** | 62.7, 29.1 | 70.3 |
| High 3464 m | 84.5 | **65.6** (-22%) | 25.3 | **25.9** | 71.8, 28.0 | 88.0 |
| Ultra 900 m | 92.1 | **63.5** (-31%) | 31.6 | 30.6 | 70.2, 31.8 | 88.7 |
| Ultra 1800 m | 70.2 | **52.0** (-26%) | 27.0 | **28.2** | 64.2, 29.5 | 72.4 |
| Ultra 3464 m | 77.8 | **61.5** (-21%) | 24.4 | **25.9** | 71.4, 26.7 | 77.7 |

"Shipped" is the build after the critic's fixes (two MSAA samples under the rebuild, the confidence-led filter and
sharpen, the looser box). Steadier on every frame, and as sharp or sharper on all but Ultra at 900 m (30.6 against
31.6). `?post=-taa` in this build reproduces round 7's numbers, so the comparison is the reconstruction alone. With
four draws a shift (`settle: 4`) High reads 66.8, 57.0, 69.9. The build the first critic saw was a little sharper and
less steady (the sharpen ran at full strength everywhere); the first tuning of all read 60.7, 55.8, 73.7 against round
7's 86.5, 69.2, 84.6 on a different run, softer (a softer frame scores better on this metric: it is why `grad` is
reported beside it).

**The first critic** (a fresh agent, opus at xhigh, given only ART.md, 56 pairs and the question; `shots/vl/temporal/
pairs.txt`: 24 High fixed frames on all five mountains, 2 phone ones, 20 same-tick motion pairs and 10 crops of them
at 2x): "the world is steadier, but the hero's edges got worse." Better: the banding in the snow during camera beats
is gone, the white glitter is tamed, large silhouettes are smoother, the phone is clearly crisper; the same to a hair
softer on High's fixed frames. Worse, worst first: (1) the rider's, scarf's, hat's, pompom's, sled's and gondola's
outlines stair-stepped and fizzy in motion; (2) thin far lines (the lake's chairlift cable, the jump tower's struts, a
lamp post) breaking into dashes differently from frame to frame; (3) dark specks round far silhouettes; (4) things
missing (the crest blocks at Frostfang 1045 m in one frame, orange patches on Ember's slope at 2441 m); (5) teal
smudges at Ember's left edge; (6) a dotted dither on the phone rider's shadow; (7) holdovers in both builds.

What was done about each:
1. *The hero's edges.* An edge the rider had just uncovered had no history; it was drawn from this frame alone with
   the narrow filter (which leans on the history to fill in), stair-stepped, then sharpened at 0.8. The history now
   carries a confidence (its alpha); where it is low, this frame is rebuilt with a wide filter and the sharpen stands
   down. Same tick, 3x: the hat's outline and the pompom are smooth again, close to round 7's.
2. *Thin far lines.* The box was loosened (its corners a fifth of the way to the cross's where they were half, 1.05
   sigma in motion where it was 0.9), which kept the tower's struts whole, but the lake's chairlift cable was still
   offset dashes on the re-shot fixed frame: a cable thinner than a pixel is dropped by the rasteriser in some
   frames, and the history cannot follow a line the frame did not draw. So the rebuild now reads a scene drawn with
   **two MSAA samples** (`taaMsaa`, High and Ultra; `?tmsaa=0` for none): at the same tick the cable is one line with
   its chairs, and a freshly uncovered outline is anti-aliased in its own frame, which finished item 1. It costs
   what round 7's two samples cost at a pixel ratio of 1, and about half of it on a dense screen, where the scene is
   drawn at 0.7 of the frame (`shots/vl/temporal/dev/fix3/`).
3. *Dark specks.* Gone at the same tick (they were the sharpened, unaccumulated pixels of item 1).
4. *Missing things.* Ember's orange patches are absent in this build with the reconstruction switched off
   (`?post=-taa`) at the same tick too: not this lane's (they are the moment's own; Ember's ash and ember clumps are
   random). The crest blocks are there three frames later in the same pair: they are built on idle time.
5. *Teal smudges*: the drafting wake's mint motes, placed with `Math.random`, differ from run to run.
6. *The phone's shadow*: the phone is Medium, which this lane does not touch (nothing of the reconstruction runs there).
   An attempt along the way, writing the farthest of four depths for the after-draw, printed the spray behind the
   rider as specks along its outline; it is the nearest of four, as shipped.

## Shared code touched (each in its own function, with a comment saying why)

- `materials.ts` (the light and far-light lanes'): one shared uniform, `uNoiseFrame` (0 unless the reconstruction
  runs), declared in `LIGHT_GLSL`, and `+ uNoiseFrame * 5.588238` in the two interleaved-gradient dithers (the
  near-prop fade, `snowShadow`'s tap rotation). Nothing else.
- `rider.ts`: `motionParts()` and its boxes (`MOTION_RIDE`, `_BODY`, `_SLED`; the scarf's box from its points).
- `ghosts.ts`: `nearestPoses()` (the visible ghosts nearest the lens, allocation-free).
- `world.ts`: beyond the render targets and the lens: `smoothFade()` (coverage fade only where the scene is really
  multisampled), the after layer on the chase lens and the avalanche mirror's lens, the kept roots (sky, far ranges,
  overlooks), `feedBodies()` before the frame, `refade()` and the dev switches in `devPipe()`.
- `post.ts`: the scene targets (two in turn), the frame's and the scene's sizes, the composite's edge walk and texel
  set each frame. The composite's grade is untouched.
- `scripts/playtest/pipe.js`, `frames.js`, `frames.sh` (options only; their defaults behave as before), and
  `motion-vl.js` (new). `tests/pipeline.test.ts`.

## What the main lane must know at the merge

1. **The occlusion is laid on inside the rebuild** (`taa.ts` calls `pipeAO()` on this frame and shifts the variance
   box by what it changed), and the composite's `pipeAO()` returns at once where the rebuild ran. The light lane's
   crease light, if it lands in `pipeAO()`, flows into the rebuild with no change here, as long as `pipeAO()` reads only
   what it reads now (`tDepth`, `tAO`, `uAO`, `uAOTint` and `DEPTH_GLSL`); a new uniform there must also be added to
   the rebuild's material (`taa.ts`, beside `tAO`), or its program will not link.
2. **Far light's and the light lane's shaders**: anything new that dithers in screen space should add
   `uNoiseFrame * 5.588238` to its `gl_FragCoord` (it is rebuilt into a smooth result); anything that flashes per frame
   on purpose is taken as it comes only if it is brighter than lit snow (the rebuild's highlight rule).
3. **A new particle or glow system** needs nothing: point sprites and additive or premultiplied glows that write no
   depth move to the after layer on their first frame. One that must stay in the scene sets
   `object.userData.taaAfter = false`, or lives under a root in `post.pipe.after.kept`.
4. **Props lane:** near props fade through coverage as before (the scene keeps two samples); `smoothFade` follows
   the samples the scene is really drawn with, so with `?tmsaa=0` they dither and the rebuild averages it.
5. **Low and Medium** run exactly as round 7 (no jitter, no second target, `uNoiseFrame` 0, both layers in one pass).

## A note on this lane's own captures

For part of the afternoon this lane had more than its two browsers open: `playwright-cli` scopes sessions to the
directory it is called from, so `close` from the main checkout never reached sessions opened from the worktree, and
stopping a background capture stopped only its outer shell while its `frames.sh` loop ran on. At worst five sessions and
three capture loops of this lane were alive at once; the first fixed-frame set they produced was thrown away. They were
found and closed (by name, from the worktree) before the fixed frames were shot again, and every wrapper now closes its
own session. Frame rates from that window, this lane's or another's, should not be trusted.

COST AND SECOND CRITIC: TO FILL

## What is still short

- **Far wires thinner than a pixel** are whole again with two samples, but fainter than round 7's at a pixel ratio of
  1 (the lake's chairlift cable). At a pixel ratio of 1, two samples are what round 7 drew; the rebuild only adds.
- **The rider's outline** at speed is now close to round 7's and crisper inside; a faint pale edge can still show down
  the hat's right side against bright ice for a frame (the head and arms move inside the rig's box, which carries
  only the rig's rigid motion).
- **What moves on its own but is not in a box**: a ghost's wisp and aura (they stay in the scene under the rider's
  stencil and write no depth) are reprojected as the world; the variance box keeps them from trailing far, but a
  ghost passing close can leave a soft mint smear for a frame or two. A reactive rule round the ghosts' screen boxes
  would cover it.
- **Medium's trial is not shipped** (see the cost section): it is far steadier, and it costs two full-frame passes
  the phone's budget does not have unless the scene is drawn smaller.
- **Not seen in a person's hands**: everything here was judged on still frames and on single frames of a replayed
  run. Whether the rebuild's softness right after a hard cut (a camera snap, the first frame of a beat) reads as a
  blink at full speed wants a person playing.
- **Not priced on a quiet machine**: the GPU times below were taken with five lanes' browsers open; the scene's own
  time does not repeat run to run (DECISIONS 287 said the same of round 7's).

## Where the frames are (`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\vl\temporal\`)

- `after/{high,low,phone-medium}/`: the fixed frame set (frames-r7.json, all five mountains), shot with the hold, on
  the build the first critic saw; `after-v2/high/`: the frames the critic flagged, again on the shipped build.
  Before: `shots/r7/final/`.
- `motion/{before,after}/`: the same ticks of the same replayed run (Pinecrest, Frostfang, Ember, Lanternfall);
  `motion/after-v1/` is the set the first critic saw; `motion/crops*/` its enlargements.
- `pairs.txt`, `pairs2.txt`: the two critics' pairs. `sheets/`: before beside after, a mountain and a tier a sheet.
- `measure/`: shimmer and GPU time reports (JSON). `passes/`: every depth-reading pass. `dpr2/`: a pixel ratio of 2.
  `dev/`: the tuning A/Bs (`ab/`, `sharp/`, `fix1` to `fix3/`) and the hold test (`dev/hold/`).
