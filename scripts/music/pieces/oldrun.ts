import { HALL } from '../fx';
import { brass, churchBell, marimba, pluck, wind } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, at, bassLine, hits, line, pad, progression, roll, stabs, stepsPerBar, up } from '../notation';
import { BASS_DRUM, SNARE_CRISP, jingles, skin, snare } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, OWN_GESTURES, type StingBand, buildShot, downbeats, fxTracks, hitShot, stinger } from './common';

// The Old Run (round 9): a galop, the grand hotel's band out on the ice for the race. A tuba's oom on every beat and
// the trombones' pah off it, cornets with the tunes, a piccolo over them, pizzicato strings, a snare and a bass drum,
// sleigh bells, a xylophone, and tubular bells for the bends. A major at 152, straight: quick repeated notes and runs
// up the scale, the sled into a bend and out of it. The trio drops to the relative minor and the trombones sing it;
// the last stage lifts a whole tone to B, and the finale is the game's motif on the whole band. Original.

const g: Grid = { bpm: 152, beats: 4, div: 4, swing: 0 };
const A: Key = { pc: 9, mode: 'major' };
const B: Key = { pc: 11, mode: 'major' };
const BS = stepsPerBar(g);

const tracks: Track[] = [
  { id: 'tuba', family: 'tuba', inst: brass({ kind: 'tuba', voices: 1 }), layer: 'drive', gain: -21, eq: [['hp', 50, 0.7]], human: [5, 0.06], comp: { threshold: -18, ratio: 3, attack: 0.01, release: 0.12 } },
  { id: 'bones', family: 'trombones', inst: brass({ kind: 'trombone', voices: 3 }), layer: 'bed', gain: -25, pan: -0.2, verb: 0.2, human: [6, 0.08] },
  { id: 'pizz', family: 'pizzicato strings', inst: pluck({ bright: 0.58, decay: 0.45, pick: 0.2, body: 'harp' }), layer: 'bed', gain: -27, pan: 0.35, verb: 0.18, human: [5, 0.1] },
  { id: 'snare', family: 'snare drum', inst: snare(SNARE_CRISP), layer: 'drive', gain: -25, pan: 0.1, verb: 0.12, human: [4, 0.1] },
  { id: 'bdrum', family: 'bass drum', inst: skin(BASS_DRUM), layer: 'drive', gain: -21, kick: true, human: [4, 0.05] },
  { id: 'sleigh', family: 'sleigh bells', inst: jingles(9, 6000, 0.12), layer: 'drive', gain: -27, pan: -0.35, verb: 0.12, human: [5, 0.15] },
  { id: 'cornet', family: 'cornets', inst: brass({ kind: 'trumpet', voices: 2 }), layer: 'lead', gain: -18, pan: 0.1, verb: 0.22, echo: 0.04, human: [6, 0.06] },
  { id: 'piccolo', family: 'piccolo', inst: wind({ kind: 'flute', breath: 0.12, vib: 9, scoop: 8 }), layer: 'lead', gain: -21, pan: -0.25, verb: 0.25, human: [6, 0.06] },
  { id: 'xylo', family: 'xylophone', inst: marimba(), layer: 'peak', gain: -26, pan: 0.4, verb: 0.2, human: [4, 0.1] },
  { id: 'bells', family: 'tubular bells', inst: churchBell(), layer: 'peak', gain: -28, pan: -0.15, verb: 0.45 },
  ...fxTracks(0.3),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 0.92): Note[] => line(src, g, key, oct, v, leg);

