# The visual lift: the props lane (edges that look made)

Lane `vl-props`, branch `vl-props` cut from `visual-lift` at `c00d369`, port 4604, sessions `vl-props-desk`,
`vl-props-phone` and `vl-props-st`. Render only: nothing in `src/sim`, `src/bot` or the ghost pools changed, no
collider moved, and nothing drawn here changes where anything is or what it does. The colour roles hold (the
blossom's pinks, the stones' inks and the timbers are their own; no vermillion, mint or marigold was added).

## What each fault was, and where it was drawn

1. **Boxes everywhere at the lens.** Every kit piece is built from `BoxGeometry` through `part()` (`meshes.ts`,
   `flora.ts`) or the landmarks' `box()` (`landmarkKit.ts`, used by `town.ts`, `places.ts`, `lanternkit.ts`):
   flat-shaded boxes whose edges are a hairline between two flat values. The toon light
   (`mix(shade, lit, smoothstep(-0.12, 0.42, N.L))`) cannot put a highlight on an edge, and Medium and Low have no
   occlusion pass to draw a crease, so on those tiers nothing drew an edge at all.
2. **The kicker's lip** (`meshes.ts kickerLipGeometry`): a 1 x 0.26 x 0.07 box board, a 3 cm tan strip on it and an
   8-sided flat-shaded cylinder squashed into a snow cap, all stretched to the lip's 4 to 6.4 m. From the chase lens
   (Sakura z3405, every mountain) "an untextured plank across the foreground": a ruled white bar on a ruled tan
   line, cut square at both ends.
3. **Sakura's stone lantern** (`meshes.ts lanternGeometry`, the `lantern` hazard): a box footing, a 6-sided post, a
   box body with a second box through it for the window, two 4-sided cones: "a box stone lantern at the lens"
   (z4076, every pass). **Lanternfall's stone lamps** (`lanternkit.ts stoneLampGeometry`): boxes on a tapered
   4-sided cylinder under a pyramid ("stone lamps as dark boxes").
4. **The FINISH board's lettering** (`places.ts letters`): a 5 by 7 dot font, each run of dots one box: "pixel
   FINISH lettering", "stair-stepped" (Sakura z4440; the same font on every finish and start board).
5. **Sakura's blossom** (`meshes.ts blossomGeometry`, `flora.ts paleBlossomGeometry`, the town's `blossomTree`):
   five flat-shaded 20-triangle icosahedra a canopy. Every Sakura critic's first theme: "faceted pink polyhedra",
   "frontlit", "never backlit". A flat-shaded polyhedron has nowhere for light to come through: each face is one
   value.
6. **The run's rock close to the lens** (`meshes.ts rockGeometry`, round 7's `strata()`): seven corners a bed,
   every wall flat-shaded: "plainly facets close to the lens" (DECISIONS 289).

## What changed, and why

