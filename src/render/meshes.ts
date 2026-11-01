import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ObstacleKind } from '../sim/course';
import { FRIEND_HEX as MINT_HEX } from '../game/beats';
import { Palette } from './palette';

// Every mesh in the game is built here from primitives. Parts are flat-shaded (non-indexed) and
// carry vertex colours, so the shared toon shader can light them consistently (ART.md section 3).

let seedState = 12345;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 4294967296;
}
function reseed(s: number): void {
  seedState = s >>> 0;
}

interface PartOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  jitter?: number;
}

function part(geo: BufferGeometry, color: Color | string, o: PartOpts = {}): BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (o.jitter) {
    // Jitter shared vertex positions consistently so faces stay closed.
    const p = g.getAttribute('position') as BufferAttribute;
    const map = new Map<string, [number, number, number]>();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let d = map.get(key);
      if (!d) {
        d = [(rnd() - 0.5) * o.jitter, (rnd() - 0.5) * o.jitter, (rnd() - 0.5) * o.jitter];
        map.set(key, d);
      }
      p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
  }
  const m = new Matrix4().compose(
    new Vector3(...(o.pos ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))),
    new Vector3(...(o.scale ?? [1, 1, 1])),
  );
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const col = color instanceof Color ? color : new Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('merge failed');
  g.computeBoundingSphere();
  return g;
}

/** Darken/tint a colour for faceted variety. */
function shade(c: Color, k: number): Color {
  return c.clone().multiplyScalar(k);
}

const SNOW = new Color('#F4F7FF');
const WOOD = new Color('#8A5A3C');

/** Paints a value gradient into a part's vertex colours, k0 at height y0 rising to k1 at y1, and gives
 *  each facet its own small value step (+-facet/2), so a big flat-shaded cone seen up close still
 *  reads as painted rather than as one flat plane. */
function paint(g: BufferGeometry, y0: number, y1: number, k0: number, k1: number, facet: number): BufferGeometry {
  const pos = g.getAttribute('position') as BufferAttribute;
  const col = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const f = 1 + (rnd() - 0.5) * facet;
    for (let j = i; j < i + 3 && j < pos.count; j++) {
      const t = Math.max(0, Math.min(1, (pos.getY(j) - y0) / (y1 - y0)));
      const k = (k0 + (k1 - k0) * t) * f;
      col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
    }
  }
  return g;
}

export function pineGeometry(p: Palette, variant = 0): BufferGeometry {
  reseed(101 + variant);
  const tall = p.tall;
  const parts: BufferGeometry[] = [part(new CylinderGeometry(0.16, 0.24, 1.4, 6), WOOD, { pos: [0, 0.7, 0] })];
  const tiers = [
    { r: 1.35, h: 2.6, y: 1.9 },
    { r: 1.05, h: 2.2, y: 3.3 },
    { r: 0.72, h: 1.9, y: 4.6 },
  ];
  tiers.forEach((t, i) => {
    const col = i % 2 === 0 ? tall : shade(tall, 0.82);
    // Each tier darkens toward its skirt and lightens toward its tip, and the whole tree is darker at
    // the base than at the top (painted value structure for the results shot's close range).
    const yb = t.y - t.h / 2;
    const cone = part(new ConeGeometry(t.r, t.h, 7, 1), col, { pos: [0, t.y, 0], rot: [0, rnd() * 3, 0], jitter: 0.12 });
    parts.push(paint(cone, yb, yb + t.h, 0.74 + i * 0.12, 1.06 + i * 0.1, 0.14));
    parts.push(part(new ConeGeometry(t.r * 0.62, t.h * 0.42, 7, 1), SNOW, { pos: [0, t.y + t.h * 0.3, 0], rot: [0, rnd() * 3, 0], jitter: 0.06 }));
  });
  return merge(parts);
}

export function charPineGeometry(p: Palette): BufferGeometry {
  reseed(202);
  const parts: BufferGeometry[] = [part(new CylinderGeometry(0.14, 0.26, 4.6, 5), p.tall, { pos: [0, 2.3, 0], jitter: 0.06 })];
  for (let i = 0; i < 4; i++) {
    const y = 2.2 + i * 0.8;
    const a = rnd() * 6.28;
    parts.push(
      part(new CylinderGeometry(0.05, 0.08, 1.2 - i * 0.18, 4), p.tallDark, {
        pos: [Math.cos(a) * 0.45, y, Math.sin(a) * 0.45],
        rot: [0, -a, 1.0],
      }),
    );
  }
  parts.push(part(new ConeGeometry(0.4, 0.5, 5), SNOW, { pos: [0, 4.75, 0] }));
  return merge(parts);
}

export function blossomGeometry(p: Palette): BufferGeometry {
  reseed(303);
  const parts: BufferGeometry[] = [part(new CylinderGeometry(0.18, 0.3, 2.6, 6), new Color('#5A3A3E'), { pos: [0, 1.3, 0], jitter: 0.05 })];
  const pinkA = p.tall;
  const pinkB = shade(p.tall, 0.85).lerp(new Color('#FFFFFF'), 0.15);
  const blobs = [
    [0, 3.4, 0, 1.5],
    [1.0, 2.9, 0.3, 1.05],
    [-0.9, 3.0, -0.4, 1.1],
    [0.3, 4.3, -0.5, 1.0],
    [-0.4, 3.9, 0.8, 0.95],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    parts.push(part(new IcosahedronGeometry(r, 0), i % 2 ? pinkB : pinkA, { pos: [x, y, z], rot: [rnd(), rnd(), rnd()], jitter: 0.18 }));
  });
  parts.push(part(new IcosahedronGeometry(0.9, 0), SNOW, { pos: [0, 4.4, 0], scale: [1.3, 0.45, 1.3], jitter: 0.1 }));
  return merge(parts);
}

export function rockGeometry(base: Color, lit: Color, variant: number): BufferGeometry {
  reseed(404 + variant * 17);
  const parts = [
    part(new IcosahedronGeometry(1, 0), base, { pos: [0, 0.35, 0], scale: [1.15, 0.85, 1.0], rot: [rnd(), rnd() * 3, rnd()], jitter: 0.35 }),
    part(new IcosahedronGeometry(0.62, 0), lit, { pos: [0.45, 0.25, 0.35], rot: [rnd(), rnd(), rnd()], jitter: 0.2 }),
    part(new IcosahedronGeometry(0.75, 0), SNOW, { pos: [0, 0.95, 0], scale: [1.05, 0.32, 0.95], jitter: 0.15 }),
  ];
  return merge(parts);
}

/** One hexagonal ice crystal: a prism with a pointed tip, standing on `pos` and leaning by `rot`. */
function crystal(col: Color, r: number, h: number, pos: [number, number, number], rot: [number, number, number]): BufferGeometry {
  const tip = r * 1.7;
  const g = merge([part(new CylinderGeometry(r * 0.9, r, h, 6), col, { pos: [0, h / 2, 0] }), part(new ConeGeometry(r * 0.9, tip, 6), shade(col, 1.12), { pos: [0, h + tip / 2, 0] })]);
  return g.applyMatrix4(new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(1, 1, 1)));
}

/** Glacier hazard: a dark faceted boulder bristling with leaning ice crystals (ART.md: rocks are
 *  chunky crystals). Boxes with flat snow lids read as concrete blocks. */
