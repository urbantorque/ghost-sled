# Round 7: rules every lane works to

You are one lane of round 7 of Ghost Sled. Seven lanes run side by side in phase 1; the main lane merges them. Read
this file first, then your own brief.

## Read before you change anything

- `prompts/round-7-from-eight-to-ten.md`: the owner's brief. It is the source of truth for the round's ambition.
- `DECISIONS.md` items 276 and 277 (the review and the plan), and the earlier items your brief names.
- `ART.md`, all of it, and section 15 closely: the art direction for round 7. Every visual change serves it.
- The files you own (below), before you edit them. This codebase is large and careful; match its style and its
  comments' voice (plain statements of what and why, no em dashes, no emoji).

## Where you work

- Your worktree is `C:\Users\roger\OneDrive\Desktop\Ghost Sled\.claude\worktrees\r7-<lane>` on branch `r7-<lane>`.
  Work only there. Never edit the main checkout (`C:\Users\roger\OneDrive\Desktop\Ghost Sled`) or another lane's
  worktree, except to write frames into the main checkout's `shots/r7/<lane>/` (git-ignored) so the main lane can
  read them.
- Commit to your branch as you go, in small commits whose messages say what a player gets. End each message with
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Never merge, rebase onto, push or deploy anything.
- The machine: Windows 11, Git Bash, Node 24, an Intel Arc 130V laptop GPU, 8 cores, 15 GB. There is no Python and
  no ffmpeg on the PATH. Seven lanes share it, so builds, tests and captures are slow: be patient, never run two
  heavy things at once, and never draw a conclusion about frames per second from your own runs.

## What you may not touch

- `DECISIONS.md`, `README.md`, `ART.md`, `LISTENING.md`, `ASSETS.md`: the main lane owns them. Write
  `notes/r7-<lane>.md` instead, in the form of `notes/r6-world.md`: your decisions (each with the reason a player
  would feel and the measurement that shows it worked), the text to fold into ART.md and the README, the cost, what
  the main lane must wire or decide, and where your frames are.
- `src/sim` and `src/bot`: only the `moments` and `feel` lanes edit them. All sim changes ship under one bump,
  `SIM_VERSION = 9`. Those two lanes do not commit regenerated pools (`src/data/ghosts`): the main lane rides the
  pools again after the merge. Run `npm run generate-ghosts` locally if you need current pools to test, and leave the
  result uncommitted (`git checkout -- src/data/ghosts` before you commit).
- Another lane's files (the table below). If you need a change in one, make the smallest possible edit, say so in
  your notes under "Touched outside my files", and expect the main lane to reconcile it.

