import { describe, expect, it } from 'vitest';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { LanternRow, rowCount, rowLayout, setLanternRow } from '../src/render/lanternrow';
import { getPalette } from '../src/render/palette';
import { Mood } from '../src/sim/chaos';

// Round 8, the light lane: the Lantern Row's world part (render/lanternrow.ts). A town hangs exactly the lanterns
// lit there, in row order, inside the run's width and over the masts' feet, and a fresh save hangs nothing.

describe('the Lantern Row in the world', () => {
  it('hangs what the save has lit, town by town, and nothing on a course that is not a named mountain', () => {
    setLanternRow({ pinecrest: 3, ember: 8, sakura: 0 });
    expect(rowCount('pinecrest')).toBe(3);
    expect(rowCount('ember')).toBe(8);
    expect(rowCount('sakura')).toBe(0);
    expect(rowCount('frostfang')).toBe(0);
    expect(rowCount(null)).toBe(0);
    setLanternRow({ pinecrest: 12 });
    expect(rowCount('pinecrest')).toBe(8);
  });

  it('lays a row from its first slot, evenly, inside the masts and under the wire', () => {
    expect(rowLayout(0, 8)).toEqual([]);
    for (let n = 1; n <= 8; n++) {
      const l = rowLayout(n, 9);
      expect(l.length).toBe(n);
      for (let i = 0; i < n; i++) {
        expect(Math.abs(l[i].x)).toBeLessThan(9);
        expect(l[i].y).toBeLessThan(0);
        if (i > 0) expect(l[i].x).toBeGreaterThan(l[i - 1].x);
      }
      // A part-lit row is the same row begun: its lanterns stand where a full row's first n do.
      const full = rowLayout(8, 9);
      for (let i = 0; i < n; i++) expect(l[i].x).toBeCloseTo(full[i].x, 9);
    }
  });

  it('builds two hung rows on a named mountain with lanterns lit, and none on a fresh save', () => {
    const m = MOUNTAINS.find((x) => x.id === 'ember')!;
    const c = courseFor(m.seed);
    const row = new LanternRow();
    row.setDetail('high');
    row.setCourse(c);
    setLanternRow({});
    row.update(0, 'run', getPalette(c.biome, Mood.None));
    expect(row.root.children.length).toBe(0);
    setLanternRow({ ember: 5 });
    row.update(0, 'run', getPalette(c.biome, Mood.None));
    expect(row.root.children.length).toBe(2);
    row.dispose();
  });
});
