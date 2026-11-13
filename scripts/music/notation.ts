import type { Note } from './inst';

// The score's notation (round 7): how the pieces are written down. Melodies are lines of scale degrees
// with lengths in grid steps, checked against their bars; harmony is roman numerals; drums are step
// strings. Helpers turn a chord progression into a guitar's strums, a harp's arpeggios, a bass line or a
// voice-led pad. Pure: no audio here, so the tests and the analysis read the same score the renderer plays.

export type Mode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixo';

export const SCALES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};

export interface Key {
  /** The tonic's pitch class, 0 = C. */
  pc: number;
  mode: Mode;
}

/** The grid a piece is written on. */
export interface Grid {
  bpm: number;
  /** Beats in a bar and grid steps in a beat (4 and 4 in common time; 2 and 6 in a slow 6/8). */
  beats: number;
  div: number;
  /** How late every second step falls, as a fraction of a step. */
  swing: number;
}

export const stepsPerBar = (g: Grid): number => g.beats * g.div;
/** Seconds a step: a beat is a quarter in simple time and a dotted quarter in compound time. */
export const stepDur = (g: Grid): number => 60 / g.bpm / g.div;
export const barDur = (g: Grid): number => stepDur(g) * stepsPerBar(g);
/** When step `s` (fractions allowed) sounds, swing included. */
export function timeOf(g: Grid, s: number): number {
  const whole = Math.floor(s + 1e-9);
  const odd = Math.abs(s - whole) < 1e-6 && (whole & 1) === 1;
  return (s + (odd ? g.swing : 0)) * stepDur(g);
}

/** Semitones over the tonic of scale degree d (1 is the tonic, 8 the octave, 0 the seventh below). */
export function degree(mode: Mode, d: number): number {
  const sc = SCALES[mode];
  const i = d - 1;
  const o = Math.floor(i / 7);
  return sc[i - o * 7] + 12 * o;
}

/** One written note: where it starts and how long it is in steps, and its pitch in semitones over the tonic. */
export interface Written {
  s: number;
  l: number;
  /** Semitones over the tonic in the line's home octave. */
  p: number;
  /** Velocity offset from the line's own (an accent or a soft note). */
  acc: number;
  /** Semitones it slides in from (a cut from above, a scoop from below). */
  slide: number;
}

/**
 * A melody from text. Tokens are `pitch:steps`; the pitch is a scale degree (1 to 7) with `'` for an
 * octave up or `,` for one down, `#` or `b` in front to bend it a semitone, `r` for a rest, and `-:n`
 * to hold the note before for n more steps. `!` after a pitch accents it, `?` softens it; `^` in front
 * slides in from the note above (a fiddler's cut), `_` from a semitone below. A `|` ends a bar, and every
 * bar must be exactly full: a line that does not add up is a mistake, and throws.
 */
