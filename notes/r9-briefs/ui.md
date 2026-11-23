You are the `ui` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames: Vite,
TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is **milestone 1's U1 to U3: build
the title and the results the owner approved, on the round's tokens, in the game itself.** The owner's words: the
screens are not as clean and intuitive as they can be; the title and the results carry a lot of distracting text, and
they are a bit confusing.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-ui` on branch `r9-ui`.
Read `notes/r9-lanes.md` in your worktree first; its rules hold (one browser on the machine, through the slot; the
heavy slot; CRLF; the trailer; shared files; no edits to DECISIONS, README or ART; frames under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/ui/`; your port 4950). Then read DECISIONS 388 to 393 (the
decisions are made: build them), the brief `prompts/round-9-clear-screens-a-garage-worth-it.md` (section 2 "The
screens", section 4 milestone 1, sections 5 and 6), ART.md all of it (section 10 closely), and milestone 0's design:
`notes/r9-screens.md` all of it (the map, the plan, the copy pass, the tokens, the critics' three rounds, section 7's
build order and risks) and its working prototypes (`prototypes/r9/title.ts`, `results.ts`, `screens.css`, `proto.ts`,
`fixtures.ts`; open `prototypes/r9/screens.html` on your dev server), and `notes/r9-truth.md` (today's figures, the
Escape table, what the review missed). `src/ui/tokens.css` is already in the game (imported before `style.css`).

## What to build, in this order (each green before the next: tsc, the touched tests, the console clean)

1. **The results (U2).** Three beats over the scene: how you did (the place, the word, the time, one fact in words);
   the one reward that matters most, turned over, with Rider Rank's bar and the gifts at its foot; the one button
   with its reason, then Home, Photo and Details. About 2.5 s, landed by a tap or a key; every step skippable;
   reduced motion lands it whole; the directed sequence's skeleton and the rank bar's tick kept, its sounds through
   `onResultsBeat`. The button is always the run (Run Again, Rematch, Next Duel, Today's Daily, Ride <mountain>); a
   mission is only ever its reason. An unlock either is the button, when it is the best next thing, or is named and
   waits: no second primary, no Ride It beside it. Everything else (XP by source, splits, the race, missions,
   stickers, contracts met, the league's move) goes to Details, one level down. Save Clip moves to Details beside
   Watch Your Run. The copy pass of `notes/r9-screens.md`: no "+1", no "Page N", no bare figures, every label
   something a player says, and the XP a run shows adds up to what it says. Files: `src/ui/results.ts`,
   `sequence.ts`, `story.css`, `meta.css`, `reel.css`, the results' model in `spineview.ts` and `app.ts`.
   - **`src/game/goals.ts`:** stop offering a mission whose target was met before it was drawn (or count that run),
     so "done before, so again" can never show; the vitest bar in `tests/r9screens.test.ts` turns into a plain test.
   - **`fmt.ts` `rewardsLine`:** the 19 Almanac pages named with a bare "+1" get words (the other vitest bar).
   - **"Ready in the shop"** becomes a button that opens the garage at that piece through the app's existing path
     to the garage (the `shop` lane rebuilds the garage behind that path; agree nothing with it, just call the path).
2. **The title (U1).** The logo; the mountains as a picker of chips with short names, the picked one larger with its
   best in words, its hour and mirror under Ride once open; Ride with its reason on it; one quiet line of what you are
   working toward; four labelled doors that open rooms (on a desk from the logo's side, on a phone from the bottom):
   **Daily and Cup** (wearing the flame: the flame and its calendar, the Daily, **the day's contracts**, the Cup and
   **its league table**, the Trial), **Progress** (Rider Rank and the Almanac, The Twelve, the Long Night, the
   album, medals, missions), **Garage** (wearing the gifts; it opens the garage) and **Settings**. Something new is
   introduced once, by a "New" on its door and one line in its room (`TitleSpine.intro`). Nothing loading is shown
   (a room's Choose waits for its field). Ride never promises a duel the run is not (`TitleTwelve.rides`). **The
   contracts and the league have models and no screen today** (`spineview.ts` builds them, nothing draws them): build
   them in the Daily and Cup room. The rooms are a dynamic import, not in the first download. Files:
   `src/ui/title.ts`, `screens.css`, `hours.css`, `trials.css`, new room files under `src/ui/`, the title's model in
   `app.ts` and `spineview.ts`, the types in `contract.ts`, and the ghost tags' panels (`Title.measure()`).
   - **ART.md 10 changes with it** (decision 392): no mountain name or feeling line under the logo (the feeling stays
     on the veil), short names on the chips, the title's corner stack gone. Write the replacement text into your
     notes; the main lane edits ART.md.
3. **Escape.** Escape and Backspace close the top room, sheet or Details (B already closes sheets), focus returns to
   the control that opened it; in fullscreen the browser takes Escape first, which is fine. `menus.ts:14` holds
   today's deliberate unbinding: change that one place and say why in its comment. The title's four popovers today
   take no focus and no B: whatever of them survives in your rooms takes focus and closes on Escape and B. (U4, the
   other screens in the same language, is a later lane's: do not restyle the Almanac, album, settings or pause.)
4. **The third critic's faults** (DECISIONS 391): a duel's reason never sets a rival's slower time against the
   player's best ("2:23.6 to beat" over "Best 2:04.8" reads as already beaten); the moment's chip stays clear of the
   rider (inside the headline's rule); a place and a medal are said so they cannot read as disagreeing ("3rd" over "a
   silver time"); the phone's chips do not cut "Lanternfall".
5. **U3 for what you touched:** the title and results built from the tokens' card, buttons (primary, secondary,
   quiet, words on every one), type scale and motion; the rules they replace deleted from `style.css`, `screens.css`,
   `story.css` and `meta.css` as they die (count lines before and after). The HUD is untouched.

## The bars, on the real game with the fixtures, desk (1280x720 and a wide screen) and phone (390x844)

Section 2 "The screens" at runs 1, 5, 20 and 50 (mid and novice) and the results' cases (a first finish, a podium, a
crash, a duel won and lost, the Cup, a Trial, the Daily): the title at run 50 at most 40 words and the results' first
view at most 35, on the desk and the phone both; one primary and nothing styled like it; no lone icons on the title
and the results (a visible word on every control); plain figures; said once; never loading; nothing lost (every
system in at most two taps from the title by pointer, keyboard, pad and touch, named to a screen reader; contracts
and the league now among them; photo and clips judged from pause and the results); Run Again to riding under 2 s
(today 101 to 395 ms). Re-run `scripts/playtest/r9-truth.sh` for the captures and `r9-screenbars.ts` for the
figures; turn each bar that now passes into a plain test. Look at every frame yourself.

Then **judge it blind:** fresh critics (`model: "opus"`, `effort: "xhigh"`, only ART.md and the frames) on today's
screens (round-9's base, from `shots/r9/truth/`) against yours, on seeded sides, with section 2's five-second
questions at runs 1, 5, 20 and 50 and the results' cases; score their answers against the truth; fix worst first;
then a second fresh critic. Also run the web-design-guidelines skill over every changed UI file.

## Deliver

Commits on `r9-ui` (the game changes; the HUD and the sim untouched; `tests/garage.test.ts` and the full suite
green in the heavy slot before your last commit); `notes/r9-ui.md` with what changed for a player screen by screen,
the counts today against yours (desk and phone), the bars' figures, the critics' answers and scores, the CSS lines
before and after, every hunk in a shared file, the ART.md 10 text, what only scripts have seen, and what the main
lane must decide. Frames under `shots/r9/ui/`. Stop your server and close your browser at the end. Your final
message: what a player now sees, the bars' figures, the critics' scores, and what the main lane must decide.
