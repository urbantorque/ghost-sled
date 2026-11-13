import type { VerbOpts } from '../fx';
import { brass, distBass, superSaw, synthLead } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, hits, line, pad, progression, roll, stabs, stepsPerBar, up } from '../notation';
import { KICK_DEEP, SNARE_BIG, TAIKO, TOM, hiss, kick, metal, skin, snare } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, type StingBand, buildShot, fxTracks, hitShot, stinger } from './common';

// Ember Peak: heavy and industrial. A deep kick and a big snare on three (half time: the weight of a
// forge hammer under a fast pulse), a distorted bass riff in sixteenths, anvils on the off beats, steam
// for hats, taiko and struck plate when the run opens up, and low brass carrying a hook of hammered
// repeated notes. E phrygian at 138: the flat second is the danger in it. The last stage does not change
// key: the drums go to full time, which doubles the pace under the same riff.

const g: Grid = { bpm: 138, beats: 4, div: 4, swing: 0 };
const K: Key = { pc: 4, mode: 'phrygian' };
const BS = stepsPerBar(g);
const HALL: VerbOpts = { size: 0.9, t60: 1.5, damp: 4200, pre: 0.012, early: 0.55, lo: 240, hi: 7000 };

const tracks: Track[] = [
  { id: 'furnace', family: 'dark pad', inst: superSaw({ voices: 5, detune: 12, cutoff: 260, open: 900, attack: 0.6, release: 0.8, q: 1.2 }), layer: 'bed', gain: -25, verb: 0.2, duck: 0.35, tape: 2 },
  { id: 'lowbrass', family: 'low brass', inst: brass({ kind: 'trombone', voices: 4, swell: 0.3 }), layer: 'bed', gain: -22.5, verb: 0.3, duck: 0.15 },
  { id: 'tuba', family: 'low brass', inst: brass({ kind: 'tuba', voices: 2 }), layer: 'bed', gain: -25, verb: 0.2 },
  { id: 'kick', family: 'deep kick', inst: kick(KICK_DEEP), layer: 'drive', gain: -18, kick: true },
  { id: 'snare', family: 'big snare', inst: snare(SNARE_BIG), layer: 'drive', gain: -20, verb: 0.4 },
  { id: 'bass', family: 'distorted bass', inst: distBass(6, 3000), layer: 'drive', gain: -20, duck: 0.3, comp: { threshold: -16, ratio: 4, attack: 0.005, release: 0.08 } },
  { id: 'anvil', family: 'anvils', inst: metal('anvil', 2), layer: 'drive', gain: -26, pan: 0.35, verb: 0.3 },
  { id: 'steam', family: 'steam', inst: hiss(3500, 10000, 0.002), layer: 'drive', gain: -32, pan: -0.3 },
  { id: 'toms', family: 'toms', inst: skin(TOM), layer: 'drive', gain: -23, verb: 0.25 },
  { id: 'horns', family: 'trumpets', inst: brass({ kind: 'trumpet', voices: 3 }), layer: 'lead', gain: -19, verb: 0.3, human: [5, 0.05] },
  { id: 'grit', family: 'synth lead', inst: synthLead(6, 6, 0.25), layer: 'lead', gain: -23, verb: 0.2, echo: 0.15, tape: 3 },
  { id: 'taiko', family: 'taiko', inst: skin(TAIKO), layer: 'peak', gain: -21, verb: 0.3 },
  { id: 'plate', family: 'struck plate', inst: metal('plate', 3), layer: 'peak', gain: -27, pan: -0.4, verb: 0.35 },
  { id: 'girder', family: 'struck girder', inst: metal('girder', 2.5), layer: 'peak', gain: -27, pan: 0.4, verb: 0.3 },
  { id: 'scream', family: 'trumpets', inst: brass({ kind: 'trumpet', voices: 2 }), layer: 'peak', gain: -23.5, pan: 0.2, verb: 0.3 },
  ...fxTracks(0.7, 2600),
];

const L = (src: string, oct: number, v = 0.85, leg = 0.9): Note[] => line(src, g, K, oct, v, leg);

/** The riff on the tonic, the flat second and the third: three hammered notes, a gap, a turn, and the
 *  flat second leaning back home. */
