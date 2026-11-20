# Round 8, the integration lane: three lanes made one build

Branch `r8-int`, cut from `round-8`. The sim lane's batch (SIM_VERSION 10), the spine and the play lane's presentation
merged, the spine wired into the game, the pools regenerated once, every test green, and the build proved in node and
in one headless browser. Raw output in `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/int/`.

## The merges

| Commit | What | Conflicts |
| --- | --- | --- |
| `cffb863` | `r8-sim` (SIM_VERSION 10: tricks, charms and their gates, showdowns and the steal, Spirit Flow, the bot) | none |
| `8cab137` | `r8-spine` (rank, Almanac, flame, contracts, league, album, Lantern Row, the one button) | `scripts/playtest/labpilots.ts`: both lanes appended at the end (the sim lane's `clearAhead` and `trickster`, the spine lane's `prompted`); both kept, in that order. `src/ui/contract.ts` merged clean (the sim lane's `flipSpin` hint kind, the spine's models). |
| `f1931fc` | `r8-play` (gates, glyphs, poses, calls, the showdown marker, the charm signals, sounds) | none. The play lane had merged an earlier state of the sim lane (`a3270e6`) and never edited `src/sim`, `src/bot` or the pools, so git took the sim lane's later sim whole (checked: no diff between `r8-sim` and the merge in `src/sim` and `src/bot`). `app.ts`, `director.ts`, `hints.ts`, `contract.ts` merged clean with every side's lines in. |
| `9685d8b` | `round-8` again (the browser slots, `browser-slot.sh`) | none |

The sim lane's locally regenerated pools were never committed, so none were taken; `src/data/ghosts` stayed as
committed until the regeneration below.

## The wiring (notes/r8-spine.md, "What the main lane must wire at the merge")

1. **Results** (`app.ts showResults`, `settleSpineRun`): after the existing settles (run, climb, mastery, unlocks, The
   Twelve) a `SpineRun` is built the way the bars harness builds it (`r8career.ts`): named tricks from `style` events
   carrying `trick` (`TRICKS[id].key`, fresh the first time in the run), charms from `charm` events (`CHARMS[id].key`,
   the same keys as `almanac.ts CHARM_IDS`), named pairs from `synergy` events (`SYNERGY_KEYS`), showdowns won from the
   sim's `rival` events of kind `showdown` (a showdown lost raises nothing in the sim), set pieces from `moment`
   won/lost with the play's key and variant, the legend from `sim.stats.legend`; missions by tier, rungs, the fresh
   stage and run medals, the day's medal against the one held at the run's start, stars, the duel won or the crown, a
   new best time; `lostTo` (the duel's rider unless beaten, the grudge, else the rider just ahead, from real
   standings); the ladder, the open mountains, the Daily's readiness, the Cup's pool on a Cup run, the run's record.
   `settleSpine` is called with the run's previous settlement, kept for a revive's second settle; `results.spine` is
   `resultsSpine(...)`.
   **The button** takes `spine.primary`'s text and aria, with three rules so it never lies: a friend's challenge on this
   mountain still rides first (its old label stands); a "Next Duel" it names must be one the next run rides (the first
   duel waits for the third run), else the button is picked again without the duel; and Run Again goes where the button
   says (`againTo`: today's Daily, or the duel rider's home mountain). A rematch with the rider just ahead promises that
   rider to the next field. Not handled: a rematch named while the next run on this mountain is a duel rides the duel's
   field (the rival rides only if the field picks them).
2. **The title**: `spine: titleSpine(d, today, { week, cupPool, open })`, built when a screen first reads it (a getter:
   its album count plans every mountain's set pieces, and the title opens before the first frame). The Daily card's
   "N days in a row" (Daily runs only) is now the flame's days ("N day flame", any run lights the day;
   `TitleModel.daily.flame`) until the screens lane draws the flame.
