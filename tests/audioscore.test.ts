import { describe, expect, it } from 'vitest';
import { MARK_MERGE_M, marksOf } from '../src/audio/cues';
import { CUT_PENALTY_S, LAND_MIN_STEPS, cutTo, landingStep, nextSec, sec } from '../src/audio/form';
import { MODES, SONGS, THEME, type Song, degree, headOf, lengthAt, realize } from '../src/audio/score';
import { CLEAR, TITLE_STYLE } from '../src/audio/theory';

// The written score (round 6): the songs' shapes, chords that mean what they say in any mode, melodies that
// sit on their chords, mountains that differ, and the arrangement's form and landings.

const songs: Array<[string, Song]> = [...Object.entries(SONGS), ['theme', THEME]];

describe('the songs', () => {
  it('have an intro, an 8-bar verse and chorus, a 4-bar bridge, and lines inside their 8 bars', () => {
    for (const [name, s] of songs) {
      expect([s.intro.length, s.verse.length, s.chorus.length, s.bridge.length], name).toEqual([2, 8, 8, 4]);
      for (const line of [s.hook, s.answer]) {
        let end = 0;
        for (const n of line) {
          expect(n.s, name).toBeGreaterThanOrEqual(end);
          expect(n.s + n.l, name).toBeLessThanOrEqual(128);
          end = n.s + lengthAt(line, n);
        }
      }
      expect(headOf(s).length, name).toBeGreaterThanOrEqual(3);
    }
  });

  it("a hook's notes on the beat are tones of the chord under them (its 7th, 9th and 6th count)", () => {
    for (const [name, s] of Object.entries(SONGS)) {
      const mode = MODES[CLEAR[name as keyof typeof CLEAR].mode];
      let on = 0;
      let all = 0;
      for (const n of s.hook) {
        if (n.s % 4 !== 0) continue;
        const c = realize(mode, s.chorus[Math.floor(n.s / 16)]);
        const pc = (((degree(mode, n.d, n.a) - c.root) % 12) + 12) % 12;
        all++;
        if ([...c.tones.map((x) => x % 12), 2, 9, 10, 11].includes(pc)) on++;
      }
      // A passing note on a weak beat is fine; a hook that leans off its chords is not.
      expect(on / all, name).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('borrowed chords stay where they were written when a mood changes the mode', () => {
    const bVI = { d: 5, alt: -1 };
    expect(realize(MODES.major, bVI)).toMatchObject({ root: 8, tones: [0, 4, 7] });
    expect(realize(MODES.minor, bVI).root).toBe(8);
    expect(realize(MODES.phrygian, { d: 1, alt: -1, x: 7 }).root).toBe(1);
    // A diatonic chord follows the mode: the chord on degree 3 is major in major, minor in minor.
    expect(realize(MODES.major, { d: 3 }).tones.slice(0, 2)).toEqual([0, 4]);
    expect(realize(MODES.minor, { d: 3 }).tones.slice(0, 2)).toEqual([0, 3]);
    // A phrygian tonic's flat ninth is left out of an add9.
    expect(realize(MODES.phrygian, { d: 0, x: 'add9' }).tones).toEqual([0, 3, 7]);
  });

  it('each mountain has its own key, tempo and hook, and the title its own theme', () => {
    const keys = new Set(Object.values(CLEAR).map((s) => `${s.tonic % 12}${s.mode}`));
    const tempi = new Set(Object.values(CLEAR).map((s) => s.bpm));
    expect(keys.size).toBe(4);
    expect(tempi.size).toBe(4);
    const heads = new Set(songs.map(([, s]) => headOf(s).map((n) => `${n.s}:${n.d}`).join(',')));
    expect(heads.size).toBe(songs.length);
    expect(TITLE_STYLE.bpm).toBeLessThan(Math.min(...tempi));
  });
});

describe('the form', () => {
  it('runs intro, verse, chorus, verse; a breakdown is the bridge, then a verse', () => {
    let s = sec('intro');
    const names: string[] = [];
    for (let i = 0; i < 2 + 8 + 8 + 1; i++) {
      names.push(s.name);
      s = nextSec(s, false);
    }
    expect(names.slice(0, 2)).toEqual(['intro', 'intro']);
    expect(names[2]).toBe('verse');
    expect(names[10]).toBe('chorus');
    expect(names[18]).toBe('verse');
    expect(nextSec(sec('chorus', 3), true).name).toBe('bridge');
    let b = sec('bridge');
    for (let i = 0; i < 4; i++) b = nextSec(b, false);
    expect(b.name).toBe('verse');
    expect(nextSec(sec('finale', 2), true).name).toBe('finale');
  });

  it('lands on the beat nearest the target, past what is scheduled, on a downbeat or beat 3 or 4', () => {
    const dur = 60 / 112 / 4;
    for (const target of [1.4, 1.9, 2.2, 2.6, 3.1, 3.9]) {
      const p = landingStep(5, 0, dur, target);
      expect(p.step - 5).toBeGreaterThanOrEqual(LAND_MIN_STEPS);
      expect([0, 8, 12]).toContain(p.step & 15);
      expect(p.t).toBeCloseTo((p.step - 5) * dur, 9);
      // No allowed beat is nearer by more than the cut's penalty.
      for (let s = 5 + LAND_MIN_STEPS; s < 5 + 48; s += 4) {
        if (![0, 8, 12].includes(s & 15)) continue;
        expect(Math.abs((s - 5) * dur - target) + CUT_PENALTY_S).toBeGreaterThan(Math.abs(p.t - target) - 1e-9);
      }
    }
    expect(cutTo(40)).toBe(48);
    expect(cutTo(44)).toBe(48);
    expect(cutTo(48)).toBe(48);
  });
});

describe('landmarks', () => {
  it('every stage line, every set piece, the lift into the last stage, the finish; close ones merge into the bigger', () => {
    const stages = [
      { z0: 0, z1: 1000 },
      { z0: 1000, z1: 2000 },
      { z0: 2000, z1: 3000 },
    ];
    const marks = marksOf(stages, [{ z0: 400 }, { z0: 2000 + MARK_MERGE_M / 2 }, { z0: 2600 }]);
    expect(marks.map((m) => [m.z, m.kind])).toEqual([
      [400, 'drop'],
      [1000, 'drop'],
      [2000, 'lift'],
      [2600, 'drop'],
      [3000, 'finish'],
    ]);
  });
});
