import { HALL } from '../fx';
import { ePiano, pluck, subBass, wind } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, bassLine, hits, line, pad, progression, roll, stepsPerBar, up } from '../notation';
import { FRAME_DRUM, KICK_SOFT, RIM, chimes, kick, shaker, skin, snare, wood } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, type StingBand, buildShot, fxTracks, hitShot, stinger } from './common';

// Sakura Ridge: plucked strings and a breathy bamboo flute over a warm, laid-back groove. A koto-like
// pluck has the verse and a bamboo flute the hook; under them an electric piano in sevenths and ninths,
// a soft sub, a kick behind the beat, a rim on two and four, a shaker with a lilt. Ab major at 84 with the
// sixteenths swung: the slowest pulse of the five, the mountain you ride to feel good. The tunes keep to
// the five-note scale; the hook ends on the minor fourth, the one bittersweet turn. The last stage lifts
// a tone to Bb with a frame drum and the koto in octaves.

const g: Grid = { bpm: 84, beats: 4, div: 4, swing: 0.18 };
const K: Key = { pc: 8, mode: 'major' };
const UP: Key = { pc: 10, mode: 'major' };
const BS = stepsPerBar(g);

const tracks: Track[] = [
  { id: 'keys', family: 'electric piano', inst: ePiano(), layer: 'bed', gain: -23, verb: 0.25, duck: 0.12, chorus: 0.3 },
  { id: 'harp', family: 'plucked strings', inst: pluck({ bright: 0.45, decay: 3, pick: 0.4, body: 'harp', ringOut: true }), layer: 'bed', gain: -27, pan: 0.4, verb: 0.3, human: [8, 0.1] },
  { id: 'kick', family: 'soft kick', inst: kick(KICK_SOFT), layer: 'drive', gain: -20, kick: true, human: [6, 0.08] },
  { id: 'rim', family: 'rim', inst: snare(RIM), layer: 'drive', gain: -25, pan: 0.1, verb: 0.3, human: [8, 0.1] },
  { id: 'shaker', family: 'shaker', inst: shaker(3800, 9500), layer: 'drive', gain: -31, pan: -0.3, human: [7, 0.15] },
  { id: 'block', family: 'wood block', inst: wood(0.08), layer: 'drive', gain: -30, pan: 0.5, verb: 0.3 },
  { id: 'sub', family: 'sub bass', inst: subBass(0.35, 0.012, 0.09), layer: 'drive', gain: -22, duck: 0.2 },
  { id: 'koto', family: 'koto-like pluck', inst: pluck({ bright: 0.82, decay: 2.2, pick: 0.1, body: 'koto', ringOut: true }), layer: 'lead', gain: -19, pan: -0.15, verb: 0.3, echo: 0.12, human: [9, 0.1] },
  { id: 'flute', family: 'bamboo flute', inst: wind({ kind: 'shaku', breath: 0.55, vib: 14, scoop: 45 }), layer: 'lead', gain: -18.5, pan: 0.12, verb: 0.38, echo: 0.1, human: [10, 0.06] },
  { id: 'koto2', family: 'koto-like pluck', inst: pluck({ bright: 0.9, decay: 1.6, pick: 0.08, body: 'koto', ringOut: true }), layer: 'peak', gain: -25, pan: 0.45, verb: 0.3, human: [8, 0.1] },
  { id: 'frame', family: 'frame drum', inst: skin(FRAME_DRUM), layer: 'peak', gain: -24, verb: 0.3, human: [6, 0.08] },
  { id: 'chimes', family: 'wind chimes', inst: chimes(false, 12), layer: 'peak', gain: -31, verb: 0.4 },
  ...fxTracks(0.2, 4200),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 0.95): Note[] => line(src, g, key, oct, v, leg);

