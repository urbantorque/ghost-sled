# Ghost Sled - Art Bible

**Direction: "Alpenglow Gouache."** A painterly-flat 3D mountain lit by a low sun. The palette is
mostly cool, against which three warm signals (the rider, gifts, the sun) and one spectral signal
(the ghosts) read instantly at speed. No PBR, no stock materials: every surface uses one shared
stylized lighting model, so the whole frame looks like a single hand-painted world.

## 1. Colour roles (locked across every mood)

| Role | Meaning | Base value |
| --- | --- | --- |
| Signal vermillion | You: your scarf, beanie, sled runners, primary buttons | `#FF4D2E` |
| Marigold | Gifts and currency | `#FFD34D` |
| Spectral mint | Ghosts, their trails, everything ghost-related in UI | `#8FF3E4` |
| Rose | Your grudge ghost only | `#FF5A7A` |
| Gold-white | Your own best-run ghost, and first place in the race | `#FFE08A` |
| Ink navy | UI panels, rider coat | `#121933` |
| Off-white | UI text | `#F5F3FF` |

Hazards are never warm and never mint. A danger reads as a dark, hard silhouette.

## 2. Lighting mood

- One low key light (sun or moon) at about 12 degrees elevation, ahead-left of the camera. This gives
  long shadows that streak toward the viewer and rim-lights the powder spray. The sun disc has a white
  core, a `#FFE3B0` rim and a warm corona.
- Two-tone wrap lighting: `mix(shade, lit, smoothstep(-0.25, 0.6, N.L))`. Shade is a saturated cool
  colour, never grey or black.
- A fresnel rim in the horizon colour on every object, so silhouettes separate from the snow.
- Atmospheric perspective: fog fades toward the horizon colour by distance and height. Three layers of
  distant ridges get progressively paler.
- Fake contact shadows (soft dark-blue blobs) under every prop and the sled. They are cheap and readable,
  and they matter: the sled's shadow is what you judge jumps by.

## 3. Shape language

| Thing | Shape | Why |
| --- | --- | --- |
| Snow, terrain, drifts | Broad, soft, rounded, smooth gradients | Safe space reads calm |
| Hazards (trees, rocks, spires, basalt) | Faceted, flat-shaded, sharp crisp silhouettes | Danger reads hard |
| Rewards (gifts, gates) | Round, bouncy, bobbing, puffy bows | Good things feel friendly |
| Ghosts | Flowing, tapered, ribbon tails, slightly blurred edges | Spirits feel fast and unreal |

Pines are three stacked faceted cones with crisp snow caps, rocks are chunky crystals, and gifts are
rounded boxes with a big bow.

## 4. Snow

- The base gradient comes from slope and light: cream-white in sun, periwinkle in shade. By day the
  lit snow takes only a trace of the sun's colour (the mood's grade supplies the warmth); at full
  strength the low peach sun turned it to sand.
- Cast shadows are crisp by their caster and soften and thin with distance from it, so long raking
  shadows taper into soft blue.
- View-dependent sparkle glints come from a hashed grid, brightest toward the sun.
- Faint wind ripples are stretched, patchy noise with soft crest lines and a little periwinkle in
  their troughs, lying about 30 degrees off the fall line. Never regular bands, which read as dunes,
  and never straight down the slope, where they converge like speed lines.
- **Skill is written in the snow**: the runners cut two soft periwinkle grooves whose width and
  depth follow carve depth, each with a modest lip on its sun side, running to the bottom of the
  frame and fading toward the lens: carved snow, never painted stripes. Drifts leave wide fans, and
  a perfect landing leaves a burst crater of displaced snow: a feathered cream-gold lip of raised
  powder, lit on the sun side and periwinkle on the other, a shaded bowl and 12 streaks, with no
  outer stroke. Ghost trails are faint luminous mint lines that show the line they took.
- Kickers read as built wedges: a packed, corduroyed face, darker flanks, a shaded takeoff wall, a
  contact shadow and a snow-capped board for a lip (pale ice on icy mountains).
