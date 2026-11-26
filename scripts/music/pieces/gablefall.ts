import { HALL } from '../fx';
import { churchBell, handBell, pluck, reed, toyPiano } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, at, barDur, bassLine, hits, line, pad, progression, roll, stabs, stepDur, stepsPerBar, up } from '../notation';
import { type SkinOpts, type SnareOpts, skin, snare, stomp, triangle } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, OWN_GESTURES, type StingBand, buildShot, downbeats, fxTracks, hitShot, stinger } from './common';

// Gablefall (round 9): a winter march for the town on the hill, in the snow on a grey afternoon. Hand-bells from the
// church; the street's bustle in pizzicato (the violins' chords off the beat and their running notes, the cellos and
// basses on it); a toy piano's glint, the windows lit in the snow; a toy drum, a bass drum and a triangle; the
// church's harmonium under it all, and the tower's bell. F major at 95 in four, straight. The verse is the street,
// in D minor, its tune stepping down the hill a bar at a time; the hook is the roofs, a hop and a stomp: a quick note
// off the eave, a leap up an octave held in the air, the landing stamped on the next beat, and each roof a step under
// the last. The turn is the hand-bell choir's chorale; the second stage takes the street up the octave on the toy
// piano; the last stage lifts a whole tone to G, and the finish is the game's motif under the tower's bell. Original.

// (The concept's 128 lies within 8% of Frostfang's 126 and Ember's 138, where no two courses may sit, and every tempo
// from 104 to 152 is taken; 95 is a march in the snow, each hop of the roofs about a beat.)
const g: Grid = { bpm: 95, beats: 4, div: 4, swing: 0 };
const F: Key = { pc: 5, mode: 'major' };
const DM: Key = { pc: 2, mode: 'minor' };
const G: Key = { pc: 7, mode: 'major' };
const BS = stepsPerBar(g);
const BAR = barDur(g);
const BEAT = stepDur(g) * g.div;
/** The bass drum's pitch (C2) and the triangle's (A5, where its shimmer sits). */
const BDRUM = 36;
const TRI = 81;

/** A child's tin drum, high and tight; the town band's bass drum, muffled by the snow. */
const TOY_DRUM: SnareOpts = { tone: 340, toneDecay: 0.06, wires: 0.11, lo: 2600, hi: 12000, noise: 0.8 };
const MARCH_DRUM: SkinOpts = { decay: 1, fall: 0.22, stick: 0.1, modes: 0.25 };

const tracks: Track[] = [
  { id: 'harmonium', family: 'harmonium', inst: reed({ reeds: [[-3, 0], [4, 0]], bright: 0.22, attack: 0.08, sway: 0.15, body: 'treble' }), layer: 'bed', gain: -27, verb: 0.45, duck: 0.06, eq: [['peak', 1750, 1.4, -3]] },
  { id: 'pizz', family: 'pizzicato strings', inst: pluck({ bright: 0.42, decay: 0.7, pick: 0.3, body: 'violin' }), layer: 'bed', gain: -28.5, pan: 0.32, verb: 0.25, human: [8, 0.1], tape: 1.5 },
  { id: 'tower', family: 'church bell', inst: churchBell(), layer: 'bed', gain: -26, pan: -0.2, verb: 0.6 },
  { id: 'basses', family: 'pizzicato basses', inst: pluck({ bright: 0.3, decay: 1.4, pick: 0.28, body: 'cello' }), layer: 'drive', gain: -22.5, human: [5, 0.06], tape: 2 },
  { id: 'bustle', family: 'pizzicato strings', inst: pluck({ bright: 0.56, decay: 0.4, pick: 0.25, body: 'violin' }), layer: 'drive', gain: -27.5, pan: -0.32, verb: 0.2, human: [5, 0.12], tape: 1.5 },
  { id: 'drum', family: 'toy drum', inst: snare(TOY_DRUM), layer: 'drive', gain: -28.5, pan: 0.12, verb: 0.15, human: [4, 0.1], tape: 3 },
  { id: 'bdrum', family: 'bass drum', inst: skin(MARCH_DRUM), layer: 'drive', gain: -22.5, kick: true, verb: 0.2, human: [4, 0.05], tape: 2.5 },
  { id: 'stomp', family: 'stomps', inst: stomp(), layer: 'drive', gain: -25, verb: 0.18, human: [6, 0.08] },
  { id: 'toy', family: 'toy piano', inst: toyPiano(), layer: 'lead', gain: -19, pan: 0.15, verb: 0.3, echo: 0.06, human: [5, 0.08] },
  { id: 'bells', family: 'hand-bells', inst: handBell(), layer: 'lead', gain: -19, pan: -0.15, verb: 0.4, human: [8, 0.08] },
  { id: 'peal', family: 'hand-bells', inst: handBell(7), layer: 'peak', gain: -24.5, pan: -0.4, verb: 0.5, human: [10, 0.1] },
  { id: 'glint', family: 'toy piano', inst: toyPiano(), layer: 'peak', gain: -26, pan: 0.45, verb: 0.35, echo: 0.1, human: [6, 0.1] },
  { id: 'tri', family: 'triangle', inst: triangle(), layer: 'peak', gain: -31, pan: 0.3, verb: 0.3, human: [4, 0.12] },
  ...fxTracks(0.35),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 0.92): Note[] => line(src, g, key, oct, v, leg);

