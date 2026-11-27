# Round 9, Gablefall's lane (milestone 3, the last of the three mountains)

The brief is `notes/r9-briefs/gablefall.md`; the rules `notes/r9-lanes.md`; the ground it stands on `notes/r9-ground.md`
(section 7, hook D) and how the other two were made, `notes/r9-oldrun.md` and `notes/r9-gullhaven.md`. Branch
`r9-gablefall`, cut by hand from `round-9` at 80779a7. Every figure here is the sim's, ridden by scripts; **nobody has
ridden Gablefall by hand, and nobody has listened to its score**. The gate on every commit was `tests/five.test.ts` (the
five's and the Dailies' courses, rolls and rides byte for byte) with the Old Run's and Gullhaven's tests; it held on each.
The world was built beside the lane by a world-builder subagent (its account: `notes/r9-gablefall-world.md`), the score by a
score-builder subagent (section 4 here).

---

## 0. Low's cost before the world (DECISIONS 392)

Measured first by the world builder on a stand-in town at the planned density (its notes, section 0): the near rows drawn
as the world would draw them, the town past both rows as one baked far piece a 128 m segment in one glowing material,
windows emissive in the house material, no lights. On a held Low run: **310 to 315 GL calls and 33 to 34 draws a frame
against Pinecrest's 350 to 417 and 37 to 43, at under half its triangles.** The design that keeps it level: the far town a
card a chunk, the windows in the material. It was built on that design (section 6 gives Low as built).

## 1. The roofs made to pay, in the lab

### The course as laid (`src/sim/gablefall.ts`, seed 0x5be0cd19, SHA-256's eighth initial word)

- **Three stages**, 900 / 950 / 950 (2,800 m): Church Hill, the Market, the Water Stairs. Kinds of its own only: `nave`
  (0 to 80 m down the church's nave from the steeple, 0.4, 6 m half-width: the start ramp), `square` (the close to 180 m,
  where the start gate stands, and each stage line's threshold, the market squares: 0.1, 12 m), `rooftops` (the street and
  its two rows: 0.22, 16 m, the corridor's edge at the rows' backs), `quay` (the finish on the river's ice: 0.04, 13 m,
  140 m before the line, 240 past). Mean grade to the line 0.198 (`BIOME_PARAMS.gablefall.slope` 0.2).
- **The street** is the course's own level (`baseY`), its middle the safe line; cobbles to 4.5 m (`COBBLES`, grip 1, drag
  1.25: the slow way), the pavement to the house fronts at 6 m. A sled let go rides it to the river.
- **The rows**, each side, from 6 m to 16 m: blocks of 2 to 4 houses of 14 to 20 m between alleys of 4 to 8 m. A house's
  roof: its eave 6 m over the street at its top, falling at `ROOF_GRADE` 0.2 along the street (the street falls 0.22), so
  each roof is a step under the last (0.3 to 0.4 m), never higher (`MIN_STEP` 0.3 holds it). Across, a gable whose ridge
  runs down the row's middle (11 m), `PITCH` 0.3, rounded over 7 m so a sled riding it is not pulled off it. Snow on
  slate (`ROOF`, drag 1.7: deep). An alley's floor lies 0.5 m under the next roof's surface at every x and rises to it by
  the alley's end, falling with it there. The house fronts and a drift's inner side are sheer (no ramp: a sled is on the
  roof or the pavement, never half way up a wall).
- **Corner drifts**: at the head of every row (both sides, from the close and each square) and every 130 to 170 m down each
  run, sides alternating (the longest gap between drifts 180.5 m). Each 44 m long: its rise over the street climbs evenly
  to its steepest a quarter of the way up and rolls over evenly to the next roof's surface at every x at its top
  (`driftRise`), its foot flush with the street (a sled steers onto it in its first 5 m).
- **Chimneys** (`ObstacleKind 'chimney'`, r 0.5 to 0.7, 1.6 to 2.2 m over the roof), 0 to 2 a house, at least 2 m off the
  ridge, 54 a km; the street's lane clear. A chimney met head on floors (`CrashCause 'chimney'`, "Met a chimney").
- **The street's bends**: wiggles of 2 to 4.5 m over 140 to 220 m down each run; the rows follow.
- **Rows end on a house** at least 20 m before a square or the quay (the world builder found a row ending on an alley
  standing at no level, 535 m over the street; fixed in c1c8811).

### Hook D, the held street (`sim.ts levelHold`, behind `levelOn`, false on every other course)

The design put the hold in `edge()`; it moved into the step, before the ground is read where the sled moves to: by the time
`edge()` runs, the ground step or the landing has already set the sled on what it met. A move onto ground more than 0.3 m
over where the sled was (`LEVEL_RISE`) is a wall unless the sled is in the air over it: it is turned back to where it was
across the street (the street bends under a sled, so its x alone may be on the roofs by the next tick: the lab found a sled
lifted 6.2 m that way), inside the street's own level if that is not enough, its motion across reflected as `edge()`
reflects it. A house front, a drift's side mid-ramp and an alley's floor seen from the pavement only scrape. And `land()`
reads the slope across the way the sled is going where the gradient reads a wall's (`LEVEL_WALL` 2; nothing ridden slopes
across more than 0.35): a sled landing beside a sheer side was thrown up at 50 m/s.

