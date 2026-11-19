# Ghost Sled, round 8: beauty and the hook

You're working on Ghost Sled, a downhill sled racer for the browser and CrazyGames, in this repo (Vite, TypeScript,
three.js). Round 7 and the visual lift are shipped on `main` and live at https://urbantorque.github.io/ghost-sled/.

The owner rates the game today:

- **Look, beauty and depth: 8.5 out of 10. It must be a 10.**
- **Fun, mechanics and the retention engine: 7.5 out of 10. It must be a 10:** addictive, rewarding and
  delightful from the first run to the two-hundredth.

This round is only those two things. Music is out of scope (sound effects for new mechanics are in). The game is
not broken, and **you are not here to refine the status quo.** You have authority to replace systems, add
mechanics and modes, and reshape the first hour, wherever a player would feel it.

Before you change anything, read:

- the README (top to "Controls", then "Round 7 play test and performance" and "The visual lift");
- ART.md, all of it (colour roles in section 1 are locked; section 15 is the direction mountain by mountain);
- DECISIONS.md from 276 on (round 7 and the lift), and 360 to 366 closely;
- `notes/r7-report.md` (what was never checked by a person, and the open questions);
- `prompts/round-7-from-eight-to-ten.md` for how a round is run here.

Work on a branch `round-8`. Do not merge, push or deploy without the owner's word.

**Run the whole round end to end without stopping for approval.** The owner has chosen this: all four milestones
straight through, as round 7 ran. Make the calls yourself and record your reasoning in DECISIONS.md as you go.
Ask the owner only if you are truly blocked.

---

## 1. Where the game stands (an outside review, to be checked)

This review was made from the docs, the progression code and the merged build's fixed frames on all five
mountains. It was not a hands-on play session. **Treat every line as a hypothesis and check it in phase 0.**

### The look: why it is an 8.5

What is already strong: the far massif and painted skies, each mountain's palette, the rider's colour and scarf,
the ghosts' glass, the HUD's type, Sakura's opening frame.

What holds it back, biggest first:

1. **Snow is half of every frame and the least developed thing in it.** It reads as one smooth hue gradient with
   white speckle. Tracks are hairlines. Near the lens there is no grain, no relief, no depth of powder, no
   difference a player can see between powder, groomed and ice. (`shots/vl/merge/after/high/m0-z0900.png`)
2. **Trees at the lens break into shards.** A pine within about 15 m is a handful of huge flat triangles
   (`m0-z2250.png`: the left third of the frame). The chamfer pass reached props, not the forest.
3. **Every mountain opens on the same composition:** a trench with a bank each side and the vanishing point dead
   centre. Ember at 232 m, Lanternfall at 233 m and Sakura at 251 m are one layout in three palettes. The world is
   beside the player, rarely below or ahead of them.
4. **Speed is painted on the lens.** White streaks over the picture carry most of the speed sense and read as
   scratches. The world itself (near parallax, air, the camera) does too little of that work.
5. **Flat value structure on two mountains.** Ember's snow is an even grey; Lanternfall, the night finale, is an
   even lilac. Neither has dark with pools of light in it. Light does not gather anywhere.
6. **Effects are thin for the hero's actions.** A carve, a drift, a perfect landing and a dash do not throw enough
   snow, light or air to feel like events.
7. **The image is not stable at High.** The temporal rebuild was held back (DECISIONS 363): softer rider, doubled
   lifts. Fine geometry still shimmers.
8. **Reward screens are plain.** Results is a dark card with a "+31" on it. The title art is softer than the game
   it sells.
9. **Low is 2 to 5 fps under round 7 at 6x** with no cause found (DECISIONS 366).

### The game: why it is a 7.5

What is already strong: the lantern's dash-or-ward choice, a live field of real records, twelve named riders with
a ladder, fifteen set pieces on twelve verbs with variants, legends, get-ups, a highlight reel.

What holds it back, biggest first:

1. **Lots of systems, no spine.** Missions, medals, ladder, mastery stars, Daily, Cup and The Twelve all pay one
   currency (gifts) that buys looks. There is no level, no track, nothing that says "one more run gets you X".
   A player cannot feel themself growing.
