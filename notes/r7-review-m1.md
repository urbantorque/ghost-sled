# Round 7, phase 3: the visual review of Frostfang Glacier (mountain 1)

Lane `r7-review-m1`, port 4531. The loop of `notes/r7-review.md`: capture, a fresh critic given only frames and
ART.md, fix, repeat. Frames are in the main checkout, `shots/r7/review/m1/pass<K>/{high,low,phone-medium,motion}`
(36 fixed frames a tier, the list of `frames-r7.json`, and 16 strips of three stills from a pool rider's run,
`demo=2`, on High).

## Scores by pass

Each critic was a new general-purpose agent (passes 1 and 2 at medium effort, 3 to 5 on `opus` at `xhigh`), told
nothing but the frames' folders, ART.md's path
and the brief's instruction. Scores are the critic's own, out of 10.

### Pass 1 (the merged round, `ead6196`, untouched)

| Folder | Mean | Min |
| --- | --- | --- |
| High (36) | 6.8 | 5.5 |
| Motion on High (48) | 6.7 | 4.5 |
| Low (36) | 7.1 | 6.0 |
| Phone, Medium (36) | 7.3 | 6.0 |

High, frame by frame: 150 6.5, 300 6.5, 450 7, 595 7, 750 6.5, 900 6, 975 6.5, 1045 6, 1195 6, 1343 7.5, 1500 7.5,
1550 7.5, 1650 7, 1800 6.5, 1917 6.5, 2137 7, 2250 6.5, 2297 6.5, 2405 6, 2548 7.5, 2700 7.5, 2783 6.5, 2850 6.5,
3000 5.5, 3154 7, 3304 6.5, 3418 6, 3549 8, 3600 8, 3750 6.5, 3940 7.5, 4050 7, 4200 7.5, 4330 8, 4440 7.5, 4590 5.5.

Hero vistas: Serac Gate's span 7.5; the aurora over the Crevasse Fields 7.5; the cavern mouth at sunrise 6 ("the
vista is not there: the mouth opens on blue night"); the Fang at dawn from the last leap 7.5. None a 9.

What the critic found, worst first:

1. **A colour split on every edge in the outer third of the frame, in calm frames.** Green and magenta, eight
   pixels wide. Cause, found in `post.ts`: the lens's red and blue taps were read sharp from the scene while green
   came through the six-tap speed smear, so the split was as wide as the smear, at any speed over 24 m/s.
2. **The mountain's jaw-drop was missing.** The dawn's stop ran from 3300 to 3580 m and the cavern ends at 3457 m,
   so the far mouth opened on night and the dawn arrived on the bridge after it.
3. **The colour script ran late.** A full sun still up at 750 m, no stars over the span at 1343 m, the run-in's
   light still on the snow at 1800 and 1917 m; the aurora's light only from about 2100 m, and thin.
4. **Crevasse walls were large blue planes** (900 to 1195, 2250 to 2405).
5. The cavern was mid-bright cobalt, not near-black.
6. 3000 m: the 3 km arch's beam crosses the top of the frame. 4590 m: the results card cuts the rider.
7. In motion: a perfect landing's flash bleaches the rider; lanterns pass at the lens in the cavern.

### After pass 1 (`cee32c1`)

- `post.ts` (shared): red and blue are read through the same smear as green. A calm frame has no split; the
  punch and the corners' hair of fringe are the two and a half pixels they were drawn to be. Up to 12 more taps
  on a corner pixel at speed on High and Ultra, and on any pixel for the 0.4 s of a punch; no pass, no draw.
