ultracode

# Ghost Sled: the fun pass

Ghost Sled (this repo: Vite + TypeScript + three.js, zero assets, live at
https://urbantorque.github.io/ghost-sled/) is a finished, good game. Nine critic rounds polished
how it looks. This round is about how it **feels to play**. Make it the most fun, surprising and
memorable version of itself: the run you tell a friend about, the rival you want to beat, the
moment you replay in your head.

Deepen what is already strong before adding anything new. Every change must answer one question:
does a player feel something they did not feel before? Do not spend this round on visual
nitpicks, refactors or new menus for their own sake.

## Read first

README.md, PLAN.md, ART.md and DECISIONS.md (69 items and contracts C1 to C12). Treat them as
the source of truth for what exists and why. Then read the code each workstream below names.

## What a survey of the code found

A read-only survey of the game, run before this prompt was written, found that the game's best
systems are already built but under-voiced. Most of what follows is wiring existing state into the
player's senses. Line numbers are from that survey: check them, do not trust them.

### Pillar 1. Make skill legible and felt (`src/sim`, `src/render`, `src/ui/fx.ts`, `src/game/app.ts`)

- **Flow is invisible.** `s.flow` (0 to 6, built from chain length and perfect landings) cuts drag
  by up to 25%. It is the game's main momentum reward, and nothing in render, UI or audio reads it
  (`run.ts` only copies it into the Snap). Make flow a state players can see, hear, chase and lose:
  a building glow on the rider and groove, wind turning into a tone in the song's key, an "In the
  flow" beat at full flow, and a visible snuff when it breaks.
- **Drift charge has no world read.** The spray is identical at every tier, and a tier-3 release
  gets the same camera kick as tier 1. Make the runners' spray shift colour with the charge (within
  ART.md's colour roles), give it a rising whine, and make a tier-3 release crack: a stronger kick,
  a brief hitstop and a sound of its own.
- **The cash-in is flat.** Banking +80 and banking +40,000 play the same 1 s animation, and the
  number at stake (pending times multiplier) is never shown as one figure. Add tension while a big
  combo's timer drains, tier the bank by size (bigger number, coin cascade, short hitstop, music
  duck), show "Best combo pace" when you pass your lifetime best combo mid-chain, and stage a lost
  combo so it hurts (the most emotional moment in the game is now one small line).
- **Streaks go unnamed.** Consecutive perfect landings are paid less (the 0.7x variety decay) and
  never celebrated. Add stomp streaks ("Double stomp", "Triple stomp") with an escalating ring,
  crater and bell. Do this in presentation first; a payout change is a sim change (see Pillar 6).
- **Near misses are all the same.** The sim already tracks the minimum gap and throws it away.
  Grade them: a "Whisker" for a hand's width at speed, with a blink of hitstop, a panned whoosh and
  snow shaken off the boughs. Optional event fields need no sim bump.
- **The camera has no weight.** Shake is isotropic and `kick` only adds FOV. Add vertical
  compression on heavy landings, a lateral jolt on a bump, roll that follows drift slip, and a crash
  beat (a short slow-down and a held frame on the wreck before the orbit). Gate all new screen
  motion (and the existing shake, punch and hitstop) on `prefers-reduced-motion` from the start.

### Pillar 2. Make the race a story (`src/game/ghosts.ts`, `src/game/app.ts`, `src/render/ghosts.ts`, `src/ui/hud.ts`, `src/ui/results.ts`)

- **Minute 1's race is over in about 30 s.** With no best, `pickField` picks the weakest
  ghosts, and they crash at 120 to 600 m. The field is picked by score but judged by distance. Build
  each field around the distance where this player usually ends, with one ghost to pass early, two
  or three to fight near their best distance, and one stretch rider who survives past it. Drop
  duplicate wrecks (pairs that crash at the same spot) and ghosts recorded in a different mood from
  the run's.
