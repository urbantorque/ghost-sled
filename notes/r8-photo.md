# Round 8: the photo lane (V8's photo mode, G8's stickers as frames, G11's frame with the run's card)

Branch `r8-photo`, cut from `round-8` at c441bfa. Frames, saved photos and pairs under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/photo/` (desk, phone, album, pairs). Helper scripts in the
worktree's `.lane/` (git-ignored): `photo-check.js` (photo mode walked through on desk or phone), `album-fill.js` (a
save filled by replayed runs, then the album shot), `frames-export.js`.

## What a player gets

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **Photo mode from pause and from the results.** Pause has a Photo button beside Home; the results' foot a camera beside Home. The run is held exactly where it stopped (the sim, the ghosts, the particles and every shader clock: `frameRun`'s `frozen`), the HUD and every card leave, and the lens is the player's. Done (or Escape, P, B) goes back where it came from: the pause card, or the results as they stood. | "I stopped to take a picture of it." The frames the game is proudest of (a leap over the valley, the finish square) can now be kept. | Desk: the tick, x, z and speed identical before, during and after (535, -15.219, 231.259, 32.98); the lens back on the same point to the millimetre; resume rode on (tick 617 1.5 s later). Results: the scene held, the card back as it was. |
| **A lens that turns round the rider and never goes through anything** (`camera.ts` `PhotoRig`, `World.lens`). It turns round a point on the rider's chest, 1.3 to 32 m out, its pivot carried up to 12 m off the rider; its arm stops short of a rock or a tree's trunk and it rides up over the snow. It opens on the frame the player paused on: no cut, no swoop. Everything eases on the page's clock and lands at once under reduced motion. | A free camera that clips into the snow or a trunk breaks the spell; one that jumps on entry loses the frame you paused on. | `tests/photo.test.ts`: opens on the held frame exactly; turns at its distance and resets; keeps its reach (near, far, leash, lens, tilt, pitch, NaN input); 16 turns looking up from under the rider never under the snow; stops short of a wall and a tree; a pivot carried into rock stays out; a still camera's cine (no letterbox, no blur, depth of field only when asked). |
| **A few looks, the game's own grade.** The lens as a focal length (12 to 85 mm), a tilt (20 degrees either way, "Level" at rest), a framing grid of thirds (never in the PNG), focus on the rider where the tier draws depth of field (High, Ultra), and the way back to the first frame. What belongs to the chase lens leaves the picture (`World.photo`: the speed streaks, the punch and flash, the corners closing at speed, Spirit Flow's pulse, the riders' tags, Low's canvas figures, the avalanche mirror); the grade, the light, the flow's colour and the moment stay. No filter. | Photo mode sells the look as it is; a filter would break ART.md 1's colour roles. | Screens below. |
| **Save Photo**: the canvas at its full size as a PNG (`ghost-sled-<mountain>-<yyyymmdd-hhmmss>.png`), taken in the picture's own callback (`World.onPicture`) before the tags and the mirror go over it, so the HUD is never in it. A breath of off-white over the screen and "Saved <name>" say it was kept. | The photo is the picture, not a screenshot of a game screen. | Desk: 1280 x 720 PNG, 1.6 MB, opened and looked at; the pad's A saved a third. |
| **With Run Card** (G11's stretch): the same PNG with the run's card in the lower left, drawn in the game's type and colours: "GHOST SLED", the mountain in italic 900, the time over the line (or how far the run has come) and the place (gold-white for a win), the rider's name in their vermillion. A second button, never instead of Save. No share button, no SDK call, no ad. | "This was my run." | `desk-saved-card.png`, `desk-results-card.png`. |
| **Controls in every hand.** Mouse: drag turns, a right or middle drag (or Shift and a drag) moves across, the wheel moves in. Keys: arrows or WASD turn, Shift with them moves, + and -, [ and ], comma and full stop, G the grid, H hides the bar, Enter saves, Escape goes back. Pad: the left stick turns, the right moves, the triggers zoom, the bumpers set the lens, the d-pad tilts, A saves, Y the grid, X hides the bar, B goes back (the A that opened photo mode is not read as a save). Touch: one finger turns, two move and pinch. Nothing reaches the game while it is open (keys stopped in the capture phase, the pad's game reading off, the surface over the canvas). | | Desk: drag, wheel, right-drag, held arrow, G, the slider, the pad's stick and A all moved or saved. Phone: one-finger and two-finger touch through CDP. |
| **A sticker is a frame from its run** (`albumframes.ts`, `framestore.ts`, `photoshoot.ts`). The frame is taken from the live picture as the moment happens, HUD out (the same callback): a set piece 0.6 s after it starts and again on its last step, a legend 0.8 s after it comes into reach, a trick at its grab (or the flight's top for a spin or a flip), a charm and a named pair as the rider rides through the arch, and the finish 2.4 s after the line once the lens has swung round (for the stickers earned at the line: a mood finished, a rider's record beaten, a mirror, a duel, a Long Night leg). Only stickers the album does not hold yet are shot, so after the first runs a run keeps a frame or two. When the run is settled each sticker it earned takes its frame; a 320 x 200 crop round the rider, encoded as WebP on idle time and kept in IndexedDB with the run it came on. The album shows the frame to the card's edge, the name on the same ink band; the painted card where no frame was kept. | "My album is my runs." The album shows the moment you landed your first Ember Twist, not a painted card. | Desk run: 9 frames kept, 8.9 to 11.6 KB each. |

## Why a live frame and not a frame rendered again from the record

The brief offered both. Rendering on demand would have needed the world rebuilt on each sticker's mountain and course
position behind the open album (the World is one instance; the title is on another mountain), the post stack drawn to a
target of its own (it draws to the canvas), and a re-simulation to the moment's tick: seconds of work on Low and the
phone each time the album opens, and changes to `world.ts` and `post.ts` that are not this lane's. The live frame costs
one small copy on the frame the moment happens, nothing to open the album but reading the store, is literally what the
player saw, and takes no reel code at all. The reel's lenses would compose a more varied frame (side, low three-
quarter); the live one is the chase lens (or the finish's swing). A later round could re-render old stickers from
`album.runs` with the reel on idle time if that variety is wanted.

## The save's growth, and where frames live

- **The save does not grow at all** for frames: they are not in it. A frame is 9 to 12 KB of WebP; the whole album
  (about 220 stickers) would be about 2.5 MB, in this browser's IndexedDB (`ghostsled-album`), never in localStorage or
  CrazyGames' data (1 MB, already holding the spine's records).
- **What the save already carries for frames is now unused by them:** the spine lane's `album.runs` keeps the record of
  the last 40 sticker runs (about 640 to 880 bytes each by the pools' records, so up to about 30 KB) "for the
  sticker's frame". Nothing reads it now. The main lane may drop it (stop passing `record` to `awardStickers`) or keep it
  for a reel-rendered frame later.
- **Old saves:** a sticker earned before this build, on another device, in a private window that refuses IndexedDB, or
  whose frame was lost shows its painted card, as before. A frame is shown only when its run number matches the
  sticker's (`album.got[id]`), so a frame left from a save since reset never shows on a sticker earned again.
- **Not synced:** a player on CrazyGames who moves device keeps the stickers (the save) and sees painted cards there.

## Cost

Measured in this lane's sittings while other lanes ran (so no frame rates: only same-run measures). Raw output in
`shots/r8/photo/cost/`.

| What | Before (c441bfa) | After | Note |
| --- | --- | --- | --- |
| A Low frame's GL calls, Pinecrest (`glcount.js`, 10 s of a ride, interleaved B A A B) | 490.3, 496.5 | 487.0, 486.7 | Level: nothing new draws while photo mode is shut. `World.photo` and `World.onPicture` are two falsy checks a frame. |
| The same, Ember | 501.3, 519.2 | 503.6, 484.3 | Level within the windows' spread. Uniform calls level (221.7 to 247.6 both builds). |
| A sticker frame taken (main thread, the copy of the drawn canvas into a 320 x 200 crop; `App.frameLog`) | none | 0.2 to 0.8 ms, once on the frame its moment happens | A first run on a fresh save takes 9 to 20 (each new sticker); later runs one or two. The WebP encode and the IndexedDB write run on idle time (`requestIdleCallback`, 4 s timeout). No GL call (the copy is the 2D canvas's). |
| A sticker frame kept | none | 5.6 to 16 KB, 10.4 KB on average (32 frames, 333 KB) | In IndexedDB, not in the save. |
| The save after three runs | 8,431 bytes | 8,431 bytes | Frames add nothing to it. |
| Opening the album, filled (33 stickers, 32 with frames), Low at 6x CPU | 2,734 ms | 2,533 ms | The store is read once (one `getAll`, 400 ms cap) before the sheet opens; the images decode lazily. The 2.5 s is the sheet's own build at 6x on both builds. |
| The same, High desk / Medium phone, unthrottled | 437 to 876 / 419 ms | 449 to 990 / 453 ms | Click to sheet, noisy with other lanes running. |
| Photo mode open, a frame | none | the scene's own draw plus the lens rig's reach test (up to 92 rock and tree probes along the arm; well under a millisecond) | Nothing animates (render time held), so the frame is the paused frame redrawn. |
| The first frame (`gs-first-frame`) | | nothing new before it | Photo mode and the store are created on demand; the store is first opened when a frame is kept or the album opens. |
| The bundle | JS 3,115,382, CSS 187,423 bytes | JS 3,143,403 (+28.0 KB), CSS 192,254 (+4.8 KB) | Photo mode, its rig, the album frames and the store. Not lazy: the pause card and the results' foot need the button's CSS, and the code is small next to the bundle. |

## How it was checked

**Photo mode under playwright** (`.lane/photo-check.js`; screens in `shots/r8/photo/desk/`, `desk2/`, `phone/`), a pool
rider replayed as the player, on desk (1280 x 720, High, Pinecrest and Sakura) and the phone (390 x 844, Medium,
Sakura, touch through CDP):

- *From pause:* P, then Photo; the HUD, the pause card and the tags gone (the first desk sitting found the HUD's top
  pills still drawn: they set their own visibility; fixed with opacity and shot again); a drag, the wheel, a right-drag,
  a held arrow, G, the lens slider to 70 mm; Save Photo (`desk-saved.png`, 1280 x 720, 1.6 MB, opened and looked at: the
  picture with no HUD and no tags) and With Run Card (`desk-saved-card.png`: "PINECREST / 231 m 2nd of 6 / suki.zooms");
  a fake pad's left stick turned the lens and its A saved a third PNG; Escape back to the pause card. The run's tick,
  position and speed the same before, during and after (tick 535, z 231.259, 32.98 m/s), the lens back on the same point
  to the millimetre, and Resume rode on.
- *From the results:* the camera beside Home; the finish scene held; orbited round the rider in the square; With Run
  Card (`desk-results-card.png`: "3:16.4 6th of 6"); Done back to the results as they stood.
- *The phone:* the pause card's Photo beside Home, the bar in three rows, one finger turned and two moved and pinched,
  the card's PNG at the canvas's 585 x 1266, the results' camera beside Home.
- *The console:* clean in every sitting on both builds (no error, no warning from the game; the before build's album
  sitting logged twelve "glGetProgramiv: Program object expected" warnings once from the GPU process, on the before
  build, not this lane's code).

**The album, before and after on one save** (`.lane/album-fill.js`; `shots/r8/photo/album2/`): three pool riders
replayed on Pinecrest, Ember and Sakura into a fresh save on this build (33 stickers, 32 with frames), the album opened
from the title's corner and each section that holds stickers shot; then the before build (c441bfa) opened on the same
save, which shows the same stickers as painted cards. Desk and phone.

**Blind critic 1** (a fresh general-purpose agent, Opus at high effort, given only ART.md's path, the pairs folder
`shots/r8/photo/pairs1/` and the brief's album question; key `shots/r8/photo/keys/album1.json`): **the new sheet in 9
of 10** by the script, in truth **8 of 8 decided pairs** (desk 4 of 4, the phone 4 of 4): the other two were the album's
top on desk and phone, where Pinecrest holds no sticker and the two builds are the same, and the critic called both a
tie. Its reasons: "real frames from the mountains ... A's nine collected stickers are blank navy gradients that look
like images that failed to load"; "the charm grid is nine painted scenes, each mountain's sky readable at a glance".
What it named in the new sheet, worst first, and what was done:

| Named | Done |
| --- | --- |
| The rider buried: the glyph sits on the rider and the ink band at the foot swallows the rider and sled | The band on a frame sticker is 40% of the card (was 62%) and the glyph moved to the top corner. |
| Twelve Sakura rival stickers the same picture | The line's frames are four, dealt in turn (already in that build, but 0.8 s apart they were near alike); now 1.6 s apart, 2.4 to 7.2 s after the line, as the lens creeps and the town's fireworks go. |
| "phoenix" and "teacup" lowercase | The catalogue reads the sim's own names (Phoenix, Teacup). |
| Crane Fold a washed-out smear | Its frame was taken in a hero frame's depth of field and slow push. Left: a frame taken under a directed shot now leaves the letterbox out, but the blur is the moment as the player saw it. A later pass could skip frames while `cine.dof` is high. |
| Spin has no image | No frame was kept for it (a spin on a short hop, under the flight-top threshold) and a sticker with no mountain has no painted card, as before. A painted card for such stickers is the screens lane's. |
| A dark blob over the rider in Spirit Knot, Quick Feet and Phoenix | The rider's tuck and the charm arch's shade from behind; the moment as seen. |
| Soft at phone size | The frames are 320 x 200 drawn at about 170 CSS px (340 device px) on a phone: about 1:1. |
| The Twelve's sticker shows the player at the finish, not the rider's bust; trick stickers show the rider from behind, not the pose | Both are the frame of the run it happened in, as the brief asks; the chase lens sees the rider from behind. A reel-rendered frame (the reel's side and front lenses) would show the pose: see "What is still short". |
| No silhouettes; pages not in rows of ten; repeated variant hints; the sheet showing through on the phone; a clipped bottom row | The books' own layout, as the screens lane built it, on both builds. Named for the main lane. |

**Blind critic 2** on the sheet after those fixes (a new fresh agent, the same question, `shots/r8/photo/pairs2/`, key
`keys/album2.json`, the before sheet against `album3/`, the two identical tops left out): **the new sheet in 8 of 8**,
desk 4 and the phone 4, naming "each card a mountain and a scarfed rider" and "the album says nothing about where each
charm was found" of the old. It still named: Spin with no picture; the twelve Sakura rival stickers alike (these frames
were the ones kept before the line's frames were spread to 1.6 s apart, so the spread is not judged yet); The Twelve's
sticker showing the player, not the rival's bust; the dark tuck in Quick Feet, Phoenix and Spirit Knot; Crane Fold's
blur; a little softness on the phone; the glyph sitting top-left on a frame and bottom-left on a painted card; and the
books' own layout (rows of seven, no silhouettes, the clipped last card, the title showing through on the phone).

## Low and the phone

- **Photo mode on Low** is the same mode over Low's picture: no depth of field (the focus toggle does not show below
  High), the poster and Low's own trees as they are, Low's canvas figures and the tags left out. The PNG is the canvas
  at Low's own pixel ratio (0.8 to 1), so a Low photo is smaller; nothing is rendered at a higher resolution for it.
- **The phone** gets the bar in three rows across the foot of the screen (the lens and tilt, then Done and the
  toggles, then the two saves), one finger to turn and two to move and pinch, and every control 44 px or more. The
  help says "One finger turns, Two move and pinch". The bar and the help fade back while a finger moves the view.
- **Album frames on Low and the phone** are taken the same way (one small copy of the drawn picture on the frame the
  moment happens, a few times a run at most once the album has its early stickers); the WebP encode runs on idle time.
- **Reduced motion:** photo mode opens on the paused frame (it never swoops anywhere), the lens lands at once on each
  input instead of easing, the shutter's flash and the bar's fades are off. Every beat stays.

## web-design-guidelines (Vercel's Web Interface Guidelines, fetched fresh) over photo.ts, photo.css, almanac.ts, books.css

Clean: every icon-only control has an aria-label (the grid, the focus, the way back, the results' camera); the sliders
are labelled with `<label for>`, read their value as words (`aria-valuetext`: "26 millimetres", "Level", "5 degrees
left") and show it in an `<output>`; the status is `role="status"` and `aria-live="polite"`; the mode is a labelled
modal dialog with its own heading; focus lands on Save and stays visible (the shared ring); buttons and headings in
Title Case ("Save Photo", "With Run Card", "Done"); transform and opacity only, no `transition: all`, reduced motion
honoured; `touch-action: none` on the surface and the sliders, the bar inside the safe-area gutters; the album's frames
have explicit width and height, `alt=""` (the card carries the name), `loading="lazy"` and `decoding="async"`; hover
states on the bar's buttons; numbers tabular. Fixed on the way: the HUD's pills showed through `visibility: hidden`
(they set their own visibility), so the hidden UI is now `opacity: 0` and inert. Open, as the screens lane left it: the
album lists about 210 stickers unvirtualised.

## The text to fold into ART.md and the README

**ART.md, section 10 (UI), round 8:**

- **Photo mode is the picture and one bar.** From pause (Photo, beside Home) or the results (a camera beside Home) the
  run holds exactly where it stood and the lens is the player's: it turns round the rider's chest from 1.3 to 32 m,
  its pivot carried up to 12 m off the rider, and never stands in the snow, a rock or a tree. The HUD, the cards and
  the riders' tags leave the picture, and so does what belongs to the chase lens at speed (the streaks, the punch and
  flash, the corners closing, Spirit Flow's pulse); the grade, the light and the moment stay, and there is no filter.
  The bar is ink at the foot of the screen (the whole width on a phone, in three rows): Done, the lens as a focal
  length and the tilt, the grid of thirds, focus on the rider (High and Ultra), back to the first frame, With Run Card
  and Save Photo (vermillion, the one primary). It and the help step back while the view moves.
- **A photo is the canvas at its size, as a PNG.** With Run Card adds the run's card in the lower left in the game's
  own type: "GHOST SLED" small, the mountain in italic 900, the time and the place (gold-white for a win), the rider's
  name in vermillion, on ink at 86% with an 18 px corner. Nothing is shared or sent.
- **A sticker held is a frame from its run** where one was kept: the moment as the player saw it (a set piece at its
  height, a legend in reach, a trick at its grab or the top of the flight, a charm's arch, the finish's swing), to the
  card's edge, the name on the same ink band. The painted card in its mountain's sky stays for a sticker with no frame.

**README (features, round 8):** "Photo mode: pause (or the results) and press Photo to hold the run and frame it
yourself: drag, keys, a pad or touch turn the lens round the rider, with a lens, a tilt and a grid; Save Photo keeps a
PNG of the picture with no HUD, With Run Card adds the mountain, the time, the place and your name. The Spirit Album's
stickers are frames of the moments they were earned in, kept on this device."

## Touched outside my files

- `src/render/world.ts`: two public fields, `photo` (zeroes the speed streaks, punch, flash, flow pulse and speed
  vignette, skips the riders' tags and Low's canvas figures and the avalanche mirror) and `onPicture` (called with the
  canvas right after `post.render`, before the mirror and the tags); both inert at their defaults.
- `src/ui/contract.ts`: `UIHandlers.onPhoto?`, `StickerCard.img?`.
- `src/ui/menus.ts`: the pause card's Photo button (Home and Photo in one `.gs-pause-acts` row, which takes the grid
  area Home had).
- `src/ui/sequence.ts` (`StoryHooks.photo?` and the camera button in the foot) and `src/ui/results.ts` (passes it).
- `src/ui/icons.ts`: four glyphs in the family's own hand (camera, grid, focus, reset).
- `src/ui/books.css`: the frame sticker (`.is-shot`, `.gs-bk-st-img`).

## For the main lane to wire or decide

- **The mirror flag.** `App.mirroredView()` (in app.ts, the photo section) returns false on this branch. At the merge
  with the mirror mountains, make it return whether the page shows the canvas turned over: the saved PNG, the run
  card's photo and every sticker frame turn over with it (`photoOf`, `thumbOf`), and a drag across turns the other way.
- **`album.runs` in the save** (the spine lane's records of the last 40 sticker runs, up to about 30 KB) is no longer
  needed for frames. Keep it (a later reel-rendered frame) or stop writing it.
- **CrazyGames' iframe and downloads.** Save uses an `<a download>` with a blob URL. If the portal's iframe sandbox
  lacks `allow-downloads`, the browser drops it and the bar says "The photo could not be saved" only if the click
  throws; a person should try Save on the portal before the release.

## What is still short

- **A trick's sticker shows the chase lens's view of the trick** (mostly the rider's back), and The Twelve's sticker shows
  the player crossing the line, not the rider beaten. Both are honest frames of the run; a frame rendered again from the
  record with the reel's lenses (`reelcam.ts`: the side and front three-quarter) would show the pose and the rival.
  That needs the world rebuilt on the sticker's course on idle time and the post stack drawn to a target of its own
  (both outside this lane), so it is left; `album.runs` already keeps the records it would need.
- **Frames taken inside a directed shot** (the hero frame's depth of field and push) come out soft; skipping a frame while
  `cine.dof` is high, or waiting for it to ease, is a small next step.
- **A sticker held with no frame and no mountain** (a trick, a charm, a duel earned before this build or on another
  device) is a plain navy card on both builds; it wants a painted card of its own kind (the screens lane's).
- **The line's frames 1.6 s apart** and the shorter ink band were shot (`album3/`) but the spread has no new run behind it:
  the frames in that sitting were kept with the earlier 0.8 s.
- **What only a person can judge:** whether turning the lens by drag, keys, a pad and two fingers feels right (the drag
  is 0.0045 rad a pixel, the keys 1.5 rad a second); whether the bar is small enough on a phone (three rows, about a
  fifth of the screen, fading back while a finger moves the view; a tap hides it); whether Save works in CrazyGames'
  iframe (`<a download>` and a blob); whether a run card in the corner is the right size on a big monitor; whether the
  album's frames make it "my runs".
- **Not built:** saving the highlight reel as a video (G11's other half); no share button, no SDK call, no ad, as the
  brief says.

## Where the frames are

- Photo mode: `shots/r8/photo/desk/` (Pinecrest, the first sitting, with the HUD fault), `desk2/` (Sakura, after the
  fix), `phone/`; the saved PNGs beside them (`*-saved.png`, `*-saved-card.png`, `*-results-card.png`).
- The album: `album2/` (before and after on one save, desk and phone), `album3/` (after the critic's fixes), the pairs
  `pairs1/`, `pairs2/` and their keys and picks in `keys/`.
- The cost: `cost/` (`glcount.js` JSON, the Low album shots at 6x).
