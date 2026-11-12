// A quick render of one piece with its levels, while a piece is being written:
//   npx tsx scripts/music/try.ts pinecrest
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bands, loudness, picture, pulse } from './meter';
import { LAYERS, TRACK_TIME, calibrate, master, renderSection, renderShot, sumLayers } from './piece';
import { PIECES } from './pieces';
import { writeWav } from './wav';

const id = process.argv[2] ?? 'pinecrest';
const piece = PIECES.find((p) => p.id === id);
if (!piece) throw new Error(`no piece ${id}`);
const t0 = performance.now();
// --fast reuses the gains of the last render of this piece (fine while a tune is being written; the build
// always measures).
const cache = `dist/music/cache-${id}.json`;
mkdirSync('dist/music', { recursive: true });
const fast = process.argv.includes('--fast') && existsSync(cache);
const gains = fast ? (JSON.parse(readFileSync(cache, 'utf8')) as Record<string, number>) : calibrate(piece);
writeFileSync(cache, JSON.stringify(gains));
const t1 = performance.now();
const secs = piece.sections.map((s) => renderSection(piece, s, gains));
const shots = piece.shots.map((s) => ({ id: s.id, len: s.len, audio: renderShot(piece, s, gains) }));
const m = master(piece, secs, shots);
const t2 = performance.now();
console.log(`${piece.id}: calibrate ${((t1 - t0) / 1000).toFixed(1)} s, render ${((t2 - t1) / 1000).toFixed(1)} s, gain ${m.gainDb.toFixed(1)} dB, limiter ${m.limitDb.toFixed(1)} dB`);
console.log('track seconds', Object.fromEntries(Object.entries(TRACK_TIME).map(([k, v]) => [k, Math.round(v * 10) / 10])));
console.log('gains dB', Object.fromEntries(Object.entries(gains).map(([k, v]) => [k, Math.round(200 * Math.log10(v)) / 10])));
const dir = `dist/music/wav/${piece.id}`;
mkdirSync(dir, { recursive: true });
for (const s of m.sections) {
  const mix = sumLayers(s.layers);
  const lv = loudness(mix);
  const per = LAYERS.map((l) => (s.layers[l] ? `${l} ${loudness(s.layers[l]!).lufs.toFixed(1)}` : `${l} -`)).join('  ');
  const b = bands(mix);
  const pic = picture(mix);
  console.log(`${s.id.padEnd(6)} ${lv.lufs.toFixed(1)} LUFS  tp ${lv.tp.toFixed(1)}  | ${per} | corr ${pic.corr.toFixed(2)} mono ${pic.monoLoss.toFixed(1)} phone ${pic.phoneLoss.toFixed(1)} | cen ${b.centroid.toFixed(0)} | ${b.db.map((x) => x.toFixed(0)).join(' ')} | bpm ${pulse(mix).bpm.toFixed(1)}`);
  writeWav(`${dir}/${s.id}.wav`, mix);
}
for (const s of m.shots) {
  const lv = loudness(s.audio);
  console.log(`${s.id.padEnd(12)} mMax ${lv.mMax.toFixed(1)}  tp ${lv.tp.toFixed(1)}  ${(s.audio.l.length / 48000).toFixed(2)} s`);
  writeWav(`${dir}/${s.id}.wav`, s.audio);
}
