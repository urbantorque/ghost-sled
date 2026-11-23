import { CHUNK_LEN, Course } from '../../../src/sim/course';
import type { Obstacle } from '../../../src/sim/course';
import { MOUNTAINS } from '../../../src/sim/mountains';
import { Kit, SceneDef, View, hash } from './kit';

// One of the five, drawn from its real sim course in the greybox's greys: the sim's own ground (the corridor, its
// banks, walls, falls, leaps, terraces and kickers), every obstacle where the sim puts it, and what the world
// stands beside a run on every one of the five (the start's stands and gate, the forest past the treeline, houses
// along a street, a gallery over a tunnel, the square's arch, the panorama of ranges over a sea of cloud). Nothing
// is invented that the five do not have, so a concept is seen beside what exists on equal terms.

const TREE = 0.32;
const ROCK = 0.46;
const HOUSE = 0.62;
const ROOF = 0.4;

function obstacle(k: Kit, o: Obstacle): void {
  const s = o.scale;
  switch (o.kind) {
    case 'pine':
    case 'charpine':
    case 'blossom':
      k.cyl(o.x, o.y, o.z, 0.18, 0.26, 2.2 * s, 0.3, 5);
      k.cone(o.x, o.y + 1.6 * s, o.z, 1.9 * s, 4.2 * s, TREE, 7);
      k.cone(o.x, o.y + 3.7 * s, o.z, 1.4 * s, 3.4 * s, TREE, 7);
      k.cone(o.x, o.y + 5.6 * s, o.z, 0.9 * s, 2.6 * s, TREE, 7);
      break;
    case 'spire':
    case 'basalt':
      k.cyl(o.x, o.y - 0.3, o.z, o.r * 0.55, o.r, o.h * s + 0.6, ROCK, 6, o.rot);
      break;
    case 'serac':
      k.box(o.x, o.y - 0.3, o.z, o.r * 2, o.h * s + 0.5, o.r * 1.6, 0.7, o.rot, 0.15, 0.1);
      break;
    case 'rock':
    case 'iceblock':
    case 'lavarock':
      k.sphere(o.x, o.y + o.h * 0.25, o.z, o.r * 1.1, ROCK, 0, 0.7);
      break;
    case 'log':
      k.bar(o.x, o.y + o.r, o.z, o.x2, o.y + o.r, o.z2, o.r, 0.34);
      break;
    case 'snowman':
      k.sphere(o.x, o.y + 0.45, o.z, 0.55, 0.92, 0);
      k.sphere(o.x, o.y + 1.2, o.z, 0.38, 0.92, 0);
      break;
    case 'lantern':
      k.box(o.x, o.y, o.z, 0.7, 1.4, 0.7, ROCK, o.rot);
      break;
    case 'pillar':
      k.cyl(o.x, o.y, o.z, 0.4, 0.45, 5, 0.4, 6);
      break;
  }
}

/** A tree of the forest past the treeline (the world's dressing, never a collider). */
function forestTree(k: Kit, x: number, y: number, z: number, s: number): void {
  k.cyl(x, y, z, 0.2, 0.3, 2.4 * s, 0.3, 5);
  k.cone(x, y + 1.8 * s, z, 2.1 * s, 4.6 * s, TREE, 6);
  k.cone(x, y + 4.2 * s, z, 1.5 * s, 3.6 * s, TREE, 6);
  k.cone(x, y + 6.2 * s, z, 0.9 * s, 2.8 * s, TREE, 6);
}

