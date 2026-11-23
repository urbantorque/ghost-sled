# Round 9, the truth lane: every screen at every stage, counted

Milestone 0's ground truth for the screens (brief: `notes/r9-briefs/truth.md`). Nothing here changes what a player
sees: the fixtures and the switch are dev only, the rest is scripts and tests. Kept current while the lane works;
**the capture status is at the top of "Captures"**.

## 1. Save fixtures

`scripts/playtest/fixtures/<name>.json` (`fresh`, `mid-1` ... `mid-100`, `novice-1` ... `novice-100`), written by
`scripts/playtest/r9-fixtures.ts` from the career harness (`r8career.ts`: the real sim, each run settled into a real
save through the game layer, a fake clock from 2026-12-01, the mid pilot four runs a day and the novice three, the
Daily first in each session from day 2, the Cup once a week from day 8). Two careers of 100 runs take 50 s (heavy
slot; the Daily's and the Cup's pools come from `shots/r8/spine/cache`). `index.json` lists what each holds.

| fixture | fake day | page (XP) | wallet / lifetime gifts | ghosts passed | mountains open | Twelve beaten | systems open (Almanac) | mirrors / hours / Night legs | stickers | missions done | flame | garage bought / left (gifts) | lanterns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fresh | - | 0 | 0 | 0 | pinecrest | 0 | none | - | 0 | 0 | none | 0 | 0 |
| mid-1 | 2026-12-01 | 2 (736) | 20 / 140 | 3 | 1 (pinecrest) | 0 | none | 0 / 0 / 0 | 10 | 1 | 1 days | 2 / 35 (7260) | 0 |
| mid-5 | 2026-12-02 | 6 (2997) | 85 / 805 | 21 | 3 (pinecrest, frostfang, ember) | 0 | contracts, album | 0 / 0 / 0 | 30 | 7 | 2 days | 9 / 29 (6840) | 0 |
| mid-20 | 2026-12-05 | 16 (14133) | 140 / 4655 | 102 | 4 (pinecrest, frostfang, ember, sakura) | 5 | contracts, album, rival, longNight | 2 / 2 / 3 | 84 | 25 | 5 days | 32 / 9 (3435) | 5 |
| mid-50 | 2026-12-13 | 25 (31299) | 90 / 9530 | 265 | 5 (all) | 10 | contracts, album, rival, longNight | 4 / 4 / 6 | 115 | 53 | 13 days | 49 / 8 (4210) | 20 |
| mid-100 | 2026-12-25 | 35 (57854) | 60 / 16595 | 524 | 5 (all) | 12 + crowned | contracts, album, rival, longNight, trials | 5 / 5 / 10 | 149 | 86 | 25 days | 63 / 7 (4765) | 33 |
| novice-1 | 2026-12-01 | 1 (433) | 20 / 80 | 5 | 2 (pinecrest, frostfang) | 0 | none | 0 / 0 / 0 | 1 | 1 | 1 days | 1 / 37 (7470) | 0 |
| novice-5 | 2026-12-02 | 5 (2138) | 60 / 670 | 15 | 3 (pinecrest, frostfang, ember) | 0 | contracts, album | 0 / 0 / 0 | 10 | 9 | 2 days | 8 / 30 (6950) | 0 |
| novice-20 | 2026-12-07 | 13 (9536) | 25 / 2895 | 67 | 4 (not lanternfall) | 2 | contracts, album, rival, longNight | 1 / 2 / 3 | 27 | 21 | 7 days | 24 / 17 (5100) | 4 |
| novice-50 | 2026-12-17 | 20 (21666) | 90 / 5520 | 157 | 4 (not lanternfall) | 2 | contracts, album, rival, longNight | 3 / 3 / 3 | 37 | 38 | 17 days | 36 / 8 (3420) | 8 |
| novice-100 | 2027-01-03 | 29 (42186) | 365 / 10805 | 368 | 5 (all) | 2 | contracts, album, rival, longNight | 4 / 4 / 6 | 52 | 64 | 34 days | 52 / 8 (4170) | 20 |

("Page" is the page reached by XP; "bought / left" counts every shelf piece, paint, chapter piece and lantern the
pilot bought cheapest first, and what is still on the shelves that day with its price.)

**What the harness settles:** gifts, bests, grudges, missions, the ladder and medals, mastery, The Twelve's duels,
unlocks, the Daily on its day, the Cup by its week, the spine (Rider Rank and the Almanac's pages, chapters,
stickers, the flame on the fake clock's days, contracts and the league) and the garage (bought cheapest first).

**What it does not, and what the fixture script fills** (each fixture's `meta.filled` says so):
- hints: the coach is not stepped on a career run, so the save would hold every lesson still to come. Filled from
  what the runs did (a stomp per perfect landing, a spin, a flip, a drift, a slipstream, a dash), and crouch, pop
  and boosted pop as taken from run 3 (the lab pilots use the button).
- what is worn: the harness buys and never wears. The last piece bought on each shelf is worn. The sled stays sled 0,
  the one every run was settled on.
- the mountain the title opens on: the last named mountain ridden (the harness never writes `mountain`).
- the name: a ghost name, as the app gives a fresh save.

**Not filled (not in any fixture):** the album's frames (pictures in the browser's IndexedDB, not the save: the album
shows its painted cards), Trials (never ridden: `trials` empty even at mid-100, where they are open), the Long Night
(`longNight` empty), the hours (no other hour picked), mirrors ridden, a title worn, photos and clips (never saved).
A run-50 save looks like a real run-50 player's on the title and in the books, except that it has never ridden a
Trial, a Long Night, a mirror or another hour: a real player who has those open probably has.

**`?debug&save=<name>`** (dev server only). `vite.config.ts`'s plugin (`apply: 'serve'`) puts the asked fixture in
the page as `<script id="gs-fixture" type="application/json">`; `app.ts` calls `useFixture` behind
`import.meta.env.DEV && DEV.has('save')`, before the save store is made (`src/game/devsave.ts`). The fixture's dates
move to today: days by the days between its last day and today, ISO weeks by the weeks between, chapter months by the
months between (flame, Daily, contracts, the mission swap's day, the Cup's and the league's weeks, Trials' weeks,
chapters, recent runs' keys). The Daily's, Cup's and Trial's bests and grudges (`daily:<day>`, `cup:<week>`,
`trial:<week>`) are dropped, because their records ride the old day's course; the day's medal, streak and best figure
stay. The save then lives in a store of its own in the page: the real save is never read, and nothing ridden is
written over it (a reload starts the fixture again). `tests/devsave.test.ts` loads every fixture through the real
store and checks the days, and that the real save is untouched. `?save=fresh` is a first visit without touching the
real save.

## 2. Captures

(filled as the parts land)

## 3. Escape and the pad's B

## 4. The bars and today's figures

## 5. Section 1 "The screens", line by line

## 6. What the main lane must decide

## 7. How to re-run everything
