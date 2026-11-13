# Round 7, the light lane: notes for the main lane to fold in

Branch `r7-light`, cut from `round-7` at e503f1e. Render only: nothing in `src/sim` or `src/bot`.
(Kept up to date as the work lands; the last section says what is still open.)

## Decisions (numbered from L1; renumber as you fold them in)

L1. **A film curve, driven by value.** The composite's soft knee (`col / (1 + max(col - 0.85, 0) * 0.6)`)
    let the brightest snow reach paper white and round 6's S-curve pivoted at 0.5 linear. The new curve
    (`FILM` in palette.ts, compiled into post.ts) has a short toe (darks up to 18% deeper), runs straight
    to a knee at 0.45 and then climbs a shoulder toward 0.98 that it never reaches. It is driven by a
    colour's value (a 40:60 blend of luma and its brightest channel) and scales the colour whole, so the
    shade keeps its hue and the vermillion, marigold and mint keep their saturation; what is hot enough to
    leave the range folds halfway toward the light's own colour, not toward white. Lit snow (0.83 linear
    in the scene) lands at about 0.72, or 222 of 255, with the sparkle and the sun above it. A player
    feels it as snow that has form in full sun. Rejected: AgX and ACES fits (both desaturate the three
    signal colours on the way up, and both lift the mid-tones, which washed Sakura out further).

L2. **Bloom keeps its source's colour.** The bloom was tinted whole toward the sun's hue, so a street of
    amber lamps bloomed sky colour and a ghost's mint halo drifted warm. Now only bloom that is already
    near white (the sun's core, a glint on the powder) takes the light's colour.

L3. **The grade has an exposure and a split tone of its own** (`grade.exposure`, `grade.hi`, `grade.lo`,
    `grade.tone`; all optional in `GradeParams`, so every old caller holds). The place grades are mostly
    these three numbers.

L4. **The hour and the place are two tables.** `JOURNEY` stays the time of day in metres (the same on any
    course of a mountain); `PLACES` (new, palette.ts) grades the hour's light by the course's own
    sections, by kind and by which of that kind it is, so a Daily's shuffled acts carry their places with
    them. A place's palette is the hour's at its middle with the place's edit, laid once per course and
    cached; a frame blends hour to place by the section's own blend (a roof closes and lets go faster: the
    burst out of a cavern is about 80 m, under two seconds). Rejected: keying the rows to ART.md's metres
    (they are wrong for the Thousand Torii by a kilometre, and for every Daily); keying to set-piece ids
    (the moments lane is renaming them this round).

