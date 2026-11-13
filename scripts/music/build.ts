// npm run music: the whole score from source. Renders every piece (scripts/music/pieces) offline, masters
// its stems together, encodes them (Opus in WebM, and AAC in .m4a for a browser that cannot decode Opus)
// and writes:
//   public/music/<piece>.full.webm.bin   every section's layers and every one-shot, for desktop
//   public/music/<piece>.lite.webm.bin   two layers a section (bed and drive mixed, lead and peak mixed),
//                                         for Low and for phones
//   public/music/<piece>.lite.m4a.bin    the same in AAC, the fallback
//   public/music/probe.webm, probe.m4a   a click in silence: the runtime's decode test and offset measure
//   src/audio/produced.json              the manifest the game bundles (tempi, bars, keys, chords, forms)
//   scripts/music/analysis.json          what was measured (the notes and tests read it)
// A pack is 'GSM1', a little-endian header length, a JSON header ({ version, piece, items: { name:
// [offset, bytes, frames] } }) and the files end to end. Deterministic: the same source gives the same
// bytes on the same Node and ffmpeg. Options: a list of piece ids renders only those (the manifest and
// analysis keep the others' entries); --wav also writes every stem as a WAV under dist/music/wav.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { CUT_FADE_S, type Cmd, GATES_OFF, type Gates, type StemManifest, type StemPiece, STEM_LAYERS, StemForm, gatesFor, layerGain } from '../../src/audio/stemform';
import { SR, type Stereo, addStereo, secs, stereo } from './dsp';
import { BANDS, bands, loudness, picture, pulse } from './meter';
import { SCALES, chordAt, contour, parseLine, progression, stepsPerBar, voicing } from './notation';
import { type Layer, type Mastered, type Piece, TRACK_TIME, bandOf, calibrate, master, renderSection, renderShot, sumLayers } from './piece';
import { PIECES } from './pieces';
import { GESTURES } from './pieces/common';
import { wavBytes } from './wav';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'public', 'music');
const MANIFEST = join(ROOT, 'src', 'audio', 'produced.json');
const ANALYSIS = join(ROOT, 'scripts', 'music', 'analysis.json');
const FFMPEG = ffmpegPath as unknown as string;

/** Bitrates, bits a second. Opus is variable: a sparse stem costs far less than its figure. */
const RATE = {
  full: { bed: 56000, drive: 56000, lead: 40000, peak: 36000, shot: 48000 },
  liteOpus: { base: 48000, top: 32000, shot: 32000 },
  liteAac: { base: 80000, top: 56000, shot: 64000 },
} as const;

/** Seconds of music a piece's bitrates are written for. A longer piece (Sakura, slow, is 194 s) is encoded
 *  that much lighter, so every course's desktop pack lands between 4 and 6 MB. */
const RATE_FOR_S = 150;

/** The source's fingerprint: every file of the renderer and the pieces, line endings folded. (Not the
 *  game's scheduler: it changes what the reference run measures, never a byte of audio.) */
export function sourceVersion(): string {
  const h = createHash('sha1');
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.ts') && f !== 'try.ts' && f !== 'check.ts') h.update(f).update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    }
  };
  walk(join(ROOT, 'scripts', 'music'));
  return h.digest('hex').slice(0, 12);
}

function raw(b: Stereo): Buffer {
  const f = new Float32Array(b.l.length * 2);
  for (let i = 0; i < b.l.length; i++) {
    f[2 * i] = b.l[i];
    f[2 * i + 1] = b.r[i];
  }
  return Buffer.from(f.buffer);
}

function encode(b: Stereo, kind: 'webm' | 'm4a', rate: number, tmp: string): Buffer {
  const out = join(tmp, `x.${kind}`);
  const codec = kind === 'webm' ? ['-c:a', 'libopus', '-b:a', String(rate), '-vbr', 'on', '-application', 'audio'] : ['-c:a', 'aac', '-b:a', String(rate), '-movflags', '+faststart'];
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', ...codec, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out], { input: raw(b), maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.toString()}`);
  return readFileSync(out);
}

