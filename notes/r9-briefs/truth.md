You are the `truth` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is milestone 0's ground truth
for the screens: **see every screen at every stage of a player's life, count what it says, and write the screen bars
as tests that fail today.**

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-truth` on branch
`r9-truth`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (one browser on the machine, through the
slot; the heavy slot for career runs and the full vitest; CRLF; the commit trailer; no edits to DECISIONS, README or
ART; frames under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/truth/`; your port 4900). Then read the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (all; section 1 "The screens", section 2 "The screens", section 4
milestone 0 closely) and the review frames and texts in `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/review/`
(`desk.json` holds each screen's visible text and buttons; `scripts/playtest/r9-review.js` made them on the live site).

## The items

1. **Save fixtures from the lab.** The career harness (`scripts/playtest/r8career.ts`, used by `r8-bars.ts`) rides the
   real sim and settles every run into a real save through the game layer, with a fake clock moving the days. Use it
   to write the mid and novice pilots' saves at runs 1, 5, 20, 50 and 100 (ten fixtures; a fresh save is the eleventh,
   `fresh`). Say in your notes what the harness does not settle that the app does (the album's frames, Trials, the
   Long Night, hours picked, the flame's dates), and fill what you can honestly, so a run-50 save looks like a real
   run-50 player's. Write them where the dev server can load them and the release never ships them (for example
   `scripts/playtest/fixtures/*.json` read through a dev-only dynamic import, or `public/` excluded from the package;
   prove with a build that `dist` and the first download do not grow). A script regenerates them
   (`scripts/playtest/r9-fixtures.ts`, heavy slot).
2. **`?debug&save=<name>`** (dev only, behind the same gate as the other dev switches in `app.ts`): loads a fixture
   as the save before the title opens, with its dates moved to today so the flame, the Daily, contracts, the Cup's
   week and the chapter read as a real player's would. It never writes over a real save without the switch. A test.
3. **Shoot every screen at each stage, desk and phone,** on your dev server with the fixtures, extending
   `scripts/playtest/r9-review.js` (or a sibling script it calls), the headless configs, one browser at a time:
   - the title: fresh, returning at runs 1, 5, 20, 50 and 100 (mid and novice), a challenge link (`?c=`), the Cup and
     the Trial picked, the Daily;
   - the results: a first finish, a crash, a duel won and a duel lost, the Cup, a Trial, the Daily, the Long Night
     (between legs and at the end), each at the first view (when the directed sequence has landed) and Details;
   - everything else: every garage shelf, the Almanac, the album, medals, missions, the flame's calendar, settings,
     pause and photo mode, The Twelve, the league, the Trial's card, every popover.
   For each shot record in one JSON per form factor: the visible words (count words a reader would read, not hidden
   or zero-opacity text; say how you count), the controls (each with its label or aria-label, whether it is styled as
   a primary, whether it is an icon with no visible label), and figures shown without a word beside them. Frames as
   `<form>-<stage>-<screen>.png`. Load your origin once before judging anything (first loads stall 9 to 13 s).
4. **Check Escape and the pad's B** on every sheet and popover: does each close, and where does focus go? The review
   found Escape did not close the garage. Record a table; do not fix it (that is U4's).
5. **The screen bars as tests and scripts, failing today, with today's figures recorded.** From section 2 "The
   screens": words (title at run 50 at most 40, results' first view at most 35, a fresh title no worse than today);
   one primary per screen and no lone icons; plain figures (no "+1", "14 /212", "Page 5", a bare flame count; write
   the detector and list what it catches); said once (no message twice on a screen: write a detector, say what it can
   and cannot catch) and never loading ("Finding rivals" and the like shown as content); nothing lost (every system in
   the list below reachable in at most two taps from the title by pointer, keyboard and pad, and named to a screen
   reader: crawl it); as fast as today (Run Again to riding, measured several times after a warm load). Make the
   browser checks a script that reads your capture JSON, and the pure ones vitest tests over the harness
   (`ui-harness.html`, `src/ui/harness.ts`) where they can be; both print today's figures. The systems: rank and
   Almanac, album, flame, gifts, bests, The Twelve, the Cup and its league, Trials, the Daily and contracts, missions,
   medals, mastery, the Long Night, hours, mirrors, photo, clips, the garage.
6. **Check section 1 "The screens" line by line** against what you see: what is right, what is wrong, what it missed.
   Blunt, with the frame or the code line for each. The main lane folds it into DECISIONS.

## Deliver

Commits on `r9-truth`; `notes/r9-truth.md` with the fixtures (what each holds: rank, gifts, mountains open, Twelve
beaten, systems open), the capture table (screen by stage by form factor: words, controls, primaries, lone icons, bare
figures), the Escape/B table, the bars and today's figures, the line-by-line check, and how to re-run everything. Also
keep the capture JSON and frames in `shots/r9/truth/` for the screens lane, which designs from them while you work:
write each stage's frames as soon as they exist, and say in your notes which are done. Stop your server and close your
browser at the end. Your final message: what you found (biggest first), today's figures on every bar, and what the main
lane must decide.
