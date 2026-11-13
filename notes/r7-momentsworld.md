# Round 7, the `momentsworld` lane: the set pieces, the legends and the climax as pieces of the world

Branch `r7-momentsworld`, cut from `round-7` at 9ec0892. Render only: nothing in `src/sim` or `src/bot`, no collider
added, moved or resized, nothing read back into a run. The lane ran as three: the verbs' worlds and the climax
(this file's author), the eight legends (branch `r7-momentsworld-lg`, merged) and six places (branch
`r7-momentsworld-pl`, merged). Nothing here has been played by a person: every verdict below is from scripted
captures read as frames.

## For a player, in short

- Every verb on the four older mountains is a thing in the world now, not an orb, a beam or a disc: lanterns on
  yokes, a real pendulum where a gate swings, bronze bells on ropes, a forge gate of torch masts, lamps that go out
  with a falling span, a drift scribed in the ice, lantern arches that take light stomp by stomp, paper wheels that
  say which trick.
- A variant shows before it is played: the rings' arc of light hangs low or high and on its own side, a row of
  stomps is tied by one garland, the keystone stands on a span that falls from its far end, a far shelf has two
  forge gates, a spin is a wheel that lies flat and a flip one that stands.
- Eight legends have bodies: a white stag, a fleet of lanterns, the aurora on the snow, a ghost herd, the cone
  erupting, a cinder wyrm, a lantern dragon, a thousand cranes.
- Six places were lifted: lava under the Caldera Leap, ribs and a dawn in the Ice Cavern, bars of sun in the Thousand
  Torii, orchards in rows and flooded paddies on Petal Steps, lamps that are lanterns, a leap's shoulders that step.
- Every mountain's last 500 m lights up ahead of the sled: strings of lanterns take light in a wave that reaches the
  line first, two beams stand over the line, and shells break over it as the sled arrives.
- The black one-pixel dashes under the lantern gates are gone.

## Decisions

### W1. One kit for everything that is staged (`src/render/momentkit.ts`)

`MomentKit` holds three kinds of pooled instanced draw and hides each one that holds nothing this frame: `glow` (a
camera-facing sprite: halo, ring, star, flame), `decal` (a mark on the snow, tilted to the slope: pool, ring, scribed
line, chevron, ripples) and `pool` (any solid form: a lantern, a bell, a crane). A stage is handed a `StageCtx` (the
sim, the snap, the tier 0 to 3, reduced motion, particles, fireworks, breaks). `MarqueeWorld` runs three stages each
frame: `verbworld.ts`, `legendworld.ts`, `climaxworld.ts`. Positions are in the sim's frame.

- **Light that also covers.** The first cut was additive, like round 6's pillars, and on High in daylight it was
  invisible: 21 sprites and 4 marks were being drawn at the First Drop and none could be found in the frame
  (`shots/r7/momentsworld/verbs/sheet-a-m0.png`). Added light is lost on sunlit snow and a bright sky, where half
  of every run is ridden. Both kit materials are now premultiplied and cover a part of what is behind them (a sprite
  half, a mark nine tenths), so a mark is paint by day and light by night. Marks on sunlit snow use a deep marigold
  (`#FF9E1A`), which has value against white as well as hue.
- **A lit form is round.** `litMaterial()` (paper lit from inside, a bell) is brightest where it faces the lens and
  deeper at its rim, with the mood's fog at half strength. Without it a lantern close to the lens was a flat block of
  marigold, the review's "yellow blocks" again (`sheet-c-demo-2.png`, Ash Market, second frame).
- **A mark is lifted off the mesh.** `c.ground()` is the surface the drawn snow samples; between the mesh's vertices
  a mark 0.1 m up was buried on any slope. Marks sit 0.3 m up with a strong polygon offset.

### W2. The black dashes were a `pow()` of a negative (`marqueeworld.ts pillarMaterial`)

A gate's pillar of light computed `pow(across, 2.2)` from a varying. Under MSAA a varying is extrapolated past a
quad's edge, goes below zero, and `pow()` of a negative is not a number: one black pixel wherever a pillar's edge
crossed a sample. Clamped. The places sub-lane shot Old Town at 3180 to 3490 m and the Ice Cavern at 3154 to 3418 m
on High with and without `&post=none`, and Old Town on Ultra: no dashes (`shots/r7/momentsworld/places/bug/`).
Round 6's pillars are no longer drawn at all (W3), so the fix now guards only the fifth mountain's stand-ins.

### W3. The verbs' worlds (`src/render/verbworld.ts`)

