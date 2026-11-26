You are the `oldrun` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; a deterministic sim in `src/sim`, `SIM_VERSION` 10; the art direction is "Alpenglow
Gouache", ART.md). Your job is **the first of the three new mountains, the Old Run: an old ice track cut down a forest
for the grand hotel at its head, where riding high on the banked wall is the line.** Built on the groundwork, made a
place of its own, given its score and its ghost pool, and registered as a mountain a player can ride. The owner's
call: the five stay exactly as they are; the new mountains must not ride like them.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-oldrun` on branch
`r9-oldrun`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite,
lab sweep, build and the pool; one browser on the machine through the slot; CRLF; the trailer; shared files; no edits
to DECISIONS, README, ART, ASSETS or LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/
oldrun/`; your port 4980). Then read DECISIONS 277, 370, 376 and 388 to 395; the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (sections 2 "The three new mountains", 3, 4 milestone 3, 6, 8);
ART.md all of it (sections 1, 8, 12 and 15 closely: the five, mountain by mountain, and how Lanternfall was made its
own); `notes/r9-concepts.md` (page 1, the Old Run, and the blind sort's warning); `notes/r9-measure.md` (the five's
figures and the bars); and **`notes/r9-ground.md` all of it** (the design, the review, section 15's lab results and
"what the mountain lanes start from"). The code you start from: `src/sim/kit.ts`, `oldrun.ts`, `courseparts.ts`, the
track's hooks in `sim.ts` (behind `trackOn`), the bot's line and the track's yaw, `tests/five.test.ts`,
`tests/oldrun.test.ts`, `scripts/r9/oldrun-lab.ts`, `oldrun-hand.ts`, `oldrun-frames.js`, and how the five's worlds,
scores and pools are made (`src/render` world and biome files, `src/audio/score.ts`, `scripts/music`,
`scripts/generate-ghosts.ts`).

**The gate, every commit:** `tests/five.test.ts` holds (the five's and the Dailies' courses, the rolls, and every
ride byte for byte). Everything you add sits behind the Old Run's kit or flag, under new ids. If something shared would
have to change, stop and say so in your final message: that is the owner's call.

## 1. Make the wall pay, in the lab, before any world (the groundwork's lab found it does not yet)

On the lab course today the glaze costs time: one steering hand rides the floor's middle in 128 to 136 s and the glaze
line in 150 to 154 s; the wall's yaw (about 0.75 rad/s two thirds up the deepest wall, against the 0.5 a bend needs)
makes every correction slip, and riders on the glaze run 17 to 20 m/s. The whole run is slow (the mid pilot 127 s at
25 m/s against the concept's about 88 s at 34). Fix the ride, track-only:
- a wall a rider can hold (soften `wallYaw` on the track, or a wall that steepens less fast), so the glaze is the fast
  line when held and the floor is safe and slower;
- a controller for the bot and the lab pilots that holds a height on the wall, not a heading (today's re-plans a turn
  late, so the bot spends under 5% of a bend on the glaze);
- the run's economy: longer bends (the concept's about 60% of the run in bends against about 38% laid), a faster
  track (the ice's drag, the grade, a steeper start house: the start at 14 m/s takes most of the first stage to reach
  speed), and the glaze band itself.

