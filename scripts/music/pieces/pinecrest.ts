import { HALL } from '../fx';
import { bowed, brass, glock, pluck, wind } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, at, bassLine, hits, line, pad, progression, roll, stabs, stepsPerBar, strum, up } from '../notation';
import { SNARE_FIELD, claps, jingles, shaker, snare, stomp } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, type StingBand, buildShot, downbeats, fxTracks, hitShot, stinger } from './common';

// Pinecrest: bright folk-orchestral. A fiddle carries the tunes over two strummed guitars, an upright
// bass, stomps and claps on a wooden floor, a tambourine; a tin whistle answers, horns and trumpets come
// in when the run opens up. D major at 116, a reel's steady eighths with the lightest swing. The first
// morning of a holiday: open strings, major chords, a hook that climbs to the octave and the tenth. The
// last stage lifts a whole tone to E, the gold coming, and the finale is the game's motif on everything.

const g: Grid = { bpm: 116, beats: 4, div: 4, swing: 0.05 };
const D: Key = { pc: 2, mode: 'major' };
const E: Key = { pc: 4, mode: 'major' };
const BS = stepsPerBar(g);

const tracks: Track[] = [
  { id: 'gtrL', family: 'acoustic guitar', inst: pluck({ bright: 0.62, decay: 3.2, pick: 0.18, body: 'guitar' }), layer: 'bed', gain: -23, pan: -0.6, verb: 0.1, human: [7, 0.1], eq: [['hp', 95, 0.7]] },
  { id: 'gtrR', family: 'acoustic guitar', inst: pluck({ bright: 0.55, decay: 3, pick: 0.24, body: 'guitar' }), layer: 'bed', gain: -23, pan: 0.6, verb: 0.1, human: [7, 0.1], eq: [['hp', 95, 0.7]] },
  { id: 'chk', family: 'acoustic guitar', inst: pluck({ bright: 0.7, decay: 1, pick: 0.2, body: 'guitar', mute: true }), layer: 'bed', gain: -30, pan: 0.2, human: [5, 0.1] },
  { id: 'strings', family: 'string section', inst: bowed({ body: 'cello', voices: 5, bright: 0.45, vib: 9, attack: 0.25 }), layer: 'bed', gain: -27, verb: 0.35, duck: 0.12 },
  { id: 'bass', family: 'upright bass', inst: pluck({ bright: 0.22, decay: 1.7, pick: 0.3, body: 'bass' }), layer: 'drive', gain: -21, human: [5, 0.06], comp: { threshold: -18, ratio: 3, attack: 0.01, release: 0.12 } },
  { id: 'stomp', family: 'stomps', inst: stomp(), layer: 'drive', gain: -20, kick: true, human: [4, 0.06] },
  { id: 'clap', family: 'claps', inst: claps(5), layer: 'drive', gain: -23, verb: 0.18 },
  { id: 'tamb', family: 'tambourine', inst: jingles(7, 5200, 0.15), layer: 'drive', gain: -31, pan: 0.3, verb: 0.1, human: [5, 0.15] },
  { id: 'shaker', family: 'shaker', inst: shaker(), layer: 'drive', gain: -33, pan: -0.3, human: [5, 0.15] },
  { id: 'fiddle', family: 'fiddle', inst: bowed({ body: 'violin', voices: 1, bright: 0.72, vib: 16, attack: 0.035 }), layer: 'lead', gain: -17.5, pan: -0.12, verb: 0.26, echo: 0.06, human: [8, 0.08] },
  { id: 'whistle', family: 'tin whistle', inst: wind({ kind: 'whistle', breath: 0.22, vib: 10, scoop: 25 }), layer: 'lead', gain: -21, pan: 0.25, verb: 0.3, human: [8, 0.06] },
  { id: 'horns', family: 'horns', inst: brass({ kind: 'horn', voices: 3, swell: 0.5 }), layer: 'peak', gain: -23, verb: 0.3 },
  { id: 'tpt', family: 'trumpets', inst: brass({ kind: 'trumpet', voices: 2 }), layer: 'peak', gain: -21.5, pan: 0.15, verb: 0.28, human: [6, 0.05] },
  { id: 'mando', family: 'mandolin', inst: pluck({ bright: 0.8, decay: 0.9, pick: 0.12, body: 'mando' }), layer: 'peak', gain: -27, pan: 0.45, verb: 0.15, human: [5, 0.12] },
  { id: 'glock', family: 'glockenspiel', inst: glock(), layer: 'peak', gain: -29, pan: -0.3, verb: 0.4 },
  { id: 'roll', family: 'field drum', inst: snare(SNARE_FIELD), layer: 'drive', gain: -25, verb: 0.15 },
  ...fxTracks(0.25),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 0.92): Note[] => line(src, g, key, oct, v, leg);

