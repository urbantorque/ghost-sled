import { BufferAttribute, BufferGeometry, Color, FrontSide, ShaderMaterial } from 'three';
import type { BiomeId } from '../sim/mountains';
import { LIGHT_GLSL, shared } from './materials';

// The mountain's settlements (midground.ts places them and merges every one in range into a single
// mesh): flat-shaded, vertex-coloured triangle soup, each built in its own local frame (origin on
// its ground at its middle, three.js axes). Every vertex carries a kind: plain, frozen ice, a window
// or a lamp (dark glass by day, warm light from dusk on), or lava (glowing always). Each biome builds
// its own valley town: Pinecrest an alpine village of chalets round a church spire and a frozen lake,
// Frostfang research huts, a dome and a radio mast on a big frozen lake, Ember Peak stone lodges along
// a lava river, Sakura Ridge a temple town with a pagoda, a vermillion gate and lanterns; and its own
// hamlets on the mountain flanks (buildHamlet). Everything is drawn larger than life (chalets about
// 12 m across, windows 2.4 m), because the nearest is a few hundred metres away and the farthest
// about 1.3 km: true scale reads as a smudge.

export const KIND_SOLID = 0;
export const KIND_ICE = 1;
export const KIND_WINDOW = 2;
export const KIND_LAVA = 3;
export const KIND_LAMP = 4;

/** What a village needs to know to build: its biome, a seed, and how far its flat floor reaches
 *  (metres, a circle round the origin; nothing stands outside it). */
export interface VillageSpec {
  biome: BiomeId;
  seed: number;
  radius: number;
  /** Which way the valley runs away from the course: +1 to the right (+x), -1 to the left. */
  side: number;
}

/** A light the halo pass draws at night: local position, size in metres, and a colour index (0 warm
 *  window, 1 street lamp, 2 red lantern or beacon, 3 lava). */
export interface VillageLight {
  x: number;
  y: number;
  z: number;
  size: number;
  tone: number;
}

export interface VillageBuild {
  geometry: BufferGeometry;
  lights: VillageLight[];
  /** Chimney tops (local), where lane-side smoke can rise from. */
  chimneys: number[];
}

let rs = 1;
function rnd(): number {
  rs = (rs * 1664525 + 1013904223) >>> 0;
  return rs / 4294967296;
}
const range = (a: number, b: number) => a + (b - a) * rnd();

