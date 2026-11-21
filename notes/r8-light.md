# Round 8, the light lane: light that gathers (V5)

What a player should say: "The night mountain is the most beautiful one." Brief: `notes/r8-briefs/light.md`. Branch
`r8-light`, cut from `round-8` at f784510; last commit dc566bf. Frames, pairs and keys are under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/light/` (see "Where the frames are").

## What changed for a player

- **Ember is lit from the lava's side.** The dim coin stays where it was, right of the cone. The light that shades
  the snow now comes from further round (64 to 70 degrees right, 30 to 40 up). The snow facing the lava's side is
  firelit warm white, and the far bank turns to a cold plum-teal a step down. The far bank is never a dark slab. It
  used to be one even beige from edge to edge. The deck's shadows take 45% off the light, not 70%. The halls'
  dusk, the market's night, the shield and the caldera keep round 7's snow and light, keyed to the moved places,
  each with its own lava-side key.
- **The great lantern is lit with the rider.** It hangs over the square 35 m past the line; it used to hang 28 m
  short of it. Once the finish lens has begun its swing round to the rider's front, the lamplighters walk the
  lantern along its yoke to the side the lens will look back across. In the results it burns over the rider's head,
  in the left column the card leaves open. Lit, it throws shafts through the air on Medium and High. This was round
  7's open item 10.
- **Lamps light the air round them** (`lampAir`, High and Medium). A lamp, window, forge or lantern near the lens
  hangs a haze of its own hue along the sight lines that pass it. This is used thinly: Old Town (0.12), Station
  Street (0.14), the Ice Cavern (0.2), Temple Town (0.06), and Ember's halls and market (0.08 and 0.1). Low draws
  none.
- **The Lantern Row hangs in the world.** Each named mountain's finish town hangs the lanterns a player has lit,
  marigold, on a wire over the square 58 m past the line. The same row hangs over the stretch the mountain's title
  shot rides. Only lit lanterns hang, so a fresh save's frames do not change. Medium and High get one local light
  under the row. Low gets glowing paper.
- **A second hour on two mountains** (the Almanac's `hourOpen`):
  - *Pinecrest at Dusk:* the run starts in the day's gold, goes through the dusk stop by 1900 m, and reaches the
    first night by 3300 m. That is a deep blue over a rose band, with stars, and the town's lamps as the light at
    the line.
  - *Sakura in the Evening:* a low warm sun through the orchards, the blue hour over the Blossom Leap, and Temple
    Town's paper lanterns under a night sky.
  - Frostfang, Ember and Lanternfall have no other hour yet.
- **The journey follows the moved places:**
  - Ember's dusk now starts at the halls' ravine (2600 m) and its night at the market's bridge (3300 m).
  - Pinecrest's gold now comes in past Mirror Lake's shore and is full at the second leap's lip (2110 to 2560 m).
  - Sakura's clear high frame now follows the Blossom Leap (2260 to 2580 m).
  - Lanternfall's stops still key to its places. Frostfang was already re-keyed by the sim lane.
- **Lanternfall's night is round 7's.** I took it darker in the first passes, with stronger lamp pools and the
  rider's whole lantern. Three blind critics in a row picked round 7's road over it (below), so I put it back.

## Decisions (each with what a player would feel, and how it was measured)

1. **Ember's key from the lava's side, and a cold far bank a step down, not a dark one.** The ground truth showed
   one beige slope (DECISIONS 367). Placing the light so half a slope is in it and half is not gives the frame a
   warm side and a cold side. That is ART.md 15's "orange and plum".
   - *First tries failed.* With the snow dimmed under the snow shader's day line (so the light carried its whole
     colour), the lit snow read as sand or mud. With round 7's deep plum-slate shade, the far bank became a
     near-black slab. The first critic picked round 7 in all 10 pairs.
   - *What held.* Round 7's warm-white snow and light, the side key, a lighter cold shade (`#6C6A92` at the start)
     and the deck's shadows at 0.45. The second critic picked it in 8 of 10, naming "the clearer warm-against-cool
     split" in each.