/** Decodes an encoded file back to PCM (for the true peak after the codec). */
function decode(bytes: Buffer, kind: string, tmp: string): Stereo {
  const inp = join(tmp, `d.${kind}`);
  writeFileSync(inp, bytes);
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', inp, '-f', 'f32le', '-ar', String(SR), '-ac', '2', 'pipe:1'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.toString()}`);
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength >> 2);
  const out = stereo(f.length >> 1);
  for (let i = 0; i < out.l.length; i++) {
    out.l[i] = f[2 * i];
    out.r[i] = f[2 * i + 1];
  }
  return out;
}

function pack(version: string, piece: string, items: Array<{ name: string; bytes: Buffer; frames: number }>): Buffer {
  const index: Record<string, [number, number, number]> = {};
  let at = 0;
  for (const it of items) {
    index[it.name] = [at, it.bytes.length, it.frames];
    at += it.bytes.length;
  }
  const head = Buffer.from(JSON.stringify({ version, piece, rate: SR, items: index }), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(head.length, 0);
  return Buffer.concat([Buffer.from('GSM1'), len, head, ...items.map((i) => i.bytes)]);
}

const r1 = (x: number): number => Math.round(x * 10) / 10;
const r2 = (x: number): number => Math.round(x * 100) / 100;

function manifestOf(p: Piece, m: Mastered): StemPiece {
  const bs = stepsPerBar(p.grid);
  const sections: StemPiece['sections'] = {};
  for (const s of p.sections) {
    const prog = progression(s.chords, bs);
    const rs = m.sections.find((x) => x.id === s.id);
    sections[s.id] = {
      role: s.role,
      bars: s.bars,
      tonic: s.key.pc,
      scale: SCALES[s.key.mode],
      layers: STEM_LAYERS.filter((l) => rs?.layers[l as Layer]),
      chords: prog.map((c) => [c.s, (s.key.pc + c.chord.root) % 12, c.chord.tones]),
    };
  }
  // The hook's head: the first bar of the first chorus's tune, in beats.
  const high = p.sections.find((s) => (s.role === 'high' || s.role === 'title') && s.tune);
  const head: Array<[number, number, number]> = [];
  if (high?.tune) for (const n of parseLine(high.tune, high.key.mode, bs)) if (n.s < bs) head.push([n.p, r2(n.s / p.grid.div), r2(n.l / p.grid.div)]);
  const shots: StemPiece['shots'] = {};
  for (const s of m.shots) shots[s.id] = { len: r2(s.len), total: r2(s.audio.l.length / SR) };
  return { name: p.name, bpm: p.grid.bpm, beats: p.grid.beats, div: p.grid.div, gainDb: 0, head, sections, form: p.form, shots };
}

/** A run played offline with the game's own scheduler: what plays when, and the mix it makes. */
function referenceRun(mp: StemPiece, m: Mastered, skilled: boolean): { mix: Stereo; log: string[] } {
  const T = 150;
  const out = stereo(secs(T + 8));
  const form = new StemForm(mp, 'run', 0);
  const log: string[] = [];
  const stageAt = (t: number): number => (t < 40 ? 0 : t < 75 ? 1 : 2);
  const driveAt = (t: number): number => (t < 2.5 ? 0.2 : (skilled ? 0.6 : 0.36) + [0, 0.07, 0.15][stageAt(t)] + (t > 100 ? 0.13 * Math.min(1, (t - 100) / 50) : 0));
  const marks: Array<[number, 'drop' | 'lift' | 'finish']> = [[19, 'drop'], [40, 'drop'], [44, 'drop'], [75, 'lift'], [82, 'drop'], [T, 'finish']];
  const breaks = [30, 56, 95];
  const playing = new Map<number, { id: string; t: number; offset: number; end: number; gates: Array<[number, Gates]> }>();
  let gates: Gates = GATES_OFF;
  const cmds: Cmd[] = [];
  let lastBar = -1;
  for (let now = 0; now < T + 4; now += 0.05) {
    form.stage = stageAt(now);
    for (const [t, kind] of marks) if (t - now > 0.15 && t - now < (kind === 'finish' ? 4.6 : 3.4)) form.plan(t, kind, now);
    for (const b of breaks) if (Math.abs(now - b) < 0.026) form.breakdown(now);
    const got = form.advance(now + 0.2);
    cmds.push(...got);
    for (const c of got) {
      if (c.op === 'play') {
        playing.set(c.token, { id: c.id, t: c.t, offset: c.offset, end: Infinity, gates: [] });
        log.push(`${c.t.toFixed(1)} ${c.id}${c.offset > 0 ? ' (second phrase)' : ''}`);
      } else if (c.op === 'cut') {
        const p = playing.get(c.token);
        if (p) p.end = c.t;
      }
    }
    const pos = form.position(now);
    if (pos) {
      const bar = Math.floor(now / form.barS);
      if (bar !== lastBar) {
        lastBar = bar;
        gates = gatesFor(gates, pos.role, 'run', { drive: driveAt(now), stage: stageAt(now), open: skilled ? 0.6 : 0, climax: now > 100 ? Math.min(1, (now - 100) / 50) : 0 });
        for (const p of playing.values()) p.gates.push([now, gates]);
      }
    }
  }
  for (const p of playing.values()) {
    const sec = m.sections.find((s) => s.id === p.id);
    if (!sec) continue;
    for (const l of STEM_LAYERS) {
      const buf = sec.layers[l as Layer];
      if (!buf) continue;
      const from = secs(p.offset);
      const at = secs(p.t);
      const cut = Number.isFinite(p.end) ? secs(p.end) : Infinity;
      const fade = secs(CUT_FADE_S);
      let gi = 0;
      let g = p.gates.length ? layerGain(l, p.gates[0][1]) : layerGain(l, gates);
      let cur = g;
      for (let i = from; i < buf.l.length; i++) {
        const o = at + i - from;
        if (o >= out.l.length || o >= cut) break;
        while (gi + 1 < p.gates.length && secs(p.gates[gi + 1][0]) <= o) g = layerGain(l, p.gates[++gi][1]);
        cur += (g - cur) * 0.002;
        const k = cut - o < fade ? (cut - o) / fade : 1;
        out.l[o] += buf.l[i] * cur * k;
        out.r[o] += buf.r[i] * cur * k;
      }
    }
  }
  for (const c of cmds) {
    if (c.op !== 'shot') continue;
    const s = m.shots.find((x) => x.id === c.id);
    if (s) addStereo(out, { l: s.audio.l.subarray(secs(c.offset)), r: s.audio.r.subarray(secs(c.offset)) }, secs(c.t), 1);
  }
  return { mix: out, log };
}

function hookStats(p: Piece): Record<string, unknown> {
  const bs = stepsPerBar(p.grid);
  const out: Record<string, unknown> = {};
  for (const s of p.sections) {
    if (!s.tune || !['high', 'low', 'mid', 'title'].includes(s.role)) continue;
    const w = parseLine(s.tune, s.key.mode, bs);
    const c = contour(w);
    const prog = progression(s.chords, bs);
    // How many of the tune's notes that start on a beat are tones of the chord under them (its 6th, 7th and 9th count).
    let on = 0;
    let all = 0;
    for (const n of w) {
      if (n.s % p.grid.div !== 0) continue;
      const ch = chordAt(prog, n.s);
      const pc = (((n.p - ch.root) % 12) + 12) % 12;
      all++;
      if ([...ch.tones.map((x) => x % 12), 2, 9, 10, 11].includes(pc)) on++;
    }
    // Voice leading: semitones each of four pad voices moves from chord to chord, on average.
    let move = 0;
    let moves = 0;
    let prev: number[] | undefined;
    for (const sp of prog) {
      const v = voicing(sp.chord, s.key.pc, 54, 4, prev);
      if (prev) for (let i = 0; i < Math.min(v.length, prev.length); i++) {
        move += Math.abs(v[i] - prev[i]);
        moves++;
      }
      prev = v;
    }
    out[s.id] = { range: c.range, low: c.low, high: c.high, steps: c.steps, leaps: c.leaps, peakAt: r2(c.peakAt), notes: c.notes, meanLenBeats: r2(c.meanLen / p.grid.div), onChord: r2(on / Math.max(1, all)), chordsPerBar: r2(prog.length / s.bars), distinctChords: new Set(prog.map((x) => x.chord.name)).size, voiceMove: r2(move / Math.max(1, moves)) };
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  const wav = args.includes('--wav');
  const version = sourceVersion();
  mkdirSync(OUT, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'gs-music-'));
  const prev: StemManifest | null = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as StemManifest) : null;
  const prevA: Record<string, unknown> = existsSync(ANALYSIS) ? (JSON.parse(readFileSync(ANALYSIS, 'utf8')) as Record<string, unknown>) : {};
  const manifest: StemManifest = { version, rate: SR, probe: { click: 4800, frames: 9600 }, pieces: { ...(prev?.pieces ?? {}) }, bytes: { ...(prev?.bytes ?? {}) } };
  const analysis: Record<string, unknown> = { ...((prevA.pieces as Record<string, unknown>) ?? {}) };
  const t00 = performance.now();
  for (const p of PIECES) {
    if (only.length && !only.includes(p.id)) continue;
    const t0 = performance.now();
    const gains = calibrate(p);
    const rendered = p.sections.map((s) => renderSection(p, s, gains));
    const shots = p.shots.map((s) => ({ id: s.id, len: s.len, audio: renderShot(p, s, gains) }));
    const m = master(p, rendered, shots);
    // The title plays every layer always: it ships as one.
    if (p.id === 'title') for (const sec of m.sections) sec.layers = { bed: sumLayers(sec.layers) };
    const mp = manifestOf(p, m);
    const tRender = (performance.now() - t0) / 1000;

    // The packs.
    const full: Array<{ name: string; bytes: Buffer; frames: number }> = [];
    const liteO: typeof full = [];
    const liteA: typeof full = [];
    let decodedFull = 0;
    let decodedLite = 0;
    const lean = Math.min(1, RATE_FOR_S / m.sections.reduce((a, s) => a + s.frames / SR, 0));
    const wdir = join(ROOT, 'dist', 'music', 'wav', p.id);
    if (wav) mkdirSync(wdir, { recursive: true });
    let tpCodec = -Infinity;
    for (const s of m.sections) {
      let sum: Stereo | null = null;
      for (const l of STEM_LAYERS) {
        const b = s.layers[l as Layer];
        if (!b) continue;
        const bytes = encode(b, 'webm', Math.round((RATE.full[l] * lean) / 1000) * 1000, tmp);
        full.push({ name: `${s.id}.${l}`, bytes, frames: s.frames });
        decodedFull = Math.max(decodedFull, b.l.length);
        if (wav) writeFileSync(join(wdir, `${s.id}.${l}.wav`), wavBytes(b));
        if (s.id === p.form.stages[p.form.stages.length - 1][0]) {
          const d = decode(bytes, 'webm', tmp);
          if (!sum) sum = stereo(d.l.length);
          addStereo(sum, d, 0, 1);
        }
      }
      if (sum) tpCodec = loudness(sum).tp;
      const base = sumLayers(s.layers, ['bed', 'drive']);
      const top = sumLayers(s.layers, ['lead', 'peak']);
      if (base.l.length) {
        liteO.push({ name: `${s.id}.base`, bytes: encode(base, 'webm', RATE.liteOpus.base, tmp), frames: s.frames });
        liteA.push({ name: `${s.id}.base`, bytes: encode(base, 'm4a', RATE.liteAac.base, tmp), frames: s.frames });
        decodedLite = Math.max(decodedLite, base.l.length);
      }
      if (top.l.length) {
        liteO.push({ name: `${s.id}.top`, bytes: encode(top, 'webm', RATE.liteOpus.top, tmp), frames: s.frames });
        liteA.push({ name: `${s.id}.top`, bytes: encode(top, 'm4a', RATE.liteAac.top, tmp), frames: s.frames });
      }
      if (wav) writeFileSync(join(wdir, `${s.id}.wav`), wavBytes(sumLayers(s.layers)));
    }
    for (const s of m.shots) {
      const frames = secs(s.len);
      full.push({ name: s.id, bytes: encode(s.audio, 'webm', RATE.full.shot, tmp), frames });
      liteO.push({ name: s.id, bytes: encode(s.audio, 'webm', RATE.liteOpus.shot, tmp), frames });
      liteA.push({ name: s.id, bytes: encode(s.audio, 'm4a', RATE.liteAac.shot, tmp), frames });
      if (wav) writeFileSync(join(wdir, `${s.id}.wav`), wavBytes(s.audio));
    }
    const files: Record<string, Buffer> = { 'full.webm': pack(version, p.id, full), 'lite.webm': pack(version, p.id, liteO), 'lite.m4a': pack(version, p.id, liteA) };
    manifest.bytes[p.id] = {};
    const sha: Record<string, string> = {};
    for (const [k, b] of Object.entries(files)) {
      writeFileSync(join(OUT, `${p.id}.${k}.bin`), b);
      manifest.bytes[p.id][k] = b.length;
      sha[k] = createHash('sha1').update(b).digest('hex').slice(0, 12);
    }

    // What it measures.
    const runSecs = m.sections.filter((s) => !['results', 'intro', 'break'].includes(mp.sections[s.id].role));
    let n = 0;
    for (const s of runSecs) n += s.frames;
    const all = stereo(n);
    let at = 0;
    for (const s of runSecs) {
      const mix = sumLayers(s.layers);
      all.l.set(mix.l.subarray(0, s.frames), at);
      all.r.set(mix.r.subarray(0, s.frames), at);
      at += s.frames;
    }
    const lv = loudness(all);
    const bd = bands(all);
    const pic = picture(all);
    const hi = m.sections.find((s) => mp.sections[s.id].role === 'high' || mp.sections[s.id].role === 'title') ?? m.sections[0];
    const pu = pulse(sumLayers(hi.layers));
    const perSection: Record<string, unknown> = {};
    for (const s of m.sections) {
      const mix = sumLayers(s.layers);
      const l = loudness(mix);
      const layers: Record<string, number> = {};
      for (const k of STEM_LAYERS) if (s.layers[k as Layer]) layers[k] = r1(loudness(s.layers[k as Layer] as Stereo).lufs);
      perSection[s.id] = { role: mp.sections[s.id].role, bars: mp.sections[s.id].bars, seconds: r1(s.frames / SR), lufs: r1(l.lufs), tp: r1(l.tp), layers };
    }
    let run: Record<string, unknown> = {};
    if (p.id !== 'title') {
      const nov = referenceRun(mp, m, false);
      const sk = referenceRun(mp, m, true);
      const ln = loudness(nov.mix);
      const ls = loudness(sk.mix);
      // The run's energy: short-term loudness every 10 s.
      const curve: number[] = [];
      for (let t = 0; t + 10 <= 150; t += 10) curve.push(r1(loudness({ l: nov.mix.l.subarray(secs(t), secs(t + 10)), r: nov.mix.r.subarray(secs(t), secs(t + 10)) }).lufs));
      run = { novice: { lufs: r1(ln.lufs), lra: r1(ln.lra), tp: r1(ln.tp), stMax: r1(ln.stMax) }, skilled: { lufs: r1(ls.lufs), lra: r1(ls.lra), tp: r1(ls.tp), stMax: r1(ls.stMax) }, energyEvery10s: curve, order: nov.log };
      if (wav) writeFileSync(join(wdir, 'run.wav'), wavBytes(nov.mix));
    }
    const seconds = m.sections.reduce((a, s) => a + s.frames / SR, 0);
    analysis[p.id] = {
      version, name: p.name, style: p.style, bpm: p.grid.bpm, metre: `${p.grid.beats * (p.grid.div === 6 ? 3 : 1)}/${p.grid.div === 6 ? 8 : 4}`, swing: p.grid.swing,
      key: `${['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][p.key.pc]} ${p.key.mode}`,
      band: bandOf(p), bars: p.sections.reduce((a, s) => a + s.bars, 0), seconds: r1(seconds),
      pulse: { bpm: r1(pu.bpm), strength: r2(pu.strength), onsetsPerS: r1(pu.onsetsPerS) },
      spectrum: { bands: BANDS, db: bd.db, centroid: Math.round(bd.centroid) },
      loudness: { lufs: r1(lv.lufs), lra: r1(lv.lra), tp: r1(lv.tp), tpAfterOpus: r1(tpCodec), masterGainDb: r1(m.gainDb), limiterDb: r1(m.limitDb) },
      stereo: { corr: r2(pic.corr), monoLoss: r1(pic.monoLoss), phoneLoss: r1(pic.phoneLoss) },
      sections: perSection, run, hooks: hookStats(p),
      bytes: manifest.bytes[p.id], sha, fullRateScale: r2(lean),
      decodedMB: { fullSection: r1((decodedFull * 8 * 4) / 1048576), liteSectionAt32k: r1((decodedLite * (32 / 48) * 8 * 2) / 1048576) },
      renderSeconds: r1(tRender),
    };
    manifest.pieces[p.id] = mp;
    console.log(`${p.id}: ${seconds.toFixed(0)} s of music in ${tRender.toFixed(0)} s; full ${(files['full.webm'].length / 1048576).toFixed(2)} MB, lite ${(files['lite.webm'].length / 1048576).toFixed(2)} MB, aac ${(files['lite.m4a'].length / 1048576).toFixed(2)} MB; ${lv.lufs.toFixed(1)} LUFS, tp ${lv.tp.toFixed(1)} (${tpCodec.toFixed(1)} after Opus)`);
  }

  // Level the courses: each reference run (a novice's) at the mean of them all.
  const ids = Object.keys(manifest.pieces).filter((id) => id !== 'title');
  const runL = ids.map((id) => ((analysis[id] as { run: { novice?: { lufs: number } } }).run.novice?.lufs ?? -18));
  const mean = runL.reduce((a, x) => a + x, 0) / Math.max(1, runL.length);
  ids.forEach((id, i) => (manifest.pieces[id].gainDb = r1(Math.max(-3, Math.min(3, mean - runL[i])))));

  // The probe: a click in silence, in both formats.
  const probe = stereo(manifest.probe.frames);
  probe.l[manifest.probe.click] = probe.r[manifest.probe.click] = 0.8;
  writeFileSync(join(OUT, 'probe.webm'), encode(probe, 'webm', 48000, tmp));
  writeFileSync(join(OUT, 'probe.m4a'), encode(probe, 'm4a', 96000, tmp));

  writeFileSync(MANIFEST, `${JSON.stringify(manifest)}\n`);
  writeFileSync(ANALYSIS, `${JSON.stringify({ version, verbs: GESTURES.map((x) => x.verb), trackSeconds: Object.fromEntries(Object.entries(TRACK_TIME).map(([k, v]) => [k, r1(v)])), pieces: analysis }, null, 1)}\n`);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`version ${version}; ${((performance.now() - t00) / 1000).toFixed(0)} s in all`);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/music/build.ts')) main();
