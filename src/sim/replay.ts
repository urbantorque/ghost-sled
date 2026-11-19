import { STARTER_POOL } from './charms';
import { ChaosEvent, ChaosRoll, Mood } from './chaos';
import { LogEvent, decodeLog } from './input';
import { type Carry, SIM_VERSION, Sim, SimConfig } from './sim';

// A RunRecord fully reproduces a run: seed + chaos + sled + charm pool + input log. Score and distance are
// carried for sorting and are verified by replay where it matters (tests, pool generation).

export interface RunRecord {
  seed: number;
  chaos: ChaosRoll;
  sled: number;
  /** The charms the rider could be offered (charms.ts, a 24-bit mask; SIM_VERSION 10). Absent: STARTER_POOL, in
   *  the record's bytes and in its replay alike. */
  charmPool?: number;
  /** How many charm gates stood (1 to 3; absent 3), a Long Night leg's carry, a save's very first run (sim.ts). */
  charmGates?: 1 | 2 | 3;
  carry?: Carry;
  firstRun?: boolean;
  /** Encoded input log (see input.ts). */
  inputs: Uint8Array;
  /** The run's length in ticks. A live run that finished records the tick it crossed the line here
   *  (its log runs on through the coast), so a link's header says when it finished. */
  ticks: number;
  score: number;
  distance: number;
  name: string;
}

const MAGIC0 = 0x47; // G
const MAGIC1 = 0x53; // S
/** 3 (SIM_VERSION 10): a u32 after the name: the charm pool in bits 0 to 23, the gates that stood in 24 and 25 (0 for
 *  all three), bit 26 when a Long Night carry follows (CARRY_BYTES: the lantern as a u16, the get-ups, three charm
 *  ids with 255 for none), bit 27 a save's very first run. Then the log. Bytes 0 to 27 are as version 2's. */
const VERSION = 3;
const POOL_MASK = 0xffffff;
const CARRY_BIT = 1 << 26;
const FIRST_BIT = 1 << 27;
const CARRY_BYTES = 6;

function packPool(r: RunRecord): number {
  const gates = r.charmGates === 1 || r.charmGates === 2 ? r.charmGates : 0;
  return (((r.charmPool ?? STARTER_POOL) & POOL_MASK) | (gates << 24) | (r.carry ? CARRY_BIT : 0) | (r.firstRun ? FIRST_BIT : 0)) >>> 0;
}

export function sanitizeName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9 _.\-]/g, '').trim();
  return (clean || 'Rider').slice(0, 20);
}

export function encodeRecord(r: RunRecord): Uint8Array {
  const name = sanitizeName(r.name);
  const out = new Uint8Array(32 + name.length + (r.carry ? CARRY_BYTES : 0) + r.inputs.length);
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
  // (The legend rides in the mood byte's high half: a mood is 0 to 6, and bytes 0 to 27 keep their layout.)
  u8(r.chaos.mood | (((r.chaos.legend ?? 0) & 15) << 4));
  u8(r.chaos.event);
  u32(r.chaos.seed);
  u8(r.sled);
  u32(r.ticks);
  u32(Math.max(0, Math.round(r.score)));
  u32(Math.max(0, Math.round(r.distance * 10)));
  u8(name.length);
  for (let i = 0; i < name.length; i++) u8(name.charCodeAt(i));
  u32(packPool(r));
  if (r.carry) {
    const c = r.carry;
    const l = Math.max(0, Math.min(300, Math.round(c.lantern)));
    u8(l & 255);
    u8(l >> 8);
    u8(Math.max(0, Math.min(3, c.getUps | 0)));
    for (let i = 0; i < 3; i++) u8(i < c.charms.length && c.charms[i] >= 0 ? c.charms[i] : 255);
  }
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
  const moodByte = u8();
  const mood = (moodByte & 15) as Mood;
  const legend = moodByte >> 4;
  const event = u8() as ChaosEvent;
  const chaosSeed = u32();
  const sled = u8();
  const ticks = u32();
  const score = u32();
  const distance = u32() / 10;
  const nameLen = u8();
  if (o + nameLen + 4 > data.length) throw new Error('run record truncated');
  let name = '';
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(data[o++]);
  const word = u32();
  const charmPool = word & POOL_MASK;
  const gates = (word >>> 24) & 3;
  let carry: Carry | undefined;
  if (word & CARRY_BIT) {
    if (o + CARRY_BYTES > data.length) throw new Error('run record truncated');
    const lantern = data[o] | (data[o + 1] << 8);
    const getUps = data[o + 2];
    const charms = [data[o + 3], data[o + 4], data[o + 5]].filter((v) => v !== 255);
    o += CARRY_BYTES;
    if (lantern > 300 || getUps > 3 || charms.some((v) => v > 23)) throw new Error('run record out of range');
    carry = { lantern, getUps, charms };
  }
  if (mood > 6 || event > 4 || sled > 15) throw new Error('run record out of range');
  return {
    seed,
    chaos: legend ? { mood, event, seed: chaosSeed, legend } : { mood, event, seed: chaosSeed },
    sled,
    ticks,
    score,
    distance,
    name: sanitizeName(name),
    charmPool,
    ...(gates === 1 || gates === 2 ? { charmGates: gates as 1 | 2 } : {}),
    ...(carry ? { carry } : {}),
    ...(word & FIRST_BIT ? { firstRun: true } : {}),
    inputs: data.slice(o),
  };
}

