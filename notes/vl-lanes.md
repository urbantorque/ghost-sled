# The visual lift: rules every lane works to

You are one of five lanes of the visual lift that follows round 7 of Ghost Sled. The owner asked: "Implement all of
these in an optimised way that makes most sense for the game. I want the end result to look more polished than it is
now." The five lifts are DECISIONS 360; the plan is 361. The main lane merges the five branches. Read this file
first, then your own brief.

## Read before you change anything

- `DECISIONS.md` 360 and 361 (this work), 284 to 293 (the round 7 pipeline: tiers, passes, shadows, edges, the shelved
  TAA), 342 and 358 (what five critics found on every mountain, and the shared fixes), 343 and 359 (performance).
- `ART.md`, all of it, section 15 closely (the direction by mountain and "Tiers, designed"). Every change serves it.
- `notes/r7-lanes.md`: round 7's lane rules. All of them hold here, with the names below in place of round 7's.
- The files you own (your brief), before you edit them. Match the codebase's style and its comments' voice (plain
  statements of what and why, no em dashes, no emoji).

## Where you work

- Your worktree: `C:\Users\roger\OneDrive\Desktop\Ghost Sled\.claude\worktrees\vl-<lane>` on branch `vl-<lane>`,
  cut from `visual-lift`. Its `node_modules` is a junction to the main checkout's: never delete through it.
- Work only there. Write frames to the main checkout's `shots/vl/<lane>/` (git-ignored) by its absolute path, never
  a relative one (round 7 lost 161 MB of frames to a mis-resolved `C:\c\...`).
- Serve your build with `npx vite preview --outDir dist/vl-<lane> --port <your port> --host 127.0.0.1 --strictPort`.
- Commit to your branch as you go, small commits whose messages say what a player sees. End each with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never merge, rebase, push or deploy.
- Write `notes/vl-<lane>.md` in your worktree (in the form of `notes/r7-shared.md`): what each fault was and where it
  was drawn, what changed and why, how it was judged and the critic's verdict, the cost before and after, shared code
  touched, what is still short, and where your frames are.

## What holds

- **The sim is closed.** No change to `src/sim`, `src/bot` or `src/data/ghosts`. Render, audio and UI never feed back
  into the sim. Determinism and the ghosts are untouched by anything a lane does.
- **ART.md 1's colour roles are locked:** the rider owns vermillion, ghosts mint, marigold is the lantern's.
- **Original:** every shape, image and sound made here, in code. No outside textures, models or shaders copied in.
- **Green:** `npx tsc --noEmit -p .` and `npx vitest run` before every commit. New systems get tests in the style of
  `tests/pipeline.test.ts`, `tests/spiritlights.test.ts` and `tests/rockforms.test.ts`.
- **The console is clean** on a cold start on every tier you touch, and in every capture.
- **Machine:** Windows 11, Git Bash, Node 24, an Intel Arc 130V laptop GPU. Five lanes share it: never judge frames
  per second from your own runs, never run more than two playwright browsers of your own at once, headless configs
  only (`.playwright/cli-headless.config.json`, `.playwright/mobile-headless.config.json`), your own session names,
  and never `playwright-cli close-all` (only the main lane runs it). Close what you open.

## Budgets (the brief's bars still hold: High and Medium 60 fps, Low not worse, the first frame not slower)

Measure cost the way the frames' JSON does (draw calls and triangles summed over every pass of a frame), the GPU's
pass times with `?gpu` (`__gs.world.post.pipe.timer.ms`), and a Low frame's script with `scripts/playtest/systime.js`
(each world system's milliseconds a frame at 6x). Report before and after in your notes.

| Tier | Draw calls (round 7 settled) | New full-frame passes | Script a frame on Low at 6x |
| --- | --- | --- | --- |
| Ultra and High | at most +2 over 96 to 104 | allowed if priced and paid back | n/a |
| Medium (the phone's tier) | at most +1 over 87 to 95 | none unless it replaces one | n/a |
| Low | at most +2 while visible | none | not above round 7's (about 10 to 12 ms) |

Nothing new may run before the first frame (`gs-first-frame`): bakes and builds go on idle time, as the landmarks and
props do. If your work needs a pass the budget forbids, say so in your notes with its price; do not ship it hidden.

## How a lane judges its work

1. **Before:** round 7's final frames are in `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\final\{high,medium,
   low,phone-medium}` (the fixed list `scripts/playtest/frames-r7.json`, all five mountains). Use them; reshoot a
   before set from your own worktree's first commit only if your measure needs it (motion, or a probe).
2. **After:** `scripts/playtest/frames.sh <your base> <abs path>/shots/vl/<lane>/after desk "high low" "0 1 2 3 4"` and
   the phone (`phone "medium"`), plus whatever in motion your lift needs (a virtual-clock replay, as
   `scripts/playtest/motion30.js` and the shared lane's `shots/r7/shared/tools/motion.js` do), the same frames on both
   builds.
3. **A critic:** one fresh subagent (general-purpose, `model: "opus"`, `effort: "xhigh"`), given ONLY `ART.md`, the
   pairs' paths and this question: for each pair, is the after better, worse or the same on your lane's lift, and what
   broke. Tell it nothing of what you changed or intended. Fix what it finds, worst first; look at your own after
   frames beside the before; a second critic only if the first found real faults.
4. **Contact sheets:** `scripts/playtest/round-sheets.sh` (before beside after, labelled) into your frames folder.

## Who owns what

| Lane | Owns | Shared files it may touch, in its own functions |
| --- | --- | --- |
| `temporal` | `src/render/postfx/{taa,pipeline,tiers,depth,quad,timing}.ts`, `src/render/post.ts` (all but the composite's grade), `src/game/quality.ts`, `world.ts`'s render targets and the lens's jitter | `rider.ts`, `ghosts.ts`, `particles.ts`, `camera.ts` hooks for motion |
| `farlight` | a new `src/render/farshadow.ts`, `terrain.ts`, `world.ts`'s shadow setup | `materials.ts` (one function in `LIGHT_GLSL`, one uniform), `props.ts`, `midground.ts`, `massif.ts` read-only accessors |
| `light` | `materials.ts`'s shading terms (new GLSL chunks), `postfx/ao.ts` | `post.ts` composite (a few lines, by the temporal lane's leave), `palette.ts` (new fields, neutral by default) |
| `props` | `meshes.ts`, `flora.ts`, `landmarkKit.ts`, `lanternkit.ts`, `rockforms.ts`, `groves.ts`, `town.ts` signage, a new geometry helper | `props.ts` batches |
| `poster` | `palette.ts` `tierLook` and Low's fields, `sky.ts`'s Low path, a new `src/render/poster.ts`, `src/ui` results layout on a phone | `materials.ts` Low branches, in their own chunk |

Where two lanes touch one file, each keeps its edit to its own new functions and the smallest change to shared code,
with a comment saying why, and lists it in its notes. The main lane reconciles them.
