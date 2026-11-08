# Ghost Sled - Art Bible

**Direction: "Alpenglow Gouache."** A painterly-flat 3D mountain lit by a low sun. The palette is
mostly cool, against which three warm signals (the rider, gifts, the sun) and one spectral signal
(the ghosts) read instantly at speed. No PBR, no stock materials: every surface uses one shared
stylized lighting model, so the whole frame looks like a single hand-painted world.

## 1. Colour roles (locked across every mood)

| Role | Meaning | Base value |
| --- | --- | --- |
| Signal vermillion | You: your scarf, beanie, sled runners, primary buttons | `#FF4D2E` |
| Marigold | Spirit lights and the lantern (the course's fuel), gifts and currency (the menus'): a good thing you take | `#FFD34D` |
| Spectral mint | Ghosts, their trails, everything ghost-related in UI | `#8FF3E4` |
| Rose | Your grudge ghost only | `#FF5A7A` |
| Gold-white | Your own best-run ghost, and first place in the race | `#FFE08A` |
| Ink navy | UI panels, rider coat | `#121933` |
| Off-white | UI text | `#F5F3FF` |

Hazards are never warm and never mint. A danger reads as a dark, hard silhouette.

Skill signals live inside these roles rather than adding new ones:

| Signal | Colour | Role it borrows |
| --- | --- | --- |
| Drift charge, tiers 1 to 3 | pale coral `#FFC2A8`, coral `#FF8A5C`, vermillion `#FF4D2E` | You: the charge heats inside your own colour (it used to borrow the hazards' ice blue and the grudge's rose) |
| In the flow: rider rim and scarf glow | `#FF4D2E` | You |
| Your best's band on the snow | `#FFE08A` | Gold-white |
| A friend's band on the snow | `#8FF3E4` | Spectral mint |
| The clock running out: the combo timer's last quarter; on a big stake the fuse (the timer fill, a throb on the multiplier chip, the stake figure) | amber `#FFB040` | None: amber means time, never a reward, and it never fills a gift or a payoff |

## 2. Lighting mood

- One key light (sun or moon), off to one side of the fall line, whose height and colour belong to the
  mountain or the mood (section 7). A low one gives long shadows that streak toward the viewer and
  rim-lights the powder spray. The disc sits lower than the light that shades the snow, which never
  drops under 17 degrees (DECISIONS 27). By default the sun has a white core, a `#FFE3B0` rim and a warm
  corona; Clear Skies colours its own, so Frostfang's is lemon and Ember's a dim orange through the smoke.
- Two-tone wrap lighting: `mix(shade, lit, smoothstep(-0.25, 0.6, N.L))`. Shade is a saturated cool
  colour, never grey or black.
- A fresnel rim in the horizon colour on every object, so silhouettes separate from the snow.
- Atmospheric perspective: fog fades toward the horizon colour by distance and height. Three layers of
  distant ridges get progressively paler.
- Fake contact shadows (soft dark-blue blobs) under every prop and the sled. They are cheap and readable,
  and they matter: the sled's shadow is what you judge jumps by.

- **Painted skies.** Every mood but Blizzard has gouache clouds in the dome: heaped cumulus banks
  rising from the ridges, flat three-step shading with a rim on the sun side, and a few high wisps.
  They dip under the sun's bearing to frame the disc and never cover its core; they sit under the
  aurora and the comet, and the stars hide behind them. Low draws the banks only.
- **Light shafts** fan from a low sun in view (Medium and High), cut by trunks and crests, and never
  over the rider. Night moods have none.
- **Cloud shadows**: soft, slow cool patches drift over the snow in sunny moods (at most 30% off the
  light, never on the contact shadow or the painted bands). Medium and High.
- **Each mountain's journey.** On Clear Skies the light or the weather changes down a run, differently
  on each mountain (section 7): Pinecrest's cloud builds and it goes golden, Frostfang's sun sinks and
  the aurora arrives, Ember's ash thickens toward a glowing dusk, Sakura's mist lifts off the cone. All
  of it is keyed in metres in one table (`JOURNEY` in palette.ts). The title stays at the start; chaos
  moods keep their own light.
- **A smoke deck.** A ceiling of cloud across the dome, in its existing pass: billows in three flat
  values crowding toward the horizon, the undersides taking the glow low in the sky and strongest
  toward the hero. Ember Peak's Clear Skies alone; Low drops its fine octave. Reduced motion holds the
  deck and Frostfang's aurora still on Clear Skies, and a plain run never flashes: Ember's lightning
  stays a night-mood thing.