- **Passes are all the same.** Only the first pass pays, a slingshot pass looks like any other, and
  retaking a ghost that passed you is unremarkable. Add slingshot passes, pass chains ("Double
  pass") and duels: a ghost within 1.5 m for over a second becomes a named duel that pays when you
  break clear.
- **Your best should be a line you can see.** Put a gold-white marker across the course at your best
  distance, count down to it in the rival pill, and stage crossing it ("New ground": no ghost
  grooves ahead, a music lift). Add a beat for passing your best score mid-run; today a new best is
  only found on the results screen.
- **The grudge has no memory.** Give it a history: name it on the results ("Mila beat you by 38 m.
  She'll be waiting"), line it up at the next start, keep a head-to-head tally, and promote a
  three-time winner to a nemesis.
- **Friend challenges do not answer back.** Open with "Racing Mila's ghost, 2,340 m", badge the
  friend ghost, and close with "You beat Mila by 120 m" and a Send It Back action.
- **Ghosts do not show off.** The worker computes each ghost's trick stream (`t.tricks`) and nothing
  reads it. Let ghosts ahead flip and stomp visibly with a small trick whisper. A ghost wiping out
  ahead is news ("Tess wiped out"), and its `crashed` event is ignored today.

### Pillar 3. Give a run a shape (`src/sim/course.ts`, `src/sim/chaos.ts`, `src/render/props.ts`, `src/ui/reveal.ts`)

- **Events end silently.** Only the avalanche has a payoff. Give every event a graded finale:
  "Caught 41 of 48" for the Gift Storm, "Yeti dodged" and a big stamp for a hop, and a Spirit Train
  ending. Show a countdown so a promised event feels on its way, since many runs end before it
  fires at 520 to 1140 m.
- **Long runs have no milestones.** Add kilometre arches, and "graveyard" spots where several
  ghosts crashed: a cairn with a name ("The Widow's Bend: 4 fell here") and a reward for getting
  through alive.
- **The Daily Mountain is not a shared day.** Give it one fixed chaos roll for everyone ("Today:
  Comet Night + Yeti Crossing"), a field generated in the same conditions, a medal and a streak.
- **Stretch goals that touch the sim** (Pillar 6 rules apply): staged events that fire at a course
  section that suits them, signature lines with real choices (Sakura gates off the safe line, Ember
  vents under gift arcs), and named set-piece sections with a rest, build and peak rhythm.

### Pillar 4. An earned soundtrack (`src/audio/*`, `src/game/app.ts` intensity)

- **Minute 1 is mostly a pad.** At cruise speed and x1, intensity sits around 0.23, below where
  the bass and hats come in. Rebalance it so cruising already grooves, and let tricks, multiplier
  and flow build the band layer by layer, with a drop on a big bank and a stumble on a lost combo.
- **Passes all sound the same,** and the pitch ladder wraps on the 9th pass. Give the passes that
  matter their own beats: grudge settled (minor to major), Your best overtaken, taking 1st, and a
  mid-run new best. Let ghosts you pass join the band as a choir voice that leaves with a sigh when
  they retake you.
- **Sound and picture are out of sync.** The reveal's slam sound plays about 0.74 s before the name
  lands, and the results sounds all fire at t=0 while the card arrives beat by beat. Sync them, with
  a count-up that ticks up the pentatonic ladder.
- **Plain runs share one 8.6 s loop on all four mountains.** Give each mountain its own song with
  form (an A and a B section) and a key lift every kilometre. Make the avalanche escape a drop-out
  and slam rather than just a fanfare.

### Pillar 5. Reasons to come back (`src/game/missions.ts`, `src/game/save.ts`, `src/ui/title.ts`, `src/ui/results.ts`, `src/ui/hint.ts`)

- **Fix first:** a revive followed by a second crash runs `showResults` twice. That double-counts
  runs, ghosts passed (inflating unlocks), lifetime stats and missions.
- **Missions only settle on the results screen,** in a fixed order that is not shuffled (despite
  the comment), and they can wait behind a locked biome. Pop missions mid-run (the notice kind
  exists), shuffle the rotation, make it biome-aware and growing ("Ride 1,600 m (II)"), allow one
  swap a day, and add a chaos bonus line on the reveal card ("Bonus: hop the yeti +40").
- **The economy runs dry** once the six sleds are bought, and unlocks end around runs 10 to 15. Add
  a "next unlock" meter on the results, a named rematch on Run Again ("Rematch Mabel"), loaner sleds
  ("Try the Whirl Saucer next run"), and a cosmetic gift sink if a judge panel agrees it earns its
  place.
- **Onboarding stops at the basics.** Teach spins, the backflip and the boosted pop as players
  reach them. Greet a returning player ("Your grudge on Pinecrest is waiting").

### Pillar 6. At most one sim change, done properly

The scoring economy has real leaks: drafting alone climbs the multiplier to x10 in about 13 s,
deep carve pays once whatever its length, and holding the action through a lip is a dead state
that pays nothing. If a judge panel decides the gain is worth it, make **one** batched sim change
that fixes these together, optionally with one new move (a mitten grab from holding through a lip).
Then:
- bump `SIM_VERSION`;
- update the bot (`src/bot/*` mirrors the air rules) so pool ghosts still ride well;
- regenerate every pool with `npm run generate-ghosts`;
- keep the 3-minute input log under 2 KB;
- check that saved bests, grudges and challenge links from the old version are handled gracefully.

Everything else in this round stays outside `src/sim`.

## Guardrails (non-negotiable)

- **Determinism.** `src/sim` is a deterministic 60 Hz fixed step: no `Math.random`, no
  transcendental `Math` (use `dmath`), test-enforced. Hitstop and slow motion may only scale the
  real-time feed into `FixedLoop` or render-side dt, never the sim's step.
- **Score stays in the sim.** Pass, duel, graveyard, grudge and mission rewards go to gifts or the
  wallet through `app.ts`, never into `sim.score`. Otherwise the pool replay test breaks.
- **Chaos rules.** At most one mood and one event per run. About a third of runs are plain, and a
  session's first run is always plain. Everything is telegraphed and fair, and the fairness test
  keeps a passable line. Static geometry never depends on chaos.
- **Contracts.**
  - Keep C1 to C12: the stencil, rival pills, race grammar and avalanche unit.
  - One banner at a time by priority. The perfect-landing stamp heads its beat.
  - ART.md colour roles: mint for ghosts, rose for the grudge, gold-white for your best, marigold
    for gifts, ice blue for hazards only.
  - `happytime` only for a new best and a settled grudge.
  - Ads only on Run Again; every new "start a run" button goes through `runAgain()`.
- **Budgets.**
  - High holds 60 fps on the Intel Arc 130V laptop GPU, including the avalanche at 4x CPU throttle.
  - Low at 6x throttle sits at 50 to 55 fps today, with no headroom left.
  - The build stays under 5 MB, with no new runtime dependencies and no asset files.
  - New particles and meshes are instanced, capped, and skipped or cheap on Low.
- **Save schema v1.** New fields are defaulted in `load()`, so old saves keep working.

## How to run it

Use workflows, in phases. Read each phase's result before starting the next.

1. **Design.** Run a judge panel: three independent designers each propose a ranked slate of 12
   to 15 changes drawn from the pillars (plus at most two new ideas of their own). Score the slates
   on fun gained per effort, risk to the guardrails, and how well they reinforce each other. Then
   synthesize one slate, marked as must-have, should-have and stretch, and record the decision on
   Pillar 6. Fix the revive bug before anything else.
2. **Build.** Use four or five engineers with strict file ownership, as in earlier rounds (world
   and render, ghosts and camera, HUD and fx, menus and meta, audio). Name the contracts between
   them up front, for example which events or fields the audio engineer reads from `app.ts`. Each
   engineer verifies their own work in the browser and reports.
3. **Verify.** Run `npx tsc --noEmit`, `npx vitest run` (all 111 tests, plus new tests for any new
   logic: field picking, mission rotation, the revive guard and the save migration) and
   `npm run release`. Re-measure perf with the same probes and record the numbers in the README.
4. **Play-test for fun.** Fun does not show in a single screenshot, so measure beats as well:
   - **Telemetry.** Drive scripted runs with a pilot (minute-1 skill, mid skill and expert demo
     runs) and log the beats per minute: passes, duels, named moments, missions completed mid-run,
     time to the first pass, how often the race is still live at the moment of the crash, and
     intensity over time.
   - **Beat strips.** Capture 4 to 6 frame sequences around each new moment (a flow build and
     snuff, a tier-3 drift release, a big bank, a whisker, a duel won, crossing your best, a grudge
     settled, an event finale).
   - **Fun panel.** Have critics rate the strips and telemetry through three lenses: game feel,
     race drama, and the first session plus the reason to return. Compare with Alto's Odyssey,
     Mario Kart Tour, Tony Hawk's Pro Skater and Subway Surfers.
   - Iterate while the panel's scores still rise beyond its own noise.
5. **Ship.** Update DECISIONS (a new section for this round), ART, README and PLAN. Rebuild,
   then publish to the `gh-pages` branch so https://urbantorque.github.io/ghost-sled/ updates, and
   check the live URL boots. Commit on a branch.

Take screenshots under the headless playwright configs (`.playwright/cli-headless.config.json`,
`mobile-headless.config.json`): a headed browser drops to 2 fps when the laptop's display sleeps.
Run `playwright-cli close-all` only at the very end.

## Done means

- A first-time player has a live race against a ghost pack at the moment they crash, and sees
  at least one named moment in minute 1.
- Flow, drift charge, banks, streaks, near misses and passes each have a felt, distinct
  beat in sound, picture and camera.
- Every event ends with a payoff. Your best is a line you can see, the grudge has a history,
  and friend challenges answer back.
- The soundtrack grooves from the first cruise and builds with your play.
- Missions pop mid-run and rotate sensibly. A returning player has a named reason to ride.
- All guardrails hold: tests green, perf at or above today's numbers, the build under 5 MB,
  and the live link updated.
- Report what changed, the before and after telemetry and panel scores, the beat strips, and
  what you would do next.
