import { writeFileSync } from 'node:fs';
import { SR, type Stereo } from './dsp';

/** A stereo buffer as a 32-bit float WAV file (what the encoders read: no dither, no clipping on the way). */
export function wavBytes(b: Stereo, sr = SR): Buffer {
  const n = b.l.length;
  const out = Buffer.alloc(44 + n * 8);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + n * 8, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(3, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(sr, 24);
  out.writeUInt32LE(sr * 8, 28);
  out.writeUInt16LE(8, 32);
  out.writeUInt16LE(32, 34);
  out.write('data', 36);
  out.writeUInt32LE(n * 8, 40);
  const f = new Float32Array(out.buffer, out.byteOffset + 44, n * 2);
  for (let i = 0; i < n; i++) {
    f[2 * i] = b.l[i];
    f[2 * i + 1] = b.r[i];
  }
  return out;
}

export function writeWav(path: string, b: Stereo): void {
  writeFileSync(path, wavBytes(b));
}
