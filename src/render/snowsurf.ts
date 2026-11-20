import type { Course, SectionKind } from '../sim/course';

// Round 8, snow as the hero material (V1): the three surfaces a player tells apart at a glance, read from
// what the sim already knows and drawn, never fed back. Ice is the sim's own (course.surface: a lake, the
// fork's strip, a patch). Groomed and powder are the course's sections: the made places (the start, a
// cruise, benches and switchbacks, a street, a bridge's deck, a tunnel, the square) are groomed lanes with
// corduroy, the wild ones (a bowl, a chute, a gully, a tree run, a ravine, a split, the terraces, a fork's
// channels, a leap's approach) lie in powder, and a leap's landing is groomed as ART.md 4 has it. Past the
// corridor's edge it is powder everywhere. The snow shader reads groomedAt per terrain row (terrain.ts
// aGroom), and the ruts read rutSurface per sample (trails.ts), so a sled's trench is deep in powder,
// shallow on a groomed lane and a scratch on ice.

const GROOMED: ReadonlySet<SectionKind> = new Set<SectionKind>(['start', 'cruise', 'benches', 'switchbacks', 'street', 'bridge', 'tunnel', 'finish']);

/** Metres over which one section's surface gives way to the next one's. */
export const GROOM_BLEND = 28;

const ease = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How groomed the corridor's floor is at sim z: 1 a groomed lane, 0 powder, between them over GROOM_BLEND
 *  metres where one section gives way to the next, and a leap's landing groomed from its foot to the end
 *  of its landing. */
export function groomedAt(c: Course, z: number): number {
  const sec = c.section(z);
  const here = GROOMED.has(sec.kind) ? 1 : 0;
  const before = sec.prev ? (GROOMED.has(sec.prev.kind) ? 1 : 0) : here;
  let g = before + (here - before) * ease(sec.z0, sec.z0 + GROOM_BLEND, z);
  for (const l of sec.ledges) {
    if (l.kind === 'leap' && z > l.foot) g = Math.max(g, ease(l.foot, l.land0, z) * (1 - ease(l.land1 - 24, l.land1, z)));
  }
  return g;
}

/** The snow a runner cuts at sim (x, z), for its rut: 2 ice, 1 a groomed lane, 0 powder (fractions where
 *  the groomed lane gives way to powder at a section's change or toward the bank). */
export function rutSurface(c: Course, x: number, z: number): number {
  if (c.surface(x, z).ice) return 2;
  // The bank past the corridor's edge is powder, whatever the lane is.
  const bank = ease(-1.5, 0.5, c.edgeExcess(x, z));
  return groomedAt(c, z) * (1 - bank);
}