## 3. Shape language

| Thing | Shape | Why |
| --- | --- | --- |
| Snow, terrain, drifts | Broad, soft, rounded, smooth gradients | Safe space reads calm |
| Hazards (trees, rocks, spires, basalt) | Faceted, flat-shaded, sharp crisp silhouettes | Danger reads hard |
| Bare ground (walls, faces, ridges) | Flat planes, hard edges, three values, no noise | The mountain's bones |
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
- **One painted line**: your best run's line is a thin gold-white band on the snow (a friend's is
  mint), brighter as you close on it, with a "Best in N m" countdown and a flare where it ends and
  new ground begins. It is the one painted mark allowed, because it is a line to chase rather than
  decoration (DECISIONS 84).
- **A near miss shakes what you shaved**: snow sifts off a tree's boughs, or slate grit (pale shards
  on ice) kicks off a rock's foot. The burst sits 1.2 m ahead of the sled on the shaved side,
  blooms away from the rider so it never buries the hero, and is pulled in until it is on screen. A
  Whisker throws the full amount, an ordinary near miss about two thirds.
- Kickers read as built wedges: a packed, corduroyed face, darker flanks, a shaded takeoff wall, a
  contact shadow and a snow-capped board for a lip (pale ice on icy mountains).
- The bottom edge of the frame darkens toward the mood's periwinkle, never grey, so the foreground
  has depth.
- Ice patches are glazed: a cooler tint, a long specular streak, less sparkle.
- **Bare ground.** Where something shaped the ground it shows the mountain's own material, never a
  snowy hill: a ravine's walls, a tunnel's approach, a leap's and a terrace's faces, the gorge under a
  bridge, the outcrops along a fork's ridge. It follows what made the ground, not its slope alone (a
  plain bank is as steep as a ravine's foot and stays snow), and it is never on a line a sled rides.
  The snow gives way along the facets' edges, and what lies flat holds snow, ash or moss.

  | Mountain | Cut | Reads as |
  | --- | --- | --- |
  | Pinecrest | faceted strata, grey-plum, dipping a little | snow lying on every other shelf |
  | Frostfang | tall shards of crevasse ice | pale where it meets the light, down through cobalt to near black, pale fractures in it |
  | Ember Peak | basalt columns, two faces each | ash on their broken tops; about one joint in ten holds a thin, dim, breathing line of lava. Thin, or it is a warm wash over a hazard's dark |
  | Sakura Ridge | dressed stone in courses, each block a little pillowed | moss in patches along the tops; never mint |

  Past a section's `edgeLimit` a wall stands up into low-poly rock with a jagged crest, the forest
  behind it, and its shadow crosses the floor, so a ravine is a slot with a strip of light in it.
