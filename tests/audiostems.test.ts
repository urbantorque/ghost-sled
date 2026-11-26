import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTIFS, motifFor, motifShape } from '../src/audio/motifs';
import produced from '../src/audio/produced.json';
import { AWAIT_MAX_S, BREATH_MAX_S, type Cmd, GATES_OFF, LAND_LEAD_S, LOCK_S, type StemManifest, type StemPiece, StemForm, gatesFor, layerGain, pieceFor } from '../src/audio/stemform';
import { StemStore, parsePack } from '../src/audio/stemstore';
import { ROSTER } from '../src/bot/roster';
import analysisFile from '../scripts/music/analysis.json';
import { OWN_GESTURES } from '../scripts/music/pieces/common';

// The produced score (round 7): the scheduler that sequences its sections (stemform.ts), the store that
// fetches, tests and decodes its files (stemstore.ts), the files themselves (public/music, built by
// `npm run music`), what the build measured of them (scripts/music/analysis.json), and the riders' motifs.

const manifest = produced as unknown as StemManifest;
const COURSES = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall', 'oldrun'] as const;
const VERBS = ['race', 'gates', 'rings', 'collapse', 'steps', 'slide', 'shatter', 'surge', 'flourish', 'follow', 'kindle', 'carry'];

/** A small piece with round numbers: 120 bpm in four, so a beat is 0.5 s and a bar 2 s. */
const sect = (role: StemPiece['sections'][string]['role'], bars: number): StemPiece['sections'][string] => ({ role, bars, tonic: 0, scale: [0, 2, 4, 5, 7, 9, 11], layers: ['bed', 'drive', 'lead', 'peak'], chords: [[0, 0, [0, 4, 7]], [16, 7, [0, 4, 7]]] });
const TOY: StemPiece = {
  name: 'Toy',
  bpm: 120,
  beats: 4,
  div: 4,
  gainDb: 0,
  head: [[0, 0, 1], [7, 1, 1]],
  sections: { intro: sect('intro', 2), a: sect('low', 8), b: sect('high', 8), c: sect('mid', 8), bd: sect('break', 4), b2: sect('climax', 8), c2: sect('climb', 8), fin: sect('finale', 4), res: sect('results', 8) },
  form: { open: 'intro', stages: [['a', 'b', 'c', 'b'], ['c', 'b', 'a', 'b'], ['b2', 'c2']], breakdown: 'bd', finale: 'fin', results: 'res' },
  shots: { build: { len: 4, total: 4.6 }, hit: { len: 0.5, total: 3 } },
};

/** Runs a form from `from` to `to` in scheduler passes, as the deck does. */
function run(form: StemForm, from: number, to: number, ready: (id: string) => boolean = () => true): Cmd[] {
  const out: Cmd[] = [];
  for (let now = from; now < to; now += 0.025) out.push(...form.advance(now + 0.25, ready));
  return out;
}
const plays = (cmds: Cmd[]): Array<Extract<Cmd, { op: 'play' }>> => cmds.filter((c): c is Extract<Cmd, { op: 'play' }> => c.op === 'play');