| Lane | Owns |
| --- | --- |
| `pipe` | `src/render/post.ts` (new passes), `src/render/world.ts` (render targets, the frame's passes, tier plumbing), `src/game/quality.ts`, the Ultra tier, `src/render/lakemirror.ts`, reflections, anti-aliasing, depth of field, motion blur, ambient occlusion, depth-aware shafts |
| `light` | `src/render/palette.ts`, `src/render/sky.ts`, `src/render/materials.ts`, `src/render/terrain.ts`, `src/render/ground.ts`, `src/render/lights.ts` (the implementation), `massif.ts`, `midground.ts`, `overlook.ts` (the far planes), the tone curve and the grade in `post.ts`'s composite pass only, Low's and the phone's designed look |
| `hero` | `src/render/rider.ts`, `ghosts.ts`, `portrait.ts`, `camera.ts`, `speedfeel.ts`, `nearfield.ts`, `src/render/cine.ts` (the writer), `src/game/timescale.ts` |
| `fx` | `src/render/particles.ts`, `trails.ts`, `flora.ts`, `props.ts`, `landmarkKit.ts` (rock forms), `spirit.ts`, `wardfx.ts`, `fireworks.ts`, `chaos.ts` (weather with volume), `sloughs.ts`, `landing.ts`, `skygates.ts` |
| `music` | `src/audio/*`, a new offline renderer under `scripts/music/`, shipped audio under `public/music/`, the jukebox |
| `moments` | `src/sim/moments.ts`, `course.ts`, `mountains.ts`, the set pieces' part of `sim.ts` and `bot.ts`, `src/game/marquee.ts`, `mastery.ts`, `src/ui/momentcopy.ts`, `tests/moments.test.ts`, `tests/fairness.test.ts` |
| `feel` | the wreck and get-up part of `sim.ts`, `src/game/input.ts`, `hints.ts`, `field.ts`, `pacer.ts`, `slowriders.ts`, `run.ts`, `src/bot/pool.ts`, `src/ui/hint.ts`, `touch.ts`, the HUD's get-up and gamepad glyphs |

## What holds for every lane

- **Determinism.** The sim runs at a fixed 60 Hz and ghosts are replays of recorded inputs. Anything that affects a
  run lives in the sim, is seeded, and replays exactly. Nothing may let a player touch, slow or block a ghost, and a
  ghost must be able to use anything a player can. Render, audio and UI never feed back into the sim.
- **Original and cleared to sell.** Every name, shape, image, sound and note is original. Nothing copies or closely
  evokes an existing game, film, soundtrack or artist.
- **The roles of colour in ART.md 1 are locked.** The rider owns vermillion, ghosts own mint, marigold is the
  lantern's.
- **Tests and types stay green.** `npx tsc --noEmit` and `npm test` before every commit (the sim lanes may leave the
  stale-pool check failing, and say so). New systems get tests in the style of `tests/moments.test.ts`,
  `tests/fairness.test.ts` and `tests/determinism.test.ts`.
- **Tiers.** `low`, `medium`, `high` today; the `pipe` lane adds `ultra`. High and Medium must hold 60 fps on this
  laptop and Low must not get heavier: report every lift's cost in draw calls, triangles and, where you can time it,
  frame JS. Anything expensive is gated by tier. The first frame must not get slower: heavy work loads after it.
- **Reduced motion** (`prefers-reduced-motion` and the game's own setting) keeps every beat and drops the motion,
  as the existing code does. Follow the pattern you find.
- **The console stays clean** on desktop and phone.

## Looking at your work

- Build with `npx vite build` and serve with
  `npx vite preview --outDir dist/game --port <your port> --host 127.0.0.1 --strictPort` as a background command.
  Ports: pipe 4410, light 4420, hero 4430, music 4440, moments 4450, feel 4460, fx 4470.
- Drive it with `playwright-cli` and the headless configs only (`.playwright/cli-headless.config.json`, 1280x720;
  `.playwright/mobile-headless.config.json`, 390x844): a headed browser drops to 2 fps when the display sleeps. Use
  your own session name, `-s=r7-<lane>`. One browser at a time. Close your own session when you are not using it
  (`playwright-cli -s=r7-<lane> close`). **Never run `playwright-cli close-all` or `kill-all`**: other lanes are
  mid-capture.
- `scripts/playtest/frames.js` (through `scripts/playtest/frames.sh`) shoots the round's fixed frame set: the same
  35 to 38 distances a mountain on any build and tier, listed in `scripts/playtest/frames-r7.json`. The baseline is
  in the main checkout: `shots/r7/before/high`, `shots/r7/before/low`, `shots/r7/before/phone-medium`. Useful dev
  switches: `?debug&tier=high&autoride=1&m=0..3&mood=N&demo=N` (see the README). The other `scripts/playtest/*`
  tools (set pieces, strips, moments, places, the lab, telemetry) each say how to run them in their first lines.
- `node scripts/playtest/tile.mjs <out.png> <cols> <width> <files...>` tiles frames into a contact sheet.
- **Read your own frames** (open the PNG) before you call anything done. A change you have not looked at is not
  finished. Put before and after at the same distance side by side.
- Write your frames to `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\<lane>\`.

## When you finish

Your last message is read by the main lane, not by the owner. Make it a report:

1. What changed for a player, one line a change, with the commit hashes.
2. What you measured (numbers), what you only saw in scripted runs, and what needs a human to play or hear.
3. What you did not finish, what is fragile, and what the main lane must wire, decide or re-tune after the merge.
4. Where your notes and frames are.

Do not stop early to ask for approval. Make the calls yourself and record why. If something in your brief turns out
to be a bad idea on evidence, do the better thing and say so.
