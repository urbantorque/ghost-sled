# Round 8: the perf lane (Low at 6x against round 7)

The question (DECISIONS 366): on a very first run at 6x, Low on the visual-lift merge was 2 to 5 fps under round 7
on every mountain, and nothing in the frame's script showed it (systime.js read the world's systems level).

Builds: round 7 = `dist/r7-main` (88d3663), base = `dist/r8-base` (round-8 head a759f5a), fix = this branch
(`dist/r8-perf`, served from the worktree). Unminified twins for profiles were built from the same commits into the
session's scratch folder. Raw output: `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/perf/`.

## Method

Fps under vsync is too coarse and this laptop's speed swings by a third between passes, so the cause was found with
measures that do not drift with the machine, and fps was used only for the proof:

- **A timeline trace of a ride** (`scripts/playtest/frametrace.js`, new): the renderer main thread's top-level tasks
  over 15 s, summed by kind (the frame callback's task, idle callbacks, timers, GC, events), per second and per frame,
  in wall time and in the thread's own CPU time, with the frame intervals' spread in vsyncs.
- **A CPU profile** on unminified builds (`profile.js`), per frame, and the same per frame **in units of one sim
  tick's cost** (the sim does identical work on every build, so it is a ruler for the machine's speed in that run).
- **What a frame asks of WebGL, counted call by call** (`scripts/playtest/glcount.js`, new): every call on the
  context, a frame's average over 10 s of a ride. Counts are exact and identical run to run.
- **The far bake's own counters** (`far.stats`, with a new `stale` count of re-bakes by reason) and a log of each
  fine tile as it lands.
- **Switches inside one ride** (`scripts/playtest/abtoggle.js`, new): any line of script off and on in alternating
  windows. Too noisy here (the course's own load swings 15 to 30% from one 3 s window to the next); kept as a tool.
- **A ruler in the page** (`scripts/playtest/workcal.js`, new): the frame and idle callbacks timed exactly, divided
  by a fixed piece of arithmetic timed in the same page (see Proof).
- **The draw of one held frame** (`scripts/playtest/renderbench.js`, new): the ride stopped at a distance and the
  same frame drawn 800 times a pass. On battery its passes swung 20%; kept as a tool for a quiet mains sitting.

## What was found (each experiment, its numbers, its files)

1. **The main thread is saturated at 6x.** Traces on mains (`ft1..5-{r7,r8}-m0.json`): 885 to 990 ms of every
   second busy on both builds, so frames a second is simply 1000 over a frame's whole work; any added work, inside
   the callback or between frames, costs its share of fps directly. (When the machine is quick, 50 to 59 fps, it is
   not saturated, and frames fall into one or two vsyncs: `t1..3-*.json`.)
2. **The far bake (hypothesis 1): real but small.** Idle callbacks 13 to 22 ms a second at 6x on the base against 3
   to 10 on round 7 (`ft*.json`), about 1 to 1.5% of the thread; its slices run on the 200 ms timeout (a saturated
   frame leaves no idle time), one slice of about 1.6 ms each. No frame-pacing pathology: the intervals' spread moves
   with the machine, not the build. But the bake did **every fine tile twice**: the tile four chunks ahead was baked
   the moment the chunk at the window's far end came, before that chunk's casters were laid out, and again one chunk
   later (`stale` counter: 15 of 41 fine bakes were the missing-caster re-bake in one 30 s ride; the tile log shows
   the pair at every chunk).
3. **Garbage (hypothesis 2): ruled out.** GC 0.1 to 1.4 ms a second on both builds; the longest pause varies run to
   run (4 to 67 ms) on both, with no pattern by build (`ft*.json`, `t*.json`).
4. **The page lifecycle (hypothesis 3): ruled out.** `UpdateLifecycle` 137 to 170 ms a second on both builds at the
   same fps (`ft1..2`); no DOM writes from the lift during a ride.
   (These traces, `t1..3-*.json`, rode the fix's first two changes, before the third below.)
5. **Uniform uploads (hypothesis 4, the GPU side as the main thread sees it): the largest single cost.** The
   unminified profiles on mains (`prof-r7-m0.json`, `prof-r8-m0.json`): per frame in sim-tick units the base costs
   109.4 against round 7's 101.4 (+7.9%, matching the fps gap of the same two runs, 36.2 against 39.2). Of that,
   the renderer's draw is +3.6 (three's `setProgram` +3.0, its uniform `upload` +2.2, `flatten` and
   `setValueV4fArray` +1.7), the idle bake +1.0, the page's own native time +0.7. The GL count says why
   (`gl-r7-m0.json`, `gl-r8-m0.json`): **512 calls a frame against 479, 53 `uniform4fv` against 26, 3,601 uniform
   floats against 2,314.** The far field's two uniform arrays (`uFarSlot`, twenty vec4s, and `uFarBox`, three) are in
   every lit material's program, and three.js uploads an array of vectors whole, with no cache, every time the
   material changes: about 13.5 times a Low frame, 27 calls and 1,240 floats, plus the copying into flat arrays.
   No readPixels or other sync calls on either build, and the same program or two compiled mid-ride on Ember and
   Sakura on every build alike.
6. **The far field's per-frame update** (one of my own): 0.068 ms a frame at 1x (so about 0.4 ms at 6x), most of it
   looking every frame for stale tiles (the casters and set pieces) and for the next job when there was none.

**The cause:** no one thing. The lift's far shadows put a cost on every Low frame that systime.js could not see,
because it sits in three's draw (uniform arrays re-sent at every material change) and in idle tasks (a bake that did
its fine tiles twice), plus a per-frame look for work. Together about 7 to 8% of a saturated frame, which is the 2 to
5 fps. The poster's one draw is the rest of the difference in calls (about +10 to +17 a frame on top of round 7) and
is kept: it is the look.

