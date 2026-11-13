# Round 7, the `simfix` lane: where the two sim lanes met

Written for the main lane. Branch `r7-simfix`, cut from `round-7` at 2c05cfe. Everything is still
`SIM_VERSION = 9` (it has not shipped). The pools are ridden again and committed, the graveyards re-pinned,
`npx tsc --noEmit` and `npm test` are green (72 files, 1441 tests).

What is measured comes from `scripts/playtest/lab.ts` (scripted pilots on the real sim, six seeds a mountain,
420 s cap), `race-lab.ts`, `pool-moments.ts`, `pool-fast.ts`, the new `twelve-times.ts`, and
`tests/simfix.test.ts`. Nothing here has been played by a person.

Lab outputs, in the main checkout: `shots/r7/lab/final.txt` and `.json` (the pilot lab), `final-falls.txt`
(the fall pricing), `final-race.txt` (the race lab), `final-twelve.txt` (The Twelve's home times). The
baseline is `shots/r7/lab/merged.txt`.

## For a player, in short

- A fall that slides over a stage line or the finish is credited on the tick it crosses.
- A landing on your head is always a landing: the Caldera's surge and the Blossom Leap's trick are decided as
  you come down, never left hanging to the far end.
- On Lanternfall a fall or a ward gutters the flame instead of putting it out. Ride back up to speed within
  four seconds and it catches again.
- Pool ghosts thread the Ice Cavern, stomp down Old Town, ring Temple Town's bells and feed a low flame.
- There is room beside the line above every leap and through every mogul field, and Mirror Lake's glass is
  clear 17 m either side of the line.
- The fast end of every pool is ridden by racers, and every Daily and Cup pool has two.

## Before and after

Set pieces won of those met (six seeds a mountain, five mountains), and finishes:

| Pilot | Finished, before | after | Median s, before | after | Set pieces, before | after |
| --- | --- | --- | --- | --- | --- | --- |
| hands-off | 5 of 5 | 5 of 5 | 149.7 | 150.0 | 2 of 15 | 1 of 15 |
| clumsy | 25 of 30 | 26 of 30 | 387.0 | 368.7 | 1 of 89 | 1 of 90 |
| novice | 30 of 30 | 30 of 30 | 155.2 | 154.8 | 20 of 90 | 18 of 90 |
| mid | 30 of 30 | 30 of 30 | 123.2 | 123.5 | 78 of 90 | 80 of 90 |
| expert | 30 of 30 | 30 of 30 | 125.5 | 122.6 | 77 of 90 | 82 of 90 |
| line | 30 of 30 | 30 of 30 | 153.6 | 144.6 | 3 of 90 | 6 of 90 |
| stunt | 30 of 30 | 30 of 30 | 137.1 | 132.5 | 26 of 90 | 31 of 90 |

By verb, mid and expert (before, then after):

| Verb | mid | expert | Verb | mid | expert |
| --- | --- | --- | --- | --- | --- |
| carry | 5, 5 | 5, 6 | race, sprint | 6, 6 | 6, 6 |
| collapse | 6, 6 | 6, 6 | rings | 5, 5 | 6, 6 |
| flourish | 6, 6 | 4, 6 | shatter | 6, 5 | 6, 5 |
| follow | 4, 4 | 4, 4 | slide | 3, 5 | 3, 6 |
| gates, sit | 4, 5 | 4, 4 | steps, hops | 5, 6 | 5, 6 |
| gates, swing | 6, 6 | 6, 6 | steps, stair | 6, 5 | 6, 6 |
| kindle | 4, 4 | 4, 3 | surge | 6, 6 | 6, 6 |
| race, chase | 6, 6 | 6, 6 | **all** | 78, 80 | 77, 82 |

The three requirements of the final lab:

- **The clumsy pilot finishes two thirds of its runs on every mountain:** Pinecrest 5 of 6, Frostfang 6,
  Ember 6, Sakura 5, Lanternfall 4 (the two that fail run out of the lab's 420 s; no wrecks). Lanternfall is
  exactly at the line, as it was before this lane.
- **Expert wins at least as many set pieces as mid:** 82 against 80.
- **No skilled pilot is faster for falling** (`final-falls.txt`, the steady-hand price): the least a fall cost
  was novice 1.03 s, mid 2.58, expert 1.28, stunt 2.52; none cheaper of 73 falls. On the closed-loop price
  two novice falls of 21 came out cheaper (0.1 s and 1.5 s), in the way the feel lane's notes describe: the
  untouched ride lost the time on its own. The clumsy pilot is the exception it was: 36 of 232.

## Decisions

### S1. A line is crossed on the tick the sled crosses it, falling or not

`lines()` ran only while riding, and a falling sled slides, so a rider who went down just short of a line was
credited when it stood up, up to 1.5 s late. It now runs every tick of a run. A stage line gives the get-ups
back to a rider still in the snow. A fall over the finish plays to its end in the square: the run is finished
on the crossing tick (`finishTick`), the fall's 90 ticks go on, and then the sled coasts. `step()` runs the
fall before the coast for that reason.

Measured (`tests/simfix.test.ts`, every mountain): the stage and finish events come while `tumble > 0`,
within 0.6 m of the line, and the fall is its whole length.

### S2. A botched landing is always said

`land()` now raises a `land` event for a landing that floors a racer too: `quality: 'sketchy'`,
`botched: true`, before whatever becomes of it (a fall, a ward, the wreck, or nothing in the grace after a
get-up). It scores nothing and is not counted in `stats.sketchies`.

- The surge and the flourish are decided on that tick. A botched landing loses the surge even when a ward or
  the grace keeps the rider up: "on its feet" does not mean saved.
- The carry counts it as a hit only when nothing else follows on that tick.
- A bot reads landings from this event. Before, a bot that came down on its head stayed in its air mode
  (hands off the steering) until its next takeoff. That is fixed by the same line.

Consumers that switch on `land` (sfx, rumble, camera, world) now see a sketchy landing on the same tick as
the fall. I did not listen to it or look at it: if the thud doubles with the fall's own sound, skip events
with `botched`.

### S3. The carry: a fall or a ward gutters the flame

The rule, as built (`sim.ts` `case 'carry'`, `moments.ts` `CARRY_*`):

- A fall or a ward **gutters** the flame. It takes a bite (`play.fall`, a tenth of a hit: 0.03 of a full
  flame in still air, 0.018 in the wind) and the clock stops.
- From the tick the rider is riding again it has `play.gutter` ticks (240, four seconds) to be back at the
  **flame's pace**: `flamePace(play, z)`, 0.6 of the speed the hill itself gives a sled at that place. On the
  steep chute that is 21 to 24 m/s, about three seconds of clean riding from a get-up's 15 m/s. In the flat
  finish square it is 8 to 10 m/s, under a get-up's own push, because nothing can be gained there: a fall in
  the square catches as the rider stands up.
- Back at pace it **catches**, with the seconds in hand it had when it guttered: what the flame had left to
  burn over what a tucked coast to the line from there, at that speed, would take. So a fall costs the bite
  and whatever the rider does next, never the pace it had made.
- A second fall or ward while it gutters puts it out. So does the time. A flame still guttering at the line
  lights nothing.

Why seconds in hand, and against a tucked coast: I tried three ways. Pausing the clock only: the rider is at
15 m/s where it was at 40, and lost the carry anyway (a forced fall cost mid 9 of 10 carries). Holding its
place against a plain coast: a skilled rider out-rides a plain coast from low speed, so a fall could leave it
better off. Against the best a sled does without a boost, a rider who falls and then rides perfectly ends
where it would have with no fall, less the bite.

**The state, for the world and the HUD:**

| Read | Means |
| --- | --- |
| `sim.mo.at` | Ticks left to be back at pace; 0 while the flame burns. It stands at `play.gutter` through the fall itself and counts down only while riding. `mo.at / play.gutter` is a meter. |
| `sim.mo.pace` | The flame, 1 to 0. While guttering it is the level the flame holds. On catching it jumps to the caught level, which can be higher than the held one after a fall in the square. |
| `flamePace(play, sim.s.z)` | The speed to ride back up to, m/s (`moments.ts`). |
| `moment` event, `phase: 'trail'` | The flame guttered (n: tenths). |
| `moment` event, `phase: 'lead'` | It caught again (n: tenths). |
| `moment` event, `phase: 'lost'` | It went out. |

The chip says "The flame gutters: ride" and "The flame catches" (`src/ui/momentcopy.ts`). The existing sfx
plays its trailing and leading stings for those two phases; nobody has heard whether they fit. Nothing is
drawn for guttering yet: `marqueeworld.ts` still draws the flame by `mo.pace` alone.

**Measured.** A fall or a ward forced on the carry at a set place, 24 seeds, carries won (before this lane
every one of these was lost):

| Pilot | no fall | fall at 3660 | 3800 | 3940 | 4120 | 4260 | 4400 | ward at 3660 | 4120 | 4400 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 9 | 8 | 8 | 5 | 12 | 9 | 6 | 2 | 4 | 5 |
| mid | 23 | 24 | 23 | 22 | 23 | 23 | 23 | 24 | 23 | 23 |
| expert | 24 | 24 | 23 | 24 | 24 | 24 | 24 | 24 | 23 | 24 |

(A ward costs the novice the lantern it would have dashed with, which is why its wards cost more than its
falls. The novice's 12 at 4120 against 9 with no fall is three rides in 24 of a pilot whose random stream
shifts after the fall; the deterministic test below is the one that says a fall never helps.)

`tests/simfix.test.ts`: a rider who only tucks wins the carry after any ward and after 4 of 5 falls in still
air; with a fall the flame reaches the line no higher than without, and the run is slower; a slow hands-off
coast loses with or without a fall.

**The tuning target, and where I did not reach it.**

| Carries won, 48 seeds | before | after |
| --- | --- | --- |
| clumsy | 0 of 44 | 0 of 46 |
| novice | 20 of 48 | 20 of 48 (still 14 of 22, wind 5 of 16, low flame 1 of 10) |
| mid | 45 of 48 | 46 of 48 |
| expert | 42 of 48 | 47 of 48 |
| line | 3 of 48 | 0 of 48 |

- **Novice: 42%, not half,** and 2 of 6 in the lab's six seeds. Guttering does not move it: the novice's lost
  carries are lost on the clock, and its wards spend the lantern its dash needed.
- **The clumsy pilot never wins a carry, and I do not think a pace rule can give it one.** Its quickest last
  880 m in 48 runs was 36.0 s, its median about 55 s, with six to ten scrapes on the way. A sled with nobody
  on it covers the same ground in 25.4 s and loses. Any flame the clumsy pilot could carry, hands-off carries
  too. The only rule I found that gets it there is one where catching refills the flame whatever the rider's
  pace had been, which makes falling on purpose in the last 150 m the way to win the finale. I did not build
  that. If the struggling player must light the lantern, it needs a different idea than pace (a dimmer
  lighting, or a carry that is not timed), and that is the owner's call.
- **Mid and expert are above "about 5 of 6"** because the lab's pilots now feed the low flame (S6); the rule
  did not get easier for them.

**The flame got shorter, because the careful line stopped hitting trees.** Once the line pilot rode unhurt
(S7) it won the carry in still air 3 of 3 by coasting: the flame was 27.4 s and a coast from the street
takes 25.4. `CARRY_SLACK` is 0.935 where it was 1.02: still air 25.1 s, wind 24.6 s (it was 25.4), the low
flame unchanged at 27.4 s from full. The line now loses still air by a third of a second. That is thin, and
the first thing to check if the course before the shrine changes.

### S4. Pool riders win the three set pieces they never won

It was the bot each time.

- **Sitting gates (the Ice Cavern).** The rider aimed at one gate, turned for the next only once it was
  past, and eased onto each new line over a second: 0.8 s a gate at 40 m/s. It now rides the slalom as one
  eased line through every gate (`slalomOff`), 0.4 of the half-width inside each, joined at once, with
  quicker hands and a nearer look while it lasts.
- **Hops (Old Town).** Three flights of 100 m have to fit in 390 m. The first pop came 110 m in and each
  waited for a perfect landing spot. Pops are now committed whole (`commitPop`), start at the street's top,
  and a stomp's hold becomes the next crouch.
- **Bells (Temple Town).** The first bell hangs 50 m in and the spring for it has to start before the
  street; the third comes a second after the second flight lands. Both are handled, and a rider under bells
  spins nothing.
- A rider who tries a set piece that wants control does not dash into it or in the three seconds before, and
  does not pop for fun on the way in. With a low flame it takes the last lip on the brazier's side.

Set pieces won of riders who met them, bundled pools:

| Set piece | before | after |
| --- | --- | --- |
| The Ice Cavern, gates sit | 0 of 45 | 11 of 47 |
| Old Town, steps hops | 0 of 47 | 12 of 49 |
| Temple Town, shatter | 0 of 46 | 27 of 50 |
| Petal Steps, steps stair | 5 of 46 | 30 of 50 |
| The First Flame, carry | 31 of 50 | 36 of 50 |

Skilled bots only (skill 0.55 to 1, 48 rides, of those who try): gates 23 of 36, hops 16 of 39, bells 32 of
37, the low flame 22 of 27.

Still low in the pools, and not looked at: the slide 6 of 49, the guide light 4 of 50, the Lamp Road 7 of
50, the rings 9 of 50, the flourish 9 of 50.

### S5. The Blossom Leap's rock: both, and I moved the rock

The lab's expert pops the kicker at the end of the fork above the leap at 35 m/s. The flight is 120 m,
past the kicker's own landing box, and comes down where the leap's section brings the line 8.6 m across
out of the fork's channel. The sled skips over the brow's lips, rides straight on while the line leaves
it, and meets a rock 4.5 m off the line 70 m above the lip, on the outside of the swing, at 41 to 44 m/s.
A person who pops that kicker at that speed meets it too, so it is a fairness matter.

- **The course** (`course.ts`): nothing stands within 5.5 m of the safe line for 80 m above any leap's lip
  (`LEAP_RUN_IN`), wherever the line goes on the way. The rock is gone.
- **The pilot**, two more things the rock had hidden. It crossed the lip at 9 m/s sideways, still steering
  back to the line, and flew into the bank: it now rides the last second square to the lip. And it read the
  lip's first tick as a landing, took the flight for a hop and spun where two flips were asked.

Forced variants, six seeds, expert: a spin and a flip 6 to 6, two spins 0 to 6, two flips 0 to 6.

### S6. The slide was a coin flip, and none of it was the rule

Three causes for 3 of 6:

1. **What stood on the lake stood from 8 m off the line.** A slide carries a sled 10 to 25 m across. Lake
   obstacles now keep to the shores, 17 m and more from the line (`lake` shape, `lane: 14.6`).
2. **The pilots swung wide before sliding.** On glass a swing is kept, so half their slides began already
   crossing at 15 m/s and ran off the far shore inside a second. They now run straight onto the ice and
   slide from a straight line. In a slide each way they press the key before the crouch, so the second
   slide goes the second way.
3. **They popped the kicker 85 m above the lake** and landed 110 m into its 270 m. They ride round it.

Forced variants, 24 seeds:

| Variant | mid before | after | expert before | after |
| --- | --- | --- | --- | --- |
| One long slide | 11 | 22 | 17 | 19 |
| A slide each way | 4 | 21 | 7 | 22 |

Novice, line and stunt stay at 0 of 24 in both. It is a test now: a rider who knows it wins it nine times
in ten, and one who does not wins none.

### S7. The careful line and the trees: it was the lab's pilot

The lab's line pilot had the mid pilot's spin habit (the test was `skill !== 'novice'`). Each spin's held
key pushed it 2 to 4 m off the line in the air, and it skipped down the landing face unable to steer back,
into trees 10 to 20 m out. The landing zones do not break the promise. With its hands still in the air:

| Line pilot, 60 runs | before | after |
| --- | --- | --- |
| Falls a run | 0.0 | 0.0 |
| Wards a run | 1.0 | 0.0 |
| Median s | 153.6 | 144.6 |

One real course fault turned up behind it: Frostfang's switchbacks at 3010 to 3054 hold a mogul field where
the line crosses 7 m, and the line pilot came out of it 4.7 m wide into a rock on every seed. Nothing now
stands within 5.5 m of the line through a mogul field and for 30 m past it (`MOGUL_EXIT`).

**Riding unhurt, the line pilot showed two gifts,** both fixed so `tests/moments.test.ts` "is never a gift"
holds: the near car of the Crevasse Fields' chase (lead 58 to 70 m: line 6 of 6 to 0 of 12, mid and expert
12 of 12, novice 4 of 12) and the carry in still air (S3). It also wins the collapse 6 of 6 now, where it
won 2: the test has always let it, and the moments lane left "should the collapse ask more" to you. It is
more pressing now.

### S8. Lanternfall's graveyards

`graves-pins.ts` prints every bundled mountain and `tests/graveyards.test.ts` pins the fifth. Five mountains
of up to four places need 20 names and there were 16, so `GRAVE_NAMES` has six more (Snuffed Wick, Candle
End, Long Sleep, Hollow Bell, Still Water, Cinder Rest). Names are picked by hash over the list's length, so
the other mountains' places are renamed too.

Pinned from the final pools: Pinecrest 428 (7), 1427 (8), 2047 (7), 2978 (7); Frostfang 2141 (2), 3104
(14), 3417 (3), 3878 (2); Ember 2143 (5), 3087 (3); Sakura 2130 (3), 2280 (2), 2969 (3), 3416 (4);
Lanternfall 1866 (2), 2069 (4), 2958 (2), 3879 (4). Eighteen places.

### S9. The field for skilled players

**The field** (`field.ts`): `FIELD_SLOW_MIN` 1.08 to 1.10 and `FIELD_SLOW_MAX` 1.12 to 1.16. `FIELD_CARROT`
and `FIELD_MORE` stay. Race lab on the final pools, runs 2 to 6, twelve orders, five mountains:

| Pilot | Live, fixed roles | Live, before | after | Quiet runs of 300, before | after | Passes a minute |
| --- | --- | --- | --- | --- | --- | --- |
| novice | 0.56 | 0.61 | 0.62 | 22 | 14 | 2.40 |
| mid | 0.64 | 0.73 | 0.73 | 10 | 10 | 3.47 |
| expert | 0.54 | 0.68 | 0.70 | 20 | 8 | 3.01 |
| stunt | 0.51 | 0.63 | 0.65 | 31 | 29 | 3.60 |

I swept fifteen settings. Nothing moved the live share by more than 0.01 to 0.02 except the count: an
eighth rider (`FIELD_MORE = 3`) is worth 0.02 to 0.03 for every pilot (mid 0.75, expert 0.74, stunt 0.68,
novice 0.64) and a ninth as much again. I left it at two: the feel lane kept nine for Haunted Hollow, and
nobody has timed an eighth rider on Low or the phone. It is one number if you want it. A tighter carrot
(0.96, 0.97, 0.98) lifts the expert to 0.72 and costs the mid and the stunt pilot quiet runs.

**The bot's ceiling: raised a little, not where a quick human is.** A `racer` style (`roster.ts`, `bot.ts`):
tucked on straights (a new `tuck` trait, which skilled crowd riders also have in part), every set piece
tried, every lantern a dash, fewer lapses. Like for like, skill 1, 48 runs a mountain on the Comet Bob:

| Mountain | Quickest, crowd's kind | racer | Quarter mark, crowd's kind | racer |
| --- | --- | --- | --- | --- |
| Pinecrest | 107.9 | 105.9 | 111.3 | 110.1 |
| Frostfang | 109.6 | 108.1 | 113.3 | 111.8 |
| Ember | 107.5 | 105.4 | 110.3 | 107.4 |
| Sakura | 106.8 | 104.0 | 109.4 | 106.7 |
| Lanternfall | 111.6 | 107.0 | 114.6 | 112.6 |

The pools' fast end is now eight racers, the quickest of 96 runs (it was 48). What the bundled pools hold:

| Pool | Riders | Quickest, before | after | Under 112 s, before | after |
| --- | --- | --- | --- | --- | --- |
| Pinecrest | 50 | 109.4 | 107.3 | 4 | 9 |
| Frostfang | 47 | 108.7 | 108.2 | 5 | 7 |
| Ember | 46 | 105.6 | 106.0 | 10 | 8 |
| Sakura | 50 | 108.3 | 104.5 | 6 | 15 |
| Lanternfall | 50 | 108.7 | 110.5 | 4 | 3 |

So the top is 2 to 4 s quicker on Pinecrest and Sakura, level on Frostfang and Ember, and 1.8 s slower on
Lanternfall. The before pools were ridden on the course as it was, so this table mixes the racers with this
lane's course changes; the like-for-like table above is the honest measure of the bot. A human at 103 s
still has nobody ahead on four mountains. A profile of the best bots says why: the sum of their best
250 m splits is 101 s on Pinecrest against a quickest run of 108, they carry 2.5 unspent lanterns to the
line, win one set piece in six, and are in the air half the run. What is missing is consistency, not a
trick.

**`fast` for the Daily's worker pool: two, from three tries each.** Timed in node on four Dailies: the pool
takes 0.8 to 1.6 s as it was (19 bot runs), and two racers from six more runs add about 0.25 s, a third
more work in the worker. Its quickest rider goes from 113.9 to 109.0, 109.3 to 108.2, 113.7 to 107.5 and
109.7 to 108.5. Twelve tries bought one more second on one day of four and cost twice as much. It is in
`ghost.worker.ts` (`fast: 2, fastTries: 3`), so a Cup pool gets it too. I did not time it in a browser or
on a phone.

## The Twelve's ladder: each rider's home time

From the final pools (`scripts/playtest/twelve-times.ts`, output in `shots/r7/lab/final-twelve.txt`). "Usual"
is the same rider (skill, style, sled) at home over 24 other seeds.

| Rung by skill | Rider | Skill | Home | Home record s | Falls and wards | Usual there, median (range) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Rosa Quill | 0.30 | Sakura | 140.5 | 2 | 127.8 (121.3 to 144.4) |
| 2 | Bram Oakhollow | 0.40 | Pinecrest | 129.3 | 2 | 127.3 (118.3 to 144.3) |
| 3 | Pip Thistle | 0.50 | Frostfang | 121.6 | 1 | 121.3 (111.3 to 129.7) |
| 4 | Juno Vale | 0.56 | Pinecrest | 121.0 | 0 | 125.4 (115.2 to 149.8) |
| 5 | Nessa Lumen | 0.64 | Sakura | 130.8 | 2 | 118.5 (109.6 to 127.8) |
| 6 | Tavi Rook | 0.70 | Frostfang | 121.4 | 2 | 119.1 (111.5 to 130.5) |
| 7 | Old Wren | 0.72 | Pinecrest | 120.7 | 4 | 121.5 (112.7 to 139.4) |
| 8 | Kaito Mori | 0.80 | Sakura | 113.3 | 0 | 113.6 (109.0 to 120.3) |
| 9 | Ivo Crag | 0.82 | Ember | 113.5 | 0 | 112.8 (109.8 to 119.0) |
| 10 | Suki Ember | 0.86 | Ember | 108.0 | 0 | 110.1 (107.0 to 115.7) |
| 11 | Mila Frost | 0.92 | Frostfang | 118.1 | 1 | 117.4 (111.6 to 126.7) |
| 12 | The Hollow King | 1.00 | Lanternfall | 117.7 | 0 | 115.2 (111.7 to 130.8) |

By home record, slowest first: Rosa 140.5, Nessa 130.8, Bram 129.3, Pip 121.6, Tavi 121.4, Juno 121.0,
Wren 120.7, Mila 118.1, the King 117.7, Ivo 113.5, Kaito 113.3, Suki 108.0.

What is luck and what is not:

- **Bad luck in the one run:** Nessa Lumen (130.8 against a usual 118.5, two falls: 12 s slow, and outside
  her own 24-seed range) and Rosa Quill (140.5 against 127.8, two falls). Rosa is last either way. Nessa
  is not really the second slowest: on her usual time she sits seventh, between Tavi and Mila.
- **Good luck:** Juno Vale (121.0 against a usual 125.4).
- **Old Wren is not the slowest at home in these pools** (120.7, seventh quickest of twelve, and that is her
  usual time). On the pools you looked at she was; here she is where her skill puts her.
- **Not luck, and the ladder will contradict it whatever the seed:**
  - Suki Ember is the quickest of the twelve at home (108.0, usual 110.1), quicker than Mila and the King.
    A dasher on Ember, the fastest mountain.
  - Mila Frost (0.92) is slower at home than Kaito (0.80), Ivo (0.82) and Suki (0.86): 117.4 usual. The
    liner style rides clean and slow: few tricks, so few landing boosts.
  - The Hollow King's home is Lanternfall, the slowest mountain (the pool's quickest is 110.5). He rides
    115 to 118 there and 109 to 111 on the other four. Three riders beat his home time on their own ground.