/** Let ring: every note held `beats` beats (a hand-bell is damped only when its note ends). */
const lv = (ns: Note[], beats: number): Note[] => ns.map((n) => ({ ...n, dur: beats * BEAT }));
/** Notes a moment late (seconds). */
const late = (ns: Note[], s: number): Note[] => ns.map((n) => ({ ...n, t: n.t + s }));

/** The verse's tune, the street: three repeated notes and a run down, a bar a step lower each time (i bVII bVI V). */
const TUNE_A = ["5:3 5:1 5:2 1':2 7:2 6:2 5:4", '4:3 4:1 4:2 7:2 6:2 5:2 4:4', '3:3 3:1 3:2 6:2 5:2 4:2 3:4', '2:4 #7,:4 5,:4 r:4', "5:3 5:1 5:2 1':2 7:2 6:2 5:4", "6:3 6:1 6:2 2':2 1':2 7:2 6:4", "5:2 #7:2 2':2 #7:2 5:2 3:2 4:2 2:2", '1:4 3:2 2:2 1:8'].join(' | ');
const CHORDS_A = 'i | bVII | bVI | V | i | iv | V7 | i';
/** The hook, the roofs: a quick note off the eave, a leap up an octave held in the air, the landing stamped on the
 *  next beat; each bar a roof a step under the last over a bass that steps down with them. */
const HOOK = ["5,:1 5:3 3:4 r:2 1:1 2:1 3:4", '4,:1 4:3 2:4 r:2 7,:1 1:1 2:4', '3,:1 3:3 1:4 r:2 6,:1 7,:1 1:4', "5,:1 1':7 5:4 r:4", '6,:1 6:3 4:4 r:2 3:1 4:1 6:4', "5,:1 5:3 3:4 r:2 3:1 5:1 1':4", "6:1 2':3 1':4 3:1 1':3 7:4", "1':6 5:1 3:1 1:8"].join(' | ');
const CHORDS_HOOK = 'I | V/7 | vi | I/5 | IV | I/3 | ii V7 | I';
/** Where the hook lands, the beat after each hop: the stomp (a boot comes down a moment after the beat), the bass drum
 *  and a hand-bell chord rung as the sled lands; the toy drum and the basses leave the landing to the stomp. */
const LANDS = '....X........... ....X........... ....X........... ........X....... ....X........... ....X........... ....X.......X... X...............';
const BD_HOOK = 'X...x........... X...x........... X...x........... X.......x....... X...x........... X...x........... X...x.......x... X.......x.......';
/** The turn: the hand-bell choir's chorale, on the subdominant and home by the dominant. */
const TURN = ['6:4 5:2 4:2 3:4 1:4', '3:4 2:2 1:2 7,:4 6,:4', '2:6 3:2 4:4 6:4', '5:12 r:4'].join(' | ');
const CHORDS_TURN = 'IV | iii vi | ii | V7';

function intro(): Section {
  const chords = 'I | IV | I | V7';
  const p = progression(chords, BS);
  // The nave: the clock in the tower strikes three over the harmonium, the hand-bells ring rounds down from the
  // treble, and the toy drum rolls the town out into the street (the verse comes in on D minor: the cadence turned).
  const rounds = "r:16 | r:16 | 1':2 7:2 6:2 5:2 4:2 3:2 2:2 1:2 | r:16";
  return {
    id: 'intro', role: 'intro', bars: 4, key: F, chords, tune: rounds,
    parts: {
      harmonium: pad(p, g, F, 53, 4, 0.62),
      tower: [0, 1, 2].map((b) => ({ t: b * BAR, dur: 4, m: 53, v: 0.7 - 0.04 * b })),
      bells: L(rounds, F, 5, 0.7, 2.4),
      toy: at(L("5':2 3':2 2':4 r:8", F, 5, 0.42), g, 3),
      basses: at(bassLine(progression('V7', BS), g, F, 36, '1.......5.......', 1, 0.7), g, 3),
      drum: roll(g, 48, 64, 1, 0.15, 0.8),
      bdrum: hits('................ ................ ................ X.......X...x.x.', g, 4, BDRUM, 0.75),
    },
  };
}