export function iceBlockGeometry(p: Palette): BufferGeometry {
  reseed(505);
  const rock = shade(p.low, 0.62);
  return merge([
    part(new IcosahedronGeometry(0.78, 0), rock, { pos: [0, 0.26, 0], scale: [1.22, 0.72, 1.06], rot: [rnd(), rnd() * 3, rnd()], jitter: 0.26 }),
    part(new IcosahedronGeometry(0.5, 0), shade(p.low, 0.8), { pos: [0.48, 0.16, 0.3], rot: [rnd(), rnd(), rnd()], jitter: 0.16 }),
    crystal(p.low, 0.27, 0.72, [-0.16, 0.22, 0.04], [0.12, 0.3, 0.24]),
    crystal(p.lowLit, 0.21, 0.52, [0.26, 0.24, -0.14], [-0.22, 1.0, -0.44]),
    crystal(shade(p.lowLit, 0.92), 0.17, 0.38, [0.1, 0.14, 0.42], [0.62, 0.2, -0.12]),
    crystal(p.low, 0.15, 0.34, [-0.56, 0.08, -0.26], [-0.38, 0.6, 0.64]),
    crystal(p.lowLit, 0.11, 0.22, [0.6, 0.06, -0.42], [-0.5, 0, -0.8]),
    part(new IcosahedronGeometry(0.42, 0), SNOW, { pos: [0.3, 0.62, 0.16], scale: [1.25, 0.28, 1.0], jitter: 0.1 }),
    part(new IcosahedronGeometry(0.3, 0), SNOW, { pos: [-0.5, 0.42, 0.28], scale: [1.1, 0.3, 0.9], jitter: 0.08 }),
  ]);
}

export function spireGeometry(p: Palette): BufferGeometry {
  reseed(606);
  return merge([
    part(new ConeGeometry(0.95, 5.5, 5, 2), p.tall, { pos: [0, 2.75, 0], jitter: 0.25 }),
    part(new ConeGeometry(0.55, 3.2, 5, 1), p.tallDark, { pos: [0.6, 1.6, 0.3], rot: [0, 0, -0.25], jitter: 0.15 }),
    part(new ConeGeometry(0.45, 2.4, 5, 1), shade(p.tall, 1.15), { pos: [-0.55, 1.2, -0.2], rot: [0.2, 0, 0.3], jitter: 0.1 }),
  ]);
}

export function seracGeometry(p: Palette): BufferGeometry {
  reseed(707);
  // An ice tower as a cluster of leaning crystals with pointed tips, rising out of a dark faceted
  // base and a drift of snow. Any flat top (a block with a snow lid) reads as concrete.
  return merge([
    part(new IcosahedronGeometry(1.25, 0), shade(p.tallDark, 0.8), { pos: [0.1, 0.35, 0.1], scale: [1.35, 0.6, 1.2], rot: [rnd(), rnd() * 3, rnd()], jitter: 0.3 }),
    crystal(p.tall, 0.95, 3.1, [0, 0.2, 0], [0.06, 0.3, -0.1]),
    crystal(p.tallDark, 0.68, 2.2, [1.15, 0.1, 0.55], [0.16, 0.9, 0.3]),
    crystal(shade(p.tall, 1.1), 0.55, 1.6, [-1.1, 0.05, -0.45], [-0.2, 0.4, 0.42]),
    crystal(shade(p.tallDark, 1.2), 0.42, 1.1, [0.3, 0.05, -1.1], [-0.42, 1.3, -0.12]),
    crystal(shade(p.tall, 0.92), 0.36, 0.9, [-0.55, 0.05, 1.0], [0.5, 0.2, 0.3]),
    part(new IcosahedronGeometry(1.5, 0), SNOW, { pos: [0, 0.05, 0], scale: [1.3, 0.3, 1.2], jitter: 0.2 }),
    part(new IcosahedronGeometry(0.5, 0), SNOW, { pos: [0.75, 1.15, 0.35], scale: [1.1, 0.35, 0.9], jitter: 0.1 }),
  ]);
}

export function basaltGeometry(p: Palette): BufferGeometry {
  reseed(808);
  const parts: BufferGeometry[] = [];
  const cols = [
    [0, 0, 0.7, 5.5],
    [0.9, 0.3, 0.55, 4.2],
    [-0.75, 0.5, 0.5, 3.6],
    [0.2, -0.8, 0.5, 4.8],
  ];
  cols.forEach(([x, z, r, h], i) => {
    parts.push(part(new CylinderGeometry(r, r * 1.05, h, 6), i % 2 ? p.tallDark : p.tall, { pos: [x, h / 2, z], rot: [0, rnd(), 0] }));
    parts.push(part(new CylinderGeometry(r * 0.95, r, 0.12, 6), SNOW, { pos: [x, h + 0.06, z] }));
  });
  return merge(parts);
}

export function lavaRockGeometry(p: Palette): BufferGeometry {
  reseed(909);
  // Hazards are never warm (ART.md section 1): a chunky dark basalt boulder with a cooled, dull
  // plum seam, not a glowing ember. The lava glow belongs far below, on the horizon.
  const rock = shade(p.low, 0.85);
  return merge([
    part(new IcosahedronGeometry(1, 0), rock, { pos: [0, 0.35, 0], scale: [1.2, 0.8, 1.05], rot: [rnd(), rnd(), rnd()], jitter: 0.4 }),
    part(new IcosahedronGeometry(0.55, 0), shade(p.low, 1.15), { pos: [0.6, 0.18, -0.35], rot: [rnd(), rnd(), rnd()], jitter: 0.18 }),
    part(new IcosahedronGeometry(0.4, 0), new Color('#3A2234'), { pos: [0.55, 0.08, 0.5], scale: [1, 0.4, 1], jitter: 0.1 }),
    part(new IcosahedronGeometry(0.7, 0), SNOW, { pos: [0, 0.92, 0], scale: [1.0, 0.25, 0.9], jitter: 0.12 }),
  ]);
}

export function lanternGeometry(): BufferGeometry {
  const stone = new Color('#8A8496');
  const dark = new Color('#5E586C');
  return merge([
    part(new BoxGeometry(0.9, 0.25, 0.9), dark, { pos: [0, 0.12, 0] }),
    part(new CylinderGeometry(0.16, 0.2, 0.6, 6), stone, { pos: [0, 0.55, 0] }),
    part(new BoxGeometry(0.7, 0.5, 0.7), stone, { pos: [0, 1.05, 0] }),
    // A pale moonlit paper window: the stone lantern is a hazard, so its light is cold (props.ts
    // lights only this part).
    part(new BoxGeometry(0.46, 0.3, 0.72), new Color('#BFE2FF'), { pos: [0, 1.05, 0] }),
    part(new ConeGeometry(0.62, 0.38, 4), dark, { pos: [0, 1.48, 0], rot: [0, Math.PI / 4, 0] }),
    part(new ConeGeometry(0.5, 0.18, 4), SNOW, { pos: [0, 1.6, 0], rot: [0, Math.PI / 4, 0] }),
  ]);
}

export function pillarGeometry(p: Palette): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.34, 0.4, 5.2, 8), p.accentProp, { pos: [0, 2.6, 0] }),
    part(new CylinderGeometry(0.5, 0.5, 0.35, 8), new Color('#2A2230'), { pos: [0, 0.17, 0] }),
  ]);
}

/** Torii crossbeam spanning two pillars; unit width along x, scaled per gate. */
export function gateBeamGeometry(p: Palette): BufferGeometry {
  return merge([
    part(new BoxGeometry(1, 0.42, 0.55), p.accentProp, { pos: [0, 4.4, 0] }),
    part(new BoxGeometry(1.25, 0.32, 0.7), new Color('#2A2230'), { pos: [0, 5.2, 0] }),
    part(new BoxGeometry(1.2, 0.12, 0.62), SNOW, { pos: [0, 5.42, 0] }),
  ]);
}