export function parseLine(src: string, mode: Mode, barSteps: number): Written[] {
  const out: Written[] = [];
  let s = 0;
  let bar = 0;
  let barStart = 0;
  for (const tok of src.split(/\s+/).filter(Boolean)) {
    if (tok === '|') {
      if (s - barStart !== barSteps) throw new Error(`bar ${bar + 1} of "${src.slice(0, 40)}..." has ${s - barStart} steps, not ${barSteps}`);
      bar++;
      barStart = s;
      continue;
    }
    const m = /^([\^_]?)([#b]?)([1-7r-])([',]*)([!?]?):(\d+(?:\.\d+)?)$/.exec(tok);
    if (!m) throw new Error(`bad note "${tok}"`);
    const len = Number(m[6]);
    if (m[3] === 'r') {
      s += len;
      continue;
    }
    if (m[3] === '-') {
      const last = out[out.length - 1];
      if (!last) throw new Error('a tie with nothing to hold');
      last.l += len;
      s += len;
      continue;
    }
    let p = degree(mode, Number(m[3])) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    for (const c of m[4]) p += c === "'" ? 12 : -12;
    out.push({ s, l: len, p, acc: m[5] === '!' ? 0.15 : m[5] === '?' ? -0.2 : 0, slide: m[1] === '^' ? 2 : m[1] === '_' ? -1 : 0 });
    s += len;
  }
  if (s !== barStart && s - barStart !== barSteps) throw new Error(`the last bar of "${src.slice(0, 40)}..." has ${s - barStart} steps, not ${barSteps}`);
  return out;
}

/** Written notes as sounding notes: `base` is the MIDI pitch of the tonic in the line's home octave,
 *  `legato` the share of each note's length it is held for. */
export function sound(w: readonly Written[], g: Grid, base: number, vel = 0.8, legato = 0.92, from = 0): Note[] {
  return w.map((x) => {
    const t = timeOf(g, from + x.s);
    return { t, dur: Math.max(0.03, (timeOf(g, from + x.s + x.l) - t) * legato), m: base + x.p, v: Math.max(0.05, Math.min(1, vel + x.acc)), slide: x.slide || undefined };
  });
}

/** A melody in one call. `oct` is the octave of the tonic the line is written round (4: middle C's). */
export function line(src: string, g: Grid, key: Key, oct: number, vel = 0.8, legato = 0.92, fromBar = 0): Note[] {
  return sound(parseLine(src, key.mode, stepsPerBar(g)), g, 12 * (oct + 1) + key.pc, vel, legato, fromBar * stepsPerBar(g));
}

// ------------------------------------------------------------------- harmony

export interface Chord {
  /** Root and bass, semitones over the tonic (0..11). */
  root: number;
  bass: number;
  /** Tones over the root, the root's own 0 first. */
  tones: readonly number[];
  name: string;
}

const ROMAN: Record<string, number> = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
const DEG_SEMI = [0, 2, 4, 5, 7, 9, 11];

/**
 * A chord from a roman numeral, counted on the major scale of the tonic whatever the mode, so a bVI is a
 * bVI in any key: upper case major, lower case minor, a `b` or `#` in front, then `7`, `maj7`, `6`, `9`,
 * `maj9`, `add9`, `sus4`, `sus2`, `5` (no third) or `dim`, then `/n` for the bass as a degree of the major
 * scale (with `b` or `#`).
 */
export function chord(sym: string): Chord {
  const m = /^([b#]?)([ivIV]+)(maj9|maj7|add9|sus4|sus2|dim|m7b5|9|7|6|5)?(?:\/([b#]?)([1-7]))?$/.exec(sym);
  if (!m) throw new Error(`bad chord "${sym}"`);
  const num = ROMAN[m[2].toLowerCase()];
  if (num === undefined) throw new Error(`bad numeral "${sym}"`);
  const minor = m[2] === m[2].toLowerCase();
  const root = (num + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0) + 12) % 12;
  const third = minor ? 3 : 4;
  let tones: number[];
  switch (m[3]) {
    case '7': tones = [0, third, 7, 10]; break;
    case 'maj7': tones = [0, 4, 7, 11]; break;
    case '6': tones = [0, third, 7, 9]; break;
    case '9': tones = [0, third, 7, 10, 14]; break;
    case 'maj9': tones = [0, 4, 7, 11, 14]; break;
    case 'add9': tones = [0, third, 7, 14]; break;
    case 'sus4': tones = [0, 5, 7]; break;
    case 'sus2': tones = [0, 2, 7]; break;
    case '5': tones = [0, 7]; break;
    case 'dim': tones = [0, 3, 6]; break;
    case 'm7b5': tones = [0, 3, 6, 10]; break;
    default: tones = [0, third, 7];
  }
  const bass = m[5] ? (DEG_SEMI[Number(m[5]) - 1] + (m[4] === 'b' ? -1 : m[4] === '#' ? 1 : 0) + 12) % 12 : root;
  return { root, bass, tones, name: sym };
}

/** A chord held for a stretch of steps. */
export interface Span {
  chord: Chord;
  s: number;
  l: number;
}

/** A progression from text: bars between `|`, the chords in a bar sharing it evenly, or `sym:steps`. */
export function progression(src: string, barSteps: number): Span[] {
  const out: Span[] = [];
  let s = 0;
  for (const bar of src.split('|').map((b) => b.trim()).filter(Boolean)) {
    const toks = bar.split(/\s+/);
    const fixed = toks.every((t) => t.includes(':'));
    let used = 0;
    toks.forEach((t) => {
      const [sym, n] = t.split(':');
      const l = fixed ? Number(n) : barSteps / toks.length;
      out.push({ chord: chord(sym), s: s + used, l });
      used += l;
    });
    if (Math.abs(used - barSteps) > 1e-6) throw new Error(`the bar "${bar}" has ${used} steps, not ${barSteps}`);
    s += barSteps;
  }
  return out;
}

/** The chord sounding at step s. */
export function chordAt(prog: readonly Span[], s: number): Chord {
  let c = prog[0].chord;
  for (const p of prog) if (p.s <= s + 1e-6) c = p.chord;
  return c;
}

const pcOf = (m: number): number => ((m % 12) + 12) % 12;

/**
 * A close voicing of `c` in the key with tonic pitch class `pc`: `n` notes from `lo` up, the one whose notes
 * move least from `prev` (the voicing before), so a pad's inner parts step where they can and stay where
 * they can.
 */
export function voicing(c: Chord, pc: number, lo: number, n: number, prev?: readonly number[]): number[] {
  // Thirds and sevenths say what the chord is; the fifth goes first when there are too few voices.
  const order = [...c.tones].sort((a, b) => rank(a) - rank(b));
  const pcs = order.slice(0, Math.max(2, Math.min(n, order.length))).map((t) => pcOf(pc + c.root + t));
  let best: number[] = [];
  let bestCost = Infinity;
  for (let start = lo; start < lo + 12; start++) {
    if (!pcs.includes(pcOf(start))) continue;
    const v: number[] = [];
    for (let m = start; v.length < n && m < start + 30; m++) if (pcs.includes(pcOf(m))) v.push(m);
    if (v.length < Math.min(n, 2)) continue;
    let cost = 0;
    if (prev && prev.length) for (let i = 0; i < v.length; i++) cost += Math.abs(v[i] - prev[Math.min(i, prev.length - 1)]);
    else cost = Math.abs(start - lo - 4);
    if (cost < bestCost) {
      bestCost = cost;
      best = v;
    }
  }
  return best;
}

function rank(t: number): number {
  const x = t % 12;
  return x === 3 || x === 4 || x === 5 || x === 2 ? 0 : x === 10 || x === 11 || x === 9 ? 1 : x === 0 ? 2 : t >= 12 ? 3 : 4;
}

/** A pad: every chord of the progression held for its length in a voice-led voicing of `n` notes from `lo`. */
export function pad(prog: readonly Span[], g: Grid, key: Key, lo: number, n: number, vel = 0.7, overlap = 1): Note[] {
  const out: Note[] = [];
  let prev: number[] | undefined;
  for (const p of prog) {
    const v = voicing(p.chord, key.pc, lo, n, prev);
    prev = v;
    const t = timeOf(g, p.s);
    for (const m of v) out.push({ t, dur: (timeOf(g, p.s + p.l) - t) * overlap, m, v: vel });
  }
  return out;
}

/** The bass note of a chord, at or above `lo`. */
export function bassOf(c: Chord, pc: number, lo: number): number {
  let m = lo + ((pcOf(pc + c.bass) - pcOf(lo) + 12) % 12);
  if (m - lo > 9) m -= 12;
  return m < lo - 3 ? m + 12 : m;
}

/**
 * A bass line from a step pattern, a bar long and repeated: each character of `pat` is what the bass plays
 * on that step: `1` the chord's bass note, `5` its fifth, `8` the octave, `3` its third, `a` a step into
 * the next chord's bass from below, `.` nothing; a note lasts until the next one (or `-` cuts it).
 */
export function bassLine(prog: readonly Span[], g: Grid, key: Key, lo: number, pat: string, bars: number, vel = 0.85): Note[] {
  const out: Note[] = [];
  const bs = stepsPerBar(g);
  const p = pat.replace(/[\s|]/g, '');
  const total = bars * bs;
  for (let s = 0; s < total; s++) {
    const ch = p[s % p.length];
    if (ch === '.' || ch === '-') continue;
    let e = s + 1;
    while (e < total && p[e % p.length] === '.') e++;
    const c = chordAt(prog, s);
    const root = bassOf(c, key.pc, lo);
    const third = c.tones.find((t) => t === 3 || t === 4) ?? 7;
    let m = root;
    if (ch === '5') m = root + 7 > lo + 14 ? root - 5 : root + 7;
    else if (ch === '8') m = root + 12;
    else if (ch === '3') m = root + third;
    else if (ch === 'a') {
      const next = bassOf(chordAt(prog, Math.min(total - 1, e)), key.pc, lo);
      m = next === root ? root + 7 : next + (next > root ? -2 : 2);
    }
    const t = timeOf(g, s);
    out.push({ t, dur: Math.max(0.05, (timeOf(g, e) - t) * 0.92), m, v: vel * (s % bs === 0 ? 1 : 0.86) });
  }
  return out;
}

/**
 * An arpeggio: the chord's voicing (n notes from lo) played one note a `rate` steps in the order `order`
 * gives (indices into the voicing, wrapped), each note ringing `hold` steps.
 */
export function arp(prog: readonly Span[], g: Grid, key: Key, lo: number, n: number, rate: number, order: readonly number[], bars: number, vel = 0.7, hold = 2, accent = 4): Note[] {
  const out: Note[] = [];
  const total = bars * stepsPerBar(g);
  let prev: number[] | undefined;
  let last: Chord | null = null;
  let v: number[] = [];
  let k = 0;
  for (let s = 0; s < total; s += rate) {
    const c = chordAt(prog, s);
    if (c !== last) {
      v = voicing(c, key.pc, lo, n, prev);
      prev = v;
      last = c;
      k = 0;
    }
    const ix = order[k % order.length] % v.length;
    const t = timeOf(g, s);
    out.push({ t, dur: (timeOf(g, s + hold) - t) * 0.95, m: v[ix] + 12 * Math.floor(order[k % order.length] / v.length), v: vel * (k % accent === 0 ? 1 : 0.8) });
    k++;
  }
  return out;
}

/**
 * A guitar's strums from a step pattern, a bar long and repeated: `D` a full down stroke, `d` a soft one on
 * the low strings, `U` an up stroke on the top strings, `x` the hand on the strings (a muted chuck), `.`
 * nothing. Each stroke rolls across the strings a few ms apart and rings until the next. `take` seeds the
 * small differences between two takes of the same part (the double track left and right).
 */
export function strum(prog: readonly Span[], g: Grid, key: Key, pat: string, bars: number, vel = 0.75, lo = 40): { open: Note[]; muted: Note[] } {
  const open: Note[] = [];
  const muted: Note[] = [];
  const bs = stepsPerBar(g);
  const p = pat.replace(/[\s|]/g, '');
  const total = bars * bs;
  for (let s = 0; s < total; s++) {
    const ch = p[s % p.length];
    if (ch === '.') continue;
    let e = s + 1;
    while (e < total && p[e % p.length] === '.') e++;
    const c = chordAt(prog, s);
    const b = bassOf(c, key.pc, lo);
    const r = lo + ((pcOf(key.pc + c.root) - pcOf(lo) + 12) % 12);
    const third = c.tones.find((t) => t === 3 || t === 4 || t === 5 || t === 2) ?? 7;
    const top = c.tones.length > 3 ? c.tones[3] % 12 : 12;
    // Six strings: the bass, a fifth, the root, the third, the fifth again and the root or the chord's colour on top.
    const strings = [b, r + 7, r + 12, r + 12 + third, r + 19, r + 12 + (top === 12 ? 12 : top + 12)].sort((x, y) => x - y);
    const t = timeOf(g, s);
    const dur = timeOf(g, e) - t;
    const down = ch === 'D' || ch === 'd' || ch === 'x';
    const set = ch === 'd' ? strings.slice(0, 4) : ch === 'U' ? strings.slice(2) : strings;
    const seq = down ? set : [...set].reverse();
    seq.forEach((m, i) => {
      const n: Note = { t: t + i * (ch === 'x' ? 0.004 : 0.011), dur: ch === 'x' ? 0.05 : dur, m, v: vel * (ch === 'D' ? 1 : ch === 'U' ? 0.7 : ch === 'x' ? 0.75 : 0.78) * (1 - 0.04 * i) };
      (ch === 'x' ? muted : open).push(n);
    });
  }
  return { open, muted };
}

/** Chord stabs: the voicing struck on the steps of `pat` (`X` loud, `x` softer, `-` held from the stab before). */
export function stabs(prog: readonly Span[], g: Grid, key: Key, lo: number, n: number, pat: string, bars: number, vel = 0.8, len = 0): Note[] {
  const out: Note[] = [];
  const bs = stepsPerBar(g);
  const p = pat.replace(/[\s|]/g, '');
  const total = bars * bs;
  let prev: number[] | undefined;
  for (let s = 0; s < total; s++) {
    const ch = p[s % p.length];
    if (ch !== 'X' && ch !== 'x') continue;
    let e = s + 1;
    while (e < total && p[e % p.length] === '-') e++;
    const v = voicing(chordAt(prog, s), key.pc, lo, n, prev);
    prev = v;
    const t = timeOf(g, s);
    const dur = len > 0 ? len * stepDur(g) : (timeOf(g, e) - t) * 0.9;
    for (const m of v) out.push({ t, dur, m, v: vel * (ch === 'X' ? 1 : 0.72) });
  }
  return out;
}

const HIT_VEL: Record<string, number> = { X: 1, x: 0.75, o: 0.5, g: 0.28 };

/** Drum hits from a step string, repeated for `bars`: `X` an accent, `x` a stroke, `o` a light one, `g` a
 *  ghost, `.` nothing. `m` is the pitch a tuned drum plays; `dur` what an open hat or a roll is held for. */
export function hits(pat: string, g: Grid, bars: number, m = 60, vel = 1, dur = 0.1, fromBar = 0): Note[] {
  const out: Note[] = [];
  const bs = stepsPerBar(g);
  const p = pat.replace(/[\s|]/g, '');
  const total = bars * bs;
  for (let s = 0; s < total; s++) {
    const v = HIT_VEL[p[s % p.length]];
    if (v !== undefined) out.push({ t: timeOf(g, fromBar * bs + s), dur, m, v: v * vel });
  }
  return out;
}

/** A roll: strokes every `rate` steps from step `from` to `to`, swelling from `v0` to `v1`. */
export function roll(g: Grid, from: number, to: number, rate: number, v0: number, v1: number, m = 60): Note[] {
  const out: Note[] = [];
  for (let s = from; s < to - 1e-6; s += rate) out.push({ t: s * stepDur(g), dur: 0.1, m, v: v0 + ((v1 - v0) * (s - from)) / Math.max(1e-6, to - from) });
  return out;
}

/** Notes moved by whole bars (a phrase written once and placed where it is wanted). */
export const at = (notes: readonly Note[], g: Grid, bar: number): Note[] => notes.map((n) => ({ ...n, t: n.t + bar * barDur(g) }));
/** Notes moved by semitones. */
export const up = (notes: readonly Note[], semis: number): Note[] => notes.map((n) => ({ ...n, m: n.m + semis }));
/** Notes louder or softer. */
export const vel = (notes: readonly Note[], k: number): Note[] => notes.map((n) => ({ ...n, v: Math.min(1, n.v * k) }));

/** What the analysis reads of a melody: its range, its steps and leaps, where it peaks. */
export function contour(w: readonly Written[]): { low: number; high: number; range: number; steps: number; leaps: number; peakAt: number; notes: number; meanLen: number } {
  let low = Infinity;
  let high = -Infinity;
  let steps = 0;
  let leaps = 0;
  let peakAt = 0;
  let total = 0;
  w.forEach((n, i) => {
    if (n.p < low) low = n.p;
    if (n.p > high) {
      high = n.p;
      peakAt = n.s;
    }
    total += n.l;
    if (i > 0) {
      const d = Math.abs(n.p - w[i - 1].p);
      if (d > 0 && d <= 2) steps++;
      else if (d > 2) leaps++;
    }
  });
  const end = w.length ? w[w.length - 1].s + w[w.length - 1].l : 1;
  return { low, high, range: high - low, steps, leaps, peakAt: peakAt / end, notes: w.length, meanLen: w.length ? total / w.length : 0 };
}
