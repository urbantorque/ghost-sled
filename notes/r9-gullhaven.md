# Round 9, Gullhaven's lane (milestone 3, the second of the three mountains)

The brief is `notes/r9-briefs/gullhaven.md`; the rules `notes/r9-lanes.md`; the ground it stands on `notes/r9-ground.md`
(section 6, hook C) and how the Old Run was made, `notes/r9-oldrun.md`. Branch `r9-gullhaven`, cut from `round-9` at
c82f379. Every figure here is the sim's, ridden by scripts; **nobody has ridden Gullhaven by hand**. The gate on every
commit is `tests/five.test.ts` (and `tests/oldrun.test.ts` with the Old Run's pool replays).

*(A working file: kept current as the lane goes.)*

## 1. The wind made to pay, in the lab

### The course as laid (`src/sim/gullhaven.ts`, lab seed 0x1f83d9ab, SHA-256's seventh initial word)

- Three stages, 1,550 / 1,600 / 1,650 (4,800 m): the Cape, the Geos, the Harbour Road. Kinds of its own only:
  `beacon` (the slope off the cape's head under the old beacon, 200 m at 0.3, 13 m half-width), `cliffpath` (the shelf
  and the thresholds), `geo` (the path's drop through a gully's head), `descent` (the cut down to the harbour, 0.38),
  `sheds` (0.2), `harbour` (the finish on the harbour's sea ice, 0.025).
- Ten gullies: lips near 385, 730, 1,060, 1,300 | 1,880, 2,220 (the Great Geo), 2,600, 2,900 | 3,480, 3,830 (each
  jittered 15 m by the seed). A gully at least every 600 m; the first lip after 330 m.
- **A gully, and why it is shaped so.** The corridor's centre is the path (the safe line, the let-go's line, the clumsy
  pilot's aim). Before a gully the path swings 10 m inland (12 at the Great Geo) round its head and drops through it at
  the shelf's grade plus 0.2 (the `geo` section's own grade, so `baseY` carries it: nothing reads a ledge or a drop zone
  that is not one, the review's finding 13). Seaward of it the shelf runs straight on, held at its level (the kit adds
  back the path's fall) to the lip: a corniced edge 6 m high (7.5 at the Great Geo) that leaves a sled in the air at any
  speed. Past the lip the gully's face falls with the path to the far shelf, so the face is no steeper than the path's
  0.4 and a rider short of the far shelf lands on it and rides it down. The bold line runs straight on 4.5 m seaward of
  where the path was, so at the lip it is 14.5 m from the path; the corridor widens inland as the path swings, and its
  seaward edge (the fence, 0.8 m past it the sea cliff's 120 m fall) stays near where it was on the shelf.
- **The lift**: a column 2.5 m either side of the bold line (softening over 1.2 m more), from 4 m before the lip to the
  mouth's end (100 m, 140 at the Great Geo, fading over 12 m), at 0.65 g, whole up to the rim's height and gone 6 m
  above it (the wind spills over the rim): a pop rises as anywhere and the column catches the sled as it sinks. Pure in
  where the sled is.
- **Surfaces**: the shelf wind-packed (quick), the head's drift on and inland of the path (slow: the wind leaves its
  snow there), the gully's face plain snow, the harbour sea ice.

### What the bench found first (`scripts/r9/gullhaven-tune.ts`, steady hands, plain day)

| Step | Path hand | Bold hand | Gain over the gullies | Flights |
| --- | --- | --- | --- | --- |
| lift through the whole column, shelf 0.17, pack 0.85, drift 1.6 | 192.7 s | 173.7 s | 8% | 5.4 to 7.5 s, 36 to 44 m over the ground, 155 to 195 m |
| lift faded above the rim | 192.7 s | 200.6 s | **-5%** | 4.3 to 5.0 s, 20 m, 95 to 125 m |
| shelf 0.2, pack 0.72, drift 2.4, head +0.2 | 189.9 s | 177.5 s | 9% | 4.3 to 4.7 s, 21 to 25 m, 105 to 130 m |

- *Why soaring did not pay at first:* the path rider turns the gully's drop into speed on the ground; a flier keeps its
  lip speed (the air's drag is 1.5% a second) and gets back of the drop only what its landing on a falling slope pays
  (`land()`'s along-slope gain, at most about 5 m/s here, and a stomp's 2.5). A flier lofted high (lift through the
  rise) came down hard on the far shelf and was paid well, but its flights ran to 7.5 s and 44 m up. With the lift gone
  above the rim the flights are the brief's three to five seconds, and the path won. What makes the soaring line pay is
  what the path goes through: the drift in the head, the detour round it.
- A sled let go stays on the path through every gully (at most 2.9 m off its middle, never below its level).