Commits on `vl-props`, oldest first: `a911788` (the game), `24e9115` (the tools), `20e8543` (rails), `a5ed05b`
(Low's stone lamp), then after the critic `2fadc12` (the blossom's painted values), `cd5f5d9` (the lip's ends),
`5fdf71c` (a tool), `81541e0` (obstacle forms made on demand, for the first frame). This section describes the final
state.

- **A shared chamfer** (`src/render/chamfer.ts`, new). `chamferBox(w, h, d, c, taper?)` is a box whose twelve edges
  are cut by a face `c` wide, turned half way between the two faces it joins, and whose eight corners are cut by a
  triangle: 44 triangles where a box is 12, inside its box, flat-shaded and non-indexed like every part. The
  chamfer is painted as well as cut, because the toon light cannot put a highlight on a face turned half way:
  `part()` (in `meshes.ts` and `flora.ts`) calls `liftEdges` once a part is in place and coloured, and a chamfer
  that looks up is lit 10% plus 22% of its upward look (up to about 1.25 on a top edge: the sky along it), one on
  the side 10% (an arris), one that looks down darker by 30% of its downward look (the crease under a board). A
  lift never takes a colour past white, and a light (a colour pushed past 1 to bloom) is untouched. `bevelled()`
  marks the slanted faces of a turned or extruded part the same way (a lathed plinth's rim, a letter's bevel).
  Where it goes, decided by measurement (`scripts/playtest/props-tris.ts`, below):
  - *Automatically* (`kitBox`, which `landmarkKit.ts box()` now calls, and `meshes.ts`, `rails.ts`, `lanternkit.ts`
    `tbox` where they build kit boxes): on Medium and High, every box 20 cm or more thick, its chamfer a sixth of
    its thinnest side and at most 11 cm; never on snow (a slab of snow is soft already and could take no lift),
    never on a light, never on the second row of a town (seen only from afar over the first: `town.ts house`).
    A first cut chamfered everything over 7 cm and put 37 to 84% on the set pieces' triangles (a finish town's
    seats, boards and trim by the thousand, each a pixel of chamfer at best).
  - *A sign* asks for one down to 6 cm (`landmarkKit.ts signBox`: the shops' sign boards and hanging blades).
  - *By name, on every tier* (`namedChamfer`): the kicker's lip, Sakura's stone lantern, Lanternfall's stone lamps
    (on Low its shaft and platform), the boards' letters (bevelled on Medium and High, cut square on Low). On Low
    these are the only chamfers. The grind rails' bar is chamfered on Medium and High only: the rails, flags,
    shoulders, cornices and the fork's signs are one variant set (`rails.ts`), and the renderer's count (and the
    vertex work) pays for every variant in a batch's range on every instance, so a chamfer there is paid by every
    flag; the fork's gantry keeps its plain boards for the same reason.
  - *The tier.* Props builds first whenever the tier changes, so `Props.build` sets the level (`setChamferTier`),
    and `landmarkKit.ts pieceFor` builds every set piece's layout and steps inside `withChamfer` by its own
    `ctx.low`. A way lamp (`lanternkit.ts`), standing by the hundred, chamfers only its shaft.
- **The kicker's lip** (`kickerLipGeometry(p, low)`): two chamfered planks (the lower a step darker) under a capping
  rail, so the board reads as joinery with a seam and a lit top edge; behind it a packed roll of snow swept from a
  profile (a front that meets the rail, a crest 10 cm up, a tail that feathers into the ramp), smooth-shaded, its
  crest swelling and dipping along the lip; over the last eighth of its width at each end it sinks under the ramp's
  face and draws back to the board, its crest still, so nothing hangs over the ramp's flanks. The mood's lit snow as
  before, its tail a step deeper toward the ramp's packed face. 348 triangles, Low 276 (round 7: 56); a lip is
  stretched per instance, so nothing on it is a fixed width but the ends' tuck.
- **Sakura's stone lantern** (`lanternGeometry(low)`): a hexagonal footing with a bevelled rim on a seat of snow, a
  bevelled step, a round shaft with a carved collar, a flared hexagonal platform, a chamfered stone fire box with a
  moonlit paper window on each face (the same cold paper colour as before: a hazard's light is never warm), a cap
  rail, and a cap whose concave slopes rise from an eave band and turn up at the corners (each slope smooth, its
  hips crisp), snow lying down its upper half with a ragged lower edge, and a jewel finial. 554 triangles (Low
  476; round 7: 76). It stays within its collider's reach (stone inside 0.45 m, the cap's corners 0.64 m).
- **Lanternfall's stone lamps** (`stoneLampGeometry(low)`): a seat of snow, a chamfered foot and step, a tapered
  chamfered shaft with a carved band, a chamfered platform, the four posts and the fire box where lanternworld.ts
  draws the flame (unchanged), a frame, an eave board and the hip roof, a small cap stone. 436 triangles, under
  1.8 m. Low stands a score in view (23 in a Low frame at Lanternfall 3450 m), so its lamp chamfers only the shaft
  and the platform and drops the band, the frame, the cap stone and the seat: 188 triangles (round 7: 104).
- **Built letters** (`src/render/lettering.ts`, new; `places.ts letters` now calls it): F, I, N, S, H, T, A, R as
  outlines in the dot font's box (5 by 7 units, 6 to the next, so every board lays out as it did), a sturdy sans of
  straight strokes and true curves (the S is one stroke round two bowls, the R and A have counters), extruded a
  hand proud of the board with a bevel that catches the light; on Low cut square (a third of the triangles,
  still built). FINISH is about 820 triangles (round 7's dots about 400).
- **Sakura's blossom** (`flora.ts canopy`, `blossomGeometry(p, build)`, `paleBlossomGeometry(p, build)`,
  `streetBlossomCanopy` for the town's trees): a canopy is clustered rounded puffs, each lumpy (its corners moved
  in and out by a hash of their direction), every corner's normal turned half way from its own puff's toward the
  canopy's heart (a little under its middle), so the cloud of bloom lights as one soft mass and its outline is soft
  against the sky; this is the normal the light lane's light through foliage reads. Painted in three flat values a
  facet, by where the facet stands up the canopy and how far it looks up: a wine-rose underside (a third of the
  way to `WINE #8A3458`), the body, and the crown a step toward the petals' white (`PETAL #FFF0F4`), so a rounded
  canopy keeps a hazard's hard steps of value (ART.md 3) and the gouache's three values (15, rule 3). The first
  cut was a smooth gradient and the critic read it as candyfloss. Low's lean canopy is flat-shaded (its 12-corner
  puffs read as polygons over smooth shading, and their rims washed pale).
  Snow lies on the crown as one more lumpy puff sunk into it (a whole flattened puff read as a white slab). Four
  builds: `rich` for the run's own blossom hazards that pass at the lens (five 80-triangle puffs and two smaller,
  524 triangles), `near` for the orchards' treeline and near rows on Medium and High (184), `lean` for Low's near
  trees and Low's hazards (130), `far` past the detail range (three puffs, 66: under half round 7's 144, and the
  far orchards are most of the trees). `hasLod` now says Sakura's blossom has its levels.
