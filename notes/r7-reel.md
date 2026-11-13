# Round 7, the reel lane: notes for the main lane

Branch `r7-reel`, cut from `2c05cfe`. It merges into `round-7` (with the screens lane in) with no conflict
(`git merge-tree`, 2026-11-14). Files I own: `src/ui/hud.ts`, `beatsui.ts`, `notices.ts`, `presence.ts`, the
riders' labels (in `src/render/ghosts.ts`), and the new `src/render/labels.ts`, `hudfigs.ts`, `reelcam.ts`,
`src/game/reel.ts`, `reelshow.ts`, `src/ui/figures.ts`, `reelui.ts`, `reelcopy.ts`, `reel.css`.

## What a player gets

- Riders' name tags, emblems, crash markers, graveyard tags, speech chips and the edge chip look as they did
  and cost the page nothing: they are drawn in the canvas.
- On Low the score, the clock and the distance are drawn in the canvas too. A Low frame writes to the page
  about one frame in four where it wrote three in four.
- "Watch Your Run" on the results: a 20 to 30 s highlight reel of the run just ridden, with four lenses, a
  title card a shot, pause, watch again, skip, and Share (a link that replays it).
- A legend is announced: one card, once a run.
- The HUD arrives from its corners, a lit lantern's cell lifts, a set piece's card settles into its chip.

## Decisions

### R1. Labels are quads in one batched draw (`labels.ts`), not DOM

Reason a player feels: a phone on Low keeps its frames while riders are in the frame (decisions 217, 238).
Every pill, ring, shadow, pointer and dot is a signed-distance shape in one fragment shader; words and glyphs
are sprites from one atlas (a 2D canvas, uploaded as a texture). One mesh, one draw call after the post
stack and the avalanche mirror, none when nothing shows. Colours are written as sRGB straight to the canvas
and blended there, so a pill is the colour its CSS was. Placement, priority, the dot collapse, the rival's
ring and the occlusion against the HUD's rects are the code that was there; only the drawing moved.

**The atlas holds whole words, not letters.** The brief said a glyph atlas. A word rasterised once is shaped
and kerned by the browser exactly as its DOM text was, in any script, and a field has about ten names; a
letter atlas would have needed its own layout and would have drifted from the old look. Digits (the edge
chip's gap) are their own sprites, tabular, so a gap that changes uploads nothing. The atlas is made on the
first label after the first frame (`LabelBatch.arm`), at the frame's own pixel ratio (1 on Low), and emptied
with each new field.

Measured (`scripts/playtest/labels.js`, the same ride held at the same ticks, `shots/r7/reel/labels/`): label
DOM nodes 9 before, 0 after; 9 to 29 quads a frame with the figures; `zoom-before-tag.png` against
`zoom-after-tag.png` at 5x is the same pill to the pixel row, type included.

### R2. On Low the running figures are in the canvas (`figures.ts`, `hudfigs.ts`)

With the labels gone, a probe of the same build with the HUD's `update` stilled took `UpdateLifecycle` from
9.5 to 4.0 ms a frame (and to 1.8 with no HUD at all): what was left was the score, the distance and the
clock, each a style, a layout and a paint twenty times a second. On Low they are now sprites baked with the
HUD's halo, drawn where the HUD's own layout put their boxes. The DOM keeps each figure, painted clear,
written when its length changes and once a second, so a reader's figure is never more than a second old and
the layout is still the HUD's. Medium, High and Ultra keep their DOM figures: the page is not their cost.
Forced colours keeps the DOM path on every tier (clear text would be forced visible over the canvas's).

Also on the beat now: the combo's timer bar (it glides between beats on a 60 ms compositor transition),
"Best in 240 m", the chase's gap. The lantern's fill glides the same way.

**Measured** (`scripts/playtest/lifecycle.js`, new: a trace of the renderer's main thread summed by event, and
a MutationObserver; Low, 6x CPU throttle, a very first run on Pinecrest, 20 s, three passes a build
interleaved; `shots/r7/reel/life-after.jsonl`, the labels-only step in `life-labels.jsonl`):

| | Round 6 build (2c05cfe) | This branch |
| --- | --- | --- |
| DOM writes a frame | 2.07, 2.12, 2.43 | 0.38, 0.49, 0.52 |
| Frames with a write | 73%, 76%, 80% | 22%, 27%, 29% |
| `UpdateLifecycle`, ms a frame (throttled) | 1.60, 2.44, 2.48 | 1.23, 1.56, 3.09 |
| of which layout | 0.30, 0.42, 0.47 | 0.09, 0.16, 0.30 |

The writes are counts and hold from pass to pass. The milliseconds do not: the machine was shared, and a
pass's frame count ran from 1,094 to 2,364 in the same 20 s, which scales every per-frame time (the 3.09 is
the pass that got half the frames). Read the lifecycle row as "lower in two passes of three, by about a
third", not as a number. Frames a second were not measured, by the lanes' rule.

Cost: one draw call on every tier while a label or a figure shows; one texture, 1024 by 512 on Low (2 MB),
1024 by 1024 at 2x, 2048 by 1024 at 3x; about 30 uploads in the first 40 s of a run as words are first seen.

### R3. Your run, directed (`reel.ts`, `reelshow.ts`, `reelcam.ts`, `reelui.ts`)

- **The record is all it uses.** `ReelScanner` re-simulates the record a slice a frame under the opening
  card, noting every flight, every rider passed, every set piece won, the legend, the fastest moment, the
  finish or the wreck. `planReel` claims windows in order (the finish or the wreck, the legend, each set
  piece won, the best leap, the closest pass, then the fastest stretch and the next best leaps until there
  are 20 s), never overlapping, and trims to 30 s. `cutOnBars` lays the lengths on bar lines when the audio
  gives a tempo.
- **The same ghosts.** A rider that read your pace rode on a clock that changed four times a second.
  `GhostTrack.warps` now keeps every clock it rode on and `GhostManager.poseThen` answers "where was it at
  this tick", so the reel's ghosts are where the run's were.
- **Lenses** (`reelcam.ts`, through `World.lens`, null in play): `side` a tracking shot on a long lens, `low`
  a front three-quarter near the snow, `wide` high and behind, `orbit` round a flight and nearest at its
  apex, where the reel's own clock eases to 0.28 for a true slow frame (it owns its sim, so the flight
  itself hangs). They write `cine`: letterbox 1, depth of field 0.15 to 1 on the rider, motion blur 0.3.
