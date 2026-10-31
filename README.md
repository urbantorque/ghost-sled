# Ghost Sled

An endless downhill sled run for the browser. You carve, drift, pop and trick your way down a
procedural mountain while racing the translucent ghosts of other players' best runs. Every run rolls
a little controlled chaos (a mood, maybe an event), so no two runs feel the same.

Built with Vite + TypeScript + three.js. Every mesh, texture, sound and note of music is generated
in code; there are no asset files.

Screenshots of the final build, captured from live runs on desktop and phone, are in `screenshots/`.

## Run

```bash
npm install
```

```bash
npm run dev
```

Open http://127.0.0.1:5173. Useful URL switches (local mock platform only):

| Switch | Effect |
| --- | --- |
| `?mockAds=1` | Enable mock ads (revive, double gifts, midgame) outside dev |
| `?mockAdFail=1` | Make mock ads fail to test error paths |
| `?platform=mock` | Skip loading the CrazyGames SDK |
| `?c=<record>` | Open a friend's challenge (normally produced by the in-game share button) |

Dev switches (on in `npm run dev`, or anywhere with `?debug`):

| Switch | Effect |
| --- | --- |
| `?fps` | Frame-time overlay (fps, p90, tier) |
| `?tier=low\|medium\|high` | Force a quality tier instead of the automatic one |
| `?autoride=1` | Skip the title and start a run |
| `?m=N` | Mountain 0 to 3 (unlocks ignored) |
| `?mood=N`, `?event=N` | Force a chaos mood or mid-run event |
| `?demo=N` | Replay the Nth-best pool ghost as the player, with its chaos roll |

## Controls

| Input | Steer | Action (one button) |
| --- | --- | --- |
| Keyboard | A / D or arrow keys | Space, Shift, S, W, Up or Down |
| Mouse | Move left / right of centre | Hold any button |
| Touch | Drag on the left 60% of the screen | Hold the right 40% |

Hold the action to crouch (deeper carve, tuck); hold it while steering hard to drift; release to
pop. In the air, steer to spin and press-and-hold to backflip. Tap the action just before
touchdown (when the ring on the snow flashes gold) for a perfect landing. P pauses.

## Build

```bash
npm run build
```

Type-checks, then bundles to `dist/game` with relative paths.

## Test

```bash
npm test
```

