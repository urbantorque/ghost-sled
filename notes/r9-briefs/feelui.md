You are the `feelui` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is **milestone 4's feel pass
on the screens: the title's words measured with the round's own counter on all eight mountains and brought under the
bar, and the screens' faults the critics left for the feel pass.**

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-feelui` on branch
`r9-feelui`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite, the
truth sweep and build; one browser at a time through the slot; CRLF; the trailer; shared files; no edits to DECISIONS,
README, ART, ASSETS or LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/feelui/`; your
port 5050). Then read: the round brief's section 2 (the screen bars); ART.md 10 whole; DECISIONS 396, 399, 401, 403
and 404 (each list "carried to the feel pass", and 404's call on the title's words); `notes/r9-ui.md` (how the words
are counted and the bars held), `notes/r9-polish.md` and `notes/r9-wiring.md` (the mirror's way in on the title).

## 1. The title's words, by the round's counter

`scripts/playtest/r9-truth.js` (through `r9-truth.sh`) shoots and counts every screen; `scripts/playtest/
r9-screenbars.ts` and `tests/r9screens.test.ts` hold the bars. Run the sweep on the merged build, desk and phone, at
every fixture, with each of the eight mountains picked on the run-50 title (add the eight if the sweep picks one). Say
every title's count against its bar. Where one is over, DECISIONS 404's order: a new mountain's mirror's way in
leaves the title for its board first (the five's unopened mirrors say nothing there), then The Twelve's nine-word line
shortens. Keep every number's word and every control's word; never cut a mountain's name from the picker.

## 2. The faults left for the feel pass (DECISIONS 401, 403, 404)

- The picked chip is no larger in the two-row picker of eight (ART.md 10: the picked one larger): make the pick read
  at a glance in two rows on a desk and a phone, or say why ART.md should change.
- On a phone's first visit, Sound On overlaps the logo's last letter.
- Resume's "P" on the pause card is drawn as a round, pad-style cap.
- The results' time reads upright and small.
- Content clipped in the garage's tile strip (the garage's screens are G6's: this one fix only, listed in your notes).
- The title reel's loop: each time it loops the lens glides back to the hero over about half a second, and on
  Gullhaven (the shortest loop, about 6 s) it starts 260 m off with no rider in frame. The fix touches the five's
  titles too: show all eight before and after.

Then one fresh family-test critic (`model: "opus"`, `effort: "xhigh"`, given only ART.md and the frames, shuffled,
never told what changed) across the title on three mountains, the results with Details, a room, the pause card and the
garage, desk and phone: its scores against DECISIONS 404's.

## Not yours

`src/sim`, `src/bot`, `src/data/ghosts`, the mountains' worlds (a `look` lane works on the three new worlds beside you)
and the rider's pieces. Shared files (`app.ts`, `save.ts`, `spineview.ts`, `menus.ts`, `ui.ts`, `contract.ts`): small,
additive hunks, each listed in your notes.

## Deliver

Commits on `r9-feelui` (`tsc` clean and the full suite green in the heavy slot before your last commit);
`notes/r9-feelui.md` with every title's count before and after, each fault before and after (its frames on a desk and
a phone), the family test, every hunk in a shared file, the text for ART.md 10 and DECISIONS, what only scripts have
seen, and what the main lane must decide. Frames under `shots/r9/feelui/`. UI work uses the design-taste-frontend skill
(ART.md and the lane rules win where they differ) and is checked against the web-design-guidelines skill. Stop your
server and close your browser at the end. Your final message: the words, the faults, the family test, and what the
main lane must decide.
