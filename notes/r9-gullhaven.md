# Round 9, Gullhaven's lane (milestone 3, the second of the three mountains)

The brief is `notes/r9-briefs/gullhaven.md`; the rules `notes/r9-lanes.md`; the ground it stands on `notes/r9-ground.md`
(section 6, hook C) and how the Old Run was made, `notes/r9-oldrun.md`. Branch `r9-gullhaven`, cut from `round-9` at
c82f379. Every figure here is the sim's, ridden by scripts; **nobody has ridden Gullhaven by hand, and nobody has listened
to its score**. The gate on every commit was `tests/five.test.ts` (the five's and the Dailies' courses, rolls and rides
byte for byte), with `tests/oldrun.test.ts` and the Old Run's pool replays; it held on each. The world was built beside
the lane by a world-builder subagent, whose full account is `notes/r9-gullhaven-world.md`; the score by a score-builder
subagent, whose report is section 4 here.

---

## 1. The wind made to pay, in the lab

### The course as laid (`src/sim/gullhaven.ts`, seed 0x1f83d9ab, SHA-256's seventh initial word)

- **Three stages**, 1,550 / 1,600 / 1,650 (4,800 m): the Cape, the Geos, the Harbour Road. Kinds of its own only:
  `beacon` (the slope off the cape's head under the old beacon, 200 m at 0.3, 13 m half-width, the start's charm gate at
  110 m), `cliffpath` (the shelves at 0.2 and the thresholds), `geo` (the path's drop through a gully's head, 0.3),
  `descent` (the cut down to the harbour, 0.38), `sheds` (0.2), `harbour` (the finish on the harbour's sea ice, 0.025).
  Its mean grade to the line is 0.241, which `BIOME_PARAMS.gullhaven.slope` reads (0.24: a get-up's push and the far
  terrain), set before the pool was generated.
- **Nine gullies**: three over the Cape (lips near 400, 870, 1,340), four over the Geos (1,885, the Great Geo at 2,225,
  2,590, 2,910), two on the Harbour Road (3,490, 3,850), each jittered 5 m by the seed; the first lip past 330 m, one at
  least every 600 m. Not ten: a gully takes about 315 m from where its bold line leaves the path to where it is back,
  and ten would not fit clear of each other, the thresholds' approaches and the cut down to the harbour (the concept's
  "about ten").
- **A gully, and why it is shaped so.** The corridor's centre is the path (the safe line, the let-go's line, the clumsy
  pilot's aim: the review's finding 5). Before a gully the bold line eases 4.5 m seaward off the path while the path is
  still straight; then the path swings 10 m inland (12 at the Great Geo) round the gully's head and drops through it at
  the shelf's grade plus 0.1 (the `geo` section's own grade, so `baseY` carries it and nothing reads a ledge or a drop
  zone that is not one: the review's finding 13). Seaward of it the shelf runs straight on, held level (the kit adds back
  the path's fall, `fallOf`), to the lip: a corniced edge 5 m high (7 at the Great Geo) that leaves a sled in the air at
  any speed. Past the lip the gully's face falls with the path to the far shelf, so the face is no steeper than the path's
  0.3 and a rider short of the far shelf lands on it and rides it down. At the lip the bold line is 14.5 m (16.5) from
  the path; the corridor widens inland as the path swings, and its seaward edge, the fence (0.8 m past it, the whole way
  to the harbour, then the sea cliff's 120 m fall) stays where it was on the shelf.
- **The lift** (hook C): a column 2.5 m either side of the bold line (softening over 1.2 m more), from 4 m before the lip
  to 70 m past it (120 at the Great Geo), fading over 12 m, at 0.5 g (0.65 over the Great Geo). Always under gravity:
  it slows a fall, never carries a sled up. Pure in where the sled is (`kit.lift(c, x, y, z)` reads x and z), the same
  for every rider and every replay; the sim adds it in `airStep` right after gravity, scaled by the mood's gravity, and
  `landingWithin` steps a flight tick by tick where the air lifts (`liftLandingWithin`).
- **Surfaces**: the shelf wind-packed (`PACKED`, grip 0.85, drag 0.8: quick), the head's drift on and inland of the path
  (`DRIFT`, drag 1.5: the wind leaves its snow there), the gully's face plain snow, the harbour sea ice (`HARBOUR_ICE`,
  where the ice charms bite). Nothing stands on the run: no collider (see 1, "nothing floors a rider").
- **The rider's choice** (`lineFor`): a rider takes the bold line into a gully when its speed 60 m before the lip is at
  least 31 m/s less 14 times its daring (0.7 skill + 0.3 nerve), and a rider daring under 0.3 only over 36 m/s; once
  past that point the line is whichever it is nearer, so the choice holds to the gully's end (no state: the bot's
  "small map" is the rider's own position).