const VERSE = "1:4 3:2 5:2 6:4 5:2 3:2 | 5:4 3:2 2:2 3:8 | 6:4 1':2 6:2 5:4 3:4 | 1':6 6:2 5:8 | 1:4 3:2 5:2 1':4 6:2 5:2 | 2:4 6:2 5:2 6:8 | 5:4 1':2 2':2 1':4 5:4 | 3:6 2:2 1:8";
/** The hook: the motif's dotted rhythm at every bar's head, a fall and a rise, the flat sixth at the end. */
const HOOK = "6:6 5:2 3:4 1:4 | 2:6 3:2 5:8 | 5:6 6:2 5:4 3:4 | 1':8 6:8 | 6:6 1':2 2':4 1':4 | 2':6 1':2 6:4 5:4 | 6:6 5:2 3:4 5:4 | b6:8 5:8";
const CALL = "3':6 2':2 1':8 | r:16 | 1':6 6:2 5:8 | r:16 | 3':6 2':2 1':4 6:4 | r:16 | 2':6 1':2 6:8 | r:16";
const REPLY = "r:16 | 6:2 1':2 6:2 5:2 3:4 5:4 | r:16 | 5:2 6:2 5:2 3:2 2:4 3:4 | r:16 | 6:2 1':2 2':2 1':2 6:4 5:4 | r:16 | 5:2 6:2 1':2 2':2 3':8";
const TORII = "r:8 5:2 6:2 1':4 | r:16 | r:8 6:2 1':2 2':4 | r:16 | r:8 1':2 2':2 3':4 | r:8 2':2 1':2 6:4 | 5:8 3:8 | 2:16";

function intro(): Section {
  const chords = 'Imaj7 | Imaj7 | IVmaj7 | IVmaj7';
  const p = progression(chords, BS);
  return {
    id: 'intro', role: 'intro', bars: 4, key: K, chords,
    parts: {
      keys: pad(p, g, K, 56, 4, 0.55),
      harp: arp(p, g, K, 68, 4, 4, [0, 2, 1, 3], 4, 0.5, 6),
      koto: L("r:16 | r:8 5:4 6:4 | 1':12 6:4 | 5:8 3:8", K, 4, 0.6, 1),
      shaker: hits('................ ................ x.o.x.o.x.o.x.o. x.o.x.o.x.o.x.o.', g, 4),
      chimes: [{ t: 0.2, dur: 2.5, m: 80, v: 0.6 }],
    },
  };
}

function verse(): Section {
  const chords = 'Imaj7 | iii7 | vi7 | IVmaj7 | Imaj7 | ii7 | Vsus4 | Imaj7';
  const p = progression(chords, BS);
  return {
    id: 'a', role: 'low', bars: 8, key: K, chords, tune: VERSE,
    parts: {
      keys: pad(p, g, K, 56, 4, 0.6),
      harp: arp(p, g, K, 68, 4, 4, [0, 2, 1, 3], 8, 0.45, 6),
      kick: hits('X......x..x.....', g, 8),
      rim: hits('....x.......x...', g, 8),
      shaker: hits('x.o.x.o.x.o.x.o.', g, 8),
      sub: bassLine(p, g, K, 32, '1.....1...5.....', 8, 0.8),
      koto: L(VERSE, K, 4, 0.8, 1),
      flute: L("r:16 | r:16 | r:16 | r:8 5:4 6:4 | r:16 | r:16 | r:16 | r:8 3:4 5:4", K, 5, 0.55, 1),
      koto2: arp(p, g, K, 68, 3, 2, [0, 1, 2, 1], 8, 0.45, 2),
    },
  };
}

function chorus(id: string, key: Key, role: Section['role']): Section {
  const big = role === 'climax';
  const chords = 'IVmaj7 | V | iii7 | vi7 | ii7 | V | IVmaj7 | iv6';
  const p = progression(chords, BS);
  const hook = L(HOOK, key, 5, 0.88, 1);
  return {
    id, role, bars: 8, key, chords, tune: HOOK,
    parts: {
      keys: pad(p, g, key, 56, 4, 0.7),
      harp: arp(p, g, key, 68, 4, 2, [0, 2, 1, 3, 2, 1], 8, 0.5, 4),
      kick: hits('X......x..X..x..', g, 8),
      rim: hits('....X.......X...', g, 8),
      shaker: hits('x.oxx.o.x.oxx.o.', g, 8),
      block: hits('..........x.....', g, 8, 76),
      sub: bassLine(p, g, key, 32, '1.....1...5...a.', 8, 0.9),
      flute: hook,
      koto: L("r:8 3:2 5:2 6:4 | r:8 2:2 3:2 5:4 | r:8 3:2 5:2 3:4 | r:8 6:2 5:2 3:4 | r:8 1':2 6:2 4:4 | r:8 5:2 2:2 5:4 | r:8 1:2 3:2 6:4 | r:16", key, 4, 0.7, 1),
      koto2: big ? up(L(HOOK, key, 4, 0.7, 1), 0) : arp(p, g, key, 68, 3, 2, [0, 1, 2, 1], 8, 0.45, 2),
      frame: hits(big ? 'X..x..x.X..x.xx.' : 'X.......x..x....', g, 8, 45),
      chimes: [{ t: 0, dur: 2, m: 82, v: 0.6 }],
    },
  };
}