/** A record's fixed header: readable on any sim version (bytes 0 to 27 keep their layout). */
export interface RecordHeader {
  simVersion: number;
  seed: number;
  ticks: number;
  score: number;
  distance: number;
  name: string;
}

/** Reads a record's header without its log. Unlike decodeRecord it takes any sim version, so a link
 *  from an older build still says whose run it was, where, and how far. Throws on what is no record. */
export function readHeader(data: Uint8Array): RecordHeader {
  if (data.length < 28 || data[0] !== MAGIC0 || data[1] !== MAGIC1) throw new Error('not a run record');
  // (Version 2 and 3 share the header: an old link is still read as a target.)
  if (data[2] !== VERSION && data[2] !== 2) throw new Error('unsupported run record version');
  const u32 = (o: number) => (data[o] | (data[o + 1] << 8) | (data[o + 2] << 16) | (data[o + 3] << 24)) >>> 0;
  const nameLen = data[27];
  if (28 + nameLen > data.length) throw new Error('run record truncated');
  let name = '';
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(data[28 + i]);
  return { simVersion: data[3], seed: u32(4), ticks: u32(15), score: u32(19), distance: u32(23) / 10, name: sanitizeName(name) };
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

export function headerFromString(s: string): RecordHeader {
  return readHeader(fromBase64Url(s));
}

/** The SimConfig a record rides on: every replay builds its Sim from this, never by hand. */
export function simConfigOf(r: Pick<RunRecord, 'seed' | 'chaos' | 'sled' | 'charmPool' | 'charmGates' | 'carry' | 'firstRun'>): SimConfig {
  const c: SimConfig = { seed: r.seed, chaos: r.chaos, sled: r.sled, charmPool: r.charmPool ?? STARTER_POOL };
  if (r.charmGates) c.charmGates = r.charmGates;
  if (r.carry) c.carry = r.carry;
  if (r.firstRun) c.firstRun = true;
  return c;
}

/** A log's event token, applied at the start of the tick it precedes: every replay path calls this, so a token
 *  added later reaches them all. */
export function applyLogEvent(sim: Sim, e: LogEvent): void {
  if (e === LogEvent.Revive) sim.revive();
  else if (e === LogEvent.Showdown) sim.showdownWon();
  else if (e === LogEvent.Steal) sim.stealWisp();
}

/** Replay a record to completion (crash or end of log). Calls onTick after each tick. */
export function replayRecord(r: RunRecord, onTick?: (sim: Sim) => void): Sim {
  const sim = new Sim(simConfigOf(r));
  const log = decodeLog(r.inputs);
  for (let t = 0; t < log.inputs.length; t++) {
    const ev = log.events.get(t);
    if (ev) for (const e of ev) applyLogEvent(sim, e);
    sim.step(log.inputs[t]);
    onTick?.(sim);
  }
  return sim;
}
