# Round 7, the wire lane: notes for the main lane to fold in

Branch `r7-wire`, cut from `round-7` at ead6196. Eleven lanes left hooks for each other; this lane connects
them. No sim change of any kind: nothing in `src/sim`, `src/bot` or `src/data/ghosts` is touched, and
`SIM_VERSION` is 9 as it was. Nothing in a palette, a grade, a stage or a material is touched either. The
work is in `src/game`, `src/audio`, `src/ui/notices.ts`, the camera, and small call sites in `src/render`
(listed under "Touched outside my files").

## For a player, in short

- A legend is an event: its card stays up long enough to read, the lens turns and lifts toward it, and it
  has a sound of its own. All ten legends, Lanternfall's two included.
- The slow hero frame takes a breath in the music and holds it.
- Every set piece's verb is heard as it is played: a bell rings and swings, the forge gate roars (or
  gutters), lamps catch one by one, the wake fills, the glass sings, the flame warns when it is low.
- The highlight reel's cuts land on the score.
- The Twelve get harder one rung at a time.
- Fireworks over the line are a win's. Anyone else gets two.
- A finale's fireworks no longer put the street lamps out.

## Decisions (number them as you fold them in)

W1. **The Twelve's ladder is ordered by home time, read from the records.** `twelve.ts ladderOrder()` sorts
    the eleven by their real finished record on their own home mountain in the bundled pools, slowest
    first; whoever's home is the finale (the King, Lanternfall) is last whatever their time. On today's
    pools: Rosa 2:20.5, Nessa 2:10.8, Bram 2:09.3, Pip 2:01.6, Tavi 2:01.4, Juno 2:01.0, Wren 2:00.7,
    Mila 1:58.1, Ivo 1:53.5, Kaito 1:53.3, Suki 1:48.0, then the King (1:57.7 on Lanternfall). By skill
    the order was Rosa, Bram, Pip, Juno, Nessa, Tavi, Wren, Kaito, Ivo, Suki, Mila, King: the fifth duel
    (Nessa, 2:10.8) asked for a time nine seconds slower than the third (Pip, 2:01.6), and the eleventh
    (Mila) for one ten seconds slower than the tenth (Suki). A player feels the clock, not the roster's
    skill number. Nothing is hard-coded: a re-ride of the pools re-orders the ladder by itself. Ties go to
    the roster's skill, then the key. If any of the eleven has no finished record at home the whole ladder
    falls back on skill (a mixed order would not be a total order). The King's time is not in the
    comparison at all: he is the twelfth because Lanternfall is the finale.
    *Saves:* progress was already kept by rider (`TwelveSave.beaten` is roster keys), never by rung, so a
    save made on the old order keeps everyone it beat; the next duel is the first rung still standing. A
    test pins that. *A new player's first three duels are unchanged* (Bram, Juno, Wren: Pinecrest's three),
    because a rider whose home is locked waits without blocking.
    *How:* `twelve.ts` imports the five pool files statically (they are in the main chunk already through
    `app.ts`'s glob, so the build does not grow). The UI harness's ladder uses `TWELVE` too.
    *Rejected:* ordering at load in `app.ts` (the order would differ between the app and the tests);
    hard-coding the order (it would rot at the next re-ride).

W2. **The legend look** (`camera.ts stepLegend`, `CamTarget.legend`). While a legend is in reach the
    chase turns toward its focus and, for one in the sky, lets the rider sink so the sky lifts into frame.
    Gated by the shot's `peak`. Caps: 8 degrees of turn (`LEGEND_YAW_MAX` 0.14 rad), 0.16 NDC of lift
    applied to the rider's row and to the horizon's cap together (on most slopes the horizon's cap is
    what holds the pitch, so moving the row alone did nothing: the first cut measured a pitch change of
    exactly 0), and a floor: the rider never sinks below 70% of the way down the frame. Eases in over
    about a second and out a little slower. It gives way in the air (0.4 of its weight), in a tumble and
    during the run's reveal, and the vista takes the lift from it. Within 3.4 degrees of straight ahead
    the lens does not turn at all, so a runner weaving on the line 18 m ahead is not chased from side to
    side. It never takes the steering: it is a few degrees of look, the test checks the target it is
    handed is not written, and the line ahead stays in frame. Under reduced motion the lens does not move
    (the card and the cue still say the legend), as every other move of this camera.
    *Measured on a real ride through The Cone Wakes (Ember, the line pilot, desktop High):* lift 1.0 and
    3.2 to 4.0 degrees of turn through the bridge; the rider's row goes from 53% of the height to 58%;
    the cone's summit and the column come clear of the top edge (frames `legend/desk-eruption-off-ride-3`
    and `-on-ride-3` side by side). On the steep run-in the plain chase already has the rider at 74% of
    the height; with the look it is held at 64% (the floor), where the first cut put the sled off the
    bottom of the frame behind the hint row (84%: caught in a frame, fixed, re-shot). On a phone (390x844,
    Medium, a real ride): the same lift and turn, the rider's row from 53% to 60%, the whole cone and its
    column in frame over the bridge (`legend/phone-eruption-on-ride-3.png`); a phone takes half the turn.
    *Lanternfall:* `LanternWorld.legendShot()` gives the same shape as `MarqueeWorld.legendShot()`. The
    Great Rising's focus is the valley ahead and above on its side (40 m across, 34 m up, 160 m on); the
    Tall Lamplighter's is the lantern on his pole. `world.ts` hands whichever is live to the camera.