describe('the scheduler: sections on bar lines', () => {
  it('opens on the intro and follows the first stage round, each section starting where the last one ends', () => {
    const f = new StemForm(TOY, 'run', 1);
    const p = plays(run(f, 0, 70));
    expect(p.map((c) => c.id).slice(0, 6)).toEqual(['intro', 'a', 'b', 'c', 'b', 'a']);
    expect(p[0].t).toBe(1);
    let t = 1;
    for (let i = 0; i < 5; i++) {
      expect(p[i].t).toBeCloseTo(t, 9);
      t += TOY.sections[p[i].id].bars * 2;
    }
  });

  it('every start in every course sits on a bar line of the section before it', () => {
    for (const id of COURSES) {
      const piece = manifest.pieces[id];
      const f = new StemForm(piece, 'run', 0);
      let prev: { t: number; bars: number } | null = null;
      for (let now = 0; now < 170; now += 0.025) {
        f.stage = now < 45 ? 0 : now < 95 ? 1 : 2;
        for (const c of f.advance(now + 0.25)) {
          if (c.op !== 'play') continue;
          if (prev) expect((c.t - prev.t) / f.barS, `${id} ${c.id}`).toBeCloseTo(prev.bars, 6);
          prev = { t: c.t, bars: piece.sections[c.id].bars };
        }
      }
      expect(prev, id).not.toBeNull();
    }
  });

  it('a new stage starts its own round at the next section, and never plays a section twice running', () => {
    for (const id of COURSES) {
      const piece = manifest.pieces[id];
      for (const flow of piece.form.stages) for (let i = 0; i < flow.length; i++) expect(flow[i], `${id} ${flow.join(' ')}`).not.toBe(flow[(i + 1) % flow.length]);
      const f = new StemForm(piece, 'run', 0);
      const order: string[] = [];
      for (let now = 0; now < 170; now += 0.025) {
        f.stage = now < 45 ? 0 : now < 95 ? 1 : 2;
        for (const c of f.advance(now + 0.25)) if (c.op === 'play') order.push(c.id);
      }
      for (let i = 1; i < order.length; i++) expect(order[i], `${id}: ${order.join(' ')}`).not.toBe(order[i - 1]);
      expect(order.some((s) => piece.form.stages[2].includes(s)), id).toBe(true);
      // Enough written music that a three-minute run's sections are not one loop: 100 s and six sections at least.
      const written = Object.values(piece.sections).reduce((a, s) => a + (s.role === 'results' ? 0 : s.bars * f.barS), 0);
      expect(written, id).toBeGreaterThan(100);
      expect(new Set(order).size, id).toBeGreaterThanOrEqual(6);
    }
  });

  it('a section not decoded yet is passed over for the one playing: the music never waits', () => {
    const f = new StemForm(TOY, 'run', 0);
    const p = plays(run(f, 0, 40, (id) => id !== 'b'));
    expect(p.map((c) => c.id).slice(0, 4)).toEqual(['intro', 'a', 'a', 'c']);
  });

  it('a mood that plays the stems faster shortens the bar by as much', () => {
    const rate = Math.pow(2, 1 / 12);
    expect(new StemForm(TOY, 'run', 0, rate).barS).toBeCloseTo(2 / rate, 9);
  });

  it('the title goes round its own form and the results repeat their reprise', () => {
    const t = manifest.pieces.title;
    const ft = new StemForm(t, 'title', 0);
    const order = plays(run(ft, 0, 120)).map((c) => c.id);
    expect(order[0]).toBe(t.form.open);
    expect(order.slice(1, 1 + t.form.stages[0].length)).toEqual([...t.form.stages[0]]);
    const fr = new StemForm(TOY, 'results', 0);
    expect(plays(run(fr, 0, 40)).map((c) => c.id)).toEqual(['res', 'res', 'res']);
    expect(fr.plan(10, 'drop', 0)).toBeNull();
  });
});

describe('the scheduler: landings', () => {
  it('lands a drop on the beat nearest the target, a bar line winning a near tie, under a build that ends on it', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 6);
    // Bars are 2 s from t = 0 (the intro is two bars): 9.1 is nearest the beat at 9.0; 9.8 goes to the bar line at 10.
    expect(f.plan(9.1, 'drop', 6)).toBeCloseTo(9, 9);
    const g = new StemForm(TOY, 'run', 0);
    run(g, 0, 6);
    const t = g.plan(9.8, 'drop', 6) as number;
    expect(t).toBeCloseTo(10, 9);
    const cmds = run(g, 6, 11);
    const build = cmds.find((c) => c.op === 'shot' && c.id === 'build') as Extract<Cmd, { op: 'shot' }>;
    expect(build.t + (TOY.shots.build.len - build.offset)).toBeCloseTo(t, 6);
    const gate = cmds.find((c) => c.op === 'gate') as Extract<Cmd, { op: 'gate' }>;
    expect(gate.until).toBeCloseTo(t, 9);
    expect(gate.t).toBeCloseTo(t - 1, 9);
    const at = cmds.filter((c) => 't' in c && Math.abs(c.t - t) < 1e-6);
    expect(at.map((c) => c.op).sort()).toEqual(['cut', 'play', 'shot']);
    expect((at.find((c) => c.op === 'play') as Extract<Cmd, { op: 'play' }>).id).toBe('b');
    expect((at.find((c) => c.op === 'shot') as Extract<Cmd, { op: 'shot' }>).id).toBe('hit');
    expect(g.landings).toBe(1);
    expect(g.landedAt).toBeCloseTo(t, 9);
  });

  it('never lands sooner than its lead, and keeps a landing once it is locked', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 6);
    const t = f.plan(6.05, 'drop', 6) as number;
    expect(t - 6).toBeGreaterThanOrEqual(LAND_LEAD_S - 1e-9);
    // Re-planned from far away it moves with the target; inside the lock it stays.
    const g = new StemForm(TOY, 'run', 0);
    run(g, 0, 6);
    expect(g.plan(12, 'drop', 6)).toBeCloseTo(12, 9);
    expect(g.plan(10, 'drop', 6.5)).toBeCloseTo(10, 9);
    run(g, 6.5, 10 - LOCK_S + 0.1);
    expect(g.plan(13, 'drop', 10 - LOCK_S + 0.1)).toBeCloseTo(10, 9);
  });

  it('a drop into a chorus still in its first phrase goes on to its second', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 21);
    // The chorus b began at 20 (intro 4 s, a 16 s): a drop at 22 lands one bar in.
    expect(f.position(21)?.id).toBe('b');
    f.plan(22, 'drop', 21);
    const p = plays(run(f, 21, 23)).pop() as Extract<Cmd, { op: 'play' }>;
    expect(p.id).toBe('b');
    expect(p.offset).toBeCloseTo(4 * f.barS, 9);
  });

  it('the lift takes the form to the last stage, and the finish lands the finale on the beat: nothing follows', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 6);
    f.stage = 1;
    f.plan(8, 'lift', 6);
    const lifted = plays(run(f, 6, 9)).pop() as Extract<Cmd, { op: 'play' }>;
    expect(lifted.id).toBe('b2');
    f.stage = 2;
    expect(f.upcoming()).toContain('fin');
    const t = f.plan(14.2, 'finish', 10) as number;
    expect(t).toBeCloseTo(14, 9);
    const cmds = run(f, 10, 40);
    const p = plays(cmds);
    expect(p[p.length - 1]).toMatchObject({ id: 'fin', t });
    expect(cmds.some((c) => c.op === 'shot' && c.id === 'hit' && Math.abs(c.t - t) < 1e-6)).toBe(false);
    expect(f.done).toBe(true);
    expect(f.plan(30, 'drop', 20)).toBeNull();
    expect(f.finaleS).toBeCloseTo(8, 9);
  });

  it('the finish takes over a drop already planned', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 6);
    f.plan(9, 'drop', 6);
    f.plan(9, 'finish', 6.2);
    expect(f.landing?.kind).toBe('finish');
    expect(plays(run(f, 6.2, 12)).pop()?.id).toBe('fin');
  });

  it('a landing whose section is not decoded still lands its hit, on what is playing', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 6);
    const t = f.plan(8, 'drop', 6) as number;
    const cmds = run(f, 6, 9, (id) => id !== 'b');
    expect(cmds.some((c) => c.op === 'shot' && c.id === 'hit' && Math.abs(c.t - t) < 1e-6)).toBe(true);
    expect(cmds.some((c) => c.op === 'cut')).toBe(false);
  });
});