function verse(): Section {
  const p = progression(CHORDS_A, BS);
  const tune = L(TUNE_A, DM, 5, 0.68, 0.82);
  // The street: the toy piano has the tune, a hand-bell rings the first note of each bar under it, the violins pluck
  // the chord off the beat and run in eighths, the cellos and basses are on every beat, and the drums march.
  return {
    id: 'a', role: 'low', bars: 8, key: DM, chords: CHORDS_A, tune: TUNE_A,
    parts: {
      toy: tune,
      bells: lv(downbeats(tune, g, -12, 0.5), 3),
      harmonium: pad(p, g, DM, 50, 3, 0.32),
      pizz: stabs(p, g, DM, 57, 3, '..x...x...x...x.', 8, 0.55, 1.1),
      basses: bassLine(p, g, DM, 36, '1...5...1...5...', 8, 0.78),
      bustle: arp(p, g, DM, 62, 3, 2, [0, 1, 2, 1], 8, 0.4, 1),
      drum: hits('..o.x..o..o.x.oo', g, 8, 60, 0.75),
      bdrum: hits('X.......x.......', g, 8, BDRUM, 0.8),
    },
  };
}

function chorus(id: string, key: Key, role: Section['role']): Section {
  const p = progression(CHORDS_HOOK, BS);
  const big = role === 'climax';
  const hook = L(HOOK, key, 5, 0.86, 0.9);
  // The roofs: the toy piano and the hand-bells an octave apart on the hook, a hand-bell chord rung on every landing
  // with the stomp and the bass drum, the violins running in sixteenths, the triangle now and then; on the last stage
  // the toy piano doubles it an octave up, the triangle is on every off-beat and the tower's bell marks its first beat.
  return {
    id, role, bars: 8, key, chords: CHORDS_HOOK, tune: HOOK,
    parts: {
      toy: hook,
      bells: L(HOOK, key, 4, 0.8, 0.95),
      peal: late(stabs(p, g, key, 65, 3, LANDS, 8, big ? 0.62 : 0.52, 6), 0.03),
      glint: big ? up(L(HOOK, key, 5, 0.55, 0.9), 12) : downbeats(hook, g, 12, 0.5),
      tri: hits(big ? '..x...x...x...x.' : '......x.......x.', g, 8, TRI, 0.6),
      harmonium: pad(p, g, key, 53, 4, big ? 0.5 : 0.42),
      pizz: stabs(p, g, key, 60, 3, '..x...x...x...x.', 8, 0.62, 1.1),
      basses: bassLine(p, g, key, 36, '1.......1...5...', 8, 0.88),
      bustle: arp(p, g, key, 65, 3, 1, [0, 1, 2, 1], 8, 0.38, 1),
      drum: hits(big ? '..o....o..o.x.xo' : '..o....o..o.x.oo', g, 8, 60, 0.85),
      bdrum: hits(BD_HOOK, g, 8, BDRUM, 0.92),
      stomp: late(hits(LANDS, g, 8, 60, 0.75), 0.02),
      tower: big ? [{ t: 0, dur: 4, m: 48 + key.pc, v: 0.4 }] : [],
    },
  };
}

