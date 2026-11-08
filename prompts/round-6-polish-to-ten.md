# Ghost Sled, round 6: polish toward a 10

You're working on Ghost Sled, a downhill sled racer for the browser and CrazyGames, in this repo. It's built with
Vite, TypeScript and three.js, and every mesh, texture and note of music is generated in code. Before you change
anything, read the README (above all "Round 5 play-test" and its performance table), DECISIONS.md (items 1 to 238)
and ART.md (section 13 is new).

The owner rates the game about 8 to 8.5 out of 10 for graphics and enjoyment, and the music about 7 to 8. This
round lifts all of it closer to 10 by **refining what is already good**: finish things, deepen them and polish them.
Every course should look amazing and feel designed, with real marquee "wow" moments, and **every detail should be
deliberate**: placed, lit, timed and tuned for a reason you can state. Add one or two new things only where they
clearly earn their place. Be ambitious about quality, and measure everything.

## Where the game stands

**Strong:**
- The first minute.
- Real places: ravines, Old Town, the Ice Cavern, Temple Town.
- The lantern loop. Lights sit on the brave lines, and you choose between a dash and a ward.
- Set-piece title cards.
- Signature riders with hats and lines.
- A crowd that reacts.
- The finish square with its celebration.
- Skill now matters: in the lab, novice and expert finish 18 s apart.

**Weak or unfinished:**
- **Music (7 to 8 out of 10).** It is good, but it is a generative loop more than a score. Nothing has been mixed
  or mastered by ear.
- **Feedback that reads too quietly:**
  - A ward is a puff of light and a small "Warded" callout.
  - Sky-gate rings are thin outlines.
  - Fireworks over the square read as red smoke puffs.
  - A dash has no change on the rider itself, only motes and a lens punch.
- **Set pieces come every 20 to 45 s.** That is too dense to feel special. Several are camera beats over stretches
  that play like any other.
- **Between places the course is still a groove with scenery beside it.** Some details are there because a
  system scattered them, not because someone designed them.
- **On a phone:** the top of the HUD stacks up during a set piece: the title card, the combo, a stage line and a
  graveyard callout at once.
- **Low at 6x throttle is slightly under the old build.** DECISIONS 238 has the details.
- **The garage has only sled paints**, and the living world is missing chimney smoke, signs, and trees that shed
  snow.

Start by playing the current build yourself, on desktop and on a phone viewport, across all four mountains, with
the sound on. Use the scripted pilots for numbers, and look at the frames yourself. Add a short, blunt review to
DECISIONS.md: per mountain, what is wonderful, what is flat, what looks accidental or generic, and how the music
sounds. Then write your plan there before you build: 6 to 10 changes, biggest lift for a player first, with what
you rejected and why.

## 1. Every course looks amazing, and every detail is deliberate

Treat each mountain as an authored level and walk it metre by metre: the start, every place, every stretch
between places, and the finish. For each, decide what the player should see, feel and do, and make the world serve
that.

