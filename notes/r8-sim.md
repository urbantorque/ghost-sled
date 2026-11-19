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

## The full proofs (2026-11-20)

Raw output in `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/sim/` (lab.txt, lab.json, race.txt, charms.txt,
charms-pairs.txt, combo.txt, combo-charms.txt, vitest.txt, pool-tokens.txt, lab-nocharms.txt, lab-classic.txt). Pools
regenerated locally for these and not committed; after the laptop's 0xD1 restart (01:45) every run was made one
process at a time, vitest with `--maxWorkers=3`.

**The lab** (`lab.ts --seeds 6 --max 420`, every charm dealable; round 7 from `shots/r7/lab/final.txt`):

| Pilot | Finished | Median s | Set pieces | Round 7 |
| --- | --- | --- | --- | --- |
| clumsy | 29/30 | 339.3 | 2/88 | 26/30, 368.7 s, 1/90 |
| novice | 30/30 | 144.1 | 29/90 | 30/30, 154.8 s, 18/90 |
| mid | 30/30 | 126.2 | 78/90 | 30/30, 123.5 s, 80/90 |
| expert | 30/30 | 121.3 | 82/90 | 30/30, 122.6 s, 82/90 |
| line | 30/30 | 149.3 | 6/90 | 30/30, 144.6 s, 6/90 |
| stunt | 30/30 | 134.4 | 24/90 | 30/30, 132.5 s, 31/90 |
| hands-off | 5/5 | 149.7 | 2/15 | 5/5, 150.0 s, 1/15 |
| hold-r | 0/5 | | 0/13 | 0/5 |

Set pieces by verb, mid / expert: carry 3/4, collapse 6/6, flourish 6/6, follow 6/5, gates sit 6/6, gates swing 6/6,
kindle 5/6, chase 6/6, sprint 6/4, rings 6/6, shatter 5/3, slide 6/6, hops 6/6, stair 3/6, surge 2/6. Without charms
the classic expert (its own spender) wins 80/90 at 129.0 s, the trickster expert 72/90: the 400 m before a set piece
left to the classic hands is what brought the trickster to 82.

**Expression:** 18 named tricks. The expert's best combo in named tricks: 5 at the median with no charm
(`r8-combo.ts --seeds 6`: 30 rides, 3 to 6, median time 118.5 s), 4 with every charm dealt (3 to 7, 120.4 s), 4 at the
median in the lab's own table (max 8). What ends its combos: bumps 91, the window 68, falls 29; only 10 of 540 snow
gaps outrun the 2.6 s window.

**Decisions:** 4 a run at the median for every pilot that steers (three charms and a lantern spent); the line 3.

**Race liveness** (`race-lab.ts`, runs 2 to 6, 24 orders a mountain; the field laid across your runs):

| Pilot | Live | Passes/min | Quiet runs | Round 7 |
| --- | --- | --- | --- | --- |
| mid | 0.73 | 3.23 | 7/600 (1%) | 0.73, 3.47, 10/300 (3%) |
| novice | 0.53 | 2.05 | 125/600 (21%) | 0.62, 2.40, 14/300 (5%) |
| expert | 0.62 | 3.32 | 83/600 (14%) | 0.70, 3.01, 8/300 (3%) |

By run (laid across): mid 0.58 / 0.72 / 0.75 on runs 1, 2, 5; novice 0.45 / 0.53 / 0.51; expert 0.45 / 0.61 / 0.61.