- **The frozen lake.** Black ice over deep water, and a mirror: the real sky and peaks, the banks and
  their treeline standing in it with jagged tips, and the rider upside down under the sled, leaving
  the ice when the sled does. Long white fractures run through the sheet; closer cracks and bubbles
  lie deeper and slide under the surface as you ride, and that is how a mirror shows speed. Blown snow
  lies in long feathered tongues about 25 degrees off the fall line, thickest toward a soft, wandering
  shore, and spindrift runs across the ice in thin wisps (held still under reduced motion, as are
  Ember's cracks).
- **A leap's landing is groomed**: corduroy across the fall line and broad swaths of it, so from the
  air the face has a grain to judge by. Flags stand down both its sides. It is snow, not a painted mark
  (section 4's one painted line stands).
- **The fork's strip** is clear blue ice with a scribed bright edge and hard points of light that wink
  on any bearing to the sun; it holds its colour where a plain mirror would go white.

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
- In the flow the rider's rim and scarf glow vermillion, building with the shown flow and full at
  3.5; a snuff puts the glow out with a short puff, so the state is visible without reading the HUD.
- After a crash the rider sits up dazed beside its upside-down sled, both in the results shot, with
  its head turned three-quarters to the lens and three gold-white stars circling the beanie.

- The limbs are tapered capsules with domed ends, the coat one lathed form that flares at the hem and
  nips in at the waist, with rounded mitts and soft boots. The back of the head carries the detail,
  because the chase camera only ever sees it: a ribbed cuff, a seam up the crown, a cream knit stripe,
  a fluffy pom-pom and a scalloped chestnut bob. The pom-pom springs on landings and the hem flutters
  with speed (in the vertex shader). After a crash the upside-down sled rests just past the boots.

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
- Every ghost rides a faint glass sled of the sled it raced, in its kind colour, with glowing
  runners and a soft glass lap of legs joining the dissolving body to it. It sits on the sled like
  the rider, banks a little and leans into its carve, a short scarf wisp at its neck, and two thin
  luminous runner lines follow it over the snow. Within about 3 m of the lens the sled fades out.
- Your best run is gold-white glass (a pale gold inside and a warm amber rim) and is always labelled
  "Your best". Your grudge ghost is rose. Pool and friend ghosts are mint.
- Where a ghost crashed, a little lantern-headed marker stays planted in the snow with its name. At
  night it glows like a grave candle. A ghost that finished leaves none: it rides on into the square,
  easing up, and fades.
- Where three or more pool ghosts fell within 8 m, a cairn stands on the bank, never in the line,
  with a named tag over it ("Widow's Bend", "4 ghosts fell here"). Medium and High only: Low draws
  no cairn.

Each biome's decorative forest mixes variants (Pinecrest: classic, snow-laden, young pines and a dead
snag; Frostfang: spires, snapped spires, seracs, crystal mounds; Ember: charred pines, snags, basalt
clusters and stubs; Sakura: blossom, pale spreading blossom and pines), with a small colour shift per
tree and the odd lean. Medium and High also dress the banks, always at least 9.2 m past the corridor
edge (bushes, stumps, fences, slalom poles, cabins, lift towers and cables, per-biome pieces), and
each course section reads before it plays: chute rock bands and blue-violet slalom flags, a bowl's
cornice lip, bench fence rails, gully walls of icicled rock, a split's two-armed signpost, crags along
a ravine's crest, boulders and bushes round a lake's shore. Trees and dressing never stand on a wall,
a ledge's face or the ice. A tree run's wall closes in to its own limit with a taller rank crowded
behind it, and the light on its floor comes through the boughs in soft pools.

The course's own marks are on every tier, Low included, in one draw:

- **Leaps.** Fins of the mountain's rock stand either side of the lip, off the line, and two lines of
  flags in the slalom blue-violets close on it, so the eye is led to the gap and the sky past it. A
  wind-torn cornice runs across the brow, flush with it, hanging out over the drop. Nothing on the line
  looks like a hazard.
- **Rails** rise out of a mound of snow at the low end and run on over plumb posts, in the mountain's
  own timber, steel, iron or lacquer, a pale strip along the top catching the light.
- **The fork** is announced by a gantry across the corridor before the ridge stands up, a board over
  each channel so the two read either side of the rider from 150 m: the calm route pale with a
  blue-violet disc, the bold route dark with a white diamond and a marigold band for the gifts down
  it. The rider hides the vanishing point, so a sign on the centre line is the one place it cannot go.

## 7. Moods (each has its own palette)

| Mood | Sky zenith -> horizon | Light | Snow lit / shade | Signature |
| --- | --- | --- | --- | --- |
| Clear Skies | per mountain, below | each mountain's own, below | per mountain | one frame tells you which mountain you are on |
| Blizzard | `#6D7C93` -> `#C9D2DE` | flat diffuse; a dim, soft sun behind the cloud; faint, soft shadows, but a clear contact shadow under the sled | `#EEF2F7` / `#8A97AE` | dense fog, sideways snow streaks, big flakes past the lens, ghosts and gifts blaze; UI accent steel |
| Lantern Night | `#070B22` -> `#1E2B5E` | low moon + warm sled lantern: a soft, round, desaturated-amber pool about 3.5 to 4 m across under the sled that also warms the rider's legs and sled | `#7E92CC` / `#3B4A86` | stars, aurora ribbons, moonlit sparkle outside the pool, trail lanterns down the corridor, glowing gifts; UI accent moon blue `#B4C4FF` |
| Glass Ice | `#0E6FA8` -> `#BDF6FF` | low pale-gold sun ahead-left, warm rims on cold ice | `#E6FDFF` / `#7FC6DF` | glazed snow that mirrors the sky, a gold sun path, scratch glints toward the sun, ice spires from deep blue to white-cyan tips; UI accent aqua |
| Comet Night | `#1A0F3D` -> `#FF7A5C` | ember dusk; the comet is the only body in the sky (no moon disc) | `#EFE8FB` / `#6B4FB0` | a large comet head with a narrow blue ion tail and a broad cream-to-rose dust tail, about 35 degrees apart, both tapered and curved; an ember rim on the rider; UI accent lilac |
| Haunted Hollow | `#0B1F1C` -> `#3E7F6B` | pale green | `#CFE9DE` / `#4F7F78` | green mist, drifting wisp lights; UI accent green |
| Powder Day | `#2F7BE0` -> `#CDE8FF` | bright high sun | `#FFFFFF` / `#B9D3F2` | huge powder plumes; UI accent azure |

Clear Skies, mountain by mountain. Each row is the start of a run and the title; the chaos moods build
on their own base and see none of it.

| Mountain | Zenith -> horizon | Sun (bearing, disc, key light) | Snow lit / shade | Silhouette | Reads as |
| --- | --- | --- | --- | --- | --- |
| Pinecrest (alpine) | `#123F9E` -> `#CBE8F8` | white, 31 right, 24, 44 | `#FFFFFF` / `#7CA6EC` | a broad crown of three summits, left; a saw of peaks behind | a bright ski day: deep teal pines, sharp blue shadows |
| Frostfang (glacier) | `#0A2470` -> `#A6C6EE`, thin lemon band `#FFF0A0` | lemon, 35 left, 5.5, 23 | `#D4E4FA` / `#4C76C4` | a curved needle fang, right, over a field of needles | polar blue hour: long steel-blue light, glazed snow, the town lit |
| Ember Peak (volcanic) | `#1C1316` -> `#D8602C` under the smoke deck | dim orange, 34 right, 15, 30 | `#CFC8CC` / `#54465E` | a huge dark cone dead ahead, its rim blown out toward you, over low shields | under ash: warmth in the sky, ash on the snow, lava threads |
| Sakura Ridge (blossom) | `#9CCFC2` -> `#FFF1DA` | soft cream, 24 left, 19, 29 | `#FFFBF4` / `#BFC6E2` | one perfect long-skirted cone, right, over soft low hills | a spring morning: peach mist, low contrast, blossom the hero |

Each mountain's run (metres are tunable, in `JOURNEY`):

| Mountain | First | Then |
| --- | --- | --- |
| Pinecrest | 500 to 1700: cumulus and high cloud build, and their shadows sweep the snow | 2300 to 3500: gold over blue under the cloud, cream snow, the peaks glowing. Never the old lilac |
| Frostfang | 700 to 1900: the sun sinks onto the band, stars come out | 2400 to 3400: polar night, the aurora arrives, the glacier holds the light, a soft sled lantern |
| Ember Peak | 500 to 1800: the deck closes, the disc dims, the air draws in, embers thicken | 2300 to 3400: a glowing dusk, lava lighting the smoke and running down the cone. No lightning |
| Sakura Ridge | 400 to 1600: the mist lifts off the cone and the sun climbs out of it | 2400 to 3400: a clear spring day with the wind in the blossom |

The baked props never change during a run. A late stop dims hazards through `hazardDim`, and the sky
stays clear of the ghosts' mint on every mountain at every stop (`tests/palette.test.ts`).

| Biome | Props |
| --- | --- |
| Pinecrest | deep teal pines, slate rocks, snowmen |
| Frostfang | deep ice-blue spires, seracs, ice sheets |
| Ember Peak | basalt columns, ash-grey snow, lava glow far below, steam vents |
| Sakura Ridge | blossom trees, vermillion spirit gates, drifting petals |

## 8. Camera and motion

- A chase camera close behind the rider, so the rider holds the lower middle of the frame. It looks
  ahead of the sled, turns toward the road 1.5 s down the run, and turns a little to frame a close
  rival. Below about 15 m/s it rides low, about 1 m over the sled.
- Speed lifts the lens, it never drops it into the snow. From about 28 m/s it stands clear of the slope
  (1.5 m over the snow at 30 m/s, 1.7 m at 44), the rider sinks a little in the frame, and the road
  spreads down the screen above the rider's head. A player needs to see a hazard about 1.5 s out: 45 m
  at 30 m/s, 66 m at 44. `scripts/playtest/readability.js` measures it.
- Speed reads across the whole range and every curve lives in `src/render/speedfeel.ts`: 28 m/s already
  feels fast and 46 m/s is the edge of control. Nothing runs out early. The FOV breathes from 62 degrees
  to 79 at the cap, plus a boost and a punch; streaks, the lens's rumble, flakes and kicked snow all
  climb to the cap, and past 36 m/s the horizon shivers and the corners close in a little.
- The camera rolls up to 4 degrees into carves.
- Impact shake scales with landing impact. A perfect landing gets a short FOV kick and a thin white
  rim flash on the rider, gone in about 0.15 s.
- Portrait framing raises the camera and widens the vertical FOV, so the corridor ahead is always visible.
- Time bends only at the edges, never in the sim: a stomp's hitstop grows with the streak (8 to 11
  frames), a tier-3 drift release freezes a little longer than a stomp, a Whisker gets 0.05 s, and a
  crash eases into a slow curve. Reduced motion turns all of it off and keeps every beat.
