# Ghost Sled

A downhill sled race for the browser. You carve, drift, pop and trick your way down a 4.5 km descent,
through ravines, frozen lakes, village streets and off real cliffs, racing the translucent ghosts of
twelve signature riders and a crowd of others to a finish town. Spirit lights on the brave lines, and
your skill, fill a lantern you either spend on a dash (through trees, faster) or keep as a ward that
takes the next hit. There are five mountains; the fifth, Lanternfall, is the finale, opened by beating
The Twelve one duel at a time. Each mountain's three biggest places are set pieces, fifteen in all on
twelve different verbs (fly a ring line, hold a slide across a frozen lake, outrun a falling span, race a
cable car, thread lantern gates, ring bells, carry a flame to the line), each with two or three variants
picked by the run's seed, and a board of goals on each teaches it. Every mountain has its own produced
score in its own genre, sequenced to the run, and a garage dresses the rider. Every run rolls a little
controlled chaos (a mood, maybe an event, now and then a legend), so no two runs feel the same. After the
finish, Watch Your Run cuts a highlight reel from the run's own record.

Built with Vite + TypeScript + three.js. Every mesh, texture and sound effect is generated in code at run
time. The music is the one exception since round 7: it is written and synthesized in this repository
(`npm run music`) and shipped as audio files in `public/music/`. `ASSETS.md` lists every shipped file, how
it was made and its licence position. There are no image, model or font files.

**The Twelve.** Twelve signature riders, each with a home mountain. Beat them one duel at a time, gentlest
first: a duel is a run on their home ground with their real record as your rival, won by reaching the line
ahead of their time. The title shows who is next and the full ladder. Eleven open Lanternfall, where The
Hollow King waits, and after him one last race against all twelve at once.

**Set pieces.** Each mountain has three, one a stage, each with its own verb: rings, slide, steps, collapse,
race, gates, surge, flourish, shatter, and Lanternfall's follow, kindle and carry. No verb is used more than
twice, and each set piece has two or three variants chosen by the run's seed, so a ghost rides the variant of its
own run. Beating a set piece lights a whole lantern and earns its star on the mountain's board.

**Legend moments.** After a session's first run, about one run in ten has a legend: a white stag in the glades, a
lantern dragon on the benches, the aurora come down to the snow. They never hurt a run.

**Lanternfall.** The fifth mountain, a night mountain: a dive into cloud behind a guide light, a road of stone
lamps to light, and a flame to carry to the great lantern at the line. A fall or a spent ward gutters the flame.
Ride back up to speed within four seconds and it catches again; fall again while it gutters and it is out. The
Hollow King's home.

**The race.** From your second run on a mountain seven ghosts ride with you, spread from a little quicker than
your best recent run to your slowest: whichever run you have, someone is near. Every one is a real record.

**The fairness promise.** Nothing stands within 5.5 m of the line where a sled cannot hold it: in a kicker's
landing, for 80 m above a leap's lip, and through a mogul field and 30 m past it. What stands on a lake stands
along its shores, 17 m from the line.

**Tricks.** In the air, what the steer is doing when you press decides the trick: press with the steer to a side to
grab that side (held, it deepens three times), steer with the grab to spin it, against it to tweak; press with the
steer centred and hold to flip. Let go of a grab just before touchdown and it is a stomp, a perfect landing. A short
grab held into the snow lands clean; a deep one held into the snow on a big flight is a fall. Eighteen named tricks,
one of them each sled's own move (two quick taps).

**Charms.** Up to three gates a run, each three arches of light side by side: the arch you ride through is your charm
for the rest of the run, with no menu and no stop. Twenty-four charms in three families (speed, style and survival)
and seven named pairs; the middle arch is always a survival charm, so a rider who only steers still takes one.

**Spirit Flow.** Style that outlives a banked combo builds a level from 0 to 6. It multiplies the lantern's gain and
the points, gives a little speed, and is drawn on the rider: richer colour, a flame off the scarf, wind lines, sparks
and brighter ghosts.

**Showdowns.** Ride level with one of The Twelve, your grudge or your own best for two seconds and a showdown starts
to a marker 300 m on. A clean close pass steals a wisp. The pool's riders race, draft and duel each other too.

**Rider Rank and the Almanac.** Every run pays experience into one rank, and each rank turns a page of a fifty-page
Almanac. The first ten pages each change play (the second and third charm gates, more charms, daily contracts, the
album, a sled, a mirror mountain, the Long Night). A daily flame, three daily contracts, Cup leagues and monthly
chapters that never expire give reasons to come back. Gifts stay the one currency; nothing bought wins a race; there
are no ads.

**After The Twelve.** Mirror mountains turn a course left for right (picture, steering and sound). The Long Night
rides whole mountains back to back, carrying the lantern, the get-ups and the last three charms from leg to leg.
Every mountain has a second hour to earn (Pinecrest at Dusk, Frostfang at Noon, Ember at Night, Sakura in the Evening,
Lanternfall at First Light), picked under Ride.

**Trials (from Almanac page 35, or the crown).** Every week a twist on a named mountain, the same for everyone:
mirrored, a mood, the other hour or an event, one charm family, and what counts (the clock, the clock without a
get-up, style points or perfect landings). Its bronze, silver and gold are set by the week's own field of riders; pick
it on the Cup's card. Dev: `?debug&trials`, `?debug&week=2026-W50` (another week's Cup and Trial), `&demo=N` rides
the Nth rider of the Trial's field.

**Photos and the album.** Pause, or open the results, and the camera beside Home holds the run where it is: turn the
lens round the rider, set the focal length and save a PNG, with or without a run card. The album's stickers are
frames kept from the run that earned them.

**Save Clip.** From the results, save your run's highlight reel as a short video (about fifteen seconds: the best
moments, the game named on the first shot and your run's card on the last, with the game's sound) to share; tap it
again on a phone to hand it straight to an app. Nothing records until you ask.

Screenshots of the final build, captured from live runs on desktop and phone, are in `screenshots/`.

## Run

```bash
npm install
```

```bash
npm run dev
```

Open http://127.0.0.1:5173. Useful URL switches (local mock platform only):

| Switch | Effect |
| --- | --- |
| `?mockAds=1` | Enable mock ads (revive, double gifts, midgame) outside dev |
| `?mockAdFail=1` | Make mock ads fail to test error paths |
| `?platform=mock` | Skip loading the CrazyGames SDK |
| `?c=<record>` | Open a friend's challenge (normally produced by the in-game share button) |
| `?c=<record>&reel=1` | Open a shared highlight reel: it plays on the title, then the challenge is offered as before |
| `?nostems` | Play the live band only (the fallback), never the produced score |

Dev switches (on in `npm run dev`, or anywhere with `?debug`):

| Switch | Effect |
| --- | --- |
| `?fps` | Frame-time overlay (fps, p90, tier) |
| `?tier=low\|medium\|high\|ultra` | Force a quality tier instead of the automatic one |
| `?autoride=1` | Skip the title and start a run |
| `?m=N` | Mountain 0 to 4 (unlocks ignored; 4 is Lanternfall) |
| `?variant=N` | Ride every set piece's Nth variant (0 to 2) |
| `?legend=1` or `2` | Ride the mountain's first or second legend moment |
| `?post=none` | Round 6's post stack on this tier: every round 7 pass off |
| `?post=-ao,-blur` | Everything but the passes named. Names: `ao`, `contact`, `shafts`, `dof`, `blur`, `mirror`, `taa`, `aa`, `letterbox`, `fit`, `lens` |
| `?post=ao,shafts` | Only the passes named |
| `?postview=depth\|ao\|contact\|shafts` | Show what a pass made instead of the picture |
| `?cine=dof:1,focus:7,blur:1,box:1` | Hold the camera's cine state, to see a beat's passes without the beat |
| `?gpu` | Time each pass on the GPU (`__gs.world.post.pipe.timer.ms`) |
| `?taa` | The temporal anti-aliasing experiment (not shipped on any tier) |
| `?kz=3700&kto=4200&kl=3500&kr=6&ku=2&ks=0.4&kd=0.1&ka=30&kh=1&kc=0.3&kx=0.08&ky=0.2` | Compose a title shot without a rebuild (`keyart.ts` `devShot`: the reel's first and last metre, the light's metre, then the lens) |
| `?mood=N`, `?event=N` | Force a chaos mood or mid-run event |
| `?demo=N` | Replay the Nth-best pool ghost as the player, with its chaos roll (it dashes and wards as it did) |
| `?riders=N` | Dress the field as the signature riders from roster index N (render only) |
| `?jukebox` | The music jukebox over the title: the main theme, each of the five mountains' produced score by section, the live band, the drops, the lift, the breath, the finale, the results reprise, a stinger for every set-piece verb, the twelve riders' motifs and every cue, on demand (`LISTENING.md` is the route for listening to the game) |

The UI harness (`ui-harness.html` on the dev server) shows screens with fake models; round 7 added `title-twelve`,
`title-twelve-wait`, `title-twelve-king`, `title-twelve-final`, `title-twelve-crowned`, `results-win`,
`results-duel`, `results-duel-lost`, `results-duel-opens` and `results-crowned`.

## Controls

| Input | Steer | Action (one button) |
| --- | --- | --- |
| Keyboard | A / D or arrow keys | Space, Shift, S, W, Up or Down; E, Q or Enter to dash |
| Mouse | Move left / right of centre | Hold the left button; the right button dashes |
| Touch | Drag on the left 60% of the screen | Hold the right 40%; tap the lantern to dash |
| Gamepad | Either stick or the d-pad | A or the right trigger; X, B, a bumper or the left trigger to dash |

Hold the action to crouch (deeper carve, tuck); hold it while steering hard to drift; release to
pop. In the air, steer to spin; press with the steer to a side to grab that side, or with it centred and
hold to flip (press, then steer, for a flip that spins). Let go of a grab, or tap the action, just before
touchdown (when the ring on the snow flashes gold) for a perfect landing. A deep grab warns with a ring round
the sled's shadow: still held at touchdown on a big flight, it is a fall. P pauses.

Gamepad: either stick or the d-pad steers; A or the right trigger is the button; X, B, a bumper or the left
trigger spends the lantern; Start pauses. The menus follow the stick and the d-pad, A chooses, B goes back. The
pad rumbles on landings, hits and dashes where the browser allows it (Chrome and Edge with a dual-rumble pad);
Controller Rumble in the settings turns it off, and so does reduced motion. A pad run is in the input log like
any other and replays exactly.

A hard hit is a fall: you slide, lie in the snow a moment, get up and ride on, slower and with your combo gone.
You carry three get-ups (the pips by the stage line). One comes back for every 200 m you ride and all of them at
a stage line; a fall with none left ends the run. Falls in the first 700 m cost none. A fall that slides over a
stage line or the finish counts from the moment it crosses.

Quality is Low, Medium, High or Ultra. The game picks one from the GPU's name and measured frame times and
never picks Ultra by itself except on a GPU the browser names as discrete; anywhere else Ultra is a choice in
Settings (it is not offered on a touch device).

