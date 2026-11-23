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

(Frames and counts below.)

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