/** The verse's tune: a reel, eighths that run through the chords and turn on a passing note. */
const TUNE_A = "5:2 6:2 5:2 3:2 1:2 3:2 5:2 1':2 | 6:2 1':2 6:2 4:2 1:2 4:2 6:4 | 5:2 6:2 5:2 3:2 1:2 2:2 3:2 5:2 | 2:2 3:2 2:2 7,:2 5,:2 7,:2 2:4 | 3:2 6:2 1':2 6:2 3':4 1':2 6:2 | 1':2 6:2 4:2 6:2 1':2 2':2 1':2 6:2 | 5:2 1':2 3':2 1':2 2':2 7:2 5:2 7:2 | 1':8 r:4 5:2 6:2";
/** The hook: every bar a dotted quarter and an eighth (the motif's rhythm), climbing to the tenth. */
const HOOK = "1':6 7:2 6:4 4:4 | 5:6 3:2 5:8 | 2':6 1':2 7:4 5:4 | 6:6 1':2 3':8 | 4':6 3':2 1':4 6:4 | 5:6 1':2 3':8 | 2':4 3':2 2':2 7:4 2':4 | 1':12 r:4";
/** The second strain: the relative minor, warmer and lower, turning through the flat seventh. */
const STRAIN = "3:4 6:4 1':6 7:2 | 6:8 4:4 6:4 | 5:4 1':4 3':6 2':2 | 2':8 7:4 5:4 | 3':4 1':4 6:6 1':2 | 6:4 1':4 4':6 3':2 | b7:4 2':4 4':4 2':4 | 2':4 7:4 5:8";

function intro(): Section {
  const chords = 'I | I | IV | Vsus4';
  const p = progression(chords, BS);
  return {
    id: 'intro', role: 'intro', bars: 4, key: D, chords,
    parts: {
      gtrL: arp(p, g, D, 50, 4, 2, [0, 2, 1, 2, 3, 2, 1, 2], 4, 0.7, 4),
      gtrR: strum(p, g, D, '................ ................ d.......d...U... d...d.U.d.U.D...', 4, 0.6).open,
      strings: pad(p, g, D, 50, 3, 0.45),
      fiddle: L("r:16 | 5:16 | 6:12 5:4 | 5:8 2:4 3:4", D, 4, 0.6, 1),
      shaker: hits('................ ................ x.o.x.o.x.o.x.o. x.o.x.o.x.o.x.o.', g, 4),
      stomp: hits('................ ................ x............... x.......x.......', g, 4),
    },
  };
}