W3. **A legend's card is not hurried off.** The card existed (the reel lane's, `notices.ts`), and plays
    for all ten legends: the director forwards the sim's legend event with the legend's own name and
    line, whichever world draws it. But any banner waiting behind another cuts it to 900 ms, and a
    mission's toast waiting behind the legend took a twelve-word card down in 1.2 s (measured: on screen
    for 40 m at 34 m/s). A legend's card now stands at least 2.6 s whatever waits (`minShowMs`);
    measured after: 2.2 to 3.8 s across four legends. An event's telegraph still outranks it.

W4. **The legend's cue** (`sfx.ts legend`). As it is said: a breath in from its side of the run, then an
    open fifth low on brass with four bells climbing a ninth and a sharp fourth over it, in the course's
    key, on the band's beat, and the band ducks under it for a second and a half. That chord colour is
    used by nothing else in the game, so it means "legend" on every mountain. As the rider reaches it: a
    quiet held fifth for five seconds and a lift in the band's drive. A ribbon's quarters (the aurora, the
    lamplighter's lane) are bells up the same chord. As it is left: two bells down.

W5. **The hero frame's breath** (`engine.ts`, `sfx.ts heroFrame`). On `lip` the score takes its breath
    (the produced score cuts to its tail, the live band ducks) and a swell of air rises with a low tone
    under it, timed by the beat's own `inS` to crest as the frame starts. On `apex` three high bells of
    the chord hang for the frame's length. The landing brings the score back as it does after any breath.
    The engine already had a breath on "the tallest leap that is not in a set piece"; the picture's hero
    leap is chosen differently (`shots.ts`), so they could fall on different leaps. Now the breath is
    wherever the picture holds, and the tallest-leap rule only fires if no hero frame came first.

W6. **Every verb's steps sound** (`sfx.ts moment`). The card's stinger was already wired for every verb
    (`marqueeCue` asks the produced score for `st.<verb>`); gates, rings and steps had step sounds; the
    other verbs' `step`, `lead`, `trail` and `close` beats were silent or borrowed the race's brass. Now:
    - *shatter:* the strike on the action, a bronze bell in the chord on the band's grid, each bell a
      chord tone higher so three ring a phrase, and the air it moves as it swings (four passes 0.42 s
      apart: the world swings it at 7.5 rad/s). This is the bell's swing.
    - *surge:* the forge gate. The sim's `step` carries the speed off the lip (whole m/s) against the
      speed asked (`of`); both speeds are whole numbers in `moments.ts` (44 and 47), so `n >= of` is
      exactly the world's own `mo.pace >= play.speed`. At speed: the roar (a thud, 1.6 s of low fire
      that opens and falls with the flames, crackle after) and the band ducks. Slower: it gutters.
    - *slide:* a note of glass a quarter (or a way), rising.
    - *kindle:* a pluck and a breath of flame a lamp, up the ladder, the chord on the last.
    - *follow:* a soft bell an eighth of the wake; back in the wake is two bells up, not a brass stab.
    - *carry:* silent while the flame is healthy (its size on the sled is the read), a dull pulse at
      three tenths and under; a gutter (`trail`) sags, a catch (`lead`) breathes in, the brazier
      (`close`) takes with a rush and three bells.
    `sfx.cues` counts what played by name; `window.__gs.audio.debugCues()` reads it (with the produced
    stingers' count).

W7. **The reel's clock** (`engine.ts clock()`, `music.ts bar()`). `clock()` returns `{ barS, beatS,
    toBar, toBeat }` from the playing deck (the live band is in four; a produced piece has its own metre:
    Lanternfall is in two), or null with no music. The reel already cut its shots to whole bars when it
    was given `barS`; it was never given one. Now it is, and each cut also waits for the score's line
    after its card: for the bar line when one comes within 0.6 s, else for the next beat, never more than
    0.9 s (`reelshow.ts cutHold`). So shots are whole bars long and every cut is on a beat; a cut is on a
    bar line when one is near. Waiting for the bar line every time would add a second a cut on a slow
    piece: rejected.

W8. **Fireworks over the line are sized by the race** (`climaxworld.ts lineShells`). The volley timed to
    break as the sled crosses is five shells at 58 m for a rider at the head of the field on the frame it
    is sent (about 1.7 s out), two at 44 m for anyone else. The two earlier volleys (landing the last
    leap, coming into the town) are unchanged: they welcome everyone. `FrameView.lead` carries it from
    the app's standings; absent reads as leading (a run alone, the reel). Low halves and rounds up, as
    before (three, or one).
    *Not done:* a duel is "won" by beating one rider's time, which is not always first place. The volley
    reads first place. A duel won from second gets the modest volley and the results' own celebration.

W9. **Fireworks hold two light slots** (`lights.ts pushSkyLight`). A burst's 150 m radius put its edge
    nearer the rider than any lamp's (the ranking is distance less reach), so a volley of eight took all
    eight slots and the street went dark exactly at the finale. Bursts are now offered as sky lights: the
    two strongest are kept (one on Low's four), the rest of the slots stay the lamps'. I chose the cap
    over ranking every light by its contribution at the rider: that ranking would also demote the lamps
    forty metres ahead, which light the snow the player is looking at and not the rider, and five review
    lanes are tuning those looks now. The eruption's 120 m glow and the lava's 85 m are not sky lights
    and rank as before.

W10. **The console warning** was an FM bell's modulator. `fmBell` runs a modulator at the carrier times a
    ratio; a gate's bell an octave up (7,685 Hz) at ratio 3.5 asked an oscillator for 26.9 kHz, past
    Nyquist, and Chrome clamps that and says so. Sidebands that far up are past hearing, so a bell whose
    modulator would pass 0.45 of the sample rate is now its carrier alone. Not seen again in any capture
    here (a trap on every `AudioParam` setter rode along in `wire.js`: it caught only FM depths on gains,
    which are legal).

W11. **The slow hero frame: left on `'render'`.** The lab cannot show anything about it: `lab.ts` drives
    the sim and the bot with no director and no time scale, so a `'both'` there changes nothing by
    construction. What is true by construction is that the feed channel only changes how many ticks a
    frame feeds the sim (`loop.advance(dt * time.feed)`), so no record or recorded time can change. But
    it is not a one-word change: `heroFrameStep` ends the frame at `apexTick + APEX_S * 60` sim ticks.
    With the feed at a third, those 48 ticks take about 1.9 s of wall time where the curve itself is over
    in 0.8, so the `out` beat, the letterbox and the depth of field would hang a second past the slow. It
    would also slow the player's own trick inputs mid-flight on the biggest leap, which is a feel call a
    person should make with hands on it. If the owner wants it: play the curve on `'both'` and end the
    frame on the director's real clock, not on ticks.

## What was verified, and how

- `npx tsc --noEmit` clean; `npm test`: 78 files, 1,564 tests, all passing (1,542 before the lane). A run
  taken while a capture was on the machine timed seven tests out at 120 s (the whole run took 520 s where a
  quiet one takes 144); the same commit run alone passes everything.
- New tests: `tests/twelve.test.ts` (the order by time, the fallback, an old save), `tests/lights.test.ts`
  (the sky cap whichever is pushed first, Low, the volley's two sizes), `tests/audioengine.test.ts` (every
  new cue on its beat on a stub context, the roar against the gutter, all twelve verbs' cards call
  something, the clock, the cut's hold, a bell never asks for a frequency past Nyquist at 44.1 or 48
  kHz), `tests/camera.test.ts` (the look: caps, both sides, scaled by peak, eases in and back, the rider
  in frame, still under reduced motion, in a tumble and for a legend behind the lens, and the target it
  is handed is not written).
- Headless Chrome, 1280x720, the build served on 4540, tools in `scripts/playtest/wire*.js`:
  - *Legends* (`wire.js`): The Cone Wakes, The Great Rising, The Tall Lamplighter and The White Stag
    ridden with the look taken out and as shipped, pinned and (the look as shipped) on a real ride. Each
    showed its card with its own name and line and played `legend.warn`, `legend.start` and
    `legend.end`.
  - *Verbs* (`wire-verbs.js`, Low, pinned sled): on the five mountains every one of the twelve verbs'
    cards played its own produced stinger (`stinger.rings`, `slide`, `steps`, `collapse`, `race`,
    `gates`, `surge`, `flourish`, `shatter`, `follow`, `kindle`, `carry`). Step cues that a pinned sled on
    the safe line sets off were heard: the forge gate guttering (34 m/s is under 44), the wake regained,
    the flame low. Console empty.
  - *The Twelve* (`wire-twelve.js`, Low, a fresh save each time, console empty in all three):
    - *A duel ridden honestly and lost.* A script steering the safe line, never pressing the action, rode
      Pinecrest as a new player: the run was the Bram Oakhollow duel, the band said "Duel: Bram
      Oakhollow. Finish ahead of 2:09.2 on Pinecrest", it finished in 2:16.7, second of six, and the
      results said "Bram Oakhollow held you off by 7.4 s." with a Rematch button. The save held no one.
    - *A duel won, by a scripted pilot that is not a ride.* I could not script an honest win: the
      line-follower is 7.4 s short and I did not write a pilot that drifts, dashes and tricks. So the win
      was timed with the sled held on the safe line at 40 m/s by writing the sim's state every frame.
      That shows only the flow from a win to the save: finish 1:52.8 on the clock (125 s of wall time
      from Ride to the results), "Bram Oakhollow falls. 1 of 12 beaten. +40 gifts", and the save holds
      `{ beaten: ['bram'] }`. No person has won a duel.
    - *The last race, ridden honestly.* A save with all twelve beaten rides Lanternfall: the field is the
      twelve (thirteen riders with you; a save with a best there adds its ghost, which this fresh save
      had none of), the band said "The last race. All twelve ride. Finish ahead of every one.", the
      line-follower rode the whole mountain (the follow, the kindle and the carry among it) and finished
      in 2:30.2, thirteenth of thirteen, 6.0 s behind Rosa; the results said "The last race stands. Finish
      ahead of all twelve." and offered it again. 157 s of wall time, about 55 frames a second on Low on
      a machine seven lanes share (not a claim about speed). The twelve ghosts' replays were not ready
      4.5 s into the run (`ready: 0`; a five-ghost duel's were): on a slow phone the last race may start
      with an empty course for some seconds. Worth a look on a real phone.
- **Only heard by a counter, never by an ear.** Every sound here was built from the engine's existing
  instruments and checked only as "it was asked for, on the right beat". Levels, lengths and whether the
  legend's chord is beautiful are a person's to judge. Listen for: the legend's cue against a busy band
  (it ducks the band to 0.6); the forge roar under the surge's stinger (they land together); "back in
  the wake" (a real ride of the follow crossed the wake's edge eleven times, so it now sounds once in any
  three seconds); the hero frame's swell under the produced breath.

## Touched outside my files

Small, each marked in place:
- `src/render/camera.ts` (hero): `CamTarget.legend`, `stepLegend`, two `aimAt` call sites, the reset.
- `src/render/world.ts` (pipe): `FrameView.lead`, one line handing it to the marquee, one line picking the
  legend shot for the camera.
- `src/render/marqueeworld.ts`, `climaxworld.ts` (momentsworld): `leading`, `lineShells`.
- `src/render/lanternworld.ts` (lanternworld): `legendShot()` and `aimLegend`. Nothing drawn changes.
- `src/render/lights.ts` (light): `pushSkyLight`, `MAX_SKY_LIGHTS`. `pushLocalLight` behaves as before.
- `src/render/fireworks.ts` (fx): one call now `pushSkyLight`.
- `src/ui/notices.ts` (reel): `minShowMs`.
- `src/ui/harness.ts` (screens): the fake ladder uses `TWELVE`.
- `src/audio/*` (music): `sfx.ts`, `engine.ts`, `music.ts`, `stemdeck.ts`, `instruments.ts`.

## For the main lane

1. **Hear it.** See above.
2. **The X3595 shader warning** ("gradient instruction used in a loop") still prints once on desktop High.
   It is a world shader's, on D3D only, and was out of this lane's reach (materials).
3. **The duel's start line can be covered.** On a fresh save the "Frostfang Glacier unlocked" toast took
   the band from "Duel: Bram Oakhollow" within the first five seconds (`twelve/duel-line-0-start.png`).
   The line was said, but briefly. A fresh mock save opening Frostfang in its first seconds may itself be
   a dev artefact; I did not chase it.
4. **`audio.clock()`** is public API now: `app.ts` no longer casts for it.
5. ART.md 8 (camera): one line, "a legend gets a look: up to 8 degrees and a lift of the sky, never under
   reduced motion". LISTENING.md: add the legend's cue, the hero frame, and the six verbs' steps to
   section 5; the jukebox has no row for them (`?legend=1` on any mountain plays the cue in a run).

## Frames

`C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\wire\`: `legend/` (`desk-<legend>-off-N` and
`-on-N`, pinned; `-ride-N`, a real ride), `twelve/` (`duel-line-*`, `duel-pin-*`, `final-line-*`).
