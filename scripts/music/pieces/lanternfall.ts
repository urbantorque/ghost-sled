import { HALL } from '../fx';
import { bowed, brass, choir, churchBell, feltPiano, glock, musicBox, pluck, wind } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, bassLine, hits, line, pad, progression, roll, stepsPerBar, up } from '../notation';
import { BASS_DRUM, SNARE_FIELD, TIMPANI, chimes, skin, snare } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF_68, type StingBand, buildShot, downbeats, fxTracks, hitShot, stinger } from './common';

// Lanternfall: a lullaby that becomes an anthem. A music box and a choir of soft vowels in a slow 6/8,
// alone above the cloud; a harp and a felt piano as the cloud closes; then, under the deck where the
// lanterns rise, a flute and strings state the game's motif whole; and in the last stage the key lifts
// from Bb to C and everything plays it: brass, strings, choir, bells, a field drum and timpani. No other
// course is in a compound metre, has a music box or a choir, or is this slow (a dotted quarter at 63).
// The motif is in the lullaby from its second section on: the anthem is the lullaby grown up.

const g: Grid = { bpm: 63, beats: 2, div: 6, swing: 0 };
const K: Key = { pc: 10, mode: 'major' };
const C: Key = { pc: 0, mode: 'major' };
const BS = stepsPerBar(g);

const tracks: Track[] = [
  { id: 'box', family: 'music box', inst: musicBox(), layer: 'bed', gain: -20.5, verb: 0.3, echo: 0.1, human: [6, 0.08] },
  { id: 'choir', family: 'choir', inst: choir({ from: 'oo', to: 'ah', voices: 6, attack: 0.5, release: 0.9 }), layer: 'bed', gain: -24, verb: 0.5 },
  { id: 'harp', family: 'harp', inst: pluck({ bright: 0.5, decay: 3.5, pick: 0.4, body: 'harp', ringOut: true }), layer: 'bed', gain: -24, pan: -0.35, verb: 0.3, human: [8, 0.1] },
  { id: 'piano', family: 'felt piano', inst: feltPiano(0.4), layer: 'bed', gain: -23, pan: 0.2, verb: 0.3, human: [8, 0.08] },
  { id: 'basses', family: 'string section', inst: bowed({ body: 'bass', voices: 3, bright: 0.4, vib: 5, attack: 0.2 }), layer: 'drive', gain: -23, verb: 0.2 },
  { id: 'drum', family: 'concert bass drum', inst: skin(BASS_DRUM), layer: 'drive', gain: -21, kick: true, verb: 0.25 },
  { id: 'timp', family: 'timpani', inst: skin(TIMPANI), layer: 'drive', gain: -23, verb: 0.3 },
  { id: 'field', family: 'field drum', inst: snare(SNARE_FIELD), layer: 'drive', gain: -26, verb: 0.3, human: [4, 0.1] },
  { id: 'flute', family: 'flute', inst: wind({ kind: 'flute', breath: 0.3, vib: 12, scoop: 15 }), layer: 'lead', gain: -19.5, pan: 0.1, verb: 0.4, human: [8, 0.05] },
  { id: 'violins', family: 'string section', inst: bowed({ body: 'violin', voices: 6, bright: 0.55, vib: 12, attack: 0.12 }), layer: 'lead', gain: -20, verb: 0.4 },
  { id: 'horns', family: 'horns', inst: brass({ kind: 'horn', voices: 4, swell: 0.4 }), layer: 'peak', gain: -21.5, verb: 0.4 },
  { id: 'tpts', family: 'trumpets', inst: brass({ kind: 'trumpet', voices: 3 }), layer: 'peak', gain: -22, verb: 0.35 },
  { id: 'bells', family: 'bells', inst: churchBell(), layer: 'peak', gain: -25, verb: 0.45 },
  { id: 'glock', family: 'glockenspiel', inst: glock(), layer: 'peak', gain: -28, pan: 0.3, verb: 0.4 },
  { id: 'chimes', family: 'bell tree', inst: chimes(true, 14), layer: 'peak', gain: -31, verb: 0.4 },
  ...fxTracks(0.15, 3600),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 1): Note[] => line(src, g, key, oct, v, leg);