**Composition and readability:**
- **Sightlines.** Frame the next place before you reach it: the bridge seen across the gorge, the town's spires
  over the last crest. Leading lines (fences, flags, lights, the corridor's own curve) draw the eye toward what
  is next.
- **No accidental clutter.** Hazards read instantly at 30 to 46 m/s, and dressing never fights the line. Remove
  anything that is generic or random rather than designed.
- **No dead stretches.** Rhythm between the places: a quiet run, then a build, then a reveal.

**Each mountain's identity:**
- Strong enough that one screenshot names it, from its own palette, landmarks, architecture, flora, people and
  weather.
- Push each signature light, and stage it by distance down the course:
  - Pinecrest's golden hour.
  - Frostfang's aurora breaking.
  - Ember's glowing dusk.
  - Sakura's mist lifting.
- Grade the transitions with care: out of tunnels, onto the lake, into the town.

**Craft at speed:**
- Snow that sparkles and holds the sun.
- Ice with depth.
- Rock with strata.
- Trees that shed snow when passed close.
- Towns with chimney smoke, lit signs, and bunting that moves in the wind.
- Crowds placed where a crowd would really stand.

**Marquee wow moments.** Cut to the best two or three per mountain, about one every 45 to 60 s. Each one must
play differently, not only look different. Directions to weigh, which you can beat:
- A frozen waterfall you thread through.
- A collapsing snow bridge that falls behind you.
- A race against a cable car or a train along the line.
- A valley-crossing leap where the whole range opens below.
- A night festival street of lanterns and fireworks that you ride under.
- Bursting out of the Ice Cavern into sunrise.

For each moment:
- Compose it: a camera beat that frames it without taking the steering.
- Score it: a music moment, a drop or a key lift, landing on the beat.
- Give it a line to master and a goal on the mastery board.
- Make it deterministic: in the sim where it touches play, so ghosts ride it too.

**Feedback you can feel:**
- A dash visibly changes the rider: a spirit shimmer on the body.
- A ward cracks the lantern open, with a beat of slow motion.
- Sky gates read as rings of light from 60 m away.
- Fireworks look like fireworks.

**The HUD.** Decide what shows when, so a set piece, a combo and a callout never stack on a phone.

**Low and phone.** Each keeps a look of its own, designed on purpose. Low must win back its frames; see "Bars".

## 2. Polish the music from 7–8 toward 9+

The music is decent. Refine it; don't replace it. The target is the polish and production quality of the best
racing game soundtracks. Everything stays generated in code. Original music only: do not imitate or quote any
existing soundtrack.

**Themes and arrangement:**
- Give each mountain's music a clearer melodic hook a player could hum, and give the title a main theme.
- Use progressions with movement (borrowed chords, a key lift into the last stage), not loops over one chord.
- Arrange it against the run: intros, builds, drops and breakdowns.
- Stage lines and marquee moments land on downbeats.
- Keep sync with the picture.

**Production:**
- Fuller pads.
- A bass that sits.
- Punchier drums, with transient shaping.
- Sidechain under the effects.
- Bus compression and a master chain with true-peak limiting.
- Stereo width that survives mono and phone speakers.
- Measure loudness (a sensible integrated LUFS for a browser game), headroom and the music-to-SFX balance with
  `levels.js`, `audio-capture.js` and the probes, and report the numbers.

**Sound design:**
- Pitch the lantern, dash, ward, sky-gate, pass and finish cues into the score's key and tempo.
- The crowd swells and roars with the race.
- Remove clutter at peak moments with smart ducking.

**CPU:** the music must not cost Low its frames (DECISIONS 89, 205). Measure audio main-thread time before and
after.

**For the owner's ears:** no human has judged the audio yet, so ship two things.
- A precise listening guide: what to listen for, where, and what "good" sounds like at each moment.
- A dev-only jukebox (`?debug&jukebox`) that plays each mountain's music and each marquee cue on demand.

## 3. One or two new things that add real value

Pick one or two, and justify them against the alternatives. Examples, which you can beat:

- **A fifth mountain** with a distinct biome and story: its own palette, music, marquee moments and home riders.
  It must name itself in one screenshot.
- **A night or storm variant of an existing mountain**, seeded into the chaos roll, that changes how the course
  plays.
- **A head-to-head Duel mode** against one signature rider's ghost, with a rivalry ladder across all twelve.
- **Finishing the garage:** procedural scarves, hats, trails and sled sounds that keep the player's vermillion
  signal (ART.md section 1). No pay-to-win.

## Don't break these

- **Determinism is absolute.** Ghosts are replays of recorded inputs. Nothing may let a player touch a ghost, and
  a ghost must be able to use anything a player can.
- **At most one clean break.** If you change the sim, bump `SIM_VERSION` (now 7) and regenerate the pools with
  `npm run generate-ghosts`. Follow DECISIONS 149, 203 and 231: saves keep gifts, sleds, paints, mastery and
  counts.
- **Original and procedural.** All art and audio stay procedural and original: no copying or close evocation of
  any existing game's names, characters, art, music or HUD.
- **Bars.**
  - High and Medium hold 60 fps on desktop, and phone Medium holds 60.
  - Low must not get worse, and should beat the old build at 6x throttle on a very first run (37/49/38 fps on
    Pinecrest/Ember/Sakura in round 5).
  - The first frame must not get slower.
  - The build is 723 KB zipped: justify every 100 KB you add, and stay under 1 MB.
  - Tests and tsc stay green.
- **Honesty.** Measure before and after with the telemetry pilots (`lab.ts`, `telemetry.js`, `tele-r5.mjs`) and
  the perf probes. Say what you measured, what you only saw in scripted runs, and what still needs a human to play
  or hear. Don't claim it's 10/10.
- **Process.**
  - Work on a new branch from `main`. Use hand-made worktrees for parallel lanes.
  - Only the main session runs `playwright-cli close-all`, and only at the very end.
  - Use the headless playwright configs. Close every browser-pane tab before perf probes, and run at most two
    playwright browsers at once.
  - Don't merge, push or deploy until the owner asks.

## Deliver

- The review and the plan in DECISIONS.md, written before you build.
- Telemetry before and after for each change, perf on every tier, size, and audio loudness and CPU numbers.
- Screenshots of every marquee moment and every reworked place, on desktop, phone and Low, with the console clean.
- README and ART.md brought up to date.
- The listening guide and the jukebox.
- A report that leads with what changed for a player, then:
  - what was measured and what still needs a human;
  - a short play-and-listen route the owner can follow;
  - the weakest remaining part;
  - the open questions only the owner can decide.
