# Round 9, Gablefall's world (the `gablefall` lane's world builder)

The brief is `notes/r9-briefs/gablefall.md` sections 0 and 2 and section 3's visual items; the rules `notes/r9-lanes.md`.
This file is the world's: Low's cost before the world, what was built, why a player would feel it, what the critics
said, what is short. The lane's own notes (the sim, the bot, the set pieces' sim, the score, the pool, registration)
are `notes/r9-gablefall.md`. Frames are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gablefall/world/`.
Nobody has ridden Gablefall by hand, and every frame here is staged (a sled held on a line at a speed,
`scripts/r9/gablefall-world-frames.js`), not a ride.

## 0. Low's cost, before the world (DECISIONS 392)

**The risk.** The town is everywhere: two rows of houses down the whole run and the town past them, about 400 m of
houses in view on both sides, where the five's street piece (`town.ts`) is 30k triangles on Low and 66k on High for
120 to 200 m of street. Drawn as the five draw a town (a house a part, a few draws a piece), Gablefall would be two or
three of those pieces at once all run long.

**The design measured** (the stand-in, `src/render/gablefallworld.ts` at its first commit, built the way the world is
built, not a mock-up):

- The roofs' snow is the terrain: the sim's ground *is* the snow on the roofs, the street and the drifts, so the
  terrain draws it with no new draw. Its only change on Gablefall is a pair of columns either side of the house fronts,
  a corner drift's inner side and the rows' backs, and a pair of rows at each end of a roof's step
  (`gablefallplan.ts townColumns`, `townRows`), so a front and a step are drawn sheer (at Low's 1.6 m spacing a house
  front was a snow ramp reaching 1.5 m into the street). That costs triangles, not draws.
- The houses are not objects. The course is cut into 128 m segments; each segment's near rows (every house's front on
  the street with its windows, door and plinth, its back on the lane, the slate fascia and the lip of snow along both
  eaves) are one mesh, and the town past them (two rows deep on Low, three above, of houses with steep slate roofs
  under snow, a chimney, their windows toward the run) is the baked far piece: one more mesh a segment on Medium and
  High (it casts no shadow), merged into the near one on Low. Built once from the course; no per-frame work but a
  segment's visibility by reach (420 m ahead on Low, 640 Medium, 760 High; 60 behind).
- One material for all of it (`makeToonMaterial`, `glowMask`): the windows are glass painted a warm lamp colour that the
  house material lights from its own colour (GLOW_MASK reads bright, saturated vertex colour), not lights. Plaster, slate
  and snow do not glow.
- The five's grammar is off on Gablefall, as on the Old Run and Gullhaven: no forest or dressing (the clearings), no
  grandstands, gate, lift or huts (`landmarks.ts`), no overlook or composed place, no stakes or flags
  (`speedposts.ts`), no villages, hamlets or forest in the mid-ground (its own town mode). Those draws pay for the town.
- Chimneys are the sim's obstacles in the props' one instanced draw for their kind.

**The count** (a held Low run, the `fresh` save, the sled held at 30 m/s on its line, 300 m windows,
`scripts/r9/gablefall-world-glcount.js`, which now also sums the triangles and points drawn from the draw calls
themselves; counts, never frames a second; `gl/s0-standin.txt`):

| What | Stretch (sim m) | Calls a frame | Draws | Triangles |
| --- | --- | --- | --- | --- |
| Pinecrest | 543 to 844 | 349.8 | 37.3 | 150,335 |
| Pinecrest | 1,373 to 1,673 | 417.4 | 42.8 | 104,061 |
| Gablefall as Pinecrest's look (before) | 541 to 840, street | 348.0 | 35.3 | 74,476 |
| Gablefall, the stand-in | 544 to 844, street | 314.7 | 34.3 | 62,409 |
| Gablefall, the stand-in | 541 to 841, roof | 310.3 | 33.2 | 62,347 |
| Gablefall, the stand-in | 1,441 to 1,741, street | 312.2 | 33.7 | 64,501 |
| Gablefall, the stand-in | 1,442 to 1,742, roof | 313.5 | 33.7 | 64,765 |

On Low at 583 m the town's segments in view were four (512 to 1,024 m), 2,252 + 2,236 + 1,418 + 990 triangles, 6.9k
in all; the whole run's town 38k; the terrain 35.5k in nine chunks (the steps' rows and the fronts' columns about double
the five's terrain there).

**What it says.** At the planned density the town costs four draws in view on Low (one a segment), and with the five's
forest, dressing and places gone Gablefall's held Low run is 10 to 25% *under* Pinecrest's calls (310 to 315 against 350
to 417) and 3 to 9 draws under, at under half its triangles. **The design that keeps it level with Pinecrest's:** the
segments as built (one draw a segment for the town, near and far merged on Low; never a draw a house), one glowing
material, the far piece built once, and the places that are not the street (the church, the market halls, the quay, the
bridge, the valley's far side and the viaduct, the set pieces' props) each one merged draw drawn only within reach.
Those places and the set pieces have about 30 to 35 calls of headroom (four or five draws) before Gablefall reaches
Pinecrest's lower stretch. The world below is built to that budget and counted again as built (section 6).
