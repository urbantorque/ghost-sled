# Round 8, the sim lane (SIM_VERSION 10)

The design is `notes/r8-sim-design.md`, approved by the main lane with five answers: thresholds at every stage line;
a short grab held through a landing lands clean; grab and combination points halved; showdowns against The Twelve's
riders, your grudge, a friend's link and your own best; gentle variants out. Three additions came later (the charm
gates' count, a Long Night carry, a first run). This file is the lane's record: decisions, measures, what is short.

Pools are not regenerated and none are committed: `src/data/ghosts` is clean, and the ghost pool suite is red until
the main lane regenerates once after the merge (the pools hold SIM 9 records).

## Stable interfaces

**Branch from `c20e5e4`** for the shapes below; the additions marked (later) are on the branch tip. Names and shapes
do not change in this batch; numbers behind them may.

**Tricks** (`src/sim/tricks.ts`)
- `TRICK` (ids 1 to 18), `TRICKS[id]`: `{ id, key, name, family, how, pose }`; `pose` is the line for `rider.ts`.
  `SIGNATURE[sledId]`, `grabTier(ticks)`, `GRAB_T1/T2/T3`. (later) `trickCall(id, halfTurns, flips, late)`: the call
  on screen ("Spin 540", "Double Backflip", "Late Crosswind", "Paper Wheel 360").
- `SledState`: `grab` (-1, 0, 1), `grabTicks`, `grabTier` (0 to 3), `tweak` (ticks), `move` (the trick id posed now).
- Event `{ type: 'grab', phase: 'start' | 'tier' | 'tweak' | 'release' | 'auto' | 'move', side, tier, trick }`.
- On landing every named trick is a `style` event with `trick`, `halfTurns`, `flips`, `tier`, `late`, `fresh`. A plain
  spin keeps `kind: 'spin'`, a plain backflip `'flip'`; the rest are `kind: 'trick'`.
- `stats.trickMask`. (later) `Sim.airHoldKind`, `Sim.airHoldLen`: what the press held in the air is (the bot reads it).

**Charms** (`src/sim/charms.ts`)
- `CHARM` (ids 0 to 23), `CHARMS[id]`: `{ id, key, family, name, does, signal }`; `SYNERGIES`, `synergiesOf(mask)`,
  `STARTER_POOL`, `ALL_CHARMS`, `charmFamily(id)`.
- `Sim.charmGates: CharmGate[]` (`{ index, z, x, offers: [left, middle, right], lane, pick }`); arches `LANE_W` apart,
  `laneX(x, lane)`, `laneOf(x, sledX)`; a gate's offers are dealt when the gate before it is decided. `offersFor`.
- Events `{ type: 'charm', gate, lane, id }`, `{ type: 'synergy', id }`. `Sim.charms`, `charmMask`, `synergyMask`,
  `has(id)`, `hasPair(id)`.
- (later) Gates stand at z 110 (`START_GATE_Z`) and `GATE_PAST_LINE` (100 m) past each stage line, on the stage line's
  threshold (`Section.gate`, kind 'cruise'; `THRESHOLD_*` in course.ts).
- (later) Lamplit Path's sparks: one on the safe line, 0.8 m up, at every multiple of `PATH_STEP` (15 m) from where the
  charm was taken to the finish, light ids `PATH_ID0 + z / 15`; the `light` event says each one taken. The renderer
  draws them for a rider who holds the charm (`sim.has(CHARM.path)`).

**Config and records**
- `SimConfig`: `charmPool?` (24-bit mask; absent `STARTER_POOL`), (later) `charmGates?: 1 | 2 | 3` (absent 3),
  `carry?: Carry` (`{ lantern 0..300, getUps 0..3, charms: up to 3 ids }`: a Long Night leg starts with them held and
  its gates never offer them), `firstRun?` (stomp window `FIRST_RUN_STOMP` 15 ticks before touchdown, 8 after).
- `RunRecord`: the same four, optional. Record version 3: bytes 0 to 27 as version 2's, the name, a u32 (pool in bits
  0 to 23, gates in 24 and 25 with 0 for three, bit 26 a carry follows, bit 27 a first run), the carry's 6 bytes if
  any, the log. `readHeader` reads 2 and 3.
- `simConfigOf(record)` builds every replay's Sim; `applyLogEvent(sim, e)` applies every token (revive, showdown,
  steal). A token clears the sim's events and raises its own, as a revive did.
- The Long Night's rising chaos needs nothing new: a leg's `ChaosRoll` is any `{ mood, event, seed }` the game picks
  (more chaos each leg), and every record already holds it.