function duet(id: string, key: Key, role: Section['role']): Section {
  const climb = role === 'climb';
  const chords = 'vi7 | IVmaj7 | Imaj7 | V | vi7 | IVmaj7 | ii7 | Vsus4';
  const p = progression(chords, BS);
  return {
    id, role, bars: 8, key, chords, tune: CALL,
    parts: {
      keys: pad(p, g, key, 56, 4, 0.65),
      harp: arp(p, g, key, 68, 4, 2, [0, 2, 1, 3, 2, 1], 8, 0.5, 4),
      kick: hits(climb ? 'X......x..X.....' : 'X.........x.....', g, 8),
      rim: hits('....x.......x...', g, 8),
      shaker: hits('x.o.x.o.x.o.x.o.', g, 8),
      block: climb ? hits('..x.......x.....', g, 8, 76) : [],
      sub: bassLine(p, g, key, 32, '1.........1.....', 8, 0.8),
      flute: L(CALL, key, 4, 0.8, 1),
      koto: L(REPLY, key, 4, 0.8, 1),
      koto2: climb ? up(L(REPLY, key, 4, 0.6, 1), 12) : [],
      frame: hits(climb ? 'X..x..x.X..x..x.' : 'X.........x.....', g, 8, 45),
    },
  };
}

function torii(): Section {
  const chords = 'Imaj7 | Imaj7 | IVmaj7 | IVmaj7 | ii7 | V | Imaj7 | V';
  const p = progression(chords, BS);
  return {
    id: 'd', role: 'mid', bars: 8, key: K, chords, tune: TORII,
    parts: {
      keys: pad(p, g, K, 56, 4, 0.6),
      kick: hits('X..x......X.....', g, 8),
      rim: hits('....x..x....x...', g, 8),
      shaker: hits('xoxoxoxoxoxoxoxo', g, 8, 60, 0.9),
      block: hits('..x...x...x...x.', g, 8, 76),
      sub: bassLine(p, g, K, 32, '1..1......5.....', 8, 0.85),
      koto: arp(p, g, K, 68, 4, 1, [0, 2, 1, 3, 2, 1, 2, 3], 8, 0.65, 2),
      flute: L(TORII, K, 5, 0.8, 1),
      koto2: arp(p, g, K, 80, 3, 2, [2, 1, 0, 1], 8, 0.5, 2),
      frame: hits('X.....x.x.....x.', g, 8, 45),
    },
  };
}

function breakdown(): Section {
  const chords = 'IVmaj7 | iii7 | ii7 | Vsus4';
  const p = progression(chords, BS);
  return {
    id: 'bd', role: 'break', bars: 4, key: K, chords,
    parts: {
      keys: pad(p, g, K, 56, 4, 0.5),
      harp: arp(p, g, K, 68, 4, 2, [0, 2, 1, 3], 4, 0.45, 6),
      flute: L('6:16 | 5:16 | 4:16 | 5:8 2:8', K, 4, 0.5, 1),
      chimes: [{ t: 0, dur: 3, m: 80, v: 0.5 }],
    },
  };
}

