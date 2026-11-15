# Listening guide (round 7: a produced score, a style for every mountain)

Nobody has heard this build. The music is no longer played live by the game: every mountain's score was
written as notation, rendered offline by the project's own synthesizer (`npm run music`), mastered, and
shipped as audio that the game sequences to your run. All of it was judged by measurement (loudness, true
peak, spectrum, the mono fold-down, a phone speaker's band) and by reading the score. This guide says what to
listen for, where, and what good sounds like, so one sitting with headphones and one with a phone can say
whether it worked. About 42 minutes in all.

**Before you start.** Default sliders (music 0.8, effects 0.8, master 1). Headphones first, then a phone.
Keep the tab in front (a hidden tab mutes). Note anything that sounds wrong with the mountain, the second on
the run clock and what you heard; that is enough to find it.

**What you are hearing.** The line at the foot of the jukebox says "Produced score" or "Live band". The live
band (round 6's music, played by the game) is the fallback: it plays until a mountain's audio has loaded, and
for good on a browser that can decode neither Opus nor AAC. Add `?nostems` to the address to hear only the
live band; add `?tier=low` to hear the lighter files Low and phones get.

## The jukebox (`?debug&jukebox`)

Open the game with `?debug&jukebox` (for example, after `npx vite build` and `npx vite preview --port 4173`,
`http://127.0.0.1:4173/?debug&jukebox`). A panel sits top right over the title screen; Hide folds it, and
Silence the Band mutes the music until the next button.

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
| Set-Piece Steps | What a set piece sounds like as it is ridden: the bells swinging, the forge's roar and its gutter, the glass, the lamps catching, the wake filling and being regained, the carried flame low, guttering, catching and taking at the brazier |
| Legends and the Hero Frame | A legend from its warning to its leaving, a ribbon legend's quarters, and the hero frame's breath, bells and landing |
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

One run each (`m=1`, `m=2`, `m=3`; Lanternfall with `?debug&m=4`, or from the mountain select once eleven of
The Twelve have fallen, and from the jukebox at any time). The same moments, in each mountain's own way.
Lanternfall's score was measured as files only: the music lane had no fifth mountain to ride, so its run is the
one nobody has even measured in the game.

- **Frostfang:** the last stage turns from F# dorian to F# major with a piano in octaves: the sun finding you
  out of the cavern. The breakdown is the room alone.
- **Ember Peak:** the last stage keeps its key and the drums go from half time to full time, which doubles the
  pace under the same riff. The stingers are low brass and struck metal.
- **Sakura Ridge:** the last stage lifts a tone to Bb with a frame drum and the koto in octaves. The hook ends
  on the one bittersweet chord in the piece.
- **Lanternfall:** stage one is the lullaby, stage two the song with the motif, stage three the anthem in C.
  Its stingers (follow, kindle, carry) are a call and its echo, sparks and a bloom, three slow steps like a
  hymn. The finale should be the largest sound in the game, and the title theme's key.

### 5. The stingers, the steps and the legends (5 minutes)

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

Then the Set-Piece Steps row, which plays what a set piece sounds like while it is ridden: Bells Swing (three
bronze bells, each a chord tone higher, with the air they move), Forge Roars and Forge Gutters (a thud and a
second and a half of low fire that opens and falls, or a cough of smoke), Glass Sings (four rising notes of
glass), Lamps Catch (a pluck and a breath of flame up the ladder, the chord on the last), The Wake Fills (soft
bells an eighth at a time) and Back in the Wake (two bells up), and the carried flame: Flame Low (a dull pulse),
Flame Gutters (air out and a note that sags), Flame Catches (a breath in) and Brazier Takes (a rush and three
bells up the chord). Then the Legends row: A Legend Comes and Goes (a breath in from one side, then an open
fifth low on brass under four bells climbing a ninth and a sharp fourth, the band ducking under it; a held fifth
as it is reached; two bells down as it is left), A Ribbon's Quarters (bells up the same chord), and The Hero
Frame (air drawn in under a rising low tone, the score cutting to its tail, three high bells hanging at the
apex, the band crashing back in on the landing).

- **Good:** the legend's chord is a colour heard nowhere else in the game, and you would know it again; the
  forge's roar sits under the Surge stinger rather than fighting it; the hero frame's breath feels like a held
  breath, not a dropout.
- **Wrong:** the legend's cue too loud against a busy band (it ducks the band to 0.6); the wake's bells
  pecking (in a real ride "back in the wake" sounds at most once in three seconds); a step louder than its
  stinger.

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
   approach; `stemform.ts` BREATH_FADE_S, and BREATH_MAX_S, 4.2 s, for its length)
9. Is the hit under a drop the right size? (`piece.ts` HIT_TRIM_DB)
10. Are the stingers at the right level, and does any clash with its music? (a piece's sting band)
11. Do the riders' motifs read as characters, and sit in every key? (`motifs.ts`)
12. Does the reprise arrive too soon or too late after the finale? (`music.ts` FINALE_MAX_S)
13. Is anything too close to music that exists? Every note was written here, from nothing but the brief, and
    no existing piece was used as a model, but only a listener can say a tune does not remind them of one.
