import { Biquad, SR, type Stereo } from './dsp';

// Measuring what nobody here can hear (round 7): loudness to ITU-R BS.1770-4 / EBU R128 (integrated,
// short-term and momentary maxima, loudness range), true peak, the spectrum in octave bands, the stereo
// picture (correlation, what the mono fold-down and a phone speaker's band lose) and the pulse (tempo
// from the onsets). The same definitions as scripts/playtest/loudness.js, so a file and the live game
// measure alike.

function kWeight(x: Float32Array): Float32Array {
  const y = x.slice();
  const a = new Biquad();
  a.b0 = 1.53512485958697; a.b1 = -2.69169618940638; a.b2 = 1.19839281085285; a.a1 = -1.69065929318241; a.a2 = 0.73248077421585;
  const b = new Biquad();
  b.b0 = 1; b.b1 = -2; b.b2 = 1; b.a1 = -1.99004745483398; b.a2 = 0.99007225036621;
  a.run(y);
  b.run(y);
  return y;
}

const lu = (p: number): number => -0.691 + 10 * Math.log10(Math.max(1e-12, p));

/** Mean-square power per block of `win` seconds every `hop` seconds, both channels summed. */
function blocks(l: Float32Array, r: Float32Array, win: number, hop: number): number[] {
  const w = Math.round(win * SR);
  const h = Math.round(hop * SR);
  const out: number[] = [];
  for (let s = 0; s + w <= l.length; s += h) {
    let a = 0;
    let b = 0;
    for (let i = s; i < s + w; i++) {
      a += l[i] * l[i];
      b += r[i] * r[i];
    }
    out.push((a + b) / w);
  }
  return out;
}

export interface Loudness {
  /** Integrated, LUFS. */
  lufs: number;
  /** The loudest 3 s and the loudest 400 ms. */
  stMax: number;
  mMax: number;
  /** Loudness range, LU. */
  lra: number;
  /** True peak, dBTP, and the sample peak, dBFS. */
  tp: number;
  peak: number;
}

export function integrated(l: Float32Array, r: Float32Array): number {
  const p = blocks(l, r, 0.4, 0.1).filter((x) => lu(x) > -70);
  if (p.length === 0) return -Infinity;
  const mean = p.reduce((a, x) => a + x, 0) / p.length;
  const gate = lu(mean) - 10;
  const q = p.filter((x) => lu(x) > gate);
  return q.length ? lu(q.reduce((a, x) => a + x, 0) / q.length) : -Infinity;
}

export function loudness(b: Stereo): Loudness {
  const l = kWeight(b.l);
  const r = kWeight(b.r);
  const lufs = integrated(l, r);
  const m = blocks(l, r, 0.4, 0.1).map(lu);
  const st = blocks(l, r, 3, 1).map(lu);
  const mMax = m.length ? Math.max(...m) : -Infinity;
  const stMax = st.length ? Math.max(...st) : mMax;
  // Loudness range: short-term windows over -70 LUFS and within 20 LU of their own mean, 10th to 95th percentile.
  let lra = 0;
  const abs = blocks(l, r, 3, 1).filter((x) => lu(x) > -70);
  if (abs.length > 1) {
    const gate = lu(abs.reduce((a, x) => a + x, 0) / abs.length) - 20;
    const s = abs.map(lu).filter((x) => x > gate).sort((a, c) => a - c);
    if (s.length > 1) lra = s[Math.min(s.length - 1, Math.round(0.95 * (s.length - 1)))] - s[Math.round(0.1 * (s.length - 1))];
  }
  const tp = truePeak(b);
  let pk = 0;
  for (let i = 0; i < b.l.length; i++) pk = Math.max(pk, Math.abs(b.l[i]), Math.abs(b.r[i]));
  return { lufs, stMax, mMax, lra, tp, peak: 20 * Math.log10(Math.max(1e-9, pk)) };
}