### Why soaring did not pay at first, and what changed (the bench, `scripts/r9/gullhaven-tune.ts`)

1. **A flier wastes the gully's drop.** The path rider turns the head's descent into speed on the snow; a flier keeps its
   lip speed (the air's drag is 1.5% a second) and gets back of the drop only what its landing on a falling slope pays
   (`land()`'s along-slope gain, at most about 5 m/s here, and a stomp's 2.5). With the lift through the whole flight
   (my first try) the flier was lofted 36 to 44 m over the face and its flights ran 5.4 to 7.5 s, and still won only
   8% of the gullies' time.
2. **The lift held to the rim** (gone above the shelf's height) made flights 4.3 to 5 s but built a free fall above the
   rim that the column could not arrest (a sled came back into it at 15 m/s down and fell through): the path won by 5%.
   Taken out again: the lift is in the column whatever the height, and **the column's length** sets the flight.
3. **The face falls with the path** at the shelf's grade plus 0.1 (from 0.22): with a steep face a sled flew four seconds
   off the cornice with no lift at all (the gully a leap turned sideways: the brief's first risk). On the gentler face a
   pop with no lift is 2.9 to 3.6 s, and the column takes it to 4.5 to 5.
4. **What the path goes through pays the soaring**: the drift in the head (drag 1.5) and the swing round it. Drift 2.4
   made the soaring line 29% faster and the run 143 s (the brief's second risk: nobody would ride the path); 1.5 puts it
   in the window.
5. **The run was slow** (0.17 shelves, a 25 m/s mean): the shelves 0.2, the pack's drag 0.8 (wind-packed snow), the
   beacon's slope 0.3 for its 200 m so a rider leaves it near 27 m/s.
6. **The lab's hands** (`labpilots.ts`, behind `c.kit && c.hasLift`, so the five's and the Old Run's pilots are as they
   were): the skilled pilots crouch into a lip on their line from a long second out and spring on its last tick, hold
   the column's middle in the air (a nudge inside the dead zone), and aim the landing at their own line; a drift is for
   a bend of the line they ride, not the path's swing while they hold the straight line past it (the expert had been
   drifting inland after the path, then popping early); at Gullhaven's 35 to 42 m/s the hands look further ahead (the
   five's look set them swinging 8 m either side of a straight line); the Old Run's wall-holding hands only on a track.
7. **The bot** (`bot.ts`, `model.ts`): `predictFlight` takes the course's air (`lift`, scaled by the mood's gravity; left
   out on the five, so their flights are stepped exactly as before); a **`lip` goal** (`lookForLip`): a lip on this
   rider's line (kit.ts `lips`) one to 2.5 seconds ahead, judged by `popFrom` (with the air) to come down inside the
   corridor clear of everything, crouched into from a long second out and sprung on its last metre, aimed at the lip's
   middle, whatever the combo holds (a lip is the line). General, for Gablefall: a lip is a z where the ground falls away
   under a line, x0 to x1 across it. In the air over a column the bot's nudge holds `liftX`, and its landing is aimed at
   its own line (`lineX`) rather than the safe line. Its planner lets a line leave the path at up to 0.4 a metre on a
   course with lips (the bold line as the path swings inland).

### After (`npx tsx scripts/r9/gullhaven-lab.ts`, heavy slot; `shots/r9/gullhaven/gullhaven-lab.txt`, `.json`)

As the lane leaves it (registered, its set pieces live, plain day):

| Pilot (6 seeds; bots 3) | Finished | Median time | Mean speed | Gullies soared (of 9) | Soared flights | Gullies' time | In a column |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a sled let go | 1/1 | 180.7 s | 26.6 m/s | 0 | | 107.5 s | 0% |
| careful line (the path) | 6/6 | 181.6 | 26.5 | 0 | | 108.2 | 0% |
| novice | 6/6 | 180.3 | 26.9 | 0 | | 107.1 | 0% |
| **mid** | 6/6 | **154.1** | **31.2** | **9** | 4.3 to 6.5 s, median **4.8** | **91.0** | 15% |
| mid on the path | 6/6 | 181.8 | 26.8 | 0 | | 109.3 | 0% |
| expert | 6/6 | 154.1 | 31.2 | 9 | 4.4 to 6.5, median 4.8 | 91.0 | 15% |
| bot 0.25 / 0.55 / 0.9 | 3/3 each | 173.6 / 156.3 / 136.7 | 27.8 / 30.8 / 35.2 | 0 / 8 / 7 | medians 4.7, 4.8 | 103.3 / 91.8 / 78.8 | 0 / 13 / 12% |
| bot 0.9 racer | 3/3 | 126.3 | 38.0 | 8 | median 4.9 | 72.4 | 15% |
| clumsy (30 seeds) | **30/30** | 397.5 | | | | | 1.5 falls a run, every one a long flight landed wrong |

The mid pilot in each mood: 153.9, 155.6, 150.5, 148.0 (Comet Night), 155.6, 161.9 s, all finished. The bench's steady
hands (`gullhaven-tune.txt`): the path 109.4 s over the gullies, the soaring line 93.6 (14%), its flights 4.6 to 4.8 s
and the Great Geo's 6.6 s, 197 m, 36 m over the ground at its highest.

**The bar** (printed by the lab, line by line):
- MET: the mid pilot soaring beats its own hands on the path by **17%** of the gullies' time (10 to 20%).
- MET: its soared flights last 4.3 to 6.5 s, **median 4.8** (about three to five); the longest is the Great Geo's, 6.5 s
  for the mid pilot and 8.1 s for the longest of any ride (the clumsy pilot's), against **the five's longest, Pinecrest's
  5.78 s**: the longest flights in the game.
- MET: the mid pilot soars **9 of 9** on every seed, the expert 9 of 9, the bot at 0.9 7, 7 and 8; every soarer comes
  down on the far face or shelf, the steepest landing 0.5. (Of 9, not 10: 7 of 10's share is 7 of 9.)
- MET: the novice rides the path round every head (soars 0, as does the bot at 0.25) and finishes 6 of 6; a sled let go
  stays on the path through every gully (at most 3.6 m seaward of its middle, never in the air).
- MET: **nobody passes the fence**: the lowest any sled came under the path's level was 0.4 m (the bar: no lower than
  30), the furthest past the clifftop's seaward edge 0.8 m (the fence).
- MET: **nothing floors a rider but a flight of 0.75 s or more landed wrong**: 45 falls in every ride, every one that.
  (My first course stood rocks on the moor, about 20 a km as the concept had them; they floored the clumsy pilot 4 times
  in 6 runs, against this line of the bar, so they are the world's now, out past where any sled goes.)
- MET: the clumsy pilot finishes **30 of 30** (the five's hardest, Pinecrest and Sakura, 27).
- MET: the mid pilot finishes in **154.1 s at 31.2 m/s** (the concept's about 160 s at about 30). In `r9-courses.ts`'s
  harness, where it spends its lanterns and carries charms, 138.9 s at 34.8 m/s (section 5).

`tests/gullhaven.test.ts` holds the ground design's list as promises (13): the descent, a gully every 600 m, nothing
standing and no crest on the path, the safe line 4 m clear of every mouth's shelf and column, the events, no Daily or Cup
to 2040; the wind only over a mouth, under gravity, pure, and only on a sled in the air (a path ride never asks for it);
every lip at 24, 30 and 36 m/s plain and popped down on its face or far shelf no steeper than 0.8 (slower sooner); a sled
let go 20 m before each gully kept on the path; the fence holding a hand that steers for the sea through every gully; the
clumsy pilot finishing 6 of 6; and the mid pilot's soaring paying 10 to 20% in flights of three to five seconds, its
longest past the five's.

### What is still short, or only a script's

- **Nobody has ridden it by hand.** Whether the wind is felt as a lift, whether a person can find the lip and hold the
  column, whether the path feels slow rather than broken, whether the drop off the cornice reads as a choice: only a
  person can say.
- **The mechanic's share by its own measure is small**: in the air inside a column, 15% of the mid pilot's run (14.6% in
  `r9-courses.ts`). The choice runs through more of it (the gullies' spans are 60% of the run; air 33%).
- **The bot rides faster than the lab's pilots** (the strong bot 126 to 137 s against the mid pilot's 154): perfect
  landings off every gully (the drop pays up to 8 m/s and a stomp 2.5) and its lanterns. The strong bot reaches 42 to 50
  m/s down the cut to the harbour.
- **A landing on the gully's face** often leaves the ground again a moment later for a short hop (the sim sets `vy` from
  the slope at the old speed, then the landing's along-slope gain speeds the sled and the next tick reads the ground
  falling away). The five's leaps' faces do the same; it is the sim's, not Gullhaven's, and it pays a free stomp.
- The novice never soars because the lab's novice rides the safe line by design; the brief's "soars few" is the bot at
  0.25 (none) and 0.55 (8 of 9).

### Files (section 1)

`src/sim/gullhaven.ts` (the kit), `src/sim/course.ts` (its kinds in `SectionKind`, `SECTION_KINDS`, `SHAPES`, `GRADE`,
`WIDTH`, `BLEND`, `BODY`; its rows in `TALL`, `LOW`, `CLIFFS`, `SCRIPTS`, `SIGNATURES`, `LAYOUTS`, `KITS`),
`src/sim/sim.ts` (hook C: `liftOn`, the lift in `airStep`, `liftLandingWithin`), `src/sim/mountains.ts` (`BiomeId`
'gullhaven', `BIOME_PARAMS`, `GULLHAVEN_SEED`), `src/bot/model.ts` (`predictFlight`'s `lift`), `src/bot/bot.ts`
(`kitLips`, `lift`, `lookForLip`, the lip in `ride` and `crouch`, the column in `airThink`, the landing's aim, the
planner's steepness), `scripts/playtest/labpilots.ts` (`timeToLand` with the air, the lip, the column, the drift's line,
the look at speed, the track's hands only on a track), `src/audio/listen.ts` and `src/render/landmarks.ts` (the kinds in
their `Record<SectionKind>` tables), `scripts/r9/gullhaven-tune.ts`, `gullhaven-lab.ts`, `gullhaven-probe.ts`,
`gullhaven-who.ts`, `gullhaven-bot.ts` (the bench, the lab and its probes), `tests/gullhaven.test.ts`. Nothing on the five
runs any of it: `liftOn`, `hasLift`, `kitLips` and `c.kit` are false there, and the fingerprint holds.

---

## 2. The set pieces and legends (the sim's side; the world draws them, `notes/r9-gullhaven-world.md` 1b)

Three verbs appended to `VERBS` after the Old Run's (never reordered): `beam`, `soar`, `stacks`. Each stands on one of the
kit's own places (`gullPlaceOf`: 'cape', 'great', 'shore'), a stage each, through a new optional `gplace` on `moments.ts`'s
internal `Def` and `LegendDef` (no shared type gains a field: the three reuse `MomentPlay`'s `gates`, `lip`, `far`,
`need`, `row` and `targets`).

| Set piece | Verb | What wins it | Variants |
| --- | --- | --- | --- |
| The Lighthouse (stage 1, the Cape's second shelf) | `beam` | in the beam at each of four marks as it sweeps the path on a clock (a gate on a clock, as the swinging lanterns are; never a hazard). Timed so a rider at 32 m/s finds it at the far end of its swing at each mark, one side then the other: a rider who only rides the path is never in it. | a slow sweep (3.5 m, 240 ticks, 2.2 m either side), a quick sweep (200 ticks), a narrow beam (2.8 m, 1.8 m either side) |
| The Great Geo (stage 2) | `soar` | a flight off its lip that comes down past its mouth on the far shelf (160 m on), or six seconds in the air, or stomped after four | across, a long flight, stomped |
| The Sea Stacks (stage 3, the cut and the sheds below the cliff) | `stacks` | through each of seven gaps between the stacks, 60 m apart, off the line one side and then the other | the weave (3 m, 1.8 either side), tight gaps (1.4), a wide weave (4 m) |

The lab's sweep (`scripts/r9/gullhaven-pieces.ts`, four seeds each; `shots/r9/gullhaven/gullhaven-pieces.txt`):

| Variant | novice | mid | expert | bot 0.25 | bot 0.55 | bot 0.9 |
| --- | --- | --- | --- | --- | --- | --- |
| lighthouse: sweep / quick / narrow | 2, 2, 2 /4 | 4/4 each | 4/4 each | 0/4 each | 1/4 each | 0/4 each |
| great geo: across / long / stomped | 0/4 each | 4/4 each | 4/4 each | 0/4 each | 0, 1, 1 /4 | 2, 1, 2 /4 |
| sea stacks: weave / tight / wide | 1, 0, 0 /4 | 4, 1, 2 /4 | 4, 4, 3 /4 | 0/4 each | 1, 0, 0 /4 | 2, 0, 0 /4 |

`tests/moments.test.ts` holds on Gullhaven (every variant won by a skilled pilot, the careful line unhurt and never handed
one: "never a gift"). The bot plays them as the five's: the beam as swinging gates (`momentOff`), the stacks a gap at a
time, joining the line at once and crossing to the next gap in one go (at 45 m/s down the cut it still lags a gap);
the sim's machine runs the beam as the gates and the stacks as the bend bells (`case` labels added beside theirs), the
soar its own (`aux`: in the air, or down clean waiting on a late stomp). The chip's words in `src/ui/momentcopy.ts` (each
under 28 characters); nothing new on the HUD.

**Legends** (`LEGENDS.gullhaven`): *The Beacon Keeper* (a runner over the Cape's last shelves: "The beacon's keeper walks the
clifftop: follow his lamp") and *The Herring Lights* (a sky over the Geos: "The fleet comes home, every boat lit on the
sea"). The world still draws them with the marquee's generic stand-ins (world notes 8).

*Where I left the concept:* its beam was on the harbour road; a lighthouse stands on a cape, and the Harbour Road's room is
the stacks', so the beam is the Cape's and the lighthouse stands at the end of its shelf.

## 3. Registered, its home riders and its pool

- **Registered:** `MOUNTAINS[6]`, appended: `{ id: 'gullhaven', name: 'Gullhaven', tagline: 'A sea cape: pop off the gully
  lips, ride the wind', seed: GULLHAVEN_SEED (0x1f83d9ab, the lab's: no Daily's or Cup's to 2040), unlockGhosts: 32 }`;
  `MountainId` gains it; its own look (`BiomeId 'gullhaven'`); out of `BIOMES`; events the avalanche, the light storm
  and the spirit train (no yeti); `LEG_NAMES` already had it; `EIGHT_FROM` null and the Long Night at ten legs.
  `MOUNTAIN_NAMES` and `HOUR_PHRASES` (almanac), the Trials' `NAMES` and `HOURS` ('at Moonrise', the world's other hour).
- **The first run laid round 157 s** (`FIRST_RUN_PACE.gullhaven`, with the last pool): where a run that does nothing
  (167.5 s) and one that only steers (158.5 s, 1% off the pace) are both fourth in the round 8 career harness's first
  run (`scripts/r9/gullhaven-floor.ts`; the third rider 162.4 and 153.3 s). The margin is thin, as the Old Run's is, and
  moves with the pool (156 had both fourth before its last generation and put the steering-only run 6.0% off after it; 160
  and 168 put both on the podium): on Gullhaven a sled let go rides the path as well as a steering hand does.
- **Home riders** (`HOME_RIDERS`, home 6; The Twelve stays twelve, never a duel): *Ina Corrie* (sky, 0.87, aviator and
  feather: "Learned to fly the geos before she could ride the path"), *Tam Skerry* (liner, 0.74, brim and wave: lights
  the beacon every storm night), *Grizel Ness* (collector, 0.6, bobble and moon: mends nets in the sheds). Their stars on
  the mastery board come from the Old Run's generic code (`[...ROSTER, ...HOME_RIDERS]`).
- **The pool** (`npx tsx scripts/generate-ghosts.ts --only gullhaven`, alone in the heavy slot, single process, about 20
  s; generated three times, the last after the fence's limit and the bot's stacks): **53 ghosts** (50 and the three home
  riders), every one finished, 47 KB. Finish times 124 to 190 s, median 142.8; the home riders 133.7, 134.2, 143.2.
  `tests/ghostpool.test.ts` replays every record to its stored result.
  - *Its spread is wide:* p90/p10 1.34 against the five's 1.28 to 1.30 and the Old Run's 1.13. Its character, and earned:
    a weak rider (skill under about 0.3) rides the path round every head, through the drift, and a strong one soars
    every gully and is paid on every landing, so the field splits into the path's riders (165 to 190 s) and the wind's
    (124 to 150). DECISIONS 397 asked a narrower pool to earn its narrowness; this one is wider than the five's, for the
    choice the mountain is about.

## 4. Its score (the score builder's report, a85f67f)

`scripts/music/pieces/gullhaven.ts`: **a reel for the harbour's band in a storm**, E dorian at 104 in 4/4 with a light
swing, in the live band's key, tempo and chords (`CLEAR.gullhaven`, `SONGS.gullhaven`: the verse i, bVII, i, IV, i,
bVII, v, i). Squeezebox and fiddle in unison on the lead (a new instrument, `reed()` in `scripts/music/inst.ts`: two
wet middle reeds at -7 and +9 cents, the bellows' sway, the pallet's knock, within 2 cents of pitch on the bench), a second
fiddle a third under at the peak, a low choir, a cittern in 8ths, the box's bass reeds as drone and bass, a bell buoy, a
bodhran and a deep drum. The tunes run in 16ths (a reel's eighths at a session pace). Its form is the five's (intro,
the reel, the hook, a turn, the Geos an octave up, a breakdown at the Great Geo's lip, the Harbour Road a whole tone up
in F# dorian, the motif on the whole band, the reprise), 60 bars, 138.5 s. The hook is "the soar": four quick notes off
the lip, a note held on the wind, the line coming down. Its stingers (`OWN_GESTURES.gullhaven`, carried by its piece
alone): `beam` (two short flashes, then the long light a fifth above), `soar` (a leap to a note held high, set down a
step at a time), `stacks` (a line weaving through three quick turns). Measured: -16.0 LUFS, true peak -2.6 dBTP, pulse
103.4 bpm, spectrum distance 2.93 from the nearest (Pinecrest); the run's loudness range 6.0.

**Sizes:** the desk pack 5.25 MB, Low and phones 2.78 MB (Opus) and 3.50 MB (AAC): each pack a player loads is far under
11.5 MB (the three files together 11.54 MB as the build counts). **The whole score was built again** (21.5 minutes in the
heavy slot); every other pack changed only by its stamp (12 bytes in its header), their analysis and manifest entries
identical but for version, sha and render time. `PIECE_OF` and the dev jukebox know it (the jukebox gained the Old Run's
rows too); `tests/audiostems.test.ts` now asks every course for a stinger of every verb it can meet, the Old Run's and
Gullhaven's own included (before, it asked only the five's verbs), and no course carries another's own. Nobody has
listened to it: whether it sounds like a reel and a storm coast, the squeezebox's tone, the hook as a soar, the stingers,
the octave-up fiddle in the Geos and the bell buoy's E4 are a person's to judge.

## 5. Against the five (`npx tsx scripts/playtest/r9-courses.ts`, heavy slot, 49 s)

Written to `shots/r9/gullhaven/r9-courses.txt` and `.json` (not the measure lane's file); the five's table is milestone
0's. `r9-courselib.ts` `MECHANICS.gullhaven`: in the air inside a gully's column.

| Measure (mid pilot, 6 seeds, lanterns and charms as the harness rides them) | Gullhaven | The five's range | The Old Run |
| --- | --- | --- | --- |
| finish time | **138.9 s** | 121.3 to 129.4 | 83.7 |
| mean speed | **34.8 m/s** | 35.1 to 37.4 | 38.2 |
| air share | 33.5% | 24 to 35% | 0% |
| turns a km of the safe line | **3.96** | 1.78 to 2.67 | 2.67 |
| mean width | 29.9 m | 24.6 to 31.1 | 15.6 |
| hazards a km | **0** | 43 to 126 | 0 |

- **New:** outside the five on 4 of 6 (time, speed, turns, hazards), **by 15% on 2** (turns, hazards): met. Against the
  Old Run within 10% on only 2 of 6 (speed, hazards): apart; outside it on 4 (time, air, turns, width).
- **Fair:** the clumsy pilot finishes **30 of 30** against the five's hardest's 27. Met.
- **The mechanic:** in the air inside a column for **14.6%** of the mid pilot's run.
- Also: the expert 141.7 s (16 of 18 set pieces), the mid pilot 15 of 18, the novice 176.5 s (3 of 18), the clumsy pilot
  378.5 s with 1.8 falls a run (every one a landing); its longest flight 6.49 s against the five's 3.74 to 5.78; set
  pieces span 18.7% of the run and the legends 11.2%; 6 kinds; slope 0.241 with a standard deviation of 0.071 (shelves
  stepped by the heads, not the five's pitches and flats).

## 6. The world (built beside the lane; `notes/r9-gullhaven-world.md` is its full account)

In short: a clifftop path a thousand metres over the sea, a snow fence at the run's limit with pennants and windsocks on
the wind, the moor rising on the left with dry-stone walls and cairns; the sea at its own level, drawn as water (swell,
glints, the sun's path), never a sea of cloud; a slate storm deck lit only along its rim with the low sun under it; each
gully a corniced lip flush with the shelf over a cleft cut to the sea; the wind shown by spindrift up each column, gulls
hanging in it and the beacon's smoke leaning inland; sea stacks, the old beacon, the lighthouse at its set piece, the fish
sheds and the harbour's ice with the line between two pier-head lights. **The camera** (`camera.ts`): in the air over a
gully the lens steps out over the cleft and leans to the sea, inside the five's opening allowance, halved on phones, off
under reduced motion, home before the landing. **Its other hour**, at Moonrise (drawn, not wired); its mirror draws.
**The greyscale sort:** Gullhaven sorted alone ("no mountain at all, only a flat horizon"; "along the top of a high bank
with water or ice on one side"); it could not always tell water from black ice. **The critic loop:** three rounds (blind
pairs: 5 of 12, then 2 of 12 chose the newer frames; the last round's faults, outcrops as pale stubs, the beam by day a
milky slab, troughs as cracks, fixed and seen only in frames since). **Low:** a designed cheaper version (one pennant
colour, posts twice as far apart, one stack form, places within 520 m), but on a held Low run 438.5 / 433.8 GL calls and
46.7 / 45.2 draws against Pinecrest's 353.0 / 414.7 and 37.5 / 42.1 and Ember's 402.0 / 391.2 and 40.5 / 40.7 (taken
before the set pieces' props, up to four draws more near each). Short: the far coast's pale streaks, soft shadow blobs,
no ruts of its own, the legends' stand-ins, Low over Pinecrest and Ember on draws, a pale diagonal shaft once in the
title's first frame.

## 7. Wired for the mountain, and what waits

- **Its card on the picker:** `MOUNTAINS[6]`'s tagline is its few words of mechanic ("A sea cape: pop off the gully lips,
  ride the wind"); its card art (`art.ts RIDGES.gullhaven`: the storm deck, the low sun's path on the swell, the cape's
  cliff and its lighthouse) and sky (`.b-gullhaven` in `style.css`). **The ui lane's merge (DECISIONS 399) moved every
  card sky into `art.ts SKY` and removed the `.b-<biome>` rules**: at this branch's merge the main lane moves
  `.b-gullhaven`'s gradient (`#2c3350 0%, #4a5a78 55%, #e8a878 100%`, the picker's and the toast's alike) into `SKY`.
- **Its key art** (`keyart.ts TITLE_SHOTS.gullhaven`): the title rides the Great Geo's column over its cleft, the lens
  high and seaward.
- **Its mastery board:** its medals, its three set pieces' stars, its three home riders' stars (the Old Run's generic code).
  No sky gate row (it has none).
- **Its missions' biome** is its own look, `'gullhaven'`; no mission names it.
- **Its other hour (at Moonrise) and its mirror** draw; per DECISIONS 397 they open in phase C's wiring (its hour on an
  Almanac page of its own, its mirror when its home riders are beaten to the line). Not wired here.
- **Photo mode and Save Clip**: the world builder opened photo mode from pause on Gullhaven (the HUD went, its bar showed,
  a drag turned the lens, Escape left, no errors) and started a Save Clip recording and cancelled it before anything was
  saved.
- **What I would add to the Almanac, the album and The Twelve** (they stay as they are): an Almanac page "Gullhaven"
  (soar all nine gullies on one run; the Great Geo's three variants), its hour and mirror as the rewards; an album frame
  of the Great Geo at sunset from the column and one of the lighthouse's beam on the Cape; a set of three (a scarf, a
  trail, an ornament at a third, two thirds and all of its board: a gull or a lamp ornament); no change to The Twelve.
- **The Trials and the Long Night** unchanged: `EIGHT_FROM` null, ten legs (Gablefall's lane, the last, switches both).

## 8. Only scripts have seen it

Every figure in sections 1 to 5 is the sim's, ridden by the lab's pilots, the clumsy pilot and the bot. Nobody has ridden
Gullhaven by hand: not the wind, not a lip, not the path's drift, not the set pieces, not the bot's field around a person.
The score has been rendered, measured and level-checked by the build and the stems test, and listened to by nobody. The
world builder saw its frames (staged, a sled held on a line), photo mode and Save Clip; the set pieces' live states
(flare, miss, win and loss lamps), the pieces on Low, a phone and the camera beat in motion only scripts have touched.

**The suites:** the full suite in the heavy slot with everything in (`shots/r9/gullhaven/full-suite.txt`): **114 files, 2,064
of 2,065 passed**; the one failure, the race floor's laid pace after the pool's last generation, fixed by laying it round
157 s (section 3), after which every suite that reads it (field, finishz, migration, pacing, r8bars and their companions:
9 files, 188 tests) and the five's fingerprint passed. `tsc` clean. `tests/five.test.ts` green at every commit. The world
builder's own full run at a682e30: 114 files, 2,065 passed.

## 9. For the main lane

### To decide

1. **Nine gullies, not ten** (section 1): ten would not fit clear of each other and the thresholds in 4,800 m at about
   315 m a gully; the brief's "7 of 10" is read as its share, 7 of 9.
2. **No colliders on Gullhaven** (section 1): the concept's rocks and huts (about 20 a km) floored the clumsy pilot,
   against the brief's "nothing floors a rider but a flight landed wrong"; they are the world's scenery now, and hazards a
   km reads 0, as the Old Run's does.
3. **The pool is wide** (p90/p10 1.34; section 3): the path's riders and the wind's. Its character, I think, but a person
   should see a field of it.
4. **Its first run laid round 157 s** with a thin margin (section 3): a sled let go rides the path as well as a steering
   hand.
5. **The mid pilot with lanterns and charms is quicker than the concept** (138.9 s at 34.8 against about 160 s at 30; the
   plain lab mid pilot 154.1 s at 31.2), as the Old Run's was.
6. **The mechanic's share** (14.6% in the air in a column) is the design's measure; the choice runs through the gullies'
   60% of the run.
7. **Low draws more than Pinecrest and Ember** (section 6); frames a second are the main lane's to time.
8. **The score's whole rebuild** changed every pack's bytes by its stamp; Gablefall's will again, so whichever branch
   merges second runs the whole build after the merge (section 4).
9. **The Lighthouse is on the Cape**, not the harbour road (section 2).

### Shared files (every hunk)

- `src/game/app.ts`, `save.ts`, `src/render/spineview.ts`, `src/ui/ui.ts`: untouched.
- `src/ui/contract.ts`: `MountainCard['biome']` gains `'gullhaven'`.
- `src/ui/art.ts`: `RIDGES.gullhaven` (the world builder's card art over my first sketch). `src/ui/style.css`:
  `.b-gullhaven .gs-mtn-sky` and `.gs-toast-sky.b-gullhaven` (to move into `art.ts SKY` at the merge, as above).
- `src/ui/momentcopy.ts`: the `beam`, `soar` and `stacks` cases.
- `src/game/almanac.ts` (`MOUNTAIN_NAMES`, `HOUR_PHRASES`), `trial.ts` (`NAMES`, `HOURS`), `field.ts`
  (`FIRST_RUN_PACE.gullhaven`): a row each.
- `src/sim/moments.ts`: the three verbs appended to the union and `VERBS`, their variants, `BEAM_STEP`, `BEAM_V`,
  `SOAR_LONG`, `STACK_STEP`, `gplace` on `Def` and `LegendDef`, `AUTHORED.gullhaven`, `LEGENDS.gullhaven`, their builders,
  and the place lookups in `planMoments` and `planLegends` (the Old Run's path kept for `place`).
- `src/sim/sim.ts`: hook C, and the three verbs' cases in `momentStep` and `momentCount`.
- `src/bot/bot.ts`, `roster.ts` (`HOME_RIDERS` gains three), `model.ts`; `scripts/playtest/labpilots.ts`,
  `moments-plan.ts`, `r9-courselib.ts` (`MECHANICS.gullhaven`).
- The look tables (`src/audio/score.ts`, `theory.ts`; the render tables, now the world builder's: its section 2 lists every
  render hunk). Tests: `tests/moments.test.ts` (Gullhaven's verbs), `tests/nearmiss.test.ts` (nothing to miss on it, as
  on the Old Run), `tests/twelve.test.ts` (the finale's ladder test now past Gullhaven's 32), `tests/audiostems.test.ts`
  (the score builder's), and the render suites the world builder answered (its section 2).

### Text for ART.md 15

`notes/r9-gullhaven-world.md` section 9 ("Gullhaven: the storm's light on the sea cliff").

### Text for DECISIONS

398. **Gullhaven built: the wind made to pay in the lab, then a mountain of its own** (`r9-gullhaven`, 9cb038a to its last
    commit; `notes/r9-gullhaven.md`, `notes/r9-gullhaven-world.md`).
    - *Why soaring did not pay at first:* a flier keeps its lip speed and gets back of the gully's drop only what its
      landing pays, while the path rider turns the drop into speed; lifted high it came down well paid but after 7.5 s
      and 44 m up; held to the rim, the lift could not catch a sled falling back into it; off a steep face a pop flew four
      seconds with no lift at all (a leap turned sideways).
    - *What makes it pay:* a face that falls with the path at only the shelf's grade plus 0.1, a column 70 m long (120
      over the Great Geo) at 0.5 g (0.65) whatever the height, the head's drift (drag 1.5) and the path's swing round it,
      a 0.2 shelf of wind-packed snow; the lab's pilots and the bot spring a lip, hold the column and aim the landing at
      their own line. The bot's `lip` goal is general, for Gablefall. The five's fingerprint held at every commit.
    - *The bar, every line met:* the mid pilot's soaring 17% faster over the gullies than its own hands on the path, its
      flights 4.3 to 6.5 s (median 4.8; the Great Geo's the longest in the game, past the five's 5.78), 9 of 9 soared
      (the expert 9, the strong bot 7 or 8), every one down on the face or far shelf; the novice and a sled let go on the
      path; nobody past the fence; no fall but a long flight landed wrong; the clumsy pilot 30 of 30; the mid pilot 154 s
      at 31 m/s. New against the five on 4 of 6 measures, 2 by 15%, apart from the Old Run; in a column 15% of the run.
    - *A mountain:* `MOUNTAINS[6]`, appended, id `gullhaven`, seed 0x1f83d9ab (the lab's), opening at 32 ghosts; its own
      look; out of `BIOMES`; the avalanche, light storm and spirit train (no yeti); nine gullies and no collider; three set
      pieces on appended verbs (`beam` the Lighthouse, `soar` the Great Geo, `stacks` the Sea Stacks), two legends (the
      Beacon Keeper, the Herring Lights), three home riders (Ina Corrie, Tam Skerry, Grizel Ness; never a duel); its first
      run laid round 157 s; a pool of 53, 124 to 190 s, wider than the five's (the path's riders and the wind's); a reel
      in E dorian at 104 for squeezebox and fiddle, 5.3 MB on the desk and 2.8 to 3.5 on Low and phones.
    - *Its world:* storm light on a sea cliff, the sea at its own level as water, a fence at the run's limit, corniced lips
      over clefts cut to the sea, the wind shown, the beacon, the lighthouse, the stacks and the harbour's ice; at Moonrise
      its other hour. Sorted alone by a blind critic; three critic rounds. Low draws more than Pinecrest and Ember.
    - Nobody has ridden it by hand, and nobody has listened to its score.
