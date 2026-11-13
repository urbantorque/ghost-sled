# Round 7, the `moments` lane: set pieces that never repeat, and the fifth mountain in the sim

All sim work here ships under `SIM_VERSION = 9`. Pools are not committed (the main lane rides them again after the
merge): `tests/ghostpool`, `nearmiss`, `slowriders`, `graveyards` and `ladder` fail on the stale pools and pass on
pools regenerated locally with `npm run generate-ghosts`.

What is measured below comes from `scripts/playtest/lab.ts` (scripted pilots on the real sim, six seeds a mountain),
`scripts/playtest/moments-plan.ts` and `tests/moments.test.ts`. Nothing here has been played by a person.

## For a player, in short

- Fifteen set pieces play twelve different ways. No verb is in the game more than twice, a mountain's three are
  three different ideas, and where a verb is used twice the two play differently.
- Each set piece has two or three variants, picked by the run's own seed, so the tenth run is not the first.
- About one run in ten after a session's first has a legend moment: ten of them, two a mountain.
- Lanternfall is a fifth mountain: follow a guide light through cloud, light a road of stone lamps, carry a flame to
  the great lantern at the line.
- A skilled rider wins more set pieces than a middling one, and a rider who does nothing wins almost none.

## The set pieces

| Mountain | Stage 1 | Stage 2 | Stage 3 |
| --- | --- | --- | --- |
| Pinecrest | The First Drop: **rings** (low, far side, high: pop off the lip) | Mirror Lake: **slide** (one long slide, a slide each way) | Old Town: **steps, hops** (three stomps of your own pops, or three in a row) |
| Frostfang | Serac Gate: **collapse** (chased, in surges, from the far end to a keystone) | The Crevasse Fields: **race, chase** (one car near, one far, two on the rope) | The Ice Cavern: **gates, sit** (turn about, from the other wall, two and two) |
| Ember | Cinder Gate: **race, sprint** (leaves as you arrive, left early, leaves late) | The Caldera Leap: **surge** (44 m/s off the lip, or 47: only a dash will do) | Ash Market: **gates, swing** (steady sway, against each other, slow and wide) |
| Sakura | Petal Steps: **steps, stair** (three of four, three in a row) | The Blossom Leap: **flourish** (a spin and a flip, two spins, two flips) | Temple Town: **shatter** (bells hung level, each higher, along one wall) |
| Lanternfall | The Cloud Sea: **follow** (slow wide weave, quick weave, it darts) | The Lamp Road: **kindle** (both rows dark, one row dark, one row then the other) | The First Flame: **carry** (still air, a wind, a low flame fed at a brazier) |

Verbs used twice: race (sprint, chase), gates (sit, swing), steps (stair, hops). The other nine are used once.
`tests/moments.test.ts` holds all of this ("uses no verb more than twice in the game...").

## Decisions

Each with the reason a player would feel it and the measurement.

### M1. Lanternfall is in the sim as the fifth mountain

- `MOUNTAINS[4]`: id `lanternfall`, seed `0x510e527f`, a new course biome `lantern`.
- **One place borrows a look.** `mountains.ts` has two types: `BiomeId` (the four looks the world and the music are
  dressed for, unchanged) and `CourseBiome = BiomeId | 'lantern'` (what the sim builds). `LOOK` maps `lantern` to
  `glacier`, marked `// r7: placeholder until the Lanternfall world lane`, and `Course.biome`/`biomeForSeed` return
  the look, so no `Record<BiomeId, ...>` in `src/render` or `src/audio` had to change. `Course.trueBiome` and
  `courseBiomeForSeed` say what the course really is. **To build Lanternfall's world:** add `'lantern'` to `BiomeId`,
  delete `LOOK`, and the compiler lists every table to fill.
- **Its descent** (stage lines at 1450, 2950, 4500, as everywhere):

  | Stage | Sections (metres) | The direction's row |
  | --- | --- | --- |
  | The Cloud Sea | start 0, bowl 120, cruise 373, **leap, lip 605, a 20 m cliff** (the dive off the Crown), ravine 825 to 1157, switchbacks 1157 to 1450 | The Crown above the cloud, then the Cloud Sea |
  | The Lamp Road | **leap, lip 1568, a 23 m cliff** (the break out under the deck), fork 1788, street 2099 to 2318 (the Lamp Road's avenue), bridge 2318, treerun 2492 (the lamp grove), bowl 2710 | The break, the Lamp Road |
  | Firstlight | benches 2950, bridge 3203, street 3390 to 3621, chute 3621, **leap, lip 3980, a 21 m cliff**, finish square 4200, line 4500 | Firstlight |

  `Course.cloud` gives the cloud sea's extent for whoever draws it (the two lips). The sim never reads it: closing
  visibility is the world's.
- **Nothing launches a sled in the cloud.** Kickers are left out of Lanternfall from 800 m to the second lip
  (`course.ts`): the cloud is ridden blind behind a light, and a kicker there threw sleds the rider could not see
  coming.
- **Obstacles are stand-ins from existing kinds** (no new `ObstacleKind`, so `props.ts` and `meshes.ts` are
  untouched): standing stones are `spire` and `basalt`, stone lamps are Sakura's `lantern`.
- **Avenues of stone lamps.** On Lanternfall a street stands between two rows of stone lamps (`lantern` obstacles), a
  pair every 20 m, 4.1 to 4.2 m off the safe line. The fairness test covers them like any obstacle.
- **The seed was chosen among eight.** Five broke a promise the fairness or the budget tests make. `0x9b05688c` and
  `0x510e527f` passed everything; the lane's first pick was the former, and it moved to the latter when the cloud
  sea's set piece was tuned (the previous agent's uncommitted work, kept: all fairness tests pass on it).