/** Log along local x, unit length, scaled per instance. */
export function logGeometry(p?: Palette): BufferGeometry {
  reseed(1111);
  // Hazards are never warm (ART.md section 1): weathered grey-violet bark and a cold grey cut end, so
  // a log reads as a hard dark bar and never as an orange plank or crate. The bark is mid-dark rather
  // than near-black, so its lit facets stand a clear step above its shaded ones (two-tone, not a flat
  // grey slab), and its faceted, jittered barrel, bevelled ends and the drifts
  // banked against its foot (it lies in the snow, not on it) make it read as a crafted prop. The log
  // is unit length along x and stretched per instance, so the bevels are thin in that axis.
  // On Ember Peak (the one biome with embers) it is a fallen column of charred basalt instead: a
  // near-black hexagonal prism with uneven facets and a dull plum-grey break, still under its snow cap.
  // A plain grey cylinder did not belong to the biome.
  const charred = !!p && p.embers > 0;
  const sides = charred ? 6 : 9;
  const bark = new Color(charred ? '#2E2836' : '#4F4459');
  const barkDark = new Color(charred ? '#1D1923' : '#3A3144');
  const cut = new Color(charred ? '#4E4658' : '#8A8292');
  const footSnow = new Color('#C4C2E6');
  const barrel = part(new CylinderGeometry(0.42, 0.42, 0.96, sides, 3), bark, { rot: [0, 0, Math.PI / 2], pos: [0, 0.4, 0], jitter: charred ? 0.08 : 0.05 });
  return merge([
    charred ? paint(barrel, 0.0, 0.82, 0.78, 1.18, 0.4) : barrel,
    // Bevelled ends: a short taper from the barrel down to the cut face.
    part(new CylinderGeometry(0.42, 0.35, 0.025, sides), barkDark, { rot: [0, 0, Math.PI / 2], pos: [0.4925, 0.4, 0] }),
    part(new CylinderGeometry(0.35, 0.42, 0.025, sides), barkDark, { rot: [0, 0, Math.PI / 2], pos: [-0.4925, 0.4, 0] }),
    part(new CylinderGeometry(0.33, 0.33, 1.012, sides), cut, { rot: [0, 0, Math.PI / 2], pos: [0, 0.4, 0] }),
    part(new CylinderGeometry(0.13, 0.13, 1.02, 7), new Color(charred ? '#3A3344' : '#5A5266'), { rot: [0, 0, Math.PI / 2], pos: [0, 0.4, 0] }),
    // A rounded drift of snow along the top rather than a flat board.
    part(new CylinderGeometry(0.3, 0.3, 0.94, 7), SNOW, { rot: [0, 0, Math.PI / 2], pos: [0, 0.74, 0], scale: [0.42, 1, 0.78], jitter: 0.04 }),
    // Drifts banked against its foot on both sides, a cool step darker than open snow: the shade
    // the log throws on the snow it lies in, a contact shadow that holds in any light.
    part(new CylinderGeometry(0.22, 0.22, 0.98, 7), footSnow, { rot: [0, 0, Math.PI / 2], pos: [0, 0.04, 0.38], scale: [0.55, 1, 1.25], jitter: 0.04 }),
    part(new CylinderGeometry(0.22, 0.22, 0.98, 7), footSnow, { rot: [0, 0, Math.PI / 2], pos: [0, 0.04, -0.38], scale: [0.55, 1, 1.25], jitter: 0.04 }),
  ]);
}

export function snowmanGeometry(): BufferGeometry {
  return merge([
    part(new SphereGeometry(0.62, 10, 8), SNOW, { pos: [0, 0.55, 0] }),
    part(new SphereGeometry(0.45, 10, 8), SNOW, { pos: [0, 1.25, 0] }),
    part(new SphereGeometry(0.32, 10, 8), SNOW, { pos: [0, 1.78, 0] }),
    part(new ConeGeometry(0.06, 0.32, 6), new Color('#FF8A2A'), { pos: [0, 1.8, -0.42], rot: [-Math.PI / 2, 0, 0] }),
    part(new SphereGeometry(0.045, 6, 4), new Color('#1A1A28'), { pos: [-0.11, 1.9, -0.28] }),
    part(new SphereGeometry(0.045, 6, 4), new Color('#1A1A28'), { pos: [0.11, 1.9, -0.28] }),
    part(new CylinderGeometry(0.03, 0.03, 0.8, 4), WOOD, { pos: [0.62, 1.38, 0], rot: [0, 0, 1.0] }),
    part(new CylinderGeometry(0.03, 0.03, 0.8, 4), WOOD, { pos: [-0.62, 1.38, 0], rot: [0, 0, -1.0] }),
    part(new TorusGeometry(0.34, 0.08, 6, 12), new Color('#3E7FD8'), { pos: [0, 1.5, 0], rot: [Math.PI / 2, 0, 0] }),
    part(new CylinderGeometry(0.24, 0.26, 0.3, 10), new Color('#1A1A28'), { pos: [0, 2.12, 0] }),
  ]);
}

export function giftGeometry(golden: boolean): BufferGeometry {
  const box = golden ? new Color('#FFE38A') : new Color('#FFD34D');
  const ribbon = golden ? new Color('#8FF3E4') : new Color('#FF4D2E');
  const s = golden ? 1.35 : 1;
  return merge([
    part(new BoxGeometry(0.62 * s, 0.56 * s, 0.62 * s), box),
    part(new BoxGeometry(0.66 * s, 0.58 * s, 0.14 * s), ribbon),
    part(new BoxGeometry(0.14 * s, 0.58 * s, 0.66 * s), ribbon),
    // A big puffy bow (ART.md section 3): two plump loops leaning out from a round knot.
    part(new TorusGeometry(0.14 * s, 0.06 * s, 7, 12), ribbon, { pos: [-0.13 * s, 0.36 * s, 0], rot: [0, Math.PI / 2, 0.62] }),
    part(new TorusGeometry(0.14 * s, 0.06 * s, 7, 12), ribbon, { pos: [0.13 * s, 0.36 * s, 0], rot: [0, Math.PI / 2, -0.62] }),
    part(new SphereGeometry(0.075 * s, 8, 6), ribbon, { pos: [0, 0.31 * s, 0] }),
  ]);
}

/** Lantern Night's trail lantern: a dark post at the treeline with a small hooded lamp, its window a
 *  bright amber (props.ts lights only that part, and draws a soft halo round it), so the far end of
 *  the corridor holds a few faint warm lights instead of a dead void. */
export function lanternPostGeometry(): BufferGeometry {
  const post = new Color('#3A3046');
  return merge([
    part(new CylinderGeometry(0.07, 0.09, 2.6, 6), post, { pos: [0, 1.3, 0] }),
    part(new BoxGeometry(0.42, 0.06, 0.06), post, { pos: [0.14, 2.52, 0] }),
    part(new BoxGeometry(0.22, 0.26, 0.22), new Color('#FFB45E'), { pos: [0.3, 2.32, 0] }),
    part(new ConeGeometry(0.2, 0.14, 4), post, { pos: [0.3, 2.52, 0], rot: [0, Math.PI / 4, 0] }),
    part(new ConeGeometry(0.17, 0.08, 4), SNOW, { pos: [0.3, 2.6, 0], rot: [0, Math.PI / 4, 0] }),
  ]);
}

/** How high the km arch's beam rides over the snow at its posts (metres to its top). */
export const ARCH_HEIGHT = 7;

/** A km arch's paper lantern on its drop (cord, cap and globe, hanging from the origin), amber or
 *  cream: the same on every arch, so each is built once and copied along every string. */
const archDrops: Array<BufferGeometry | null> = [null, null];

function archDrop(cream: boolean): BufferGeometry {
  const k = cream ? 1 : 0;
  let g = archDrops[k];
  if (!g) {
    const rope = new Color('#3A3046');
    const c = cream ? new Color('#FFF1D6').multiplyScalar(2.2) : new Color('#FFB45E').multiplyScalar(2.8);
    g = merge([
      part(new BoxGeometry(0.03, 0.22, 0.03), rope, { pos: [0, -0.11, 0] }),
      part(new SphereGeometry(0.19, 8, 6), c, { pos: [0, -0.42, 0], scale: [1, 1.2, 1] }),
      part(new CylinderGeometry(0.08, 0.1, 0.07, 6), rope, { pos: [0, -0.18, 0] }),
    ]);
    // (Copies are only translated: no bounds to carry along.)
    g.boundingSphere = null;
    archDrops[k] = g;
  }
  return g;
}

