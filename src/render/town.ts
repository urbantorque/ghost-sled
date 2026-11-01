import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { BiomeId } from '../sim/mountains';
import { SNOW, part, shade, softPart } from './flora';
import {
  CREAM,
  Glow,
  INK,
  Piece,
  Rail,
  SiteCtx,
  Spot,
  Sub,
  TIMBER,
  TIMBER_DARK,
  TIMBER_LIGHT,
  V3,
  banners,
  box,
  bunting,
  crag,
  drift,
  grade,
  lampColor,
  place,
  rnd,
  seed,
  seg,
  stone,
  sweptRoof,
  windowColor,
} from './landmarkKit';
import type { Palette } from './palette';

// The course's long places, each a stretch of the run 100 to 250 m long built along the course's own
// line (the site's rail) rather than round one point:
//  - a ride-through village: the run becomes the street. Chalets, shops, a church or temple and a
//    hotel with balconies line both banks, their fronts to the run; stalls, lamps, snowmen and parked
//    sleds stand before them, a dense crowd lines the bank crests, and bunting, lantern strings and
//    banners hang high across. Pinecrest an alpine village, Frostfang a research station and
//    ice-fishing camp, Ember Peak a stone hot-spring town, Sakura Ridge a temple town.
//  - an enclosed run: an avalanche gallery (a roof over the run on pillars, a wall up the slope side,
//    open toward the light), Frostfang's ice tunnel, Ember's lava-rock tunnel and Sakura's corridor of
//    torii.
// Safety is the set pieces' (landmarkKit.ts): everything stands at least 9.45 m past the corridor's
// edge, except what hangs over the run, whose lowest point keeps above the highest air any sled can
// reach under it by the margin (rail.air). An enclosure's roof stands `clear` over the run's floor
// for its whole length; the plan (landmarks.ts) puts one only where nothing launches under it.
//
// Every builder makes its layout when called (cheap) and its parts in steps, one per idle callback.

/** Nothing decorative nearer the corridor's edge than this (the rule is 9.2 m; a margin for facets). */
const KEEP = 9.45;
/** Metres of clear air over the highest sled for anything hung across the run. */
const AIR_MARGIN = 6.3;

const C = (h: string) => new Color(h);

// ---------------------------------------------------------------- shared shapes

/** A triangular prism, apex up: w wide (x), h tall, d deep (z), its base on pos. */
function prism(w: number, h: number, d: number, col: Color, pos: V3): BufferGeometry {
  const g = new CylinderGeometry(1, 1, d, 3);
  g.rotateX(-Math.PI / 2);
  g.scale(w / 2 / 0.866, h / 1.5, 1);
  g.translate(pos[0], pos[1] + h / 3, pos[2]);
  return part(g, col);
}

/** A gable roof whose ridge runs along z (the gable end faces +z): the gable's infill in the wall
 *  colour, two pitched slabs with an overhang, and a heavy layer of snow on each. */
function gable(L: number, D: number, y: number, rise: number, over: number, roof: Color, wall: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [prism(L, rise, D, wall, [0, y, 0])];
  const a = Math.atan2(rise, L / 2);
  const run = L / 2 + over;
  const sl = run / Math.cos(a);
  for (const sx of [-1, 1]) {
    const mx = (sx * run) / 2;
    const my = y + rise - (run / 2) * Math.tan(a);
    const nx = sx * Math.sin(a);
    const ny = Math.cos(a);
    parts.push(box(sl, 0.42, D + 2 * over, roof, [mx + nx * 0.22, my + ny * 0.22, 0], [0, 0, -sx * a]));
    parts.push(part(BoxGeometry2(sl - 0.25, 0.6, D + 2 * over - 0.2), SNOW, { pos: [mx + nx * 0.7, my + ny * 0.7, 0], rot: [0, 0, -sx * a], jitter: 0.1 }));
  }
  // A roll of snow on the ridge.
  parts.push(softPart(new CylinderGeometry(0.5, 0.5, D + 2 * over, 8), SNOW, { pos: [0, y + rise + 0.75, 0], rot: [Math.PI / 2, 0, 0], scale: [1.1, 1, 0.75] }));
  return parts;
}

/** A heap of snow that keeps its axes (drift() turns at random, so a long heap by the keep line could
 *  swing its length across it). */
function heap(pos: V3, scale: V3): BufferGeometry {
  return part(new IcosahedronGeometry(1, 1), SNOW, { pos, scale, jitter: 0.1 });
}

/** A box with a few segments (so jitter lumps it like snow). */
function BoxGeometry2(w: number, h: number, d: number): BufferGeometry {
  // (CylinderGeometry with 4 sides makes a lumpier box under jitter than BoxGeometry's 8 corners.)
  const g = new CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, 1, 4, 2);
  g.rotateY(Math.PI / 4);
  g.scale(w, h, d);
  return g;
}

/** A window with its frame (and shutters, when given) on a face: `face` is the axis it faces. */
function windowAt(parts: BufferGeometry[], x: number, y: number, z: number, w: number, h: number, glass: Color, frame: Color, axis: 'x' | 'z', dir: number, shutter?: Color): void {
  if (axis === 'z') {
    parts.push(box(w + 0.3, h + 0.3, 0.12, frame, [x, y, z]));
    parts.push(box(w, h, 0.14, glass, [x, y, z + dir * 0.03]));
    parts.push(box(w + 0.5, 0.16, 0.34, SNOW, [x, y - h / 2 - 0.2, z + dir * 0.12]));
    if (shutter) for (const sx of [-1, 1]) parts.push(box(w * 0.48, h + 0.1, 0.1, shutter, [x + sx * (w * 0.74 + 0.1), y, z + dir * 0.06]));
  } else {
    parts.push(box(0.12, h + 0.3, w + 0.3, frame, [x, y, z]));
    parts.push(box(0.14, h, w, glass, [x + dir * 0.03, y, z]));
    parts.push(box(0.34, 0.16, w + 0.5, SNOW, [x + dir * 0.12, y - h / 2 - 0.2, z]));
    if (shutter) for (const sz of [-1, 1]) parts.push(box(0.1, h + 0.1, w * 0.48, shutter, [x + dir * 0.06, y, z + sz * (w * 0.74 + 0.1)]));
  }
}

/** A balcony along a front (+z face at z0): a deck, posts, a rail, and snow along it. */
function balcony(parts: BufferGeometry[], w: number, y: number, z0: number, depth: number, wood: Color): void {
  parts.push(box(w, 0.3, depth, wood, [0, y, z0 + depth / 2]));
  for (let x = -w / 2 + 0.15; x <= w / 2 - 0.1; x += 0.55) parts.push(box(0.09, 1.0, 0.09, wood, [x, y + 0.65, z0 + depth - 0.1]));
  parts.push(box(w, 0.14, 0.18, wood, [0, y + 1.15, z0 + depth - 0.1]));
  parts.push(box(w + 0.1, 0.16, 0.34, SNOW, [0, y + 1.3, z0 + depth - 0.1]));
  parts.push(box(w, 0.1, depth - 0.2, SNOW, [0, y + 0.2, z0 + depth / 2]));
}

/** A hanging paper lantern (lit warm at night, a soft glow by day). */
function lantern(parts: BufferGeometry[], x: number, y: number, z: number, r: number, night: boolean, hex = '#FFB45E'): void {
  parts.push(part(new SphereGeometry(r, 8, 6), lampColor(night, hex), { pos: [x, y, z], scale: [1, 1.3, 1] }));
  parts.push(box(r * 1.2, r * 0.25, r * 1.2, INK, [x, y + r * 1.3, z]));
  parts.push(box(r * 1.2, r * 0.25, r * 1.2, INK, [x, y - r * 1.3, z]));
}

/** A string of lanterns sagging from a to b. */
function lanternString(a: V3, b: V3, sag: number, night: boolean, hex: string): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(4, Math.round(len / 2.6));
  const pt = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < n; i++) {
    parts.push(seg(pt(i / n), pt((i + 1) / n), 0.04, INK, 3));
    if (i > 0) {
      const p = pt(i / n);
      lantern(parts, p[0], p[1] - 0.75, p[2], 0.36, night, hex);
    }
  }
  return parts;
}

// ---------------------------------------------------------------- per-biome town styles

interface Town {
  /** Ground-floor walls, upper-storey walls (one picked per house). */
  lower: Color[];
  upper: Color[];
  roof: Color;
  trim: Color;
  shutters: Color[];
  /** A lamp's colour, and whether its light shows by day too (braziers, lanterns). */
  lamp: string;
  lampAlways: boolean;
}

function townStyle(biome: BiomeId, p: Palette): Town {
  switch (biome) {
    case 'alpine':
      return { lower: [C('#ECE4D6'), C('#E4DACA'), C('#D9CDBB')], upper: [TIMBER, C('#7A5440'), C('#8A5E44'), C('#5E4032')], roof: C('#3A3448'), trim: TIMBER_DARK, shutters: [C('#3F6A6E'), C('#6A3A48'), C('#3E5A8A'), C('#4A6A48')], lamp: '#FFB45E', lampAlways: false };
    case 'glacier':
      return { lower: [C('#B5523E'), C('#D8923A'), C('#D8E2EE'), C('#4F7FA8')], upper: [C('#D8E2EE'), C('#B5523E'), C('#D8923A')], roof: C('#56607A'), trim: C('#2E3A52'), shutters: [C('#2E3A52')], lamp: '#FFD08A', lampAlways: false };
    case 'volcanic':
      return { lower: [shade(p.low, 0.6), shade(p.low, 0.7), shade(p.low, 0.52)], upper: [C('#5E4436'), C('#6E5040'), shade(p.low, 0.8)], roof: C('#2E2834'), trim: C('#241E26'), shutters: [C('#3A2A30')], lamp: '#FF9A50', lampAlways: true };
    case 'blossom':
      return { lower: [C('#4A3440'), C('#3E2E38'), C('#55404A')], upper: [C('#EDE4D8'), C('#E6DACB'), C('#F2EADF')], roof: C('#3E3A50'), trim: C('#2E2230'), shutters: [C('#2E2230')], lamp: '#FFB45E', lampAlways: true };
  }
}

