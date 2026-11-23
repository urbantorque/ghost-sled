You are the `concepts` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is milestone 0's third design
for the owner: **at least six concepts for three new mountains, each fundamentally different from the five and from
each other, of which the owner will pick three.** The owner's words: a player today rides one course in five
paintings; the five stay exactly as they are; the game gets new ways to ride from three new mountains, and those must
not repeat this grammar.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-concepts` on branch
`r9-concepts`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (one browser on the machine, through the
slot; the heavy slot for anything CPU-saturating; CRLF; the trailer; no edits to DECISIONS, README or ART; frames under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/concepts/`; your port 4920). Then read the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (all; section 1 "The mountains", section 2 "The three new
mountains", section 3 "Changed for this round", section 4 milestone 0's item 3 and milestone 3, section 8's decisions
4 to 9 closely), ART.md all of it (section 15 is the five, mountain by mountain; section 12 the world at scale), and
DECISIONS 277 (round 7's mountain limits and why the storm coast lost to Lanternfall), 370 (the last sim batch) and
376 (the Long Night). The sim is closed in milestone 0: read `src/sim/course.ts` (all 2,640 lines: its section kinds,
`STAGE_LENGTHS`, the start ramp and first leap, `FINISH_SQUARE`, the banks, `BIOME_PARAMS`, the act scripts), `sim.ts`
(the surfaces, collisions, air, the get-up, what a hazard is), `mountains.ts`, `moments.ts` (set pieces and their verbs),
`chaos.ts`, `src/bot` (how the bot reads a course, so you can say how it would learn a new mechanic), the fairness and
budget suites in `tests/`, `src/audio/score.ts` and `scripts/music` (how a mountain's score is made, and its size), and
`public/music` for the five's pack sizes. Edit none of the sim.

The `measure` lane works beside you, measuring the five (the finish time, mean speed, airtime, turns per km, mean
width, hazards per km, the slope's profile, leaps, and the constants all five share). Read its notes as they land:
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/.claude/worktrees/r9-measure/notes/r9-measure.md` and its output under
`shots/r9/measure/`. Its numbers are the range your concepts must leave.

## What "fundamentally different" means here (from the brief, binding)

Each new mountain differs from all five on at least five of the eight axes (length and pace; profile; width and frame;
the opening; the air; the ground and dangers; the finish; light, weather and the far plane), has one signature mechanic
that changes how you ride and runs through most of the run (not one set piece), and would still be its own place drawn
in the five's colours. A new skin over the five's grammar fails, however good it looks. The limits: the course is a
function of distance downhill; it only descends, and forks rejoin; no loop, crossing or true branch; a static gust or a
feature always in the same place is fine, a weather front that moves the safe line is not. The rules a rider plays by
stay: steer and one button (the input byte has no spare bit), tricks, charms, scoring. Everything new enters the sim as
new entries under new ids (section kinds, surfaces, hazards, mechanics only the new mountains use); a shared constant may
become per mountain only if the five keep their exact values; the five's seeds, pools and records replay byte for byte.
Three stages each is the default (section 8 decision 5); a concept may argue for another count with the ripple listed.

Directions to weigh, not to pick by default: a storm coast (sea cliffs, a lighthouse, a frozen harbour); a rooftop run
down a snowed-in hill town; a gorge under the ice (a frozen river with a ceiling and light from above); a banked ice
run (an old bobsleigh track cut down the mountain, riding high on the walls is the line); a descent by your own light
(a dark forest or ravine lit only by the rider's lantern and what it wakes; every hazard must still show in time); an
open face (no corridor, a whole snowfield, find your own line between landmarks). Bring your own too. Everything
original: nothing copied from or closely evoking an existing game's levels, names or look.

## Each concept gets one page (in your notes, and as a page the owner can open)

- **What is different.** The setting and the fiction, and where it sits on every one of the eight axes, against the
  five's figures (say on which it differs and by how much, in the measure lane's units where it has them).
- **The course.** Length, stages and composition (the section kinds it uses, new and old), its opening and its finish.
- **Its signature mechanic.** What a rider does differently there, second by second, with steer and one button only;
  how it runs through most of the run; how a novice survives it and an expert exploits it; how the bot learns it
  before any pool is generated; the one HUD signal it needs (the HUD does not grow).
- **A picture.** A greybox frame of its opening and of one place, from the chase camera's height and lens (ART.md 8:
  about 1.5 m over the snow at 30 m/s, a 62 to 79 degree field of view), at 1280x720. Build one small greybox tool for
  all of them (a dev-only page under `prototypes/r9/`, three.js, flat-shaded greys, one key light) that also draws one
  of the five from its real sim course in the same greys, so the owner sees a concept beside what exists on equal
  terms. Greyscale is the point: the shape must carry the difference. Shoot in the browser slot, briefly.
- **What it takes.** What it needs from the sim (new section kinds, surfaces, hazards, mechanics, per-mountain values)
  and why each is additive (which code path the five never enter; which constant becomes per-mountain and how the five
  keep their exact value); the bot's work; the fairness and budget tests it must pass and any new promise it needs;
  its size (the score pack at the five's 9.3 to 14.4 MB, or leaner, and its world's code); its estimated cost on Low
  against the five's (draw calls and what it adds a frame); where it unlocks; and its risk, honestly (what could make
  it ride like the five after all).

Then **the set of three you propose**: each pair differs on at least four axes; at least two are not a high mountain
above cloud; not all three unlock behind the finale. Say how they sit with the five on the unlock path (today: Pinecrest
first, mountains open by passing ghosts, Lanternfall by The Twelve or Almanac page 21), what each brings to Trials and
the Long Night, and what each is not (the sameness risk). Rank all six or more concepts, with the reason for each place.

## Deliver

Commits on `r9-concepts` (the greybox tool and its frames' script; nothing in the game's boot path); `notes/r9-concepts.md`
with every page, the proposed three and the ranking; a single HTML page `prototypes/r9/concepts.html` the owner can open
on the dev server that lays the concepts out with their greybox frames and the five's greybox beside them; frames under
`shots/r9/concepts/`. Before you finish, give your frames (greyscale, unlabelled, shuffled with the five's greybox) to a
fresh critic (`model: "opus"`, `effort: "xhigh"`, given only ART.md and the frames) and ask it to sort them into
mountains and say which are unlike the rest and why: record what it got. Your final message: the six or more concepts
in a line each, your three and why, and what the main lane must decide.
