import { describe, expect, it } from 'vitest';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { InputRecorder, LogEvent, decodeLog, packInput } from '../src/sim/input';
import { Rng } from '../src/sim/prng';
import { RunRecord, decodeRecord, encodeRecord, fromBase64Url, recordFromString, recordToString, toBase64Url } from '../src/sim/replay';

describe('input log codec', () => {
  it('round-trips arbitrary input streams with events', () => {
    const rng = new Rng(42);
    for (let trial = 0; trial < 40; trial++) {
      const rec = new InputRecorder();
      const expected: number[] = [];
      const events = new Map<number, number[]>();
      let v = packInput(4, false, false);
      const n = rng.int(0, 5000);
      for (let t = 0; t < n; t++) {
        if (rng.chance(0.08)) v = packInput(rng.int(0, 8), rng.chance(0.3), rng.chance(0.1));
        if (rng.chance(0.002)) {
          rec.event(LogEvent.Revive);
          events.set(t, [LogEvent.Revive]);
        }
        rec.push(v);
        expected.push(v);
      }
      const dec = decodeLog(rec.encode());
      expect(Array.from(dec.inputs)).toEqual(expected);
      expect(dec.events).toEqual(events);
      expect(rec.tickCount).toBe(n);
    }
  });

  it('a 3-minute run with human-like input stays under 2 KB', () => {
    const rng = new Rng(7);
    const rec = new InputRecorder();
    let steer = 4;
    let action = false;
    let hold = 0;
    for (let t = 0; t < 60 * 180; t++) {
      if (hold-- <= 0) {
        // A busy player: a steering change every ~0.25 s on average, frequent crouches.
        steer = Math.max(0, Math.min(8, steer + rng.int(-3, 3)));
        if (rng.chance(0.25)) action = !action;
        hold = rng.int(4, 26);
      }
      rec.push(packInput(steer, action, rng.chance(0.002)));
    }
    const bytes = rec.encode();
    expect(bytes.length).toBeLessThan(2048);
  });

  it('rejects truncated logs', () => {
    const rec = new InputRecorder();
    for (let t = 0; t < 500; t++) rec.push(packInput(t % 9, false, false));
    const bytes = rec.encode();
    expect(() => decodeLog(new Uint8Array([0x04, 0x80]))).toThrow();
    expect(() => decodeLog(bytes.slice(0, bytes.length - 1))).toThrow();
    expect(() => decodeLog(bytes)).not.toThrow();
  });
});

describe('run record codec', () => {
  const sample = (): RunRecord => {
    const rec = new InputRecorder();
    for (let t = 0; t < 1234; t++) rec.push(packInput((t >> 5) % 9, (t & 64) !== 0, false));
    return {
      seed: 0xdeadbeef,
      chaos: { mood: Mood.Comet, event: ChaosEvent.Yeti, seed: 0x01020304 },
      sled: 3,
      inputs: rec.encode(),
      ticks: 1234,
      score: 45210,
      distance: 1888.4,
      name: 'Mila_on_Ice',
    };
  };

  it('round-trips through binary and base64url', () => {
    const r = sample();
    const back = decodeRecord(encodeRecord(r));
    expect(back).toEqual({ ...r, distance: 1888.4 });
    const s = recordToString(r);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(recordFromString(s)).toEqual(back);
  });

  it('base64url round-trips every length', () => {
    const rng = new Rng(1);
    for (let n = 0; n < 70; n++) {
      const data = Uint8Array.from({ length: n }, () => rng.int(0, 255));
      expect(Array.from(fromBase64Url(toBase64Url(data)))).toEqual(Array.from(data));
    }
  });

  it('sanitizes names and rejects garbage', () => {
    const r = { ...sample(), name: '<script>alert(1)</script>' };
    const back = decodeRecord(encodeRecord(r));
    expect(back.name).toMatch(/^[A-Za-z0-9 _.\-]+$/);
    expect(() => recordFromString('hello')).toThrow();
    expect(() => decodeRecord(new Uint8Array(30))).toThrow();
    const stale = encodeRecord(r);
    stale[3] = 99;
    expect(() => decodeRecord(stale)).toThrow();
  });

  it('a challenge link for a long run fits comfortably in a URL', () => {
    const r = sample();
    expect(recordToString(r).length).toBeLessThan(3000);
  });
});