- **Unlock: a placeholder.** `MountainDef.finale` marks it; until The Twelve opens it, it opens like the others, at
  48 lifetime passes (`unlockGhosts`). `?debug&m=4` opens it in dev.
- **The Hollow King's home is Lanternfall** (`roster.ts`, `home: 4`): the board's "Beat The Hollow King to the line"
  star is Lanternfall's, and he rides there a touch better.

### M2. Twelve verbs, none more than twice

Reason: the review found twelve set pieces sharing five verbs. Now a mountain's three ask for three different
things with the hands: Pinecrest is a line, a drift and pops; Sakura is stomps, a trick and timed pops.

- **slide** (Mirror Lake, was a race): hold one drift on the lake's glass ice, 2.2 s, or 0.75 s each way.
- **shatter** (Temple Town, was gates): be up in the air under each of three bells as high as it hangs. The action
  button's, not the steering's.
- **surge** (the Caldera Leap, was rings): leave the lip at 44 m/s (or 47) and land past the far line on your feet.
  The speed off the lip is what counts, so a pop cannot fly it; the chip says the speed as the sled leaves.
- **flourish** (the Blossom Leap, was rings): land a named trick clean over the leap.
- **steps, hops** (Old Town, was gates): stomp three landings your own pops make down the street.
- **race, chase** (the Crevasse Fields): the ropeway left before you; pass it before the far station.
- **gates, swing** (Ash Market): each gate sways across the run; read it and thread it.
- **follow, kindle, carry** are Lanternfall's (M1).
- A Daily or a Cup picks a verb its run has not played yet for each stage's biggest place (`PICK`).

Measured: the table above; the test "uses no verb more than twice".

### M3. Two or three seeded variants of every set piece

Reason: the tenth run is not the first. `variantOf(roll, index, count)` hashes the run's own roll seed, which the
record carries, so a ghost rides the variant of its own run and a replay meets the same one. Variants are even, and
a session's first run rolls a variant like any other (only legends wait for the second run).

Measured (`moments-plan.ts --rolls 3000`, a mountain): every variant of a three-variant set piece comes up on
31% to 36% of runs, and of a two-variant one on 49% to 51%. Pinecrest: the First Drop low 34%, far 33%, high 33%;
Mirror Lake long 50%, both 50%; Old Town three 49%, row 51%. Lanternfall: the Cloud Sea wide 32%, quick 34%,
darts 34%; the Lamp Road both 33%, row 34%, halves 34%; the First Flame still 34%, wind 33%, ember 33%.

### M4. Legend moments: two a mountain, about one run in ten, never a session's first

`chaos.ts` rolls `ChaosRoll.legend` (1 or 2) on a stream of its own, only on a run with no mid-run event, at
`LEGEND_CHANCE = 0.15`: two runs in three have no event, so one run in ten. `rollChaos(seed, 0)` is always plain.
The record carries it in the mood byte's high half.

| Mountain | Legend 1 | Legend 2 |
| --- | --- | --- |
| Pinecrest | The White Stag (runner, the first tree run) | The Lantern Fleet (sky, over Mirror Lake) |
| Frostfang | The Aurora Comes Down (ribbon, the last switchbacks) | The Ghost Herd (runner, the chute) |
| Ember | The Cone Wakes (sky, the first bridge) | The Cinder Wyrm (runner, the second ravine) |
| Sakura | The Lantern Dragon (runner, the benches) | The Thousand Cranes (sky, the last leap) |
| Lanternfall | The Great Rising (sky, the break out of the cloud) | The Tall Lamplighter (ribbon, the lamp grove) |

Three kinds, all fair to every rider: a **runner** lays spirit lights along its weaving line ahead of the rider
(14 m apart, the last worth three); a **ribbon** is a lane of light that charges the lantern while the sled is in
it, up to one lantern; a **sky** legend is spectacle only. No collider, nothing on the safe line, nothing that
slows. A runner and a ribbon never share ground with a set piece.

