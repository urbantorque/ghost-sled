# Round 9, the feelui lane: the title's words by the round's counter, and the screens' carried faults

Branch `r9-feelui`, cut by hand from `round-9` at bd2ef9a (everything merged: DECISIONS 396 to 404). The brief is
`notes/r9-briefs/feelui.md`: milestone 4's feel pass on the screens. Frames and raw output under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/feelui/`:

- `bars/before/`, `bars/after/`: the truth sweep (`r9-truth.js` through `r9-truth.sh`, as `feelui-truth`) on this
  worktree's dev server at 5050: every fixture's title on a desk (1280 x 720) and a phone (390 x 844), each with its
  rooms and the Cup, Daily and Trial chosen; the run-50 and run-100 titles of both pilots with each of the eight
  mountains picked; on `after/` also the results' first finish and crash at mid-20. Counted by `r9-screenbars.ts`
  (`desk.json`, `phone.json`, the printout in `bars.txt`).
- `look/before/`, `look/look1/`, `look/after/`, `look/final/`, `look/look2/` (after the critic): the faults' frames, desk
  and phone (`r9-u4-look.js` through `r9-feelui-run.sh`, as `feelui-look`).
- `reel/before/`, `reel/after/`: the title reel's loop on all eight (`r9-feelui-reel.js`): every frame from the one before
  a cut to 1.6 s after it, the lens's distance from the hero and whether the hero is in the picture, and a contact sheet
  of the canvas from the cut on (`<form>-reel-<mountain>.png`). `reelwhole/`: the reel over its whole loop from the title's
  first frame (`r9-feelui-reelwhole.js`), the base's reel files against this lane's, and `after2/` after the first-pick cut.