**Rivals** (`src/sim/rivals.ts`)
- `RiderPoint`, `riderPoint(sim)`, `draftsOn(me, them)` (the game's slipstream rule, moved here), `RivalWatch(size,
  duel(i), steal(i), finishZ).step(tick, me, them[])` returning `RivalEvent[]` (showdown start / won / lost, steal).
- `LogEvent.Showdown` (2): a cell (100 units, unscaled) and 1000 points; `LogEvent.Steal` (3): 34 units and 300.
  The sim raises `{ type: 'rival', kind, gain }` and a style of kind `'showdown'` / `'steal'`; `stats.showdowns`,
  `stats.steals`.
- (later) Live: `Run.rivalProbe` (set by app.ts from `ghosts.rivalProbe(finishZ)`), `Run.drainRivals()`, and the
  director's frame field `rivals` kept on `director.rivalEvents` each frame for the drawing lanes.

**Spirit Flow**: `SledState.flowLevel` (0 to 6, what pays), `SledState.flow` (eased, the picture's), event
`{ type: 'flow', level, from }`, `stats.bestFlow`, `stats.flowTicks[0..6]`.

**Game layer** (later): `src/game/charmpool.ts` `charmPoolOf(save)`, `charmGatesOf(save)`, `firstRunOf(save)` (the
spine lane's Almanac fills the first two). `Run(seed, chaos, sled, input, extra)` with `RunExtra` = the config's four.

## What was built, and why a player would feel it

1. **The air map** (G1). Press with the steer to a side grabs; centred flips; hold is the dare (tiers at 0.25, 0.67
   and 1.25 s); let go into the landing is the stomp; a deep grab held into the snow on a committed flight is a fall;
   steer against a grab tweaks; double tap is the sled's own move; a press off a rail's end or a wall ride is its move.
   Eighteen named tricks. Grab and combination points are about half the prototype's (main lane's answer 3): grabs
   60 / 150 / 280 and 120 a second past the third tier, combinations the sum of their parts (Spirit Knot x1.1),
   Crosswind 150 / 350 late, Lamppost 300, Snow Hare 250. A trick new to the run pays x1.5.
   *Measured:* the classic spin-only expert's times are unchanged by the map itself; scores of the trickster (the map
   used whole) against the classic expert, one ride a mountain: 182k/66k, 102k/158k, 94k/52k, 138k/77k, 152k/50k, in
   all 1.67x (target 1.5 to 2).
2. **Charms** (G2): 24 in three families, seven named pairs, three gates a run, the middle survival. Every charm acts:
   `tests/r8sim.test.ts` rides one scripted run with each charm held against none and every one changes the run.
3. **Thresholds** at both stage lines (main lane's answer 1): plain, bare, at least 11 m half-width, 40 to 220 m above
   the line and 150 to 180 m below, the gate 100 m past the line. To make room the course writer now drops a plain
   beat (cruise, bowl, chute, gully, switchbacks, benches, split) before it hands a place on to the next stage, never a
   named mountain's set-piece place, and holds each set piece's own section at the longest its stage allows.
   `tests/charmgates.test.ts` holds every gate on 65 courses: half-width, no obstacle, kicker, mogul, drop, rail, vent
   or ice in its 100 m approach, no set piece or legend within 30 m, each arch reachable.
4. **Spirit Flow** (G6): heat from style (base points / 1000, twice under Spirit Drum), cooling a level a second after
   three dull seconds, a bump one level, a ward two, a fall all; +8% lantern and +10% points a level, and the drag cut
   it had. Tuned so the classic expert lives mostly at 0 to 2 and reaches 3 to 5 (flow seconds by level, Pinecrest:
   63/33/16/3/0/0/0); the first tuning (600, 5 s) held 6 all run and cut 20 s off a run.
5. **Rivals** (G3's record part): showdowns and the steal as designed, live and offline. Pool generation now rides the
   signature riders first, then the crowd, then the fast end, every run against a field of the seven earlier runs
   nearest its skill: it drafts them (pool ghosts never drafted before), duels the signature riders and steals from
   any, all in its own log.
6. **The bot** rides it all: grabs alone, on a spin, after a flip; late Crosswinds from skill 0.55; let-go timing
   carries its hands' error (a deep grab let go too late is a fall, as for a person); presses a flip before it steers
   a spin; picks charms by style and rides to its arch.
7. **Leap lights** start on the snow before the lip (round 7's open item 14).
8. **A first run** stomps from 15 ticks out (0.25 s; 8 after touchdown). `scripts/playtest/r8-first.ts`, two seeds a
   mountain: the clumsy pilot's first perfect inside 45 s on 7 of 10 rides against 5 (12 ticks: 5; 18: 7); the novice's
   on 10 of 10 against 9.
9. **Hint** `flipSpin`: a rider who knows the spin and grabs before two flips is told "That was a grab. For a flip,
   press first, then steer"; it retires on the first flip landed.

## What moved (the thresholds), named mountains

Set pieces (before -> after, metres): The First Drop 577 -> 577; Mirror Lake 1633 -> 1785 (+151); Old Town 3269 ->
3421 (+152); Serac Gate 1235 -> 1195 (-40); The Crevasse Fields 2177 -> 2132 (-45); The Ice Cavern 3194 -> 3300
(+106); Cinder Gate 1206 -> 1153 (-53); The Caldera Leap 2311 -> 2360 (+48); Ash Market 3631 -> 3573 (-58); Petal
Steps 860 -> 860; The Blossom Leap 2450 -> 2650 (+200); Temple Town 3966 -> 4000 (+34, its street 34 m shorter); The
Cloud Sea 825 -> 825 (ends 40 m sooner); The Lamp Road 2099 -> 2255 (+155); The First Flame 3621 -> 3685 (+64).

Sections (start of each; `cruise*` a threshold):
- Pinecrest: start 0, bowl 120, cruise 367, leap 499, treerun 837, fork 1092, cruise* 1410, chute 1600, lake 1785, bowl
  2095, treerun 2346, leap 2567, cruise* 2910, fork 3100, bridge 3421, street 3636, leap 3866. Gone: benches (2689),
  chute (3659).
- Frostfang: ..., ravine 835, bridge 1195, cruise* 1410, street 1600, leap 1800, ravine 2132, bridge 2435, fork 2600,
  cruise* 2910, bowl 3100, tunnel 3300, bridge 3523, chute 3688, leap 3868. Gone: chute (1651), switchbacks (2950,
  a bowl now; the Aurora legend runs there, its `alt`).
- Ember: ..., ravine 873, tunnel 1153, cruise* 1410, chute 1600, bridge 1786, fork 1952, leap 2270, ravine 2620,
  cruise* 2910, tunnel 3100, bridge 3358, street 3573, leap 3853. Gone: bowl (2950).
- Sakura: ..., terraces 860, street 1196, cruise* 1410, chute 1600, tunnel 1786, bridge 2027, fork 2218, leap 2560,
  cruise* 2910, terraces 3100, fork 3358, leap 3668, street 4000. Gone: benches (2710; the Lantern Dragon runs in the
  chute, its `alt`).
- Lanternfall: ..., ravine 825, switchbacks 1170, cruise* 1410, leap 1600, fork 1935, street 2255, bridge 2535, treerun
  2700, cruise* 2910, benches 3100, bridge 3320, street 3485, chute 3685, leap 3868. Gone: bowl (2710).
`scripts/playtest/r8-moved.ts --root <round-8 checkout>` prints the whole list.

## Measured so far (the CPU rule held: one or two seeds, single short runs)

| Pilot | Finished | Median s | Set pieces | Best combo named tricks (med/max) | Trick kinds | Choices | Round 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| expert (1 seed x 5) | 5/5 | 122.9 | 10/15 | 4/5 | 10 | 4 | 30/30, 122.6 s, 82/90 |
| mid (1 seed x 5) | 5/5 | 120.3 | 14/15 | 3/4 | 8 | 4 | 30/30, 123.5 s, 80/90 |
| clumsy (2 seeds x 5) | 9/10 | 339.1 | 2/28 | 3/4 | 5 | 4 | 26/30, 368.7 s |
| novice (2 seeds x 5) | 10/10 | 149.2 | 8/30 | 0/0 | 0 | 4 | 30/30, 154.8 s, 18/90 |

- **Expression:** 18 named tricks (bar 10). The expert's best combo holds 5 named tricks on its best mountain and 4 at
  the median: short of "at least five" as a median; reached as a best. Pops chained between features are what lifts
  it (the prototype reached 8).
- **Decisions:** 4 a run at the median (three charms taken and a lantern spent), every charm proven to change a run.
- **First minute:** clumsy 9 of 10 on two seeds (round 7: 26 of 30); the first run's wider stomp.
- **Charm fairness:** `r8-charms.ts`, one ride a charm on Pinecrest only, so not a result: Comet's Tail (no ward) and
  Featherfall rode slowest, Falling Star and Guardian Wisp quickest. The full table waits for the laptop.
- **Showdowns a run:** not measured: race-lab needs the regenerated pools (the bundled ones are SIM 9).

## Waiting for the laptop (commands, in order)

1. `npx tsx scripts/generate-ghosts.ts` (locally; do not commit), then `npx vitest run` (all suites).
2. `npx tsx scripts/playtest/lab.ts --seeds 6 --max 420 > lab.txt` against `shots/r7/lab/final.txt` (finishes, set
   pieces, the Expression and Decisions columns, clumsy 26 of 30).
3. `npx tsx scripts/playtest/lab.ts --pilots mid,novice,expert --seeds 6 --max 420 --json lab.json` then
   `npx tsx scripts/playtest/race-lab.ts --rides lab.json`: race liveness against round 7, and "showdowns a run"
   (an upper bound: the lab's rides carry no x, so a rider level down the run counts as level across it). If mid is
   under one a run on runs 2 to 6, widen `ghosts.rivalProbe`'s `duel` to the field's HUD rival (`entry.rival`) and the
   generator's to the same kind.
4. `npx tsx scripts/playtest/r8-charms.ts --pilots mid,expert --seeds 2` and `--pairs`: no charm or pair over 60%.

## Still short

- `moments.test.ts`: Lanternfall's Cloud Sea, quick weave, is not proved winnable: the classic pilots ride 7 of 8
  eighths of the wake on the ravine the threshold shortened by 40 m (a wake ending 30 m sooner did not help).
- Temple Town's street is 34 m shorter (Sakura's last stage is at its minimum): two bells where three hung. Its wall
  variant passed the suite after the set-piece lengths were held, but was 0 of 4 in one lab look before that.
- The density promises in `fairness.test.ts` were eased where the thresholds took the room: online kickers 3 to 2,
  rails a stage 4 to 3, Frostfang's moguls counted over the five mountains, a marginal crest (-0.0111) and a 38 m
  kicker flight on the shortened last chutes. A stage line's threshold can be up to 400 m of plain ground.
- The bot does not seek showdowns or ride a won one as a racer, does no rail, wall or sled move of its own, and its
  charm choice is a family preference, not a read of the run.
- Signatures pay as a grab of the same hold, x1.2: the six sled rules in the design are not built.
- The expert pilot loses more set pieces than round 7's at one seed (10 of 15): to be read on the full table.

## Touched outside my files

- `src/game/charmpool.ts` (new), `src/game/run.ts` (config extras, log tokens, rival probe), `src/game/ghosts.ts`
  (draft probe through `draftsOn`, `rivalProbe`), `src/game/app.ts` (`runExtra`, dev switches, the rival probe and
  events into the director's frame, `grabbing` into the hint frame, `flipSpin` learned on a flip), `src/game/reel.ts`
  (both replays through `simConfigOf`/`applyLogEvent`), `src/game/director.ts` (`rivals` frame field and
  `rivalEvents`, trick names in the callout, 'trick' as a flow trick and a big tone), `src/game/hints.ts` and
  `src/ui/hint.ts`, `src/ui/contract.ts` (the `flipSpin` hint).
- Tests: `charmgates.test.ts`, `r8sim.test.ts` (new); `encoding.test.ts`, `fairness.test.ts`, `moments.test.ts`.
- Scripts: `lab.ts`, `labpilots.ts` (trickster; the flourish presses before it steers), `race-lab.ts` (showdowns),
  `r8-air.ts`, `r8-bots.ts`, `r8-charms.ts`, `r8-first.ts`, `r8-moved.ts`, `r8-score.ts` (new).

## For the main lane to wire or decide

- The presentation: charm arches and glyphs, the trick calls' sounds and poses (`TRICKS[id].pose`), the showdown
  marker (`director.rivalEvents`), the flow signal, Lamplit Path's sparks, the gate cards' text (`CHARMS[id].does`).
- The Almanac fills `charmPoolOf` and `charmGatesOf`.
- Regenerate the pools once after the merge; the ghost pool suite is red until then.
- Dev switches for the owner: `?charms=all` (every charm can be dealt), `?charms=<mask>`, `?gates=1|2|3`,
  `?firstrun`. A person must judge: whether "press decides" reads on a keyboard, whether the dare at 0.67 s is the
  right place, whether letting go into a landing feels like a stomp, whether a gate's three arches read at speed and
  the choice feels like steering, whether the charms feel like builds, whether a showdown is a moment.
