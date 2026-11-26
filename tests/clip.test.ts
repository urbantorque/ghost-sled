import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIP_MAX_TICKS, CLIP_SHOTS, ClipRecorder, clipBitrate, clipCut, clipName, clipSize, pickClipFormat, type RecorderLike } from '../src/game/clip';
import { planReel, scanRecord, type ReelShot } from '../src/game/reel';
import { recordFromString } from '../src/sim/replay';

// Round 8, G11 (the share lane): the highlight reel saved as a clip. The format is the first the browser can write
// (MP4 where it can, for phones and the social apps; WebM where not), the clip is at most 720p and named like a photo,
// it keeps the reel's best shots in a short cut, and its recorder records nothing until a player asks, drops what it
// has on a cancel or a failure, and hands back one file when the reel is done.

/** What each browser's MediaRecorder.isTypeSupported says (as of their current releases). */
const CHROME = (t: string) => t.startsWith('video/mp4') || t.startsWith('video/webm');
const FIREFOX = (t: string) => t.startsWith('video/webm');
const SAFARI = (t: string) => t.startsWith('video/mp4');
const OLD_CHROME = (t: string) => t.startsWith('video/webm');

describe('the clip: its format, size and name', () => {
  it('picks MP4 where the browser writes it, WebM where it does not, and nothing where it writes neither', () => {
    expect(pickClipFormat(CHROME, true)).toEqual({ mime: 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', ext: 'mp4' });
    expect(pickClipFormat(SAFARI, true)?.ext).toBe('mp4');
    expect(pickClipFormat(FIREFOX, true)).toEqual({ mime: 'video/webm;codecs=vp9,opus', ext: 'webm' });
    expect(pickClipFormat(OLD_CHROME, false)).toEqual({ mime: 'video/webm;codecs=vp9', ext: 'webm' });
    expect(pickClipFormat((t) => t === 'video/webm;codecs=vp8,opus', true)).toEqual({ mime: 'video/webm;codecs=vp8,opus', ext: 'webm' });
    expect(pickClipFormat(() => false, true)).toBeNull();
  });

  it('asks for the picture alone when the clip has no sound, and survives a browser that throws when asked', () => {
    const asked: string[] = [];
    pickClipFormat((t) => (asked.push(t), false), false);
    expect(asked.every((t) => !/opus|mp4a/.test(t))).toBe(true);
    expect(
      pickClipFormat((t) => {
        if (t.includes('avc1')) throw new Error('no');
        return t === 'video/webm;codecs=vp9';
      }, false),
    ).toEqual({ mime: 'video/webm;codecs=vp9', ext: 'webm' });
  });

  it('is named like the photo, with the format as its extension', () => {
    const at = new Date(2026, 10, 23, 9, 5, 7);
    expect(clipName('Pinecrest', at, 'mp4')).toBe('ghost-sled-pinecrest-20261123-090507.mp4');
    expect(clipName('Sakura Pass', at, 'webm')).toBe('ghost-sled-sakura-pass-20261123-090507.webm');
  });

  it('is at most 720p either way up, never larger than the canvas, and even on both sides', () => {
    expect(clipSize(1280, 720)).toEqual({ w: 1280, h: 720 });
    expect(clipSize(2560, 1440)).toEqual({ w: 1280, h: 720 });
    expect(clipSize(1920, 1080)).toEqual({ w: 1280, h: 720 });
    expect(clipSize(1024, 576)).toEqual({ w: 1024, h: 576 });
    // A phone held upright (Medium's canvas at the phone's ratio, and at its full 3x).
    expect(clipSize(585, 1266)).toEqual({ w: 584, h: 1266 });
    const big = clipSize(1170, 2532);
    expect(big.h).toBe(1280);
    expect(big.w).toBeLessThanOrEqual(720);
    for (const [w, h] of [[1366, 768], [801, 451], [3440, 1440], [390, 844], [1, 1]]) {
      const s = clipSize(w, h);
      expect(s.w % 2).toBe(0);
      expect(s.h % 2).toBe(0);
      expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(1280);
      expect(Math.min(s.w, s.h)).toBeLessThanOrEqual(720);
      if (w > 2 && h > 2) expect(Math.abs(s.w / s.h - w / h)).toBeLessThan(0.02);
    }
  });

  it('is a few megabytes: about 2.5 Mb/s at 720p, less for a smaller frame, held between 1 and 2.8', () => {
    expect(clipBitrate(1280, 720)).toBeGreaterThan(2_300_000);
    expect(clipBitrate(1280, 720)).toBeLessThanOrEqual(2_800_000);
    // (A clip held upright asks more a pixel: the phone's encoder spent half of what it was asked.)
    expect(clipBitrate(584, 1266)).toBeGreaterThan(3_500_000);
    expect(clipBitrate(720, 1280)).toBeLessThanOrEqual(4_500_000);
    expect(clipBitrate(1024, 576)).toBeLessThan(clipBitrate(1280, 720));
    expect(clipBitrate(64, 64)).toBe(1_000_000);
    expect(clipBitrate(4000, 4000)).toBe(2_800_000);
    // Seventeen seconds of the cut and the last frame's hold, picture and sound, at most.
    expect(((clipBitrate(1280, 720) + 128_000) * 17) / 8 / 1e6).toBeLessThan(6.5);
  });
});

/** A synthetic reel in the run's order (ticks at 60 a second). */
function shot(kind: ReelShot['kind'], t0: number, t1: number, peak: number, extra: Partial<ReelShot> = {}): ReelShot {
  return { kind, cam: kind === 'leap' ? 'orbit' : 'side', t0, t1, peak, side: 1, ...extra };
}

describe('the clip: the cut', () => {
  const reel = [
    shot('pass', 400, 640, 538),
    shot('leap', 900, 1200, 1060),
    shot('piece', 1500, 1790, 1720),
    shot('speed', 2000, 2240, 2130),
    shot('leap', 2600, 2860, 2700, { cam: 'wide', second: true }),
    shot('legend', 3100, 3412, 3160),
    shot('finish', 4000, 4360, 4204),
  ];

  it('keeps the end and the best shots, in the run order, inside its length', () => {
    const c = clipCut(reel);
    expect(c.map((s) => s.kind)).toEqual(['leap', 'legend', 'finish']);
    expect(c.length).toBeLessThanOrEqual(CLIP_SHOTS);
    expect(c.reduce((n, s) => n + s.t1 - s.t0, 0)).toBeLessThanOrEqual(CLIP_MAX_TICKS);
    for (let i = 0; i < c.length; i++) {
      expect(c[i].peak).toBeGreaterThanOrEqual(c[i].t0 + 60);
      expect(c[i].peak).toBeLessThanOrEqual(c[i].t1);
      expect(c[i].t1 - c[i].t0).toBeGreaterThanOrEqual(150);
      if (i > 0) expect(c[i].t0).toBeGreaterThan(c[i - 1].t1);
    }
  });

  it('never changes the reel it is cut from, and cuts the same reel the same way', () => {
    const before = JSON.stringify(reel);
    const a = clipCut(reel);
    expect(JSON.stringify(reel)).toBe(before);
    expect(JSON.stringify(clipCut(reel))).toBe(JSON.stringify(a));
  });

  it('keeps a wreck as the end, and a short reel whole', () => {
    const wreck = [shot('pass', 400, 640, 538), shot('wreck', 900, 1200, 1116)];
    expect(clipCut(wreck).map((s) => s.kind)).toEqual(['pass', 'wreck']);
    expect(clipCut(wreck).map((s) => [s.t0, s.t1])).toEqual([[400, 640], [900, 1200]]);
  });

  it('cuts a real run (a pool rider on Pinecrest) to its end and best moments', () => {
    const pool = JSON.parse(readFileSync('src/data/ghosts/pinecrest.json', 'utf8'));
    const entries: Array<{ record: string }> = pool.ghosts ?? pool;
    const rec = recordFromString(entries[entries.length - 1].record);
    const plan = planReel(scanRecord(rec));
    const c = clipCut(plan);
    expect(c.length).toBe(Math.min(CLIP_SHOTS, plan.length));
    expect(['finish', 'wreck']).toContain(c[c.length - 1].kind);
    expect(c.reduce((n, s) => n + s.t1 - s.t0, 0)).toBeLessThanOrEqual(CLIP_MAX_TICKS);
    for (const s of c) expect(plan.some((p) => p.kind === s.kind && p.peak === s.peak && s.t0 >= p.t0 && s.t1 === p.t1)).toBe(true);
  });

  it('cuts a real run on the Old Run too (round 9: no leaps, its bends and set pieces the moments), ending at its line', () => {
    const pool = JSON.parse(readFileSync('src/data/ghosts/oldrun.json', 'utf8'));
    const entries: Array<{ record: string }> = pool.ghosts ?? pool;
    for (const e of [entries[0], entries[entries.length - 1]]) {
      const rec = recordFromString(e.record);
      const plan = planReel(scanRecord(rec));
      expect(plan.length).toBeGreaterThan(0);
      const c = clipCut(plan);
      expect(c.length).toBe(Math.min(CLIP_SHOTS, plan.length));
      expect(['finish', 'wreck']).toContain(c[c.length - 1].kind);
      expect(c.reduce((n, s) => n + s.t1 - s.t0, 0)).toBeLessThanOrEqual(CLIP_MAX_TICKS);
    }
  });
});

/** A MediaRecorder as far as the clip uses one: it records what it is handed, and says what was asked of it. */
class FakeRecorder implements RecorderLike {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  slice = 0;
  stops = 0;
  start(timeslice?: number): void {
    this.state = 'recording';
    this.slice = timeslice ?? 0;
  }
  stop(): void {
    this.stops++;
    this.state = 'inactive';
    // The browser hands over the last data, then says it stopped (both asynchronously).
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['tail'], { type: 'video/mp4' }) });
      this.onstop?.();
    });
  }
  pause(): void {
    this.state = 'paused';
  }
  resume(): void {
    this.state = 'recording';
  }
  data(s: string): void {
    this.ondataavailable?.({ data: new Blob([s]) });
  }
}

