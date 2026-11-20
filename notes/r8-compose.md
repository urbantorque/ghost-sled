# Round 8, the compose lane: break the trench (V3)

What a player should say: "Every mountain feels like a different place to be in, not just a different colour."

The fault (DECISIONS 367, `notes/r8-review-m0.md`): all five mountains opened on one picture, the corridor between two
banks with the peak or the moon dead centre, and so did the stage starts. The sim raises the bank 9.5 m in its first
10 m past the edge (`course.ts bank`), and everything past that (more bank, drifts, the forest wall, the mountainside)
carried the trench on up. The sim's banks are what a sled rides, so they stay; this lane shapes what lies past the
limit and where the lens stands, at the places a run is framed for.

## What changed for a player

Each mountain's opening (from the start's stands to the first leap, about 126 to 465 m) and both stage starts (the
threshold under the charm gate, about 1410 to 1600 and 2910 to 3100 m) is a place of its own, after ART.md 15:

| Mountain | Opening | Stage starts |
| --- | --- | --- |
| Pinecrest | The valley side's bank is the crest of a long fall: a timber rail on the crest, three or four big spruces left standing on it leaning out over the drop, the forest behind stood back, the snow rolling over a cornice just past the limit and the mountain falling away to the valley. The lens steps toward the open side and turns to it (the rider left of centre, the open sky right). | The same on the overlook's side there (right at 1410, left at 2910). |
| Frostfang | A blue canyon: both banks stand up into walls of crevasse ice about 30 m tall a few metres past the limit, an arch of blue ice from wall to wall high over the slot, seracs on the crests; the lens stays down in it. At its foot the valley side's wall breaks off and the overlook opens out of the canyon's mouth. | One wall of ice and an abyss on the other side (the third overlook at 1450 to 1590, moved there by the integration lane, is the abyss side). |
| Ember | A ridge: the left bank rolls over and falls away toward the lava fields, the right stands up in a low wall of basalt with organ pipes on its crest and sentinel columns on the fall's lip; the cone dead ahead. | The same, the fall on the overlook's side. |
| Sakura | Terraces: the open side steps down in flats and risers; the other steps up the hill in dressed-stone retaining walls with moss on their copings, torii in plum lacquer and stone lanterns on the flats; the lens turns a touch so the cone stands off the frame's middle. | The same. |
| Lanternfall | A dark crest: both banks roll over and fall away with a rail along each crest, so the cloud sea and its warm pools lie below both sides of the run. | The same. |

## Decisions

