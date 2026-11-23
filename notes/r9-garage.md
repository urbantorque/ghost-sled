# Round 9, the garage lane (milestone 0): the model, every item, the economy, and a first frame of the place

Milestone 0 changes nothing a player sees. Everything here is data, scripts and a dev page:

- `prototypes/r9/garage/catalogue.ts`: the proposed garage as data (sleds and their tracks, every shelf piece with its
  price or source and what tells it apart at race distance, the mountains' sets, the months' chapters, today's
  near-duplicates and what becomes of each).
- `prototypes/r9/garage/economy.ts` and `scripts/playtest/r9-garage-economy.ts`: the economy table from the career
  harness, today's garage and the proposal, the mid pilot and the novice. `prototypes/r9/garage/economy.json` is its
  output, which the page reads.
- `prototypes/r9/garage/items.ts`: the proposed pieces sketched on the live rider (hats, scarves, a burn that keeps
  the knit, finishes, the Pine Flyer's tiers, trails).
- `prototypes/r9/garage/scene.ts`, `page.ts`, `garage.css` and `prototypes/r9/garage.html`: the garage as a place, on
  the dev server at `/prototypes/r9/garage.html` (switches in page.ts's header).
- `scripts/playtest/r9-garage-sheet.js`: the race-distance sheet, shot mid-run through the real game.
- Frames: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/garage/` (sheet/, scene/, economy/).

Two fresh critics (Opus at xhigh effort, given only ART.md and the frames) judged the race-distance sheets; their
answers are in section 3, and they are the honest measure of the proposal's own sketches: the model and the economy
hold, and several of the sketched pieces do not yet read at race distance.

## 1. The model

**What the garage is for.** Three things a player wants from it, in order: a sled that is visibly theirs and grows with
them, a rider whose look is theirs at race distance, and something to save for at every stage of a career. Today it has
the second in name only and none of the first or third after about run 30.

**Shelves.** Six, the place's own tabs: Sled (your sleds and each one's track), Hats, Scarves, Trails, Finishes (today's
Paint, renamed because a finish is more than a hex), Sounds. The Lantern Row leaves the tab row and becomes part of
the place (below). A new shelf only where it reads in a run: the **ornament** on a sled's stern post is the one new
slot, and it is not a tab but a choice on the Sled card, opened by the track's fourth tier.

**Upgrades: each sled's track (G2).** Five visible tiers per sled, each built where the chase lens sees a sled (the tail,
the runner tails, the sides past the rider's hips, a post over the stern), never touching handling (sim/sleds.ts is not
read by any of it; the tiers are a render look keyed on the save, like paint):

| Tier | Opens after (stage lines on that sled) | Pine Flyer's price | What it is (the Pine Flyer; every sled has its own, catalogue.ts SLEDS) |
| --- | --- | --- | --- |
| I Runners | 3 (one finish) | 80 | the runner tails run on and scroll up into two curls behind the seat |
| II Deck | 9 (three finishes) | 150 | a cream quilted pad over the seat, its stitched edge proud past the hips |
| III Crest | 18 (six) | 240 | the bow becomes a carved crest twice its height, edged in the trim's vermillion |
| IV Stern lamp | 30 (ten) | 360 | a post with a cream paper lamp, ink cap, a warm heart that lights the snow behind; opens the ornament slot |
| V Spirit inlay | 45 (fifteen) | 520 | ink inlay down the runners and round the crest that burns with the scarf at Spirit Flow |

- **Earned by riding, fitted with gifts.** A tier opens by riding that sled (stage lines crossed on it, so a run that
  crashes early still counts for what it rode) and is then fitted for gifts. Both, because each alone fails: riding
  alone makes gifts worthless again; gifts alone lets a run-100 wallet buy a sled's whole history in one tap. Riding
  first gives the owner's line its shape: "three more runs and my sled gets its lamp".
- **Prices** scale by sled: the Pine Flyer and the Whirl Saucer 1.0, the Lodge Toboggan 1.1, Comet Bob 1.25, the Wisp
  1.4, the Tea Tray 1.6 (the Tea Tray's fifth tier 830, its track 2,160). All six tracks: 9,930 gifts.
- **The spirit inlay** lights in the scarf's own burn (vermillion to flame orange to marigold, the rider's role and the
  flow's, ART.md 8), so it is "you, burning", never a new colour.
- **Stock and upgraded at race distance:** three of the five tiers change the sled's silhouette from behind (the
  curls, the crest, the lamp on its post), and the lamp is a light. Proof: the sleds sheet (section 3): the critic
  told every tier from the stock sled and ranked them plainest to most built-up; the stock and the deck-only sled are
  the one pair it needed a second look for, and the lamp read as "a thermos or milk churn" by day (it must glow).

**The signature trick** is named on each sled's card with how to do it ("Pine Bow: standing on the sled, a slow bow with
both arms out", sim/tricks.ts) and a Watch button plays it on the stand: the rider's own trick pose (trickpose.ts) in
a two-second loop, the sled lifted on the stand's cradles. Today the garage names it nowhere (`grep -i signature
src/ui/menus.ts` finds nothing).

**Sets (G6): one per mountain, earned by mastering it.** Each mountain's set is a scarf, a trail and an ornament on one
motif, opened at a third, two thirds and all of that mountain's mastery board (mastery.ts: 10 to 13 stars a mountain).
Never sold. The three new mountains each get a set designed with the mountain once the owner has picked them. In the
careers: the mid pilot holds 8 set pieces at run 50 and 11 at run 100; the novice 1 by run 50 (its Pinecrest scarf);
so a set is a goal at run 50 and run 100 that is not a lantern and cannot be bought.

**The months' chapters** stay three pieces a month (the owner's decision 3: sold for gifts from their month and found on
their pages), but each month's three look like their month: a scarf of its own form, a trail of its own shape and an
ornament of its motif (catalogue.ts CHAPTERS: sunrise bars and dawn fans in January, icicle fringe and icicle chimes in
February ...), where today's are made by turning one pattern list and two colour lists (almanac.ts chapterSet), so they
repeat the shop. The ornament replaces the chapter paint (a paint is the piece least seen at race distance).

**The Almanac's rewards are things the shop never sells, and no page is ever empty.**
- Page 5's sled: the Whirl Saucer leaves the shop and is the Almanac's sled (found, never sold). A save that bought it
  before round 9 keeps it, and its page 5 gives the Saucer's first two tiers fitted instead.
- Every Almanac garage piece (pages 17, 28, 38, 42, 46, 50) is reworked so it is unlike any shop piece (a bow at the
  throat, moths that circle, a ruled page finish, lamp-weighted tails, coals left in the groove, a lantern on a line).
- The rule, in rank.ts grant: a reward the save already holds is never silent. Today (`rank.ts` 207 and 210 to 216)
  `grant` skips an owned sled or garage piece and settleSpine still pushes the card under the reward's own name, so the
  results say "A new sled" and give nothing. Proposed: a sled already owned gives its first two tiers; a garage piece
  already owned (a chapter piece bought before its page) gives its price back in gifts, said on the card ("You had
  the Lantern Night Scarf: 260 gifts back").

**The Lantern Row becomes part of the place.** Its lanterns hang from the workshop's rafters as they hang in the finish
towns (the first frame shows five lit), and lighting the next one is done from the place, not a tab: the camera turns
up to the rafters, and the card names the town and its next lantern. Its 40 lanterns (16,500 gifts) stay the long sink
past everything else, which is what the economy below wants of them; the tab that left half a sheet empty goes.

**Gifts stay the one currency.** No second currency, no loot box, nothing random bought, no timer: a tier waits for
riding, never for a clock.

## 2. The price curve and the economy table

**The curve.** Entry pieces under a run of income (80 to 150), the middle of each shelf at one to three runs (200 to
480), the showpiece of each shelf at four to six (580 to 850), the sleds at two to nine runs (300, 600, 950, 1,400),
and the tracks at half a run to three runs a tier. The dearest single goals: the Tea Tray and its track (3,560 gifts and
fifteen finishes on it), the mountains' sets (mastery, not gifts), and the Lantern Row.

| Sink | Today | Proposed |
| --- | --- | --- |
| Sleds | 2,340 (5 to buy) | 3,250 (4 to buy; the Saucer is the Almanac's) |
| Tracks | none | 9,930 (6 sleds x 5 tiers, each opened by riding) |
| Hats | 820 (6) | 4,130 (11) |
| Scarves | 780 (6) | 2,730 (9; 2 more found in the Almanac) |
| Trails | 770 (5) | 2,760 (8; 3 more found) |
| Paint / finishes | 900 (7) | 2,610 (9; 1 more found) |
| Sounds | 660 (4) | 660 (4) |
| The base garage | **6,270** | **16,140**, plus the tracks |
| Chapters (a month) | 960 | 960 |
| Lantern Row | 16,500 | 16,500 |

**The table.** `npx tsx scripts/playtest/r9-garage-economy.ts --ride` (heavy slot; about 25 s a pilot with the pools
cached) rides the mid pilot and the novice 100 runs each through the game layer (r8career.ts), then
`npx tsx scripts/playtest/r9-garage-economy.ts` spends them. Income never depends on what is bought (the careers ride
the Pine Flyer), so one ride serves every spender. Lifetime gifts measured today: mid 140, 805, 4,655, 9,530 and 16,595
at runs 1, 5, 20, 50 and 100 (DECISIONS 371 had 140, 875, 4,495, 10,145 and 17,260 on round 8's build); novice 80,
670, 2,895, 5,520 and 10,805. Full output: `shots/r9/garage/economy/tables.txt`.

**Today, checked.** The base garage costs 6,270 (confirmed: sleds 2,340, scarves 780, hats 820, trails 770, sounds
660, paints 900). Lifetime gifts cover it at run 28 for the mid pilot and run 56 for the novice. A player who buys the
garage first (the player's rule below) owns all of it at **run 31 (mid) and run 59 (novice)**, and after that only a
lantern is ever within three runs: **70 of the mid pilot's 100 runs and 38 of the novice's**. The harness's own
cheapest-first spender never owns it all: it buys 150-gift lanterns and the month's chapter pieces before the 640-gift
Wisp and the 900-gift Tea Tray, which are still unbought at run 100, and 18 (mid) and 26 (novice) of its runs have
nothing but a lantern in reach. The dearest cosmetic is not Comet Tail's 240 but the month's chapter trail at 380 (1.5
to 2.3 runs); a lantern is up to 675.

**The player's rule** (economy.ts header): fit the next tier of the sled you ride the moment it is open and affordable,
else save for it; once your sled has its lamp, save for the next sled and ride it once bought; otherwise the shelves take
turns (hat, scarf, trail, finish, sound, the month's set), the cheapest piece on the shelf whose turn it is; a lantern
only when nothing else is left. "Within one to three runs": gifts still owed, or a tier's stage lines still to ride, at
most three runs of the pilot's last ten runs' form.

Mid pilot, today's garage (the player's rule):

| Run | Earned | Owns | Within 1 to 3 runs | Saving for | Goals left that are not lanterns |
| --- | --- | --- | --- | --- | --- |
| 1 | 140 | 1 sled (the Saucer, page 5 to come) | the Lodge Toboggan, Comet Bob, scarves at 60 to 210 | the Lodge Toboggan | 35 (7,110) |
| 5 | 805 | 3 sleds | scarves, Watch Cap, Twin Pom | the Wisp | 33 (6,430) |
| 20 | 4,655 | 5 sleds, 4 scarves, 5 hats, 4 trails, 4 paints, 3 sounds | Ink Bands, Snow Tip, Long Knit Cap ... | Long Knit Cap | 11 (2,050) |
| 50 | 9,530 | everything, 13 lanterns | nothing but a lantern | a Sakura lantern | 0 |
| 100 | 16,595 | everything, 29 lanterns | nothing but a lantern | a Lanternfall lantern | 0 |

Mid pilot, the proposed garage (the same rule):

| Run | Earned | Owns | Within 1 to 3 runs | Saving for | Goals left that are not lanterns |
| --- | --- | --- | --- | --- | --- |
| 1 | 140 | the Pine Flyer's runners | the Lodge Toboggan, the Flyer's deck, Watch Cap, Twin Pom, Trapper ... | Watch Cap | 67 (18,370 gifts) |
| 5 | 805 | 2 tiers, a hat, a scarf, a trail, a finish, a sound | the Lodge Toboggan, Comet Bob, the Flyer's crest, hats at 110 to 400 | the Lantern Night scarf | 66 (19,150) |
| 20 | 4,655 | 7 tiers, the Lodge Toboggan, 5 hats, 4 scarves, 4 trails, 4 finishes, 3 sounds, 4 set pieces, the month's set | Comet Bob, the Lodge's lamp, hats at 320 to 850 | Lantern Song | 43 (15,750) |
| 50 | 9,530 | 14 tiers, Comet Bob, 7 hats, 6 scarves, 4 trails, 4 finishes, 8 set pieces | the Wisp, Pom Muffs, Down Cap, Double Wrap, Pom Tails, Paper Snow | the Wisp | 32 (12,980) |
| 100 | 16,595 | 24 tiers (the Lodge, Comet Bob and Wisp tracks whole), the Tea Tray, 8 hats, 6 scarves, 6 trails, 5 finishes, 11 set pieces | Long Streamer, Double Wrap, Pom Tails, Petal Drift, Finish Chequer, the Cowbell (a star away on Pinecrest) | the Down Cap | 24 (9,560) |

Novice, today's garage (the player's rule): owns the Lodge and Comet at run 5 (290 in the wallet), five sleds and a
handful of pieces at 20, nearly all at 50 (6 goals, 1,160 gifts left), everything at 59; 38 runs after that with
nothing but a lantern in reach.

Novice, the proposed garage:

| Run | Earned | Owns | Within 1 to 3 runs | Saving for | Goals left that are not lanterns |
| --- | --- | --- | --- | --- | --- |
| 1 | 80 | the Flyer's runners | the Flyer's deck, Watch Cap, Twin Pom, Cream Bar | Watch Cap | 67 (18,370) |
| 5 | 670 | 2 tiers, a hat, a scarf, a trail, a finish, a sound | the Lodge Toboggan, the Flyer's crest, hats at 110 to 400 | the Lantern Night scarf | 66 (19,150) |
| 20 | 2,895 | 6 tiers, the Lodge, 2 hats, 2 scarves, 2 trails, a finish, a sound, the month's set | the Lodge's deck, hats at 150 to 580 | Glacier Enamel | 60 (17,820) |
| 50 | 5,520 | 10 tiers, 4 hats, 4 scarves, 3 trails, 3 finishes, 2 sounds, a set piece | Comet Bob, Braided Chullo, Crest Knit, Ink Bands, Paper Snow | Comet Bob | 48 (15,340) |
| 100 | 10,805 | 19 tiers, the Wisp, 6 hats, 5 scarves, 5 trails, 3 finishes, 3 sounds | the Wisp's crest, Crest Knit, Snow Tip, Double Wrap, Comet Tail | the Wisp's crest | 45 (14,280) |

**Against section 2's bar:**
- Something worth having one to three runs away after every one of the 100 runs: today 30 of 100 (mid, the rest only
  lanterns) and 62 of 100 (novice); proposed **100 of 100 for both**.
- Garage goals at runs 50 and 100 that are not lanterns: today none (mid) and 6 then 1 (novice); proposed **32 and 24
  (mid), 48 and 45 (novice)**, sets and tracks among them.
- The dearest pieces a dedicated player's weeks: the mid pilot, at four runs a day, finishes the Tea Tray's track at run
  100, its 25th day; the Lodge's track at day 7, Comet Bob's at day 12, the Wisp's at day 19. The novice finishes the
  Pine Flyer's track at day 6 and Comet Bob's at day 25. Weeks, not a session; none of it is behind a clock.
- What is approximate: the harness's own list (r8career.ts: pilots never improve, nobody revives or doubles), and a
  rule is not a person: a real player buys what they like, not the next on a shelf. A green table is permission to
  ask a person.

## 3. Every item, and what tells it apart at race distance

**Race distance, measured.** In the sheets' frames (1280 x 720, High, the chase lens at about 25 m/s on Pinecrest) the
rider from the sled's base to 1.75 m over it is 116 to 166 pixels, a seventh to a quarter of the frame's height
(126 px, a sixth, on the stock rider; nearer the lens in a carve, farther in the air), and the head with its hat 35 to
45 pixels, a sixteenth to a twentieth. A trail's mote (0.2 m) is about 15 pixels at the sled and a few pixels by the
time it passes the frame's foot. The chase lens sees the back of the head, the scarf streaming to one side, the back of
the coat and the sled's tail; the deck under the rider and the sled's nose hardly at all.

**The sheets** (`shots/r9/garage/sheet/`, and smaller copies the page shows, `prototypes/r9/garage/frames/`): every
piece put on the live rider mid-run on Pinecrest at High, through scripts/playtest/r9-garage-sheet.js. The rider rides
the Pine Flyer (a pool rider's run replayed as the player), its own glows held still (no dash shimmer, no flow but on
the burn sheet). Hats, scarves, finishes and the sled's tiers are put on one after another at 300 m, a quarter of a
second apart; each trail and each whole look gets its own run, put on at 200 m and shot at 300 m, so every trail is
shot at the same place. Each tile is the chase lens's own frame cropped round the rider at its real size, nothing
scaled. Numbered in a seeded shuffle; the key (today's or proposed) is below, never shown to the critic.

| Sheet | Tiles: number, piece (T today, P proposed) |
| --- | --- |
| hats | 1 Braided Chullo T, 2 Crest Knit P, 3 Bobble Crown T, 4 Long Knit Cap T, 5 Down Cap P, 6 Flop Peak P, 7 Twin Tails P, 8 Twin Pom T, 9 Pom Muffs P, 10 Pom Beanie T, 11 Watch Cap T, 12 Bobble Crown reworked P, 13 Trapper T |
| scarves | 1 Cream Bar T, 2 Long Streamer T, 3 Pom Tails P, 4 Double Wrap P, 5 Night Veil P, 6 Chunky Rib T, 7 Chunky Rib reworked P, 8 Classic Knit T, 9 Long Streamer reworked P, 10 Wanderer's Cape P, 11 Snow Tip T, 12 Ink Bands T |
| burn | 1 Cream Bar, today's burn; 2 Ink Bands, today's burn; 3 Cream Bar, the burn that keeps the knit; 4 Ink Bands, the same |
| finishes | 1 Plum Two-Tone P, 2 Plum T, 3 Midnight Stars P, 4 Pine Lacquer pinstriped P, 5 Finish Chequer P, 6 Basalt T, 7 Natural T, 8 Twin Stripe P, 9 Pine Lacquer T, 10 Midnight T |
| sleds | 1 Pine Flyer every tier, 2 stock, 3 to its stern lamp, 4 every tier at Spirit Flow, 5 runners and deck |
| trails | 1 Comet Tail T, 2 Keeper's Lantern P, 3 Fresh Powder T, 4 Kite Tails P, 5 Lantern Sparks T, 6 Stardust T, 7 Paper Snow P, 8 Comet Tail reworked P, 9 Gold Glints T |
| whole looks (full frames, the critic's look-A to look-D) | A Down Cap, Night Veil, Midnight Stars, runners and deck, Paper Snow (P); B Trapper, Ink Bands, Plum paint, Lantern Sparks (T); C Flop Peak, Pom Tails, Finish Chequer, four tiers, Kite Tails (P); D Pom Muffs, Wanderer's Cape, Twin Stripe, five tiers, Comet Tail reworked (P) |

**What the critics found** (two fresh critics, Opus at xhigh effort, given only ART.md and the frames, told which shelf a
sheet shows and nothing of which tiles are today's; their full answers are kept in
`shots/r9/garage/critic/answers.md`):

| Sheet | Told apart at a glance | Could not tell apart | Only with effort | What broke the art bible |
| --- | --- | --- | --- | --- |
| Hats (13) | 7 (pom beanie, the drooping cones, the bobble rings, Watch Cap, Trapper, Twin Tails, Pom Muffs); 4 more on a second look | Crest Knit, Pom Beanie and Watch Cap (2, 10, 11) | Long Knit Cap and Flop Peak (4/6); Bobble Crown and its rework (3/12); Braided Chullo, Down Cap and Watch Cap as plain domes (1/5, 1/11); Twin Pom against the beanies | the reworked Bobble Crown reads as a crown (The Twelve's), today's mildly so; today's Twin Pom as fox ears (its poms sit on the crown, not over the ears); Twin Tails as horns (stiff, straight out) |
| Scarves (12) | 4 (plain, Double Wrap's cream bars, Ink Bands, today's Long Streamer); about 4 more on a second look | Pom Tails, Chunky Rib and Classic Knit (3, 6, 8) | Cream Bar, the Cape and Snow Tip (1/10/11); the Chunky Rib rework and Ink Bands (7/12); the long tails (2/5/9) | Night Veil's lamp reads as "a grey rod with a navy ball"; spray between lens and rider washes two tiles pink toward the grudge's rose |
| Burn (4) | 2 (a plain flame, a patterned one) | today's burn on Cream Bar and on Ink Bands (1/2) | | today's burn: the flame's glow spreads over the coat's back (ART.md 8: never over the body) |
| Finishes (10) | 6 (wood, violet, green, dark navy, navy and cream stripes, white) | Basalt and Midnight (6/10, both today's flat paints); Pine Lacquer and its pinstriped rework (4/9) | Midnight Stars against Basalt and Midnight; Two-Tone and Chequer under spray (1/5) | navy finishes take the coat's locked ink navy (today's Midnight and Basalt, the proposed Stars and Twin Stripe): coat and sled merge into one dark mass; violet is Comet Bob's own lacquer |
| Sleds (5) | 4 | none | the stock sled and runners-and-deck (2/5); every tier with and without Spirit Flow (1/4) | the lamp, unlit by day, reads as a thermos; the inlay at Spirit Flow sampled #E29B50, between the lantern's amber rim and the clock's amber; the crest's zigzag echoes a crown a little |
| Trails (9) | 3 (Keeper's Lantern, Kite Tails, Comet Tail reworked); 2 more with effort (Paper Snow; today's Comet Tail's honey) | **today's Fresh Powder, Lantern Sparks, Stardust and Gold Glints (3, 5, 6, 9): four of today's six are one trail at a glance** | Paper Snow (read as grit in the corners); today's Comet Tail (a faint honey tint) | Kite Tails lie along the ruts like a painted dashed line, in a drab olive; the reworked Comet Tail reads as two straight stripes down the fall line ("the runners stretched to infinity"); the lantern as a tin can, a dark hard shape (a hazard's read); Paper Snow as grey grit, darker than thrown snow may be |

**Naming what the rider wears** (four whole frames, nothing said of what to expect):
- B, today's (Trapper, Ink Bands, Plum paint, Lantern Sparks): the trapper (medium), a banded scarf (medium), the violet
  sled read as **another sled, Comet Bob** (a paint read as a model), gold glints at the hip (medium). Three of four.
- C, proposed: **the Flop Peak named with high confidence**, the Kite Tails with high, the stern lamp seen as "a canister"
  on the sled; the Pom Tails read as a plain scarf, and the Finish Chequer not seen at all: **the fitted crest covers the
  tail where a finish shows** (the tiers must take the sled's finish). Two and a half of five.
- D, proposed: the Pom Muffs as "earmuffs or headphones on a bare head" (medium; close to an aviator cap), the comet
  streaks seen as rails; the Cape, the Twin Stripe and the inlay not read. One and a half of five.
- A, proposed: the Down Cap as "a round ridged dome, the watch cap or the bobbles", the Night Veil as "a thin tail ending
  in a puff", the deck's cream pad and a navy band, Paper Snow as shards. Partly, on four of five.

**What this says.** The model holds: the sled's tiers read and tell stock from upgraded, and four of today's six trails
and two of today's hats are not items at race distance, as the brief's section 1 guessed. The sketches are a first pass,
and the critics name what the second must do, worst first:
1. **No navy, no near-ink finish.** The coat owns ink navy; a dark blue sled merges with it. That retires today's
   Midnight and Basalt as they are, and the proposal's dark finishes become warm darks, or patterns on a light ground.
2. **The tiers take the finish.** A fitted crest is the sled's tail from the chase lens; plain wood there hides the paint.
3. **Trails stay in the air and curve.** Nothing lies along the ruts or runs straight down the fall line (ART.md 4): the
   kite strings fly higher and swing, the comet streaks lift off the snow and bend with the carve, paper and petals are
   cream with a lit edge, never grey.
4. **What is a light must glow.** The stern lamp, Keeper's Lantern and the Night Veil's lamps read as a thermos, a tin
   can and a stick by day: paper with ribs and a heart that blooms (ART.md 14's lantern), and larger.
5. **Hats: cut or rework the five that failed.** Crest Knit (read as the beanie): cut, or a fin three times as tall. The
   Bobble Crown and its rework (read as The Twelve's crown): retire both. Twin Pom: the poms down over the ears, as its
   name says. Twin Tails: soft and hanging, streaming back, not stiff and out. Down Cap: twice the puff and a real brim.
   That leaves ten hats; of those the critic told every pair apart at a glance but the two cones (Long Knit Cap and
   Flop Peak), which want the Flop Peak's flop forward or to the other side.
6. **Scarves: the form must be big enough to read.** Pom Tails' poms twice the size, the Cape to the waist and a third
   wider, Chunky Rib's ribs in ink or cut; Cream Bar, Snow Tip and the Cape's hem are one read (cream at the end): keep
   one.

**Every item.** Generated from catalogue.ts by `npx tsx scripts/playtest/r9-garage-items.ts`.

**Hats** (12)

| Piece | Source | Against today | What tells it apart at race distance | Levers |
| --- | --- | --- | --- | --- |
| Pom Beanie | every rider | kept | Round crown, one big cream pom on top | silhouette |
| Watch Cap | 80 gifts | kept | Low and flat-topped, a thick rolled cuff, nothing on top | silhouette |
| Twin Pom | 110 gifts | kept | Two poms over the ears, a dip between them | silhouette |
| Trapper | 150 gifts | kept | Broad, a cream fur band and two long flaps to the scarf | silhouette, material |
| Bobble Crown | 200 gifts | reworked | A ring of six bobbles stood on short stalks, so the crown reads as a spiky ring, not a pom | silhouette |
| Braided Chullo | 260 gifts | kept | A point on top and two braids hanging past the jaw | silhouette, motion |
| Long Knit Cap | 320 gifts | kept | A tail streaming back off one side, a pom at its end | silhouette, motion |
| Crest Knit | 400 gifts | new | A fin of seven cream bobbles from brow to nape: a vertical stripe over the head | silhouette, pattern |
| Pom Muffs | 480 gifts | new | A knit band and two big fur muffs: wide at the ears, the dark hair showing on top | silhouette, material |
| Down Cap | 580 gifts | new | A big puffed dome in three fat quilted channels, stepped sides, no pom | silhouette, material |
| Twin Tails | 700 gifts | new | Two long knit tails off the back of the crown, streaming in a V above the scarf | silhouette, motion |
| Flop Peak | 850 gifts | new | A tall soft felt cone that flops over to one side, a cream pom swinging at its tip | silhouette, material, motion |

**Scarves** (12)

| Piece | Source | Against today | What tells it apart at race distance | Levers |
| --- | --- | --- | --- | --- |
| Classic Knit | every rider | kept | Two tails, two deeper stripes near the tips | pattern |
| Cream Bar | 80 gifts | kept | Two tails, two cream bars across each near the tip | pattern |
| Chunky Rib | 110 gifts | reworked | Short and twice as broad, ribbed in ink-deep rows so the rib reads past 5 m | silhouette, pattern |
| Fringe Knit | 150 gifts | reworked | Tails ending in a long fringe, a third of the tail, that splays as it streams | silhouette, motion |
| Ink Bands | 190 gifts | kept | Narrow ink bands all down its length: a dark-striped ribbon | pattern |
| Snow Tip | 240 gifts | kept | Cream-dipped ends and a cream fringe: pale tips | pattern |
| Long Streamer | 300 gifts | reworked | One tail half as long again as the other: a long single line behind the rider | silhouette, motion |
| Double Wrap | 380 gifts | new | Four tails, two pairs of two lengths, cream piping down their edges | silhouette, pattern |
| Pom Tails | 480 gifts | new | Each tail ends in a big knit pom that swings it low and heavy | silhouette, motion |
| Wanderer's Cape | 800 gifts | new | One broad knit panel down the back to the waist, its hem a cream chevron that flaps | silhouette, pattern, motion |
| Almanac Knot | Almanac page 17 (never sold) | reworked | A big bow at the throat with two short ink-tipped tails | silhouette |
| Night Veil | Almanac page 42 (never sold) | reworked | Long fine tails each weighted by a small paper lamp that glows from dusk | silhouette, motion, light |

**Trails** (12)

| Piece | Source | Against today | What tells it apart at race distance | Levers |
| --- | --- | --- | --- | --- |
| Fresh Powder | every rider | kept | Snow and only snow | - |
| Honey Plume | 80 gifts | reworked (was Honey Spray) | The spray thrown up in a rooster tail of big honey billows, twice as tall | silhouette, motion |
| Lantern Sparks | 130 gifts | reworked | Short marigold streaks that skip and bounce along the snow | motion, light |
| Gilt Groove | 180 gifts | reworked (was Gold Glints) | Each rut takes a thin gold edge that glitters and fades over two seconds: two lines, not specks | pattern, light |
| Paper Snow | 250 gifts | new (was Stardust (retired)) | Cut-paper snowflakes, palm-sized, that flutter and turn as they fall | silhouette, motion |
| Comet Tail | 340 gifts | reworked | Two long light streaks off the runner tails that hang a second and a half: a long exposure | silhouette, light |
| Petal Drift | 450 gifts | new | Cream and gold petals that spin flat and sail out sideways off the wake | silhouette, motion |
| Paper Streamers | 580 gifts | new | Strips of festival paper that tear off the stern and flap behind | silhouette, motion |
| Kite Tails | 750 gifts | new | Two strings of paper bows streaming three metres back off the stern | silhouette, motion |
| Lamp Moths | Almanac page 28 (never sold) | reworked | Three soft lights that loop round the rider and follow: the only trail that circles | motion, light |
| Banked Embers | Almanac page 46 (never sold) | reworked | Coals dropped in the groove every metre that glow for three seconds: a dotted line left on the snow | pattern, light |
| Keeper's Lantern | Almanac page 50 (never sold) | reworked | A paper lantern rides two metres behind on a line, its pool of light on the snow | silhouette, light, motion |

**Finishes** (11)

| Piece | Source | Against today | What tells it apart at race distance | Levers |
| --- | --- | --- | --- | --- |
| Natural | every rider | kept | Oiled wood: two browns and the grain | material |
| Pine Lacquer | 80 gifts | reworked | Deep green lacquer with a cream pinstripe round the deck's edge | material, pattern |
| Glacier Enamel | 110 gifts | reworked | A pale enamel: the one light sled under a dark rider, an ink pinstripe | pattern |
| Midnight Stars | 150 gifts | reworked | Navy with cream star specks across the tail | pattern |
| Plum Two-Tone | 200 gifts | reworked | Plum slats, cream rails and crest: a light frame round a dark deck | pattern |
| Burnt Scroll | 250 gifts | reworked (was Cocoa) | Dark stain with burnt-in scrolls down the slats' ends | material, pattern |
| Finish Chequer | 310 gifts | reworked (was Snowfield) | White with an ink chequer band across the tail: the finish line on your sled | pattern |
| Basalt Hex | 380 gifts | reworked (was Basalt) | Near black with a fine cream hex lattice | pattern, material |
| Twin Stripe | 480 gifts | new | Two broad cream stripes down the outer slats, ink between: a racing stripe either side of the rider | pattern |
| Gilt Scroll | 650 gifts | new | Ink lacquer, cream scrollwork along the rails and crest catching the rim light | material, pattern, light |
| Almanac Pages | Almanac page 38 (never sold) | reworked (was Almanac Dusk) | Cream deck ruled in ink lines like a page of the Almanac | pattern, material |

**Ornaments** (1)

| Piece | Source | Against today | What tells it apart at race distance | Levers |
| --- | --- | --- | --- | --- |
| Stern Lamp | every rider | new | A cream paper lamp with an ink cap: a small light over the tail | silhouette, light |

**Sounds** (5)

| Piece | Source | Against today | What tells it apart at race distance | Levers |
| --- | --- | --- | --- | --- |
| Steel Runners | every rider | kept | The hiss of steel on packed snow | - |
| Old Timber | 100 gifts | kept | Creaking boards, a wooden knock on landing | - |
| Sleigh Bells | 140 gifts | kept | Bells that ring with every turn | - |
| Glass Chime | 180 gifts | kept | Runners that sing like a rubbed glass | - |
| Lantern Song | 240 gifts | kept | A warm hum that brightens as the lantern fills | - |

**Sleds and their tracks** (each tier opened by stage lines on that sled, then fitted for gifts)

| Sled | Source | Signature | Runners (3 lines) | Deck (9 lines) | Crest (18 lines) | Stern lamp (30 lines) | Spirit inlay (45 lines) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pine Flyer | every rider | Pine Bow: Standing on the sled, a slow bow with both arms out | The runner tails run on and scroll up into two curls behind the seat (80) | A cream quilted pad over the seat slats, its stitched edge proud past the hips (150) | The bent-wood bow becomes a carved crest, a scalloped backboard twice its height (240) | A stern post with a paper lamp: cream paper, an ink cap, a warm heart that lights the snow behind (360) | Ink inlay down both runners and round the crest that burns with the scarf at Spirit Flow (520) |
| Whirl Saucer | Almanac page 5 (never sold) | Spinning Top: Sitting still and upright while the saucer spins flat under the rider | A chased steel skid ring under the rim, a bright line round the whole disc (80) | A cream quilted cushion in the dish, round the rider (150) | Six raised fins round the rim, a crown-like silhouette from behind (240) | A short mast at the back of the rim with a paper lamp (360) | An ink spiral inlaid in the dish that burns outward with the scarf at Spirit Flow (520) |
| Lodge Toboggan | 300 gifts | Fireside: Lying back along the toboggan, hands behind the head, boots up | Steel-shod runner strips along the underside, their ends curled up at the tail (90) | A cream blanket roll strapped across the deck behind the rider (170) | The nose curl carved into a scroll with a crest board at the tail (260) | A lantern on a bent-wood hoop over the tail (400) | Ink inlay along the slats that burns with the scarf at Spirit Flow (570) |
| Comet Bob | 600 gifts | Comet Tail: Let go and trailing behind the sled from one runner, body streamed out flat | Polished steel runners with a second, raised shoe at the tail (100) | Quilted cream backrest panels inside the sideboards (190) | A tall tail fin on the cowl's spine, the comet streaking up it (300) | Twin lamps on the push bars (450) | The cream comet inlaid in ink that burns from its head to its tail at Spirit Flow (650) |
| Wisp | 950 gifts | Will-o'-Wisp: Floating a hand above the sled, both hands off, arms loose like a drifting light | Runners drawn out into long thin curls at both ends (110) | A pale pad with three cream cords laced across it (210) | Two swept wings off the deck's sides behind the rider (340) | A hanging lamp on a long bent stalk that sways (500) | Ink filigree on the wings that burns with the scarf at Spirit Flow (730) |
| Tea Tray | 1,400 gifts | Teacup: Sitting cross-legged, turning the tray slowly with both hands | A raised gallery rail round the rim, pierced in a fretwork (130) | A cream embroidered cloth in the tray under the rider (240) | Two tall curled handles, fore and aft, the aft one a crest behind the rider (380) | A small lamp on the aft handle (580) | The chased ring and the fretwork inlaid in ink that burns at Spirit Flow (830) |

**The mountains' sets** (a third, two thirds and all of the mastery board; never sold)

| Mountain | Motif | Scarf | Trail | Ornament |
| --- | --- | --- | --- | --- |
| pinecrest | the fir bough and the White Stag | Fir Chevron: Cream chevrons pointing down each tail like fir boughs | Stag Prints: Hoofprints of light pressed beside the groove, in bounds, fading behind (the White Stag's own) | Cowbell: A big cream-and-ink bell on the stern post that swings and rings on landings |
| frostfang | the Fang and the crevasse ice | Fang Edge: Tails cut into a sawtooth hem, ink at the teeth | Frost Feathers: Fern-like frost growing out from the ruts in cream-gold, then melting | Ice Fang: A curved crystal tooth on the post that throws a glint |
| ember | the basalt pipes and the lava threads | Ash Market: Tails cut into flame tongues at the tips, charcoal ink bands above | Molten Cracks: Branching marigold cracks open in the snow behind and seal over | Basalt Crown: A cluster of three hex columns with a glowing seam |
| sakura | the torii, paper and cranes | Petal Hem: Scalloped edges down both tails, cream dots | Paper Cranes: Folded cranes that flap up off the wake in pairs: the only trail that climbs | Paper Crane: A cream folded crane on the post, its wings lifting with speed |
| lanternfall | the lamplighters' lanterns | Lamp Road: A long streamer with cream bars graded like a row of lamps | Sky Lanterns: Small paper lanterns lift off the stern every few seconds and rise into the sky | Great Lantern: A small storeyed lantern of lit paper on the post, the finale's own |
| the three new mountains | designed with each mountain once the owner has picked them | | | |

**The months' chapters** (scarf on page 3, trail on page 6, ornament on page 8; 260, 380 and 320 gifts on the shelf from their month)

| Month | Motif | Scarf | Trail | Ornament |
| --- | --- | --- | --- | --- |
| 1 First Light | the sunrise | Sunrise Bars: Cream bars widening toward the tips like rays | Dawn Fans: Little fans of light flicked off each carve | Sun Disc: A rayed cream disc on the post |
| 2 The Long Frost | the icicle | Icicle Fringe: A fringe of stiff cream points that do not splay | Icicle Chimes: Small icicles drop off the runners and shatter on the snow | Icicle Crown: A ring of hanging icicles round the post's head |
| 3 Thaw Lanterns | the lantern and the drip | Drip Hem: Tails with rounded drop-shaped ends | Drip Lights: Drops of light fall from the stern and splash in rings | Thaw Lantern: A tall narrow lantern with a dripping wax foot |
| 4 Blossom Run | the five-petalled blossom | Blossom Knit: Cream five-petal flowers knitted at the tips | Blossom Pops: Cream blossoms pop open on every landing and drift off | Blossom Sprig: A sprig of three cream blossoms on the post |
| 5 Ash and Ember | the flame tongue | Ember Knit: Ink-dipped tips with a cream flame band | Ember Tongues: Short flame-shaped tongues that lick up off the runners | Brazier: A small iron brazier on the post with a lit bed |
| 6 Midsummer Snow | the high sun | Midsummer Ribbons: Two long thin ribbons per tail, braided at the knot | Sun Motes: Round rayed suns that roll along the snow and fade | Sun Wheel: A spoked wheel of cream rays that turns with speed |
| 7 Night Market | the market string | Market Tassels: Short tails ending in heavy cream tassels | Market Ribbons: Ribbons of cream paper tied in bows tumble off | Lantern String: A short string of three tiny lanterns hung from the post |
| 8 Paper Cranes | the folded fan | Folded Fan: Tails pleated in fan folds that open as they stream | Folded Fans: Paper fans that flutter open and shut as they fall | Paper Fan: An open paper fan stood on the post |
| 9 Harvest Moon | the crescent | Crescent Knit: Ink crescents down the tails | Moon Slivers: Thin crescents of light that tumble end over end | Crescent Moon: A cream crescent on the post, horns up |
| 10 The Haunting | the hollow lantern | Hollow Stitch: Tails with open-work holes knitted through them | Hollow Lights: Round paper lanterns with cut eyes bob behind and wink out | Hollow Lantern: A round lantern with cut eyes, lit |
| 11 First Snow | the snowball | Snowball Tails: Tails ending in round cream snowballs that bounce | Snowballs: Little snowballs roll off the runners and burst | Snow Ball: A stacked pair of snowballs with a stick arm |
| 12 Lantern Night | the star | Star Knit: Cream stars knitted down the tails | Star Strings: Strings of small paper stars fluttering off the stern | Lantern Star: A cut-paper star lantern, lit |

**Today's near-duplicates, and what becomes of each**

| This | Nearly | Why | What becomes of it |
| --- | --- | --- | --- |
| Night Market Paint (chapter 7, #6B4A3A) | Cocoa (#6A4636) | Delta E 2.1: the same brown | Chapter paints leave: each chapter's third piece is an ornament in its month's motif |
| First Snow Paint (chapter 11, #D8DEE9) | Snowfield (#E9ECF5) | Delta E 5.3 | As above; Snowfield becomes Finish Chequer |
| The Long Frost Paint (chapter 2, #8FB4D9) | Glacier (#9FC4E8) | Delta E 5.9 | As above; Glacier becomes Glacier Enamel with an ink pinstripe |
| Ash and Ember Paint (chapter 5, #5A3B36) | Cocoa (#6A4636) | Delta E 8.9 (and 9.2 from Night Market) | As above; Cocoa becomes Burnt Scroll |
| The Haunting, Thaw Lanterns, Midsummer and First Light paints | Basalt, Almanac Dusk, Glacier, Pine | Delta E 9.4 to 10.7: hue-only steps a rider covers | As above |
| Midnight (#2A3570) | Almanac Dusk (#46507E) | Delta E 15 on a deck the rider hides | Midnight Stars (motif) and Almanac Pages (ruled cream): one dark, one light |
| Keeper's Lantern (Almanac 50) | Comet Tail | Both stream marigold motes off the runners (64 a second against 60, tint #FFEFC2 0.4 against #FFE6B3 0.35) | Keeper's Lantern becomes a paper lantern on a line behind the sled; Comet Tail two long light streaks |
| Banked Embers (Almanac 46) | Gold Glints | Both twinkle marigold specks low in the groove (36 a second against 34) | Banked Embers drops coals that stay and glow; Gold Glints becomes Gilt Groove, a gold edge on the ruts |
| Lamp Moths (Almanac 28) | Stardust | Both twinkle cream specks (30 against 48 a second) | Lamp Moths circle the rider; Stardust retires into Paper Snow |
| Honey Spray | Fresh Powder | A tint of the same spray: a hue, not an item | Honey Plume: a rooster tail twice as tall |
| The twelve chapter trails | Gold Glints or Comet Tail | Every one is marigold motes, twinkle or stream, over a near-white tint | Each month a trail of its own shape (fans, icicles, drops, blossoms ...) |
| Chapter scarves 5 and 11 | Classic Knit and Fringe Knit | tipStripes ignores the accent: the same knit at 1.1 length | Each month a scarf of its own form (sunrise bars, icicle fringe, drip hem ...) |
| Chapter scarves 6 and 12 | each other, and Long Streamer | plain ignores the accent | As above |
| Chapter scarves 2 and 8 | Chunky Rib | rib ignores the accent | As above |
| Chapter scarf 9 (tip, ink) | Almanac Knot (tip, ink) | The same pattern and accent, 0.1 longer | Almanac Knot becomes a bow at the throat |
| Classic Knit, Cream Bar, Ink Bands, Chunky Rib | each other | One structure, a stripe apart (to be judged at race distance) | Kept as the entry rung, reworked where the critic cannot tell them |

**Counts by shelf**

| Shelf | Free | Shop | Almanac | Sets | Chapters |
| --- | --- | --- | --- | --- | --- |
| hat | 1 | 11 | 0 | 0 | 0 |
| scarf | 1 | 9 | 2 | 8 | 12 |
| trail | 1 | 8 | 3 | 8 | 12 |
| finish | 1 | 9 | 1 | 0 | 0 |
| ornament | 1 | 0 | 0 | 8 | 12 |
| sound | 1 | 4 | 0 | 0 | 0 |
| sled | 1 | 4 | 1 | 0 | 0 |
| track | 0 | 30 | 0 | 0 | 0 |

## 4. A first frame of the garage as a place

**The frames** (`shots/r9/garage/scene/`): `desk-home.png` (High, the Sled shelf: the rider on the stand, the track's
five tiers, the signature trick named, the sleds in the strip), `desk-home-noui.png`, `desk-hat-back.png`,
`desk-hat-front.png` and `desk-hat-back-muffs.png` (a hat close, from behind and in front), `desk-paint.png` (a finish on
your own sled), `desk-trail.png` (the rider out on the yard's loop, Kite Tails behind), `desk-chase.png` (the chase
lens's own view, for a scarf), `desk-buy-open.png` and `desk-buy-end.png` (the buy moment), `desk-low-home.png` (Low),
`phone-home.png` and `phone-hat-back.png` (a phone held upright, its designed cheaper version), `phone-home-high.png`.

**What it is.** A sled-maker's workshop in the finish town at dusk (Pinecrest's other hour): timber boards and posts,
your rider on your sled on a trestle stand with cream cradles over a round rug, the hats on wooden head blocks on two
shelves, the bench with the finishes' tins and the tools, the scarves on a rail, a stove, the Lantern Row from the
rafters (five lit in the frame), a hanging lamp over the stand, and the big door open on the yard: snow, pines, a far
ridge, the dusk sky, and a groomed loop where the rider rides out to show a trail. Built from the game's own Rider (the
live rig, its scarf on its chain, its cheer cue), meshes.ts's sleds, hats and pines, materials.ts's toon material and
shared light (applyPalette of Pinecrest at Dusk), lights.ts's local lights (the lamp, the stove, the lanterns), and a
directional light's shadow map on High. The UI over it is built on the round's tokens (the screens lane's
`prototypes/r9/tokens.css`, linked by path; garage.css carries a fallback for every name it reads).

**What it costs to open** (the dev server, the browser warm, `scripts/playtest/r9-garage-scene.js`; never a frame-rate
figure, which only the main lane's quiet sittings give):

| | High, desk 1280 x 720 | Low, desk | Low, phone 390 x 844 at 2x |
| --- | --- | --- | --- |
| Module import (unbundled dev modules; one chunk in a build) | 330 to 860 ms | 840 ms | 120 to 240 ms |
| Build (room, props, hat wall, yard, rider) | 140 to 270 ms | 165 ms | 100 to 120 ms |
| First frame | 86 to 121 ms warm | 1.55 s cold | 67 ms warm, 1.55 s cold |
| Open to first frame | 0.78 to 1.24 s | 2.7 s cold | 0.35 s warm, 2.0 s cold |
| Draw calls | 23 to 34 (46 with Kite Tails, whose bows want instancing) | 18 | 14 to 20 |
| Triangles | 65,000 to 99,000 | 26,000 | 17,000 to 26,000 |
| Geometries, textures, programs | 14 to 22, 4, 6 to 9 | 17, 2, 7 | 13 to 19, 2, 5 to 7 |

The cold first frame is the shader compile of programs the page had not built yet (Low's variants, after a warm-up on
High). In the game they are the run's own (the toon material, the rider's), compiled long before the garage is opened,
so a garage opened from the title pays the warm figure. GPU memory: High's 2,048 shadow map (about 16 MB) and a few MB of
buffers; the page's whole JS heap 35 to 90 MB with three.js.

**How it stays off the first frame.** In milestone 2 the scene is a module the garage button imports on demand
(`import('./render/garagescene')`): nothing of it is in the first download or the boot path. It draws with the game's
own renderer and pipeline (no second WebGL context), the title's world render pauses while it is open, and it is
disposed on close. A prefetch on idle once the title has drawn is the option if the first open is felt as slow.

**Why a live scene answers DECISIONS 262.** 262 rejected rendering each hat and scarf with the portrait renderer: a
render and a read-back per item, and a second camera angle for the back of the head, against drawings that are
instant. A live scene has one rider and one camera that moves, and puts a piece on with the rider's own setter (setHat
rebuilds one head geometry, setScarf repaints the knit, a finish repaints a copy of the sled's colours: milliseconds),
so trying ten hats is ten geometry swaps and no render target, and the back of the head is the camera turning round.
The tiles keep words (and may keep garageart's drawings), so nothing is rendered per item.

**Low and the phone get a designed cheaper version, never a broken High:** no shadow map (the rug and the stand's feet
carry the contact), the rider's Low build (setDetail('lite')), one shelf of hat blocks, half the pines, no drifts by the
door, no MSAA and a pixel ratio of 1 (a phone may take 1.5); the same room, light, rider and camera moves. On a phone held
upright the camera stands back so the rider holds the top half, the shelf is a sheet over the thumbs' band (the card,
then the strip), and the tabs scroll sideways.

**Still short** (seen in the frames): the Watch button plays nothing yet (the trick's loop is milestone 2's: the rider's
own trick pose on the stand); the lanterns' light is local light only (no bloom on this page); the Sounds shelf has no
sound; the tiles are words only.

## 5. The buy moment (G4) and upgrades showing (G2)

**A purchase is a gift opened.** Built as a sketch in the page (scene.ts buyMoment, page.ts purchase), on Buy:

1. The gifts leave the wallet at once (the figure ticks down; nothing waits on the moment).
2. A gift drops onto the rug beside the stand, the gifts' own box (ART.md 13: marigold in two tones, a cream bow),
   squashes as it lands (0 to 0.55 s), its lid lifts and tumbles away and paper flies out in the warm family (0.6 to
   1.1 s).
3. At 0.9 s the piece goes on the rider, by the same setter that tried it on: a hat, a scarf, a finish on the sled, a
   trail (the rider then rides out to the yard's loop to show it).
4. The rider shows it off: the rig's own cheer cue (rider.ts 'cheer', both arms up), and the camera eases to the
   shelf's shot of the piece (the hat from behind, the finish from the side).
5. Its sound: paper torn, then two soft bells a fifth apart (made in the page with WebAudio as a placeholder; the audio
   lane owns the real one, and each shelf's piece plays its own after: a sled sound plays its runners).
6. One line, once: the piece's name and "Yours, and on", for 2.4 s.

Skippable: any tap or key during it jumps to its end (the piece on, the cheer, the line). Reduced motion: no drop, no
lid, no paper and no camera move; the piece goes on, the rider cheers in place (the rig's cue respects reduced motion as
in a run) and the line shows. Two seconds in all; a second purchase starts its own.

**An upgrade tier landing gets the same moment**, with the tier itself as the gift: the stand's cradles lift the sled a
hand, the part is fitted (the crest rises from the deck, the lamp is hung and lit, the inlay burns once along its
lines), the cheer, the tier's own sound (a mallet's two knocks for wood, a chime for the lamp, a breath of flame for
the inlay), and one line ("Your Pine Flyer has its lamp").

**Stock against upgraded at race distance:** the tiers are designed for the chase lens's view of a sled, its tail. The
sleds sheet shows the stock Pine Flyer, two tiers, four, five, and five at Spirit Flow: the critic told all five apart
and ranked them by how built-up they are; only the stock sled against runners-and-deck needed a second look. The
fourth tier is the line between stock and upgraded at a glance (the crest and the lamp over the tail).

## 6. Section 1 "The garage", line by line

What is strong:

| Line | Verdict | Where |
| --- | --- | --- |
| Six sleds, each with its own silhouette | Right | meshes.ts sledGeometryFor cases 0 to 5 |
| ... a real-mesh preview | Right, with a hole: the preview never shows your paint | portrait.ts sledPortrait 106 to 108: the look is a hat and a scarf, the cache key has no paint, the sled is built without paintSled |
| ... and a signature trick | Right in the sim, wrong in the garage: it is named nowhere there | sim/tricks.ts SIGNATURE; `grep -i signature src/ui/menus.ts src/ui/garageart.ts` finds nothing |
| Seven hats with distinct shapes | Half right: at race distance the critic could not tell the Pom Beanie from the Watch Cap, needed effort for the Chullo against the Watch Cap, read the Bobble Crown as a crown (The Twelve's) and the Twin Pom as fox ears | meshes.ts playerHat; sheet/hats.png tiles 1, 3, 8, 10, 11 |
| A clear Buy-then-Confirm | Right | menus.ts 661 and 837 (Buy arms, Confirm spends) |
| Nothing bought wins a race | Right, and kept | tests/garage.test.ts; sleds are sidegrades the sim rides, paid for in kind (sim/sleds.ts) |

What holds it back:

1. **Nothing to aim for.** Right. No upgrade code exists. The base garage costs 6,270 (confirmed by shelf). The
   income figures are DECISIONS 371's on round 8's build; today's build measures mid 805, 4,655 and 9,530 at runs 5, 20
   and 50 (16,595 at 100). "Buys it out by about run 25": lifetime covers it at run 28; a garage-first player owns it
   at run 31, the novice at 59; the harness's cheapest-first spender never does (it lights lanterns first and leaves the
   Wisp and Tea Tray unbought at run 100). "The dearest cosmetic, 240 gifts": wrong by the chapters: the month's trail
   is 380 and a lantern up to 675. "Only the Tea Tray and the 40 lanterns": right, plus the month's set (960).
2. **The items look alike.** Right throughout, and it missed more:
   - Hats all vermillion and cream: right, by design (ART.md 5), and kept: the proposal varies silhouette and material.
   - Scarves one ribbon in length, width and stripe: right (two tails, one form); "three patterns ignore the accent":
     right (rider.ts paintScarf: tipStripes, rib and plain never read `accent`).
   - The burn paints over the pattern at full flow: right, rider.ts 1090 to 1095 lerps every stitch toward one flame
     colour, wholly past 85% of the tail, where every pattern sits (tip stripes at 69% and 88%, bars 63% to 88%, cream
     tips past 88%). Frame: sheet/burn.png, where the critic saw no pattern in either of today's burning scarves and a
     clear one in the burn that keeps each stitch's value (tile 4, Ink Bands); and today's flame glow spreads over the
     coat's back, which ART.md 8 rules out.
   - Trails pale spray with warm specks in one of three motions: right (garage.ts TrailDef, particles.ts trailMotes).
   - Paint one flat hex: right (meshes.ts paintSled).
   - Four chapter paints nearly repeat shop paints: understated. Measured (CIE76): Night Market against Cocoa 2.1, First
     Snow against Snowfield 5.3, The Long Frost against Glacier 5.9, Ash and Ember against Cocoa 8.9, and four more
     under 11 (The Haunting, Thaw Lanterns, Midsummer Snow, First Light): eight of twelve.
   - Keeper's Lantern nearly Comet Tail: right (stream, the same marigold, 64 motes a second against 60). Missed:
     Banked Embers is Gold Glints (twinkle, 36 against 34), Lamp Moths is Stardust (twinkle cream), every one of the
     twelve chapter trails is Gold Glints or Comet Tail in another near-white tint, chapter scarves 5 and 11 are the
     Classic and Fringe knits (tipStripes ignores their accent), 6 and 12 are plain, 2 and 8 are the Chunky Rib's rib,
     and chapter 9's is the Almanac Knot (tip, ink). catalogue.ts NEAR_DUPLICATES lists each and its fate.
3. **You cannot see what you are buying.** Right: only Sleds has a 3D preview (without your paint); the rest are
   garageart.ts drawings, hats from behind; trails a strip of dots (trailArt); paint on one generic plank whatever your
   sled (garageart.ts paintArt takes a hex and no sled).
4. **Little of it reads in a run.** Right, and measured: the rider is 116 to 166 px of a 720 px frame (a seventh to a
   quarter) and the head with its hat 35 to 45 px in the sheets' frames. Four of today's six trails were one trail to the
   critic at a glance, two of today's seven hats were one hat, and Plum paint was read as a different sled.
5. **Buying is a toast.** Right: app.ts paint, garage and buySled play `audio.ui('unlock')` and `ui.toast`. The
   signature trick named nowhere: right (above).
6. **A dialog, not a place; the Lanterns tab leaves half the sheet empty.** Right (shots/r9/review/desk-40-garage-7).
   Missed: the Lanterns tab has a vermillion primary on every town (two at once in the frame, five with every mountain
   open), against "one thing to press".
7. **The Almanac and the shop overlap; page 5's sled gives nothing, silently.** Right that it gives nothing, wrong
   that it is silent: rank.ts 207 skips an owned sled, and 313 to 315 still push the card under `rewardName`, so the
   results say "A new sled". Missed: the same holds for a chapter piece bought before its page (grant 210 to 216 skips
   an owned piece; the card still names it). "Ready in the shop has no way into the shop": right, results.ts 1353 is a
   span with no action. (In these careers neither pilot bought the Saucer before page 5; a real player at 120 gifts
   on run 2 would.)

What it missed, besides the above:
- The hats shelf is the only one the Almanac and the chapters never add to, and the hat is the piece most seen in a
  run.
- A sound cannot be heard before it is bought (DECISIONS 262 left the listen button out).
- Paint goes on every sled the same way, Comet Bob's own violet lacquer included.

## 7. What milestone 2 would build

In this order, each green before the next (tsc, the touched tests, the console clean, the critic on frames):

1. **The model, in the game layer** (`src/game/garage.ts`, `paints.ts` into finishes, a `tracks.ts`, `almanac.ts`,
   `rank.ts`, `save.ts`, `app.ts`). Shelves and prices from catalogue.ts; the save's new optional fields (`tracks?:
   Record<sled, { lines: number; fitted: number }>`, `ornament?`), read by sanitising readers like `readTwelve`; the
   stage lines a run crossed credited to the ridden sled's track in the results' settle (game layer, after the sim:
   nothing reaches `src/sim` or `src/bot`, and tests/garage.test.ts still says so); rank.ts grant never silent; the
   Whirl Saucer moved to the Almanac with an owned save's fallback; the chapters' designed sets. Migration: today's
   paints keep their ids as finishes; every owned piece kept. Risk: low; tests/garage.test.ts, migration.test.ts and
   rank.test.ts extended.
2. **The looks, in render** (`meshes.ts`: the new hats in playerHat, each sled's five tiers and its ornament post,
   finishes as patterns per sled; `rider.ts`: four tails, weighted ends and the cape as scarf forms, the burn that keeps
   the knit; a new `render/trails.ts` for shaped trails beside particles.ts's motes; `world.ts` setTrail). Every
   tier's Low build is a lite one (as the sled's). Risk: medium. rider.ts's scarf is a hot path (the verlet chain and
   its stencil, the flame over it); four tails double its rows; the cape covers the hood's horseshoe (decision 4); the
   trails need a budget on Low and the phone.
3. **The place** (`src/render/garagescene.ts` from scene.ts, imported on demand by the garage button; `src/ui/garage.ts`
   over it in the round's tokens, replacing menus.ts's garage sheet). One renderer: the game's, with its pipeline, the
   title's world paused while the garage is open, the scene disposed on close. Tiles keep words; a tile's picture is
   the garageart drawing or a portrait rendered on idle after the scene's first frame. Risk: medium (memory on a phone,
   the first-open time, keyboard and pad focus through a 3D place).
4. **The buy moment and the upgrade moment** (the scene, the rider's cheer cue, a sound from the audio lane for a gift
   opened and one per shelf). Risk: low.
5. **The way in**: the results' "Ready in the shop" becomes a button to the garage at that sled. Risk: low.
6. **Sets**, after the mountains: each new mountain's set designed with it. Risk: low; it waits on milestone 3.

## 8. What the main lane must decide

1. **Tracks: riding and gifts both** (recommended), or either alone. Riding alone makes gifts worthless again after the
   shop; gifts alone sells a sled's history in one tap.
2. **The Whirl Saucer leaves the shop** and is only the Almanac's (page 5, about run 5 for the mid pilot, run 5 to 6 for
   the novice), so the page is never empty; a save that bought it gets its first two tiers fitted instead.
3. **A chapter's third piece is an ornament, not a paint** (decision 3's "set on the shelf" kept, three pieces a month),
   and a chapter page whose piece was bought pays its price back.
4. **The Wanderer's Cape covers the hood's cream horseshoe**, which ART.md 5 calls the one big shape the chase lens sees
   of the coat. Keep it as the scarf shelf's showpiece (it is the one scarf a critic cannot miss) or cut it.
5. **Marks on the snow.** Stag Prints (Pinecrest's set), Gilt Groove and Banked Embers leave light in or beside the ruts.
   ART.md 4 allows one painted line (your best's); the White Stag's own hoofprints of light are the precedent. Allow
   trail marks that fade within three seconds and are light, not paint, or keep trails in the air.
6. **How deep the economy goes.** The proposal leaves the mid pilot 24 goals (9,560 gifts) at run 100 and the novice 45;
   the novice owns 6 of 12 hats at run 100. Prices are one table (catalogue.ts); the bar is met with room either way.
7. **One new slot, no new shelf:** the ornament on the stern post (sets, chapters and the Almanac fill it, never the
   shop). A finish-line pose was weighed and left out: it reads at the line, which the results own.
8. **The Lantern Row moves into the place** (its rafters and the finish towns), and its tab goes.
9. **The owner's decision 2** (colour roles locked) is assumed: every proposal differs by silhouette, material, pattern,
   motion or light.
10. **Text for DECISIONS and ART.md** (the main lane's to write): the model (section 1), the economy table (section 2),
    ART.md 5's hats list (twelve outlines), scarf forms (two tails, four tails, weighted ends, a cape, a bow), the burn
    that keeps the knit's value, trails as shapes and behaviours, finishes as finish and motif, the track's five tiers and
    the ornament post, and the garage as a place (section 4).
