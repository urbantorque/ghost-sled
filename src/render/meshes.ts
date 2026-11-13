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
import type { HatKind } from '../bot/roster';
import type { HatId } from '../game/garage';
import { FRIEND_HEX as MINT_HEX } from '../game/beats';
import { ASH_TOP, basaltTones, hazardPineGeometry } from './flora';
import { Palette } from './palette';
import { Facets, columnsInto, strata } from './rockforms';

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

/** The model sizes the run's rocks are built to (obstacleModelRadius, and props.ts stretches a rock to its
 *  collider's own height): the drawn rock stands inside its collider. */
export const ROCK_MODEL_R = 1.1;
export const ROCK_MODEL_H = 1.0;

/** The run's rock (ART.md 3 and 15): a hard, crisp boulder in three beds that dip a little, a ledge with
 *  snow lying on it, an overhang in its darkest value, a broken crown under snow and a drift banked round
 *  its foot. Built inside its collider (a circle of ROCK_MODEL_R, ROCK_MODEL_H tall). */
export function rockGeometry(base: Color, lit: Color, variant: number, low = false): BufferGeometry {
  return strata({
    rx: 1.05,
    rz: 0.98,
    h: ROCK_MODEL_H,
    foot: 0.5,
    // (Low's rock: two beds and six corners, the triangles round 6's rock had.)
    layers: low ? 2 : 3,
    sides: low ? 6 : 7,
    rock: [shade(base, 0.74), shade(base, 0.96), base.clone().lerp(lit, 0.6)],
    lie: SNOW,
    // (Beds well off each other and dipping hard, snow only where one steps well in: a boulder with a
    // lee side, never a stack of rings with a white stripe round each.)
    taper: 0.38,
    shift: 0.24,
    dip: 0.2,
    dipZ: -0.12,
    warp: 0.5,
    jut: 0.14,
    lieMin: 0.16,
    rough: 0.3,
    apron: 0.2,
    seed: 404 + variant * 17,
  });
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

/** The model sizes the run's basalt is built to (a circle of 1 m, 5 m tall; props.ts stretches it to its
 *  collider's height). */
export const BASALT_MODEL_R = 1.0;
export const BASALT_MODEL_H = 5;

/** Ember's basalt on the run: an organ-pipe cluster, one tall column with six slimmer ones packed round
 *  it, graded in height round the ring, each broken off on its own slant, ash on the flatter tops and
 *  drifted round the foot. Near black and cold: a hazard's hard silhouette, never a brown box under a
 *  white lid. Built inside its collider. */
export function basaltGeometry(p: Palette, low = false): BufferGeometry {
  reseed(808);
  const t = basaltTones(p);
  const f = new Facets();
  const cols: Array<[number, number, number, number]> = [[0, 0, 0.36, BASALT_MODEL_H]];
  const ring = [4.3, 3.5, 2.5, 1.7, 2.2, 3.2];
  ring.forEach((h, k) => {
    const a = (k / 6) * Math.PI * 2 + 0.5;
    cols.push([Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.31 + 0.03 * rnd(), h * (0.94 + 0.12 * rnd())]);
  });
  // (Cross-jointed into drums on Medium and up: Low's columns are whole, the triangles they had.)
  columnsInto(f, { cols, rock: t.rock, broke: t.broke, top: ASH_TOP, broken: 0.55, drum: low ? 0 : 2.6, seed: 8081 });
  // Ash banked round the foot.
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2;
    const a1 = ((k + 1) / 6) * Math.PI * 2;
    f.quad([Math.cos(a0) * 0.98, -0.45, Math.sin(a0) * 0.98], [Math.cos(a1) * 0.98, -0.45, Math.sin(a1) * 0.98], [Math.cos(a1) * 0.62, 0.3, Math.sin(a1) * 0.62], [Math.cos(a0) * 0.62, 0.22, Math.sin(a0) * 0.62], ASH_TOP, [Math.cos(a0), 1, Math.sin(a0)], 0.92, 1);
  }
  return f.build();
}

/** Ember's boulder on the run: hazards are never warm (ART.md section 1), so a chunky block of cold dark
 *  basalt in beds with ash on its ledge and crown, not a glowing ember. The lava glow belongs below. */
