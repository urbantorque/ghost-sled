You are the `screens` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is milestone 0's first design
for the owner: **the information map, the information plan, and the title and results as working HTML in the game's
own style, desk and phone, judged blind against today's.** The owner's words: the screens are not as clean and
intuitive as they can be; the title and the results carry a lot of distracting text, and they are a bit confusing.
Do not refine the status quo: you may replace a screen wherever a player would feel it. Do not delete a system to
declutter: move it, merge it or put it behind one door, but keep every system reachable.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-screens` on branch
`r9-screens`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (one browser on the machine, through the
slot; CRLF; the trailer; no edits to DECISIONS, README or ART; frames under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/screens/`; your port 4930). Then read the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (all; section 1 "The screens", section 2 "The screens", section 4
milestone 0's item 1 and milestone 1 U1 to U4, section 6 closely), ART.md all of it (section 10, the UI, closely;
section 1's roles are locked: vermillion is the primary action and the player, mint is ghost info, marigold gifts and
the lantern), DECISIONS 371 and 372 (the spine and round 8's screens), `notes/r8-spine-design.md`, `notes/r8-screens.md`
and the review frames and texts in `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/review/` (`desk.json` holds
each screen's text and buttons). Use the design-taste-frontend skill for the new UI, and check your pages against the
web-design-guidelines skill before you call them done.

The `truth` lane works beside you: it builds save fixtures (mid and novice at runs 1, 5, 20, 50, 100), a dev switch
`?debug&save=<name>`, shoots every screen at every stage with its words and controls counted, and writes the screen
bars as tests. Read its notes and captures as they land:
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/.claude/worktrees/r9-truth/notes/r9-truth.md` and
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/truth/`. Do not wait for it to begin: the code is the source.

## The items

1. **The information map.** List every system (rank and Almanac, album, flame, gifts, bests, The Twelve, the Cup and
   its league, Trials, the Daily and contracts, missions, medals, mastery, the Long Night, hours, mirrors, photo,
   clips, the garage), and for each every place it shows (title, results' first view, Details, the HUD, a sheet, a
   popover, a toast) and what a player does there (reads, chooses, starts a run, buys). From the code
   (`src/ui/title.ts`, `results.ts`, `sequence.ts`, `menus.ts`, `notices.ts`, `contract.ts`, the CSS sheets, the
   title's and results' models in `src/game/app.ts`) and the frames. This map is what the redesign moves. Also when
   each system first appears for a player (which run, which page) on the mid and novice pilots' careers.
2. **The information plan.** What the title is for at runs 1, 5, 20 and 50 (one job at a time: the scene is the
   hero, Ride is the one thing to press with its reason on it, one quiet line of what you are working toward); what
   leaves the main screen and behind which labelled door it goes (the brief proposes three: the week's and day's
   events; your progress; the garage. Argue for it or for better); the mountain strip as a picker; each thing said once;
   nothing shown loading; new systems introduced once, in one line, when a player first has them. For the results:
   three beats (how you did, in words; the one reward that matters most, opened; what's next, the one button), and what
   moves to Details; no second primary; a copy pass where every label is something a player says.
3. **The design system (U3's tokens) as a proposal:** one type scale, spacing, radii, one card, one button hierarchy
   (primary, secondary, quiet), one icon set with labels, one motion language, written as CSS custom properties in one
   small sheet the prototypes use and the garage lane can use too (`prototypes/r9/tokens.css`). Grounded in ART.md 10
   and today's sheets (count what today's 11 sheets define and which of it is dead; the brief says about 15,000 lines).
4. **The title and the results as working HTML,** desk (1280x720 and a wide screen) and phone (390x844), in the game's
   own style (its type, ink panels, vermillion primary, the pills), not static pictures: the title at runs 1, 5, 20 and
   50 with its doors open and shut; the results for a first finish, a podium, a crash, a duel won and lost, a Cup, a
   Trial and the Daily, first view and Details. Over a captured frame of the game as the backdrop (the scene stays the
   hero, so leave it room). Keyboard, pad-style focus and touch work on the prototype's controls; Escape closes what it
   opens; reduced motion respected. Put them under `prototypes/r9/` (served by your dev server) or as new scenes in the
   UI harness with fake models; the release's boot path does not change. Count each prototype's words and controls the
   way the truth lane counts the live screens.
5. **Judge it blind.** Show fresh critics (`model: "opus"`, `effort: "xhigh"`, given only ART.md and the frames, never
   told which is new) today's screens and yours, paired on seeded sides, at runs 1, 5, 20 and 50 and for the results'
   cases, with section 2's questions: shown the title, what will the big button do, what are you working toward, where
   is the garage; shown the results, how did the run go, what did it earn, what does the button do next; and which
   screen is clearer and why. Score their answers against the truth. Fix what they find, worst first, and run a second
   fresh critic.

## Deliver

Commits on `r9-screens`; `notes/r9-screens.md` with the map, the plan (title by stage, the doors, results' beats and
Details, the copy pass's before and after for every label you change), the tokens, the counts (today against yours),
the critics' answers and scores, what the main lane must decide, and what milestone 1 would build (files, order, risk).
A single page `prototypes/r9/screens.html` the owner can open on the dev server, linking every prototype state, desk and
phone. Frames under `shots/r9/screens/`. Stop your server and close your browser at the end. Your final message: the plan
in a few lines, today's and your counts, the critics' scores, and what the main lane must decide.
