You are the `gullhaven` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; a deterministic sim in `src/sim`, `SIM_VERSION` 10; the art direction is "Alpenglow
Gouache", ART.md). Your job is **the second of the three new mountains, Gullhaven: a run down the seaward flank of a
cape, from the old beacon on its head along the clifftop shelves to the harbour at its foot, the sea always on your
right and a storm out at sea; where a gully cuts the cliff the sea wind climbs it, and a rider who leaves the path at
the gully's lip is carried over the gully's mouth.** Built on the groundwork and on how the Old Run was made, made a
place of its own, given its score and its ghost pool, and registered as a mountain a player can ride. The owner's
call: the five stay exactly as they are; the new mountains must not ride like them, or like each other.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-gullhaven` on branch
`r9-gullhaven`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite,
lab sweep, build and the pool; one browser on the machine through the slot; CRLF; the trailer; shared files; no edits
to DECISIONS, README, ART, ASSETS or LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/
gullhaven/`; your port 4990). Then read DECISIONS 277, 370, 376 and 388 onward; the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (sections 2 "The three new mountains", 3, 4 milestone 3, 6, 8);
ART.md all of it (sections 1, 8, 12 and 15 closely, and the Old Run's text in 15); `notes/r9-concepts.md` (page 2,
Gullhaven, and the blind sort: the critic could not read Gullhaven's lip, "a leap, a drop or a turn?", or its sea,
"cloud, water or ground?"); `notes/r9-measure.md` (the five's figures and the bars); **`notes/r9-ground.md`** (sections
0 to 4, 6 closely, 8 and 10 to 15: hook C, the bot's `lip` goal and `lineFor`, the review's findings 5 to 7 and 13);
and **`notes/r9-oldrun.md` all of it**: how the Old Run's mechanic was made to pay in the lab, its world, score, pool
and registration. Follow its pattern wherever it fits, and say where you leave it. The code you start from:
`src/sim/kit.ts`, `courseparts.ts`, `oldrun.ts` (a mountain's own file, the model for `gullhaven.ts`), `sim.ts`'s
`airStep` and `landingWithin`, `src/bot` (`model.ts` `predictFlight`, `bot.ts` `lookForGoals`, `lineX`, the Old Run's
`trackSteer`), `tests/five.test.ts`, `tests/oldrun.test.ts`, `scripts/r9/oldrun-lab.ts` and `oldrun-tune.ts`,
`scripts/playtest/labpilots.ts`, `r9-courses.ts`, and how the five's and the Old Run's worlds, scores and pools are
made.

**The gate, every commit:** `tests/five.test.ts` holds (the five's and the Dailies' courses, the rolls and every ride
byte for byte), and `tests/oldrun.test.ts` with the Old Run's pool replays hold. Everything you add sits behind
Gullhaven's kit or `liftOn`, under new ids. If something shared would have to change, stop and say so in your final
message: that is the owner's call.

## 1. Make the wind pay, in the lab, before any world

Build the ground design's section 6 as a lab course first (its seed in `BIOME_BY_SEED` only, as the Old Run's lab
was): `src/sim/gullhaven.ts` with its kinds (`cliffpath`, `geo`, `descent`, `sheds`, `harbour`), the sea side and its
fence, the gully's geometry (the path round the head carrying the drop by the geo's own grade, the seaward shelf held
to the lip, the leap's landing face, the bold line over the mouth), the static lift column a gully; hook C (`airStep`
after gravity, scaled by the mood's gravity; `landingWithin` integrating tick by tick when `liftOn`); the bot's `lip`
goal (`lookForGoals`, judged by `popFlight` with the lift; built here and used by Gablefall's lane after you, so make
it general: a lip is a z where the ground falls away under a line), `predictFlight`'s lift, `lineFor`'s per-gully
choice by speed 60 m out and nerve (read, not drawn), kept until the gully is passed, and the air's nudge holding
`liftX`. `LIFT` (about 0.6 to 0.7 g), the column's lane and the gully's drop are design values: the lab sets them.

