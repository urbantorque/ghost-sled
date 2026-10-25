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
headed browser drops to a couple of frames a second once the laptop's display sleeps:

| Check | Result |
| --- | --- |
| First playable frame, CPU throttled 6x | 1.1 to 1.3 s |
| High tier at 1x: plain run, Lantern Night, Glass Ice | 60 fps, p90 16.8 ms, no frames over 21 ms |
| High tier through an avalanche chase (scene rendered twice for the mirror), at 1x and CPU throttled 4x | 60 fps at 1x; 59 fps, p90 16.8 ms at 4x (1.2% of frames over 21 ms) |
| Automatic tier on an Intel Arc 130V laptop (starts on Medium, see DECISIONS 39) | 60 fps, p90 16.8 ms |
| Low tier, CPU throttled 6x | 50 to 55 fps over three runs (median frame 16.7 ms) |
| Draw calls and triangles | High 76 and 386k, Medium 71 and 260k, Low 52 and 136k |
| Build size | 1.34 MB unpacked, 404 KB zipped (ghost pools included) |

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