- **The run's rock** (`rockforms.ts`): `Facets` has smoothing groups (`group`, `soft`): a grouped corner's normal
  turns `soft` of the way from its face's toward the group's area-weighted average there. `strata({ smooth })`
  puts each bed's walls in a group of its own, so a bed weathers round while its joints, ledges, soffits and crown
  stay crisp and its outline is a hazard's hard one. The run's rock and Ember's lava rock take it on Medium and
  High, the run's rock a corner finer (8, was 7): 104 triangles (round 7 91; the test's budget is 110). Low's are
  as they were. Colliders untouched: `tests/rockforms.test.ts` holds the forms inside and filling them.

Nothing new runs before the first frame: the set pieces, the arches and the orchards' sets are made on idle time as
before; the obstacles, the lip and the forest's first trees are made in `Props.build` as before, a little more work
each (measured below).

## Tests

- `tests/chamfer.test.ts` (new): a chamfered box is 44 triangles inside its box, every face looking out, a tapered
  one narrowing to its head; its chamfers take their light by where they look, never past white, a light untouched;
  Low, thin parts and lights keep a box, a sign does not; the lip stays unit wide, a hand high, its roll tucked in at
  the ends, within its budget on both tiers; the stone lantern and the stone lamp inside their colliders' reach and
  their budgets; the blossom's builds within their budgets, their normals unit and soft (Low's flat); the letters inside the dot
  font's box; Facets' smoothing groups soften a shared corner and leave group 0 flat.
- `tests/lanternworld.test.ts`: the stone lamp's budget is now the named piece's (under 460, Low under 200; was 160).
- `tests/setpieces.test.ts`: a finish town on High under 155k triangles (was 130k), a street under 66k (was 60k): the
  front rows' storeys, plinths, roofs and chimneys are chamfered (measured: +12 to +24% a finish, +20 to +33% a
  street, on High's build over the whole course; Low's builds within 1%).

## How it was judged

- **Before** is round 7's final frames (`shots\r7\final\{high,low,phone-medium}`, the fixed list of
  `frames-r7.json`, all five mountains) and close stills shot on round 7's build (`c00d369`, built to
  `dist/vl-props-base` and served beside the lane's build from the same server at `/base/`).
