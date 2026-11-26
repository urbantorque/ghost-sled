// A bench for the instruments: every one played at a few pitches, its sounding pitch against the note
// asked for (cents), its level and its length. Run: npx tsx scripts/music/check.ts
import { Rng, type Stereo, mtof } from './dsp';
import * as I from './inst';
import * as P from './perc';
import { pitchOf } from './meter';

const mono = (v: I.Voice): Float32Array => (v instanceof Float32Array ? v : (v as Stereo).l.map((x, i) => (x + (v as Stereo).r[i]) * 0.5));
const pitched: Array<[string, I.Inst, number[]]> = [
  ['guitar', I.pluck({ bright: 0.6, decay: 3, pick: 0.2, body: 'guitar' }), [40, 52, 64, 76]],
  ['koto', I.pluck({ bright: 0.8, decay: 2.2, pick: 0.1, body: 'koto', ringOut: true }), [55, 67, 79]],
  ['harp', I.pluck({ bright: 0.5, decay: 3.5, pick: 0.4, body: 'harp', ringOut: true }), [43, 60, 84]],
  ['upright', I.pluck({ bright: 0.25, decay: 1.6, pick: 0.3, body: 'bass' }), [28, 38, 45]],
  ['fiddle', I.bowed({ body: 'violin', voices: 1, bright: 0.7, vib: 0, attack: 0.04 }), [57, 69, 81]],
  ['strings', I.bowed({ body: 'cello', voices: 4, bright: 0.5, vib: 0, attack: 0.2 }), [43, 55]],
  ['trumpet', I.brass({ kind: 'trumpet', voices: 1 }), [60, 72]],
  ['lowbrass', I.brass({ kind: 'trombone', voices: 3 }), [40, 52]],
  ['flute', I.wind({ kind: 'flute', breath: 0.3, vib: 0, scoop: 0 }), [72, 84]],
  ['shaku', I.wind({ kind: 'shaku', breath: 0.6, vib: 0, scoop: 0 }), [62, 74]],
  ['squeezebox', I.reed({ reeds: [[-7, 0], [9, 0]], bright: 0.55, attack: 0.02, body: 'treble' }), [59, 71, 83]],
  ['bassreeds', I.reed({ reeds: [[0, 0], [3, 1]], bright: 0.4, attack: 0.03, body: 'bass' }), [33, 40, 47]],
  ['fmbell', I.fmBell({ ratio: 3.5, index: 1.2, decay: 2 }), [72, 84]],
  ['musicbox', I.musicBox(), [72, 84, 96]],
  ['bell', I.churchBell(), [60, 72]],
  ['glass', I.glass(), [72, 84]],
  ['glock', I.glock(), [84]],
  ['marimba', I.marimba(), [60]],
  ['piano', I.feltPiano(0.5), [36, 48, 60, 72, 84]],
  ['epiano', I.ePiano(), [48, 60, 72]],
  ['supersaw', I.superSaw({ voices: 7, detune: 18, cutoff: 600, open: 4000, attack: 0.3, release: 0.5 }), [48, 60]],
  ['glasspad', I.glassPad(), [60, 72]],
  ['choir', I.choir({ from: 'oo', to: 'ah', voices: 5, attack: 0.3, release: 0.5 }), [55, 67]],
  ['sub', I.subBass(), [28, 40]],
  ['synthbass', I.synthBass(), [30, 42]],
  ['distbass', I.distBass(), [28, 40]],
  ['synthlead', I.synthLead(5, 0), [60, 72]],
  ['sinelead', I.sineLead(0), [72, 84]],
  ['taiko', P.skin(P.TAIKO), [36]],
  ['timpani', P.skin(P.TIMPANI), [43]],
];
const unpitched: Array<[string, I.Inst]> = [
  ['kick', P.kick(P.KICK_TIGHT)], ['kickdeep', P.kick(P.KICK_DEEP)], ['boom', P.boom()], ['snare', P.snare(P.SNARE_CRISP)], ['snarebig', P.snare(P.SNARE_BIG)],
  ['claps', P.claps(5)], ['stomp', P.stomp()], ['hat', P.hat({ decay: 0.06, lo: 7000, metal: 0.7 })], ['shaker', P.shaker()], ['jingles', P.jingles()],
  ['anvil', P.metal('anvil')], ['plate', P.metal('plate')], ['wood', P.wood()], ['cymbal', P.cymbal()], ['riser', P.riser()], ['chimes', P.chimes()], ['hiss', P.hiss()],
];
const rows: string[] = [];
let worst = 0;
for (const [name, inst, ms] of pitched) {
  for (const m of ms) {
    const t0 = performance.now();
    const x = mono(inst({ t: 0, dur: 1.2, m, v: 0.8 }, new Rng(name + m)));
    const ms2 = performance.now() - t0;
    let pk = 0;
    let bad = 0;
    for (const s of x) {
      if (!Number.isFinite(s)) bad++;
      pk = Math.max(pk, Math.abs(s));
    }
    const seg = x.subarray(Math.floor(x.length * 0.15), Math.min(x.length, Math.floor(x.length * 0.15) + 24000));
    const f = pitchOf(seg, mtof(m) * 0.7, mtof(m) * 1.45);
    const cents = f > 0 ? 1200 * Math.log2(f / mtof(m)) : NaN;
    if (!['taiko', 'timpani', 'bell'].includes(name)) worst = Math.max(worst, Math.abs(cents));
    rows.push(`${name.padEnd(10)} m${m} ${cents.toFixed(1).padStart(7)} c  peak ${pk.toFixed(2)}  ${(x.length / 48000).toFixed(2)} s  ${ms2.toFixed(0)} ms${bad ? '  NaN ' + bad : ''}`);
  }
}
for (const [name, inst] of unpitched) {
  const x = mono(inst({ t: 0, dur: 1, m: 60, v: 0.8 }, new Rng(name)));
  let pk = 0;
  let bad = 0;
  let sum = 0;
  for (const s of x) {
    if (!Number.isFinite(s)) bad++;
    pk = Math.max(pk, Math.abs(s));
    sum += s;
  }
  rows.push(`${name.padEnd(10)} peak ${pk.toFixed(2)}  dc ${(sum / x.length).toFixed(4)}  ${(x.length / 48000).toFixed(2)} s${bad ? '  NaN ' + bad : ''}`);
}
console.log(rows.join('\n'));
console.log('worst pitch error', worst.toFixed(1), 'cents');
