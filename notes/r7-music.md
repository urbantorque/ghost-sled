# Round 7, music lane: notes for the main lane

Branch `r7-music`, cut from `round-7`. Plan change 8 (DECISIONS 277): a produced score, a different style for
every course. **Nobody has heard any of it.** Everything here was written as notation, rendered offline, and
judged by measurement and by reading the score; section "What a human ear must decide" in the listening guide
below lists the calls that are still open.

## Where the lane stands

Done:

- `npm run music` (`scripts/music/build.ts`) renders, masters, encodes and measures the whole score from
  source: five courses (Pinecrest, Frostfang, Ember, Sakura, Lanternfall) and the title theme, each as sections
  by layers, with a results reprise, a build, a hit and fifteen stingers a course. 1758 s on this machine with
  six other lanes running (the renders are single-threaded; Pinecrest's bowed strings are the slow part).
- `public/music/`: 18 packs and two probe files, 56.8 MB in all (sizes below). `src/audio/produced.json` is
  the manifest (18 kB, a chunk of its own, loaded after the first frame); `scripts/music/analysis.json` is
  what the build measured.
- The runtime (`src/audio/stemstore.ts`, `stemform.ts`, `stemdeck.ts`, and the wiring in `music.ts`,
  `engine.ts`, `sfx.ts`): fetch after the first frame, a course's pack when it is picked, the Cache API,
  the decode test, a section decoded at a time, sections on bar lines, layers with the race, drops on the
  beat, the breath and the crash back in, the finale on the finish, the reprise, a stinger a verb, a motif a
  rider, the live band as the fallback.
- The jukebox plays all of it. `tests/audiostems.test.ts` (41 tests) holds the scheduler, the store, the
  packs, the measured score and the motifs.

Not done, or not as asked (details under "Not finished, and fragile"):

- Lanternfall's music has never played in a run here: this branch has no fifth mountain. It plays from the
  jukebox, and the app passes the mountain's id so it will play on the merged build.
- No course was heard by anyone. No real phone was used: the phone numbers are a headless Chrome at 390x844
  and a phone speaker's band applied to the mix.
- `npm run package` fails on its 5 MB budget with the music in the build (the main lane's call, below).

## Decisions (number them as you fold them in)

M1. **The score is produced offline, in code, and shipped as audio.** A renderer in TypeScript run by Node
    (`scripts/music/`: oscillators, a bowed string, plucks, winds, an FM bell, a felt piano, a supersaw, a
    choir, drums and metal, a reverb, a tempo delay, a tape stage, a bus compressor and a limiter, and
    BS.1770 meters). No audio-generation tool (its licence for a game sold on CrazyGames cannot be checked
    from here) and no DAW (Ableton is connected in some sessions, but nothing could be bounced and heard,
    and a build nobody can re-run is not a build). A player gets instruments the live engine cannot make at
    run time (a bowed section of five players, a choir with vowels, a hall) at no CPU cost while riding.
    Measured: the audio engine's main-thread time on Low, in the table below.
M2. **Every course has its own genre, key, tempo, metre and band.** Pinecrest: bright folk-orchestral, D
    major, 116, a fiddle reel. Frostfang: glassy electronica, F# dorian, 126, four on the floor, a major-key
    dawn. Ember: heavy industrial, E phrygian, 138 in half time. Sakura: plucked strings and a bamboo flute
    over a laid-back groove, Ab major, 84, swung. Lanternfall: a lullaby that grows into an anthem, Bb major,
    a slow 6/8 at 63. The title: the game's motif on a felt piano and strings, C major, 92. Each is argued
    against its mountain in its own file's first lines (`scripts/music/pieces/*.ts`). Measured: no two
    courses within 8 % in tempo, 2.8 dB RMS in the shape of the spectrum, or sharing more than 22 % of their
    instrument families (the table below; `tests/audiostems.test.ts` fails if any pair comes closer).
M3. **One motif runs through the game** (`pieces/common.ts` MOTIF: a rising fourth to the octave and a step
    down, a fall through the sixth, a small arch, home). The title states it, every course's finale quotes
    its first two bars, every results reprise plays it through, and Lanternfall's lullaby grows into it.
    Variety came first: no course's own hook is the motif.
M4. **Stems as sections by layers, in packs.** A course is ten sections (an intro, four eight-bar sections
    for the first two stages, a breakdown, a last-stage chorus and climb, a finale, a reprise), each in four
    layers (bed, drive, lead, peak), mastered together so any subset of layers is the mastered mix with
    instruments missing, never a different master. One pack a course, a tier and a format: every section's
    layers and every one-shot as standalone compressed files behind a small index, fetched in one request.
    A player hears the arrangement follow the run without the music ever being re-rendered.
M5. **Opus in WebM, with AAC in .m4a chosen by a decode test.** The runtime decodes a 2 kB probe of each
    (a click in silence): the first that decodes is the format, and where the click comes out measures the
    decoder's leading samples, which every start is corrected by. Encoded with `ffmpeg-static` 5.3.0 (ffmpeg
    6.1.1, a devDependency: a build tool, never shipped). Where neither decodes the live band plays.
M6. **Two tiers.** `full` (four layers a section, decoded at the context's rate) on a desktop on Medium and
    up; `lite` (two layers: bed with drive, lead with peak; decoded at 32 kHz) on Low, on phones (a coarse
    pointer and a small screen, or 4 GB or less) and wherever only AAC decodes. A piece keeps the pack it
    started with when the game changes tier mid-run.
M7. **Loading never touches the first frame or the start of a run.** The manifest, the probes and the title's
    pack are asked for two animation frames and 250 ms after the engine is made; a mountain's pack once it
    has been shown on the title for 1.2 s, or when a run starts on it; packs are kept in the Cache API
    (`gs-music-1`) and thrown away when the score's version changes. A run that starts before its music has
    arrived starts on the live band and changes to the produced score only inside its first 6 s; later than
    that the run keeps the band it has.
M8. **The run sequences the sections** (`stemform.ts`, pure, tested). Sections follow on bar lines in the
    order the stage gives; a set piece, a stage line or the finish lands a drop on the beat nearest the
    moment the rider gets there (a build that ends on it, the drums out for its last two beats, a hit); a
    wipeout or a set piece ridden out breaks down at the next four-bar line and puts the music under water
    while the rider is down; the last stage has its own chorus and climb; the finish lands the finale; the
    reprise comes in under the finale's last bar. Layers follow the race with hysteresis: the bed always,
    drums and bass once the run is under way, the lead in every chorus and from stage two, the peak layer on
    a stomp streak, in the flow, at a high drive and on the climb.
M9. **The breath.** As the sled leaves the lip of the mountain's tallest leap the score cuts to its own
    tail; the landing starts the stage's chorus from its top on a new downbeat that is that instant,
    under the hit. The brief asked for the drop-out before the leap; it starts at takeoff instead, on
    evidence: started a third of a second before the lip by position, it also fired for riders who did not
    fly, and added to a silence that is already long. The tallest leap inside a set piece is passed over (a
    set piece has its own drop). The silence lasts 4.2 s at most: on a longer flight (Frostfang's is 6.4 s
    on the replayed run) the breakdown plays under the rest of it and the landing still crashes back in. A
    leap that ends in a wipeout ends the breath without the hit. On the live band the music bus ducks
    instead.
M10. **A stinger a verb, in every course's instruments, from one table** (`pieces/common.ts` GESTURES:
    race, gates, rings, collapse, steps, follow, kindle, carry, slide, shatter, surge, flourish, plus won,
    lost and a plain one). A new verb is one entry: the build renders it for every course. It plays on the
    score's next beat as the set piece's card comes up; the live bell call plays when the stinger is not
    there.
M11. **A motif for each of the twelve signature riders** (`src/audio/motifs.ts`, data), played by the live
    engine in the key and on the grid of whatever is playing: on the start line when the rider is called as
    your rival, and when the rider passes you (not past your wreck, and not twice inside 12 s). Notes are the
    major pentatonic's over the key's bright root, so a motif sits in any course's mode.
M12. **The master.** Each piece is levelled to -16 LUFS over its run sections with every layer in, limited to
    -1.5 dBFS on the full mix (the same gain on every stem), and enters the game's music bus after the bus
    compressor, into the sidechain, the ducks and the user's level as the live band does. The drop's hit is
    4 dB under the chorus it lands on (the reference runs read +3.5 dBTP with both at the ceiling, +1.8
    after). The game's own true-peak limiter is still the last word on the mix: in game it holds -1.2 dBTP
    and works more than 1 dB for under 1 % of a run. The score's level on the bus (`stemdeck.ts`
    PRODUCED_GAIN, 0.97) was set from the in-game measurements below, for a mix at -16 and the music level
    with the effects.