/** A kilometre arch over the run (render only, no collider): two snow-capped timber posts `span`
 *  metres apart (centre to centre) standing just outside the corridor, a beam across with a soft
 *  drift of snow along its top, corner braces, a small evergreen wreath at its middle and a sagging
 *  string of round paper lanterns under it. The lanterns' colour is pushed well past 1 so even their
 *  shaded sides (the chase camera often looks into the sun) clear the bloom threshold on Medium and
 *  High through the plain toon material (no emissive and no new shader). The
 *  posts reach 6 m below the snow so they never float over a falling bank. Local x runs across the
 *  run, y up; one instance per arch. */
export function kmArchGeometry(span: number): BufferGeometry {
  reseed(1717);
  const H = ARCH_HEIGHT;
  const half = span / 2;
  const timber = new Color('#6E4A36');
  const beamC = new Color('#7E5640');
  const rope = new Color('#3A3046');
  const lamp = new Color('#FFB45E').multiplyScalar(2.8);
  const spruce = new Color('#2F6F68');
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * half;
    // The post: square timber, darker toward its foot.
    parts.push(paint(part(new BoxGeometry(0.58, H + 6, 0.58), timber, { pos: [x, (H - 6) / 2 - 0.35, 0] }), -6, H, 0.7, 1.08, 0.12));
    // A collar of packed snow where the post meets the slope.
    parts.push(part(new CylinderGeometry(0.62, 0.78, 0.5, 8), SNOW, { pos: [x, 0.05, 0], jitter: 0.06 }));
    // A cap of snow on the post's top, proud of the beam.
    parts.push(part(new CylinderGeometry(0.34, 0.36, 0.22, 8), SNOW, { pos: [x, H + 0.08, 0], scale: [1, 1, 1] }));
    // A diagonal brace from the post up under the beam.
    parts.push(part(new BoxGeometry(0.2, 2.0, 0.2), beamC, { pos: [x - sx * 0.62, H - 1.25, 0], rot: [0, 0, sx * 0.785] }));
  }
  // The beam, overhanging each post a little, and the drift along its top.
  parts.push(paint(part(new BoxGeometry(span + 1.6, 0.62, 0.56), beamC, { pos: [0, H - 0.36, 0] }), H - 0.62, H - 0.1, 0.82, 1.06, 0.1));
  parts.push(part(new CylinderGeometry(0.34, 0.34, span + 1.7, 9, 3), SNOW, { pos: [0, H - 0.04, 0], rot: [0, 0, Math.PI / 2], scale: [0.5, 1, 0.95], jitter: 0.03 }));  // The wreath at the middle of the beam's face (downhill, toward the rider coming).
  parts.push(part(new TorusGeometry(0.5, 0.16, 6, 14), spruce, { pos: [0, H - 0.5, 0.36], jitter: 0.04 }));
  parts.push(part(new SphereGeometry(0.11, 8, 6), lamp, { pos: [0, H - 0.98, 0.42] }));
  // The lantern string: a shallow sag from post to post, a round paper lantern every 1.6 m or so on a
  // short drop (every fourth a cream one), joined by a thin cord.
  const n = Math.max(6, Math.round(span / 1.6));
  const sag = Math.min(1.4, 0.04 * span);
  const top = H - 0.9;
  const at = (t: number): [number, number] => [-half + 0.5 + (span - 1) * t, top - sag * 4 * t * (1 - t)];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = at(i / n);
    const [bx, by] = at((i + 1) / n);
    const len = Math.hypot(bx - ax, by - ay);
    parts.push(part(new BoxGeometry(len, 0.035, 0.035), rope, { pos: [(ax + bx) / 2, (ay + by) / 2, 0], rot: [0, 0, Math.atan2(by - ay, bx - ax)] }));
    if (i === 0) continue;
    parts.push(archDrop(i % 4 === 0).clone().translate(ax, ay, 0));
  }
  return merge(parts);
}

/** A graveyard cairn (render only, no collider): where several ghosts fell, a waist-high stack of
 *  snow-capped stones on the bank with a leaning timber marker, a ghost-mint ribbon knotted round it
 *  and two small mint lanterns at its foot. The mint is the ghosts' own colour role (ART.md); the
 *  lanterns' colour is pushed well past 1, so they bloom on Medium and High through the plain toon
 *  material (no emissive and no new shader). The stones sink 0.4 m into the snow so the cairn never
 *  floats on a slope. Local y up; one instance per graveyard. */
export function cairnGeometry(p: Palette): BufferGeometry {
  reseed(2929);
  const stone = shade(p.low, 0.85);
  const stoneLit = shade(p.lowLit, 0.9);
  const timber = new Color('#5E4232');
  const mint = new Color(MINT_HEX);
  const lamp = mint.clone().multiplyScalar(2.4);
  const parts: BufferGeometry[] = [];
  // The stack: broad flat stones narrowing upward, each a little off the last, alternately lit.
  const stones: Array<[number, number, number, number]> = [
    [0.78, 0.0, 0.0, 0.05],
    [0.62, 0.42, 0.08, -0.04],
    [0.48, 0.78, -0.06, 0.05],
    [0.36, 1.08, 0.04, 0.0],
    [0.24, 1.32, -0.02, 0.03],
  ];
  stones.forEach(([r, y, x, z], i) => {
    parts.push(part(new IcosahedronGeometry(r, 0), i % 2 ? stoneLit : stone, { pos: [x, y - 0.12, z], scale: [1.15, 0.55, 1.0], rot: [rnd() * 0.3, rnd() * 3, rnd() * 0.3], jitter: r * 0.3 }));
    // A cap of snow on each stone's upper face.
    parts.push(part(new IcosahedronGeometry(r * 0.78, 0), SNOW, { pos: [x, y + r * 0.22, z], scale: [1.1, 0.22, 0.95], jitter: r * 0.12 }));
  });
  // A drift banked against the stack's foot.
  parts.push(part(new IcosahedronGeometry(1.05, 0), SNOW, { pos: [0, -0.32, 0], scale: [1.25, 0.32, 1.1], jitter: 0.14 }));
  // The marker: a timber stake leaning out of the stack, a short cross piece, the ribbon round it.
  parts.push(paint(part(new BoxGeometry(0.12, 2.3, 0.12), timber, { pos: [0.28, 1.25, -0.1], rot: [0.06, 0, -0.16] }), 0, 2.4, 0.75, 1.05, 0.1));
  parts.push(part(new BoxGeometry(0.62, 0.1, 0.1), timber, { pos: [0.43, 1.95, -0.06], rot: [0.06, 0, -0.16] }));
  parts.push(part(new BoxGeometry(0.16, 0.08, 0.16), mint, { pos: [0.4, 1.78, -0.08], rot: [0.06, 0, -0.16] }));
  parts.push(part(new BoxGeometry(0.05, 0.62, 0.02), mint, { pos: [0.5, 1.48, -0.02], rot: [0.12, 0, 0.32] }));
  parts.push(part(new BoxGeometry(0.05, 0.5, 0.02), mint, { pos: [0.56, 1.52, -0.12], rot: [-0.1, 0, 0.5] }));
  // The lanterns at its foot: little mint globes on the drift, glowing like the ghosts.
  for (const [x, z] of [[-0.75, 0.42], [0.62, 0.55]] as const) {
    parts.push(part(new CylinderGeometry(0.07, 0.09, 0.1, 6), timber, { pos: [x, -0.02, z] }));
    parts.push(part(new SphereGeometry(0.15, 8, 6), lamp, { pos: [x, 0.16, z], scale: [1, 1.15, 1] }));
  }
  return merge(parts);
}

/** Ring of dark rock around a steam vent. */
export function ventGeometry(): BufferGeometry {
  reseed(1313);
  return merge([
    part(new TorusGeometry(1.2, 0.35, 5, 9), new Color('#2B2830'), { rot: [Math.PI / 2, 0, 0], pos: [0, 0.05, 0], jitter: 0.15 }),
    part(new CylinderGeometry(1.0, 1.0, 0.08, 9), new Color('#FF7A3A'), { pos: [0, 0.02, 0] }),
  ]);
}