Measured (`moments-plan.ts --rolls 3000`, 2,500 of them after a session's first): any legend on one later run in
10.8 (Pinecrest), 9.8 (Frostfang), 9.6 (Ember), 10.7 (Sakura) and 10.2 (Lanternfall); each single legend on one
later run in 18 to 22; on a first run, 0 of 500 on every mountain. In the test, 4,000 rolled runs after a first give one legend in 8 to 15 and none in
2,000 first runs; the careful line rides every legend on every mountain hit no more, and no slower, than on a plain
day.

Known weak spot: the Ghost Herd's line on Frostfang's chute has no room to weave (widest 0.0 m), so its lights lie
on the safe line and every rider takes them. It is still a legend to look at; it wants a wider place or a ribbon.

### M5. Mastery is never punished

The baseline (`shots/r7/lab/before.txt`): expert 36 of 72 set pieces, mid 50, the careful line 13, hands-off 5 of 11.

After (same lab, six seeds a mountain, five mountains): **expert 77 of 90, mid 76 of 90**, novice 22 of 88, the
stunt pilot 27 of 88, the careful line 3 of 90, hands-off 2 of 15.

Two things did it, and they are reported apart because only one of them is the game:

1. **The set pieces changed** (the game). Each of these was a place where riding fast or well lost:
   - Petal Steps asked for every step landed clean, which the careful line won by doing nothing (6 of 6) and the
     expert lost by flying two steps at once (0 of 6). Now a stomp is what counts, three of them: expert 6 of 6,
     mid 6 of 6, line 0 of 6.
   - A ring line set for a 34 m/s roll-off was flown over by anyone faster. The Caldera's rings became the surge
     (speed is the point), the Blossom Leap's became the flourish, and the First Drop keeps rings with a high line
     for a rider who pops the lip. Rings: expert 6 of 6, mid 5 of 6, line 0 of 6 (was 8, 10 and 5 of 18).
   - A span's fall, a race and a chase reward speed held, as before.
2. **The pilots learned the set pieces** (the measurement). Round 6's expert dashed the moment a lantern lit,
   wherever it stood; nobody who has ridden Old Town twice dashes into it. The skilled pilots now dash into a race,
   a surge and the carry, keep a lantern for one that is close, and do not dash into a set piece that wants
   control; they spin nothing on a flight that lands on a set piece's doorstep. To show what that knowledge is
   worth on the new set pieces, the lab keeps round 6's habit as `--pilots expert-dash` (the expert's hands, a dash the moment a lantern lights): it wins
   **70 of 90** on the new set pieces, against 77 for the expert who knows where a dash belongs and 36 of 72 for
   the same habit in round 6. So most of the gain is the set pieces, and knowing them is worth 7 more. (The
   in-air habits, one spin at most near a set piece and a nudge toward the line, are shared by both, so this
   does not separate them from the game's share.)

A rider who wins nothing new by doing nothing: the careful line's 3 are a span outrun twice (as in round 6: it is
fast enough when it arrives fast) and one low flame that happened across the brazier.

### M6. What each set piece trades

"Mastery is never punished" must not become "skill is never asked". Each still poses a choice, and the lab's
unskilled pilots lose it:

