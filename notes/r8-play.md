# Round 8, the play lane: the new mechanics made readable

Render, UI and sound only: the sim, the bots and the pools are untouched. Everything here reads the sim's public state,
its events and `director.rivalEvents`, and nothing drawn feeds back.

Status: built, unit-tested, merged into `round-8` once (`f1931fc`) and seen in frames on desktop High, Low and the
phone, with a live showdown won, one lost and a steal on each. One fresh critic; its worst faults are listed below,
most of them still open.

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
  light). The medallion's floor is meant to be in CSS pixels (see "Open faults": it does not engage yet).
- Effects: every charm and trick effect throws about half as many particles on Low. Nothing new runs before the first
  frame: the gates' mesh, material and atlas are built on idle time and join the scene once compiled.
- Seen: desktop Low and the phone (Medium, 390x844 at DPR 2) ride the same gates, flight and live showdown as High
  (`v3/desk-low/`, `v3/phone/`). On the phone at 45 m the three outlines and glyphs read; the showdown's call is large
  and clear, but "Showdown: Bram Oakhollow" is clipped at both edges of a 390 px screen.

## Cost

- Draws: one (the gates and the marker), only while a gate or a marker is in reach (the mesh is hidden otherwise).
  Lamplit Path's sparks ride the spirit lights' existing batches. Tricks, signals and the ring add no draw.
- The material shares only single uniforms (the fog's three, the clock): no uniform array of vectors.
- Triangles: under 1,000 an arch instance submitted (two of its three families' tubes are clipped in the vertex
  shader), three to ten instances in reach.
- **Low's GL calls, as far as measured** (`glcount.js`, Pinecrest, z 200 to 510, a stretch with no gate in reach, two
  passes each, `v2/logs/gl-*.json`): after 492.2 and 489.7 calls a frame, before (the `round-8` commit under my merge,
  `f1931fc^1`) 455.2 and 455.2. That is not this lane's cost: the before build has no live field (its pools were still
  SIM 9) and the after build draws one, plus the spine's work. With no gate in reach this lane adds no draw by
  construction. **The in-build A/B with a gate in reach (`r8-glab.js`) did not give a number:** its first run jumped
  past gate 0, so gate 1 was never dealt and nothing was in reach (`v3/logs/glab-*.json`, identical on and off); its
  retargeting to gate 0 hung in the page and left a browser open, which the main lane closed. Reverted. What is known:
  the gates are one `drawElementsInstanced` under one program while in reach; the exact calls a frame are still owed.

## Critics

One fresh critic (Opus, high effort, given only ART.md, 41 frames in strips and the brief's question). A second was
not run: the main lane asked for the report first. Its five worst, worst first, with what I did:

1. **The gates cannot be read in time, and their colour means nothing.** Glyphs resolve at about 12 m; the side arches'
   order changes run to run (by design: the sim's seeded coin puts speed and style left or right, survival always in
   the middle); flat tubes and dark medallions fill the lens on the take; the names never say what the charm does; the
   lime and violet are "neon" with no gouache shading (ART.md 15, rule 3); and the gates stand on the line, against
   ART.md 14 ("nothing of it stands on the snow a sled rides"). *Open.* The medallion's size floor is the first fix
   (below); the shading, the take's dark slab and the "does" line are next. Whether a choice gate may stand on the
   line is ART.md's to settle.
2. **The showdown happens off screen.** The rival is never seen (100 m back); the pill swapped to another rider as
   "Showdown won" went up. *Fixed in part:* the result now owns the pill for 1.5 s as a duel's does (`13c0fb0`,
   tested). The capture rode level by pinning beside a rider and then outran it, which a person does not; whether a
   live showdown keeps its rival in view is a person's to judge.