/** Flat-shaded triangle soup: positions, face normals, colours and kinds. */
class Soup {
  p: number[] = [];
  c: number[] = [];
  k: number[] = [];
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, col: Color, kind = KIND_SOLID): void {
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let i = 0; i < 3; i++) {
      this.c.push(col.r, col.g, col.b);
      this.k.push(kind);
    }
  }
  /** A quad a-b-c-d (counter-clockwise seen from its front). */
  quad(a: V, b: V, c: V, d: V, col: Color, kind = KIND_SOLID): void {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col, kind);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col, kind);
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    const pos = new Float32Array(this.p);
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.c), 3));
    g.setAttribute('aKind', new BufferAttribute(new Float32Array(this.k), 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
type V = [number, number, number];

/** A local frame on the ground: origin (x, y, z), yawed by `yaw` about +y. */
class Frame {
  constructor(
    public x: number,
    public y: number,
    public z: number,
    public yaw: number,
  ) {}
  /** Local (u along, h up, w across) to village space. */
  at(u: number, h: number, w: number): V {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return [this.x + u * c + w * s, this.y + h, this.z - u * s + w * c];
  }
}

/** A box standing on the frame's ground: length l (along u), width w, height h (no bottom face). */
function box(s: Soup, f: Frame, l: number, w: number, h: number, col: Color, y0 = 0): void {
  const a = l / 2;
  const b = w / 2;
  const p = (u: number, y: number, v: number) => f.at(u, y0 + y, v);
  s.quad(p(-a, 0, b), p(a, 0, b), p(a, h, b), p(-a, h, b), col);
  s.quad(p(a, 0, -b), p(-a, 0, -b), p(-a, h, -b), p(a, h, -b), col);
  s.quad(p(a, 0, b), p(a, 0, -b), p(a, h, -b), p(a, h, b), col);
  s.quad(p(-a, 0, -b), p(-a, 0, b), p(-a, h, b), p(-a, h, -b), col);
  s.quad(p(-a, h, b), p(a, h, b), p(a, h, -b), p(-a, h, -b), col);
}

/** A gabled roof on a box of length l and width w whose eaves sit at height h: the ridge runs along
 *  u, rise r, overhang o. The gable ends take the wall colour. */
function gable(s: Soup, f: Frame, l: number, w: number, h: number, r: number, o: number, roof: Color, wall: Color): void {
  const a = l / 2 + o;
  const b = w / 2 + o;
  const p = (u: number, y: number, v: number) => f.at(u, y, v);
  const drop = (o / (w / 2)) * r;
  s.quad(p(-a, h - drop, b), p(a, h - drop, b), p(a, h + r, 0), p(-a, h + r, 0), roof);
  s.quad(p(a, h - drop, -b), p(-a, h - drop, -b), p(-a, h + r, 0), p(a, h + r, 0), roof);
  const g = l / 2;
  const q = w / 2;
  s.tri(...p(g, h, q), ...p(g, h, -q), ...p(g, h + r, 0), wall);
  s.tri(...p(-g, h, -q), ...p(-g, h, q), ...p(-g, h + r, 0), wall);
}

/** A four-sided pyramid (spire, flared temple roof), base half-sizes a (along) and b (across) at y0. */
function pyramid(s: Soup, f: Frame, a: number, b: number, y0: number, hgt: number, col: Color): void {
  const p = (u: number, y: number, v: number) => f.at(u, y, v);
  const top = p(0, y0 + hgt, 0);
  const c0 = p(-a, y0, b);
  const c1 = p(a, y0, b);
  const c2 = p(a, y0, -b);
  const c3 = p(-a, y0, -b);
  s.tri(...c0, ...c1, ...top, col);
  s.tri(...c1, ...c2, ...top, col);
  s.tri(...c2, ...c3, ...top, col);
  s.tri(...c3, ...c0, ...top, col);
}

/** A window (or lamp) pane on the +w face of a box of width w: a quad a hair proud of the wall. */
function pane(s: Soup, f: Frame, u: number, y: number, face: number, halfW: number, pw: number, ph: number, col: Color, kind: number): void {
  const v = face * (halfW + 0.12);
  const p = (du: number, dy: number) => f.at(u + du * face, y + dy, v);
  s.quad(p(-pw / 2, 0), p(pw / 2, 0), p(pw / 2, ph), p(-pw / 2, ph), col, kind);
}

/** A flat disc (a frozen lake, a lava pool), slightly ragged at the edge. */
function disc(s: Soup, cx: number, y: number, cz: number, rx: number, rz: number, col: Color, kind: number, rim?: Color): void {
  const n = 22;
  const ph = rnd() * 6;
  const pts: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 0.86 + 0.14 * Math.sin(a * 3 + ph) * Math.cos(a * 2);
    pts.push([cx + Math.cos(a) * rx * j, y, cz + Math.sin(a) * rz * j]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    s.tri(cx, y, cz, b[0], b[1], b[2], a[0], a[1], a[2], col, kind);
  }
  if (rim) {
    // A snowy shore ring a little lower, so the ice reads as set into the floor.
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const ao: V = [cx + (a[0] - cx) * 1.12, y - 0.3, cz + (a[2] - cz) * 1.12];
      const bo: V = [cx + (b[0] - cx) * 1.12, y - 0.3, cz + (b[2] - cz) * 1.12];
      s.quad(a, b, bo, ao, rim);
    }
  }
}

/** A flat ribbon along a polyline (a road, a river of lava), width w. */
function ribbon(s: Soup, pts: Array<[number, number]>, y: number, w: number, col: Color, kind: number): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * (w / 2);
    const nz = (dx / l) * (w / 2);
    s.quad([x0 - nx, y, z0 - nz], [x0 + nx, y, z0 + nz], [x1 + nx, y, z1 + nz], [x1 - nx, y, z1 - nz], col, kind);
  }
}

const C = (h: string) => new Color(h);

interface Style {
  walls: Color[];
  roof: Color;
  trim: Color;
  glass: Color;
  ice: Color;
  rim: Color;
  road: Color;
}