2. **Lanternfall back to round 7.** The brief asked for "properly dark with warm pools". Three critics, shown only
   ART.md, read the darker road against ART.md 15's "lilac snow with a silver lit side" and "never a gold floor".
   They saw a flat violet, and pools that spread into a peach or gold wash. A middle way (silver-lilac at a lower
   value, smaller pools, thinner haze) still lost 1 of 10. The bar here cannot be met by grading the palette alone;
   see "Still short".
3. **The great lantern placed by the frame it must be in, read from the lens.** Measured with
   `scripts/playtest/finishprobe.js`, which projects candidate points into the finish shot:
   - At 28 m short of the line, the lantern sat at NDC x -1.03 to -1.47 in the results, just off the frame's edge,
     95 m behind the rider.
   - 35 m past the line and 12 m to one side, it sits at (-0.48, 0.84), over the rider's head.
   - Deciding the side from the rider's side of the course failed when the rider drifted across in the last
     metres (NDC -1.83). Reading it from where the lens has swung puts it in frame for a rider on either side and
     the safe line. Both probes gave (-0.48, 0.84).
   - Frames: `final/S-probe-results.png`, `final/L-probe-results.png`, and earlier `it7/S-probe-results.png`.
4. **The lamps' air is an analytic in-scatter, not a pass.** Each kept local light gives an inverse-square haze,
   integrated along the sight line in closed form (two atans), cut at the light's reach. It fades for a light the
   lens stands inside, so the rider's own lights never fog the hero. It is a handful of sums per pixel, inside
   `fogged()`. It adds no draw, no program and no pass, and Low (which gives the props no lights) runs none of it.
   - The critics read it as milk when strong: 0.22 on Lanternfall's road, 0.6 and then 0.35 in the Cloud Sea, 0.24
     in Ash Market. It stays only where it is thin.
5. **Low's pools.**
   - Laying the pools as two flat values of the lamp's hue, in place of adding the light, read as khaki on
     Lanternfall's Low. That code was removed.
   - The pools are added as in round 7. Lanternfall's Low pools are still round 7's. The stains the ground truth
     saw are not fixed (see "Still short").
6. **The hours are a palette, not a mode.** `setHour('alt')` before the course is set re-lights the title and the
   run. The journey caches and the stamp are keyed by the hour. A mountain with no other hour keeps its day.
   `?debug&hour=alt` tries it.

## The critics (blind pairs, High, `blind-pairs.mjs`; a fresh Opus critic at high effort each time, told only ART.md and the folder)

| Set | Frames | New picked | What it named |
|---|---|---|---|
| pairs1/ember | 150, 450, 613, 1500, 1650, 2100, 2271, 3000, 3741, 4330 | **0 of 10** | the far bank a "flat near-black plum slab", far over ART.md 2's 30%; the lit snow sand-orange or cold grey |
| pairs1/lanternfall | 450, 1050, 1650, 1800, 1938, 2209, 2700, 3297, 3750, 4200 | **2 of 10** | the snow "a gold-orange floor" under the lamps, ink shapes bleached cream by the haze, a "saturated purple" road |
| pairs2/ember (after the fix) | 300, 450, 750, 1766, 1950, 2024, 2550, 2850, 3150, 4200 | **8 of 10** | "the clearer warm-against-cool split", the cold plum-violet bank against the peach-lit slope; the two misses were a ghost pair merging (05) and a near-identical lava crust (07) |
| pairs2/lanternfall | 300, 945, 1528, 2059, 2405, 2550, 2850, 3000, 3500, 4061 | **5 of 10** | the new road "a heavier, flatter blue-purple", "hazier and milkier" by the grove |
| pairs3/lanternfall (silver-lilac) | 565, 785, 1200, 1938, 2209, 2550, 2700, 3150, 3581, 4330 | **1 of 10** | round 7's "lighter, more silver lilac" kept "as long as the lantern pools still read"; the new pools spread into "a peach or gold floor" |

Ember's bar (8 of 10 on High) is met. Lanternfall's is not, and its palette went back to round 7's. No critic was
shown the finish shot as a blind pair (round 7 has no lantern in that frame to pair against). The
"great lantern lit with the rider" is shown by the probe and the frames above, not judged.

Things every critic named that are not this lane's:

