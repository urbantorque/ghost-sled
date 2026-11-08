# Round 6, the world lane: notes for the main lane to fold in

Branch `r6-world`, cut from `round-6` at d8aae90. Render only: nothing in `src/sim` or
`src/bot`, no collider added or moved, nothing on a line a sled rides (the `ground`, `setpieces`,
`overlook`, `palette` and `flora` tests hold, unchanged; a new `groves` test holds the groves). A replayed
run (`?demo=0`) finishes on the same clock as before on all four mountains (1:47.5, 1:49.2, 1:48.8 and
1:48.0): the sim is untouched. Frostfang's finish now comes in at dawn.

## Decisions (numbered from 241; renumber as you fold them in)

241. **Ember's basalt stands in formations, and its pines in stands.** The Caldera Leap's banks were the
    decorative forest's two sets dealt tree by tree (70% charred pines and snags, 30% basalt clusters and
    stubs, by an independent hash per tree), so every bank was the same even scatter, and on Low, which
    draws each set's first variant only, a scatter of boxes. Now one plan lays each bank (`groves.ts`):
    the bank is cut into slots 28 m long and each slot is a formation, a stand or clear snow. A formation
    is an organ-pipe outcrop on the crest by the run (15 hexagonal columns in two ranks, graded from 3 to
    9.2 m to a peak a third of the way along, broken drums at its foot, about 280 triangles), another 1.5
    to 2.3 times the size on the shoulder 24 to 58 m out, and a column cluster at the foot of each; a
    stand is 6 to 12 charred pines in a clump on a golden-angle spiral, its outer ring dead, and a smaller
    clump further out. No formation follows a formation on one side, so the rock comes at a rhythm (about
    one slot in five), stands about one in two, clear snow about one in three. A sentinel column 9.5 m
    tall stands either side of every leap's approach, 36 m before the lip, where the view opens. The bank
    dressing follows the same plan: a pair of columns at a formation's foot, a burnt stump at a stand's
    edge, a steaming fissure out in the clear snow; no bushes or fences on Ember (they read as debris).
    Low lays the same plan with one organ pipe for every piece of rock and stands thinned to 45%, so its
    banks are basalt country too, with fewer pieces. Rejected: swapping the meshes and keeping the scatter
    (an even field of better rocks is still debris); thresholding a noise field per tree (blotches, not
    formations); no basalt on Low (Low would lose the mountain's material altogether).

242. **Sakura's blossom stands in orchards.** Each bank is laid in blocks from the top of the run down:
    orchard, orchard, then a stand of pines or an open meadow, in turn, with a path 7 m wide across between
    blocks. An orchard block is 6 to 10 trees long, 5 m apart along a row and 5.5 m between rows, six
    rows on High, five on Medium, three on Low (a tree 6 m apart there), the rows staggered by half a tree
    like terraces; each row keeps its distance from the run's edge, so it follows the bank's contour and
    bends with the run. A block is all pink or all pale (one in three is pale), and now and then a tree is
    gone from a row. The two banks are out of step by 17 m, so the rows never mirror across the run. Every
    leap lands between orchards: from the lip to 260 m past it every block is an orchard, never pale. Past
    the orchards the shoulder has a few dark pines and no pink (Low leaves it bare). Rejected: true contour
    lines across the fall line (from the lens they cut across the bank and fight the run's own lines; rows
    at a constant distance from the edge are the bank's contours and lead the eye down the run); eight rows
    (about 18k triangles a chunk more on High for rows the bank's crest hides from the lens).

243. **The Thousand Torii's posts stand on the lip of the cut.** The corridor is a trough the sim rides
    4 m deep at its limit (3 m past the edge), and its lintels clear the highest air, 21 to 34 m over the
    floor there, so the lintels can only show from about 60 m ahead. The posts stood behind the limit in
    the drawn rock and showed only above it; they now stand just past the limit on the trough's lip,
    thicker (0.72 m, black feet 0.95 m), dark and light by turns, with a lit stone lantern between every
    second pair along the top of the cut. Rejected: lowering any lintel (the air rule); taking the rock
    away past the limit (the sim's own ground rises to 15 m by 9 m out: it is the cut); a lighter lacquer
    (it walks toward the grudge's rose). This is better, not finished: from the chase lens it reads as a
    deep cut under a corridor of gates, the gates above the walls. A camera beat that lifts the lens in
    here would show more of them; that is the main lane's call.

244. **The Ice Cavern is a cavern.** Its roof clears 20 to 24 m of air over the floor (pops from up the
    slope fly in), so it stands 27 m and more up, out of the lens's frame until about 60 m ahead. What
    reads at the lens's height has to be on the walls. Each 5 m bay now has a cobalt crown (two deep masses
    over the middle, where the vault was an even pale honeycomb), three great stalactites (one on Low) whose
    tips hang 0.4 m under the bay's underside, which clears the air by AIR_MARGIN and 0.7 m more; on each
    wall a shelf of ice 5 to 14 m up with six icicles under it (three on Low); and every other bay on each
    side, by turns, a cluster of three crystals at the foot of the ice where the floor meets the wall, lit
    from within (pushed past white so they bloom on Medium and High), leaning back into the wall so none
    comes over the limit. Rejected: hanging the vault lower (the air rule); a smooth lid (a pipe).

245. **Frostfang's Clear Skies goes through the night and out into the dawn.** Four stops where there
    were two: the sun sinks onto the band (600 to 1450 m); polar night with the aurora at full over the
    Crevasse Fields (1700 to 2250); the deep of the night on the way to the Fang, the aurora past its
    crest at 0.75 and the band gone (2700 to 3180); then the dawn (3300 to 3580): the sun swings from 44
    degrees left to 30 right, low (disc 3.6 degrees, key light 20), rose gold on the snow and the peaks
    (alpenglow 0.85), the aurora down to 0.12 and the stars to 0.15. The sun crosses dead ahead at about
    3,440 m, while the rider is under the ice (3,275 to 3,456), so the cavern's far mouth opens onto the
    sunrise and the run comes out into it beside the Fang. The dawn's `dusk` stays 1: the windows and the
    station stay lit at first light, and the soundscape's day only goes on (the palette test's rule that
    dusk never falls holds without a change). No pinned test value changed. Rejected: raising the sun on
    its old bearing (it rose behind the left bank, away from the Fang); a dawn before the cavern (the card
    promises the dawn out of it).

246. **Pinecrest's far lakes are frozen lakes.** They were the gaps in the sea of clouds, which on
    Pinecrest lies at the valley floor's level, so its white read as snow and its gaps (`uSeaDeep`, a
    saturated blue) as flat lakes. I made them what they read as: on Pinecrest's Clear Skies
    (`massif.seaIce`) the sea's openings are frozen lakes anchored in the world (their noise is placed
    where the lens is, so they hold still while the billows drift), with a shore of drifted snow
    feathered into them, a body of pale ice (the deep mixed half and half with the haze), long tongues of
    blown snow over it, and a sheen toward the sun. Low keeps it without the shore's fine octave; every
    chaos mood keeps a sea of cloud. Rejected: closing the gaps (Pinecrest's valley would be one white
    sheet and lose its lakes).

247. **A telegraph line leads down to Mirror Lake.** Between the First Drop and the lake the run was a
    groove with trees beside it. From the first leap's landing (its foot plus 140 m, at most 620 m before
    the lake) to the first lake's shore and 80 m on, a timber pole stands every 30 m, 15.5 m past the edge,
    on the side the valley falls away (`flankMode`), its two wires running crossarm to crossarm, in a cut
    through the trees 2.4 m wide. It skips tree runs, ravines, tunnels, streets, bridges, ledges and the set
    pieces' ground, and takes up again past them. From the lens its poles stand against the haze and its
    wires converge on the lake. A new large-kit piece (`L_POLE`, before the signature pieces), Medium and
    High; Low draws no dressing. Rejected: an avenue of tall trees (more forest); windows cut in the
    treeline (the bank's crest hides the valley from the lens, decision 117).

248. **The towns live.** *Chimney smoke*: a street's houses record their chimney tops as the piece is made
    (`Piece.chimneys`), about half their hearths lit (55%), and `Life` draws them in its existing smoke
    draw on Medium and High: eight puffs to a chimney, 1.7 times a cabin's size and rising slower, lit warm
    on the sun side and drifting with the wind; at most 22 chimneys at once, taken at a stride along the
    towns in view, re-placed when a town comes into view (`SetPieces.chimneyKey`). Sakura's townhouses
    have no chimney and send up none. *Lit signs*: a shop's sign board hangs on its awning's front edge,
    cream with its lettering's dark bar by day and lit from within from dusk (the pieces' night flag is
    the journey's dusk as well as the night moods), and its corner blade glows in its own colour; on Low a
    flat board over the window. *Cloth*: bunting, banners and lantern strings carry a weight per vertex
    (held at the masts, freest at a pennant's point and in a string's middle, a banner freest at its
    foot), and the set pieces' material swings them with the mood's wind in the vertex shader (0.36 m a
    breezy day, 0.22 at night, 0.6 where the snow blows); across the run they move at most a third of a
    metre, so nothing crosses the clearance. Rejected: the steam path for smoke (the wrong look, as
    decision 237 said); swinging cloth from the CPU or as its own instanced draw.

249. **Trees shed snow when passed close.** A forest tree in the near rows (a tree run's wall, the
    treeline, an orchard's first rows) with snow on its boughs, passed within 2.5 m of its trunk at
    18 m/s or more, lets the near miss's own sift fall (the same burst, placed by brush.ts on the side you
    passed, 15 grains, about two thirds of an ordinary near miss), once a tree and at most one every
    0.15 s, so scraping along a tree run's wall is a run of falls, not a stream. It reads the chunks'
    packed forest (`Props.treesNear`), so nothing is drawn or made. Snags, spires and basalt shed nothing;
    Frostfang sheds nothing. Low keeps it at its particle budget like every burst (about seven grains):
    the scan is a few dozen comparisons a frame and there is no draw. Rejected: none on Low (a tree run on
    Low would read as dead next to a near miss that sifts); a burst every frame while close (a stream).

## Cost

Measured on the production build in headless Chrome on the laptop's GPU at 1280x720 (`places-cost.js`,
the rider pinned at 30 m/s on the safe line, the median frame over 2 s; draw calls and triangles summed
over a frame's passes). Frame times were not taken (another process shared the machine, and Low's frame
rate is the main lane's measurement).

| Place | Tier | Draw calls before / after | Triangles before / after (k) |
| --- | --- | --- | --- |
| Ember, the Caldera Leap (2450 m) | high | 95 / 95 | 789 / 634 |
| Ember, the fork before it (1960 m) | high | 91 / 91 | 878 / 689 |
| Sakura, the Blossom Leap (2600 m) | high | 97 / 95 | 860 / 910 |
| Sakura, the Thousand Torii (1800 m) | high | 96 / 95 | 882 / 961 |
| Frostfang, the Ice Cavern (3330 m) | high | 89 / 90 | 813 / 836 |
| Pinecrest, Old Town (3540 m) | high | 88 / 89 | 1006 / 1028 |
| Pinecrest, the telegraph line (1400 m) | high | 88 / 90 | 918 / 859 |
| Ember, the Caldera Leap (2450 m) | medium | 80 / 81 | 561 / 454 |
| Ember, the fork before it (1960 m) | medium | 84 / 84 | 639 / 514 |
| Sakura, the Blossom Leap (2600 m) | medium | 92 / 91 | 641 / 649 |
| Sakura, the Thousand Torii (1800 m) | medium | 86 / 84 | 580 / 641 |
| Frostfang, the Ice Cavern (3330 m) | medium | 84 / 82 | 508 / 499 |
| Pinecrest, Old Town (3540 m) | medium | 84 / 83 | 760 / 734 |
| Pinecrest, the telegraph line (1400 m) | medium | 81 / 77 | 681 / 513 |
| Ember, the Caldera Leap (2450 m) | low | 37 / 38 | 92 / 72 |
| Ember, the fork before it (1960 m) | low | 41 / 41 | 141 / 118 |
| Sakura, the Blossom Leap (2600 m) | low | 47 / 46 | 113 / 119 |
| Sakura, the Thousand Torii (1800 m) | low | 43 / 43 | 130 / 130 |
| Frostfang, the Ice Cavern (3330 m) | low | 44 / 44 | 126 / 131 |
| Pinecrest, Old Town (3540 m) | low | 44 / 44 | 144 / 144 |
| Pinecrest, the telegraph line (1400 m) | low | 40 / 41 | 109 / 109 |

What moves the triangles: Ember plants fewer, bigger pieces (clear snow between), so its banks lost a fifth
of their triangles on every tier; Sakura plants more trees in its orchards than its scatter held (High
+50k at the Blossom Leap, +79k in the torii corridor, where the orchards on the banks above it are all in
view; on Low, with its rows thinned, +6k at the leap and none in the corridor); the cavern +23k on High
(its piece, below).
The medians wander by tens of thousands between runs with what is built and what is in the shadow pass at
that moment (Pinecrest at 1400 m on Medium reads 168k lower, which is not the telegraph line), so read
the Ember and Sakura rows for their direction and the set pieces' own counts below for their size.

Set pieces' own triangles (`places-plan.ts`, High / Low): the ice tunnel 17,960 / 17,960 to 26,920 / 23,380;
the torii corridor 23,324 / 16,220 to 24,476 / 17,372; streets +164 to +772 on High and +168 to +384 on Low
(signs); finishes +84 to +2,468 on High and +276 to +624 on Low (signs and, where it has them, the hotel's).
All within the setpieces test's budgets (Pinecrest's Low finish is the closest: 76,954 of 78,000).

New draw calls: none (the medians above move by one to four either way with what is in view). The chimney
smoke rides the existing smoke draw (its cap rose from 220 to 396
puffs), the telegraph line the large kit, the shed the particles, the signs and the cloth the pieces'
own meshes. The forest and kits' variant sets grew by one variant on Ember (set b holds three) and the
large kit by one piece on every mountain.

## ART.md text

**Section 4 (Snow), after "A near miss shakes what you shaved":**

- **Trees shed snow as you pass.** A forest tree by the run with snow on its boughs, passed within about
  2.5 m at speed, lets the same sift fall off its boughs as a near miss, about two thirds of it, once a
  tree. Snags, ice and basalt hold nothing to shed.

**Section 4, after "The frozen lake":**

- **The valley's lakes.** On Pinecrest's Clear Skies the white far below is the valley floor's snow and
  its openings are frozen lakes that hold still: a feathered shore of drifted snow, pale ice under the
  haze with tongues of blown snow across it, and a sheen toward the sun. Never flat blue shapes.

**Section 6, replacing the forest paragraph's first sentence:**

Each biome's decorative forest mixes variants (Pinecrest: classic, snow-laden, young pines and a dead
snag; Frostfang: spires, snapped spires, seracs, crystal mounds), with a small colour shift per tree and
the odd lean. Two mountains lay theirs out as places rather than scattering them. Ember Peak is basalt
country: each bank is a rhythm of formations (an organ-pipe outcrop of graded hexagonal columns on the
crest by the run and a bigger one on the shoulder, column clusters at their feet), stands of charred pines
in clumps with their dead at the edge, and clear snow between, with a steaming fissure in it now and then;
a sentinel column stands either side of every leap's approach. Sakura Ridge is orchards: rows of blossom
along the bank's contours, 5 m apart in a row and 5.5 m between rows, in blocks with paths across, a block
all pink or all pale, and between them a stand of dark pines or an open meadow; every leap lands between
orchards. On Pinecrest a line of timber telegraph poles runs from the first leap's landing down the valley
side to the first frozen lake, its wires leading the eye to it.