/** The lip of a built kicker, a "jump here" signal (the ramp below it is terrain, which the snow
 *  shader paints as a packed, corduroyed wedge with dark flanks and a contact shadow past the lip): a
 *  low rounded cap of packed snow rolling over the edge, above a short takeoff board facing downhill
 *  with a slightly paler bevel along its top. The board is warm wood, or pale ice on icy mountains (a
 *  tan board on the glacier read as cardboard). Its top edge was once a near-white strip: seen edge-on
 *  from the chase camera it was a bright hairline cutting across the sled at deck height (worst
 *  under the sled lantern), which read as a rendering glitch. Unit width along x, in the lip's frame
 *  (+y off the ramp face, -z downhill), 0.15 m short of the lip. */
export function kickerLipGeometry(p?: Palette): BufferGeometry {
  const icy = !!p && p.ice > 0;
  return merge([
    part(new BoxGeometry(1, 0.26, 0.07), new Color(icy ? '#B8E2F4' : '#B5774B'), { pos: [0, -0.09, -0.26] }),
    part(new BoxGeometry(1.004, 0.03, 0.08), new Color(icy ? '#C6E6F2' : '#C08758'), { pos: [0, 0.045, -0.26] }),
    // The cap is the mood's own lit snow, so it reads as the snow it is packed from: plain white under a
    // night moon stood a step brighter than the snow round it, a pale rail across the sled at deck height.
    part(new CylinderGeometry(0.17, 0.17, 1.0, 8), p ? p.snowLit : SNOW, { pos: [0, 0.0, -0.1], rot: [0, 0, Math.PI / 2], scale: [0.5, 1, 1.25], jitter: 0.02 }),
  ]);
}

/** Obstacle kinds to geometry for the current palette. */
export function obstacleGeometry(kind: ObstacleKind, p: Palette): BufferGeometry {
  switch (kind) {
    case 'pine':
      return pineGeometry(p);
    case 'charpine':
      return charPineGeometry(p);
    case 'blossom':
      return blossomGeometry(p);
    case 'rock':
      return rockGeometry(p.low, p.lowLit, 0);
    case 'iceblock':
      return iceBlockGeometry(p);
    case 'spire':
      return spireGeometry(p);
    case 'serac':
      return seracGeometry(p);
    case 'basalt':
      return basaltGeometry(p);
    case 'lavarock':
      return lavaRockGeometry(p);
    case 'lantern':
      return lanternGeometry();
    case 'pillar':
      return pillarGeometry(p);
    case 'log':
      return logGeometry(p);
    case 'snowman':
      return snowmanGeometry();
  }
}

/** Natural size the geometry was modelled at, used to scale instances to collider size. */
export function obstacleModelRadius(kind: ObstacleKind): number {
  switch (kind) {
    case 'rock':
    case 'lavarock':
      return 1.1;
    case 'iceblock':
      return 1.0;
    case 'serac':
      return 1.9;
    case 'basalt':
      return 1.0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------- rider

export const RIDER_COLORS = {
  // A saturated ink navy (ART.md), not near-black: in shade and backlit it must still read as blue.
  coat: new Color('#22307A'),
  pants: new Color('#29356A'),
  skin: new Color('#F4C9A6'),
  // A deep chestnut, smooth-shaded: the chase camera sees mostly the back of the head, where a
  // near-black brown read as a void under the beanie (a faceless helmet), and a light, faceted one
  // caught the backlight in two arcs that read as a pair of closed eyes. A warm mid chestnut: darker,
  // the rider shader treats it as ink cloth and holds it near black in shade, one void from behind.
  hair: new Color('#8E5534'),
  // The coat's second tone: a cobalt-navy yoke over the shoulders and cuffs, a step lighter and bluer
  // than the coat, so from behind the back reads as a jacket rather than one flat navy box.
  yoke: new Color('#2C4199'),
  strap: new Color('#3C58B4'),
  accent: new Color('#FF4D2E'),
  pom: new Color('#FFF4EA'),
  goggles: new Color('#12182E'),
  lens: new Color('#FFB86A'),
  wood: new Color('#E0A060'),
  woodDark: new Color('#B07840'),
};

/** Where the scarf is knotted at the back of the neck (body pivot space); its tails stream from here. */
export const SCARF_KNOT = new Vector3(0, 0.6, 0.245);

/** Sled: deck along -z (forward), runners curling up at the front. */
export function sledGeometry(runner: Color = RIDER_COLORS.accent): BufferGeometry {
  const C = RIDER_COLORS;
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(part(new BoxGeometry(0.14, 0.06, 1.25), i % 2 ? C.woodDark : C.wood, { pos: [-0.24 + i * 0.16, 0.2, 0.05] }));
  }
  parts.push(part(new BoxGeometry(0.62, 0.05, 0.1), C.woodDark, { pos: [0, 0.17, -0.42] }));
  parts.push(part(new BoxGeometry(0.62, 0.05, 0.1), C.woodDark, { pos: [0, 0.17, 0.5] }));
  for (const sx of [-0.28, 0.28]) {
    parts.push(part(new BoxGeometry(0.05, 0.05, 1.5), runner, { pos: [sx, 0.03, 0.05] }));
    parts.push(part(new TorusGeometry(0.16, 0.026, 5, 10, Math.PI), runner, { pos: [sx, 0.19, -0.7], rot: [0, Math.PI / 2, 0] }));
    parts.push(part(new BoxGeometry(0.04, 0.16, 0.04), runner, { pos: [sx, 0.11, 0.35] }));
    parts.push(part(new BoxGeometry(0.04, 0.16, 0.04), runner, { pos: [sx, 0.11, -0.3] }));
  }
  parts.push(part(new CylinderGeometry(0.025, 0.025, 0.78, 6), C.woodDark, { pos: [0, 0.26, -0.62], rot: [0, 0, Math.PI / 2] }));
  return merge(parts);
}

/** Each unlockable sled gets its own silhouette so an unlock is visible at a glance. */
export function sledGeometryFor(id: number): BufferGeometry {
  const C = RIDER_COLORS;
  switch (id) {
    case 1: {
      // Whirl Saucer: a shallow disc with a rim.
      return merge([
        part(new CylinderGeometry(0.62, 0.5, 0.1, 18), new Color('#3E7FD8'), { pos: [0, 0.08, 0.05] }),
        part(new TorusGeometry(0.6, 0.045, 6, 22), C.accent, { pos: [0, 0.13, 0.05], rot: [Math.PI / 2, 0, 0] }),
        part(new CylinderGeometry(0.2, 0.2, 0.02, 12), new Color('#FFF4EA'), { pos: [0, 0.14, 0.05] }),
      ]);
    }
    case 2: {
      // Lodge Toboggan: long slats with a big curl at the nose.
      const parts: BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) parts.push(part(new BoxGeometry(0.2, 0.05, 1.7), i === 1 ? C.woodDark : C.wood, { pos: [-0.21 + i * 0.21, 0.08, 0.15] }));
      parts.push(part(new TorusGeometry(0.28, 0.05, 6, 14, Math.PI * 1.2), C.wood, { pos: [0, 0.34, -0.72], rot: [0, Math.PI / 2, 0], scale: [1, 1, 3.4] }));
      parts.push(part(new CylinderGeometry(0.02, 0.02, 0.66, 5), C.accent, { pos: [0, 0.18, 0.1], rot: [0, 0, Math.PI / 2] }));
      return merge(parts);
    }
    case 3: {
      // Comet Bob: a sleek pearl shell with a vermillion stripe, flank stripes and a tail fin, so
      // it still reads as yours (and not as a snowdrift) from the chase camera behind it. The stripes
      // sit proud of the shell (its top is at y 0.52, its flanks at x 0.6), never buried inside it.
      return merge([
        part(new CapsuleLikeGeometry(), new Color('#D3DDF2'), { pos: [0, 0.2, 0.05], scale: [0.6, 0.32, 1.5] }),
        part(new BoxGeometry(0.1, 0.06, 1.4), C.accent, { pos: [0, 0.52, 0.05] }),
        part(new BoxGeometry(0.07, 0.08, 1.0), C.accent, { pos: [-0.61, 0.25, 0.05] }),
        part(new BoxGeometry(0.07, 0.08, 1.0), C.accent, { pos: [0.61, 0.25, 0.05] }),
        part(new BoxGeometry(0.06, 0.26, 0.42), C.accent, { pos: [0, 0.5, 1.12], rot: [-0.35, 0, 0] }),
        part(new BoxGeometry(0.05, 0.05, 1.5), new Color('#2B3550'), { pos: [-0.26, 0.02, 0.05] }),
        part(new BoxGeometry(0.05, 0.05, 1.5), new Color('#2B3550'), { pos: [0.26, 0.02, 0.05] }),
      ]);
    }
    case 4: {
      // Wisp: pale spectral runners and deck.
      const mint = new Color('#BFF8EE');
      return merge([
        part(new BoxGeometry(0.58, 0.05, 1.2), new Color('#E8FFFB'), { pos: [0, 0.2, 0.05] }),
        part(new BoxGeometry(0.04, 0.04, 1.5), mint, { pos: [-0.28, 0.03, 0.05] }),
        part(new BoxGeometry(0.04, 0.04, 1.5), mint, { pos: [0.28, 0.03, 0.05] }),
        part(new TorusGeometry(0.2, 0.024, 5, 10, Math.PI * 1.4), mint, { pos: [-0.28, 0.22, -0.72], rot: [0, Math.PI / 2, 0] }),
        part(new TorusGeometry(0.2, 0.024, 5, 10, Math.PI * 1.4), mint, { pos: [0.28, 0.22, -0.72], rot: [0, Math.PI / 2, 0] }),
      ]);
    }
    case 5: {
      // Tea Tray: a round pewter tray with handles. A bright silver face, lit by a low sun at a
      // grazing angle, bloomed into a white disc brighter than the sun itself; a mid pewter keeps
      // the lit rim as the only highlight.
      // A dark underside band under the face, so from the low chase camera it reads as a round sled
      // with depth rather than a flat disc of snow.
      const pewter = new Color('#8C95A6');
      const lip = new Color('#B9C1CF');
      const under = new Color('#3A4256');
      return merge([
        part(new CylinderGeometry(0.66, 0.57, 0.055, 20), under, { pos: [0, 0.035, 0.05], scale: [1, 1, 1.2] }),
        part(new CylinderGeometry(0.655, 0.655, 0.022, 20), pewter, { pos: [0, 0.071, 0.05], scale: [1, 1, 1.2] }),
        part(new TorusGeometry(0.64, 0.03, 5, 24), lip, { pos: [0, 0.09, 0.05], rot: [Math.PI / 2, 0, 0], scale: [1, 1.2, 1] }),
        part(new TorusGeometry(0.1, 0.025, 5, 10, Math.PI), lip, { pos: [0, 0.12, -0.78], rot: [Math.PI / 2, 0, 0] }),
      ]);
    }
    default:
      return sledGeometry();
  }
}