**Showdowns** (race-lab, runs 2 on; an upper bound, the lab's rides carry no x): mid 1.27 started a run (0.20 won),
novice 0.63 (0.06), expert 1.39 (0.30). Mid is over one a run, so the duel rule was not widened. **Steals:** race-lab
cannot see them (no x); in the pools, 1.90 a run (the cap of two) and 0.67 showdowns won a run, 245 of 250 ghosts
drafting. A metre and no cap had given the pools 5.5 steals a run: now 0.6 m and two a run.

**Charm fairness** (`r8-charms.ts`, mid and expert, 5 mountains x 2 seeds, every charm raced against every other on
the same run, a tie half a win; 10 runs a charm, so about +-10 points of noise). Highest after three retunes: mid
Hearthstone 66%, expert Crane's Memory 66%; every other charm 60% or under on both; pairs Comet Chain 64% (both),
Paper Storm 63% (mid), Phoenix 61% (expert). Lowest: Stone Lantern 36 to 38%, Bark Skin 34%, Featherfall 19%
(expert). The draft and near-miss charms (Slipstream Lantern, Kite String, Owl's Breath, Festival Drum, Ghost Rider,
Night Chorus) tie with no charm: the lab has no ghosts to draft and few whiskers, so they are unjudged here. Retuned
on the way: Lamplit Path (83%), Hearthstone (70%), Whirlwind (75%), Comet's Tail (66%), Falling Star (69%), Spirit
Drum and Spirit Flow's own speed (5.5% to 3.5% a level).

**Clumsy:** 29 of 30 (round 7: 26 of 30).

**Tests:** 1628 of 1633. The five that fail are the render plan's, on the course the thresholds re-laid, in files of
the look lanes: overlook (Frostfang plans 2 overlooks, wants 3), palette (Frostfang's blend at 3352 m steps 0.228,
wants under 0.2), setpieces (no torii row roofs a Sakura tunnel; the pop test's fixed z = 2000 on Pinecrest is no
longer a falling slope, 3.5 m against 8; Pinecrest's finish town on Low 78,046 triangles against 78,000).

**What got worse:** race liveness for the novice (0.53 from 0.62, quiet runs 21% from 5%) and the expert (0.62
from 0.70, quiet 14% from 3%); the stunt pilot's set pieces (24 from 31) and the mid pilot's (78 from 80); the line
4.7 s slower and mid 2.7 s slower; Temple Town's street 34 m shorter; the First Flame's chute drops a sled most of its
way, so a fall above the drop is lost (the carry's still air and wind burn 3% longer for it); the five render tests.

## Still short

- Temple Town's street is 34 m shorter (Sakura's last stage is at its minimum): two bells where three hung. Its wall
  variant passed the suite after the set-piece lengths were held, but was 0 of 4 in one lab look before that.
- The density promises in `fairness.test.ts` were eased where the thresholds took the room: online kickers 3 to 2,
  rails a stage 4 to 3, Frostfang's moguls counted over the five mountains, a marginal crest (-0.0111) and a 38 m
  kicker flight on the shortened last chutes. A stage line's threshold can be up to 400 m of plain ground.
- The bot's charm choice is a family preference, not a read of the run.
- The expert pilot lost more set pieces than round 7's at one seed (10 of 15): to be read on the full table.

## Done after the first report

- **The six sled moves** (`7659aff`): Pine Bow pays a second-tier grab from the first tier and cannot be stomped by
  letting go; Spinning Top spins by itself at full rate and the landing set cannot stop it (x1.5 a half turn);
  Fireside never falls, pays to the second tier; Comet Tail tiers 30% sooner, pays x1.3, falls from the first tier;
  Will-o'-Wisp pays the third tier from the second with no air control or spin; Teacup spins at half rate by itself,
  always lands, pays x2 a half turn. Tested in r8sim.test.ts.
- **The bot** (`740a969`, `3fc9d79`): the rail's and wall's own moves, the sled's move from skill 0.6, racing a
  showdown to its marker (tuck, no detours, every lantern a dash); it tries what its combo has not had; stunt and sky
  riders chain pops. A bot racing another's track won a showdown, stole a wisp, drafted 246 ticks, replayed exactly.
- **Expression** (`3fc9d79`, `scripts/playtest/r8-combo.ts`, two seeds a mountain): the expert's best combo is 6
  named tricks at the median with no charm and 5 with every charm (bar 5), at 126.8 and 123.8 s (round 7: 122.6).
  Bumps and scrapes end its combos twice as often as the 2.6 s window (38 to 17), and 3 of 207 snow gaps outrun the
  window: the window stays. Stunt bots reach 3 to 5.
- **The Cloud Sea's quick weave** (`e58defd`): asks 85% of the wake (135 m from 158); the ground now throws a sled
  off the light's line mid-weave. moments.test.ts passes whole.

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