- The bottom edge of the frame darkens toward the mood's periwinkle, never grey, so the foreground
  has depth.
- Ice patches are glazed: a cooler tint, a long specular streak, less sparkle.

## 5. The rider

- Toy proportions: the head is about a third of the height. A round beanie with a pom-pom, a folded
  cuff and ear flaps, goggles pushed up on it, mitts, a chunky ink-navy coat that tapers to the waist,
  with a lighter sun-side panel. The face is a toy's: oval eyes with catchlights and blush, on the
  front only; the back of the head is one smooth, dark mass of hair down to the scarf. Limbs taper
  and the elbows bend. The head stays near upright on its own neck, even in a hard lean.
- A long vermillion scarf simulated as a verlet chain. It is the motion indicator: it streams at speed,
  whips in spins and flutters in the air.
- Procedural poses: lean into carves (the torso at most about 35 degrees), low crouch while
  charging, arms out in the air, tuck in flips, a flail-and-tumble when you crash, and a punchy squash
  with arms up in a V on a perfect landing.
- The wooden sled has curled vermillion runners. On the round sleds (the Whirl Saucer and the Tea
  Tray) the rider sits cross-legged and leans forward over the rim.
- After a crash the rider sits up dazed beside its upside-down sled, both in the results shot, with
  its head turned three-quarters to the lens and three gold-white stars circling the beanie.

## 6. Ghosts

- The same rider silhouette in spectral glass (no face, goggles or scarf): fresnel edge glow in the
  kind colour, a tinted core filled to about a third with a slightly darker inner band, a gentle
  6 Hz flicker. Whatever fades it, a ghost never turns hollow or milky: growing on screen it
  dissolves from the hips up, and near the lens its fill thins toward the pure kind colour while
  the rim stays.
  Solid at the head and shoulders, it dissolves from the chest down into its wisp, and a soft halo
  wraps the head and shoulders. In night, dusk and whiteout moods ghosts blaze brighter.
  A ghost stays solid glass anywhere in the frame and never draws over the rider: where the two
  overlap on screen, the ghost shows around the rider's silhouette. It fades only on top of the
  rider or as it nears the lens.
- A tapering wisp ribbon trails each ghost, narrow at the root and fading over its last 60%, and a
  small floating name pill sits above it. The ghost the HUD names gets its pill first, with a ring.
- Your best run is gold-white glass (a pale gold inside and a warm amber rim) and is always labelled
  "Your best". Your grudge ghost is rose. Pool and friend ghosts are mint.
- Where a ghost crashed, a little lantern-headed marker stays planted in the snow with its name. At
  night it glows like a grave candle.

## 7. Moods (each has its own palette)

| Mood | Sky zenith -> horizon | Light | Snow lit / shade | Signature |
| --- | --- | --- | --- | --- |
| Clear Skies (biome base) | per biome | low warm sun | per biome | long shadows |
| Blizzard | `#6D7C93` -> `#C9D2DE` | flat diffuse; a dim, soft sun behind the cloud; faint, soft shadows, but a clear contact shadow under the sled | `#EEF2F7` / `#8A97AE` | dense fog, sideways snow streaks, big flakes past the lens, ghosts and gifts blaze; UI accent steel |
| Lantern Night | `#070B22` -> `#1E2B5E` | low moon + warm sled lantern: a soft, round, desaturated-amber pool about 3.5 to 4 m across under the sled that also warms the rider's legs and sled | `#7E92CC` / `#3B4A86` | stars, aurora ribbons, moonlit sparkle outside the pool, trail lanterns down the corridor, glowing gifts; UI accent moon blue `#B4C4FF` |
| Glass Ice | `#0E6FA8` -> `#BDF6FF` | low pale-gold sun ahead-left, warm rims on cold ice | `#E6FDFF` / `#7FC6DF` | glazed snow that mirrors the sky, a gold sun path, scratch glints toward the sun, ice spires from deep blue to white-cyan tips; UI accent aqua |
| Comet Night | `#1A0F3D` -> `#FF7A5C` | ember dusk; the comet is the only body in the sky (no moon disc) | `#EFE8FB` / `#6B4FB0` | a large comet head with a narrow blue ion tail and a broad cream-to-rose dust tail, about 35 degrees apart, both tapered and curved; an ember rim on the rider; UI accent lilac |
| Haunted Hollow | `#0B1F1C` -> `#3E7F6B` | pale green | `#CFE9DE` / `#4F7F78` | green mist, drifting wisp lights; UI accent green |
| Powder Day | `#2F7BE0` -> `#CDE8FF` | bright high sun | `#FFFFFF` / `#B9D3F2` | huge powder plumes; UI accent azure |