/** The verse's tune: three quick notes and a run, every two bars, over I IV V I. */
const TUNE_A = "3:2 3:2 3:2 4:2 5:4 3:4 | 6:2 6:2 6:2 5:2 4:4 1:4 | 2:2 2:2 2:2 3:2 4:4 7,:4 | 1:2 3:2 5:2 1':2 5:8 | 3:2 3:2 3:2 4:2 5:4 1':4 | 6:2 1':2 6:2 4:2 1:4 4:4 | 5:2 4:2 5:2 2:2 7,:2 2:2 4:2 7:2 | 1':8 r:8";
const CHORDS_A = 'I | IV | V7 | I | I | IV | V7 | I';
/** The hook: the same three quick notes, an octave up, climbing to a held third and back down the chord. */
const HOOK = "1':2 1':2 1':2 2':2 3':4 1':4 | 2':2 2':2 2':2 1':2 7:4 5:4 | 1':2 1':2 1':2 2':2 1':4 6:4 | 5:4 3:4 5:8 | 4':2 4':2 4':2 3':2 1':4 6:4 | 3':2 3':2 3':2 2':2 1':4 5:4 | 2':4 7:4 5:4 4':4 | 3':4 5:4 1':8";
const CHORDS_HOOK = 'I | V7 | IV | I | IV | I | V7 | I';
/** The trio: long notes in the relative minor's colour, for the trombones. */
const TRIO = "3:8 1:8 | 4:8 6:8 | 5:12 3:4 | 2:16 | 1':8 6:8 | 1':8 4':8 | 2':12 7:4 | 1':16";
const CHORDS_TRIO = 'vi | IV | I | V | vi | IV | V | I';

/** The band's oom-pah: the tuba on every beat (root and fifth), the trombones' chord off it. */
const oom = (p: ReturnType<typeof progression>, key: Key, bars: number, vel = 0.85): Note[] => bassLine(p, g, key, 33, '1...5...1...5...', bars, vel);
const pah = (p: ReturnType<typeof progression>, key: Key, bars: number, vel = 0.7): Note[] => stabs(p, g, key, 52, 3, '..x...x...x...x.', bars, vel, 1.2);

function intro(): Section {
  const chords = 'I | I | IV | V7';
  const p = progression(chords, BS);
  // The start house's fanfare: the cornets call on the fifth, the band answers.
  const call = "5:2 5:2 5:4 r:8 | 5:2 5:2 1':8 r:4 | 6:2 6:2 4':4 3':4 1':4 | 2':4 7:4 5:8";
  return {
    id: 'intro', role: 'intro', bars: 4, key: A, chords, tune: call,
    parts: {
      cornet: L(call, A, 4, 0.85),
      bones: pad(p, g, A, 50, 3, 0.55),
      snare: roll(g, 48, 64, 1, 0.25, 0.75),
      bdrum: hits('X............... X............... X.......X....... X...X...X...X...', g, 4),
      tuba: bassLine(p, g, A, 33, '1............... 1............... 1.......5....... 1...5...1...5...', 4, 0.8),
    },
  };
}

function verse(): Section {
  const p = progression(CHORDS_A, BS);
  const tune = L(TUNE_A, A, 5, 0.78);
  return {
    id: 'a', role: 'low', bars: 8, key: A, chords: CHORDS_A, tune: TUNE_A,
    parts: {
      tuba: oom(p, A, 8, 0.75),
      bones: pah(p, A, 8, 0.55),
      pizz: arp(p, g, A, 57, 3, 2, [0, 1, 2, 1], 8, 0.55, 1),
      bdrum: hits('X.......X.......', g, 8, 60, 0.8),
      snare: hits('....o.......o...', g, 8, 60, 0.6),
      piccolo: tune,
      xylo: downbeats(tune, g, 0, 0.5),
    },
  };
}

function chorus(id: string, key: Key, role: Section['role']): Section {
  const p = progression(CHORDS_HOOK, BS);
  const hook = L(HOOK, key, 4, 0.9, 0.95);
  const big = role === 'climax';
  return {
    id, role, bars: 8, key, chords: CHORDS_HOOK, tune: HOOK,
    parts: {
      tuba: oom(p, key, 8, 0.9),
      bones: pah(p, key, 8, 0.7),
      pizz: stabs(p, g, key, 57, 3, '..x...x...x...x.', 8, 0.5, 0.5),
      bdrum: hits('X...x...X...x...', g, 8, 60, 0.9),
      snare: hits('..x.X.x...x.X.xx', g, 8, 60, 0.7),
      sleigh: hits('x.x.x.x.x.x.x.x.', g, 8, 60, 0.75),
      cornet: hook,
      piccolo: up(L(HOOK, key, 4, 0.7, 0.95), 12),
      xylo: big ? up(L(HOOK, key, 4, 0.6, 0.6), 12) : downbeats(hook, g, 12, 0.6),
      bells: big ? downbeats(hook, g, 0, 0.55) : [],
      crash: big ? [{ t: 0, dur: 2, m: 60, v: 0.8 }] : [],
    },
  };
}

