# Round 8, the screens lane: screens as beautiful as the game, and results that sell the next run

Branch `r8-screens`, cut from `round-8` at 6be2fd2. Items V8 with G5 (the brief: `notes/r8-briefs/screens.md`). UI, CSS
and one sound hook only: nothing here reaches the sim, the bots or a ghost's record. Frames and raw output under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/screens/`.

Design read (the design-taste-frontend skill, with ART.md 10 as the system): game screens over a painted 3D scene for
a casual browser audience; Alpenglow Gouache's UI rules (ink panels at 86% with a hairline, full pills and 18 px
cards, italic 900 for speed words, vermillion for the one primary action, mint for ghosts, marigold for the lantern
and gifts); dials variance 6, motion 6 (every beat motivated, transform and opacity only), density 3 on the front and
6 one level down.

## What a player gets, and why they would feel it

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **Results are a directed sequence of about five seconds over the live scene** (`ui/sequence.ts`, `story.css`): the moment (round 7's, unchanged) at 0 ms; the place with the nearest rider named ("1.1 s behind Ansel", "1.8 s clear of Mika", "1,288 m short of the line") at 640 ms; Rider Rank's bar at 1.15 s, filling for about 1.1 s with the XP counting up and the three biggest ticks lighting as it passes them, holding at the top and turning the page when a page turns, and stopping short of the next page on purpose with that page's reward and "300 to go" under it; what opened turning over one card at a time (a mountain with its sky and Ride It, an Almanac page's reward, the run's stickers as one card, "+3 more in Details" past three); then the one button. | "I didn't even think, I just hit go again": the run ends on what it bought and what the next one buys, in order, with one thing to press. The old card was about fifteen items at once with no order (DECISIONS 367). | `tests/sequence.test.ts`: a full run lands between 4 and 6 s, a run with nothing opened under 4 s, every beat in order. Front items: 5 groups (place, rank, cards, button, foot) against about 15. |
| **The one button is the spine's** (`results.spine.primary` through `runAgainLabel`), vermillion, its label never cut: one line at three type sizes by length ("Next Duel: Bram Oakhollow" fits a 358 px phone), the reason under it ("1.2 s behind", "Ride 800 m in one run: 12 m short", "Time to beat 2:09.2"). A page named as the goal keeps only "Page 6: 300 to go", since the rank's own line already names the reward. | The old button cut "RACE HailstoneSp..." (367). | Every harness label from 9 to 25 characters whole on desktop and phone (`after2/*seq-*`). |
| **Every step skippable** (a tap anywhere but a control, or any key, lands the whole end at once; Space is still Run Again from 700 ms); **reduced motion** builds it whole with no movement (every beat still on screen). Steps are built hidden from the first frame, so nothing fades out as the results open. | A player who wants to go again goes; one who wants to read reads. | |
| **Everything else is one level down** (Details: the card it always was, splits, missions, the race order, Watch Your Run, Challenge a Friend, the mission swap, and now the run's whole Rider Rank account, every tick and the contracts, stickers, league and ember lines). Details plays the card's own entrance; a round back button in its corner and Escape return to the story. Revive and Double Gifts ride on whichever level is up, never twice. | The front reads in one look; nothing is lost. | |
| **Restart to riding** | | Space on results to the sim's first moving tick: before 909 ms (both phase and ride on the same frame); after: see below. |
| **Sound on the beats** (`UIHandlers.onResultsBeat`, `app.ts resultsBeat`): a climbing tick as each stretch of the bar fills, the stamp as a page turns, a mallet as each card turns over; the finished missions' chimes play as the bar starts (they are paid there). Reduced motion: none, as before. | The bar and the cards are heard, not only seen. | |
| **The title's corner** (`title.ts`, `books.css`): the flame leads the pill (days in a row; drawn hollow until today is ridden; an ember dot when one is held; a tap opens the seven-day calendar with what each day pays and what the ember does), Rider Rank's card under it (the page, a bar to the next, the next page's reward and what it needs; it opens the Almanac; the album's count beside it opens the album), and the one line of what is new today as scene text under that. The Daily card no longer carries "N day flame": the flame is drawn. | A returning player sees at once that the lantern is lit, what the next run buys, and what is new today, without the title growing a column. | |
| **The Almanac and the Spirit Album** (`almanac.ts`, one sheet with a tab each in `menus.ts`): the rank head, this month's chapter (its ten pips and its set), the fifty pages in rows of ten (opened with a check, the next outlined with what it needs, the rest dimmed), opened at the page being filled toward; the album's whole figure and per-section counts, each sticker painted in its mountain's sky once held, a silhouette with where to find it until then. | "Two more runs and I unlock the next thing" has a book to look at; run 50 has silhouettes to fill. | |
| **The Lantern Row drawn** (garage, `menus.ts lanternPanel`): each open town's eight lanterns as they hang, lit marigold in order, the next outlined, with its count and one button. | Something to want at run 100 that looks like what it is. | |
| **The phone's HUD** (`phone.css`): the lantern's lesson ("Tap the lantern to dash, or keep it as a ward") moves from across the steering thumb to a pill under the lantern button, above the thumbs' band, on two lines; the perfect-landing stamp's column is the stamp's width, so a landing naming two long tricks wraps inside the stamp instead of running off the edge. | Nothing under a thumb, nothing off an edge. | `scripts/playtest/r8-hudfit.js`: see below. |

## Cost

- Results and title are DOM over the existing scene: no draw call, no triangle, nothing in a ride. The sequence runs
  one rAF loop (the XP count) for about a second while results are up and a handful of timers; it stops when it lands.
- Bundle: the game's JS 2,980,939 to 3,011,203 bytes (+30 KB, the sequence and the books, and the album catalogue
  and Almanac now reached from the UI), CSS 164,943 to 185,870 (+21 KB).
- Nothing runs before `gs-first-frame`: the title's spine model is the getter app.ts already had; the books are built
  only when opened.

## Low and the phone

- Low gets the same screens: they are DOM, tier-independent.
- The phone (390 x 844): the story is the bottom of the screen with the button in the thumb's reach and the moment and
  the rider above it; the paid ticks stay in Details there; the offers take a row of their own over Home and Details.
  The title's corner is the top of the screen in the same order. The books' pages go two to a row, the stickers two.
- A phone on its side (under 520 px tall): one compact column at the right, the moment kept beside it.

## Touched outside my files

- `src/game/app.ts`: three handlers (`onOpenAlmanac`, `onOpenAlbum`, `onResultsBeat`) and `resultsBeat` (sounds on the
  sequence's beats through the existing `resultsSound`). No change to what the results or the title are built from.
- `src/ui/contract.ts`: `UIHandlers.onResultsBeat`, `onOpenAlmanac`, `onOpenAlbum` (optional).

## Tests

- `tests/sequence.test.ts`: the place line's words (behind, clear, short of the line, metres between non-finishers,
  nothing with nobody to race), the bar's segments (within a page, across a page, at most two whole pages between,
  nothing when nothing moved), the timeline (a full run in 4 to 6 s with its beats in order, a quiet run sooner, no
  spine), the cards (order, the "more" card past three, a mountain not shown twice), the named ticks.