## What was measured

### The files (the build's own meters, `scripts/music/analysis.json`)

Every layer in, the run sections end to end. LUFS and LRA by BS.1770-4 / EBU R128; true peak 4x oversampled;
"after Opus" is the last-stage chorus decoded back from the shipped file. Mono loss: how much quieter the mono
fold-down measures. Phone loss: the same through a phone speaker's band (250 Hz high-pass, 9 kHz roll-off).

| Piece | Key, tempo, metre | Seconds | LUFS | LRA | True peak | After Opus | L/R corr | Mono loss | Phone loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Title | C major, 92, 4/4 | 63 | -16.0 | 3.0 | -2.2 | -2.5 | 0.84 | 0.5 | 1.8 |
| Pinecrest | D major, 116, 4/4 | 141 | -16.0 | 2.1 | -2.0 | -2.3 | 0.86 | 0.4 | 0.6 |
| Frostfang | F# dorian, 126, 4/4 | 130 | -16.1 | 2.5 | -1.2 | -1.3 | 0.81 | 0.6 | 1.9 |
| Ember | E phrygian, 138, 4/4 | 118 | -16.0 | 2.4 | -1.5 | -1.9 | 0.92 | 0.2 | 4.0 |
| Sakura | Ab major, 84, 4/4 swung | 194 | -16.2 | 2.4 | -1.4 | -1.5 | 0.94 | 0.2 | 2.1 |
| Lanternfall | Bb major, 63, 6/8 | 130 | -16.0 | 4.2 | -1.6 | -1.5 | 0.72 | 0.7 | 0.8 |

Ember loses 4 LU on a phone speaker: its weight is under 250 Hz by design (the kick, the distorted bass). Its
riff and brass carry above that, but it is the course to check on a phone first.

A run sequenced by the game's own scheduler, offline (150 s, three stages, six landings, three breakdowns):

| Course | Novice LUFS | Novice LRA | Novice TP | Skilled LUFS | Skilled LRA | Skilled TP |
| --- | --- | --- | --- | --- | --- | --- |
| Pinecrest | -16.2 | 5.7 | +1.8 | -15.8 | 5.1 | +1.6 |
| Frostfang | -16.2 | 4.9 | +1.4 | -15.8 | 5.1 | +1.8 |
| Ember | -16.3 | 5.4 | -0.3 | -15.7 | 5.7 | +0.7 |
| Sakura | -16.5 | 6.2 | +0.4 | -16.2 | 6.4 | +1.4 |
| Lanternfall | -16.1 | 7.8 | -0.8 | -15.8 | 7.6 | 0.0 |

The peaks over 0 are the instant of a drop (the old section's tail, the new one's downbeat and the hit
together), before the game's limiter. The in-game numbers, after it, are below.

Spectrum, octave bands, dB relative to the piece's level (63 Hz to 8 kHz), and the centroid:

| Piece | 63 | 125 | 250 | 500 | 1k | 2k | 4k | 8k | Centroid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Title | -8.5 | -5.7 | -7.1 | -7.0 | -9.8 | -11.7 | -17.3 | -22.5 | 567 Hz |
| Pinecrest | -9.3 | -13.8 | -9.8 | -5.6 | -6.4 | -8.0 | -12.7 | -19.2 | 1071 Hz |
| Frostfang | -6.5 | -6.7 | -11.7 | -6.8 | -7.0 | -14.9 | -21.2 | -19.0 | 655 Hz |
| Ember | -5.0 | -5.2 | -9.4 | -10.8 | -12.7 | -15.4 | -18.7 | -21.3 | 378 Hz |
| Sakura | -4.3 | -8.0 | -10.2 | -11.5 | -8.1 | -10.1 | -14.4 | -21.0 | 687 Hz |
| Lanternfall | -12.2 | -10.3 | -6.8 | -6.6 | -5.3 | -10.2 | -17.0 | -23.4 | 817 Hz |