describe('the scheduler: the breakdown, the breath and the crash back in', () => {
  it('breaks down at the next four-bar line of the section playing, and not with a drop about to land', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 7);
    // Section a began at 4: its four-bar lines are at 12 and 20.
    f.breakdown(7);
    const cmds = run(f, 7, 13);
    expect(plays(cmds).pop()).toMatchObject({ id: 'bd', t: 12 });
    expect(cmds.some((c) => c.op === 'cut' && Math.abs(c.t - 12) < 1e-9)).toBe(true);
    // The breakdown is four bars; the form goes on after it.
    expect(plays(run(f, 13, 21)).pop()?.t).toBeCloseTo(20, 9);
    const g = new StemForm(TOY, 'run', 0);
    run(g, 0, 7);
    g.plan(10, 'drop', 7);
    g.breakdown(7.1);
    expect(plays(run(g, 7, 16)).some((c) => c.id === 'bd')).toBe(false);
  });

  it('holds its breath (everything cut to its tail), plays nothing while it holds, and crashes back in on the instant', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 9);
    f.stage = 1;
    const cut = f.breath(9);
    expect(cut[0]).toMatchObject({ op: 'cut' });
    expect(f.holding).toBe(true);
    expect(f.plan(11, 'drop', 9.1)).toBeNull();
    expect(run(f, 9, 10.7)).toEqual([]);
    const back = f.crashIn(10.73);
    expect(back.map((c) => c.op).sort()).toEqual(['play', 'shot']);
    expect(back.find((c) => c.op === 'play')).toMatchObject({ id: 'b', t: 10.73, offset: 0 });
    expect(back.find((c) => c.op === 'shot')).toMatchObject({ id: 'hit', t: 10.73 });
    expect(f.holding).toBe(false);
    // The grid is the landing's from here: the next section starts eight bars after it.
    expect(plays(run(f, 10.73, 28)).pop()?.t).toBeCloseTo(10.73 + 16, 6);
  });

  it('a flight longer than a breath gets the breakdown under the rest of it, and still its crash on the landing', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 9);
    f.breath(9);
    const p = plays(run(f, 9, 9 + BREATH_MAX_S + 1));
    expect(p.length).toBe(1);
    expect(p[0].id).toBe('bd');
    expect(p[0].t - 9).toBeGreaterThanOrEqual(BREATH_MAX_S - 0.3);
    expect(f.holding).toBe(true);
    const back = f.crashIn(15.4);
    expect(back.map((c) => c.op).sort()).toEqual(['cut', 'play', 'shot']);
    expect(back.find((c) => c.op === 'play')).toMatchObject({ id: 'b', t: 15.4 });
    expect(f.holding).toBe(false);
    // And a landing that never comes is forgotten: the form goes on.
    const g = new StemForm(TOY, 'run', 0);
    run(g, 0, 9);
    g.breath(9);
    run(g, 9, 9 + BREATH_MAX_S + AWAIT_MAX_S + 1);
    expect(g.holding).toBe(false);
    expect(g.crashIn(30)).toEqual([]);
  });

  it('knows the key and the chord at any moment, and what to have decoded', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 5);
    expect(f.harmony(4.5)).toMatchObject({ tonic: 0, root: 0 });
    expect(f.harmony(6.5)).toMatchObject({ root: 7 });
    expect(f.upcoming().sort()).toEqual(['a', 'b', 'bd']);
    expect(f.grid().dur).toBeCloseTo(0.125, 9);
  });

  it('the jukebox can hold a section, from the next bar line', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 5);
    f.jump('c2', 5);
    const p = plays(run(f, 5, 30));
    expect(p[0]).toMatchObject({ id: 'c2', t: 6 });
    expect(p[1]).toMatchObject({ id: 'c2', t: 22 });
  });
});