const LULLABY = "3:4 5:2 3:4 1:2 | 2:4 3:2 5:6 | 6:4 1':2 6:4 4:2 | 5:4 3:2 1:6 | 3:4 5:2 1':4 6:2 | 6:4 4:2 6:6 | 5:4 1':2 2':4 1':2 | 7:4 5:2 2:6";
/** The motif whole, then its answer. */
const SONG = `${MOTIF_68.join(' | ')} | 5:4 1':2 2':3 7:3 | 1':4 6:2 5:6 | 4:4 6:2 1':3 7:3 | 1':12`;
const CLOUD = "3:6 6:6 | 1':6 6:6 | b7:6 2':6 | 2':4 1':2 7:6 | 3':6 1':6 | 6:6 4':6 | b3':6 4':6 | 5':6 2':6";
const ROAD = `${MOTIF_68.slice(0, 3).join(' | ')} | 3:4 2:2 3:6 | ${MOTIF_68.join(' | ')}`;
const ANTHEM = `${MOTIF_68.join(' | ')} | 3':4 2':2 7:3 5:3 | 6:4 1':2 5:6 | 4:4 6:2 1':3 2':3 | 3':12`;
const STRAIN = "6:4 1':2 6:6 | 5:4 1':2 3':6 | 4:4 6:2 2':6 | 2':4 7:2 5:6 | 6:4 1':2 4':6 | 5':4 3':2 1':6 | b7:4 2':2 4':6 | 5':6 2':6";

const ROCK = [0, 2, 1, 2, 3, 2];

function intro(): Section {
  const chords = 'I | I | IV | I';
  const p = progression(chords, BS);
  return {
    id: 'intro', role: 'intro', bars: 4, key: K, chords,
    parts: {
      box: L("r:12 | 5:4 3:2 5:6 | 6:4 4:2 6:6 | 5:4 3:2 1:6", K, 5, 0.6),
      choir: pad(p, g, K, 58, 3, 0.45),
      chimes: [{ t: 0.1, dur: 2.5, m: 82, v: 0.5 }],
    },
  };
}

function lullaby(): Section {
  const chords = 'I | I | IV | I | vi | IV | Vsus4 | V';
  const p = progression(chords, BS);
  return {
    id: 'a', role: 'low', bars: 8, key: K, chords, tune: LULLABY,
    parts: {
      box: L(LULLABY, K, 5, 0.75),
      choir: pad(p, g, K, 58, 3, 0.55),
      harp: arp(p, g, K, 58, 4, 2, ROCK, 8, 0.5, 4, 3),
      basses: bassLine(p, g, K, 34, '1...........', 8, 0.6),
      drum: hits('o...........', g, 8),
      flute: L("r:12 | r:12 | r:12 | r:6 5:6 | r:12 | r:12 | r:12 | r:6 2':6", K, 5, 0.5),
      glock: downbeats(L(LULLABY, K, 5, 0.75), g, 12, 0.45),
    },
  };
}

function song(): Section {
  const chords = 'I V | IV I/3 | ii V | I | I V | IV I/3 | ii Vsus4 | I';
  const p = progression(chords, BS);
  return {
    id: 'b', role: 'high', bars: 8, key: K, chords, tune: SONG,
    parts: {
      box: L(SONG, K, 5, 0.8),
      choir: pad(p, g, K, 58, 4, 0.65),
      harp: arp(p, g, K, 58, 4, 1, [0, 1, 2, 3, 2, 1], 8, 0.55, 3, 6),
      piano: pad(p, g, K, 46, 2, 0.5),
      basses: bassLine(p, g, K, 34, '1.....1.....', 8, 0.7),
      drum: hits('x.....o.....', g, 8),
      timp: hits('............ ............ ............ x.....x.....', g, 8, 46, 0.7),
      flute: L(SONG, K, 5, 0.6),
      violins: pad(p, g, K, 65, 2, 0.5),
      horns: pad(p, g, K, 53, 2, 0.5),
      glock: downbeats(L(SONG, K, 5, 0.8), g, 12, 0.5),
    },
  };
}

function cloud(id: string, key: Key, role: Section['role']): Section {
  const climb = role === 'climb';
  const chords = climb ? 'IV | I/3 | ii | V | IV | I/3 | bVII | V' : 'vi | IV | bVII | V | vi | IV | bVI bVII | V';
  const p = progression(chords, BS);
  const tune = climb ? STRAIN : CLOUD;
  return {
    id, role, bars: 8, key, chords, tune,
    parts: {
      choir: pad(p, g, key, 58, 4, climb ? 0.8 : 0.7),
      piano: climb ? arp(p, g, key, 46, 4, 2, ROCK, 8, 0.6, 4, 3) : L(tune, key, 4, 0.7),
      harp: arp(p, g, key, 58, 4, 1, [0, 1, 2, 3, 2, 1], 8, 0.5, 3, 6),
      box: climb ? [] : downbeats(L(tune, key, 4, 0.7), g, 24, 0.5),
      basses: bassLine(p, g, key, 34, '1...........', 8, 0.7),
      drum: hits(climb ? 'X.....x.....' : 'o...........', g, 8),
      timp: climb ? hits('x.....x...xx', g, 8, 48, 0.8) : [],
      field: climb ? hits('x.gx.gx.gxgg', g, 8, 60, 0.8) : [],
      flute: climb ? up(L(tune, key, 4, 0.7), 12) : L("r:12 | r:6 1':6 | r:12 | r:6 2':6 | r:12 | r:6 6:6 | r:12 | r:6 5':6", key, 4, 0.5),
      violins: climb ? L(tune, key, 4, 0.85) : pad(p, g, key, 65, 2, 0.45),
      horns: pad(p, g, key, 53, 3, climb ? 0.8 : 0.5),
      tpts: climb ? L("r:12 | r:12 | r:12 | 5:4 5:2 2':6 | r:12 | r:12 | r:12 | 5:4 5:2 2':6", key, 4, 0.8) : [],
      bells: climb ? hits('X...........', g, 8, 48 + key.pc + 12, 0.7).filter((_, i) => i % 2 === 0) : [],
    },
  };
}

