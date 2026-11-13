import { CAVERN } from '../fx';
import { feltPiano, fmBell, glassPad, sineLead, subBass, superSaw, synthBass } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, bassLine, hits, line, pad, progression, stabs, stepsPerBar, up } from '../notation';
import { KICK_CLUB, SNARE_CRISP, hat, kick, snare } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, type StingBand, buildShot, downbeats, fxTracks, hitShot, stinger } from './common';

// Frostfang Glacier: glassy, pulsing electronica. Glass bells in sixteenths over a wide slow pad, a
// kick on every beat that pumps them, an off-beat bass, a pure sine lead whose long notes hang in a big
// cold room. F# dorian at 126: the raised sixth is the ice. Under the aurora the kick thins to half time
// and the room is all there is; out of the cavern the last stage turns to F# major, the sun finding you,
// with bright chords and a piano in octaves.

const g: Grid = { bpm: 126, beats: 4, div: 4, swing: 0 };
const K: Key = { pc: 6, mode: 'dorian' };
const DAWN: Key = { pc: 6, mode: 'major' };
const BS = stepsPerBar(g);

const tracks: Track[] = [
  { id: 'pad', family: 'supersaw pad', inst: superSaw({ voices: 7, detune: 16, cutoff: 500, open: 2600, attack: 0.5, release: 0.9 }), layer: 'bed', gain: -24, verb: 0.3, duck: 0.45 },
  { id: 'aurora', family: 'glass pad', inst: glassPad(1.2, 1.8), layer: 'bed', gain: -27, verb: 0.6, duck: 0.25 },
  { id: 'arp', family: 'glass bells', inst: fmBell({ ratio: 2.76, index: 1.3, decay: 0.9, spread: 6 }), layer: 'bed', gain: -25, verb: 0.3, echo: 0.3 },
  { id: 'kick', family: 'club kick', inst: kick(KICK_CLUB), layer: 'drive', gain: -18.5, kick: true },
  { id: 'bass', family: 'synth bass', inst: synthBass(8, 0.1, 1.5), layer: 'drive', gain: -22, duck: 0.3, eq: [['hp', 36, 0.7]] },
  { id: 'sub', family: 'sub bass', inst: subBass(0.2, 0.02, 0.1), layer: 'drive', gain: -24, duck: 0.4 },
  { id: 'hat', family: 'hats', inst: hat({ decay: 0.05, lo: 7500, metal: 0.8 }), layer: 'drive', gain: -31, pan: 0.25 },
  { id: 'ohat', family: 'hats', inst: hat({ decay: 0.2, lo: 6500, metal: 0.8 }, true), layer: 'drive', gain: -30, pan: -0.2, verb: 0.1 },
  { id: 'clap', family: 'snare and clap', inst: snare(SNARE_CRISP), layer: 'drive', gain: -23, verb: 0.35 },
  { id: 'lead', family: 'sine lead', inst: sineLead(8), layer: 'lead', gain: -18.5, verb: 0.35, echo: 0.3 },
  { id: 'bell', family: 'fm bell', inst: fmBell({ ratio: 3.5, index: 1.5, decay: 2.2 }), layer: 'lead', gain: -23, pan: 0.2, verb: 0.45, echo: 0.2 },
  { id: 'stab', family: 'supersaw stabs', inst: superSaw({ voices: 7, detune: 22, cutoff: 1400, open: 6500, attack: 0.01, release: 0.25, q: 1 }), layer: 'peak', gain: -24, verb: 0.3, duck: 0.4 },
  { id: 'arp2', family: 'glass bells', inst: fmBell({ ratio: 2.76, index: 1, decay: 0.6, spread: 8 }), layer: 'peak', gain: -28, pan: -0.3, verb: 0.35, echo: 0.3 },
  { id: 'piano', family: 'piano', inst: feltPiano(0.85), layer: 'peak', gain: -24, verb: 0.3 },
  ...fxTracks(0.6, 4000),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 0.95): Note[] => line(src, g, key, oct, v, leg);

