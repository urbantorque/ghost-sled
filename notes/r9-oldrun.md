# Round 9, the Old Run's lane (milestone 3, the first of the three mountains)

The brief is `notes/r9-briefs/oldrun.md`; the rules `notes/r9-lanes.md`; the ground it stands on `notes/r9-ground.md`
(the sim design, its review and section 15's lab). Branch `r9-oldrun`, cut from `round-9` at 7387799. Every figure
here is the sim's, ridden by scripts; **nobody has ridden the Old Run by hand**. The gate on every commit is
`tests/five.test.ts` (the five's and the six Dailies' courses, rolls and rides byte for byte); it has held on each.

---

## 1. The wall made to pay, in the lab

### Before (the groundwork's lab, `shots/r9/ground/oldrun-lab.txt`, 7387799)

| Pilot | Time | Mean speed | Bend ticks on the glaze |
| --- | --- | --- | --- |
| careful line | 144.8 s | 21.6 m/s | 0% |
| novice | 141.7 s | 22.2 | 1% |
| mid | 126.9 s | 25.0 | 13% |
| expert | 123.6 s | 25.7 | 36% |
| bot 0.25 / 0.55 / 0.9 | 131.2 / 124.6 / 111.9 s | 23.9 / 25.2 / 28.0 | 0 / 0 / 3% |
| clumsy | 30/30, 261.8 s | | |

One steering hand (`oldrun-hand.ts`): the floor's middle 128 to 136 s, the glaze line 150 to 154 s. The glaze cost
time.

### Why it cost (what the lab found, in the order it mattered)

1. **The bank turned the sled's nose, not its motion.** `wallYaw` turned the heading and the runners' grip turned the
   velocity after it, so a sled riding the wall at its settling height still slipped through every bend exactly as a
   sled steered round it on the floor did, and paid the same speed for it (`speed * |slip| * 0.25` a second). The wall
   could only cost: its yaw was one more thing to correct, and every correction was slip. A banked wall holds a sled
   round a bend by pushing on it, not by the runners. **Fix:** `TRACK_BANK` (`sim.ts`, track only): the bank's turn is
   applied to the velocity as well as the heading. A sled at its settling height now turns with the channel and spends
   nothing on slip; one held above or below it steers against the wall and pays the slip of a steered turn. This is
   the change that makes "the wall carries you round" true in the sim. (A softer `wallYaw`, the brief's first
   suggestion, was tried at 0.85, 0.8, 0.75 and 0.6: each moved the settling height up, none changed who won, because
   the cost was the slip, not the height.)
2. **The hand popped.** `oldrun-hand.ts` crouched (the action bit) whenever its steer was near the middle and let go
   when it steered harder, and in this game letting go of a crouch on the snow is a pop: its glaze line hopped off the
   wall at every correction. A height-holding hand that never touches the button rode the glaze line 7.5% faster than
   the floor line on the groundwork's own numbers, before any other change.
3. **The bends were too short to ride.** Smoothstep turns put the radius the turn was laid for at one point in its
   middle; a bend (curvature over 1/180) lasted 30 to 70 m, under a second at speed, 29% of the run's length. Nobody
   can climb a wall and settle in under a second. **Fix:** each turn's curvature rises over its first quarter, holds
   at its radius through the middle half, and falls over its last (`easeP`, `easeX`, `easeK` in `oldrun.ts`, closed
   form); the acts were redrawn as long sweeps (below). Bends now run 36 to 105 m, 40% of the run's length.
4. **The run was slow** (0.17 grade, a 14 m/s start that took most of the first stage to reach speed). **Fix:** the
   track's grade 0.28 (the five's own slopes run 0.30 to 0.34), track ice's drag 0.45 (from 0.55), and a start house
   of its own kind (`house`, 160 m at 0.36: 13 m more drop, so a rider leaves it near 25 m/s).
5. **The walls were the wrong height for their radius.** A sled settles where `tan(theta) = v^2 / (g R)`; at the
   run's speed (about 34 m/s) the glaze two thirds up a wall needs a wall of about 420 / R metres. The groundwork's
   walls (7.5 m at radius 70 or tighter, 5 m at 130) put the gentle bends' settling height under the glaze. **Fix:**
   `WALL_K / R`, 3 to 7.5 m.
