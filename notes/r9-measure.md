# Round 9, milestone 0: the measure lane

How the five mountains ride, measured on the real sim in node: the baseline the three new mountains must leave
(brief section 2, "The three new mountains"; section 4, milestone 0, "Measure the five"). **Everything here is a
script's reading of the sim. Nothing in it has been ridden or looked at by a person**, and the stills have been seen
only by me.

Scripts (all in `scripts/playtest/`; node only, nothing in the game imports them, so the game's boot does no more work):
- `r9-courselib.ts`: the measures, defined exactly in its header, and the lab's pilots ridden as `lab.ts` rides them
  (`labpilots.ts`; the same seeds 1234 + 37i, rolls, charm pool and input byte).
- `r9-courses.ts`: the tables, the five's spread and the bars. Raw output: `shots/r9/measure/r9-courses.txt`, `.json`.
- `r9-profiles.ts`: the profile charts, from the sim's own course. Output: `shots/r9/measure/profiles/`.
- `r9-stills-plan.ts`, `r9-stills.sh`, `r9-stills-name.mjs`: the greyscale still set. Output: `shots/r9/measure/stills/`.

Re-run:
- `npx tsx scripts/playtest/r9-courses.ts` (a lab sweep: in the heavy slot; 51 s today, 6 seeds a pilot and 30 for the
  clumsy pilot, a 900 s cap). `--no-rides` prints the course measures alone in a second, no slot needed.
- `npx tsx scripts/playtest/r9-profiles.ts` (a second; reads `r9-courses.json` for where the mid pilot flew).
- `bash scripts/playtest/r9-stills.sh http://127.0.0.1:4910/ "C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/stills" r9-measure`
  against a dev server (takes the browser slot under `<lane>-r9stills`).

Mirrors: a mirror mountain flips the picture and the steer and leaves the sim alone (`src/game/modes.ts` 15 to 17,
`mirrorSteer`), so each mirror's course and rides are the five's with x's sign flipped. No separate tables.

## The mid pilot (6 seeds a mountain)

Section 2's six first, then what the eight axes add. Seconds are the median of the finishers (all six finished on
every mountain); air, flights and the rider's turns are medians over the six rides; falls and wards are means.