function verse(): Section {
  const chords = 'I | IV | I | V | vi | IV | I/5 V | I';
  const p = progression(chords, BS);
  const tune = L(TUNE_A, D, 4, 0.78);
  return {
    id: 'a', role: 'low', bars: 8, key: D, chords, tune: TUNE_A,
    parts: {
      gtrL: strum(p, g, D, 'D...d.U...U.d.U.', 8, 0.72).open,
      gtrR: strum(p, g, D, 'd...D.U.d...D.U.', 8, 0.68).open,
      strings: pad(p, g, D, 48, 3, 0.45),
      bass: bassLine(p, g, D, 38, '1.......5.....a.', 8),
      stomp: hits('X.......x.......', g, 8),
      clap: hits('....o.......o...', g, 8),
      shaker: hits('x.o.x.o.x.o.x.o.', g, 8),
      fiddle: tune,
      mando: arp(p, g, D, 62, 3, 1, [0, 1, 2, 1], 8, 0.55, 1),
      glock: downbeats(tune, g, 24, 0.55),
    },
  };
}

function chorus(id: string, key: Key, role: Section['role']): Section {
  const chords = 'IV | I | V | vi | IV | I/3 | V | I';
  const p = progression(chords, BS);
  const hook = L(HOOK, key, 4, 0.9, 0.97);
  const s = strum(p, g, key, 'D.x.D.U.x.U.D.U.', 8, 0.82);
  const s2 = strum(p, g, key, 'D...D.U.x.U.D.UU', 8, 0.8);
  const big = role === 'climax';
  return {
    id, role, bars: 8, key, chords, tune: HOOK,
    parts: {
      gtrL: s.open,
      gtrR: s2.open,
      chk: [...s.muted, ...s2.muted],
      strings: pad(p, g, key, 50, 4, 0.6),
      bass: bassLine(p, g, key, 38, '1...3...5...a...', 8, 0.9),
      stomp: hits('X...X...X...X...', g, 8),
      clap: hits('....X.......X...', g, 8),
      tamb: hits('..x...x...x...x.', g, 8),
      shaker: hits('xgogxgogxgogxgog', g, 8),
      fiddle: hook,
      whistle: big ? up(L(HOOK, key, 4, 0.75, 0.95), 12) : at(up(L("4':6 3':2 1':4 6:4 | 5:6 1':2 3':8 | 2':4 3':2 2':2 7:4 2':4 | 1':12 r:4", key, 4, 0.7, 0.95), 12), g, 4),
      horns: pad(p, g, key, 55, 3, 0.75),
      tpt: L("r:16 | r:8 3:2 5:2 1':4 | r:16 | r:8 6:2 1':2 3':4 | r:16 | r:8 5:2 1':2 3':4 | r:16 | r:4 5:2 5:2 1':8", key, 4, 0.85, 0.85),
      mando: big ? arp(p, g, key, 64, 3, 1, [0, 1, 2, 1], 8, 0.6, 1) : [],
      glock: downbeats(hook, g, 24, 0.7),
    },
  };
}

function strain(id: string, key: Key, role: Section['role']): Section {
  const chords = 'vi | IV | I | V | vi | IV | bVII | V';
  const p = progression(chords, BS);
  const climb = role === 'climb';
  return {
    id, role, bars: 8, key, chords, tune: STRAIN,
    parts: {
      gtrL: arp(p, g, key, 50, 4, 2, [0, 2, 1, 2, 3, 2, 1, 2], 8, 0.72, 4),
      gtrR: strum(p, g, key, climb ? 'D...d.U.d.U.D.U.' : 'D.......d...U...', 8, 0.66).open,
      strings: pad(p, g, key, 48, 4, 0.75),
      bass: bassLine(p, g, key, 38, climb ? '1...1...5...a...' : '1.......1...5...', 8),
      stomp: hits(climb ? 'X...x...X...x...' : 'X.........x.....', g, 8),
      clap: hits('........X.......', g, 8),
      shaker: hits('x.o.x.o.x.o.x.o.', g, 8),
      tamb: climb ? hits('..x...x...x...x.', g, 8) : [],
      fiddle: L(STRAIN, key, 4, 0.82, 0.98),
      whistle: at(up(L("r:8 5:2 6:2 1':4 | r:16 | r:8 7:2 2':2 5':4", key, 4, 0.6), 12), g, 1).concat(at(up(L("r:8 6:2 1':2 4':4 | r:16 | r:8 7:2 2':2 5':4", key, 4, 0.6), 12), g, 5)),
      horns: pad(p, g, key, 52, 3, 0.8),
      tpt: climb ? at(L("5:6 5:2 2':8", key, 4, 0.8), g, 7) : [],
      glock: climb ? arp(p, g, key, 74, 3, 4, [0, 2, 1, 2], 8, 0.5, 6) : [],
    },
  };
}

