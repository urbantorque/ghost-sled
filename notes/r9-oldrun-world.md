# Round 9, the Old Run's world (the `oldrun` lane's world builder)

The brief is `notes/r9-briefs/oldrun.md` section 2 ("A place of its own"); the rules `notes/r9-lanes.md`. This file is
the world's: what was built, why a player would feel it, what the critics said, what Low costs, what is short. The
lane's own notes (the sim, the set pieces' sim, the score, the pool, registration) are `notes/r9-oldrun.md`. Frames
are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/oldrun/world/`. Nobody has ridden the Old Run by hand,
and every frame here is staged (a sled held on a line at a speed, `scripts/r9/oldrun-world-frames.js`), not a ride.
Commits: 9d66cc2, 278e07e, f9a2100, ecc278a, 3ea1564, bd21bbe, d4f3dee, 73b534b, c2686a4 (render, key art, test,
scripts) and this file. Every commit: `tsc` clean, `tests/five.test.ts` green (the five's fingerprint never moved), and
the render tests touched (`oldrunworld`, `palette`, `hours`, `flora`, `feel`) green. One commit (3ea1564) went in with
`tests/hours.test.ts` failing (a chained `grep` read as success); the next (bd21bbe) fixed it.

## 1. What the world is (each decision, and the reason a player would feel it)

- **The track is ice, not a snow corridor.** The channel is drawn through the snow material's own ice path under a
  `TRACK` branch only the Old Run's terrain compiles (`materials.ts` TRACK_GLSL, `terrain.ts` aTrack): a polished
  blue-white with a soft mirror of the sky's own gradient, and none of the snow's dunes, ripples, relief or grain. In
  its three values: patches of white rime over the polish, a darker clear heart between them, bubbles frozen in it under
  the lens, faint plate fractures. The ice runs on over the lip up the parapet's inner face to where its crest rounds
  over. A player reads a made track, and a fast one.
- **The glaze shows, where the sim lays it.** Each terrain row asks the sim's own `surface()` which side carries the
  glaze and whether the floor is slush; the shader cuts the band at oldrun.ts GLAZE_LO to GLAZE_HI a pixel wide: a deep
  clear blue, darker than the wall round it, mirroring the deep upper sky (never warm: first drawn warm and long it
  read to a critic as a gold line to follow, gold-white's role), a frost-white hairline at its top and foot, the sun's
  path a short glint. The line the bend pays for is the line that shines; nothing drawn suggests a line the sim does not
  reward (ART.md 14). `tests/oldrunworld.test.ts` holds the paint to the sim's surfaces.
- **The slush reads dull**: soft lumps in the shade's own blue in a bend's floor, never shining, old runner ruts in it.
- **Past the lip, a crest of snow, never a cliff.** The sim keeps its wall's curve rising past the lip; drawn, that
  towered as rock. Everything past the lip stands on `ground.ts crestGround` (oldrun.ts drawnGround's crest, its fall
  to the forest floor lengthened from 5 m to 16 m: at 5 m, from across a bend, its shaded outer face read to the blind
  critic as a dark slab), read through `groundOf` by the terrain, the mid-ground's edge and `visualGround` (every prop).
  The crest is snow all along (the ledge-face test had painted a bend's crest as Pinecrest's rock strata).
- **A forest of its own kind** (`oldrunflora.ts`): old beeches (smooth grey trunks, wide crowns of forking limbs) and
  birches (white trunks ringed dark, upswept crowns), bare, snow along the limbs and in the crooks. The full tree's
  crown is twig spikes alone, so its shadow under the low sun is lace (a haze of twigs cast solid wedges across the
  far wall); Low's tree is spikes too (Low's haze read as cards perched like birds); the far tree keeps a thin haze.
  Under the low sun the trunks rake bars of shadow across the ice.
- **No hero at the vanishing point, no sea of cloud.** The panorama is `hills` (`massif.ts`: low rounded ridges, the
  hero patch closed to a point). Below them the valley's floor is a lake of open water (`SEA_GLSL` lake mode): a deep
  cold body, the sky mirrored toward the horizon, slow ripples, the low sun's path in broken glitter. The mid-ground's
  valley villages are a lake town (stucco, a church, open dark water; no longer Sakura's vermillion pagoda, which every
  mountain not named in `village.ts` borrowed).
- **Its own light** (`palette.ts` `oldrun` rows): a low late sun of a winter afternoon, ahead-left through the wood, a
  soft disc over a slate-blue sky; cream snow, slate-lavender shade; cumulus banks heaped off the far ridges, few
  wisps. The journey: the sun lowers and warms through the wood (650 to 1,450 m), sets in rose (not Pinecrest's honey)
  over the lake through the Horseshoe (1,900 to 2,500), and the line is crossed under an amber band in the first blue of
  evening, the lamps lit (2,700 to 3,000). Its places (`PLACES`): the hotel's warm light, the wood's shafts, the
  Labyrinth's shade with the lamps telling, the lake's rose, the timing house's lamps. Shafts a little only (from a low
  sun ahead they lay pale wedges down the near walls). Low's poster keeps less of the sun's warmth (it read as sand).
- **Its other hour: by Lamplight** (`ALT_HOURS.oldrun`, name "Lamplight", phrase "by Lamplight"; the lane put the
  words in the game layer): a half moon over the far ridges, the snow in its cold light, the hotel's windows lit, the
  lamps' broad soft wash on the ice (a pale warm white: amber on the lavender ice read as magenta; silver pools are
  Lanternfall's alone, `tests/hours.test.ts`), the windows spilling light on the snow before them, the sled lantern's
  pool larger and falling off with height on the walls (measured across the ground it stood up a wall as a column),
  snow falling from the Labyrinth on.
- **Its places** (`oldrunworld.ts`, imported on demand the first time its course is drawn: nothing in the first
  download): the grand hotel down the start house's straight on the right, three blocks stepping down the slope, cream
  render with windows in cream surrounds and green shutters, string courses, quoins, slate mansards with dormers, a
  gabled pavilion over a glazed veranda, two spired towers (the lower flying the resort's green), on a terrace with a
  balustrade, facing the low sun; the start house, a timber shed over the first metres with a bell turret and the
  starter's box; a low timber rail along both crests the whole run and iron lamp standards on it every 23 m down the
  run, their glass lit as the day goes; the timing house at the line on the left crest, a clock tower on its up-run end
  whose face looks up the track (a low hipped cap and an open cupola: a pointed cap read as Pinecrest's steeple), the
  judges' balcony, a flagpole; the line across the ice in four rows of big ink and cream checks; onlookers (still
  figures, `crowd.ts stillCrowd`, one draw, the resort's greatcoats and hats) set back on the hotel's terrace, on the
  bends' crests, at the Labyrinth's board, in two stands at the Horseshoe and lining the outrun.
- **None of the five's grammar on it**: no grandstands, gate, lift line, hut or km arch (`landmarks.ts` layout),
  no overlook or composed place (`overlook.ts`, `compose.ts`), no stakes or slalom flags (`speedposts.ts`).
- **The set pieces' props** (`oldrunpieces.ts`, from the lane's `moments.ts` plays): the Bend Bells, bronze (olive
  body, gold only when lit: coral read as the rider's family) on ropes from iron brackets on the outside crest over the
  sim's targets, the next one breathing, a rung one swinging and lighting the wall, a missed one dark (one instanced
  draw); the Labyrinth's banded entry posts with a wire of pennants, and at its exit a timing board whose dial's hand
  sweeps the split's time as it is ridden, its lamp marigold while ahead, cold behind, flaring on a win, guttering on a
  loss; the Horseshoe's lanterns on the hook's outside crest lighting in step with the hold on the glaze. No HUD
  signal. `verbworld.ts` and `marqueeworld.ts` keep their generic props off the three verbs.
- **Its title** (`keyart.ts`, `oldrun`): the reel rides the Horseshoe's lead bend in the sunset, the lens high over
  the channel and swung left, the low sun in the channel's mouth between the bare woods.

## 2. Every hunk in a file other render systems share

- `world.ts`: the `OldRunWorld` type import and `oldrunplan` import; three fields (`oldrun`, `oldrunLoading`,
  `oldrunRoot`); the forest's `siteClearings` closure calls `oldrunClearings`; `oldrunRoot` in the scene; `syncOldRun()`
  in the constructor and `setCourse`; `oldrun?.setDetail` in `setQuality`; `oldrun?.reset()` in `beginRun`;
  `oldrun?.update` and `oldrun?.beats` in `frame`; the new method `syncOldRun` (the dynamic `import('./oldrunworld')`).
- `terrain.ts`: imports; `lateralOffsets` spaces the Old Run's columns at 1.05 m or finer (Low's 1.6 drew its walls in
  three facets; its terrain is a third the five's width, so Low pays what the five's does); `ChunkJob.track` and `.gnd`;
  the row loop reads `gnd` (groundOf) and fills `aTrack` from `trackAt` and the sim's `surface`; rock weight 0 on the
  Old Run; `aTrack` in the geometry; `Terrain.trackMat` (`makeSnowMaterial(true)`) made the first time a chunk has it.
- `materials.ts`: `TRACK_GLSL` and `makeSnowMaterial(track)`; under `#ifdef TRACK` only: the vertex attribute, the
  weights (`tIn`, `tGlaze`, `tSlush`, `iceM`), the ice's and the glaze's bodies, the cooled sky and no baked mirror,
  the sun path cut to a glint, the forward sheen off the ice, the lantern pool's height falloff, and the scribe, rime,
  clear heart, bubbles, slush and ruts. Shared lines changed: five uses of `ice` in the mirror and sun path read `iceM`,
  which is `ice` on every course but the Old Run's (the five's shader is the same program).