export function lavaRockGeometry(p: Palette, low = false): BufferGeometry {
  return strata({
    rx: 1.05,
    rz: 0.95,
    h: ROCK_MODEL_H,
    foot: 0.5,
    layers: low ? 2 : 3,
    sides: 6,
    rock: [shade(p.low, 0.58), shade(p.low, 0.8), shade(p.low, 1.08)],
    lie: ASH_TOP,
    taper: 0.34,
    shift: 0.24,
    dip: -0.18,
    dipZ: 0.12,
    warp: 0.5,
    jut: 0.14,
    lieMin: 0.16,
    rough: 0.3,
    apron: 0.2,
    seed: 909,
  });
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

/** Ember's log: a basalt column fallen across the run and broken into three drums where it hit, each
 *  turned a little on its axis and a finger's width from the next, ash lying along the faces that look up
 *  and banked against its foot. Unit length along x (stretched per instance, so the joints are thin in
 *  that axis), inside the log's collider (0.42 m about a line 0.4 m up). 108 triangles. */
function fallenColumn(p: Palette): BufferGeometry {
  reseed(1112);
  const t = basaltTones(p);
  const f = new Facets();
  const drums: Array<[number, number, number, number, number]> = [
    [-0.5, -0.172, 0.4, 0.01, 0.2],
    [-0.168, 0.212, 0.415, -0.015, 0.75],
    [0.216, 0.5, 0.385, 0.012, 0.4],
  ];
  drums.forEach(([x0, x1, r, zc, turn], d) => {
    const pt = (x: number, k: number): [number, number, number] => {
      const a = turn + (k / 6) * Math.PI * 2;
      return [x, 0.4 + Math.sin(a) * r, zc + Math.cos(a) * r];
    };
    for (let k = 0; k < 6; k++) {
      const am = turn + ((k + 0.5) / 6) * Math.PI * 2;
      const up = Math.sin(am);
      // Ash on the faces that look up (broken where the drum turned); the rest in the column's two values.
      const ash = up > 0.55 && (d !== 1 || k % 2 === 0);
      const fk = (k % 2 ? 0.86 : 1.04) * (0.95 + rnd() * 0.1);
      f.quad(pt(x0, k), pt(x1, k), pt(x1, k + 1), pt(x0, k + 1), ash ? ASH_TOP : t.rock[d % 2], [0, up, Math.cos(am)], ash ? 0.95 : fk * (0.7 + 0.3 * Math.max(0, up)));
    }
    // The broken ends, a paler dull plum-grey.
    for (const [x, sx] of [[x0, -1], [x1, 1]] as const) for (let k = 1; k < 5; k++) f.tri(pt(x, 0), pt(x, k), pt(x, k + 1), t.broke, [sx, 0, 0], 0.85 + rnd() * 0.25);
  });
  return merge([
    f.build(),
    part(new CylinderGeometry(0.22, 0.22, 0.98, 6), ASH_TOP, { rot: [0, 0, Math.PI / 2], pos: [0, 0.03, 0.36], scale: [0.5, 1, 1.2], jitter: 0.05 }),
    part(new CylinderGeometry(0.22, 0.22, 0.98, 6), ASH_TOP, { rot: [0, 0, Math.PI / 2], pos: [0, 0.03, -0.36], scale: [0.5, 1, 1.2], jitter: 0.05 }),
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
  if (charred) return fallenColumn(p!);
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

/** A rounded box of half extents (hx, hy, hz) and corner radius r, `segs` facets a side, with exact
 *  smooth normals over its rounded edges (a gift's wrap reads soft and glossy, not as a cardboard
 *  crate). Each triangle takes one colour from `paint`, given its centre on the unrounded box in grid
 *  units across its face (u, v), the face's axis (0 x, 1 y, 2 z) and its band index along the
 *  facet diagonals, so patterns are crisp and straight-edged on the facet grid. */
function roundedBox(hx: number, hy: number, hz: number, r: number, segs: number, paint: (x: number, y: number, z: number, axis: number, band: number) => Color): BufferGeometry {
  const g = new BoxGeometry(hx * 2, hy * 2, hz * 2, segs, segs, segs).toNonIndexed();
  g.deleteAttribute('uv');
  const p = g.getAttribute('position') as BufferAttribute;
  const nrm = g.getAttribute('normal') as BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const h = [hx, hy, hz];
  const v = [0, 0, 0];
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const axis = Math.abs(nrm.getY(i)) > 0.5 ? 1 : Math.abs(nrm.getX(i)) > 0.5 ? 0 : 2;
    // The face's own two axes, in grid units from its corner.
    const ua = axis === 0 ? 2 : 0;
    const va = axis === 1 ? 2 : 1;
    const grid = (j: number, a: number) => ((a === 0 ? p.getX(j) : a === 1 ? p.getY(j) : p.getZ(j)) + h[a]) / ((2 * h[a]) / segs);
    // The triangle's long edge (the facet diagonal) runs along (1, 1) or (1, -1): bands lie between
    // neighbouring diagonals, so each is a clean straight strip.
    let best = -1;
    let du = 0;
    let dv = 0;
    for (let e = 0; e < 3; e++) {
      const a = i + e;
      const b = i + ((e + 1) % 3);
      const eu = grid(b, ua) - grid(a, ua);
      const ev = grid(b, va) - grid(a, va);
      if (eu * eu + ev * ev > best) {
        best = eu * eu + ev * ev;
        du = eu;
        dv = ev;
      }
    }
    v[0] = cx;
    v[1] = cy;
    v[2] = cz;
    const U = (v[ua] + h[ua]) / ((2 * h[ua]) / segs);
    const V = (v[va] + h[va]) / ((2 * h[va]) / segs);
    const band = Math.floor(du * dv > 0 ? U - V + 64 : U + V);
    const c = paint(cx, cy, cz, axis, band);
    for (let j = i; j < i + 3; j++) col.set([c.r, c.g, c.b], j * 3);
  }
  // Round it: every vertex is pulled onto a radius-r shell round the inner box, its normal the
  // direction out from that box.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const qx = Math.max(-hx + r, Math.min(hx - r, x));
    const qy = Math.max(-hy + r, Math.min(hy - r, y));
    const qz = Math.max(-hz + r, Math.min(hz - r, z));
    const l = Math.hypot(x - qx, y - qy, z - qz) || 1;
    p.setXYZ(i, qx + ((x - qx) / l) * r, qy + ((y - qy) / l) * r, qz + ((z - qz) / l) * r);
    nrm.setXYZ(i, (x - qx) / l, (y - qy) / l, (z - qz) / l);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** A gift (ART.md sections 1 and 3): treasure, not a cardboard box. A rounded, glossy box in its
 *  marigold role wrapped in two tones of diagonal stripes with a few foil facets bright enough to catch
 *  the bloom, a satin ribbon round it (painted into the wrap so it follows the rounded edges), a plump bow of two leaning loops and two tails, and a knot
 *  that glows. A golden gift is gold-white with a mint ribbon. About 640 triangles (the old box was 450). */
/** A spirit light: a small flame of marigold light, round at its foot and drawn to a point, its core paler
 *  than its skin so it reads as glowing, not painted. A great light is half again as big, wears a thin ring
 *  of light around its waist and carries a second, smaller flame beside it, so a great one is told from a
 *  spark at a glance, at speed. The flame stands upright and bobs (the material's bob). */
export function lightGeometry(great: boolean): BufferGeometry {
  // (A flame reads at 30 m/s only at about a box's size: 0.8 m tall, a great one 1.2 m.)
  const s = great ? 2.5 : 1.7;
  const skin = great ? new Color('#FFD86A') : new Color('#FFC94A');
  const core = new Color('#FFF6D8').multiplyScalar(1.5);
  const flame = (k: number, x: number, y: number, col: Color): BufferGeometry =>
    lathe(
      [
        [0, -0.2 * k],
        [0.13 * k, -0.15 * k],
        [0.2 * k, -0.02 * k],
        [0.17 * k, 0.14 * k],
        [0.09 * k, 0.3 * k],
        [0, 0.46 * k],
      ],
      9,
      col,
      { pos: [x, y, 0] },
    );
  const parts = [flame(s, 0, 0, skin), flame(s * 0.62, 0, -0.02 * s, core)];
  if (great) {
    parts.push(part(new TorusGeometry(0.34 * s, 0.025 * s, 4, 18), core.clone().multiplyScalar(0.8), { rot: [Math.PI / 2, 0, 0], pos: [0, 0.02 * s, 0] }));
    parts.push(flame(0.42, 0.42 * s, 0.22 * s, skin));
  }
  return merge(parts);
}

export function giftGeometry(golden: boolean): BufferGeometry {
  reseed(golden ? 3131 : 3030);
  const s = golden ? 1.35 : 1;
  const deep = golden ? new Color('#FFD86A') : new Color('#FFBE2E');
  const pale = golden ? new Color('#FFF2C4') : new Color('#FFE27A');
  const foil = golden ? new Color('#FFF6DA').multiplyScalar(1.6) : new Color('#FFE9A0').multiplyScalar(1.55);
  const ribbon = golden ? new Color('#8FF3E4') : new Color('#FF4D2E');
  const sheen = golden ? new Color('#C8FFF6') : new Color('#FF6A4A');
  const ribbonDeep = shade(ribbon, 0.78);
  const hx = 0.31 * s;
  const hy = 0.28 * s;
  const cell = (2 * hx) / 5;
  const box = roundedBox(hx, hy, hx, 0.07 * s, 5, (x, _y, z, axis, band) => {
    // The ribbon: the middle facet column of each face, crossing on the lid, where the satin catches
    // the light (one facet of each pair a sheen, so it reads as a soft fold).
    const ax = Math.abs(x);
    const az = Math.abs(z);
    const w = cell * 0.5;
    const onRib = axis === 1 ? ax < w || az < w : axis === 0 ? az < w : ax < w;
    if (onRib) return axis === 1 && ax < w && az < w ? sheen : band % 2 === 0 ? ribbon : ribbonDeep;
    if (band % 2 === 0) return deep;
    return rnd() < 0.18 ? foil : pale;
  });
  const knot = ribbon.clone().multiplyScalar(1.45);
  const top = hy + 0.01 * s;
  return merge([
    box,
    // The bow: two plump satin loops leaning out from the knot and a little back, flattened like
    // ribbon, open to the sides so they read as loops from any side (edge on they read as ears).
    smoothPart(new TorusGeometry(0.14 * s, 0.042 * s, 5, 12), ribbon, { pos: [-0.13 * s, top + 0.075 * s, 0], rot: [0.35, 0.55, 0.42], scale: [1.15, 0.8, 0.6] }),
    smoothPart(new TorusGeometry(0.14 * s, 0.042 * s, 5, 12), ribbon, { pos: [0.13 * s, top + 0.075 * s, 0], rot: [0.35, -0.55, -0.42], scale: [1.15, 0.8, 0.6] }),
    // Two tails falling from the knot across the lid, toward the lens and away from it.
    part(new BoxGeometry(0.075 * s, 0.014 * s, 0.2 * s), ribbonDeep, { pos: [0.05 * s, top + 0.012 * s, 0.1 * s], rot: [0.12, 0.3, 0] }),
    part(new BoxGeometry(0.075 * s, 0.014 * s, 0.2 * s), ribbonDeep, { pos: [-0.05 * s, top + 0.012 * s, -0.1 * s], rot: [-0.12, 0.3, 0] }),
    // The knot glows a little (bright enough to bloom on Medium and High).
    smoothPart(new SphereGeometry(0.068 * s, 8, 6), knot, { pos: [0, top + 0.035 * s, 0], scale: [1.15, 0.9, 1] }),
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
export function obstacleGeometry(kind: ObstacleKind, p: Palette, low = false): BufferGeometry {
  switch (kind) {
    case 'pine':
      return hazardPineGeometry(p);
    case 'charpine':
      return charPineGeometry(p);
    case 'blossom':
      return blossomGeometry(p);
    case 'rock':
      return rockGeometry(p.low, p.lowLit, 0, low);
    case 'iceblock':
      return iceBlockGeometry(p);
    case 'spire':
      return spireGeometry(p);
    case 'serac':
      return seracGeometry(p);
    case 'basalt':
      return basaltGeometry(p, low);
    case 'lavarock':
      return lavaRockGeometry(p, low);
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
      return ROCK_MODEL_R;
    case 'iceblock':
      return 1.0;
    case 'serac':
      return 1.9;
    case 'basalt':
      return BASALT_MODEL_R;
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

/** The steel shoe under a wooden sled's runners: pale, so it catches the light along the snow. */
const STEEL = new Color('#B9C3D8');

/** Where the scarf is knotted at the back of the neck (body pivot space); its tails stream from here. */
export const SCARF_KNOT = new Vector3(0, 0.6, 0.245);

/** Wood grain in a part's vertex colours: fine streaks along z (its length) that wander a little in
 *  value, each facet its own, a few darker knots, and ends a step darker where the end grain shows.
 *  The chase lens looks down the deck from behind, so the grain runs the way it looks. */
function grain(g: BufferGeometry, z0: number, z1: number): BufferGeometry {
  const pos = g.getAttribute('position') as BufferAttribute;
  const col = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const streak = Math.sin(cx * 160 + Math.sin(cz * 5.3) * 1.6) * 0.5 + 0.5;
    let k = 0.9 + 0.13 * streak + (rnd() - 0.5) * 0.06;
    if (rnd() < 0.035) k *= 0.72;
    const end = Math.min(cz - z0, z1 - cz);
    if (end < 0.05) k *= 0.82;
    for (let j = i; j < i + 3; j++) col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
  }
  return g;
}

/** Sled: deck along -z (forward). Round 7 gives it a shape of its own: five grained slats on two cross
 *  pieces, runners that sweep up off the snow at the nose and scroll back over to a wooden foot bar (a
 *  real curl, where the old one was an arch standing on the runner), a steel shoe that catches the light
 *  along the snow, tails that flick up, and a low bow of bent wood behind the seat, which is the part of
 *  it the chase lens sees. `lite` is Low's: fewer sides, no bow. */
export function sledGeometry(runner: Color = RIDER_COLORS.accent, lite = false): BufferGeometry {
  const C = RIDER_COLORS;
  reseed(5150);
  const parts: BufferGeometry[] = [];
  const slats = lite ? 3 : 5;
  const span = 0.6;
  const sw = span / slats - 0.016;
  for (let i = 0; i < slats; i++) {
    const z = 0.05;
    const x = -span / 2 + (i + 0.5) * (span / slats);
    parts.push(grain(part(new BoxGeometry(sw, 0.055, 1.28, lite ? 1 : 2, 1, lite ? 4 : 10), i % 2 ? C.woodDark : C.wood, { pos: [x, 0.2, z] }), z - 0.64, z + 0.64));
  }
  parts.push(grain(part(new BoxGeometry(0.64, 0.05, 0.1, lite ? 2 : 6, 1, 1), C.woodDark, { pos: [0, 0.165, -0.42] }), -0.47, -0.37));
  parts.push(grain(part(new BoxGeometry(0.64, 0.05, 0.1, lite ? 2 : 6, 1, 1), C.woodDark, { pos: [0, 0.165, 0.5] }), 0.45, 0.55));
  const sides = lite ? 5 : 7;
  // The curl: up off the snow at the nose, forward, over the top and back down toward the deck, the
  // scroll tightening and the tube thinning as it goes.
  const curl: Vector3[] = [];
  const steps = lite ? 5 : 8;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = -Math.PI / 2 + u * Math.PI * 1.42;
    const r = 0.185 * (1 - 0.3 * u * u);
    curl.push(new Vector3(0, 0.215 + r * Math.sin(a), -0.71 - r * Math.cos(a)));
  }
  for (const sx of [-0.3, 0.3]) {
    parts.push(part(new BoxGeometry(0.052, 0.052, 1.46), runner, { pos: [sx, 0.03, 0.03] }));
    parts.push(part(new BoxGeometry(0.036, 0.016, 1.44), STEEL, { pos: [sx, 0.0, 0.03] }));
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      parts.push(capsule(curl[i].clone().setX(sx), curl[i + 1].clone().setX(sx), 0.03 - 0.008 * u, 0.03 - 0.008 * (u + 1 / steps), runner, sides));
    }
    // The tail flicks up off the snow.
    parts.push(capsule(new Vector3(sx, 0.03, 0.74), new Vector3(sx, 0.1, 0.86), 0.028, 0.02, runner, sides));
    for (const z of lite ? [0.4, -0.32] : [0.5, 0.08, -0.36]) parts.push(part(new BoxGeometry(0.04, 0.15, 0.045), runner, { pos: [sx, 0.105, z] }));
  }
  // The foot bar across the curls' tops.
  const top = curl[Math.round(steps * 0.63)];
  parts.push(part(new CylinderGeometry(0.027, 0.027, 0.7, lite ? 5 : 7), C.woodDark, { pos: [0, top.y, top.z], rot: [0, 0, Math.PI / 2] }));
  if (!lite) {
    // The bow behind the seat: a low arch of bent wood from one runner's stanchion to the other.
    const bow: Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI;
      bow.push(new Vector3(-0.29 * Math.cos(a), 0.215 + 0.13 * Math.sin(a), 0.66 + 0.03 * Math.sin(a)));
    }
    for (let i = 0; i < 6; i++) parts.push(capsule(bow[i], bow[i + 1], 0.024, 0.024, i % 2 ? C.wood : C.woodDark, 6));
  }
  return merge(parts);
}

/** A sled paint (game/paints.ts): every vertex but the vermillion trim, the steel and the pale bits takes
 *  the paint's colour at its own value, so the wood's grain and the hull's shading stay under it. */
export function paintSled(geo: BufferGeometry, hex: string): BufferGeometry {
  if (!hex) return geo;
  const col = geo.getAttribute('color') as BufferAttribute | undefined;
  if (!col) return geo;
  const paint = new Color(hex);
  const pv = 0.2126 * paint.r + 0.7152 * paint.g + 0.0722 * paint.b;
  const keep = [RIDER_COLORS.accent, STEEL, RIDER_COLORS.pom];
  const c = new Color();
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    // The trim keeps the player's colour; steel and the white trims stay as they are.
    if (keep.some((k) => Math.abs(k.r - c.r) + Math.abs(k.g - c.g) + Math.abs(k.b - c.b) < 0.32)) continue;
    const v = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const k = Math.max(0.35, Math.min(1.6, v / 0.52)) * (pv > 0.6 ? 0.92 : 1);
    col.setXYZ(i, paint.r * k, paint.g * k, paint.b * k);
  }
  col.needsUpdate = true;
  return geo;
}

/** Each unlockable sled gets its own silhouette so an unlock is visible at a glance. */
export function sledGeometryFor(id: number, lite = false): BufferGeometry {
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
      return sledGeometry(RIDER_COLORS.accent, lite);
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


/** How much bigger the hero and every ghost are drawn than the 1.25 m toy they were modelled as (round
 *  7: the rider is in every frame, and was a tenth of its height). Presentation only: the sim's sled is
 *  a 0.55 m disc whatever is drawn. rider.ts and ghosts.ts scale their rigs by it. */
export const RIDER_SCALE = 1.2;

/** The seated rider as drawn, sled base to the top of the pom-pom, and half its width with the arms at
 *  rest (metres): what the playtest probes measure it by. */
export const RIDER_HEIGHT = 1.3 * RIDER_SCALE;
export const RIDER_HALF_WIDTH = 0.55 * RIDER_SCALE;

/** How much of the hero is built: the whole figure, or Low's cheaper one (fewer sides to every round
 *  part and none of the small trim that only a close lens resolves). */
export type RiderDetail = 'full' | 'lite';

/** Per-vertex secondary-motion weights, which rider.ts animates in its vertex shader. Every rider part
 *  carries the attribute (zero on rigid parts), so the parts still merge into one geometry.
 *    x  how much of the pom-pom's bounce a vertex takes; -1 marks the legs out in front, which swing
 *       down about the hips when the rider stands up on its sled over the finish line
 *    y  how much of the coat hem's flutter
 *    z  how soft it is: how much of the body's own lag it takes (the hood on the back, a hat's tail,
 *       the boots' toes), so what hangs off the rider arrives late and settles
 *    w  an arm's joints: 1 below the elbow (the forearm bends about it), 2 the mitt (which also flops
 *       at the wrist) */
type SwayW = [number, number] | [number, number, number] | [number, number, number, number];
type SwayFn = (x: number, y: number, z: number) => SwayW;
function sway(g: BufferGeometry, w: SwayFn | SwayW = [0, 0]): BufferGeometry {
  const p = g.getAttribute('position');
  const a = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const v = typeof w === 'function' ? w(p.getX(i), p.getY(i), p.getZ(i)) : w;
    a[i * 4] = v[0];
    a[i * 4 + 1] = v[1];
    a[i * 4 + 2] = v[2] ?? 0;
    a[i * 4 + 3] = v[3] ?? 0;
  }
  g.setAttribute('aSway', new BufferAttribute(a, 4));
  return g;
}

/** Mutates a part's positions and refreshes its flat normals: a lathed form pushed out of round (the
 *  coat's shoulders, its tail). */
function reshape(g: BufferGeometry, f: (x: number, y: number, z: number, out: [number, number, number]) => void): BufferGeometry {
  const p = g.getAttribute('position') as BufferAttribute;
  const o: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    f(p.getX(i), p.getY(i), p.getZ(i), o);
    p.setXYZ(i, o[0], o[1], o[2]);
  }
  g.computeVertexNormals();
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
export const RIDER_POM = new Vector3(0, 1.235, 0.02);

/** The head in body pivot space: a toy face (two dark oval eyes with a catchlight and a soft blush on
 *  each cheek) under a beanie pulled low, the goggles pushed up onto its front, ear flaps and hair at
 *  the nape. The chase camera always sees the back of the head, so the back carries the detail: a
 *  ribbed cuff, a seam up the crown, a cream knit stripe, a fluffy pom-pom (which bounces: aSway.x)
 *  and a bob of hair that flares a little and rolls under above the scarf (one smooth dark mass read
 *  as a helmet). A ghost wears only the silhouette (head, beanie and pom-pom): thin straps and lenses
 *  inside the glass drew their own rims and read as dotted seams. */
export function riderHeadGeometry(ghost = false, hat: HatId = 'beanie', lite = false): BufferGeometry {
  reseed(4242);
  const C = RIDER_COLORS;
  if (ghost) {
    const pom = sway(part(new IcosahedronGeometry(0.115, 1), C.pom, { pos: [RIDER_POM.x, RIDER_POM.y, RIDER_POM.z], jitter: 0.03 }), [1, 0]);
    return mergeRider([
      part(new SphereGeometry(0.24, 12, 9), C.skin, { pos: [0, 0.86, 0] }),
      // The beanie, pulled down to just above the eyes.
      part(new SphereGeometry(0.25, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.accent, { pos: [0, 0.915, 0.01], scale: [1.04, 1.12, 1.04] }),
      pom,
    ]);
  }
  const eye = new Color('#1B1E36');
  const blush = new Color('#FF8E9E');
  const parts: BufferGeometry[] = [
    part(new SphereGeometry(0.24, lite ? 10 : 14, lite ? 7 : 10), C.skin, { pos: [0, 0.86, 0] }),
    // Hair round the back and sides under the cuff: a bob that flares a little past the skull...
    smoothPart(new SphereGeometry(0.249, lite ? 10 : 18, lite ? 5 : 8, -0.25, Math.PI + 0.5, 1.3, 1.15), C.hair, { pos: [0, 0.86, 0.004], scale: [1.05, 1, 1.08] }),
  ];
  // ...ending in a scalloped fringe of overlapping locks across the nape just above the scarf: from
  // behind the hair reads as a cut, not as a dark hole under the beanie (two tufts read as a pair of
  // closed eyes, and five lighter locks as a row of teeth).
  for (const [a, s] of [[-0.95, 0.85], [-0.48, 1], [0, 1.08], [0.48, 1], [0.95, 0.85]] as const) {
    const r = 0.212;
    parts.push(
      smoothPart(new SphereGeometry(0.056 * s, lite ? 6 : 8, lite ? 4 : 6), C.hair, {
        pos: [Math.sin(a) * r * 1.05, 0.725 - 0.012 * Math.abs(a), Math.cos(a) * r * 1.08 - 0.01],
        rot: [0.35, a, 0],
        scale: [1.45, 1.25, 0.6],
      }),
    );
  }
  for (const sx of [-1, 1]) {
    // Oval eyes just under the cuff, flattened onto the face.
    parts.push(part(new SphereGeometry(0.04, lite ? 6 : 9, lite ? 4 : 7), eye, { pos: [sx * 0.08, 0.82, -0.211], rot: [0, -sx * 0.34, 0], scale: [0.8, 1.18, 0.5] }));
    if (lite) continue;
    parts.push(
      // A catchlight high and outside and a smaller one low and inside, a soft blush on each cheek, and
      // a lock of the fringe showing under the cuff: the close lenses (the title, the garage, the
      // finish) get a face that looks back at them.
      part(new SphereGeometry(0.012, 5, 4), C.pom, { pos: [sx * 0.091, 0.836, -0.229] }),
      part(new SphereGeometry(0.006, 4, 3), C.pom, { pos: [sx * 0.072, 0.808, -0.232] }),
      part(new SphereGeometry(0.042, 8, 6), blush, { pos: [sx * 0.14, 0.77, -0.168], rot: [0, -sx * 0.68, 0], scale: [1.25, 0.72, 0.32] }),
      smoothPart(new SphereGeometry(0.05, 7, 5), C.hair, { pos: [sx * 0.07, 0.868, -0.2], rot: [0.5, -sx * 0.3, sx * 0.5], scale: [1.5, 0.6, 0.5] }),
    );
  }
  if (!lite) {
    parts.push(
      // A button nose and a small, pleased mouth: an arc turned up at its corners, a shade under the blush.
      part(new SphereGeometry(0.025, 7, 5), shade(C.skin, 0.93), { pos: [0, 0.797, -0.238], scale: [1, 0.85, 0.7] }),
      part(new TorusGeometry(0.032, 0.007, 4, 8, Math.PI * 0.62), new Color('#B4524E'), { pos: [0, 0.782, -0.219], rot: [0.2, 0, Math.PI * 1.19] }),
    );
  }
  parts.push(...playerHat(hat, lite));
  return mergeRider(parts);
}

/**
 * The player's hat (the garage, round 6; garage.ts names them). Every one is the player's vermillion with
 * the beanie's cream for its knit and poms, and each is told from the others by its outline from behind,
 * where the chase lens always sees it: the cuffed pom beanie, a short watch cap with a thick rolled cuff, a
 * pom over each ear, a trapper's cream fur brim and long flaps, a ring of bobbles round the crown, a
 * pointed chullo with braided ties, and a long stocking cap that streams out behind. None is any signature
 * rider's hat (meshes.ts ghostHatHead), and the goggles stay pushed up on the front of every one.
 */
function playerHat(hat: HatId, lite = false): BufferGeometry[] {
  const C = RIDER_COLORS;
  const cuff = shade(C.accent, 0.8);
  const out: BufferGeometry[] = [];
  const dome = (sy = 1.12) => part(new SphereGeometry(0.25, lite ? 10 : 14, lite ? 4 : 6, 0, Math.PI * 2, 0, Math.PI / 2), C.accent, { pos: [0, 0.915, 0.01], scale: [1.04, sy, 1.04] });
  const ribbed = (r0: number, r1: number, h: number, y: number) => ribs(part(new CylinderGeometry(r0, r1, h, lite ? 12 : 24, 1, true), cuff, { pos: [0, y, 0.01] }), lite ? 12 : 24, 0.84);
  const stripe = (sy = 1.12) => part(new SphereGeometry(0.256, lite ? 10 : 14, 1, 0, Math.PI * 2, 0.85, 0.16), C.pom, { pos: [0, 0.915, 0.01], scale: [1.04, sy, 1.04] });
  const seam = (sy = 1.12) => part(new TorusGeometry(0.26, 0.009, 3, 8, Math.PI / 2), shade(C.accent, 0.7), { pos: [0, 0.915, 0.01], rot: [0, -Math.PI / 2, 0], scale: [1.04, sy, 1.04] });
  const flaps = (scale: [number, number, number] = [0.5, 1.5, 0.98], y = 0.775) => {
    for (const sx of [-1, 1]) out.push(part(new SphereGeometry(0.085, lite ? 6 : 9, lite ? 4 : 6), cuff, { pos: [sx * 0.238, y, 0.035], rot: [0, 0, sx * 0.1], scale }));
  };
  const pom = (x: number, y: number, z: number, r: number, w = 1) => sway(part(new IcosahedronGeometry(r, lite ? 0 : 1), C.pom, { pos: [x, y, z], jitter: 0.3 * r }), [w, 0]);
  const goggles = (y = 1.005, z = -0.232) => {
    for (const sx of [-1, 1]) {
      out.push(
        part(new SphereGeometry(0.06, lite ? 6 : 10, lite ? 4 : 7), C.lens, { pos: [sx * 0.086, y, z], rot: [0.28, -sx * 0.36, 0], scale: [1.12, 0.86, 0.42] }),
        part(new TorusGeometry(0.06, 0.017, lite ? 3 : 5, lite ? 8 : 14), C.goggles, { pos: [sx * 0.086, y, z + 0.003], rot: [0.28, -sx * 0.36, 0], scale: [1.12, 0.86, 1] }),
      );
    }
    out.push(part(new BoxGeometry(0.06, 0.03, 0.04), C.goggles, { pos: [0, y - 0.005, z - 0.013], rot: [0.28, 0, 0] }));
  };
  const strap = (r = 0.247, y = 1.0) => part(new TorusGeometry(r, 0.019, lite ? 3 : 4, lite ? 10 : 18), C.strap, { pos: [0, y, 0.01], rot: [Math.PI / 2 + 0.06, 0, 0] });
  switch (hat) {
    case 'watch':
      // Short and snug: a lower crown and a thick rolled cuff, no pom-pom.
      out.push(dome(0.98), stripe(0.98), seam(0.98));
      out.push(part(new TorusGeometry(0.262, 0.05, 6, 24), cuff, { pos: [0, 0.905, 0.01], rot: [Math.PI / 2, 0, 0] }));
      out.push(ribbed(0.272, 0.278, 0.07, 0.885));
      flaps([0.48, 1.3, 0.96]);
      goggles(0.99, -0.236);
      out.push(strap(0.24, 0.985));
      break;
    case 'twinpom':
      // The beanie with a pom-pom over each ear and none on top: two bumps from behind.
      out.push(dome(), ribbed(0.268, 0.274, 0.095, 0.905), stripe(), seam());
      out.push(part(new TorusGeometry(0.27, 0.018, 4, 18), shade(C.accent, 0.9), { pos: [0, 0.952, 0.01], rot: [Math.PI / 2, 0, 0] }));
      for (const sx of [-1, 1]) out.push(pom(sx * 0.17, 1.12, 0.03, 0.085));
      flaps();
      goggles();
      out.push(strap());
      break;
    case 'trapper': {
      // A round crown, a thick cream fur brim, the front turned up, and long flaps down past the jaw with
      // a fur edge: from behind a broad hat with two flaps and a cream band.
      out.push(dome(1.08), seam(1.08));
      const fur = part(new TorusGeometry(0.272, 0.058, 7, 26), C.pom, { pos: [0, 0.9, 0.01], rot: [Math.PI / 2, 0, 0], jitter: 0.02 });
      out.push(fur);
      out.push(part(new SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.pom, { pos: [0, 0.95, -0.2], rot: [-1.2, 0, 0], scale: [1.35, 0.5, 0.9], jitter: 0.015 }));
      for (const sx of [-1, 1]) {
        out.push(part(new SphereGeometry(0.1, 10, 8), C.accent, { pos: [sx * 0.25, 0.72, 0.04], rot: [0, 0, sx * 0.08], scale: [0.5, 2.0, 1.2] }));
        out.push(part(new SphereGeometry(0.1, 10, 8), C.pom, { pos: [sx * 0.258, 0.6, 0.04], scale: [0.48, 0.55, 1.1], jitter: 0.01 }));
      }
      // The back flap over the nape.
      out.push(part(new SphereGeometry(0.25, 14, 6, Math.PI * 0.18, Math.PI * 0.64, Math.PI / 2, 0.55), C.accent, { pos: [0, 0.9, 0.03], scale: [1.08, 1.0, 1.1] }));
      goggles(1.03, -0.24);
      break;
    }
    case 'bobbles':
      // The beanie with a ring of small cream bobbles round the crown and one in the middle.
      out.push(dome(), ribbed(0.268, 0.274, 0.095, 0.905), stripe(), seam());
      out.push(part(new TorusGeometry(0.27, 0.018, 4, 18), shade(C.accent, 0.9), { pos: [0, 0.952, 0.01], rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        out.push(pom(Math.sin(a) * 0.16, 1.135, 0.02 + Math.cos(a) * 0.16, 0.052, 0.55));
      }
      out.push(pom(0, 1.2, 0.02, 0.062, 0.8));
      flaps();
      goggles();
      out.push(strap());
      break;
    case 'chullo': {
      // A pointed crown with a little pom-pom at the tip, a cream band, and pointed ear flaps that end in
      // braided ties hanging past the jaw (a braid: beads of vermillion and cream).
      out.push(lathe([[0.262, 0.86], [0.27, 0.95], [0.25, 1.04], [0.2, 1.13], [0.12, 1.22], [0.05, 1.29], [0, 1.31]], 14, C.accent, { pos: [0, 0, 0.01] }));
      out.push(part(new CylinderGeometry(0.259, 0.27, 0.035, 18, 1, true), C.pom, { pos: [0, 0.99, 0.01] }));
      out.push(pom(0, 1.335, 0.01, 0.05, 1));
      for (const sx of [-1, 1]) {
        out.push(part(new ConeGeometry(0.11, 0.26, 8), cuff, { pos: [sx * 0.245, 0.71, 0.03], rot: [Math.PI, 0, -sx * 0.08], scale: [0.55, 1, 1.05] }));
        for (let k = 0; k < 5; k++) {
          const y = 0.57 - k * 0.045;
          out.push(sway(part(new SphereGeometry(0.024, 6, 5), k % 2 ? C.pom : C.accent, { pos: [sx * (0.255 + 0.004 * k), y, 0.03 + 0.008 * k] }), [0.15 + 0.15 * k, 0]));
        }
        out.push(sway(part(new ConeGeometry(0.03, 0.07, 6), C.pom, { pos: [sx * 0.277, 0.33, 0.07] }), [0.9, 0]));
      }
      goggles(1.0, -0.236);
      break;
    }
    case 'longcap': {
      // A stocking cap: the cuffed crown runs on into a long tapering tail that streams back and down
      // past one shoulder, a pom-pom at its end; the tail takes the pom-pom's spring, more toward its tip.
      out.push(dome(), ribbed(0.268, 0.274, 0.095, 0.905), stripe(), seam());
      out.push(part(new TorusGeometry(0.27, 0.018, 4, 18), shade(C.accent, 0.9), { pos: [0, 0.952, 0.01], rot: [Math.PI / 2, 0, 0] }));
      const path = [new Vector3(0, 1.08, 0.04), new Vector3(0.02, 1.18, 0.16), new Vector3(0.05, 1.19, 0.31), new Vector3(0.1, 1.12, 0.44), new Vector3(0.15, 1.01, 0.52), new Vector3(0.19, 0.9, 0.56)];
      const rad = [0.17, 0.13, 0.1, 0.075, 0.058, 0.045];
      for (let i = 0; i < path.length - 1; i++) {
        const w0 = (i / (path.length - 1)) * 0.9;
        const w1 = ((i + 1) / (path.length - 1)) * 0.9;
        const seg = capsule(path[i], path[i + 1], rad[i], rad[i + 1], i % 2 ? shade(C.accent, 0.92) : C.accent, 10);
        out.push(sway(seg, (x, y, z) => {
          const t = Math.max(0, Math.min(1, ((x - path[i].x) * (path[i + 1].x - path[i].x) + (y - path[i].y) * (path[i + 1].y - path[i].y) + (z - path[i].z) * (path[i + 1].z - path[i].z)) / path[i].distanceToSquared(path[i + 1])));
          return [w0 + (w1 - w0) * t, 0];
        }));
      }
      out.push(pom(0.2, 0.86, 0.57, 0.075, 1));
      flaps();
      goggles();
      out.push(strap());
      break;
    }
    case 'beanie':
    default: {
      // The beanie, pulled down to just above the eyes, its folded cuff a deeper vermillion band of knit
      // ribs a little proud of the crown, a cream knit stripe round the crown high enough to clear the
      // goggle strap (from behind it reads as a knitted hat rather than a red dome), the seam up the back
      // of the crown to the pom-pom, and ear flaps hanging from the cuff over the ears down to the scarf
      // (from behind they square the head off and frame the hair).
      out.push(dome(), pom(RIDER_POM.x, RIDER_POM.y, RIDER_POM.z, 0.115));
      out.push(ribbed(0.268, 0.274, 0.095, 0.905));
      out.push(part(new TorusGeometry(0.27, 0.018, 4, 18), shade(C.accent, 0.9), { pos: [0, 0.952, 0.01], rot: [Math.PI / 2, 0, 0] }));
      out.push(stripe(), seam());
      flaps();
      // The goggles pushed up onto the beanie's front: two amber lenses in dark frames, and their strap
      // round the crown, a cobalt band that also reads from behind.
      goggles();
      out.push(strap());
      break;
    }
  }
  return out;
}

/** The coat's lathe: (radius, height) up the body, then the yoke over the shoulders to the collar. */
const COAT: Array<[number, number]> = [
  [0, 0.0],
  [0.2, 0.004],
  [0.262, 0.03],
  [0.288, 0.078],
  [0.272, 0.14],
  [0.226, 0.215],
  [0.216, 0.3],
  [0.24, 0.4],
  [0.262, 0.49],
];
const YOKE: Array<[number, number]> = [
  [0.262, 0.49],
  [0.262, 0.55],
  [0.24, 0.605],
  [0.182, 0.648],
  [0.095, 0.672],
  [0, 0.68],
];
/** The coat is a little deeper across than front to back, and sits a touch behind the hips. */
const COAT_DEEP = 0.9;
const COAT_Z = 0.02;

/** Where an arm hangs from (body pivot space, the right one; the left mirrors it): out on the broad
 *  shoulder, so the arms frame the back instead of hanging down its sides. */
export const RIDER_SHOULDER = new Vector3(0.295, 0.56, 0);

/** The coat off the lathe: the shoulders pushed out broader than the chest (a wedge from behind, where
 *  the round coat was a bottle), and the hem's back swept out into a short tail over the seat. */
function coatShape(x: number, y: number, z: number, out: [number, number, number]): void {
  const sh = smooth01((y - 0.34) / 0.18) * (1 - smooth01((y - 0.6) / 0.09));
  const tail = (1 - smooth01((y - 0.02) / 0.2)) * smooth01((z - COAT_Z) / 0.2);
  out[0] = x * (1 + 0.17 * sh);
  out[1] = y;
  out[2] = COAT_Z + (z - COAT_Z) * (1 + 0.2 * tail);
}

/** A point on the coat's surface at a height and a bearing round it (0 the back, PI the front), `lift`
 *  metres proud of it: where the trim is sewn on. */
function onCoat(y: number, a: number, lift = 0): Vector3 {
  const prof = y <= 0.49 ? COAT : YOKE;
  let r = prof[prof.length - 1][0];
  for (let i = 1; i < prof.length; i++) {
    if (y <= prof[i][1]) {
      const [r0, y0] = prof[i - 1];
      const [r1, y1] = prof[i];
      r = r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
      break;
    }
  }
  const o: [number, number, number] = [0, 0, 0];
  coatShape(Math.sin(a) * (r + lift), y, COAT_Z + Math.cos(a) * (r + lift) * COAT_DEEP, o);
  return new Vector3(o[0], o[1], o[2]);
}

/** The coat (round 7): a parka with a shape. A padded hem flaring over the hips with a short tail at
 *  the back, nipped in at the waist, full at the chest and broad across the shoulders under a cobalt
 *  yoke; a hood lying on the back under the scarf's knot, its fur edge a cream horseshoe (the chase lens
 *  only ever sees the back, so the back carries the coat's one big shape); and, for the lenses that
 *  come round to the front, a zip with three wooden toggles, two pocket flaps and a belt. The hem's
 *  vertices carry the flutter weight (aSway.y) and the hood the body's lag (aSway.z). A ghost wears the
 *  form alone: thin trim inside the glass drew its own rims. */
function coatGeometry(ghost: boolean, lite: boolean): BufferGeometry {
  const C = RIDER_COLORS;
  const segs = lite ? 10 : 16;
  const hem: SwayFn = (_x, y) => [0, 1 - smooth01((y - 0.05) / 0.16)];
  const lathed = (prof: Array<[number, number]>, col: Color) => reshape(lathe(prof, segs, col, { pos: [0, 0, COAT_Z], scale: [1, 1, COAT_DEEP] }), coatShape);
  const parts: BufferGeometry[] = [sway(lathed(COAT, C.coat), hem), sway(lathed(YOKE, C.yoke))];
  // The hood: a soft bundle between the shoulder blades.
  const soft: SwayW = [0, 0, 0.6];
  parts.push(sway(part(new SphereGeometry(0.13, lite ? 8 : 12, lite ? 5 : 8), C.yoke, { pos: [0, 0.47, 0.25], scale: [1.2, 1.1, 0.52] }), soft));
  if (ghost) return merge(parts.map(withSway));
  // Its fur edge, hanging in a horseshoe from shoulder to shoulder.
  reseed(2718);
  parts.push(sway(part(new TorusGeometry(0.145, 0.036, lite ? 4 : 6, lite ? 8 : 14, Math.PI * 1.2), C.pom, { pos: [0, 0.53, 0.292], rot: [-0.14, 0, Math.PI * 0.9], scale: [1.08, 1.2, 0.8], jitter: lite ? 0 : 0.016 }), soft));
  if (lite) return merge(parts.map(withSway));
  const seam = shade(C.coat, 0.72);
  // A puffer's quilting: two stitched seams round the body above the hem.
  for (const y of [0.3, 0.4]) {
    const ring: Vector3[] = [];
    for (let i = 0; i <= 16; i++) ring.push(onCoat(y, (i / 16) * Math.PI * 2, 0.002));
    for (let i = 0; i < 16; i++) parts.push(part(new BoxGeometry(0.012, 0.012, ring[i].distanceTo(ring[i + 1]) + 0.004), seam, { pos: ring[i].clone().lerp(ring[i + 1], 0.5).toArray() as [number, number, number], rot: [0, Math.atan2(ring[i + 1].x - ring[i].x, ring[i + 1].z - ring[i].z), 0] }));
  }
  // The belt, a shade lighter, with its buckle at the front.
  const belt: Vector3[] = [];
  for (let i = 0; i <= 16; i++) belt.push(onCoat(0.222, (i / 16) * Math.PI * 2, 0.004));
  for (let i = 0; i < 16; i++) parts.push(part(new BoxGeometry(0.014, 0.04, belt[i].distanceTo(belt[i + 1]) + 0.006), C.strap, { pos: belt[i].clone().lerp(belt[i + 1], 0.5).toArray() as [number, number, number], rot: [0, Math.atan2(belt[i + 1].x - belt[i].x, belt[i + 1].z - belt[i].z), 0] }));
  const buckle = onCoat(0.222, Math.PI, 0.012);
  parts.push(part(new BoxGeometry(0.06, 0.05, 0.014), STEEL, { pos: [buckle.x, buckle.y, buckle.z] }));
  // The zip up the front, and three wooden toggles across it.
  for (let i = 0; i < 7; i++) {
    const y = 0.07 + i * 0.07;
    const p = onCoat(y, Math.PI, 0.004);
    const q = onCoat(y + 0.07, Math.PI, 0.004);
    if (Math.abs(y + 0.035 - 0.222) < 0.03) continue;
    parts.push(part(new BoxGeometry(0.02, 0.074, 0.01), STEEL, { pos: [0, (p.y + q.y) / 2, (p.z + q.z) / 2], rot: [Math.atan2(q.z - p.z, q.y - p.y), 0, 0] }));
  }
  for (const y of [0.14, 0.33, 0.46]) {
    const p = onCoat(y, Math.PI, 0.016);
    parts.push(capsule(new Vector3(-0.04, p.y, p.z), new Vector3(0.04, p.y, p.z), 0.014, 0.014, C.wood, 5));
  }
  // A pocket flap on each hip.
  for (const sx of [-1, 1]) {
    const a = Math.PI - sx * 0.62;
    const p = onCoat(0.125, a, 0.006);
    parts.push(part(new BoxGeometry(0.11, 0.05, 0.014), C.yoke, { pos: [p.x, p.y, p.z], rot: [0, a, 0] }));
  }
  return merge(parts.map(withSway));
}

function smooth01(x: number): number {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * (3 - 2 * k);
}

/** A boot in line with the shin (the cross-legged rider's): a soft, flat-soled capsule from the ankle. */
function boot(ankle: Vector3, toe: Vector3, sides: number): BufferGeometry {
  return capsule(ankle, toe, 0.09, 0.08, RIDER_COLORS.goggles, sides, 0.8);
}

/** Torso, scarf wrap and legs (no head), pivot at the hips: seated with the legs out along -z, or
 *  cross-legged (thighs out to knees past the hips, shins crossed in front, a seat under the coat).
 *  A ghost leaves out the scarf wrap and its knot, and the coat's trim. `lite` is Low's build. */
export function riderTorsoGeometry(crossLegged = false, ghost = false, lite = false): BufferGeometry {
  const C = RIDER_COLORS;
  const parts = [...riderLegs(crossLegged, ghost, lite), coatGeometry(ghost, lite)];
  if (!ghost) {
    parts.push(
      // scarf wrap, dipping to the knot at the back (the two tails are simulated in rider.ts)
      part(new TorusGeometry(0.19, 0.07, lite ? 5 : 6, lite ? 10 : 14), C.accent, { pos: [0, 0.655, 0.02], rot: [Math.PI / 2 + 0.18, 0, 0] }),
      part(new IcosahedronGeometry(0.085, 0), shade(C.accent, 0.88), { pos: [SCARF_KNOT.x, SCARF_KNOT.y, SCARF_KNOT.z - 0.015], scale: [1.2, 0.9, 0.85] }),
    );
  }
  return mergeRider(parts);
}

/** A ghost's legs alone, seated on its sled as ghostRiderGeometry seats the body (sled space): the
 *  ghost's glass sled mesh carries them as a faint lap, so the dissolving body still sits on its sled. */
export function ghostLegsGeometry(seat: SledSeat = SEAT_SIT): BufferGeometry {
  const g = mergeRider(riderLegs(seat.crossLegged, true, true));
  g.rotateX(-0.15 - seat.lean);
  g.translate(0, seat.y, seat.z);
  return g;
}

function riderLegs(crossLegged: boolean, ghost: boolean, lite: boolean): BufferGeometry[] {
  const C = RIDER_COLORS;
  const legs: BufferGeometry[] = [];
  const sides = lite ? 6 : 9;
  const fur = (at: Vector3, axis: Vector3, w: SwayW): BufferGeometry => {
    const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis.clone().normalize()));
    return sway(part(new TorusGeometry(0.088, 0.03, lite ? 4 : 5, lite ? 7 : 10), C.pom, { pos: [at.x, at.y, at.z], rot: [e.x, e.y, e.z], jitter: lite ? 0 : 0.012 }), w);
  };
  if (crossLegged) {
    // The hips carry the coat's line down to the disc, so the knees read as their own lumps.
    const cross: BufferGeometry[] = [lathe([[0, -0.15], [0.2, -0.14], [0.255, -0.08], [0.25, 0.0], [0.2, 0.05], [0, 0.06]], lite ? 8 : 12, C.pants, { pos: [0, 0, 0.03] })];
    for (const sx of [-1, 1]) {
      const knee = new Vector3(sx * 0.42, -0.07, -0.18);
      // The shins cross in front, one a touch above the other.
      const ankle = new Vector3(-sx * 0.15, sx > 0 ? -0.09 : -0.12, -0.38);
      cross.push(
        capsule(new Vector3(sx * 0.1, -0.03, 0.02), knee, 0.122, 0.108, C.pants, sides),
        capsule(knee, ankle, 0.104, 0.088, C.pants, sides),
        boot(ankle.clone().add(new Vector3(-sx * 0.02, 0, 0)), ankle.clone().add(new Vector3(-sx * 0.12, 0, -0.09)), sides),
      );
      if (!ghost) cross.push(fur(ankle, ankle.clone().sub(knee), [0, 0]));
    }
    // Modelled flat on the disc, then tipped back by the seat's lean, which the pose tips forward.
    const g = mergeRider(cross);
    g.rotateX(0.15 + CROSS_LEAN);
    legs.push(g);
  } else {
    // Thighs taper to a raised, rounded knee and the shins to the ankle, into boots a toy's size: the
    // shaft runs on from the shin and the foot turns up from it, toes to the sky and soles to the way it
    // is going (in line with the shin, as they were, the feet read as two stumps). Standing up on the
    // deck over the line, the whole leg swings down about the hip (aSway.x -1) and the feet come flat.
    for (const sx of [-1, 1]) {
      const hip = new Vector3(sx * 0.12, 0.05, -0.02);
      const knee = new Vector3(sx * 0.13, 0.125, -0.34);
      const ankle = new Vector3(sx * 0.13, 0.045, -0.58);
      const heel = new Vector3(ankle.x, ankle.y - 0.03, ankle.z - 0.075);
      const toe = new Vector3(ankle.x, ankle.y + 0.135, ankle.z - 0.105);
      const leg: SwayW = [-1, 0];
      // (The toes carry a little of the body's lag: the boots waggle as a landing settles.)
      const foot: SwayFn = (_x, y) => [-1, 0, 0.5 * smooth01((y - ankle.y) / 0.16)];
      legs.push(
        sway(capsule(hip, knee, 0.124, 0.108, C.pants, sides), leg),
        sway(capsule(knee, ankle, 0.102, 0.09, C.pants, sides), leg),
        sway(capsule(ankle, heel, 0.094, 0.094, C.goggles, sides), leg),
        sway(capsule(heel, toe, 0.094, 0.082, C.goggles, sides, 1), foot),
      );
      if (ghost) continue;
      legs.push(fur(ankle.clone().lerp(knee, 0.12), ankle.clone().sub(knee), leg));
      if (lite) continue;
      // A knee patch, and the sole: pale, with three treads, facing the lens that comes round the front.
      legs.push(sway(part(new SphereGeometry(0.075, 7, 5), C.strap, { pos: [knee.x, knee.y + 0.062, knee.z + 0.01], scale: [1, 0.45, 1.15] }), leg));
      const mid = heel.clone().lerp(toe, 0.5);
      const tilt = Math.atan2(toe.z - heel.z, toe.y - heel.y);
      legs.push(sway(part(new BoxGeometry(0.15, 0.3, 0.03), shade(C.pom, 0.82), { pos: [mid.x, mid.y, mid.z - 0.085], rot: [tilt, 0, 0] }), foot));
      for (let k = 0; k < 3; k++) {
        const p = heel.clone().lerp(toe, 0.2 + 0.3 * k);
        legs.push(sway(part(new BoxGeometry(0.13, 0.03, 0.012), C.goggles, { pos: [p.x, p.y, p.z - 0.102], rot: [tilt, 0, 0] }), foot));
      }
    }
  }
  return legs;
}

/** The whole seated rider, head included, in one geometry (the sled shop's preview). */
export function riderBodyGeometry(crossLegged = false): BufferGeometry {
  return merge([riderTorsoGeometry(crossLegged), riderHeadGeometry()]);
}

/** An arm's joints (arm space, the shoulder at the origin, the arm hanging down -y): the forearm bends
 *  about the elbow, the mitt flops about the wrist. rider.ts's vertex shader turns the vertices below
 *  each (aSway.w); a build with `bend` baked in (the ghosts, the shop's portrait) turns them here. */
export const ARM_ELBOW = new Vector3(0, -0.235, 0);
export const ARM_WRIST = new Vector3(0, -0.43, 0);
/** The bend a relaxed arm holds (radians, the forearm forward of the upper arm). */
export const ARM_REST_BEND = 0.5;

/** One arm from the shoulder (origin) hanging down -y: a rounded shoulder cap in the yoke's cobalt, a
 *  puffy sleeve tapering to the elbow, a forearm into a cream fur cuff, and a mitt a toy's size in the
 *  player's vermillion with its thumb out in front. The hands are the rider's second signal (round 7):
 *  at speed the rider is a few dozen pixels tall and a navy arm on a navy coat said nothing, so a fist
 *  pumped, a wave or a flail reads by its mitt. Modelled straight; `bend` bakes the elbow in (radians).
 *  A ghost's has no cuff (thin trim inside the glass draws its own rim). */
export function riderArmGeometry(o: { bend?: number; lite?: boolean; ghost?: boolean } = {}): BufferGeometry {
  const C = RIDER_COLORS;
  const lite = !!o.lite;
  const sides = lite ? 6 : 9;
  const shoulder = new Vector3(0, -0.02, 0);
  const lower: SwayW = [0, 0, 0, 1];
  const hand: SwayW = [0, 0, 0, 2];
  const mitt = ARM_WRIST.clone().setY(ARM_WRIST.y - 0.035);
  const tip = ARM_WRIST.clone().setY(ARM_WRIST.y - 0.125);
  const parts: BufferGeometry[] = [
    part(new SphereGeometry(0.102, lite ? 7 : 10, lite ? 5 : 7), C.yoke, { pos: [shoulder.x, shoulder.y + 0.01, shoulder.z] }),
    capsule(shoulder, ARM_ELBOW, 0.092, 0.078, C.coat, sides),
    sway(capsule(ARM_ELBOW, ARM_WRIST, 0.076, 0.066, C.coat, sides), lower),
    // The mitt: a soft paddle a little flatter side to side, and its thumb out in front.
    sway(capsule(mitt, tip, 0.092, 0.082, C.accent, sides, 0.8), hand),
    sway(capsule(mitt.clone().setY(mitt.y - 0.015), new Vector3(0, mitt.y - 0.03, -0.085), 0.038, 0.032, shade(C.accent, 0.9), lite ? 5 : 6), hand),
  ];
  if (!o.ghost) {
    reseed(1618);
    parts.push(sway(part(new TorusGeometry(0.07, 0.03, lite ? 4 : 5, lite ? 7 : 10), C.pom, { pos: [0, ARM_WRIST.y - 0.005, 0], rot: [Math.PI / 2, 0, 0], jitter: lite ? 0 : 0.012 }), lower));
    // An elbow patch, a shade lighter, on the side the chase lens sees.
    if (!lite) parts.push(sway(part(new SphereGeometry(0.06, 7, 5), C.strap, { pos: [0, ARM_ELBOW.y - 0.03, 0.058], scale: [1, 1.25, 0.4] }), lower));
  }
  const g = mergeRider(parts);
  const bend = o.bend ?? ARM_REST_BEND;
  if (bend !== 0) {
    const p = g.getAttribute('position') as BufferAttribute;
    const n = g.getAttribute('normal') as BufferAttribute;
    const w = g.getAttribute('aSway') as BufferAttribute;
    const c = Math.cos(bend);
    const s = Math.sin(bend);
    for (let i = 0; i < p.count; i++) {
      if (w.getW(i) < 0.5) continue;
      const y = p.getY(i) - ARM_ELBOW.y;
      const z = p.getZ(i) - ARM_ELBOW.z;
      p.setY(i, ARM_ELBOW.y + y * c - z * s);
      p.setZ(i, ARM_ELBOW.z + y * s + z * c);
      const ny = n.getY(i);
      const nz = n.getZ(i);
      n.setY(i, ny * c - nz * s);
      n.setZ(i, ny * s + nz * c);
    }
  }
  return g;
}

/** How far each signature hat stands over the crowd's beanie and pom-pom (metres): the name tag is
 *  raised by it, so a tall hood or a top hat never pokes up through its own pill. */
export const HAT_LIFT: Record<HatKind, number> = {
  hood: 0.4, antlers: 0.2, topknot: 0.26, brim: 0, stovepipe: 0.32, bobble: 0.26, beak: 0.2, lantern: 0.2, horns: 0, aviator: 0, foxears: 0.12, crown: 0.16,
};

/** A signature ghost's head (body pivot space, like riderHeadGeometry): the skull and the hat its
 *  rider wears, sized to read as its own outline from behind at 20 to 40 m, where a head is a dozen
 *  pixels across. Parts are chunky (the ghost body welds vertices within 2 cm and draws one smooth
 *  glass silhouette), and no part is thin enough to draw its own rim inside the glass. Original
 *  designs: a felt hood, stubby antlers, a tied topknot, a wide brim, a stovepipe, a giant bobble, a
 *  beaked hood, a lantern on a headband hook, curled horns, a flapped flying cap, fox ears, a crown. */
export function ghostHatHead(hat: HatKind): BufferGeometry {
  const C = RIDER_COLORS.pom;
  const H = 0.86;
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const skull = () => part(new SphereGeometry(0.24, 12, 9), C, { pos: [0, H, 0] });
  // A hood: a little larger than the skull, so it hides it inside the glass.
  const hood = () => part(new SphereGeometry(0.275, 12, 9), C, { pos: [0, H + 0.02, 0.02] });
  const dome = (r = 0.255, sy = 1.1) => part(new SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), C, { pos: [0, H + 0.05, 0.01], scale: [1.04, sy, 1.04] });
  const bend = (g: BufferGeometry, y0: number, f: (t: number) => [number, number], len: number) => {
    const p = g.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, (p.getY(i) - y0) / len);
      const [dx, dz] = f(t);
      p.setXYZ(i, p.getX(i) + dx, p.getY(i), p.getZ(i) + dz);
    }
    g.computeVertexNormals();
    return g;
  };
  const parts: BufferGeometry[] = [];
  switch (hat) {
    case 'hood': {
      // A tall felt hood whose point flops over to one side and back: asymmetric from behind.
      const g = lathe([[0.21, H - 0.2], [0.285, H - 0.1], [0.3, H + 0.04], [0.27, H + 0.2], [0.2, H + 0.36], [0.13, H + 0.52], [0.07, H + 0.66], [0.03, H + 0.78], [0, H + 0.84]], 12, C, { pos: [0, 0, 0.02] });
      parts.push(bend(g, H + 0.18, (t) => [0.3 * t * t, 0.12 * t * t], 0.66));
      break;
    }
    case 'antlers':
      parts.push(hood());
      for (const s of [-1, 1]) {
        const base = v(s * 0.15, H + 0.2, 0.02);
        const tip = v(s * 0.38, H + 0.5, 0.06);
        const mid = base.clone().lerp(tip, 0.55);
        parts.push(
          capsule(base, tip, 0.055, 0.04, C, 7),
          capsule(mid, v(s * 0.24, H + 0.62, 0.02), 0.042, 0.032, C, 6),
          capsule(base.clone().lerp(tip, 0.25), v(s * 0.36, H + 0.26, -0.04), 0.04, 0.03, C, 6),
        );
      }
      break;
    case 'topknot':
      // Hair close to the skull, a band, a tall bun and a fanned tuft over it.
      parts.push(skull(), dome(0.248, 1.0));
      parts.push(part(new CylinderGeometry(0.085, 0.1, 0.07, 10), C, { pos: [0, H + 0.27, 0.03] }));
      parts.push(part(new SphereGeometry(0.11, 10, 8), C, { pos: [0, H + 0.38, 0.03], scale: [1, 1.25, 1] }));
      for (const [x, r] of [[0, 0], [-0.07, -0.45], [0.07, 0.45]] as const) parts.push(part(new ConeGeometry(0.075, 0.24, 8), C, { pos: [x, H + 0.56, 0.03], rot: [Math.PI, 0, r], scale: [1, 1, 0.7] }));
      break;
    case 'brim':
      // A wide flat brim, tipped a touch down at the front, on a low crown.
      parts.push(skull());
      parts.push(part(new CylinderGeometry(0.5, 0.5, 0.05, 20), C, { pos: [0, H + 0.13, 0.02], rot: [0.08, 0, 0] }));
      parts.push(part(new CylinderGeometry(0.19, 0.23, 0.17, 14), C, { pos: [0, H + 0.23, 0.03], rot: [0.08, 0, 0] }));
      break;
    case 'stovepipe':
      // A tall narrow top hat, set a little back and to one side.
      parts.push(skull());
      parts.push(part(new CylinderGeometry(0.29, 0.29, 0.05, 16), C, { pos: [0, H + 0.17, 0.02], rot: [0.1, 0, -0.06] }));
      parts.push(part(new CylinderGeometry(0.17, 0.16, 0.56, 14), C, { pos: [0.02, H + 0.46, 0.05], rot: [0.1, 0, -0.06] }));
      break;
    case 'bobble':
      // The crowd's beanie with a pom-pom twice its size.
      parts.push(skull(), dome());
      parts.push(part(new IcosahedronGeometry(0.21, 1), C, { pos: [0, H + 0.5, 0.03] }));
      break;
    case 'beak': {
      // A hood with a long peak jutting forward and up like a bill, and a short point behind.
      // (Steep enough that from behind it stands over the head as a spike leaning away.)
      parts.push(hood());
      parts.push(capsule(v(0, H + 0.1, -0.18), v(0, H + 0.66, -0.56), 0.14, 0.02, C, 8, 0.6));
      parts.push(capsule(v(0, H + 0.12, 0.2), v(0, H - 0.04, 0.44), 0.1, 0.03, C, 7, 0.6));
      break;
    }
    case 'lantern': {
      // A headband with a hooked rod rising off one side and a little lantern hanging from it.
      parts.push(skull(), part(new TorusGeometry(0.25, 0.04, 6, 16), C, { pos: [0, H + 0.08, 0], rot: [Math.PI / 2, 0, 0] }));
      const a = v(0.2, H + 0.12, 0.1);
      const b = v(0.28, H + 0.62, 0.12);
      const c = v(0.52, H + 0.66, 0.1);
      parts.push(capsule(a, b, 0.045, 0.04, C, 6), capsule(b, c, 0.04, 0.04, C, 6));
      parts.push(part(new CylinderGeometry(0.1, 0.115, 0.22, 8), C, { pos: [0.52, H + 0.42, 0.1] }));
      parts.push(part(new ConeGeometry(0.13, 0.1, 8), C, { pos: [0.52, H + 0.58, 0.1] }));
      break;
    }
    case 'horns':
      // A round helm and two horns curling out, back, down and forward round the ears.
      parts.push(dome(0.262, 1.05), skull());
      for (const s of [-1, 1]) {
        const path = [v(0.18, 1.04, 0), v(0.36, 1.15, 0.05), v(0.48, 1.03, 0.12), v(0.47, 0.87, 0.1), v(0.39, 0.8, -0.01), v(0.33, 0.86, -0.1)];
        for (let i = 0; i < path.length - 1; i++) {
          const r0 = 0.075 - i * 0.009;
          parts.push(capsule(path[i].clone().setX(s * path[i].x), path[i + 1].clone().setX(s * path[i + 1].x), r0, r0 - 0.009, C, 7));
        }
      }
      break;
    case 'aviator':
      // A snug flying cap, its earflaps blown out sideways, the goggles up on top.
      parts.push(skull(), dome(0.255, 1.0));
      for (const s of [-1, 1]) {
        parts.push(part(new SphereGeometry(0.11, 8, 7), C, { pos: [s * 0.3, H - 0.1, 0.03], rot: [0, 0, s * 0.6], scale: [0.45, 1.7, 0.95] }));
        // (Goggles high on the crown, where they stand out of its outline from behind.)
        parts.push(part(new SphereGeometry(0.085, 8, 6), C, { pos: [s * 0.11, H + 0.31, -0.05], rot: [-0.35, 0, s * 0.25], scale: [1.1, 0.9, 0.8] }));
      }
      break;
    case 'foxears':
      // A hood with two tall pointed ears, flat plates facing the way it rides.
      parts.push(hood());
      for (const s of [-1, 1]) parts.push(part(new ConeGeometry(0.11, 0.36, 8), C, { pos: [s * 0.15, H + 0.38, 0.03], rot: [0, 0, -s * 0.32], scale: [1, 1, 0.45] }));
      break;
    case 'crown':
      // A band and a ring of jagged points, tall and short in turn.
      // (The band flares to a lip, so it reads as a crown rather than spiky hair.)
      parts.push(skull(), lathe([[0.235, H + 0.12], [0.255, H + 0.2], [0.3, H + 0.3], [0.29, H + 0.34]], 14, C));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const h = i % 2 === 0 ? 0.3 : 0.18;
        parts.push(part(new ConeGeometry(0.08, h, 6), C, { pos: [Math.sin(a) * 0.27, H + 0.34 + h / 2 - 0.03, Math.cos(a) * 0.27], rot: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25] }));
      }
      break;
  }
  return mergeRider(parts);
}

