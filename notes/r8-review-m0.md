# Round 8, milestone 0: the live build checked against the outside review

The build: `dist/r8-base`, served locally on port 4840. It is byte for byte the deployed site: the entry bundles'
hashes match (`index-D6Htswwt.js`, `chaos-D3le-hD0.js`), and the deployed title was looked at once. Played in
headless Chrome on this laptop's Arc GPU, one browser at a time: desktop 1280x720 on High (Low on two mountains),
and a 390x844 phone at DPR 2 with real touch events. Every frame below is under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/` (paths below are relative to it), and I looked at each one I cite.

How it was played, and what that means for this note:

- **A clumsy first run with real keys** (`tour.js`: a fresh save, the real title, Space, a key held 2 s), twice.
- **A replayed best run down all five mountains** (`?demo=0`, the pool's best ghost riding as the player), frames
  at fixed metres and through the finish to results. This is a skilled rider's line, not a person's.
- **Ten runs on one save** (Pinecrest, High, the `mid` pilot from `telemetry.js`, through the real Run Again and
  the real title between runs 1, 2, 5 and 10), with each results card's text read out of the page.
- **A Daily, a Cup and two duels** started from the title's own cards with the `mid` and `novice` pilots, a clumsy
  pilot's first run, the screens walk, the phone's first run, and a save past the crown.

Nothing here was felt by hands. The pilots are scripts; where a line needs a person, I say so. No fps were judged
(other lanes were running); the tour's own probe read 58 to 60 fps on High at 1x throughout, for what it is worth.

## The look (section 1, "why it is an 8.5")

1. **Snow is half the frame and the least developed thing in it: partly.** True on Pinecrest, Frostfang, Sakura
   and Lanternfall: the near snow is one smooth hue ramp with white speckle, and the only marks in it are the
   sled's own grooves and the ghosts' mint lines (`high/m0-0900.png`, `high/m1-0900.png`, `high/m3-0900.png`). No
   grain or depth of powder at the lens, and nothing tells powder from groomed from ice except the Crevasse Fields'
   blue. Wrong in two details: tracks are not hairlines (the sled cuts broad blue ruts, `high/first-ArrowRight-after-6.png`),
   and Ember's snow already has relief, wind-combed ripples across the whole slope (`high/m2-0250.png`,
   `high/m2-1600.png`). So the fix is not "add relief" everywhere; it is a near-lens surface on four mountains.
2. **Trees at the lens break into shards: confirmed, and worse than stated.** Every time the camera passes a pine
   within a few metres it fills a third of the frame with a few huge flat translucent planes
   (`high/first-ArrowRight-end.png`, `high/first-ArrowLeft-end.png`, `high/m0-2300.png`, `high/m3-2300.png`). It is
   not only the forest: Frostfang's crevasse walls and the Ice Cavern's rocks do the same at the lens
   (`high/m1-2300.png`, `high/m1-3400.png`). It happens to a clumsy player more than to a good one, because a clumsy
   line is the one that brushes the trees: the first run is where it is seen most.
3. **Every mountain opens on the same composition: confirmed for the openings, wrong as a whole-run claim.** At
   250 m all five are a trench with a bank each side and the peak or moon dead centre (`high/m0-0250.png`,
   `high/m1-0250.png`, `high/m2-0250.png`, `high/m3-0250.png`, `high/m4-0250.png`); Frostfang's 900 m is the same
   trench in ice (`high/m1-0900.png`). But "rarely below or ahead" is wrong past the opening: the First Drop, the
   Mirror Lake approach, Ember's shield and the long run-ins to the towns put the world below and ahead, and they
   are the best frames in the game (`high/m0-0600.png`, `high/m0-1600.png`, `high/m0-4000.png`, `high/m2-1600.png`,
   `high/m1-4000.png`, `high/m4-4000.png`). The problem is the first 20 seconds, which is the part a new player and
   a store clip see.
4. **Speed is painted on the lens: confirmed.** White diagonal streaks over the picture carry the speed on every
   mountain (`high/m1-0250.png` is the clearest: scratches across the whole lower half; `high/m4-2300.png`,
   `high/m3-1600.png`). The world's own help is a strong radial blur at the frame's edge, which smears the near
   trees and banks rather than making them rush past (`high/m0-0900.png`, `high/m3-0900.png`). The camera sits high
   and steady behind the rider; nothing near the line whips past at eye level.
5. **Flat value structure on Ember and Lanternfall: partly.** Ember's open slopes are one warm beige from edge to
   edge (`high/m2-2300.png`, `high/mood2-m2-800.png`), and Lanternfall's snow is one even lilac at the break and on
   the open road (`high/m4-1600.png`, `high/m4-4000.png`). But each has places where light does gather: Ember's
   Basalt Halls are black walls with lit orange floor (`high/m2-3400.png`, `high/m2-0900.png`), and Lanternfall's
   Firstlight street is dark towers with amber pools (`high/m4-3400.png`). The fault is the open stretches between
   the set places, which are most of each run.
6. **Effects are thin for the hero's actions: confirmed.** A perfect landing is a line of type ("TRIPLE STOMP /
   PERFECT +387 / SPIN +150 / BACKFLIP +1,200", `high/m4-0250.png`, `high/m3-1600.png`) and a puff of powder about
   the size of the sled; on Ember the puff is a dark grey cloud that reads as smoke (`high/m2-0900.png`,
   `high/m2-2300.png`). The biggest snow event in my frames is a clumsy fall (`high/first-ArrowLeft-after-6.png`):
   the game throws more snow when you fail than when you land a perfect. The typography carries the event, not the
   world.
7. **The image is not stable at High: partly, and the line mixes two builds.** The "softer rider, doubled lifts" were
   faults of the temporal rebuild (DECISIONS 363), and that rebuild ships off, so the live build has neither. What
   the live build does have, from stills: the rider goes soft under the motion blur at speed (`high/m3-3000.png`,
   `high/m3-2300.png`: the coat and sled smear). Shimmer cannot be judged from stills; only the 30 s clips or a
   person can say. Lower priority than the review's place in the list suggests.
8. **Reward screens are plain: wrong about results, confirmed about the title art.** Results is not "a dark card
   with a +31": it is a busy dark card with up to fifteen things on it (time, place, medal, new best, style, an
   unlock with Ride It, the Twelve, a rider's quote, mastery stars, gifts, three splits, best combo, stomp streak,
   missions, the race, the ladder panel), beside a posed rider in the finish town with fireworks
   (`runs/run01-results-b.png`, `high/m0-end-5.png`). Its fault is no hierarchy: run 1's card announces seven
   different wins at once and they cancel out. The title art is wrong as stated: once its camera move settles (4 s)
   the first visit's title is a composed Pinecrest at gold, as good as the game (`screens/desk-01-title-first.png`,
   the deployed site's `screens/deployed-title.png`), and so is the returning title (`runs/run01-title.png`). What
   is soft is the move's first two seconds, a washed lilac cloud sea with banded sky (`high/first-0-title.png`), and
   the phone's first title at 2.5 s, a close slope with nothing in it (`phone/first-title.png`).
9. **Low is 2 to 5 fps under round 7 at 6x: not judged here** (no fps on a shared machine). The perf lane has
   since found the cause in this build (the far shadows' uniform arrays re-sent at every material change, every
   fine tile baked twice, a look for work every frame; `notes/r8-perf.md`), so the line was right and is now
   explained. How Low looks on Ember and Lanternfall: a
   respectable simplified High, not a designed poster. Ember's gorge holds up (`low/m2-0900.png`); its open snow is
   the same one-value beige as High (`low/m2-2300.png`); Lanternfall's light pools become flat salmon blots on the
   lilac that read as stains, not light (`low/m4-1600.png`).

## The game (section 1, "why it is a 7.5")

1. **Lots of systems, no spine: partly.** There are tracks, and the title even says "one more run gets you X": the
   Ride button reads "Next: HailstoneSpruce, 1:55.9, 0.1 s up" (`runs/run01-title.png`), each mountain has a
   70-rider ladder, mastery stars, a ghosts-passed unlock and The Twelve. What is right is that none of it adds up
   to a player growing, and that on one mountain every track stops after run 2: from run 2 to run 10 the Ride button
   said the same "Next: SparkleCedar, 1:51.6, 0.6 s up", rank stayed 10 of 70, mastery stayed 9 of 13
   (`runs/run02-title.png`, `runs/run05-title.png`, `runs/run10-title.png`). Gifts piled up unspent (1,879 by run
   10) while the results card said "Whirl Saucer, ready in the shop" five runs running (`runs/run10-results-b.png`).
   One correction: gifts do not only buy looks; the six sleds have handling traits (`src/sim/sleds.ts`).
2. **Every run has the same shape: partly.** The rolled mood changes the physics more than the review allows
   (Comet Night is "Low gravity, huge air", `modes/cup-2-start.png`; Glass Ice, Powder Day and Comet Night came up
   in four of the ten runs), set pieces vary by seed, and the sled is a pre-run build in all but name. But none of
   it is the player's decision on the day: the mood is rolled, the sled is a shop purchase made once. In the run the
   one choice is still dash or ward. Confirmed in substance.
3. **The air is shallow: confirmed.** Spin and flip are the only air verbs (`src/sim/scoring.ts`); the clumsy pilot,
   mashing, logged sixteen "tricks" that are all spin degrees and flip counts. Worse than shallow, style is
   disconnected from the race: run 10 set a combo record (100,160) and an air record (8.5 s) and finished 9th of 9,
   21.6 s off its best; the card gave each record a small tag and the headline said "Bronze run"
   (`runs/run10-results-b.png`).
4. **Ghosts are scenery: partly.** The race reads as alive (a pass every 15 s for the mid pilot, "HELD OFF",
   "neck and neck", "took it back", a slipstream pill, grudges that settle: `high/m0-0900.png`, `high/m2-3400.png`,
   `high/first-ArrowLeft-hold-1.png`). But a ghost never contests anything: a duel is a time to beat and nothing
   else, the banner is the only sign (`modes/duel-rosa-mid-2-start.png`), and the mid pilot won Rosa's duel 14 s
   clear without her ever near it (`modes/duel-rosa-mid01-results-b.png`). The duel against The Twelve, the
   game's identity, plays exactly like a normal run.
5. **The results screen does not sell the next run: wrong in the letter, partly right in spirit.** The one loud
   button always names a target: "RACE HailstoneSp...", "REMATCH The Hollow ...", "REMATCH Kaito Mori",
   "DUEL Nessa Lumen" (`runs/run01-results-b.png`, `runs/run02-results-b.png`, `runs/run05-results-b.png`,
   `modes/duel-rosa-mid01-results-b.png`), and wins are celebrated (fireworks, a posed rider, "FIRST DOWN THE
   MOUNTAIN"). The fault is choice and clutter: the most tempting next thing (a new mountain just unlocked, "Ride It")
   is a small card beside the button, the button picks a ghost to rematch, long names are cut off, and fifteen
   items compete.
6. **Nothing asks you back tomorrow: partly wrong.** There is a Daily day streak ("N days in a row" from day two,
   `src/game/settle.ts`), Daily and Cup medals with a target ("Daily: Bronze. Silver at 2:08.2",
   `modes/daily01-results-b.png`) and a Cup with its own fixed mood (`modes/cup01-results-b.png`). Right in
   substance: the streak pays nothing and is invisible on day one, there is no league or table of people, and a
   Cup run is lonely (the mid pilot passed nobody in it).
7. **After The Twelve there is nowhere to go: partly.** With a save past the crown the title is the same title with the Twelve's card turned into
   a trophy ("The crown is yours"); what is left is the Daily, the Cup and the per-mountain ladders
   (`screens/after-crown-title.png`). Right as far as it goes. The bigger problem is the other end: the
   ladder is too gentle at the bottom. The very first run of a fresh save is a duel with Bram ("Duel: Bram
   Oakhollow, finish ahead of 2:09.2", `high/first-ArrowLeft-hold-1.png`), and the mid pilot won it on run 1
   without being told it was one (`runs/run01-results-b.png`). Six of the twelve home times are 2:00 or slower
   (`modes/duel-rosa-mid-1-ladder.png`) against the mid pilot's 1:56 first run: a competent player clears half the
   ladder in half a dozen runs.
8. **No person has played any of it: confirmed,** and this note does not change that: it is pilots and replays.

## What the review missed

Biggest first.

1. **The race has no floor, so early wins mean nothing.** A pilot that only steers and never presses the action
   button led the phone's first run from 5 s and was 50 m clear at 60 s (`phone/first-05s.png`,
   `phone/first-60s.png`). The screens walk's hands-off autoride, no input at all, came 2nd of 6 on Pinecrest
   ("Didn't even fall!", `screens/desk-08-results.png`). The mid pilot won its very first run outright, 1.8 s clear
   (`runs/run01-results-b.png`). Being kind to a first-timer is right; letting doing nothing reach the podium makes
   every early "1st" and "FIRST DOWN THE MOUNTAIN" cheap, and it is the same field the review calls a live race.
2. **The reward curve is front-loaded, then flat.** Run 1 paid everything at once: a win, a duel, a new mountain,
   eight mastery stars, four ladder medals, +470 gifts on the ladder and +66 on the card. Run 2 paid a new best and
   a podium. Runs 3 to 10 paid nothing new: same rank, same "0.6 s up", same stars, same "ready in the shop"; only
   the grudge line and the rematch name changed. The review's "no spine" is really "a spine that stops after run
   two". Every gain came from leaving the mountain (a new unlock, a duel elsewhere), and the button never says so.
3. **The first run of a clumsy player is five minutes of falling.** The clumsy pilot fell at 12 s and 23 s, eight
   times in all, was last by 248 m and still had 1,100 m to go at 5:08 (`modes/clumsy-first01-results-b.png`;
   the mid pilot's run is 1:56). Get-ups made it finishable, and endless. Meanwhile the hints nagged: the stomp
   hint was shown 77 times and the dash hint 23 in that one run (telemetry `hints`).
4. **The first run is a duel nobody has explained.** On a fresh save the banner at 1.8 s reads "Duel: Bram
   Oakhollow, finish ahead of 2:09.2 on Pinecrest", together with "+40", "SLIPSTREAM" and a ghost marker
   (`high/first-ArrowLeft-hold-1.png`), before the title has ever shown The Twelve (it appears after run 1).
5. **The Hollow King is an everyday ghost.** The finale's boss, who "has never been seen to fall", rides in the
   ordinary field on Pinecrest run 2 and wins it ("REMATCH The Hollow ...", `runs/run02-results-b.png`), and is a
   label in Sakura's opening (`high/m3-0900.png`). The mystery the ladder builds is spent on run 2.
6. **Comet Bob reads as an untextured white lump.** The pool's best rider rides it, so every replay, and any player
   who buys it, shows a faceted white shape under the rider (`high/m0-0060.png`, `high/m0-end-2.png`,
   `phone/m0-end-5.png`); in the garage it is a pale missile (`screens/desk-04-garage.png`).
7. **The HUD has already grown.** Top centre stacks the place pill, the rival pill, the score pop, the multiplier,
   "at stake", the km marker, the set piece's goal and mission toasts, with a hint at the bottom and a ghost
   marker over the snow (`high/m0-0250.png`, `high/m4-2300.png`). On the phone the top third is HUD, a trick callout
   runs off the right edge ("+1,20", `phone/m3-1600.png`), and the dash hint sits over the steering thumb's ring
   (`phone/first-60s.png`). A struck-through "10,824" in the HUD is never explained
   (`high/first-ArrowLeft-after-6.png`).
8. **Missions stall and medals mislead.** "Drift for 5 seconds in one run" sat open on the title for runs 1 to 5
   (0.3 then 0.4 of 5 s); the Daily's card shows "Best 59,465", a style score, beside a medal that is won on time
   (`modes/daily01-title.png`); first of six in the Daily was only Bronze, 12 s from Silver
   (`modes/daily01-results-b.png`); a duel lost by 23.4 s still paid +73, +165, three medals and "NEW BEST"
   (`modes/duel-rosa-novice01-results-b.png`). Losing feels like winning, so winning feels like little.
9. **What is better than the review says.** The places are the game's best argument and the review undersells
   them: Frostfang's Station Street, Old Town's bridge at gold, Lanternfall's Firstlight street and the break, the
   Ice Cavern (`high/m1-1600.png`, `high/m0-3400.png`, `high/m4-3400.png`, `high/m4-1600.png`, `high/m1-3400.png`).
   The race's voice ("neck and neck", "held off", "took it back", a grave marker "7 ghosts fell here") is lively,
   and the moods (Comet Night's low gravity) do change a run.

## Where a player stops playing, and why

Ten runs of the mid pilot on Pinecrest, one save, High, through the real Run Again and the title. The pilot does
not learn, so this is the game's side of the loop only; a person improves and would see "0.6 s up" fall.

| Run | Place, time | What the game said | The button | Would a player go again? |
| --- | --- | --- | --- | --- |
| 1 | 1st of 6, 1:56.0, Silver | First finish, Bram beaten (1 of 12), Frostfang unlocked, 8 stars, 4 medals, +470 and +66 | RACE HailstoneSp... | Yes, for Frostfang; the card does not point there |
| 2 | 2nd of 9, 1:52.2, new best | 3.8 s quicker, podium, rank 16 to 10, "The Hollow King" won | REMATCH The Hollow ... | Yes: the strongest pull of the ten |
| 3 | 8th, 2:01.8 | "You lost 15.3 s to The Hollow King in Stage 3", Ember unlocked | Rematch | Maybe: Ember is new |
| 4 | 9th of 9, 2:07.3 | Bronze, same rank line | Rematch | The first run that gave nothing |
| 5 | 4th, 1:54.0 | Grudge settled with Juno Vale, Sakura unlocked | REMATCH Kaito Mori | Only to leave for Sakura |
| 6, 7 | 5th, 1:56.5 and 1:56.4 | "Whirl Saucer ready in the shop", same rank, same stars | Rematch | **Here, on this mountain.** Nothing new is promised |
| 8 | 8th, 2:07.4 | A grudge settled, a new one named | Rematch | No |
| 9 | 3rd, 1:53.1 | Combo record 70,810, podium | Rematch The Hollow ... | A flicker |
| 10 | 9th of 9, 2:13.8 | Combo record 100,160, air record 8.5 s, "Bronze run" | REMATCH Mila Frost | No: the best style run of the ten was the worst result |

Frames: `runs/run01-*.png`, `runs/run02-*.png`, `runs/run05-*.png`, `runs/run10-*.png` (results at 1 s, at 6 s,
scrolled to the missions; and the title after). The title between runs barely changes: the same composed shot, the
same Ride line, one new mountain card unlocked at runs 1, 3 and 5, and from run 10 a grudge line ("Mila Frost is
waiting on Pinecrest", `runs/run10-title.png`). A player who stays on one mountain stops at about run 6. One who
roams has a new mountain at runs 1, 3 and 5 and a duel on each, and stops when those run out, sooner than the
review's "after The Twelve" because half the ladder falls to a mid rider on sight.

Off the main loop: the Daily (1st of 6, Bronze, +63, `modes/daily01-results-b.png`) gives a medal to chase and
nothing for coming back but a tag from day two; the Cup (4th of 6, Bronze, `modes/cup01-results-b.png`) is a lonely
run with no table; a won duel sells the next duel well ("DUEL Nessa Lumen", `modes/duel-rosa-mid01-title.png`).

## The first minute, as seen

From the clumsy first runs with real keys (`high/first-*.png`), the replay's opening on every mountain, the ten
mid runs' telemetry and the phone's touch run (`phone/first-*.png`). Against section 2's first-minute bar:

- **0 s.** The title: logo, "Race the ghosts of every great run", RIDE Pinecrest, "Pass ghosts to unlock new
  mountains". One button; good.
- **1.8 s.** "Duel: Bram Oakhollow, finish ahead of 2:09.2 on Pinecrest", "+40", "SLIPSTREAM", a "5 m" ghost
  marker and the Steer hint, all at once (`high/first-ArrowLeft-hold-1.png`).
- **First ghost passed: 2 to 4 s.** Every run: mid 2.6 to 3.6 s in all ten, clumsy 3.7 s, the phone's steering
  pilot was 1st of 6 at 5 s. The 20 s bar is met by a mile, which is the floor problem above, not a triumph. The
  exceptions are the modes: the Daily's first pass came at 42.6 s and the Cup's never.
- **About 10 s.** "Mission done: Pass a ghost +25 gifts" and the first kicker hint, "Hold, release at the lip"
  (`high/m0-0250.png`).
- **12 s and 23 s.** The clumsy pilot's first two falls (a held key, then a tree), both in the first 700 m, so no
  get-up is spent; the tree at the lens is the shard wall of look item 2 (`high/first-ArrowRight-end.png`).
- **About 25 s.** "Hold while turning to drift" (`high/m0-0900.png`); on the phone, "Drag to steer" and "Hold to
  drift" label the two thumb zones (`phone/first-30s.png`).
- **First perfect.** The replayed best rider lands a "TRIPLE STOMP, PERFECT" by 10 s (`high/m4-0250.png`), and the
  mid pilot met "Land 2 perfect landings" in run 1; the clumsy pilot's second perfect came at 224 s. The ring and
  its hint ("Tap as the ring closes") exist; whether a new person lands one by 45 s only a person can show.
- **First dash.** The lantern is full at about 40 s for a good line (`high/m0-1600.png`) and the dash hint comes at
  about 56 s (`high/m0-2300.png`); the phone's steering-only pilot had two and a half cells at 60 s and the hint
  "Tap the lantern to dash" on screen (`phone/first-60s.png`). A dash inside 60 s is possible, not prompted early.

What the screen teaches in the first minute: steer, the kicker, drift and dash, one hint at a time at the bottom,
which works. What it does not teach is what the place pill, the rival pill, "at stake" and the duel banner mean;
they all arrive in the first five seconds.

## The console

Clean. The tour's listeners caught no page error or console error on High (five mountains, the clumsy runs, six
moods), on Low (two mountains) or on the phone (two mountains); the phone's touch run and the screens walk, which
also listen for warnings, caught none; the session logs for every capture hold only the SDK's own LOG lines.

## Where everything is

`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/` (git-ignored): `high/` (110 frames: the clumsy first
runs, five mountains at nine distances and their finishes, six moods), `low/` (Ember and Lanternfall), `phone/`
(Pinecrest and Sakura with a finish, and the first run by touch), `runs/` (results and title after runs 1, 2, 5,
10), `modes/` (Daily, Cup, a won and a lost duel, a clumsy first run), `screens/` (the screens walk, the garage,
pause, the title past the crown, the deployed title). The capture scripts were `tour.js` (with Lanternfall added),
`telemetry.js` (with results and title shots and a start from the title's own cards), `mobile.js` and
`screens-walk.js`. The laptop blue-screened once mid-session with only this lane's one browser open; one frame was
lost and re-shot.
