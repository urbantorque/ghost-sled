# Decisions

Every place where I replaced, extended or interpreted the brief, and why.

## Simulation and determinism

1. **No transcendental `Math` in the sim, not just no `Math.random`.** ECMAScript lets engines
   approximate `Math.sin`, `Math.atan2`, `Math.exp` and `**` differently. Ghost pools are made in
   Node (V8) and replayed in Safari and Firefox, so `src/sim/dmath.ts` rebuilds them from IEEE-exact
   `+ - * /` and `Math.sqrt`. `tests/purity.test.ts` bans the native versions in `src/sim` and `src/bot`.
2. **External influences are logged as input.** Drafting depends on ghost positions, and revives
   depend on an ad. Both are written into the input log (a per-tick draft bit and an escape token), so
   a run replays from `seed + chaos + sled + log` alone without needing the ghosts it raced.
3. **60 Hz fixed step with interpolation.** `tests/determinism.test.ts` drives the real `FixedLoop`
   at 60, 144 and a jittery 37 Hz and asserts identical per-tick state hashes.
4. **Input log format.** Each tick is one byte (9 steer levels, action, draft), stored as run-length
   `[byte][varint]`. Mouse and touch steering is quantised with hysteresis so analog input stays
   compact: a busy 3-minute run is about 1 KB.

## Controls and feel

5. **One action button instead of separate jump and drift.** The brief suggested carves, drifts,
   jumps, tricks and a perfect-landing timing mechanic. A second and third button would wreck touch
   play in portrait. Instead one button does it all:
   - Hold to crouch. A crouch carves deeper, tucks for speed, and drifts if you are steering hard.
   - Release to pop. Releasing at the top of a kicker gives a "boosted pop".
   - In the air, a fresh hold backflips.
   - Tap just before touchdown to stomp a perfect landing.

   Every input has a meaning in every state. That makes rhythms like drift, pop, stomp, drift
   possible, and they feel great.
6. **The perfect landing is a telegraphed timing window.** While airborne, a ring on the snow marks
   the touchdown spot and closes in. It flashes gold in the 150 ms stomp window. A short late window
   (4 ticks after touchdown) forgives slightly late presses.
7. **Mario Kart style drift steering.** While drifting the direction locks, and steering only
   tightens or widens the arc. The first version let a held key spin the sled into the treeline;
   locking makes drifts expressive and safe. Releasing pays out boost by charge tier (3 tiers).
8. **Speed comes from skill.** Cruise speed is set by slope and drag (about 22 m/s). Every skill pays
   speed: drift boosts, perfect-landing boosts, slingshots out of a ghost's draft, and "flow" (a long
   combo lowers drag by up to 25%). Crashing, bumping and sketchy landings cost speed. Time survived
   only adds difficulty.
9. **Style is banked, not instant.** Points sit in a pending pool and are banked (times the
   multiplier) when the combo times out. A crash loses the pool, and a bump banks it early. Repeating
   the same move pays 30% less each time. This is the Tony Hawk risk/reward loop, so combos reward
   variety and nerve.
10. **Gifts are currency, not combo fuel.** In early tuning, gift lines kept combos alive forever and
    scores exploded. Gifts now give a small direct score and pay for sleds.
11. **Corridor banks are berms.** The edges rise as rounded banks that push you back toward the line,
    and ease into a gentle forest floor. Wall rides are fun and safe. Going over the top into the
    treeline (10 m past the edge) is a crash, and a dense wall of trees makes that limit readable.

## Ghosts

12. **Ghosts matter through four systems.**
    - Drafting: the slipstream gives speed and charges a slingshot boost.
    - Passing: gifts and a celebration.
    - Grudge: the closest ghost that beat you returns next run in rose, and settling it pays double.
    - Crash markers: a lantern stays where a ghost wiped out, which warns you of danger spots.

    Two additions of my own:
    - Blizzard makes ghosts blaze so they literally guide you through the white.
    - The Spirit Train event is a pack of spirits you can draft for huge boosts.
13. **Ghost trajectories come from replaying their logs in a worker**, sampled every 2 ticks and
    interpolated on the main thread. Ghosts are never colliders.

## Chaos

14. **Mirror Mountain was discarded.** Mirroring would move static course geometry, which the
    non-negotiables forbid, and ghosts recorded on the unmirrored course would no longer line up.
15. **Final moods** (each changes play, not just looks):
    - Blizzard: low visibility, glowing ghosts, stronger drafting.
    - Lantern Night: a lantern lights the dark, gifts glow, combos last 50% longer.
    - Glass Ice: slick, faster, drifts charge 60% faster.
    - Comet Night: low gravity, faster spins, forgiving landings.
    - Haunted Hollow: four extra ghosts, double gifts per pass.
    - Powder Day: slower cruise, bigger pops, double gift value.
16. **Final events**, each with a 2 to 3 s telegraph:
    - Avalanche: a rumble, a banner and a distance meter, then a wall you outrun for 22 s.
    - Yeti Crossing: a roar from the treeline, its footprints laid across the course ahead of time,
      then a crossing you dodge or hop.
    - Gift Storm: sleigh bells, then a sleigh overhead raining gifts.
    - Spirit Train: draft them.

    The avalanche speed is tuned so a crash-free rider at cruise speed survives with margin.
17. **Challenge recipients' first run is plain.** "No chaos in a session's first run" applies to
    friends opening a challenge link too. Their rematch replays the challenger's exact mood and event.

## Platform

18. **SDK loaded dynamically with a timeout**, falling back to a local mock, so the game boots in
    under 3 s even when the SDK is slow or the page is not on CrazyGames.
19. **Midgame ads only on Run Again**, never in the first 3 runs, at most once per 4 runs and
    3.5 minutes. Rewarded ads are a revive (once per run) and doubling the gifts from a run. Both are
    hidden when an adblocker is detected.

## Visuals

20. **Custom stylized lighting over three.js lighting.** Every material shares one wrap-lit,
    two-tone shader with a fresnel rim and fog, which keeps the frame looking hand-painted. three.js's
    shadow-map chunks are reused for real long shadows on Medium and High.
21. **No icon library or web fonts.** Zero external assets and no runtime dependencies beyond
    three.js rule them out. Icons are small inline SVG glyphs, and type is the system stack at heavy
    weights.

## Made during play-testing and review

22. **Coyote time and launch-tick releases.** Releasing the action within 6 ticks after rolling off a
    lip still pops (and pays any drift charge). A release on the exact launch tick counts as perfect
    timing. Both came from an adversarial review, which showed the release was silently dropped otherwise.
23. **Late stomps pay the difference, not double.** A press up to 4 ticks after touchdown upgrades a
    clean landing to perfect, crediting only what the clean landing had not already paid.
24. **Deep carves are earned by steering, not crouching.** Any crouch with hard steer already starts a
    drift, so the carve reward is a sustained hard grippy turn at speed, and drifts own the crouch.
25. **The avalanche is paced from the mood's own cruise speed.** It runs at 87% of cruise (less on
    slick moods) and surges every 5 s. A clean rider holding the line keeps 13 to 25 m of margin in
    every mood (`tests/fairness.test.ts`). What it punishes are bumps and crashes. A version tuned on
    paper caught every crash-free test rider, which would have felt unfair.
26. **Run records carry the sim version.** A saved best, grudge or challenge link made on different
    physics is rejected instead of replaying a different run. `SIM_VERSION` is bumped with every
    behaviour change, and the ghost-pool test fails until pools are regenerated.
27. **The sun disc and the key light point different ways.** The disc sits low near the horizon so
    riders silhouette against it. The light that shades the snow is lifted to at least 24 degrees,
    because a light below the slope angle puts every downhill face in shadow. This is a standard
    stylised-lighting cheat.
28. **The title is an attract reel with a hero.** A pool ghost's run is replayed with the
    full-colour rider (scarf and all), and the other riders stay spectral. The title sells "you
    racing ghosts" before the first tap. The hero is the rider running second 10 s in, not the
    leader: with the leader as hero every ghost trailed behind the camera, so the reel never showed
    a race. Now the leader is in frame ahead of the hero. The reel also starts 6 s into the
    replays, because before that every rider sits on the same spot at the start line. Within its
    first 30 s the reel opens on the longest stretch where a grounded ghost rides 2.2 to 4.5 m from
    the hero, abreast or ahead, so the first frame is already a side-by-side duel, and every loop
    restarts at that moment. The duel partner is then replayed off its own clock, at the moment of
    its run that keeps it level with the hero and about 2.3 m off its line (1.6 m off and 1.1 m ahead
    on a phone, where 2.3 m was cut by the screen edge), and only where that spot is clear of
    hazards: picked by chance, it rode small at the frame's edge. Stretches with a log or kicker
    right behind the hero in the first 5 s score lower.
29. **Ghost name tags declutter, and are all or nothing.** The nearest tags win, overlapping tags
    stack upward and then hide, and a ghost sitting on top of you shows no tag at all. A tag is fully
    shown or fully hidden, never half faded: it appears after a 0.1 s hold and hides while its ghost
    is faded or off screen, or while it would touch any HUD element (contract C8: the HUD reports its
    callout and stamp rects). The title shows only the nearest ghost's tag, a little smaller on a
    phone. Contract C11: the ghost the HUD's rival pill names is placed before every other tag, ringed
    2 px in its kind colour; it may slide a whole tag width clear of the rider, and is pulled in from
    the screen edge while its ghost is on screen, so the ghost the HUD names is named on screen too.
    A tag that would overlap another collapses to a small dot in its ghost's kind colour (a staircase
    of pills over a pack tied no name to a body), and while the landing stamp or a trick callout is
    up every tag but the rival's is a dot. Each tag sits over its own ghost's head.
30. **The Daily pool is generated in its own throwaway worker** with a smaller bot budget (16 runs,
    each capped at 3.5 minutes), so it is ready in about 3 s. Race replays never queue behind it.
31. **Terrain streams in time slices** (2.5 ms per frame), and every chunk of a course shares the
    same lateral vertex layout. Chunk builds are hitch-free on phones, and no cracks open between
    neighbouring chunks.
32. **Pinch zoom is disabled** (`user-scalable=no`), which the web interface guidelines flag. This is
    a deliberate exception for a full-screen game: steering is a two-thumb touch gesture, and a pinch
    or double-tap zoom would hijack it mid-run. All text is sized for legibility at DPR 1 instead.
33. **The avalanche gets a rear-view mirror.** The wall chases you from behind the chase camera, so
    with only a distance meter the threat felt abstract (critics rated it 3 out of 10). A framed inset
    above the meter looks back up the slope at the wall. It is graded like the main frame, and its
    frame heats from ice-white to the meter's ice blue as the gap closes. Low tier skips it, and
    there the HUD closes the unit up to its chip and meter rather than show an empty glass frame. It
    draws only the props in the chunks behind the rider and re-renders the scene at 30 Hz (the framed
    composite still draws every frame): the forest batches span the whole visible course and cannot
    be frustum culled, so the first version paid about 6 ms of GPU time for a 280 px inset.
34. **Ghosts never draw over the rider (contract C10).** Every rider material writes stencil 1, and
    every ghost layer (the glass, its depth pre-pass, the wisp, the halo, the Ghost Train's spirits)
    draws only where the stencil is not 1. A ghost overlapping the rider on screen shows around its
    silhouette and never tints the coat. This replaced two fades, one for overlap on screen and one
    for the sight line from the camera to the rider, which hid exactly the ghost the HUD was naming
    (the critics' top complaint in round 6). The scene target has a combined depth-stencil buffer,
    and its MSAA resolve copies colour only: nothing reads depth or stencil afterwards, and a stencil
    resolve is slow on D3D. Transparency blends in linear light, so a ghost whose body runs into
    yours (the whole field on the start line) still goes, from about 0.9 m in; the radius started at
    2 m, then 1.3 m, and each time hid the ghost you were overtaking at arm's length. After a pass
    (the race's own 0.8 m rule), the ghost you passed or that passed you stays on screen for 2.6 s
    while it is level with you or beyond, thinning but never vanishing. Every fade uses one glass
    treatment: a tinted core filled to about a third by day with a slightly darker inner band, and the
    rim always in the kind colour. As a ghost grows on screen it dissolves from the hips up, its fill
    thins to about 75% and its rim to 60%, never to a hollow outline (critics read thinned ghosts as
    wireframe bubbles). From about 40% of the screen height it fades evenly and is gone by about
    60%: riding beside the lens it hung in the sky as a giant soap-bubble head. Near the lens fill,
    rim and bright lip thin together (a rim that held half its strength left passing ghosts as
    outline bubbles). However a ghost is thinned, its fill shifts toward a deeper, purer kind
    colour, so a faint ghost tints what is behind it like stained glass; a thinned mid-value fill,
    and half the sunset fog's colour, turned ghosts milky peach against the sky (now a fifth of the
    fog). A ghost within about 3 m of a phone's lens drops to about 10% and shortens its wisp, sooner
    when the frame edge cuts it, and of two ghosts overlapping on screen the one further back dims,
    so they never tangle into one shape.
35. **One banner at a time, by priority.** Event telegraphs come first, then celebrations (passes,
    grudges, missions), then warnings, info and finally "X passed you", which is dropped outright
    during a celebration. The trick callout slot holds one line: a newcomer rolls the old line up
    into the combo total, and a repeat shows its count as one to five small dots, because "x" belongs
    to the combo multiplier alone. Every number carries its label ("Spin 540", "Slipstream +40"), and
    shows once: a callout whose points equal the combo total shows its label alone, and slipstream
    ticks get no callout while the Slipstream pill is up. "X passed you" is quiet (smaller, no glow
    or shake, up for 1 s) and waits behind your own passes and the stamp: at most two wait, a newer
    one about the same ghost replaces the older, anything waiting over 2.6 s is dropped, and screen
    readers hear it at once. Onboarding
    hints step aside while an avalanche is telegraphed or chasing, because the banner, meter and
    mirror own the lower screen.
36. **The mirror and the danger meter are one cold unit.** The hazard accent is ice blue (#6FC3FF),
    never the player's vermillion or a warm amber: ART.md keeps hazards cold and hard, and warm
    colours for you, gifts and the sun. The unit hangs top-centre in both orientations (top-right since decision 108), right under
    the race row (the combo meter and callout line move under it for the chase), in the open sky
    above the rider. A bottom mirror
    covered the sled in portrait (the rider sits just below mid-screen and the bottom of a phone
    belongs to the thumbs) and sat on the snow, not the sky, in landscape. The HUD lays the unit out
    and hands the renderer the mirror's rect, so the WebGL inset and the DOM meter can never drift
    apart; the rect stays armed from the telegraph until just after the chase so the inset never
    jumps. The unit is 196 to 246 px wide on a landscape screen, with the mirror 0.4 of its width,
    and an AVALANCHE tab at the rival name's size (at most 17.5 px) on the mirror's top edge. The
    meter is set into the mirror's bottom edge and is a proportional bar over 64 m: an ink disc with
    a light glyph at the left (danger is dark and hard, so not a friendly sky-blue disc), the dark
    wall advancing over a lighter track marked every 10 m, and the rider badge at the right, so the
    gap reads without reading the number. The gap number, the combo total's size, sits in the open
    track (just behind the wall's front once the track is short). Urgency climbs through six gap
    bands; below 25 m the mirror's rim pulses dark and below 12 m the bottom edge of the screen
    darkens. On a portrait phone the meter takes the rival pill's place in the race row during a
    chase and the mirror is about 25% smaller, so the top HUD ends at about 22% of the height
    instead of 27%. The mirror has the 18 px card radius, a 2 px ink
    rim and a faint glass glint, so it reads as a mirror on the unit rather than a video window.
    Contract C9: the unit opens at its final size. An opening enlargement (up to 1.8x for about a
    second) hid the meter and nameplate at exactly the moment the threat appeared.
37. **Ghosts are glass spirits with wisp tails.** Each ghost is solid glass at the head and shoulders
    and dissolves from the chest down into its wisp, so its sled is only a faint trace; at full body
    they read as jade statues. A soft additive halo wraps the head and shoulders, and night, dusk and
    whiteout moods raise the glow and let the fog touch them less. A depth pre-pass hides their own
    limbs behind the glass, and the double-sided ribbon tail (up to 2.6 m) streams out to one side so
    the chase camera always sees it; the wisp of the ghost you are drafting stays visible even when
    its body hides behind you. The head and torso write depth, or each limb draws its own rim (an
    x-ray tangle); the dissolved lower body does not, so an invisible sled never punches a hole in
    what is drawn behind it. A faint ghost (beside you, passing the lens, poofing) draws after every
    solid ghost and wisp, so its depth never hard-cuts anything behind it along its blocky outline.
    Your own best is gold-white glass, and it is always "Your best", never your name (the
    tag, the crash marker, the rival pill and every banner: "Passed Your best", "Your best passed
    you").
38. **The finishing order is by distance, and the results speak only in its terms.** (Replaced in the
    wow pass: the race is by time, then distance. What it says of stamps and the list still stands.) Every row shows
    how far that run went, and your place is one more than the ghosts that went further. A
    passes-based order read as fair but disagreed with the metres printed on each row. The header
    reads "Beat N of M", only the rows you finished ahead of carry a Beat stamp, and one line under
    the crash line gives the gap to the next place ("95 m short of 5th place.") or your lead over
    2nd. A Passed stamp above your own row, with a line explaining that the ghost went further, read
    as a contradiction to every critic; overtakes are celebrated during the run, where they happen.
    On desktop the list shows the two places above your row and one below, with Show All; fields of
    five or fewer always show whole. On phones it shows three rows (the place above, you, the one
    below) under the stats, so your row is in the first view even with an unlock card and the ad
    offers on screen. A run that beat nobody drops "Beat 0 of N": the header reads "Race" and the row
    above yours carries a Next tag. Challenge a Friend sits in the main button row, beside Home.
39. **High uses 2x MSAA on an R11G11B10F buffer, and integrated GPUs start on Medium.** After the art
    pass, 4x MSAA on a half-float buffer put High right at the 60 Hz edge on an Intel Arc 130V laptop
    GPU (about 22% of frames missing vsync late in a run, against 2% with no MSAA). The packed HDR
    format halves the bytes per sample and nothing reads its alpha; 2x keeps most of the edge
    smoothing. The starting guess reads the GPU name and puts Intel, Mali, Adreno and PowerVR on
    Medium (software renderers on Low), so those players never see a quality change mid-run.
40. **Judder steps the tier down too.** A GPU just over budget alternates 16.7 and 33.3 ms frames,
    which keeps the median on time while the run plays at about 50 fps. More than 15% of frames over
    21 ms across 4 s now steps down; the long window keeps one-off hitches (chunk builds, shader
    warm-up) from tripping it.
41. **The avalanche is felt in the main view, not just the mirror.** From 60 m the lower frame cools
    and a soft, layered wall surges up from the bottom edge across the full width: a pale veil, a
    bank of grey-blue billows that lighten softly toward their tops and a dark churn in front, with
    dark chunks overtaking at the edges (phones too, with smaller billows so the bank spans the
    width), spindrift, a cold shadow on the lower snow, a cooler grade and a gentle shake from 50 m,
    all building as the gap closes. Billows with bright cream rims read as a sticker border of
    cartoon clouds, and mood-lit ones as a cream border. The cloud never rises past the rider's feet (under about 40% of a
    phone's height) and its sides stop well below the mirror, so the sky keeps its colour. Critics
    rated a meter-and-mirror-only chase as abstract; a dark navy haze read as a vignette, and soft
    round puffs read as smudges on the lens.
42. **A perfect landing is one hero stamp beside the rider.** It used to stack three callout lines in
    the top slot, over the sun the rider had just flown at. "PERFECT LANDING" now lands large and
    tilted next to the rider, with the landing's points and tricks on one sub-line, placed once
    away from the sun and the track ahead. Air and clean-landing ticks fold into the combo total.
43. **The chase camera sits closer and lower.** At 3 m back and 1.4 m up the rider was a small figure
    at the bottom of a big frame. At 2.2 m (closing a little with speed) and 1.05 m up the rider is
    about 1.4 times larger, and pitch is solved from the camera's real position so the rider's middle
    holds about 61% of the height while the horizon never rises above 22%. When the rival the HUD
    names is within about 12 m the view turns by the smallest angle that frames it, keeping the rider
    in the middle 40% of the width and widening the FOV by up to 8 degrees; on plain pilot runs that
    raised the time a frameable rival was on screen from 58% to 91%. For the first 3 s of a run the
    lens rides higher, further back and to one side, pitched up about 4 degrees, so the mood card's
    reveal shows the corridor and the sky. While you draft a ghost squarely ahead, the camera eases
    up to 0.8 m to one side so the ghost shows past the rider.
    The lens never comes within 0.2 m of the snow under it (0.3 m halfway to the rider): just past
    a kicker the mound behind the rider stands higher than the rider, and the lens sank into it,
    filling the lower frame with a flat slab of terrain. It is a floor, not a height: it engages in
    about 1 to 10% of frames, over mounds, so the low framing is otherwise unchanged.
44. **The results open on a hero shot of your wreck.** On wide screens the card keeps to the right
    58% and the camera frames the crash 5 m away in the open left side: the rider slides to a stop and
    sits up dazed on its mitts, turned toward the lens, under the sun, with its sled upside down
    beside it. It makes the results a moment of the run instead of a form over a blurred backdrop.
    The desktop shot sits low and about 4 m out (at 5.5 m the rider was small in its column),
    centres the wreck in the left column and frames the tree or rock it hit behind it. A fill light
    from the camera side, the rims turned down, three gold-white stars circling the beanie and a
    dazed head turned three-quarters to the lens make the face read; the stars carry thin ink
    outlines so they show on bright snow. The body lies side-on, so the boots never point into the
    lens, with one arm bent and the head tilted, and the scarf fans out across the snow; the sled lands
    flat and upside down, on the downhill side of a steep bank. The horizon is level,
    and each candidate framing pays a cost for trees near the lens, on the sight line or across the
    near view; the shot is picked again if the wreck slides after the first pick. While the results
    are up, a whole hazard dissolves when its trunk comes within about 1.2 m (plus its canopy) of the
    sight line to the wreck or within about 4 m of the lens, except the tree you hit; gifts cut by the
    frame edge shrink away. A rider lost in the forest stops at the treeline wall, and the wreck
    slides up to 4 m out from under the trees as it settles; it is shot from 1.3 times further out on
    the open slope (from inside the canopy the critics saw only trunks). When every spot is blocked,
    the camera stands back toward the open course before it falls back to a crane over the canopy;
    the crane alone showed a tiny rider from straight above.
    Contract C6: on phones the card's top edge sits at 28% of the height (plus the top inset), and a
    72-degree lens lies low down the slope, about 7.5 m out and 0.6 m up, with the wreck a little
    below that band's middle so the beanie and the stars clear the top. Phone runs and results shots
    get less bloom and weaker speed streaks: a phone's tall view looks down on a broad sheet of near
    snow, which they washed flat white.
45. **Pause > Home is two taps.** It throws the run away with no results, missions or rewards, so the
    first tap arms it ("Quit run?") for 3 s and the second leaves, like the shop's Buy and Confirm.
46. **Toasts rise above the results.** "Challenge link copied" and the no-ad message are results-time
    feedback, so the notices layer (which holds no controls) stays out of the modal's inert set and
    sits above its scrim; it used to be dimmed under it and never announced.

## Made in the last art pass (critic round 5)

47. **Day snow takes only a trace of the sun's colour.** Lit by the low peach sun at full strength the
    snow read as sand, worst on phones, and its regular near-camera ripples read as dunes. The mood's
    grade still supplies the warmth. The ripples are stretched, patchy noise with crest lines and
    periwinkle in their troughs, lying about 30 degrees off the fall line: running straight down it,
    they converged on the vanishing point and read as speed lines.
48. **Snow shadows soften and fade with distance from their caster.** The snow shader asks the
    shadow map a second time 7 m nearer the light to judge how far off the caster stands, then
    blurs and thins long shadows, so the treeline's raking shadows taper into soft blue instead of
    printing hard blocks. Its taps are unrolled and read at LOD 0: in a loop, D3D's shader compiler
    warned that their derivatives were undefined.
49. **FXAA runs only where there is no MSAA** (Medium, Low and phones), inside the existing
    composite pass, for about 0.1 ms at 1280x720.
50. **Gifts clear the rider's outline.** A gift overlapping the rider's on-screen silhouette within
    about 12 m shrinks away (one hung on the rider's back like a backpack), and on the results any
    gift within 3 m of the wreck does.
51. **Gold means gifts and currency.** Lamplight on vermillion keeps its hue (it turned the runners
    pink), and Lantern Night's accent is moon blue (#B4C4FF) rather than amber. Gold-white marks
    your best and first place, which gets a crown.
52. **One message per beat: the stamp holds and the pass flashes after it.** This reverses round 5,
    when a pass beat a perfect landing and the stamp stepped aside: critics read the stamp being cut
    off as a glitch. The stamp is always the headline of its beat (about 15% smaller and higher than
    before), and a pass flash under 450 ms old steps back and replays once it goes. The multiplier
    pill is about the size of the combo total it multiplies. The combo total shows
    whenever a combo is up, with the multiplier chip hidden at x1: critics read a bare timer bar as
    an empty slot. A banked total holds its row so it never prints over the next combo's.
53. **Shop portraits are the real sled meshes.** Each sled is rendered once per session through the
    main renderer into an offscreen target (seated rider on the large preview), cached as a PNG and
    falls back to the vector art if rendering fails. They are drawn in the background while the
    title idles, so the shop opens with its pictures in (drawn on demand they faded in over most of
    a second). Every sled sits at a three-quarter hero angle (about 17 degrees) on a snow disc with a
    warm peach rim, a neutral key and a dense contact shadow, filling about 70% of its tile; the pale
    sleds get their own light (a mint glow for the Wisp, bright silver for the Tea Tray). The
    preview's backdrop is an inline SVG in the game's own dusk colours. A sled you cannot afford yet
    keeps its full colour, the dim falling on its tile's backdrop, with a "220 more" lock tag; as a
    silhouette it hid what you were saving for. Affordable sleds carry a filled marigold price chip,
    and "Equipped" is a status chip, not a button. Each tile has its own sky, glow and rim (cool for
    the Wisp and the saucer, warm for the Lodge, violet for the Comet Bob, silver for the Tea Tray),
    a higher drift crest and a denser contact shadow so no sled floats; the saucer gets a low key and
    a specular glint so its bowl reads as a dish, and the Comet Bob a near-white key, a blue-pearl
    tint and a vermillion rim. Lock tags read "174 to go" with the gift icon.

## Made in the last art pass (critic round 6)

54. **Shadows fall from their own light.** The shadow light is swung about 26 degrees further across
    the slope and lowered to about 15 degrees, so trees and riders cast long raking shadows across
    the track; the 24-degree key light (decision 27) still shades the snow. The terrain casts no
    shadows.
55. **Powder keeps the sled's speed.** Spray and landing bursts inherit most of the sled's velocity
    along the slope, so they stay beside the rider instead of streaking at the lens, and only powder
    that overlaps the rider on screen thins. A perfect landing leaves a burst crater that reads as
    displaced snow: a feathered cream-gold lip of raised powder, lit on the sun side and periwinkle on
    the other, a shaded bowl and 12 streaks thrown out within 0.14 s, with no outer stroke and only a
    few small puffs. A soft blob read as an oil puddle (round 6) and a hard gold ring as a UI target
    reticle (round 7).
    The crater rides under the sled for 0.42 s before it stays in the snow (it fell behind the lens
    within 0.1 s and read as a smear). The rider's white flash is a thin rim on upright edges, gone by
    0.15 s, and the arms go up in a V; across the body, even across its outer facets, it read as
    bleached.
56. **The results card lands one beat at a time.** The score counts up, then the place, the crash
    line, your run, the race and the missions arrive in turn (transform and opacity only, all at once
    under reduced motion), and Run Again is there from the first frame. Only notable stats show, two
    at most: one that beat your lifetime record (tagged Record; a first record is no news) or cleared
    its floor (a 1,000 combo, 1.5 s of air, one perfect landing); four equal stats added reading time
    without hierarchy. Distance shows only when there is no race, whose rows carry it. A run with no
    notable stat shows one tip for next time, chosen by how you crashed. Gifts sit in the card's
    head, and a run that earned nothing shows only the wallet, never "+0". The missions always fold
    into one row; on landscape only a mission finished this run stands open under it with its Done
    stamp, and on desktop the race starts level with the crash line so the two columns come out
    even. A pressed offer (Revive, Double Gifts, Challenge) is aria-disabled and keeps focus, and a
    withdrawn one stays in its slot as a status ("Gifts Doubled"): a disabled button dropped focus,
    which could then land on Run Again, where Space starts a new run.
57. **A hint goes the moment you do the move.** Steering or starting a drift clears its hint at once,
    skipping the hold that stops hints flickering. The touch zones are soft ink pools rather than
    dashed rectangles (an outline read as a debug overlay and vanished on bright snow), and the drag
    pad is ink navy at about 60%.
58. **Only a chaser in your slipstream gets an edge marker.** The rival marker for a ghost behind you
    shows only within 15 m and about a lane either side, close enough to pass you. A chaser further
    back at the screen's edge was noise. The chase camera sits about 2.5 m behind the rider, too close
    for any pullback to bring a chaser into frame, so this marker is how a chaser is shown.
59. **The rider stays readable from behind.** Torso roll is capped at about 35 degrees, the sled tips
    less and the hips more, and the crouch sinks more than it pitches; while drifting the upper body
    turns toward travel. The head sits on its own neck pivot: it leans back toward upright against
    the torso's pitch and roll and keeps its size through the landing squash. Seen from the
    chase camera, a full lean read as the rider lying on their side. Arms rest down and forward,
    and the navy coat keeps its own dark hue in shade, with the warm horizon rim cooled on dark cloth.
    The sky and fresnel light on the coat is clamped so its back holds ink navy in the saucer lean and
    the landing squash (it read as a grey tombstone), with a lighter sun-side panel for a second tone.
    The torso tapers to the waist, the limbs taper, the elbows bend, and in the landing squash the
    scarf drapes to one side so the back and arms still read.

## Made in the last art pass (critic round 7)

60. **The rider has a toy face.** Oval eyes with catchlights, blush, goggles pushed up on the beanie
    on a strap, a folded cuff and ear flaps; with the goggles down, critics read the face as a
    robot's. The back of the head is one smooth, dark mass of hair down to the scarf: a low-poly cap
    and two tufts caught the backlight as a pair of closed eyes. Ghosts use a stripped body with no face, goggles, strap or scarf, which also
    removed the dotted seams along their glass. The coat's rim is brightest on the shoulders and
    upper back, and turns ember under Comet Night's dusk sky.
61. **Ice is its own material.** Glass Ice and Frostfang spires, seracs and crystal rocks run from a
    deep blue base to white-cyan tips, with a faint inner glow, a fresnel rim and a pale-gold rim on
    the sun side; on the snow shader they read as tan slabs. Near-white parts of props take only a
    trace of the sun's colour, as the snow does (decision 47).
62. **Kickers are painted by the terrain.** Each terrain vertex carries a kicker weight, and the snow
    shader paints a packed, corduroyed face, darker flanks, a shaded takeoff wall and a contact
    shadow; the lip is a snow cap over a board (pale ice on icy mountains). Unpainted, a kicker read
    as a bump in the snow.
63. **Blizzard keeps its shadows faint.** Cast shadows drop to 40% and soften, gifts grow 20% and glow
    through the fog, hazards stay darker in it (dimmed to 0.82, snow shade #8A97AE), and a few big
    flakes pass near the camera. Full shadows under a white sky read as a rendering error. The soft
    contact shadow under an airborne sled stays, darker in Blizzard, and slides forward to stay in
    frame on a big jump: it is how you judge height.
64. **Night moods own their light.** Lantern Night's lantern lights a soft, round, desaturated-amber
    pool about 3.8 m across, anchored under the sled and shrinking with its height (ahead of an
    airborne rider it read as a patch of orange sand), shared by the snow and the carve groove, and it
    warms the rider's legs, sled and lower coat so the rider sits in its own light. Outside it the snow
    is moonlit periwinkle with sparkle, trail lanterns with soft halos mark the corridor so the
    vanishing point is never a dead void, and the moon sits low enough to show whole at the run
    start. A kicker's lip is plain wood under a snow cap in the mood's own snow colour: its white
    board highlight cut across the sled like a laser line. Comet Night's lit snow is
    near-white lavender (#EFE8FB) with #6B4FB0 on the banks, and its comet tails taper and curve.
    The bottom-edge darkening leans to the mood's periwinkle rather than grey, and the carve groove
    runs to the bottom of the frame, so the foreground is never flat. In night moods the HUD pills
    get a moon-blue hairline, and each mood has its own UI accent (Blizzard steel, Glass Ice aqua,
    Haunted green, Powder azure, Lantern moon blue, Comet lilac).
65. **One race-gap grammar (contract C12).** A gap is a positive number of metres with a word: the
    rival pill reads "6 m ahead" (a solid chip in the ghost's kind colour) or "6 m behind" (the same
    colour as an outline), the word smaller than the number; first place keeps its crown. A bare
    sign, a lone triangle or a gold "+7 m" each read differently, and three systems on one screen read
    as none. A place change is a mint up-arrow with the count on a gain and a dim down-arrow with the
    count on a loss, in the slot of "of 7" so the row never changes width ("5th -2" read as losing
    places mid-pass, and a white disc with a triangle as a dropdown). The off-screen marker is the
    ghost's glyph on an ink plate with a filled arrowhead outside it (a chevron rotated inside the
    plate read as a checkmark) and the gap in short form ("6 m"). The full Slipstream state is a
    mint-filled pill with a pulsing ring.
66. **The title serves a first visit too.** A first visit has no menu row, so a 44 px Mute toggle
    keeps the top right; it starts from the saved master volume. The Daily Mountain's play disc is an
    outline, so Ride is the only filled play target. The selected mountain gets a 3 px ring, a check
    badge and a small lift, and its lower half shows your best and ghosts passed (the tagline before
    you have any); locked mountains keep their biome colours under a 40% dim. The gift and Best chips
    hide while both are zero ("0 / Best 0" read as lost progress). On phones the logo is centred
    over a long, eased fade from the snow-shade periwinkle into ink navy that starts low enough to
    leave no muddy band.

## Made in the last art pass (critic round 8)

67. **Sparks are soft motes, and they stay low.** Additive sprites are round motes with no rays:
    four-point stars floating in open air cheapened the painterly frame. A gift pickup throws a small,
    low burst that moves with the sled and lands on the snow, a perfect landing keeps about a third
    of its sparks skimming the snow, and there is no burst for a pass (a gold one in empty sky
    suggested a pickup that was not there). A crashing ghost's poof stays in its kind colour.
68. **The HUD has its own type unit.** It grows with the screen height on desktop (16.5 px at 720p),
    so "PASSED" and the mood chip are no longer 9 to 11 px there; the place numeral is in the score's
    size class, because in a ghost race your place is the first number to read; and nothing in the
    HUD is under 11 px on a phone. The mood card is glowing type over a soft ink halo hung under the
    race row, not a slab over the aurora, and the race row shows from the first frame. A grudge's
    "+10 gifts" sits beside the name at its size: it is the payoff of the moment.
69. **Snow marks are carved, not painted.** The runner grooves are two soft periwinkle cuts whose
    width and depth follow carve depth, each with a modest lip on its sun side, fading toward the
    lens; uniform hard navy stripes read as road paint. Pines vary about 25% in height in spruce teal,
    with the far rows fading into the fog, and each gift has its own small height offset, lean and
    size on top of its bob, so a row reads as placed objects rather than a fence (positions are the
    sim's and never move).

## Made in the fun pass

70. **No sim change this round.** The brief allowed one batched sim change (the draft chain fix, a
    deep-carve cadence, a mitten grab, a perfect-landing decay exemption). The panel voted it down:
    a SIM_VERSION bump drops every returning player's best ghost, grudge and challenge link, which
    this round is the one to give meaning, and regenerating the pools would move every crash
    distance the new field is tuned on. It is the first job of the next round, scoped and ready
    (SIM_VERSION 4 to 5, then one pool regeneration). The leak players feel, a slipstream being
    celebrated, is handled app-side: drafts and slingshots never count toward flow, the groove's
    skill layers or a bank's tier. The one sim edit is a data tap: a near miss's style event now
    carries its edge gap, side, nearest point and obstacle kind as optional, unhashed fields.
71. **Every named moment is a beat.** The director turns the sim, the race and the save into one
    list of beats per frame (src/game/beats.ts), and the HUD, the audio and the world all read that
    same list. A moment that is not a beat does not get a sound, a callout or a camera move of its
    own, so nothing celebrates twice and nothing celebrates out of step.
72. **Time bends only at the edges.** Hitstop and slow motion scale the real-time feed into the
    fixed loop and the render clock, never the sim. A stomp's hitstop grows with the streak (8 to 11
    frames), a tier-3 drift release freezes briefly, a whisker gets 0.05 s, and a crash eases into a
    slow curve. Reduced motion turns all of it off and keeps every beat.
73. **A near miss is graded by the gap.** Under WHISKER_GAP (0.45 m, edge to edge) it is a Whisker:
    panned to its side, a short jolt, snow off the boughs or grit off the rock beside you. About
    one fast near miss in five grades Whisker in the pool replays. The burst sits 1.2 m ahead of the
    sled and is pulled in until it projects on screen; airborne, a tree's burst rises with you up to
    3.5 m and is skipped above that.
74. **Flow is earned, and it can break.** 'In the flow' fires when the shown flow reaches 2.9 with
    three kinds of move in the combo, one of them a spin, a flip or a gate. Shown flow is the sim's
    flow capped by what you earned (skill moves / 4 + perfect landings / 2); drafts and slingshots
    earn nothing. The rim and scarf glow is full at 3.5. A bump bank or a sketchy landing above 1.2
    snuffs it with 'Flow broken' and a short pfft; a crash snuffs it without a word. Pool replay:
    36 of 46 expert runs over 60 s reach it; the stunt pilot reaches it in 3 of 8 runs, novice
    first runs never (0 of 8 in the final telemetry): it is a skill state, not a cruise state.
75. **One number at stake.** The combo shows what you would bank (pending x multiplier). A fuse lights
    from 1,500 at stake once the timer is under 40% and draining. A bank grades into tiers by points,
    skill chain and your best combo: the chip slams, then the figure rolls up over 350, 600 or
    900 ms. 'Best combo pace' warns mid-chain, and a lost combo of 300 or more cracks and falls. HUD
    and audio read the same timings (stake.ts).
76. **Stomps stack.** Perfect landings in a row read Double, Triple and Quad stomp, then 'Stomp streak
    N', with a crater, ring, bell and hitstop that grow. A sketchy landing, a crash or a revive breaks
    it ('Streak broken'); a hop under 0.3 s neither counts nor breaks. A single perfect reads
    'PERFECT LANDING' over 'STOMP +250'.
77. **The field is built around where you crash.** (Replaced in the wow pass: it is built around your
    predicted finish time.) The anchor A is the larger of the median of your
    last five run ends on that mountain and 0.7 of the last one (700 m with no runs). An opener at
    0.62A, two pack ghosts at 0.85A and 1.05A, a pace rider from max(1.7A, A + 250, 1,500 m) that
    averaged 23 m/s or more, and a stretch rider past 2.2A. A fresh Pinecrest run calls 'Chase
    SparkleCedar', a pace rider who duels you around 30 s. Your best, the grudge and a friend's
    challenge ride on top. In the final telemetry, novice first runs end with the race live (a ghost
    within reach) in 3 of 8 runs before and 8 of 8 after (7 of 8 by the strict count), and the race is
    live for 99% of a run against 70%. A skilled rider used to outrun the whole field: the stunt pilot
    ended with the race live in 0 of 8 runs before and 4 of 8 after. Riding with the pack means more
    slipstream, so runs are faster (novice 18.7 to 20.6 m/s) and shorter in time.
78. **Every pass has a word.** Start-line jostles before 6 s are muted, but a slingshot through the
    bunch is a pass and a burst reads as one growing 'Slung past N'. Then Passed, Double pass,
    Triple pass, Pass streak N, Took back (pays nothing), Beat (a wreck), Duel won, Held off and
    'Passed Your best'. Your best's muted jostle keeps its first pass for the real overtake. A muted
    pass pays only its base; chain and slung extras share one cap of 30 gifts a run.
79. **A duel is a named fight, and its result owns the pill.** Riding within 1.5 m for 1 s opens a
    duel; 4 m clear or 8 s resolves it. For 1.5 s after the result the rival pill, the C11 ring and
    the edge chip stay on the duel ghost and no new duel opens; other ghosts' words go to the
    callout line under the combo. When a banner or the landing stamp covers the result, its 1.5 s
    starts when it shows, and the next banner waits for it. The rival pill and the chip read one
    held gap (1 m hold, 250 ms dwell) measured on the render tick, and the pill hides when no ghost
    rides ahead or within 150 m behind.
80. **A grudge settles only on what you saw.** A shown pass, a duel won or held off, or the grudge
    crashing behind you settles it; a start-line jostle never does. Its premium (10 gifts, 20 for a
    nemesis, doubled in Haunted Hollow) is paid once, at the settle, and the banner says why ('Wiped
    out behind you'). The banner waits while a duel or a result's hold is open, and up to 3 s while a
    slung or chained pass still flashes; when 'Passed Your best' is due at the same moment, the gold
    pass goes first. Three wins in a row make a nemesis. A settled grudge is never elected again
    straight away: the next is the nearest other ghost that went further than you.
81. **Pops wait for clear air, and give up.** Missions and unlocks pop mid-run when nothing bigger is
    on screen: the head of the queue waits up to 8 s (12 s for an unlock), nothing pops more than
    15 s after its moment, and an open duel holds a pop only for its first 2.5 s. An unlock goes
    first, but only after a pass you saw, and a mission earned with it follows 2.7 s later.
82. **One race line on the results.** In order: a friend's challenge, the Daily medal on a Daily run,
    a settled grudge or a nemesis, the event you never reached ('The yeti was 410 m away.'), then any
    other grudge line. Under 1 m the margin reads 'by less than 1 m'.
83. **Sound follows the picture.** The results card and the reveal cue their sounds from their first
    painted frame, not from the call that opened them. A coin plays when its reward lands in the
    wallet and a mission chime when its Done stamp starts on screen (UIHandlers.onRewardLanded and
    onMissionStamp), so a row folded away on a phone makes no sound. Measured: within about 12 ms
    on desktop and phone.
84. **The gold band is the exception to decision 69.** Your best's line is painted on the snow as a
    thin gold-white band (a friend's in mint), with a 'Best in N m' countdown and a New ground flare.
    It is the one painted mark allowed, because it is a line to chase rather than decoration, and
    it costs no draw calls.
85. **Graveyards are places.** Where three or more pool ghosts crashed within 8 m, a cairn stands
    with a name and 'N ghosts fell here' (up to four per mountain, no name used twice across the
    bundled mountains). Riding 20 m past it alive says 'Survived <name>' and pays 3 gifts.
86. **Only Space and Enter start a run from a menu.** Shift is a pop in a run, so Shift+Tab on the
    title or results used to start one. Clicks and taps still do.
87. **Hints teach and then stop.** The boosted-pop lesson wins over the drift lesson on a kicker
    approach; the drift hint shows at most three times or 20 s a run, the spin hint three times;
    air lessons need 2 s left to land while stomps are new; the stomp cue needs a real flight.
88. **The band grooves from the first cruise.** Bass and hats come in at the run floor (2.5 s on a
    plain run), skill moves and stomp streaks add the arp, kick and lead, and drafting alone never
    lifts it past the arp. Ghosts you passed and who still ride close behind join as a choir (up to
    three voices) and sigh when they take you back. When the sfx pool is full, a quiet tail is
    stolen before a payoff.
89. **The soundtrack makes its nodes between frames.** The fuller band costs main-thread time on a
    weak CPU: at Low with the CPU throttled 6x the new build ran about 4 fps under the old one with
    audio on, and level with it with audio off. Voices now take Web Audio nodes from a reserve that
    the 25 ms scheduler tops up between frames, share one reverb send per level, unplug only their
    tail, and hats, kick clicks and the choir use pre-filtered noise and shared formant chains
    instead of a filter per hit. Nodes made per second at a cruise went from 107 to 78 (the old
    build made 39), and nodes made inside a frame went to about 0. A seeded sample-level null test
    puts every probe within 0.07 dB of before. Persistent note lanes cut further but moved the hat
    layer by 2 dB for a reason not yet found, so they were not shipped. Gift pickups, the busiest
    one-shot, play from takes rendered once per ladder note through an OfflineAudioContext: three
    nodes instead of ten (sixteen for a big gift), and only where the take lands on the same frames as
    the live pickup in Chrome's 128-frame blocks (within 0.09 dB, 0.01 dB in the null test); any other
    pickup, and every pickup above 48 kHz, plays live. Steady cruise nodes went from 64 to 52 a second.
    Low at 6x stays a few fps under the build before the fun pass (decision 89's cost is the band
    itself); next round's options are a Low-tier arrangement or synthesis in an AudioWorklet.

## Made in the fun panel's fix rounds

90. **The pack rides past your wreck.** After a crash the race is over (no race events, no pass
    paid, nothing a revive could replay), but the standings follow the ghosts on, so the place chip
    steps down as they go by, and each ghost that was behind you says '<name> passed you' once as it
    leads the wreck by 0.8 m. The results wait while one still rides within 25 m behind, and 500 ms
    after the last goes by, up to 1.6 s after the crash (reduced motion keeps 950 ms and never
    waits; a tap still skips). The crash beat owns the race row: mission, unlock and grudge banners give way and are held off
    until the results (a settle still pays and its line is on the card), and the place chip steps on
    the same frame as each wreck pass. The camera keeps the passer in frame: the crash orbit stops
    drifting, turns toward the ghost (the wreck kept in the middle 70%), and cuts to a still tripod
    beside the line when the ghost will cross it 5 to 24 m from the wreck; its tag wears the rival's
    ring. The card names only the passes you saw ('You led at the crash. SparkleCedar and 2 more
    ghosts rode on past.'), and a phone card, whose race line takes that slot, puts 'Led at the crash'
    under the place.
91. **Your rival is one you can catch.** The grudge goes first to the ghost nearest you at the crash
    within 50 m either side, then to the nearest within reach (300 m or 0.6 of your distance past
    you); the pace rider, built to finish far ahead, is never elected, and with nothing in reach no
    grudge is. The lines say why ('SparkleCedar was 13 m ahead when you fell.'), a settle keeps its
    tally and names the successor ('Grudge settled with Mila after 2 runs. New grudge: Tess.'), and
    every margin is the difference of the rows as shown, so '7 m' sits under rows of 760 m and 753 m.
    The save keeps its v1 fields.
92. **Missions stay in sight.** The pause card lists the run's missions with their live progress
    and Done once one popped; a results card with no mission finished names the one closest to done
    in the folded row ('Ride 800 m in one run 753/800'), so a phone's card is no taller. Progress
    floors and keeps the target's precision (1.2/1.5).
93. **The cash-in is honest.** The multiplier chip is absorbed into the figure within 120 ms, so a
    rolling figure never sits beside 'x3'; the score holds a cash-in's points back until its figure
    lands (display only); a lost combo's crack is graded by its stake like a bank and drawn at the
    cash-in's size, up to 1.2 s; and a draining stake on pace keeps the fuse's amber figure.
94. **Flow gets its own moment, and the phone keeps its look-ahead.** 'In the flow' takes the line
    alone in vermillion at 1.2x a trick's size, waits only for a stamp, and from then until it goes
    out the multiplier chip wears a vermillion ring and a FLOW tag; a mission pop waits 2.6 s after
    it, so the line has about a second alone. The fuse is on the chip too: a draining stake turns the
    timer fill amber and throbs the multiplier at 500, 250 and 167 ms by band. On a phone held upright
    the perfect-landing stamp sits under the rider, over the snow already ridden, instead of across
    the slope ahead.
95. **The camera answers skill.** A whisker flinches the lens 0.16 m away and tips the horizon; a
    max drift's release outranks a stomp (a 1.0 kick against 0.9, a 0.14 s freeze against 0.13 s),
    throws the lens back 0.35 m and knocks the horizon past level out of the lean; stomp streaks
    shake harder (to 0.4) and knock the horizon from the third. The held crash lens, and the near
    plane's corners, stay over the snow. Reduced motion turns all of it off.
96. **Landmarks are made on idle time.** The kilometre arch and cairn meshes are built off the frame
    after the first frame (and the title no longer builds every prop twice), so the first frame at
    6x CPU throttle is level with the build before the fun pass again (1.79 s against 1.78 s, median
    of 20 interleaved runs; 2.11 s before), with no hitch when an arch comes into range.

## Made in the shape and feel round

97. **Courses are built from sections (SIM_VERSION 5).** Every course used one recipe: a single
    noise wiggle on a 300 m wavelength, a width that narrowed evenly and a constant slope, so the four
    mountains differed only in amplitudes and props. A course is now a run of sections, 200 to 500 m
    each, drawn per seed from the biome's deck and blended over 140 m: cruise, chute (steeper,
    narrower, straighter), bowl (wide, gentler, open, more kickers and moguls), switchbacks (bends at
    about half the wavelength), benches (flatter terraces over 1.6 m rollers that lift a boosted sled
    off the crests), gully (narrow between high banks, few obstacles) and split (wide, with a line of
    trees down the middle; the safe line keeps to one side and the other is a second way down, open
    but not promised). Decks give each mountain a character: Pinecrest switchbacks and splits,
    Frostfang chutes and bowls, Ember gullies, Sakura benches. The first section is always a cruise
    of at least 450 m, and chutes and gullies never come before 900 m or twice in a row. The bend's
    phase and the height are integrals of each section's frequency and slope, and the width's caps
    are rounded, so no blend turns a corner: the safe line's worst curvature across the fairness
    seeds is 0.0145 against the 0.018 limit. Over the first 4 km the spread of bend strength, width
    and slope roughly doubles (widths 17 to 48 m against 21 to 38). The pools were regenerated; the
    scoring change DECISIONS 70 deferred is still open and will take the next version.
98. **Difficulty eases in.** The ramp was 1 - (1 - t)^2, which climbs fastest at the very start:
    at 1 km a mountain was already 38% of the way to full density and narrowing, exactly where new
    players are. It is now a smoothstep (11% at 1 km, 44% at 2 km, 78% at 3 km), so the full density
    still arrives by the ramp distance. Snowmen are placed before the obstacle fill, so Pinecrest's
    signature is no longer crowded out. The start got three more allowances, each found in the
    regenerated pools or the telemetry:
    - Obstacles keep an extra 1.5 m from the safe lane at difficulty 0, shrinking to none at full
      difficulty. Riders of every skill lagged an early bend and drifted 3.5 m into a rock that was
      legally 3.4 m off the line; 7 of Pinecrest's 36 pool ghosts died on it at 232 m.
    - No moguls before 300 m. The mid pilot stomped into a field at 137 m, was thrown straight back
      up and crashed, four runs out of four.
    - The gift line that tempts you off the safe one starts at 400 m.
99. **No flip starts in the last 20 ticks before touchdown.** Holding the one button for 7 ticks in
    the air starts a backflip, and a stomp is a press in the last 9: a stomp held a little long tipped
    the rider into the snow. A flip already turning carries on, and a full flip takes about 55 ticks,
    so no flip that could land is lost. Touchdown is predicted from the ground sampled every 4 ticks
    along the flight (one sample at the end missed a mogul crest in between). The bot's air model
    mirrors the guard.
100. **Steering is graded, not all or nothing.** A steer key starts at 35% lock and builds to full
    lock over about 0.2 s (12 ticks), so a tap is a correction and a hold is a turn; reversing starts
    over. Touch full lock moved from 16% to 24% of the short screen side (62 px to 94 px on a 390 px
    phone), and touch and mouse share a curve that is fine near the centre. All of this is input
    shaping in src/game/input.ts: the input log records the levels, so replays are unchanged.
101. **The effects sit with the band, not over it.** With both sliders full, a run of gift pickups
    alone measured -22.5 dBFS RMS against the whole soundtrack's -25.4, and the default sliders (music
    0.7, effects 0.9) tilted it another 4.4 dB. Every one-shot sound now takes a -4 dB trim
    (SFX_TRIM; the wind and snow bed keep their level), the everyday ducks are lighter (a stomp dips
    the band to 0.82 instead of 0.62, a big bank to 0.88 instead of 0.75, warnings, finales, a revive
    and an unlock less), and the defaults are music 0.8 and effects 0.8. A save still holding the old
    untouched pair takes the new one. The crash, a big bank's drop and the avalanche escape keep
    their deliberate gaps.

## Made in the visual round

102. **Clouds live in the sky dome.** The banks are a height field rising from the horizon, so they
    read as heaped towers, never floating lenses. They dip under the sun's bearing to frame the disc,
    never cover its core, draw under the aurora and comet, and cost no extra pass (Low draws the
    banks only). The dome's hash noise wraps by comparison, not mod(): on D3D, mod() can land a hair
    under a whole cell and tore the clouds into vertical seams.
103. **The sun travels with the run.** Clear Skies blends from golden to alpenglow by 2 km and to
    blue hour from 3 km (full by 4 km), keyed off distance, so a long run reads as an evening passing
    and its best frames come late. It re-blends only when the weights move (about 8 times a second).
    The title reel stays at the start and chaos moods keep their own light. Light shafts come only
    from a low sun in view, on Medium and High, masked round the rider; a moon's rays fought the
    aurora and the comet.
104. **The rider is rounded, and the back of the head carries the detail.** Capsule limbs, a lathed
    coat, mitts and soft boots replace the box limbs the critics flagged in every round. The chase
    camera only sees the back, so that is where the knit cuff, seam, stripe, pom-pom and scalloped bob
    are; five lighter locks read as teeth, so the fringe is in the hair's own colour. The pom-pom
    spring and hem flutter run in the vertex shader from per-vertex weights, at no draw-call cost.
105. **Ghosts ride glass sleds.** A faint tinted sled of the sled the ghost raced (read from its
    record), glowing runners and a soft glass lap of legs, drawn in one mesh placed by per-ghost
    uniforms, so a ghost reads as a racer on a sled while its body still dissolves from the chest
    down (C10 holds). Its runner lines are two thin lines a runner's width apart, the whole field in
    one mesh; draw calls go from 3N + 3 to 2N + 5. Within about 3 m of the lens the sled fades out:
    bright runners at the bottom of the frame read as scribbles.
106. **Forest variety comes from variant sets.** One instanced batch holds two trees; each instance
    picks one in the vertex shader and the other collapses to a point. It costs vertices instead of
    draw calls, so Medium and High get it; Low keeps the original tree alone (a second variant
    doubled the forest's vertices there) but keeps the per-tree tint and lean. Variant sets and the
    dressing kits are made one piece per idle callback: a whole set in one callback took 10 to 85 ms.
107. **The banks are dressed, and each section reads before it plays.** Two instanced kits (Medium and
    High, +2 draw calls, none on Low), always at least 9.2 m past the corridor edge so nothing
    decorative stands where a sled can still ride: chute flags and rock bands, a bowl's cornice, bench
    fences, gully walls, a split's signpost. Cruise and switchbacks keep the default forest.
108. **The avalanche is in the world, and the sky is clear of HUD.** The wall's flank rolls down the
    banks ahead of its front in rooted, overlapping billows (free billows read as blue blobs), dark
    slabs roll past along the corridor edges, and gusts overtake the lens. Near-field flakes hang at
    the lens's height above their own snow (hung level ahead, the descending camera passed under
    them and they streaked across the sky like meteors). The mirror unit moved to the top-right
    corner, amending decision 36's top-centre (one cold unit and its contract hold), the top-centre
    stack is shorter, and its secondary parts fade while the rider is airborne and return on any beat.
109. **The course's z functions are memoised.** The sections made centerX, halfWidth, safeX and baseY
    look up a section and blend twelve fields on every call, and the terrain asks for a whole row of
    x at one z (and its slope at z + 0.25). A two-entry memo per function answers most calls; the
    values are the same, so the sim and every replay are unchanged.
110. **The horizon is a real mountain panorama.** Three faceted ranges and a hero peak per biome
    (Pinecrest's snow summit, Frostfang's ice fang, Ember Peak's smoking volcano, Sakura Ridge's
    cone) replace the three paper ridge ribbons, in one draw: a polar grid raised in the vertex
    shader with ridged noise stretched round the ring, so crests read side-on rather than as a field
    of spires. The panorama has its own key light swung off the sun's bearing, so faces toward the
    lens split into lit and shade instead of all being backlit. The near ranges part down the fall
    line to keep the sky over the rider clear, crests under the sun stop below the disc, and a sea of
    clouds 330 m below the lens is painted by one function in both the dome and the ranges' feet,
    so the two never show a seam. Alpenglow climbs the peaks over the sun's journey. Low draws one
    range and the hero. Net draw calls fall by two on every tier.
111. **The middle distance is built, and it passes by.** A world-anchored, streamed mid-ground
    (`midground.ts`) carries the mountain on from the terrain's edge to about 1.15 km: one side falls
    to a stepped valley floor, the other climbs into a forested, craggy flank. From the chase lens
    the banks hide everything below their crest, so the climbing side is what reads while riding and
    hamlets sit on the flanks; valley villages (church and frozen lake, research huts and a mast,
    stone lodges by a lava river, a pagoda town) show from the title, jumps and the crash shots. Its
    ends and outer edge sink into the haze in the vertex shader, since fully fogged geometry still
    cuts a silhouette from a bluer sky. Windows and lamps light from dusk. +3 draw calls on High
    and Medium (+4 at night), +1 on Low (shoulders only).
112. **The run passes set pieces, and the crowd reacts.** Every 500 to 900 m the course runs under,
    beside or past one big place (`landmarks.ts`): gates, footbridges, ice and basalt arches and a
    torii over the run; huts, towers, a ski jump, frozen falls, an observatory, guardians and a pagoda
    beside it. A span's lowest point clears by 6 m the highest air any sled could reach under it (every
    pop, kicker and vent up to 380 m up the slope flown at the fastest speed there, in the mood's
    gravity); where that needs more than 56 m it becomes a bank piece. Everything else stands 9.2 m
    or more past the corridor edge, and a test checks every vertex on all four mountains. The forest
    keeps each piece's ground and its crowd's rows clear (`Props.siteClearings`). Toy spectators line
    the banks at gates and huts, turn to follow the rider, and cheer the beats made near them: the
    world answers the player without a sim change.
113. **The mountain is inhabited.** `life.ts` adds six instanced systems, one draw each: birds that
    wheel and scatter from a stomp or a crash, chairs running the dressing's real lift cables, deer,
    ibex, hares and foxes at the treeline that only ever bolt away from the run, skiers and a night
    snowcat on the mid-ground's flanks, chimney smoke from the cabins and the hamlets, flags and
    lantern strings, and diamond dust in the sunbeams. Motion is in vertex shaders off the shared
    clock; the CPU walks about 22 figure matrices a frame. Low keeps the birds.
114. **The camera directs the big moments.** A flight predicted at 1 s or more pulls the lens out, up
    and to the open side (full at 1.9 s) so the valley opens under the rider, keeps the landing spot
    in frame, and is home 0.35 s before touchdown so the stomp is judged from the familiar framing.
    Speed reads above 15 m/s through the FOV, a speed-scaled carve tilt, a low lens into fast carves,
    a fine rumble from 24 m/s (kept apart from the beat shakes so their sizes hold) and flurries
    skimming the snow. A hard carve at speed throws a real rooster tail; clean landings slump heavy
    billows to the sides that travel with the sled. The desktop title cranes from a wide shot of the
    world into the hero shot. Reduced motion turns all the new motion off.
115. **The near world is painted, not plain.** Drift dunes and pillowed treeline mounds exist only
    past FOREST_LIMIT and never lower the snow, so the sim's ground and every placed prop stay honest;
    everything inside the corridor (a packed centre lane with old runner tracks, sastrugi patches,
    broad warm and cool tone patches, round pin-point glints) is shader-only. Pines are drooping,
    scalloped bough tiers with ragged snow caps and a tree well, the hazard pine included, about 230
    triangles each. A low mist settles on the course floor ahead, the fog warms toward the sun, hazards
    darken at their foot, and a gentle filmic split tone separates lit snow from shade.
116. **A shadow's softness is graded, not switched.** The snow judged how far a shadow's caster stood
    by asking the shadow map once, 7 m nearer the light; on a lone caster's long shadow that flipped
    the penumbra and the thinning at one line, a pale band cut square across it. It now asks at four
    steps between 1.5 and 9.5 m, dithered per pixel, for the same number of reads.
117. **The banks open now and then.** Stretches of 120 to 300 m (about one or two a kilometre, the
    first by 600 m, preferring cruise, benches and switchbacks, 120 m clear of every set piece's ends
    in every mood and clear of lift lines) are overlooks. On the valley side the forest stands back, a
    timber rail marks the forest limit, a snow shelf runs to a cornice, and past edge excess 25 m the
    terrain rolls over and falls about 100 m; the mid-ground carries the fall on, with a lower far
    wall. One in five is a ridge, open both ways. Nothing inside 25 m moves, so the corridor, the banks
    and the dressing stand on the sim's ground. The sim's own bank is 9.5 m high at the forest limit,
    so from the chase lens what opens is the sky over the rail and the long view down the fall line,
    not the valley floor; the lens leans 0.12 rad toward the open side, with a 3.2 s reveal as it
    opens. Fleeing animals pull up at the lip. The plan does not depend on the mood, so a mood never
    rebuilds the terrain.
118. **The course changes character: villages to ride through, and runs under a roof.** Every 1.5 to
    2.5 km the run becomes a village's street for 150 to 250 m (`town.ts`): houses, shops, a church or
    temple and a hotel face the run from 13.6 m past its edge, a dense crowd lines both crests and does
    the wave, and strings and banners hang across from tall masts. Anything over the run clears the
    highest air there by 6 m, from `airProfile`, which bins the same flights as `airCeiling` every 2 m.
    Kickers fly 30 to 70 m and bump pops about 20 m, so masts stand tall and an enclosed run (gallery,
    ice tunnel, lava tunnel, torii corridor) can only go where nothing launches under it: about once
    per 7 km per mountain, the rule kept rather than the frequency. Inside, the post darkens the
    frame's edges, strobes past the pillars and flashes on the way out. The figure was cut to 310
    triangles to pay for the crowd. Villages plan round lift lines, since a tower cannot be dropped
    from a line; enclosures need not (they stand within 23 m, and the one overlap in 12 km of the
    mountains is a lift 37 m out).
119. **One gate keeps the dressing out of set pieces.** `Props.siteKeep` (set pieces) is ground nothing
    stands on, `Props.siteClearings` (overlooks) only keeps the forest back, so a shelf keeps its hut.
    The dresser checks each piece by its position at one `put`, not in its four placement passes, and a
    cabin dropped there drops its chimney smoke too (`SetPieces.keeps`). Clearings now apply on Low,
    which is what let overlooks open there.
120. **The world is heard.** A soundscape reads the world each run frame (`World.listenSources`, then
    `listen.ts`) as a few numbers: the nearest crowd, flock, lift line and village, how exposed and how
    enclosed the rider is, the camera's vista and an overlook's openness. Those move a fixed graph
    built once and unplugged while silent; places are keyed by kind, so a new kind needs one line.
    Every one-shot is a seeded take synthesized in JS in sliced steps and played as one buffer source
    into eight long-lived lanes. A cruise costs about 1.2 nodes/s on High and 0.1 on Low, which hears
    only birds, wind and the mood's bed. Alone it sits about 10 dB under the band; the mix rises 0.5 dB
    on average and up to 2 dB at a crowd, with peaks under -7.5 dBFS. Its node budget is tested on the
    mean of seeded cruises: the ambient calls are random, and one sample failed one full run in five.
121. **The moments the player watches every second are made, not only marked.** A gift is a rounded,
    striped, foil-glinting box with a satin ribbon painted into its wrap; a pickup squashes and pops
    with confetti, coins and a flare, and gifts ahead glint so a line reads as a trail. A pass shatters
    the ghost into glass petals that burst level with the rider and fall back, never above the lens or
    over the rider (C10). The ghost you draft lays its slipstream on the snow as a sheet with chevrons,
    in the existing runner-line mesh. A stomp's shockwave lives in the crater decal. The rider's weight
    shift, absorption, balance and tuck run on springs on the CPU. Draw calls are unchanged at rest; the
    pop meshes draw only while popping.
122. **The air is alive, and every mood has its own light.** The dome paints crepuscular rays, clouds
    that change as they drift, a 22 degree halo with sun dogs (Glass Ice, and round the moon in Haunted
    Hollow), shooting stars, a richer aurora and a bigger comet, all in its existing pass. The panorama
    takes sweeping cloud shadows and, every half minute or so, a distant avalanche down the hero's
    face; the plume quad flies a spindrift banner off the other summits and forks with lightning at
    night on Ember. One world-anchored draw of mist lies in the valleys below the run. A lens streak and
    ghosts show only while the sun's disc is open to the lens. Blizzard gusts sweep curtains of snow,
    Powder Day and Glass Ice glitter, and a per-mood light pass lifts the frame round its key light, as
    a value shift only, so the colour roles hold.
123. **Far things cost less, and the throttled chase stays where it was.** Past three chunks (two on
    Low) the forest and gifts draw far builds, wall and far-row trees share one batch, variant batches
    narrow their draw range to the picks in view, and signature bank pieces became their own batch. It
    pays for the round's additions on triangles but not for the 4x-throttled avalanche chase, whose
    cost is mostly per-draw CPU and the mirror. The auto tier's windows are now time-based and a tier
    left for running long is not returned to, so a machine that cannot carry the new world leaves High
    sooner (README has the measured figures).
124. **Ash is for Ember's own dusk.** Falling ash ran in every mood on Ember Peak, and against Glass
    Ice's bright sky the dark flakes read as dirt on the lens. It now falls in Clear Skies and Comet
    Night, a third as dense and paler; Glass Ice gets diamond dust there.

## Made in the wow pass

125. **The descent is written, not dealt.** A course was a deck of sections drawn at random for as long
    as a run lasted. It is now a fixed 4.5 km in three stages, each mountain's written as three acts of
    beats (`SCRIPTS`). The seed picks alternatives, shuffles beats inside a block and draws lengths inside
    each kind's range, so every course keeps its planned rhythm and no two dailies match; a daily also
    deals its biome's three acts in the seed's order. Beats that overflow a stage move to the next, and
    a stage that falls short takes the next stage's first beat or a filler, so a section boundary always
    lands on a stage line (over 200 dailies). A descent is retried until it meets `legalPair` and holds
    its signature kinds; the authored order always does. The first minute is the same everywhere: the
    0.5 start ramp, a wide run-in with a swinging gift line, a small kicker at about 300 m, a first leap
    at 590 to 670 m, a first place by 900. `rampDistance` is now the finish.
126. **A section carries its own numbers, and the line blends in metres.** Sections now hold their own
    shape and blend, so a ravine can come in over 90 m and a body can be measured from z0 + blend. `pin`
    says how much of the plain corridor a section replaces, which makes authored widths exact and lets
    them pass the old hs + 3 cap (only the lake needs to). `split` and `span` stayed shares, but the safe
    line reads them as metres (`shift`, `reach`) worked out once per section: as shares of a width that
    was itself blending they multiplied into a bend at the blend's end, 0.0239 against the 0.018 limit.
    The limit is unchanged, and steep ground now has a tighter one of 0.0135.
127. **A ledge is one thing, in baseY.** A leap's cliff, a terrace's step and a lake's outlet are the
    same piece: a brow, a face and what the ground does next. The ground stays down because each section
    carries the metres fallen above it. `terrain.ts` needed no change: a ledge adds a Drop of depth 0, which
    costs `ground` nothing and asks the terrain for its fine rows at the lip. (`landmarks.ts` and the bot
    read that drop too, and both are right to: it is a drop.)
128. **A leap's landing cannot be soft, so it is steep.** Nothing lands softer than a free fall off the
    cliff, sqrt(2 g h): 15 m/s off 12 m, 22 off 25, whatever the shape below. What a shape can do is keep
    the ground falling under the sled and hold every speed near that floor. A lip slope of 0.27 and a face
    that steepens from about 0.3 to 0.8 over 100 m does: at 18 to 44 m/s every landing is on 0.35 to 0.8
    of slope, at no worse than that floor plus 1 m/s. It suits the sim, which pays speed for a landing on a
    falling slope. It is expensive in height, about 65 m a leap and 200 m a descent, and in length: a
    leap's section runs 220 m past the lip, the 44 m/s flight coming down at about 175 m. Cliffs start at
    13.5 m because 12.6 m gave 1.98 s at 28 m/s on the real sim, and the promise is 2.
129. **A flight needs a straight line under it.** A flight is straight, and a line bending by only 0.0005
    is 9 m away by the end of 190 m. Leaps and terraces freeze the bend's phase and drop the line's own
    wander, so a sled comes down on the line (within 1.5 m at every speed). An on-line kicker only stands
    where the line holds within 3.6 m of its flight. Landing zones stay clear 40 m past the section, since
    a sled that spun drifts about 10 m in the air and lands wide at full speed.
130. **Kickers fly by what they are for.** A ramp's lift is speed times face slope, so at the new cruise
    the faces were cut from their height. Each face is now solved for the flight it should give at 30 m/s,
    over the real ground (ripple at the lip alone moves a flight by 9 m) and a tenth long, since a real
    sled sheds speed on the face. On the sim they land 40 to 66 m out, and landing boxes run 1.5 times the
    flight. Most riders never jumped because every kicker stood off the line, so the script now puts them
    on it where the landing runs clear, ravines and fork channels included. Moguls and kickers keep apart:
    a field that landed on a kicker threw the sled before the lip, and flew it 77 m.
131. **The fork's risk route is ice.** Two channels 9 m either side of a 3.2 m ridge. `altX` is the line
    `safeX` did not take; it has an ice strip with drag 0.25, gold gifts and two or three obstacles, no
    promised lane, and saves 1.6 to 1.9 s from 30 m/s (by the sim's drag, on the four mountains). `backX`
    names the channel a sled belongs to and equals `centerX` outside a fork. Steeper troughs were
    the other idea, but a trough has to climb back out to rejoin and pays nothing.
132. **Places keep the world out, and open ground gets it.** Ravines have no obstacles: their walls are
    the hazard, and a rock at a wall's foot kills the sled the wall has just turned back. What used to
    spread over a whole course now gathers on the quarter that is open. Vents also take ravines and forks,
    and every bowl has an authored mogul field. Scattered drops all but went: a dip with 120 m of recovery
    rarely fits, and the ledges have taken over their job. Ember holds only a couple of off-line kickers,
    its open ground being scarce, and its 21 vents stand in for them.
133. **Rails go where a rider is.** Along streets and tree runs and by lakes, 3.4 to 4.6 m off the line.
    Frostfang and Ember have too little of that, so a stage short of them takes open sections next and
    then bridges, ravines, tunnels and forks: a bridge's rail is a grindable parapet. Rails are never
    colliders, so they only keep obstacles out of their own footprint.
134. **`shapeAt` has two entries.** `ground()` now reads the shape on every call, and the terrain's rows
    alternate z and z + 0.25, which missed a one-entry memo every time: `ground()` cost 55% more.
    Two entries, and a body that needs no copying, bring it back level with the old cost.
135. **Every mountain has its own Clear Skies, and the chaos moods never see them.** Pinecrest, Frostfang
    and Sakura were one lilac-pink sunset, with the sun low and dead centre; Ember was a redder copy.
    Each now has its own light, palette and sun bearing: a bright ski day, polar blue hour, under ash, a
    spring morning (ART.md section 7). They live in `clearSkies()`, over `biomeBase()` rather than in
    it, because every chaos mood is built on `biomeBase()` and keeps whatever it does not set: repainting
    the base would have repainted all six. Every new field defaults to the old look. All 24 mountain and
    mood palettes were diffed against the pre-pass build, field by field, and none changed.
136. **The journey is one table, per mountain, in metres.** The shared ALPENGLOW and BLUE_HOUR stops are
    gone, with their offsets and the 3.4 and 17 degree floors hard-coded beside them. `JOURNEY` in
    palette.ts holds every stop of every mountain, each a `from`, an `at` and an edit on the stop before,
    so retuning for a new run length touches one table. Stops place the sun absolutely, which lets a sun
    rise (Sakura) as well as set. The floor is now a test: the key light stays at 17 degrees or more at
    every stop (decision 27). The soundscape's dusk reads the same table (`journeyDusk`) instead of
    repeating its old distances, so the bell keeps following the light. This replaces the distances in
    decision 103; its rules stand (keyed off distance, re-blended only while the light moves, the title
    at the start, chaos moods untouched).
137. **Clear Skies pins the hero.** The hero stood opposite the sun, chosen from the sun's side every
    time the palette was applied, so a sun crossing the fall line would have thrown the mountain across
    the sky mid-run. `massif.heroAz` now pins it per mountain. It is 0 in the chaos moods, which keep the
    old rule.
138. **The silhouette belongs to the mountain, in every mood.** Each hero was reshaped (a crown of three
    summits, a needle that curves over like a tooth, a wide cone with its rim blown out toward the lens,
    one long-skirted cone) and each mountain's ranges got their own height, sharpness and grain, so
    Frostfang stands in needles and Sakura's cone stands alone over soft hills. This is the one thing the
    chaos moods do pick up: a mountain does not change shape with the weather. Their colours and light
    stay exactly as they were.
139. **The horizon band is not the horizon.** A lemon `skyHorizon` turned Frostfang's far ranges and its
    glazed corridor olive-grey, because that colour also feeds the haze, the sea of clouds and the ice's
    sky mirror. The bright band low on the sky is now its own `skyBand`, so the lemon is in the sky alone.
    Likewise `sunCore` and `sunTint` colour the disc and its corona, because Ember's snow takes the key
    light's full colour: an orange key turned the snow to sand, so the key stays close to neutral and the
    orange is in the disc and the sky. Warmth in the sky, ash on the ground, and the vermillion and the
    marigold still stand out.
140. **The smoke deck is part of the dome.** Ember's overcast is painted in the sky's existing pass, with
    no new draw on any tier: billows on a ceiling, lit from below toward the volcano, costing two noise
    samples on Low and six on Medium and High, and only while `deck.k` is over 0. Clear Skies keeps
    `massif.lava` under the 0.75 that wakes the night moods' lightning, so nothing strobes on a plain
    run. Under reduced motion the deck and Frostfang's aurora hold still on Clear Skies (`Sky.setStill`):
    they are decorative loops this pass brought to plain runs. The chaos moods keep their own motion.
141. **Late light has to reach baked colours some other way.** Props and the mid-ground bake their start
    colours and take the journey only through shared uniforms, so a stop must never recolour `tall` or
    `low`: Frostfang's night dims hazards with `hazardDim` and cools its key light so the town's walls go
    down with the sky. Frostfang's `stars` start at 0.55 because the set pieces read over 0.5 as a night
    palette, which lights its windows from the first frame of its blue hour. Sakura's `snowDeep` leans
    pink because shaded props take that tint, and periwinkle turned shaded blossom to a dusty mauve. Its
    late sky leans blue because a greener one came close enough to the ghosts' mint to lose them in the
    air; a test now holds every sky at every stop clear of mint.
142. **A hero stops at the sea of clouds.** The panorama draws before the world, so a wide skirt under the
    sea is shaded and then painted over. Widening Sakura's cone to a 4.3 km radius brought that skirt
    within 100 m of the lens and cost about 11% at 2560x1440. `HERO_REACH` now ends each patch just under
    the sea, near the ranges' own feet; the silhouette does not change, the rows left sit closer
    together, and Sakura matched the old build's best again. The one net draw this pass adds is
    Frostfang's village halos, which its low sun lights from the start (Medium and High, and only with
    a village in view). Two lessons for reading these numbers: 60 fps is the vsync ceiling, so compare
    cost off it and interleaved (A, B, B, A), because a before-then-after run measured a 25% drop on
    every mountain that was not there; and compare draw calls at the same distance from a clean save,
    because two builds on two ports keep different saves and so race different ghosts.
143. **A run is a descent with a goal, and the race is by time (replaces decision 38).** Finish it,
    or wreck trying. Finishers rank by finish time, then riders who did not finish rank by distance.
    Distance is max z, so everyone over the line ties on it: `standing.ts` is the one order, and every
    comparator, row and line of copy goes through it. A row reads in its own terms ("2:31.4" for a
    finisher, "3,212 m" for the rest), and a margin is the difference of the two rows as they read
    ("1.2 s", "85 m"). A time and a distance share no unit, so a finisher over a rider who did not
    finish is "to the finish" ("Mila beat you to the finish", "1,288 m short of the finish"), never an
    invented number. A dead heat gives nobody the lead. The rest of decision 38 stands: Beat stamps
    on the rows you finished ahead of, a Next tag, the windowed list, no Passed stamps.
144. **A finish is not a crash.** The `finish` beat ends the race and opens its own door
    (`crossedLine`), never `crashed()`: no crash beat, no revive, no cause. The sim ticks on through the
    coast (phase 'finished'), the banner holds the time and place, and the results open 3 s later, or
    on a tap from 500 ms in (so a press held over from the last jump never skips by accident). The run
    is saved on the line and again when the card opens, with the coast in it. A live record's header
    carries the finish in `ticks` (its log runs on), so a link says when its rider finished without a
    replay. The finished card leads with the time, then place, medal, your best and the style score,
    then the splits; a wreck keeps its card.
145. **A ghost over the line has left the race, and it won.** It stays ahead wherever it stopped, and
    rolling past where it stands is no pass: no gifts, no unlock credit, no choir, no slipstream, no
    rival pill, no grudge settled. A ghost reaching the line mid duel is a lost duel ("Mila finished
    first"), where a wreck is a won one. Your place on the line counts only the ghosts already over it,
    so the coast cannot change it. The worker reports `finishTick` and `stageTicks`, and `crashTick`
    stays the only way into the wreck path. Graveyards take crashes only: a line of finishers is no
    place of the dead.
146. **The field is built around when you would finish (replaces decision 77).** The anchor is your
    predicted time: the median of your last five, a finish or a pace carried to the line, or 1.1 times
    the last when that is quicker; a new mountain reads 1.1 times your others; with no runs, a mid-pack
    time from the pool. An opener in 1.05 to 1.22 A, two pack ghosts around you, pace in 0.88 to
    0.97 A, a stretch rider in 0.75 to 0.9 A. Spacing is 1 s on the clock, and 25 m only between two
    who crashed: spaced by distance, every finisher looks like one rider. Pace and stretch no longer
    need to be long runners: on a course with a line, a time says what a distance could not. The
    pool needs `finishTick`: the bot rides on past the line, so a finisher's `ticks` is no finish time.
147. **Your best is your best run in race order.** It is the ghost you race, and it is measured
    against the best you started with, so saving a run twice settles the same way. A finish beats
    any distance, on any score, and a dead heat keeps the higher score. Your highest style score is
    kept apart (`topScore`), so 'New best score' still means what it says. A best that finished is a
    time: its band, 'Best in 240 m' and 'New ground' stand down.
148. **Medals are times, and every one stays reachable.** Bronze beats 60% of the pool's way down,
    silver 30%, gold 10%, on predicted times, and only a finish earns one. Each sits at least 1 s
    under the last, so a pool of ties still has three to reach: on distance, finishers tying set
    silver and gold past the end of the course. Every mountain's finish shows its medal; the Daily
    alone puts it on the save.
149. **A new course is a clean break that erases nothing.** A best or grudge whose replay cannot ride
    moves, exactly as it was, to `archive` (never pruned, never rewritten, idempotent; a second record
    under a taken key gets `key#2`). The best's slot clears, so a stale score blocks nothing, and the
    card shows 'Old best' until a new one exists. A grudge keeps its name and tally and claims no
    rematch, and electing over it keeps its tally. `runDists` stays on the save and feeds nothing:
    predicted times live in `runTimes`. Daily medal, streak and last day, gifts, sleds, stats, passes and
    missions are untouched. This supersedes the part of decision 26 that kept a stale score in place.
150. **An old challenge link is a target, not an error.** Bytes 0 to 27 of a record keep their layout,
    so a header-only reader still says whose run it was, where and how far. It opens on its mountain
    with 'Mila rode 2,340 m on the old Pinecrest. Beat it.', a friend band at that distance (clamped to
    the finish) and `friendBeaten` when you pass it. No toast, and no ghost, so never a rematch.
151. **A wipeout is one short line.** 'Wipeout' on the free stretch, 'Wipeout. 1 left' after it, and
    pips from the moment the first is spent (until then there is nothing to count). No banner, no
    results. A tumble teaches nothing: no hint shows while you roll, airborne or not.
152. **The clock leads the left block.** Clock, then distance a step quieter, then a thin stage line
    ('Stage 2 of 3', one hairline a stage). On a phone they share the row under the score, so the top
    HUD is no taller; for a countdown's 400 m the distance and the stage's words step out for its chip. A stage line is a
    banner over the race row: the stage, the clock, and the split in the race-gap grammar, a number and
    a word in the rider's colour ('1.2 s behind Mila', '0.8 s ahead of your best'), never a bare sign.
    The split is against the ghost just ahead there, or in the lead the one just behind; your best has
    its own figure. Splits are the clock at each line, the same on the banner and the card.
153. **The first minute is taught in order, and nothing waits for a miss.** Steer at once; on the first
    kicker in reach 'Hold, release at the lip', which takes the slot even from a rider who has not
    steered; the ring on that flight; the air on the first leap after it, once the ring has shown
    rather than once a stomp has landed. The drift nag keeps off a first run until 800 m. Kickers are
    read from `zones.ramps`, whoever put them there, within 3 m of a rider's reach. This relaxes
    decision 87's air lesson to 1.7 s left to land.
154. **Missions fit the course.** Every distance target is capped at the finish, so no slot can stick
    on a ride that does not exist. New: finish a mountain, finish with no wipeouts (a free one counts
    against it), ride a wall, grind rails, finish under 3:30, 3:05 and 2:40. The times are three flat
    missions rather than a growing one: a slower finish is no progress toward a faster one.
155. **Speed reads off one range.** Cruise rose to about 30 m/s with peaks at 41 to 46, and the FOV was
    full at 36, the rumble at 38, the near field at 36, the streaks at 44: a run sat on the end stop.
    Every curve now reads off `src/render/speedfeel.ts`: `fastK` is 0.6 by 28 m/s (already fast) and only
    reaches 1 at the cap, and a test holds every curve still climbing between 44 and 46. FOV 62 to 79,
    streaks from 24, rumble from 22 to 0.03 m, and from 36 the horizon shivers and the corners close in.
    Flakes are hung half a second ahead of the lens (a fixed 16 m was gone in a third of a second) and a
    flake the lens has passed gives its slot back, so density rises with speed where it used to fall.
156. **The lens rises with speed, and height is read against the slope.** At 1.05 m over the sled, 4.5 m
    up a falling slope, the lens rode about 0.45 m over the snow: the road from 25 m on was a few rows of
    pixels hidden behind the rider, and that was the real hazard read at speed (usable road 24 m at 30
    m/s and at 44). The lens now stands 1.5 to 1.7 m clear of the slope from 28 m/s, the rider sinks to
    about 65% of the height and the look turns toward the road 1.5 s ahead. Measured by
    `scripts/playtest/readability.js` at 720p on all four mountains: usable road 73 to 74 m at 30 m/s (2.4 s) and 65 to 66 m at 44 (1.5 s); a 6.5 m tree 45 m ahead stands
    60 to 63 px and 55 to 57 px (62 and 57 before: the wider FOV is paid for by the closer lens); the
    rider 118 to 127 px and 87 to 103 px (131 and 100 before). A crest can still hide the road for a moment:
    the worst sample was 27 m at 30 and 8 m at 44, on Sakura's rollers. Lag stays at
    speed / 9 so a boost still surges away from the lens; the set point closes in to pay for it, which
    keeps the rider from shrinking further than it did.
157. **Speed posts are markers, never hazards and never colliders.** One instanced draw on Medium and
    High, none on Low: stakes, banded poles, slalom flags and roped fence posts, 0.8 to 3 m past each
    edge and 10 to 18 m apart, chosen per 96 m stretch and per biome. The sim never hears of them. They
    read the corridor through centerX, halfWidth, edgeExcess and edgeLimit and the ground, so a ravine, a
    bridge or a street needs no change here: a post stops short of something solid and none stands where
    the ground past the edge falls away. Pale and slim with a little light of their own: backlit by a
    low sun a plain stick dropped to the hazards' dark. They fold into the snow inside about 2 m of the
    rider, and stay out of the avalanche mirror.
158. **The snow reads speed close up.** Kicked snow comes off the runners keeping about 70% of the sled's
    speed, so it falls back past the lens's lower corners, the one thing allowed nearer than a flake. A
    rooster tail stands half as high again at the cap as at 28 m/s, and a groove's broken edges run
    along an arc length divided by speed, so a fast line reads as long streaks. The near field's budget
    rose from 520 to 780 points on High and 260 to 400 on Medium, still one draw and none on Low.
159. **The picture acts out what the sim decides, and reads it from public state.** `src/render/moments.ts`
    reads s.tumble, s.grinding, s.wallTicks and s.finished and the beat list; nothing is written back. A
    tumble rolls the whole rig twice (a whole number, so it lands upright) with the lens eased out and
    up; a tumble's bounce is not air, so it gets no vista and no landing ring. Reduced motion curls the
    rider up with no spin, no swing and no ease; every beat still lands. On a rail the sled turns off
    the line with sparks in the player's own ramp. Courses have no rails on this branch, so the pose and
    sparks were checked on a rail put into a zone by the strip script, and nothing draws a rail yet.
160. **The finish eases the picture, not the sim.** Past the line the world records the coast the sim is
    already running and plays it back through a clock that dips to 0.38 and returns over about 2 s, so
    it ends on the same spot a little later, with no change to the sim, the feed or the game clock. The
    lens swings to a three-quarter front at 60 degrees with the rider low in the frame: aimed straight at
    the rider it saw only the snow it came down, and every shell burst over the top of the frame. Shells
    are placed from the lens as they go up, so they land in whatever sky it sees, chase or swung, with a
    square or without one. They are dabs of gouache (a billow's shading, allowed to hang far from the
    rider and paint large). The game lane still has to open the results off the finish beat; the shot
    holds until it does, and moves the rider aside for the card. Reduced motion takes none of it: the
    chase follows the rider to a stop, arms up, and the shells still burst.
161. **The world answers skill in the world.** A stomp or a big landing near a bank sheds a slough
    (`src/render/sloughs.ts`, 56 lumps, one draw while one slides, Medium and High), started ahead of the
    sled so the lens sees it come down, and only off a real bank. A max drift, a shown pass and 'In the
    flow' lift the crowds' roar, a uniform on the one crowd draw. `grudgeSettled` shakes powder off the
    treeline, sends snow down both banks and rings in rose; `Duel won` does the same on the ghost's side.
    Crows take a stomp as they always did: scaring them on a grudge would need a change in life.ts.
162. **The band builds down the mountain.** The drive takes +0.07 and +0.15 per stage and +0.13 over the
    last stage's climb to the line, so a plain cruise goes from bass and hats through the arp into the
    kick; skill still owns the clap, sparkle and lead until the climb brings them in part way. The band
    quickens 2.5% then 5% on bar lines, the last stage thickens the bass and hats and lifts a whole tone
    on a chord change. The lift is decided half a bar ahead, with the next pad, or the pad would ring in
    the old key under the new one. A stomp streak of 3 or more or earned flow opens the band up: upper
    layers over the drive, every second arp note an octave over itself, wider pads and a wider room.
    The finish cue resolves onto a bright chord as the results deck comes up under it, in the key the
    band climbed to. All of it is voices and a fixed graph: nothing is rendered in a run, on any tier.
    The `descent` probe (`debugRender('descent')`) reads the music bus at a plain cruise: -25.1, -24.0,
    -22.7 and at the line -21.3 dBFS, 3, 4, 4 and 7 layers; opened up, +2 dB and +3 dB over 2 kHz. None of
    it has been heard.
163. **Perf probes on two origins compare two saves.** A build served on a port that has run strips keeps
    a save with a best, a grudge and a friend, and their ghosts' tags cost five times what a fresh save's
    do: it read as a 25% loss on throttled Low, and two rounds of changes were wrong before a variant on a
    fresh port gave it away. Clear localStorage on each origin, and clear any `emulateMedia` left on the
    session: a reduced-motion strip leaves the whole page reduced for every probe after it.
164. **Bare ground comes from what made it.** Slope alone cannot say where rock goes: a plain bank's foot
    reaches 1.6, as steep as a ravine's, and must stay snow. So `rockWeight` (ground.ts) reads the shape:
    a wall from its foot to its crest, the fork's ridge, a bridge's gorge and a ledge's face, the last
    from the down-run slope, which nothing else on a course reaches (a kicker's built wall is excluded by
    name). It rides a per-vertex attribute, as the kicker weights do, and the shader draws it in cells:
    a few hashes a pixel and no search, because a Voronoi over a third of the screen was the obvious way
    and the wrong cost. Pixels that are all rock skip the snow's dunes, ripples and sastrugi, which pays
    for most of it. Colours are per mountain in materials.ts, chosen by `massif.peak`, so a mood's light
    falls on them without touching palette.ts.
165. **Past its limit a wall may leave the sim's ground.** A sled is turned back at `edgeLimit`, so what
    stands past it is the painter's. `rampart` raises the wall from the limit up, using noise that is
    flat on every triangle of a coarse lattice, so a fine mesh draws planes and creases where smooth
    noise drew a hill, and the crest is jagged against the sky. Inside the limit the mesh is the sim's
    to the millimetre, and a test holds it there. The terrain casts no shadow, so the wall's own shadow
    on the floor is worked out in the shader from the height of the crest across from it: no pass,
    and on Low too. It stops at 72% of the light, or Frostfang's low sun leaves the floor one flat blue.
166. **A lake mirrors a picture, not a pass.** The sky and the peaks follow the lens, so they are as good
    as at infinity and one picture holds for any lens on the lake. `LakeMirror` draws them into a
    768 by 200 target looking down the fall line when a lake is within 480 m and every 3.5 s while one
    is near, and the shader looks its reflected ray up in it. A real mirror pass would have redrawn the
    sky every frame for one section. Everything near is worked out from the ray instead: the banks and
    treeline from where it crosses their plane, and the rider from how close it passes an upright figure
    at uFocus, so the reflection falls where a reflection falls and leaves the ice with an airborne sled,
    for no draw at all. Without a bake (the first frames, a lost target) it falls back on the
    procedural ridge line Glass Ice uses, which is the same path. Low keeps the mirror, the near
    cracks and the blown snow and drops the long fractures, the deep layer, the bubbles and the wisps:
    those were a third more on a Low lake at 1440p.
167. **One draw furnishes the course, on every tier.** Rails needed a draw on Low, and Low has no
    dressing at all, so its leaps and forks had nothing to read by. `Rails` is one variant set holding
    the rail lengths, flags, shoulders, cornices and both forms of the fork's gantry: +1 draw in the scene
    and +1 in the shadow pass, where there is one. A variant set runs every variant's vertices for every
    instance, so the kit is kept small and the gantries sit last, outside the draw range away from a fork. A rail is laid in short lengths along what the sim
    grinds (rising over its first third, then level with the ground), because the bar has to meet the
    sled. Everything is laid as it comes into range: reading the ground builds a chunk's zones.
168. **The fork's sign is a gantry.** The split's post stands on the centre line, and from 150 m that is
    exactly behind the rider's head: it was there and could not be seen. Boards high over each channel
    read either side of the rider instead. Bold is a dark board with a white diamond, the skier's
    own word for it, and a marigold band, because marigold means gifts and the gifts are down there.
169. **At a ledge the terrain goes to the mid-ground, not the other way.** The mid-ground's rows are 16 m
    apart and a ledge steps 15 to 25 m in 4, so between two rows the two surfaces parted by half the step
    and the mid-ground's edge stood out of the terrain as a wedge. Refining the rows would have cost a
    ring buffer's worth of memory for a few metres of course. Instead, on those rows only, the terrain's
    columns ease from 24 m past the edge onto the straight line between the two rows, and a prop
    reads `visualGround` to stand on what is drawn. Past 24 m nobody rides.
170. **A leap's landing is groomed, not marked.** The face had nothing to judge from the air, and decision
    84 allows one painted mark. Corduroy and broad swaths are what a groomer leaves, so they are
    snow, with flags down both sides for the scale.
171. **Trees and dressing ask if they can stand.** `standable` keeps them off walls and ledge faces; a
    wall's forest stands behind its crest, a tree run's wall closes to its own limit with a taller rank
    behind it, and everything past the corridor stands on `visualGround`. Life's animals still stand on
    the sim's ground: that file is not this lane's, and one on a ravine's rampart will stand in rock.
172. **Overlooks keep to open ground.** They were allowed into any section but a gully, which on the new
    course put them beside walls and kerbs. They now keep out of every narrow place and every ledge's
    section. That leaves two to four a descent rather than one or two a kilometre: open ground is about a
    quarter of a run and set pieces take some of it. The test now says so.
173. **A ghost that finished is not a wreck.** `GhostPose.done` says only that a track has ended, and the
    game's side is another lane's, so the render tells the two apart by where the track ended: at the
    finish line it rode home. It coasts on into the square and fades, with no poof and no lantern.
174. **A mountain is a ladder, and you are on it.** Its pool, in race order, is a rank to climb, and
    your rank is your best run's: every rider ahead of you in `standing.ts`'s one order, plus one. A
    rider who has not finished sits below every finisher, and a dead heat leaves you level. The ladder
    has you on it, so 36 riders make 'Rank 19 of 37', not '36': the last place is a real place, and
    'Rank 37 of 36' is what the shorter figure would have said there. No run is no rank. The name above
    you and what to beat is always in sight ('Next: SparkleCedar, 2:11.4, 1.6 s up'): a rider who has
    not finished gets the name and the time alone, because a time and a distance share no unit. A rung
    pays 5 gifts once, the top pays 100 and says so, and the card shows it from then on, in gold-white
    with the trophy. The Daily and the Cup have no ladder: ten riders is a field, not a climb.
175. **Stage medals are kinder than the whole run's, on purpose.** Gold is the pool's median on that
    stage, silver its 85th percentile, bronze its slowest with a quarter in hand, each 1 s under the
    last. A rider who cannot hold a descent together can still gold Stage 1, and on Pinecrest a stage
    gold (0:46.1) comes well before a whole-run bronze (2:16.6). A wreck earns them too: a stage is
    finished at its line. They are graded as the clock reads them, so 0:46.14 is gold at a 0:46.1
    line and no card can disagree with its figure. A stage pays 10, 15 and 25 and the whole run 20, 30
    and 50, each once (a first gold pays all three). A whole mountain is worth 530 gifts.
176. **What a run earns pays once, by value.** A `Climb` holds a rung, a top, and a medal per stage
    and for the run, and only ever rises. What it has earned has a value in gifts, and settling
    pays the change in that value, so the coast and a revive's second crash cost nothing to get right.
    With no Climb yet, the rank your best already holds is where it starts: an old save is neither
    paid for a rank it never climbed on this screen nor told 'Beat X and 17 more' on a run that beat
    nobody. A Climb names its sim version, so a new course moves it to the archive whole (149), and
    the save only takes one once a run has earned something.
177. **Splits come from replaying the records.** `npm run generate-ghosts` now writes each ghost's
    `stageTicks`, and `-- --splits` adds them to the pools on disk from a replay of each record, about
    a second a pool, with no call into `src/bot`: replaying is what the worker does, so the medals rest
    on exactly what the race shows. Regenerating the bundled pools is byte-identical but for the new
    field. A pool without splits has no stage medals and nothing breaks; a test holds every bundled
    pool to them. The Daily's and Cup's pools have none and need none.
178. **One rival for the run.** The rider Run Again promised, else the friend who challenged you, else
    your grudge, else the field ghost right ahead of you: the finisher just quicker than your anchor.
    Never your own best, which has its own figure. It takes the start-line call (over your best and
    the pace rider), it is the split on every stage line while it reached that line, and on the results
    it is what decided it ('You lost 2.1 s to Mila in Stage 2', or 'You took 2.1 s from Mila in
    Stage 2' if you won), the stage you lost or took most in, in the stages' own times. A race line
    can only say one thing, so a row folded past the first view opens every stage against your rival
    and, when it rode, your best: stage time here, the clock at each line in the splits row above.
179. **Run Again always names who is about to ride, so that rider has to ride.** An unbeaten friend,
    your grudge, else the ghost just ahead of you in this run ('Rematch'), else the next rider up the
    ladder ('Race', since you have not met), and at the very top your own best. 'Run Again' is left
    for a run with nobody to name. A name on the button is a promise: `pickField` seats a promised
    rider like a grudge, whatever the run's mood rolls, and it is the rival.
180. **The weekly Cup is the Daily's shape with a week's key.** Seed, mood, event and placement are
    pure functions of the ISO week (`cup.ts`), and needed nothing from the sim: a seed is all it reads of
    a mountain, so the game layer widens the mountain's id rather than teach the sim about weeks.
    A Cup always has a mood, because that is what makes the week a week. The field is the week's: no
    anchor of yours picks it, and your best joins after, since a pick keeps its distance from your
    best and that would move the field. The pool is the Daily's generation with its own worker, after
    the Daily's, so a phone runs one bot pool at a time. Best time and medal for the week, in the
    Daily's save shape, pruned as the Daily's are. No streak, and no ladder: a Cup is a week's best.
181. **The next-run hook is the race line, not a second line (extends 82).** Friend, the Daily or Cup
    medal, a settled grudge or a nemesis; then a rung missed by under 2 s, a stage gold missed by a
    second or less; the crash line, the event note; what decided it, standing in for the plain grudge
    line it says more than; the plain grudge line; and last today's Daily, with the streak on it. One
    slot, so a hook takes it or gives way.
182. **The ladder sits beside the card, not in it.** The results' first view was already full, and on
    a phone it may not get taller or busier. So the strip is the card's sibling: at the foot of the band
    contract C6 keeps over the card in portrait, under the wreck, and in the free corner on wide
    screens. The card is laid out as if it were not there. Short landscape has neither, so a second copy
    rides the mountain line. That copy also stays in the tree everywhere else, off screen, because
    the band sits outside the modal dialog where a screen reader never goes. On a phone the stage row
    goes under Missions, or it would push Missions out of a wreck's first view.
183. **On the title, the new things took old slots.** Ride's subline carries the name above you, which
    is more to the point there than the mountain's tagline. A card's second line is your rank (the
    locked cards still count ghosts), and four small discs ride its art. The Daily and the Cup share the
    Daily's row on a phone, each a name over its best, so the title is no taller; on wide screens the
    Cup stacks over it in free space. A fourth menu button takes the medal wall, a popover in the
    missions' slot. The landscape menu row may run into the empty column so it never wraps. Picking the
    Daily or the Cup now shows on its card and names it on Ride, which used to go on saying Pinecrest.
184. **A gold medal is marigold.** The medal's old amber sat so near its copper bronze that at 11 px
    the two were one disc. Gold now takes the art bible's marigold and bronze goes a shade darker, so
    a medal and a gift are the same good news, and your best's gold-white stays apart.
185. **The course's sections are the plan.** The old planners picked places on their own rules (a village
    every 1.5 to 2.5 km, an enclosure wherever nothing launched), tuned to a course that no longer
    exists. Now a `street` is a town, a `tunnel` an enclosure, a `bridge` a bridge and the `finish` the
    finish town, each at its section's real length; every leap gets a crowd and z = 0 a start. Where
    things stand is laid out once per course from sections and hashes, no flying needed, and is the
    same in every mood, so chunks and overlooks never wait for a flight. How high they stand is flown
    per mood, one site per idle job: `spanNeed`, `roofNeed` and `quiet` stay as the validators, and what
    cannot clear the air comes down (a span to a bank piece, a roof to its walls). Frostfang and Ember have
    no `street` in their scripts, so each keeps one town beside the run, in its longest open stretch.
186. **A street is measured from the limit, not the crest.** Everything hangs off `rail.limit`: the
    barrier 0.25 m past the sim's limit, where a sled is turned back, the crowd behind it, fronts 1.75 m
    behind that. So one layout is a street at a limit of 2 m and a town beside the run at 10. Houses are
    cut into the bank, floors at the snow under their fronts, because a level floor on the highest
    ground would put a ground floor 10 m over the street. The bank that holds them is the sim's, and
    the stepped rows of the crowd come free with it. Lots stand off the edge's nearest point: a lot is
    one straight block and in a blend the edge narrows under it. A window cost 60 triangles as boxes
    and costs about 20 as flat panels; a street holds hundreds of them and only their
    faces are seen. That paid for a second row of roofs: a street is 43 to 48k triangles against the
    old village's 55 to 72k.
187. **The finish town is built round where a sled stops.** A sled over the line runs on through the square on a long, easy brake (`Sim.coast`): it stops about
    130 m past the line from 30 m/s and 265 m from 46, on the run-out street if it came in flat out. The
    square itself runs from 72 m before the line to 118 m past it. The
    biggest crowd in the game is 560 animated figures (the instancing cap, unchanged) in the near two
    rows, and about 1,500 still ones baked into the stands: two boxes each, four faces a box, no draw of
    their own. The run-out street ends at a hall just past the end of RUN_OUT, standing across the
    corridor where no sled can reach. The finish town keeps a slot from as far off as it can be seen.
    It is 100 to 118k triangles. On this branch a finished run does not reach the results screen yet, so
    the stationary frame was checked from the chase lens at rest, not from the results' hero shot.
188. **A bridge cannot be hollow.** The corridor over a chasm is a ridge of ground: it falls 34 m past the
    edge, so nothing can stand under the deck. The rider cannot tell. From the lens the deck's own edge
    hides the floor out to about 70 m past it, so what says bridge is the rails, whipping past where the
    sim turns a sled back, and what rises past them: ribs, a truss. The legs under the deck rake out
    round the ridge, there for the rim and the air. For the same reason Ember's lava is a river running
    away across the chasm, not a pool under the deck, where it would never be seen. Styles exist for all
    four mountains, but only Frostfang and Ember have a `bridge` beat: Pinecrest's and Sakura's have
    never been drawn, and Sakura's overhead lacquered footbridge is the old `bridge` span.
189. **A roof follows the air.** The air over a tunnel is highest at its mouth (a pop from the steep ground
    above flies far over it: 27 to 33 m over the floor, falling to about 20 inside), so one roof height
    cleared by the mouth stood 33 to 40 m high all the way, or failed the old limit of 33 and came off.
    Each bay now clears its own air, the roof coming down at most 1.2 m a bay, and ENC_MAX applies at the
    mouth, at 42 m. A tunnel's mouth is rock masses of very different sizes round a great mass over the
    vault: even ones in rows, seen from outside, were the same honeycomb as the falls below. Low
    gravity still takes every roof off: Comet Night rides between walls, or an avenue of torii pillars.
190. **A lift line is a span with chairs.** It crosses at a height `spanNeed` sets, with a chair's drop on top,
    from a station on the bank to a tower on the far one and on up over two more. The chairs are a batch of
    their own, a few dozen matrices written a frame, Medium and High. The station stands where a tower
    would, tall where the air is high, so the line needs no tower on its own side. One goes just above
    the first leap on every mountain, one near the middle, on a bowl if it can.
191. **Overlooks are worked out first.** They keep 120 m from every piece, so filling every stretch to 300 m
    would have left none, and they are places too. So the plan asks the overlook plan where it would go
    against only what the sections fix, then fills round those. The real plan lands on the same
    stretches, since it looks in the same order and the pieces only take ground it had passed over.
    The longest bare stretch is 260 to 282 m on the four mountains, overlooks counted, in every mood.
    One thing that number hides: an overlook in a ravine is invisible behind its wall, so a ravine gets
    a span near its end, which leaves room for the overlook the test still asks for. (Five per 5 km.)
192. **The honeycomb was the frozen falls.** Its cliff was four rows of even crags in the ice material, and
    from anywhere near it those facets read as a blue lattice, worst behind a ravine's rim where it
    rears over the run. It is now long uneven strata in the plain material, with a fall of 26 fluted
    columns that is the palest thing in it, set further back and kept out of walled sections.
193. **Three slots, two shadows.** Sites come every 200 to 300 m now, so two piece meshes could not hold
    what is in view. A third adds a draw on every tier; only the nearest two cast, since the third is
    past the shadow map. What is behind the rider gives up its slot first, and sites stay made until
    they are behind, however many are ahead. Made on the frame only once idle time has opened, so a run's
    first frames make nothing. Windows light by the journey's dusk at the site's own distance, and
    lamplight pools at dusk at less than half of night's strength: at full strength on shaded snow
    they went pink.
    Measured against the build before, interleaved at the same distances: a street costs +3 draws on High
    (84 to 87), +1 on Medium and 0 to +1 on Low, and 150k, 110k and 19k more triangles, with the figure
    budget unchanged; the finish town costs no more draws on High or Medium, +1 to +2 on Low, and 220k,
    100k and 44k more triangles. Both builds sat on the 60 fps ceiling in the quiet runs, so those
    runs show it holds there, not what it costs under it.

194. **The sled runs out of its turn, and banks really are berms (SIM_VERSION 6).** Heading only ever changed by steering, and grip pins velocity to heading, so nothing could turn a sled back: a 2 s key hold ended the run at about 25 m after 5 s on three mountains. Let go now and the nose eases to the corridor's direction, leaning home only from the outer third of the width (at half the width a sled let go finished most mountains). Past the edge the wall turns the sled back, harder as it climbs, past the hands by about 6 m up. A held key carves to about 1 rad off the corridor's line and no further. In a fork all of this reads the channel the sled is in (`Course.backX`), never the ridge.
195. **A hit costs the run's time, and only the third ends it.** A hard hit is a 1.1 s tumble back to the safe line: the combo goes, the sled comes back at 55% of cruise. Every wipeout before 700 m is free, two are forgiven after that, and the next is the wreck the game was built around. Solid edges (`edgeLimit`) turn a sled back and never crash it. It needs no log event: the rule is the sim's, so ghosts replay it.
196. **Thirty is the new twenty-two.** Air drag fell from 0.0047 to 0.0027, so cruise is about 30 m/s on the base slope; the tuck, drift boosts and landings pay more of it; drafting fell from 2.6 to 1.5 m/s^2, or it would hold a pack at 43 m/s. Skilled riders now reach the 46 cap on steep faces. A landing on a falling slope turns the drop into speed, up to 8 m/s: what makes a cliff worth taking. Comet Night's drag falls with its gravity, so it keeps its cruise (it was the slowest mood by far at 16 m/s), and Glass Ice's grip rose from 0.62 to 0.68.
197. **A short flight never wrecks, and the rider sets for touchdown.** Only a flight of 0.75 s or more can crash a landing: nobody meant the rest. In the last 14 ticks steering stops adding spin and the sled swings to the nearest straight line. Stomp timing stays the skill, not surviving your own thumbs. This was the clumsy pilot's main killer.
198. **New moves come from the world, not a new button.** Up a wall at speed is a wall ride; a sled meeting a rail's low end rides it, and release pops off its end. Both hold the combo. One-button controls stay (decision 5).
199. **Hazards ask for the steering.** Obstacles had fallen to 14 to 24 a kilometre early on, about one every 1.7 s at speed, and a rider letting go finished every mountain but one. The base count doubles and pickets fill the corridor's middle past 900 m, so the safe line weaves. Hands off still finishes two mountains of four: tumbles are generous, and that rider comes last.
200. **A risk route is proved by riding it.** The first rides showed the fork's risk route cost time and a hit a run, where a drag model had promised 1.7 s: trees stood on the line in a 6 m strip, and riders spent 15 to 30% of it on the ice. The strip is 8.4 m wide, keeps clear of scatter, and its 3 or 4 obstacles alternate sides so a lane weaves through. It now saves up to 1.9 s, and mid-skill riders pay in hits (`forks.ts`). Bold bots ride it, so a ghost shows it exists.
201. **The race is run on what a player can catch.** On a 4.5 km course at 30 m/s a field spaced by finish time only drifts apart: passes fell for novice and stunt pilots, and a clumsy rider made none. Three things, none of them in the sim. Slow riders fill the race down to 5:00: a real finisher's run played at a steady slower pace, since a bot made to ride badly only crashes (`slowriders.ts`; weaving was tried and measured). The pack rides within about 4% of your pace. (A very first run goes further: 206.) And pool riders surge and fade around their own pace, about 17% either side of it, and still finish on their real time, so you trade places. Your best, a grudge and a friend are exact replays, always: those are promises.
202. **Every mountain has a town to ride through and every style of place is ridden.** The scripts left Frostfang and Ember with no street, so their towns still stood beside the run, the exact complaint. Frostfang gets a street and a tunnel, Ember a street, Pinecrest and Sakura a bridge. Once the scripts were full a third of Frostfang's dailies could not build at all, which would stop that mountain loading: an act's first place may only move up if what it leaves can meet, a dropped beat must leave a legal pair, and every deal of the acts is tried. 9,660 seeds, ten years of dailies among them, all build; a test holds 700.
203. **The clean break erases nothing.** Any sim change makes old replays useless on new courses. The owner chose: replays move byte for byte to an archive that is never pruned, old scores show as "Old best" and stop blocking a new one, a grudge's tally survives, and an old link opens as a target to beat. No option could race an old ghost on a new course, and keeping the old sim would have added about 180 KB and a Classic mode for ever. `migrate.js` proves it across two real builds. Classic can still be built later, because the replays survive.
204. **Sakura's mist gives the snow its form back.** A soft spring morning at first flattened the snow and took the hazards' edge at speed. Fog starts further out, shade and shadows run deeper and the blossom and rocks darker, and it still reads as one.

205. **The running figures change together, twenty times a second.** The wow pass cost Low 7 to 13% at 6x throttle and the frame's JS only explained half of it. A trace found the rest outside the frame callback: the page's own lifecycle rose from 5.2 to 8.0 ms a throttled frame, because at 30 m/s the metres change on every second frame, the new clock adds its own changes, and each one is a style, a layout and a paint. Score, metres, clock and gifts now land on one 48 ms beat, the combo bar, the stage hairlines and the gift panel (which bumps through most of a good run) stay on layers of their own, and two frames in three do no layout. Nobody reads a units digit at 30 Hz, and it moved Low's median to within a frame of the build before it with no change to the picture. A cash-in still lands in the score at once. What the fix could not buy back: the throttled chase on High, where the extra cost is the scene (the README's table).

206. **A very first run's riders read you.** The field is picked before you ride, and with no history it can only guess who you are, so a first run was the worst race in the game: live for a third to a half of it, with fewer passes than a second run. So on a very first run on a bundled mountain the pool riders aim at places on a string through your position, inside rates of 0.35 to 1.12 of their own run, and the string opens as you go so the riders ahead come back to be caught. 800 m from the line they stop reading you and ride on at the rate they had, so the end is a real race: a rider faster than about 34 m/s rides clear, and over 40 scripted runs places spread from 1st to 6th of 6, the skilled pilots mostly 1st to 3rd and the clumsy pilot 3rd to 6th, where it had been last almost every time. Your best, a grudge and a friend never read you, and neither does anyone from the second run on, or on a Daily or a Cup, whose field is shared. The sim never sees any of this: where a ghost is at a tick was always presentation, and the logged draft bit is the only way a ghost reaches it. On the finished build, over 40 scripted first runs, the race is live for 0.76 of a clumsy run against 0.33 before and 0.89 to 0.96 of the others' against 0.38 to 0.52, with 2.8 to 3.6 passes a minute against 0.3 to 1.9. It costs finishes: riders near you mean twice the slipstream, and the four skilled pilots finished 21 to 24 of 32 over three samples, against 27 before. The novice, the nearest to a first-timer, did not change. What such a rider did stands in your results, but a grudge or a rematch rides its real run, so those are decided on that (`realStanding`), and only a rider really ahead of you and within reach is promised. Without that it leaked into the second run: the rider beside a clumsy first run was a real 2:30 rider waiting for it, and came back as a grudge 1.7 km up the road. A first run's two beginners were there to give anyone company, which reading does now, so they ride only on a Daily or a Cup.

207. **A slow rider flies near true speed.** A rider slowed to half speed flew at half speed, which is a quarter of its gravity, and it looked it. A slower rider now flies at 0.85 at least and takes the time back on the ground, eased over a quarter of a second so it does not snap between speeds on a lip, and reaches the line on its real time. The cost is a rider who visibly quickens over a jump: a burst is easier to believe than a float.

208. **A link opens what it was ridden on, ahead of its rivals.** A link only matched the four named mountains, so a Cup or Daily run named the right place and rode the wrong one with no ghost. It now opens today's Daily or this week's Cup at once, and Ride waits for the pool (a Cup link makes the Cup's pool first). If the pool cannot be made the title falls back and offers nothing. The friend line stands only while Ride would ride it: pick another mountain and it goes. A link to a day or a week that has gone says the race has closed over the plain Ride button: it used to promise a ghost that would not ride.

209. **A crash lens reads what is drawn, and a wreck stops at it.** The rock of a wall stands past where the sim's ground ends, so the crash lenses could stand in it or behind it, and a wreck bounced on the sim's ground came to rest inside it, worst at low frame rates. The camera now takes the drawn surface as well as the ground: the hero shot and pack lens reject rock, the drift turns back at a wall, and the wreck stops at the face. The chase lens stays on the sim's ground, because inside the limit they are the same. Over 1,104 replayed walled crashes at 60 fps, buried wrecks fell from 66 to 0 and hero lenses in rock from 9 to 0. One crash still has its orbit in rock for about 0.3 s.

210. **The echo asks the plan whether the roof stands.** A place's kind says it is roofed. The plan's `clear` says whether the roof survived this mood's air. Comet Night's tunnels rang at full strength with open sky above them. The echo and the frame's dark now read the same truth, and a test walks every enclosed stretch to hold them together.

211. **Rails are proved by a pilot, and some sit under a flight.** `--pilots rails` rides the safe line and steers onto each rail, reading the course as a rider does. All 24 runs finished, with 5 to 8 grinds a run, and 72 of 80 rails mount cleanly: 38 in a full ride, 34 more tried alone. Eight have no clean mount, at least three of them under a kicker's flight: `railAt` keeps 14 m past a kicker, and a flight carries about 50. Fixing that changes course generation, so it is cheapest before the build ships: afterwards it is another clean break.

212. **A graveyard stands where riders fell, not where runs ended.** Tumbles forgive most hits, so run-end crashes gave Sakura three places and the others none, while riders went down in the same spots all along: 14 of 36 at one bend on Frostfang. The generator reads every tumble and wreck off a replay (`PoolGhost.falls`, whole metres, 2.3 KB over four pools, every record byte-identical). `fell` counts riders, and a slow rider is a real run under a second name, so it counts once. There are more places than cairns, so the deadliest stand, nearest first on a tie, 150 m apart so one "Survived" does not land on the last. An older pool still works from where its runs ended.

213. **Three overlooks a descent, and the keep gives way to what cannot move (extends 172, 191).** One walk down the course with a 130 m keep landed 3, 1, 1, 1. The second lift now keeps 900 m from the first, and where the walk leaves too few, or none in the first 1.5 km, a second pass uses the widest room left, 70 m from what the course fixes and 40 m from a lift line, on either bank. An overlook's fall is gone at its own ends, so nothing past them floats. Whether a descent is short is only known at its end, so the plan is whole-course, a few ms at first ask. The longest bare stretch on the four mountains is now 282 m and tested. Dailies have less open ground: 31% keep two. Rail and rocks stand 420 m ahead and 80 m behind, so three a descent do not keep their two draws on for most of a run.

214. **An animal stands in front of what bounds the run.** A fixed 9.3 m past the edge put 24 to 50% of them inside a ravine's rock, a street, a tree rank or over a gorge. `limit` is where something solid stands, so `openFoot` asks for that, and a spawn that fails is skipped. A fox is checked where it will trot, and a fright's way out is walked at placement, so it pulls up at rock as it does at an overlook's lip.

215. **The line is painted for the lens.** The lens sees the snow at a couple of degrees, so 1.2 m rows were a broken dashed line by 30 m. Four rows in both colours, barrier to barrier, each check 3 m wide and 4.5 m long as road paint is, foreshorten square. It reads clearly from about 30 m and the banks carry it further. Also: a piece made on the frame now redraws the slots, or a queued site stayed an empty slot with its crowd standing in the air.

216. **The start has grandstands.** Past the crest, 10 m out, three rows were heads over the boards, and Low had nothing. The finish's stands now run down both banks either side of the gate, each row 0.62 m over the last since the ground gives them no height. The near rows move and the rest are baked in, so it costs triangles and no draw. They are worked out on idle time, because a piece's plan runs on the frame that asks, here a run's first.

217. **Rider labels wait for the page's beat when Low runs short, and that was not enough.** With riders in frame all run, a Low frame at 6x throttle took 4.5 ms longer, and only 1.6 ms of that was the frame's own JS. Hiding the labels, the rival chip, the race pill and the draft pill together recovered all of it, so the cost is page work, not the scene. No one of them explained it, and neither did the looping pulses. Everything that changes often now shares one beat (`pagebeat.ts`, on the frame's timestamp, so all callers land together), and on Low under 50 fps labels and the chip move on it. A Low phone holding 60 fps keeps smooth labels. A trace gave back about a third of the page work and 8% more frames, but the probe's frame rate did not clearly move: a very first run on Low at 6x is 41 to 45 fps against 45 to 55. Hiding labels and chip outright gives 6 to 15% more frames on a struggling device, at the cost of the names, and that is the owner's call: the HUD's race pill still names the next rider. A returning run, with riders out of frame, is 47 to 50.

## Round 5: depth, wonder and scale

218. **The player review, before anything changed.** I played the wow-pass build (3331717) as a player would, in
    headless Chrome on the real GPU: a very first run on every mountain, runs 2 to 4 on Pinecrest, the title, the
    sled shop and the results, at 1280x720 and on a 390x844 phone. The scripted pilots gave the numbers
    (`lab.ts` six seeds a mountain, `telemetry.js` four runs in one save per pilot on Low); I read the frames myself.

    *Wonderful.* The first minute: the grandstands, the swinging line of gifts that teaches steering, the first
    leap, 30 m/s that reads as speed. The places are real: Frostfang's ice ravine, Pinecrest's covered bridge into
    a lit old town, Ember's red sky over the caldera, Sakura's lift line and blossom. A very first run is a race:
    riders read you and someone is always in reach. The results card is rich and honest.

    *Flat.* Riding well barely beats not riding. A rider who never touches the controls (`autoride`) finished
    Pinecrest in 2:21.6, **2nd of 6 with a bronze medal**, unlocked Frostfang, and on its second run set a new best
    and unlocked Ember Peak. In the lab hands-off finishes Pinecrest in 155 s and the expert pilot in 144 s, 7%
    apart; the careful line pilot is slower than hands-off (161 s). Every verb (drift, trick, grind, wall ride) is
    optional for time. Gifts: two hands-off runs paid 1,074, enough for four of the six sleds; after that the second
    most visible number on screen means nothing, and the gift lines sit on the safe line, so collecting is never a
    choice. Ghosts are usernames on identical mint glass ("vik_rides", "Yusuf42"): nobody to hate or chase. Events
    happen to you: the avalanche is outrun by holding the line, the gift storm is more currency, the train is free
    speed. Between places the course is a white groove with scenery beside it.

    *Runs 2 to 4.* Same mountain, one save per pilot. The race thins after the first run: the stunt pilot's race is
    live for 0.79 of run 1 and 0.36 to 0.73 after; mid's falls from 0.61 to 0.50 by run 4; the clumsy pilot finishes
    none of four, places 5th to 7th. Passes stay at 1 to 4 a minute.

    *Where a player stops.* Somewhere between run 3 and run 6: the sleds are bought, the mountains are unlocked by
    passing ghosts, and the tenth run plays like the second because nothing a player gets better at changes the
    clock much. A clumsy player stops sooner, at a third wreck around 1.2 to 1.9 km, never having seen a town.

219. **The round's plan: eight changes, biggest lift first.** All sim work goes into one clean break (SIM_VERSION 7).
    1. **Spirit lights and the lantern** (replaces presents on the course). Lights charge a three-lantern meter on
       the sled; skill charges it too (a stomp, a whisker, a slingshot, a grind, a wall ride, a drift's release; a
       sky gate, a yeti hopped and an avalanche outrun are worth a whole lantern). Lights sit on choices: a boosted
       pop's arc over every kicker, a leap's apex, the fork's ice, a rail's top, a wall's berm, a squeeze, a line
       through each place; the plain safe line carries almost none. Gifts stay as the meta currency (missions,
       medals, ladder, passes, mastery) and leave the run's HUD; the lantern takes their place.
    2. **Dash and Ward, one new button.** Spend a full lantern to Dash: 1.4 s as a spirit, faster, most of the
       drag gone, and through any tree or rock in the way (never the walls). Or keep it, and it Wards the next
       hit: no tumble, 84% of the speed kept. Spend now or keep insurance is the decision every few seconds. Self-
       only, so a ghost is never touched; ghosts dash and ward in their own records, and you see them do it.
    3. **Route depth.** A second fork on Pinecrest, Ember and Sakura (Frostfang's script has no room without losing
       its tunnel), a sky gate over one kicker a stage (only a boosted pop goes through), light lines that need a
       wall ride, a grind or a squeeze, and the open rail fix: rails keep out from under every flight.
    4. **Events become choices.** The yeti hopped lights a lantern; the gift storm becomes a Light Storm spread wide
       across the corridor (chase it or hold the line); the train's wake charges the lantern; a dash breaks away from
       the avalanche, and outrunning it pays a lantern.
    5. **Marquee moments.** Each mountain's places become authored set pieces, about one every 45 to 60 s: a name, a
       camera beat that frames it without taking the steering, a music swell, and a line of lights to play through
       it; the finish town erupts for a winner.
    6. **Signature riders.** Twelve characters (`src/bot/roster.ts`) with a hat silhouette, an emblem, an accent, a
       sled and a riding style the bot really rides (a dasher spends every lantern; a hoarder never does and rides
       through what floors anyone else), each with a run on every mountain and a few short lines. Rivals and grudges
       become people.
    7. **Mastery and the garage.** A board of goals per mountain (medals, its sky gates, its places, its signature
       riders) that teaches the mountain; gifts buy procedural cosmetics; sleds retuned as sidegrades around the
       lantern.
    8. **The struggling rider and the returning race.** Wards let a struggling rider survive hits it could not; a
       wrecked rider can ride home as a spirit, outside the race, to the finish town; the returning field is picked
       around your level with signature riders in it.
    Two lanes run beside the main one in worktrees: the living world (crowds, villagers, animals that react, built
    detail, the Low look) and the riders (the twelve silhouettes on the ghosts, the player's anticipation, reactions
    and finish celebration).

    *Rejected.* Random item boxes: the winner would be luck. Anything that touches another rider: ghosts are replays.
    A second button for tricks (decision 5 stands; the new button only spends). A fifth mountain: a biome is a
    full art set (palette, massif, flora, materials, town, landmarks) and weeks of tuning, while every run on the
    four already has stretches the moments and the living world fix; the four deepen first. A starting lantern for
    every rider: tried, it rescued none of the clumsy pilot's 24 runs and made letting go stronger. A second fork on
    Frostfang: its third act cannot hold one without dropping its tunnel, the ice cavern.

220. **Spirit lights charge a lantern, and the plain line carries almost none (SIM_VERSION 7).** Presents on the
    course became spirit lights (`Course.lights`): a spark lights 6 of a lantern's 100, a great light 25, and the
    sled holds three. Skill lights it too (`skillCharge` in sim.ts): a stomp 16, a whisker 12 and a plain near miss
    5, a slingshot 18, a drift's release 4, 8 or 14 by tier, a grind 6 and then 3 a beat, a wall ride 10, a clean
    trick 5 plus 4 a spin and 8 a flip; a sky gate, a yeti hopped and an avalanche outrun light a whole lantern.
    Where lights sit is the point: the run-in's swing (it teaches steering and lights most of a first lantern), a
    boosted pop's arc over every online kicker (a plain flight passes under it), a leap's flight with a great light
    near its top, the fork's ice with a great light at its middle, three over each rail's top (only a grinding sled
    reaches them), up the outside berm of a long bend, a great light in a squeeze between two trunks, a line that
    tempts you wide past 400 m, and a line through each place (a weave down a street, a thread down a tunnel to a
    great light at its mouth, an S across a lake, a line along a bridge, a swing through a ravine). Over a run the
    lab's pilots light 4 lanterns holding the safe line, 8.6 as the novice and 11 to 11.6 as mid, expert and stunt.
    Lights are marigold flames (ART.md 1): gold stays "a good thing you take", now the course's fuel as well as
    the menus' gifts. Drawn at a gift box's size they vanished at speed; at 0.8 m tall (a great light 1.2 m, with a
    ring and a second flame) they read down a ravine.
221. **A lantern is a dash or a ward: spend it or keep it.** One new input, the spirit button (input bit 6; E, Q or
    Enter, the right mouse button, or the HUD's lantern on touch), and only its press counts. A dash spends a full
    lantern: 1.4 s as a spirit, 7 m/s of boost, 45% less drag, the cap 4 m/s higher while it lasts (eased back off
    at 6 m/s a second, never a step), and through any tree, rock or log in the way (not the walls: `edge()` still
    turns a sled back). A lantern kept is a ward: the next hit that would be a wipeout keeps 84% of the speed,
    banks the combo instead of losing it, and the sled passes through what it hit for half a second. The first
    version left the sled inside the rock with its velocity still into it, and the glancing push then pinned it at
    0.2 m/s in a fork's channel for the rest of the run. Now it passes through, and any sled held under 2.5 m/s for a
    second is set back on its way along the line, slipping past whatever held it. Spend now (about 1 to 1.5 s gained
    a dash) or keep insurance (a wipeout costs about 4 s and, after 700 m, one of two forgiven): a decision every few
    seconds, and it lands differently for different riders. Self-only: nothing touches a ghost, and a ghost's dashes
    and wards are in its own record. The worker flags them (`FLAG_DASHING`, `FLAG_WARDED`), and a dashing ghost
    trails pale light, a warded one breaks into marigold, so you see why it surged.
222. **Route depth comes from lines, gates and two more forks.** One sky gate a stage (`Course.skyGates`), a ring of
    light hung 22 m past the most open online kicker of the stage, set for a 70% boosted pop at 30 m/s and 4.6 m over
    a plain flight's path, 2.4 m in radius: Pinecrest and Frostfang have three, Ember and Sakura two. A second fork on
    Pinecrest (Old Town Run) and Sakura (Temple Town), written as `fork|split` and `cruise|fork` options so the
    dailies keep their variety (over 40 orders in 60). Frostfang's third act cannot hold one without dropping its
    tunnel, and Ember's cost it an overlook (two, against the three the overlook plan promises), so both keep one.
    The rail fix: `railAt` keeps out from under every flight on the line and every ledge's landing, not 14 m past a
    kicker; a stage short of rails gets a second, closer look, and one daily stage in 64 still holds two (the test
    now allows two). Wall lines up a bend's berm are rarer than planned: most open sections bend too little.
223. **Events are choices now.** The yeti hopped lights a whole lantern (going round it is safe and pays nothing). The
    Gift Storm is the Light Storm: 48 lights, one in four great, swung across 95% of the corridor's width, so chasing
    it is a line choice that leaves the safe lane. The Spirit Train's wake lights the lantern by 1 a tick while you
    draft it. A dash breaks away from the avalanche as well as a clean line does, and outrunning it lights a lantern.
224. **Gifts are the menus' currency, and the run's HUD shows the lantern.** A run pays 5 gifts a stage line and 15
    for the finish (`runPay`); passes, duels, finales, graveyards, missions, ladder rungs, medals and mastery stars
    pay the rest. Two hands-off runs used to pay 1,074; a finished run now pays about 30 to 60 before missions. The
    counter left the run's top right for the lantern. "Collect 20 gifts" retired: its successor "Take 20 spirit
    lights" takes its slot and tier with its best at 0 (11 gifts are not 11 lights). New missions teach the new
    verbs: dash twice, dash through a tree or rock, fly a sky gate.
225. **Sleds are lantern sidegrades.** Each trait trades something: Whirl Saucer's tricks light 15% more and its
    lights 10% less; Lodge Toboggan's wards keep 10% more speed and its dashes run 15% shorter; Comet Bob's skill
    lights 10% less; Tea Tray's dashes last 25% longer for an 8% lower pop and 10% less from lights. Wisp keeps its
    slipstream for a weaker light pull. Bought with gifts, which skill does not buy faster: no sled is a better sled.
226. **The ghosts are twelve signature riders and a crowd.** `src/bot/roster.ts`: a name, a hat silhouette, an emblem,
    an accent, a sled, a style and a few lines each. Every bundled pool is 30 crowd runs and one run by each rider at
    its own level (a touch better at home), ridden by the bot with its style's traits, so the style is in the record:
    a dasher spends every lantern (Suki Ember dashes 8 times on Pinecrest), a hoarder never dashes and rides through
    hits on wards (Old Wren: no dashes, 3 wards). The Hollow King first rode as a liner and came in mid-pack, against
    the bio that says it tops every ladder; it rides as a master now. A pool cannot draft or grind (it is ridden alone,
    and the bot leaves rails), so no rider claims to; those styles stay in the type for later. Daily and Cup fields
    take three riders each. Inside each role's window the field takes a signature rider over the crowd, so the race
    is people you come to know without moving its pace; the one just ahead of you, or the one you just beat, has the
    last word on the results. The riders lane gave each its hat on the ghost (part of the body's glass, so C10 and
    the fades hold), its emblem on the tag and a speech chip on passes, and the player's rider its anticipation,
    reactions and finish (see the riders lane's commits).
227. **Marquee moments: each mountain's biggest places, played as set pieces.** `src/game/marquee.ts` names four on each
    named mountain from its own sections (Pinecrest: The First Drop, Mirror Lake, Old Town, The Valley Leap.
    Frostfang: Serac Gate, The Crevasse Fields, The Ice Cavern, Aurora Straight. Ember: Cinder Gate, The Caldera Leap,
    Basalt Halls, Ash Market. Sakura: Petal Steps, The Thousand Torii, The Blossom Leap, Temple Town). A Daily or Cup
    takes its biggest places about a kilometre apart. Each is a director beat: about two seconds out, its title card
    and the line to play, a camera beat that never takes the steering (out and up over a drop, low and close down a
    street or a tube, aside across a span), a swell in the band (+0.16 drive and a three-bell call over a held chord),
    and the air of the place (embers, petals, lantern light, a burst of light out of a tube). On the way out it scores
    itself: lights taken of its total, and clean if nothing hit you in it. A win lights fireworks over the square in
    the player's and the lantern's colours. A Pinecrest run meets one at about 15, 50, 95 and 110 s and the finish at
    about 125: every 15 to 45 s, denser than the brief's 45 to 60, because the places were already there.
228. **Mastery: a board per mountain that teaches it.** Stars for a bronze, silver and gold, each sky gate flown, each
    set piece swept (every light in it, and clean), each signature rider who calls the mountain home beaten to the
    line, and one finish with no wipeout and no ward: 13 to 15 a mountain, 10 gifts each, once. The medal wall shows
    the stars beside the medals; the results show what a run added. Kept across clean breaks: it is the mountain's.
229. **The garage opens with paints; the rest of it waits.** Eight procedural sled paints (`src/game/paints.ts`), 60 to
    220 gifts, recolour a sled's body and wood under its grain; the trim and the rider's scarf and beanie stay
    vermillion. Scarves, hats, trails and sled sounds were in the brief and are not built: the rider's colours would
    have to come from the save rather than meshes.ts, and its scarf and beanie keep the player's signal while they
    change. That is the next round's work.
230. **A struggling rider rides home as a spirit.** Wards let a rider survive hits it could not before (hands-off
    finishes all four mountains instead of two), but the clumsy pilot still wrecks in 24 of 24 lab runs: it hits
    something every 300 to 400 m, more than any fair supply of wards. So a wreck short of the town offers "Ride home as
    a spirit": a sim of its own from the wreck (`Sim.homewardFrom`), never recorded, with nothing to hit and nothing to
    score, down to the square, then the same results card. Fair by construction: the run, its record, its place, its
    ladder and its medals are exactly what they were at the wreck, so it cannot change any standing. Tested end to end
    on Pinecrest from wrecks at 1,309 m and 1,451 m: about 85 s home, and the card unchanged.
231. **The clean break, for the record.** SIM_VERSION 7. Saves keep gifts, sleds, stats, passes, missions (with 224's
    rename), runs and the Climb's paid medals as before (decisions 149, 203); bests, grudges and links from version 6
    move to the archive. Graveyards count a ward as a fall the lantern took (the place is as deadly), read again off
    the records with `generate-ghosts -- --falls`; their pinned values in the tests were updated, and an older pool's
    fallback is now tested on made-up runs, since the new pools hardly wreck. The 2 KB log test's scripted run, whose
    input changes every 5 to 30 ticks, now rides all 3 minutes where it used to wreck at 2:42: the same rate, about
    700 bytes a minute, so its bound is 2.2 KB.

### Round 5: the living background (its own lane)

232. **A crowd dresses for its mountain, and every figure has a habit.** The crowd was one beanie toy in nine coat colours, so from the lens it read as dots. `figureGeometry(biome)` now builds each mountain's people (Pinecrest's loden coats, bobble beanies, felt hats with a feather and trapper caps, with cowbells; Frostfang's quilted parkas, fur-ruffed hoods, goggles and fur hats, with ice axes; Ember's long dusters and capes, pointed ash hoods, miners' helmets with a headlamp and face wraps, with picks; Sakura's wrap robes with a sash and wide sleeves, straw hats, buns and headbands, with parasols), and `landmarks.ts` restyles its one crowd geometry when the course changes, a line in `setPalette`. Each figure draws one of three headwear variants and one of six habits from its seed: it waves, claps, pumps both arms, throws a snowball at the run while the rider is within about 25 m, rings or raises its prop, or stands arms folded and cups its hands to shout. Heads turn sooner and further than bodies and look round when nothing is near; bodies lean toward the run as the rider comes; a fifth are kids, who bounce more; a far stand stirs on its own now and then. Silhouettes were chosen to read at 30 m/s from 10 to 60 m: a brim, a ruff round the face, a point, a wide straw disc, a parasol. Everything is the vertex shader, still one draw. The figure is indexed now, so it runs fewer vertices than the old one (740 to 860 against 930) though it holds 480 to 575 triangles against 310: two of its three headwear variants collapse per figure, and past 46 m the fine parts (eyes, a feather, goggles, a collar) do too, which is the crowd's level of detail. The colours stay off the signal roles: coats in each culture's cool and muted earths, accents in creams, sky blues, lilacs and pale blossom pinks.
233. **The still rows are posed, and Low gets a crowd of its own in a street.** The baked crowd (a stand's far rows on every tier, and the only crowd Low draws) was two boxes a figure. It is now wound to face the run on its own bank only, so a figure costs about 18 triangles (16 before) and two thirds of them have both arms up, one waving, a flag or the prop, under the culture's headwear in boxes and four-sided cones. Low drew nobody behind a street's barrier; it now bakes half the street's spots, 16% bigger, in the same poses: fewer, bolder figures and no draw. Low builds no bank piece, so a leap's shoulders stay empty there. The street and finish triangle budgets on Low (setpieces test) rise by 2k and 8k to pay for it; the start and every Medium and High budget hold.
234. **Birds sit on the bank and lift off as you come.** A flock or two (one on Low, three on High) pecks on the open bank 4.5 to 8 m past the edge, ahead of the rider, sat up with wings folded; when the rider comes within 40 to 54 m, or a stomp lands near, they go up and away from the run one after another, wings beating hard. It is a fourth mode of the existing bird draw: the CPU writes one take-off time per flock, the vertex shader flies it. Ember Peak's sky stays its ash's: it gains ravens on the bank on Medium and High only, so Low draws nothing new there.
235. **Animals watch, then go.** Deer and ibex come in herds of three to six (they were one to three), graze, then lift their heads and turn them on the neck toward the rider from about 120 m, and bolt one after another as it comes within 44 to 54 m, fanning out. A fox trots the forest edge, or two times in three sits up on a rock (its own figure, in the mountain's stone, which stays) and follows the rider with its head until it hops down at 22 to 30 m. Heads turn in the vertex shader against the rider's position; the CPU carries only how alert each one is.
236. **Kids sled the bank, and a snowboarder drops in.** Medium and High: two or three kids slide down the bank on toboggans 5 to 7.5 m past the edge and wave as the rider passes. Every 650 to 1,100 m, where the bank stays open for 200 m, a snowboarder waits 8.4 m up it, drops down to about 4.6 m as the rider comes within 40 m, rides alongside about 18 m ahead for five and a half seconds, carving, then sits back and lets the rider go. It reads the rider's speed from the run, never the sim's state, and asks every 2 m that the bank ahead is open (no rock, wall, set piece or overlook's lip), so it never crosses anything; nothing on the bank is a collider. Rejected: a boarder that crosses the run (it would read as a hazard), and kids sledding down toward the run (life moves away from the run).
237. **What was left out.** Chimney smoke over a street's houses (the town's chimneys have no way to reach the smoke system short of a new field on every piece, and the steam path is the wrong look), signs and further building texture, and trees that shed snow as the rider passes close (a near miss already does). The crowd ignores reduced motion as it always has: none of its motion moves the lens or flashes.

238. **What the round measured, and what it did not reach.** The skill spread widened: in the lab the novice and
    the expert are 18 s apart where they were 5, against a seed-to-seed spread of 6 to 9 s, and the careful line and
    hands-off ride at the novice's pace (README, "Round 5 play-test"). Three things did not land. Low at 6x on a very
    first run did not win back the last round's loss and sits within about 10% of the old build either way, under on
    Pinecrest and Ember; a bisect put the lantern and the riders' lane inside the noise and the gap after the living
    world and the signature-rider field came in, without pinning it. A skilled first-timer now rides clear of the
    riders who read them (they ride at most 1.12 times their own run, and a pilot dashing at 34 m/s outruns that):
    the expert's first race is live for 0.41 of the run against 0.89, and it wins every time. Raising that cap would
    keep the race but fake it harder; leaving it rewards skill on the first run. The owner chose to
    leave it: a skilled first-timer rides clear and wins. And the
    returning race is no livelier (mid's runs 2 to 4 are live for 0.44 to 0.62 against 0.50 to 0.72), and the clumsy
    pilot still finishes nothing in the race; it rides home as a spirit instead.

## Round 6: polish toward a 10

239. **The review, before anything changed.** I rode round 5's build (dec2d60) in headless Chrome on the laptop's
    GPU: a replayed best pool run (`?demo=0`) down every mountain on High at 1280x720, shot as each set piece comes
    up and in its middle, at every sky gate, at the first dashes and wards, at fixed distances and at the finish; the
    same down Pinecrest on a 390x844 phone on Medium, Ember on Low, and the title on the phone. I read every frame
    (`shots/r6/before`, contact sheets `sheet-*.png`). I cannot hear, so for the music I read the score in
    `theory.ts` and `music.ts` and measured the live master with a new probe (`loudness.js`: BS.1770 on a real run).

    *Pinecrest.* Wonderful: the run-in; the First Drop's reveal of the whole valley, the lake below and a tower on
    the shoulder; and the last third, golden hour on the peaks, the covered bridge between its lamp-eyed towers, Old
    Town under bunting with lit windows, and the Valley Leap framing the finish town from the air. Flat: Mirror Lake
    plays as a wide stretch with a mirror on it; nothing there asks anything of you. Generic: the valley's far lakes
    are flat blue blobs on white, a diagram of a lake; between the First Drop and the lake the run is a groove with
    trees beside it.

    *Frostfang.* Wonderful: the ice ravines, shards from pale to cobalt; the red research-station street; the blue
    hour sinking toward the aurora. Flat: the Ice Cavern does not read as a cavern from the chase lens (walls, then
    sky), and its "Burst out into the light" opens onto polar night, so the card promises a sunrise the sky never
    gives. Aurora Straight is a leap in the dark under a faint curtain. The Crevasse Fields' span is a corridor.

    *Ember Peak.* Wonderful: one frame names it (the cone dead ahead under the orange smoke deck); the Cinder Gate
    tunnel with lava in its joints; Ash Market's lit windows. Accidental: the Caldera Leap and the open slopes either
    side are black stubs and boxes spread evenly over grey snow, and on Low that scatter is the whole picture. It
    reads as debris, not as basalt country.

    *Sakura Ridge.* Wonderful: the palette (peach mist, blossom, the long-skirted cone), Temple Town's street, the
    pagoda over the square. Generic: between places it is pink blobs spread evenly over white at low contrast; the
    Blossom Leap's "orchards" are scatter, not orchards; the Thousand Torii, from the lens, is two dark walls.

    *Everywhere.* Feedback is quiet. A dash changes nothing on the rider (a colour fringe at the frame's edge and a
    few motes); a ward is a puff; a sky gate is a thin outline that shows at about 20 m; fireworks over the square
    are red and gold puffs. Set pieces come every 15 to 45 s, and half of them are a card and a camera beat over a
    stretch that plays like any other. During a set piece the HUD's top centre stacks four things (the card, the
    combo, the stake and a graveyard callout, a stomp callout beside them), and on the phone the bank's figure
    "+30,994" lands on top of "SURVIVED BONEPILE BEND". The phone title is lovely.

    *The music, read and measured.* On Clear Skies all four mountains play in D major at 112 bpm with the same bass
    figure, the same drums and the same arp; only a four-bar chord loop and a timbre accent change. The lead is a
    random walk that enters only at a skilled intensity (0.82 and up), so most runs have no melody at all: a cruise is
    pad, bass and hats. There is no hook and no title theme, the loops stay diatonic, and the arrangement is layers
    fading in with intensity and a whole-tone lift in the last stage. Nothing lands on a downbeat except the band
    itself: stage lines and set pieces sound when the rider crosses them. The master is a fixed limiter for stacked
    peaks and a trim, with no bus compression, sidechain or EQ. Measured live over the first 70 s of a replayed best
    run at the default sliders: the mix is -18.2, -17.9, -18.4 and -18.2 LUFS integrated on the four mountains, with a
    loudness range of only 2.4 to 3.1 LU (the run barely moves), true peak -6.5 to -6.7 dBTP, L/R correlation 0.62 to
    0.66, 1.1 to 1.2 LU lost folded to mono and 2.9 to 3.3 LU through a phone speaker's band. Alone on Pinecrest the
    music is -22.7 LUFS (correlation 0.87, narrow) and the effects with the wind and the world -19.9: **the music sits
    2.8 LU under the effects.** It is a bed, not a score.

240. **The round's plan: eight changes, biggest lift for a player first.** One clean break (SIM_VERSION 8) carries all
    the sim work.
    1. **Set pieces that play differently.** Three a mountain, one a stage, about 45 s apart, each the stage's
       biggest place, each with a verb of its own in the sim, so a ghost rides it and its record carries it.
       *Race*: a machine leaves its station as you arrive, and you beat it to the far end. *Gates*: a slalom of
       lantern gates set on the beat; a full chain fires the street's fireworks. *Rings*: three rings of light along
       a big flight; line up the lip and hit it at the right speed. *Collapse*: the snow bridge falls in behind you;
       keep your speed or it takes some. *Steps*: stomp every terrace. Pinecrest: The First Drop (rings), Mirror Lake
       (race the cable car), Old Town (gates). Frostfang: Serac Gate (the snow bridge collapses), The Crevasse
       Fields (race the ropeway), The Ice Cavern (ice lantern gates in the dark, then out into the dawn). Ember:
       Cinder Gate (race the ore train through the mountain), The Caldera Leap (rings), Ash Market (gates under
       fireworks at dusk). Sakura: Petal Steps (steps), The Blossom Leap (rings), Temple Town (gates). Each has a
       camera beat that frames the verb without taking the steering, a music moment on a downbeat, a line on its
       card, a progress chip while it lasts, a mastery goal and a lantern for winning it. Dailies and Cups give
       their biggest places the same verbs.
    2. **Feedback you can feel.** A dash puts a spirit shimmer on the rider's body; a ward cracks a lantern open
       round the rider with a beat of render slow motion; sky gates are rings of light that read from 60 m on every
       tier; fireworks rise, burst into streaks that fall, and crackle.
    3. **The HUD decides what shows when.** A set piece owns the top centre: its card collapses into the moment's
       progress chip, the stake and minor callouts wait, and on a phone nothing else stacks under it.
    4. **Music: hooks, a title theme and an arrangement against the run.** Each mountain gets its own key, tempo and
       a composed hook a player could hum; the title gets a main theme; progressions borrow chords and lift a key
       into the last stage; the run is arranged in sections (intro, build, drop, breakdown), with stage lines and set
       pieces landing on downbeats.
    5. **Music: production and sound design.** Bus glue, a sidechain under pads and bass and a duck under the big
       effects, fuller pads, a bass that sits (a mono sub), punchier drums with transient shaping, a master to a
       true-peak ceiling at a measured loudness, width that survives mono and phone speakers, and the music brought
       up to sit with the effects rather than under them; the lantern, dash, ward, gate, pass and finish cues pitched
       into the key and the tempo; the crowd swelling with the race; a dev-only jukebox (`?debug&jukebox`) and a
       listening guide for the owner's ears.
    6. **Course craft between places.** Ember's basalt in formations, not scattered stubs; Sakura's orchards in
       rows on their terraces; the Ice Cavern a cavern that opens into a sunrise; chimney smoke, lit signs and
       bunting that moves in the wind in the towns; trees that shed snow when passed close; each set piece framed
       and led into from 150 m, its gates, rings or machine in view down the line.
    7. **The garage, finished** (the round's one new thing): scarves, hats, trails and sled sounds, all procedural
       and cosmetic, the rider's vermillion kept as the signal (ART.md 1). It is on the brief's weak list, and it
       gives gifts something to buy once the sleds are bought (decision 218 found that is where they stop mattering).
    8. **Low wins back its frames.** Measure the page and the audio apart at 6x; cut what costs on Low.

    *Rejected.* A fifth mountain: a biome is a whole art set, palette, music and tuning, and the four are not
    finished; the weak list is all inside them. A night or storm variant: the moods already re-light a mountain,
    and nothing on the weak list is about variety. A Duel mode: a good reason to return, but the field already
    carries signature riders and grudges, and it fixes nothing on the weak list; it is next round's. A frozen
    waterfall to thread: it needs colliders on the line, which the fairness test forbids, and the lantern gates give
    the weave without them. A collapse that drops the bridge's deck: a ghost behind you would ride on air, so the
    cornices and the snow fall and the deck holds. Replacing the music engine: the brief says refine it.

    *How.* Three lanes in hand-made worktrees cut from this commit run beside the main one: music and sound
    (changes 4 and 5), feel and the garage (2 and 7), and the world (6). The main lane carries the sim, the set
    pieces' world, camera and HUD (1 and 3), Low (8), the measurements and the merges.

241. **A set piece is a verb the sim plays (SIM_VERSION 8).** `src/sim/moments.ts` names each mountain's three, one a
    stage, from its own sections, and says what each verb holds; `sim.ts` plays it from the tick the rider reaches
    its first metre (`momentStep`), so a replay, and a ghost, meets exactly the same moment. Winning one lights a
    whole lantern, as a sky gate does. Five verbs, so the three on any mountain play differently:
    - *Race*: the machine leaves its station 16 m ahead as you arrive, fast, and eases into its far station at its
      average pace (Mirror Lake's cable car 34 m/s, the Crevasse Fields' ropeway 37, Cinder Gate's ore train 36),
      so it pulls away first and a rider at its pace closes on it late; whoever reaches the far end first wins.
      It is a function of the tick you arrived, so what you see racing you is what the sim races you against.
    - *Gates*: lantern gates on alternate sides of the safe line, their openings 2 m either side of a point 2.6 m
      off it, 40 m apart down a street and 32 m in a cavern (a street is entered fast, often off a leap or a dash).
      Through every one in order wins. Threading them costs speed (a direct steerer through Old Town slows from
      26 to about 22 m/s), and a rider who dashes into the street at 47 m/s cannot weave them: that is the choice.
    - *Rings*: three rings of light along a leap's flight, 2.2 m to one side of the safe line at the lip, set for a
      takeoff at 34 m/s with no pop, 3 m in radius, at 0.4, 0.85 and 1.3 s. Line up the lip and arrive at the
      right speed: a rider who dashes before the lip flies over them. They join the course's one list of rings
      (`Course.skyGates`, tagged `moment`; the stage gates are `stageGates`), so one renderer draws them all.
    - *Collapse*: the span's snow falls in behind you from 18 m back, at 0.86 of the speed you came onto it (30 m/s
      at least). A span is flat and a sled slows on it: hold your speed and it stays at your heels; bleed it (a
      drift, the parapet, a wipeout) and the snow gives under you, and you keep 72% of your speed.
    - *Steps*: land every terrace step clean. The first rule was every step stomped; no pilot in the lab, expert
      included, managed it in 24 runs. Clean is a test the careful rider passes and the trickster can fail.

    Pinecrest: The First Drop (rings), Mirror Lake (race the cable car), Old Town (gates). Frostfang: Serac Gate
    (collapse), The Crevasse Fields (race the ropeway), The Ice Cavern (gates in the dark). Ember: Cinder Gate (race
    the ore train), The Caldera Leap (rings), Ash Market (gates). Sakura: Petal Steps (steps), The Blossom Leap
    (rings), Temple Town (gates). A Daily or a Cup takes each stage's biggest place, with a verb it has not played
    yet where the stage allows. The Valley Leap, Aurora Straight, Basalt Halls and the Thousand Torii stay places,
    not set pieces: the brief asked for two or three a mountain about 45 to 60 s apart, and one a stage is that.
242. **Tuned on pilots who try them.** The lab's skilled pilots now aim at the next gate's inside half and line up a
    ring line's lip, as a person who knows the set piece does; the careful line ignores them. Over six seeds a
    mountain, set pieces won of those met: the careful line 13 of 72 (18%), the novice 27 of 71 (38%), mid 50 of 72
    (69%), the expert 36 of 72 (50%; its habit of dashing before every lip carries it over the rings). The race is
    the skilled rider's (mid 18 of 18), the steps the careful rider's (the line 6 of 6, the expert 0 of 6), the rings
    want speed held in a window (Ember's caldera: novice and line 4 of 6, mid and expert 1), and the gates want the
    street taken without a dash. Every pilot finishes as often as before; mid rides 5 s faster on average (13.7
    lanterns lit a run against 11.5, from set pieces won), the novice and the expert are within a second of round 5
    on average, and the novice-to-expert spread holds at about 19 s.
243. **What the set pieces look like (`src/render/marqueeworld.ts`).** The race machines ride a cable along the
    bank, 11 m up in the open and 7 m in a tube or a slot, on towers where the ground is open and brackets where it is
    not, between two lit stations: a blue cable car on Pinecrest, Frostfang's red research gondola down the crevasse,
    an iron ore skip glowing from inside through Ember's tunnel, a lacquered car on Sakura (for a Daily). Each is
    placed where the sim's schedule says, swaying on its hanger, and the lens steps away from the cable so the
    machine rides in frame beside you. A gate is two strings of paper lanterns hung from a wire across the run with a
    garland sagging between their heads: solid marigold that reads on bright snow, and nothing standing on the snow,
    so a sled that misses a gate brushes through paper, never a post. The next gate burns brightest and breathes,
    with a pool of its light on the snow in its opening, so the eye finds it in a festival street whose own lanterns
    are the same warm family; threaded, its lanterns slip their strings and rise into the sky; missed, its light
    gutters. A collapse breaks the span's cornices off at the sim's fall line into the gap behind you, with powder;
    the deck holds, so a ghost behind you never rides on air. Each piece is drawn only within 520 m of the rider.
244. **A set piece owns the top centre (the stacking in 239).** Its title card becomes its chip as the rider reaches
    it: the name a size smaller, and under it the verb counting in tabular figures (`Gate 3 of 6`, `You lead the
    cable car`, `Right behind you`), held over the race row until the sim decides it, then its result (`Beat the
    cable car · Lantern lit` in marigold, or `The cable car won` plainly) for 1.8 s. The chip is never hurried by what
    waits, and nothing waiting goes stale under it: a mission pop plays after it. On a phone the stake and the minor
    callout line wait under the set piece from its card to its result. Everywhere, a cash-in now owns the second tier
    while its figure holds over the combo row, so the figure no longer lands on the callout line (the phone's
    `+30,994` over `SURVIVED BONEPILE BEND`). A threaded gate's style is its own, a Lantern gate, not the Sakura
    slalom's Spirit gate.
245. **Ghosts try the set pieces.** A pool rider aims a ring line's lip and each gate's inside half when it tries the
    set piece, which it does by its own key, likelier the more skilled; through gates it takes no detour and looks
    nearer. Over the four bundled pools riders now win the rings in about a third of runs and the races in most. The
    gates stay hard for the bot at its speed (it threads the first and loses the line), and that is honest: they are
    the set piece the player has to learn.
246. **Mastery's set piece stars are the verbs.** Each is the set piece's own line (`Mirror Lake: Beat the cable car
    across the ice`), won by beating its verb and kept as `key:won`, so a round 5 sweep under the same key never
    claims one. The Valley Leap, Aurora Straight, Basalt Halls and the Thousand Torii are no longer set pieces, so
    their sweep stars leave the boards; the save keeps what it held.
247. **The clean break, for the record.** SIM_VERSION 8. Saves keep gifts, sleds, paints, stats, passes, missions,
    mastery and counts (decisions 149, 203, 231); bests, grudges and links from version 7 move to the archive. The
    pools were ridden again (42 riders a mountain, 125 KB). Riders fall less (a set piece won is a lantern, and a kept
    lantern wards a hit), so the bundled graveyards fell from 15 to 12; their pins follow the pools
    (`scripts/playtest/graves-repin.cjs`). Slow riders now also fill a hole in a pool's own slow end (a beginner who
    tumbled twice finished 16 s behind the next), so the ladder has no gap. The stunt pilot's test counts wards with
    tumbles: a won set piece turns one of its hits into a ward.

### Round 6: the world lane

248. **Ember's basalt stands in formations, and its pines in stands.** The Caldera Leap's banks were the decorative
    forest's two sets dealt tree by tree (70% charred pines and snags, 30% basalt clusters and stubs, by an
    independent hash per tree), so every bank was the same even scatter, and on Low, which draws each set's first
    variant only, a scatter of boxes. Now one plan lays each bank (`groves.ts`): the bank is cut into slots 28 m
    long and each slot is a formation, a stand or clear snow. A formation is an organ-pipe outcrop on the crest by
    the run (15 hexagonal columns in two ranks, graded from 3 to 9.2 m to a peak a third of the way along, broken
    drums at its foot, about 280 triangles), another 1.5 to 2.3 times the size on the shoulder 24 to 58 m out, and a
    column cluster at the foot of each; a stand is 6 to 12 charred pines in a clump on a golden-angle spiral, its
    outer ring dead, and a smaller clump further out. No formation follows a formation on one side, so the rock
    comes at a rhythm (about one slot in five), stands about one in two, clear snow about one in three. A sentinel
    column 9.5 m tall stands either side of every leap's approach, 36 m before the lip, where the view opens. The
    bank dressing follows the same plan: a pair of columns at a formation's foot, a burnt stump at a stand's edge, a
    steaming fissure out in the clear snow; no bushes or fences on Ember (they read as debris). Low lays the same
    plan with one organ pipe for every piece of rock and stands thinned to 45%, so its banks are basalt country too,
    with fewer pieces. Rejected: swapping the meshes and keeping the scatter (an even field of better rocks is still
    debris); thresholding a noise field per tree (blotches, not formations); no basalt on Low (Low would lose the
    mountain's material altogether).
249. **Sakura's blossom stands in orchards.** Each bank is laid in blocks from the top of the run down: orchard,
    orchard, then a stand of pines or an open meadow, in turn, with a path 7 m wide across between blocks. An
    orchard block is 6 to 10 trees long, 5 m apart along a row and 5.5 m between rows, six rows on High, five on
    Medium, three on Low (a tree 6 m apart there), the rows staggered by half a tree like terraces; each row keeps
    its distance from the run's edge, so it follows the bank's contour and bends with the run. A block is all pink
    or all pale (one in three is pale), and now and then a tree is gone from a row. The two banks are out of step by
    17 m, so the rows never mirror across the run. Every leap lands between orchards: from the lip to 260 m past it
    every block is an orchard, never pale. Past the orchards the shoulder has a few dark pines and no pink (Low
    leaves it bare). Rejected: true contour lines across the fall line (from the lens they cut across the bank and
    fight the run's own lines; rows at a constant distance from the edge are the bank's contours and lead the eye
    down the run); eight rows (about 18k triangles a chunk more on High for rows the bank's crest hides from the
    lens).
250. **The Thousand Torii's posts stand on the lip of the cut.** The corridor is a trough the sim rides 4 m deep at
    its limit (3 m past the edge), and its lintels clear the highest air, 21 to 34 m over the floor there, so the
    lintels can only show from about 60 m ahead. The posts stood behind the limit in the drawn rock and showed only
    above it; they now stand just past the limit on the trough's lip, thicker (0.72 m, black feet 0.95 m), dark and
    light by turns, with a lit stone lantern between every second pair along the top of the cut. Rejected: lowering
    any lintel (the air rule); taking the rock away past the limit (the sim's own ground rises to 15 m by 9 m out:
    it is the cut); a lighter lacquer (it walks toward the grudge's rose). This is better, not finished: from the
    chase lens it reads as a deep cut under a corridor of gates, the gates above the walls. A camera beat that lifts
    the lens in here would show more of them; that is the main lane's call.
251. **The Ice Cavern is a cavern.** Its roof clears 20 to 24 m of air over the floor (pops from up the slope fly
    in), so it stands 27 m and more up, out of the lens's frame until about 60 m ahead. What reads at the lens's
    height has to be on the walls. Each 5 m bay now has a cobalt crown (two deep masses over the middle, where the
    vault was an even pale honeycomb), three great stalactites (one on Low) whose tips hang 0.4 m under the bay's
    underside, which clears the air by AIR_MARGIN and 0.7 m more; on each wall a shelf of ice 5 to 14 m up with six
    icicles under it (three on Low); and every other bay on each side, by turns, a cluster of three crystals at the
    foot of the ice where the floor meets the wall, lit from within (pushed past white so they bloom on Medium and
    High), leaning back into the wall so none comes over the limit. Rejected: hanging the vault lower (the air
    rule); a smooth lid (a pipe).
252. **Frostfang's Clear Skies goes through the night and out into the dawn.** Four stops where there were two: the
    sun sinks onto the band (600 to 1450 m); polar night with the aurora at full over the Crevasse Fields (1700 to
    2250); the deep of the night on the way to the Fang, the aurora past its crest at 0.75 and the band gone (2700
    to 3180); then the dawn (3300 to 3580): the sun swings from 44 degrees left to 30 right, low (disc 3.6 degrees,
    key light 20), rose gold on the snow and the peaks (alpenglow 0.85), the aurora down to 0.12 and the stars to
    0.15. The sun crosses dead ahead at about 3,440 m, while the rider is under the ice (3,275 to 3,456), so the
    cavern's far mouth opens onto the sunrise and the run comes out into it beside the Fang. The dawn's `dusk` stays
    1: the windows and the station stay lit at first light, and the soundscape's day only goes on (the palette
    test's rule that dusk never falls holds without a change). No pinned test value changed. Rejected: raising the
    sun on its old bearing (it rose behind the left bank, away from the Fang); a dawn before the cavern (the card
    promises the dawn out of it).
253. **Pinecrest's far lakes are frozen lakes.** They were the gaps in the sea of clouds, which on Pinecrest lies at
    the valley floor's level, so its white read as snow and its gaps (`uSeaDeep`, a saturated blue) as flat lakes. I
    made them what they read as: on Pinecrest's Clear Skies (`massif.seaIce`) the sea's openings are frozen lakes
    anchored in the world (their noise is placed where the lens is, so they hold still while the billows drift),
    with a shore of drifted snow feathered into them, a body of pale ice (the deep mixed half and half with the
    haze), long tongues of blown snow over it, and a sheen toward the sun. Low keeps it without the shore's fine
    octave; every chaos mood keeps a sea of cloud. Rejected: closing the gaps (Pinecrest's valley would be one white
    sheet and lose its lakes).
254. **A telegraph line leads down to Mirror Lake.** Between the First Drop and the lake the run was a groove with
    trees beside it. From the first leap's landing (its foot plus 140 m, at most 620 m before the lake) to the first
    lake's shore and 80 m on, a timber pole stands every 30 m, 15.5 m past the edge, on the side the valley falls
    away (`flankMode`), its two wires running crossarm to crossarm, in a cut through the trees 2.4 m wide. It skips
    tree runs, ravines, tunnels, streets, bridges, ledges and the set pieces' ground, and takes up again past them.
    From the lens its poles stand against the haze and its wires converge on the lake. A new large-kit piece
    (`L_POLE`, before the signature pieces), Medium and High; Low draws no dressing. Rejected: an avenue of tall
    trees (more forest); windows cut in the treeline (the bank's crest hides the valley from the lens, decision
    117).
255. **The towns live.** *Chimney smoke*: a street's houses record their chimney tops as the piece is made
    (`Piece.chimneys`), about half their hearths lit (55%), and `Life` draws them in its existing smoke draw on
    Medium and High: eight puffs to a chimney, 1.7 times a cabin's size and rising slower, lit warm on the sun side
    and drifting with the wind; at most 22 chimneys at once, taken at a stride along the towns in view, re-placed
    when a town comes into view (`SetPieces.chimneyKey`). Sakura's townhouses have no chimney and send up none. *Lit
    signs*: a shop's sign board hangs on its awning's front edge, cream with its lettering's dark bar by day and lit
    from within from dusk (the pieces' night flag is the journey's dusk as well as the night moods), and its corner
    blade glows in its own colour; on Low a flat board over the window. *Cloth*: bunting, banners and lantern
    strings carry a weight per vertex (held at the masts, freest at a pennant's point and in a string's middle, a
    banner freest at its foot), and the set pieces' material swings them with the mood's wind in the vertex shader
    (0.36 m a breezy day, 0.22 at night, 0.6 where the snow blows); across the run they move at most a third of a
    metre, so nothing crosses the clearance. Rejected: the steam path for smoke (the wrong look, as decision 237
    said); swinging cloth from the CPU or as its own instanced draw.
256. **Trees shed snow when passed close.** A forest tree in the near rows (a tree run's wall, the treeline, an
    orchard's first rows) with snow on its boughs, passed within 2.5 m of its trunk at 18 m/s or more, lets the near
    miss's own sift fall (the same burst, placed by brush.ts on the side you passed, 15 grains, about two thirds of
    an ordinary near miss), once a tree and at most one every 0.15 s, so scraping along a tree run's wall is a run
    of falls, not a stream. It reads the chunks' packed forest (`Props.treesNear`), so nothing is drawn or made.
    Snags, spires and basalt shed nothing; Frostfang sheds nothing. Low keeps it at its particle budget like every
    burst (about seven grains): the scan is a few dozen comparisons a frame and there is no draw. Rejected: none on
    Low (a tree run on Low would read as dead next to a near miss that sifts); a burst every frame while close (a
    stream).

### Round 6: the feel and garage lane

257. **A dash puts the rider in a spirit shimmer.** For a dash's 1.4 s every rider material takes one uniform
    (`uSpirit`): the body goes a little pale and luminous, a white-gold rim burns round the whole silhouette and
    gold bands ripple up through the coat from the sled, about two a metre, rising at 1.6 a second. It eases in over
    about 0.1 s and out over about 0.3 s, so it never flashes. The scarf keeps its vermillion (only a breath of the
    rim): the player's signal does not change colour because the rider is fast. On Medium and High two faint
    after-images (the seated rider's silhouette in white-gold glass, 0.05 s and 0.1 s behind) trail the rider; they
    draw only where the rider is not (contract C10's stencil, as a ghost does) and only while it dashes. Low gets
    the shimmer and no after-images, so Low draws nothing new. Reduced motion keeps the look and slows the bands to
    a third. Rejected: a whole second rider drawn translucent behind (five draws an image, and the chase lens looks
    straight through it at the rider); tinting the rider marigold (the lantern's colour belongs to the lights and
    gifts; a dash already burns white-gold in the HUD's lantern).
258. **A ward cracks the lantern open, with a beat of slow motion.** At the hit a paper lantern of marigold panels
    (five rows of ten, translucent, densest at its rims) stands round the rider, white-gold cracks burn across it,
    and 0.09 s later it breaks: the panels fly out as shards that keep most of the sled's speed (so they stream past
    rather than vanish behind), spin, cool and fade, and a ring of light runs flat over the snow to 5.6 m. Shell,
    shards and ring are one instanced draw that exists only while a ward plays (about a second). The ring and the
    paper tint what is behind them as well as adding light, because added light alone washed out to white on the
    snow. The slow motion is `WARD_CURVE` in `timescale.ts`: 0.3 by 50 ms, held to 0.3 s, back to full by 0.52 s, on
    both channels. I chose both and not the render channel alone because the rider and the pack move on the feed:
    slowing only the render slows the shards and the shaders while the sled shoots on at full speed, which reads as
    a glitch, not a beat. The feed channel is what a stomp's hit-stop already uses; the sim stays tick-exact (only
    how much real time is fed to the fixed loop changes), so replays and every ghost are untouched. It is triggered
    in `app.ts` from the sim's own `ward` event, one line. Reduced motion plays none of the slow motion (the time
    scale's rule) and the lantern breaks later (0.2 s) and gentler, with no pop of light.
259. **Sky gates are rings of light from 60 m on every tier.** A gate was a 0.14 m tube that showed at about 20 m.
    Now each is a ring with a deep amber edge on its silhouette, marigold through its body and a thin white-gold
    line along its core, a shimmer running round it and one run of light chasing it, a halo that tints and glows
    round it, a faint veil inside it (so it reads as a gate to fly through, not a hoop) and four beacon motes riding
    it. The vertex shader holds the tube at least 2.7 px in radius and the halo 10 px wide whatever the distance, so
    at 60 m it is a clear ring of light about fifty pixels across. Ring and halo are one geometry in one instanced
    draw for every gate (as before), with a premultiplied blend: the ring writes opaque light, the halo tints and
    adds. Low has no bloom, so the halo carries the glow there and the core stays under 1; on Medium and High the
    core runs past the bloom threshold. The cap rose from 4 to 16 and every entry of `course.skyGates` draws at its
    own radius, so a set piece's line of three smaller rings is the same family. Flying through one swells it, burns
    it white-gold and it is gone in 0.7 s, with a ring of motes. Rejected: a pale white-gold ring (it vanished on
    snow and on a bright sky: the first version did) and a plain additive halo (white on white).
260. **Fireworks are streaks that rise, burst, droop and crackle.** The old shells were particle sparkles and
    gouache dabs that read as puffs. A shell now climbs on a thin trail of embers (0.55 s at the finish, where the
    render-time ease already slows it, 0.9 s elsewhere), bursts with a flash into a sphere of streaks (peony,
    chrysanthemum with longer tails, a tilted ring, a willow that droops in marigold, a crackle that breaks into
    twinkling glitter), and every streak stretches along its motion on screen, slows against the air and falls. One
    instanced draw for every spark of every shell, drawn only while a show is in the air; Low throws about half the
    stars and its streaks carry their own halo. Each streak takes a little of the sky away behind it (a
    premultiplied blend with alpha), so vermillion still reads against a bright peach dusk. Colours are ART.md 13's:
    vermillion, coral, marigold, white-gold in four pairs, never mint or rose; the finish's old periwinkle shell is
    gone. They fire over the square for every finish (moments.ts keeps its show and its timing; only the shells
    changed), a bigger show over the square for a win, and over the street ahead when a `moment` beat says a gates
    set piece is won. The square's shells keep the finish show's placement (from the lens as each goes up); the
    others are placed along the lens's own view from where the lens will be when they burst, kept near the middle of
    the frame where the speed streaks smear least: a sled at 30 m/s closes 40 m during a shell's climb, and the
    first placement (by the run, 70 m ahead) burst over the top of the frame. Reduced motion keeps the show, drops
    the glitter's twinkle and most of the burst's flash.
261. **The garage, finished.** Four new shelves beside the sleds and paints, all bought with gifts and all cosmetic;
    nothing reaches the sim, a sled's handling, the lantern or a ghost (a test reads `src/sim` and `src/bot` for any
    mention). Seven scarves (vermillion always dominant: two deeper stripes, cream bars, a short broad rib, a
    fringe, narrow ink bands, cream-dipped ends with a fringe, a long slim streamer; each varies the tails' length
    and width, the knit's pattern and the tassels, and the accent is at most cream or ink). Seven hats in vermillion
    and the beanie's cream, each told by its outline from behind (the cuffed pom beanie, a short watch cap with a
    thick rolled cuff, a pom over each ear, a trapper with a cream fur brim and long flaps, a ring of bobbles, a
    pointed chullo with braided ties, a stocking cap that streams out behind; none is a signature rider's hat). Six
    trails: plain powder, a pale honey spray, marigold sparks flicked off the runners, gold glints left twinkling in
    the groove, a cream and gold stardust, a marigold stream straight back (warm roles only; never mint, rose, coral
    or vermillion, because coral and vermillion are the drift's heat). Trail motes are painted grains in the powder
    layer with a hot twin in the glow layer now and then: added light alone vanished on white snow, and that was the
    first version. The five sled sounds are the music lane's list (`SLED_SOUNDS`); the garage sells them, saves the
    choice and calls `AudioEngine.setSledSound` at load, after the platform's save is bound and on every change.
    Prices run 60 to 240 gifts, the same band as the paints; there are 23 items to buy for 3,370 gifts in all, so
    gifts keep mattering after the sleds.
262. **The garage's shop.** The Sleds sheet is now the Garage (the title's button says Garage over the sled's name):
    a row of tab pills (Sleds, Paint, Scarves, Hats, Trails, Sounds) over the shelf, arrow keys moving between tabs
    as tabs do. Every shelf is the sled shop's own shape, a preview with its one action beside tiles that pick what
    the preview shows, so the six read as one place; buying is two taps everywhere (Buy arms, Confirm spends),
    paints included (a paint used to buy on one tap). The previews are drawn from the same numbers the game builds
    the looks from (`garageart.ts`): a scarf tail in its pattern and length, a head and shoulders from behind in the
    hat, a groove with its spray and motes, a drawn wave for each sound, a deck in its paint. A line under each
    preview says what the shelf touches and that it is a look only. On a phone the tabs scroll sideways and the
    tiles go two a row. Rejected: rendering each hat and scarf with the game's portrait renderer (a render per item
    and a second camera angle for the back of the head; the drawings are instant and say the same thing), and a
    listen button for sounds (the music lane owns how they sound and has no preview entry point yet).
263. **Saves.** New optional fields: `scarves`/`scarf`, `hats`/`hat`, `trails`/`trail`, `sounds`/`sound`
    (`SHELF_KEYS`). Known ids only, once each, the free item never stored, and the worn one must be owned or it
    reads as the free one. A save from before them loads with the free item on every shelf and keeps its shape:
    nothing empty is written back. `tests/garage.test.ts` holds a round 5 save (gifts, sleds, paints, mastery,
    counts) through a load and a write, round-trips a bought set exactly, and throws mangled values at it.

### Round 6: the music and sound lane

264. **The music is written, not walked.** Each mountain has a song (src/audio/score.ts): a two-bar intro, an 8-bar
    verse, an 8-bar chorus and a 4-bar bridge, one chord a bar, as scale degrees, with a hook over the chorus (a
    4-bar phrase and an answer that turns through the borrowed chords), a sparse answering line over the verse and a
    build chord the bar before a drop leans on. Pinecrest is D major at 112 and climbs (its chorus answer lands on
    the bVI and bVII before home); Frostfang is F# dorian at 100 with long notes over glass bells and a half-time
    snare; Ember Peak is C minor at 124, a riff of repeated notes over a pumping kick, with a phrygian bII before
    the major V; Sakura Ridge is Eb major at 96, swung, pentatonic, its chorus ending on the minor iv. The title has
    a main theme (D major at 88), and the results play it again slower in the key the run ends in, so the game opens
    and closes on one tune. All of it is original. I rejected a theme per mood (a mood is a colour on a run, not a
    place): a mood keeps its key, mode, tempo, drums and timbres and plays the mountain's song in its own mode, so a
    Blizzard on Pinecrest is still Pinecrest's hook, in A minor. That is why the songs are degrees: a borrowed chord
    or note is written as the major scale's degree plus a shift, so the bVI stays a bVI in any mode, and a test
    holds every hook at 85% or more of its on-beat notes on its chord.
265. **The run is arranged against the run.** The form (src/audio/form.ts) is intro, verse, chorus, verse, and so
    on, with three things that cut across it. A drop: a set piece, a stage line or the finish lands on the band's
    beat nearest the moment the rider gets there, the bars before it build (a riser, a snare roll rising from
    eighths to sixteenths, hats in sixteenths, the kick out for the last two beats, the bass out for the last
    eighth), and the drop starts a chorus on its downbeat with a crash and a boom. The engine knows when the rider
    gets there: it reads the course's stage lines and set pieces (planMoments, the same list the director plays) and
    the rider's speed down the course, and plans each drop when it is 3.4 s out (the finish 4.6 s), re-planning as
    the speed changes until the drop's pad is built half a bar ahead. A drop may land on a bar line or on beat 2, 3
    or 4; off the bar line the bar is cut to 1/4, 2/4 or 3/4, the oldest edit in the book, so the music meets the
    picture instead of the picture waiting up to a bar for the music. A breakdown: a set piece ridden out or a
    wipeout drops to the bridge (pad, bells recalling the hook, a shaker) at the end of the chorus's phrase, never
    mid-line. The lift: the line into the last stage lands its drop a whole tone up. Measured on the four best pool
    runs: stage lines and finishes landed a mean 0.18 s from the crossing (the worst 0.40 s), the set pieces 2.0 to
    2.5 s after their cards (which come up about 2.2 s out). Two drops a few seconds apart sounded like a hiccup on
    paper, so a drop into a chorus still in its first phrase jumps to the second phrase instead of restarting it,
    and a set piece within 40 m of a stage line is the same drop. Rejected: a drop on the next bar line only (up to
    2.1 s late at 112 bpm, a whole leap); stretching the tempo to meet the place (a 30% swing to make a bar fit);
    planning from the card alone (it is 2.2 s out at a cruise, but not at 9 m/s, and a stage line has no card).
266. **A cruise has a melody.** Round 5's lead came in at a drive of 0.82 and most runs never reached it. Now every
    chorus carries the hook at a plain cruise, a verse carries the answering line from the second stage (or a drive
    of 0.45), and the run opens on the hook's first bar rung on bells. The skill still owns what it owned: the clap,
    the sparkle, the choir, the arp's octaves when the band opens up, and the hook doubled an octave up (which the
    last stage's choruses also get).
267. **Notes make no nodes.** The bass, the melody and its octave double, the arp (three or four lanes it rotates
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
268. **Production.** The pad is fuller: a fifth over the root fills the hole between the bass and the chord, and its
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
    Below 25 Hz is cut on the master. Where AudioWorklet is missing the old fast compressor and its trim stay, and
    the hand ducks come back. The first build put the loudness gain after the limiter and let peaks through at +0.8
    dBTP; the loudness probe caught it, and it now sits in front.
269. **The loudness target is -16 LUFS integrated, true peak under -1 dBTP.** A browser game plays in a tab beside
    video (normalized near -14) and music services (-14 to -16); at round 5's -18.2 it was the quietest thing open,
    and the effects were doing the work. -16 is the AES streaming recommendation's loud end and leaves the effects'
    peaks room under the ceiling without squashing them; louder would need the limiter to take more than the odd
    transient. The music is brought up to sit with the effects (within a loudness unit, not 2.8 LU under them).
270. **The cues are in the score.** The lantern, the dash, the ward, the sky gate and the pass keep their rush or
    thud on the action and put their notes on the band's next sixteenth (at most 134 ms at 112 bpm), each note moved
    to the nearest tone of the chord playing; their runs move in 32nds of the band, not in fixed 40 to 60 ms. A
    stage line's bells and the finish's slam land on the band's drop when one is within 0.7 s (0.5 s for the
    finish), so the hit is one hit. The finish's fanfare is the main theme's opening bar on brass, in unison with
    the band's finale, which quotes it on the melody over a bright tonic (major whatever the mode). The crowd at the
    line roars louder for a win (1.25x) than for last place (0.55x), and a crowd beside a close race swells (up to
    +4 dB) and cheers harder with it.
271. **Every set piece has a music moment.** The card (marquee 'enter') rings the hook's head softly on bells while
    the riser builds into the drop at the place's first metre. The moment beat's 'step': gates climb the pentatonic
    ladder a step a gate on the band's sixteenths, and a full chain ends on a chord; rings ring a chord that holds
    and fills (root, third, fifth and octave); steps hit a taiko on the band's eighth, rising a whole tone a step.
    'lead' is a rising brass stab, 'trail' a falling bell pair, 'close' a low pulse on the beat with a brief dip,
    'won' a stop and the hook's head on brass and bells a whole tone up ending on a bright chord, 'lost' three soft
    bells falling to the tonic, 'miss' a dull sagging note. 'start' and anything unknown are silent (the drop
    already marks the start).
272. **Sled sounds are the runners' timbre, nothing else.** Steel Runners is the bed as it was. Sleigh Bells adds a
    string of bells shaken harder as you carve; Old Timber a creak of boards in the crunch and a wooden knock on a
    clean landing; Glass Chime a rubbed glass singing the key's tonic and fifth; Lantern Song a warm hum on the
    tonic whose lowpass opens a step for each full lantern (read from the sim's lantern, dash and ward events). Each
    is a small fixed graph built when it is chosen in the garage (never in a run frame) and moved by automation; a
    landing's body swaps its parts for the same number of nodes. No cue changes, no ghost's sound.
273. **The jukebox and the listening guide.** `?debug&jukebox` opens a panel over the title (src/audio/jukebox.ts,
    loaded with a dynamic import from main.ts behind the debug switch, so the shipped game carries none of it) that
    plays the main theme, each mountain's run music by stage and section, drops, the lift, the finale, the results'
    reprise, every set piece's cue and every cue in the score, by driving the real engine with synthetic frames and
    beats. LISTENING.md is the route for the owner's ears and the eight calls only an ear can make.

### Round 6: what it measured

274. **What the round measured, and what it did not reach.** The README's "Round 6 play-test" has the tables. In the lab
    the set pieces spread by skill and by kind of skill (the careful line wins 18% of those it meets, mid 69%; the
    steps are the careful rider's, the races the fast one's, the rings want speed held to a window), the novice-to-expert
    gap holds at about 19 s, and every pilot finishes as often as before but one novice run in 24. In the browser a
    finisher meets a set piece every 39 to 48 s. The mix is -16 LUFS on all four mountains with its true peak at -1.2
    dBTP, the music sits 0.8 LU under the effects where it sat 2.8 under, and the band costs Low less main-thread time
    than round 5's. High, Medium and the phone hold 60 fps; settled frames carry no new draw call on any tier; the build
    is 776 KB zipped, 53 KB more. Three things did not land. Low at 6x on a very first run is level with round 5 within
    about 5%, not better: the frame's JS is the same, so what remains is page work round the riders' labels, and naming
    only the nearest rider on a struggling device bought 1 to 2 fps inside the noise and was not kept; hiding labels
    altogether stays the owner's call (decision 217). The first frame is 70 ms later, inside the builds' overlap. And
    in the browser the skilled pilots' races read a little less live (0.61 to 0.71 of a run against 0.70 to 0.85), as
    they ride faster on the lanterns their set pieces pay, on four runs a pilot, inside the noise. None of it has been
    played or heard by a person.
275. **The garage's loose ends, closed.** The feel lane left three. The Sleds tab's seated preview wore the beanie
    and the classic scarf whatever the rider wore: the portrait studio now seats the rider in the garage's hat and
    scarf (each look's head and scarf built once, keyed into the portrait cache), and the shop draws its seated
    preview again whenever the look changes. A sled sound could not be heard before it was bought: the Sounds shelf
    has a Listen button beside its action, which plays about 2.4 s of that sound under a rider carving at a cruise with
    two clean landings (`AudioEngine.previewSledSound`, driving the runners' bed itself, since no run feeds frames in
    the garage, and never the band), then puts the worn sound back. On the title it lifts the master from 0.044 to
    0.072 RMS; the console stays clean on desktop and phone (`scripts/playtest/garage-look.js`). And the UI harness
    opened only the Sleds tab: it now builds the paints and the four shelves as the game does, so every tab can be
    opened, bought from and worn there.

## Round 7: from an 8 to a 10

276. **The review, before anything changed.** Round 6's build (5f70fe5) in headless Chrome on the laptop's GPU, on
    mains. A new fixed frame set (`scripts/playtest/frames.js`, the list kept in `frames-r7.json`): for every mountain
    the same 35 to 38 distances (every 150 m, each set piece's approach and middle, each leap's lip, the way into
    every street, bridge, tunnel, lake, ravine and terrace, the finish and its square), ridden on the safe line at 30
    m/s on High at 1280x720, on Low, and on a 390x844 phone on Medium (`shots/r7/before`). I read every High frame and
    the phone's. The pilot lab rode the same seven pilots, six seeds a mountain (`shots/r7/lab/before.txt`). I cannot
    hear, so the music is read from `score.ts` and round 6's measurements.

    *Pinecrest.* Wonderful: the First Drop still opens the whole valley; the last third at golden hour is the best
    light in the game, and Old Town's street through the bunting is a postcard. Flat: from 700 to 1700 m and again
    from 2550 to 3000 the frame is two-thirds white foreground with streaks on it and a groove of trees; the eye has
    nothing to hold. Cheap at speed: the two grey prisms either side of the First Drop and the Valley Leap, with a
    crowd standing on them, read as untextured boxes; Old Town's lantern gates read as stacked yellow blocks; the
    rider is about 5% of the frame's height on desktop at speed (the phone, where the rider is twice that, looks
    better for it).

    *Frostfang.* Wonderful: Station Street's red hulls and amber windows; the cavern's way out into a rose dawn, which
    is the one staged change of light in the game that lands. Flat: from 600 to 3300 m, a minute and a half, the
    frame is one blue. The polar night under the aurora (2250 to 2850) is a dark blue smear in which the snow, the
    walls and the sky share a value and the rider is the only thing that reads. Cheap: ravine walls are a few huge
    flat triangles; the ice has no depth; the Ice Cavern at 3300 is a dark corridor with a lit square at its end.

    *Ember Peak.* Wonderful: the cone under the orange deck names the mountain in any frame that has it; Cinder
    Gate's lava joints; the dusk bridge into Ash Market. Flat: the snow is a grey-brown that reads as mud, lit by
    nothing: the deck is orange and the ground does not know it. The Caldera Leap has no caldera in it (no lava, no
    glow from below, a grey slope with a flag). At 3450 the frame is grey fog with a line in it. Cheap: basalt is
    dark brown boxes with a lighter top.

    *Sakura Ridge.* Wonderful: the cone, Temple Town's street, the pagoda. It is also the weakest mountain to look at:
    from 2400 to 3100 several frames are near-white paper with pink blobs on them, at so little contrast that the
    course's edge is hard to find. The blossom is a flat mauve, not light. The Thousand Torii is two dark walls with
    green steps.

    *Everywhere.* The light is direct sun and distance fog. Shafts exist (a fan from the sun in view) but nothing in
    a frame says where the light is coming from, and no lamp, window, lava or lantern lights the snow beside it. The
    near snow is a bright plane with speed streaks. "Steer" sits at the bottom of every frame of a run (the hints
    never retire for a rider who never touches a key, and the brief's capture shows it at 1:24 for one who does).

    *The screens, a Daily and a Cup, and a first and second run* (`review.js` on desktop and phone,
    `shots/r7/before/review`). The title is already a live scene (the lodge, the lift, a rider and a ghost riding
    past) and it changes with a Daily or a Cup, but it is an attract loop behind a logo, not a composed piece of key art,
    and all four named mountains share the lodge. The results are a well-made table beside a waving rider: rank, three
    splits, a race list, missions. Nothing in it celebrates, and the best moment of the run is not shown. A rider who
    never touches a key finishes third of six on Pinecrest in 2:29 and fourth of six on Sakura in 2:22, so the finish
    is reachable by doing nothing and unreachable by trying badly, which is the wrong way round. The second run is the
    first with a mood and a rival named on the card; nothing else on the mountain differs from the first. A fifth run
    was not ridden by hand: the lab and the telemetry stand in for it, and that is a gap only a person closes.

    *Where a player stops, and why.* (1) The struggling player, in the first minute of every run: the clumsy pilot
    finishes 0 of 24 (median 1,140 to 2,390 m of 4,500; 14 of its 24 runs end on a landing, 5 on a tree, 4 on a rock, 1 out of time) and never
    sees a finish town. (2) The player who has learned a mountain, at about run five: its three set pieces play
    identically every time. (3) The player who has ridden all four, at about run ten: there is nowhere new to go,
    and the twelve riders are names in a field, not a ladder to climb. (4) The skilled player, quietly: the expert
    pilot wins 36 of 72 set pieces against the mid pilot's 50. The lab's verbs say why, and it is not only the rings:
    races 8 of 18 against 18 of 18 (it arrives slow off a trick line), rings 8 against 10, steps 0 of 6, gates 14
    against 18 of 24. Only the collapse rewards it (6 of 6 against 3).

    *The music, read and measured.* Round 6's numbers stand: -16.0 LUFS integrated, true peak -1.1 to -1.2 dBTP,
    loudness range 2.1 to 3.3 LU. That range is the finding: a run's music barely moves in level from its first bar
    to its finish. Each mountain has a key, a tempo and a written hook, but all four are played by the same eleven
    Web Audio voices (saw and triangle oscillators through one filter each, noise drums), so the four courses are one
    band playing four tunes. There is no space (one short reverb send), no real bass weight under 60 Hz, and nothing
    that a listener would call an instrument. No human has heard any of it.

    *The frame's cost, for the record.* High on Pinecrest in these captures: 69 to 100 draw calls and 0.79 to 1.19
    million triangles a frame.

277. **The round's plan: eleven changes, biggest lift for a player first.** Six of the eleven lift the look (1 to 4,
    part of 5, and 10). One clean break (SIM_VERSION 9) carries every sim change.

    1. **Light and air you can see** (look). A filmic tone curve; height fog with the sun's scatter in it and three
       planes of aerial perspective; shafts through trees, towers, torii and cavern mouths; cloud shadows in the
       valleys; a grade for every place, blended along the run to ART.md 15's colour scripts; lamps, windows, lava,
       lanterns and fireworks that light the snow and the riders; an Ultra tier above High (ambient occlusion,
       contact shadows, reflections, depth of field in the beats), and a designed Low. *"It looks like a film now."*
    2. **Surfaces at speed** (look). Snow that sparkles near the lens, with sastrugi, soft blue shadow and ruts
       that last the run; rock with painted strata and snow on its ledges, and no box anywhere (the First Drop's
       edges are the test); ice with a heart; trees that sway and carry snow; clean seams. *"The snow looks like
       snow."*
    3. **A hero worth looking at** (look). A larger rider in the frame with a stronger silhouette, secondary motion
       in scarf, coat and hat, weight into a carve, anticipation before a pop, reactions to a pass, a wipeout and a
       win, a finish celebration; a rim and a key light in every frame; ghosts in glass. *"My rider has character."*
    4. **A camera that directs** (look). Speed you feel across the curve; a held wide on each mountain's biggest
       leap; a slow hero frame at the apex, on the music; a low tracking shot down a street; a whip-pan onto each
       mountain's reveal. Steering is never taken. *"Did you see that shot?"*
    5. **Set pieces that never repeat** (wow, sim). The sameness audit and its answer: no verb more than twice in
       the game, a mountain's three all different, and the two uses of a shared verb clearly different to play. New
       verbs where the audit needs them. Two or three seeded variants of every set piece; one or two rare legend
       moments a mountain (about 1 run in 10, never a session's first); a climax in the last stage that lands in the
       finish town on the beat. *"That has never happened before."*
    6. **Lanternfall, a fifth mountain and the finale** (scale). The summit the spirit lights come from: a descent
       from above the cloud, through it, into a valley of rising lanterns. Its own palette, architecture, people,
       music, three set pieces on verbs used nowhere else (follow a guide light through the cloud, kindle a road of
       stone lamps, carry a flame to the great lantern at the finish) and its home rider. *"Wait, there is a fifth
       mountain?"*
    7. **The Twelve** (depth). A campaign spine: beat each signature rider on their home ground, one duel at a
       time; the twelfth opens Lanternfall and a last race against all of them. It gives runs 10 to 50 a direction
       and the roster a story, and it needs no sim change (a duel is a field of one real record). *"Three more and I
       get the King."*
    8. **A produced score** (music). Each course in its own genre, instruments, tempo and production, rendered
       offline at full quality and shipped as stems (Opus, with an AAC fallback), streamed after the first frame and
       cached by course; re-sequenced to the run, layered with the race, with a stinger for each verb, a breath
       before the biggest leap, a climax into the finish town, a title theme and a results reprise, and a motif for
       each signature rider. The live engine stays for cues, stingers and the crowd. *"I had the Frostfang track in
       my head all day."*
    9. **A skill curve that works at both ends** (feel). The struggling player reaches the finish town; the expert
       pilot wins at least as many set pieces as the mid; runs 2 to 20 stay a live race for a skilled player;
       gamepad support with rumble and glyphs; control hints that leave once a control is shown. *"I finished!"* and
       *"Finally a pad."*
    10. **Your run, directed, and screens that belong to the look** (look, wow). A highlight reel after the finish,
       cut from the run's own record with cinematic cameras and its own music; the title as a living piece of key
       art that changes with the mountain; results as a celebration; motion design through the HUD and every
       transition. *"Watch my leap."*
    11. **Low beats round 6, by design.** The riders' labels and pills leave the DOM for the canvas (one batched
       draw from a glyph atlas), which removes the page work decisions 217 and 238 measured, rather than trimming
       it. *Nothing a player says; a phone that holds its frame rate.*

    *Chosen for section 3 of the brief, and why.* A fifth mountain and The Twelve. The review's third stopping point
    is scale and direction, and these two answer it together: the campaign is the road and Lanternfall is where it
    goes. The summit beat the sea-cliff harbour because it pays off the game's own story (the lights, the ghosts)
    and its palette is one the other four do not have (night, indigo, the fuel's marigold as world light), where a
    harbour is a fifth day-lit snowfield. The Twelve beat a third lantern use because it is depth at almost no sim
    risk: it reuses the records, the grudges and the roster the game already has.

    *Rejected.* **A spirit route at a veil arch** (the third lantern use): a mirrored second ground is a second
    course to prove fair, light, dress and teach, and a third lantern use dilutes the dash-or-ward choice that works.
    **Weather fronts that move the safe line**: the fairness test's promise is a static safe lane a beginner can
    learn, and moving it mid-run punishes exactly the player change 9 is for. **Drafting or any field-dependent
    mechanic**: a record would depend on who else was in the race. **The sea-cliff harbour**: above; kept for a
    later round. **Moving to the WebGPU renderer**: every material is hand-written GLSL on `ShaderMaterial`; a port
    is a rewrite of the look to gain nothing a player would see on this hardware, with two renderers to keep. **A
    music-generation tool**: its licence for a game sold on CrazyGames cannot be checked from here, and a generated
    track cannot be re-sequenced by stage and race state as stems can. **Ableton**: the connector can write notes
    and load devices but has no bounce, and nobody in the loop can hear the result. **Temporal anti-aliasing as the
    default**: glass ghosts, particles and the speed streaks have no motion vectors; it stays an Ultra experiment the
    look lane may keep or drop on evidence.

    *The struggling player's fix, decided here because every lane depends on it.* A wreck no longer ends a run by
    itself. The rider tumbles, loses time and speed, and gets up; the sim decides how many get-ups a run has and
    how they come back, tuned until the clumsy pilot finishes most of its runs. It is fair to the ghosts because it
    is the sim's rule for every rider (a ghost's record carries its own falls), and fair to the skilled because a
    fall always costs more time than the line that avoids it, which the lab must show.

    *Size.* CrazyGames' requirements today (docs.crazygames.com/requirements/technical, read 2026-11-12): at most
    250 MB and 1,500 files in total, an initial download (to the first gameplay start) of at most 50 MB, and at
    most 20 MB to be eligible for the mobile homepage. The round's own budget is far inside that: an initial
    download under 6 MB and a whole build under 45 MB. `npm run release` will check 20 MB for the initial download
    and 50 MB for the whole build.

    *How.* Lanes in hand-made worktrees cut from this commit. Phase 1, side by side: light and pipeline (change 1,
    and Low's designed look); hero, surfaces and camera (2, 3, 4); music (8); set pieces and Lanternfall in the sim
    (5 and 6's sim); feel (9). Phase 2, once phase 1 is merged: Lanternfall's world (6); the set pieces' and
    legends' world (5); screens, the reel, The Twelve and the labels (7, 10, 11). Phase 3: the visual review loop
    (an independent critic with only the frames and ART.md, at least three passes a mountain). Phase 4: the pools
    ridden again, telemetry, perf on every tier, loudness, size. The main lane holds the art direction, the merges
    and the measurements.

Items 278 to 341 are the lanes' decisions, folded in from `notes/r7-*.md` in the order of the plan's eleven changes.
Every number in them is a lane's own measurement, taken while six or seven lanes shared the laptop: draw calls,
triangles, counts and lab tables hold; no lane measured frames a second, and none is quoted. Nothing in them has been
played or heard by a person. Where a later lane changed what an earlier one built, the item says what stands now.

### Round 7: light and air you can see (plan change 1)

278. **A film curve, driven by value.** The composite's soft knee let the brightest snow reach paper white and round
    6's S-curve pivoted at 0.5 linear. The new curve (`FILM` in `palette.ts`, compiled into `post.ts`) has a short toe
    (darks up to 18% deeper), runs straight to a knee at 0.45 and climbs a shoulder toward 0.98 that it never reaches.
    It is driven by a colour's value (a 40:60 blend of luma and its brightest channel) and scales the colour whole, so
    shade keeps its hue and vermillion, marigold and mint keep their saturation. Lit snow (0.83 linear in the scene)
    lands at about 0.72, 222 of 255, with the sparkle and the sun above it: a player sees snow that has form in full
    sun. What is hot enough to leave the range folds halfway toward the light's own colour, but only if it is already
    near white: the first cut folded everything, and at dusk Old Town's lantern gates went peach, so a colour with a
    hue of its own now keeps it up the curve. Bloom keeps its source's colour for the same reason (a street of amber
    lamps bloomed sky colour and a ghost's halo drifted warm); only bloom that is already near white takes the
    light's. Rejected: AgX and ACES fits. Both desaturate the three signal colours on the way up and lift the
    mid-tones, which washed Sakura out further.
279. **The hour and the place are two tables.** `JOURNEY` stays the time of day in metres, the same on any course of a
    mountain. `PLACES` (new, `palette.ts`) grades the hour's light by the course's own sections, by kind and by which
    of that kind it is, so a Daily's shuffled acts carry their places with them. A place's palette is laid once a
    course and cached; a frame blends hour to place over the section's own blend (a roof closes and lets go faster: the
    burst out of a cavern is about 80 m, under two seconds). The grade gained an exposure and a split tone
    (`grade.exposure`, `hi`, `lo`, `tone`, all optional), and the place grades are mostly those numbers. Rejected:
    keying rows to ART.md's metres (wrong for the Thousand Torii by a kilometre, and for every Daily) and keying to
    set-piece ids (they were being renamed this round).
280. **Each mountain's colour, to ART.md 15, and what the first full frame set corrected.** *Ember read as sand:* the
    snow's own colour was a pink-grey under an orange light, so it was tinted twice. The snow is now a warm white all
    the way down (#F6EEEA to #E4D6D2, a dusk rose at night) and the light carries the orange once; the shade is a cold
    plum-teal, basalt is true black, and a light from below (`under`) grows down the run and fills the Caldera Leap.
    The Basalt Halls' grey veil at 3450 m had two causes: the air's forward scatter used the sun's colour at full
    strength however dim the disc (it now scales with the disc, `0.25 + 0.75 * sunDisc`, which touches every mood with
    a dim disc), and a pale peach light on dusk-rose snow is mauve-grey (from 2700 m the light is ember). *Sakura read
    as custard:* the yellow was a full fan of stock-gold shafts over white snow. Shafts take a third of the stock gold
    on every mountain, Sakura's are thin until the orchards, the light leans to rose, and from the Blossom Leap the sky
    sits a full step under the snow with a blue far plane; its clear frame arrives at 2450 m where it arrived at 2700.
    Ink rock, a wine underside to the blossom and a deeper lavender shade give it a spine. *Frostfang was one blue
    from 600 to 2550 m:* blue hour has paler lit snow and a lemon rim; the polar night has a second key light (`key2`,
    the aurora's green sweeping the snow that faces the sky) with violet in the shade, and a slot in the ice is the
    dark of its frame so the cobalt walls and the lit valley beyond are the picture. *Pinecrest* gains a third stop,
    dusk at the line. Still short, in the lane's own words: Frostfang from 900 to 2400 m is better and is still a blue
    mountain (a ravine's walls are large cobalt planes no grade makes three values), Sakura from 2410 to 2700 m is
    soft, and vermillion on Ember's firelit snow at dusk (4050 to 4330 m) is the closest the hero's colour comes to
    its ground anywhere. The chaos moods were not re-shot after the scatter change.
281. **Air in two colours, thicker in the valleys.** The fog had one colour. It is now the mood's fog near and the far
    plane's own colour with distance (`air.far`), it glows toward the sun's disc and cools away from it, and it lies
    thicker below the course's floor, so a valley and its village gather haze before the run ahead does. The massif's
    haze is the same far colour, so the ranges are the mountain's blue, and the clouds' shadows sweep the mid-ground's
    flanks and valley floor with the terrain's own pattern. No volumetric pass was added: the frames read with these
    (Pinecrest 707 and 3940 m, Sakura 2580 m).
282. **Local lights, in the shared light model.** The nearest eight lights to the rider are uploaded by reference
    (`lights.ts`); each falls off as `(1 - (d/r)^2)^2`, so there is no spike at the lamp and no edge on the snow, and
    wraps a third of the way round a form. All are scaled by the palette's `lamps` (0.2 at Pinecrest's noon, 1 and more
    at night and in a street). Snow takes them whole, a prop on its own colour, a hazard on its edge only, so it stays
    the dark shape in the street. Who offers one: every lamp with a painted pool while lamps are lit (a radius of 2.3
    pools, so a street is pools of amber with blue between, not a gold floor); each lantern gate and the race's
    machine; lava in Ember's joints every 24 m and one 85 m light in the Caldera's gap; the cyan heart of Frostfang's
    crevasse walls every 28 m; Sakura's stone lanterns every 21 m; and the effects (a dash 10 m with a 16 m beat as it
    starts, a ward's crack 15 m, a sky gate's burst 18 m, a lantern filling 9 m, a firework 150 m with a hard flash,
    at most 1, 2 or 3 at once by tier). The sled's own lantern keeps its own path: pushed as a local light too it lit
    the snow twice. Every radius and power was chosen blind and wants a re-tune on the merged build, the fireworks'
    150 m above all (it wins a slot from any lamp).
283. **Low is a poster.** `tierLook` bakes the place's grade and the film curve into the colours Low draws with (snow,
    sky, air, clouds, ranges), flattens the sun to a disc of the light's own colour and widens its glow on the dome.
    On Low the snow alone takes the nearest four local lights, as two-value painted pools; props take none. No draw,
    triangle or pass is added. *Cost of the light lane, mean draw calls and triangles over the fixed frames, round 6
    to the lane's branch:* High 94 calls on every mountain before and after (Frostfang 824k to 831k, Ember 703k to
    702k, Sakura 942k to 947k; Pinecrest 1,013k after, its before report unreadable); Medium 86 to 90 calls both, up
    at most 10k triangles; Low read 2 to 3 calls and 8 to 12 thousand triangles heavier, which the lane traced to
    different ghosts in frame (both builds ridden fresh to 3000 m on Low list the same meshes: 49 calls, 137,128
    against 137,124 triangles). Its real cost is in the snow's fragment shader (the light loop, the slab's and the
    strata's noise), and frame time was not measured.
284. **An Ultra tier above High, opt-in except on a discrete GPU.** `Tier` is `'low' | 'medium' | 'high' | 'ultra'`.
    Ultra dresses the world exactly as High does (forests, crowds and far ranges keep three levels) and adds to the
    frame: four MSAA samples, a 4096 shadow map over 44 m, three-slice occlusion with contact shadows, 12-tap shafts,
    22-tap depth of field with bokeh, and ice that mirrors the frame itself. The automatic controller never guesses
    Ultra and steps up only to a ceiling: `deviceCeiling()` raises it to Ultra only when the browser names a discrete
    card, and then asks for headroom held 12 s, twice what a step to High asks. Anywhere else it is the player's
    choice in Settings (hidden on a touch device unless the save already chose it). *Why:* the controller's headroom
    rule measures the main thread, and Ultra spends fill rate; on this laptop's Arc 130V a step up would be a rebuild
    hitch, a second of long frames and a step back, two hitches for nothing. `tests/quality.test.ts` holds the rule,
    this laptop's GPU name among its cases.
285. **The frame has depth, and things sit on the ground.** The scene target carries a depth texture when a tier's
    passes read it. *Ambient occlusion* at half the frame, two passes and four taps in the composite: High one slice by
    two steps, Ultra three by three with an 8-step contact ray; a luminance guard keeps it off anything brighter than
    lit snow. *Shafts* are cut by the world's depth: two zoom-blur passes at a quarter of the frame on Medium (6 taps)
    and half on High and Ultra (8 and 12), driven by the grade's `shafts` and the sun's disc, with one bright place a
    frame (a cavern mouth) offered as a second source. Lane GPU time at 1280x720 with other lanes running: occlusion
    0.17 to 0.3 ms on High and 0.33 to 0.9 on Ultra, shafts 0.15 to 0.4. Standing passes over round 6's: Low 0,
    Medium 0 (2 while shafts run), High and Ultra 2 (4 with shafts); a full camera beat adds 2. Low's row is empty:
    it draws straight to the canvas as before.
286. **Shadows cover what the lens sees and stop crawling; ice holds the world.** The shadow box is pushed half its
    reach down the lens's heading and moves in whole texels, so edges do not crawl at speed: Medium 26 m (1024), High
    34 m (2048), Ultra 44 m (4096). No second cascade (a second lookup in every material). *Reflections:* Low keeps
    round 6's painted gradient; Medium and High put the lake's baked sky and peaks on every glaze (an ice patch, Glass
    Ice, the fork's strip) with the rider's soft figure standing in it, the bake refreshed every 3.5 s on any stretch;
    Ultra marches the mirrored ray through last frame's depth (24 steps, 100 m) and reads last frame's picture, so
    trees, pylons, gifts, the rider and the ghosts stand in the ice. A hit is accepted only where the ray's depth
    meets the buffer's: a thickness test smeared gifts down the ice. What is off screen is not in the ice.
287. **Edges that hold still, measured; temporal anti-aliasing tried and not kept.** A frozen frame drawn eight times
    with the lens moved by parts of a pixel, the 99th percentile of each pixel's luma deviation, thousandths of white,
    at 900 m (trees), 1800 m (the lake's cables) and 3464 m (Old Town's bunting): no MSAA 146, 119, 161; round 6's FXAA
    112, 96, 118; 2x MSAA 114, 92, 120; 2x with the new edge walk 97, 79, 99; 4x 101, 84, 104; 4x with the walk 89,
    73, 90; 8x alone 95, 81, 99. So the composite's edge walk on top of MSAA buys as much as doubling the samples, and
    4x with it beats 8x without. Shipped: Medium the walk alone, High 2x and the walk, Ultra 4x and the walk. A wire
    thinner than a pixel with no MSAA is still dashes on Medium; no pass can redraw what the rasteriser dropped.
    *Temporal AA* worked on a still frame (1800 m: 81 to 54) and went soft in motion, which is all this game is, so
    it stays off on every tier behind `?taa`. *The lens:* depth of field, motion blur and the letterbox belong to the
    camera's beats and draw nothing between them (`tests/pipeline.test.ts`: zero passes at rest on every tier); at
    speed High and Ultra carry a hair of fringe in the corners only (about 2.5 pixels of a 1280 frame at the cap), off
    under reduced motion. The cost table is data (`passCosts()` in `postfx/tiers.ts`), held to the frame's plan by the
    test. **Not priced by the lane:** Ultra's 4x MSAA and 4096 shadows, and the mirror's march on ice, all inside the
    scene pass, whose time did not repeat on the shared machine.

### Round 7: surfaces at speed, and effects (plan change 2)

288. **Snow carved by the wind; rock painted whatever its form; ice with a heart.** Three scales of painted relief
    where there was one: wind slab (crests 7 m apart, in fields, to 150 m), sastrugi (1.6 m, now across the run as well
    as the banks, at half strength) and the fine ripples, each with a lit crest and a lee face in the shade's own blue
    (teal on Ember, lavender on Sakura). The fine glitter reaches 22 m and gathers toward the sun; past 35 m a slope
    turned to mirror the sun carries a soft sheen. Low paints the slab's colour and skips its normal. Any
    stone-coloured fragment of a hazard or landmark carries strata in world space: beds 1.15 m thick, dipping and
    wandering, in three values, a dark parting under each and snow along the top of some. It is a mask on colour, not
    a material, because rocks share materials with trunks, roofs and rails. Ice has a darker heart seen square on, a
    pale skin at its edges, cracks on two sets of planes and bubbles; crevasse walls hold a cyan glow low down; the
    Petal Steps' banks hold still water, never on a line a sled rides.
289. **Rock is laid down in beds, basalt stands in organ pipes, and neither is a prism under a white lid.** The
    review's boxes were a leap's shoulders (one 8-sided cylinder scaled to 8 by 7 by 17 m), Ember's basalt (four fat
    prisms) and icosahedron boulders. `rockforms.ts` replaces them: `strata()` stacks beds, each its own thickness and
    value and shifted off the one under it, so one side steps in (a ledge that holds snow) and the other juts (an
    overhang in the rock's darkest value), with a drift banked round the foot as the seam with the slope; `columns()`
    packs hexagonal columns, each broken off at its own height. The lane's first cut failed its own read at the
    owner's distances (a shoulder was five level courses with a white stripe on each, a grandstand of laid stone), so
    a joint now dips along the outcrop as well as across it, wanders, pinches out and is cut off by a level top; each
    bed's corners stand in or out on their own and a long wall is cut into bays and buttresses; a crown's rim is
    broken; snow lies only on a ledge wide enough to hold it, which on a boulder is its lee side; basalt is
    cross-jointed into drums on Medium and High. Basalt is near black and cold (toward #15121B). *Measured:*
    `tests/rockforms.test.ts` holds every hazard's drawn form inside its collider on all the mountains and filling at
    least 85% of its radius (a sled is never stopped by clear air), for 59 seeds, and a rock is now drawn to its
    collider's own height where it could be 0.4 m off. Triangles a form, round 6 to now: the run's rock 60 to 91 (Low
    54), basalt 192 to 156 (Low 124), a shoulder 224 to about 880 (Low about 250). The owner's six frames, calls and
    triangles: Pinecrest 537 m 90 / 1,046,742 to 88 / 1,032,720, 2429 m 92 / 989,552 to 94 / 991,920, 3940 m 86 /
    934,596 to 84 / 915,420; Ember 450 m 95 / 705,207 to 94 / 720,959, 2271 m 89 / 691,863 to 91 / 709,454, 3150 m
    101 / 628,350 to 99 / 631,377. Still short: a shoulder's top edge under its crowd is a level line 35 m long (the
    set pieces' world lane later stepped it into ledges, item 312), the run's rock is plainly facets close to the
    lens, and the organ pipes are not jointed. Rejected: a rock texture or triplanar shader (a form that needs one is
    still a box in the fog) and moving any collider to suit a nicer shape.
290. **Ruts last the run.** Round 6's groove aged out in 26 s and thinned toward the lens; a ghost left two lines of
    light gone in 7 s. Your own groove no longer ages (it settles 16% over its first seconds and stays) and runs at
    full strength to the bottom edge, with clods thrown past the lip of a deep carve. Every ghost cuts real ruts under
    its light, in the same strip and draw, and they lie on the snow ahead until you ride over them. Samples a ghost
    keeps: 360, 480, 720 by tier, drawn to 330, 420, 520 m ahead. Only the samples added since the last flush are
    uploaded, where round 6 sent every ghost's whole buffer every frame (69 KB for eight ghosts, 72 KB for your own
    groove), so it is lighter on every tier. `tests/ruts.test.ts` holds the budgets, that a rut does not age and that
    a flight leaves none.
291. **Powder is lit, trees live, weather has volume.** A billow's rim takes the key light's colour and, backlit,
    burns past white (gold at golden hour, lemon on Frostfang, orange under Ember's deck); one grain in ten glints; a
    hard carve at speed trails a body of lit lumps a sled's length behind the runner; a big touchdown's wave gets a
    second act. Low throws under half as many billows, each 1.3 times fuller. Every foliage material bends in fronts
    of wind that cross the slope (about every twelve seconds, 150 m apart), the lean growing with the square of the
    height (about 0.25 m at a pine's tip); a tree a rider shaves or passes within 2.5 m at 18 m/s or more shakes for a
    second and a half, ghosts' trees too; Sakura's blossom sheds petals, Ember's charred pines ash. Weather is one
    draw in three depth layers (6% of flakes in a 12 m box at the lens, the body, and a third reaching down the run),
    with gusts as sheets of displacement and every flake taking the frame's light; Ember's air is 45% ash that falls
    and embers that rise. Reduced motion stills the wind, the gusts and the shiver and keeps the fall and the sheds.
    No draw call or material was added for any of it. Not done: the shadow pass does not sway, Ember's wall and
    Frostfang's ice do not move, the blizzard's fog does not breathe.
292. **The world breaks, a dash has a wake, fireworks have a finale.** One pooled instanced draw of small faceted
    shards, visible only while something is broken (24, 72, 128 pieces by tier): a snowman bursts into lumps, a carrot,
    coals and a scarf; a scrape off a barrier throws splinters, off a glacier's wall ice; shaved ice throws shards;
    a gully's icicles drop ahead of a passing rider (Medium and High); a collapsing span sheds blocks. Nothing is a
    collider and nothing reads back into the sim. The dash throws a ring of white-gold as the air opens, lays two
    lines of light off the runners that hold most of a second, trails a marigold stream at scarf height, and closes
    with a last ring. A shell's break has a smaller heart in its second colour; a win's eight shells are followed by a
    finale of eleven in two seconds (Low six); sparks alive are capped at 420, 900, 1700. Colours unchanged: never
    mint or rose.
293. **What the effects cost, and what was only seen in stills.** Against the baseline's fixed frames: High within
    1.7% in triangles on all four mountains and level in calls but for Frostfang (93.1 to 95.0 mean, four to seven
    more through the Crevasse Fields, steady and **not explained**: the ruts or the weather drawn again in the ice's
    reflection is the first thing to look at); Low lighter on both mountains shot (Pinecrest 148,251 to 143,741,
    Ember 114,363 to 111,506, the same calls). The console was clean in every capture. Seen only in staged stills: the
    landing burst, ghost ruts, the breaks, the blizzard's layers, a dash's ring. The dash's wake and tail could not be
    told from powder in any still, and stills cannot show wind, shiver or gusts. Whether the wind's lean reads as
    alive or as wobble at 40 m/s, and whether ruts ahead help or clutter, needs a person.

### Round 7: a hero worth looking at (plan change 3)

294. **The hero and every ghost are drawn 1.2 times their modelled size, and the lens closes past 28 m/s.** The rider
    is in every frame. The sim's sled is a 0.55 m disc whatever is drawn, so no run changes. Measured on High at
    1280x720 (`readability.js`, which now reads the rider's drawn height): the rider is 16% of the frame's height at
    30 m/s before and 21% after, 11% and 16.5% at 44 (in pixels, 76 to 120 before and 98 to 154 after at 30; 75 to 81
    and 115 to 121 at 44). The road read is level inside the probe's 2 m spread except Sakura at 44 (60 to 57 m).
    The review's "about 5%" was a hand estimate; the measured figure was 10 to 16%. The follow's lag had grown 1.5 m
    from 30 m/s to the cap while the lens opened five degrees, shrinking the hero by 28% exactly as the run got fast;
    `chaseBack` closes it.
295. **The rider is rebuilt inside the toy, and moves like it has weight.** Shoulders broader than the chest, a hood
    with a cream fur horseshoe (the one big shape the chase lens sees), a belt, a zip, pocket flaps, patches, fur
    cuffs, treaded boots, a face, a bigger pom-pom. **The mitts are vermillion:** a navy arm on a navy coat said
    nothing at speed, so a fist, a wave or a flail now reads by its mitt (this pushes ART.md 1; vermillion is still
    only ever you). The sled has five grained slats, runners that scroll up to a foot bar and a bow of bent wood.
    Elbows bend in the vertex shader (no extra draw). The hood, a hat's tail and the boots' toes ride a soft 2.4 Hz
    spring; the hem swings out late on a carve; a carve opens the shoulders, slides the hips 7.5 cm inside and turns
    the head; leaving the snow extends the body and a touchdown compresses by its impact. Ghosts ride in glass and
    move like riders. *Cost:* the hero is 6,210 triangles before and 9,652 on High and Medium (3,778 on Low), in the
    same five draws and the scarf; a ghost's body went from 2,562 to 1,802.
296. **Reactions, a fall played whole, three finishes.** Cues from the director's beats: a glance and a lean passing,
    a fist for a pass worth one, both arms for a double or a set piece swept, a look over the shoulder when passed, a
    flinch from a near miss, a slump for a set piece lost, a dusting-off after a fall. When the sim's fall lasts 1.3 s
    or more it is played whole: thrown off and rolling while the sled skids on, on its back in the snow, a sit-up with
    a shake of the head, a hop back on. The picture's cuts are read off the sim's own `FALL_TICKS` and `DOWN_TICKS`
    (42, 18 and 30 ticks of 90), so nothing needed wiring after the feel lane's merge. A win stands, pumps both fists,
    spins and lands arms wide; a podium punches one fist twice and waves with a hand on its hip; any other finish
    keeps its seat and stretches both arms overhead. Honest limits: the whole fall and the three finishes were seen
    forced on a turntable, not in a real run with the swing round it.

### Round 7: a camera that directs (plan change 4)

297. **Directed shots are data keyed to a place.** `src/game/shots.ts` `planShots(course)` is pure, so a Daily, a
    Cup and a replay get the same shots: at most one `wide`, one `track` and one `whip` a run. The wide is the tallest
    leap on the descent (the last leap at 3,980 m on Pinecrest, Frostfang and Ember, 3,746 m on Sakura); the track is
    the first street (Old Town 3,462 m, Station Street 1,474 m, Ash Market 3,655 m, Sakura's first street 1,215 m);
    the whip is the reveal ART.md 15 names (the First Drop's lip, the cavern's far mouth, the caldera's lip, the
    Blossom Leap's lip, Lanternfall's break out under the deck). None takes the steering.
298. **A held wide and a slow hero frame on the biggest leap.** The wide rides the big-air vista's own weight: 3.0 m
    further back, 1.5 m higher, 2.0 m aside and 4 degrees wider, under a letterbox of 0.8, home 0.35 s before
    touchdown. The hero frame is the director's (`heroFrameStep`), so music can land on it: a flight of 1.9 s or more
    gets it at two fifths of the way, never inside its last 0.5 s, with beats `lip`, `apex` and `out`. At `apex`
    render time eases to 0.32 for half a second and the lens pushes in on a 56 degree lens with full depth of field.
    **What "slow" is, honestly:** the sim never slows (the feed stays 1, measured on every frame), so the sled keeps
    flying at full speed; what slows is everything that integrates on render time (the scarf, powder, petals, the
    acting). It reads as a breath, not bullet time. A true slow of the flight is one word (`'both'` in
    `heroFrameStep`, tick-exact as the ward's beat is) and is left as a call. A flight at a pinned 30 m/s is about
    2.3 s, so the wide is fully open for about half a second before the push-in. Nothing in `src/audio` reads the
    `heroFrame` beat yet.
299. **A low tracking shot down a street, and a whip onto the reveal.** The track eases in 24 m into the street and
    holds 120 m: 0.75 m lower, 1.5 m toward the street's middle, 1.1 m further back on a lens 8 degrees longer,
    letterbox 0.45. The first cut sat closer and the rider filled a third of the frame. It improves the sightline it
    might have cost: road read at 30 m/s, median and worst, plain chase against the shot, Old Town 24, 24 m against
    72, 37 and Ash Market 24, 24 against 84, 53; level at 44 m/s. (The plain chase's 24 m on a flat street at 30 is
    under ART.md 8's 45 m target, is not this shot's doing, and stands outside the shot's 120 m.) The whip drifts the
    look 0.2 rad off the road over the last second, whips back in 0.22 s a touch past dead ahead and settles in 0.6 s,
    with motion blur through the snap; the look never turns more than 0.32 rad, so the road stays on screen (a test
    holds it). A phone takes half.
300. **The camera says what the lens is doing; reduced motion keeps the beats; the speed curves stay.** `cine.ts`
    carries motion blur (from the speed curve: 0 to 18 m/s, 0.34 at 28, 1 only at the cap), depth of field and its
    focus, the letterbox and the slow frame's scale, eased in the camera and read by the pipeline. Reduced motion
    leaves the lens exactly where it would be with no shots (tests compare frame for frame), keeps the letterbox, the
    depth of field and the director's beats on the same ticks, and halves speed's blur. The brief asked for FOV,
    shake and streaks retuned so 28 m/s is fast and 46 the edge; `speedfeel.ts` already holds that shape, pinned by
    `tests/feel.test.ts`, and frames at 15, 28 and 46 m/s read it, so a retune would have been change for its own
    sake. Whether 46 feels like the edge in the hand needs a human. The shots move one lens: no geometry, draw or
    material.

### Round 7: set pieces that never repeat (plan change 5, SIM_VERSION 9)

301. **Fifteen set pieces, twelve verbs, none in the game more than twice.** The review found twelve set pieces
    sharing five verbs. A mountain's three now ask for three different things with the hands:

    | Mountain | Stage 1 | Stage 2 | Stage 3 |
    | --- | --- | --- | --- |
    | Pinecrest | The First Drop: rings | Mirror Lake: slide | Old Town: steps, hops |
    | Frostfang | Serac Gate: collapse | The Crevasse Fields: race, chase | The Ice Cavern: gates, sit |
    | Ember | Cinder Gate: race, sprint | The Caldera Leap: surge | Ash Market: gates, swing |
    | Sakura | Petal Steps: steps, stair | The Blossom Leap: flourish | Temple Town: shatter |
    | Lanternfall | The Cloud Sea: follow | The Lamp Road: kindle | The First Flame: carry |

    Race, gates and steps are used twice, each in two ways that play differently; the other nine once. New: **slide**
    (hold one drift on Mirror Lake's glass, 2.2 s, or 0.75 s each way), **shatter** (be up in the air under each of
    three bells as high as it hangs: the action button's, not the steering's), **surge** (leave the Caldera's lip at
    44 or 47 m/s and land past the far line on your feet: the speed off the lip decides it, so a pop cannot fly it),
    **flourish** (land a named trick clean over the Blossom Leap), **hops** (stomp three landings your own pops make
    down Old Town), **chase** (the ropeway left before you), **swing** (each gate sways across the run), and
    Lanternfall's three (item 313). A Daily or a Cup picks a verb its run has not played yet for each stage's biggest
    place. `tests/moments.test.ts` holds "no verb more than twice".
302. **Two or three seeded variants of every set piece.** `variantOf(roll, index, count)` hashes the run's own roll
    seed, which the record carries, so a ghost rides the variant of its own run and a replay meets the same one. A
    session's first run rolls a variant like any other. The variants: rings low, on the far side, or high (pop off the
    lip); the slide long or each way; hops three or three in a row; the collapse chased, in surges, or from the far
    end to a keystone; the chase one car near, one far, or two on the rope; sitting gates turn about, from the other
    wall, or two and two; the sprint's machine leaving as you arrive, early or late; the surge at 44 or 47 m/s (only
    a dash will do); swinging gates together, against each other, or slow and wide; the stair three of four or three
    in a row; the flourish a spin and a flip, two spins or two flips; the bells level, rising (1.4, 2.4, 3.4 m) or
    along one wall; the guide light in a slow wide weave, a quick weave, or darting; the lamps both rows dark, one row
    dark, or one row then the other; the flame in still air, in a wind, or low and fed at a brazier. *Measured*
    (`moments-plan.ts --rolls 3000`): every variant of a three-variant set piece comes up on 31% to 36% of runs and
    of a two-variant one on 49% to 51%. Every variant is proved winnable by the lab's pilots within eight rides, which
    is not proof a person can.
303. **Legend moments: two a mountain, about one run in ten, never a session's first.** `chaos.ts` rolls a legend on
    a stream of its own, only on a run with no mid-run event, at `LEGEND_CHANCE` 0.15 (two runs in three have no
    event, so one in ten); `rollChaos(seed, 0)` is always plain, and the record carries it in the mood byte's high
    half. Pinecrest: the White Stag, the Lantern Fleet. Frostfang: the Aurora Comes Down, the Ghost Herd. Ember: the
    Cone Wakes, the Cinder Wyrm. Sakura: the Lantern Dragon, the Thousand Cranes. Lanternfall: the Great Rising, the
    Tall Lamplighter. Three kinds, all fair to every rider: a *runner* lays spirit lights along its weaving line 18 m
    and more ahead of the rider, a *ribbon* is a lane of light that charges the lantern (up to one), a *sky* legend is
    spectacle only. No collider, nothing on the safe line, nothing that slows. *Measured* (2,500 rolled runs after a
    first, a mountain): any legend on one later run in 10.8, 9.8, 9.6, 10.7 and 10.2; each single legend on one in 18
    to 22; on a first run 0 of 500 on every mountain; and the careful line rides every legend hit no more and no
    slower than on a plain day. The director forwards the sim's legend events as a `legend` beat and the HUD shows one
    card on its warning: the word, the name, a hairline, the line, in moonlight on ink (none of the roles' colours),
    for 3.6 s, once a run. Weak spot: the Ghost Herd's line on Frostfang's chute has no room to weave, so its lights
    lie on the safe line and every rider takes them. Not built: a legend's music and the camera's look toward it, and
    a count of legends met in the save.
304. **Mastery is never punished.** Round 6: expert 36 of 72 set pieces, mid 50. After the set pieces' lane: expert 77
    of 90, mid 76. After the sim fixes, which is what ships (`shots/r7/lab/final.txt`, six seeds on each of five
    mountains): **expert 82 of 90, mid 80**, novice 18, stunt 31, the careful line 6, hands-off 1 of 15, clumsy 1.
    Two things did it, reported apart because only one is the game. (1) *The set pieces changed.* Petal Steps asked
    for every step landed clean, which the careful line won by doing nothing (6 of 6) and the expert lost by flying
    two steps at once (0 of 6): a stomp is what counts now. A ring line set for a 34 m/s roll-off was flown over by
    anyone faster: the Caldera's became the surge, the Blossom Leap's the flourish, and the First Drop keeps rings
    with a high line for a rider who pops the lip. (2) *The pilots learned the set pieces.* Round 6's expert dashed
    the moment a lantern lit; the skilled pilots now dash into a race, a surge and the carry and not into a set piece
    that wants control. To separate the two the lab keeps the old habit as `--pilots expert-dash`: it won 70 of 90 on
    the new set pieces against the knowing expert's 77 at that point, and 36 of 72 in round 6. So most of the gain is
    the set pieces, and knowing them is worth about 7 more. The one place the expert still wins fewer than the mid is
    the Ice Cavern (4 against 5 of 6): it arrives faster than the gates want, which is the trade.
305. **What each set piece trades, so "never punished" does not become "never asked".** To win rings you give up the
    safe line at the lip; the slide, your line and speed (a 2.2 s drift carries the sled 14 to 26 m across the lake);
    hops and bells, steering (every pop is a flight you cannot steer down a street); the chase and the sprint, a
    lantern or a clean tuck; sitting gates, speed (eight gates 32 m apart want 25 to 30 m/s); the surge, a lantern and
    a landing 178 m out at 47 m/s; a swinging gate, your line; the stair, a press timed on each landing; the flourish,
    a clean landing risked on a trick; follow, the safe line (the wake counts only where the line is outside it);
    kindle, 1.8 m of room; carry, every risk on the last 880 m. In the lab the careful line and the novice lose
    nearly all of them. *Tuning that came from rides:* a slide each way is 0.75 s each (at 1.1 s no pilot won it in
    12); the bells' "under the beams" variant is gone (one flight at 45 m/s passes two bells); a lamp is lit by a
    clean pass within 2.9 m and not for half a second after any hit (ploughing down the row had lit every one);
    "one row dark" replaced lamps alternating sides (0 of 12 at 40 m/s); the guide light's wake is 2 m either side
    and counts only where the light is 2 m or more off the safe line (the careful line had won the darting light 6 in
    6 by never leaving the line). Honest limits: the collapse is as easy as round 6 left it and the careful line now
    wins it 6 of 6 (item 341); the carry is the most forgiving new verb, on purpose; on Sakura the skilled pilots win
    nearly everything, and a person should check it does not feel given.
306. **Three faults the set pieces had been hiding were the course's or the lab's, and each is fixed at its cause.**
    *The Blossom Leap's rock:* the lab's expert popped the fork's kicker at 35 m/s, flew 120 m past its landing box
    and met a rock 4.5 m off the line 70 m above the lip at over 40 m/s. A person who pops that kicker meets it too,
    so nothing now stands within 5.5 m of the safe line for 80 m above any leap's lip (`LEAP_RUN_IN`). Forced
    variants, expert, six seeds: two spins 0 to 6, two flips 0 to 6. *The slide was a coin flip:* obstacles stood on
    the lake from 8 m off the line and a slide carries a sled 10 to 25 m, so they now keep to the shores, 17 m and
    more out; and the pilots swung wide before sliding and popped a kicker 85 m above the lake. Forced variants, 24
    seeds: the long slide mid 11 to 22 and expert 17 to 19, a slide each way 4 to 21 and 7 to 22, with novice, line
    and stunt at 0 of 24. It is a test now: a rider who knows it wins it nine times in ten. *The careful line and the
    trees* was the lab's pilot (it had the mid pilot's spin habit and drifted off the line in the air); with still
    hands it takes 0 wards a run where it took 1.0 and rides 144.6 s where it rode 153.6. One real fault turned up
    behind it: nothing now stands within 5.5 m of the line through a mogul field and for 30 m past it (`MOGUL_EXIT`).
    Riding unhurt, the line pilot exposed two gifts, both closed: the near car of the chase (its lead is 58 to 70 m:
    line 6 of 6 to 0 of 12) and the carry in still air (item 314).
307. **A botched landing is always said.** `land()` raises a `land` event for a landing that floors a racer too
    (`quality: 'sketchy'`, `botched: true`), before whatever becomes of it. The surge and the flourish are decided on
    that tick, so neither is left hanging to the far end, and a botched landing loses the surge even when a ward keeps
    the rider up: "on its feet" does not mean saved. A bot that came down on its head used to stay in its air mode
    until its next takeoff; the same event fixes it. Sound, rumble and camera now see a sketchy landing on the tick
    of a fall, and nobody has listened for a doubled thud.
308. **Pool riders try every verb, and now win the three they never won.** A ghost that shows how a set piece is won
    is worth more than one that rides past. Round 6's riders threaded no gate in any pool (0 of 42 on all four gate
    streets): they asked a set piece's line for a wanderer's room. A rider who tries one now rides its own line with
    0.25 m to spare, reads a swinging gate where it will be, springs under each bell, and dashes into a race, a surge
    and the carry. The set pieces' lane still left three at 0; the sim fixes found the bot at fault each time (it
    turned for each gate only once past the last; it waited for a perfect landing spot before each hop; the spring
    for the first bell has to start before the street). In the bundled pools, won of riders who met them: the Ice
    Cavern 0 of 45 to 11 of 47, Old Town 0 of 47 to 12 of 49, Temple Town 0 of 46 to 27 of 50, Petal Steps 5 of 46 to
    30 of 50, the carry 31 to 36 of 50. Still under a fifth and not looked at: the slide 6 of 49, the guide light 4
    of 50, the Lamp Road 7 of 50, the rings 9 of 50, the flourish 9 of 50.
309. **A climax on every mountain, keyed to the sled and never the clock.** `climaxOf(course)` gives the last stage's
    shape in metres (the last set piece, the last lip, where a sled lands it, where the square begins, the line) and
    `coastSeconds` turns any stretch into seconds, so a build can be counted down to land on the beat. The last lip
    is 16.2 to 16.5 s from the line at a coast on four mountains (26.2 s on Sakura, whose last leap is before Temple
    Town); a skilled rider covers the last 880 m in about 21 s against 27, which is why the music counts from the
    sim's position. In the world (`climaxworld.ts`): strings of five lanterns hang over the run every 34 m from the
    last landing to the line and take light in a wave that starts 50 m ahead of the sled and is 310 m ahead by the
    line, so the square is lit before the rider is in it; two beams over the line grow from 18 to 64 m; shells go up
    at the landing, at the town and, timed from the sled's own speed, over the line as it crosses. Honest limits: the
    two beams were not found in any frame and no shell was caught in one; the strings carry the climax. Shells before
    the line fire on every finish, win or not.
310. **One kit for everything staged, and light that covers.** `momentkit.ts` holds three pooled instanced draws
    (camera-facing glows, marks on the snow, solid forms) and hides each that holds nothing, so with no set piece,
    legend or climax in reach it reports 0 draws. The first cut was additive like round 6's pillars and on High in
    daylight it was invisible: 21 sprites and 4 marks were being drawn at the First Drop and none could be found in
    the frame. Both materials are now premultiplied and cover part of what is behind them, so a mark is paint by day
    and light by night, and marks on sunlit snow are a deep marigold (#FF9E1A) with value against white. A lit form is
    brightest facing the lens and deeper at its rim (without it a lantern was the review's "yellow block" again),
    dissolves over its last 7 m to the lens, and on Low is capped by its brightest channel so a lantern stays marigold
    instead of clipping white. **The black one-pixel dashes under the lantern gates were a `pow()` of a negative:** a
    pillar's varying extrapolates below zero past a quad's edge under MSAA. Clamped, and checked at Old Town and the
    Ice Cavern on High and Ultra with and without the post stack.
311. **Every verb is a thing in the world, and eight legends have bodies.** Round 6's gate strings, pillars and
    garland are gone. Rings: chevrons to the take-off slot and a dotted arc of light through the three rings, low,
    far-side or climbing. Slide: the drift scribed in the ice behind the sled, brightening a quarter at a time. Hops:
    strings of five lanterns over the street that take light stomp by stomp in a wave. Collapse: lamps down both
    edges of the span that go out as it falls, and a keystone to reach in the far-end variant. Chase and sprint: each
    car's own lamp, a signal mast of three lamps at the station that tells early from late. Sitting gates: two strings
    of three paper lanterns on a yoke with a line on the snow from each opening to the next. Swinging gates: the same
    yoke on a pendulum from a pivot 11 m up, its bob where the sim has the gate this tick. Surge: a forge gate of two
    iron masts whose five flames climb with the sled's speed and roar when it leaves fast enough. Stair: a lantern
    arch a step. Flourish: two paper wheels at the lip, flat for a spin and standing for a flip. Shatter: a bronze
    bell on a rope as long as the height it asks. The next target is the brightest thing and breathes; a hit is
    answered with light and debris; a miss gutters to an ember colour. Nothing drawn suggests a line the sim does not
    reward. The legends (`legendworld.ts`) each have a beginning, a peak and an end: a white stag galloping 18 m
    ahead, a sky of lanterns over the lake, violet and rose aurora curtains with a lit lane (never mint), sixteen
    translucent caribou, the cone erupting, 30 m of glowing plates swimming a ravine, a lantern dragon of twenty
    drums, rose and white cranes. The lane's own verdicts from frames: the stag, the dragon and the herd are good; the
    eruption is real but the chase lens holds the summit at the frame's top edge and needs the camera's look; the
    wyrm is thin on Low; the cranes are the weakest (pale paper on a peach sky) and were not shot in a real flight.
312. **Six places lifted, what the staging costs, and what was never seen.** The Caldera Leap has lava fields down
    both banks (near-black crust on bright cracks, a glowing heart, two breathing lights); the Ice Cavern has ribs of
    ice every third bay and a rose and gold dawn blade at its mouth; the Thousand Torii has bars of sun across the
    snow in every gap; the orchards stand in rows and Petal Steps holds flooded paddies up both banks; street lamps,
    hung lanterns and stone lanterns are lanterns; a leap's shoulders step in two or three ledges under the crowd.
    **The Caldera is the brief's first place and the least met:** it is not a lake under the flight (that ground is
    the ridden landing slope), no smoke ceiling lit from below was built, and from the ground lens the banks hide
    most of the lava. The paddies read from the air and as rims from the run. *Cost, from the kit's own count:* a set
    piece while it plays is 1 to 5 draws and under 5,600 triangles on High (the bells the most), a legend 1 to 6 draws
    and 0.6k to 13.1k (the herd), the climax 3 draws; the caldera 4 draws and 12.1k, the paddies 2 and 8.8k; sprite
    caps 72, 180, 360, 440 by tier. Whole-frame cost was not measured by the lane. *Not seen:* a slide held, a ring
    line flown, a sprint won, a keystone reached and a row of stomps were never seen won; the collapse's crack of
    light was not seen; the legends' glows changed to covering light after their captures and were not reshot; the
    last build was looked at only on the phone through Ash Market and Ember's climax.

### Round 7: Lanternfall, the fifth mountain and the finale (plan change 6)

313. **Lanternfall in the sim.** `MOUNTAINS[4]`, id `lanternfall`, seed `0x510e527f`, chosen among eight (five broke
    a promise the fairness or budget tests make). Three stages on the same lines as everywhere: **the Cloud Sea** (a
    20 m dive off the Crown at 605 m, a ravine, switchbacks), **the Lamp Road** (a 23 m leap at 1568 m that is the
    break out under the deck, a fork, an avenue, a bridge, the lamp grove) and **Firstlight** (benches, a bridge, a
    street, a chute, a 21 m leap at 3980 m, the square). Its verbs are used nowhere else: **follow** a guide light
    through the cloud in its wake, **kindle** a road of stone lamps by passing each cleanly, **carry** a flame over
    the last 880 m to the great lantern at the line. Nothing launches a sled in the cloud: kickers are left out from
    800 m to the second lip, because the cloud is ridden blind behind a light. Obstacles reuse existing kinds
    (standing stones are `spire` and `basalt`, stone lamps Sakura's `lantern`), and on Lanternfall a street stands
    between two rows of stone lamps, a pair every 20 m, 4.1 to 4.2 m off the safe line, covered by the fairness test
    like any obstacle. The Hollow King's home is Lanternfall. In the lab, mid and expert win follow 4 of 6 each,
    kindle 4 and 3, carry 5 and 6.
314. **The carry: a fall or a ward gutters the flame instead of putting it out.** As first built, a ward spent or a
    wipeout ended the carry. Now it takes a bite (0.03 of a full flame in still air, 0.018 in the wind) and the clock
    stops; from the tick the rider is riding again it has 240 ticks, four seconds, to be back at the flame's pace
    (0.6 of the speed the hill itself gives a sled there: 21 to 24 m/s on the chute, 8 to 10 in the flat square, so a
    fall in the square catches as the rider stands up); back at pace it catches with the seconds in hand it had. A
    second fall or ward while it gutters, or the time, puts it out. *Why seconds in hand against a tucked coast:*
    pausing the clock alone lost the carry anyway (a forced fall cost mid 9 of 10), and holding place against a plain
    coast let a fall leave a skilled rider better off. *Measured:* a fall forced at six places, 24 seeds, where every
    one was lost before: mid 22 to 24 of 24, expert 23 to 24, novice 5 to 12; `tests/simfix.test.ts` holds that with a
    fall the flame reaches the line no higher than without and the run is slower. Carries won over 48 seeds: novice
    20 (42%, not the half aimed for: its carries are lost on the clock), mid 46, expert 47, the line 0, **the clumsy
    pilot 0 of 46**. A sled with nobody on it covers the last 880 m in 25.4 s and loses; the clumsy pilot's quickest
    was 36.0 s. Any flame it could carry, hands-off carries too, and the only rule found that gets it there makes
    falling on purpose in the last 150 m the way to win the finale, so it was not built (item 341). The flame also
    got shorter (`CARRY_SLACK` 1.02 to 0.935: still air 25.1 s), because the careful line, once it stopped hitting
    trees, won still air 3 of 3 by coasting; it now loses by a third of a second, which is thin. The forced-fall and
    48-seed counts came from scratch scripts that are not in the repository.
315. **Lanternfall is a night mountain with a biome of its own.** `'lantern'` is a `BiomeId` (the set pieces' lane
    had it borrow Frostfang's look; that placeholder is gone), with no change to any course, pool or record. The
    colour script, to ART.md 15: *the Crown* under an indigo zenith (#0B0A3E), stars and a great pale moon, snow
    silver-lit and violet in shade, the key light lifted to 42 degrees so the slope's own face is the silver one;
    *the Cloud Sea*, a place that is not a section (`Place.span`), fog 2 to 44 m in white-violet with hazards kept
    dark in the murk and ghosts and gifts blazing; *under the deck*, the moon gone and the valley's light from below;
    *the break*, the air at its widest on the mountain; *Firstlight*, the deck thinning and the east going rose from
    3900 m under an indigo that keeps a quarter of its stars. Windows and lamps are always lit. The run's gates are
    bronze, so the rider's vermillion is the one red. It took three passes: the first had a pink sky at the Crown, an
    orange sky under the deck and a valley of lanterns nobody could see; the third made each lantern cover what is
    behind it before it adds its light, which turned the valley from snowfall into lanterns.
316. **The cloud sea, the valley of lanterns, and lamps that light the mountain.** From above the cloud is three
    sheets of billows in the gouache's three values (one on Low, two on Medium), lit warm from beneath in pools that
    hold their place while the billows drift; inside it is the palette's fog and banks of thicker cloud at the lens
    (28, 18, 10 quads, one draw) for parallax; it lets go 80 m short of the second lip, over 50 m. The valley is one
    `Points` draw moved on the GPU: 6,000 lanterns on High and Ultra, 3,600 on Medium, 1,500 on Low, in four bands of
    depth to 2.4 km, each rising through 70 to 260 m, a painted paper lantern near the lens and a mote past about 4
    pixels. Nothing of it shows from the Crown or through the cloud. The same buffer holds as many again for the
    Great Rising and the lanterns Firstlight lets go when the great lantern lights. A way lamp stands 2.7 m past the
    edge every 18 m on alternate sides (13 m in the cloud), one instanced draw; in cloud a far light is a wide soft
    halo that tightens to a flame as it comes. Every lamp within about 80 m offers a local light (13.5 m). The first
    pass flooded the streets orange: lamps came down from 1.5 to 1.15 so the snow is lilac in pools of marigold.
317. **A building is a lantern, squared and stacked; the set pieces are drawn as light.** `lanternkit.ts`: lamp
    towers (a narrow battered stone stem, three to five storeys of lit paper in a timber lattice each 0.86 of the one
    under it, a flat eave of snow, a steep cap), great standing lamps, bell frames, arched bridges of lights, houses
    of stone below and paper above, ink conifers and bare silver trees, a canal carrying lights, and lamplighters in
    robes with a long pole and a flame at its tip. No swept eaves and no lintel on two posts. Each hazard is modelled
    inside its collider (`tests/lanternworld.test.ts`). *Follow:* a paper lantern 26 m ahead on the sim's path, its
    wake on the snow as wide as the sim counts it, whole and marigold while the rider is in it, thin and cold when
    not. *Kindle:* a dark lamp holds a cold glint and a mark on the side a sled lights it from, catches with a burst,
    and a won road blazes. *Carry:* the flame stands on a short staff over the rider's shoulder (on the prow it hid
    behind the coat), as tall as it has left to burn, and drops to ember and sheds sparks while it gutters (read
    from the sim's `mo.at`). *The great lantern* hangs past the line, dark all run; won, it lights at once; on a
    finish without the flame the lamplighters light it a second later, dimmer. Low is a poster of all of it (flat
    lanterns and flames, no canal). The live band's fallback has its own Lanternfall song (Bb major, 92, a music-box
    arp) and the soundscape its owls, wind-bells and hand bells. *Cost on the fixed frames:* High 102 calls and 945k
    triangles in the mean, **about seven calls over the round's figure**, with seven frames from 2550 to 3581 m past
    a million; Medium 92 and 662k; Low 49 and 144k, on budget in the mean and over it from 3450 to 3581 m (56 to 57
    calls). *Never seen in a frame:* the Tall Lamplighter, the Great Rising, kindle's catch, the guide light's win
    and loss, the flame's gutter and catch, and the great lantern lighting; the fixed frames ride hands-off. The
    biggest standing stones are large dark slabs a harsh eye will call boxes, and the cloud sea is flat at a grazing
    angle from the lip.
318. **Graveyards for five mountains.** Five mountains of up to four places need 20 names and there were 16, so
    `GRAVE_NAMES` has six more (Snuffed Wick, Candle End, Long Sleep, Hollow Bell, Still Water, Cinder Rest). Names
    are picked by hash over the list's length, so the other mountains' places are renamed too. Eighteen places are
    pinned from the final pools.

### Round 7: The Twelve (plan change 7)

319. **A duel is a field with one promised record in it, and progress is two optional fields.** (`src/game/twelve.ts`,
    pure.) A duel is a normal run on the next rider's home mountain: their real pool record there is passed to
    `pickField` as `promised`, the mechanism Run Again already uses, so it rides whatever the mood and is the run's
    named rival, and you beat them by reaching the line ahead of their time (a wreck never wins one). The save gains
    `twelve?: { beaten: string[]; crowned?: boolean }`, written only once somebody has fallen, so an older save loads
    unchanged. *A player feels:* "Three more and I get the King." *Shown by* `tests/twelve.test.ts`: for all twelve
    riders and five paces the field holds exactly that rider's record once, as the one rival; a walk of the ladder
    visits all twelve in order; a second settle of the same run beats nobody twice. In the browser a hands-off run on
    Pinecrest rode Juno Vale as its rival, finished 4th of 6 in 2:27.3 and read "Juno Vale held you off by 12.8 s."
    with Run Again as "Rematch Juno Vale". Rejected: a duel mode with a field of one (an empty mountain is a worse
    race than the one the player knows, and a second mode is a second thing to teach) and counting any run in which
    you happened to finish ahead of a rider (the duel would never be announced, so never a moment).
320. **The ladder is gentlest first by the roster's own skill, and the next duel is the gentlest unbeaten rider whose
    home is open.** Rosa Quill, Bram Oakhollow, Pip Thistle, Juno Vale, Nessa Lumen, Tavi Rook, Old Wren, Kaito Mori,
    Ivo Crag, Suki Ember, Mila Frost, The Hollow King. Strictly in order a new player could not start (Rosa's home is
    Sakura, 24 ghosts away), so a rider whose mountain is locked waits without blocking the ones you can reach: a new
    player duels Bram, then Juno, then Wren on Pinecrest. Rejected: ordering by the pools' home times, which would
    move whenever the pools are ridden again and so would not be a story. **The cost of that choice, on the final
    pools** (`twelve-times.ts`): home records run Rosa 140.5 s, Bram 129.3, Pip 121.6, Juno 121.0, Nessa 130.8, Tavi
    121.4, Wren 120.7, Kaito 113.3, Ivo 113.5, Suki 108.0, Mila 118.1, the King 117.7. Nessa and Rosa had bad luck in
    their one run (two falls each; a re-ride with another salt would fix them and nothing else). Not luck, whatever
    the seed: Suki Ember is the quickest of the twelve at home (a dasher on the fastest mountain), Mila Frost (0.92)
    is slower at home than Kaito, Ivo and Suki (her liner style rides clean and slow), and the King's home is the
    slowest mountain, so three riders beat his home time on their own ground. A player will feel the tenth duel as
    harder than the twelfth. The two fixes are in `roster.ts`, not the pools, or the duel's target becomes a time
    relative to the mountain's pool; it is left as a call (item 341).
321. **Lanternfall opens by The Twelve, not by passes, and ends in a last race.** `mountainOpen` is the one rule: the
    finale opens when the eleven others have fallen, every other mountain by ghosts passed as before. (The set
    pieces' lane had left a placeholder at 48 passes; the ghost ladder no longer names the finale, so nothing
    promises it for passes.) The locked card reads "Beat 9 more of The Twelve", the eleventh win puts Lanternfall's
    unlock card on that run's results, and `?debug&m=4` still opens it in dev. After the King falls there, the next
    run on Lanternfall is the last race: all twelve on their real Lanternfall records and your best; it is won only
    ahead of every one of them, pays 200 gifts and sets `crowned`. A rider pays 40 when they fall, once. The last race
    rides thirteen ghosts, more than any field before (nine and yours), and was neither ridden in the browser nor
    timed on Low or a phone.
322. **The Twelve has a home on the title, a line as the run starts and a moment on the results.** The title's card
    shows the next rider's bust (twelve hat silhouettes, each a different outline, trimmed in the rider's own colour),
    their name, home mountain, time to beat and a line of character; pressing it travels to their mountain, where Ride
    becomes "Duel". The count beside it ("3 of 12") opens the ladder. As a duel starts a toast says who and what time.
    On the results the news is the card's one race line (so the phone's line budget is unchanged), the rider has the
    last word, and a rider who fell is the moment's fact with their bust tipping over. Wins, the crown and Lanternfall
    opening were looked at in the UI harness with fake models: a hands-off rider does not win a duel, and no human
    has played one.

### Round 7: a produced score (plan change 8)

323. **The score is produced offline, in code, and shipped as audio.** A renderer in TypeScript run by Node
    (`scripts/music/`: oscillators, a bowed string, plucks, winds, an FM bell, a felt piano, a supersaw, a choir,
    drums and metal, a reverb, a tempo delay, a tape stage, a bus compressor, a limiter, and BS.1770 meters). `npm
    run music` renders, masters, encodes and measures the whole score from source: five courses and the title theme.
    A player gets instruments the live engine cannot make at run time (a bowed section of five players, a choir with
    vowels, a hall) at no CPU cost while riding. No audio-generation tool (its licence for a sold game cannot be
    checked from here) and no DAW (nothing could be bounced and heard, and a build nobody can re-run is not a build).
    Every note was written here and every sound synthesized from it; `ASSETS.md` lists the files. **Nobody has heard
    any of it.** That is the largest risk in the round: instruments made of oscillators and filters can measure well
    and sound cheap.
324. **Every course has its own genre, key, tempo, metre and band, and one motif runs through the game.** Pinecrest:
    bright folk-orchestral, D major, 116, a fiddle reel. Frostfang: glassy electronica, F# dorian, 126, four on the
    floor, a major-key dawn. Ember: heavy industrial, E phrygian, 138 in half time. Sakura: plucked strings and a
    bamboo flute over a laid-back groove, Ab major, 84, swung. Lanternfall: a lullaby that grows into an anthem, Bb
    major, a slow 6/8 at 63. The title: the game's motif on a felt piano and strings, C major, 92. *Measured:* no two
    courses within 8% in tempo, 2.8 dB RMS in the shape of the spectrum, or sharing more than 22% of their instrument
    families, and `tests/audiostems.test.ts` fails if any pair comes closer. The closest by tempo are Pinecrest and
    Frostfang (116 and 126), which share no instrument; Pinecrest and Lanternfall share the orchestra, in 6/8 at half
    the pace. The motif (a rising fourth to the octave and a step down, a fall, a small arch, home) is stated by the
    title, quoted by every finale, played through by every results reprise, and Lanternfall's lullaby grows into it.
    Variety came first: no course's own hook is the motif.
325. **Stems as sections by layers, in packs, loaded after the first frame.** A course is ten sections (an intro, four
    eight-bar sections for the first two stages, a breakdown, a last-stage chorus and climb, a finale, a reprise),
    each in four layers (bed, drive, lead, peak) mastered together, so any subset is the mastered mix with instruments
    missing. One pack a course, a tier and a format, fetched in one request. **Opus in WebM, with AAC in .m4a chosen
    by a decode test:** the runtime decodes a 2 kB probe of each and the first that decodes is the format; where
    neither does, the live band plays. Two tiers: `full` (four layers, the context's rate) on a desktop on Medium and
    up, `lite` (two layers, decoded at 32 kHz) on Low, on phones and wherever only AAC decodes. The manifest, probes
    and title pack are asked for two animation frames and 250 ms after the engine is made; a mountain's pack once it
    has been shown on the title for 1.2 s or when a run starts on it; packs are kept in the Cache API. A run that
    starts before its music has arrived starts on the live band and changes over only inside its first 6 s.
    *Sizes:* 18 packs and two probes, 56.8 MB in all; a desktop player fetches 0.6 MB for the title and 4.25 to 5.95
    MB a course picked, a phone 0.5 and 1.95 to 3.5.
326. **The run sequences the sections, and the biggest leap takes a breath.** `stemform.ts` (pure, tested): sections
    follow on bar lines in the order the stage gives; a set piece, a stage line or the finish lands a drop on the
    beat nearest the moment the rider gets there (a build, the drums out for its last two beats, a hit); a wipeout
    breaks down at the next four-bar line and puts the music under water while the rider is down; the last stage has
    its own chorus and climb (a key change on four courses, full-time drums on Ember, in place of the live band's
    stepped tempo); the finish lands the finale and the reprise comes in under its last bar. Layers follow the race
    with hysteresis. **The breath:** as the sled leaves the lip of the tallest leap the score cuts to its own tail,
    and the landing starts the chorus from its top under the hit. The brief asked for the drop-out before the leap;
    it starts at takeoff, on evidence: started a third of a second before the lip by position, it also fired for
    riders who did not fly. The silence is 4.2 s at most (on Frostfang's 6.4 s flight the breakdown plays under the
    rest), and on the replayed runs it lasted 1.5 to 4.2 s. If it reads as a dropout, `BREATH_MAX_S` is the number.
327. **A stinger a verb in every course's instruments, and a motif for each of The Twelve.** One table of gestures
    (race, gates, rings, collapse, steps, follow, kindle, carry, slide, shatter, surge, flourish, won, lost and a
    plain one) is rendered for every course; a new verb is one entry and a rebuild. A stinger plays on the score's
    next beat as the set piece's card comes up. The riders' motifs (`src/audio/motifs.ts`) are played by the live
    engine in the key and on the grid of whatever is playing, on the start line when the rider is your rival and when
    they pass you (not past your wreck, not twice inside 12 s); their notes are the major pentatonic's over the key's
    bright root, so a motif sits in any course's mode.
328. **The master, as measured, and the lane's real cost.** Each piece is levelled to -16 LUFS with every layer in
    and limited to -1.5 dBFS on the full mix. The files: -16.0 to -16.2 LUFS, true peak -1.2 to -2.2 dBTP, loudness
    range 2.1 to 4.2 LU, mono loss 0.2 to 0.7 LU, phone-band loss 0.6 to 2.1 LU and **4.0 on Ember** (its weight is
    under 250 Hz by design: the course to check on a phone first). In the game, a whole replayed run on High
    (`loudness.js`): Pinecrest -15.8 LUFS, Frostfang -15.7, Ember -15.5, Sakura -15.5, true peak -1.2 dBTP on all
    four, loudness range 3.1 to 4.4 LU (round 6's finding was 2.1 to 3.3: a run's music now moves), the limiter over
    1 dB for under 1% of a run. The score first read 1 to 2 LU over the effects and the mix 1 LU hot, so its bus gain
    came down 1.5 dB (`PRODUCED_GAIN` 0.97): Pinecrest's music alone re-measured 0.9 LU under its effects; the other
    three were not measured again. From 1 kHz up the music is level with the effects or under them; from 125 to 500
    Hz it is 3 to 7 dB over, where the sidechain takes it down by up to 5 dB under landings. Audio main-thread time
    on Low, three interleaved passes: 9.3 ms a second against the live band's 8.7, a fifth fewer nodes, not
    measurably heavier or lighter. **Decoded memory is the dear part:** 108 to 155 MB at the peak of a run on a
    desktop (42 to 54 MB with the light packs), where the live band held none; the page's total was not measured.
    The build is deterministic on this machine (Ember rebuilt byte for byte). Lanternfall has no in-game numbers: the
    music lane's branch had no fifth mountain to ride.

### Round 7: a skill curve that works at both ends (plan change 9)

329. **A fall is got up from, and there are three get-ups.** A hard hit or a landing on the rider's head used to be a
    tumble twice and the wreck the third time. Now, for every rider, it is a fall: the sled slides on losing speed and
    is eased to the safe line (0.7 s), the rider lies in the snow (0.3 s), stands the sled up and pushes off (0.5 s),
    and rides again at half of cruise or the speed it had, whichever is less, untouchable for 2.5 s. The combo, the
    boost and the drift charge go; the lantern keeps what it holds, and a full lantern still takes the hit as a ward.
    A fall past the first 700 m spends a get-up; one comes back for every 200 m ridden and all of them at a stage
    line; a fall with none left is the wreck that ends the run. So what ends a run is falling four times in about a
    quarter of a mile, not falling often. *Measured* on the clumsy pilot, 48 runs: 350 m counted from the last fall
    finished 19; 200 m from the first one spent, 37; with the 2.5 s of grace, 41; with no limit at all, 42. The third
    was taken: within one run of having no rule, and the rule still means something. Rejected: a 2.1 s fall (the
    first-timer falls about nine times a run), getting up where the sled stopped (beside the tree it hit), a fixed
    number a stage, and no limit (nothing at stake, and "Ride home" would have no use). Two rules were too harsh at
    their cause: head on into something solid is a fall from 12 m/s, not 9 (a fast sled still falls on 6); and a
    steer key held through a flight, or a hold begun in the air by a thumb that meant to crouch, no longer lands a
    first-timer on its head (the landing set stops a spin in 6 ticks and brings a let-go flip round at 4.5 rad/s).
    Landings were 58% of the clumsy pilot's falls and are 27%. A fall that slides over a stage line or the finish is
    credited on the tick it crosses (it used to wait for the get-up, up to 1.5 s late).
330. **How it is fair to the ghosts and to a skilled player.** It is the sim's rule for every rider: a ghost is a
    replay of its own inputs, so it falls where its record says and nowhere else (`tests/getup.test.ts`: a record
    replayed beside three other riders gives the same falls and the same hash), and bots fall and get up under the
    same three. A fall never sets a rider forward and never sends one off faster than it came (tested). The lab
    prices every fall three ways; the price that takes the pilot out (both rides finished by the same steady hand from
    the fall on) says **no rider who can ride is ever faster for falling**: on the final sim the least a fall cost
    was novice 1.03 s, mid 2.58, expert 1.28, stunt 2.52, none cheaper of 73 falls. The clumsy pilot is the honest
    exception and stays: 36 of its 232 falls came out cheaper, because a rider flying across the slope making no
    ground is put back on the line pointing downhill. That is the rescue the fall was built to be, and no way was
    found to charge for it without taking runs from the player it is for. **The result** (`shots/r7/lab/final.txt`):
    the clumsy pilot finishes 26 of 30 where it finished 0 of 24 (Pinecrest 5 of 6, Frostfang 6, Ember 6, Sakura 5,
    Lanternfall 4, exactly two thirds, its two failures running out of the lab's 420 s with no wreck), every other
    pilot 30 of 30. Skilled times did not move with the fall alone (mid 127.4 to 127.7 s, expert 130.3 to 130.6 on the
    feel lane's four mountains).
331. **A gamepad, with rumble, in the input log.** `src/game/pad.ts` folds a pad into the one quantised byte a tick
    the keys and touch make, so a pad run replays exactly (`tests/determinism.test.ts` rides 40 s on a scripted pad
    and replays to the same hash). Either stick or the d-pad steers; A or the right trigger is the button; X, B, a
    bumper or the left trigger is the lantern; Start pauses. Tuned for a stick: nothing inside 0.14 of travel, full
    lock at 0.94, and between them the touch stick's curve, so all nine steer levels can be reached and held. In
    menus focus is the pad's cursor (`src/ui/padnav.ts`): it only moves focus and clicks, so no screen needs anything
    added. A pad is found within half a second of being plugged in, and one pulled out mid-run lets go of everything.
    Rumble (`rumble.ts`, dual-rumble): a landing's thud by its impact, a stomp's double tick, a drift release, a hit,
    a fall, a ward, a dash, a set piece won; every effect ends within 260 ms, plays only while the pad is the last
    input used, and is off under reduced motion and a setting. Glyphs follow the last input used. **Rumble needs
    hands:** no headless browser has an actuator.
332. **Hints leave.** "Steer" was on screen at 1:24 because the lesson was learned only from hands on the keys, so a
    rider who never steered kept it for ever. The steer lesson is now learned from the run's own input, is up 8 s at a
    showing, and returns only to a rider who has still never steered and is off the corridor (three showings a run at
    most). Any other lesson shown in three runs and never taken up is not shown again (the landing ring has six). The
    save counts the runs each lesson was shown in. Nine tests in `tests/hints.test.ts`.
333. **A live race on runs 2 to 20: seven real riders, laid across where you finish.** The race went quiet because a
    skilled pilot's time moves more from run to run than the field was wide: the expert rode 126.5, 127.4, 115.8,
    139.1 and 123.0 s against five riders on fixed roles between 0.88 and 1.07 of the median. From the second run on
    a mountain the field is laid across your own last runs, from a little quicker than your quickest recent run (0.94
    to 0.97 of it) to your slowest of the last three (never tighter than 1.10 of the pace at the slow end or wider
    than 1.16, after the sim fixes' sweep), and two more riders ride, seven in all. Nobody is faked: every rider is a
    record replayed as it was ridden. *Measured in the race lab* (`race-lab.ts`: the pilot lab's rides against fields
    built exactly as the game builds them, runs 2 to 6, twelve orders, five mountains, final pools), share of a run
    with a ghost within 40 m, fixed roles to now: novice 0.56 to 0.62, mid 0.64 to 0.73, expert 0.54 to 0.70, stunt
    0.51 to 0.65; the expert's quiet runs fall from 20 to 8 of 300. Fifteen settings were swept and nothing but the
    count moves it by more than 0.02: an eighth rider is worth 0.02 to 0.03 for every pilot and was left out because
    nobody has timed one on Low. **The browser does not show it yet, and this is not claimed:** telemetry on
    Pinecrest, five runs a pilot on the feel lane's build, read mid 0.65 to 0.66 over runs 2 to 5, expert 0.47 to
    0.36 and stunt 0.58 to 0.50. Four runs a pilot cannot tell 0.5 from 0.65, and every quiet run had the cause the
    change is for (in the game these pilots swing 15% from run to run, more than in the lab). It wants twenty runs a
    pilot. Rejected: a wider string of five, nine on every run (Haunted Hollow's whole idea), and riders who read you
    on every run (that is faking a ghost).
334. **The pools get a fast end, and it is as fast as a bot can ride.** Each named mountain's pool adds eight racers:
    the quickest of 96 more runs in a new `racer` style (tucked on straights, every set piece tried, every lantern a
    dash), each half a second from the next. The bundled pools hold 46 to 50 riders and 33.6 to 39.1 KB each. Like
    for like at skill 1, a racer's quickest of 48 is 1.5 to 4.6 s quicker than the crowd's kind (Pinecrest 107.9 to
    105.9, Lanternfall 111.6 to 107.0). The pools' quickest are 104.5 to 110.5 s by mountain. **A human at 103 s
    still has nobody ahead on four mountains:** the best bots' best 250 m splits sum to 101 s on Pinecrest against a
    quickest run of 108, so what is missing is consistency, not a trick. A Daily's and a Cup's worker pool gets two
    racers from six more runs (25 bot runs where there were 19, about 0.25 s more in node; not timed in a browser):
    its quickest rider went from 113.9 to 109.0, 109.3 to 108.2, 113.7 to 107.5 and 109.7 to 108.5 on four Dailies.

### Round 7: your run, directed, and screens that belong to the look (plan change 10)

335. **Watch Your Run: a highlight reel cut from the run's own record.** A button on the results starts a dynamic
    import (15.2 kB, nothing of it in the first frame's chunk). `ReelScanner` re-simulates the record a slice a frame
    under the opening card, noting every flight, pass, set piece won, the legend, the fastest moment and the finish or
    wreck; `planReel` claims windows in order (the finish or wreck, the legend, each set piece won, the best leap, the
    closest pass, then the fastest stretch) until there are 20 s, never overlapping, trimmed to 30. Four lenses
    (`side`, `low`, `wide`, and an `orbit` round a flight, nearest at its apex), under a full letterbox. **The reel
    owns its sim, so its slow frame is a true one:** the flight itself hangs at 0.28, where the run's hero frame can
    only slow the picture. The ghosts are where the run's were (`GhostTrack.warps` keeps every clock a paced rider
    rode on). Cards name the shot ("Best leap, 5.9 s", "Passed Pete_on_Tour at Timberline Glades"). Reduced motion
    makes every shot a tripod. Skip works from the first frame. **Sharing:** CrazyGames' `inviteLink` takes string
    parameters and the game already sends a record in `c`, so a reel link is that link with `reel=1`; whoever opens
    it watches the reel on the title (one record, so no ghosts), then has the challenge. No video is recorded.
    `tests/reel.test.ts`: the scan's hash is the replay's; windows never overlap and total 12 to 30 s on fifteen pool
    runs. Seen in the browser on High, Low, a phone, under reduced motion and for a wrecked run, console clean.
    Limits: the reel has no director, so beat-driven picture (a pass's shatter, the finish's celebration) does not
    play in it; no ghost's name shows in the pass shot; the cut is laid on bar lines only when the audio gives a
    tempo, and the hook it asks for (`audio.clock()`) is not in the audio engine yet, so today it keeps its planned
    lengths.
336. **The title is one composed shot a mountain, and moving between mountains is a designed cut.** Each mountain has
    a `TitleShot` (`src/game/keyart.ts`): the stretch of its course the reel rides, the time of the colour script the
    light is read at, and a lens for a wide screen and a tall one. The reel, its duel partner and the camera's title
    modes are the ones that were there. Pinecrest rides Old Town's lamplit street at gold and out over the Valley
    Leap; Frostfang the Crevasse Fields under the aurora; Ember its run-in with the cone under the deck; Sakura the
    last orchards and the Blossom Leap; Lanternfall the Crown. *A player feels:* picking a mountain shows you that
    mountain, where round 6 had one lodge. Travelling is a veil in the new place's own air that sweeps over in 260 ms
    while the world is rebuilt under it, with the place's name on it; it also hides the rebuild, which used to show
    as a frozen frame. Rejected: a still lens at a vista (a rider crosses it in two seconds and the frame stands
    empty) and a posed, motionless rider (a screenshot, not a living title). Weak: Lanternfall's shot was composed
    blind on the stand-in look, Sakura's is hazy and the cone does not read, and the reel's hero is often mid-trick
    at the first glance.
337. **Results lead with the moment; screens move the way they are built.** `resultsMoment` reads the run into one of
    four endings, each with its own words and entrance over the scene beside the card: a win ("1st", gold-white,
    slams in over a burst of rays), a podium (rises onto a silver step), a finish (sweeps in from the side), a wreck
    (drops and stays a little crooked), with the fact that made the run under it. The card keeps every line and its
    own timing: the moment starts on the same frame and adds no delay (`tests/moment.test.ts`). The title's column
    leaves off the logo's side and the cards off theirs, Ride last and forward; the HUD arrives from its corners
    once, a lit lantern's cell lifts, a set piece's card settles into its chip; "Paused" is set like the wordmark and
    the loading screen is the wordmark with its runner as the bar (inline CSS, about 600 bytes). Transform and
    opacity only, nothing loops in a plain ride, all of it off under reduced motion. *Cost:* no new draw call or
    triangle, no new image, font or request; the title's first frame with the reel staged 3,640 m down Pinecrest's
    course was 820, 951 and 961 ms against Ember at its start 878, 906 and 854, inside the noise. Owed: a proper run
    of `web-design-guidelines` on the reel lane's UI (its fetch hit a usage limit; the rules were checked by hand).

### Round 7: Low beats round 6, by design (plan change 11)

338. **Riders' labels are quads in one batched draw, not DOM.** Decisions 217 and 238 measured the page's work round
    the labels as Low's cost at 6x. Every pill, ring, shadow, pointer and dot is now a signed-distance shape in one
    fragment shader and every word a sprite from one atlas (`src/render/labels.ts`): one draw call after the post
    stack, none when nothing shows. Placement, priority, the dot collapse and the occlusion against the HUD are the
    code that was there; only the drawing moved. **The atlas holds whole words, not letters** (the plan said a glyph
    atlas): a word rasterised once is shaped and kerned by the browser exactly as its DOM text was, in any script,
    and a field has about ten names; digits are their own tabular sprites. *Measured:* label DOM nodes 9 before, 0
    after; a tag at 5x is the same pill to the pixel row, type included.
339. **On Low the running figures are in the canvas too.** With the labels gone, stilling the HUD's update took
    `UpdateLifecycle` from 9.5 to 4.0 ms a frame: what was left was the score, the distance and the clock, each a
    style, layout and paint twenty times a second. On Low they are sprites drawn where the HUD's layout put their
    boxes; the DOM keeps each figure painted clear and written once a second, so a reader's figure is never more than
    a second old. The other tiers keep DOM figures, and forced colours keeps the DOM path on every tier. *Measured*
    (`lifecycle.js`, Low at 6x, a very first run on Pinecrest, three passes a build interleaved): DOM writes a frame
    2.07 to 2.43 before and 0.38 to 0.52 after; frames with a write 73% to 80% before and 22% to 29% after. Those
    are counts and hold. The milliseconds do not (the machine was shared and a pass's frame count ran from 1,094 to
    2,364): `UpdateLifecycle` read lower in two passes of three, by about a third. **Whether Low's frame rate beats
    round 6 was not measured by the lane**; that is item 343's to say. The trade: Low renders at one pixel a CSS
    pixel, so on a dense phone its labels and figures are softer than the DOM gave.

### Round 7: the release check, and what the lanes left open

340. **The release check counts the whole build, its files and the initial download.** The old 5 MB check failed the
    moment the score shipped. `npm run release` now fails over 80 MB for the whole build, over 1,500 files, or over 20
    MB of initial download, which it counts as every file outside `music/`, the title's packs, the probes and the
    largest course's desktop pack (none of the music is fetched before the first frame). Measured at the last merge:
    a 59.48 MB build, a 10.43 MB initial download, 29 files, against CrazyGames' 250 MB, 1,500 files, 50 MB initial
    and 20 MB for the mobile homepage. The plan's own budget (an initial download under 6 MB and a build under 45)
    was passed on both counts by the score: 56.8 MB of it is `public/music/`. If the total must come down, shipping
    the light packs alone is 13.4 MB, and dropping the AAC packs saves 17.3 MB where every target browser decodes
    Opus in WebM.
341. **What the lanes left unwired or undecided, in one place.** Checked against the code at the last merge where it
    could be. *Unwired:* nothing in `src/audio` reads the `heroFrame` or the `legend` beat; the camera does not read
    `MarqueeWorld.legendShot()` (the eruption needs the look most); `audio.clock()` does not exist, so the reel's
    cuts are not on bar lines; nothing sounds the forge gate's roar; `LegendWorld.setConeBearing` is never called (its
    default matches Ember's cone today). *Undecided:* whether the collapse should ask more (the careful line wins it 6
    of 6); whether a struggling player must be able to light the great lantern (it needs an idea other than pace);
    the ladder's order against the home times; an eighth rider; a true slow of the flight in the hero frame; the
    letterbox over a steering shot (the street's 0.45); Medium's packs (the full ones cost 108 to 155 MB decoded);
    the AAC packs' position (`ASSETS.md`); shells on every finish. *To re-tune by eye on the merged build:* every
    local light's radius and power; the place grades' `shafts` against the new depth-cut shafts; the title shots for
    Lanternfall and Sakura; the chaos moods on every mountain, Lanternfall's above all. *To price on a quiet
    machine:* Ultra's 4x MSAA, its 4096 shadows and the mirror's march; High at this laptop's native size (the
    order to give things back is shafts to a quarter, then the old FXAA, then occlusion off); thirteen ghosts in the
    last race; Frostfang's unexplained calls on High; Lanternfall's seven calls over on High. *Housekeeping the lanes
    could not do:* a stray `C:\c` folder from a mis-resolved capture path, a stale preview on port 4522, round 6's
    shafts fan and FXAA still in the composite behind their switches, and `mountains.ts` still calls Lanternfall's
    48 passes a placeholder though `twelve.ts` is the rule. *Closed since, at the merges:* the audio reads the
    legend and hero-frame beats (347, 348), the camera reads the legend shot (345), `audio.clock()` exists and the
    reel cuts on it (350), the forge roars (349), Ember's review calls `setConeBearing` from `World.setCourse`, the
    ladder is ordered by home time (344), `mountains.ts` says The Twelve opens Lanternfall, the X3595 warning is gone
    (356), and the preview on 4522 is no longer running. The `C:\c` folder is still there, for the owner to remove:
    it holds 146 frames (161 MB) that lanes meant for `shots/r7/` (fx, light, lanternworld, momentsworld, a review).

### Round 7: the review loop and the numbers

342. **The visual review loop: the critic's scores, pass by pass.** One lane a mountain ran the owner's loop: the
    fixed frames (`frames-r7.json`) on High at 1280x720, on Low and on a phone on Medium, plus strips in motion at
    the vistas and the set pieces; a fresh critic each pass, told only the frames and ART.md section 15; fixes worst
    first; at least three passes, stop at no frame under 8 and every hero vista at 9, or at five passes. **No mountain
    met the stopping rule. Every lane ran five passes; no critic gave any frame a 9, and no hero vista reached 9.** The
    best frames are 8 to 8.5. Each lane's notes (`notes/r7-review-m0.md` to `m4.md`) hold every frame's score.

    *Reading the numbers.* Passes 1 (and on Pinecrest pass 2) were judged by the earlier model at medium effort; the
    rest by Opus 5.5 at extra-high effort, which scored the same kind of frame 0.5 to 1.5 points lower, so the means
    fall at the change of critic and are comparable only from it on. A fresh critic moves a frame by about half a
    point on its own. Low and phone are judged as the poster look ART.md 15 designs, and their minimums are mostly the
    results card over the picture.

    | Mountain | Tier | P1 | P2 | P3 | P4 | P5 |
    |---|---|---|---|---|---|---|
    | Pinecrest | High mean (min) | 7.14 (5.5) | 7.08 (5.5) | 6.91 (5.5) | 7.28 (5.5) | 6.55 (5.0) |
    | | Low / phone / motion | 6.83 / 7.25 / 7.50 | 6.74 / 7.51 / 7.38 | 6.14 / 6.62 / 7.26 | 6.33 / 7.05 / 7.29 | 5.93 / 6.59 / 7.07 |
    | Frostfang | High mean (min) | 6.8 (5.5) | 6.86 (5.5) | 6.54 (5.0) | 6.6 (5.0) | 6.69 (5.5) |
    | | Low / phone / motion | 7.1 / 7.3 / 6.7 | 6.90 / 6.97 / 6.63 | 6.31 / 6.60 / 6.35 | 6.7 / 6.9 / 6.9 | 6.50 / 6.72 / 6.44 |
    | Ember Peak | High mean (min) | 7.19 (5.5) | 6.46 (5.5) | 6.54 (5.5) | 6.80 (6.0) | 6.97 (6.0) |
    | | Low / phone / motion | 7.61 / 7.90 / 7.22 | 6.59 / 6.90 / 6.23 | 6.67 / 7.03 / 6.47 | 7.00 / 7.40 / 7.00 | 7.01 / 7.79 / 7.38 |
    | Sakura Ridge | High mean (min) | 7.57 (6) | 7.04 (6) | 7.08 (6) | 7.04 (6) | 7.38 (6.5) |
    | | Low / phone / motion | 7.7 / 7.9 / 7.81 | 6.68 / 7.11 / 6.94 | 6.88 / 7.13 / 6.94 | 6.75 / 7.04 / 7.1 | 6.86 / 7.24 / 7.63 |
    | Lanternfall | High mean (min) | 6.73 (6) | 6.4 (5) | 6.1 (4.5) | 6.66 (5.5) | 6.49 (5.5) |
    | | Low / phone / motion | 6.73 / 7.1 / 6.26 | 6.0 / 6.5 / 5.9 | 6.0 / 6.3 / 6.1 | 6.27 / 6.51 / 6.47 | 6.23 / 6.66 / 6.38 |

    *Hero vistas, the best frame of each across tiers, pass 1 to pass 5:* Pinecrest's First Drop 8 to 7, Mirror Lake
    8.5 to 8, Old Town 8.5 to 7.5, Valley Leap 8 to 8; Frostfang's span 7.5 to 7, aurora 7.5 to 7.5, Ice Cavern's
    mouth 6 to 7.5, Fang Town at dawn 7.5 to 7; Ember's cone 7.5 to 7, Cinder Gate 7.5 to 7.5, the Caldera Leap 7 to 8
    (8.5 on the phone), the bridge 8.5 to 8; Sakura's cone 7.5 to 7.5, terraces 7 to 7.5, Blossom Leap 7 to 7.5, torii
    8.5 to 8, pagoda 7.5 to 7.5; Lanternfall's Crown 6.5 to 7, the break 7.5 to 7, the Lamp Road 7 to 7, the great
    lantern lit 4 to 6 then 5.5.

    *Under one critic standard* (pass 2 or 3 on), Ember rose every pass (High 6.46 to 6.97, motion 6.23 to 7.38) and
    Sakura rose (High 7.04 to 7.38, its minimum 6 to 6.5, motion 6.94 to 7.63); Frostfang held (6.54 to 6.69) while
    its worst frame, the cavern mouth, went from 6 to 7.5; Lanternfall's worst frames rose from 3.5 to 4.5 to 5.5 with
    its means flat; Pinecrest's last critic was the harshest of the five and scored everything down (its lane compared
    pass 4 and pass 5 at the same distances and found no regression, only the fixes and capture timing).

    *What every critic named, on every mountain, that no mountain owns:* flat fuel drops near the lens and hanging in
    the sky; a ghost or a figure at the lens; the dash, ward and flow glows washing out the rider; the rider small in
    High's wides; the results card over the hero shot on a phone; boxes left in props (a kicker's lip plank, a stone
    lantern, the FINISH board's dot lettering). The first three went to one more lane (item 358). *What the loop could
    not reach in a lane:* Sakura's blossom never reads backlit (faceted canopies need new geometry); Ember's Basalt
    Halls read as its first slot (a river beside the line would be a sim change); Frostfang's span has no abyss (a
    terrain change); Lanternfall's great lantern is never framed lit with the rider (a camera beat); Low is still a
    degraded High rather than the designed poster ART.md 15 asks for (no painted shafts or rims on any mountain).

    *Cost* (each lane's frames' JSON, mean draw calls, first pass to last): High 98 to 99 (Pinecrest), 100 to 101
    (Frostfang), 91 to 99 at the slots and up to 102 in the caldera (Ember, measured with ghosts hidden), 99 to 99
    (Sakura), 103 to 99 (Lanternfall); Low unchanged or lighter except Ember's, one draw for each lava river in view.
    High sat over the brief's "near 95" before the loop started.

343. **Round 7 measured: performance, first frame, size, loudness.** The tables are in the README ("Round 7 play
    test and performance"); what they say in short. *Every tier but Low* holds 60 fps at 1x on every mountain,
    Lanternfall and Ultra included, and so does the phone on Medium and Low. *Low at 6x on a very first run* beat
    round 6 on Pinecrest and Ember in both sittings (46 and 48 against 43 and 43 on mains); on Sakura it was 39
    against 46 on mains in the morning and 27 against 24 on battery in the evening, after item 359's fixes, so the
    bar there is not settled. *The first frame* came out 370 ms later and, after item 359, is level (2,140 ms against
    2,179 ms, medians of eight at 6x on a fresh save). *Size:* 59.78 MB in 31 files, 10.73 MB initial, against
    CrazyGames' 250 MB, 1,500 files and 50 MB (20 for the mobile homepage). *Sound:* the mix at -15.4 to -16.5 LUFS
    with true peak -1.1 to -1.2 dBTP on all five mountains, a wider range than round 6's (2.8 to 5.3 LU), and the
    audio's main-thread cost level on High and a little lighter on Low. *Play:* the clumsy pilot finishes 26 of 30
    where it finished none; the skilled pilots win nine set pieces in ten; the race laid across your runs is live for
    0.62 to 0.73 of runs 2 to 6 where fixed roles gave 0.51 to 0.64; variants come up evenly and legends one later run
    in ten. Rejected: calling Low "beats round 6" on one sitting.

### Round 7: the wiring (the lanes' hooks, connected)

344. **The Twelve's ladder is ordered by home time, read from the records.** `twelve.ts ladderOrder()` sorts the
    eleven by their finished record on their own home mountain in the bundled pools, slowest first; the King, whose
    home is the finale, is last whatever his time. On today's pools: Rosa 2:20.5, Nessa 2:10.8, Bram 2:09.3, Pip
    2:01.6, Tavi 2:01.4, Juno 2:01.0, Wren 2:00.7, Mila 1:58.1, Ivo 1:53.5, Kaito 1:53.3, Suki 1:48.0, then the King.
    By skill the fifth duel asked for a time nine seconds slower than the third; a player feels the clock, not the
    roster's skill number. Nothing is hard-coded: a re-ride of the pools re-orders the ladder, ties go to skill, and
    if any of the eleven has no finished record at home the whole ladder falls back on skill. Saves were already kept
    by rider, so an old save keeps everyone it beat (a test pins it); a new player's first three duels are unchanged.
    Rejected: ordering at load in `app.ts` (the app and the tests would differ) and a hard-coded order (it would rot).
345. **A legend gets a look.** While a legend is in reach the chase turns toward its focus by up to 8 degrees and, for
    one in the sky, lets the rider sink so the sky lifts into frame, never below 70% of the frame's height. It eases in
    over about a second, gives way in the air, in a tumble and in the reveal, does not chase a runner within 3.4
    degrees of straight ahead, never takes the steering, and does nothing under reduced motion (the card and the cue
    still say the legend). *Measured* on a real ride through The Cone Wakes: the summit and the column clear the top
    edge over the bridge; a phone takes half the turn. Lanternfall's two legends hand the camera the same shape
    (`LanternWorld.legendShot()`).
346. **A legend's card stays up to be read.** Any banner waiting behind another cut it to 900 ms, and a mission toast
    took a twelve-word card down in 1.2 s. A legend's card now stands at least 2.6 s whatever waits; an event's
    telegraph still outranks it. Measured after: 2.2 to 3.8 s across four legends.
347. **A legend has its own sound.** A breath in from its side of the run, then an open fifth low on brass with four
    bells climbing a ninth and a sharp fourth, in the course's key and on the band's beat, the band ducking under it.
    That chord colour is used by nothing else, so it means "legend" on every mountain. Reaching it: a held fifth and a
    lift in the band's drive; a ribbon's quarters are bells up the same chord; leaving it, two bells down.
348. **The hero frame takes a breath in the score.** Off the lip the produced score cuts to its tail (the live band
    ducks) and air rises with a low tone, timed to crest as the frame starts; at the apex three high bells hang for the
    frame; the landing brings the band back. The breath is wherever the picture holds; the old tallest-leap rule only
    fires when no hero frame came first.
349. **Every verb's steps sound.** The cards' stingers were wired; the steps were silent or borrowed the race's brass.
    Now the bell swings in three chord tones on the band's grid; the forge gate roars (the speed off the lip against the
    speed asked, the world's own test) or gutters; the glass sings a quarter at a time; lamps catch up the ladder; the
    wake fills in soft bells and "back in the wake" sounds once in any three seconds; the carried flame is silent while
    healthy, pulses low at three tenths, sags when it gutters, breathes in when it catches and takes with a rush at the
    brazier.
350. **The reel cuts on the score.** `audio.clock()` returns the playing deck's bar and beat (Lanternfall's produced
    piece is in two). Shots are whole bars long and each cut waits for the bar line when one is within 0.6 s, else
    the next beat, never more than 0.9 s. Waiting for the bar line every time added a second a cut on a slow piece:
    rejected.
351. **The line's fireworks are a winner's.** The volley timed to the crossing is five shells at 58 m for a rider at
    the head of the field, two at 44 m for anyone else; the earlier volleys welcome everyone. A duel won from second
    gets the modest volley (the volley reads first place, not the duel).
352. **Fireworks take two of the light slots, not all of them.** A burst's 150 m reach outranked every lamp, so a
    volley of eight put the street dark exactly at the finale. Bursts are sky lights now: the two strongest are kept
    (one on Low), the rest of the slots stay the lamps'.
353. **A bell too high for its modulator plays its carrier alone.** A gate's bell an octave up at ratio 3.5 asked an
    oscillator for 26.9 kHz, which Chrome clamps and warns about. Sidebands that far up are past hearing.
354. **The slow hero frame stays on the picture's clock.** Slowing the sim's feed would not change a record, but the
    frame ends on sim ticks, so its beats and letterbox would hang a second past the slow, and the player's trick
    inputs would slow mid-flight on the biggest leap: a feel call for a person with hands on it.

### Round 7: merging the five reviews

355. **Where two reviews met in one place, both were kept.** Five lanes tuned the same render files for their own
    mountains; the merge kept each mountain's look and settled what was shared:
    - *The lens's colour split* is Frostfang's, read through the same smear as the green (the green tails behind
      lights at speed, which Lanternfall answered with a difference, are answered here), with Pinecrest's weights
      (the punch only toward the frame's edges at 0.45, the fringe from the last quarter of the radius at 0.5, High's
      fringe 0.3), Sakura's calm lens (`fringeK` 0) and Lanternfall's `glass` and `flash` dials.
    - *The finish line's own light* peaks at 1.6 where it flooded the square at 3.1 (Pinecrest); on Lanternfall it is
      the sliver its lane tuned, and the great lantern is the light at the line.
    - *A tunnel's exit flash* is a breath, 0.3 by day and 0.2 at night (Frostfang), 0.12 under Ember's smoke deck.
    - *Rock:* Ember's basalt is near black; Sakura's fins and cone are ink rock under snow; Pinecrest's lip shoulders
      are bedded outcrops.
    - *Low's lit snow:* Pinecrest's grade fields (`posterSnow`, `posterKey`, `posterCool`, `posterMute`) and Sakura's
      palette field, renamed `posterSnowSat` so the two are not read as one.
    - *A sparkle line Ember's lane dropped into Lanternfall's cloud place* (its comment about firelight) is gone.
    - *Frostfang's start* went a step paler at the horizon and a step bluer on the lit snow: Lanternfall's darker night
      had brought the two starts within 1.33 of each other in the Clear Skies test, under its floor of 1.5. Now 1.53.
356. **The console's last warning was the occlusion's depth reads.** "Gradient instruction used in a loop with varying
    iteration" (X3595, Direct3D only) printed once, the first time High's occlusion pass compiled: its contact-shadow
    march reads depth inside a loop that stops early. Depth targets have one level, so `depthAt` reads it at level 0
    explicitly and the warning is gone on a cold start. The wire lane had put it on the materials; it was the post's.
357. **The jukebox covers the wiring.** Rows for every verb's steps (the bells, the forge's roar and gutter, the glass,
    the lamps, the wake, the carried flame), a legend from its warning to its leaving, a ribbon's quarters and the
    hero frame's breath with the landing that ends it.

### Round 7: the faults every mountain shared (one more lane)

358. **The three faults every critic named, fixed once for all five mountains.** Render only; where anything stands
    and what it does is the sim's and did not move. The lane's notes are `notes/r7-shared.md`.
    - *Fuel drops* (the course's spirit lights) were the old faceted drop in the generic toon material: one flat
      yellow value lit by nothing, 1.1 m tall at any distance, so a seventh of the frame beside the lens, and a giant
      drop in the sky over a leap. Each is now a small flame (`spiritlights.ts`): a teardrop that licks at its tip,
      marigold facing the lens, amber at its rim, a pale heart, lit by the frame's light, with a soft premultiplied
      glow (on Low, with no bloom, the glow is the light). Near the lens its growth has a knee, not a cap, so one by
      the rider is about 7% of the frame and a nearer one is still a little bigger (depth reads the right way). It
      fades inside 6 m of the lens, at the frame's sides (before the speed streak can smear it) and in the top fifth
      near the lens. A great light's ring and second flame are painted in its glow; lights over a leap are joined
      by a dotted line of motes, so they read as a trail. Two draws for every light on the course, where it was up to
      three. Rejected: hiding the lights over a leap (they are the leap's line) and moving them (a sim change).
    - *A ghost at the lens.* The giant mint figure at Frostfang 2850 m was a pool ghost (`winter164`) in the air off
      the bank 2.9 to 3.8 m from the lens, a third of the frame tall, during a pass beat; the old size fade started
      at 0.38 of the frame, just over it. Now a ghost nearer the lens than the rider, more than 1.2 times the rider's
      size and over a fifth of the frame, dissolves whatever beat holds it. A ghost level with the rider is the
      rider's size and untouched, so the race beside you never blinks out.
    - *Glows bleaching the rider.* The ward's paper lantern was laid over the rider; the dash and flow rims burned in
      from a third of the silhouette; the lights that ride with the rider sat on it at full strength. Now the ward
      draws only off the rider's pixels (the rider stencil the ghosts use), the rims keep to the outer facets, the
      ride-along lights stand 3 m ahead at 0.65, and a local light on the rider rolls off past a lamp's strength. The
      coat stays navy and the beanie and scarf vermillion through a dash, a ward and a full flow.
    - *Sled undersides* in a flip take shade, the snow's cool bounce and grain, with seams on slatted sleds. No new
      draw or program.

    *Judged* by one fresh critic on 52 same-place pairs: fuel drops clearly better on all three tiers, the mint
    figure better, the rider much better, nothing broken; what it raised after (near drops turned to round orbs, the
    great light's ring, the trail, Low's lemon-white, a weak dash) was fixed and re-shot, not re-judged. *Cost:* High
    99.2 to 98.3 draws, Low 49.6 to 49.6, phone Medium 89.5 to 88.8; one more small shader program (the glow).
    *At the merge:* the new flames replace Lanternfall's own fixes for the old ones (a wider lens fade, amber on Low);
    the flame's knee and its side and top fades cover the first, and on Lanternfall's Low the flames' marigold leans
    amber as that lane had it. *Still short:* Pinecrest's "yellow lines" at 1650 m are the slide's sign
    (`verbworld.ts`), not fuel; lights over a leap still read as in the sky in a still before the lip; the ward still
    floods the Ice Cavern's snow gold; a dashing rider's sled deck is a bright plank; the Gift Storm still draws the
    old lights; a ghost passed beside the lens goes with no trace.

### Round 7: what the last measurement found

359. **The first frame is level with round 6 again, and Low re-blends its light at most five times a second.** The
    round's measurement found the first frame 370 ms later at 6x on a fresh save. A CPU profile from navigation to the
    first frame on unminified builds (`firstframe-profile.js`) named the work, none of which the first frame draws:
    - the title counted every mountain's mastery stars, each a whole course and its set pieces planned, for a medal
      wall nobody had opened: the stars are now counted when the wall reads them;
    - the landmarks flew every site from the start of the course to the title's shot (far down the mountain since
      round 7's composed titles), though nothing is made before a grace of 2.7 s: until the grace has passed, idle time
      flies them in order, as it does the sites further on (the order matters: a span that cannot clear the air turns
      into the next bank piece in a round);
    - every ghost's glass body was built when the field was set, before its replay had come in, and the dash's
      after-images were built with the rider: a body is now made on its ghost's first pose, the after-images on idle
      time or at the first dash;
    - the crowd's figure was built for Pinecrest and then again for the course's own mountain;
    - the lake mirror baked the sky on the very first frame: its first bake waits 0.4 s (a glaze shows the painted
      sky until then, as it always did before a bake).
    After: 2,140 ms against round 6's 2,179 ms (medians of eight, means 2,157 and 2,164). Rejected: splitting the
    bundle (the profile showed the script's own evaluation had not grown the first frame).

    *Low.* Exact timing of each world system on a Sakura run at 6x (`systime.js`) showed a Low frame's script grown
    by about 2.5 ms, spread thin: the renderer 0.8 ms (more uniforms a material), the labels in the canvas 0.6 ms
    (which took far more than that out of the page), the colour script 0.4 ms, the set pieces' worlds and the spirit
    lights a few tenths. The one piece worth a rule was the colour script: on a course thick with places, Sakura's
    first kilometre, its stamp moved five times a second and each re-blend repaints every colour Low bakes. Low now
    re-blends at most every 200 ms, still smooth over metres. Toggling systems off and on inside one run
    (`toggles.js`) was tried to find more and was too noisy to trust (a system that does nothing on Sakura read 7.6%).
    The second sitting ran on battery, which halves the frame rate and swings it pass to pass; Sakura's Low against
    round 6 wants a quiet sitting on mains (item 343).

## The visual lift (after round 7)

360. **The review: five lifts, ranked by how much they change what a player sees.** Asked for a "DLSS on" step in
    polish after round 7 shipped, read against the code and five critics' findings on every mountain (342, 358):
    1. *Temporal reconstruction.* High draws at up to twice the pixel density with 2x MSAA and the edge walk, Ultra 4x;
       thin things still shimmer at speed (cables, bunting, rails, tree edges, the snow's glitter). Temporal AA was
       tried and shelved soft in motion (287); `postfx/taa.ts` shows why: camera-only reprojection from depth,
       bilinear history, no sharpening, at full resolution so it bought nothing back.
    2. *Shadows to the horizon.* One cascade: 26 m on Medium, 34 on High, 44 on Ultra, none on Low. Past it nothing
       casts, so the vistas (the frames the critics judged hardest) have no ridge or forest shadows, though long
       shadows raking toward the lens is ART.md 11's second mark of a screenshot. The sun's direction is the palette's,
       keyed to metres, so a stretch's far shadows can be baked once, on idle time, as it is built.
    3. *Light that bounces and passes through.* Toon shading with a cool shade tint: Sakura's blossom never reads
       backlit, the shaded side of a building or a tree is one flat value, nothing takes the lit snow's bounce.
    4. *Edges that look made.* Every critic named boxes (the kicker's lip plank, stone lanterns, the FINISH board's
       dotted lettering) and facets close to the lens.
    5. *Low and the phone as a designed poster.* Low scored 5.9 to 7.0 and read as "a degraded High": no painted
       shafts or rims, and no shadows at all; on a phone the results card covers the hero shot.
361. **The plan: five lanes at once, each judged against round 7's final frames, merged and judged again.**
    `notes/vl-lanes.md` holds the rules. *Temporal:* draw at part of the output's resolution with a sub-pixel jitter
    and rebuild the full frame from the last frames (sharper history sampling, variance clipping, motion for what
    moves on its own, a mask so particles and glows do not smear, a sharpening pass after), replacing MSAA where it
    wins; High and Ultra first, Medium only if it pays. *Far light:* a world-space shadow field over the course,
    baked per stretch on idle at that stretch's own sun, read by every lit material past the near cascade and as the
    only cast shadow on Low. *Light:* snow bounce, sky fill, light through blossom, ice, paper and glass, a sheen on
    snow at grazing angles, and a crease light from the occlusion pass (convex edges catch a hairline of key light,
    inner creases darken). *Props:* the named pieces remodelled, a shared chamfer so every kit piece catches an edge
    on every tier, blossom as rounded clusters. *Poster:* painted shafts and rims for Low, its own take on the far
    shadows, the results card yielding the hero shot on a phone. *Budgets:* High and Ultra at most two more draws,
    Medium one and no new full-frame pass unless it replaces one, Low no pass and no more script a frame, nothing new
    before the first frame. *Judged:* each lane by one fresh critic on the same frames before and after; the merge
    by a fresh critic a mountain and by performance against round 7 on mains power.
362. **What the five lanes landed, and the merge.** Each lane's notes hold its faults, changes, critics, cost and
    shared code (`notes/vl-{temporal,farlight,light,props,poster}.md`).
    - *Far light* (`farshadow.ts`): a half-float atlas of shadow tiles, fine near and coarse out to the horizon,
      baked on idle in slices of at most 1.6 ms for each stretch's own sun, read by one function every lit material
      already runs. It adds no draw and no pass; a tile bakes in 0.4 to 1.7 ms at 1x, and nothing runs before
      900 ms after the first frame. The run's own ground casts by the low shadow light and the mountainside by the
      key light (Serac Gate's span went dark under one shadow light), a ridge's shadow keeps a breath of light, and
      it is Low's first cast shadow. Its first critic: 12 better, 41 the same, 2 worse of 55; the fixes after it were
      judged only at the merge.
    - *Light* (`materials.ts` `LIFT_GLSL`, `postfx/ao.ts`): the shade side takes the sky by the way a face is turned
      and the lit snow's bounce, blossom, ice and the ghosts' glass are lit through against the sun, and a crease
      light on High and Ultra (a convex edge catches a hairline of key light, an inner crease darkens, near the lens
      only). No draw, program or pass. Two critics: "a modest, mostly safe lift"; the gains are Sakura's blossom and
      pines, Frostfang's ice, Pinecrest's rock strata.
    - *Props* (`chamfer.ts`, `lettering.ts`, the kits): a shared chamfer on every kit piece on Medium and High, the
      named pieces remodelled (Sakura's stone lantern, Lanternfall's stone lamps, the kicker's lip), blossom as lobed
      canopies painted in three flat values, the FINISH and START boards cut as solid letters. No draw or program;
      triangles +2 to +5% on High and the phone. Two critics: 44 better, 40 the same, 1 worse; then 25 better, 17 the
      same, 0 worse. ART.md 3 now names Sakura's blossom as the one rounded hazard (below).
    - *Poster* (`poster.ts`, `palette.ts` `PosterLook`): on Low, painted shafts from the sun and a bright place, a
      painted rim on silhouettes (the hero's strongest), the sky in printed bands, the frame's foot laid over in the
      shade's colour, one draw on idle after the first frame; on a phone the results card starts at 44% of the height
      so the hero shot stands above it. Its critic: the phone's results "much better"; Low slightly better on
      Pinecrest, the same elsewhere, before its fixes.
    - *Temporal*: a reconstruction of each frame from the last ones (jitter, a history kept with a confidence,
      variance clipping, motion boxes for the rider, sled, scarf and the nearest ghosts, an after layer for
      particles and glows, a sharpen). It ships off (363).
    *The merge* kept both sides of every conflict: the poster's, far light's and light's uniforms in `shared`; the
    light lane's `applyLift` and the poster's `uPoster.x` both set by the tier; far light's field folded into the
    snow's shadow before the poster cuts its edge, so Low's far shadows take the poster's edge and colour; the
    poster's `round-sheets.sh` (tiers and labels as arguments) over the two lanes' variants; far light's `L_CABLE`
    beside props' chamfer import; in `world.ts` the poster's layer, far light's `FarWorld` and switch, and the
    temporal lane's targets, fade and bodies. One fault the lanes could not see apart: the crease light lives in
    `pipeAO`, which the reconstruction calls in the composite's place, and its uniforms were not in the
    reconstruction's material, so the crease would have read zero wherever the reconstruction ran; they are now
    the composite's own objects there too.
363. **The temporal reconstruction ships off; High and Ultra keep round 7's anti-aliasing.** Measured, it is what
    the lift asked for in the world: shimmer (DECISIONS 287's metric) down 21 to 36% on High and Ultra at as much
    sharpness, the snow's banding in camera beats gone, thin lava cracks whole. Its second critic (39 pairs: re-shot
    fixed frames, same-tick motion and 2x crops) found 8 better, 12 worse and 19 the same: moving lifts doubled (the
    gondola, the chairlift's chairs: they move on their own and carry no motion box), the rider softer with a pale
    halo at speed, a crest's blocks missing for a frame. Looked at in the 2x crop of the lake at 1763 m, the coat's
    facets and the outline are plainly softer than round 7's, and ART.md 5 puts the hero first. A third tuning pass
    was not run: the lanes had been stopped twice by the laptop restarting under load (365) and twice by usage
    limits. `PASSES` keeps the tuning (`taaMsaa`, `scale`, `sharpen`) with `taa: false`; `?taa` turns it on as tuned.
    What it needs: motion boxes for whatever moves on its own (lift cabins and chairs, gondolas, flags), the rider
    drawn after the rebuild or its history held only where its confidence is high, and a person playing it.
364. **The merge, judged: a fresh critic a mountain, then the fixes, then a second look.** 112 pairs (High, Low and
    the phone on Medium, round 7's final frames beside the merged build's at the same distances,
    `scripts/playtest/merge-pairs.mjs`).
    - *High:* a modest but real lift on Pinecrest, Frostfang, Sakura and Lanternfall (rounded, lit-through blossom,
      chamfered rocks, stones and lanterns, solid finish lettering, far shadows under an open sky); Ember near
      identical.
    - *Low:* the clearest lift on Pinecrest, Frostfang and Sakura ("long cast shadows from banks and trees now give it
      depth and look designed rather than degraded"); mixed on Lanternfall; net worse on Ember.
    - *The phone:* little visible change, the blossom and some flank shadows better.
    - *Fixed after them:* Ember's Low foot (0.34 of a shade taken from its warm deep snow) turned the foreground to
      brown mud: the foot is 0.16 and every mountain's leans half way to its poster shade. Pinecrest's Low snow
      stepped in two flat values printed the far shadows' soft fall-off as hard pale islands on a cobalt floor (a
      tree run "reads as a river"): Pinecrest's snow is one smooth ramp again and its shade leans a little to its own
      periwinkle (Frostfang, Ember and Lanternfall keep their steps). The crease light drew pale hairlines on basalt
      and tan on lit stone: its strength 0.85 (was 1.3), its floor 0.02 (was 0.045).
    - *The second look:* a fresh critic on 31 re-shot pairs (Low on Pinecrest, Ember and Lanternfall, High on Ember) found no
      hairline on stone and Lanternfall's Low neutral to better, but Pinecrest's tree runs still too deep a blue and
      Ember's ravine and bridge still brown. The cast shade was then leaned further (Pinecrest to a light periwinkle,
      Ember most of the way to a light cold plum, ART.md 15's plum-teal) and judged by eye, with the snow's colour
      sampled where the critic sampled it: Pinecrest's tree run at 2250 m from `#3B64BA` (the first merge) to
      `#718DCA` (round 7 drew a lit floor there, `#B8C3E1`; ART's shade is `#7CA6EC`), Ember's ravine at 1039 m from
      `#6A493F` to `#9E6D67`, a dusty rose in the walls' shade rather than mud. No third critic judged it.
    - *Left as found, for later:* Low lays some streets and a bridge in shade where High's are lit (Sakura's Temple
      Town, Frostfang's dawn bridge: on Low the field reaches the lens where High's shadow map takes over); a hard
      overhead band across the snow on one phone frame on Ember (a beam over the start casting through the field); a
      pale quad by the rider on Lanternfall's Low at 3581 m; Frostfang's High at 1650 m with fainter bank shadows;
      the sled's wood greyer on Low; a beaded highlight on a far parapet rail on High.
365. **The laptop restarted twice under the lanes' load.** At 9:30 and 10:31 on 19 November the machine bugchecked
    (0xD1, the faulting address ending `...8ac8` both times, as on 6, 14 and 17 November: one driver, one
    instruction) with five lanes running about eight headless GPU browsers and the CPU at 100%. Each restart ended
    the session and every lane, server and capture. The dumps need an administrator to read, so the driver is
    unnamed (the Wi-Fi and the Arc GPU drivers are the likeliest). From then on the lanes ran one browser each, three
    at most at once, and the merge's captures one at a time.
366. **Performance against round 7** (on mains, nothing else running, both builds interleaved,
    `scripts/playtest/perf-vl.sh`; frames' JSON for draws). Two sittings; the first's Low and
    desktop phases and the whole second are clean (a stopped run that kept probing spoiled the rest, and was
    rerun).
    - *High, Medium, Ultra and the phone hold their bar:* 60 fps on both builds on every mountain (High on all five,
      Medium on all five, Ultra on Pinecrest and Lanternfall, a lantern night 60 and 59, the phone's Medium, Low and
      avalanche chase, Lanternfall on the phone).
    - *Low at 6x does not:* the median of five interleaved passes, Pinecrest/Ember/Sakura, was 46/46/40 for round 7
      against 43/44/38 in the first sitting and 39/40/35 against 34/38/33 in the second; Frostfang and Lanternfall
      (one pass) 46/46 against 41/42. The laptop's speed swings by a third between passes in one sitting, but the
      merged build is behind on every mountain in both. Nothing in the frame's script shows it: each world system
      timed on a matched pair of Low runs (`systime.js`) reads 18.23 against 18.22 ms a frame, the far field 0.08 ms,
      the poster under 0.04 ms; the far bake takes 315 ms of a 30 s ride (about 1%, its longest slice 7.5 ms). Pieces
      switched off one at a time could not be told apart from the machine's drift. The brief's bar for Low is not
      met; it is the owner's call whether Low's first cast shadows and its poster are worth 2 to 5 fps at 6x.
    - *High through an avalanche chase at 4x* (one pass each): 49 against 44, then 34 against 39: noise.
    - *The first frame* at 6x on a fresh save, four rounds: 2187, 2709, 2417, 2606 ms against 2513, 2285, 2524,
      2455 (medians 2512 and 2490): level.
    - *Draws and size:* the fixed frames' mean draw calls High 98.7 to 98.2, Low 49.1 to 50.3, the phone 89.0 to
      88.8; triangles +1.6% on High, level on Low, +2.6% on the phone. The build is 118 KB larger (all script), 31
      files as before. The console is clean in every capture and on a cold start on four tiers and five mountains.


## Round 8: beauty and the hook

The owner's brief is `prompts/round-8-beauty-and-the-hook.md`: the look from an 8.5 to a 10 and the game's fun and
retention from a 7.5 to a 10, run end to end without stops. Lanes work in hand-made worktrees cut from `round-8`, each
with its notes in `notes/r8-<lane>.md`; the rules every lane works to are `notes/r8-lanes.md`.

367. **The ground truth: the live build played against the outside review, line by line** (`notes/r8-review-m0.md`,
    frames in `shots/r8/review/`). Scripted pilots and replays on the local build (byte for byte the deployed site):
    a clumsy first run with real keys, the pool's best run down all five mountains, ten runs on one Pinecrest save
    through the real Run Again and title, a Daily, a Cup, a duel won and a duel lost, Low on Ember and Lanternfall,
    the phone with touch. Nobody played it with hands. The console was clean everywhere.
    - *The look.* Confirmed: trees at the lens break into a third of the frame of flat planes, and so do Frostfang's
      crevasse walls and the cavern's rocks, most on a clumsy line (2); all five mountains open on the same centred
      trench at 250 m, though past the opening the drops and town run-ins are the best frames in the game (3); speed
      is white scratches over the picture and a radial blur that smears the banks, nothing near the line whips past
      (4); a perfect landing is a line of type and a puff the sled's size, smoke-grey on Ember, and a fall throws more
      snow than a perfect (6). Partly: the near snow is a flat ramp with speckle on four mountains, but tracks are
      broad ruts, not hairlines, and Ember already has ripples (1); Ember's and Lanternfall's open stretches are one
      value, but the Basalt Halls and Firstlight do gather light (5); the image's instability was the held-back
      rebuild's, and shimmer cannot be judged in stills (7). Wrong: results is not a plain card with a "+31" but a
      busy one of about fifteen items with no order, its one button's rider name cut off (8). Low reads as a simpler
      High, not a poster, and Lanternfall's Low pools read as stains (9).
    - *The game.* Confirmed: the air is spin and flip and nothing else (3); nobody has played it (8). Partly: there are
      tracks (the ladder, "Next: X, 0.6 s up", stars), but every one froze from run 2 to run 10 (1); moods and sleds
      change how a run plays but none is chosen on the day, and dash or ward is the one choice in a run (2); the race
      is alive but a duel is only a time to beat (4); a Daily streak exists but pays nothing, and the Cup is a lonely
      run (6); after the crown the title is the same with a trophy (7). Wrong in letter: results always names a target
      on its button (5), but it picks a ghost to rematch over a new mountain just opened.
    - *What the outside review missed, biggest first.* (a) **The race has no floor:** a hands-off autoride came 2nd of
      6 on Pinecrest, a pilot that only steers led the phone's first run from 5 s, and the mid pilot won its very
      first run; an early "1st" means little. (b) **The rewards arrive at once and then stop:** run 1 pays a win, a
      duel, an unlock, 8 stars, 4 medals and 470 gifts; run 2 a best and a podium; runs 3 to 10 pay nothing new, and a
      player who stays on one mountain stops at about run 6. (c) **A clumsy first run lasts over five minutes inside
      noise:** 8 falls, 248 m behind the last rider, the stomp hint shown 77 times and the dash hint 23; on a fresh save
      the first run is also an unexplained duel, its words landing with a pass and a draft call inside 2 s. Also: The
      Hollow King rides as an ordinary ghost on Pinecrest's second run; Comet Bob reads as an untextured white lump;
      the HUD has already grown (a trick callout off the phone's edge, the dash hint over the steering thumb); a lost
      duel pays nearly what a win does; the Daily card shows a style score beside a medal won on time.
    - *What it means for the plan (369).* The look's order stands. The game's has one change: the first hour's shape
      (a floor under the race, rewards paced across runs, a quiet first run) matters as much as any new mechanic, so
      G10, G4 and G5 are built against those three findings, and the bars harness (370) measures them.

368. **Low's lost frames: found and fixed in the far shadows; the frame rate's proof waits for a quiet sitting**
    (`notes/r8-perf.md`, the perf lane; raw output in `shots/r8/perf/`). At 6x the main thread is saturated (885 to 990
    ms of every second busy), so any added work, in the frame's callback or between frames, costs frames directly; the
    world's own systems (`systime.js`) read level because the cost sat in three.js's draw and in idle tasks. Counted
    call by call (`glcount.js`, exact run to run) and profiled per frame in units of one sim tick's cost (identical
    work on every build, so a ruler for the machine's speed), it was three things in `farshadow.ts`: the far field's
    two uniform arrays of vectors in every lit program, which three re-sends whole at every material change (about
    13 times a Low frame, 27 `uniform4fv` calls); every fine tile baked twice (the tile four chunks ahead baked before
    its casters were laid, then again a chunk later: 15 of 41 bakes); and the field looking for work every frame.
    *The fix:* the slots and the near box are one 23-texel float table read with `texelFetch`, sent only when it
    changes (about 0.3 uploads a frame on Low); `WAIT_AHEAD` 4 to 3, so each fine tile is baked once (24 bakes in a 30
    s ride, not 41 to 44); the field looks for work every 0.4 s. A Low frame's GL calls are round 7's again plus the
    poster's one draw (Pinecrest/Ember/Sakura 501/476/492 against round 7's 483/465/473 and the base's 523/492/521);
    a work-per-frame ruler in the page reads the base 5.5% over round 7 and the fix 2.4% over (low confidence). Ruled
    out: garbage collection, the page's lifecycle (level, and the lift writes no DOM in a ride), shader compiles mid-run,
    sync calls. *Not proven:* every frame-rate sitting was shared (other lanes; then another project's two headless
    browsers from 1:02 on 20 November), and one probe swung 22 to 38 fps; the last sitting read round 7 and the fix
    level within noise (23/25/23 against 22/25/22, the machine at half its usual speed). The owner's decision 2 (switch
    Low's far shadows and poster off if no cause was found) is moot: the cause was found and both stay. Milestone 4's
    quiet sitting settles the number. *For every later lane:* never put a uniform array of vectors in a shared
    material; count GL calls before and after; at 6x idle work costs its full time; 1 ms a frame at 6x is about 1.5
    fps at 40.

369. **The plan: the brief's order of value kept, the work overlapped where it shares no files and no browser.**
    - *Milestone 2's design and milestone 3's logic ran during milestone 0.* Neither needs a browser, and both decide
      what the look lanes must draw (the charm gates, the tricks' poses, the showdown marker, and the stage-line
      thresholds that moved places by up to 200 m). Each was designed, reviewed here and built under a rule that kept
      the laptop quiet for the perf lane. The gates still run in order: no look lane starts before the sim batch is
      merged, its pools regenerated and the before set shot on that build, so every before and after pair stands on
      the same course.
    - *The before set* is shot on the merged build before any look work (the v10 courses with round 7's look), not on
      the v9 live build: the thresholds moved places, so a v9 frame at a given metre shows a different place than a
      v10 one. The ground truth (367) is the live build's record.
    - *The look's lanes,* at most three at a time with one browser each, in two waves: first snow (V1), composition
      (V3) and the batch's presentation (the play lane: charm gates, trick poses and calls, showdowns); then speed and
      Spirit Flow (V4), light (V5), events (V6) and the forest (V2). Then the screens (V8 with G5, the Almanac, the
      flame, the album, the HUD's overflow on the phone), and image stability (V7) last. Each lane says what Low and the
      phone get (V9) and is judged by blind pairs (`blind-pairs.mjs`: the new frame on a seeded side, the key kept from
      the critic) and a fresh critic told nothing.
    - *Cut or held:* gentle set-piece variants (round 7's open item 3) stay out; Trials and G11's sharing are stretch
      and come last if at all; no ad placement of any kind (the owner's decision 4, made: none this round).

370. **The sim batch, SIM_VERSION 10: the air, charms, showdowns and flow, landed once** (`notes/r8-sim-design.md`,
    `notes/r8-sim.md`, the sim lane; merged by the integration lane, `notes/r8-int.md`; raw output `shots/r8/sim/`).
    Designed together on one input scheme (steer and one button, keys, mouse, touch and pad; the input byte has no
    spare bit, so everything comes from the steer, the button and the line ridden), reviewed here before it was built.
    - *The air (G1).* What the steer is doing when you press decides the trick: a press with the steer to a side grabs
      that side (tiers at 0.25, 0.67 and 1.25 s; steering with it spins at 80%, against it tweaks); centred and held it
      flips, as before; letting go of a grab inside the stomp window is a stomp. A short grab (tier 0 or 1) held through
      a landing lands clean and only a deep one (0.67 s and more) held into the snow on a committed flight is a fall:
      the dare starts where a player chooses it, and a first-timer's thumb on the button is not punished (the clumsy
      pilot's landing falls went from a quarter of its falls to an eighth). Eighteen named tricks (Spin, Backflip,
      Rail Grab, Lantern Reach, Spirit Stretch, Paper Wheel, Crane Fold, Ember Twist, Spirit Knot, Crosswind, Lamppost
      Swing off a rail's end, Snow Hare off a wall ride, and one move a sled, each a sidegrade like its trait: Pine Bow,
      Spinning Top, Fireside, Comet Tail, Will-o'-Wisp, Teacup), each paying half again the first time in a run; grabs
      and combinations were cut to about half so a rider using the whole map scores 1.67 times a spin-only one. A hint
      teaches "press, then steer" for the flip, since a steer held at the press is now a grab.
    - *Charms (G2).* Three gates a run (the start's run-in and 100 m past each stage line), each three arches side by
      side; the arch you are in as you cross is your charm for the rest of the run, no menu and no stop. The middle arch
      stands on the safe line and is always the survival family's, so a rider who does nothing still takes one. Twenty
      four charms (eight each of speed, style, survival) and seven named pairs; the offers come from the run's seed and
      `SimConfig.charmPool`, a mask the Almanac widens (six to start), and `charmGates` (1 to 3), `carry` (the Long
      Night's lantern, get-ups, charms and chaos step) and `firstRun` (a wider stomp window on a fresh save's first run)
      ride in the record's one new word, so every ghost replays its own offers and picks. Stage lines got a calm
      threshold so every gate is fair by construction (a probe found no fair window within 500 m of a stage line on 3
      of 10 courses): the stretch above a line flexes so each stage still fills, all fifteen set pieces stay in their
      own stages (moved -58 to +200 m), a few plain beats gave way, two legends got a second place, Temple Town's street
      is 34 m shorter (two bells where there were three), and the fairness suite's density promises eased where the
      thresholds took the room (online kickers 3 to 2, rails a stage 4 to 3).
    - *Showdowns and the steal (G3's record part).* A pure `rivals.ts` decides both from two trajectories, called by the
      live game and by the pool generator alike: level with an eligible rider (The Twelve in the field, your grudge, a
      friend's link, your own best) for 2 s starts a showdown to a marker 300 m on, first there takes a lantern cell and
      the points; a clean pass within 0.6 m steals a wisp (at most two a run: within 1 m with no cap gave 5.5 a run,
      because riders on one line pass that close all the time). What they give is a log token, so a run replays
      exactly. Pool riders now race a field of the seven earlier runs nearest their skill, draft it past 600 m, duel the
      signature riders and steal (no pool ghost had ever drafted before). Showdowns started a run: mid 1.27, expert
      1.39, novice 0.63, so the eligibility was not widened.
    - *Spirit Flow pays (G6).* A whole level (0 to 6) built from style points that outlives a banked combo, cooled by
      five dull seconds, dropped by a bump, a ward or a fall; it multiplies the lantern's gain (to x1.48) and points (to
      x1.6), and its speed help is 3.5% a level (5.5% made every style charm a speed charm). Best flow held and time at
      each level are run stats; a `flow` event drives the picture (V4).
    - *Also:* the spirit lights over a leap start on the snow before the lip (round 7's open item 14). Gentle set-piece
      variants were left out (round 7's open item 3 stays the owner's).
    - *Measured against round 7* (six seeds a mountain): finishes clumsy 28 to 29 of 30 (26), the rest 30 of 30; median
      seconds novice 144 (155), mid 126 (124), expert 121 (123); set pieces won novice 29 (18), mid 78 (80), expert 82
      (82), stunt 24 (31, spread over the re-laid course, not its hands). Race liveness on runs 2 to 6: novice 0.64
      (0.62), mid 0.79 (0.73), expert 0.67 (0.70), stunt 0.71 (0.65); the expert is a little short and the novice's
      passes a minute too (2.21 against 2.40). The first regenerated pools were far quieter (novice 0.53, 21% quiet
      runs): pool riders slipstreaming each other off the start line were 2.7 s ahead of a lone rider by 500 m and the
      pools lost their slow half; they now draft only past 600 m and the slow riders step 2% apart. A field of nine
      would beat round 7 on every row, but two more ghosts a frame is Low's budget, so the field stays seven. Charm
      fairness (mid and expert, every charm raced against every other on the same runs, about plus or minus ten points
      of noise): every charm and pair at or under about 60% but Hearthstone, Frost Runners and the Black Ice pair on the
      mid pilot (61 to 66%), after three retunes. The drafting and near-miss charms are not judged by that table (the
      lab has no ghosts to draft).
    - *The bars it carries:* Decisions met (four kinds a run: a charm at each gate, a lantern spent, the fork, a
      showdown; a median of 17 choices a run for the mid pilot); Expression met by the best combo (eighteen named
      tricks; the expert's best combo holds 6 to 8, the median ride's best 4 to 5); clumsy finishes 28 to 29 of 30.
    - *For a person (dev switches `?charms=all`, `?charms=<mask>`, `?gates=1|2|3`, `?firstrun`):* whether "the press
      decides" reads on a keyboard, whether the dare should start at 0.67 s, whether letting go into a landing feels like
      a stomp, whether three arches read at speed, whether charms feel like builds, whether a showdown is a moment.

371. **The spine and the first hour: one rank, an Almanac, reasons to come back, and a first hour paced by design**
    (`notes/r8-spine-design.md`, `notes/r8-spine.md`, the spine lane; the bars harness `scripts/playtest/r8-bars.ts` and
    `r8career.ts`, which rides the real sim and settles every run into a real save through the game layer).
    - *G4.* Every run pays experience into one rank (placing, passes, named tricks, set pieces, showdowns, charms found,
      missions, rungs, medals, stars, duels, contracts): experience is progress and cannot be spent, so gifts stay the
      one currency. The Almanac is fifty pages, a reward on each; pages 1 to 10 each change play (the second and third
      charm gates, charms into the pool, daily contracts, the album, a sled, mirror Pinecrest, the Long Night), the rest
      widen the charm pool to all 24 by page 43 and add mirrors, alternate hours, flourishes, titles and pieces. Page 21
      also opens Lanternfall to ride (The Hollow King's duel and the last race still need eleven of The Twelve), so a
      player stuck on the eleventh duel still sees the finale's world. **The owner's decision 3, made: monthly chapters,
      yes**, by calendar month, nothing expires, old chapters finishable any time, each chapter's set also on the garage
      shelf for gifts; and a Lantern Row of eight lanterns a finish town to light for gifts (cosmetic), so a player has
      something to want at run 100.
    - *G5's rule and G7.* Results' one button is chosen for the run (Claim, Rematch a rival within reach, Finish the
      mission, Next Duel, today's Daily, or Run Again with the nearest goal); a standing "form contract" set from the
      last five runs means a reachable goal always exists. The flame: any run lights the day, the seven-day calendar
      never goes back, one earned ember covers one missed day. Three daily contracts with a bonus for all three, refilled
      on the mountain where one is met, at most three times a day. Cup leagues of you and nineteen generated records in
      five divisions, shown as the week's records, never as live people. **The owner's decision 4, made: no ad
      placement of any kind.**
    - *The first hour, from the ground truth (367).* A first run is laid round what a steer-only rider rides on that
      mountain, its riders ease back to their own records over the last stage, and an opener leaves the line just
      ahead so a first-timer passes someone early: hands-off and steer-only first runs went from the podium 9 and 8
      times in 10 to none, the prompted novice 9 to 6, mid 10 to 9. Run 1 pays one or two things (140 gifts where it paid
      730) and the rest is spread over the first ten runs (ladders pay for climbing, medals from a mountain's second
      ride, the mastery board a row a ride, a page a run). Each hint shows at most three times a run (the stomp cue six)
      and retires after two runs ignored, and a first run's first 15 s carry one idea at a time (the clumsy first run's
      pop hint went from 47 to 74 showings to 3). The first duel waits for run 3; The Hollow King is withheld from every
      field until his duel; a duel won pays 120 gifts and 300 experience, a loss 40 experience.
    - *The bars on the integrated build:* no dead runs met (0 of the mid pilot's first 30, 0 of 100); always one run
      away met (100 of 100, mid and novice); first minute met for the prompted novice (6 of 6) and short for the
      prompted clumsy pilot (4 of 6: it slows or falls at 10 to 13 s with the opener 5 m ahead; being tuned); still new
      at run 50 met on all five mountains. The economy: the mid pilot's lifetime gifts 140, 875, 4,495, 10,145 and
      17,260 at runs 1, 5, 20, 50 and 100 (pages 2, 6, 16, 26, 35), the novice's 75 to 12,170 (pages 1 to 30), seven
      garage pieces still wanted at run 100.
    - *For a person:* whether the bar's ticks, a page turning and the one button feel like a reason to go again; whether
      the form contract reads as a goal or as homework; whether the flame feels kind or nagging; whether the opener
      reads as "the rider who set off first".

372. **The look's first wave: how it was judged, and what landed** (`notes/r8-{snow,compose,play,screens}.md`; frames,
    pairs and keys under `shots/r8/<lane>/`).
    - *Judging on stills that hold the run still.* The fixed frames come from a live pilot's run, so two builds' frames
      at one metre differed in where the rider was, which ghost was in view and what the HUD said, and the snow lane's
      first critics judged the run, not the snow. `scripts/playtest/stills.js` and `stills.sh` replay a pool rider as the
      player (`?demo=N`) on a virtual clock from a fresh save, in exact 1/60 s steps from the line, the DOM HUD hidden,
      and shoot each frame on the first tick past its metre: two shots of one tick on one build differ by a hair of the
      camera's lean and a ghost's tag (its replay runs in a worker on real time). Blind pairs (`blind-pairs.mjs`: the
      new frame on a seeded side, the key kept from the critic) and a fresh critic told nothing judge every look item.
      The before stills are `shots/r8/before-stills/` (the integrated build; each lane re-shoots its own before from the
      round-8 commit it started on, so a pair differs only by its work).
    - *V1, snow: built, short of its bar, merged in part.* Three surfaces from the course (groomed lanes smoother and
      whiter in made places and on landings, powder in wild places and on the banks, the sim's ice), glints that flash
      only when a crystal facet mirrors the light to the eye, ruts that know the surface (a frost scratch on ice, a
      shallower cut when groomed), a perfect landing that throws a ring and a veil of powder (54 billows against a
      fall's 39), Ember's spray as snow, ghosts' hanging powder and spindrift off the crests (Medium and above). On live
      frames three critics picked it 13 of 30; on stills High 0 then 4 of 10, Low 6, the phone 3. What failed: the
      wider powder trench and corduroy down the fall line read as speed lines, corduroy across it as scanlines, and the
      painted powder pillows as smudges and camouflage (worst on a tall phone frame). Those are held off by three named
      constants at the top of the snow's GLSL, and the rest was judged level (High 6 of 10; the phone 2 of 10, with
      most picks turning on which ghost sat ahead) and merged. The bar (9 of 10, the snow named unprompted) is not met;
      a second attempt starts from the lane's "What a second attempt should try" (relief from geometry before paint,
      nothing long down the fall line or regular across it, a groomed lane told by value, the phone judged on its own
      frames, ghosts hidden for a snow-only pass, the moving snow judged in motion).
    - *V3, break the trench: partly met.* The sim's own bank (9.5 m within 10 m of the edge) sets the frame from a lens
      1.5 to 3 m over the snow, so reshaping the drawn banks changed the skyline, not the layout: critics called the
      first pass "one layout, five skins" (4, 4 and 5 of 10 on stills), and a greyscale matching test passed on the
      before set too, so it proved nothing. What shipped: each opening composed past the limit (Pinecrest's fall to the
      valley, Frostfang's ice arch with walls only at the overlook's mouth, Ember's ridge over the lava, Sakura's
      terraces and torii, Lanternfall's crest over the cloud), and for its first seconds a low lens close beside the
      rider with the place past its shoulder (`shots.ts` place shots; high lenses lost every pair on rider size, stage
      starts' shots were cut where the charm gate's beam split the frame, the letterbox read as a smaller rider). The
      last critic: 5 of 10, the new frame at every opening where the shot played, and "five places" where the before
      reads as one trough. Readability at the openings no worse (Pinecrest's road from 24 to 60 m at 30 m/s). The low
      bank that would truly break the trench is a sim request for a later round (`notes/r8-compose.md` has the sections
      and sides).
    - *The batch's presentation (play).* Charm gates of light in three values, the families told by shape and colour
      (pointed azure speed, round orchid style, square leaf survival; the gates' own colours, never on the rider, a ghost
      or a hazard), a glyph legible from about 120 m, each offer's gist named as a gate comes up and the take saying what
      the charm does; a pose, a name and a sound for every trick, a deep grab's warning ring round the sled's shadow; a
      showdown's marker of light columns, the lens leaning to the rival, the pill held through the race and its result,
      pops held until it is decided; the first run's stomp flash on the sim's wider window. With a gate in reach a frame
      costs 22 GL calls and one draw on Low and High. Two critics; still weak: Fireside and Comet Tail's poses.
    - *G5 and V8 (screens).* Results as a directed five seconds over the live scene (the moment, the nearest rider
      named, Rider Rank's bar stopping short of the next page, what opened turned over card by card, one button chosen
      for the run with its whole label), everything else one level down in Details; the title's flame, Rider Rank card,
      album count and one line of news; the Almanac and the Spirit Album; the Lantern Row in the garage; the phone's
      hints moved out from under the thumbs (27 HUD scenarios, no fault). Restart to riding from 909 to about 550 ms.
      Critics: 5 then 7 of 10, every results pair to the new screen in the second. Photo mode and album frames from the
      reel were not built.

373. **V5, light that gathers: Ember met, Lanternfall back to round 7's night** (`notes/r8-light.md`; frames, pairs and
    keys under `shots/r8/light/`).
    - *Ember is lit from the lava's side.* The light that shades the snow comes from further round than the dim disc (64
      to 70 degrees right, 30 to 40 up), so the snow facing the lava is a firelit warm white and the far bank turns a
      cold plum-teal one step down; the deck's shadows take 45% of the light, not 70%. The first try (the snow dimmed
      so the light carried its whole colour, round 7's deep plum shade) read as sand and a near-black slab and lost all
      ten pairs; round 7's warm-white snow with the side key and a lighter cold shade won 8 of 10, the critic naming
      "the clearer warm-against-cool split". The journey's stops follow the places the sim batch moved.
    - *Lanternfall's night is round 7's again.* Three fresh critics, given only ART.md, read the darker road with
      stronger pools against ART.md 15's "lilac snow with a silver lit side" and "never a gold floor" and picked round 7
      2, 5 and 1 times of 10. The brief's "properly dark with warm pools" and ART.md disagree here, and ART.md wins: it
      is the owner's direction, and the critics read it as written. What a next attempt should try is in the notes
      (pools that lift the snow's own lilac toward silver, marigold only at the heart).
    - *The great lantern is lit with the rider.* It hangs 35 m past the line (it was 28 m short, just off the results
      frame), and as the finish lens swings the lamplighters walk it along its yoke to the side the lens looks back
      across, so it burns over the rider's head in the results on every tier (shafts on Medium and High). Placed from
      the lens, not the rider's side, after a rider drifting across in the last metres put it off the frame. Round 7's
      open item 10.
    - *Lamps light the air round them* (`lampAir`, Medium and High): a closed-form in-scatter inside `fogged()`, thin
      (0.06 to 0.2) in the towns, the cavern and Ember's halls; the critics read it as milk wherever it was strong. It
      first made the lights' vec4 arrays live in every fogged program (five more `uniform4fv` a Low frame); it is now
      defined only in the snow and toon materials and Low's uploads are level.
    - *The Lantern Row hangs in the world* (`lanternrow.ts`): a player's lit lanterns, marigold over each finish square
      and over the title shot's stretch; glowing paper on Low; nothing on a fresh save.
    - *Two other hours:* Pinecrest at Dusk and Sakura in the Evening (`ALT_HOURS`, palettes keyed by the hour, every
      tier through its poster).
    - *Not met:* the histogram bar (Ember's change is hue at much the same value, which the critic preferred; nothing
      but lamp hearts goes over 85% on either build); Lanternfall's value pass and its Low pools; shafts through tree
      runs and gate arches; the canyons' cold haze. No critic judged the Row, the hours or the finish's lantern: there
      is no before frame of them.
    - *Cost:* Low's GL calls level within the live ride's spread; one draw for the lantern's ribs near Lanternfall's
      square, two per hung Row; no new pass or program. GPU pass times and Low's script could not be told from the
      machine's swings while other lanes ran: the quiet sitting judges them.
    - *Merged with one change:* the lane's `slot-take.sh` still looked for two browser slots; it takes the one.

374. **V6, every action is an event: built, judged level, merged** (`notes/r8-events.md`; strips, pairs and keys under
    `shots/r8/events/`).
    - *What a player sees.* A perfect landing holds the picture at a tenth of its speed for 50 ms (98 ms at a streak of
      five, on the render clock beside round 7's hit-stop) and runs one shockwave of heaved snow out from the crater
      to about 8.5 m, with a band of the snow's white up the rider's edge. A dash ignites the rider in white-gold, cools
      the world round it (the composite leans everything but the rider colder) and turns each hazard passed inside 6 m
      to pale glass motes. A ward's lantern stands a size larger so it reads past the shoulders from behind, and its
      shards fly to the sides at the sled's pace, lit paper. A passed ghost flares in its kind's colour, rocks back and
      sheds motes from its far side, never across the rider. The finish is scaled to the result (`finishScale`): a win
      a festival, a best beaten lights the town (lamps down the square, marigold willows, lanterns let go, a bell a
      lamp), a podium a smaller show, an ordinary finish warm, a wreck gentle. Ghosts take the trick poses in the air
      (the worker packs the trick, grab side and tier into a trajectory's flags), so a ghost can do anything a player
      can, visibly.
    - *Judged on strips, not stills:* an event is motion, so each pair was a sheet of eight frames of the same seconds
      from the replayed record. Two fresh critics picked the new sheets 5 and then 6 of 10 (bar 8), naming the event
      in the new sheet in most pairs and losing them on what drew over the hero: the dash's grey sky and haloed head,
      a pass's motes on the rider's chest, two finishes read as a "gold floor", and the perfect's echoing rings read as
      "a sonar ripple". Each was fixed (the last after the second critic, so unjudged). Merged as level with the
      events now told, because no pair called the new build broken after the fixes and every beat the brief lists is
      there; the final critic loop judges them again in the integrated build.
    - *Calls made here.* A first finish on a mountain is not "a best beaten" (there is nothing to beat; its own beat is
      the mountain opening's), so it does not light the town. The town's lamps lit by the lane read weakly by day; the
      light lane's windows and lamps brightening with them is a polish item, not a reason to hold the merge.
    - *Cost.* No new draw or program on any tier and no uniform array of vectors. Low keeps every beat with fewer
      motes and without the light up the rider (10 to 15 GL calls a frame), the cooling (no composite pass on Low) and
      the dash's wisps. Low's GL calls in held frames: the perfect level, the finish +3, the dash about +8 before its
      per-hazard light came off Low, the ward about +20, which nothing the lane draws on Low explains (likely the
      ghosts in view): the quiet sitting recounts it.
    - *The machine.* The session's scratchpad was shared between lanes, and twice a helper of the speed lane's with the
      same name ran with this lane's arguments; lanes keep their helpers in a folder of their own from now on.

375. **V4, speed in the world, and Spirit Flow's look: a better picture on every pair, "faster" left to a person**
    (`notes/r8-speed.md`; strips, pairs and keys under `shots/r8/speed/`).
    - *What changed.* The near flakes are short crystals in the air, soft and out of focus close to the lens, not
      150 px white scratches. Speed's blur keeps to the frame's outer band (the corner streak and a lens blur up to
      three times a camera beat's length there); the middle, the far planes and the rider stay sharp, and only a
      whip-pan blurs the whole frame. Posts and flags strobe past 4.5 to 12 m apart at the corridor's edge (they were
      10 to 18), with a rank of tall poles 4.5 to 8 m behind them for depth. The lens opens with a surge, punches out
      on a dash and holds while it runs, and opens up to 3.5 degrees at full flow. On hard snow the sled and the lens
      chatter, hardest on ice, faint in powder, off under reduced motion.
    - *Spirit Flow* (`spiritflow.ts`, read from the sim's `s.flow` and its `flow` event): richer colour from level 1, a
      flame off the scarf from 2 (vermillion burning into marigold, never mint), wind lines from 3, sparks and the
      ghosts at their brightest at 5 and 6; a level gained is a breath in, a level lost a gutter out; a bed of air
      under the run rises a step a level, never music. Low draws the flame alone; the phone half the wind lines and
      sparks; reduced motion keeps the colour, the flame, the glow and the bed.
    - *Judged on strips of eight frames at speed.* Two fresh critics picked the new strip as the better picture 10 of
      10 both times, and as reading faster 0 of 10 both times: on a still, smear reads as speed, and the brief retires
      the smear. The bar asked for both. Merged on the first, because "reads faster" is the one thing stills cannot
      show and the edge band is one constant each in `lens.ts` and `post.ts` if a person finds it slow; it goes on the
      owner's play route as a question. The flame's last form (a saturated flame and softer wind lines, after the
      critics read the first as "a plank" and "hard cyan lines") is unit-tested and shot by the main lane after the
      merge.
    - *Two flows.* The director's round 7 display flow (earned from skill moves only, the rider's vermillion rim, the
      wind's song and "In the flow") still runs beside Spirit Flow, which reads the sim's level and its rewards. Left
      as it is for the feel pass to judge in motion: rewiring the rim to the sim's level would let a drafting pack
      light a novice's rim, which round 7 tuned out.
    - *Cost.* High: no draw at flow 0, one to three at flow; triangles up 0.2 to 2.5% (the second rank of poles). Low's
      GL calls on Pinecrest 486.4 before, 485.0 at rest and 507.4 at full flow (the flame). Readability level: the road
      reads within 2 m at 30 and 44 m/s and the tree pixels are identical. The lens pass a little cheaper (0.40 to about
      0.33 ms). Nothing new before the first frame.

376. **G9, somewhere to go after The Twelve: mirror mountains and the Long Night** (`notes/r8-modes.md`; frames under
    `shots/r8/modes/`).
    - *Mirrors.* The page shows the canvas turned over (CSS `scaleX(-1)`): no pass and no draw on any tier, where
      flipping the projection would have broken triangle winding and the `dFdx` normals in three shaders. The steer is
      read the other way where the sim takes it, so a mirrored run's record is an ordinary record and its ghosts are
      mirrored with you; tags, the edge chip and Low's canvas HUD are laid out as the player sees the screen; FINISH and
      START are built in mirror writing and the medallions' glyphs drawn turned over; a gate's offers are named left to
      right as the player sees them; sound swaps after the master. Records live under `mirror:<id>`; no duel rides a
      mirror. The title is never mirrored (its key art is composed for the logo's side). A fresh critic told only "find
      anything that reads backwards or looks wrong" found nothing backwards in 45 frames on every mountain, High, Low
      and the phone. Low's GL calls: 483.9 plain, 487.7 mirrored.
    - *The Long Night.* Whole mountains back to back as the Almanac opens legs, each leg an ordinary record under
      `night:<id>`, the lantern and get-ups held at the line carried in through `SimConfig.carry` with the last three
      charms taken (the spine carried the first three, which made every later gate a pick for one leg only), chaos
      plain, then a mood, then a mood and an event from leg 3 (the spine started events at leg 4, which a three-leg
      night never reached). Between legs one ink panel over the finish town says the leg, what rides in and that it goes
      on by itself, a bar draining 2.4 s; it goes through Run Again, as every way into a run must
      (`tests/guards.test.ts` caught the first version). Proved in node (the lab's mid pilot, four nights three legs
      deep, every carry equal to the line before, every leg replaying alone to its hash) and in the browser by a
      scripted pilot from a fresh save.
    - *Short, and left for later.* The night is long rather than hard: the sim hands every get-up back at each stage
      line, so a novice rode all ten legs on two nights of four. Holding a night's get-ups across stage lines is a sim
      flag for a later sim round (the sim is closed, DECISIONS 370); a full night's time as a second record is the
      spine's to add. Trials (the stretch) were not built. Only scripts have ridden either mode.