If the ladder should run by home time, the order that the usual times give is Rosa, Bram, Juno, Wren, Pip,
Tavi, Nessa, Mila, the King, Kaito, Ivo, Suki. If it should stay by skill with the King last, the two
things to change are in `roster.ts`, not the pools: Mila's style (or her skill), and either the King's
style on Lanternfall or the duel's target (a time relative to the mountain's pool rather than raw seconds).
A re-ride with another salt would fix Nessa and Rosa and nothing else.

## What the main lane must wire or decide

1. **The guttering flame is not drawn.** `mo.at`, `flamePace` and the `trail` and `lead` beats are there
   (S3). The world and the HUD need a flame that flickers low and a pace to ride to.
2. **`land` events with `botched`** reach sfx, rumble, camera and the world as a sketchy landing on the tick
   of a fall. Not heard, not seen (S2).
3. **The clumsy pilot and the carry** (S3): a decision, not a tuning.
4. **The collapse** is won by the careful line 6 of 6 (S7).
5. **An eighth rider** is worth 0.02 to 0.03 of live share if the tiers can carry it (S9).
6. **The Twelve's ladder** (above).
7. **Courses changed**, so anything pinned to where obstacles stand on a named mountain or a Daily moves:
   leap run-ins, mogul fields and lake shores lose obstacles, and a few neighbours shift. All 72 test files
   pass here; frames and captures taken before this lane show the old props.