const TP_TAPS = 12;
const TP_ROWS: Float32Array[] = [];
for (let p = 1; p < 4; p++) {
  const row = new Float32Array(TP_TAPS);
  const half = TP_TAPS / 2;
  for (let k = 0; k < TP_TAPS; k++) {
    const t = p / 4 - (k - half + 1);
    const s = Math.abs(t) < 1e-9 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const x = t / half;
    row[k] = s * (Math.abs(x) >= 1 ? 0 : 0.42 + 0.5 * Math.cos(Math.PI * x) + 0.08 * Math.cos(2 * Math.PI * x));
  }
  TP_ROWS.push(row);
}

/** True peak, dBTP: the samples and three points between each pair (a 12-tap windowed-sinc interpolator). */
export function truePeak(b: Stereo): number {
  let pk = 0;
  const half = TP_TAPS / 2;
  for (const ch of [b.l, b.r]) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > pk) pk = a;
      if (a < pk * 0.5 || i < half || i + half >= ch.length) continue;
      for (const row of TP_ROWS) {
        let s = 0;
        for (let k = 0; k < TP_TAPS; k++) s += ch[i + k - half + 1] * row[k];
        if (Math.abs(s) > pk) pk = Math.abs(s);
      }
    }
  }
  return 20 * Math.log10(Math.max(1e-9, pk));
}

/** An in-place radix-2 FFT. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const c = a + len / 2;
        const xr = re[c] * cr - im[c] * ci;
        const xi = re[c] * ci + im[c] * cr;
        re[c] = re[a] - xr; im[c] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** The octave bands the notes report, by centre frequency. */