const STYLE: Record<BiomeId, Style> = {
  alpine: { walls: [C('#8A5A44'), C('#A06A4C'), C('#E8DCCB'), C('#74493A')], roof: C('#F4F2FA'), trim: C('#4A3040'), glass: C('#2E3658'), ice: C('#BFE4F4'), rim: C('#E8EEF8'), road: C('#7A7896') },
  glacier: { walls: [C('#E2563A'), C('#F0A030'), C('#D8E2EE'), C('#C8402E')], roof: C('#F2F8FF'), trim: C('#3A4A66'), glass: C('#24345A'), ice: C('#A8E8FA'), rim: C('#E6F4FF'), road: C('#7C8CB0') },
  volcanic: { walls: [C('#564A52'), C('#4A4048'), C('#6A5A5E'), C('#3E363E')], roof: C('#E8DCDC'), trim: C('#241E26'), glass: C('#2A2030'), ice: C('#3A2A30'), rim: C('#5A4A50'), road: C('#5A4A58') },
  blossom: { walls: [C('#EFE4D6'), C('#E6D6C8'), C('#C8402E'), C('#F2EADF')], roof: C('#F6F2FA'), trim: C('#3A3048'), glass: C('#3A2E48'), ice: C('#C8DCF4'), rim: C('#F0EAF4'), road: C('#8A80A0') },
};

const VERMILLION = C('#D8402E');
const DARK_ROOF = C('#3C3650');
const STONE = C('#8C8296');
const MAST = C('#C8CCD8');