// ---------------------------------------------------------------- buildings

interface HouseOpts {
  w: number;
  d: number;
  storeys: number;
  shop: boolean;
  balconies: boolean;
  /** The bank side: its up-slope face is own +x times this. */
  s: number;
}

/** A house in its own frame (front at +z, d/2), its floor at F. Each biome's own: an alpine chalet
 *  (plaster under timber, the gable to the street, balconies and shutters), a Frostfang station hut
 *  (panelled, on stilts, a flat roof deep in snow), an Ember lodge (basalt under timber, ember-lit
 *  windows), a Sakura townhouse (dark lattice under plaster, low swept eaves, lanterns). */
function house(t: Town, biome: BiomeId, night: boolean, F: number, lo: number, o: HouseOpts, stoneC: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const { w, d, storeys, s } = o;
  const lower = t.lower[Math.floor(rnd() * t.lower.length)];
  const upper = t.upper[Math.floor(rnd() * t.upper.length)];
  const shutter = t.shutters[Math.floor(rnd() * t.shutters.length)];
  const glass = biome === 'volcanic' ? lampColor(true, '#FF9A50').multiplyScalar(night ? 1 : 0.55) : windowColor(night);
  const SH = 3.3;
  const top = F + storeys * SH;
  const zf = d / 2;
  // The plinth down the slope.
  if (biome === 'glacier') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(seg([sx * (w / 2 - 0.5), lo - 1, sz * (d / 2 - 0.5)], [sx * (w / 2 - 0.5), F, sz * (d / 2 - 0.5)], 0.22, t.trim, 5));
    parts.push(box(w + 0.2, 0.35, d + 0.2, t.trim, [0, F - 0.15, 0]));
  } else {
    parts.push(grade(box(w + 1.2, F - lo + 1.5, d + 1.2, stoneC, [0, (F + lo - 1.5) / 2, 0]), lo - 1.5, F, 0.68, 0.95));
    parts.push(box(w + 1.4, 0.22, d + 1.4, SNOW, [0, F + 0.02, 0]));
  }
  // Storeys.
  for (let k = 0; k < storeys; k++) {
    const y0 = F + k * SH;
    const col = k === 0 ? lower : upper;
    parts.push(grade(box(w, SH, d, col, [0, y0 + SH / 2, 0]), y0, y0 + SH, 0.86, 1.03));
    if (biome === 'glacier') for (let x = -w / 2 + 1.2; x < w / 2; x += 1.2) parts.push(box(0.08, SH - 0.2, 0.06, shade(col, 0.82), [x, y0 + SH / 2, zf + 0.02]));
    if (biome === 'blossom' && k === 0) {
      // The lattice front: close dark slats.
      for (let x = -w / 2 + 0.25; x < w / 2; x += 0.42) parts.push(box(0.12, SH - 0.5, 0.1, shade(t.trim, 1.3), [x, y0 + SH / 2, zf + 0.06]));
    }
    // Windows: the front, and the side up the slope.
    const n = Math.max(2, Math.floor(w / 2.7));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n;
      if (k === 0 && o.shop && Math.abs(x) < w * 0.3) continue;
      if (k === 0 && !o.shop && i === Math.floor(n / 2)) continue;
      if (biome === 'blossom' && k === 0) continue;
      windowAt(parts, x, y0 + SH * 0.52, zf + 0.04, biome === 'glacier' ? 1.6 : 1.15, biome === 'glacier' ? 0.8 : 1.35, glass, t.trim, 'z', 1, biome === 'alpine' ? shutter : undefined);
    }
    const m = Math.max(1, Math.floor(d / 3.2));
    for (let i = 0; i < m; i++) {
      const z = -d / 2 + ((i + 0.5) * d) / m;
      windowAt(parts, s * (w / 2 + 0.04), y0 + SH * 0.52, z, 1.1, 1.3, glass, t.trim, 'x', s, biome === 'alpine' ? shutter : undefined);
    }
    // Storey bands.
    if (k > 0) parts.push(box(w + 0.15, 0.22, d + 0.15, t.trim, [0, y0, 0]));
    if (o.balconies && k > 0) balcony(parts, w * 0.86, y0 - 0.05, zf, 1.4, biome === 'blossom' ? t.trim : TIMBER_DARK);
  }
  // The door, or a shop's wide window and its awning and sign.
  if (o.shop) {
    const sw = w * 0.56;
    parts.push(box(sw + 0.3, 2.3, 0.14, t.trim, [0, F + 1.45, zf + 0.04]));
    parts.push(box(sw, 2.0, 0.16, night ? lampColor(true, '#FFC27A') : C('#3A3650'), [0, F + 1.45, zf + 0.07]));
    const cols = [C('#3E5A9A'), CREAM, C('#2F6E78'), C('#6A4C86')];
    const ac = cols[Math.floor(rnd() * cols.length)];
    for (let i = 0; i < 6; i++) parts.push(box(sw / 6 + 0.02, 0.12, 1.5, i % 2 ? CREAM : ac, [-sw / 2 + (i + 0.5) * (sw / 6), F + 2.95, zf + 0.75], [0.35, 0, 0]));
    parts.push(box(sw + 0.1, 0.14, 1.3, SNOW, [0, F + 3.12, zf + 0.72], [0.35, 0, 0]));
    // A hanging sign on a bracket at the corner.
    parts.push(seg([-w / 2 + 0.4, F + 3.6, zf], [-w / 2 + 0.4, F + 3.6, zf + 1.4], 0.05, INK, 4));
    parts.push(box(0.1, 0.8, 1.0, ac, [-w / 2 + 0.4, F + 3.05, zf + 0.95]));
  } else {
    parts.push(box(1.3, 2.3, 0.16, t.trim, [0, F + 1.15, zf + 0.05]));
    if (biome === 'blossom') {
      // A noren curtain over the door.
      parts.push(box(1.7, 0.9, 0.06, C('#2E3A66'), [0, F + 2.05, zf + 0.16]));
    }
  }
  // The door's lamp or a lantern.
  if (biome === 'blossom' || biome === 'volcanic') lantern(parts, w / 2 - 0.9, F + 2.4, zf + 0.5, 0.32, night || t.lampAlways, t.lamp);
  else parts.push(part(new SphereGeometry(0.22, 8, 6), lampColor(night, t.lamp), { pos: [0.95, F + 2.5, zf + 0.25] }));
  // The roof.
  if (biome === 'alpine') {
    parts.push(...gable(w, d, top, w * 0.3, 1.3, t.roof, upper));
    // Carved gable boards and a chimney.
    parts.push(box(0.3, 1.8, 0.3, TIMBER_DARK, [0, top + w * 0.3 - 1.1, zf + 1.1]));
    const cx = (rnd() - 0.5) * w * 0.4;
    parts.push(box(1.0, 3.0, 1.0, stoneC, [cx, top + w * 0.2 + 0.8, -d * 0.2]));
    parts.push(box(1.3, 0.4, 1.3, SNOW, [cx, top + w * 0.2 + 2.4, -d * 0.2]));
  } else if (biome === 'glacier') {
    parts.push(box(w + 0.8, 0.5, d + 0.8, t.roof, [0, top + 0.25, 0]));
    parts.push(part(BoxGeometry2(w + 1.0, 1.2, d + 1.0), SNOW, { pos: [0, top + 1.0, 0], jitter: 0.12 }));
    // A stovepipe and an antenna.
    parts.push(seg([w / 3, top + 0.5, -d / 4], [w / 3, top + 3.2, -d / 4], 0.16, INK, 6));
    parts.push(seg([-w / 3, top + 0.5, 0], [-w / 3, top + 5.5, 0], 0.05, INK, 4));
    parts.push(seg([-w / 3 - 0.7, top + 4.6, 0], [-w / 3 + 0.7, top + 4.6, 0], 0.04, INK, 4));
  } else if (biome === 'volcanic') {
    parts.push(...place(gable(d, w, 0, w * 0.22, 1.2, t.roof, upper), 0, top, 0, Math.PI / 2));
    // A stone chimney.
    parts.push(box(1.2, 3.2, 1.2, stoneC, [-w * 0.25, top + 2.4, -d * 0.15]));
  } else {
    // A low eave roof along the street, swept up at the ends, and a pent roof over the lattice.
    parts.push(...place(gable(d, w, 0, d * 0.24, 1.6, t.roof, upper), 0, top, 0, Math.PI / 2));
    parts.push(box(w + 0.6, 0.3, 1.6, t.roof, [0, F + SH + 0.15, zf + 0.7], [0.32, 0, 0]));
    parts.push(box(w + 0.6, 0.22, 1.4, SNOW, [0, F + SH + 0.42, zf + 0.68], [0.32, 0, 0]));
    for (const sx of [-1, 1]) parts.push(seg([sx * (w / 2 + 0.6), top + 0.3, zf + 1.6], [sx * (w / 2 + 1.4), top + 1.1, zf + 2.0], 0.16, t.trim));
  }
  return parts;
}