export const BANDS: readonly number[] = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/** The average power spectrum of the mono sum (Hann, 8192 points, half overlapped). */
export function powerSpectrum(b: Stereo, size = 8192): Float64Array {
  const acc = new Float64Array(size / 2);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let frames = 0;
  for (let s = 0; s + size <= b.l.length; s += size / 2) {
    for (let i = 0; i < size; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
      re[i] = (b.l[s + i] + b.r[s + i]) * 0.5 * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < size / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  if (frames > 0) for (let k = 0; k < acc.length; k++) acc[k] /= frames;
  return acc;
}

/** Each octave band's share of the power, dB relative to the whole (so the ten add to 0 dB), and the
 *  spectral centroid in Hz. */
export function bands(b: Stereo): { db: number[]; centroid: number } {
  const size = 8192;
  const ps = powerSpectrum(b, size);
  const out = new Array<number>(BANDS.length).fill(0);
  let total = 0;
  let cen = 0;
  for (let k = 1; k < ps.length; k++) {
    const f = (k * SR) / size;
    if (f < 22) continue;
    let ix = Math.round(Math.log2(f / 31.5));
    ix = ix < 0 ? 0 : ix >= BANDS.length ? BANDS.length - 1 : ix;
    out[ix] += ps[k];
    total += ps[k];
    cen += ps[k] * f;
  }
  return { db: out.map((x) => Math.round(100 * 10 * Math.log10(Math.max(1e-15, x / Math.max(1e-15, total)))) / 100), centroid: total > 0 ? cen / total : 0 };
}

export interface StereoPicture {
  /** L/R correlation: 1 mono, 0 wide, negative cancels in mono. */
  corr: number;
  /** How much quieter the mono fold-down measures, LU. */
  monoLoss: number;
  /** How much quieter it measures through a phone speaker's band, LU. */
  phoneLoss: number;
}

export function picture(b: Stereo): StereoPicture {
  let sll = 0;
  let srr = 0;
  let slr = 0;
  for (let i = 0; i < b.l.length; i++) {
    sll += b.l[i] * b.l[i];
    srr += b.r[i] * b.r[i];
    slr += b.l[i] * b.r[i];
  }
  const corr = slr / Math.sqrt(Math.max(1e-20, sll * srr));
  const base = integrated(kWeight(b.l), kWeight(b.r));
  const mono = new Float32Array(b.l.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (b.l[i] + b.r[i]) * 0.5;
  const km = kWeight(mono);
  const monoLoss = base - integrated(km, km);
  // A phone speaker: nothing much under 250 Hz (a 4th-order high-pass) and a gentle roll-off from 9 kHz.
  const ph = (x: Float32Array): Float32Array => {
    const y = x.slice();
    Biquad.design('hp', 250, 0.54).run(y);
    Biquad.design('hp', 250, 1.31).run(y);
    Biquad.design('lp', 9000, 0.7).run(y);
    return kWeight(y);
  };
  const phoneLoss = base - integrated(ph(b.l), ph(b.r));
  return { corr, monoLoss, phoneLoss };
}

/**
 * The pulse, from the audio alone: an onset envelope (the rise in each band's energy every 10 ms), its
 * autocorrelation, and the strongest period between 50 and 200 beats a minute. Returns that tempo and how
 * strong the pulse is (0..1). A piece in a compound metre reads at its eighth or its dotted quarter.
 */
export function pulse(b: Stereo): { bpm: number; strength: number; onsetsPerS: number } {
  const hop = 480;
  const size = 1024;
  const frames = Math.floor((b.l.length - size) / hop);
  if (frames < 64) return { bpm: 0, strength: 0, onsetsPerS: 0 };
  const env = new Float64Array(frames);
  const prev = new Float64Array(size / 2);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < size; i++) {
      re[i] = (b.l[f * hop + i] + b.r[f * hop + i]) * 0.5 * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
      im[i] = 0;
    }
    fft(re, im);
    let flux = 0;
    for (let k = 1; k < size / 2; k++) {
      const m = Math.log1p(1000 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
      const d = m - prev[k];
      if (d > 0) flux += d;
      prev[k] = m;
    }
    env[f] = flux;
  }
  let mean = 0;
  for (let i = 0; i < frames; i++) mean += env[i];
  mean /= frames;
  let onsets = 0;
  for (let i = 1; i < frames - 1; i++) if (env[i] > mean * 1.6 && env[i] > env[i - 1] && env[i] >= env[i + 1]) onsets++;
  for (let i = 0; i < frames; i++) env[i] -= mean;
  const rate = SR / hop;
  let best = 0;
  let bestLag = 0;
  let zero = 0;
  for (let i = 0; i < frames; i++) zero += env[i] * env[i];
  for (let lag = Math.floor((rate * 60) / 200); lag <= Math.ceil((rate * 60) / 50); lag++) {
    let s = 0;
    for (let i = 0; i + lag < frames; i++) s += env[i] * env[i + lag];
    s /= Math.max(1e-12, zero);
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  return { bpm: bestLag > 0 ? (60 * rate) / bestLag : 0, strength: best, onsetsPerS: onsets / (frames / rate) };
}

/** Sounding pitch by autocorrelation (Hz), for the instrument tests: is a 440 Hz note 440 Hz? */
export function pitchOf(x: Float32Array, lo = 40, hi = 2400): number {
  const n = Math.min(x.length, 16384);
  const from = Math.max(0, Math.floor((x.length - n) / 4));
  let best = -1;
  let bestLag = 0;
  const minLag = Math.floor(SR / hi);
  const maxLag = Math.min(n >> 1, Math.ceil(SR / lo));
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    let e = 0;
    for (let i = 0; i + lag < n; i++) {
      s += x[from + i] * x[from + i + lag];
      e += x[from + i] * x[from + i] + x[from + i + lag] * x[from + i + lag];
    }
    ac[lag] = e > 0 ? (2 * s) / e : 0;
  }
  // The first strong peak, not the highest: a low multiple of the period scores as well as the period.
  let top = 0;
  for (let lag = minLag; lag <= maxLag; lag++) if (ac[lag] > top) top = ac[lag];
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (ac[lag] > 0.9 * top && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) {
      best = ac[lag];
      bestLag = lag;
      break;
    }
  }
  if (best < 0 || bestLag === 0) return 0;
  const a = ac[bestLag - 1];
  const c = ac[bestLag + 1];
  const d = a - 2 * best + c;
  const off = Math.abs(d) > 1e-12 ? (0.5 * (a - c)) / d : 0;
  return SR / (bestLag + off);
}