/** The hook: long notes that hang, a three-note cell stepping up bar by bar, a reach to the ninth. */
const HOOK = "3:6 1:2 3:8 | 4:6 2:2 4:8 | 5:6 3:2 5:4 1':4 | 2':8 1':4 6:4 | 3':6 1':2 3':8 | 4':6 2':2 4':8 | 5':8 3':4 1':4 | 2':12 r:4";
/** The same shape in the major, for the dawn. */
const DAWN_HOOK = "6:6 4:2 6:8 | 7:6 5:2 7:8 | 1':6 6:2 1':4 3':4 | 5':8 3':4 1':4 | 6':6 4':2 6':8 | 5':6 7:2 2'':8 | 1'':8 5':4 3':4 | 1':12 r:4";
const AURORA = "6:8 1':8 | 5:16 | 4:8 7:8 | 5:12 3:4 | 6:8 4':8 | 1':16 | 7:8 4:8 | 5:16";
const BELLS = "1:2 3:2 5:2 3:2 1':4 5:4 | 7:2 5:2 3:2 5:2 7:4 3':4 | 2':2 7:2 4:2 7:2 2':4 4':4 | 1':2 6:2 4:2 6:2 1':8 | 1:2 3:2 5:2 3:2 1':4 3':4 | 7:2 5:2 3:2 5:2 3':4 5':4 | 2':4 7:4 5:4 2':4 | 5:8 r:8";

const UPDOWN = [0, 1, 2, 3, 2, 1];

function intro(): Section {
  const chords = 'i | i | bVII | IV';
  const p = progression(chords, BS);
  return {
    id: 'intro', role: 'intro', bars: 4, key: K, chords,
    parts: {
      pad: pad(p, g, K, 54, 4, 0.55),
      aurora: pad(p, g, K, 66, 3, 0.5),
      arp: arp(p, g, K, 66, 4, 1, UPDOWN, 4, 0.55, 2),
      hat: hits('................ ................ ..o...o...o...o. ..o...o...o.o.o.', g, 4),
      sub: bassLine(p, g, K, 30, '1...............', 4, 0.6),
    },
  };
}

function low(): Section {
  const chords = 'i | bVII | IV | i | i | bVII | IV | v';
  const p = progression(chords, BS);
  return {
    id: 'a', role: 'low', bars: 8, key: K, chords,
    parts: {
      pad: pad(p, g, K, 54, 4, 0.6),
      arp: arp(p, g, K, 66, 4, 1, UPDOWN, 8, 0.6, 2),
      kick: hits('X...x...X...x...', g, 8),
      bass: bassLine(p, g, K, 42, '..1...1...1...1.', 8, 0.8),
      sub: bassLine(p, g, K, 30, '1...............', 8, 0.7),
      hat: hits('..x...x...x...x.', g, 8),
      lead: L("1:16 | 7,:16 | 6,:16 | 1:16 | 3:16 | 2:16 | 1:8 6,:8 | 2:16", K, 4, 0.55, 1),
      bell: L("r:16 | r:8 7:2 2':2 4':4 | r:16 | r:8 5:2 3:2 1:4 | r:16 | r:8 2':2 4':2 7:4 | r:16 | r:8 5:2 7:2 2':4", K, 4, 0.7),
      arp2: arp(p, g, K, 78, 3, 2, [0, 2, 1, 2], 8, 0.5, 2),
    },
  };
}

function drop(id: string, key: Key, role: Section['role']): Section {
  const dawn = key.mode === 'major';
  const chords = dawn ? 'IV | V | vi | I | IV | V | I/3 | I' : 'bVI | bVII | i | IV | bVI | bVII | i | v';
  const p = progression(chords, BS);
  const hook = L(dawn ? DAWN_HOOK : HOOK, key, 4, 0.9, 1);
  return {
    id, role, bars: 8, key, chords, tune: dawn ? DAWN_HOOK : HOOK,
    parts: {
      pad: pad(p, g, key, 54, 4, 0.75),
      arp: arp(p, g, key, 66, 4, 1, UPDOWN, 8, 0.7, 2),
      kick: hits('X...X...X...X...', g, 8),
      clap: hits('....X.......X...', g, 8),
      bass: bassLine(p, g, key, 42, dawn ? '1.1.8.1.1.1.8.1.' : '..1.1.1...1.1.8.', 8, 0.9),
      sub: bassLine(p, g, key, 30, '1.......1.......', 8, 0.8),
      hat: hits('x.x.x.x.x.x.x.x.', g, 8, 60, 0.8),
      ohat: hits('..X...X...X...X.', g, 8, 60, 1, 0.12),
      lead: hook,
      bell: downbeats(hook, g, 12, 0.6),
      stab: stabs(p, g, key, 60, 4, dawn ? 'X..x..x.X..x..x.' : 'X.....x...X.....', 8, 0.8, dawn ? 2 : 3),
      arp2: arp(p, g, key, 78, 3, 1, [0, 1, 2, 1], 8, 0.5, 1),
      piano: dawn ? pad(p, g, key, 42, 2, 0.7).concat(up(hook, 0).map((n) => ({ ...n, v: 0.6 }))) : [],
    },
  };
}

