# Round 7, the screens lane: notes for the main lane to fold in

Branch `r7-screens`, cut from `round-7` at 2c05cfe. No sim change: nothing in `src/sim` or `src/bot` is
touched, no pool is regenerated, and a run rides exactly as it did. `npx tsc --noEmit` is clean and `npm test`
passes (73 files; the two new ones are `tests/twelve.test.ts`, 27 tests, and `tests/moment.test.ts`, 12).

Design read (the `design-taste-frontend` skill asks for one): a redesign that preserves, for players, in a
key-art poster language, inside the project's own DOM and CSS system (ART.md 10). Dials about 7 variance, 7
motion, 4 density. No framework, font or icon set was added: the skill's stack defaults (React, Tailwind, an
icon library) do not apply to this codebase, and its rules that do apply (one accent, one radius system, no em
dashes, motion with a reason, reduced motion, no invented numbers) were held.

## Decisions (numbered from 278; renumber as you fold them in)

278. **The Twelve is a field with one promised record in it, and progress is two optional fields.**
    (`src/game/twelve.ts`, pure.) A duel is a normal run on the next rider's home mountain. Their real pool
    record on that mountain is passed to `pickField` as `promised`, the mechanism Run Again already uses, so it
    rides whatever the mood and is the run's named rival; you beat them by reaching the line ahead of their
    time (`duelWon`: a wreck never wins one). The save gains `twelve?: { beaten: string[]; crowned?: boolean }`,
    read by `readTwelve` (unknown keys and repeats dropped, a crown without the King dropped), written only
    once somebody has fallen, so an older save loads unchanged. *A player feels:* "Three more and I get the
    King." *Shown by:* `tests/twelve.test.ts`: for all twelve riders and five paces from a first run to 400 s
    the field holds exactly that rider's record once, as the one rival; a walk of the ladder with every
    mountain open visits all twelve in order and ends at the last race; a second settle of the same run beats
    nobody twice. In the browser a hands-off run on Pinecrest with Rosa, Bram and Pip beaten rode a field of
    Pete_on_Tour, Rosa Quill, Juno Vale (rival), Old Wren and Bram Oakhollow, finished 4th of 6 in 2:27.3,
    and the card read "Juno Vale held you off by 12.8 s." with Run Again as "Rematch Juno Vale"; the save was
    unchanged. Rejected: a separate duel mode with a field of one (an empty mountain is a worse race than the
    one the player already knows, and a second mode is a second thing to teach); counting any run in which
    you happened to finish ahead of a rider (the duel would never be announced, so it would never be a
    moment).

279. **The ladder is gentlest first by the roster's own skill, and the next duel is the gentlest unbeaten
    rider whose home is open.** The order is Rosa Quill, Bram Oakhollow, Pip Thistle, Juno Vale, Nessa Lumen,
    Tavi Rook, Old Wren, Kaito Mori, Ivo Crag, Suki Ember, Mila Frost, The Hollow King. Strictly in that order
    a new player could not start (Rosa's home is Sakura Ridge, 24 ghosts away), so a rider whose mountain is
    still locked waits without blocking the ones you can reach: a new player duels Bram, then Juno, then
    Wren on Pinecrest, and Pip the moment Frostfang opens. With every reachable rider beaten the card names
    who waits and what opens them ("Rosa Quill. Waits on Sakura Ridge. Pass 15 more ghosts"). *A player
    feels:* there is always one name to go and beat, from the second run on. *Shown by:* the `the next duel`
    tests. Rejected: ordering by the pools' home times (see "What the main lane must decide", 1: today's
    times do not follow skill, and an order that moved whenever the pools are re-ridden would not be a
    story); letting each mountain run its own duel at once ("one duel at a time" is the brief, and one name
    on the title is clearer than five).