function reel(): Section {
  const chords = 'I | IV | I | V | IV | I/3 | ii V | I';
  const p = progression(chords, BS);
  const src = TUNE_A.split(' | ').slice(0, 4).join(' | ') + " | 6:2 1':2 6:2 4:2 6:2 1':2 2':4 | 3':2 1':2 5:2 1':2 3':2 5':2 3':4 | 2:2 4:2 6:2 4:2 2':2 7:2 5:2 7:2 | 1':8 r:8";
  return {
    id: 'd', role: 'mid', bars: 8, key: D, chords, tune: src,
    parts: {
      gtrL: strum(p, g, D, 'D...d.U...U.d.U.', 8, 0.74).open,
      gtrR: strum(p, g, D, 'd.U.D...d.U.D.U.', 8, 0.7).open,
      strings: pad(p, g, D, 48, 3, 0.5),
      bass: bassLine(p, g, D, 38, '1...5...1...a...', 8),
      stomp: hits('X.......X.....x.', g, 8),
      clap: hits('....x.......x...', g, 8),
      tamb: hits('..o...o...o...o.', g, 8),
      shaker: hits('x.o.x.o.x.o.x.o.', g, 8),
      whistle: L(src, D, 5, 0.8),
      // The fiddle chops the off beats in double stops while the whistle has the tune.
      fiddle: stabs(p, g, D, 62, 2, '..x...x...x...x.', 8, 0.6, 1.4),
      horns: pad(p, g, D, 55, 3, 0.6),
      mando: arp(p, g, D, 62, 3, 1, [0, 2, 1, 2], 8, 0.55, 1),
    },
  };
}

function breakdown(): Section {
  const chords = 'IV | I/3 | ii7 | Vsus4';
  const p = progression(chords, BS);
  return {
    id: 'bd', role: 'break', bars: 4, key: D, chords,
    parts: {
      gtrL: arp(p, g, D, 50, 4, 2, [0, 2, 1, 3, 2, 1, 2, 3], 4, 0.6, 4),
      strings: pad(p, g, D, 50, 4, 0.5),
      shaker: hits('..o...o...o...o.', g, 4),
      fiddle: L('6:16 | 5:16 | 4:16 | 5:8 2:8', D, 4, 0.5, 1),
    },
  };
}

function finale(key: Key): Section {
  const chords = 'I V | IV V | I | I';
  const p = progression(chords, BS);
  const fan = `${MOTIF[0]} | 6:6 7:2 2':8 | 1':16 | -:16`;
  return {
    id: 'fin', role: 'finale', bars: 4, key, chords, tune: fan,
    parts: {
      gtrL: strum(p, g, key, 'D...D...D...D... D...D...D...D.U. D............... ................', 4, 0.9).open,
      gtrR: strum(p, g, key, 'D...D.U.D...D.U. D...D.U.D...D.UU D............... ................', 4, 0.9).open,
      strings: pad(p, g, key, 50, 4, 0.8),
      bass: bassLine(p, g, key, 38, '1...1...1...1... 1...1...1...1.1. 1............... ................', 4, 0.95),
      stomp: hits('X...X...X...X... X...X...X...X.X. X............... ................', g, 4),
      clap: hits('....X.......X... ....X.......X.X. X............... ................', g, 4),
      tamb: hits('..x...x...x...x. ..x...x...x...x. X............... ................', g, 4),
      roll: roll(g, 24, 32, 1, 0.3, 0.9),
      crash: [{ t: 0, dur: 2, m: 60, v: 0.9 }, { t: 2 * BS * (60 / g.bpm / 4), dur: 3, m: 60, v: 1 }],
      fiddle: L(fan, key, 4, 0.95, 1),
      whistle: up(L(fan, key, 4, 0.8, 1), 12),
      tpt: L(fan, key, 4, 0.95, 1),
      horns: pad(p, g, key, 52, 4, 0.9),
      glock: up(L(fan, key, 4, 0.7, 1), 24),
    },
  };
}

