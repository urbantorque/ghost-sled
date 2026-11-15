# Round 7: the shared lane (faults every mountain's critic flagged)

Lane `r7-shared`, branch `r7-shared` cut from `round-7` at `9f64ac5`, port 4535, session `r7-shared`. Render only:
nothing in `src/sim`, `src/bot` or the ghost pools changed, and nothing drawn here moves where anything is or what it
does. The colour roles hold: the lights are marigold, the ghosts mint, the rider vermillion and ink navy.

## What each fault was, and where it was drawn

1. **Fuel drops (spirit lights).** `props.ts` drew every light near the lens as the old `meshes.ts lightGeometry` (a
   faceted lathe, skin and core) in the generic toon material with a flat marigold emissive, so it was one flat
   yellow value lit by nothing, 1.1 m (a great light 1.65 m) tall at any distance: beside the rider or the lens a
   seventh of the frame. The lights the sim hangs along a leap's flight and a kicker's high line (`course.ts`,
   hover up to 11 m) stood over the lens as a giant drop in the sky (Frostfang 300 m on Low, reproduced at the same
   clock, 0:08.8, in this lane's before set). Past the detail range a light was a third batch of octahedra.
   **Pinecrest's "yellow lines" at z1650 are neither fuel drops nor motion blur:** they are the slide set piece's
   sign, two crescents of white-gold line decals on the snow before Mirror Lake (`verbworld.ts`, `slide`), and they
   are as crisp on Low, which has no blur. Not changed here (see "What is still short").
2. **The giant mint figure at Frostfang 2850 m.** Reproduced on a virtual clock (the rider pinned to the safe line
   at 30 m/s, at 2850 m when the run's clock reads 1:29.9, as in the review's frames) and probed frame by frame:
   it is a **pool ghost, `winter164`**, in the air off the bank on the right beside the lens, 2.9 to 3.8 m from it
   (the rider is about 5.7 m), its chest 70 to 92 px in radius, so the figure stood about 0.35 of the frame's height
   (nearly twice the rider) and its wisp crossed the right third, in the two seconds of a pass beat. The size fade
   in `ghosts.ts` only began at 0.38 of the frame's height, so it drew at 86 to 100% strength; the review lane's
   earlier attempt moved that start to a third, which this ghost sat just under, so the frame did not change. It was
   not a trail, a legend, a ward or an echo.
3. **Glows bleaching the rider.** All reproduced frame for frame on the virtual clock with a replayed pool run
   (`?demo=2`, its own dashes, wards and landings):
   - the ward's paper lantern (`wardfx.ts`) was a premultiplied shell laid **over** the rider at 34 to 86% cover:
     inside it the rider was a gold blob (Frostfang 3419 m: the review's mo-z3418-0, the same frame);
   - the dash (`rider.ts`) lifted the whole body toward white-gold and burned a white-gold rim from a third of the
     way in from the silhouette at 1.5: a dashing rider was a cream figure (Frostfang 422 and 829 m, every mountain);
   - the flow's vermillion rim (`rider.ts`) grew in from 0.38 of the edge at up to 2.6: a full flow and its pulse
     turned the coat red and bloomed (Sakura 607 m, dash and flow together: one red blob);
   - the lights that ride with the rider (`spirit.ts`: the ward's 2.8, the dash's burst 2.6 and 1.3 for its length,
     a lantern's and a gate's moments) were centred on the rider at full strength: its pale parts and the snow round
     it went to one cream sheet that fed the bloom over it.
4. **The sled's underside** (if time allowed): the classic sled's slats seen from below in a flip were one value of
   wood.

## What changed, and why

Commits on `r7-shared`, oldest first.

- `370bbce` **Spirit lights are small flames of light** (`spiritlights.ts`, new; `props.ts`). A smooth teardrop that
  licks at its tip: marigold where it faces the lens, deep amber at its rim and a pale hot heart low in it (a form
  lit from inside, ART.md 14), its side toward the frame's light a touch brighter with a rim of that light, its far
  side a step deeper; brighter at night, holding through fog and brighter in Blizzard, as the old ones. Each has a
  soft glow, premultiplied (it tints the snow by day and adds light at night; on Low, with no bloom, it is the glow),
  and a great light's ring and second flame are drawn in its glow, as light. A light is never taller on screen than
  about a twentieth of the frame (a great one half as tall again; after the critic a knee instead, below), shrinks away inside 6 m of the lens, off the sight
  line to the rider and from round the rider after a perfect landing (as before), and goes as it climbs into the top
  fifth of the frame near the lens (one passed under). The lights over a leap or a kicker stay where the sim put
  them; the glow batch threads a few small motes between neighbours of one arc in the air, so they read as a trail
  over the leap. Where every light stands is unchanged: `props.ts` places each at its sim point as before.
- `314cdf4` A light near the lens out at the frame's side (being passed, out of reach) goes before the speed
  streak at the frame's edges can drag it into a smear.
- `078317a` Past the detail range a light is a small flame painted in its glow, a few pixels tall. Every light on
  the course is two draws (the flames, the glows), where it was three (near sparks, near great lights, far diamonds).
- `b6c7dd2` **No ghost fills the frame** (`ghosts.ts`). After every other fade (the pass beat's floor included), a
  ghost nearer the lens than the rider that stands a fifth again taller than the rider and a fifth of the frame
  dissolves, gone by a third of the frame's height, its wisp, glass sled and tag with it. A ghost level with the
  rider is the rider's size and is untouched however large the rider stands (a phone frames it larger); the title
  reel is untouched. Probed after: `winter164` is at 40% at 1:29.3 and gone by 1:29.4; it stood at full strength.
- `50b5937` **The rider holds through the glows** (`wardfx.ts`, `rider.ts`, `spirit.ts`):
  - the ward's lantern, shards and ring keep contract C10 as the ghosts do: they draw only off the rider's own
    pixels (the rider's stencil), so the rider stands inside the lantern as a navy and vermillion silhouette; the
    cracks' light sits under the bloom's knee but for their hottest frames (1.25, was 1.5);
  - the dash's white-gold rim keeps to the silhouette's outer facets (from 0.62 of the edge, at 1.3) and its bands
    ride over the coat's own value (0.6, under half that on pale parts), the body lifted a breath, not to cream;
  - the flow's vermillion rim keeps to the outer facets (from 0.72 to 0.58 of the edge as it builds) at 1.45, its
    pulse at 0.8, so the coat stays navy inside a red edge;
  - the lights that ride with the rider stand 3 m ahead of it down the run at 0.65 of their power: the snow it rides
    into takes the light and the rider stands against it; colour and timing are as they were;
  - a local light on the rider rolls off past a lamp's strength (a knee from 0.35), so a moment's flash right by
    the rider never washes its pale parts to cream; a street lamp is under the knee.
- `fad8218` **The sled's underside** (`rider.ts`): what faces down in the classic sled's own frame sits a step into
  shade with the snow's cool bounce, each slat split by a dark seam, grained along its length and darker toward the
  runners. No new shader program or draw: the sled's vertices carry the slats' pitch in their sway attribute and
  the rider's one material reads it.
- `tests/spiritlights.test.ts`: the mirrored great-light flag and its undo, the glow's kind and scale, the motes'
  count, and that a flame costs no more than the old spark (180 triangles).

## How it was judged

- The fixed frames (`frames.sh`, the list of `frames-r7.json`) on High at 1280x720, Low and the phone on Medium, on
  all five mountains: 181 frames a tier, 543 a build, before (`9f64ac5`), on the build the critic judged
  (`078317a`, kept in `after-r2\`) and on the final build (`98a5b9f`, in `after\`). These ride the safe line at
  30 m/s on the wall clock, so ghosts, set pieces and the HUD differ between builds; the lights, the world and the
  rider's place match.
- Frames in motion (`motion.js`; the lane's capture scripts are copied to `shots/r7/shared/tools/`): a pool run replayed as the player (`?demo=2`) on a
  virtual clock, stepped one 60 Hz frame at a time in the page, a shot a fixed number of frames after each dash,
  ward, perfect landing, light taken and take-off (12 to 16 a mountain, the HUD hidden), so before and after are the
  same frame of the same run on all five mountains.
- The probe (`probe.js`): Frostfang 2850 m at the review's own clock on a virtual clock, every ghost's screen size
  and fades logged a frame at a time, and the same frames shot on both builds.
- Flips (`motion.js` with take-off shots 18 to 66 frames on): the pool rider's toboggan upside down over Frostfang's
  first leaps and the kicker after them, on both builds (`flip\`).
- Frames: `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\shared\before\` and `after\` (`high`, `low`,
  `phone-medium`, `motion`, `probe`, `flip`, each with its JSON); `after-r2\` is the set the critic judged and
  `after-r1\` the first. `pairs.txt` lists the pairs (the critic's 52 and three flips), and `sheet-before.png` and
  `sheet-after.png` tile them in the same order on the final build.

## The critic's verdict

One fresh critic (general-purpose, `opus`, `xhigh`), given only ART.md, the 52 pairs' paths (`pairs.txt`) and the two
sheets, asked for each pair whether the after is better, worse or the same on the four faults and what broke. It
judged the build `078317a`. Its overall verdict:

| Fault | Verdict | Where it is still short |
| --- | --- | --- |
| 1. Fuel drops | **Clearly better** on all three tiers: "the flat unlit polygons and the oversized slabs near the lens are gone in every pair"; a core, a rim and a halo that lights the snow; no yellow lines at speed | Lights still hang in the sky over leaps (5 pairs); near drops overshot into small round orbs, about a fifth of the rider's height, not growing toward the lens; Low's pale lemon-white, near your best's gold-white; on Ember close to the embers; the great light's ring not reading |
| 2. Giant mint figure | **Better**: fixed in the same-moment probes; absent in Ember's | A ghost column over the First Drop on the phone, the same as before; the ghost "taken back" leaves no trace |
| 3. Rider bleaching | **Much better**: "every ward and dash pair now holds the navy coat and the vermillion beanie and scarf" | Partial in Lanternfall's cloud (sleeves and sled pale lilac); the dash's rim and bands and the ward's paper now read weakly |
| 4. Sled underside | **Unchanged** | See below: the one pair it was judged on does not show the underside |

It named nothing broken: no colour-role violation and no new artefact but a possible yellow streak at a chute's mouth
(Frostfang 829 m in motion), which on inspection is a line of far lights stacked along the sight line down the chute.

### What changed after it (`0c8d0ce`, `98a5b9f`)

- **Near flames keep their shape and their depth** (`spiritlights.ts`): the hard cap became a knee. Past a
  twentieth of the frame a flame grows at a third of its rate, so a nearer one is still a little bigger and one by
  the rider stands about 7% of the frame (a third of the rider) instead of 5%; the glow thins to a quarter over the
  flame itself, so its point reads through it instead of a round orb.
- **The great light's ring and second flame are painted** (thicker, covering what is behind them in marigold), so
  a great light reads as one on bright snow.
- **The motes over a leap are a dotted line**: about one every 2 m (was 2.4, at most five a gap), each a small
  painted light with a glow, so the lights over a leap read as a trail by day.
- **Low keeps the lights marigold**: on Low (no tone curve) the glow's light is a little over half and the flames'
  hearts and painted parts lean less to white-gold.
- **The dash reads as a dash again**: the white-gold rim from 0.56 of the edge at 1.45, the bands at 0.85 on the
  coat (under half on pale parts); the rider still holds its navy and vermillion.
- **Every sled's underside**, not only the classic's: the toboggan's three broad slats (the pool rider's sled in
  every Frostfang motion frame), a flat deck's, and a round or shelled hull's take the shade, the bounce and the
  grain; slatted ones their seams.
- The critic's pair 45 (Frostfang, 26 frames after a take-off) shows the toboggan's top from the side, not its
  underside, so it could not judge fault 4; frames mid-flip were shot for it on both builds (`after\flip\` against
  `before\flip\`, the same frames; pairs 53 to 55). Before, the upturned toboggan is three slats in two flat values;
  after, they sit a step into shade with a seam between each, a fine grain and darker edges. A step, not a
  transformation: the underside has no geometry of its own to light.
- Checked after the fixes, on the final build (the whole fixed set, the motion set, the probe and the flips), beside
  the before and the judged frames: near flames read as pointed teardrops with a halo, about 45 px by the rider in
  a night street (Frostfang 1550 m) and still a little larger nearer the lens; the lights over a kicker read as a
  dotted line up to it (Frostfang's flips, 54 frames after take-off); Low's lights are marigold, not lemon-white;
  the probe is unchanged (`winter164` gone). No second critic was run.

## Cost

Mean over the fixed frames from the frames' JSON (the renderer's counter summed over every pass of a frame), the
whole set (181 frames a tier) on each build. The fixes after the critic change shaders and constants only, no batch
or draw: the two after columns differ by the run-to-run spread.

| Tier | Before `9f64ac5`: calls mean / max, triangles | Judged `078317a` | Final `98a5b9f` |
| --- | --- | --- | --- |
| High | 99.2 / 113, 888,261 | 98.4 / 113, 885,131 | 98.3 / 113, 884,772 |
| Low | 49.6 / 64, 135,780 | 49.2 / 63, 135,794 | 49.6 / 63, 136,262 |
| Phone, Medium | 89.5 / 104, 622,481 | 88.7 / 104, 621,573 | 88.8 / 102, 620,114 |

- Every light on the course is two draws (the flames, the glows) where it was up to three (near sparks, near great
  lights, far diamonds). The first after set, with the far diamonds still their own batch, measured Low at 50.5
  calls a frame (a glow batch drawn in frames with no great light in view); painting the far flame in the glow took
  it to 49.2, and the final build measures 49.6, level with the before.
- A flame is 180 triangles, the old spark's skin and core; a great light is 180 where it was 414; a glow is 2, a far
  light 2 where it was 16; a mote 2. Frame for frame the triangles move inside the run-to-run spread (ghosts, set
  pieces and spray differ between captures).
- One shader program more than before (the glow; the flame replaces the gifts' toon variant), compiled with the
  first frame like every prop's: small, and not timed here. The rider's sled underside reuses the rider's own
  program.
- The console was clean in every capture, on every tier and in motion (the JSON's `errors`, all 0).
- High was over the brief's 95 calls before this lane (99.2) and is 0.8 under where it was. Frames per second were
  not judged: four lanes share the GPU.

## Shared code touched

Every file below is another lane's; each edit is the smallest that does the job and carries a comment saying why.
None of `palette.ts`, `stages.ts`, `places.ts`, `post.ts`, `town.ts`, `rails.ts`, `meshes.ts`, `lanternworld.ts` or
`climaxworld.ts` changed.

| File (owner) | Change | Effect on every mountain |
| --- | --- | --- |
| `props.ts` (fx; being edited by the mountain lanes) | The lights' batches: imports, the constructor's two materials (the old toon `giftOpts` gone), the `gift`/`gift5`/`giftL` batches become `gift` (flames) and `glow`, and the push loop (a light's flame and glow at its sim point, the air motes); `farLightGeometry` and the far variant set removed. About 80 lines, all in the lights' own code. | The lights look as above; positions unchanged; one draw fewer where the far diamonds were drawn |
| `ghosts.ts` (hero) | `FILL_FROM`, `FILL_SPAN` and the fill fade after the pass beat's floor (12 lines) | A ghost nearer the lens than the rider never fills the frame; the race beside the rider is untouched |
| `rider.ts` (hero) | The dash's and the flow's rim terms; a knee on the local light the rider takes; the sled's underside (`markSled`, three varyings on the rider's one material) | Every rider on every tier; Low takes no local light, so the knee is Medium and High only |
| `wardfx.ts` (fx) | `ghostStencil` on the ward's material; its cracks' light 1.25 (was 1.5) | Every ward, the player's |
| `spirit.ts` (fx) | `RIDE_AHEAD`, `RIDE_K`: the lights that ride with the rider stand 3 m ahead at 0.65 | Every dash, ward, light taken, lantern filled and gate threaded |
| `spiritlights.ts`, `tests/spiritlights.test.ts` | New, this lane's | |

`meshes.ts lightGeometry` is no longer used by `props.ts`; `chaos.ts` still draws the Gift Storm's lights with it.

## What is still short

- **Pinecrest's "yellow lines" at z1650** are the slide set piece's sign (`verbworld.ts slide`: two crescents of
  white-gold line decals on the snow before Mirror Lake), not fuel drops and not blur. They read as a dashed road
  marking. Pinecrest's (or the momentsworld lane's) to restyle; untouched here.
- **Lights over a leap still stand in the sky** in a still taken before the lip: they are the sim's (a leap's flight
  line), smaller now, joined by a dotted line, and gone as they climb into the top fifth near the lens, but a critic
  can still read one far off as hanging there. Moving them is a sim change.
- **The ward's flash floods the snow gold** round the rider in the dark Ice Cavern (at 0.65 of its old power and
  3 m ahead), and the ward's paper lantern, drawn only round the rider now, reads more as a gold haze than a ribbed
  lantern. Its look is the fx lane's to strengthen (ribs, a darker paper edge) without covering the rider.
- **A dashing rider's sled deck** stays a bright warm plank from behind (wood under the dash's light), and in
  Lanternfall's cloud the dash still pales the sleeves.
- **The Gift Storm's lights** (`chaos.ts`, a chaos event) still use the old `lightGeometry` in the toon material.
- **The speed streak** (`post.ts`) still smears whatever is at the frame's edges at speed; the lights now go before
  they get there, but nothing in the post exempts them.
- **A ghost passed beside the lens** goes completely while it would fill the frame; one critic wanted a trace of it
  (a rim). A faint rim is a small change in `ghosts.ts` if the main lane wants it.
- **The phone's ghost over the First Drop** (a ghost in the air at the top of the frame over the lip) is unchanged:
  it is under a fifth of the frame and level with or beyond the rider, so the fill rule leaves it.
- Not measured: the first frame's time (one more small shader program, the glow) and frames per second.
- The fixed frames are wall-clock captures: ghosts, set pieces and the HUD differ between builds. Only the motion,
  flip and probe pairs are the same frame on both.
