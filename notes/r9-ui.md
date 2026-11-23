# Round 9, the ui lane: the title and the results, built

Branch `r9-ui`, cut from `round-9` at 6255b8d. Milestone 1's U1 to U3 (`notes/r9-briefs/ui.md`): the results in three
beats, the title with one job at a time and its two rooms, Escape, the third critic's faults, and the round's tokens on
what was touched. Frames and raw output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/ui/`. Kept current
while the lane works.

## Status

- Done: the results (U2), the title and its two rooms (U1), Escape and Backspace (and B on the new sheets), the two
  copy bars turned into plain tests, the dead-rule sweep of the style sheets.
- In progress: the measured bars on the fixtures, the critics, web-design-guidelines, the full suite.

## What changed for a player

### The results (U2)

Three beats over the scene, about 2.5 s (`src/ui/sequence.ts`, `STORY_TIMING`: the figure at 0, its word and time at
260 ms, the fact at 520, the card turns at 900, Rider Rank's bar fills 1,250 to 2,010, the button at 2,050, the foot at
2,200, all landed by 2,600). A tap anywhere or any key lands it whole; reduced motion shows the end; the story's sounds
ride its beats (`onResultsBeat`: the bar's ticks as each stretch starts, the page's stamp at the top of a page, the card's
mallet as it turns; the place's stamp from `RESULTS_TIMING` as the place's word lands; each finished mission's chime and
coin as the bar starts to fill).

1. **How you did** (top of the logo's side; on a phone the top, over the sky): the place ("2nd" of "of 9"), the word
   ("On the podium") and the time, then one fact in words on an ink chip that keeps inside the headline's rule. The
   fact, first that applies: one of The Twelve beaten ("Bram Oakhollow beaten. 1 of 12 down.", their bust and name in
   their colour) or holding you off ("Pip Thistle held you off by 1.2 s"); a new best ("A new best, 1.6 s quicker",
   "Your first finish here"); else the nearest rider ("0.4 s behind tove_runs", the name in its ghost's colour). A wreck
   leads with how far it got and says how it ended and where in one line ("Found a rock, 2,632 m from the line"). A
   Trial leads with its own figure lit by its medal. **A Daily or a Cup with a medal leads with the time the medal was
   won on and the medal in words ("2:26.0 / Silver on today's Daily"), and the place in the race is its fact ("3rd of 7
   in the race")**, so a place and a medal can never read as disagreeing (the third critic's fault).
2. **The one reward that matters most, turned over**, with Rider Rank's bar filling at its foot and the gifts in words
   ("+52 gifts"): a mountain opened (its sky, "New mountain / Frostfang Glacier"); else the page prize that changes play
   most, named as a prize by the rank the bar reached ("Reached Rider Rank 5 / A new sled"), with one line for a system
   met for the first time ("Daily contracts / Three small goals a day"); a chapter's page says "This month's chapter";
   a sled this run's gifts made affordable ("Ready in the garage / Lodge Toboggan"). A run that opened nothing turns over
   the bar alone, labelled "Rider Rank 16".
3. **The one button**, its reason under its words, then Home, Photo and Details (each with its word). The button is
   always the run: Run Again, Rematch, Next Duel, Today's Daily, Ride the Trial, Ride the Long Night, or **Ride
   Frostfang Glacier** when the run opened a mountain and the spine's choice was a plain Run Again (app.ts sends Run
   Again there, by the button or Space). A mission is only ever its reason ("Mission: ride 800 m in one run. 12 m
   short"); a rematch's reason is the rival's own time ("2:46.1 to beat"); a duel's is where it rides ("On Frostfang
   Glacier, head to head"); a Daily's or Cup's is the next medal and how far off it was ("Silver at 2:27.6, 2.6 s to
   find"); a page is "300 XP to Rider Rank 8".

**Details** (one level down, a sheet from the column's side; Back, Escape, Backspace and B return, focus back on
Details): The Race (the finishing order with you in it, the rider's quote, the race line, the crash note, what decided
it against your rival); Your Run (each stage line's clock against your best, the medal for your time, the style score,
the best combo, perfect landings, the stomp streak, the longest air, the mountain's ladder with what this run climbed,
the medals held, mastery); What It Paid (every tick of XP as "110 XP", then **"Rider Rank N: 436 XP this run", the sum
of the rows above it**; the gifts and the wallet; everything opened, by name; the stickers; the contracts met; the
league; the flame's day and an ember; the next unlock, and **"The Lodge Toboggan is ready in the garage" with an Open
the Garage button**, which takes the title's own way into the garage); Missions (each with "270 of 800" or "Done this
run, 25 gifts", Swap Mission when offered); Keep This Run (Watch Your Run, **Save Clip**, Challenge a Friend or Send It
Back, Ride Home as a Spirit); and the same one button at its foot.

### The title (U1)

The main screen holds five things (`src/ui/title.ts`): the logo; the picker; Ride with its reason; one quiet line; four
labelled doors. On a desk they keep the logo's column (the logo at the top, the rest at its foot), so the scene keeps
the right of the frame; on a phone the logo at the top, the rest in the thumbs' band, the rider between.

- **The picker:** a chip a mountain, its sky and its short name (Pinecrest, Frostfang, Ember, Sakura, Lanternfall); the
  picked one larger with "Best 1:52.2" on it (on a phone under Ride: its chip is small). A locked chip is its sky dimmed
  under a lock; pressing it shakes it and the quiet line says what opens it for three seconds ("Sakura Ridge: pass 3
  more ghosts to open it"). No ladder rank and no medal dots on the chips (they are in Progress, behind Medals). On a
  phone the five chips fit a 390 px screen with every name whole, Lanternfall included (the third critic's cut
  "Lantern..."); a narrower screen scrolls them.
- **Ride's reason:** a friend's challenge (Accept); the duel, said as the duel ("DUEL / Suki Ember, head to head"), only
  when the next run is one (`TitleTwelve.rides`: never at run 1, where today said "Duel Bram Oakhollow"); the Daily, the
  Cup or the Trial chosen ("RIDE / Today's Daily. Keeps your flame lit"); your grudge waiting there; the rung above you
  ("valo_rides is 0.1 s ahead"); else how it rides ("At Dusk, mirrored") or what it is like ("Pine forest, soft powder,
  snowmen"), never the name the chip already says. Under Ride, once open: the day or the other hour (each with a swatch
  of its sky) and Mirrored.
- **The quiet line:** one goal in words: "1 more ghost opens Frostfang Glacier", "Beat 6 more of The Twelve to open
  Lanternfall", "1,281 XP to Rider Rank 26: the Crane's Memory charm".
- **The doors:** Daily and Cup ("13-day flame" in marigold), Progress, Garage ("90 gifts"), Settings. Each names to a
  screen reader what is behind it. Garage opens the garage; Settings the settings sheet; the other two open rooms
  (`src/ui/rooms.ts`, a dynamic import: its own 11 KB chunk and 2 KB of CSS, not in the first download).
- **Daily and Cup's room:** the flame and its seven days (lit, today, the ember); today's Daily (Choose, once its field
  is in; its medal and best when held); today's contracts and the form contract, each with its XP and a check (**drawn for
  the first time**); this week's Cup (its mood and event, Choose, your medal) and your place in its league in words
  ("Division 5 of 5: you are 1st of 20. The top 4 go up when the week turns."), with **the league's table one press
  away (drawn for the first time)**; the week's Trial once open (its rule, its targets, Choose). Choose closes the room
  and puts focus on Ride, which now says it.
- **Progress's room:** Rider Rank and the next page's prizes in words, its bar, the month's chapter (the Almanac one
  press away); The Twelve: how many beaten, who rides next and their line, their twelve busts (all twelve, gentlest
  first, with each one's home, time and state, one press away; Go travels to the next one's ground); the Long Night once
  open (Ride It); the Spirit Album (Album); the medals (each mountain's ladder place, medals and mastery stars, the Cup's
  and the Trial's, one press away); the missions with their progress in words.
- **Something new** since the title was last up (`TitleSpine.intro`): a marigold "New" on its door and one line at the
  top of its room ("New: daily contracts. Three small goals a day, each worth XP."), until the door is opened.
- **Nothing loading is shown:** "Finding rivals..." is gone; a block whose field is not in yet offers no Choose until it
  is. A friend's link still waiting keeps Ride's words and waits.
- **A first visit** stays as it was, but for "Sound On" in words where the lone speaker was.

## The copy pass

| Where | Before | Now |
| --- | --- | --- |
| Results' button, a mission (about half of all results) | FINISH THE MISSION / "Pass a ghost: done before, so again" | RUN AGAIN / "Mission: pass a ghost. 1 more to go"; a mission met before it was drawn is never offered (`goals.ts`) |
| Results' button, a duel | NEXT DUEL: OLD WREN / "Time to beat 2:09.6" | NEXT DUEL: OLD WREN / "On Pinecrest, head to head" |
| Results' button, a page | RUN AGAIN / "Page 8: A new sled: 300 to go" | RUN AGAIN / "300 XP to Rider Rank 8" |
| Results' button, a rung | "Rank 7: SparkleCedar: 1.2 s" | "SparkleCedar is 1.2 s ahead" |
| Results' button, a stage gold | "Gold in Stage 2: 0.4 s" | "Gold in stage 2: 0.4 s to find" |
| Results' button, the Daily | "Keep the flame lit" | "Keeps your flame lit" |
| An Almanac page's prizes (`fmt.ts rewardsLine`, 19 of 50 pages) | "A new sled +1" | "A new sled and a flourish for Spinning Top" |
| Results, a page's card | "Charm: Kite String / Page 2" | "Reached Rider Rank 2 / The Kite String charm" |
| Results, the XP | "+410 XP", "Finished +110" | first view none; Details "Finished 110 XP" ... "Rider Rank 3: 436 XP this run" |
| Results, a wreck | "3,340 m / WIPED OUT / Hit a tree" and "1,180 m short of the finish." a block away | "3,340 m / WIPED OUT / Hugged a tree, 1,180 m from the line" |
| Results, a duel won | "Bram Oakhollow falls. 1 of 12 beaten." | "Bram Oakhollow beaten. 1 of 12 down." |
| Results, the foot | Home, an unlabelled camera, Save Clip, Details | Home, Photo, Details (Save Clip in Details) |
| Title, the first visit's mute | a lone speaker icon | "Sound On" / "Sound Off" |

## Escape, Backspace and the pad's B

`src/ui/menus.ts:14` held the deliberate unbinding ("on CrazyGames it exits fullscreen"). Now `ui.ts back()` is the one
place: Escape and Backspace close the top sheet (the garage, settings, the books: `Menus.closeTop`, as their own Close
does), else the top round-9 sheet (a room, a view pushed in it, the results' Details: `kit9.ts closeTopSheet`), and
focus goes back to the control that opened it (by its focus key, when the screen under it was drawn again meanwhile).
On the window's bubbling phase, so photo mode keeps its own Escape (it takes every key at capture); a text field keeps
Backspace. The pause card is not a sheet: P and Start. In fullscreen the browser takes Escape first (on CrazyGames it
leaves fullscreen), so a player there presses it twice; Backspace and B always work. The pad's B on a room or Details
goes back through the same `back()`. The title's four popovers are gone: their contents live in the rooms, which take
focus, keep Tab inside and close on all three.

## Text for ART.md 10 (the main lane edits ART.md; decision 392)

Replace round 7's "The mountain's name and its feeling sit under the logo" (in "The title is the picked mountain's
key art"), round 7's "The results lead with the moment ... "Finish the mission" ...", round 8's "The results are a story
told in about five seconds ..." and "The title's corner is one stack ..." with:

- **The title has one job at a time (round 9).** The logo; the mountains as a picker of chips, each its sky and its
  short name ("Frostfang", "Ember"), the picked one larger with your best on it in words ("Best 1:52.2"; on a phone the
  best stands under Ride, the chips being small, and the strip scrolls so every name is whole); Ride with its reason on
  it; under Ride, once open, the picked mountain's hour (each half with a swatch of its sky) and its mirror; one quiet
  line of what you are working toward (a glyph and at most nine words: the next mountain by ghosts, Lanternfall by The
  Twelve, else the next Rider Rank named as a prize); and four labelled doors: Daily and Cup (wearing the flame, "13-day
  flame", marigold), Progress, Garage (wearing the gifts, "90 gifts") and Settings. No mountain name or feeling line
  under the logo: the picked chip names the place and the veil says its feeling while travelling. A first visit keeps
  the logo, its tagline, Ride, the line "Pass ghosts to unlock new mountains" and a labelled Sound On.
- **Ride's reason is the next run's purpose**, first that applies: a friend's challenge (Accept); the duel with the next
  of The Twelve on the picked ground, said as the duel ("Suki Ember, head to head"), never with the rider's time, which
  set beside a faster best read as already beaten, and only when the next run is the duel; the Daily, the Cup or the
  Trial when chosen; your grudge waiting there; the rung above you on the mountain's ladder ("valo_rides is 0.1 s
  ahead"); else how it rides (its hour, mirrored) or what it is like (its tagline), never the name the chip already says.
- **A door opens a room** from the logo's side (the bottom on a phone): an ink sheet of blocks, each its words and its
  one action. Daily and Cup holds the flame and its seven days, today's Daily, the day's contracts and the form, this
  week's Cup with its league place and table, and the week's Trial once open; Progress holds Rider Rank and the next
  page's prizes (the Almanac), The Twelve (their busts; all twelve a press away), the Long Night once open, the Spirit
  Album, the medals (each mountain's ladder place and mastery stars) and the missions. Choose picks that run and closes
  the room; Ride then says what it rides. Something new is introduced once, by a marigold "New" on its door and one line
  at the top of its room. Nothing loading is shown: a block whose field is not in offers nothing until it is.
- **The results are three beats over the scene (round 9)**, about 2.5 s: how you did (the place, its word and the time
  in italic 900 at the top of the logo's side, gold-white for a win, the silver step for a podium; then one fact on an
  ink chip that keeps inside the headline's rule, clear of the rider); the one reward that matters most, turned over,
  with Rider Rank's bar filling at its foot and the gifts in words; and the one button, vermillion, always the run,
  its reason under its words, then Home, Photo and Details, each with its word. A Daily's or a Cup's medal leads with
  the time it was won on and the medal in words, the race's place its fact, so the two never read as disagreeing. A tap
  or a key lands it; reduced motion shows the end. Everything else is Details, one level down, a sheet from the
  column's side: the race, your run, what it paid point by point (the XP it lists adds up to the total it says), the
  missions, and keeping the run (Watch Your Run, Save Clip, Challenge a Friend).
- **One system (round 9, `tokens.css`, `kit9.css`):** eight type sizes on one unit, three weights, two radii (full pills
  and 18 px cards), three button ranks with words on every one (primary vermillion, one a screen and always the run;
  secondary an ink pill with a hairline; quiet a thin ink wash), one ink sheet for a room or Details, four durations and
  two easings, all zero under reduced motion.
- In the photo item ("From pause (Photo, beside Home) or the results (a camera beside Home)"): "or the results (Photo,
  beside Home)". In the clip item ("Save Clip (a soft pill with its words, beside the camera in the results' foot)"):
  "Save Clip (in the results' Details, beside Watch Your Run)".

## Every hunk in a shared file (against round-9 at 6255b8d)

All additive or inside the results' and the title's own functions; nothing reformatted or reordered.

- **`src/game/app.ts`** (11 hunks):
  - the import of `TitleIntro` from the contract (one name added to the existing type import);
  - `beatStampsShown()` deleted (the results card's Beat stamps it counted for the mallet are gone);
  - two fields after `results`: `intros` and `introsSeen` (what is new since the title was up, said once);
  - the UI handler `onIntroSeen` (after `onOpenAlbum`);
  - `twelveModel()`: `rides` (whether the next run on the next rider's ground is the duel, `duelOn`), and its return
    field;
  - two methods after `twelveModel()`: `titleIntro(news)` and `keepIntros(opened)`;
  - `refreshTitle()`: the week's Trial news says "Choose it in Daily and Cup" (was "Pick it on the Cup"), an `intro`
    closure, and the spine getter sets `spine.intro`;
  - `showResults()`: `this.keepIntros(spineOut.view.opened)` after the shots settle; and before `hideHud`, a mountain
    the run opened becomes `againTo` when the spine's choice is a plain Run Again (so Run Again rides it);
  - `resultsSounds()`: its comment, and `show` = no count-up, the new best's chord on `finish.newBest`, no Beat stamps.
- **`src/ui/ui.ts`** (8 hunks): `kit9` imported; `hd` typed with `UIMenuHandlers`; a window keydown for Escape and
  Backspace (`back()`); the click-blur keeps focus inside a round-9 sheet; the title's `openSleds` and the results'
  `openGarage` through one `openGarage()`; `back()`; `Results` constructed with its hook; `title.onLayout = dirty`;
  `modal` includes `sheetOpen()`; `padMenu`: a round-9 sheet is the scope and modal, and B goes `back()`.
- **`src/ui/contract.ts`** (3 hunks, all additions): `TitleTwelve.rides?`; `UIHandlers.onIntroSeen?`;
  `TitleSpine.intro?`, `TitleDoor`, `TitleIntro`.
- **`src/ui/menus.ts`** (the shop lane rebuilds the garage behind it; 2 hunks): the header comment at line 14 (Escape is
  now bound, and why), and `closeTop()` before `closeSheet()`.
- **Not shared but outside the brief's list:** `src/game/contracts.ts` one line ("Land a trick" for a target of one,
  not "Land 1 different tricks", now that the contracts are drawn); `scripts/playtest/r9-truth.js` (the rooms, the
  Choose, the round-9 sheets' surface, the crawl's second level, the duel's mountain from the title's model) and
  `scripts/playtest/r9-screenbars.ts` (the Cup's system words take "Cup"). `save.ts` and `spineview.ts` untouched.

## web-design-guidelines (the Vercel Web Interface Guidelines, fetched fresh on 23 November)

Run over `src/ui/title.ts`, `rooms.ts`, `results.ts`, `sequence.ts`, `kit9.ts`, `kit9.css`, `story.css`, `rooms.css` and
the round-9 part of `screens.css`.

- Fixed: block headings with a figure in Title Case ("Your Flame: 13 Days", "The Twelve: 10 of 12 Beaten"); the first
  visit's toggle named "Sound" with `aria-pressed` (the visible "Sound On" or "Sound Off" contains the name), not a
  label that changes under a pressed state; a list's default padding reset (`ol`, which the overlay's reset misses).
- Clean: every control has visible words and an accessible name (glyphs `aria-hidden` beside them); the rooms and
  Details are `role="dialog"` with `aria-modal` and a name, take focus on their heading, keep Tab inside, close on
  Escape, Backspace, B and their own Close or Back, and give focus back to their opener (by its focus key when the
  screen under them was drawn again); the quiet line is a polite live region; focus rings are `:focus-visible` (and the
  pad's mark) with an ink fringe that holds on snow; hover on every button and chip; transform and opacity only, no
  `transition: all`, every duration zero under reduced motion, the results' story interruptible by a tap or a key;
  sheets `overscroll-behavior: contain`; `touch-action: manipulation` on every control; the safe-area insets in the
  gutters and the phone sheet's foot; numbers through `Intl` (`fmt.ts`) and tabular; names `translate="no"`; curly
  apostrophes and quotes; a single ellipsis character ("Loading…" on a pending ad offer, the dev mock's only).
- Not taken, and why: a room or Details written into the URL (the game is one canvas page, a room is not a place to
  link to, and the URL carries a friend's challenge); a skip link (the title is one short column over the scene).

## What the main lane must decide

1. **The intros live for a session.** `TitleSpine.intro` is what the runs of this session opened (a feature page, a
   sled, a garage piece) and the day's news when it is news (a new month's chapter, the day's contracts, a move in the
   Cup's league, the week's Trial), held in `app.ts` until its door is opened (`onIntroSeen`). A reload forgets a "New"
   not yet opened. A save field (`introsSeen`) would keep it across sessions; I kept `save.ts` untouched. The Garage's
   "New" has no line (the garage is the shop lane's place, not a room of mine): its door carries the tag only.
2. **"Ready in the shop" opens the garage, not the piece.** Details' "Open the Garage" takes the title's own way in
   (`ui.ts openGarage`); opening it at that sled needs the shop lane's garage to take a piece to show (a `showSleds`
   pick), which I did not add to `menus.ts`.
3. **Escape on CrazyGames.** Bound (decision 392's default); in fullscreen the first press leaves fullscreen. To be
   checked on CrazyGames by a person.
4. **The Trial leaves Ride's row.** The Cup/Trial switch under Ride is gone; the week's Trial is chosen in Daily and Cup
   beside the Cup (decision 392). The Trial's rule and targets still stand over Ride while it is picked.
5. **Ride's plain reason is the mountain's tagline** ("Pine forest, soft powder, snowmen") when nothing else applies:
   the chip already names the place. A person should say whether it reads as a reason.
6. **`menus.ts` is the shop lane's.** Two small hunks there (the comment and `closeTop`); the merge keeps both.
7. **A Daily's or a Cup's medal leads with the time** (the third critic's "3rd" over "silver" fault, answered by
   leading with the medal won on the clock and saying the place as the race's). If the main lane prefers the place to
   lead everywhere, `resultsMoment` is the one place to change.

## What only scripts have seen

- Everything on the fixtures: the titles at every stage, the rooms, the results' cases (pinned runs, so the times are
  not real), Escape and the pad's B (a scripted pad), Run Again timed, the crawl. No person has opened the title, a
  room or Details, ridden a run to the new results, or heard the story's sounds against its beats.
- Reduced motion lands the story whole (read from the code and its CSS; not captured).
- A friend's challenge link on the new title, a Long Night's results and a Trial's results on a phone: drawn by the
  code paths, not looked at by me beyond the desk captures.
