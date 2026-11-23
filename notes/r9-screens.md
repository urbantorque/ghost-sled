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
   close the garage" is a decision, not a bug. The pad's B goes back on every sheet (`padnav.ts`). See section 8.

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
| After run 50 | The last duels, the week's league | DUEL, "Suki Ember. 2:07.0 to beat" | "The Memory charm at Rider Rank 26: 900 XP to go" (every mountain open: the next page) | Up a division: "New" on Daily and Cup |

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
| **Progress** | "Rider Rank 16" | Rider Rank's page and what the next one holds (Almanac); The Twelve as twelve busts, the next one named with their bio (All twelve); the Long Night (Choose) once open; the Spirit Album's count (Album); the medal count (Medals); the three missions with their progress | Everything that is a long count of what you have done. The Long Night and the ladder get a seat for the first time. |
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
| Rider Rank's page on the corner card, its reward again on Ride's line | Progress's door ("Rider Rank 16") and room; the quiet line names the next page only when nothing nearer is left. |
| "Finding rivals..." on the Cup's and the Daily's cards | Nothing. A room's Choose appears when its field is in; until then the block says what it is and offers nothing. |

### The results: three beats, then Details

1. **How you did, in words:** the place ("2nd of 9", the figure in the moment's colour: gold-white for a win, the
   silver step for a podium), the word ("On the podium") with the time, and one fact that made it, in this order: a
   Trial's medal; one of The Twelve beaten or holding you off (their bust and name in their colour); a medal on the
   Daily or the Cup ("Bronze in this week's Cup"); a new best ("A new best, 1.6 s quicker"); else the nearest rider
   ("0.4 s behind tove_runs", the name in its ghost's colour). The race line that floated over the crowd is this line.
2. **The one reward that matters most, opened:** one card turning over, in this order: a mountain opened (its sky); a
   page's reward, the play-changing kinds first (a sled, a feature, a mirror, the Long Night's legs, an hour, a gate,
   a garage piece, a charm, a flourish, a title, gifts), named as a player says it with one line of what it does ("Daily
   contracts / Three small goals a day, in Daily and Cup"); a medal for the whole run; the stickers. If more opened, "3
   more in Details". At the card's foot, Rider Rank's bar fills (the tick the brief keeps) with "Rider Rank 3" and the
   gifts in words ("+68 gifts"). A run that opened nothing turns over the next page instead ("Rider Rank 17 opens / A
   new scarf / 1,340 XP to go").
3. **What's next, the one button**, its reason under its words, then Home, Photo and Details, each with its word.

**No second primary.** The opened mountain's own Ride It goes. The unlock becomes the button when the spine's choice is
a plain Run Again ("Ride Frostfang Glacier"); otherwise the card says "Ready to ride from the title" and the button
stays the spine's (a rematch, a duel, a mission within reach).

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
| Results, rank row | "Rider Rank 2 +410 XP", "Page 3 The Spirit Album +1 78 to go", "Finished +110", "7 behind you +56", "Medals +120" | "Rider Rank 3" and the bar, "+68 gifts"; every tick in Details as "Finished, 110 XP" |
| Results, reward cards | "Unlocked / Frostfang Glacier / Ride It", "Daily contracts / Page 2", "Charm: Ember Step / Page 2", "12 stickers / ... and more" | One card: "A new mountain / Frostfang Glacier / Ready to ride from the title. 2 more in Details" |
| Results, the race line | "81.4 s clear of tove_runs" floating over the crowd | Beat one's fact: "81.4 s ahead of tove_runs" (when nothing outranks it) |
| Results, foot | Home, an unlabelled camera, Save Clip, Details | Home, Photo, Details; Save a clip in Details beside Watch your run |
| Results, a duel's fact | "Bram Oakhollow falls. 1 of 12 beaten." | "Bram Oakhollow beaten. 1 of 12 down." |
| Results, a wreck | "2,340 m / WIPED OUT / Hit an ice spire" with the short-of note apart | "3,340 m / WIPED OUT / Hit an ice spire, 1,180 m short of the line" |
| Title, Ride | DUEL / "Old Wren" | DUEL / "Old Wren. 2:09.6 to beat" |
| Title, Ride on a plain mountain | RIDE / "Next: valo_rides, 2:06.3, 0.1 s up" | RIDE / "valo_rides is 0.1 s ahead" |
| Title, the corner | a flame and "1"; a gift and "670"; "Best 0:20.9"; "Rider Rank 4 / Page 5 A new sled +1 / 496 to go"; "14 /212" | Doors: "Daily and Cup / 1-day flame", "Progress / Rider Rank 4", "Garage / 670 gifts"; in Progress "Spirit Album: 14 of 212 stickers found" |
| Title, mountain cards | "Pinecrest / 0:20.9 best / Rank 1 of 87"; "Ember Peak / Pass 1 more ghost" | Chip "Pinecrest" with "0:20.9" on a trophy; "Ember" with a lock |
| Title, The Twelve | "NEXT OF THE TWELVE / Old Wren / Pinecrest, 2:09.6 to beat / Keeps every lantern lit... / 1 of 12" | Ride's reason; in Progress "The Twelve: 1 of 12 beaten / Old Wren rides next, on Pinecrest. Keeps every lantern lit." |
| Title, the Cup and the Daily | "Weekly Cup / Week 48 / Finding rivals...", "Daily Mountain / Nov 23 / Finding rivals..." | In Daily and Cup: "This week's Cup / Powder Day, with a Light Storm." and "Today's Daily / A new mountain and a new field every day" |
| Title, the menu | Garage Pine Flyer, Missions 3, Medals, Settings | Daily and Cup, Progress, Garage, Settings (missions and medals are in Progress) |
| Title, the league | (nowhere) | "Division 4 of 5: you are 6th of 20. The top 4 go up when the week turns." |
| Title, a first visit's mute | a lone speaker icon, "Mute" to a reader | "Sound on" / "Sound off" |
| Almanac rewards in a line | "A new sled +1" | "A new sled and a flourish for Spinning Top" (the prize named; "+1" never) |
| A charm as a prize | "Charm: Kite String" | "The Kite String charm" |
