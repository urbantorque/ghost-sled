# Round 7, the `lanternworld` lane: Lanternfall's own world

Branch `r7-lanternworld`, cut from `round-7` at 9ec0892. Render, audio tables and one type in the sim: nothing that
affects a run. Frames are in the main checkout under `shots/r7/lanternworld/` (git-ignored). Nothing here has been
played by a person: every picture comes from the fixed-frame capture (a sled pinned to the safe line at 30 m/s).

## For a player, in short

- Lanternfall no longer wears Frostfang's look. It is a night mountain: an indigo sky with stars and a great pale
  moon, lilac snow with a silver lit side, ink for everything that stands, and marigold as the world's own light.
- From the Crown the cloud lies below as a sea, lit warm from beneath in pools. The dive off the first lip goes
  into it: the air closes to about forty metres and lamps loom as halos and pass.
- A breath before the second lip the cloud lets go, and the whole valley is full of rising lanterns under a dark
  deck. Six thousand of them on High, one draw.
- Lamp towers, standing stone lamps, bell frames, arched bridges of lights, a canal carrying lights, a town of
  timber and lit paper, lamplighters with their poles, and a great lantern over the square that lights at the line.
- The three set pieces are drawn as light: a guide lantern and its wake on the snow, stone lamps that catch as
  you pass and a road that blazes when won, a flame on the sled that gutters and catches again.

## Decisions

LW1. **`'lantern'` is a `BiomeId`.** `mountains.ts`: `BiomeId` gains `'lantern'`, `CourseBiome` is now the same
    type, `LOOK` is gone and `lookOf` returns its argument (kept so `course.ts` is untouched). Dailies still draw
    from the four (`BIOMES` is unchanged). The sim reads `params.biome` as before, so no course, pool or record
    changes: `tests/determinism` and the pools pass as they did. Every `Record<BiomeId, ...>` the compiler listed
    is filled, and every `biome === ...` chain that would have fallen through to Sakura's or Pinecrest's look has a
    Lanternfall branch (the list is under "Touched outside my files").