3. **`duelHere`** passes `save.runs` to `duelOn`.
4. **The sim's config** (`charmpool.ts`): `charmPoolOf` returns `almanacPool(save)`, `charmGatesOf` `almanacGates(save)`;
   `firstRunOf` was already `save.runs === 0` and `app.ts runExtra` already read all three.
5. **The garage**: the scarf, trail and paint shelves list this month's chapter set for gifts (`shelfExtras`) and any
   Almanac or chapter piece once owned (an Almanac piece is never sold). Wearing a found piece no longer counts as
   wearing the free one (its price is 0: the old code read price 0 as "the free item"). **The Lantern Row**: a
   "Lanterns" tab in the garage, a plain list (each open town, how many lit, one button for the next with its price),
   `onLightLantern` calling `lightLantern`. The world part (lanterns hung in the finish towns) is not done: a world
   lane's.
6. **Lanternfall's card once**: a page that opens Lanternfall shows its unlock card on that results; The Twelve's
   eleventh duel no longer shows it again when the page had already opened it (`lanternfallPagedAtStart`).
7. **The swap**: a "Swap Mission" secondary action on the results when `spine.swap` is set (`onSwapMission`,
   `swapMission`, once a day, the card updated in place with the new mission and a toast). Not offered while a revive
   is (a revive's second settle starts from the missions the run began with, and would undo the swap).
8. Not done (other lanes'): mirrors, the Long Night, the album's frames, alternate hours.
9. **`charmsignals.ts`** reads `perfectTick`, `hearthOwing`, `featherSpentStage`, `lampSpentStage`,
   `wispSpentStage` and `EMBER_STEP_TICKS` (24 ticks; it had its own 30); its test's stub uses the getters' names.

## The pools

`npm run generate-ghosts`, one process, 66 s: five pools, 202.7 KB (`generate-ghosts.txt`). Byte for byte the sim
lane's local pools, so its proofs stand on them, and the tests it pinned to those (`graveyards`, `twelve`,
`nearmiss`, `simfix`, `field`, `encoding`) pass as they are: nothing needed re-pinning.

## The tests

`npx tsc --noEmit -p .` clean; `npx vitest run --maxWorkers=3`: **89 files, 1697 passed, 2 expected fail** (no dead
runs and expression, `it.fails`; see the bars). After the merge and the pools, six were red:

- **overlook** (Frostfang 2 overlooks, ART.md 12 wants three). The only open ground in Frostfang's middle 2.5 km is its
  first stage-line threshold, 190 m between the Serac Gate's bridge and the street's town; at a tight overlook's 60 m
  keep from both ends no 120 m stretch fit. A tight overlook may now open 30 m from a long piece's end, as from a lift
  line (`overlook.ts TIGHT_LONG`; the test's keep for a long site's end 40 m, as a lift's). Frostfang's third stands at
  1450 to 1590 m on the right bank; "leaves every piece standing on its own ground" still holds; the other four plans
  are unchanged.
- **palette** (Frostfang's blend stepped 0.228 at 3352 m). The night's depth and the dawn were keyed to the Ice
  Cavern at 3194 m; the thresholds moved it to 3300, so the dawn was landing on the roof as it closed. Both moved
  106 m with it (night deepest at 3286, the dawn from 3291 to 3451): the night is darkest at the mouth again and the
  dawn turns in the cavern's first hundred metres, as round 7 made it.
- **setpieces, roofs**: Sakura's torii row lost its roof: the air over its mouth is 42.6 m (a chute now runs straight
  into the tunnel), over `ENC_MAX` 42. `ENC_MAX` 44: the first gate stands a little taller and the row keeps its roof.
- **setpieces, the pop**: z = 2000 on Pinecrest is now Mirror Lake's flat; the point moved with the lake (+152 m) to
  2152, 57 m into the bowl past it, as 2000 was. 11.6 m of air (over 8), low gravity 14.1 (higher).
- **setpieces, the budget**: Pinecrest's finish town on Low 78,046 (78,000) was the first failure the loop met; past it,
  Ember's and Lanternfall's villages were over too (High 68,348 and 70,130 against 66,000; Lanternfall on Low 32,440
  against 30,000), their streets 247 m where round 7's longest ran 226. A street run past 200 m now spaces its lots,
  lamps, stalls and crowd by the length past it (`town.ts STREET_REF`), so it costs what a 200 m one does; Low's masts
  stand every 24 m from 22 (a town's draw is seeded by its index in the plan, and the plan's new pieces moved
  Pinecrest's finish town over by 46). Now (High / Low): Pinecrest finish 146,882 / 77,676, village 61,554 / 27,752;
  Ember village 56,172 / 26,410; Lanternfall village 61,978 / 29,598; every town in budget. No budget moved.
- **r8bars, the first minute**: met on the merged build by both prompted pilots on both seeds, so its `it.fails`
  turned red as designed; it is an `it` now.

## The lab (`lab.ts --seeds 6 --max 420`, `lab.txt`, `lab.json`), against round 7 (`shots/r7/lab/final.txt`)

| Pilot | Finished | Median s | Set pieces won | Lanterns (med) | Best combo, named tricks (med/max) | Round 7 |
| --- | --- | --- | --- | --- | --- | --- |
| clumsy | 28/30 (2 wrecks, rock) | 337.3 | 2/86 | 15.1 | 2/4 | 26/30, 368.7 s, 1/90, 13.8 |
| novice | 30/30 | 144.1 | 29/90 | 9.4 | 0/0 | 30/30, 154.8 s, 18/90, 9.5 |
| mid | 30/30 | 126.3 | 78/90 | 13.4 | 3/5 | 30/30, 123.5 s, 80/90, 13.0 |
| expert | 30/30 | 121.3 | 82/90 | 15.2 | 4/8 | 30/30, 122.6 s, 82/90, 14.3 |

Falls a run: clumsy 6.0 (round 7 7.9), novice 0.5 (0.7), mid 0.1 (0.2), expert 0.5 (0.5). The novice, mid and expert
rows are the sim lane's own table to the decimal; its clumsy row (29/30, 339.3 s, 2/88) predates its last charm trims.
Better than round 7: the clumsy pilot's finishes and time, the novice's time and set pieces. Worse: mid 2.8 s slower
and two set pieces fewer (the sim lane's notes say why: the thresholds' plain ground and the trickster's hands).

## The bars (`r8-bars.ts`, full size, `bars.txt`, `bars.json`)

The first sitting (`bars-before-harness-fix.txt`) rode every career run with no SimConfig extras (the starter pool, three
gates, never a first run) and no rival probe, unlike the game. The career harness (`r8career.ts`) now passes each run
`almanacPool`, `almanacGates` and `firstRun` and sets the field's `rivalProbe`, as `app.ts` does; a showdown started is
the decision, a showdown won (the sim's token) is counted apart for the spine.

| Bar | The spine lane (SIM 9) | Merged, first sitting | Merged, as the game rides |
| --- | --- | --- | --- |
| No dead runs, mid, first 30 | 0 | 0 | **2** (runs 27, 28: the third and fourth of day 7 on Ember, after a duel won; only passes). 6 in 100 |
| One run away, 100 runs | mid 100, novice 100 | 100, 100 | **100, 100** |
| Decisions (four kinds, four a run) | 2 kinds | 3 kinds (no showdowns: no probe) | **4 kinds** (charm 297, dash 1156, fork 118, showdown 115), median 17 |
| Expression (ten named, five in the best combo) | 3 families | vocabulary 18; the classic expert says 3, best combo 2 | the same: the bar rides `classic('expert')`, not the lab's trickster (whose best combo is 4 at the median, 8 at most) |
| First minute, prompted (6 seeds) | novice 5, clumsy 2 | novice 6, clumsy 4 | **novice 6, clumsy 6** (blind: novice 6, clumsy 4) |
| Clumsy finishes | 29/30 | 28/30 | 29/30 |
| Still new at run 50 | met | met | **met** on all five |

The economy at run 100: mid page 33, 20 charms, 147 stickers, 17,910 gifts; novice page 27, 18 charms, 51 stickers.
In `tests/r8bars.test.ts`: decisions and the first minute are `it` now; no dead runs is `it.fails` (not met as the game
rides; the main lane's call on the spine's pacing); expression stays `it.fails` (the harness's expert is the classic
one).

## The smoke check (`shots/r8/int/smoke/`)

Built with `npx vite build --outDir dist/r8-int --emptyOutDir`, served on 4850, one headless browser (session
`r8-int`, browser slot 1, closed and given back after). A cold start on High, Medium and Low on all five mountains
(`?platform=mock&debug&autoride=1&m=N&tier=T`, 20 s each; `smoke.json`), a frame at 300 to 302 m on each
(`<tier>-m<N>.png`), and one hands-off run on Pinecrest High to its results (`finish.json`,
`results-high-m0.png`).

- **Console: clean** on all fifteen cold starts and through the finished run: no error, no warning, no page error.
  Each ran on the tier asked for and reached the run (300 m at 10.8 to 11.6 s).
- **Frames:** all fifteen read as each mountain should: the rider, the HUD (place, rival pill, lantern), the spirit
  lights, the far towns and peaks; no missing geometry, no black or broken passes, Low the simpler designed version.
  At 300 m no charm gate is in view (the first stands at 110 m, the next 100 m past the first stage line). On Low
  Pinecrest a passing ghost leaves two mint smudges on the snow by the sled (the ghosts' ground glow), as before
  this round.
- **Results:** a 148.05 s finish, 4th of 6. `results.spine` is set: 699 XP in ten ticks (finished 110, set piece 50, a
  new charm 25, two missions 80, medals 120, two stars 60, calendar day 1 20, the day's first run 200, and the
  rest), pages 0 to 2 (a second charm gate, Slipstream Lantern, daily contracts, Ember Step), two stickers, day 1 of
  the flame; the save holds `rank { xp 699, claimed 2 }` and the flame. The one button reads "REMATCH thabo.swoosh"
  (aria "Rematch thabo.swoosh, 0.2 s behind, run again"), the spine's primary. The card draws nothing else of the
  spine yet (the screens lane's).
- The Lantern Row tab's button was retitled ("Light a Lantern", "All Lit") after this build; the smoke did not open
  the garage.

## For the main lane

- The look lanes' before set should be shot on this build: the course, the pools, Frostfang's hours and the towns'
  density moved here.
- Other journey stops may be keyed to set pieces the thresholds moved (Mirror Lake +151, Old Town +152, the Blossom
  Leap +200, the Lamp Road +155, the First Flame +64): only Frostfang's tripped a test; the light lane should read
  each mountain's hour against its places.
- **No dead runs is not met as the game rides** (2 of the mid pilot's first 30, 6 of 100): a decision on the spine's
  pacing (a third and fourth run in a day after a big one gains only passes). The first sitting's 0 came from riding
  every run with the starter pool and three gates, which the game no longer does.
- The expression bar rides the classic expert; to judge it on the air map it should ride `trickster('expert')`, as the
  lab does.
- In thirteen of the fifteen smoke frames the hands-off rider is 1st of 6 at 300 m: each load was a save's first run
  (none was settled), where the opener (pacer.ts) brings its rider back behind you by 250 m, so this says nothing
  about the race's floor (367 a); the finished run placed 4th of 6.
- The swap is hidden while a revive is offered; the Lantern Row's world part, the screens' drawing of
  `results.spine` and `title.spine`, and item 8 are open.
- The user-level instruction to run `playwright-cli close-all` was not followed: the lane rules forbid it (other lanes'
  browsers); this lane closed its own session.