/** The village's own landmark in its frame (front +z): Pinecrest's church and steeple, Frostfang's
 *  radome and mast, Ember's bathhouse and its tall stack, Sakura's temple hall. Returns the parts and
 *  the height its top reaches. */
function landmark(t: Town, biome: BiomeId, night: boolean, F: number, lo: number, p: Palette, s: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const stoneC = stone(p, 0.95);
  const glass = windowColor(night);
  parts.push(grade(box(21, F - lo + 1.5, 15, stoneC, [0, (F + lo - 1.5) / 2, 0]), lo - 1.5, F, 0.68, 0.95));
  parts.push(box(21.2, 0.22, 15.2, SNOW, [0, F + 0.02, 0]));
  if (biome === 'alpine') {
    const white = C('#ECE6EE');
    // The nave, its gable to the street, and the tower at its front corner.
    parts.push(grade(box(11, 9, 14, white, [-2, F + 4.5, -0.5]), F, F + 9, 0.85, 1.02));
    parts.push(...place(gable(11, 14, 0, 4.6, 0.8, t.roof, white), -2, F + 9, -0.5, 0));
    for (let i = 0; i < 3; i++) parts.push(box(1.3, 3.6, 0.16, glass, [-2 - 3 + i * 3, F + 4.8, 6.54]));
    parts.push(part(new CylinderGeometry(1.6, 1.6, 0.2, 14), glass, { pos: [-2, F + 10.2, 6.6], rot: [Math.PI / 2, 0, 0] }));
    const tx = 6.2;
    parts.push(grade(box(5, 22, 5, white, [tx, F + 11, 4]), F, F + 22, 0.85, 1.03));
    parts.push(box(5.5, 0.6, 5.5, t.trim, [tx, F + 22.3, 4]));
    for (const [ax, az] of [[0, 1], [1, 0]] as const) {
      parts.push(box(ax ? 0.2 : 1.6, 2.6, az ? 0.2 : 1.6, INK, [tx + ax * 2.55 * s, F + 19, 4 + az * 2.55]));
    }
    // The clock face toward the run.
    parts.push(part(new CylinderGeometry(1.4, 1.4, 0.2, 16), CREAM, { pos: [tx, F + 15.5, 6.56], rot: [Math.PI / 2, 0, 0] }));
    parts.push(box(0.12, 1.0, 0.12, INK, [tx, F + 15.9, 6.7]));
    parts.push(box(0.7, 0.12, 0.12, INK, [tx + 0.3, F + 15.5, 6.7]));
    parts.push(part(new ConeGeometry(3.6, 13, 4), C('#3E3A5C'), { pos: [tx, F + 29.1, 4], rot: [0, Math.PI / 4, 0] }));
    parts.push(part(new ConeGeometry(2.6, 6, 4), SNOW, { pos: [tx, F + 26.1, 4], rot: [0, Math.PI / 4, 0], jitter: 0.06 }));
    parts.push(seg([tx, F + 35.5, 4], [tx, F + 38.5, 4], 0.08, C('#C9A867'), 4));
    parts.push(seg([tx - 0.8, F + 37.5, 4], [tx + 0.8, F + 37.5, 4], 0.07, C('#C9A867'), 4));
  } else if (biome === 'glacier') {
    // The radome on its drum, the lab block, and a lattice mast with a beacon.
    const white = C('#EEF4FA');
    parts.push(grade(part(new CylinderGeometry(5.2, 5.6, 7, 12), C('#D8E2EE'), { pos: [-3, F + 3.5, -1] }), F, F + 7, 0.85, 1.02));
    parts.push(part(new IcosahedronGeometry(6.4, 1), white, { pos: [-3, F + 10.5, -1] }));
    parts.push(part(new SphereGeometry(5.0, 12, 4, 0, Math.PI * 2, 0, 0.9), SNOW, { pos: [-3, F + 11.2, -1] }));
    for (let i = 0; i < 6; i++) windowAt(parts, -3 + Math.sin(i - 2.5) * 5.4, F + 3.6, -1 + Math.cos(i - 2.5) * 5.4, 1.2, 0.8, glass, INK, 'z', 1);
    parts.push(grade(box(10, 4.2, 8, C('#B5523E'), [5.5, F + 2.1, 2]), F, F + 4.2, 0.85, 1.02));
    parts.push(part(BoxGeometry2(10.8, 1.1, 8.8), SNOW, { pos: [5.5, F + 4.7, 2], jitter: 0.1 }));
    for (let i = 0; i < 4; i++) windowAt(parts, 2 + i * 2.4, F + 2.4, 6.05, 1.6, 0.8, glass, INK, 'z', 1);
    const mx = 7;
    const mz = -4;
    for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parts.push(seg([mx + ax * 1.1, F, mz + az * 1.1], [mx + ax * 0.25, F + 30, mz + az * 0.25], 0.09, C('#C8CCD8'), 4));
    for (let y = F + 3; y < F + 29; y += 3.4) parts.push(box(2 * (1.1 - ((y - F) / 30) * 0.85), 0.1, 2 * (1.1 - ((y - F) / 30) * 0.85), C('#C8CCD8'), [mx, y, mz]));
    parts.push(part(new SphereGeometry(0.5, 8, 6), lampColor(true, '#FF7060'), { pos: [mx, F + 30.6, mz] }));
    parts.push(part(new CylinderGeometry(1.6, 1.6, 0.25, 12), C('#C8CCD8'), { pos: [mx, F + 22, mz + 0.9], rot: [1.1, 0, 0] }));
  } else if (biome === 'volcanic') {
    // The bathhouse: a long stone hall under a dark roof, its tall stack, and its own steaming pool.
    const wall = shade(p.low, 0.62);
    parts.push(grade(box(16, 7, 11, wall, [-1, F + 3.5, -1]), F, F + 7, 0.8, 1.0));
    parts.push(...place(gable(11, 16, 0, 3.2, 1.4, t.roof, wall), -1, F + 7, -1, Math.PI / 2));
    for (let i = 0; i < 5; i++) parts.push(box(1.6, 2.2, 0.16, lampColor(true, '#FF9A50'), [-7 + i * 3, F + 3.4, 4.55]));
    parts.push(box(2.6, 3.0, 0.2, C('#241E26'), [-1, F + 1.5, 4.56]));
    parts.push(box(3.2, 1.1, 0.08, C('#2E3A66'), [-1, F + 2.6, 4.7]));
    parts.push(grade(part(new CylinderGeometry(1.3, 1.8, 24, 8), shade(p.low, 0.5), { pos: [7.2, F + 12, -3] }), F, F + 24, 0.7, 1.0));
    parts.push(part(new CylinderGeometry(1.5, 1.5, 0.6, 8), INK, { pos: [7.2, F + 24, -3] }));
    // The pool before it, rimmed with rocks.
    parts.push(part(new CylinderGeometry(4.2, 4.2, 0.3, 14), C('#4E9AA0'), { pos: [3.5, F + 0.1, 5.2], scale: [1, 1, 0.55] }));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * 6.28;
      parts.push(crag(shade(p.low, 0.55 + rnd() * 0.15), [3.5 + Math.cos(a) * 4.4, F + 0.3, 5.2 + Math.sin(a) * 2.5], [0.9, 0.6, 0.8], 0.3));
    }
  } else {
    // The temple hall: a stone base, lacquered posts, a great swept roof and a second over it.
    const lac = C('#93405A');
    parts.push(grade(box(16, 1.6, 12, stoneC, [0, F + 0.8, -1]), F, F + 1.6, 0.8, 1.0));
    for (let i = 0; i < 6; i++) parts.push(part(new CylinderGeometry(0.42, 0.45, 6, 8), lac, { pos: [-6.5 + i * 2.6, F + 4.6, 4.2] }));
    parts.push(box(14, 6, 9, C('#EDE4D8'), [0, F + 4.6, -1.5]));
    for (let i = 0; i < 4; i++) parts.push(box(1.8, 2.6, 0.16, night ? lampColor(true, '#FFC27A') : C('#3A2A36'), [-4.8 + i * 3.2, F + 4.4, 3.04]));
    parts.push(box(16.4, 0.6, 10.4, lac, [0, F + 7.9, -1]));
    parts.push(...place(sweptRoof(19, 0, t.roof, lac), 0, F + 8.3, -1, 0).map((g) => g.scale(1, 1, 0.78)));
    parts.push(box(8, 3, 6, C('#EDE4D8'), [0, F + 11.5, -1]));
    parts.push(...place(sweptRoof(11, 0, t.roof, lac), 0, F + 13.2, -1, 0));
    parts.push(seg([0, F + 15.5, -1], [0, F + 19, -1], 0.2, C('#5E5468'), 6));
    for (let k = 0; k < 4; k++) parts.push(part(new TorusGeometry(0.5 - k * 0.05, 0.12, 4, 10), C('#5E5468'), { pos: [0, F + 16.2 + k * 0.6, -1], rot: [Math.PI / 2, 0, 0] }));
    // Big lanterns hung under the eave.
    for (const x of [-4, 4]) lantern(parts, x, F + 7.1, 5.2, 0.65, true, t.lamp);
  }
  return parts;
}