### Why the roofs did not pay at first, and what changed

1. **The first course** (roofs at 0.14, 1.1 to 1.6 m steps, every step a lip, pitch 0.35, fronts and drifts' sides on 0.3 m
   ramps): the mid pilot 113 s against the street's 129 (12%), but on the roofs for only 55% of the rows, dropping off them
   ten times a run. The lab's pilots and the bot aimed every flight at the street's middle (the five's safe line): now
   at the line they ride there (`labpilots.ts`, `bot.ts`, behind `hasLevels`). Then 92 s, 78%.
2. **A pop on a slope is long.** The sim's pop throws away a sled's downward speed (`vy = max(vy, 0) + pop`), so off a roof
   falling at 0.2 a pop flies 2 to 2.5 s and 60 to 90 m, whatever the step. Popping every step ran the pilots off their rows
   and gave a perfect landing a second: the roofs' speed ran away to the cap (45 m/s). So the steps are small (0.3 to
   0.4 m, a hop of under 0.3 s, a 'hop' with no stomp), and the lips are only a house's end over an alley or a drift.
3. **A sled riding the face of a ramped front was lifted** as the wall's height changed under it (1.2 m in a tick): the
   fronts and drifts' sides went sheer, and the hold was measured against the sled's own height (6.2 m lift, above).
4. **The drift's foot and line**: riders bound for a drift met its inner side mid-ramp and fell off it. The line leads to
   6.5 m over the pavement 60 m before the foot and is up on the ridge's line by 60% of the drift; a rider on its row is
   drawn back to the ridge from where it is over 30 m (15 m near the front eave). Drifts 44 m long with the rolled top (a
   36 m smoothstep threw a sled off its top at speed).
5. **The roofs ran too fast** once riders stayed on them (the mid pilot 86 s at 33 m/s, 45 m/s on Church Hill): deep snow on
   the roofs (drag 2.0, then 1.7 once the landing beside a wall stopped throwing sleds up). A rider who does not stomp is
   slower on the roofs than in the street; a stomped landing every alley is what pays.
6. **The bot** (`bot.ts`, behind `levels`): its landings aimed at its own line; a lip sprung only from the roofs; no light
   goal, no tuck and no pop for fun while it is in the street bound for a drift's foot; it plays the three set pieces.

### After (`npx tsx scripts/r9/gablefall-lab.ts`, heavy slot; `shots/r9/gablefall/gablefall-lab.txt`, `.json`)

Registered, its set pieces live, plain day:

| Pilot (6 seeds; bots 3) | Finished | Median time | Mean speed | On the roofs (of the run; of the rows) | Landings / perfect | Drops into the street |
| --- | --- | --- | --- | --- | --- | --- |
| a sled let go | 1/1 | 129.8 s | 21.6 m/s | 0% | 0 | 0 |
| careful line (the street) | 6/6 | 129.6 | 21.6 | 0% | 0 | 0 |
| novice | 6/6 | 124.4 | 22.5 | 0% | 10.5 / 2 | 0 |
| **mid** | 6/6 | **105.3** | **26.8** | **54% (75%)** | 24 / 23 | 3 |
| mid in the street | 6/6 | 129.7 | 21.6 | 0% | 0 | 0 |
| expert | 6/6 | 106.8 | 26.5 | 58% (79%) | 24 / 23 | 3 |
| bot 0.25 / 0.55 / 0.9 | 3/3 each | 119.8 / 109.8 / 106.9 | 23.4 / 25.6 / 26.2 | 7 / 50 / 46% (9 / 69 / 64%) | 10/5, 17/12, 17/12 | 0, 1, 3 |
| bot 0.9 racer | 3/3 | 101.1 | 27.8 | 53% (72%) | 16 / 12 | 3 |
| clumsy (30 seeds) | **30/30** | 326.6 (279 to 508) | | 2% | 0.6 falls a run, 89.7 scrapes | |

The mid pilot in each mood: 106.7 (Blizzard), 99.7, 110.0 (Glass Ice), 83.1 (Comet Night), 99.7, 113.4 s (Powder Day), all
finished. The drops are the set pieces' and the rows' ends: three a run (two squares and Market Day's street), and the
climbs back four (the row heads and the drift after Market Day). Air 47 to 55% of the mid pilot's run.

**Before** (the first course, the first quick run of two seeds, its file since overwritten): the mid pilot 113.4 s against
the street's 129.1 (12%), on the roofs 55% of the rows, nine or ten drops a run; the expert 102.9 s at 51%; the bot at 0.9 84 s.

**The bar** (printed by the lab, line by line):

- MET: the mid pilot on the roofs beats its own hands in the street by **19%** of the run's time (105.3 s against
  129.7 s; 10% or more).