const R1 = '1:2 1:1 1:1 r:2 1:2 3:2 1:2 r:2 2:2';
const R2 = '2:2 2:1 2:1 r:2 2:2 4:2 2:2 r:2 1:2';
const R3 = '3:2 3:1 3:1 r:2 3:2 5:2 3:2 r:2 2:2';
const R6 = '6,:2 6,:1 6,:1 r:2 6,:2 1:2 6,:2 r:2 7,:2';
const R7 = '7,:2 7,:1 7,:1 r:2 7,:2 2:2 7,:2 r:2 1:2';
const R4 = '4:2 4:1 4:1 r:2 4:2 6:2 4:2 r:2 3:2';
/** The hook: three hammered notes in a 3 + 3 + 2 and a turn, climbing bar by bar to the sixth. */
const HOOK = "1':3 1':3 1':2 7:2 1':2 3':4 | 3':3 3':3 3':2 1':4 6:4 | 2':3 2':3 2':2 4':4 2':4 | 1':8 5:4 7:4 | 1':3 1':3 1':2 7:2 1':2 3':4 | 3':3 3':3 3':2 5':4 3':4 | 4':3 4':3 4':2 6':4 4':4 | 5':6 3':2 1':8";
const HALLS = "4:8 6:4 1':4 | 1':6 7:2 6:8 | 4:8 6:4 2':4 | 1':12 5:4 | 4':8 3':4 1':4 | 3':6 1':2 6:8 | 7:4 2':4 4':8 | 2':8 4':4 2':4";
const STAC = "1':2 r:2 1':2 3':2 r:2 1':2 7:2 r:2 | 2':2 r:2 2':2 4':2 r:2 2':2 1':2 r:2 | 1':2 r:2 1':2 3':2 r:2 1':2 7:2 r:2 | 3':2 r:2 3':2 5':2 r:2 3':2 2':2 r:2 | 1':2 r:2 1':2 3':2 r:2 1':2 7:2 r:2 | 2':2 r:2 2':2 4':2 r:2 2':2 1':2 r:2 | 7:2 r:2 7:2 2':2 r:2 7:2 4:2 r:2 | 2':4 2':4 2':2 1':2 7:4";

function intro(): Section {
  const chords = 'i5 | i5 | bII5 | i5';
  const p = progression(chords, BS);
  return {
    id: 'intro', role: 'intro', bars: 4, key: K, chords,
    parts: {
      furnace: pad(p, g, K, 40, 2, 0.7),
      lowbrass: pad(p, g, K, 40, 2, 0.5),
      anvil: hits('....x.......x... ....x.......x.x. ....x...x...x... ..x...x...x.x.x.', g, 4, 84),
      steam: hits('................ ................ x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.', g, 4, 60, 1, 0.04),
      kick: hits('................ ................ X.......x....... X.....x...x.x.x.', g, 4),
      bass: L(`r:16 | r:16 | ${R2} | ${R1}`, 1, 0.75),
    },
  };
}

function low(): Section {
  const chords = 'i5 | i5 | bII5 | i5 | i5 | i5 | bIII5 | bII5';
  const p = progression(chords, BS);
  return {
    id: 'a', role: 'low', bars: 8, key: K, chords,
    parts: {
      furnace: pad(p, g, K, 40, 2, 0.7),
      lowbrass: stabs(p, g, K, 40, 2, 'X---------------', 8, 0.6),
      kick: hits('X.....x.....x...', g, 8),
      snare: hits('........X.......', g, 8),
      bass: L([R1, R1, R2, R1, R1, R1, R3, R2].join(' | '), 1, 0.85),
      anvil: hits('....x.......x.x.', g, 8, 84),
      steam: hits('x.x.x.x.x.x.x.x.', g, 8, 60, 1, 0.04),
      horns: L("r:8 1:2 1:2 2:2 1:2 | r:16 | r:8 2:2 2:2 4:2 2:2 | r:16 | r:8 1:2 1:2 3:2 5:2 | r:16 | r:8 3:2 3:2 5:2 3:2 | r:8 2:2 2:2 1:4", 3, 0.75, 0.8),
      taiko: hits('X.......x..x....', g, 8, 40),
      plate: hits('................ ............x...', g, 8, 55),
    },
  };
}