/** The whole rider merged in a neutral seated pose for the ghosts (one draw call), as a silhouette
 *  only: no scarf, goggles, strap or face, whose thin parts inside the glass drew dotted seams.
 *  `sled` adds the wooden sled under it (the chaos spirit train); the race's ghosts ride their own
 *  glass sleds (ghosts.ts) and pass false. `seat` sits the body as rider.ts sits that sled: on a round
 *  sled cross-legged, leaning over the rim with the head held up. `hat` gives a signature rider's
 *  ghost its own hat in place of the crowd's beanie (merged into the same geometry: no extra draw). */
export function ghostRiderGeometry(sled = true, seat: SledSeat = SEAT_SIT, hat: HatKind | null = null): BufferGeometry {
  const pitch = -0.15 - seat.lean;
  const torso = riderTorsoGeometry(seat.crossLegged, true, true);
  torso.rotateX(pitch);
  const lift = seat.crossLegged ? 0.15 : 0.03;
  const neck = RIDER_NECK.clone().applyAxisAngle(new Vector3(1, 0, 0), pitch);
  // The head stays near upright on its neck (rider.ts holds it), raised on a saucer's forward lean.
  const head = (hat ? ghostHatHead(hat) : riderHeadGeometry(true))
    .translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z)
    .rotateX(pitch - (pitch + 0.15) * 0.7 + 0.06)
    .translate(neck.x, neck.y + lift, neck.z);
  const body = merge([torso, head]);
  body.translate(0, seat.y, seat.z);
  const parts = [body];
  // The rider's relaxed pose: arms down and forward, a little out from the hips (closer in, resting
  // on the knees, when cross-legged).
  for (const sx of [-1, 1]) {
    const sh = new Vector3(sx * RIDER_SHOULDER.x, RIDER_SHOULDER.y, RIDER_SHOULDER.z).applyAxisAngle(new Vector3(1, 0, 0), pitch);
    const arm = riderArmGeometry({ lite: true, ghost: true });
    arm.rotateZ(sx * (seat.crossLegged ? 0.14 : 0.3));
    arm.rotateX(0.72 + pitch);
    arm.translate(sh.x, sh.y + seat.y, sh.z + seat.z);
    // (Marked for the ghosts' own motion, ghosts.ts: -3 the left arm, -4 the right, which lift in the air.)
    const w = arm.getAttribute('aSway') as BufferAttribute;
    for (let i = 0; i < w.count; i++) w.setX(i, sx < 0 ? -3 : -4);
    parts.push(arm);
  }
  if (sled) parts.unshift(withSway(sledGeometry()));
  return merge(parts);
}
