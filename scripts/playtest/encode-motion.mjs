// Encodes motion30.js's frames into a clip: H.264 in MP4 at 30 fps, playable anywhere, for a store page or a review.
//   node scripts/playtest/encode-motion.mjs <frames dir> <out.mp4> [fps]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const [dir, out, fps = '30'] = process.argv.slice(2);
if (!dir || !out || !existsSync(dir)) {
  console.error('usage: node scripts/playtest/encode-motion.mjs <frames dir> <out.mp4> [fps]');
  process.exit(1);
}
const n = readdirSync(dir).filter((f) => /^f\d{4}\.jpg$/.test(f)).length;
const r = spawnSync(
  ffmpeg,
  ['-y', '-loglevel', 'error', '-framerate', fps, '-i', join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: 'inherit' },
);
console.log(`${n} frames -> ${out} (exit ${r.status})`);
process.exit(r.status ?? 1);
