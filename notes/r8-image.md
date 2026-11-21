# Round 8: the image lane (V7, a stable, clean image at High)

Lane `image`, branch `r8-image` cut from `round-8` at `dd6fa19`, `round-8` merged in at `bf76cc7` (the occlusion
pass's scanline fix) before any pair was shot, so every pair differs by this lane's work alone. Port 4860, session
`r8-image`. Render only: nothing in `src/sim`, `src/bot` or the pools changed, and nothing moves where anything is.
Colour roles untouched.

## What a player gets

On High and Ultra the picture is rebuilt from the frames before it (the visual lift's temporal reconstruction, held
back in DECISIONS 363), so thin things (tree edges, cables, bunting, rails, the snow's glitter, far ridges) hold still
in motion where round 7's 2x MSAA and edge walk let them crawl, and the rider is drawn crisp over the rebuilt frame,
exactly as round 7 drew it, so it is never softer at speed than standing still. What moves on its own (lift chairs and
gondolas, birds, deer and skiers, flags) is drawn after the rebuild, so none of it trails or doubles. Medium, Low and
the phone are unchanged.

## The decision: two paths, judged blind in motion

Both paths were built and shot as strips (eight consecutive frames of a pool rider replayed on a virtual clock from a
fresh save, `scripts/playtest/image-strips.sh`/`.js`, tiled as 1:1 crops of 640 by 360 with the rider at their foot,
`image-tile.mjs hero`), High at 1280 by 720, against this lane's own base (`bf76cc7`), eleven strips on all five
mountains: Pinecrest 290 m (a dash at flow 6), 900, 1763, 3464 m; Frostfang 1045, 2405 m; Ember 2441 m; Sakura 1301,
2580 m; Lanternfall 2209, 3500 m. Two fresh critics (opus, high effort), each given only ART.md, ten pairs and the
brief's question:

| Path | Pairs | The new strip picked |
| --- | --- | --- |
| 1. The reconstruction, finished (below) | `shots/r8/image/pairs1-taa` | **8 of 10** |
| 2. The spatial path: High at 4x MSAA with the edge walk | `shots/r8/image/pairs1-spatial` | 4 of 10 |

After the fixes (the birds below), the shipped build (the reconstruction on by default) against the base on ten new
strips (Pinecrest 1050, 2429, 3548 m; Frostfang 595, 1550 m; Ember 1039, 3741 m; Sakura 970, 4076 m; Lanternfall
1138 m), a third fresh critic: **7 of 10** (`shots/r8/image/pairs2`). The bar was 7 of 10 with nothing named smeared,
doubled or soft on the rider: no critic named the rider soft, haloed or smeared on the new side; the second named the
new side "softer through the centre band" and "smears the bases of the near trees" in one strip (a saucer flip over a
gantry at Pinecrest 1050 m, the lens turning fast), and the first "a little softer far away" on every pair (and
steadier from frame to frame, most in the slow shots). Its other two picks against the new side were the scarf's own
fold and a ghost's pill, which differ from run to run. Its one pick for the new side on the image itself: Temple
Town's roofs and windows "smoother and steadier from frame to frame" where the base's "crawl".

**The spatial path** is what High draws today made steadier without history: the scene at 4x MSAA (Ultra's) under the
same edge walk. On DECISIONS 287's metric it buys 6.5% at Pinecrest 900 m (85.9 against 91.9) at the same sharpness;
its critic could not tell it from the base (it picked on the scarf's own motion, which differs run to run, and called
pair 10 "essentially a coin flip"; mean difference between the sides about a fifth of the reconstruction's). A
geometric treatment of wires thinner than a pixel was not built: cables, bunting and rails live in a dozen kits merged
into shared materials, and no spatial filter can redraw a line the rasteriser dropped (DECISIONS 287). The
reconstruction won; the spatial path ships nothing (its dev switch `?msaa=4` stays).

## What was done to the reconstruction, and why

DECISIONS 363 named what it needed. Each item, with the reason a player would feel:

1. **The rider kept out of what is seen of the history** (`postfx/after.ts` `HERO_LAYER`, `hero()`; `taa.ts`
   `setSamples`, the present pass's depth; `post.ts aimHero`; `rider.ts heroRoots`; `world.ts feedBodies`). The
   rider's opaque parts stay in the scene (its depth, the occlusion, the shafts and the stencil that keeps every
   ghost off it, contract C10, are the scene's as before) and are drawn a second time over the rebuilt frame, at the
   frame's own size with the tier's MSAA (High 2x, Ultra 4x: the rebuilt frame is now a multisampled target, resolved
   once a frame). The rebuild's own rider underneath is never what is seen: the softness and the pale halo the second
   critic named cannot reach it, and on a dense screen (where the scene is drawn at 0.7 of the frame) the rider is
   drawn at the screen's full size. The scarf is drawn again only while Spirit Flow is not burning on it (the flame is
   the scene's, laid over the scarf by its stencil; the scarf drawn over it would leave it burning at its edges). A
   part that blends (none today) would be drawn once.
   *Depth:* the present pass writes the scene's depth at the frame's size as the nearest of four scene pixels; on a
   sloped coat that is nearer than the coat at a pixel's middle, and the second drawing failed its own depth in
   patches. Inside the rider's box on screen and only at the rider's own distance (`uHeroRect`, `uHeroDepth`, from
   its motion boxes) the depth is pushed back by the four's own spread, at most 3% of the distance. (First built for
   the whole box on screen: the first critic found "black and grey rectangles tumbling beside the rider" on Sakura at
   2580 m, birds sitting in the snow beside it showing through the snow. Now only at the rider's own depth.)
   *Measured:* the rider's sharpness (the mean luma step inside its box on screen, `image-measure.mjs`, the box from
   each frame's own projection) over the eleven strips: +10.0% on the first set and +10.1% on the second (45.3 to 49.9 thousandths of white), every strip sharper
but one (Ember 3741 m, -1.9%). The crops (`s2/taa/rider2x`) show the coat's panels, the
hood's fur and the saucer's rim as round 7 draws them.
2. **Motion for what moves on its own** (`after.ts adopt()`; `life.ts movers`, `landmarks.ts movers`). The lift
   lines' chairs and gondolas, and life's birds, cable chairs, figures (deer, hares, a fox, skiers, the snowboarder who
   rides alongside) and flags are drawn only after the rebuild, at the frame's size with the tier's MSAA,
   depth-tested against the world and writing their own depth for the sprites after them. The history never holds
   them, so they cannot trail or double (the doubled gondola and chairs of 363), and it holds the world behind them.
   Nothing is drawn twice; every other lens (the mirror, Medium, Low) draws both layers as before. None casts a shadow
   (none did). The ghosts keep their motion boxes (they live under the C10 stencil, which only the scene knows); the
   charm gates' light, Spirit Flow's wind and sparks, a ward's shards, the perfect's light and every sprite were
   already drawn after the rebuild (premultiplied or additive, found on their first frame).
3. **Disocclusion** (a crest's blocks missing for a frame, 363): the visual lift's own note found the blocks are built
   on idle time and arrive a few frames late with the rebuild off too; nothing more was done. With the rider drawn
   again, the history behind it no longer matters to the picture.

## Shimmer and sharpness (DECISIONS 287's metric, `pipe.js`)

A frozen frame drawn eight times with the lens moved by parts of a pixel, the 99th percentile of each pixel's luma
deviation (thousandths of white), after 16 draws so a history has settled; `grad` the mean luma step between
neighbours (higher is sharper). Pinecrest 900 m (trees), 1800 m (the lake's cables), 3464 m; Ember 1039, 2441 m.
1280 by 720 at a pixel ratio of 1 (the scene at the frame's own size). Same sitting, base and shipped builds one
after the other (`shots/r8/image/pipe2-*`, reports in the lane's scratch folder).

| Frame | Round 7 (base) p99 | Shipped p99 | Base grad | Shipped grad |
| --- | --- | --- | --- | --- |
| High, Pinecrest 900 m | 89.3 | **67.1** (-25%) | 29.6 | 31.3 |
| High, Pinecrest 1800 m | 63.1 | **53.0** (-16%) | 26.2 | 28.8 |
| High, Pinecrest 3464 m | 49.3 | **44.9** (-9%) | 19.0 | 19.9 |
| High, Ember 1039 m | 59.3 | **51.2** (-14%) | 16.8 | 18.8 |
| High, Ember 2441 m | 60.9 | **58.8** (-3%) | 17.4 | 20.3 |
| Ultra, Pinecrest 900 m | 89.3 | **63.4** (-29%) | 30.1 | 30.9 |
| Ultra, Pinecrest 1800 m | 61.1 | **50.2** (-18%) | 26.8 | 28.1 |
| Ultra, Pinecrest 3464 m | 43.0 | **41.8** (-3%) | 17.8 | 19.3 |

Steadier on every frame and sharper by `grad` on every frame. The spatial path (4x MSAA and the walk) at 900 m: 85.9
against 91.9 in the first sitting (-6.5%), grad 29.8 against 30.0. The visual lift's reconstruction without this
lane's work (`?post=-hero`) reads the same as the shipped one on these stills (70.7, 52.9, 41.0 against 69.0, 53.4,
42.4 in one sitting): this lane's work is on the rider and what moves, which a frozen frame does not show.

## Cost

Same frames, same sitting, the frames' JSON for draws and `?gpu` (`__gs.world.post.pipe.timer.ms`) for pass times,
1280 by 720. The machine was shared with other lanes, so a pass's own time is good to about a millisecond and the
scene's time moves run to run; frames per second were not judged (only the main lane's quiet sittings count).

| | Base (round 7's AA) | Shipped |
| --- | --- | --- |
| High draw calls, mean of 88 strip frames (11 strips, five mountains) | 103.1 | 110.7 (+7.6: the rebuild's two passes and the rider drawn again) |
| High triangles, the same frames | 948,870 | 953,840 (+0.5%) |
| High, Pinecrest: the rebuild + what is drawn after it | (edge walk in the composite) | 2.3 + 0.75 ms; composite 0.4 ms less |
| High, Ember: the same | | 2.4 + 0.7 ms |
| High, Pinecrest, all timed passes | 19.3 ms | 21.9 ms (scene 15.9 and 15.8) |
| Ultra, Pinecrest, all timed passes | 16.4 ms | 15.7 ms (the scene drops from 4x MSAA to 2x: 13.4 to 11.1 ms) |

In the first sitting (quieter) the rebuild read 1.66 ms and the after pass 0.51 ms on High (0.29 ms without the
rider drawn again), the visual lift's reconstruction 1.41 ms. So on High at a pixel ratio of 1 the shipped image costs
about 2.2 to 3 ms of GPU a frame more than round 7's (the rebuild, the rider again with its MSAA resolve, less the
composite's walk); on Ultra it is level or cheaper. On a dense screen High draws the scene at 0.7 of the frame and the
reconstruction pays for itself (the visual lift's notes). **Whether High holds 60 fps at a pixel ratio of 1 on the Arc
130V with ~2.5 ms more is for the main lane's quiet sitting to say**; if it does not, `taaMsaa` 0 on High (the
rebuild without MSAA under it, the rider still drawn with it) is the first lever. Nothing new runs before the first
frame: the programs compile on idle, and until they are built the composite's walk stands in. Console: clean in every
strip and probe (High on all five mountains, Ultra on Pinecrest, a cold start each load).

## Low, Medium and the phone

Unchanged: the reconstruction runs only where `PASSES` has `taa` (High, Ultra), and every hook (`feedBodies`, the
adoption, the hero layer) returns at once elsewhere. Low draws no post pass; its GL calls are not touched (no shared
material, uniform or program changed). Medium and the phone keep the edge walk. A frame where the programs are not yet
built (they compile on idle after the first frame) draws round 7's walk, as the visual lift built it.

## Reduced motion

Nothing here moves anything: the jitter is inside a pixel and the rebuild holds it still.

## Touched outside my files

- `src/render/rider.ts`: `heroRoots()` (the hero's roots and whether each is drawn again this frame).
- `src/render/life.ts`: `get movers()` (and `Object3D` imported as a type).
- `src/render/landmarks.ts`: `get movers()`.
- `src/render/world.ts`: `feedBodies()` hands the hero and the movers to the after layer; `devPipe()` `?msaa=N`.
- `src/render/post.ts`: `aimHero()` (the rebuilt frame's MSAA follows the tier's).
- `tests/pipeline.test.ts`: the reconstruction ships on High and Ultra; the hero and movers' layers.
- `scripts/playtest/`: `image-strips.sh`, `image-strips.js` (speedstrips.js with the rider's box), `image-tile.mjs`,
  `image-measure.mjs`, `image-pipe.sh` (new).

## For the main lane

- **Fold into ART.md 9 and 15 ("Tiers, designed", "The visual lift")**: "Anti-aliasing: Low the canvas's own MSAA;
  Medium the edge walk; High and Ultra rebuild each frame from the frames before it (the scene with 2x MSAA, jittered
  inside a pixel), the rider drawn again over the rebuilt frame with the tier's MSAA (2x, 4x), and what moves on its
  own (lifts, birds, figures, flags) drawn after the rebuild." and replace "Anti-aliasing is round 7's" with: "Thin
  things hold still in motion: High and Ultra rebuild each frame from the ones before; the hero is drawn crisp over
  it, never from its history."
- **README**: High and Ultra's anti-aliasing is the temporal rebuild; `?post=-taa` is round 7's; `?post=-hero` the
  visual lift's reconstruction without the hero drawn again or the movers adopted.
- **Decide**: whether the frame-rate sitting (milestone 4) should include High at a pixel ratio of 1.5 to 2 (the
  scene then draws at 0.7 of the frame, cheaper than round 7's; this lane measured only at 1).
- **Wire**: a new opaque thing that moves on its own should be handed to `post.pipe.after.adopt()` (or join a
  `movers` list), or it will trail a little in the history; a new part of the rider is found on its first frame.

## What is still short

- **Softer far away and in a fast turn.** Both critics saw it: the far planes a little softer, and in a saucer flip with
  the lens turning fast the middle band and the near trees' bases softer for a few frames. The rider never. The
  sharpen (High 0.8, Ultra 0.7) and the share of this frame in motion (0.16) are the levers; not tuned here.
- **The pom-pom** blends (a soft fluffy part): it is the rebuild's, not drawn again, and reads a little softer than
  round 7's.
- **The ghosts** keep the visual lift's motion boxes (their glass is under the scene's stencil); a ghost passing
  close can still leave a soft mint smear for a frame (the visual lift's note). Not named by either critic.
- **Not judged:** Ultra by a critic (measured only), a pixel ratio above 1, a person playing it at full speed (whether
  the softness after a hard cut reads as a blink), the phone and Medium (unchanged).
- **Movers not adopted:** a crowd's wave, set pieces' own animations and the great lantern walking its yoke stay in
  the history (slow, inside the variance box); a new one is one `adopt()`.

## A fault in this lane's own tooling, owned

The first capture (`shots/r8/image/s1`, the `dd6fa19` base and the visual lift's reconstruction) ran without a
browser slot: `image-strips.sh` took the slot, the take timed out after 40 minutes, and the script went on. About ten
minutes of one headless browser beside another lane's. The script now stops if it has no slot. Its frames were used
only to look, never paired.

## Where the frames are (`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r8\image\`)

- `s2/{base,taa,spatial}/frames/` and `m<m>.json`: the first set of strips (with each frame's rider box and draw
  calls); `s2/tiled-hero/`: their 1:1 crops; `pairs1-taa/`, `pairs1-spatial/`: the first critics' pairs.
- `s3/{base,taa}/`: the second set (new metres), `pairs2/`: the second critic's pairs.
- `keys/`: the pairs' keys and the critics' picks. `pipe-*`, `pipe2-*`: shimmer shots and reports.
- `s1/`: the first look (dd6fa19, no slot; not paired).
