You are the `shop` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is **milestone 2's G1 to G5:
build the garage the owner approved, as a place, with upgrades worth chasing, cosmetics that differ, a moment for
every purchase, and the economy.** The owner's words: the garage is underwhelming; it should be beautiful, intuitive
and exciting to upgrade through as you play; the cosmetics need more variety, need to differ from each other more,
and need to be worth investing in.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-shop` on branch
`r9-shop`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (one browser on the machine, through the
slot; the heavy slot; CRLF; the trailer; shared files; no edits to DECISIONS, README or ART; frames under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/`; your port 4960). Then read DECISIONS 262, 263, 371 and
388 to 393 (the decisions are made: build them), the brief `prompts/round-9-clear-screens-a-garage-worth-it.md`
(section 2 "The garage", section 4 milestone 2, sections 5 and 6), ART.md all of it (sections 1, 4, 5, 8 and 13
closely), and milestone 0's design: `notes/r9-garage.md` all of it (the model, the economy, every item with its
trait, the place and its cost, the buy moment, section 7's build order and risks, section 8) and its prototype
(`prototypes/r9/garage/catalogue.ts`, `items.ts`, `scene.ts`, `page.ts`, `economy.ts`; open
`prototypes/r9/garage.html` on your dev server). `src/ui/tokens.css` is already in the game.

The decisions you build to (DECISIONS 392 and 393): tracks are opened by riding that sled and fitted for gifts, and
never touch handling; the Whirl Saucer is the Almanac's only (a save that bought it gets its first two tiers); a
chapter's third piece is an ornament; the Wanderer's Cape is cut; trails stay in the air (no marks on the snow); the
economy as proposed (prices one table); the Lantern Row moves into the place and its tab goes; colour roles locked.

## What to build, in this order (each green before the next: tsc, the touched tests, the console clean)

1. **The pieces' second pass, judged before anything is built.** `notes/r9-garage.md` section 3's six points, worst
   first: no navy finishes (the coat owns ink navy); tiers that take the finish; trails in the air; lights that glow;
   the five weak hats reworked or cut (Crest Knit, Pom Beanie and Watch Cap read as one; the Bobble Crown as The
   Twelve's crown; Twin Pom as fox ears); scarf forms big enough to read (Pom Tails, Chunky Rib and Classic Knit read
   as one). Today's near-duplicates go (`catalogue.ts` `NEAR_DUPLICATES`). Re-shoot the race-distance sheets
   (`scripts/playtest/r9-garage-sheet.js`: the live rider at High, the chase camera's size) and give them to a fresh
   critic (`model: "opus"`, `effort: "xhigh"`, only ART.md and the frames): can it tell every pair on a shelf apart,
   and name what the rider wears in a chase still? The bar is every pair. Fix and re-judge until it holds or say
   which pairs still fail and cut them.
2. **The model, in the game layer** (`src/game/garage.ts`, `paints.ts` into finishes, a new `tracks.ts`,
   `almanac.ts`, `rank.ts`, `save.ts`, `app.ts`'s garage functions): the shelves and prices from the catalogue; each
   sled's five tiers opened by the stage lines a run crossed on it (credited in the game layer after the run settles:
   nothing reaches `src/sim` or `src/bot`, and `tests/garage.test.ts` still finds no garage code there); the ornament
   slot; the mountains' sets earned at a third, two thirds and all of each mastery board (the five's now; the three
   new mountains' sets come later); the chapters' pieces designed as their month; the Almanac's rewards things the
   shop never sells, and **no page ever empty or silent** (`rank.ts` 207 and 313 to 315; a chapter piece bought
   before its page pays its price back, and the card says so). Migration: today's paints keep their ids as finishes,
   every owned piece is kept, an old save always loads (`tests/migration.test.ts`, `garage.test.ts`, `rank.test.ts`
   extended).
3. **The looks, in render** (`src/render/meshes.ts`: the hats, each sled's five tiers and its ornament post,
   finishes per sled; `rider.ts`: the scarf forms and the burn that keeps the knit's value, with the flame's glow off
   the coat (ART.md 8); a new `src/render/trails.ts` for shaped trails beside `particles.ts`'s motes; `world.ts`
   `setTrail`). Every tier and piece has a Low version designed to be cheap, never a broken High. `rider.ts`'s scarf
   is a hot path: measure a held run's GL calls on Low before and after (the round 8 way), and say the cost.
4. **The place (G1)**: `src/render/garagescene.ts` (from the prototype's `scene.ts`) loaded by `import()` when the
   garage opens, drawn by the game's own renderer and pipeline, the title's world paused while it is open, disposed
   on close; `src/ui/garage.ts` over it in the tokens, replacing `menus.ts`'s garage sheet (touch only the garage's
   part of `menus.ts`). The camera follows what you browse: a hat close from the front and behind, a finish on your
   own sled, a trail behind the sled on the yard's loop, a sound as it plays (a sound can be heard before it is
   bought). Everything is tried on before it is bought. The Lantern Row hangs in the rafters. Each sled's signature
   trick is named on its card with a short loop. Keyboard, pad and touch reach everything; Escape and B close it and
   focus returns to the door that opened it; reduced motion respected. Low and the phone get the designed cheaper
   scene. Measure what it costs to open (time to the first frame, memory, draw calls) on High, Low and the phone;
   nothing of it is in the first download.
5. **The moment (G4)**: a purchase is a gift opened in the scene; the piece goes on, the rider shows it off, a sound
   of its own (procedural, through the game's audio); skippable; reduced motion respected. A tier landing gets the
   same. The results' "Ready in the shop" (the `ui` lane makes it a button calling the app's path to the garage)
   opens your garage at that piece: make that path take a piece.
6. **The economy (G5)**: re-run `scripts/playtest/r9-garage-economy.ts` (heavy slot) on the real catalogue and save
   code, and give the table at runs 1, 5, 20, 50 and 100 for the mid pilot and the novice in your notes for
   DECISIONS. G6 (sets for the new mountains) is a later lane's.

## The bars

Section 2 "The garage": every item seen on your own rider and sled in 3D before it is bought; every pair on a shelf
told apart at race distance by a fresh critic, and what the rider wears named from a chase still by a second; in the
economy table something worth having always one to three runs away, garage goals that are not lanterns at runs 50
and 100, the dearest pieces a dedicated player's weeks; a moment for every purchase and tier, skippable; a stock and
an upgraded sled told apart in a chase still by a critic; no edge (`tests/garage.test.ts`). Look at every frame
yourself, desk and phone, the console read; run the web-design-guidelines skill over the garage's UI files.

## Not yours

`src/sim`, `src/bot`, `src/data/ghosts`; `src/ui/title.ts`, `results.ts` and the title's and results' CSS (the `ui`
lane's); `menus.ts` beyond the garage's sheet; the HUD.

## Deliver

Commits on `r9-shop`; `notes/r9-shop.md` with what changed for a player, every item (shelf, name, trait at race
distance, price or source, Low's version), the critics' answers, the economy table, the place's cost on each tier,
the Low run's GL calls before and after, every hunk in a shared file, the text for DECISIONS and ART.md 5 and 13, what
only scripts have seen, and what the main lane must decide. Frames under `shots/r9/shop/`. The full suite green in the
heavy slot before your last commit. Stop your server and close your browser at the end. Your final message: what a
player now finds in the garage, the critics' results, the economy table, the costs, and what the main lane must
decide.
