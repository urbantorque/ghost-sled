# Ghost Sled, round 9: clear screens, a garage worth it, and three new mountains

You're working on Ghost Sled, a downhill sled racer for the browser and CrazyGames, in this repo (Vite, TypeScript,
three.js). Round 8, Trials and Save Clip are shipped on `main` and live at https://urbantorque.github.io/ghost-sled/.

The owner's three asks for this round, in order:

1. **The screens are not as clean and intuitive as they can be.** The title and the results carry a lot of
   distracting text, and they are a bit confusing.
2. **The garage is underwhelming.** It should be beautiful, intuitive and exciting to upgrade through as you play.
   The cosmetics need more variety, need to differ from each other more, and need to be worth investing in.
3. **Three new mountains, each fundamentally different** from the five and from each other. The five's courses stay
   exactly as they are.

This round is only those three things. Do not refine the status quo: you may replace a screen, a shelf or a
system's place in the game wherever a player would feel it. Do not delete a system to declutter. Move it, merge it
or put it behind one door, but keep every system reachable.

Before you change anything, read:

- the README (top to "Controls", then "Round 8: beauty and the hook");
- ART.md, all of it (colour roles in section 1 are locked; section 5 is the rider and the garage's colour rules;
  section 10 is the UI; section 15 is the mountains);
- DECISIONS.md 262 (the garage's shop), 367 to 387 (round 8 and its stretch), and 277 (round 7's mountain limits,
  and why the storm coast waited);
- `notes/r8-report.md` (open questions and what only a person has judged);
- `prompts/round-8-beauty-and-the-hook.md`, for how a round is run here;
- the review frames in `shots/r9/review/` (local and gitignored; `scripts/playtest/r9-review.js` makes them again).

Work on a branch `round-9`. Do not merge, push or deploy without the owner's word.

**The round has one stop:** the end of milestone 0. There the owner picks the three new mountains from your concepts
and approves the direction for the screens and the garage. After that, run straight through to the end, as round 8
did. Make the calls yourself and record your reasoning in DECISIONS.md as you go.

---

## 1. Where the game stands (a quick review, to be checked)

This review was made on 2026-11-23. It used the live build headless on desk (High) and phone (Medium): a fresh
save, three runs on Pinecrest to their results (the rider held on the line, so the times are not real), the
returning title and every garage shelf. Two read-only code reviews covered the garage and the mountains. It was
not a hands-on play session. **Treat every line as a hypothesis and check it in milestone 0.**

### The screens

What is already strong:
- A first visit's title: the logo, one line, one big Ride, and 18 words in all (`desk-01-title-fresh.png`).
- The results' hero: the place, the rider in a pose before a cheering crowd, and one primary button.
- The game's type and its vermillion primary.

What holds them back, biggest first:

1. **Every system the game has gained has a seat on the title.** The returning title (`desk-20-title-returning.png`)
   is ten panels and about 100 words, in three columns of cards in different styles, around a scene that is left a
   gap in the middle:
   - the logo, and the place with its tagline;
   - the mountain strip, the unlock hint and Ride;
   - a stats pill (flame, gifts, best);
   - the Almanac card with the album's count;
   - The Twelve's card;
   - the Cup's card and the Daily's card;
   - a menu bar (Garage, Missions, Medals, Settings).

   Hours, mirrors, Trials, contracts, the league and the Long Night add more as they open. The phone stacks all of it
   over the rider (`phone-20-title-returning.png`).
2. **The same thing is said twice on one screen:**
   - "Duel Old Wren" on the button and "Next of The Twelve: Old Wren" on a card beside it;
   - "1 more ghost opens Ember Peak" over the strip and "Pass 1 more ghost" on Ember's card;
   - the best time in the stats pill and again on the mountain's card.
3. **Figures without words.**
   - "Page 5 A new sled +1 · 496 to go" and "14 /212" on the title.
   - A bare "1" beside a flame.
   - "Rank 1 of 87", which reads as the race's place, not the ladder's.
   - "Page 2" and "Page 3" on the results' reward cards.
   - "+1" after an Almanac page.

   A player who has not read the README cannot say what these mean.
4. **Loading shown as content.** Both the Cup's and the Daily's cards read "Finding rivals…" three seconds after the
   title opens, on desk and phone.
