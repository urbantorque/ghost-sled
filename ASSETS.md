# Assets

Every file Ghost Sled ships that is not generated at run time, and every outside tool used to make one: what it
is, how it was made, and its licence position. Round 7 is the first round to ship any (DECISIONS 323).

**In short.** The only asset files are the produced score in `public/music/`: 18 packs and two decode probes,
59,543,030 bytes (56.8 MiB). Every note and every sound in them is original, written and synthesized in this
repository. The game ships no image, texture, model, font or video file: `public/` holds nothing but `music/`,
`index.html` uses the system font stack and an inline SVG icon, and every mesh, texture, sound effect, title-card
illustration and rider bust is generated in code at run time.

## Audio

Every audio file the game ships is in `public/music/`. All of it is original work made for Ghost Sled: the
notes were written in this repository (`scripts/music/pieces/`) and every sound was synthesized from them by
the project's own renderer (`scripts/music/`, TypeScript run by Node). No samples, loops, recordings, sound
libraries, presets, MIDI files or generated audio from any outside tool or model were used. Nothing quotes or
imitates an existing soundtrack, song or artist. Rebuild with `npm run music`.

| File | Bytes | What it is | Source | Tool | Licence |
| --- | --- | --- | --- | --- | --- |
| `title.full.webm.bin`, `title.lite.webm.bin`, `title.lite.m4a.bin` | 616,575; 523,945; 727,490 | The title theme: three sections | `scripts/music/pieces/title.ts`, `common.ts` | The project's renderer; encoded by ffmpeg 6.1.1 (`ffmpeg-static` 5.3.0): libopus, and ffmpeg's AAC encoder | Original; owned by the project, all rights reserved |
| `pinecrest.full.webm.bin`, `pinecrest.lite.webm.bin`, `pinecrest.lite.m4a.bin` | 5,522,322; 2,598,521; 3,404,931 | Pinecrest's score: ten sections in layers, a build, a hit, fifteen stingers | `scripts/music/pieces/pinecrest.ts`, `common.ts` | The same | The same |
| `frostfang.full.webm.bin`, `frostfang.lite.webm.bin`, `frostfang.lite.m4a.bin` | 5,298,045; 2,601,447; 3,276,345 | Frostfang's score, the same parts | `scripts/music/pieces/frostfang.ts`, `common.ts` | The same | The same |
| `ember.full.webm.bin`, `ember.lite.webm.bin`, `ember.lite.m4a.bin` | 4,452,680; 2,048,935; 2,804,268 | Ember Peak's score, the same parts | `scripts/music/pieces/ember.ts`, `common.ts` | The same | The same |
| `sakura.full.webm.bin`, `sakura.lite.webm.bin`, `sakura.lite.m4a.bin` | 6,244,213; 3,671,739; 4,510,759 | Sakura Ridge's score, the same parts | `scripts/music/pieces/sakura.ts`, `common.ts` | The same | The same |
| `lanternfall.full.webm.bin`, `lanternfall.lite.webm.bin`, `lanternfall.lite.m4a.bin` | 5,182,817; 2,631,689; 3,423,128 | Lanternfall's score, the same parts | `scripts/music/pieces/lanternfall.ts`, `common.ts` | The same | The same |
| `probe.webm`, `probe.m4a` | 2,017; 1,164 | A single click in 0.2 s of silence: the runtime's decode test | `scripts/music/build.ts` | The same | The same |

`src/audio/produced.json` is the score's manifest (sections, layers, one-shots, the sizes above; version
`092dd8709d18`). It is data written by the same build and ships as a script chunk of its own, loaded after the
first frame. `scripts/music/analysis.json` is what the build measured; it is not shipped.

**How a pack is made.** `npm run music` (`scripts/music/build.ts`) renders each piece from its notation at 48
kHz, section by section and layer by layer, masters the layers together (a bus compressor, a limiter at -1.5
dBFS on the full mix, levelled to -16 LUFS by the build's own BS.1770 meters), encodes every section's layers
and every one-shot, and writes one pack a piece, a tier and a format. A `.bin` pack is the project's own
container (`GSM1`, a JSON index, then the files end to end): Opus in WebM in the `.webm.bin` packs, AAC-LC in
MP4 in the `.m4a.bin` packs. `full` packs hold four layers a section, `lite` packs two. The build was checked
to be deterministic on the machine it ran on (Ember rebuilt from source gave the same bytes); Opus and AAC bytes
depend on the ffmpeg build, which `ffmpeg-static` pins.

## Outside tools

| Tool | Used for | Shipped? | Licence position |
| --- | --- | --- | --- |
| `ffmpeg-static` 5.3.0 (ffmpeg 6.1.1), a devDependency | Encoding the rendered audio to Opus (libopus) and AAC (ffmpeg's native encoder) | No. Its binary runs on the build machine and is not part of the game | The binary it installs is a GPL build of ffmpeg. The GPL covers the program, not the audio it encodes |
| Node, `tsx`, TypeScript, Vite, Vitest | Running the renderer, building and testing | No | Build tools; nothing of them is in the audio |
| three.js 0.186.1 | The game's renderer | Yes, as code in the bundle | MIT. A code dependency, not an asset |

No audio-generation model, DAW, sample library or stock asset was used (DECISIONS 277 and 323 say why).

## Codecs, and the open question on AAC

- **Opus** is royalty-free: a BSD-licensed reference encoder, and patents licensed royalty-free.
- **AAC-LC is a patented format, and this is an open question for the owner.** The three `.m4a.bin` packs a piece
  exist only as a fallback for a browser that cannot decode Opus in WebM through `decodeAudioData` (older Safari
  is the known case). They are decoded by the browser's own decoder. **Whether distributing AAC-encoded audio in a
  game sold on CrazyGames needs a licence, or anything else, from the project has not been checked by a lawyer.**
  Nobody working on this round could check it. If in doubt, drop the six `.m4a.bin` packs (17.3 MiB): the game
  then plays the live band, synthesized in the browser, wherever Opus does not decode, and nothing else changes.
  Before dropping them for size alone, check which browser versions are targeted.

## The rest of the sound, and everything else

Every effect, the ambience, the live band that plays as the fallback, the riders' motifs and the cues are
synthesized in the browser at run time by `src/audio/` and ship as code, not as files. The same is true of
every mesh, material, texture, glyph atlas, UI illustration and rider bust. The bundled ghost pools
(`src/data/ghosts/*.json`) are records of the project's own bot riding the project's own sim
(`npm run generate-ghosts`), compiled into the bundle.

**Originality.** Every name, character, shape, sound and note is original to this project. The one call no
measurement can make is LISTENING.md's last: whether any tune reminds a listener of music that exists. Every note
was written here, from nothing but the brief, and no existing piece was used as a model.