function aurora(id: string, key: Key, role: Section['role']): Section {
  const dawn = key.mode === 'major';
  const chords = dawn ? 'I | V/7 | vi | IV | I | V | IV | V' : 'IV | i | bVII | bIII | IV | i | bVII | v';
  const p = progression(chords, BS);
  const tune = dawn ? "3:8 5:8 | 2:16 | 1:8 3:8 | 6:12 4:4 | 5:8 1':8 | 7:16 | 6:8 1':8 | 2':16" : AURORA;
  return {
    id, role, bars: 8, key, chords, tune,
    parts: {
      pad: pad(p, g, key, 54, 4, 0.7),
      aurora: pad(p, g, key, 66, 4, 0.8),
      arp: arp(p, g, key, 66, 4, 2, UPDOWN, 8, 0.5, 4),
      kick: hits(dawn ? 'X...X...X...X...' : 'X.........x.....', g, 8),
      clap: hits(dawn ? '....X.......X...' : '........X.......', g, 8),
      hat: hits(dawn ? 'x.x.x.x.x.x.x.x.' : '....o.......o...', g, 8),
      sub: bassLine(p, g, key, 30, '1...............', 8, 0.8),
      bass: dawn ? bassLine(p, g, key, 42, '..1...1...1...1.', 8, 0.85) : [],
      lead: L(tune, key, dawn ? 5 : 4, 0.75, 1),
      bell: arp(p, g, key, 78, 3, 8, [0, 2, 1, 2], 8, 0.5, 8),
      stab: dawn ? stabs(p, g, key, 60, 4, 'X.....x...X.....', 8, 0.7, 3) : [],
      piano: dawn ? arp(p, g, key, 54, 4, 2, [0, 2, 1, 3, 2, 1, 3, 2], 8, 0.6, 3) : [],
    },
  };
}

function bells(): Section {
  const chords = 'i | bIII | bVII | IV | i | bIII | v | v';
  const p = progression(chords, BS);
  return {
    id: 'd', role: 'mid', bars: 8, key: K, chords, tune: BELLS,
    parts: {
      pad: pad(p, g, K, 54, 4, 0.6),
      arp: arp(p, g, K, 66, 4, 1, [0, 2, 1, 3, 2, 1], 8, 0.6, 2),
      kick: hits('X...X...X...X..x', g, 8),
      clap: hits('....x.......x...', g, 8),
      bass: bassLine(p, g, K, 42, '1.....1.1.....8.', 8, 0.85),
      sub: bassLine(p, g, K, 30, '1...............', 8, 0.7),
      hat: hits('xgxgxgxgxgxgxgxg', g, 8, 60, 0.8),
      bell: L(BELLS, K, 4, 0.8, 1),
      lead: L("r:16 | r:16 | r:16 | r:8 1':8 | r:16 | r:16 | 2':16 | 5:16", K, 4, 0.6, 1),
      stab: stabs(p, g, K, 60, 4, '......x.......x.', 8, 0.6, 2),
    },
  };
}

function breakdown(): Section {
  const chords = 'bVI | bVII | i | i';
  const p = progression(chords, BS);
  return {
    id: 'bd', role: 'break', bars: 4, key: K, chords,
    parts: {
      pad: pad(p, g, K, 54, 4, 0.5),
      aurora: pad(p, g, K, 66, 4, 0.7),
      arp: arp(p, g, K, 66, 4, 4, UPDOWN, 4, 0.5, 6),
      lead: L("3:16 | 4:16 | 5:16 | -:16", K, 4, 0.5, 1),
      hat: hits('................ ................ ..o...o...o...o. ..o...o...o.o.o.', g, 4),
    },
  };
}

