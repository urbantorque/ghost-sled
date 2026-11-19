# Round 8, the play lane: the new mechanics made readable

Render, UI and sound only: the sim, the bots and the pools are untouched. Everything here reads the sim's public state,
its events and `director.rivalEvents`, and nothing drawn feeds back.

Status: built, unit-tested and committed. Frames: one pass of the gate approach on desktop High (Pinecrest) before the
machine went down; the rest of the capture (Low, the phone, flights, poses, the showdown) and the critics wait for a
browser slot (see "Still to do").

## What a player gets, and why they would feel it

1. **Charm gates you read by steering** (`src/render/charmgates.ts`, `charmglyphs.ts`). At each gate three arches stand
   one a lane. A family is a shape and a colour: speed a pointed arch in azure `#4DA6FF`, style a round arch in orchid
   `#D07BFF`, survival a square arch in leaf `#7ED957`. None of them is a locked role (mint, vermillion, marigold, rose,
   gold-white, amber; `tests/r8play.test.ts` holds a 30 degree hue gap from each). Over each crown a medallion in the
   same outline carries its charm's glyph (24 pictograms, an atlas drawn on idle time). The medallion holds a floor of
   size on screen up to a little over twice its own, so the three outlines read before the glyphs, and the glyphs before
   the lane change has to start. A faint veil of the family's light fills each opening, so a lane reads as a door, not a
   hoop. *Why:* the choice is made by steering at 40 m/s; the eye needs the family before the name.
   - The next gate breathes and burns brightest; later ones wait dimmer; the arch you ride through answers with light
     (it burns toward white in its own colour and is gone) and the other two gutter to an ember dark. Reduced motion:
     no breath and no swell, the light alone says it.
   - As a gate comes up (280 m out) the callout names its three offers left to right as the arches stand ("Comet's Tail
     · Second Wind · Owl's Breath"), with three soft notes panned left, middle, right. A charm taken is called by name
     with a chime in its family's voice and a ring of its colour off the crown. A named pair is called once, as its
     second half is taken, with a ring of white-gold round the rider and the bright chord a step up.
   - Once held, a charm's one signal is the only thing that says so (`src/game/charmsignals.ts`): on the lantern itself
     Comet's Tail drops the ward ring, Stone Lantern draws the cells in halves, Ember Step pulses while the half price is
     open, Hearthstone outlines the cell it owes, Featherfall puts a feather on the lantern while the stage's spare is
     held, Last Lamp an ember in the empty lantern, Slipstream Lantern leans the light forward while drafting. In the
     world: Lamplit Path's sparks on the safe line (drawn in the spirit lights' own batches; never a spark the sim did
     not lay), Guardian Wisp's wisp circling the rider until spent, Kite String's thread to the ghost drafted, Frost
     Runners' blue sparks on ice, Falling Star's streak off a big landing, Whirlwind's ring of snow off a spin, Paper
     Kite's ribbons at each grab tier, Bark Skin's snow shed on a bump, Quick Feet's spring, Drift Drum's beating ring,
     Long Stride's wind line in a tuck. No list, no corner icons: the HUD does not grow.