8. **Graveyard names changed** on every mountain (S8).

## Text to fold in

*README, how a run goes.* "A fall that slides over a stage line or the finish counts from the moment it
crosses."

*README, set pieces, Lanternfall.* "A fall or a spent ward gutters the flame. Ride back up to speed within
four seconds and it catches again; fall again while it gutters and it is out."

*README, the fairness promise.* "Nothing stands within 5.5 m of the line where a sled cannot hold it: in a
kicker's landing, for 80 m above a leap's lip, and through a mogul field and 30 m past it. What stands on a
lake stands along its shores, 17 m from the line."

*README, dev tools.* `scripts/playtest/twelve-times.ts` (each signature rider's home record beside its usual
time), `pool-fast.ts --style racer`.

## Cost

- Sim: `lines()` runs on every tick of a run instead of only while riding (two comparisons). The carry calls
  `coastSeconds` twice a fall (up to 880 steps each), nothing otherwise. A carry's play holds one more array
  of 880 numbers.
- Pools: 33.6 to 39.1 KB each (they were 31 to 36). Generating them takes about three minutes where it took
  a minute and a half (96 fast-end runs a mountain).
- Daily and Cup worker pools: 25 bot runs where there were 19.
- No draw calls, triangles or frame JS. Nothing was timed in a browser.

