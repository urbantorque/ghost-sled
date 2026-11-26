# Round 9, the Old Run's world (the `oldrun` lane's world builder)

The brief is `notes/r9-briefs/oldrun.md` section 2 ("A place of its own"); the rules `notes/r9-lanes.md`. This file is
the world's: what was built, why a player would feel it, what the critics said, what Low costs, what is short. The
lane's own notes (the sim, the set pieces' sim, the score, the pool, registration) are `notes/r9-oldrun.md`. Frames
are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/oldrun/world/`. Nobody has ridden the Old Run by hand,
and every frame here is staged (a sled held on a line at a speed, `scripts/r9/oldrun-world-frames.js`), not a ride.

## 1. What the world is (the decisions, and the reason a player would feel each)

- **The track is ice, not a snow corridor.** The channel inside the lip is drawn through the snow material's own ice
  path under a `TRACK` branch only the Old Run's terrain compiles (`materials.ts` TRACK_GLSL, `terrain.ts` aTrack): a
  polished blue-white with a soft mirror and none of the snow's dunes, ripples, relief or grain. A player reads at once
  that this is a made track and that it will be fast.
- **The glaze shows, where the sim lays it.** Each terrain row asks the sim's own `surface()` which side carries the
  glaze there and whether the floor is slush, and the shader cuts the band at exactly 0.4 to 0.9 of the wall's width
  (oldrun.ts GLAZE_LO, GLAZE_HI) a pixel wide: a deep clear blue, darker than the wall round it, a hard mirror of the
  sky and the sun's path, and a scribed bright line at its top and its foot. The line the bend pays for is the line
  that shines; nothing drawn suggests a line the sim does not reward (ART.md 14).
- **The slush reads dull.** A bend's floor where the sim lays slush is matte, a step down and greyer, churned in
  patches, never shining: the slow line looks slow.
- **Past the lip, a crest of snow, never a cliff.** The sim keeps the wall's curve rising past the lip (its landing
  prediction looks there); the groundwork's frames drew that as towering rock. Everything the world draws past the lip
  now stands on `oldrun.ts drawnGround` (a crest that rounds over and falls to the forest floor), read through one
  function, `ground.ts groundOf`, by the terrain, the mid-ground's edge and every prop (`visualGround`).
- **A forest of its own kind.** Old beeches (smooth grey trunks, wide crowns of forking limbs ending in fans of twigs)
  and birches (white trunks ringed dark, narrow upswept crowns), bare, with snow along the limbs
  (`oldrunflora.ts`). The blind sort put the groundwork's pines with the five's forest; a bare wood is another
  silhouette, and under the low sun its trunks rake long bars of shadow across the ice.
- **No hero at the vanishing point, no sea of cloud.** The panorama is `hills` (`massif.ts`): low rounded ridges and no
  hero patch; below them the valley's floor is a lake of open water (`SEA_GLSL` lake mode): a deep cold body, the sky
  mirrored toward the horizon, slow ripples and the low sun's path in broken glitter.
- **Its own light** (`palette.ts`, `oldrun` rows): a low late sun of a winter afternoon, ahead-left through the wood,
  a soft disc in a frost haze over a slate-blue sky; cream snow and slate-lavender shade. The journey: deeper in the
  wood the sun lowers and warms (650 to 1,450 m), it sets gold over the lake through the Horseshoe (1,900 to 2,500), and
  the line is crossed in the first blue of evening with the iron lamps lit (2,700 to 3,000).
- **Its other hour: by Lamplight.** A half moon over the far ridges, the snow in its cold light, the parapet's lamps
  the light the length of the run, snow falling through it from the Labyrinth on.
- **Its own places** (`oldrunworld.ts`, loaded on demand when its course is first drawn: nothing of it is in the first
  download): the grand hotel stepping down beside the start house's straight, facing the low sun; the start house, a
  timber shed over the first metres that the rider leaves from under; a low timber rail along both crests the whole
  run (the strobe at speed, where the five have stakes and flags) and iron lamps on it every 23 m down the run; the
  timing house past the crest at the line, its clock on its gable toward the track; the line across the ice in ink and
  cream checks. None of the five's grammar stands on it: no grandstands at the start, no lift line, no gate, hut or km
  arch on its banks (`landmarks.ts`), no overlook or composed place (`overlook.ts`, `compose.ts`), no stakes
  (`speedposts.ts`).

## 2. Every hunk in a file other render systems share

(Filled in as the work goes; see section 7 for the final list.)

## 3. Frames

## 4. The greyscale sort

## 5. The critic loop

## 6. Low

## 7. Files

## 8. What only scripts have seen, what is short, what the lane must do

## 9. For ART.md section 15 (the text I would add; the main lane owns the file)
