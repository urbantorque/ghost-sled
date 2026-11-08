# Ghost Sled

A downhill sled race for the browser. You carve, drift, pop and trick your way down a 4.5 km descent,
through ravines, frozen lakes, village streets and off real cliffs, racing the translucent ghosts of
twelve signature riders and a crowd of others to a finish town. Spirit lights on the brave lines, and
your skill, fill a lantern you either spend on a dash (through trees, faster) or keep as a ward that
takes the next hit. Each mountain's biggest places play as set pieces, and a board of goals on each
teaches it. Every run rolls a little controlled chaos (a mood, maybe an event), so no two runs feel the
same.

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
| `?demo=N` | Replay the Nth-best pool ghost as the player, with its chaos roll (it dashes and wards as it did) |
| `?riders=N` | Dress the field as the signature riders from roster index N (render only) |

## Controls

| Input | Steer | Action (one button) |
| --- | --- | --- |
| Keyboard | A / D or arrow keys | Space, Shift, S, W, Up or Down; E, Q or Enter to dash |
| Mouse | Move left / right of centre | Hold the left button; the right button dashes |
| Touch | Drag on the left 60% of the screen | Hold the right 40%; tap the lantern to dash |

Hold the action to crouch (deeper carve, tuck); hold it while steering hard to drift; release to
pop. In the air, steer to spin and press-and-hold to backflip. Tap the action just before
touchdown (when the ring on the snow flashes gold) for a perfect landing. P pauses.