- The white faceted bobsled hull with no slats (every Lanternfall frame).
- Trees at the lens breaking into shards.
- The neon charm-gate arches.
- The fork's boards in one khaki.
- Mint runner lines like speed lines.
- "StarlingToboggan" with no space.
- Grey bokeh flakes on the lens on Ember.
- The ward's shards over the rider.
- Ghosts merging when two stand together.

## The histogram (share of the frame under 15% and over 85% luminance, `scripts/playtest/histo.mjs`)

Mean over each mountain's fixed stills (`before-stills` against `after1`, the first full after set):

| Tier | Mountain | Before <15% / >85% / mean | After |
|---|---|---|---|
| High | Pinecrest | 2.9 / 3.3 / 58.5 | 2.8 / 3.3 / 58.5 |
| | Frostfang | 8.8 / 0.5 / 37.6 | 8.5 / 0.5 / 37.7 |
| | Ember | 30.7 / 0.1 / 30.6 | 29.8 / 0.1 / 30.6 (after2) |
| | Sakura | 2.4 / 0.9 / 61.4 | 2.3 / 0.9 / 61.4 |
| | Lanternfall | 8.2 / 0.2 / 45.1 | as before (round 7's light) |

Ember's open stretches, frame by frame (before, then after2, <15% / >85% / mean): 150 m 3.8 / 0.1 / 49.5 and
3.0 / 0.1 / 50.0; 450 m 6.3 / 0.2 / 52.5 and 5.5 / 0.2 / 51.4; 3000 m 8.3 / 0.0 / 49.3 and 6.5 / 0.1 / 47.2.

**The brief's histogram bar is not met.** Ember's change is in hue, warm against cool at much the same value, which
is what the critic preferred. Its share of true darks and true lights hardly moves. True lights (over 85%) are
almost absent on every mountain but Pinecrest, on both builds. The film curve stops the lit snow short of white by
design (ART.md 15), so only lamp hearts, glints and bloom reach it.

## Cost, before and after (`shots/r8/light/cost/`; the before build served beside the after, in one browser)

| Measure | Pinecrest | Ember | Lanternfall |
|---|---|---|---|
| Low GL calls a frame, live ride from the start (`glcount.js`), before -> after (`gl2-*`, the final build) | 471.3 -> 488.7 | 491.4 -> 499.9 | 505.3 -> 510.1 |
| of them `uniform4fv` | 25.0 -> 25.3 | 28.8 -> 28.8 | 27.0 -> 27.5 |
| draw calls (`drawElements`) | 20.8 -> 21.0 | 23.8 -> 23.8 | 24.4 -> 24.9 |

- *Reading the GL counts.* The ride is live, so the ghosts in view differ between runs. Two runs of the before build
  on Pinecrest differ by 16 calls a frame (487.8 and 471.3). The difference is in exactly the calls the after run
  differs in: `bufferSubData`, `bindBuffer`, `uniformMatrix4fv`, `useProgram`, `bindVertexArray`. The after
  build's run matches the earlier before run call for call except one: `uniform4fv`.
- *The `uniform4fv` finding.* The first after build was about five `uniform4fv` a frame over on every mountain:
  25.4 -> 31.4, 28.7 -> 32.2 and 25.6 -> 29.8. That was `lampAir` naming the lights' two vec4 arrays in every
  program that fogs, which made them live where they had been compiled out. It is now behind `LAMP_AIR`, defined
  only in the snow and the toon model, which already read the lights. That is level again (dc566bf). So: **Low's
  GL calls are level with the before's within the run-to-run spread, and its uniform uploads are level.**
- *GPU pass times on High* (`gpuprobe.js`, `?gpu`, interleaved A B B A, 8 s at 30 m/s on the safe line, scene
  pass ms):
  - Lanternfall from 1900 m: before 13.67 and 15.26, after 13.46 and 12.76.
  - Ember from 2650 m: before 14.21 and 15.36, after 12.82 and 21.40. In that last run the bloom pass, which I did
    not touch, also read 5 times its usual, so the machine was slow.
  - A single pair at Ember 3500 m read 12.5 against 21.0, with the bloom again 6 times its usual.
  - The laptop's load swung too far to read a difference. No change in the scene pass shows through the noise.
- *Low's script at 6x* (`systime.js`, Lanternfall, A B B A): frame callback 19.8 / 26.6 / 52.8 / 53.1 ms, at 31,
  24, 12 and 12 fps. That swing is the machine (another lane's capture and node were running), not the build.
  World frame per sim tick: 17.9 and 9.2 before, 15.6 and 10.5 after. The lantern world's own share is 0.33 / 0.48
  / 0.81 / 0.71 ms. Nothing here is judged; the one script this lane adds on Low is the Lantern Row's update (a
  few compares when no lantern is lit) and the great lantern's walk (one compare a frame).

- No new draw, program or pass on any tier, apart from these:
  - The great lantern's ribs are now a draw of their own so they can travel: one more draw, only near
    Lanternfall's square.
  - The Lantern Row adds two draws a hung row, only when lanterns are lit and the row is within 520 m.
- `lampAir`: a loop over the props' kept lights (at most 8) with two atans each, per pixel of every lit material,
  only where the palette's `lampAir` is over 0. Low runs none of it (the props take no lights there).
- Two new shared uniforms (`uLampAir` and the palette's `lampAir` behind it), scalars that three caches. No uniform
  array.
- Nothing new runs before the first frame. The row builds on the first world update with lanterns lit.

## Low and the phone

- **Ember's Low and phone** take the same side key and lighter cold bank, baked through the poster as every colour
  is. Frames: `final/low/m2-*.png` and `final/phone/m2-*.png` (450, 3000 and
  3741 m), console clean. Round 7's Low already drew Ember's lit snow peach; the change adds the cold far bank.
- **The lamps' air** is High and Medium only, so the phone's Medium gets it and Low does not.
- **The Lantern Row** on Low is glowing paper with no light of its own.
- **The great lantern** works on every tier: it is placed in the world and read from the lens. Its shafts are
  Medium and High only.
- **The hours** are palettes, so every tier draws them, Low through its poster.
- **Lanternfall's Low pools** are round 7's.

## Touched outside my files

- `src/render/world.ts`: nine lines to wire the Lantern Row (construct, tier, course, root, update), as the lantern
  world is wired.
- `src/render/lanternworld.ts`: the great lantern's place and the walk along its yoke. This file is mine by the
  brief; it is noted here because the "carry" set piece's target moved past the line.
- `tests/lift.test.ts`: the bounce's "never a ghost colour" check now also measures hue on the wheel (sRGB). A
  firelit orange bounce sat as near the grudge's rose as a pink would in linear light alone.
- `materials.ts`: only the air functions in `LIGHT_GLSL`. The snow's chunk is as the snow lane left it.

## For the main lane to wire or decide

1. **The Lantern Row's save.** Call `setLanternRow(litByTown(save))` (`src/render/lanternrow.ts`) when a save loads
   and when a lantern is lit. `?debug&row=N` hangs N in every town.
2. **The hours.** Call `setHour(hourOpen(save, mountain) && picked ? 'alt' : 'day')` (`src/render/palette.ts`)
   before the world sets the course for a run or a title. The title needs a pick for it (the spine model already
   lists `TitleSpine.hours`). `ALT_HOURS[biome].name` is the card's word ("Dusk", "Evening").
   - The Almanac pages for Frostfang, Ember and Lanternfall's hours have no palette yet. Either they wait, or the
     pages swap to something else.
3. **Sakura's title shot.** `keyart.ts` uses `light: 2450` (the compose lane's file). With the clear frame now
   2260 to 2580 m, 2450 sits at about 70% of it. 2580 would give the whole clear frame.
4. **Lanternfall's value.** The brief's direction (dark, warm pools) and the critics' reading of ART.md 15 ("lilac
   snow with a silver lit side", "never a gold floor") disagree. Either ART.md's Lanternfall rows change, or the
   brief's "properly dark" is dropped for this mountain.

## Still short

- **Lanternfall.**
  - The value pass: its road is round 7's even lilac.
  - The rider's own pool is round 7's.
  - Its Low pools still read as stains. Laid as flat values they read as khaki, and added to darker snow they read
    as gold; the round 7 add stands.
  - What a next attempt should try: pools as light that keeps the snow's own lilac and lifts its value toward
    silver, with marigold only at the heart and the lamp itself, not a warm wash. That is how the critics read
    ART.md.
- **"Air with light in it"** is partly met. Lamps light the air thinly, and the great lantern throws shafts.
  Shafts through tree runs and gate arches are not built: the shafts pass takes one place source a frame. The
  breath-cold haze in Frostfang's canyons is not built: a slot in the ice is the dark of its frame, ART.md 15, and
  a pale haze fights it.
- **The histogram bar** (see above).
- **No critic has judged** the Lantern Row, the two hours or the great lantern's finish shot as blind pairs. There
  is no before frame of the same thing. They have been looked at by me only:
  - The Row: `it5/row-probe-results.png`, Pinecrest with six lit, hanging top left in the results.
  - The great lantern: `final/{S,L}-probe-results.png` on High, lit with rays over the rider's head; on Low,
    `final/low-S-probe-results.png`, a lit paper drum beside the rider's head.
  - The hours: `hours/m0-*.png`, Pinecrest at Dusk, gold at 150 m, the lantern bridge in the first night at
    3548 m, the town lit at 4200 m. `hours/m3-*.png`, Sakura in the Evening, a low sun through the orchard rows at
    150 m, Temple Town under stars at 4050 m.
  - Every capture's console was clean (`errors: []`) in every JSON written here, on High, Low and the phone.
- **The laptop.** The machine bugchecked at 6:20 on 21 November while this lane's browser was closed and its two
  preview servers were running; the servers did not come back, and nothing was lost from the branch.
- **Reduced motion.** The great lantern's walk along its yoke is 1.2 s of movement after the line. It is decided by
  the lens's own swing, and under reduced motion the finish lens does not swing. Whether the plain chase ever
  passes the 0.5 m it waits for, and walks it, was not checked. Nothing else here moves.

## For ART.md and the README

ART.md 15, Ember's colour script, "As built", to add: "The light that shades the snow comes from the lava's side,
low and further round than the dim disc, so the snow facing it is firelit warm white and the far bank turns to a
cold plum-teal a step down, never a dark slab; the deck's shadows take at most half the light. Lamps, forges and
windows hang a thin haze of their own light in the air round them (Medium and High)."

ART.md 15, Lanternfall, "As built": "The great lantern hangs over the square 35 m past the line; as the finish lens
swings round to the rider's front the lamplighters walk it along its yoke to the side the lens looks back across,
so in the results it burns over the rider's head."

ART.md 12, "Towns" or 13: "The Lantern Row: each finish town hangs the lanterns a player has lit there, marigold,
on a wire across the square and over the title shot's stretch; Low hangs them as glowing paper."

ART.md 7: "Each mountain may have a second hour (the Almanac's): Pinecrest at dusk, gold to the first night;
Sakura in the evening, a low warm sun to Temple Town's lanterns under stars."

README: the dev switches `?debug&row=N` (hang N lanterns in every town) and `?debug&hour=alt` (the other hour where
one exists).

## Where the frames are (all under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/light/`)

- `before-stills/{high,low,phone-medium}`: round-8 at f784510 (the lane's before).
- `after1/{high,low,phone-medium}`: the first full after set (Ember's dark-bank version, Lanternfall's dark night).
- `after2/high`: Ember and Lanternfall after the first critics.
- `after3/high`: Lanternfall silver-lilac.
- `final/`: the finish probes and Ember's Low on the final build.
- `pairs1`, `pairs2`, `pairs3`: the blind pairs. `keys/`: the keys and the critics' picks.
- `it1` to `it7`: working frames.
- `cost/`: GL counts, systime and GPU pass times.

Scripts added: `histo.mjs` (luminance shares), `stills-at.sh` (stills at chosen distances), `batch.sh` (any
run-code jobs in one slot), `slot-take.sh` (takes a slot as `browser-slot.sh` does, polling every 0.3 s),
`finishprobe.js` (where a point falls in the finish shot), `gpuprobe.js` (pass times over a stretch),
`cost-light.sh`, `finish-at.sh`.