L5. **Each mountain's colour, to ART.md 15.** Ember's ground is lit by its deck: an orange-cream lit side
    (`sunColor` #FFD4B8 on `snowLit` #F2E2D8) against a cold plum-teal shade (#3C4A66, #2A2444), basalt
    true black (#1C181C), and a light from below (`under`) that grows down the run and fills the Caldera
    Leap. Frostfang's polar night has a second key light (`key2`): curtains of the aurora's green sweep
    the snow that faces the sky and the shade between them goes violet. Pinecrest's gold deepens into a
    third stop, dusk at the line. Sakura gains its spine: ink rock (#2E2A44), a wine underside to the
    blossom (#A8386E), a deeper lavender shade, a blue far air, and blossom that glows with the sun
    behind it (`leaf`).

L6. **Air in two colours, thicker in the valleys.** The fog had one colour. Now it is the mood's fog near
    and the far plane's own colour (`air.far`) with distance, it glows toward the sun's disc (a tight
    glow and a broad one) and cools away from it (`air.cool`), and it lies thicker below the course's own
    floor (`air.low`), so a valley and its village gather haze before the run ahead or a crest does.

L7. **Local lights in the shared model** (`lights.ts`, `LIGHT_GLSL.localLight`). The nearest eight to the
    rider, uploaded by reference; each falls off as `(1 - (d/r)^2)^2` (no spike at the lamp, no edge on the
    snow) and wraps a third of the way round a form; all are scaled by the palette's `lamps` (0.2 at
    Pinecrest's noon, 1 and more at night and in a street). The snow takes them whole, a prop takes them
    on its own colour, a hazard takes them on its edge only (it stays the dark shape in the street).
    Low: the snow alone takes the nearest four as two-value painted pools; props take none; no draw is
    added.

L8. **Who offers a light.** `landmarks.ts` (every lamp that has a painted pool, while the lamps are lit; a
    radius of 2.3 pools, so a street is pools of amber with blue between, not a gold floor);
    `marqueeworld.ts` (each lantern gate at its own brightness, and the race's machine);
    `terrain.ts` through `addLightSource` (lava in Ember's joints every 24 m on alternate sides of a
    ravine or a tunnel, breathing; one 85 m light in the gap of the Caldera Leap; the cyan heart of
    Frostfang's crevasse walls and cavern every 28 m; the stone lanterns of Sakura's torii every 21 m).
    The sled's own lantern keeps its own path (`lanternLight`, the pool): pushed as a local light too it
    lit the snow twice. Fireworks and spirit effects are the fx lane's to push.

L9. **Snow carved by the wind.** Three scales of painted relief where there was one: wind slab (crests
    7 m apart, in fields, to 150 m), sastrugi (1.6 m, now across the run as well as the banks, at half
    strength) and the fine ripples; each has a lit crest and a lee face in the shade's own blue, so on
    Ember the troughs are teal and on Sakura lavender. The fine glitter reaches 22 m and gathers toward
    the sun; past 35 m a slope turned to mirror the sun carries a soft sheen of it; cast shadows take a
    hint of the zenith. Low paints the slab's colour and skips its normal.

L10. **Rock is painted, whatever its form.** Any stone-coloured fragment (a dull, mid to dark colour) of a
    hazard or a landmark carries strata in world space: beds 1.15 m thick, dipping and wandering, in three
    values, a dark parting under each and a line of snow along the top of some; what faces up holds snow.
    It is a mask on colour, not a new material, because rocks share their materials with trunks, roofs and
    rails and the fx lane is reshaping the geometry: any form it makes is painted. Foliage is left alone.
    Ice (the `ice` materials) has a darker heart seen square on, a pale skin at its edges, cracks on two
    sets of planes and bubbles. Crevasse walls hold a cyan glow low down. The Petal Steps' banks hold
    still water (a negative value on the lake's paint channel; never on the line a sled rides).

L11. **The far planes.** The massif's haze is the far air's colour (`air.far`), so the ranges are the
    mountain's blue. The clouds' shadows sweep the mid-ground's flanks and valley floor with the terrain's
    own pattern (unbroken across the bank's edge) and a broader one further out.

L12. **Low is a poster.** `tierLook` (palette.ts) bakes the place's grade and the film curve into the
    colours Low draws with (snow, sky, air, clouds, ranges), flattens the sun to a disc of the light's own
    colour and widens its glow on the dome. Local lights are painted pools on the snow. No draw, no
    triangle and no pass is added on Low.

L13. **The review pass: what the first full frame set showed, and what changed** (the frames in
    `shots/r7/light/v1` are the set before this pass, `final` the set after).
    - *Ember read as sand.* The snow's own colour was a pink-grey (#DCC2B6 and darker down the run) under
      an orange light, so it was tinted twice and the slopes were a flat salmon. The snow is now a warm
      white all the way down (#F6EEEA to #E4D6D2, a dusk rose #C2B6C6 at night) and the light carries the
      orange once: lit snow is cream-peach, the brightest thing in the frame, against the plum-teal shade.
      The Basalt Halls' ash is an ember red that stands 60 m off the lens (thick from the first metre, a
      dark red over a blue shade made the grey-brown the review saw at 3450 m), and it no longer cools away
      from the disc. In the Caldera Leap the shade itself warms (plum, an orange rim).
    - *Sakura read as custard.* The yellow was not in the palette: it was a full fan of shafts (stock gold
      at half strength) over white snow, plus the sun's scatter. The shafts take a third of the stock gold
      now (post.ts, every mountain), Sakura's are thin until the orchards and thin again after, and the
      light leans to rose. From the Blossom Leap on the sky comes down a full step under the snow (#4E94DC
      zenith), the far air and the ridges are blue, the shade deepens (#6474D0) and the blossom goes to a
      deeper rose over wine (#FF7EB2, #862660): the cone stands on blue and the snow is the light.
    - *Frostfang was still one blue from 600 to 2550 m.* Blue hour: paler lit snow, shade and air a step
      under it, a lemon rim. Polar night: the shade is violet (#3A3296, and the aurora's own shade
      #5C3CC4 is laid on the shaded snow at up to half strength, on the lit snow at a sixth), the aurora's
      curtains cover more of the slope and keep the snow's relief under them (laid flat they read as a
      green field), and the top third of every ice wall takes the aurora on its crest. A slot in the ice
      is the dark of the frame (violet-black floor, closed air), so the cobalt walls, the cyan at their
      feet and the lit valley beyond are the picture.
    - *Old Town's lantern gates went peach at dusk.* The film curve folded anything hot halfway to the
      light's colour, and at dusk that is orange. A colour with a hue of its own now keeps it up the
      curve; only what is near white takes the light's colour. Marigold is the lantern's again.

## Touched outside my files

- `src/render/world.ts` (the pipe lane's): three small edits, each marked "Round 7, the light lane".
  `beginLocalLights(s.x, s.y, -s.z)` at the top of `frame()`; `journey()` passes the course
  (`journeyStamp(biome, metres, this.course)` for the key, `journeyPalette(..., this.course)`); the import.
- `src/render/landmarks.ts` (unowned): `lampLights()` pushes the lamps; `LAMP_LIGHT` colours; the `plain`
  material takes `stone: true`.
- `src/render/marqueeworld.ts` (unowned): two `pushLocalLight` calls (gates, machines).

## Still open (updated as I go)

- Lights pushed from the world's sources, the snow's surface, rock and ice, the far planes, Low's poster,
  the full frame sets and the cost table.