- **SHORT as worded:** the expert on the roofs **58% of the run** (85% or more). 28% of the run is not rows at all (the nave,
  the close, the two market squares, the quay); of the rows it is on the roofs **79%** with the set pieces live (Market
  Day takes it down into the street for its awnings) and was **95%** before they were (the lab before 1a7cda8). The main
  lane's call (section 9).
- MET: the novice on the roofs **0%** (under 30%); the bot at 0.25 7% of the run.
- MET: the bot at 0.9 rides the roofs most of the way (64%, 73%, 55% of the rows) and lands most hops perfectly (11 of 16,
  12 of 17, 17 of 20).
- MET: the novice finishes 6 of 6 in the street; a drift back up at most **180.5 m** on from the last (250 or less).
- MET: **nobody is lifted onto a roof from below**: the most any sled's y rose in a tick on the ground 0.29 m (0.5 or less).
- MET: **nothing floors a rider but a chimney met head on or a flight of 0.75 s or more landed wrong**: 20 falls in every
  ride, 2 chimneys and 18 landings; house fronts and drifts' sides scrape (2,773 scrapes in all the rides, most of them the
  clumsy pilot's).
- MET: the clumsy pilot finishes **30 of 30** (the five's hardest, Pinecrest and Sakura, 27).
- MET (near): the mid pilot finishes in **105.3 s at 26.8 m/s** (the concept's about 100 s at about 28). In `r9-courses.ts`'s
  harness, with its lanterns and charms, quicker (section 5).
- `r9-courses.ts` treats it as new (section 5).

`tests/gablefall.test.ts` holds the ground design's list as promises (11): its descent (stages, thresholds, the quay, no
leaps or ledges, the gates); rows both sides ending on a house; the street clear, every obstacle a chimney on a roof clear
of the ridge; along every line across the rows every 0.5 m of x the ground never rises but up a drift or an alley's floor;
every drop off a roof (an eave, a step, an alley, a row's end) onto ground at most 9 m lower; a corner drift at each row's
head and at least every 250 m; all four events and no Daily or Cup to 2040; a sled at the street's level held to it on the
ground and in a pop everywhere but a drift's foot (where one steps on); no pilot lifted 0.5 m in a tick (the mid, expert,
novice and clumsy pilots); the clumsy pilot 6 of 6; the mid pilot's roofs 10% or more faster than its street, floored only
by a chimney or a landing.

### What is still short, or only a script's

- **Nobody has ridden it by hand.** Whether the roofs read as the way down and the street as the slow way, whether a person
  finds a drift's foot, holds a ridge, feels the step under each house, and whether thirty hops down a town feel like a
  rhythm or a chore: only a person can say.
- **The expert's 85% of the run on the roofs cannot be met as worded**: 28% of the run is not rows at all (the nave, the
  close, two market squares the thresholds' rules make at least 190 m each, the quay). Of the rows the expert rides 95% on
  the roofs with the set pieces off and 79% with them live (Market Day takes it down into the street for its awnings).
- **The bot rides slower than the lab's pilots** in the middle (0.55) and at 0.9, and its roof share swings by seed (55 to
  73% of the rows): it misses some drifts' feet. The pool is wide (section 3).
- **Popped flights are long** (2 to 2.5 s). The concept's "30 to 40 short hops of 0.5 to 1 s" is the alleys hopped without a
  pop; a pop is a long flight over a block.

## 2. The set pieces and legends (the sim's side; the world draws them)

Three verbs appended to `VERBS` after Gullhaven's (never reordered): `chain`, `awnings`, `washing`. Each on one of the kit's
own places (`gablePlaceOf`: 'roofrun', 'market', 'stairs'), a run of rooftops each, through a new optional `fplace` on
`moments.ts`'s internal `Def` and `LegendDef` (no shared type gains a field).

