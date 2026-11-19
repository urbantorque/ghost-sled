# Round 8, the sim lane: the design for SIM_VERSION 10 (phase 1)

What lands in the one sim batch, designed together because it shares one input: a steer and an action button (keys,
mouse, touch and pad), the existing draft and spirit bits, and the line ridden. The input byte does not change.
Status: a design and a prototype of the air map (below, "What the prototype showed"). Nothing else is built yet.
No pools were regenerated.

Contents: 1 the input map and the tricks (G1); 2 charms (G2); 3 config, record and migration; 4 showdowns and the
spirit steal (G3's record part); 5 Spirit Flow (G6); 6 also in the batch; 7 the bot; 8 the lab and the bars; 9 what
the prototype showed; 10 risks and what is cut first; 11 open choices for the main lane.

---

## 1. The input map and the tricks (G1)

### On the snow (unchanged)

| Input | Does |
| --- | --- |
| Steer | Carve; held hard and long, a deep carve (style) |
| Button, steer straight | Crouch: the tuck (less drag); held 10 ticks or more, a charged pop on release |
| Button, steer to a side, over 9 m/s | Drift; tiers charge; release pays a boost (and pops if charged) |
| Release at a lip | A pop off the lip (coyote 6 ticks) |
| Spirit button | A dash (a full lantern) |
| Draft bit | Set by the game layer from the ghosts (see 4: the same rule moves to a pure module) |

### In the air (new, in `src/sim/tricks.ts` and `Sim.airTricks`)

The one rule a player learns: **what the steer is doing when you press decides the trick; holding is the dare;
letting go into the landing is the stomp.**

- **Steer** spins, as ever (rate 9 rad/s, the landing set stops it).
- **Press with the steer to a side** (a side, |steer| >= 0.5, in the press's first 4 ticks: a key pressed with the
  button reaches 0.5 on its third tick) **grabs on that side**. Held, it climbs three tiers: 0.25 s, 0.67 s, 1.25 s.
  While grabbing: steering *with* the grab's side spins (at 80%), *centred* holds still, *against* it **tweaks**.
- **Press with the steer centred** and hold: at 7 ticks it is a **flip**, as today. A steer found after the grab's
  4-tick latch but before or during the flip spins on the flip (an Ember Twist).
- **Let go of a grab in the last 9 ticks before touchdown: a stomp** (a perfect landing), exactly as a press there
  is. Let go earlier and you need a press to stomp.
- **Still holding a deep grab (tier 2 or 3) at touchdown is a fall** on a committed flight (0.75 s or more; the
  lantern wards it as any fall), and sketchy on a short one. A short grab (tier 0 or 1) still held is let go by the
  rider as it lands: clean, never a stomp. A first-timer's thumb on the button through a landing is a short grab
  almost always (measured below).
- **Two quick taps with the steer centred** (the first 6 ticks or less, the second within 12): the sled's own move
  (its signature), held like a grab.
- **The button within 24 ticks of leaving a rail's end, or a wall ride:** that place's own move.
- Nothing starts in the last 20 ticks (the existing FLIP_GUARD_TICKS): a press there is only a stomp.
- A flight's tricks are named once it lands, from everything done in it, so a sequence of simple gestures is a
  named combination: flip, let go past its half (it comes round by itself), grab: a Crane Fold.

### The tricks

Points are the prototype's (see 9: they need cutting to about half for the grabs and the combinations). Every trick
pays its points into the combo with its own repeat cut (keyed by the trick's id, not "spin"), lights the lantern by
its own units, and pays half again the first time it is landed in a run (the call says "New"). Sketchy halves it.

| id | Name | How | Pays (prototype) | Risk | Pose (for `rider.ts`) |
| --- | --- | --- | --- | --- | --- |
| 1 | Spin (180, 360, 540, 720) | Steer | 150 a half turn, +25% each more (as now) | Yaw at touchdown | Upper body wound into the turn, arms in, sled flat |
| 2 | Backflip (Double) | Hold, centred | 600 a flip (as now) | Pitch at touchdown | Tucked, knees to chest, both hands on the sled |
| 3 | Rail Grab | Press to a side, hold 0.25 s | 200 | None held (let go as it lands) | Knees bent, one hand on the side rail, the other out |
| 4 | Lantern Reach | A grab held 0.67 s | 500 | Held at touchdown: a fall | One hand on the rail, the other arm straight up as if hanging a lantern |
| 5 | Spirit Stretch | A grab held 1.25 s; +400 a second past | 900 and up | Held at touchdown: a fall | One hand on the rail, body laid out flat beside the sled, legs trailing |
| 6 | Paper Wheel | Spin and grab in one flight | (spin + grab) x1.3 | Both | Crouched, both hands on the rail, sled spinning flat |
| 7 | Crane Fold | Flip and grab in one flight | (flip + grab) x1.3 | Both | Folded over the sled, a hand on its nose, legs tucked |
| 8 | Ember Twist | Spin and flip in one flight | (spin + flip) x1.2 | Both | Off-axis corkscrew, shoulders leading |
| 9 | Spirit Knot | Spin, flip and grab | sum x1.6 | All three | Balled up, one hand on the rail, tumbling off axis |
| 10 | Crosswind | Steer against a held grab, 8 ticks | 300; late (inside the last 0.5 s) 700 | It is a held grab: let go in time | Sled shoved out sideways against the grab, body leaning away |
| 11 | Lamppost Swing | Press just off a rail's end | 500 | Swings a half turn: a short flight lands it sideways | One hand left on the rail's end, the sled swung round it |
| 12 | Snow Hare | Press just off a wall ride | 450 | Bounds you 3 m/s back into the run | Both legs kicked toward the wall, sled on its edge |
| 13 | Pine Bow | Double tap, Pine Flyer | as a grab | as a grab | Standing on the sled, a slow bow, arms out |
| 14 | Spinning Top | Double tap, Whirl Saucer | see below | | Sitting still while the saucer spins flat under the rider |
| 15 | Fireside | Double tap, Lodge Toboggan | | | Lying back, hands behind the head, boots up |
| 16 | Comet Tail | Double tap, Comet Bob | | | Let go, trailing from one runner, body streamed out |
| 17 | Will-o'-Wisp | Double tap, Wisp | | | Floating a hand above the sled, both hands off |
| 18 | Teacup | Double tap, Tea Tray | | | Cross-legged, turning the tray slowly with both hands |

Eighteen named tricks, twelve open to every sled. Names are original to this world or plain sport words ("Spin",
"Backflip", "Crosswind"); the main lane should still check "Crosswind" and "Spinning Top" against the big trick
games once.

**The signatures, each a sidegrade like its sled's trait** (phase 1 pays them all as a grab of the same hold, x1.2;
these are the rules to build). None touches speed or the lantern beyond what any trick lights, so nothing bought
buys time:
- *Pine Bow* (balanced): pays as a tier-2 grab from its first tick, tiers as a grab; it cannot be stomped by letting go.
- *Spinning Top* (spins): while held the saucer spins at full rate with no steer (the steer is free for air control);
  each half turn pays x1.5, but the set cannot stop it: let go 14 ticks early or land sideways.
- *Fireside* (forgiving): held at touchdown it is sketchy, never a fall; pays only to tier 2.
- *Comet Tail* (speed): tiers 30% sooner and pays x1.3, but held at touchdown is a fall from tier 1, not 2.
- *Will-o'-Wisp* (draft): pays as tier 3 from tier 2, but no air control and no spin while held.
- *Teacup* (dash): a slow spin at half rate that the set always lands; each half turn pays x2.

**Where a person must judge it:** whether "press decides" reads on a keyboard (a key pressed with the button is a
grab; a key pressed after it spins the flip), whether 0.67 s is the right place for the dare to start, and whether
letting go into the landing feels like a stomp.

---

## 2. Charms: every run is a build (G2)

### The gates

Three spirit gates stand across the course **three times a run**: on the start's run-in (z 110, before its swinging
light line) and 60 m past each stage line. Each gate is three arches side by side; **the arch you are in as you cross
the gate's line is your charm for the rest of the run**: no menu and no stop. Everyone takes exactly one: a lane is
decided by x alone (a rider in the air, wall riding or in a fall too; a fall eases the rider to the safe line, so a
faller takes the middle).