/** Builds one village. Deterministic in its spec. */
export function buildVillage(spec: VillageSpec): VillageBuild {
  rs = spec.seed >>> 0 || 1;
  const s = new Soup();
  const st = STYLE[spec.biome];
  const lights: VillageLight[] = [];
  const chimneys: number[] = [];
  const R = spec.radius;
  // The main road runs down the valley (along z) a little off the middle, with a gentle wander.
  const roadX = range(-0.15, 0.15) * R;
  const ph = rnd() * 6;
  const roadAt = (z: number) => roadX + Math.sin(z / 70 + ph) * 12;
  const road: Array<[number, number]> = [];
  for (let z = -R * 1.05; z <= R * 1.05; z += R / 6) road.push([roadAt(z), z]);
  ribbon(s, road, 0.9, 7, st.road, KIND_SOLID);
  // Water (a frozen lake) or lava beside the road, on the side away from the course.
  const lakeX = roadX + spec.side * range(0.45, 0.6) * R;
  const lakeZ = range(-0.3, 0.3) * R;
  const lakeRX = R * (spec.biome === 'glacier' ? 0.42 : 0.3);
  const lakeRZ = R * (spec.biome === 'glacier' ? 0.62 : 0.42);
  if (spec.biome === 'volcanic') {
    // A lava river winding down the valley floor, pooling where the lake would be.
    const river: Array<[number, number]> = [];
    for (let z = -R * 1.1; z <= R * 1.1; z += R / 8) river.push([lakeX + Math.sin(z / 55) * 18, z]);
    ribbon(s, river, 1.0, 16, C('#FF6A20'), KIND_LAVA);
    disc(s, lakeX, 1.05, lakeZ, lakeRX * 0.6, lakeRZ * 0.5, C('#FF7A28'), KIND_LAVA, C('#2A2028'));
    for (let z = -R; z <= R; z += R / 4) lights.push({ x: lakeX + Math.sin(z / 55) * 18, y: 3, z, size: 26, tone: 3 });
    lights.push({ x: lakeX, y: 3, z: lakeZ, size: 46, tone: 3 });
  } else {
    disc(s, lakeX, 1.0, lakeZ, lakeRX, lakeRZ, st.ice, KIND_ICE, st.rim);
  }
  const blocked = (x: number, z: number, r: number) => {
    const lx = (x - lakeX) / (lakeRX * 1.15 + r);
    const lz = (z - lakeZ) / (lakeRZ * 1.15 + r);
    return lx * lx + lz * lz < 1 || Math.abs(x - roadAt(z)) < 6 + r || Math.hypot(x, z) > R - r;
  };
  const taken: Array<[number, number, number]> = [];
  const clear = (x: number, z: number, r: number) => {
    if (blocked(x, z, r)) return false;
    for (const [tx, tz, tr] of taken) if (Math.hypot(tx - x, tz - z) < tr + r + 3) return false;
    return true;
  };

  // The landmark first, by the road at the village's heart.
  const lmZ = range(-0.15, 0.15) * R;
  const lmX = roadAt(lmZ) - spec.side * 26;
  taken.push([lmX, lmZ, 22]);
  if (spec.biome === 'alpine') church(s, new Frame(lmX, 0, lmZ, Math.PI / 2 + range(-0.1, 0.1)), st, lights);
  else if (spec.biome === 'glacier') station(s, new Frame(lmX, 0, lmZ, range(0, 3)), st, lights);
  else if (spec.biome === 'volcanic') lodgeHall(s, new Frame(lmX, 0, lmZ, Math.PI / 2), st, lights);
  else pagoda(s, new Frame(lmX, 0, lmZ, Math.PI / 4), st, lights);
  if (spec.biome === 'blossom') {
    // A vermillion spirit gate across the road at the top of the town.
    const gz = -R * 0.75;
    const gf = new Frame(roadAt(gz), 0, gz, 0);
    box(s, new Frame(...gf.at(0, 0, -7), 0), 1.4, 1.4, 13, VERMILLION);
    box(s, new Frame(...gf.at(0, 0, 7), 0), 1.4, 1.4, 13, VERMILLION);
    box(s, new Frame(gf.x, 0, gf.z, 0), 2, 20, 1.3, DARK_ROOF, 13);
    box(s, new Frame(gf.x, 0, gf.z, 0), 1.4, 17, 1, VERMILLION, 10.6);
  }

  // Houses along the road, thinning out with distance from it.
  const houses = spec.biome === 'glacier' ? 12 : 34;
  for (let i = 0, tries = 0; i < houses && tries < houses * 12; tries++) {
    const z = range(-0.92, 0.92) * R;
    const off = (rnd() < 0.5 ? -1 : 1) * (12 + Math.pow(rnd(), 1.7) * R * 0.75);
    const x = roadAt(z) + off;
    const l = range(10, 15);
    const w = range(8, 11);
    const r = Math.max(l, w) * 0.6;
    if (!clear(x, z, r)) continue;
    taken.push([x, z, r]);
    i++;
    // Ridges run along the road (a little jitter), gable ends to the valley.
    const f = new Frame(x, 0, z, Math.PI / 2 + range(-0.18, 0.18) + (rnd() < 0.2 ? Math.PI / 2 : 0));
    if (spec.biome === 'glacier') hut(s, f, l, w, st, lights);
    else house(s, f, l, w, st, spec.biome, lights, chimneys);
  }

  // Street lamps (lanterns in Sakura) down both sides of the road.
  const lampTone = spec.biome === 'blossom' ? 2 : 1;
  for (let z = -R * 0.9; z <= R * 0.9; z += 34) {
    for (const sd of [-1, 1]) {
      const x = roadAt(z) + sd * 6.5;
      box(s, new Frame(x, 0, z, 0), 0.5, 0.5, 5, st.trim);
      box(s, new Frame(x, 0, z, 0), 1.3, 1.3, 1.3, spec.biome === 'blossom' ? C('#E84A3A') : C('#4A4060'), 5);
      // (The lamp's lit face: a pane on each side, so it reads from anywhere.)
      const lf = new Frame(x, 0, z, 0);
      pane(s, lf, 0, 5.15, 1, 0.65, 1.0, 1.0, st.glass, KIND_LAMP);
      pane(s, lf, 0, 5.15, -1, 0.65, 1.0, 1.0, st.glass, KIND_LAMP);
      lights.push({ x, y: 5.6, z, size: 9, tone: lampTone });
    }
  }
  return { geometry: s.geometry(), lights, chimneys };
}

/** A hamlet on a mountain flank above the run, where it shows over the bank: a dozen or so houses
 *  stepping down the slope on stone footings round a chapel (a hut and mast on Frostfang, a lodge on
 *  Ember Peak, a small pagoda on Sakura Ridge), with lanterns up the path between them. `ground`
 *  gives the slope's height (local coordinates, relative to the origin). */