280. **Lanternfall opens by The Twelve, not by 48 passes.** `mountainOpen` is the one rule: the finale opens
    when the eleven others have fallen, every other mountain by ghosts passed as before. The ghost ladder
    (`progress.ts` `nextUnlock`, `unlockCrossed`, `unlockTease`, the director's `unlockLadder`) no longer
    names the finale, so nothing promises it for passes. The locked card reads "Beat 9 more of The Twelve",
    the eleventh win puts Lanternfall's unlock card on that run's results, and `?debug&m=4` still opens it in
    dev. After the King falls there the next run on Lanternfall is the last race: all twelve on their real
    Lanternfall records (`finalField`, quickest first, the King the rival) and your best; it is won only
    ahead of every one of them, pays 200 gifts and sets `crowned`. A rider pays 40 when they fall, once.
    *Shown by:* the `Lanternfall opens by The Twelve` and `the last race` tests. Not ridden in the browser:
    the last race needs eleven duels won first (the harness shows its card and its results).

281. **The Twelve has a home on the title, a line as the run starts and a moment on the results.** The
    title's card shows the next rider's bust (twelve hat silhouettes drawn in `art.ts`, each a different
    outline, trimmed in the rider's own colour), their name, their home mountain and time to beat, and a
    line of their character; pressing it travels the title to their mountain, where Ride becomes "Duel" with
    their name under it. The count beside it ("3 of 12") opens the ladder: all twelve, gentlest first, with
    who is beaten (struck through), who rides now (their colour, "Rides now" or a Go button) and whose
    mountain is locked. As a duel starts a toast says who and what time ("Duel: Juno Vale. Finish ahead of
    2:14.5 on Pinecrest"), after the reveal card when there is one. On the results the news is the card's
    one race line (so the phone's line budget, C6, is unchanged), the rider has the last word in the quote
    slot, and a rider who fell is the moment's fact with their bust tipping over. On a phone the card is a
    slim row above Ride and takes the greeting's place there.

282. **The title is one composed shot a mountain, staged with the reel it already had.** (`src/game/keyart.ts`.)
    Each mountain has a `TitleShot`: the stretch of its course the reel rides, the time of the colour script
    the light is read at, and a lens for a wide screen and a tall one (distance, height, the sweep it rests
    at and how far it drifts, the look point, the crane's reach, where the hero is held). The reel, its duel
    partner and the camera's title modes are the ones that were there: the app moves the reel's window to
    the shot's metres and sets `world.journeyAt`; `camera.ts` reads the lens where it used constants.
    Pinecrest rides Old Town's lamplit street at gold and out over the Valley Leap; Frostfang the Crevasse
    Fields under the aurora with the Fang ahead; Ember its run-in with the cone under the smoke deck; Sakura
    the last orchards and the Blossom Leap; Lanternfall the Crown. A Daily and a Cup keep the plain reel
    (their courses are built from a seed). The mountain's name and the feeling ART.md 15 gives it sit under
    the logo in place of the tagline for a returning player. *A player feels:* picking a mountain shows you
    that mountain. *Shown by:* `shots/r7/screens/desk-02-title-*.png` and `phone-02-title-*.png`, five
    different pictures where round 6 had one lodge. Rejected: a still lens at a vista with riders passing
    through (a rider crosses it in two seconds and the frame stands empty); a posed, motionless rider (reads
    as a screenshot, not a living title).

283. **Moving between mountains is a designed cut.** A veil in the new place's own air (a cobalt to gold
    gradient for Pinecrest, night teal for Frostfang, plum to orange for Ember, wine to blossom for Sakura,
    indigo to marigold for Lanternfall) sweeps over the scene from the logo's side in 260 ms, the app builds
    the new mountain under it, the place's name and line hold on it, and it sweeps on off the far edge. The
    controls stay where they are, above it. It also hides the world's rebuild, which used to show as a
    frozen frame. When the reel cuts back to the start of its shot a short dip of ink covers the cut. Reduced
    motion: the mountain changes at once and there is no dip.

284. **The results lead with the moment; the card follows as the detail.** `resultsMoment` reads the model
    into one of four endings, each with its own words and entrance over the scene beside the card (above it
    on a phone): a win ("1st", "First down the mountain", gold-white, slams in over a burst of rays that
    settles), a podium (rises onto a silver step), a finish ("Across the line", sweeps in from the side), a
    wreck (the distance, "Wiped out", drops and stays a little crooked). Under it the fact that made the
    run, by rank: a rider of The Twelve beaten or the crown, a new best and how much quicker, the ladder's
    own moment, a duel lost and by how much, a medal, a new best score. The card keeps every line it had and
    its own beats: `RESULTS_TIMING` and the sound cues are unchanged, because the moment starts on the same
    frame as the card and adds no delay to it. *Shown by:* `tests/moment.test.ts`, and
    `desk-08-results*.png`, `h-desk-results-*.png`. The moment is hidden from readers (the card says all of
    it) and on a small landscape screen, where the card fills the view.

285. **Screens move the way they are built.** Title to run: the column leaves off the logo's side, the cards
    off theirs, Ride last and forward, inside the 220 ms the layer already took. Results to the next run:
    the moment off its side, the card off its own (down on a phone). The garage's contents step in after the
    sheet and it sinks back out. Ride and Run Again lean their play glyph into the pointer and one light
    crosses Ride once as the title lands; a mountain card rises and its art breathes in; a picked card's
    check pops. Everything is transform and opacity, nothing loops, and every one of them is off under
    reduced motion.

286. **Pause and loading are in the same language.** "Paused" is set like the wordmark (italic 900, the
    ghosts' mint under it, a runner drawn beneath), over the title's own diagonal scrim instead of a flat
    one, and the card comes in from the logo's side. The loading screen is the wordmark with its runner as
    the bar (inline CSS in `index.html`, no asset, about 600 bytes more), and the in-game loading bar is
    round-ended with mint under it.

## Cost

- **First frame.** Navigation to the title's first animation frame, three loads each on the built game,
  headless, High, with the other lanes running: Pinecrest (staged 3,640 m down its course) 820, 951, 961 ms;
  Ember (staged at its start, as every title was) 878, 906, 854 ms. Staging the reel down the course costs
  nothing that shows above the noise. Nothing new loads before the first frame: the busts are inline SVG
  strings built when the card renders, and there is no new image, font or request.
- **Frame.** No new draw call or triangle: the world is the run's own world at another metre. The DOM gains a
  veil (hidden except while crossing), a dip layer and the Twelve's card on the title, and the moment on the
  results. I did not measure frames per second (seven lanes share the machine).
- **Size.** `screens.css` is 29 kB raw; `twelve.ts` and `keyart.ts` 17 kB of source. The built CSS is 160 kB
  and the main chunk 2,425 kB (801 kB gzip) on this branch; I have no number for the base build.

## ART.md text

Add to section 10 (UI):

> - **The title is the picked mountain's key art.** Each mountain has one composed shot (`game/keyart.ts`):
>   where its reel rides, the colour script's time and where the lens sits. The logo and the controls keep the
>   left of a wide screen and the top and bottom of a tall one; the hero is held right of centre (54 to 60%
>   of the width) and the mountain's landmark stands in the sky over its shoulder. The mountain's name and
>   its feeling sit under the logo. Moving between mountains is a veil in the new place's own air, never a
>   swap.
> - **The Twelve wear their own colours.** A signature rider's bust is a glass-pale head and shoulders under
>   the hat that names them, trimmed in the rider's accent; that accent is also the hairline of their card
>   and the colour of their name. It is theirs alone: it is never used for an action.
> - **The results lead with the moment.** One figure and one line in italic 900 over the scene: gold-white for
>   a win (your best's colour), a silver step for a podium, off-white for a finish, off-white and a little
>   crooked for a wreck. The card beside it is the detail. Vermillion stays on Run Again.
> - **Motion has a direction.** A screen leaves the way it is built: the logo's column off the logo's side,
>   the cards off theirs, the primary button forward. Transform and opacity only, nothing loops, and reduced
>   motion keeps every beat and drops the movement.

## README

Add under the feature list:

> **The Twelve.** Twelve signature riders, each with a home mountain. Beat them one duel at a time, gentlest
> first: a duel is a run on their home ground with their real record as your rival, won by reaching the line
> ahead of their time. The title shows who is next and the full ladder. Eleven open Lanternfall, where The
> Hollow King waits, and after him one last race against all twelve at once.

Dev switches to add to the table: `?debug&m=0..4&kz=3700&kto=4200&kl=3500&kr=6&ku=2&ks=0.4&kd=0.1&ka=30&kh=1&kc=0.3&kx=0.08&ky=0.2`
composes a title shot in the browser without a rebuild (`keyart.ts` `devShot`: the reel's first and last
metre, the light's metre, then the lens of whichever screen is up). The UI harness (`ui-harness.html` on the
dev server) has `title-twelve`, `title-twelve-wait`, `title-twelve-king`, `title-twelve-final`,
`title-twelve-crowned`, `results-win`, `results-duel`, `results-duel-lost`, `results-duel-opens` and
`results-crowned`.

## Touched outside my files

- `src/game/app.ts` (nobody's): the wiring. `isOpen`, `duelHere`, `cardArt`, `twelveModel`; the duel's
  promised record and the last race's field in `pickField`; the start toast; the settle and the results'
  `twelve`; Run Again's duel label; the title shot's staging (`shot`, `reel`, `REEL_T0`/`REEL_T1` in place of
  the two reel constants, `journeyAt` set by the title and cleared by `startRun`).
- `src/game/save.ts` (nobody's): the `twelve` field and its read at load.
- `src/ui/contract.ts`, `src/ui/ui.ts`, `src/ui/harness.ts` (nobody's): `RiderFace`, `TwelveRung`,
  `TitleTwelve`, `ResultsTwelve`, `'lantern'` as a card art; `UI.titleCut()`; the harness scenarios.
- `src/render/camera.ts` (hero): `titleLens`, read by `desktopTitle` and `phoneTitle` where they used
  constants. With the default lens the desktop title is unchanged. The phone title's hero now sits at about
  43% of the height instead of 53% (the foot of the screen has one more row), for every mountain.
- `src/game/field.ts` (feel): one condition. A promised rider no longer takes the pack slot the grudge was
  given (the app never promised anyone while a grudge rode, so it could not happen before; a duel does).
- `src/render/marqueeworld.ts` (the set pieces' world): one guard. **Ember crashed at boot** on the base
  commit: all of Ember's gates swing, so no garland is hung, and `merge([])` threw in `buildGates`
  (`?debug&m=2` showed a blank page). An empty garland is now an empty geometry. The momentsworld lane may
  have fixed it its own way; keep either.
- `index.html`: the loading screen's inline CSS and two `<b>` elements.

## What the main lane must wire or decide

1. **The pools' home times do not follow the ladder.** On the committed pools the riders' times on their own
   home mountains are: Rosa 2:17.2, Bram 2:12.8, Pip 1:59.2, Juno 2:14.5, Nessa 1:56.0, Tavi 2:03.7, Wren
   2:18.4, Kaito 1:52.0, Ivo 1:52.4, Suki 1:46.8, Mila 2:03.6, the King 1:53.7. Old Wren (seventh) is the
   slowest of all, Pip (third) is quicker than Mila (eleventh), and Suki is quicker than the King. The
   ladder's order is the roster's skill, which is the story, but a player will feel the third duel as
   harder than the eleventh. When the pools are ridden again either check that home times fall with skill
   (the roster's `home` bonus is 0.05 of skill, which the bot's variance swamps) or order the ladder by
   home time at load. The test `every one of them has a real finished record on their home ground` will
   fail if a re-ride leaves a signature rider without a finish at home.
2. **Lanternfall's shot is a guess.** My worktree has the glacier stand-in for Lanternfall's world, so its
   `TitleShot` (the Crown, 140 to 690 m, the lens high over the cloud sea) was composed blind. Retune it with
   the `k*` switches once the lanternworld lane is merged; the lanterns rising are at the break near 1,500 m,
   which may be the better stretch.
3. **Sakura's shot is the weakest of the four.** At 1,980 to 2,620 m the frame is hazy and the cone does not
   read; I could not find a stretch where it does on this branch's light. Look again after the light lane's
   merge (`?debug&m=3&kz=...&kl=...`).
4. **The reel's hero is often mid-trick at the first glance** (Ember and Frostfang open on a flip). The duel
   scan picks the opening by its partner, not by what the hero is doing. It reads as lively; if you would
   rather open on a carve, bias `pickReelMate` to grounded heroes in a composed shot's first second.
5. **The last race rides thirteen ghosts** (twelve and your best), more than any field before (nine and
   yours). Not ridden or timed here. Check Low and a phone before shipping it.
6. **The reel lane's files.** The start line is a toast in the grudge's tone; if the reel lane has moved the
   HUD's rival pill to the canvas, a duel could wear a mark there instead. The results' moment sits top
   left over the scene on a wide screen: if the highlight reel draws there, they need to share.
7. `DECISIONS.md` 280 changes what a locked Lanternfall says in `notes/r7-moments.md` M1 ("opens like the
   others, at 48 passes") and the progress test that lane edited (60 passes) no longer depends on it.

## What I did not finish, and what is fragile

- The veil's hold is on wall-clock timers around a synchronous world rebuild. On a slow machine the rebuild
  eats part of the hold, so the name is on screen for less than the 420 ms planned. It never shows the
  rebuild, but the name can pass quickly.
- A ghost's name tag can sit over the place line on the title (Sakura, on a phone): the title has no
  occluder list as the HUD does.
- Wins, podiums, a rider falling, Lanternfall opening and the crown were looked at in the UI harness with
  fake models, not earned in a real run: a hands-off rider does not win a duel.
- No human has played a duel. Whether the first three (Bram 2:12.8, Juno 2:14.5, Wren 2:18.4) are the right
  first steps for a player on their second to tenth run is a question for a person and the telemetry.
- `playwright-cli close-all` was not run at the end (the owner's global instruction asks for it): the lane
  rules forbid it while other lanes capture, so only the `r7-screens` session was closed.

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\screens\`, 1280x720 on High (`desk-*`) and 390x844 on
Medium (`phone-*`), the built game, headless:

- `01-title-first`: a first visit.
- `02-title-pinecrest`, `-pinecrest-later`, `-frostfang`, `-ember`, `-sakura`, `-lanternfall`: the five shots.
- `03-twelve-ladder`, `04-garage`.
- `05-travel-1-veil` to `-4-arrived`: Pinecrest to Frostfang.
- `06-run-start-duel` (the start line), `07-pause`, `08-results-landing`, `08-results` (a duel lost).
- `h-desk-*` and `h-phone-*`: the UI harness states (a win, a podium, a wreck, a duel won, lost, opening
  Lanternfall, the crown; the ladder with nobody to duel, with the King up, the last race, the crown).
- `wip/`: contact sheets and the frames I composed the shots from.