5. **The results' right column is a form.** After a run (`desk-12-results-r2-9000.png`) it stacks the following,
   about 70 words and 14 figures in all:
   - Rider Rank with its XP and the run's gifts;
   - the bar to the next page, with what that page holds and how far it is;
   - three chips saying where the XP came from;
   - three reward cards of three different kinds (an unlock with its own Ride It button, an Almanac page, a sticker
     count);
   - the primary button;
   - four more controls (Home, an unlabelled camera, Save Clip, Details).

   Two calls to action compete: Ride It on the unlock card, and the primary.
6. **Copy that does not parse.** Run 1's primary reads "Finish the mission / Pass a ghost: done before, so again". The
   race line "81.4 s clear of tove_runs" floats over the crowd, apart from the place it explains.
7. **No one design language.** The UI is about 15,000 lines of CSS in 11 sheets (`style.css` alone is 9,658). The
   results' `render()` is a chain of conditional rows, each with a comment explaining an exception for the phone.
   Each round added its screen in its own idiom.
8. **To check:** in the review script, Escape did not close the garage, so every panel shot after it came out as the
   garage again. Find out whether Escape and the pad's B close every sheet and popover.

### The garage

What is already strong:
- Six sleds, each with its own silhouette, a real-mesh preview and a signature trick.
- Seven hats with distinct shapes.
- A clear Buy-then-Confirm.
- The rule that nothing bought wins a race.

What holds it back, biggest first:

1. **Nothing to aim for.**
   - There are no upgrades at all: sleds are bought, not grown.
   - The whole base garage costs 6,270 gifts (`notes/r8-spine-design.md`). The mid pilot earns 875 by run 5,
     4,495 by run 20 and 10,145 by run 50 (DECISIONS 371), so it buys the garage out by about run 25.
   - The dearest cosmetic, 240 gifts, is about 1.3 runs of income.
   - Only the 900-gift Tea Tray and the 40 lanterns are anything to save for.
2. **The items look alike.**
   - Hats are all vermillion and cream.
   - Scarves are one ribbon that changes only in length, width and stripe. Three of the patterns ignore the accent
     colour, and at full Spirit Flow the burn paints over the pattern (`rider.ts` 1033 to 1095).
   - Trails are pale spray with warm specks, one of three motions.
   - Paint is one flat hex.
   - Four chapter paints nearly repeat shop paints, and Keeper's Lantern (Almanac page 50) is nearly Comet Tail.
3. **You cannot see what you are buying.**
   - Only the Sleds tab has a 3D preview, and it never shows your paint.
   - Every other shelf is a flat drawing (`garageart.ts`), with hats drawn from behind.
   - Trails are a strip of dots, and paint goes on a generic plank, whatever your sled.
4. **Little of it reads in a run.** The rider is about a fifth of the frame and the head a third of that, seen from
   behind (ART.md). A hat is about a fifteenth of the frame; a trail is 0.2 m specks on white snow.
5. **Buying is a toast.** There is no reveal, no try-on and no moment, and the item is put on with a generic unlock
   sound. A sled's most exciting difference, its signature trick, is named nowhere in the garage.
6. **It is a dialog, not a place.** It is a sheet over a blurred title (`desk-40-garage-*.png`). The Lanterns tab
   leaves half the sheet empty.
7. **The Almanac and the shop overlap.** Almanac rewards look like shop stock. Page 5's sled gives nothing, silently,
   if you bought that sled (`rank.ts:207`). The results' "Ready in the shop" card has no way into the shop.

### The mountains

What is already strong:
- Five palettes and skies that differ.
- A score each.
- Set pieces with their own verbs.
- Lanternfall as a night finale.

What holds them back:

1. **One course, five skins.** All five are built from one set of parts (`src/sim/course.ts`):
   - 4.5 km in three stages of 1,450, 1,500 and 1,550 m, then a town square and a run-out;
   - the same start ramp and first leap at about 600 m, three leaps in all, the last over the town;
   - the same 18 section kinds, one set piece a stage, a sky gate a stage and two legends;
   - a slope of 0.28 to 0.31, and a mid rider home in 121 to 129 s.

   What differs in play is a handful of numbers (`BIOME_PARAMS`), cliff heights, the act scripts, and the verbs.
2. **The same frame.** Every course is one corridor between the sim's 9.5 m banks. Every opening is a centred
   trench, with the same panorama of ranges over a sea of cloud.