Each reads `Sim.plays`, `Sim.mo` and the director's `moment` beats and nothing else. State is in the world: the
next target burns brightest and breathes (steady under reduced motion), a hit is answered with light, a local light
and debris, a miss gutters to an ember colour and nothing else happens.

| Verb, place | What stands there | Next, hit, miss | Variants at a glance |
| --- | --- | --- | --- |
| rings, the First Drop | Chevrons on the run-in that bend to the take-off slot; a dotted arc of light from the lip through the three rings | The span to the next ring is brightest; flown, a span turns white gold | low: a low arc; far: the same on the other side of the lip; high: the arc climbs 6 to 20 m and the lip carries a ring and a star where to pop |
| slide, Mirror Lake | A sign scribed on the ice as the lake opens; then the drift itself scribed behind the sled, with ice dust and a light on the sled | The scribe brightens a quarter at a time and drops a ripple; let go early it fades to a fifth; won, the whole line flares white gold | long: one long crescent; both: two crescents that face each other, and the first way's line stays while the second is cut |
| steps, hops, Old Town | A string of five paper lanterns across the street every 36 m | Each stomp raises every string's light a third, arriving as a wave that runs ahead down the street; a ripple where it landed | three: strings only; row: one garland of lanterns ties each string to the next, and a broken row puts them all out |
| collapse, Serac Gate | Lamps on slim posts down both edges of the span; a crack of light and standing powder at the sim's fall line | Lamps go out as their part of the span falls; near the fall they turn white gold | chase: steady lamps; surges: the lamps pulse with the fall's own four-second surge; far: two pylons of ice with beacons and a ring on the deck at the keystone, the fall coming up the span toward the rider |
| race, chase, the Crevasse Fields | Each car's own halo and lamp, seen far down the bank; a beacon and a line of light at the far station | A car caught turns white gold with a ring and sparks | near and far: where the car's light is; pair: the second car's light is rose |
| gates, sit, the Ice Cavern | Two strings of three paper lanterns on a yoke hung from a wire; a pool of their light in the opening; a faint line on the snow from each opening to the next | Next: brightest, with a chevron before it. Threaded: its lanterns slip the string and rise. Missed: ember | turn about, from the other wall, two and two: the line on the snow draws the pattern before it is ridden |
| race, sprint, Cinder Gate | The skip's halo; a signal mast of three lamps at the station; a line of light and a beacon at the far end | The far line breathes while the rider leads; won, it flares | even: the three lamps go out one by one as the rider arrives; early: all dark, the skip away down the cable; late: all lit white gold, the skip waiting |
| surge, the Caldera Leap | A forge gate: a slim iron mast either side of the lip with five bowls of fire; three chevrons to the lip; braziers and a line of fire at the far line | The flames climb the masts with the sled's speed and the top one burns white gold at the speed asked; leaving fast enough the gate roars (flames triple, a ring, sparks, a light), too slow it gutters | shelf (44 m/s): one gate; far (47 m/s): two gates 16 m apart and the far line further out |
| gates, swing, Ash Market | The same lanterns on a yoke hung by two ropes from a pivot 11 m over the street: a pendulum whose bob is where `gateX` has the gate this tick, so the yoke tilts and rises as it swings; a line on the snow the width of the swing | As gates | sway: all together; counter: alternate gates half a swing apart; wide: 3.9 m and 5.5 s, the yoke rising 1.6 m at each end |
| steps, stair, Petal Steps | An arch a step: two wine-lacquer posts outside the run, a rope, seven rose lanterns; a ring on the tread where a stomp lands | The next arch and its ring breathe; a stomp lights the arch white gold with petals | three of four: arches alone; row: a garland from each arch to the next |
| flourish, the Blossom Leap | Two paper wheels on poles at the lip, 7 m across | They spin faster as the sled comes; landed clean they flare and spin up, with petals thrown both sides of the landing | a wheel that lies flat and spins is a spin, one that stands and turns is a flip: one of each, two flat, or two standing |
| shatter, Temple Town | A bronze bell on a rope from a wire, its mouth where a sled must be, small bells either side as wide as the sled may pass | Next: a halo, a ring on the snow and a thread of light from the snow to its mouth (how high). Rung: it swings and decays, throws a ring and a star of light, sheds shards (`breaks.shatter`), and its small bells are gone. Missed: dull bronze | hung level; rising: each rope shorter than the last; wall: the bells hang over one side of the street |

Round 6's gate strings, pillars and garland are no longer built: the gates are `verbworld.ts`'s. The machine, its
cable, stations and cabins, and the collapse's falling chunks stay in `marqueeworld.ts`. The stand-ins that remain in
`marqueeworld.ts` are the fifth mountain's (follow, kindle, carry, and its two legends), which are the
`lanternworld` lane's to replace.