/** A rounded pod (scaled icosphere) used for the bobsled shell. */
class CapsuleLikeGeometry extends IcosahedronGeometry {
  constructor() {
    super(1, 1);
  }
}

/** How the rider sits each sled (body-pivot height and depth above the sled base, extra forward
 *  lean in radians). On a round saucer or tray there is no deck to sit on with the legs out in
 *  front, and upright in the middle of the disc the rider read as a figurine on a plate: there it
 *  sits cross-legged, knees out past its hips on both sides (from the chase camera, a wide seated
 *  base), and leans over the rim. */
export interface SledSeat {
  crossLegged: boolean;
  y: number;
  z: number;
  lean: number;
}

/** The cross-legged rider's extra forward lean; its legs are modelled against it, so they lie flat. */
const CROSS_LEAN = 0.42;
const SEAT_SIT: SledSeat = { crossLegged: false, y: 0.24, z: 0.1, lean: 0 };

export function sledSeat(id: number): SledSeat {
  // The legs rest on the disc face, 0.15 m below the hips (see riderBodyGeometry).
  if (id === 1) return { crossLegged: true, y: 0.28, z: 0.08, lean: CROSS_LEAN };
  if (id === 5) return { crossLegged: true, y: 0.23, z: 0.08, lean: CROSS_LEAN };
  return SEAT_SIT;
}


/** Per-vertex secondary-motion weights, which rider.ts animates in its vertex shader: x is how much
 *  of the pom-pom's bounce a vertex takes, y how much of the coat hem's flutter. Every rider part
 *  carries the attribute (zero on rigid parts), so the parts still merge into one geometry. */
type SwayFn = (x: number, y: number, z: number) => [number, number];
function sway(g: BufferGeometry, w: SwayFn | [number, number] = [0, 0]): BufferGeometry {
  const p = g.getAttribute('position');
  const a = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const v = typeof w === 'function' ? w(p.getX(i), p.getY(i), p.getZ(i)) : w;
    a[i * 2] = v[0];
    a[i * 2 + 1] = v[1];
  }
  g.setAttribute('aSway', new BufferAttribute(a, 2));
  return g;
}

/** Gives a geometry drawn with the rider's material (its sleds) a zero sway attribute, so the swaying
 *  vertex shader never reads a stale generic attribute value. */
export function withSway(g: BufferGeometry): BufferGeometry {
  return g.getAttribute('aSway') ? g : sway(g);
}

/** Merges rider parts, every one given a zero sway unless it already has its own. */
function mergeRider(parts: BufferGeometry[]): BufferGeometry {
  return merge(parts.map(withSway));
}

/** A surface of revolution about +y from a (radius, height) profile, flat-shaded like every part. */
function lathe(profile: Array<[number, number]>, segs: number, color: Color, o: PartOpts = {}): BufferGeometry {
  return part(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segs), color, o);
}

/** A rounded limb: a tapered capsule from `a` (radius ra) to `b` (radius rb), its ends domed so the
 *  joints read soft (the old open cylinders met at the elbow and knee as box-like stubs). `squash`
 *  flattens it across one side (boots, mitts). */
function capsule(a: Vector3, b: Vector3, ra: number, rb: number, color: Color, sides = 9, squash = 1): BufferGeometry {
  const d = b.clone().sub(a);
  const L = d.length();
  const prof: Array<[number, number]> = [];
  for (let i = 0; i <= 2; i++) {
    const t = -Math.PI / 2 + (i / 2) * (Math.PI / 2);
    prof.push([ra * Math.cos(t), ra * Math.sin(t)]);
  }
  for (let i = 0; i <= 2; i++) {
    const t = (i / 2) * (Math.PI / 2);
    prof.push([rb * Math.cos(t), L + rb * Math.sin(t)]);
  }
  prof[0][0] = 0;
  prof[prof.length - 1][0] = 0;
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()));
  return lathe(prof, sides, color, { pos: [a.x, a.y, a.z], rot: [e.x, e.y, e.z], scale: [1, 1, squash] });
}

/** Like part(), but keeps the primitive's own smooth normals (no facets): the hair, whose flat
 *  facets caught the backlight in bands. */
function smoothPart(geo: BufferGeometry, color: Color, o: PartOpts = {}): BufferGeometry {
  const m = new Matrix4().compose(
    new Vector3(...(o.pos ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))),
    new Vector3(...(o.scale ?? [1, 1, 1])),
  );
  geo.applyMatrix4(m);
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/** Knit ribs: alternate facets round the y axis a step darker, so a cuff reads as ribbed wool from
 *  any side (from behind most of all, where the chase camera sees it). */