- A wipeout the run survives: the lens drops and shakes, then eases out and up and holds the rolling
  rider in the middle of the frame until it is back on the line. A scrape knocks it off the edge. A wall
  ride leans the horizon and steps the lens in off the bank.
- Big air holds up for flights of 2 to 3.5 s and more: the lens stays out with the valley under the
  rider and is home 0.35 s before touchdown. A touchdown after 1.5 s or more throws a powder wave.
- The finish: render time eases to 0.38 and back over about 2 s (the sim never slows), and the lens
  swings round the coasting rider to a three-quarter front, low and wide, the rider low in the frame
  with its arms up and the sky over the slope above it, where the shells burst. It holds there, creeping
  on, and moves the rider aside for the results card. Reduced motion never swings and never eases.
- After the crash's held frame the camera watches the pack ride past the wreck: the orbit stops
  drifting and turns toward the passing ghost with the wreck kept in the middle of the frame, or
  cuts to a still shot beside the line the ghost will cross, so the race you just left goes by in
  view before the results.

- While the avalanche chases, it is in the world: its cloud's flank rolls down both banks ahead of
  the front in rooted billows, dark slabs roll past along the corridor edges (never between the lens
  and the rider), and powder gusts and grit overtake the lens from behind. Fine flurries streak past
  the lens at speed and spindrift blows off the bank crests (Medium and High; reduced motion turns
  the flurries off).

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
- The sky's centre stays clear: the avalanche mirror and its meter hang top-right under the gifts in
  landscape (beside the gifts on a phone held upright, the meter in the race row), the top-centre
  stack is short, and while the rider is airborne with nothing new the callout and stake fade to 30%.