| Set piece | To win it you give up | Who loses it in the lab |
| --- | --- | --- |
| Rings | the safe line at the lip (2.2 m to one side, on the far side in one variant) and, on the high line, a charged pop timed on the lip | line 0 of 6, novice 0 of 6, stunt 1 of 6 |
| Slide | the line and your speed: a 2.2 s drift carries the sled 14 to 26 m across the lake, and a drift into the near shore runs out of ice (how the mid pilot lost 2 of 6) | line 0, novice 0, stunt 0 of 6; mid and expert 3 of 6 |
| Steps, hops | steering: every pop is a flight you cannot steer down a street, and a sketchy landing ends it | line 0, novice 0, stunt 0 of 6 |
| Collapse | nothing but speed held: tuck, no drift, no wall | the clumsy pilot 0 of 6; still the easiest (novice 5 of 6, line 2 of 6): unchanged from round 6 |
| Race, chase | a lantern (a dash wins it; without one the long start is lost) | line 0, novice 1 of 6 |
| Gates, sit | speed: eight gates 32 m apart want about 25 to 30 m/s, and the expert who arrives at 40 misses the second (4 of 6 against mid's 5) | line 0, novice 1, stunt 0 of 6 |
| Race, sprint | a lantern or a clean tuck | line 0, novice 3 of 6 |
| Surge | a lantern, and the leap's landing: 47 m/s off a cliff lands 178 m out | line 0, novice 0, stunt 1 of 6 |
| Gates, swing | your line: the gate is where its sway has it when you arrive | line 0, stunt 2 of 6 |
| Steps, stair | a press timed on each landing; a sketchy one ends it | line 0, novice 0 of 6 |
| Flourish | a clean landing risked on a trick; two flips want about 39 m/s onto the lip (the expert, slowed by a rock, lost both its two-flip rides) | line 0, novice 0, stunt 1 of 6 |
| Shatter | steering for three seconds a pop: on this street a pop is a 120 m flight, and one flight passes two bells | line 0, novice 0, stunt 0 of 6 |
| Follow | the safe line: the wake counts only where the safe line is outside it | line 0, stunt 0, novice 1 of 6 |
| Kindle | 1.8 m of room: a lamp is lit by passing 2.9 m from its middle, and a sled that hits anything lights nothing for half a second | line 0, stunt 0 of 5 |
| Carry | every risk on the last 880 m: a hit takes a fifth to a third of the flame, a ward spent or a wipeout puts it out, and slowing lets it burn down | line 1 of 6, stunt 2 of 5 |

Honest limits: the collapse is as easy as round 6 left it (hands-off wins it); the carry is the most forgiving new
verb (novice 4 of 6), on purpose, as the finale's last 20 seconds; and on Sakura the skilled pilots now win nearly
everything (mid 18 of 18, expert 16 of 18), so a person should check it does not feel given.

### M7. What changed in the tuning, and why

- **A slide each way is 0.75 s each** (was 1.1). A fast rider flies the leap before Mirror Lake and lands 100 m
  into it with under four seconds of ice left, and letting a drift go is a pop (1.3 s in the air). At 1.1 s no
  pilot won it in 12 rides; now expert 5 of 6, mid 2 of 6 with the variant forced.
- **Bells: level at 2.0 m, rising 1.4, 2.4, 3.4, or along one wall** (2.4 m off the line, 3 m either side of
  that). The variant "under the beams" (a band to stay inside) is gone: at 45 m/s one flight carries a sled under
  two bells, so no pilot won it in 12 rides.
- **A lamp is lit by a clean pass.** The rule was "within 2.7 m"; a sled ploughing down the row, burning its wards
  on the lamps, lit every one (hands-off won two of three variants). Now it is lit as the sled passes within
  2.9 m, and not for half a second after any hit. Hands-off: 0 of 3.
- **One row dark** replaces "dark turn about" (lamps alternating sides 20 m apart cannot be crossed between at
  40 m/s: 0 of 12). Needs: 5 of 15 with one on each side; 4 of 7 down one row; 4 of 7 across both halves.
- **The guide light's wake is 2 m either side and counts only where the light is 2 m or more off the safe line.**
  It counted from 0.6 m, and the careful line won the darting light 6 rides in 6 by never leaving the line. Now 0.
  The light also keeps 2.9 m from everything: at 2.5 its widest lobes ran up the ravine's walls and threw sleds.
- **The low flame starts at 0.7 and its brazier stands 5 m off the line** (was 0.62 and 4.2 m).
- **Surge: the speed off the lip decides it** (44 or 47 m/s) with the far line, so a pop off the lip, which flies
  past any line, does not.

### M8. Pool riders try every verb

`bot.ts`: a rider who tries a set piece (its own choice, from its key, likelier the more skilled) rides the guide
light's line itself, passes close beside the next dark lamp, hangs to the bells' wall, reads a swinging gate
where it will be, crouches and springs under each bell, pops and stomps down Old Town, pops the lip for the high
rings, holds one long drift on the lake, and dashes into a race, a surge and the carry.

Round 6's riders asked a set piece's line for a wanderer's room, never got it beside a gate, and threaded no gate
in any pool (0 of 42 on all four gate streets). A set piece's own line is now ridden with 0.25 m to spare.

Measured on locally regenerated pools (42 riders a mountain, `scripts/playtest/pool-moments.ts`; set pieces won of
riders who met them):

| Mountain | Stage 1 | Stage 2 | Stage 3 | Round 6's pools, for scale |
| --- | --- | --- | --- | --- |
| Pinecrest | rings 5/42 | slide 6/41 | steps, hops 0/41 | rings 8/42, race 38/41, gates 0/40 |
| Frostfang | collapse 40/42 | race, chase 39/42 | gates, sit 0/42 | collapse 41/42, race 38/42, gates 0/42 |
| Ember | race, sprint 35/42 | surge 21/42 | gates, swing 13/42 | race 26/42, rings 16/42, gates 0/42 |
| Sakura | steps, stair 5/42 | flourish 8/42 | shatter 0/42 | steps 25/42, rings 14/42, gates 0/41 |
| Lanternfall | follow 2/42 | kindle 5/42 | carry 25/42 | - |

(Petal Steps fell from 25 to 5 because round 6's rule was won by landing clean without trying; a stomp has to be
pressed.) Legends: 3 of the 210 pool runs rolled one, because a pool's rolls are mostly plain days.

Not good enough yet: the Ice Cavern's sitting gates, Old Town's hops and Temple Town's bells, all 0 of 42. The riders try them
(the inputs are in the records) and miss. A ghost that shows a player how a set piece is won is worth more than
one that only rides past, so the main lane should look at these after the pools are ridden again.

### M9. The climax, for the music and the camera

`climaxOf(course)` (`moments.ts`) gives the last stage's shape in metres: the last set piece (`piece`, `pieceZ0`,
`pieceZ1`), the last leap's lip (`peakZ`: where the music can take its breath), where a sled at 38 m/s lands
(`landZ`: where it crashes back in), where the square begins (`townZ`) and the line (`lineZ`).
`coastSeconds(course, z0, z1, v)` turns any stretch into seconds at a no-hands coast, so a build can be counted
down to land on the beat. From `moments-plan.ts`, seconds from the line at a coast:

