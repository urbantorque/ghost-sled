// The master chain's two AudioWorklet processors (round 6), inlined as a module string and loaded from a
// blob URL (no fetch): both run on the audio thread, so neither costs the frame a thing.
//
//   gs-limiter  a true-peak limiter: the input's peaks are read 4x oversampled (a 12-tap windowed-sinc
//               polyphase interpolator, so the peaks between samples count), the gain each sample needs to
//               stay under the ceiling is held for the 64-sample lookahead (1.3 ms at 48 kHz) as a sliding
//               minimum, released exponentially, and smoothed by a 64-sample box so it is already down when
//               the peak arrives; the audio is delayed to meet it. Stereo-linked. Nothing over the ceiling,
//               nothing touched under it.
//   gs-duck     the sidechain: a power follower on the one-shot effects (the key) and a soft-knee gain
//               computer, its gain (0..1) out as a control signal that drives the music bus's side gains.
//               The music gives way to the effects by as much as they are loud, at most `range` dB.

const SOURCE = `
class GsLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'ceiling', defaultValue: 0.87, minValue: 0.05, maxValue: 1, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.12, minValue: 0.005, maxValue: 2, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.L = 64;
    this.T = 12;
    this.D = this.L - 1 + this.T / 2;
    this.N = 256;
    this.rl = new Float32Array(this.N);
    this.rr = new Float32Array(this.N);
    this.w = 0;
    this.req = new Float32Array(this.L).fill(1);
    this.ri = 0;
    this.m = 1;
    this.age = 0;
    this.rel = 1;
    this.box = new Float32Array(this.L).fill(1);
    this.bi = 0;
    this.sum = this.L;
    this.h = [];
    const half = this.T / 2;
    for (let p = 1; p < 4; p++) {
      const row = new Float32Array(this.T);
      for (let k = 0; k < this.T; k++) {
        const t = p / 4 - (k - half + 1);
        const s = Math.abs(t) < 1e-9 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
        const x = t / half;
        const win = Math.abs(x) >= 1 ? 0 : 0.42 + 0.5 * Math.cos(Math.PI * x) + 0.08 * Math.cos(2 * Math.PI * x);
        row[k] = s * win;
      }
      this.h.push(row);
    }
    this.minGain = 1;
    this.port.onmessage = () => {
      this.port.postMessage({ minGain: this.minGain });
      this.minGain = 1;
    };
  }
  process(inputs, outputs, params) {
    const out = outputs[0];
    const n = out[0].length;
    const inp = inputs[0] || [];
    const l = inp[0];
    const r = inp[1] || inp[0];
    const c = params.ceiling[0];
    const relC = Math.exp(-1 / (params.release[0] * sampleRate));
    const N = this.N, M = N - 1, T = this.T, L = this.L, D = this.D, half = T / 2;
    const rl = this.rl, rr = this.rr, h = this.h, req = this.req, box = this.box;
    const o0 = out[0];
    const o1 = out[1] || out[0];
    for (let i = 0; i < n; i++) {
      const w = this.w;
      rl[w] = l ? l[i] : 0;
      rr[w] = r ? r[i] : 0;
      const a = (w - half + N) & M;
      let pk = Math.max(Math.abs(rl[a]), Math.abs(rr[a]));
      if (pk > c * 0.5 || Math.abs(rl[(a + 1) & M]) > c * 0.5 || Math.abs(rr[(a + 1) & M]) > c * 0.5) {
        for (let p = 0; p < 3; p++) {
          const row = h[p];
          let sl = 0, sr = 0;
          for (let k = 0; k < T; k++) {
            const j = (w - T + 1 + k + N) & M;
            sl += row[k] * rl[j];
            sr += row[k] * rr[j];
          }
          const v = Math.max(Math.abs(sl), Math.abs(sr));
          if (v > pk) pk = v;
        }
      }
      const g = pk > c ? c / pk : 1;
      // The sliding minimum of the last L required gains (rescanned only when the minimum ages out).
      req[this.ri] = g;
      this.ri = (this.ri + 1) % L;
      if (g <= this.m) { this.m = g; this.age = 0; }
      else if (++this.age >= L) {
        let m = 1;
        for (let k = 0; k < L; k++) if (req[k] < m) m = req[k];
        this.m = m;
        this.age = 0;
        for (let k = 1; k <= L; k++) if (req[(this.ri - k + L) % L] === m) { this.age = k - 1; break; }
      }
      const m = this.m;
      this.rel = m < this.rel ? m : m - (m - this.rel) * relC;
      this.sum += this.rel - box[this.bi];
      box[this.bi] = this.rel;
      this.bi = (this.bi + 1) % L;
      const gs = Math.min(1, this.sum / L);
      if (gs < this.minGain) this.minGain = gs;
      const d = (w - D + N) & M;
      o0[i] = rl[d] * gs;
      if (o1 !== o0) o1[i] = rr[d] * gs;
      this.w = (w + 1) & M;
    }
    return true;
  }
}
registerProcessor('gs-limiter', GsLimiter);

class GsDuck extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -30, minValue: -80, maxValue: 0, automationRate: 'k-rate' },
      { name: 'ratio', defaultValue: 3, minValue: 1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'range', defaultValue: 6, minValue: 0, maxValue: 24, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.006, minValue: 0.0005, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.25, minValue: 0.01, maxValue: 3, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.env = 0;
    this.g = 1;
    this.minGain = 1;
    this.port.onmessage = () => {
      this.port.postMessage({ minGain: this.minGain });
      this.minGain = 1;
    };
  }
  process(inputs, outputs, params) {
    const out = outputs[0][0];
    const n = out.length;
    const inp = inputs[0] || [];
    const l = inp[0];
    const r = inp[1] || inp[0];
    const thr = params.threshold[0], ratio = params.ratio[0], range = params.range[0];
    const aC = Math.exp(-1 / (params.attack[0] * sampleRate));
    const rC = Math.exp(-1 / (params.release[0] * sampleRate));
    const knee = 6;
    const slope = 1 - 1 / ratio;
    let env = this.env, g = this.g;
    for (let i = 0; i < n; i++) {
      const a = l ? l[i] : 0;
      const b = r ? r[i] : 0;
      const x2 = 0.5 * (a * a + b * b);
      env = x2 + (env - x2) * (x2 > env ? aC : rC);
      if ((i & 15) === 0) {
        const over = 10 * Math.log10(env + 1e-12) - thr;
        let gr = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * slope : (slope * (over + knee / 2) * (over + knee / 2)) / (2 * knee);
        if (gr > range) gr = range;
        this.target = Math.pow(10, -gr / 20);
      }
      const t = this.target === undefined ? 1 : this.target;
      g = t + (g - t) * (t < g ? aC : rC);
      out[i] = g;
    }
    this.env = env;
    this.g = g;
    if (g < this.minGain) this.minGain = g;
    return true;
  }
}
registerProcessor('gs-duck', GsDuck);
`;

let url: string | null = null;

function moduleUrl(): string | null {
  if (url) return url;
  try {
    url = URL.createObjectURL(new Blob([SOURCE], { type: 'application/javascript' }));
  } catch {
    url = null;
  }
  return url;
}

/** Loads both processors into a context. False where AudioWorklet is missing or refused (old Safari, a
 *  locked-down iframe): the chain then keeps its DynamicsCompressor and no sidechain. */
export async function loadMaster(ctx: BaseAudioContext): Promise<boolean> {
  const w = (ctx as BaseAudioContext & { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!w || typeof AudioWorkletNode === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const u = moduleUrl();
  if (!u) return false;
  try {
    await w.addModule(u);
    return true;
  } catch {
    return false;
  }
}
