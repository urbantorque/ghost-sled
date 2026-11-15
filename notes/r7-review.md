# Round 7, phase 3: the visual review loop (one lane a mountain)

Read `notes/r7-lanes.md` first: all of its rules hold (your own worktree and branch, commit small, never push or
merge, headless playwright only, your own session name, never `close-all`, tests and types green, console clean).
Then `ART.md` section 15 (the direction and your mountain's colour script) and the notes of the lanes that built
what you are judging (`notes/r7-light.md`, `r7-hero.md`, `r7-fx.md`, `r7-pipe.md`, `r7-moments.md`,
`r7-momentsworld.md`, and for Lanternfall `r7-lanternworld.md`).

## The loop, exactly as the owner's brief asks

1. **Capture.** Build, serve on your port, and shoot your mountain's fixed frames (`scripts/playtest/frames.sh`,
   the list in `frames-r7.json`) on High at 1280x720, on Low, and on the phone on Medium, into
   `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\review\m<N>\pass<K>\{high,low,phone-medium}`. Add a few
   frames in motion at the hero vistas and in each set piece (a pool rider with `demo=2`, or a short strip of
   stills 0.25 s apart). Check the console is clean.
2. **Critique, independently.** Spawn a fresh subagent (general-purpose, `effort: "medium"`) as the critic. Give
   it ONLY: the paths of the frames, the path of `ART.md`, and this instruction: it is a demanding art director
   for a near-AAA stylised game; read ART.md section 15, open every frame, score each out of 10 against the
   direction (three planes, a motivated light, painted detail and no boxes, the hero lit and large enough, the
   place's grade), name the weakest thing in each frame, list the five worst frames and what would lift each, and
   say for each hero vista whether it is a 9. Tell it nothing about what you changed, what you intended or what you
   think of the frames. A new critic every pass (never continue an old one), so no pass is anchored on the last.
3. **Fix** what it found, worst first, in code. Then look at your own after frames beside the before.
4. **Repeat.** At least three passes. Stop only when the critic gives no frame under 8 and every hero vista 9 or
   more, or when you have done five passes; in that case say plainly which frames are still short and why.

High is judged hardest; Low and phone are judged as the designed poster look of ART.md 15 ("Tiers, designed"),
and must read clearly and never look broken.

## Rules for fixes

- You may edit any render file for the sake of your mountain, but keep the change to your mountain's data wherever
  the code allows (its palette, its `JOURNEY` and place grades, its stages, its sections of the kit). Four other
  review lanes are editing the same files for their mountains at the same moment and the main lane must merge
  all five: a shared-code change must be small, general and safe for the other mountains, and listed in your notes
  under "Shared code touched".
- No sim change of any kind (`src/sim`, `src/bot`, the pools). SIM_VERSION 9 is closed.
- Do not raise the frame's cost without saying so: log draw calls and triangles from the frames' JSON before and
  after. High should stay near 95 draw calls or under; Low must not get heavier.
- The colour roles of ART.md 1 stay locked.
- Never judge frames per second from your own runs: six lanes share the GPU.

## What to hand back

`notes/r7-review-m<N>.md` in your worktree: a table of every pass (the critic's score for each frame, the mean,
the minimum, each hero vista's score), what you changed after each pass and why, what is still short, shared code
touched, cost before and after. Contact sheets (`scripts/playtest/tile.mjs`) of the first pass and the last pass at
the same distances, in `shots/r7/review/m<N>/sheet-before.png` and `sheet-after.png`, and the best four to six
hero frames copied to `C:\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\hero\m<N>\`. Your last message is the
report of `notes/r7-lanes.md` ("When you finish"), with the score table in it.