**Section 7, the journey table's Frostfang row:**

| Frostfang | 600 to 1450: the sun sinks onto the band, stars come out; 1700 to 2250: polar night, the aurora at full over the Crevasse Fields | 2700 to 3180: the deep of the night into the Ice Cavern, the aurora past its crest; 3300 to 3580: the sun comes up beside the Fang as you come out of the cavern, rose gold on the snow and the peaks, the aurora and the stars fading |

And in section 2's journey bullet: "Frostfang's sun sinks, the aurora comes and goes, and the dawn breaks
over the Fang".

**Section 12, Life (after "chimneys send up three-value gouache smoke lit warm on the sun side"):** "over
the cabins, the hamlets and a town's roofs".

**Section 12, Towns (after "Windows glow from dusk and warm light spills over the run's edge"):** "Shop
signs on the awnings light from dusk too, and the bunting, banners and lantern strings swing in the wind,
harder when the snow blows. About half the chimneys smoke."

**Section 12, Tunnels, replacing "an ice vault":** "an ice cavern: a cobalt crown hung with great
stalactites, shelves of ice fringed with icicles up its walls and crystals glowing at the foot of the ice,
opening at its far end onto the dawn".

**Section 12, Tunnels, replacing "a corridor of wine-lacquer torii":** "a corridor of wine-lacquer torii
whose posts stand on the lip of the cut, lit stone lanterns between them".

