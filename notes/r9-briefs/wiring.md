You are the `wiring` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; a deterministic sim in `src/sim`, `SIM_VERSION` 10; the art direction is "Alpenglow
Gouache", ART.md). Your job is **milestone 3's M3: the three new mountains wired everywhere, or a reason why not.**
The Old Run (DECISIONS 397), Gullhaven (400) and Gablefall (402) are built, registered and merged: the game has eight
mountains, the Long Night sixteen legs, the Trials eight from a placeholder week. What each lane left unwired is yours.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-wiring` on branch
`r9-wiring`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite, lab
sweep, build and pool; one browser at a time through the slot; CRLF; the trailer; shared files; no edits to DECISIONS,
README, ART, ASSETS or LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/wiring/`; your
port 5030). Then read: the round brief `prompts/round-9-clear-screens-a-garage-worth-it.md` (milestone 3, M3 above all,
and sections 3, 6 and 8); DECISIONS 392, 394, 397, 400, 401 and 402 (each "carried to phase C" and each main-lane
call); ART.md 10 and 15; and in each mountain lane's notes, the "Wired for the mountain, and what waits" section and
"what I would add to the Almanac, the album and The Twelve" (`notes/r9-oldrun.md`, `notes/r9-gullhaven.md`,
`notes/r9-gablefall.md`, and their world notes for each other hour and mirror as drawn).

## The list

1. **Each new mountain's other hour and mirror, open to a player** (DECISIONS 397's call, for all three): its hour on
   an Almanac page of its own (the Old Run's by Lamplight, Gullhaven's at Moonrise, Gablefall's at Evensong; each is
   drawn, none has a way in), and its mirror opened when its three home riders are beaten to the line. The Almanac is
   fifty Rider Ranks, a rank a row with its prizes in words (`src/game/almanac.ts`): place the three hours where a page
   holds only gifts or a charm, or say why another place is better. Never empty a page, and give no silent grant
   (`rank.ts`): a save already past the page gets the hour once, told as the round tells a prize. Say what a mid-5,
   mid-50 and mid-100 save each sees. The mirror's opening is new: find where a mirror is opened today
   (`mirrorOpen`), add the home riders' way beside the Almanac's without changing the five's, and say it in the
   game's words where a player would look (the mountain's board, the hour's pair on the title).
2. **The Old Run's grade** (DECISIONS 397): `BIOME_PARAMS.oldrun.slope` goes from 0.17 to the track's 0.28, which
   moves a get-up's push and some far reads. Generate its pool again (`generate-ghosts --only oldrun`, alone in the
   heavy slot, node workers capped), lay its first run again after the pool (`FIRST_RUN_PACE`), ride its lab's bar again
   (`scripts/r9/oldrun-lab.ts` or as its notes run it), and say every figure before and after. The five's fingerprint
   holds.
3. **The album:** each new mountain's page and stickers, as the five's are (the lanes' lists: the Great Geo at sunset
   from the column, the lighthouse's beam; the Old Run's and Gablefall's as their notes say). The album's count moves:
   say the old and new count, and that a save keeps every sticker it holds.
4. **Missions:** each mission that names a mountain or a biome, and whether the three should have their own (a
   mission on a mountain a player has not opened must never be offered). If none should, say why.
5. **The title's key art on Gablefall** follows the reel's ghost; on novice-5 it rides the street and a house front
   fills a third of the frame. Make the reel prefer a roof rider there (or the shot follow the roofs), and look at all
   eight mountains' key art on a desk and a phone at mid-1, mid-50 and mid-100.
6. **The Twelve** stay twelve and never duel on a new mountain (DECISIONS 394). Check that nothing in The Twelve's
   ladder, the league or the Daily and Cup (the three stay out of `BIOMES`, so off every Daily and Cup course) reaches
   a new mountain where it should not, and say so.
7. **Photo mode and Save Clip** on each of the three (the lanes opened them on theirs): open each once more on the
   merged build.

## The gate, every commit

`tests/five.test.ts` holds (the five's and the Dailies' courses, the rolls and every ride byte for byte); every pool's
replays hold (`tests/ghostpool.test.ts`), the Old Run's regenerated; the fairness suite's `EVERY` promises and each
mountain's own hold. Nothing on the five changes. If something shared would have to change, stop and say so.

## Not yours

The mountains' courses and worlds beyond their hours' and mirrors' ways in; the garage; the screens' styles (the
`polish` lane works on the title, results, rooms and books beside you: touch a screen only to add a row, a page or a
line your list needs, in its own function, and list the hunk).

## Deliver

Commits on `r9-wiring` (`tsc` clean and the full suite green in the heavy slot before your last commit);
`notes/r9-wiring.md` with each item before and after, what each fixture save sees, the Old Run's figures before and
after, every hunk in a shared file, the text for ART.md and DECISIONS, what only scripts have seen, and what the main
lane must decide. Frames under `shots/r9/wiring/`. Screens you touch are looked at under playwright on a desk and a
phone with the console read. Stop your server and close your browser at the end. Your final message: each item, the
Old Run's figures, and what the main lane must decide.
