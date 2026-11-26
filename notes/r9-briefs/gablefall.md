You are the `gablefall` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; a deterministic sim in `src/sim`, `SIM_VERSION` 10; the art direction is "Alpenglow
Gouache", ART.md). Your job is **the last of the three new mountains, Gablefall: a hill town of steep roofs packed
down a valley side, so snowed in that the roofs are the way down; you start on the church's nave at the top of the
town and ride the roofs down to the frozen river, the street below the slow way and the drifts back up.** Built on
the groundwork and on how the Old Run and Gullhaven were made, made a place of its own, given its score and its ghost
pool, registered as a mountain a player can ride, and, as the last of the three, the switch that makes the game eight
mountains. The owner's call: the five stay exactly as they are; the new mountains must not ride like them, or like
each other.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-gablefall` on branch
`r9-gablefall`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite,
lab sweep, build and the pool; one browser on the machine through the slot; CRLF; the trailer; shared files; no edits
to DECISIONS, README, ART, ASSETS or LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/
gablefall/`; your port 5000). Then read DECISIONS 277, 370, 376 and 388 onward; the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (sections 2 "The three new mountains", 3, 4 milestone 3, 6, 8);
ART.md all of it (sections 1, 8, 12 and 15 closely, with the Old Run's and Gullhaven's text in 15);
`notes/r9-concepts.md` (page 3, Gablefall, its risk: "if the roofs do not pay, riders drop to the street and ride a
9 m corridor between house fronts for 2.8 km: the five's street, stretched", and the blind sort);
`notes/r9-measure.md` (the five's figures and the bars); **`notes/r9-ground.md`** (sections 0 to 4, 7 closely, 8 and
10 to 15: hook D, the held street, the review's finding 8, the main lane's answer 4: never a roof higher than the last,
and the opening is the nave then a close); and **`notes/r9-oldrun.md` and `notes/r9-gullhaven.md` all of them**: how
each mechanic was made to pay in the lab, the worlds, scores, pools and registrations. Follow their pattern wherever it
fits, and say where you leave it. The code you start from: `src/sim/kit.ts`, `courseparts.ts`, `oldrun.ts`,
`gullhaven.ts`, `sim.ts`'s `edge()`, `land()` and the ground step, `src/bot` (the `lip` goal Gullhaven's lane built,
`popFlight`, `lineFor`, `backX`), `tests/five.test.ts`, the Old Run's and Gullhaven's tests and lab scripts,
`scripts/playtest/labpilots.ts`, `r9-courses.ts`, the five's street piece in render (its cost), and how the worlds,
scores and pools are made.

**The gate, every commit:** `tests/five.test.ts` holds (the five's and the Dailies' courses, the rolls and every ride
byte for byte), and the Old Run's and Gullhaven's tests and pool replays hold. Everything you add sits behind
Gablefall's kit or `levelOn`, under new ids. If something shared would have to change, stop and say so in your final
message: that is the owner's call.

## 0. Measure Low's cost before the world is built (DECISIONS 392)

The town is everywhere: about 400 m of houses in view on both sides, where the five's street piece is 30k triangles
on Low and 66k on High for 120 to 200 m. Before any world: a stand-in town at the planned density (the near rows as
they would be drawn, the town past the first row as a baked far piece, a card a chunk; windows emissive in the house
material, not lights) on a held Low run, its GL calls and triangles against Pinecrest's. Say the design that keeps it
level with Pinecrest's, or how far over, before you build it.

## 1. Make the roofs pay, in the lab, before any world

