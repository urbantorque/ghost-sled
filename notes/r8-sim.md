# Round 8, the sim lane (SIM_VERSION 10)

The design is `notes/r8-sim-design.md` (approved by the main lane with five answers: thresholds at every stage line,
a short grab held through a landing lands clean, grab and combination points halved, showdowns against The Twelve's
riders, your grudge, a friend's link and your own best, gentle variants out). This file is the lane's running notes.

## Stable interfaces

**Branch from `c20e5e4`** (on `r8-sim`). These names and shapes will not change in this batch; numbers behind them
(points, tunings) may.

**Tricks** (`src/sim/tricks.ts`)
- `TRICK` (ids 1 to 18), `TRICKS[id]`: `{ id, key, name, family, how, pose }`. `pose` is the line for `rider.ts`.
  `SIGNATURE[sledId]`: each sled's own move. `grabTier(ticks)`, the tier ticks `GRAB_T1/T2/T3`.
- In the air, `SledState`: `grab` (-1, 0, 1: the side held), `grabTicks`, `grabTier` (0 to 3), `tweak` (ticks a tweak
  has been held), `move` (the trick id the rider is posed in now: a grab's tier, a rail's or wall's move, the sled's
  own; 0 none).
- Event `{ type: 'grab', phase: 'start' | 'tier' | 'tweak' | 'release' | 'auto' | 'move', side, tier, trick }`: the
  pose and the sound's cue as it happens.
- On landing, every named trick is a `style` event carrying `trick` (its id), `halfTurns`, `flips`, `tier`, `late`
  (a late Crosswind) and `fresh` (new to the run). A plain spin keeps `kind: 'spin'` and a plain backflip `'flip'`
  (the director's callouts go on working); everything else is `kind: 'trick'`. The call is `TRICKS[trick].name`, a
  spin's size `halfTurns * 180`.
- `stats.trickMask`: tricks landed this run, a bit each by id.

**Charms** (`src/sim/charms.ts`)
- `CHARM` (ids 0 to 23), `CHARMS[id]`: `{ id, key, family: 'speed' | 'style' | 'survival', name, does, signal }`.
  `SYNERGIES` (`{ id, key, name, a, b, adds }`), `synergiesOf(mask)`, `STARTER_POOL`, `ALL_CHARMS`.
- Gates: `Sim.charmGates: CharmGate[]`, each `{ index, z, x, offers: [left, middle, right], lane, pick }`; `x` is the
  middle arch's centre (the safe line), arches `LANE_W` (4.6 m) apart, `laneX(x, lane)` an arch's centre,
  `laneOf(x, sledX)` the lane a sled is in. A gate's `offers` are dealt when the gate before it is decided (gate 0's
  at the start), so draw what is there; `-1` is an empty arch. `lane` and `pick` are -1 until crossed.
- `offersFor(chaosSeed, gate, pool, held)`: the same deal, pure (for a ghost's tag, the bot, a preview).
- Events `{ type: 'charm', gate, lane, id }` (id -1 for an empty arch) and `{ type: 'synergy', id }`.
- `Sim.charms` (ids in pick order), `Sim.charmMask`, `Sim.synergyMask`, `Sim.has(id)`, `Sim.hasPair(id)`.
- `SimConfig.charmPool` (24-bit mask; absent: `STARTER_POOL`).

**Rivals** (`src/sim/rivals.ts`)
- `RiderPoint { x, y, z, riding, clean, finished }`, `riderPoint(sim)`.
- `new RivalWatch(size, duel(i), steal(i), finishZ)`, `.step(tick, me, them[])` returns `RivalEvent[]`:
  `{ type: 'showdown', phase: 'start', rival, markerZ }`, `{ type: 'showdown', phase: 'won' | 'lost', rival,
  markerZ }`, `{ type: 'steal', rival }`. `.active` is the showdown under way (`{ rival, markerZ, t0 }`).
- `draftsOn(me, them)`: the slipstream rule (the game's, moved here).
- A won showdown and a steal go into the record as `LogEvent.Showdown` (2) and `LogEvent.Steal` (3); applied, the
  sim raises `{ type: 'rival', kind: 'showdown' | 'steal', gain }` and a `style` of kind `'showdown'` or `'steal'`.
  `stats.showdowns`, `stats.steals`.

**Spirit Flow**
- `SledState.flowLevel` (0 to 6, whole: what pays), `SledState.flow` (the eased value the picture reads, as before).
- Event `{ type: 'flow', level, from }` when the whole level changes.
- `stats.bestFlow` (highest level held a second), `stats.flowTicks[0..6]`.

**Records and replays** (`src/sim/replay.ts`)
- `RunRecord.charmPool?` (absent: `STARTER_POOL`). Record version 3: bytes 0 to 27 as before, the name, the pool as a
  u32, the log. `readHeader` reads versions 2 and 3.
- `simConfigOf(record)`: build every replay's Sim from this. `applyLogEvent(sim, e)`: apply every log token through
  this (revive, showdown, steal). Like a revive, a token clears the sim's events and raises its own: drain them
  before the next `step`.

## Touched outside my files

(Filled in as the game-layer wiring lands.)