The Garage (the title's Garage button) sells sleds, paints, scarves, hats, trails and sled sounds for gifts.
Everything but a sled is a look or a sound only.

The lantern (three cells, top right; a round button on touch) fills from spirit lights and from skill.
A full one is a dash: 1.4 s as a spirit, faster, through any tree or rock in the way. Kept, it is a
ward: the next hit that would floor you is taken by the lantern instead. After a wreck, "Ride home as
a spirit" rides the rest of the descent outside the race (Escape returns to the card).

## Build

```bash
npm run build
```

Type-checks, then bundles to `dist/game` with relative paths.

## Test

```bash
npm test
```

| Suite | What it guarantees |
| --- | --- |
| `purity` | `src/sim` and `src/bot` never touch Math.random, engine-dependent Math, DOM, timers or rendering |
| `determinism` | A recorded run replays bit-identically through the real fixed-step loop at 60, 144 and 37 Hz, and however the course is read between ticks; a course is the same in any read order; every seed builds a descent; challenge links round-trip; chaos never moves static geometry |
| `fairness` | On every mountain and several daily seeds, to the finish and through the run-out, a lane around the safe line is clear of colliders, ramps and vents, stays in the corridor and is smooth enough to follow at top speed, each promise of a shape holds (a leap's height and landing, a ravine's walls, a lake's flatness, a bridge's fall, a tunnel's clear air, a fork's ridge and rejoin), and a simple driver gets down it on the real sim |
| `encoding` | Input logs and run records round-trip; 3-minute runs stay under 2 KB |
| `scoring`, `chaos`, `dmath` | Combo rules, chaos budget (about a third plain, never in a session's first run), deterministic math accuracy |
| `bot`, `ghostpool` | Bots are deterministic and compact; every bundled ghost replays to its stored score |
| `platform` | Ad pacing, idempotent gameplay start/stop, invite links |
| `migration` | A save and a link from an older sim lose nothing: replays move byte for byte to an archive, old bests show without blocking new ones, a grudge's tally survives, an old link is a target to beat |
| `standing`, `finishflow`, `field` | Race order by time, the finish flow, and a field built around your pace |
| `ladder`, `cup`, `rivalry`, `slowriders`, `pacer` | Ladder ranks and stage medals, the weekly Cup, the run's rival, and the paced riders that fill the slow end of the race, and the clocks of riders who read you |
| `ground`, `setpieces`, `overlook`, `midground`, `palette`, `feel` | World rules: nothing stands in the run, no stretch stays bare past about 300 m, the forest stands on the ground it is drawn over, each mountain keeps its own light, and the speed curves reach the cap |
| `moments` | Set pieces: three a named mountain, one a stage, each with its verb; no verb more than twice in the game; every variant can be won by the lab's pilots and none is a gift to a rider who does nothing; variants come up evenly; a legend on one later run in 8 to 15 and never a session's first, and the careful line rides every legend unhurt; a Daily's own; mastery stars are the verbs beaten (rides about 150 whole runs: about two minutes) |
| `simfix` | A line is crossed on the tick the sled crosses it, falling or not; a botched landing is always said; the carried flame gutters and catches, and a fall never leaves it higher |
| `getup` | A fall is got up from: three get-ups that come back with the riding; a record replayed beside other riders gives the same falls and the same hash; a fall never sets a rider forward or sends one off faster |
| `pad`, `hints` | A gamepad's dead zone, curve, trigger hysteresis and taps between ticks (`determinism` replays a pad run to the same hash); control hints that leave once learned or never taken up |
| `twelve`, `moment` | The Twelve: a duel's field holds that rider's real record once, as the one rival; the ladder's walk; Lanternfall opens at eleven; the last race; and which of four endings the results lead with |
| `reel` | The highlight reel: its scan's hash is the replay's, the same record gives the same shots, windows never overlap and total 12 to 30 s, a wrecked run plays to its wreck |
| `audiostems` | The produced score: the section scheduler, the store, the packs, the motifs, and that no two courses measure alike in tempo, spectrum and instruments |
| `quality`, `pipeline` | The tier controller never climbs to Ultra without a discrete GPU's ceiling; the frame's pass plan and its cost table agree, Low adds nothing, a camera at rest draws no lens pass |
| `rockforms`, `ruts`, `fxbudget`, `lanternworld` | Every hazard's drawn form sits inside its collider and fills it; a rut does not age and a flight leaves none; pooled effects keep their budgets by tier and draw nothing while idle; Lanternfall's kit and cloud |

## Generate ghosts

```bash
npm run generate-ghosts
```

Runs the bot (`src/bot`) on the real simulation at a spread of skill levels, with human-like
mistakes, and writes `src/data/ghosts/<mountain>.json` in race order, with each ghost's stage splits.
Each pool is 30 crowd runs, one run by each of the twelve signature riders (`src/bot/roster.ts`), ridden
with its style, and a fast end of up to eight racers (the quickest of 96 more runs, each half a second from the
next): 46 to 50 riders and 34 to 40 KB a mountain, five mountains, about three minutes to generate. `npm run generate-ghosts -- --falls` re-reads where each ghost fell (wards count) without
riding anything again.
The slowest bots finish in about 2:30, so `src/game/slowriders.ts` fills the race down to 5:00 at load
with real runs played at a slower pace. Re-run it whenever simulation behaviour
changes (bump `SIM_VERSION` in `src/sim/sim.ts`, now 9; the ghost pool test fails on stale pools). The Daily
Mountain's and the Cup's pools are generated at load by the same bot in a Web Worker, with two racers each.

## Build the music

```bash
npm run music
```

Renders, masters, encodes and measures the whole produced score from source (`scripts/music/`): five courses
and the title theme, written as notation in `scripts/music/pieces/`, synthesized by the project's own renderer,
encoded to Opus in WebM with an AAC fallback by `ffmpeg-static` (a devDependency; its install script must have
run, which `allowScripts` in `package.json` permits). It writes the packs to `public/music/`, the manifest to
`src/audio/produced.json` and its measurements to `scripts/music/analysis.json`. About 10 minutes on a quiet
machine, 30 on a busy one. `npm run music ember` rebuilds one piece, but stamps the new version on that piece
only, so finish any change with a full build. `npm run music -- --wav` also writes every stem and a sequenced
reference run of each course as WAV files under `dist/music/wav/`. The packs are committed (56.8 MB): rebuild
only when the score changes, because every changed pack adds its size to the repository's history.

The game streams the music after the first frame: the title's pack first, a mountain's pack when it is picked,
kept in the Cache API. Low and phones get lighter packs. Until a pack arrives, and on a browser that decodes
neither Opus nor AAC, the live band (round 6's music, synthesized in the browser) plays.

## Package for CrazyGames

```bash
npm run release
```

Runs the tests, builds, and writes `dist/ghost-sled.zip` (index.html at the root). The script fails if the
whole build is over 80 MB, has more than 1,500 files, or its initial download is over 20 MB. The initial
download is counted as every file outside `music/`, the title theme's packs, the decode probes and the largest
course's desktop pack, since no music is fetched before the first frame and a course's pack only when it is
picked.

| | The check | Measured at the last merge | CrazyGames allows |
| --- | --- | --- | --- |
| Whole build | at most 80 MB | 60.33 MB | 250 MB |
| Files | at most 1,500 | 35 | 1,500 |
| Initial download | at most 20 MB | 11.29 MB | 50 MB, and 20 MB for the mobile homepage |

(CrazyGames' figures are from docs.crazygames.com/requirements/technical, read 2026-11-12.) Upload the zip in
the CrazyGames developer portal and enable "Progress Save" so the data module is active.

## Performance

Measured on the production build in headless Chrome on the real GPU (an Intel Arc 130V laptop on
mains power), with Chrome's CPU throttling as a stand-in for slower machines. Headless, because a
headed browser drops to a couple of frames a second once the laptop's display sleeps.

The fun pass was measured against the build before it (f8294d8), interleaved run for run in fresh
browser sessions. The laptop was running other work at the same time, so absolute frame rates moved
by up to a factor of two over the day; only the side-by-side figures compare.

| Check | Before the fun pass | After |
| --- | --- | --- |
| First rendered frame, CPU throttled 6x (median of warm runs) | 2.28 s | 2.02 s |
| High tier at 1x: plain run and Lantern Night | 60 fps, p90 16.9 ms | 60 fps, p90 17.0 ms |
| Medium and Low tier at 1x, plain run | 60 fps | 60 fps |
| High tier through an avalanche chase, CPU throttled 4x | 45 fps, p90 33.4 ms (53 on a quieter run) | 41 fps, p90 33.7 ms (50 on a quieter run) |
| Low tier, CPU throttled 6x (median of 6 interleaved runs) | 30.9 fps (29.3 with audio off) | 25.5 fps (29.7 with audio off) |
| Draw calls, High / Medium / Low | 70 / 66 / 45 | 69 / 65 / 43 |
| Web Audio nodes made per second at a steady cruise | 39 | 52 |
| Build size | 1.34 MB unpacked | 1.57 MB unpacked, 477 KB zipped |

The fun pass adds no draw calls on any tier: kilometre arches and graveyard cairns are Medium and
High only, built on idle time after the first frame (DECISIONS 96). What it adds is main-thread
audio: the band grooves from the first cruise, ghosts you pass join as a choir, and every named
moment has its own sound. Voices make their nodes between frames and gift pickups play from
pre-rendered takes (DECISIONS 89), but on a CPU throttled 6x the Low tier still runs a few frames a
second under the build before the fun pass; without audio the two are level.

The visual round (DECISIONS 102 to 109: painted skies, the sun's journey, the rounded rider, ghosts
on glass sleds, forest variants and bank dressing, the avalanche in the world) was measured the
same way against the build before it, over four interleaved rounds. The laptop ran slower that day
than the figures above, so again only the side-by-side figures compare:

| Check | Before the visual round | After |
| --- | --- | --- |
| High tier at 1x: plain run, Lantern Night, Glass Ice | 60 fps, p90 17 ms | 60 fps, p90 17 ms |
| High tier through an avalanche chase, CPU throttled 4x (median of 4) | 28.5 fps | 29 fps |
| Low tier, CPU throttled 6x (median of 4) | 17 fps | 17.5 fps |
| Draw calls, High / Low | 73 / 44 | 73 / 41 |
| Triangles, High / Low | 351k / 108k | 752k / 113k |

High's triangles doubled because each forest batch carries two tree variants and collapses the
unused one in the vertex shader (DECISIONS 106); Low keeps one variant. The course's z functions are
memoised (DECISIONS 109), which paid for the new effects' extra ground queries on throttled CPUs.

The world-scale round (DECISIONS 110 to 116: the mountain panorama, the mid-ground and its
villages, set pieces and crowds, ambient life, the directing camera, painted snow and bough pines)
was measured the same way against the build before it, in two interleaved rounds:

| Check | Before the world-scale round | After |
| --- | --- | --- |
| High tier at 1x: plain run and Lantern Night | 60 fps, p90 17 ms | 60 fps, p90 17 ms |
| Medium tier at 1x, plain run | 60 fps | 60 fps |
| Low tier, CPU throttled 6x | 18 and 19 fps | 27 and 21 fps |
| High tier through an avalanche chase, CPU throttled 4x | 45 and 47 fps | 28 and 40 fps |
| Draw calls, High / Medium / Low | 73 / 69 / 41 to 43 | 80 / 76 / 41 |
| Triangles, High / Medium / Low | 752k / 514k / 113k to 117k | 1.2M / 809k / 169k |

The throttled avalanche chase is the one regression: frame CPU rises about 12% across the new
systems and draw submission. The quality manager steps such a machine down to Medium, which holds
60 fps at 1x. The mirror inset leaves the mid-ground, set pieces and life out.

The second world-scale round (DECISIONS 117 to 124: overlooks, ride-through villages and enclosed
runs, the soundscape, hero moments, a living sky, forest LOD) was measured against the build before
it on a quiet machine, interleaved run for run. High and Medium rode 75 s, far enough to reach a
village:

| Check | Before round two | After |
| --- | --- | --- |
| High tier at 1x: plain run and Lantern Night | 60 fps, p90 17 ms | 60 fps, p90 17 ms |
| Medium tier at 1x, plain run | 60 fps | 60 fps |
| High tier through an avalanche chase, CPU throttled 4x (2 runs) | 37 and 56 fps | 43 and 53 fps |
| Low tier, CPU throttled 6x (median of 5, range) | 51 fps (26 to 55) | 43 fps (28 to 56) |
| Draw calls, High / Medium / Low | 80 / 76 / 43 | 89 / 84 / 45 |
| Triangles, High / Medium / Low | 1.21M / 809k / 173k | 780k / 526k / 125k |
| Build size, unpacked | 1.57 MB at the fun pass | 2.0 MB |

The forest's LOD paid for the round's geometry and more. Low at 6x throttle swings from about 26 to
56 fps on both builds from run to run, with every system slowing together in the slow runs, so the
difference is inside its noise; the systems the round added cost about 3% of Low's frame CPU. Low
makes only the soundscape's takes it plays, and none during a run.

The wow pass (DECISIONS 125 to 217: real places on a 4.5 km course, 30 m/s, three stages, a finish town)
was measured against the build before it (3565a14) on a quiet machine, interleaved in fresh sessions (old,
new, new, old) with saves cleared between probes. High and Medium rode a whole descent, so the heaviest
places are in the sample. The frame bars at 1x were run again on the final commit, and the throttled probes three times each in rotation with the old build. One High pass of the four on the final commit dropped to 48 and 51 fps for a second; the other three did not, with a worst second of 59 or 60, so I read that as the machine.

| Check | Before the wow pass | After |
| --- | --- | --- |
| First rendered frame, CPU throttled 6x (median of 6, not rerun after the last round of fixes) | 2.85 s | 2.63 s |
| High tier at 1x, whole descent, Pinecrest and Frostfang | 60 fps, worst second 59, p90 16.8 ms | 60 fps, worst second 59, p90 16.8 ms |
| High tier at 1x, Lantern Night on Sakura | 60 fps, p90 16.8 ms | 60 fps, p90 16.8 ms |
| Medium tier at 1x, whole descent, Pinecrest and Ember | 60 fps, worst second 60 | 60 fps, worst second 60 |
| Phone layout, Medium and Low tiers | 60 fps | 60 fps, worst second 59 on Low |
| Phone layout, avalanche chase | 60 fps | 60 fps |
| High tier through an avalanche chase, CPU throttled 4x (median of 3) | 59 fps, worst second 56 to 58 | 54 fps, worst second 48 to 50 |
| Low tier, CPU throttled 6x, a very first run: Pinecrest, Ember, Sakura (median of 3) | 45, 50, 55 fps | 41, 44, 45 fps |
| The same with riders out of frame, as most of a returning run is | 45, 50, 55 fps | 47, 50, 48 fps |
| Low tier, CPU throttled 6x, worst second | 38 to 42 fps | 36 to 39 fps, 30 to 38 with riders out of frame |
| Draw calls settled, High / Medium / Low | 89 / 84 to 87 / 45 to 48 | 90 to 94 / 86 to 89 / 44 to 48 |
| Draw calls at the peak: a whole descent on High, a chase | 93, 128 | 100, 137 |
| Triangles settled, High / Medium / Low | 780k / 526k / 124k | 887k / 651k / 160k |
| Triangles at the peak: a whole descent on High, a chase | 1.1M, 1.13M | 1.13M, 1.33M |
| Build size, unpacked | 2.0 MB | 2.2 MB |
| Build size, zipped | 607 KB | 683 KB |

Low is the one bar this pass misses. At 1x it holds 60 on the desktop and in the phone layout, but at 6x a
very first run is 4 to 10 fps under the old build, 9 to 18%, worst on Sakura. That is the price of riders
staying in frame (DECISIONS 206): a probe clears its save, so every probe is a first run, and turning the
riders' reading off gives 47, 50 and 48 fps, which is Pinecrest above its old figure, Ember level and Sakura
7 under. Nearly all of the gap is the page's work round the labels and pills, not the scene. Landing the
figures on one beat fixed that once (DECISIONS 205). Landing the labels on it too gave back about a third of
the page work in a trace, but did not clearly move these figures (DECISIONS 217). Hiding the labels on a
struggling device would give 6 to 15% more frames at the cost of the names. The 4x chase loses 5 fps; frame JS
there is up only 0.6 ms, the rest is a heavier scene on a CPU slowed fourfold, it is above what every earlier
round measured for this probe, and at 1x it holds 60. High draws 99 to 103 under Lantern Night on Sakura, up from 90 to 92,
and holds 60.

The build grew by 229 KB, past the 2.0 MB the brief asked to hold near, and I think it is worth it: 193 KB of
code in the main bundle for the authored stages, places, moments, ladder and results, 25 KB in the ghost worker
(which carries its own copy of the sim and course), 10 KB of CSS and the rest in longer ghost pools. There are
no asset files in it. It stays under half the 5 MB limit. (True of that build. Since round 7 the score ships as
files and the limit is the release check under "Package for CrazyGames".)

Since round 7 there are four tiers. High renders into an R11G11B10F buffer with 2x MSAA and an edge walk in
the composite pass, with ambient occlusion and depth-cut shafts at half the frame; Ultra is High's world with
4x MSAA, a 4096 shadow map, three-slice occlusion with contact shadows and ice that mirrors the frame; Medium
has no MSAA and uses the edge walk; Low draws straight to the canvas with none of the round's passes. Depth of
field, motion blur and the letterbox are drawn only during a camera beat. The tier is chosen automatically,
first from the GPU name and then from measured frame times (`src/game/quality.ts`): it steps down when frames
run long or judder and back up when there is headroom, and up to Ultra only on a GPU named as discrete.

## Play-testing

The scripts in `scripts/playtest` drive the real game with keyboard and touch input through
`playwright-cli` (npm package `@playwright/cli`) against the preview build
(`npx vite build`, then `npx vite preview --port 4173`):

```bash
playwright-cli -s=gs open --config=.playwright/cli-headless.config.json
```

```bash
playwright-cli -s=gs run-code --filename=scripts/playtest/shots.js
```

| Script | What it does |
| --- | --- |
| `places.js`, `sheets.sh` | Rides any mountain on the safe line at a set speed and shoots a list of distances, or every site of the kinds named; the contact sheets of every street, bridge, tunnel and finish |
| `places-cost.js`, `cost-run.sh` | Draw calls, triangles and frame times riding through a place; compare two builds interleaved |
| `review.js` | The player review's screens: a fresh title, a first run's results, the second run, the returning title, the shop, the Daily and the Cup |
| `lantern.js` | A replayed or hands-off run, shot at every dash, ward and sky gate, at fixed distances and (`marquee: true`) as each set piece comes up and in its middle, with the lantern's counts |
| `homeward.js` | Wrecks a run by holding one key, rides home as a spirit to the town and checks the card comes back unchanged |
| `life.js` | The living background: rides to distances and shoots bursts, clips or a fixed lens at the crowds; with `find` it picks the nearest herd, fox on a rock, perched flock, sledding kid or drop-in ahead and shoots it frame-exact on a virtual clock as the rider comes |
| `places-plan.ts` | What stands where on each mountain, by mood, the longest bare stretch and what each piece costs, without a browser |
| `descent.js`, `finish.js` | A whole descent without a teleport (are pieces made ahead of the rider?), and the last leap, the line and the stop |
| `vista.js` | The world-scale set: the title, then a replayed best run (`?demo=0`) down each mountain, shot at 300, 1500, 2600 and 3900 m |
| `shots.js` | The critique set (title, overtake, perfect landing, chaos reveal, four moods, results) with frame stats |
| `carve.js` | Holds the line, then throws a hard carve into a drift |
| `avalanche.js`, `perf-avalanche.js` | Outruns an avalanche and shoots the mirror, or records frame times on High at 4x CPU throttle |
| `menus.js` | The sled shop, and a Medium-tier run for comparison |
| `mobile.js` | Phone portrait with real touch drags (open the session with `.playwright/mobile-headless.config.json`) |
| `avalanche-portrait.js`, `results-phone.js` | The avalanche chase and the results screen at phone size (portrait or landscape, from the session's viewport) |
| `feel.js`, `kicker.js`, `events.js` | Feel tuning, kicker pops and landings, every mid-run event |
| `perf.js`, `perf-ab.sh` | The performance table's probes (forced tier, CPU throttle, mood, event) with draw calls and triangles, peaks included; two builds interleaved, old, new, new, old, then the phone |
| `pagework.js` | DOM writes by element and the frame callback against the frame interval, for two states of one build; `perf.js` takes `noread` to tell a first run's riders from the world |
| `firstrun.js` | A very first run from the rider's seat: a fresh save, frames at set distances and who is near at each |
| `profile.js` | A CPU profile of a forced-tier run summed by function, per frame and per 100 m of course, for an unminified build (`npx vite build --minify false --outDir ...`); with `event: 1` it waits for a chase |
| `lab.ts` | The pilot lab: rides clumsy, novice, mid, expert, line, stunt and rail pilots and scripted bad input on the real sim in node, across all four mountains and several seeds. `--root <checkout>` loads the sim from another checkout, so one plan rides two builds |
| `anatomy.ts` | What a course is: each mountain's sections, widths, slopes, cliffs, and the longest plain stretch |
| `forks.ts` | Rides each fork both ways with bots of one skill, to show whether the risk route pays on the real sim |
| `tour.js`, `sweep.js`, `sheet.mjs` | Fixed comparison frames: a clumsy first run, a skilled run on every mountain to the finish, and a pinned sweep of any stretch, laid out as contact sheets (two builds side by side with `--vs`) |
| `migrate.js` | The clean break end to end: a real save and link from one build, carried to another, checked byte for byte |
| `moments.js`, `readability.js` | Beat strips of tumbles, grinds, wall rides, leaps and the finish; how far ahead the road reads at speed |
| `places.js`, `places-cost.js`, `descent.js`, `finish.js` | Rides each street, bridge, tunnel and finish town and shoots or costs them |
| `telemetry.js`, `tele-digest.mjs` | Fun telemetry: scripted runs at six skill levels (clumsy, novice, mid, expert, line, stunt) logging passes, duels, named moments per minute, the time to the first pass, whether the race is live at the crash, music intensity, flow, drift tiers, near-miss grades, stomp streaks, mission pops and banner overlaps |
| `strips.js` | Beat strips: 4 to 6 frame-exact screenshots after each named moment, on a virtual clock, with a probe per frame (plans `fresh`, `rivals`, `flow`, `stunt`, `avalanche`, `giftStorm`) |
| `audiocpu.js`, `arrange.js`, `render.js` | The audio engine's main-thread milliseconds and nodes a second (`engine.debugCpu`); every stage line, set piece and finish against the drop the band landed on a live run; one offline render for an A/B |
| `levels.js`, `audio-capture.js` | Mix levels from offline renders of the shipped DSP, and the live master tapped per frame (onsets, sync to the picture, the choir) |
| `stunt-sim.ts` | The stunt pilot in node, without a browser: `npx tsx scripts/playtest/stunt-sim.ts [runsPerMountain] [firstSeed] [mood]` |
| `garage-look.js` | Wears a hat and a scarf, opens the garage, shoots the Sleds and Sounds tabs and presses Listen, reading the master while it plays |
| `feelfx.js`, `fireworks.js`, `garage-tris.ts` | Each dash, ward, a sky gate from 60 m and the finish off a replayed run (a garage look worn and reduced motion as options); a synthetic street or win show mid-run; the hats' and effects' triangle counts |
| `setpieces.js` | Round 6's set pieces frame by frame: a replayed run shot as each set piece's card comes up and every so often while it plays, with the sim's own count, the race machine's gap and the fall's gap |
| `moments-plan.ts`, `pool-moments.ts` | What each set piece holds on every mountain and a few Dailies (gates, rings, steps, paces), without a browser; and how the bundled pools' riders played each one |
| `lab-digest.mjs` | Two `lab.ts` outputs side by side, per pilot (`lab.ts` also prints a set-piece table: each pilot's wins of the set pieces it met) |
| `loudness.js` | Loudness on a live run: integrated LUFS, short-term and momentary maxima, loudness range, true peak, L/R correlation, and what folding to mono and a phone speaker's band take off, for the whole mix, the music alone and the effects alone |
| `tile.mjs` | Tiles frames into one contact-sheet PNG, for reading many frames at once |
| `graves-pins.ts`, `graves-repin.cjs` | After a pool regen: print each pool's graveyards, and rewrite the graveyards test's pins from them |

Round 7's scripts. Use the headless configs (`.playwright/cli-headless.config.json`, 1280x720;
`.playwright/mobile-headless.config.json`, 390x844): a headed browser drops to a couple of frames a second when
the display sleeps.

| Script | What it does |
| --- | --- |
| `frames.js`, `frames.sh`, `frames-r7.json` | The round's fixed frame set: the same 35 to 38 distances a mountain (five mountains) on any build and tier, on the safe line at 30 m/s, each run with its draw calls, triangles and console |
| `lab.ts` (round 7) | Five mountains. Tables of set pieces won by pilot, verb and variant (`--variant N`, `--legend N`, `--mountains 4`, `--pilots expert-dash`), and `--falls`: what a fall costs each pilot, priced three ways |
| `race-lab.ts` | How live the race is on runs 2 to 6, without a browser: the pilot lab's rides against fields built exactly as the game builds them |
| `moments-plan.ts --rolls 3000` | How often each variant and legend comes up |
| `pool-moments.ts`, `pool-fast.ts`, `twelve-times.ts` | How the pools' riders played each set piece; how fast a bot can ride (`--style racer`); each signature rider's home record beside its usual time |
| `moments-r7.js`, `momentsworld.js`, `momentsworld.sh`, `legends-r7.js`, `legend.js` | Shoot every set piece, variant, the climax and the legends, with what the staging kit is drawing; the legend's card |
| `beats.js`, `readability.js` (`force: 'track' \| 'none'`), `hero.js`, `rider-tris.ts` | Every directed shot with a probe a frame; the road read with a shot held on; a turntable round the rider with forced acting; the rider's triangles |
| `pipe.js`, `pipe.sh`, `crop.mjs` | A frozen frame with passes on and off, the shimmer measure (the same frame drawn eight times with the lens moved by parts of a pixel), and enlarged crops |
| `fxshots.js`, `feel-frames.js` | The effects staged (its `dash` and `carve` plans need mending); falls, get-up pips, hints and the pad's glyphs |
| `lanternworld-key.json`, `lanternworld-digest.mjs` | A 14-frame list of Lanternfall's places, and a capture's cost |
| `screens-walk.js`, `screens-harness.js` | Walks every screen on both viewports; shoots the UI harness's states |
| `reel.js`, `labels.js`, `lifecycle.js` | A whole run then its reel; label quads against the old DOM tags at the same ticks; a trace of the renderer's main thread summed by event, with DOM writes a frame |
| `loudness.js`, `audiocpu.js` (round 7) | Both report which band played (the produced score or the live band) and its pack; `loudness.js` also reports the mix in octave bands; a pass may add `&nostems` |

## Fun pass play-test

Telemetry from scripted pilots (`telemetry.js`), the same plan and seeds on both builds: 8 fresh
novice first runs, 6 mid and 6 expert runs on Pinecrest, and 8 runs of the stunt pilot (a skilled,
human-like rider) on Frostfang and Pinecrest.

| | Novice before | Novice after | Stunt before | Stunt after |
| --- | --- | --- | --- | --- |
| Race live at the crash (a ghost within reach) | 3/8 | 8/8 | 0/8 | 1/8 (4/8 on the round 1 build) |
| Share of the run with the race live | 0.70 | 0.97 | 0.30 | 0.65 |
| First named moment | 5.3 s | 0.6 s | 5.8 s | 0.6 s |
| Missions popped mid-run, all runs | 0 | 13 | 0 | 22 |
| Mean music intensity (0 to 1) | 0.20 | 0.40 | 0.27 | 0.43 |
| Named moments per minute | 16.8 | 19.3 | 22.2 | 27.9 |

With 8 runs a pilot, run lengths vary a lot from build to build, and so does how many ghosts are
still near at the crash: the stunt pilot rode further on the final build (median 2,010 m), past
most of the field. The stunt pilot reaches In the flow in 5 of 8 runs and a stomp streak of 13;
novices never reach flow, by design. Runs are faster after (novice 18.7 to 21.1 m/s), because the
field now rides with you and gives more slipstream, and the first pass you see comes later (5.3 to
8.9 s), because start-line jostles in the first 6 s are muted.

A fun panel of six critics, two for each lens (game feel; race drama; the first session and the
reason to return), rated beat strips (`strips.js`) and the telemetry out of 10 against Alto's
Odyssey, Mario Kart Tour, Tony Hawk's Pro Skater and Subway Surfers. Each panel scored the builds
side by side; the fix rounds between them came from the panel before:

| Panel | Before | Fun pass | Fix round 2 | Fix round 3 |
| --- | --- | --- | --- | --- |
| First | 4.02 | 6.10 | | |
| Second | 3.93 | 5.65 | 6.14 | |
| Third | 3.93 | | 5.94 | 6.28 |

Every judge scored each round above the one before, but each panel also marked the previous build
down once its defects showed beside the fixes, so the third round's rise (+0.34 paired) did not
clearly clear the panel's own noise, and the loop stopped there.

## Wow pass play-test

Rounds 1 and 2 changed the picture. This one changed the sim (SIM_VERSION 6): the course became a fixed
4.5 km descent in three stages with real places in it, cruise rose from about 21 to 30 m/s, and a hit
costs time rather than the run. Everything below rides scripted pilots. No human has played this build.

The pilot lab (`lab.ts`) rides the real sim in node: six seeds a mountain for the skill pilots, one for the
scripted bad inputs. Ranges are the spread of the four mountains' medians. Before this pass a run had no
finish and the lab stopped it at 4 min.

| Pilot | Time before | Time after | Distance before | Distance after | Mean m/s before | Mean m/s after | Finished after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clumsy (new) | 13 to 15 s | 71 to 159 s | 110 to 155 m | 1.2 to 1.9 km | 11 to 12.5 | 15 to 18 | 0 of 24 |
| Novice | 97 to 123 s | 146 to 164 s | 1.9 to 2.3 km | 4.5 km | 19 to 20 | 28 to 32 | 22 of 24 |
| Mid | 151 to 240 s | 144 to 156 s | 3.3 to 5.1 km | 4.5 km | 21 to 22 | 29 to 32 | 20 of 24 |
| Expert | 169 to 240 s | 144 to 154 s | 3.6 to 5.3 km | 4.5 km | 21 to 22 | 29 to 32 | 23 of 24 |
| Safe line | 240 s (the cap) | 151 to 167 s | 4.9 to 5.1 km | 4.5 km | 20 to 21 | 29 to 30 | 24 of 24 |
| Stunt | 103 to 167 s | 137 to 149 s | 2.2 to 3.7 km | 3.9 to 4.5 km | 22 to 23 | 30 to 31 | 14 of 24 |
| Hands off | 10 to 42 s | 100 to 155 s | 153 to 771 m | 3.0 to 4.5 km | 15 to 18 | 27 to 31 | 2 of 4 |
| A key held 2 s, right | 5 to 17 s | 146 to 159 s | 24 to 131 m | 3.5 to 4.5 km | 8 to 10 | 24 to 29 | 3 of 4 |
| A key held 2 s, left | 5 s | 141 to 161 s | 24 to 26 m | 3.4 to 4.5 km | 9 | 25 to 30 | 3 of 4 |
| A key held for ever | 9 to 18 s | 91 to 300 s | 21 to 33 m | 1.1 to 2.3 km | 3 to 5 | 7 to 14 | 0 of 4 |
| Zigzag | 6 s | 99 to 146 s | 40 to 45 m | 1.5 to 2.3 km | 9 to 10 | 14 to 18 | 0 of 4 |

Mean speed over a run's first 15 s rose from 12 to about 20 m/s for the clumsy pilot and from 15 to 25
for the novice. Skilled pilots now reach the 46 m/s cap, where the fastest reached 35 before. Stomps a
minute rose from 6.1 to 8.6 for the stunt pilot and from about 2.4 to 7.5 for mid and expert.

The game in the browser, on the real build (`telemetry.js`): 8 first runs a pilot, 2 on each mountain on Low,
same plan on both builds. Times, distances and speeds are medians, passes and named moments are per minute.

| Pilot | Run before | Run after | Mean m/s before | Mean m/s after | Passes before | Passes after | Named moments after | Race live before | Race live after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clumsy | 6 s, 52 m | 125 s, 1,705 m | 9.5 | 14.5 | 1.7 | 3.2 | 21.9 | 0.99 | 0.76 |
| Novice | 73 s, 1,456 m | 139 s, finish | 19.2 | 30.0 | 7.8 | 3.0 | 19.7 | 0.81 | 0.95 |
| Mid | 175 s, 3,596 m | 132 s, finish | 23.0 | 33.4 | 2.1 | 2.8 | 25.4 | 0.48 | 0.89 |
| Expert | 163 s, 3,743 m | 138 s, finish | 23.7 | 32.0 | 2.3 | 3.6 | 27.8 | 0.57 | 0.89 |
| Stunt | 82 s, 1,799 m | 135 s, finish | 21.8 | 32.8 | 5.3 | 2.8 | 29.4 | 0.70 | 0.96 |

("Before" per-minute figures are flattered by short runs: a run that ended in 6 s was live for all of it.)

A first run's race was the weakest part of this pass until the end. At the first full measurement it was live
for 0.33 to 0.52 of a run with 0.3 to 1.9 passes a minute, because the field is picked before you ride and with
no history can only guess who you are. So on a very first run the riders read you (DECISIONS 206), and it is now
the best race in the game by these numbers. The costs: Low (above), and finishes. Riders near you mean about
twice the slipstream, and the four skilled pilots finished 21 to 24 of 32 over three samples, against 27 of 32
without it. The novice did not change. Places spread: the skilled pilots mostly 1st to 3rd, the clumsy pilot 3rd
to 6th, where it had been last almost every time.

Returning runs are mixed. Over runs 2 to 4, in one save per pilot, passes a minute are 0.0 to 2.0 for the clumsy
pilot, 2.7 to 3.9 for the novice, 1.8 to 3.9 for mid and 2.7 to 8.9 for stunt, and the race is live for 0.38 to
0.94, 0.43 to 0.63, 0.50 to 0.72 and 0.59 to 0.99 of the run. Against the build before the first-run change,
stunt is up, the novice is level, and clumsy and mid are down, on three runs each, which is too few to call. The
first measurement of this was clearly worse for all four, which is how a real leak was found: a rider who read
you came back as a grudge at its real pace, 1.7 km up the road. That is fixed.

| Other checks | Result |
| --- | --- |
| Road you can read ahead at speed (`readability.js`) | 24 m before, 73 m at 30 m/s, 65 m at 44 m/s |
| Fork's bold route (`forks.ts`) | Saves up to 1.9 s for a clean rider, costs mid-skill bots a hit |
| Clean break across two real builds (`migrate.js`) | Archive byte-identical, gifts and run counts unchanged, stable across reloads, old link opens as a target to beat. Rerun on the release build; that save held no grudge, so the tally rests on the first run and the tests |
| Cup and Daily links | Open this week's Cup or today's Daily with the friend's ghost racing, raced to the line in a real browser. A link from a day or week that has gone says the race has closed |
| Rails on a real approach (`lab.ts --pilots rails`) | All 24 runs finish, 5 to 8 grinds a run. 72 of 80 rails mount cleanly; 8 do not, at least 3 of them under a kicker's flight (DECISIONS 211) |
| Slow riders in the air | Apparent gravity 0.27 to 0.41 of true before, 0.63 to 0.68 after, finish times unchanged, on real runs |
| Crash cameras over 1,104 replayed walled crashes at 60 fps | Buried wrecks 66 to 0, hero lens in rock 9 to 0, orbit in rock 22 to 2 (one crash, about 0.3 s) |
| Graveyards, by mountain | 0, 0, 0, 3 before, 4, 4, 2, 4 after, from recorded falls; every ghost record byte-identical, 2.3 KB added |
| Overlooks, by mountain | 3, 1, 1, 1 before, 3 each after, the first at 250 m. Dailies have 2 to 5, and 31% have 2 |
| Animals standing past what bounds the run | 24 to 50% of per-frame samples before, 0 after |
| Comet Night tunnels | Roofless, and now silent of the enclosed echo too |
| Every seed builds (a test holds 700) | 9,660 seeds, ten years of dailies among them |
| Floating trees (the review's finding 8) | 21% of sampled spots on early Pinecrest floated, worst by 25.7 m; fixed, a test holds it |
| Console across the tour of every mountain and mood, the migration, and the first-run and phone captures, on the release build | No errors |

Comparison frames, contact sheets and beat strips (`tour.js`, `sweep.js`, `moments.js`, `sheet.mjs`) were
read for every mountain and mood. They live in `shots/`, which is not in git.

What this does not show. Every number above is a script. Whether a tumble feels fair, whether 30 m/s feels
fast rather than busy, whether riders who keep up on a first run feel like a race or like being carried, whether
the medals and the ladder pull you back, and how any of it sounds are all unmeasured. The audio has not been
heard. Only the rail pilot grinds: the skill pilots leave rails alone. All tuning of medals, ladders and gifts is
unproven with people.

## Round 5 play-test: depth, wonder and scale

This round changed the sim (SIM_VERSION 7): spirit lights and a lantern you spend on a dash or keep as a
ward, sky gates, a second fork on Pinecrest and Sakura, rails out from under flights, events that pay the
lantern, and twelve signature riders in every pool. Everything below is scripted. No human has played this
build or heard it.

**The skill spread** (`lab.ts`, six seeds a mountain, the same pilots on both builds; the scripted pilots now
spend lanterns as a person might, see `spenderFor`). Median finish, seconds, by mountain
(Pinecrest/Frostfang/Ember/Sakura):

| Pilot | Before | After | Finished before | Finished after | Dashes a minute | Lanterns lit a run |
| --- | --- | --- | --- | --- | --- | --- |
| Hands off | 155/143/dnf/dnf | 156/146/148/150 | 2 of 4 | 4 of 4 | 0 | 6 |
| Careful line | 161/151/154/167 | 160/150/152/161 | 24 of 24 | 24 of 24 | 0 | 4 |
| Novice | 149/146/155/164 | 155/148/148/151 | 22 of 24 | 24 of 24 | 2.1 | 8.6 |
| Mid | 144/147/145/156 | 123/139/133/135 | 20 of 24 | 24 of 24 | 3.8 | 11 |
| Expert | 144/148/152/154 | 125/132/133/135 | 23 of 24 | 23 of 24 | 5.0 | 11.6 |
| Stunt | 150/147/150/151 | 136/132/138/134 | 14 of 24 | 24 of 24 | 3.5 | 11.3 |
| Clumsy | no finish | no finish | 0 of 24 | 0 of 24 | 0.2 | 4.1 |

Before, novice and expert finished 4.7 s apart on average while one pilot's seed-to-seed spread was 2.4 to
7.5 s: skill sat inside the luck. After, they are 18.2 s apart against a spread of 6.2 to 8.6 s: skill is two to
three times the luck, though the luck itself grew (a dash's timing varies). Hands-off and the careful line are
now about the novice's pace, 12 to 17% behind mid and expert. Every pilot lights lanterns; the careful line and
hands-off keep theirs as wards (1 to 3 a run).

**First runs in the browser** (`telemetry.js`, one fresh run a mountain a pilot on Low, 4 a pilot; "before" is
the wow pass's published table, 8 a pilot, same script and tier):

| Pilot | Run before | Run after | Passes a minute before / after | Race live before / after | Place after (of 6) |
| --- | --- | --- | --- | --- | --- |
| Clumsy | 125 s, 1,705 m | 1.2 to 2.8 km, no finish | 3.2 / 3.7 | 0.76 / 0.88 | 5th to 6th |
| Novice | 139 s | 149 s, 4 of 4 finish | 3.0 / 3.2 | 0.95 / 0.89 | 1st to 2nd |
| Mid | 132 s | 121 s | 2.8 / 3.0 | 0.89 / 0.59 | 1st to 2nd |
| Expert | 138 s | 132 s | 3.6 / 3.6 | 0.89 / 0.41 | 1st every time |
| Stunt | 135 s | 129 s | 2.8 / 2.9 | 0.96 / 0.74 | 1st to 2nd |

Every finisher met all four of its mountain's set pieces, about one every 30 to 40 s with the finish (1.6 to 2 a
minute); the clumsy pilot met one or two before it wrecked. None of the scripted pilots swept one (every light in
it and clean): that is left for people. The cost is the race for a skilled first-timer: the riders who read you
ride at most 1.12 times their own run, and a pilot dashing at 34 m/s rides clear of them, so the expert's first
race is live for 0.41 of the run against 0.89. It wins every time.

**Returning runs** (runs 1 to 4 in one save, Pinecrest, Low, the same plan as the wow pass's measurement on the
old build): the novice finished 2 of 4 against 1 of 4; mid ran 113 to 124 s against 123 to 138; stunt 120 to
141 s against 133 to 136. The race is not livelier: mid's is live for 0.44 to 0.62 of a run against 0.50 to
0.72, stunt's 0.35 to 0.87 against 0.36 to 0.79, and the clumsy pilot still finishes none.

**The ride home.** `homeward.js` wrecked Pinecrest runs at 1,309 m and 1,451 m, rode home as a spirit to the
square in about 85 s and came back to an unchanged card. The console was clean.

| Other checks | Result |
| --- | --- |
| Every seed builds (the fairness test's 700) and dailies keep their variety | Yes; over 40 orders in 60 dailies |
| Pools | 42 riders a mountain (30 crowd, 12 signature), 124 KB in all |
| Console, every capture in `shots/r5/final`, `shots/r5/home`, `shots/r5/lantern`, `shots/r5/marquee` | No errors |

What this does not show: whether a dash feels good, whether keeping a ward reads as a choice or as
forgetting the button, whether the set pieces' camera beats feel directed or pushy, whether the signature
riders feel like people, and every sound. The lab's pilots spend lanterns by a rule I wrote; people will not.

**Rails.** `lab.ts --pilots rails`: rails no approach can mount cleanly fell from 8 of 80 to 4 of 76, and none
of the four sits under a kicker's flight any more (they fail on a ground lip or a wide approach).

### Round 5 performance

Measured on the production build in headless Chrome on the laptop's GPU, **on battery** (the charger was not
connected; throttled figures ran well under the last round's on both builds), the old build (3331717) and this
one interleaved in fresh sessions with the save cleared (every probe is a very first run). The browser pane
of the desktop app was closed for the probes after the first round, which it had loaded.

| Check | Old build | This build |
| --- | --- | --- |
| High at 1x, Pinecrest | 60 fps, p90 16.8 ms (one of two passes 41, the machine) | 60 fps, p90 16.8 ms, both passes |
| Medium at 1x, Pinecrest | 60 fps | 60 fps |
| Phone layout, Medium and Low | 60 fps | 60 fps |
| High through an avalanche chase, CPU 4x (two passes) | 18 and 33 fps | 19 and 21 fps |
| Low at 6x, a very first run, Pinecrest/Ember/Sakura (median of 5 passes) | 37 / 49 / 38 fps | 34 / 44 / 41 fps |
| First rendered frame at 6x, fresh save (median of 4) | 1.75 s | 1.59 s |
| Draw calls settled, High / Medium / Low | 90 to 92 / 85 to 86 / 42 to 48 | 90 to 92 / 85 to 87 / 43 to 47 |
| Draw calls at the peak, High / the chase | 100 / 132 to 141 | 99 to 100 / 138 to 139 |
| Triangles settled, High / Medium / Low | 872k to 879k / 644k / 155k to 162k | 877k to 883k / 642k to 647k / 124k to 127k |
| Build, zipped / unpacked | 683 KB / 2,171 KB | 723 KB / 2,279 KB |

Low at 6x is the one bar this round does not meet: it did not win back the last round's loss, and on two of three
mountains it sits 3 to 5 fps under the old build, on one 3 over, inside a spread where single passes of the old
build read 24/19/25 and 39/49/45. A bisect over the round's checkpoints read the lantern alone and the riders'
lane within noise of the old build, and the gap appearing once the living world and the signature-rider field
came in; it was not pinned further. Triangles on Low fell by a fifth, so it is CPU work, most likely page work as
in decisions 205 and 217. The 4x chase on High swings too widely on battery to call.

The build grew by 40 KB zipped: about 36 KB of script (the lantern, set pieces, mastery, paints and the ride home
in the main bundle; the twelve hats, tags and reactions, about 7 KB; the crowds and animals, about 8.5 KB) and the
sim's own growth in the ghost worker. The pools are the same size as before (42 riders a mountain, 124 KB).

## Round 6 play-test: polish toward a 10

This round refined what was there (DECISIONS 239 to 274). Each mountain's three biggest places became set pieces that
play differently (a race against a machine, lantern gates, a ring line over a leap, a span that collapses behind you,
terraced steps), one a stage, decided in the sim (SIM_VERSION 8). The lantern's feedback became visible on the rider and
in the world. The HUD gives a set piece the top centre. The music became written songs arranged against the run, mixed
to a measured loudness. The world between places was laid out on purpose, and the garage was finished. Everything below
is scripted or measured; no human has played this build or heard it.

**The pilot lab** (`lab.ts`, six seeds a mountain, the same pilots on round 5's sim and this one; the skilled pilots now
try the set pieces, as a person who knows them would). Median finish, seconds, by mountain (Pinecrest/Frostfang/Ember/Sakura):

| Pilot | Round 5 | Round 6 | Finished | Lanterns lit a run | Dashes a run |
| --- | --- | --- | --- | --- | --- |
| Hands off | 156/146/148/150 | 161/146/148/150 | 4 of 4, both | 5.7 / 6.1 | 0 / 0 |
| Careful line | 160/150/152/161 | 160/152/152/161 | 24 of 24, both | 4.2 / 4.2 | 0 / 0 |
| Novice | 155/148/148/151 | 162/150/138/153 | 24 / 23 of 24 | 8.8 / 9.8 | 5.0 / 5.8 |
| Mid | 124/139/133/135 | 122/133/128/128 | 24 of 24, both | 11.5 / 13.7 | 8.5 / 11.3 |
| Expert | 125/132/133/135 | 137/129/135/125 | 23 / 24 of 24 | 11.9 / 13.9 | 11.0 / 12.8 |
| Stunt | 136/132/138/135 | 140/125/127/134 | 24 of 24, both | 11.4 / 12.2 | 8.3 / 8.8 |
| Clumsy | no finish | no finish | 0 of 24, both | 4.3 / 4.2 | 3.0 / 3.0 |

Set pieces won of those met (six seeds, all twelve set pieces): the careful line 13 of 72, the novice 27 of 71, mid 50 of
72, the expert 36 of 72 (its habit of dashing before every lip flies it over the rings). The novice-to-expert gap holds at
about 19 s; mid rides 5 s faster on average on the lanterns it wins; chasing Old Town's gates at full speed costs the
expert pilot 12 s on Pinecrest, which is the trade the gates pose.

**First runs in the browser** (`telemetry.js` through `tele-batch.sh`, one fresh run a mountain a pilot on Low; round 5's
build and this one in the same sitting):

| Pilot | Finish, round 5 / 6 | Passes a minute | Race live | Named moments a minute | Set pieces a minute |
| --- | --- | --- | --- | --- | --- |
| Clumsy | none / none | 2.7 / 3.5 | 0.95 / 0.75 | 24.7 / 23.5 | 0.37 |
| Novice | 142.8 / 149.4 s | 4.0 / 4.4 | 0.93 / 0.93 | 23.3 / 24.6 | 1.25 |
| Mid | 122.7 / 124.9 s | 3.1 / 2.6 | 0.67 / 0.63 | 24.8 / 25.8 | 1.48 |
| Expert | 133.3 / 120.4 s | 3.6 / 3.1 | 0.70 / 0.61 | 26.6 / 29.2 | 1.53 |
| Stunt | 129.3 / 125.9 s | 4.1 / 2.9 | 0.85 / 0.71 | 32.6 / 34.3 | 1.45 |

A finisher meets a set piece every 39 to 48 s (round 5: four, about one every 30 to 40 s with the finish). With four runs a pilot the race
numbers move within their noise; the skilled pilots' races read a little less live, as they ride faster on the lanterns
they win.

**Sound** (`loudness.js`, the first 70 s of each mountain's best pool run at the default sliders, both builds in one
sitting; `audiocpu.js` interleaved, from the music lane):

| Measure | Round 5 | Round 6 |
| --- | --- | --- |
| Mix, integrated (Pinecrest/Frostfang/Ember/Sakura) | -18.2 / -17.9 / -18.4 / -18.2 LUFS | -16.0 / -15.9 / -16.0 / -16.0 LUFS |
| True peak | -6.5 to -6.7 dBTP | -1.1 to -1.2 dBTP |
| Loudness range | 2.4 to 3.1 LU | 2.1 to 3.3 LU (the music alone: 2.2 to 4.5) |
| Music against the effects | 2.8 LU under | 0.8 LU under |
| Lost folded to mono / through a phone's band | 1.1 to 1.2 / 2.9 to 3.3 LU | 0.9 to 1.4 / 2.8 to 3.4 LU |
| Audio main thread, a cruise on Low at 6x | 52 ms a second, 41 to 45 nodes | 33 to 43 ms a second, 30 to 31 nodes |
| Audio main thread, a cruise on High at 1x | 9.8 ms a second | 10.6 ms a second |

### Round 6 performance

Measured on the production build in headless Chrome on the laptop's GPU, on mains power, round 5's build (dec2d60)
and this one interleaved in fresh sessions with the save cleared (every probe is a very first run), nothing else on
the machine (`perf-r6.sh`). The laptop's load moved a lot over the evening: the first Low sitting read 22 to 27 fps on
both builds, a quieter one an hour later 38 to 46. Only the side-by-side figures compare.

| Check | Round 5 | Round 6 |
| --- | --- | --- |
| High at 1x, a whole descent of Pinecrest and Frostfang | 60 fps, p90 16.8 ms, worst second 59 | 60 fps, p90 16.8 ms, worst second 59 |
| Medium at 1x, Pinecrest and Ember | 60 fps | 60 fps |
| High at 1x, Lantern Night on Sakura | 60 fps | 60 fps |
| Phone layout: Medium, Low, an avalanche chase | 60 / 60 / 60 fps | 60 / 60 / 60 fps |
| High through an avalanche chase, CPU 4x (a loaded sitting) | 24 fps | 25 fps |
| Low at 6x, a very first run, Pinecrest/Ember/Sakura (median of 4, the quiet sitting) | 45 / 43.5 / 40 fps | 43 / 40.5 / 42 fps |
| The same, the loaded sitting (median of 5) | 26 / 23 / 24 fps | 24 / 23 / 26 fps |
| Frame JS on Low at 6x, Pinecrest, unminified, profiled | 13.4 ms a frame | 13.5 ms a frame |
| First rendered frame at 6x, fresh save (median of 4) | 3.09 s | 3.16 s |
| Draw calls settled, High / Medium / Low | 93 to 94 / 85 to 90 / 43 to 47 | 93 / 87 to 90 / 43 to 47 |
| Draw calls at the peak, High / a chase | 99 / 139 | 104 / 143 |
| Triangles settled, High / Medium / Low | 874k to 891k / 627k to 642k / 126k to 127k | 872k to 895k / 524k to 651k / 108k to 131k |
| Build, zipped / unpacked | 723 KB / 2,279 KB | 776 KB / 2,436 KB |

Low is the bar this round does not meet: on a very first run at 6x it is level with round 5 within about 5% (2 fps under
on Pinecrest, where the passes do not overlap, 3 under on Ember and 2 over on Sakura, where they do), not better. The
frame's own JS is the same (the music's lighter Low band paid for the new systems), so as in rounds 4 and 5 what remains
is page work round the riders' labels and pills (DECISIONS 217). Naming only the nearest pool rider on a struggling Low
device was tried and measured: 1 to 2 fps, inside the spread, so it was not kept. The first frame is 70 ms later, inside
the two builds' overlap; the bundle is 44 KB bigger. The set pieces' world is drawn only within 520 m of the rider, and
the ward, the dash's after-images (Medium and High) and the fireworks draw only while they play, so settled frames carry
no new draw call on any tier.

**Size.** 776 KB zipped, 2,436 KB unpacked (round 5: 723 KB and 2,279 KB): 53 KB more zipped, of which about 44 KB is the
main bundle (the set pieces in the sim and the world, the score and the master, the garage, the fireworks and ward, the
groves) and the rest the ghost worker's copy of the sim and the pools. The jukebox loads only behind `?debug`.

What this does not show: whether the set pieces feel different under a person's hands, whether the gates at 40 m/s are a
fair test or a frustration, whether the race's machine reads as a rival, how any of the music sounds (`LISTENING.md` is the
route and the eight calls only an ear can make), whether the ward's slow beat feels like a beat or a stutter, and whether
the garage's looks are worth buying.

## Round 7 play test and performance

Round 7 (DECISIONS 276 to 359) changed the sim once (SIM_VERSION 9: a fall that is got up from, twelve verbs
with variants, legends, Lanternfall) and most of what is drawn and heard: a film curve and a grade for every
place, local lights, an Ultra tier, a rebuilt rider, directed camera shots, the set pieces' own worlds, a fifth
mountain, The Twelve, a produced score, a gamepad, a highlight reel, and labels drawn in the canvas. The lanes'
own measurements are in DECISIONS 278 to 341 and `notes/r7-*.md`. The headline lab figures on the final sim
(`shots/r7/lab/final.txt`, six seeds on each of five mountains): the clumsy pilot finishes 26 of 30 runs where it
finished 0 of 24; the expert wins 82 of 90 set pieces and the mid pilot 80, where they won 36 and 50 of 72; no
skilled pilot is faster for falling (the least a fall cost was 1.03 s, of 73 falls). In the race lab a skilled
pilot's race on runs 2 to 6 is live for 0.65 to 0.73 of a run where the fixed roles gave 0.51 to 0.64; five-run
telemetry in the browser could not confirm it. No human has played this build or heard it.

**The pilot lab** (`lab.ts`, six seeds a mountain; round 6's sim on its four mountains, this one's on five; the skilled
pilots try every set piece). Median finish in seconds, by mountain (Pinecrest/Frostfang/Ember/Sakura/Lanternfall):

| Pilot | Round 6 | Round 7 | Finished, round 6 / 7 | Set pieces won, round 6 / 7 |
| --- | --- | --- | --- | --- |
| Hands off | 161/146/148/150 | 167/140/148/150/153 | 4 of 4 / 5 of 5 | 5 of 12 / 1 of 15 |
| Careful line | 160/152/152/161 | 144/142/145/154/151 | 24 of 24 / 30 of 30 | 13 of 72 / 6 of 90 |
| Novice | 162/150/138/153 | 166/143/144/160/159 | 23 of 24 / 30 of 30 | 27 of 71 / 18 of 90 |
| Mid | 122/133/128/128 | 123/128/124/121/129 | 24 of 24 / 30 of 30 | 50 of 72 / 80 of 90 |
| Expert | 137/129/135/125 | 122/124/125/117/132 | 24 of 24 / 30 of 30 | 36 of 72 / 82 of 90 |
| Stunt | 140/125/127/134 | 136/121/122/140/146 | 24 of 24 / 30 of 30 | 25 of 66 / 31 of 90 |
| Clumsy | no finish | 403/356/376/394/411 | 0 of 24 / 26 of 30 | 1 of 27 / 1 of 90 |
| Zigzag | no finish | 371/289/303/372/312 | 0 of 4 / 5 of 5 | 0 of 6 / 0 of 15 |

A fall is now got up from, so the clumsy and zigzag pilots finish (slowly: six to seven minutes); the one pilot that
still never finishes is the stress case that holds right into the trees. Mastery pays: the mid and expert pilots
win nine in ten set pieces where they won half to two thirds. The novice wins fewer (18 of 90, a fifth, where it
won 38%): the set pieces now ask a verb of you (a bell to ring, a gate to beat at speed, a glass to slide), and a
pilot that only steers and dashes does not do them. No skilled pilot is faster for falling: the least a fall
cost was 1.03 s, of 73 falls (`final-falls.txt`).

**How live the race is** (`race-lab.ts`: each pilot's own rides raced against fields built as the game builds them,
twelve orders of six runs on every mountain; live is the share of a run with a riding ghost within 40 m). The
same rides against round 6's five riders on fixed roles, and against round 7's field laid across your own runs:

| Pilot | Run 1 | Run 2, fixed / laid | Run 5, fixed / laid | Runs 2 to 6, fixed / laid | Quiet runs (live under 0.35), fixed / laid |
| --- | --- | --- | --- | --- | --- |
| Novice | 0.56 | 0.53 / 0.59 | 0.57 / 0.63 | 0.56 / 0.62 | 32 / 14 of 300 |
| Mid | 0.43 | 0.61 / 0.70 | 0.65 / 0.75 | 0.64 / 0.73 | 14 / 10 of 300 |
| Expert | 0.45 | 0.55 / 0.68 | 0.53 / 0.71 | 0.54 / 0.70 | 52 / 8 of 300 |
| Stunt | 0.56 | 0.51 / 0.64 | 0.53 / 0.68 | 0.51 / 0.65 | 41 / 29 of 300 |

Run 1 is the same field either way (the pacer's), and the quietest run for a skilled pilot (0.43 to 0.45): on a
first run you meet the field at its own pace. On runs 2 to 6 the laid field is live for 0.62 to 0.73 of a run, and
passes a minute rise from 1.7 to 2.3 a minute on the fixed roles to 2.4 to 3.6 on the laid field.

**Variants and legends** (`moments-plan.ts --rolls 4000`, rolled as the game rolls them): every variant of a set
piece comes up about as often as its others (a third each of three, half each of two), and each mountain's two
legends come up about one later run in ten between them (1 in 9.5 to 1 in 10.4), never on a session's first run.

**Sound** (`loudness.js`, the first 70 s of each mountain's best pool run at the default sliders; `audiocpu.js`,
the builds interleaved):

| Measure | Round 6 | Round 7 |
| --- | --- | --- |
| Mix, integrated (Pinecrest/Frostfang/Ember/Sakura; Lanternfall) | -16.1 / -15.7 / -15.9 / -16.3 LUFS | -16.2 / -15.9 / -15.8 / -15.4; -16.5 LUFS |
| True peak | -1.2 dBTP | -1.1 to -1.2 dBTP |
| Loudness range, the mix | 2.4 to 3.5 LU | 2.8 to 5.3 LU |
| The music alone, Pinecrest (true peak; range) | -19.8 LUFS (-6.1 dBTP; 5.2 LU) | -19.4 LUFS (-2.4 dBTP; 5.9 LU); Lanternfall -18.8 (8.9 LU) |
| Music against the effects, Pinecrest; Lanternfall | 1.5 LU under | 0.9 LU under; 0.4 LU over |
| Lost folded to mono / through a phone's band | 0.9 to 1.3 / 2.9 to 3.7 LU | 0.8 to 1.2 / 2.3 to 4.1 LU |
| Audio main thread, a cruise on High at 1x (two passes) | 10.1 / 10.2 ms a second | 10.1 / 10.3 ms a second (Lanternfall 11.1) |
| Audio main thread, a cruise on Low at 6x (two passes) | 58.1 / 59.6 ms a second | 53.9 / 57.7 ms a second (Lanternfall 50.6) |
| Audio nodes made a second, High / Low at 6x | 77 / 73 to 76 | 56 to 59 / 52 to 57 |

The produced score keeps the master where round 6 put it (-16 LUFS, true peak under -1 dBTP) and is more dynamic:
its range is wider, and the music alone peaks 3.7 dB higher where its sections build. It costs the main thread
nothing more than the live band did (it is decoded audio, not voices), and a little less on Low.

**The critic's scores** (DECISIONS 342; one review lane a mountain, five passes, a fresh critic each pass, judging
High at 1280x720, Low and a phone on Medium against ART.md 15). No mountain met the stopping rule (no frame under
8, every hero vista 9): no critic gave any frame a 9, and the best frames are 8 to 8.5. High's mean, pass 1 to pass
5 (passes 1 and 2 were judged by an earlier model, about a point kinder): Pinecrest 7.14 to 6.55, Frostfang 6.8 to
6.69, Ember 7.19 to 6.97, Sakura 7.57 to 7.38, Lanternfall 6.73 to 6.49. Under one critic standard Ember and Sakura
rose every pass, Frostfang held while its worst frame went from 6 to 7.5, and Lanternfall's worst frames rose from
3.5 to 5.5. The faults every critic named (flat fuel drops, a ghost at the lens, glows bleaching the rider) were then
fixed once for all five mountains (DECISIONS 358) and judged clearly better, but not scored again.

### Round 7 performance

Measured on the production build in headless Chrome on the laptop's GPU, round 6's build (`5f70fe5`) and this one
interleaved in fresh sessions with the save cleared, nothing else of ours on the machine (`perf-r7.sh`). The plan
ran on mains power in the morning; the Low bar and the first frame were run again in the evening after the fixes
below, on battery (`perf-low.sh`), when the laptop's speed swung by half between passes.

| Check | Round 6 | Round 7 |
| --- | --- | --- |
| High at 1x, a whole descent, Pinecrest/Frostfang/Ember/Sakura | 60 / 60 / 60 / 60 fps | 60 / 60 / 60 / 60 fps |
| High at 1x, Lanternfall; Ultra at 1x, Pinecrest and Lanternfall | (no Lanternfall, no Ultra) | 60; 60 / 60 fps |
| Medium at 1x, Pinecrest/Ember; Frostfang/Sakura/Lanternfall | 60 / 60 fps | 60 / 60; 60 / 60 / 60 fps |
| High at 1x, Lantern Night on Sakura | 60 fps | 60 fps |
| Phone layout: Medium, Low, an avalanche chase | 60 / 60 / 60 fps | 60 / 60 / 60 fps (Lanternfall 60 / 60) |
| High through an avalanche chase, CPU 4x (one pass each) | 52 fps | 48 fps |
| Low at 6x, a very first run, Pinecrest/Ember/Sakura, median of 5 (mains) | 43 / 43 / 46 fps | 46 / 48 / 39 fps |
| The same after the fixes, median of 5 (battery) | 24 / 23 / 24 fps | 29 / 26 / 27 fps |
| Low at 6x, Frostfang/Lanternfall (mains) | | 46 / 48 fps |
| First rendered frame at 6x, fresh save, before the fixes (median of 4) | 2,075 ms | 2,445 ms |
| The same after the fixes (median of 8; mean 2,164 / 2,157) | 2,179 ms | 2,140 ms |
| Draw calls settled, High (four mountains) / Medium / Low | 93 to 100 / 87 to 90 / 43 to 47 | 96 to 101 / 87 to 95 / 44 to 51 |
| Draw calls, Ultra / at the peak on High / in a chase | | 94 to 104 / 106 to 111 / 147 (round 6: 101 to 107, 143) |
| Triangles settled, High / Medium / Low | 748k to 1,022k / 524k to 651k / 108k to 131k | 758k to 996k / 528k to 703k / 98k to 132k |

**What the fixes were.** The first frame came out 370 ms later than round 6's. A CPU profile from navigation to
the first frame (`firstframe-profile.js`, on unminified builds) found it: the title built the medal wall's boards
for all five mountains (a whole course and its set pieces each) for a popover nobody had opened; the landmarks flew
every site from the start to the title's shot, far down the mountain, though none is made before a grace of 2.7 s;
every ghost's glass body and the dash's after-images were built though the first frame draws none; the crowd was
built twice; and the lake mirror baked the sky on the very first frame. Each now happens when it is first wanted or
on idle time, and the first frame is level with round 6's. On Low, Sakura's first kilometre re-blended the colour
script five times a second, each re-blend repainting every baked colour; Low now takes the light at most five times
a second. `systime.js` times each world system per frame: a Low frame's script grew by about 2.5 ms at 6x, spread
over the renderer, the canvas labels, the colour script and the set pieces' worlds, and on Pinecrest and Ember the
page work the labels took out of the DOM more than pays it back.

**Low against round 6.** The two sittings disagree on Sakura: on mains in the morning round 7 was 7 fps under round
6 there (and 3 and 5 over on Pinecrest and Ember); in the evening, after the fixes and on battery, it was over on all
three (by 3 to 5 fps, inside a spread of half the frame rate). The brief's bar, that Low not get worse and should beat
round 6, is met on Pinecrest and Ember in both sittings and on Sakura only in the second: a quiet sitting on mains
power is what would settle it.

**Size.** The whole build is 59.78 MB in 31 files (56.58 MB zipped); the initial download, everything outside `music/`
and the largest course's desktop pack, is 10.73 MB. CrazyGames allows 250 MB, 1,500 files and 50 MB of initial
download (20 MB to be eligible for the mobile homepage), and `npm run release` fails over 80 MB, 1,500 files or 20
MB initial. 56.8 MB of the build is the produced score (`ASSETS.md`); the main script is 2,736 KB (907 KB gzipped),
549 KB more than round 6's, and the first frame does not pay for it (above).

What this does not show: whether any of it feels better under a person's hands; how the score sounds
(`LISTENING.md`); whether the camera's beats direct or distract; whether The Twelve's duels can be won by a person;
whether the legend moments land as wonder or as noise; and Low on a real low-end device rather than a throttled
laptop.

## The visual lift (after round 7)

The visual lift (DECISIONS 360 to 366) changed only what is drawn: the sim, the bots and the ghosts are round 7's.
Five lanes built it at once and were merged on `visual-lift`; each lane's notes are `notes/vl-*.md`.

- **Shadows to the horizon** (`farshadow.ts`): past the shadow map's reach, ridges, forests and set pieces cast from
  a field baked on idle time for each stretch's own sun; on Low it is the first cast shadow there has been.
- **Light with form** (`materials.ts` `LIFT_GLSL`, `postfx/ao.ts`): the shade side takes the sky's fill and the
  snow's bounce, blossom, ice and the ghosts' glass are lit through against the sun, and on High and Ultra an edge
  near the lens catches a hairline of the key light.
- **Edges that look made** (`chamfer.ts`, `lettering.ts`): a chamfer on every kit piece on Medium and High, Sakura's
  stone lanterns and Lanternfall's stone lamps remodelled, blossom as lobed canopies, solid finish lettering.
- **Low as a poster** (`poster.ts`): painted shafts, a painted rim on silhouettes, the sky in printed bands; on a
  phone the results card yields the hero shot.
- **Held back:** a temporal reconstruction for High and Ultra (`?taa`). It steadied the world but softened the
  rider, so anti-aliasing is round 7's (DECISIONS 363).

**How it was judged.** Each lane by its own fresh critics on round 7's final frames. The merge by a fresh critic a
mountain on 112 pairs (`shots/vl/merge/critic/`): a modest but real lift on High on four mountains (Ember near the
same), the clearest lift on Low on Pinecrest, Frostfang and Sakura, little change on the phone. What they found
broken on Low (Ember's snow brown, Pinecrest's tree runs a cobalt river) and in the crease light (hairlines on
basalt) was fixed, looked at again by a second critic and then by eye with the snow's colour sampled
(DECISIONS 364).

**Performance against round 7** (on mains, nothing else running, both builds interleaved, `perf-vl.sh`):

| Check | Round 7 | The lift |
| --- | --- | --- |
| High at 1x, all five mountains; Ultra on Pinecrest and Lanternfall | 60 fps | 60 fps |
| Medium at 1x, all five mountains; the phone's Medium, Low and avalanche chase | 60 fps | 60 fps |
| Low at 6x, Pinecrest/Ember/Sakura, median of 5 interleaved, first sitting | 46 / 46 / 40 fps | 43 / 44 / 38 fps |
| The same, second sitting | 39 / 40 / 35 fps | 34 / 38 / 33 fps |
| Low at 6x, Frostfang/Lanternfall, one pass | 46 / 46 fps | 41 / 42 fps |
| First frame at 6x on a fresh save, median of 4 | 2512 ms | 2490 ms |
| Mean draw calls on the fixed frames: High / Low / phone | 98.7 / 49.1 / 89.0 | 98.2 / 50.3 / 88.8 |

High, Medium, Ultra and the phone hold their bar. **Low at 6x is 2 to 5 fps under round 7 in both sittings**, which
the brief's bar does not allow; nothing in the frame's own script shows it (DECISIONS 366), and whether Low's new
shadows and poster are worth it is the owner's call.

**Where the captures are** (all git-ignored, under `shots/vl/`): each lane's own frames in `shots/vl/<lane>/`; the
merge's fixed frames on High, Low and the phone in `shots/vl/merge/after/`, the re-shoots after the fixes in
`after2/` and `after3/`; the critics' pairs in `shots/vl/merge/critic/`; the performance run in
`shots/vl/merge/perf/` (an earlier sitting in `perf1/`).

What this does not show: whether the lift is felt at full speed under a person's hands, how Low looks on a real
low-end phone rather than a throttled laptop, and the reconstruction tuned for the rider and moving lifts.

## Round 8: beauty and the hook

Round 8 (DECISIONS 367 to 387) changed the sim once (SIM_VERSION 10: the air's language, charms, showdowns and the
spirit steal, Spirit Flow, the first run's layout, the Long Night's carry) and then only what is drawn, heard and
kept. Its lanes' notes are `notes/r8-*.md`; `notes/r8-report.md` is the short version for the owner, with a
fifteen-minute route through what changed. Nobody has played this build with hands.

- **A trick language** (G1): eighteen named tricks from one rule (above), each with its pose, name and sound, on
  the ghosts too; a perfect landing holds the picture for a breath and throws a ring of snow.
- **A build chosen by steering** (G2): charm gates of light, three families, seven pairs.
- **Rivals met on the snow** (G3): showdowns, the spirit steal, a pool that races, drafts and duels itself.
- **One rank and reasons to come back** (G4 to G7): Rider Rank, the Almanac, the daily flame and contracts, Cup
  leagues, monthly chapters, a Lantern Row to light; a first hour paced by design; results that sell the next run
  with one button chosen for it.
- **Somewhere to go after The Twelve** (G9): mirror mountains, the Long Night and a weekly Trial with its own medal;
  a second hour on every mountain.
- **The look** (V1 to V8): snow with three surfaces and relief the light draws; openings composed with a low lens;
  Ember lit from the lava's side and Lanternfall's great lantern lit over the rider; lamps that light the air; speed
  in the world (near crystals, posts strobing past, blur only at the frame's edge); every action an event; a stable
  image on High and Ultra (a temporal reconstruction with the rider drawn sharp over it); photo mode and album
  frames from the run.
- **Share it** (G11): Save Clip on the results, the run's reel as a short video with its sound, and the photo with
  the run's card.

**The bars, in the lab** (`scripts/playtest/r8-bars.ts`, careers of 100 runs on the real sim settled into a real
save, six seeds; `lab.ts`, six seeds on each of five mountains; `race-lab.ts`; `shots/r8/final/lab/`):

| Bar | Measured |
| --- | --- |
| No dead runs (nothing gained at all) in a mid pilot's first 30 | 0 of 30 (strict: 3 of 100 over all 100 runs) |
| Always one run away: a near goal exists, and the one button names it | 100 of 100 runs, mid and novice |
| Choices a run that change the rest (charm, showdown, dash, fork) | median 17, least 10 |
| Named tricks; distinct ones in the expert's best combo | 18; 6 (median best combo 5) |
| First minute on a fresh save: a pass by 20 s, a perfect by 45 s, a dash by 60 s | 6 of 6 seeds, prompted clumsy and novice pilots |
| The clumsy pilot finishes | 28 of 30 (round 7: 26 of 30) |
| Still new at run 50, reachable next run, on every mountain | 2 to 12 things a mountain |
| Set pieces won, mid / expert / novice | 78 / 82 / 29 of 90 (round 7: 80 / 82 / 18) |
| A race live (a riding ghost within 40 m), runs 2 to 6, mid / expert / stunt | 0.79 / 0.67 / 0.71 (round 7: 0.73 / 0.70 / 0.65) |
| Passes a minute, the same | 4.2 / 4.0 / 3.6 (round 7: 2.4 to 3.6) |
| Showdowns a run, started / won, mid | 1.61 / 0.52 |

The expert's race is a little less live than round 7's (0.67 against 0.70): it rides far enough ahead of the field on
Ember and Sakura that its quiet runs rose from 8 to 27 of 600. Median finishes, by pilot over five mountains: mid
126.3 s, expert 121.3, novice 144.1, clumsy 337.3.

**The critic loop** (DECISIONS 383; one review lane a mountain, five passes, a fresh critic each pass told only
ART.md, judging High at 1280x720, Low and a phone on Medium, and strips in motion). High's mean, pass 1 to pass 5:

| Mountain | High (lowest frame) | Low | Phone | Best frames |
| --- | --- | --- | --- | --- |
| Pinecrest | 7.28 (6) to 7.20 (5) | 6.27 to 6.42 | 6.28 to 6.35 | 8.5 |
| Frostfang | 6.60 (4.5) to 6.94 (5.5) | 6.20 to 6.27 | 6.50 to 6.37 | 8 |
| Ember | 7.00 (5) to 6.96 (6) | 6.56 to 6.21 | 6.65 to 6.49 | 8 |
| Sakura | 6.76 (5.5) to 6.67 (5) | 6.15 to 5.96 | 6.26 to 6.42 | 8 |
| Lanternfall | 6.72 (5.5) to 6.56 (5.8) | 6.32 to 5.98 | 6.49 to 6.18 | 8 |

No mountain met the stopping rule (no frame under 8, every hero vista 9). A new critic moved frames nothing had
touched by up to a point and a half and the last two passes were the harshest everywhere, so the means are a band;
what each pass fixed was not named again, and the worst frames rose on Frostfang and Ember. The fixes: a flipped
saucer or tray lit with a vermillion rim instead of an ink disc, ice that stays cool under a warm sky, nothing at the
lens stippled or milky, shafts off the near snow, a ward that breaks into paper flakes, Pinecrest's gold without its
orange crown, Frostfang's walls as cut ice and its dawn on the bridge, Ember's Caldera a lake of lava with a groomed
landing, Sakura's paper-screen townhouses and soft shadows, Lanternfall's break opening where its script puts it and
the great lantern over the results. What is left is shared: the camera through a leap's lip, a flip read as a fall,
ghosts in the sky (the pool riders' own lines), walls that want geometry rather than paint.

**Performance against round 7** (DECISIONS 384; headless Chrome on the laptop's GPU, on mains, one browser on the
machine, both builds interleaved where a plan allows; `perf-vl.sh`, `workcal.js`, `systime.js`, `firstframe.js`).
Three sittings on 22 and 23 November; the first shared the machine with other work, the later two were quieter, and a
row the later ones contradict is theirs:

| Check | Round 7 | Round 8 |
| --- | --- | --- |
| High at 1x, a whole descent, all five mountains | 60 fps | 60 fps |
| Medium at 1x, all five; Ultra on Pinecrest and Lanternfall; a lantern night on Sakura | 60 fps | 60 fps |
| The phone: Medium, Low, an avalanche chase (Pinecrest and Lanternfall) | 60 fps | 60 fps |
| High through an avalanche chase at 4x, two passes | 26, 22 fps | 31, 28 fps |
| Low at 6x, a very first run, Pinecrest/Ember/Sakura, median of 5 interleaved | 37 / 41 / 35 fps | 30 / 31 / 31 fps |
| Low at 6x, Frostfang/Lanternfall, one adjacent pass | 35 / 36 fps | 27 / 32 fps |
| A Low frame's work at 6x against a ruler (`workcal.js`), Pinecrest/Ember/Sakura | 1 | 1.12 / 1.25 / 1.27 |
| First rendered frame at 6x, fresh save, median of 8 interleaved | 2,964 ms | 2,962 ms |
| Draw calls settled: High (four mountains) / Ultra / Low | 95 to 104 / 95 to 106 / 43 to 51 | 105 to 114 / 102 to 111 / 41 to 52 |
| Triangles settled on High | 727k to 1,000k | 745k to 1,008k |

High, Medium, Ultra and the phone hold their bar and the first frame is level. **Low at 6x is 4 to 10 fps under
round 7 on every mountain**, which the brief's bar does not allow. The cost is the field: round 8's riders race beside
you, so a Low frame draws about two more ghosts than round 7's did, and the frame's own work is spread thin over a
dozen systems (DECISIONS 382). Two lowperf passes took back what did not change the picture, and the critic loop added
nothing measurable (Pinecrest's frame timed system by system, before and after, within 1%). Going further means
showing less of the field on Low: the owner's call.

**Size.** The whole build is 60.30 MB in 32 files (56.75 MB zipped); the initial download is 11.25 MB, inside the
package's budget (80 MB, 1,500 files, 20 MB initial) and CrazyGames' (250 MB, 1,500 files, 50 MB). The main script is
3,205 KB (1,073 KB gzipped), 469 KB more than round 7's; the first frame does not pay for it.

**The smoke.** The release build ridden on every mountain at two places on Low, Medium, High and Ultra and on the
phone's Medium and Low, mirrored, and at the other hours (35 runs), and the title's hour pick on a desk and a phone:
every console clean. It found one fault, fixed: the title's ghost tag could sit on the title's own panels.

**Where the captures are** (all git-ignored, under `shots/r8/`): the sittings in `final/sit2/` to `final/sit4/`
(the first, during the lanes, in `final/perf/`); the release's test, build and package logs in `final/release/`; the
smoke's frames and consoles in `final/smoke/`; the lab in `final/lab/`; the critic loop's frames by mountain and pass
in `review/m0` to `m4`; each lane's own folder beside them.

What this does not show: whether any of it feels better under a person's hands (nobody has played this build);
whether the trick language is found by a person; how the new sounds and the score sit together (`LISTENING.md`); Low
on a real low-end phone rather than this laptop throttled six times; and a quiet machine, which none of the three
sittings was.

## Layout

| Path | Contents |
| --- | --- |
| `src/sim` | Deterministic simulation: course generation, sled physics, scoring, chaos, set pieces, input log, replay |
| `src/bot` | Ghost bot, the roster and the pool generator |
| `src/game` | App flow, fixed-step loop, input (keys, touch, gamepad), ghosts manager, saves, missions, quality tiers, The Twelve, the reel |
| `src/render` | three.js world: terrain, props, rider, ghosts, trails, particles, sky, post FX, camera |
| `src/render/postfx` | Round 7's frame passes: depth, ambient occlusion, shafts, the lens, reflections, the tier table |
| `src/audio` | The produced score's runtime (store, scheduler, decks), the live band, effects, ambience, the jukebox |
| `src/ui` | DOM overlay screens |
| `src/platform` | CrazyGames SDK v3 wrapper and local mock |
| `src/workers` | Ghost replay and daily pool worker |
| `scripts/music` | The offline renderer for the score (`npm run music`): instruments, effects, meters, and the pieces in `pieces/` |
| `public/music` | The shipped score: one pack a piece, a tier and a format, and two decode probes (see `ASSETS.md`) |
| `scripts/playtest` | Play-test, capture and measurement scripts |

Round 5 added `src/bot/roster.ts` (the signature riders), `src/game/marquee.ts` (set pieces), `src/game/mastery.ts`
(boards), `src/game/paints.ts` (sled paints) and `src/render/spirit.ts` (sky gates, dash and ward light, set pieces'
air, fireworks). Round 6 added `src/sim/moments.ts` (the set pieces and their verbs, played in `sim.ts`),
`src/render/marqueeworld.ts` (race machines, lantern gates, the falling span) and `src/ui/momentcopy.ts` (what a set
piece's chip says).

Round 7 added, in `src/sim`: Lanternfall and the twelve verbs, variants and legends in `moments.ts`, `course.ts`
and `chaos.ts`. In `src/game`: `twelve.ts` (the campaign), `keyart.ts` (the title's shots), `shots.ts` (the
directed camera shots), `pad.ts` and `rumble.ts` (the gamepad), `reel.ts` and `reelshow.ts` (the highlight reel),
`hints.ts`, `field.ts` (the field laid across your runs). In `src/render`: `postfx/`, `lights.ts` (local lights),
`cine.ts` (what the lens is doing), `rockforms.ts`, `treelife.ts`, `breaks.ts`, `fxhub.ts`, `momentkit.ts` with
`verbworld.ts`, `legendworld.ts` and `climaxworld.ts` (the set pieces' worlds, the legends, the last stage's
lights and shells; the places' own light is in `stages.ts`), `lanternkit.ts` and `lanternworld.ts`
(Lanternfall), `labels.ts` and `hudfigs.ts` (labels and Low's figures in the canvas), `reelcam.ts`. In
`src/audio`: `stemstore.ts`, `stemform.ts`, `stemdeck.ts`, `motifs.ts` and `produced.json`. In `src/ui`:
`padnav.ts`, `figures.ts`, `reelui.ts`, `reelcopy.ts`.

See `PLAN.md` for the architecture, `ART.md` for the art bible, `LISTENING.md` for the route to listen by,
`ASSETS.md` for every shipped file and its licence position, and `DECISIONS.md` for every call made along the
way.