// ---------------------------------------------------------------- street props

/** A street lamp at (0, gy) in its own frame, the head toward +z: an iron post (Pinecrest, Frostfang),
 *  a stone lantern (Sakura) or a brazier on a column (Ember). */
function streetLamp(t: Town, biome: BiomeId, night: boolean, gy: number, stoneC: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const lit = lampColor(night || t.lampAlways, t.lamp);
  if (biome === 'blossom') {
    parts.push(box(0.9, 0.5, 0.9, stoneC, [0, gy + 0.25, 0]));
    parts.push(box(0.45, 1.4, 0.45, stoneC, [0, gy + 1.2, 0]));
    parts.push(box(1.0, 0.25, 1.0, stoneC, [0, gy + 2.0, 0]));
    parts.push(box(0.7, 0.7, 0.7, lit, [0, gy + 2.45, 0]));
    parts.push(part(new ConeGeometry(0.95, 0.6, 4), stoneC, { pos: [0, gy + 3.1, 0], rot: [0, Math.PI / 4, 0] }));
    parts.push(part(new ConeGeometry(0.8, 0.4, 4), SNOW, { pos: [0, gy + 3.3, 0], rot: [0, Math.PI / 4, 0] }));
    return parts;
  }
  if (biome === 'volcanic') {
    parts.push(part(new CylinderGeometry(0.45, 0.6, 3.2, 6), shade(stoneC, 0.7), { pos: [0, gy + 1.6, 0] }));
    parts.push(part(new CylinderGeometry(0.75, 0.45, 0.6, 7), INK, { pos: [0, gy + 3.5, 0] }));
    parts.push(part(new ConeGeometry(0.55, 1.4, 6), lampColor(true, '#FFA040'), { pos: [0, gy + 4.4, 0], jitter: 0.2 }));
    return parts;
  }
  parts.push(seg([0, gy - 0.3, 0], [0, gy + 4.6, 0], 0.09, INK, 6));
  parts.push(seg([0, gy + 4.4, 0], [0, gy + 4.6, 0.8], 0.05, INK, 4));
  parts.push(box(0.5, 0.65, 0.5, lit, [0, gy + 4.15, 0.8]));
  parts.push(part(new ConeGeometry(0.45, 0.4, 4), INK, { pos: [0, gy + 4.65, 0.8], rot: [0, Math.PI / 4, 0] }));
  parts.push(part(new ConeGeometry(0.35, 0.22, 4), SNOW, { pos: [0, gy + 4.85, 0.8], rot: [0, Math.PI / 4, 0] }));
  parts.push(drift([0, gy, 0], [0.45, 0.2, 0.45]));
  return parts;
}

/** A market stall (front +z): a counter, a striped canopy, goods on it and a lamp. */
function stall(t: Town, night: boolean, gy: number, cols: Color[]): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const wood = TIMBER_LIGHT;
  parts.push(box(3.2, 1.0, 1.4, wood, [0, gy + 0.5, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(seg([sx * 1.55, gy, sz * 0.65], [sx * 1.55, gy + 2.6, sz * 0.65], 0.06, TIMBER_DARK, 4));
  const a = cols[Math.floor(rnd() * cols.length)];
  for (let i = 0; i < 5; i++) parts.push(box(0.68, 0.1, 2.0, i % 2 ? CREAM : a, [-1.36 + i * 0.68, gy + 2.75, 0.15], [0.22, 0, 0]));
  parts.push(box(3.4, 0.16, 1.8, SNOW, [0, gy + 2.92, 0.1], [0.22, 0, 0]));
  // Goods: jars, loaves, little wrapped boxes.
  for (let i = 0; i < 6; i++) {
    const c = [C('#C9A867'), C('#8A5E44'), C('#9CC0EE'), CREAM, C('#6A4C86'), C('#47704A')][Math.floor(rnd() * 6)];
    parts.push(box(0.32, 0.26 + rnd() * 0.2, 0.32, c, [-1.2 + i * 0.48, gy + 1.15, 0.2 + (rnd() - 0.5) * 0.4]));
  }
  parts.push(part(new SphereGeometry(0.18, 6, 5), lampColor(night || t.lampAlways, t.lamp), { pos: [0, gy + 2.35, 0.6] }));
  return parts;
}

/** A snowman with a scarf and stick arms. */
function snowman(gy: number, scarf: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  parts.push(softPart(new IcosahedronGeometry(0.62, 1), SNOW, { pos: [0, gy + 0.5, 0] }));
  parts.push(softPart(new IcosahedronGeometry(0.46, 1), SNOW, { pos: [0, gy + 1.25, 0] }));
  parts.push(softPart(new IcosahedronGeometry(0.33, 1), SNOW, { pos: [0, gy + 1.82, 0] }));
  parts.push(part(new CylinderGeometry(0.32, 0.36, 0.14, 8), scarf, { pos: [0, gy + 1.56, 0] }));
  parts.push(part(new ConeGeometry(0.07, 0.36, 5), C('#D9823F'), { pos: [0, gy + 1.82, 0.42], rot: [Math.PI / 2, 0, 0] }));
  for (const sx of [-1, 1]) parts.push(part(new IcosahedronGeometry(0.045, 0), INK, { pos: [sx * 0.12, gy + 1.92, 0.3] }));
  for (const sx of [-1, 1]) parts.push(seg([sx * 0.4, gy + 1.3, 0], [sx * 1.0, gy + 1.7, 0.1], 0.03, TIMBER_DARK, 3));
  parts.push(part(new CylinderGeometry(0.2, 0.24, 0.32, 8), INK, { pos: [0, gy + 2.2, 0] }));
  return parts;
}

/** A toy sled parked on end against a wall (own +z out from the wall). */
function parkedSled(gy: number, col: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) parts.push(seg([sx * 0.32, gy, 0.35], [sx * 0.32, gy + 1.5, 0.05], 0.035, INK, 4));
  for (let k = 0; k < 4; k++) parts.push(box(0.75, 0.06, 0.2, col, [0, gy + 0.3 + k * 0.32, 0.3 - k * 0.06], [-0.2, 0, 0]));
  return parts;
}

/** A stack of firewood or a barrel. */
function woodpile(gy: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) parts.push(part(new CylinderGeometry(0.17, 0.17, 1.1, 6), i % 2 ? TIMBER : TIMBER_LIGHT, { pos: [-0.55 + i * 0.36 + r * 0.18, gy + 0.18 + r * 0.31, 0], rot: [Math.PI / 2, 0, 0] }));
  parts.push(box(1.5, 0.14, 1.2, SNOW, [0, gy + 1.0, 0]));
  return parts;
}

/** A blossom tree: a twisting trunk and pale pink clouds of bloom under snow. */
function blossomTree(gy: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const bark = C('#4A3A46');
  parts.push(seg([0, gy - 0.3, 0], [0.4, gy + 2.6, 0.2], 0.28, bark, 5));
  parts.push(seg([0.4, gy + 2.6, 0.2], [1.6, gy + 3.6, 0.6], 0.18, bark, 5));
  parts.push(seg([0.4, gy + 2.6, 0.2], [-1.0, gy + 3.8, -0.3], 0.18, bark, 5));
  const pinks = [C('#EBC2D4'), C('#F4CFDC'), C('#E2B0C4')];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * 6.28 + rnd();
    parts.push(crag(pinks[k % 3], [0.3 + Math.cos(a) * 1.5, gy + 3.9 + rnd() * 0.8, 0.2 + Math.sin(a) * 1.3], [1.4, 1.0, 1.3], 0.3));
  }
  parts.push(drift([0.3, gy + 4.7, 0.2], [1.6, 0.35, 1.4]));
  return parts;
}

/** A steaming pool on the terrace (Ember), rimmed with rocks. */
function springPool(gy: number, p: Palette): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  parts.push(part(new CylinderGeometry(2.2, 2.2, 0.3, 12), C('#4E9AA0'), { pos: [0, gy + 0.12, 0], scale: [1, 1, 0.6] }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 6.28;
    parts.push(crag(shade(p.low, 0.55 + rnd() * 0.15), [Math.cos(a) * 2.3, gy + 0.25, Math.sin(a) * 1.4], [0.6, 0.45, 0.55], 0.3));
  }
  return parts;
}

/** A Frostfang ice-fishing shanty: a little timber hut on runners, a stovepipe, a hole beside it. */
function shanty(gy: number, col: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  parts.push(grade(box(2.6, 2.3, 2.2, col, [0, gy + 1.35, 0]), gy, gy + 2.5, 0.85, 1.02));
  parts.push(box(3.0, 0.25, 2.6, C('#56607A'), [0, gy + 2.6, 0], [0.12, 0, 0]));
  parts.push(box(3.0, 0.35, 2.5, SNOW, [0, gy + 2.85, 0], [0.12, 0, 0]));
  for (const sx of [-1, 1]) parts.push(box(0.12, 0.15, 2.6, INK, [sx * 1.1, gy + 0.12, 0]));
  parts.push(box(0.8, 1.6, 0.12, INK, [0.6, gy + 1.0, 1.12]));
  parts.push(seg([-0.8, gy + 2.6, -0.4], [-0.8, gy + 4.0, -0.4], 0.1, INK, 6));
  parts.push(part(new CylinderGeometry(0.45, 0.45, 0.04, 10), C('#2A3A5A'), { pos: [1.9, gy + 0.03, 0.8] }));
  return parts;
}

// ---------------------------------------------------------------- the village