export function buildHamlet(spec: VillageSpec, ground: (x: number, z: number) => number): VillageBuild {
  rs = spec.seed >>> 0 || 1;
  const s = new Soup();
  const st = STYLE[spec.biome];
  const lights: VillageLight[] = [];
  const chimneys: number[] = [];
  const R = spec.radius;
  const taken: Array<[number, number, number]> = [];
  // The footing: the lowest corner of the footprint, so no house hangs over the slope.
  const footing = (x: number, z: number, r: number) => Math.min(ground(x - r, z - r), ground(x + r, z - r), ground(x - r, z + r), ground(x + r, z + r), ground(x, z));
  const lx = range(-0.2, 0.2) * R;
  const lz = range(-0.2, 0.2) * R;
  taken.push([lx, lz, 18]);
  const lf = new Frame(lx, footing(lx, lz, 10), lz, Math.PI / 2 + range(-0.2, 0.2));
  box(s, lf, 26, 16, 8, STONE, -8);
  if (spec.biome === 'alpine') {
    const white = C('#ECE6EE');
    box(s, lf, 14, 8, 7, white);
    gable(s, lf, 14, 8, 7, 4.5, 0.8, st.roof, white);
    const tf = new Frame(...lf.at(-8, 0, 0), lf.yaw);
    box(s, tf, 4.5, 4.5, 14, white);
    pyramid(s, tf, 2.8, 2.8, 14, 11, C('#3E3A5C'));
    for (const face of [-1, 1]) pane(s, tf, 0, 9, face, 2.25, 1.8, 1.8, st.glass, KIND_WINDOW);
    const p = tf.at(0, 10, 0);
    lights.push({ x: p[0], y: p[1], z: p[2], size: 6, tone: 0 });
  } else if (spec.biome === 'glacier') {
    hut(s, lf, 16, 9, st, lights);
    const mf = new Frame(...lf.at(-11, 0, 4), lf.yaw);
    box(s, mf, 0.8, 0.8, 24, MAST);
    box(s, mf, 1.6, 1.6, 1.6, C('#3A2028'), 24);
    pane(s, mf, 0, 24.2, 1, 0.8, 1.2, 1.2, st.glass, KIND_LAMP);
    pane(s, mf, 0, 24.2, -1, 0.8, 1.2, 1.2, st.glass, KIND_LAMP);
    const top = mf.at(0, 25, 0);
    lights.push({ x: top[0], y: top[1], z: top[2], size: 8, tone: 2 });
  } else if (spec.biome === 'volcanic') {
    lodgeHall(s, lf, st, lights);
  } else {
    // A three-tier pagoda.
    let y = 0;
    let w = 10;
    for (let i = 0; i < 3; i++) {
      const h = i === 0 ? 5 : 3.6;
      box(s, lf, w, w, h, VERMILLION, y);
      for (const face of [-1, 1]) pane(s, lf, 0, y + 1, face, w / 2, w * 0.4, h * 0.5, st.glass, KIND_WINDOW);
      y += h;
      pyramid(s, lf, w * 0.5 + 2.8, w * 0.5 + 2.8, y - 0.4, 2.6, DARK_ROOF);
      pyramid(s, lf, w * 0.5 + 2.1, w * 0.5 + 2.1, y + 0.2, 2.1, st.roof);
      const lp = lf.at(w * 0.5 + 2.5, y - 0.8, w * 0.5 + 2.5);
      lights.push({ x: lp[0], y: lp[1], z: lp[2], size: 4, tone: 2 });
      y += 1.3;
      w *= 0.78;
    }
    box(s, lf, 0.7, 0.7, 7, C('#C8A050'), y);
  }
  const houses = 9 + Math.floor(rnd() * 7);
  for (let i = 0, tries = 0; i < houses && tries < houses * 14; tries++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * R * 0.9;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const l = range(11, 15);
    const w = range(9, 11.5);
    const r = Math.max(l, w) * 0.6;
    if (Math.hypot(x, z) > R - r) continue;
    let ok = true;
    for (const [tx, tz, tr] of taken) if (Math.hypot(tx - x, tz - z) < tr + r + 4) ok = false;
    if (!ok) continue;
    taken.push([x, z, r]);
    i++;
    // Ridges along the contour, so the houses step down the slope in rows.
    const f = new Frame(x, footing(x, z, r * 0.8), z, Math.PI / 2 + range(-0.25, 0.25));
    box(s, f, l + 0.6, w + 0.6, 9, STONE, -9);
    if (spec.biome === 'glacier') hut(s, f, l, w, st, lights);
    else house(s, f, l, w, st, spec.biome, lights, chimneys);
  }
  // Lanterns up the path through the hamlet.
  const lampTone = spec.biome === 'blossom' ? 2 : 1;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = (t - 0.5) * R * 1.3 + Math.sin(t * 7) * 14;
    const z = (t - 0.5) * R * 0.6 + Math.cos(t * 5) * 12;
    const g = ground(x, z);
    const pf = new Frame(x, g, z, 0);
    box(s, pf, 0.5, 0.5, 5, st.trim, -3);
    box(s, pf, 1.3, 1.3, 1.3, spec.biome === 'blossom' ? C('#E84A3A') : C('#4A4060'), 5);
    pane(s, pf, 0, 5.15, 1, 0.65, 1, 1, st.glass, KIND_LAMP);
    pane(s, pf, 0, 5.15, -1, 0.65, 1, 1, st.glass, KIND_LAMP);
    lights.push({ x, y: g + 5.6, z, size: 8, tone: lampTone });
  }
  return { geometry: s.geometry(), lights, chimneys };
}

