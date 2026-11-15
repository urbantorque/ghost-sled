import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GREAT_SCALE, airMotes, flameMatrix, glowMatrix, spiritFlameGeometry, spiritGlowGeometry } from '../src/render/spiritlights';

// Spirit lights (round 7, the shared lane): a spark and a great light share one flame batch, the great one told
// apart only by being pushed mirrored in x; the glow batch carries each light's scale and kind. Where a light is
// stays the sim's: the matrices put it exactly where they are asked to.

const m = new Matrix4();
const p = new Vector3();
const q = new Quaternion();
const s = new Vector3();

describe('spirit lights', () => {
  it('a spark is pushed as it is: no mirror, its own scale, where it hangs', () => {
    flameMatrix(m, 3, 7.5, -120, 0.8, 1.05, false);
    expect(m.determinant()).toBeGreaterThan(0);
    m.decompose(p, q, s);
    expect(p.toArray()).toEqual([3, 7.5, -120]);
    expect(s.x).toBeCloseTo(1.05, 6);
    expect(s.y).toBeCloseTo(1.05, 6);
  });

  it('a great light is half as big again and mirrored in x, which undone is the same turn', () => {
    const spark = flameMatrix(new Matrix4(), 0, 0, 0, 1.3, 1, false);
    flameMatrix(m, -2, 4, -60, 1.3, 1, true);
    expect(m.determinant()).toBeLessThan(0);
    const e = m.elements;
    // The shader's undo: column 0 negated.
    const un = new Matrix4().fromArray(e);
    un.elements[0] *= -1;
    un.elements[1] *= -1;
    un.elements[2] *= -1;
    expect(un.determinant()).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) expect(un.elements[i]).toBeCloseTo(spark.elements[i] * GREAT_SCALE, 6);
    expect([e[12], e[13], e[14]]).toEqual([-2, 4, -60]);
  });

  it('a glow carries the point of its light, its scale and what it is', () => {
    glowMatrix(m, 1, 2, -3, 1.1, 'great');
    expect([m.elements[12], m.elements[13], m.elements[14]]).toEqual([1, 2, -3]);
    expect(m.elements[0]).toBeCloseTo(1.1 * GREAT_SCALE, 6);
    expect(m.elements[10]).toBe(2);
    expect(glowMatrix(m, 0, 0, 0, 1, 'spark').elements[10]).toBe(1);
    expect(glowMatrix(m, 0, 0, 0, 1, 'mote').elements[10]).toBeLessThan(0);
  });

  it('threads a few motes between neighbours of an arc in the air, none across a short gap', () => {
    expect(airMotes(2)).toBe(0);
    expect(airMotes(3.5)).toBe(0);
    expect(airMotes(6)).toBeGreaterThanOrEqual(1);
    expect(airMotes(10.3)).toBe(3);
    expect(airMotes(40)).toBe(4);
  });

  it('costs no more than the old spark: one flame of 180 triangles, one quad of glow', () => {
    const g = spiritFlameGeometry();
    expect(g.index!.count / 3).toBeLessThanOrEqual(180);
    expect(g.getAttribute('aH')).toBeTruthy();
    expect(spiritGlowGeometry().getAttribute('position').count).toBe(6);
  });
});