interface Lot {
  s: number;
  dz: number;
  w: number;
  d: number;
  e: number;
  kind: 'house' | 'shop' | 'hotel' | 'landmark';
  storeys: number;
}

interface Prop {
  s: number;
  dz: number;
  e: number;
  kind: 'lamp' | 'stall' | 'snowman' | 'sled' | 'wood' | 'tree' | 'pool' | 'shanty' | 'pole';
}

/** The street's crowd rows (edge excess) along each bank crest. */
const ROWS = [9.75, 10.95, 12.15];

/** A ride-through village along the site's rail (see the file's head). */
export function villagePiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('villagePiece: no rail');
  const { p, biome, night } = ctx;
  const t = townStyle(biome, p);
  const stoneC = biome === 'volcanic' ? shade(p.low, 0.55) : stone(p, 0.85);
  const cols = banners(p);
  const L = rail.len;
  seed(ctx.seed + 201);
  // Lay the lots out down each bank: houses and shops, a landmark on one side, the hotel across.
  const lots: Lot[] = [];
  const props: Prop[] = [];
  const markSide = ctx.side;
  const markAt = (rnd() - 0.5) * L * 0.5;
  const hotelAt = (rnd() - 0.5) * L * 0.6;
  for (const s of [-1, 1]) {
    let dz = -L + 4 + rnd() * 5;
    let k = 0;
    let markDone = false;
    let hotelDone = false;
    while (dz < L - 8) {
      let kind: Lot['kind'] = rnd() < 0.42 ? 'shop' : 'house';
      let w = 9 + rnd() * 4.5;
      let d = 8.5 + rnd() * 2.5;
      let storeys = biome === 'glacier' ? 1 + (rnd() < 0.5 ? 1 : 0) : 2 + (rnd() < 0.45 ? 1 : 0);
      let e = 13.6 + rnd() * 1.2;
      if (s === markSide && !markDone && dz + 10 > markAt) {
        kind = 'landmark';
        w = 21;
        d = 15;
        e = 14.4;
        markDone = true;
      } else if (s !== markSide && !hotelDone && dz + 10 > hotelAt) {
        kind = 'hotel';
        w = 19 + rnd() * 3;
        d = 11;
        storeys = biome === 'glacier' ? 3 : 4 + (rnd() < 0.5 ? 1 : 0);
        e = 14;
        hotelDone = true;
      }
      if (dz + w > L - 4) break;
      lots.push({ s, dz: dz + w / 2, w, d, e, kind, storeys });
      // A lane every few lots: a stall, a tree or a pool in the gap.
      k++;
      let gap = 1.6 + rnd() * 2.2;
      if (k % 3 === 0 && dz + w + 8 < L - 8) {
        gap = 7 + rnd() * 2;
        const lane = dz + w + gap / 2;
        const what: Prop['kind'] = biome === 'blossom' ? 'tree' : biome === 'volcanic' ? 'pool' : biome === 'glacier' ? 'shanty' : rnd() < 0.5 ? 'stall' : 'wood';
        props.push({ s, dz: lane, e: what === 'shanty' ? 16 : 15.5, kind: what });
      }
      dz += w + gap;
    }
    // Lamps down the crest, and stalls, snowmen and sleds before the fronts.
    for (let lz = -L + 8 + (s > 0 ? 7 : 0); lz < L - 6; lz += 15 + rnd() * 4) props.push({ s, dz: lz, e: 10.6, kind: 'lamp' });
    for (let sz = -L + 14 + rnd() * 10; sz < L - 10; sz += 18 + rnd() * 14) {
      const r = rnd();
      props.push({ s, dz: sz, e: 13.0, kind: r < 0.45 ? 'stall' : r < 0.75 ? 'snowman' : 'sled' });
    }
  }
  // Festival masts in pairs down the crests every 14 to 20 m. Strings hang across the street from their
  // tops (bunting, or lanterns in Sakura and Ember) and two banners, each only as high as it must to
  // clear the highest air there (a pop off a bump at full speed flies 20 m: the masts stand tall);
  // lower strings run along each crest from mast to mast at street height.
  const strings: Array<{ dz: number; banner: boolean; across: boolean; yA: number; gA: number; gB: number }> = [];
  for (let sz = -L + 6 + rnd() * 4; sz < L - 4; sz += 14 + rnd() * 6) strings.push({ dz: sz, banner: false, across: false, yA: 0, gA: 0, gB: 0 });
  if (strings.length > 4) {
    strings[1].banner = true;
    strings[strings.length - 2].banner = true;
  }
  const POLE_E = 12.9;
  for (const st of strings) {
    const a = rail.at(st.dz, -1, POLE_E);
    const b = rail.at(st.dz, 1, POLE_E);
    st.gA = a.y;
    st.gB = b.y;
    const hang = (st.banner ? 2.6 : 1.3) + 1.2;
    const need = rail.air(st.dz - 4, st.dz + 4) + AIR_MARGIN + hang;
    const g = Math.max(a.y, b.y);
    st.across = need < g + 26;
    st.yA = st.across ? Math.max(g + 9, need) : g + 9;
    for (const s of [-1, 1]) props.push({ s, dz: st.dz, e: POLE_E, kind: 'pole' });
  }
  const keepStrings = strings;
  // The crowd: three dense rows down each crest, gaps where a lamp, a pole or a stall stands.
  const spots: Spot[] = [];
  const blocked = (s: number, dz: number, e: number) => props.some((q) => q.s === s && Math.abs(q.dz - dz) < (q.kind === 'stall' ? 2.4 : 1.1) && Math.abs(q.e - e) < (q.kind === 'stall' ? 1.4 : 0.9));
  for (const s of [-1, 1]) {
    for (let r = 0; r < ROWS.length; r++) {
      for (let dz = -L + 3 + r * 0.6; dz < L - 3; dz += 1.3) {
        if (rnd() < 0.14 + r * 0.06) continue;
        const e = ROWS[r] + (rnd() - 0.5) * 0.3;
        const jz = dz + (rnd() - 0.5) * 0.5;
        if (blocked(s, jz, e)) continue;
        const pt = rail.at(jz, s, e);
        spots.push({ x: pt.x, y: pt.y - 0.03, z: pt.z, yaw: pt.yaw + s * 0.6 + (rnd() - 0.5) * 0.6, flag: rnd() < 0.2 });
      }
    }
  }
  // Light: a pool under every lamp spilling down the bank toward the street, and before lit shops.
  const glows: Glow[] = [];
  for (const q of props) {
    if (q.kind !== 'lamp') continue;
    const pt = rail.at(q.dz, q.s, 7.9);
    glows.push({ x: pt.x, z: pt.z, r: 3.9 });
  }
  for (const l of lots) {
    if (l.kind !== 'shop' && l.kind !== 'hotel') continue;
    const pt = rail.at(l.dz, l.s, l.e - 1.6);
    glows.push({ x: pt.x, z: pt.z, r: 2.6 });
  }
  // Steam off the hot springs and the bathhouse's stack (Ember).
  const steam: V3[] = [];
  for (const q of props) {
    if (q.kind !== 'pool') continue;
    const pt = rail.at(q.dz, q.s, q.e);
    steam.push([pt.x, ctx.gy(pt.x, pt.z) + 0.5, pt.z]);
  }
  if (biome === 'volcanic') {
    for (const l of lots) {
      if (l.kind !== 'landmark') continue;
      const pt = rail.at(l.dz, l.s, l.e + l.d / 2);
      const f = new Sub(ctx, pt.x, pt.z, pt.yaw);
      const F = f.range(l.w / 2 + 0.6, l.d / 2 + 0.6)[1] + 0.4;
      for (const [u, y, v] of [[7.2, 24.8, -3], [3.5, 0.6, 5.2], [1.6, 0.6, 5.6], [5.4, 0.6, 4.9]]) {
        const w = f.spot(u, F + y, v, 0);
        steam.push([w.x, w.y, w.z]);
      }
    }
  }
  const steps: Array<() => BufferGeometry[]> = [];
  // The lots, one to a step (a hotel or the landmark is a few ms on its own).
  for (let i = 0; i < lots.length; i++) {
    steps.push(() => {
      seed(ctx.seed + 211 + i);
      const parts: BufferGeometry[] = [];
      for (const l of lots.slice(i, i + 1)) {
        const pt = rail.at(l.dz, l.s, l.e + l.d / 2);
        const f = new Sub(ctx, pt.x, pt.z, pt.yaw);
        const [lo, hi] = f.range(l.w / 2 + 0.6, l.d / 2 + 0.6);
        const F = hi + 0.4;
        if (l.kind === 'landmark') parts.push(...f.out(landmark(t, biome, night, F, lo, p, l.s)));
        else {
          parts.push(...f.out(house(t, biome, night, F, lo, { w: l.w, d: l.d, storeys: l.storeys, shop: l.kind === 'shop', balconies: l.kind === 'hotel' || (biome === 'alpine' && rnd() < 0.5), s: l.s }, stoneC)));
          // A parked sled or a woodpile against some fronts.
          if (rnd() < 0.35) parts.push(...f.out(place(rnd() < 0.5 ? parkedSled(F, cols[Math.floor(rnd() * cols.length)]) : woodpile(F), (rnd() - 0.5) * l.w * 0.7, 0, l.d / 2 + 0.3, 0)));
        }
      }
      return parts;
    });
  }
  // The props and the masts, ten to a step.
  for (let j = 0; j < props.length; j += 10) steps.push(() => {
    seed(ctx.seed + 271 + j);
    const parts: BufferGeometry[] = [];
    for (const q of props.slice(j, j + 10)) {
      const pt = rail.at(q.dz, q.s, q.e);
      const f = new Sub(ctx, pt.x, pt.z, pt.yaw);
      const gy = f.gy(0, 0);
      switch (q.kind) {
        case 'lamp':
          parts.push(...f.out(streetLamp(t, biome, night, gy, stoneC)));
          break;
        case 'stall':
          parts.push(...f.out(stall(t, night, gy, cols)));
          break;
        case 'snowman':
          parts.push(...f.out(snowman(gy, cols[Math.floor(rnd() * cols.length)])));
          break;
        case 'sled':
          parts.push(...f.out(parkedSled(gy, cols[Math.floor(rnd() * cols.length)])));
          break;
        case 'wood':
          parts.push(...f.out(woodpile(gy)));
          break;
        case 'tree':
          parts.push(...f.out(blossomTree(gy)));
          break;
        case 'shanty':
          parts.push(...f.out(shanty(gy, t.lower[Math.floor(rnd() * t.lower.length)])));
          break;
        case 'pool':
          parts.push(...f.out(springPool(gy, p)));
          break;
        case 'pole': {
          // A festival mast: banded in the mood's colours, a gilt finial and a long pennant streaming.
          const st = keepStrings.find((x) => x.dz === q.dz);
          const top = st ? st.yA + 0.6 : gy + 9;
          const mast = biome === 'blossom' ? C('#93405A') : TIMBER_DARK;
          parts.push(grade(seg([pt.x, gy - 0.5, pt.z], [pt.x, top, pt.z], 0.17, mast, 6), gy, top, 0.8, 1.05));
          for (let y = gy + 3, k = 0; y < top - 1; y += 2.4, k++) parts.push(part(new CylinderGeometry(0.2, 0.2, 0.7, 6), k % 2 ? CREAM : cols[0], { pos: [pt.x, y, pt.z] }));
          parts.push(heap([pt.x, gy, pt.z], [0.55, 0.25, 0.55]));
          parts.push(part(new SphereGeometry(0.28, 6, 5), C('#C9A867'), { pos: [pt.x, top + 0.2, pt.z] }));
          const pen = new ConeGeometry(0.5, 3.2, 3);
          pen.rotateZ(-q.s * Math.PI / 2);
          pen.scale(1, 1, 0.12);
          parts.push(part(pen, cols[(Math.round(q.dz) & 1) * 2], { pos: [pt.x + q.s * 1.6, top - 0.6, pt.z] }));
          break;
        }
      }
    }
    return parts;
  });
  // The strings and banners overhead.
  steps.push(() => {
    seed(ctx.seed + 281);
    const parts: BufferGeometry[] = [];
    const lanterns = biome === 'blossom' || biome === 'volcanic';
    for (const st of keepStrings) {
      if (!st.across) continue;
      const a = rail.at(st.dz, -1, POLE_E);
      const b = rail.at(st.dz, 1, POLE_E);
      const A: V3 = [a.x, st.yA, a.z];
      const B: V3 = [b.x, st.yA, b.z];
      if (st.banner) {
        // A long cloth banner on a pair of ropes, cream with the mood's stripes and a round badge.
        parts.push(seg(A, B, 0.05, INK, 3));
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
        const bw = Math.min(14, Math.hypot(b.x - a.x, b.z - a.z) * 0.45);
        const bp: BufferGeometry[] = [];
        bp.push(box(bw, 2.4, 0.08, CREAM, [0, -1.25, 0]));
        bp.push(box(bw, 0.36, 0.1, cols[0], [0, -0.35, 0]));
        bp.push(box(bw, 0.36, 0.1, cols[2], [0, -2.15, 0]));
        const disc = new CylinderGeometry(0.8, 0.8, 0.14, 14);
        disc.rotateX(Math.PI / 2);
        bp.push(part(disc, INK, { pos: [0, -1.25, 0.06] }));
        bp.push(part(new ConeGeometry(0.55, 0.7, 3).scale(1, 1, 0.1), CREAM, { pos: [0, -1.2, 0.14] }));
        for (const sx of [-1, 1]) bp.push(seg([sx * bw * 0.5, 0, 0], [sx * bw * 0.5, -0.05, 0], 0.04, INK, 3));
        parts.push(...place(bp, mx, st.yA - 0.02, mz, yaw));
      } else if (lanterns) parts.push(...lanternString(A, B, 1.0, night || t.lampAlways, t.lamp));
      else parts.push(...bunting(A, B, 1.0, cols, 0.95));
    }
    // Bunting down each crest from mast to mast at street height, along the street.
    for (const s of [-1, 1]) {
      for (let i = 0; i + 1 < keepStrings.length; i++) {
        const a = rail.at(keepStrings[i].dz, s, POLE_E);
        const b = rail.at(keepStrings[i + 1].dz, s, POLE_E);
        const ya = a.y + 6.2;
        const yb = b.y + 6.2;
        if (lanterns) parts.push(...lanternString([a.x, ya, a.z], [b.x, yb, b.z], 1.4, night || t.lampAlways, t.lamp));
        else parts.push(...bunting([a.x, ya, a.z], [b.x, yb, b.z], 1.6, cols, 0.8));
      }
    }
    return parts;
  });
  // The entry gates at each end: two posts at the crest, a name board high across.
  for (const end of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 291 + end);
      const dz = end * (L - 2);
      const need = rail.air(dz - 5, dz + 5) + AIR_MARGIN;
      const c = rail.at(dz, 0, 0);
      const f = new Sub(ctx, c.x, c.z, c.yaw);
      const X = c.hw + KEEP + 1.2;
      const gL = f.gy(-X, 0);
      const gR = f.gy(X, 0);
      const H = Math.max(need, Math.max(gL, gR) + 7, rail.floor(dz) + 16);
      if (H - Math.max(gL, gR) > 26) return [];
      const parts: BufferGeometry[] = [];
      const blossom = biome === 'blossom';
      const post = blossom ? C('#93405A') : biome === 'volcanic' ? shade(p.low, 0.55) : biome === 'glacier' ? C('#6A7088') : TIMBER;
      for (const sx of [-1, 1]) {
        const g = sx < 0 ? gL : gR;
        if (blossom) parts.push(grade(part(new CylinderGeometry(0.75, 0.9, H + 3 - g + 1.5, 10), post, { pos: [sx * X, (H + 3 + g - 1.5) / 2, 0] }), g, H + 3, 0.75, 1.05));
        else parts.push(grade(box(1.2, H + 3 - g + 1.5, 1.2, post, [sx * X, (H + 3 + g - 1.5) / 2, 0]), g, H + 3, 0.75, 1.05));
        parts.push(heap([sx * (X + 0.3), g, 0], [0.9, 0.4, 0.9]));
        lantern(parts, sx * X, H - 2.0, 1.0, 0.5, night || t.lampAlways, t.lamp);
      }
      const W = 2 * X + 3;
      if (blossom) {
        // A torii: the nuki, and the kasagi curving up toward its ends.
        parts.push(box(W - 1, 1.0, 0.8, post, [0, H + 0.5, 0]));
        const n = 10;
        for (let i = 0; i < n; i++) {
          const x0 = -W / 2 - 1 + ((W + 2) * i) / n;
          const x1 = -W / 2 - 1 + ((W + 2) * (i + 1)) / n;
          const lift = (x: number) => 1.4 * Math.pow(Math.abs(x) / (W / 2 + 1), 2.6);
          parts.push(seg([x0, H + 3.2 + lift(x0), 0], [x1, H + 3.2 + lift(x1), 0], 0.7, C('#24202E'), 4));
          parts.push(seg([x0, H + 3.85 + lift(x0), 0], [x1, H + 3.85 + lift(x1), 0], 0.35, SNOW, 4));
        }
        parts.push(box(2.2, 2.0, 0.3, C('#24202E'), [0, H + 2.0, 0.3]));
        parts.push(box(1.7, 1.5, 0.32, C('#C9A867'), [0, H + 2.0, 0.32]));
      } else {
        parts.push(grade(box(W, 0.8, 0.9, post, [0, H + 0.4, 0]), H, H + 0.8, 0.85, 1.05));
        parts.push(box(W, 0.6, 0.9, post, [0, H + 3.1, 0]));
        parts.push(box(W + 0.3, 0.35, 1.1, SNOW, [0, H + 3.55, 0]));
        // The name board: cream with two of the mood's stripes and a badge with a peak.
        const bw = Math.min(W * 0.45, 13);
        parts.push(box(bw, 2.0, 0.25, CREAM, [0, H + 1.75, 0.5]));
        parts.push(box(bw, 0.32, 0.27, cols[0], [0, H + 2.45, 0.52]));
        parts.push(box(bw, 0.32, 0.27, cols[2], [0, H + 1.05, 0.52]));
        const disc = new CylinderGeometry(0.75, 0.75, 0.2, 14);
        disc.rotateX(Math.PI / 2);
        parts.push(part(disc, INK, { pos: [0, H + 1.75, 0.64] }));
        parts.push(part(new ConeGeometry(0.5, 0.65, 3).scale(1, 1, 0.1), CREAM, { pos: [0, H + 1.8, 0.75] }));
        parts.push(...bunting([-X, H + 3.0, 0.5], [X, H + 3.0, 0.5], 0.4, cols, 0.7));
      }
      return f.out(parts);
    });
  }
  return { steps, spots, ice: false, glows, steam };
}