function turn(id: string, key: Key, role: Section['role']): Section {
  const p = progression(CHORDS_TURN, BS);
  const climb = role === 'climb';
  // The church's hand-bell choir: the chorale rung on the bells, each note let ring into the next, chords rung under it
  // and the harmonium beneath; the street goes quiet round it (the drum only marks the bar), the toy piano answering.
  // On the climb to the line the toy piano takes the chorale with the bells and the street comes back in under it.
  return {
    id, role, bars: 4, key, chords: CHORDS_TURN, tune: TURN,
    parts: {
      bells: L(TURN, key, climb ? 4 : 5, climb ? 0.82 : 0.72, 1.5),
      toy: climb ? L(TURN, key, 5, 0.7, 0.9) : at(L("r:8 3':2 2':2 1':4", key, 5, 0.5), g, 1).concat(at(L("r:8 7:2 1':2 2':4", key, 5, 0.5), g, 2)),
      peal: pad(p, g, key, 60, 3, climb ? 0.5 : 0.4),
      harmonium: pad(p, g, key, 53, 4, climb ? 0.5 : 0.45),
      pizz: stabs(p, g, key, 60, 3, climb ? '..x...x...x...x.' : '....x.......x...', 4, 0.5, 1.1),
      basses: bassLine(p, g, key, 36, climb ? '1...5...1...5...' : '1.......5.......', 4, 0.75),
      bustle: climb ? arp(p, g, key, 65, 3, 1, [0, 1, 2, 1], 4, 0.4, 1) : [],
      drum: climb ? hits('..o.x..o..o.x.oo', g, 4, 60, 0.85) : hits('............o.oo', g, 4, 60, 0.5),
      bdrum: hits(climb ? 'X...x...X...x...' : 'X...............', g, 4, BDRUM, climb ? 0.9 : 0.7),
      tri: climb ? hits('..x...x...x...x.', g, 4, TRI, 0.55) : [],
    },
  };
}

function street(): Section {
  const p = progression(CHORDS_A, BS);
  // The second stage: the street again, wider. The toy piano takes its tune up the octave, the hand-bells keep it
  // where it was, a chord rung on each bar's first beat; the violins run in sixteenths, the triangle off the beat.
  return {
    id: 'd', role: 'mid', bars: 8, key: DM, chords: CHORDS_A, tune: TUNE_A,
    parts: {
      toy: L(TUNE_A, DM, 6, 0.66, 0.82),
      bells: L(TUNE_A, DM, 5, 0.66, 0.9),
      peal: lv(stabs(p, g, DM, 62, 3, 'X...............', 8, 0.45), 4),
      harmonium: pad(p, g, DM, 50, 4, 0.38),
      pizz: stabs(p, g, DM, 57, 3, '..x...x...x...x.', 8, 0.58, 1.1),
      basses: bassLine(p, g, DM, 36, '1...5...1...5...', 8, 0.85),
      bustle: arp(p, g, DM, 62, 3, 1, [0, 1, 2, 1], 8, 0.38, 1),
      drum: hits('..o.x..o..o.x.oo', g, 8, 60, 0.82),
      bdrum: hits('X...x...X...x...', g, 8, BDRUM, 0.85),
      tri: hits('..x...x...x...x.', g, 8, TRI, 0.5),
    },
  };
}

function breakdown(): Section {
  const chords = 'i | bVI | bIII | V';
  const p = progression(chords, BS);
  // The snow comes down and the street goes quiet: the hand-bells alone, a chord a bar let ring over the harmonium,
  // the tower's bell once, far off, and the toy piano high and slow, a window lit at the top of the town.
  const air = "5':8 4':4 3':4 | 3':12 r:4 | 5':8 3':4 1':4 | #7:16";
  return {
    id: 'bd', role: 'break', bars: 4, key: DM, chords, tune: air,
    parts: {
      bells: lv(stabs(p, g, DM, 62, 4, 'X...............', 4, 0.7), 4),
      harmonium: pad(p, g, DM, 50, 3, 0.45),
      tower: [{ t: 2 * BAR, dur: 4, m: 50, v: 0.45 }],
      toy: L(air, DM, 5, 0.5, 1),
    },
  };
}

function finale(): Section {
  const chords = 'I V | IV V | I | I';
  const p = progression(chords, BS);
  const fan = `${MOTIF[0]} | 6:6 7:2 2':8 | 1':16 | -:16`;
  // The river: the game's motif on the toy piano and the hand-bells over the whole band, and the tower's bell on the
  // last chord.
  return {
    id: 'fin', role: 'finale', bars: 4, key: G, chords, tune: fan,
    parts: {
      toy: L(fan, G, 5, 0.95, 1),
      bells: L(fan, G, 4, 0.92, 1),
      peal: pad(p, g, G, 62, 4, 0.45),
      glint: up(L(fan, G, 5, 0.6, 1), 12),
      harmonium: pad(p, g, G, 55, 4, 0.75),
      pizz: stabs(p, g, G, 60, 3, '..x...x...x...x. ..x...x...x...x. x............... ................', 4, 0.7, 1.2),
      bustle: arp(p, g, G, 67, 3, 1, [0, 1, 2, 1], 2, 0.45, 1),
      basses: bassLine(p, g, G, 36, '1...5...1...5... 1...5...1...5.5. 1............... ................', 4, 0.95),
      drum: [...hits('..o.x..o..o.x.oo', g, 1, 60, 0.9), ...roll(g, 16, 32, 1, 0.35, 0.95)],
      bdrum: hits('X...x...X...x... X...x...X...x.x. x............... ................', g, 4, BDRUM),
      stomp: late(hits('................ ................ x............... ................', g, 4, 60), 0.012),
      tri: hits('..x...x...x...x. ..x...x...x...x. X............... ................', g, 4, TRI, 0.7),
      tower: [{ t: 2 * BAR, dur: 5, m: 55, v: 0.85 }],
      crash: [{ t: 0, dur: 2, m: 60, v: 0.55 }, { t: 2 * BAR, dur: 3, m: 60, v: 0.65 }],
    },
  };
}

