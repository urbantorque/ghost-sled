# Round 9, Gullhaven's world (the `gullhaven` lane's world builder)

The brief is `notes/r9-briefs/gullhaven.md` section 2 ("A place of its own"); the rules `notes/r9-lanes.md`. This file is
the world's: what was built, why a player would feel it, what the critics said, what Low costs, what is short. The
lane's own notes (the sim, the set pieces' sim, the score, the pool, registration) are `notes/r9-gullhaven.md`. Frames
are under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gullhaven/world/`. Nobody has ridden Gullhaven by hand,
and every frame here is staged (a sled held on a line at a speed, `scripts/r9/gullhaven-world-frames.js`), not a ride.

*(A working file: kept current as the world goes.)*

## Working log

- The baseline: the lab course drew nothing (a blank frame): the look tables' empty `JOURNEY.gullhaven` threw in
  `journeyDusk` on every frame (1,115 page errors in the first capture). Filled first.
- First world (commit 1): its light (`palette.ts` gullhaven rows), the sea at its own level (`sky.ts setSeaLevel`, the
  sea plane in `gullhavenworld.ts`, `massif.ts seaOcean`), the coast panorama (`massif.ts` coast), the storm deck's
  edge (`sky.ts uDeckEdge`), the drawn sea cliff and moor (`ground.ts cliffGround`), the five's grammar kept off.
