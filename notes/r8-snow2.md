# Round 8: snow, second attempt (the snow2 lane, V1)

The item: "The snow looks like you could put your hand in it." The first attempt (`notes/r8-snow.md`, DECISIONS 372)
left three things held off (corduroy ribs, painted pillow faces and hollows) and the bar unmet. Its advice was relief
from geometry before paint, a groomed lane told by value, glitter gathered toward the sun, and judging the snow alone
with the ghosts hidden. Render only: nothing here reaches the sim.

Branch `r8-snow2`, worktree `.claude/worktrees/r8-snow2`, cut from `round-8` at 06ff2cc. Commits: a7605be (the switch),
1ea587e, 9edc40a, a32f430 (judged), d63addb (two fixes after the judging). Build `dist/r8-snow2`. The before is
06ff2cc plus the switch (`dist/r8-snow2-before`, also served at `/before/` beside the after while working). Frames are
under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/snow2/`.

## Where it stands

**The bar is not met.** Three fresh critics judged ten snow-only High pairs each, on held stills with the ghosts
hidden, each on a newer build. They picked the new frame 4, then 5, then 7 times of 10. The third named the snow in its
reasons unprompted: "more carved relief, with lit crests and blue lee faces like sastrugi", "more gold glitter
gathering toward the sun", and wind patterns that are irregular where the old bank had "evenly spaced parallel ribs".
The phone (6 of 10) and Low (5 of 10) were read as level, which the brief allows for them. With the ghosts in, the
critic picked the new frame 4 of 10, and every reason was a ghost, a petal or a pose, never the snow. On motion
strips the new sheet won 3 of 4.

Every critic said most pairs were nearly the same picture. This is a modest, real lift on High's banks and in its
glitter. It is not yet the hero material the item asks for. "Still short" below is the useful part for a third attempt.

## What changed for a player

1. **A switch to judge the snow alone** (`world.ts hideGhosts`, dev only, `?debug&ghosts=0`). It leaves out the
   ghosts, their light, ruts and labels, the drafting wake, a ghost's stomp ring and a pass's shards. The race and its
   beats run as before. Every snow-only pair here was shot with it.
2. **The wind's relief, as forms the light draws** (`snowrelief.ts`, new; the snow material's own chunk and main in
   `materials.ts`). Two small tiles (256 by 256 RGBA8: a height and its slope along two axes) are baked once on idle
   time after the first frame. They are world-anchored and repeat without a seam.
   - *Powder's pillows*: rounded mounds 5 to 10 m long, lying 30 degrees off the fall line and shouldering each
     other on a slow swell. They are 0.8 m high on a bank, a third of that on the floor a sled rides, and a whisper on
     a groomed lane. My first shape (isolated ellipses with a squared falloff) drew each pillow as an egg's outline. The
     falloff is now cubic and wide enough for them to merge.
   - *Sastrugi*: round 7's ridges, the same sawtooth, baked in fields and broken into lengths, now with their own
     shadows. They all but go in a cast shadow, because there the frame's motion blur turned their creases into dark
     scribbles.
   - *Shadows from the forms*: the height is marched five steps toward the key light. The light's slope is measured
     over the ground's own plane and held low, at 0.18 to 0.32, or at 0.6 of the real slope where the light stands
     well over a face. So the relief is drawn as a low sun draws it, on the key's own bearing, and a face the light
     stands high over keeps most of its light. Ground turned from the light or grazed by it takes none: laid over a
     grazed bank, these shadows made a blue puddle of it.
   - *Light on the forms*: each form turns toward the light and away from it whatever the sun's height, softly in
     shade. Where a flank mirrors the sun toward the eye it takes a sheen.
   - *Kept underneath*: round 7's wind slab and the first attempt's small pillows (in the normal only; their paint stays
     off). Critic one read the snow without them as "a nearly featureless smooth sheet".
3. **Glitter gathered toward the sun, by day.** More facets are candidates, with a wider lobe, on the sunward side of
   the frame (`uRelief.w`, 1.1), always in the light's own colour. At night the moon's glitter is already dense, and
   more of it read as noise, so the gathering is off there.
4. **A leap's landing's corduroy** is a lighter step (its broad swaths 0.3 to 0.12), and Low keeps its fine ribs off.
   The flow lane's critics read it as dunes and stair treads, worst on Low. This came after the judging, so no critic
   has seen it.
5. **Low** draws no relief and never bakes the tiles. Its snow is round 7's (painted slab and all) plus the glitter's
   gathering. On Low the relief read as pale egg shapes under the poster's values, and Low's budget is CPU at 6x.

## The critics

Each critic was a fresh general-purpose agent on Opus at high effort. It got only ART.md's path, a pairs folder and the
brief's question. `blind-pairs.mjs --max 10` cut the pairs from 36 snow-subject frames a tier (bowls, cruises, tree
runs, chutes, forks, ravines, the lake; the list is `.snow2/frames-sub.json` in the worktree), against my own before.
From pass two on, each mountain's first frame (z 150) is left out: a still's autoride starts at boot, so the tiles are
not yet baked there. A player meets the title screen first, which leaves the bake time to finish.

| Pass | Build | Tier | New picked | Folder |
|---|---|---|---|---|
| 1 | 1ea587e (the relief replaced slab and sastrugi) | High, ghosts hidden | 4 of 10 | `pairs-sg1` |
| 2 | 9edc40a (slab back, softer pillows) | High, ghosts hidden | 5 of 10 | `pairs-sg2` |
| 3 | a32f430 | High, ghosts hidden | **7 of 10** | `pairs-sg3` |
| 3 | a32f430 | phone (Medium), ghosts hidden | 6 of 10, level ("no pair shows a clear change in the snow") | `pairs-phone1` |
| 3 | a32f430 | Low, ghosts hidden | 5 of 10, level | `pairs-low1` |
| 3 | a32f430 | High, ghosts in | 4 of 10 (every reason a ghost, petal or pose) | `pairs-ghosts1` |
| 3 | a32f430 | motion strips, 8 frames over 0.7 s, High, ghosts in | 3 of 4 | `pairs-motion1` |

Keys and picks for each pass are in `keys/` (`pairs-*.json`, `picks-*.json`).

What each critic said, and what I did about it:

- **Critic one (4/10).** The new snow was flatter where the old had wind-slab swells, and the old won those pairs. The
  old lost one pair for its "washboard" of regular bands on Sakura. I put round 7's slab and the small pillows back
  under the relief. The relief I had replaced them with was weaker at middle distance.
- **Critic two (5/10).** The glitter toward the sun won two pairs. It lost one as "confetti" at golden hour and one as
  noise at night. The old lost the Sakura pairs where its banks are ribbed. I made the gathering daytime only and
  lighter (1.5 down to 1.1).
- **Critic three (7/10).** The new snow won on carved banks, glitter toward the sun and the ribs being gone. It lost on
  a near tree's build (the forest's idle timing, not the snow), on "long thin white streaks" low in one frame that
  read as lens scratches, and on a coin flip. The streaks are probably the relief's sheen or glints smeared by the
  motion blur; not fixed.
- **Motion (3 of 4).** The new sheet won for glints and relief on a lit bank, for glitter across Sakura's field, and
  for a landing whose powder stayed low; that last is likely the particles' own randomness. It lost on Ember, where
  "a grey-lavender" lit bank had replaced the old "firelit cream and peach". That one was mine: the relief's low light
  cast shadows across a bank the real light stood high over. Fixed in d63addb (a face well under the light keeps
  most of it) and checked by eye on the same frame, not judged again.
- **Not counted against either side:** the horizontal banding (High's occlusion pass, fixed on round-8 at bf76cc7 and
  still in this base), the radial blur and lens scratches, grey spray that reads as smoke, flat confetti shards and
  out-of-focus flakes. Many picks also turned on things that differ between two shots of one tick: the rider's pose
  after a pass beat, the scarf, the spray, the near forest's build, the ward's shards.
- **Found in my own iterations first** (`it1` to `it4`, `var1`): relief strong enough to see turned into dark
  scribbles under the motion blur on a bank in shadow; isolated pillows read as eggs, worst on Low; and a low virtual
  light over a grazed bank made a blue puddle.

## Cost

- **Draws, triangles, programs:** none added on any tier. No mesh, pass or program is new. The terrain is unchanged.
  The snow material gains two samplers and two vec4 uniforms of its own; none goes in `shared`, and none is an array.
- **Low's GL calls a frame** (`glcount.js`, a 10 s autoride on Low, two rounds each; raw output in `cost/gl-*.json`):

  | | Before | After |
  |---|---|---|
  | Pinecrest | 507.0, 489.3 | 488.7, 503.8 |
  | Ember | 497.0, 505.1 | 508.2, 498.0 |

  These are level within the ride's own spread of about 15. `drawElements` is level (21.4 against 21.3, 22.4 against
  22.7). Low never bakes the tiles or reads them.
- **High's snow pass on the GPU** (`.snow2/gpuprobe.js`: the scene pass at a held frame with the terrain shown,
  hidden, and shown without the relief, three times each, before and after; raw output in `cost/gpu-*.json`). The
  readings swung from 1.5 to 12 ms between repeats of the same held frame, and the terrain hidden sometimes read
  higher than shown. They prove nothing either way.
  - *What the shader adds, per terrain pixel within 110 m on Medium and above:* 2 texture reads for the forms, 10
    for the shadow's march (5 steps, 2 tiles), and a few dozen ALU. The 8-hash pillow noise was in the before already.
    Round 7's 9-call bank sastrugi noise is gone (it is a texture read now).
  - **High's 60 fps needs the main lane's quiet sitting.** If the relief costs too much, the first things to cut on
    Medium are the march (5 steps to 2, as Low had before it was turned off) and the sastrugi tile.
- **CPU:** the bake runs once, in slices of at most 4 ms on idle time after `gs-first-frame`, about 200 ms in all (both
  tiles, timed in node). Nothing runs before the first frame, and no frame does anything new.
- **Console:** clean in every capture: 15 still runs, 10 ghosts-in runs, 8 strip runs, 6 check runs, and the cost
  runs.

## Low and the phone

- **Low** is round 7's snow: the painted slab, no relief, no tiles, and the glitter gathered by day. A critic read it
  as level (5 of 10). Its picks turned on spray, petals and a terrace's pop-in timing.
- **The phone** (Medium) draws everything High does. A critic read it as level (6 of 10) and said that on a tall frame
  the snow looks the same. On the phone the near snow is under the frame's motion blur, and my relief is gentle under
  the lens there by design, after the first attempt's phone failures.
- **Reduced motion:** nothing here moves. The relief and the glints are static and anchored to the world.

## Touched outside my files

- `src/render/world.ts`: `hideGhosts` and the `ghosts=0` switch, dev only.
- `src/render/materials.ts`: only the snow material and its chunk. No change to `LIFT_GLSL`, `LIGHT_GLSL`, the palette
  or `shared`.

## For the main lane to decide or wire

- **Nothing to wire.** The bake starts from `makeSnowMaterial`.
- **The two fixes after the judging** (the light kept on lit faces, the lighter landing corduroy) are in d63addb and
  have not been judged by a critic. If the main lane wants only judged work, a32f430 is the judged build.
- **The coordinator's Low streaks at Pinecrest 600 m** (`shots/r8/flow/flow6e/low/m0-z0600.png`) are not from this
  branch. On Low my build draws the base's snow, and the before still at that frame shows them only faintly.
  They appear in the flow lane's build, so look there first (a lower lens over round 7's painted slab or sastrugi is
  a guess I have not checked). The landing's corduroy, which the flow critics read as stair treads at 2700 m, is in
  the snow material, and d63addb softens it.
- **ART.md section 4's "Three snows" paragraph** names `PILLOW_FACE` and `PILLOW_HOLLOW`. Those constants are gone; the
  text to replace them is below.

## Still short, and what a third attempt should try

- **The bar is 9 of 10.** I reached 7. The pairs are close because a still at speed is mostly the motion blur's: any
  relief near the lens turns into radial streaks, which read as speed lines or scribbles, so the relief must stay
  gentle exactly where the snow is largest in the frame. The same snow with the speed lane's lighter blur, if that
  merges, may read better than this judging shows. Re-judge it there first.
- **Glitter toward the sun was the clearest single win**, and its own risk ("confetti", "noise"). A third attempt
  should judge it as a separate variant (`?debug&rg=`) on golden-hour and night frames.
- **Relief from geometry**, as the brief asked, was not attempted. The drawn surface may only move off the corridor
  (past 10.5 m), where few frames look. Cornices at a bank's crest are the place to try it.
- **The white streaks** one critic read as lens scratches, low in a Mirror Lake frame: probably the relief's sheen
  under the blur. Try the sheen from 12 m, not 4.
- **Nothing in the moving snow changed** (spindrift, a ghost's hanging powder, the landing ring). The motion critic
  saw them for the first time and named only the grey spray that reads as smoke at night and on Ember.
- **The tools** (dev URL switches, not shipped as a look): `?debug&rk=pillow,sastrugi,form,sheen&rg=gather` sets the
  relief and the glitter from the page's query, so variants are shot from one build.

## Text to fold into ART.md (section 4) and the README

> **Round 8: the wind's relief.** Powder lies in pillows a few metres across, lying 30 degrees off the fall line,
> and round 7's sastrugi in fields. Both are forms the light draws, not paint: each turns toward the key light and
> away from it, casts its own shadow by a low light on the key's bearing, and takes a sheen where a flank mirrors the
> sun. They are whole on the banks, gentle on the floor a sled rides and under the lens (where motion would smear them
> into streaks), and a whisper on a groomed lane. The sastrugi go in a cast shadow, and so does the relief's own
> shadow wherever the ground is turned from the light. The glitter gathers harder toward the sun by day. Low keeps
> round 7's painted slab and no relief. (This replaces the held-off `PILLOW_FACE` and `PILLOW_HOLLOW`; a leap's
> landing keeps its corduroy, a lighter step.)

README ("Round 8"): the second snow pass adds wind relief that the light draws (pillows and sastrugi with their own
shadows and sheen, baked once on idle) and glitter gathered toward the sun. It adds no draw. Low is unchanged.

## Where things are

- **Before stills, ghosts hidden:** `before-sg/{high,low,phone-medium}`. **After:** `after1-sg` (critic one's build),
  `after5-sg` (critic two's), `after6-sg` (critic three's, the phone's and Low's), `chk/final` (d63addb, three
  frames). **Ghosts in:** `ghosts/{before,after}`.
- **Strips:** `strips/{before,after}`. **Pairs:** `pairs-*`, with keys and picks in `keys/`. **Cost:** `cost/`.
  **Iterations:** `it1` to `it4`, `var1`.
- **Helpers** (not committed, in the worktree's `.snow2/`): a stills subset and variants script, the strips, the GPU
  probe, the cost run, a PNG reader for side by sides.
- **Tests:** `tests/snowrelief.test.ts` (the tiles repeat seamlessly, hold forms and not noise, store slopes that agree
  with their heights, bake in slices; the relief is the snow material's alone, off until baked).