function forge(id: string, role: Section['role']): Section {
  const big = role === 'climax';
  const chords = 'i5 | bVI | bVII | i5 | i5 | bVI | bII | i5';
  const p = progression(chords, BS);
  const hook = L(HOOK, 3, 0.92, 0.9);
  return {
    id, role, bars: 8, key: K, chords, tune: HOOK,
    parts: {
      furnace: pad(p, g, K, 40, 3, 0.85),
      lowbrass: pad(p, g, K, 40, 3, 0.8),
      tuba: stabs(p, g, K, 28, 1, 'X.......x.......', 8, 0.8, 6),
      kick: hits(big ? 'X.x...x.X.x...x.' : 'X..x..x...X..x..', g, 8),
      snare: hits(big ? '....X.......X..g' : '........X.....g.', g, 8),
      bass: L([R1, R6, R7, R1, R1, R6, R2, R1].join(' | '), 1, 0.95),
      anvil: hits(big ? 'x.xxx.xxx.xxx.xx' : '..x...x...x...x.', g, 8, 84, big ? 0.8 : 1),
      steam: hits('x.x.x.x.x.x.x.x.', g, 8, 60, 1, 0.04),
      horns: hook,
      grit: up(hook, 12).map((n) => ({ ...n, v: 0.7 })),
      taiko: hits(big ? 'X.x.X.x.X.x.X.xx' : 'X..X..X.X..X..X.', g, 8, 40),
      plate: hits('X...............', g, 8, 52),
      girder: hits('........X.......', g, 8, 43),
      scream: big ? up(hook, 12).map((n) => ({ ...n, v: 0.8 })) : stabs(p, g, K, 64, 3, 'X.....x.........', 8, 0.8, 2),
    },
  };
}

function halls(id: string, role: Section['role']): Section {
  const climb = role === 'climb';
  const chords = 'iv | bVI | bII | i | iv | bVI | bVII | bII';
  const p = progression(chords, BS);
  return {
    id, role, bars: 8, key: K, chords, tune: HALLS,
    parts: {
      furnace: pad(p, g, K, 40, 3, 0.8),
      lowbrass: pad(p, g, K, 40, 3, 0.75),
      kick: hits(climb ? 'X.x...x.X.x...x.' : 'X.........x.....', g, 8),
      snare: hits(climb ? '....X.......X...' : '........X.......', g, 8),
      toms: [...hits('x..x..x.....x...', g, 8, 43), ...hits('........x..x..x.', g, 8, 38)],
      bass: L([R4, R6, R2, R1, R4, R6, R7, R2].join(' | '), 1, 0.85),
      anvil: hits('....x.......x...', g, 8, 84),
      steam: hits(climb ? 'x.x.x.x.x.x.x.x.' : 'x...x...x...x...', g, 8, 60, 1, 0.06),
      horns: L(HALLS, 3, 0.85, 0.98),
      taiko: hits('X.....x...x.....', g, 8, 40),
      girder: hits('X...............', g, 8, 43),
      scream: climb ? up(L(HALLS, 3, 0.7, 0.98), 12) : [],
    },
  };
}

function machine(): Section {
  const chords = 'i5 | bII5 | i5 | bIII5 | i5 | bII5 | bVII5 | bII5';
  const p = progression(chords, BS);
  return {
    id: 'd', role: 'mid', bars: 8, key: K, chords, tune: STAC,
    parts: {
      furnace: pad(p, g, K, 40, 2, 0.7),
      lowbrass: stabs(p, g, K, 40, 2, 'X.....x.........', 8, 0.7, 3),
      kick: hits('X..x....x.X.....', g, 8),
      snare: hits('........X....g..', g, 8),
      bass: L([R1, R2, R1, R3, R1, R2, R7, R2].join(' | '), 1, 0.9),
      anvil: hits('x.xx..x.x.xx..x.', g, 8, 86, 0.8),
      steam: hits('..x...x...x...x.', g, 8, 60, 1, 0.08),
      grit: L(STAC, 3, 0.85, 0.8),
      horns: L("r:16 | r:16 | r:16 | r:8 3:4 2:4 | r:16 | r:16 | r:16 | 2:4 2:4 2:2 1:2 7,:4", 4, 0.8, 0.9),
      taiko: hits('X.......X..x..x.', g, 8, 40),
      plate: hits('....X.......X...', g, 8, 55),
    },
  };
}

function breakdown(): Section {
  const chords = 'i | i | bII | bII';
  const p = progression(chords, BS);
  return {
    id: 'bd', role: 'break', bars: 4, key: K, chords,
    parts: {
      furnace: pad(p, g, K, 40, 3, 0.8),
      lowbrass: pad(p, g, K, 40, 2, 0.45),
      kick: hits('X.....x.........', g, 4, 60, 0.7),
      anvil: hits('........x....... ............x... ........x....... ....x...x...x.x.', g, 4, 84, 0.7),
      steam: hits('X............... ................ X............... ................', g, 4, 60, 1, 0.9),
    },
  };
}

