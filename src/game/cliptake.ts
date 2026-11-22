import { CLIP_AUDIO_BPS, CLIP_FPS, ClipRecorder, clipBitrate, clipName, clipSize, pickClipFormat, type ClipFormat, type RecorderLike } from './clip';
import { FACE, drawRunCard, type RunCard } from './photoshoot';

// Round 8, G11 (the share lane): the clip as it is taken. The reel draws the picture; each frame, in the picture's own
// callback (World.onPicture, before the riders' tags go over it, so no HUD and no tag is ever in it), the picture is
// drawn into a canvas of the clip's size, turned over to match a mirrored page, with what the reel shows over it as
// the player saw it: the dip to ink at a cut, the shot's card, and on the last second the run's card from the photo.
// That canvas is the stream the recorder takes, with the game's own sound from the end of its mix where the browser
// lets the graph be recorded (a MediaStreamAudioDestinationNode), silent where it does not. The stream and the
// recorder are made at the reel's first cut, when the player has asked; they and the sound's tap are let go at the end.

/** What the clip shows over the picture this frame (reelshow.ts sets it before each frame it draws). */
export interface ClipLook {
  /** The dip to ink at a cut. */
  dip: boolean;
  /** The shot's card: its small word and its line, and seconds since it came up. */
  kicker: string;
  line: string;
  cardT: number;
  /** Seconds into the shot's play (-1 while its card stands over the dip). */
  shotT: number;
  /** Seconds into the last frame's hold (-1 before it). */
  endT: number;
}

/** The card stands this long into its shot, then leaves the picture to itself (s); it fades over CARD_FADE. */
const CARD_HOLD = 1.5;
const CARD_FADE = 0.35;
/** A cut in the clip is short: the card stands over ink this long (s), then the recording waits while the reel runs on
 *  to the next window (and its cut waits for the score's line), and goes on as the shot opens. The reel's own dip can
 *  stand a second and more; a clip that showed it was ink for a sixth of its length (the critic: "shows nothing"). */
const CLIP_DIP_S = 0.5;
/** The dip to ink, as the reel's page does it (reel.css: 140 ms linear). */
const DIP_S = 0.14;
/** The run's card comes up over the last frame in this long (s). */
const RUN_CARD_IN = 0.3;
const INK = '#0a0f24';
const HALO = 'rgba(18, 25, 51, 0.95)';

/** Whether this browser can take a clip at all: a recorder, a canvas stream and a format it writes. Cheap: the
 *  results ask it before they show the control. */
export function canTakeClip(): boolean {
  if (typeof MediaRecorder !== 'function' || typeof MediaRecorder.isTypeSupported !== 'function') return false;
  if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false;
  return pickClipFormat((t) => MediaRecorder.isTypeSupported(t), false) !== null;
}

export interface ClipTakeOpts {
  /** The game's canvas (its drawing buffer's size sets the clip's). */
  source: HTMLCanvasElement;
  /** The page shows the canvas turned over (a mirror mountain): the clip turns over to match. */
  mirrored: boolean;
  reduced: boolean;
  /** The end of the game's mix, where its sound can be taken; null where it cannot (the context never started). */
  audio: { ctx: AudioContext; out: AudioNode } | null;
  /** The run's card for the last second (the photo's), or null. */
  card: RunCard | null;
  /** Each letterbox bar's share of the picture's height as it is drawn (a directed shot's), for the cards to keep clear
   *  of; absent: none. */
  bars?: () => number;
}

export class ClipTake {
  readonly canvas: HTMLCanvasElement;
  readonly recorder: ClipRecorder;
  readonly format: ClipFormat;
  /** What the clip shows over the picture this frame. */
  look: ClipLook = { dip: false, kicker: '', line: '', cardT: 0, shotT: -1, endT: -1 };
  /** Frames drawn into the clip, and the main thread's time spent drawing them (ms; the play-tests read them). */
  frames = 0;
  drawMs = 0;
  private readonly g: CanvasRenderingContext2D;
  private stream: MediaStream | null = null;
  private tap: MediaStreamAudioDestinationNode | null = null;
  private dipA = 0;
  private last = 0;
  private held = false;
  /** The recording waits through the rest of a long cut. */
  private dipped = false;
  /** Cuts recorded so far (the first shot is 0), and whether the last frame was in a dip. */
  private cuts = 0;
  private wasDip = false;
  private heard = false;