## The fix (all in `src/render/farshadow.ts`; Low keeps its far shadows and its poster)

- **The slots and the near map's box are a small float texture**, `uFarTable` (23 texels: 20 slots, 3 for the box),
  read with `texelFetch`, sent with one `texSubImage2D` only when it changed, and bound once. The two uniform arrays
  are gone from every program. The box is all zeros when there is no near map (Low), so Low's table changes only
  when a tile lands or fades in: 0.3 to 0.4 uploads a frame.
- **A fine tile waits for its casters three chunks ahead, not four** (`WAIT_AHEAD` 3): every tile is baked once.
  One 30 s ride: 24 fine bakes (102 ms at 1x) where there were 41 to 44 (162 to 264 ms); the tile log shows each
  chunk once, never a missing caster. The fine tile four chunks ahead (about 200 to 256 m) now takes its casters a
  chunk later; the coarse tile shades that stretch meanwhile and the casters fade in over 0.6 s as before.
- **The field looks for new work a few times a second** (`ROW_CHECK_S`, 0.4 s): the stale checks (rows, casters, set
  pieces) moved into the existing 0.4 s look, and `nextJob()` runs only when the window moved, a look found
  something, or a job finished. The update is 0.029 ms a frame at 1x, from 0.068; `nextJob` 133 calls in 30 s, from
  one a frame.

**What a Low frame asks of WebGL now** (glcount, 1x, 10 s of the ride from about 200 m; `glf-{r7,base,fix}-m{0,2,3}.json`):

| mountain | calls a frame r7 / base / fix | uniform4fv | uniform floats |
|---|---|---|---|
| Pinecrest | 483 / 523 / 501 | 26 / 55 / 26 | 2,334 / 3,695 / 2,383 |
| Ember | 465 / 492 / 476 | 29 / 57 / 28 | 2,366 / 3,667 / 2,383 |
| Sakura | 473 / 521 / 492 | 28 / 58 / 28 | 2,355 / 3,775 / 2,419 |

The rest of the gap to round 7 in calls is the poster's draw and its state.

**Look:** the same frames on the base and the fix at the same distances (Low, Pinecrest 300, 900, 1763 m and Ember 450,
1200 m: `frames/base/`, `frames/fix/`) show the same far shadows (the tree run's, the ravine's); the console is
clean on both.

## Proof: what is settled and what is not

