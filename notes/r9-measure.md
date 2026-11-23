# Round 9, milestone 0: the measure lane

How the five mountains ride, measured on the real sim in node: the baseline the three new mountains must leave
(brief section 2, "The three new mountains"; section 4, milestone 0, "Measure the five"). Everything here is a
script's reading of the sim. Nothing in it has been ridden by a person.

Scripts (all in `scripts/playtest/`, node only, nothing imported by the game):
- `r9-courselib.ts`: the measures, defined exactly in its header, and the lab's pilots ridden as `lab.ts` rides them.
- `r9-courses.ts`: the tables and the bars. Raw output in `shots/r9/measure/r9-courses.txt` and `.json`.
- `r9-profiles.ts`: the profile charts.

## The mid pilot (6 seeds a mountain, the lab's seeds and rolls)

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

The mid pilot's six seeds, seconds: Pinecrest 127.2, 122.3, 141.4, 122.8, 131.5, 139.5; Frostfang 119.5 to 124.6;
Ember 120.3 to 129.5; Sakura 124.8 to 131.3; Lanternfall 125.1 to 130.0.

**What a new mountain has to beat, in one line:** on the six, the five span only 121 to 129 s, 35.1 to 37.4 m/s,
24 to 35% in the air, 1.8 to 2.7 bends a km, 24.6 to 31.1 m wide and 43 to 126 colliders a km. The first five are
narrow bands (finish time 6%, speed 6%, bends 50% of a small number, width 27%); air is wider, and hazards per km is
the one wide one (a factor of 2.9, Pinecrest's tree runs against Ember's walls). A new mountain is outside the five
most easily on length and pace, width, turns and air; hazards per km has the most room inside it.

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
| width under 12 m | 3.7% | 9.7% | 6.7% | 3.5% | 4.9% | 3.5% | 9.7% |
| width over 30 m | 50% | 48% | 32% | 56% | 52% | 32% | 56% |
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
| the square, m (half-width, grade) | 300 (11.8, 0.078) | 300 (11.9, 0.082) | 300 (12.2, 0.079) | 300 (12.3, 0.080) | 300 (12.3, 0.079) | | |

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

(The rest of these notes, the other pilots, the profiles, the stills, the line-by-line check of section 1 and the
shared constants, follow as they are done.)