No two courses alike (the test's three measures; a pair fails under 1.08, 2.5 dB or over 0.34):

| Pair | Tempo ratio | Spectrum shape, dB RMS apart | Instrument families shared |
| --- | --- | --- | --- |
| Pinecrest / Frostfang | 1.09 | 4.7 | 0 % |
| Pinecrest / Ember | 1.19 | 5.4 | 4 % |
| Pinecrest / Sakura | 1.38 | 3.7 | 4 % |
| Pinecrest / Lanternfall | 1.84 | 2.9 | 22 % |
| Frostfang / Ember | 1.10 | 2.9 | 0 % |
| Frostfang / Sakura | 1.50 | 3.5 | 5 % |
| Frostfang / Lanternfall | 2.00 (4/4 against 6/8) | 4.0 | 0 % |
| Ember / Sakura | 1.64 | 2.8 | 0 % |
| Ember / Lanternfall | 2.19 | 4.8 | 4 % |
| Sakura / Lanternfall | 1.33 | 3.9 | 0 % |

The closest pair by tempo is Pinecrest and Frostfang (116 and 126): they share no instrument and differ in
key, mode and feel (a swung reel against straight sixteenths), but if two courses are ever said to feel alike
in pace it will be these. Pinecrest and Lanternfall share the orchestra (strings, horns, trumpets, a field
drum, a glockenspiel): Lanternfall's are in 6/8 at half the pace, under a choir and a music box.

The bands, as the build lists them:

- **Pinecrest:** fiddle, acoustic guitar, mandolin, upright bass, stomps, claps, tambourine, shaker, tin
  whistle, horns, trumpets, string section, glockenspiel, field drum.
- **Frostfang:** glass bells, FM bell, supersaw pad and stabs, glass pad, sine lead, synth bass, sub bass, club
  kick, snare and clap, hats, piano.
- **Ember:** deep kick, big snare, distorted bass, anvils, steam, struck plate, struck girder, taiko, toms, dark
  pad, low brass, trumpets, synth lead.
- **Sakura:** koto-like pluck, plucked strings, bamboo flute, electric piano, sub bass, soft kick, rim, shaker,
  frame drum, wood block, wind chimes.
- **Lanternfall:** music box, choir, harp, felt piano, flute, string section, horns, trumpets, bells, bell
  tree, glockenspiel, timpani, concert bass drum, field drum.
- **Title:** felt piano, string section, harp, choir, flute, glass bells, sub bass, frame drum, shaker.

The score as a score (each tune: its range in semitones, the share of its on-beat notes that are tones of the
chord under them, the chords it moves over, and how far each of four pad voices moves from chord to chord):

| Piece | Tunes | Range | On the chord | Distinct chords | Voice movement, semitones |
| --- | --- | --- | --- | --- | --- |
| Title | 3 | 14 to 16 | 100 % | 7 to 8 | 1.2 to 1.4 |
| Pinecrest | 4 | 13 (the hook) to 24 (the reels) | 100 % | 5 | 0.9 to 1.3 |
| Frostfang | 3 | 14 to 19 | 100 % | 5 | 1.1 to 1.5 |
| Ember | 3 | 12 to 14 | 83 to 100 % | 4 to 5 | 1.5 to 2.1 |
| Sakura | 4 | 9 to 14 | 100 % | 4 to 6 | 0.6 to 1.3 |
| Lanternfall | 4 | 12 to 15 | 100 % | 5 to 6 | 0.6 to 1.3 |

Ember's hook leans on the flat second off the chord on purpose (17 % of its beats); every other tune sits on
its harmony. Every hook peaks past its middle (0.5 to 0.8 of the way through) except Sakura's second verse
and Lanternfall's road song, which start at the top and fall.

### Sizes (`public/music/`, MiB)

| Piece | Desktop (`full.webm`) | Low and phone (`lite.webm`) | AAC fallback (`lite.m4a`) | One section decoded, desktop | One section decoded, lite |
| --- | --- | --- | --- | --- | --- |
| Title | 0.59 | 0.50 | 0.69 | 35.0 MB (one layer: 8.7) | 11.7 MB |
| Pinecrest | 5.27 | 2.48 | 3.25 | 28.6 MB | 9.5 MB |
| Frostfang | 5.05 | 2.48 | 3.12 | 26.7 MB | 8.9 MB |
| Ember | 4.25 | 1.95 | 2.67 | 24.8 MB | 8.3 MB |
| Sakura | 5.95 | 3.50 | 4.30 | 37.9 MB | 12.6 MB |
| Lanternfall | 4.94 | 2.51 | 3.26 | 26.7 MB | 8.9 MB |
| All | 26.05 | 13.42 | 17.29 | | |

A player downloads the title's pack and the pack of each course they pick, in one tier: 0.6 MB and then 4 to 6
MB a course on a desktop, 0.5 and 2 to 3.5 on Low and phones. Sakura is the longest piece (194 s at 84 bpm) and
is encoded at 77 % of the others' bitrates to stay under 6.

### In the game (replayed runs, headless Chrome, sliders at their defaults)

`scripts/playtest/loudness.js` taps the master's last node over a whole replayed run (`?demo=0`, about 117 s,
the finale included), High tier, the desktop packs:

| Mountain | Mix, LUFS | LRA | True peak | Limiter's deepest | Limiter over 1 dB | Sidechain's deepest | Mono loss | Phone loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pinecrest | -15.8 | 3.1 | -1.2 | 1.5 dB | 0.2 % of the run | 5 dB | 0.9 | 2.2 |
| Frostfang | -15.7 | 4.4 | -1.2 | 1.3 dB | 0.5 % | 5 dB | 1.1 | 3.0 |
| Ember | -15.5 | 4.1 | -1.2 | 0.5 dB | 0 % | 5 dB | 0.8 | 3.7 |
| Sakura | -15.5 | 3.5 | -1.2 | 2.6 dB | 0.7 % | 5 dB | 0.9 | 2.9 |