- The full suite (`vitest --maxWorkers=3`, heavy slot): 91 files, 1,728 tests, green.

## The critics

**First critic** (a fresh general-purpose subagent, opus at high effort, given only ART.md, the pairs folder and the
brief's question with the screen questions added: which would make you play again, which is clearer, what is broken).
Ten pairs, before (the integrated round-8 build, `dist/r8-before`) against after (this branch built), the new frame on a
seeded side (`shots/r8/screens/pairs1`, key in `keys/pairs1.json`): **5 of 10 picked the new frame**.

- Every pair of a finished results screen went to the new one (4 of 4: desk run 1 at 4.5 s and 7 s, desk run 2 at 7 s,
  phone at 6 s), and the desk title at 5 s: "the compact results layout beats the full card every time: it leads with
  the moment and its primary button never clips"; "one full-width goal beats a wall of numbers".
- The three pairs shot mid-sequence (desk 1.2 s and 2.6 s, phone 2.5 s) went to the old card: a frame caught while
  the story is still building has no button yet, against a card that is all there at once. That is the design (the
  button comes last, about 3.7 s), and the frames are a fade-in; the critic named them "caught mid-transition".
- The desk title at 1.5 s went to the old frame on the scene alone (the key art's shot, not this lane's).
- The phone title went to the old frame: "the logo covers the hero", "the top of the screen is crowded: the status
  chip, the rank card and the news line all sit above the logo", "a lone 'run.' on its own line". **Fixed:** on a phone
  the corner is one row (Rider Rank's figure and bar beside the pill, the best left to the picked mountain's card) and
  the news one short ink pill under it.
- Also named and fixed: the "+2 more in Details" tile read as a dead blank (it now names what waits there); Details'
  Run Again clipped a long spine label's keycap ("NEXT DUEL: BRAM OAKHOLLOW Spa", the round-8 card's own fault, now
  whole a step smaller, no keycap). Named in the before card only (the overlapping More pill, the doubled "1st of 6"):
  one level down now, unchanged.

