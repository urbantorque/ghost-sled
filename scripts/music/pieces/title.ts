import { HALL } from '../fx';
import { bowed, choir, feltPiano, glass, pluck, subBass, wind } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, bassLine, hits, line, pad, progression, stepsPerBar, up } from '../notation';
import { FRAME_DRUM, shaker, skin } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { MOTIF, downbeats } from './common';

// The title theme: the game's motif, stated plainly. A felt piano has it first, alone over a held pad;
// strings answer higher with a harp under them; then the piano and the strings play it together with
// glass bells on the downbeats. C major at 92, unhurried: the key Lanternfall's anthem arrives in, so the
// game's last music comes home to its first. Every layer plays on the title; nothing here is sequenced
// to a run.

const g: Grid = { bpm: 92, beats: 4, div: 4, swing: 0.04 };
const C: Key = { pc: 0, mode: 'major' };
const BS = stepsPerBar(g);

const tracks: Track[] = [
  { id: 'piano', family: 'felt piano', inst: feltPiano(0.7), layer: 'bed', gain: -19, verb: 0.3, human: [9, 0.08] },
  { id: 'pad', family: 'string section', inst: bowed({ body: 'cello', voices: 5, bright: 0.4, vib: 8, attack: 0.4 }), layer: 'bed', gain: -29, verb: 0.4, eq: [['hp', 130, 0.7]] },
  { id: 'voices', family: 'choir', inst: choir({ from: 'oo', to: 'oo', voices: 5, attack: 0.6, release: 1 }), layer: 'bed', gain: -29, verb: 0.5 },
  { id: 'harp', family: 'harp', inst: pluck({ bright: 0.5, decay: 3.2, pick: 0.4, body: 'harp', ringOut: true }), layer: 'bed', gain: -25, pan: -0.35, verb: 0.3, human: [8, 0.1] },
  { id: 'bass', family: 'sub bass', inst: subBass(0.3, 0.03, 0.15), layer: 'drive', gain: -25 },
  { id: 'frame', family: 'frame drum', inst: skin(FRAME_DRUM), layer: 'drive', gain: -27, verb: 0.3, human: [6, 0.1] },
  { id: 'shaker', family: 'shaker', inst: shaker(4000, 9000), layer: 'drive', gain: -34, pan: 0.3, human: [6, 0.15] },
  { id: 'violins', family: 'string section', inst: bowed({ body: 'violin', voices: 5, bright: 0.5, vib: 12, attack: 0.14 }), layer: 'lead', gain: -21, verb: 0.4 },
  { id: 'flute', family: 'flute', inst: wind({ kind: 'flute', breath: 0.3, vib: 11, scoop: 15 }), layer: 'lead', gain: -23, pan: 0.2, verb: 0.4 },
  { id: 'glass', family: 'glass bells', inst: glass(), layer: 'lead', gain: -25, pan: 0.3, verb: 0.45 },
];

const L = (src: string, oct: number, v = 0.8, leg = 1): Note[] => line(src, g, C, oct, v, leg);

const A = `${MOTIF.join(' | ')} | 5:6 1':2 2':4 7:4 | 3':6 1':2 6:8 | 4:6 6:2 1':4 2':4 | 1':16`;
const B = "6:6 1':2 4':8 | 3':6 1':2 5:8 | 4:6 6:2 2':8 | 2':6 7:2 5:8 | 6:6 1':2 4':8 | 5':6 3':2 1':8 | b6:4 1':4 b7:4 2':4 | 3':16";
const A2 = `${MOTIF.join(' | ')} | 5:6 1':2 2':4 7:4 | 3':6 1':2 6:8 | 4:6 6:2 5:4 2:4 | 1:16`;

function statement(): Section {
  const chords = 'I V | IV I/3 | ii V | I | I V/7 | vi IV | ii Vsus4 | I';
  const p = progression(chords, BS);
  return {
    id: 'a', role: 'title', bars: 8, key: C, chords, tune: A,
    parts: {
      piano: L(A, 4, 0.75).concat(pad(p, g, C, 43, 2, 0.5)),
      pad: pad(p, g, C, 48, 3, 0.5),
      bass: bassLine(p, g, C, 36, '1.......1.......', 8, 0.6),
      glass: downbeats(L(A, 4, 0.75), g, 24, 0.5),
    },
  };
}

function answer(): Section {
  const chords = 'IV | I/3 | ii | V | IV | I/3 | bVI bVII | I';
  const p = progression(chords, BS);
  return {
    id: 'b', role: 'title', bars: 8, key: C, chords, tune: B,
    parts: {
      piano: arp(p, g, C, 48, 4, 2, [0, 2, 1, 3, 2, 1, 2, 3], 8, 0.55, 4),
      pad: pad(p, g, C, 48, 4, 0.6),
      voices: pad(p, g, C, 60, 3, 0.6),
      harp: arp(p, g, C, 60, 4, 1, [0, 1, 2, 3, 2, 1, 2, 1], 8, 0.5, 3),
      bass: bassLine(p, g, C, 36, '1.......1...5...', 8, 0.7),
      frame: hits('X.....x...x.....', g, 8, 45),
      shaker: hits('x.o.x.o.x.o.x.o.', g, 8),
      violins: L(B, 4, 0.8),
      flute: L("r:16 | r:8 5:4 1':4 | r:16 | r:8 2':4 5':4 | r:16 | r:8 3':4 5':4 | r:16 | r:8 5':8", 5, 0.55),
    },
  };
}

function together(): Section {
  const chords = 'I V | IV I/3 | ii V | I | I V/7 | vi IV | ii V | I';
  const p = progression(chords, BS);
  return {
    id: 'c', role: 'title', bars: 8, key: C, chords, tune: A2,
    parts: {
      piano: L(A2, 4, 0.8).concat(pad(p, g, C, 43, 2, 0.55)),
      pad: pad(p, g, C, 48, 4, 0.65),
      voices: pad(p, g, C, 60, 3, 0.7),
      harp: arp(p, g, C, 60, 4, 2, [0, 2, 1, 3], 8, 0.5, 4),
      bass: bassLine(p, g, C, 36, '1.......1.......', 8, 0.7),
      frame: hits('X.........x.....', g, 8, 45),
      shaker: hits('..o...o...o...o.', g, 8),
      violins: up(L(A2, 4, 0.7), 12).map((n) => ({ ...n, v: 0.6 })),
      flute: L("r:16 | r:16 | r:16 | r:8 5:4 1':4 | r:16 | r:16 | r:16 | r:8 3:4 5:4", 5, 0.5),
      glass: downbeats(L(A2, 4, 0.8), g, 24, 0.55),
    },
  };
}

export const title: Piece = {
  id: 'title',
  name: 'Title theme',
  style: "the game's motif on a felt piano, strings, a harp, soft voices and glass bells",
  grid: g,
  key: C,
  tracks,
  sections: [statement(), answer(), together()],
  shots: [],
  verb: { ...HALL, t60: 2.6, size: 1.1 },
  echo: { steps: 3, feedback: 0.25 },
  master: { eq: [['hp', 30, 0.7], ['peak', 300, 0.9, -2], ['hishelf', 5000, 0.7, 3]], comp: { threshold: -17, ratio: 1.8, attack: 0.03, release: 0.3, knee: 10 }, width: 1.1 },
  form: { open: 'a', stages: [['b', 'c', 'b', 'a']], breakdown: 'a', finale: 'a', results: 'a' },
};