3. **The same ground and dangers.** Snow and ice everywhere, and static trees and rocks. A tree and a rock differ
   only in the crash's cause.
4. **The same arc.** Cool at the start, a warm lamplit town at the line, clear weather (storms only as a mood). Every
   setting is a high mountain above cloud: no coast, nothing at sea level, nothing underground beyond a short tunnel.
   Lanterns hang on all five, which thins Lanternfall.

In short, a player rides one course in five paintings. What they would tell a friend about a mountain is its
colours and its set pieces, not how it rides.

**The owner's call:** the five stay exactly as they are. The game gets new ways to ride from three new mountains,
and those must not repeat this grammar.

---

## 2. What good means here (the bars)

Write these as tests or lab scripts in milestone 0 and record today's figures. A green test is permission to ask a
critic and the owner, nothing more.

**The screens**

- **Five seconds.** A fresh critic is shown the returning title for five seconds, then it is taken away. They can
  say what the big button will do, what they are working toward, and where the garage is. On the results, after
  five seconds, they can say how the run went, what it earned, and what the button does next. Run each at runs 1,
  5, 20 and 50.
- **Words.**
  - The returning title shows at most 40 words at run 50 (about 100 today at run 3).
  - The results' first view shows at most 35 words (about 70 today).
  - A fresh title stays as clean as it is.
- **One thing to press.** Each screen has one primary action and nothing else styled like one. Every other control
  has a visible label (no lone icons).
- **Plain figures.** No figure is shown without a word a new player understands. "+1", "14 /212", "Page 5" and a bare
  flame count all fail.
- **Said once, and never loading.** No message is shown twice on one screen. No loading state is shown as content.
- **Nothing lost.** Every system is still reachable in two taps from the title, by keyboard, pad, touch and a screen
  reader.
- **As fast as today.** Run Again to riding stays under two seconds.

**The garage**

- **See it before you buy it.** Every item can be seen on your own rider and your own sled, in 3D, before you buy
  it: paint on your sled, a trail in motion, a hat from the front and from behind.
- **Different at race distance.** A fresh critic, shown every item on a shelf at the chase camera's size in a run,
  can tell every pair apart. A second critic, shown a chase-camera still of a run, can name what the rider wears.
- **Something to aim for, at both ends.**
  - In the economy table (runs 1, 5, 20, 50 and 100, novice and mid pilot), something worth having is always one to
    three runs away.
  - At runs 50 and 100 there are still garage goals that are not lanterns.
  - The dearest pieces take a dedicated player weeks, not a session.
- **A moment.** Every purchase and upgrade has one: it can be skipped, and reduced motion is respected.
- **Upgrades show.** An upgraded sled can be told from the stock one at race distance.
- **Still no edge.** Nothing bought changes how a sled handles: `tests/garage.test.ts` still finds no garage code in
  `src/sim` or `src/bot`.