| mid pilot | Pinecrest | Frostfang | Ember | Sakura | Lanternfall | five's min | five's max |
|---|---|---|---|---|---|---|---|
| **finish time, s** | 129.4 | 121.3 | 122.8 | 128.6 | 127.0 | 121.3 | 129.4 |
| **mean speed, m/s** | 35.2 | 37.4 | 36.8 | 35.1 | 35.7 | 35.1 | 37.4 |
| **airtime, share of the run** | 35.3% | 31.5% | 27.5% | 29.4% | 24.2% | 24.2% | 35.3% |
| **turns per km** (safe line's bends) | 2.67 | 2.67 | 2.44 | 2.44 | 1.78 | 1.78 | 2.67 |
| **mean width, m** | 31.1 | 27.1 | 24.6 | 29.3 | 27.9 | 24.6 | 31.1 |
| **hazards per km** (colliders) | 125.6 | 49.3 | 43.3 | 80.4 | 84.9 | 43.3 | 125.6 |
| airtime, s | 45.9 | 37.8 | 32.5 | 37.4 | 30.4 | 30.4 | 45.9 |
| flights over 0.5 s | 20.5 | 14.5 | 12.5 | 18.5 | 13.0 | 12.5 | 20.5 |
| longest flight, s | 5.78 | 4.63 | 4.58 | 3.96 | 3.74 | 3.74 | 5.78 |
| rider's steer reversals per km | 15.9 | 14.3 | 14.0 | 13.0 | 16.6 | 13.0 | 16.6 |
| rider's bends per km (2 m) | 8.1 | 6.1 | 6.4 | 5.1 | 7.6 | 5.1 | 8.1 |
| falls per run | 0.17 | 0 | 0 | 0.17 | 0 | 0 | 0.17 |
| wards per run | 3.17 | 0 | 0.17 | 0.50 | 0.50 | 0 | 3.17 |
| set pieces won | 18/18 | 18/18 | 14/18 | 14/18 | 14/18 | | |

The mid pilot's six seeds, seconds: Pinecrest 127.2, 122.3, 141.4, 122.8, 131.5, 139.5; Frostfang 117.3 to 124.6;
Ember 120.3 to 129.5; Sakura 124.8 to 131.3; Lanternfall 125.1 to 130.0.

**What a new mountain has to leave, in one line:** on the six, the five span only 121 to 129 s, 35.1 to 37.4 m/s,
24 to 35% in the air, 1.8 to 2.7 bends a km, 24.6 to 31.1 m wide and 43 to 126 colliders a km. Time, speed and width
are narrow bands (7%, 6% and 27% wide); turns are a small number on a smooth line; hazards per km is the one wide one
(2.9 times, Pinecrest's tree runs against Ember's walls). A new mountain leaves the five most easily on length and
pace (any length but 4.5 km moves the time), turns (a line that bends more than three times a km) and width (under
24 m or over 32 m on average); hazards per km has the most room inside it, so it is the weakest of the six to lean on.

## The other pilots

| novice (6 seeds) | Pinecrest | Frostfang | Ember | Sakura | Lanternfall |
|---|---|---|---|---|---|
| finished | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| finish time, s | 161.8 | 145.4 | 135.9 | 145.5 | 143.1 |
| mean speed, m/s | 28.1 | 31.5 | 33.5 | 31.3 | 31.9 |
| airtime | 36.3%, 58.5 s | 39.6%, 57.1 s | 38.5%, 52.0 s | 38.5%, 58.8 s | 36.1%, 52.8 s |
| flights over 0.5 s, longest s | 28.0, 5.42 | 22.5, 4.70 | 21.5, 5.34 | 26.0, 4.56 | 21.0, 4.39 |
| steer reversals, rider's bends per km | 12.8, 7.8 | 13.3, 9.3 | 11.2, 7.1 | 11.4, 7.6 | 13.7, 7.8 |
| falls, wards per run | 1.17, 2.33 | 0.50, 1.00 | 0, 0.33 | 0.33, 1.67 | 0.33, 1.83 |
| set pieces won | 0/18 | 12/18 | 6/18 | 1/18 | 10/18 |

| expert (6 seeds) | Pinecrest | Frostfang | Ember | Sakura | Lanternfall |
|---|---|---|---|---|---|
| finished | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 |
| finish time, s | 129.3 | 118.5 | 118.6 | 116.7 | 123.6 |
| mean speed, m/s | 35.1 | 38.3 | 38.3 | 39.0 | 36.7 |
| airtime | 45.2%, 59.2 s | 45.0%, 54.3 s | 48.9%, 58.0 s | 51.3%, 59.0 s | 37.2%, 43.9 s |
| flights over 0.5 s, longest s | 21.5, 6.01 | 17.0, 6.51 | 17.0, 7.42 | 25.0, 4.50 | 16.5, 4.80 |
| steer reversals, rider's bends per km | 15.6, 7.9 | 16.3, 7.1 | 15.2, 6.6 | 14.9, 7.0 | 16.9, 8.0 |
| falls, wards per run | 1.67, 0.67 | 0.50, 1.00 | 0, 0.33 | 0.17, 1.17 | 0.33, 0.33 |
| set pieces won | 18/18 | 18/18 | 16/18 | 15/18 | 15/18 |

| clumsy (30 seeds) | Pinecrest | Frostfang | Ember | Sakura | Lanternfall |
|---|---|---|---|---|---|
| **finished** | **27/30 (90%)** | 28/30 (93%) | 29/30 (97%) | **27/30 (90%)** | 29/30 (97%) |
| wrecks (cause, metre) | tree 1314, landing 1425, tree 1122 | rock 2866, rock 2856 | rock 2339 | rock 2544, landing 2480, rock 2639 | landing 2463 |
| finish time, s | 354.7 | 338.0 | 323.6 | 363.0 | 338.4 |
| mean speed, m/s | 15.6 | 16.0 | 16.3 | 15.4 | 16.0 |
| falls, wards per run | 7.90, 2.63 | 4.70, 1.90 | 4.90, 1.80 | 6.30, 2.83 | 6.17, 2.27 |
| airtime | 63.0%, 220.7 s | 69.6%, 226.9 s | 70.2%, 213.8 s | 64.3%, 228.8 s | 64.7%, 209.3 s |
| steer reversals, rider's bends per km | 20.0, 20.4 | 20.0, 20.6 | 19.3, 19.4 | 20.3, 20.9 | 20.4, 20.7 |

- **The fair bar's baseline:** the five's hardest for the clumsy pilot are Pinecrest and Sakura, 27 of 30 (90%). A new
  mountain meets "the clumsy pilot finishes each at least as often as it finishes the five's hardest" at 27 of 30 on
  the same 30 seeds. Six seeds are not enough for this one: at six, Ember and Sakura looked hardest (5 of 6) and
  Pinecrest easiest, the other way round from thirty. Its slowest finish was 439 s; at the lab's 240 s or my first
  420 s cap the clumsy pilot lost five runs that were still riding 4,134 to 4,493 m down, so the script caps at 900 s.
- **The clumsy pilot's air is the banks, not tricks.** Two thirds of its time is in the air because it rides into the
  banks and is turned back off them: on one Pinecrest run, 138 of its 206 lip takeoffs were past the corridor's edge
  (62 were pops). The number is the sim's own airborne state and is right as a measure, but a new mountain whose
  walls are ridden (a bobsleigh run, a channel) will move it a lot, and the reason is the frame, not the air.
- Over the six seeds, every pilot but the clumsy one finished every run.

## The courses (no rider; every metre of the sim's own course to the line)

| course | Pinecrest | Frostfang | Ember | Sakura | Lanternfall | min | max |
|---|---|---|---|---|---|---|---|
| length, m | 4500 | 4500 | 4500 | 4500 | 4500 | 4500 | 4500 |
| stages, m | 1450/1500/1550 | same | same | same | same | | |
| drop, gate to line, m | 1475 | 1586 | 1606 | 1429 | 1540 | 1429 | 1606 |
| of it in ledges (cliffs, steps, outlets), m | 54 | 64 | 56 | 68 | 63 | 54 | 68 |
| plain grade (drop less ledges, over length) | 0.316 | 0.338 | 0.344 | 0.302 | 0.328 | 0.302 | 0.344 |
| grade spread (sd, 25 m windows) | 0.114 | 0.110 | 0.108 | 0.101 | 0.107 | 0.101 | 0.114 |
| pitches (0.38+, 40 m+): count, metres | 3, 394 | 4, 746 | 4, 906 | 2, 330 | 4, 758 | 2 | 4 |
| flats (0.16-, 40 m+): count, metres | 6, 851 | 4, 604 | 3, 478 | 3, 452 | 3, 546 | 3 | 6 |
| stage grades 1/2/3 | .363/.304/.283 | .363/.344/.309 | .381/.379/.277 | .296/.353/.260 | .381/.318/.289 | | |
| BIOME_PARAMS slope | 0.29 | 0.31 | 0.30 | 0.28 | 0.30 | 0.28 | 0.31 |
| share of the run that slope governs | 27% | 25% | 22% | 21% | 31% | 21% | 31% |
| width under 12 m | 3.7% | 9.7% | 6.7% | 3.5% | 4.9% | 3.5% | 9.7% |
| width over 30 m | 50% | 48% | 32% | 56% | 52% | 32% | 56% |
| narrowest, widest, m | 10.7, 52.4 | 10.5, 48.0 | 10.9, 42.0 | 10.6, 44.0 | 11.3, 46.0 | | |
| reach (to the turn-back), m | 48.0 | 41.1 | 38.2 | 45.4 | 43.0 | 38.2 | 48.0 |
| bank's rise at the turn-back, m | 7.7 | 7.4 | 7.6 | 7.3 | 7.6 | 7.3 | 7.7 |
| walled (turn-back 5 m or nearer) | 15% | 39% | 41% | 24% | 29% | 15% | 41% |
| turning, degrees per km | 44 | 37 | 25 | 37 | 44 | 25 | 44 |
| solid colliders per km | 124.7 | 49.3 | 43.3 | 80.4 | 84.9 | 43.3 | 124.7 |
| ... within 6 m of the safe line, per km | 36.9 | 12.4 | 11.3 | 18.7 | 31.8 | 11.3 | 36.9 |
| ... tall / low / logs / gate posts / soft, per km | 107/16/1.6/0/0.9 | 36/13/0/0/0 | 31/10/2.7/0/0 | 62/14/3.3/1.8/0 | 56/27/0/1.3/0 | | |
| leaps: lip m and cliff m | 617:15.8, 2690:14.5, 3980:18.6 | 615:22.0, 1912:18.1, 3980:24.5 | 653:16.2, 2400:17.9, 3980:21.8 | 640:15.6, 2690:15.0, 3780:16.0 | 605:19.6, 1715:22.7, 3980:20.6 | | |
| first kicker on the line, m | 286 | 286 | 286 | 286 | 296 | | |
| kickers per km, on / off the line | 1.11/1.33 | 1.11/1.11 | 0.89/0.22 | 0.67/0.67 | 0.89/2.00 | | |
| terrace steps, lake outlets | 0, 1 | 0, 0 | 0, 0 | 7, 0 | 0, 0 | | |
| vents per km | 0 | 0 | 3.33 | 0 | 0 | | |
| metres of the safe line on ice (of it glass) | 482 (310) | 579 (0) | 0 | 8 | 231 | 0 | 579 |
| sky gates | 3 | 3 | 1 | 2 | 2 | 1 | 3 |
| set pieces' share of the run | 22.5% | 23.8% | 17.7% | 17.7% | 37.3% | 17.7% | 37.3% |
| legends' share (when one rolls) | 10.3% | 6.2% | 7.9% | 9.3% | 9.9% | | |
| section kinds used | 11 | 11 | 11 | 11 | 13 | 11 | 13 |
| first 500 m: mean width, line off centre, m | 41.8, 3.1 | 45.1, 2.3 | 39.3, 1.5 | 41.6, 1.7 | 41.8, 1.5 | | |
| the square, m (half-width, grade) | 300 (11.8, 0.078) | 300 (11.9, 0.082) | 300 (12.2, 0.079) | 300 (12.3, 0.080) | 300 (12.3, 0.079) | | |
| charm gates, m | 110, 1550, 3050 | same | same | same | same | | |

The descents, section by section (metres; `*` a stage line's threshold, a plain corridor of 190 m on every one):
- Pinecrest: start 120, bowl 247, cruise 133, leap 338, treerun 255, fork 318, cruise* 190, chute 185, lake 310,
  bowl 251, treerun 221, leap 343, cruise* 190, fork 321, bridge 215, street 230, leap 334, finish 300
- Frostfang: start 120, bowl 253, cruise 122, leap 340, ravine 360, bridge 215, cruise* 190, street 200, leap 332,
  ravine 303, bridge 165, fork 310, cruise* 190, bowl 200, tunnel 223, bridge 165, chute 180, leap 332, finish 300
- Ember: start 120, bowl 254, cruise 149, leap 350, ravine 280, tunnel 257, cruise* 190, chute 186, bridge 166,
  fork 318, leap 350, ravine 290, cruise* 190, tunnel 258, bridge 215, street 280, leap 347, finish 300
- Sakura: start 120, bowl 269, cruise 125, leap 346, terraces 336, street 214, cruise* 190, chute 186, tunnel 241,
  bridge 191, fork 342, leap 350, cruise* 190, terraces 258, fork 310, leap 332, street 200, finish 300
- Lanternfall: start 120, bowl 253, cruise 120, leap 332, ravine 345, switchbacks 240, cruise* 190, leap 335,
  fork 319, street 280, bridge 166, treerun 210, cruise* 190, benches 220, bridge 165, street 200, chute 183,
  leap 332, finish 300

The profile, axis by axis: every one of the five is **steady with a steep first stage** (stage 1 the steepest on four,
0.36 to 0.38, easing to 0.26 to 0.31 in stage 3; Sakura's second is steepest), with two to four pitches (330 to 906 m
of them) and three to six flats (452 to 851 m) and the rest between. None steepens, none is stepped beyond Sakura's
two terraces and the three cliffs every one has, and none rolls (benches' rollers are 220 m of Lanternfall alone).

## The measures, defined

Each is one function on every mountain, so a new course and a reskin differ only where the ground differs. The script
headers (`r9-courselib.ts`) hold the same words.

- **Finish time:** ticks to the line over 60, the finishers' median. **Mean speed:** the sled's speed averaged over
  every tick (lab.ts's measure).
- **Airtime:** ticks with the sled off the ground and not on a rail (the sim's `grounded` and `grinding`), as a share
  of the ride and in seconds; flights over 0.5 s counted; the longest flight.
- **Turns per km (the course's):** the safe line (`course.safeX`, every metre) has a turning point each time it has
  come back 2 m from its last extreme; the count over the length. Turning: the line's whole heading change in degrees
  per km, from 10 m steps. **The rider's:** steer reversals (a side held, then the other side; the input byte's steer)
  per km ridden, and the rider's own path's bends by the same 2 m rule (sampled every 0.1 s).
- **Width:** the corridor between its edges, 2 x `halfWidth(z)`, every metre: its mean and the share under 12 m and
  over 30 m. Reach: 2 x (halfWidth + `edgeLimit`), where the sim turns a sled back. Bank: the ground's rise from the
  edge to the turn-back. Walled: the share of the run whose turn-back is 5 m or nearer.
- **Hazards per km:** every collider the sim's `collide()` reads (`course.chunk(k).obstacles`, the same for every
  rider) with its middle short of the line, over the length; by group (tall: pines, spires, seracs, basalt, blossom,
  charred pines; low: rocks, ice blocks, lava rocks, stone lanterns; logs; gate posts; soft snowmen) and within 6 m of
  the safe line. Features per km: kickers on and off the line, drops, mogul fields, ice patches, vents, rails, metres of
  the safe line on ice and on glass.
- **The slope:** `baseY` every metre. Drop, gate to line; ledges, the cliffs', steps' and outlets' own falls; the plain
  grade, drop less ledges over length; the spread of the 25 m grade outside the ledges; pitches (0.38 or steeper for
  40 m or more) and flats (0.16 or gentler for 40 m or more); each stage's plain grade.
- **Stages, leaps, set pieces:** `course.stages`, `course.leaps` (lip, cliff, last landing), `planMoments` and
  `planLegends` extents over the length.
- **Clumsy:** finishes of 30 runs, wrecks by cause and metre, falls and wards per run.
- **The mechanic hook:** `MECHANICS[id]`, a function of each tick (the sim after its step, and the input) that says
  whether the mountain's signature mechanic is in play; the share of the ride's ticks it is. A mountain lane writes
  its function there; it reads zero until then.

## The bars script (`r9-courses.ts`)

It reads `MOUNTAINS`, tells the five (`FIVE`, by id) from any new one, and for each new mountain prints: which of the
six sit outside the five's range (two needed), every pair of new mountains within 10% on more than half the six (not
allowed), the clumsy pilot's finishes against the five's hardest (27 of 30 today), and the mechanic's share. Today it
prints the five's baseline and "no new mountains: MOUNTAINS registers only the five ... every bar is unmet today",
and exits 0. It is a script, not a test, so it does not break the suite. `--as-new pinecrest,lanternfall` counts some
of the five as new against the rest, which is how its bar code was checked before a new mountain exists.

### The bar held against the five themselves: as written it cannot tell a reskin from a new course

Each of the five, held as if it were new against the other four on section 2's six (`r9-courses.ts` prints this):

| as if new | outside the other four on | by 15% or more on |
|---|---|---|
| Pinecrest | 4 (finish time, air, width, hazards) | 1 (hazards) |
| Frostfang | 2 (finish time, speed) | 0 |
| Ember | 2 (width, hazards) | 0 |
| Sakura | 1 (speed) | 0 |
| Lanternfall | 2 (air, turns) | 1 (turns) |

**Four of the five would pass "outside the five's range on at least two" against the other four.** The range of five
values is narrow, and a mountain that only sits a little past its edge on two measures passes; the bar would let a
sixth course of the five's own grammar through with different numbers. With a margin, "outside the five's range by
15% or more on at least two", none of the five passes against the rest, and it still asks nothing a fundamentally
different course cannot give (a 3 km or 6 km run moves the time far past 15%; a ridden channel or an open face moves
the width; an open field or a gully moves hazards a km). **For the main lane to decide:** hold the new mountains to the
15% reading (the script prints both), or add measures the five share exactly (length, the opening's first leap, the
stage lines, the square), on which the five have no range at all.

The second bar bites already: of the ten pairs of the five, five are "within 10% on more than half the six" (Frostfang
and Sakura on five of six; Pinecrest and Sakura, Frostfang and Ember, Ember and Sakura, Sakura and Lanternfall on four),
so the five themselves would fail it as a set of three. The fair bar is 27 of 30 for the clumsy pilot, as above.

## The profiles

`shots/r9/measure/profiles/<id>.svg`, one a mountain, and `sheet.svg`, every mountain on one scale (0.3 px a metre
down the run, 0.1 px a metre of height, 1.1 px a metre across; `SCALE` in `r9-profiles.ts`, so a new mountain drawn
later sits beside them). The sheet opens with a row a mountain of its sections, leaps and set pieces, which is where
the five read as one course: the same opening (start, bowl, cruise, leap at about 600 m), a threshold at 1,450 and
2,950 m, a leap at 3,980 m on four, and the square. Each panel then has the height, the 25 m grade with the pitch and
flat lines, the corridor from above (floor, turn-back, safe line with its bends ticked, every collider as a dot by
group), the width with the 12 m and 30 m lines, the air (leaps, kickers on and off the line, steps and outlets, then
the mid pilot's flights, a row a seed) and a tick per collider, a row a group. Every mark has a hover title.

## Section 1 "The mountains", line by line

Checked against the sim (`src/sim`, read and not edited) and the tables above. What the sim cannot say (light, sky,
the far plane, palette) is marked as the render's and left to the screens and concepts lanes.

| Section 1 says | Verdict | The numbers |
|---|---|---|
| "All five are built from one set of parts (`src/sim/course.ts`)" | **Right** | One `Course` class and one table of section shapes. The five differ through tables keyed by biome (`BIOME_PARAMS`, `CLIFFS`, `TALL`, `LOW`, `SCRIPTS`, `SIGNATURES`) and by id (`AUTHORED` set pieces, `LEGENDS`), and three Lanternfall cases in course.ts (no kicker on the line in the cloud sea, lamp rows where a street's rails would be, the `cloud` span). |
| "4.5 km in three stages of 1,450, 1,500 and 1,550 m" | **Right** | `STAGE_LENGTHS`; `finishZ` 4,500 on all five. |
| "then a town square and a run-out" | **Half right** | The square is not after the stages: it is the last 300 m of stage 3, 4,200 to 4,500 m (`FINISH_SQUARE`), the same on all five (23.6 to 24.6 m wide, grade 0.08, turn-back 3 m); then 260 m of run-out past the line (`RUN_OUT`). |
| "the same start ramp and first leap at about 600 m" | **Right** | `opening()` is one function: start 120 m at a 0.5 grade, a bowl of 240 to 270 m, a cruise of 120 to 150 m, the leap. Lips at 605, 615, 617, 640 and 653 m (the code allows 590 to 670). Its cliff differs: 15.6 to 22.0 m. |
| "three leaps in all" | **Right** | Three on every mountain: the opening's and one in each of the scripts' second and third acts. Cliffs 14.5 to 24.5 m. |
| "the last over the town" | **Right on four, wrong on Sakura** | Pinecrest, Frostfang, Ember and Lanternfall: the last lip at 3,980 m, its section ending at 4,200 m where the square begins. Sakura's last lip is at 3,780 m, with Temple Town's 200 m street between its landing and the square. |
| "the same 18 section kinds" | **Wrong** | course.ts defines 18. The five draw on 16 (gully and split never come up on a named mountain); each uses 11, Lanternfall 13; only 9 are on all five (start, bowl, cruise, leap, chute, fork, bridge, street, finish). What all five share is each kind's shape: `SHAPES`, `GRADE`, `WIDTH`, `BLEND`, `BODY` are one table, so a ravine is the same ravine everywhere. |
| "one set piece a stage" | **Right** | `AUTHORED`: three a mountain, one in each stage. They cover 17.7 to 37.3% of the run. |
| "a sky gate a stage" | **Wrong** | Pinecrest 3, Frostfang 3, Ember 1, Sakura 2, Lanternfall 2. A stage has one only if it holds a kicker on the line past 800 m and 80 m short of its end (`stageGates`). |
| "and two legends" | **Right** | Two each in `LEGENDS`; all ten find a place. |
| "a slope of 0.28 to 0.31" | **Right as a parameter, wrong as a ride** | `BIOME_PARAMS.slope` is 0.28 to 0.31, but it governs only 21 to 31% of the run (the open kinds); the rest rides each kind's own grade (`GRADE`: the start 0.5, ravines and leaps 0.38 to 0.42, streets 0.2, lakes 0.04, the square 0.08). The ridden plain grade is 0.302 to 0.344, the drop 1,429 to 1,606 m. |
| "a mid rider home in 121 to 129 s" | **Right** | The mid pilot's medians 121.3 to 129.4 s (single seeds 117.3 to 141.4 s). |
| "What differs in play is a handful of numbers (`BIOME_PARAMS`), cliff heights, the act scripts, and the verbs" | **Right, and short** | It leaves out what stands on the snow: the collider kinds (soft snowmen on Pinecrest; seracs of 1.5 to 2.2 m radius on Frostfang; stone lanterns and gate posts on Sakura and Lanternfall), ice (579 m of the line on Frostfang, 0 on Ember) and vents (Ember alone, 3.3 a km). Colliders a km are the five's most varied measure: 43 to 126. |
| "Every course is one corridor between the sim's 9.5 m banks" | **Right, and short** | One corridor (a fork is two channels over a 3.2 m ridge that meet again). The plain bank rises 9.5 m at its 10 m turn-back (`bank(FOREST_LIMIT)`). But 15 to 41% of each run is walled, the turn-back 5 m or nearer: ravine walls of 13 m, tunnels 6 m, streets 2 m, bridges 0.8 m over a 34 m fall, the square 3 m. The rise at the turn-back averages 7.3 to 7.7 m; the corridor runs from 10.5 to 52 m wide within a run. |
| "Every opening is a centred trench" | **Right (in the sim)** | The first 500 m is 39 to 45 m wide, the safe line 1.5 to 3.1 m off the middle on average. (The panorama is the render's.) |
| "Snow and ice everywhere" | **Wrong on ice** | Three surfaces: snow, ice patches (grip 0.45) and glass (grip 0.5, drag 0.25). Ember has no ice at all and Sakura 8 m of line. |
| "static trees and rocks" | **Right** | Every collider is static; the yeti and the avalanche are chaos events rolled with the mood, not the course. |
| "A tree and a rock differ only in the crash's cause" | **Wrong** | A tall collider stands 3 to 6.5 m, a low one 0.75 to 1.4 m, and a sled in the air above the top clears it (and scores "cleared"): rocks, logs and ice blocks can be jumped, trees and spires cannot. Hit head on, both floor a sled the same way (12 m/s into it, or 6 m/s at 24 m/s and over). |
| "The same arc ... a warm lamplit town at the line" | **The shape is right** | Every course ends in the one `finish` section (above). Light and weather are the render's. |
| "Lanterns hang on all five" | **The render's** | In the sim, stone-lantern colliders stand only on Sakura (36) and Lanternfall (66); the spirit lights and the lantern are the same on all five. |
| "a player rides one course in five paintings" | **Right** | The five share length, stages, opening, thresholds, charm gates, three leaps, the square and run-out exactly; the mid pilot's time and speed sit within 7% and 6%; the line bends 1.8 to 2.7 times a km. They differ most in colliders a km (2.9 times), walled share (15 to 41%), ice on the line (0 to 579 m) and air (24 to 35% for the mid pilot). |

**What section 1 missed**, with numbers:
- **The stage lines are the same plain corridor on all five:** a 190 m threshold (40 m above the line, 150 m below), at
  least 22 m wide with nothing on it, at 1,410 to 1,600 and 2,910 to 3,100 m, and the charm gates at 110, 1,550 and
  3,050 m on every mountain.
- **The first minute is identical beyond the leap:** the first kicker on the line at 286 m (Lanternfall 296) and no
  other on the line before 800 m (the run-in has one to four off it, at 204 to 418 m), no mogul field or sky gate
  before 800 m, the corridor's middle empty until 900 m (0 to 6 colliders within 6 m of the line in the first 900 m),
  every fall free before 700 m (`FREE_TUMBLE_Z`), the start at 14 m/s.
- **The difficulty ramp is one curve:** every mountain narrows and fills over the same 4,500 m (`rampDistance` is
  `DESCENT` for all five); only the start and end widths and the density differ.
- **The profile eases, it does not build:** stage 1 is the steepest on four (0.36 to 0.38 against 0.26 to 0.31 in
  stage 3), because of the start's 0.5 ramp and the first leap's face.
- **The line is smooth and the same:** 1.8 to 2.7 bends a km at 2 m and 25 to 44 degrees of turning a km; the bends'
  wavelength (300 m times each kind's `wave`) and the safe line's own 150 m wander are shared.
- **How differently the five ride is mostly air and what stands in the way:** the mid pilot is in the air 24 to 35%
  of the run, the expert 37 to 51%, and the colliders a km run from 43 to 126.

## What all five share, and a new mountain would want to vary

Every constant in `src/sim` that is the same on all five and that a new mountain might want different, with where it
is defined, every place it is read, and how it could become per mountain while the five keep their exact values (the
brief's rule: a shared constant may become per mountain only if the five keep theirs). "Per mountain" below means an
optional field on `MountainParams` (or a new section kind under a new id), read where the constant is read now and
defaulting to today's value, so the five's courses, seeds and records do not move.

| What | Value on the five | Defined | Read | To make it per mountain |
|---|---|---|---|---|
| **Stage lengths** | 1,450, 1,500, 1,550 m | `course.ts` 189 `STAGE_LENGTHS` | course.ts `stages` (920), `pour()`'s room (1087); `game/standing.ts` 11 `FINISH_Z` (their sum), read by `app.ts` 2897, `challenge.ts` 44, `field.ts` 353 and 480, `ghosts.ts` 468 and 487, `graveyards.ts` 90 and 91, `missions.ts` 82, 95 and 111 (the distance missions' caps), `settle.ts` 361, `standing.ts` 48 (a record counts as finished only at 4,500 m); `game/pacer.ts` 47 `PACE_OPEN` (the last stage's length); `mountains.ts` 53 `DESCENT` (by hand); tests/fairness | A `stages` field, default the three. Every game-layer read of `FINISH_Z` must become the run's `course.finishZ`: as it stands, a longer mountain's records would be cut at 4,500 m and a shorter one's never counted finished. |
| **The stage count** | 3 | `SCRIPTS` is `[Act, Act, Act]` (615); the room array (1087); the six deals (1214) | `AUTHORED` three a mountain (`moments.ts` 158); the charm gates, one at the start and one past each stage line (`charmGateZs` 2391; `SimConfig.charmGates` 1 to 3; `charms.ts` offers by gate index); `sim.ts` `lines()` 2102, every get-up back at each line; `stageGates` one a stage; the HUD's stage line (`app.ts` 3821); the Long Night's legs | The owner's default (section 8, 5) keeps three. A count would need every one of these to read the course's stages. |
| **The finish** | the square 300 m before the line, 23.2 to 24.8 m wide, grade 0.08, turn-back 3 m; 260 m of run-out | `FINISH_SQUARE` 193, `RUN_OUT` 191; the `finish` kind's `SHAPES` (420), `GRADE` (435), `WIDTH` (447) | `pour()` (1087, 1178); `render/landmarks.ts` (4, 501, 606), `render/overlook.ts` 217; `moments.ts` `climaxOf` 1090 (where the town begins); `render/lanternworld.ts` (offsets from `finishZ`) | A new finish kind under a new id (its own shape and lengths), the last beat a mountain's own; the five keep `finish`. |
| **The opening** | start 120 m at 0.5, bowl 240 to 270 m, cruise 120 to 150 m, the leap 12 to 30 m on: lip 590 to 670 m | `opening()` 1028; `BODY.start`, `GRADE.start`; `lay()` 1245 (the run-in's line calmed) | `pour()` (1082): it is always the first four beats, and the first act's first place is pulled up to meet the leap (1091) | A per-mountain opening (a list of beats, default today's). |
| **The first minute** | first kicker 286 to 312 m; nothing on the line before 800 m; pickets from 900 m; the run-in's lights 130 to 290 m; falls free before 700 m; the start at 14 m/s at z 2 | `layKicks` 1463; the 800 m floors in `layKicks` 1476, `layFields` 1508 and `stageGates` 2405; `PICKETS_FROM` 669; `LIGHT_RUN_*` 672 to 675; `sim.ts` 69 `FREE_TUMBLE_Z`, 28 `START_SPEED`, 481 | course.ts as named; `FREE_TUMBLE_Z` also in `game/director.ts` 1151 and tests/getup | Tied to the opening: a mountain with another opening wants these from its own first leap, not from fixed metres. Per-mountain fields, default today's. |
| **Leaps** | three; lip slope 0.27 over a 26 m brow, a 4 m face, a landing face steepening to 0.8 held 186 m and eased over 30 m (220 m from lip to the section's end), clear 40 m past it, an 80 m run-in kept clear; grade 0.38 to 0.42 | `LIP_SLOPE` to `LEAP_RUN_IN` 498 to 522; `GRADE.leap`; `BODY.leap`; the count from the scripts | `layLeap` 1299, `layBands` 1401, `buildFeatures` 1974, `placeLights` 2505; `moments.ts` `planMoments` (a leap's set piece is 40 m above its lip to 30 m past its last landing) and `climaxOf` (the last leap is the peak); the render (`course.leaps`); `bot.ts` 737 | Cliff heights are already per mountain (`CLIFFS`, 524). Another leap shape (a smaller hop, a longer gap) is a new kind under a new id with its own constants; the count is the script's. |
| **Banks and walls** | the bank rises 9.5 m at a 10 m turn-back; walls by kind (ravine 13 m at 5, tunnel 6 m at 3, street at 2, bridge at 0.8 over a 34 m fall) | `FOREST_LIMIT` 16, `bank()` 246, `WALL_FOOT`, `WALL_TOP`, `FALL_*` 384 to 390; each kind's `limit`, `wall`, `fall` | `edgeRise` 755, `bareGround` 1794, `edgeLimit` 944, then `sim.ts` `edge()` 2077 (the turn-back); `render/camera.ts`, `dressing.ts`, `groves.ts`, `overlook.ts`, `props.ts`, `terrain.ts` (`FOREST_LIMIT`) | Per kind already: a new kind brings its own `limit`, `wall` and `fall` (a banked ice run's walls, a channel). `bank()`'s profile is one curve for every kind; a ridden wall wants its own. |
| **The slope** | `BIOME_PARAMS.slope` 0.28 to 0.31 (21 to 31% of the run); every other kind's own grade | `mountains.ts`; `GRADE` 424; `CREST_LIMIT` 495 | `baseYAt` 1777, `pushSection` 1269, `blendOf` 987 | The parameter is per mountain already; a steeper or stepped profile needs new kinds with their own `GRADE`. |
| **The difficulty ramp** | 4,500 m for every mountain | `mountains.ts` 53 `DESCENT`, the `rampDistance` of all five (70 to 136); also `audio/probe.ts` | `difficulty()` 962: the corridor's narrowing, the colliders' count, drops, kickers, moguls, vents | The field is per mountain already; only the value is shared. A new length sets its own. |
| **Width** | `halfWidthStart` 18 to 21 easing to `halfWidthEnd` 12 to 14; the plain corridor never under 8.5 m a side, never over `halfWidthStart` + 3 (+ 40 where a kind pins it) | `halfWidthAt` 1718 to 1727 | everything that reads `halfWidth` (the sim's `edgeExcess`, collisions with the banks, obstacle placing) and the render's terrain, "fine out to `halfWidthStart` + 12.6 m" (1723) | The widths are per mountain; an open face wider than about 52 m needs the cap and the terrain's mesh to grow with it. |
| **The line** | bends at 300 m times each kind's `wave`; the centre's swing `wander` x (0.35 + 0.65 x difficulty), eased in over 220 m; the safe line's own wander over 150 m, `reach` = (width - 4.2) x 0.8 x `span` | `freqOf` 808, `centerXAt` 1697, `pushSection` 1278, `safeXAt` 1743 | the safe line everywhere: the fairness promise, kickers, lights, the pilots and the bot | `wander` is per mountain; the 300 m and 150 m wavelengths are not. A twistier course wants them per mountain or new kinds with a short `wave` (switchbacks have 0.55). |
| **Colliders** | per chunk (7 + 15 x difficulty) x density x the chunk's template x the kind's share; the safe lane 2.45 m a side, 1.5 m more early | `buildChunk` 2199 to 2204; `SAFE_LANE` 14, `EARLY_MARGIN` 19 | `collide()` in sim.ts; tests/fairness | Density and the kinds (`TALL`, `LOW`) are per mountain; the budget's formula and the safe lane are the fairness promise and should stay. |
| **Kickers** | flights of 48 to 58 and 58 to 68 m at 30 m/s; at most two a section on the line | `KICK_*` 551 to 557, `KICK_KINDS` 563, `OPEN_GATHER`, `KICK_GATHER` 568 to 569 | `layKicks` 1455, `buildFeatures` 2018 | Per kind (which kinds take kickers); the sizes are shared. |
| **Sky gates** | one a stage over its most open kicker on the line past 800 m | `stageGates` 2398; `GATE_REACH`, `GATE_CHARGE`, `GATE_R` 677 to 679 | `sim.ts` (rings), the render, the sky-gate stats | Follows the kickers and the stage count. |
| **Stage-line thresholds** | 190 m of plain corridor, at least 22 m wide; charm gates 110 m and 100 m past each line | `THRESHOLD_*` 823 to 828; `charms.ts` 112 and 113 | `pour()` 1084 to 1176, `pushSection` 1267, `layBands` 1428, `surface` 1854; tests/charmgates | The charm gates are a rule a rider plays by (charms); keep them, on the new stage lines. |
| **Surfaces** | snow, ice patches, glass | `SNOW`, `PATCH_ICE`, `GLASS` 175 to 178 | `surface()` 1851, `sim.ts` `groundStep` | A new surface is a new constant under a new name, used only by new kinds. |
| **The tables keyed by biome** | five biomes | `CourseBiome` (mountains.ts), with `BIOME_PARAMS`, `BIOME_BY_SEED`, `TALL`, `LOW`, `CLIFFS`, `SCRIPTS`, `SIGNATURES` and `moments.ts` `LEGEND_LOOK` | course.ts throughout | A new mountain is a new biome in every one of these. `BIOMES` (the four the Daily and the Cup deal from) must not gain it (section 8, 6). |
| **The rules a rider plays by** | get-ups 3, one back every 200 m and all at each stage line; par 24 m/s; top speed 46 m/s; the drag and friction | `sim.ts` 46, 51, 86, 22 to 26 | `sim.ts` throughout; `app.ts` 3824 | Not to vary (section 3). Par already reads the course's `finishZ`. |

Outside `src/sim`, the game layer's five-mountain assumptions the brief already names for M1: Trials' `% 5`
(`game/trial.ts` 131), the Long Night's `LEGS` (`game/modes.ts` 21), the graveyard names hashed over the list's
length (`game/graveyards.ts` 64 and 127), and the title's strip; to which this adds every `FINISH_Z` read above and
`race-lab.ts`'s own `FINISH = 4500`.

## What the main lane must decide

- **The new-rides bar's reading** (above): as written, four of the five pass it against the rest. The 15% margin, or
  measures the five share exactly, would make it a test a reskin fails.
- **The fair bar's baseline is 27 of 30** for the clumsy pilot (Pinecrest and Sakura), on 30 seeds and a 900 s cap.
  Six seeds put the hardest the other way round.
- **Every `FINISH_Z` read in the game layer** (eight files, listed above) must become the course's own `finishZ`
  before a mountain of another length is raced, or its records will not count as finished. This is M1 groundwork the
  brief's list does not name.
- For DECISIONS (the main lane's to write): section 1's mountains review is right on the grammar (one opening, one
  length, one set of stages, three leaps, one square, a mid rider home in 121 to 129 s) and wrong on four details
  (18 kinds: 16 used, 9 on all five; a sky gate a stage: 1 to 3; ice everywhere: none on Ember; a tree and a rock
  alike: a rock can be jumped). It missed that the stage lines, the first minute and the difficulty ramp are identical
  too, and that the five differ most in colliders a km (43 to 126) and air (24 to 35% for the mid pilot).

## What only a person can judge

Every number here is the sim's or a pilot's. Whether the five feel like one course, whether a new mountain rides
differently, and whether the greyscale set can be sorted are for a critic and then the owner; the lab pilots ride
the five well, but none of them is a person, and the clumsy pilot's air in particular is a scripted hand bouncing off
the banks.

## The greyscale still set ("Not paintings")

`shots/r9/measure/stills/`: `colour/` (the originals), `gray/` (greyscale copies, ffmpeg's `format=gray` as
`blind-pairs.mjs --gray` makes them), `colour-sheet.png` and `gray-sheet.png` (a row a mountain in `MOUNTAINS` order,
Pinecrest to Lanternfall; a column a frame, opening to finish), `plan.json`
(`stills-plan.json` for this first set) and `raw/` (stills.js's own names and logs).

The rule (`r9-stills-plan.ts`), so the same set can be shot on a new mountain: desk, High, 1280x720, the pool rider 0
replayed as the player on a virtual clock (`stills.js`, the HUD hidden), five frames a mountain: the **opening** at
60 m; three **places** at a quarter, a half and three quarters of the run (1,125, 2,250 and 3,375 m on the five, one
in each stage); the **finish** 60 m short of the line. Files are named `<id>-<n>-<slot>-z<metre>-<section kind>[-<set
piece>].png`. The places on the five:

| | opening | a quarter | a half | three quarters | finish |
|---|---|---|---|---|---|
| Pinecrest | 60 start | 1,125 fork | 2,250 bowl | 3,375 fork | 4,440 square |
| Frostfang | 60 start | 1,125 ravine | 2,250 ravine (the Crevasse Fields) | 3,375 tunnel (the Ice Cavern) | 4,440 square |
| Ember | 60 start | 1,125 ravine | 2,250 fork | 3,375 bridge | 4,440 square |
| Sakura | 60 start | 1,125 terraces (Petal Steps) | 2,250 fork | 3,375 fork | 4,440 square |
| Lanternfall | 60 start | 1,125 ravine (the Cloud Sea) | 2,250 fork | 3,375 bridge | 4,440 square (the First Flame) |

Shot on 23 November in one session (the dev server on 4910, the browser slot held 17 minutes); every one of the five
loads logged no console error or warning. The rider is pool rider 0 of each mountain, so it is a different rider on
each, at its own pace (it reached 4,440 m at 102 s on Sakura and 205 s on Lanternfall): the frames hold the run still
for a fair comparison of builds, not of riders.

What I saw in the greyscale sheet (my own look, not a critic's, and not the sorting test itself, which needs all
eight): the finish column is one picture five times over (the same square, gate, stands and hanging lanterns); the
openings are one composition (a wide trench falling away from a centred rider toward a valley under ranges); the
three places differ more, by what the course puts there (ravine walls on Frostfang, Ember and Lanternfall, the
Ice Cavern's roof, Sakura's open terraces and forks, Pinecrest's open fork and bowl). That matches the numbers: the
five share the opening and the square exactly and differ in the middle.
