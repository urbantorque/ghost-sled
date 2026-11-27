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
  on each mountain (section 7): Pinecrest's cloud builds and it goes golden, Frostfang's sun sinks,
  the aurora comes and goes and the dawn breaks over the Fang, Ember's ash thickens toward a glowing dusk, Sakura's mist lifts off the cone. All
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

Pines are three stacked faceted cones with crisp snow caps, and gifts are rounded boxes with a big bow.

The visual lift: Sakura's blossom is the one rounded hazard. Its canopies are lobed clusters of puffs, painted in
three flat values a facet (a wine underside, the body, a pale crown) on a dark trunk, so it keeps a hazard's hard
steps inside a rounder silhouette; on Low it is flat-shaded.

Round 7, the hazards' row: rock is laid down in beds: each bed its own value and thickness, shifted off the one
under it, so it has ledges that hold snow and overhangs in shade; the beds dip, and on a long outcrop they run up
out of the slope and are cut off by its top, so no joint is level; a crown is broken, never flat; snow lies on a
boulder's lee side, never in a ring. Basalt stands in organ pipes: slim hexagonal columns packed shoulder to
shoulder, each broken off at its own height on its own slant and cross-jointed into drums, near black and cold, ash
on the flatter tops. Nothing is a prism under a white lid. Whatever its form, stone is painted with strata in three
values (`rockforms.ts` builds the forms, the stone material paints them).

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
  frame at full strength, and lasting the run: a rut does not age. A deep carve throws clods out past
  its lip. Every ghost cuts ruts too, two runner cuts in the snow's own shade with a lit lip, under its
  line of light; they lie on the snow ahead until you ride over them. Carved snow, never painted
  stripes. Drifts leave wide fans, and
  a perfect landing leaves a burst crater of displaced snow: a feathered cream-gold lip of raised
  powder, lit on the sun side and periwinkle on the other, a shaded bowl and 12 streaks, with no
  outer stroke. A ghost's light fades in seven seconds; its rut stays.
- **Round 7: snow carved by the wind.** Three scales of painted relief: wind slab (crests 7 m apart, in
  fields), sastrugi (1.6 m, across the run at half strength as well as on the banks) and the fine
  ripples, each with a lit crest and a lee face in the shade's own blue (teal on Ember, lavender on
  Sakura). The fine glitter reaches 22 m and gathers toward the sun; far slopes turned to mirror the
  sun carry a soft sheen. Low paints the slab's colour and skips its normal.
- **One painted line**: your best run's line is a thin gold-white band on the snow (a friend's is
  mint), brighter as you close on it, with a "Best in N m" countdown and a flare where it ends and
  new ground begins. It is the one painted mark allowed, because it is a line to chase rather than
  decoration (DECISIONS 84).
- **A near miss shakes what you shaved**: snow sifts off a tree's boughs, or slate grit (pale shards
  on ice) kicks off a rock's foot. The burst sits 1.2 m ahead of the sled on the shaved side,
  blooms away from the rider so it never buries the hero, and is pulled in until it is on screen. A
  Whisker throws the full amount, an ordinary near miss about two thirds.
- **Trees shed snow as you pass.** A forest tree by the run with snow on its boughs, passed within about
  2.5 m at speed, lets the same sift fall off its boughs as a near miss, about two thirds of it, once a
  tree. Snags, ice and basalt hold nothing to shed. A shaved or passed tree shakes for a second and a
  half. Ghosts shake theirs too. Sakura's blossom sheds petals, Ember's charred pines ash.
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
- **The valley's lakes.** On Pinecrest's Clear Skies the white far below is the valley floor's snow and
  its openings are frozen lakes that hold still: a feathered shore of drifted snow, pale ice under the
  haze with tongues of blown snow across it, and a sheen toward the sun. Never flat blue shapes.
