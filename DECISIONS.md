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
