import type { ReelShot, ShotKind } from './reel';
import { photoName } from '../ui/photo';

// Round 8, G11 (the share lane): the highlight reel saved as a short clip. The reel plays again, cut short to its best
// shots, and the canvas it draws is recorded as it plays (cliptake.ts); nothing records, encodes or holds a stream
// until a player asks. This file is the pure part, with no DOM: which format the browser can write, the clip's size,
// bitrate and file name, which of the reel's shots the clip keeps, and the recorder's states round a MediaRecorder
// (faked in the tests). Loaded with the clip's chunk, never with the first frame.

/** A format the clip can be written in: the MIME type asked of MediaRecorder, and the file's extension. */
export interface ClipFormat {
  mime: string;
  ext: 'mp4' | 'webm';
}

/** In order of preference. MP4 (H.264 and AAC) first: it is what a phone's gallery and the social apps take (iOS's
 *  Photos, X and Instagram refuse WebM), and Safari writes nothing else. Then WebM, VP9 before VP8 (Chrome before it
 *  wrote MP4, and Firefox). The codec string is H.264's Constrained Baseline at level 3.1, which holds 1280 x 720 at
 *  30 frames in either orientation. A clip with no sound asks for the video codec alone. */
const FORMATS: ReadonlyArray<{ video: string; audio: string; ext: 'mp4' | 'webm' }> = [
  { video: 'video/mp4;codecs=avc1.42E01F', audio: 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', ext: 'mp4' },
  { video: 'video/mp4;codecs=avc1', audio: 'video/mp4;codecs=avc1,mp4a', ext: 'mp4' },
  { video: 'video/webm;codecs=vp9', audio: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { video: 'video/webm;codecs=vp8', audio: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { video: 'video/webm', audio: 'video/webm', ext: 'webm' },
  { video: 'video/mp4', audio: 'video/mp4', ext: 'mp4' },
];

/** The first format the browser says it can record (`supported` is MediaRecorder.isTypeSupported), or null. */
export function pickClipFormat(supported: (mime: string) => boolean, audio: boolean): ClipFormat | null {
  for (const f of FORMATS) {
    const mime = audio ? f.audio : f.video;
    let ok = false;
    try {
      ok = supported(mime);
    } catch {
      ok = false;
    }
    if (ok) return { mime, ext: f.ext };
  }
  return null;
}

/** The clip's file: named like a photo (`ghost-sled-<mountain>-<yyyymmdd-hhmmss>`), with the format's extension. */
export function clipName(mountain: string, at: Date, ext: ClipFormat['ext']): string {
  return photoName(mountain, at).replace(/\.png$/, `.${ext}`);
}

/** The clip's frame (px): the picture's shape, at most 1280 x 720 held wide or 720 x 1280 held upright, never larger
 *  than the canvas it is taken from, and even on both sides (H.264 asks it). */
export const CLIP_LONG = 1280;
export const CLIP_SHORT = 720;
export function clipSize(w: number, h: number): { w: number; h: number } {
  const W = Math.max(2, w);
  const H = Math.max(2, h);
  const k = Math.min(1, (W >= H ? CLIP_LONG : CLIP_SHORT) / W, (W >= H ? CLIP_SHORT : CLIP_LONG) / H);
  const even = (n: number) => Math.max(2, Math.floor((n * k) / 2) * 2);
  return { w: even(W), h: even(H) };
}

/** Frames a second the clip is recorded at: a share plays at 30, and it halves the encoder's work on a phone. */
export const CLIP_FPS = 30;
/** Bits a second for the picture: about 0.09 a pixel a frame (2.5 Mb/s at 720p, so a clip of fifteen to seventeen
 *  seconds is about 5 MB), kept between 1 and 2.8 Mb/s. A clip held upright asks 2.4 times that, up to 4.5 Mb/s: Chrome's
 *  encoder spent under half of what it was asked on the phone's 584 x 1266 (2.1 MB for 16.6 s asked 2 Mb/s, 2.5 MB asked
 *  2.8) and two critics saw its sky and snow in blocks. The sound is 128 kb/s. */
export const CLIP_AUDIO_BPS = 128_000;
export function clipBitrate(w: number, h: number): number {
  const tall = h > w;
  return Math.round(Math.max(1_000_000, Math.min(tall ? 4_500_000 : 2_800_000, w * h * CLIP_FPS * 0.09 * (tall ? 2.4 : 1))));
}

/** The clip keeps at most this many of the reel's shots, and this much of the run between them (ticks). */
export const CLIP_SHOTS = 3;
export const CLIP_MAX_TICKS = 13 * 60;
/** A shot trimmed to fit keeps at least this much before its moment and this long in all (ticks). */
const KEEP_BEFORE = 66;
const SHOT_MIN = 156;

/** Which of the reel's shots the clip keeps first: the end (the line, or the wreck), then the shots the reel claims
 *  first (reel.ts planReel: the legend, the best leap, a set piece won, the closest pass), the filler last. */
function claim(s: ReelShot): number {
  const order: Record<ShotKind, number> = { finish: 0, wreck: 0, legend: 1, leap: 2, piece: 3, pass: 4, speed: 5 };
  return order[s.kind] * 2 + (s.kind === 'leap' && (s.second || s.cam !== 'orbit') ? 7 : 0);
}

/**
 * The clip's cut of a reel (planReel's shots, in the run's order): the end and the next best shots, at most
 * CLIP_SHOTS and CLIP_MAX_TICKS of the run, back in the run's order. Shots too long to fit open later (never closer
 * than KEEP_BEFORE to their moment, never shorter than SHOT_MIN). The shots are copies; the reel's own are untouched.
 * Deterministic: the same reel gives the same clip.
 */
export function clipCut(shots: readonly ReelShot[]): ReelShot[] {
  const ranked = shots.map((s, i) => ({ s, i })).sort((a, b) => claim(a.s) - claim(b.s) || a.i - b.i);
  const keep = ranked.slice(0, CLIP_SHOTS).sort((a, b) => a.i - b.i).map(({ s }) => ({ ...s }));
  const total = () => keep.reduce((n, s) => n + s.t1 - s.t0, 0);
  for (let guard = 0; guard < 200 && total() > CLIP_MAX_TICKS; guard++) {
    let k = -1;
    for (let i = 0; i < keep.length; i++) {
      const s = keep[i];
      const room = Math.min(s.peak - KEEP_BEFORE - s.t0, s.t1 - s.t0 - SHOT_MIN);
      if (room > 0 && (k < 0 || s.t1 - s.t0 > keep[k].t1 - keep[k].t0)) k = i;
    }
    if (k < 0) break;
    const s = keep[k];
    s.t0 += Math.min(12, total() - CLIP_MAX_TICKS, s.peak - KEEP_BEFORE - s.t0, s.t1 - s.t0 - SHOT_MIN);
  }
  return keep;
}

/** Where a clip is: nothing asked (idle), the reel playing into the recorder, the file being made after the last
 *  frame, made, put away by the player, or failed (the browser refused to start, or stopped with an error). */
export type ClipState = 'idle' | 'recording' | 'saving' | 'saved' | 'cancelled' | 'failed';

/** What the recorder needs of a MediaRecorder (the tests fake it). */
export interface RecorderLike {
  readonly state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(timeslice?: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
}

/**
 * One clip's recorder: made when a player asks for a clip, started at the reel's first cut, stopped after its last
 * frame. Nothing is made, started or kept before `start`; a cancel or a failure drops what was recorded. `make` builds
 * the browser's recorder (a MediaRecorder over the clip's stream) only when the clip starts.
 */
export class ClipRecorder {
  private rec: RecorderLike | null = null;
  private parts: Blob[] = [];
  private st: ClipState = 'idle';
  private settle: ((b: Blob | null) => void) | null = null;
  /** The file's type: the format's, without its codecs. */
  readonly type: string;

  constructor(
    private readonly make: () => RecorderLike,
    readonly format: ClipFormat,
  ) {
    this.type = format.mime.split(';')[0];
  }

  get state(): ClipState {
    return this.st;
  }

  /** Starts recording; false (and failed) where the browser will not. Once only. */
  start(): boolean {
    if (this.st !== 'idle') return false;
    try {
      const r = this.make();
      r.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && (this.st === 'recording' || this.st === 'saving')) this.parts.push(e.data);
      };
      r.onerror = () => this.fail();
      r.onstop = () => {
        if (this.st !== 'saving') return;
        const blob = this.parts.length > 0 ? new Blob(this.parts, { type: this.type }) : null;
        this.parts = [];
        this.st = blob ? 'saved' : 'failed';
        this.done(blob);
      };
      this.rec = r;
      r.start(1000);
      this.st = 'recording';
      return true;
    } catch {
      this.fail();
      return false;
    }
  }

  /** Holds the recording (the game paused or hidden) or lets it run on. */
  hold(on: boolean): void {
    const r = this.rec;
    if (!r || this.st !== 'recording') return;
    try {
      if (on && r.state === 'recording') r.pause();
      else if (!on && r.state === 'paused') r.resume();
    } catch {
      this.fail();
    }
  }

  /** The last frame is in: the file, or null where nothing could be made. */
  stop(): Promise<Blob | null> {
    if (this.st !== 'recording' || !this.rec) return Promise.resolve(null);
    this.st = 'saving';
    return new Promise((resolve) => {
      this.settle = resolve;
      try {
        this.rec!.stop();
      } catch {
        this.fail();
      }
    });
  }

  /** The player put the clip away: the recorder stops and everything recorded is dropped. */
  cancel(): void {
    if (this.st === 'saved' || this.st === 'cancelled' || this.st === 'failed') return;
    const r = this.rec;
    this.st = 'cancelled';
    this.parts = [];
    this.stopQuietly(r);
    this.done(null);
  }

  private fail(): void {
    if (this.st === 'saved' || this.st === 'cancelled' || this.st === 'failed') return;
    this.st = 'failed';
    this.parts = [];
    this.stopQuietly(this.rec);
    this.done(null);
  }

  private stopQuietly(r: RecorderLike | null): void {
    if (!r) return;
    r.ondataavailable = null;
    r.onstop = null;
    r.onerror = null;
    try {
      if (r.state !== 'inactive') r.stop();
    } catch {
      /* already stopped */
    }
  }

  private done(b: Blob | null): void {
    const s = this.settle;
    this.settle = null;
    s?.(b);
  }
}
