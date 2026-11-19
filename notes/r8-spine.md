# Round 8, the spine lane: milestone 3's logic

Branch `r8-spine`. Phase 1 (the bars and the design) is `notes/r8-spine-design.md`; this is phase 2: the logic, the
save, the screens' contract and the bars measured again. No screen is built here: the screens lane draws from
`src/ui/contract.ts` and `src/game/spineview.ts`. The sim is untouched; where the spine needs the sim lane's batch it
is written against the names in `.claude/worktrees/r8-sim/notes/r8-sim.md` "Stable interfaces".

Checked with `tsc` and single test files only (the CPU rule): `spine`, `spinesave`, `r8bars`, `pacer`, `missions`,
`garage`, `migration`, `twelve`, `save`, `settle`, `cup`, `field`, `ladder`, `progress`. The full suite has not run.

## What a player gets, and what shows it

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **One rank every run moves** (`rank.ts`). Placing, passes, named tricks, set pieces and first-time variants, showdowns, first-time charms, missions, rungs, medals, stars, duels, the last race, a best time, contracts, the calendar, the league; the day's first run counts twice (up to 200 more, no timer). | "Two more runs and I unlock the next thing": the scattered boards all move one bar. | The mid pilot earns a median 630 XP a run in its first ten, 330 to 590 after; the novice 400, then 210 to 330. |
| **The Almanac** (`almanac.ts`): fifty pages, a reward on each; page n costs 240+60n to page 10, 1,000+80(n-10) to 30, 2,800 after (about 98,000 in all). Pages 1 to 10 each open something that changes play: charm gates two and three, charms, daily contracts, the album, a sled, calling your rival, Pinecrest's other hour, its mirror, the Long Night. | The first ten pages come in the first ten runs and each changes how a run plays; the last page is a long way off. | Mid: page 3 after run 1, 7 at run 5, 15 at 20, 23 at 50, 32 at 100. Novice: 1, 5, 11, 18, 26. At this rate page 50 is about run 190 for the mid pilot. |
| **The charm pool and gates** (`almanacPool`, `almanacGates`): the six starters, widened a charm every two or three pages to all 24 by page 43; one gate, a second from page 1, a third from page 4. | The first hour keeps widening (G2). | `tests/spine.test.ts`. |
| **Monthly chapters** (`CHAPTERS`, ten pages of 1,500 XP, its set on pages 3, 6 and 8 and its title on 10). Old chapters stay open; once this month's is done XP goes to the oldest unfinished. Each chapter's scarf, trail and paint are also on the garage's shelf for gifts from its month on (`shelfExtras`). | A dated "new this month", nothing ever missed for good. | The mid pilot finishes December's chapter by about run 30; the novice by about run 50. |
| **The flame** (`flame.ts`): any run lights the day; a seven-day calendar of XP (20 to 150, and 100 gifts and the ember on day 7) moves on by days ridden and never goes back; one ember, earned, covers one missed day. | Come back tomorrow, never punished for being away. | `tests/spine.test.ts` across month and year ends. |
| **Contracts** (`contracts.ts`): three a day from page 2 (one on the Daily, two on open mountains, from the day and the save's seed, each set from your form), 50 XP each and 100 for all three; and a standing **form contract** from the first run, set at your median over your last five runs and re-drawn when met. | There is always a goal a recent run already reached. | It is what makes the next bar hold by design. |
| **The one button** (`goals.ts`): Rematch (lost to a named rival by 3 s in a duel, 2 s or 50 m otherwise) > Finish the mission (within 15%) > Next Duel (within 0.4 s of your times there) > Today's Daily > Run Again with the nearest goal in reach as its line. Reach is read from `save.recent` (last five runs). | "I didn't even think, I just hit go again." | The button names a goal the harness independently finds in reach after 100 of 100 runs for the mid pilot and for the novice (38 of 100 and 21 of 100 before). |
| **Cup leagues** (`league.ts`): five divisions, you and nineteen records of the week's Cup pool at your division's band, top four up, bottom four down, a week not ridden holds. | A weekly ladder of real records, shown as records. | `tests/spine.test.ts`. |
| **The Spirit Album** (`album.ts`): variants won, legends, moods finished per mountain, every signature rider's record beaten on every mountain, mirrors, named tricks, The Twelve, charms and synergies, Long Night depths; a sticker keeps the run's record for its frame (the last 40 such runs). | Run 50 still has silhouettes to fill. | Mid: 14 stickers after run 1, 103 at run 50, 134 at 100. |
| **The Long Night and mirrors** (`modes.ts`): ten whole mountains (then their mirrors), chaos stepping up, carry in `SimConfig.carry`'s names; a mirror opens on its page or once its home riders have all fallen in duels, so a finished mountain hands you its mirror. | Somewhere to go after The Twelve. | `tests/spine.test.ts`. |
| **The Lantern Row** (`lanterns.ts`): eight lanterns to light in each mountain's finish town, in order, 150 to 675 gifts each (16,500 in all). Purely a look. | Gifts outrun the garage: the mid pilot could buy everything the garage sells by about run 25 with the spine's gifts, and one chapter set (960) does not change that at four runs a day (run 100 is day 25). | Mid at run 100 still has 7 pieces (4,765 gifts) to want, novice 6 (3,640). |
| **The first minute's opener** (`pacer.ts`): on a first run the quickest rider of the string leads you off the line by up to 18 m, comes back to 12 m behind by 250 m, then eases to its place. | A first-timer overtakes a real rider early. | Prompted novice: first shown pass by 20 s on 6 of 6 seeds (before: 24 to 54 s). |
| **The first duel waits for the third run** (`twelve.ts FIRST_DUEL_RUN`, `duelOn`'s `runs`). | One idea at a time: run 1 is not also a duel. | |
| **A stuck mission can be swapped** (`missions.ts swappable`, `swapMission`): after five runs without progress, one a day, never the mission the button is pushing. | The novice no longer holds three missions it cannot finish for 80 runs. | Novice missions done at run 100: 70 (12 before). |
| **Prompted first-timers** (`labpilots.ts prompted`): the clumsy pilot and the novice taking the stomp ring's gold flash (aim 4 ticks early, spread 6 or 4 ticks, a cue let go one time in three or seven) and the lantern's prompt (0.8 to 1.5 s or 0.5 to 0.9 s to react, 85% of the time). | The first-minute bar judged on a person following the hints; the blind pilots stay as a floor. | Below. |

## The bars now (SIM_VERSION 9: the sim lane's batch is not in)

| Bar | Before the round | Now |
| --- | --- | --- |
| No dead runs, mid, first 30 (main lane's ruling: a page, an unlock, a sticker, a duel won, a medal, a streak day, a mission or a contract) | 5 dead (more under this ruling: rungs and stars no longer count) | **0 dead**; 5 in the first 100 (runs 51 to 100) |
| Always one run away, 100 runs: the button names a reachable goal | mid 38, novice 21 | **mid 100, novice 100** |
| Decisions | 2 kinds (dash, fork), median 12 a run | the same: four kinds need the batch's charm gates and showdowns (`CHOICE_EVENTS` reads them) |
| Expression | 3 families, best combo 2 | the same: ten named tricks need the batch (`style` events with `trick`, read already) |
| First minute (6 seeds) | no run met all three | prompted novice **5 of 6**, prompted clumsy 2 of 6; blind novice 3 of 6, blind clumsy 0 of 6; clumsy finishes 29 of 30 |
| Still new at run 50, mid | Lanternfall 0 (all but two legends seen) | Pinecrest 1, Frostfang 2, Ember 3, Sakura 4 reachable; Lanternfall **still locked** for the mid pilot at run 50 (ten of The Twelve down, the next duel 0.7 s out of reach; at run 30 the way in was in reach) |

What the first minute still needs: the prompted clumsy pilot falls early on four seeds, so its first pass (23 to 43 s)
or its first dash (55 to 79 s, waiting on a lit lantern) comes late. The sim lane's `SimConfig.firstRun` (a wider
stomp window) does not touch either; a first run that starts with a lantern lit would, and only a person can say
whether a clumsy first-timer passes anyone early.

## The economy (r8-bars.ts, full size; the player spends gifts on the cheapest thing it does not own)

| Run | | page | charms | stickers | chapter pages | wallet | lifetime gifts | pieces bought | still to want (gifts) | Twelve | missions | flame |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | mid | 3 | 8 | 14 | 0 | 10 | 730 | 9 | 29 (6,810) | 0 | 3 | 1 |
| 5 | mid | 7 | 11 | 35 | 2 | 130 | 2,020 | 18 | 21 (5,790) | 0 | 8 | 2 |
| 20 | mid | 15 | 14 | 79 | 8 | 45 | 5,355 | 36 | 9 (3,660) | 7 | 25 | 5 |
| 50 | mid | 23 | 17 | 103 | 10 | 410 | 10,240 | 49 | 6 (3,490) | 10 | 55 | 13 |
| 100 | mid | 32 | 19 | 134 | 10 | 295 | 16,950 | 64 | 7 (4,765) | 12 | 84 | 25 |
| 1 | novice | 1 | 7 | 0 | 0 | 60 | 310 | 4 | 34 (7,280) | 0 | 3 | 1 |
| 5 | novice | 5 | 9 | 6 | 1 | 105 | 1,185 | 12 | 26 (6,480) | 0 | 8 | 2 |
| 20 | novice | 11 | 13 | 13 | 5 | 75 | 3,125 | 25 | 17 (5,300) | 0 | 21 | 7 |
| 50 | novice | 18 | 15 | 20 | 10 | 250 | 6,240 | 38 | 7 (3,235) | 1 | 43 | 17 |
| 100 | novice | 26 | 18 | 20 | 11 | 25 | 11,595 | 53 | 6 (3,640) | 1 | 70 | 34 |

"Still to want" at run 100 is the Lantern Row's last lanterns and, for the novice on 3 January, January's chapter
set. Without the Lantern Row the mid pilot would hold gifts with nothing to buy from about run 25.

## The save

New optional fields, each through a reader in `spinesave.ts` (and `lanterns.ts readLit`), written only when they hold
something: `rank`, `title`, `chapters`, `album`, `flame`, `contracts`, `league`, `longNight`, `recent`, `lit`; and
`missions.active[].stale`, `missions.swapDay`. A save from before the spine that has ridden is seeded once
(`seedXp`: 30 a run, 40 a mission, 30 a star, 40 a medal, 150 a duel, 400 the crown, capped at page 25), its pages
opening one more a run on the results. A clean break never archives them. `tests/spinesave.test.ts` holds a round 7
save through the seed (the same on every load and after a write), a never-ridden save's shape, the clean break,
an exact round trip of every field and a mangled save.

## Touched outside my files

- `src/game/garage.ts`, `src/game/paints.ts`: the Almanac's and the chapters' pieces are items of their shelves
  (`extraOn`, `isItem`, `scarfById`, `trailById`, `paintById`, `isPaint`), so an owned one loads, wears and renders as
  any other. The shelves' own lists (`SHELVES`, `PAINTS`) are unchanged.
- `src/game/twelve.ts`: `FIRST_DUEL_RUN`, `duelOn`'s optional `runs`, `riderTimeOn`.
- `scripts/playtest/labpilots.ts`: `prompted`.
- Not touched: `app.ts`, `run.ts`, `reel.ts`, `director.ts`, `ghosts.ts`, `hints.ts`, the sim.

## What the main lane must wire at the merge

1. **The results** (`app.ts showResults`, after the existing settles): build a `SpineRun` (its fields are what the
   harness's `career()` passes, `scripts/playtest/r8career.ts`), call `settleSpine(d, run, this.spineSettlement)` and
   keep the returned `settlement` for a revive's second settle; set `results.spine = resultsSpine(outcome, d, today)`.
   Until the screens lane draws it, `runAgainLabel` can take `spine.primary.text` and `aria`. A SIM_VERSION 10 run
   fills `tricks` from `style` events carrying `trick` (`TRICKS[id].key`, fresh the first time in the run), `charms`
   from `charm` events (keys by `CHARM_IDS`), `synergies` from `synergy` events (`SYNERGY_KEYS`), `showdownsWon` from
   applied showdowns; `lostTo` from the duel's rider, the grudge or the rider just ahead; `cupPool` on a Cup run.
2. **The title**: `spine: titleSpine(d, today, { week, cupPool, open })`; the old Daily-only streak line gives way to
   the flame.
3. **`duelHere`**: pass `this.save.data.runs` as `duelOn`'s fourth argument.
4. **The sim's config**: `charmPoolOf(save)` returns `almanacPool(save)`; `SimConfig.charmGates = almanacGates(save)`;
   `SimConfig.firstRun = save.runs === 0`.
5. **The garage**: the scarf, trail and paint shelves list `shelfExtras(today)` for gifts and the Almanac's pieces only
   once owned; the Lantern Row (`lanternShelf`, `lightLantern`) needs a shelf and the world needs to hang the lit
   lanterns in each finish town (world or screens lane).
6. **The swap**: the results' secondary action calls `swapMission(d.missions, id, today, ctx)` (`results.spine.swap`).
7. **Modes**: mirrors (`mirrorKey`, `mirrorSteer` on input, the scene flipped, signs kept the right way round), the
   Long Night (`LEGS`, `legChaos`, `carryFrom` into `SimConfig.carry`, `settleLongNight`), the album's frames
   (`album.runs`, rendered by the reel), an alternate hour's palette (`hourOpen`): each a screens or world lane's.

## What is still short, and what only a person can judge

- Decisions and Expression wait on the sim lane's batch; the harness reads its events already.
- Still new at run 50 fails on Lanternfall for the mid pilot (locked; its way in 0.7 s out of reach).
- The prompted clumsy pilot meets the first minute on 2 of 6 seeds.
- Whether the bar's ticks, a page turning and the one button feel like a reason to go again; whether the form
  contract reads as a goal or as homework; whether the flame feels kind or nagging; whether the Lantern Row is worth
  wanting. Only a person can say.
- XP rates were set from these careers; pilots never get better, so a real player's later runs will pay more.