const MP4 = { mime: 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', ext: 'mp4' as const };

function recorder(): { clip: ClipRecorder; made: FakeRecorder[] } {
  const made: FakeRecorder[] = [];
  const clip = new ClipRecorder(() => {
    const r = new FakeRecorder();
    made.push(r);
    return r;
  }, MP4);
  return { clip, made };
}

describe('the clip: its recorder', () => {
  it('records nothing until it is asked: no recorder is made while idle', () => {
    const { clip, made } = recorder();
    expect(clip.state).toBe('idle');
    expect(made).toHaveLength(0);
    // Holding or stopping an idle clip makes nothing either.
    clip.hold(true);
    expect(made).toHaveLength(0);
  });

  it('records when started, holds and runs on, and hands back one file of the format when stopped', async () => {
    const { clip, made } = recorder();
    expect(clip.start()).toBe(true);
    expect(clip.state).toBe('recording');
    expect(made).toHaveLength(1);
    const r = made[0];
    expect(r.state).toBe('recording');
    expect(r.slice).toBe(1000);
    r.data('a');
    clip.hold(true);
    expect(r.state).toBe('paused');
    clip.hold(false);
    expect(r.state).toBe('recording');
    r.data('b');
    expect(clip.start()).toBe(false);
    const p = clip.stop();
    expect(clip.state).toBe('saving');
    const blob = await p;
    expect(clip.state).toBe('saved');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('video/mp4');
    expect(await blob!.text()).toBe('abtail');
    expect(made).toHaveLength(1);
  });

  it('drops everything on a cancel: the recorder stopped, the file never made, later data ignored', async () => {
    const { clip, made } = recorder();
    clip.start();
    const r = made[0];
    r.data('a');
    clip.cancel();
    expect(clip.state).toBe('cancelled');
    expect(r.state).toBe('inactive');
    expect(r.stops).toBe(1);
    r.data('late');
    expect(await clip.stop()).toBeNull();
    expect(clip.state).toBe('cancelled');
  });

  it('a cancel while saving settles the save with nothing', async () => {
    const { clip } = recorder();
    clip.start();
    const p = clip.stop();
    clip.cancel();
    expect(await p).toBeNull();
    expect(clip.state).toBe('cancelled');
  });

  it('fails where the browser will not start, errs while recording, or stops with nothing recorded', async () => {
    const refused = new ClipRecorder(() => {
      throw new Error('NotSupportedError');
    }, MP4);
    expect(refused.start()).toBe(false);
    expect(refused.state).toBe('failed');

    const { clip, made } = recorder();
    clip.start();
    made[0].onerror?.(new Error('encoder'));
    expect(clip.state).toBe('failed');
    expect(made[0].state).toBe('inactive');

    const empty = new ClipRecorder(() => {
      const r = new FakeRecorder();
      r.stop = () => {
        r.state = 'inactive';
        queueMicrotask(() => r.onstop?.());
      };
      return r;
    }, MP4);
    empty.start();
    expect(await empty.stop()).toBeNull();
    expect(empty.state).toBe('failed');
  });
});

/** Every source file under src, with its text. */
function sources(dir = 'src'): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.ts$/.test(name)) out.push({ file: p.replace(/\\/g, '/'), text: readFileSync(p, 'utf8') });
  }
  return out;
}