- `ground.ts`: `groundOf`, `crestGround`, and `visualGround`'s Old Run branch past the edge.
- `midground.ts`: `groundOf` at its reference edge (`sideInfo`) and its edge and skirt columns (`buildRow`).
- `massif.ts`: the `hills` panorama (PEAK_ID, HERO_REACH 0, RANGE, SUMMIT_Y); `SEA_GLSL`'s lake (`seaLake`, with
  `seaOfClouds` a dispatcher so each function has one return: the D3D compiler warned of an unset result);
  `uSeaLake` in `makeSeaUniforms` and `paletteSea`.
- `palette.ts`: `HeroPeak` gains `hills`; `massif.seaLake` (0 in `base()`); the `oldrun` rows of `biomeBase`,
  `clearSkies`, `round7`, `visualLift`, `JOURNEY`, `ALT_HOURS` and `PLACES`.
- `flora.ts`: `forestSteps` and `hasLod` for `oldrun`; `VARIANT_SHARE.oldrun`.
- `landmarks.ts` (`layout` empty for the Old Run), `overlook.ts` (`planTo` plans none), `compose.ts` (`plan` composes
  none), `speedposts.ts` (`update` returns on the Old Run), `village.ts` (its `STYLE.oldrun`, a church for its
  villages, a chapel for its hamlets), `crowd.ts` (`DRESS.oldrun`), `verbworld.ts` (`owns`), `marqueeworld.ts` (the
  verbs it skips), `landing.ts` (the contact shadow lifted off a wall along its normal, behind `c.kit`), `snowsurf.ts`
  (`rutSurface`: runners only scratch the Old Run's ice; its slush takes a shallow groomed cut).
- `src/game/keyart.ts`: `TITLE_SHOTS.oldrun`.
- New: `src/render/oldrunworld.ts`, `oldrunpieces.ts` (both reached only through the dynamic import), `oldrunflora.ts`,
  `oldrunplan.ts`; `tests/oldrunworld.test.ts`; `scripts/r9/oldrun-world-frames.js`, `oldrun-world-glcount.js`,
  `oldrun-world-sort.mjs`. The rows marked "Pinecrest's until its world is made" are all replaced or annotated.

## 3. Frames (`shots/r9/oldrun/world/`)

`sort-*` (the sort's five, High), `sort1/frames/` and `sort1-key.json` (the first sort's set), `r1-*`, `r2-*`, `r3-*`
(the critic rounds' twelve: High day a to h, Low, the other hour), `low-*`, `alt-*`, `mir-*` (the mirror), `med-*`
(Medium), `e-*` (the set pieces), `title-*` (the key art; `title-v1` is the composition kept), `gl/` (the GL counts),
and `dbg-*` (probes). I looked at every set named here; I did not look at `title-phone.png`.

## 4. The greyscale sort (on the Old Run's first frames: its opening, three places and its finish, shuffled with the
five's measure set, `scripts/r9/oldrun-world-sort.mjs`)

- First critic: six groups of five; all five of the Old Run's together and "most of all" unlike the rest: "the
  channel's walls curve up in one smooth, unbroken surface", "bare, thin-trunked trees behind a fenced crest", no
  landmark on the far plane, its hotel and clock tower. It also read the straight frames as Pinecrest's town (a
  steeple, a slab hotel), a dark slab on the bank and the grey band ahead as water, cloud or valley floor. Its folder's
  path named the mountain (it called the group "The Old Run"), so the sort was repeated.
- Second critic, a neutral path, the same thirty frames: the same five together, "an unnamed gully course" that
  "matches none of the five mountains in ART.md", unlike the rest for "one smooth trough whose walls rise over the
  rider", "bare-limbed and see-through" trees ("the only trees not built from cones or puffs"), a far plane "flat and
  empty, with no landmark", wall rides that tilt the horizon. Its finish "breaks the pattern" of the five's. It could
  not tell glazed ice from snow in greyscale, nor the far plane (sea or valley floor).

## 5. The critic loop (fresh Opus critics at extra effort, given only ART.md and the frames)

- Round 1 (twelve frames, open critique), worst first: the glaze a warm band brighter than the snow (fixed: cooled);
  the charm gates' medallions behind the rider's head at the opening (not the world's: the gates' place is the sim's);
  the slush as grey tarmac with a kerb (fixed); the night's moon mirrored on a wall and an amber stripe (fixed); flat
  oval clouds (banks now); Low's sand (fixed); the bell coral (bronze now); the rider's royal-blue coat (the rider's,
  not the world's); no crowd at the finish (onlookers, the checks); one pink-violet in the sunset (planes parted);
  Low's twig cards (spikes).
- Round 2 (blind pairs of round 1 against round 2, `blind-pairs.mjs`): the new side chosen in 11 of 12; lost the start
  frame (the onlookers by the start house read as stacked boxes: removed). Remaining, worst first: light lying on the
  near walls (shafts lowered; see section 8 for what is left), the near walls flat (rime, clear heart, bubbles, ruts
  added), the night's lights (spill, the lantern pool, its rim), empty skies (banks), no contact shadow on a wall
  (lifted off it), stray shapes, Low's straight tracks, the rider.
- No third round was run: the fixes after round 2 are seen only by me.

## 6. Low

A designed cheaper version: Low's own tree (spikes, fewer branches), posts every 8.8 m and one rail, fewer pennants and
windows, the bells one instanced draw, every place and set piece drawn only within reach (420 m on Low, 700 above), no
crowd but the still onlookers. GL calls on a held Low run (`scripts/r9/oldrun-world-glcount.js`, the `mid-100` save,
the sled held at 30 m/s; counts, never frames a second):

| Stretch | The Old Run | Pinecrest (same z0) |
| --- | --- | --- |
| z0 300 (538 to 833 m) | 371.7 calls, 38.8 draws (349.7 / 36.8 before the onlookers and the pieces' uploads) | 351.9 calls, 37.3 draws (540 to 841 m) |
| z0 1300 (1,532 to 1,821 m) | 376.2 calls, 39.8 draws (353.5 / 37.8 before) | 414.2 calls, 42.6 draws (1,446 to 1,746 m) |

So about 6% over Pinecrest on the Hotel Straights (the onlookers' draw and the bells' per-frame upload) and 9% under it
in the Labyrinth. The main lane times frames a second.

## 7. Seen and only scripted

Seen by me in frames: the day on High at the opening, the start, three places, the finish and the set pieces' waiting
states; Low (five frames); Medium (two); the other hour (five); the mirror (three: a mirrored run draws right, the
clock's face mirrored, no lettering anywhere in the world); the title on a desk. Only scripted or not seen: a bell
rung or missed, the split's hand sweeping and its lamp's states, the Horseshoe's lanterns lighting (the frames hold the
sled, so the sim plays them, but no frame caught those moments); the start house from outside; the lake town in the
mid-ground; a phone frame; photo mode and Save Clip (`openPhoto` called on a run left the HUD up: it wants the pause
flow; not captured). Every capture's console was clean (the shoot script returns its errors: none).

## 8. What is short, and what the lane or the main lane must do

- **A pale band on the near wall in a wall ride**, from the vanishing point to the frame's edge, which the second
  critic ranked worst. Turned off one at a time, none of these made it: the ice's mirror, the forward sheen, the snow
  of the parapet's face, the shafts, the lens's speed blur, the spray, the rider's trail, the ghosts, the far shadows,
  the landing aid and six other systems; it is on Low too (no post stack), and gone when the terrain's colour is
  replaced: it is the terrain's own shading, most likely the band of the curved wall turned to the low sun between the
  near snow's darkening and the wall's shaded top. Unresolved.
- **The charm gate in the start house's straight** stands at the vanishing point behind the rider's head at the
  opening (round 1): its place is the sim's (a gate section at 110 m); the lane's call.
- **The rider's coat** read royal blue to two critics against ART.md's ink navy: the rider's, not the world's.
- **On Low, straight converging tracks** (the ghosts' and the rider's runner lines on the glaze lines everyone rides).
- **Photo mode and Save Clip** on the Old Run are not verified (section 7).
- The bells' state uploads every frame within reach; the onlookers are one draw for the whole run.

## 9. For ART.md section 15 (the text I would add; the main lane owns the file)

### The Old Run: a winter afternoon on the old ice track

- **Feeling.** An old resort's afternoon: the grand hotel's track cut down a bare wood, ridden high on its banked ice
  while the sun goes down over the lake below. It ends in the first blue of evening, the lamps lit.
- **Colour script.** A low late sun ahead and to the left through the wood, a soft disc over a slate-blue sky; cream
  snow, slate-lavender shade, the ice a step cooler.

  | Metres | Place | Light and grade |
  | --- | --- | --- |
  | 0 to 160 | The start house and the hotel | Late gold on the hotel's facade, the track leaving the start house's dark mouth. |
  | 160 to 950 | The Hotel Straights | Low sun through the bare wood: bars of trunk shadow across the ice, the glaze catching it. |
  | 950 to 1950 | The Labyrinth | The deepest walls hold the shade; the light on the high glaze and the crests, the lamps telling. |
  | 1950 to 2880 | The Horseshoe | The sun sets in rose over the lake far below; the far ridges lit along their crests. |
  | 2880 to 3200 | The outrun | The first blue of evening under an amber band; the lamps and the timing house's windows the light. |

- **What it is not.** No hero peak at the end of the track and no sea of cloud: low wooded ridges round a lake of open
  water far below. No pine: a bare wood of beeches and birches, lace against the sky. No grandstands, no square, no
  arch: a timing house with its clock at the line.
- **The track.** Ice from wall to wall, polished blue-white with rime, a clear heart and bubbles; the glaze a deep
  clear band high on each bend's outside wall exactly where the sim lays it, cool, a frost-white hairline at its edges,
  never warm or long (a warm band reads as gold-white's line); the slush dull in a bend's floor. Past the lip a crest of
  snow and a timber rail, never rock; iron lamps on it the length of the run.
- **Its other hour: by Lamplight.** A half moon, the lamps' soft wash on the ice, the hotel's windows lit and spilling
  on the snow, snow falling through the lamplight from the Labyrinth on.
- **The set pieces as light.** The bells bronze, the next breathing, a rung one swinging and lighting the wall; the
  Labyrinth's dial sweeping its split, its lamp marigold while the rider is up on it; the Horseshoe's lanterns lighting
  down the hook with the hold.
- **Low** is a poster of it: spikes for twigs, one rail, the places drawn only within reach; on a held Low run about
  Pinecrest's GL calls, under them in the Labyrinth.
