# Ghost Sled, round 7: from an 8 to a 10

You're working on Ghost Sled, a downhill sled racer for the browser and CrazyGames, in this repo. It's built with
Vite, TypeScript and three.js, and every mesh, texture, sound and note of music is generated in code. Before you
change anything, read:

- the README, above all "Round 6 play-test" and "Round 6 performance";
- DECISIONS.md, all of it, and closely items 239 onward (round 6's review, plan and results);
- ART.md (the art bible) and LISTENING.md (the listening route and the calls only an ear can make);
- `notes/r6-feel.md`, `notes/r6-music.md` and `notes/r6-world.md`;
- `prompts/round-6-polish-to-ten.md`, the brief this round builds on.

The owner rates the game about 8 out of 10. It has a real foundation: a clear stylised look, a race that is live on
a first run, the lantern's dash-or-ward choice, twelve signature riders, set pieces that each play their own way,
written songs mixed to a measured loudness, and a garage. This round's job is the jump from **a very good indie
game to something that feels close to AAA**. That means:

- a groundbreaking look and feel;
- a soundtrack that stands with the best racing-game scores;
- depth that holds a player for their 50th run;
- wow moments throughout that never feel like a repeat.

**The look comes first.** The owner's top request is that the game look amazing, so the biggest share of this round
goes to section 1.

**You have full creative control, and the owner will not review the plan.** Run the whole round end to end
without stopping for approval. Make the calls yourself and record your reasoning in DECISIONS.md as you go. Ask the
owner only if you are truly blocked, for example on a missing account or a licence you cannot check.

Be bold:

- Replace systems, re-stage whole places, rewrite the music, and cut things that are merely fine.
- Bring in one or two new courses, mechanics or features where they add real depth and character.

Earlier rounds kept everything generated in code. **That is no longer a rule.** Use produced audio files, and
other asset files such as textures or models, wherever they give a clearly better result than generating it in
code. Every bold call needs a reason a player would feel, and a measurement that shows it worked.

## Where the game stands (a quick outside review)

**What a player will love:** the First Drop's valley reveal; Old Town's lit street at golden hour; the Ice Cavern's
lantern gates; Ember's cone under its smoke deck; Sakura's palette; the finish square; a lantern you choose to
spend or keep.

**What holds it at an 8:**

- **No human has played round 6 or heard its music.** Everything in its write-up is scripted or measured. Treat
  round 6's claims as hypotheses, and check them before you build on them.
- **Wow risks repetition.** Twelve set pieces share five verbs: gates appear four times, rings three, race three.
  Each plays identically every run. By the fifth run on a mountain, nothing in it is new.
- **Scale.** Four mountains of about 2 to 2.5 minutes each is a short game. The 10th run has nowhere new to go.
- **The skill curve is wrong at both ends.**
  - The clumsy pilot finishes 0 of 24 runs. A struggling player never sees the finish town.
  - The expert pilot wins fewer set pieces than the mid pilot (36 against 50 of 72), because dashing before every
    lip flies it over the rings. Mastery should never be punished by the moment meant to reward it.
  - Skilled runs read as a less live race (0.61 to 0.71) than novice runs (0.93).
- **The look is stylised, but not yet premium.**
  - Foreground rocks are faceted slabs that read as untextured boxes at the frame's edge. The First Drop shows
    this.
  - Snow lacks surface detail near the lens.
  - The rider, who is in every frame, is small and simple for a hero.
  - Lighting is mostly direct sun and fog: no light shafts, no scattering, and no per-place grade that makes a
    moment feel cinematic.
- **The music is limited by its instruments.** It has hooks, sections and a real master now, but every voice is
  a simple Web Audio synth. To sound like a top-tier score it needs richer timbres, space, and themes that recur
  and develop across the game.
- **Missing table stakes for a premium feel:**
  - No gamepad support, and no rumble.
  - No way to watch your run back, even though every run is a deterministic record that could be replayed for
    free.
- **Low at 6x throttle has been level, not better, for three rounds.** The cost is page work round the riders'
  labels (DECISIONS 217, 238).

Start by checking this review against the real build. Play it yourself in a real browser, on desktop and on a phone
viewport, across all four mountains, a Daily and a Cup, with a first, second and fifth run on at least one
mountain. Use the scripted pilots for numbers, and read the frames yourself. Then write a short, blunt review into
DECISIONS.md:

- per mountain, what is wonderful, what is flat, and what looks cheap at speed;
- where a player stops playing, and why;
- how the music reads and measures.

Then write the round's plan there **before you build**. Plan 8 to 12 changes, biggest lift for a player first, with
at least a third of them lifting the look. For each, name the one thing a player will say about it. Say what you rejected, and why. Then start building straight
away; nobody needs to approve the plan.

## 1. A look that stops people in their tracks (the round's first priority)

**The visual lift is the most important thing this round.** Put the biggest share of the effort here. It must look
amazing, not just better. Someone who played round 6 should see the difference in the first second of a run.
Every frame, at any second of any run, should be good enough for a store capsule or a trailer.

Keep the stylised identity in ART.md, but you may push it, redefine it or rewrite the art bible if a bolder
direction looks better. Treat the directions below as a floor to beat, not a list to tick off.

### Art direction first

Before you build, write an art direction for each mountain into ART.md:

- the feeling it should give;
- a colour script along the run: how light, palette and grade change from the start, through each place, to the
  finish;
- three or four hero vistas, the postcard frames a player will screenshot;
- the one image that names the mountain.

Every visual change serves that direction. Original work only: no copying, or closely evoking, any existing game's
look.

### Light and atmosphere

- **Light you can see.** Light shafts through trees, towers, torii and cavern mouths, and sun breaking through the
  cloud.
- **Air with depth.** Height fog with sun scattering, and layers of aerial perspective, so the far range goes soft
  and blue. Cloud shadows sweep across the valleys.
- **Light that moves through the run.** Each run's light changes along the course, and the change is staged: dawn
  breaking as you leave the cavern, golden hour deepening into the finish town, the aurora sharpening as night
  falls.
- **Light from lanterns, windows, fireworks and lava** that actually lights the snow, the rider and the riders
  round you.
- **The rider is lit like a hero:** a rim light, and a soft key that keeps them readable in every light.
- **A colour grade per place and per moment,** blended along the course: the cavern's cold, the burst into dawn,
  the town's warmth.

### The rendering pipeline

Upgrade the pipeline wherever it pays, on High first:

- filmic tone mapping (AgX or similar) and well-tuned bloom;
- ambient occlusion (GTAO or similar) and contact shadows, so everything sits on the ground;
- soft shadows with the right distance on each tier;
- temporal anti-aliasing, or a better AA, so nothing shimmers at speed;
- reflections on ice and the lakes;
- depth of field in the camera beats, and speed-scaled motion blur;
- subtle lens character, kept tasteful.

You may add an **Ultra tier** above High for strong GPUs. You may also move to three.js's WebGPU renderer if it
clearly looks better, as long as WebGL2 remains a full fallback.

### Surfaces at speed

- **Snow.**
  - It sparkles near the lens and holds the sun far away.
  - Its shadows are blue and soft.
  - Wind carves ripples and sastrugi into it.
  - Riders cut real ruts into it, and those ruts last for the run.
  - Powder bursts on landings and sprays in carves, lit by the sun.
- **Ice** has depth, refraction, cracks and trapped bubbles.
- **Rock** has strata, overhangs and snow sitting on its ledges. Nowhere in the frame shows a faceted slab or an
  untextured box. The edges of the First Drop are the test.
- **Trees** sway in the wind, carry snow, and shed it as you pass.
- **Water, lava and lanterns** glow and move.
- **Seams are clean.** Where geometry meets the snow, blend it in; don't leave a hard seam.

### Scale and wonder

- **The range feels vast.** Each mountain's hero vistas open the world below the rider.
- **Landmarks lead you on.** You see them from far away and reach them later: the finish town's spires, the cone,
  the pagoda, the station mast.
- **Depth reads at a glance.** Near, middle, far and sky are distinct layers, and you feel the altitude.
- **Each mountain gets at least one jaw-drop reveal,** composed like a film shot and timed to the music.

### Effects

- **Weather has volume.** A blizzard closes in. Blossom falls in depth. Ash drifts in Ember's air.
- **The world breaks.** Ice shatters, fences splinter, and snow cornices collapse.
- **Ghosts look like glass.** Their sleds have fresnel, refraction and a spirit glow.
- **Spirit effects are beautiful,** for the lantern, the dash, the ward and the gates.
- **Fireworks and set-piece effects get the production of a launch trailer.**

### The hero

- **The rider is the most-looked-at thing in the game, so make them worth looking at:**
  - a stronger silhouette and better proportions;
  - secondary motion in the scarf, coat and hat;
  - weight shifts into carves, and anticipation before a pop;
  - reactions to passes, wipeouts and wins;
  - a finish celebration with personality.
- **Signature riders get the same care** on their glass sleds.

### Camera and motion

- **Speed you feel.** Tune FOV, shake, near-field streaks and motion blur to the speed curve.
- **Cinematic beats on the big moments:**
  - a held wide on a valley leap;
  - a brief slow-motion hero frame at a leap's apex, timed to the music;
  - a low tracking shot through a street;
  - a whip-pan onto a reveal.

  None of them may take the steering away from the player.
- **Nothing looks broken in motion:** no pop-in, no shimmering, no z-fighting, and no level-of-detail changes you
  can see.

### Screens and UI

The title, garage, results, pause and loading screens are part of the look.

- **The title is a living piece of key art.** It is a composed 3D scene that changes with the mountain you pick.
- **Results feel like a celebration,** not a table.
- **Motion design runs throughout:** screen transitions, a HUD that animates with intent, and typography with
  character.
- **Use the `design-taste-frontend` skill** for UI work. Run `web-design-guidelines` on changed UI files before you
  finish.

### Every tier designed on purpose

- **Ultra and High** are the showpiece.
- **Medium** keeps the grade, the light and the atmosphere.
- **Low and phone** each keep a beautiful look of their own, designed rather than stripped down. On these tiers,
  stylised tricks are better than missing effects.

### The visual review loop

Do not judge your own frames alone.

1. For each mountain, capture a fixed set of frames: every place, every hero vista, every set piece, and evenly
   spaced points in between. Capture on Ultra or High, on Medium, on Low and on a phone, before you change anything.
   Capture short sequences in motion too, not just stills.
2. After each lift, recapture the same frames at the same distances, and put them side by side in contact sheets.
3. Have an independent critic grade every frame out of 10. The critic is a subagent with a fresh context, given
   only the frames and ART.md. It grades as a demanding art director would, on:
   - composition;
   - light and atmosphere;
   - material craft;
   - readability at speed;
   - the mountain's identity;
   - "would this be a store capsule?"

   It names every flaw it sees.
4. Fix the flaws and repeat. Do at least three passes on each mountain. Stop only when no frame scores under 8 and
   the hero vistas score 9 or more.
5. Record the scores for each pass in DECISIONS.md.

Back every lift with its cost in draw calls, triangles and frame time on each tier.

## 2. Wow moments that never feel repeated

- **Audit the set pieces for sameness.** Where two set pieces share a verb, either make them play clearly
  differently or give one of them a new verb. Each mountain's three should feel like three different ideas.
- **Variation by seed.** Give each set piece two or three seeded variants, so the 10th run is not the 1st. A race
  machine leaves early or late. Gates swing or sit. A span falls left to right, or from the far end towards you.
  A storm closes in over the leap. Variants must stay deterministic and fair, and ghosts must ride them.
- **Rare "legend" moments.** One or two per mountain: seeded, uncommon (about 1 run in 8 to 15), and never in a
  session's first run. Players should tell each other about them. They must be visual or structural spectacle that
  is fair to every rider in the race. Examples to beat:
  - a lantern-dragon procession winding across Sakura's valley;
  - Ember's cone erupting and lighting the smoke deck from below;
  - a herd crossing the Crevasse Fields;
  - the aurora coming down to the snow.
- **A climax for every mountain.** The last stage should build to a peak, in music and picture, and land in the
  finish town on the beat.
- **Your run, directed.** After the finish, offer a short highlight reel of the player's own run, cut from its
  deterministic record:
  - the best leap, the closest pass and the set piece won;
  - shot with cinematic cameras and scored with the run's own music;
  - shareable, if CrazyGames allows it.

  This is a premium-feeling feature that the architecture already makes cheap. Pursue it unless you find a better
  use of the budget.

## 3. Depth and scale: one or two new things

Bring in one or two new courses, mechanics or features that deepen the game and give it more character. Justify
each against the alternatives in DECISIONS.md. Directions to weigh, which you can beat:

- **A fifth mountain, as the game's finale or as a new biome.** It must name itself in one screenshot, and needs
  its own palette, architecture, people, music, three set pieces with verbs not used elsewhere, and home riders.
  Two directions:
  - *The summit the spirit lights come from.* A descent through cloud into the lanterns' own country, unlocked by
    mastery across the other four. This pays off the game's ghosts-and-lanterns story.
  - *A sea-cliff mountain that runs down to a frozen harbour.* Lighthouse, ice-bound ships, a storm off the water.
    It is the first coast in a game of peaks.
- **A new mechanic that deepens every mountain.** It should give the lantern, the line or the race a new
  decision, not another pickup. Two candidates:
  - **A third use for a full lantern.** It opens a spirit route at a veil arch: an alternate line through a
    mirrored version of the ground, with its own risks.
  - **Weather fronts that move the safe line mid-run.**

  Check any idea that makes your run depend on the ghosts in your field against the determinism rules below
  before you choose it. Drafting off a ghost, for example, would make a record depend on its field.
- **A campaign spine.** "The Twelve": a short journey that has you beat each signature rider on their home ground,
  with a final race against all of them. It gives the existing roster a story and gives runs 10 to 50 a direction.

Pick the one or two that add the most for the effort and the risk. A new mountain is the biggest lift to scale, and
a new mechanic is the biggest lift to depth. If you do both, plan the clean break around them.

## 4. A soundtrack that stands with the best

**The music no longer has to be generated live in code.** Produced, pre-rendered audio files are allowed and
encouraged wherever they sound better. Use whatever route gives the best result:

- **Offline rendering.** Compose and produce in code, then render high-quality stems or full mixes offline, with
  as much synthesis, layering, space and mastering as you like. Ship them as compressed audio files (Opus or OGG,
  with an AAC or MP3 fallback where a browser needs one).
- **A production tool.** If a DAW connector such as Ableton is connected in your session, you may produce and
  bounce stems there.
- **Generated audio.** You may use an audio-generation tool, but only if its terms allow commercial use in a game
  sold on CrazyGames.
- **The existing live engine.** Keep the live engine for what it does best: cues pitched into the key, stingers,
  the crowd, and layers that react to the race.

Rules for any audio file you ship:

- Every piece must be original. Don't imitate or quote any existing soundtrack, song or artist.
- Record the source, tool and licence of every audio file in a new `ASSETS.md`.

**Give each course its own style.** The courses do not need to sound alike. Each mountain gets its own genre,
instruments, tempo range and production, so that a few seconds of music name the course as surely as a
screenshot does. Choose the styles yourself, and justify each against the mountain's place, light and pace. Some
directions to beat:

- **Pinecrest:** bright folk-orchestral, with fiddle, acoustic guitar and brass.
- **Frostfang:** glassy, pulsing electronica that opens into a wide ambient space under the aurora.
- **Ember:** heavy drums, distorted bass and industrial percussion.
- **Sakura:** plucked strings and breathy wind over a warm, laid-back groove.
- **Any new course:** its own style again.

A shared motif that each style re-voices is welcome if it helps the game feel whole, but variety comes first.

- **Production at the level of a top-tier racing game.** That means:
  - real arrangement, with intros, builds, drops, breakdowns and a climax;
  - mixing and mastering that holds up on headphones, laptop speakers and a phone;
  - enough material per course that a run of 2 to 3 minutes never loops audibly.
- **Scoring that follows the run.**
  - Re-sequence stems or sections to the course, and layer up with the race state.
  - Each set-piece verb gets a stinger written for it, in that course's style.
  - The music drops out for a breath before the biggest leap and crashes back in on the landing.
  - The last stage builds to a climax that lands in the finish town on the beat.
  - The title gets its own theme, and the results screen gets a reprise.
- **Rider motifs.** Give each signature rider a short motif, heard when they are your rival or pass you.
- **Loading.** Stream the music after the first frame, so it never slows the first frame or the start of a run.
  Load each course's music only when that course is picked, and cache it for later runs. Low and phone can use
  lighter encodes.
- **The master.** Aim for about -16 LUFS with a true-peak ceiling near -1 dBTP, with the music level with the
  effects and a stereo width that survives mono and phone speakers. Duck the music cleanly under the big effects.
  Report the numbers per course.

You cannot hear, so measure and analyse:

- loudness, spectrum, masking against the effects, and audio main-thread time on Low;
- the music as a score: voice leading, harmonic movement, and the hooks' contour and range;
- a check that no two courses' music measures alike in tempo, spectrum and instruments.

Extend the jukebox to every new piece, and LISTENING.md to every new moment and every course's style, so the
owner's ears can judge what yours can't.

## 5. Feel, access and controls

- **The struggling player reaches the finish town.** Find a fair way to get the clumsy pilot finishing most of its
  runs. Say how you know it is fair to the ghosts and to a skilled player.
- **Mastery is never punished.** Retune the set pieces so the expert pilot wins at least as many as the mid pilot.
  Then check that the trade-offs each set piece poses still hold.
- **Gamepad support**, with rumble where the browser allows it, tuned for analogue steering. Show its glyphs in the
  HUD hints and on the title.
- **Onboarding.** Control hints leave once a player has shown they know a control. In the current captures,
  "Steer" is still on screen at 1:24.
- **Make the race live for skilled players.** Keep runs 2 to 20 a live race at the player's level, without faking
  ghosts.

## What still holds

These few rules remain because breaking them would break the game, or the owner's right to sell it. Everything
else is open.

- **Determinism.** The sim runs at a fixed 60 Hz, and ghosts are replays of recorded inputs, so this is what makes
  the race work at all. Anything that affects a run lives in the sim, is seeded, and replays exactly. Nothing may
  let a player touch, slow or block a ghost, and a ghost must be able to use anything a player can.
- **Sim changes go in one version bump.** Change the sim as much as the round needs, but land every change under a
  single bump of `SIM_VERSION` (now 8), then regenerate the pools with `npm run generate-ghosts`. Follow DECISIONS
  149, 203 and 231: saves keep gifts, sleds, looks, mastery and counts, and older bests, grudges and links stay
  safe.
- **Original, and cleared to sell.** Every name, character, image, model, sound and piece of music must be
  original. Don't copy or closely evoke any existing game, soundtrack or artist. Any file made with an outside tool
  must allow commercial use, and goes in `ASSETS.md` with its source and licence.
- **Quality bars.** These are targets, not limits on ambition.
  - High and Medium hold 60 fps on desktop, and phone Medium holds 60.
  - Low must not get worse, and should finally beat round 6 at 6x throttle on a very first run. The cost is page
    work round the labels (DECISIONS 217, 238), so attack that with a design, not a trim.
  - The first frame must not get slower. Heavy assets load after it, or when their course is picked.
- **Size.** The old 1 MB budget is gone. Use the bytes the best result needs.
  - Check CrazyGames' current developer requirements for build size and initial download.
  - Stay within those requirements, and raise the 5 MB check in `npm run release` to match them.
  - Keep the initial download small, and stream music and course assets after the first frame.
  - Report the size of the initial download and of the whole build.
- **Tests.** Tests and tsc stay green. New systems get tests in the style of `moments`, `fairness` and
  `determinism`.
- **Honesty.** Measure before and after with the telemetry pilots (`lab.ts`, `telemetry.js`, the `tele-*`
  scripts), the perf probes, `loudness.js` and `audiocpu.js`. Report three things separately: what you measured,
  what you only saw in scripted runs, and what still needs a human to play or hear. Don't claim it's a 10.
- **Process.**
  - Work on a new branch from `main`, and commit as you go.
  - Run parallel lanes in hand-made worktrees cut from the branch, not `isolation: worktree`, which cuts from
    `origin/main`. Good lanes are look, music, world or new course, and feel.
  - Use the headless playwright configs; a sleeping display throttles headed Chrome.
  - Close browser-pane tabs before perf probes, run at most two playwright browsers at once, and interleave four
    to five passes before you call a result on Low.
  - Only the main session runs `playwright-cli close-all`, and only at the very end.
  - Don't merge, push or deploy until the owner asks.

## Deliver

- The review and the plan in DECISIONS.md, written before you build.
- Telemetry before and after for each change, plus:
  - finishes by pilot;
  - set pieces won by pilot;
  - how live the race is on runs 1, 2 and 5;
  - how often a variant or legend moment appears;
  - perf on every tier, the first frame and size;
  - loudness and audio CPU.
- Screenshots of every set piece, variant, legend moment, reworked place and new course, on desktop, phone and Low,
  with the console clean. Contact sheets of before and after at the same distances.
- For the visual work:
  - the art direction for each mountain, in ART.md;
  - the critic's scores for every pass;
  - a folder of the best hero frames from each mountain, fit for a store page;
  - a short capture in motion of each mountain's best 30 seconds on the top tier, if the tooling can record it.
- README, ART.md and LISTENING.md brought up to date. The jukebox covers everything new.
- `ASSETS.md`, listing every non-code asset with its source, tool and licence.
- The size of the initial download and of the whole build, set against CrazyGames' current requirements.
- A report that leads with what changed for a player, then:
  - what was measured, and what still needs a human;
  - a 15-minute play-and-listen route the owner can follow;
  - the weakest remaining part;
  - the open questions only the owner can decide.
