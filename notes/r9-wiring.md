# Round 9, the wiring lane (milestone 3's M3: the three new mountains wired everywhere, or a reason why not)

The brief is `notes/r9-briefs/wiring.md`; the rules `notes/r9-lanes.md`; the calls it builds on DECISIONS 392, 394, 397
(the Old Run), 400 (Gullhaven), 401 (G6) and 402 (Gablefall). Branch `r9-wiring`, cut by hand from `round-9` at 09d5e62.
The gate on every commit was `tests/five.test.ts` (the five's and the Dailies' courses, rolls and rides byte for byte); it
held on each. Frames and raw output are under `shots/r9/wiring/` in the main checkout. **Nobody has ridden or pressed any
of this by hand**: every figure is a script's, every frame a staged one (section 9).

---

## 1. Each new mountain's other hour, and its mirror, open to a player

### Before

The three hours were drawn (`ALT_HOURS`, named in `almanac.ts HOUR_PHRASES` and the Trials' `HOURS`) and their mirrors drew,
but a save could open neither: the five's hours open on Almanac pages and their mirrors on a page or on every one of The
Twelve at home beaten in a duel; the new mountains had no page and none of The Twelve at home. Only a Trial or a Long Night
leg rode them at their hour or mirrored.

### The hours: on pages that held only a charm or gifts

Each new mountain opens between two of the five (by ghosts passed), so its hour sits between theirs on the Almanac:

| Hour | Page | Held before (kept) | Its mountain opens at | Between the five's hours |
| --- | --- | --- | --- | --- |
| Gablefall at Evensong | **16** | the Quick Feet charm | 8 ghosts (Frostfang 4, Ember 12) | Frostfang's 12, Ember's 18 |
| The Old Run by Lamplight | **23** | 200 gifts | 18 ghosts (Ember 12, Sakura 24) | Ember's 18, Sakura's 24 |
| Gullhaven at Moonrise | **29** | the Frost Runners charm | 32 ghosts (Sakura 24, Lanternfall) | Sakura's 24, Lanternfall's 32 |

The hour is each page's first reward (the results turn over an hour before a charm anyway, `sequence.ts RANK_ORDER`), so
the title's quiet line names it when its page is next ("... XP to Rider Rank 16: Gablefall at Evensong"). No page is
emptied and no reward moved: three pages gained one. The mid pilot reaches page 16 near run 20, 23 near run 40 and 29 near
run 65 (the fixtures: run 20 holds 16 pages, run 50 25, run 100 35; the novice's 13, 20 and 29).

**No silent grant.** `almanac.ts ADDED_HOURS` names the three and their pages; a new hour opens (`hourOpen`) only once the
save has been told it (`RankSave.told`, `'hour:<id>'`, an optional field read by `spinesave.ts readRank`). A save that
turns the page is told on that page's card as any prize, and it opens at once. A save already past the page is owed it:
`rank.ts settleSpine` tells it on the next results, one a run, the lowest page first, on a card whose kicker is "New on
Rider Rank 16" and whose prize is "Gablefall at Evensong" (Details lists it under "Opened"). Until then the title shows
nothing for it and the Almanac lists it on its page, as a page's prize. A revive's second settle tells it once.

### The mirrors: its three home riders beaten to the line

`almanac.ts mirrorOpen` gains a third way beside the page and the duels (the five's two unchanged): a new mountain's mirror
opens once all three of its home riders (`HOME_RIDERS`, its mastery board's Home Riders row: "Beat Count Orsolo to the
line") are beaten. It is told on the run that beats the last of them (`owedRewards`, after the app has settled the board),
on a card whose kicker is "The Old Run's riders beaten" and prize "The Old Run, mirrored"; it opens only once told
(`'mirror:<id>'`), so a save that held all three before this change is told on its next results, never silently. The
rider row opens on a mountain's fourth ride (round 8's pacing), and the riders ride at 0.58 to 0.87 (0.05 more at home),
so a mid player meets it after some rides there; the Old Run's Count Orsolo (81.8 s) and Gus Fennick (81.3 s) ride a
little quicker than its pool's median (82.3 s), Lotte Bell (97.4 s) near its slow end.

**Said where a player looks:**
- *The board* (Progress, Medals, the mountain's board): under its Home Riders, "Beat all 3 to the line and The Old Run
  rides mirrored." (once open: "All 3 beaten: ride The Old Run mirrored from the title.").
- *The hour pair on the title*, where the Mirrored toggle stands once open: a quiet line with a lock, "Mirrored: beat its 3
  riders", then "Mirrored: 1 rider to beat" (words, not a control; a reader hears "... to the line, to ride The Old Run
  mirrored"). Five words at most; nothing on the five's mountains.
- *The album*: the mirror sticker's hint on a new page says "beating its 3 riders to the line opens it" (the five's still
  "an Almanac page opens it").

### What each fixture save sees (the title after loading; then its next results)

From the fixtures themselves (`almanac.ts` on each save; the fixtures' careers rode the five only, so none has ridden a
new mountain or beaten a home rider) and, for mid-50 and mid-100, the dev server (`scripts/r9/wiring-results.js`,
`shots/r9/wiring/results/`, a run started and the sled set near the line by script):

- **mid-5** (5 pages, 21 ghosts: Gablefall and the Old Run open, Gullhaven shut): owed nothing. Its next page is 6; the
  three hours wait on pages 16, 23 and 29 of the Almanac. On a new mountain's title the hour pair is "Mirrored: beat its
  3 riders" alone; its board's Home Riders row ends "Beat all 3 to the line and The Old Run rides mirrored."
- **mid-20** (16 pages) and **novice-50** (20): owed Gablefall's hour, told on the next results.
- **mid-50** (25 pages, 265 ghosts, all eight open): owed Gablefall's and the Old Run's hours. Seen: its first results'
  card "New on Rider Rank 16 / Gablefall at Evensong" (Details: "Opened: Gablefall at Evensong."), the second's "New on
  Rider Rank 23 / The Old Run by Lamplight"; the title after them on Gablefall "Day | Evensong" beside "Mirrored: beat
  its 3 riders". Gullhaven's comes on page 29, four pages on (page 26, the Crane's Memory charm, is next).
- **mid-100** (35 pages) and **novice-100** (29): owed all three, told over their next three results (16, then 23, then
  29). Seen on mid-100 with the Old Run's three riders marked beaten in the page's save (as the board's row would hold
  them; staged): one results card "The Old Run's riders beaten / The Old Run, mirrored" (Details: "Opened: Gablefall at
  Evensong, The Old Run, mirrored, Bell Tails"), and the title after on the Old Run with its Mirrored toggle.
- **novice-5** (5 pages, 15 ghosts: Gablefall open): owed nothing, as mid-5.

## 2. The Old Run's grade (DECISIONS 397)

`BIOME_PARAMS.oldrun.slope` 0.17 to **0.28**, the track's own. Its sections' grades were already set absolutely
(`course.ts pushSection` divides the grade by the param and the base height multiplies it back), so the course is the same
to the float's last bits; what reads the param itself is `Sim.cruiseSpeed`: a get-up's push, the ride home and the
avalanche's pace (none on the Old Run). On a plain day:

| | 0.17 | 0.28 |
| --- | --- | --- |
| cruise speed (the push is half of it) | 22.2 m/s | 28.9 m/s |
| a get-up's push | 11.1 m/s | **14.4 m/s** |
| with Quick Feet (0.65) | 14.4 m/s | 18.8 m/s |
| the ride home after a wreck | 14.0 m/s | 17.3 m/s |

(The far terrain: no render code reads the param but `props.ts` for a kicker's tilt, and the Old Run has no kickers.
`baseY` before z 0, behind the start house, now falls at 0.28 where it fell at 0.17; not seen in a frame.)

**The pool**, generated again alone in the heavy slot (`npx tsx scripts/generate-ghosts.ts --only oldrun`, one process, 10 s,
221 runs): **49 ghosts, 48 of them byte for byte the records they were**; only Lotte Bell's changed (a rider who falls, her
get-ups quicker): 99.9 s to 97.4 s. The field as it was: 77.9 to 100.7 s, median 82.3, p10 80.4, p90 92.1 (p90/p10
1.146), 80% of it between 80 and 92 s; the home riders 81.3 (Fennick), 81.8 (Orsolo), 97.4 (Lotte).

**The first run** (`FIRST_RUN_PACE.oldrun`) laid again after the pool with `scripts/r9/wiring-floor.ts` (the lanes' floor
scripts for any mountain, `--pace` and `--seeds`): it **stays 92 s**.

| Pace | Seed | A run that does nothing | One that only steers |
| --- | --- | --- | --- |
| 92 (before the grade) | 1234 | 93.6 s, 4th (third 91.1) | 91.9 s, 4th |
| **92** | 1234 (the bar's) | 92.0 s, 4th (third 90.6) | 94.7 s, 5th (2.9% off the pace) |
| 92 | 1271, 1308, 1345 | 93.6, 92.0, 93.6 s, all 4th | 91.9, 94.7, 91.9 s, 4th or 5th |
| 93 | 1345 | 91.5 s, 4th | 92.4 s, **3rd** (on the podium) |
| 94 / 95 / 96 | 1234 | 4th, 4th, **1st** | 5th, 4th, 4th |

**The lab's bar** (`npx tsx scripts/r9/oldrun-lab.ts`, heavy slot, 3 to 8 s; `shots/r9/wiring/oldrun-before/` and
`oldrun-after/`): every line met, before and after, every figure the same but the clumsy pilot's falls:

| | Before (0.17) | After (0.28) |
| --- | --- | --- |
| mid pilot | 89.6 s at 35.8 m/s, 54% of bend ticks on the glaze | the same |
| glaze line against its own floor line | 17% faster through the bends | the same |
| expert / bot at 0.9 on the glaze | 61% / 62% | the same |
| novice, a sled let go | 6 of 6, finishes, no falls | the same |
| clumsy pilot | 30 of 30, 158.4 s, 39.7 scrapes a run, 4 launches off a wall, 13 falls in all | 30 of 30, 158.4 s, 39.6, **3**, **11** |

**Against the five** (`npx tsx scripts/playtest/r9-courses.ts`, heavy slot, 39 to 45 s): the mid, novice and expert rows the
same to the last figure (the mid pilot 83.7 s at 38.2 m/s, outside the five on 5 of 6, by 15% on 4; the mechanic 43.3%);
the clumsy pilot 147.6 s to **143.8 s**, 22.5 to 23.1 m/s, 0.83 to **0.70** falls a run, 64.8 to 62.3 s in the air.

The five's fingerprint held; `tests/ghostpool.test.ts` replays the new pool; the Old Run's promises, the fairness,
determinism, pacing, get-up, finish, migration, clip and graveyard suites and the career bars (`r8bars`, `twelve`,
`ladder`, `bot`, `eight`) green after it.

## 3. The album

**Before:** 212 stickers for the five and the rest (round 8's "of 212"); 266 once the three registered (each new page 18: its
nine set-piece variants, two legends, six moods and its mirror) but no rival stickers there, since `twelve.ts riderTimeOn`
read only the five's pools.

**After: 311.** Each new page holds 33, laid as a page of the five is: its 9 variants, 2 legends, 6 moods, **The Twelve's
records there** (12: they ride every new pool; the pools are the same modules `app.ts` already loads, so nothing is added
to the first download) **and its own three home riders'** (3), and its mirror. A home rider's sticker is
`rv:<mountain>:<key>.home`, because Gablefall's Wren Slater has the key of The Twelve's Old Wren (`'wren'`), who rides
Gablefall too (section 8). The five's pages and every id on them are as they were; a save keeps every sticker it holds (the
album's reader keeps any id of a known shape, catalogued or not).

**The lanes' frames.** A sticker's frame is the run's own picture of its moment (round 8's photo lane): a set piece 0.6 s
after it starts and again at its last step. The Old Run's Horseshoe (`glaze`, its sunset stretch at 2,559 to 2,870 m) and
Bend Bells (`peal`, the last bell rung) and Gullhaven's Lighthouse (`beam`, its last mark) take theirs as the five's do. The
Great Geo's (`soar`) was taken on the shelf before its lip; it is now taken **1.6 s after the sled leaves the lip**, out in
the column over the cleft with the lens stepped out to the sea (`albumframes.ts FLIGHT_PIECES`, `FLIGHT_DELAY_S`; its
flights last 4.3 to 6.5 s). Gablefall's lane listed none; its three set pieces' frames are taken as the five's. (No frame
of any of these has been looked at: section 9.)

## 4. Missions

**Each mission that names a mountain or a look:** two, both the five's: "Smash 3 snowmen" (`smash3`, Pinecrest's look) and
"Ride through 3 spirit gates" (`gates3`, Sakura's). A look's mission is skipped while its mountain is shut and comes back
in a later cycle (`missions.ts topUp`, `unlockedBiomes`); the new mountains' looks count only once each is open
(`tests/wiring.test.ts`). The day's contracts draw from the named mountains open, the new ones among them once open.

**Should the three have their own?** Not this round, and the reason is a shared one:
- Appending a mission lengthens the rotation (`MISSIONS`, shuffled inside bands by `cycleOrder` and read as
  `cursor % MISSIONS.length`), so every save's next missions would reorder and the economy and career bars would move with
  them: the owner's call, as a shared change.
- Each mountain's mechanic already has its goals and pay: its board's set pieces (the Horseshoe held on the glaze, the
  Great Geo soared, the Roof Run stomped), each a star of 10 gifts and the steps to its set.
- What they would ask (time on the glaze, a flight in a column, roofs ridden) is in no `RunSummary` field; the director
  could count each from the sim's events in the game layer, so it is a small job once the rotation's change is accepted.

Universal missions that a new mountain cannot serve are met elsewhere and none is ever offered for one place (the time
missions count only on a course of the five's length; there is no snowman, sky gate or rail to grind on the three).

## 5. The title's key art

**Gablefall, before.** The reel's three riders are drawn at 0.6, 0.72 and 0.84 of the pool as the app holds it (95
riders with the slow riders `slowriders.ts` adds; the JSON alone has 53, which is why the world builder's reading and mine
first disagreed). Through the shot's stretch (2,040 to 2,460 m, the Water Stairs) they rode the roofs 98, 0 and 0% of it
(`scripts/r9/wiring-reel.ts`), so the hero the reel picked was in the street often enough, a front filling a third of the
frame (the novice-5 frame DECISIONS 402 carried).

**After** (`keyart.ts`, 2c003a9): a shot may name where in its pool its reel draws (`TitleShot.field`, `reelField`);
Gablefall's riders are at 0.6, 0.63 and 0.66 (Freya-55, Nico Powders, Suki Ember: 95 to 97% of the stretch on the roofs,
among neighbours who are too, so a pool generated again is unlikely to tip it), and the stretch starts at 2,120 m (to
2,480), past the stage's market square at the street's level: sampled over 20 s of the reel the hero is on the roofs 98%
of it from its first frame (from 2,040 it opened every loop on the square, 13% of the reel, then 83% on the roofs). The
field is the mountain's, so mid-1, mid-50, mid-100 and novice-5 show the same: the rider on a roof's ridge, the roofs
stepping down, the street's canyon to the right, the viaduct and the far town across the valley. `tests/wiring.test.ts`
replays the three and holds each at 90% or more on the roofs. The five's fields are as they were; no reel draws The
Hollow King before his duel (none does in today's pools; the rule keeps it so).

**All eight, looked at on a desk and a phone at mid-1, mid-50 and mid-100** (`shots/r9/wiring/title/`, `&m=<i>` opening a
shut mountain for the dev; each shot taken once the lens had settled behind its hero; the console clean on every one):
the five as they were; the Old Run's rider down the channel into the low sun with a ghost at its shoulder (on the phone
the spray of the hero's turn half covers it in the mid-1 frame); Gullhaven's soaring the Great Geo's column over the
cleft, the sea and the sun's path beyond; Gablefall's on the roofs.

**Seen, not changed:** the title reel loops back to its opening under a soft dip, and the lens glides back to the hero
over about half a second (`ui.titleCut`, the camera's own easing), so for a moment it stands far down the course from its
hero: on Gullhaven 260 m (a frame shot then shows the clifftop path and no rider). It is every mountain's, and Gullhaven's
loop is the shortest (about 6 s, its stretch 2,214 to 2,480 m at 40 m/s), so its players see it most. A snap of the lens on
the cut would be the five's titles too: for the feel pass. And before the replays are in (about the first second) the
title stands on its shot's first metre at the safe line, on Gablefall now the street between the rows (from 2,040 it
was the square).

**Words on a new mountain's title** (my count by the bar's rule, visible tokens with a letter or a digit; the bar is 40 at
run 50, measured on the run-50 fixture's Ember): desk mid-50 Ember 43, Pinecrest 43; the Old Run 47, Gullhaven 49,
Gablefall 45 (their taglines are longer than the five's, and "Mirrored: beat its 3 riders" is 5 words where a five's
pair reads "Day Dusk Mirrored", 3); phone 41 and 45 to 47. Ember's 43 is no change of mine (DECISIONS 396 measured 39
with the round's own counter; mine may count what it does not, and I did not trace it): for the main lane's screen bars
to measure.

## 6. The Twelve, the league, the Daily and the Cup

Checked in the code and held in `tests/wiring.test.ts`; nothing reaches a new mountain where it should not.
- **The Twelve stay twelve**, every one at home on the five (homes 0 to 4); `nextDuel` with all eight open walks the
  five's ground only; a duel is never a mirror, a Long Night leg or a Trial (`app.ts duelHere`). The home riders are none
  of The Twelve (by name), and no page, ladder or showdown of The Twelve's reads `HOME_RIDERS` (`twelve.ts` imports
  `ROSTER` alone). The Twelve ride the new pools as ghosts, as they ride the five's; The Hollow King stays out of every
  field before his duel there too (`pickField`'s `withheld`), and now out of every title reel (section 5).
- **The league** is the Cup's week on the Cup's course, and **the Daily and the Cup** are built as one of the four looks
  (`mountains.ts BIOMES`): none to 2040 is a new mountain (every third day and week of each year checked). The day's
  contracts draw from the named mountains open, the new ones among them once open, as DECISIONS 392 meant.
- **Rival stickers** for The Twelve on the new pages are records beaten to the line, not duels (section 3).
- **Found, not changed (for the main lane):** Gablefall's home rider Wren Slater has the key of The Twelve's Old Wren,
  `'wren'` (`bot/roster.ts`). Today it is harmless: `riderByKey('wren')` returns Wren Slater (the map's later entry), but
  only `readTwelve` reads it, and only to know the key; a board's riders are kept per mountain (Old Wren's star is on
  Pinecrest's board, Wren Slater's on Gablefall's); the album marks a home rider's sticker as one. A new key would change
  `pool.ts`'s chaos seed for her (it hashes the key's length), so Gablefall's pool would be generated again; left as it
  is.

## 7. Photo mode and Save Clip on the three

Opened once more on the merged build, as a player opens them (`scripts/r9/wiring-photo.js`, desk, mid-50, frames under
`shots/r9/wiring/photo/`): on each of the Old Run (held at 2,330 m, the Horseshoe's lead), Gullhaven (2,150 m, the
Great Geo's shelf) and Gablefall (2,200 m, the Water Stairs), P paused the run, the pause sheet's Photo opened photo mode
(the HUD gone, its bar with Lens, Tilt, Grid, Focus, First Frame, With Run Card and Save Photo), a drag turned the lens,
Escape left it for the pause sheet; let go near the line the run finished; on the results Details' Save Clip started the
clip (the reel recording, "Recording" and Cancel), and Cancel dropped it back to the results before anything was saved.
The console was clean on all three. (The clip replays the run's record, and the script had moved the sled, which no
record holds: its reel ended at 225 m on Gablefall. A staged run's clip is not its run; a ridden one's is.)

## 8. For the main lane

### To decide

1. **The hours' pages** (16, 23 and 29), each beside what the page held. A save already past one is told it once, a run
   at a time, the lowest page first, kicker "New on Rider Rank 16". Telling all owed at once, or on the title's
   Progress door as a "New", are the alternatives; I kept the round's pace (one page a run).
2. **The mirror's way**: all three home riders beaten to the line, and only that (no Almanac page for the new mirrors). A
   rider's star opens on a mountain's fourth ride, so a mirror cannot open sooner than the fourth run there.
3. **The title's words** on a new mountain: "Mirrored: beat its 3 riders" is 5 words where the five's pair reads 3 at run
   50; a new mountain's title at run 50 counts 45 to 49 by my count (section 5). Shorter ("Mirrored: beat its riders")
   or only on the board are the options.
4. **Missions for the three**: none this round, since one appended reorders every save's rotation (section 4). Yes or
   no for a later round.
5. **The key collision** `'wren'` (section 6): leave it, or give Wren Slater a key of her own with Gablefall's pool
   generated again.
6. **The Gablefall reel's stretch** now starts at 2,120 m, 80 m past the world builder's 2,040 (section 5); its light
   (2,300) and lens are the world builder's.
7. **The title's lens gliding back at each loop** (section 5): the feel pass.

### Shared constants and rules: nothing shared changed

The five's courses, seeds, pools and records are byte for byte (`tests/five.test.ts` at every commit); the fairness
suite's `EVERY` promises are untouched; no decided rule moved. The Old Run's slope is its own `BIOME_PARAMS` row (the five's
rows untouched) and its pool the only one generated. `MISSIONS` is untouched (so no save's rotation moves).

## 9. Only scripts have seen

- Every figure in section 2 is the sim's, ridden by the lab's pilots, the clumsy pilot, the bot and the career harness.
  Nobody has ridden the Old Run since its grade changed; a get-up there at 14.4 m/s has not been felt.
- The hours told on the results, the mirrors opened, the board's line and the title's line were seen in staged frames:
  runs started by script and the sled set near the line (finishing in about 5 s), and the Old Run's home riders written
  into the page's save as beaten. Nobody has beaten a home rider to the line and seen the mirror open.
- The Great Geo's flight frame (section 3) has been taken by no run anyone has looked at: its timing is the code's, read
  against the flights' measured lengths.
- The album's new stickers and pages: counted by the tests, not opened in the album in a browser.
- The key art: frames of a desk and a phone, 1280 by 720 and 390 by 844, headless; the reel sampled over 20 s by script.
  Not judged by a critic.
- Photo mode and Save Clip: opened, turned, recorded and cancelled by script; no photo or clip saved and looked at.

**The suites:** `tsc` clean and `tests/five.test.ts` green at every commit; the full suite in the heavy slot at 96e066e
(`shots/r9/wiring/full-suite.txt`, 163 s): **119 files, 2,161 tests, all passed**. The changed screens checked against
the web interface guidelines: the lock glyph is aria-hidden, the counts are numerals with their word, nothing drawn has a
straight quote, no transition, the line wraps with its row on a phone (seen at 390 px, the hour pair and the line on one
row); nothing to fix.

## 10. Every hunk in a shared file

- `src/game/app.ts`: the `homeRiders` and `reelField` imports (2 lines); `setAttractField`'s pick through `reelField` with
  `withheldRiders` (the comment and one line); the title's mountain cards' `...this.mirrorRidersOf(m.id)` (2 lines);
  `mirrorRidersOf` (a method of 7 lines, beside `mirrorOpenHere`).
- `src/ui/contract.ts`: `MountainCard.mirrorRiders?` (4 lines).
- `src/ui/title.ts` (the polish lane's screen): in `how()`, an `else` beside the mirror toggle that adds `mirrorWay`
  (3 lines); `mirrorWayText` and `mirrorWay`, functions of their own before `MEDAL` (19 lines).
- `src/ui/rooms.ts`: `masteryBoard`'s Home Riders section gains `boardMirror(c)` (one line changed); `boardMirror`, a
  function of its own (8 lines).
- `src/ui/screens.css`: `.gs9-how-way` and its icon, after `.gs9-how-best` (17 lines).
- `src/game/save.ts`, `src/game/spineview.ts`, `src/ui/ui.ts`: untouched. (`RankSave.told` is in `spinesave.ts`, read
  by `readRank`.)
- Others of mine, not on the shared list: `almanac.ts`, `rank.ts`, `spinesave.ts`, `album.ts`, `albumframes.ts`,
  `twelve.ts` (the pools for `riderTimeOn`), `keyart.ts`, `src/sim/mountains.ts` (the Old Run's row), its pool,
  `tests/hours.test.ts` (eight hours, not five), `tests/wiring.test.ts` (new), `scripts/r9/wiring-*.{ts,js}` (new).

## 11. Text for ART.md and DECISIONS

### ART.md 10 (the title), after the hour and the mirror

> A new mountain's mirror opens when its three home riders are beaten to the line. Until then, where the Mirrored toggle
> would stand, a quiet line with a lock says the way in five words at most ("Mirrored: beat its 3 riders", then "1 rider
> to beat"): words, not a control. Its board says it in full under its Home Riders.

### ART.md 15 (each new mountain's key art)

> Gablefall's title reel rides the roofs of the Water Stairs from 2,120 m, its three riders drawn from the part of the
> pool that rides the roofs there, so the hero is on a ridge with the roofs stepping down and the viaduct beyond, never
> in the street between the fronts.

### DECISIONS

403. **The three new mountains wired** (`r9-wiring`, d020444 to its last commit; `notes/r9-wiring.md`; frames under
    `shots/r9/wiring/`; milestone 3's M3).
    - *Their hours on the Almanac:* Gablefall at Evensong on page 16, the Old Run by Lamplight on 23, Gullhaven at Moonrise
      on 29, each beside the charm or gifts the page held and between the five's hours as its mountain opens between
      theirs. Never silent: a save past the page is told the hour on its next results, one a run ("New on Rider Rank
      16"), and it opens only once told (`RankSave.told`). mid-5 owes none; mid-50 two; mid-100 all three.
    - *Their mirrors:* each opens when its three home riders are beaten to the line, told on that run's results ("The
      Old Run's riders beaten"); said on its board under the Home Riders and on the title where the toggle stands
      ("Mirrored: beat its 3 riders"). The five's as they were.
    - *The Old Run's grade:* `BIOME_PARAMS.oldrun.slope` 0.17 to 0.28; a get-up's push 11.1 to 14.4 m/s; its pool
      generated again (48 of 49 records the same; Lotte Bell 99.9 to 97.4 s); its first run still laid round 92 s; the
      lab's bar every line met as before; the clumsy pilot 147.6 to 143.8 s and 0.83 to 0.70 falls a run.
    - *The album:* 212, then 266 as the three registered, now 311; each new page 33, with The Twelve's records there and
      its own riders'; a save keeps every sticker; the Great Geo's frame in its flight.
    - *The key art:* Gablefall's reel rides the roofs (its riders drawn where the pool rides them, its stretch from
      2,120 m); all eight looked at on a desk and a phone at mid-1, mid-50 and mid-100.
    - *Kept off the new mountains:* The Twelve's duels, the Daily, the Cup, the league and the missions, held by
      `tests/wiring.test.ts`. No mission of their own this round (one would reorder every save's rotation).
    - *Found:* Gablefall's Wren Slater shares Old Wren's key; harmless today, left.
    - *Only scripts have seen it:* the hours told, the mirrors opened, the key art, photo mode and Save Clip, all on
      staged runs and fixtures.