## The phone's HUD, measured

`scripts/playtest/r8-hudfit.js` opens 27 harness scenarios on the phone config (390 x 844, touch: the HUD, every
callout, the long round-8 trick names and a stamp naming two of them, the queue, race calls, pops, toasts, the
countdown, the chase, the danger meter, every touch hint, a warning, a streak, the fuse) and reads the box of every
leaf the HUD draws. A fault is a box off an edge, or a box in the thumbs' band (the bottom 22% of a phone held
upright, fx.ts LOW_FLOOR), the touch controls that belong there excepted (the lantern button, the zones' own labels
and rings while a touch hint teaches them).

| | Scenarios | Off an edge | In the thumbs' band |
| --- | --- | --- | --- |
| Before (round-8 base CSS) | 27 | 0 | 2: the lantern's lesson (19..371 x 686..732) and the slipstream's (80..310 x 686..732) |
| After | 27 | 0 | **0** |

The ground truth's "+1,20" off the right edge (DECISIONS 367, the live build) does not reproduce on round-8's base:
the stamp's sub-line already wraps inside the stamp there, with the longest two round-8 trick names (`stamp-long`).
Frames: `shots/r8/screens/hudfit/` (`before-*.png`, `after-*.png`; the JSON beside them).

## Restart to riding

`scripts/playtest/r8-screens.js`: Space on the results (400 ms after they open) to the sim's first moving tick, on a
real save, desktop High, Pinecrest. Before (the integrated build): **909 ms** (the run starts on the same frame the
phase turns). After: **519 ms** and **593 ms** (two sittings, the machine shared). Both well under the brief's 2 s; the sequence adds no wait (Space is Run Again from
700 ms whether or not the story has landed, and lands it as it goes).

## The second critic

A new fresh critic (the same brief, told nothing of the first), on ten new pairs after the fixes (`pairs2`, seed 11,
the same before set against `after3`): **7 of 10 picked the new frame**.

- **Every results pair went to the new screen, 6 of 6** (desk run 1 at 4.5 s and 7 s, run 2 at 4.5 s and 7 s, the phone
  at 6 s, and run 2 caught mid-story at 2.6 s: "the best results picture in the set"). On the old card: "buries the
  scene, repeats the headline's place and time, and its primary button overflows".
- The three misses were titles, judged on the key art's shot (the rider small or hidden in spray, a flat band in the
  sky, "Finding rivals..." on the Daily and Cup while the pools load), which is the composition lane's and the loader's,
  not the corner's. Named of this lane's and fixed after: on a phone the day's news was cut with an ellipsis (it is
  now two balanced lines at most); "Rank 2" beside "1st of 9" read as a race place (the bar and the title's card now
  say "Rider Rank").
- Named and left for the main lane: ART.md 10 says "vermillion stays on Run Again"; the one button is now the spine's
  ("Finish the mission", "Next Duel: ...", "Today's Daily"), which is still the run-again action under another name.
  The fold-in text below rewords the rule.

## web-design-guidelines