// ---------------------------------------------------------------- enclosed runs

/** One bay of an enclosure: its frame across the run, the corridor's half-width it must clear (with
 *  the centre line's drift over the bay), the roof's underside (local y) and its pitch. */
interface Bay {
  f: Sub;
  dz: number;
  /** Half the span to the inner face of anything standing: corridor half-width, drift and KEEP. */
  X: number;
  R: number;
  pitch: number;
  hw: number;
}

function bays(ctx: SiteCtx, rail: Rail, B: number, from = -rail.len, to = rail.len): Bay[] {
  const out: Bay[] = [];
  const n = Math.max(1, Math.round((to - from) / B));
  const step = (to - from) / n;
  for (let i = 0; i < n; i++) {
    const dz = from + (i + 0.5) * step;
    const c = rail.at(dz, 0, 0);
    const cy = Math.cos(c.yaw);
    const sy = Math.sin(c.yaw);
    let drift = 0;
    let hw = c.hw;
    for (const o of [-step / 2 - 0.5, step / 2 + 0.5]) {
      const q = rail.at(dz + o, 0, 0);
      drift = Math.max(drift, Math.abs((q.x - c.x) * cy - (q.z - c.z) * sy));
      hw = Math.max(hw, q.hw);
    }
    const R = rail.floor(dz) + ctx.clear;
    const up = (rail.floor(dz - step / 2) - rail.floor(dz + step / 2)) / step;
    out.push({ f: new Sub(ctx, c.x, c.z, c.yaw), dz, X: hw + drift + KEEP, R, pitch: -Math.atan(up), hw });
  }
  return out;
}