**Settled (exact, same-run measures):** the work the fix removes is gone. Per Low frame, against the base: 22 to 29
fewer GL calls, 27 to 29 fewer `uniform4fv`, about 1,300 fewer uniform floats (round 7's level, plus the poster's
draw); the far bake's fine tiles once each (24 bakes in a 30 s ride, not 41 to 44); the field's per-frame update
0.029 ms at 1x, not 0.068. The mains profile that reproduced the gap put these pieces at about 6 of its 8%
(uniforms and draw 3.6, idle bake 1.0, the update's share of the rest).

**Not settled: frames a second.** Every fps sitting I had ran on a shared machine (other lanes' captures, the CPU
26 to 62% busy before my own browser started) and the fps of one probe swung 22 to 38 between passes:

- *Interleaved passes* (perf.js, the LOW plan, 45 s on Pinecrest, Ember, Sakura; A B C C B A A B C C B A A B C, on
  mains 23:10 to 23:57; `passes1/p*.txt`). Medians of five: round 7 35/32/28, base 31/31/29, fix 28/30/27; means
  33.6/32.0/28.8, 30.2/31.4/30.0, 29.8/30.8/26.6. A single probe's spread (22 to 38) is four times any difference
  between builds; the fix's passes fell in the slowest stretches (p4, p15). This sitting cannot tell the three apart,
  and it is not a quiet sitting (the lane rules say only the main lane's quiet sittings count).
- *A ruler in the page* (`scripts/playtest/workcal.js`, new; `wc1.json`): the frame and idle callbacks timed exactly
  and divided by a fixed piece of arithmetic timed in the same page every 250 ms, two rounds a mountain interleaved.
  Work a frame in rulers, Pinecrest/Ember/Sakura: round 7 2.87/3.22/3.15, base 3.15/3.11/3.49, fix 2.88/3.34/3.23;
  over the three, base +5.5% on round 7 and the fix +2.4%. Within a build the runs still spread about 8%, so this
  says "the fix recovers about half the gap, perhaps more" with low confidence.
- *Two builds in two pages at once* (to share the load fairly): one page rode at half the other's fps even with the
  same build in both (an A/A test: 18 against 42 fps), so it was dropped.
- *High at 1x* (perf.js, 60 s on Pinecrest and Ember, A C C A, `high1x/`): 60/60 fps, p90 16.8 ms on both builds in
  every pass.
- *The first frame at 6x on a fresh save* (firstframe.js, four rounds, `firstframe.txt`): round 7 2888, 3843, 3049, 3383 ms; the fix 3387, 3203, 1775, 1760 ms (medians 3216 and 2489): no slower, and noisy on this machine. Nothing the fix changes runs before the first frame except the table's first upload (a 23-texel texture).

**The confirming sitting** (for the main lane's next quiet window, on mains, nothing else running; three servers:
round 7, the base and this branch's build):

```
npx vite build --outDir dist/r8-perf --emptyOutDir        # in this worktree, at the branch's head
npx vite preview --outDir "C:/Users/roger/OneDrive/Desktop/Ghost Sled/dist/r7-main" --port 4710 --host 127.0.0.1 --strictPort &
npx vite preview --outDir "C:/Users/roger/OneDrive/Desktop/Ghost Sled/dist/r8-base" --port 4711 --host 127.0.0.1 --strictPort &
npx vite preview --outDir dist/r8-perf --port 4714 --host 127.0.0.1 --strictPort &
scripts/playtest/perf-vl.sh http://127.0.0.1:4710/ http://127.0.0.1:4714/ "C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/perf/confirm"
```

perf-vl.sh's first loop (ten LOW passes, A B B A A B B A A B) is the comparison; its other phases (desktop, phone,
Lanternfall, the first frame) check nothing got worse. If the window is short, stop it after the LOW loop. A second,
cheaper check that holds up better on a busy machine: `workcal.js` with five rounds,
`window.__wcCfg = { builds: ['http://127.0.0.1:4710/', 'http://127.0.0.1:4711/', 'http://127.0.0.1:4714/'], ms: [0, 2, 3], rounds: 5 }`.

## Low's budget at 6x (for the lanes that spend it)

From the mains traces of the fix and round 7 (`t1..3-*.json`, `ft*.json`), per frame on the renderer's main thread:

| state of the machine | fps | busy a frame | of it, the frame callback's task | of that, the page lifecycle | outside the callback |
|---|---|---|---|---|---|
| quick (not saturated) | 52 to 59 | 15 ms | 13.7 ms | 2.4 ms | 1.4 ms |
| middling | 42 | 22 ms | 20.0 ms | 3.2 ms | 2.0 ms |
| slow (saturated) | 27 to 36 | 27 to 36 ms | 24 to 32 ms | 4.7 to 6.8 ms | 3 to 4.3 ms |

So the script is about 75% of a frame, the lifecycle (style, layout, paint, commit) about 15%, and timers (the audio's
tick), idle work and events the rest. In CPU time (which the throttle does not stretch) a frame's callback is 3.9 to
5.8 ms and everything outside it 0.4 to 1.0 ms. **Headroom:** at 6x Low is CPU-bound; it holds 60 fps only when the
machine is quick, and at the round's usual sittings (40 to 46 fps) a frame is 22 to 25 ms of work. To 50 fps that is
2 to 5 ms over; to 40 fps, level to 3 ms of room. **Every 1 ms a frame at 6x (0.17 ms at 1x) costs about 1.5 fps at
40 fps**, wherever it runs (inside the callback, in an idle task or in three's draw). Rules that fall out of this:

- A uniform array of vectors in a shared material is re-sent whole at every material change (about 13 times a Low
  frame). Pack it into a texture, or into single vec4s three can cache.
- A draw on Low costs the main thread its state changes and uniforms before its shader runs: count them with
  glcount.js before and after (round 7 was about 480 GL calls a Low frame).
- Idle work at 6x runs on its timeout, between saturated frames, and costs its full time; bake once, look rarely.
- Measure with glcount.js (exact), frametrace.js (by kind) and profiles in sim-tick units; fps only in a quiet sitting.

## The battery window

The laptop went onto battery at about 22:45 on 19 November and was back on mains by 23:09. Taken in that window and
not counted for frame rate: the profiles `bat-prof{1,2}-*.json` and the held-frame bench `rb*.json`. The GL counts
(`glf-*.json`, exact) were taken on battery and are counted. The traces `t1..3-*.json` and `ft*.json` were on mains,
but with other lanes loading the CPU (35 to 62%), and are used for composition only.

## For DECISIONS (to paste)

**Why Low at 6x fell 2 to 5 fps under round 7, and what was given back** (the perf lane, `notes/r8-perf.md`). At 6x
Low's main thread is saturated, so every millisecond a frame costs fps wherever it runs; systime.js timed the world's
systems and saw nothing because the cost sat in three's draw and in idle tasks. A profile normalised by the sim's own
work (the same on every build) reproduced the gap (+7.9% a frame) and named it: the far shadows' two uniform arrays
(twenty slots and the near map's box) were in every lit program, and three re-sends an array of vectors whole at
every material change (27 calls and 1,240 floats a Low frame: 512 GL calls against round 7's 479); the far bake
baked every fine tile twice (the tile four chunks ahead before its casters were laid out, then again with them);
and the field looked for stale tiles and new work every frame. Garbage, the page's lifecycle, shader compiles and
sync calls were ruled out. The fix keeps Low's far shadows and its poster: the slots and box are a 23-texel float
table sent only when it changes (on Low, when a tile lands), a tile waits for its casters three chunks ahead (each
baked once, the bake about half), and the field looks for work a few times a second. A Low frame now asks WebGL for
round 7's calls and floats plus the poster's draw. Frames a second against round 7 were not settled: the only
sittings were shared with other lanes and a probe swung 22 to 38 fps; a ruler-normalised measure put the base 5.5%
over round 7's work a frame and the fix 2.4% (low confidence). Confirmed in a quiet sitting with perf-vl.sh, round 7
against the branch. High at 1x holds 60 on both. Rejected: dropping Low's far shadows or poster (the cost was in how
they were fed, not in what they draw).

## Touched outside my files

- `src/render/farshadow.ts` (the farlight lane's): the table, the bake's wait, the looks. `tests/farshadow.test.ts`:
  FAR_GLSL declares three uniforms, not four.
- New tools: `scripts/playtest/frametrace.js`, `glcount.js`, `abtoggle.js`, `renderbench.js`, `workcal.js`.

## Still short

- The poster's draw stays (+1 draw, about 10 to 17 GL calls a frame on Low). If Low has to give more back, it is the
  next thing to look at (its program could join an existing pass).
- Every lit program still carries the lift's and the poster's scalar uniforms on every tier (Low draws none of the
  lift); they are cached by three and cost only the walk over them (about 0.1 ms a frame at 6x). Tier defines would
  remove them at the price of a recompile when the tier changes.