The concept's two risks are the lab's questions: **too weak and the gullies are the five's leaps turned sideways; too
strong and nobody rides the path.** Fix the ride until, in the lab:
- the mid pilot soaring a gully beats the path round its head by 10 to 20% of that gully's time, and the run's soared
  flights last about three to five seconds (the longest in the game, measured against the five's longest);
- the mid and expert pilots and the bot at 0.9 soar 7 of 10 gullies or more and come down on the far face or shelf;
- the novice rides the path round most heads, soars few, and finishes; a sled let go on the path 20 m before every
  gully stays on the path; one short of a far shelf lands on the gully's face and rides it down;
- nobody passes the fence (no pilot's `y` ever below the shelf's level less 30 m); nothing floors a rider but a flight
  of 0.75 s or more landed wrong;
- the clumsy pilot finishes 30 of 30 (at least the five's hardest, 27 of 30);
- the mid pilot's finish and speed land near the concept's (about 160 s, about 30 m/s), each mood ridden once;
- `scripts/playtest/r9-courses.ts` treats it as new: outside the five's range by 15% on at least two of the six
  measures, and outside the Old Run's on at least two, with the mechanic's share of the run (in the air inside a
  column) reported for the mid pilot.

Write its promises in `tests/gullhaven.test.ts` (the ground design's list: the safe line never meets the mouth, the
let-go stays on the path, every lip at 24, 30 and 36 m/s plain and popped lands on its face or far shelf no steeper than
0.8, the fence, the lift only in the air and pure, a gully at least every 600 m, the clumsy pilot). Record every figure,
before and after, in your notes. Nobody has ridden it by hand: say so.

## 2. A place of its own

The world, all procedural, in the five's colours and ART.md's roles: the old beacon on the cape's head at the start;
the clifftop path with its snow fence and the moor rising on the left; the cliff falling to the sea on the right, the
sea to the horizon with its swell lines, sea stacks below; the storm deck over the sea with a low sun under its edge;
the lighthouse and its beam; the fish sheds, the slipway and the harbour's ice between frozen-in boats, the line
between the two pier-head lights. **Not the five's grammar, and not the Old Run's:** no pine forest, no hero peak, no
panorama over a sea of cloud (the sea must read as water, not cloud or ground), no lamplit town square at the finish.
**The wind must show** (spindrift streaming up the column, gulls hanging still in it, the fence's flags standing up)
and **the lip must read** as a lip a rider can leave (the critic could not tell a leap from a drop or a turn). A long
flight beside a fall of hundreds of metres needs its own beat of the chase lens: say what you do with the camera in
the air over a gully, inside what the five's vista beat already allows. Its other hour and its mirror. Three set
pieces on new verbs appended to `VERBS` after the Old Run's (the concept's: soar across the Great Geo; thread the sea
stacks on the shore road; the lighthouse's beam, a gate on a clock as the swinging lanterns are, never a hazard) and
its two legends. One HUD signal at most (the concept says none new). Judge it as the Old Run was judged: the greyscale
sorting test on its first frames (its opening, three places and its finish beside the five's set in
`shots/r9/measure/stills/gray/` and the Old Run's, shuffled, a fresh critic with only ART.md and the frames, asked to
sort them into mountains and say which are unlike the rest and why), then the critic loop on the world (fresh critics,
blind, fix worst first). Low gets a designed cheaper version (the concept's: the sea one plane, Low drops the storm
deck's fine octave, stacks instanced, spray pooled): say its GL calls on a held Low run against Pinecrest's and
Ember's.

## 3. Its score, its pool, its registration

- **The score**, made the way the five's and the Old Run's were, original: the concept's reel for squeezebox and
  fiddle over a deep drum and a low choir at about 104 bpm, or better; its pack at or under about 11.5 MB, loaded only
  when the mountain is picked.
- **Register it** the way the Old Run was registered: appended to `MOUNTAINS` after the Old Run (never inserted), its
  id `gullhaven`, unlocking at 32 ghosts; its `LAYOUTS` row and kit; its seed chosen through the fairness and budget
  tests and checked against every Daily and Cup key to 2040 (the lab seed retires or becomes its seed); its own `HOME`
  riders (names, looks, style and skill, never a duel; The Twelve stays twelve); its graveyard names from
  `GRAVE_MORE`; its `LEG_NAMES`; its events masked by its row (no yeti); out of `BIOMES` (the Daily and Cup). Leave
  `EIGHT_FROM` null and the Long Night at ten legs (Gablefall's lane, the last of the three, switches both).
- **Its ghost pool**, 46 to 50 riders and its home riders, generated alone with `generate-ghosts --only gullhaven` in
  the heavy slot, node workers capped, nothing else heavy on the machine, after the bot has been tuned in the lab
  (section 1); then `tests/ghostpool.test.ts` and the pool's replays.
- **Wired for this mountain** as the Old Run was: its card on the title's picker (with its few words of mechanic), its
  key art for the title, its mastery board, its missions' biome (its own look), photo mode and Save Clip on it, its
  mirror and other hour. The Almanac's pages, the album and The Twelve stay as they are for now; list what you would
  add in your notes.

## Not yours

The five's and the Old Run's courses, worlds and pools; Gablefall (the lane after you, which uses your `lip` goal);
the UI beyond the mountain's card data; the garage. The fairness suite's `EVERY` promises, the five's and the Old Run's
hold as they are.

## Deliver

Commits on `r9-gullhaven` (the full suite green in the heavy slot before your last commit); `notes/r9-gullhaven.md`
with the lab's figures before and after (every pilot, the bar), the measures against the five and the Old Run, the
world and the critics' answers, the Low cost, the score's size, the pool, every hunk in a shared file, the text for
ART.md 15 and DECISIONS, what only scripts have seen, and what the main lane must decide. Frames under
`shots/r9/gullhaven/`. Stop your server and close your browser at the end. Your final message: the lab's figures
against the bar, how it now rides, the critics' sort, the costs, and what the main lane must decide.