6. **The glaze was hardly faster than the wall below it** (drag 0.4 against 0.55), and its band narrow (0.5 to 0.85
   of the wall). **Fix:** the glaze's drag 0.25, its band 0.4 to 0.9 on any bend wall of 3 m or more; the slush's
   drag 1.3 (from 1.6), set last, so the glaze line's lead over the floor line lands in the bar's window.
7. **The controllers re-planned a heading** a turn late. **Fix, the lab's pilots** (`labpilots.ts`, behind `c.kit` and
   `kit.track`): on the track the mid and expert pilots hold a height: the offset square to the channel steered
   toward their line's, with the channel's own turn, the wall's turn and the track's damping fed forward, and the
   bank's turn of the motion taken into the slip they ask for. They do not drift on the track (a drift there is a skid
   across a wall). `kit.floor` rides the same hands on the floor's middle: the bar's floor line. **Fix, the bot**
   (`bot.ts` `trackSteer`, behind `onTrack`): the same hold from where the sled will be when its hands act, looking
   0.9 s ahead (0.35 s was a turn late in the Labyrinth at 40 m/s), its gains scaled by its own steering time constant,
   its noise drawn as `followSteer` draws it. **Fix, the line** (`oldrun.ts` `lineFor`): where a rider's speed settles
   it on the glaze it rides there; below the glaze a skilled rider climbs onto it as the bend deepens (not in a step
   at the bend's first metre, which the bot read as a jolt); above it, under the lip.

Kept from the groundwork: `TRACK_DAMP` 1.8 (1.2 and 2.5 changed nothing that mattered), the launch test, the turn-back,
gravity along the runners, the parapet carrying the wall's curve.

### The acts as laid now (`oldrun.ts` `compose`)

- **The Hotel Straights** (0 to 950): the start house (`house`, 160 m at 0.36), then two long sweeping S-bends (each
  turn 0.45 to 0.6 of slope, radius 100 to 135, walls 3.1 to 4.2 m), the first charm gate at 110 m in the house.
- **The Labyrinth** (950 to 1,950): three tight S-bends close together (0.55 to 0.7, radius 45 to 60, the deepest
  walls, 7 to 7.5 m), holds of 0 to 12 m between turns.
- **The Horseshoe** (1,950 to 3,000): a lead S-bend (0.4 to 0.5, radius 80 to 100), then the hook: out to 35 degrees
  off the fall line, round through 70 degrees at radius 70 on a 6 m wall (the Horseshoe itself, about 130 m of held
  curvature), and back, into the outrun (0.05, the finish 120 m into it).

Bends (curvature 1/180 or more) are 1,210 m of the 3,000 (40%), against the groundwork's 872 (29%). The concept's 60%
would need the thresholds and the outrun in bends, or the turns' ramps shorter: a fourth Labyrinth S-bend (tried:
42%) squeezed every bend tighter and cost the expert and the strong bot their glaze (51% and 47%), so it is not laid.

### After (`npx tsx scripts/r9/oldrun-lab.ts`, heavy slot; `shots/r9/oldrun/oldrun-lab.txt`, `.json`)

