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

**Status (kept current):** desk done (titles at all eleven stages with the Cup, Trial and Daily picked and a
challenge link; results for a first finish, a duel won and lost, the Daily, the Cup, a Trial and the Long Night
between legs and at its end, each with Details; every sheet and popover at mid-1, 5, 20, 50, 100 and novice-50, pause
and photo mode; Run Again; the crawl at mid-50 and mid-5). Being redone on desk with the final counting rules (titles,
sheets, crawl): the counts below may move by a lone icon or a repeat. **The crash and the phone are still running.**

Where: frames `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/truth/<form>-<stage>-<screen>.png` (for example
`desk-mid-50-title.png`, `desk-mid-50-title-ready.png`, `desk-mid-20-results-duel-lost.png`, `desk-mid-50-garage-Hats.png`,
`desk-mid-50-twelve.png`), the counts in `shots/r9/truth/desk.json` and `phone.json` (one per form factor: every shot
with its visible text chunks, its controls and `figures`), and each part's raw output in `shots/r9/truth/raw/`.
Desk is 1280x720 at High, phone 390x844 DPR 2 at Medium, both headless, on the dev server with the fixtures, the origin
loaded once before anything was shot. The console was clean in every part (no errors, no warnings).

**How it counts** (r9-truth.js `MEASURE`, r9-screenbars.ts): a word is a whitespace token with a letter or a digit
in a text node a reader can see (not `display:none` or hidden, not `.gs-sr`, no ancestor under 0.15 opacity, in the
viewport, not scrolled out of a clipping parent; on a sheet only the sheet's text). "+1", "/212" and "0:20.9" are a
word each; "·" is none. CSS-drawn text and the canvas are not counted. A control is a button, tab, link or input seen
the same way: its accessible name, whether it carries `gs-btn-primary`, whether its fill is the primary's vermillion
(a look-alike), and whether it shows no text (a lone icon). The dev server's mock platform offers rewarded ads (Double
Gifts, a revive, a midgame ad) that the published build does not: they are left out of every count.

**Today, desk** (the full table per shot is in section 8; `--md` prints it):

| screen | run 1 | run 5 | run 20 | run 50 | run 100 |
|---|---|---|---|---|---|
| title words, mid (once rivals are in) | 111 (113) | 108 (110) | 118 (120) | 115 (117) | 119 (121) |
| title words, novice | 105 (107) | 109 (111) | 111 (113) | 120 (122) | 122 (124) |
| title controls / primaries / lone icons | 21 / 1 / 2 | | | 21 / 1 / 2 | |
| title bare figures (mid) | 9 | 12 | 13 | 12 | 13 |
| title repeats (mid) | 4 | 3 | 3 | 3 | 2 |
| "Finding rivals…" at 3 s | yes | yes | yes | yes | yes |

The fresh title: 18 words, 2 controls (Ride, and Mute as a lone icon), no bare figure, no repeat. With a friend's
challenge link: one more line.

| results, first view (Details) | words | controls | bare figures | repeats |
|---|---|---|---|---|
| first finish (fresh) | 79 (175) | 5 (9) | 8 (11) | 0 (7) |
| duel won (mid-20) | 74 (207) | 5 (9) | 6 (13) | 0 (8) |
| duel lost (mid-20) | 68 (178) | 5 (9) | 6 (8) | 0 (6) |
| Long Night's end (mid-50) | 66 (166) | 5 (9) | 5 (5) | 0 (6) |
| Daily (mid-20) | 60 (127) | 5 (9) | 6 (4) | 0 (3) |
| Trial (mid-100) | 60 (155) | 5 (9) | 6 (5) | 0 (2) |
| Cup (mid-50) | 57 (134) | 5 (9) | 5 (4) | 0 (2) |
| between the Long Night's legs | 27 | 0 | 0 | 0 |

Every results first view has one primary, no look-alike and one lone icon (the camera, "Photo mode").

