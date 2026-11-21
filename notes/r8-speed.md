# Round 8, the speed lane: speed felt in the world, and Spirit Flow as a visible top gear (V4)

Branch `r8-speed`, cut from `round-8` at fac4c46. Render, UI and audio only: nothing here reads the sim but what it is
handed (`s.speed`, `s.flow`, `s.dash`, `s.onIce`, the `flow` event) and nothing feeds back. Frames, strips, pairs and
probes are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/speed/` (listed at the end).

## How it was judged

Speed is felt in motion, so the pairs are strips, not stills. `scripts/playtest/speedstrips.js` (new) rides a pool rider
replayed as the player (`?demo=0`) on a virtual clock in exact 1/60 s steps from the start line, as `stills.js` does,
and from each strip's metre shoots 8 frames 4 ticks apart (about a fifteenth of a second). Both builds therefore show
the same ticks: the same speed, the same flow level, the same dash. Ghosts and their tags replay in a worker and differ a
little; neither critic's picks turned on them. `speedstrips-tile.mjs` (new; ffmpeg, no browser) tiles a strip two
frames to a row and four rows deep. A `scan` mode in `speedstrips.js` rides the whole run and logs speed, flow level and
dash every 25 m: the replay in the page differs from `replayRecord` in node (the page's demo decides no showdowns), so
the strips' metres were picked from the page's own ride.

The ten strips, all on High, demo 0: Pinecrest 290 m (a dash at flow 6, 52 m/s) and 2850 m (37 m/s, flow 0);
Frostfang 1290 m (46 m/s on the bridge) and 2510 m (a dash at flow 5, 50 m/s); Ember 160 m (flow 4, 40 m/s) and 1550 m
(flow 2, 41 m/s); Sakura 1280 m (a dash at flow 6, Temple Town's street) and 2380 m (46 m/s); Lanternfall 1030 m (a
dash, 47 m/s) and 2160 m (flow 6, 46 m/s). Three are full flow and four hold a dash.

Each critic was a fresh `opus` agent at high effort, given only ART.md, the pairs folder and the brief's question
("which reads faster and which is the better picture"), and nothing about what changed.

| Critic | Strips | New picked as the better picture | New picked as reading faster |
| --- | --- | --- | --- |
| 1 (`pairs1`) | first after build | **10 of 10** | 0 of 10 |
| 2 (`pairs2`, new seed) | after the fixes below | **10 of 10** | 0 of 10 |

Both critics gave one reason for both splits. The old strip carries a radial and motion blur over the whole frame, far
planes and rider included, and **a critic looking at stills reads smear as speed**. The new strip keeps the far planes,
the painted values and the hero sharp, which is why it is always the better picture ("the sharp strip is always the
better picture: it keeps the three planes, the painted values and a crisp hero, which sections 9, 11 and 15 ask for";
"ART.md puts the hero first, keeps motion blur to the camera's beats"). The second critic's best single frame of the whole
set is a new one: pair-05-A frame 1, Ember at 160 m at flow level 4 ("ART.md's Ember in one picture ... the navy and
vermillion rider is crisp with the scarf streaming").

**So the brief's bar is half met.** "Picked new in at least 8 of 10 ... which reads faster and which is the better
picture": better picture 10 of 10 twice, reads faster 0 of 10 twice. Between the two critics the edge band was given its
full strength back (below) and the second critic still read the old whole-frame smear as faster. I do not think stills
can settle "reads faster" against the brief's own rule that blur keeps to the frame's edge: the only cue a still has
that motion does not is the smear, and the brief asks for that smear to go. **For the main lane:** whether "it feels
fast" holds is a person's call in motion (the cues added below are the world rushing past: posts, flakes, the lens's
breath and chatter, the dash's surge, the edge band), or a motion-clip critic (encode-motion.mjs on both builds), which
I did not have the browser time to run under the one-slot rule.

**The streak overlay's share of the speed, named gone.** Both critics described the new strips as "a sharp world" with
"streaks on top" at the edges, and the first critic named only the old strips' whole-frame smear. Neither named the
white diagonal scratches the ground truth found (`review/high/m1-0250.png`) in a new strip; the one mention of white
radial streaks ("like scratches converging on the rider") is the second critic's pair 08 over Sakura's ice, without
saying which strip. The full-flow strips were not chosen as the best-looking
frame (that was Ember at flow 4, a new frame); the second bar is therefore short too, by the letter.

## What changed, and why a player would feel it

1. **The white scratches retired** (`nearfield.ts`). The near field's flakes smeared over a 0.045 s virtual shutter to
   150 px at the cap (84 + 66 at 720p): the white diagonal lines over every mountain's lower half. Now 0.024 s, at most
   22 + 28 px at 720p and never more than seven of the flake's own lengths, and **the light a flake catches is spread
   along its smear** (a long smear is a faint one, `sqrt(size / length)`), so a flake reads as a crystal rushing past,
   not a scratch on the glass. Within a few metres of the lens a flake is out of focus: a larger, softer, fainter disc,
   which puts it in front of the world (depth). Kicked snow off the runners is capped at 30 px.
2. **Blur kept to the frame's edge** (`postfx/lens.ts`, `cine.ts`, `post.ts`, `camera.ts writeCine`). The lens pass's
   speed blur (depth-reprojected, so it smears along each thing's own motion) is masked to the frame's outer band
   (`smoothstep(0.46, 0.95)` of the aspect-corrected radius) and runs up to three times a beat's length there; the middle
   (the far planes, the road ahead, the rider) stays sharp. `cine.edge` says how much of the blur keeps to the edge: 1
   for speed's, 0 for the whip-pan, whose blur is still the whole frame's. The composite's radial streak now starts at
   half the half-diagonal (it started at 0.3 and smeared a third of the way in), at round 7's strength. Measured: the
   second critic's "B keeps the stakes strobing past, which gives parallax" and "keeps the houses ... readable while still
   streaking the edges".
3. **Near parallax at the lens's height, in depth** (`speedposts.ts`). The posts stood 0.8 to 3 m past the edge and 10 to
   18 m apart, in one rank: on a corridor whose half-width has a median of 15 m nothing near read as rushing past. Now 4.5
   to 12 m apart (fences 4.5 to 5.5 m with their ropes), 0.5 to 2.4 m out, taller (stakes 1.6 to 2.1 m, poles 2.8 to 3.6 m)
   and thicker, and **a second rank of tall poles 4.5 to 8 m out every other station** a quarter gap off the first, so the
   bank has two speeds of parallax. They still stop short of whatever the course's `edgeLimit` names and never stand where
   the ground falls away. High 210 posts over 210 m (was 104 over 260), Medium 130 over 150, Low none, as before.
4. **A lens that breathes** (`camera.ts speedBreath`, `speedfeel.ts`). On top of round 7's FOV by speed (unchanged, so
   the hazard read is unchanged): `surgeFov` opens the lens with the smoothed acceleration (a drop or a boost, up to 3.5
   degrees) and draws it in on a slowing (up to 1.5); `dashFov` punches a dash out by 6.5 degrees in its first tenth of a
   second and holds 3 while it runs; Spirit Flow opens the lens up to 3.5 degrees at full flow, and each level's breath
   (below). The strips' FOV: a dash at flow 6 on Pinecrest 83.9 to 88.4 degrees, Frostfang's dash at flow 5 87.1 to 92.2,
   Sakura's 77.2 to 82.6; a plain stretch at flow 0 moves by at most 0.7 (CHASE_FOV_MAX 96 still caps it).
5. **Chatter on hard snow** (`camera.ts`, `rider.ts chatter`). The runners' washboard on the lens (a lift of up to 12 mm
   and a judder of the look's pitch and yaw, 2.8 and 1.5 milliradians) and on the sled and its rider (up to 20 mm and a
   degree of rock), at a beat that rises with speed (about 11 Hz at 30 m/s on groomed snow, capped at 26 Hz so the frame
   rate never folds it into a wobble). `chatterK` scales by the surface: ice 1, a groomed lane about 0.65, powder 0.15
   (`snowsurf.ts groomedAt` and `s.onIce`), none under 14 m/s, never in the air. It rides beside round 7's rumble.
6. **Spirit Flow, the top gear** (`spiritflow.ts`, new). The sim's eased flow (0 to 6) sets `flowLook`, each part 0 to
   1 and only ever climbing with the level: colour first (level 1), the trail from 2, the wind from 3, the sparks and the
   trail's brightest from 5; full flow is all of it at once.
   - *Richer colour* (`FLOW_GLSL`, called once after the grade as `pipeFlow`): vibrance that lifts muted colours most (so
     vermillion, marigold and mint hold their roles), the lights warmed a touch toward their own light and the shade a step
     deeper. Kept under reduced motion.
   - *A spirit trail off the scarf*: a flame that rises off the scarf's tip, held in the rider's own frame (offsets from
     the scarf's knot drifting straight up and a little out to the scarf's side), the rider's vermillion at the root
     burning into the lantern's marigold with a line of heat down its middle; never mint. It took four looks: left in the
     air it ran down the frame to its foot as a yellow stripe (the lens looks down on anything behind the rider); carried
     with the rider but drifting back it hung under the scarf as a hook; curled, it read as an S-shaped glyph; with a pale
     tail across its whole width it read as a "plank" by day. Under reduced motion it stays, without its flicker.
   - *Wind lines*: three to nine thin pale streams of air hung beside the line, low over the snow and under the lens,
     drawn on and let go in under a second, racing with the rider at a third of its speed so they whip past. Never under
     reduced motion.
   - *Sparks*: from flow 5 marigold sparks shed off the flame into the air the lens rushes through; a ring of them bursts
     off the scarf on a level gained.
   - *The ghosts brighter*: their glow lifted by up to 0.8 of `ghostGlow` (world.ts `setGhostGlow`, the palette's own
     glow plus the flow's lift).
   - *A level gained is a breath in, a level lost a gutter out, never HUD.* `flowBreathOf(level, from)` sizes it (bigger
     steps and higher levels breathe deeper; several levels in one frame are one breath). In: the lens draws in 1.6
     degrees over a seventh of a second and opens 3.2 past where it was, settling by 1.3 s; the colour lifts and the trail
     flares; a ring of sparks. Out: the lens sags 1.8 degrees over half a second; the colour drains for a moment; the
     trail flickers, thins and drops dim embers. The breath and the sparks are off under reduced motion; the colour and
     the trail are not.
7. **The flow's sound** (`sfx.ts flowLevel`, `flowBedTo`): a rising bed and never music. While a level is held, pink
   noise in a band that climbs from about 450 Hz at level 1 to 2 kHz at 6, louder a step a level, with a high hiss of air
   over it from level 4. A level gained is a rising sweep, longer and higher the higher the level (and a high air at 5 and
   6); a level lost is a falling sweep and a soft pfft. The bed lets go at the finish and at a crash. Not heard by a person
   yet.

## Reduced motion

Keeps the flow's colour, the trail (no flicker), the brighter ghosts and the bed; drops the chatter (lens and sled), the
breath (the speed's surge, the dash's surge and the levels' breaths), the wind lines and the sparks. The speed's own FOV
stays, as round 7 has it. Verified by the tests (`spiritflow.test.ts`: no wind under reduced motion, the trail kept) and by the code paths; a
reduced-motion capture was queued but not shot (the one browser slot stayed with another lane's long stills run).

## Low and the phone

- **Low:** the trail alone, half as wide again and 12 samples (no bloom to carry a thin flame), the ghosts' lift and the
  bed; no wind lines, sparks, posts or near field (Low had none of the last two before); its colour is baked, so there is no
  composite to lift. GL calls a frame on Pinecrest (`glcount.js`, unthrottled, 600 frames): before 486.4, after
  485.0 at rest; **507.4 held at full flow** (`?flowlook=6`): about 21 calls and two draw calls, the trail. Script per
  frame (`systime.js`, Sakura at 6x, 20 s): the two passes ran at different machine speeds (frameRun 9.1 against 14.0 ms,
  every system scaled alike), so the totals are not comparable; the ratio world.frame / renderer.render is 1.75 on both, and
  speedPosts reads 0.00 and 0.01 ms. Nothing new runs before `gs-first-frame` (Spirit Flow builds three empty buffers
  in the world's constructor and draws nothing until a level).
- **The phone (Medium):** the posts at 130 over 150 m, half the wind lines (5) and the sparks (22 a second), the colour,
  the trail; no lens pass (as before), so its edge blur is the composite's outer-band streak, at 0.6 on a tall screen.
  Not shot this round (the one-slot rule); its cost follows High's pattern on the same code.

## Cost

| Measure | Before | After |
| --- | --- | --- |
| High draw calls, mean over 8 frames a strip (10 strips) | 97.3 to 108.0 | 97.9 to 111.0: +0 at flow 0, +1 to +3 at flow (trail, wind, sparks) |
| High triangles | 571k to 1020k | +0.2 to +2.5% (the posts' second rank) |
| High GPU passes, Pinecrest demo at real time (`?gpu`, ms) | lens 0.37 to 0.40, composite 2.8 to 3.3 | lens 0.31 to 0.36, composite 1.8 to 2.3 |
| Low GL calls a frame, Pinecrest | 486.4 | 485.0; 507.4 at full flow |
| Readability, the safe line pinned (`readability.js`, 8 reads) | Pinecrest 30/44 m/s road 50/53 m, min 16/41; Ember 73/65, min 12/18 | Pinecrest 51/53, min 17/40; Ember 73/65, min 12/16; tree pixels identical |

The GPU passes were timed one build after the other on a shared machine (the scene pass read 17 against 12.6 ms), so
the lens's small drop (its middle now exits early) is the only reading I would trust. Readability is level: the pinned
speed has no acceleration, no dash and no flow, so the FOV there is round 7's. The console was clean in every capture
(every strip's `errors` is empty, before and after, all five mountains).

## Touched outside my files

- `src/render/world.ts`: Spirit Flow built, added to the scene and stepped each frame from `s.flow` and the `flow`
  events; the camera's new inputs (`dash`, `hard`, `flow`) and its `flowBreath`; the rider's `setChatter`; the composite's
  `flow`, `flowPulse`, `flowTop`; `setGhostGlow` in place of the three `ghosts.setGlow` calls (the palette's glow plus the
  flow's lift); the dev switch `?flowlook=0..6` in `devPipe` (render only: the picture held at that level, its breaths
  held, the sim untouched).
- `src/render/cine.ts`: a field `edge`. `src/render/postfx/pipeline.ts`: passes it to the lens pass.
- `src/render/post.ts`: besides the streak's band, the composite takes `FLOW_GLSL` before its `main` and calls `pipeFlow`
  once after the film block (one line in the light lane's grade section), with a `uFlowLook` uniform. The light lane
  should keep that one line wherever the grade moves to.
- `src/audio/sfx.ts`: the `flow` sim event handled, and the bed stopped on the `finish` and `crash` beats.
- `src/render/rider.ts`: only `setChatter` and `chatter()`, laid on the rig after its pose.
- Tests: `tests/feel.test.ts` (the posts' new spacing and the streak's new curve), `tests/spiritflow.test.ts` (new: the
  look climbs and comes in a part at a time, Low draws the trail alone, a level's breath in and out, several levels are one
  breath, the trail builds at flow and nothing at rest, no wind under reduced motion, the surge, the dash's punch, the
  chatter by surface).

## What the main lane must wire or decide

1. **The "reads faster" bar** (above): two critics on stills read only whole-frame smear as speed. Decide whether a
   motion critic or a person judges it, or whether the edge band should reach further in (it is one constant each:
   `smoothstep(0.46, 0.95)` in `lens.ts` and `smoothstep(0.5, 0.95)` in `post.ts`).
2. **The director's old flow** (`feel.flow`, earned flow capped at 3.5) still drives the rider's vermillion rim and the
   ambience's singing wind and "In the flow"; Spirit Flow reads the sim's level. They agree loosely. A later pass might
   drive the rim from `s.flow` too.
3. The events lane owns the dash's own look; the second critic's "the dash's gold glow swallows the rider" (Frostfang's
   bridge) is theirs.

## Still short

- The "faster" pick (0 of 10 twice) and the full-flow strip as the set's best frame (the best frame was a new one, at
  flow 4).
- The trail took four looks. Its last change (75ddc40: a saturated flame with a line of heat instead of a pale tail, half as
  wide again on Low) and the wind lines' softer tint are tested but **not shot**: the one browser slot stayed with another
  lane. The first thing to shoot is `?flowlook=6&debug` on Pinecrest and Sakura, High and Low.
- The flow's sound and the chatter are unheard and unfelt by a person.
- The phone's frames were not shot under the one-slot rule.
- What the critics named that is not this lane's: the high wide lens on Ember's ridge, the milky lilac of Sakura's street,
  a cairn tag over the line, lamp heads passing through the lens on Frostfang's bridge, the white faceted sled hiding the
  coat, ghosts that are only pills on some stretches.

## Text for ART.md (section 8, Camera and motion) and the README

> **Round 8: speed in the world.** The near flakes are crystals in the air, not scratches on the lens: a short smear whose
> light spreads along it, soft and out of focus within a few metres. Speed's blur keeps to the frame's outer band, where
> what rushes past streaks along its own path; the middle, the far planes and the rider stay sharp, and only a whip-pan
> blurs the whole frame. Posts, poles, flags and roped fences strobe past 4.5 to 12 m apart at the corridor's edge, with a
> rank of tall poles behind them for depth. The lens breathes: it opens with a surge, punches out with a dash and holds
> while it runs, and draws in a little as the run slows. On hard snow the runners chatter, through the sled and the lens,
> hardest on ice and gone in powder.
>
> **Spirit Flow.** The flow level (0 to 6) changes the picture's state as it climbs: the colour richer from level 1, a
> flame off the scarf from 2 (the rider's vermillion burning into the lantern's marigold, never mint), wind lines in the air
> from 3, sparks off the flame and the ghosts at their brightest at 5 and 6. A level gained is a breath in (the lens draws in
> and opens out, the colour lifts, the flame flares, a ring of sparks); a level lost a gutter out (the lens sags, the colour
> drains, the flame flickers and drops embers). Under the run, a bed of air rises a step a level. Reduced motion keeps the
> colour and the flame and drops the breath, the wind lines, the sparks and the chatter. Low draws the flame alone.

README, under the round's look: "Speed is felt in the world, not on the lens, and Spirit Flow is a visible top gear (the
speed lane, `notes/r8-speed.md`): `?flowlook=0..6` with `?debug` holds the flow's picture at a level to look at it."

## Where everything is (under `shots/r8/speed/`)

- `strips1/before-high`, `strips1/after-high` (first after build), `strips2/after-high`, `strips3/after-high` (judged by
  critic 2), each with a JSON a mountain (speed, flow, level, dash, FOV, draw calls and triangles for every frame, console
  errors); `*/tiled-*/high/` the tiled strips.
- `pairs1/`, `pairs2/` the blind pairs; `keys/` their keys and the critics' picks.
- `scan/` the page's own ride on each mountain (demo 0), every 25 m.
- `probe/` GL counts, GPU passes, systime and readability, before and after.
- `look*/`, `lowlook/` look-dev (Low: before and after at Pinecrest 290 m and Sakura 1280 m).
- The builds: `.claude/worktrees/r8-speed/dist/r8-speed-before` (fac4c46) and `dist/r8-speed`.

## The flow pass (after the merge, branch `r8-flow` from round-8 at f9c0c87)

The main lane shot the merged flame at `?flowlook=6` on Pinecrest and Sakura (600, 1500, 2700 m, High and Low) and a
fresh critic found two faults, worst first: fine horizontal scanlines across the snow on High, and the flame read as "a
flat yellow strip with a dotted white outline, floating clear of the scarf": a sticker, a baton, a sickle, lightning.

**The scanlines were the occlusion pass, not the flow** (`postfx/ao.ts`, the light lane's file). Shot at the same ticks
on round-8's head: the same stripes at `flowlook=0` and `flowlook=6`, with the lens blur off (`post=-blur`), and none with
the occlusion off (`post=-ao`); round-8's own before still at Sakura 1500 m has them too. Row averages over the bank read
a period of about four pixels: High's one-slice occlusion at half the frame, denoised by a 4x4 blur and a 2x2 upsample that
both drop any tap more than about 3% nearer or further than the pixel. On snow seen at a grazing angle every tap a row up
or down is that much deeper, so every vertical tap was dropped, each row kept its own phase of the 4x4 noise, and the
banks and their shadows printed as scanlines. Now both weigh a tap against the plane the pixel lies on (the depth's
slope, the smaller one-sided step in the blur and the screen derivative in the upsample, held to a ground's at most), so a
slope is blurred and an edge (a trunk on the snow) still is not. Shot after at `flowlook=0`: both spots clean
(`shots/r8/flow/crops/band-fix-m0.png`, `band-fix-m3.png`, the old build above, the new below). The composite's corner
streak's six taps now start at a per-pixel offset too, so it can never copy a level edge into parallel lines. No draw, no
pass; the blur takes four more taps of its own target.

**The flame** (`spiritflow.ts`, `rider.ts`, `world.ts`). A ribbon from a chase lens reads as a strip whatever its colour,
so it is now fire:
- *Tongues*: soft teardrops shed off the scarf's tail (from along its whole length, more toward the tip, smaller toward
  the knot), each round at its foot and tapering to its tip, stood along the way it rises, burning from the rider's
  vermillion at its birth into the lantern's marigold as it climbs, a hot pale heart while young, fading and narrowing to
  nothing; their sizes flicker. No outline anywhere: every edge is a falloff. One Points draw (High 110 tongues, 180 a
  second at full flow; Medium 70; Low 28, fewer and fuller, its colour at full value with no bloom to carry it).
- *Riding the scarf*: each tongue keeps the point of the scarf it was born on and rises off that point as the scarf moves,
  so it never comes away (held as an offset from the knot, it stayed where the scarf had been: "a campfire beside the
  sled").
- *The scarf alight*: its tail's own colours burn from the rider's vermillion at the knot through a flame's orange to
  marigold at the tip, brighter than the cloth (vertex colours, so Low burns too at no cost, repainted only when the flow
  moves), and a soft glow sits on the tip. The rider's flow rim takes most of the flame's weight (all of it read as a
  stippled outline).
- *Over the scarf, not round it*: the scarf writes a stencil bit of its own (3) beside the rider's (1); the flame is held off
  the body alone, and every ghost layer (`ghostStencil`, the avalanche's debris in `chaos.ts`) now tests the rider's bit
  alone, so contract C10 still holds for them. Held off the scarf like the body, the flame showed only round the scarf's
  edges and read as a fire beside it. Tongues stand a hand in front of the cloth, and the burnt tip is a deep marigold
  (brighter, it bloomed to cream).
- Sparks are marigold, never white (a pale heart read as a dotted white outline round the old ribbon), and shed off the
  tongues.

**Judged** by fresh critics (opus, high effort) given only ART.md and the twelve stills, asked what is attached to or
streaming from the rider and what it reads as at a glance, whether each frame is a good picture of the game as ART.md
describes it, and what is broken or ugly. Bar: a flame off the scarf in at least 10 of 12, and no banding.

| Look | Flame named as off the scarf | Banding |
| --- | --- | --- |
| The merged ribbon (main lane's critic) | 0 of 12: a strip, sticker, baton, sickle, lightning | scanlines on High (m3-1500, m0-1500) |
| Tongues off the tail's tip (`flow6/`) | about 1 of 12: right colours in all twelve, but "a small campfire or torch beside the sled", "an orange smudge" on Low | none: "no true scanlines", row profiles at 8-bit quantisation |
| Tongues riding the scarf (`flow6b/`) | about 0 of 12: "a small fire burning next to the sled" | none from the occlusion |
| The scarf alight (`flow6c/`) | about 2 of 12: the scarf's own burn "is right", but the fire still "a separate patch ... beside the sled", its burnt tip blooming to cream "like a stick in a fire" | none: "no true alternating-row scanlines" (a pixel check) |
| The flame over the scarf (`flow6d/`, 95111aa) | **5 of 12 clearly, 7 with the two Low 600 m "exhaust" frames**: High Pinecrest 2700 m "clearly a burning scarf or lit fuse, the clearest read" and the set's best frame, High Pinecrest 600 m "a flame plume off the left shoulder", High Sakura 600 m "a flaming tail", Sakura 2700 m both tiers "a comet tail" | none from the occlusion |

**Still short of the bar (10 of 12).** Where it fails, by the fourth critic: a flip (Pinecrest 1500 m, both tiers) hides the
scarf behind the saucer's dark underside, so the tongues read as "a fireball beside a dark lid"; on Sakura 1500 m the scarf
is short and flat and the tongues rise upright beside a powder burst as "a picket of candles" or "a bonfire"; on Low a few
big marigold tongues read as two more spirit-light pickups (the course's fuel is a marigold teardrop too) and, at Pinecrest
2700 m, as a smear on the far side from the scarf. What I would try next: tongues stretched along the scarf's own line at
their birth (streaming off it) rather than standing upright, more orange and vermillion and less marigold so a tongue is
never a fuel drop (Low most of all, with more and smaller tongues), and the flame thinned while a flip hides the scarf.

What the critics named that is not the flow's, for the lanes that own it: regular stripes in the snow material itself
(Pinecrest 2700 m's left bank as dunes or sand, Sakura 2700 m's left bank as cobalt "zebra" crests, a leap landing's
corduroy across the lane reading as stair treads, starkest on Low), a halftone stipple inside cast shadows on High, Low
missing a leap's outcrops and crowd that High draws (Pinecrest and Sakura 600 m), Sakura's hazards reading as ice spires,
petals as flat pink dots, a flip's saucer underside as an ink-black disc, orange dots over the rider's hair at Sakura 1500 m
(seen on the merged build before this pass too), a mint ghost beside the rider on Low and none on High at Sakura 1500 m.

Frames: `shots/r8/flow/` (`diag-*` the banding diagnosis on round-8's head, `band-f0` the fix, `flame1` the first tongues,
`flow6`, `flow6b`, `flow6c`, `flow6d` the twelve stills of each look, `crops/`).

### The flow pass, round two (on round-8 at bf76cc7)

The main lane asked for my three next steps. Same twelve stills (Pinecrest and Sakura at 600, 1500 and 2700 m, High and
Low, `?flowlook=6`), a fresh critic each time told only ART.md, the same count; the bar a flame off the scarf in 10 of 12.

- **Take one (3617bb2, kept).** Each tongue is stretched along the scarf's own line where it rides now (the scarf's
  tangent from `scarfAt`, lifted a little) and drifts off along it, instead of standing upright. Its colour runs from the
  rider's vermillion into a flame's orange and only half way on to marigold at its very end (a whole marigold teardrop is
  the course's fuel). Low has more and smaller tongues (48 at most, 110 a second, at 1.15 times High's size). The flame
  thins to an ember while a flip turns the rider over (`flip` from the air pitch's cosine). **7 of 12** read as fire off
  the scarf, from 5: both tiers at Pinecrest 600 m and 2700 m and Sakura 2700 m, and High Sakura 600 m ("a burning scarf,
  a fire tail off the rider"). Not: Sakura 1500 m on both tiers (the flame met the sled's powder spray and read as
  "exhaust with smoke"), the flip at Pinecrest 1500 m on both tiers ("a stray orange smudge"), Low Sakura 600 m (half a
  flaming tail, half an orange puff). No scanlines.
- **Take two (e74d789, reverted in f65c0f1).** The tongues lifted harder to clear the spray, the flame out altogether in a
  flip, Low's tip glow smaller. **4 of 12**: the lifted tongues read as "a smear", "fire on the snow" or "an arrowhead" in
  frames that had read well, and the flip still showed an ember (the air pitch's cosine misses that pose: the flip is
  the trick pose's, not the sim's pitch alone). Two honest tries did not reach the bar, so I stopped, as asked, and left
  the branch at take one.

**The orange dots on the rider's hair at Sakura 1500 m are not the flow's**: the same frame at `flowlook=0` has them
(`shots/r8/flow/crops/hair.png`, flow 0 left, flow 6 right). Not traced further.

**Still short, and what I would try next.** The two flip frames cannot show the scarf; the flame there should go out on
the trick pose's own measure of being upside down (`rider.ts` trick pose, not `s.airPitch`), and those two frames are then
lost to the count whatever the flame does, so 10 of 12 needs every other frame. Sakura 1500 m needs the flame kept off the
spray, which a harder lift did not do; a narrower flame along the scarf's upper edge, or the spray thinned while flow
burns, are the two ways left. Critics on every pass also named things that are not the flow's: regular stripes in the
snow material (Pinecrest 2700 m's dunes, Sakura 2700 m's cobalt crests, a landing's corduroy on Low), a stipple inside
High's cast shadows, Low's watery radial smear at 600 m, the flipped saucer's near-black underside, Low missing a leap's
crowd.

Frames: `shots/r8/flow/flow6e/` (take one), `flow6f/` (take two), `hair-f0/`, `crops/flow6e-four.png`, `crops/hair.png`.