**The three new mountains** (take the five's figures in milestone 0 as the baseline)

- **Not paintings.** A fresh critic is shown greyscale stills of all eight mountains, shuffled: each one's opening,
  three places on it and its finish. They pick out the three new ones as unlike the five and sort them into their
  three. For each, they name two differences that are not colour.
- **New rides.** In the lab, the mid pilot's figures are taken on all eight: the finish time, mean speed, airtime,
  turns per kilometre, mean width and hazards per kilometre.
  - Each new mountain is outside the five's range on at least two of them.
  - No two new mountains are within 10% of each other on more than half of them.
- **A mechanic each.** Each new mountain has one signature mechanic that makes a player ride differently, and it
  runs through most of the run, not one set piece. Its card says it in a few words, and the lab shows how much of
  the run it covers.
- **Fair.** Every fairness and budget test passes on all three. The clumsy pilot finishes each at least as often as
  it finishes the five's hardest.
- **Fast and small enough.**
  - High, Medium, Ultra and the phone hold 60 fps on all eight.
  - Low at 6x is no worse on a new mountain than the five's worst Low figure today.
  - The release stays within the package's cap (section 8) and 20 MB initial.
- **The five untouched.** Their seeds, pools and records replay byte for byte. The determinism, fairness, pool and
  migration suites prove it.

**The honest bar.** A critic and a pilot are not a person. The round ends with a 15-minute play route for the owner
(section 7). Do not call anything done that only scripts have touched: say what only scripts have seen.

---

## 3. Rules for this round

**Kept from before**

- **Colour and originality.** Colour roles are locked (ART.md 1); vermillion is the player. Everything is original:
  no existing game's names, characters, look, levels or music. Everything is procedural: no image, model or font
  files (README).
- **Clean and fast.**
  - `tsc` and every test green; the console clean on every tier and mountain.
  - High, Medium, Ultra and the phone hold 60 fps. The first frame does not get slower.
  - New screens and the garage load on demand, with nothing new before the first frame.
- **Nothing bought gives an edge in a race.** Gifts stay the one currency.
- **Records.** Record every call in DECISIONS.md (continue from 388), and update ART.md and the README.

**Changed for this round**

- **The sim opens once, additively, for the three new mountains** (milestone 3). Everything goes in as new entries
  under new ids: section kinds, surfaces, hazards and mechanics that only the new mountains use.
  - A shared constant may become per mountain only if the five keep their exact values.
  - The five's seeds, pools and records replay byte for byte.
  - The rules a rider plays by stay as they are: the input (steer and one button; the input byte has no spare bit),
    tricks, charms and scoring.
  - Only the three new pools are generated.
  - If something shared truly has to change, it is a `SIM_VERSION` 11 clean break, and that needs the owner's word
    first (section 8).
  - Milestones 1 and 2 do not touch the sim.
- **Music is out of scope, except the three new mountains' scores.** Make them the way the five's were
  (`src/audio/score.ts`, `scripts/music`), within the package's cap (section 8).

**The machine** (see the memory notes; these are hard-won)

- **Browsers.** Headless playwright configs only. At most two browsers at once across all lanes; the laptop
  blue-screens under load. Take the slot with `scripts/playtest/browser-slot.sh take <lane>` before opening one
  (each script needs its own lane name; `take` is re-entrant per name), and give it back as soon as you close it.
- **Heavy work.** A full vitest, a lab sweep, a build or ghost generation runs only in the heavy slot
  (`take-heavy` / `give-heavy`). Vitest runs only as `npx vitest run --maxWorkers=3`.
- **Three pools.** Generating three pools of 46 to 50 riders is hours of full-CPU work, the load that has
  blue-screened this laptop. Cap the node workers, run it in the heavy slot with nothing else open, keep the machine
  awake and on power, and generate one mountain at a time so a crash costs one pool.
- **First loads.** A fresh headless browser's first loads stall 9 to 13 s on any build. Load your origin once before
  you time or judge anything.
- **Stray processes.** Stopping a task kills only its wrapper: find stray `vite preview`, `perf.js` and `cliDaemon`
  processes by port or command line and stop them.
- **Files.** Source files are CRLF: use the Edit tool or CRLF-aware scripts, never `sed -i`.
- **Worktrees.** Make lane worktrees by hand from `round-9` (worktree isolation cuts from `origin/main`), with
  node_modules as a junction. Unlink the junction before removing a worktree.
- **Clean up.** Run `playwright-cli close-all` when the round ends.

**How to work**

- **Lanes.** Run lanes in parallel where files do not overlap, each with its own notes file `notes/r9-<lane>.md`.
  Lanes and critics run on Opus at high effort.
- **UI work.**
  - Use the design-taste-frontend skill.
  - Look at it under playwright, desk and phone, with the console read.
  - Check the changed files against web-design-guidelines before calling anything done.
- **Critics.** Every visual or screen lane is judged by a fresh critic that sees only ART.md, the frames and a
  question. Never hand a critic your conclusion.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## 4. The roadmap

Five milestones, in this order. Each item gives what a player should say about it, where the work is, and what done
looks like. **Must** items are the round. **Should** items follow if the musts are met.

### Milestone 0: ground truth and the plan (ends at the round's one stop)

**See every screen at every stage of a player's life.** Today there is no quick way to see the title at run 50.
- Build save fixtures from the lab: the mid and novice pilots' saves at runs 1, 5, 20, 50 and 100, written by the
  game layer as it really plays.
- Add a dev-only `?debug&save=<name>` that loads one.
- Shoot every screen, sheet and popover at each stage, desk and phone, with each one's visible words and controls
  counted.
  - The title: fresh, returning, a challenge link, the Cup and Trial picks, the Daily.
  - The results: a first finish, a crash, a duel won and lost, the Cup, a Trial, the Daily, the Long Night.
  - Everything else: the garage's shelves, the Almanac, the album, medals, missions, the flame's calendar,
    settings, pause and photo mode.
- Extend `scripts/playtest/r9-review.js` for this.

**Map the information.**
- List every system (rank and Almanac, album, flame, gifts, bests, The Twelve, the Cup and its league, Trials, the
  Daily and contracts, missions, medals, mastery, the Long Night, hours, mirrors, photo, clips, the garage).
- For each, list every place it shows and what a player does there. This map is what the redesign moves.

**Measure the five.**
- The lab's table for each mountain, on the section 2 measures.
- A profile chart of each course, side by side: height, width, the air, the turns and the hazards along the run.

This is the baseline the three new mountains must leave.

**Check section 1 line by line.** Write a blunt review into DECISIONS (what is right, what is wrong, what it
missed). Write the section 2 tests and scripts now, failing, and record today's figures.

**Design, and bring the owner three things:**
1. **The screens.** An information plan: what the title is for at runs 1, 5, 20 and 50; what leaves the main screen
   and where it goes; what results show first and what moves to Details. Show the title, results and garage, desk
   and phone, as working HTML in the game's own style (not static pictures). Then show a fresh critic today's
   screens against yours, blind, with the section 2 questions.
2. **The garage.**
   - The model: what an upgrade is, what a shelf holds, how sets work, and the price curve, with the economy table
     at runs 1, 5, 20, 50 and 100.
   - Every item listed, with what makes it distinct at race distance.
   - A first frame of the garage as a place.
3. **Three new mountains: at least six concepts, of which the owner picks three.**

   **The axes a mountain can differ on.** Today the five share nearly all of them.
   - **Length and pace:** the descent's length, and a mid rider's time.
   - **Profile:** steady, steepening, stepped (steep pitches and flat landings) or rolling.
   - **Width and frame:** an open field with many lines, a corridor, or a narrow channel whose walls are ridden;
     how high the banks are and how far apart.
   - **The opening:** today every course starts on the same ramp with the same leap at about 600 m.
   - **The air:** how many leaps and how big, and where else air comes from (a vent, a terrace's edge, a cornice).
   - **The ground and dangers:** what is underfoot, how it grips, and what ends a run and how.
   - **The finish:** today every course ends in a lamplit town square.
   - **Light, weather and the far plane:** today every far plane is ranges over a sea of cloud.

   **What "fundamentally different" means here.** Each new mountain:
   - differs from all five on at least five of the eight axes;
   - has one signature mechanic that changes how you ride, and runs through most of the run;
   - would still be its own place if it were drawn in the five's colours.

   A new skin over the five's grammar fails, however good it looks.

   **Each concept gets one page:**
   - **What is different.** The setting and the fiction, and where it sits on every axis.
   - **The course.** Length, stages and composition, its opening and its finish.
   - **Its signature mechanic.** What a rider does differently there, and how the bot will learn it.
   - **A picture.** A greybox or paintover frame of its opening and of one place.
   - **What it takes.** What it needs from the sim and proof that it is additive, its size (score pack included),
     its estimated cost on Low, and where it unlocks.

   **The set of three.** Propose your three:
   - each pair differs on at least four axes;
   - at least two are not a high mountain above cloud;
   - not all three unlock behind the finale.

   Then say how they sit with the five on the unlock path.

   **Directions to weigh, not to pick by default:**
   - *A storm coast:* sea cliffs, a lighthouse and a frozen harbour. DECISIONS 277 kept it for later, and why it lost
     to Lanternfall then matters.
   - *A rooftop run* down a snowed-in hill town: roofs, stairs and alleys instead of a trench, with gaps to clear.
   - *A gorge under the ice:* a frozen river with a ceiling and light from above.
   - *A banked ice run:* an old bobsleigh track cut down the mountain, where riding high on the walls is the line.
   - *A descent by your own light:* a dark forest or ravine where the only light is the rider's lantern and what it
     wakes. Every hazard must still show in time.
   - *An open face:* no corridor and no banks, a whole snowfield where you find your own line between landmarks.

   **The limits.** The course is a function of distance downhill: it only descends, and forks rejoin. A loop, a
   crossing or a true branch is out. A static gust or a feature that is always in the same place is fine; a weather
   front that moves the safe line is not (DECISIONS 277).

**Write the plan into DECISIONS and stop.** Confirm or reorder the items below and say what you cut and why. Then
hand the owner the three designs and the open decisions in section 8.

### Milestone 1: clear screens (no sim changes)

**U1. The title has one job at a time. (Must; the biggest clarity lift.)**
*"I knew what to press, and why."*
- The scene is the hero, and Ride is the one thing to press, with its reason on it (a duel, an unlock, the next
  page). The main screen holds only the logo, where you will ride, that button, and one quiet line of what you are
  working toward.
- Everything else is grouped behind clear, labelled doors:
  - the week's and day's events (the Cup, Trial, Daily and contracts) in one place;
  - your progress (rank, Almanac, album, medals and missions) in one place;
  - the garage.
- The mountain strip is a picker, not a dashboard.
- Say each thing once: The Twelve's next rider is the button's reason, not a second card.
- Nothing shows "Finding rivals…": wait for it, or show nothing.
- New systems appear when a player first has them, introduced once, in one line.
- Files: `src/ui/title.ts`, `screens.css`, `hours.css`, `trials.css`, `meta.css`, `style.css`, and the title's model
  in `src/game/app.ts`.
- Done: the section 2 screen bars at runs 1, 5, 20 and 50, desk and phone.

**U2. Results read in one glance. (Must.)**
*"I saw how I did, what I got and what's next, and I was already riding."*
- Three beats, in order:
  1. how you did (place, time and medal, in words);
  2. what you got (the one reward that matters most, opened, not listed);
  3. what's next (the one button).

  Everything else (XP by source, splits, the race, missions, stickers) moves to Details.
- No second primary: an unlock either becomes the button, when it is the best next thing, or is named and waits.
- A copy pass: every label is something a player says. No "Page 2", no "+1", and nothing like "done before, so again".
- Keep the directed sequence and the rank bar's tick, but cut what it shows. Every step can still be skipped.
- Files: `src/ui/results.ts`, `sequence.ts`, `story.css`, `books.css`, `meta.css`, `reel.css`.

**U3. One design system. (Must; what makes U1 and U2 hold.)**
- **Tokens:** one type scale, spacing, radii, one card, one button hierarchy (primary, secondary, quiet), one icon
  set with labels, and one motion language.
- **Apply them** to the title, results, the garage and every sheet and popover.
- **Delete** the dead CSS.
- The HUD is untouched unless an item names it.
- Done: a fresh critic sees one family across all the screens, and the style sheets are smaller.

**U4. Every other screen in the same language. (Should.)**
- The Almanac, album, medals, missions, the flame's calendar, settings, pause, photo mode, The Twelve, the league and
  the Trial's card.
- Their copy gets the same pass. Escape and the pad's B close every sheet.

### Milestone 2: a garage worth it (no sim changes)

**G1. The garage is a place. (Must.)**
*"I could spend ages in here."*
- **The scene.** An engine-rendered scene, loaded only when opened: your rider on your sled, on a stand in a
  workshop that fits the fiction.
- **The camera follows what you browse:**
  - a hat, close, from the front and from behind;
  - paint on your own sled;
  - a trail behind a sled riding a short loop of snow;
  - a sound as it plays.
- **Try before you buy.** Everything is tried on before you buy it.
- DECISIONS 262 rejected rendering each item with the portrait renderer (a render per item and a second camera).
  Read why, and either solve it or say why a live scene avoids it.
- **Low and the phone** get a designed cheaper version, never a broken High.
- **Reachable.** The results' "Ready in the shop" opens the shop.
- Files: `src/ui/menus.ts`, `garageart.ts`, `src/render/portrait.ts`, a new garage scene under `src/render`, and
  `src/game/garage.ts`.

**G2. Upgrades worth chasing. (Must.)**
*"Three more runs and my sled gets its lamps."*
- Each sled gets an upgrade track of visible tiers: runners, deck, trim, a lamp or ornament, and a spirit trim that
  lights at Spirit Flow. Tiers are earned by riding that sled, bought with gifts, or both: that is your design.
  They never change how it handles.
- The sled's signature trick is named on its card and shown in a short loop.
- Each tier reads at race distance, and the stock and upgraded sled are told apart in a chase-camera still.

**G3. Cosmetics that are different. (Must.)**
*"That hat is mine; nobody else's looks like it."*
- Colour roles hold (section 8 asks the owner), so variety comes from silhouette, material, pattern, motion and
  light, not from new hues.
- **Hats:** shapes and materials that read from behind at speed.
- **Scarves:** more than one ribbon (double, cape, tasselled, lantern-weighted), and a pattern that survives Spirit
  Flow.
- **Trails:** distinct shapes and behaviours, not specks: ribbons, prints, petals, sparks, paper.
- **Paint:** finishes and motifs, not a flat hex.
- **A new shelf** only if it earns its place and reads in a run (for example an ornament on the prow, or a pose at the
  line).
- **Near-duplicates** are retired or made distinct, the Almanac's included.

**G4. The buy moment. (Must.)**
- Gifts are the currency, so a purchase is a gift opened.
- The piece goes on in the scene, the rider shows it off, and it has a sound of its own. It can be skipped, and
  reduced motion is respected.
- An upgrade tier landing gets the same moment.

**G5. The economy. (Must.)**
- Reprice and deepen it against the section 2 bar, with no second currency.
- The Almanac's rewards become things the shop never sells, and no page is ever empty because you already own it.
- Write the economy table into DECISIONS.

**G6. Sets. (Should.)**
- A set for each mountain, the three new ones included, earned by mastering it.
- The monthly chapters' pieces should look like their month, not like shop stock.
- What the Lanterns shelf becomes, now that the garage is a place.

### Milestone 3: three new mountains (the one additive sim batch)

Build the three concepts the owner picked. The five are not touched.

**M1. The groundwork. (Must; before any mountain is built.)**
- **One sim design for all three, written and reviewed first:** the new section kinds, surfaces, hazards and
  mechanics, and the per-mountain lengths, openings and finishes. For each, say how it leaves the five byte for byte.
  - Today `STAGE_LENGTHS`, the start ramp and first leap, the leaps' sizes, `FINISH_SQUARE` and the banks are shared
    constants in `src/sim/course.ts`. One may become a per-mountain value only if the five keep theirs exactly.
  - New numbers in `BIOME_PARAMS` alone do not make a new mountain.
- **The bot** learns each new mechanic before any pool is generated, so its ghosts ride them well.
- **The game layer makes room for eight:**
  - the title's mountain strip;
  - the Trials rotation (a hard-coded `% 5`; change it from a set week, so past weeks keep their Trial);
  - the Long Night's legs;
  - the graveyard names, which are hashed over the list's length (adding names renames every other mountain's
    cairns, so make them stable first).
- Files: `src/sim/course.ts`, `mountains.ts`, `moments.ts`, `src/bot`, `src/game/trial.ts`, `modes.ts`.

**M2. Three mountains. (Must: the first, then the second and third.)**
*"This one is nothing like the others."*

Build each in its own lane, on the groundwork, in its own files where it can. The main lane merges the entries each
adds to the shared tables (`mountains.ts`, `moments.ts`).
- **The course:**
  - its seed, through the fairness and budget tests;
  - its shape, length and stages;
  - its signature mechanic, confined to it: sim, bot, moments, one HUD signal, render and sound;
  - its set pieces and legends.
- **The world:** its palette, sky, far plane, landmarks, dressing and its own finish, all procedural. It must not
  reuse the five's panorama of ranges over a sea of cloud, or a lamplit town square, unless the concept says why.
- **Its score**, made the way the five's were.
- **Its ghost pool** of 46 to 50 riders, and its home riders, one mountain at a time (the machine rules in
  section 3).

**M3. Wired everywhere, or a reason why not. (Must.)**
- **The race modes:**
  - each one's unlock place;
  - The Twelve (section 8);
  - the Cup and the Daily (joining `BIOMES` changes every future Daily and Cup course; section 8);
  - Trials and the Long Night, on the groundwork.
- **Progress and extras:**
  - Almanac pages, the album, mastery and missions;
  - each one's mirror and other hour;
  - photo mode and Save Clip;
  - the title's key art, with each new mountain's mechanic in a few words on its card.

**M4. Proven. (Must.)**
- **Tests:** determinism and fairness on all eight, and the five's pools and records byte for byte.
- **The lab:** the three against the five, on section 2's bars (finishes by pilot, the race's liveness, set pieces
  won, the share of each run on its mechanic).