Nothing drawn suggests a line the sim does not reward: the slide's sign is a sign at the lake's mouth, not a line
across it; the sitting gates' line joins openings the sim does ask for; the rings' chevrons lead to the slot the
ring line is set from.

### W4. The legends (`src/render/legendworld.ts`, `legendforms.ts`; the sub-lane's report)

Each has a beginning on `lg.phase` 1, a peak on 2 and an end, and is hidden outside 520 m before `z0` to 150 m after
`z1`.

| Legend | Beginning, peak, end | Verdict from the frames |
| --- | --- | --- |
| The White Stag | Comes in from its side far ahead; gallops 18 m ahead weaving across the glade so its flank shows, a star in its antlers, hoofprints of light; bounds off to its side | Good. Rear-on at the peak it reads more as a glowing statue than a gallop |
| The Lantern Fleet | A launch wave from both shores; a sky of lanterns over the lake, never on the ice; drifts off on the wind | Strong at the peak; the first launch is a clump |
| The Aurora Comes Down | Curtains come down from far up the run; violet and rose curtains with a lit lane; lifts and fades | Good. The end falls inside the Ice Cavern, so the lift is not seen |
| The Ghost Herd | Comes up toward its side; sixteen translucent caribou on the edges and banks; peels off up the banks | Reads well; small on the phone |
| The Cone Wakes | The crater rumbles; a blast, a fountain, lava down the cone's face, bombs, the sky band lit, ember rain; fades | A real eruption. The chase lens holds the summit at the frame's top edge: it needs the camera's look |
| The Cinder Wyrm | Rises out of the snow; 30 m of glowing plates swimming the ravine, a mane of sparks; dives under | Decent; seen end-on, thin on Low |
| The Lantern Dragon | Flies in high from its side; winds in a wide S so its twenty drums read as a body; climbs away | Good |
| The Thousand Cranes | A first flock rises; rose and white streams beside the rider that wheel over the landing; climb away | The weakest: pale paper on a peach sky. Not shot in a real flight |

### W5. The places (`src/render/stages.ts`, `places.ts`, `town.ts`, `groves.ts`, `landmarks.ts`; the sub-lane's report)

| Place | What changed | Verdict from the frames |
| --- | --- | --- |
| The Caldera Leap | Lava fields down both banks from the lip to the shelf: near-black crust plates on bright cracks, a glowing heart, basalt rims, rising embers, glow sheets, two breathing local lights | From the air it is lava beside the flight. From the ground lens and on the phone the banks hide most of it. It is not a lake under the flight: the ground under the flight is the ridden landing slope. No smoke ceiling lit from below was built |
| The Ice Cavern | Ribs of ice every third bay (fifth on Low) with crystals at their springings, climbing the walls outside the limit and arching only above the highest air a pop reaches; a rose and gold dawn blade on the floor and a veil at the mouth | A hall of ice pillars with a crown. The mouth is mostly behind the lantern gates in the frames, so the dawn reads weakly |
| The Thousand Torii | Bars of sun across the snow in every gap, slanting shafts from the sun's side (every gap on High, every second on Medium, none on Low), a bright veil at the far end | The strobing bars read. The post walls are still dark wine |
| Orchards and Petal Steps | Orchard rows aligned with 7 m lanes of snow; flooded paddies up both banks of Petal Steps from 4 m past the limit, level steps of sky behind snow-capped bunds | Strong from the air. From the run the paddies read as stacked rims: water above eye height cannot be seen |
| Lamps | A street lamp is a bulged drum under an iron cap, hung lanterns have a cap and a foot, a stone lantern's light is a six-sided paper drum | Small at play distance. Bunting lights (`landmarkKit.ts`) untouched |
| A leap's shoulders | Two or three raised ledges a shoulder with the crowd on them, a sagging cornice, flags at 5 to 12 m, pines behind | The ruler edge is gone at 3940 m. The First Drop's shoulders change little |

### W6. The climax (`src/render/climaxworld.ts`)

