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
    colours for you, gifts and the sun. The unit hangs top-centre in both orientations, right under
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
38. **The finishing order is by distance, and the results speak only in its terms.** Every row shows
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
77. **The field is built around where you crash.** The anchor A is the larger of the median of your
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