- **Lanes:** the middle arch is centred on the safe line, 4.6 m wide; the outer two are 4.6 m either side and their
  lanes run on to the walls. **The middle is always the survival family's offer** (the line keeps you safe: a
  rider who does nothing takes it), speed and style on the sides, which side by a seeded coin.
- **Fair reach:** a gate needs about 100 m of plain, wide snow before it (at 30 m/s a lane change of 4.6 m wants
  about 1.5 s and the arches must read for 3 s). The probe in this lane found the start always fine (half-width 16 to
  21 m at 100 m) but **no fair window within 500 m of a stage line on 3 of 10 courses** once set pieces and narrow
  places are kept out. So the course must make one: **a threshold at every stage line** (my recommendation; open
  choice 1): the course writer lays a calm section from 40 m before each stage line to 140 m after it (half-width
  10 m or more, no features, no set piece, a `clear` band over the whole width from the gate's 100 m approach to 15 m
  past it, as `layBands` does for a leap's landing). The look lanes get a composed stage start out of it (V3 asks for
  one). The fallback is a search from 250 m before the line to 500 m after it plus a forced clear band, which needs
  no new section but leaves some gates in a 6.5 m chute.
- **The fairness suite** gains: every gate on every named course and 200 random ones has half-width 9 m or more over
  its approach, no obstacle, ramp, mogul, drop, rail, vent or ice in it, no set piece or legend within 30 m, and each
  lane's centre reachable from the safe line (the existing "line holds" check run to each lane).