- **The look:**
  - the greyscale sorting test;
  - the critic loop on each new mountain, five passes, as rounds 7 and 8 ran it.
- **Perf and size:** perf on every tier and all eight, and the release's sizes.

### Milestone 4: polish, proof and ship

- **A feel pass** over everything new: the garage's camera and sounds, the buy moment, the screens' motion, and the
  three new mountains' mechanics and signature moments.
- **The full proof run:**
  - the screen bars at runs 1, 5, 20, 50 and 100;
  - the critic loops on the screens, the garage and the three new mountains;
  - the perf run against round 8;
  - the smoke on every tier and all eight mountains;
  - the release's size checks.
- **The round's report** in `notes/r9-report.md`: what changed for a player, what was measured, what only scripts
  have seen, what still needs a person, and the open questions.
- Merge and publish only on the owner's word.

---

## 5. Order of value (if the round must be cut short)

1. U1 the title, U2 the results, U3 the design system.
2. G1 the garage as a place, G3 cosmetics that differ, G4 the buy moment.
3. G2 upgrades, G5 the economy.
4. M1 the groundwork, and the first new mountain, wired and proven.
5. The second and third new mountains. If the round runs short, they can follow later as additive batches on the
   same groundwork.
6. U4 the other screens, G6 sets.

## 6. What not to do

