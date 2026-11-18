# The visual lift: the poster lane (Low and the phone as a designed poster)

Lane `vl-poster`, branch `vl-poster` cut from `visual-lift` at `c00d369`, port 4605, sessions `vl-poster-*`. Commits,
oldest first: `1db3ed5` (Low's poster), `9bea2d8` (the phone's results), `087c6da` (the ladder's news read aloud),
`a0ee35b` (the fixes after the critic), and these notes. Render
and UI only: nothing in `src/sim`, `src/bot` or the ghost pools changed, and nothing drawn here feeds back into a
run. The colour roles hold: the rider's vermillion, the ghosts' mint and the lantern's marigold are untouched (the
painted rim takes a vermillion surface's own hue, never the light's).

## What each fault was, and where it was drawn

1. **Low read as a degraded High, not a designed poster** (DECISIONS 342, 360; every mountain's critic). Low draws
   straight to the canvas (`world.ts` QUALITY: no post pass, no bloom, no shadow map, a pixel ratio of 0.75 to 1),
   and `palette.ts tierLook()` bakes the place's grade and the film curve into its colours. What the other tiers get
   from passes, Low simply did not have:
   - **no shafts**: the shafts pass (`postfx/shafts.ts`) and the composite's fan run only with a post pass, and the
     sky dome's crepuscular rays are compiled out on Low (`sky.ts` `CLOUD_Q 0`). The Ice Cavern's mouth and the
     Thousand Torii draw their light "without the shafts" on Low (`stages.ts`).
   - **no rim to cut a silhouette out**: the toon model's fresnel rim (`toonLightK`, `uRim * fres^3 * 0.3`) is a
     faint, soft wash; with no bloom and no occlusion, Low's trees, rocks and the rider sat on the snow as flat
     shapes. The rider's round 7 key-light rim (`rider.ts`, `uHero.y`) halves by day.
   - **no foot**: High's cool darkening toward the bottom edge (ART.md 4, `post.ts` `uFoot`) is a composite term,
     so Low's lower frame was one washed value under the rider ("paper", "sand", "a cream smear").
   - **a smooth sky**: the gradient, the horizon's band and the sun's glow were High's own, airbrushed; ART.md 15
     asks for "the sun's scatter as a gradient on the dome" and Frostfang's "thin lemon band on the horizon".
2. **The results card over the hero shot on a phone** (every mountain's critic; the lowest phone frames, 4.5 to 5).
   `style.css` gave the portrait results a band of 28% of the height over the card (contract C6). The moment's line
   ("2nd of 6 / ON THE PODIUM") filled its top and the ladder strip (`meta.css .gs-lad.is-band`) sat at its foot, so
   what the band showed of the rider was a torso between two panels; and the finish lens on a phone
   (`camera.ts FINISH_R_PORTRAIT`, 6.6 m) framed the standing, cheering rider so close that it overfilled even the
   whole band (measured 6.67 m from the rider, 74 degrees: the figure a third of the screen's height).

## What changed, and why

(Commits on `vl-poster`, oldest first: see the top.)

- **One draw of painted light and a painted frame on Low** (`src/render/poster.ts`, new). A single mesh, joined to
  the scene on idle time after Low's first frame and compiled with `compileAsync` (nothing before the first frame;
  Medium, High and Ultra never compile it), drawn by the chase lens only (layer 5: the avalanche mirror, the lake's
  bake and the shop's portraits never see it). Its vertices are placed in the vertex shader from a few uniforms, so
  its script a frame is projecting one direction and setting four uniforms.
  - *Painted shafts*: a fan of ten long, soft wedge cards from the sun's disc toward the frame's lower middle, light
    beams and, between them, beams of the air's cool shade (ART.md 12), laid in the air 42 m from the lens, so the
    near slope, the trees, the rider and anything nearer stands in front of them and cuts them. Driven by the
    grade's `shafts` times `poster.shafts`, gone as the disc climbs past 0.2 to 0.32 and as it leaves the frame by
    more than half its width, never with a moon or at night (the grade's own zero), and not under a roof (a
    gallery, a tunnel, the Thousand Torii: the set pieces' `light.shade`). They turn and breathe very slowly (held
    under reduced motion).
  - *The bright place*: the same fan, shorter, from the one bright place a frame offers (`pushShaftSource`,
    `postfx/shafts.ts`), its cards 14 m from the lens and never past the place. On Low the Ice Cavern's mouth now
    offers itself (`stages.ts`, Low only), so the burst into dawn has its shafts again, painted.
  - *The frame*: the lower frame laid over with the shade's colour (the palette's deep shade, graded), deepest at the
    edge and gone half way up, and the corners a little. Blended `dst * a + src`, so it darkens toward the cool
    shade and a card adds light while keeping some of what is behind it (bright snow under a shaft does not clip).
- **A painted rim on silhouettes** (`materials.ts`, `POSTER_GLSL` `posterRim`, in the toon material). On Low the edge
  of a form that faces the key light takes a hard band of that light's own colour, laid over the surface like a
  stroke rather than added as a glow, and the whole outline does when the light is behind. A saturated warm surface
  (the beanie, the scarf, the mitts) takes it in its own hue, a step brighter. Props take it on their outermost
  facets at the material's own rim weight; **the hero** (the rider's materials, `hero: true`, define `HERO`) takes
  a wider, crisper band that runs all round it (never under 0.6 of its strength off the light's side), the key
  light's colour on the light's side and the sky's on the other, at about three times a prop's strength, still on
  the silhouette's outer facets (the coat is never cream). One compare on every other tier.
- **The snow's light in flat values** (`posterValue`): on Low the snow's ramp from shade to lit is painted in three
  values with soft edges (a third of a step), so a bank's shade and a drift's lee read as shapes of light and shade
  rather than an airbrushed fall-off. Not on Sakura, the calm mountain: there its banks read as camouflage.
- **The sky as a designed gradient** (`sky.ts`, Low's path): the gradient in a few flat bands (each edge a short soft
  ramp, never an 8-bit sky's hairlines), and the horizon's band as a thin printed line of its colour along the
  ridges over its own soft glow (Frostfang's lemon line and the dawn's orange; the line's weight `poster.stripe`).
  The sun's scatter stays a smooth gradient on the dome, a quarter wider than High's (`posterSteps` can ring it,
  `poster.rings`, off everywhere: see the critic). Per mountain: Pinecrest 5 bands, Frostfang 6 and the line, Ember
  4 under its deck, Sakura 3 (the calm mountain, low contrast on purpose), Lanternfall 6; none in a Blizzard.
- **A poster's cast shadow, designed for the far shadows** (`posterShadow`, `posterShade`, palette
  `poster.shadow/shadowK/edge`). Low's only cast shadows today are a ravine wall's over its floor (computed in the
  snow shader); they now go through the poster's hooks: the edge a little harder (`edge` 0.2) and the shade leaned to
  the mountain's own shadow colour (Pinecrest cobalt, Frostfang violet, Ember plum at half the others' lean, Sakura
  lavender, Lanternfall indigo). The far
  shadow field (the farlight lane) is to be Low's real cast shadow: where it is read on Low, fold it into the snow's
  `shadow` before `posterShadow(shadow)` and it takes the poster's edge and colour with no other change.
- **The palette carries the poster** (`palette.ts`, `PosterLook` on every palette; `tierLook` grades its shadow
  colour with the rest of Low's colours). Every field blends like any other and is read on Low only.
- **The phone's results yield the picture** (contract C6): the card's top edge moves from 28% to 44% of the height
  (`contract.ts RESULTS_BAND`, `style.css`, and the lens's band in `world.ts`), the ladder strip leaves the band and
  rides the card's mountain line as it already did on a small landscape screen (`meta.css`), the scrim is clear
  over the band, and the finish lens on a phone stands back to 9.2 m with the rider centred lower in the band
  (`camera.ts FINISH_R_PORTRAIT`, `BAND_AIM` 1.36, shared with the crash's hero shot), so the whole cheering figure
  stands under the moment's line with the crowd behind. What does not fit the card's first view scrolls inside it,
  under the existing fade.

## How it was judged

- **Before** is round 7's final frames (`shots\r7\final\low` and `phone-medium`, the fixed list `frames-r7.json`, all
  five mountains, 181 frames a tier). **After** is the same list on this lane's build (`frames.sh`, sessions
  `vl-poster-desk` and `vl-poster-phone`): Low at 1280x720 and the phone (390x844) on Medium. They ride the safe
  line at 30 m/s on the wall clock, so the HUD, ghosts, set pieces and the chase lens's exact distance differ between
  builds; the light, the world and the rider's place match.
- **The phone's results over a finish, settled** (`settled.js`, in the frames folder's `tools\`): each mountain on
  Medium on the phone, the sled pinned to the safe line from 250 m short of the line, shot 4.2 s after the results
  open, on the base build (`c00d369`, served at `/base/`) and on this lane's, with the lens's distance logged (6.67 m
  before, 9.25 m after; band 0.28 before, 0.44 after).
- Probes on the way: variant shots of one frame under several settings (`vary.js`), the poster layer's state at a
  distance (`probe.js`), crops of the rider and the trees at 2x.
- **Contact sheets**: `scripts/playtest/round-sheets.sh` (now taking tiers and labels), r7- beside vl- at the same
  distances, a mountain and a tier a sheet.

## The critic's verdict

One fresh critic (general-purpose, `opus`, `xhigh`), given only ART.md (section 15's "Tiers, designed" above all), the
52 pairs (`shots\vl\poster\pairs.txt`: 37 Low, 10 phone on Medium, 5 settled phone results) and the sheets, asked
for each pair whether the after is better, worse or the same as ART.md 15's designed poster, and what broke. It
judged the build `9bea2d8` (the frames in `after\`, `results-after\`).

| Group | Pairs | Verdict |
| --- | --- | --- |
| Pinecrest, Low | 1-8 | Slightly better: "shafts and a sun in frame motivate the light" (1, 5, 6); offset by a hard halo disc (4) and a whiter valley (2, 3, which it put down to the capture's place) |
| Frostfang, Low | 9-16 | Slightly worse: the lemon band a thick, flat, hard-edged stripe "where ART asks for a thin band narrowing to a line" (9, 10); the dawn span (15) a little better |
| Ember Peak, Low | 17-23 | Same: Ash Market (22) and the start (17) better, a dark wall shadow with a scalloped edge on Cinder Gate's floor (19) worse |
| Sakura Ridge, Low | 24-30 | Same: "cloud patches on the banks", a cream wash over the torii's floor (27), "harsh cobalt camouflage patches" (29) |
| Lanternfall, Low | 31-37 | Same: the moon's hard halo disc (31, 32) |
| Phone in the race | 38-46 even | Same (nothing of this lane's draws there on Medium) |
| **Phone results** | 39, 41, 43, 45, 47, 48-52 | **Much better, the largest gain in the set**: "the rider and the finish are finally visible above the card"; "in all of 48 to 52 and in 45, 47 and 39 the screen now shows the rider and the place; the before showed neither". Exceptions in the fixed frames: 41 (the card's edge at the hips) and 43 (caught mid-fade), both the swing still moving when the fixed frame is taken |

What broke, worst first, as it ranked it: (1) the lemon stripe; (2) hard-edged halo discs round the sun and the moon;
(3) the results card over the rider in two fixed frames (timing) and the pom-pom touching the headline (45); (4)
Cinder Gate's dark floor patch; (5) a beige pool round the sled on the crevasse ice (12); (6) near-lens embers and
confetti read as lens dirt; (7) flat washes (the torii's floor, a pink near snow on Lanternfall's street); (8) Sakura's
snow yellow on the phone (44); (9) the lens pitched down in some early frames; (10) all five results the same
composition. It saw **no painted rim on the rider in any after frame**, and asked for the three planes as three flat
values, the hero's rim, and street lamps as two-value amber pools.

### What changed after it (`a0ee35b`)

- **Frostfang's band is a thin line again**: a printed line of the band's colour only along the ridges, over its own
  soft glow (`stripe` 0.6, the line about half the old stripe's height and at six tenths of its weight), so the
  run-in's sky narrows to it.
- **No hard discs round the sun or the moon**: the poster's rings are off everywhere (`rings` 0; the code stays), so
  the scatter is the smooth, wider gradient on the dome ART.md 15 asks for.
- **The hero's rim strong enough to see**: a crisper band from further in (from 0.48 of the edge), never under 0.6 of
  its strength off the light's side, at three times a prop's weight; still the outer facets only.
- **No painted sun shafts under a roof**: the sun's fan scales with the set pieces' `light.shade`, so the Thousand
  Torii's own bars of light and the cavern's mouth carry those places (pair 27's cream wash).
- **Softer snow steps, none on Sakura**: a third of a step soft (was a seventh), so the banks' macro tone no longer
  prints as camouflage (29); Sakura's snow keeps its smooth light.
- **Cast shadows only a little harder** (`edge` 0.2, was 0.55) and Ember's lean halved: Cinder Gate's wall shadow is a
  soft shade again (19).
- **On a phone the rider sits a little lower under the headline** (`BAND_AIM` 1.36), so the pom-pom clears it (45).
- Not changed, and why: the beige pool round the sled (12) is Low's painted local light from the run's own moment
  (a light taken, a ward), designed in round 7 and in the before's nearby frames too; the near embers and confetti
  are the particles' and the finish's own; Sakura's yellow snow on the phone (44) and the pitched-down lens (3, 9,
  10, 24) are the capture's place and clock (nothing of this lane draws on Medium in a run, or moves the chase lens);
  41 and 43 are fixed frames taken while the finish swing still moves (the settled results, 48 to 52, are whole).

**No second critic.** The fixes were reshot on the final build (`after-r2low`, the whole fixed list, and
`results-after-r2`) and a second fresh critic was briefed on 42 pairs (`pairs-r2.txt`), but it could not run (the
account's weekly limit). What I checked myself, before beside after-r2 at the same distances: Frostfang's band is a
thin lemon line along the ridges over its glow (150 m, 3549 m); no disc round the sun at Mirror Lake (1763 m) or the
moon at the Crown (565 m); Cinder Gate's floor has its soft shade again, no scalloped patch (1316 m); the Thousand
Torii's bars of light read on the floor with no wash over them (1754 m); Sakura's banks are smooth (3060 m); the
rider carries a thin silver line along the tops of both arms and the coat's sides at the Crown (565 m, 2x crop), the
coat still navy; on the phone the pom-pom clears the headline on all five results. Not seen by any critic: whether the
hero's rim now reads at a glance, and whether Low as a whole now reads as a designed poster (the first critic's
"same" on Ember, Sakura and Lanternfall stands).

## Cost

**Draws and triangles**, mean over the fixed frames from the frames' JSON (the renderer's counter summed over every pass
of a frame), round 7's final against this lane's `9bea2d8` (181 frames a tier) and, for Low, the final build
`a0ee35b` (`after-r2`):

| Tier | Round 7 final: calls mean (max), triangles | `9bea2d8` | `a0ee35b` (final) |
| --- | --- | --- | --- |
| Low, Pinecrest | 45.8 (51), 143,997 | 48.0 (53), 146,359 | 47.4 (55), 142,680 |
| Low, Frostfang | 53.5 (63), 142,045 | 49.0 (55), 128,248 | 48.3 (55), 126,742 |
| Low, Ember | 47.5 (58), 111,071 | 49.8 (56), 108,311 | 47.2 (52), 104,228 |
| Low, Sakura | 49.4 (57), 132,152 | 48.7 (55), 126,945 | 47.8 (54), 124,723 |
| Low, Lanternfall | 49.3 (55), 125,094 | 49.0 (54), 121,401 | 48.9 (52), 121,264 |
| **Low, all 181** | **49.1** | **48.9** | **47.9** |
| Phone on Medium, all 181 | 89.1 | 88.8 | (unchanged in a run) |

- Low's poster is **one draw** on Low (the frame's quad and every card in one mesh, 68 vertices, 34 triangles), drawn
  whenever its foot is on (every Clear Skies mountain); the shafts add nothing to it. The means move inside the
  run-to-run spread of what is in view (ghosts, set pieces, the race), as round 7's lanes found: Frostfang's before
  drew more in its places and fewer here, Pinecrest and Ember one or two more. Within the brief's "at most two more
  while visible". The phone on Medium draws nothing new (its change is the results' layout and lens).
- **Nothing before the first frame**: the poster's mesh is made (no GL work) with the world and joins the scene on idle
  time after Low's first frame, its program built with `compileAsync`; Medium, High and Ultra never compile it. The
  three shared uniforms ride every toon and snow material (a Vector4 each, unchanged frame to frame, so three's cache
  skips their upload) and the chunk is one compare a fragment on the other tiers.
- **Script a frame on Low at 6x** (`systime.js`, three interleaved passes a build on Sakura and two on Pinecrest,
  base `c00d369` at `/base/` and this lane's build at `/`; mains power but **the CPU at 100% from the other lanes**
  throughout, so the passes swing by half from one to the next on the same build):

  | Mountain | Build | world.frame ms (each pass) | renderer.render ms | the poster's update |
  | --- | --- | --- | --- | --- |
  | Sakura | base | 12.18, 7.88, 16.18 (mean 12.08) | 3.25, 4.51, 8.86 (5.54) | |
  | Sakura | lane | 18.35, 8.88, 11.35 (mean 12.86) | 8.48, 5.35, 5.76 (6.53) | 0.02 |
  | Pinecrest | base | 7.67, 15.64 (mean 11.66) | 3.71, 10.46 (7.09) | |
  | Pinecrest | lane | 15.27 (one pass; the other timed out loading) | 7.52 | 0.03 |

  Read: the poster's own update is 0.02 to 0.03 ms a frame at 6x (timed exactly); everything else here is inside the
  sitting's noise, which is larger than any difference one draw could make (the same build's frame moved 7.9 to
  16.2 ms between passes). Round 7's own Low bar ("about 10 to 12 ms") needs a quiet sitting on mains to call; this
  one was not quiet.
- **The draw priced inside one run** (`drawcost.js`: Low at 6x, the poster drawn on even frames and hidden on odd
  ones, `renderer.render` timed exactly on each over 30 s, so the run's drift falls on both alike): Sakura 5.13 ms
  drawn against 5.88 hidden and 6.31 against 6.68; Pinecrest 5.77 against 6.02 and 4.54 against 4.56 (575 to 726
  frames each). The frames that draw it are never slower: its price is under what a run resolves, and the parity of
  frames moves the render more than it does.
- **The console was clean** in every capture (the frames' JSON, Low and the phone on Medium, both builds: 0 errors)
  and on a cold start on Low and on Medium (`vl-poster-cold`: 0 errors, 0 warnings).

## Shared code touched

Every edit outside the lane's own files is the smallest that does the job and carries a comment naming the poster
lane. Nothing below changes what Medium, High or Ultra draw, except the phone's results lens (any tier on a phone).

| File (owner in vl-lanes.md) | Change | Effect |
| --- | --- | --- |
| `palette.ts` (poster: `tierLook`, Low's fields) | `PosterLook` and `Palette.poster` (base defaults; per mountain in `clearSkies`; Blizzard's in the mood); `tierLook` grades `poster.shadow` | Read on Low only |
| `materials.ts` (poster: Low branches in their own chunk) | `POSTER_GLSL` (its own chunk: `posterRim`, `posterValue`, `posterShadow`, `posterShade`), three shared uniforms (`uPoster`, `uPosterShade`, `uPosterSnow`) and `posterFrame`, set in `setCloudShadows`/`applyPalette`; the toon material includes the chunk and calls `posterRim` once before its fog (`HERO` define from a new `hero` option); the snow material includes it and calls `posterShadow` after the wall's shadow, `posterShade` after the shade's sky term and `posterValue` before its lit/shade mix | Every function returns its input unless `uPoster.x` is 1 (Low): one compare a fragment elsewhere |
| `sky.ts` (poster: Low's path) | `uPosterSky` and `posterSteps` in the dome; the gradient's `t`, the band's weight and the near glow go through them when set | Low only (`setDetail`) |
| `world.ts` (temporal: render targets; farlight: shadow setup) | Constructs `PosterLayer`, tiers it in the constructor and `setQuality`, enables layer 5 on the chase camera, updates it before `post.render` (with the set pieces' `light.shade`); the C6 band reads `RESULTS_BAND` (was 0.28, cap 0.4 to 0.56) | Low draws one more call; the phone's results band |
| `rider.ts` (temporal: hooks for motion) | `riderMaterial` passes `hero: true` to `makeToonMaterial` | The rider's materials compile the `HERO` define; on Low its rim is the hero's |
| `stages.ts` (no lane) | On Low only, the Ice Cavern's mouth offers itself to `pushShaftSource` while the rider is inside (`SHAFT_GOLD`) | Low paints the mouth's shafts; Medium and High never get the push, so their shafts pass (which does read `shaftPlace`) is unchanged |
| `camera.ts` (temporal: hooks for motion) | `FINISH_R_PORTRAIT` 6.6 to 9.2 m; `BAND_AIM` 1.36 (was an inline 1.14) for the finish and the hero shot on a phone | Every tier on a screen held upright, results only |
| `ui/contract.ts`, `ui/style.css`, `ui/meta.css` (poster: results on a phone) | `RESULTS_BAND`; the portrait results rule (44%, the scrim); the ladder strip's portrait rules | Phones |
| `scripts/playtest/systime.js` | `'poster'` among the systems it times | |
| `scripts/playtest/round-sheets.sh` | Optional tiers and labels (round 7's call unchanged) | |
| `src/render/poster.ts`, `tests/poster.test.ts` | New, this lane's | |

**For the merge.** The `farlight` lane's far shadow field: where it is read on Low, fold it into the snow's `shadow`
before the line `shadow = posterShadow(shadow);` and Low paints it with the poster's edge and colour; the other
tiers are untouched by those lines. The `light` lane edits `materials.ts`'s shading too: the poster's calls sit at
three single lines of the snow shader and one of the toon shader, each with a comment. If `pushShaftSource` is later
used on Medium and High (the shafts pass reads `shaftPlace` already: `pipeline.ts` raises `f.shafts` with it), the
cavern's push is Low only and changes nothing there.

## What is still short

- **Low is still mostly the same picture on Ember, Sakura and Lanternfall.** The critic's verdict there was "same":
  their grades paint no sun shafts (Ember's deck and the nights have none to paint; Sakura's 0.7 is thin by design),
  so what Low gained on them is the rim, the foot and the sky's steps, which read at a glance only on a sky-filled
  frame. The poster's next steps, by the critic's ranking:
  1. **The three planes as three flat values.** The open-slope frames are still one white-to-lilac wash from the
     lens to the far range. A stepped fog was weighed and not built: on a continuous slope it draws contour lines
     across the snow (an artefact, not a plane). The planes need the middle ground's own flat value (`midground.ts`,
     `massif.ts`: their colours on Low a step toward the air) rather than a stepped distance.
  2. **The hero's rim**: the critic saw none on `9bea2d8`; the band is crisper and stronger since (`a0ee35b`), still
     on the silhouette's outer facets only (the coat is never cream), and needs a second look in motion.
  3. **Streets as two-value amber pools**: Low's painted pools (round 7, `lights.ts`) are faint under a day grade
     and the critic found none in any street frame; a poster would lay them stronger under the windows and lamps.
- **The far shadows**: designed for (colour, edge, the hooks in the snow shader), not seen: they come with the
  farlight lane. Until then Low's only cast shadows are the ravines' walls and the sled's painted blob.
- **Only one bright place offers itself.** The Ice Cavern's mouth on Low. Ember's lava tunnel mouth (Cinder Gate) is
  not built on Low at all, and the Thousand Torii's gaps are many places, not one; neither has painted shafts.
- **The phone's results all frame the same way** (rider centred, the finish's grandstand behind, little sky): each
  mountain's landmark over the rider would make them its own (the finish lens's framing, `camera.ts`). The first
  view of the card on a phone is shorter: the unlock card and the stage splits now sit under the fade.
- **The phone in the race**: the HUD's stack still covers the top fifth of the sky, and the lantern button sits by
  the rider's right mitt in some frames (`touch.ts`); not this lane's change, noted from the critics.
- **Cost not settled on a quiet machine** (see Cost): the sitting ran with the CPU at 100% from other lanes.
- `poster.rings` (the scatter in rings) is built and off everywhere after the critic; `posterSteps` there is a
  palette switch away if a designer wants it back for one place.

## Where the frames are

All in the main checkout, `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\vl\poster\`:

- `after\low`, `after\phone-medium` (and their JSON: calls, triangles, console errors, all 0): the fixed frames on
  `9bea2d8`, the set the critic judged. `after-r2\low`: the same list on the final build (`a0ee35b`).
- `results-before\`, `results-after\`, `results-after-r2\`: the phone's settled results over a finish on each
  mountain (base `c00d369`; `9bea2d8`; the final build).
- `pairs.txt`: the critic's 52 pairs; `pairs-r2.txt`: the second critic's 42, on the final build (not judged).
  `sheets-r2\`: Low's contact sheets on the final build, r7- beside vl-, every mountain. `sheets\`: the first set
  (Low and the phone on `9bea2d8`), partial: the tiler timed out on some sheets while the machine was loaded.
- `tools\`: the lane's capture scripts (`settled.js`, `vary.js`, `probe.js`, `drawcost.js`, `systime-ab.sh` and its
  digest, the critic's prompt). `look\`, `look2\`, `q1` to `q5`, `v1` to `v3`, `s1`: the probes on the way.
