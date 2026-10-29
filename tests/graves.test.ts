import { describe, expect, it } from 'vitest';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { GRAVE_CAP, GRAVE_OUT, GRAVE_TAG_Y, graveCopy, graveSide, placeGraves } from '../src/render/graves';

// Graveyards: the cairn spots on the bank (static, never in the line) and the tag's copy.

describe('graveyard placement', () => {
  const list = [
    { z: 395, name: "Widow's Bend", fell: 4 },
    { z: 812, name: 'The Throat', fell: 3 },
    { z: 1210.5, name: 'Last Pines', fell: 5 },
    { z: 1640, name: 'Cold Shelf', fell: 3 },
    { z: 2100, name: 'One Too Many', fell: 6 },
  ];

  it('stands every cairn on the bank, outside the corridor, on its hashed side', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const placed = placeGraves(c, list);
      expect(placed).toHaveLength(GRAVE_CAP);
      for (const g of placed) {
        const off = g.x - c.centerX(g.z);
        expect(Math.sign(off)).toBe(graveSide(g.z));
        expect(Math.abs(off)).toBeCloseTo(c.halfWidth(g.z) + GRAVE_OUT, 6);
        // Never inside the corridor (the run's line is fair whatever the graveyards are).
        expect(c.edgeExcess(g.x, g.z)).toBeGreaterThan(1);
        expect(g.y).toBeCloseTo(c.ground(g.x, g.z) + GRAVE_TAG_Y, 6);
      }
    }
  });

  it('keeps the same side for the same spot, and uses both sides', () => {
    expect(graveSide(395)).toBe(graveSide(395));
    const sides = new Set(Array.from({ length: 40 }, (_, i) => graveSide(100 + i * 37.3)));
    expect(sides).toEqual(new Set([-1, 1]));
  });

  it('places nothing for an empty list', () => {
    expect(placeGraves(courseFor(MOUNTAINS[0].seed), [])).toEqual([]);
  });
});

describe('graveyard tag copy', () => {
  it('reads the name over the count with its noun', () => {
    const c = graveCopy("Widow's Bend", 4);
    expect(c.name).toBe("Widow's Bend");
    expect(c.line).toBe('4 ghosts fell here');
    expect(graveCopy('  ', 3).name).toBe('Graveyard');
    expect(graveCopy('x', 1).line).toBe('1 ghost fell here');
    expect(graveCopy('x', 1200).line).toBe('1,200 ghosts fell here');
  });

  it('never uses a dash or a bare number', () => {
    for (const n of [3, 4, 12]) {
      const { line } = graveCopy('A', n);
      expect(line).not.toMatch(/[–—]/);
      expect(line).toMatch(/^\d[\d,]* ghosts? fell here$/);
    }
  });
});