function finale(): Section {
  const chords = 'I V | IV V | Imaj7 | Imaj7';
  const p = progression(chords, BS);
  const fan = `${MOTIF[0]} | 6:6 7:2 2':8 | 1':16 | -:16`;
  return {
    id: 'fin', role: 'finale', bars: 4, key: UP, chords, tune: fan,
    parts: {
      keys: pad(p, g, UP, 56, 4, 0.8),
      harp: arp(p, g, UP, 68, 4, 1, [0, 1, 2, 3, 2, 1], 4, 0.6, 3),
      kick: hits('X......x..X..... X......x..X..x.. X............... ................', g, 4),
      rim: hits('....X.......X... ....X.......X.x. X............... ................', g, 4),
      frame: hits('X..x..x.X..x..x. X..x..x.X.xxX.xx X............... ................', g, 4, 45),
      sub: bassLine(p, g, UP, 32, '1.......1....... 1.......1....... 1............... ................', 4, 0.9),
      crash: [{ t: 2 * BS * (60 / g.bpm / 4), dur: 3, m: 60, v: 0.8 }],
      chimes: [{ t: 2 * BS * (60 / g.bpm / 4), dur: 3, m: 82, v: 0.8 }],
      flute: L(fan, UP, 5, 0.9, 1),
      koto: L(fan, UP, 4, 0.9, 1),
      koto2: up(L(fan, UP, 4, 0.75, 1), 12),
    },
  };
}

function results(): Section {
  const chords = 'I V | IVmaj7 I/3 | ii7 V | Imaj7 | vi7 IVmaj7 | I/5 V | IVmaj7 V | Imaj7';
  const p = progression(chords, BS);
  const tune = `${MOTIF.join(' | ')} | 3:6 6:2 5:4 4:4 | 5:6 3:2 2:8 | 4:6 6:2 5:4 7:4 | 1':16`;
  return {
    id: 'res', role: 'results', bars: 8, key: UP, chords, tune,
    parts: {
      keys: pad(p, g, UP, 56, 4, 0.55),
      harp: arp(p, g, UP, 68, 4, 2, [0, 2, 1, 3], 8, 0.45, 4),
      shaker: hits('..o...o...o...o.', g, 8),
      sub: bassLine(p, g, UP, 32, '1.......1.......', 8, 0.7),
      koto: L(tune, UP, 4, 0.7, 1),
      flute: L("r:16 | r:16 | r:16 | r:8 5:4 1':4 | r:16 | r:16 | r:16 | r:8 3:4 1:4", UP, 5, 0.45, 1),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'flute', oct: 5 }, { track: 'koto', oct: 4, vel: 0.8 }],
  low: [{ track: 'koto', oct: 3 }, { track: 'sub', oct: 1 }],
  bell: [{ track: 'koto', oct: 5 }, { track: 'koto2', oct: 5, vel: 0.7 }],
  perc: [{ track: 'frame', m: 45 }, { track: 'block', m: 76, vel: 0.8 }],
  hold: [{ track: 'keys', oct: 3, vel: 0.7 }],
};

export const sakura: Piece = {
  id: 'sakura',
  name: 'Sakura Ridge',
  style: 'plucked strings and a breathy bamboo flute over a warm, laid-back groove: electric piano, a soft sub and kick, a rim, a shaker, a frame drum',
  grid: g,
  key: K,
  tracks,
  sections: [intro(), verse(), chorus('b', K, 'high'), duet('c', K, 'mid'), torii(), breakdown(), chorus('b2', UP, 'climax'), duet('c2', UP, 'climb'), finale(), results()],
  shots: [
    buildShot(g, K, 2, { frame: [...roll(g, 0, 16, 2, 0.25, 0.5, 45), ...roll(g, 16, 32, 1, 0.5, 0.95, 45)], chimes: [{ t: 0, dur: 3.5, m: 76, v: 0.7 }], swell: [{ t: 1.5, dur: 3, m: 60, v: 0.6 }] }),
    hitShot({ frame: [{ t: 0, dur: 0.5, m: 40, v: 1 }], kick: [{ t: 0, dur: 0.2, m: 60, v: 1 }] }),
    ...GESTURES.map((x) => stinger(x, g, K, band)),
  ],
  verb: { ...HALL, t60: 2, damp: 5200 },
  echo: { steps: 3, feedback: 0.3 },
  master: { eq: [['hp', 30, 0.7], ['peak', 220, 1, 1], ['hishelf', 10000, 0.7, 1]], comp: { threshold: -16, ratio: 1.8, attack: 0.03, release: 0.25, knee: 10 }, width: 1.1 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