- **Read from far:** the gate is placed by the sim; the render lane draws three arches and the three charms' glyphs.

### The offers and the pool

- `SimConfig.charmPool` is a 24-bit mask of the charms this rider may be offered (the Almanac widens it). Absent, it
  is `STARTER_POOL` (six: two a family). The record carries it (3).
- At gate g the sim draws, from `hash32(chaos.seed, g, 0xc4a2)`, one charm of each family from the pool minus what is
  already held. A family with none left is filled from the others. `offersFor(chaosSeed, gate, pool, held)` is a pure
  export, so the HUD, the bot and a ghost's replay see the same three.
- Effects stack across the three picks. A charm is never offered twice in a run.
- Events: `{ type: 'charm', gate, id, lane }`; public `sim.charms` (ids in pick order) and `sim.gates` (where they
  stand and what each lane offers this run, for the renderer). A ghost's arches are the player's (they are the same
  places); its picks are its own offers, which the HUD can show as a glyph on its tag.

### The 24 charms

"Signal" is the one thing on screen that says the charm is working (the presentation lanes' to draw).

| # | id | Family | Name | What it does, in sim terms | Signal |
| --- | --- | --- | --- | --- | --- |
| 0 | `slip` | Speed | Slipstream Lantern | Drafting lights the lantern: 0.6 units a tick while drafting (a cell in about 2.8 s) | The lantern's flame leans toward the ghost ahead as it fills |
| 1 | `comet` | Speed | Comet's Tail | Dashes 60% longer and 2 m/s more over the cap, **but a full lantern never wards** | The lantern drawn without its ward ring |
| 2 | `kite` | Speed | Kite String | A slingshot needs half the draft (18 ticks), pays 1.5x the boost and lights 30 (not 18) | A taut thread of light to the ghost while drafting |
| 3 | `frost` | Speed | Frost Runners | On ice: grip x2.2 and drag x0.8 of the ice's (lakes and the fork's strip become a line you steer); on snow, drifts charge 20% slower | Blue sparks off the runners on ice |
| 4 | `star` | Speed | Falling Star | A landing on a falling slope turns twice the drop into speed (cap 8 to 14 m/s); a sketchy landing costs 30% (not 20%) | A streak off the sled on a big landing |
| 5 | `drum` | Speed | Drift Drum | Drifts charge 35% faster and tier 3 pays 3 m/s more, but no drift starts under 22 m/s | The drift ring beats with its tiers |
| 6 | `step` | Speed | Ember Step | A dash begun within 0.5 s of a perfect landing costs half a lantern | The lantern pulses while the half price is open |
| 7 | `stride` | Speed | Long Stride | The tuck cuts drag to x0.72 (not x0.82), but while tucked the steer is held to a quarter lock | The rider tucked lower, a wind line off the helmet |
| 8 | `owl` | Style | Owl's Breath | A near miss refills the combo timer and adds 1 s to it (up to 3 s more) | The combo ring refills on a whisker |
| 9 | `hearth` | Style | Hearthstone | The first perfect landing after a dash gives back the dash's lantern | An empty cell outlined after a dash, filled by the stomp |
| 10 | `paper` | Style | Paper Kite | Grabs reach their tiers 30% sooner and pay 1.5x, but spins turn 15% slower | Paper ribbons off the rider at each grab tier |
| 11 | `whirl` | Style | Whirlwind | Spins 20% faster and each half turn past the first pays 25% more; flips 20% slower | A ring of snow off a spin |
| 12 | `memory` | Style | Crane's Memory | A trick new to the run pays 3x (not 1.5x), but a repeat in a combo pays half (not 70%) | A new trick's call drawn gilded |
| 13 | `festival` | Style | Festival Drum | The combo multiplier steps every 2 links (not 3), but a bump loses the combo (not banks it) | The multiplier beats on each step |
| 14 | `bell` | Style | Bell Rope | Rails mount from 1.3 m off the bar (not 0.7) and from 7 m/s; grinds pay 2x | Rails ring as you near them |
| 15 | `spirit` | Style | Spirit Drum | Flow climbs twice as fast; a bump drops two levels (not one) | The flow state's own picture comes sooner |
| 16 | `second` | Survival | Second Wind | A fall costs no get-up, but empties the lantern | The lantern gutters out on a fall |
| 17 | `feather` | Survival | Featherfall | Once a stage, a landing that would floor you is sketchy instead; tricks pay 25% less | A feather on the lantern while the stage's spare is held |
| 18 | `stone` | Survival | Stone Lantern | A ward costs half a lantern and keeps 95% of speed, but a dash costs a lantern and a half | The lantern's cells drawn in halves |
| 19 | `bark` | Survival | Bark Skin | A glancing bump keeps the combo running and wobbles half as long; head on is a fall from 15 m/s (not 12); top speed 1.5 m/s less | Snow shed off the rider on a bump instead of a stagger |
| 20 | `lamp` | Survival | Last Lamp | With no get-ups left, the next fall is a ward even with an empty lantern, once a stage | A small ember in the empty lantern when the get-ups run out |
| 21 | `path` | Survival | Lamplit Path | The safe line carries a spark every 15 m for you (lights from a reserved id range); great lights off the line light 20% less | The sparks themselves |
| 22 | `quick` | Survival | Quick Feet | A fall is half a second shorter (no lying in the snow) and you get up at 65% of cruise (not 50%), but a fall empties the lantern's part-lit cell | The rider springs up |
| 23 | `wisp` | Survival | Guardian Wisp | The first hit each stage that would floor you is taken by a wisp (a ward that costs nothing), but lights fill the lantern 25% slower | A wisp circling the rider until it is spent |

