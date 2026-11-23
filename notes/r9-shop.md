# Round 9, the shop lane: milestone 2's garage (G1 to G5)

Working notes, kept as the lane goes (newest at the end of each part). Frames: the main checkout's
`shots/r9/shop/` (sheet/, keys/ which no critic sees, critic/, place/). Dev server: 4960.

## 1. The pieces' second pass

**Made in the game, not the prototype.** Milestone 0 sketched the pieces in `prototypes/r9/garage/items.ts` on the
live rider. The second pass went straight into the render code the game ships (`meshes.ts` hats, finishes, tiers and
ornaments; `rider.ts` scarf forms and the burn; a new `render/trailforms.ts`), behind the round's model in
`garage.ts`, so what the critic judges is what a player gets and nothing is drawn twice. Nothing else (the place, the
moment) was built before the sheets were judged. `render/trails.ts` already exists (the ruts), so the shaped trails
live in `render/trailforms.ts`.

The six points of `notes/r9-garage.md` section 3, worst first, as built:

1. **No navy, no near-ink ground.** Midnight Stars is a warm night-black (#3A2C2A) with cream stars; Basalt Hex a dark
   slate (#57535F) under a cream lattice; Gilt Scroll oxblood (#5E2430); Twin Stripe ochre (#9A6A2E). A test holds every
   ground off the coat's ink navy (`tests/shop.test.ts`).
2. **The tiers take the finish.** A sled's tiers are merged into its geometry before the finish paints it
   (`meshes.ts sledWithTrack` then `finishSled`), so a crest shows the sled's lacquer; the vermillion trim, steel and
   cream are kept. A motif is decided per face (the two triangles a quad is cut into), so a ruled line is a line.
3. **Trails stay in the air and curve.** Nothing is laid on the snow (DECISIONS 392). Comet Tail's two ribbons rise
   off the runners as they age and drift out to their sides; Kite Tails fly from the post's height and swing; Gold
   Leaf (was Gold Glints) spirals up; Banked Embers rise in a column. Paper and petals are cream with a lit edge.
4. **What is a light glows.** The stern lamp is ribbed paper lit from inside (bands palest at the waist, a dark cap and
   foot, ART.md 14) on its own unlit material past 1 so the bloom takes it, and lights the snow behind (world.ts local
   light, Medium and High; Low paints its pool). Keeper's Lantern the same, larger, on a line. The Night Veil's lamps
   are cream past 1.
5. **Hats.** Bobble Crown (read as The Twelve's crown) is now the **Bobble Hem**, a fringe of cream bobbles hanging
   round the back of a pom-less beanie (same id, so a save that bought it keeps it). Twin Pom's poms hang over the ears
   on cords. Crest Knit is a tall cream fin. Down Cap is twice the puff and has a real brim. Twin Tails hang soft and
   take the body's lag. Flop Peak rises tallest of all and flops forward over the brow (the Long Knit Cap streams back
   to one side). The Watch Cap lost its cream stripe: the one plain red dome.
6. **Scarf forms big enough to read.** The ribbon is three vertices across, so a pattern runs across it (chevrons,
   dots, braids). Forms: two tails, one long and one short (Long Streamer), four (Double Wrap: a second pair drawn from
   the same mesh, one more draw only while worn), one thick rope (Rope Braid, new, the showpiece in the Cape's place).
   Ends: a big knit pom (twice the sketch's), a paper lamp, a snowball, a drop, a point, flame tongues, a tassel, a
   fringe a third of the tail. Chunky Rib is 1.75 wide and ribbed in ink. The Almanac Knot's bow sits at the back of
   the neck, where the chase lens sees it. All in the scarf's one mesh, written each frame round the tip's frame.
   The Wanderer's Cape is cut (DECISIONS 392).

The burn keeps the knit: each stitch burns at its own value (an ink band stays dark in the flame, a cream bar burns
pale gold), and the cloth's first half burns under the bloom's threshold so the glow never spreads over the coat's
back (ART.md 8).

## Shared files: every hunk (for the main lane's merge)

- `src/game/save.ts`: four optional fields (`tracks`, `ornaments`, `ornament`, `sets`) on SaveData; `loadShop` (their
  sanitising readers) called from `merge`; `ornamentState`; two imports.
- `src/game/app.ts`: `applyLook` puts on the finish and every sled's tiers and ornament; the two `setPaint` lines at
  boot became `applyLook`; `paint()` calls `setFinish`; `settleShop` (lines credited to the ridden sled, set pieces
  from the mastery board) called after mastery in the results' settle; `linesCredited` and `setPiecesOpened` reset at
  run start; set pieces pushed into the spine's `opened`; imports.
- `src/game/spineview.ts`: `card()` takes the name the settle gave (a reward the save already held says what it gave
  instead) and the results' opened cards carry `from`.
- `src/ui/contract.ts`: `RewardCard.from?` ("Pinecrest's set"), shown instead of the page by the results (the `ui`
  lane's `sequence.ts rewardSub` should print it when present).

## 2. The model (src/game)

- `garage.ts`: every shelf's pieces with their source (free, shop, an Almanac page, a mountain's set, a month's
  chapter) and their looks: 12 hats, 29 scarves (10 shop and free, 2 Almanac, 5 sets, 12 chapters), 29 trails (9 and
  free, 3, 5, 12), 18 ornaments (the lamp, 5 sets, 12 chapters), the audio lane's 5 sounds; `SETS`, `onSale`,
  `sourceLine`, `setPiecesFor`, `chapterPieces`. `paints.ts`: the finishes (11 on the shelf, round 8's twelve chapter
  paints kept for a save that holds one). `tracks.ts`: the sleds' garage prices and signatures, the tiers, the lines,
  `creditLines`, `fitTier`, `giveTiers`, `tierState`.
- **Lines credited after the run** (`app.ts settleShop`, after mastery in the results' settle): the stage lines the
  run crossed (`sim.stageTicks.length`, 0 to 3) go to the sled it rode, once a run (a revive's second settle credits
  only what is new). Nothing reaches `src/sim` or `src/bot` (`tests/garage.test.ts`, `tests/shop.test.ts`).
- **Sets**: a mountain's mastery board past a third, two thirds and all of its stars puts its scarf, trail and
  ornament in the save's lists (`d.sets` keeps how many), on the run that crosses it and, for a board filled before
  round 9, when the garage opens (`syncSets`). The results turn the piece over with the pages' rewards
  (`RewardCard.from`: "Pinecrest's set").
- **No Almanac page silent** (`rank.ts grant`): page 5's sled on a save that bought the Saucer fits its runners and
  deck ("Your Whirl Saucer: its runners and deck fitted"; if those were fitted already, their price back); a chapter
  piece bought before its page pays its price back ("You had the Star Knit: 260 gifts back"). A revive's second settle
  takes either back first (`SpineSettlement.tiers`).
- **The Whirl Saucer** is never sold (`SLED_SHOP[1].from = 'almanac'`); sim/sleds.ts's prices are no longer what the
  shop reads.
- **Migration**: ids never change (a reworked piece keeps its id: `bobbles` is the Bobble Hem, `stardust` Paper Snow,
  `glints` Gold Leaf, `cocoa` Burnt Scroll, `snow` Finish Chequer, `ash` Basalt Hex, `almanacdusk` Almanac Pages);
  round 8's chapter paints stay wearable; the new fields are optional and sanitised; an old save loads whole
  (`tests/shop.test.ts` "the garage on an old save").

## 6. The economy (G5)

`npx tsx scripts/playtest/r9-garage-economy.ts --ride --out <careers.json>` (heavy slot; this build: mid 35.1 s, novice
35.7 s), then `npx tsx scripts/playtest/r9-garage-economy.ts --econ shop --out <careers.json>`, which spends the careers
with milestone 0's player's rule over the catalogue the game ships (`scripts/playtest/r9-shop-catalogue.ts`,
`r9-shop-econ.ts`). Full output: `shots/r9/shop/economy/tables.txt`. Lifetime gifts are this build's own and equal
milestone 0's (the garage changes no income): mid 140, 805, 4,655, 9,530, 16,595; novice 80, 670, 2,895, 5,520,
10,805.

Sinks: sleds 3,250 (four to buy), tracks 9,930, hats 4,130, scarves 2,570 (the Cape cut, the Rope Braid in), trails
2,760, finishes 2,610, sounds 660: the base shop 15,980 plus the tracks; the months' chapters 11,520 (960 a month);
the Lantern Row 16,500.

| Run | Mid: earned | Mid: owns | Mid: goals left that are not lanterns | Novice: earned | Novice: owns | Novice: goals left |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 140 | the Flyer's runners | 67 (18,210 gifts) | 80 | the Flyer's runners | 67 (18,210) |
| 5 | 805 | 2 tiers, a hat, a scarf, a trail, a finish, a sound, the Lodge | 66 (18,970) | 670 | 2 tiers, a hat, a scarf, a trail, a finish, a sound, the Lodge | 66 (18,970) |
| 20 | 4,655 | 7 tiers, 2 sleds, 5 hats, 4 scarves, 4 trails, 4 finishes, 3 sounds, the month's set, 4 set pieces | 43 (15,570) | 2,895 | 6 tiers, 2 sleds, 2 hats, 2 scarves, 2 trails, a finish, a sound, the month's set | 60 (17,640) |
| 50 | 9,530 | 14 tiers, 3 sleds, 7 hats, 6 scarves, 4 trails, 4 finishes, 4 sounds, 8 set pieces | 32 (12,820) | 5,520 | 10 tiers, 2 sleds, 4 hats, 4 scarves, 3 trails, 3 finishes, 2 sounds, a set piece | 48 (15,160) |
| 100 | 16,595 | 24 tiers, 5 sleds (the Tea Tray), 8 hats, 6 scarves, 6 trails, 5 finishes, 11 set pieces | 24 (9,400) | 10,805 | 19 tiers, 4 sleds (the Wisp), 6 hats, 5 scarves, 5 trails, 3 finishes, 3 sounds, a set piece | 45 (14,100) |

- **Something worth having within one to three runs after every run:** 100 of 100 for both pilots (runs with nothing
  but a lantern in reach: 0 and 0; milestone 0's today: 70 of the mid pilot's runs and 38 of the novice's).
- **Garage goals at runs 50 and 100 that are not lanterns:** mid 32 and 24, novice 48 and 45 (tracks, sets, sleds
  among them).
- **The dearest pieces, a dedicated player's weeks:** at the harness's four runs a day the mid pilot finishes the
  Lodge's track at run 27 (day 7), Comet Bob's at 48 (day 12), the Wisp's at 73 (day 19) and the Tea Tray's at run
  100 (day 25); the novice the Flyer's at 17, the Lodge's at 43, Comet Bob's at 76. None of it waits on a clock.
- What is approximate: the harness's pilots never improve, nobody revives or doubles, and the player's rule is a
  script's (fit the ridden sled's next tier, then the next sled, then the shelves in turn), not a person's taste.

## Text for ART.md 5 and 13 (the main lane's to write)

- **ART.md 5, the hats** (replacing "Hats are told apart by their outline from behind ..."): twelve outlines from
  behind, each in the player's vermillion with the beanie's cream or an ink trim: the cuffed pom beanie; a low watch
  cap, plain red, a thick rolled cuff, nothing on top; two big cream poms hung low beside the jaw; a trapper's cream fur
  band and long flaps; a hem of cream bobbles hanging across the nape; a pointed chullo with braided ties; a long
  stocking cap streaming back to one side; a tall vermillion fin from brow to nape with a cream edge; a knit band and two
  big fur muffs over the bare hair; a big quilted dome with a real brim; two soft knit tails hanging back over the
  shoulders; a tall felt peak flopped forward over the brow. None is one of The Twelve's.
- **ART.md 5, the scarf**: the knot and the wrap stay the classic vermillion; a scarf varies its form (two tails, one
  long and one short, four in two pairs, one thick rope), what weights the ends (a big knit pom, a little paper lamp,
  a snowball, a drop, a point, flame tongues, a tassel, a long fringe, a bow at the back of the neck) and a pattern in
  cream or ink that runs along and across the knit (bars, bands, a rib, chevrons, a braid, dots, crescents). **Spirit
  Flow keeps the knit:** each stitch burns at its own value (an ink band stays dark in the flame, a cream bar burns
  white-gold), and only the far half of the tail glows past the bloom, so the flame's light never spreads over the
  coat.
- **ART.md 5, the trail** (replacing "A trail is what the sled leaves ..."): a trail is shapes and behaviours in the
  air behind and beside the sled, never a mark on the snow (section 4's one painted line stands): cut-paper flakes that
  flutter, petals that sail out flat, gold leaf that spirals up, two ribbons of light that climb off the runners, strings
  of paper bows flying from the stern, embers rising in a column, moths of light circling, a paper lantern on a line;
  in the lantern's warm family only (paper, cream, honey, gold, marigold, amber), never mint, rose, coral or
  vermillion.
- **ART.md 13, sled finishes** (replacing "Sled paints recolour ..."): a finish is a ground and a motif where the lens
  sees a sled (a pinstripe round the deck, stars across the tail, a cream frame, burnt scrolls, a chequer band, a hex
  lattice, racing stripes, scrollwork, ruled lines), painted over the sled and its fitted tiers together at the wood's
  own value; the trim stays vermillion. No ground in ink navy (the coat's) or any locked role's colour.
- **ART.md 13, a sled's track**: five tiers built where the chase lens sees a sled, each sled its own (runner scrolls or
  a skid ring, a quilted pad or cushion, a crest board, a curled tail, a fin, swept wings or curled handles), the fourth a
  post at the stern's right corner, low beside the rider's back, carrying a lit paper lamp (ribbed, palest at the
  waist, a dark cap and foot, ART.md 14) or another ornament; the fifth a cream inlay that burns with the scarf in the
  flow.
- **ART.md 10, the garage**: a place, not a sheet: a sled-maker's workshop at dusk drawn by the game's own renderer,
  the UI one column at the reading edge (a sheet over the thumbs on a phone), the shelves as tabs, one card, a strip of
  tiles; the vermillion only on a purchase or a tier being fitted.

## 4. The place (G1)

`src/render/garagescene.ts` (from milestone 0's prototype scene, made the game's: its own Rider, the game's sleds, hats,
tiers and trail forms, the game's toon material and local lights), imported by `app.ts openGarage` when the garage
opens (the title's Garage door calls `onOpenSleds`; it takes a piece, 'sled:3', for the results' "Ready in the shop");
drawn by the world's renderer through `post.ts renderPlain` (the scene target, the bloom, the grade, the composite's
edge walk; none of the run's passes) while the world's own frame waits; disposed on close, the world's light, hour and
look put back (`world.restoreLight`, `applyLook`). `src/ui/garage.ts` (with `garage.css` and `garageview.ts`) is
loaded with it, mounted by `menus.ts showGarage` in a layer of its own (the round 6 sheet stays for the dev harness);
everything else in the UI steps out while it is open.

- **The camera follows what you browse:** a hat from behind (the first try) and from the front (the same hat again);
  a scarf from behind; a finish low beside your own sled; a trail with the rider out on the yard's loop; a sound
  heard as it is picked (`audio.previewSledSound`), on the stand; the sled; the post; the Lantern Row in the rafters
  (its button turns the camera up and the card lists the towns, with Light One for each). The subject keeps left of
  the card's column on a desk and above the sheet on a phone (the projection's centre is moved, `setViewOffset`).
- **Everything is tried on before it is bought:** picking a tile puts the piece on the rider in the place at once;
  closing puts the save's look back.
- **Each sled's card** names its signature trick with how to do it and a Watch that plays the rider's own trick pose
  on the stand (the sled lifted on its cradles; still under reduced motion), its track's five tiers with what each
  waits on, and from the fourth its post's ornaments.
- **Keyboard, pad and touch:** the tabs are a tablist (arrow keys), every tile and action a button with its words,
  Escape and the pad's B close it (the Back button's data-fk), focus returns to the door that opened it (menus.ts).
