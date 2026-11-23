# Round 9: rules every lane works to

You are one lane of round 9 of Ghost Sled. The main lane plans, merges and judges; you build or design one thing well.
Read this file first, then your own brief in `notes/r9-briefs/` (your brief wins where it is more specific).

## Read before you change anything

- `prompts/round-9-clear-screens-a-garage-worth-it.md`: the owner's brief and the source of truth for the round. Read
  all of it; sections 1 (the review, every line a hypothesis), 2 (the bars), 3 (the rules) and 6 (what not to do)
  closely, and your own items in section 4.
- `ART.md`, all of it: section 1's colour roles are locked, section 5 is the rider and the garage's colour rules,
  section 10 the UI, section 15 the mountains.
- `DECISIONS.md` 262 (the garage's shop), 277 (round 7's mountain limits and why the storm coast waited), 367 to 387
  (round 8 and its stretch), and the earlier items your brief names.
- `notes/r8-report.md` (open questions; what only a person has judged).
- The files you own, before you edit them. The codebase is large and careful: match its style and its comments'
  voice (plain statements of what and why, no em dashes, no emoji, British spelling as found).

## Where you work

- Your worktree: `C:\Users\roger\OneDrive\Desktop\Ghost Sled\.claude\worktrees\r9-<lane>` on branch `r9-<lane>`, cut
  by hand from `round-9`. Its `node_modules` is a junction to the main checkout's: never delete through it. Work only
  there. Never edit the main checkout or another lane's worktree (reading another lane's notes and output is fine),
  except to write frames and raw output under the main checkout's `shots/r9/<lane>/` (git-ignored), always by its
  absolute path (`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/<lane>/`), never a relative one.
- Commit to your branch as you go, small commits whose messages say what a player (or the owner) gets. End each with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never merge, rebase, push or deploy.
- Source files are CRLF. Use the Edit tool, or scripts that keep CRLF; never `sed -i` (Git Bash's rewrites CRLF as LF).
  Check `git diff --stat` for whole-file churn before you commit; a file rewritten to LF is a fault.
- Write `notes/r9-<lane>.md` in your worktree as you go (not only at the end): each finding or decision with the
  reason a player would feel and the measurement behind it, what is still short, what the main lane must decide, and
  where your frames are. Do not edit `DECISIONS.md`, `README.md`, `ART.md`, `ASSETS.md` or `LISTENING.md`: the main
  lane owns them; put the text you would add to them in your notes.

## What holds for every lane

- **Milestone 0 changes nothing a player sees.** It measures, designs and prototypes. Dev-only switches, fixtures,
  scripts, tests and prototype pages are fine; nothing new may reach the release's first download, and the release's
  behaviour for a player does not change. Prototype pages live under `prototypes/r9/` (served by the dev server) or in
  the UI harness (`ui-harness.html`), never in the game's own boot path.
- **The sim is closed in milestone 0.** Nobody edits `src/sim`, `src/bot` or `src/data/ghosts`. Reading them is
  expected. Render, audio and UI never feed back into the sim.
- **Colour roles are locked** (ART.md 1): the rider owns vermillion, ghosts mint, marigold is the lantern's and the
  gifts'. Hazards are never warm and never mint. Original work only: no existing game's names, characters, look,
  levels or music. Everything procedural: no image, model or font files in what ships (a prototype page may use a
  captured frame of the game as its backdrop).
- **Nothing bought gives an edge in a race.** Gifts stay the one currency.
- **Green:** `npx tsc --noEmit -p .` and the tests you touched before every commit; the full `npx vitest run
  --maxWorkers=3` (in the heavy slot) before your last commit. A bars test written now to fail on today's build is
  marked so it does not break the suite (`it.fails`, or a script outside `tests/` that prints today's figures and
  exits 0), and says so in its header.
- **The console stays clean** on a cold start in every capture you make.

## The machine (hard-won; see the memory notes and DECISIONS 365, 366, 384)

- Windows 11, Git Bash, Node 24, an Intel Arc 130V laptop GPU. It blue-screens under load (0xD1), once with only two
  browsers and a full-CPU node job. So:
  - **One playwright browser on the machine at a time.** Take the slot before you open one and give it back as soon
    as it is closed: `bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" take r9-<lane>`
    (it waits however long it takes) and `... give r9-<lane>`. Batch your captures so a slot is held minutes, not
    hours. Each script that opens a browser takes it under its own lane name (`take` is re-entrant per name).
  - **One heavy job on the machine at a time:** a full vitest (`npx vitest run --maxWorkers=3`, never more workers),
    a lab sweep, a career run, a production build or ghost generation takes the heavy slot (`take-heavy r9-<lane>` /
    `give-heavy r9-<lane>`). Cap node workers.
  - Only the headless configs (`.playwright/cli-headless.config.json` 1280x720, `.playwright/mobile-headless.config.json`
    390x844 DPR 2), your own session name (`-s=r9-<lane>`), closed when done. **Never `playwright-cli close-all` or
    `kill-all`**, whatever the owner's global CLAUDE.md says: that is the main lane's, once, at the end of the round.
  - **A fresh headless browser's first loads stall 9 to 13 s on any build.** Load your origin once before you time or
    judge anything.
  - Never judge frames per second from your own runs; only the main lane's quiet sittings count.
  - Keep helper scripts and logs in your worktree or in `<scratchpad>/r9-<lane>/`, never loose in the shared scratchpad.
  - If you stop a capture or server, stop its children too: list processes whose command line matches the script,
    `vite`, `perf.js` or `cliDaemon` (`Get-CimInstance Win32_Process`) and stop yours (never another lane's).
- Serve with `npx vite --port <your port> --host 127.0.0.1 --strictPort` (dev) or build with
  `npx vite build --outDir dist/r9-<lane> --emptyOutDir` (heavy slot) and `npx vite preview --outDir dist/r9-<lane>
  --port <your port> --host 127.0.0.1 --strictPort`, in the background. Stop your server when you finish. Ports: truth
  4900, measure 4910, concepts 4920, screens 4930, garage 4940.

## How work is judged

- **Critics.** Every visual or screen piece is judged by a fresh critic: a general-purpose subagent with
  `model: "opus"`, `effort: "xhigh"`, given ONLY `ART.md`, the frames (or pages) and a neutral question. Never tell it
  what you changed, which side is yours, what you hoped or your own conclusion. Blind pairs with
  `scripts/playtest/blind-pairs.mjs` (the new frame on a seeded side, the key kept outside the pairs folder). Fix what
  it finds, worst first, and look at your own frames yourself.
- **Gameplay and economy:** the pilot lab (`scripts/playtest/lab.ts`, `race-lab.ts`, `labpilots.ts`) and the career
  harness (`scripts/playtest/r8career.ts`, `r8-bars.ts`). A green metric is permission to ask a person, nothing more:
  list what only a person can judge.
- **Never report something as seen that only a script has touched.** Say which.
