# Round 7, phase 3: the review loop on Pinecrest (mountain 0)

Branch `r7-review-m0`, port 4530, session `r7-review-m0`. Frames: `shots/r7/review/m0/pass<K>/{high,low,phone-medium,motion}`
in the main checkout. Each pass: the fixed 38 frames on High (1280x720), Low and the phone on Medium, 29 stills in
motion on High (strips at the First Drop, the glades, Mirror Lake, the gold leap, Old Town, the Valley Leap and the
finish; the leaps are flown, not pinned), then a fresh critic given only the frames and ART.md.

Passes 1 and 2 were run by the lane's first agent (Fable 5.2, critics at its default effort); it was stopped while
capturing pass 3. From pass 3 on the lane runs on Opus 5.5 and every critic is a fresh Opus at extra effort, so pass 3's
scores are not strictly comparable with passes 1 and 2: a stricter critic can score the same picture lower.

<!-- SCORES -->

## Pass 1: what the critic found (ranked by cost)

1. No light in the air: shafts, lit haze and a visible sun missing outside Mirror Lake and the finish.
2. Colour fringe on High at the frame's edges, and across the frame after a landing.
3. Washed stretches, 1500 to 1650 and 2429 to 2700: the gold arrives as beige.
4. The hero 3 to 7% of the frame at the First Drop and the Valley Leap; no shadow under the sled on Low.
5. Untextured slabs: the fins either side of each lip, flat hills in shade at 2550 to 2850, a grey block of flats.
6. Low's gold-hour snow reads as sand; Old Town's lanterns unlit on Low.
7. The HUD over the picture (banners on the peak, the results card over the hero at 4590).
8. Sparkle as confetti; near pines as loose shards.
9. Dither stipple on near props on Low and the phone.

### What changed after pass 1 (47a1bb4)

- **The sun is in the frame and throws shafts** (palette.ts `round7` and `JOURNEY`): the morning's disc sits lower
  and nearer the fall line (`setSun(24, 11, ...)`), shafts 0.35 to 0.8, rays 0.3 to 0.6; from the First Drop the disc
  comes down over the valley's far side with full shafts and a glow. Why: pass 1's first finding.
- **The gold arrives by the second leap** (`JOURNEY` from 2250, full at 2800, was 2300 to 3250), and the disc stays
  inside the frame. Why: the gold leap's frames (2430 to 2700) were a quarter of the way to gold and read as beige.
- **Grades by place** (palette.ts `PLACES.alpine`): the First Drop, the gold leap and the Valley Leap each get
  their own leap grade (the Valley Leap a pool of gold with the lamps up); the glades' blue shade and contrast run
  on through the fork and the chute to the lake's shore; the benches and the second fork carry the gold's shafts;
  the lake's ice goes to a black-cyan deep (`snowDeep #123A8C`); the finish's shafts drop to 0.35 so the sun in the
  street's mouth no longer floods the frame.
- **Powder glints are fewer** (`sparkle` 1.25 to 0.7, glitter 0.35). Why: confetti.
- **A lip's shoulders are bedded outcrops** (rails.ts, alpine only; places.ts lip crowns, alpine only): three blunt
  stacks of strata with snow on every ledge instead of eight-metre violet prisms.
- **Low's gold snow stays snow** (`Grade.posterSnow`, palette.ts `tierLook`): the poster pulls the lit snow back
  toward white of its own value after the grade is baked, 0.7 in the gold and 0.75 at the finish. Other mountains
  leave it 0.
- **Low's rider casts a painted shadow** (landing.ts `painted`, world.ts): where the tier draws no cast shadows the
  sled's blob is larger, darker and thrown a little off the sled away from the sun, where the chase lens sees it.
- **The lens fringes only in its corners** (post.ts): the speed fringe starts at 0.74 of the radius (was 0.5) and
  blends at 0.5 (was 0.7).
- **The Valley Leap's held wide stands closer** (camera.ts `WIDE_OUT` 3.0 to 1.8, `WIDE_FOV` 4 to 2).

## Pass 2: what the critic found (ranked by cost)

