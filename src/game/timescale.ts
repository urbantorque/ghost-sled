// One time scale for the whole presentation. Hit-stops and slow motion are pulses on two channels:
// 'feed' scales the real time fed into the fixed sim loop (the sim itself stays tick-exact, so
// replays and ghosts are unaffected), and 'render' scales the render dt the world animates with.
// 'both' pulses both. Per channel the strongest (lowest) live scale wins, so overlapping beats never
// overwrite each other: a 0.35 hit-stop that a 0.6 one lands on keeps 0.35, and a longer weak pulse
// carries on at its own scale once the strong one has spent. shake = min(feed, render).
//
// The director owns the instance (director.time); the app calls step(dt) once per frame before it
// reads feed, render or shake, then advances the loop by dt * feed and the render clock by
// dt * render. step(dt) latches this frame's outputs from what is alive at the start of the frame,
// then spends dt from it, so every frame that starts while a pulse is alive is scaled (the perfect
// landing's 0.35 for 0.13 s still scales 8 frames at 60 Hz, as the old hit-stop did).
//
// Reduced motion: while the injected reduced() is true, pulse() and curve() are no-ops and step()
// drops anything still alive, so feed, render and shake read 1.
//
// Pure: no DOM, render or audio imports.

export type TimeChannel = 'feed' | 'render' | 'both';
/** Seconds from the curve's start, and the scale there; linear between keys. */
export interface TimeKey {
  at: number;
  scale: number;
}

/** The crash beat's render curve: a held frame on the impact (0 until 70 ms), slow motion (0.3
 *  until 380 ms), then an eased return to full speed by 600 ms (smoothstep, sampled into keys). */
export const CRASH_CURVE: readonly TimeKey[] = [
  { at: 0, scale: 0 },
  { at: 0.07, scale: 0 },
  { at: 0.07, scale: 0.3 },
  { at: 0.38, scale: 0.3 },
  { at: 0.435, scale: 0.409 },
  { at: 0.49, scale: 0.65 },
  { at: 0.545, scale: 0.891 },
  { at: 0.6, scale: 1 },
];

/** Live pulses kept per channel (a beat never needs more: the weakest is dropped when full). */
const SLOTS = 4;

interface Pulse {
  scale: number;
  /** Real seconds left; 0 or less is a free slot. */
  left: number;
}

interface Curve {
  keys: readonly TimeKey[];
  t: number;
  end: number;
}

/** A key-framed scale at `t` seconds: the first key before the curve, the last after it. */
export function sampleCurve(keys: readonly TimeKey[], t: number): number {
  if (keys.length === 0) return 1;
  if (t <= keys[0].at) return keys[0].scale;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b.at) {
      const a = keys[i - 1];
      const span = b.at - a.at;
      return span > 0 ? a.scale + ((b.scale - a.scale) * (t - a.at)) / span : b.scale;
    }
  }
  return keys[keys.length - 1].scale;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function slots(): Pulse[] {
  const out: Pulse[] = [];
  for (let i = 0; i < SLOTS; i++) out.push({ scale: 1, left: 0 });
  return out;
}

export class TimeScale {
  private readonly pulses: Record<'feed' | 'render', Pulse[]> = { feed: slots(), render: slots() };
  private readonly curves: Record<'feed' | 'render', Curve | null> = { feed: null, render: null };
  private feedNow = 1;
  private renderNow = 1;

  constructor(readonly reduced: () => boolean) {}

  /** A hit-stop: `scale` for `secs` seconds of real time on a channel. The strongest live scale wins;
   *  a weaker pulse still runs out its own time. A no-op under reduced motion. */
  pulse(scale: number, secs: number, channel: TimeChannel): void {
    if (!(secs > 0) || this.reduced()) return;
    const s = clamp01(scale);
    if (s >= 1) return;
    if (channel !== 'render') this.add(this.pulses.feed, s, secs);
    if (channel !== 'feed') this.add(this.pulses.render, s, secs);
  }

  /** A key-framed scale from now on a channel (replaces that channel's curve). An empty key list
   *  cancels it. A no-op under reduced motion. */
  curve(keys: readonly TimeKey[], channel: TimeChannel): void {
    if (this.reduced()) return;
    const c: Curve | null = keys.length ? { keys, t: 0, end: keys[keys.length - 1].at } : null;
    if (channel !== 'render') this.curves.feed = c ? { ...c } : null;
    if (channel !== 'feed') this.curves.render = c;
  }

  /** Stops a channel's curve at once (the results take over mid-crash-beat). */
  cancelCurve(channel: TimeChannel = 'both'): void {
    if (channel !== 'render') this.curves.feed = null;
    if (channel !== 'feed') this.curves.render = null;
  }

  /** Call once per frame with the real dt, before reading feed, render or shake. */
  step(dt: number): void {
    if (this.reduced()) {
      this.reset();
      return;
    }
    const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.feedNow = this.latch('feed', d);
    this.renderNow = this.latch('render', d);
  }

  reset(): void {
    for (const ch of ['feed', 'render'] as const) {
      for (const p of this.pulses[ch]) p.left = 0;
      this.curves[ch] = null;
    }
    this.feedNow = 1;
    this.renderNow = 1;
  }

  /** Scale for the real time fed into the sim loop this frame. */
  get feed(): number {
    return this.feedNow;
  }

  /** Scale for the render dt this frame. */
  get render(): number {
    return this.renderNow;
  }

  /** Scale for the camera's shake clock this frame. */
  get shake(): number {
    return Math.min(this.feedNow, this.renderNow);
  }

  /** Whether anything is scaling time (for probes). */
  get active(): boolean {
    return this.feedNow < 1 || this.renderNow < 1 || this.curves.feed !== null || this.curves.render !== null || this.pulses.feed.some((p) => p.left > 0) || this.pulses.render.some((p) => p.left > 0);
  }

  private add(list: Pulse[], scale: number, secs: number): void {
    // The same scale again: one pulse, the longer time.
    for (const p of list) {
      if (p.left > 0 && p.scale === scale) {
        p.left = Math.max(p.left, secs);
        return;
      }
    }
    let free: Pulse | null = null;
    for (const p of list) if (p.left <= 0) free = free ?? p;
    if (!free) {
      // Full: the weakest live pulse gives way, if this one is stronger.
      let weak = list[0];
      for (const p of list) if (p.scale > weak.scale) weak = p;
      if (scale >= weak.scale) return;
      free = weak;
    }
    free.scale = scale;
    free.left = secs;
  }

  /** This frame's scale on one channel from what is alive now, then dt is spent from it. */
  private latch(ch: 'feed' | 'render', dt: number): number {
    let s = 1;
    for (const p of this.pulses[ch]) {
      if (p.left <= 0) continue;
      if (p.scale < s) s = p.scale;
      p.left -= dt;
    }
    const c = this.curves[ch];
    if (c) {
      s = Math.min(s, sampleCurve(c.keys, c.t));
      c.t += dt;
      if (c.t > c.end) this.curves[ch] = null;
    }
    return s;
  }
}