  /** A clip's take, or null where the browser cannot make one. Nothing records until `start`. */
  static open(o: ClipTakeOpts): ClipTake | null {
    if (!canTakeClip()) return null;
    const audio = o.audio && o.audio.ctx.state === 'running' && typeof o.audio.ctx.createMediaStreamDestination === 'function' ? o.audio : null;
    const format = pickClipFormat((t) => MediaRecorder.isTypeSupported(t), audio !== null);
    if (!format) return null;
    const size = clipSize(o.source.width, o.source.height);
    const c = document.createElement('canvas');
    c.width = size.w;
    c.height = size.h;
    const g = c.getContext('2d', { alpha: false });
    if (!g) return null;
    return new ClipTake(o, c, g, format, audio);
  }

  private constructor(
    private readonly o: ClipTakeOpts,
    canvas: HTMLCanvasElement,
    g: CanvasRenderingContext2D,
    format: ClipFormat,
    private readonly audio: ClipTakeOpts['audio'],
  ) {
    this.canvas = canvas;
    this.g = g;
    this.format = format;
    g.fillStyle = INK;
    g.fillRect(0, 0, canvas.width, canvas.height);
    this.recorder = new ClipRecorder(() => this.makeRecorder(), format);
  }

  /** Made at the first cut: the canvas's stream, the sound's tap, and the recorder over them. */
  private makeRecorder(): RecorderLike {
    const stream = this.canvas.captureStream(CLIP_FPS);
    this.stream = stream;
    if (this.audio) {
      try {
        const tap = this.audio.ctx.createMediaStreamDestination();
        this.audio.out.connect(tap);
        this.tap = tap;
        this.heard = true;
        for (const t of tap.stream.getAudioTracks()) stream.addTrack(t);
      } catch {
        this.tap = null;
      }
    }
    const opts: MediaRecorderOptions = { mimeType: this.format.mime, videoBitsPerSecond: clipBitrate(this.canvas.width, this.canvas.height) };
    if (this.tap) opts.audioBitsPerSecond = CLIP_AUDIO_BPS;
    return new MediaRecorder(stream, opts) as unknown as RecorderLike;
  }

  /** The clip's file name, like a photo's (`ghost-sled-<mountain>-<yyyymmdd-hhmmss>.mp4`). */
  name(mountain: string, at: Date): string {
    return clipName(mountain, at, this.format.ext);
  }

  /** The clip has sound (the game's mix is in it). */
  get sound(): boolean {
    return this.heard;
  }

  start(): boolean {
    this.last = performance.now();
    return this.recorder.start();
  }

  /** The game paused or hidden: the recording holds (and runs on when it comes back). */
  hold(on: boolean): void {
    if (on === this.held) return;
    this.held = on;
    this.recorder.hold(on || this.dipped);
    if (!on) this.last = performance.now();
  }

  /** The last frame is in: the file (null where none could be made). Lets the stream and the tap go. */
  async stop(): Promise<Blob | null> {
    const b = await this.recorder.stop();
    this.release();
    return b;
  }

  cancel(): void {
    this.recorder.cancel();
    this.release();
  }

  private release(): void {
    if (this.tap && this.audio) {
      try {
        this.audio.out.disconnect(this.tap);
      } catch {
        /* already apart */
      }
    }
    this.tap = null;
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
  }