Means: High 7.08 (min 5.5), Low 6.74 (5.5), phone 7.51 (5.5), motion 7.38 (3: `mo-mirror-2`, the lens behind a
set-piece plank at the lake). Hero vistas: the First Drop 8 at best (6 to 6.5 in the High stills), Mirror Lake 8.5,
Old Town 8.5, the Valley Leap 8.5 (`mo-valleyleap-0`; 6 in the High still at 4050). No frame a 9.

1. Edge fringe and radial smear on High, at speed and in calm frames.
2. The hero too small in the wides, worst at the hero vistas.
3. The vistas missing their scripted light: no cloud shafts onto the First Drop's lake, no black ice or doubled
   cable car at Mirror Lake, Old Town's lanterns not lighting the snow, the town not in a pool of gold at the Leap.
4. The gold pushed into a duotone: peach "sand dune" snow against electric ultramarine shade from 2429 to 3150.
5. Foreground pines as dark faceted shards crowding the edges.
6. Boxy geometry: repeated block rocks, the lift station's tower as a block of flats, bridge pylons, flat windows.
7. Milky haze over the First Drop's valley and 1500 to 1650.
8. Screen-door stipple on fading near objects (Low and phone).
9. The HUD over the picture; the results card half-faded over the hero at 4590.

### What changed after pass 2 (57e28bc)

- **The gold is honey on white snow** (`JOURNEY` gold stop): sun `#FFDCA8` to `#FFE8C4`, lit snow `#FFFAF0`, shade
  `#6E7CC8` and deep `#3E4AA8` (quieter violet-blue), saturation 1.2 to 1.12 with contrast 1.12. Why: finding 4.
- **The First Drop's valley clears of milk** (`PLACES` default leap): valley haze 0.85 to 0.5, low air 0.75 to 0.5,
  fog pushed out a third further, contrast up. Why: finding 7 (Low, with less haze, showed the lake better).
- **Old Town's lanterns burn low before the first stomp** (verbworld.ts, shared: the lantern's unlit glow 0.45 to
  0.85; a stomp still doubles it). Why: finding 3.
- **The lift station has shutters and storeys** (places.ts `liftPiece`, alpine only): teal shutters and a snow
  sill each window, a timber band under each row.
- **The leaps' wides stand closer** (camera.ts, shared: `VISTA_OUT` 2.6 to 2.1, `VISTA_FOV` 6 to 4). Why: finding 2.
- **High's corner fringe is a hair** (postfx/tiers.ts, shared: High's `fringe` 0.7 to 0.3).
- The lip shoulders a step paler and more tapered, two stones a side instead of three on Pinecrest's big lips.

## Pass 3: what the critic found (ranked by cost)

The first pass judged by an Opus critic at extra effort, and markedly stricter: High 6.91 (min 5.5), Low 6.14 (5.0),
phone 6.62 (4.5), motion 7.26 (5.0). No frame a 9; the best still frames 8 (High z1763, z3464, z3548, z4330,
z4440), the best strip `mo-mirror-2` at 8.5. Hero vistas: the First Drop 7.5, Mirror Lake 8.5, Old Town 8, the
Valley Leap 8.

1. Washed, unpainted foreground snow: the lower half of most High frames one pale field; Low paper white from the
   start to the lake; the phone's lower third empty.