function ribs(g: BufferGeometry, count: number, k: number): BufferGeometry {
  const pos = g.getAttribute('position') as BufferAttribute;
  const col = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const band = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * count);
    if (band % 2) continue;
    for (let j = i; j < i + 3; j++) col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
  }
  return g;
}

/** Where the head turns on the neck (body pivot space): rider.ts holds the head toward upright about
 *  it while the torso leans, and keeps its volume while the torso squashes. */
export const RIDER_NECK = new Vector3(0, 0.64, 0);

/** The pom-pom's centre (body pivot space, before the neck turns it): rider.ts bounces it. */
export const RIDER_POM = new Vector3(0, 1.225, 0.02);

/** The head in body pivot space: a toy face (two dark oval eyes with a catchlight and a soft blush on
 *  each cheek) under a beanie pulled low, the goggles pushed up onto its front, ear flaps and hair at
 *  the nape. The chase camera always sees the back of the head, so the back carries the detail: a
 *  ribbed cuff, a seam up the crown, a cream knit stripe, a fluffy pom-pom (which bounces: aSway.x)
 *  and a bob of hair that flares a little and rolls under above the scarf (one smooth dark mass read
 *  as a helmet). A ghost wears only the silhouette (head, beanie and pom-pom): thin straps and lenses
 *  inside the glass drew their own rims and read as dotted seams. */