**Starter pool** (open to a first-timer): Comet's Tail, Long Stride; Owl's Breath, Hearthstone; Second Wind, Guardian
Wisp. The rest arrive through the Almanac (G4's lane decides the order; the sim only reads the mask).

**Named synergies** (a pair held together adds one rule; the HUD names it when the second is taken):

| Pair | Name | Adds |
| --- | --- | --- |
| Slipstream Lantern + Kite String | Ghost Rider | Every slingshot lights a whole cell |
| Comet's Tail + Ember Step | Comet Chain | A perfect landing during a dash adds 1 s to it |
| Second Wind + Quick Feet | Phoenix | You get up from a fall into a half-length dash, no lantern spent |
| Paper Kite + Whirlwind | Paper Storm | Paper Wheels pay double |
| Owl's Breath + Festival Drum | Night Chorus | A near miss counts two links |
| Stone Lantern + Guardian Wisp | Shrine Keeper | A ward lights a third of a cell back |
| Frost Runners + Drift Drum | Black Ice | Drifts on ice charge double and never wobble |

Charms are earned, never bought, and a ghost rides with its own pool and picks, so the race stays fair; but a rider
with a wider pool has more to choose from. That is progression, as the brief asks, and the fairness bar is what
keeps it honest (no charm or pair over about 60% of lab races).

---

## 3. Config, record and migration

- **`SimConfig`** gains `charmPool?: number` (24 bits; absent means `STARTER_POOL`). Everything else stays.
- **`RunRecord`** gains `charmPool: number`. **Record VERSION 3**: bytes 0 to 27 keep their layout exactly (magic,
  version, sim version, seed, mood byte, event, chaos seed, sled, ticks, score, distance, name length), then the name,
  then the pool as a u32, then the input log. `readHeader` accepts versions 2 and 3 (the header is the same), so an
  old link is still read as a target (decision 150). `decodeRecord` reads 3 only, and a SIM 9 record already fails on
  its sim version, so every old record is stale through the path that exists (decision 149, 203, 231).
- **The log's event tokens** (input.ts): `LogEvent.Revive = 1` (as now), `Showdown = 2`, `Steal = 3` (4). Every
  caller that replays a log (reel.ts, run.ts, the worker, the bot, the generator) calls one new
  `applyLogEvent(sim, e)` in replay.ts, not its own `if (e === LogEvent.Revive)`; and `simConfigOf(record)` builds a
  record's SimConfig, pool included. Both are the main lane's wiring in the game layer.
- **The pick is in the line,** so no token is needed for charms: the record replays its own offers (pool + roll seed)
  and its own x at each gate.
- **Migration**, following decisions 149, 203 and 231 with nothing new invented: SIM_VERSION 10 is a clean break.
  Bests, grudges and Climbs whose records are SIM 9 move byte for byte to the archive; links open as targets; gifts,
  sleds, looks, stats, passes, missions, mastery, The Twelve's beaten list and counts are untouched (none of them
  holds a record). The `migration` suite gains: a SIM 9, VERSION 2 record fixture is archived and its header still
  read; a VERSION 3 record round-trips with its pool; a VERSION 2 header with a VERSION 3 body length is no record.