2. The far plane and the valley floors collapse to a flat plate (the First Drop, the gold, the Valley Leap's town).
3. Near-lens low-poly pines as flat facets on High; the same pines as a screen-door stipple on Low and the phone.
4. Render faults: a salmon smear across the left track at 3000 and 3300 m on every tier (the fork's ice strip
   mirroring a gold-hour horizon); near lanterns as scanline-dithered ghosts (`mo-oldtown-0`); the finish flash
   bleaching the rider (`mo-finish-2`); Low's painted shadow a saturated blue disc.
5. The hero small, cropped by the prompt pill in seven strips, or cut by the results card at 4590.
6. The HUD and oversized pickups over the picture.
7. Chromatic fringe on the left-edge pines in calm frames.
8. The gold reading milky cream instead of honey light with long violet shadows.
9. Low's town lanterns cast no light; flat window slabs.
10. The finish without fireworks.

### What changed after pass 3

- **The morning has form** (palette.ts `round7`, alpine): exposure 1.06 to 1.0, contrast 1.08 to 1.12, the cloud's
  shadows cross the open slopes from the start (0.22 to 0.34, and 0.38 to 0.44 from 500 m). Low's lit snow stops
  short of paper: a new `Grade.posterKey` (Low's poster only; 0, no limit, on every other mountain) holds the lit
  snow's strongest channel to 1.0 after the grade is baked.
- **The gold is honey with its shadows back** (`JOURNEY` gold stop): the shade a step more violet (`#6670C6`), the
  air a deeper honey that holds its value (`fog #DDB494`, scatter 1.5 to 1.0, `fogFar` 760), the sun a touch warmer
  and its glow 1.1 to 0.9, saturation 1.12 to 1.16, contrast 1.17, exposure 0.97.
- **The valleys open** (`PLACES`): the First Drop's snowfield opens into more frozen lake (`massif.sea` 0.5) under a
  blue haze that is thinner (`valley` 0.4, `air.low` 0.25, a bluer fog); the gold leap's haze honey and thinner
  (0.85 to 0.55); the Valley Leap's haze thinner and amber (0.8 to 0.45, `#EE9C5C`), its lamps up (1.2 to 1.6).
- **Mirror Lake mirrors a blue sky** (`PLACES` lake): the low sky over the lake a clear pale blue, so the black-cyan
  body reads under it; the lake's long fractures and near plates fainter (materials.ts, lake only).
- **Old Town's lanterns pool on the snow** (`PLACES` street lamps 1 to 1.6, bridge 0.9 to 1.2; a deeper shade).
- **Shared, small**: the fork's ice strip takes half its mirror from the deep upper sky and mirrors less
  (materials.ts), so a gold horizon no longer lays a salmon smear across the snow; a prop's near dissolve is
  dithered only in the middle of its fade (materials.ts: solid, then gone, instead of a metre of stipple on Low and
  the phone); a lantern holds solid to 5.2 m and is gone by 4.4 m (momentkit.ts, was a 2x2 dither from 7 m); the
  chromatic punch on a drift or a stomp lives toward the frame's edges at a softer blend (post.ts); the finish
  shot starts moving the rider into the results card's free column as its swing settles (camera.ts), so the
  card no longer lands across the rider; Low's painted shadow takes the shade's hue (landing.ts).

## Pass 4: what the critic found (ranked by cost)

A fresh Opus critic: High 7.28 (min 5.5), Low 6.33 (5.0), phone 7.05 (5.0), motion 7.29 (4.0). Against pass 3:
High +0.37, Low +0.19, phone +0.43, motion level. No frame above 8; the gold stretch and Mirror Lake's sky called
the best work. Hero vistas: the First Drop 7, Mirror Lake 8, Old Town 8, the Valley Leap 8.

1. The near snow still washed and empty on every tier (High lavender or cream with sparkle; Low a neutral grey-white
   it reads as paper; the phone's lower third empty).
2. The vistas' signatures not drawn: no shafts or haze layers at the First Drop, no doubling at Mirror Lake, no
   apex at the Valley Leap, Old Town's lamps not pooling on the snow.
3. Chromatic fringe and motion smear at the frame's edges in the strips after a landing.
4. Untextured boxes and placeholders: fuel drops as flat polygons (some parked in the sun), rail ends, lip terraces,
   window grids, the FINISH board.
5. The hero 75 to 110 px at the First Drop, the Valley Leap and 4200 m.
6. Low's stains: cobalt shade on the gold's right banks, the fork strip's rust band, hard white ovals where a lamp
   lights the snow (4200, 4440).
7. The HUD over the focal area; the phone's fuel button over the rider.
8. Blown highlights: the ray fan over the lake's first ice (z1650, 5.5), the finish flash (`mo-finish-2`, 4.0).

### What changed after pass 4

- **The line's light no longer floods the square** (climaxworld.ts, shared): the finish's local light peaks at 1.6
  instead of 3.1 (`0.35 + 0.75 rise + 0.5 flare`); the beams, the bar and the shells carry the moment. Why:
  `mo-finish-2` bleached the rider three passes running.
- **Low's lamp pools keep their hue** (materials.ts, Low only): where a pool would push the snow over 1 it is
  scaled back to its own hue instead of clipping to a white oval.
- **Low's lit snow leans cool and its gold shade is muted** (palette.ts `tierLook`): `Grade.posterCool` (0.16 on
  Pinecrest) leans the lit snow to the baked shade's hue at its own value; `Grade.posterMute` (0.3 in the gold)
  pulls the baked shade a third toward grey. Both 0 elsewhere.
- **The ray fan over the lake's first ice is cut** (`PLACES` chute: shafts 1 to 0.5, rays 0.8 to 0.45; the lake's
  own shafts 0.7) and the lake's low sky is a step deeper (`#8CB0E2`).
- **The vistas stand closer** (camera.ts, shared): `VISTA_OUT` 2.1 to 1.5, `VISTA_FOV` 4 to 3, `WIDE_OUT` 1.8 to 0.9,
  `WIDE_FOV` 2 to 1. Why: the rider 75 to 110 px at the apex of every leap, four passes running.
- **The cornice's tongues are scallops, not teeth** (rails.ts, shared).
- **The chromatic punch moves further out** (post.ts: from 0.7 of the radius, blend 0.45).

<!-- PASS5 -->

## Shared code touched

Every change below is small, general and kept safe for the other mountains; each carries a comment saying the
review loop asked for it.

| File (owner) | Change | Effect on the other mountains |
| --- | --- | --- |
| `camera.ts` (hero) | `VISTA_OUT` 2.6 to 2.1 to 1.5, `VISTA_FOV` 6 to 4 to 3; `WIDE_OUT` 3.0 to 1.8 to 0.9, `WIDE_FOV` 4 to 2 to 1 | Every big air's vista and every biggest leap's held wide stands closer: the rider bigger at the apex, the lens's height and side step unchanged |
| `camera.ts` (hero) | The finish shot starts its move into the results card's free column as the swing settles (was: when the card opened) | Every finish: the card lands beside the rider, not across it |
| `post.ts` (pipe) | The speed fringe from 0.74 of the radius (was 0.5), blend 0.5 (was 0.7); the chromatic punch weighted toward the frame's edges (`smoothstep(0.6, 1.05, r)`), blend 0.6 (was 0.85) | Less colour fringe in every still; the punch still felt at the edges |
| `postfx/tiers.ts` (pipe) | High's `fringe` 0.7 to 0.3 | As above |
| `materials.ts` (light) | A prop's near dissolve dithered only between keep 0.42 and 0.58 (was 0.2 to 1) on tiers without coverage fade | Low and the phone: near pines solid, then gone, instead of a metre of stipple |
| `materials.ts` (light) | The fork's ice strip takes half its mirror from the deep upper sky and mirrors less (`1 - 0.8 * strip`, was 0.6) | Every fork strip a bluer lane at any hour |
| `materials.ts` (light) | The lake's long fractures 0.85 to 0.5 toward a paler shade, its near plates 0.5 to 0.32 | Lakes only (Pinecrest's Mirror Lake) |
| `momentkit.ts` (momentsworld) | A lit lantern holds solid to 5.2 m and is gone by 4.4 m (was a 2x2 dither from 7 m to 2 m) | Every set piece's lanterns and bells near the lens |
| `verbworld.ts` (momentsworld) | A street lantern's unlit glow 0.45 to 0.85 | Every lantern street before its first stomp |
| `landing.ts` (fx), `world.ts` (pipe) | `painted`: on a tier with no cast shadows the sled's blob is larger, darker, thrown off the sled away from the sun, in the shade's own hue | Low on every mountain |
| `rails.ts` | The cornice's torn tongues shorter, broader and six-sided; Pinecrest's lip shoulders bedded outcrops (alpine only) | Every leap's cornice: no row of white teeth from the air |
| `palette.ts` (light) | New `Grade.posterSnow` and `Grade.posterKey` (Low's poster only, 0 by default) | None unless a mountain sets them |
| `places.ts` | Pinecrest's lip crowns blunt (alpine only); the lift station's shutters and storeys (alpine only) | None |