function results(): Section {
  const chords = 'I V | IV I/3 | ii V | I | vi IV | I/5 V | IV V | I';
  const p = progression(chords, BS);
  const tune = `${MOTIF.join(' | ')} | 3:6 6:2 5:4 4:4 | 5:6 3:2 2:8 | 4:6 6:2 5:4 7:4 | 1':16`;
  return {
    id: 'res', role: 'results', bars: 8, key: G, chords, tune,
    parts: {
      toy: L(tune, G, 5, 0.55, 1),
      harmonium: pad(p, g, G, 53, 3, 0.42),
      pizz: arp(p, g, G, 55, 3, 2, [0, 1, 2, 1], 8, 0.4, 2),
      basses: bassLine(p, g, G, 36, '1.......5.......', 8, 0.6),
      bells: at(L("r:8 5:4 1':4", G, 4, 0.42, 2), g, 3).concat(at(L("r:8 3':4 1':4", G, 4, 0.42, 2), g, 7)),
      tower: [{ t: 7 * BAR, dur: 5, m: 55, v: 0.4 }],
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'toy', oct: 5 }, { track: 'bells', oct: 4, vel: 0.75 }],
  low: [{ track: 'basses', oct: 2 }, { track: 'harmonium', oct: 3, vel: 0.8 }],
  bell: [{ track: 'bells', oct: 4 }, { track: 'glint', oct: 6, vel: 0.6 }],
  perc: [{ track: 'bdrum', m: BDRUM }, { track: 'drum', m: 60, vel: 0.6 }],
  hold: [{ track: 'harmonium', oct: 3, vel: 0.6 }, { track: 'peal', oct: 4, vel: 0.45 }],
};

export const gablefall: Piece = {
  id: 'gablefall',
  name: 'Gablefall',
  style: "a winter march for the town on the hill: hand-bells and a toy piano, pizzicato strings (the violins, the cellos and basses), a toy drum, a bass drum, stomps and a triangle, the church's harmonium and the tower's bell",
  grid: g,
  key: F,
  tracks,
  sections: [intro(), verse(), chorus('b', F, 'high'), turn('c', F, 'mid'), street(), breakdown(), chorus('b2', G, 'climax'), turn('c2', G, 'climb'), finale(), results()],
  shots: [
    buildShot(g, F, 2, { drum: [...roll(g, 0, 16, 2, 0.2, 0.5), ...roll(g, 16, 32, 1, 0.5, 1)], swell: [{ t: 0, dur: 3, m: 60, v: 0.7 }], bdrum: hits('................ ........x...x.x.', g, 2, BDRUM) }),
    // (The hit is struck, not pitched: it lands on the F major hook and on the G major one alike.)
    hitShot({ bdrum: [{ t: 0, dur: 0.3, m: BDRUM, v: 1 }], stomp: [{ t: 0, dur: 0.2, m: 60, v: 1 }], tri: [{ t: 0, dur: 1, m: TRI, v: 0.9 }] }),
    ...[...GESTURES, ...OWN_GESTURES.gablefall].map((x) => stinger(x, g, F, band)),
  ],
  verb: { ...HALL, t60: 2.1, size: 1, damp: 5600 },
  echo: { steps: 3, feedback: 0.2 },
  // The master: the bass drum and the basses full, the bells' and the toy piano's bodies warm, their edge taken off at
  // 2 kHz and their glint left on top (and the march's struck notes kept off the limiter).
  master: { eq: [['hp', 38, 0.7], ['loshelf', 133, 0.7, 3.5], ['peak', 655, 1.1, 2.5], ['peak', 2265, 1.1, -4], ['hishelf', 5000, 0.7, -0.5]], comp: { threshold: -15, ratio: 2, attack: 0.01, release: 0.2, knee: 8 }, width: 1 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