| sheet or popover (mid-50) | words | controls | primaries | lone icons |
|---|---|---|---|---|
| garage (each shelf) | 53 to 76 | 8 to 17 | 0 (all owned) | 1 (Close) |
| Almanac | 134 | 4 | 0 | 1 |
| Spirit Album | 174 | | 0 | 1 |
| missions popover (with the title around it) | 142 | | | |
| medals popover | 180 | | | |
| flame calendar popover | 164 | | | |
| The Twelve popover | 351 | | | 3 (Close the ladder, and the strip's two) |
| settings | 21 | | 0 | 1 |
| pause | 52 | | 1 | 0 |
| photo mode | 24 | | 1 | 3 (grid, focus, back to the first frame) |

## 3. Escape and the pad's B

The same at every stage (mid-1, 5, 20, 50, 100 and novice-50), desk:

| surface | Escape | the pad's B | where focus goes |
|---|---|---|---|
| garage (sheet) | stays open | closes | Escape: stays on Close; B: (being re-measured with the sheet opened by a focused control) |
| Almanac, Spirit Album (the books sheet) | stays open | closes | as the garage |
| settings (sheet) | stays open | closes | as the garage |
| missions, medals, flame calendar, The Twelve (title popovers) | stays open | **stays open** | focus never enters the popover (it stays where it was) |
| pause card (in a run) | stays open | closes (resumes the run) | Resume holds focus while it is open |
| photo mode (from pause) | closes, back to pause | closes, back to pause | Resume |

Why: Escape is unbound on purpose (`src/ui/menus.ts:14`: "Escape is deliberately not bound: on CrazyGames it exits
fullscreen"), and only photo mode (`photo.ts:381`) and riding home (`app.ts:702`) read it. The pad's B is "back" only
on a modal surface (`ui.ts` padMenu passes `modal = menu !== null`, and `padnav.ts` clicks the close button or Resume);
the title's popovers are not modal to it, so B does nothing there. A tap outside closes a popover (`title.ts:95`).

## 4. The bars and today's figures

Scripts: `npx tsx scripts/playtest/r9-screenbars.ts` (the browser bars, over the captures; exits 0) and
`npx vitest run tests/r9screens.test.ts` (the detectors held to known cases, and two copy bars as `it.fails`).

| bar (section 2) | today, desk | today, phone |
|---|---|---|
| title at run 50: at most 40 words | mid-50 115 (117 with rivals in), novice-50 120 (122): fails by 75 to 82 | pending |
| results' first view: at most 35 words | 57 (Cup) to 79 (first finish): fails by 22 to 44 | pending |
| a fresh title no worse than today | 18 words, 2 controls (the baseline) | pending |
| one primary a screen | every title and results view: 1; garage, books, settings: 0 | pending |
| nothing else styled like one | 0 look-alikes on every shot | pending |
| no lone icons | fails everywhere: Mute on the fresh title; the strip's arrow on every returning title; the camera on every results; Close on every sheet; Close the ladder; photo mode's three | pending |
| plain figures | returning title 9 to 13 bare; results first view 5 to 8; fresh title 0 | pending |
| said once | returning title 2 to 4 repeats; results first view 0, Details 2 to 8 | pending |
| never loading | "Finding rivals…" on the Cup and the Daily at 3 s on every returning title | pending |
| nothing lost (two taps, pointer, keyboard, pad, named) | mid-50: 16 of 20 systems; the league and contracts not found at all; photo and clips only from a run | pending |
| as fast as today (Run Again to riding under 2 s) | warm presses 114, 253, 259, 265 ms (cold 520 ms); one 5,120 ms press was the mock platform's midgame ad, which the published build never plays | pending |
| copy (vitest, `it.fails`) | 19 of 50 Almanac pages named with a bare "+N"; 33 of 33 missions, once met, offered as "done before, so again" | |

**The detectors**, what they catch and what they cannot:
- *Bare figures*: a signed figure with no unit after it ("+1", "A new sled +1", "+110"); a fraction in a box with no
  word ("14 /212"); "Page N" and "Chapter page N"; "Rank N of M"; "N to go" with no unit; a lone number in a box with
  no word (the flame's "13", the wallet's "90": their words are only for a screen reader). Not caught: jargon that is
  a word ("XP"), a figure explained elsewhere on the screen, figures drawn by CSS or the canvas. A clock time is not
  counted bare (its form says it is a time).
- *Repeats*: a known name (a mountain, one of The Twelve) in two boxes; a time or a figure of three or more digits in
  two boxes; three words in a row in two boxes (a figure is one token, and a list's field labels such as "Best" and
  "Rank" do not count). A box is the control a text is on, else its list item, paragraph or card. Not caught: the
  same thing said in other words or by a picture (a rider's portrait and the word "Duel"), or once on a sheet and
  once under it.
- *Loading*: "Finding rivals", "loading", "generating", "please wait", or a short line ending in an ellipsis.
- *Nothing lost*: the crawl opens each title control once by its focus key (the Cup's and the Daily's cards once
  their rivals are in), reads what opened and each of its tabs, walks the Tab order, and walks the pad from its first
  press in all four directions breadth first. A system counts as reached when its words (r9-screenbars.ts `SYSTEMS`)
  are on the title (0 taps), behind a title control (1), or behind a tab of that (2); "named" is whether that door's
  accessible name says the system.

**Nothing lost at mid-50, desk:**

| system | taps | through | keyboard | pad | named |
|---|---|---|---|---|---|
| rank and Almanac | 0 | the Rider Rank card | yes | yes | yes |
| album | 0 | the sticker count | yes | yes | yes |
| flame | 0 | the flame | yes | yes | yes |
| gifts | 0 by sight (a figure with an icon), named only for a screen reader | the stats pill (not a control) | - | - | no word on screen |
| bests | 0 | the mountain cards and the pill | yes | yes | yes |
| The Twelve | 0 | its card | yes | yes | yes |
| the Cup | 0 | its card (no tap until its rivals are in) | yes | yes | yes |
| the league | **not found** | only a line in the results' Details | | | |
| Trials | (not open at mid-50; a future Almanac page) | | | | |
| the Daily | 0 | its card | yes | yes | yes |
| contracts | **not found** | only in the results (a reward card, Details) | | | |
| missions | 0 | Missions | yes | yes | yes |
| medals | 0 | Medals, the cards | yes | yes | yes |
| mastery | 1 | Medals (its stars) | yes | yes | no |
| the Long Night | 1 | the Almanac (its Ride) | yes | yes | no |
| hours | 0 | the Day / Night pick | yes | yes | yes |
| mirrors | 0 | Mirrored | yes | yes | yes |
| photo | from a run only (pause, results) | | | | |
| clips | from the results only (Save Clip) | | | | |
| the garage | 0 | Garage | yes | yes | yes |

The title's Tab order is 22 stops and the pad reaches every title control from its first press (88 presses).

## 5. Section 1 "The screens", line by line

Each line of the review, against the captures (desk; phone to follow) and the code. Frames are under
`shots/r9/truth/`.

**What is already strong**
- *A first visit's title: the logo, one line, one big Ride, and 18 words in all.* **Right.** `desk-fresh-title.png`:
  18 words, two controls. Missed: the second control, Mute, is a lone icon.
- *The results' hero: the place, the rider in a pose before a cheering crowd, and one primary button.* **Right** on
  every finish shot (one primary, no look-alike). Missed: on the Trial's results the rider stands behind the right
  column (`desk-mid-100-results-trial.png`, Sakura; the run was pinned, so a person should check a real one), and the
  camera beside Home is a lone icon on every results.
- *The game's type and its vermillion primary.* **Right:** across every shot no other control has the primary's fill.

**What holds them back**
1. *Every system the game has gained has a seat on the title; the returning title is ten panels and about 100 words.*
   **Right, and understated.** The returning title is 105 to 124 words at every stage from run 1 (mid-1 111, mid-50
   115, novice-50 120, novice-100 122; two more once the rivals arrive) and 21 controls. At run 1 it already carries
   the Almanac card, the album count, The Twelve's card, the Cup's and the Daily's cards and the menu bar; from run 20
   the hour pick and Mirrored add a row under Ride. About twelve panels at run 50 (`desk-mid-50-title-ready.png`).
   *Hours, mirrors, Trials, contracts, the league and the Long Night add more as they open:* **half wrong.** Hours and
   mirrors add the row; Trials add a Cup/Trial switch only when the Cup is picked (`desk-mid-100-title-trial.png`);
   contracts, the league and the Long Night never reach the title at all (see "nothing lost": they are missing, not
   crowding). *A scene left a gap in the middle:* **right** on desk. The phone: pending.
2. *The same thing said twice.* **Right**, all three reproduce where they apply: "Duel Pip Thistle" on Ride and "Next
   of The Twelve: Pip Thistle" (mid-20; Suki Ember at mid-50); the unlock hint and the locked card (mid-1: "Frostfang
   Glacier" twice); the best in the pill and on the card (mid-50: 1:52.2). **Missed:** the picked mountain is named
   three times when the duel is there (heading, its card, The Twelve's card: "Ember Peak" x3 at mid-50; "Pinecrest" x5
   on novice-1), and Details repeats the first view's lines ("Your first finish here." twice).
3. *Figures without words.* **Right and wider.** At run 50 the title shows 12: the flame's "13", the wallet's "90"
   (its word only for a screen reader), "Page 26", "1,281 to go", "115 /212", "Rank N of 87" on four cards, the
   Twelve count and the missions badge. "A new sled +1" is the fmt.ts `rewardsLine`: 19 of 50 Almanac pages are named
   that way (novice-50: "Lanternfall, open to ride +1"). "Page 2/3" on the results' cards: right ("Page 1",
   "Chapter page 9"). **Missed:** every results first view also has 5 to 8 signed figures with no unit: the XP chips'
   "+110", "+90", "+300" and the gifts' "+68" beside an icon.
4. *Loading shown as content: "Finding rivals…" three seconds after the title opens, on desk and phone.* **Right** on
   desk at every returning stage (one or both cards). Missed: until then the Cup's and the Daily's cards take no tap
   (the crawl has to wait for them), and when the rivals arrive the line becomes "Fresh rivals" (status, still).
5. *The results' right column is a form, about 70 words and 14 figures.* **Right in kind:** 57 to 79 words on the first
   view, 5 controls. *Two calls to action compete: Ride It on the unlock card, and the primary:* **overstated.** Ride
   It is a soft button, not the primary's fill (0 look-alikes measured), and it only exists on a run that opens a
   mountain; but it is a second action, and on that run it is the one a player wants.
6. *Copy that does not parse.* **Right, and not a one-off.** "Finish the mission / Pass a ghost: done before, so
   again" reproduces on a fresh save's first finish (`desk-fresh-results-first.png`) and "Bank a 10,000 point combo:
   done before, so again" after the mid-20 duels (`desk-mid-20-results-duel-won.png`, `-duel-lost.png`). Source:
   `src/game/goals.ts:128`, for every mission whose best already meets its target (33 of 33, the vitest bar). The race
   line floats over the crowd apart from the place: right ("89.2 s clear of Vida Flip"). **Missed:** after a lost duel
   the one button is "Finish the mission", not the rematch, while the chip says "Pip Thistle held you off by 32.1 s."
7. *No one design language: about 15,000 lines of CSS in 11 sheets, style.css 9,658; results' render() a chain of
   conditional rows.* **Right on the numbers:** 15,105 lines in 11 sheets, style.css 9,658 (`wc -l src/ui/*.css`);
   `results.ts` render() runs from line 529 to about 760 with 28 conditionals and 10 mentions of the phone. Whether it
   reads as one family is a critic's call, not this lane's.
8. *To check: Escape did not close the garage.* **Escape closes no sheet and no popover, by design**
   (`menus.ts:14`, for CrazyGames' fullscreen); it closes only photo mode and riding home. The pad's B closes every
   sheet and the pause card but **none of the title's four popovers**. Section 3 has the table.

**What the review missed**
- **The day's contracts and the Cup's league are never shown.** The models are built (`spineview.ts` puts
  `contracts`, `form` and `league` with its nineteen rows in `TitleSpine`, and `today` and `formNext` in the results'
  spine), but no UI file renders them (`grep` of `src/ui`: only `results.ts:1263-1266` writes "Contracts met: ...",
  "Your form: ..." and "Cup league: 1st in division 5." into Details' notes). A player never sees what today's three
  contracts ask, nor the league's table; they meet "Daily contracts" as an Almanac page's name and "Up to division 3 of
  the Cup." as the title's news line in a week the division moved (`desk-mid-100-title.png`). "Nothing lost" fails for
  both today, and not only for want of a door.
- Lone icons on every screen: Mute, the strip's arrows, the camera on the results, Close on every sheet, Close the
  ladder, and photo mode's grid, focus and back.
- The garage, the books and settings have no primary at all (nothing to buy at mid-50: every shelf owned); the bar
  says one per screen.
- The title popovers take no focus when opened and no Escape or B to close.

## 6. What the main lane must decide

- **Escape.** U4 says Escape closes every sheet; `menus.ts:14` unbinds it so a CrazyGames player's Escape only leaves
  fullscreen. Decide whether a sheet closes on Escape as well (one key, two effects in fullscreen), or the bar reads
  "B and a visible Close" there.
- **Where contracts and the league live.** Today they have no door from the title; U1 puts them behind "the week's and
  day's events". Until then "nothing lost" fails for both.
- **What counts as a lone icon.** The strip's arrows, Close, Mute and the results' camera are conventional icon
  buttons with names for a screen reader. The bar as written fails every screen on them; keep it strict or name the
  allowed few.
- **Primary on a sheet with nothing to do** (the garage when all is owned, the books, settings): accept none, or ask
  for one (Close as quiet, a "Ride" or "Back to the title" as primary).
- **Photo and clips are reached from a run, not the title.** "Nothing lost" (two taps from the title) cannot hold for
  them without a door that makes no sense; say they are judged from pause and the results.
- **The Trial's results framing** (the rider behind the right column) for a person to check on a real run.

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
