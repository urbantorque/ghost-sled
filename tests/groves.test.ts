import { describe, expect, it } from 'vitest';
import { CHUNK_LEN, FOREST_LIMIT, courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { standable } from '../src/render/ground';
import { emberGrove, emberSlot, orchard, orchardBlocks } from '../src/render/groves';

// The groves (groves.ts): Ember's basalt in formations and Sakura's blossom in orchard rows. Everything
// they plant stands on the bank past the treeline, never on a wall or a ledge's face, the same on every
// call; Ember's rock comes at a rhythm, and Sakura's leaps land between orchards.

const ember = MOUNTAINS.find((m) => courseFor(m.seed).biome === 'volcanic')!;
const sakura = MOUNTAINS.find((m) => courseFor(m.seed).biome === 'blossom')!;

type Planted = { near: boolean; set: string; pick: number; side: number; e: number; z: number };

function plantAll(seed: number, grove: typeof emberGrove, dens: number, rich: boolean): Planted[] {
  const c = courseFor(seed);
  const out: Planted[] = [];
  for (let i = 1; i * CHUNK_LEN < c.finishZ; i++) grove(c, i, dens, rich, [], (near, set, pick, side, e, z) => out.push({ near, set, pick, side, e, z }));
  return out;
}

describe('groves', () => {
  for (const [name, m, grove] of [['Ember', ember, emberGrove], ['Sakura', sakura, orchard]] as const) {
    for (const rich of [true, false]) {
      it(`${name} (${rich ? 'Medium and High' : 'Low'}): plants only on standable bank past the treeline`, () => {
        const c = courseFor(m.seed);
        const list = plantAll(m.seed, grove, rich ? 1 : 0.45, rich);
        expect(list.length).toBeGreaterThan(200);
        for (const p of list) {
          expect(p.e, `${name} at ${p.z.toFixed(0)}`).toBeGreaterThanOrEqual(FOREST_LIMIT);
          expect(standable(c, p.z, p.e), `${name} at ${p.z.toFixed(0)}, ${p.e.toFixed(1)} out`).toBe(true);
          // Low draws each set's first variant only.
          if (!rich) expect(p.pick).toBe(0);
        }
      });
    }
    it(`${name}: is the same every time`, () => {
      const a = plantAll(m.seed, grove, 1, true);
      const b = plantAll(m.seed, grove, 1, true);
      expect(b).toEqual(a);
    });
  }

  it('Ember: no formation follows a formation on one side, and there is clear snow between', () => {
    const counts = { formation: 0, stand: 0, clear: 0 };
    for (const side of [-1, 1]) {
      for (let j = 0; j < 400; j++) {
        const k = emberSlot(j, side);
        counts[k]++;
        if (k === 'formation') expect(emberSlot(j - 1, side)).not.toBe('formation');
      }
    }
    expect(counts.formation / 800).toBeGreaterThan(0.12);
    expect(counts.clear / 800).toBeGreaterThan(0.2);
  });

  it('Sakura: every leap lands between orchards, pink', () => {
    const c = courseFor(sakura.seed);
    for (const l of c.ledges) {
      if (l.kind !== 'leap') continue;
      for (const side of [-1, 1]) {
        for (const b of orchardBlocks(c, side)) {
          if (b.z1 <= l.z + 30 || b.z0 >= l.z + 240) continue;
          expect(b.kind, `landing at ${Math.round(l.z)}`).toBe('orchard');
          expect(b.pale).toBe(false);
        }
      }
    }
  });
});
