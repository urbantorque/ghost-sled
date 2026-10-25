import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isValidGhostName } from '../src/bot/names';
import { PoolGhost } from '../src/bot/pool';
import { MOUNTAINS } from '../src/sim/mountains';
import { recordFromString, replayRecord } from '../src/sim/replay';
import { SIM_VERSION } from '../src/sim/sim';

// Bundled pools are produced by scripts/generate-ghosts.ts. Every stored ghost must still replay to
// exactly the score and distance it claims; if the sim changes, regenerate the pools.

interface PoolFile {
  version: number;
  simVersion: number;
  mountain: string;
  seed: number;
  ghosts: PoolGhost[];
}

const dir = join(process.cwd(), 'src', 'data', 'ghosts');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];

describe('bundled ghost pools', () => {
  if (!files.length) {
    it.skip('no pool files present (run npx tsx scripts/generate-ghosts.ts)', () => {});
    return;
  }

  it('has a pool for every mountain', () => {
    // The game falls back to an empty pool (no rivals at all) for a missing file.
    for (const m of MOUNTAINS) expect(files, m.id).toContain(`${m.id}.json`);
  });

  for (const f of files) {
    describe(f, () => {
      const pool = JSON.parse(readFileSync(join(dir, f), 'utf8')) as PoolFile;

      it('matches the current sim version and its mountain', () => {
        expect(pool.version).toBe(1);
        expect(pool.simVersion).toBe(SIM_VERSION);
        const m = MOUNTAINS.find((mm) => mm.id === pool.mountain);
        expect(m, pool.mountain).toBeDefined();
        expect(pool.seed).toBe(m?.seed);
        expect(f).toBe(`${pool.mountain}.json`);
        expect(pool.ghosts.length).toBeGreaterThan(0);
      });

      it('has unique names and is sorted by score', () => {
        const names = pool.ghosts.map((g) => g.name.toLowerCase());
        expect(new Set(names).size).toBe(names.length);
        for (const g of pool.ghosts) expect(isValidGhostName(g.name), g.name).toBe(true);
        for (let i = 1; i < pool.ghosts.length; i++) expect(pool.ghosts[i].score).toBeGreaterThanOrEqual(pool.ghosts[i - 1].score);
      });

      it('every record decodes and replays to its stored score and distance', () => {
        for (const g of pool.ghosts) {
          const r = recordFromString(g.record);
          expect(r.seed).toBe(pool.seed);
          expect(r.name).toBe(g.name);
          expect(r.sled).toBe(g.sled);
          expect(r.chaos.mood).toBe(g.mood);
          expect(r.chaos.event).toBe(g.event);
          expect(r.ticks).toBe(g.ticks);
          expect(r.score).toBe(g.score);
          expect(r.distance).toBe(g.distance);
          const sim = replayRecord(r);
          expect(sim.tick, g.name).toBe(g.ticks);
          expect(sim.score, g.name).toBe(g.score);
          expect(Math.round(sim.distance * 10) / 10, g.name).toBe(g.distance);
        }
      });
    });
  }
});