| Mountain | Last set piece | Peak (last lip) | Lands | Town |
| --- | --- | --- | --- | --- |
| Pinecrest | Old Town, 3269 to 3659 (26.0 s) | 3980 (16.5 s) | 4098 (13.3 s) | 4200 (10.8 s) |
| Frostfang | The Ice Cavern, 3194 to 3641 (26.2 s) | 3980 (16.2 s) | 4091 (13.1 s) | 4200 (10.5 s) |
| Ember | Ash Market, 3631 to 3856 (20.3 s) | 3980 (16.3 s) | 4094 (13.1 s) | 4200 (10.6 s) |
| Sakura | Temple Town, 3966 to 4200 (11.2 s) | 3746 (26.2 s) | 3864 (22.9 s) | 4200 (11.2 s) |
| Lanternfall | The First Flame, 3621 to the line | 3980 (16.2 s) | 4098 (12.9 s) | 4200 (10.6 s) |

A rider is faster than a coast (the lab's skilled pilots cover the last 880 m in about 21 s against 27 s), so the
music should count from the sim's own position, not from the clock. For the carry, `sim.mo.pace` is the flame,
1 to 0: a climax the music can read every tick.

### M10. Stand-ins so everything is visible and playable

`src/render/marqueeworld.ts` now builds from the run's own variants (`Sim.plays`), and draws what the new verbs,
variants and legends need as orbs, beams and discs of light, every one marked `r7 stand-in`. They are placed and
timed from the sim, and they are not art. `spirit.ts` (one small edit) hangs the run's own ring line
(`Sim.skyGates`), so the far side and the high line draw where they are flown.

Dev switches (in `app.ts`, dev only): `?variant=N` rides every set piece's Nth variant, `?legend=1` or `2` rides
the mountain's legend, with `?debug&m=0..4&autoride=1`.

## Lab tables

Before (round 6, `shots/r7/lab/before.txt`; four mountains, six seeds):

| Pilot | Finished | Set pieces won | collapse | gates | race | rings | steps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hands-off | 4 of 4 | 5 of 11 | 1/1 | 0/4 | 2/3 | 1/2 | 1/1 |
| clumsy | 0 of 24 | 1 of 27 | 0/6 | - | 0/8 | 0/7 | 1/6 |
| novice | 23 of 24 | 27 of 71 | 4/6 | 8/23 | 5/18 | 6/18 | 4/6 |
| mid | 24 of 24 | 50 of 72 | 3/6 | 18/24 | 18/18 | 10/18 | 1/6 |
| expert | 24 of 24 | 36 of 72 | 6/6 | 14/24 | 8/18 | 8/18 | 0/6 |
| line | 24 of 24 | 13 of 72 | 2/6 | 0/24 | 0/18 | 5/18 | 6/6 |
| stunt | 24 of 24 | 25 of 72 | 6/6 | 0/24 | 15/18 | 1/18 | 3/6 |

After (five mountains, six seeds; each seed rides its own roll, so the seeds ride a spread of variants):

| Pilot | Finished | Median s (finishers) | Set pieces won |
| --- | --- | --- | --- |
| hands-off | 5 of 5 | 149.7 | 2 of 15 |
| clumsy | 0 of 30 | - | 0 of 31 |
| novice | 28 of 30 | 152.6 | 22 of 88 |
| mid | 30 of 30 | 123.2 | 76 of 90 |
| expert | 30 of 30 | 127.5 | 77 of 90 |
| line | 30 of 30 | 153.6 | 3 of 90 |
| stunt | 29 of 30 | 133.8 | 27 of 88 |

(The clumsy pilot's finishes are the `feel` lane's to move, not this one's. The expert's median is 4 s slower than
the mid's here: it spends lanterns on set pieces and keeps one for the next, where round 6's spent them on speed.)

After, by verb (won of met):

| Verb | novice | mid | expert | line | stunt |
| --- | --- | --- | --- | --- | --- |
| rings | 0/6 | 5/6 | 6/6 | 0/6 | 1/6 |
| slide | 0/6 | 3/6 | 3/6 | 0/6 | 0/6 |
| steps, hops | 0/4 | 4/6 | 5/6 | 0/6 | 0/6 |
| collapse | 5/6 | 6/6 | 6/6 | 2/6 | 5/6 |
| race, chase | 1/6 | 5/6 | 6/6 | 0/6 | 6/6 |
| gates, sit | 1/6 | 5/6 | 4/6 | 0/6 | 0/6 |
| race, sprint | 3/6 | 6/6 | 6/6 | 0/6 | 6/6 |
| surge | 0/6 | 6/6 | 6/6 | 0/6 | 1/6 |
| gates, swing | 5/6 | 6/6 | 6/6 | 0/6 | 2/6 |
| steps, stair | 0/6 | 6/6 | 6/6 | 0/6 | 3/6 |
| flourish | 0/6 | 6/6 | 4/6 | 0/6 | 1/6 |
| shatter | 0/6 | 6/6 | 6/6 | 0/6 | 0/6 |
| follow | 1/6 | 4/6 | 4/6 | 0/6 | 0/6 |
| kindle | 2/6 | 3/6 | 4/6 | 0/6 | 0/5 |
| carry | 4/6 | 5/6 | 5/6 | 1/6 | 2/5 |
| **All** | 22/88 | 76/90 | 77/90 | 3/90 | 27/88 |

Every variant, forced (`--variant 0..2`, six seeds; mid, expert), from the tuning runs. These came before the last
pilot changes for some rows, so read them as "can be won", which is what the test asserts on every variant:

| Set piece | Variant 1 | Variant 2 | Variant 3 |
| --- | --- | --- | --- |
| The First Drop | low 5, 6 | far 5, 6 | high 6, 6 |
| Mirror Lake | long 4, 6 | both 2, 5 | - |
| Old Town | three 3, 5 | row 5, 5 | - |
| Serac Gate | chase 6, 6 | surges 6, 6 | far 6, 6 |
| The Crevasse Fields | near 6, 6 | far 6, 6 | pair 6, 6 |
| The Ice Cavern | weave 4, 3 | mirror 5, 3 | doubles 4, 4 |
| Cinder Gate | even 6, 6 | early 6, 6 | late 6, 6 |
| The Caldera Leap | shelf 6, 6 | far 5, 5 | - |
| Ash Market | sway 6, 6 | counter 6, 6 | wide 6, 6 |
| Petal Steps | three 6, 6 | row 6, 6 | - |
| The Blossom Leap | spinflip 6, 6 | spins 6, 0 | flips 6, 0 |
| Temple Town | even 6, 6 | rising 6, 6 | wall 5, 5 |
| The Cloud Sea | wide 6, 3 | quick 6, 6 | darts 6, 6 |
| The Lamp Road | both 4, 4 | row: won in the test, not counted here | halves 5, 5 |
| The First Flame | still 6, 6 | wind 6, 6 | ember 5, 2 |

Two rows need a second look. **The Blossom Leap, two spins and two flips, expert 0 of 6**: with those variants
forced, the lab's expert lands a kicker's flight 4 m off the line 30 m above the leap, hits a rock there every
time, and reaches the lip at 16 m/s. It is the pilot's line off that kicker, not the trick (the mid pilot wins 6 of
6), but a person may meet the same rock. **The Ice Cavern, expert 3 or 4 of 6**: it arrives faster than the gates
want. That is the trade (M6), and the place the expert still wins fewer than the mid.