Run over `sequence.ts`, `story.css`, `almanac.ts`, `books.css`, `title.ts`, `phone.css`, `results.ts`, `menus.ts`
(the Vercel Web Interface Guidelines, fetched fresh). Fixed: hover states on the "more" card, the card's Ride It and the
album's count; `touch-action: manipulation` on them; the story section (a focusable dialog, not a control) shows no
focus ring; the flame's heading in Title Case. Clean: every icon-only control has an aria-label (the flame, the
album's count, Details' back); glyphs are aria-hidden; names are `translate="no"`; numbers are `Intl` formatted and
tabular; long text clamps, wraps or ellipsizes with `min-width: 0` on flex children; transform and opacity only,
reduced motion honoured, no `transition: all`; the sheet scrolls with `overscroll-behavior: contain` (shared
`.gs-sheet-body`); focus is visible on every control (the shared `:focus-visible` ring). Open: the album lists about
210 stickers unvirtualised (small cards in a sheet opened on demand; fine at this size).

## What is still short

- **Photo mode** (a Should): not built. Freeing the camera is the render lane's (`render/camera.ts` has the crash
  orbit to start from); the UI part (a pause button that hides the HUD and the card, and saves the canvas) is small
  once the camera can be driven.
- **The album's frames from the reel**: every sticker is a painted card in its mountain's sky; none is rendered from
  its run's record yet (`StickerCard.frame` says where one could be; `reelshow.ts` and `reelcam.ts` would render it on
  idle time). A Should for the next round.
- **The title's shot at its best**: the corner and the line are built round whatever shot `keyart.ts` sets (the
  composition lane's); the softness of its first 2 s and of the phone's is the renderer's warm-up, untouched here.
- **The garage's chapter shelf** is the integration lane's (the month's set on the scarf, trail and paint shelves);
  this lane drew the Lantern Row, not a separate chapter shelf. The Almanac's chapter box names the set and what is
  owned.
- A frame caught mid-story has no button yet (by design: it arrives at about 3.7 s); a critic shown one judges it as
  unfinished. A person should say whether five seconds is too long before the button: Space works from 700 ms.
- The sounds on the beats reuse the results' existing voices (tick, stamp, mallet); a page turning might want its own.

## For the main lane

- `app.ts` carries three new handlers (`onOpenAlmanac`, `onOpenAlbum`, `onResultsBeat`); nothing else to wire.
- The play lane's HUD classes and callouts are untouched (`phone.css` moves only the touch hint pills for the lantern
  and the slipstream).
- `story.css` uses the `gs-sq-` prefix (the race table already owns `gs-st-`).

## Text to fold into ART.md (section 10, round 8)

- **Vermillion is on the one button the results end on** (the run-again action, whatever the spine names it:
  "Run Again", "Rematch Ansel", "Finish the mission", "Next Duel: ...").
- **The results are a story told in about five seconds over the scene, then one button.** The moment; the place with
  the nearest rider named in their colour ("0.4 s behind Old Wren"); Rider Rank's bar filling and stopping short of
  the next page, the page's reward named under it; what opened turned over card by card (a mountain in its own sky);
  the one button, vermillion, its words whole and its reason under it. One column at the far edge (the bottom on a
  phone), so the rider stays the picture. A tap or a key lands it; reduced motion shows the end. Everything else is
  Details, one level down.
- **The title's corner is one stack:** the pill (the flame first: marigold, the lantern's; hollow until today is
  ridden), Rider Rank's card, and the day's one line of news. On a phone it is one row and a short pill.
- **The books** (the Almanac and the Spirit Album) are one sheet drawn like the garage: pages in rows of ten, the next
  outlined; stickers painted in their mountain's sky, silhouettes with where to find them.
- **A touch lesson sits beside the control it teaches,** never in the thumbs' band (the bottom 22% of a phone held
  upright).

## Text to fold into the README

- After a run the results tell it in five seconds and end on one button: what the next run is for. Details holds the
  race, the splits, the missions and every point of XP. The title shows your flame, your Rider Rank and what is new
  today; the Almanac and the Spirit Album open from the rank's card.

## Frames

- Before: `shots/r8/screens/before/` (the integrated build: results after runs 1 and 2 as they build, the title;
  desk and phone).
- After: `shots/r8/screens/after/` and `after3/` (this branch built, the same shots), `after1`..`after3` (the
  harness's `h-*` frames: every sequence state, Details, the title's corner, the calendar, the books, the Lantern
  Row, reduced motion).
- Pairs: `shots/r8/screens/pairs1/` and `pairs2/`; keys and picks in `shots/r8/screens/keys/`.
- HUD: `shots/r8/screens/hudfit/`.