function trio(id: string, key: Key, role: Section['role']): Section {
  const p = progression(CHORDS_TRIO, BS);
  const climb = role === 'climb';
  return {
    id, role, bars: 8, key, chords: CHORDS_TRIO, tune: TRIO,
    parts: {
      tuba: bassLine(p, g, key, 33, '1.......5.......', 8, 0.8),
      bones: L(TRIO, key, 3, 0.8, 0.98),
      pizz: arp(p, g, key, 57, 3, 1, [0, 1, 2, 1], 8, 0.5, 1),
      bdrum: hits(climb ? 'X...x...X...x...' : 'X...............', g, 8, 60, 0.75),
      snare: climb ? hits('..o...o...o...oo', g, 8, 60, 0.55) : roll(g, 112, 128, 2, 0.2, 0.6),
      sleigh: climb ? hits('x...x...x...x...', g, 8, 60, 0.6) : [],
      piccolo: at(up(L("r:8 5:2 6:2 1':4 | r:16 | r:8 3:2 5:2 1':4", key, 4, 0.55), 12), g, 1).concat(at(up(L("r:8 6:2 1':2 4':4 | r:16 | r:8 7:2 2':2 5':4", key, 4, 0.55), 12), g, 5)),
      xylo: climb ? arp(p, g, key, 69, 3, 2, [0, 2, 1, 2], 8, 0.5, 1) : [],
      cornet: climb ? at(L("5:6 5:2 2':8", key, 4, 0.75), g, 7) : [],
    },
  };
}

function galop(): Section {
  const p = progression(CHORDS_A, BS);
  // The second time round the tune is the xylophone's and the piccolo's, the cornets chop the off beats.
  const tune = L(TUNE_A, A, 5, 0.75);
  return {
    id: 'd', role: 'mid', bars: 8, key: A, chords: CHORDS_A, tune: TUNE_A,
    parts: {
      tuba: oom(p, A, 8, 0.85),
      bones: pad(p, g, A, 50, 3, 0.45),
      cornet: stabs(p, g, A, 62, 2, '..x...x...x...x.', 8, 0.6, 1),
      xylo: tune,
      piccolo: up(tune, 12),
      bdrum: hits('X.......X.....x.', g, 8, 60, 0.85),
      snare: hits('..x...x...x.x.x.', g, 8, 60, 0.65),
      sleigh: hits('x.x.x.x.x.x.x.x.', g, 8, 60, 0.6),
    },
  };
}

function strainD(): Section {
  const D: Key = { pc: 2, mode: 'major' };
  const p = progression(CHORDS_HOOK, BS);
  // The hook in the subdominant, the xylophone and the pizzicato under the piccolo: the bells' strain.
  const hook = L(HOOK, D, 4, 0.8, 0.9);
  return {
    id: 'e', role: 'mid', bars: 8, key: D, chords: CHORDS_HOOK, tune: HOOK,
    parts: {
      tuba: oom(p, D, 8, 0.8),
      bones: pah(p, D, 8, 0.6),
      pizz: arp(p, g, D, 57, 3, 1, [0, 1, 2, 1], 8, 0.5, 1),
      xylo: hook,
      piccolo: up(L(HOOK, D, 4, 0.65, 0.95), 12),
      bells: downbeats(hook, g, 0, 0.5),
      bdrum: hits('X.......X.......', g, 8, 60, 0.8),
      snare: hits('..x...x...x...x.', g, 8, 60, 0.55),
      sleigh: hits('x.x.x.x.x.x.x.x.', g, 8, 60, 0.7),
    },
  };
}