## What the other lanes must build

For every row: the sim state to read is public on `Sim` (`plays[i]`, `mo`, `legend`, `lg`, `stats`), and the
director already sends `moment` beats for every verb (`start`, `step`, `miss`, `lead`, `trail`, `close`, `won`,
`lost`, with `n` and `of`). **There is no `legend` beat yet**: the sim raises `legend` events (`warn`, `start`,
`step`, `end`) and nothing forwards them. The main lane must add the beat in `beats.ts` and `director.ts`; until
then a legend is seen (the stand-ins read the sim) and not said or scored.

### By verb

| Verb | World and fx | Music | Camera | UI |
| --- | --- | --- | --- | --- |
| slide | Skate marks that hold on the glass; spray off the outside runner while `s.drifting` on ice; the far shore as the thing you are sliding toward | A stinger that rises with the slide's quarters (`step` n 1 to 3) and resolves on `won`; `miss` cuts it | `side`, low, on the outside of the arc | Chip copy is in `momentcopy.ts`. The card should show the hold as a filling bar (quarters, or 1 of 2) |
| shatter | Real bells on wires across the street at `targets[i]` (x, z, `h` over the snow, `hw` wide); a rung bell swings and throws light; in "along one wall" they hang from that wall's eaves | A bell note per `step`, pitched up the scale so three ring a phrase; in the course's key | `low`, pulled back enough to see the next bell's height | Bell n of 3 |
| surge | The far line drawn on the landing (`far`), the lip marked; a speed read at the lip | A riser into the lip from `start`, silence in the air, the hit on `won` or a fall-away on `lost` | `wide`, held; the brief slow frame at the apex belongs here | The speed wanted and the speed off the lip (`step` n) large for a second |
| flourish | Nothing standing; petals thrown by the landing | The breath before the lip and the crash back on a clean landing | `wide`, with the hero frame at the apex | The trick's name from the variant's line |
| steps, hops | Nothing standing. A mark where each stomp lands | A drum hit per stomp, the third a fill | `low` down the street | Stomp n of 3; "The row is broken" |
| race, chase | Two cabins on one rope in "pair" (the stand-in reuses the cabin); the far station as the deadline | The chase's pulse quickens as the gap closes; a hit per car passed | `side`, on the rope's side | Car 1 of 2 caught |
| gates, swing | Lantern strings that really swing from a pivot on the wire (the stand-in slides them sideways and drops the lintel) | As gates; the sway's period is `gates[i].period` ticks, should the groove want to sit on it | `low` | As gates |
| collapse, from the far end | The fall running up the span toward the rider; a keystone to read at `keystone` | The fall heard ahead, not behind | `side`, looking down the span at the fall | "Reach the keystone" |
| follow | The cloud itself (visibility closing to 60 to 80 m between `Course.cloud.z0` and `z1`); the guide light as a character with a wake on the snow `2 * hw` wide; it should dim when the rider is out of the wake (`mo.ahead` false) | A motif that is whole while `mo.ahead` and thins when it is not; eight steps to `won` | `low` and close: the light should be the only far thing in frame | In its wake, n of 8 |
| kindle | Unlit stone lamps (`lamps[i].dark`) that catch as the sled passes (`mo.mask` bit i); already lit ones burn from the start; the lit road behind the rider is the picture | A note per lamp, rising; a darker colour on `miss` (a hit) | `low`, a little wide so both rows read | Lamp n of need; "Now the other row" |
| carry | A flame carried on the sled, its size `mo.pace` (1 to 0), guttering on a hit (`step` drops); a brazier at `relight` (x, z, r) in the low flame; the great lantern over the line, dark until `won` | The climax (M9): the flame as the music's intensity; the great lantern's lighting is the last chord | `wide` at the leap, then low into the square, the lantern in frame | The flame as a meter, not a number |