## README

Under "Round 6 play-test" (or wherever the round's world changes are listed), a short paragraph:

> **The world between places (world lane).** Ember's banks are basalt formations and burnt stands with
> clear snow between, on Low too; Sakura's blossom stands in orchard rows; the Ice Cavern has a vault and
> lit walls and opens onto a dawn on Frostfang's Clear Skies; Pinecrest's far lakes are frozen and a
> telegraph line leads down to Mirror Lake; towns smoke, light their signs and move their bunting; trees
> shed snow when passed close. No new draw calls; see `notes/r6-world.md` for the cost by tier.

## What the main lane must wire or decide

- Nothing is required to wire: `world.ts` carries two new lines (the town chimneys into `Life`) and the
  shed call, all inside the world lane's files.
- The Ice Cavern's set piece light `'dawn'` (moments.ts) now has a real sunrise to land on at the far
  mouth (about 3,440 to 3,580 m). If the main lane's dawn beat re-lights the frame, it should add to this
  light, not paint a second sunrise over it.
- The main lane's set piece builders that hang cloth can mark it with `sway()` (landmarkKit.ts) to have
  the wind take it; a piece merged with `mergePiece` handles the rest.
- `L_POLE` shifted `L_ROCKBAND`, `L_CORNICE` and `L_WALL` up by one: any new code that hard-codes those
  indices should import them.

## Frames

All under the lane worktree's `shots/r6w/` (gitignored), before (d8aae90) and after (this branch), the same
z on the same pinned ride (`places.js`, 30 m/s on the safe line, Clear Skies): `before/` and `after/`,
named `m<mountain>-mood0-z<metres>-<high|low|phone>.png` (desktop 1280x720 on High and on Low; the phone
390x844 on Medium). Contact sheets pairing them: `cmp-m2-low.png` (Ember on Low), `cmp-m3.png` and
`cmp-m3b.png` (Sakura), `cmp-tor.png` (the torii), `cmp-m1.png` and `cmp-cav.png` (the cavern and the
dawn), `cmp-lakes.png` and `cmp-wire.png` (Pinecrest), `cmp-town.png` and `cmp-smoke.png` (the towns),
`cmp-low-a.png` and `cmp-low-b.png` (Low), `cmp-phone-a.png` (the phone). The replayed best run down each
mountain on High (`lantern.js`, marquee frames), comparable with `shots/r6/before/desk-m*-mq-*.png` in
the main checkout, is in `replay/`. The shed: `after/shed-m0-*.png` (a Pinecrest tree run on High) and
`after/shed-m3-low-*.png` (Sakura on Low).