- **After**: the fixed frames on High and Low and the phone on Medium on all five mountains (`frames.sh`), and close
  stills of the named pieces on High, Medium and Low (`scripts/playtest/props-stills.js`, new: for each mountain the
  obstacles of each kind nearest the safe line, the kickers on the line, the finish; the rider all but stops as it
  reaches the place, the HUD hidden). Five lanes and a laptop on battery made the wall-clock captures run 30 to 50 m
  late in the first sets (the HUD's distance): frame for frame those are not the same place, their means are. The
  re-shot sets after the critic ran on a quieter machine and are on time.
- **Cost, deterministically:** `scripts/playtest/tris-break.js` (new) stands the rider at a place, waits for the set
  pieces to be made, and sums every drawn mesh's triangles (instances times its draw range, shadow casters twice,
  as the frames' JSON counts them) and counts the meshes drawn; run at a third of the fixed places on both builds
  (`/base/` and the lane's), High and Low. `scripts/playtest/props-tris.ts` (new) weighs the kit over a whole course
  with the chamfer pinned off and as each tier builds it.
- **Contact sheets** (`round-sheets.sh`, now with `LB`, `LA` and `WITH4` so a lane can label its own pair and keep
  Lanternfall's befores): `shots\vl\props\sheets\`.

## The critics' verdicts

**First critic** (fresh, general-purpose, opus, xhigh; given ART.md, 85 pairs and the question, nothing of the
change): **44 better, 40 same, 1 worse.** Clearly better with no rule broken: the FINISH and START letters on every
tier and mountain (18 pairs: "solid built letters instead of the stepped dot font", clearest close up), Sakura's
stone lantern ("boxes became a real toro on every tier"), Lanternfall's stone lamps (modest), Low's kicker lip ("a
board over a packed snow roll, not a white bar on a tan line"). The blossom "more crafted than the old raw
icosahedra" but, as a hazard, "round, puffy and smoothly graded: the rewards' shape language", "cotton candy" near
the lens, and on Low pale six-sided lobes over smooth shading (pair 78, the one worse). The lip's ends on Low: one
bulged below the lip, the other trailed a white tongue. Not visible at play distance: the chamfer on town fronts,
barriers and signs, and the rock's weathered walls. Untouched and still raw: the near pines.

**What changed after it:** the blossom is painted in three flat values a facet (wine underside, body, a pale crown)
with its rounded form and smooth normals kept, so it has a hazard's hard steps and the gouache's three values; Low's
lean canopy is flat-shaded; the lip's roll sinks under the ramp and draws back to the board over its last eighth;
Low's stone lamp leaner (from the cost, below).

**Second critic** (fresh, same settings, 42 pairs of the blossom, the lip, the lanterns, the rock and the finish on
the fixed build): **25 better, 17 same, 0 worse; nothing new broke.** The blossom on High, Medium and the phone:
"icosphere clumps with white snow facets and box-column trunks became lobed canopies on slimmer trunks, a clear
step up"; Low's blossom now reads as round 7's faceted kind (same). The stone lanterns "the cleanest win, on every
tier including Low". It still asks for a decision on ART.md 3 (a hazard's canopy is rounder than "faceted, crisp"),
and names what this lane did not reach (below).

## Cost

Triangles summed over every pass of a frame; draw calls the renderer's (the frames' JSON), or meshes drawn
(`tris-break.js`).

| Measure | Round 7 | This lane | |
| --- | --- | --- | --- |
| High, fixed frames, 181 a tier (loaded machine, late captures) | 98.7 calls, 884,712 tris | 100.4, 924,106 | +4.5% |
| High, `tris-break` at 61 places, same places | 78.6 meshes, 774,763 | 78.5, 802,332 | +3.6% |
| High by mountain (`tris-break`) | | Pinecrest +4.4, Frostfang -0.7, Ember +4.3, Sakura +6.2, Lanternfall +3.3 | |
| High, re-shot on time (Pinecrest, Sakura, 75 frames) | 98.5 calls, 963,402 | 98.7, 986,274 | +2.4% |
| Phone on Medium, fixed frames (181) | 89.0 calls, 618,896 | 89.6, 644,826 | +4.2% |
| Phone on Medium, Sakura re-shot (37) | 90.2 calls, 633,837 | 90.4, 668,330 | +5.4% |
| Low, fixed frames (181, before the rails and stone lamp fixes) | 49.1 calls, 131,165 | 48.5, 132,765 | +1.2% |
| Low, `tris-break` at 61 places (with the rails fix) | 43.1 meshes, 126,796 | 43.5, 127,606 | +0.6% |
| Low by mountain (`tris-break`) | | Pinecrest +2.0, Frostfang +0.2, Ember +1.4, Sakura -5.7, Lanternfall +5.1 (then the stone lamp trimmed: 23 lamps in view at 3450 m, 7,820 to 4,324 triangles, so about +2.3) | |
| Low, re-shot on time (Pinecrest, Sakura, 75 frames) | 47.6 calls, 138,153 | 47.1, 134,009 | -3.0% |

- **No draw call and no shader program added.** Every change is geometry and vertex colour in the existing batches
  and materials. The calls' means move within the captures' noise (High +1.7 on the late set, +0.2 on time; Low
  -0.6 and -0.5); the meshes drawn at the same places are level (78.6 to 78.5 High, 43.1 to 43.5 Low).
- **Within budget:** High and Medium about 8% over round 7 (here +2.4 to +5.4% on the means, Sakura the most:
  its blossom near the lens and its towns), Low about 3% (here -3.0 to +2.3%: the far orchards at half round 7's
  triangles pay for Low's named pieces on Sakura; Lanternfall's twenty-odd stone lamps were the one overrun, fixed).
- Where it goes on a High frame (`tris-break`, Sakura 3926 m, a town and its orchards): 540k to 601k (+11%), the town
  +12.8k (twice: the town casts on High), the near orchards (both trees of a variant set count on every instance)
  +5.8k, the wall's +4.2k (twice). A finish frame is the worst case (+5 to +10%).
- **What the variant sets cost.** The renderer counts, and the GPU runs the vertices of, every variant in a
  batch's draw range on every instance. So a chamfer on the grind rail is paid by every flag in that batch, and the
  blossom's two near trees are both paid by every orchard tree: the rail's chamfer is Medium and High only, the
  fork's gantry keeps plain boards, and the far orchards' three-puff tree is where the blossom pays its way.
- **Script a frame on Low:** nothing added a frame (all of it is made at build time); not measured with
  `systime.js`, since no per-frame code changed.
- **Build time.** Set pieces are made on idle time as before; the chamfer adds a little to each step
  (`props-tris.ts`: a whole course's pieces in about 0.4 to 0.7 s at 1x either way, within its run-to-run
  spread on this machine). The obstacles' forms are now made when the course first stands one in the window
  (`props.ts obNeed`): round 7 made all thirteen kinds before the first frame whatever the mountain, and the named
  forms cost a few milliseconds each (the rich blossom 2 to 5 ms, the stone lantern about 4 at 1x).

## Shared code touched

The files this lane owns: `meshes.ts`, `flora.ts`, `landmarkKit.ts`, `lanternkit.ts`, `rockforms.ts`, `town.ts`, and
the new `chamfer.ts` and `lettering.ts`. Outside them, each edit is the smallest that does the job and says why:

| File | Change | Effect |
| --- | --- | --- |
| `props.ts` (batches) | `Props.build` sets the chamfer's tier (`setChamferTier`); the lip takes Low; an obstacle kind's form is made when the course first stands one (`obMake`, `obNeed`) | Every tier's kit built with its chamfer; no form made for a kind the mountain never stands |
| `places.ts` | `letters()` calls `builtLetters` (the dot font removed) | The FINISH and START boards, every mountain |
| `rails.ts` | The grind rail's bar chamfered on Medium and High (`railBar`); the gantry unchanged in the end | Rails' top edges catch the light |
| `tests/setpieces.test.ts` | A finish town's High budget 130k to 155k, a street's 60k to 66k | The chamfered front rows |
| `tests/lanternworld.test.ts` | The stone lamp's budget 160 to 460 (Low 200) | The remodelled lamp |
| `scripts/playtest/round-sheets.sh` | `LB`, `LA`, `WITH4` (defaults unchanged) | A lane labels its own pairs |

`part()` in `meshes.ts` and `flora.ts` now calls `liftEdges` (a no-op on any part without chamfer marks), and
`landmarkKit.ts box()` and `pieceFor` go through the chamfer: every set piece's builder in `town.ts`, `places.ts`,
`lanternkit.ts`, and the set pieces' worlds that use `box()` (`lanternworld.ts`, `verbworld.ts`, `marqueeworld.ts`,
`legendforms.ts`) take the kit's chamfer on Medium and High with no edit of their own. None of `materials.ts`,
`palette.ts`, `post.ts`, `world.ts` or any shader changed. For the `light` lane: Sakura's canopy normals are each
corner's own puff's turned half way toward the canopy's heart, smooth on Medium and High (the light-through-foliage
term can read them as one soft mass), flat on Low; the canopy's colour is three flat values a facet.

## What is still short

- **ART.md 3 and the blossom.** The blossom is a hazard, and ART.md 3 asks a hazard for "faceted, flat-shaded, sharp
  crisp silhouettes". The brief asked for "clustered rounded puffs with smoothed normals"; both critics read the
  new canopy as the better craft and both asked for a decision. The painted three values are this lane's middle
  way; ART.md 3 could say: "Sakura's blossom is the one rounded hazard: clustered puffs, each lumpy, painted in three
  flat values (wine underside, body, a pale crown), on a dark trunk; Low's flat-shaded."
- **Low's blossom** reads as round 7's faceted kind (now banded). A poster of the High tree it is not yet: that wants
  the poster lane's look.
- **Far orchards** (past 128 m) are three puffs and read as pale discs at mid range, as round 7's did; ART.md 12 asks a
  far tree to read as a near one. Not made worse, not fixed.
- **The chamfer on town fronts, barriers, signs and the rock's weathered walls are not visible at play distance**
  (the first critic: "cannot be seen in any of these frames"). It reads at the lens (a shop sign, a gate's post, a
  rail's top, a plinth's arris) and is cheap where it is, but it is not the step the named pieces are. The
  chamfer's lift could be stronger, or the light lane's crease term (High and Ultra) will carry it there.
- **Not reached:** the near pines (big flat facets, every mountain: the most raw thing left in most Sakura frames),
  the run's rock's snow cap (still a cap, not a lee-side drift), standing stones, basalt, ice, windows as flat cards,
  the lift stations and other big landmark masses (only their arrises are chamfered), square timbers made by
  `seg()` (lattice towers, trusses: thousands, left plain for cost), the bank dressing kits (`dressing.ts`, a variant
  set where every added triangle is paid by every instance), the kicker's lip from the chase lens (it is under the
  rider or behind the lens in most stills; read at Low z3405).