export function fiveScene(id: string, title: string, views: View[], sun: { az: number; el: number }): SceneDef {
  const m = MOUNTAINS.find((q) => q.id === id)!;
  const c = new Course(m.seed);
  const fin = c.finishZ;
  return {
    id,
    title,
    ground: (x, z) => c.ground(x, z),
    centre: (z) => c.centerX(z),
    line: (z) => c.safeX(z),
    half: 70,
    ahead: 900,
    props(k, z0, z1) {
      // Every obstacle the sim lays.
      for (let i = Math.max(0, Math.floor(z0 / CHUNK_LEN)); i * CHUNK_LEN < Math.min(z1, fin + 300); i++) {
        for (const o of c.chunk(i).obstacles) obstacle(k, o);
      }
      // The forest past the treeline, as the world dresses every bank: never on a wall, a fall or a street.
      for (let z = Math.max(0, z0); z < Math.min(z1, fin + 300); z += 3.2) {
        const sec = c.section(z);
        if (sec.kind === 'bridge' || sec.kind === 'street' || sec.kind === 'finish' || sec.kind === 'lake') continue;
        const lim = Math.max(c.edgeLimit(z), sec.kind === 'ravine' ? 9 : 0);
        for (const side of [-1, 1]) {
          for (let n = 0; n < 4; n++) {
            const r = hash(Math.round(z * 10), side + 3, n);
            if (r < 0.35) continue;
            const e = lim + 0.6 + n * 5.5 + hash(Math.round(z * 10), side, n + 9) * 5;
            const x = c.centerX(z) + side * (c.halfWidth(z) + e);
            const zz = z + hash(Math.round(z * 7), side, n) * 3;
            forestTree(k, x, c.ground(x, zz) - 0.3, zz, 0.9 + 0.5 * hash(n, Math.round(z), side));
          }
        }
      }
      // The start: a gate over the steep ramp with the word on it, grandstands down both banks.
      if (z0 < 150) {
        const g = c.ground(c.centerX(6), 6);
        for (const side of [-1, 1]) k.box(c.centerX(6) + side * (c.halfWidth(6) + 0.5), g - 1, 6, 1.4, 11, 1.4, 0.45);
        k.box(c.centerX(6), g + 8.2, 6, 2 * c.halfWidth(6) + 2.4, 1.8, 0.9, 0.5);
        for (let z = 16; z < 116; z += 10) {
          for (const side of [-1, 1]) {
            const x = c.centerX(z) + side * (c.halfWidth(z) + 3.5);
            for (let row = 0; row < 4; row++) k.box(x + side * row * 1.3, c.ground(x, z) - 0.5 + row * 0.9, z, 1.3, 1.2, 9.2, 0.55);
          }
        }
      }
      for (let z = Math.max(0, z0); z < Math.min(z1, fin + 260); z += 11) {
        const sec = c.section(z);
        // A street's houses, fronts at the barrier, roofs climbing the bank behind.
        if (sec.kind === 'street' || sec.kind === 'finish') {
          for (const side of [-1, 1]) {
            for (let row = 0; row < 2; row++) {
              const x = c.centerX(z) + side * (c.halfWidth(z) + c.edgeLimit(z) + 4 + row * 10);
              const h = 6 + 3 * hash(Math.round(z), side, row);
              k.house(x, c.ground(x, z) - 0.5, z, 8, 9, h, 3.2, HOUSE, ROOF);
            }
          }
        }
        // A tunnel's gallery: a roof on pillars at the section's whole length.
        if (sec.kind === 'tunnel') {
          const y = c.baseY(z);
          const hw = c.halfWidth(z) + 3;
          k.box(c.centerX(z), y + 8.5, z, 2 * hw + 2, 1.2, 9, 0.42);
          for (const side of [-1, 1]) k.box(c.centerX(z) + side * hw, y - 1, z, 1.2, 10, 1.2, 0.42);
        }
      }
      // The finish: an arch over the line, the square's stands.
      if (z1 > fin - 100 && z0 < fin + 50) {
        const g = c.ground(c.centerX(fin), fin);
        for (const side of [-1, 1]) k.box(c.centerX(fin) + side * (c.halfWidth(fin) + 1), g - 1, fin, 2, 14, 2, 0.45);
        k.box(c.centerX(fin), g + 11, fin, 2 * c.halfWidth(fin) + 4, 2.5, 1.2, 0.5);
      }
      // A leap's shoulders: outcrops either side of the lip, off the line.
      for (const l of c.leaps) {
        if (l.z < z0 || l.z > z1) continue;
        for (const side of [-1, 1]) {
          const x = c.centerX(l.z) + side * (c.halfWidth(l.z) + 2);
          k.box(x, c.ground(x, l.z) - 2, l.z - 6, 7, 9, 10, ROCK, side * 0.3);
        }
      }
    },
    far(k, cam) {
      // The panorama every one of the five shares: faceted ranges in three depth steps over a sea of cloud.
      const sea = cam.y - 520;
      k.sheet(cam.x - 30000, cam.z - 2000, cam.x + 30000, cam.z + 30000, sea, 0.93);
      for (let i = 0; i < 70; i++) {
        const a = (hash(i, 7) - 0.5) * 2.6;
        const d = 3500 + hash(i, 8) * 9000;
        const x = cam.x + Math.sin(a) * d;
        const z = cam.z + Math.cos(a) * d;
        const h = 500 + hash(i, 9) * 1400 * (d / 9000);
        const r = h * (0.9 + hash(i, 10));
        k.peak(x, sea - 50, z, r, h + 50, 0.55 + 0.3 * (d / 12500), 5, hash(i, 11) * 6);
      }
      // The sea of cloud's billows.
      for (let i = 0; i < 40; i++) {
        const a = (hash(i, 17) - 0.5) * 2.4;
        const d = 1200 + hash(i, 18) * 6000;
        k.sphere(cam.x + Math.sin(a) * d, sea, cam.z + Math.cos(a) * d, 120 + hash(i, 19) * 260, 0.95, 0, 0.35);
      }
    },
    look: { zenith: 0.58, horizon: 0.9, fog: 0.88, fogNear: 120, fogFar: 9000, sunAz: sun.az, sunEl: sun.el, sun: 2.4, ambient: 0.95 },
    views,
  };
}

/** Three of the five: two of their openings (which are one opening) and a place on each. */
export const FIVE: SceneDef[] = [
  fiveScene(
    'pinecrest',
    'Pinecrest',
    [
      { key: 'opening', name: 'The start ramp and the run-in', z: 70, speed: 24 },
      { key: 'place', name: 'Mirror Lake', z: 1890, speed: 32 },
    ],
    { az: 31, el: 30 },
  ),
  fiveScene(
    'frostfang',
    'Frostfang Glacier',
    [
      { key: 'opening', name: 'The start ramp and the run-in', z: 70, speed: 24 },
      { key: 'place', name: 'The ravine below the first leap', z: 960, speed: 34 },
    ],
    { az: -35, el: 23 },
  ),
  fiveScene(
    'sakura',
    'Sakura Ridge',
    [
      { key: 'opening', name: 'The start ramp and the run-in', z: 70, speed: 24 },
      { key: 'place', name: 'Petal Steps, the terraces', z: 930, speed: 30 },
    ],
    { az: -24, el: 29 },
  ),
];