- `palette.ts`, Frostfang's `JOURNEY`: the sun sinks from 480 m and is on the band by 1340 m (it was 600 to
  1450), with a dim disc and stars at 0.9; polar night comes from 1480 to 1820 m (it was 1700 to 2250), so the
  whole of the Crevasse Fields is the aurora's; the dawn turns from 3185 to 3345 m, inside the cavern (it was
  3300 to 3580), so the cavern's own palette is laid at full dawn and the far mouth shows it from the first
  metre it is seen. The blue hour's disc is lower (3.9 degrees, was 5.5) and the Fang is near black against the
  band (`massif.rock` #0E1A4A, #0A1440 by Serac Gate, back to cobalt at dawn).
- `palette.ts`, `PLACES.glacier` tunnel: the cavern drops a step (exposure 0.86, snow #546CC0 over #16226A,
  hazards at 0.55), the sun's own light inside is a dim violet, the highlights' split tone is rose. `Place` gains
  an optional `fall` (shared, default unchanged) and the cavern lets go over 85 m: night to full dawn is the
  widest step in the game and the test of the places' blend holds it under its limit.
- `materials.ts`, the snow under `key2` (only Frostfang sets it): the aurora's curtains cover most of the
  sky-facing snow (threshold 0.22 to 0.52, was 0.34 to 0.64) at 0.8 strength, so the lit side of the night is
  green-teal and violet is the shade.
- `materials.ts`, crevasse ice (rock style 1, only the Fang's): shards in three values a step apart (0.5, 0.94,
  1.42), held to distance at half strength, and the cyan heart glows half as much again.

### Pass 2 (`cee32c1`)

| Folder | Mean | Min |
| --- | --- | --- |
| High (36) | 6.86 | 5.5 (4590, the results card) |
| Motion on High (48) | 6.63 | 4.5 |
| Low (36) | 6.90 | 6.0 |
| Phone, Medium (36) | 6.97 | 6.0 |

High, frame by frame: 150 6.5, 300 6.5, 450 7, 595 7, 750 7, 900 6.5, 975 6.5, 1045 6, 1195 6, 1343 7.5, 1500 7.5,
1550 7, 1650 6.5, 1800 7, 1917 7, 2137 6.5, 2250 6.5, 2297 6, 2405 7, 2548 7.5, 2700 7.5, 2783 7, 2850 6.5,
3000 6.5, 3154 6, 3304 7, 3418 7.5, 3549 8, 3600 7.5, 3750 7, 3940 7.5, 4050 7, 4200 6.5, 4330 7.5, 4440 7.5,
4590 5.5.

Hero vistas: Serac Gate's span 7.5; the aurora over the Crevasse Fields 7 to 7.5; the cavern mouth at sunrise
7.5 on High and 7.5 to 8 in motion (it was 6); the Fang at dawn from the last leap 7. None a 9. The best frames on
the mountain are the dawn bridge straight after the mouth (3549 at 8; two motion frames at 8.5).

This critic saw **no colour fringe in a calm frame** and no banding in the sky. A second critic does not score
like the first: its mean is level with pass 1's while the defects pass 1 named are gone from its list. What it
found:

1. A perfect landing at night blows the lower half of the frame to cream and bleaches the rider (4.5, the worst
   frames of the set). Cause, found in `particles.ts`: every puff of the burst within 15 m of the sled's lantern
   added the lantern's colour at up to 1.25, so twenty to forty billows became one glowing sheet.
2. The snow is flooded teal while the aurora in the sky is a faint thread: the key light has no source. And the
   lit snow ended at the bank: the flanks beyond it (`midground.ts`) had no aurora, a hard seam from the air.
3. The cavern is still mid-blue: its walls are the Fang's ice, which did not go down with the place.
4. The run-in is still a day's sun with a hard starburst.
5. Things this lane cannot reach (below, "Still short").

### After pass 2

- `particles.ts` (shared): the lantern lights the near side of a puff at 0.6, not 1.25, outside Lantern Night
  (which keeps all of it: `uLantern` at 1).
- `midground.ts` (shared code, only runs where `key2` is set, which is Frostfang's night): the flanks take the
  aurora's curtains and violet shade with the terrain's own pattern, quieter with distance.
- `palette.ts`: the sky's aurora at 1.7 over the Crevasse Fields and 1.3 on the way to the cavern (it was 1 and
  0.75); the blue hour's sun smaller and with less glow (size 0.75, glow 0.45).
- `materials.ts` `applyRock` (the Fang's ice only): the ice goes down with `hazardDim` under 0.78, which only the
  cavern is, so its walls are half as bright and the glow at their feet and the lanterns are the light.

### Before pass 3 (`f682cd3`)

The lane changed hands here. The first capture of pass 3 (from `f69feef`) showed a console error on every tier:
the puffs' fragment shader read `uLantern`, which only its vertex shader declared, so no snow spray, landing
burst or powder drew at all. `particles.ts` (shared): the fragment shader declares it. Pass 3 was then shot again
in full from `f682cd3` (console clean on all four sets) before any critic saw it.

### Pass 3 (`f682cd3`)

From this pass on each critic is a new general-purpose agent on `opus` at `xhigh` effort (the brief's current
text); passes 1 and 2 were at medium effort on another model. This critic is much the strictest of the three: it
marks down every ghost at the lens, flat fuel drop and HUD card over a vista, which the first two mostly let pass.

| Folder | Mean | Min |
| --- | --- | --- |
| High (36) | 6.54 | 5.0 (4590, the results card) |
| Motion on High (48) | 6.35 | 5.0 (mo-z2300-0, mo-z3990-0) |
| Low (36) | 6.31 | 5.5 |
| Phone, Medium (36) | 6.60 | 5.0 (4590) |

High, frame by frame: 150 6, 300 6, 450 7, 595 7, 750 7, 900 7, 975 7, 1045 6, 1195 6, 1343 6.5, 1500 6.5,
1550 6.5, 1650 6, 1800 6.5, 1917 6.5, 2137 7, 2250 6, 2297 5.5, 2405 6, 2548 7, 2700 7.5, 2783 7, 2850 5.5,
3000 5.5, 3154 6.5, 3304 6.5, 3418 7, 3549 7.5, 3600 7.5, 3750 6.5, 3940 7, 4050 7, 4200 6.5, 4330 7, 4440 7,
4590 5.

Hero vistas: Serac Gate's span 6.5 (no abyss under it; the Fang not black in the band); the aurora 7.5 at best
(2700; "a thin band pinned under the HUD, not the key light"); the cavern mouth 7 ("a dim violet rectangle, not
a blade of rose-gold; no shafts"); the Fang at dawn 7 (the hero tiny in the letterbox, the Fang not one spire
lit on one side). None a 9. The best image of the run is still the dawn bridge, mo-z3470 at 8.

What it found, worst first, and whose it is:

1. Results card over the hero, a stale HUD number behind "3rd" (4590, every tier): UI, not this lane's.
2. 3000: the 3 km arch's beam and ring cross the top of the frame as the lens passes under it (every mountain
   has a fixed frame at 3000 m): shared props.
3. Ghosts at or over the lens (1650, 2250, 2850 and Low and phone): shared ghosts.
4. 2297: a pale untextured slab across the bottom of the frame.
5. Stair-stepped blocks in the ice floor's reflection (1045, 2405): the pipe lane's reflections.
6. The cavern mid-blue, not near-black; the mouth with no blade and no shafts; the way out milky.
7. The run-in a noon, not a blue hour; the Fang never black against the band.
8. The aurora a thread at the top edge, so the teal on the snow has no source.
9. Systemic, every mountain: landing and dash glows bleach the rider; flat fuel drops at the lens; the sled's
   underside an untextured slab; lanterns dithering through the lens.

### After pass 3

Worst first among what this lane can reach; the jaw-drop first of all.

- **The cavern is dark and its mouth is the light** (`stages.ts`, Frostfang's section; `materials.ts`, shared;
  `palette.ts`, the cavern's place). Found by switching parts off in a live frame at 3418 m: the lilac wash over
  the floor and walls from the middle of the cavern on was the mouth's own dawn lamp, 44 m wide at 0.9 (and
  the place's 1.35 lamps over it). Now: the lamp is a short warm pool at the lip (24 m at 1.0); a blade of gold
  laid narrow along the floor from 70 m in, widening and brightening to the lip; a veil of rose-gold standing
  in the whole opening, hottest where the horizon crosses it; five shafts slanting in from the opening, each
  bright along its middle and gone at its edges. The veil and shafts are their own mesh in a beam material that
  thins out within 6 to 30 m of the lens (`beamMaterial(near)`), so a sheet met at the lens is never a pale card
  over the frame (Low keeps one mesh and no shafts).
- The cavern's walls: the crevasse ice (`materials.ts` snow shader, rock style 1) and the ice built over the run
  (the toon `ICE` branch, not a hazard) go down with `hazardDim` under 0.75, cubed; only the cavern is under
  0.75 (now 0.45), so no other place or mountain changes. The ice's glow keeps to the wall's foot under the roof.
  Ice built over the run now takes the lamps (the `ICE` branch threw the local light away). The cavern's place
  glazes its floor less (`ice` 0.15) and pales its ice crowns less (`hazardFog` 0.4).
- The way out of any enclosure flashes 0.3 by day (was 0.6) and 0.2 at night (was 0.25) (`landmarks.ts`,
  shared): the white over the whole frame read as milk going into Frostfang's dawn.
- **The run-in is a blue hour** (`palette.ts`, Frostfang's Clear Skies): the snow two blues (lit #C0D2F2, shade
  #4268B8), the sky a step deeper, a lemon band and rim, the key light at 19 degrees (was 23), the disc at 0.55
  with a quarter of the rays and lens, the glints at 0.65 and the glitter at 0.25 (a field of them read as noise),
  the ice spires down a step (`hazardDim` 0.78, `hazardFog` 0.65) so they are the darks against the band, the
  ranges in shade under the summits (`massif.glowLine` 1450, then 2400 by the span).
- **The aurora is in the frame** (`sky.ts`, shared shader, only where `aurora` is over 1, which is only
  Frostfang's night): its hems come down to just over the far ranges and its curtains stand twice as tall, so
  the light on the snow has its source in the picture.
- **Fang Town's air is clearer** (`palette.ts`, the dawn): shade #4E54B2, fog #8E84C2 out to 620 m, the far air
  #7064B6 and its scatter 1.15 (was 1.7): three planes instead of one lilac haze.
- Not done, and why: the span's abyss (the terrain under Serac Gate's span is snow dunes level with the deck; an
  abyss is a change to the ground beside a bridge, too big and too shared to make safely here); the 3 km arch
  over the lens at 3000 m, ghosts at the lens, the results card, flat fuel drops, the sled's underside and the
  dash and landing glows on the rider (all shared, and on every mountain: the main lane should take them once).
- Tests: the Clear Skies test keeps each mountain's start apart; Frostfang's first blue hour came within 1.49 of
  Lanternfall's night (limit 1.5), so its zenith and horizon are a touch bluer and paler (#0A2266, #96B8E6).

### Pass 4 (`d33130f`)

| Folder | Mean | Min |
| --- | --- | --- |
| High (36) | 6.6 | 5.0 (2850, a ghost over a third of the frame) |
| Motion on High (48) | 6.9 | 5.5 (mo-z1917-0, mo-z3470-0, mo-z3520-2: flashes on the rider) |
| Low (36) | 6.7 | 5.5 (2850) |
| Phone, Medium (36) | 6.9 | 5.5 (1800, a ghost across the vista) |

High, frame by frame: 150 6.5, 300 6, 450 6.5, 595 7, 750 7, 900 5.5, 975 6, 1045 6, 1195 6, 1343 7, 1500 7,
1550 6.5, 1650 6.5, 1800 6.5, 1917 6.5, 2137 6.5, 2250 6, 2297 6.5, 2405 5.5, 2548 7, 2700 7, 2783 6.5, 2850 5,
3000 7, 3154 6, 3304 6.5, 3418 7.5, 3549 8, 3600 7.5, 3750 6.5, 3940 7, 4050 7, 4200 7, 4330 7.5, 4440 7.5,
4590 6.5.

Hero vistas: Serac Gate's span 7 (was 6.5); the aurora 7, 7.5 in motion (was 7.5 at one frame); the cavern mouth
7.5 (was 7: "a pastel lilac haze, not a blade of rose-gold; no shafts"); the Fang at dawn 7. None a 9. Every
folder's mean rose (High 6.54 to 6.6, motion 6.35 to 6.9, Low 6.31 to 6.7, phone 6.60 to 6.9); the cavern
(3304 6.5, 3418 7.5) and 3000 (5.5 to 7) rose most. The worst frames now are all ghosts at the lens (2850, 2405,
1650, 1917, phone 1800) and Serac Gate's walls (900 5.5: "flat facets, nothing lights them").

The console: one line on High, "The AudioContext encountered an error from the audio device", which is the
machine's audio device under six lanes' headless browsers, not the game; Low, phone and motion were clean.

### After pass 4

- The mouth burns (`stages.ts`): the veil's horizon band at 1.9 in a deeper gold (was 1.7 in the floor's pale gold, which over the dawn sky went to white) and its rose top at a third; the
  shafts in gold, not the veil's rose (a sheet of rose over blue air read as lilac), wider and at 0.55 to 0.85
  (were 0.34 to 0.5). Low's veil at 0.45 and blade at 0.55 of High's: on Low there is no tone curve to hold them
  and they went to a white rectangle down the track.
- The dawn's lit snow is rose-gold, #FFD8C4 (was #F6DCE4, which read as lilac under the violet shade).
- Frostfang's ravines (Serac Gate's slot and the Crevasse Fields' trenches) set `hazardDim` 0.66, under the
  0.75 at which the ice walls go down, so the walls are the dark frame of the slot and not its brightest, flattest
  thing; at night the aurora still lights their crests (that term comes after the dimming).
- Ghosts at the lens (`ghosts.ts`, shared): the size fade starts at about a third of the frame's height (was
  0.28 for the body and 0.38 for the rest) and a ghost is gone by under a half (was about 0.6). One at half the
  frame's height beside the lens (2850 m, the worst frame of pass 4) stood over a third of the picture at a third
  of its strength. The pass beat's floor and the between-lens-and-rider fade are as they were.

### Pass 5 (`e5ac592`), the last

| Folder | Mean | Min |
| --- | --- | --- |
| High (36) | 6.69 | 5.5 (2850, the giant mint figure) |
| Motion on High (48) | 6.44 | 4.5 (mo-z3418-0: a ward's gold blob over the rider) |
| Low (36) | 6.50 | 5.0 (300: a gold drop hanging in the sky) |
| Phone, Medium (36) | 6.72 | 5.5 (300) |

High, frame by frame: 150 6.5, 300 6, 450 6.5, 595 6.5, 750 7, 900 6, 975 6, 1045 6, 1195 6, 1343 7, 1500 6.5,
1550 6.5, 1650 6.5, 1800 7, 1917 6.5, 2137 6.5, 2250 6, 2297 6.5, 2405 6, 2548 7, 2700 7.5, 2783 6.5, 2850 5.5,
3000 6.5, 3154 6, 3304 7.5, 3418 7.5, 3549 8, 3600 8, 3750 6.5, 3940 7, 4050 7, 4200 7, 4330 7.5, 4440 7.5,
4590 7.

Hero vistas: Serac Gate's span 7; the aurora 7.5 (2700); the cavern mouth 7.5 ("a milky lavender haze, not a
rose-gold blade"; the HUD banner sits on it); the Fang at dawn 7. None a 9. The nearest to a 9 on the mountain is
the dawn bridge out of the cavern: 3549 and 3600 at 8, mo-z3470-1 and -2 at 8.

**The ghosts' size fade is not on the branch.** It went into `e5ac592` for this pass and made no visible
difference to any frame it was aimed at (2850, 1650 and the phone's 1800 are the same picture before and after:
the 2850 figure carries no tag and is probably not a pool ghost, and the others were under the new thresholds).
An unmeasured change to the hero lane's file is not worth its merge, so `ghosts.ts` is back to `d33130f`.
Everything else in pass 5's frames is the branch as it stands.

## All passes

Critics 1 and 2 were medium effort on another model; 3 to 5 were `opus` at `xhigh`, and 3 was much harsher than
2 on the same defects. Read the table down a column from pass 3, not across the change of critic.

| Pass | Build | High mean / min | Motion | Low | Phone | Span | Aurora | Cavern mouth | Fang at dawn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `ead6196` | 6.8 / 5.5 | 6.7 / 4.5 | 7.1 / 6.0 | 7.3 / 6.0 | 7.5 | 7.5 | 6 | 7.5 |
| 2 | `cee32c1` | 6.86 / 5.5 | 6.63 / 4.5 | 6.90 / 6.0 | 6.97 / 6.0 | 7.5 | 7 to 7.5 | 7.5 | 7 |
| 3 | `f682cd3` | 6.54 / 5.0 | 6.35 / 5.0 | 6.31 / 5.5 | 6.60 / 5.0 | 6.5 | 7.5 | 7 | 7 |
| 4 | `d33130f` | 6.6 / 5.0 | 6.9 / 5.5 | 6.7 / 5.5 | 6.9 / 5.5 | 7 | 7 (7.5 moving) | 7.5 | 7 |
| 5 | `e5ac592` | 6.69 / 5.5 | 6.44 / 4.5 | 6.50 / 5.0 | 6.72 / 5.5 | 7 | 7.5 | 7.5 | 7 |

The stopping rule (no frame under 8, every hero vista 9 or more) was not met; the lane stopped at five passes.

## Still short, and why

- **No hero vista is a 9.** The cavern mouth rose from 6 to 7.5 and is still "a haze, not a blade": the opening
  in the fixed frame (3418) is about 30 m tall because the roof must clear the highest air plus 6.3 m
  (`town.ts` bays, `landmarks.ts` roofNeed), so from 40 m inside the lintel is above the frame and the mouth
  reads as a slot with sky over it. A real mouth in that frame needs the roof lower than the air allows, or a
  camera that looks up at the way out (the reveal of `shots.ts` does, in a real run). The rider is never seen
  in silhouette against it: the chase camera is always behind and above.
- **Serac Gate's span has no abyss.** The span crosses snow level with its deck on both sides; an abyss is a
  change to the ground beside a bridge (`ground.ts`, the terrain, the props that stand on it), too big and too
  shared for a review lane.
- **The ice walls of Serac Gate and the Crevasse Fields** still read as stretched, flat slabs (900 to 1195, 2250
  to 2405 all score 6). Darkening them (`hazardDim` 0.66 in Frostfang's ravines) moved the score little: their
  brightness is mostly the cyan glow at their foot, and the shards' cut is drawn on wall faces stretched by the
  slope. Needs painted ice on the walls themselves (the light lane's `rockCells` style 1).
- **Shared, every mountain** (named by every critic, not this lane's to change alone): ghosts or a giant mint
  figure at the lens (2850, 1650, 2405, 3154); dash, ward, flow and stomp glows bleaching the rider in motion
  (rule 4; the worst motion frames of pass 5); the gold drop hanging in the sky at 300 m; flat fuel drops at the
  lens; the sled's underside as a slab mid-flip; the HUD over the letterbox and over the cavern mouth; the
  results card mid-fade; a small rider on High (13 to 15% of the frame's height against about twice that on Low
  and the phone); the lake vista repeating at 595, 750, 1650, 1800, 1917, 2783, 2850, 3750 and 3940 m (the
  course's own bowls and lips); fine horizontal banding on open snow.
- **Low:** the cavern's roof goes olive-khaki (3304, 3418): the ice vault under Low's baked grade. The light
  pools are hard-edged discs (2297, 3304, 3750, 4200), as they are by design on Low, but the critics read them as
  stains.

## Shared code touched

All small; each one is either a no-op off Frostfang or says why it is general.

- `post.ts` (pass 1): the lens's red and blue taps read through the same speed smear as green. Every mountain:
  no colour split on a calm frame.
- `palette.ts`: `Place.fall` (optional, default unchanged) and its use in `laidPlaces` (pass 1).
- `particles.ts`: the lantern lights a puff's near side at 0.6 outside Lantern Night (pass 2); the fragment
  shader declares `uLantern` (the pass 2 change had left every puff shader failing to compile).
- `midground.ts` (pass 2): the flanks take the aurora only where `key2` is set (Frostfang's night).
- `materials.ts`: the crevasse ice (rock style 1, only the Fang's) and its glow go down under `hazardDim` 0.75;
  the snow shader declares `uHazardDim`; the toon `ICE` branch for ice that is not a hazard (Frostfang's tunnel,
  its spans, the marquee's ice chunks) goes down under 0.75 and keeps the local lights (it threw them away).
  Only Frostfang's cavern (0.45) and ravines (0.66) are under 0.75; every other mood and place is 0.75 or over.
- `sky.ts`: the aurora's hems and curtains change only where `aurora` is over 1, which is only Frostfang's night.
- `stages.ts`: `beamMaterial(near)` (a define; the Caldera's and the torii's beams are unchanged) and Frostfang's
  `makeMouth`.
- `landmarks.ts`: the way out of any enclosure flashes 0.3 by day (was 0.6) and 0.2 at night (was 0.25): Ember's
  halls, Sakura's torii and every gallery too. The main lane may want it per mountain.

## Cost

Mean over the 36 fixed frames, from the frames' JSON (draw calls, triangles), pass 1 against pass 5:

| Tier | Pass 1 (`ead6196`) | Pass 5 (`e5ac592`) |
| --- | --- | --- |
| High | 100.2 calls (max 114), 844k tris | 100.7 calls (max 114), 844k tris |
| Low | 52.6 calls (max 63), 143k tris | 48.3 calls (max 57), 128k tris |
| Phone, Medium | 89.1 calls (max 101), 584k tris | 89.1 calls (max 102), 583k tris |

The run to run spread is about three calls a frame (ghosts, particles). The mouth adds one draw on Medium and High
while the cavern's stage is made (its light in the air is its own mesh) and about 80 triangles; Low draws it in one
mesh, as before. The shader changes are a uniform and a multiply each; the aurora covers more of the sky on
Frostfang's night, so more of the sky's pixels run its loop there. High was already over the brief's 95 calls at
pass 1 and is unchanged. Frames per second were not judged: six lanes share the GPU.

## Frames

- Passes: `shots/r7/review/m1/pass1` to `pass5`, each with `high`, `low`, `phone-medium`, `motion` and the
  JSON of each set (cost, console).
- Contact sheets of pass 1 and pass 5 High at the same 36 distances: `shots/r7/review/m1/sheet-before.png` and
  `sheet-after.png`.
- Hero frames (pass 5): `shots/r7/hero/m1/` (the dawn bridge at 3549 and 3600, out of the cavern and on the
  bridge in motion at 3470, the cavern mouth at 3418, the aurora at 2700).