describe('the clip: nothing records unless asked', () => {
  const src = sources();

  it('only the clip takes a canvas stream, makes a recorder or taps the mix', () => {
    for (const { file, text } of src) {
      if (file === 'src/game/cliptake.ts') continue;
      expect(text, file).not.toMatch(/\.captureStream\(|new MediaRecorder\(|createMediaStreamDestination\(/);
    }
    const take = src.find((s) => s.file === 'src/game/cliptake.ts')!.text;
    // The stream and the recorder are made in one place, the recorder's own factory, which runs at the first cut.
    expect(take.match(/\.captureStream\(/g)).toHaveLength(1);
    expect(take.match(/new MediaRecorder\(/g)).toHaveLength(1);
    expect(take).toMatch(/private makeRecorder\(\): RecorderLike \{\s*const stream = this\.canvas\.captureStream/);
  });

  it('the clip code is loaded on asking, never with the first frame', () => {
    for (const { file, text } of src) {
      if (file === 'src/game/cliptake.ts' || file === 'src/game/clip.ts' || file === 'src/game/reelshow.ts') continue;
      expect(text, file).not.toMatch(/from '\.\/clip(take)?'|from '\.\.\/game\/clip(take)?'/);
    }
    const app = src.find((s) => s.file === 'src/game/app.ts')!.text;
    expect(app).toMatch(/import\('\.\/cliptake'\)/);
  });
});