- **Money:** no second currency, no loot boxes, no timers that gate play, nothing bought that wins races, and no
  upgrade that touches handling.
- **Decluttering:** don't do it by deleting. Every system stays reachable; it just stops shouting.
- **Hiding:** don't hide what a player needs to choose (the time to beat, what the button will do).
- **No new menu** where a gate on the snow would do, and no growing the HUD.
- **Colour:** don't make cosmetics differ by recolouring. If the only difference is a hue, it is not a new item.
- **The mountains:**
  - Don't touch the five's courses.
  - Don't make a new mountain from numbers or a new skin over the five's grammar. If it rides like the five, it is not
    a new course.
  - Don't open the sim beyond the one additive batch.
  - Don't change the rules a rider plays by.
  - Don't let a hazard move the safe line.
- **Metrics:** don't trust a word count as clarity, or a critic as a player.

## 7. The owner's play route (in the final report)

Fifteen minutes, on a preview the owner can open locally (`npm run dev`), using the save fixtures, so the owner can
jump to run 1, run 20 and run 50:
- a first run's title and results;
- a run-50 title: can you find everything?;
- a purchase and an upgrade in the garage;
- one run on each new mountain, back to back, then one on Pinecrest: three new rides, unlike the five?

Write it into `notes/r9-report.md`, with a short list of what to look for and the questions only a person can
answer. Carry forward the still-open items from `notes/r8-report.md` that this round touches.

