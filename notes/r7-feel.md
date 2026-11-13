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

**How I know it is fair to a skilled player.** A fall never sets a rider forward and never sends one off
faster than it came (tested on every fall of a rider who hunts obstacles on six courses). The lab prices
every fall three ways (`lab.ts --falls`, six seeds on each of the four mountains, 420 s cap; the full table
is `shots/r7/feel/lab/after-final.txt`, the baseline `shots/r7/lab/before.txt`):

| pilot | finished (before) | falls a run | behind at the get-up, m (least / median) | cost at 300 m against the same pilot untouched, s (least / median) | cost with a steady hand after, s (least / p10 / median) | cheaper |
| --- | --- | --- | --- | --- | --- | --- |
| clumsy | 20 of 24, 5 of 6 on every mountain (0 of 24) | 8.8 | -0.6 / 13.2 | -19.9 / 8.4 | -6.8 / -1.8 / 1.9 | 38 of 207 |
| novice | 24 of 24 (23) | 0.8 | 20.4 / 28.4 | -3.2 / 3.5 | 1.65 / 2.2 / 3.6 | 0 of 20 |
| mid | 24 of 24 (24) | 0.2 | 34.6 / 42.1 | 4.2 / 5.0 | 5.0 / 5.0 / 5.6 | 0 of 4 |
| expert | 24 of 24 (24) | 1.0 | 9.5 / 49.5 | -3.5 / 5.9 | 1.63 / 3.3 / 6.0 | 0 of 20 |
| stunt | 24 of 24 (24) | 0.9 | 28.0 / 41.0 | 2.0 / 5.8 | 3.7 / 4.7 / 5.8 | 0 of 21 |

The first price is where the faller is as it rides again against the same ride carried through the hit as a
spirit: always behind (the one -0.6 m is a clumsy rider who was crossing the slope and making no ground at
all; the get-up's least push is 3 m/s). The second is the clock 300 m on against that same untouched ride,
and it is noisy by its nature: a pilot is a closed loop, the two rides part at the fall and never meet the
same snow again. Four skilled falls of 64 came out cheaper on it, and I traced each (the lab prints them):
in every one the faller was 10 to 28 m behind as it got up and the *untouched* ride then lost the time on
its own (it flew on across the lake into the far bank, or met an edge 100 m later). So the third price takes
the pilot out: both rides are finished by the same steady hand from the fall on (straight down the run where
it is, no detour, no button, no mistake), and what is left is the fall's own cost. **On that price no rider
who can ride is ever faster for falling: the least any fall cost a novice, mid, expert or stunt pilot is
1.6 s, of 65 falls.**

The clumsy pilot is the honest exception, and I am leaving it. 38 of its 207 falls came out cheaper even with
a steady hand after, by up to 6.8 s. I broke them down (in the bank or not, speed, cause): they are not a
place or a trick, they are a rider who was already lost. The clumsy pilot hops constantly and flies across
the slope at 15 m/s making 9 m/s of ground; untouched it lands beyond the corridor and scrapes along the
edge at 9 m/s, and a fall puts it back on the line pointing down the hill. That is the rescue the fall was
built to be (getting up where the sled stopped was rejected for leaving a rider among the trees), it is worth
nothing to a rider on a line (the least a skilled fall costs is 1.6 s and a get-up, the combo, the boost and
the drift charge), and I found no way to charge for it that did not take runs away from the player it is
for: the clumsy pilot's runs that fail now fail on the lab's 420 s clock, not on a wreck.

**Skilled times and the gap did not move.** Mean finish over the same 24 runs, before to after: novice 152.4
to 154.9 s, mid 127.4 to 127.7, expert 130.3 to 130.6, stunt 132.4 to 133.0, the line pilot 155.7 to 155.7
(it falls once in 24 runs). The novice-to-expert gap is 22.1 s before and 24.3 after; one pilot's six seeds
on one mountain spread 10 to 30 s, so that is inside the noise. A novice run that used to end on a tree at
124 s now finishes in 180.

**A gamepad, with rumble.** `src/game/pad.ts` reads a pad into the same few facts the keys give, and
`InputController.sample()` folds them into the one quantised byte a tick that the keys and the touch zones
make, so a pad run is in the input log and replays exactly (`tests/determinism.test.ts` rides 40 s on a
scripted pad, sweeps, flicks, trigger hysteresis and taps between ticks, and replays the record to the same
hash, through the string codec too). *Mapping:* either stick's X or the d-pad steers (the d-pad on the keys'
ramp, so a tap is a correction); A or the right trigger is the button; X, B, a bumper or the left trigger is
the lantern; Start pauses and resumes. *Tuned for a stick:* nothing inside 0.14 of travel (a worn stick does
not creep), full lock at 0.94 (not every stick reaches 1.0), and between them the touch stick's own curve,
m(0.45 + 0.55m): the first third of the live travel gives under a quarter lock, and all nine steer levels can
be reached and held (tested). Triggers have hysteresis (on past 0.35, off under 0.25). A press that comes and
goes between two ticks is still seen by one. *Menus:* focus is the pad's cursor (`src/ui/padnav.ts`): a
direction moves it to the nearest control that way, A presses it, B goes back, a slider moves on left and
right; it only moves focus and clicks, so the title, the garage, the pause card, the results and any screen
built later need nothing added. A or Start rides from the title and runs again from the results; the trigger
never does (it rests under a finger). *Hot-plug:* a pad is found within half a second of being plugged in
with no event at all, and one pulled out mid-run lets go of everything it held. *Rumble*
(`src/game/rumble.ts`, `vibrationActuator.playEffect('dual-rumble')`): a landing is a thud as deep and long
as the fall was hard, a stomp a crisp double tick, a drift release a buzz by tier, a hit, a fall, a wreck, a
ward, a dash, and a rising pair for a set piece won; every effect ends within 260 ms and a lighter one never
cuts a heavier one short. It plays only while the pad is the last input used, is off under reduced motion
and under a setting (Controller Rumble, which shows once a pad has been used), and a pad or browser without
an actuator is silence, never an error. It reads the sim's events and writes nothing back. *Glyphs:* the
hint pill shows the stick and a round A or X cap, and the title's and the results' prompts follow the last
input used, changing the moment it does.

**Hints leave.** The review found "Steer" still on screen at 1:24. The cause: the lesson was only learned
from the hands on the keys, so a rider who never steered (hands-off finishes a run, measured) or a scripted
one kept it for ever. Now (`src/game/hints.ts`): the steer lesson is learned from the run's own input, is up
8 s at a showing, and comes back only to a rider who has still never steered and is off the corridor (after
a 20 s rest, three showings a run at most). Any other lesson shown in three runs and never taken up is not
shown again (the landing ring, a timing aid, has six), except the lip's, which returns when the button was
held through one. The save counts the runs each lesson was shown in (`hintsSeen`; an old save starts at
none). Nine tests in `tests/hints.test.ts`.

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
