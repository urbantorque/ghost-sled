# Round 8: the events lane (V6, every action is an event)

The item: a perfect landing, a dash, a ward, a pass and a finish should each feel like an event in the world, not a
line of type over it. The ground truth (DECISIONS 367): a perfect landing was a line of type and a puff the size of
the sled, and a clumsy fall threw more snow than a perfect. The snow lane (merged before this lane) rebuilt the
perfect's powder (a ring of billows and a veil) so a perfect throws more than a fall; this lane builds the event on top
of it and does not touch the snow's bursts. Render, UI and sound only: nothing here feeds the sim.

Branch `r8-events`, worktree `.claude/worktrees/r8-events`. Builds: `dist/r8-events-before` (round-8 at f784510) on
4770 and `dist/r8-events` on 4771 while working (both stopped at the end). Frames and raw output:
`C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/events/`.

## How the events were shot

Events happen in time, so every judgement here is on strips: `scripts/playtest/eventstrips.js` (new) replays a pool
rider as the player (`?demo=N`) on a virtual clock, as `stills.js` and `motion30.js` do, and shoots 8 frames from the
first frame whose sim tick is at or past the event's (a perfect every 3 steps, a dash, a ward and a pass every 4, a
finish every 20). `scan` mode rides a run in long steps and lists its events (the sim's landings, dashes, wards,
tumbles and crash read through `Run.drain`, the director's passes and finish with its place). `pbAt` gives the run a
best to beat; `gl` counts the GL calls of the frames after each shot; `wreck` ends a capture run in a fall with nothing
left (no pool record ends in a wreck when replayed as the player). The same tick is the same moment on both builds;
which ghost is in view still varies a little (ghosts replay in a worker on real time).

| Event | Run | Tick | What happens |
|---|---|---|---|
| perfect-a, perfect-b | Sakura, demo 0 | 708, 1088 | a perfect off a 2.35 s and a 3.78 s flight |
| dash-a | Sakura, demo 0 | 738 | a dash 0.5 s after the perfect |
| dash-b | Frostfang, demo 3 | 345 | a dash on the first straight |
| ward-a, ward-b | Frostfang, demo 0 | 784, 2877 | a ward taking a hit |
| ward-c | Sakura, demo 1 | 2872 | a ward taking a hit |
| pass-a | Sakura, demo 1 | 3106 | Juno Vale passed, the rider in a flip, the ghost by the lens |
| pass-b, pass-c | Lanternfall, demo 0 | 2565, 3255 | Rosa Quill passed in the cloud sea, Old Wren passed |
| finish-win | Sakura, demo 0 | 6232 | 1st of 6 |
| finish-c | Sakura, demo 1 | 10027 | 4th of 6 |
| finish-d | Lanternfall, demo 0 | 12484 | 6th of 6 |
| finish-pb | Frostfang, demo 3, `pbAt` | 8525 | 5th of 6, a best beaten |

BODY_PLACEHOLDER