### By variant, where a variant changes what is drawn

- Rings "far": the ring line hangs on the other side of the lip. "High": the rings hang 6 to 20 m higher
  (`rings[i].y`). Both come through `Sim.skyGates`.
- Slide: nothing drawn differs; the card's line does.
- Collapse "surges": the fall's speed swings 9 m/s either way over four seconds (`fallZ`); cornices should break in
  waves. "Far": above.
- Race, sprint "early" and "late": the machine is already away, or still at its station, as the rider arrives
  (`machineZ` says where). The station wants a departing bell that matches.
- Gates, sit "from the other wall" and "two and two": gate positions only.
- Gates, swing "against each other": alternate gates half a swing apart. "Slow and wide": 3.9 m and 5.5 s.
- Steps "in a row": the count resets on a clean landing that is not a stomp; the chip says so.
- Flourish: the trick asked for is `half` half-turns and `flips` flips.
- Shatter "rising": each bell hangs higher (1.4, 2.4, 3.4 m). "Wall": above.
- Follow "quick" and "darts": the light's line only (`path.off`, a sample every 4 m).
- Kindle: which lamps are `dark`.
- Carry "wind": the flame burns down 7% faster and a hit takes less (a wind to draw: flags, snow off the roofs).
  "Ember": the flame starts at 0.7 and the brazier stands 5 m off the line past the last leap's landing.

### By legend

Read `sim.legend` (`key`, `kind`, `z0`, `z1`, `side`, `path`, `lights`) and `sim.lg` (`phase` 0 waiting, 1 said,
2 playing, 3 over; `head`, a runner's place down the course; `n`, a ribbon's charge given).

| Legend | Build |
| --- | --- |
| The White Stag (Pinecrest, runner) | A white stag running the glade ahead of the rider at `lg.head` on `path`, its hoofprints the lights it lays. It must never be closer than 18 m (`LEGEND_AHEAD`) |
| The Lantern Fleet (Pinecrest, sky) | A thousand paper lanterns rising off Mirror Lake as the rider crosses it. This plays over the slide: keep it above and beyond the ice, never on it |
| The Aurora Comes Down (Frostfang, ribbon) | The aurora lying on the snow along `path`, 4.6 m wide. Riding in it should light the rider. Not mint: that is the ghosts' |
| The Ghost Herd (Frostfang, runner) | A herd of spirit animals running the chute ahead. See M4: its line has no room to weave |
| The Cone Wakes (Ember, sky) | The cone erupting, lighting the smoke deck from below, as the rider crosses the first bridge |
| The Cinder Wyrm (Ember, runner) | A long body of sparks swimming the ravine ahead on `path` |
| The Lantern Dragon (Sakura, runner) | A lantern dragon winding down the benches ahead, 5 m either side of the line |
| The Thousand Cranes (Sakura, sky) | Paper cranes taking the air over the last leap |
| The Great Rising (Lanternfall, sky) | Every lantern in the valley rising as the rider breaks out under the cloud deck: the mountain's one image, doubled |
| The Tall Lamplighter (Lanternfall, ribbon) | A tall figure walking the lamp grove, his lantern's light the lane on the snow |