function house(s: Soup, f: Frame, l: number, w: number, st: Style, biome: BiomeId, lights: VillageLight[], chimneys: number[]): void {
  const wall = st.walls[Math.floor(rnd() * st.walls.length)];
  const h = range(5, 7.5);
  const stone = biome === 'volcanic';
  box(s, f, l, w, h, wall);
  // A darker plinth course (stone footing) under timber walls.
  if (!stone) box(s, f, l + 0.3, w + 0.3, 1.2, st.trim);
  const rise = biome === 'blossom' ? w * 0.28 : biome === 'volcanic' ? w * 0.34 : w * 0.5;
  gable(s, f, l, w, h, rise, 1.6, st.roof, wall);
  if (biome === 'blossom') {
    // A dark tiled eave under the snow: the temple-town roofline.
    gable(s, f, l, w, h - 0.6, rise * 0.9, 2.4, DARK_ROOF, wall);
  }
  // Windows: two rows on the long sides; most of them lit at night.
  const n = Math.max(2, Math.floor(l / 4));
  for (const face of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const u = -l / 2 + ((i + 0.5) * l) / n;
      for (const y of h > 6.3 ? [1.6, 4.2] : [1.8]) {
        const lit = rnd() < 0.72;
        pane(s, f, u, y, face, w / 2, 2.2, 1.9, st.glass, lit ? KIND_WINDOW : KIND_SOLID);
        if (lit && rnd() < 0.4) {
          const p = f.at(u, y + 1, face * (w / 2 + 1));
          lights.push({ x: p[0], y: p[1], z: p[2], size: 4.5, tone: 0 });
        }
      }
    }
  }
  // A chimney on the ridge.
  const cu = range(-0.3, 0.3) * l;
  const cf = new Frame(...f.at(cu, 0, w * 0.18), f.yaw);
  box(s, cf, 1.4, 1.4, h + rise + 1.6, stone ? STONE : st.trim);
  const top = cf.at(0, h + rise + 1.8, 0);
  chimneys.push(top[0], top[1], top[2]);
}

function hut(s: Soup, f: Frame, l: number, w: number, st: Style, lights: VillageLight[]): void {
  const wall = st.walls[Math.floor(rnd() * st.walls.length)];
  const h = range(4, 5.5);
  box(s, f, l, w, h, wall);
  // A low snow-loaded roof slab with a lip.
  box(s, f, l + 1.2, w + 1.2, 1.1, st.roof, h);
  for (const face of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const u = -l / 2 + ((i + 0.5) * l) / 3;
      pane(s, f, u, 1.7, face, w / 2, 2.2, 1.6, st.glass, rnd() < 0.8 ? KIND_WINDOW : KIND_SOLID);
    }
  }
  const p = f.at(0, h + 2, 0);
  lights.push({ x: p[0], y: p[1], z: p[2], size: 5, tone: 0 });
}

