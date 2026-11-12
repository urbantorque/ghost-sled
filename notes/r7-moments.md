# Round 7, the `moments` lane: set pieces that never repeat, and the fifth mountain in the sim

Working notes, kept as the lane goes. All sim work here ships under `SIM_VERSION = 9`.

## Decisions

### M1. Lanternfall is in the sim as the fifth mountain

- `MOUNTAINS[4]`: id `lanternfall`, seed `0x9b05688c`, a new course biome `lantern`.
- **One place borrows a look.** `mountains.ts` now has two types: `BiomeId` (the four looks the world and the music
  are dressed for, unchanged) and `CourseBiome = BiomeId | 'lantern'` (what the sim builds). `LOOK` maps `lantern` to
  `glacier`, marked `// r7: placeholder until the Lanternfall world lane`, and `Course.biome`/`biomeForSeed` return
  the look, so no `Record<BiomeId, ...>` in `src/render` or `src/audio` had to change (zero edits there for this).
  `Course.trueBiome` and `courseBiomeForSeed` say what the course really is. **To build Lanternfall's world:** add
  `'lantern'` to `BiomeId`, delete `LOOK`, and the compiler lists every table to fill.
- **Its descent** (stage lines at 1450, 2950, 4500, as everywhere):

  | Stage | Sections (metres) | The direction's row |
  | --- | --- | --- |
  | The Cloud Sea | start 0, run-in bowl 120, cruise 369, **leap, lip 632** (the dive off the Crown), ravine 852 to 1190, switchbacks 1190 to 1450 | The Crown above the cloud, then the Cloud Sea |
  | The Lamp Road | **leap, lip 1568, a 23 m cliff** (the break out under the deck), fork 1788 (its ice strip is the river of lights), street 2109 to 2334 (the Lamp Road's avenue), bridge 2334, treerun 2507 (the lamp grove), bowl 2719 | The break, the Lamp Road |
  | Firstlight | benches 2950, bridge, street 3401 to 3622, chute 3622, **leap, lip 3980**, finish square 4200, line 4500 | Firstlight |

  `Course.cloud` gives the cloud sea's extent for whoever draws it (`{ z0: 632, z1: 1568 }`, the two lips). The sim
  never reads it: closing visibility is the world's.
- **Obstacles are stand-ins from existing kinds** (no new `ObstacleKind`, so `props.ts` and `meshes.ts` are
  untouched): standing stones are `spire` and `basalt`, stone lamps are Sakura's `lantern`.
- **Avenues of stone lamps.** On Lanternfall a street stands between two rows of stone lamps (`lantern` obstacles), a
  pair every 20 m, each as far off the safe line as any obstacle must stand plus 0.3 m. Rails stay out of its
  streets (they stood where the rows stand). The fairness test covers them like any obstacle.
- **The seed was chosen among eight.** Five broke a promise the fairness or the budget tests make (a tree run too
  thin on one side, a fork with no obstacle on its risk line, a street whose village is over Low's 30,000 triangles);
  `0x9b05688c` and `0x510e527f` passed everything, and the first has the higher break (23 m).
- **Unlock: a placeholder.** `MountainDef.finale` marks it; until The Twelve opens it, it opens like the others, at
  48 lifetime passes (`unlockGhosts`). `?debug&m=4` opens it in dev.

## Touched outside my files

- `tests/progress.test.ts`: the "next unlock" test's rider with every mountain open has passed 60 ghosts, not 30
  (Lanternfall's placeholder threshold is 48).