function finale(): Section {
  const chords = 'i5 bVII | bVI bVII | i5 | i5';
  const p = progression(chords, BS);
  const fan = `${MOTIF[0]} | 6:6 7:2 2':8 | 1':16 | -:16`;
  return {
    id: 'fin', role: 'finale', bars: 4, key: K, chords, tune: fan,
    parts: {
      furnace: pad(p, g, K, 40, 3, 0.9),
      lowbrass: L(fan, 2, 0.95, 1).concat(pad(p, g, K, 40, 2, 0.8)),
      tuba: stabs(p, g, K, 28, 1, 'X.......X....... X.......X....... X............... ................', 4, 0.9, 8),
      kick: hits('X...X...X...X... X...X...X.X.X.XX X............... ................', g, 4),
      snare: hits('....X.......X... ....X...X.X.XXXX X............... ................', g, 4),
      taiko: hits('X.x.X.x.X.x.X.x. X.x.X.x.XxXxXxXx X............... ................', g, 4, 40),
      anvil: hits('X...X...X...X... X...X...X...X... X............... ................', g, 4, 84),
      plate: hits('X............... ................ X............... ................', g, 4, 52),
      girder: hits('................ ................ X............... ................', g, 4, 40),
      crash: [{ t: 0, dur: 2, m: 60, v: 0.9 }, { t: 2 * BS * (60 / g.bpm / 4), dur: 3, m: 60, v: 1 }],
      horns: L(fan, 3, 0.95, 1),
      scream: L(fan, 4, 0.9, 1),
      bass: L(`${R1} | ${R6} | 1:16 | -:16`, 1, 0.95),
    },
  };
}

function results(): Section {
  const chords = 'i bVII | bVI bIII | iv bVII | i | bVI bVII | i | bII bVII | i';
  const p = progression(chords, BS);
  const tune = `${MOTIF.join(' | ')} | 3:6 6:2 5:4 4:4 | 5:6 3:2 1:8 | 4:6 6:2 5:4 7:4 | 1':16`;
  return {
    id: 'res', role: 'results', bars: 8, key: K, chords, tune,
    parts: {
      furnace: pad(p, g, K, 40, 3, 0.7),
      lowbrass: pad(p, g, K, 43, 3, 0.55),
      kick: hits('X...............', g, 8, 60, 0.6),
      anvil: hits('........o.......', g, 8, 84),
      steam: hits('....o.......o...', g, 8, 60, 1, 0.1),
      horns: L(tune, 3, 0.6, 1),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'horns', oct: 3 }, { track: 'grit', oct: 4, vel: 0.7 }],
  low: [{ track: 'lowbrass', oct: 2 }, { track: 'bass', oct: 1 }],
  bell: [{ track: 'anvil', oct: 5 }, { track: 'horns', oct: 4, vel: 0.7 }],
  perc: [{ track: 'taiko', m: 40 }, { track: 'kick', m: 60, vel: 0.8 }],
  hold: [{ track: 'lowbrass', oct: 2, vel: 0.7 }, { track: 'furnace', oct: 2, vel: 0.7 }],
};

export const ember: Piece = {
  id: 'ember',
  name: 'Ember Peak',
  style: 'heavy industrial: a half-time kick and big snare, a distorted bass riff, anvils, steam, taiko and struck plate, low brass and trumpets',
  grid: g,
  key: K,
  tracks,
  sections: [intro(), low(), forge('b', 'high'), halls('c', 'mid'), machine(), breakdown(), forge('b2', 'climax'), halls('c2', 'climb'), finale(), results()],
  shots: [
    buildShot(g, K, 2, { toms: [...roll(g, 0, 16, 2, 0.3, 0.6, 38), ...roll(g, 16, 32, 1, 0.6, 1, 43)], anvil: hits('x...x...x...x... x.x.x.x.xxxxxxxx', g, 2, 84, 0.8), swell: [{ t: 0, dur: 3, m: 60, v: 0.7 }] }),
    hitShot({ kick: [{ t: 0, dur: 0.2, m: 60, v: 1 }], plate: [{ t: 0, dur: 1, m: 50, v: 1 }], taiko: [{ t: 0, dur: 1, m: 38, v: 1 }] }),
    ...GESTURES.map((x) => stinger(x, g, K, band)),
  ],
  verb: HALL,
  echo: { steps: 2, feedback: 0.2 },
  master: { eq: [['hp', 30, 0.7], ['loshelf', 90, 0.7, 1.5], ['peak', 2800, 0.9, 1.5]], comp: { threshold: -16, ratio: 3, attack: 0.012, release: 0.14, knee: 6 }, width: 1 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
