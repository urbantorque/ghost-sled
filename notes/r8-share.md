# Round 8: the share lane (G11, Share it: the reel as a clip, the photo with the run's card)

Branch `r8-share`, cut from `r8-stretch` at 0dfc4d1. Clips, frames grabbed from them, photos and screens under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/share/` (`desk1`, `desk2`, `phone1`: the first build;
`critic1`: what the critic saw; `desk3`, `phone2`: after its fixes; `cost`: the GL counts). Helper scripts in the
worktree's `.lane/` (git-ignored): `clip-check.js` (a pool run replayed to its results; the photo with the card; a
clip started and cancelled; a clip saved, read back in a `<video>` and four frames grabbed from it; the second tap),
`sit.sh` (one sitting in the browser slot), `cost.sh` (Low's GL calls before and after).

## What a player gets

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **Save Clip on the results**, a soft pill with its words beside the camera, in the foot the results already have (Home, the camera, Save Clip, the offers, Details). The one big button is untouched. | "That leap was mine; I want to send it." One tap, where the photo already is. | Desk and phone foot: one row, the gap to Details kept (`desk3/*-results.png`, `phone2/*-results.png`). |
| **The clip is the reel cut short**: the run's own directed reel (`reel.ts`), its three best shots (the end, then the legend, the best leap, a set piece won or the closest pass, in that order of claim) in the run's order, each shot on the score's bars as the reel cuts them. It plays while it records, so the player watches what they are saving. | The reel is 20 to 30 s with its cards (too long to post, and 10 to 15 MB); three shots and the end card are 15 to 17 s and about 5 MB, which a phone sends without thinking. | Plans seen: leap, pass, finish; piece, leap, finish; leap, piece, finish. 15.0 to 17.3 s. |
| **What the clip shows**: the picture as the player saw it (the HUD and the riders' tags never: it is taken in the picture's own callback before the tags are drawn), turned over on a mirror mountain as the page shows it, the reel's letterbox, each shot's card (the small word and the line in italic 900 with the scene text's ink halo) for its first 1.5 s, a short dip to ink at each cut, and on the last 1.8 s the photo's run card ("GHOST SLED", the mountain, the time and place, the name in vermillion). | A clip that says what it is without the game around it: where, what happened, who. | Frames grabbed from every clip (`*-clipframe-*.png`). |
| **While it records**: the reel's foot holds a quiet ink chip ("Getting Ready…", then a breathing off-white dot and "Recording") and Cancel in Skip's place; Escape cancels. No pause and no watch-again (a clip has none of its own); the game's own pause or a hidden page holds the recording and it runs on after. | The player sees it is recording and can stop it. | Cancel: back on the results, no file, no download, the picture's callback let go (`*-recording-cancel.png`). |
| **The file**: MP4 (H.264 and AAC) where the browser writes it, WebM (VP9, then VP8, with Opus) where not; at most 1280 x 720 held wide or 720 x 1280 held upright, never larger than the canvas; 30 frames a second; named like the photos, `ghost-sled-<mountain>-<yyyymmdd-hhmmss>.mp4`. It downloads when the reel ends, with "Clip saved" and the name. | MP4 is what a phone's gallery and the social apps take. | Table below. |
| **A second tap shares it**: tapped again on the same results, Save Clip hands the clip already made to the phone's share sheet (the Web Share API takes a file only straight from a tap), or downloads it again where there is no sheet. It is never recorded twice. | On a phone the download lands in Downloads; the sheet puts it in Photos, a message or an app. It is also the fallback where a portal's frame drops a download made without a tap. | Desk Chrome: `navigator.canShare({ files })` true, the second tap called `share` with the MP4 and no reel started. |
| **The game's own sound** is in the clip: the mix's last node (after the master, the limiter and a mirror's swap) is tapped with a `MediaStreamAudioDestinationNode` while the clip records, and let go after. Where the audio context has not started, the clip is silent. | The clip sounds like the game. | Every clip: an AAC track (`audio decoded` bytes in the readback). |
| **Where the browser cannot record the canvas** (no `MediaRecorder`, no `captureStream`, no MP4 or WebM) the control is not shown. | No dead button. | `canRecordClip()` in app.ts. |
| **The photo with the run's card, checked and fixed**: saved on High (results), Low (pause), the phone (results) and mirrored runs on desk High, desk Low and the phone: none flipped wrongly (each matches the screen it was taken from). Two faults fixed: on a phone the card's type came out at 5 to 8 px (it was sized from the long side; a picture held upright now sizes it from its width), and a mirror mountain's card now says "Mirror Pinecrest" as the results do. | | `desk2/*-card.png`, `phone1/*-card.png`, `phone2/*-card.png`. |

## The decisions, and why

- **Record the reel replayed, not the run as it was ridden.** Nothing records while a player has not asked: no stream,
  no encoder, no tap. The reel is a re-simulation of the record, so it can be played again on demand from the results,
  and its lenses are better than the chase's. A rolling buffer of the ride would have cost an encoder all run on every
  tier for a clip almost nobody saves.
- **A short cut, not the whole reel.** The brief expected a reel of "five seconds or so"; the reel is 20 to 30 s of
  shots (`REEL_MIN_TICKS`, `REEL_MAX_TICKS`) plus a card a shot. At a bitrate a 720p picture of snow needs, that is 10 to
  15 MB. The clip takes the reel's three highest claims (`clipCut`, `CLIP_SHOTS`, at most 13 s of the run between them;
  a shot too long opens later, never closer than 1.1 s to its moment), so it is the end and the best two moments.
  The main lane can make it the whole reel by raising `CLIP_SHOTS` and `CLIP_MAX_TICKS`.
- **A 2D canvas between the game's canvas and the recorder** (`cliptake.ts`): it scales to 720p at most, turns the
  picture over on a mirror mountain (the page flips the canvas with CSS, so its pixels are unmirrored), draws the cards,
  and is the only thing the recorder sees, so the riders' tags, the HUD and the DOM never are. It costs 0.15 to 0.19 ms of
  main thread a frame while it records (measured: 135 to 190 ms over 900 to 1,000 frames a clip) and nothing otherwise.
- **The cuts are short in the clip.** The reel's dip to ink stands while the record runs on to the next window and then
  waits for the score's bar line: a second or more. The first clips showed it whole and the critic called those beats
  "nothing". The clip now shows the card over ink for 0.5 s and pauses the recorder for the rest of the dip
  (`MediaRecorder.pause`), so a cut is a beat, not a wait.
- **The letterbox stays.** The reel's directed shots are letterboxed (ART.md 8's cine); the clip is what the player saw.
  The caption sits on the lower bar as the reel's page sets it, and the run's card sits wholly above the bar (it
  straddled the edge in the first build). Cropping the bars away would make a 2.4:1 clip whose bars ease in and out per
  shot; not done.
- **MP4 first.** Chrome writes H.264 in MP4 (`video/mp4;codecs=avc1.42E01F,mp4a.40.2` is supported in the Chrome on this
  machine), Safari writes nothing else, Firefox writes WebM. iOS Photos, X and Instagram take MP4 and refuse WebM.
- **30 frames a second, about 2.5 Mb/s at 720p**, 1.4 times that a pixel held upright (the phone's encoder spent half of
  what it was asked and its sky came out in blocks in the first build), 128 kb/s for the sound.
- **The recording dot is off-white**, not vermillion: ART.md 1 gives vermillion to the rider and the one primary.
- **Save Clip has its words.** The first build had a film-frame icon alone beside the camera; the critic could not tell
  it from a ticket or a replay. It is now a soft pill like Home.
- **The reel's last frame now holds.** `reelshow.ts` meant to hold the last frame 1.1 s before the results came back,
  but the frame's look-up of the next shot ended the reel first, so the hold never ran. It runs now (1.1 s for the
  watched reel, 1.8 s for a clip, under the run card). Watch Your Run gains that second at its end.

## The clips: formats, sizes and durations

Every clip below was saved from the results by a click on Save Clip, downloaded (playwright's download event, the
file kept beside its frames), then loaded into a `<video>` on the page: its type, its size, its duration as the
element reads it (finite at once: Chrome's MP4 carries it; no seek to the end was needed), its picture size, and a
second and a half played to see it decode picture and sound. Four frames were grabbed from each and looked at.
Chrome on this machine (Google Chrome, headless, `channel: chrome`) wrote MP4 every time:
`video/mp4;codecs=avc1.42E01F,mp4a.40.2`. Firefox (WebM, VP9 or VP8 with Opus) and Safari (MP4) were not run here: no
such browser on the machine; the format pick for each is in `tests/clip.test.ts`.

| Sitting | Device, tier | Mountain | Shots | Size (px) | Duration | File | Sound |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desk1 | desk, High | Pinecrest | leap, pass, finish | 1280 x 720 | 15.01 s | 4.96 MB | yes (the first build's `lastClip.sound` said no: it was read after the tap was let go; fixed) |
| desk2 | desk, High | Sakura Ridge, mirrored | piece, leap, finish | 1280 x 720 | 16.74 s | 4.67 MB | yes |
| desk2 | desk, High, reduced motion | Ember Peak | leap, piece, finish | 1280 x 720 | 15.71 s | 4.88 MB | yes |
| phone1 | phone 390 x 844 at 2x, Medium | Frostfang Glacier | piece, leap, finish | 584 x 1266 | 16.59 s | 2.10 MB | yes |
| phone1 | phone, Medium | Pinecrest, mirrored | pass, leap, finish | 584 x 1266 | 17.31 s | 2.23 MB | yes |
| desk3 (after the critic) | desk, High | Sakura Ridge, mirrored | piece, leap, finish | 1280 x 720 | 16.32 s | 5.21 MB | yes |
| desk3 | desk, High | Pinecrest | pass, leap, finish | 1280 x 720 | 16.54 s | 5.27 MB | yes |
| phone2 | phone, Medium | Frostfang Glacier | piece, leap, finish | 584 x 1266 | 16.17 s | 2.54 MB | yes |
| phone2 | phone, Medium | Sakura Ridge, mirrored | leap, pass, finish | 584 x 1266 | 16.29 s | 3.15 MB | yes |
| phone3 (after the second critic) | phone, Medium | Ember Peak | leap, pass, finish | 584 x 1266 | 18.34 s | 4.64 MB | yes |

- From the click to the first recorded frame: 1.9 to 2.1 s (the reel's code is already loaded once watched; the scan
  of the record and the first card). From the click to the file: 17 to 19 s.
- The phone's canvas is Medium's 585 x 1266 (its pixel ratio); the clip is 584 x 1266 (even, for H.264), never scaled
  up. A desk canvas larger than 1280 x 720 is scaled down to it.
- The clip's wall time is 0.4 to 0.7 s longer than its duration after the critic's fix: the recorder pauses through
  the end of each long dip.
- Reduced motion: the reel's cuts, cards and holds as they are, no slow frame at the apex and no moves (the reel's
  own rule); in the clip the cards and the dip land without their fades.
- The console: no error and no warning from the page on any sitting (each job a fresh page load after one warm-up
  load of the origin), through the cancel, the save, the readback and the second tap.

## CrazyGames: what the SDK allows today, and what the owner must decide

Read on docs.crazygames.com on 23 November 2026 (read only; nothing signed in to). No SDK call and no ad placement was
added.

- **Sharing and invites.** `game.inviteLink(params)` builds a link to the game with your own parameters (the game
  already uses it for challenge and reel links), `getInviteParam(name)` reads one back. `showInviteButton` and
  `hideInviteButton` are marked deprecated, replaced by Room Data (`updateRoom`, `leftRoom`, a join listener) for
  multiplayer rooms and "join a friend". **There is no SDK call to share an image or a video, or to post to a feed.**
- **Friends.** `user.listFriends({ page, size })` returns a logged-in player's CrazyGames friends (id, username,
  picture), 50 a page; "Users must have a CG account and be logged in". Nothing sends anything to a friend.
- **Leaderboards.** One leaderboard a game, "only available for invited games"; scores are submitted encrypted from
  the client (`user.submitScore`) or, recommended, from a server through their API. No client call to read rankings is
  documented.
- **Rewarded ads.** `ad.requestAd('rewarded', { adStarted, adFinished, adError })`: mute and pause on `adStarted`,
  reward only on `adFinished` (never on `adError`), the offer optional and saying a video is needed, with an
  alternative; not too often, not chained, never on the active gameplay screen, not on every death; players with an ad
  blocker must still be able to play. Examples of a reward: an extra life, a retry, a starting item, a cosmetic.
- **Downloads in the frame.** The docs say nothing about the iframe's sandbox, `allow-downloads`, `navigator.share`,
  the clipboard or `window.open`. They do say: no popups ("might interfere with fullscreen behaviour"), no custom
  fullscreen button, no App Store links, no cross-promotion; user-generated content that others see needs moderation.
  A saved clip or photo is the player's own file, seen by nobody else through the game, so the moderation rule does not
  reach it.
- **What I found about downloads, and the fallback built.** Whether a download works in CrazyGames' frame is still
  unknown: nothing public names the frame's sandbox flags. If the frame is sandboxed without `allow-downloads`, Chrome
  drops the download with a console message and no error the page can see, so the game cannot tell. The fallback built:
  the clip is kept for the results it was made on, and a second tap of Save Clip hands it to the share sheet straight
  from the tap (`navigator.share({ files })`, on phones and desktop Chrome on Windows and macOS) or downloads it again
  inside the tap; in a frame or where the sheet exists, the toast says "Tap the clip again to share it". A new tab is not
  used (CrazyGames: no popups). **A person must press Save Clip and Save Photo on the portal (desk and phone) before the
  release**; if neither the download nor the sheet works there, the main lane should hide both on the CrazyGames
  platform (`onSaveClip` is set where `canRecordClip()`; add `&& platform !== 'crazygames'`).
- **For the owner to decide:** (1) whether to ask CrazyGames for `allow-downloads` / `web-share` on the frame if the
  portal test fails; (2) any rewarded placement (none added; the docs allow a cosmetic or a retry as a reward, and the
  round's brief says ask first); (3) whether to apply for the leaderboard (invited games only; a server is
  recommended, which the game does not have); (4) whether a "challenge a friend" built on `listFriends` is wanted (it
  would need a logged-in player and still could only hand over an invite link).

## The critic

A fresh general-purpose agent (Opus, high effort), told only ART.md's path and the folder `shots/r8/share/critic1/`
(32 frames: results screens with the control, the screen while a clip records, four frames grabbed from each of five
clips, three photos), and asked: is this a clip a player would want to share; does the control read on the results
without crowding them; is anything broken, cluttered or off ART.md.

**Its verdict:** "Only the start and the end": the opening beats (a caption over a clear shot of the rider) and the run
card at the close work; the middle loses them. The control does not crowd the foot, "but you can't tell what it is".
The photos "are clean: the card is placed correctly and the frame has no HUD".

| Named, worst first | Done |
| --- | --- |
| The pass beats show nothing: a blank ink screen under the card, a near-black veil | The clip's dip is 0.5 s of card over ink; the recorder pauses for the rest of the reel's dip. |
| Wrecks and filler between captioned beats (the rider upturned, thrown off) | Left: they are the run as ridden (a leap that ends in a tumble is that leap). The clip keeps only the three best claims. A clip that drops shots with a crash in them would need the scan to mark them (`reel.ts`, the reel's). |
| Overhead lenses shrink the rider (the reel's wide lens, an orbit looking down) | Left: the reel's lenses (`reelcam.ts`) are the reel's design ("wide: the mountain the subject and the rider small in it"), shared with Watch Your Run. For the main lane. |
| After a reel, the results' lens sits inside the rider | Found on the way back from a clip (and so from Watch Your Run): the results come back with the lens wherever the reel's last lens left the chase. Pre-existing in `endReel`; for the main lane. |
| Phone type too small; card and caption in the bottom tenth | Fixed: a clip held upright sizes its caption from its width and keeps both out of the bottom tenth; the run card (clip and photo) sizes itself from the width of an upright picture. |
| Phone clips compressed | Fixed: 1.4 times the bits a pixel held upright. |
| The run card straddles the letterbox's edge | Fixed: the card stands wholly above the bar. |
| A mirror run's card names the mountain plainly | Fixed: "Mirror Sakura Ridge". |
| Low's photo may show speed streaks | Checked: photo mode zeroes the post's speed streaks (`World.photo`); the lines are the snow's own relief and the sled's tracks, the same on the screen before the photo. |
| The primary button's sub-line cut ("done before, so a…"); "Charm: Slipstream…" cut; Frostfang offered on a Frostfang run | The spine's and the screens lane's (results copy); for the main lane. |
| The recording dot is vermillion | Fixed: off-white. |
| The control's icon reads as a ticket or a replay | Fixed: Save Clip with its words. |
| A phone photo is 585 px wide | The canvas at Medium's pixel ratio, as the photo lane decided; left. |

**A second fresh critic** (the same brief and question, a new agent, the after-fix frames in `shots/r8/share/critic2/`,
27 frames): "Partly" shareable: "The flights are worth sharing" (it named three frames as ART.md 11's frame); Save Clip
"reads, and it doesn't crowd ... the same weight as Home and Details, under the one vermillion button, on both desk and
phone"; the photos "are the cleanest part ... the mirror mountain correctly not reversed"; "The colour roles hold
everywhere I looked". What it still named, and what was done:

| Named, worst first | Done |
| --- | --- |
| The reel's lens lands on dead shots (behind a torii's beams, straight down on blank snow) | The reel's lenses (`reelcam.ts`), as the first critic found: for the main lane (a line-of-sight test like the photo lens's, a cap on the wide lens's pitch). |
| Phone clips still compressed | The encoder spent under half of what it was asked held upright (2.5 MB for 16 s asked 2.8 Mb/s): it is now asked 2.4 times the desk's bits a pixel, up to 4.5 Mb/s. The next phone clip (`phone3/`, Ember) came out at 2.0 Mb/s, 4.6 MB for 18.3 s, and its frames are clean of blocks. |
| The clip does not tell the race (a pass named, the passed rider out of frame); nothing names the game before the end card | The first shot's card now carries "GHOST SLED  <MOUNTAIN>" small over its kicker. The pass framing is the reel's lens (for the main lane). |
| The desk results cover the rider; cut copy | The results' layout and copy (screens and spine lanes'): for the main lane. |
| The end card washes out a bright finish, a third of the frame on a long mountain name | Left: the card is the photo's, at its size, above the letterbox. |
| While saving, "Recording" looks like a button; Cancel's double ring | "Recording" is now a line of scene text with its dot, not a pill. The ring is the focus ring on Skip/Cancel the reel's page gives at open (a scripted click shows it; a mouse click does not), kept for keyboards. |
| The photo control is unlabelled | The photo lane's camera; it now has a tooltip. A label would wrap the phone's foot (Home, Photo, Save Clip, Details): for the main lane. |
| The phone photo's "GHOST SLED" about 7 px | It is 11 px in the 585 px photo (13 px at the card's unit 0.86); the line is the card's smallest by design. |
| The tags and an edge chip show on screen while saving, not in the clip | By design: the clip is taken before the tags are drawn, as the photo is (ART.md 10: the HUD never). |

## Cost

Measured in this lane's sittings while the trials lane ran (so no frame rates: only same-run measures). Raw output in
`shots/r8/share/cost/`. "Before" is r8-stretch at 0dfc4d1, built from a clean export of that commit.

| What | Before | After | Note |
| --- | --- | --- | --- |
| A Low frame's GL calls, Pinecrest (`glcount.js`, 10 s of a ride, interleaved a b b a) | 475.0, 520.3 | 472.0, 474.9 | Level: nothing in a run is new. The run's frame has no changed line; the results add a button. |
| The same, Ember | 476.9, 489.2 | 473.4, 486.3 | Uniform calls a frame 216 to 236 on both builds. |
| The first frame (`gs-first-frame`) | | nothing new before it | The clip's code (`clip.ts`, `cliptake.ts`) is its own chunk, loaded with the reel when a player asks; a test holds every static import of it out. |
| The main bundle | JS 3,205,382, CSS 196,667 bytes | JS 3,208,758 (+3.4 KB), CSS 196,767 (+0.1 KB) | The control, `canRecordClip`, the clip's hooks in app.ts and the icon. |
| Lazy chunks | reelshow 15.30 KB JS, 2.07 KB CSS | reelshow 16.51 KB, 2.63 KB; clip 3.10 KB; cliptake 5.00 KB | Loaded on Watch Your Run (reelshow) or Save Clip (all three). |
| While a clip records, the main thread a frame | none | 0.13 to 0.19 ms (124 to 190 ms over 924 to 1,006 frames a clip, desk and phone) | One `drawImage` of the canvas into the clip's 720p canvas and the cards; no GL call of the game's. The encoder is the browser's own thread. |
| Draw calls and frame time on the results when nothing is saved | | unchanged | No WebGL work is added anywhere outside the clip's take (the test holds `captureStream`, `MediaRecorder` and the audio tap to `cliptake.ts`); the results gain one DOM button. |
| Memory | | one clip (2 to 5 MB) held while its results stand, for the second tap | Let go when the next run starts. |

## web-design-guidelines (Vercel's Web Interface Guidelines, fetched fresh) over reelui.ts, reel.css, sequence.ts, photo.css, icons.ts

Clean after two fixes: the waiting state reads "Getting Ready…" (a loading state ends with an ellipsis), the dot is
`aria-hidden`, the failure toasts say what to do ("Try Save Clip again"). Already clean: Save Clip is a `<button>`
with its words (and an icon), the chip is `role="status"` (polite), Cancel is the reel's focused button with Escape,
Title Case on the controls, transform and opacity only (the dot's breath is opacity), the breath stops under reduced
motion, 44 px targets, no `transition: all`.

## Touched outside my files

- `src/game/reelshow.ts` (the reel lane's): `ReelHost.clip` and the `ReelClip` hooks; a clip uses `clipCut`, has no
  pause, watch-again or share, and starts its recording at the first cut; the last frame's hold now runs (it was
  skipped), 1.8 s for a clip.
- `src/ui/reelui.ts`, `src/ui/reel.css` (the reel's page): the recording chip and Cancel in Skip's place.
- `src/game/app.ts`: `canRecordClip`, `onSaveClip`, `saveClip`, `clipHooks`, `offerClip`, `clipKept`, `lastClip`;
  `startReel` takes `clip` and loads `cliptake.ts` with the reel; the frame loop and `visibilitychange` hold a clip;
  `runCard` names a mirror mountain.
- `src/game/photoshoot.ts` (the photo lane's): `FACE` exported; `drawRunCard` takes the card's bottom edge and sizes an
  upright picture's card from its width.
- `src/audio/engine.ts` (`clipTap()`) and `src/audio/graph.ts` (`last`): the mix's last node for the clip's sound.
- `src/ui/contract.ts` (`onSaveClip`), `src/ui/results.ts` and `src/ui/sequence.ts` (the clip in the foot; the camera
  also has a tooltip now), `src/ui/photo.css` (the foot's spacing), `src/ui/icons.ts` (`clip`, a film frame).

## For the main lane to wire or decide

- **CrazyGames:** press Save Clip and Save Photo on the portal (desk and phone). If neither the download nor the second
  tap's share sheet works there, hide both on that platform (`onSaveClip` and `onPhoto`'s save), or ask CrazyGames for
  `allow-downloads` and `web-share` on the frame. No SDK call was added; the owner decides on any rewarded placement,
  the leaderboard application and a friends feature (above).
- **The reel's lenses and the clip's middle:** both critics named the reel's high wide lens and an orbit looking down on
  blank snow, a pass shot that does not frame the rider passed, and wrecks inside a shot. These are `reelcam.ts` and
  `reel.ts` (shared with Watch Your Run); a line-of-sight test for the reel lens (the photo rig has one) and a pitch
  cap on the wide lens would lift both the reel and the clip.
- **After a reel (watched or clipped) the results come back with the lens where the reel's last lens left the chase**
  (once, inside the rider's head on Ember) and replay their sequence. Pre-existing in `endReel`; worth a look.
- **The clip's length** is a constant pair (`CLIP_SHOTS` 3, `CLIP_MAX_TICKS` 13 s); the whole reel is one change away
  if the owner wants it (about 30 to 40 s and 10 to 15 MB).
- **Merge:** `reelshow.ts`, `reelui.ts`, `reel.css`, `sequence.ts`, `photo.css` and `app.ts` are touched; the
  trials lane may touch the results' foot or `app.ts` too.
- **Fold** the DECISIONS, ART.md and README text below.

## What only a person can judge

- Whether a clip of 15 to 17 s, three shots and the run card, is one a player sends; whether the whole reel would be
  better (`CLIP_SHOTS`, `CLIP_MAX_TICKS`).
- Whether Save Clip and the share sheet work on CrazyGames' portal, desk and phone (and Save Photo).
- How the clip plays in the apps it is sent to (WhatsApp, Messages, Discord, X, Instagram): the MP4 plays in Chrome
  here, its duration reads back, but no app was tried.
- On a real phone: whether recording costs the reel frames (the encoder is the browser's; this machine's headless
  Chrome showed 14 to 48 dropped frames in playback of 500 to 1,000), and whether iOS Safari saves the file or needs
  the second tap.
- Whether the off-white breathing dot reads as "recording".

## What is still short

- **No browser but Chrome was run.** Firefox's WebM and Safari's MP4 are covered by the format pick's tests only. A WebM
  from Firefox may carry no duration in its header (Chrome's WebM did not, before it wrote MP4); a player that cannot
  seek it would want the duration written in after the fact (an EBML patch of the Segment Info), not built.
- **No real phone.** The phone sittings are Chrome's mobile emulation on this laptop's GPU and encoder; a real phone's
  hardware encoder and its frame time while it records are unmeasured.
- **The clip's middle** is the reel's: its lenses and its choice of shots (both critics). The clip only cuts it short.
- **The share sheet** was checked by a stand-in (`navigator.share` recorded the file it was handed: the MP4, its name
  and size); no real sheet opened.
- **Low** was not recorded: the brief asks desk High and the phone Medium; Low would record its own picture the same way.

## The text to fold into DECISIONS, ART.md and the README

**DECISIONS (the next number), G11, Share it: the reel saved as a clip, the photo's card checked** (`notes/r8-share.md`;
clips, frames and screens under `shots/r8/share/`).
- *The clip.* Save Clip beside the camera in the results' foot plays the run's reel again, cut to its three best shots
  (the end and the next two of the reel's claims, at most 13 s of the run), and records the canvas as it plays: the
  picture with no HUD and no tags (taken in the picture's own callback), turned over on a mirror mountain, the reel's
  letterbox and its cards, a short dip at each cut, and the photo's run card over the last 1.8 s, with the game's mix
  tapped after the master. MP4 (H.264, AAC) where the browser writes it, WebM where not; 720p at most either way up, 30
  frames, about 2.5 Mb/s (1.4 times that held upright); 15 to 17 s and about 5 MB on desk, 2 to 3 MB on the phone;
  named like the photos. Nothing records, encodes or taps the mix until a player asks (a test holds the stream, the
  recorder and the tap to one factory that runs at the first cut); the code is its own chunk. While it records, a chip
  says so and Cancel (or Escape) drops it; a second tap on the same results hands the clip to the share sheet. Where a
  browser cannot record the canvas, no button.
- *The photo's card.* Saved and looked at on High, Low, the phone and mirrored runs on all three: none flipped wrongly.
  Fixed: an upright picture's card is sized from its width (it was 5 to 8 px of type on a phone's photo), and a mirror
  mountain's card says "Mirror".
- *The reel's last frame holds* (1.1 s; 1.8 s in a clip): it was skipped by the frame's look-up of the next shot.
- *A fresh critic* on 32 frames: the clip's opening and its end card work, its middle did not (long dips to ink, small
  type on the phone, blocky phone video, the card over the letterbox's edge, an unlabelled icon); those fixed. Left for
  the reel and the results: the reel's high lenses, wrecks inside a shot, the results' lens after a reel, cut copy.
- *CrazyGames* offers invite links (used), Room Data for multiplayer, a friends list for logged-in players, one
  leaderboard for invited games and rewarded ads under its rules; nothing shares an image or a video. No SDK call and no
  ad were added. Whether a download works in its frame is untested; the second tap's share sheet is the fallback.

**ART.md, section 10 (UI), round 8:**
- **A clip is the reel, short, as the player saw it.** Save Clip (a soft pill with its words, beside the camera in the
  results' foot) plays the run's reel cut to its three best shots and saves it: the picture with no HUD and no tags,
  turned over with a mirrored page, the letterbox, each shot's card (the small word in 800 caps, the line in italic 900
  with the scene text's ink halo) for its first moments, a half-second card over ink at each cut, and the run's card
  from the photo over the last frame, above the letterbox. Held upright, the type is sized from the width and kept out of
  the bottom tenth. While it records, an ink chip with an off-white dot that breathes says "Recording" beside Cancel.

**README (features, round 8):** "Save Clip: from the results, save your run's highlight reel as a short video (about
fifteen seconds, the best moments and your run's card, with the game's sound) to share; tap it again on a phone to send
it straight to an app."