Music: one legend stinger and a held colour while `lg.phase === 2`. Camera: a look toward `side` on `warn`, never
off the rider's line. UI: the legend's `line` as it comes (`warn`), its name on the results, and a count of legends
met for the save (not added: the save is the main lane's).

## Text for ART.md 14 (set pieces)

> **Round 7.** Fifteen set pieces, twelve verbs, none in the game more than twice. A mountain's three are three
> different things to do with the hands, and each has two or three variants picked by the run's own seed. What a
> verb needs to be seen is the world's to build and the sim's to place: a bell hangs where the sim says a sled
> must be, a gate swings where the sim has it this tick, a flame is as tall as the sim says it has left to burn.
> Nothing drawn for a set piece may suggest a line the sim does not reward.
>
> **Legends.** Two a mountain, on about one run in ten and never a session's first. A legend is spectacle first.
> Where it changes play it only gives: lights to take or a lane that charges the lantern, the same for every rider
> whose run rolled it, with no collider anywhere. A runner keeps 18 m ahead of the rider and is never caught.
>
> **Stand-ins.** Round 7's new verbs, variants and legends are drawn in `marqueeworld.ts` as orbs, beams and discs
> of light marked `r7 stand-in` until their own art replaces them.

## Text for the README

> **Set pieces.** Each mountain has three, one a stage, each with its own verb: rings, slide, steps, collapse,
> race, gates, surge, flourish, shatter, and Lanternfall's follow, kindle and carry. No verb is used more than
> twice, and each set piece has two or three variants chosen by the run's seed, so a ghost rides the variant of its
> own run. Beating a set piece lights a whole lantern and earns its star on the mountain's board.
>
> **Legend moments.** After a session's first run, about one run in ten has a legend: a white stag in the glades, a
> lantern dragon on the benches, the aurora come down to the snow. They never hurt a run.
>
> **Lanternfall.** The fifth mountain: a dive into cloud behind a guide light, a road of stone lamps to light, and
> a flame to carry to the great lantern at the line. The Hollow King's home. Opens at 48 passes for now.
>
> Dev switches: `?debug&m=4` opens Lanternfall; `&variant=0..2` rides every set piece's Nth variant; `&legend=1`
> or `2` rides the mountain's legend.
>
> Tools: `npx tsx scripts/playtest/lab.ts` (tables of set pieces won by pilot, verb and variant; `--variant N`,
> `--legend N`, `--mountains 4`, `--pilots expert-dash`), `npx tsx scripts/playtest/moments-plan.ts` (what every
> variant holds; `--rolls 3000` for how often variants and legends come up), `npx tsx
> scripts/playtest/pool-moments.ts` (how the pools' riders played each set piece).

## Cost

- Sim: a set piece's step is a handful of comparisons a tick; the kindle walks at most 30 lamps a tick while it is
  active. Plays are built once a course and variant combination and cached.
- Render stand-ins: three instanced meshes (96 orbs of 80 triangles, 48 beams of 4, 96 discs of 2), drawn only when
  they hold something: at most 3 draw calls and about 8,000 triangles, on every tier; Low draws fewer (14 of a sky
  legend's 30 lanterns, 4 of the wake's 7 pools). A chase's second cabin is one more mesh while the chase is in
  range. Frame time was not measured (seven lanes share the machine).
- A run whose roll picks other variants than the plain day's rebuilds the set pieces' world once, on its first
  frame (the gates' strings and the machine's cable are merged geometry). Not timed. If it shows as a hitch, build
  from the roll in `World.setCourse` instead of on the first frame.
- `tests/moments.test.ts` rides about 150 whole runs and takes about two minutes on this machine under load.

## What the main lane must wire or decide

1. **Ride the pools again** (`npm run generate-ghosts`), then run the tests: the pool tests are the only ones
   failing on this branch.
2. **A `legend` beat** in `beats.ts` and `director.ts`, and the HUD's line for it (see above).
3. **Lanternfall's world, music and unlock.** Add `'lantern'` to `BiomeId` and delete `LOOK`; the unlock is a
   placeholder at 48 passes.
4. **`tests/determinism.test.ts`, `tests/ghostpool` and friends** were not edited; only `tests/progress.test.ts`
   (below).
5. **The `feel` lane and this one both edit `sim.ts`.** This lane touched only the set pieces' part
   (`momentStep`, `legendStep`, `momentEnd`, `momentCount`, the moment and legend state and events) and nothing in
   the wreck and get-up.
6. **Decide whether the collapse should ask more.** It is as round 6 left it: a rider who does nothing wins it.
7. **Card and chip.** `Marquee.line` is the variant's own line for a run and `Marquee.variantName` its name; the
   card should say the variant so a player learns there are several.

## Touched outside my files

- `tests/progress.test.ts`: the "next unlock" test's rider with every mountain open has passed 60 ghosts, not 30
  (Lanternfall's placeholder threshold is 48).
- `src/bot/roster.ts`: The Hollow King's `home` is 4.
- `src/render/spirit.ts`: the sky gates drawn are the run's own (`Sim.skyGates`), re-read when a run's variants
  differ from the last one's. Eight lines.
- `src/game/app.ts`: the dev switches `?variant=` and `?legend=`. Three lines.
- `scripts/playtest/lab.ts`, `labpilots.ts`, `moments-plan.ts`, `pool-moments.ts`: the lab's tables by verb and
  variant, the pilots' knowledge of the set pieces, `expert-dash`.
- `src/sim/chaos.ts`, `replay.ts` (the previous agent's commit): the legend in the roll and in the record's mood
  byte.

## Not finished, and fragile

- Nobody has played any of this. Whether a slide each way, a bell under a three-second flight or a lamp passed at
  40 m/s is fun, or even readable, is unknown.
- Pool riders win few of the new set pieces (M8).
- The lab's expert and the rock above the Blossom Leap (above).
- The stand-ins were SHOTS_STATUS.
- The Ghost Herd weaves nothing (M4).
- A Daily can host slide, shatter, surge, flourish and steps-hops; three Dailies were read in `moments-plan.ts` and
  none was ridden in the lab.
- The `moments` test proves each variant winnable by the lab's pilots within eight rides. It does not prove a
  person can.

## Frames

FRAMES