  /** One frame of the clip from the picture just drawn (World.onPicture). Nothing is drawn unless it is recording. */
  draw(src: HTMLCanvasElement): void {
    if (this.recorder.state !== 'recording' || this.held) return;
    const l0 = this.look;
    const wait = l0.dip && l0.shotT < 0 && l0.endT < 0 && l0.cardT > CLIP_DIP_S;
    if (wait !== this.dipped) {
      this.dipped = wait;
      this.recorder.hold(wait);
    }
    if (l0.dip && !this.wasDip) this.cuts++;
    this.wasDip = l0.dip;
    if (wait) return;
    const t0 = performance.now();
    const dt = Math.min(0.1, Math.max(0, (t0 - this.last) / 1000));
    this.last = t0;
    const g = this.g;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const l = this.look;
    const reduced = this.o.reduced;
    try {
      // The picture, covering the clip's frame (the same shape but for a resize mid-clip), turned over to match a mirrored page.
      const k = Math.max(W / Math.max(1, src.width), H / Math.max(1, src.height));
      const dw = src.width * k;
      const dh = src.height * k;
      g.save();
      if (this.o.mirrored) {
        g.translate(W, 0);
        g.scale(-1, 1);
      }
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
      g.restore();
    } catch {
      return;
    }
    // The cut's dip to ink.
    const want = l.dip ? 1 : 0;
    this.dipA = reduced ? want : this.dipA + Math.sign(want - this.dipA) * Math.min(Math.abs(want - this.dipA), dt / DIP_S);
    if (this.dipA > 0.001) {
      g.globalAlpha = this.dipA;
      g.fillStyle = INK;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    if (l.endT >= 0) {
      // The last frame held: the run's card, as the photo has it.
      if (this.o.card) {
        g.save();
        g.globalAlpha = reduced ? 1 : Math.min(1, l.endT / RUN_CARD_IN);
        drawRunCard(g, W, H, this.o.card, this.clear().bottom);
        g.restore();
      }
    } else if (l.line) {
      // The shot's card: up with the dip, held into the shot, then gone.
      const inA = reduced ? 1 : Math.min(1, l.cardT / 0.25);
      const outA = l.shotT < 0 ? 1 : reduced ? (l.shotT < CARD_HOLD + CARD_FADE / 2 ? 1 : 0) : 1 - Math.max(0, Math.min(1, (l.shotT - CARD_HOLD) / CARD_FADE));
      const a = inA * outA;
      if (a > 0.01) this.card(l.kicker, l.line, a, this.cuts === 0 ? this.o.card?.mountain ?? null : null);
    }
    this.frames++;
    this.drawMs += performance.now() - t0;
  }

  /** The reel's card in the clip: the small word, then the line in italic 900, in the lower left with the scene text's
   *  ink halo (ART.md 10), wrapped to two lines where the frame is narrow. */
  private card(kicker: string, line: string, alpha: number, where: string | null): void {
    const g = this.g;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const u = Math.max(0.55, W < H ? W / 620 : H / 720);
    const m = 28 * u;
    const kPx = Math.round(15 * u);
    const lPx = Math.round(Math.min(40 * u, (W - 2 * m) / 11));
    const lineFont = `italic 900 ${lPx}px ${FACE}`;
    g.save();
    g.globalAlpha = alpha;
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    g.font = lineFont;
    const rows = wrap(g, line, W - 2 * m - lPx * 0.3, 2);
    let y = this.clear().caption - m - (rows.length - 1) * lPx * 1.12;
    const kY = y - lPx * 1.05;
    g.font = `800 ${kPx}px ${FACE}`;
    const spaced = 'letterSpacing' in g;
    if (spaced) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(0.08 * kPx).toFixed(1)}px`;
    this.halo(kicker.toUpperCase(), m, kY, 3 * u, 'rgba(245, 243, 255, 0.72)');
    // (The first shot also says whose clip it is: the game and the mountain, small over the kicker, so a clip seen for
    // a second in a feed is named; the second critic: "nobody names the game until the last 3%".)
    if (where) this.halo(`GHOST SLED  ${where.toUpperCase()}`, m, kY - kPx * 1.5, 3 * u, 'rgba(245, 243, 255, 0.56)');
    if (spaced) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    g.font = lineFont;
    for (const r of rows) {
      this.halo(r, m, y, 4 * u, '#F5F3FF');
      y += lPx * 1.12;
    }
    g.restore();
  }

  /** Where the cards stand: the run's card's bottom edge above a letterbox's bar (wholly in the picture), and the
   *  caption's on the bar as the reel's page sets it; a clip held upright keeps both out of the bottom tenth, where a
   *  phone's share apps lay their own controls. */
  private clear(): { bottom: number; caption: number } {
    const H = this.canvas.height;
    if (this.canvas.width < H) return { bottom: H * 0.88, caption: H * 0.9 };
    const bar = Math.max(0, Math.min(0.3, this.o.bars?.() ?? 0)) * H;
    return { bottom: bar > 4 ? H - bar : H, caption: H };
  }

  private halo(text: string, x: number, y: number, w: number, fill: string): void {
    const g = this.g;
    g.shadowColor = 'rgba(18, 25, 51, 0.6)';
    g.shadowBlur = w * 2.5;
    g.lineWidth = w;
    g.strokeStyle = HALO;
    g.strokeText(text, x, y);
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.fillStyle = fill;
    g.fillText(text, x, y);
  }
}

/** `text` broken into at most `max` rows no wider than `width` in the context's font (the last row takes the rest). */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  if (g.measureText(text).width <= width) return [text];
  const words = text.split(' ');
  const rows: string[] = [];
  let row = '';
  for (let i = 0; i < words.length; i++) {
    const next = row ? `${row} ${words[i]}` : words[i];
    if (row && g.measureText(next).width > width && rows.length < max - 1) {
      rows.push(row);
      row = words[i];
    } else row = next;
  }
  rows.push(row);
  return rows;
}
