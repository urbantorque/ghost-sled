# Round 9, the screens lane: the information map, the information plan, and the title and results prototyped

Branch `r9-screens`, cut from `round-9` at aba7931. Milestone 0: nothing here reaches a player. The brief is
`notes/r9-briefs/screens.md`; the rules `notes/r9-lanes.md`. Frames and raw output under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/screens/`.

Design read (the design-taste-frontend skill, with ART.md 10 as the source of truth where they differ): a preserve-mode
redesign of a browser game's two busiest screens for a casual player, in Alpenglow Gouache's own UI language (ink
panels at 86% with a hairline, the system sans at 800 and 900, italic for speed words, full pills and 18 px cards,
vermillion only on the one primary action, mint for ghosts, marigold for gifts and the lantern). Dials: variance 5 (the
logo's column on the left is ART.md's, not mine to move), motion 5 (every beat motivated, transform and opacity only),
density 2 on the main screens and 5 behind the doors. Where the skill's landing-page defaults disagree with the game
(React and Tailwind, an icon library, no hand-drawn SVG), the game wins: native TypeScript and CSS, the game's own glyph
family (`ui/icons.ts`), and its own art (`ui/art.ts`).

## What is where

| What | Where |
| --- | --- |
| The owner's page: every prototype state, desk, wide and phone, with today's screen on the same model beside it | `prototypes/r9/screens.html` on the dev server (`npx vite --port 4930 --host 127.0.0.1`, then `/prototypes/r9/screens.html`) |
| The token sheet (the garage lane uses it too) | `prototypes/r9/tokens.css` |
| The title prototype | `prototypes/r9/title.html?stage=fresh|run1|run5|run20|run50[&open=events|progress|garage|settings]` |
| The results prototype | `prototypes/r9/results.html?case=first|podium|wreck|duel-won|duel-lost|cup|trial|daily[&open=details]` |
| Today's screens on the same models (the game's own `src/ui`, unchanged) | `prototypes/r9/today.html?screen=title&stage=...` and `?screen=results&case=...` |
| The models both read (the contract's own `TitleModel` and `ResultsModel`) | `prototypes/r9/fixtures.ts` |
| The backdrops (frames of the game with the overlay hidden) | `prototypes/r9/frames/` (JPEG, about 100 to 250 KB each), made by `scripts/playtest/r9-backdrops.js` |
| When each system reaches a player | `scripts/playtest/r9-firsts.ts` (heavy slot), output `shots/r9/screens/firsts.{txt,json}` |
| What today's style sheets define | `scripts/playtest/r9-css-audit.mjs`, output `shots/r9/screens/css-audit.json` |
| The prototype frames and counts | `scripts/playtest/r9-protoshots.js`, output `shots/r9/screens/frames/` |

Green: `npx tsc --noEmit -p .` and `-p prototypes/r9` (the prototypes' own config, which includes `src`), and the full
suite in the heavy slot (`npx vitest run --maxWorkers=3`: 104 files, 1,892 tests, 290 s). Nothing under `src` or
`tests` changed.

Nothing under `prototypes/` is in the release's build input (`vite.config.ts` builds `index.html` only), and the boot path
does not change. The prototypes import the game's own glyphs, art, formatting and pad cursor from `src/ui`, so they
look and move as the game does without copying it.

## 1. The information map

Every system, every place it shows today, and what a player does there. From the code (`src/ui/title.ts`, `results.ts`,
`sequence.ts`, `menus.ts`, `almanac.ts`, `notices.ts`, `contract.ts`, the title and results models in `src/game/app.ts`
and `spineview.ts`, the one button in `goals.ts`) and the review frames. "Reads" is looking, "picks" is choosing what the
next run is, "rides" starts a run, "buys" spends gifts.

| System | Title (main screen) | Title popovers and sheets | Results, first view | Results, Details | In the run (HUD) | Elsewhere |
| --- | --- | --- | --- | --- | --- | --- |
| Rider Rank and the Almanac | Corner card: "Rider Rank 4", a bar, "Page 5 A new sled +1 496 to go"; opens the Almanac (reads) | The Almanac sheet: 50 pages in rows of ten, the month's chapter, a Ride on pages that open a mode (reads, rides) | The rank row: "Rider Rank 2 +410 XP", the bar filling, "Page 3 The Spirit Album +1 78 to go", three tick chips ("Finished +110"); each page opened as a card ("Page 2") (reads) | Every tick, contracts met, the form contract, stickers, league, ember (reads) | None | The one button's line sometimes ("Page 8: 300 to go") |
| The Spirit Album | Corner: "14 /212" beside the rank card; opens the album (reads) | The album tab of the books sheet (reads) | A card: "12 stickers / The Hollow King on Pinecrest and more" | "Stickers: ..." line | None | |
| The flame | Corner pill: a flame and a bare "1"; opens the 7-day calendar popover (reads) | The calendar popover | "Day 1 of your flame" in the rank row | "An ember earned" line | None | The day's news line ("Day 6 of your flame: ride today to keep it lit") |
| Gifts | Corner pill: gift glyph and "670" (reads) | The garage's wallet | "+68" with a gift glyph in the rank row | The gifts row and wallet; mission rewards fly to it | None (the lantern instead) | Toasts on a purchase |
| Bests | Corner pill "Best 0:20.9", and again on the picked mountain's card (reads) | The medal wall's rows | The moment's fact ("New best, 2.0 s quicker") | The score row, "New best" stamp or "Best 2:04.8" | "Best in 120 m", the gold-white band on the snow | |
| The Twelve | Ride reads "DUEL Old Wren"; a card "Next of The Twelve: Old Wren, Pinecrest, 2:09.6 to beat" with bust and bio and "1 of 12" (picks a mountain, reads) | The ladder popover: all twelve, Go buttons (reads, picks) | The moment's fact with the bust ("Bram Oakhollow falls. 1 of 12 beaten."), the button "Next Duel: Old Wren" | The Twelve's race line, the rider's quote | The duel's pill on the rival | The album's duel stickers; Lanternfall's lock text |
| The Cup and its league | A card: "Weekly Cup, Week 48, Finding rivals..." then the week's mood (picks) | The medal wall's Cup row | None | Race line ("Cup: Bronze. Silver at ..."), "Cup league: 3rd in division 4" | | **The league table (nineteen records) is built (`LeagueView.rows`) and drawn nowhere**; the day's news says a promotion |
| Trials | The Cup's card reads "Cup and Trial"; under Ride a "Cup or Trial" pick; the Trial's rule and three medal targets over Ride (picks, reads) | The medal wall's Trial row; the Almanac's page 35 Ride | The moment leads with the Trial's figure and medal | The Trial's line | One rule line, the next medal's target on the stage line | Opens at page 35: **run 98 for the mid pilot, past run 100 for the novice** |
| The Daily and contracts | A card: "Daily Mountain, Nov 23, Finding rivals..." (picks) | | None | Race line ("Daily: Silver. Gold at ..."), "Contracts met: ..." | | **Today's three contracts and the form contract are drawn nowhere before a run**; the news line says "Three new contracts today" |
| Missions | "Missions 3" in the menu row, a popover of three (reads); the greeting over Ride ("Bank a 10,000 point combo: 8,200/10,000") | The missions popover | The one button "FINISH THE MISSION" with "Pass a ghost: done before, so again" (rides) | The three rows, Done stamps, the swap offer | A banner when one is met | The pause card's three rows |
| Medals | Dots on each mountain card; "Medals" in the menu row (reads) | The medal wall popover (rank, dots, Cup, Trial, a key sentence) | The moment's fact ("Gold run.") | The ladder strip with dots | The stage line | Daily and Cup cards' medal discs |
| Mastery | None | The medal wall's "★ 3/12" | None | "Mastery ★ 4 of 12, New: ... +10" | | |
| The Long Night | **None** | **Only the Almanac's page 10 has its Ride** | | | The beat between legs | Opens at run 9 (mid) and 12 (novice) |
| Hours | "Day / Dusk" swatch pill under Ride (picks) | The Almanac's page | | | | The veil names it |
| Mirrors | "Mirrored" toggle under Ride (picks) | The Almanac's page Ride | | | | |
| Photo | | | An unlabelled camera in the foot | | | Pause's "Photo" |
| Clips | | | "Save Clip" in the foot | | Recording chip | Toasts |
| The garage | "Garage, Pine Flyer" in the menu row (buys) | The garage sheet, seven tabs | The opened sled card | The next unlock ("120 gifts to Lodge Toboggan", "Ready in the shop", which has no way into the shop) | | The Almanac's garage pieces; the chapter's set; the Lantern Row |
| Mountains and unlocks | The strip: cards with best, ladder rank, medal dots, lock text ("Pass 1 more ghost"); the greeting "1 more ghost opens Ember Peak" (picks) | | An opened mountain card with its own Ride It (a second primary) | The next unlock card ("3 of 4 ghosts") | | A toast |
| A mountain's ladder | "Rank 1 of 87" on the card; Ride's line "Next: valo_rides, 2:06.3, 0.1 s up" | The medal wall | | The ladder strip, its race line | | |
| Grudges and rivals | The greeting ("tove_runs is waiting on Pinecrest") | | The button "Rematch tove_runs", the race line floating over the crowd | The race line | The rose ghost | |
| Challenge links | A banner over Ride, Ride reads "Accept" | | "Send It Back" as the primary | "Challenge a Friend" | The friend's pill | Toasts |
| The month's chapter | The news line ("New this month: Lantern Night ...") | The Almanac's chapter box | | Ticks | | The garage's shelf |
| The Lantern Row | | The garage's Lanterns tab | | | | The finish town and the title shot |
| Settings and sound | "Settings" in the menu row; a lone speaker icon on a first visit | The settings sheet | | | | The pause card |

### When each system first reaches a player

From `scripts/playtest/r9-firsts.ts` on round 9's base (the lab's mid and novice pilots, 100 runs each, every run
settled into a real save through the game layer; the harness rides the Daily from day 2 and the Cup from day 8, so
those two rows say when a pilot first rode them, not when they first showed; both show on the title from the first
return).

| System, and the page or run that opens it | Mid pilot | Novice |
| --- | --- | --- |
| The title's returning screen (the doors) | run 1 | run 1 |
| A mission met, a sticker, a medal, a mastery star | run 1 | runs 1 to 3 |
| Page 1, the second charm gate | run 1 | run 1 |
| Page 2, daily contracts | run 1 | run 2 |
| Frostfang Glacier opens | run 2 | run 1 |
| Page 3, the Spirit Album | run 2 | run 3 |
| Ember Peak opens | run 3 | run 4 |
| Page 5, the Whirl Saucer; the month's chapter | run 4 | runs 4 and 5 |
| Page 6, call your rival; the flame at two days | run 5 | runs 4 and 7 |
| Sakura Ridge opens | run 6 | run 9 |
| The first duel of The Twelve won | run 7 | run 12 |
| Page 8, Pinecrest at Dusk (the first hour) | run 7 | run 10 |
| Page 9, mirror Pinecrest | run 8 | run 12 |
| Page 10, the Long Night | run 9 | run 12 |
| The flame at seven days (the first ember) | run 25 | run 19 |
| The Cup first ridden (the league starts) | run 30 | run 23 |
| Page 21, Lanternfall to ride | run 33 | run 51 |
| Page 35, Trials | run 98 | not by run 100 |

So a player meets nearly every system in their first ten runs (eight new things for the mid pilot by run 9), the title
grows a seat for each, and two of the eight (the Long Night and the contracts) have no seat on it at all.

### What the map says, biggest first

1. **The most common button is the broken one.** Over 100 runs the one button was "Finish the mission" for 48 of the
   mid pilot's results and 69 of the novice's, and at runs 5, 20, 50 and 100 of both careers its line was "...: done
   before, so again" (a mission whose target a recent run already met, so it is in reach, but it was met before the
   mission was drawn). The review's line 6 is not an edge case: it is what the results say most of the time.
2. **Three systems have no seat before a run.** Today's contracts and the form contract, the Cup's league table, and
   the Long Night (reachable only from one page of the Almanac). Two are things a player chooses a run by.
3. **Everything else has two or three seats on the title.** The next duel (Ride and The Twelve's card), the next unlock
   (the greeting and the locked card), the best (the pill and the card), Rider Rank (the corner card and, on the
   results, the bar, the chips and a card per page).
4. **Trials, built in round 8, reach the mid pilot at run 98.** Fine as pacing, but it means the "Cup and Trial" card
   and the Trial's pick under Ride are a late-game layout most players never see; the plan below does not build round
   it.
5. **Escape is deliberately unbound** (`menus.ts`: "on CrazyGames it exits fullscreen"), so the review's "Escape did not
   close the garage" is a decision, not a bug. The pad's B goes back on every sheet (`padnav.ts`). See section 6.
6. **To check against the truth lane's run-1 capture: Ride may promise a duel that does not ride.** After one run,
   `app.ts twelveModel()` names Bram Oakhollow as next and here (it calls `nextDuel`, which has no run gate), so
   `title.ts` labels Ride "DUEL Bram Oakhollow"; but `duelHere()` holds the first duel back until the third run
   (`FIRST_DUEL_RUN`), so run 2 is an ordinary race. Read from the code, not yet seen on screen. The prototype needs one
   fact for it (`TitleTwelve.rides`), and says Ride.

## 2. The information plan

### The title has one job at a time

The main screen holds five things: the logo; the picker (where you ride, and how); Ride, with its reason on it; one
quiet line of what you are working toward; and four labelled doors. The scene keeps the rest of the frame (on a desk
the right 54%, the hero's place in ART.md 10; on a phone the middle band between the logo and the thumbs).

| Stage | The title's one job | What Ride says | The quiet line | What is new, and where it is introduced |
| --- | --- | --- | --- | --- |
| A first visit | Start the first run | RIDE, Pinecrest, Space | "Pass ghosts to unlock new mountains" (today's; the fresh title stays as it is) | Nothing: no doors yet, one labelled Sound toggle |
| After run 1 | Go again, a little better | RIDE, "valo_rides is 0.1 s ahead" (the rung above you on this mountain's ladder) | "1 more ghost opens Frostfang Glacier" | Daily contracts: "New" on Daily and Cup, one line inside it |
| After run 5 | The first duel | DUEL, "Bram Oakhollow. 2:23.6 to beat" | "3 more ghosts open Sakura Ridge" | The Whirl Saucer: "New" on the Garage, one line inside |
| After run 20 | Pick how to ride, then the next duel | DUEL, "Pip Thistle. 2:08.9 to beat"; the picker offers Day or Noon, and Mirrored | "Beat 6 more of The Twelve to open Lanternfall" | Nothing new this visit |
| After run 50 | The last duels, the week's league | DUEL, "Suki Ember. 2:07.0 to beat" | "2,180 XP to Rider Rank 26: the Crane's Memory charm" (every mountain open: the next page) | Up a division: "New" on Daily and Cup |

**Ride's reason** is the next run's purpose and nothing else, in this order: a friend's challenge; The Twelve's next
duel on the picked mountain; the Daily or the Cup when picked; the rung above you on this mountain's ladder; the
mountain itself. **The quiet line** is the longer goal and never Ride's reason, in this order: a locked card just
pressed (what opens it, for three seconds); the next mountain opened by ghosts; Lanternfall by The Twelve; the next
page of the Almanac, named as a prize. One line, a glyph and at most nine words.

### The doors

The brief proposed three doors (the week's and the day's events; your progress; the garage). I argue for them, with
Settings as a fourth labelled door rather than a gear, and with each door wearing the one figure that belongs to it:

| Door | Its figure (with its word) | What is behind it | Why there |
| --- | --- | --- | --- |
| **Daily and Cup** | "5-day flame" | The flame and its seven days; today's Daily (Choose); today's three contracts and how many are done; this week's Cup with its mood, your medal and best, and your place in its league (Choose); the week's Trial once open (Choose) | Everything that changes by the day or the week, so "come back tomorrow" has one place. The flame is kept by riding, and the Daily is the run that keeps it. |
| **Progress** | none (its room says "Rider Rank 16 of 50": a bare "Rank 16" on a door read as a place in a race) | Rider Rank's page and what the next one holds (Almanac); The Twelve as twelve busts, the next one named with their bio (All twelve); the Long Night (Choose) once open; the Spirit Album's count (Album); the medal count (Medals); the three missions with their progress | Everything that is a long count of what you have done. The Long Night and the ladder get a seat for the first time. |
| **Garage** | "420 gifts" | The garage (the garage lane's place) | Gifts are spent there, so the wallet lives on its door. |
| **Settings** | none | Today's settings sheet (U4 restyles it) | A word, not a lone gear. |

What I rejected: a fourth door for The Twelve (it is the button's reason four runs in five; its ladder is a count of
progress); putting the flame in the corner (a bare number over the sky, and the review's line 3); putting the Long
Night on the picker (it is not a mountain, and it opens at run 9 when the picker already has four).

A door opens a room from the side the screen is built on (the logo's side on a desk, the bottom on a phone), over the
left of the frame so the scene stays in view. It takes focus, keeps Tab inside, and Escape, Backspace, the pad's B and
its own Close all shut it and give focus back to its door. "Choose" in a room picks that run and closes the room; Ride
then says what it rides ("RIDE, Today's Daily. Keeps your flame lit"). So every system is two presses from the title
(the door, then the thing), by keyboard, pad, touch and a screen reader (each door and block is labelled).

### The picker

- The strip is a picker, not a dashboard: a chip per mountain with its sky and its short name ("Frostfang", as a player
  says it). The picked one is the larger card with your best on it. A locked chip is its sky dimmed under a lock and its
  name; what opens it is in its accessible name and tooltip, said in the quiet line when it is the nearest, and said in
  the quiet line for three seconds when the chip is pressed. No ladder rank, no medal dots on the chips (they are in
  Progress, behind Medals).
- How you ride the picked mountain sits under it, once open: "Day | Noon" with each hour's sky as a swatch, and
  "Mirrored". The day's Daily and the week's Cup are picked in their door, not on the strip.
- The mountain's name and feeling line under the logo (round 7's) go: the picked card names it, Ride rides it, and the
  veil still says its feeling while travelling. On a first visit the tagline stays.

### Said once, and never loading

| Today said twice | Said once, where |
| --- | --- |
| "Duel Old Wren" on Ride and "Next of The Twelve: Old Wren" beside it | Ride's reason. The Twelve's card goes behind Progress. |
| "1 more ghost opens Ember Peak" and "Pass 1 more ghost" on Ember's card | The quiet line. Ember's chip shows only its lock. |
| Best in the stats pill and on the mountain's card | The picked card. |
| Rider Rank's page on the corner card, its reward again on Ride's line | Progress's room; the quiet line names the next page only when nothing nearer is left ("2,180 XP to Rider Rank 26: the Crane's Memory charm"). |
| "Finding rivals..." on the Cup's and the Daily's cards | Nothing. A room's Choose appears when its field is in; until then the block says what it is and offers nothing. |

### The results: three beats, then Details

1. **How you did, in words:** the place ("2nd of 9", the figure in the moment's colour: gold-white for a win, the
   silver step for a podium), the word ("On the podium") with the time, and one fact that made it, in this order: one
   of The Twelve beaten or holding you off (their bust and name in their colour: "Bram Oakhollow beaten. 1 of 12
   down.", "Pip Thistle held you off"); a medal on the Daily or the Cup ("Bronze in this week's Cup"); a new best ("A
   new best, 1.6 s quicker"); else the nearest rider ("0.4 s behind tove_runs", the name in its ghost's colour). A
   Trial's word is its medal ("Silver in the Trial") and needs no fact. A wreck says where and how far ("Hit a tree,
   1,180 m from the line"). The race line that floated over the crowd is this line.
2. **The one reward that matters most, opened:** one card turning over: a mountain opened (its sky and its name, "New
   mountain / Frostfang Glacier"); else the prize of the page the run turned, the play-changing kinds first (a sled, a
   feature, a mirror, the Long Night's legs, an hour, a gate, a garage piece, a charm, a flourish, a title, gifts),
   named by the rank that gave it ("Rider Rank 5 / A new sled"), with one line only for a system met here for the
   first time ("Rider Rank 2 / Daily contracts / Three small goals a day"). At its foot Rider Rank's bar fills (the tick
   the brief keeps) with the gifts in words ("+68 gifts"). A run that opened nothing turns over the bar alone ("Rider
   Rank 16", the bar, "+24 gifts"): the next page is the title's quiet line, not the results'. Everything else that
   opened is in Details, which says so by its name.
3. **What's next, the one button**, its reason under its words, then Home, Photo and Details, each with its word. A
   rematch's gap is said on its button and nowhere else ("Rematch Pip Thistle / 1.2 s to find").

**No second primary.** The opened mountain's own Ride It goes. The unlock becomes the button when the spine's choice is
a plain Run Again ("Ride Frostfang Glacier"); otherwise the card names it and the button stays the spine's (a rematch,
a duel, a mission within reach), and the title's picker has it waiting.

**Details** (a sheet from the column's side, Back and Escape and B return): the race (the finishing order with you in
it, the rider's quote or the race line, the crash note); your run (each stage's clock against your best, the style
score, the best combo, perfect landings); what it paid (every tick of XP and the run's total, the gifts and the wallet,
everything opened, the stickers, the contracts met, the league, the three missions); keep this run (Watch your run, Save
a clip, Challenge a friend); and the same one button at its foot.

**Timing.** The beats land at 0, 0.26, 0.52 (the place, the word, the fact), 0.9 s (the card turns, 0.52 s), the bar
fills from 1.25 to 2 s, the button at 2.05 s, the foot at 2.2 s, all landed by 2.45 s. Today's button comes at about
3.7 s and its story lands at about 4.5 s. A tap or any key lands it at once; Space presses the button from 0.7 s as
today. Reduced motion shows the end with every beat on it.

### The copy pass

Every label I changed, before and after. The rule: a label is something a player says; a figure always has its word.

| Where | Today | Prototype |
| --- | --- | --- |
| Results button, mission (48% of mid results, 69% of novice) | FINISH THE MISSION / "Pass a ghost: done before, so again" | RUN AGAIN / "Mission: pass a ghost." (and its shortfall, "12 m short", when there is one) |
| Results button, Cup or Trial or Daily | RUN AGAIN / "Silver at 2:28.4" | RUN AGAIN / "Silver at 2:28.4, 2.6 s to find" |
| Results button, duel | NEXT DUEL: OLD WREN / "Time to beat 2:09.6" | NEXT DUEL: OLD WREN / "2:09.6 to beat" |
| Results, rank row | "Rider Rank 2 +410 XP", "Page 3 The Spirit Album +1 78 to go", "Finished +110", "7 behind you +56", "Medals +120" | "Rider Rank 3", the bar, "+68 gifts"; every tick in Details as "Finished 110 XP" |
| Results, reward cards | "Unlocked / Frostfang Glacier / Ride It", "Daily contracts / Page 2", "Charm: Ember Step / Page 2", "12 stickers / ... and more" | One card: "New mountain / Frostfang Glacier", or "Rider Rank 5 / A new sled", or "Rider Rank 2 / Daily contracts / Three small goals a day"; the rest in Details |
| Results, the race line | "81.4 s clear of tove_runs" floating over the crowd | Beat one's fact: "81.4 s ahead of tove_runs" (when nothing outranks it) |
| Results, foot | Home, an unlabelled camera, Save Clip, Details | Home, Photo, Details; Save a clip in Details beside Watch your run |
| Results, a duel's fact | "Bram Oakhollow falls. 1 of 12 beaten." | "Bram Oakhollow beaten. 1 of 12 down." |
| Results, a wreck | "3,340 m / WIPED OUT / Hit a tree" with "1,180 m short of the finish." a block away | "3,340 m / WIPED OUT / Hit a tree, 1,180 m from the line" |
| Results, a duel lost | "Pip Thistle held you off by 1.2 s." and the button "REMATCH PIP THISTLE / 1.2 s behind" | "Pip Thistle held you off" and "REMATCH PIP THISTLE / 1.2 s to find" (the gap once) |
| Results, a Trial | "17 perfects / SILVER IN THE TRIAL / 17 perfects, 2 short of gold" | "17 perfects / SILVER IN THE TRIAL" and the button "RUN AGAIN / Gold at 19 perfects" |
| Title, Ride | DUEL / "Old Wren" | DUEL / "Old Wren. 2:09.6 to beat" |
| Title, Ride on a plain mountain | RIDE / "Next: valo_rides, 2:06.3, 0.1 s up" | RIDE / "valo_rides is 0.1 s ahead" |
| Title, the corner | a flame and "1"; a gift and "670"; "Best 0:20.9"; "Rider Rank 4 / Page 5 A new sled +1 / 496 to go"; "14 /212" | Doors: "Daily and Cup / 1-day flame", "Progress", "Garage / 670 gifts"; in Progress "Rider Rank 4 of 50" and "Spirit Album / 14 of 212 stickers found." |
| Title, mountain cards | "Pinecrest / 0:20.9 best / Rank 1 of 87"; "Ember Peak / Pass 1 more ghost" | Chip "Pinecrest" with "0:20.9" on a trophy; "Ember" with a lock |
| Title, The Twelve | "NEXT OF THE TWELVE / Old Wren / Pinecrest, 2:09.6 to beat / Keeps every lantern lit... / 1 of 12" | Ride's reason; in Progress "The Twelve: 1 of 12 beaten / Old Wren rides next, on Pinecrest. Keeps every lantern lit." |
| Title, the Cup and the Daily | "Weekly Cup / Week 48 / Finding rivals...", "Daily Mountain / Nov 23 / Finding rivals..." | In Daily and Cup: "This week's Cup / Powder Day, with a Light Storm." and "Today's Daily / A new mountain and a new field every day" |
| Title, the menu | Garage Pine Flyer, Missions 3, Medals, Settings | Daily and Cup, Progress, Garage, Settings (missions and medals are in Progress) |
| Title, the league | (nowhere) | "Division 4 of 5: you are 6th of 20. The top 4 go up when the week turns." |
| Title, a first visit's mute | a lone speaker icon, "Mute" to a reader | "Sound on" / "Sound off" |
| Almanac rewards in a line | "A new sled +1" | "A new sled and a flourish for Spinning Top" (the prize named; "+1" never) |
| A charm as a prize | "Charm: Kite String" | "The Kite String charm" |

## 3. The design system (U3's tokens), as a proposal

`prototypes/r9/tokens.css`, about 290 lines: custom properties on `:root` and `.gs-ui` (so a prototype and the game's
overlay read the same names), then the few pieces every screen is built from under `.gs9-` (so nothing collides with
today's sheets while both exist). The garage lane's prototypes use it.

**What today's 11 sheets define** (`scripts/playtest/r9-css-audit.mjs`, round 9's base):

| Sheet | Lines | Rules | Classes | Custom properties set | Keyframes |
| --- | --- | --- | --- | --- | --- |
| style.css | 9,659 | 1,281 | 592 | 55 | 43 |
| screens.css | 1,398 | 174 | 108 | 3 | 22 |
| meta.css | 1,238 | 175 | 131 | 2 | 1 |
| books.css | 928 | 138 | 94 | 0 | 0 |
| story.css | 835 | 124 | 78 | 0 | 5 |
| photo.css | 381 | 56 | 41 | 0 | 1 |
| modes.css | 269 | 33 | 27 | 0 | 1 |
| reel.css | 197 | 24 | 15 | 0 | 2 |
| trials.css | 98 | 15 | 16 | 0 | 0 |
| hours.css | 79 | 10 | 5 | 0 | 0 |
| phone.css | 34 | 3 | 6 | 0 | 0 |
| **All** | **15,116** | **2,033** | **1,113** | **60** | **75** |

By what they dress (the first class each rule names): the results' card (Details) and the medals about 3,600 lines,
the title and its popovers about 3,550, the HUD, callouts and hints about 3,000, the sheets (garage, settings, pause)
about 1,700, the results' sequence about 800, toasts, the reveal and legends about 750, the books about 500, photo and
the reel about 450, the shared primitives about 340.

**Dead by name: almost none.** Only 3 classes (`gs-btn-gift`, `gs-gifts`, `gs-tile-lock`; 8 rules, 59 lines) are named
by no source. The weight is not dead code; it is a design system written many times over: **158 distinct font sizes,
7 weights (600 to 900, with 650, 750 and 850 between), 22 radius values, 355 colour literals, 267 shadows, 56
durations and 13 easings.** U3's saving comes from the tokens, one card and one button replacing per-screen
restatements, and from the rules the plan retires (the card's 3,600 lines become Details' one sheet; the title's
popovers become two rooms), not from a dead-code sweep. Only building it will measure it; my estimate is that the title
and results sheets halve and the whole drops by about a quarter.

**The proposal:**

| Token family | Today | Proposed |
| --- | --- | --- |
| Colour | 355 literals; the roles as 13 properties on `.gs-ui` | The roles of ART.md 1 (`--c-you`, `--c-gift`, `--c-ghost`, `--c-grudge`, `--c-best`, `--c-time`, `--c-ink`, `--c-text`), the three medal metals, five surfaces and hairlines, one dim text (72%: about 8:1 on the panel, 6:1 with snow under it) |
| Type | 158 sizes, 7 weights | One base unit that grows with the screen (`--u`, today's: 14 px on a phone, about 18 on a wide desk) and eight steps of it (`--fs-xs` with an 11 px floor, up to `--fs-display` and `--fs-logo`); three weights (700 text, 800 labels, 900 display); italic 900 for speed words, with room for descenders |
| Space | ad hoc | A 4 px step (`--sp-1` to `--sp-7`), the screen's gutter and safe-area insets, `--hit` 44 px |
| Shape | 22 radius values | `--r-card` 18 px and `--r-pill`, nothing else (ART.md 10) |
| Depth | 267 shadows | `--shadow`, `--shadow-primary`, the scene text's `--halo`, one `--focus` ring that holds on snow and on sky |
| Motion | 56 durations, 13 easings | Four durations (tap 140 ms, enter 240, beat 380, turn 520) and two easings (out, spring), all zero under reduced motion; one entrance from the side a thing is built on (`--from-x`, `--from-y`), one turn |
| Card | per screen | `.gs9-card`: the ink panel, the hairline, 18 px, 16 px padding |
| Buttons | primary, soft, quiet, gift, round, lg, and per-screen variants | Three ranks: `.gs9-b-primary` (vermillion, ink words, italic 900 caps: one a screen, always the run), `.gs9-b-secondary` (an ink pill with a strong hairline: a door, a choice, Details), `.gs9-b-quiet` (no fill: Home, Back, Close). Every button has its words; an icon only stands beside them |
| Icons | `ui/icons.ts`, sometimes alone | The same family, always with a label (`.gs9-i` inside a button or a tag) |
| Tag | several | `.gs9-tag`, and `.is-gift` for "New" (marigold: a good thing you take) |

## 4. The counts

How they are counted (`prototypes/r9/count.ts`, run in the page by `scripts/playtest/r9-protoshots.js`): the words a
player can see (each text node whose element is drawn, on screen, not hidden, not at no opacity, and not a screen
reader's one-pixel span; a word is any run with a letter or a figure in it, so "2:09.6", "+68" and the keycap "Space"
count and "/" does not) and the controls a player can press (buttons, links and inputs drawn the same way). This is
the truth lane's rule (`r9-truth.js` MEASURE, `r9-screenbars.ts words`), so its live figures and these compare. The
review's figures (about 100 on the returning title, about 70 to 104 on the results) came from `document.body.innerText`,
which also counts the screen reader's spoken lines; this counter does not, so today's figures below are lower than the
review's and the two columns are like for like. Today's screens are the game's own UI on the same models over the same
frames (`today.html`), shot once their story has landed (7 s); the prototype's once its story has (3.2 s).

(The table is filled below from the last capture.)

## 5. The critics

(Filled below.)

## web-design-guidelines

Run over `prototypes/r9/` (`tokens.css`, `screens.css`, `title.ts`, `results.ts`, `proto.ts`, `screens.html`,
`screens.ts`) against the Vercel Web Interface Guidelines, fetched fresh. Fixed: buttons in Title Case as the game's
are ("Watch Your Run", "Save Clip", "Challenge a Friend", "All Twelve", "Sound On", the rooms' block headings);
`color-scheme: dark` on the root, not the body; hover states on the picker's chips; non-breaking spaces in "0.1 s" and
"900 XP"; a room or Details opened is written into the URL (`?open=events`, `?open=details`) so a state can be shared
and reloaded; a room opens on its heading, not on its Close, so no ring stands on Close before a key is pressed.
Clean: every control has visible words (the icons are `aria-hidden` beside them); the dialogs are `role="dialog"` with
`aria-modal` and a label, trap Tab, close on Escape, Backspace, B and their own Close, and give focus back to the door;
the quiet line is a polite live region and the toast a status; transform and opacity only, no `transition: all`,
reduced motion zeroes the four durations and lands the results whole; `touch-action: manipulation` and an intentional
tap highlight on every control; sheets `overscroll-behavior: contain`; the screen keeps to the safe-area insets; numbers
through `Intl` (`ui/fmt.ts`) and tabular; names `translate="no"`; no list over about twenty rows. Open: the owner's page
(`screens.html`) has no skip link (it is a short list beside one frame).

## 6. What the main lane must decide

1. **The doors.** Three doors and Settings (Daily and Cup, Progress, Garage, Settings), the flame on Daily and Cup's
   door, Rider Rank on Progress's, the gifts on the Garage's. Or the brief's three with the figures in a corner pill.
   I recommend the doors as built: each figure gets its word and its home.
2. **The picker's names and the place line.** Short names on the chips ("Frostfang", "Ember") and no mountain name
   under the logo (round 7's place line goes; its feeling stays on the veil). This changes ART.md 10 ("The mountain's
   name and its feeling sit under the logo"). I recommend it: it is most of the difference between about 37 and about
   45 words at run 50.
3. **Escape.** Today it is deliberately unbound (CrazyGames uses it to leave fullscreen). The prototypes close on
   Escape, Backspace and B. In fullscreen the browser takes Escape before the page sees it, so a player there leaves
   fullscreen and the sheet stays open; everywhere else it closes the sheet. I recommend binding Escape and Backspace to
   close the top sheet or room (B already does), and checking it on CrazyGames.
4. **The mission button.** Today's "Finish the mission" is the run again under another name, and its "done before, so
   again" line is about half of all results. I recommend the button always be the run (Run Again, Rematch, Next Duel,
   Today's Daily, Ride a new mountain) with a mission only ever its reason, and that `goals.ts` stop offering a mission
   whose target was met before it was drawn (or count that run), which is a game-layer fix, not copy.
5. **Two new model fields.** `TitleSpine.intro: { door, line } | null`: what opened since the last title, introduced
   once; and `TitleTwelve.rides: boolean`: whether the next run on the picked mountain is the duel (section 1, item 6).
   Everything else the prototypes show is already in `TitleModel` and `ResultsModel` (they read the contract's own
   types).
6. **Trials' seat.** The plan puts the Trial in Daily and Cup beside the Cup (the week's second race), not under Ride.
   It reaches the mid pilot at run 98 and the novice not by run 100 (page 35); whether it should open earlier is the
   economy's question.
7. **Photo on the results' front, the clip in Details.** Photo is of this moment over this scene; the clip is the reel
   and lives with Watch your run. Or both on the front (one more control).

## Text to fold into ART.md 10, if the main lane takes the plan

- **The title has one job at a time.** The logo, the picker (the mountains as chips with their skies and short names,
  the picked one larger with your best; its hour and its mirror under it once open), Ride with its reason on it, one
  quiet line of what you are working toward, and four labelled doors: Daily and Cup (wearing the flame), Progress,
  Garage (wearing the gifts), Settings. A door opens a room from the logo's side (the bottom on a phone); its Choose
  picks the run and Ride says it. Something new is introduced once, by a marigold "New" on its door and one line in
  its room. Nothing loading is shown; a room's Choose waits for its field. (This replaces "the title's corner is one
  stack" and "the mountain's name and its feeling sit under the logo"; the feeling stays on the veil.)
- **The results are three beats over the scene**: how you did (the place, the word and the time, one fact in words);
  the one reward, turned over, with Rider Rank's bar and the gifts at its foot; the one button with its reason, then
  Home, Photo and Details. About 2.5 s, landed by a tap or a key. Everything else is Details, one level down.
- **One system** (`tokens.css`): two radii, three weights, eight sizes of one unit, three button ranks with words on
  every one, four durations and two easings; vermillion only on the one primary, which is always the run.

## 7. What milestone 1 would build (files, order, risk)

1. **Tokens first** (`src/ui/tokens.css`, from `prototypes/r9/tokens.css`), imported first by `ui.ts`; today's `.gs-ui`
   properties alias to them for one step so nothing breaks. Risk: low.
2. **U2, the results** (`src/ui/results.ts`, `sequence.ts`, `story.css`, `meta.css`): `Story` keeps its skeleton (beats,
   skip, reduced motion, sounds through `onResultsBeat`); its steps become the three beats; `storyCards` becomes a
   ranked pick of one reward with the rest counted; the card's head moves whole into a Details sheet; the copy rules
   move into `results.ts`; `goals.ts` loses "done before, so again" (decision 4). Tests: `tests/sequence.test.ts` (the
   timeline, now about 2.5 s), a new `tests/results-words.test.ts` (no "+1", no "Page N", no "done before"; every figure
   with a word). Risk: medium (the card's phone rules and where the offers sit; Revive and Double are dormant with no
   ads, which simplifies it).
3. **U1, the title** (`src/ui/title.ts`, `screens.css`, `hours.css`, `trials.css`, `style.css`'s title rules; the model
   in `app.ts`): the strip becomes the picker; the corner pill, the rank card, the news line, The Twelve's card and the
   Cup's and Daily's cards leave the main screen for two rooms (a new `src/ui/rooms.ts`, built on demand); the menu row
   becomes the doors; `app.ts` fills `intro`. The veil, the travel and the challenge banner stay. Risk: medium (the
   occluder rects the ghost tags read, `measure()`, change shape; the toast dock moves).
4. **Escape and B** (`ui.ts`): one key handler closes the top sheet or room (decision 3). Risk: low.
5. **U4, the other sheets** in the same card and buttons (the Almanac, the album, medals, the ladder, settings, pause,
   photo's bar). Risk: low each, many files.
6. **The bars as tests**: the truth lane's counters on the built screens at runs 1, 5, 20, 50 (the title at most 40
   words, the results at most 35, one primary, no lone icon, nothing said twice, nothing loading).

Delete as it goes: the title's popovers (`openMedals`, `openMissions`, `openTwelve`, `openFlame` move into rooms), the
corner (`bookCard`, `flameBtn`, the stats pill), `twelveCard`, `cupCard`, `dailyCard`, `greeting`; on the results,
`nextUnlockCard`, `masteryRow`, `giftsRow` and the head's sub rows (into Details' sections).