**The bar, in the lab, before you go on:** the mid pilot riding the glaze through the bends beats the floor line by
10 to 20% of the bends' time; the expert and the bot at 0.9 spend most of their bend time on the glaze; the novice and
a sled let go finish safely on the floor; the clumsy pilot finishes 30 of 30 (at least the five's hardest, 27 of 30);
nothing floors a rider but a badly landed trick; the mid pilot's finish and speed land where the concept meant them
(about 85 to 95 s, about 32 to 36 m/s). Then `scripts/playtest/r9-courses.ts` treats it as new: outside the five's
range by 15% on at least two of the six measures, and the mechanic's share of the run (define it in the script's hook:
the share of the run's time the rider is on the banked wall above the floor) reported for the mid pilot. Record every
figure, before and after, in your notes. Nobody has ridden it by hand: say so.

## 2. A place of its own

The world, all procedural, in the five's colours and ART.md's roles: the grand hotel and its start house at the top;
the track's parapet and iron lamps; the timing house at the outrun; the lake and its town far below; a low late sun.
**Not the five's grammar:** the blind sort put the lab frames' pines and the faint peak at the end of the track with
the five's forest, so no pine forest as the five draw it and no hero peak at the track's vanishing point (a forest of
its own kind, the lake and its town instead); no panorama over a sea of cloud; no lamplit town square at the finish.
The glaze must show (its own material or band, a shine the eye reads at speed), and past the lip a crest of snow or a
fence, not a rock face. The start and the finish are the Old Run's, not the alpine look's. Its other hour and its
mirror. Three set pieces on new verbs appended to `VERBS` (the concept's: hold the glaze through the Horseshoe, ring
the bend bells, beat the Labyrinth's split) and its legends. One HUD signal at most (the concept says none new).
Judge it: the greyscale sorting test on its first frames (its opening, three places and its finish beside the five's
set in `shots/r9/measure/stills/gray/`, shuffled, a fresh critic with only ART.md and the frames, asked to sort them
into mountains and say which are unlike the rest and why), then the critic loop on the world as rounds 7 and 8 ran it
(fresh critics, blind, fix worst first). Low gets a designed cheaper version: say its GL calls on a held Low run
against Pinecrest's (the main lane times frames per second in its own quiet sittings).

## 3. Its score, its pool, its registration

- **The score**, made the way the five's were (`scripts/music`, `src/audio/score.ts`), original, the concept's quick
  galop or better, its pack at or under about 9 MB, loaded only when the mountain is picked.
- **Register it**: appended to `MOUNTAINS` (never inserted), its id `oldrun`, unlocking at 18 ghosts; its `LAYOUTS`
  row and kit as the mountain's (the lab seed retires or becomes its seed, as the ground notes say); its own home
  riders (a `HOME` list: names, looks, style and skill, never a duel; The Twelve stays twelve); its graveyard names
  from `GRAVE_MORE`; its `LEG_NAMES`; its events masked by its row (no avalanche, no yeti); out of `BIOMES` (the Daily
  and Cup). Leave `EIGHT_FROM` null and the Long Night at ten legs (the last of the three switches both).
- **Its ghost pool**, 46 to 50 riders and its home riders, generated alone with `generate-ghosts --only oldrun` in
  the heavy slot, node workers capped, nothing else heavy on the machine, after the bot has been tuned on the lab
  course (section 1); then `tests/ghostpool.test.ts` and the pool's replays.
- **Wired for this mountain**: its card on the title's picker (the `ui` lane's eight-chip picker reads
  `MOUNTAINS`; give the card its few words of mechanic), its key art for the title, its mastery board, its missions'
  biome (its own look, not a borrowed one), photo mode and Save Clip on it, its mirror and other hour. The Almanac's
  pages, the album and The Twelve stay as they are for now; list what you would add in your notes.

## Not yours

The five's courses, worlds and pools; Gullhaven and Gablefall (lanes after you); the UI beyond the mountain's card
data; the garage. The fairness suite's `EVERY` promises and the five's promises hold as they are.

## Deliver

Commits on `r9-oldrun` (the full suite green in the heavy slot before your last commit); `notes/r9-oldrun.md` with
the lab's figures before and after (every pilot, the bar), the measures against the five, the world and the
critics' answers, the Low cost, the score's size, the pool, every hunk in a shared file, the text for ART.md 15 and
DECISIONS, what only scripts have seen, and what the main lane must decide. Frames under `shots/r9/oldrun/`. Stop your
server and close your browser at the end. Your final message: the lab's figures against the bar, how it now rides,
the critics' sort, the costs, and what the main lane must decide.
