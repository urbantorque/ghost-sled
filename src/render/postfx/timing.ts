import type { WebGLRenderer } from 'three';

// GPU time by pass, for the dev overlay and the play-test probes (EXT_disjoint_timer_query_webgl2, where
// the browser has it). Off unless asked for (`?gpu`, or `world.post.pipe.timer.on = true`): a query a
// pass is not free, and the numbers are a lane's measurement, never the game's own business.
//
// A WebGL timer query cannot nest, so a frame is cut into consecutive spans: begin(name) ends the span
// before it. Results arrive a few frames late and are averaged per name.

const TIME_ELAPSED = 0x88bf;
const GPU_DISJOINT = 0x8fbb;

interface Pending {
  name: string;
  q: WebGLQuery;
}

export class GpuTimer {
  on = false;
  /** Mean milliseconds by span name, over the last frames. */
  readonly ms: Record<string, number> = {};
  private gl: WebGL2RenderingContext | null = null;
  private ext: unknown = null;
  private open: string | null = null;
  private pending: Pending[] = [];
  private free: WebGLQuery[] = [];
  private sums: Record<string, number> = {};
  private counts: Record<string, number> = {};
  private frames = 0;

  constructor(renderer: WebGLRenderer) {
    if (!renderer.capabilities.isWebGL2) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (this.ext) this.gl = gl;
  }

  get available(): boolean {
    return this.gl !== null;
  }

  /** Starts the span `name`, ending whichever was open. */
  begin(name: string): void {
    if (!this.on || !this.gl) return;
    this.end();
    const gl = this.gl;
    const q = this.free.pop() ?? gl.createQuery();
    if (!q) return;
    gl.beginQuery(TIME_ELAPSED, q);
    this.open = name;
    this.pending.push({ name, q });
  }

  end(): void {
    if (!this.gl || this.open === null) return;
    this.gl.endQuery(TIME_ELAPSED);
    this.open = null;
  }

  /** Once a frame, after the last span: collects the results that have come back. */
  collect(): void {
    if (!this.gl) return;
    this.end();
    if (!this.on && this.pending.length === 0) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(GPU_DISJOINT) as boolean;
    while (this.pending.length > 0) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) {
        const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number;
        this.sums[p.name] = (this.sums[p.name] ?? 0) + ns / 1e6;
        this.counts[p.name] = (this.counts[p.name] ?? 0) + 1;
      }
      this.free.push(p.q);
    }
    // A stall (a hidden tab) leaves queries queued: drop the backlog rather than grow it.
    while (this.pending.length > 240) this.free.push(this.pending.shift()!.q);
    if (++this.frames >= 30) {
      this.frames = 0;
      for (const k of Object.keys(this.sums)) {
        // A span is summed over a frame's worth of calls: divide by frames, not by calls.
        this.ms[k] = this.sums[k] / 30;
      }
      for (const k of Object.keys(this.ms)) if (!(k in this.sums)) delete this.ms[k];
      this.sums = {};
      this.counts = {};
    }
  }

  /** Forgets the averages (after a switch is flipped, so the next reading is the new state alone). */
  reset(): void {
    this.sums = {};
    this.counts = {};
    this.frames = 0;
    for (const k of Object.keys(this.ms)) delete this.ms[k];
  }
}