- **What is new in the save** (the Almanac's pool, charm and trick counts) is the game layer's, optional, as `twelve`
  was added.

---

## 4. Showdowns and the spirit steal (G3's record part)

The game layer decides both from the ghosts' replays; the sim only takes what they give, from a log token, so a run
replays exactly. The rule is pure and lives in **`src/sim/rivals.ts`**, so the live game and the generator call the
same thing and a pool ghost can win a showdown against an earlier pool run.

```ts
export interface RiderPoint { x: number; z: number; riding: boolean; clean: boolean } // riding: no fall, not finished or wrecked; clean: no bump or ward in the last second
export function riderPoint(sim: Sim, cleanSince: number): RiderPoint;     // read off a sim the same way everywhere
export class RivalWatch {
  constructor(count: number, eligible: (i: number) => boolean);           // who is a "named rider" (open choice 4)
  step(tick: number, me: RiderPoint, them: readonly (RiderPoint | null)[]): RivalEvent[];
}
export type RivalEvent =
  | { type: 'showdown'; phase: 'start'; rival: number; markerZ: number }
  | { type: 'showdown'; phase: 'won' | 'lost'; rival: number }
  | { type: 'steal'; rival: number };
```

- **Showdown:** level for 2 s (120 ticks running: |dz| <= 3 m and |dx| <= 8 m, both riding) starts one, against an
  eligible rival, with nobody else's under way and 10 s since the last ended, at most 3 a run and once a rival. The
  marker is 300 m past the further of the two. The first to it wins; a fall or a wreck does not end it (you can get up
  and still win), a finish line before the marker is the marker. **Won:** the game layer pushes `LogEvent.Showdown`;
  at the start of the next tick the sim lights one cell (LANTERN units, past any cap of a full lantern: the extra is
  lost) and pays `style('showdown', 1000)`; `stats.showdowns++`. Lost: nothing in the sim.
- **Spirit steal:** on the tick your z passes an eligible rival's, with |dx| <= 1.0 m between centres, both riding
  and you clean: `LogEvent.Steal`; the sim lights 34 units (a third of a cell) and pays `style('steal', 300)`;
  `stats.steals++`. Once a rival a run.
- **Live:** the game steps the ghosts' replays to the run's tick (it does already for the field), calls
  `watch.step` after each `sim.step`, and on a won showdown or a steal calls `recorder.event(...)` and
  `applyLogEvent(sim, ...)` before the next step, exactly as a revive is recorded today. The marker, the HUD, the
  camera, the sound and the rivals' story are other lanes'.
- **Offline:** the generator rides run i against a field of the 7 earlier runs nearest its skill (their trajectories
  kept as Float32 x, z and a riding bit a tick: about 8 MB a mountain), with the same `RivalWatch`, and writes the
  tokens into run i's log. A run cannot meet a later one, which is honest: the later one did not exist yet.
- **The draft bit, the same way:** today the game layer sets the draft bit from the ghosts and a pool is ridden alone,
  so no pool ghost has ever drafted. The pure draft rule moves into `rivals.ts` too (`drafting(me, them)`), the game
  calls it, and the generator sets the bit from the same field. Slipstream Lantern and Kite String then work for
  ghosts. (This changes how fast the pools ride; it is part of the one regeneration.)

---

## 5. Spirit Flow pays (G6)

`s.flow` stays the smooth 0 to 6 the picture reads; a new `s.flowLevel` (0 to 6, whole) is what pays.

- **Rise:** every style adds heat, its base points / 600 (a perfect landing about 0.45, a 720 about 1.75, a near
  miss 0.2); the level is the heat's whole part, capped at 6. (Today flow is the chain length / 4 and drops the moment
  the combo banks; heat outlives a combo, so a stylish rider stays in flow between combos.)
