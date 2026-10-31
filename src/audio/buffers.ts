// Generated audio material. Everything here is synthesized once per AudioContext and shared by
// every voice, so no event ever allocates a large buffer.

export interface Bank {
  /** Stereo noise beds with decorrelated channels, all normalised to the same RMS so filtered
   *  layers mix predictably whichever colour they start from. */
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  /** The white bed high-passed once, for the noise parts that always sit behind the same fixed
   *  highpass (Q 0.7): hats at 7.2 kHz, a kick's click at 2 kHz, the effects' click at 4 kHz. A
   *  BiquadFilterNode per hit cost the main thread a node (the dearest kind to make) four times a
   *  second at a cruise; the filter is the same one, run here instead. */
  hatNoise: AudioBuffer;
  kickNoise: AudioBuffer;
  clickNoise: AudioBuffer;
  /** Unipolar train of short decaying grains (about 22 per second at rate 1). Used as an
   *  amplitude modulator, it turns steady noise into granular snow crunch. */
  grains: AudioBuffer;
  /** One sleigh bell shake. */
  jingle: AudioBuffer;
  /** Reverb impulse: decorrelated noise with an exponential decay that darkens as it fades. */
  impulse: AudioBuffer;
  /** Band-limited saw with a soft roll-off: warmer and less buzzy than the built-in sawtooth. */
  warmSaw: PeriodicWave;
  /** Odd-harmonic soft square for the lead voice. */
  hollow: PeriodicWave;
}

export const NOISE_RMS = 0.25;
const NOISE_SECONDS = 2;

/** `raw` holds len + fade samples; the tail is crossfaded into the head so the loop has no seam. */
function seamless(raw: Float32Array, len: number): Float32Array {
  const fade = raw.length - len;
  const out = raw.slice(0, len);
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    out[i] = raw[i] * Math.sqrt(w) + raw[len + i] * Math.sqrt(1 - w);
  }
  return out;
}

function normalise(d: Float32Array, rms: number): void {
  let mean = 0;
  for (let i = 0; i < d.length; i++) mean += d[i];
  mean /= d.length;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    d[i] -= mean;
    sum += d[i] * d[i];
  }
  const k = rms / Math.sqrt(sum / d.length || 1);
  for (let i = 0; i < d.length; i++) {
    const v = d[i] * k;
    d[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
}

type NoiseColour = 'white' | 'pink' | 'brown';

function noiseChannel(colour: NoiseColour, len: number): Float32Array {
  const raw = new Float32Array(len + Math.floor(len * 0.05));
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let br = 0;
  // Run the filters for a moment first so the loop does not start from a cold state.
  for (let i = -2048; i < raw.length; i++) {
    const w = Math.random() * 2 - 1;
    let v: number;
    if (colour === 'white') v = w;
    else if (colour === 'pink') {
      // Paul Kellet's economy pink filter.
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      v = b0 + b1 + b2 + w * 0.1848;
    } else {
      br = (br + 0.02 * w) / 1.02;
      v = br;
    }
    if (i >= 0) raw[i] = v;
  }
  const out = seamless(raw, len);
  normalise(out, NOISE_RMS);
  return out;
}

function noise(ctx: BaseAudioContext, colour: NoiseColour): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) buf.getChannelData(ch).set(noiseChannel(colour, len));
  return buf;
}

/**
 * `src` through the highpass a BiquadFilterNode makes of (`f` Hz, Q `q`, read in dB for a highpass),
 * with the same coefficients and the same direct form, into a buffer of the same shape. The filter
 * first runs over the source's last samples, so the result loops as seamlessly as the source does
 * (its start continues its end, as a live filter running across the loop would).
 */
export function highpassed(ctx: BaseAudioContext, src: AudioBuffer, f: number, q: number): AudioBuffer {
  const sr = src.sampleRate;
  const w0 = (2 * Math.PI * Math.min(f, sr / 2)) / sr;
  const cw = Math.cos(w0);
  const alpha = 0.5 * Math.sin(w0) * Math.pow(10, -0.05 * q);
  const a0 = 1 + alpha;
  const b0 = (0.5 * (1 + cw)) / a0;
  const b1 = (-1 - cw) / a0;
  const a1 = (-2 * cw) / a0;
  const a2 = (1 - alpha) / a0;
  const out = ctx.createBuffer(src.numberOfChannels, src.length, sr);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const x = src.getChannelData(ch);
    const y = out.getChannelData(ch);
    const n = x.length;
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    // The state settles within a few dozen samples at these corners; 2048 is far past it.
    for (let i = Math.max(0, n - 2048); i < n; i++) {
      const xi = x[i];
      const yi = b0 * xi + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = xi;
      y2 = y1;
      y1 = yi;
    }
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = b0 * xi + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = xi;
      y2 = y1;
      y1 = yi;
      y[i] = yi;
    }
  }
  return out;
}