2. **Tricks you can see, hear and name** (`src/render/trickpose.ts`, `rider.ts`, `sfx.ts`). Every trick id has a pose
   from the design's line: a hand on the rail (its side), an arm straight up for a Lantern Reach, laid out flat for a
   Spirit Stretch, both hands on the rail for a Paper Wheel, folded to the nose for a Crane Fold, a corkscrew for an
   Ember Twist, the sled shoved out against the grab for a Crosswind, a hand left on the rail's end for a Lamppost Swing,
   the sled on its edge for a Snow Hare, and the six sleds' own (standing in a bow, sitting still while the saucer spins
   under, lying back with hands behind the head, streamed out behind the runner, floating, turning the tray). Poses ease
   in fast (a grab is a snap of the hand) and let go at touchdown. The callout says the trick's own name ("Paper Wheel
   360", "Late Crosswind"), with "New" the first time in a run. Sounds: a cloth flick as the hand finds the rail, a tick
   that climbs with each grab tier (the dare counted out), a twang for a tweak; on landing a voice per family (plucks for
   grabs, two bells and a rush for combinations, steel for a rail's end, a thump for the wall's bound, three notes of
   each sled's own), a shimmer on a new trick, a bright tink on a late Crosswind and a low bell under a deep grab landed.
3. **A deep grab near the snow reads as danger** without a new element: the rider strains (a tremble, the head down to
   the snow, the free hand clawing; the tremble off under reduced motion) and the landing ring turns the clock's amber
   (ART.md 1: amber is time) and throbs; in the stomp window it burns gold inside an amber edge, because letting go there
   is a stomp.
4. **The first run's wider stomp window** (`landing.ts` `stompWindowS`): the gold flash keeps to the sim's own window,
   `FIRST_RUN_STOMP` ticks on a save's first run, 9 otherwise, so a first-timer who presses on the flash is right; the
   stomp metronome's ticks move with it so the open tick still lands on the flash.
5. **Showdowns and the steal** (director beats from `rivalEvents`). A start is a moment: a rush into two low brass notes
   and a bell, then the rider's own motif if they have one, "Showdown: Old Wren" in the callout, and a finish banner 300
   m ahead (two posts of gold-white light, ink and cream checks, a band of the rival's colour), findable from the start
   of the race. While it runs the rival pill names the rival (an open duel still takes it), so who leads is the pill's
   gap. Won: the banner bursts in the lantern's marigold, motes run into the rider, a short fanfare; the sim's own line
   says "Showdown won +1,000" and lights the cell. Lost: the banner bursts in the rival's colour, two falling bells,
   "Old Wren took the showdown". A steal pulls a thread of the ghost's own light into the rider, turning marigold, with a
   rush drawn in and a glassy tink; the sim's line says "Wisp stolen +300".

## Low and the phone

- Gates: the same one draw, the same glyphs and veil; the tubes are a flat two-value poster (no core line, no running
  light). The medallion's floor is in CSS pixels, so a phone's small screen keeps the outline readable.
- Effects: every charm and trick effect throws about half as many particles on Low. Nothing new runs before the first
  frame: the gates' mesh, material and atlas are built on idle time and join the scene once compiled.

## Cost

- Draws: one (the gates and the marker), only while a gate or a marker is in reach (the mesh is hidden otherwise).
  Lamplit Path's sparks ride the spirit lights' existing batches. Tricks, signals and the ring add no draw.
- The material shares only single uniforms (the fog's three, the clock): no uniform array of vectors.
- Triangles: under 1,000 an arch instance submitted (two of its three families' tubes are clipped in the vertex
  shader), three to ten instances in reach.
- **Not yet measured in a browser** (`glcount.js` before and after on Low, `systime.js`): waits for a slot.

## Touched outside my files

- `src/render/world.ts` (the gates, the trick input to the rider, Lamplit Path, the charm and rival effects),
  `props.ts` (Lamplit Path's sparks), `rider.ts` (the trick poses), `landing.ts` (window, warning).
- `src/game/director.ts` (beats for gates, synergies, showdowns, steals; "New"; the pill held on a showdown's rival; the
  metronome on a first run), `beats.ts` (four beat types), `app.ts` (the lantern's signal bits in the HUD model).
- `src/ui/hud.ts`, `contract.ts` (`lantern.sig`), `style.css` (the lantern's signal classes).
- `src/audio/sfx.ts` (tricks, grabs, gates, synergies, showdowns, steals).
- Tests: `tests/r8play.test.ts` (new), `tests/director.test.ts` (a describe block and a `rivals` option on its rig).
- Script: `scripts/playtest/r8-play.js` (new).

## For the main lane

- `charmsignals.ts` reads five of the sim's private fields (`lastPerfect`, `hearthOwed`, `featherStage`, `lampStage`,
  `wispStage`) through a narrow cast, for drawing only. Public getters on `Sim` would be cleaner when the sim next
  opens.
- The suite on this branch has the same 30 failures as its base (stale SIM 9 pools and the sim lane's moved courses:
  `ghostpool`, `slowriders`, `nearmiss`, `fairness`, `graveyards`, `overlook`, `palette`, `setpieces`, `simfix`,
  `reel`); none is this lane's. With the pools stale the live field is empty, so no showdown or steal can be ridden
  until they are regenerated; the beats are unit-tested and the marker can be staged (`r8-play.js` job `showdown`).
- Not done: a ghost's picks as a glyph on its tag (labels.ts), ghosts in glass taking the trick poses, Crane's Memory's
  gilded call (it would borrow gold-white or need a new callout tone), Bell Rope's ringing rails (needs the rails'
  approach in the audio), Festival Drum's and Owl's Breath's signals beyond what the combo chip already shows.

## What only a person can judge

Whether the three outlines read in time to steer at 40 m/s; whether the offers line is read or ignored; whether the
grab tiers' ticks make the dare feel like a dare; whether the amber ring says "let go" rather than "wrong"; whether a
showdown feels like a fight; whether the poses read from the chase lens at speed.

## Frames

`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/play/` (`v1/`: the first gate pass on High).