export function riderHeadGeometry(ghost = false): BufferGeometry {
  reseed(4242);
  const C = RIDER_COLORS;
  const pom = sway(part(new IcosahedronGeometry(0.1, 1), C.pom, { pos: [RIDER_POM.x, RIDER_POM.y, RIDER_POM.z], jitter: 0.03 }), [1, 0]);
  const parts: BufferGeometry[] = [
    part(new SphereGeometry(0.24, 12, 9), C.skin, { pos: [0, 0.86, 0] }),
    // The beanie, pulled down to just above the eyes.
    part(new SphereGeometry(0.25, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.accent, { pos: [0, 0.915, 0.01], scale: [1.04, 1.12, 1.04] }),
    pom,
  ];
  if (ghost) return mergeRider(parts);
  const eye = new Color('#1B1E36');
  const blush = new Color('#FF8E9E');
  const cuff = shade(C.accent, 0.8);
  parts.push(
    // Hair round the back and sides under the cuff: a bob that flares a little past the skull...
    smoothPart(new SphereGeometry(0.249, 18, 8, -0.25, Math.PI + 0.5, 1.3, 1.15), C.hair, { pos: [0, 0.86, 0.004], scale: [1.05, 1, 1.08] }),
    // The folded cuff: a deeper vermillion band of knit ribs, a little proud of the crown.
    ribs(part(new CylinderGeometry(0.268, 0.274, 0.095, 24, 1, true), cuff, { pos: [0, 0.905, 0.01] }), 24, 0.84),
    part(new TorusGeometry(0.27, 0.018, 4, 18), shade(C.accent, 0.9), { pos: [0, 0.952, 0.01], rot: [Math.PI / 2, 0, 0] }),
    // A cream knit stripe round the crown, high enough to clear the goggle strap: from behind the
    // beanie reads as a knitted hat rather than a red dome.
    part(new SphereGeometry(0.256, 14, 1, 0, Math.PI * 2, 0.85, 0.16), C.pom, { pos: [0, 0.915, 0.01], scale: [1.04, 1.12, 1.04] }),
    // The seam up the back of the crown to the pom-pom.
    part(new TorusGeometry(0.26, 0.009, 3, 8, Math.PI / 2), shade(C.accent, 0.7), { pos: [0, 0.915, 0.01], rot: [0, -Math.PI / 2, 0], scale: [1.04, 1.12, 1.04] }),
  );
  // ...ending in a scalloped fringe of overlapping locks across the nape just above the scarf: from
  // behind the hair reads as a cut, not as a dark hole under the beanie (two tufts read as a pair of
  // closed eyes, and five lighter locks as a row of teeth).
  for (const [a, s] of [[-0.95, 0.85], [-0.48, 1], [0, 1.08], [0.48, 1], [0.95, 0.85]] as const) {
    const r = 0.212;
    parts.push(
      smoothPart(new SphereGeometry(0.056 * s, 8, 6), C.hair, {
        pos: [Math.sin(a) * r * 1.05, 0.725 - 0.012 * Math.abs(a), Math.cos(a) * r * 1.08 - 0.01],
        rot: [0.35, a, 0],
        scale: [1.45, 1.25, 0.6],
      }),
    );
  }
  for (const sx of [-1, 1]) {
    parts.push(
      // Oval eyes just under the cuff, flattened onto the face, with a catchlight high and outside.
      part(new SphereGeometry(0.036, 8, 6), eye, { pos: [sx * 0.078, 0.822, -0.212], rot: [0, -sx * 0.34, 0], scale: [0.78, 1.15, 0.5] }),
      part(new SphereGeometry(0.011, 5, 4), C.pom, { pos: [sx * 0.088, 0.836, -0.228] }),
      part(new SphereGeometry(0.042, 8, 6), blush, { pos: [sx * 0.138, 0.772, -0.168], rot: [0, -sx * 0.68, 0], scale: [1.25, 0.72, 0.32] }),
      // Ear flaps hanging from the cuff over the ears down to the scarf: from behind they square the
      // head off and frame the hair.
      part(new SphereGeometry(0.085, 9, 6), cuff, { pos: [sx * 0.238, 0.775, 0.035], rot: [0, 0, sx * 0.1], scale: [0.5, 1.5, 0.98] }),
      // The goggles pushed up onto the beanie's front: two amber lenses in dark frames.
      part(new SphereGeometry(0.06, 10, 7), C.lens, { pos: [sx * 0.086, 1.005, -0.232], rot: [0.28, -sx * 0.36, 0], scale: [1.12, 0.86, 0.42] }),
      part(new TorusGeometry(0.06, 0.017, 5, 14), C.goggles, { pos: [sx * 0.086, 1.005, -0.229], rot: [0.28, -sx * 0.36, 0], scale: [1.12, 0.86, 1] }),
    );
  }
  parts.push(
    part(new BoxGeometry(0.06, 0.03, 0.04), C.goggles, { pos: [0, 1.0, -0.245], rot: [0.28, 0, 0] }),
    // Their strap round the crown: a cobalt band that also reads from behind.
    part(new TorusGeometry(0.247, 0.019, 4, 18), C.strap, { pos: [0, 1.0, 0.01], rot: [Math.PI / 2 + 0.06, 0, 0] }),
  );
  return mergeRider(parts);
}

/** The coat: one rounded form, a padded hem flaring over the hips, nipped in at the waist, full at
 *  the chest, with a cobalt yoke rounding over the shoulders to the collar (a second tone: an
 *  untapered navy cylinder read as a box). Slightly deeper across than front to back. The hem's
 *  vertices carry the flutter weight (aSway.y). */
function coatGeometry(): BufferGeometry {
  const C = RIDER_COLORS;
  const hem: SwayFn = (_x, y) => [0, 1 - smooth01((y - 0.05) / 0.16)];
  return merge([
    sway(
      lathe(
        [
          [0, 0.0],
          [0.2, 0.006],
          [0.252, 0.035],
          [0.268, 0.085],
          [0.25, 0.15],
          [0.212, 0.225],
          [0.214, 0.31],
          [0.238, 0.41],
          [0.252, 0.5],
        ],
        14,
        C.coat,
        { pos: [0, 0, 0.02], scale: [1, 1, 0.9] },
      ),
      hem,
    ),
    sway(
      lathe(
        [
          [0.252, 0.5],
          [0.248, 0.56],
          [0.222, 0.615],
          [0.17, 0.652],
          [0.09, 0.675],
          [0, 0.68],
        ],
        14,
        C.yoke,
        { pos: [0, 0, 0.02], scale: [1, 1, 0.9] },
      ),
    ),
  ]);
}

function smooth01(x: number): number {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * (3 - 2 * k);
}

/** A rounded boot from the ankle, its toe out along `toe`: a soft, flat-soled capsule. */
function boot(ankle: Vector3, toe: Vector3): BufferGeometry {
  return capsule(ankle, toe, 0.078, 0.07, RIDER_COLORS.goggles, 9, 0.8);
}

/** Torso, scarf wrap and legs (no head), pivot at the hips: seated with the legs out along -z, or
 *  cross-legged (thighs out to knees past the hips, shins crossed in front, a seat under the coat).
 *  A ghost leaves out the scarf wrap and its knot. */
export function riderTorsoGeometry(crossLegged = false, ghost = false): BufferGeometry {
  const C = RIDER_COLORS;
  const parts = [...riderLegs(crossLegged), coatGeometry()];
  if (!ghost) {
    parts.push(
      // scarf wrap, dipping to the knot at the back (the two tails are simulated in rider.ts)
      part(new TorusGeometry(0.19, 0.07, 6, 14), C.accent, { pos: [0, 0.655, 0.02], rot: [Math.PI / 2 + 0.18, 0, 0] }),
      part(new IcosahedronGeometry(0.085, 0), shade(C.accent, 0.88), { pos: [SCARF_KNOT.x, SCARF_KNOT.y, SCARF_KNOT.z - 0.015], scale: [1.2, 0.9, 0.85] }),
    );
  }
  return mergeRider(parts);
}

/** A ghost's legs alone, seated on its sled as ghostRiderGeometry seats the body (sled space): the
 *  ghost's glass sled mesh carries them as a faint lap, so the dissolving body still sits on its sled. */
export function ghostLegsGeometry(seat: SledSeat = SEAT_SIT): BufferGeometry {
  const g = mergeRider(riderLegs(seat.crossLegged));
  g.rotateX(-0.15 - seat.lean);
  g.translate(0, seat.y, seat.z);
  return g;
}

function riderLegs(crossLegged: boolean): BufferGeometry[] {
  const C = RIDER_COLORS;
  const legs: BufferGeometry[] = [];
  if (crossLegged) {
    // The hips carry the coat's line down to the disc, so the knees read as their own lumps.
    const cross: BufferGeometry[] = [lathe([[0, -0.15], [0.2, -0.14], [0.255, -0.08], [0.25, 0.0], [0.2, 0.05], [0, 0.06]], 12, C.pants, { pos: [0, 0, 0.03] })];
    for (const sx of [-1, 1]) {
      const knee = new Vector3(sx * 0.42, -0.07, -0.18);
      // The shins cross in front, one a touch above the other.
      const ankle = new Vector3(-sx * 0.15, sx > 0 ? -0.09 : -0.12, -0.38);
      cross.push(
        capsule(new Vector3(sx * 0.1, -0.03, 0.02), knee, 0.118, 0.104, C.pants),
        capsule(knee, ankle, 0.1, 0.082, C.pants),
        boot(ankle.clone().add(new Vector3(-sx * 0.02, 0, 0)), ankle.clone().add(new Vector3(-sx * 0.1, 0, -0.08))),
      );
    }
    // Modelled flat on the disc, then tipped back by the seat's lean, which the pose tips forward.
    const g = mergeRider(cross);
    g.rotateX(0.15 + CROSS_LEAN);
    legs.push(g);
  } else {
    // Thighs taper to a raised, rounded knee and the shins to the ankle, into soft boots.
    for (const sx of [-1, 1]) {
      const hip = new Vector3(sx * 0.12, 0.05, -0.02);
      const knee = new Vector3(sx * 0.125, 0.12, -0.34);
      const ankle = new Vector3(sx * 0.125, 0.04, -0.58);
      legs.push(
        capsule(hip, knee, 0.118, 0.1, C.pants),
        capsule(knee, ankle, 0.096, 0.08, C.pants),
        boot(new Vector3(ankle.x, ankle.y - 0.005, ankle.z + 0.01), new Vector3(ankle.x, ankle.y - 0.025, ankle.z - 0.13)),
      );
    }
  }
  return legs;
}

/** The whole seated rider, head included, in one geometry (the sled shop's preview). */
export function riderBodyGeometry(crossLegged = false): BufferGeometry {
  return merge([riderTorsoGeometry(crossLegged), riderHeadGeometry()]);
}

/** One arm from shoulder (origin) pointing down -y, ending in a mitt: a puffy, rounded sleeve
 *  tapering to an elbow bent a little forward, a forearm with a cobalt cuff, and a round mitt with a
 *  thumb (one straight six-sided bar read as a stick arm, and open cylinders as box limbs). */
export function riderArmGeometry(): BufferGeometry {
  const C = RIDER_COLORS;
  const shoulder = new Vector3(0, -0.02, 0);
  const elbow = new Vector3(0, -0.215, 0.012);
  const wrist = new Vector3(0, -0.39, -0.085);
  const dir = wrist.clone().sub(elbow).normalize();
  const cuff = wrist.clone().addScaledVector(dir, -0.02);
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  const mitt = wrist.clone().addScaledVector(dir, 0.045);
  const thumb = mitt.clone().add(new Vector3(0, 0.01, -0.06));
  return mergeRider([
    part(new SphereGeometry(0.088, 9, 7), C.coat, { pos: [shoulder.x, shoulder.y, shoulder.z] }),
    capsule(shoulder, elbow, 0.084, 0.07, C.coat),
    capsule(elbow, wrist, 0.068, 0.058, C.coat),
    part(new CylinderGeometry(0.068, 0.066, 0.05, 10), C.yoke, { pos: [cuff.x, cuff.y, cuff.z], rot: [e.x, e.y, e.z] }),
    // The mitt: a soft paddle a little flatter side to side, and its thumb out in front.
    capsule(mitt, mitt.clone().addScaledVector(dir, 0.06), 0.072, 0.064, C.goggles, 9, 0.82),
    capsule(mitt.clone().addScaledVector(dir, 0.01), thumb, 0.03, 0.026, C.goggles, 6),
  ]);
}

/** The whole rider merged in a neutral seated pose for the ghosts (one draw call), as a silhouette
 *  only: no scarf, goggles, strap or face, whose thin parts inside the glass drew dotted seams.
 *  `sled` adds the wooden sled under it (the chaos spirit train); the race's ghosts ride their own
 *  glass sleds (ghosts.ts) and pass false. `seat` sits the body as rider.ts sits that sled: on a round
 *  sled cross-legged, leaning over the rim with the head held up. */
export function ghostRiderGeometry(sled = true, seat: SledSeat = SEAT_SIT): BufferGeometry {
  const pitch = -0.15 - seat.lean;
  const torso = riderTorsoGeometry(seat.crossLegged, true);
  torso.rotateX(pitch);
  const lift = seat.crossLegged ? 0.15 : 0.03;
  const neck = RIDER_NECK.clone().applyAxisAngle(new Vector3(1, 0, 0), pitch);
  // The head stays near upright on its neck (rider.ts holds it), raised on a saucer's forward lean.
  const head = riderHeadGeometry(true)
    .translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z)
    .rotateX(pitch - (pitch + 0.15) * 0.7 + 0.06)
    .translate(neck.x, neck.y + lift, neck.z);
  const body = merge([torso, head]);
  body.translate(0, seat.y, seat.z);
  const parts = [body];
  // The rider's relaxed pose: arms down and forward, a little out from the hips (closer in, resting
  // on the knees, when cross-legged).
  for (const sx of [-1, 1]) {
    const sh = new Vector3(sx * 0.27, 0.56, 0).applyAxisAngle(new Vector3(1, 0, 0), pitch);
    const arm = riderArmGeometry();
    arm.rotateZ(sx * (seat.crossLegged ? 0.14 : 0.3));
    arm.rotateX(0.72 + pitch);
    arm.translate(sh.x, sh.y + seat.y, sh.z + seat.z);
    parts.push(arm);
  }
  if (sled) parts.unshift(withSway(sledGeometry()));
  return merge(parts);
}