function church(s: Soup, f: Frame, st: Style, lights: VillageLight[]): void {
  const white = C('#ECE6EE');
  box(s, f, 24, 12, 10, white);
  gable(s, f, 24, 12, 10, 6.5, 1, st.roof, white);
  // The tower at the west end, the spire on it.
  const tf = new Frame(...f.at(-14, 0, 0), f.yaw);
  box(s, tf, 7, 7, 26, white);
  box(s, tf, 7.6, 7.6, 1.2, st.trim, 26);
  pyramid(s, tf, 4, 4, 27.2, 20, C('#3E3A5C'));
  // A lit clock face and belfry openings on each side.
  for (const face of [-1, 1]) {
    pane(s, tf, 0, 19, face, 3.5, 2.6, 2.6, st.glass, KIND_WINDOW);
    for (let i = 0; i < 4; i++) pane(s, f, -8 + i * 5, 3, face, 6, 1.8, 4, st.glass, KIND_WINDOW);
  }
  const p = tf.at(0, 21, 0);
  lights.push({ x: p[0], y: p[1], z: p[2], size: 7, tone: 0 });
}

function station(s: Soup, f: Frame, st: Style, lights: VillageLight[]): void {
  // A white research dome, a long lab block and a radio mast with a red beacon.
  const white = C('#EEF4FA');
  const n = 10;
  const R = 11;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 4; j++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const b0 = (j / 4) * Math.PI * 0.5;
      const b1 = ((j + 1) / 4) * Math.PI * 0.5;
      const pt = (a: number, b: number): V => f.at(Math.cos(a) * Math.cos(b) * R, Math.sin(b) * R, Math.sin(a) * Math.cos(b) * R);
      s.quad(pt(a0, b0), pt(a0, b1), pt(a1, b1), pt(a1, b0), white);
    }
  }
  const lf = new Frame(...f.at(22, 0, 0), f.yaw);
  box(s, lf, 22, 9, 5, C('#E2563A'));
  box(s, lf, 23, 10, 1, st.roof, 5);
  for (const face of [-1, 1]) for (let i = 0; i < 5; i++) pane(s, lf, -8 + i * 4, 1.8, face, 4.5, 2.4, 1.5, st.glass, KIND_WINDOW);
  const mf = new Frame(...f.at(-18, 0, 8), f.yaw);
  box(s, mf, 1, 1, 36, MAST);
  box(s, mf, 6, 0.4, 0.4, MAST, 24);
  box(s, mf, 1.8, 1.8, 1.8, C('#3A2028'), 36);
  pane(s, mf, 0, 36.2, 1, 0.9, 1.4, 1.4, st.glass, KIND_LAMP);
  pane(s, mf, 0, 36.2, -1, 0.9, 1.4, 1.4, st.glass, KIND_LAMP);
  const top = mf.at(0, 37, 0);
  lights.push({ x: top[0], y: top[1], z: top[2], size: 9, tone: 2 });
}

function lodgeHall(s: Soup, f: Frame, st: Style, lights: VillageLight[]): void {
  // A long stone hall with a squat watchtower, its windows the warmest thing in the valley.
  const wall = C('#5A4E58');
  box(s, f, 30, 14, 9, wall);
  gable(s, f, 30, 14, 9, 5, 1.2, st.roof, wall);
  const tf = new Frame(...f.at(18, 0, 0), f.yaw);
  box(s, tf, 9, 9, 18, C('#4A4048'));
  pyramid(s, tf, 6, 6, 18, 8, st.roof);
  for (const face of [-1, 1]) {
    for (let i = 0; i < 6; i++) pane(s, f, -12.5 + i * 5, 2.5, face, 7, 2.2, 3, st.glass, KIND_WINDOW);
    pane(s, tf, 0, 12, face, 4.5, 2.4, 2.4, st.glass, KIND_WINDOW);
  }
  const p = tf.at(0, 13, 0);
  lights.push({ x: p[0], y: p[1], z: p[2], size: 7, tone: 0 });
}

function pagoda(s: Soup, f: Frame, st: Style, lights: VillageLight[]): void {
  // Five tiers, each a vermillion storey under a wide dark roof with snow on it, and a spire.
  let y = 0;
  let w = 13;
  box(s, f, w + 4, w + 4, 2, STONE);
  y = 2;
  for (let i = 0; i < 5; i++) {
    const h = i === 0 ? 6 : 4.2;
    box(s, f, w, w, h, VERMILLION, y);
    for (const face of [-1, 1]) pane(s, f, 0, y + 1.2, face, w / 2, w * 0.4, h * 0.5, st.glass, KIND_WINDOW);
    y += h;
    pyramid(s, f, w * 0.5 + 3.4, w * 0.5 + 3.4, y - 0.4, 3.2, DARK_ROOF);
    pyramid(s, f, w * 0.5 + 2.6, w * 0.5 + 2.6, y + 0.2, 2.6, st.roof);
    const lp = f.at(w * 0.5 + 3, y - 0.8, w * 0.5 + 3);
    lights.push({ x: lp[0], y: lp[1], z: lp[2], size: 4, tone: 2 });
    y += 1.6;
    w *= 0.8;
  }
  box(s, f, 0.8, 0.8, 10, C('#C8A050'), y);
}