From `climaxOf(course)`: strings of five lanterns hang 9.4 m over the run every 34 m from 20 m past where a sled
lands the last leap (`landZ`) to the line. They wait dim marigold and take light in a wave that starts 50 m ahead of
the sled at the last lip and is 310 m ahead by the line, so the wave reaches the line while the sled is still coming
(the square is lit before the rider is in it). Two beams stand over the line and grow from 18 to 64 m with the
square of the sled's progress from the lip, with a bar of light across the snow. Shells go up once a run at three
places: two as the sled lands the leap, three as it enters the town, five timed from the sled's own speed to break
over the line as it crosses (sent 1.7 s out, each rising for the sled's own time to the line). After the line the
strings beat. Everything is keyed to the sled's place and speed, never the clock, as the music's finale is. Sakura's
last leap is before Temple Town, so its strings run through the bells' street: the bells hang lower and nearer.

## Text for ART.md 14

> **Round 7: the verbs' worlds.** Every verb is a thing that stands or hangs in its place, lit by its own light, and
> nothing of it stands on the snow a sled rides. Lantern gates are two strings of three ribbed paper lanterns on a
> yoke: hung from a wire where a gate sits, on a pendulum from a pivot 11 m up where it swings. Bells are bronze,
> lit, on ropes as long as the height they ask. The Caldera's forge gate is two slim iron masts of five flames that
> climb with the sled's speed and roar when it leaves fast enough. A falling span carries lamps that go out with it.
> A slide is scribed in the ice behind the sled. Stomps light lantern arches. Paper wheels at a lip say the trick: a
> flat one that spins is a spin, a standing one that turns is a flip.
>
> **State reads in the world.** The next target is the brightest thing in the set piece and breathes. A hit is
> answered with light (a flare, a ring, a local light on the snow) and debris; a miss gutters to an ember colour and
> is otherwise quiet. A variant is seen before it is played.
>
> **Light that covers.** A set piece's sprites and marks are premultiplied and cover part of what is behind them, so
> they are paint on sunlit snow and light at night; marks on bright snow are deep marigold. A form lit from inside
> is brightest facing the lens and deeper at its rim: never a flat block of its colour.
>
> **Legends.** (A paragraph a legend is in W4's table: fold the "Beginning, peak, end" column in.) Never mint: the
> aurora that comes down is violet and rose with an ice-white hem.
>
> **The climax.** From the last lip the way to the line takes light ahead of the sled, in a wave that reaches the
> line first; beams stand over the line and shells break over it as the sled arrives.

For ART.md 15, from the places sub-lane: *Caldera Leap: lava lies on the banks, its crust near-black, only the heart
glows. Petal Steps: the flooded paddies are a view from the air; from the run they read as rims.*

## Text for the README

> The set pieces' worlds are drawn by `src/render/verbworld.ts`, the legends by `legendworld.ts`, the last stage's
> lights and shells by `climaxworld.ts`, the places' own light (lava, a dawn, bars of sun, paddies) by `stages.ts`;
> all through `momentkit.ts`, whose pooled draws are hidden when they hold nothing.
> `scripts/playtest/momentsworld.sh <out> desk|phone <tier> "<runs>"` shoots a strip through every set piece and
> the climax with what the kit is drawing; `legends-r7.js` shoots the legends.

## Cost

Measured from the kit's own count (`MomentKit.cost()`, logged with every frame by `momentsworld.js`) on a pool
rider's run on High, and on hands-off runs on Low and the phone. Frame time was not measured: other lanes share the
machine.

| Piece | Draws while it plays | Triangles (High) | Low and phone |
| --- | --- | --- | --- |
| rings | 2 (sprites, marks) | about 50 | fewer dots and chevrons |
| slide | 1 to 2 | 16 to 240 (the scribe is at most 110 marks) | 48 marks |
| steps, hops | 1 to 3, plus the wires' mesh | 2,500 to 3,800 | 3 lanterns a string, no garland |
| collapse | 3, plus the posts' mesh | 1,400 to 3,100 | no halos, half the powder |
| race | 1 to 2 | under 20 | the same |
| gates | 4, plus the wires' mesh | 1,100 to 4,400 | 2 lanterns a string |
| surge | 2, plus the masts' mesh | about 60 | 3 flames a mast |
| steps, stair | 3, plus the arches' mesh | 1,800 to 2,400 | 3 lanterns an arch, no garland |
| flourish | 2, plus the poles' mesh | about 90 | the same |
| shatter | 5, plus the wires' mesh | 4,700 to 5,600 | half the small bells |
| climax | 3, plus the wires' mesh | 370 to 4,000 | 3 lanterns a string |
| a legend | 1 to 6 | 0.6k to 13.1k (the herd) | 0.4k to 5.6k |
| the caldera, paddies, torii, cavern mouth | 4, 2, 1, 1 | 12.1k, 8.8k, 940, 46 | 2.5k, 1.1k, 440, 20 |

A set piece's static mesh (wires, posts, masts) is one draw of a few hundred triangles, visible from 420 m before
its place to 90 m after. The kit's sprite cap is 72, 180, 360, 440 by tier and its mark cap 56, 120, 200, 240; a
stage that asks for more is quietly cut, nearest first. Local lights pushed: at most one a gate, bell, arch or string
within about 90 m, so the model's nearest eight (Low's four) are what is kept. Nothing is drawn while idle: with no
set piece, legend or climax in reach the kit reports 0 draws (the Mirror Lake frames past the sign). No geometry is
built per frame. Round 6's gates cost 3 draws a course; they are gone.

A run whose variants differ from the plain day's still rebuilds the set pieces' static meshes on its first frame,
as round 7's sim lane noted; the new statics add a few hundred triangles to that build.

## What the main lane must wire or decide

1. **The legend beat and the camera.** `MarqueeWorld.legendShot()` returns, while a legend is in reach, its key,
   name, phase, `k` (0 to 1 through its staging), `peak` (0 to 1), a focus point in three.js space, its side, kind
   and `ahead` (metres to the focus), else null. The reel's `legend` beat and HUD card can read it; the camera
   should look toward the focus gated by `peak`. The eruption needs it most.
2. **`LegendWorld.setConeBearing(deg)`** is never called; it defaults to 7, which matches Ember's cone today. The
   eruption's form is tied to the cone's shape in `massif.ts`.
3. **Sound.** Nothing here plays a sound. The beats already carry every hit (`moment` `step`, `miss`, `won`,
   `lost`). Two moments have no beat: the forge gate's roar (the frame `sim.mo.aux` becomes 1 with `mo.pace >=
   play.speed`) and a bell's swing (it is the `shatter` `step`).
4. **`world.ts`** (the pipe lane's): one call added, `this.marquee.stage(tier, reduced, fireworks, breaks)`, before
   `marquee.update`.
5. **Fireworks before the line** are sent on every finish, win or not, on top of a win's own finale. If that is too
   much at the line, drop the last volley in `climaxworld.ts` (`send(4, ...)`).
6. **The fifth mountain.** `VerbWorld.owns()` and `LegendWorld.owns()` leave follow, kindle, carry, `rising` and
   `lamplighter` to the stand-ins. The `lanternworld` lane can draw them with the same kit.

## Touched outside my files

- `src/render/world.ts`: the one `marquee.stage(...)` call, marked "Round 7, the momentsworld lane".
- Nothing else. The sub-lanes touched only this lane's files.

## Not finished, and fragile

- **Nobody has played any of it.** Whether the next target reads at 46 m/s, whether a pendulum can be read and
  threaded, whether the forge gate's flames are understood as a speed read: unknown.
- **The Caldera has no lake under the flight** and no smoke ceiling lit from below (W5). It is the brief's first
  place and it is the least met.
- **Variants were not each shot on every tier.** What was shot is listed under Frames. A hit was seen only where
  the pool rider or the hands-off sled made one: a surge cleared, a chase caught, a flourish landed, two bells rung,
  stomps, one gate threaded. A slide held, a ring line flown, a sprint won, a keystone reached and a row of stomps
  were not seen won.
- **Frame cost for the whole frame was not measured** by this lane's script (it read the last pass only). The kit's
  own counts above are exact; the places sub-lane saw about 100 calls on High and 45 on Low at its places.
- **The cranes** were not shot in a real flight, and the last two legend edits (cranes' size, the stag's hoofprints)
  were not reshot on High.
- **The legends' glows changed after their captures:** the kit's sprites went from added light to covering light
  (W1) after the sub-lane's frames were shot. The aurora, the eruption and the fleet use them and were not reshot.
- A stale `vite preview` on port 4522 (PID 23140) and an empty folder `C:\c` were left by a sub-lane; both were
  refused to it and were not removed by this lane either.
- Sub-lane commits carry a "Claude Opus 5.5" co-author line: they ran on that model after the lane's own hit its
  usage limit.

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\momentsworld\`

- `verbs\sheet-a-*.png`: the first cut on High, hands-off, variant 1 of each (the invisible one: kept as the before).
- `verbs\sheet-b-*.png`: High, hands-off, variant 2 of each, after the light was made to cover.
- `verbs\sheet-c-demo-*.png`: High, a pool rider who plays (the hits).
- `verbs\c-low\`, `verbs\c-phone\`: Low (variant 3 of each) and the phone on Medium.
- `verbs\d\`: the last pass.
- `legends\sheet-*.png`: each legend on High, the phone and Low.
- `places\final\sheet-high.png`, `sheet-low.png`, `sheet-phone-medium.png`: each place before and after.