- **Reduced motion:** every shot is a tripod that pans; no orbit, no slow frame, no blur; the cut's dip
  does not fade.
- **It never blocks.** The button starts a dynamic import (`reelshow`, 15.2 kB, 5.8 kB gzipped, plus 2.1 kB
  of CSS); nothing of it is in the first frame's chunk. The scan and each run-on to a window take at most
  7 ms of a frame. Skip (the button or Escape) works from the first frame; Space or K pauses.
- **Sharing.** CrazyGames' `game.inviteLink(params)` takes any string parameters and the game already sends a
  record in `c`. A reel link is that link with `reel=1`: whoever opens it watches the reel on the title (no
  ghosts in it: the link carries one record), then has the challenge as before. No video is recorded.
- **Cards** (`reelcopy.ts`): "Best leap, 5.9 s", "Passed Pete_on_Tour at Timberline Glades", "Mirror Lake,
  won", the legend's name, "Top speed, 50 m/s", "1st over the line, 1:50.9", "The run ended at 1,137 m".

Tests (`tests/reel.test.ts`, 6): the scan's hash is `replayRecord`'s, and the player's after slices, a seek
back and a replay; the same record gives the same shots; windows never overlap, stay inside the run and total
12 to 30 s on fifteen pool runs over five mountains, before and after `cutOnBars`; the leap and pass cards;
a place for any metre; a run wrecked by an avalanche cuts and plays to the wreck's own tick.

Seen in the browser (`scripts/playtest/reel.js`, frames in `shots/r7/reel/`): a whole run then its reel from
the results with a pass in it (`run-high/`), a link's reel on High (`link/`), on Low (`link-low/`), on a
phone (`link-phone/`), under reduced motion (`link-reduced/`), and a wrecked run's (`wreck2/`). Console clean
in every one. The reel returns to the results (or the title, for a link).

### R4. A legend beat and its card

`Beat` gains `legend` (`warn`, `start`, `step`, `end`; key, name, line, kind, side, n) and the director
forwards the sim's legend events with the legend's own name and line. The HUD shows one card on `warn`:
the word, the name, a hairline that draws out from the middle, the line. It takes none of the roles'
colours (moonlight on ink), ranks with a finale, and holds 3.6 s. Two director tests. Frames:
`shots/r7/reel/legend/` (both Pinecrest legends on desktop, the stag on a phone).