function finale(): Section {
  const chords = 'I V | IV V | I | I';
  const p = progression(chords, BS);
  const fan = `${MOTIF[0]} | 6:6 7:2 2':8 | 1':16 | -:16`;
  return {
    id: 'fin', role: 'finale', bars: 4, key: DAWN, chords, tune: fan,
    parts: {
      pad: pad(p, g, DAWN, 54, 4, 0.9),
      aurora: pad(p, g, DAWN, 66, 4, 0.8),
      arp: arp(p, g, DAWN, 66, 4, 1, UPDOWN, 4, 0.7, 2),
      kick: hits('X...X...X...X... X...X...X...X.X. X............... ................', g, 4),
      clap: hits('....X.......X... ....X.......X.XX X............... ................', g, 4),
      sub: bassLine(p, g, DAWN, 30, '1.......1....... 1.......1....... 1............... ................', 4, 0.9),
      crash: [{ t: 0, dur: 2, m: 60, v: 0.9 }, { t: 2 * BS * (60 / g.bpm / 4), dur: 3, m: 60, v: 1 }],
      lead: L(fan, DAWN, 4, 0.95, 1),
      bell: up(L(fan, DAWN, 4, 0.7, 1), 12),
      stab: stabs(p, g, DAWN, 60, 4, 'X.......X....... X.......X....... X............... ................', 4, 0.9, 6),
      piano: L(fan, DAWN, 3, 0.8, 1).concat(L(fan, DAWN, 4, 0.8, 1)),
    },
  };
}

function results(): Section {
  const chords = 'I V | IV I/3 | ii V | I | vi IV | I/5 V | IV V | I';
  const p = progression(chords, BS);
  const tune = `${MOTIF.join(' | ')} | 3:6 6:2 5:4 4:4 | 5:6 3:2 2:8 | 4:6 6:2 5:4 7:4 | 1':16`;
  return {
    id: 'res', role: 'results', bars: 8, key: DAWN, chords, tune,
    parts: {
      pad: pad(p, g, DAWN, 54, 4, 0.55),
      aurora: pad(p, g, DAWN, 66, 3, 0.6),
      arp: arp(p, g, DAWN, 66, 4, 2, UPDOWN, 8, 0.5, 4),
      sub: bassLine(p, g, DAWN, 30, '1.......1.......', 8, 0.6),
      hat: hits('..o...o...o...o.', g, 8),
      bell: L(tune, DAWN, 4, 0.7, 1),
      lead: L("r:16 | r:16 | r:16 | r:8 5:4 1':4 | r:16 | r:16 | r:16 | r:8 3':4 1':4", DAWN, 4, 0.45, 1),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'lead', oct: 4 }, { track: 'stab', oct: 4, vel: 0.6 }],
  low: [{ track: 'bass', oct: 2 }, { track: 'sub', oct: 1 }],
  bell: [{ track: 'bell', oct: 5 }, { track: 'arp2', oct: 5, vel: 0.8 }],
  perc: [{ track: 'kick', m: 60 }, { track: 'clap', m: 60, vel: 0.6 }],
  hold: [{ track: 'pad', oct: 3, vel: 0.7 }, { track: 'aurora', oct: 4, vel: 0.6 }],
};

export const frostfang: Piece = {
  id: 'frostfang',
  name: 'Frostfang Glacier',
  style: 'glassy, pulsing electronica: glass bells in sixteenths, a wide supersaw pad, a four-on-the-floor kick that pumps it, a sine lead in a cavernous room; a major-key dawn',
  grid: g,
  key: K,
  tracks,
  sections: [intro(), low(), drop('b', K, 'high'), aurora('c', K, 'mid'), bells(), breakdown(), drop('b2', DAWN, 'climax'), aurora('c2', DAWN, 'climb'), finale(), results()],
  shots: [
    buildShot(g, K, 2, { clap: [...hits('....x.......x... x...x...x.x.xxxx', g, 2, 60, 0.8)], swell: [{ t: 0, dur: 3.5, m: 60, v: 0.8 }], hat: hits('x.x.x.x.x.x.x.x. xxxxxxxxxxxxxxxx', g, 2, 60, 0.7) }),
    hitShot({ kick: [{ t: 0, dur: 0.2, m: 60, v: 1 }] }),
    ...GESTURES.map((x) => stinger(x, g, K, band)),
  ],
  verb: { ...CAVERN, t60: 3.4 },
  echo: { steps: 3, feedback: 0.42 },
  master: { eq: [['hp', 30, 0.7], ['peak', 300, 1, -1.5], ['hishelf', 8500, 0.7, 2]], comp: { threshold: -15, ratio: 2.2, attack: 0.02, release: 0.18, knee: 8 }, width: 1.2 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