describe('the layers follow the race', () => {
  const race = (drive: number, stage = 0, open = 0, climax = 0) => ({ drive, stage, open, climax });

  it('a cruise in a verse is the bed and the drive; a chorus always has its lead; riding well opens the rest', () => {
    expect(gatesFor(GATES_OFF, 'low', 'run', race(0.36))).toEqual({ drive: true, lead: false, peak: false });
    expect(gatesFor(GATES_OFF, 'high', 'run', race(0.36))).toEqual({ drive: true, lead: true, peak: false });
    expect(gatesFor(GATES_OFF, 'low', 'run', race(0.36, 1))).toMatchObject({ lead: true });
    expect(gatesFor(GATES_OFF, 'low', 'run', race(0.5, 0, 0.6))).toEqual({ drive: true, lead: true, peak: true });
    expect(gatesFor(GATES_OFF, 'climb', 'run', race(0.5, 2, 0, 0.4))).toMatchObject({ peak: true });
    expect(gatesFor(GATES_OFF, 'finale', 'run', race(0.2))).toEqual({ drive: true, lead: true, peak: true });
    expect(gatesFor(GATES_OFF, 'low', 'run', race(0.1))).toEqual({ drive: false, lead: false, peak: false });
  });

  it('no layer flaps: a drive wandering round a threshold changes nothing', () => {
    let g = gatesFor(GATES_OFF, 'low', 'run', race(0.3));
    expect(g.drive).toBe(true);
    for (const d of [0.25, 0.27, 0.23, 0.26]) {
      g = gatesFor(g, 'low', 'run', race(d));
      expect(g.drive).toBe(true);
    }
    let p = gatesFor(GATES_OFF, 'mid', 'run', race(0.73));
    expect(p.peak).toBe(true);
    for (const d of [0.7, 0.66, 0.71, 0.65]) {
      p = gatesFor(p, 'mid', 'run', race(d));
      expect(p.peak).toBe(true);
    }
    expect(gatesFor(p, 'mid', 'run', race(0.6)).peak).toBe(false);
  });

  it('the title and the results play everything, and the lighter packs map onto the same gates', () => {
    expect(gatesFor(GATES_OFF, 'title', 'title', race(0))).toEqual({ drive: true, lead: true, peak: true });
    expect(gatesFor(GATES_OFF, 'results', 'results', race(0))).toEqual({ drive: true, lead: true, peak: true });
    const g = { drive: false, lead: true, peak: false };
    expect(['bed', 'drive', 'lead', 'peak', 'base', 'top'].map((l) => layerGain(l, g))).toEqual([1, 0, 1, 0, 1, 1]);
  });

  it('each mountain plays its own piece, and one the score does not know plays the live band', () => {
    expect(['alpine', 'glacier', 'volcanic', 'blossom', 'lantern', 'oldrun'].map(pieceFor)).toEqual([...COURSES]);
    expect(pieceFor('moon')).toBeNull();
  });
});

// ---------------------------------------------------------------- the files

