You are the `garage` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is milestone 0's second design
for the owner: **the garage's model, every item, the economy table, and a first frame of the garage as a place.** The
owner's words: the garage is underwhelming; it should be beautiful, intuitive and exciting to upgrade through as you
play; the cosmetics need more variety, need to differ from each other more, and need to be worth investing in.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-garage` on branch
`r9-garage`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (one browser on the machine, through the
slot; the heavy slot for career runs; CRLF; the trailer; no edits to DECISIONS, README or ART; frames under
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/garage/`; your port 4940). Then read the brief
`prompts/round-9-clear-screens-a-garage-worth-it.md` (all; section 1 "The garage", section 2 "The garage", section 4
milestone 0's item 2 and milestone 2 G1 to G6, section 6 and section 8's decisions 2, 3 and 9 closely), ART.md all of it
(section 1's roles are locked; section 5 is the rider and the garage's colour rules: the hat and scarf are vermillion
with at most cream or ink; trails stay in the lantern's warm family; section 13's sled paints), DECISIONS 262 and 263
(the shop and its saves), 371 (the spine's economy: the mid pilot's lifetime gifts 140, 875, 4,495, 10,145 and 17,260 at
runs 1, 5, 20, 50 and 100), `notes/r8-spine-design.md`, and the garage's code: `src/game/garage.ts`, `paints.ts`,
`rank.ts`, `almanac.ts`, `src/ui/menus.ts`, `garageart.ts`, `src/render/rider.ts` (the hats, scarves and sleds; the
scarf's patterns and the Spirit Flow burn at about lines 1033 to 1095), `src/render/portrait.ts`, the trails and the
sounds, and `tests/garage.test.ts` (no garage code in `src/sim` or `src/bot`).

## The items

1. **The model.** What an upgrade is (each sled's track of visible tiers: runners, deck, trim, a lamp or ornament, a
   spirit trim that lights at Spirit Flow; earned by riding that sled, bought with gifts, or both: your design, never
   touching handling); what a shelf holds; how sets work (one per mountain, earned by mastering it, the three new
   mountains included; the monthly chapters' pieces looking like their month); the Almanac's rewards as things the shop
   never sells, with no page ever empty because you own it (today page 5's sled gives nothing if you bought it,
   `rank.ts` about line 207: check it); what the Lanterns shelf becomes; the signature trick named on each sled's card
   and shown in a short loop. Gifts stay the one currency: no second currency, no loot box, no timer that gates play.
2. **The price curve and the economy table** at runs 1, 5, 20, 50 and 100 for the novice and the mid pilot, from the
   career harness (`scripts/playtest/r8career.ts`, `r8-bars.ts`; heavy slot) with a spender that buys by your rules:
   at each point what the player owns, what is one to three runs away, and what they are saving for. Section 2's bar:
   something worth having always one to three runs away; at runs 50 and 100 garage goals that are not lanterns; the
   dearest pieces a dedicated player's weeks, not a session. Today's table first (the base garage costs 6,270 gifts and
   the mid pilot buys it out by about run 25: check it), then yours.
3. **Every item, listed,** with what makes it distinct at race distance (the chase camera, the rider about a fifth of
   the frame and seen from behind; a hat about a fifteenth): hats by silhouette and material from behind at speed;
   scarves as more than one ribbon (double, cape, tasselled, lantern-weighted) with a pattern that survives Spirit
   Flow's burn; trails as shapes and behaviours (ribbons, prints, petals, sparks, paper), not specks; paint as finishes
   and motifs, not a flat hex; a new shelf only if it reads in a run. Colour roles stay locked (decision 2's default),
   so variety comes from silhouette, material, pattern, motion and light, never a new hue: if the only difference is a
   hue it is not an item. Name today's near-duplicates (four chapter paints nearly repeat shop paints; Keeper's Lantern
   nearly Comet Tail; check others) and what becomes of each. Prove distinctness where you can now: a few of today's
   items and a few of your proposals rendered at the chase camera's size in a run (the real rider, `?debug` switches or
   a dev-only page) in one sheet, for a critic.
4. **A first frame of the garage as a place.** An engine-rendered scene, loaded only when opened: your rider on your
   sled on a stand in a workshop that fits the fiction, with the camera ready to follow what you browse (a hat close
   from front and behind, paint on your own sled, a trail behind a sled riding a short loop of snow). For milestone 0 a
   first frame, not the feature: a dev-only page or switch that builds the scene with the game's own rider, sled and
   materials and shoots it on High and on the phone, with your UI over it in the round's tokens (the screens lane
   writes `prototypes/r9/tokens.css` in its worktree; use it when it lands, read it from
   `C:/Users/roger/OneDrive/Desktop/Ghost Sled/.claude/worktrees/r9-screens/prototypes/r9/`). Say what Low and the
   phone get (a designed cheaper version, never a broken High), what it costs to open (time, memory, draw calls), and
   how it stays off the first frame. DECISIONS 262 rejected rendering each item with the portrait renderer (a render
   per item and a second camera): read why, and either solve it or say why a live scene avoids it.
5. **The buy moment (G4) and upgrades showing (G2), designed:** a purchase is a gift opened; the piece goes on in the
   scene, the rider shows it off, it has its own sound; skippable; reduced motion respected; an upgrade tier landing
   gets the same. How a stock and an upgraded sled are told apart in a chase-camera still.
6. **Check section 1 "The garage" line by line:** what is right, what is wrong, what it missed, with the code line or
   frame for each.

## Deliver

Commits on `r9-garage` (the scene prototype and scripts only; nothing a player sees changes); `notes/r9-garage.md` with
the model, the full item list (today's and proposed, each with its distinguishing trait at race distance and its price
or source), the economy table today and proposed, the garage's first frame and its cost, the buy moment, the
line-by-line check, and what milestone 2 would build (files, order, risk). A page `prototypes/r9/garage.html` the owner
can open on the dev server showing the first frame, the item sheets and the economy. Frames under `shots/r9/garage/`.
Before you finish, give a fresh critic (`model: "opus"`, `effort: "xhigh"`, only ART.md and the frames) your race-
distance sheet and ask it to tell each pair on a shelf apart and to name what the rider wears; record its answers.
Stop your server and close your browser at the end. Your final message: the model in a few lines, the economy table,
the item count by shelf with the distinctness the critic found, the first frame's path, and what the main lane must
decide.
