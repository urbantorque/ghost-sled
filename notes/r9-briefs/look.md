You are the `look` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is **milestone 4's feel pass on
the three new mountains' worlds, and M4's look: the faults their lanes and critics left, fixed worst first, then each
mountain's critic loop brought to five passes, then the greyscale sort across all eight.**

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-look` on branch `r9-look`.
Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite and build; one
browser at a time through the slot; CRLF; the trailer; shared files; no edits to DECISIONS, README, ART, ASSETS or
LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/`; your port 5040). Then read: ART.md
1, 8, 12 and 15 closely (the three new sections above all); DECISIONS 397, 400, 402 and 401 (each "carried to phase C"
or "to the feel pass" list); and the world notes `notes/r9-oldrun-world.md`, `notes/r9-gullhaven-world.md`,
`notes/r9-gablefall-world.md` (how each world was made, its frames scripts, its critic rounds and what is short).

## 1. The faults, worst first (each mountain's own list, as its DECISIONS entry and world notes give it)

- **Gablefall:** the far hills read as peaks in the haze (ART.md 15: no peak); the nave reads as a snowfield more than
  a church's roof at the start; a dotted seam at the nave's brink; the near snowflakes drawn as smudges at the lens;
  a streak on the river's ice; the fronts orange at Evensong; the quay's folk as boxes; the far town's speckle; the set
  pieces' props, seen by no critic.
- **Gullhaven:** pale upright marks on the sea under the Great Geo and on the title (they read as posts); the far
  coast's pale streaks; soft figure-like shadows on the snow; its legends still the marquee's stand-ins.
- **The Old Run:** a pale band across the near wall in a wall ride (the terrain's shading, cause not found); Low's
  runner lines converging down the track.

Trace each to its cause before fixing it. A fix lives in the mountain's own world, look tables or ids. If a cause is in
a shared render path, a fix there must leave the five's frames as they are (show a five's frame before and after) or
stop and say so.

## 2. Five critic passes each

Rounds 7 and 8 ran five passes on each mountain. The Old Run has had two, Gullhaven three, Gablefall five (its last
changes, the set pieces' props and its palette, seen by none). Bring the Old Run and Gullhaven to five, and give
Gablefall one more on what no critic has seen: fresh critics (`model: "opus"`, `effort: "xhigh"`), blind pairs of the
previous pass against this one, given only ART.md and the frames, shuffled, keys hidden, fix worst first between
passes. Each mountain's frames as its world notes shoot them (the opening, three places, the finish, the other hour,
a set piece).

## 3. The greyscale sort across all eight

The five's stills in `shots/r9/measure/stills/gray/` and each new mountain's opening, three places and finish in
greyscale, shuffled together, to one fresh critic with only ART.md: does it sort eight sets, and which does it
confuse? Then the same in colour.

## 4. Low

On a held Low run (each world notes' GL count script), each new mountain's GL calls and draws now, against
Pinecrest's on the same stretches, with the set pieces live (Gullhaven's were not counted with them). Counts only:
frames a second are the main lane's sittings.

## Not yours

`src/sim`, `src/bot`, `src/data/ghosts`, the five's worlds, the UI (a `feelui` lane works on the screens beside you),
the garage and the rider's pieces. The five's fingerprint and every render suite hold.

## Deliver

Commits on `r9-look` (`tsc` clean and the full suite green in the heavy slot before your last commit);
`notes/r9-look.md` with each fault before and after (its frames and its cause), each critic pass (its pairs, picks,
faults and fixes), the sort in greyscale and colour, Low's counts, every hunk in a shared file, the text for ART.md 15
and DECISIONS, what only scripts have seen, and what the main lane must decide. Frames under `shots/r9/look/`. Stop
your server and close your browser at the end. Your final message: the faults, the passes, the sort, Low's counts, and
what the main lane must decide.
