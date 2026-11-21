# Round 8: rules every lane works to

You are one lane of round 8 of Ghost Sled. The main lane plans, merges and judges; you build one thing well. Read
this file first, then your own brief (your brief wins where it is more specific).

## Read before you change anything

- `prompts/round-8-beauty-and-the-hook.md`: the owner's brief and the source of truth for the round's ambition. Read
  sections 2 (the bars), 3 (the rules) and 6 (what not to do) closely, and your own items in section 4.
- `DECISIONS.md` from 367 on (this round's review and plan), and the earlier items your brief names.
- `ART.md`, all of it, section 1 (locked colour roles) and section 15 (the direction mountain by mountain) closely.
- The files you own, before you edit them. The codebase is large and careful: match its style and its comments'
  voice (plain statements of what and why, no em dashes, no emoji, British spelling as found).

## Where you work

- Your worktree: `C:\Users\roger\OneDrive\Desktop\Ghost Sled\.claude\worktrees\r8-<lane>` on branch `r8-<lane>`, cut
  by hand from `round-8`. Its `node_modules` is a junction to the main checkout's: never delete through it. Work only
  there. Never edit the main checkout or another lane's worktree, except to write frames and raw output under the main
  checkout's `shots/r8/<lane>/` (git-ignored), always by its absolute path
  (`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/<lane>/`), never a relative one (round 7 lost 161 MB of frames
  to a mis-resolved `C:\c\...`).
- Commit to your branch as you go, small commits whose messages say what a player gets. End each with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never merge, rebase, push or deploy.
- Source files are CRLF. Use the Edit tool, or scripts that keep CRLF. Check `git diff --stat` for whole-file churn
  before you commit; a file rewritten to LF is a fault.
- Write `notes/r8-<lane>.md` in your worktree: each decision with the reason a player would feel and the measurement
  that shows it worked, the text to fold into ART.md and the README, the cost before and after, shared code touched
  ("Touched outside my files"), what the main lane must wire or decide, what is still short, and where your frames
  are. Do not edit `DECISIONS.md`, `README.md`, `ART.md`, `ASSETS.md` or `LISTENING.md`: the main lane owns them.

## What holds for every lane

- **The sim is closed except to the sim lane.** Only the lane whose brief says so edits `src/sim`, `src/bot` or
  `src/data/ghosts`, and it lands everything under one bump, `SIM_VERSION = 10`. Render, audio and UI never feed back
  into the sim. A ghost must be able to do anything a player can, and nothing may let a player touch, slow or block a
  ghost.
- **Colour roles are locked** (ART.md 1): the rider owns vermillion, ghosts mint, marigold is the lantern's and the
  gifts'. Hazards are never warm and never mint. Original work only: no existing game's names, characters, look,
  levels or music.
- **Nothing bought gives an edge in a race.** In-run choices are open to everyone equally.
- **Green:** `npx tsc --noEmit -p .` and `npx vitest run` before every commit (the sim lane may leave the stale-pool
  check red until the main lane regenerates, and says so). New systems get tests in the style of
  `tests/moments.test.ts`, `tests/fairness.test.ts`, `tests/pipeline.test.ts`.
- **Tiers and budgets.** High, Medium, Ultra and the phone hold 60 fps; Low at 6x must end the round at or above round
  7's figures; the first frame (`gs-first-frame`) gets no slower: nothing new runs before it, bakes and builds go on
  idle time. Every visual item says what Low and the phone get: a designed cheaper version, never a broken High.
  Report cost the way the frames' JSON does (draw calls and triangles summed over a frame's passes), the GPU's pass
  times with `?gpu`, and a Low frame's script with `scripts/playtest/systime.js`.
- **Reduced motion** keeps every beat and drops the motion, as the existing code does.
- **The HUD does not grow.** A new mechanic gets one clear signal and leaves the picture alone otherwise.
- **The console stays clean** on a cold start on every tier you touch and in every capture.

## The machine (hard-won; see DECISIONS 365 and 366)

