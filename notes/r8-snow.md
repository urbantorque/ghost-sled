# Round 8: the snow lane (V1, snow as the hero material)

The item: "The snow looks like you could put your hand in it." The ground truth (DECISIONS 367, `notes/r8-review-m0.md`)
found the near snow on Pinecrest, Frostfang, Sakura and Lanternfall one smooth hue ramp with white speckle, broad ruts
already, Ember with wind-combed relief, and a perfect landing throwing a sled-sized puff (smoke-grey on Ember) and less
snow than a fall. Render only: nothing here feeds the sim.

Branch `r8-snow`, worktree `.claude/worktrees/r8-snow`, build `dist/r8-snow` served on 4720 while working. Frames and
raw output: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/snow/`.

**The bar is not met.** Three fresh critics on three sets of ten blind High pairs picked the new frame 6, 4 and 3 times
(13 of 30). Every critic talked about the snow unprompted, so the change is seen, but it is not yet read as better more
often than not. What the critics said, and what was done about it, is below; what is left is under "Still short".

## What a player sees, and why

1. **Three surfaces told apart** (`snowsurf.ts`, new). The sim knows ice (`course.surface`) and the course's sections;
   the snow draws from both and feeds nothing back. A made place (the start, a cruise, benches, switchbacks, a street, a
   bridge's deck, a tunnel, the square) is a groomed lane; a wild one (a bowl, a chute, a gully, a tree run, a ravine, a
   split, the terraces, a fork's channels, a leap's approach) is powder; a leap's landing is groomed (ART.md 4); past
   the corridor's edge is always powder; ice is the sim's. One section gives way to the next over 28 m. The terrain
   carries the weight per vertex (`aGroom`, written by `groomRow` in `terrain.ts`, one float a vertex, no height
   touched). On the courses about half the descent is each (Pinecrest: start, cruises, the bridge, the street and the
   square groomed; the bowls, the tree run, the fork, the chute and the leaps' approaches powder).
   - *Groomed* reads as a lane: a step whiter and smoother than the powder beside it, soft broad swaths, and corduroy
     ribs 11 cm apart under the lens only. The first build drew the ribs and the swaths' seams out to 140 m. Critic one
     read them on Ember's bridge deck as moire, critic two as "long straight parallel lines down the fall line that come
     together like speed lines, which section 4 forbids". So the seams are gone, the swaths are a soft step with no edge
     (to 70 m), and the ribs fade by 13 m, where they do not converge.
   - *Powder* lies in wind-laid pillows, a metre or two across the wind and two or three times that along it, 30
     degrees off the fall line as the ripples lie. They are painted as gouache paints form, not shaded as noise: each
     pillow's face turned from the light is one flat cool value cut from its lit face at the turn with a soft brushed
     edge (the toon ramp is full across a lit slope, so the tilt alone barely shows), the hollows a deeper step of the
     shade's blue, the crests a warm cream. The first version (round value noise, soft) read as smear; the second (round
     crisp shapes) as water caustics; stretched along the wind they read as drifts. Critic one called round two "camouflage
     blotches" on Sakura and the lilac run, so the pillows now paint in the palette's own contrast (Pinecrest's shade is
     about 0.6 of its lit snow and takes them at full strength, Sakura's 0.8 at about half, a moonlit night at 0.4 of
     that), give way inside a cast shadow, and keep to the run's floor and the near bank inside 45 m (critic two: on the
     banks the edge blur smeared them into streaks). The fine wind ripples now hold to about 30 m where the slope's
     foreshortening used to fade them by 7 m (they are gated by the derivative across them, not the footprint).
   - *Ice* is unchanged in the shader (the round 7 glaze, mirror and sun path); what changes on ice is the rut.
2. **Glints that turn with the view.** A glint is now a crystal facet with its own tilt; it flashes only while its
   mirror of the key light turns to the eye, so glints move with the lens and gather where the snow mirrors the sun,
   and the fine glitter does the same. The old twinkle hashed the view into every cell and read as white speckle;
   critic one picked the new frame on every pair where the old one had "dense, rainbow-tinted glitter spread evenly over
   the whole lane". The glitter keeps the light's colour now (its prism tint 0.4 to 0.1). The critics then disagreed on
   how much: critic two called Ember's glints noise, critic three called frames with fewer of them "flatter". The last
   build sits between (a candidate in 42% of cells, the lobe 0.948 to 0.988, wider at night so the moonlit glitter stays
   the night's texture).
3. **Cool light at a shadow's edge.** Inside 28 m, where the shadow map's edges are crisp, the penumbra takes the shade's
   own hue made richer at the snow's own value (a hue shift, never a value change, which is the light lane's). Laid on
   the light's turn across a whole slope it repainted Ember's ash lavender, and across the far field's soft shadows it
   made Sakura's tree shadows puddles; it is a light hand now (0.24).
4. **Tracks with depth** (`trails.ts`). Each sample records what the runners cut (`rutSurface`). In powder the groove is
   a trench as wide as the sled and more, its floor pressed a step cooler, the sun-side wall shading the floor under it,
   the far wall lit, a berm of thrown snow outside each wall broken into clumps (its face to the sun lit, the other in
   its own shade, both crests catching a low sun ahead), and the far berm's shadow on the snow; deeper and wider with
   the carve. On a groomed lane it is a shallow cut with crisp lips over a pressed, paler floor. On ice it is a scratch:
   thin frost-white cuts and fine hatching either side. The ribbon is laid as wide as the trench needs
   (`grooveReach`: 0.9 m each side at a straight glide in powder, 1.2 at a full carve, 0.5 on a groomed lane). Every
   ghost's rut is the same trench, shallower and fainter. Critic two named the old frames' ruts "near-black hard lines
   that read as rail tracks"; my first powder trench deepened the cuts toward that, and they were eased back to the
   soft periwinkle ART.md 4 asks for.
5. **Snow that moves** (`particles.ts`, the snow's own functions; budgets in `fxhub.ts`).
   - A perfect landing throws a ring of powder skimming out flat over the snow all round the crater, billows that swell
     as they slow and ride with the sled, and a veil of lit dabs hanging over the crater. With the burst and the crown
     it is more snow than a fall (54 billows against a crash's 39 at the High budget; `tests/snow.test.ts`).
   - Thrown snow is snow. A puff's shaded side under a dark shade (Ember's plum, a night's) is lifted toward the lit
     powder, never under 0.55 to 0.6 of its value, so Ember's spray is no longer smoke; lifted in its own hue it went
     lavender against the orange light (critic one), so it lifts toward the lit cream instead.
   - A ghost leaves powder hanging: every few metres of a grounded ghost's line within 80 m ahead of the rider, two thin
     lit veils either side of its line and now and then a dab, drifting out and settling over a second or two (Medium
     every 4.5 m, High 3, Ultra 2.5, Low none). It is set off from `GhostTrails.add` through a handle in the effects
     hub (`fx.snow`), so the ghosts' code is untouched.
   - Spindrift: in gusts that come and go over a few seconds, the wind lifts thin wisps off the crest of a bank standing
     over the run 14 to 70 m ahead and streams them across the run (Medium 7 wisps a second at the gusts' height, High
     12, Ultra 16, Low none, reduced motion none). The wisps are mist, not grains: a grain still in the world streaks
     past a 30 m/s lens into a speed line.
   - A carve's plume and a drift's spray were already sized by speed and edge (round 7's rooster tail); unchanged.

## The critics (blind pairs, High, desktop, `blind-pairs.mjs --max 10`)

| Round | Seed | Build | New frame picked | Pairs | Key |
|---|---|---|---|---|---|
| 1 | 7 | first full build | 6 of 10 | `shots/r8/snow/pairs1/` | `shots/r8/snow/keys/pairs1.json`, picks `picks1.json` |
| 2 | 11 | after critic one's fixes | 4 of 10 | `pairs2/` | `pairs2.json`, `picks2.json` |
| 3 | 13 | after critic two's fixes (the last build then moved the glints half way back and packed the ruts' attribute; not re-judged) | 3 of 10 | `pairs3/` | `pairs3.json`, `picks3.json` |

Each critic was a fresh general-purpose agent on Opus at high effort, given only ART.md's path, the pairs folder and the
brief's question. Their verdicts in short:

- *Critic one* (6/10). Won where the old frame had "dense, rainbow-tinted glitter spread evenly over the whole lane,
  which reads as noise", and for "soft wind-slab and sastrugi relief in periwinkle". Lost on Sakura and Lanternfall
  ("dark lavender brush-blotches ... camouflage"), on Ember's bridge ("fine regular vertical striping that reads as
  moire", "lavender puffs that clash with the orange light"), and named "a polka-dot stipple of darker spots" on a lit
  bank (the grain, now light-only and on the run's floor under the lens).
- *Critic two* (4/10). Most reasons were the run, not the snow (rider size, which ghost was in view, HUD overlap).
  On the snow: the groomed lane's "long straight parallel lines down the fall line" as speed lines, "the right bank
  smears into a violet motion-blur mess" on Ember, "glitter speckle covers the whole floor" on Ember's halls,
  "dark violet streaky smudges" on Lanternfall's slope; and in both builds the ruts as "near-black parallel lines".
- *Critic three* (3/10). Again mostly the run (rider size, the HUD, a ghost in view). On the snow it went the other way
  from critic one: the old frames won for "more sparkle glints and finer ripple texture", "grain, wind texture"; the new
  snow read "flatter, washed"; it still called the old frames' glitter "noise" on Lanternfall where it lost them.

**What the loop says.** The surfaces are seen (all three named the snow in nearly every reason). The fixed frames do not
hold the run still: the same distance on two builds has a different rider size, ghost in view and banner, and those
decided many pairs. Two of the three critics disagree on the one thing that moves most (how much glitter), so tuning the
glint against one critic loses the next. The groomed lane's corduroy cannot run down the fall line in this art bible;
real corduroy does. A fourth critic was not run.

## Cost (measured on the same frames, before = the round's before build `dist/r8-before` on 4860)

- *Draw calls and triangles* (frames' JSON, mean over every frame, High): before 95.7 / 100.4 / 98.5 / 100.2 / 99.6
  draws on the five mountains, after 95.7 / 100.2 / 98.3 / 100.6 / 99.1 (set three); triangles level to under 1%
  (Pinecrest 1,002,538 against 1,004,514). No new draw, pass or program: the trench is the same ribbon, wider; the new
  powder is in the layers already drawn; the terrain gains one float a vertex.
- *Low* (set two's build): 45.7 / 50.9 / 47.0 / 47.6 / 51.0 draws against 47.4 / 54.4 / 49.3 / 49.9 / 50.2 (the
  difference is the run's own, which ghosts are in view; nothing of mine adds a draw on Low). The phone on Medium:
  85.3 / 89.2 / 89.3 / 90.6 / 90.3 against 84.8 / 89.4 / 88.9 / 89.9 / 89.7.
- *GPU, the snow's own pass time on High* (`?gpu`, `snowgpu.js` in the session scratch: the scene pass read with the
  terrain drawn and hidden, three times each, at a held frame, 1280x720 headless on the Arc 130V, other lanes' browsers
  up; raw in the session scratch, summarised here). Every figure is the scene pass with the snow minus without it, ms:

  | Frame | Surface | Before (passes) | After (passes) | Mean before / after |
  |---|---|---|---|---|
  | Ember 1500 | groomed | 1.81, 1.74, 1.83 | 2.43, 2.54, 2.38 | 1.79 / 2.45 (+0.66) |
  | Sakura 300 | powder | 2.77, 2.44, 3.64 | 4.08, 3.34, 2.81 | 2.95 / 3.41 (+0.46) |
  | Pinecrest 300 | powder | 3.60 | 3.43 | one pass each |
  | Pinecrest 900 | powder | 2.10 | 0.87 | one pass each |
  | Lanternfall 2550 | groomed | 3.97 | 1.54 | one pass each |

  The interleaved frames say the snow costs about half a millisecond more on High (a sixth to a third more than it
  did); the single passes swing by two, so they say only that nothing doubled. The whole scene pass read 11 to 27 ms on
  this shared machine, so High's 60 fps on it is not proven by me either way; the main lane's quiet sitting must check
  it, and if half a millisecond is too much, the first thing to drop on Medium is the grain and the second octave of the
  pillows (`snowPillows`).
- *Low at 6x*: the shader's added work on Low is one value-noise octave for the pillows' value inside 45 m, the swaths'
  step, and a branch for the bleed; no uniform was added to the shared material (no new uniform call a frame), no draw,
  no texture. The CPU work added on Low is one float a vertex in the terrain's time-sliced build and one
  `course.surface` call a groove sample (about one every 0.6 m); the ghosts' powder and the spindrift are off on Low.
  *Low's GL calls a frame* (`glcount.js`, a 10 s autoride on Low, before then after, raw in
  `shots/r8/snow/glcount/`): with the surface first sent as an attribute of its own, Pinecrest 483.7 to 484.0 and Ember
  446.6 to 447.5 on the same stretch, the whole difference one more `bindBuffer` and `bufferSubData` a frame. So the
  surface now rides in attributes the ruts already upload (the groove's arc is a `vec2` of arc and surface, a ghost's
  birth time a `vec2` of time and surface): Ember 488.5 to 485.8, Pinecrest 491.7 to 497.4. Those two rides covered
  different stretches (Pinecrest 206 to 536 m against 204 to 515 m), and Pinecrest's extra is in draws and program
  changes (`drawElements` 22.6 to 23.2), which nothing of mine adds on Low; the count of uploads is back to the
  before's. A same-stretch recount at the main lane's sitting would settle it.
- *First frame*: nothing new runs before `gs-first-frame` (the groom weight is written as each terrain chunk is built,
  inside the existing budget).

## Low and the phone

- **Low** gets a designed, cheaper version: the groomed lane as soft swaths with no ribs; powder's hollows and crests
  painted from one broad octave with no normal; the trench, the berm and the scratch on ice exactly as on High (the
  same ribbon and shader); the facet glints where Low already drew glints; a perfect's ring through Low's fuller,
  fewer billows. No hanging powder, no spindrift (CPU at 6x is Low's budget).
- **The phone** is Medium: everything High has but the far shadows' tiers; on a tall frame the trench and the powder
  under the lens are half the picture, and read there best (`shots/r8/snow/after2/phone-medium/`).
- **Reduced motion**: the spindrift stops, a ghost's powder hangs still, every beat (the ring, the trench) stays.

## Touched outside my files

- `src/render/world.ts`: one line, `this.particles.spindrift(this.course, s.z, dt)` after the vents' steam.
- `src/render/terrain.ts`: the `aGroom` attribute and `groomRow` (allowed by the brief: no height or corridor touched).
- `tests/ruts.test.ts`: its stub course answers `surface`, `edgeExcess` and `section` (the groove now asks them).

## Still short

- The bar: 13 of 30 blind pairs, not 9 of 10. The next step I would take is a frame set that holds the run still
  (the same rider, ghosts and banners on both builds, so a pair differs only in the snow), then one critic to settle
  the glint, and one decision on corduroy (across the fall line as on a leap's landing, or none).
- Ember's snow reads to every critic as "mud" or "mauve-grey"; that is the palette's (the light lane's V5), not this
  lane's, but it caps what the snow can do there.
- The ring and the hanging powder are judged only from still probes (`shots/r8/snow/fx/`); no critic saw them in
  motion. Nobody has seen the spindrift in motion.
- GPU numbers are from a shared machine (other lanes' browsers up); see the table.
- Low and the phone were not judged by a critic (the brief asks a second critic to prefer them or call them level).
  Their frames (`after2/low`, `after2/phone-medium`) are from critic two's build; the last build changed the corduroy
  (no seams, ribs near only), the pillows (the floor only) and the glints since. `systime.js` was not run on Low.
- Nothing the console said: every capture of every set and probe on High, Low and the phone, all five mountains, was
  clean (the frames' JSON carries the page's errors, none).

## For the main lane to decide or wire

- Whether to keep the groomed lane at all. Two critics read its long lines as speed lines; what is left (a whiter,
  smoother lane, soft swaths, ribs under the lens) is the most that ART.md 4 allows down the fall line. The other
  answer is corduroy across the fall line, as a leap's landing has it, which reads as dunes at grazing angles.
- The glints' amount: the critics split. One number, in `materials.ts` (the candidate threshold and the facet lobe).
- A frame set that holds the run still, so blind pairs judge one change (`frames.js` jumps and rides; the ghosts, the
  banners and the rider's size differ between builds at the same distance and decided many pairs).
- Wiring: none needed. The spindrift is called from `world.ts`; the ghosts' powder through `fx.snow`.

## Text to fold into ART.md (section 4, Snow) and the README

> **Round 8: three snows.** A made place (the start, a cruise, benches and switchbacks, a street, a bridge's deck, a
> tunnel, the square) is a groomed lane, a step whiter and smoother than the powder beside it, in soft broad swaths
> with corduroy under the lens only; a wild one (a bowl, a chute, a gully, a tree run, a ravine, a split, the terraces,
> a fork's channels, a leap's approach) and every bank are powder, laid by the wind in pillows lying 30 degrees off the
> fall line, each pillow's face from the light one flat cool value cut from its lit face at the turn, the hollows a
> deeper step of the shade's blue and the crests a warm cream, in the palette's own contrast; ice is the sim's. Never
> a long straight line down the fall line. A glint is a facet that flashes only while it mirrors the light to the eye,
> so the glitter turns with the lens and gathers toward the sun, in the light's own colour. A crisp shadow's edge near
> the lens takes the shade's hue a step richer. The runners cut a trench with a berm of thrown snow either side in
> powder (the face to the sun lit, the other shaded, the far berm's shadow on the snow), a shallow cut in a groomed lane,
> a frost scratch on ice; a ghost's is the same, fainter. A perfect landing throws a ring of powder flat over the snow
> and leaves a veil hanging over the crater, more snow than any fall; thrown snow is never darker than about half its
> lit side, so it is never smoke. A ghost leaves powder hanging where it passed, and the wind lifts spindrift off the
> banks' crests in gusts (Medium and High).

README ("Round 8"): the snow lane: three surfaces read from the course, a trench behind every sled, glints that turn with
the view, a perfect's ring, ghosts' hanging powder and spindrift; render only, no draw added; Low gets the painted
surfaces and the trench, not the moving snow.

## Where things are

- After sets: `shots/r8/snow/after/` (critic one's build), `after2/` (critic two's build, with `low/` and
  `phone-medium/`), `after3/` (critic three's build). Before: `shots/r8/before/`.
- Pairs and keys: `shots/r8/snow/pairs{1,2,3}/`, `shots/r8/snow/keys/`.
- Side by sides from the iterations: `shots/r8/snow/sbs*`, crops in `crops/`, the landing probe in `fx/`.
- Tests: `tests/snow.test.ts` (surfaces, the terrain's attribute, the trench's reach, uploads, a perfect against a fall,
  the moving snow's budgets and reduced motion), `tests/ruts.test.ts`.

## The stills pass (round-8's `stills.sh`: the run held still, a pool rider replayed on a virtual clock)

Merged round-8 (a3c8398, b2ff12f). The main lane's calls: a groomed lane's corduroy lies across the fall line only (ribs
30 cm apart, under the lens), the glints at the halfway setting until re-judged. Pairs cut by `blind-pairs.mjs --max 10`
from the frames where the snow is the subject (every fixed frame but streets, tunnels, bridge decks and the finish, 148
on High), against `shots/r8/before-stills/`.

| Pass | Build | Tier | New frame picked | Pairs, key, picks |
|---|---|---|---|---|
| 1 | 434585f + corduroy across | High | 0 of 10 | `stills-pairs1/`, `keys/stills-pairs1.json`, `stills-picks1.json` |
| 2 | 26121f0 (the fixes below) | High | 4 of 10 | `stills-pairs2/`, `stills-pairs2.json`, `stills-picks2.json` |
| 2 | 26121f0 | Low | 6 of 10 | `stills-pairs-low/` |
| 2 | 26121f0 | phone, Medium | 3 of 10 | `stills-pairs-phone-medium/` |

- *Stills critic one (0/10)* named my ruts first: the wide trench's lit berms, seen from straight behind the sled, "fan
  out from under the sled as bright radial smears" that "read as speed lines on the near snow", where round 7's
  "crisp twin grooves with a lit lip" won; and the old frames' denser glitter. Fixed: the groove is round 7's width and
  crispness again (still a little deeper and wider in powder, shallow on a groomed lane, a frost scratch on ice, ghosts
  fainter), the glints at critic one's density, the pillows' painted faces a lighter hand.
- *Stills critic two (4/10)*: on the snow, the across-the-fall-line corduroy as "regular horizontal banding ... like
  scanlines or dunes" (the groomed start, a bridge deck), Sakura's shadow pools "large and heavily saturated", a night
  spray "a dull grey-beige smudge". Most other picks went on where a ghost or its pill sat, which still differs a little
  between builds (the ghosts' worker timing).
- *Low and the phone (one critic, both folders)*: Low prefers the new frame 6 of 10, so it passes the brief's "prefers
  or calls level" (the losses: ghost placement, and a dark spiked crater lip on the old side won by the new). The phone
  prefers the old 7 of 10: on the new side "regular horizontal banding" (my corduroy, three pairs), "huge blue-violet
  streaks converge behind the sled", "dark smeared shadow blobs", "dark violet scribble smudges" (my pillows on a tall
  frame, where the near snow is half the picture). Both sides throw "dark navy clods" of spray now and then.

**Where it stands.** On held stills the snow lane does not beat round 7 on High or the phone; it does on Low. What every
critic has rejected is drawn now as round 7 had it or nearly (the groove, the glints); what is still mine and still
named is the corduroy in any direction (down the fall line it is speed lines, across it scanlines) and the pillows on a
tall frame. If the main lane takes this branch, my advice is to take the surfaces' data, the ruts' surface awareness
(the scratch on ice, the shallower groomed cut), the facet glints, Ember's spray as snow, the perfect's ring, the ghosts'
hanging powder and the spindrift, and to set the corduroy's ribs and the pillows' painted faces to zero
(`corduroy`'s `cd.w` and `faceSh`/`hollow` in `materials.ts`) until a person has looked at them in motion.

## The merge check (corduroy ribs and the pillows' painted faces off; everything else kept)

Built with `CORDUROY_RIB`, `PILLOW_FACE` and `PILLOW_HOLLOW` at 0 (named constants at the top of `SNOW_SURF_GLSL`), shot
as stills on High and the phone (`shots/r8/snow/stills3/`), fresh pairs (seed 23, the same snow-subject frames,
`stills-pairs3-{high,phone-medium}/`, keys and picks in `keys/`), one fresh critic.

- **High: the new frame 6 of 10.** Level or better: it holds.
- **The phone: the new frame 2 of 10.** It does not hold. The critic: "most of these picks were decided by whether a
  mint ghost sits just ahead with its runner lines, rather than by the snow itself" (the stills still differ in which
  ghost and pill are in view). What it named on the new side that is the snow's: "a fan of blue grooves converges down
  the foreground like speed lines" (Frostfang 3750), and a spray that "leans mint-teal, which belongs to ghosts"
  (Sakura 3706). Nothing it called broken in the new frames is new to them alone except those two; the rest (pills on
  the hero, the sled's pale underside, Ember's grey ash, the hex columns) is in both.

By the main lane's bar (5 of 10 or more on each, nothing broken named) this build is not ready to merge: High passes,
the phone does not.

## What a second attempt should try

Everything the critics said across eleven blind passes (three on the run's own frames, five on held stills, three on
Low and the phone), sorted.

**What reads as snow.**
- Long cast shadows raking toward the lens with sparkle along them (ART.md 11's second mark): every critic rewarded it,
  on both builds. The snow is best where the light does the drawing.
- Wind relief with a lit crest and a cool lee face, crisp and sparse: round 7's sastrugi and slab on the banks were
  named as good in every pass. Relief that carves the snow at a scale the lens can read (metres, not centimetres).
- Crisp twin runner grooves with a lit lip running to the bottom of the frame, and a ghost's mint runner lines ahead:
  "skill written in the snow". A groove that is a crisp line beats a trench that is a band.
- Glitter in the light's own colour, gathered toward the sun, a little denser than looks safe: one critic punished
  rainbow speckle spread evenly over the lane, another rewarded the old denser glitter; facet glints at the denser
  setting satisfied both kinds of comment.
- Lit cream powder in a spray or a landing (and a ring of it); never darker than about half its lit side.

**What reads as paint, and what to avoid.**
- *Speed lines:* anything long and straight that runs down the fall line and converges on the vanishing point, whatever
  it is meant to be: a groomed lane's ribs or seams, wide lit berms either side of a trench seen from straight behind
  the sled, a fan of grooves under a tall frame. ART.md 4 forbids it and every critic found it.
- *Scanlines:* anything fine, regular and across the fall line: corduroy across the slope compresses at a grazing angle
  into horizontal bands. So a groomed lane cannot be drawn with ribs from a chase lens at all; it must be told by value
  (whiter, smoother, a soft swath step), and by what is on it (old tracks, a pressed groove), never by lines.
- *Smudges and camouflage:* painted shapes from noise, however crisp their edges, read as blotches, puddles or water
  caustics on the soft palettes (Sakura, a moonlit Lanternfall) and as "dark scribble smudges" on a tall phone frame.
  Pillows of powder want real form: a lit face and a shaded face on shapes a few metres across that follow the wind,
  lit by the frame's own key, not a value laid over noise. Try them as geometry (a few centimetres of real relief in
  the near terrain's normal, the mesh being dense enough near the lens) before painting them again.
- *Saturated shadow:* a hue lift inside a soft shadow fills it and reads as a puddle; keep any bleed to a crisp edge's
  rim, or leave it out.
- *Colour leaks:* thrown snow must keep the snow's hues; a lift toward a cool shade went lavender on Ember and, once,
  mint-teal on Sakura (mint is the ghosts').

**What the near snow on a tall phone frame needs.** On an upright phone the snow under and behind the rider is the
lower half of the picture, seen at its steepest. Every mark there is twice the size of the desktop's and runs straight
at the lens. It wants fewer, larger, softer forms (the shadows and the light, not texture), the groove as two crisp
lines, and nothing that repeats at a regular pitch. Judge a phone version on the phone's own frames; what passed on
High failed there.

**How to judge it.** The held stills are the right tool; they still differ in which ghost and pill are in view (the
ghosts' worker timing), and that decided most of the pairs in every pass. Hide the ghosts and labels for a snow pass
(or freeze the ghost poses with the run), then judge the snow alone; and look at the moving snow (spindrift, a ghost's
hanging powder, the landing ring) in motion, which no critic here has seen.
