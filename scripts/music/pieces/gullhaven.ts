import { HALL } from '../fx';
import { bowed, choir, churchBell, pluck, reed } from '../inst';
import type { Note } from '../inst';
import { type Grid, type Key, arp, at, barDur, bassLine, hits, line, pad, progression, roll, stabs, stepDur, stepsPerBar } from '../notation';
import { type SkinOpts, skin } from '../perc';
import type { Piece, Section, Track } from '../piece';
import { GESTURES, MOTIF, OWN_GESTURES, type StingBand, buildShot, fxTracks, hitShot, stinger } from './common';

// Gullhaven (round 9): a reel for squeezebox and fiddle over a deep drum and a low choir, the harbour's band out on
// the cape in a storm's light. E dorian at 104: the box and the fiddle run the tune together in quick even notes (a
// reel's eighths, two of its bars to one of ours), a cittern picks the chords under them, the box's bass reeds hold
// the tonic and its fifth like a pipe's drone, a bodhran drives the reel and a deep drum marks the beat like surf on
// the stacks; a bell buoy tolls in the swell. The hook is the soar: four quick notes off the lip, a note held on the
// wind, and the line coming down onto the far shelf. The second fiddle comes in a third under when the run opens
// up. The last stage, the Harbour Road, lifts a whole tone to F#, and the harbour's lights are the game's motif in
// F# major. Original.

const g: Grid = { bpm: 104, beats: 4, div: 4, swing: 0.05 };
const E: Key = { pc: 4, mode: 'dorian' };
const FS: Key = { pc: 6, mode: 'dorian' };
const HOME: Key = { pc: 6, mode: 'major' };
const BS = stepsPerBar(g);
const BAR = barDur(g);
const STEP = stepDur(g);
/** The deep drum's pitch (B1: the fifth, under everything) and the bodhran's two skins. */
const DRUM = 35;
const SKIN_LO = 45;
const SKIN_HI = 52;
/** The bell buoy rings the key's tonic over middle C. */
const bellOf = (k: Key): number => 60 + k.pc;

const DEEP: SkinOpts = { decay: 1.8, fall: 0.16, stick: 0.3, modes: 0.4, drive: 1.4 };
const BODHRAN: SkinOpts = { decay: 0.42, fall: 0.06, stick: 0.5, modes: 0.55 };

const tracks: Track[] = [
  { id: 'choir', family: 'low choir', inst: choir({ from: 'oo', to: 'ah', voices: 6, attack: 0.6, release: 1.1, breath: 0.3 }), layer: 'bed', gain: -24, verb: 0.5, duck: 0.08 },
  { id: 'drone', family: 'squeezebox', inst: reed({ reeds: [[0, 0], [4, 1]], bright: 0.3, attack: 0.05, sway: 0.6, body: 'bass' }), layer: 'bed', gain: -28, verb: 0.3 },
  { id: 'cittern', family: 'cittern', inst: pluck({ bright: 0.6, decay: 1.5, pick: 0.15, body: 'mando' }), layer: 'bed', gain: -25, pan: 0.38, verb: 0.2, human: [6, 0.1] },
  { id: 'buoy', family: 'bell buoy', inst: churchBell(), layer: 'bed', gain: -29, pan: -0.3, verb: 0.55, human: [12, 0.1] },
  { id: 'drum', family: 'deep drum', inst: skin(DEEP), layer: 'drive', gain: -20, kick: true, verb: 0.25, human: [4, 0.05] },
  { id: 'bodhran', family: 'bodhran', inst: skin(BODHRAN), layer: 'drive', gain: -24, pan: -0.15, verb: 0.15, human: [4, 0.12] },
  { id: 'bass', family: 'squeezebox', inst: reed({ reeds: [[0, 0], [3, 1]], bright: 0.4, attack: 0.03, sway: 0.2, body: 'bass' }), layer: 'drive', gain: -22, human: [5, 0.06], comp: { threshold: -18, ratio: 3, attack: 0.01, release: 0.12 } },
  { id: 'box', family: 'squeezebox', inst: reed({ reeds: [[-7, 0], [9, 0]], bright: 0.55, attack: 0.02, sway: 0.3, body: 'treble' }), layer: 'lead', gain: -18, pan: -0.12, verb: 0.22, echo: 0.04, human: [5, 0.07] },
  { id: 'fiddle', family: 'fiddle', inst: bowed({ body: 'violin', voices: 1, bright: 0.66, vib: 12, vibDelay: 0.2, attack: 0.03 }), layer: 'lead', gain: -18.5, pan: 0.16, verb: 0.28, echo: 0.05, human: [7, 0.08] },
  { id: 'fiddle2', family: 'fiddle', inst: bowed({ body: 'violin', voices: 1, bright: 0.58, vib: 14, vibDelay: 0.25, attack: 0.035 }), layer: 'peak', gain: -22, pan: 0.42, verb: 0.32, human: [8, 0.08] },
  ...fxTracks(0.35),
];