As the lane leaves it (the mountain registered, its set pieces live, a rider of 0.3 or under riding lower than the walls
would carry it; the first column of figures at the section's own commit, f5a0792, is in brackets where it moved):

| Pilot (plain day, 6 seeds; bots 3) | Finished | Median time | Mean speed | Bends' time | Bend ticks on the glaze | In the slush | Falls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a sled let go | 1/1 | 97.8 s | 32.5 m/s | 40.3 s | 28% | 50% | 0 |
| careful line (the floor's middle) | 6/6 | 107.8 s (96.5) | 29.2 | 44.5 s | 0% | 97% | 0 |
| novice | 6/6 | 103.0 s (101.7) | 30.9 | 42.3 s | 6% | 38% | 0 |
| **mid** | 6/6 | **89.6 s** (90.4) | **35.8** | **36.3 s** | 54% | 13% | 0 |
| mid on the floor line | 6/6 | 106.4 s | 29.4 | 44.0 s | 0% | 100% | 0 |
| expert | 6/6 | 89.1 s (89.8) | 36.0 | 36.0 s | 61% | 13% | 0 |
| bot 0.25 / 0.55 / 0.9 | 3/3 each | 91.2 / 90.8 / 85.6 s | 35.1 / 35.1 / 37.5 | | 39 / 46 / 62% | | 0 |
| bot 0.9 racer | 3/3 | 84.3 s | 38.0 | | 58% | | 0 |
| clumsy (30 seeds) | **30/30** | 158.4 s | | | | | 0.4 a run, every one a pop's flight landed badly |

The mid pilot in each mood: 89.6 to 92.5 s, and 97.8 under Comet Night's lighter gravity; all finished, no falls.

**The bar** (printed by the lab, line by line):
- MET: the mid pilot's glaze line beats its own hands on the floor line by **17%** of the bends' time (10 to 20%);
  against the careful line's own hands, 18%.
- MET: the expert spends **61%** and the bot at 0.9 **62%** of its bend time on the glaze.
- MET: the novice finishes 6 of 6 and a sled let go finishes, no falls, both on the floor's slower line.
- MET: the clumsy pilot finishes **30 of 30**.
- MET: **no fall** that was not a pop's flight landed badly (13 falls in every ride, all of them that).
- MET: the mid pilot finishes in **89.6 s at 35.8 m/s** (85 to 95 s, 32 to 36 m/s). In `r9-courses.ts`'s harness, where
  the mid pilot also spends its lanterns and carries charms, it finishes in 83.7 s at 38.2 m/s: a little quicker than
  the concept's window (section 5).

`tests/oldrun.test.ts` gains the first, second and sixth as promises (two seeds), so the wall cannot quietly stop
paying.

### What is still short, or only a script's

- **Nobody has ridden it by hand.** Whether the bank carrying the sled feels like a bank or like a rail, whether a
  person can find the glaze at speed, and whether the floor feels slow rather than broken: only a person can say.
- A sled let go rides up to the lip once, in the Labyrinth's middle turn (u 1.04 where its speed settles it at 0.71;
  no scrape). Elsewhere it overshoots its settling height by up to about 0.25 of the wall, or stays under it at the
  short end turns of an S-bend.
- The clumsy pilot leaves a wall unpopped 4 times in 30 runs (the groundwork's lab: once). Each was high on the
  *inside* wall of a Labyrinth bend, at u 0.9 to 1.1: there the channel bends away under the sled and the ground falls
  from it faster than gravity at 20 m/s and more (`slope across x the channel's curvature x v^2`, about 23 m/s^2
  against the launch's 14.7). It is a real crest, not a fault of the test, and nothing followed it (no fall); riding
  the inside wall high is the mistake it punishes. Taking it away would need the inside wall to fall faster than the
  crest limit allows at the lip.
- The bot's spread is narrow: 0.25 at 92.7 s against 0.9 at 84.9. Nothing in the track floors a weak rider and the
  walls carry anyone who lets them, so on the Old Run skill shows as speed carried, not as falls avoided. The pool
  (section 3) shows what that does to a field.
- The let-go and novice "on the floor": they ride low and slow (35 to 50% of their bend ticks in the slush) but the
  walls carry them part way up; neither is forced into the floor.

### Files (section 1)

`src/sim/oldrun.ts` (the turns, the acts, the walls, the surfaces, the line), `src/sim/sim.ts` (`TRACK_BANK`; the
bank's turn applied to the motion; `wallYaw` unchanged), `src/sim/course.ts` (the `house` kind: its union member, its
`SHAPES`, `GRADE`, `WIDTH`, `BLEND`, `BODY` rows; the track's grades read from `oldrun.ts`), `src/audio/listen.ts` and
`src/render/landmarks.ts` (`house` in their `Record<SectionKind>` tables, the track's neutral values),
`src/bot/bot.ts` (`trackSteer`, called only `onTrack`), `scripts/playtest/labpilots.ts` (`Kit.track`, `Kit.floor`,
`holdTo`; no drift on the track), `scripts/r9/oldrun-lab.ts` (the bar, the floor line, bend time counted in the air
too), `scripts/r9/oldrun-tune.ts` (the quick bench: ideal hands on three lines, the pilots and the bots),
`tests/oldrun.test.ts` (the glaze's bar). Nothing on the five runs any of it: `trackOn`, `onTrack` and `c.kit` are
false there, and the fingerprint holds.

---

## 2. The set pieces and legends (the sim's side; the world draws them, `notes/r9-oldrun-world.md`)

Three verbs appended to `VERBS` (never reordered: the stingers key on the name and fall back to `st.any`): `peal`,
`split`, `glaze`. Each stands on one of the kit's own places (`oldrun.ts` `placeOf`: the Hotel Straights' bends, the
Labyrinth, the Horseshoe's hook), a stage each, through a new optional `place` on `moments.ts`'s internal `Def` (no
shared type gains a field: `MomentPlay` and `MomentSpec` are the fingerprint's JSON, so the three verbs reuse their
fields, each documented where it is declared).

| Set piece | Verb | What wins it | Variants |
| --- | --- | --- | --- |
| The Bend Bells (stage 1) | `peal` | a bell on an iron bracket over each of the Hotel's six bends, at the middle of its held curvature on the outside wall; pass within 1.6 m of it (`targets`, `need` all) | on the glaze (0.6 up the wall), high on the wall (0.78), each higher than the last (0.45 to 0.85) |
| The Labyrinth (stage 2) | `split` | its first bend to its last inside the split (`pace` m/s, `need` ticks); lead and trail said as the rider passes or falls behind the split's pace | the split (31.2 m/s, 22.8 s over 712 m), a quick split (32.6), clean (31.2 and no scrape: `row`) |
| The Horseshoe (stage 3) | `glaze` | ticks on the hook's glaze (`need`), in all or in one hold (`row`), or above a share of the wall (`hw`) | hold it (3 s), unbroken (1.5 s in one hold), high on it (1.3 s above 0.7 of the wall) |

The numbers came from the lab (`scripts/r9/oldrun-pieces.ts`: every variant, the novice, mid and expert pilots and
the bot at three skills, four seeds each; the mid pilot rides the Labyrinth at 31.5 m/s, the strong bot at 33.5; the
mid pilot holds about 175 of the hook's 520 ticks on the glaze, the expert 207, its longest hold 113):

| Variant | novice | mid | expert | bot 0.25 | bot 0.55 | bot 0.9 |
| --- | --- | --- | --- | --- | --- | --- |
| bells: on the glaze / high / rising | 0/4 each | 4/4 each | 4/4 each | 2, 1, 2 /4 | 2, 2, 0 /4 | 3/4 each |
| split: even / quick / clean | 0/4 | 4, 0, 4 /4 | 4, 0, 4 /4 | 2, 1, 3 /4 | 0, 0, 2 /4 | 4/4 each |
| Horseshoe: hold / unbroken / high | 0/4 | 2, 2, 3 /4 | 4/4 each | 2, 1, 1 /4 | 3, 2, 0 /4 | 3, 2, 3 /4 |

The quick split is won with a lantern: the lab's skilled pilots and the bot dash into the split as into a race
(`labpilots.ts` SPEED, `bot.ts` momentRide), and `tests/moments.test.ts`'s "every variant of every set piece is won by
a skilled pilot" holds on the Old Run with them. The bot rides a bell at its own height on its wall from about 1.6 s
out, and holds the Horseshoe's high variant above its share; the lab's mid and expert pilots likewise (the floor line
plays no set piece). The chip's words are in `src/ui/momentcopy.ts`; nothing new on the HUD (the set piece's chip is the
five's).

**Legends** (`LEGENDS.oldrun`, on the kit's places through a new optional `place` on the internal `LegendDef`): *The
Ghost Bob* (a runner over the Horseshoe's lead S-bend: "The hotel's first bob runs the track: follow its lights") and
*The Ballroom Night* (sky, over the Labyrinth: "The grand hotel lights every window").

## 3. Registered, its home riders and its pool

- **Registered:** `MOUNTAINS[5]`, appended: `{ id: 'oldrun', name: 'The Old Run', tagline: 'An old ice track: ride high
  on the glaze', seed: OLDRUN_SEED (0x9b05688c, the lab's: no Daily's or Cup's to 2040), unlockGhosts: 18 }`;
  `MountainId` gains it; its `LAYOUTS` row and kit are the mountain's; out of `BIOMES` (the Daily and Cup); events the
  light storm and the spirit train only; `LEG_NAMES` already had it; `EIGHT_FROM` null and the Long Night at ten legs.
  `FIRST_RUN_PACE.oldrun` 95 s (the five's are 0.85 to 0.95 of the lab novice's time; the Old Run's novice rides 101.7).
  `MOUNTAIN_NAMES` (almanac) and the Trials' `NAMES` gain it (the Trials' `HOURS` waits for its other hour's name).
- **Home riders** (`src/bot/roster.ts` `HOME_RIDERS`; The Twelve stays twelve, homes 0 to 4): *Count Orsolo* (racer,
  0.86, stovepipe and moon, cream), *Gus Fennick* (liner, 0.76, aviator and star, ice grey, the track's old keeper),
  *Lotte Bell* (collector, 0.58, bobble and bell, lilac white, the bellringer's daughter). `riderByName` knows them
  (their looks on the snow and their lines in the race); the pool rides them after The Twelve on draws of their own
  (none on the five, whose pools draw exactly what they drew); the mastery board has a star for beating each to the
  line. Never a duel: no page, ladder or showdown of The Twelve's reads `HOME_RIDERS`.
- **The pool** (`npx tsx scripts/generate-ghosts.ts --only oldrun`, alone in the heavy slot, single process, 25 s):
  **49 ghosts** (30 of the crowd, The Twelve, the three home riders and four of the fast end), every one finished, 38 KB.
  Finish times 77.9 to 100.7 s, median 82.3. `tests/ghostpool.test.ts` replays every record to its stored result.
  - *Its spread is narrow:* p90/p10 is 1.15 against the five's 1.28 to 1.30. Nothing on the Old Run floors a weak
    rider and the walls carry anyone who lets them, so the slow end the five get from trees and falls is not there.
    Against the lab's novice the pool reaches as far as Pinecrest's does (its slowest ghost 0.99 of the novice's time,
    Pinecrest's 0.93), but its middle is crowded: 80 to 92 s holds 80% of it. Two changes went in for it: a new rider
    (skill under 0.3) rides lower than the walls would carry it (`lineFor`'s `trust`), and the fast end's gap is scaled
    to the course's length (a third shorter keeps a third more of its quickest; on the five exactly as before). **For
    the main lane:** whether a compressed field is the Old Run's character (close racing on a forgiving track) or
    wants the weak bots to make a person's mistakes (fighting the walls, scraping the lip), which only a person riding
    it can say.

Every hunk in a shared game file (`src/game/app.ts`): the mastery board's home riders read `[...ROSTER,
...HOME_RIDERS]` (the import and one line). `src/ui/contract.ts`: `MountainCard['biome']` gains `'oldrun'`.
`src/game/save.ts`, `spineview.ts`, `ui.ts`: untouched.

## 4. Its score

`scripts/music/pieces/oldrun.ts`: **a galop for the grand hotel's band** on the ice, A major at 152, straight: a tuba's
oom on every beat and the trombones' pah off it, cornets with the tunes and a piccolo over them, pizzicato strings, a
snare and a bass drum, sleigh bells, a xylophone, and tubular bells for the bends. The verse is three quick notes and a
run every two bars (the sled into a bend and out of it); the hook takes the same three notes up an octave to a held
third; the trio drops to the relative minor's colour and the trombones sing it; a second strain carries the hook into
D (the subdominant, where a galop's trio goes) on the xylophone and the bells; the last stage lifts a whole tone to B,
and the finale is the game's motif on the whole band. Its form is the five's (an opening, three stages, a breakdown on
the bend bells, the finale, the results). Original. The live band (`src/audio/theory.ts` CLEAR, `score.ts` SONGS)
keeps its key and tempo (A major, 152), so a player without the produced score hears the same galop's harmony and pulse.

Its three verbs' stingers (`scripts/music/pieces/common.ts` `OWN_GESTURES.oldrun`): `peal` (three bells struck one
after another, each higher, to a held chime), `split` (a clock's tick on one note doubling into a rush, then the
octave), `glaze` (a line that climbs a sixth and holds, high and smooth). They are the Old Run's alone: no Daily, Cup
or other course lays those verbs, so only its own piece carries them (the stems test now asks each course for a
stinger of every verb it can meet, and that no course carries another's own). `src/audio/stemform.ts` `PIECE_OF` and
the dev jukebox know the piece and the verbs.

**The whole score was rebuilt** (`npx tsx scripts/music/build.ts`, the heavy slot, about 16 minutes): the build stamps
every pack with a hash of all of `scripts/music`, and the game refuses a pack whose stamp is not the manifest's, so a
new piece means a whole build. The five's packs hold the same music and the same stingers as before (their sources did
not change); what changes in them is the stamp. The levelling now sets every course's reference run to the mean of
the five's (`build.ts`), so the five keep the level each had and a new course is levelled to them.

## 5. Against the five (`npx tsx scripts/playtest/r9-courses.ts`, heavy slot, 42 s)

Written to `shots/r9/oldrun/r9-courses.txt` and `.json` (not the measure lane's file). The five's table is milestone
0's figure for figure. The Old Run treated as new:

| Measure (mid pilot, 6 seeds, lanterns and charms as the harness rides them) | The Old Run | The five's range |
| --- | --- | --- |
| finish time | **83.7 s** | 121.3 to 129.4 |
| mean speed | **38.2 m/s** | 35.1 to 37.4 |
| air share | **0%** | 24 to 35% |
| turns a km of the safe line | 2.67 | 1.78 to 2.67 |
| mean width | **15.6 m** | 24.6 to 31.1 |
| hazards a km | **0** | 43 to 126 |

- **New:** outside the five on 5 of 6; **by 15% on 4** (finish time, air share, width, hazards). Met.
- **Fair:** the clumsy pilot finishes **30 of 30** against the five's hardest (Pinecrest's 27). Met.
- **The mechanic** (`r9-courselib.ts` `MECHANICS.oldrun`: on the snow, up a banked wall off the floor, a wall a bend has
  raised over a straight's 2.6 m): in play for **43.3%** of the mid pilot's run.
- Also from the table: the expert 81.9 s, the novice 98.7 s; the mid pilot wins 13 of 18 set pieces, the expert 18 of
  18; the clumsy pilot 147.6 s, 0.8 falls a run, every one off its own pops; set pieces span 57.7% of the run and the
  legends 30.3%; the course is 4 kinds (house, track, labyrinth, outrun), slope 0.278 with a standard deviation of
  0.045 (the five's 0.10 to 0.11: a steady run, not pitches and flats).
- *A note on its params:* `BIOME_PARAMS.oldrun.slope` still reads 0.17 (the table prints it), though every section's
  grade is set absolutely (0.28, the house 0.36). Only `cruiseSpeed()` (a get-up's push) and some far-terrain render
  reads use it. Changing it now changes the course's float bits and so the pool's replays; left for the main lane (a
  get-up on the Old Run pushes off at 11.1 m/s where 0.28 would give about 14).

## 6. Wired for the mountain, and what waits

- **Its card on the picker:** `MOUNTAINS[5]`'s tagline is its few words of mechanic ("An old ice track: ride high on
  the glaze"); the card's art (`src/ui/art.ts` RIDGES `oldrun`: a low sun over bare trees and the track's channel) and
  its sky (`.b-oldrun` in `src/ui/style.css`, deep blue to the amber of a low sun). The ui lane's eight-chip picker
  reads `MOUNTAINS`; its sheets may want `.b-oldrun` in `screens.css` beside `.b-lantern`'s (not added: the ui lane's).
- **Its mastery board:** its medals, its three set pieces' stars and its three home riders' stars (`mastery.ts`
  `[...ROSTER, ...HOME_RIDERS]`, `app.ts` the riders' pool times). No sky gate row (the Old Run has none).
- **Its missions' biome** is its own look, `'oldrun'` (`biomeForSeed`); no mission names it yet (the five's biome
  missions are snowmen, spirit gates and the like: nothing of the Old Run's), so it counts for every mission that is
  not a biome's.
- **Its other hour, by Lamplight** (the world's `ALT_HOURS.oldrun`), named in `almanac.ts` `HOUR_PHRASES` and the
  Trials' `HOURS`; **its mirror** draws (the world's captures). *Neither opens yet in a save:* the five's hours open on
  Almanac pages and their mirrors on a page or on every one of The Twelve who calls the mountain home beaten in a
  duel; the Old Run has no page and no Twelve at home. **For the main lane:** an Almanac page for the Old Run's hour
  and mirror, or its mirror opened by its home riders beaten to the line (its mastery board's rider row), as the
  five's open by The Twelve's duels.
- **What I would add to the Almanac, the album and The Twelve** (they stay as they are this round): an Almanac page
  "The Old Run" (hold the glaze through the Horseshoe in each variant; its hour and its mirror as the rewards); an album
  frame of the Horseshoe at sunset and one of the Bend Bells; a set of three (the brief's G6: a scarf, a trail and an
  ornament earned at a third, two thirds and all of its board: a bell ornament would suit); no change to The Twelve.
- **The Trials and the Long Night** are unchanged: `EIGHT_FROM` null, ten legs (the last of the three to register
  switches both).
- **Photo mode, Save Clip, the key art:** the world's captures (`notes/r9-oldrun-world.md`).

## 7. Only scripts have seen it

Every figure in sections 1 to 5 is the sim's, ridden by the lab's pilots, the clumsy pilot and the bot. Nobody has
ridden the Old Run by hand: not the wall, not the glaze, not the set pieces, not the bot's field around a person. The
score has been rendered, measured and level-checked by the build and the stems test, and listened to by nobody.
