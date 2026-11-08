import { Tier } from '../render/world';

// Automatic quality tiers chosen by measuring frame times. Starts from a device-based guess, steps
// down quickly when frames run long, and steps up (at most twice a session, and never back to a tier
// it has already left for running long) when the frame's own work leaves plenty of room.

const ORDER: Tier[] = ['low', 'medium', 'high'];

export function guessTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const touch = matchMedia('(pointer: coarse)').matches;
  const gpu = gpuName();
  if (mem <= 2 || cores <= 2 || /swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'low';
  // Integrated laptop GPUs share memory bandwidth with the CPU: High's MSAA and 2048 shadows sit
  // right at the 60 Hz budget there, so start on Medium instead of stepping down mid-run.
  if (touch || mem <= 4 || cores <= 4 || /intel|mali|adreno|powervr/.test(gpu)) return 'medium';
  return 'high';
}

/** The GPU's name, lower-cased, where the browser reports it (empty otherwise). */
function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return name.toLowerCase();
  } catch {
    return '';
  }
}

/** Seconds of frames the controller keeps (the judder window), and how many it needs before the
 *  median rule may step down (time, not a frame count: at 30 fps 90 frames took 3 s). */
const WINDOW = 4;
const MEDIAN_AFTER = 1.5;
/** A frame over this many ms missed a 60 Hz vsync. */
const LONG_MS = 21;
const ascending = (x: number, y: number) => x - y;
/** Headroom to step up: the frame's own main-thread work (scripts, the render's command encoding)
 *  under this at the 90th percentile, frames on vsync, held for HEADROOM_S seconds. Stepping up
 *  costs more of both CPU and GPU, so the bar sits at well under half the 60 Hz budget. */
const HEADROOM_MS = 6.5;
const HEADROOM_S = 6;

export class TierController {
  tier: Tier;
  /** Frame times (ms) over the last WINDOW seconds, oldest first, and the main-thread work (ms) of
   *  each (NaN where unmeasured); `span` is their total in seconds. */
  private samples: number[] = [];
  private works: number[] = [];
  private span = 0;
  private warmup = 1.5;
  private upgradesLeft = 2;
  private goodTime = 0;
  /** Tiers this session stepped down from: never stepped back up to (no see-sawing). */
  private failed = new Set<Tier>();
  /** The work of the frame in flight (frame() to the microtask checkpoint after its callback). */
  private t0 = 0;
  private work = Number.NaN;
  private endWork = () => {
    this.work = performance.now() - this.t0;
  };
  private sorted: number[] = [];
  locked = false;
  onChange: ((t: Tier) => void) | null = null;

  constructor(initial: Tier) {
    this.tier = initial;
  }

  force(t: Tier | 'auto', guess: Tier): void {
    if (t === 'auto') {
      this.locked = false;
      this.failed.clear();
      this.set(guess);
    } else {
      this.locked = true;
      this.set(t);
    }
  }

  private set(t: Tier): void {
    if (t === this.tier) return;
    this.tier = t;
    this.samples.length = 0;
    this.works.length = 0;
    this.span = 0;
    this.goodTime = 0;
    // The rebuild and the new tier's shaders hitch the next frames.
    this.warmup = 1.2;
    this.onChange?.(t);
  }

  /** Feed one frame's duration in seconds, at the start of the frame. The frame's own work is timed
   *  to the end of its callback (a microtask), or given as `workMs` (tests). Hidden-tab or stalled
   *  frames are ignored. */
  frame(dt: number, workMs?: number): void {
    const measured = this.work;
    this.work = Number.NaN;
    if (workMs === undefined && typeof performance !== 'undefined' && typeof queueMicrotask === 'function') {
      this.t0 = performance.now();
      queueMicrotask(this.endWork);
    }
    if (this.locked || document.hidden || dt > 0.1 || dt <= 0) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    const ms = dt * 1000;
    this.samples.push(ms);
    // (The work measured is the previous frame's.)
    this.works.push(workMs ?? measured);
    this.span += dt;
    while (this.span - this.samples[0] / 1000 >= WINDOW) {
      this.span -= this.samples.shift()! / 1000;
      this.works.shift();
    }
    const idx = ORDER.indexOf(this.tier);
    const n = this.samples.length;
    if (this.span < MEDIAN_AFTER) return;
    // Frames running long on average over the last MEDIAN_AFTER seconds (a burst of hitches under a
    // second long leaves the median on time).
    let t = 0;
    let k = n;
    while (k > 0 && t < MEDIAN_AFTER) t += this.samples[--k] / 1000;
    if (idx > 0 && this.quantile(this.samples, k, n, 0.5) > 19.5) return this.down(idx);
    // Judder steps down too: a GPU just over budget alternates 16.7 and 33.3 ms frames, which keeps
    // the median at 16.7 while the run plays at ~50 fps. More than 15% missed frames over the whole
    // window counts; the long window keeps one-off hitches (chunk builds, shader warm-up) from
    // tripping it.
    let long = 0;
    for (const s of this.samples) if (s > LONG_MS) long++;
    const full = this.span >= WINDOW - 0.25;
    if (idx > 0 && full && long > n * 0.15) return this.down(idx);
    // Headroom: the work is light and the frames are on time (as good as no long frames).
    const up = ORDER[idx + 1];
    if (up && this.upgradesLeft > 0 && !this.failed.has(up) && full && long <= n * 0.02) {
      const w = this.quantile(this.works, 0, n, 0.9);
      if (w < HEADROOM_MS) {
        this.goodTime += dt;
        if (this.goodTime > HEADROOM_S) {
          this.upgradesLeft--;
          this.set(up);
        }
        return;
      }
    }
    this.goodTime = 0;
  }

  private down(idx: number): void {
    this.failed.add(this.tier);
    this.set(ORDER[idx - 1]);
  }

  /** The q quantile of a[from..to) (NaN entries sort last, so unmeasured work never counts as room). */
  private quantile(a: number[], from: number, to: number, q: number): number {
    const s = this.sorted;
    s.length = 0;
    for (let i = from; i < to; i++) s.push(Number.isNaN(a[i]) ? Infinity : a[i]);
    s.sort(ascending);
    return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0;
  }
}