## 8. Decisions for the owner (defaults in bold; the round uses the default unless the owner says otherwise)

1. **One stop, after milestone 0**, to pick the three new mountains and approve the direction; then straight through.
2. **Colour roles stay locked:** cosmetics differ by shape, material, pattern, motion and light. Or: open a defined
   accent band for cosmetics, which ART.md would record.
3. **Upgrades never touch handling.**
4. **The three are additive under `SIM_VERSION` 10,** with the five's records proven untouched. Or: a clean break to
   11, if a concept needs something shared. The five's courses would still not change, but their bests, grudges and
   links would move to the archive (DECISIONS 149 and 203).
5. **Each new mountain keeps three stages.** Its length and everything inside its stages are free. Charms, set
   pieces, splits, the HUD's stage line and the Long Night all count on three. Or: a concept may change the count,
   with the ripple listed.
6. **The three stay out of the Daily and Cup mix,** since joining `BIOMES` would change every future Daily and Cup
   course. They join Trials and the Long Night.
7. **The Twelve stays twelve.** The new mountains get home riders, not duels.
8. **Where they unlock:** proposed with the concepts in milestone 0, and not all three behind the finale.
9. **The package's own size cap rises from 80 MB to 110 MB.**
   - Three scores at the five's 9.3 to 14.4 MB each take the build from 60.33 MB to about 88 to 104 MB.
   - CrazyGames allows 250 MB.
   - A course's music loads only when it is picked, so a player's first download stays within 20 MB.

   Or: keep 80 MB and make the three scores leaner.
10. **No ads** (round 8's decision stands).
