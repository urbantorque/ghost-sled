# Round 9, the polish lane: the screens' carried faults

Branch `r9-polish`, cut by hand from `round-9` at 894859b (the title and results, the Old Run, the garage, the other
screens, Gullhaven and G6 merged). The brief is `notes/r9-briefs/polish.md`: the faults the round's critics named on the
screens and left for later, each fixed and checked on a desk (1280 x 720) and a phone (390 x 844), then one family test.
Frames and raw output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/polish/`: `before/` (today's, the base
at 894859b), `look1/` to `look5/` (my own looks between changes), `after/` (the build the first critic saw, 681a6e3),
`after2/` (the build the second saw, 3c97c10), `bars/before/` and `bars/after/` (r9-truth.js's counts on the base and on
my build), `apostrophe/` (the glyph specimen), `family/` and `family2/` (the critics' frames; the keys in `keys/`). Every look went through `scripts/playtest/r9-polish-look.sh` (the u4 lane's
`r9-u4-look.js`, one headless browser through the slot as `polish-look`, this worktree's dev server at 5020); the bars
through `r9-truth.sh` (as `polish-truth`). The console was clean (no error) on every capture of this lane.

## Status

- 27 November, afternoon: read the brief, the rules, ART.md 1 and 10, DECISIONS 396, 399 and 401, the ui, u4 and g6
  lanes' notes. Today's screens shot on the fixtures (`before/`, desk and phone, mid-5, mid-50 and mid-100). The phone's
  first pass was spoilt by my own edits landing on the dev server while it ran (from mid-100 on it showed the new
  Garage door); it was shot again from a stash of the base, and from then on no source was touched while a capture ran.
- Built in five commits (c5b25ad the list, c761863 item 9, 681a6e3 the quiet wash, 3c97c10 the first critic's faults,
  fe066a7 the second's) and these notes; looked at on both forms after every change (`look1/` to `look5/`), the bars
  measured on the base and on mine, two fresh family-test critics (the brief asked for one; the second judged the first's
  fixes), web-design-guidelines. `tsc --noEmit` clean; the full suite in the heavy slot at fe066a7, 116 files and
  2,095 tests, all green. My dev server and every browser of this lane are stopped and closed.

## The list, each before and after

Frames: `before/<form>-<shot>.png` against `after/<form>-<shot>.png` (desk and phone), and `look2/` for the harness's
results (a wreck, a duel lost, the crown, a finish).

### 1. Details' vermillion button floated over its last rows (the results' Details sheet)

- Before (`before/desk-mid-50-details-foot.png`, `phone-mid-50-details-foot.png`): the one button was `position:
  sticky` at the foot of the scrolling body, over a gradient from clear to ink, so the last rows read under it and a
  focused control in Keep This Run could sit behind it.
- After (`after/desk-mid-50-details-foot.png`, `phone-mid-50-details-foot.png`, `mid-5-details-foot`): the button stands
  in the sheet's own foot (`results.ts`: `detailsBody` returns it and `openDetails` puts it after the body), under a
  hairline; the body scrolls and ends above it, and fades at its edges as every sheet's body does (`kit9.css`: Details
  is no longer excluded). Focus still keeps inside the sheet (the foot is in it); Escape, Backspace and B are unchanged.

### 2. The gift figure drawn three ways

- Before (`before/desk-mid-50-title.png`, `phone-mid-50-title.png`): marigold on the results ("+77 gifts" with its
  glyph), marigold in the garage (G6: "90 gifts to spend" with its glyph), grey on the title's Garage door ("90 gifts").
- After: the door wears the gifts as the results and the garage draw them, the glyph, the figure and its word in
  marigold (`title.ts door`, `screens.css .gs9-door-s.is-gift`); Details' gift figures are marigold too ("77 this run, 507
  to spend" beside its word Gifts; a mission's "25 gifts"; the ladder's prize), and a sled still to buy says "The Comet
  Bob: 600 gifts, 93 more to go." as the garage says what a piece waits on (it said "93 gifts to go of 600"). The
  garage's own screens were not touched (G6 had already drawn them in marigold).
- After the first critic (3c97c10): it found them all marigold but "drawn four ways": the glyph missing in Details, and
  on the results and the door a double gap between the figure and its word (the figure and its word were two flex items
  with a no-break space between them, and the flex gap too: "+77  gifts"). The figure and its word are one run now, and
  Details' gift figures wear the glyph (`results.ts giftsN`). The second critic did not raise it (it noted only the
  garage's grey "to spend" after its marigold figure, G6's and left).

### 3. The curly apostrophe drawn like an acute accent in italic 900

- What it was (`apostrophe/specimen.png`, row one): Windows' system font (Segoe UI, Chrome's `system-ui` here) draws
  U+2019 at 700 as a comma, but at 800 and 900 (its Black face, which the UI's 800 also lands on) as a thin slanted wedge
  high on the line: "Crane´s", "TODAY´S". U+02BC is the same wedge (row two) and kerns worse.
- The fix (`tokens.css`): an `@font-face` family, GS Apostrophe, that covers U+2019 alone (`unicode-range`) from installed
  faces by `local()`: Arial at 100 to 649, Arial Bold at 650 to 799, Arial Black (else Arial Bold) at 800 to 1000, with
  `font-display: swap`; it leads `--font`, and the UI root (`style.css .gs-ui`) now takes `var(--font)`. Nothing is
  shipped (no font file) and nothing loads before the first frame: a local face is looked up when the character is
  first drawn. Synthetic italic slants it with its words. The specimen compared eleven candidates; Arial's comma reads as
  an apostrophe at every weight and in italic, Calibri and Georgia did too, Tahoma, Verdana, Trebuchet, Bahnschrift and
  Segoe UI Variable kept a wedge.
- After (`after/desk-mid-50-title.png`, `phone-mid-50-title.png`: "the Crane’s Memory charm"; Details' and the results'
  "TODAY’S DAILY"; the rooms' "Today’s Daily"): a comma at every weight.
- What I can check and what I cannot: seen only on this machine's Windows 11 Chrome (headless). macOS ships Arial, Arial
  Bold and Arial Black, so there the apostrophe would also come from Arial (a comma; its own SF Pro draws one too, I
  believe, but I have not seen either). iOS ships Arial and Arial Bold (Arial Black I am not sure of; the src list falls
  back to Arial Bold, then to the system font). Android has no Arial: the character falls through to Roboto as today,
  whose heavy apostrophe I have not seen. Canvas text (`render/labels.ts`, the photo's run card in `game/photoshoot.ts`)
  names its own family and is not covered; it is render's and the game's, not this lane's.

### 4. The results' fact chip far from its headline on a phone

- Before (`before/phone-mid-5-results.png`, `phone-mid-50-results.png`; the ui lane's `phone-mid-5-results-crash.png`):
  on a phone `sequence.ts` moved the fact into the column at the foot of the screen, so the rider stood between it and the
  figure it explains.
- After (`after/phone-mid-5-results.png`, `phone-mid-50-results.png`, `phone-mid-100-results.png`; `look2/phone-h-wreck.png`,
  `phone-h-crowned.png`, `phone-h-duel-lost.png`): the fact stands beside the figure on a phone as on a desk, inside the
  headline's rule, clear of the rider's head (`story.css`: with a fact the moment spans the gutters, the figure a step
  smaller, 17vw against 19vw, the fact at the small size in up to three balanced lines). The JS branch on the phone's
  aspect is gone, so a phone turned after the results opened lays it out right too. The worst case, a wreck's "3,212 m"
  beside "Hugged a tree, 1,288 m from the line", is three lines within the figure's height.

### 5. The quiet line at ten words

- Before: "1,281 XP to Rider Rank 26: the Crane's Memory charm" (ten); a locked chip pressed said "The Old Run: pass 3 more
  ghosts to open it" (ten).
- After: "1,281 XP to the Crane’s Memory charm" (seven): how far and the prize, what the line is for; the Progress door's
  room names Rider Rank whole. Every page of the Almanac is nine words at most (`tests/r9words.test.ts`, the longest
  "2,799 XP to every leg of the Long Night"). A locked chip pressed says the line's own sentence for that mountain ("3
  more ghosts open The Old Run", "Beat 9 more of The Twelve to open Lanternfall"), so the line has one voice.

### 6. Quiet and secondary buttons read alike

- Before: secondary an 86% ink pill with a 1 px edge at 20%; quiet a 55% ink wash with a 1 px edge at 10%. On a dark
  scene or the sheets' ink both read as dark pills with a faint ring (`before/phone-mid-5-results.png`: Home, Photo, Watch
  Ad and Details alike).
- After (`tokens.css`): secondary wears a 1.5 px edge at 42% (`--edge-secondary`); quiet keeps only its 10% hairline
  (no off-white ring, no drop shadow), its words a soft ink halo, its hover a darker wash. Three ranks at a glance: a vermillion fill; an ink pill ringed in
  off-white; a wash with words (`after/phone-mid-5-results.png`, `desk-mid-50-pause.png`, the rooms' Close against
  their Choose). A first try thinned quiet's wash to 42%; over white snow its words fell to about 2.4:1 (computed), so the
  wash stayed at the base's 55%. With no hairline at all (681a6e3) the first critic found Home and Photo "nearly vanish"
  on the phone's dark results, "loose labels", and the medal wall's and album's rows (quiet buttons) visible only where
  they crossed bright scene; the hairline came back (3c97c10). It also found Photo quiet on the results but secondary on
  the pause card: Photo is secondary on both now, Home alone quiet (`sequence.ts`). The second critic named "ink
  hairline pills for secondaries, and a quieter pill for Home, Close and Back" and raised neither.

### 7. The phone's doors read as tiles

- Before (`before/phone-mid-50-title.png`): four to a row, each 62 px tall with its glyph stacked over its words.
- After (`after/phone-mid-50-title.png`): the kit's pills, two by two, each 44 px with its glyph beside its words and the
  figure it wears under them, as the desk draws them. "Daily and Cup" as every screen says it ("Daily & Cup" kept only
  under 340 px): 681a6e3 had put "Daily & Cup" back for the word count, and the first critic read the two spellings as
  two names. The quiet line now fits one line and the
  gaps above the doors and the line are a step tighter, so the picker starts where it did (about 418 px down against 420).

### 8. The hour's swatches on Ember near the same brown; Mirrored read as a third option of the hour's pair

- Before (`before/desk-mid-50-title-ember.png`, `phone-mid-50-title-ember.png`): two 14 px discs of the sky's zenith over
  its horizon, Ember's day and night both dark brown; Mirrored a third pill of the same make beside the pair.
- After (`after/*-mid-50-title-ember.png`, `look2/desk-mid-100-title.png`): each swatch (18 px) carries the light its hour
  rides by, drawn by name (`title.ts hourLight`): the sun for Day and Noon, a low sun for Dusk and the Evening, a crescent
  moon for Night and Moonrise, a glow under the range for First Light, two lamps for Lamplight; pale warm or moon-white,
  never marigold. Mirrored is a switch with its word (`role="switch"`, `aria-checked`), the kit's switch at a smaller
  size, a quiet wash with no edge beside the hour's ringed pair, so it reads as on or off and not as a third hour.

### 9. The two the U4 critic left

- The medal discs' legend (`after/*-mid-50-medals.png`, `look3/desk-mid-100-medals.png`): "Stages" stands over the three
  stage discs and "Run" over the larger, at the head of the column; the week's Cup and Trial discs sit in the Run column.
  The line at the top now says what the wall holds ("Each mountain’s place on its ladder, its medals and its stars. A row
  opens its board.").
- The album's contents (`after/*-mid-50-album.png`, `look3/*-album.png`): each page's row wears one of its stickers as the
  page draws it, a frame from its run where one was kept (none on the fixtures), else its sky, the sticker's kind on a
  small ink disc in the corner; a page with none found is dimmed. After the first critic the kind's glyph marks only a
  frame (over a painted sky it was the same star on every mountain, the Charms page's glyph), and after the second the
  rows are cards as the medal wall's rows are (they were pills, "list rows drawn three ways"). On the fixtures, which keep
  no frames, the rows look as they did, dimmed where none is found.

## The bars, measured (27 November)

Through `r9-truth.js` on this worktree's dev server: the titles (mid-5, mid-50, mid-100, novice-50) on the base at
894859b (`bars/before/`) and on mine (`bars/after/`), and the results (first finish, crash, the duel won and the Daily at
mid-20) on mine; counted by `r9-screenbars.ts`. Words exclude the dev build's mock ad offers.

| Screen | Desk base | Desk mine | Phone base | Phone mine |
| --- | --- | --- | --- | --- |
| Title, mid-5 | 35 | 35 | 33 | 34 |
| Title, mid-50 (bar 40) | **42** | **39** | 40 | **38** |
| Title, mid-100 | 42 | 39 | 40 | 38 |
| Title, novice-50 (bar 40) | **42** | **42** | 40 | 41 |
| Results, first finish (bar 35) | (32, the ui lane's) | 32 | (31) | 31 |
| Results, crash | (32) | 27 | (31) | 26 |
| Results, the duel won | (30) | 35 | (29) | 34 |
| Results, the Daily | (26) | 26 | (25) | 25 |

- The base had slipped past the run-50 bar on a desk (42: the picker grew to seven chips, "Old Run" two words, and the
  quiet line was ten); mine meets it, 39 and 38. The novice-50 title stays at 42 on a desk: its quiet line is The
  Twelve's ("Beat 9 more of The Twelve to open Lanternfall", nine words, unchanged) and its chips seven; Gablefall's chip
  will add one more word to every title. For the main lane.
- The phone's figures for mine are with "Daily and Cup" on the door, as it ships (3c97c10 put it back after 681a6e3
  had tried "Daily & Cup", one word less); novice-50 on a phone is 41 against the base's 40 for that one word.
- The results' words do not change with this lane (the fact moved, no words added); their figures differ from the ui
  lane's by the fixtures' runs (the crash is shorter on this save, the duel names a longer rider). Every one under 35.
- One primary on every screen, no look-alikes, no lone icons, no bare figures, nothing loading (the detectors'
  sections all clear); the only repeat on a title is novice-50's "Lanternfall" on its chip and in the line, as before.

## web-design-guidelines (the Vercel Web Interface Guidelines, fetched 27 November)

Read against this lane's hunks in `tokens.css`, `kit9.css`, `screens.css`, `story.css`, `rooms.css`, `books.css`,
`title.ts`, `results.ts`, `sequence.ts`, `rooms.ts`, `books.ts`.

- Fixed on the way: Details' sticky button could stand over a focused control in Keep This Run (sticky UI hiding focus);
  the foot of its own ends that. The apostrophe's faces take `font-display: swap`. Quiet's thinner wash was turned back
  for contrast on snow (item 6).
- Clean: the mirror is `role="switch"` with `aria-checked` and a name that holds its visible word ("Ride Ember Peak
  mirrored"); the swatches, the door's gift glyph and the medal key are `aria-hidden` (the rows and doors say the same in
  words); an album row's frame has its width and height, `loading="lazy"` and an empty alt inside a hidden art; every
  figure through `fmt` (Intl) with a no-break space before its word; focus rings `:focus-visible` as the kit's; motion is
  the kit's tokens, zero under reduced motion (the mirror's knob); no `transition: all`; every control at least 44 px;
  hover states on quiet (a darker wash) and secondary as before; the fact's lines balanced.
- Not taken: none.

## Every hunk in a shared file (against round-9 at 894859b)

None in `app.ts`, `save.ts`, `spineview.ts`, `menus.ts`, `ui.ts` or `contract.ts`: every fault was in the screens' own
files. The files touched, all the screens' (the ui lane's `title.ts`, `results.ts`, `sequence.ts`, `story.css`,
`screens.css`, `tokens.css`, `kit9.css`; U4's `rooms.ts`, `rooms.css`, `books.ts`, `books.css`), and one line in
`style.css` (the UI root's family is `var(--font)`). Not touched: `src/ui/art.ts`, the mountain card in `contract.ts`,
`src/render`, `src/sim`, `src/bot`, the garage's own screens (`garage.ts`, `garage.css`), the picker. Tests:
`tests/r9words.test.ts` (the quiet line's new words, a locked chip's sentence, nine words on every page). Scripts: new
`scripts/playtest/r9-polish-look.sh`.

## Text for ART.md (the main lane edits it)

**ART.md 10, "The title has one job at a time"**: "under Ride, once open, the picked mountain's hour (each half with a
swatch of its sky) and its mirror" becomes "under Ride, once open, the picked mountain's hour (each half with a swatch of
its sky and the light it rides by: the sun, a low sun, the moon, a glow under the range, lamps) and its mirror, a switch
with its word apart from the hour's pair"; "one quiet line of what you are working toward (a glyph and at most nine
words: the next mountain by ghosts, Lanternfall by The Twelve, else the next Rider Rank named as a prize)" gets ", how
far and the prize, '1,281 XP to the Crane’s Memory charm'; a locked chip pressed says the same sentence for its
mountain, '3 more ghosts open The Old Run'"; "Garage (wearing the gifts, "90 gifts")" becomes "Garage (wearing the gifts
as the results and the garage draw them: the glyph and "90 gifts" in marigold)"; and after the doors: "On a phone the
doors are the same pills, two by two."

**ART.md 10, "The results are three beats"**: "then one fact on an ink chip that keeps inside the headline's rule, clear
of the rider" gets "(beside the figure, on a phone as on a desk)"; "Everything else is Details, one level down, a sheet
from the column's side" gets ", the same one button in its own foot under the list".

**ART.md 10, "One system"**: "three button ranks with words on every one (primary vermillion, one a screen and always the
run; secondary an ink pill with a hairline; quiet a thin ink wash)" becomes "three button ranks with words on every one,
told apart at a glance (primary a vermillion fill, one a screen and always the run; secondary an ink pill ringed in
off-white; quiet a thin ink wash with only a faint hairline)"; and Photo is secondary wherever it stands (the results,
the pause card), Home quiet. Add: "A gift figure is marigold with its word wherever it stands (the
results, the garage, the Garage door, Details). The curly apostrophe is drawn from a face that keeps it a comma at 800
and 900 (an installed Arial, by `local()` and a `unicode-range`; Windows' system font draws it there as a wedge that
reads as an acute accent); never a straight quote."

**ART.md 10, "The pause card"**: add "its ink whole, so nothing of the run reads through it".

**ART.md 10, "The books"** and **"A mountain's mastery board"**: the medal wall: "every mountain a row (its ladder place,
its discs and its stars), 'Stages' and 'Run' over the discs' column"; the album: "a page a row, each wearing one of its
stickers (a frame from its run, else its sky, its kind's glyph in the corner)".

## Text for DECISIONS (the main lane's to write)

> **The screens' carried faults, fixed** (`r9-polish`, `notes/r9-polish.md`; frames under `shots/r9/polish/`).
> - *Details* holds its one button in a foot of its own, under the list it ends: held sticky over the scrolling list it
>   stood over the last rows.
> - *One gift figure*: the Garage door wears the gifts as the results and the garage draw them (glyph, figure, word, in
>   marigold); Details' gift figures are marigold too.
> - *The apostrophe*: U+2019 is drawn from an installed Arial (`local()`, `unicode-range`), a comma at every weight;
>   Windows' system font drew it at 800 and 900 as an acute accent. Seen on Windows only; Android falls through to Roboto.
> - *The phone's results*: the fact stands beside the figure, inside the headline's rule, as on a desk.
> - *The quiet line*: "1,281 XP to the Crane’s Memory charm", nine words at most on every page (a test holds it); a
>   locked chip says the line's sentence for its mountain.
> - *Three ranks at a glance*: secondary ringed in off-white, quiet a wash with only a faint hairline; Photo secondary
>   on the results as on the pause card.
> - *The phone's doors* are pills two by two; *the hour's swatches* carry their light; *Mirrored* is a switch.
> - *The medal wall's discs* have "Stages" and "Run" over their column; *the album's contents* wear a sticker a row.
> - *The bars*: the run-50 title 39 words on a desk and 38 on a phone (the base had slipped to 42 on a desk with seven
>   chips and a ten-word line); novice-50 stays at 42 on a desk (The Twelve's line and seven chips).
> - *Judged blind:* two family tests, "mostly yes" both; none of the nine listed faults raised by the second. The first
>   critic's worst, fixed: the pause card's ink whole (the run's callouts read through it on a phone), a sheet's first
>   line clear of its top fade; the second's: the album's rows cards, the Almanac's next rank on its column.

## What only scripts have seen

- Everything here on the fixtures (`?debug&save=mid-5`, `mid-50`, `mid-100`, `novice-50`, `mid-20`) and the UI harness's
  results (`ui-harness.html?s=results-wreck-medal` and others), headless Chrome on Windows, a desk at 1280 x 720 and a
  phone at 390 x 844. No person has looked at any of it.
- The apostrophe on macOS, iOS and Android: not seen (item 3 says what each should do and why).
- An album row with a real frame from a run: the fixtures keep none, so every row showed its sky and a glyph; the frame's
  own look in a row (64 x 44, cover, its glyph in the corner) is read from the code.
- The mirror switched on: every capture had it off; its on state (the kit's switch filled off-white, the knob ink) is
  the settings switches' look at a smaller size, read from the CSS.
- A phone turned while the results are up (the fact now laid out by CSS alone): not exercised.
- Reduced motion: the mirror's knob moves on a kit token that is zero under it; read from the CSS.
- The pad, touch and a screen reader on the new mirror switch and the doors: not exercised (the controls are the kit's
  buttons, with the same focus keys).

## What the main lane must decide

1. **The quiet line names the prize, not the rank** ("1,281 XP to the Crane’s Memory charm"): nine words at most on every
   page; the rank is said in the Progress room. Or keep "Rider Rank 26" and drop the prize's article and kind (not
   proposed: the prize is what the line is for).
2. **The apostrophe from Arial** (`local()` only, U+2019 alone): Windows checked; macOS and iOS take Arial's comma too;
   Android unchanged. ART.md 10 would say it (text above).
3. **Secondary wears a stronger ring, quiet keeps its faint one** (tokens.css): every secondary button in the game changes
   a little. Photo is secondary on the results as on the pause card.
4. **The phone's doors two by two** take about 44 px more than one row of tiles; the line on one row and two tighter gaps
   give it back (the picker starts where it did). The rider stands just over the picker on the Ember title, as before.
5. **The novice-50 title is 42 words on a desk** (the base's too): The Twelve's quiet line (nine words) and seven chips;
   Gablefall's chip adds one word to every title. Accept, or shorten The Twelve's line ("Beat 9 more of The Twelve to
   open Lanternfall") at the cost of its plain sentence.
6. **The critics' faults fixed beyond the list** (3c97c10, fe066a7; all in the kit or the rooms and books, none in a
   shared file): the pause card's ink is whole (at the sheets' 94% the run's callouts showed through on a phone); a
   sheet's body starts under its top fade, so its first line is no longer greyed before any scroll; a medal disc keeps
   its word on one line; the album's rows are cards; the Almanac's next rank keeps its words on the column; a sheet's
   Close ends on its body's edge. Keep them, or take them out to the feel pass.
7. **Left by both critics, for the main lane or the lanes that own them** (the family test section lists them): the
   picked chip no larger once the picker is two rows of four (against ART.md 10's "the picked one larger"); Resume's
   P a round cap; the results' time upright and small; the Long Night's "6 legs: every mountain" beside seven
   mountains; the album's counts (243 of 248 in its rows); the medal discs small on a desk; clipping in the garage's
   strip and at a scrolled sheet's head.
8. **Found, not on the list, not changed:** on a phone's first visit the labelled Sound On sits over the logo's last
   letter (`before/` has no fresh frame; the ui lane's `shots/r9/ui/final/phone-fresh-title.png` shows it too). Move it
   under the tagline on a phone, or leave it for the feel pass.

## The family test (blind, `model: opus`, `effort: xhigh`, given only ART.md and the frames)

**Critic 1 (27 November, seed 23; `family/`, 24 frames from `after/` at 681a6e3, the key in `keys/family.json`).** The
title (Ember and Lanternfall), the results and Details, the Daily and Cup and Progress rooms, the Almanac, the album's
contents, the medal wall, settings, the pause card and the garage, on a desk and a phone, shuffled. Asked whether they
read as one family, a score a frame with the one thing to press, and every fault worst first. Never told what changed.

- **"Mostly yes"**: one type, one ink sheet on a common left edge, one pill family (a vermillion primary with ink words
  and its reason, secondary pills with a hairline, quiet Close and Back), the roles held everywhere ("Nothing breaks the
  colour roles outright. I saw no em dashes and no emoji"). "None of these is a different visual language. They are a kit
  applied unevenly."
- **Scores, against U4's second family test (critic 4) and G6's:**

| Frame | U4 (critic 4) | G6 | Mine, desk | Mine, phone |
| --- | --- | --- | --- | --- |
| The title | 9 (desk, run 50), 8 (phone) | | 8.5 (Ember), 8 (Lanternfall) | 7.5 |
| The results | 7 | | 7 | 7, 7 |
| Details | 7 (with the results) | | 7.5 | 7.5 |
| Daily and Cup | | | 8.5 | 8 |
| Progress | 9 | | 7.5 | 7 |
| The Almanac | 8, 8 | | 7.5 | 8 |
| The album's contents | 8 | | 7 | 7.5 |
| The medal wall | (critic 2: 7) | | 7 | 8.5 |
| Settings | 7 (desk), 8 (phone) | | 8.5 | 8.5 |
| The pause card | 9 (desk), 8 (phone) | | 6.5 | 6 |
| The garage | 7, 6 | 7 to 8 | 7.5 | 6.5 |

  This critic was the most exacting of the round's (23 numbered faults, most of them not on any list before); the
  frames it scored lowest were for faults that predate this lane (the pause card's ink, the first line under every
  sheet's top fade), fixed after it (below).
- **The listed faults, raised again or not:**
  1. Details' button over its rows: **not raised** (it noted a row cut under the head of a scrolled sheet, the fade's
     job, a separate thing).
  2. The gift figure: **raised again, differently**: all marigold now, but "drawn four ways": the glyph missing in
     Details, a double gap between figure and word on the results ("+77  gifts") and the door, the garage's grey "to
     spend". Fixed after (3c97c10): figure and word in one run, the glyph on Details' too; the garage's "to spend" is
     G6's and left.
  3. The apostrophe: **not raised.**
  4. The phone's fact chip: **not raised.**
  5. The quiet line at ten words: **not raised.**
  6. Quiet and secondary alike: **not raised as alike**; raised instead as ranks that change with the screen (Photo quiet on
     the results, secondary on the pause card; the dev build's mock "Watch Ad" secondary above a quiet Home) and quiet
     Home and Photo "nearly vanish" on the phone's dark results. Fixed after: quiet keeps a faint hairline (no off-white
     ring), Photo is secondary on the results as on the pause card.
  7. The phone's doors as tiles: **not raised**; "Daily & Cup" against "Daily and Cup" was (the phone says "Daily and
     Cup" now).
  8. The hour's swatches and Mirrored: **not raised.**
  9. The medal legend: raised as small on a desk (the 11 px discs and the key at the small size); the album's star badge
     on every mountain read as the Charms page's glyph (the badge now only marks a frame).
- **Its worst faults not on the list, and what became of them (3c97c10):** the pause card showed the run's callouts and
  chips through its 94% ink on a phone ("Slipstream", a ghost's "1 m"): the card's ink is whole now. A top fade greyed
  the first line of every sheet before any scroll ("Your Flame: 13 Days", "Rider Rank 25", "SOUND"): the body starts
  under the fade. A medal disc ended one line with "Silver this week." on the next: disc and word never part.
- **Left for the main lane (not this lane's, or a call):** the picked chip not larger once the picker is two rows
  (ART.md 10 says the picked one is larger; the ui lane's rows of four make every chip one size); the desk pause card a
  short card while every other sheet is full height (U4's choice); Resume's "P" drawn as a round cap, the pad's shape
  (ART.md 10 keeps round caps for face buttons); the results' time upright and small beside the italic word (ART.md 10
  says the place, its word and the time in italic 900); the Long Night's "6 legs: every mountain back to back" beside
  seven mountains; "Division 5 of 5, the first"; "Suki Ember on Ember Peak, Suki Ember" (two stickers that read as one);
  the album's counts (its rows sum to 243 of 248); today's flame chip drawn white while "Lit today"; the Almanac's next
  rank indented off its column; the garage's tiles clipped at the strip's edge on a phone, a gap under "Balanced classic";
  full stops on contracts but not on missions; the star glyph for charms, flourishes and stars alike.

**Critic 2, the family test again after the fixes (27 November, seed 31; `family2/`, the same 24 shots from `after2/` at
3c97c10, the key in `keys/family2.json`; the same question).** "Mostly yes": one type, one ink sheet with an 18 px corner
from the logo's side (the bottom on a phone), "one vermillion primary per screen, ink hairline pills for secondaries,
and a quieter pill for Home, Close and Back", the roles held, no emoji and no em dash.

| Frame | Critic 1, desk | Critic 2, desk | Critic 1, phone | Critic 2, phone |
| --- | --- | --- | --- | --- |
| The title | 8.5, 8 | 8, 8 | 7.5 | 8 |
| The results | 7 | 7 | 7, 7 | 7.5, 8 |
| Details | 7.5 | 7.5 | 7.5 | 7.5 |
| Daily and Cup | 8.5 | 8 | 8 | 7.5 |
| Progress | 7.5 | 8.5 | 7 | 8 |
| The Almanac | 7.5 | 7 | 8 | 7.5 |
| The album's contents | 7 | 7.5 | 7.5 | 8 |
| The medal wall | 7 | 8 | 8.5 | 8 |
| Settings | 8.5 | 8.5 | 8.5 | 8.5 |
| The pause card | 6.5 | 7 | 6 | 8 |
| The garage | 7.5 | 8 | 6.5 | 7 |

- None of the nine listed faults was raised (the gift figure, the ranks, the apostrophe, the phone's fact, the quiet
  line, the doors, the swatches and the mirror, Details' foot); the medal discs were called small again (about 10 px,
  U4's discs) and the Cup's disc under the Run column read to it as a run medal (it is the week's one medal).
- The pause card's bleed and the greyed first lines were not raised again. Its worst: list rows drawn three ways (the
  album's rows pills, the medal wall's cards, the Almanac's next rank a pill on a phone and a card on a desk); keycaps
  three ways (Space a pill, the pause card's P a round cap, the HUD's E a rounded square); the primary's white ring on
  some frames (the capture's keyboard focus: the look script presses by focusing, so the focus ring shows; not a fault of
  the rest state); "Watch Ad" (the dev build's mock); 731 against 751 XP on Details (two pinned runs of one fixture, not
  one frame); the HUD's gap chip "10 m" with no word (canvas labels, render's); clipping (the garage's strip, a scrolled
  Almanac row, the album's last row); the picked chip not larger; the flame's "13 Days" over seven day chips; a
  mountain's name italic in the album, upright on the wall; Close standing 8 px past the body's right edge.
- Fixed after it (the last commit): the album's rows are cards as the wall's are; the Almanac's next rank keeps its
  words on the column (the band reaches out past it, the first critic's fault too); a sheet's Close or Back ends on the
  body's right edge (the garage's head, whose rows keep its edge, left as it was). Seen in `look5/`.