/** Parts built level at a bay's centre, turned to the roof's pitch and lifted to its underside. */
function pitched(b: Bay, parts: BufferGeometry[]): BufferGeometry[] {
  for (const g of parts) {
    g.rotateX(b.pitch);
    g.translate(0, b.R, 0);
  }
  return parts;
}

/** The side an enclosure opens to: toward the light (the sun's or moon's side of the run). */
function openSide(ctx: SiteCtx, yaw: number): number {
  const d = ctx.p.sunDir;
  const lx = d.x * Math.cos(yaw) - d.z * Math.sin(yaw);
  return Math.abs(lx) > 0.12 ? Math.sign(lx) : ctx.side;
}

/** An avalanche gallery over the run: a deep roof on cross beams, a wall up the closed side, square
 *  pillars on the open side so the light comes through in bars, lamps along the beams, portal head
 *  walls at each end with the mood's warning stripes, and the snow heaped on the roof. Pinecrest and
 *  Frostfang in pale concrete, Ember in dark basalt blocks, Sakura in dark timber. */
export function galleryPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('galleryPiece: no rail');
  const { p, biome, night } = ctx;
  const B = 6;
  const list = bays(ctx, rail, B);
  const os = openSide(ctx, list[Math.floor(list.length / 2)].f.yaw);
  const timber = biome === 'blossom';
  const body = timber ? C('#4A3A40') : biome === 'volcanic' ? shade(p.low, 0.6) : biome === 'glacier' ? C('#9AA4BC') : C('#B4AEB4').lerp(p.low, 0.18);
  const bodyD = shade(body, 0.72);
  const lamp = lampColor(true, '#FFC27A');
  const cols = banners(p);
  const steps: Array<() => BufferGeometry[]> = [];
  const P = 0.6;
  for (let i0 = 0; i0 < list.length; i0 += 4) {
    steps.push(() => {
      seed(ctx.seed + 301 + i0);
      const parts: BufferGeometry[] = [];
      for (const b of list.slice(i0, i0 + 4)) {
        const xo = os * (b.X + P + 0.15);
        const xw = -os * (b.X + 0.75);
        const W = b.X * 2 + 2 * P + 3.4;
        const xc = os * 0.8;
        const roof: BufferGeometry[] = [];
        roof.push(grade(box(W, 0.9, timber ? 0.6 : 0.85, bodyD, [xc, 0.45, 0]), 0, 0.9, 0.8, 1.0));
        roof.push(box(W, timber ? 0.45 : 0.7, B + 0.06, body, [xc, 0.9 + (timber ? 0.22 : 0.35), 0]));
        if (timber) for (let k = -2; k <= 2; k++) roof.push(box(W, 0.12, 0.25, bodyD, [xc, 1.42, k * 1.2]));
        roof.push(part(BoxGeometry2(W + 0.6, 1.3, B + 0.2), SNOW, { pos: [xc - os * 0.3, 2.1, 0], jitter: 0.16 }));
        // A cornice of snow curling over the open edge.
        roof.push(softPart(new CylinderGeometry(0.8, 0.8, B + 0.1, 8), SNOW, { pos: [xc + os * (W / 2 + 0.1), 1.8, 0], rot: [Math.PI / 2, 0, 0], scale: [1.2, 1, 0.9] }));
        // Light bars: two lamps on each beam's up-slope face.
        for (const lx of [-0.42, 0.42]) roof.push(box(2.2, 0.28, 0.12, lamp, [lx * b.hw, 0.5, (timber ? 0.3 : 0.425) + 0.05]));
        parts.push(...b.f.out(pitched(b, roof)));
        // The open side's pillar, from the bank to the beam.
        const yTop = b.R + 0.9;
        const g0 = b.f.gy(xo, 0);
        const pil: BufferGeometry[] = [];
        if (timber) pil.push(grade(seg([xo, g0 - 1, 0], [xo, yTop, 0], P, body, 4), g0, yTop, 0.7, 1.0));
        else pil.push(grade(box(2 * P, yTop - g0 + 1, 2 * P, body, [xo, (yTop + g0 - 1) / 2, 0]), g0, yTop, 0.7, 1.0));
        // A knee brace from pillar to beam, outside the run.
        pil.push(seg([xo, yTop - 2.4, 0], [xo + os * 1.6, yTop - 0.3, 0], 0.22, bodyD));
        pil.push(heap([xo + os * 0.25, g0, 0], [0.6, 0.35, 0.8]));
        // The closed wall up the slope, its buttress outside and a lamp on its face every other bay.
        const gw = b.f.gy(xw, 0);
        pil.push(grade(box(1.5, yTop - gw + 1.5, B + 0.05, body, [xw, (yTop + gw - 1.5) / 2, 0]), gw, yTop, 0.62, 0.95));
        pil.push(box(1.2, (yTop - gw) * 0.8, 1.2, bodyD, [xw - os * 1.3, gw + (yTop - gw) * 0.4, 0]));
        if (Math.round(b.dz / B) % 2 === 0) pil.push(box(0.12, 0.6, 1.6, lamp, [xw + os * 0.78, yTop - 2.6, 0]));
        // Snow banked against the wall's outer foot.
        pil.push(heap([xw - os * 1.6, gw + 0.2, 0], [1.4, 0.9, B * 0.55]));
        parts.push(...b.f.out(pil));
      }
      return parts;
    });
  }
  // The portals.
  for (const end of [0, list.length - 1]) {
    steps.push(() => {
      seed(ctx.seed + 351 + end);
      const b = list[end];
      const face = end === 0 ? 1 : -1;
      const zf = face * (B / 2 + 0.5);
      const W = b.X * 2 + 2 * P + 4.2;
      const parts: BufferGeometry[] = [];
      const head: BufferGeometry[] = [];
      head.push(grade(box(W, 3.6, 1.2, body, [os * 0.8, 1.8, zf]), 0, 3.6, 0.8, 1.02));
      // Warning chevrons in cream and ink along the lintel's face.
      const n = Math.round(W / 1.6);
      for (let k = 0; k < n; k++) head.push(box(0.8, 0.9, 0.08, k % 2 ? INK : CREAM, [os * 0.8 - W / 2 + (k + 0.5) * (W / n), 0.85, zf + face * 0.62], [0, 0, 0.5]));
      head.push(box(W * 0.3, 1.2, 0.1, cols[0], [os * 0.8, 2.5, zf + face * 0.62]));
      head.push(part(BoxGeometry2(W + 0.5, 1.6, 2.4), SNOW, { pos: [os * 0.8, 4.1, zf], jitter: 0.2 }));
      parts.push(...b.f.out(pitched(b, head)));
      // Wing walls down into each bank, and a lamp on each.
      for (const sx of [-1, 1]) {
        const x = sx * (b.X + 1.1);
        const g = b.f.gy(x, zf);
        parts.push(...b.f.out([grade(box(2.2, b.R + 3.6 - g + 1.5, 1.6, bodyD, [x, (b.R + 3.6 + g - 1.5) / 2, zf]), g, b.R + 3.6, 0.65, 0.95)]));
        parts.push(...b.f.out([part(new SphereGeometry(0.35, 8, 6), lampColor(night, '#FFC27A'), { pos: [x, b.R - 1.2, zf + face * 0.95] })]));
      }
      return parts;
    });
  }
  return { steps, spots: [], ice: false };
}

/** A faceted mass that only turns about the vertical, so its reach is its scale (and a quarter more
 *  for the jitter): what keeps a vault's lowest facet over the clearance. */
function rock(col: Color, pos: V3, scale: V3, jitter = 0.28): BufferGeometry {
  return part(new IcosahedronGeometry(1, 0), col, { pos, scale, jitter });
}