- One banner at a time. A perfect landing's stamp heads its beat; a pass, a duel result or a
  mission waits under it and plays after, and minor words go to the callout line under the combo.
  A duel's result owns the rival pill for 1.5 s.
- A bank's chip slams and its figure rolls up, longer for a bigger tier (350, 600 or 900 ms), and a
  lost combo of 300 or more cracks and falls.

## 11. What makes a frame screenshot-worthy

1. The rider airborne and silhouetted against a huge low sun, scarf streaming.
2. Long blue shadows raking across sparkling snow toward the camera.
3. A mint ghost just ahead, carving a luminous groove and pulling you in its slipstream.
4. Powder spray catching the light, with layers of paler ridges behind.

If a frame has those four things and the HUD stays out of the way, it sells the game.

## 12. The world at scale

The run is high on a real mountain, in a world that goes on past the banks and is lived in.

- **The panorama.** Faceted ranges in three depth steps, each paler and hazier with distance and
  warmer toward the sun, rise out of a sunlit sea of clouds drifting below the horizon. Snow holds
  on gentler faces above a ragged snow line and steep faces show the biome's rock; the sun side is
  warm, the shade side takes the mood's cool shade. Each biome has a hero: Pinecrest's crown of three
  summits, Frostfang's curved needle fang over glacier tongues, Ember Peak's smoking volcano with a
  crater glow, Sakura Ridge's long-skirted cone. Each has its own ranges too: a saw of peaks, a field of
  needles, low shields, soft hills. On Clear Skies the hero stands where the mountain puts it and stays
  there all run; in chaos moods it stands away from the sun. Blizzard veils it all to ghosts.