function grains(ctx: BaseAudioContext): AudioBuffer {
  // A low rate is plenty for an envelope and keeps the buffer tiny.
  const sr = 22050;
  const len = sr * 2;
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const att = Math.floor(0.0015 * sr);
  let t = 0;
  while (t < len) {
    const amp = 0.35 + 0.65 * Math.random();
    const tau = (0.004 + Math.random() * 0.014) * sr;
    const n = Math.floor(att + tau * 5);
    for (let k = 0; k < n; k++) {
      const env = k < att ? k / att : Math.exp(-(k - att) / tau);
      // Wrap so grains crossing the end land at the start: the loop stays seamless.
      d[(t + k) % len] += amp * env;
    }
    t += Math.max(1, Math.floor((sr / 22) * (0.3 + Math.random() * 1.4)));
  }
  for (let i = 0; i < len; i++) if (d[i] > 1) d[i] = 1;
  return buf;
}

function jingle(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.42);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let b = 0; b < 4; b++) {
    const base = 2600 + Math.random() * 1800;
    const ratios = [1, 1.47 + Math.random() * 0.1, 2.09 + Math.random() * 0.15, 2.76 + Math.random() * 0.2, 3.9 + Math.random() * 0.3];
    let strike = Math.random() * 0.012;
    let amp = 0.7 + Math.random() * 0.3;
    // Each little bell rattles: a few quick restrikes with falling force.
    for (let s = 0; s < 3; s++) {
      const i0 = Math.floor(strike * sr);
      for (let p = 0; p < ratios.length; p++) {
        const f = base * ratios[p];
        if (f > sr * 0.45 || i0 >= len) continue;
        const tau = ((0.07 + Math.random() * 0.06) / Math.sqrt(p + 1)) * sr;
        const a = amp / Math.pow(p + 1, 0.7);
        const w = (2 * Math.PI * f) / sr;
        const ph = Math.random() * 2 * Math.PI;
        const n = Math.min(len - i0, Math.floor(tau * 6));
        const fall = Math.exp(-1 / tau);
        // A decaying phasor (x + iy) times fall * e^(iw) per sample: y is a * fall^k * sin(wk + ph)
        // exactly, without a Math.sin per sample. This loop runs ~1M times inside unlock(), the
        // first tap, so it matters on phones.
        const c = Math.cos(w) * fall;
        const s = Math.sin(w) * fall;
        let x = a * Math.cos(ph);
        let y = a * Math.sin(ph);
        for (let k = 0; k < n; k++) {
          d[i0 + k] += y;
          const nx = x * c - y * s;
          y = x * s + y * c;
          x = nx;
        }
      }
      // A sliver of noise gives each strike its metallic tick.
      for (let k = 0; k < 40 && i0 + k < len; k++) d[i0 + k] += (Math.random() * 2 - 1) * amp * 0.3 * (1 - k / 40);
      strike += 0.018 + Math.random() * 0.03;
      amp *= 0.55;
    }
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const k = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < len; i++) d[i] *= k;
  return buf;
}

function impulse(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const rt = 1.9;
  const len = Math.floor(sr * 2.05);
  const pre = Math.floor(sr * 0.012);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    // -60 dB at rt; the one-pole coefficient falls over time so the tail gets darker, like air.
    // Both exponentials advance by a constant factor per sample instead of a Math.exp each.
    const envStep = Math.exp(-6.9 / rt / sr);
    const darkStep = Math.exp(-1.7 / sr);
    let env = 1;
    let dark = 1;
    for (let i = pre; i < len; i++) {
      const a = 0.82 * dark + 0.06;
      lp += a * (Math.random() * 2 - 1 - lp);
      const fadeIn = i - pre < 256 ? (i - pre) / 256 : 1;
      d[i] = lp * env * fadeIn;
      env *= envStep;
      dark *= darkStep;
    }
    // A few sparse early reflections, different per side, give the room a shape.
    const taps = [0.017, 0.023, 0.031, 0.041, 0.053, 0.067];
    for (let k = 0; k < taps.length; k++) {
      const i = pre + Math.floor((taps[k] + Math.random() * 0.004) * sr);
      if (i < len) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.55 - k * 0.06);
    }
  }
  return buf;
}

function wave(ctx: BaseAudioContext, harmonics: number, amp: (n: number) => number): PeriodicWave {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) imag[n] = amp(n);
  return ctx.createPeriodicWave(real, imag);
}

export function createBank(ctx: BaseAudioContext): Bank {
  const white = noise(ctx, 'white');
  return {
    white,
    pink: noise(ctx, 'pink'),
    brown: noise(ctx, 'brown'),
    hatNoise: highpassed(ctx, white, 7200, 0.7),
    kickNoise: highpassed(ctx, white, 2000, 0.7),
    clickNoise: highpassed(ctx, white, 4000, 0.7),
    grains: grains(ctx),
    jingle: jingle(ctx),
    impulse: impulse(ctx),
    warmSaw: wave(ctx, 40, (n) => Math.exp(-(n - 1) / 11) / n),
    hollow: wave(ctx, 25, (n) => (n % 2 === 1 ? Math.exp(-(n - 1) / 9) / n : 0)),
  };
}
