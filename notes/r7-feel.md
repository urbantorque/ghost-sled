# Round 7, the feel lane (DECISIONS 277 change 9)

Written for the main lane to fold into DECISIONS.md, ART.md and README.md. First person, plain, no em dashes.
Branch `r7-feel`, cut from `round-7` at e503f1e. Kept current as the lane goes: a section marked *open* is not
done yet.

## Decisions

**A fall is got up from (SIM_VERSION 9).** A hard hit or a landing on the rider's head used to be a tumble
twice and the wreck the third time. Now it is a fall, for every rider: the sled slides on down the run losing
speed and is eased across to the safe line (0.7 s, `FALL_FALLING`), the rider lies in the snow (0.3 s,
`FALL_DOWN`), then stands the sled up and pushes off along the line (0.5 s, `FALL_UP`), and rides again at
half of cruise or the speed it had down the run when it fell, whichever is less, untouchable for 2.5 s. The
combo is lost, the boost and drift charge go, the lantern keeps what it holds. A full lantern still takes the
hit as a ward and no fall happens at all. *Why a player feels it:* the struggling player's run goes on; a
fall is a beat with a beginning and an end, not a results card. *Rejected:* a 2.1 s fall (tried first: the
lab's first-timer falls about nine times a run and spent that much longer lying in the snow, and more of its
runs ran out of time); getting up where the sled stopped (it stops beside the tree it hit, off the line and
among the others).

**Three get-ups, and they come back with the riding.** A fall past the first 700 m spends one. One comes
back for every 200 m ridden (`GET_UP_BACK_M`), and all of them at a stage line. A fall with none left is the
wreck that ends the run, exactly as the third wipeout used to: the crash beat, the results, "Ride home as a
spirit". So what ends a run is falling four times in about a quarter of a mile, not falling often.
*Measured* (the clumsy pilot, twelve seeds a mountain, 420 s cap): 350 m counted from the last fall finished
19 runs of 48; 200 m counted from the first one spent finished 37; with 2.5 s of grace after a get-up, 41;
with no limit at all, 42. I took the third: it is within one run of having no rule, and the rule still
means something to a rider who is falling in a heap. *Rejected:* a fixed number a stage (the clumsy pilot
falls three times a stage on average and in bursts; five a stage still wrecked most of its runs) and no limit
(nothing would be at stake in a fall, the graveyards would mark nothing final and "Ride home" would have no
use).

**A slow sled bounces off what a fast one falls on.** Head on into something solid used to be a wipeout
from 9 m/s. It is 12 now (`HIT_HARD`); a fast sled (over 24 m/s) still falls on 6 m/s into it, as before. A
rider just back on the sled at 12 m/s fell again on the next rock, and a third of the clumsy pilot's hits
came under 16 m/s.

**The landing rule was too harsh for a first-timer, and that is fixed at the cause.** I read every fall of
the clumsy pilot on the old sim with tumbles made free: 265 of its 516 falls were landings, 171 of them a
flip landed on its head and 79 a spin landed sideways. Two causes, neither of them a choice the rider made.
(1) A steer key held through a flight spins the sled at full rate (9 rad/s), and the landing set of decision
197 could not stop that in its 14 ticks, so a rider who only steered in the air came down sideways about one
flight in four. The set now stops the spin hard (in 6 ticks) and has 8 left to swing the sled straight: a
spin alone lands sketchy at worst, never a fall (tested on every leap of every mountain at four speeds).
(2) A hold begun in the air by a thumb that meant to crouch starts a flip, and a flip let go of righted
itself at 2.4 rad/s, too slowly for most flights. It rights itself at 4.5 rad/s now, and the landing set
also brings the rider out of a flip to the nearest whole turn at 4 rad/s, button held or not. A flip past
its half still carries on at its own rate, so nothing an expert lands today is lost. What still falls: a
flip that comes down within about 0.85 rad of upside down. After both, landings are 58 of the clumsy pilot's
211 falls (27%, third after trees and rocks) where they were 75 of 129 (58%, first), and none of them ends a
run.

**How I know it is fair to the ghosts.** It is the sim's rule for every rider. A ghost is a replay of its
own inputs on the same sim, so it falls where its record says and nowhere else, whoever rides beside it
(`tests/getup.test.ts`: a record replayed tick for tick beside three other riders gives the same falls and
the same hash). Nothing in a fall reads another rider. Bots fall and get up under the same three get-ups:
with the pools ridden again locally on this sim, all 42 riders of every mountain finish (Pinecrest had two
who did not, Sakura one), 20 to 57 falls and wards a pool, and the fast end is where it was (108 s).

**How I know it is fair to a skilled player** *(open: final numbers after the last lab run)*. A fall never
sets a rider forward and never sends one off faster than it came (tested on every fall of a rider who hunts
obstacles on six courses). The lab prices every fall (`lab.ts --falls`): the same pilot rides the same run
again to the tick of the fall and from there rides the next 300 m as a spirit nothing can touch, which is
more than any line that avoided the hit could keep.

## Touched outside my files

- `src/game/ghostdata.ts`, `src/workers/ghost.worker.ts`, `src/game/ghosts.ts`: three flags in a ghost's
  frames (`FLAG_FALLING`, `FLAG_DOWN`, `FLAG_UP`) and `GhostPose.fall` (0 to 3), so the hero lane can draw a
  ghost's fall from its own record.
- `tests/determinism.test.ts`: the revive test's rider is caught by the avalanche (nothing it hits ends a run
  that early now). `tests/feel.test.ts`: a tumble is 1.5 s.
- `src/ui/contract.ts`: `HudModel.wipeouts` gains `back` (how far the next get-up has come back).

## For the hero lane (the state a fall exposes)

`sim.s.fall` is `FALL_NONE` 0, `FALL_FALLING` 1, `FALL_DOWN` 2, `FALL_UP` 3 (exported from `sim.ts`).
`sim.s.fallTick` is the tick the present phase began and `sim.s.fallStart` the tick the fall began (both -1
when riding); `sim.s.tumble` is the ticks left of the whole fall, of `TUMBLE_TICKS` (90: `FALL_TICKS` 42,
`DOWN_TICKS` 18, `UP_TICKS` 30). Events: `tumble` 'start' and 'end' as before (with `left`, the get-ups
left), `fall` 'down' and 'up' between them, `getUp` when one comes back (`why`: 'ridden' or 'stage').
A ghost's pose carries `fall` with the same four values. While falling the sled moves (it slides and is
eased to the safe line); down, it is still; up, it accelerates from nothing along the line.
