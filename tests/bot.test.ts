import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BotProfile, playBot } from '../src/bot/bot';
import { NAME_MAX, ghostName, isValidGhostName, uniqueGhostName } from '../src/bot/names';
import { generatePool } from '../src/bot/pool';
import { ChaosEvent, Mood, PLAIN } from '../src/sim/chaos';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { Rng, hash32, hashString } from '../src/sim/prng';
import { decodeRecord, encodeRecord, recordFromString, replayRecord } from '../src/sim/replay';

// The ghost bot drives the real Sim, so its records must replay bit-exactly, stay small enough for
// pools and challenge links, and get better with skill.

const THREE_MIN = 60 * 60 * 3;

function profile(skill: number, i: number, sled = 0): BotProfile {
  return { skill, seed: hash32(0xb0, i, Math.round(skill * 1000)), sled, name: 'Test Bot' };
}

describe('ghost bot', () => {
  it('is deterministic: the same profile produces the same input bytes and result', () => {
    const cases = [
      { seed: MOUNTAINS[0].seed, chaos: PLAIN, p: profile(0.8, 1) },
      { seed: MOUNTAINS[2].seed, chaos: { mood: Mood.Comet, event: ChaosEvent.Yeti, seed: 0x1234 }, p: profile(0.5, 2, 1) },
      { seed: dailySeed('2026-10-24'), chaos: { mood: Mood.GlassIce, event: ChaosEvent.Avalanche, seed: 77 }, p: profile(0.2, 3, 4) },
    ];
    for (const c of cases) {
      const a = playBot(c.seed, c.chaos, c.p, THREE_MIN);
      const b = playBot(c.seed, c.chaos, c.p, THREE_MIN);
      expect(Array.from(b.inputs)).toEqual(Array.from(a.inputs));
      expect(b.score).toBe(a.score);
      expect(b.ticks).toBe(a.ticks);
      expect(b.distance).toBe(a.distance);
    }
  });

  it('replays exactly: replayRecord reproduces score, ticks and distance', () => {
    for (let i = 0; i < 4; i++) {
      const m = MOUNTAINS[i];
      const chaos = i % 2 ? PLAIN : { mood: Mood.Powder, event: ChaosEvent.GiftStorm, seed: hash32(i, 9) };
      const rec = playBot(m.seed, chaos, profile(0.3 + i * 0.2, i, i), THREE_MIN);
      const sim = replayRecord(rec);
      expect(sim.tick).toBe(rec.ticks);
      expect(sim.score).toBe(rec.score);
      expect(sim.distance).toBe(rec.distance);
      // The binary record round-trips the run as well.
      const back = decodeRecord(encodeRecord(rec));
      expect(Array.from(back.inputs)).toEqual(Array.from(rec.inputs));
      expect(back.score).toBe(rec.score);
    }
  });

  it('keeps a 3-minute input log under 2 KB at every skill', () => {
    let longest = 0;
    for (const skill of [0, 0.25, 0.5, 0.75, 1]) {
      for (let i = 0; i < 3; i++) {
        const rec = playBot(MOUNTAINS[i].seed, PLAIN, profile(skill, 10 + i), THREE_MIN);
        expect(rec.inputs.length, `skill ${skill} run ${i}`).toBeLessThan(2048);
        longest = Math.max(longest, rec.ticks);
        // Runs that crash early are short anyway; the rate must also fit a full 3 minutes.
        if (rec.ticks >= 60 * 60) expect((rec.inputs.length * THREE_MIN) / rec.ticks, `skill ${skill} run ${i} rate`).toBeLessThan(2048);
      }
    }
    expect(longest).toBeGreaterThan(60 * 60 * 2);
  });

  it('scores more with more skill', () => {
    const avg = (skill: number) => {
      let total = 0;
      for (let i = 0; i < 8; i++) total += playBot(MOUNTAINS[i % 4].seed, PLAIN, profile(skill, 100 + i), THREE_MIN).score;
      return total / 8;
    };
    const low = avg(0.05);
    const mid = avg(0.5);
    const high = avg(0.95);
    expect(mid).toBeGreaterThan(low * 1.5);
    expect(high).toBeGreaterThan(mid * 1.5);
  });
});

describe('ghost pool generation', () => {
  it('builds a Daily Mountain pool: sorted, uniquely named, spread out, and exactly replayable', () => {
    const seed = dailySeed('2026-10-24');
    const pool = generatePool(seed, 10, hashString('2026-10-24'));
    expect(pool.length).toBe(10);
    const names = new Set(pool.map((g) => g.name.toLowerCase()));
    expect(names.size).toBe(10);
    for (let i = 1; i < pool.length; i++) expect(pool[i].score).toBeGreaterThanOrEqual(pool[i - 1].score);
    // Beginner to expert, not ten copies of one rider.
    expect(pool[pool.length - 1].score).toBeGreaterThan(pool[0].score * 10);
    for (const g of pool) {
      expect(isValidGhostName(g.name), g.name).toBe(true);
      const r = recordFromString(g.record);
      expect(r.seed).toBe(seed);
      expect(r.name).toBe(g.name);
      expect(r.chaos.mood).toBe(g.mood);
      expect(r.chaos.event).toBe(g.event);
      expect(r.sled).toBe(g.sled);
      const sim = replayRecord(r);
      expect(sim.tick, g.name).toBe(g.ticks);
      expect(sim.score, g.name).toBe(g.score);
      expect(Math.round(sim.distance * 10) / 10, g.name).toBe(g.distance);
    }
  });

  it('is deterministic and handles an empty request', () => {
    const a = generatePool(MOUNTAINS[1].seed, 4, 99, { budgetRuns: 5, maxTicks: 60 * 60 });
    const b = generatePool(MOUNTAINS[1].seed, 4, 99, { budgetRuns: 5, maxTicks: 60 * 60 });
    expect(b).toEqual(a);
    expect(generatePool(MOUNTAINS[1].seed, 0, 99)).toEqual([]);
  });

  it('uses no Node APIs, since it also runs in a Web Worker', () => {
    const dir = join(process.cwd(), 'src', 'bot');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const code = readFileSync(join(dir, f), 'utf8');
      expect(code, f).not.toMatch(/from\s+['"](?:node:|(?:fs|path|os|url|worker_threads|child_process)['"/])/);
      expect(code, f).not.toMatch(/\brequire\s*\(|\bprocess\./);
    }
  });
});

describe('ghost names', () => {
  it('are friendly handles within the record rules', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 3000; i++) {
      const n = ghostName(rng);
      expect(n.length, n).toBeLessThanOrEqual(NAME_MAX);
      expect(n, n).toMatch(/^[A-Za-z0-9 _.\-]+$/);
      expect(isValidGhostName(n), n).toBe(true);
      // Word joins like "TundraPeak" hide words a chat filter would flag.
      expect(n.toLowerCase(), n).not.toMatch(/rape|nig|anal|tit|meth|ass|sex|cum|fag|poo|69|88|420|666/);
    }
  });

  it('are varied and unique within a pool', () => {
    const rng = new Rng(11);
    const taken = new Set<string>();
    const names: string[] = [];
    for (let i = 0; i < 200; i++) names.push(uniqueGhostName(rng, taken));
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(200);
    // Lots of distinct shapes, not one template.
    expect(names.some((n) => n.includes(' '))).toBe(true);
    expect(names.some((n) => n.includes('.'))).toBe(true);
    expect(names.some((n) => n.includes('_'))).toBe(true);
    expect(names.some((n) => /\d/.test(n))).toBe(true);
    for (const n of names) expect(isValidGhostName(n), n).toBe(true);
  });
});