function road(): Section {
  const chords = 'I V | IV I/3 | ii V | vi | I V | IV I/3 | ii V | I';
  const p = progression(chords, BS);
  return {
    id: 'd', role: 'high', bars: 8, key: K, chords, tune: ROAD,
    parts: {
      box: arp(p, g, K, 70, 3, 2, [0, 2, 1, 2, 0, 1], 8, 0.5, 3, 3),
      choir: pad(p, g, K, 58, 4, 0.7),
      harp: arp(p, g, K, 58, 4, 1, [0, 1, 2, 3, 2, 1], 8, 0.55, 3, 6),
      piano: pad(p, g, K, 46, 3, 0.55),
      basses: bassLine(p, g, K, 34, '1.....1.....', 8, 0.75),
      drum: hits('X.....o.....', g, 8),
      timp: hits('x.........x.', g, 8, 46, 0.7),
      field: hits('x.gx.gx.gx.g', g, 8, 60, 0.6),
      flute: L(ROAD, K, 5, 0.85),
      violins: L(ROAD, K, 4, 0.75),
      horns: pad(p, g, K, 53, 3, 0.65),
      bells: hits('X...........', g, 8, 58, 0.6).filter((_, i) => i % 4 === 0),
      glock: downbeats(L(ROAD, K, 5, 0.8), g, 12, 0.5),
    },
  };
}

function breakdown(): Section {
  const chords = 'IV | I/3 | ii | Vsus4';
  const p = progression(chords, BS);
  return {
    id: 'bd', role: 'break', bars: 4, key: K, chords,
    parts: {
      box: L("6:4 1':2 6:6 | 5:4 3:2 5:6 | 4:4 6:2 4:6 | 5:6 2:6", K, 5, 0.6),
      choir: pad(p, g, K, 58, 3, 0.5),
      chimes: [{ t: 0, dur: 3, m: 82, v: 0.5 }],
    },
  };
}

function anthem(): Section {
  const chords = 'I V/7 | IV I/3 | ii V | I | vi iii | IV I/3 | ii Vsus4 | I';
  const p = progression(chords, BS);
  const tune = L(ANTHEM, C, 4, 0.92);
  return {
    id: 'b2', role: 'climax', bars: 8, key: C, chords, tune: ANTHEM,
    parts: {
      box: up(L(ANTHEM, C, 4, 0.7), 12),
      choir: pad(p, g, C, 60, 4, 0.9),
      harp: arp(p, g, C, 60, 4, 1, [0, 1, 2, 3, 2, 1], 8, 0.6, 3, 6),
      piano: pad(p, g, C, 48, 3, 0.7),
      basses: bassLine(p, g, C, 36, '1.....1.....', 8, 0.9),
      drum: hits('X.....x.....', g, 8),
      timp: hits('X.....x...xx', g, 8, 48, 0.9),
      field: hits('X.gx.gX.gxgg', g, 8, 60, 0.9),
      flute: up(tune, 12).map((n) => ({ ...n, v: 0.75 })),
      violins: tune,
      horns: pad(p, g, C, 55, 4, 0.9),
      tpts: tune.map((n) => ({ ...n, v: 0.85 })),
      bells: hits('X...........', g, 8, 60, 0.8).filter((_, i) => i % 2 === 0),
      glock: downbeats(tune, g, 24, 0.6),
      crash: [{ t: 0, dur: 2, m: 60, v: 0.8 }],
    },
  };
}

