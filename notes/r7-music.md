# Round 7, music lane: notes for the main lane

Plan change 8 (DECISIONS 277): a produced score, a different style for every course. Kept up to date as the lane
goes; the sections marked *pending* are not done yet. Nobody has heard any of it.

## Where the lane stands (updated as it goes)

- Done: the offline renderer's instruments, drums, space and meters (`scripts/music/dsp.ts`, `fx.ts`, `inst.ts`,
  `perc.ts`, `meter.ts`; `check.ts` is the instrument bench: every pitched instrument sounds within 5 cents of the
  note asked for). `ffmpeg-static` installed as a devDependency.
- Pending: the score's notation and the piece renderer, the seven pieces, the encodes and packs, the runtime (store,
  stem deck, scheduler), the jukebox, the tests, the measurements, LISTENING.md and ASSETS.md texts.

## The route, decided

- **Offline rendering in TypeScript, in Node** (`scripts/music/`, `npm run music`). No audio-generation tool (its
  licence for a game sold on CrazyGames cannot be checked from here) and no DAW (no bounce, nobody can hear).
- **Encoding with `ffmpeg-static` 5.3.0** (ffmpeg 6.1.1, GPL build, a devDependency: a build tool only, never
  shipped, its install script allowed in `package.json`'s `allowScripts`). Opus (libopus) in WebM is the main
  format; AAC-LC (ffmpeg's own encoder, so the bytes do not depend on the machine's codecs) in `.m4a` is the
  fallback. The format is chosen at runtime by decoding a probe file of each, which also measures the decoder's
  leading offset so sections stay on the grid.
- **Stems as sections by layers, in packs.** One pack per course, tier and format: every section's layers as
  standalone compressed files behind a small index, fetched once when the course is picked, cached with the Cache
  API, decoded a section at a time.
- **The live engine stays** for cues pitched into the key, the set pieces' steps, the crowd, the ghost choir, the
  rider motifs, and as the fallback band when stems are not there.

(The rest of this file is written as the work lands.)