The lantern (three cells, top right; a round button on touch) fills from spirit lights and from skill.
A full one is a dash: 1.4 s as a spirit, faster, through any tree or rock in the way. Kept, it is a
ward: the next hit that would floor you is taken by the lantern instead. After a wreck, "Ride home as
a spirit" rides the rest of the descent outside the race (Escape returns to the card).

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
| `determinism` | A recorded run replays bit-identically through the real fixed-step loop at 60, 144 and 37 Hz, and however the course is read between ticks; a course is the same in any read order; every seed builds a descent; challenge links round-trip; chaos never moves static geometry |
| `fairness` | On every mountain and several daily seeds, to the finish and through the run-out, a lane around the safe line is clear of colliders, ramps and vents, stays in the corridor and is smooth enough to follow at top speed, each promise of a shape holds (a leap's height and landing, a ravine's walls, a lake's flatness, a bridge's fall, a tunnel's clear air, a fork's ridge and rejoin), and a simple driver gets down it on the real sim |
| `encoding` | Input logs and run records round-trip; 3-minute runs stay under 2 KB |
| `scoring`, `chaos`, `dmath` | Combo rules, chaos budget (about a third plain, never in a session's first run), deterministic math accuracy |
| `bot`, `ghostpool` | Bots are deterministic and compact; every bundled ghost replays to its stored score |
| `platform` | Ad pacing, idempotent gameplay start/stop, invite links |
| `migration` | A save and a link from an older sim lose nothing: replays move byte for byte to an archive, old bests show without blocking new ones, a grudge's tally survives, an old link is a target to beat |
| `standing`, `finishflow`, `field` | Race order by time, the finish flow, and a field built around your pace |
| `ladder`, `cup`, `rivalry`, `slowriders`, `pacer` | Ladder ranks and stage medals, the weekly Cup, the run's rival, and the paced riders that fill the slow end of the race, and the clocks of riders who read you |
| `ground`, `setpieces`, `overlook`, `midground`, `palette`, `feel` | World rules: nothing stands in the run, no stretch stays bare past about 300 m, the forest stands on the ground it is drawn over, each mountain keeps its own light, and the speed curves reach the cap |
| `moments` | Set pieces: three a named mountain, one a stage, each with its verb; a Daily's own; the ring lines in the course's one list of rings; the race machine's and the fall's schedules; a rider who steers at the gates wins Old Town and a replay agrees; mastery stars are the verbs beaten |

## Generate ghosts

```bash
npm run generate-ghosts
```

Runs the bot (`src/bot`) on the real simulation at a spread of skill levels, with human-like
mistakes, and writes `src/data/ghosts/<mountain>.json` in race order, with each ghost's stage splits.
Each pool is 30 crowd runs and one run by each of the twelve signature riders (`src/bot/roster.ts`), ridden
with its style. `npm run generate-ghosts -- --falls` re-reads where each ghost fell (wards count) without
riding anything again.
The slowest bots finish in about 2:30, so `src/game/slowriders.ts` fills the race down to 5:00 at load
with real runs played at a slower pace. Re-run it whenever simulation behaviour
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

The visual round (DECISIONS 102 to 109: painted skies, the sun's journey, the rounded rider, ghosts
on glass sleds, forest variants and bank dressing, the avalanche in the world) was measured the
same way against the build before it, over four interleaved rounds. The laptop ran slower that day
than the figures above, so again only the side-by-side figures compare:

| Check | Before the visual round | After |
| --- | --- | --- |
| High tier at 1x: plain run, Lantern Night, Glass Ice | 60 fps, p90 17 ms | 60 fps, p90 17 ms |
| High tier through an avalanche chase, CPU throttled 4x (median of 4) | 28.5 fps | 29 fps |
| Low tier, CPU throttled 6x (median of 4) | 17 fps | 17.5 fps |
| Draw calls, High / Low | 73 / 44 | 73 / 41 |
| Triangles, High / Low | 351k / 108k | 752k / 113k |

High's triangles doubled because each forest batch carries two tree variants and collapses the
unused one in the vertex shader (DECISIONS 106); Low keeps one variant. The course's z functions are
memoised (DECISIONS 109), which paid for the new effects' extra ground queries on throttled CPUs.

The world-scale round (DECISIONS 110 to 116: the mountain panorama, the mid-ground and its
villages, set pieces and crowds, ambient life, the directing camera, painted snow and bough pines)
was measured the same way against the build before it, in two interleaved rounds:

| Check | Before the world-scale round | After |
| --- | --- | --- |
| High tier at 1x: plain run and Lantern Night | 60 fps, p90 17 ms | 60 fps, p90 17 ms |
| Medium tier at 1x, plain run | 60 fps | 60 fps |
| Low tier, CPU throttled 6x | 18 and 19 fps | 27 and 21 fps |
| High tier through an avalanche chase, CPU throttled 4x | 45 and 47 fps | 28 and 40 fps |
| Draw calls, High / Medium / Low | 73 / 69 / 41 to 43 | 80 / 76 / 41 |
| Triangles, High / Medium / Low | 752k / 514k / 113k to 117k | 1.2M / 809k / 169k |

The throttled avalanche chase is the one regression: frame CPU rises about 12% across the new
systems and draw submission. The quality manager steps such a machine down to Medium, which holds
60 fps at 1x. The mirror inset leaves the mid-ground, set pieces and life out.

The second world-scale round (DECISIONS 117 to 124: overlooks, ride-through villages and enclosed
runs, the soundscape, hero moments, a living sky, forest LOD) was measured against the build before
it on a quiet machine, interleaved run for run. High and Medium rode 75 s, far enough to reach a
village:

| Check | Before round two | After |
| --- | --- | --- |
| High tier at 1x: plain run and Lantern Night | 60 fps, p90 17 ms | 60 fps, p90 17 ms |
| Medium tier at 1x, plain run | 60 fps | 60 fps |
| High tier through an avalanche chase, CPU throttled 4x (2 runs) | 37 and 56 fps | 43 and 53 fps |
| Low tier, CPU throttled 6x (median of 5, range) | 51 fps (26 to 55) | 43 fps (28 to 56) |
| Draw calls, High / Medium / Low | 80 / 76 / 43 | 89 / 84 / 45 |
| Triangles, High / Medium / Low | 1.21M / 809k / 173k | 780k / 526k / 125k |
| Build size, unpacked | 1.57 MB at the fun pass | 2.0 MB |

The forest's LOD paid for the round's geometry and more. Low at 6x throttle swings from about 26 to
56 fps on both builds from run to run, with every system slowing together in the slow runs, so the
difference is inside its noise; the systems the round added cost about 3% of Low's frame CPU. Low
makes only the soundscape's takes it plays, and none during a run.

The wow pass (DECISIONS 125 to 217: real places on a 4.5 km course, 30 m/s, three stages, a finish town)
was measured against the build before it (3565a14) on a quiet machine, interleaved in fresh sessions (old,
new, new, old) with saves cleared between probes. High and Medium rode a whole descent, so the heaviest
places are in the sample. The frame bars at 1x were run again on the final commit, and the throttled probes three times each in rotation with the old build. One High pass of the four on the final commit dropped to 48 and 51 fps for a second; the other three did not, with a worst second of 59 or 60, so I read that as the machine.

| Check | Before the wow pass | After |
| --- | --- | --- |
| First rendered frame, CPU throttled 6x (median of 6, not rerun after the last round of fixes) | 2.85 s | 2.63 s |
| High tier at 1x, whole descent, Pinecrest and Frostfang | 60 fps, worst second 59, p90 16.8 ms | 60 fps, worst second 59, p90 16.8 ms |
| High tier at 1x, Lantern Night on Sakura | 60 fps, p90 16.8 ms | 60 fps, p90 16.8 ms |
| Medium tier at 1x, whole descent, Pinecrest and Ember | 60 fps, worst second 60 | 60 fps, worst second 60 |
| Phone layout, Medium and Low tiers | 60 fps | 60 fps, worst second 59 on Low |
| Phone layout, avalanche chase | 60 fps | 60 fps |
| High tier through an avalanche chase, CPU throttled 4x (median of 3) | 59 fps, worst second 56 to 58 | 54 fps, worst second 48 to 50 |
| Low tier, CPU throttled 6x, a very first run: Pinecrest, Ember, Sakura (median of 3) | 45, 50, 55 fps | 41, 44, 45 fps |
| The same with riders out of frame, as most of a returning run is | 45, 50, 55 fps | 47, 50, 48 fps |
| Low tier, CPU throttled 6x, worst second | 38 to 42 fps | 36 to 39 fps, 30 to 38 with riders out of frame |
| Draw calls settled, High / Medium / Low | 89 / 84 to 87 / 45 to 48 | 90 to 94 / 86 to 89 / 44 to 48 |
| Draw calls at the peak: a whole descent on High, a chase | 93, 128 | 100, 137 |
| Triangles settled, High / Medium / Low | 780k / 526k / 124k | 887k / 651k / 160k |
| Triangles at the peak: a whole descent on High, a chase | 1.1M, 1.13M | 1.13M, 1.33M |
| Build size, unpacked | 2.0 MB | 2.2 MB |
| Build size, zipped | 607 KB | 683 KB |

Low is the one bar this pass misses. At 1x it holds 60 on the desktop and in the phone layout, but at 6x a
very first run is 4 to 10 fps under the old build, 9 to 18%, worst on Sakura. That is the price of riders
staying in frame (DECISIONS 206): a probe clears its save, so every probe is a first run, and turning the
riders' reading off gives 47, 50 and 48 fps, which is Pinecrest above its old figure, Ember level and Sakura
7 under. Nearly all of the gap is the page's work round the labels and pills, not the scene. Landing the
figures on one beat fixed that once (DECISIONS 205). Landing the labels on it too gave back about a third of
the page work in a trace, but did not clearly move these figures (DECISIONS 217). Hiding the labels on a
struggling device would give 6 to 15% more frames at the cost of the names. The 4x chase loses 5 fps; frame JS
there is up only 0.6 ms, the rest is a heavier scene on a CPU slowed fourfold, it is above what every earlier
round measured for this probe, and at 1x it holds 60. High draws 99 to 103 under Lantern Night on Sakura, up from 90 to 92,
and holds 60.

The build grew by 229 KB, past the 2.0 MB the brief asked to hold near, and I think it is worth it: 193 KB of
code in the main bundle for the authored stages, places, moments, ladder and results, 25 KB in the ghost worker
(which carries its own copy of the sim and course), 10 KB of CSS and the rest in longer ghost pools. There are
no asset files in it. It stays under half the 5 MB limit.

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
| `places.js`, `sheets.sh` | Rides any mountain on the safe line at a set speed and shoots a list of distances, or every site of the kinds named; the contact sheets of every street, bridge, tunnel and finish |
| `places-cost.js`, `cost-run.sh` | Draw calls, triangles and frame times riding through a place; compare two builds interleaved |
| `review.js` | The player review's screens: a fresh title, a first run's results, the second run, the returning title, the shop, the Daily and the Cup |
| `lantern.js` | A replayed or hands-off run, shot at every dash, ward and sky gate, at fixed distances and (`marquee: true`) as each set piece comes up and in its middle, with the lantern's counts |
| `homeward.js` | Wrecks a run by holding one key, rides home as a spirit to the town and checks the card comes back unchanged |
| `life.js` | The living background: rides to distances and shoots bursts, clips or a fixed lens at the crowds; with `find` it picks the nearest herd, fox on a rock, perched flock, sledding kid or drop-in ahead and shoots it frame-exact on a virtual clock as the rider comes |
| `places-plan.ts` | What stands where on each mountain, by mood, the longest bare stretch and what each piece costs, without a browser |
| `descent.js`, `finish.js` | A whole descent without a teleport (are pieces made ahead of the rider?), and the last leap, the line and the stop |
| `vista.js` | The world-scale set: the title, then a replayed best run (`?demo=0`) down each mountain, shot at 300, 1500, 2600 and 3900 m |
| `shots.js` | The critique set (title, overtake, perfect landing, chaos reveal, four moods, results) with frame stats |
| `carve.js` | Holds the line, then throws a hard carve into a drift |
| `avalanche.js`, `perf-avalanche.js` | Outruns an avalanche and shoots the mirror, or records frame times on High at 4x CPU throttle |
| `menus.js` | The sled shop, and a Medium-tier run for comparison |
| `mobile.js` | Phone portrait with real touch drags (open the session with `.playwright/mobile-headless.config.json`) |
| `avalanche-portrait.js`, `results-phone.js` | The avalanche chase and the results screen at phone size (portrait or landscape, from the session's viewport) |
| `feel.js`, `kicker.js`, `events.js` | Feel tuning, kicker pops and landings, every mid-run event |
| `perf.js`, `perf-ab.sh` | The performance table's probes (forced tier, CPU throttle, mood, event) with draw calls and triangles, peaks included; two builds interleaved, old, new, new, old, then the phone |
| `pagework.js` | DOM writes by element and the frame callback against the frame interval, for two states of one build; `perf.js` takes `noread` to tell a first run's riders from the world |
| `firstrun.js` | A very first run from the rider's seat: a fresh save, frames at set distances and who is near at each |
| `profile.js` | A CPU profile of a forced-tier run summed by function, per frame and per 100 m of course, for an unminified build (`npx vite build --minify false --outDir ...`); with `event: 1` it waits for a chase |
| `lab.ts` | The pilot lab: rides clumsy, novice, mid, expert, line, stunt and rail pilots and scripted bad input on the real sim in node, across all four mountains and several seeds. `--root <checkout>` loads the sim from another checkout, so one plan rides two builds |
| `anatomy.ts` | What a course is: each mountain's sections, widths, slopes, cliffs, and the longest plain stretch |
| `forks.ts` | Rides each fork both ways with bots of one skill, to show whether the risk route pays on the real sim |
| `tour.js`, `sweep.js`, `sheet.mjs` | Fixed comparison frames: a clumsy first run, a skilled run on every mountain to the finish, and a pinned sweep of any stretch, laid out as contact sheets (two builds side by side with `--vs`) |
| `migrate.js` | The clean break end to end: a real save and link from one build, carried to another, checked byte for byte |
| `moments.js`, `readability.js` | Beat strips of tumbles, grinds, wall rides, leaps and the finish; how far ahead the road reads at speed |
| `places.js`, `places-cost.js`, `descent.js`, `finish.js` | Rides each street, bridge, tunnel and finish town and shoots or costs them |
| `telemetry.js`, `tele-digest.mjs` | Fun telemetry: scripted runs at six skill levels (clumsy, novice, mid, expert, line, stunt) logging passes, duels, named moments per minute, the time to the first pass, whether the race is live at the crash, music intensity, flow, drift tiers, near-miss grades, stomp streaks, mission pops and banner overlaps |
| `strips.js` | Beat strips: 4 to 6 frame-exact screenshots after each named moment, on a virtual clock, with a probe per frame (plans `fresh`, `rivals`, `flow`, `stunt`, `avalanche`, `giftStorm`) |
| `levels.js`, `audio-capture.js` | Mix levels from offline renders of the shipped DSP, and the live master tapped per frame (onsets, sync to the picture, the choir) |
| `stunt-sim.ts` | The stunt pilot in node, without a browser: `npx tsx scripts/playtest/stunt-sim.ts [runsPerMountain] [firstSeed] [mood]` |
| `setpieces.js` | Round 6's set pieces frame by frame: a replayed run shot as each set piece's card comes up and every so often while it plays, with the sim's own count, the race machine's gap and the fall's gap |
| `moments-plan.ts`, `pool-moments.ts` | What each set piece holds on every mountain and a few Dailies (gates, rings, steps, paces), without a browser; and how the bundled pools' riders played each one |
| `lab-digest.mjs` | Two `lab.ts` outputs side by side, per pilot (`lab.ts` also prints a set-piece table: each pilot's wins of the set pieces it met) |
| `loudness.js` | Loudness on a live run: integrated LUFS, short-term and momentary maxima, loudness range, true peak, L/R correlation, and what folding to mono and a phone speaker's band take off, for the whole mix, the music alone and the effects alone |
| `tile.mjs` | Tiles frames into one contact-sheet PNG, for reading many frames at once |
| `graves-pins.ts`, `graves-repin.cjs` | After a pool regen: print each pool's graveyards, and rewrite the graveyards test's pins from them |

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

## Wow pass play-test

Rounds 1 and 2 changed the picture. This one changed the sim (SIM_VERSION 6): the course became a fixed
4.5 km descent in three stages with real places in it, cruise rose from about 21 to 30 m/s, and a hit
costs time rather than the run. Everything below rides scripted pilots. No human has played this build.

The pilot lab (`lab.ts`) rides the real sim in node: six seeds a mountain for the skill pilots, one for the
scripted bad inputs. Ranges are the spread of the four mountains' medians. Before this pass a run had no
finish and the lab stopped it at 4 min.

| Pilot | Time before | Time after | Distance before | Distance after | Mean m/s before | Mean m/s after | Finished after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clumsy (new) | 13 to 15 s | 71 to 159 s | 110 to 155 m | 1.2 to 1.9 km | 11 to 12.5 | 15 to 18 | 0 of 24 |
| Novice | 97 to 123 s | 146 to 164 s | 1.9 to 2.3 km | 4.5 km | 19 to 20 | 28 to 32 | 22 of 24 |
| Mid | 151 to 240 s | 144 to 156 s | 3.3 to 5.1 km | 4.5 km | 21 to 22 | 29 to 32 | 20 of 24 |
| Expert | 169 to 240 s | 144 to 154 s | 3.6 to 5.3 km | 4.5 km | 21 to 22 | 29 to 32 | 23 of 24 |
| Safe line | 240 s (the cap) | 151 to 167 s | 4.9 to 5.1 km | 4.5 km | 20 to 21 | 29 to 30 | 24 of 24 |
| Stunt | 103 to 167 s | 137 to 149 s | 2.2 to 3.7 km | 3.9 to 4.5 km | 22 to 23 | 30 to 31 | 14 of 24 |
| Hands off | 10 to 42 s | 100 to 155 s | 153 to 771 m | 3.0 to 4.5 km | 15 to 18 | 27 to 31 | 2 of 4 |
| A key held 2 s, right | 5 to 17 s | 146 to 159 s | 24 to 131 m | 3.5 to 4.5 km | 8 to 10 | 24 to 29 | 3 of 4 |
| A key held 2 s, left | 5 s | 141 to 161 s | 24 to 26 m | 3.4 to 4.5 km | 9 | 25 to 30 | 3 of 4 |
| A key held for ever | 9 to 18 s | 91 to 300 s | 21 to 33 m | 1.1 to 2.3 km | 3 to 5 | 7 to 14 | 0 of 4 |
| Zigzag | 6 s | 99 to 146 s | 40 to 45 m | 1.5 to 2.3 km | 9 to 10 | 14 to 18 | 0 of 4 |

Mean speed over a run's first 15 s rose from 12 to about 20 m/s for the clumsy pilot and from 15 to 25
for the novice. Skilled pilots now reach the 46 m/s cap, where the fastest reached 35 before. Stomps a
minute rose from 6.1 to 8.6 for the stunt pilot and from about 2.4 to 7.5 for mid and expert.

The game in the browser, on the real build (`telemetry.js`): 8 first runs a pilot, 2 on each mountain on Low,
same plan on both builds. Times, distances and speeds are medians, passes and named moments are per minute.

| Pilot | Run before | Run after | Mean m/s before | Mean m/s after | Passes before | Passes after | Named moments after | Race live before | Race live after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clumsy | 6 s, 52 m | 125 s, 1,705 m | 9.5 | 14.5 | 1.7 | 3.2 | 21.9 | 0.99 | 0.76 |
| Novice | 73 s, 1,456 m | 139 s, finish | 19.2 | 30.0 | 7.8 | 3.0 | 19.7 | 0.81 | 0.95 |
| Mid | 175 s, 3,596 m | 132 s, finish | 23.0 | 33.4 | 2.1 | 2.8 | 25.4 | 0.48 | 0.89 |
| Expert | 163 s, 3,743 m | 138 s, finish | 23.7 | 32.0 | 2.3 | 3.6 | 27.8 | 0.57 | 0.89 |
| Stunt | 82 s, 1,799 m | 135 s, finish | 21.8 | 32.8 | 5.3 | 2.8 | 29.4 | 0.70 | 0.96 |

("Before" per-minute figures are flattered by short runs: a run that ended in 6 s was live for all of it.)

A first run's race was the weakest part of this pass until the end. At the first full measurement it was live
for 0.33 to 0.52 of a run with 0.3 to 1.9 passes a minute, because the field is picked before you ride and with
no history can only guess who you are. So on a very first run the riders read you (DECISIONS 206), and it is now
the best race in the game by these numbers. The costs: Low (above), and finishes. Riders near you mean about
twice the slipstream, and the four skilled pilots finished 21 to 24 of 32 over three samples, against 27 of 32
without it. The novice did not change. Places spread: the skilled pilots mostly 1st to 3rd, the clumsy pilot 3rd
to 6th, where it had been last almost every time.

Returning runs are mixed. Over runs 2 to 4, in one save per pilot, passes a minute are 0.0 to 2.0 for the clumsy
pilot, 2.7 to 3.9 for the novice, 1.8 to 3.9 for mid and 2.7 to 8.9 for stunt, and the race is live for 0.38 to
0.94, 0.43 to 0.63, 0.50 to 0.72 and 0.59 to 0.99 of the run. Against the build before the first-run change,
stunt is up, the novice is level, and clumsy and mid are down, on three runs each, which is too few to call. The
first measurement of this was clearly worse for all four, which is how a real leak was found: a rider who read
you came back as a grudge at its real pace, 1.7 km up the road. That is fixed.

| Other checks | Result |
| --- | --- |
| Road you can read ahead at speed (`readability.js`) | 24 m before, 73 m at 30 m/s, 65 m at 44 m/s |
| Fork's bold route (`forks.ts`) | Saves up to 1.9 s for a clean rider, costs mid-skill bots a hit |
| Clean break across two real builds (`migrate.js`) | Archive byte-identical, gifts and run counts unchanged, stable across reloads, old link opens as a target to beat. Rerun on the release build; that save held no grudge, so the tally rests on the first run and the tests |
| Cup and Daily links | Open this week's Cup or today's Daily with the friend's ghost racing, raced to the line in a real browser. A link from a day or week that has gone says the race has closed |
| Rails on a real approach (`lab.ts --pilots rails`) | All 24 runs finish, 5 to 8 grinds a run. 72 of 80 rails mount cleanly; 8 do not, at least 3 of them under a kicker's flight (DECISIONS 211) |
| Slow riders in the air | Apparent gravity 0.27 to 0.41 of true before, 0.63 to 0.68 after, finish times unchanged, on real runs |
| Crash cameras over 1,104 replayed walled crashes at 60 fps | Buried wrecks 66 to 0, hero lens in rock 9 to 0, orbit in rock 22 to 2 (one crash, about 0.3 s) |
| Graveyards, by mountain | 0, 0, 0, 3 before, 4, 4, 2, 4 after, from recorded falls; every ghost record byte-identical, 2.3 KB added |
| Overlooks, by mountain | 3, 1, 1, 1 before, 3 each after, the first at 250 m. Dailies have 2 to 5, and 31% have 2 |
| Animals standing past what bounds the run | 24 to 50% of per-frame samples before, 0 after |
| Comet Night tunnels | Roofless, and now silent of the enclosed echo too |
| Every seed builds (a test holds 700) | 9,660 seeds, ten years of dailies among them |
| Floating trees (the review's finding 8) | 21% of sampled spots on early Pinecrest floated, worst by 25.7 m; fixed, a test holds it |
| Console across the tour of every mountain and mood, the migration, and the first-run and phone captures, on the release build | No errors |

Comparison frames, contact sheets and beat strips (`tour.js`, `sweep.js`, `moments.js`, `sheet.mjs`) were
read for every mountain and mood. They live in `shots/`, which is not in git.

What this does not show. Every number above is a script. Whether a tumble feels fair, whether 30 m/s feels
fast rather than busy, whether riders who keep up on a first run feel like a race or like being carried, whether
the medals and the ladder pull you back, and how any of it sounds are all unmeasured. The audio has not been
heard. Only the rail pilot grinds: the skill pilots leave rails alone. All tuning of medals, ladders and gifts is
unproven with people.

## Round 5 play-test: depth, wonder and scale

This round changed the sim (SIM_VERSION 7): spirit lights and a lantern you spend on a dash or keep as a
ward, sky gates, a second fork on Pinecrest and Sakura, rails out from under flights, events that pay the
lantern, and twelve signature riders in every pool. Everything below is scripted. No human has played this
build or heard it.

**The skill spread** (`lab.ts`, six seeds a mountain, the same pilots on both builds; the scripted pilots now
spend lanterns as a person might, see `spenderFor`). Median finish, seconds, by mountain
(Pinecrest/Frostfang/Ember/Sakura):

| Pilot | Before | After | Finished before | Finished after | Dashes a minute | Lanterns lit a run |
| --- | --- | --- | --- | --- | --- | --- |
| Hands off | 155/143/dnf/dnf | 156/146/148/150 | 2 of 4 | 4 of 4 | 0 | 6 |
| Careful line | 161/151/154/167 | 160/150/152/161 | 24 of 24 | 24 of 24 | 0 | 4 |
| Novice | 149/146/155/164 | 155/148/148/151 | 22 of 24 | 24 of 24 | 2.1 | 8.6 |
| Mid | 144/147/145/156 | 123/139/133/135 | 20 of 24 | 24 of 24 | 3.8 | 11 |
| Expert | 144/148/152/154 | 125/132/133/135 | 23 of 24 | 23 of 24 | 5.0 | 11.6 |
| Stunt | 150/147/150/151 | 136/132/138/134 | 14 of 24 | 24 of 24 | 3.5 | 11.3 |
| Clumsy | no finish | no finish | 0 of 24 | 0 of 24 | 0.2 | 4.1 |

Before, novice and expert finished 4.7 s apart on average while one pilot's seed-to-seed spread was 2.4 to
7.5 s: skill sat inside the luck. After, they are 18.2 s apart against a spread of 6.2 to 8.6 s: skill is two to
three times the luck, though the luck itself grew (a dash's timing varies). Hands-off and the careful line are
now about the novice's pace, 12 to 17% behind mid and expert. Every pilot lights lanterns; the careful line and
hands-off keep theirs as wards (1 to 3 a run).

**First runs in the browser** (`telemetry.js`, one fresh run a mountain a pilot on Low, 4 a pilot; "before" is
the wow pass's published table, 8 a pilot, same script and tier):

| Pilot | Run before | Run after | Passes a minute before / after | Race live before / after | Place after (of 6) |
| --- | --- | --- | --- | --- | --- |
| Clumsy | 125 s, 1,705 m | 1.2 to 2.8 km, no finish | 3.2 / 3.7 | 0.76 / 0.88 | 5th to 6th |
| Novice | 139 s | 149 s, 4 of 4 finish | 3.0 / 3.2 | 0.95 / 0.89 | 1st to 2nd |
| Mid | 132 s | 121 s | 2.8 / 3.0 | 0.89 / 0.59 | 1st to 2nd |
| Expert | 138 s | 132 s | 3.6 / 3.6 | 0.89 / 0.41 | 1st every time |
| Stunt | 135 s | 129 s | 2.8 / 2.9 | 0.96 / 0.74 | 1st to 2nd |

Every finisher met all four of its mountain's set pieces, about one every 30 to 40 s with the finish (1.6 to 2 a
minute); the clumsy pilot met one or two before it wrecked. None of the scripted pilots swept one (every light in
it and clean): that is left for people. The cost is the race for a skilled first-timer: the riders who read you
ride at most 1.12 times their own run, and a pilot dashing at 34 m/s rides clear of them, so the expert's first
race is live for 0.41 of the run against 0.89. It wins every time.

**Returning runs** (runs 1 to 4 in one save, Pinecrest, Low, the same plan as the wow pass's measurement on the
old build): the novice finished 2 of 4 against 1 of 4; mid ran 113 to 124 s against 123 to 138; stunt 120 to
141 s against 133 to 136. The race is not livelier: mid's is live for 0.44 to 0.62 of a run against 0.50 to
0.72, stunt's 0.35 to 0.87 against 0.36 to 0.79, and the clumsy pilot still finishes none.

**The ride home.** `homeward.js` wrecked Pinecrest runs at 1,309 m and 1,451 m, rode home as a spirit to the
square in about 85 s and came back to an unchanged card. The console was clean.

| Other checks | Result |
| --- | --- |
| Every seed builds (the fairness test's 700) and dailies keep their variety | Yes; over 40 orders in 60 dailies |
| Pools | 42 riders a mountain (30 crowd, 12 signature), 124 KB in all |
| Console, every capture in `shots/r5/final`, `shots/r5/home`, `shots/r5/lantern`, `shots/r5/marquee` | No errors |

What this does not show: whether a dash feels good, whether keeping a ward reads as a choice or as
forgetting the button, whether the set pieces' camera beats feel directed or pushy, whether the signature
riders feel like people, and every sound. The lab's pilots spend lanterns by a rule I wrote; people will not.

**Rails.** `lab.ts --pilots rails`: rails no approach can mount cleanly fell from 8 of 80 to 4 of 76, and none
of the four sits under a kicker's flight any more (they fail on a ground lip or a wide approach).

### Round 5 performance

Measured on the production build in headless Chrome on the laptop's GPU, **on battery** (the charger was not
connected; throttled figures ran well under the last round's on both builds), the old build (3331717) and this
one interleaved in fresh sessions with the save cleared (every probe is a very first run). The browser pane
of the desktop app was closed for the probes after the first round, which it had loaded.

| Check | Old build | This build |
| --- | --- | --- |
| High at 1x, Pinecrest | 60 fps, p90 16.8 ms (one of two passes 41, the machine) | 60 fps, p90 16.8 ms, both passes |
| Medium at 1x, Pinecrest | 60 fps | 60 fps |
| Phone layout, Medium and Low | 60 fps | 60 fps |
| High through an avalanche chase, CPU 4x (two passes) | 18 and 33 fps | 19 and 21 fps |
| Low at 6x, a very first run, Pinecrest/Ember/Sakura (median of 5 passes) | 37 / 49 / 38 fps | 34 / 44 / 41 fps |
| First rendered frame at 6x, fresh save (median of 4) | 1.75 s | 1.59 s |
| Draw calls settled, High / Medium / Low | 90 to 92 / 85 to 86 / 42 to 48 | 90 to 92 / 85 to 87 / 43 to 47 |
| Draw calls at the peak, High / the chase | 100 / 132 to 141 | 99 to 100 / 138 to 139 |
| Triangles settled, High / Medium / Low | 872k to 879k / 644k / 155k to 162k | 877k to 883k / 642k to 647k / 124k to 127k |
| Build, zipped / unpacked | 683 KB / 2,171 KB | 723 KB / 2,279 KB |

Low at 6x is the one bar this round does not meet: it did not win back the last round's loss, and on two of three
mountains it sits 3 to 5 fps under the old build, on one 3 over, inside a spread where single passes of the old
build read 24/19/25 and 39/49/45. A bisect over the round's checkpoints read the lantern alone and the riders'
lane within noise of the old build, and the gap appearing once the living world and the signature-rider field
came in; it was not pinned further. Triangles on Low fell by a fifth, so it is CPU work, most likely page work as
in decisions 205 and 217. The 4x chase on High swings too widely on battery to call.

The build grew by 40 KB zipped: about 36 KB of script (the lantern, set pieces, mastery, paints and the ride home
in the main bundle; the twelve hats, tags and reactions, about 7 KB; the crowds and animals, about 8.5 KB) and the
sim's own growth in the ghost worker. The pools are the same size as before (42 riders a mountain, 124 KB).

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

Round 5 added `src/bot/roster.ts` (the signature riders), `src/game/marquee.ts` (set pieces), `src/game/mastery.ts`
(boards), `src/game/paints.ts` (sled paints) and `src/render/spirit.ts` (sky gates, dash and ward light, set pieces'
air, fireworks). Round 6 added `src/sim/moments.ts` (the set pieces and their verbs, played in `sim.ts`),
`src/render/marqueeworld.ts` (race machines, lantern gates, the falling span) and `src/ui/momentcopy.ts` (what a set
piece's chip says).

See `PLAN.md` for the architecture, `ART.md` for the art bible and `DECISIONS.md` for every call
made along the way.