Build the ground design's section 7 as a lab course first (its seed in `BIOME_BY_SEED` only): `src/sim/gablefall.ts`
with its kinds (`nave`, `square`, `rooftops`, `quay`), the street on `COBBLES`, the rows laid as blocks between alleys,
each roof a step down from the last and never higher, the gables rounded, the alleys' drifts whose top is the next
roof's surface at every x, the corner drifts from the street at least every 250 m, the chimneys beside the ridge;
hook D (the held street in `edge()`, open only over a drift's foot); `'chimney'` named in `CrashCause` and the game's
crash text; the bot's `lineFor` by level (the ridge of the row it is on, or the street until a reachable drift), its
pops at every step and alley through the `lip` goal, its chimneys as ordinary obstacles. `ROOF_GRADE` and the
alleys' widths are design values: the lab sets them.

The concept's risk is the lab's question: **the roofs must be clearly the fast way.** Fix the ride until, in the lab:
- the mid pilot on the roofs beats the street by 10% or more of the run's time (the perfect landing's boost and the
  cobbles' drag are the levers the ground design names);
- the expert spends 85% of the run or more on the roofs and the novice under 30%; the bot at 0.9 rides the roofs most
  of the way and lands most hops perfectly;
- the novice finishes in the street; a sled that drops into the street finds a drift back up within 250 m;
- no pilot's `y` ever jumps up by more than 0.5 m in a tick (nobody is lifted onto a roof from below); nothing floors a
  rider but a chimney met head on or a flight of 0.75 s or more landed wrong; a house front only scrapes;
- the clumsy pilot finishes 30 of 30 (at least the five's hardest, 27 of 30);
- the mid pilot's finish and speed land near the concept's (about 100 s, about 28 m/s), each mood ridden once;
- `scripts/playtest/r9-courses.ts` treats it as new: outside the five's range by 15% on at least two of the six
  measures, and outside the Old Run's and Gullhaven's on at least two each, with the mechanic's share of the run (2 m
  or more above the street) reported for the mid pilot.

Write its promises in `tests/gablefall.test.ts` (the ground design's list: the street's lane clear; along every line
across the rows, every 0.5 m of x, the ground never rises in z but on a drift; every drop from a roof lands on ground
at most 9 m lower; a corner drift at least every 250 m; the ridge clear of chimneys by 1.5 m; a sled under the hold
held everywhere but a drift's foot; the clumsy pilot). Record every figure, before and after, in your notes. Nobody
has ridden it by hand: say so.

## 2. A place of its own

The world, all procedural, in the five's colours and ART.md's roles, on section 0's budget: the church and its
steeple at the start; the rows of steep roofs, snow on slate, chimneys and dormers, the alleys; the street's cobbles,
barrows and house fronts with lit windows; the market at each stage line, its three arches for the charm gate; the
boathouse, the frozen river and the old stone bridge the line runs under; a snowfall in a grey afternoon; across the
valley the town's other half and a viaduct. **Not the five's grammar, and not the Old Run's or Gullhaven's:** no
pine forest, no peaks, no panorama, and no lamplit town square at the finish (every one of the five finishes in a
lamplit town: Gablefall finishes on the river under the bridge, in daylight and snowfall). The roofs must read as
the way down from the chase lens (the roof run from above, the street below it), and the street must read as the
slow way. Its other hour and its mirror. Three set pieces on new verbs appended to `VERBS` after Gullhaven's (the
concept's: a chain of five roofs without touching the street; the washing lines across an alley, rung as a bell is;
the market awnings stomped down the market street) and its two legends. One HUD signal at most (the concept says none
new). Judge it as the other two were judged: the greyscale sorting test on its first frames (its opening, three
places and its finish beside the five's set in `shots/r9/measure/stills/gray/`, the Old Run's and Gullhaven's,
shuffled, a fresh critic with only ART.md and the frames), then the critic loop on the world (fresh critics, blind,
fix worst first). Low is section 0's design: say its GL calls on a held Low run against Pinecrest's.

## 3. Its score, its pool, its registration, and eight mountains

- **The score**, made the way the others were, original: the concept's march for hand-bells, pizzicato strings and a
  toy piano at about 128 bpm, or better; its pack at or under about 10 MB, loaded only when the mountain is picked.
- **Register it** the way the other two were registered: appended to `MOUNTAINS` after Gullhaven (never inserted),
  its id `gablefall`, unlocking at 8 ghosts (the first new mountain a player meets: it teaches the pop and the stomp);
  its `LAYOUTS` row and kit; its seed chosen through the fairness and budget tests and checked against every Daily and
  Cup key to 2040; its own `HOME` riders (never a duel; The Twelve stays twelve); its graveyard names from
  `GRAVE_MORE`; its `LEG_NAMES`; its events masked by its row (all four only if the fairness suite's "a clean,
  boost-free rider outruns the avalanche in every mood" holds on it, else no avalanche); out of `BIOMES`.
- **Eight mountains**, as the last of the three (DECISIONS 394, answers 6 and 8): the Long Night goes to sixteen legs
  in the ladder's order, switched once, Lanternfall still the finale, a saved best still a count of legs; the Trials'
  rotation takes all eight from `EIGHT_FROM`, which you set to a placeholder week well after the round and mark in
  your notes for the main lane to set at release (past weeks keep their Trial, `EIGHT_START` keeps the switch week
  from repeating a mountain). The title's picker already holds eight; check the unlock ladder and its notices with all
  eight (Gablefall at 8 between Frostfang and Ember).
- **Its ghost pool**, 46 to 50 riders and its home riders, generated alone with `generate-ghosts --only gablefall` in
  the heavy slot, node workers capped, nothing else heavy on the machine, after the bot has been tuned in the lab;
  then `tests/ghostpool.test.ts` and the pool's replays.
- **Wired for this mountain** as the others were: its card on the title's picker, its key art, its mastery board, its
  missions' biome, photo mode and Save Clip on it, its mirror and other hour; list what you would add to the Almanac,
  the album and The Twelve in your notes.

## Not yours

The five's, the Old Run's and Gullhaven's courses, worlds and pools; the UI beyond the mountain's card data; the
garage. The fairness suite's `EVERY` promises and every mountain's own hold as they are.

## Deliver

Commits on `r9-gablefall` (the full suite green in the heavy slot before your last commit); `notes/r9-gablefall.md`
with section 0's cost, the lab's figures before and after (every pilot, the bar), the measures against the five and
the other two, the world and the critics' answers, the Low cost as built, the score's size, the pool, the switch to
eight (what changed and what a saved game sees), every hunk in a shared file, the text for ART.md 15 and DECISIONS,
what only scripts have seen, and what the main lane must decide. Frames under `shots/r9/gablefall/`. Stop your server
and close your browser at the end. Your final message: Low's cost, the lab's figures against the bar, how it now
rides, the critics' sort, the costs, the switch to eight, and what the main lane must decide.