2. **Every run has the same shape.** Two and a half minutes, one meaningful choice (dash or ward). Nothing a
   player decides before or during a run changes how it plays. There are no builds.
3. **The air is shallow.** Spin and backflip are the whole vocabulary. Airtime is where a sled game's expression
   should live, and where a 200th run should still be finding things.
4. **Ghosts are the game's identity and they are scenery.** You draft them and pass them. They never contest
   anything with you in the moment.
5. **The results screen does not sell the next run.** It reports. It does not celebrate, and its one button is
   always "Run Again" whatever the most tempting next thing is.
6. **Nothing asks you back tomorrow.** A Daily and a weekly Cup exist; there is no streak, no league, no calendar.
7. **After The Twelve there is nowhere to go.**
8. **No person has played any of it** since round 6. Every claim of fairness and feel is scripted.

---

## 2. What a 10 means here (the bars)

**The look.** A fresh critic (given only ART.md and frames) scores at least one frame a 9 or better on every
mountain at High, and High's mean is 8 or better under the harsher critic of DECISIONS 342. A 30-second clip of
each mountain reads as beautiful with the HUD off. Low reads as a designed poster and is not slower than round 7.

**The game.** These are testable; write them as tests or lab scripts in phase 0 and make them pass by the end:

- **No dead runs.** In a simulated first 30 runs by the mid pilot, every run ends with at least one thing
  gained that is shown on results (a rank, an unlock, a sticker, a duel, a medal, a streak day).
- **Always one run away.** At any point in the first 100 simulated runs, results can name a goal reachable in
  the very next run.
- **Decisions.** A run holds at least four choices that change how the rest of it plays (today: one kind).
- **Expression.** At least ten named air tricks, and the expert pilot's best combo uses at least five of them.
- **First minute.** A first-time player passes a ghost within 20 s, lands a prompted perfect within 45 s, and
  dashes within 60 s. The clumsy pilot still finishes at least 26 of 30.
- **Still new at run 50.** Something a run-50 player has not seen is reachable on every mountain.

**The honest bar.** A critic and a pilot are not a person. The round ends with a 15-minute play route for the
owner (section 7). Do not call anything a 10 that only scripts have touched: say what only scripts have seen.

---

## 3. Rules for this round

**Kept from before**

- Colour roles are locked (ART.md 1). Vermillion is the player. Everything is original: no existing game's
  names, characters, look, levels or music.
- `tsc` and every test green; the console clean on every tier and mountain.
- High, Medium, Ultra and the phone hold 60 fps. The first frame does not get slower. Low at 6x must end the
  round at or above round 7's figures (it is under them today).
- Nothing bought ever gives an edge in a race. In-run choices are open to everyone equally.
- Record every call in DECISIONS.md (continue from 367) and update ART.md and the README.

**Changed for this round**

- **The sim opens once.** Earlier rounds closed `src/sim`, `src/bot` and the ghost pools. This round they open
  for one batch: every sim-touching change in milestone 2 lands together as `SIM_VERSION` 10, then the pools are
  regenerated once (`npm run generate-ghosts`, about three minutes) and the sim closes again. Determinism, purity,
  fairness and migration tests must pass; The Twelve's progress and every save survive (the `migration` suite
  shows how).
- Milestones 1 and 3 do not touch the sim.

**The machine** (see the memory notes; these are hard-won)

- Headless playwright configs only. At most three browsers in total across all lanes; the laptop blue-screens
  under about eight.
- Close stray `perf.js` and `cliDaemon` processes by command line; stopping a task kills only its wrapper.
- Perf: nothing else running, on mains, builds interleaved A B B A, four or five passes (`perf-vl.sh`).
- Source files are CRLF: use the Edit tool or CRLF-aware scripts.
- Make lane worktrees by hand from `round-8`, not with worktree isolation (it cuts from `origin/main`).
- Run `playwright-cli close-all` when a task ends.

**How to work**

- Lanes in parallel where files do not overlap, each with its own notes file `notes/r8-<lane>.md`.
- Every visual lane is judged by a fresh critic that sees only ART.md, the before and after pairs, and a
  question. Never hand a critic your conclusion.
