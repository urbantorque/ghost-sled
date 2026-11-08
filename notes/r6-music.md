# Round 6, music and sound lane: notes for the main lane

Plan changes 4 and 5 (DECISIONS 240). Decisions in the voice of DECISIONS.md, then the numbers, then what the
main lane must wire. Nobody has heard any of it; LISTENING.md says what to listen for.

## Decisions

**The music is written, not walked.** Each mountain has a song (src/audio/score.ts): a two-bar intro, an 8-bar
verse, an 8-bar chorus and a 4-bar bridge, one chord a bar, as scale degrees, with a hook over the chorus (a
4-bar phrase and an answer that turns through the borrowed chords), a sparse answering line over the verse and a
build chord the bar before a drop leans on. Pinecrest is D major at 112 and climbs (its chorus answer lands on
the bVI and bVII before home); Frostfang is F# dorian at 100 with long notes over glass bells and a half-time
snare; Ember Peak is C minor at 124, a riff of repeated notes over a pumping kick, with a phrygian bII before the
major V; Sakura Ridge is Eb major at 96, swung, pentatonic, its chorus ending on the minor iv. The title has a main
theme (D major at 88), and the results play it again slower in the key the run ends in, so the game opens and
closes on one tune. All of it is original. I rejected a theme per mood (a mood is a colour on a run, not a
place): a mood keeps its key, mode, tempo, drums and timbres and plays the mountain's song in its own mode, so a
Blizzard on Pinecrest is still Pinecrest's hook, in A minor. That is why the songs are degrees: a borrowed chord
or note is written as the major scale's degree plus a shift, so the bVI stays a bVI in any mode, and a test holds
every hook at 85% or more of its on-beat notes on its chord.

**The run is arranged against the run.** The form (src/audio/form.ts) is intro, verse, chorus, verse, and so on,
with three things that cut across it. A drop: a set piece, a stage line or the finish lands on the band's beat
nearest the moment the rider gets there, the bars before it build (a riser, a snare roll rising from eighths to
sixteenths, hats in sixteenths, the kick out for the last two beats, the bass out for the last eighth), and the
drop starts a chorus on its downbeat with a crash and a boom. The engine knows when the rider gets there: it reads
the course's stage lines and set pieces (planMoments, the same list the director plays) and the rider's speed
down the course, and plans each drop when it is 3.4 s out (the finish 4.6 s), re-planning as the speed changes
until the drop's pad is built half a bar ahead. A drop may land on a bar line or on beat 3 or 4; on beat 3 or 4
the bar is cut to 2/4 or 3/4, the oldest edit in the book, so the music meets the picture instead of the picture
waiting up to a bar for the music. A breakdown: a set piece ridden out or a wipeout drops to the bridge (pad,
bells recalling the hook, a shaker) at the end of the chorus's phrase, never mid-line. The lift: the line into the
last stage lands its drop a whole tone up. Measured on Pinecrest's best pool run: stage lines landed 0.27 s after
and 0.20 s before the crossing, the finish 0.01 s before it, the set pieces 2.1 to 2.5 s after their cards (which
come up about 2.2 s out). Two drops a few seconds apart sounded like a hiccup on paper, so a drop into a chorus
still in its first phrase jumps to the second phrase instead of restarting it, and a set piece within 40 m of a
stage line is the same drop. Rejected: a drop on the next bar line only (up to 2.1 s late at 112 bpm, a whole
leap); stretching the tempo to meet the place (a 30% swing to make a bar fit); planning from the card alone (it
is 2.2 s out at a cruise, but not at 9 m/s, and a stage line has no card).

**A cruise has a melody.** Round 5's lead came in at a drive of 0.82 and most runs never reached it. Now every
chorus carries the hook at a plain cruise, a verse carries the answering line from the second stage (or a drive
of 0.45), and the run opens on the hook's first bar rung on bells. The skill still owns what it owned: the clap,
the sparkle, the choir, the arp's octaves when the band opens up, and the hook doubled an octave up (which the
last stage's choruses also get).

**Notes make no nodes.** The bass, the melody and its octave double, the arp (three or four lanes it rotates
over, panned apart) and the drums are persistent lanes (src/audio/lanes.ts) built once per deck, one a scheduler
pass, and every note retunes and re-envelopes them by automation. Envelopes are pairs of setTargetAtTime, which
start from wherever the parameter is, so a note retriggered over the last one's tail never clicks. Drums are
synthesized once per context in JS into buffers (src/audio/drums.ts), so a hit is one buffer source; their
transients are shaped where they are made (a kick is a click, a fast pitch drop, a short hold that gives it
punch, then a soft clip that gives its body harmonics a phone can play; a snare's first 5 ms are its loudest;
hats are six detuned square partials over noise, high-passed). Only pads (one voice a bar), the choir, bells,
sparkle and the danger pulse are still voices. Low gets a lighter arrangement of its own anyway (Music.lite):
two arp lanes, no octave double or sparkle, a four-note mono pad, two choir voices. Rejected: an AudioWorklet
synth for the whole band (the cost moves off the main thread, but it is a second engine to maintain, and the
lanes already cut the nodes by most of what a worklet would).

