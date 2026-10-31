import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { recordFromString, replayRecord } from '../src/sim/replay';
import type { SimEvent } from '../src/sim/sim';

// The near-miss data tap: every near-miss style event carries the edge gap, the side, the nearest
// point on the obstacle, its kind and id (presentation only). Three pool ghosts per mountain are
// replayed through the real sim; ghostpool, determinism and purity prove nothing scored moved.

const dir = join(process.cwd(), 'src', 'data', 'ghosts');
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

type Style = Extract<SimEvent, { type: 'style' }>;

describe('near-miss event fields', () => {
  for (const f of files) {
    it(`${f}: gap, side, position, kind and id on every near miss`, () => {
      const pool = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { ghosts: Array<{ record: string; score: number }> };
      // A low, a middle and the top ghost: different lines, different speeds.
      const n = pool.ghosts.length;
      const picks = [pool.ghosts[Math.floor(n * 0.3)], pool.ghosts[Math.floor(n * 0.65)], pool.ghosts[n - 1]];
      let seen = 0;
      for (const g of picks) {
        const rec = recordFromString(g.record);
        const near: Style[] = [];
        let count = 0;
        const sim = replayRecord(rec, (s) => {
          for (const e of s.events) {
            if (e.type === 'style' && e.kind === 'nearMiss') {
              near.push(e);
              count++;
            }
          }
        });
        // Every near miss the stats counted produced exactly one event with the fields.
        expect(count).toBe(sim.stats.nearMisses);
        for (const e of near) {
          expect(e.points).toBeGreaterThan(0);
          expect(e.gap, `${f} gap`).toBeGreaterThanOrEqual(0);
          expect(e.gap!).toBeLessThan(1.15);
          expect([1, -1]).toContain(e.side);
          expect(Number.isFinite(e.x)).toBe(true);
          expect(Number.isFinite(e.z)).toBe(true);
          expect(typeof e.obs).toBe('string');
          expect(Number.isInteger(e.id)).toBe(true);
        }
        seen += near.length;
      }
      expect(seen).toBeGreaterThan(0);
    });
  }
});
