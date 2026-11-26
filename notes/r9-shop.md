# Round 9, the shop lane: milestone 2's garage (G1 to G5)

The lane's notes, kept as it went and rewritten at the end. Frames: the main checkout's `shots/r9/shop/` (`sheet/` the
race-distance sheets and `sheet/full/` their whole frames; `keys/` which tile is which, never shown to a critic;
`critic/r1` to `r5` what each critic was given; `place/` the garage itself on a desk at High and Low and on a phone;
`glv/` the held run's GL calls; `economy/` the careers and tables). Dev server 4960; the round's base build (round-9 at
6255b8d, extracted) on 4961 for the before figures.

## 0. What a player now finds in the garage

The title's **Garage** door walks into a sled-maker's workshop at dusk, drawn by the game's own renderer: your rider
on your sled on a trestle stand in the middle of the floor, hats on wooden head blocks along the left wall, scarves
hung on a rail, the open door onto a snowy yard, and the **Lantern Row** strung in the rafters. The shelves are one
column at the reading edge on a desk and a sheet over the thumbs on a phone: **Sled, Hats, Scarves, Trails,
Finishes, Sounds**, a card for what is picked and a strip of tiles.

- **Everything goes on before it is bought.** Picking a tile puts the piece on your own rider and sled in the
  workshop at once. The camera goes to it: a hat from behind as on the run (pick it again and the rider turns to show
  its front), a scarf from behind, a finish low beside the sled, a trail with the rider out on the yard's loop, a
  sound played as it is picked. Closing puts back what you wear.
- **Each sled has a track.** Its card names its signature trick and how to do it, with **Watch**: the rider stands
  and does it on the stand. Below, the sled's five tiers (Runners, Deck, Crest, Stern post, Spirit inlay), each
  opened by riding that sled (the stage lines its runs cross: 3, 9, 18, 30 and 45) and then fitted for gifts. A
  track never changes how a sled rides. From the fourth tier the sled carries a post at the stern and an
  **ornament** on it (the lit Stern Lamp to start; the mountains' sets and the months' chapters give more).
- **Pieces that come from play** show on the shelves with where they come from: an Almanac page, a mountain's set
  (its scarf at a third of its mastery board, its trail at two thirds, its ornament when the board is full), a
  month's chapter (on sale in its month). The Whirl Saucer is never sold: it is the Almanac's.
- **Buying is a moment.** Buy arms, Confirm spends; a marigold gift drops on the rug, its lid flies, paper bursts, the
  piece goes on and the rider throws both arms up, with a sound of its own (a paper rustle and two bells a fifth
  apart). A tier is fitted the same way with a mallet and a bell. A tap or a key skips it; reduced motion puts the
  piece on with nothing moving.
- **The Lantern Row** button turns the camera up to the rafters and the card lists the towns, with Light One for each.
- Keyboard (the tabs are a tablist on the arrow keys), pad and touch reach everything; Escape or the pad's B closes it
  and focus returns to the door.

## 1. The pieces' second pass, and what the critics said

Made in the game's own render code, not the prototype, behind the round's model, so what a critic judged is what a
player gets: `meshes.ts` (hats, finishes, each sled's tiers, ornaments), `rider.ts` (scarf forms, ends, patterns, the
burn), `render/trailforms.ts` (new: `render/trails.ts` already holds the ruts). Milestone 0's six points, as built:

1. **No navy, no near-ink ground.** No finish is the coat's ink navy or any locked role's colour (a test holds every
   ground off the coat's navy). Midnight Stars is a warm night-black, Basalt Hex a mid slate under a fine cream lattice; the finishes' and ornaments' dark is a warm umber.
2. **The tiers take the finish.** A sled's tiers are merged into its geometry before the finish paints it, so a crest
   shows the sled's lacquer; the vermillion trim, the steel and the cream are kept. A motif is decided per quad (the
   two triangles it is cut into), so a ruled line is a line and a chequer does not alias into teeth.
3. **Trails stay in the air.** Nothing is laid on the snow (DECISIONS 392).
4. **What is a light glows.** The Stern Lamp is ribbed paper lit from inside on its own unlit material past 1, and it
   lights the snow behind (a local light on Medium and High; Low paints its pool). The Keeper's Lantern the same.
5. **Hats** told apart by outline from behind (below, and the critics).
6. **Scarf forms big enough to read.** The ribbon is three vertices across, so a pattern runs across it; four forms
   (two tails; one long and one short; four, now only the Midsummer Ribbons' since the Double Wrap's cut; one rope); ends that weigh the tips; the burn keeps the knit.

### The critics

Five rounds, each a fresh critic (`model: "opus"`, `effort: "xhigh"`) given only ART.md and the sheets, never told
what changed; the sheets are tiles cropped from the chase camera at race size, shuffled, keys hidden.

**Round 1** (the first pass): the powder spray washed the rider to milky glass in several tiles (fixed: the sheets now
wait for the spray to settle, and the main lane's own spray is untouched); hats 3/7 (Bobble Hem and Twin Pom both
cream blobs at ear level), the Long Knit Cap's tail pale glass, Pom Muffs no hat at all from behind, Down Cap a red
blob, Flop Peak a Santa hat; every pair of the plain scarves (Cream Bar, Long Streamer, Classic, Double Wrap, Snow
Tip) one scarf, Rope Braid coral, Pom Tails' ball a red ball flying off; burn: Classic and Double Wrap no pattern, the
flow rim magenta (not this lane's); finishes: two chequers one, honey and birch one, glacier ice-glass, the wine
lacquer a hazard's dark mass, plum near the Comet's violet; sleds: tier I told from stock only with effort, the
lantern beside the head marigold (the fuel's colour), the built-up kit the same on every sled; ornaments: six pairs,
marigold spent on five, the Sun Wheel a sawblade, the post putting every ornament beside the head.

**Round 2** (after the fixes): hats 4/9 (Chullo and Pom Beanie) and 6/10 (Down Cap and Watch Cap); Twin Tails a candy
cane, the Crest Knit a rooster's comb and The Twelve's topknot, the Pom Muffs' head brown; scarves 4/7, 4/9, 7/9,
7/8, 8/9 (the plain ones, again) and 2/3 (Ink Bands and Rope Braid); Cream Bar too much cream, Snow Tip broken-looking,
the fringe a dithered scribble; burn 2/3; finishes 2/9, 5/6, 1/3 (four of eleven dark slates), the pine on the mint
side, the glacier a ghost's glass; sleds 3/7 and 4/5, tier I's runner curls read as a cart's wheels; built-up sleds
all one cream-lantern kit, the crest boards' mauve stripes on three sleds, the Saucer's backrest a bucket, the Comet's
fin a crack down the rider's back.

What was done about round 2: **the Crest Knit is cut** (eleven hats); Down Cap full again with a cream ring; the
Chullo taller with long braids; the muffs' band covers the crown; Twin Tails all vermillion and streaming back; Pom
Tails' poms cream and big; the Long Streamer slim and twice the length; Rope Braid in two reds; Cream Bar's bars two
rows each; the fringe's strands broader; four finishes moved off the slates (forest pine, steel-blue glacier, walnut
scroll, one Racing Stripe); tier I's runner tails sweep up into tall handles; the crest boards one wood; the
Saucer's backrest a low arc; the Comet's fin two low fins at its corners. And a bug found by looking again at round
2's frames: **the Double Wrap's second pair had never been drawn where it was meant to be** (three put its matrix back
over the first pair every frame), which is why it was one of the plain scarves to both critics.

**Round 3** (after round 2's fixes; the first with the found pieces, the ornaments and the trails, and a second critic
naming four outfits from whole chase frames). Pairs it could not tell apart at a glance, by name (the keys decoded):

- Hats: Bobble Hem and Watch Cap (the cream bobbles merged with the hood's fur), Pom Beanie and Twin Pom (both striped
  crowns). The Flop Peak a rigid traffic cone; the Long Knit Cap a Santa hat; the Chullo's braids read as a scarf tail.
- Shop scarves: Ink Bands and Chunky Rib; Rope Braid with Double Wrap and with the Fringe Knit; Double Wrap and Fringe
  Knit (plain broad tails); Long Streamer and Snow Tip. The fringe a stipple of dark pixels, Snow Tip's tip a grey
  wash, the Almanac Knot a backpack, patterns running into the wrap by the knot. (The Double Wrap's second pair, drawn
  at last, was seen: "tails flung out to both sides".)
- Found scarves: four "red with cream marks" (Petal Hem, Fir Chevron, Blossom Knit, Lamp Road: four pairs), three "dark
  blotches" (Crescent Knit, Fang Edge, Hollow Stitch: three pairs), three plain (Icicle Fringe, Folded Fan, Drip Hem:
  three pairs); across the sheets Cream Bar against Fir Chevron, Blossom Knit and Lamp Road, Ink Bands against Ash
  Market, Snow Tip against Market Tassels. Three tiles were shot mid-trick and could not be judged.
- Burn: Classic and Double Wrap one gradient; Ink Bands' pattern faint, Cream Bar's down to one bar.
- Finishes: Basalt Hex and Almanac Pages; Racing Stripe and Midnight Stars. The chequer is the finish line's own paint
  and its ink sampled as the coat's navy.
- Sleds: tier I not told from the stock sled (the handles read as the runners' own curls); the crest board a flat
  mauve slab; the burning inlay marigold. Every stock and built-up sled told apart except the Comet Bob's (with
  effort); built-up Lodge Toboggan and Pine Flyer one sled.
- Ornaments: Sun Disc and Sun Wheel, Lantern String and Lantern Star (both too small to see), Stern Lamp and Hollow
  Lantern; the Basalt Pipes a hazard's silhouette, the ice pieces the hazards' faceted ice, the Hollow Lantern a ghost's
  face, the sprig's black branch a crack.
- Shop trails: Fresh Powder and Lamp Moths (the moths too small), Banked Embers and Gold Leaf; the Keeper's Lantern a
  plain cylinder with a black top on a black line, the kite strings dark lines down the fall line, Paper Streamers flat
  planks at the lens.
- Found trails: Drip Lights, Icicle Chimes, Paper Cranes and Sun Motes too small to see (six pairs); Stag Lights and
  Dawn Fans; Lava Drops and Ember Tongues; Ember Tongues and Market Ribbons; Sky Lanterns flat mustard polygons;
  Snowballs and Hollow Lights soft discs at the lens.
- Not this lane's, again: the flow rim pink-magenta; the Wisp's stock mint (the ghosts' colour); the Saucer's blue near
  the speed charm's azure; the Lodge Toboggan's stock shows no vermillion from behind.

**The second critic, naming outfits** from whole chase frames: hats named or described rightly in four of four
(the Trapper and the Pom Muffs' ear pieces high; the Down Cap's rolled tiers described, named the Watch Cap; the Flop
Peak described as a tall cone and named a chullo); scarves in three of four (Ink Bands and the Double Wrap's tails to
both sides; the Night Veil's thin tails with pale tips; the Pom Tails seen only as cream balls by the runner); the
sled's added parts on the two built-up sleds (a tall seat back and a lantern on a post) but not the two-tier one;
trails in four of four (Kite Tails as bunting, Comet Tail's two ribbons, Paper Snow's sparkles; Lantern Sparks as
coins). Easiest to confuse: the Down Cap rider with the Trapper rider (a red dome over a cream band, a plain sled in a
cool paint, gold specks).

What was done about round 3, worst first: ink bobbles on the Bobble Hem; a plain crown and bigger poms on the Twin Pom;
the Flop Peak flopped to one side with a cream pom and band; the Long Knit Cap straight down the back; the Chullo's
braids behind the ears (before the round's frames, from my own look at them); Chunky Rib ribbed in its own deep red
and broader; a cream strand in the Rope Braid; four broad strands in the fringe; Snow Tip's cream higher up; no pattern
in the wrap; a warm umber for every finish's and ornament's dark; **the chequer and Racing Stripe cut** (the Snowfield
id is now snow-white slats in a dark walnut frame); Basalt Hex's lattice finer and Almanac Pages a parchment tan; tier
I's handles in the sled's wood, cream-tipped; the crest boards' grain back, subtly; the inlay burns vermillion-orange;
the ice ornaments smooth cream, the pipes warm stone, the Sun Wheel a wooden wheel, the Hollow Lantern plum paper with
no face, the sprig a mid brown, the two small lantern ornaments half as big again; kite and keeper lines cream, the
keeper's lantern ribbed; the moths twice the size; five found trails more and bigger; Banked Embers round rising
drops; Ember Tongues rising; the discs at the lens smaller.

**Round 4** (after round 3's fixes, fresh critics again):

- Hats: one pair left, the Braided Chullo and the Long Knit Cap (its tail, sent straight down the back, read as a cone
  from behind). The ink bobbles read as curly hair; the Flop Peak now reads as what it is ("a tall stocking cap
  flopping left, pom at the tip").
- Shop scarves: Long Streamer with the Fringe Knit and with the Almanac Knot (an ink tip on a thin tail), Classic Knit
  and Double Wrap. Pom Tails' pom reads as a snowball on the deck; Snow Tip's cream still fades to grey-lilac in shade.
- Found scarves: the chapters' plain group (Midsummer Ribbons, Ember Knit, Drip Hem, Market Tassels: six pairs),
  Folded Fan and Fang Edge, Crescent Knit and Fang Edge, Petal Hem and Blossom Knit, Fir Chevron and Sunrise Bars;
  three tiles mid-flip again; across the sheets Sunrise Bars against Cream Bar, Ash Market against Ink Bands, Icicle
  Fringe against Snow Tip.
- Burn: Ink Bands, Classic and Double Wrap one gradient; only Cream Bar keeps a bar.
- Finishes: Basalt Hex, Midnight Stars and Gilt Scroll one grey sled with a dark bow (three pairs); Plum and Almanac
  Pages two pale washes.
- Sleds: tier I still not told from the stock sled (four thin pale posts); tiers IV and V told apart only by the
  inlay; tier II's pad hidden under the rider. **Every stock and built-up sled told apart** (six of six, the Comet
  Bob's by its lantern), and the built-up sleds told from each other by their bases.
- Ornaments: the Thaw Lantern, the Lantern String and the Stern Lamp three cream glows (three pairs); the brazier the
  clock's amber.
- Shop trails: Fresh Powder and Lantern Sparks (too few sparks to see). Found trails: Drip Lights and Icicle Chimes
  (both too small), Ember Tongues and Market Ribbons (shards); Hollow Lights coral. Across the sheets: Lava Drops,
  Moon Slivers and Ember Tongues against Banked Embers, Paper Streamers and Gold Leaf.
- The outfit critic (fresh): hats rightly described four of four (the Flop Peak "a tall stocking cap that hooks over
  to the left with a cream pom", the Down Cap's stacked rolls, the Trapper, the Pom Muffs' puffs over each ear);
  scarves three of four (Ink Bands; the Double Wrap's tails flung to both sides "like wings"; the Night Veil's two
  narrow tails, its lamps unseen; the Pom Tails' poms taken for something on the sled); **the sled's added parts
  seen on all three built-up sleds** (push posts, a lantern on a post, striped posts) and nothing on the stock one;
  trails four of four (Kite Tails as gold bunting, Comet Tail's two ribbons, Paper Snow's stars, Lantern Sparks as
  gold motes). Easiest to confuse, again: the Down Cap rider and the Trapper rider.

What was done about round 4 (not judged again: see below): **the Double Wrap is cut**; the Long Streamer plain to its
tip; Ash Market ink-dipped flame tips under a cream band; the Long Knit Cap back past one shoulder (round 3 told it
from every hat that way); Gilt Scroll on oxblood, Basalt Hex a lighter slate, Plum deeper, the Almanac's parchment
darker with bolder rules; tier I's handles joined by a cream push bar, tier II's pad wider than the hips, the inlay
broader; the Thaw Lantern tall in thaw-blue paper, the Lantern String a garland of five across the stern, the brazier
cream-gold; Lantern Sparks doubled; Drip Lights and Icicle Chimes bigger; Market Ribbons cream bows fluttering; Hollow
Lights' edge cream.

TODO-R5

## 2. The model (src/game)

- `garage.ts`: every shelf's pieces with their source (free, shop, an Almanac page, a mountain's set, a month's
  chapter) and their looks: 11 hats, 28 scarves (9 shop and free, 2 Almanac, 5 sets, 12 chapters), 29 trails (9 and
  free, 3, 5, 12), 18 ornaments (the lamp, 5 sets, 12 chapters), the audio lane's 5 sounds; `SETS`, `onSale`,
  `sourceLine`, `setPiecesFor`, `chapterPieces`. `paints.ts`: the finishes (10 on the shelf; round 8's twelve chapter
  paints kept for a save that holds one). `tracks.ts` (new): the sleds' garage prices and signatures, the tiers, the
  lines, `creditLines`, `fitTier`, `giveTiers`, `tierState`.
- **Lines credited after the run** (`app.ts settleShop`, after mastery in the results' settle): the stage lines the
  run crossed (0 to 3) go to the sled it rode, once a run (a revive's second settle credits only what is new). Nothing
  of the garage reaches `src/sim` or `src/bot` (`tests/garage.test.ts`, `tests/shop.test.ts`).
- **Sets**: a mountain's mastery board past a third, two thirds and all of its stars puts its scarf, trail and
  ornament in the save (`d.sets` keeps how many), on the run that crosses it and, for a board filled before round 9,
  when the garage opens (`syncSets`). The results turn the piece over with the pages' rewards (`RewardCard.from`:
  "Pinecrest's set").
- **No Almanac page empty or silent** (`rank.ts grant`): page 5's sled on a save that bought the Saucer fits its
  runners and deck ("Your Whirl Saucer: its runners and deck fitted"; if those were fitted already, their price
  back); a chapter piece bought before its page pays its price back ("You had the Star Knit: 260 gifts back"). A
  revive's second settle takes either back first (`SpineSettlement.tiers`).
- **The Whirl Saucer** is never sold (`SLED_SHOP[1].from = 'almanac'`); the shop no longer reads `sim/sleds.ts`'s prices.
- **The next unlock** (`progress.ts nextUnlock`) names the next sled the shop sells with its price and a piece,
  `'sled:3'`, which `onOpenSleds(piece)` opens the garage at.
- **Migration**: ids never change (a reworked piece keeps its id: `bobbles` is the Bobble Hem, `stardust` Paper Snow,
  `glints` Gold Leaf, `cocoa` Burnt Scroll, `snow` Snowfield Frame, `ash` Basalt Hex,
  `almanacdusk` Almanac Pages); round 8's chapter paints stay wearable; the new save fields are optional and
  sanitised; an old save loads whole (`tests/shop.test.ts` "the garage on an old save"). A save that held a cut piece
  (the Crest Knit, the Double Wrap, Racing Stripe) cannot exist: each was new this round.

## 3. The looks in render, and what they cost on Low

- `meshes.ts`: the hats (`playerHat`), each sled's five tiers (`sledTrackParts`), the post and its ornaments
  (`ornamentParts`, `POST_TOP`), the finish painted over sled and tiers (`finishSled`), `sledWithTrack`. Every part has
  a `lite` build (fewer sides and steps) for Low and the phone.
- `rider.ts`: the scarf ribbon three vertices across; forms (`long`, `one`, and `four` as a second mirrored draw of the
  same mesh, only while worn); ends (pom, ball, lamp, drop, point, flame, tassel) and the fringe and the bow written in
  the same mesh round the tip's and the knot's frames; patterns across the knit (`knitAt`); the burn keeps each
  stitch's value; the sled's glow (lamp paper) and inlay as their own two meshes; `setFinish`, `setTracks`.
- `render/trailforms.ts` (new): flakes (one instanced mesh), ribbons, kite strings, moths, the keeper's lantern; Low
  draws fewer (section 7).
- `world.ts`: `setTrail` sets the spray and the form, the form fed each frame, the keeper's and the post's lamp as
  local lights, the movers adopted by the after-pass; `drawPlace` and `restoreLight` for the place.

**A held run's GL calls on Low, before and after** (round 8's way: `scripts/playtest/r9-shop-glv.sh`, every WebGL call
counted over the same frames of an autoridden Pinecrest run, z 230 to 1,230, about 2,610 frames, a fresh save; the
round's base build, round-9 at 6255b8d, served from an extract on 4961; this lane's on 4960; two passes of each
interleaved; frames to `shots/r9/shop/glv/`):

| Build and look | GL calls a frame | Draw calls | Uniform calls | Uniform floats |
| --- | --- | --- | --- | --- |
| Base, stock rider (two passes) | 449.3, 447.0 | 44.6, 44.4 | 213.4, 211.6 | 2,148, 2,130 |
| This lane, stock rider (two passes) | 447.4, 446.5 | 44.3, 44.3 | 211.6, 211.3 | 2,127, 2,126 |
| Pom Tails, four tiers and the lamp, Paper Snow | 454.4 (+7) | 45.4 | 213.7 | 2,162 |
| Almanac Knot, three tiers, Comet Tail | 461.3 (+14) | 46.2 | 213.5 | 2,159 |
| Double Wrap, Flop Peak, Snowfield, all five tiers and the lamp, Kite Tails | 468.8 (+21, +4.7%) | 47.4 | 219.9 | 2,252 |

A stock rider costs what it did (the scarf's three-across ribbon, its ends and patterns are the same one draw). What a
dressed rider adds is by design and bounded: the lamp's paper and the inlay are one draw each, a trail's form one or
two (instanced flakes; ribbons; kite bows and their lines), and a four-tailed scarf one more (the Midsummer Ribbons, since
the Double Wrap's cut). The worst dressing measured is 21 calls a frame on Low, under 5%. (The dressed run was measured before the
Double Wrap's cut, with the Snowfield finish's chequer since changed to a frame; neither changes a draw.)

## 4. The place (G1)

`src/render/garagescene.ts` (from milestone 0's prototype scene, made the game's: its own Rider, the game's sleds,
hats, tiers and trail forms, the game's toon material and local lights) is imported by `app.ts openGarage` when the
garage opens. Nothing of it is in the first download: a production build puts the scene in its own 16.5 kB chunk
(6.6 kB gzipped) and the UI in 10.9 kB of script and 7.1 kB of CSS (3.6 and 1.8 kB); the first download grows by 25
kB gzipped against the round's base (1,104 kB against 1,079), the pieces' looks a run draws (hats, tiers, ornaments,
scarf forms, trail forms). It is drawn by the world's renderer through `post.ts renderPlain` (the scene target, the bloom, the grade, the composite's edge walk; none of the run's passes) while the
title's world waits unframed; disposed on close, the world's light, hour and look put back (`world.restoreLight`,
`applyLook`). `src/ui/garage.ts` (with `garage.css` and `garageview.ts`, in the round's tokens) is loaded with it,
mounted by `menus.ts showGarage` in a layer of its own; everything else in the UI steps out while it is open (the round
6 sheet stays for the dev harness).

- **The camera follows what you browse** and swings round the stand between shots. The subject keeps left of the
  column on a desk and above the sheet on a phone (the projection's centre is moved, `setViewOffset`).
- **Low and the phone** get the designed cheaper place: one shelf of six hats, no shadows from the props, fewer
  confetti, the lite sleds, tiers and hats, the trail's Low forms.
- **Reduced motion**: shots cut instead of swinging, Watch holds the trick's pose, the moment puts the piece on and
  cheers with nothing moving.

**What the place costs to open** (`app.ts garageCost`, read by `scripts/playtest/r9-shop-place.js` after the title's
Garage door is pressed from the keyboard on the mid-50 fixture, a warmed browser, the dev server; the frame counts are
`renderer.info` summed over every pass of one frame, the first and the fortieth; the heap is the whole page's):

| Tier | Open to first frame | Import / build / first frame | Draw calls first, settled | Triangles | Geometries, textures, programs | JS heap (page) |
| --- | --- | --- | --- | --- | --- | --- |
| Desk, High (1280x720) | 133 to 206 ms | 20 to 70 / 60 to 79 / 36 ms | 43, 34 to 36 | 73,000 to 74,000 | 119 to 121, 33 to 34, 104 to 105 | 179 to 247 MB |
| Desk, Low | 139 to 154 ms | 16 to 40 / 55 to 59 / 38 to 42 ms | 23, 16 | 23,300 to 24,300 | 87, 8, 82 | 137 to 205 MB |
| Phone (390x844, DPR 2, Medium) | 139 to 160 ms | 17 to 23 / 70 to 79 / 33 to 38 ms | 38, 34 | 73,300 to 73,800 | 104, 23, 93 | 238 to 254 MB |

Ranges are the passes of 26 November (two to three a tier). The import is the dev server's module fetch; in a
production build the scene is one 16.5 kB chunk (6.6 kB gzipped) and the UI 10.9 kB plus 7.1 kB of CSS. Low's cheaper
scene is a third of High's triangles and half its draws. Closing puts the title back with the console clean on every
pass, and focus on the Garage door (checked by script on Low, the phone and reduced motion; one High pass lost the door
to a redraw before it could be focused, and the script now waits for it).

## 5. The moment (G4)

`garagescene.ts buyMoment`: a marigold gift (the gifts' own colour, ART.md 13) drops on the rug with a squash, its lid
lifts and flies, paper and cream confetti burst, the piece goes on, the rider throws both arms up, the camera goes to
the piece. About two seconds. A tap or any key skips to its end (`app.ts skipHook`, window capture); reduced motion
puts it on at once. Its sound is the audio engine's own, procedural (`sfx.ts` `gift-open`: a paper sweep of filtered
noise, two FM bells a fifth apart and a shimmer; `tier-fit`: two mallet knocks and a bell). A tier landing is the same
moment with the sled lifted on its cradles and the tier's line ("Your Pine Flyer: crest fitted").

The results' "Ready in the shop": `onOpenSleds(piece?: string)` opens the garage at that piece ('sled:3' is the Comet
Bob on the Sled shelf; 'hat:muffs' a hat), and `nextUnlock` now gives the piece and its price.

## 6. The economy (G5)

The careers were ridden in the heavy slot on this lane's build (`r9-garage-economy.ts --ride`: mid 35.1 s, novice 35.7
s) and spent by `--econ shop` with milestone 0's player's rule over the catalogue the game ships
(`scripts/playtest/r9-shop-catalogue.ts`, `r9-shop-econ.ts`), last on 26 November after the cuts (the Crest Knit, the Double Wrap, Racing Stripe). Full output:
`shots/r9/shop/economy/tables.txt`. Lifetime gifts are the build's own and equal milestone 0's (the garage changes no
income).

Sinks: sleds 3,250 (four to buy), tracks 9,930, hats 3,690, scarves 2,190, trails 2,760, finishes 2,130, sounds 660:
the base shop 14,680 plus the tracks; the months' chapters 11,520 (960 a month); the Lantern Row 16,500.

| Run | Mid: earned | Mid: owns | Mid: goals left that are not lanterns | Novice: earned | Novice: owns | Novice: goals left |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 140 | the Pine Flyer's runners | 64 (16,910 gifts) | 80 | the Pine Flyer's runners | 64 (16,910) |
| 5 | 805 | 2 tiers, a hat, a scarf, a trail, a finish, a sound, the Lodge Toboggan | 63 (17,670) | 670 | 2 tiers, a hat, a scarf, a trail, a finish, a sound, the Lodge Toboggan | 63 (17,670) |
| 20 | 4,655 | 7 tiers, 2 sleds, 5 hats, 4 scarves, 4 trails, 4 finishes, 3 sounds, the month's chapter set, 4 set pieces | 40 (14,270) | 2,895 | 6 tiers, 2 sleds, 2 hats, 2 scarves, 2 trails, a finish, a sound, the month's chapter set | 57 (16,340) |
| 50 | 9,530 | 14 tiers, 3 sleds, 7 hats, 5 scarves, 4 trails, 4 finishes, 4 sounds, the chapter set, 8 set pieces | 30 (11,720) | 5,520 | 10 tiers, 2 sleds, 4 hats, 4 scarves, 3 trails, 3 finishes, 2 sounds, the chapter set, a set piece | 45 (13,860) |
| 100 | 16,595 | 23 tiers, 5 sleds (the Tea Tray), 8 hats, 6 scarves, 6 trails, 5 finishes, 4 sounds, the chapter set, 11 set pieces | 22 (8,790) | 10,805 | 19 tiers, 4 sleds (the Wisp), 6 hats, 5 scarves, 5 trails, 3 finishes, 3 sounds, the chapter set, a set piece | 42 (12,800) |

- **Something worth having within one to three runs after every run:** 100 of 100 for both pilots (runs with nothing
  but a lantern in reach: 0 and 0; milestone 0's today, the base garage bought first: 70 of the mid pilot's runs and
  38 of the novice's).
- **Garage goals at runs 50 and 100 that are not lanterns:** mid 30 and 22, novice 45 and 42 (tiers, sets and sleds
  among them).
- **The dearest pieces, a dedicated player's weeks:** at the harness's four runs a day the mid pilot finishes the
  Lodge Toboggan's track at run 27 (day 7), the Comet Bob's at 48 (day 12), the Wisp's at 69 (day 18), and is fitting
  the Tea Tray's fifth at run 100 (day 25); the novice the Pine Flyer's at 17, the Lodge's at 43, the Comet's at 76.
  None of it waits on a clock.
- What is approximate: the harness's pilots never improve, nobody revives or doubles, and the player's rule is a
  script's (fit the ridden sled's next tier, then the next sled, then the shelves in turn), not a person's taste.

## 7. Every piece

What each piece is at race distance (its line on the card, written to be what the chase lens shows), its price or
where it is found, and what Low and the phone draw. `npx tsx scripts/playtest/r9-shop-list.ts` prints these tables
from the game's own catalogue.

**Hats** (11)

| Piece | What it is | Price or where | Low and phone |
| --- | --- | --- | --- |
| Pom Beanie | A round crown and one big cream pom on top | free | the same outline, fewer facets |
| Watch Cap | Low and flat-topped, a thick rolled cuff, nothing on top | 80 gifts | the same outline, fewer facets |
| Twin Pom | A plain red crown and two big cream poms hung low over the ears | 110 gifts | the same outline, fewer facets |
| Trapper | Broad, a cream fur band and two long flaps to the scarf | 150 gifts | the same outline, fewer facets |
| Bobble Hem | A hem of ink bobbles hanging round the back of the cuff | 200 gifts | the same outline, fewer facets |
| Braided Chullo | A short point and two long cream-and-red braids hanging behind the ears | 260 gifts | the same outline, fewer facets |
| Long Knit Cap | A long tail streaming back past one shoulder, a pom at its end | 320 gifts | the same outline, fewer facets |
| Pom Muffs | A broad knit band over the crown and two big fur muffs | 440 gifts | the same outline, fewer facets |
| Down Cap | A big puffed dome in fat quilted rings, a real brim | 580 gifts | the same outline, fewer facets |
| Twin Tails | Two long knit tails streaming back off the crown, poms at their ends | 700 gifts | the same outline, fewer facets |
| Flop Peak | A tall felt peak flopped over to one side, a cream pom at its tip | 850 gifts | the same outline, fewer facets |

**Scarves** (28)

| Piece | What it is | Price or where | Low and phone |
| --- | --- | --- | --- |
| Classic Knit | Two tails, two deeper stripes near the tips | free | the same (one draw) |
| Cream Bar | Two cream bars across each tail, one mid-tail and one by the tip | 80 gifts | the same (one draw) |
| Chunky Rib | Short and twice as broad, a deep rib across it | 110 gifts | the same (one draw) |
| Fringe Knit | A long ink fringe at each tip, four broad strands | 150 gifts | the same (one draw) |
| Ink Bands | Broad ink bands all down its length | 190 gifts | the same (one draw) |
| Snow Tip | The last third of each tail dipped in cream, a cream tassel | 240 gifts | the same (one draw) |
| Long Streamer | One slim plain tail twice as long as any other | 300 gifts | the same (one draw) |
| Pom Tails | Each tail swung low by a big cream pom | 480 gifts | the same (one draw) |
| Rope Braid | One thick rope braided with a cream strand, a cream tassel | 640 gifts | the same (one draw) |
| Almanac Knot | A big bow at the throat, two short ink-tipped tails | Found on Almanac page 17 | the same (one draw) |
| Night Veil | Long fine tails, each weighted by a little paper lamp | Found on Almanac page 42 | the same (one draw) |
| Fir Chevron | Cream chevrons down each tail like fir boughs | Pinecrest's set: a third of its mastery board | the same (one draw) |
| Fang Edge | Tails cut to a fang at the tip, ink teeth along it | Frostfang's set: a third of its mastery board | the same (one draw) |
| Ash Market | Ink-dipped, flame-cut tips under a cream band | Ember Peak's set: a third of its mastery board | the same (one draw) |
| Petal Hem | Cream petals down both edges | Sakura Ridge's set: a third of its mastery board | the same (one draw) |
| Lamp Road | One long streamer barred in cream like a row of lamps | Lanternfall's set: a third of its mastery board | the same (one draw) |
| Sunrise Bars | Cream bars widening toward the tips like rays | First Light's chapter (260 gifts in its month) | the same (one draw) |
| Icicle Fringe | A fringe of stiff cream points | The Long Frost's chapter (260 gifts in its month) | the same (one draw) |
| Drip Hem | Tails that end in round drops | Thaw Lanterns' chapter (260 gifts in its month) | the same (one draw) |
| Blossom Knit | Cream blossoms knitted down the middle | Blossom Run's chapter (260 gifts in its month) | the same (one draw) |
| Ember Knit | Ink-dipped tips under a cream flame band | Ash and Ember's chapter (260 gifts in its month) | the same (one draw) |
| Midsummer Ribbons | Four slim ribbons | Midsummer Snow's chapter (260 gifts in its month) | the same (two draws) |
| Market Tassels | Short tails ending in heavy cream tassels | Night Market's chapter (260 gifts in its month) | the same (one draw) |
| Folded Fan | Pleated in folds that open as they stream | Paper Cranes' chapter (260 gifts in its month) | the same (one draw) |
| Crescent Knit | Ink crescents down the tails | Harvest Moon's chapter (260 gifts in its month) | the same (one draw) |
| Hollow Stitch | Open-work holes knitted through it | The Haunting's chapter (260 gifts in its month) | the same (one draw) |
| Snowball Tails | Each tail ending in a round cream snowball | First Snow's chapter (260 gifts in its month) | the same (one draw) |
| Star Knit | Cream stars knitted down the tails | Lantern Night's chapter (260 gifts in its month) | the same (one draw) |

**Trails** (29)

| Piece | What it is | Price or where | Low and phone |
| --- | --- | --- | --- |
| Fresh Powder | Snow, and only snow | free | the same |
| Honey Plume | A rooster tail of big honey billows, twice as tall | 80 gifts | the same plume |
| Lantern Sparks | Marigold sparks flicked off the runners | 130 gifts | the same |
| Gold Leaf | Flakes of gold leaf that spiral up behind and flash | 180 gifts | 80 flakes in the air, not 220, thrown at half the rate |
| Paper Snow | Cut-paper snowflakes that flutter and turn as they fall | 250 gifts | 80 flakes in the air, not 220, thrown at half the rate |
| Comet Tail | Two ribbons of light that rise off the runners and bend with the carve | 340 gifts | ribbons of 24 segments, not 44 |
| Petal Drift | Cream and gold petals that spin flat and sail out sideways | 450 gifts | 80 flakes in the air, not 220, thrown at half the rate |
| Paper Streamers | Strips of festival paper that tear off the stern and flap behind | 580 gifts | 80 flakes in the air, not 220, thrown at half the rate |
| Kite Tails | Two strings of paper bows flying high off the stern | 750 gifts | 7 shapes a string, not 11 |
| Lamp Moths | Three soft lights that loop round you and follow | Found on Almanac page 28 | the same three lights |
| Banked Embers | Embers that lift off the runners in a glowing column | Found on Almanac page 46 | 80 flakes in the air, not 220, thrown at half the rate |
| Keeper's Lantern | A paper lantern riding behind on a line | Found on Almanac page 50 | an 8-sided lantern, not 12; its light painted on the snow |
| Stag Lights | Little lights that bound alongside in arcs, the White Stag's | Pinecrest's set: two thirds of its mastery board | 80 flakes in the air, not 220, thrown at half the rate |
| Frost Feathers | Fronds of cream-gold frost that drift up and melt | Frostfang's set: two thirds of its mastery board | 80 flakes in the air, not 220, thrown at half the rate |
| Lava Drops | Glowing drops that arc off the runners | Ember Peak's set: two thirds of its mastery board | 80 flakes in the air, not 220, thrown at half the rate |
| Paper Cranes | Folded cranes that climb off the wake in pairs | Sakura Ridge's set: two thirds of its mastery board | 80 flakes in the air, not 220, thrown at half the rate |
| Sky Lanterns | Little paper lanterns that lift off the stern and rise | Lanternfall's set: two thirds of its mastery board | 80 flakes in the air, not 220, thrown at half the rate |
| Dawn Fans | Fans of light flicked off each carve | First Light's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Icicle Chimes | Icicles that drop off the runners and burst | The Long Frost's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Drip Lights | Drops of light falling from the stern | Thaw Lanterns' chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Blossom Pops | Cream blossoms that pop out and drift | Blossom Run's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Ember Tongues | Flame-shaped tongues licking up off the runners | Ash and Ember's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Sun Motes | Rayed suns that roll beside you and fade | Midsummer Snow's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Market Ribbons | Cream paper bows that tumble off | Night Market's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Folded Fans | Paper fans that flutter as they fall | Paper Cranes' chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Moon Slivers | Thin crescents of light tumbling end over end | Harvest Moon's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Hollow Lights | Round paper lanterns with cut eyes that bob and wink out | The Haunting's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Snowballs | Little snowballs that roll off the runners and burst | First Snow's chapter (380 gifts in its month) | 80 flakes in the air, not 220, thrown at half the rate |
| Star Strings | Strings of paper stars fluttering off the stern | Lantern Night's chapter (380 gifts in its month) | 7 shapes a string, not 11 |

**Finishes** (10)

| Piece | What it is | Price or where | Low and phone |
| --- | --- | --- | --- |
| Natural | Oiled wood: two browns and the grain | free | the same motif on Low's three-slat sled |
| Pine Lacquer | Forest green lacquer, a cream pinstripe round the edge | 80 gifts | the same motif on Low's three-slat sled |
| Glacier Enamel | Steel-blue enamel, an ink pinstripe round the edge | 110 gifts | the same motif on Low's three-slat sled |
| Midnight Stars | A warm night-black, cream stars across the tail | 150 gifts | the same motif on Low's three-slat sled |
| Plum Two-Tone | Deep plum slats in a cream frame | 200 gifts | the same motif on Low's three-slat sled |
| Burnt Scroll | Walnut stain with scrolls burnt into the slats' ends | 250 gifts | the same motif on Low's three-slat sled |
| Snowfield Frame | Snow-white slats in a dark walnut frame | 310 gifts | the same motif on Low's three-slat sled |
| Basalt Hex | Dark slate under a fine cream hex lattice | 380 gifts | the same motif on Low's three-slat sled |
| Gilt Scroll | Oxblood lacquer, cream scrollwork along the rails | 650 gifts | the same motif on Low's three-slat sled |
| Almanac Pages | A parchment deck ruled in ink like a page of the Almanac | Found on Almanac page 38 | the same motif on Low's three-slat sled |

**Sounds** (5)

| Piece | What it is | Price or where | Low and phone |
| --- | --- | --- | --- |
| Steel Runners | The hiss of steel on packed snow | free | the same |
| Sleigh Bells | A string of bells that ring with every turn | 140 gifts | the same |
| Old Timber | Creaking boards and a wooden knock on every landing | 120 gifts | the same |
| Glass Chime | Runners that sing like a rubbed glass | 180 gifts | the same |
| Lantern Song | A warm hum that brightens as the lantern fills | 220 gifts | the same |

**Ornaments** (18)

| Piece | What it is | Price or where | Low and phone |
| --- | --- | --- | --- |
| Stern Lamp | A cream paper lamp with an ink cap, lit | free | fewer facets; a lit one paints its light on the snow |
| Cowbell | A big cream-and-ink bell that swings | Pinecrest's set: all of its mastery board | fewer facets; a lit one paints its light on the snow |
| Ice Fang | A curved cream tooth of frost, a glint at its tip | Frostfang's set: all of its mastery board | fewer facets; a lit one paints its light on the snow |
| Basalt Pipes | Three warm stone columns with a lit seam | Ember Peak's set: all of its mastery board | fewer facets; a lit one paints its light on the snow |
| Paper Crane | A folded cream crane, its wings lifting | Sakura Ridge's set: all of its mastery board | fewer facets; a lit one paints its light on the snow |
| Great Lantern | A storeyed lantern of lit paper, the finale's own | Lanternfall's set: all of its mastery board | fewer facets; a lit one paints its light on the snow |
| Sun Disc | A rayed cream disc | First Light's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Icicle Crown | A ring of hanging icicles | The Long Frost's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Thaw Lantern | A tall lantern of thaw-blue paper, icicles dripping from its foot | Thaw Lanterns' chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Blossom Sprig | A sprig of three cream blossoms | Blossom Run's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Brazier | A small iron brazier with a lit bed | Ash and Ember's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Sun Wheel | A wooden wheel of six spokes round a cream hub | Midsummer Snow's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Lantern String | Five little lanterns on a string swagged across the stern | Night Market's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Paper Fan | An open paper fan | Paper Cranes' chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Crescent Moon | A cream crescent, horns up | Harvest Moon's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Hollow Lantern | A round lantern of plum paper, lit | The Haunting's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Snow Pair | Two stacked snowballs with a stick arm | First Snow's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |
| Lantern Star | A cut-paper star lantern, lit | Lantern Night's chapter (320 gifts in its month) | fewer facets; a lit one paints its light on the snow |

**Sleds and their tracks**

| Sled | How it comes | Signature | Runners | Deck | Crest | Stern post | Spirit inlay |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pine Flyer | free | Pine Bow | 80 | 150 | 240 | 360 | 520 |
| Whirl Saucer | Almanac page 5 | Spinning Top | 80 | 150 | 240 | 360 | 520 |
| Lodge Toboggan | 300 gifts | Fireside | 90 | 170 | 260 | 400 | 570 |
| Comet Bob | 600 gifts | Comet Tail | 100 | 190 | 300 | 450 | 650 |
| Wisp | 950 gifts | Will-o'-Wisp | 110 | 210 | 340 | 500 | 730 |
| Tea Tray | 1,400 gifts | Teacup | 130 | 240 | 380 | 580 | 830 |

Each sled's tiers on Low: the same parts with fewer sides and steps (the Saucer's cushion 8 balls, not 14); its post's
lamp lights the snow on Medium and High and paints its pool on Low.

## 8. Shared files: every hunk (for the main lane's merge)

Shared files (notes/r9-lanes.md's list), against the lane's base 6255b8d:

- `src/game/app.ts`
  - Imports: `paints` (KEPT_PAINTS), `tracks` (new), `garage` (the shelves' lists, SETS, onSale, setPiecesFor, the
    `byId`s), `ui/garageview` (types), `almanac` (`monthsOpen`), `lanterns` (`LANTERNS`), `save` (`ornamentState`).
  - Boot (two places): `this.world.rider.setPaint(...)` removed; `applyLook` puts the finish on.
  - `onOpenSleds: (piece?: string) => void this.openGarage(piece)` in place of `this.ui.showSleds(...)` (the round 6
    sheet's call).
  - `paint()`: `setPaint(p.hex)` became `setFinish(p)`.
  - `applyLook()`: puts on the finish, every sled's fitted tiers and the ornament on the post (six lines).
  - One block of 384 lines before `sledCards()`: the garage as a place (`garagePlace` state, `garageCost`,
    `openGarage`, `placeLook`, `frameGarage`, `skipMoment` and its window hook, `closeGarage`, `garageAct`,
    `garageMoment`, `tryOn`, `wearPiece`, `buyPiece`, `syncSets`, `garageView`).
  - Run start: `linesCredited = 0`, `setPiecesOpened = []`.
  - The results' settle: one call, `this.settleShop(sim, mastery or null)`, after mastery.
  - `settleShop` and its two fields (36 lines, after the grudge's settle functions).
  - The spine's opened cards: set pieces pushed with `from` (two lines).
  - The frame: `if (this.garagePlace) this.frameGarage(dt); else if (this.phase === 'reel') ...` (the title's world
    waits while the place is open).
- `src/game/save.ts`: two imports; four optional fields on SaveData (`tracks`, `ornaments`, `ornament`, `sets`);
  `loadShop(d, p)` called at the end of `merge`; `loadShop` and `ornamentState` (new functions).
- `src/game/spineview.ts`: `card()` takes the name the settle gave (a reward the save already held says what it gave
  instead); the results' opened cards carry `from`.
- `src/game/progress.ts`: `nextUnlock`'s sled from `tracks.ts SLED_SHOP` (shop sleds only; the Saucer is the
  Almanac's) with `price` and `piece`; the `sim/sleds` import replaced by `./tracks`.
- `src/ui/contract.ts`: `ResultsNextUnlock`'s sled kind gains `price?` and `piece?`; `RewardCard.from?`.
- `src/ui/ui.ts`: the `garageview` types import; `onOpenSleds?(piece?: string)`; `menus.garage.el` appended after the
  sleds sheet; `showGarage`, `garageMoment`, `closeGarage` (pass-throughs to menus).
- `src/ui/menus.ts` (the garage's part only): two type imports; the `garage` Layer, its UI, act and loader fields;
  the layer built in the constructor; `showGarage`, `garageMoment`, `closeGarage`; `contains`, `anyOpen`, `topEl` and
  `closeMenus` know the garage. The round 6 sheet is untouched.
- `src/audio/engine.ts`: `UiSound` gains `'gift-open' | 'tier-fit'`. `src/audio/sfx.ts`: their two cases in `ui()`.

Render files other lanes may touch (each change additive or confined to the garage's pieces):

- `src/render/world.ts`: `TrailForms` in the scene and fed each frame; `setTrail` sets the plume and the form; the
  keeper's lantern and the post's lamp pushed as local lights; the movers adopted by the after-pass; `setLow` with
  quality; `drawPlace`, `restoreLight` (new).
- `src/render/post.ts`: `renderPlain` (new; the scene target, bloom, grade, composite with the run's uniforms zeroed).
- `src/render/rider.ts`: the scarf (ribbon three across, forms, ends, fringe, bow, patterns, the twin pair, the burn
  keeping the knit), the sled's glow and inlay meshes, `setFinish` (was `setPaint`), `setTracks`, `setTrack`,
  `postLight`, `sledLook`.
- `src/render/meshes.ts`: `playerHat` (reworked and new hats), `finishSled`, `POST_TOP`, `sledTrackParts`,
  `ornamentParts`, `sledWithTrack` (new).

Tests other lanes may touch: `tests/progress.test.ts` (the next unlock's sled: the Lodge Toboggan with its price and piece, no longer the Whirl Saucer), `tests/garage.test.ts` and `tests/spine.test.ts` (adjusted to the catalogue).

Not shared (this lane's own): `src/game/garage.ts`, `paints.ts`, `tracks.ts`, `almanac.ts` and `rank.ts`'s garage
parts, `src/render/garagescene.ts`, `trailforms.ts`, `src/ui/garage.ts`, `garage.css`, `garageview.ts`, the tests
(`tests/shop.test.ts` new; `garage.test.ts` and `spine.test.ts` adjusted to the catalogue) and the scripts
(`scripts/playtest/r9-shop-*`, `r9-garage-economy.ts --econ shop`).

## 9. Text for DECISIONS and ART.md (the main lane's to write)

**For DECISIONS** (a draft of the entry that records milestone 2's G1 to G5):

> The garage is a place (round 9, milestone 2, the shop lane). The title's Garage door opens a sled-maker's workshop
> drawn by the game's own renderer (`render/garagescene.ts`, loaded on first use, disposed on close, the title's
> world waiting while it is open): your rider on your sled on a stand, the shelves one column at the reading edge (a
> sheet on a phone), every piece put on before it is bought, the camera on what is browsed, the Lantern Row in the
> rafters. Each sled has a track of five tiers (Runners, Deck, Crest, Stern post, Spirit inlay) opened by the stage
> lines ridden on it (3, 9, 18, 30, 45; credited in the game layer after the run settles) and fitted for gifts (80 to
> 830 by sled); a track never changes handling. From the fourth tier the post carries an ornament (the lit Stern Lamp;
> the mountains' sets' and the months' chapters'). The five mountains' sets open at a third, two thirds and all of each
> mastery board (scarf, trail, ornament). The Almanac never empties a page: a Saucer already bought gets its first two
> tiers, a chapter piece already bought pays its price back. A purchase and a tier are each a moment (a gift opened,
> the piece put on, a cheer, a sound of its own), skippable, still under reduced motion. Eleven hats, 28 scarves, 29
> trails, 10 finishes (round 8's chapter paints kept), 18 ornaments, 5 sounds 6 sleds (the critics cut the Crest
> Knit, the Double Wrap and Racing Stripe); prices in `garage.ts`, `paints.ts` and `tracks.ts`. The economy on this build: something worth having
> within one to three runs after every one of 100 runs for both pilots; garage goals that are not lanterns at run 100:
> mid 22, novice 42; the dearest tracks a dedicated player's weeks (the mid pilot's Wisp at run 69, the Tea Tray's
> fifth at 100). TODO-CRITIC-LINE

**For ART.md 5, the hats** (replacing "Hats are told apart by their outline from behind ..."): eleven outlines from
behind, each in the player's vermillion with the beanie's cream or an ink trim: the cuffed pom beanie; a low watch
cap, plain red, a thick rolled cuff, nothing on top; two big cream poms hung low beside the jaw on cords; a trapper's
cream fur band and long flaps; a hem of cream bobbles hanging across the nape; a pointed chullo with long braids; a
long stocking cap streaming back, a pom at its end; a broad knit band over the crown and two big fur muffs; a big
quilted dome in fat rings with a cream ring under it; two long knit tails streaming back off the crown, poms at their
ends; a tall felt peak flopped forward over the brow. None is one of The Twelve's (no crown, antlers, horns, fox
ears, stovepipe or topknot).

**ART.md 5, the scarf**: the knot and the wrap stay the classic vermillion; a scarf varies its form (two tails; one
long and one short; four, a pair to each side; one thick rope), what weights the ends (a big cream pom, a little paper
lamp, a snowball, a drop, a point, flame tongues, a tassel, a long ink fringe, a bow at the throat) and a pattern in
cream or ink that runs along and across the knit (bars, bands, a rib, chevrons, a braid, dots, crescents). **Spirit
Flow keeps the knit:** each stitch burns at its own value (an ink band stays dark in the flame, a cream bar burns
white-gold), and only the far half of the tail glows past the bloom, so the flame's light never spreads over the coat.

**ART.md 5, the trail** (replacing "A trail is what the sled leaves ..."): a trail is shapes and behaviours in the air
behind and beside the sled, never a mark on the snow (section 4's one painted line stands): cut-paper flakes that
flutter, petals that sail out flat, gold leaf that spirals up, two ribbons of light that climb off the runners and
bend back, strings of paper bows flying from the stern, embers rising in a column, moths of light circling, a paper
lantern on a line; in the lantern's warm family only (paper, cream, honey, gold, amber), never mint, rose, coral or
vermillion.

**ART.md 13, sled finishes** (replacing "Sled paints recolour ..."): a finish is a ground and a motif where the lens
sees a sled (a pinstripe round the deck, stars across the tail, a cream frame, burnt scrolls, a chequer band, a hex
lattice, one racing stripe, scrollwork, ruled lines), painted over the sled and its fitted tiers together; the trim
stays vermillion. No ground is the coat's ink navy or any locked role's colour, and no more than one is a dark slate.

**ART.md 13, a sled's track**: five tiers built where the chase lens sees a sled, each sled its own (runner tails
swept up into handles or a skid ring, a quilted pad or cushion, a crest board in one wood, a curled tail, low fins at
the tail's corners, swept wings or curled handles), the fourth a post at the stern's right corner, low beside the
rider's back, carrying a lit paper lamp (ribbed, palest at the waist, a dark cap and foot, ART.md 14) or another
ornament; the fifth a cream inlay that burns with the scarf in the flow. A built-up sled is told from its stock one in a
chase still.

**ART.md 10, the garage**: a place, not a sheet: a sled-maker's workshop at dusk drawn by the game's own renderer, the
UI one column at the reading edge (a sheet over the thumbs on a phone), the shelves as tabs, one card, a strip of
tiles; the vermillion only on a purchase or a tier being fitted.

## 10. What only scripts have seen

Seen by me in frames: the place on a desk at High and Low and on a phone (every shot of the script: home, a hat from
behind and in front, a scarf, a finish, a trail on the yard, a purchase's moment from the drop to the end, the sled's
card, a tier's moment, the trick, the Lantern Row, the title after closing, the garage opened at a piece), and every
race-distance sheet. Touched only by scripts or tests, never seen or heard by me:

- **The sounds.** `gift-open` and `tier-fit` were called by the place's script under headless Chromium; nobody has
  heard them. Nor a sound tried on the Sounds shelf in the place.
- **A real run's settle:** the stage lines credited to the ridden sled and a set piece opened by a mastery board are
  proved by `tests/shop.test.ts` and the fixtures (the mid-50 save's set pieces show as held on the shelves, from
  `syncSets` when the garage opens); no run in a browser was ridden to a set's threshold and its card seen on the
  results. The results' `from` line ("Pinecrest's set") is not printed by the results yet (the `ui` lane's
  `rewardSub`).
- **The Almanac's no-silent-page grants** ("Your Whirl Saucer: its runners and deck fitted", "You had the Star Knit:
  260 gifts back"): tests only.
- **The pad's B, a real touch screen, a screen reader.** The keyboard was driven by the script (Enter on the title's
  door, Escape to close, focus handed back checked by script); the phone pass is a mobile viewport with mouse clicks;
  the tablist's arrow keys and the tiles' labels are read from the code, not heard.
- **Frame rate.** The place's cost is a script's count of time to the first frame, draw calls and memory; no one has
  judged its smoothness (only the main lane's quiet sittings count).
- **The economy** is the harness's two pilots and a scripted spender.
- **The production build's place:** the costs below were measured on the dev server (unminified modules); the build
  was made only to see the chunks.

## 11. What the main lane must decide

1. **The results' side (the `ui` lane's files):** print `RewardCard.from` instead of the page when present
   ("Pinecrest's set"), and make "Ready in the shop" the button that calls `onOpenSleds(nextUnlock.piece)`; the
   next sled is now the Lodge Toboggan at 300 (the Whirl Saucer is never a price to save for), with `price` given.
2. **The Crest Knit is cut** (two critics: a rooster's comb, The Twelve's topknot). ART.md 5's hat list is eleven.
   Whether to fill the twelfth hat later is the main lane's call; the hat sink is 3,690.
3. TODO-PAIRS
4. **Not this lane's, seen by every critic:** the flow rim on the coat and sled reads magenta-pink, toward the
   grudge's rose (ART.md 1, 13), in every burn tile of rounds 1 and 2; the Wisp's stock paint is pale mint, the ghosts'
   colour (round 1); a rose blotch in the spray beside the rider (round 2). The Wisp's colour is the sled's own and was
   left as the round found it.
5. **The round 6 garage sheet** (`menus.ts` `sleds`, `garageart.ts`) stays only for the dev harness
   (`ui/harness.ts`); the game no longer opens it. Delete it when the harness moves to the place.
6. **The three new mountains' sets** (G6): `garage.ts SETS` takes an entry per mountain id once the mountains exist;
   their scarf, trail and ornament are a later lane's to design.
7. **Prices as one table** (DECISIONS 393): `garage.ts`, `paints.ts` and `tracks.ts` hold them. Changed from milestone
   0's table: Pom Muffs 440 (a broader band; was 480), the Crest Knit gone.
8. **The ornament on the post stands at the stern's right corner, low beside the rider's back** (round 1 found every
   ornament beside the head at the old height). Its height per sled is `meshes.ts POST_TOP`.