3. **Stale prompts and a hidden landing ring.** "Tap as the ring closes" and "Steer in the air to spin" show on flat
   ground (the hints' own); the ring sits under the sled and the prompt pill. *Fixed in part:* the deep-grab warning
   ring now stands 1.3 times wider, solid and bright (`a18a739`); not yet seen in a frame.
4. **Airborne poses carry no height cue, and two read as wipeouts.** The pose frames hold the rider level on the snow
   (the pose lab's fault: it lifts the snapshot, not the shadow), so height cannot be judged from them; Fireside and
   Comet Tail read as crashes. *Open:* both want a lift and a clearer silhouette, judged in a real flight.
5. **The HUD crowds.** Up to four rows top centre, two banners at once, the phone's showdown line clipped, Low's time
   and distance run together. *Open:* the clipped line is mine (shorten it on a phone, or set it to fit); the rest is
   the shared HUD's.

Also named: the showdown's checkered banner reads as "the end of the run" mid-course; Old Wren drawn as a mint pillar;
kickers and rocks (not this lane's).

## Open faults

- **The medallion's size floor does not engage.** At 90 m the medallions are about 14 px where the floor (22 px half
  height, up to 2.15 times) should give about 30. My arithmetic and the frames differ by about 2.8 times; the probe to
  settle it (the camera's real projection, `uViewH`, the shader's px) is written and not run
  (`C:\Users\roger\AppData\Local\Temp\claude\6c2818e5e744a158\6216e3cb-6c46-44de-93a6-4987f889dfeb\scratchpad\probe2.js`).
  Until it is fixed, the glyphs read only near 12 m and the choice is made by colour and shape alone.
- **The showdown marker from far off.** Its light columns show at 40 m; at 150 m pale gold-white vanished against a
  bright sky. They now take a deep gold edge and fade only in their top part (`520a451`): not yet seen in a frame.
- The pose lab does not lift the shadow; Pine Bow stands but does not bow.
- The take callout names the charm but not what it does (`CHARMS[id].does` is there to use).

## The two things the first pass showed

- **Do the take callout and the arch's colour agree with the sim's pick?** Yes. Pinecrest: lane 0, "Falling Star", a
  blue pointed arch, the sim's `charms` [4]. Frostfang: lane 2, "Kite String", blue pointed, [2]. A unit test rides a
  real sim through each lane (`r8play.test.ts`). The first pass's mismatch was the capture, not the code.
- **The medallions at 90 m:** still too small (above).

## Touched outside my files

- `src/render/world.ts` (the gates, the trick input to the rider, Lamplit Path, the charm and rival effects),
  `props.ts` (Lamplit Path's sparks), `rider.ts` (the trick poses), `landing.ts` (window, warning).
- `src/game/director.ts` (beats for gates, synergies, showdowns, steals; "New"; the pill held on a showdown's rival and
  its result; the metronome on a first run), `beats.ts` (four beat types), `app.ts` (the lantern's signal bits).
- `src/ui/hud.ts`, `contract.ts` (`lantern.sig`), `style.css` (the lantern's signal classes).
- `src/audio/sfx.ts` (tricks, grabs, gates, synergies, showdowns, steals).
- Tests: `tests/r8play.test.ts` (new), `tests/director.test.ts` (a describe block and a `rivals` option on its rig).
- Scripts: `scripts/playtest/r8-play.js` (gates, flights, poses, a live showdown on a virtual clock), `r8-glab.js`
  (the gates' cost in one build; it has not yet given a number).

## For the main lane

- `charmsignals.ts` now reads the sim's public getters and `EMBER_STEP_TICKS` (the integration lane's change).
- With `round-8` merged in, the whole suite was green (89 files, 1,697 passed, 2 expected fails) before my last three
  commits; since then `tsc` and the touched files' suites (`r8play`, `director`, `beatsui`, `hudlogic`).
- My slips: `tile.mjs` run while my batch held a slot (a third browser for a few seconds), and `close-all` at the end
  of my first batch, which stopped the before set's Low on Lanternfall at 21 of 35 frames (re-shot by the main lane).
  Both are out of my scripts.
- Not done: a ghost's picks as a glyph on its tag, ghosts in glass taking the trick poses, Crane's Memory's gilded call,
  Bell Rope's ringing rails, Festival Drum's and Owl's Breath's signals beyond the combo chip's own.

## What only a person can judge

Whether the three outlines read in time to steer at 40 m/s (the critic says not yet); whether the offers line is read
or ignored; whether the grab tiers' ticks make the dare feel like a dare; whether the amber ring says "let go" rather
than "wrong"; whether a showdown feels like a fight when the rival stays in view; whether the poses read at speed.

## Frames

Under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/play/`: `v1/` the first High pass (before the merge);
`v2/` High's gates, six real flights (reach, tweak, wheel, spin, flip, twist), the eighteen poses and the first live
showdowns (its `low-*` frames are the phone's: they overwrote desktop Low); `v3/desk-high/`, `v3/desk-low/` and
`v3/phone/` the three gates of a run on Pinecrest (and Sakura's first on High), a reach flight, a live showdown won,
one lost and a steal on each; logs beside them.