- `proto/`: the picker's two candidate layouts laid over the unchanged build as CSS, before any source changed.
- `narrow/`: the title on a 375 and a 360 px phone.
- `family/` (the critic's frames) and `keys/family.json` (which is which, outside the folder it saw).

## Status

- 27 November: read the rules, the brief, the round's brief (sections 2 to 4 and 6), ART.md 10, DECISIONS 396, 399, 401,
  403 and 404, the ui, polish and wiring lanes' notes. Everything before any source change was shot first (the bars, the
  faults, the reel, the picker's candidates). The browser slot was the look lane's for long stretches; every capture of
  mine waited its turn, one browser at a time.
- Built in eight commits (d839183 the scripts; b3ef369 the title; f04ec8b the results' time, Resume's P, the garage's
  strip; f6d205d the reel's cut; 83d1369 the picker with nothing picked, Ride's reason wrapping; d470ee8 the picker's rows
  on one edge and the garage's rim, after the critic; 84acf30 the reel's first pick, after the critic; 1e453f3 the
  whole-loop script), each looked at on a desk and a phone, the bars measured on the base and on mine, one fresh
  family-test critic, web-design-guidelines, `tsc --noEmit` clean before each commit. The full suite in the heavy slot at
  1e453f3 (`shots/r9/feelui/full-suite.txt`, 184 s): 119 files, 2,162 tests, all passed.
- One capture of the base was spoilt by the laptop suspending mid-run (`ERR_NETWORK_IO_SUSPENDED`, the page reloading
  under four novice-50 shots); those four figures are from the first, whole desk run, and the session holds the machine
  awake since.

## 1. The title's words, by the round's counter

The counter is `r9-screenbars.ts`'s, unchanged: a word is a visible token with a letter or a digit, so "Space" on Ride's
keycap, "1,281", "13-day" and "0.5 s" (two) all count, and the dev build's mock ad offers do not. A mountain picked is a
chip pressed on the title as a player presses it (the veil crosses, the title is drawn again), `r9-truth.js mtns`; the
run-50 bar of 40 is held to every one of them, and a locked chip pressed (Lanternfall on the novice's saves) is not a title
picked and is not held to it.

### What DECISIONS 404 ordered, done

1. **A new mountain's mirror way leaves the title** for its board, where it is said in full under its home riders ("Beat
   all 3 to the line and The Old Run rides mirrored."). The five's unopened mirrors said nothing there either, so now no
   shut mirror speaks on the title: five words off the Old Run's, Gullhaven's and Gablefall's titles ("Mirrored: beat its
   3 riders"). `title.ts` loses `mirrorWay`, `mirrorWayText` and their CSS (`.gs9-how-way`).
2. **The Twelve's line in seven words**: "Beat 9 more of The Twelve to open Lanternfall" (nine) is "Lanternfall: beat 9
   more of The Twelve", the goal first, the count and its word kept; a locked Lanternfall pressed says the same sentence.
   Two words off every title whose line is The Twelve's (the novice's saves at runs 20 to 100, mid-20).

### Every title's count against its bar (desk / phone; the bar is 40 at run 50)

**Run 50, each mountain picked** (before at bd2ef9a, after at f6d205d, whose words no later commit changes; the phone
has no keycap, one word fewer):

| Mountain | mid-50 desk | mid-50 phone | novice-50 desk | novice-50 phone |
| --- | --- | --- | --- | --- |
| Pinecrest | 40 to 40 | 39 to 39 | **43 to 41** | 42 to 40 |
| Frostfang | **41 to 41** | 40 to 40 | 41 to 39 | 40 to 38 |
| Gablefall | 42 to 37 | 41 to 36 | 45 to 38 | 44 to 37 |
| Ember | 40 to 40 | 39 to 39 | 41 to 39 | 40 to 38 |
| The Old Run | 44 to 39 | 43 to 38 | 47 to 40 | 46 to 39 |
| Sakura | 40 to 40 | 39 to 39 | 39 to 37 | 38 to 36 |
| Gullhaven | **46 to 41** | 45 to 40 | **49 to 42** | **48 to 41** |
| Lanternfall | 36 to 36 | 35 to 35 | (locked) | (locked) |

Met after: 25 of the 30 run-50 titles with a mountain picked (before: 13 of 30). Over after, every one by a word or two:

- **Gullhaven, three times** (desk mid-50 41, desk novice-50 42, phone novice-50 41): Ride's reason is its tagline, ten
  words, "A sea cape: pop off the gully lips, ride the wind", the longest reason in the game (the five's are four to six).
- **Frostfang at mid-50 on a desk** (41): Ride's reason is the rung above, "Vida Flip is 2.0 s ahead" (six with the
  figure's "s"), and the desk's "Space" keycap; the phone's is 40.
- **Pinecrest at novice-50 on a desk** (41): the duel ("Old Wren, head to head"), the Daily door's "New" and "Space";
  the phone's is 40.

Nothing else of 404's order applies to these, and every word left is a number's word, a control's word, a mountain's
name or Ride's reason; I stopped there (the main lane's call, below).

**Run 100** (no bar; for the record): mid-100 desk 41, 42, 38, 41, 40, 41, 42, 40 (Pinecrest to Lanternfall in the
picker's order: Pinecrest, Frostfang, Gablefall, Ember, the Old Run, Sakura, Gullhaven, Lanternfall), from 41, 42, 43,
41, 45, 41, 47, 40; novice-100 desk 39, 37, 36, 37, 38, 38, 40, 37 from 39, 37, 41, 37, 43, 38, 45, 37. The phone one
fewer on each.

**Every fixture's own title** (its saved mountain), desk / phone, before to after: fresh 20 / 19 (unchanged); mid-1 37 /
36; mid-5 36 / 35; mid-20 42 to 40 / 41 to 39; mid-50 40 / 39; mid-100 40 / 39; novice-1 34 / 33; novice-5 35 / 34;
novice-20 42 to 40 / 41 to 39; **novice-50 43 to 41** / 42 to 40; novice-100 39 / 38. With the Cup or the Daily chosen,
31 to 36 on every save; with the Trial chosen (mid-100) 52 / 51, as DECISIONS 399 accepted.

**The other title bars**, after: one primary on every title, no look-alike, no lone icon, no bare figure, nothing
loading. The one repeat left is the novice's "Lanternfall" on its chip and in the quiet line (as before: the line names
the goal it opens). The rooms have no primary, as designed (Ride stays the one behind them).

**The results' first view** (not changed by this lane, measured on the merged build): the crash at mid-20 34 desk / 33
phone; **the first finish at mid-20 38 / 37, over the 35**: its reward card is an owed hour told, "New on Rider Rank 16 /
Gablefall at Evensong" (DECISIONS 403), 13 words with the bar's figure and the gifts, where the ui lane measured 32 on
this fixture before the hours were wired. The time's restyle adds no word. For the main lane.

## 2. The faults left for the feel pass, each before and after

Frames: `look/before/<form>-<shot>.png` (the base) against `look/final/<form>-<shot>.png` (the last build); the title's
from `bars/before/` and `bars/after/` (`<form>-mid-50-title-at-<mountain>.png`).

### The picked chip no larger in the picker of eight

- Before (`bars/before/desk-mid-50-title-at-pinecrest.png`, `phone-mid-50-title-at-gullhaven.png`): two rows of four equal
  chips; the pick was only its ring (and, on a desk, the best pill over its sky).
- Two candidates were laid over the base as CSS first and looked at on both forms (`proto/`): the picked chip twice as
  wide (a grid of five), and the picked chip taller than its row. Taller read weakly on a desk and, on a phone, opened a
  gap the height of the rise between the rows; twice as wide read at a glance on both, as the one-row picker of five does.
- First build (b3ef369; `bars/after/`, `look/final/`): a grid of five equal columns, the picked chip spanning two, the
  fifth chip always starting the second row; so one row was full and the other ended a column short. The family critic
  read that hole, which moved with the pick (in the top row when the pick was in the second), as a fault.
- After (d470ee8; `look/look2/desk-title-*.png`, `phone-title-*.png`): a grid of twenty columns as narrow as the names
  allow; in the picked chip's row it spans eight and its three neighbours four each, in the other row each chip spans
  five, so both rows end on one edge and the pick is twice as wide as the chips beside it, with its ring and (on a desk)
  its best. `title.ts` marks the picked chip's row (`in-pick-row`) and the strip (`has-pick`). Read off the frames: on a
  desk the picked chip's row-mates about 81 px, the other row's 103, the pick 169; on a 390 px phone 69, 87 and 140,
  "Lanternfall" whole in a fifth (its name's side padding 4 px, from 5).
- **Where it does not hold:** on a phone narrower than 390 px a fifth of the width would cut "Lanternfall", so there the
  rows stay four equal chips and the pick is its ring and heavier name (`narrow/phone-w375-now.png`, `w360`: every name
  whole). With the Daily, the Cup or a Trial chosen no chip is picked and the rows are four equal columns (found in the
  after sweep: `bars/after/phone-mid-50-title-daily.png` had an empty fifth column; fixed in 83d1369,
  `look/final/*-title-daily.png`).

### On a phone's first visit, Sound On over the logo's last letter

- Before (`bars/before/phone-fresh-title.png`): the toggle pinned to the top right, over the centred logo's "T".
- After (`look/final/phone-fresh.png`, `desk-fresh.png`, `narrow/phone-fresh-w360-now.png`): it stands where the doors
  will, at the column's foot under the quiet line, centred on a phone and on the logo's side on a desk; it arrives with the
  column. In the column it is also a block the ghost tags keep off (`measure()` no longer pushes it separately). The tab
  order is as before (Ride, then Sound).

### Resume's "P" drawn as a round pad cap

- Before (`look/before/desk-pause.png`): a one-letter keycap is a pill only a little wider than tall, so "P" was a circle;
  on the vermillion its lip was replaced by a ring, so it read as the pad's face button (a round cap with a rim and no
  lip, ART.md 10); and it sat beside the word, where Ride's Space sits at the button's end.
- After (`look/final/desk-pause.png`): any keycap on a kit9 button is at least 2.8 em wide (a key, as "Space" is: one
  pill family), keeps its lip in ink on the vermillion, and stands at the button's end. The pad's A (a circle) and Start
  (a pill with a rim) are untouched; on a phone (touch) no keycap is drawn, as before. The HUD's lantern "E" is a
  rounded square (the HUD's, not touched): keys on the screens are pills, the HUD's one key is not.

### The results' time upright and small

- Before (`look/before/desk-results.png`, `phone-results.png`): "0:22.5" upright at 800 and 0.8 of the word's size, a
  caption beside "FIRST DOWN THE MOUNTAIN".
- After (`look/final/desk-results.png`, `phone-results.png`, `desk-details.png`): the time in the word's italic 900, a
  step larger than its capitals (1.14 em), tabular figures, in the word's colour.

### Content clipped in the garage's tile strip (G6's screens: this one fix only)

- Before (`look/before/phone-garage-sled.png`, `phone-garage-hats.png`): on a phone each tile was as wide as its name, so
  the third was cut wherever the screen ended ("Lodge Tobogga", "Watch Cap" half gone) under a 24 px fade too short to
  read as one.
- First build (f04ec8b, `look/final/phone-garage-*.png`): every tile 1/2.14 of the strip, two whole and the third's
  first 29 px under a 44 px fade. The family critic still read "Lo / Yo" at the edge as text cut through.
- After (d470ee8, `look/look2/phone-garage-sled.png`, `phone-garage-hats.png`): every tile 1/2.05 of the strip, so two
  whole tiles show and only the third's rim (about 14 px, inside its own padding) shows, faint under the fade at the
  strip's end: the row says it goes on and never shows a name cut in two; a long name wraps in its tile. The desk's
  two-column grid is untouched. `garage.css` only, inside its phone query (one rule and the fade's width).

### The title reel's loop

- Before (`reel/before/`): every loop's cut put the hero back at the start of its shot while the lens eased after it.
  On all eight mountains the lens stood 240 to 1,426 m from the hero on the frame after the cut and the hero was out of
  the picture for 27 to 43 frames, back in it 0.59 to 0.89 s after the cut (desk: Pinecrest 0.72 s, Frostfang 0.89,
  Ember 0.74, Sakura 0.74, Lanternfall 0.73, the Old Run 0.64, Gullhaven 0.59, Gablefall 0.65; the phone within 0.07 s
  of each). Gullhaven's loop is the shortest, so it showed most often, but every mountain had it. The contact sheets show
  the empty course (`reel/before/desk-reel-gullhaven.png`: no rider from +32 to +523 ms).
- After (`reel/after/`): on the first frame with its hero the reel calls the world's own reel cut (`world.reelCut`, as
  Watch Your Run's cuts do: the ground at the new place built at once, the spray cleared, the lens put behind the hero),
  and the orbit lens faces the hero's way at once (`camera.ts snap`, one line, only in the title's orbit mode: its eased
  travel direction would otherwise swing it round from the end of the shot for a second). On all eight, desk and phone,
  the lens stays 5 to 9 m from the hero through the cut and **no frame is without the hero**. The title's dip (0.7 ink to
  clear over 520 ms) still covers the cut. The frame that cuts was already the slowest of the loop before (the reel picks
  its hero again: 54 to 256 ms on the base), and is of the same order after (61 to 217 ms); not judged as a frame rate,
  only so it is said.
- **The reel's first pick, found by the family critic** (its frame of Gullhaven's phone title, `family/f05.png`, showed no
  rider, the sky and a ghost overhead). Over the whole loop from the title's first frame (`r9-feelui-reelwhole.js`, 20 s
  a mountain, `reelwhole/`): when the reel first picks its hero it takes its shot, and the hero jumps from the course's
  start to the shot (2 km on Gullhaven) while the lens eased after it, out of the picture for 0.5 to 1.3 s about 2 to 3 s
  after the title opened, on the base and on f6d205d alike (Gullhaven desk 2.47 to 3.19 s, phone 1.91 to 3.24 s, 319 m
  off). The lens now cuts there too (84acf30: a hero picked sets the same flag). After it (`reelwhole/after2/`, 10 s
  each): with a hero picked the hero is in the picture on every frame on all eight, desk and phone. What remains is
  before any hero is picked (the replays still coming in, DECISIONS 403's "about the first second"): a ghost at the
  course's start for 0.1 to 0.6 s in the first 0.3 to 2.8 s, out of the picture; not changed (the reel's model, not a
  cut), for the main lane.
