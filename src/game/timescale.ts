// One time scale for the whole presentation. Hit-stops and slow motion are pulses on two channels:
// 'feed' scales the real time fed into the fixed sim loop (the sim itself stays tick-exact, so
// replays and ghosts are unaffected), and 'render' scales the render dt the world animates with.
// 'both' pulses both. Per channel the strongest (lowest) live scale wins. shake = min(feed, render).
//
// The director owns the instance (director.time); the app calls step(dt) once per frame before it
// reads feed, render or shake, then advances the loop by dt * feed.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: pulses and step reproduce the perfect-landing hit-stop exactly as it was (0.35 for
// 0.13 s on 'feed'): step(dt) latches this frame's outputs from the pulses alive at the start of the
// frame, then spends dt from them, so every frame that starts while a pulse is alive is scaled.
// curve() keeps the strongest key-framed scale but is not used yet. The injected reduced() is stored
// and NOT applied yet: the hit-stop played under reduced motion before, and still does.

export type TimeChannel = 'feed' | 'render' | 'both';
/** Seconds from the curve's start, and the scale there; linear between keys. */
export interface TimeKey {
  at: number;
  scale: number;
}

/** The crash beat's render curve: held, then slow motion, then back to full speed. */
export const CRASH_CURVE: readonly TimeKey[] = [
  { at: 0, scale: 0 },
  { at: 0.07, scale: 0 },
  { at: 0.07, scale: 0.3 },
  { at: 0.38, scale: 0.3 },
  { at: 0.6, scale: 1 },
];

interface Pulse {
  scale: number;
  left: number;
}

interface Curve {
  keys: readonly TimeKey[];
  t: number;
}

function sample(keys: readonly TimeKey[], t: number): number {
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

export class TimeScale {
  private readonly pulses: Record<'feed' | 'render', Pulse | null> = { feed: null, render: null };
  private readonly curves: Record<'feed' | 'render', Curve | null> = { feed: null, render: null };
  private feedNow = 1;
  private renderNow = 1;

  constructor(readonly reduced: () => boolean) {}

  /** A hit-stop: `scale` for `secs` seconds of real time on a channel. The strongest live scale wins. */
  pulse(scale: number, secs: number, channel: TimeChannel): void {
    if (!(secs > 0)) return;
    const s = Math.max(0, Math.min(1, scale));
    for (const ch of channel === 'both' ? (['feed', 'render'] as const) : [channel]) {
      const p = this.pulses[ch];
      if (!p || p.left <= 0 || s < p.scale) this.pulses[ch] = { scale: s, left: secs };
      else if (s === p.scale) p.left = Math.max(p.left, secs);
    }
  }

  /** A key-framed scale from now on a channel (replaces that channel's curve). */
  curve(keys: readonly TimeKey[], channel: TimeChannel): void {
    for (const ch of channel === 'both' ? (['feed', 'render'] as const) : [channel]) this.curves[ch] = { keys, t: 0 };
  }

  /** Call once per frame with the real dt, before reading feed, render or shake. */
  step(dt: number): void {
    const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.feedNow = this.latch('feed', d);
    this.renderNow = this.latch('render', d);
  }

  reset(): void {
    this.pulses.feed = this.pulses.render = null;
    this.curves.feed = this.curves.render = null;
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

  /** Scale for camera shake this frame. */
  get shake(): number {
    return Math.min(this.feedNow, this.renderNow);
  }

  /** This frame's scale on one channel from what is alive now, then dt is spent from it. */
  private latch(ch: 'feed' | 'render', dt: number): number {
    let s = 1;
    const p = this.pulses[ch];
    if (p) {
      if (p.left > 0) s = Math.min(s, p.scale);
      p.left -= dt;
      if (p.left <= 0) this.pulses[ch] = null;
    }
    const c = this.curves[ch];
    if (c) {
      s = Math.min(s, sample(c.keys, c.t));
      c.t += dt;
      const end = c.keys.length ? c.keys[c.keys.length - 1].at : 0;
      if (c.t > end) this.curves[ch] = null;
    }
    return s;
  }
}