| Suite | What it guarantees |
| --- | --- |
| `purity` | `src/sim` and `src/bot` never touch Math.random, engine-dependent Math, DOM, timers or rendering |
| `determinism` | A recorded run replays bit-identically through the real fixed-step loop at 60, 144 and 37 Hz; challenge links round-trip; chaos never moves static geometry |
| `fairness` | Across ~16 km per seed on every mountain and several daily seeds, a lane around the safe line is clear of colliders, ramps and vents, stays in the corridor, is smooth enough to follow at top speed, and a simple driver survives it on the real sim |
| `encoding` | Input logs and run records round-trip; 3-minute runs stay under 2 KB |
| `scoring`, `chaos`, `dmath` | Combo rules, chaos budget (about a third plain, never in a session's first run), deterministic math accuracy |
| `bot`, `ghostpool` | Bots are deterministic and compact; every bundled ghost replays to its stored score |
| `platform` | Ad pacing, idempotent gameplay start/stop, invite links |

## Generate ghosts

```bash
npm run generate-ghosts
```

Runs the bot (`src/bot`) on the real simulation at a spread of skill levels, with human-like
mistakes, and writes `src/data/ghosts/<mountain>.json`. Re-run it whenever simulation behaviour
changes (bump `SIM_VERSION` in `src/sim/sim.ts`; the ghost pool test fails on stale pools). The Daily
Mountain's pool is generated at load by the same bot in a Web Worker.

## Package for CrazyGames

```bash
npm run release
```

Runs the tests, builds, and writes `dist/ghost-sled.zip` (index.html at the root). The script
fails if the unpacked build exceeds 5 MB. Upload the zip in the CrazyGames developer portal and
enable "Progress Save" so the data module is active.

## Performance

Measured on the production build in headless Chrome on the real GPU (an Intel Arc 130V laptop on
mains power), with Chrome's CPU throttling as a stand-in for slower machines. Headless, because a
headed browser drops to a couple of frames a second once the laptop's display sleeps.

The fun pass was measured against the build before it (f8294d8), interleaved run for run in fresh
browser sessions. The laptop was running other work at the same time, so absolute frame rates moved
by up to a factor of two over the day; only the side-by-side figures compare.

| Check | Before the fun pass | After |
| --- | --- | --- |
| First rendered frame, CPU throttled 6x (median of warm runs) | 2.28 s | 2.02 s |
| High tier at 1x: plain run and Lantern Night | 60 fps, p90 16.9 ms | 60 fps, p90 17.0 ms |
| Medium and Low tier at 1x, plain run | 60 fps | 60 fps |
| High tier through an avalanche chase, CPU throttled 4x | 45 fps, p90 33.4 ms (53 on a quieter run) | 41 fps, p90 33.7 ms (50 on a quieter run) |
| Low tier, CPU throttled 6x (median of 6 interleaved runs) | 30.9 fps (29.3 with audio off) | 25.5 fps (29.7 with audio off) |
| Draw calls, High / Medium / Low | 70 / 66 / 45 | 69 / 65 / 43 |
| Web Audio nodes made per second at a steady cruise | 39 | 52 |
| Build size | 1.34 MB unpacked | 1.57 MB unpacked, 477 KB zipped |

The fun pass adds no draw calls on any tier: kilometre arches and graveyard cairns are Medium and
High only, built on idle time after the first frame (DECISIONS 96). What it adds is main-thread
audio: the band grooves from the first cruise, ghosts you pass join as a choir, and every named
moment has its own sound. Voices make their nodes between frames and gift pickups play from
pre-rendered takes (DECISIONS 89), but on a CPU throttled 6x the Low tier still runs a few frames a
second under the build before the fun pass; without audio the two are level.

High renders into an R11G11B10F buffer with 2x MSAA; Medium and Low use FXAA in the composite
pass instead. The tier is chosen automatically, first from the GPU name and then from measured
frame times (`src/game/quality.ts`): it steps down when frames run long or judder and back up when
there is headroom.

## Play-testing

The scripts in `scripts/playtest` drive the real game with keyboard and touch input through
`playwright-cli` (npm package `@playwright/cli`) against the preview build
(`npx vite build`, then `npx vite preview --port 4173`):

```bash
playwright-cli -s=gs open --config=.playwright/cli-headless.config.json
```

```bash
playwright-cli -s=gs run-code --filename=scripts/playtest/shots.js
```

| Script | What it does |
| --- | --- |
| `shots.js` | The critique set (title, overtake, perfect landing, chaos reveal, four moods, results) with frame stats |
| `carve.js` | Holds the line, then throws a hard carve into a drift |
| `avalanche.js`, `perf-avalanche.js` | Outruns an avalanche and shoots the mirror, or records frame times on High at 4x CPU throttle |
| `menus.js` | The sled shop, and a Medium-tier run for comparison |
| `mobile.js` | Phone portrait with real touch drags (open the session with `.playwright/mobile-headless.config.json`) |
| `avalanche-portrait.js`, `results-phone.js` | The avalanche chase and the results screen at phone size (portrait or landscape, from the session's viewport) |
| `feel.js`, `kicker.js`, `events.js` | Feel tuning, kicker pops and landings, every mid-run event |
| `perf.js` | The performance table's probes (forced tier, CPU throttle, mood, event) with draw calls and triangles |
| `telemetry.js` | Fun telemetry: scripted runs at five skill levels (novice, mid, expert, line, stunt) logging passes, duels, named moments per minute, the time to the first pass, whether the race is live at the crash, music intensity, flow, drift tiers, near-miss grades, stomp streaks, mission pops and banner overlaps |
| `strips.js` | Beat strips: 4 to 6 frame-exact screenshots after each named moment, on a virtual clock, with a probe per frame (plans `fresh`, `rivals`, `flow`, `stunt`, `avalanche`, `giftStorm`) |
| `levels.js`, `audio-capture.js` | Mix levels from offline renders of the shipped DSP, and the live master tapped per frame (onsets, sync to the picture, the choir) |
| `stunt-sim.ts` | The stunt pilot in node, without a browser: `npx tsx scripts/playtest/stunt-sim.ts [runsPerMountain] [firstSeed] [mood]` |

## Fun pass play-test

Telemetry from scripted pilots (`telemetry.js`), the same plan and seeds on both builds: 8 fresh
novice first runs, 6 mid and 6 expert runs on Pinecrest, and 8 runs of the stunt pilot (a skilled,
human-like rider) on Frostfang and Pinecrest.

| | Novice before | Novice after | Stunt before | Stunt after |
| --- | --- | --- | --- | --- |
| Race live at the crash (a ghost within reach) | 3/8 | 8/8 | 0/8 | 1/8 (4/8 on the round 1 build) |
| Share of the run with the race live | 0.70 | 0.97 | 0.30 | 0.65 |
| First named moment | 5.3 s | 0.6 s | 5.8 s | 0.6 s |
| Missions popped mid-run, all runs | 0 | 13 | 0 | 22 |
| Mean music intensity (0 to 1) | 0.20 | 0.40 | 0.27 | 0.43 |
| Named moments per minute | 16.8 | 19.3 | 22.2 | 27.9 |

With 8 runs a pilot, run lengths vary a lot from build to build, and so does how many ghosts are
still near at the crash: the stunt pilot rode further on the final build (median 2,010 m), past
most of the field. The stunt pilot reaches In the flow in 5 of 8 runs and a stomp streak of 13;
novices never reach flow, by design. Runs are faster after (novice 18.7 to 21.1 m/s), because the
field now rides with you and gives more slipstream, and the first pass you see comes later (5.3 to
8.9 s), because start-line jostles in the first 6 s are muted.

A fun panel of six critics, two for each lens (game feel; race drama; the first session and the
reason to return), rated beat strips (`strips.js`) and the telemetry out of 10 against Alto's
Odyssey, Mario Kart Tour, Tony Hawk's Pro Skater and Subway Surfers. Each panel scored the builds
side by side; the fix rounds between them came from the panel before:

| Panel | Before | Fun pass | Fix round 2 | Fix round 3 |
| --- | --- | --- | --- | --- |
| First | 4.02 | 6.10 | | |
| Second | 3.93 | 5.65 | 6.14 | |
| Third | 3.93 | | 5.94 | 6.28 |

Every judge scored each round above the one before, but each panel also marked the previous build
down once its defects showed beside the fixes, so the third round's rise (+0.34 paired) did not
clearly clear the panel's own noise, and the loop stopped there.

## Layout

| Path | Contents |
| --- | --- |
| `src/sim` | Deterministic simulation: course generation, sled physics, scoring, chaos, input log, replay |
| `src/bot` | Ghost bot and pool generator |
| `src/game` | App flow, fixed-step loop, input, ghosts manager, saves, missions, quality tiers |
| `src/render` | three.js world: terrain, props, rider, ghosts, trails, particles, sky, post FX, camera |
| `src/audio` | Procedural audio and generative music |
| `src/ui` | DOM overlay screens |
| `src/platform` | CrazyGames SDK v3 wrapper and local mock |
| `src/workers` | Ghost replay and daily pool worker |

See `PLAN.md` for the architecture, `ART.md` for the art bible and `DECISIONS.md` for every call
made along the way.