### R5. HUD motion, one gesture each

- Entrance: the score block from the left, the race row from the top, the lantern's block from the right,
  70 ms apart, once. On Low the score block only fades (its numerals are in the canvas at rest); on touch the
  lantern's block only fades (the lantern is a fixed button inside it and a moving block would carry it off
  the thumb: this was a bug I made and caught in the phone frame).
- Lantern: the fill glides; the cell that fills lifts once. The whole pill no longer swells.
- Set piece chip: the card settles to its chip (was a snap); the win's pulse stands.
- Get-up pips and the place change: reviewed and left; each already has one gesture.
- Nothing loops in a plain ride: every `infinite` animation in the HUD is bound to a state (a duel, a low
  combo, a fuse, a chase).

## Touched outside my files

- `src/render/world.ts`: `ghosts.pixelRatio` and `lowPage` in place of `onBeat` (two places);
  `ghosts.drawLabels(renderer)` after the mirror; `lens` and the one call after the chase camera; `reelCut`;
  the mirror stands down while `lens` is set.
- `src/game/ghosts.ts`: `warps`, `swing0`, `poseThen`.
- `src/game/app.ts`: phase `reel`, `watchReel`, `startReel`, `endReel`, `shareReel`, the link's `reel`
  parameter, one line in `frame`.
- `src/game/beats.ts`, `director.ts`: the `legend` beat.
- `src/ui/contract.ts`: `onWatchReel`. `src/ui/results.ts`: **one button**, "Watch Your Run", in the card's
  offers row (`gs-res-reel`). It is inside the results layer, which the reel hides while it plays, so it
  cannot meet the screens lane's moment (top left over the scene); the reel's own card is bottom left.
- `src/ui/style.css`: HUD rules only (figures, combo bar, entrance, lantern, chip, legend).
- `scripts/playtest/strips.js`: reads `ghosts.tagsNow()` where it read the DOM. `tests/ghosttags.test.ts`:
  the mock tag has `art`, no element.
- New probes: `lifecycle.js`, `labels.js`, `reel.js`, `legend.js`.

## For the main lane to wire or decide

1. **The audio hook the reel wants:** `audio.clock(): { barS: number } | null` (seconds a bar of the score
   lasts now). `app.ts` already asks for it by that name; with none the cut keeps its planned lengths. The
   reel plays the run's scene (`setScene('run')`) at a held intensity of 0.55 and feeds sim events to the
   sfx; nothing sets a hit on a cut.
2. **The legend's music and camera** (`r7-moments.md`): the beat is there; nothing in `src/audio` or
   `camera.ts` reads it yet.
3. **The Twelve's start line** is a toast and the legend card shares its band, one at a time, the legend
   ranked above it; a legend never comes up in a run's first 800 m, so they have not met.
4. Fold into ART.md 10: labels and Low's figures are drawn in the canvas; a legend's card is moonlight.
   README dev tools: the four probes above; `?c=<record>&reel=1`.

## Not done, and fragile

- **The interface guidelines were not fetched** (the fetch hit a usage limit). I checked the changed UI
  against the rules as I know them (labelled icon buttons, focus rings, live region, transform and opacity
  only, reduced motion, tabular figures, touch-action) and fixed three things; a run of
  `web-design-guidelines` proper is still owed.
- **Low on a dense phone is softer.** Low renders at one pixel a CSS pixel, so on a 3x screen its labels and
  figures are a third the resolution the DOM gave them. It reads (`labels/after-phone/`), and it matches the
  picture round it, but it is a trade and a person should look.
- **No ghost name shows in the reel's pass shot.** The tags' visibility rules are tuned to the chase lens;
  the card names who was passed.
- **Reel passes come from the scan, not the race.** The closest pass is found with the race's own rule and
  ignores the first six seconds; a set piece's card says only "won".
- The reel has no director, so beat-driven picture (a pass's shatter, a finish's celebration) does not play
  in it. Raw sim events do (landings, the crash, the avalanche).
- The first frame was not re-timed. Nothing of the reel is in its chunk and the atlas waits for it, but the
  main chunk grew by the label batch.
- `playwright-cli close-all` was not run (the lanes' rule); only `r7-reel` is closed.
- Frames a second on Low: not measured. Someone with a quiet machine should run `perf.js` four or five
  passes a build before the round claims Low beats round 6.
