# Round 8, the spine lane: the bars and the design of milestone 3

Phase 1 of 2. The bars are written and measured on the `round-8` branch as it stands (sim version 9, nothing of the
round built yet). Milestone 3 is designed here and not built: the main lane reviews it first.

## 1. The bars harness

- `scripts/playtest/r8career.ts`: a player's career in node. The lab's pilots (`labpilots.ts`) ride the real sim one
  run after another, and every run is settled into a real save the way `app.ts` settles it (persistRun, then
  showResults): the field `pickField` lays (the bundled pools with their slow riders, a first run's riders reading
  you), the race against it (`GhostManager` itself, fed trajectories replayed exactly as `ghost.worker.ts` replays
  them, so passes, the pacer and the slipstream bit are the game's), `settleBest`, `settleGrudge`, `settleRun`
  (missions, the Daily, the Cup), `settleClimb`, `settleMastery`, unlocks and `settleTwelve`, and what results would
  say (the Run Again label, the race line, the next unlock, the mission rows). A fake clock moves a day every four
  runs (three for the novice); the Daily is the first run of each session from day two and the Cup the second run of
  a session once a week from day eight; Daily and Cup pools are generated as the worker generates them and cached in
  `shots/r8/spine/cache`. Where the next run goes: a mountain the run opened, else the next duel's home after three
  runs, else the least ridden open mountain once five runs here gained nothing the save keeps.
- One function per bar, over the runs and the save: `barNoDeadRuns`, `barOneRunAway`, `barDecisions`,
  `barExpression`, `barFirstMinute` with `clumsyFinishes`, `barStillNew`.
- Everything loads from `--root <checkout>` (the sim and the game layer), so one plan rides two builds.
- Where the round's work plugs in, with no change to the harness: the sim lane's events are all counted per run; a
  `trick` event with a `name` is a named trick, and `CHOICE_EVENTS` already reads `charm` and `showdown` events as
  choices (a dash and a fork's channel are read today). Milestone 3's `src/game/rank.ts` is read if it exists:
  `settleSpine(save, facts, now)` returns `{ gains, primary }` and `nextPage(save)` returns `{ need, label }`.
- `tests/r8bars.test.ts`: the same bars at the suite's size (one 30-run mid career with the Daily and a Cup, two
  first runs each, the clumsy pilot's thirty, five expert runs). Six assertions are `it.fails` today and two hold
  (the career's own sanity, and the clumsy pilot's 26 of 30). About 35 s in vitest once the Daily and Cup pools are
  kept in the temp folder (110 s cold, with another lane busy on the laptop).
- Run it: `npx tsx scripts/playtest/r8-bars.ts --small` (about 10 s), or at full size
  `npx tsx scripts/playtest/r8-bars.ts` (`--only` and `--pilots` split it).

**Runtime at full size**, measured one process at a time on the laptop: the mid pilot's 100-run career 87 s with
the Daily and Cup pools cold (about 1.3 s a pool) and 38 s warm; the novice's 100 runs 65 s cold, about 50 s warm;
first minute, the clumsy thirty and the expression runs 12 s. Everything at once: about 2.5 minutes cold, under 2
warm. The test file: 35 s warm, 60 to 110 s cold (vitest rides the same code more slowly than tsx).

**What is approximate** (said in the harness's header too): the pilots never get better; a pass pays its base gifts
once a rider (the director's extras and the grudge premium are left out); a grudge is beaten when passed or out-run
on its real record; nobody revives, doubles or rides home; a pass is "shown" from 6 s on (the director's own mute
also spares a rider who led by 2 m); a perfect is any perfect landing (the harness does not model whether the hint
coach prompted it).

## 2. Today's numbers (round-8 branch, sim version 9)

| Bar | Today | Holds? |
| --- | --- | --- |
| No dead runs (mid, first 30) | 5 runs gain nothing the save keeps (14, 19, 22, 24, 28: a pass, once a pass and a best). Counting a pass or a best, none is dead. Over 100 runs: 28 dead, 0 in runs 1 to 10, then 2 to 4 in every ten. | no (strict) |
| Always one run away (100 runs) | mid: a reachable goal existed after 86, the button named one after 38, any line of the card after 63. novice: 55, 21, 44. The button is always a rider (mid: Rematch 81, Race 6, Duel 3, The Last Race 10; novice: Rematch 97) and never a mission, a medal or the Daily. | no |
| Decisions (mid, 100 runs) | 2 kinds: a dash (1,046) and a fork's channel (141). Median 12 choices a run (6 to 18), almost all dashes. | no (kinds) |
| Expression (expert, 10 runs) | 3 families (a spin, a flip, both); 9 names said (Spin 180 to Spin 1980, Backflip, Double Backflip); best combo 2 families. | no |
| First minute (6 seeds each) | clumsy: first shown pass 13 to 40 s (1 of 6 by 20 s), first perfect 13 to 118 s (1 of 6 by 45 s), first dash 26 to 47 s (6 of 6). novice: pass 24 to 54 s (0 of 6), perfect 7 to 87 s (4 of 6), dash 28 to 93 s (4 of 6). No run meets all three. Clumsy finishes 27 of 30 (its first runs take 5:33 to 8:29). | no; finishes yes |
| Still new at run 50 (mid) | reachable unseen: Pinecrest 2, Frostfang 3, Ember 2, Sakura 1, Lanternfall 0 (only its two legends left: the mid pilot had beaten all twelve of The Twelve and taken Lanternfall's stars by run 50). | no |

Economy today (what the save holds; gifts are never spent in the harness):

| Run | mid gifts | passed | mountains | Twelve | stars + medals | missions | novice gifts | passed | mountains | Twelve | stars + medals | missions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 595 | 5 | 2 | 1 | 8 | 3 | 330 | 4 | 2 | 0 | 0 | 3 |
| 5 | 1,760 | 22 | 3 | 1 | 17 | 8 | 1,025 | 22 | 3 | 0 | 3 | 9 |
| 20 | 4,045 | 107 | 4 | 8 | 33 | 14 | 2,410 | 79 | 4 | 1 | 7 | 12 |
| 50 | 7,355 | 282 | 5 | 12 | 50 | 22 | 4,075 | 208 | 4 | 1 | 10 | 12 |
| 100 | 12,110 | 560 | 5 | 12 | 54 | 41 | 6,955 | 438 | 4 | 2 | 17 | 12 |

What these say, beyond the bars:

- **The first ten runs are rich, then the game goes quiet.** The boards (missions, stars, ladder ranks, medals)
  pay almost every early run and run dry: dead runs climb from 0 in ten to 3 or 4 in ten. Section 1's "no spine" is
  confirmed.
- **The novice's missions stop at run 20.** Twelve missions done by run 20 and still twelve at run 100: three
  missions it cannot finish (a backflip, a 720, a time) hold their slots for 80 runs. Missions need to fit the
  player.
- **Gifts outrun the garage.** Everything in the garage costs 6,270 gifts (sleds 2,340, scarves 780, hats 820,
  trails 770, sounds 660, paints 900); the mid pilot has earned 7,355 by run 50. After that gifts buy nothing.
- **After The Twelve there is nowhere to go**, confirmed: the mid pilot beat all twelve by run 50, and Lanternfall
  is "done" but for two legends.
- **A fresh save's very first run is a duel** (Bram Oakhollow on Pinecrest), which is two ideas at once for a
  first-timer.

## 3. G4: Rider Rank and the Almanac

**One bar.** Every run pays experience (XP) into one Rider Rank. XP is not spendable: it is a measure, not a second
currency. Gifts stay the garage's only currency.

What pays XP, settled in `rank.ts settleSpine` from the run's facts and the outcomes the existing settles already
return (so missions, mastery, medals, the ladder and The Twelve all move the one bar):

| Source | XP |
| --- | --- |
| Riding at all | 20, and 10 a stage line crossed |
| Finishing | 60 |
| Place in the field | 8 a rider finished ahead of |
| A rider passed (once a rider a run) | 6, at most 60 |
| A named trick landed | 3; a trick new to the combo 2 more; at most 60 a run |
| A set piece won | 25; a variant won for the first time 25 more |
| A showdown won (sim lane) | 20 |
| A charm ridden for the first time ever (sim lane) | 25 |
| A mission | 40, tier II 60, tier III 90 |
| A ladder rung climbed | 5 each, at most 100 |
| A stage medal raised | 15, 25, 40 by medal; a run medal 30, 50, 80 |
| A Daily or Cup medal raised (the day's or the week's best) | 20, 35, 60 |
| A mastery star | 30 |
| A duel won | 150; the last race 400 |
| A personal best time | 20 |
| Daily contracts (G7) | 50 each, 100 more for all three |
| The day's first run | its XP doubled, up to 200 more (no timer: it waits however long you are away) |

**The curve.** Page n costs 120 + 30n XP for pages 1 to 10 (150 to 420), 500 + 40(n - 10) for 11 to 30 (540 to
1,300), and 1,400 for 31 to 50: about 49,000 XP to page 50. The mid pilot's careers today would pay about 290 XP a
run, so pages 1 to 10 take about ten runs, page 30 about run 75 and page 50 about run 170; the novice's about 180 a
run reaches page 50 near run 270. The run 200 player is still turning pages, and after page 50 the monthly chapter
carries on.

**The Almanac: about 50 pages, a reward on every one.** Rewards are opened on the results (G5), one card a page.

- Pages 1 to 10, each opening something that changes play (one idea a page, after a first run that taught the
  basics; G10):
  1. The second charm gate (at the first stage line), and the charm Slipstream (drafting fills the lantern).
  2. Daily contracts (G7), and the charm Ember Heart (a perfect landing refunds a lantern cell).
  3. The Spirit Album (G8), filled at once from what the save already holds, and the title "Rider".
  4. The third charm gate (at the second stage line), and the charm Long Fuse (near misses extend the combo).
  5. The Whirl Saucer, free (a sled is a sidegrade: it changes how a run rides), with its signature flourish.
  6. Call your rival: before a run, pick one rider from a mountain's ladder to ride as your rival (field.ts
     `promised`, which Run Again already uses).
  7. The charm Comet Tail (dashes last longer, no ward).
  8. Pinecrest at dusk (the mountain's alternate hour: render only), and the charm Featherfall (a fall costs no
     get-up but empties the lantern).
  9. Mirror Pinecrest (G9).
  10. The Long Night, three legs (G9).
- Pages 11 to 50: the rest of the charm pool (the sim lane's pool is a mask; the Almanac widens it to about 24 by
  page 40, a charm every two or three pages), mirror Frostfang, Ember, Sakura and Lanternfall (pages 15, 20, 25,
  30), each mountain's alternate hour (12, 18, 24, 32, 38), a flourish for each named trick (G1's ten, a pose or a
  trail colour, cosmetic), five garage pieces found only here, a title every fifth page, Trials (35, if built), the
  Long Night's legs four to six (22) and all of them (33), gift bundles of 100 to 300 to fill, and page 50: the title
  "Lantern Keeper" and a lantern trail.
- What a charm in the pool means for fairness: a ghost's record carries its picks (G2), so a ghost may wear a charm
  you have not opened yet. Nothing bought is in the pool; only riding opens it.
- The pool's mask and the number of charm gates a run stands (one, two, three) are inputs to the sim and must be in
  the record. If the sim lane's mask cannot also carry the gate count, all three gates stand from run 1 and pages 1
  and 4 open a charm each instead.

**Missions, mastery and medals fold into it.** They stay where they are and pay their gifts as now; each now also
pays XP, and the results bar shows each as a labelled tick ("Mission +40", "Star +30"). The title shows the bar, the
next page and its reward, always. Missions get one change, from the numbers above: a mission held for five runs
without progress offers a swap (results' secondary action, free, once a day), and the rotation's draw skips a
mission the player's last ten runs never came within half of. The novice's 80 runs without a mission are the reason.

**Seasons with no server: recommend yes.** A chapter a calendar month, by the UTC date: ten pages of its own with a
themed set (a scarf, a hat, a trail, a title, a contract theme), XP flowing to it alongside the Almanac (and wholly
once the Almanac is done). Old chapters are kept on the Almanac's shelf and can be finished any time, so nothing is
lost by being away: a month is when a chapter arrives, never when it closes. Twelve chapters are written ahead and
cycle by month, each mostly recombining existing garage parts with one new piece. Each chapter's set is also sold
for gifts in the garage, which answers the gifts that outrun the garage at run 45. Why yes: it is the returning
player's "new today" line once a month, and it keeps gifts meaning something; the cost is twelve small sets. Without
it the run 200 player is past page 50 with nothing left to turn.

## 4. G5: results that sell the next run

A directed sequence over the live scene, about five seconds, every step skippable with a tap (a tap skips to the
button, a second tap presses it):

1. **The run's moment** (to 1.2 s): the biggest thing it did, from what the director already marks (a duel won, a
   set piece won, a legend, the best trick, the pass of the rival), with its frame from the reel.
2. **The place, with the nearest thing framed** (to 2.2 s): "2nd of 8", and "0.4 s behind Old Wren" or "held off
   Pip Thistle by 1.1 s".
3. **The rank bar** (to 3.8 s): XP ticks in by source; it stops short of the next page on purpose ("Page 7: 40 to
   go") or turns the page.
4. **What opened** (to 4.8 s): each reward a card that turns over, one at a time: a page's reward, a mountain, a
   sticker ("3 new stickers"), a duel's crown, the day's flame.
5. **One primary button**, chosen by the rule below; the title and the garage are small secondary links.

**The rule for the one button.** `rank.ts nextGoals(save, recent runs)` lists every goal with whether the player's
last five runs put it in reach (the harness's `nearGoals`, moved into the game and shared by both), then:

1. **Claim** when a reward is waiting to be opened that needs a choice (a chapter's set piece to wear).
2. **Rematch <rider>** when this run lost to a named rival within reach: a duel lost by 3 s or less, the grudge or the
   run's rival within 2 s or 50 m.
3. **Finish the mission ("12 m short")** when a mission is within 15% of its target, or one short of a small count.
4. **Next Duel <rider>** when this run won a duel, or the next duel's rider is within reach of the player's recent
   times there.
5. **Today's Daily ("keep the flame: day 4")** when the day's Daily, or a contract, is open and the player has not
   ridden today.
6. **Run Again** with the nearest reachable goal as its line: the next page ("page 8 is 60 away"), a rung, a stage
   gold, or the form contract.

The form contract makes the rule always land on something reachable: one standing contract, re-drawn whenever it is
met, set from the player's last five runs at about their median (pass four riders when they usually pass five, land
a Spin 540 when they have landed one in three of them, win a set piece they won twice). By construction a recent run
already did it, so it is reachable; it pays XP, so a run that meets it is never dead. Restart to riding under two
seconds: the button starts the next run's field picking as the sequence plays.

## 5. G7: come back tomorrow

- **Keep the lantern lit.** The title shows a flame: days in a row with a run of any kind (today's streak counts
  only Daily runs). A seven-day calendar of growing rewards (XP 20, 30, 40, 60, 80, 100, 150 and on day seven a
  calendar sticker and a chapter piece) advances by days ridden and never goes back. One ember: a missed day is
  covered by it when you come back, and it is earned again by finishing a calendar week (you hold one at most). A
  missed day with no ember puts the flame out; the calendar keeps its place. No timer gates play: nothing is locked
  until a time, and nothing is lost by playing late.
- **Daily contracts.** Three a day, drawn from the UTC date and the save's seed (no server): one on the Daily
  Mountain, two on named mountains you have open, each finishable in one run and set from your recent form (a time
  you have been within 3 s of, a set piece you have won, a trick you land). 50 XP each, 100 more for all three.
- **Cup leagues.** Five divisions. Each week's league is you and nineteen records: generated runs of the week's Cup
  course, ridden by the bot as the Cup pool is now, at your division's band of pace (division five around the slow
  riders, division one around the quickest). They are shown as what they are: "records of the week" with the pools'
  generated names and their real times, never as players online. You stand by your week's best time; the top four go
  up and the bottom four down when the week turns; a week you do not ride holds your division. A medal and XP by
  place.
- **The returning player's one line** on the title, the first that applies: the ember saved yesterday; a new
  chapter; the flame's day ("Day 6 of your flame"); today's three contracts; where the Cup's league stands; a page
  one run away.

## 6. G8, G9, G10

**G8, the Spirit Album.** Stickers for: each set piece variant won (41), each legend met (10), each mood ridden on
each mountain (moods by mountain), graveyards survived, each named trick landed (G1) and landed on each mountain,
each of The Twelve beaten, each charm ridden and each named synergy (G2), each mirror mountain finished, each Long
Night depth. A completion figure per mountain and overall, and the silhouettes of what is still unseen, each with
where to find it. *Game layer:* `album.ts` (pure), the catalogue read from the course, moments and roster data, the
save's `album`. Each sticker's frame: the reel already renders a shot from a record, so the save keeps the record
of the run that earned a sticker for the forty most recent such runs (one record serves every sticker of that run);
older stickers show a painted card of their kind. *Sim:* nothing beyond the sim lane's batch (its trick, charm and
showdown events). *UI:* an album screen off the title, the sticker cards in results step 4.

**G9, the Long Night.** Whole mountains back to back (Pinecrest, Frostfang, Ember, Sakura, Lanternfall, then the
mirrors), never stitched mid-course. Get-ups, the lantern's charge and the charms carry from leg to leg; chaos rises
each leg (a mood from leg two, a mood and an event from leg four, the roll is game-side); between legs the next
mountain's start-line charm gate is the pick; the best depth (legs finished and metres into the last) is kept, and
each leg's field is that mountain's pool. *Sim:* the carry is the one thing the sim must accept, and it must be in
the record header so a leg replays: `SimConfig.carry?: { lantern, getUps, charms }`. It is not in the sim lane's
batch as far as I know, and it has to be decided now (choice 3 below). Without it the Long Night ships with fresh
legs and a lantern carried only as a score. *Game layer:* `longnight.ts`, the save's `longNight`. *UI:* a mode card
on the title, a leg card between legs.

**Mirror mountains.** The picture and the steering flip, the sim does not: a mirrored run is a normal run with its
steering inverted, so its record is an ordinary record and replays as one, and every ghost is drawn mirrored with
you. Its bests and ladder live under `mirror:<id>` keys (the same pool, mirrored). *Render and UI:* flip the scene's x
and the steering input; keep every sign's lettering the right way round. No sim change.

**G10, the first minute.** What run 1 stages, one idea at a time: steering (the start line's single charm gate, three
starter charms), a ghost to pass (the readers' string puts one rider about 20 m ahead and slower over the first 300
m, so the first shown pass comes by about 12 s: pacer.ts, game layer), a prompted perfect (the stomp cue on the first
kicker, with a first-run stomp buffer: an action pressed up to 0.35 s early is held to the landing tick; it is input,
so the record carries it and a replay is exact), a full lantern and a reason to spend it (a pack the pacer gathers
just ahead as the first lantern lights, with the prompt), and a finish. The first duel waits until the third run, so
run 1 is not also a duel. Run two opens the Almanac (page 1 is crossed on run 1 by design: 150 XP). Today's numbers
say the pass is the game layer's to fix; the perfect and the dash depend on what the pilots do with what the run
hands them, and the pilots never read a prompt (choice 2).

## 7. The save

New optional fields, each written only once it holds something, each read by a sanitising reader in `merge` as
`twelve` is (`readTwelve`): unknown values dropped, an old save reading as nothing earned.

- `rank?: { xp: number; claimed: number }`: total XP and pages opened (the pages' rewards, the charm pool's widening
  and the titles all follow from `claimed`, so nothing else is stored for them). `title?: string`, the one worn.
- `chapters?: Record<string, { xp: number; claimed: number }>` by month key ('2026-12').
- `album?: { got: Record<string, number>; runs?: Record<string, string> }`: sticker ids with the day number they came,
  and up to forty run records by key.
- `flame?: { last: string; streak: number; best: number; ember: number; days: number }`.
- `contracts?: { day: string; done: number; form?: { id: string; target: number } }`.
- `league?: { week: string; div: number; best?: number }`.
- `longNight?: { legs: number; z: number }`.
- Mirror bests under `mirror:<id>` keys in `best`, `runTimes` and `climb`; `pruneDaily` leaves them alone.

**A save from before the spine.** With no `rank`, XP is seeded once from what the save holds (missions completed,
stars, medals, rungs, The Twelve beaten, runs ridden, at the table's rates and capped at page 25), and the pages it
crosses open one a run on the next results, so a veteran's first runs on the new build each open something. Rank is
never archived by a clean break (SIM_VERSION 10 moves the Climb to the archive; the XP it paid stays).

**Migration tests** (in `tests/migration.test.ts`'s style, plus one file per system):

- a round 7 save (gifts, sleds, paints, mastery, The Twelve, a Climb) loads with `rank` seeded deterministically, the
  same on every load, and writes back with no new empty fields;
- a save with every new field round-trips exactly; mangled values in each (negative XP, a sticker id that does not
  exist, a streak in the future, a division of 9) are dropped or clamped, and the rest is kept;
- the SIM_VERSION 10 clean break keeps `rank`, `album`, `flame` and `league` whole;
- `rank.test.ts` (the XP table on made-up run facts, the curve, a second settle of the same run paying nothing),
  `almanac.test.ts` (fifty pages, a reward each, the first ten each changing play), `flame.test.ts` (streak, ember and
  calendar across month and year ends), `league.test.ts` (the same nineteen for a week and division, promotion and
  relegation), `album.test.ts` (the catalogue per mountain, idempotent awards).

## 8. The economy I will hold myself to

Targets for milestone 3's gate, measured by the harness on the same careers (the gifts column is today's pays, which
the spine does not change):

| Run | mid page | novice page | charms in pool | gifts (mid lifetime) | stickers (mid) | Long Night | flame and calendar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 1 | 3 starters | about 600 | about 6 | locked | day 1 |
| 5 | 6 | 4 | 6 | about 1,800 | about 20 | locked | day 2 |
| 20 | 14 | 11 | 10 | about 4,000 | about 55 | open, 3 legs | day 5 |
| 50 | 24 | 18 | 15 | about 7,400 | about 100 | 4 to 6 legs, depth 2 to 3 | day 13 |
| 100 | 35 | 27 | 21 | about 12,000 | about 150 | all legs, depth 3 to 4 | day 25 |

(At about 290 XP a run for the mid pilot and 180 for the novice, before the day's-first-run bonus.)

And the bars at the gate: no strictly dead run in the mid pilot's first 30 (and under 1 in 10 after); after every one
of the first 100 runs (mid and novice) the button names a goal a recent run reached; at least four kinds of choice a
run with the sim lane's charms and showdowns; still new at run 50 on every mountain (a mirror, an alternate hour, a
sticker set for it); the first minute's pass met by the game layer, and the perfect and dash measured both with blind
pilots and with prompted ones.

## 9. Choices for the main lane

1. **How "no dead runs" counts.** Strictly (only what the save keeps: today 5 of 30 dead) or with a pass and a best
   (today 0 of 30, so that bar would measure nothing). *Recommend strict*, which is what the brief's own list says.
2. **Whether first-run pilots follow prompts.** The perfect and the dash in the first minute are what a pilot does,
   and today's pilots never read the screen. *Recommend* a documented "prompted" variant of the clumsy pilot and the
   novice (it takes a shown stomp cue or dash prompt most of the time), reported beside the blind pilots, rather than
   tuning the game to pilots who cannot see it.
3. **The Long Night's carry needs the sim.** Lantern, get-ups and charms carried into a leg must be in the record
   header to replay. *Recommend* adding `SimConfig.carry` to the SIM_VERSION 10 batch now (small, and the sim closes
   after it); otherwise the Long Night ships with fresh legs.
4. **Monthly chapters.** *Recommend yes*, old chapters kept and finishable any time, each chapter's set also sold for
   gifts (the garage is bought out by about run 45 today).
5. **The flame counts any run, and the calendar never goes back.** Today's streak counts Daily runs only. *Recommend*
   any run lights the day, the calendar advances by days ridden, and one ember covers one missed day.