- **A leap's landing is groomed**: corduroy across the fall line and broad swaths of it, so from the
  air the face has a grain to judge by. Flags stand down both its sides. It is snow, not a painted mark
  (section 4's one painted line stands).
- **The fork's strip** is clear blue ice with a scribed bright edge and hard points of light that wink
  on any bearing to the sun; it holds its colour where a plain mirror would go white.
- **Three snows (round 8).** A made place (the start, a cruise, benches and switchbacks, a street, a bridge's deck,
  a tunnel, the square, a leap's landing) is a groomed lane, a step whiter and smoother than the powder beside it; a
  wild one (a bowl, a chute, a gully, a tree run, a ravine, the terraces, a fork's channels) and every bank are
  powder; ice is the sim's. Never a long straight line down the fall line, nothing regular across it: a groomed
  lane's own corduroy and painted powder pillows were tried and read as speed lines, scanlines and smudges, so the
  corduroy stays held off (`CORDUROY_RIB`) and the pillows are relief the light draws (below). A leap's landing keeps
  its corduroy, a lighter step, and Low its fine ribs off.
- **The wind's relief (round 8).** Powder lies in pillows a few metres across, 30 degrees off the fall line, and
  round 7's sastrugi lie in fields, broken into lengths. Both are forms the light draws, not paint: each turns toward
  the key light or away from it, casts its own shadow by a low light on the key's bearing, and takes a sheen where a
  flank mirrors the sun. They are whole on the banks, gentle on the floor a sled rides and under the lens (where
  motion would smear them into streaks), and a whisper on a groomed lane; the sastrugi go in a cast shadow, and so
  does the relief's own shadow wherever the ground is turned from the light. A face the light stands well over keeps
  its light under them. Low keeps round 7's painted slab and no relief.
- **Glints are facets.** A glint flashes only while a crystal's facet mirrors the light to the eye, so the glitter
  turns with the lens and gathers toward the sun (harder by day, round 8), in the light's own colour.
- **The runners know the surface:** a trench with a berm of thrown snow either side in powder, a shallower cut in a
  groomed lane, a frost scratch on ice; a ghost's is the same, fainter. A perfect landing throws a ring of powder
  flat over the snow and leaves a veil over the crater, more snow than any fall; thrown snow is never darker than
  about half its lit side, so it is never smoke, and Ember's spray is snow too. A ghost leaves powder hanging where
  it passed, and the wind lifts spindrift off the banks' crests in gusts (Medium and High). Low keeps the painted
  surfaces and the trench, not the moving snow.

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
- **Comet Bob** is a racing bob in violet lacquer (`#5A3E96`, `#3F2A70`): the classic sled's five slats with the
  grain under the lacquer, low sideboards pinstriped in cream (`#F4E8CF`), a cowl over the nose that the boots go
  under, a cream comet streaking back over the cowl from a round head at its tip, the vermillion runners on steel
  shoes curling up into the cowl, and two steel push bars at its tail.
- **The Whirl Saucer** is bentwood walnut with its vermillion rim (its blue sat by the speed charm's azure); **the
  Wisp** a pearl deck on silver runners, trimmed in vermillion along its deck and across its tail (never the ghosts'
  mint); **the Lodge Toboggan** carries vermillion rails down both sides and a cap across its tail, where the lens
  behind sees it.
- The rider's look is the player's to choose in the garage, inside the signal: the hat and the scarf are
  always vermillion with at most the beanie's cream or an ink accent, so whatever is worn, the rider is the
  one vermillion figure on the run. **Hats are told apart by their outline from behind** (the chase lens always
  sees the back of the head; round 9, nine on the shelf and one kept): the cuffed pom beanie; a short flat-topped watch cap perched high on
  the crown, a thick rolled cuff, the hair showing round it; a plain crown and two big cream poms hung low beside the jaw on cords; a trapper's cream fur band
  and long flaps; a hem of ink bobbles hanging across the nape (kept, no longer sold); a chullo with a middling point and long
  cream-and-red braids behind the ears; a long stocking cap streaming back past one shoulder, a pom at its end; a
  broad knit band over the crown and two big fur muffs; a big quilted dome in fat rings with a cream ring under it;
  two long knit tails streaming back off the crown, poms at their ends. None is one of The Twelve's (no crown,
  antlers, horns, fox ears, stovepipe or topknot). A piece a critic could not tell from another at race distance is
  kept for those who hold it and no longer sold.
- **A scarf** (round 9): the knot and the wrap stay the classic vermillion; a scarf varies its form (two tails; one
  long and one short; four slim ribbons; one thick rope), what weights the ends (a big cream pom, a little paper
  lamp, a snowball, a drop, a point, flame tongues, a tassel, a long ink fringe, a bow at the throat) and a pattern
  in cream or ink that runs along and across the knit (bars, bands, a rib, chevrons, a braid, dots, crescents);
  and the mountains' own ends: a red bell with a cream lip (the Old Run), cream swallowtails on four slim ribbons
  (Gullhaven), a wide scalloped cream valance at each tip (Gablefall). A scarf a critic could not tell from another at
  race distance is kept for those who hold it and no longer sold (the Chunky Rib, the Fringe Knit, the months' scarves).
  **Spirit Flow keeps the knit:** each stitch burns at its own value (an ink band stays dark in the flame, a cream
  bar burns white-gold), and only the far half of the tail glows past the bloom, so the flame's light never spreads
  over the coat.
- **A trail** (round 9) is shapes and behaviours in the air behind and beside the sled, never a mark on the snow
  (section 4's one painted line stands): cut-paper flakes that flutter, petals that sail out flat, gold leaf that
  spirals up, two ribbons of light that climb off the runners and bend back, strings of paper bows flying from the
  stern, embers rising in a column, moths of light circling, a paper lantern on a line; cream paper arcs ringing out
  from each side of the sled and widening, a bell's peal (the Old Run); cream gulls hanging in the wind beside the
  rider, wings beating (Gullhaven); paper pinwheels in cream and gold spinning as they pop out and drift (Gablefall); in
  the lantern's warm family
  only (paper, cream, honey, gold, amber), never mint, rose, coral or vermillion (the drift's heat owns coral and
  vermillion). No trail is a ring of light (that is a sky gate) or a disc of gold (a gift), and none lays a
  translucent vermillion over the snow (over white it is the grudge's rose).
- In the flow the rider's rim and scarf glow vermillion, building with the shown flow and full at
  3.5; a snuff puts the glow out with a short puff, so the state is visible without reading the HUD. The rim is laid
  over the cloth, never added to it (added to the navy coat or a blue or pale sled it read magenta); the flame Spirit
  Flow sheds off the scarf's tip is born half way to the flame's orange and its glow is that orange, so over white
  snow and spray it stays warm.
- After a crash the rider sits up dazed beside its upside-down sled, both in the results shot, with
  its head turned three-quarters to the lens and three gold-white stars circling the beanie.

- The limbs are tapered capsules with domed ends, the coat one lathed form that flares at the hem and
  nips in at the waist, with rounded mitts and soft boots. The back of the head carries the detail,
  because the chase camera only ever sees it: a ribbed cuff, a seam up the crown, a cream knit stripe,
  a fluffy pom-pom and a scalloped chestnut bob. The pom-pom springs on landings and the hem flutters
  with speed (in the vertex shader). After a crash the upside-down sled rests just past the boots.
- **Round 7: the hero.** The rider and every ghost are drawn 1.2 times their modelled size (the sim's sled
  is unchanged), about a fifth of the frame's height at 30 m/s. Inside the toy: shoulders broader than the
  chest, a hood on the back with a cream fur horseshoe (the one big shape the chase lens sees), a belt, a
  zip with toggles, pocket flaps, knee and elbow patches, fur cuffs, treaded boots, a nose and a mouth.
  **The mitts are vermillion**, so a fist, a wave or a flail reads by its mitt; vermillion is still only
  ever you. The sled has five grained slats, runners that scroll up and back to a foot bar, and a bow of
  bent wood behind the seat. The hood, a hat's tail and the boots' toes lag on a soft spring; a carve opens
  the shoulders, slides the hips inside and turns the head; the body extends leaving the snow and
  compresses by the impact on touchdown. The rider reacts: a glance and a lean passing, a fist for a pass
  worth one, both arms for a set piece swept, a look over the shoulder when passed, a flinch from a near
  miss, a slump for a set piece lost. A fall is played whole: thrown and rolling while the sled skids on,
  on its back in the snow, a sit-up with a shake of the head, a hop back onto the seat. Three finishes: a
  win stands, pumps both fists, spins and lands arms wide; a podium punches one fist twice, then waves
  with a hand on its hip; any other keeps its seat and stretches both arms overhead.

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
  rider or as it nears the lens. *Round 7:* a ghost nearer the lens than the rider never fills the frame: past
  1.2 times the rider's size and a fifth of the frame it dissolves, whatever beat holds it, and is gone by a
  third of the frame. A ghost level with the rider is the rider's size and never fades for size, so the race
  beside you never blinks out.
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
snag; Frostfang: spires, snapped spires, seracs, crystal mounds), with a small colour shift per tree and
the odd lean. Two mountains lay theirs out as places rather than scattering them. Ember Peak is basalt
country: each bank is a rhythm of formations (an organ-pipe outcrop of graded hexagonal columns on the
crest by the run and a bigger one on the shoulder, column clusters at their feet), stands of charred pines
in clumps with their dead at the edge, and clear snow between, with a steaming fissure in it now and then;
a sentinel column stands either side of every leap's approach. Sakura Ridge is orchards: rows of blossom
along the bank's contours, 5 m apart in a row and 5.5 m between rows, in blocks with paths across, a block
all pink or all pale, and between them a stand of dark pines or an open meadow; every leap lands between
orchards. On Pinecrest a line of timber telegraph poles runs from the first leap's landing down the valley
side to the first frozen lake, its wires leading the eye to it. Medium and High also dress the banks, always at least 9.2 m past the corridor
edge (bushes, stumps, fences, slalom poles, cabins, lift towers and cables, per-biome pieces), and
each course section reads before it plays: chute rock bands and blue-violet slalom flags, a bowl's
cornice lip, bench fence rails, gully walls of icicled rock, a split's two-armed signpost, crags along
a ravine's crest, boulders and bushes round a lake's shore. Trees and dressing never stand on a wall,
a ledge's face or the ice. A tree run's wall closes in to its own limit with a taller rank crowded
behind it, and the light on its floor comes through the boughs in soft pools.

The course's own marks are on every tier, Low included, in one draw:

- **Leaps.** Outcrops of the mountain's rock in beds (on Ember, a palisade of broken basalt columns), a
  broken crown behind the crowd and the crowd on two or three stepped ledges, stand either side of the lip, off the line, and two lines of
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
| Frostfang | 600 to 1450: the sun sinks onto the band, stars come out; 1700 to 2250: polar night, the aurora at full over the Crevasse Fields | 2700 to 3180: the deep of the night into the Ice Cavern, the aurora past its crest; 3300 to 3580: the sun comes up beside the Fang as you come out of the cavern, rose gold on the snow and the peaks, the aurora and the stars fading |
| Ember Peak | 500 to 1800: the deck closes, the disc dims, the air draws in, embers thicken | 2300 to 3400: a glowing dusk, lava lighting the smoke and running down the cone. No lightning |
| Sakura Ridge | 400 to 1600: the mist lifts off the cone and the sun climbs out of it | 2400 to 3400: a clear spring day with the wind in the blossom |

The baked props never change during a run. A late stop dims hazards through `hazardDim`, and the sky
stays clear of the ghosts' mint on every mountain at every stop (`tests/palette.test.ts`).

A mountain may have a second hour, opened by an Almanac page and picked on the title (`ALT_HOURS`, round 8): Pinecrest
at Dusk runs from the day's gold through the dusk by 1900 m to the first night by 3300 m, a deep blue over a rose
band with stars and the town's lamps the light at the line; Sakura in the Evening is a low warm sun through the
orchards, the blue hour over the Blossom Leap and Temple Town's paper lanterns under a night sky. Frostfang at Noon
is the glacier's glare: a low polar sun in a ring of sun dogs, diamond dust in the air, a deep cobalt sky over a
white-hot horizon the Fang stands dark against, white snow with long hard blue shadows; a silver afternoon over the
fields and the glare ahead over the Fang out of the cavern. Ember Peak at Night is the deck lit from below: no coin,
a dark ceiling red low toward the fire, the cone running with lava, cold lilac snow with a plum-teal shade, and the
lava, the lamps and the forges the orange. Lanternfall at First Light is the end of the night: the sun under the far
range and the lanterns burning low at the Crown, a rose-violet underside to the deck, the sun's rim rose over
Firstlight's street and a violet-blue morning at the line; the snow lilac and silver all the way. An hour is a
palette, not a mode, so every tier draws it, Low through its poster. The title offers the day or the hour by its name
under Ride, beside the mirror, each with a swatch of its sky; a ghost rides the player's hour with them.

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
- **Round 7: three directed shots a mountain**, keyed to a place (`src/game/shots.ts`), and none of them
  takes the steering. Over its tallest leap the lens holds wider than the big-air vista under a letterbox,
  and at two fifths of the flight pushes in for a slow hero frame: a longer lens, the rider sharp and the
  valley soft, render time at a third for half a second while the sim flies on at full speed. Down its
  first street the lens drops low and steps toward the middle of the street on a longer lens. Coming up on
  its reveal (Pinecrest's First Drop, Frostfang's cavern mouth at dawn, Ember's caldera, Sakura's Blossom
  Leap, Lanternfall's break out of the cloud) the look drifts a little off the road and whips back onto
  it as the place opens.
- A legend gets a look: while one is in reach the chase turns toward it by up to 8 degrees and, for one in
  the sky, lets the rider sink so the sky lifts into frame (never below 70% of the frame's height). It never
  takes the steering, gives way in the air and in a tumble, and never moves under reduced motion.
- The camera writes what the lens is doing for the pipeline (`src/render/cine.ts`): depth of field and its
  focus, motion blur from the speed curve, the letterbox and the slow frame's scale.
- Reduced motion keeps the letterbox, the depth of field and the director's beats and drops the swing, the
  push and the slow.
- The highlight reel has four lenses of its own (`reelcam.ts`): a side tracking shot on a long lens, a low
  front three-quarter, a high wide, and an orbit round a flight that is nearest at its apex, where the
  reel's own clock eases to 0.28. Under reduced motion every reel shot is a tripod that pans.

- While the avalanche chases, it is in the world: its cloud's flank rolls down both banks ahead of
  the front in rooted billows, dark slabs roll past along the corridor edges (never between the lens
  and the rider), and powder gusts and grit overtake the lens from behind. Fine flurries streak past
  the lens at speed and spindrift blows off the bank crests (Medium and High; reduced motion turns
  the flurries off).
- **Speed in the world (round 8).** The near flakes are crystals in the air, not scratches on the lens: a short smear
  whose light spreads along it, soft and out of focus within a few metres. Speed's blur keeps to the frame's outer
  band, where what rushes past streaks along its own path; the middle, the far planes and the rider stay sharp, and only
  a whip-pan blurs the whole frame. Posts, poles, flags and roped fences strobe past 4.5 to 12 m apart at the corridor's
  edge, with a rank of tall poles behind them for depth. The lens breathes: it opens with a surge, punches out with a
  dash and holds while it runs, and draws in a little as the run slows. On hard snow the runners chatter, through the
  sled and the lens, hardest on ice and gone in powder.
- **Spirit Flow.** The flow level (0 to 6) changes the picture's state as it climbs: the colour richer from level 1,
  the scarf alight from 2 (the cloth itself burning from the rider's vermillion at the knot to marigold at the tip,
  soft tongues streaming along it in a flame's orange that stops short of the fuel's marigold, no outline, thinner
  while a flip hides the scarf; never mint, never over the body), wind lines in
  the air from 3, sparks off the flame and the ghosts at their brightest at 5 and 6. A level gained is a breath in (the
  lens draws in and opens out, the colour lifts, the flame flares, a ring of sparks); a level lost a gutter out (the
  lens sags, the colour drains, the flame flickers and drops embers). Under the run a bed of air rises a step a level.
  Reduced motion keeps the colour and the flame and drops the breath, the wind lines, the sparks and the chatter. Low
  draws the flame alone.

## 9. Post-processing

| Effect | High | Medium | Low |
| --- | --- | --- | --- |
| Bloom (sun, gifts, ghosts, boost) | half res, 5 mips | quarter res, 4 mips | off |
| Colour grade (lift/gamma/gain per mood) | on | on | baked into fog colours |
| Vignette + grain | on | vignette only | off |
| Speed streaks (radial) | on | on | off |
| Anti-aliasing | 2x MSAA | FXAA | FXAA |
| Pixel ratio | up to 2 | up to 1.5 | 0.8 to 1 |

Round 7 adds an Ultra tier and a second table (the first stands for what it lists, but for anti-aliasing):

| Effect | Ultra | High | Medium | Low |
| --- | --- | --- | --- | --- |
| Anti-aliasing (round 8) | rebuilt from the frames before (the scene at 2x MSAA), the rider drawn again at 4x | the same, the rider at 2x | the edge walk | the canvas's own MSAA |
| Ambient occlusion | 3 slices by 3 steps, with contact shadows | 1 slice by 2 steps | off | off |
| Shafts cut by depth | 12 taps at half the frame | 8 taps at half | 6 taps at a quarter | off |
| Shadow map | 4096 over 44 m | 2048 over 34 m | 1024 over 26 m | none |
| Ice's mirror | the frame itself, marched | baked sky and peaks, the rider in it | the same | a painted sky and ridges |
| Depth of field and motion blur (camera beats only) | 22 taps with bokeh, 9 taps | 8 taps, 5 taps | off | off |
| Letterbox (camera beats only) | on | on | on | off |
| Corner fringe at speed | on | on, fainter | off | off |
| Local lights on snow | nearest eight | nearest eight | nearest eight | nearest four, as painted pools |

The film curve replaces the old soft knee on every tier with a post stack (section 15); Low has it baked into
its colours.

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

Round 7:

- **The title is the picked mountain's key art.** Each mountain has one composed shot (`game/keyart.ts`):
  where its reel rides, the colour script's time and where the lens sits. The logo and the controls keep the
  left of a wide screen and the top and bottom of a tall one; the hero is held right of centre (54 to 60%
  of the width) and the mountain's landmark stands in the sky over its shoulder. Moving between mountains is a
  veil in the new place's own air (which says its feeling), never a swap. The reel loops by a cut, never a
  glide: when it starts again, and when it first takes its shot, the lens is put on the hero on that frame, under the
  title's dip. (Round 9: no name or feeling line under the
  logo; the picked chip names the place.)
- **The Twelve wear their own colours.** A signature rider's bust is a glass-pale head and shoulders under
  the hat that names them, trimmed in the rider's accent; that accent is also the hairline of their card
  and the colour of their name. It is theirs alone: it is never used for an action.
- **The title has one job at a time (round 9).** The logo; the mountains as a picker of chips, each its sky and its
  short name ("Frostfang", "Ember"), the picked one larger with your best on it in words (in two rows of four, past six
  mountains, the picked chip twice as wide as the others in its row, both rows ending on one edge; on a phone narrower
  than 390 px, where a fifth of the width would cut a name, four equal chips a row and the pick its ring) ("Best 1:52.2"; on a phone the
  best stands under Ride, the chips being small, and the strip scrolls so every name is whole); Ride with its reason on
  it; under Ride, once open, the picked mountain's hour (each half with a swatch of its sky and the light it rides by: the sun, a low sun, the moon, a glow under the range,
  lamps) and its mirror once open, a switch with its word apart from the hour's pair (a mirror not yet open says nothing
  on the title, the five's and the new mountains' alike; a new mountain's, opened by beating its three home riders to
  the line, is said on its board under them); one quiet
  line of what you are working toward (a glyph and at most nine words: the next mountain by ghosts, Lanternfall by The Twelve ("Lanternfall: beat 9 more of
  The Twelve"), else the next Rider Rank named as a prize: how far and the prize, "1,281 XP to the
  Crane's Memory charm"; a locked chip pressed says the same sentence for its mountain, "3 more ghosts open The Old
  Run"); and four labelled doors: Daily and Cup (wearing the flame, "13-day
  flame", marigold), Progress, Garage (wearing the gifts as the results and the garage draw them, the glyph and "90
  gifts" in marigold) and Settings, on a phone the same pills two by two. No mountain name or feeling line
  under the logo: the picked chip names the place and the veil says its feeling while travelling. A first visit keeps
  the logo, its tagline, Ride, the line "Pass ghosts to unlock new mountains" and a labelled Sound On (where the doors will stand, at the column's foot).
- **Ride's reason is the next run's purpose**, first that applies: a friend's challenge (Accept); the duel with the next
  of The Twelve on the picked ground, said as the duel ("Suki Ember, head to head"), never with the rider's time, which
  set beside a faster best read as already beaten, and only when the next run is the duel; the Daily, the Cup or the
  Trial when chosen; your grudge waiting there; the rung above you on the mountain's ladder ("valo_rides is 0.1 s
  ahead"); else how it rides (its hour, mirrored) or what it is like (its tagline), never the name the chip already says. It wraps in its pill rather
  than run past it.
- **A door opens a room** from the logo's side (the bottom on a phone): an ink sheet of blocks, each its words and its
  one action. Daily and Cup holds the flame and its seven days, today's Daily, the day's contracts and the form, this
  week's Cup with its league place and table, and the week's Trial once open; Progress holds Rider Rank and the next
  page's prizes (the Almanac), The Twelve (their busts; all twelve a press away), the Long Night once open, the Spirit
  Album, the medals (each mountain's ladder place and mastery stars) and the missions. Choose picks that run and closes
  the room; Ride then says what it rides. Something new is introduced once, by a marigold "New" on its door and one line
  at the top of its room. Nothing loading is shown: a block whose field is not in offers nothing until it is.
- **The results are three beats over the scene (round 9)**, about 2.5 s: how you did (the place, its word and the time
  in italic 900 at the top of the logo's side, the time a step larger than the word's capitals, gold-white for a win, the silver step for a podium, off-white for a
  finish, off-white and a little crooked for a wreck; then one fact on an
  ink chip that keeps inside the headline's rule, clear of the rider, beside the figure on a phone as on a desk); the one reward that matters most, turned over,
  with Rider Rank's bar filling at its foot (bare: the next prize is named on the title's quiet line and in Details) and every gift the run paid as one figure in words ("+124 gifts": a prize
  of gifts is never a card of its own); and the one button, vermillion, always the run, its reason under its words
  and served by that run, then Home, Photo and Details, each with its word. A Daily's or a Cup's medal leads with the
  time it was won on and the medal in words, the race's place its fact, so the two never read as disagreeing; a Trial
  leads with its figure ("0 perfects / This week's Trial"), a Long Night with its depth ("2 legs / Your deepest
  night"). A tap or a key lands it; reduced motion shows the end. Everything else is Details, one level down, a sheet from the
  column's side, its one button in its own foot under the list: the race, your run, what it paid point by point (the XP it lists adds up to the total it says), the
  missions, and keeping the run (Watch Your Run, Save Clip, Challenge a Friend).
- **One system (round 9, `tokens.css`, `kit9.css`):** eight type sizes on one unit, three weights, two radii (full pills
  and 18 px cards), three button ranks with words on every one told apart at a glance (primary a vermillion fill, one a screen and always the run;
  secondary an ink pill ringed in off-white; quiet a thin ink wash with only a faint hairline; Photo secondary wherever
  it stands, Home quiet), one ink sheet for a room or Details, four durations and
  two easings, all zero under reduced motion. A gift figure is marigold with its glyph and word wherever it stands (the
  results, the garage, the Garage door, Details). The curly apostrophe is drawn from a face that keeps it a comma at 800
  and 900 (an installed Arial, by `local()` and a `unicode-range`; Windows' system font draws it there as a wedge that
  reads as an acute accent), never a straight quote.
- **The garage is a place, not a sheet (round 9).** A sled-maker's workshop at dusk drawn by the game's own renderer:
  your rider on your sled on a stand, hats on wooden head blocks, a scarf rail, a door onto a snowy yard, the Lantern
  Row in the rafters. The UI is one kit9 sheet from the logo's side, as every room's (the left of a desk, the place keeping
  the rider right of it; from the bottom on a phone, under the rider): "Garage" in italic 900 with a quiet Close as
  every room has, the gifts in marigold with their word, the shelves as pills (the picked one pressed as settings'
  quality is), the shelf's pieces as tiles (on a phone a row of two whole tiles and the rim of a third under a fade, never a
  name cut in two), then the piece picked with its one action. Every piece goes on your own rider before it is bought, and the camera goes to it
  (a hat from behind, then its front; a trail out on the yard's loop). The vermillion is spent only on a purchase or a
  tier being fitted; buying one is a moment (a marigold gift opened on the rug, the piece put on, a cheer), skipped by a
  tap or a key, still under reduced motion.
- **The other screens are sheets like the rooms (round 9, U4).** Settings, the pause card, the books, the views pushed
  in a room and a mountain's board are each an ink sheet from the logo's side (the bottom on a phone): the heading in
  italic 900 Title Case, a quiet Close with its word (Back when it was opened over another sheet, which goes out of
  sight under it, so no sheet shows another's words through its ink), blocks of words each with its one action. A
  sheet over the title takes the title's own column out of sight, so the sheet and the scene are all there is. Every
  figure has its word ("90%", "0 of 4", "1,281 XP to go", "Bronze 13, Silver 16, Gold 18 perfects").
- **The pause card** is the one of them with a primary: its word set like the wordmark, the run's missions as the
  Progress room says them, Resume (its key on it, P or Start), then Settings, Photo and Home, its ink whole so nothing of the run reads
  through it. The settings are a press
  away, not on the card.
- **The books** open one at a time over the Progress room. The Almanac is this month's chapter, then the fifty Rider
  Ranks a row each (its glyph, its prizes in words a line each, a marigold check once reached), the next lit with the
  XP it still needs, opening at it. The Spirit Album opens at its contents, a page a row, each wearing one of its
  stickers (a frame from its run, else its sky, its kind's glyph in the corner) with how many are found; a page holds the stickers found (a frame from the run, else
  painted in the mountain's sky, its kind's glyph in the corner) and those still to find (an outline with the glyph,
  and where to find it).
- **A mountain's mastery board** opens from the medal wall: every star's goal in its row (medals, sky gates, set pieces,
  home riders, a clean finish), held ones checked in marigold, and where its set opens in the garage.
- **A mountain's sky is drawn with its ridges** (`art.ts`), the same on every surface that shows the mountain.
- **A touch lesson sits beside the control it teaches,** never in the thumbs' band (the bottom 22% of a phone held
  upright).
- **A mirror mountain is the picture turned over, never a second look.** The canvas is shown flipped; every word in
  the world is built in mirror writing to meet it (the boards' letters, the medallions' glyphs) and every label is laid
  out as the player sees the screen, so nothing reads backwards and nothing else changes. The title is never mirrored:
  its key art is composed for the logo's side.
- **Photo mode is the picture and one bar (round 8).** From pause (Photo, beside Home) or the results (Photo, beside
  Home) the run holds exactly where it stood and the lens is the player's: it turns round the rider's chest from 1.3
  to 32 m, its pivot carried up to 12 m off the rider, and never stands in the snow, a rock or a tree. The HUD, the
  cards and the riders' tags leave the picture, and so does what belongs to the chase lens at speed (the streaks, the
  punch and flash, the corners closing, Spirit Flow's pulse); the grade, the light and the moment stay, and there is
  no filter. The bar is ink at the foot of the screen (the whole width on a phone, in three rows): Done, the lens as a
  focal length and the tilt, Grid, Focus (High and Ultra), First Frame, With Run Card and Save Photo (vermillion, the
  one primary), every control with its word. It and the help step back while the view moves.
- **A photo is the canvas at its size, as a PNG.** With Run Card adds the run's card in the lower left in the game's
  own type: "GHOST SLED" small, the mountain in italic 900, the time and the place (gold-white for a win), the rider's
  name in vermillion, on ink at 86% with an 18 px corner. Nothing is shared or sent. On a mirror mountain the photo is
  turned over with the picture.
- **A clip is the reel, short, as the player saw it (round 8).** Save Clip (in the results' Details, beside Watch Your
  Run) plays the run's reel cut to its three best shots and saves it: the picture with no HUD
  and no tags, turned over with a mirrored page, the letterbox, each shot's card (the small word in 800 caps, the line in
  italic 900 with the scene text's ink halo) for its first moments, a half-second card over ink at each cut, the game
  named on the first shot, and the run's card from the photo over the last frame, above the letterbox. Held upright, the
  type is sized from the width and kept out of the bottom tenth. While it records, an ink chip with an off-white dot that
  breathes says "Recording" beside Cancel.
- **A sticker held is a frame from its run** where one was kept: the moment as the player saw it (a set piece at its
  height, a legend in reach, a trick at its grab or the top of the flight, a charm's arch, the finish's swing), to the
  card's edge, the name on the same ink band. The painted card in its mountain's sky stays for a sticker with no frame.
- **The Long Night's beat between legs** is one ink panel low at the reading edge over the finish town: the leg and its
  mountain in the italic of speed words, the night deepening, then what rides in (the lantern in marigold, the get-up
  pips, the charms by name) and a bar draining to the next leg. It is never a menu: it goes on by itself.
- **A Trial is the week's second race (round 8; round 9 moves it into the Daily and Cup room, beside the Cup, and
  its Choose picks it).** Picked, the
  title travels to its mountain in its sky and hour, the place line reads "Week 50 Trial" over the twist, and over Ride
  one ink card says where it rides, the rule under the star, the three targets as the medals they win in words, each
  with its disc, your best and the days left (round 9, U4); a target already won is struck through. A run names the rule once in the HUD's one-line card, and the stage line's words
  carry the next medal's target. A Trial's results lead with the run's own figure on the week's measure, lit by its
  medal as a place is (gold-white for gold, the silver step for silver and bronze), "Silver in the Trial" under it and
  the gap to the next medal with the medal's disc. No new colour: the medals' metals are the Daily's and the Cup's.
- **Motion has a direction.** A screen leaves the way it is built: the logo's column off the logo's side,
  the cards off theirs, the primary button forward. The HUD arrives from its corners once; a lantern cell
  that fills lifts once; a set piece's card settles into its chip. Transform and opacity only, nothing
  loops in a plain ride, and reduced motion keeps every beat and drops the movement.
- **Labels are drawn in the canvas.** Riders' name tags, emblems, crash markers, graveyard tags, speech
  chips and the edge chip are quads in one batched draw (`render/labels.ts`), the same pills to the pixel;
  on Low the score, the clock and the distance are drawn there too.
- **A legend's card is moonlight on ink:** the word, the name, a hairline that draws out from the middle,
  the line. It takes none of the roles' colours.
- **A pad's glyphs follow the HUD's keycaps:** a face button is a round cap with a 2 px rim and no keycap
  lip (so A the button never reads as A the key), Start is a pill, the stick is drawn bare like the mouse. A key
  on a button is a pill at least half again as wide as it is tall, with its lip (in ink on the vermillion), at the
  button's end: one letter ("P") is a key as "Space" is, never a round cap.
  The get-up pips are 9 px rings in the HUD's text colour, solid while held, ink inside the ring when spent.
- **Pause and loading** are set like the wordmark: italic 900, the ghosts' mint under it, a runner drawn
  beneath (the loading screen's runner is its bar).

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
  three-value gouache smoke lit warm on the sun side over the cabins, the hamlets and a town's roofs, prayer flags and lantern strings flutter, and
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
  And it breaks: a snowman bursts into lumps, a carrot and a scarf; a barrier scraped at speed splinters;
  shaved ice throws shards; icicles drop in a gully as you pass; a span's snow breaks off in blocks as it
  falls. Pieces are light and paint, never a hazard.
- **Weather falls in depth** (round 7): a few big flakes at the lens, the body of the fall, and a far layer
  down the run; gusts cross the slope and the air thickens and thins with them; every flake takes the
  frame's light. Ember's air is ash that falls and embers that rise. Trees bend in the same fronts of
  wind, tips most. Reduced motion stills the gusts and the wind and keeps the fall.
- **The finish.** Shells rise from the snow and bloom as dabs of gouache in the player's vermillion, the
  gifts' marigold, cream and the snow's periwinkle, never lit like a hazard and never mint. Confetti
  cannons fire in over the rider and ribbons drift down through the frame while the crowd roars.

- **Overlooks.** At least three times a descent, the first inside 1.5 km, on open ground only, one bank opens. The treeline steps back, a low timber rail (larch, pale
  boards, charred posts or lacquer by biome) runs along the forest limit, a bare snow shelf runs out to
  a rounded cornice with dark rock breaking through, and beyond it the mountain falls away. Down the
  fall line the view goes out over the valley haze and the sea of clouds to the hero peak. The lens
  leans toward the open side and takes a breath as it opens. Sometimes both sides open and the run
  rides a ridge.
- **Places of their own (round 8).** Each mountain's opening (from the start's stands to the first leap) and every
  stage start (the threshold under the charm gate) is composed, past the sim's limits only, after its feeling:
  Pinecrest's valley side rolls over a cornice into a long fall past leaning spruces, a rail on the crest; Frostfang
  rides a canyon of crevasse ice 30 m tall with an arch of blue ice across it, and a stage start there is one wall over
  an abyss; Ember rides a ridge, a low wall of basalt with organ pipes on one hand and the fall toward the lava on the
  other; Sakura's open side steps down in terraces and the far side steps up the hill in walls of dressed stone, with
  torii in plum lacquer and stone lanterns on the flats; Lanternfall rides a crest, both banks falling away to the
  cloud. Whatever stands there stands on what is drawn. For a run's first seconds the lens sits low and close beside
  the rider with the place past its shoulder; it turns toward the place, steps aside a metre or two and rises at most
  a metre, so the rider keeps its size; a phone takes half; reduced motion keeps the framing, eased slower. (The
  sim's own banks still set the run's section: a lower opening bank is a sim request for a later round.)
- **Towns.** A street puts walls at the lens. Fronts stand 2 to 4 m past the run's edge, cut into the bank
  with their floors at the snow: alpine chalets, a red-and-ochre research station, basalt hot-spring
  lodges, a lacquered temple town. Upper storeys lean out, balconies and awnings reach toward the
  run, a house now and then stands right on the barrier, and a second row of roofs climbs the crest
  behind. Painted barriers run where the sim turns a sled back, in boards that blur at speed, and a
  crowd packs the strip behind them, flags up, doing the wave. A hotel's balconies look down.
  Banners, bunting and lantern strings hang high across from tall masts, only as low as the highest
  air allows. Windows glow from dusk and warm light spills over the run's edge; at night the
  shop fronts bloom. Shop signs on the awnings light from dusk too, and the bunting, banners and lantern
  strings swing in the wind, harder when the snow blows. About half the chimneys smoke. A mountain with no street in its script has its town beside the run instead.
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
  avalanche gallery whose pillars throw bars of light across the snow, an ice cavern (a cobalt crown hung
  with great stalactites, shelves of ice fringed with icicles up its walls and crystals glowing at the foot of
  the ice, opening at its far end onto the dawn), a basalt tunnel with glowing cracks whose mouth is a hole in a
  great rock mass, a corridor of wine-lacquer torii whose posts stand on the lip of the cut, lit stone lanterns
  between them. The
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
- **Near trees (round 8).** Within about 26 m of the lens a tree is drawn again from a near build of the same tree:
  the same tiers, height, reach, snow and turn, so it is the tree you saw from far off, come close. Each tier is
  layered boughs (each a lobe that swells to its tip and droops, a notch between it and the next, a shorter layer of
  boughs under the notches), a lip of thickness at the bough ends over the dark underside, and a shelf of snow with
  depth out along each bough's top, its edge a wavy line folding down in a band of the snow's shade. A barked trunk,
  dead stubs under the lowest boughs, a tree well at the foot. Facets are about a third of a metre and flat. Sakura's
  blossom at the lens is its canopy a step rounder. A tree is swapped between its builds at 26 m, where they share
  their outline. Medium on a wide screen draws a leaner near build, a phone held upright the full one; Low keeps its
  own trees.
- **Nothing fills the frame's side as a shard.** A tree beside or behind the rider goes whole before it can (about 4 m
  from the lens, 6 m on Low), solid and then gone, never stippled or milky; a tree ahead of the rider is a threat and
  stays. What a sled passes is cut fine enough to hold at the lens: a spire, a standing stone, a tunnel's rock, a
  bridge's parapet and beam.
- **At the lens, solid then gone (round 8's review loop).** Whatever fades at the lens fades through the middle of its
  fade in a few centimetres of travel, never stippled or milky: props, a street's front row, a lantern hanging over the
  run (gone by about 8 m, before it is over the rider's head; a bell or a wheel by the snow 5 m), a race cabin the rider
  has passed. A ward's broken paper is flakes a little over half a panel, gone near the lens. Shafts hang in the air:
  none in the first 10 m from the lens, and the composite's own rays under the horizon a tenth of their strength. A
  glaze keeps a cool tint under a warm sky (where what it mirrors is warm, half of it is the deep upper sky). A flipped
  saucer or tray shows the snow's light on its hull and the trim's vermillion round its rim, fading as it turns
  edge-on, never an ink disc over the rider. The slow hero frame's depth of field is half a beat's, so the valley the
  flight is over reads. A dash's after-images are faint (at most 0.6 by day, 0.35 at night), never a second sled.
- **The Lantern Row (round 8).** Each finish town hangs the lanterns a player has lit there, marigold, on a wire across
  the square 58 m past the line, and the same row hangs over the stretch the mountain's title shot rides. Only lit
  lanterns hang, so a fresh save's frames do not change. Medium and High light the snow under it; Low hangs glowing
  paper.

## 13. The lantern, the set pieces and the riders (round 5)

- **Spirit lights** are small marigold flames: a lathed teardrop, round at the foot and drawn to a point, its
  core paler than its skin so it reads as light rather than paint, upright and bobbing. A spark is 0.8 m tall; a
  great light is 1.2 m, wears a thin ring of light at its waist and carries a second small flame beside it, so the
  two are told apart at 30 m/s. Past the detail range a light is a drawn-out diamond. Taking one throws a soft
  flare of marigold motes that rides with the sled: no confetti and never red (the rider owns vermillion).
  *Round 7:* a light is a flame of light that belongs to its frame, not a sticker. A smooth teardrop that licks at
  its tip, marigold where it faces the lens, amber (`#FF9E1A`) at its rim and a white-gold heart low in it, its side
  toward the frame's light a touch brighter; a soft glow round it tints the snow by day and adds light at night (on
  Low the glow is the light, and on Lanternfall's Low the marigold leans amber against the lilac snow). Never a slab:
  past a twentieth of the frame's height it grows at a third of its rate, so one by the rider is about a third of
  the rider and a nearer one is still a little bigger. It goes inside 6 m of the lens, at the frame's sides before
  the speed streak can smear it, and in the top fifth near the lens. A great light's ring and second flame are
  painted in its glow. Lights over a leap are joined by a dotted line of motes, so they read as a trail over the
  leap, not drops in the sky. Past the detail range a light is a small flame painted in its glow.
- **The lantern** on the HUD is three small lanterns where the gifts' counter stood: ink cells with a marigold
  rim that fill from the bottom with a cream-to-marigold gradient, glow when full, and burn white for a dash. On
  touch it is a 78 px round button above the right thumb's zone.
- **A dash** is the rider as a spirit for 1.4 s: a white-gold rim round the silhouette and gold bands
  rippling up through the coat, eased in and out, the scarf still vermillion; on Medium and High two faint
  white-gold after-images trail it, drawn only where the rider is not. The lens punches out and white-gold
  motes trail the sled. **A ward** stands a marigold paper lantern round the rider that cracks with white-gold
  light and breaks into shards and a ring of light over the snow, in a beat of slow motion (none under
  reduced motion). A dashing ghost trails pale mint-white light; a warded ghost breaks into marigold.
  *Round 7: the rider holds through every glow.* The ward's lantern, shards and ring draw only off the rider's own
  pixels, so the rider stands inside the lantern as a navy and vermillion figure; the dash's white-gold rim and the
  flow's vermillion rim keep to the silhouette's outer facets, and the dash's bands ride over the coat's own value;
  the lights that ride with the rider stand 3 m ahead of it at 0.65, so the snow takes the light and the rider stands
  against it; a local light on the rider rolls off past a lamp's strength. The coat is never cream and never a red
  blob. In a flip a sled's underside sits a step into shade with the snow's cool bounce and grain, slatted sleds
  with dark seams.
- **Sky gates** are rings of light: a deep amber edge, a marigold body and a white-gold core line, a halo
  that tints and glows, a faint veil inside and four beacon motes riding the ring, a shimmer running round it.
  Held to a few pixels thick at any distance, they read from 60 m on every tier, Low included. Every gate on
  the course, a set piece's smaller rings among them, is one draw. Flying through one bursts it into
  white-gold.
- **Set pieces** carry their own air for as long as they last: Ember's embers (`#FF9A4A`), Sakura's petals
  (`#FFC9DA`), a festival street's lantern glow (`#FFE29A`), and out of a tube a burst of warm light on the post
  pass. Their title card is the stage line's card set larger and wider, with the line to play in marigold and a
  marigold hairline; a clean sweep on the way out gets a marigold rim.
- **Fireworks** climb on a thin trail of embers and burst with a flash into spheres, rings and willows of
  streaks that stretch along their motion, droop and fade, the crackling kinds breaking into glitter: the
  rider's warm colours and the lantern's (vermillion, coral, marigold, white-gold), never mint or rose. They
  fire over the square at the finish (more for a win) and over the street when a gates set piece is won.
- **Signature riders** keep the spectral body (mint, rose for a grudge, gold-white for your best) and carry their
  identity in silhouette: twelve hats in the same glass (a felt hood, antlers, a topknot, a wide brim, a stovepipe,
  a giant bobble, a beak hood, a lantern on a headband, curled horns, an aviator cap, fox ears, a crown). Their own
  accent colour appears in three places only: the emblem disc before the name on the tag, a thin inner edge on the
  tag, and a ribbon in the wisp. Their word on the results has a rule in that accent.
- **A sled's finish** (round 9) is a ground and a motif where the lens sees a sled (a pinstripe round the deck, stars
  across the tail, a cream frame, burnt scrolls, a walnut rim round a snow-white deck, a fine hex lattice, ruled
  lines on an old vellum), painted over the sled and its fitted tiers together at their own value, so the grain and the hull's shading
  stay; the trim stays vermillion, and so do the scarf and beanie. No ground or line is the coat's ink navy or any
  locked role's colour (the dark is a warm umber), no motif is the finish line's ink-and-cream check, and no more
  than one ground is a dark slate. At race distance a finish is its ground's hue and value; no two grounds share both.
- **A sled's track** (round 9): five tiers built where the chase lens sees a sled, each sled its own (runner tails
  swept up into handles or a skid ring, a quilted pad, a blanket roll across the tail high enough to show over the push bar, a crest board in one wood, a curled tail, low
  fins at the tail's corners, swept wings or curled handles); the fourth a post at the stern's right corner, low
  beside the rider's back, carrying a lit paper lamp (ribbed, palest at the waist, a dark cap and foot, section 14)
  or another ornament; the fifth an inlay (the Pine Flyer's in the trim's red, down the runners' outsides, across
  the tail and on the crest's face) that burns with the scarf in the flow. A built-up sled is told from its stock one
  in a chase still. An ornament keeps its own colours under any finish. A track never changes how a sled rides.
- **A month's chapter** (round 9, G6) is its ornament and its title: one object plainly its month, big enough to read
  on the post (a rising sun, an icicled eave, a thaw-blue lantern, a blossom sprig, a brazier, a midsummer wheel, three
  market lanterns, a paper fan, a crescent moon, a hollowed lantern lit amber, a snowman in a knit cap, a star
  lantern), none of them one of The Twelve's hats (no crown, no stovepipe).
- **Round 7.** Powder's rim takes the key light's colour and is what blooms in a plume. A dash throws a ring as the
  air opens, lays a wake of light off the runners and trails a comet's tail; the lantern's moments (a dash, a ward,
  a gate, a light taken, a lantern filled) each light the snow and the rider for a beat. A burst has a heart inside
  it, lights the square, and a win ends on a finale.

## 14. The set pieces (round 6)

Each mountain's three set pieces are a verb as well as a place, and each verb has its own look, built so it reads at
30 to 46 m/s and never looks like a hazard.

- **The race's machine** rides a dark cable along the bank (11 m up in the open, 7 m in a tube or a slot) between two
  lit stations, on slim A-frame towers where the ground is open and wall brackets where it is not. Pinecrest's is a
  blue cable car banded in cream, Frostfang's the research station's red gondola, Ember's an iron ore skip glowing
  from inside with a lamp on its lip, a Daily's on Sakura a wine-lacquered car. Windows and the skip's ore are lit so
  the machine reads against snow and against the dark of a tunnel. It sways a little on its hanger, more as it
  leaves and arrives. Never vermillion: the machine is a rival, not you.
- **Lantern gates** are two strings of three paper lanterns hung from a wire across the run, with a garland of small
  lights sagging between their heads: the opening is between the strings, and nothing stands on the snow. The next
  gate burns brightest and breathes, with a soft pool of its light on the snow in its opening; later gates wait
  dimmer. A threaded gate's lanterns slip their strings and rise into the sky, drifting apart; a missed gate's light
  gutters to an ember. Marigold, the lantern's own colour: a gate is a light you take.
- **Ring lines** are the sky gates' family, three to a leap, a little smaller than a stage's gate.
- **The collapse** breaks the span's cornices and snow off at its edges at the fall line, chunks of pale ice tumbling
  into the gap with a puff of powder. The deck holds.
- **The chip.** A set piece's card becomes its chip as it starts: its name a size smaller over the verb counting in
  tabular figures. A win rims it in marigold with the line in marigold; a loss is said plainly in off-white.

### Round 7: twelve verbs, variants, legends and a climax

Where this part and the round 6 bullets above disagree, this part stands: the lantern gates' garland and round 6's
pillars of light are gone, and the Caldera's and the Blossom Leap's ring lines became the surge and the flourish.

**Fifteen set pieces, twelve verbs, none in the game more than twice.** A mountain's three are three different
things to do with the hands, and each has two or three variants picked by the run's own seed. What a verb needs to
be seen is the world's to build and the sim's to place: a bell hangs where the sim says a sled must be, a gate swings
where the sim has it this tick, a flame is as tall as the sim says it has left to burn. Nothing drawn for a set piece
may suggest a line the sim does not reward.

| Mountain | Stage 1 | Stage 2 | Stage 3 |
| --- | --- | --- | --- |
| Pinecrest | The First Drop: rings | Mirror Lake: slide | Old Town: steps (hops) |
| Frostfang | Serac Gate: collapse | The Crevasse Fields: race (chase) | The Ice Cavern: gates (sit) |
| Ember | Cinder Gate: race (sprint) | The Caldera Leap: surge | Ash Market: gates (swing) |
| Sakura | Petal Steps: steps (stair) | The Blossom Leap: flourish | Temple Town: shatter |
| Lanternfall | The Cloud Sea: follow | The Lamp Road: kindle | The First Flame: carry |

**The verbs' worlds.** Every verb is a thing that stands or hangs in its place, lit by its own light, and nothing of
it stands on the snow a sled rides. Lantern gates are two strings of three ribbed paper lanterns on a yoke: hung from
a wire where a gate sits, on a pendulum from a pivot 11 m up where it swings. Bells are bronze, lit, on ropes as long
as the height they ask. The Caldera's forge gate is two slim iron masts of five flames that climb with the sled's
speed and roar when it leaves fast enough. A falling span carries lamps that go out with it. A slide is scribed in the
ice behind the sled. Stomps light lantern arches (Petal Steps) and strings of lanterns over the street (Old Town).
Paper wheels at a lip say the trick: a flat one that spins is a spin, a standing one that turns is a flip. A ring
line is led to by chevrons and joined by a dotted arc of light. A race's machine keeps round 6's look and gains its
own lamp and a signal mast of three lamps at its station.

**State reads in the world.** The next target is the brightest thing in the set piece and breathes (steady under
reduced motion). A hit is answered with light (a flare, a ring, a local light on the snow) and debris; a miss gutters
to an ember colour and is otherwise quiet. A variant is seen before it is played: the arc hangs low or high and on
its own side, a row of stomps is tied by one garland, a far shelf has two forge gates, a keystone stands on a span
that falls from its far end.

**Light that covers.** A set piece's sprites and marks are premultiplied and cover part of what is behind them, so
they are paint on sunlit snow and light at night; marks on bright snow are deep marigold (`#FF9E1A`). A form lit
from inside is brightest facing the lens and deeper at its rim: never a flat block of its colour. A lantern has ribs:
four bands of paper, palest at the waist, under a dark cap and over a foot and a tassel. One the lens passes through
dissolves over its last 7 m. Low keeps a lantern's hue (capped by its brightest channel), a poster of the High one.

**Legends.** Two a mountain, on about one run in ten and never a session's first. A legend is spectacle first.
Where it changes play it only gives: lights to take or a lane that charges the lantern, the same for every rider
whose run rolled it, with no collider anywhere. A runner keeps 18 m ahead of the rider and is never caught. Never
mint: the aurora that comes down is violet and rose with an ice-white hem. Each has a beginning, a peak and an end:

| Legend | Beginning, peak, end |
| --- | --- |
| The White Stag (Pinecrest) | Comes in from its side far ahead; gallops 18 m ahead weaving across the glade so its flank shows, a star in its antlers, hoofprints of light; bounds off to its side |
| The Lantern Fleet (Pinecrest) | A launch wave from both shores; a sky of lanterns over the lake, never on the ice; drifts off on the wind |
| The Aurora Comes Down (Frostfang) | Curtains come down from far up the run; violet and rose curtains with a lit lane; lifts and fades |
| The Ghost Herd (Frostfang) | Comes up toward its side; sixteen translucent caribou on the edges and banks; peels off up the banks |
| The Cone Wakes (Ember) | The crater rumbles; a blast, a fountain, lava down the cone's face, bombs, the sky band lit, ember rain; fades |
| The Cinder Wyrm (Ember) | Rises out of the snow; 30 m of glowing plates swimming the ravine, a mane of sparks; dives under |
| The Lantern Dragon (Sakura) | Flies in high from its side; winds in a wide S so its twenty drums read as a body; climbs away |
| The Thousand Cranes (Sakura) | A first flock rises; rose and white streams beside the rider that wheel over the landing; climb away |
| The Great Rising (Lanternfall) | As the rider breaks out under the deck the whole valley's lanterns double, rise about twice as fast and a fifth larger |
| The Tall Lamplighter (Lanternfall) | A robed figure 9.5 m tall with a faceless cowl walks the lamp grove 40 m ahead, his pole out over the lane; the lane is his lantern's light on the snow |

**The climax.** From the last lip the way to the line takes light ahead of the sled, in a wave that reaches the line
first: strings of five lanterns over the run every 34 m, the last of them 40 m short of the line so the FINISH board
reads clear behind them (round 8). Beams stand over the line and shells break over it as the
sled arrives. Everything is keyed to the sled's place and speed, never the clock.

## 15. Round 7: the direction, mountain by mountain

**Direction: "Alpenglow Gouache, lit like a film."** The painted, flat-valued world of sections 1 to 14 stays: every
shape is still a brushed plane, every colour still has a role. What changes is that **light becomes the subject**.
Round 6's frames are well-drawn objects in an even light. Round 7's are pictures of light falling through air onto
those objects. Where this section and an earlier one disagree, this one wins.

Five rules every frame is held to:

1. **Three planes and a sky.** Near, middle and far are separated by value and by hue, not by fog alone: the near
   plane has the full palette and hard edges, the middle loses a third of its contrast and leans to the air's colour,
   the far range is two or three flat values of blue (or of the mountain's air) with the sun's scatter in it. A player
   can point at each plane in a thumbnail.
2. **One light motivates the frame.** The sun, the aurora, a street's lamps, the lava or the lanterns: something in
   the picture is where the light comes from, the snow and the rider show it, and the air between shows it (shafts,
   glow, a lit haze). No frame is lit by nothing in particular.
3. **Painted detail, never noise.** Rock carries strata as painted bands with snow lying on its ledges; snow carries
   sastrugi, sparkle and blue shadow near the lens; ice carries depth (cracks, bubbles, a darker heart). All of it is
   drawn in the gouache's own three values. Nothing in the frame is an untextured box, and nothing is photo noise.
4. **The hero is lit like a hero.** The rider always carries a rim from the frame's light and a soft key that keeps
   the face of the coat readable; the vermillion never sinks into a dark frame or bleaches in a bright one. The rider
   fills more of the frame than in round 6.
5. **Grade by place.** Each place on a run has its own grade (lift, gain, saturation, the air's colour, the bloom),
   blended over the metres between places, so a run is a sequence of pictures and not one picture for two minutes.
   The colour scripts below are the source; `JOURNEY` and the place grades implement them. Their metres are
   approximate: the code keys each row to the course's own sections. A place's row is keyed to the course's
   sections (kind, and which of that kind), never to metres, so a Daily's shuffled acts carry their places with
   them.

The filmic finish: a filmic tone curve (highlights roll off to the light's colour and never clip to white paper; the
shade keeps its hue), bloom that belongs to light sources and the sun's rim on powder, and a lens that stays out of
the way (a little vignette, no chromatic fringe in a calm frame, no dirt). A colour with a hue of its own keeps it
up the curve: only what is already near white takes the light's colour, so marigold, mint and vermillion never fold
into a dusk's orange. Depth of field, motion blur and the letterbox belong to the camera's beats and cost nothing
between them. At speed the corners carry a hair of fringe on High and Ultra; a calm frame has none.

As built: the air has two colours (the mood's fog near, the far plane's own colour with distance), glows toward the
sun's disc, cools away from it and lies thicker in the valleys. Lamps, windows' pools, lantern gates, lava, the ice's
cyan heart, stone lanterns, the lantern's moments and fireworks are local lights on the snow and the riders: a
street is pools of amber with blue between, never a gold floor, and a hazard takes them on its edge only, so it
stays the dark shape in the street.

### Pinecrest: the bright day that turns to gold

- **Feeling.** The first morning of a holiday. Generous, open, easy to love. It ends as the best evening of the trip.
- **Colour script.**

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 450 | The run-in | Crisp cobalt morning. White snow, clean blue shade, the air clear enough to count ridges. Cool, high-key grade. |
  | 450 to 700 | The First Drop | The valley opens: three blue haze layers below, cloud above with the sun breaking through it in shafts onto the far lake. The grade holds cool so the gold later is a change. |
  | 700 to 1700 | Timberline Glades | Dappled: pine shadows and shafts between trunks, cloud shadows sweeping the open slopes. Teal-green anchors the frame. |
  | 1700 to 2300 | Mirror Lake | High-key and wide. Black-cyan ice with the sky in it and the sun's path down it. The one place the grade goes almost monochrome blue. |
  | 2300 to 3250 | The gold comes | The sun drops under the cloud: honey light, long violet-blue shadows, the peaks glowing. Saturation rises. |
  | 3250 to 3700 | The covered bridge and Old Town | Lamplight against blue shade: windows and lantern gates light the snow amber, the sky peach over the roofs. The warmest grade on the mountain. |
  | 3700 to 4500 | The Valley Leap and the finish | A held wide over the valley: the finish town's spires in a pool of gold, everything else in long shadow. Dusk at the line, fireworks against a deepening blue. |

- **Hero vistas.** (1) The First Drop's lip: the whole valley, the lake, the cloud shafts. (2) Mirror Lake: the
  rider and the cable car doubled in black ice. (3) Old Town's street at golden hour, down the bunting to the far
  peak. (4) The Valley Leap's apex, the spired town below.
- **The one image.** A red-scarfed rider in the air over a gold valley, a spired town far below.
- **The review loop (round 8).** The gold keeps its high wisps and no cumulus banks: a bank lit from below stood
  over the road as one flat orange crown. Its shade is violet-blue, never lilac. Ice before the Valley Leap is ice, not
  a salmon slab (section 12's glaze rule). Old Town's lanterns and the covered bridge's pool amber on the snow; Low paints
  the pools as a soft step under white.

### Frostfang Glacier: blue hour, aurora, dawn

- **Feeling.** Awe and cold. Alone at the top of the world, then the sun finds you.
- **Colour script.**

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 600 | The run-in | Steel blue hour, a thin lemon band on the horizon, the Fang black against it. Snow in two blues with a lemon rim. |
  | 600 to 1450 | Serac Gate | The sun goes: the lemon band narrows to a line, stars come out, the span crosses an abyss that glows cyan from below. |
  | 1450 to 1700 | Station Street | Hot red hulls and amber windows against cobalt; the windows light the snow. The only warm place before the dawn. |
  | 1700 to 2700 | The Crevasse Fields | Polar night that is not one blue: the aurora is the key light, green-teal on the snow's lit side with violet in the shade, moving. The ice glows from inside (cyan heart, pale skin) and holds the aurora's reflection. |
  | 2700 to 3300 | The Ice Cavern | Near-black cobalt. The only light is what the cavern holds: lantern pools, crystals catching it, the rider's own glow. Value contrast at its highest. |
  | 3300 to 3600 | The burst into dawn | The cavern mouth is a blade of rose-gold with shafts through it. The grade swings from the coldest frame in the game to the warmest in under four seconds. |
  | 3600 to 4500 | Fang Town | Rose-gold snow, violet shadows half a slope long, the Fang lit on one side, the aurora a last thread over the far range. |

- **Hero vistas.** (1) Serac Gate's span, the Fang in the lemon band. (2) The aurora over the Crevasse Fields, and
  in them. (3) The cavern mouth at sunrise: the mountain's jaw-drop. (4) The Fang at dawn from the last leap.
- **The one image.** A rider's silhouette bursting from a blue cavern mouth into a rose-gold sunrise under the Fang.
- **As built.** The night has three hues on the ground: moon-pale steel where the snow is lit, violet in its shade,
  the aurora's green across both and on the crests of the ice. A slot in the ice is the dark of its frame. Cobalt
  belongs to the ice walls. The Ice Cavern has ribs of ice with crystals at their springings and a rose and gold
  dawn blade on the floor at its mouth.
- **The review loop (round 8).** A crevasse wall is cut ice: a few planes a step apart in the wall's three values, a
  pale fracture down some of the splits, and none of the stretched faceting of the ground it stands on. The aurora lies on
  the snow in curtains with the violet shade between them, never one teal floor. In the Ice Cavern each gate is a pool of
  its light with the cobalt dark between, and the lanterns over the run leave the frame before the lens passes under
  them; the cavern's dark lets go within two seconds of the mouth, so the bridge out of it is the dawn. The dawn's key
  stands at 25 degrees, gold enough that the slope facing down the run takes rose-gold. At night the sled's lantern is
  low, so a landing's powder is snow and not a sheet of milk.

### Ember Peak: under the mountain's breath

- **Feeling.** Forge-light and danger. A thrilling place that should not be ridden, ridden.
- **Colour script.** Ember's snow is no longer brown-grey mud. Its lit side takes the orange of what lights it (the
  deck, the lava) and its shade goes to a cold plum-teal, the complement, so ash snow reads as snow in firelight.
  Basalt is true black with a hot edge where lava or sky finds it.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 500 | The run-in | The cone dead ahead under the smoke deck, the disc a dim coin. Snow in orange and plum, embers thin. |
  | 500 to 1250 | The basalt slopes | The deck closes. Lava threads in the rock light the snow beside them in pools. |
  | 1250 to 1700 | Cinder Gate | Black, lit from below: lava in the joints throws light up the walls and under the rider, the ore train glows from inside, and the far mouth is a hot orange disc. |
  | 1700 to 2250 | The shield | Out under a deck lit from below, breathing. Heat shimmer over the vents. |
  | 2250 to 2700 | The Caldera Leap | The caldera is a lake of lava: the whole frame is lit from underneath, the smoke above it glows, embers rise through the flight in depth. The mountain's jaw-drop. |
  | 2700 to 3450 | Basalt Halls | Columns like organ pipes, lava rivers running beside the line and lighting the snow orange, the air thick with ash. Never a grey fog with nothing in it. |
  | 3450 to 4500 | Ash Market and the forge town | Dusk to night under a red deck: lanterns, forge mouths and window light on the snow, sparks in the street, the cone running with lava behind the roofs. |

- **Hero vistas.** (1) The cone from the start line. (2) Cinder Gate's glowing throat. (3) The Caldera Leap over the
  lava lake. (4) Ash Market's bridge, the cone behind it.
- **The one image.** A rider leaping a glowing caldera under a ceiling of smoke lit from below.
- **As built.** The snow's own colour stays a warm white from the start line to the forge town; the light carries
  the orange, once. From the Basalt Halls on the light is ember, and the ash is an ember red that stands off the
  lens and never cools to grey. Caldera Leap: lava lies on the banks, its crust near-black, only the heart glows.
  (Round 8's review loop built the lake under the flight, below; the smoke ceiling is lit from below in the Caldera's
  place.)
- **As built in round 8.** The light that shades the snow comes from the lava's side, low and further round than the
  dim disc (64 to 70 degrees right, 30 to 40 up), so the snow facing it is firelit warm white and the far bank turns
  to a cold plum-teal a step down, never a dark slab (a near-black bank lost every blind pair); the deck's shadows
  take at most half the light. Lamps, forges and windows hang a thin haze of their own light in the air round them
  (Medium and High; strong, it reads as milk).
- **The review loop (round 8).** The Caldera's valley is a lake of lava: from the lip, the landing and the air the sea
  under the smoke is crust in rafts with melt along the cracks between them in the fire's colour, wider in the hot pools.
  The crust floor lies under the gap and the foot of the landing; the landing face is groomed snow, the lava in its
  fields either side. Ice under the fire holds the cold of the deep sky: a cold dark lane, never the red horizon. From
  the halls on, the key is a step paler on a brighter snow, so the light's orange is a tint and the lava's pools are the
  orange; Low leans its lit snow toward the cold shade, so it never reads as sand. The opening's high side is a rank of
  organ pipes along the wall's crest. A charred snag holds snow at its foot, never on its splintered tip. A tunnel's
  colour holds only a sled under its roof: thrown up by Cinder Gate's vent, the slope below is the open air's.

### Sakura Ridge: the spring morning

- **Feeling.** Calm joy. The mountain you ride to feel good.
- **Colour script.** Sakura keeps its softness and gains a spine: ink and wine-lacquer darks (trunks, torii, roofs)
  and deep cedar green hold the values, and the blossom is the light, backlit and glowing, never a pale blob on white.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 400 | The run-in | Peach mist. The cone a pale ghost in it. Low contrast on purpose, the darks few and exact. |
  | 400 to 1100 | Petal Steps | The mist lifts in layers. The terraces hold still water in their flats, mirrors of the sky, and the sun finds them one by one. |
  | 1100 to 2200 | The orchards | Sun through blossom: canopies glow from behind, shafts fall between the rows, petals fall through them in depth. |
  | 2200 to 2700 | The Blossom Leap | A clear, high frame: the cone sharp at last, orchard rows combed across the valley floor, a river of petals on the wind. |
  | 2700 to 3300 | The Thousand Torii | Dark lacquer and strobing light: the sun cut into bars by the posts, flickering over the rider at speed. |
  | 3300 to 4500 | Temple Town | Late morning, the clearest light on the mountain. Paper lanterns warm under the eaves, the pagoda over the square, a petal storm at the line. |

- **Hero vistas.** (1) The cone through the lifting mist. (2) The flooded terraces. (3) The Blossom Leap over the
  orchard rows. (4) The torii's bars of light. (5) The pagoda over the square.
- **The one image.** A rider under a tunnel of backlit blossom, the perfect cone beyond it.
- **As built.** The morning is rose, not yellow. Shafts are thin over open snow and full only under blossom. From
  the Blossom Leap the sky sits a full step under the snow and the far plane is blue. Petal Steps: the flooded
  paddies are a view from the air; from the run they read as rims. The Thousand Torii lays bars of sun across the
  snow in every gap.
- **The review loop (round 8).** Temple Town's houses are two storeys (three now and then) of paper screens behind
  close dark slats, an ink pent roof at each storey line and snow on the ridge's quarter of the roof; the inn three or
  four. The cut walls, the chute's crags and the leaps' shoulders are one stone leaning to the lacquer's wine, in beds
  with snow on the ledges, never navy. Cast shadows lie soft and a middle value. The calm lens keeps a third of the
  speed streaks and half the speed blur at the frame's sides; fewer, smaller petals ride the air. Petal Steps' lanterns
  wait in marigold. The bridge is one deep lacquer on framed towers under swept roofs; the masts and the finish arch a
  deeper lacquer than the torii, never near the rider's vermillion.

### Lanternfall: where the lights come from (new in round 7)

- **Feeling.** Wonder and hush, then homecoming. The spirit lights a player has collected on four mountains rise
  from here. It is the game's secret and its finale.
- **Palette.** Indigo and violet air, lilac snow with a silver lit side, ink silhouettes, and marigold: here, and only
  here, the course's fuel colour is the world's own light. Ghosts keep their mint and the sky stays clear of it. The
  rider's vermillion is the one red.
- **Colour script.**

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 700 | The Crown, above the cloud | The end of night above a sea of cloud: indigo zenith, stars, a great pale moon, silver snow. The cloud below glows warm in patches from what is under it. |
  | 700 to 1500 | The Cloud Sea | Into the cloud: white-violet, visibility closing to forty metres, lantern halos looming and passing. A guide light leads the line. |
  | about 1500 | The break | Out under the deck: a whole valley of lanterns, thousands, rising. The mountain's jaw-drop, and the game's. |
  | 1500 to 3000 | The Lamp Road | Lilac snow in pools of marigold. Standing stone lamps in avenues, lamp towers, a river carrying floating lights. |
  | 3000 to 4500 | Firstlight | The lamplighters' town: paper windows, strings of lights over the street, a great unlit lantern over the square, lit at the finish. The sky goes from indigo to the first rose of morning as lanterns leave the valley. |

- **Hero vistas.** (1) The Crown over the cloud sea. (2) The break under the deck. (3) The Lamp Road with the river of
  lights. (4) The great lantern lit over the square, the sky full.
- **The one image.** A rider coming out of cloud above a valley of ten thousand rising lanterns.
- **Architecture and people.** Lamp towers: narrow stone bases with tall paper-and-timber lantern storeys that glow
  from inside; standing stone lamps in rows; arched bridges strung with lights; bell frames. The lamplighters are
  robed figures with long lighting poles, a small flame at the tip. All original shapes: nothing copied from, or
  closely evoking, any existing game, film or festival.

**Lanternfall as built.** Three stages on the same lines as every mountain (1450, 2950, 4500 m).

| Metres | Place | What is there |
| --- | --- | --- |
| 0 to 605 | The Crown | Indigo zenith (`#0B0A3E`), stars at full, a moon 1.75 times the stock disc, snow silver where lit and violet in shade. The cloud lies below as three sheets of billows with warm pools. A 20 m dive off the first lip. |
| about 660 to 1490 | The Cloud Sea | White-violet fog from 2 to 44 m, banks of thicker cloud drifting across the run, hazards kept dark in the murk, ghosts and gifts blazing, way lamps every 13 m looming as halos. No kickers. Set piece: **follow** the guide light in its wake. |
| 1568 | The break | The cloud lets go 80 m short of the second lip, in under two seconds; a 23 m leap under a dark deck with a rose underside, the air at its widest, and the valley of rising lanterns (6,000 on High and Ultra, 3,600 on Medium, 1,500 on Low). |
| 1568 to 2950 | The Lamp Road | A fork, an avenue between two rows of stone lamps, an arched bridge of lights, the lamp grove, a canal carrying lights on the open banks. Set piece: **kindle** the dark lamps by passing each cleanly. |
| 2950 to 4500 | Firstlight | Benches, a bridge, a street of stone and lit paper, a chute, a 21 m leap at 3980 m, the square. From 3900 m the east goes rose. Set piece: **carry** a flame over the last 880 m to the great lantern, a paper drum 6.6 m tall on a timber frame 36 m past the line, dark all run and lit at the finish. |

- **How it is built.** A building here is a lantern, squared and stacked: a narrow stone stem, storeys of lit
  paper in a timber lattice each slimmer than the one under it, a flat eave of snow between them, a steep cap.
  Houses are stone below and paper above, and every roof ends in a small lantern of its own. Nothing has a swept
  eave or a lintel on two posts. Hazards are ink: standing stones, marker stones, and stone lamps whose flame the
  world draws over them. The run's gates are bronze, so the rider's vermillion is the one red.
- **The lights.** Marigold is spent in pools: a way lamp every 18 m, each lighting about 13 m of snow, with lilac
  between. A light in cloud is a wide soft halo far off and a flame up close. A lantern in the valley covers what
  is behind it before it adds its light, so it stays marigold against a pale range. The deck is dark with a rose
  underside, never orange: the lanterns are the brightest thing under it.
- **The cloud.** From above, three sheets of billows in three values with warm pools that hold their place. The
  cloud lets go 80 m above the lip of the break, in under two seconds, so the whip onto the valley finds it open.
- **The set pieces as light.** The guide light is a paper lantern with a white heart, three small lights circling
  it and a tail, 26 m ahead; its wake on the snow is marigold and whole while the rider is in it, thin and cold
  when not. A dark lamp holds a cold glint and catches with a burst as a sled passes; a won road blazes. The
  carried flame stands on a short staff over the rider's shoulder, white-gold when full and amber when low, and
  drops to an ember shedding sparks while it gutters.
- **Low** is a poster of it: one cloud sheet, lanterns as flat squares, flames as flat painted shapes with one
  paler value, no canal, the lamps' light as painted pools.
- **As built in round 8.** The great lantern burns banked low until it is lit (dark, it hung behind the FINISH board on
  the approach as a violet mass), and hangs over the square 35 m past the line; as the finish lens swings round
  to the rider's front the lamplighters walk it along its yoke to the side the lens looks back across, so in the
  results it burns over the rider's head (shafts on Medium and High). The night itself stays round 7's: a darker road
  with stronger pools was read three times, against this section, as a flat violet with a gold floor. A lamp's pool
  keeps the snow's own lilac and lifts its value toward silver, the lamp's marigold only at its heart; Low paints it in
  two soft steps of silver and a small warm heart.
- **The review loop (round 8).** The cloud lets go as the Cloud Sea's guide light leaves the run, about 300 m above
  the break's lip (wherever the course puts the lip), so the last of the high ground is ridden out under the deck with
  the valley opening ahead and the whip lands on it open. The valley's near lanterns are paper with ribs, palest at the
  waist, under an ink cap and over a foot and tassel. The rider is rimmed by the moon on the Crown and more strongly in
  the cloud, where the light has no side. The great lantern, walked off the run, is let down on its chains so that in
  the results it burns in the top third over the rider. The lift station is coursed stone under a hall of lit paper;
  the kilometre pillars carry string courses and a graded paper head; the bridge of lights' piers carry a lantern storey
  and a slot of light; the FINISH board is lilac paper.

### The Old Run: a winter afternoon on the old ice track (new in round 9)

- **Feeling.** An old resort's afternoon: the grand hotel's track cut down a bare wood, ridden high on its banked ice
  while the sun goes down over the lake below. It ends in the first blue of evening, the lamps lit.
- **How it rides.** The walls carry a sled round each bend at the height its speed settles it: a fast rider sits high
  on the glaze, which is faster still; a slow one sinks into the floor's slush. Riding the glaze is the line, the floor
  the safe and slower way.
- **Colour script.** A low late sun ahead and to the left through the wood, a soft disc over a slate-blue sky; cream
  snow, slate-lavender shade, the ice a step cooler.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 160 | The start house and the hotel | Late gold on the hotel's facade, the track leaving the start house's dark mouth. |
  | 160 to 950 | The Hotel Straights | Low sun through the bare wood: bars of trunk shadow across the ice, the glaze catching it. |
  | 950 to 1950 | The Labyrinth | The deepest walls hold the shade; the light on the high glaze and the crests, the lamps telling. |
  | 1950 to 2880 | The Horseshoe | The sun sets in rose over the lake far below; the far ridges lit along their crests. |
  | 2880 to the line at 3000 | The outrun | The first blue of evening under an amber band; the lamps and the timing house's windows the light. |

- **What it is not.** No hero peak at the end of the track and no sea of cloud: low wooded ridges round a lake of open
  water far below. No pine: a bare wood of beeches and birches, lace against the sky. No grandstands, no square, no
  arch: a timing house with its clock at the line.
- **The track.** Ice from wall to wall, polished blue-white with rime, a clear heart and bubbles; the glaze a deep
  clear band high on each bend's outside wall exactly where the sim lays it, cool, a frost-white hairline at its edges,
  never warm or long (a warm band reads as gold-white's line); the slush dull in a bend's floor. Past the lip a crest of
  snow and a timber rail, never rock; iron lamps on it the length of the run.
- **The glaze's edges** are a hairline on screen, a pixel or two wherever they are, gone within a few metres of the
  lens (measured in the wall's own shares, the hairline was 10 to 20 cm of ice at the lens and lay down the near wall in
  a wall ride as a pale band). A glint on the ice is a point, never a star; the sled's lantern lights the walls only
  near the sled's height; the ghosts' lights keep to the near track.
- **Architecture and people.** The grand hotel down the start straight: cream render, green shutters, slate mansards
  with dormers, a glazed veranda, two spired towers on a terrace. The start house a timber shed with a bell turret; the
  timing house a clock tower with a low hipped cap and an open cupola (a pointed cap reads as Pinecrest's steeple).
  Onlookers in the resort's greatcoats and hats, still, on the terrace, the crests and in two stands at the Horseshoe.
- **Its other hour: by Lamplight.** A half moon, the lamps' soft wash on the ice in a pale warm white (silver pools are
  Lanternfall's alone), the hotel's windows lit and spilling on the snow, snow falling through the lamplight from the
  Labyrinth on.
- **The set pieces as light.** The bells bronze, the next breathing, a rung one swinging and lighting the wall; the
  Labyrinth's dial sweeping its split, its lamp marigold while the rider is up on it; the Horseshoe's lanterns lighting
  down the hook with the hold.
- **Its set:** Bell Tails, Bell Peals and the Timing Clock.
- **Low** is a poster of it: spikes for twigs, one rail, the places drawn only within reach; on a held Low run about
  Pinecrest's GL calls, under them in the Labyrinth.

### Gullhaven: the storm's light on the sea cliff (new in round 9)

- **Feeling.** A winter's day on a sea cliff: the path along the clifftop with the fence between it and the drop, the
  moor rising on the left, the sea a thousand metres down on the right to the horizon under a slate storm deck, and the
  sun burning low under its edge. Wind you can see. It comes down off the cliffs to a harbour at dusk, its lights lit.
- **How it rides.** Nine gullies cut the clifftop. At each the path swings inland round the gully's head through its
  drift; the shelf runs straight on to a corniced lip, and a rider who pops off it is held over the gully's mouth by
  the sea wind and comes down on its face or the far shelf, paid for the landing. Soaring is the line, the path the
  safe and slower way.
- **Colour script.** A low sun ahead and to the right over the sea under a slate deck lit only along its rim; snow with
  only a trace of the sun's colour, cool violet shade; the sea dark slate-blue with a broken path of glints.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 200 | The beacon | The low sun under the deck's edge, the beacon's fire on its knoll the warm note. |
  | 200 to 1450 | The Cape and its geos | Clear storm light: the sun's path on the sea, the lighthouse limewashed at the Cape's end. |
  | 1450 to 2050 | The squall | The deck lowers onto the sun, snow drives in on the wind, the far sea in haze. |
  | 2050 to 2800 | The Great Geo | The sun breaks under the deck over the Great Geo, its column lit, spindrift streaming. |
  | 2800 to 4050 | The rose sunset | The sun sets under the deck in rose, the sea a path of fire, the shade slate-violet. |
  | 4050 to 4800 | The descent, the sheds, the harbour | Dusk: an amber band under the deck, the sheds' windows and the pier-head lights the light at the line. |

- **What it is not.** No mountain peak and no sea of cloud: the sea itself, at its own level, read as water. No pine:
  a moor of snow over dry-stone walls. No square: a harbour with its quay, its pier and the line between two pier-head
  lights.
- **The edge.** A pale weathered snow fence on the cliff's brink, at the run's limit, its pennants streaming inland
  and standing up over a gully's column; past it the cliff's dark rock in beds to a wet foot at the sea. A gully's lip
  is a corniced edge flush with the shelf, its brow overhanging the drop: a lip a rider can leave, never a wall.
- **The sea's air.** What stands in the sea far under the cliff (the stacks, the clefts' walls) keeps the sea's own
  clear air, so a stack is the cliff's dark rock on the dark water, never a pale post. The far coast's cliffs are bare
  rock in one value up over the moor's brow; the moor's snow begins inland of the brow. The snow's ripples lie half as
  deep as elsewhere (under the low sun their troughs lay on the shelves as figures).
- **Its legends.** The Beacon Keeper, a pale figure of light twice a man's height in an oilskin and sou'wester, walks
  the clifftop beside the legend's line ahead of the rider, his lamp held out and its pool soft on the snow. The Herring
  Lights: the harbour's boats coming home along the coast far below the Geos in two columns, a lamp at each masthead
  and its light lying on the swell, a pale wake astern.
- **The wind.** Spindrift up each column, gulls hanging in it into the wind, pennants and windsocks standing up, the
  beacon's smoke leaning inland.
- **Its other hour: Moonrise.** The moon over the sea and its path on the swell, the lighthouse's beam turning, the
  beacon's fire, the harbour's windows and lights.
- **The set pieces as light.** The lighthouse's beam a pool of lamplight swinging across the path at each mark, the next
  breathing; the Great Geo's far line two blue-banded poles with lamps, lit while the rider is in the air; the sea
  stacks' gaps in ink jaws with a pool in each, a stack in the sea off every gap.
- **Its set:** Pennant Ribbons, Gulls and the Lighthouse.
- **Low** is a poster of it: the fence's posts and rails with one pennant colour, one stack form, the places drawn
  only within reach; on a held Low run more GL calls than Pinecrest's and Ember's (the sea, the surf and the
  spindrift), timed in the round's proof.

### Gablefall: a snowfall over the roofs of a hill town (new in round 9)

- **Feeling.** A winter afternoon in a hill town so snowed in that its roofs are the way down: from the church's nave
  at the head of the town over the roofs, the street below between the lit fronts, down to the frozen river, the snow
  falling the whole way. It ends in daylight under the old stone bridge.
- **How it rides.** Two rows of houses down a street; each roof a gable of snow on slate a step under the last, the
  alleys drifted full between blocks, corner drifts from the street up onto the rows. A rider on the roofs hops each
  step and alley and stomps the landings; one who drops off an eave rides the street until a drift takes it back up.
  The roofs are the line, the street the slow way.
- **Colour script.** A snowfall in a grey afternoon: a pale lilac-grey snow cloud over the whole sky, a pale coin of
  sun through it ahead and to the left, soft shadows, the snow white with a lilac-grey shade; the windows a lamp behind glass, lamplit as the day goes. The near flakes few and never
  darker than the air behind them; the river's ice holds no streak of the sun, a pale coin behind the cloud.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 180 | The church and the close | The nave's snow between its pale pinnacles, bunting strung between them, the town's roofs below in the falling snow. |
  | 180 to 900 | Church Hill | The grey afternoon, the far side of the valley a ghost in the snow, chimneys smoking. |
  | 900 to 1,850 | The Market | The snow thickest, the windows and the market's arcades telling, the gallery over the square lit. |
  | 1,850 to 2,660 | The Water Stairs | The cloud breaking over the river, a pale sun through the gap, the viaduct across the valley clear. |
  | 2,660 to the line at 2,800 | The quay and the river | Daylight on the river's ice, the bridge's banner of checks over the line, the snow still falling. |

- **What it is not.** No peak, no panorama, no sea of cloud, no pine: low rounded hills in the snow (its own panorama, never another mountain's
  ridges, which stood in its haze as peaks), the town's other half on
  the valley's far side behind a viaduct. No square and no lamplit town at the line: the river under the bridge, in
  daylight.
- **The town.** The roofs are the run's snow on slate; their eaves end on a dark slate edge (never a white lip, which
  reads as a rail); fronts painted from a damp foot to a pale head, windows with glazing bars and shutters, shops and
  window boxes, the alleys' mouths walled with timber gates, the corner drifts held by boards with flags over them; the
  street trodden and swept, a step cooler and duller than the roofs (no setts showing: bare stone on the ridden line);
  chimneys the hazards, stone stacks as tall as their colliders, half of them smoking in round puffs; the lamps' light pools on the snow before the doors.
- **Its places.** The church at the head, the run starting on its nave between pinnacles; two market squares with a
  gallery bridged high over each, three arched lights in it over the charm gate's three lanes; the quay's tall gabled
  houses and the boathouse; the old stone bridge at the line, a banner of checks hung from its parapet, the townsfolk on
  it; the viaduct and the town's other half across the valley, fading into the snow from the head of the town.
- **Its other hour: Evensong.** The same snowfall at the day's end, the cloud lit faintly warm from under by the
  town, every window lit, the lamps' pools on the snow with the blue between, the church's windows at the head and the bridge's lamps at the line; no moon, no stars; the sled's lantern low, so the
  street's fronts keep the night's value and the windows are the light.
- **The set pieces.** The Roof Run's lanterns under the eaves lit roof by roof, an ember when the chain breaks; Market
  Day's striped awnings shaking their snow off when a stomp lands under them; the washing lines across the alleys,
  jumping and throwing their frost when rung (section 1b). Never on the snow a sled rides.
- **Its set:** Market Awning, Pinwheels and the Gable House.
- **Its key art** rides the roofs of the Water Stairs from 2,120 m, its three riders drawn from the part of the pool that
  rides the roofs there, so the hero is on a ridge with the roofs stepping down and the viaduct beyond, never in the
  street between the fronts.
- **Low** is a poster of it: the town past the rows merged into each segment's one draw, two rows deep, no window
  dressing; on a held Low run 8 to 24% under Pinecrest's GL calls on the same stretches, at half its triangles.

### Tiers, designed

- **Ultra and High** carry the whole direction: the shafts, the scatter, the ambient occlusion, the reflections.
  As built, Ultra is High's world with a heavier frame: 4x MSAA, a 4096 shadow map over 44 m, three-slice
  occlusion with contact shadows, 12-tap shafts, 22-tap depth of field, and ice that mirrors the frame itself. The
  automatic controller steps into it only on a GPU the browser names as discrete; anywhere else it is the player's
  choice in Settings.
- **Anti-aliasing.** Low the canvas's own MSAA; Medium the edge walk; High 2x MSAA and the edge walk; Ultra 4x
  MSAA and the edge walk.
- **Ice.** Every glaze mirrors: Low a painted sky and ridges; Medium and High the baked sky and peaks with the
  rider standing in it; Ultra the trees, towers, lamps, gifts and riders in view.
- **Medium** keeps the grade by place, the three planes, the light's colour on the snow and the hero's rim. It loses
  resolution and samples, never the picture.
- **Low and phone** are a look of their own, a flatter poster of the same scene: the grade by place baked into fog,
  sky and vertex colour, the three planes as three flat values, shafts and glows as a few painted quads, the sun's
  scatter as a gradient on the dome, a painted rim on the hero. Stylised tricks instead of missing effects.
  As built (`tierLook`): the place's grade and the film curve are baked into the colours Low draws with, the sun
  is a flat disc of the light's own colour with a wider glow on the dome, local lights are two-value painted pools
  on the snow, a lit lantern keeps its hue, powder is fewer, fuller billows, and riders' labels and the running
  figures are drawn in the canvas.
  After the visual lift (DECISIONS 362, 364): Low paints shafts from the sun and from a bright place as cards, a
  hard band of the key light's colour on silhouettes (the hero's strongest and all round it), the sky in printed
  bands, and the frame's foot in its shade's colour; its cast shadows are the far shadow field's, cut with a
  poster's edge and leaning to the mountain's own shade (Pinecrest's periwinkle, never cobalt). Frostfang, Ember
  and Lanternfall paint the snow's light in two flat steps; Pinecrest and Sakura keep one smooth ramp, where steps
  printed the shadows' fall-off as camouflage.

### The visual lift (after round 7)

- **Shadows to the horizon.** Past the shadow map's reach every lit surface reads a shadow field baked for each
  stretch's own sun: ridges shade valleys, a forest shades its bank, a tower lays its shadow half a slope down. The
  run's own ground casts by the low shadow light, the mountainside by the key light, and a ridge's shadow keeps a
  breath of light so the trees' own shadows still read in it. On Low it is the only cast shadow.
- **The shade side has form.** A face turned up takes the high sky's colour, one turned to the horizon the low
  sky's, and the lit snow bounces up under eaves, branches, rocks and the sled. Blossom, ice and the ghosts' glass
  are lit through when seen against the sun: blossom at its rim in its own pink, thin ice keeping its cobalt core.
  None of it is milk: darks hold, and a lift of 0 is round 7's picture.
- **Edges that look made.** Every kit piece catches its arrises with a chamfer on Medium and High; on High and
  Ultra a convex edge near the lens catches a hairline of the key light and an inner crease darkens, never on the
  rider and never a white outline. Lettering is cut solid, never dotted.
- **Thin things hold still in motion (round 8).** High and Ultra rebuild each frame from the ones before it; the hero
  is drawn crisp over it at the tier's MSAA, never from its history, and what moves on its own (lifts, birds, figures,
  flags) is drawn after the rebuild, so nothing trails. (After round 7 the rebuild was held back because it softened
  the rider, DECISIONS 363; round 8 finished it, 379.)

## 16. Round 8: the look and the hook

How the look was judged: every item was shot as stills that hold the run still (a pool rider replayed as the player
on a virtual clock from a fresh save, `scripts/playtest/stills.js`), paired blind with the before (`blind-pairs.mjs`,
the new frame on a seeded side) and picked by a fresh critic told only this file. A section here records what the
critics passed; what they did not pass stays out of the picture (DECISIONS 372 on).

- **Charm gates are light, not structures.** Three arches a gate, one a lane, a family told by shape and colour:
  speed a pointed arch in azure `#4DA6FF`, style a round arch in orchid `#D07BFF`, survival a square arch in leaf
  `#7ED957`. These are the gates' own colours, never a role's (each stands 30 degrees of hue off mint, vermillion,
  marigold, rose, gold-white and amber) and never on the rider, a ghost or a hazard. A medallion in the same outline
  over each crown carries its charm's glyph, legible from about 120 m; a faint veil of the family's light fills each
  opening so a lane reads as a door. The next gate breathes brightest; the arch ridden through burns toward white in
  its own colour, the other two gutter. Nothing stands on the snow a sled rides (section 14 holds).
- **A held charm has one signal,** on the lantern or in the world (a wisp circling the rider, sparks on the safe line,
  a thread to the ghost drafted), never a list or a corner icon: the HUD does not grow.
- **Tricks are poses with names.** Every trick has a pose (a hand on the rail, an arm up for a Lantern Reach, laid out
  flat for a Spirit Stretch, a corkscrew for an Ember Twist) that eases in fast and lets go at touchdown, a name in
  the callout and a sound by family. A deep grab near the snow strains the rider and turns the landing ring the
  clock's amber, throbbing; in the stomp window it burns gold inside an amber edge.
- **A showdown is a race with a finish line of light:** two posts of gold-white light with a band of the rival's colour
  300 m ahead, the rival named in the pill; won, it bursts in the lantern's marigold and runs into the rider; lost,
  in the rival's colour. A steal pulls a thread of the ghost's own light into the rider, turning marigold.
- **Every action is an event.** A perfect landing holds the whole picture for a beat (50 ms, longer for a streak) and
  runs one shockwave of heaved snow out from the crater to about 8.5 m, a lit crest with a cool trough, white-gold for
  its first instant, and a band of the snow's white runs up the rider's edge. A dash ignites the rider in white-gold,
  cools the world round it (everything but the rider leans to a colder, quieter blue) and turns every hazard it passes
  inside 6 m to pale glass motes. A ward's lantern stands larger than the rider so it reads from behind, and its shards
  fly out to the sides, lit paper keeping the sled's pace. A passed ghost flares in its kind's colour, rocks back with
  its arms flung up and comes apart into motes of its colour from its far side, never across the rider. The finish is
  scaled to the result: a win is a festival, a best beaten lights the town (lamps down the square, each with a low
  willow of marigold, lanterns let go), a podium a smaller show, an ordinary finish warm, a wreck gentle (the snow
  settling round the rider). Nothing an event draws sits over the rider. Ghosts in glass take the trick poses. Low
  keeps every beat but the light up the rider and the cooling; reduced motion keeps every beat and drops the motion.