| Set piece | Verb | What wins it | Variants |
| --- | --- | --- | --- |
| The Roof Run (stage 1, 240 to 830 m) | `chain` | so many roofs landed in a row off flights of 0.4 s or more, never the street between (a sled on the street's level once it has begun ends it) | five roofs, six roofs, five stomped |
| Market Day (stage 2, 1,080 to 1,450 m) | `awnings` | so many stomped landings on the street's level, on its stalls' awnings (the street hung with them the whole way) | three, four, three in a row |
| The Washing Lines (stage 3, 2,060 to 2,460 m) | `washing` | each line over an alley on the rider's own row rung in the air within its reach of where it sags lowest | four lines (1.6 m), five lines (2.2 m), three at their lowest (1.1 m) |

The lab's sweep (`scripts/r9/gablefall-pieces.ts`, four seeds each; `shots/r9/gablefall/gablefall-pieces.txt`):

| Variant | novice | mid | expert | bot 0.25 | bot 0.55 | bot 0.9 |
| --- | --- | --- | --- | --- | --- | --- |
| roof run: five / six / five stomped | 0/4 each | 4, 1, 4 /4 | 4/4 each | 0/4 each | 0/4 each | 0/4 each |
| market day: three / four / three in a row | 0/4 each | 2, 4, 2 /4 | 3, 1, 3 /4 | 2, 0, 1 /4 | 1, 0, 0 /4 | 0/4 each |
| washing lines: four / five / three lowest | 0/4 each | 2, 1, 4 /4 | 1/4 each | 0/4 each | 2, 2, 1 /4 | 3/4 each |

Every variant is won by a skilled pilot. The bot never wins the Roof Run (its chain breaks in the street, where it still
drops at a drift it misses) and seldom Market Day (it does not leave the roofs for it often enough).

`tests/moments.test.ts` holds on Gablefall (every variant won by a skilled pilot, the careful line never handed one). Chip
words in `src/ui/momentcopy.ts` (each under 28 characters); nothing new on the HUD.

**Legends** (`LEGENDS.gablefall`): *Candlemas* (a sky over the Market's last roofs: "Every window in the town is lit for
Candlemas") and *The Lamplighter* (a runner down the last street to the river: "The lamplighter runs to the river: follow
his lamp").

*Where I left the concept:* the awnings are the whole market street's, not targets a stomp must find (a pop on the street
flies 60 to 90 m, so fixed awnings 40 m apart were found by luck); the washing lines are rung within reach across, in the
air over the alley, not by height (a pop at speed barely rises over the roof it leaves).

## 3. Registered, its home riders and its pool

- **Registered:** `MOUNTAINS[7]`, appended: `{ id: 'gablefall', name: 'Gablefall', tagline: 'A snowed-in town: ride its
  roofs down' (shortened after the phone cut the first at "stomp each land"), seed: 0x5be0cd19 (the lab's), unlockGhosts: 8 }`; `MountainId` gains it; its own look
  (`BiomeId 'gablefall'`, the world builder's); out of `BIOMES`; **all four events** (a clean, boost-free rider in the street
  outruns the avalanche in every mood: `scripts/r9/gablefall-avalanche.ts`, 58.8 to 61.6 s); `LEG_NAMES` already had it;
  `MOUNTAIN_NAMES`, `HOUR_PHRASES` ('at Evensong', the world's other hour), the Trials' `NAMES` and `HOURS`.
- **The first run laid round 124 s** (`FIRST_RUN_PACE.gablefall`, with the last pool): a run that does nothing (118.8 s)
  and one that only steers (120.0 s, 3% off the pace) both fourth (`scripts/r9/gablefall-floor.ts`; the third rider 116.7
  and 117.8 s). On Gablefall a sled let go rides the street as a steering hand does. The margin moves with the pool (130
  put both third; 127 second).
- **Home riders** (`HOME_RIDERS`, home 7; The Twelve stays twelve, never a duel): *Wren Slater* (stunt, 0.86, brim and bell:
  "Mends the slates she rides"), *Abel Thorne* (liner, 0.73, hood and star: rings the noon bells), *Hettie Lamb*
  (collector, 0.58, bobble and snowflake: takes the bread round by sled).
- **The pool** (`npx tsx scripts/generate-ghosts.ts --only gablefall`, alone in the heavy slot, about 24 s; generated twice,
  the last after the bot's drift fixes): **53 ghosts** (50 and the three home riders), every one finished, 41.9 KB. Finish
  times 89.3 to 172.5 s, median 119.5; the home riders 111.8 (Abel), 123.0 (Hettie), 125.2 s (Wren: a stunt rider spins
  away her time). `tests/ghostpool.test.ts` replays every record.
  - *Its spread is the widest* (p90/p10 1.49 against the five's 1.28 to 1.30, the Old Run's 1.14, Gullhaven's 1.36): the
    street's riders (125 to 172 s) and the roofs' (89 to 115).

## 4. Its score (the score builder's report, 99b375a)

`scripts/music/pieces/gablefall.ts`: **a winter march for the town on the hill**, F major at 95 bpm, 4/4, straight. Not the
concept's 128: `audiostems` keeps every pair of courses 8% apart in tempo (128 is 1.6% from Frostfang's 126 and 7.8% from
Ember's 138, and nothing between 104 and 152 is free) and every live tempo unique (96 is Sakura's); 95 is 9.5% under
Gullhaven's 104, and a beat is about one of the roofs' hops. Form the five's, 60 bars, 151.6 s (130 s before the results):
the tower's clock strikes three over the harmonium and the hand-bells ring rounds; the march (the street) in D minor
stepping down the hill; the hook (the roofs) in F; a hand-bell chorale; stage two with the toy piano an octave up; a
breakdown of hand-bells alone; the last stage a whole tone up in G; the motif under the tower bell; the reprise. **The hook
is the hop and the stomp**: a 16th off the eave, a leap up an octave held in the air, the landing stamped on the next beat,
each roof a step under the last over a bass stepping down. Hand-bells and a toy piano (new: `handBell()` within 0.2 cents,
`toyPiano()` within 1.1), pizzicato violins, cellos and basses, a toy drum, a bass drum, stomps, a triangle (new in
`perc.ts`), the harmonium and a church bell. Stingers (`OWN_GESTURES.gablefall`): `chain` (five quick leaps of a fourth,
each landing higher, to the octave), `awnings` (three heavy landings, each bouncing a sixth), `washing` (bells zig-zagging
up an alley, the last shaken). Measured: -16.1 LUFS, true peak -1.5 dBTP (-1.9 after Opus), pulse 95.2, spectrum distance
3.01 from the nearest (Lanternfall), the run's loudness range 5.6 to 5.9; spectral centroid 644 Hz (warm and dark: a town
heard through snowfall; whether too dark is a person's to say).

**Sizes:** the desk pack **5.79 MB**, Low and phones 3.08 MB (Opus) and 3.56 MB (AAC). **The whole score was built again**
(932 s, 15.5 minutes, version 897e7a63c35e); every other pack the same size, differing in 11 bytes inside its header's
stamp, the probes byte-identical, every other piece's analysis and manifest entries identical but for version, sha and
render time. `PIECE_OF.gablefall`, the jukebox's row and the three stingers' buttons; `tests/audiostems.test.ts` knows it.
Nobody has listened to it.

## 5. Against the five (`npx tsx scripts/playtest/r9-courses.ts`, heavy slot)

Written to `shots/r9/gablefall/r9-courses.txt` and `.json`; `r9-courselib.ts MECHANICS.gablefall`: on the roofs, over
ground 1.5 m or more over the street, on it or in the air over it.

| Measure (mid pilot, 6 seeds, lanterns and charms as the harness rides them) | Gablefall | The five's range | The Old Run | Gullhaven |
| --- | --- | --- | --- | --- |
| finish time | **98.8 s** | 121.3 to 129.4 | 83.7 | 138.8 |
| mean speed | **28.6 m/s** | 35.1 to 37.4 | 38.2 | 34.8 |
| air share | **47.6%** | 24 to 35% | 0% | 33.5% |
| turns a km of the safe line | **5.00** | 1.78 to 2.67 | 2.67 | 3.96 |
| mean width | 29.7 m | 24.6 to 31.1 | 15.6 | 29.9 |
| hazards a km | 53.9 | 43 to 126 | 0 | 0 |

- **New:** outside the five on 4 of 6 (time, speed, air, turns), **by 15% on 4**: met. Against the Old Run within 10% on
  none of the six; against Gullhaven on one (width): apart from both.
- **Fair:** the clumsy pilot finishes **30 of 30** against the five's hardest's 27. Met.
- **The mechanic:** on the roofs for **42.4%** of the mid pilot's run (the rows are 72% of its length).
- Also: the expert 103.5 s (5 of 18 set pieces), the mid pilot 7 of 18, the novice 124.4 s (0 of 18), the clumsy pilot
  324.3 s with 1.0 falls a run; its longest flight 3.07 s; slope 0.198 with a standard deviation of 0.063.

## 6. The world (built beside the lane; `notes/r9-gablefall-world.md` is its full account)

In short (the world builder's report and its notes):

- **The place:** a snowfall on a grey afternoon over a hill town. The run starts on the church's nave between pale
  pinnacles, the west tower and its spire behind; it goes down two rows of houses: steep slate roofs under snow, walls
  painted from a damp foot to a pale head, glazing bars, shutters, shops, window boxes, timber gates at the alleys'
  mouths, boards with flags holding the corner drifts. The street is trodden snow (no setts showing), the chimneys stone
  stacks, half of them smoking. Each market square has a gallery bridged over the street with three arched lights, one
  over each lane of the charm gate. At the foot the quay, the boathouse and the frozen river, the old stone bridge over
  the line with a banner of checks and townsfolk on it. Across the valley the town's other half and a viaduct fade into
  the snowfall. No pine, peak, panorama or lamplit square. **Evensong** (its other hour) and the mirror are drawn, not
  wired. No camera beat: the roof lens already shows the roofs and the street.
- **The set pieces' props** (`gablefallpieces.ts`, 4fb322a): the Roof Run a lantern under each front eave down both rows
  (53), lit as a roof is landed, an ember when the chain breaks; Market Day striped awnings in pairs, their edge 3 m over
  the street following its grade, a lamplit pool between each pair; the Washing Lines a line across each alley from a pole
  on its gate to one in the back lane, washing hung on it, jumping when rung. Nothing stands on the snow a sled rides.
- **The greyscale sort:** Gablefall's frames grouped alone, the set most unlike the rest. **Five critic rounds** (round 1
  open; rounds 2 to 5 blind pairs, the newer frames picked 9 of 10, 4 of 10, 7 of 10 and 5 of 10; round 3's loss mostly
  the lens's height, round 5's a groomed row that flattened the roofs, so the street alone is groomed now). The props and
  the last palette change (the air whiter, the shade a lighter lilac, to keep its palette apart from Gullhaven's) have had
  no critic.
- **Low as built:** on a held Low run 313.6 to 416.6 GL calls a frame against Pinecrest's 356.5 to 491.0 on the same
  stretches (8 to 24% under), 34.6 to 43.5 draws against 38.2 to 49.1, at half its triangles or less (68k to 89k against
  109k to 150k); programs 78 against 68 to 74. Section 0's design held with its places in.
- **The picker and the notices** (after registration; `gablefall-world-title.js`, save fixtures, desk and phone, console
  clean): eight chips in two rows of four, none clipped, Gablefall's own card; "Pass 5 more" on mid-1, "3 more ghosts open
  Gablefall" on novice-1; "Gablefall unlocked · Ride it from the title" fired on a novice-1 run (a dev-server reload
  interrupted that run, so the notice came on an unheld run). On the phone Ride's tagline was cut ("...stomp each land"):
  the tagline is now "A snowed-in town: ride its roofs down" (not looked at again in a browser).
- **Short** (its section 8): a dotted seam at the nave's brink, not traced; dark smudges at the lens from near snowflakes
  (the shared weather); a beam streak on the ice; the house fronts warm orange at Evensong; the quay's townsfolk read as
  boxes; speckle in the far town at the vanishing point. The key art depends on which ghost the title reel picks: on
  mid-100 the hero rides the roofs and the shot works, on novice-5 it rides the street and a house front fills a third of
  the frame.

## 7. Eight mountains (the switch, DECISIONS 394 answers 6 and 8)

- **The Long Night** rides sixteen legs (`modes.ts LEGS` from `NIGHT` once all three are registered, no edit needed):
  Pinecrest, Frostfang, Gablefall, Ember, the Old Run, Sakura, Gullhaven, Lanternfall, then the eight mirrored, Lanternfall
  the finale of each half. A saved best stays a count of legs: a best of 3 legs was Ember's and is now Gablefall's (the
  main lane's answer 6: kept as a count, no archive). The Almanac's last night page opens every leg. `tests/spine.test.ts`
  moves to sixteen.
- **The Trials** turn over all eight from `EIGHT_FROM` = **'2028-W01', a placeholder** for the main lane to set at release
  (with `EIGHT_START`, 5: the eight open on Gablefall, as 2027-W52 is Ember's). Past every week `tests/five.test.ts` folds
  in (to 2027-W40), so the five's fingerprint holds; a release week inside that range changes the chaos digest's Trials
  and the fingerprint must be taken again. Two faults the switch woke, both fixed in `trial.ts` and touching no five's
  week: an eight week whose event its mountain cannot meet was made plain after the family rule ran, a clock with no twist
  (a Cup on a named course): the family rule runs again after it; and "Mirrored The Old Run in a Light Storm" was eight
  words: Trials say "Old Run", as its chip does.
- **What a saved game sees:** Gablefall's chip and card on the title's picker at 8 ghosts (a save past 8 opens it at once;
  a save past 32 all three), its board, its first run laid round 124 s, a night of sixteen legs, and from the switch week the
  Trials over eight. `save.ts` untouched; an old save loads.

## 8. Only scripts have seen it

Every figure in sections 1 to 5 is the sim's, ridden by the lab's pilots, the clumsy pilot and the bot. Nobody has ridden
Gablefall by hand: not a roof, not a drift's foot, not the street, not a set piece, not the bot's field around a person.
The score has been rendered, measured and level-checked by the build and the stems test, and listened to by nobody. The
world builder saw its frames (staged, a sled held on a line) and what its notes list; everything else of the world in
motion only scripts have touched.

**The suites:** the full suite in the heavy slot with everything in (`shots/r9/gablefall/full-suite.txt`, 134 s): **118
files, 2,140 of 2,141 passed**; the one failure, `tests/modes.test.ts`'s night beat still counting ten legs, fixed (sixteen)
and that file and `spine.test.ts` run again green. `tsc` clean. `tests/five.test.ts` green at every commit.

## 9. For the main lane

### To decide

1. **The expert's 85% of the run on the roofs** (section 1): not reachable as worded, since 28% of the run is the nave, the
   close, the two market squares (the thresholds' shared rules make each at least 190 m) and the quay. Of the rows the
   expert is on the roofs 95% with the set pieces off and 79% with them live. Read the bar of the rows, or ask for roofs
   over the squares (a market on a terrace at the roofs' level, which would change the thresholds' ground).
2. **Market Day takes riders off the roofs into the street** (section 2): a set piece for the street, by design (the
   novice's), but the skilled pay the street's slowness to play it. Keep, or move the awnings onto the roofs.
3. **Popped flights are long** (2 to 2.5 s, 60 to 90 m; section 1, the pop on a slope): the concept's short hops are the
   alleys hopped without a pop. The sim's pop rule is everyone's; nothing of it was changed.
4. **The pool is the widest** (p90/p10 1.49; section 3): the street's riders and the roofs'. Its character, I think, as
   Gullhaven's was kept; a person should see a field of it. The bot rides slower than the lab's pilots at 0.55 and 0.9.
5. **The first run laid round 124 s** with a margin of about 2 s (section 3): a sled let go rides the street as a steering
   hand does. Check in the hand ride, as 397 and 400 did for the other two.
6. **The mid pilot 105 s at 27 m/s in the lab** (99 s at 28.6 with lanterns and charms), the concept's about 100 at 28.
7. **The concept's tempo** (128) could not be kept: the score is a march at 95 (section 4).
8. **EIGHT_FROM is a placeholder** ('2028-W01', EIGHT_START 5): set the release week with EIGHT_START; a week inside
   2027-W11 to W40 changes `tests/five.test.ts`'s chaos digest (section 7).
9. **Two Trials faults the switch woke**, fixed in `trial.ts` (section 7): an eight week made plain by its mountain's
   events now keeps a charm family, and Trials say "Old Run".
10. **Hook D moved into the step** (section 1), and `land()` reads the slope across the way the sled goes beside a wall:
    both behind `levelOn`, never on the five (the fingerprint held), but sim behaviour beyond "new numbers", as 394's
    track changes were.
11. **Low** as the world builder reports it (section 6); frames a second are the main lane's to time.
12. **The score's whole rebuild** (99b375a) landed on top of Gullhaven's packs; every other pack changed only by its
    stamp.
13. **The title's key art on Gablefall depends on the ghost the reel picks**: on mid-100 the hero rides the roofs and the
    shot works; on novice-5 it rides the street and a house front fills a third of the frame (the world builder's probe).
    The reel could prefer a roof rider there.

### Shared files (every hunk)

- `src/game/app.ts`: `crashText`'s `'chimney'` case ("Met a chimney"). `save.ts`, `src/render/spineview.ts`, `src/ui/ui.ts`:
  untouched.
- `src/ui/contract.ts`: `MountainCard['biome']` gains `'gablefall'` (the world builder's). `src/ui/art.ts`: `RIDGES.gablefall`
  and `SKY.gablefall` (the world builder's). `src/ui/momentcopy.ts`: the `chain`, `awnings` and `washing` cases.
- `src/game/almanac.ts` (`MOUNTAIN_NAMES`, `HOUR_PHRASES` 'at Evensong'), `field.ts` (`FIRST_RUN_PACE.gablefall` 124),
  `trial.ts` (`NAMES` with "Old Run", `HOURS`, `EIGHT_FROM`, `EIGHT_START`, the family rule after the event mask),
  `keyart.ts` (`TITLE_SHOTS.gablefall`, the world builder's). `modes.ts`: untouched (sixteen legs follow from `MOUNTAINS`).
- `src/sim/course.ts`: Gablefall's kinds in `SectionKind`, `SECTION_KINDS`, `SHAPES`, `GRADE`, `WIDTH`, `BLEND`, `BODY`; its
  rows in `TALL`, `LOW`, `CLIFFS`, `SCRIPTS`, `SIGNATURES`, `LAYOUTS`, `KITS`; `ObstacleKind 'chimney'`; `hasLevels` and
  `streetAt`. `src/sim/kit.ts`: `Street` and the kit's `street` hook. `src/sim/mountains.ts`: `GABLEFALL_SEED`,
  `MOUNTAINS[7]`, `MountainId`, `BIOME_PARAMS.gablefall`, `BIOME_BY_SEED` (and `BiomeId`, the world builder's).
- `src/sim/sim.ts`: `CrashCause 'chimney'` and the collide's cause; `levelOn`, `levelHold` and its two calls (ground step,
  air step), `LEVEL_RISE`, `LEVEL_WALL` and `land()`'s slope across beside a wall; `CHAIN_UP`, `STREET_LEVEL`; the
  `chain`, `awnings` and `washing` cases in `momentStep` and `momentCount`.
- `src/sim/moments.ts`: the three verbs appended to the union and `VERBS`, their variants, `CHAIN_FLIGHT`, `AWNING_STEP`,
  `fplace` on `Def` and `LegendDef`, `AUTHORED.gablefall`, `LEGENDS.gablefall`, their builders, the place lookups in
  `planMoments` and `planLegends`.
- `src/bot/bot.ts` (`levels`, its landings aimed at its line, `inStreet` for Market Day, the washing lines' and the
  awnings' plays, `atStreet`, `driftBound`, the lip from the roofs only, no light or tuck bound for a drift), `roster.ts`
  (`HOME_RIDERS` gains three); `scripts/playtest/labpilots.ts` (`levels`: flights aimed at the kit's line, the drift
  for the kit's line, the awnings' and the washing lines' plays, `Act.lips`), `moments-plan.ts`, `r9-courselib.ts`
  (`MECHANICS.gablefall`).
- `src/audio/listen.ts` and `src/render/landmarks.ts` (the kinds in their `Record<SectionKind>` tables),
  `src/render/meshes.ts` and `props.ts` (the chimney's mesh and batch; the world builder's real one replaced my stand-in),
  `src/audio/sfx.ts` (the chimney knocks as a rock). The score builder's `score.ts`, `theory.ts`, `stemform.ts`,
  `jukebox.ts` rows (section 4); the world builder's render hunks (its notes, section 2).
- **Where round-9 has moved since the cut** (G6's sets and The Twelve's gate fix): of `src/render/meshes.ts`, `rider.ts`,
  `spiritflow.ts`, `ghosts.ts`, `src/game/garage.ts` and `twelve.ts`, this branch touches only `meshes.ts`: 26 added
  lines, the chimney (`obstacleGeometry`'s `'chimney'` case and its geometry: my stand-in in 4776790, the world builder's
  stone stack in 06619d8), nothing else in the file.
- `src/ui/harness.ts` (the dev harness): Gablefall's card row given its own biome and tagline.
- Tests: `tests/modes.test.ts` (the night's legs sixteen, the ninth Pinecrest mirrored), `tests/gablefall.test.ts` (new, 11), `tests/moments.test.ts` (Gablefall's verbs), `tests/spine.test.ts`
  (sixteen legs), `tests/r8bars.test.ts` (the clumsy bar's six rides a mountain given five minutes), the score builder's
  `tests/audiostems.test.ts`, the world builder's `tests/gablefallworld.test.ts` and render suites.

### Text for ART.md 15

`notes/r9-gablefall-world.md` (its text for section 15).

### Text for DECISIONS

401. **Gablefall built: the roofs made to pay in the lab, then the last of the three mountains, and the game is eight**
    (`r9-gablefall`, 4776790 to its last commit; `notes/r9-gablefall.md`, `notes/r9-gablefall-world.md`).
    - *Low first:* a stand-in town at the planned density, its far rows one baked piece a segment and its windows in the
      material, cost 310 to 315 GL calls and 33 to 34 draws on a held Low run against Pinecrest's 350 to 417 and 37 to 43.
      The world was built on that design.
    - *Why the roofs did not pay at first:* the lab's pilots and the bot aimed every flight at the street's middle; every
      roof step was a lip, and a pop on a slope flies two seconds whatever the step, so the riders flew off their rows and
      the stomps ran the roofs' speed to the cap; a ramped house front lifted a sled riding its face, and the street bending
      under a sled held at the front lifted another 6 m; a landing beside a sheer wall threw a sled up at 50 m/s.
    - *What makes it pay:* small steps (a roof at 0.2 under a street at 0.22) and lips only over alleys and drifts; deep snow
      on the roofs (drag 1.7) and cobbles in the street (1.25), so a stomped landing every alley is what pays; sheer fronts
      and drifts' sides with the hold in the step, measured against the sled's own height and turned back across the
      street; drifts 44 m with a rolled top, every 130 to 170 m and at every row's head; the pilots and the bot riding the
      ridge of their row and aiming their flights there. The five's fingerprint held at every commit.
    - *The bar:* the mid pilot's roofs 19% faster than its own hands in the street (105 s against 130), on the roofs 75% of
      the rows; the novice in the street (0%); the bot at 0.9 on the roofs 55 to 73% of the rows, most hops perfect; a drift
      within 181 m; nobody lifted more than 0.29 m in a tick; no fall but a chimney or a long flight landed wrong; the
      clumsy pilot 30 of 30; the mid pilot 105 s at 27 m/s. Short as worded: the expert on the roofs 58% of the run (the
      rows are 72% of it; 95% of them before the set pieces, 79% with them). New against the five on 4 of 6 measures, all
      four by 15%; apart from the Old Run and Gullhaven; on the roofs 42% of the run.
    - *A mountain:* `MOUNTAINS[7]`, appended, id `gablefall`, seed 0x5be0cd19 (the lab's; no Daily's or Cup's to 2040),
      opening at 8 ghosts; its own look, out of `BIOMES`; all four events; three set pieces on appended verbs (`chain` the
      Roof Run, `awnings` Market Day, `washing` the Washing Lines), two legends (Candlemas, the Lamplighter), three home
      riders (Wren Slater, Abel Thorne, Hettie Lamb; never a duel); its first run laid round 124 s; a pool of 53, 89 to
      173 s, the widest (p90/p10 1.49); a winter march in F at 95 for hand-bells and a toy piano over pizzicato strings,
      5.79 MB on the desk and 3.08 to 3.56 MB on Low and phones. The whole score built again, every other pack's stamp
      changed and nothing else.
    - *Eight:* the Long Night sixteen legs in the ladder's order; the Trials over all eight from a placeholder week
      (2028-W01, to be set at release), two faults the switch woke fixed (an eight week made plain keeps its charm family;
      "Old Run" in a Trial's name).
    - *Its world:* a snowfall on a grey afternoon over a hill town, the run on the church's nave between pale pinnacles,
      two rows of steep slate roofs under snow with lit windows over a street of trodden snow, chimneys of stone, a
      gallery with three arched lights over each market square's charm gate, the quay, the boathouse, the frozen river
      and the old stone bridge over the line; across the valley the town's other half and a viaduct in the snow; no pine,
      peak, panorama or lamplit square; at Evensong its other hour. A fresh blind critic sorted its greyscale frames alone;
      five critic rounds. Low on a held run 8 to 24% under Pinecrest's GL calls, 2 to 7 draws under, at half its
      triangles or less.
    - Nobody has ridden it by hand, and nobody has listened to its score.
