# Ghost Sled - Plan

An endless downhill sled run for CrazyGames. You carve, drift, pop and trick down a procedural
mountain while racing translucent ghosts of other players' best runs. This file is the build plan;
`ART.md` is the visual bible and `DECISIONS.md` records every call where I deviated from or
interpreted the brief.

## 1. Architecture

```
src/
  sim/         Deterministic simulation. No rendering, DOM, timers or Math.random/transcendentals.
    prng.ts      sfc32 PRNG + integer hashing (seed, chunk) -> stream
    dmath.ts     deterministic sin/cos/atan2/exp/sqrt built from + - * / only
    noise.ts     seeded value noise (1D/2D) for course shape
    mountains.ts mountain + biome generation parameters (pure data)
    course.ts    Course = f(seed): sections, centerline, width, safe line, ground height, chunks
    chunk.ts     per-chunk features: obstacles, ramps, drops, moguls, gifts (pure f(seed, index))
    sleds.ts     sled definitions and their tiny traits
    chaos.ts     chaos roll (mood + mid-run event) and their sim parameters
    input.ts     packed per-tick input byte + compact run-length input log codec
    scoring.ts   combo / style / score rules
    sim.ts       Sim: fixed 60 Hz step(input) -> state + events
    replay.ts    RunRecord <-> compact binary <-> base64url (challenge links, saves, pool)
    missions.ts  mission predicates over run stats (pure)
  bot/         Bot driver that plays the real Sim with skill + human-like mistakes
  game/        Orchestration: fixed-step loop, run lifecycle, ghosts manager, draft detection,
               progression, save, quality tiers
    director.ts  sim events + race + save -> one Beat[] per frame (the named moments)
    beats.ts     the Beat contract the HUD, audio and world all read (frozen; orchestrator-owned)
    race.ts      pass words, duels, the rival pill's ghost and its held gap
    field.ts     which ghosts ride: built around where this player usually crashes
    stake.ts, streak.ts, finales.ts, hints.ts, graveyards.ts, intensity.ts, timescale.ts
                 bank tiers and the fuse, stomp streaks, event finales, teach-move hints, named
                 crash spots, the band's drive, hitstop and slow motion
    progress.ts, settle.ts  mid-run pops, the next unlock, results lines; settling a run into the save
  render/      Three.js: terrain chunks, props, rider, ghosts, trails, particles, sky, post FX, camera
  audio/       WebAudio: procedural wind/surface, reward synths, generative soundtrack
  ui/          DOM overlay screens (title, intro reveal, HUD, results, menus)
    contract.ts  the UI facade's models and handlers (frozen; orchestrator-owned)
    beatsui.ts   the overlay's half of the beats contract: routes each Beat to the HUD, fx or banners
  platform/    CrazyGames SDK v3 wrapper + local mock (standalone)
  workers/     ghost.worker.ts: replays ghost input logs and runs the daily bot pool
scripts/       generate-ghosts.ts (bundled pool), package.ts (zip)
tests/         vitest: purity, determinism, fairness, encoding, scoring, chaos
```

Dependency direction: `sim` imports nothing outside `sim`. `bot` imports `sim`. `render`, `audio`,
`ui` read sim state but never write it. `game` is the only place that feeds inputs into a Sim.

### Beats
Every named moment (a pass, a duel and its result, a stomp streak, a bank, a whisker, flow in and
flow broken, a mission pop, a finale) is a Beat. Once per frame the director turns the sim's events,
the race and the save into one ordered list, and the HUD (`ui.beats`), the audio (`audio.beats`) and
the world (`world.frame`) each read that same list. A moment that is not a beat gets no sound,
callout or camera move of its own, so nothing celebrates twice or out of step. Beats are
presentation only: the score stays in the sim, and any gifts a beat pays are credited by the app.

### Determinism model
- Fixed timestep 60 Hz, tick counter is the only clock. Render interpolates between the previous and
  current sim state, so 30, 60, 144 and 240 Hz displays see identical simulations.
- `sfc32` seeded by integer hashes. `Math.random` is banned in `src/sim` and `src/bot` (test-enforced).
- Transcendental `Math.*` functions are also banned in the sim: engines are not required to return
  identical results for `Math.sin` etc., and ghost pools are generated in Node but replayed in Safari
  and Firefox. `dmath.ts` implements them from IEEE-exact `+ - * /` and `Math.sqrt`.