## Touched outside my files

- `src/ui/momentcopy.ts`: the carry's two new chip lines.
- `src/game/graveyards.ts`: six more names.
- `src/workers/ghost.worker.ts`: `fast: 2, fastTries: 3`.
- `src/bot/roster.ts`: `'racer'` in `RideStyle`.
- `tests/fairness.test.ts` (a lake's obstacles 17 m out, was 8), `tests/graveyards.test.ts`,
  `tests/field.test.ts` (a comment).
- `scripts/playtest/moments-plan.ts`, `pool-fast.ts`, `graves-pins.ts`; new `twelve-times.ts`.
- `src/sim/moments.ts`, `course.ts`, the set pieces' part of `sim.ts` and `bot.ts`: the moments lane's, and
  mine for this task.

## Not finished, and fragile

- Nobody has played any of this. Whether "ride back up to speed" reads to a player in four seconds, with
  nothing drawn for it, is unknown.
- The careful line loses the still-air carry by 0.3 s (S3).
- The clumsy pilot finishes 4 of 6 on Lanternfall: exactly two thirds.
- The lab's six seeds hold one low flame and one still-air carry; the 48-seed counts in S3 are the ones to
  read for the carry.
- Novice set pieces went from 20 to 18 of 90, inside the noise of six seeds, but I did not chase it.
- The pools' slide, guide light, Lamp Road, rings and flourish are won by under a fifth of riders (S4).
- The bot is still 3 to 5 s short of a quick human at the top (S9).
- The diagnostic scripts I used for the carry, the forced falls and the bot's set pieces were scratch files
  and are not in the repository; the numbers above that come from them (the forced-fall table, the 48-seed
  carry counts, the skilled-bot counts) cannot be re-run from a committed script.