**Production.** The pad is fuller: a fifth over the root fills the hole between the bass and the chord, and its
notes alternate between two lowpasses panned half left and half right (width from panning, which folds to mono
with no comb). The bass is a pure sine sub under a saw an octave of harmonics higher through a lowpass that
snaps shut, so the line is still there on a phone. The kick pumps the pad and the bass by automation on one gain
(a sidechain without a detector: 10 to 45% by mountain, deepest on Ember). The music bus has a glue compressor
(2.2:1 from -22 dBFS, 15 ms in, 220 ms out) with its makeup trimmed away. The master is new
(src/audio/master.ts): two AudioWorklet processors inlined as a blob module, no fetch. gs-limiter is a true-peak
limiter at -1.2 dBTP (4x oversampled peak reading, a 1.3 ms lookahead held as a sliding minimum, a box-smoothed
gain, stereo-linked); gs-duck is the sidechain under the effects, a power follower on the one-shots at the
user's effects level whose gain (at most 5 dB down) drives the music bus's side gains, so the music gives way to
the effects by as much as they are loud and the everyday ducks (a stomp, a big bank) are left to it. The
deliberate gaps (the crash, a big bank's drop, the avalanche escape, a won set piece's stop) still duck by hand.
Below 25 Hz is cut on the master. Where AudioWorklet is missing the old fast compressor and its trim stay, and the
hand ducks come back. The first build put the loudness gain after the limiter and let peaks through at +0.8
dBTP; the loudness probe caught it, and it now sits in front.

**The loudness target is -16 LUFS integrated, true peak under -1 dBTP.** A browser game plays in a tab beside
video (normalized near -14) and music services (-14 to -16); at round 5's -18.2 it was the quietest thing open,
and the effects were doing the work. -16 is the AES streaming recommendation's loud end and leaves the effects'
peaks room under the ceiling without squashing them; louder would need the limiter to take more than the odd
transient. The music is brought up to sit with the effects (within a loudness unit, not 2.8 LU under them).

**The cues are in the score.** The lantern, the dash, the ward, the sky gate and the pass keep their rush or
thud on the action and put their notes on the band's next sixteenth (at most 134 ms at 112 bpm), each note moved
to the nearest tone of the chord playing; their runs move in 32nds of the band, not in fixed 40 to 60 ms. A stage
line's bells and the finish's slam land on the band's drop when one is within 0.7 s (0.5 s for the finish), so
the hit is one hit. The finish's fanfare is the main theme's opening bar on brass, in unison with the band's
finale, which quotes it on the melody over a bright tonic (major whatever the mode). The crowd at the line roars
louder for a win (1.25x) than for last place (0.55x), and a crowd beside a close race swells (up to +4 dB) and
cheers harder with it.

**Every set piece has a music moment.** The card (marquee 'enter') rings the hook's head softly on bells while
the riser builds into the drop at the place's first metre. The moment beat's 'step': gates climb the pentatonic
ladder a step a gate on the band's sixteenths, and a full chain ends on a chord; rings ring a chord that holds
and fills (root, third, fifth and octave); steps hit a taiko on the band's eighth, rising a whole tone a step.
'lead' is a rising brass stab, 'trail' a falling bell pair, 'close' a low pulse on the beat with a brief dip,
'won' a stop and the hook's head on brass and bells a whole tone up ending on a bright chord, 'lost' three soft
bells falling to the tonic, 'miss' a dull sagging note. 'start' and anything unknown are silent (the drop
already marks the start).

**Sled sounds are the runners' timbre, nothing else.** Steel Runners is the bed as it was. Sleigh Bells adds a
string of bells shaken harder as you carve; Old Timber a creak of boards in the crunch and a wooden knock on a
clean landing; Glass Chime a rubbed glass singing the key's tonic and fifth; Lantern Song a warm hum on the tonic
whose lowpass opens a step for each full lantern (read from the sim's lantern, dash and ward events). Each is a
small fixed graph built when it is chosen in the garage (never in a run frame) and moved by automation; a
landing's body swaps its parts for the same number of nodes. No cue changes, no ghost's sound.

**The jukebox and the listening guide.** `?debug&jukebox` opens a panel over the title (src/audio/jukebox.ts,
loaded with a dynamic import from main.ts behind the debug switch, so the shipped game carries none of it) that
plays the main theme, each mountain's run music by stage and section, drops, the lift, the finale, the results'
reprise, every set piece's cue and every cue in the score, by driving the real engine with synthetic frames and
beats. LISTENING.md is the route for the owner's ears and the eight calls only an ear can make.

## Numbers

### Loudness (scripts/playtest/loudness.js, BS.1770-4, the first 70 s of `?demo=0`, default sliders)

NUMBERS_LOUDNESS

### Audio main-thread cost (scripts/playtest/audiocpu.js, engine.debugCpu; Pinecrest, 8 s to 48 s in)

NUMBERS_CPU

### The arrangement on live runs (scripts/playtest/arrange.js)

NUMBERS_ARRANGE

## For the main lane to wire

- The `moment` beats (src/game/beats.ts) drive the set pieces' step, miss, lead, trail, close, won and lost cues
  (sfx.ts Sfx.moment). Nothing else is needed: the engine already routes them. Phases it does not score are
  silent.
- The drops do not need the director: the engine reads the course (World.listenSources' course, then
  planMoments) for stage lines and set pieces. If the main lane moves a set piece's z0, the music follows.
- `AudioFrame.race` (0..1) feeds the crowd's swell; it is already on the frame type, filled where the director
  fills it.
- `AudioEngine.setSledSound(id)` is ready for the garage; the choice applies at once (also to a run under way).
- One line outside src/audio: src/main.ts opens the jukebox on `?jukebox` under the debug switch.
- New probes: scripts/playtest/audiocpu.js (engine cost), arrange.js (drops against the moments), render.js (one
  offline render for A/B). loudness.js now also reports the limiter's and the sidechain's activity. levels.js's
  song check no longer expects a 16-bar A A B B loop.
- DECISIONS 88, 89, 101 and 162 are partly superseded: the lead no longer waits for 0.82, the everyday ducks
  are the sidechain's when it is live, the last stage's lift lands on a drop at its line, and most notes no
  longer make nodes.
