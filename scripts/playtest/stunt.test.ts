// The telemetry pilots, checked headless against the real Sim (no browser):
//   npx vitest run -c scripts/playtest/vitest.config.ts
// The repo's own vitest config only collects tests/, so this file has its own config.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadStunt, rideStunt, type StuntRide } from './stunt-sim';

/** FNV-1a over the stock pilots' source block (novice, mid, expert, line), CRLF-normalised. */
function stockFingerprint(): { length: number; hash: string } {
  const src = readFileSync(new URL('./telemetry.js', import.meta.url), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const i = src.indexOf('const P = { airStart');
  const j = src.indexOf('return { steer: lvl, action };', i);
  const block = src.slice(i, j);
  let h = 0x811c9dc5;
  for (let k = 0; k < block.length; k++) {
    h ^= block.charCodeAt(k);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return { length: block.length, hash: h.toString(16) };
}

describe('telemetry pilots', () => {
  it('keeps the stock pilots exactly as they were (before/after comparability)', () => {
    // The fingerprint of the block as it stood in fa7a4ef. Changing a stock pilot breaks the comparison
    // with older play-tests: add a new pilot instead.
    expect(stockFingerprint()).toEqual({ length: 5646, hash: '576d85a2' });
  });

  const make = loadStunt();

  it('rides the same run from the same seed', () => {
    const a = rideStunt(make, 1, 4321, 30);
    const b = rideStunt(make, 1, 4321, 30);
    expect(a.inputs.length).toBeGreaterThan(0);
    expect(b.inputs).toEqual(a.inputs);
  });

  it('reaches kickers, tier 2+ drifts, near misses and stomped tricks, and still crashes like a person', () => {
    const runs: StuntRide[] = [];
    for (let m = 0; m < 4; m++) for (const seed of [1234, 1235]) runs.push(rideStunt(make, m, seed, 150));
    const sum = (f: (r: StuntRide) => number): number => runs.reduce((s, r) => s + f(r), 0);
    expect(sum((r) => r.kickers)).toBeGreaterThanOrEqual(4);
    expect(sum((r) => r.boostPops)).toBeGreaterThanOrEqual(3);
    expect(sum((r) => r.drift[1] + r.drift[2])).toBeGreaterThanOrEqual(2);
    expect(sum((r) => r.drift[0] + r.drift[1] + r.drift[2])).toBeGreaterThanOrEqual(10);
    expect(sum((r) => r.nearMiss)).toBeGreaterThanOrEqual(8);
    expect(sum((r) => r.whisker)).toBeGreaterThanOrEqual(2);
    expect(sum((r) => r.spins + r.flips)).toBeGreaterThanOrEqual(8);
    expect(sum((r) => r.perfect)).toBeGreaterThan(sum((r) => r.clean + r.sketchy));
    // Drift holds stay in a human range (tier 3 on plain snow needs the longest).
    for (const r of runs) for (const h of r.driftHolds) expect(h).toBeLessThan(3.6);
    // Not invincible, not hopeless.
    expect(runs.filter((r) => r.cause !== 'timeout').length).toBeGreaterThanOrEqual(4);
    const secs = runs.map((r) => r.seconds).sort((a, b) => a - b);
    expect(secs[secs.length >> 1]).toBeGreaterThan(30);
  });
});
