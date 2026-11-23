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
and exits 0. It is a script, not a test, so it does not break the suite.

## The profiles

`shots/r9/measure/profiles/<id>.svg`, one a mountain, and `sheet.svg`, every mountain on one scale (0.3 px a metre
down the run, 0.1 px a metre of height, 1.1 px a metre across; `SCALE` in `r9-profiles.ts`, so a new mountain drawn
later sits beside them). The sheet opens with a row a mountain of its sections, leaps and set pieces, which is where
the five read as one course: the same opening (start, bowl, cruise, leap at about 600 m), a threshold at 1,450 and
2,950 m, a leap at 3,980 m on four, and the square. Each panel then has the height, the 25 m grade with the pitch and
flat lines, the corridor from above (floor, turn-back, safe line with its bends ticked, every collider as a dot by
group), the width with the 12 m and 30 m lines, the air (leaps, kickers on and off the line, steps and outlets, then
the mid pilot's flights, a row a seed) and a tick per collider, a row a group. Every mark has a hover title.

(The stills, the line-by-line check and the shared constants follow.)