- **Draw past the limit only, and make everything stand on what is drawn.** `compose.ts` plans the places from the
  course's sections (the first section after the start up to the first leap; each `Section.gate`), never from metres,
  trimmed clear of every landmark any mood's plan stands (40 m; the start's stands 8 m). Its shape is registered with
  `ground.ts` (`shapeGround`), and `visualGround` adds it, so the forest, the groves (Sakura's orchards stand on the
  terrace flats), the dressing, the far shadows' ground, the crash lenses and anything else that already stood on
  `visualGround` follow it with no change of their own. Inside and at the limit nothing moves (`tests/compose.test.ts`
  checks every 7 m of every stretch on all five mountains).
  - Four bank shapes: a **wall** (rises its height over 9 m, a crest broken in facets along the run, its face in shards,
    giving back to the bank by 52 m so the mid-ground is untouched), a **fall** (a 0.6 m cornice 2.5 m past the limit,
    then a convex rollover steepening to the mid-ground's own 1.8, which carries on to the valley floor), a down
    flight of **steps** (8 m flats, 4 m risers) and an up flight (**rise**).
  - A fall's far ground comes down over a longer stretch than its crest (1.4 m of run per metre out): with the plain
    ramps the cut's ends stood as white cliffs across the view (Pinecrest's 150 m and Lanternfall's first frames).
  - Steep faces keep the forest and the dressing off (`keeps`, through the props' `siteKeep`); flats are planted. A
    fall keeps only its crest clear (3 m past the limit, under the rail): cleared to 26 m, a crest read as "bare,
    empty snow behind rails" to the second stills critic, and the forest standing on down the fall gives the drop
    its dark ranks.
  - Where a place shapes a side, an overlook's own lip gives way to it (`OverlookPlan.drop`), its rocks stand down and
    its rail does not stand at a wall's foot; a fall or a flight takes the mid-ground's valley form (`wide`), and the
    mid-ground's edge reads the drawn ground (`midground.ts sideInfo`).
  - A composed wall's ice ramps from a dark foot to a pale skin by its own crest height (`aRock.w`), so the aurora takes
    only its top third. Without it the second critic's "huge flat mint-teal slab" at Frostfang 3000 m.
- **The lens by place, kept close.** `CamPlacer` (camera.ts, its own class so the speed lane's FOV and breath stay
  apart) eases toward the place's set over about 1.1 s: up, back, a step aside, a turn of the look, the horizon's cap
  and the rider's row, all at the place's weight; a phone takes half; the big-air vista and the hero frame take over
  from it; it never takes the steering. The first tuning raised the lens 1.4 to 2.8 m and drew it back up to 1.4 m:
  two critics preferred the old frames for their bigger rider (ART.md 15 rule 4) and a cropped moon, so a place now
  rises a metre at most (0.2 to 1.2 m) and composes by its turn and its step aside. Under reduced motion the placement
  is kept, eased at half speed: it is a framing held over a place, as the speed's height is, not a movement.
- **The place shots (the second pass, after the main lane's decisions).** The chase's metre of placement does not
  change a layout a critic can see, so each opening and each stage start now opens on a shot of its own
  (`game/shots.ts` kind `'place'`, `PLACE_LENS` per biome; `camera.ts placeLens`): from the first section after the
  start, and from 40 m into each threshold, for 100 m (about three seconds at 30 m/s), handed back to the chase 40 m
  short of its end (eased out at 1.8/s, so the chase has the road again within about a second and a half). Pinecrest,
  Ember and Sakura stand the lens 10 to 11 m up and 3 to 4 m out over their open side, looking down the fall (a lens
  under the bank's 9.5 m crest saw only the bank: Ember's first try at 3.6 m); Frostfang's stands 0.55 m over the
  snow in the canyon looking up at its ice arch; Lanternfall's 8 m up on the crest. Each takes its sides from the
  composed place (`ComposePlan.sideShots`), gives way in the air, in a tumble and to the run's opening reveal, stands
  level, adds 4 to 7 degrees of lens and a thin letterbox; under reduced motion only the letterbox plays. Keyed to
  the course's sections, so a replay, a still and a Daily get the same shots.
- **Frostfang's canyon is shorter:** its walls stand up 70 m before the overlook (from about 180 m), so the run in from
  the start keeps its lit floor and the long shadows down it (three critics on stills chose those), and the canyon
  frames the reveal at its foot. **Pinecrest's cut from the air:** a fall's face is painted as rock only where it is
  truly steep at its weight, so the stretch's ramp reads as a slope of snow. **Bare banks:** a fall keeps only its
  crest clear and the forest stands on down it; Lanternfall's crest keeps its own pines below the rail.
- **What frames them** (`framing.ts`): the spruces, the ice arch and seracs, the basalt, the torii, lanterns and
  retaining walls. One place's pieces in one geometry, one draw while it is in range, built on idle time (never in the
  frame that asks: the opening's are in reach from the start line). Nothing stands over the run except the arch, high
  over the slot; a bough may reach over the limit by a metre, as the forest's own do (tested).
- **Not built: a span over the run** (a torii or an arch across a bowl). Its air clearance has to come from the
  landmarks' flown air profile, and a bowl has kickers; the side pieces do the framing instead.
- **A course shape the sim could give** (a request for a later sim batch; the sim is closed this round): the trench
  is the sim's own 9.5 m bank, and from a lens 1.5 to 3 m over the snow nothing past a bank's crest 30 m away shows
  below its line. A valley "below" the run (Pinecrest's ART.md 15 "open, the valley below") needs the bank itself
  lower on one side at the opening: a section kind with a low bank on one side (`bank(e)` capped near 3 m, the limit
  where it is today) would let the lens see down the fall. What was done instead: the fall starts 0.3 m past the limit,
  the lens steps toward it and turns to it, and the crest carries a rail and leaning spruces against an open sky.

## The verdict, first

**V3 is not done, after a second pass.** The latest: **6 of 10** blind pairs on stills from the same round-8 commit
(the bar is 8), and a critic asked "five places or one layout" answered "two layouts (a low trough and a high spine)
dressed five ways", the after set closer than the before (Frostfang's canyon under its arch, Lanternfall's crest). The
first pass's record follows. On stills that hold the run still (the main lane's `stills.sh`, round-8 30dd5b3), three fresh critics
picked the new frame in **4, 4 and 5 of 10** blind pairs (the bar is 8). The greyscale test passes (5 of 5 openings,
10 of 10 stage starts) but so does the before set (a control critic, 5 of 5 and 10 of 10): the mountains are told
apart by their skies and landmarks, not by what this lane drew. Asked directly, the critic on the after set said the
five openings are "one layout, five skins": the same trough, the rider bottom centre, the vanishing point just above
the middle, a rail along both berms, "the places told apart almost entirely by the sky and the far landmark". Only
Frostfang's canyon departs from it, and two of three stills critics preferred the old open Frostfang (its lit floor and
the long shadow a spire throws down it) to the walls. The live-frame critics (8, 5 and 9 of 10, below) were judging
the run as much as the change, as the main lane found.

**The second pass** (the main lane's decisions after the first report: the Frostfang trim, the bare banks, Pinecrest's
cut, then the camera, judged on stills shot from the same round-8 commit, f784510, so a pair differs only by this
lane's work: `before5` from a build of f784510, `after5` from this branch merged with it):
- With a place shot at every opening and stage start (`pairs-s4`): **3 of 10**. The critic picked the new frame at
  Pinecrest's opening (ghost pills, the rail leading the eye), Sakura's 3000 m (the plum torii and the terraces) and
  Frostfang's 1500 m; it chose the old frame where the shot made the rider small ("its rider is tiny in the bottom-right
  corner", Ember), where the stage starts' high lens put the charm gates' gantry beam and lantern string across the
  middle of the frame (Pinecrest 3000, Ember 3000, Frostfang 1500 on the other side), where a letterbox shrank the
  picture, and at Lanternfall's crest ("two blank grey slabs at the ends of the ridge", the cut's ends seen from above).
- The layout question, on greyscale openings of both builds (`gray-open-5` after, `gray-open-5b` before): neither set
  reads as five places; both are "two layouts (a low trough and a high spine) dressed five ways", and the after set
  "comes closer": "its Frostfang is a walled ice canyon with an arch closing the frame, and its Lanternfall, bare and
  starry over the cloud sea, stands apart from Pinecrest", where in the before set Frostfang sits in the shared trough
  and Lanternfall reads as Pinecrest's cousin.
- After that critic: the stage-start shots are off (`PLACE_STAGES`), Ember has no shot, and the shot has no letterbox
  (commit ca11dda). **The fifth critic on stills (`pairs-s5`, the same before5 against `after6`): 6 of 10**, the best
  on stills, still under the bar of 8. It took the new frame for Ember's basalt ridge ("which is Ember as the bible
  describes it"), Lanternfall's crest ("the sea of cloud with its warm pools opens on both flanks: a real vista with
  strong leading lines"), Sakura's torii and terraces at 3000 m ("tell you where you are"), Ember's 1500 m and two
  more. It took the old frame for Pinecrest 150 m (the cut's face from the air, "a big flat white slab", still),
  Frostfang's canyon at 150 m and its wall at 3000 m ("smeared ice walls", "one big smooth blue ice face with little
  drawn on it", "no sun in shot") and Pinecrest 1500 m (near identical; crows in the old).
- Readability at the openings with the shot in (`readability.js` from 160 m, the hand-back at 180 to 220 m inside it;
  before on f784510): road median / worst at 30 m/s, Pinecrest 24/4 to 60/4, Frostfang 67/0 to 70/4, Ember 72/5 to
  74/4, Sakura 68/4 to 72/4, Lanternfall 44/13 to 60/14; at 44 m/s 66 to 68 m everywhere, before and after. The
  rider at 30 m/s: level or larger, except Lanternfall's 165 to 143 px.
- The ghost's mint smear at the right edge of Pinecrest 300 m is in the before stills of f784510 too: not this lane's
  (the events lane's ghost near the lens).

Why, in one line: the trench is the sim's own bank (9.5 m in its first 10 m past the edge), and from a chase lens 1.5
to 3 m over the snow nothing past a bank's crest 30 m away shows below its line; shaping past the limit changes the
skyline over the banks, not the frame's layout. What would break it is listed under "For the main lane".

## How it was judged

Every critic was a fresh general-purpose subagent (`model: "opus"`, `effort: "high"`) given only ART.md's path, the pairs
folder and the brief's question, never told what changed or which side is new. Pairs are the round's before set
(`shots/r8/before/high`, the round-8 head) against this lane's build at the same distances, on seeded sides
(`blind-pairs.mjs`), five openings and five stage starts each time.

| Critic | Build | New frame picked | Old picked, and why |
| --- | --- | --- | --- |
| 1 (`pairs1`) | first working state, dev server | 8 of 10 | Ember 300 m (the raised lens pushed the cone up under the HUD), Sakura 300 m (the turn put the cone dead centre under the race pill) |
| 2 (`pairs2`) | lens up 0.7 to 2.8 m | 5 of 10 | Pinecrest 150 m and Sakura 150 m (a smaller rider, ART.md 15 rule 4), Lanternfall 300 m (the moon cropped), Pinecrest 1500 m (the old frame happened to hold a drafted ghost), Frostfang 3000 m (the wall "a huge flat mint-teal slab") |
| 3 (`pairs3`) | the fixes below (commit cf7781b) | **9 of 10** | Sakura 1500 m: "the grey terrace slabs at top left read as untextured boxes" (fixed after it: dressed blocks, below; not re-judged by a critic) |

**On stills** (`before-stills/high` against `after-stills{,2,3}/high`, the same tick of the same replayed pool rider):

| Critic | Build | New picked | What it held against the new frame |
| --- | --- | --- | --- |
| S1 (`pairs-s1`) | cf7781b and the dressed walls | 4 of 10 | Frostfang's canyon "boxed in by two huge ice walls almost one blue", no long shadow on the floor; Pinecrest's rider pushed to the lower left and a ghost near the lens a mint smear at the edge; Ember's ghost swept out of frame by the lens's step aside; two pairs on ghosts and labels |
| S2 (`pairs-s2`) | the floor out of the canyon walls' shadow, the step aside under a metre | 4 of 10 | Pinecrest 150 m from the air: "a big flat greyish-pink rectangle" (the fall's first metres seen side on) and its pines lost to a fence; Frostfang's canyon again; Lanternfall's banks "bare, empty snow behind rails" where the old had pines and a smoking cabin; Sakura's walls still a slab; the rider low with the sled cut off at Lanternfall 1528 m |
| S3 (`pairs-s3`) | the forest back on the falls below the crest, the fall ramping in over 80 m | 5 of 10 | picked side A in 9 of 10 (a side bias; the new frame was on A in 6); for the new it named Lanternfall's crest ("a ridge with the cloud sea opening on both sides, height and scale") and Sakura's torii and terraces; against it Frostfang's walls ("closes the view and loses the sun") and the ghost smear at Pinecrest |

Fixed after the second: the lens rises a metre at most (it was up to 2.8 m), the canyon's lens no longer sinks, a wall's
ice ramps by its own height so the aurora takes only its top third, and its face is cut in shards. Fixed after the
third: the retaining walls are three dressed blocks a segment, each its own value and set a little proud or back,
under a mossy coping.

**The greyscale test** (the brief's done line; on live frames here, on stills and against a control in "The verdict,
first"): a fresh critic shown only ART.md 15's five "Feeling" and "Colour
script" paragraphs and greyscale frames with the HUD's top band and the hint row cropped off, unlabelled and shuffled,
matched **the five openings 5 of 5** and **the ten stage starts 10 of 10** (two a mountain). Its reasons: Ember "a dark,
fluted cone fills the centre with a heavy dark band of cloud above it"; Pinecrest "the brightest frame", dark pines
framing both banks, crisp ridges; Sakura washed-out pale grey, a faint pale cone through haze, the only darks a few
sharp pines and round-topped trees; Lanternfall lamp posts, a pale moon, the valley "a flat, pale cloud surface below
the line"; Frostfang a skyline of jagged needle spires, a black fang-shaped shard, cracked glassy ice. One caveat it
named itself: a graveyard tag ("Frost Mercy") is drawn in the canvas on Frostfang's opening and was not cropped; it
said the spires and the ice alone told it. Its weak spot: Ember's stage starts read as the same shot as its opening (the
cone dead ahead under the deck each time).

**Readability** (`readability.js`, the safe line pinned at 30 and 44 m/s, five reads 30 m apart from each place's
start, all five mountains; before on the round-8 head's own server, after on this build):

| From | Before: road median / worst (m) at 30 m/s, m0 to m4 | After |
| --- | --- | --- |
| 160 m (the openings) | 24/5, 68/4, 71/5, 67/4, 44/14 | 60/4, 70/4, 74/4, 72/0, 60/14 |
| 1430 m | 67/55, 75/73, 73/34, 71/55, 31/24 | 68/57, 74/73, 73/34, 71/57, 30/29 |
| 2930 m | 73/73, 74/70, 72/67, 74/37, 74/74 | 73/73, 74/70, 72/67, 74/37, 73/72 |

At 44 m/s every median is 64 to 69 m before and after. No worse anywhere; Pinecrest's and Lanternfall's openings read
further (the lens turned toward the open side sees the road's bend). The worst reads are the same frames before and
after (a kicker's lip or a ghost over the line). The first tuning's canyon lens (0.35 m lower) had cut Frostfang's
opening road to 24 m; it rides at the plain height now. The rider's height on screen at 30 m/s at the openings is level
(Pinecrest 174 to 176 px, Frostfang 175 to 178, Ember 158 to 165, Sakura 169 to 169) except Lanternfall's crest, 161 to
145 px, where the lens stands 1.2 m higher to see the cloud.

## Cost

(Measured on the build of cf7781b, when a fall kept its forest off to 26 m; the last build plants the fall below its
crest again, so its triangle saving is smaller than this. Not re-measured: no slot was free for it.)

- **Draws and triangles** (the frames' JSON, summed over a frame's passes; the 39 touched frames on each tier: 150, 300
  and 450 m and every fixed frame from 1400 to 1700 and 2880 to 3200 m): High 101.4 to 98.4 calls, 866k to 831k
  triangles (-4.0%); Low 49.9 to 46.8 calls, 119k to 108k (-8.7%); the phone on Medium 91.7 to 88.3, 610k to 582k
  (-4.6%). The composed banks keep the forest and the dressing off their faces, which is more than the framing pieces'
  one draw (at most 5.7k triangles, Sakura's) adds. The ghosts and labels in view move these by a few calls either way.
- **A Low frame's GL calls** (`glcount.js`, Low, 8 s of the opening, about 120 to 370 m): Pinecrest 500.1 to 482.8 a
  frame, Frostfang 497.5 to 469.4, Ember 473.9 to 468.1, Sakura 499.8 to 483.0, Lanternfall 516.5 to 483.5; draw calls
  23.2 to 20.8, 23.4 to 20.1, 21.7 to 20.5, 23.0 to 20.7, 24.2 to 21.7. Low is lighter at every opening. No uniform,
  program or pass is added (no uniform array anywhere).
- **The frame's script:** each frame the chase eases six numbers (`CamPlacer`) and the world asks the plan for the
  place at the rider (a range check over three places); terrain rows inside a composed stretch pay three `delta` calls
  a vertex past the limit, on their existing time slice. Not timed with `systime.js` (the slots were held by other
  lanes for most of the afternoon); none of it is per-object work.
- **Idle time:** a place's framing pieces build once, on `requestIdleCallback`, as it comes in range: Pinecrest 19 ms
  the first time (its spruce cached after), Frostfang 3, Ember 6, Sakura 33, Lanternfall none (node, a loaded machine).
  Sakura's is the one long task, once a place.
- **The first frame:** nothing new runs before it. The plan is 0.1 to 1 ms after the overlooks' landmark plans, which
  already run then; the opening's pieces wait for idle time.
- **GPU pass times** (`?gpu`): not measured. Nothing adds a pass, a program or a full-screen cost; the terrain draws the
  same vertices.

## Low and the phone

- **Low** is the same composition as a poster: the banks are shaped on every tier (Low's coarser outer columns draw the
  walls and falls in fewer, larger planes, the poster's flat values), the rail stands on every crest, and the framing
  pieces are the same one draw. The canyon takes Low's printed ice (`after/low/m1-z0300.png`). Low's frames get
  lighter (above).
- **The phone** takes half the lens's placement (its lens is already high and its rider must keep its size); its world
  is Medium's. `after/phone-medium`.
- **Reduced motion** keeps the placement, eased at half speed (a framing held over a place, as the speed's height is);
  the overlook's reveal and lean stay off under it as before.
- The console was clean in every capture (39 frames on each of three tiers, the High set twice, and the readability and
  GL probes).

## Touched outside my files

- `src/render/world.ts`: the props' `siteKeep` also takes the composed places' steep faces (`overlooks.keeps`), and the
  chase's target carries `place` (`overlooks.compose.place(s.z + 20)`), with the scratch object it is written into.
  Nothing else.

## For the main lane

- **A decision: keep, trim or drop this lane's work.** It is safe (nothing a sled touches moves, every suite green,
  readability no worse, Low and every tier lighter, the console clean), but it does not break the trench and the
  stills critics do not prefer it. My reading of the critics: keep Lanternfall's crest, Sakura's terraces and torii,
  Ember's ridge and the rails; consider dropping Frostfang's canyon (the open run with its raking shadows won two of
  three stills pairs) or keeping it shorter so the opening has both; Pinecrest's fall changes little.
  `compose.ts recipe()` is the one place to change any of it.
- **What would break the trench** (none of it this lane's to build):
  1. *The sim's bank.* A section kind for an opening with one bank low (`course.ts bank(e)` capped near 3 m on that
     side, the limit where it is today) lets the lens see down the fall: Pinecrest's "valley below", Ember's ridge,
     Lanternfall's crest would read as places. This is the request this lane makes of a later sim batch.
  2. *A camera allowed off the chase at the opening.* A director's shot (`game/shots.ts`, as the reveal's whip and the
     street's tracking shot) for the first seconds of each opening: a side lens on the open side, a low lens in the
     canyon looking up, a high lens over the terraces, a few seconds each, never taking the steering. The chase's
     placement here is a metre and a turn, which a critic does not see.
  3. *Foreground that crosses the frame.* An arch or a torii over the run at the opening, with its clearance from the
     landmarks' flown air profile (`SitePlan`), so something frames the run itself.
- **The sim request, for a later round's batch** (the sim is closed this round; the main lane's decision 2): a low bank
  on one side where each mountain is composed. Today `course.ts bank(e)` rises to 9.5 m by 10 m past the edge on every
  plain section; the request is a shape flag (say `bankLow`) that caps it near 3 m on one side over the section's body,
  the limit where it is, so a sled is turned back at the same place and the lens 1.5 to 3 m up sees down the fall.
  Section and side for each (sim z; +1 right of travel, three.js +x):

  | Mountain | Opening (the bowl and cruise after the start, to the first leap) | Stage 1 (the threshold) | Stage 2 (the threshold) |
  | --- | --- | --- | --- |
  | Pinecrest | bowl 120 to 367 and cruise 367 to 499: right | cruise* 1410 to 1600: right | cruise* 2910 to 3100: left |
  | Frostfang | cruise 373 to 495 (after the canyon, out of its mouth): left | cruise* 1410 to 1600 (1450 to 1590 clear of the viaduct and the village): right | cruise* 2910 to 3100: left |
  | Ember | bowl 120 to 374 and cruise 374 to 523: left | cruise* 1410 to 1600: left | cruise* 2910 to 3100 (from 2950, past the lift span): right |
  | Sakura | bowl 120 to 389 and cruise 389 to 514: left | cruise* 1410 to 1600: right | cruise* 2910 to 3100 (from 2950): left |
  | Lanternfall | bowl 120 to 373 and cruise 373 to 493: both (a crest) | cruise* 1410 to 1600: both | cruise* 2910 to 3100 (from 2950): both |

  The sides are the overlooks' (the mid-ground already takes the valley form there), so nothing past the bank changes.
  Things to check in that batch: the threshold's `THRESHOLD_HW` stays, kickers in a bowl's banks and the bot's wall
  rides read the lower bank, and every pool is regenerated.
- The critics' standing complaints that are not this lane's: the neon charm-gate boards, a flipped sled's underside
  hiding the rider, ribless lanterns, Ember's grey-lilac snow, the HUD's stack over the sky, and (on live frames)
  ghosts and labels.
- Nothing to wire: the composition rides in the overlooks' object the world already has.
- ART.md and the README: the text below.
- The speed lane owns the FOV, breath and shake: the placement is in `CamPlacer` and enters the chase's sums as
  `pl.* * pk`; keep that when the speed lane reworks them.

## Still short

- **The item.** See "The verdict, first": not met on stills.
- **The title shots** (`keyart.ts`; the screens lane's critic: "the rider small or hidden in spray"): not looked at or
  changed. The frames the screens lane judged (`shots/r8/screens/after4/h-*-title-*.png`) catch the title at 1.5 s,
  in the crane's wide establishing shot, where the rider is a dot by design; whether the rested shot hides the rider
  in spray needs a capture of each mountain's title after the crane settles.
- **Spans over the run** (a torii, an arch or a lantern string framing the opening) were not built: their clearance
  must come from `SitePlan`'s flown air, and the openings' bowls have kickers.
- **A lens that keeps the rider big and shows the place** is the shot the critics would have taken: close behind and
  low to one side, the rider large in the foreground and the canyon, the cone or the terraces past its shoulder. The
  high lenses tried here lost on rider size every time.
- **Pinecrest's fall from the air** shows its first metres side on as a pale face (the stretch cannot start before the
  start's stands end, so the fall cannot ramp in earlier).
- **The valley below is not below.** From inside the sim's 9.5 m bank the lens sees over a fall's crest only toward the
  frame's edge; Pinecrest's opening is open and asymmetric (open sky over the crest's rail and spruces) but the valley
  floor shows only down the fall line. The request above (a low bank on one side at the opening) is what would give it.
- **Ember's stage starts** read as its opening again (the greyscale critic): the cone dead ahead dominates; the wall and
  fall barely show from the run.
- **Sakura's dressed walls** changed after the last critic and are not judged by one.
- **In motion:** no 30 s clip was shot of the new openings; the ramps were judged in stills only. The lens's ease
  (1.1 s) and the terrain ramps (34 to 46 m, the far ground longer) want a look in a clip beside
  `shots/r8/before/motion/m*-opening.mp4`.
- **Not mine but named in every pair:** the HUD's centre stack over the sky, the neon fork gantry boards, ribless
  lanterns, Ember's grey-lilac snow.
- **A slip of the lanes' rules:** a capture script of mine carried on after its 40-minute wait for a browser slot ran
  out (it did not stop on the refusal) and held one headless browser without a slot for some minutes at about 15:00,
  beside two lanes' slots. Every script of mine now stops when the slot is refused.

## Text for ART.md (section 12, after Overlooks) and the README

ART.md, section 12, after **Overlooks**:

> - **Places of their own.** Each mountain's opening (from the start's stands to the first leap) and every stage start
>   (the threshold under the charm gate) is composed, past the sim's limits only, after its feeling: Pinecrest's valley
>   side rolls over a cornice into a long fall past leaning spruces, a rail on the crest; Frostfang rides a canyon of
>   crevasse ice 30 m tall with an arch of blue ice across it, and a stage start there is one wall over an abyss; Ember
>   rides a ridge, a low wall of basalt with organ pipes on one hand and the fall toward the lava on the other; Sakura's
>   open side steps down in terraces and the far side steps up the hill in walls of dressed stone, with torii in plum
>   lacquer and stone lanterns on the flats; Lanternfall rides a crest, both banks falling away to the cloud. Whatever
>   stands there stands on what is drawn. The lens turns toward the place and steps aside a metre or two and rises at
>   most a metre, so the rider keeps its size; a phone takes half; reduced motion keeps the framing, eased slower.

README (the round 8 look): "Every mountain opens on a place of its own (a canyon, a valley's crest, a ridge, terraces,
a crest over the cloud), and every stage start too, drawn past the run's limits so nothing a sled touches moves
(`src/render/compose.ts`, `framing.ts`)."

## Where things are

All under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/compose/`:
- `after/{high,low,phone-medium}`: the touched frames on the second build (lens up to 2.8 m); `after2/high`: the final
  lens (commit cf7781b); `after3`: Sakura's dressed walls (the last build); `nohud`: the greyscale test's sources.
- `after-stills/{high,low,phone-medium}`, `after-stills2/high`, `after-stills3/high` (the last build): the touched
  frames as stills, beside the main lane's `shots/r8/before-stills`.
- `before5` (a build of round-8 f784510) and `after5`, `after6` (this branch; `after5` also Low and the phone): the second pass's stills.
- `pairs1`, `pairs2`, `pairs3` (live), `pairs-s1` to `pairs-s5` (stills): the critics' pairs; `keys/`: their
  keys and picks (outside the pairs).
- `gray-open`, `gray-stage` (live, cropped), `gray-open-s`, `gray-stage-s` (stills, after), `gray-open-b`,
  `gray-stage-b` (stills, before, the control), `gray-feelings.md`: the greyscale tests as the critics saw them;
  `keys/gray-*.json`.
- `probe/`: readability (`read-*`) and Low's GL counts (`gl-*`), before and after.
- `it1`, `it2`, `try`: iteration frames.