/** Most villages merged into the one village mesh at a time (midground.ts): each has a slot whose
 *  fade-in and distance past the terrain's edge the shader reads. */
export const VILLAGE_SLOTS = 8;

/** The village material: the shared toon light on the vertex colours, the aerial perspective the
 *  midground shares, and the glows. Every village in range is merged into one mesh (one draw call);
 *  each vertex names its village's slot (aSlot), whose uAppear (0 to 1 as it fades in out of the
 *  haze) and uVE (metres past the terrain's edge, for the aerial perspective) it reads. */
export function makeVillageMaterial(aerial: string, extra: Record<string, { value: unknown }>): ShaderMaterial {
  return new ShaderMaterial({
    vertexColors: true,
    side: FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    uniforms: {
      ...shared,
      uGlow: { value: 0 },
      uAppearA: { value: new Array<number>(VILLAGE_SLOTS).fill(0) },
      uVE: { value: new Array<number>(VILLAGE_SLOTS).fill(500) },
      ...extra,
    },
    vertexShader: /* glsl */ `
      attribute float aKind;
      attribute float aSlot;
      uniform float uAppearA[${VILLAGE_SLOTS}];
      uniform float uVE[${VILLAGE_SLOTS}];
      varying vec3 vWorldPos;
      varying vec3 vN;
      varying vec3 vColor;
      varying float vKind;
      varying float vAppear;
      varying float vVE;
      void main() {
        vColor = color;
        vKind = aKind;
        int slot = int(aSlot + 0.5);
        vAppear = uAppearA[slot];
        vVE = uVE[slot];
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      ${aerial}
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSnowLit;
      uniform vec3 uSnowShade;
      uniform float uDayK;
      uniform float uGlow;
      varying float vVE;
      varying float vAppear;
      varying vec3 vWorldPos;
      varying vec3 vN;
      varying vec3 vColor;
      varying float vKind;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vWorldPos);
        vec3 base = vColor;
        // Snowy roofs and white walls take the snow's own light, so the town sits in its valley.
        float white = smoothstep(0.82, 0.92, min(base.r, min(base.g, base.b)));
        base = mix(base, uSnowLit * 0.92, white * 0.85);
        vec3 shade = mix(base * 0.42, uShadeTint * (0.35 + 0.4 * dot(base, vec3(0.33))), 0.45);
        shade = mix(shade, mix(uSnowShade, uShadeTint, 0.3), white * 0.7);
        vec3 col = toonLightK(base, shade, n, v, 1.0, 0.22);
        float glowK = 0.0;
        if (vKind > 0.5 && vKind < 1.5) {
          // Frozen water: the sky's colours on glazed ice.
          vec3 r = reflect(-v, n);
          vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.5, r.y));
          col = mix(col, sky * 0.92, 0.55);
        } else if (vKind > 1.5 && vKind < 2.5) {
          col = mix(col, vec3(1.0, 0.72, 0.36) * 1.9, uGlow);
          glowK = uGlow;
        } else if (vKind > 2.5 && vKind < 3.5) {
          float fl = 0.85 + 0.15 * sin(uTime * 1.7 + vWorldPos.z * 0.05 + vWorldPos.x * 0.03);
          col = vec3(1.0, 0.42, 0.12) * (1.3 + 0.9 * uGlow) * fl;
          glowK = 0.7 + 0.3 * uGlow;
        } else if (vKind > 3.5) {
          col = mix(col, vec3(1.0, 0.8, 0.5) * 2.4, uGlow);
          glowK = uGlow;
        }
        vec3 fc = midAerial(col, vWorldPos, vVE);
        // Lights hold through the haze better than the walls round them.
        col = mix(fc, col, glowK * 0.6);
        col = mix(uFog, col, vAppear);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
