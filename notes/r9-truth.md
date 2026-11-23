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

**The release does not grow.** Built twice in the heavy slot with `npx vite build`: `round-9` as it was (aba7931,
extracted to `dist/r9-truth-basesrc`) and this branch. Both are 35 files and 63,260,913 bytes (60.33 MiB), and every
file's md5 is the same: the release is byte for byte what it was. No file in `dist` holds `gs-fixture`, `useFixture`,
`shiftSave` or `r9-fixture`. The first download is therefore unchanged too.

## 2. Captures

**Status:** desk and phone done: the title at all eleven stages (after 3 s, as a player meets it, and once the rivals
are in), with the Cup, the Trial (mid-100) and the Daily picked and a friend's challenge link (fresh, mid-20); the
results for a first finish, a crash, a duel won and lost, the Daily, the Cup, a Trial and the Long Night (between its
legs and at its end), each at the first view and Details; every garage shelf, the Almanac, the album, missions, medals,
the flame's calendar, The Twelve and settings at mid-1, 5, 20, 50, 100 and novice-50, with pause and photo mode in a
run; Escape and the pad's B on each; Run Again timed; the crawl of the title's doors at mid-50 and mid-5 (desk also
mid-100). Seen by me as well as counted: the frames named in sections 2 and 5; the rest only the script has read.