Pinecrest on Low (the light pack, 70 s): -15.9 LUFS, true peak -1.2. Lanternfall cannot be ridden on this
branch and has no in-game numbers.

**The level against the effects.** The first round, with the score at `PRODUCED_GAIN` 1.15, read the mix at
-15.2, -15.1, -14.9 and -14.7 LUFS, the music alone (effects slider at 0, the first 70 s of a run) at -17.5,
-16.9, -16.5 and -16.6, and the effects alone at -18.1 (Pinecrest) and -18.6 (Ember): the music 1 to 2 LU over
the effects, and the mix 1 LU hot. Round 6's live band alone reads -19.8 on the same run. The score now sits
1.5 dB lower (0.97): the table above is with that, and Pinecrest's music alone re-measured at -19.0 (0.9 LU
under its effects). The other three's music alone was not measured again; by the same 1.5 dB they stand at
about -18.4, -18.0 and -18.1, level with the effects to within half a LU.

**Masking against the effects.** The same replayed run recorded twice, once with only the music and once with
only the effects, in octave bands: the music's level minus the effects' in each band, dB (positive: the music
is over the effects there). Pinecrest is measured at the final level; the other three are the first round's
readings less the 1.5 dB.

| Mountain | 63 | 125 | 250 | 500 | 1k | 2k | 4k | 8k |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pinecrest | -2.2 | -0.3 | +3.0 | +4.1 | +0.5 | -0.8 | -1.5 | -2.7 |
| Frostfang | +0.9 | +4.9 | +4.3 | +4.9 | +0.8 | -4.6 | -6.0 | -3.2 |
| Ember | +3.7 | +7.4 | +4.7 | +4.0 | +0.7 | -3.0 | -3.9 | -4.2 |
| Sakura | +2.2 | +5.0 | +3.3 | +1.0 | +0.9 | +0.1 | -1.1 | -3.3 |

From 1 kHz up, where the cues, the bells and the snow live, the music is level with the effects or under them
on every mountain. From 125 to 500 Hz the music is over them by 3 to 7 dB: what the effects have there is the
runners' rumble and the thuds of landings, and the sidechain takes the music down under those by up to 5 dB
(it is over 1 dB down for 30 to 38 % of a run). Ember at 125 Hz is the place a landing's thud is most likely to
be lost; that is a listening call (a `duck` on Ember's bass, or the sidechain's depth).

**Main-thread time of the audio engine on Low** (`scripts/playtest/audiocpu.js`: milliseconds a second in the
frame's audio calls and the scheduler's passes, 40 s of a replayed Pinecrest run from 8 s in; produced and
live passes interleaved; the light pack):

| Pass | Produced score | Live band (`?nostems`) |
| --- | --- | --- |
| 1 | 8.8 ms/s | 8.4 ms/s |
| 2 | 8.3 | 9.0 |
| 3 | 10.8 | 8.8 |
| Mean | 9.3 | 8.7 |
| Worst single call | 2.3 ms | 2.4 ms |
| Nodes made a second | 61.7 | 75.9 |
| Under a 6x CPU throttle | 62.5 ms/s, worst call 15.6 ms | 66.2 ms/s, worst call 19.1 ms |

The produced score is not heavier than the live band on Low within the spread of three passes, and makes a
fifth fewer nodes; it is not measurably lighter either, because most of the engine's time is the effects and
the ambience, not the band. (A first round, on a busier machine and before the deck's fetching and claiming
were cut to four times a second, read 23.2 against 16.7 ms/s: that is why they were cut.) Seven lanes share
this machine: read the pairs, not the absolute numbers.

**Decoded memory at most, over a whole run** (`engine.debugStems().peakMB`):

| | Pinecrest | Frostfang | Ember | Sakura |
| --- | --- | --- | --- | --- |
| Desktop packs (four layers, 48 kHz) | 132 MB | 120 MB | 108 MB | 155 MB |
| Light packs (two layers, 32 kHz) | 42 MB | not measured | not measured | 54 MB (first 48 s of a run) |

The live band holds no decoded audio, so this is all new memory. It is the lane's real cost: see "Not
finished, and fragile".

