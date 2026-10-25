import { Tier } from '../render/world';

// Automatic quality tiers chosen by measuring frame times. Starts from a device-based guess,
// steps down quickly when frames run long, and allows one cautious step back up per session.

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

export class TierController {
  tier: Tier;
  private samples: number[] = [];
  private warmup = 1.5;
  private cooldown = 0;
  private upgradesLeft = 1;
  private goodTime = 0;
  locked = false;
  onChange: ((t: Tier) => void) | null = null;

  constructor(initial: Tier) {
    this.tier = initial;
  }

  force(t: Tier | 'auto', guess: Tier): void {
    if (t === 'auto') {
      this.locked = false;
      this.set(guess);
    } else {
      this.locked = true;
      this.set(t);
    }
  }

  private set(t: Tier): void {
    if (t === this.tier) return;
    this.tier = t;
    this.samples = [];
    this.warmup = 1.2;
    this.cooldown = 3;
    this.onChange?.(t);
  }

  /** Feed one frame's duration in seconds. Hidden-tab or stalled frames are ignored. */
  frame(dt: number): void {
    if (this.locked || document.hidden || dt > 0.1 || dt <= 0) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    if (this.cooldown > 0) this.cooldown -= dt;
    this.samples.push(dt * 1000);
    if (this.samples.length > 240) this.samples.shift();
    if (this.samples.length < 90 || this.cooldown > 0) return;
    const recent = this.samples.slice(-90).sort((x, y) => x - y);
    const median = recent[45];
    const p90 = recent[81];
    const idx = ORDER.indexOf(this.tier);
    // Judder steps down too: a GPU just over budget alternates 16.7 and 33.3 ms frames, which keeps
    // the median at 16.7 while the run plays at ~50 fps. More than 15% missed frames over 4 s counts;
    // the long window keeps one-off hitches (chunk builds, shader warm-up) from tripping it.
    let long = 0;
    if (this.samples.length === 240) for (const ms of this.samples) if (ms > 21) long++;
    if ((median > 19.5 || long > 36) && idx > 0) {
      this.set(ORDER[idx - 1]);
      return;
    }
    if (p90 < 12.5 && idx < ORDER.length - 1 && this.upgradesLeft > 0) {
      this.goodTime += dt;
      if (this.goodTime > 6) {
        this.upgradesLeft--;
        this.goodTime = 0;
        this.set(ORDER[idx + 1]);
      }
    } else this.goodTime = 0;
  }
}