- Every gameplay lane is judged by the pilot lab and by the section 2 tests.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## 4. The roadmap

Four milestones, in this order. Each item gives what a player should say about it, where the work is, and what
done looks like. **Must** items are the round. **Should** items follow if the musts are met. **Stretch** only
once every must and should is done and measured.

### Milestone 0: ground truth (short)

- Play the live build: all five mountains, a Daily, a Cup, a duel, on desktop and a phone viewport, runs 1, 2, 5
  and 10 on one mountain. Check section 1 line by line and write a blunt review into DECISIONS (what is right,
  what is wrong, what it missed).
- Shoot the round's "before" set: the fixed frames on High, Low and the phone, and a 30 s clip a mountain.
- Write the section 2 tests and lab scripts now, failing. Record today's numbers.
- **Find Low's lost 2 to 5 fps first** (memory: time the rAF callback and trace the page lifecycle before
  cutting scene detail). Every later visual item spends frame time, so the budget must be known.
- Write the plan into DECISIONS: confirm or reorder the items below, say what you cut and why.

### Milestone 1: the look (no sim changes)

**V1. Snow as the hero material. (Must; the biggest visual lift.)**
*"The snow looks like you could put your hand in it."*
- Near the lens: wind-rippled relief and grain in the normal, glints that turn with the view (not a screen
  speckle), cool light bleeding through shade edges and warm on sunlit crests.
- Three surfaces a player can tell apart at a glance: powder (soft, deep, matte), groomed (corduroy lines),
  ice (dark, mirror streaks). They exist in the sim already; draw them.
- Tracks with depth: a carved trench with a thrown berm behind every sled, deeper in powder, a scratch on ice.
  Ghosts leave fainter ones. (`trails.ts`, the `ruts` test.)
- Snow that moves: spindrift blowing across crests, a plume off every carve and drift sized by speed and edge,
  a burst and a ring on landings, powder hanging in the air after a ghost passes.
- Files: `materials.ts` (snow shader), `terrain.ts`, `trails.ts`, `particles.ts`, `nearfield.ts`.
- Done: a critic picks the new frame in at least 9 of 10 blind pairs and names the snow unprompted.

**V2. A forest that holds up at the lens. (Must.)**
*"I flew through the trees and they looked great."*
- A near LOD for pines and blossom within about 25 m: layered rounded boughs, snow shelves on them, a real
  trunk. Anything about to fill the frame dithers out before it becomes shards.
- Life in it: boughs shed snow when you pass close (tie it to the near-miss beat), a slow sway in wind.
- Files: `flora.ts`, `meshes.ts`, `chamfer.ts`, the forest LOD in `world.ts`.
- Done: no frame in the fixed set has a single flat triangle wider than about 8% of the frame.

**V3. Break the trench. (Must.)**
*"Every mountain feels like a different place to be in, not just a different colour."*
- Give each mountain's opening and each stage start its own composition: Pinecrest open and sunlit with the
  valley below; Frostfang a blue canyon; Ember a ridge with the cone and lava fields falling away on one side;
  Sakura terraces stepping down; Lanternfall a dark crest above cloud with lights far below.
- Do it without moving a collider: reshape and cut the drawn banks where the sim's corridor allows, open vista
  windows, add foreground silhouettes that frame (an arch, a leaning pine, a torii), and let the camera rise,
  drop and offset by place (`camera.ts`, `overlook.ts`, `midground.ts`, `massif.ts`).
- If a course shape truly has to change, list it for milestone 2's single sim batch. Do not change it here.
- Done: a critic shown the five openings in greyscale can tell the mountains apart.