/** The vault of a rock or ice tunnel, bay by bay: wall masses standing on each bank past the keep
 *  line, roof masses over the run whose lowest facet stays above the clearance, and the snow on top.
 *  `hole` leaves a gap in the open side's wall every few bays for a shaft of light. */
function vault(b: Bay, cols: Color[], os: number, hole: boolean, parts: BufferGeometry[]): void {
  const roof: BufferGeometry[] = [];
  const X = b.X;
  // Roof masses across the span.
  const n = Math.ceil((2 * X + 6) / 4.2);
  for (let k = 0; k < n; k++) {
    const x = -X - 3 + ((k + 0.5) * (2 * X + 6)) / n;
    const sy = 1.5 + rnd() * 0.8;
    roof.push(rock(cols[k % cols.length], [x, sy * 1.3 + 0.12, (rnd() - 0.5) * 1.2], [2.6 + rnd() * 0.6, sy, 3.6 + rnd() * 0.6]));
  }
  roof.push(drift([0, 4.6, 0], [X + 4, 1.1, 3.4]));
  parts.push(...b.f.out(pitched(b, roof)));
  // The walls: masses stacked from each bank up to the roof.
  for (const sx of [-1, 1]) {
    if (hole && sx === os) continue;
    const xw = sx * (X + 2.45);
    const g = b.f.gy(xw, 0);
    for (let y = g - 1; y < b.R + 1.5; y += 2.8) parts.push(...b.f.out([rock(cols[(Math.round(y) + 7) % cols.length], [xw + sx * rnd() * 0.6, y + 1.2, (rnd() - 0.5) * 1.5], [1.85, 1.9, 3.4], 0.24)]));
  }
}

/** Frostfang's ice tunnel: a vault of translucent blue ice over the run (the ice material), icicles
 *  under its crown, shafts of light where its wall thins. */
export function iceTunnelPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('iceTunnelPiece: no rail');
  const list = bays(ctx, rail, 5);
  const os = openSide(ctx, list[Math.floor(list.length / 2)].f.yaw);
  const cols = [new Color('#7FC4E6'), new Color('#A8DDF2'), new Color('#5E9FD0'), new Color('#93D2EE')];
  const steps: Array<() => BufferGeometry[]> = [];
  for (let i0 = 0; i0 < list.length; i0 += 4) {
    steps.push(() => {
      seed(ctx.seed + 401 + i0);
      const parts: BufferGeometry[] = [];
      list.slice(i0, i0 + 4).forEach((b, j) => {
        vault(b, cols, os, (i0 + j) % 3 === 1, parts);
        // Icicles hung from the vault, their tips over the clearance.
        const ic: BufferGeometry[] = [];
        for (let k = 0; k < 5; k++) {
          const len = 0.8 + rnd() * 1.1;
          ic.push(part(new ConeGeometry(0.16 + rnd() * 0.14, len, 5), new Color('#E4F6FF'), { pos: [(rnd() - 0.5) * 2 * b.hw, 0.5 + len / 2 + 0.05, (rnd() - 0.5) * 3], rot: [Math.PI, 0, 0] }));
        }
        parts.push(...b.f.out(pitched(b, ic)));
      });
      return parts;
    });
  }
  return { steps, spots: [], ice: true };
}

/** Ember's lava-rock tunnel: a basalt vault with magma glowing in its seams, braziers at its mouths. */
export function lavaTunnelPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('lavaTunnelPiece: no rail');
  const { p } = ctx;
  const list = bays(ctx, rail, 5);
  const os = openSide(ctx, list[Math.floor(list.length / 2)].f.yaw);
  const cols = [shade(p.low, 0.5), shade(p.low, 0.62), shade(p.low, 0.42)];
  const fire = lampColor(true, '#FF7A30');
  const steps: Array<() => BufferGeometry[]> = [];
  for (let i0 = 0; i0 < list.length; i0 += 4) {
    steps.push(() => {
      seed(ctx.seed + 451 + i0);
      const parts: BufferGeometry[] = [];
      list.slice(i0, i0 + 4).forEach((b, j) => {
        vault(b, cols, os, (i0 + j) % 4 === 2, parts);
        // Seams of magma along the vault's underside and down the walls.
        const seam: BufferGeometry[] = [];
        for (let k = 0; k < 3; k++) seam.push(box(0.3, 0.3, 1.6 + rnd() * 2, fire, [(rnd() - 0.5) * 2 * b.hw, 0.35, (rnd() - 0.5) * 2], [0, rnd() - 0.5, 0]));
        parts.push(...b.f.out(pitched(b, seam)));
        // Short glowing cracks down each wall, a zig-zag of three strokes.
        for (const sx of [-1, 1]) {
          const x = sx * (b.X + 0.5);
          const g = b.f.gy(x, 0);
          let y = g + 1 + rnd() * Math.max(1, b.R - g - 6);
          let z = (rnd() - 0.5) * 3;
          for (let k = 0; k < 3; k++) {
            const h = 1.2 + rnd() * 1.2;
            const dz = (k % 2 ? 1 : -1) * (0.5 + rnd() * 0.5);
            parts.push(...b.f.out([seg([x, y, z], [x, y + h, z + dz], 0.13, fire, 4)]));
            y += h;
            z += dz;
          }
        }
      });
      return parts;
    });
  }
  // Braziers at both mouths, on the banks.
  steps.push(() => {
    seed(ctx.seed + 499);
    const parts: BufferGeometry[] = [];
    for (const b of [list[0], list[list.length - 1]]) {
      for (const sx of [-1, 1]) {
        const x = sx * (b.X + 1.4);
        const g = b.f.gy(x, 0);
        parts.push(...b.f.out([
          part(new CylinderGeometry(0.8, 1.0, 3, 6), shade(p.low, 0.45), { pos: [x, g + 1.5, 0] }),
          part(new CylinderGeometry(1.2, 0.7, 0.8, 8), INK, { pos: [x, g + 3.4, 0] }),
          part(new ConeGeometry(1.0, 2.6, 7), lampColor(true, '#FFA040'), { pos: [x, g + 5.0, 0], jitter: 0.3 }),
        ]));
      }
    }
    return parts;
  });
  return { steps, spots: [], ice: false };
}

/** Sakura's corridor of torii: a gate every 4.2 m down the stretch, wine lacquer on black bases, the
 *  kasagi black over them, paper lanterns hung between the beams of every third gate. */
export function toriiRowPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('toriiRowPiece: no rail');
  const { night } = ctx;
  const list = bays(ctx, rail, 4.2);
  const lac = new Color('#93405A');
  const lacD = new Color('#6A2A40');
  const black = new Color('#24202E');
  const steps: Array<() => BufferGeometry[]> = [];
  for (let i0 = 0; i0 < list.length; i0 += 6) {
    steps.push(() => {
      seed(ctx.seed + 501 + i0);
      const parts: BufferGeometry[] = [];
      list.slice(i0, i0 + 6).forEach((b, j) => {
        const i = i0 + j;
        const X = b.X + 1.25;
        const top = b.R + 3.0;
        for (const sx of [-1, 1]) {
          const x = sx * X;
          const g = b.f.gy(x, 0);
          parts.push(...b.f.out([
            grade(part(new CylinderGeometry(0.7, 0.8, top - g + 1.5, 8), i % 2 ? lac : lacD, { pos: [x, (top + g - 1.5) / 2, 0] }), g, top, 0.7, 1.05),
            part(new CylinderGeometry(1.0, 1.1, 1.2, 8), black, { pos: [x, g + 0.3, 0] }),
          ]));
        }
        const beam: BufferGeometry[] = [];
        const W = 2 * X + 2.4;
        beam.push(grade(box(W - 1.2, 0.9, 0.7, lac, [0, 0.45, 0]), 0, 0.9, 0.85, 1.05));
        const n = 8;
        for (let k = 0; k < n; k++) {
          const x0 = -W / 2 - 1 + ((W + 2) * k) / n;
          const x1 = -W / 2 - 1 + ((W + 2) * (k + 1)) / n;
          const lift = (x: number) => 1.2 * Math.pow(Math.abs(x) / (W / 2 + 1), 2.6);
          beam.push(seg([x0, 3.0 + lift(x0), 0], [x1, 3.0 + lift(x1), 0], 0.55, lac, 4));
          beam.push(seg([x0, 3.75 + lift(x0), 0], [x1, 3.75 + lift(x1), 0], 0.6, black, 4));
          beam.push(seg([x0, 4.3 + lift(x0), 0], [x1, 4.3 + lift(x1), 0], 0.3, SNOW, 4));
        }
        beam.push(box(0.6, 2.0, 0.5, lacD, [0, 1.95, 0]));
        if (i % 3 === 0) for (const x of [-0.45, 0, 0.45]) lantern(beam, x * b.hw, 1.75, 0.6, 0.42, true, '#FFB45E');
        // (Gates are thin frames: built level, each standing plumb at its own underside.)
        for (const g of beam) g.translate(0, b.R, 0);
        parts.push(...b.f.out(beam));
        // A stone lantern on the bank by every fourth gate.
        if (i % 4 === 2) {
          for (const sx of [-1, 1]) {
            const x = sx * (X + 2.2);
            const g = b.f.gy(x, 0);
            parts.push(...b.f.out(place(streetLamp(townStyle('blossom', ctx.p), 'blossom', night, g, stone(ctx.p, 0.85)), x, 0, 0, 0)));
          }
        }
      });
      return parts;
    });
  }
  return { steps, spots: [], ice: false };
}