Biome bases for Clear Skies:

| Biome | Zenith -> horizon | Snow shade | Props |
| --- | --- | --- | --- |
| Pinecrest (alpine) | `#2B4C9B` -> `#FFB38A` | `#9DB2EC` | spruce teal pines, plum-slate rocks, snowmen |
| Frostfang (glacier) | `#2B5FA8` -> `#FFD9C4` | `#88B6E8` | translucent cyan spires, seracs, ice sheets |
| Ember Peak (volcanic) | `#2A1E3A` -> `#FF8A50` | `#8C7FA6` | basalt columns, ash-tinted snow, lava glow far below, steam vents |
| Sakura Ridge (blossom) | `#3A5BA8` -> `#FFC4D6` | `#A9B4E6` | blossom trees, vermillion spirit gates, drifting petals |

## 8. Camera and motion

- A low chase camera about 2.2 m behind and 1 m up, so the rider holds the lower middle of the
  frame. It looks ahead of the sled and leads into turns, and turns a little to frame a close rival.
- FOV breathes from 62 to 78 degrees with speed, plus a punch on boosts.
- The camera rolls up to 4 degrees into carves.
- Impact shake scales with landing impact. A perfect landing gets a short FOV kick and a thin white
  rim flash on the rider, gone in about 0.15 s.
- Portrait framing raises the camera and widens the vertical FOV, so the corridor ahead is always visible.

## 9. Post-processing

| Effect | High | Medium | Low |
| --- | --- | --- | --- |
| Bloom (sun, gifts, ghosts, boost) | half res, 5 mips | quarter res, 4 mips | off |
| Colour grade (lift/gamma/gain per mood) | on | on | baked into fog colours |
| Vignette + grain | on | vignette only | off |
| Speed streaks (radial) | on | on | off |
| Anti-aliasing | 2x MSAA | FXAA | FXAA |
| Pixel ratio | up to 2 | up to 1.5 | 0.8 to 1 |

## 10. UI

- Ink-navy panels at 86% opacity with an inner hairline. The system sans stack is used at weight 800 to 900,
  italic for speed words, with tabular numbers.
- Buttons are full pills, cards use an 18 px radius, and nothing else is rounded differently.
- Vermillion is reserved for the primary action and mint for ghost info; Ride is the only filled
  play button. A finished mission turns marigold, with a full bar, a check and "Done". No em dashes
  in copy, and no emoji.
- Each mood brings its own UI accent (see section 7) for its name and the reveal's key number. In
  night moods the pills get a moon-blue hairline so they hold their edges against the sky.
- The HUD's type grows with the screen height on desktop, the place numeral sits in the score's
  size class, and nothing in the HUD is under 11 px on a phone. A race gap is always a number and a
  word ("6 m ahead", "6 m behind"); a place change is an arrow and a count.
- Sparks are soft round motes that stay low over the snow, never four-point stars in open air.

## 11. What makes a frame screenshot-worthy

1. The rider airborne and silhouetted against a huge low sun, scarf streaming.
2. Long blue shadows raking across sparkling snow toward the camera.
3. A mint ghost just ahead, carving a luminous groove and pulling you in its slipstream.
4. Powder spray catching the light, with layers of paler ridges behind.

If a frame has those four things and the HUD stays out of the way, it sells the game.