const L = (src: string, key: Key, oct: number, v = 0.8, leg = 0.92): Note[] => line(src, g, key, oct, v, leg);

/** The reel's lilt: the bellows and the bow lean on the beat and ease off between. */
const lilt = (ns: Note[], k = 0.12): Note[] =>
  ns.map((n) => {
    const s = Math.round(n.t / STEP);
    return { ...n, v: Math.min(1, n.v * (s % 4 === 0 ? 1 + k : s % 2 === 0 ? 1 : 1 - k)) };
  });

/** A fiddler's cut: each held note on a beat flicked in from the note above. */
const cuts = (ns: Note[]): Note[] => ns.map((n) => (n.dur > STEP * 1.5 && Math.round(n.t / STEP) % 4 === 0 ? { ...n, slide: n.slide ?? 2 } : n));

/** A line a third under itself, in the scale: what the second fiddle plays beside the first. */
function under(src: string): string {
  return src.replace(/([\^_]?)([#b]?)([1-7])([',]*)([!?]?):/g, (_m, cut: string, acc: string, d: string, marks: string, mark: string) => {
    const ups = [...marks].filter((c) => c === "'").length - [...marks].filter((c) => c === ',').length;
    const i = Number(d) - 1 + 7 * ups - 2;
    const o = Math.floor(i / 7);
    return `${cut}${acc}${i - 7 * o + 1}${o > 0 ? "'".repeat(o) : ','.repeat(-o)}${mark}:`;
  });
}

/** The box's bass reeds held under a section: the tonic and its fifth, the bellows turned every two bars. */
function drone(key: Key, bars: number, vel = 0.5, from = 0): Note[] {
  const out: Note[] = [];
  const root = 36 + key.pc;
  for (let b = from; b < bars; b += 2) {
    const dur = Math.min(2, bars - b) * BAR - 0.06;
    out.push({ t: b * BAR, dur, m: root, v: vel }, { t: b * BAR, dur, m: root + 7, v: vel * 0.8 });
  }
  return out;
}

/** The bodhran: the low skin on its pattern, the hand pressing the skin for the high one. */
const bodhran = (lo: string, hi: string, bars: number, vel = 1): Note[] => [...hits(lo, g, bars, SKIN_LO, vel), ...hits(hi, g, bars, SKIN_HI, vel * 0.8)];

/** The verse's tune, the reel: two of its bars to one of ours, running through the chords (i VII i IV, i VII v i). */
const A1 = '1:2 5,:1 1:1 3:1 5:1 3:1 1:1 2:1 3:1 4:1 5:1 6:1 5:1 4:1 2:1';
const A2 = '7:2 4:1 7:1 2:1 4:1 7:1 2:1 1:1 2:1 4:1 5:1 4:1 2:1 1:1 7,:1';
const TUNE_A = [A1, A2, "1:2 5,:1 1:1 3:1 5:1 1':1 5:1 7:1 5:1 4:1 3:1 2:1 3:1 4:1 2:1", "6:2 4:1 6:1 1':2 6:1 4:1 5:1 4:1 3:1 2:1 1:2 5,:2", A1, A2, "5:2 2:1 5:1 7:1 2':1 7:1 5:1 4:1 2:1 7,:1 2:1 4:1 5:1 4:1 2:1", '3:1 2:1 1:1 7,:1 1:2 5,:2 1:4 1:1 2:1 3:1 4:1'].join(' | ');
const CHORDS_A = 'i | bVII | i | IV | i | bVII | v | i';
/** The hook, the soar: four quick notes off the lip, a note held on the wind, and the line coming down to land. */
const LIFT = "4:1 5:1 6:1 1':1 4':6 3':1 2':1 1':4";
const HOOK = [LIFT, "5:1 6:1 7:1 1':1 5':6 4':1 3':1 2':4", "4:1 5:1 7:1 1':1 2':6 1':1 7:1 4:4", "5:2 7:2 2':4 7:2 5:2 4:4", LIFT, "5:1 6:1 7:1 1':1 3':6 2':1 1':1 7:4", "7:1 1':1 2':1 4':1 5':8 4':2 2':2", "1':2 7:2 5:2 3:2 1:8"].join(' | ');
const CHORDS_HOOK = 'IV | i | bVII | v | IV | i | bVII | i';
/** The turn: the reel's second part, high on the relative major's chords, ending open on the minor fifth. */
const TURN = ["3':2 1':1 3':1 5:1 1':1 3':1 1':1 2':1 1':1 7:1 5:1 7:1 2':1 4':1 2':1", "4':2 2':1 4':1 7:1 2':1 4':1 2':1 1':1 2':1 1':1 7:1 6:1 7:1 1':1 6:1", "6:2 4:1 6:1 1':1 4':1 1':1 6:1 5:1 6:1 1':1 6:1 5:1 4:1 2:1 4:1", '5:2 2:2 4:2 5:2 7:4 5:4'].join(' | ');
const CHORDS_TURN = 'bIII | bVII | IV | v';

function intro(): Section {
  const chords = 'i | bVII | i | v';
  const p = progression(chords, BS);
  // The beacon: the choir low under the drone, the drum like surf far below, the fiddle calling the band in.
  const call = "1:4 2:2 3:2 5:8 | 4:4 2:4 7,:8 | 1:4 3:2 5:2 1':8 | 7:6 5:2 2:4 5,:1 7,:1 1:1 2:1";
  return {
    id: 'intro', role: 'intro', bars: 4, key: E, chords, tune: call,
    parts: {
      fiddle: cuts(L(call, E, 4, 0.5, 0.97)),
      choir: pad(p, g, E, 47, 3, 0.5),
      drone: drone(E, 4, 0.55),
      buoy: [{ t: 0, dur: 3, m: bellOf(E), v: 0.6 }, { t: 2 * BAR, dur: 3, m: bellOf(E), v: 0.5 }],
      drum: hits('X............... ................ X............... X.......x.......', g, 4, DRUM, 0.8),
      bodhran: hits('................ ................ ................ ........o.x.x.xx', g, 4, SKIN_LO, 0.7),
    },
  };
}

function verse(): Section {
  const p = progression(CHORDS_A, BS);
  return {
    id: 'a', role: 'low', bars: 8, key: E, chords: CHORDS_A, tune: TUNE_A,
    parts: {
      box: lilt(L(TUNE_A, E, 4, 0.66)),
      fiddle: cuts(lilt(L(TUNE_A, E, 4, 0.58))),
      cittern: arp(p, g, E, 52, 3, 2, [0, 2, 1, 2], 8, 0.5, 2),
      choir: pad(p, g, E, 47, 3, 0.4),
      drone: drone(E, 8, 0.5),
      drum: hits('X.......x.......', g, 8, DRUM, 0.85),
      bodhran: bodhran('x...o...x...o...', '..o...o...o...og', 8),
      bass: bassLine(p, g, E, 33, '1.......5.......', 8, 0.75),
    },
  };
}

function chorus(id: string, key: Key, role: Section['role']): Section {
  const p = progression(CHORDS_HOOK, BS);
  const big = role === 'climax';
  return {
    id, role, bars: 8, key, chords: CHORDS_HOOK, tune: HOOK,
    parts: {
      box: lilt(L(HOOK, key, 4, 0.88, 0.95)),
      fiddle: cuts(lilt(L(HOOK, key, 4, 0.78, 0.95))),
      fiddle2: cuts(L(under(HOOK), key, 4, 0.62, 0.95)),
      cittern: arp(p, g, key, 52, 3, 2, [0, 2, 1, 2], 8, 0.6, 2),
      choir: pad(p, g, key, big ? 52 : 50, 4, big ? 0.72 : 0.6),
      drone: drone(key, 8, 0.45),
      buoy: hits(big ? 'X...............' : 'X............... ................', g, 8, bellOf(key), 0.55, 3),
      drum: hits(big ? 'X...x...X...x.x.' : 'X...x...X...x...', g, 8, DRUM, 0.9),
      bodhran: bodhran('X..gx.g.X..gx.g.', '..x...x...x...x.', 8),
      bass: bassLine(p, g, key, 33, '1...5...1...5...', 8, 0.85),
      crash: big ? [{ t: 0, dur: 2, m: 60, v: 0.8 }] : [],
    },
  };
}

function turn(id: string, key: Key, role: Section['role']): Section {
  const p = progression(CHORDS_TURN, BS);
  const climb = role === 'climb';
  // The second part: the fiddle alone on it while the box pumps its chords off the beat; on the climb to the line
  // the box joins the tune and the second fiddle comes in under it.
  return {
    id, role, bars: 4, key, chords: CHORDS_TURN, tune: TURN,
    parts: {
      fiddle: cuts(lilt(L(TURN, key, 4, climb ? 0.8 : 0.66))),
      box: climb ? lilt(L(TURN, key, 4, 0.82)) : stabs(p, g, key, 57, 3, '..x...x...x...x.', 4, 0.48, 1.6),
      fiddle2: climb ? lilt(L(under(TURN), key, 4, 0.55)) : [],
      cittern: arp(p, g, key, 52, 3, 2, [0, 2, 1, 2], 4, 0.55, 2),
      choir: pad(p, g, key, 50, 3, climb ? 0.65 : 0.48),
      drone: drone(key, 4, 0.45),
      buoy: climb ? hits('X...............', g, 4, bellOf(key), 0.5, 3) : [],
      drum: hits(climb ? 'X...x...X...x.x.' : 'X.......x.....x.', g, 4, DRUM, climb ? 0.95 : 0.85),
      bodhran: climb ? bodhran('X.gxX.gxX.gxX.gx', '..x...x...x...x.', 4) : bodhran('x...o...x...o...', '..o...o...o...og', 4),
      bass: bassLine(p, g, key, 33, climb ? '1...5...1...5...' : '1.......1...5...', 4, 0.8),
    },
  };
}

function geos(): Section {
  const p = progression(CHORDS_A, BS);
  // The Geos: the reel again, wider. The fiddle takes it up the octave, the box pumps its chords off the beat, the
  // drum on every beat; the second fiddle keeps the tune where it was.
  return {
    id: 'd', role: 'mid', bars: 8, key: E, chords: CHORDS_A, tune: TUNE_A,
    parts: {
      fiddle: cuts(lilt(L(TUNE_A, E, 5, 0.72))),
      box: stabs(p, g, E, 57, 3, '..x...x...x...x.', 8, 0.62, 1.6),
      fiddle2: lilt(L(TUNE_A, E, 4, 0.58)),
      cittern: arp(p, g, E, 52, 3, 1, [0, 2, 1, 2], 8, 0.5, 1),
      choir: pad(p, g, E, 50, 4, 0.55),
      drone: drone(E, 8, 0.5),
      buoy: hits('X............... ................', g, 8, bellOf(E), 0.45, 3),
      drum: hits('X...x...X...x...', g, 8, DRUM, 0.9),
      bodhran: bodhran('X..gx.g.X..gx.g.', '..x...x...x.x.x.', 8),
      bass: bassLine(p, g, E, 33, '1...5...1...5...', 8, 0.85),
    },
  };
}

function breakdown(): Section {
  const chords = 'i | bIII | bVII | v';
  const p = progression(chords, BS);
  // The band stops at the lip of the Great Geo: the bell buoy and the choir over the box's drone, the fiddle high
  // and slow and far off over them.
  const air = "5':12 4':2 3':2 | 2':12 1':4 | 7:8 2':8 | 5:16";
  return {
    id: 'bd', role: 'break', bars: 4, key: E, chords, tune: air,
    parts: {
      choir: pad(p, g, E, 45, 4, 0.42),
      drone: drone(E, 4, 0.35),
      buoy: hits('X.......x....... X............... X.......x....... X...............', g, 4, bellOf(E), 0.6, 3),
      fiddle: cuts(L(air, E, 4, 0.3, 1)),
    },
  };
}

function finale(): Section {
  const chords = 'I V | IV V | I | I';
  const p = progression(chords, BS);
  const fan = `${MOTIF[0]} | 6:6 7:2 2':8 | 1':16 | -:16`;
  return {
    id: 'fin', role: 'finale', bars: 4, key: HOME, chords, tune: fan,
    parts: {
      box: L(fan, HOME, 4, 0.95, 1),
      fiddle: cuts(L(fan, HOME, 4, 0.85, 1)),
      fiddle2: L(fan, HOME, 5, 0.65, 1),
      choir: pad(p, g, HOME, 52, 4, 0.85),
      cittern: arp(p, g, HOME, 54, 3, 2, [0, 2, 1, 2], 2, 0.65, 2),
      drone: drone(HOME, 4, 0.55, 2),
      bass: bassLine(p, g, HOME, 33, '1...5...1...5... 1...5...1...5.5. 1............... ................', 4, 0.95),
      drum: hits('X...X...X...X... X...X...X...X.X. X............... ................', g, 4, DRUM),
      bodhran: hits('X.x.X.x.X.x.X.x. X.x.X.x.X.xxXxXx X............... ................', g, 4, SKIN_LO),
      buoy: [{ t: 0, dur: 3, m: bellOf(HOME), v: 0.7 }, { t: 2 * BAR, dur: 4, m: bellOf(HOME), v: 0.85 }],
      crash: [{ t: 0, dur: 2, m: 60, v: 0.9 }, { t: 2 * BAR, dur: 3, m: 60, v: 1 }],
    },
  };
}

function results(): Section {
  const chords = 'I V | IV I/3 | ii V | I | vi IV | I/5 V | IV V | I';
  const p = progression(chords, BS);
  const tune = `${MOTIF.join(' | ')} | 3:6 6:2 5:4 4:4 | 5:6 3:2 2:8 | 4:6 6:2 5:4 7:4 | 1':16`;
  return {
    id: 'res', role: 'results', bars: 8, key: HOME, chords, tune,
    parts: {
      choir: pad(p, g, HOME, 50, 3, 0.45),
      cittern: arp(p, g, HOME, 54, 3, 2, [0, 2, 1, 2], 8, 0.45, 2),
      box: L(tune, HOME, 4, 0.55, 1),
      fiddle: at(L("r:8 5:4 1':4", HOME, 4, 0.45), g, 3).concat(at(L("r:8 3':4 1':4", HOME, 4, 0.45), g, 7)),
      buoy: hits('X............... ................ ................ ................', g, 8, bellOf(HOME), 0.4, 3),
      bodhran: hits('x...............', g, 8, SKIN_LO, 0.4),
    },
  };
}

const band: StingBand = {
  lead: [{ track: 'box', oct: 4 }, { track: 'fiddle', oct: 5, vel: 0.7 }],
  low: [{ track: 'choir', oct: 3, vel: 0.9 }, { track: 'bass', oct: 2 }],
  bell: [{ track: 'buoy', oct: 4 }, { track: 'cittern', oct: 4, vel: 0.8 }],
  perc: [{ track: 'drum', m: DRUM }, { track: 'bodhran', m: SKIN_LO, vel: 0.7 }],
  hold: [{ track: 'choir', oct: 3, vel: 0.7 }, { track: 'drone', oct: 2, vel: 0.5 }],
};

export const gullhaven: Piece = {
  id: 'gullhaven',
  name: 'Gullhaven',
  style: "a reel for the harbour's band in a storm: squeezebox and fiddle, a second fiddle, a cittern, the box's bass reeds, a bodhran and a deep drum, a low choir and a bell buoy",
  grid: g,
  key: E,
  tracks,
  sections: [intro(), verse(), chorus('b', E, 'high'), turn('c', E, 'mid'), geos(), breakdown(), chorus('b2', FS, 'climax'), turn('c2', FS, 'climb'), finale(), results()],
  shots: [
    buildShot(g, E, 2, { bodhran: [...roll(g, 0, 16, 2, 0.2, 0.5, SKIN_LO), ...roll(g, 16, 32, 1, 0.5, 1, SKIN_LO)], swell: [{ t: 0, dur: 3, m: 60, v: 0.7 }], drum: hits('................ ........x...x.x.', g, 2, DRUM) }),
    hitShot({ drum: [{ t: 0, dur: 0.3, m: DRUM, v: 1 }], buoy: [{ t: 0, dur: 3, m: bellOf(E), v: 0.8 }] }),
    ...[...GESTURES, ...OWN_GESTURES.gullhaven].map((x) => stinger(x, g, E, band)),
  ],
  verb: { ...HALL, t60: 2.9, size: 1.15, damp: 5200 },
  echo: { steps: 3, feedback: 0.22 },
  master: { eq: [['hp', 36, 0.7], ['peak', 250, 1.2, -4], ['peak', 560, 1.2, 1.5], ['peak', 3800, 1, 2.5], ['hishelf', 7000, 0.7, -2.5]], comp: { threshold: -15, ratio: 2, attack: 0.02, release: 0.25, knee: 8 }, width: 1 },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['d', 'b', 'c', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
};
