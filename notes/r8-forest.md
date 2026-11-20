# Round 8: the forest lane (V2, a forest that holds up at the lens)

Branch `r8-forest`, cut from `round-8` at 6be2fd2; round-8 merged in for the stills and again at f784510 (play, screens
and snow). Brief: `notes/r8-briefs/forest.md`. Everything shot is under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/forest/`. The final set is `r2/`:

- `r2/before/{high}` and `r2/after/{high,low,phone-medium}`: stills (stills.sh's held run). Before is round-8 at f784510
  built here (`dist/r8-forest-before`), after is this branch at 923fb0d (the hand-over's cut, e867c50, landed before it).
- `r2/sst/{before,after}-<tier>-m<N>.json`: the flat-triangle measure and each still's draws and triangles
  (`shards-stills.js` on the stills' held run); before Low and the phone are draws and triangles only.
- `r2/close/{before,after}`: close passes by the run's edge (`closepass.js`), the same steps on both builds.
- `r2/cost/`: GL calls a Low frame (`glcount.js`).
- `pairs-1` to `pairs-5`, `pairs-close`, `pairs-close2`, with `key-*.json` and `picks-*.json` beside them.
- Earlier: `stills/`, `stills-pass2/` (the lane's own stills against the round's first before stills),
  `after1/` (frames.sh, before the stills existed), `shards/` and `sst/` (the first measures, against the round's first
  before build `dist/r8-before`), `cost/` (the first cost probes), `comet/` (Comet Bob), `try*/` (working shots).

## What a player sees

- **Trees at the lens are trees.** Within about 26 m of the lens a spruce is drawn again from a near build of the same
  tree: each tier is layered boughs (each a lobe that swells to its tip and droops, a notch between it and the next, a
  shorter layer of boughs under the notches), a lip of thickness at the bough ends over the dark underside, and a shelf
  of snow lying out along each bough's top as a thin crust, its edge a wavy line along the bough that folds down in a
  band of the snow's shade. A barked trunk, dead stubs under the lowest boughs, a tree well at the foot. Facets are
  about a third of a metre and flat (a hazard's, ART.md 3) where the far tree's run past a metre. Sakura's blossom at
  the lens is its canopy a step rounder (its big puffs subdivided once more) and its cedars are near spruces in cedar
  green carrying less snow, the ink spine the blossom glows against. The run's own pines, the forest wall and a tree
  run's crowded rank hand over; Lanternfall's ink conifers too. High, Ultra and a phone held upright draw the fine near
  build (about 3,800 to 4,500 triangles a spruce); Medium on a wide screen a leaner one (about 2,000 to 2,500); Low keeps
  its own trees.
- **The far tree and the near one are one tree.** The near build keeps the far tree's tiers, height, reach, snow and turn
  segment for segment (`tests/nearforest.test.ts` holds the outline within about a quarter of a metre at every height),
  and a tree is handed between the two at 26 m from the chase lens, whole, in every pass (the mirror and the ice's
  reflection split the forest by the same distance), where only what is inside its outline changes.
- **Nothing fills the frame's side as a shard.** A tree beside or behind the rider goes whole before it can (High and
  Medium at about 4.2 m from the lens, Low at about 6.2 m): solid, then gone in the few tenths of a metre a frame carries
  the lens, never stippled and never a milky dome. A tree ahead of the rider is a threat and stays solid however near.
  What a sled passes in the open is cut finer: Frostfang's ice spire (eight sides and five courses, its two satellites
  seven and six), Lanternfall's standing stone (seven sides, five courses), a tunnel's and a cavern mouth's big rock
  masses (a step finer, jittered less), the ice bridge's parapet blocks, and every bridge's deck-edge beam in two courses.
- **Life in it** is round 7's, now on the near trees too: the wind's fronts and the bough bob move the near build as
  they move the far one (the same instance phase and formula), and a shaved or passed tree shakes and sheds its snow on
  the near-miss beat (`spirit.ts` calls `TreeLife.nearMiss`; `world.ts` `shedSnow`). Reduced motion stills the wind on
  both builds (one shared uniform); the hand-over and the lens's dissolve are not motion and stay.
- **Comet Bob reads as a sled.** A racing bob in violet lacquer: the classic sled's five slats (its underside drawn as the
  classic sled's), cream-pinstriped sideboards, a cowl over the nose that the boots go under, a cream comet streaking back
  over the cowl from a round head at its tip, vermillion runners on steel shoes curling up into the cowl, and steel push
  bars at its tail, which is what the chase lens sees (`comet/crop.png`: High, Sakura and Low).

## Decisions, and why a player would feel them

1. **A near build, not a finer far tree.** Every forest tree finer would multiply the forest's vertices (2,200 trees a
   window on High); the trees that break at the lens are the few within a tree or two of it. So those few are copied
   each frame from the props' packed chunks (`props.ts packedAt`, nothing made) into one small batch a kind of tree
   (`nearforest.ts`), and the far batches let go of them in the vertex shader (`treelife.ts`, a patch on the materials
   that already move in the wind). A kind's batch draws only while one of its trees is near. Each near build is made on
   idle time after the first frame (5 to 25 ms a build in node, one an idle callback; nothing before `gs-first-frame`).
2. **The outline is the far tree's, segment for segment.** The near tier reads the far tier's own seeds (its jitter in
   reach and height at each bough tip and gap) and the far tree's turn per tier (recorded as `boughPine` builds it), so a
   tree never changes shape as it comes close (ART.md 12: a far tree that reads differently from a near one is a bug).
3. **Flat facets.** Softened normals were tried first: smooth green blobs beside the far forest's crisp facets
   (`try2/crop-0900.png`). Flat, a third of a metre, they read as the same gouache made finer (`try3/crop-0900.png`).
4. **Snow where the lens sees it, ragged by the bough.** The first build put its snow on each tier's top, which the tier
   above hides from a lens by the run: the trees went dark (`try1`, `try2`). Out along each bough's top in a continuous
   ring, every tier read as a layer of cake (the second critic, "fat stacked cylinders"); ragged by the facet, as loose
   white shards (`try6`). The shelf's edge now wanders from one half-bough to the next, eased between: a wavy line
   along each bough (`try7/m0-z1050.png`). A thick crust with a shaded fold, and clumps out on the tips, read as
   "marshmallow" and "pillows" floating off the boughs (the fourth critic): the crust is now thin, carries less snow, and
   the clumps are gone (`try8/m0-z2550.png`).
5. **The hand-over is a cut, not a band.** Over a four-metre band shared by one screen-door, a tree caught in it in a
   still was stippled (the second critic, pairs 01 and 02). The two builds share their outline, so the swap is now a
   cut a hand wide at 26 m (pushed out from 22: a tree beside a lens high in the air was still the far one), where only
   the inside of the outline changes.
6. **A tree goes whole beside the lens, on every tier.** The props' own near fade dissolves per fragment by distance;
   through coverage on High a tree half inside it read as a translucent dome (the first critic, pairs 03, 08, 10), and
   Low's few broad facets filled the frame's side. A whole tree beside or behind the rider now goes in one step before
   that, only the band's middle dithered, as the props' own fade is. A full screen-door over the band was tried on Low:
   a stippled tree at the frame's edge (`after1/low/m0-z2550.png`), as round 7's review loop found for props. The near
   trees' own near fade dithers in its narrow band instead of fading through coverage, so they are never glassy.
7. **Roots cut.** The near spruce's splayed roots read as a dark star at the foot of a tree dissolving by the lens (the
   first critic, pair 08): the tree well hides the foot.
8. **Sakura's cedars carry six tenths of a spruce's snow**: snow-pillowed, they competed with the blossom (the fourth
   critic); ART.md 15 has them the ink and cedar spine of the frame.
9. **A phone held upright draws High's near build.** Its frame is about a third as wide at the same distance, and
   Medium's leaner facets were a seventh of it in the first phone measure.
10. **Comet Bob's own paint is violet**: no other sled is violet, it is no role's colour (ART.md 1), and the cream
    comet and the vermillion runners read on it. The pearl pod's portrait light (`portrait.ts` SLED_LOOK 3) is dropped:
    the bob takes the shared studio key like every other sled.
11. **Hazards cut finer where they pass the lens** (spire, standing stone, serac, ice crystals, tunnel and cavern rock,
    the ice bridge's parapet, every bridge's deck beam): once the trees were fixed they were what the measure found over
    a tenth of the frame. Each is a small change in the file that builds it.

## The critics

Each a fresh general-purpose subagent (`model: opus`, `effort: high`) given only ART.md's path, the pairs folder and the
brief's question; scored with `blind-pairs.mjs --score`. The same ten tree-run frames each pass (Pinecrest 900, 1050,
1200, 1350, 2429, 2550, 3354; Sakura 2580, 3450; Lanternfall 2850), sides re-seeded each time.

| Pass | Before / after | New picked | What it named in the new frames, and what was done |
| --- | --- | --- | --- |
| 1 (`pairs-1`) | round-8 before set / first build, frames.sh (a live pilot) | **8 of 10** | "In one frame of each pair the pines are what ART.md asks for: tiers of drooping, scalloped boughs with snow caps"; the old ones "crumpled clusters of sharp triangular shards". Named: lumpy caps; trees by the lens fading milky (decision 6); a dark star at a tree's foot (decision 7). |
| 2 (`pairs-2`) | round's before stills / + lens dissolve, finer hazards; stills | **7 of 10** | Tiered pines "match section 12" but "fat stacked cylinders that look like a cake"; a dotted screen-door on two mid-ground trees (decision 5); glassy polygons by the lens (decision 6). |
| 3 (`pairs-3`) | round's before stills / + the cut at 22 m, dithered near fade, straighter boughs | **8 of 10** | "On the trees alone, the scalloped pine wins every one of those pairs." Its two old picks were for a ghost in view (the field differs between two builds' held runs). |
| 4 (`pairs-4`) | round-8 at f784510 / merged build, wavy shelves | **4 of 10** | Preferred the crisp faceted pines: the new ones' snow "rounded marshmallow lumps", "oval snow pillows float off the boughs" (the tip clumps, which the straighter boughs had left in the air), Sakura's cedars "snow-pillowed" and competing with the blossom. Three of its six old picks were for the scarf, a ghost's place and a saucer, not the trees. Fixed (decision 4, 10): a thin crust, less snow, no clumps, darker cedars. |
| 5 (`pairs-5`) | f784510 / final | **9 of 10** | "Every time, I picked the tiered version... Close to the camera, the shard trees break apart into scattered white triangles." A caveat: a tiered tree filling the near frame "starts to look soft". Its one old pick (Sakura 2580) named "a cloud of small black flecks" right of the rider, also named by passes 2 and 3: a distant tree caught in the hand-over band. The band is now a clean cut (decision 5); that frame was not judged again. |
| close 2 (`pairs-close2`) | f784510 / final; close passes, Pinecrest and Sakura (Lanternfall's diverged) | **6 of 8** | The see-through slabs it named by the lens ("a translucent magenta slab", "ghosted, see-through pine") were in the old frames in five of six cases. Its two old picks (Pinecrest 1050 and 1200) it judged on the lens and the rider's place in the frame, not the trees. |
| close (`pairs-close`) | round's first before build / pass-3 build; close passes | 6 of 10 | The close passes hold the sled 1.2 m inside the run's edge, so several are wall-rides and tumbles and three Sakura passes diverged between builds (a 4-tick offset at the start grew into different falls): it judged the camera and the rider more than the trees. Where it named trees, the see-through ones were mostly in the old frames. Both Lanternfall pairs went to the new Comet Bob ("the rider reads as navy coat, vermillion scarf and a dark slatted sled" against "a big white bobsled hull that bleaches the hero"). |

Faults the critics named that are not this lane's: name pills over no ghost or on the rider; the round sled's
underside in a flip a solid dark or white disc; a near ghost as a mint "snowman"; Sakura's valley lakes as flat blue
shapes and its torii's red; heavy radial blur; the lake's hex crack grid.

## How it was measured

- **Flat triangles** (`scripts/playtest/shards.js`; `shards-stills.js` on the stills' held run): every mesh within
  40 m of the lens, each triangle of it (an instanced batch's instances in reach, a variant batch's own variant only)
  projected and clipped to the frame; its breadth (twice its area over its longest span, so a sliver of trunk a frame
  tall is not a shard) as a share of the frame's width; flat when its corners share a normal; counted when the material
  would draw it (the props' near fade, the line-of-sight and side fades evaluated at its middle, and each tree
  material's own hand-over and lens dissolve, which it carries as `userData.gsKeep`). Occlusion is ignored: an upper
  bound. The lane's scope is the forest, the run's hazards, the bank's dressing, the near trees and a set piece's ice
  and rock; the snow, the far ground and a building's wall (a plane by design) are outside it.

### The widest flat triangle in a still (the brief's bar: none over about 8% of the frame)

Every fixed frame, the stills' held run, before (round-8 at f784510) and after (923fb0d), `r2/sst/`:

| Tier | Before: frames over 8% (widest) | After: frames over 8% (widest) | What is left over 8% after |
| --- | --- | --- | --- |
| High | 7 of 176 (18.8%: a wall tree 2.6 m from the lens at Lanternfall 4061) | **2 of 176** (10.1%) | Frostfang 1343: a sliver of the ice bridge's raked strut, 35 m long, clipped at the frame's foot (the measure's breadth of a clipped sliver; not a pane in the picture). Lanternfall 3940: a standing stone 2.7 m from the lens, half inside the props' own near fade (9.7%). No tree. |
| Low | (the round's first before build: 9 of 176, 17.1%) | 4 of 176 (19.2%) | Lanternfall 4061: one of Low's far-row trees 5.6 m from the lens and level with the rider, where the lens dissolve does not reach it (19.2%). Sakura 3600: Low's lean blossom on the run 7 m off (9.6%). Lanternfall 3940: the standing stone (9.1%). Pinecrest 900: a far-row tree 15 m off (8.8%). |
| Phone (Medium) | (the round's first before build: 15 of 176, 40.3%) | 7 of 176 (40.6%) | Lanternfall 4061: a piece of bank dressing (the small kit, `dressing.ts`) 2.8 m from the lens (40.6%), with a near tree 5.6 m off (14.3%). Frostfang 450: an ice block 5.7 m off (15.8%). Frostfang 3000: the kilometre arch (a built beam, 16.9%). The ice bridge (9.8%, 8.3%), a spire (9.0%), a rock (10.7%). |

On High no tree is over 8% in any fixed frame (the widest is the run's pine 8.8 m off at 6.5%), where before two were
(9.9% and 18.8%). The trees at the lens on a clumsy line are in the close passes (`r2/close/`): at Pinecrest 2429 the
before frame has a third of it in broken shards and a see-through pine over the rider; the after frame has the beside
trees gone and the near spruces ahead whole.

### Cost (the stills: the same tick on both builds, draws and triangles summed over a frame's passes, mean of 176)

| Tier | Draws before / after | Triangles before / after |
| --- | --- | --- |
| High | 97.8 / 98.9 (+1.1) | 802,458 / 846,384 (+5.5%) |
| Low | 50.1 / 50.2 | 119,081 / 128,352 (+7.8%) |
| Phone (Medium) | 88.7 / 90.0 (+1.3) | 556,932 / 592,881 (+6.5%) |

- **Low's GL calls a frame** (`glcount.js`, a live pilot's ride from the start, `r2/cost/`): Pinecrest 487.1 before,
  470.1 after; Sakura 496.4 before, 493.8 after. Not above the before's. Low gets no new draw: no near batch, no new
  uniform; its lens dissolve is a few lines in the trees' own shaders. Its triangles rise with the finer hazards (spire,
  stone, serac, crystals, tunnel rock, parapet), which Low builds too; they cost the GPU, not the main thread.
- **A Low frame's script** (`systime.js` at 6x, `cost/`, the first pass): two passes a build swung 2x with the machine
  (other lanes ran), so it reads nothing either way. By construction the near forest's per-frame work on Low is one
  compare of five fields and a return (`NearForest.update`).
- **High's GPU** (`?gpu`, one pass a build on a shared machine, `cost/gpu-high.json`): the scene pass read 17.1 and 13.3
  ms before against 14.2 and 19.7 after on Pinecrest and Sakura: noise. Not a finding.
- **The first frame:** nothing is made before it. The near builds are made one an idle callback from 1.5 s after the
  first update (5 to 25 ms each in node).
- **Draws on High and the phone:** a near batch draws only while a tree of its kind is near: about one more draw a frame
  on average, up to five in a dense tree run. The near trees drawn in a still averaged 3.8 on High (670 over 176 stills)
  and 3.5 on the phone.
- **The console** was clean in every still on every tier and mountain (`r2/after/*.json` errors), with one exception
  seen once: a pass-4 run on Ember High logged twelve `GL_INVALID_VALUE: glGetProgramiv: Program object expected`
  warnings that the next run of the same build and a re-run after did not; the cause was not found.

## Text to fold into ART.md

Section 12, after "Far trees":

- **Near trees** (round 8). Within about 26 m of the lens a tree is drawn again from a near build of the same tree: the
  same tiers, height, reach, snow and turn, so it is the tree you saw from far off, come close. Each tier is layered
  boughs (each a lobe that swells to its tip and droops, a notch between it and the next, a shorter layer of boughs
  under the notches), a lip of thickness at the bough ends over the dark underside, and a shelf of snow with depth out
  along each bough's top, its edge a wavy line along the bough folding down in a band of the snow's shade. A barked
  trunk, dead stubs under the lowest boughs, a tree well at the foot. Facets are about a third of a metre and flat.
  Sakura's blossom at the lens is its canopy a step rounder. A tree is swapped between its builds at 26 m, where they
  share their outline. Medium on a wide screen draws a leaner near build, a phone held upright the full one; Low keeps
  its own trees.
- **Nothing fills the frame's side as a shard.** A tree beside or behind the rider goes whole before it can (about 4 m
  from the lens, 6 m on Low), solid and then gone, never stippled or milky; a tree ahead of the rider is a threat and
  stays. What a sled passes is cut fine enough to hold at the lens: a spire, a standing stone, a tunnel's rock, a
  bridge's parapet and beam.

Section 5 (the sleds):

- **Comet Bob** is a racing bob in violet lacquer (`#5A3E96`, `#3F2A70`): the classic sled's five slats with the grain
  under the lacquer, low sideboards pinstriped in cream (`#F4E8CF`), a cowl over the nose that the boots go under, a
  cream comet streaking back over the cowl from a round head at its tip, the vermillion runners on steel shoes curling
  up into the cowl, and two steel push bars at its tail.

## Text for the README

"Trees hold up at the lens: within about 26 m a tree is drawn from a near build of the same tree (layered boughs under
shelves of snow), swapped where the two share their outline; a tree beside the lens goes before it fills the frame;
spires, standing stones, tunnel rock and bridge parapets are cut finer. Comet Bob is a slatted bob in violet lacquer."

## Touched outside my files

- `props.ts`: a read-only getter `forestLook` and `packedAt(i)` (the near trees read the packed chunks), and `Packed`
  exported. No behaviour change.
- `world.ts`: the field `nearForest`, my own function `forestLod()`, and one call to it after the lens moves.
- `rider.ts` `markSled`: Comet Bob's underside is now the classic sled's slats (code -1, Low -2), not a hull.
- `portrait.ts`: SLED_LOOK 3 (the pearl pod's studio light) removed, its comment updated.
- `town.ts` `rock()`: a mass over 2.2 m is an icosahedron a step finer, its jitter scaled 0.55.
- `places.ts`: the ice bridge's parapet blocks a step finer; every bridge's deck-edge beam in two courses.
- `lanternkit.ts` `standingStoneGeometry`: its shaft seven sides by five courses, open-ended;
  `tests/lanternworld.test.ts`: its budget 160 to 200 triangles (it stands on the run, not in thousands).
- New: `nearforest.ts`, `tests/nearforest.test.ts`, `scripts/playtest/shards.js`, `shards-stills.js`, `closepass.js`.

## For the main lane to decide or wire

- `ui/art.ts` draws Comet Bob's garage icon as a "streamlined shell" (the screens lane's file): it should become a
  slatted bob in violet. The garage portrait itself was not looked at in the garage (`world.sledPortrait` hands back a
  blob URL the probe could not read).
- `scripts/playtest/stills.sh` as first committed read its frame list through `/c/...`; this lane ran a local copy with
  the worktree's Windows path before 30dd5b3 landed the same fix, so its stills are good.
- The two builds' held runs show different ghosts at the same tick (pass 3 lost two pairs to it): the stills hold the
  player's run, not the field.

## What is still short

- **The 8% bar is met on High for every tree, not for every object.** What remains over it on High is a bridge strut's
  clipped sliver and a standing stone at 2.7 m; on the phone, a bank-dressing piece at the lens (`dressing.ts`), an ice
  block, the kilometre arch and Frostfang's ice bridge; on Low, its own far-row tree level with the rider at Lanternfall
  4061 and its lean blossom 7 m off. The dressing, the arch and the bridge are other lanes' files; Low's trees would need
  the lens dissolve to reach trees level with the rider, which risks hiding one the rider is about to pass.
- **The critics split on the near pine.** Four of five passes picked the tiered near pine (8, 7, 8 and 9 of 10); the
  fourth preferred the crisp faceted far pine to a pillowy one, which was then fixed, and the fifth called a tiered tree
  filling the near frame "a little soft". A person should look at a tree run at speed.
- **Not judged in motion.** The hand-over (a cut at 26 m), the lens dissolve (a tree beside the rider gone in one step)
  and the near trees' wind were only seen in stills. Whether the cut at 26 m shows as a change of detail, and whether
  the dissolve reads as a pop at speed, needs the main lane's 30 s clips or a person.
- **Sakura 2580's "flecks"** were named by three critics; the cut that should remove them was not judged again.
- **Ember's one-off GL warnings** (above) were not reproduced or explained.
- **Comet Bob's garage portrait** and its 2D icon (`ui/art.ts`) were not looked at.
- **GPU and frame-rate numbers** are noise on a shared machine; they wait for the main lane's quiet sitting.
