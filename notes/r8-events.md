# Round 8: the events lane (V6, every action is an event)

The item: a perfect landing, a dash, a ward, a pass and a finish should each feel like an event in the world, not a
line of type over it. The ground truth (DECISIONS 367): a perfect landing was a line of type and a puff the size of
the sled, and a clumsy fall threw more snow than a perfect. The snow lane (merged before this lane) rebuilt the
perfect's powder (a ring of billows and a veil) so a perfect throws more than a fall; this lane builds the event on top
of it and does not touch the snow's bursts. Render, UI and sound only: nothing here feeds the sim.

Branch `r8-events`, worktree `.claude/worktrees/r8-events`. Builds: `dist/r8-events-before` (round-8 at f784510) on
4770 and `dist/r8-events` on 4771 while working (both stopped at the end). Frames and raw output:
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/events/`.

## How the events were shot

Events happen in time, so every judgement here is on strips: `scripts/playtest/eventstrips.js` (new) replays a pool
rider as the player (`?demo=N`) on a virtual clock, as `stills.js` and `motion30.js` do, and shoots 8 frames from the
first frame whose sim tick is at or past the event's (a perfect every 3 steps, a dash, a ward and a pass every 4, a
finish every 20). `scan` mode rides a run in long steps and lists its events (the sim's landings, dashes, wards,
tumbles and crash read through `Run.drain`, the director's passes and finish with its place). `pbAt` gives the run a
best to beat; `gl` counts the GL calls of the frames after each shot; `wreck` ends a capture run in a fall with nothing
left (no pool record ends in a wreck when replayed as the player). The same tick is the same moment on both builds;
which ghost is in view still varies a little (ghosts replay in a worker on real time).

| Event | Run | Tick | What happens |
|---|---|---|---|
| perfect-a, perfect-b | Sakura, demo 0 | 708, 1088 | a perfect off a 2.35 s and a 3.78 s flight |
| dash-a | Sakura, demo 0 | 738 | a dash 0.5 s after the perfect |
| dash-b | Frostfang, demo 3 | 345 | a dash on the first straight |
| ward-a, ward-b | Frostfang, demo 0 | 784, 2877 | a ward taking a hit |
| ward-c | Sakura, demo 1 | 2872 | a ward taking a hit |
| pass-a | Sakura, demo 1 | 3106 | Juno Vale passed, the rider in a flip, the ghost by the lens |
| pass-b, pass-c | Lanternfall, demo 0 | 2565, 3255 | Rosa Quill passed in the cloud sea, Old Wren passed |
| finish-win | Sakura, demo 0 | 6232 | 1st of 6 |
| finish-c | Sakura, demo 1 | 10027 | 4th of 6 |
| finish-d | Lanternfall, demo 0 | 12484 | 6th of 6 |
| finish-pb | Frostfang, demo 3, `pbAt` | 8525 | 5th of 6, a best beaten |

## What a player sees, and why

1. **A perfect landing is felt in the world before it is read.**
   - *A held beat* (`timescale.ts` `STOMP_HOLD_SCALE`, `stompHoldS`; one line in `director.ts stomp()`): on the render
     channel, beside the stomp's existing feed hit-stop, the whole picture (the burst, the scarf, the lens's shake, the
     shockwave) holds at a tenth of its speed for 50 ms, up to 98 ms at five in a row. The impact is a held frame you
     feel, then the snow lets go. The sim is untouched; reduced motion plays none of it (`TimeScale` is a no-op) and
     keeps the beat.
   - *A shockwave in the snow* (`landing.ts`, the crater decal the perfect already presses): from the crater's own
     small shockwave a wave of heaved snow runs on to about 8.5 m in 0.55 s, its crest lifted powder lit on its sun
     side and its own periwinkle on the other with a cool trough behind it, white-gold for its first tenth of a second.
     While it runs the crater's grid is laid wide enough to hold it (24 by 24 cells), then drawn back. No new draw: it
     is the crater's own. The first build ran it from the lip with an echo ring; critic two read the crater's rings,
     the wave and the echo together as "a sonar ripple or a target decal" and, in one frame, as a pale band over the
     rider, so it now starts past the crater's ring, has no echo and a lighter crest (`fca0db6`, judged by me on one
     strip, not by a critic).
   - *Light running up the rider* (`rider.ts` `uRise`): a band of the snow's white climbs from the runners to the hat
     in a quarter of a second on the silhouette's edge (a twentieth of it over the dark cloth), so the stomp goes
     through the hero. Reduced motion: a soft glow over the whole figure that fades, no band moving. Low: none (see
     cost).
   - *Sound*: a low wash of snow opening as the wave runs (`sfx.ts perfect`), wider for a streak. The rumble's double
     tick stands.
   - With the snow lane's ring and veil of powder this is more than a fall throws (`tests/snow.test.ts` keeps the
     powder count; `tests/events.test.ts` keeps the wave's reach past a fall's burst).
2. **A dash is a transformation, and the world answers it.**
   - *Ignition* (`rider.ts`): the first frame of a dash runs a wider white-gold band up the rider, then round 6's spirit
     rim and bands hold. The first build lit the dark cloth at a fifth and bleached the coat to peach in every dash
     frame; it is now on the edge only, at 0.6.
   - *The world cools* (`post.ts uCool`, from `spirit.ts coolK` on the rider's eased shimmer): everything but the
     rider leans to a colder, quieter blue (three fifths of its colour kept), the frame round the rider untouched, so
     the white-gold spirit is the warm thing in the frame. At under half its colour, critic one read Sakura's sky as
     "flat grey-lavender"; eased to 0.6 of the effect. High, Medium, Ultra and the phone; Low has no post pass.
   - *Hazards ghost as you pass* (`spirit.ts dashPass`): every hazard the dashing rider draws level with inside 6 m
     turns to spirit once, a column of pale white-gold glass motes over its footprint up its height; the one the sim
     says you rode through (inside 0.7 m) throws a ring at its foot and a beat of light. The hazard itself stands (its
     collider never moves).
   - *Spirit wisps* off the shoulders and hat, rising as they fall behind (not on Low).
   - *Sound*: a thin cold air high over the dash's whoosh. *Rumble*: ignition, then a light hum (`rumble.ts`).
3. **A ward breaks so it reads at 40 m/s and from behind** (`wardfx.ts`). The paper lantern stands a size larger
   (1.08 m round, 1.8 m tall), so from the chase lens it stands out past the shoulders and over the hat, where it
   reads; its shards fly out to the sides and up (out at 3.4 to 7 m/s, more to the side), keep 0.95 of the sled's
   pace (at 0.88 a shard fell back 5 m a second at 40 m/s, under the lens in a blink), live 0.85 to 1.35 s and stay
   lit paper (critic one called the first build's "flat yellow card"); the ring of light runs to 8.5 m. *Sound*: the
   shards' fall of bright ticks after the crack. *Rumble*: the crack, then a lighter scatter.
4. **A passed ghost starts and comes apart** (`ghosts.ts`, `particles.ts ghostMotes`). On the pass beat its glass
   flares in its kind colour (`uGlow` up 2.6 times, easing back), it rocks back on its sled with its arms flung up and
   out, and for half a second motes of its kind colour (mint, rose for a grudge, gold-white for your best) stream off
   it and hang back past the rider. The pass rule fires with the ghost a little behind the rider, often beside the
   lens, so the motes leave from level with the rider, a metre out from the ghost's far side and from its waist down
   (critic one saw the first build's motes against the rider's chest). Reduced motion: no start, the flare and the
   motes stay. *Sound*: a glassy fizz falling away behind the pass's whoosh.
5. **The finish is scaled to the result** (`moments.ts finishScale`; the director's finish beat now says `pb`).
   - *A win* (1st) is a festival: every shell of the square's show, the confetti cannons, ribbons at 30 a second, the
     win's own show and finale (`spirit.ts`, unchanged), and the town's lamps lit with lanterns let go.
   - *A best beaten* (`pb`: faster than your best's finish, or a finish where your best did not; a first finish is not
     one) lights the town: eight lamps light one after another down the square ahead (20 to 85 m on, just inside the
     barriers), each a beat of warm light and a held orb, every other one sending up a low willow of the lantern's
     marigold opening to white-gold, and 44 lanterns let go over the run's edges. *Sound*: a soft bell a lamp,
     climbing the chord.
   - *A podium* (2nd, 3rd): seven shells, cannons, ribbons. *An ordinary finish* is warm: three low willows of warm
     light, a few ribbons, lanterns, no cannons.
   - *A wreck* is gentle: no shells, the crowd's roar let go, the snow it threw settling round the rider for three
     seconds (none under reduced motion).
   - *Rumble*: a roll over the line. The lamps and lanterns keep real seconds (on the finish's eased clock the lamps
     were still lighting when the results came up). Lamp willows light nothing round them and a win sends none, after
     critic one read two finishes as "a gold floor" drowning the rider.
6. **Ghosts in glass take the trick poses** (`ghost.worker.ts`, `ghostdata.ts packTrick`, `game/ghosts.ts`,
   `render/ghosts.ts`). Each airborne sample of a ghost's trajectory now carries its trick, grab side and tier, packed
   over the flags (bits 8 to 16; a Float32 holds them exactly; an older trajectory reads as no trick). In the air the
   glass takes the rider's pose from `trickpose.ts`, cheaply: the body's fold, roll and lift and how high each arm is
   raised (`uShoulder.w` raises one arm over the other), eased in as fast as the rider's. No new draw or uniform
   array; one pose worked out a frame per airborne ghost. **Not seen in a frame**: no strip caught a ghost tricking in
   view; only the packing is tested.

## The critics (blind pairs of strips, High, desktop, 1280x720)

Each image is a 2x2 sheet of a strip's frames 0, 2, 4, 6 (`events-lane/sheet.sh` in the session scratch, ffmpeg), so
a critic sees the moment in time. Pairs by `blind-pairs.mjs` (new side seeded), key outside the pairs folder. Each
critic was a fresh general-purpose agent on Opus at high effort, given only ART.md's path, the pairs folder, that each
sheet is four frames in time order, and the brief's question ("which makes this moment feel like an event, and which
is the better picture").

| Critic | Build | Pairs | New picked | Key, picks |
|---|---|---|---|---|
| 1 | `2cc4205` | `shots/r8/events/pairs1/` (seed 7) | **5 of 10** | `keys/pairs1.json`, `keys/picks1.json` |
| 2 | `abcf3c0` (critic one's fixes) | `pairs2/` (seed 11) | **6 of 10** | `keys/pairs2.json`, `keys/picks2.json` |

**The bar (8 of 10) is not met.** What the critics said:

- *Critic one* named the event in the new sheet on 8 of 10 (the perfect's crater and rings "the stomp ART.md asks for",
  the ghost shattering "instead of just sliding off the frame", the ward, both finishes "the louder event") but picked
  the old picture on five: the dash's cooled sky as "flat grey-lavender" with the head in "a bleached marigold haze";
  the ward with a passing ghost's mint burst against the rider's chest; both finishes as "a gold floor" with the
  rider sunk in orange. All four were fixed in `abcf3c0`.
- *Critic two* picked the new sheet for the dash on the straight, the second ward, both passes and the best beaten, and
  the old for both perfects (the wave "four or five even concentric bright rings ... a sonar ripple or a target
  decal"; in the other "the ring draws over the hero"), the first dash (near identical, the old "throws more spray")
  and the win (near identical). The perfect's wave was then rebuilt as one wave past the crater's ring (`fca0db6`);
  not re-judged.
- Both critics named things that are not this lane's in nearly every pair: near-lens blossom as flat pink slabs,
  ghosts as "a stack of mint spheres", the finish lens never swinging to the front, the checks glowing gold, the
  Sakura finish's horizontal light bar, a white faceted sled at Lanternfall, flat periwinkle patches, crowded pills.

**What the loop says.** The events are seen: both critics named the event in the new sheet more often than the old.
Where a new sheet lost, it was mostly for washing the hero or the frame (fixed) or for a shape (the rings). The strips
also differ by more than the change: which ghost is in view and where its pill sits (the field replays on real time),
and on Sakura a coincident pass with the first perfect and ward. A third critic on the last build is the next step.

## Cost

- *Draws and programs*: none new on any tier. The shockwave is the crater decal's own draw; the motes, lanterns, lamps
  and hazard glass ride the two particle layers; the dash's cool is one uniform in the composite; the ward is its own
  instanced draw as before (same 51 instances); the lamp willows are fireworks' own batch. The rider gains one `vec4`
  uniform (`uRise`), the crater one float (`uExt`), the ghost materials' `uShoulder` widens to a `vec4`. No uniform
  array of vectors anywhere. No shader program added (the composite and the rider's and crater's programs change).
- *Low's GL calls in a held event frame* (`eventstrips.js gl`, the average of the 3 or 4 frames after each shot, the
  same tick on both builds, `shots/r8/events/lowfinal/`):

  | Event (frames 1 to 4 after the shot) | Before | After |
  |---|---|---|
  | perfect-a (Sakura 708) | 522, 508, 510, 504 | 652, 529, 507, 508 |
  | perfect-b (Sakura 1088) | 469, 446, 448, 564 | 473, 559, 447, 452 |
  | dash-a (Sakura 738) | 506, 510, 507, 507 | 519, 519, 514, 508 |
  | ward-a (Frostfang 784) | 604, 503, 490, 489 | 630, 525, 511, 509 |
  | finish-pb (Frostfang 8525) | 459, 455, 457, 455 | 461, 460, 459, 458 |

  The counts swing by about 110 a frame on both builds (perfect-b's 564 before and 559 after fall on different
  frames: a periodic task, the far shadows' 0.4 s look or a ghost's tag, not the event), so a single frame is not
  evidence. Read as a whole: perfect level outside its first frame's spike, finish +3, **dash about +8 and ward about
  +20 over the 2-call bar**. The dash's was the light each ghosted hazard pushed (a painted pool's draw on Low), taken
  off on Low in `abcf3c0` after this count, not re-counted. The ward's +20 is not explained by anything this lane
  draws on Low (the same instanced draw, the same light); the likeliest is which ghosts are in view at that tick
  (each ghost is about ten calls) and a recount over several runs should settle it. **Not met as measured.** The
  first build's light running up the rider added about 10 to 15 calls a frame on Low (a changing uniform on every
  rider material), so Low has none (`fafcd8d`).
- *Script*: per frame, nothing while no event plays. During a dash: a scan of two chunks' obstacles; during a pass:
  up to 8 motes a frame for half a second; in the air: one `trickPose` per airborne ghost (pure arithmetic, no
  allocation). `systime.js` was not run.
- *GPU* (`?gpu`): not measured. The composite gains a branch taken only while a dash burns; the crater's grid is laid
  wider for 0.55 s after a perfect (a larger decal with an early discard outside the wave).
- *First frame*: nothing new runs before `gs-first-frame`.
- *Console*: clean in every capture (27 runs on High, Low and the phone, both builds; the JSON beside each strip
  carries the page's errors and warnings, none).

## Low and the phone

- **Low** gets a designed, cheaper version: the shockwave in the snow (the same decal, Low draws craters), the held
  beat, the ward's larger lantern and shards, the passed ghost's flare and start with fewer motes (four tenths, through
  the budget), the hazards' glass without a light each, the finish's scaling (fewer shells through Low's own rule,
  lanterns and lamps through the budget), the ghosts' trick poses (Low's glass has the ghost's motion). Not on Low: the
  light running up the rider (Low keeps round 7's thin rim flash and the dash's own rim and bands), the dash's cooling
  (Low draws no composite pass), the dash's wisps. Frames: `shots/r8/events/low1/`, `lowfinal/`.
- **The phone** is Medium: everything High has; the dash's cooling shows strongly on a tall frame (`phone1/`).
- **Reduced motion** keeps every beat and drops the motion: no held beat, no shockwave hold, the light up the rider a
  still glow, no ghost start, no lanterns drifting and no settling snow; the flares, the lamps' light, the cooling and
  every sound stay.

## Touched outside my files

- `src/game/director.ts`: one line in `stomp()` (the render hold); the finish beat carries `pb`; the log entry for
  `finish` records place and `pb` (for strips and telemetry).
- `src/game/beats.ts`: the finish beat's optional `pb`.
- `src/render/landing.ts`: the crater decal's shockwave and wider grid (the play lane owns the landing ring there; the
  crater is untouched otherwise).
- `src/render/post.ts`: `params.cool` and `uCool` in the composite (four lines of GLSL).
- `src/render/world.ts`: one line, `pp.cool = ... this.spirit.coolK(this.dashK)`.
- `src/render/fxhub.ts`: the `SnowSink` gains `ghostMotes` (type-only import of three's `Color` and `Vector3`).
- `src/game/ghostdata.ts`, `src/game/ghosts.ts`, `src/workers/ghost.worker.ts`: the trick packed over a trajectory's
  flags and read into `GhostPose` (`move`, `grab`, `tier`). No sim, bot or pool file changed.
- `src/audio/sfx.ts`: four sounds added inside existing cues (the perfect's wave, the dash's cold air, the ward's
  shards, the pass's fizz) and `townBells`.
- `tests/pad.test.ts`: its table expects the ward's and the dash's second pulse.
- `scripts/playtest/eventstrips.js` (new).

## For the main lane to decide or wire

- Nothing to wire: every effect is reached through the existing beats and events.
- **A machine fault to know about**: the session scratch folder is shared by every lane of this session. The speed lane
  wrote its own `strips.sh` and `scan.sh` over mine there (`scratchpad/strips.sh`, 02:53 on 21 November), and two of my
  runs (about 02:55 and 05:14) invoked the speed lane's script with my arguments: it drove a `playwright-cli
  -s=r8-speed` session at `127.0.0.1:4750` with a nonsense config, without taking a slot, for one iteration each. If
  the speed lane saw an odd `goto` or a failed strip then, that was it. My helpers now live in `scratchpad/events-lane/`.
- Decide whether a best beaten counts on a first finish (now: no, there is nothing to beat) and whether the town's
  lamps should be the town's own windows brightening (the light lane's lamps) rather than effects over the square.
- The ward's Low count (above): a recount over several runs at the main lane's sitting.

## Still short

- **The bar: 5 and then 6 of 10, not 8.** The last build's perfect (one wave, no echo) was not re-judged.
- **The wreck** has no strip: no pool record ends in a wreck when replayed as the player, and the strip script's forced
  fall (`wreck`) at Pinecrest 2000 caught a rider at rest. The gentle wreck is seen only in code and the unit table.
- **Ghosts' trick poses** were never caught in a frame.
- **A best beaten lighting the town** reads only weakly by day: lamps 20 to 85 m off are small motes, and the willows
  carry it. The town's own lights (windows, lamp posts) brightening would read better and are the light lane's.
- The hazards ghosting during a dash were not caught clearly in a strip (the Sakura dash passes blossom 6 m off).
- Low's GL calls for the ward (+20) and the dash (+8 before the fix) are over the 2-call bar as measured.
- The finish lens never swings to a three-quarter front in these strips (both critics named it); that is the
  camera's, not this lane's.

## Text to fold into ART.md and the README

> **Round 8: every action is an event.** A perfect landing holds the whole picture for a beat (50 ms, longer for a
> streak) and runs a shockwave of heaved snow out from the crater to about 8.5 m, a lit crest with a cool trough,
> white-gold for its first instant; a band of the snow's white runs up the rider's edge. A dash ignites the rider with
> a band of white-gold, cools the world round it (everything but the rider leans to a colder, quieter blue) and turns
> every hazard it passes inside 6 m to pale glass motes, the one it rides through with a ring at its foot. A ward's
> lantern stands larger than the rider so it reads from behind, and its shards fly out to the sides, lit paper keeping
> the sled's pace. A passed ghost flares in its kind colour, rocks back with its arms flung up and comes apart into
> motes of its colour from its far side. The finish is scaled to the result: a win is a festival (every shell, the
> cannons, the win's finale), a best beaten lights the town (lamps lighting down the square, each with a low willow of
> marigold, and lanterns let go), a podium a smaller show, an ordinary finish warm (three low willows and lanterns),
> and a wreck gentle (the snow settling round the rider). Ghosts in glass take the rider's trick poses. Low keeps every
> beat but the light up the rider and the cooling; reduced motion keeps every beat and drops the motion.

## Where the frames are (all under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/events/`)

- `scan/`: each demo run's events (`scan` mode JSON).
- `strips1/` (first build) and `strips3/` (`8f6e934`), before and after, High; `strips3/sheets/` the 2x2 sheets; the
  before sheets the critics saw are `strips3/sheets/before/high/`.
- `final/` (`2cc4205`) and `final2/` (`abcf3c0`), after, High, with `sheets/`; `final3/` (`fca0db6`), the perfects.
- `pairs1/`, `pairs2/` and `keys/` (the keys and picks).
- `low1/`, `lowfinal/` (Low with GL counts), `phone1/` (the phone, Medium).
