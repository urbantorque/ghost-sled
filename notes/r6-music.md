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
until the drop's pad is built half a bar ahead. A drop may land on a bar line or on beat 2, 3 or 4; off the bar
line the bar is cut to 1/4, 2/4 or 3/4, the oldest edit in the book, so the music meets the picture instead of the picture
waiting up to a bar for the music. A breakdown: a set piece ridden out or a wipeout drops to the bridge (pad,
bells recalling the hook, a shaker) at the end of the chorus's phrase, never mid-line. The lift: the line into the
last stage lands its drop a whole tone up. Measured on the four best pool runs: stage lines and finishes landed a mean 0.18 s from
the crossing (the worst 0.40 s), the set pieces 2.0 to 2.5 s after their cards (which come up about 2.2 s out). Two drops a few seconds apart sounded like a hiccup on paper, so a drop into a chorus
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

Measured in one sitting each, headless Chrome on the laptop. Before is d8aae90's audio (round 5's music with the
probe-only meter); after is this branch. Mountains in the order Pinecrest, Frostfang, Ember Peak, Sakura Ridge.

| Measure | Before | After |
| --- | --- | --- |
| Mix, integrated (LUFS) | -18.1 / -18.0 / -18.5 / -18.4 | -16.3 / -15.7 / -15.9 / -16.0 |
| True peak (dBTP) | -6.6 / -6.3 / -6.8 / -6.7 | -1.2 on all four (the limiter's ceiling) |
| Loudness range (LU) | 2.6 / 2.7 / 2.7 / 3.1 | 2.7 / 3.7 / 3.0 / 3.1 |
| L/R correlation | 0.64 / 0.61 / 0.66 / 0.63 | 0.62 / 0.59 / 0.75 / 0.63 |
| Lost folded to mono (LU) | 1.2 on all four | 1.2 / 1.3 / 0.9 / 1.1 |
| Lost through a phone's band (LU) | 3.1 / 2.9 / 3.4 / 3.0 | 3.1 / 3.0 / 3.5 / 3.1 |
| Limiter, deepest gain reduction (dB) | (no readout) | 0.3 / 0.3 / 0.4 / 1.2; never more than 1 dB in a quarter second but 0.8% of them on Sakura |
| Sidechain, share of quarter seconds the music gives way more than 1 dB | none | 27% / 30% / 26% / 32% (at most 5 dB) |
| Music alone, Pinecrest (LUFS, LRA, correlation, mono, phone) | -22.8, 2.1, 0.88, 0.4, 3.3 | -19.0, 5.5, 0.79, 0.6, 2.9 |
| Effects and ambience alone, Pinecrest (LUFS, LRA) | -19.9, 3.5 | -18.5, 4.0 |
| Music against the effects | 2.9 LU under | 0.5 LU under |

The mix sits within 0.3 LU of -16 on three mountains and 0.3 over on Frostfang; the true peak never passes -1.2
dBTP. The music alone moves more than twice as much as it did (LRA 5.5 against 2.1), but the whole mix moves only a
little more (the effects and the wind fill the breakdowns; this is the first 70 s of a skilled run, the busiest
stretch). Mono and phone losses did not move: the bass's harmonics and the kick's click win back what the louder
low end costs (Ember, the deepest mountain, loses 3.5 LU on a phone; a human should check it there). Sakura's
limiter peak (1.2 dB, once) is a stacked moment. The first build put the loudness gain after the limiter, where it
could lift a peak to +0.8 dBTP; the loudness probe caught it and it was fixed before any of these numbers.

### Audio main-thread cost (scripts/playtest/audiocpu.js, engine.debugCpu; Pinecrest, 8 s to 48 s in)

engine.debugCpu() times every frame call (update, beats, simEvent) and every scheduler pass with performance.now()
and counts every node the context makes, per second of wall clock. Two sittings: the first before-pass alone (the
table at the top of the round), then before and after interleaved in one session, which is the comparison that
counts: other lanes were running browsers on the same laptop, and the same before build read 24.5 ms/s at 6x
alone and 52 to 53 ms/s an hour later.

| Run, tier, CPU (interleaved, one session) | Before: ms a second (frame + scheduler), nodes a second, in a frame | After |
| --- | --- | --- |
| Hands-off cruise, High, 1x | 9.8 (4.9 + 4.9), 45.7, 0.3 | 10.6 (5.2 + 5.4), 32.6, 0.32 |
| Hands-off cruise, Low, 6x, pass 1 | 52.7 (23.4 + 29.3), 40.6, 0.2 | 33.0 (19.9 + 13.2), 30.2, 0.2 |
| Hands-off cruise, Low, 6x, pass 2 | 52.2 (22.2 + 30.0), 45.1, 0.22 | 42.7 (24.2 + 18.5), 31.3, 0.2 |
| Best pool run (skilled), Low, 6x | 81.9 (27.5 + 54.3), 114.1, 6.9 | 67.3 (33.4 + 33.8), 64.9, 6.3 |

The band costs less on Low than before, by 10 to 20 ms a second at 6x, and makes 30 to 45% fewer nodes; on High
at 1x it costs the same (0.8 ms a second more, under a tenth of a percent of a core) for the fuller arrangement.
The scheduler's share fell most (nodes for notes are gone; a note is now a handful of automation calls on a lane);
the frame's share is level on a cruise and 6 ms a second higher on the skilled run at 6x (the cues' grid and chord
lookups and the landmark planning; none of it makes nodes: nodes made inside a frame are level at 0.2 and 6 to 7
a second). A first version of the lanes, before Low's lighter band, measured 40.6 ms/s at 6x against 24.5 for the
before build in separate sittings; that comparison was confounded by the machine's load and is why the table above
is interleaved. Low's band: the kick does not pump, the arp plays at half rate on two lanes, hats keep to the
eighths, the lead is plain (no breath, no vibrato), the pad is four notes in mono, no octave double, no sparkle,
two choir voices. Not measured: frame rate (the main lane's probes own it).

### The arrangement on live runs (scripts/playtest/arrange.js)

Each mountain's best pool run (`?demo=0`, High), every landmark beat against the nearest drop the band landed (seconds,
+ = the drop after the crossing). Pinecrest and Ember were read before drops could land on beat 2 and before the
deceleration term; Frostfang and Sakura after. No moment beats on this branch yet (the main lane's sim), so the
set pieces' drops are timed from the course alone.

| Mountain | Stage line 1 | Stage line 2 (the lift) | Finish | Set pieces: card to drop |
| --- | --- | --- | --- | --- |
| Pinecrest | +0.27 | -0.20 | -0.01 | 2.5, 2.5, 2.1 s |
| Frostfang | -0.40 | +0.04 | -0.12 | 2.0, 2.2, 2.0 s |
| Ember Peak | +0.13 | +0.07 | -0.25 | 2.3, 2.0, 2.4 s |
| Sakura Ridge | +0.13 | +0.26 | -0.25 | 2.4, 2.3, 2.2 s |

A mean of 0.18 s off the line, the worst 0.40 s (Frostfang's first line, just after Serac Gate's collapse slows the
rider inside the last 1.4 s, when the drop is already locked). The finishes land a little early (0.01 to 0.25 s):
the slam then plays on the crossing itself rather than the next sixteenth. Cards come up about 2.2 s before their
places, so the drops at 2.0 to 2.5 s after them are the places' first metres. The chorus (the hook) played 32% of
Pinecrest's run, 50% of Frostfang's, 51% of Ember's and 62% of Sakura's, against round 5's lead, which only a drive
of 0.82 brought in. Every run opened on its intro (2 bars), broke down to a bridge after a set piece's exit at the
end of a phrase, and closed on the finale and the results' reprise. No console errors on any run.

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