**V4. Speed you feel in the world, not on the lens. (Must.)**
*"It feels fast."*
- Retire most of the white streak overlay. Replace it with: near parallax that whips past (posts, flags, low
  boughs, fence lines at the corridor's edge), snow and air particles that are in the world with depth, a field
  of view and camera that breathe with speed and dash, blur kept to the frame's edge, a sled that chatters.
- A visible top gear: at flow (the sim's `flow`, 0 to 6) the picture changes state: richer colour, a spirit
  trail off the scarf, wind lines in the air, the ghosts brighter. Call it Spirit Flow and make it the state
  players chase (G6 below gives it its rewards).
- Files: `camera.ts`, `speedposts.ts`, `nearfield.ts`, `particles.ts`, `post.ts`, `rider.ts`.

**V5. Light that gathers. (Must.)**
*"The night mountain is the most beautiful one."*
- A value pass on every mountain, Ember and Lanternfall first. Lanternfall goes properly dark with warm pools
  under every lamp and lantern, lit cloud below, and the rider carrying their own light. Ember's snow is lit
  from below by lava: orange up-light on one side, cold sky on the other, ash in the air.
- Air with light in it: shafts through tree runs and gate arches, fog that takes a lamp's colour near it,
  breath-cold haze in the canyons.
- Files: `palette.ts`, `materials.ts` (`LIFT_GLSL`), `sky.ts`, `postfx/*`, `lanternkit.ts`, `spiritlights.ts`.
- Done: each mountain's histogram shows true darks and true lights where ART.md 15 says they belong, and the
  Lanternfall great lantern is framed lit with the rider (round 7's open item 10).

**V6. Every action is an event. (Must.)**
- Perfect landing: a shockwave ring in the snow, a flash up the rider, a beat of held time.
- Dash: the rider becomes a spirit with a real transformation, the world cools, obstacles ghost as you pass.
- Ward: the lantern breaks visibly and the shards scatter.
- A pass: the ghost reacts and bursts into motes as you go by.
- Finish: scaled to the result (a win is a festival, a personal best lights the town).
- Files: `particles.ts`, `rider.ts`, `ghosts.ts`, `fireworks.ts`, `moments.ts`, `ui/fx.ts`.

**V7. A stable, clean image at High. (Should.)**
- Finish the temporal rebuild with what DECISIONS 363 says it needs (motion for anything that moves by itself,
  the rider kept out of history), or drop it and ship a sharper spatial path. Decide by blind pairs in motion.

**V8. Screens as beautiful as the game. (Must; built with G5.)**
- Results as a short directed sequence over the live scene (section G5). The title's shot captured from the
  engine at its best. One motion language across screens. Use the design-taste-frontend skill for new UI, check
  it under playwright and against web-design-guidelines before calling it done.
- **Photo mode** (Should): pause, free the camera, hide the HUD, save a frame. It sells the look and feeds G8.

**V9. Low and the phone. (Must.)**
- Each V item says what Low and the phone get (a designed cheaper version, never a broken High). Fix the items
  DECISIONS 364 left "as found". End the round at or over round 7's Low figures.

*Milestone 1 gate (do not stop):* blind-pair critics on all five mountains, the perf table against the lift, a 30 s clip a
mountain. Write the results into DECISIONS, fix what the critics name, then go on to milestone 2.

### Milestone 2: the game under your hands (the one sim batch, `SIM_VERSION` 10)

Design all of these together before building any, because they land in one batch and share the input scheme
(one action button plus steer, on keys, mouse, touch and pad). Prototype in the pilot lab first.

**G1. The air is a playground. (Must; the biggest fun lift.)**
*"I keep finding new tricks."*
- At least ten named tricks from the same two inputs: grabs held for as long as you dare (reward grows with the
  hold, and landing while still holding is a fall), spins and flips that combine with grabs into named
  combinations, a late tweak, a trick only off a rail or a wall ride.
- Risk scales with reward. A new trick in a combo pays most; the game already cuts repeats by 30%.
- Each sled gets one signature trick (a sidegrade, like its trait).
- Tricks are called by name on screen, with a sound each, and the rider has a pose for every one (`rider.ts`).
- The bot must be taught them (`src/bot`) so ghosts trick too, and the lab's pilots can measure them.
- Done: the Expression test in section 2; the clumsy pilot's finishes do not drop.

**G2. Charms: every run is a build. (Must.)**
*"This run I went all in on drafting."*
- At the start and at each stage line, three spirit gates stand across the course, each a charm for the rest
  of the run. You choose by riding through one. No menu, no stop: the choice is steering.
- About 24 charms in three families (speed, style, survival) that change how you ride, not just numbers.
  Examples: a perfect landing refunds a lantern cell; drafting fills the lantern; dashes are longer but there is
  no ward; near misses extend the combo timer; a fall costs no get-up but empties the lantern.
- They stack into builds across the three picks, and a few pairs have named synergies.
- Ghosts' records carry their picks (their line through the gates is in the input log), so the race stays fair.
- Unlock charms into the pool through the Almanac (G4), so the first hour keeps widening.
- Done: the Decisions test in section 2; no charm or pair wins more than about 60% of lab races.

**G3. Ghosts that fight back. (Must.)**
*"Old Wren and I went at it the whole last stage."*
- **Showdowns:** ride level with a named rider for two seconds and a showdown starts: a marker 300 m ahead,
  first there takes a lantern cell and the points. The camera, the HUD and a sound make it a moment.
- **Rivals with memory:** the grudge system exists; make it a story. A rider who beat you twice says so, wears
  it, and results offers a one-tap rematch with that rider promised in the field (`field.ts` `promised`).
- **Spirit steal** (Should): a clean pass inside a metre takes a wisp from the ghost and feeds your lantern.
- Most of this is game layer; only what must be in the record goes in the sim batch.

**G6. Spirit Flow pays. (Must; small.)**
- Flow is in the sim (`flow`, 0 to 6) and nearly invisible. With V4's picture, give it stakes: lantern gain and
  score climb with flow, a fall or a dull five seconds drops it, and the best flow held is a results stat.

**Also in the batch if phase 0 confirms them:** spirit lights that hang in the sky before a lip (round 7's open
item 14), any course shape V3 could not reach by drawing, a gentler variant of each set piece for a novice (open
item 3).

*After the batch:* bump `SIM_VERSION`, regenerate the pools once, run every suite, rerun the pilot lab against
round 7's tables (finishes, set pieces won, race liveness), and close the sim.

*Milestone 2 gate (do not stop):* the lab's tables, the section 2 tests, written into DECISIONS. Tricks and charms are feel,
which no script can judge: list what a person must check in the report, give each a dev switch so the owner can
try it alone, then go on to milestone 3.

### Milestone 3: the reasons to come back (no sim changes)

**G4. One spine: Rider Rank and the Almanac. (Must; the biggest retention lift.)**
*"Two more runs and I unlock the next thing."*
- Everything pays experience into one rank: placing, tricks, set pieces, showdowns, missions, medals, stars.
- The Almanac is the rank's track: about 50 pages, a reward on every page (charms into the pool, tricks'
  flourishes, sleds, garage pieces, titles, a mountain's alternate hour of day, modes). The first ten pages
  come fast and each opens something that changes play.
- Fold the scattered goals into it. Missions, mastery and medals stay, but all of them move one bar the player
  always sees. Gifts stay as the garage's currency.
- Seasons with no server: a monthly Almanac chapter by date with its own themed set, the old one kept.
- Files: new `src/game/rank.ts` and `almanac.ts`, `save.ts` (optional fields, as `twelve` was added),
  `progress.ts`, `ui/title.ts`, `ui/results.ts`.

**G5. Results that sell the next run. (Must.)**
*"I didn't even think, I just hit go again."*
- A directed sequence of about five seconds, every step skippable: the run's moment, the place with the
  nearest thing framed ("0.4 s behind Old Wren"), the rank bar filling and stopping short of the next page on
  purpose, what unlocked, then **one** primary button chosen for this run: Rematch, Next Duel, Finish the
  mission ("12 m short"), Claim, or Run Again. Rewards are opened, not listed.
- Restart to riding in under two seconds.

**G7. Come back tomorrow. (Must.)**
- **Keep the lantern lit:** a day streak shown as a flame on the title, a seven-day calendar of growing
  rewards, one ember that saves a missed day. It fits the fiction; use it.
- **Daily contracts:** three a day across the Daily Mountain and the named ones, with a bonus for all three.
- **Cup leagues:** the weekly Cup becomes a league of twenty records with promotion and relegation through
  five divisions. The other nineteen are generated runs, as the pools are; keep the game's promise that every
  rider shown is a real record, and never present them as live people.
- A returning player's title screen says in one line what is new today.

**G8. The Spirit Album. (Should.)**
- A sticker book of everything there is to see: legends, set-piece variants won, moods, graveyards survived,
  tricks landed, riders beaten, charms and synergies found. Each sticker is a frame from the run it happened in
  (the reel can already render a shot from a record). A completion figure per mountain and overall.
- This is what makes run 50 still new: show the silhouettes of what has not been seen.

**G9. Somewhere to go after The Twelve. (Should.)**
- **The Long Night:** a gauntlet of mountains back to back with get-ups, lantern and charms carried over,
  chaos rising each leg, a pick between legs, and a personal best depth. Reuse whole courses; do not stitch
  stages across mountains.
- **Mirror mountains** (Should): flip the picture and the steering, sim untouched, ghosts mirrored with you.
  Five more courses for almost nothing. Watch for lettering and signs that would read backwards.
- **Trials** (Stretch): a weekly rule twist with its own medal.

**G10. The first minute. (Must.)**
- Stage the first run so the section 2 "first minute" bar holds: a ghost to pass early, a prompted perfect, a
  full lantern and a reason to spend it, the first charm gate, and a finish. Run two opens the Almanac.
- One idea taught at a time; hints already retire themselves (`hints.ts`).

**G11. Share it. (Stretch.)**
- Save the highlight reel as a short video from the canvas, and a photo-mode frame with the run's stats.
- Before promising anything social, read the CrazyGames SDK docs for what it offers today (leaderboards,
  friends, invites) and what its rules allow for rewarded ads. Ask the owner before adding any ad placement.

*Milestone 3 gate (do not stop):* the "no dead runs" and "always one run away" tests green over 100 simulated runs, the
economy table (what a player has at runs 1, 5, 20, 50, 100). Write them into DECISIONS, then go on to milestone 4.

### Milestone 4: polish, proof and ship

- A feel pass over everything new with the camera, sound effects, rumble and timing: hit-stop on big moments, a
  landing's weight, the rank bar's tick. Reduced motion respected throughout.
- The full critic loop on the final build (five passes a mountain, as round 7), the full perf run against the
  lift, the pilot lab, the smoke on every tier and mountain, the release script's size checks.
- The round's report in `notes/r8-report.md`: what changed for a player, what was measured, what only scripts
  have seen, what still needs a person, and the open questions.
- Merge and publish only on the owner's word.

---

## 5. Order of value (if the round must be cut short)

1. V1 snow, G1 tricks, G4 rank and Almanac, G5 results.
2. G2 charms, V3 composition, V4 speed and Spirit Flow, G3 showdowns and rivals.
3. V5 light, V6 events, V2 forest, G7 daily loop, G10 first minute.
4. V8 screens and photo mode, G8 album, G9 Long Night and mirrors, V7 image stability.
5. G11 sharing, Trials.

## 6. What not to do

- Do not add a second currency, loot boxes, timers that gate play, or anything bought that wins races.
- Do not add a menu where a gate on the snow would do. The game's best choices are made by steering.
- Do not spend the round tuning what exists. If an item above ends as a parameter change, it was not done.
- Do not grow the HUD. New mechanics get one clear signal each and leave the picture alone otherwise.
- Do not trust a metric as fun. A test going green is permission to ask the owner to play, nothing more.
- Do not touch the music, and do not reopen the sim after milestone 2's batch.

## 7. The owner's play route (in the final report)

Fifteen minutes, on a preview the owner can open locally (`npm run dev`), with a short list of what to look for
and the questions that only a person can answer, one stop for each milestone's biggest items. Carry forward the questions round 7 left open
(`notes/r7-report.md`: the feel of a get-up, a duel won by a person, the hero frame, Low on a real phone). Write
the route into `notes/r8-report.md`; the owner plays it after the round.

## 8. Decisions for the owner (make the call yourself where one is still open, and record why)

1. **Decided: straight through.** No stops at milestones; the owner plays the route at the end.
2. **Low's 2 to 5 fps:** if no cause is found in milestone 0, switch Low's far shadows and poster off, or keep
   them?
3. **Seasons by calendar month** with no server: wanted, or one permanent Almanac?
4. **Ads:** may new rewarded placements be added (a streak save, a charm reroll), or none?
5. **AAC fallback packs** and the other open items in `notes/r7-report.md` are still open.