LW2. **The colour script, to ART.md 15** (`palette.ts`: `biomeBase`, `clearSkies`, `round7`, `JOURNEY.lantern`,
    `PLACES.lantern`).
    - *The Crown* (the start): zenith #0B0A3E, a moon at 19 degrees right and 15 up (1.75 times the stock disc),
      stars at full, snow #E8EAFC lit and #685CC0 in shade, trees #1C1934, rock #242040, the far air #221C6A.
      The key light is lifted to 42 degrees so the slope's own face is the silver one. `accentProp` is bronze
      (#B88A4A): the run's gates were vermillion, and on this mountain the rider's is the one red.
    - *The Cloud Sea* is a place that is not a section, so `Place` gained an optional `span(course)`: it lies
      from 55 m past the first lip to `CLOUD_BREAK` (80 m) short of the second, comes in over 150 m and lets go
      over 50. Fog 2 to 44 m in white-violet (#B6AEE6), a full deck, no stars, the panorama veiled, hazards kept
      dark in the murk (`hazardFog` 0.5), ghosts and gifts blazing. Its stamp steps finer (240 against 64) because
      the whole picture changes over it.
    - *Under the deck* is the hour's first stop, ridden blind inside the cloud (900 to 1420 m): the moon gone, a
      deck at 0.92 in dark violet with a dusk-rose underside (#A0607A), no sea, the valley's light from below
      (`under` 0.14 in marigold), the panorama veiled 0.6 so the lanterns are the brightest thing in the frame.
    - *The break* (the second leap's place): the air opens to its widest on the mountain (fog far times 1.6).
    - *Streets, bridges, the lamp grove, the finish*: lamps at 1.0 to 1.15, a warm split tone on the lit values
      only.
    - *Firstlight to the line*: the deck thins (0.62, then 0.3), and from 3900 to 4460 m the east goes rose
      (horizon #DC8CA0, a band #FFC09A) under an indigo that keeps a quarter of its stars.
    - `journeyDusk('lantern')` is 1 from the first metre: its windows and lamps are always lit.
    *What the first frames showed and what changed:* the first pass had a pink sky at the Crown, an orange sky
    under the deck (the deck's glow at full marigold), and a valley of lanterns nobody could see (a pale panorama
    behind additive lights). The second darkened the night, took the deck's glow down to rose and removed the sea
    under it; the third made each lantern cover what is behind it before it adds its light (premultiplied
    blending), which is what turned the valley from snowfall into lanterns.

LW3. **The cloud sea** (`lanternworld.ts`, `massif.ts`).
    - From above: three sheets of billows 10 and 24 m apart (one on Low, two on Medium), in the gouache's three
      values, the crests alone on the top sheet and the floor whole, moonlit on the side that faces the moon.
      They follow the lens and fade into the dome's own sea at 2.6 km.
    - Lit from beneath in pools: the same world-anchored noise in the sheets and in `SEA_GLSL` (a new uniform,
      `uSeaWarm`, black on every other mountain; `massif.seaWarm` in the palette), so the pools hold their place
      while the billows drift over them, and the near sheets and the far sea agree.
    - Inside: the palette's fog, and banks of thicker cloud at the lens (28, 18 and 10 soft camera-facing quads,
      one draw) that are laid ahead, drift across the run and are recycled behind, so the cloud has parallax.
    - The deck after the break is the sky dome's own (`deck.k`).

LW4. **The valley of lanterns** (`lanternworld.ts valleyMaterial`). One `Points` draw, static buffers, moved on
    the GPU: each lantern rises through its own 70 to 260 m at 1.3 to 3.7 m/s and fades in and out at the ends,
    sways a little, and flickers. Four bands give the depth: beside the run (13%: paper lanterns a rider passes
    among, 1.6 to 2.8 m), over the road above any flight (7%), the middle valley (36%), and the far valley to
    2.4 km (44%, drawn 9 to 18 m so a far one still covers pixels). Near the lens a point is a painted paper
    lantern with a flame low in it; past about 4 px it is a mote. 6,000 on High and Ultra, 3,600 on Medium, 1,500
    on Low (flat squares, no halo, brighter and larger so they read without bloom). They show only from
    `CLOUD_BREAK` on: nothing of the valley is seen from the Crown or through the cloud.
    The same buffer holds as many again for **the Great Rising** (the legend: drawn while `lg.phase === 2`, with
    the whole field rising about twice as fast and a fifth larger), and the lanterns **Firstlight lets go** when
    the great lantern lights (600, 360, 160).

LW5. **Lamps down the whole mountain, and they light it.** A way lamp stands 2.7 m past the edge every 18 m on
    alternate sides (13 m in the cloud), never where a site stands, on a wall or on a ledge's face; in a walled
    stretch a paper lantern hangs on the wall instead. One instanced draw. Their flames, the flames of the stone
    lamps the sim stands in the avenues, the canal's floats, the guide light and the carried flame are one
    `Points` draw filled each frame (at most 480, 320, 160). In cloud a far light is drawn as a wide soft halo
    that tightens to a flame as it comes: the looming. Every lamp within about 80 m offers a local light
    (`pushLocalLight`, 13.5 m, marigold 1 / 0.66 / 0.2), as do the stone lamps (9.5 m), the canal, the guide
    light (17 m), the carried flame (5 to 9 m), the Tall Lamplighter's lantern (22 m) and the great lantern (40 m).
    The first pass had the streets flooded orange: lamps came down from 1.5 to 1.15 and `under` from 0.34 to
    0.14 so the snow is lilac in pools of marigold.

LW6. **Architecture and people, all in `lanternkit.ts`.** The idea that makes them one family: a building is a
    lantern, squared and stacked. No swept eaves, no gate of two posts and a lintel, no stacked roofs.
    - *Lamp tower* (the kit's `tower`, the town's landmark, the finish's tall mark, the far hamlets' landmark): a
      narrow battered stone stem with two string courses and a door of light, three to five storeys of lit paper
      in a timber lattice each 0.86 of the one under it, a flat eave with snow between them, a steep cap.
    - *Great standing lamp* (`guardian`): a 13 m dressed monolith with a fire in a niche cut through its head.
    - *Bell frame* (the kit's `gate`): a timber trestle on each bank, a doubled beam, five bells with lit rims.
    - *Arched bridge of lights* (the kit's `bridge`): one segmental stone arch, lamp posts and a string of lights
      along the parapet, lamplighters on the deck. The course's own bridges (`viaductPiece`) take stone and plum
      timber through `spanStyle`.
    - *Houses*: stone below, timber storeys whose bays are panes of lit paper (about three storeys in four lit),
      a steep four-sided roof, and a small lantern on its point.
    - *Hazards*: the sim's `spire` is a standing stone, `basalt` a row of three, `iceblock` a marker stone,
      `lantern` a stone lamp with an open fire box (its flame is drawn by the world, so the stone stays a dark
      hazard). Each is modelled inside its collider (`tests/lanternworld.test.ts`).
    - *Trees*: ink conifers (the bough pine with the palette's ink) and bare silver trees, one of them hung with
      three small lit lanterns (the lamp grove's own).
    - *Lamplighters* (`crowd.ts`): a long robe with a shoulder cape, a cowl, a tall lamp-cap or a headcloth, and
      the prop: a long lighting pole held up with a flame at its tip. Robes in the night's own colours.
    - *The canal*: a stone channel of level water on the bank down the open stretches of the Lamp Road, lights
      carried down it (painted in the water's shader, and the nearest 44 or 24 as real lights). The forest
      keeps clear of it (`props.siteClearings`).

LW7. **The set pieces and legends** (`lanternworld.ts`; `marqueeworld.ts` no longer draws these five).
    - *Follow.* The guide light is a paper lantern with a white heart, three small lights circling it, a tail
      falling back down its line and a halo the cloud spreads to several metres. It keeps 26 m ahead on the
      sim's own path. Its wake is light on the snow as wide as the sim counts it (`2 * hw`), from behind the
      rider to the lantern: marigold and whole while `mo.ahead`, thin and cold when the rider leaves it, and the
      lantern itself dims to 0.38. Each eighth pulses it. Won, it climbs into the cloud in a flare; lost, it
      gutters where it hangs.
    - *Kindle.* A dark lamp holds a cold glint and lays a mark on the snow on the side a sled lights it from. As
      `mo.mask` takes its bit the lamp catches: a burst, a flame 2.6 times its size settling in a quarter second,
      a local light to match. Won, the road blazes: every lamp of it stands taller, the flare runs down the road
      from the rider, and each lets a lantern go.
    - *Carry.* The flame stands on a short staff at the sled's tail, over the rider's shoulder (on the prow it
      hid behind the coat), as tall as `mo.pace`, white-gold when full and amber under 0.45, streaming back with
      speed. **Guttering is read from `mo.at > 0` and the `trail` and `lead` beats** (the simfix lane's state, as
      the main lane described it; on this branch `mo.at` stays 0 and a flame under 0.22 gutters instead): it
      drops to ember, flickers hard and sheds sparks, and on `lead` it flares to 2.4 times and throws a burst. The
      brazier of the low-flame variant is a great stone lamp with a ring of light on the snow.
    - *The great lantern* hangs from a timber frame 36 m past the line, a paper drum 6.6 m tall. It is dark all
      run. On `won` it lights at once at full; on a finish without the flame the lamplighters light it 1.1 s
      later at 0.72. Either way the town lets its lanterns go.
    - *The Great Rising* (LW4). *The Tall Lamplighter*: a robed figure 9.5 m tall with a faceless cowl walks the
      grove 40 m ahead of the rider, never back up the hill, his pole out over the lane; the lane is his
      lantern's light lying on the snow, `2 * RIBBON_HW` wide.

LW8. **Tiers.** High and Ultra carry everything. Medium keeps every layer with fewer lanterns, two cloud sheets
    and 18 banks. Low is a poster: one cloud sheet, lanterns as flat squares, flames as flat painted shapes with
    one paler value, no canal, no halos on distant lamps, 160 sprites; the lamps' light on the snow is the light
    lane's painted pools.

LW9. **Audio's tables.** The produced score already plays by mountain id. The built-in band's fallback now has
    its own `CLEAR.lantern` (Bb major, 92, a music-box arp), `ACCENTS.lantern` and a `LANTERNFALL` song (a verse
    that rocks between I and vi, a chorus that climbs to the borrowed bVII, a hook that ends on the high tonic).
    The soundscape: owls (it is always night), wind-bells for the mountain's bed (the chimes take at 0.6 speed),
    hand bells from the crowd in place of whistles and cowbells (the temple take, high), a temple bell for a
    street. The jukebox lists Lanternfall under its own biome.

## Text to fold into ART.md 15, under Lanternfall

> **How it is built.** A building here is a lantern, squared and stacked: a narrow stone stem, storeys of lit
> paper in a timber lattice each slimmer than the one under it, a flat eave of snow between them, a steep cap.
> Houses are stone below and paper above, and every roof ends in a small lantern of its own. Nothing has a swept
> eave or a lintel on two posts. Hazards are ink: standing stones, marker stones, and stone lamps whose flame the
> world draws over them. The run's gates are bronze, so the rider's vermillion is the one red.
>
> **The lights.** Marigold is spent in pools: a way lamp every 18 m, each lighting about 13 m of snow, with lilac
> between. A light in cloud is a wide soft halo far off and a flame up close. A lantern in the valley covers what
> is behind it before it adds its light, so it stays marigold against a pale range. The deck is dark with a rose
> underside, never orange: the lanterns are the brightest thing under it.
>
> **The cloud.** From above, three sheets of billows in three values with warm pools that hold their place. The
> cloud lets go 80 m above the lip of the break, in under two seconds, so the whip onto the valley finds it open.

For the README: `?debug&m=4` rides Lanternfall in its own look; `&legend=1` the Great Rising, `&legend=2` the Tall
Lamplighter. `scripts/playtest/lanternworld-key.json` is a 14-frame list of its places and
`scripts/playtest/lanternworld-digest.mjs` prints a capture's cost.

## Cost

Measured on the fixed set (35 frames, headless Chrome on the laptop's GPU, 30 m/s, `renderer.info` summed over a
frame's passes), the build at this branch's head. Frostfang's row is the light lane's (`notes/r7-light.md`, the
same method and distances on Frostfang's own course); Lanternfall was not measured in Frostfang's look on this
branch, so the difference is this lane's layers plus the course's own sites (two streets, two bridges, three
leaps), not this lane alone. No console error or page error in any of the nine runs.

| Tier | Lanternfall, mean | Lanternfall, worst frame | Frostfang, mean | The brief's figure |
| --- | --- | --- | --- | --- |
| High | 102 calls, 945k | 112 calls (3297 m), 1,116k (3450 m) | 94, 831k | about 95, under 1.0 million |
| Medium | 92, 662k | 104, 785k | 90, 583k | |
| Low | 49, 144k | 57 (3450 m), 195k (3940 m) | 52, 150k | about 48, 150 thousand |
| Phone (Medium) | 92, 658k | 102, 784k | 90, 578k | |

- **High is over on draw calls by about seven**, and seven frames between 2550 and 3581 m pass a million
  triangles (the second street and its stands). Low is on budget in the mean and over it in the stretch from 3450
  to 3581 m (56 to 57 calls) and at the last leap's crowd (195k).
- This lane's own draws: the way lamps (one instanced mesh, under 250 instances of under 200 triangles each, always drawn),
  the frame's lights (one `Points`), the valley (one `Points`, from the break on), the cloud's sheets or its
  banks (one, above or in the cloud), the pools on the snow (one, only while a set piece or a legend lays light),
  the canal (one, High and Medium, near its reaches), the great lantern (two, in the last 760 m), the Tall
  Lamplighter (one, on his runs). Four to six at once; points are not counted as triangles.
- Triangles a form (held by the test): way lamp under 200, stone lamp under 160, standing stone under 160, silver tree under 110 (170 hung with
  lanterns). A lamp tower is about 1,400 (Low 900).
- Per frame on the CPU: one pass over the way lamps and the obstacles of six chunks, at most 480 sprites and 96
  pools written to dynamic buffers, 28 banks of cloud moved. Not timed.
- Where to cut if the merged build is over: draw the way lamps only within 400 m (they are one draw but up to
  50k triangles), drop the canal on Medium, and thin the second row of houses on Lanternfall's streets.

## What the main lane must wire, decide or re-tune

1. **Merge order.** `marqueeworld.ts` (the `momentsworld` lane's): this lane removed its `follow`, `kindle` and
   `carry` stand-in cases, skips those verbs at the top of the loop, skips the `rising` and `lamplighter` legends,
   and dropped the unused `COLD`. If `momentsworld` rewrote `standIns`, keep theirs and keep those five out of it.
2. **`world.ts`** (the pipe lane's): eleven marked lines construct `LanternWorld`, add its root, and call
   `setCourse`, `setDetail`, `setViewport`, `reset`, `update` and `beats`; `props.siteClearings` now also asks the
   canal. `LanternWorld.update` must run after `beginLocalLights` (it pushes lights) and takes the live palette.
3. **The reel and the title.** Neither was looked at on Lanternfall. On the title `LanternWorld` shows the Crown
   only (the valley and the great lantern are hidden while `mode === 'title'`).
4. **UI.** `MountainCard['biome']` gained `'lantern'` (`contract.ts`), with a ridge illustration (`art.ts`) and
   two CSS gradients (`.b-lantern`). The screens lane owns these files: reconcile if it changed the card.
5. **Chaos moods on Lanternfall** stand on a new `biomeBase('lantern')` (lilac snow, ink trees, violet ranges).
   None was shot. Lantern Night and Blizzard want a look there.
6. **The unlock** is still the moments lane's placeholder (48 passes).
7. **Re-tune after the merge:** the lamps' radii and powers against the merged lighting; the carried flame's
   size once a person has ridden with it; whether the valley wants its 6,000 on Ultra raised.

## Touched outside my files

- `src/sim/mountains.ts`: the type and `lookOf` (LW1). No behaviour.
- `src/render/palette.ts` (light): Lanternfall's rows; `massif.seaWarm`; `Place.span` and the two loops that lay
  it; a finer stamp for a span; `journeyDusk` is 1 on Lanternfall; `CLOUD_BREAK`.
- `src/render/massif.ts` (light): `uSeaWarm` in `SEA_GLSL`, its uniform and `paletteSea`.
- `src/render/meshes.ts`, `props.ts` (fx): `obstacleGeometry` takes the biome; Lanternfall's stone hazards use the
  plain hazard material; conifers shed snow.
- `src/render/flora.ts` (fx): the forest sets, `hasLod`, `VARIANT_SHARE`.
- `src/render/landmarkKit.ts` (fx): `pieceFor` asks `lanternPiece` first.
- `src/render/landmarks.ts`, `town.ts`, `places.ts`, `village.ts`, `crowd.ts`, `speedposts.ts`, `rails.ts`,
  `overlook.ts`, `midground.ts`, `liftline.ts`, `dressing.ts`: a Lanternfall entry or branch each.
- `src/render/world.ts` (pipe), `src/render/marqueeworld.ts` (momentsworld): above.
- `src/audio/score.ts`, `theory.ts`, `scape.ts`, `listen.ts`, `jukebox.ts` (music): LW9.
- `src/ui/contract.ts`, `art.ts`, `style.css` (screens): the card.
- `tests/palette.test.ts` (five biomes; the same-look skip is gone), `tests/audioscore.test.ts` (five keys and
  tempi), `tests/fairness.test.ts` (Lanternfall's signature places).
- `scripts/playtest/frames.sh` takes a session name (`FRAMES_SESSION`); `frames-r7.json` has a list for `"4"`.
- New, this lane's: `src/render/lanternkit.ts`, `src/render/lanternworld.ts`, `tests/lanternworld.test.ts`,
  `scripts/playtest/lanternworld-key.json`, `scripts/playtest/lanternworld-digest.mjs`.

## Not finished, and fragile

- **Draw calls on High are over the brief's figure** (see Cost). This lane's own layers are four to six draws;
  the rest is the course itself, which was never measured in Frostfang's look on this branch.
- **The Tall Lamplighter was never seen in a frame.** The capture teleports the sled, and a `?legend=2` run shot
  at the grove showed the brazier and the third variants but not him. His code is untested by eye. The Great
  Rising was not shot either (its doubling is two uniforms and a draw range).
- **Kindle's catch and the road's blaze, the guide light's win and loss, the flame's gutter and catch, and the
  great lantern lighting** are all driven by beats and `mo` and were not caught in a still: the fixed frames ride
  hands-off. They need a played run, or a capture that plays.
- **The standing stones are large dark slabs.** They read as ink silhouettes and carry the stone material's
  strata, but a harsh eye will call the biggest ones boxes (2700 m). They want the fx lane's rock forms.
- **The cloud sea from the lip (565 m) is flat at a grazing angle**: the billows' relief is paint, not height.
- **The results frame on a finish** takes the great lantern's light on the near snow; it was pulled down twice
  and is still the warmest frame on the mountain.
- The canal was not seen close in any frame read (it lies on open banks from about 1830 m; no key frame faces it).
- Frame time was not measured (the rules say not to from a lane's runs).
- A stray folder `C:\c` holds the first capture's frames' path (the tool resolved a Git Bash path wrongly); the
  frames were moved out, the empty folders remain.

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\lanternworld\`:

- `final/{high,medium,low,phone-medium}`: the fixed set (35 frames, the list now in `frames-r7.json` under `"4"`),
  each with its report (`<tier>-m4.json`) and contact sheets (`<tier>-<dev>-sheet-N.png`).
- `v1/high`: the first pass (the pink and orange one), the full set. `v2/high`, `v3/{high,medium,low,phone-medium}`:
  the 14 key frames after each pass. `v4-legend2/high`: the key frames with `&variant=2&legend=2`.
