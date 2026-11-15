# Round 7, phase 3: the visual review of Frostfang Glacier (mountain 1)

Lane `r7-review-m1`, port 4531. The loop of `notes/r7-review.md`: capture, a fresh critic given only frames and
ART.md, fix, repeat. Frames are in the main checkout, `shots/r7/review/m1/pass<K>/{high,low,phone-medium,motion}`
(36 fixed frames a tier, the list of `frames-r7.json`, and 16 strips of three stills from a pool rider's run,
`demo=2`, on High).

## Scores by pass

Each critic was a new general-purpose agent at medium effort, told nothing but the frames' folders, ART.md's path
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