- **The middle distance.** Past the banks one side usually falls to a valley floor far below and the
  other climbs into a flank, forested low down and bare above the treeline, with crags, gullies and
  wind-drifted snowfields, faceted like the hazards. Hamlets perch on the flanks and villages sit on
  the valley floor (chalets round a church and a frozen lake, red research huts and a radio mast,
  stone lodges by a glowing lava river, a pagoda town with lanterns). Windows and lamps glow warm
  from dusk and hold through the haze as points of light.
- **Places.** No stretch of a run goes much past 300 m without one. The course says where: a street is a
  town you ride through, a tunnel a roof, a bridge a bridge, the finish a town worth arriving at. Between
  them a place 15 to 50 m tall stands over or beside the run, readable far down the fall line: timber
  gates and trestles, an ice arch, a basalt gateway with lava-lit braziers, a torii in deep plum lacquer
  (never the player's vermillion), and huts, towers, a ski jump, frozen falls, an observatory, guardians
  and a pagoda. A ravine's walls hide its banks, so what a ravine holds is a span across its slot.
  Lift lines cross overhead at real height with chairs moving, from a station close beside the run; a
  red ropeway house at Frostfang, a basalt mine head with ore skips at Ember, a lacquered cableway at
  Sakura. Toy spectators in the rider's proportions, coats in cool and muted colours and never a signal
  colour, turn to follow the rider and throw their arms up when a moment is made near them. Each
  mountain dresses its own: Pinecrest in loden under bobble beanies, felt hats with a feather and
  trapper caps, ringing cowbells; Frostfang in quilted parkas with fur-ruffed hoods, goggles and fur
  hats, waving ice axes; Ember in long ash dusters and capes under pointed hoods, miners' helmets and
  face wraps, raising picks; Sakura in wrap robes with a sash under straw hats, a bun or a headband,
  twirling paper parasols. Each has a habit (waves, claps, pumps both arms, throws a snowball at the
  run as the rider passes, cups its hands to shout); heads turn before bodies, bodies lean out as the
  rider comes, and a fifth are kids who bounce. The far rows are baked, posed with arms and flags up
  in the same silhouettes, and on Low, which animates no crowd, a street's crowd is baked that way too:
  fewer, bigger figures. Every run
  starts at an occasion: a gate high over the steep ramp with the word on it, packed grandstands down both banks with flags up, two huts looking over them, and barriers. Every leap has a crowd on the rock shoulders either side of its lip.
- **Life.** Dark crows wheel over the treelines and scatter from a stomp; cranes cross Sakura, a lone
  owl flies at night, ash falls on Ember Peak. Chairlifts run with tiny passengers, chimneys send up
  three-value gouache smoke lit warm on the sun side, prayer flags and lantern strings flutter, and
  small warm-brown deer, ibex, hares and foxes stand at the treeline, only on open ground, never in rock, a street or over a gorge, and bolt away as you come, pulling up short of rock. Far
  skiers carve S-turns on the flanks. Herds graze, then lift their heads and turn to watch you come,
  and bolt one after another; a fox sits up on a rock following you with its head until it hops down;
  crows (ravens on Ember, cranes on Sakura) peck on the bank ahead and lift off as you near; kids sled
  down the bank and wave; now and then a snowboarder drops in off the bank and rides alongside for a
  few seconds before peeling away. Life is small, soft and moves away from the run: never in the
  corridor, never a signal colour.
- **Snow and trees.** Past the treeline snow heaps into drift dunes, crests catching the sun and
  troughs holding cold blue; the banks carry sastrugi in patches; the corridor's middle is a packed
  lane, a step cooler, with faint old tracks. Pines are tiers of drooping, scalloped boughs with
  ragged snow caps, a dark underside under each tier and a tree well at the foot. A low mist settles
  on the course floor in the distance and the fog warms toward the sun.
- **The lens.** Big air opens out into a vista and is home before the stomp; speed reads through the
  lens from 15 m/s all the way to the cap at 46; a hard carve at speed throws a rooster tail of gouache
  billows, rim-lit when backlit, and it goes on growing to the cap. The title cranes in from a wide shot
  of the whole world.
- **Close to the lens.** Slim markers stand along both corridor edges, 0.8 to 3 m past them and 10 to
  18 m apart, for a strobe of parallax: stakes, tall banded poles, slalom flags flapping harder with
  speed, and roped fence posts down one bank. Birch and sky blue in the Alps, ice wands with lilac tags
  on the glacier, ash-pale stakes on the volcano, cream bamboo and paper on Sakura. They are markers, not
  hazards: pale, slim, a little light of their own so a low sun never drops them to a silhouette, never a
  signal colour, and they fold away round a rider who wall-rides through them. No post stands where the
  ground past the edge falls away or short of something solid at the edge. Snow kicked off the runners
  falls back past the lens's lower corners, flakes hang further ahead the faster you go, and a fast
  carve's edges stretch into long streaks.
- **The world answers skill.** A stomp or a big landing near a bank sends a tongue of soft lumps sliding
  down it with powder off its front, ahead of the sled, gone before the edge of the run. A max drift or
  a passed ghost near a crowd lifts them onto their toes. A rival beaten shakes powder off the treeline
  and the banks: down both of them for a grudge, in its rose, and down one for a duel.
- **The finish.** Shells rise from the snow and bloom as dabs of gouache in the player's vermillion, the
  gifts' marigold, cream and the snow's periwinkle, never lit like a hazard and never mint. Confetti
  cannons fire in over the rider and ribbons drift down through the frame while the crowd roars.

- **Overlooks.** At least three times a descent, the first inside 1.5 km, on open ground only, one bank opens. The treeline steps back, a low timber rail (larch, pale
  boards, charred posts or lacquer by biome) runs along the forest limit, a bare snow shelf runs out to
  a rounded cornice with dark rock breaking through, and beyond it the mountain falls away. Down the
  fall line the view goes out over the valley haze and the sea of clouds to the hero peak. The lens
  leans toward the open side and takes a breath as it opens. Sometimes both sides open and the run
  rides a ridge.
- **Towns.** A street puts walls at the lens. Fronts stand 2 to 4 m past the run's edge, cut into the bank
  with their floors at the snow: alpine chalets, a red-and-ochre research station, basalt hot-spring
  lodges, a lacquered temple town. Upper storeys lean out, balconies and awnings reach toward the
  run, a house now and then stands right on the barrier, and a second row of roofs climbs the crest
  behind. Painted barriers run where the sim turns a sled back, in boards that blur at speed, and a
  crowd packs the strip behind them, flags up, doing the wave. A hotel's balconies look down.
  Banners, bunting and lantern strings hang high across from tall masts, only as low as the highest
  air allows. Windows glow from dusk and warm light spills over the run's edge; at night the
  shop fronts bloom. A mountain with no street in its script has its town beside the run instead.
- **The finish.** Each mountain's biggest place. The street opens into a square of grandstands cut into
  both banks, the near rows alive and the far rows a packed still crowd, under masts and long banners.
  A real arch stands over the line, the word on its board, the mountain's own crown on each tower. The
  line is paint: four rows of big checks in ink and cream, barrier to barrier and up the banks, long down
  the run so the lens sees them square. The square runs from 72 m before the line to 118 m past it, so a sled rolls the length of it as it stops, about 130 m past the line from cruise, and the stationary
  frame holds it all. The run-out carries on through the town to a great hall that closes the view, and
  over the hall stands the mark you can see from the last leap: a steeple, a radome and mast, a
  lit stack, a pagoda. Balloons are tethered over the roofs.
- **Bridges.** The run crosses a chasm on a deck 11 m wide with the ground falling 34 m past its rails.
  Frostfang's is an ice span, two great ribs of blue ice with icicles along them and a parapet of ice
  blocks. Ember's is an iron through-truss on basalt piers with braziers on the portals, lanterns along
  the top chord and a lava river crossing under it. Pinecrest's is a dark timber truss between two
  lamp-eyed towers, and Sakura's a span of oxblood lacquer on tall red towers. Raked legs and struts reach down round
  the ridge of ground under the deck, and the rails stand where the sim turns a sled back.
- **Tunnels.** Where a script says tunnel the run goes under a roof at the section's whole length: a tall
  avalanche gallery whose pillars throw bars of light across the snow, an ice vault, a basalt tunnel
  with glowing cracks whose mouth is a hole in a great rock mass, a corridor of wine-lacquer torii. The
  roof follows the air down the stretch: the mouth stands tallest and it comes down inside. The frame
  darkens at its edges inside and bursts with light on the way out. Where low gravity flies over any
  roof the walls and pillars stand alone.
- **The sound of the world.** Crowds roar from their bank, swell as you come and cheer what you do near
  them: cowbells and whistles in the Alps, taiko under Sakura's gates. Crows argue over the treeline and
  burst up from a stomp. Chairlifts clack through their towers, valley churches toll in the alpenglow,
  owls call at night. Open bowls and overlooks blow wide and airy; galleries and tunnels close in with a
  slap of echo. Big air opens the band out with a deep whoosh. Each weather has its own floor. All of it
  stays under the band and never covers a hazard's telegraph.
- **The moments.** Gifts are rounded, glossy boxes in two tones of marigold stripes with foil glints and
  a satin bow; a pickup pops in ribbon confetti and tumbling coins, and gifts down the line twinkle. A
  passed ghost shatters into petals of spectral glass in its kind colour, kept low and off the rider;
  the ghost you draft lays a sheet of its light with chevrons over its track. A stomp's shockwave runs
  out through the snow. The rider's lean lags the sled and settles, it soaks up bumps, its outside arm
  balances a carve and it tucks at speed.
- **The sky moves and the light is a moment.** A low sun throws crepuscular rays through the cloud gaps;
  shafts hang in the air, never on the near snow. Clouds build and sink, their shadows sweep the far
  ranges, a powder avalanche now and then pours down the hero's face, and summits fly spindrift
  banners. Valleys hold drifting mist. Glass Ice wears a 22 degree halo with sun dogs, Haunted Hollow a
  pale green lunar ring, night moods bring shooting stars, Blizzard gusts sweep curtains of snow, and
  Ember's volcano flashes with lightning at night.
- **Far trees** keep the same tiers, height, reach and snow caps with fewer segments. Stand 128 m or more
  away and the forest should read the same: a far tree that reads differently from a near one is a bug.

## 13. The lantern, the set pieces and the riders (round 5)

- **Spirit lights** are small marigold flames: a lathed teardrop, round at the foot and drawn to a point, its
  core paler than its skin so it reads as light rather than paint, upright and bobbing. A spark is 0.8 m tall; a
  great light is 1.2 m, wears a thin ring of light at its waist and carries a second small flame beside it, so the
  two are told apart at 30 m/s. Past the detail range a light is a drawn-out diamond. Taking one throws a soft
  flare of marigold motes that rides with the sled: no confetti and never red (the rider owns vermillion).
- **The lantern** on the HUD is three small lanterns where the gifts' counter stood: ink cells with a marigold
  rim that fill from the bottom with a cream-to-marigold gradient, glow when full, and burn white for a dash. On
  touch it is a 78 px round button above the right thumb's zone.
- **A dash** is the rider as a spirit for 1.4 s: the lens punches out, white-gold motes trail behind the sled, and
  a pale shimmer rides the sound. **A ward** breaks into marigold light and a puff of white where the hit was.
  A dashing ghost trails pale mint-white light; a warded ghost breaks into marigold for a moment.
- **Sky gates** are rings of marigold light (a torus 2.4 m in radius, its tube 0.14 m) hung over a kicker's flight,
  breathing a little and turning slowly about their own axis; one draw for all of them, on every tier. Flying
  through one bursts it into white-gold.
- **Set pieces** carry their own air for as long as they last: Ember's embers (`#FF9A4A`), Sakura's petals
  (`#FFC9DA`), a festival street's lantern glow (`#FFE29A`), and out of a tube a burst of warm light on the post
  pass. Their title card is the stage line's card set larger and wider, with the line to play in marigold and a
  marigold hairline; a clean sweep on the way out gets a marigold rim.
- **Fireworks** over the square for a win use the rider's own warm colours and the lantern's (vermillion, coral,
  marigold, white-gold), never mint or rose.
- **Signature riders** keep the spectral body (mint, rose for a grudge, gold-white for your best) and carry their
  identity in silhouette: twelve hats in the same glass (a felt hood, antlers, a topknot, a wide brim, a stovepipe,
  a giant bobble, a beak hood, a lantern on a headband, curled horns, an aviator cap, fox ears, a crown). Their own
  accent colour appears in three places only: the emblem disc before the name on the tag, a thin inner edge on the
  tag, and a ribbon in the wisp. Their word on the results has a rule in that accent.
- **Sled paints** recolour a sled's body and wood at their own value, so the grain and the hull's shading stay; the
  trim stays vermillion, and so do the scarf and beanie. No paint uses a locked role's colour.