function finale(): Section {
  const chords = 'I V | IV V | I | I';
  const p = progression(chords, BS);
  const fan = `${MOTIF_68[0]} | 6:4 7:2 2':6 | 1':12 | -:12`;
  const bar = BS * (60 / g.bpm / g.div);
  return {
    id: 'fin', role: 'finale', bars: 4, key: C, chords, tune: fan,
    parts: {
      choir: pad(p, g, C, 60, 4, 0.95),
      harp: arp(p, g, C, 60, 4, 1, [0, 1, 2, 3, 2, 1], 4, 0.6, 3, 6),
      piano: pad(p, g, C, 48, 3, 0.8),
      basses: bassLine(p, g, C, 36, '1.....1..... 1.....1..... 1........... ............', 4, 0.95),
      drum: hits('X.....X..... X.....X..... X........... ............', g, 4),
      timp: [...hits('X.....x..... X.....x.....', g, 2, 48), ...roll(g, 18, 24, 0.5, 0.4, 1, 48), { t: 2 * bar, dur: 1, m: 48, v: 1 }],
      field: [...hits('X.gx.gX.gx.g', g, 1, 60), ...roll(g, 12, 24, 0.5, 0.3, 1), { t: 2 * bar, dur: 0.1, m: 60, v: 1 }],
      crash: [{ t: 0, dur: 2, m: 60, v: 0.9 }, { t: 2 * bar, dur: 3, m: 60, v: 1 }],
      bells: [{ t: 0, dur: 3, m: 60, v: 0.9 }, { t: 2 * bar, dur: 4, m: 48, v: 1 }, { t: 2 * bar, dur: 4, m: 67, v: 0.8 }],
      flute: up(L(fan, C, 4, 0.8), 12),
      violins: L(fan, C, 4, 0.95),
      tpts: L(fan, C, 4, 0.95),
      horns: pad(p, g, C, 55, 4, 0.95),
      glock: up(L(fan, C, 4, 0.7), 24),
      chimes: [{ t: 2 * bar, dur: 2.5, m: 84, v: 0.8 }],
    },
  };
}

function results(): Section {
  const chords = 'I V | IV I/3 | ii V | I | vi IV | I/5 V | IV V | I';
  const p = progression(chords, BS);
  const tune = `${MOTIF_68.join(' | ')} | 3:4 6:2 5:3 4:3 | 5:4 3:2 2:6 | 4:4 6:2 5:3 7:3 | 1':12`;
  return {
    id: 'res', role: 'results', bars: 8, key: C, chords, tune,
    parts: {
      box: L(tune, C, 5, 0.75),
      choir: pad(p, g, C, 60, 3, 0.55),
      harp: arp(p, g, C, 60, 4, 2, ROCK, 8, 0.45, 4, 3),
      basses: bassLine(p, g, C, 36, '1...........', 8, 0.6),
      flute: L("r:12 | r:12 | r:12 | r:6 5:3 1':3 | r:12 | r:12 | r:12 | r:6 3':3 1':3", C, 5, 0.45),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'flute', oct: 5 }, { track: 'violins', oct: 4, vel: 0.8 }],
  low: [{ track: 'horns', oct: 3 }, { track: 'basses', oct: 2 }],
  bell: [{ track: 'box', oct: 5 }, { track: 'glock', oct: 5, vel: 0.7 }],
  perc: [{ track: 'timp', m: 46 }, { track: 'drum', m: 60, vel: 0.7 }],
  hold: [{ track: 'choir', oct: 4, vel: 0.7 }],
};

export const lanternfall: Piece = {
  id: 'lanternfall',
  name: 'Lanternfall',
  style: 'a lullaby that grows into an anthem, in a slow 6/8: music box and choir, harp and felt piano, then flute, strings, horns, trumpets, bells, timpani and a field drum',
  grid: g,
  key: K,
  tracks,
  sections: [intro(), lullaby(), song(), cloud('c', K, 'mid'), road(), breakdown(), anthem(), cloud('c2', C, 'climb'), finale(), results()],
  shots: [
    buildShot(g, K, 2, { timp: roll(g, 0, 24, 0.5, 0.15, 0.9, 46), swell: [{ t: 0.5, dur: 3, m: 60, v: 0.8 }], chimes: [{ t: 0.3, dur: 3, m: 76, v: 0.7 }] }),
    hitShot({ drum: [{ t: 0, dur: 1, m: 60, v: 1 }], bells: [{ t: 0, dur: 3, m: 58, v: 0.8 }] }),
    ...GESTURES.map((x) => stinger(x, g, K, band)),
  ],
  verb: { ...HALL, t60: 3, size: 1.2, damp: 5500 },
  echo: { steps: 3, feedback: 0.3 },
  master: { eq: [['hp', 30, 0.7], ['peak', 350, 1, -1], ['hishelf', 9000, 0.7, 1.5]], comp: { threshold: -16, ratio: 2, attack: 0.03, release: 0.3, knee: 10 }, width: 1.15 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'c', 'd', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