- A run is reproducible from `{seed, chaos roll, sled, input log}`. Anything external that the sim
  depends on (being in a ghost's slipstream, a revive) is written into the input log as a per-tick bit
  or an event token, so a replay never needs the ghosts that were present.
- Static course geometry is `f(seed)`. Chaos only adds dynamic entities, physics multipliers and
  visibility; it never moves terrain, obstacles or static gifts.

### Input log
Per tick: steer level 0..8 (4 bits), action held (1 bit), draft (1 bit). Encoded as
`value byte + varint run length`; escape bytes >= 0x80 carry events (revive). A keyboard run produces
~2 changes per second, so 3 minutes is about 0.8 KB; analog mouse/touch steering is quantized with
hysteresis to stay under 2 KB. Tests assert the bound with bot runs.

### Ghosts
- A worker replays each ghost's RunRecord through the same Sim and returns a Float32Array trajectory
  (sampled every 2 ticks and interpolated, transferable), plus crash point and trick events.
- The main thread computes the draft bit each tick from the player's state and the ghost frames at
  the same tick, then logs it.
- Selection: 5 pool ghosts scored just above the player's best, the player's own best ("YOU"), the
  grudge ghost (closest rival who beat you last run), and a friend's challenge ghost if present.
- The bundled pool is produced by `scripts/generate-ghosts.ts` running the bot across skill levels.
  The Daily Mountain pool is generated in the worker at load with the same bot.

## 2. Build order (vertical slices)

1. Scaffold Vite + TS + Three + Vitest. Purity test first.
2. **Feel slice**: course + ground function + sled physics + input + chase camera + basic terrain
   render. Play-test in Playwright (scripted inputs, screenshots, frame times) and tune until carving,
   drifting, popping and landing feel great. Determinism + encoding + fairness tests.
3. **Ghost slice**: run records, worker replay, bot, ghost pool generation, draft, overtakes, crash
   markers, grudge, challenge link.
4. **Chaos slice**: moods + events, reveal card, telegraphs, per-mood palettes and physics.
5. **Loop slice**: combo/scoring polish, missions, sleds, mountains, Daily Mountain, results flow,
   instant "Run Again".
6. **Polish slice**: ART.md direction across terrain, props, rider, ghosts, sky, particles, post FX,
   camera; procedural audio + generative music; quality tiers.
7. **Platform slice**: CrazyGames SDK v3 adapter + mock, gameplay start/stop, ads, happytime, data.
8. **Critique loop**: 8+ screenshots rated against premium mobile games, fix anything below 8,
   performance pass until High tier holds 55+ fps; package `dist/ghost-sled.zip`.
9. **Fun pass**: skill legibility, the race as a story, run shape, an earned soundtrack and reasons to
   return, through the director and the beats contract (DECISIONS 70 to 89). No sim change: the one
   batched sim change was deferred to the next round (DECISIONS 70).

## 3. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-engine float drift breaks ghosts | No transcendental Math in sim; dmath + test; pool replay test re-verifies stored scores |
| Feel tuned by guessing | Debug overlay with live constants; Playwright input scripts; bot telemetry (speeds, airtime) |
| Mobile GPU too slow | Instanced props, one terrain material, custom cheap bloom, tier auto-select by frame time |
| Input log over 2 KB with analog input | Quantized steer with hysteresis; test with jittery bot inputs at 3 min |
| Chaos feels unfair | Every hazard telegraphed >= 2.5 s ahead with audio + visual; fairness test covers static line; avalanche tuned so a clean cruising player survives |
| Generated line impassable | Safe line generated first, obstacles rejected near it; geometric test + sim-driven line-follower test |
| First frame over 3 s | No asset fetches; generation is lazy per chunk; title renders before ghost worker finishes |
| SDK script unreachable / standalone | Dynamic load with timeout, falls back to mock; every SDK call goes through one wrapper |
| OneDrive folder slows node_modules | Accept; keep dependency count tiny |

## 4. Open questions and chosen defaults

| Question | Default chosen |
| --- | --- |
| Controls on touch | Left 60% of screen: drag to steer (relative stick). Right 40%: hold = crouch/drift/tuck, release = pop. Mouse: X position steers, hold button = action. Keyboard: A/D or arrows steer, Space/Shift/S/Down = action. Physical key codes, so AZERTY works |
| One action button or separate jump/drift | One "crouch" button: hold to carve deeper / drift / tuck-flip, release to pop, tap just before touchdown to stomp a perfect landing |
| What is the score | Distance in metres + banked style points. Style is banked when a combo ends; bailing loses the pending combo |
| What does "passing" a ghost mean | Course progress overtakes the ghost at the same run time, or you ride past its crash marker |
| Run length target | Skilled runs 2 to 4 minutes; difficulty ramps over the first 4 km |
| Revive | One rewarded-ad revive per run, logged as an input-log event so replays stay exact |
| Midgame ads | Only on "Run Again", never in the first 3 runs, at most once per 4 runs and 3.5 minutes |
| happytime | New personal best (once per run, at most every 2 minutes), beating a grudge ghost |
| Challenge recipient's first run | Plain conditions (first run of a session is never chaotic); the rematch uses the challenger's mood/event |
| Ghost tick rate | Sampled every 2 ticks (30 Hz) and interpolated, about 200 KB per ghost per 5 minutes |
| Fonts and icons | System font stack with heavy weights; small geometric SVG glyphs written in code (no icon library allowed) |
| Locale | English only for v1; SDK locale read and stored for later localisation |

## 5. Critique loop record

Each round, three independent critics (art direction, game UI, store appeal) rated the same 18
live-capture screenshots out of 10 against premium mobile games (8 = polished commercial release);
four engineers with strict file ownership then fixed what they flagged, and the set was re-shot.

| Round | Mean | Range | What the round rated (DECISIONS items) |
| --- | --- | --- | --- |
| 3 | 6.74 | 5.5 to 7.5 | Earlier art passes (22 to 46) |
| 4 | 6.74 | 5.5 to 7.67 | Earlier art passes (22 to 46) |
| 5 | 6.70 | 5.5 to 7.67 | Snow takes less sun colour, softer shadows, FXAA on Medium, shop portraits (47 to 53) |
| 6 | 6.93 | 5.67 to 7.83 | Own shadow light, staged results, rider readable from behind (54 to 59) |
| 7 | 7.10 | 6.0 to 7.67 | Ghosts never cover the rider (C10), toy face, forest results camera (34, 60 to 66) |
| 8 | 7.11 | 6.17 to 7.83 | Race-gap grammar (C12), avalanche wall, carved grooves, low sparks (65, 67 to 69) |
| 9 | 7.00 | 6.17 to 7.67 | Ghost glass tinted on every fade, near-lens ghosts dissolve (34) |

The loop stopped at round 9: the means of rounds 7 to 9 sit within the panel's own round-to-round
spread, so further rounds were no longer measurable progress. The brief's target (every frame 8 or
more) was not reached: in round 9 frames sit between 6.2 and 7.7, with the phone title and Glass
Ice each drawing 8 from two of the three critics. The panel's recurring asks: a rounder rider model (the
box limbs and the back of the head), an avalanche that reads as a wall in the world rather than at
the frame's edge, ghosts that read as racers on sleds rather than standing figures, and a crash
tableau with the sled upside down beside the rider.

## 6. Fun pass record

The fun pass (DECISIONS 70 to 96) was judged by telemetry from scripted pilots and by a fun panel of
six critics (game feel, race drama, the first session and the reason to return) rating beat strips
against Alto's Odyssey, Mario Kart Tour, Tony Hawk's Pro Skater and Subway Surfers. Each panel's top
fixes became a fix round in file-disjoint lanes, each lane checked by an adversarial verifier.

| Panel | Before | Fun pass | Fix round 2 | Fix round 3 |
| --- | --- | --- | --- | --- |
| First | 4.02 | 6.10 | | |
| Second | 3.93 | 5.65 | 6.14 | |
| Third | 3.93 | | 5.94 | 6.28 |

The loop stopped after the third panel: every judge still scored the new round higher, but each
panel marked the previous build down once its defects showed beside the fixes, so the rise no longer
clearly cleared the panel's own noise. Its open asks are the next round's list: skill, not cruising,
building the soundtrack; one race word per beat (the see-saw of passes and take-backs); hints that
never overprint; the start call's reason on screen and the first visit's goals; a Low-tier answer to
the soundtrack's main-thread cost; and the one batched sim change (DECISIONS 70).
