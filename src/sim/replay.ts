import { ChaosEvent, ChaosRoll, Mood } from './chaos';
import { LogEvent, decodeLog } from './input';
import { SIM_VERSION, Sim } from './sim';

// A RunRecord fully reproduces a run: seed + chaos + sled + input log. Score and distance are
// carried for sorting and are verified by replay where it matters (tests, pool generation).

export interface RunRecord {
  seed: number;
  chaos: ChaosRoll;
  sled: number;
  /** Encoded input log (see input.ts). */
  inputs: Uint8Array;
  ticks: number;
  score: number;
  distance: number;
  name: string;
}

const MAGIC0 = 0x47; // G
const MAGIC1 = 0x53; // S
const VERSION = 2;

export function sanitizeName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9 _.\-]/g, '').trim();
  return (clean || 'Rider').slice(0, 20);
}

export function encodeRecord(r: RunRecord): Uint8Array {
  const name = sanitizeName(r.name);
  const out = new Uint8Array(28 + name.length + r.inputs.length);
  let o = 0;
  const u8 = (v: number) => {
    out[o++] = v & 255;
  };
  const u32 = (v: number) => {
    v = v >>> 0;
    out[o++] = v & 255;
    out[o++] = (v >>> 8) & 255;
    out[o++] = (v >>> 16) & 255;
    out[o++] = (v >>> 24) & 255;
  };
  u8(MAGIC0);
  u8(MAGIC1);
  u8(VERSION);
  u8(SIM_VERSION);
  u32(r.seed);
  u8(r.chaos.mood);
  u8(r.chaos.event);
  u32(r.chaos.seed);
  u8(r.sled);
  u32(r.ticks);
  u32(Math.max(0, Math.round(r.score)));
  u32(Math.max(0, Math.round(r.distance * 10)));
  u8(name.length);
  for (let i = 0; i < name.length; i++) u8(name.charCodeAt(i));
  out.set(r.inputs, o);
  return out;
}

export function decodeRecord(data: Uint8Array): RunRecord {
  if (data.length < 28 || data[0] !== MAGIC0 || data[1] !== MAGIC1) throw new Error('not a run record');
  if (data[2] !== VERSION) throw new Error('unsupported run record version');
  // Records only replay faithfully on the physics they were recorded with.
  if (data[3] !== SIM_VERSION) throw new Error('run record from another game version');
  let o = 4;
  const u8 = () => data[o++];
  const u32 = () => {
    const v = data[o] | (data[o + 1] << 8) | (data[o + 2] << 16) | (data[o + 3] << 24);
    o += 4;
    return v >>> 0;
  };
  const seed = u32();
  const mood = u8() as Mood;
  const event = u8() as ChaosEvent;
  const chaosSeed = u32();
  const sled = u8();
  const ticks = u32();
  const score = u32();
  const distance = u32() / 10;
  const nameLen = u8();
  if (o + nameLen > data.length) throw new Error('run record truncated');
  let name = '';
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(data[o++]);
  if (mood > 6 || event > 4 || sled > 15) throw new Error('run record out of range');
  return {
    seed,
    chaos: { mood, event, seed: chaosSeed },
    sled,
    ticks,
    score,
    distance,
    name: sanitizeName(name),
    inputs: data.slice(o),
  };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(data: Uint8Array): string {
  let s = '';
  let i = 0;
  for (; i + 2 < data.length; i += 3) {
    const n = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = data.length - i;
  if (rem === 1) {
    const n = data[i] << 16;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
  } else if (rem === 2) {
    const n = (data[i] << 16) | (data[i + 1] << 8);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63];
  }
  return s;
}

export function fromBase64Url(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    let c = clean[i];
    if (c === '+') c = '-';
    if (c === '/') c = '_';
    const v = B64.indexOf(c);
    if (v < 0) throw new Error('bad base64');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return Uint8Array.from(out);
}

export function recordToString(r: RunRecord): string {
  return toBase64Url(encodeRecord(r));
}

export function recordFromString(s: string): RunRecord {
  return decodeRecord(fromBase64Url(s));
}

/** Replay a record to completion (crash or end of log). Calls onTick after each tick. */
export function replayRecord(r: RunRecord, onTick?: (sim: Sim) => void): Sim {
  const sim = new Sim({ seed: r.seed, chaos: r.chaos, sled: r.sled });
  const log = decodeLog(r.inputs);
  for (let t = 0; t < log.inputs.length; t++) {
    const ev = log.events.get(t);
    if (ev) for (const e of ev) if (e === LogEvent.Revive) sim.revive();
    sim.step(log.inputs[t]);
    onTick?.(sim);
  }
  return sim;
}