**Loading, as it happened.** A run started the instant the page loads (the probes' way) is on the produced
score 0.5 to 0.8 s in on Pinecrest (the mountain the title shows, already fetched), and 1.0 to 3.1 s in on a
mountain never shown, after a crossfade from the live band. On a second visit the packs come from the Cache
API (2 cache hits, 0 bytes fetched). The console is clean on every pass (no error, no warning).

**What played, on the replayed runs** (run clock, seconds; a stinger played on every set piece's card and on
every won or lost, six a run on all four mountains):

| Mountain | First set piece's drop | Stage line | Second set piece | The lift | Third set piece | The breath (takeoff to landing) | The finale | The reprise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pinecrest | 18.8 | 38.4 | 42.6 | 75.7 | 84.5 | 99.2 to 102.7 (3.5 s) | 115.4 | 118.7 |
| Frostfang | 33.6 | 38.4 | 55.5 | 73.1 | 78.8 | 98.2 to 104.6 (6.4 s: silent for 4.2, then the breakdown) | 110.5 | 113.9 |
| Ember | 32.6 | 38.2 | 58.7 | 72.6 | 89.2 | 98.2 to 99.7 (1.5 s) | 110.7 | 113.8 |
| Sakura | 25.3 | 39.6 | 62.4 | 73.9 | 96.0 (its card came up in the air: the breath's crash back in is its drop) | 92.1 to 96.0 (3.9 s) | 110.4 | 113.7 |

**The build is deterministic on this machine:** Ember rebuilt from source a second time (`npm run music ember`, 169 s) gave the same three packs
and the same manifest byte for byte (git sees no change under `public/music` or in `produced.json`). The
other pieces were built once.

The reference runs in the files' section (Ember's apart, which that rebuild refreshed) were sequenced before three fixes to the scheduler made after
playing real runs (one landing a landmark, a breakdown on a section's own end, the bounded breath). They will
move by a few tenths at the next `npm run music`; nothing else in `analysis.json` depends on the scheduler.

## The cost

- **Download:** above. Nothing before the first frame; the manifest is a chunk of its own (17.9 kB, 2.6 kB
  gzipped).
- **Main thread:** the produced score schedules no notes: a few buffer sources a section and a gain change a
  bar. The numbers are in the table above.
- **Memory:** decoded PCM is the dear part. The store holds only what the decks claim (the section playing,
  the next, the one a drop would land in, the breakdown, the build and the hit, the run's stingers; in the last
  stage the climax, the finale and the reprise) and drops the rest; the peaks measured are above.
- **Draw calls, triangles, frame JS:** none. The lane touches no render code.
- **The repository:** 56.8 MB of binaries in `public/music/`, committed once (eba3e90). A rebuild that changes
  the audio adds its size again to the history: rebuild only when the score changes.

## What the main lane must wire or decide

1. **`npm run package` fails:** `scripts/package.ts` refuses a build over 5 MB, and the build is now 60 MB
   with the music. The music is never part of the first load (the game is playable, with the live band, before
   any of it arrives), so the budget should count the build without `music/` and report `music/` beside it.
   Check CrazyGames' current limits for total size and for files fetched after load before release. If the
   total must come down: ship `lite` only (13.4 MB; point `StemStore.tier` at `'lite'`), or drop the AAC
   packs if every target browser decodes Opus in WebM through `decodeAudioData` (older Safari did not: check the versions you target before dropping it).
2. **Lanternfall.** The music picks a piece by the mountain's id when the app passes it (`audio.setMood(mood,
   biome, mountain.id)`: done in `src/game/app.ts`, three calls) and by the biome otherwise. On the merged
   build Lanternfall's look is Frostfang's (`lookOf`), so the id is what gives it its own music: keep the
   third argument through the merge. Ride Lanternfall once with `window.__gs.audio.debugStems()` in the
   console: `produced` should be true and the pack `lanternfall.*`.
3. **The Ultra tier** (the `pipe` lane): `StemStore.setQuality` treats everything that is not `'low'` as full.
   `AudioEngine.setQuality`'s type still names three tiers; widen it when Ultra lands.
4. **The verbs.** The score has a stinger for each of the twelve verbs in `r7-moments:src/sim/moments.ts`
   (race, gates, rings, collapse, steps, slide, shatter, surge, flourish, follow, kindle, carry). On this
   branch `MomentVerb` is still round 6's, so the stingers for the new verbs have only played from the
   jukebox. A verb added later plays the plain stinger until it has an entry in `GESTURES` and the score is
   rebuilt.
5. **The breath reads the course's tallest leap** (`course.leaps`, the greatest `height`). If the moments lane
   names a different leap as a mountain's biggest (a set piece's), pass that lip instead in
   `AudioEngine.approach`.
6. **LISTENING.md and ASSETS.md:** the full texts are below.
7. **README:** the dev switches gain `?nostems` (the live band only) and the jukebox's new rows; `npm run
   music` rebuilds the score (about 10 minutes on a quiet machine, 30 on a busy one; needs the `ffmpeg-static`
   install script to have run, which `allowScripts` in `package.json` permits).

## Touched outside my files

- `src/game/app.ts`: the three `audio.setMood(...)` calls pass `this.mountain.id` as a third argument. Nothing
  else.
- `scripts/playtest/loudness.js`, `scripts/playtest/audiocpu.js`: a pass may add to the address (`extra`,
  for `&nostems`) and name its own tier; both report which band played, its pack and the decoded audio held at
  most; loudness.js also reports the mix in octave bands.
- `package.json`: the `music` script, `ffmpeg-static` as a devDependency and its install script allowed.

## Not finished, and fragile

- **Unheard.** The largest risk in the lane. Instruments made of oscillators and filters can measure well and
  sound cheap; a mix can sit at -16 LUFS with a lead that is too loud. The listening guide's last section
  lists each call with the constant that changes it; most are one number in a piece's `tracks` (a `gain` in
  LUFS against the other instruments) and a rebuild of that piece (`npm run music ember`).
- **The breath is long.** On the replayed runs the score is silent for 1.5 to 4.2 s (the table above): the
  whole flight of the tallest leap. The section's tail rings through the first second and a half and the wind
  and the effects go on, but if it reads as a dropout, shorten `stemform.ts` BREATH_MAX_S (the breakdown then
  comes in sooner under the flight).
- **Decoded memory on a desktop: 108 to 155 MB at the peak of a run**, where the live band held none. Four
  layers of up to five sections are decoded at once in the last stage. If that is too much for the Medium
  tier, give Medium the light packs (`stemstore.ts` tier: 42 to 54 MB), or decode the desktop packs at 32 kHz
  as the light ones are (`stemstore.ts` decoder: one line; a third less memory for the top half octave). This
  is the main lane's call with the other lanes' memory in hand; I did not measure the page's total.
- **A run that starts within about a second of picking a mountain for the first time on a slow connection**
  plays the live band for the whole run (the 6 s rule). It is cached from then on.
- **The mood treatments** (a Blizzard a semitone down and darker, Glass Ice a semitone up, Haunted Hollow two
  down and muffled, and so on: `stemdeck.ts` TREAT) change pitch and pace together by playing the stems
  faster or slower. None was measured beyond not erroring in the jukebox, and none was heard.
- **Tempo is fixed per course.** The live band stepped its tempo up 2.5 % a stage; the produced score writes
  the lift into its last-stage sections instead (a key change on four courses, full-time drums on Ember).
- **A partial rebuild** (`npm run music ember`) stamps the new version on that piece only; the other packs
  keep the old one in their headers, and the store then re-fetches them every session instead of using the
  cache. Finish any change to the score with a full `npm run music`.
- **Determinism** of the build was checked on this machine only (same source, same bytes: see above). Opus
  and AAC bytes depend on the ffmpeg build, which `ffmpeg-static` pins.

## Where things are

- Notes: this file. The build's measurements: `scripts/music/analysis.json`.
- A frame of the jukebox: `shots/r7/music/jukebox.png` in the main checkout. There is nothing else to see.
- To hear: `npx vite build`, `npx vite preview --outDir dist/game --port 4440 --host 127.0.0.1 --strictPort`,
  then `http://127.0.0.1:4440/?debug&jukebox`. `npm run music -- --wav` also writes every stem and a
  sequenced reference run of each course as WAV files under `dist/music/wav/`.

---

# LISTENING.md: the full replacement text

```markdown
# Listening guide (round 7: a produced score, a style for every mountain)

Nobody has heard this build. The music is no longer played live by the game: every mountain's score was
written as notation, rendered offline by the project's own synthesizer (`npm run music`), mastered, and
shipped as audio that the game sequences to your run. All of it was judged by measurement (loudness, true
peak, spectrum, the mono fold-down, a phone speaker's band) and by reading the score. This guide says what to
listen for, where, and what good sounds like, so one sitting with headphones and one with a phone can say
whether it worked. About 40 minutes in all.

**Before you start.** Default sliders (music 0.8, effects 0.8, master 1). Headphones first, then a phone.
Keep the tab in front (a hidden tab mutes). Note anything that sounds wrong with the mountain, the second on
the run clock and what you heard; that is enough to find it.

**What you are hearing.** The line at the foot of the jukebox says "Produced score" or "Live band". The live
band (round 6's music, played by the game) is the fallback: it plays until a mountain's audio has loaded, and
for good on a browser that can decode neither Opus nor AAC. Add `?nostems` to the address to hear only the
live band; add `?tier=low` to hear the lighter files Low and phones get.

## The jukebox (`?debug&jukebox`)

Open the game with `?debug&jukebox` (for example `http://127.0.0.1:4440/?debug&jukebox`). A panel sits top
right over the title screen; Hide folds it, and Silence the Band mutes the music until the next button.

| Button | What it plays |
| --- | --- |
| Main Theme | The title theme: the game's motif in C major at 92, on a felt piano, then strings and a harp, then both with glass bells |
| Results Reprise | The chosen mountain's reprise: the motif played through in that mountain's instruments, in the key its run ends in |
| Mountain | Pinecrest, Frostfang, Ember Peak, Sakura Ridge, Lanternfall. A mountain's audio loads about a second after you pick it; the first press may start on the live band and cross over |
| Mood, Stage | A mood's treatment of the mountain's music (pitch, pace, a filter, more room), and which stage's sections and layers play |
| Intro, Verse, Chorus (hook), Bridge | The live band's sections (they do nothing while the produced score plays) |
| Let It Flow | Lets the form run on its own |
| Produced Score by Section | Holds one section of the mountain's piece, from the next bar line: Intro, A (verse), B (chorus, the hook), C (second verse), D (stage two), Breakdown, B2 (the last stage's chorus), C2 (the climb to the line) |
| Produced Score / Live Band | Which band plays: the fallback on demand |
| Build into a Drop | A riser ending on a downbeat 2.4 s later, the drums out for its last two beats, then a hit and the chorus from its top |
| Lift a Key | The same into the last stage's chorus (a tone up on Pinecrest and Sakura, the major on Frostfang, C on Lanternfall, full-time drums on Ember) |
| Finish Line | A longer build, then the finale (the motif's first two bars on everything) and, under its last bar, the reprise |
| Break Down | A wipeout: the breakdown at the next four-bar line |
| Breath and Crash Back | The biggest leap: the music cuts to its own tail, and 1.4 s later crashes back in on the chorus under a hit |
| Drive | How hard the run is being ridden: 0.36 is a cruise (bed, drums and bass; the lead in choruses), 0.6 a skilled stretch, 0.75 and up brings the top layer in |
| Stingers | One for each set-piece verb, in the chosen mountain's instruments: Race, Gates, Rings, Collapse, Steps, Slide, Shatter, Surge, Flourish, Follow, Kindle, Carry, and the plain one a new verb plays |
| Rider Motifs | The twelve signature riders' motifs, in the key that is playing |
| Set Pieces | The live cues that still play during a set piece (a gate, a ring, a step, a miss, a race lead and trail, a collapse closing in), and Won and Lost, which are stingers of the produced score |
| Cues in the Score | The lantern lighting, a dash, a ward, a sky gate, a pass, a stage line: live, pitched into the produced score's key and chord |
| Sled Sound | The garage's five runner sounds |

## The route

### 1. The title (3 minutes): is there a theme?

Load the game, tap once, wait. The theme should start within a second of the tap (it loads before it).

- **Good:** a tune you could hum after twice round: up a fourth to the top note and a step down, a fall, a
  small arch, home. A soft piano has it alone over a held pad; strings answer it higher with a harp; then both
  together, bells on the downbeats. Unhurried. It should feel like the start of something kind.
- **Wrong:** the piano dull or plinky; the strings thin, buzzy or obviously synthetic; the voices a wash of
  noise; a join you can hear when a section hands over to the next (every 21 seconds).

### 2. Five mountains, thirty seconds each (5 minutes): does a few seconds name the mountain?

In the jukebox pick each mountain and press B: Chorus, then A: Verse. This is the round's main question.
Could you tell which mountain it is with your eyes shut, within five seconds?

- **Pinecrest** (D major, 116): a fiddle playing a reel over two strummed guitars, an upright bass, stomps
  and claps, a tambourine; a tin whistle answers; horns and trumpets when it opens up. A holiday morning.
  **Wrong:** the fiddle a buzz saw; the strum mechanical; twee.
- **Frostfang** (F# dorian, 126): glass bells in sixteenths over a wide slow pad that pumps with a kick on
  every beat, an off-beat bass, a pure high lead with long notes in a very big room. Cold, wide, forward.
  **Wrong:** the pump seasick; the bells harsh; a generic dance track.
- **Ember Peak** (E phrygian, 138 in half time): a deep kick and a huge snare on three, a distorted bass riff
  in sixteenths, anvils off the beat, steam for hats, taiko and struck metal, low brass hammering a hook of
  repeated notes. Heavy and dangerous. **Wrong:** mud (no riff audible under 200 Hz of weight); distortion that
  hurts; the snare a slap.
- **Sakura Ridge** (Ab major, 84, swung): a koto-like pluck and a breathy bamboo flute over an electric piano
  in rich chords, a soft sub and a kick behind the beat, a rim on two and four, a shaker with a lilt. The
  slowest pulse; the one you ride to feel good. **Wrong:** the flute a whistle with hiss stuck on; the groove
  stiff; muzak.
- **Lanternfall** (Bb major, a slow 6/8 at 63): a music box and a choir of soft vowels, alone; then a harp and
  a piano; then a flute and strings with the game's motif whole; and in the last stage, in C, everything plays
  it: brass, strings, choir, bells, a field drum, timpani. A lullaby that grows up into an anthem.
  **Wrong:** the music box toy-like in a bad way; the choir a pad; the anthem not arriving.

### 3. A whole run on Pinecrest (4 minutes): does it follow the run?

Ride Pinecrest, or watch `?debug&autoride=1&demo=0&m=0`. On the replayed run:

| Run clock | What happens |
| --- | --- |
| 0:00 | The intro, four bars, under the count-in |
| 0:09 | The verse: guitars, bass, stomps, the fiddle's reel |
| 0:17 to 0:19 | The First Drop's card: the Rings stinger, a riser, then the hit and the chorus on the leap |
| 0:27 | The breakdown (the set piece is over), then the second verse |
| 0:38 and 0:43 | The stage line's drop and Mirror Lake's |
| 1:16 | The line into the last stage: the chorus a tone up, with the brass |
| 1:25 | Old Town's drop |
| 1:39 to 1:43 | The biggest leap: the breath, three and a half seconds, and the crash back in |
| 1:55 | The finish: the finale |
| 1:59 | The reprise, on the results |

- **The start:** the intro (4 bars) under the count-in, then the verse with drums and bass.
- **A set piece's card:** a short stinger in the mountain's instruments on the next beat (on Pinecrest's
  first, the rings: three ringing chords, each higher), a riser under it, the drums drop out for two beats,
  then a hit and the chorus on the beat you arrive. **Wrong:** the hit late to the picture by more than a
  beat; the stinger sour against the music; the cut into the chorus a click or a stumble.
- **Layers:** ride badly and the verse is bed, bass and drums; a stomp streak or the flow brings the lead and
  then the top layer in on the next bar line. **Wrong:** a layer popping in mid-phrase, or flapping.
- **A wipeout:** the music goes under water while you are down, and breaks down (4 bars, sparse) at the next
  phrase.
- **The last stage:** its own chorus, a tone up, with the brass; then the climb.
- **The biggest leap** (late in the last stage on this run): the music stops as you leave the lip and its
  tail rings out; nothing but wind in the air; on the landing a hit and the chorus from its top.
  **Good:** you hold your breath with it. **Wrong:** it reads as the audio breaking; the silence too long.
- **The finish:** a longer rise, then the finale lands as you cross: the game's motif, two bars, on
  everything, and a held chord. **Wrong:** the finale early or late against the line; the fanfare of the
  effects fighting it.
- **The results:** the reprise comes in under the finale's last bar: the motif played through, quieter, in
  Pinecrest's instruments. Run Again should start the intro at once.

### 4. The other mountains (8 minutes)

One run each (`m=1`, `m=2`, `m=3`; Lanternfall from the mountain select once it is unlocked, and from
the jukebox before that). The same moments, in each mountain's own way:

- **Frostfang:** the last stage turns from F# dorian to F# major with a piano in octaves: the sun finding you
  out of the cavern. The breakdown is the room alone.
- **Ember Peak:** the last stage keeps its key and the drums go from half time to full time, which doubles the
  pace under the same riff. The stingers are low brass and struck metal.
- **Sakura Ridge:** the last stage lifts a tone to Bb with a frame drum and the koto in octaves. The hook ends
  on the one bittersweet chord in the piece.
- **Lanternfall:** stage one is the lullaby, stage two the song with the motif, stage three the anthem in C.
  Its stingers (follow, kindle, carry) are a call and its echo, sparks and a bloom, three slow steps like a
  hymn. The finale should be the largest sound in the game, and the title theme's key.

### 5. The stingers (3 minutes)

On each mountain press a few of the Stingers row with a section playing. Each verb is one gesture, re-voiced:
Race is a gallop on one note that jumps a fifth and then the octave; Gates a run up the chord to a held top;
Rings three chords each higher; Collapse a low line falling under a roll; Steps pairs of notes coming down a
step at a time; Slide a fast run down to a low landing; Shatter a high cluster and shards falling slower and
slower; Surge one note hammered faster and faster, breaking upward; Flourish a turn and a leap; Follow a call
and its echo; Kindle three flickers and a bloom; Carry three slow steps. Won is the motif's first bar landing
on the octave; Lost three soft notes down to the tonic.

- **Good:** you could name the verb from the sound, and the mountain from its instruments.
- **Wrong:** a stinger louder than the music; one that clashes with the chord under it (they are in the key
  but do not follow the chord).

### 6. The riders (2 minutes)

Press each of the twelve Rider Motifs with a section playing, then again on another mountain: the same tune
in the new key. On a run you hear a rider's motif after the start-line call when they are your rival, and
when they pass you.

The Hollow King: low brass, up a fifth and slowly home. Mila Frost: glass falling four notes and turning back
up. Suki Ember: a plucked note struck twice, then a dash to the octave. Ivo Crag: a hammered fifth that drops
to the root. Kaito Mori: a plucked turn. Old Wren: two slow bells. Tavi Rook: a whistle climbing the chord.
Nessa Lumen: glass rocking before it lifts. Juno Vale: bells stepping down three and up five. Pip Thistle:
plucked leaps, never where expected. Bram Oakhollow: a horn call. Rosa Quill: a whistled wave.

- **Good:** after a few runs you know who passed you without reading the name.
- **Wrong:** all twelve sound like one bell; a motif that sounds wrong on Ember or Frostfang (the minor keys).

### 7. A mood (2 minutes)

Pick a mood in the jukebox with a mountain playing. The mountain's own music, treated: a Blizzard a semitone
down and darker with more room; Glass Ice a semitone up and thinner; Haunted Hollow two semitones down and
muffled; Comet Night wetter; Powder Day a semitone up. **Wrong:** the slower or faster playback audible as a
tape effect in a bad way; drums that sound pitched down.

### 8. The fallback (2 minutes)

Press Live Band: round 6's music takes over within two seconds, and Produced Score brings the score back.
Then load the game with `?nostems` and ride: the whole game on the live band. **Wrong:** silence at any point.

### 9. Low, and a phone (6 minutes)

Load with `?tier=low`, then on a phone. Both get the lighter files: two layers a section instead of four (the
lead and the top layer arrive together), decoded at 32 kHz.

- **Good:** the same music, a little less air at the very top. On a phone speaker the bass line is still
  there through its harmonics, the kick still knocks, the tune is clear, nothing in the middle vanishes.
- **Wrong:** Ember gone thin (it loses most on a phone: its weight is under 250 Hz); a gap or a click where a
  section hands over (the AAC files, on a browser without Opus, are the likeliest place: old Safari).

## What a human ear must decide

The calls the measurements cannot make. Each is one number and a rebuild of that piece (`npm run music
<piece>`, then a full `npm run music` before shipping), unless it says otherwise.

1. Do the instruments sound produced, or like oscillators? Mountain by mountain, instrument by instrument: say
   which ones fail. (`scripts/music/inst.ts`, `perc.ts`; a piece's `tracks`)
2. Is each hook good enough to hum? (each piece's `HOOK`)
3. Is each mix balanced: the lead present and not on top, the bass audible, the drums not buried? (a track's
   `gain`, its loudness against the others in LUFS)
4. Is the music level with the effects? (`stemdeck.ts` PRODUCED_GAIN)
5. Is the sidechain under the effects audible as pumping? (`graph.ts`)
6. Frostfang's pump and Ember's distortion: musical or tiring over two minutes? (a track's `duck`, `tape`)
7. Do sections join without a seam, and do drops land without a click? (`stemform.ts` CUT_FADE_S)
8. Is the breath before the biggest leap a held breath or a dropout, and is it too long? (`engine.ts`
   approach; `stemform.ts` BREATH_FADE_S)
9. Is the hit under a drop the right size? (`piece.ts` HIT_TRIM_DB)
10. Are the stingers at the right level, and does any clash with its music? (a piece's sting band)
11. Do the riders' motifs read as characters, and sit in every key? (`motifs.ts`)
12. Does the reprise arrive too soon or too late after the finale? (`music.ts` FINALE_MAX_S)
13. Is anything too close to music that exists? Every note was written here, from nothing but the brief, and
    no existing piece was used as a model, but only a listener can say a tune does not remind them of one.
```

---

# ASSETS.md: entries for every shipped audio file

```markdown
## Audio

Every audio file the game ships is in `public/music/`. All of it is original work made for Ghost Sled: the
notes were written in this repository (`scripts/music/pieces/`) and every sound was synthesized from them by
the project's own renderer (`scripts/music/`, TypeScript run by Node). No samples, loops, recordings, sound
libraries, presets, MIDI files or generated audio from any outside tool or model were used. Nothing quotes or
imitates an existing soundtrack, song or artist. Rebuild with `npm run music`.

| File | What it is | Source | Tool | Licence |
| --- | --- | --- | --- | --- |
| `title.full.webm.bin`, `title.lite.webm.bin`, `title.lite.m4a.bin` | The title theme: three sections | `scripts/music/pieces/title.ts`, `common.ts` | The project's renderer; encoded by ffmpeg 6.1.1 (`ffmpeg-static` 5.3.0): libopus, and ffmpeg's AAC encoder | Original; owned by the project, all rights reserved |
| `pinecrest.full.webm.bin`, `pinecrest.lite.webm.bin`, `pinecrest.lite.m4a.bin` | Pinecrest's score: ten sections in layers, a build, a hit, fifteen stingers | `scripts/music/pieces/pinecrest.ts`, `common.ts` | The same | The same |
| `frostfang.full.webm.bin`, `frostfang.lite.webm.bin`, `frostfang.lite.m4a.bin` | Frostfang's score, the same parts | `scripts/music/pieces/frostfang.ts`, `common.ts` | The same | The same |
| `ember.full.webm.bin`, `ember.lite.webm.bin`, `ember.lite.m4a.bin` | Ember Peak's score, the same parts | `scripts/music/pieces/ember.ts`, `common.ts` | The same | The same |
| `sakura.full.webm.bin`, `sakura.lite.webm.bin`, `sakura.lite.m4a.bin` | Sakura Ridge's score, the same parts | `scripts/music/pieces/sakura.ts`, `common.ts` | The same | The same |
| `lanternfall.full.webm.bin`, `lanternfall.lite.webm.bin`, `lanternfall.lite.m4a.bin` | Lanternfall's score, the same parts | `scripts/music/pieces/lanternfall.ts`, `common.ts` | The same | The same |
| `probe.webm`, `probe.m4a` | A single click in 0.2 s of silence: the runtime's decode test | `scripts/music/build.ts` | The same | The same |

A `.bin` pack is the project's own container (`GSM1`, a JSON index, then the files end to end): Opus in WebM
in the `.webm.bin` packs, AAC-LC in MP4 in the `.m4a.bin` packs.

**The encoder.** `ffmpeg-static` is a devDependency: its binary runs on the build machine and is not part of
the game. The binary it installs is a GPL build of ffmpeg; the GPL covers the program, not the audio it
encodes. Opus is royalty-free (BSD-licensed reference encoder, patents licensed royalty-free). AAC-LC is a
patented format: the files are decoded by the browser's own decoder, and whether distributing AAC audio in a
sold game needs anything from the project has not been checked by a lawyer. If in doubt, drop the three
`.m4a.bin` packs a piece: the game then plays the live band where Opus does not decode.

**The rest of the sound** (every effect, the ambience, the live band that plays as the fallback, the riders'
motifs, the cues) is synthesized in the browser at run time by `src/audio/` and ships as code, not as files.
```