function breakdown(): Section {
  const chords = 'IV | I/3 | ii | V7';
  const p = progression(chords, BS);
  // The bend bells: the band stops, the bells ring down the wall over the sleigh bells and the strings.
  return {
    id: 'bd', role: 'break', bars: 4, key: A, chords,
    parts: {
      pizz: arp(p, g, A, 57, 4, 2, [0, 2, 1, 3], 4, 0.5, 1),
      sleigh: hits('x...x...x...x...', g, 4, 60, 0.5),
      bells: L("1':8 5:8 | 3':8 1':8 | 2':8 6:8 | 5:16", A, 4, 0.55, 1),
      bones: pad(p, g, A, 50, 3, 0.35),
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
      tuba: bassLine(p, g, key, 33, '1...5...1...5... 1...5...1...5.5. 1............... ................', 4, 0.95),
      bones: pad(p, g, key, 50, 4, 0.85),
      cornet: L(fan, key, 4, 0.95, 1),
      piccolo: up(L(fan, key, 4, 0.8, 1), 12),
      xylo: up(L(fan, key, 4, 0.7, 0.7), 12),
      bells: L(fan, key, 4, 0.6, 1),
      bdrum: hits('X...X...X...X... X...X...X...X.X. X............... ................', g, 4),
      snare: roll(g, 24, 32, 1, 0.3, 0.9),
      sleigh: hits('x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. X............... ................', g, 4, 60, 0.7),
      crash: [{ t: 0, dur: 2, m: 60, v: 0.9 }, { t: 2 * BS * (60 / g.bpm / 4), dur: 3, m: 60, v: 1 }],
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
      tuba: bassLine(p, g, key, 33, '1.......5.......', 8, 0.65),
      bones: pad(p, g, key, 50, 3, 0.45),
      pizz: arp(p, g, key, 57, 3, 2, [0, 1, 2, 1], 8, 0.45, 1),
      piccolo: L(tune, key, 5, 0.55, 1),
      bells: at(L("r:8 5:4 1':4", key, 4, 0.4), g, 3).concat(at(L("r:8 3':4 1':4", key, 4, 0.4), g, 7)),
      sleigh: hits('x...............', g, 8, 60, 0.4),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'cornet', oct: 4 }, { track: 'piccolo', oct: 5, vel: 0.7 }],
  low: [{ track: 'bones', oct: 3, vel: 0.9 }, { track: 'tuba', oct: 2 }],
  bell: [{ track: 'bells', oct: 4 }, { track: 'xylo', oct: 5, vel: 0.8 }],
  perc: [{ track: 'bdrum', m: 60 }, { track: 'snare', m: 60, vel: 0.7 }],
  hold: [{ track: 'bones', oct: 3, vel: 0.7 }],
};

export const oldrun: Piece = {
  id: 'oldrun',
  name: 'The Old Run',
  style: "a galop for the grand hotel's band: tuba and trombones' oom-pah, cornets and a piccolo, pizzicato strings, snare and bass drum, sleigh bells, xylophone and tubular bells",
  grid: g,
  key: A,
  tracks,
  sections: [intro(), verse(), chorus('b', A, 'high'), trio('c', A, 'mid'), galop(), strainD(), breakdown(), chorus('b2', B, 'climax'), trio('c2', B, 'climb'), finale(B), results(B)],
  shots: [
    buildShot(g, A, 2, { snare: [...roll(g, 0, 16, 2, 0.2, 0.5), ...roll(g, 16, 32, 1, 0.5, 1)], swell: [{ t: 0, dur: 3, m: 60, v: 0.7 }], bdrum: hits('................ ........x...x.x.', g, 2) }),
    hitShot({ bdrum: [{ t: 0, dur: 0.2, m: 60, v: 1 }], sleigh: [{ t: 0, dur: 0.2, m: 60, v: 1 }] }),
    ...[...GESTURES, ...OWN_GESTURES.oldrun].map((x) => stinger(x, g, A, band)),
  ],
  verb: { ...HALL, t60: 1.4, size: 0.7 },
  echo: { steps: 2, feedback: 0.2 },
  master: { eq: [['hp', 45, 0.7], ['peak', 2800, 0.8, 1.5], ['hishelf', 7000, 0.7, 3]], comp: { threshold: -15, ratio: 2, attack: 0.02, release: 0.2, knee: 8 }, width: 1 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'e', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