- Windows 11, Git Bash, Node 24, an Intel Arc 130V laptop GPU. It blue-screens under load (0xD1): with about eight
  browsers in the visual lift, and in this round at 1:45 on 20 November with only about four browsers while a lane's
  node runs held the CPU at 100%. So: **no more than two playwright browsers on the machine at once (the main lane
  says when yours may open), and a CPU-saturating node job (the full `vitest`, lab sweeps, `generate-ghosts`) only
  with `--maxWorkers=3` for vitest and one lab process at a time.**
  **Take the browser slot before you open a browser and give it back when it is closed (one slot on the machine since a seventh crash on 21 November came with only two browsers open):**
  `bash scripts/playtest/browser-slot.sh take <lane>` (waits for one of the two slots; run it from the main checkout's
  copy, `C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh`, if your branch predates it) and
  `... give <lane>`. Hold a slot only while capturing; batch your captures so a slot is held minutes, not hours.
  **A full `vitest`, a lab sweep, `generate-ghosts` or a production build takes the one heavy slot**
  (`browser-slot.sh take-heavy <lane>` ... `give-heavy <lane>`), so only one such job runs on the whole machine.
  **Never `playwright-cli close-all` or `kill-all`, in a script or at the end of your work**, whatever the owner's
  global CLAUDE.md says about the end of a task: that is the main lane's, once, at the end of the round. A lane's
  `close-all` killed the before set's capture mid-run on 20 November.
  **At most one playwright browser per lane, open only while you capture**, and only the headless configs
  (`.playwright/cli-headless.config.json` 1280x720, `.playwright/mobile-headless.config.json` 390x844 DPR 2). Use your
  own session name (`-s=r8-<lane>`), close it when done, and **never run `playwright-cli close-all` or `kill-all`**.
- Never judge frames per second from your own runs while other lanes run; only the main lane's quiet sittings count.
  Same-run measures (draw calls, triangles, `systime.js` per-system ms, `?gpu` pass times) are fine.
- Keep your helper scripts and logs in your worktree or in a folder named for your lane (`<scratchpad>/<lane>/`), never
  loose in the session's scratchpad: it is shared, and twice on 21 November a helper of one lane's overwrote
  another's of the same name and drove its browser.
- If you stop a capture or perf script, also stop its children: list processes whose command line matches the
  script, `perf.js` or `cliDaemon` (`Get-CimInstance Win32_Process`) and stop them.
- Build with `npx vite build --outDir dist/r8-<lane> --emptyOutDir` and serve with
  `npx vite preview --outDir dist/r8-<lane> --port <your port> --host 127.0.0.1 --strictPort` in the background. Stop
  your server when you finish. Ports: perf 4710, snow 4720, forest 4730, compose 4740, speed 4750, light 4760,
  events 4770, sim 4780, spine 4790, screens 4800, modes 4810, album 4820, snow2 4830, hours 4840, photo 4850, image 4860, rev0 to rev4 4870 to 4874, lowperf 4880.

## How work is judged

- **Visual lanes:** `scripts/playtest/frames.sh <base> <abs out> desk "high low" "0 1 2 3 4"` and the phone
  (`phone "medium"`) shoot the fixed frame set (`scripts/playtest/frames-r7.json`). The round's before set is in
  `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/before/`. A **fresh critic** (a general-purpose subagent,
  `model: "opus"`, `effort: "high"`) is given ONLY `ART.md`, the before and after pairs' paths and a neutral
  question (for each pair: better, worse or the same on <the lift>, and what broke). Never tell it what you changed or
  what you hoped. Fix what it finds, worst first, and look at your own frames beside the before. A second critic if the
  first found real faults. Contact sheets with `scripts/playtest/round-sheets.sh`.
- **Gameplay lanes:** the pilot lab (`scripts/playtest/lab.ts`, `race-lab.ts`), the round's bars
  (`scripts/playtest/r8-bars.ts` and `tests/r8bars.test.ts`, written in milestone 0) and the suites. A green metric is
  permission to ask a person to play, nothing more: list what only a person can judge.