- **The lip's dither** where the props' line-of-sight dissolve cuts it round the rider (`materials.ts`), seen in
  Low z3405, is unchanged.
- **A slalom flag pole stands through a Sakura stone lantern's cap** in two stills (course placement; round 7 had the
  same overlap, now more visible).
- **The first frame** wants a quiet sitting on mains (below).
- The stills' 'by' shots merged into the 'ahead' ones (four metres apart); the lips' 'over' shots rarely show the
  lip (the camera has passed it): the fixed frames carry the lip.

## The first frame

`firstframe.js` at 6x CPU throttle on a fresh save, round 7's build and this lane's served side by side and interleaved,
on battery with other lanes capturing: three sittings, 28 loads each, medians 1,716 ms (round 7) and 1,811 ms (this
lane), means 1,876 and 1,829; a sitting's medians moved from -334 to +207 ms between the two, and a single load from
1.2 to 4.5 s. So no difference this machine can measure today. By construction: the only work this lane adds before
the first frame is the kicker lip's form (1 to 2 ms at 1x) and the forms of the obstacle kinds the course stands
in the first window (Pinecrest's rock a few tenths of a millisecond more for its smoothing); the named forms that
cost a few milliseconds each (the rich blossom, the stone lantern) are made only when a course stands one
(`props.ts obNeed`), where round 7 made all thirteen kinds before the first frame on every mountain. A sitting on
mains with the other lanes idle should confirm it, as item 343 asked for Low.

## Console and tests

- The console was clean in every capture: 56 runs' JSON (fixed frames on High, Low and the phone on Medium, stills
  on High, Medium and Low, each page a cold load), 0 errors.
- `npx tsc --noEmit -p .` green; `npx vitest run`: 80 files, 1,577 tests, all green (the audio soundscape test timed
  out once at 151 s while five lanes captured; green in the full run after).

## Where the frames are

All under `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\vl\props\`:

- `after\{high,low,phone-medium}\` and their JSON: the fixed frames the first critic judged (`a911788`'s game,
  before the rails and stone lamp fixes; the late captures). The stills the first critic judged (`stills\after\`)
  are on `20e8543`.
- `after2\{high,low,phone-medium}\`: Sakura and Pinecrest re-shot on the final blossom and lip (on time).
- `stills\before\` (round 7), `stills\after\` (first critic), `stills\after2\` (second critic), `stills\after3\`
  (the final build: Sakura and Lanternfall, High and Low, a check of the obstacles made on demand), each tier with
  its JSON.
- `pairs-critic.txt` (85 pairs, first critic), `pairs-critic2.txt` (42 pairs, second critic).
- `sheets\`: round 7 beside this lane, a mountain and a tier a sheet (`LB=r7 LA=vl WITH4=1 round-sheets.sh`).
- `after-a1\`: an early set (High and phone), kept for the record.