- And across the whole 20 s from the title's opening, the base's reel files against f6d205d (`reelwhole/*-base.json`,
  `*-mine.json`): frames with the hero out of the picture after the first second, phone 0 to 147 of about 1,140 a
  mountain on the base, 0 to 81 on f6d205d; desk 0 to 112 and 0 to 45. On the base they are every loop's cut, the first
  pick's jump and the frames before a hero is picked; on f6d205d only the last two (no cut's), and on 84acf30 only the
  frames before a hero is picked.

### Beyond the list, found on the way

- **Ride's reason ran out of its pill on a 360 px phone** (`narrow/phone-w360-now.png`: Gullhaven's "... ride the wind"
  past the button's edge; the base button is `white-space: nowrap`). The reason now wraps, balanced, in its pill
  (`screens.css .gs9-ride-why`, 83d1369; `narrow/phone-final-w360-now.png`). On a desk and a 390 px phone every reason
  still fits one line, so nothing else moves.
- **The picker with nothing picked** (the Daily, the Cup or a Trial chosen) had an empty fifth column on the first build
  of the wide pick; fixed (above).
- **The reel's first pick** (above): a lens glide like the loop's, at the title's opening.

## Every hunk in a shared file

- **`src/game/app.ts`** (4 hunks, all in the title reel's own code, `frameTitle` and the fields beside it): a field
  `reelLensCut` after `reelHero`; at the top, a hero picked sets the flag; the cut's condition named `cut` and the flag
  set inside its branch; before `world.frame`, on a frame that has its hero and is not itself the cut,
  `this.world.reelCut(snap)` (World's public reel cut, unchanged).
- **`src/render/camera.ts`** (1 hunk, `ChaseCamera.snap`): in the title's orbit mode the eased travel direction takes the
  hero's at once (`this.dirS.copy(t.dir)`). Not a world; the chase, crash, hero and finish lenses are untouched (a
  revive's snap and the run reel's cuts are chase mode).
- **`src/ui/title.ts`** (the ui lane's screen; not on the shared list): the mirror way and its two functions out; the
  Twelve's line through `twelveAim`; the first visit's Sound toggle into the column; the picker marks its strip
  (`has-pick`) and the picked chip's row (`in-pick-row`).
- None in `save.ts`, `spineview.ts`, `menus.ts`, `ui.ts` or `contract.ts`. Files touched otherwise: `screens.css`,
  `story.css`, `kit9.css`, `garage.css` (one rule and a fade, phone only), `tests/r9words.test.ts` (the Twelve's line),
  and the scripts `r9-truth.js` (`mtns`, the wait for a travel), `r9-screenbars.ts` (the bar on `-title-at-<id>`, not on a
  locked chip pressed), `r9-u4-look.js` (`q`), new `r9-feelui-run.sh`, `r9-feelui-reel.js` and `r9-feelui-reelwhole.js`.

## web-design-guidelines (the Vercel Web Interface Guidelines, fetched 27 November)

Read against this lane's hunks in `title.ts`, `screens.css`, `story.css`, `kit9.css`, `garage.css`.

- Clean: the Sound toggle keeps its name ("Sound") and `aria-pressed`, its visible words, its focus ring and its place in
  the tab order (after Ride); the picked chip keeps `aria-pressed` and its spoken best and rank; no new control, no
  `transition: all`, no animation added (the reel's cut is now a cut, which also suits reduced motion; the dip is still
  skipped under it); the time keeps tabular figures; Ride's reason and a garage tile's name wrap rather than overflow;
  every control at least 44 px (a 69 px chip on a phone, the tiles at `--hit`); the keycaps stay `aria-hidden` beside the
  button's own `aria-keyshortcuts`; "Lanternfall: beat 9 more of The Twelve" a numeral for the count, no straight quote.
- Not taken: none.

## 3. The family test (blind, `model: opus`, `effort: xhigh`, given only ART.md and the frames)

One fresh critic (27 November, seed 41; `family/`, 16 frames from `look/final/` at 83d1369, the key in
`keys/family.json`): the title on Ember, the Old Run and Gullhaven, the results, Details, the Progress room, the pause card
and the garage, on a desk and a phone, shuffled. Asked whether they read as one family, a score a frame with the one thing
to press, and every fault worst first. Never told what changed or which lane's.

- **"Mostly yes"**: one ink sheet with an 18 px corner from the logo's side (the bottom on a phone), italic 900 Title Case
  heads with a quiet Close or Back, every button a pill with a glyph and a word in ranks told apart, one vermillion
  primary with its lip and keycap, the roles held ("marigold gift figures with their glyph, mint for ghosts, gold-white
  for 1st"), the same picker, quiet line and doors on every title.
- **Scores, against DECISIONS 404's second critic** (the polish lane's, `notes/r9-polish.md`):

| Frame | 404, desk | Mine, desk | 404, phone | Mine, phone |
| --- | --- | --- | --- | --- |
| The title | 8, 8 | 7 (Ember), 7 (the Old Run), 7 (Gullhaven) | 8 | 7 (Ember), 6 (the Old Run), 5 (Gullhaven) |
| The results | 7 | 5 | 7.5, 8 | 5 |
| Details | 7.5 | 7 | 7.5 | 7 |
| Progress | 8.5 | 8 | 8 | 8 |
| The pause card | 7 | 7 | 8 | 7 |
| The garage | 8 | 8 | 7 | 7 |

- **Why lower, by its own words, and what became of each:**
  - *The results, 5 and 5:* the dev build's mock "Watch Ad: Double Gifts" as a fifth button making a 2 x 2 grid whose
    gutters do not line up (the published build has no ads; the polish critics docked it too); "New on Rider Rank 16" over
    "Rider Rank 25" on the reward card (DECISIONS 403's told hour, not this lane's: for the main lane); split times and a
    0:22.6 win that only a staged run makes (the capture sets the sled near the line). None of it this lane's; the time's
    new italic 900 was not raised.
  - *The titles:* the picker's hole that moved with the pick (fixed after it, d470ee8: both rows end on one edge); the
    phone's Gullhaven frame with no rider (the reel's first pick: fixed after it, 84acf30); the phone's hero at 30 to 36%
    of the width (ART.md 10's 54 to 60% is written for a wide screen; the key art's lens, not this lane's); the left
    column's blocks ending at different widths and Ride's width following its reason (the ui lane's column, as before); no
    mirror line on the new mountains (ART.md 10 still says it: 404's order takes it off, and ART.md must change, below).
  - *The garage:* "Lo / Yo" at the strip's edge read as text cut through (narrowed to the rim after it, d470ee8); "Your
    sled" said twice, a marigold check for worn, the coat royal blue, Close and Lantern Row of different heights (G6's,
    left: this lane's one garage fix is the strip).
  - *The pause card, 7 and 7:* a short card on a desk where every other sheet is full height (U4's choice, 399); a focus
    ring on Resume on a phone (the capture opens pause with the P key, which is keyboard focus; a tap does not draw it);
    "(II)" and "(III)" after mission names as figures without words (the missions', for the main lane). Resume's "P" was
    not raised.
- **Its other faults, not this lane's, for the main lane:** Suki Ember's name in mint in Details' race list but in her
  accent on the results' fact and Progress; "The Twelve: 10 of 12 Beaten" with a capital B, and on a phone "Beaten" alone
  on a line; the open book for the quiet XP line, the Progress door and the Almanac alike; the run's trail drawn as a long
  dark-red band over the snow, and marigold arcs on the snow beside the rider (the world's); a ghost against the logo's
  underline on the phone's Old Run title.
- Not run again after the fixes: the brief asked for one critic, and the frames it could not have seen (`look/look2/`)
  are mine alone to vouch for.

## 4. Text for ART.md 10 (the main lane edits it)

- **"The title has one job at a time"**: "the picked one larger with your best on it in words" gets "(in two rows of four,
  past six mountains, the picked chip twice as wide as the others in its row, both rows ending on one edge; on a phone
  narrower than 390 px, where a fifth of the width would cut a name, the rows are four equal chips and the pick is its
  ring)". "under Ride, once open, ... and its mirror, a switch with its word apart from the hour's pair (a new mountain's
  mirror opens when its three home riders are beaten to the line; until then, where the toggle would stand, a quiet line
  with a lock says the way in five words at most, "Mirrored: beat its 3 riders", words and not a control, and its board
  says it in full under its home riders)" becomes "... and its mirror once open, a switch with its word apart from the
  hour's pair (a mirror not yet open says nothing on the title, the five's and the new mountains' alike; a new mountain's,
  opened by beating its three home riders to the line, is said on its board under them)". "Lanternfall by The Twelve"
  gets its sentence: "Lanternfall: beat 9 more of The Twelve". "A first visit keeps the logo, its tagline, Ride, the line
  "Pass ghosts to unlock new mountains" and a labelled Sound On" gets "(where the doors will stand, at the column's foot)".
- **"The results are three beats"**: "the place, its word and the time in italic 900" stands; add "the time a step
  larger than the word's capitals".
- **"A pad's glyphs follow the HUD's keycaps"**: add "A key on a button is a pill at least half again as wide as it is
  tall, with its lip (in ink on the vermillion), at the button's end: one letter ("P") is a key as "Space" is, never a
  round cap."
- **"Ride's reason"**: add "It wraps in its pill rather than run past it."
- **"Moving between mountains"** (round 7's key art item): add "The reel loops by a cut, never a glide: when it starts
  again, and when it first takes its shot, the lens is put on the hero on that frame, under the title's dip."
- **The garage** (round 9's item): "the shelf's pieces as tiles" gets "(on a phone a row of two whole tiles and the rim of
  a third under a fade, never a name cut in two)".

## 5. Text for DECISIONS (the main lane's to write)

> **The feel pass on the screens** (`r9-feelui`, d839183 to 1e453f3; `notes/r9-feelui.md`, frames under
> `shots/r9/feelui/`; milestone 4).
> - *The title's words, by the round's counter, on all eight:* the sweep now picks every mountain on a run-50 and run-100
>   title, chip by chip. Before: 13 of the 30 picked run-50 titles within 40 (desk and phone; Gullhaven 46 and 49 on a
>   desk, the Old Run 44 and 47). 404's order done: a new mountain's mirror way leaves the title for its board (five
>   words); The Twelve's line "Lanternfall: beat 9 more of The Twelve" (seven, from nine). After: 25 of 30; over by a word
>   or two, Gullhaven three times (its ten-word tagline as Ride's reason), Frostfang at mid-50 and Pinecrest at novice-50
>   on a desk only (the Space keycap's word).
> - *The faults carried to the feel pass, fixed:* the picked chip twice as wide in the picker of eight, both rows on one
>   edge (four equal chips on a phone under 390 px); a first visit's Sound On where the doors will stand, off the phone's
>   logo; Resume's "P" a key, not a pad's cap; the results' time in italic 900 a step larger; the garage's phone strip two
>   whole tiles and a rim, no name cut; the title reel's lens cuts with its loop and with its first pick (no frame without
>   the hero on all eight, desk and phone, where it was out of the picture 0.6 to 0.9 s at every loop). Beyond the list:
>   Ride's reason wraps in its pill (it ran past it on a 360 px phone); the picker with the Daily chosen is four columns.
> - *Judged blind:* one family test, "mostly yes"; its scores 5 to 8, below 404's on the titles and results (the dev
>   build's mock ad, a staged run's figures and a told hour's card on the results; the picker's hole and the phone's
>   empty first pick on the titles, both fixed after it).
> - *The shared files:* four hunks in `app.ts`'s title reel and one line in `camera.ts`'s `snap` (the title's orbit
>   only). tsc clean; the full suite 119 files, 2,162 tests.

## 6. What the main lane must decide

1. **The five run-50 titles still over 40** (by one or two words; section 1): accept, or a third step past 404's order.
   Measured options, each counted on these captures:
   - Ride's plain reason on a new mountain as its tagline up to the colon, what it is ("A sea cape", "An old ice track",
     "A snowed-in town"): Gullhaven 41 to 34 and 42 to 35 on a desk, 41 to 34 on a phone; the Old Run and Gablefall a
     few lower. The mechanic would then be said nowhere on the title (M3 asked for it in a few words on the title's
     card), so this is a copy call (the taglines are `mountains.ts`'s, the mountain lanes').
   - Or its part after the colon, how it rides ("Pop off the gully lips, ride the wind"): Gullhaven 39 and 40 on a desk;
     "Ride high on the glaze" and "Ride its roofs down" under the verb RIDE say "ride" twice.
   - Frostfang at mid-50 (41, desk only): the rung said as "Vida Flip, 2.0 s ahead" (one word fewer, on every rung).
   - Pinecrest at novice-50 (41, desk only): The Twelve's line in six ("9 more duels won open Lanternfall"), losing the
     name The Twelve; I kept seven.
   - Or count the desk's "Space" keycap as the control's word it is and the bar met on the desk where the phone meets it
     (both of the desk-only overs are 40 on a phone).
2. **The results' first view at mid-20 is 38 words** (37 on a phone) on the merged build: the told hour's card "New on
   Rider Rank 16 / Gablefall at Evensong" (403), measured by the ui lane at 32 before the hours were wired; and the
   critic read "New on Rider Rank 16" over "Rider Rank 25" as two ranks that disagree. Not this lane's; its card's words
   are `rank.ts`'s and `sequence.ts`'s.
3. **The picker in two rows**: the picked chip twice as wide as its row-mates, the other row's chips a little wider than
   them (both rows on one edge); four equal chips on a phone under 390 px. ART.md 10's phone text ("the strip scrolls so
   every name is whole") was written for five chips; with eight the rows show every mountain at once. Keep, or a
   scrolling row of eight on a phone (some mountains out of sight).
4. **The mirror way on the title is gone** for the new mountains (404's order); ART.md 10 must say so (text above), or
   the critic's reading of ART.md stands as a fault.
5. **Sound On on a first visit sits at the column's foot on a desk too** (it was top right): one place on both forms,
   where Settings will stand. Keep, or top right on a desk only.
6. **The keycap rule** (any keycap on a kit9 button at least 2.8 em wide, its lip in ink on the vermillion): the HUD's
   lantern "E" stays a rounded square, the screens' keys pills; one shape for both would need the HUD (not this lane's).
7. **`camera.ts`**: one line in `snap`, title orbit only. If the main lane would rather keep `src/render` untouched, the
   cut works without it but the lens swings round from the end of the shot for about a second after it (the eased travel
   direction); not shot that way, only read from the code.
8. **Before the replays are in** (the title's first 0.3 to 2.8 s): the reel follows a ghost at the course's start until
   it picks its hero, the lens far off; then it cuts to the shot. Showing the shot's first metre until the hero is picked
   would be one more small hunk in the reel; not done (no fault named it, and it is the reel's model).

## 7. What only scripts have seen

- Everything here on the dev server's fixtures (`mid-*`, `novice-*`, `fresh`), headless Chrome on Windows at 1280 x 720
  and 390 x 844 (and 375 and 360 for the picker): no person has looked at the new picker, the moved Sound On, the keycap,
  the time or the garage's strip in the game.
- The reel's cut: measured frame by frame by script (the lens's distance and the hero's projection) and grabbed as
  contact sheets; nobody has watched a title loop by eye on a real display, nor on Low, Ultra or a real phone. The cut's
  own frame (54 to 256 ms on the base, 61 to 217 ms after) is a script's reading on a laptop shared with another lane,
  not a frame rate.
- The picker's name fit is measured on Windows' fonts; on iOS (SF Pro) and Android (Roboto) "Lanternfall" in a fifth of
  a 390 px phone has not been seen (a pixel to spare here).
- The results' and Details' frames are staged runs (the sled set near the line), so their times and splits are not
  real; the results' figures the critic called contradictory come from that.
- Reduced motion, a pad, touch and a screen reader on the moved Sound On and the picker: not exercised (the controls are
  the same buttons with the same names and focus keys).
- The family critic saw `look/final/` (before the picker's flush rows and the reel's first-pick cut); `look/look2/`
  (after them) has been looked at by me only.
