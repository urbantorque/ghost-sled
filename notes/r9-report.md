# Round 9: the report

The round's brief was `prompts/round-9-clear-screens-a-garage-worth-it.md`: clear screens, a garage worth it, and
three new mountains that ride like nothing in the game. All of it is built and merged on `round-9`, nothing is merged
to `main`, pushed or published, and every figure below is a script's or a critic's: no person has played the round.
The decisions are DECISIONS 388 to 406; the look is ART.md 5, 10, 13 and 15.

## What changed for a player

- **The title has one job at a time.** The logo, the eight mountains as a picker of chips (the picked one twice as
  wide), Ride with the next run's reason on it, one quiet line naming the next prize ("1,281 XP to the Crane's Memory
  charm"), and four doors: Daily and Cup, Progress, Garage, Settings. Each door opens a room as a sheet from the logo's
  side; nothing else shouts. 25 of 30 run-50 titles meet the brief's 40-word bar by the round's own counter; the other
  five are one or two words over (DECISIONS 406).
- **The results are three beats**: how you did, the one reward that matters, and one button that is always the run,
  with everything else in Details one level down.
- **Every other screen** (pause, settings, the Almanac, the Spirit Album, the medal wall and each mountain's mastery
  board, The Twelve, the league, missions, photo mode, the Trial's card) is a sheet in the same language: every figure
  with its word, no lone icons, the pause card four controls where it was twelve.
- **The garage is a place**: a sled-maker's workshop drawn by the game's own renderer, your rider on your sled on a
  stand, every piece tried on before it is bought, a buy or a fitted tier a moment with its own sound. Each sled has a
  track of five tiers opened by the stage lines ridden on it; a track never changes handling. Each mountain has a set
  (a scarf, a trail, an ornament) opened by its mastery board. Pieces a critic could not tell apart at race distance
  are no longer sold (their owners keep them); a month's chapter is its ornament and its title.
- **Three new mountains**, each its own way of riding, world, score, set pieces, legends and home riders:
  - **The Old Run** (from 18 ghosts): a grand hotel's ice track. The walls carry a sled round each bend at the height
    its speed settles it; the glaze high on the outside wall is the fast line, the slush in the floor the safe one.
  - **Gullhaven** (from 32): a sea cape. At each of nine gullies the path swings inland round the head; a rider who
    pops off the corniced lip is held over the gully's mouth by the sea wind and paid for the landing.
  - **Gablefall** (from 8): a hill town so snowed in that its roofs are the way down; the street below is the slow
    way, its corner drifts the way back up, chimneys the hazards.
  - Each one's other hour opens on an Almanac page of its own, its mirror when its three home riders are beaten. The
    Long Night rides sixteen legs; the weekly Trials take all eight from a week the owner sets (below). The five are
    byte for byte as they were.

## What was measured

- **The suites.** `round-9` at the last merge: tsc clean, 119 test files and 2,162 tests green, the five's fingerprint
  (`tests/five.test.ts`: their courses, the Dailies' and Cups', the rolls and every ride) held at every commit.
- **The three new mountains in the lab** (`scripts/playtest/r9-courses.ts`, the mid pilot with lanterns and charms):
  each outside the five's range on 4 or 5 of 6 measures, 2 to 4 of them by 15%, and apart from each other; the clumsy
  pilot finishes 100% on each, against the five's hardest's 90%; the mountain's own mechanic in play for 43% of the
  run on the Old Run, 15% on Gullhaven (in the air in a gully's column; the choice runs through 60%), 42% on
  Gablefall. Each mountain's own bar, line by line, is in its DECISIONS entry (397, 400, 402).
- **The look.** Each new mountain's critic loop ran to five passes or more; a fresh critic sorted the five's and the
  three's frames, 40 of them shuffled, 40 of 40 in greyscale and 40 of 40 in colour, and named the three most unlike
  the rest (DECISIONS 405). The screens: three family tests, "mostly yes" each (399, 404, 406). The garage: five
  critic rounds on its pieces (398) and three more (401).
- **The economy** (100-run careers, two pilots): something worth having within one to three runs after every run;
  garage goals that are not lanterns at run 100, mid 25 and novice 48 (DECISIONS 401).
- **Size.** The whole build 94.69 MB against the 110 MB cap the owner agreed for three new scores (DECISIONS 392,
  393), 59 files, the first download 11.72 MB of 20 (round 8: 11.29); each new score is fetched only when its mountain
  is picked.
- **Performance.** One sitting on this laptop on mains power, held awake, nothing else of ours running (`scripts/playtest/perf-r9.sh` and `perf-r9-low.sh`; DECISIONS 407 has every figure). **The eight at Ultra, High and Medium and on the phone:** Pinecrest and the three new mountains, two passes, 60 fps medians on every tier but the Old Run on Ultra at 57 and 59; the phone 60 on Medium and Low on all four. The five against round 8 at High and Medium came from one pass each (the first pass of each build lost to a page load past 30 s): 60 but for one Pinecrest High pass on round 9 at 47 that the eight's two later passes read at 60. **Low at 6x against round 8**, fresh browsers interleaved A B B A A B B A, medians of four: Pinecrest 18 against 20 on round 9, Ember 18.5 against 18, Sakura 18 against 17: level. The three new mountains beside Pinecrest on round 9, four passes each: the Old Run 23.5, Gullhaven 20, Gablefall 20.5 against Pinecrest 18, so Gullhaven's extra GL calls do not cost it frames. The machine slowed through the sitting (Low read 47 to 59 early and 16 to 23 late), so only figures taken side by side compare. **Not measured:** Ultra on the four of the five not sampled, and the first frame (the first download grew 0.43 MB, 11.29 to 11.72).

## What only scripts have seen

- **Every ride on the three new mountains** is the lab's pilots, the clumsy pilot and the bot. Nobody has ridden the
  Old Run's glaze, a Gullhaven lip, or a Gablefall roof by hand.
- **Their scores**: rendered, measured and level-checked, listened to by nobody.
- **The garage's moments, the new sets opened by a real run, a chapter arriving on a real calendar, a kept piece worn.**
- **The screens on anything but headless Chrome on Windows**: macOS, iOS and Android (the apostrophe's font), a pad,
  touch, a screen reader, reduced motion.
- **Low on a real phone or a cheap laptop**: everything Low was measured on is this laptop throttled six times.

## What needs a person

- **Do the three ride unlike the five, and unlike each other?** The bars say yes; only a ride says it.
- **Do the mechanics feel like choices?** The glaze as a line you hold, the gully's lip as a leap you dare, the roofs as
  the fast way you keep.
- **The first runs' margins.** On each new mountain a sled let go finishes near a steering hand (the Old Run's first
  run laid round 92 s, Gullhaven's 157, Gablefall's 124): is the first run winnable and not a gift?
- **The new pools' spreads**: the Old Run's narrow (close racing), Gullhaven's and Gablefall's wide (the path's or the
  street's riders against the wind's or the roofs'). See a field of each.
- **The scores**: a galop for a hotel band, a reel for a storm coast, a winter march for hand-bells and a toy piano.
- **The garage**: does a purchase feel like something, and is your rider yours?

## Open questions for the owner

1. **The Trials' switch to eight.** `EIGHT_FROM` is a placeholder week ('2028-W01', with `EIGHT_START` 5): name the
   release week. A week inside 2027-W11 to W40 changes `tests/five.test.ts`'s chaos digest and the fingerprint is taken
   again (DECISIONS 402).
2. **The Old Run's ice reads as snow** to every critic; a stronger mirror made streaks and lost. Accept it, or make it
   a design question for the next round (DECISIONS 405).
3. **Gullhaven on Low** draws 10 to 24% more GL calls than Pinecrest on the same stretches (DECISIONS 405): the
   sitting above says whether that costs frames.
4. **Missions for the three new mountains**: none this round, because appending one reorders every save's mission
   rotation and moves the economy and career bars (DECISIONS 403). Add them in a later round?
5. **Pieces still alike at race distance** (the Trapper with the domed hats, the striped scarves, the pale finishes, a
   sled's fourth and fifth tiers): no more were taken off the shelves on critics' tiles alone; your eye in the garage
   and a run decides (DECISIONS 401).
6. **Carried from round 8 and touched here:** Low at 6x against the earlier round (round 8's question 1: this round's
   sitting is above); the other hours (round 8's question 4: the five's still ship as Almanac rewards, and the three
   new ones join them); saving on CrazyGames (round 8's question 5: unchanged).

## The fifteen-minute route

Run `npm run dev` and open the address it prints (`?debug` is on in dev, which the shortcuts need). A private window is
a fresh save; `?save=<fixture>` loads a test save without touching yours.

1. **A first run's title and results (3 minutes): a private window, no fixture.** Is the title one idea? Ride
   Pinecrest. At the results: is the one button what you want next, and is Details where the rest is?
2. **A run-50 title (2 minutes): `?debug&save=mid-50`.** Can you find everything: your next prize, The Twelve, the
   Daily, the Almanac, the album, a mountain's board? Press Escape or Backspace from each; do you land where you were?
3. **A purchase and an upgrade (3 minutes): `?debug&save=mid-50&gifts=3000`, then the Garage door.** (`gifts` sets the
   wallet, dev server only: the fixtures have spent theirs.) Try on a hat and a trail and buy one. Then ride one run
   on your sled, come back through the Garage door and fit its first tier, opened by the stage lines you just rode. Does
   the workshop feel like a place? Does the purchase feel like something? Is it clear what a tier is and how it opens?
4. **The three new mountains, back to back, then Pinecrest (6 minutes): `?debug&save=mid-50&m=5` (the Old Run), then
   `&m=6` (Gullhaven), `&m=7` (Gablefall), then `&m=0`.** On the Old Run, ride high on the glaze through a bend, then
   low in the slush. On Gullhaven, pop off a gully's lip and hold the wind; then take the path round one. On Gablefall,
   stay on the roofs, hop an alley, drop into the street and find a drift back up. Then Pinecrest: three new rides,
   unlike the five and each other? Does each mountain's music fit it?
5. **Low (1 minute): `?debug&save=mid-50&tier=low&m=6`** (Gullhaven, the dearest on Low). Does it look made and run
   smoothly? On a phone if you have one: the dev server's network address, Low.

## Where things are

- **The decisions:** DECISIONS 388 to 406. **The look:** ART.md 5 (the rider and the pieces), 10 (the screens), 13
  (finishes and a sled's track) and 15 (the three new mountains).
- **Each lane's notes:** `notes/r9-*.md` (the screens: `r9-ui.md`, `r9-u4.md`, `r9-polish.md`, `r9-feelui.md`; the
  garage: `r9-shop.md`, `r9-g6.md`; the mountains: `r9-ground.md`, `r9-oldrun.md`, `r9-gullhaven.md`, `r9-gablefall.md`
  and each one's `-world.md`, `r9-wiring.md`, `r9-look.md`); the briefs in `notes/r9-briefs/`.
- **Captures** (git-ignored) under `shots/r9/`: each lane's folder, the main lane's merge checks in `shots/r9/main/`,
  the perf sitting in `shots/r9/main/perf/`, the release's logs in `shots/r9/main/proof/`.
- **New tools** in `scripts/playtest/`: `r9-courses.ts` (the mountain bars), `r9-truth.js` and `r9-screenbars.ts` (the
  screen bars, every mountain on the title), `r9-garage-economy.ts`, `perf-r9.sh` (the sitting: the five against round
  8, then the eight); each mountain's lab in `scripts/r9/`.