Where: frames `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/truth/<form>-<stage>-<screen>.png` (for example
`desk-mid-50-title.png`, `phone-mid-50-title-ready.png`, `desk-mid-20-results-duel-lost.png`,
`phone-mid-5-results-crash.png`, `desk-mid-50-garage-Hats.png`, `desk-mid-50-twelve.png`); the counts in
`shots/r9/truth/desk.json` and `phone.json` (one per form factor: every shot with its visible text chunks, its
controls and its `figures`, and the sheets' Escape and B, Run Again and the crawl); each part's raw output in
`shots/r9/truth/raw/`. Desk is 1280x720 at High, phone 390x844 DPR 2 at Medium, headless, on the dev server with the
fixtures, the origin loaded once before anything was shot. No console error or warning in any part.

**How it counts** (r9-truth.js `MEASURE`, r9-screenbars.ts): a word is a whitespace token with a letter or a digit
in a text node a reader can see (not `display:none` or hidden, not `.gs-sr`, no ancestor under 0.15 opacity, in the
viewport, not scrolled out of a clipping parent; on a sheet only the sheet's text). "+1", "/212" and "0:20.9" are a
word each; "·" is none. CSS-drawn text and the canvas are not counted. A control is a button, tab, link or input seen
the same way: its accessible name, whether it carries `gs-btn-primary`, whether its fill is the primary's vermillion
(a look-alike), and whether it shows no text (a lone icon). The dev server's mock platform offers rewarded ads (Double
Gifts, Revive, a midgame ad) that the published build never shows: they are left out of every count. A popover's
shot counts the title around it too; its own words are given apart. The phone's Details scroll, so only the part on
screen is counted there.

**The title** (words after 3 s, and once the rivals are in; then controls, primaries, lone icons, bare figures,
repeats, and whether "Finding rivals…" showed):

| title | run 1 | run 5 | run 20 | run 50 | run 100 |
|---|---|---|---|---|---|
| desk, mid: words | 111 (113) | 108 (110) | 118 (120) | 115 (117) | 119 (121) |
| desk, novice: words | 105 (107) | 109 (111) | 111 (113) | 120 (122) | 122 (124) |
| desk, mid: controls / primaries / lone icons / bare / repeats / loading | 16/1/1/6/4/yes | 17/1/1/9/3/yes | 20/1/1/10/3/yes | 20/1/1/10/3/yes | 20/1/1/10/2/yes |
| phone, mid: words | 61 (63) | 57 (57) | 58 (58) | 59 (57) | 74 (72) |
| phone, novice: words | 59 (59) | 61 (61) | 59 (59) | 66 (64) | 66 (64) |
| phone, mid: controls / primaries / lone icons / bare / repeats / loading | 14/1/0/3/2/yes | 14/1/0/4/1/yes | 18/1/1/5/2/yes | 17/1/0/5/2/yes | 18/1/1/5/1/yes |

The fresh title: 18 words on desk and 17 on phone, two controls (Ride, and Mute as a lone icon), no bare figure, no
repeat. A friend's challenge link keeps it at 18 ("Racing Elif-346's ghost 2:13.4 on Pinecrest", Accept) and adds one
line to a returning title. The phone shows about half the desk's words because its strip shows fewer cards and The
Twelve's card drops its line; it stacks the Daily's and the Cup's cards and the strip over the rider
(`phone-mid-50-title-ready.png`: the rider's head sits behind the two cards).

**The results** (first view; Details in brackets):

| results | desk words | desk controls | desk bare | phone words | phone controls | phone bare |
|---|---|---|---|---|---|---|
| first finish (fresh) | 79 (175) | 5 (9) | 9 (11) | 64 (68) | 5 | 6 |
| crash (mid-5) | 75 (113) | 7 | 7 | 53 (61) | 6 | 5 |
| duel won (mid-20) | 74 (207) | 5 (9) | 7 (13) | 51 (69) | 5 | 4 |
| duel lost (mid-20) | 68 (178) | 5 (9) | 7 (8) | 51 (64) | 5 | 4 |
| Long Night's end (mid-50) | 66 (166) | 5 (9) | 6 (5) | 51 (68) | 5 | 3 |
| Daily (mid-20) | 60 (127) | 5 (9) | 7 (4) | 47 (63) | 5 | 4 |
| Trial (mid-100) | 60 (155) | 5 (9) | 7 (5) | 50 (64) | 5 | 4 |
| Cup (mid-50) | 57 (134) | 5 (9) | 6 (4) | 44 (62) | 5 | 3 |
| between the Long Night's legs | 27 | 0 | 0 | 27 | 0 | 0 |

Every results first view has one primary, no look-alike, no repeat (Details: 2 to 8) and one lone icon, the camera
("Photo mode"). The crash (desk and phone) also offers Ride It on the card of the mountain the run opened: a second
action.

**The sheets and popovers at mid-50** (the other stages within a few words; every shot is in the table in section 8):

| surface | desk words | phone words | primaries | lone icons |
|---|---|---|---|---|
| garage, by shelf | 53 to 76 | 37 to 69 | 0 (all owned) | Close |
| Almanac | 134 | 70 | 0 | Close |
| Spirit Album | 174 | 52 | 0 | Close |
| missions popover (its own words) | 25 | 25 | 1 (the title's Ride) | |
| medals popover | 63 | 63 | | |
| flame calendar popover | 47 | 47 | | |
| The Twelve popover | 234 | 183 | | Close the ladder |
| settings | 21 | 20 | 0 | Close |
| pause | 52 | 48 | 1 (Resume) | none |
| photo mode | 24 | 24 | 1 | grid, focus, back to the first frame |

## 3. Escape and the pad's B

The same at every stage, desk and phone. Each surface opened as the keyboard and the pad open it (its opener focused,
then pressed):

| surface | Escape | the pad's B | focus after B |
|---|---|---|---|
| garage (sheet) | stays open (focus stays on Close) | closes | back to Garage |
| Almanac, Spirit Album (the books sheet) | stays open | closes | back to its card |
| settings (sheet) | stays open | closes | back to Settings |
| missions, medals, flame calendar, The Twelve (title popovers) | stays open | **stays open** | never left the opener: focus does not enter the popover |
| pause card (in a run) | stays open (focus on Resume) | closes, the run goes on | the game |
| photo mode (from pause) | closes, back to pause (Resume) | closes, back to pause (Resume) | Resume |

Why: Escape is unbound on purpose (`src/ui/menus.ts:14`: "Escape is deliberately not bound: on CrazyGames it exits
fullscreen"); only photo mode (`photo.ts:381`) and riding home (`app.ts:702`) read it. The pad's B is "back" only on
a modal surface (`ui.ts` padMenu passes `modal = menu !== null`; `padnav.ts` then clicks the close button or Resume);
the title's popovers are not modal to it, so B does nothing there. A tap outside closes a popover (`title.ts:95`).
(The first desk pass opened each surface with a bare click and so saw focus land on the page's body after B; the
sheet gives focus back to what opened it, and the table above is from the pass that focused the opener first.)

## 4. The bars and today's figures

Scripts: `npx tsx scripts/playtest/r9-screenbars.ts` (the browser bars, read from the captures; it exits 0) and
`npx vitest run tests/r9screens.test.ts` (the detectors held to known cases, and two copy bars as `it.fails`).

| bar (section 2) | today, desk | today, phone |
|---|---|---|
| the title at run 50: at most 40 words | mid-50 115 (117 with the rivals in), novice-50 120 (122): fails by 75 to 82 | mid-50 59 (57), novice-50 66 (64): fails by 17 to 26 |
| the results' first view: at most 35 words | 57 (the Cup) to 79 (a first finish): fails by 22 to 44 | 44 (the Cup) to 64 (a first finish): fails by 9 to 29 |
| a fresh title no worse than today | 18 words, 2 controls (the baseline) | 17 words, 2 controls |
| one primary a screen | every title, results and the pause card: 1; garage, books, settings: 0 | the same |
| nothing else styled like one | no look-alike on any shot | the same |
| no lone icons | fails on every screen: Mute (fresh title), the strip's arrow (returning titles), the camera (every results), Close (every sheet), Close the ladder, photo mode's buttons | the same, less the strip's arrow; a garage tile half scrolled out reads as one |
| plain figures | returning title 6 to 10 bare; results first view 6 to 9; fresh title 0 | returning title 3 to 5; results first view 3 to 6 |
| said once | returning title 2 to 4 repeats; results first view 0, Details 2 to 8 | returning title 1 to 3; results first view 0 (the Long Night's 1) |
| never loading | "Finding rivals…" on the Cup and the Daily at 3 s on every returning title | the same |
| nothing lost (two taps; pointer, keyboard, pad; named) | mid-50: 16 of 20 found (Trials only as an Almanac page still to come); contracts and the league never shown (at mid-100 the league is a news line that week); photo and clips only from a run; mastery and the Long Night behind doors that do not name them; every door in the Tab order and the pad's reach | the same |
| as fast as today: Run Again to riding under 2 s | warm presses 101, 183, 213, 235, 395 ms (cold 239); 5,134 ms behind the mock platform's midgame ad | warm presses 78, 183, 191, 253 ms (cold 148); one 5,187 ms press was the mock platform's midgame ad |
| copy (vitest, `it.fails`) | 19 of 50 Almanac pages are named with a bare "+N"; 33 of 33 missions, once met, are offered as "done before, so again" | |

Round 8 recorded Run Again to riding at about 550 ms; today's warm presses are under that on both.

**The detectors**, what they catch and what they cannot:
- *Bare figures*: a signed figure with no unit after it ("+1", "A new sled +1", "+110"); a fraction in a box with no
  word ("14 /212"); "Page N" and "Chapter page N"; "Rank N of M"; "N to go" with no unit; a lone number in a box with
  no word (the flame's "13", the wallet's "90": their words are only for a screen reader). Not caught: jargon that is
  a word ("XP"), a figure explained elsewhere on the screen, figures drawn by CSS or the canvas. A clock time is not
  counted bare (its form says it is a time).
- *Repeats*: a known name (a mountain, one of The Twelve) in two boxes; a time or a figure of three or more digits in
  two boxes; three words in a row in two boxes (a figure is one token; a list's field labels such as "Best" and
  "Rank" do not count). A box is the control a text is on, else its list item, paragraph or card. Not caught: the
  same thing said in other words or by a picture (a rider's portrait and the word "Duel"), or once on a sheet and
  once under it.
- *Loading*: "Finding rivals", "loading", "generating", "please wait", or a short line ending in an ellipsis.
- *Nothing lost*: the crawl opens each title control once by its focus key (the Cup's and the Daily's cards once
  their rivals are in), reads what opened and each of its tabs, walks the Tab order, and walks the pad from its first
  press in all four directions, breadth first. A system counts as reached when its words (r9-screenbars.ts `SYSTEMS`)
  are on the title (0 taps), behind a title control (1), or behind a tab of that (2); "named" is whether that door's
  accessible name says the system.

**Nothing lost at mid-50** (desk and phone agree):

| system | taps | through | keyboard and pad | named |
|---|---|---|---|---|
| rank and Almanac | 0 | the Rider Rank card | yes | yes |
| album | 0 | the sticker count | yes | yes |
| flame | 0 | the flame | yes | yes |
| gifts | 0 by sight, as a figure with a gift icon | the stats pill (not a control); the word only for a screen reader | - | not on screen |
| bests | 0 | the mountain cards and the pill | yes | yes |
| The Twelve | 0 | its card | yes | yes |
| the Cup | 0 | its card (no tap until its rivals are in) | yes | yes |
| the league | **never shown** | a news line in a week the division moved; a line in the results' Details | - | - |
| Trials | not open at mid-50 (a future Almanac page); at mid-100 1 tap (the Cup's card) then the Trial switch | | yes | yes |
| the Daily | 0 | its card | yes | yes |
| contracts | **never shown** | an Almanac page's name; "Contracts met" in Details | - | - |
| missions | 0 | Missions | yes | yes |
| medals | 0 | Medals, the cards | yes | yes |
| mastery | 1 | Medals (its stars) | yes | no |
| the Long Night | 1 | the Almanac (its Ride) | yes | no |
| hours | 0 | the Day / other hour pick | yes | yes |
| mirrors | 0 | Mirrored | yes | yes |
| photo | from a run only (pause, the results' camera) | | | |
| clips | from the results only (Save Clip) | | | |
| the garage | 0 | Garage | yes | yes |

The title's Tab order is 21 to 22 stops; the pad reaches every title control from its first press (80 to 88 presses).

## 5. Section 1 "The screens", line by line

Each line of the review against the captures (desk and phone) and the code; the frames are under `shots/r9/truth/`.

**What is already strong**
- *A first visit's title: the logo, one line, one big Ride, and 18 words in all.* **Right.** `desk-fresh-title.png`:
  18 words (17 on phone), two controls. Missed: the second control, Mute, is a lone icon.
- *The results' hero: the place, the rider in a pose before a cheering crowd, and one primary button.* **Right** on
  every finish (one primary, no look-alike, desk and phone). Missed: on the Trial's results on desk the rider stands
  behind the right column (`desk-mid-100-results-trial.png`, Sakura; the run was pinned to the line, so a person
  should check a ridden one), and the camera beside Home is a lone icon on every results.
- *The game's type and its vermillion primary.* **Right:** no other control on any shot has the primary's fill.

**What holds them back**
1. *Every system the game has gained has a seat on the title; the returning title is ten panels and about 100 words.*
   **Right, and understated.** On desk the returning title is 105 to 124 words at every stage from run 1 (mid-1 113
   with its rivals in, mid-50 117, novice-50 122, novice-100 124) with 16 to 20 controls; on phone 57 to 74 words and 14 to 18 controls. Run 1
   already carries the Almanac card, the album count, The Twelve's card, the Cup's and the Daily's cards and the menu
   bar; from run 20 the hour pick and Mirrored add a row under Ride. About twelve panels at run 50
   (`desk-mid-50-title-ready.png`). *Hours, mirrors, Trials, contracts, the league and the Long Night add more as
   they open:* **half wrong.** Hours and mirrors add that row; Trials add a Cup/Trial switch only while the Cup is
   picked (`desk-mid-100-title-trial.png`); the league reaches the title only as a news line in a week the division
   moved (`desk-mid-100-title.png`: "Up to division 3 of the Cup."); contracts and the Long Night never do. *The phone
   stacks all of it over the rider:* **right** (`phone-mid-50-title-ready.png`). *A scene left a gap in the middle:*
   **right** on desk.
2. *The same thing said twice.* **Right**; all three reproduce where they apply: "Duel Pip Thistle" on Ride and "Next
   of The Twelve: Pip Thistle" (mid-20; Suki Ember at mid-50); the unlock hint and the locked card (mid-1:
   "Frostfang Glacier" twice); the best in the pill and on the card (mid-50: 1:52.2). **Missed:** the picked mountain
   is named three times when the duel is there (the heading, its card, The Twelve's card: "Ember Peak" x3 at mid-50;
   "Pinecrest" up to five times on novice-1), and Details repeats the first view's lines ("Your first finish here."
   twice).
3. *Figures without words.* **Right, and wider.** At run 50 the desk title shows ten: the flame's "13", the wallet's
   "90" (the word only for a screen reader), "Page 26", "1,281 to go", "115 /212", "Rank N of 87" on the cards, the
   missions badge. "A new sled +1" is fmt.ts `rewardsLine`: 19 of 50 Almanac pages are named that way (novice-50:
   "Lanternfall, open to ride +1"). "Page 2/3" on the results' cards: **right** ("Page 1", "Chapter page 9").
   **Missed:** every results first view has 3 to 9 bare figures: the XP chips' "+110", "+90", "+300", the gifts' "+68"
   beside an icon, "92" and "to go".
4. *Loading shown as content: "Finding rivals…" three seconds after the title opens, on desk and phone.* **Right**
   at every returning stage on both. **Missed:** until then the Cup's and the Daily's cards take no tap (the crawl has
   to wait for them), and when the rivals arrive the line becomes "Fresh rivals", which is status too.
5. *The results' right column is a form, about 70 words and 14 figures.* **Right in kind:** 57 to 79 words on the desk
   first view (44 to 64 on phone), 5 controls. *Two calls to action compete: Ride It on the unlock card, and the
   primary:* **overstated.** Ride It is a soft button, not the primary's fill (no look-alike measured), and it is only
   there on a run that opens a mountain (`phone-mid-5-results-crash.png`); but on that run it is a second action, and
   the one a player most wants.
6. *Copy that does not parse.* **Right, and not a one-off.** "Finish the mission / Pass a ghost: done before, so
   again" on a fresh save's first finish (`desk-fresh-results-first.png`), "Bank a 10,000 point combo: done before,
   so again" after both mid-20 duels, "Ride a wall: done before, so again" on the crash, "Finish a mountain: done
   before, so again" on a fresh save's second run. Source: `src/game/goals.ts:128`, for every mission whose best
   already meets its target (33 of 33 missions: the vitest bar). The race line floats apart from the place: **right**
   ("89.2 s clear of Vida Flip"). **Missed:** after a lost duel the one button is "Finish the mission", not the
   rematch, while the chip says "Pip Thistle held you off by 32.1 s." (`desk-mid-20-results-duel-lost.png`).
7. *No one design language: about 15,000 lines of CSS in 11 sheets, style.css 9,658; results' render() a chain of
   conditional rows.* **Right on the numbers:** 15,105 lines in 11 sheets, style.css 9,658 (`wc -l src/ui/*.css`);
   `results.ts` render() runs from line 529 to about 760 with 28 conditionals and 10 mentions of the phone. Whether it
   reads as one family is a critic's call.
8. *To check: Escape did not close the garage.* **Escape closes no sheet and no popover, on purpose** (`menus.ts:14`,
   for CrazyGames' fullscreen); it closes only photo mode and riding home. The pad's B closes every sheet and the
   pause card and gives focus back to the opener, but **closes none of the title's four popovers**. Section 3.

**What the review missed**
- **The day's contracts and the Cup's league are never shown.** The models are built (`spineview.ts` puts
  `contracts`, `form` and `league` with its nineteen rows in `TitleSpine`, and `today` and `formNext` in the results'
  spine), but no UI file renders them (`src/ui`: only `results.ts:1263-1266` writes "Contracts met: ...", "Your form:
  ..." and "Cup league: 1st in division 5." into Details' notes). A player never sees what today's three contracts
  ask, nor the league's table. "Nothing lost" fails for both, and not only for want of a door.
- Lone icons on every screen: Mute, the strip's arrows, the camera on the results, Close on every sheet, Close the
  ladder, and photo mode's grid, focus and back.
- The garage, the books and settings have no primary (at mid-50 every shelf is owned); the bar asks for one a screen.
- The title's popovers take no focus when opened and no Escape or B to close.
- The Run Again button names a page's "76 to go" with no unit ("Run Again: Page 7: Charm: Kite String: 76 to go").
- The dev server shows rewarded-ad offers (Double Gifts, Revive, a midgame ad between runs) that the published build
  does not: a review on the dev server must leave them out, as these counts do.

## 6. What the main lane must decide

- **Escape.** U4 says Escape closes every sheet; `menus.ts:14` leaves it unbound so a CrazyGames player's Escape only
  leaves fullscreen. Decide whether sheets close on Escape as well (in fullscreen one press would do both), or the bar
  reads "B, a tap outside and a visible Close".
- **Contracts and the league.** Their screens do not exist, only their models. U1's "events" door needs a contracts
  list and a league table to be built, not moved; or cut them and say so.
- **What a lone icon is.** The strip's arrows, Close, Mute and the results' camera are conventional icon buttons named
  for a screen reader. The bar as written fails every screen on them: keep it strict, or name the allowed few.
- **A primary on a sheet with nothing to do** (the garage when all is owned, the books, settings): none, or a "Back"
  or "Ride" as the one.
- **Photo and clips are reached from a run.** "Two taps from the title" cannot hold for them without a door that makes
  no sense; judge them from pause and the results.
- **The word bars on phone and desk.** The phone shows half the desk's words (59 at mid-50 against 117), so the 40 and
  35 are much nearer on phone; decide whether each holds on both.
- **The Trial's results framing** (the rider behind the right column on desk) for a person to check on a ridden run.

## 7. How to re-run everything

- **Fixtures** (heavy slot, 50 s): `npx tsx scripts/playtest/r9-fixtures.ts` (`--runs`, `--pilots`, `--out`). Their
  test: `npx vitest run tests/devsave.test.ts`.
- **A fixture in the game:** `npx vite --port 4900 --host 127.0.0.1 --strictPort`, then
  `http://127.0.0.1:4900/?debug&save=mid-50` (any name in `scripts/playtest/fixtures`; `&tier=high`, `&autoride=1`,
  `&m=2` and the other dev switches as usual). Dev server only: a build or a preview ignores it.
- **Captures** (one browser, through the slot): `bash scripts/playtest/r9-truth.sh <desk|phone> <name>="<config>" ...`,
  a config being `{ part: 'titles'|'sheets'|'results'|'again'|'crawl', stages: [...], scenario, link, linkStages, n }`
  (r9-truth.js's header says what each part shoots). Raw JSON lands in `shots/r9/truth/raw/<form>-<name>.json`, the
  frames in `shots/r9/truth/<form>-<stage>-<screen>.png`.
- **The bars:** `npx tsx scripts/playtest/r9-screenbars.ts` merges the raw files into `shots/r9/truth/desk.json` and
  `phone.json` (each shot with its `figures`: words, primaries, look-alikes, lone icons, bare figures, repeats,
  loading) and prints every bar with today's figure; it exits 0. The pure bars: `npx vitest run tests/r9screens.test.ts`.
- **Counting a prototype the same way:** r9-truth.js's `MEASURE` runs on any page (`page.evaluate(MEASURE, { sel:
  '<root>' })`); without the game it counts everything under `.gs-ui` or the body. Its output goes to
  r9-screenbars.ts's `shotFigures`.

## 8. Every shot, counted

Printed by `npx tsx scripts/playtest/r9-screenbars.ts --md` (words; controls; primaries; look-alikes; lone icons; bare
figures; repeats; loading lines).

**desk** (162 shots)

| shot | words | controls | primaries | look-alikes | lone icons | bare figures | repeats | loading |
|---|---|---|---|---|---|---|---|---|
| mid-5-results-crash | 75 | 7 | 1 | 0 | 1 | 7 | 0 | 0 |
| mid-5-results-crash-details | 113 | 9 | 1 | 0 | 1 | 3 | 1 | 0 |
| mid-50-results-cup | 57 | 5 | 1 | 0 | 1 | 6 | 0 | 0 |
| mid-50-results-cup-details | 134 | 9 | 1 | 0 | 1 | 4 | 2 | 0 |
| mid-20-results-daily | 60 | 5 | 1 | 0 | 1 | 7 | 0 | 0 |
| mid-20-results-daily-details | 127 | 9 | 1 | 0 | 1 | 4 | 3 | 0 |
| mid-20-results-duel-lost | 68 | 5 | 1 | 0 | 1 | 7 | 0 | 0 |
| mid-20-results-duel-lost-details | 178 | 9 | 1 | 0 | 1 | 8 | 6 | 0 |
| mid-20-results-duel-won | 74 | 5 | 1 | 0 | 1 | 7 | 0 | 0 |
| mid-20-results-duel-won-details | 207 | 9 | 1 | 0 | 1 | 13 | 8 | 0 |
| fresh-results-first | 79 | 5 | 1 | 0 | 1 | 9 | 0 | 0 |
| fresh-results-first-details | 175 | 9 | 1 | 0 | 1 | 11 | 7 | 0 |
| mid-50-night-between | 27 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mid-50-results-night | 66 | 5 | 1 | 0 | 1 | 6 | 0 | 0 |
| mid-50-results-night-details | 166 | 9 | 1 | 0 | 1 | 5 | 6 | 0 |
| mid-100-results-trial | 60 | 5 | 1 | 0 | 1 | 7 | 0 | 0 |
| mid-100-results-trial-details | 155 | 9 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-1-garage | 70 | 14 | 0 | 0 | 1 | 6 | 0 | 0 |
| mid-1-garage-Sleds | 70 | 14 | 0 | 0 | 1 | 6 | 0 | 0 |
| mid-1-garage-Paint | 54 | 16 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-1-garage-Scarves | 54 | 15 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-1-garage-Hats | 53 | 15 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-1-garage-Trails | 47 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-1-garage-Sounds | 51 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-1-garage-Lanterns | 31 | 8 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-1-almanac | 137 | 3 | 0 | 0 | 1 | 3 | 6 | 0 |
| mid-1-missions | 127 (14 in the popover) | 17 | 1 | 0 | 2 | 6 | 4 | 0 |
| mid-1-medals | 161 (48 in the popover) | 17 | 1 | 0 | 2 | 7 | 6 | 0 |
| mid-1-flame | 161 (48 in the popover) | 17 | 1 | 0 | 2 | 6 | 5 | 0 |
| mid-1-twelve | 337 (224 in the popover) | 18 | 1 | 0 | 3 | 6 | 11 | 0 |
| mid-1-settings | 21 | 10 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-1-pause | 41 | 12 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-1-photo | 24 | 8 | 1 | 0 | 3 | 0 | 0 | 0 |
| mid-100-garage | 61 | 14 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-100-garage-Sleds | 61 | 14 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-100-garage-Paint | 57 | 17 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-100-garage-Scarves | 62 | 17 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-100-garage-Hats | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-100-garage-Trails | 57 | 16 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-100-garage-Sounds | 53 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-100-garage-Lanterns | 76 | 8 | 0 | 0 | 1 | 1 | 6 | 0 |
| mid-100-almanac | 150 | 7 | 0 | 0 | 1 | 1 | 7 | 0 |
| mid-100-album | 174 | 3 | 0 | 0 | 1 | 0 | 8 | 0 |
| mid-100-missions | 150 (29 in the popover) | 21 | 1 | 0 | 2 | 10 | 3 | 0 |
| mid-100-medals | 191 (70 in the popover) | 21 | 1 | 0 | 2 | 15 | 6 | 0 |
| mid-100-flame | 168 (47 in the popover) | 21 | 1 | 0 | 2 | 10 | 3 | 0 |
| mid-100-twelve | 350 (229 in the popover) | 22 | 1 | 0 | 3 | 10 | 11 | 0 |
| mid-100-settings | 21 | 10 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-100-pause | 56 | 12 | 1 | 0 | 0 | 3 | 1 | 0 |
| mid-100-photo | 24 | 8 | 1 | 0 | 3 | 0 | 0 | 0 |
| mid-20-garage | 67 | 14 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-20-garage-Sleds | 67 | 14 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-20-garage-Paint | 57 | 17 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-20-garage-Scarves | 59 | 16 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-20-garage-Hats | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-20-garage-Trails | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-20-garage-Sounds | 53 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-20-garage-Lanterns | 66 | 8 | 0 | 0 | 1 | 1 | 3 | 0 |
| mid-20-almanac | 153 | 4 | 0 | 0 | 1 | 6 | 5 | 0 |
| mid-20-album | 174 | 3 | 0 | 0 | 1 | 0 | 8 | 0 |
| mid-20-missions | 146 (26 in the popover) | 21 | 1 | 0 | 2 | 10 | 4 | 0 |
| mid-20-medals | 180 (60 in the popover) | 21 | 1 | 0 | 2 | 14 | 6 | 0 |
| mid-20-flame | 168 (48 in the popover) | 21 | 1 | 0 | 2 | 10 | 4 | 0 |
| mid-20-twelve | 349 (229 in the popover) | 22 | 1 | 0 | 3 | 10 | 11 | 0 |
| mid-20-settings | 21 | 10 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-20-pause | 53 | 12 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-20-photo | 24 | 8 | 1 | 0 | 3 | 0 | 0 | 0 |
| mid-5-garage | 67 | 14 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-5-garage-Sleds | 67 | 14 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-5-garage-Paint | 53 | 16 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-5-garage-Scarves | 55 | 15 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-5-garage-Hats | 51 | 15 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-5-garage-Trails | 49 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-5-garage-Sounds | 51 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-5-garage-Lanterns | 55 | 8 | 0 | 0 | 1 | 1 | 2 | 0 |
| mid-5-almanac | 138 | 3 | 0 | 0 | 1 | 3 | 6 | 0 |
| mid-5-album | 255 | 3 | 0 | 0 | 1 | 0 | 10 | 0 |
| mid-5-missions | 137 (27 in the popover) | 18 | 1 | 0 | 2 | 9 | 4 | 0 |
| mid-5-medals | 166 (56 in the popover) | 18 | 1 | 0 | 2 | 12 | 5 | 0 |
| mid-5-flame | 158 (48 in the popover) | 18 | 1 | 0 | 2 | 9 | 4 | 0 |
| mid-5-twelve | 333 (223 in the popover) | 20 | 1 | 0 | 3 | 9 | 11 | 0 |
| mid-5-settings | 21 | 10 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-5-pause | 54 | 12 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-5-photo | 24 | 8 | 1 | 0 | 3 | 0 | 0 | 0 |
| mid-50-garage | 64 | 14 | 0 | 0 | 1 | 4 | 0 | 0 |
| mid-50-garage-Sleds | 64 | 14 | 0 | 0 | 1 | 4 | 0 | 0 |
| mid-50-garage-Paint | 57 | 17 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-50-garage-Scarves | 62 | 17 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-50-garage-Hats | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-50-garage-Trails | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-50-garage-Sounds | 53 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-50-garage-Lanterns | 76 | 8 | 0 | 0 | 1 | 1 | 4 | 0 |
| mid-50-almanac | 134 | 7 | 0 | 0 | 1 | 1 | 7 | 0 |
| mid-50-album | 174 | 3 | 0 | 0 | 1 | 0 | 8 | 0 |
| mid-50-missions | 142 (25 in the popover) | 21 | 1 | 0 | 2 | 10 | 4 | 0 |
| mid-50-medals | 180 (63 in the popover) | 21 | 1 | 0 | 2 | 14 | 7 | 0 |
| mid-50-flame | 164 (47 in the popover) | 21 | 1 | 0 | 2 | 10 | 4 | 0 |
| mid-50-twelve | 351 (234 in the popover) | 22 | 1 | 0 | 3 | 10 | 14 | 0 |
| mid-50-settings | 21 | 10 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-50-pause | 52 | 12 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-50-photo | 24 | 8 | 1 | 0 | 3 | 0 | 0 | 0 |
| novice-50-garage | 67 | 14 | 0 | 0 | 1 | 5 | 0 | 0 |
| novice-50-garage-Sleds | 67 | 14 | 0 | 0 | 1 | 5 | 0 | 0 |
| novice-50-garage-Paint | 57 | 17 | 0 | 0 | 1 | 1 | 1 | 0 |
| novice-50-garage-Scarves | 62 | 17 | 0 | 0 | 1 | 1 | 0 | 0 |
| novice-50-garage-Hats | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| novice-50-garage-Trails | 54 | 15 | 0 | 0 | 1 | 1 | 1 | 0 |
| novice-50-garage-Sounds | 53 | 14 | 0 | 0 | 1 | 1 | 1 | 0 |
| novice-50-garage-Lanterns | 66 | 8 | 0 | 0 | 1 | 1 | 4 | 0 |
| novice-50-almanac | 168 | 5 | 0 | 0 | 1 | 1 | 8 | 0 |
| novice-50-album | 213 | 3 | 0 | 0 | 1 | 0 | 8 | 0 |
| novice-50-missions | 153 (31 in the popover) | 21 | 1 | 0 | 2 | 10 | 4 | 0 |
| novice-50-medals | 181 (59 in the popover) | 21 | 1 | 0 | 2 | 13 | 8 | 0 |
| novice-50-flame | 169 (47 in the popover) | 21 | 1 | 0 | 2 | 10 | 4 | 0 |
| novice-50-twelve | 348 (226 in the popover) | 22 | 1 | 0 | 3 | 10 | 11 | 0 |
| novice-50-settings | 21 | 10 | 0 | 0 | 1 | 3 | 0 | 0 |
| novice-50-pause | 58 | 12 | 1 | 0 | 0 | 3 | 1 | 0 |
| novice-50-photo | 24 | 8 | 1 | 0 | 3 | 0 | 0 | 0 |
| fresh-title | 18 | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| mid-1-title | 111 | 16 | 1 | 0 | 1 | 6 | 4 | 1 |
| mid-1-title-ready | 113 | 16 | 1 | 0 | 1 | 6 | 4 | 0 |
| mid-1-title-cup | 111 | 16 | 1 | 0 | 1 | 6 | 2 | 0 |
| mid-1-title-daily | 110 | 16 | 1 | 0 | 1 | 6 | 3 | 0 |
| mid-5-title | 108 | 17 | 1 | 0 | 1 | 9 | 3 | 1 |
| mid-5-title-ready | 110 | 17 | 1 | 0 | 1 | 9 | 3 | 0 |
| mid-5-title-cup | 106 | 17 | 1 | 0 | 1 | 9 | 1 | 0 |
| mid-5-title-daily | 105 | 17 | 1 | 0 | 1 | 9 | 2 | 0 |
| mid-20-title | 118 | 20 | 1 | 0 | 1 | 10 | 3 | 1 |
| mid-20-title-ready | 120 | 20 | 1 | 0 | 1 | 10 | 3 | 0 |
| mid-20-title-cup | 117 | 17 | 1 | 0 | 1 | 10 | 1 | 0 |
| mid-20-title-daily | 116 | 17 | 1 | 0 | 1 | 10 | 2 | 0 |
| mid-50-title | 115 | 20 | 1 | 0 | 1 | 10 | 3 | 1 |
| mid-50-title-ready | 117 | 20 | 1 | 0 | 1 | 10 | 3 | 0 |
| mid-50-title-cup | 114 | 17 | 1 | 0 | 1 | 10 | 2 | 0 |
| mid-50-title-daily | 113 | 17 | 1 | 0 | 1 | 10 | 3 | 0 |
| mid-100-title | 119 | 20 | 1 | 0 | 1 | 10 | 2 | 1 |
| mid-100-title-ready | 121 | 20 | 1 | 0 | 1 | 10 | 2 | 0 |
| mid-100-title-cup | 118 | 19 | 1 | 0 | 1 | 10 | 0 | 0 |
| mid-100-title-trial | 119 | 19 | 1 | 0 | 1 | 10 | 2 | 0 |
| mid-100-title-daily | 115 | 17 | 1 | 0 | 1 | 10 | 1 | 0 |
| novice-1-title | 105 | 16 | 1 | 0 | 1 | 6 | 3 | 1 |
| novice-1-title-ready | 107 | 16 | 1 | 0 | 1 | 6 | 3 | 0 |
| novice-1-title-cup | 104 | 16 | 1 | 0 | 1 | 6 | 1 | 0 |
| novice-1-title-daily | 103 | 16 | 1 | 0 | 1 | 6 | 2 | 0 |
| novice-5-title | 109 | 17 | 1 | 0 | 1 | 9 | 3 | 1 |
| novice-5-title-ready | 111 | 17 | 1 | 0 | 1 | 9 | 3 | 0 |
| novice-5-title-cup | 109 | 17 | 1 | 0 | 1 | 9 | 1 | 0 |
| novice-5-title-daily | 108 | 17 | 1 | 0 | 1 | 9 | 2 | 0 |
| novice-20-title | 111 | 20 | 1 | 0 | 1 | 9 | 3 | 1 |
| novice-20-title-ready | 113 | 20 | 1 | 0 | 1 | 9 | 3 | 0 |
| novice-20-title-cup | 111 | 17 | 1 | 0 | 1 | 9 | 1 | 0 |
| novice-20-title-daily | 110 | 17 | 1 | 0 | 1 | 9 | 2 | 0 |
| novice-50-title | 120 | 20 | 1 | 0 | 1 | 10 | 3 | 1 |
| novice-50-title-ready | 122 | 20 | 1 | 0 | 1 | 10 | 3 | 0 |
| novice-50-title-cup | 121 | 17 | 1 | 0 | 1 | 10 | 1 | 0 |
| novice-50-title-daily | 120 | 17 | 1 | 0 | 1 | 10 | 2 | 0 |
| novice-100-title | 122 | 20 | 1 | 0 | 1 | 10 | 3 | 1 |
| novice-100-title-ready | 124 | 20 | 1 | 0 | 1 | 10 | 3 | 0 |
| novice-100-title-cup | 119 | 17 | 1 | 0 | 1 | 10 | 1 | 0 |
| novice-100-title-daily | 118 | 17 | 1 | 0 | 1 | 10 | 2 | 0 |
| fresh-title-link | 18 | 2 | 1 | 0 | 1 | 0 | 1 | 0 |
| mid-20-title-link | 113 | 17 | 1 | 0 | 1 | 10 | 3 | 1 |

**phone** (162 shots)

| shot | words | controls | primaries | look-alikes | lone icons | bare figures | repeats | loading |
|---|---|---|---|---|---|---|---|---|
| mid-5-results-crash | 53 | 6 | 1 | 0 | 1 | 5 | 0 | 0 |
| mid-5-results-crash-details | 61 | 7 | 1 | 0 | 1 | 1 | 0 | 0 |
| mid-50-results-cup | 44 | 5 | 1 | 0 | 1 | 3 | 0 | 0 |
| mid-50-results-cup-details | 62 | 5 | 1 | 0 | 1 | 1 | 1 | 0 |
| mid-20-results-daily | 47 | 5 | 1 | 0 | 1 | 4 | 0 | 0 |
| mid-20-results-daily-details | 63 | 5 | 1 | 0 | 1 | 1 | 1 | 0 |
| mid-20-results-duel-lost | 51 | 5 | 1 | 0 | 1 | 4 | 0 | 0 |
| mid-20-results-duel-lost-details | 64 | 5 | 1 | 0 | 1 | 1 | 2 | 0 |
| mid-20-results-duel-won | 51 | 5 | 1 | 0 | 1 | 4 | 0 | 0 |
| mid-20-results-duel-won-details | 69 | 5 | 1 | 0 | 1 | 3 | 2 | 0 |
| fresh-results-first | 64 | 5 | 1 | 0 | 1 | 6 | 0 | 0 |
| fresh-results-first-details | 68 | 5 | 1 | 0 | 1 | 2 | 1 | 0 |
| mid-50-night-between | 27 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mid-50-results-night | 51 | 5 | 1 | 0 | 1 | 3 | 1 | 0 |
| mid-50-results-night-details | 68 | 5 | 1 | 0 | 1 | 1 | 2 | 0 |
| mid-100-results-trial | 50 | 5 | 1 | 0 | 1 | 4 | 0 | 0 |
| mid-100-results-trial-details | 64 | 5 | 1 | 0 | 1 | 2 | 0 | 0 |
| mid-1-garage | 53 | 12 | 0 | 0 | 1 | 6 | 0 | 0 |
| mid-1-garage-Sleds | 53 | 12 | 0 | 0 | 1 | 6 | 0 | 0 |
| mid-1-garage-Paint | 44 | 10 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-1-garage-Scarves | 43 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-1-garage-Hats | 36 | 10 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-1-garage-Trails | 40 | 10 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-1-garage-Sounds | 40 | 11 | 0 | 0 | 3 | 1 | 1 | 0 |
| mid-1-garage-Lanterns | 29 | 6 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-1-almanac | 90 | 3 | 0 | 0 | 1 | 5 | 3 | 0 |
| mid-1-missions | 77 (14 in the popover) | 14 | 1 | 0 | 1 | 3 | 2 | 0 |
| mid-1-medals | 111 (48 in the popover) | 14 | 1 | 0 | 1 | 4 | 3 | 0 |
| mid-1-flame | 111 (48 in the popover) | 14 | 1 | 0 | 1 | 3 | 3 | 0 |
| mid-1-twelve | 239 (176 in the popover) | 15 | 1 | 0 | 2 | 3 | 7 | 0 |
| mid-1-settings | 20 | 9 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-1-pause | 37 | 11 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-1-photo | 24 | 7 | 1 | 0 | 2 | 0 | 0 | 0 |
| mid-100-garage | 44 | 12 | 0 | 0 | 2 | 3 | 0 | 0 |
| mid-100-garage-Sleds | 44 | 12 | 0 | 0 | 2 | 3 | 0 | 0 |
| mid-100-garage-Paint | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-100-garage-Scarves | 44 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-100-garage-Hats | 37 | 10 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-100-garage-Trails | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-100-garage-Sounds | 40 | 11 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-100-garage-Lanterns | 69 | 6 | 0 | 0 | 1 | 1 | 7 | 0 |
| mid-100-almanac | 63 | 4 | 0 | 0 | 1 | 1 | 2 | 0 |
| mid-100-album | 52 | 3 | 0 | 0 | 1 | 0 | 4 | 0 |
| mid-100-missions | 101 (29 in the popover) | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-100-medals | 142 (70 in the popover) | 18 | 1 | 0 | 1 | 10 | 3 | 0 |
| mid-100-flame | 119 (47 in the popover) | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-100-twelve | 250 (178 in the popover) | 19 | 1 | 0 | 2 | 5 | 7 | 0 |
| mid-100-settings | 20 | 9 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-100-pause | 52 | 11 | 1 | 0 | 0 | 3 | 1 | 0 |
| mid-100-photo | 24 | 7 | 1 | 0 | 2 | 0 | 0 | 0 |
| mid-20-garage | 50 | 12 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-20-garage-Sleds | 50 | 12 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-20-garage-Paint | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-20-garage-Scarves | 44 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-20-garage-Hats | 37 | 10 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-20-garage-Trails | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-20-garage-Sounds | 40 | 11 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-20-garage-Lanterns | 64 | 6 | 0 | 0 | 1 | 1 | 3 | 0 |
| mid-20-almanac | 65 | 4 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-20-album | 52 | 3 | 0 | 0 | 1 | 0 | 4 | 0 |
| mid-20-missions | 84 (26 in the popover) | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-20-medals | 118 (60 in the popover) | 18 | 1 | 0 | 1 | 9 | 3 | 0 |
| mid-20-flame | 106 (48 in the popover) | 18 | 1 | 0 | 1 | 5 | 3 | 0 |
| mid-20-twelve | 239 (181 in the popover) | 19 | 1 | 0 | 2 | 5 | 7 | 0 |
| mid-20-settings | 20 | 9 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-20-pause | 49 | 11 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-20-photo | 24 | 7 | 1 | 0 | 2 | 0 | 0 | 0 |
| mid-5-garage | 50 | 12 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-5-garage-Sleds | 50 | 12 | 0 | 0 | 1 | 5 | 0 | 0 |
| mid-5-garage-Paint | 43 | 10 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-5-garage-Scarves | 44 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-5-garage-Hats | 34 | 10 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-5-garage-Trails | 42 | 10 | 0 | 0 | 1 | 1 | 1 | 0 |
| mid-5-garage-Sounds | 40 | 11 | 0 | 0 | 3 | 1 | 1 | 0 |
| mid-5-garage-Lanterns | 53 | 6 | 0 | 0 | 1 | 1 | 2 | 0 |
| mid-5-almanac | 97 | 1 | 0 | 0 | 1 | 1 | 2 | 0 |
| mid-5-album | 49 | 3 | 0 | 0 | 1 | 0 | 2 | 0 |
| mid-5-missions | 84 (27 in the popover) | 14 | 1 | 0 | 0 | 4 | 1 | 0 |
| mid-5-medals | 113 (56 in the popover) | 14 | 1 | 0 | 0 | 7 | 3 | 0 |
| mid-5-flame | 105 (48 in the popover) | 14 | 1 | 0 | 0 | 4 | 2 | 0 |
| mid-5-twelve | 232 (175 in the popover) | 16 | 1 | 0 | 1 | 4 | 8 | 0 |
| mid-5-settings | 20 | 9 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-5-pause | 50 | 11 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-5-photo | 24 | 7 | 1 | 0 | 2 | 0 | 0 | 0 |
| mid-50-garage | 47 | 12 | 0 | 0 | 1 | 4 | 0 | 0 |
| mid-50-garage-Sleds | 47 | 12 | 0 | 0 | 1 | 4 | 0 | 0 |
| mid-50-garage-Paint | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-50-garage-Scarves | 44 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-50-garage-Hats | 37 | 10 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-50-garage-Trails | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| mid-50-garage-Sounds | 40 | 11 | 0 | 0 | 3 | 1 | 0 | 0 |
| mid-50-garage-Lanterns | 69 | 6 | 0 | 0 | 1 | 1 | 5 | 0 |
| mid-50-almanac | 70 | 4 | 0 | 0 | 1 | 1 | 2 | 0 |
| mid-50-album | 52 | 3 | 0 | 0 | 1 | 0 | 4 | 0 |
| mid-50-missions | 82 (25 in the popover) | 17 | 1 | 0 | 0 | 5 | 2 | 0 |
| mid-50-medals | 120 (63 in the popover) | 17 | 1 | 0 | 0 | 9 | 4 | 0 |
| mid-50-flame | 104 (47 in the popover) | 17 | 1 | 0 | 0 | 5 | 3 | 0 |
| mid-50-twelve | 240 (183 in the popover) | 18 | 1 | 0 | 1 | 5 | 9 | 0 |
| mid-50-settings | 20 | 9 | 0 | 0 | 1 | 3 | 0 | 0 |
| mid-50-pause | 48 | 11 | 1 | 0 | 0 | 3 | 0 | 0 |
| mid-50-photo | 24 | 7 | 1 | 0 | 2 | 0 | 0 | 0 |
| novice-50-garage | 50 | 12 | 0 | 0 | 1 | 5 | 0 | 0 |
| novice-50-garage-Sleds | 50 | 12 | 0 | 0 | 1 | 5 | 0 | 0 |
| novice-50-garage-Paint | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| novice-50-garage-Scarves | 44 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| novice-50-garage-Hats | 37 | 10 | 0 | 0 | 3 | 1 | 0 | 0 |
| novice-50-garage-Trails | 41 | 10 | 0 | 0 | 1 | 1 | 0 | 0 |
| novice-50-garage-Sounds | 40 | 11 | 0 | 0 | 3 | 1 | 0 | 0 |
| novice-50-garage-Lanterns | 64 | 6 | 0 | 0 | 1 | 1 | 4 | 0 |
| novice-50-almanac | 73 | 3 | 0 | 0 | 1 | 1 | 2 | 0 |
| novice-50-album | 45 | 3 | 0 | 0 | 1 | 0 | 2 | 0 |
| novice-50-missions | 95 (31 in the popover) | 18 | 1 | 0 | 1 | 5 | 3 | 0 |
| novice-50-medals | 123 (59 in the popover) | 18 | 1 | 0 | 1 | 8 | 4 | 0 |
| novice-50-flame | 111 (47 in the popover) | 18 | 1 | 0 | 1 | 5 | 3 | 0 |
| novice-50-twelve | 242 (178 in the popover) | 19 | 1 | 0 | 2 | 5 | 6 | 0 |
| novice-50-settings | 20 | 9 | 0 | 0 | 1 | 3 | 0 | 0 |
| novice-50-pause | 54 | 11 | 1 | 0 | 0 | 3 | 1 | 0 |
| novice-50-photo | 24 | 7 | 1 | 0 | 2 | 0 | 0 | 0 |
| fresh-title | 17 | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| mid-1-title | 61 | 14 | 1 | 0 | 0 | 3 | 2 | 1 |
| mid-1-title-ready | 63 | 14 | 1 | 0 | 1 | 3 | 2 | 0 |
| mid-1-title-cup | 63 | 14 | 1 | 0 | 1 | 3 | 1 | 0 |
| mid-1-title-daily | 62 | 14 | 1 | 0 | 1 | 3 | 2 | 0 |
| mid-5-title | 57 | 14 | 1 | 0 | 0 | 4 | 1 | 1 |
| mid-5-title-ready | 57 | 14 | 1 | 0 | 0 | 4 | 1 | 0 |
| mid-5-title-cup | 55 | 14 | 1 | 0 | 0 | 4 | 0 | 0 |
| mid-5-title-daily | 54 | 14 | 1 | 0 | 0 | 4 | 1 | 0 |
| mid-20-title | 58 | 18 | 1 | 0 | 1 | 5 | 2 | 1 |
| mid-20-title-ready | 58 | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-20-title-cup | 57 | 15 | 1 | 0 | 1 | 5 | 1 | 0 |
| mid-20-title-daily | 56 | 15 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-50-title | 59 | 17 | 1 | 0 | 0 | 5 | 2 | 1 |
| mid-50-title-ready | 57 | 17 | 1 | 0 | 0 | 5 | 2 | 0 |
| mid-50-title-cup | 56 | 14 | 1 | 0 | 0 | 5 | 1 | 0 |
| mid-50-title-daily | 55 | 14 | 1 | 0 | 0 | 5 | 2 | 0 |
| mid-100-title | 74 | 18 | 1 | 0 | 1 | 5 | 1 | 1 |
| mid-100-title-ready | 72 | 18 | 1 | 0 | 1 | 5 | 1 | 0 |
| mid-100-title-cup | 68 | 17 | 1 | 0 | 1 | 5 | 0 | 0 |
| mid-100-title-trial | 69 | 15 | 1 | 0 | 1 | 5 | 2 | 0 |
| mid-100-title-daily | 65 | 15 | 1 | 0 | 1 | 5 | 1 | 0 |
| novice-1-title | 59 | 14 | 1 | 0 | 1 | 3 | 2 | 1 |
| novice-1-title-ready | 59 | 14 | 1 | 0 | 1 | 3 | 2 | 0 |
| novice-1-title-cup | 59 | 14 | 1 | 0 | 1 | 3 | 1 | 0 |
| novice-1-title-daily | 58 | 14 | 1 | 0 | 1 | 3 | 2 | 0 |
| novice-5-title | 61 | 15 | 1 | 0 | 1 | 5 | 3 | 1 |
| novice-5-title-ready | 61 | 15 | 1 | 0 | 1 | 5 | 3 | 0 |
| novice-5-title-cup | 56 | 15 | 1 | 0 | 1 | 5 | 1 | 0 |
| novice-5-title-daily | 55 | 15 | 1 | 0 | 1 | 5 | 2 | 0 |
| novice-20-title | 59 | 18 | 1 | 0 | 1 | 5 | 2 | 1 |
| novice-20-title-ready | 59 | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| novice-20-title-cup | 56 | 15 | 1 | 0 | 1 | 5 | 1 | 0 |
| novice-20-title-daily | 55 | 15 | 1 | 0 | 1 | 5 | 2 | 0 |
| novice-50-title | 66 | 18 | 1 | 0 | 1 | 5 | 2 | 1 |
| novice-50-title-ready | 64 | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| novice-50-title-cup | 61 | 15 | 1 | 0 | 1 | 5 | 1 | 0 |
| novice-50-title-daily | 60 | 15 | 1 | 0 | 1 | 5 | 2 | 0 |
| novice-100-title | 66 | 18 | 1 | 0 | 1 | 5 | 2 | 1 |
| novice-100-title-ready | 64 | 18 | 1 | 0 | 1 | 5 | 2 | 0 |
| novice-100-title-cup | 61 | 15 | 1 | 0 | 1 | 5 | 1 | 0 |
| novice-100-title-daily | 60 | 15 | 1 | 0 | 1 | 5 | 2 | 0 |
| fresh-title-link | 17 | 2 | 1 | 0 | 1 | 0 | 1 | 0 |
| mid-20-title-link | 62 | 15 | 1 | 0 | 1 | 5 | 2 | 1 |