function results(key: Key): Section {
  const chords = 'I V | IV I/3 | ii V | I | vi IV | I/5 V | IV V | I';
  const p = progression(chords, BS);
  const tune = `${MOTIF.join(' | ')} | 3:6 6:2 5:4 4:4 | 5:6 3:2 2:8 | 4:6 6:2 5:4 7:4 | 1':16`;
  return {
    id: 'res', role: 'results', bars: 8, key, chords, tune,
    parts: {
      gtrL: arp(p, g, key, 50, 4, 2, [0, 2, 1, 2, 3, 2, 1, 2], 8, 0.6, 4),
      gtrR: strum(p, g, key, 'd.......d...U...', 8, 0.5).open,
      strings: pad(p, g, key, 50, 3, 0.5),
      bass: bassLine(p, g, key, 38, '1.......1.......', 8, 0.7),
      shaker: hits('..o...o...o...o.', g, 8),
      fiddle: L(tune, key, 4, 0.6, 1),
      whistle: at(up(L("r:8 5:2 1':2 3':4", key, 4, 0.45), 12), g, 3).concat(at(up(L("r:8 3':2 2':2 1':4", key, 4, 0.45), 12), g, 7)),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'fiddle', oct: 4 }, { track: 'tpt', oct: 4, vel: 0.8 }],
  low: [{ track: 'horns', oct: 3, vel: 0.9 }, { track: 'bass', oct: 2 }],
  bell: [{ track: 'glock', oct: 5 }, { track: 'mando', oct: 4, vel: 0.8 }],
  perc: [{ track: 'stomp', m: 60 }, { track: 'clap', m: 60, vel: 0.7 }],
  hold: [{ track: 'strings', oct: 3, vel: 0.7 }, { track: 'horns', oct: 3, vel: 0.6 }],
};

export const pinecrest: Piece = {
  id: 'pinecrest',
  name: 'Pinecrest',
  style: 'bright folk-orchestral: fiddle, two strummed guitars, upright bass, stomps and claps, a tin whistle, horns and trumpets',
  grid: g,
  key: D,
  tracks,
  sections: [intro(), verse(), chorus('b', D, 'high'), strain('c', D, 'mid'), reel(), breakdown(), chorus('b2', E, 'climax'), strain('c2', E, 'climb'), finale(E), results(E)],
  shots: [
    buildShot(g, D, 2, { roll: [...roll(g, 0, 16, 2, 0.2, 0.5), ...roll(g, 16, 32, 1, 0.5, 1)], swell: [{ t: 0, dur: 4, m: 60, v: 0.7 }], stomp: hits('................ ........x...x.x.', g, 2) }),
    hitShot({ stomp: [{ t: 0, dur: 0.2, m: 60, v: 1 }], clap: [{ t: 0, dur: 0.2, m: 60, v: 1 }] }),
    ...GESTURES.map((x) => stinger(x, g, D, band)),
  ],
  verb: { ...HALL, t60: 1.7, size: 0.8 },
  echo: { steps: 3, feedback: 0.25 },
  master: { eq: [['hp', 32, 0.7], ['peak', 3200, 0.8, 1], ['hishelf', 9000, 0.7, 1.5]], comp: { threshold: -15, ratio: 2, attack: 0.02, release: 0.2, knee: 8 }, width: 1.05 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
