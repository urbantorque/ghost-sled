You are the `polish` lane of round 9 of Ghost Sled (a stylised downhill sled racer for the browser and CrazyGames:
Vite, TypeScript, three.js; the art direction is "Alpenglow Gouache", ART.md). Your job is **the screens' faults the
round's critics found and left for later: small, specific, each one checked on a desk and a phone.** The title and
results (DECISIONS 396), the other screens (399) and the garage (401) are built on one system (`src/ui/tokens.css`,
`kit9.ts`, `kit9.css`) and judged "mostly yes" as one family. These are the faults the critics named that nobody has
fixed yet. Fix each, then show the family test that it is gone.

Repo: `C:\Users\roger\OneDrive\Desktop\Ghost Sled`. Your worktree: `...\.claude\worktrees\r9-polish` on branch
`r9-polish`. Read `notes/r9-lanes.md` in your worktree first; its rules hold (the heavy slot for every full suite and
build; one browser at a time through the slot; CRLF; the trailer; shared files; no edits to DECISIONS, README, ART,
ASSETS or LISTENING; output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/polish/`; your port 5020).
Then read: ART.md 1 and 10 whole; DECISIONS 396, 399 and 401; `notes/r9-ui.md` (the copy pass, the word bars, the
critics); `notes/r9-u4.md` (above all its "For other lanes" and the critics' faults, where most of this list comes
from); `notes/r9-g6.md` section 12.8.

## The list (worst first, as the critics weighed them)

1. **Details' vermillion button floats over its last rows** (the results' Details sheet): the primary sits over the
   list it ends, so the last rows read under it. Give the list its room, or the button its own foot.
2. **The gift figure drawn three ways:** marigold on the results, the garage now marigold too (G6), grey on the
   title's Garage door ("90 gifts"). A gift figure is marigold with its word, wherever it is (ART.md 1: marigold is the
   lantern's and the gifts').
3. **The curly apostrophe drawn like an acute accent in italic 900** ("Crane´s" on the title's quiet line): the
   system font's italic heavy apostrophe. Find a form that reads as an apostrophe at that weight on Windows, macOS,
   Android and iOS system fonts (say what you can and cannot check), without going back to straight quotes.
4. **The results' fact chip far from its headline on a phone.**
5. **The quiet line at ten words** ("1,281 XP to Rider Rank 26: the Crane's Memory charm") against ART.md 10's nine:
   meet nine without losing what the line is for (the next prize and how far).
6. **Quiet and secondary buttons read alike** (G6's critics): ART.md 10's three ranks must be three at a glance.
7. **The phone's doors read as tiles** (G6's critics), where the desk's read as the kit's buttons.
8. **The hour's Day and Night swatches on Ember near the same brown**, and **"Mirrored" read as a third option of the
   hour's pair.**
9. If time allows, the two the U4 critic left: the medal discs want a closer legend than the wall's one line, and the
   album's index could show a sticker on each row.

Do not fix by deleting a system or a control; colour roles are locked (ART.md 1); every number keeps its word; no lone
icons; one primary a screen at most. The word bars (`scripts/playtest/r9-screenbars.ts`, `tests/r9screens.test.ts`)
hold.

## Judge it

Each fix before and after on a desk (1280) and a phone (390), at mid-5, mid-50 and mid-100 where the screen changes
with the save, the console read on every capture. Then one fresh family-test critic (`model: "opus"`, `effort:
"xhigh"`, given only ART.md and the frames, shuffled, never told what changed) across the title, the results with
Details, the rooms, the books, the pause card and the garage on both forms, as U4's was: say its scores against U4's
and G6's, and whether any listed fault is raised again.

## Not yours

`src/sim`, `src/bot`, `src/data/ghosts`, `src/render` and the mountains (the `gablefall` lane works there beside
you, and adds its mountain card to `src/ui/art.ts` and `contract.ts`: leave both). The garage's own screens were
rebuilt by G6 a moment ago: touch them only for item 2 and say so. Shared files (`app.ts`, `save.ts`, `spineview.ts`,
`menus.ts`, `ui.ts`, `contract.ts`): small, additive hunks, each listed in your notes.

## Deliver

Commits on `r9-polish` (`tsc` clean and the full suite green in the heavy slot before your last commit);
`notes/r9-polish.md` with each item before and after (its frames on a desk and a phone), the family test, every hunk in
a shared file, the text for ART.md 10 and DECISIONS, what only scripts have seen, and what the main lane must decide.
Frames under `shots/r9/polish/`. UI work uses the design-taste-frontend skill (ART.md and the lane rules win where they
differ) and is checked against the web-design-guidelines skill. Stop your server and close your browser at the end.
Your final message: each item before and after, the family test, and what the main lane must decide.