const MUSIC = join(import.meta.dirname, '..', 'public', 'music');
const packOf = (name: string): ArrayBuffer => {
  const b = readFileSync(join(MUSIC, name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe('the packs', () => {
  it('a pack is read back as it was written, and junk is refused', () => {
    const head = new TextEncoder().encode(JSON.stringify({ version: 'v', piece: 'x', items: { 'a.bed': [0, 3, 96000] } }));
    const bytes = new Uint8Array(8 + head.length + 3);
    bytes.set([0x47, 0x53, 0x4d, 0x31]);
    new DataView(bytes.buffer).setUint32(4, head.length, true);
    bytes.set(head, 8);
    expect(parsePack(bytes.buffer)).toEqual({ base: 8 + head.length, version: 'v', items: { 'a.bed': [0, 3, 96000] } });
    expect(parsePack(new Uint8Array(40).buffer)).toBeNull();
    expect(parsePack(bytes.buffer.slice(0, 20))).toBeNull();
  });

  it('every piece ships three packs of this build, holding every section, layer and one-shot the manifest names', () => {
    expect(existsSync(join(MUSIC, 'probe.webm')) && existsSync(join(MUSIC, 'probe.m4a'))).toBe(true);
    for (const [id, piece] of Object.entries(manifest.pieces)) {
      for (const kind of ['full.webm', 'lite.webm', 'lite.m4a']) {
        const name = `${id}.${kind}.bin`;
        const buf = packOf(name);
        expect(buf.byteLength, name).toBe(manifest.bytes[id][kind]);
        const p = parsePack(buf);
        expect(p?.version, name).toBe(manifest.version);
        const items = p?.items ?? {};
        for (const [sid, s] of Object.entries(piece.sections)) {
          const want = kind.startsWith('full') ? s.layers.map((l) => `${sid}.${l}`) : [`${sid}.base`];
          for (const w of want) expect(items[w], `${name} ${w}`).toBeDefined();
          // Its frames are its bars at the piece's tempo.
          expect(items[want[0]][2] / manifest.rate, `${name} ${sid}`).toBeCloseTo((s.bars * piece.beats * 60) / piece.bpm, 3);
        }
        for (const shot of Object.keys(piece.shots)) expect(items[shot], `${name} ${shot}`).toBeDefined();
        let end = 0;
        for (const [off, len] of Object.values(items)) end = Math.max(end, off + len);
        expect((p?.base ?? 0) + end, name).toBe(buf.byteLength);
      }
    }
  });

  it('a course is 4 to 6 MB on a desktop and about half that on Low and phones; the title is under 1 MB', () => {
    for (const id of COURSES) {
      const b = manifest.bytes[id];
      expect(b['full.webm'] / 1048576, id).toBeGreaterThan(4);
      expect(b['full.webm'] / 1048576, id).toBeLessThan(6);
      expect(b['lite.webm'] / b['full.webm'], id).toBeLessThan(0.6);
      expect(b['lite.m4a'] / 1048576, id).toBeLessThan(5);
    }
    for (const b of Object.values(manifest.bytes.title)) expect(b / 1048576).toBeLessThan(1);
  });

  it('every course has the build, the hit, and a stinger for every set-piece verb it can meet, the win and the loss', () => {
    // (Round 9: a new mountain's own verbs are met there alone, and only its piece carries them: OWN_GESTURES.)
    const owned = (v: string): string | undefined => Object.keys(OWN_GESTURES).find((k) => OWN_GESTURES[k].some((x) => x.verb === v));
    for (const id of COURSES) {
      const shots = Object.keys(manifest.pieces[id].shots);
      const meets = VERBS.filter((x) => owned(x) === undefined || owned(x) === id);
      for (const v of ['build', 'hit', 'st.any', 'st.won', 'st.lost', ...meets.map((x) => `st.${x}`)]) expect(shots, `${id} ${v}`).toContain(v);
      for (const x of VERBS) if (owned(x) !== undefined && owned(x) !== id) expect(shots, `${id} st.${x}`).not.toContain(`st.${x}`);
    }
  });
});

// ---------------------------------------------------------------- what the build measured

interface Measured {
  bpm: number;
  metre: string;
  key: string;
  band: string[];
  seconds: number;
  spectrum: { db: number[]; centroid: number };
  loudness: { lufs: number; lra: number; tp: number; tpAfterOpus: number };
  stereo: { corr: number; monoLoss: number; phoneLoss: number };
  run: { novice: { lufs: number; lra: number; tp: number }; skilled: { lufs: number; lra: number; tp: number } };
  hooks: Record<string, { range: number; onChord: number; voiceMove: number; distinctChords: number }>;
}
const measured = (analysisFile as unknown as { version: string; pieces: Record<string, Measured> }).pieces;

/** The spectrum's shape: each band against the mean of them all, so level does not count. */
const shape = (db: number[]): number[] => {
  const use = db.slice(1, 9);
  const mean = use.reduce((a, x) => a + x, 0) / use.length;
  return use.map((x) => x - mean);
};
const rms = (a: number[], b: number[]): number => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
/** Shared instruments over all instruments, the drops' common cymbal left out. */
const overlap = (a: string[], b: string[]): number => {
  const A = new Set(a.filter((x) => x !== 'cymbal'));
  const B = new Set(b.filter((x) => x !== 'cymbal'));
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
};

describe('the score as measured (scripts/music/analysis.json)', () => {
  it('was measured from the build that is shipped', () => {
    expect((analysisFile as unknown as { version: string }).version).toBe(manifest.version);
  });

  it('no two courses measure alike: tempo, key, the shape of the spectrum and the band all differ', () => {
    for (let i = 0; i < COURSES.length; i++) {
      for (let j = i + 1; j < COURSES.length; j++) {
        const a = measured[COURSES[i]];
        const b = measured[COURSES[j]];
        const pair = `${COURSES[i]} / ${COURSES[j]}`;
        // Tempo: 8 % apart at the least (a difference anyone taps differently), and the two that stand an
        // octave apart (Frostfang's 126 in four, Lanternfall's 63 in a slow 6/8) are in different metres.
        const ratio = Math.max(a.bpm, b.bpm) / Math.min(a.bpm, b.bpm);
        expect(ratio, `${pair} tempo`).toBeGreaterThan(1.08);
        if (Math.abs(ratio - 2) < 0.08) expect(a.metre, `${pair} metre`).not.toBe(b.metre);
        expect(a.key, `${pair} key`).not.toBe(b.key);
        // Spectrum: the octave bands from 63 Hz to 8 kHz, each against the piece's own mean, differ by 2.5 dB RMS.
        expect(rms(shape(a.spectrum.db), shape(b.spectrum.db)), `${pair} spectrum`).toBeGreaterThan(2.5);
        // Instruments: no two bands share a third of their instrument families.
        expect(overlap(a.band, b.band), `${pair} band`).toBeLessThan(0.34);
      }
    }
    // The title is its own piece too.
    for (const id of COURSES) expect(measured.title.bpm, id).not.toBe(measured[id].bpm);
  });

  it('every piece is mastered to -16 LUFS, under -1 dBTP after the codec, and survives mono and a phone speaker', () => {
    for (const [id, m] of Object.entries(measured)) {
      expect(Math.abs(m.loudness.lufs + 16), `${id} lufs`).toBeLessThan(0.5);
      expect(m.loudness.tp, `${id} tp`).toBeLessThan(-1);
      expect(m.loudness.tpAfterOpus, `${id} tp after Opus`).toBeLessThan(-1);
      expect(m.stereo.corr, `${id} correlation`).toBeGreaterThan(0.5);
      expect(m.stereo.monoLoss, `${id} mono`).toBeLessThan(1.5);
      expect(m.stereo.phoneLoss, `${id} phone`).toBeLessThan(4.5);
    }
  });

  it('a run, sequenced by the game, sits at -16 LUFS for a novice and a skilled rider, and moves', () => {
    for (const id of COURSES) {
      const r = measured[id].run;
      for (const who of [r.novice, r.skilled]) {
        expect(Math.abs(who.lufs + 16), id).toBeLessThan(0.8);
        expect(who.lra, id).toBeGreaterThan(4);
        expect(who.lra, id).toBeLessThan(10);
      }
    }
  });

  it('every tune has a range a player can carry (a fiddle reel the widest, two octaves), sits on its chords, and moves over voices that move by step', () => {
    for (const id of COURSES) {
      const hooks = Object.values(measured[id].hooks);
      expect(hooks.length, id).toBeGreaterThanOrEqual(2);
      for (const h of hooks) {
        expect(h.range, id).toBeGreaterThanOrEqual(5);
        expect(h.range, id).toBeLessThanOrEqual(24);
        expect(h.onChord, id).toBeGreaterThanOrEqual(0.75);
        expect(h.voiceMove, id).toBeLessThan(3.5);
        expect(h.distinctChords, id).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

// ---------------------------------------------------------------- the store

/** A browser as far as the store sees one: fetch, the Cache API and an offline context whose decoder
 *  knows the probe (a click, `lead` samples late) and makes a second of silence of anything else. */
function fakeBrowser(opts: { decodes: (url: string) => boolean; lead?: number; missing?: string[] }): { fetched: string[]; cache: Map<string, ArrayBuffer>; decoded: number[] } {
  const fetched: string[] = [];
  const cache = new Map<string, ArrayBuffer>();
  const decoded: number[] = [];
  const tag = new Map<ArrayBuffer, string>();
  const body = (url: string): ArrayBuffer => {
    if (url.includes('probe.')) {
      const b = new Uint8Array(16).buffer;
      tag.set(b, url);
      return b;
    }
    const head = new TextEncoder().encode(JSON.stringify({ version: manifest.version, piece: 'x', items: { 'intro.bed': [0, 4, 48000], 'intro.base': [0, 4, 48000], 'a.bed': [4, 4, 48000], 'a.lead': [8, 4, 48000], 'a.base': [4, 4, 48000], hit: [12, 4, 24000] } }));
    const bytes = new Uint8Array(8 + head.length + 16);
    bytes.set([0x47, 0x53, 0x4d, 0x31]);
    new DataView(bytes.buffer).setUint32(4, head.length, true);
    bytes.set(head, 8);
    return bytes.buffer;
  };
  const response = (b: ArrayBuffer) => ({ ok: true, arrayBuffer: async () => b.slice(0), clone: () => response(b) });
  vi.stubGlobal('fetch', async (url: string) => {
    fetched.push(url);
    if (opts.missing?.some((m) => url.includes(m))) return { ok: false, arrayBuffer: async () => new ArrayBuffer(0), clone: () => null };
    const b = body(url);
    const r = response(b);
    // (The probe's bytes are told apart by identity: keep the tagged buffer.)
    return url.includes('probe.') ? { ...r, arrayBuffer: async () => b } : r;
  });
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => (cache.has(url) ? response(cache.get(url) as ArrayBuffer) : undefined),
      put: async (url: string, res: { arrayBuffer(): Promise<ArrayBuffer> }) => void cache.set(url, await res.arrayBuffer()),
      delete: async (url: string) => cache.delete(url),
    }),
  });
  class Offline {
    constructor(
      _ch: number,
      _len: number,
      readonly sampleRate: number,
    ) {}
    decodeAudioData(data: ArrayBuffer): Promise<unknown> {
      const url = tag.get(data);
      if (url) {
        if (!opts.decodes(url)) return Promise.reject(new Error('no codec'));
        const n = Math.round((manifest.probe.frames * this.sampleRate) / manifest.rate);
        const d = new Float32Array(n);
        d[Math.round((manifest.probe.click * this.sampleRate) / manifest.rate) + (opts.lead ?? 0)] = 0.8;
        return Promise.resolve({ sampleRate: this.sampleRate, length: n, numberOfChannels: 2, getChannelData: () => d });
      }
      decoded.push(this.sampleRate);
      return Promise.resolve({ sampleRate: this.sampleRate, length: this.sampleRate, numberOfChannels: 2, getChannelData: () => new Float32Array(1) });
    }
  }
  vi.stubGlobal('OfflineAudioContext', Offline);
  return { fetched, cache, decoded };
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

describe('the store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('takes Opus where it decodes, at full quality on a desktop, and fetches a pack once', async () => {
    const env = fakeBrowser({ decodes: () => true });
    const s = new StemStore(manifest, './music/');
    expect(await s.load('pinecrest')).toBe(true);
    expect(s.format).toBe('webm');
    expect(s.align).toBe(0);
    expect(s.tier).toBe('full');
    expect(await s.load('pinecrest')).toBe(true);
    expect(env.fetched).toEqual(['./music/probe.webm', './music/pinecrest.full.webm.bin']);
    expect(s.state('pinecrest')).toBe('ready');
    expect(s.state('ember')).toBe('none');
    expect(s.layersOf('pinecrest', 'a').sort()).toEqual(['base', 'bed', 'lead']);
  });

  it('falls back to AAC where Opus does not decode (the lighter pack), and measures the decoder leaving samples in front', async () => {
    const env = fakeBrowser({ decodes: (u) => u.endsWith('.m4a'), lead: 1024 });
    const s = new StemStore(manifest, './music/');
    expect(await s.load('ember')).toBe(true);
    expect(s.format).toBe('m4a');
    expect(s.tier).toBe('lite');
    // (The probe is decoded at the context rate, before the tier is known.)
    expect(s.align).toBeCloseTo(1024 / 48000, 6);
    expect(env.fetched[env.fetched.length - 1]).toBe('./music/ember.lite.m4a.bin');
  });

  it('where neither decodes, or the pack is not there, nothing is ready: the live band plays', async () => {
    fakeBrowser({ decodes: () => false });
    const s = new StemStore(manifest, './music/');
    expect(await s.load('sakura')).toBe(false);
    expect(s.format).toBeNull();
    expect(s.state('sakura')).toBe('failed');
    vi.unstubAllGlobals();
    fakeBrowser({ decodes: () => true, missing: ['frostfang'] });
    const t = new StemStore(manifest, './music/');
    expect(await t.load('frostfang')).toBe(false);
    expect(t.state('frostfang')).toBe('failed');
    expect(t.sectionReady('frostfang', 'a')).toBe(false);
    expect(await t.load('nothing')).toBe(false);
  });

  it('reads a pack from the cache the second time, and throws away one from another build', async () => {
    const env = fakeBrowser({ decodes: () => true });
    const a = new StemStore(manifest, './music/');
    await a.load('pinecrest');
    await settle();
    expect(env.cache.has('./music/pinecrest.full.webm.bin')).toBe(true);
    const b = new StemStore(manifest, './music/');
    await b.load('pinecrest');
    expect(b.cacheHits).toBe(1);
    expect(b.fetched).toBe(0);
    const c = new StemStore({ ...manifest, version: 'another' }, './music/');
    await c.load('pinecrest');
    expect(c.cacheHits).toBe(0);
    expect(c.fetched).toBeGreaterThan(0);
  });

  it('decodes what is claimed, a section at a time, and drops what no owner claims', async () => {
    fakeBrowser({ decodes: () => true });
    const s = new StemStore(manifest, './music/');
    await s.load('pinecrest');
    s.claim('deck1', 'pinecrest', ['intro'], ['hit']);
    await settle();
    expect(s.sectionReady('pinecrest', 'intro')).toBe(true);
    expect(s.sectionReady('pinecrest', 'a')).toBe(false);
    expect(s.buffer('pinecrest', 'hit')).not.toBeNull();
    const one = s.held;
    expect(one).toBe(3 * 48000 * 2 * 4);
    // A second owner (the results' reprise coming in under the finale) adds to it; the first one's stays.
    s.claim('deck2', 'pinecrest', ['a']);
    await settle();
    expect(s.sectionReady('pinecrest', 'intro') && s.sectionReady('pinecrest', 'a')).toBe(true);
    expect(s.peak).toBe(s.held);
    s.claim('deck1', 'pinecrest', ['a']);
    expect(s.sectionReady('pinecrest', 'intro')).toBe(false);
    s.release('deck1');
    expect(s.sectionReady('pinecrest', 'a')).toBe(true);
    s.release('deck2');
    expect(s.held).toBe(0);
    expect(s.peak).toBeGreaterThan(one);
  });

  it('Low hears the lighter pack, decoded at 32 kHz; a piece keeps the pack it started with when the tier changes', async () => {
    const env = fakeBrowser({ decodes: () => true });
    const s = new StemStore(manifest, './music/');
    s.setQuality('low');
    await s.load('pinecrest');
    expect(env.fetched).toContain('./music/pinecrest.lite.webm.bin');
    s.claim('d', 'pinecrest', ['a']);
    await settle();
    expect(env.decoded.every((r) => r === 32000)).toBe(true);
    expect(s.layersOf('pinecrest', 'a')).toContain('base');
    s.setQuality('high');
    expect(s.state('pinecrest')).toBe('ready');
    expect(s.sectionReady('pinecrest', 'a')).toBe(true);
    await s.load('ember');
    expect(env.fetched).toContain('./music/ember.full.webm.bin');
  });
});

// ---------------------------------------------------------------- the riders

describe("the signature riders' motifs", () => {
  it('every one of the twelve has a motif, and nobody else does', () => {
    expect(ROSTER.length).toBe(12);
    for (const r of ROSTER) {
      expect(MOTIFS[r.key], r.name).toBeDefined();
      expect(motifFor(r.name), r.name).toBe(MOTIFS[r.key]);
    }
    expect(Object.keys(MOTIFS).sort()).toEqual(ROSTER.map((r) => r.key).sort());
    expect(motifFor('A Stranger')).toBeNull();
    expect(motifFor(null)).toBeNull();
  });

  it('no two are the same tune, from whatever note they start', () => {
    const shapes = Object.values(MOTIFS).map(motifShape);
    expect(new Set(shapes).size).toBe(shapes.length);
    // Nor the same contour in another rhythm, nor the same rhythm on another contour.
    const contours = Object.values(MOTIFS).map((m) => m.notes.map((n) => n[0] - m.notes[0][0]).join(','));
    expect(new Set(contours).size).toBe(contours.length);
  });

  it('each is short, in order, and made of notes that sit in any of the score\'s keys', () => {
    for (const [key, m] of Object.entries(MOTIFS)) {
      expect(m.notes.length, key).toBeGreaterThanOrEqual(2);
      expect(m.notes.length, key).toBeLessThanOrEqual(7);
      let end = 0;
      for (const [semi, at, len] of m.notes) {
        expect([0, 2, 4, 7, 9], `${key} ${semi}`).toContain(((semi % 12) + 12) % 12);
        expect(at, key).toBeGreaterThanOrEqual(end);
        end = at + len;
      }
      expect(end, key).toBeLessThanOrEqual(10);
      expect(m.says.length, key).toBeGreaterThan(20);
    }
  });
});

describe('the scheduler: one landmark, one landing', () => {
  it('a second landing asked for within two seconds of the last is refused, the finish apart', () => {
    const f = new StemForm(TOY, 'run', 0);
    run(f, 0, 6);
    const t = f.plan(8, 'lift', 6) as number;
    run(f, 6, t + 0.1);
    expect(f.landings).toBe(1);
    expect(f.plan(t + 0.6, 'lift', t + 0.1)).toBeNull();
    expect(f.plan(t + 1.2, 'finish', t + 0.1)).not.toBeNull();
  });
});

describe('the scheduler: a breakdown on a section\'s own end', () => {
  it('takes the place of the next section instead of cutting it as it starts', () => {
    for (const id of COURSES) {
      const f = new StemForm(manifest.pieces[id], 'run', 0.5);
      const seen: Array<{ t: number; id: string }> = [];
      for (let now = 0; now < 60; now += 0.025) {
        // Asked for in the last bars of the first verse: its four-bar line is the verse's end.
        if (Math.abs(now - (0.5 + 10.5 * f.barS)) < 0.0126) f.breakdown(now);
        for (const c of f.advance(now + 0.25)) if (c.op === 'play') seen.push({ t: c.t, id: c.id });
      }
      for (let i = 1; i < seen.length; i++) expect(seen[i].t - seen[i - 1].t, `${id} ${seen[i - 1].id} then ${seen[i].id}`).toBeGreaterThan(1);
      expect(seen.map((s) => s.id).slice(0, 4), id).toEqual(['intro', 'a', 'bd', 'b']);
    }
  });
});