- **Fall:** a dull 5 s (no style) starts it cooling, a level every 1.5 s; a bump or scrape drops one level, a ward two,
  a fall all of it.
- **Pays:** lantern charge x(1 + 0.08 a level) (x1.48 at 6), style points x(1 + 0.1 a level) (x1.6 at 6), and the
  drag cut it already has (5.5% a level, unchanged).
- **Stats:** `stats.bestFlow` (the highest level held a second or more) and `stats.flowTicks[7]` (ticks at each
  level); results shows the best flow held.
- **Event:** `{ type: 'flow', level, from }` when the whole level changes: V4's Spirit Flow picture keys on it.

---

## 6. Also in the batch

- **Spirit lights over a leap** (round 7's open item 14): the line now starts on the snow, three sparks on the safe
  line at 24, 16 and 8 m before the lip (hover 0.8), and the air's lights follow the flight from 6 m past the lip, so
  from the run-in the eye reads one trail running over the edge, not lights hanging in the sky before it. Course only.
- **A gentler variant for a novice** (open item 3), *only if time allows*: a `gentle` flag in the mood byte's top bit
  (the legend uses values 0 to 2 of the high half, so `legend = (b >> 4) & 7`), set by the game for a player who has
  not yet won a set piece. With it each set piece plays its plainest variant with a gentle tune on top (rings 40%
  wider, a slide of 90 ticks, gates 0.5 m wider, the surge at 42). `variantOf` is untouched, so the variant tables do
  not move; the record carries the flag. First to cut.
- **Course shapes the look lanes cannot draw:** none asked for; the stage-line thresholds (2) are one and V3 should
  know they are coming.

---

## 7. The bot (`src/bot`)

- **Model (`model.ts`):** `Rot` gains the grab (side, ticks, tier) and the press's kind; `rotStep` mirrors the latch
  (grab in 4, flip at 7), the spin only with the grab's side at 80%, no flip while grabbing. `AirPlan` gains a grab
  window `[g0, g1)` and side, a tweak window and a double tap.
- **Planning (`planTrick`):** the menu is what the flight has room for (as today's spin and flip solves), plus a grab
  tier its ambition dares, aimed to let go at touchdown minus 5 ticks; its timing noise (`timingSd`) makes some let go
  too late (a deep grab held into the snow is a fall, as for a person) and some too early (no stomp). It keeps the
  tricks of the combo it is in and prefers a new one (style 'stunt' and 'sky' strongly). Specials after a rail
  (style 'grinder' at last rides rails) and off a wall; signatures from skill 0.6.
- **Charms:** a policy per style: racer, dasher speed; stunt, sky style; liner, hoarder survival (the middle: no
  steering at all); master and wild the best synergy on offer; the crowd by skill (a novice keeps the middle seven
  times in ten). It reaches its lane as a goal x at the gate (as it reaches lights now), from 100 m out, never at the
  price of its margin: blocked, it takes the lane it is in.
- **Showdowns:** once one starts against it, it rides as a racer to the marker (a tuck, a dash if it holds a cell).
- **Runs:** `runBot` takes an optional field (earlier trajectories) and a `RivalWatch`; without one it rides alone
  as now.

---

## 8. The lab and the bars

- **Pilots:** the mid and expert pilots get the air map (a trickster's hands like the prototype's, steering for the
  line in the air as they do now), the stunt pilot tricks, the clumsy pilot is unchanged (it mashes, and its presses
  are now grabs as often as flips), and each pilot has a charm policy (clumsy and novice ride the middle).
- **Decisions (four choices a run that change how the rest plays):** three charm gates and the lantern (dash or
  ward). `r8-bars` checks each lab run of the mid pilot made three picks and at least one spend, and a unit test rides
  one scripted log with each charm against none: the run must differ in the stat its charm names (a dash's length, a
  ward's keep, a draft's light...), so no charm is a number nobody feels.
- **Expression (ten named tricks, the expert's best combo five of them):** `TRICKS` holds 18; the lab reports each
  ride's best combo by distinct named trick ids from the style events; the bar is the expert's median over its 30
  rides at five or more (and its best at seven).
- **First minute (the clumsy pilot finishes 26 of 30):** `lab.ts --pilots clumsy --seeds 6 --max 420`, as round 7.
- **No worse than round 7:** finishes, set pieces won and race liveness by `lab.ts` and `race-lab.ts` against
  `shots/r7/lab/final.txt`; the fairness bar for charms by `race-lab.ts` with a charm forced (each, then each pair).

---

## 9. What the prototype showed

Built on `r8-sim` (not yet the batch: no charms, flow, records or bot): `src/sim/tricks.ts` (ids, names, poses,
`nameFlight`), the air map in `Sim.airTricks` and `land()`, the combo's repeat cut keyed by trick id, a trick new to
the run x1.5, `style` events carrying the trick id and its call, and `grab` events (start, tier, tweak, release, move)
for the pose and the sound. The pilot is `scripts/playtest/r8-air.ts`: the expert's hands on the snow, a trickster's in
the air (no air steering), one seed a mountain.

- **The map is playable by a pilot.** On five mountains it finished 5 of 5 (and 5 of 5 again with pop chains), landed
  12 to 29 named tricks a run of 8 to 10 kinds (12 of the 18 seen across its runs; Snow Hare and the signatures
  other than the Pine Flyer's were never tried: it rides sled 0 and no wall), perfect landings 13 to 31, sketchy 0 to 2.
- **The best combo:** five or more named tricks on 2 of 5 mountains both ways (7 on Pinecrest; 5 and 8 with pop
  chains), 3 or 4 on the rest. The combo's 2.6 s window banks between features 100 to 400 m apart, so five in one
  combo needs pops between them or a flight that holds two named tricks (a grab and its Crosswind; a rail's move and a
  spin). The bot and the expert pilot need to be taught to chain; the bar is reachable, not given.
- **The clumsy pilot did not get worse:** 9 of 10 (two seeds on five mountains, `--max 420`) against 8 of 10 before,
  and landings were 13% of its falls against 25%: its random presses with a key held are now grabs, which only floor it
  if held deep through a landing, where they used to be flips.
- **The spin-only expert is untouched:** the classic expert's times on all five mountains are identical to the
  tick; its score is 0.2 to 1.6% higher (a new trick's x1.5).
- **The lab's flourish broke and was fixed in the pilot:** the mid and expert pilots pressed for a flip with the
  steer already over for the spin, which is now a grab (lost 0 of 1 each). Pressing centred and steering after the
  latch wins it 2 of 2. A person doing a spin-and-flip the old way will grab instead: the hint system must teach
  "press, then steer" for an Ember Twist.
- **Too many points:** the trickster scored 145k to 360k against the spin-only expert's 50k to 106k. Grabs and
  combinations need about half their prototype points (open choice 3).
- **Replays hold:** a 200 s random-hands run (313 grabs, 53 named tricks) replays from its log to the same hash;
  `purity` and `determinism` pass. (No other suite was run: the laptop is being kept quiet.)

---

## 10. Risks, and what goes first if the batch runs long

Risks, biggest first: (1) the bot's air model rewrite is the largest piece of work, and until it lands the bot plans a
spin and a flip that start together, which is now a grab: pools must not be generated before it; (2) the stage-line
thresholds move the courses' places and set pieces down the run, so the moments tables and "every variant winnable"
must be re-proved; (3) scores inflate and missions or boards keyed on points move; (4) the generator's field (draft,
showdowns, steals) costs time and changes how fast every pool rides; (5) the presentation load: 18 poses and 24 charm
signals for other lanes.

Cut in this order: the gentle variants; Snow Hare and the per-sled signature rules (every signature a plain held move);
synergies down to three; charms from 24 to 18 (six a family); the spirit steal; the draft field in the generator
(ghosts would still not draft, as today).

---

## 11. Open choices for the main lane

1. **Where the stage gates stand.** *Recommend* a threshold section at every stage line (40 m before to 140 m after,
   wide and plain), made by the course writer: every gate fair by construction, and V3 gets a composed stage start.
   The alternative searches each course for a window and clears it, which needs no new section but leaves some gates
   in a 6.5 m chute and three courses in ten with nothing fair inside 500 m.
2. **A short grab held through a landing.** *Recommend* clean (tier 0 or 1; a deep one, tier 2 on, is a fall on a
   committed flight). The brief's "landing while still holding is a fall" taken literally for every grab puts a
   first-timer's thumb back on its head.
3. **The points budget.** *Recommend* cutting grabs and combinations to about half the prototype's, so a rider who
   uses the whole map scores about 1.5 to 2 times a spin-only rider, not 3 to 4.
4. **Who counts as a "named rider" for a showdown.** *Recommend* The Twelve's signature riders, your grudge and a
   friend's link: one or two showdowns a run, each a person-shaped rival. Any ghost in the field would make them
   constant and cheap. (The generator's ghosts then duel the signature riders in their pools.)
5. **The gentle variants.** *Recommend* leaving them out of this batch unless the rest lands with time to spare: they
   need the game to decide who is a novice, and they are the first thing cut.
