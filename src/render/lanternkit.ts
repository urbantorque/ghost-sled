import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import { SNOW, merge, part, reseed, shade, softPart } from './flora';
import { type Kind, type Piece, type SiteCtx, type Spot, type V3, Sub, box, crag, drift, grade, rnd, seed, seg, stone } from './landmarkKit';
import type { Palette } from './palette';
import { lanternString, type Town } from './town';

// Lanternfall's own shapes (round 7, ART.md 15): the country the spirit lights come from. Everything here
// is original: lamp towers (a narrow stone base under tall storeys of paper and timber that glow from
// inside), standing stone lamps, arched stone bridges strung with lights, bell frames, the lamplighters'
// houses (each roof ends in a small lit lantern), standing stones in place of ice, and bare silver trees.
// Nothing copies, or closely evokes, an existing game, film or festival: no swept eaves, no gate of two
// posts and a lintel, no pagoda's stacked roofs. A tower here is a lantern, squared and stacked.
//
// The colour roles (ART.md 1) hold: what stands is ink (the hazards darkest of all), the snow lilac and
// silver, and marigold is this world's own light. No part here is mint or vermillion.

const C = (h: string) => new Color(h);

/** Lit paper: a warm marigold-cream pushed past 1, so a storey of it blooms on Medium and High and is the
 *  brightest flat value in the frame on Low. */
export function paper(k = 1): Color {
  return C('#FFD070').multiplyScalar(1.6 * k);
}
/** Paper with no light behind it (the great lantern before the line, a shuttered storey). */
export const PAPER_DARK = '#5A4E84';
/** The lamplighters' timber: a plum-black, and the lighter face of a planed beam. */
export const LAMP_TIMBER = '#2A2140';
export const LAMP_TIMBER_LIT = '#4A3A60';
/** Roof slate, a step bluer than the timber. */
export const LAMP_SLATE = '#24244E';
/** Bronze for bells and finials, dark so it never reads as marigold. */
export const LAMP_BRONZE = '#6A5238';
/** Silver bark. */
export const SILVER = '#B6B2D6';

/** A square column that tapers: w0 across at its foot, w1 at its head. */
function tbox(w0: number, w1: number, h: number, col: Color, pos: V3): BufferGeometry {
  const g = new CylinderGeometry(w1 * Math.SQRT1_2, w0 * Math.SQRT1_2, h, 4);
  g.rotateY(Math.PI / 4);
  return part(g, col, { pos: [pos[0], pos[1] + h / 2, pos[2]] });
}

/** A four-sided roof on a w by d base at y, `rise` tall, with snow lying on its upper faces. */
function hipRoof(w: number, d: number, rise: number, y: number, col: Color, pos: V3 = [0, 0, 0], snow = true): BufferGeometry[] {
  const pyr = () => new ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
  const out = [part(pyr(), col, { pos: [pos[0], y + rise / 2, pos[2]], scale: [w, rise, d] })];
  if (snow) out.push(part(pyr(), SNOW, { pos: [pos[0], y + rise * 0.6, pos[2]], scale: [w * 0.74, rise * 0.82, d * 0.74], jitter: 0.05 }));
  return out;
}

/** One storey of a lamp tower: a box of lit paper (brightest low, where its flame stands) in a timber
 *  frame, under a flat eave that carries snow. Its floor is at y0, its middle at (x, z). */
function lanternStorey(parts: BufferGeometry[], x: number, y0: number, z: number, w: number, h: number, fine: boolean, lit = 1): void {
  const timber = C(LAMP_TIMBER);
  const pap = lit > 0 ? paper(lit) : C(PAPER_DARK);
  parts.push(grade(box(w - 0.36, h, w - 0.36, pap, [x, y0 + h / 2, z]), y0, y0 + h, lit > 0 ? 1.12 : 0.9, lit > 0 ? 0.62 : 1.05, 0.03));
  const q = w / 2 - 0.12;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.3, h, 0.3, timber, [x + sx * q, y0 + h / 2, z + sz * q]));
  parts.push(box(w + 0.16, 0.28, w + 0.16, timber, [x, y0 + 0.02, z]));
  if (fine) {
    // Mullions: two uprights and a rail on each face, the lattice a lantern's paper is stretched on.
    for (const [ax, az] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const fx = x + ax * (w / 2 - 0.16);
      const fz = z + az * (w / 2 - 0.16);
      for (const u of [-1, 1]) parts.push(box(ax ? 0.1 : 0.12, h, ax ? 0.12 : 0.1, timber, [fx + (ax ? 0 : (u * w) / 6), y0 + h / 2, fz + (ax ? (u * w) / 6 : 0)]));
      parts.push(box(ax ? 0.1 : w - 0.4, 0.12, ax ? w - 0.4 : 0.1, timber, [fx, y0 + h * 0.62, fz]));
    }
  }
  // The eave: a thin dark board wider than the storey, snow on it.
  parts.push(box(w + 1.5, 0.2, w + 1.5, C(LAMP_SLATE), [x, y0 + h + 0.1, z]));
  parts.push(box(w + 1.2, 0.24, w + 1.2, SNOW, [x, y0 + h + 0.3, z]));
}

/** A whole lamp tower in its own frame, its foot at `base`: a narrow battered stone base with two string
 *  courses, `n` lantern storeys each a little slimmer than the one under it, a steep cap and a finial that
 *  carries one more small light. Returns the height of its tip. */
export function lampTower(parts: BufferGeometry[], p: Palette, x: number, base: number, z: number, o: { w: number; stem: number; n: number; storey: number; fine: boolean; foot?: number }): number {
  const st = stone(p, 0.95);
  const stD = stone(p, 0.7);
  const foot = o.foot ?? base;
  const sw = o.w * 0.78;
  parts.push(grade(tbox(sw + 0.9, sw, base + o.stem - foot + 1, st, [x, foot - 1, z]), foot - 1, base + o.stem, 0.66, 1.02, 0.08));
  for (const k of [0.38, 0.86]) {
    const y = base + o.stem * k;
    const wk = sw + 0.9 * (1 - k) + 0.3;
    parts.push(box(wk, 0.4, wk, stD, [x, y, z]));
    parts.push(box(wk + 0.06, 0.16, wk + 0.06, SNOW, [x, y + 0.28, z]));
  }
  // A door of light at its foot, toward the run.
  parts.push(box(1.1, 2.3, 0.14, paper(0.9), [x, base + 1.3, z + (sw + 0.9) / 2 - 0.02]));
  let y = base + o.stem;
  let w = o.w;
  for (let k = 0; k < o.n; k++) {
    lanternStorey(parts, x, y, z, w, o.storey, o.fine);
    y += o.storey + 0.42;
    w *= 0.86;
  }
  parts.push(...hipRoof(w + 1.4, w + 1.4, w * 1.25, y, C(LAMP_SLATE), [x, 0, z]));
  const tip = y + w * 1.25;
  parts.push(seg([x, tip - 0.4, z], [x, tip + 2.4, z], 0.1, C(LAMP_BRONZE), 5));
  parts.push(part(new IcosahedronGeometry(0.42, 0), paper(1.25), { pos: [x, tip + 2.7, z] }));
  return tip + 3.1;
}

// ---------------------------------------------------------------- the run's own hazards

/** A stone lamp in the run (the sim's `lantern` obstacle, 1.4 m of collider): a dark stone shaft, an open
 *  fire box of four posts and a low roof with snow on it. It carries no light of its own: its flame is
 *  drawn over it by lanternworld.ts, lit or waiting to be kindled, so the stone itself stays a hazard's
 *  dark silhouette. */
export function stoneLampGeometry(): BufferGeometry {
  const st = C('#3A3558');
  const dk = C('#262240');
  const parts: BufferGeometry[] = [box(0.86, 0.2, 0.86, dk, [0, 0.1, 0]), tbox(0.42, 0.3, 0.62, st, [0, 0.2, 0]), box(0.74, 0.12, 0.74, dk, [0, 0.88, 0])];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.1, 0.4, 0.1, dk, [sx * 0.28, 1.14, sz * 0.28]));
  parts.push(...hipRoof(0.92, 0.92, 0.3, 1.34, dk));
  return merge(parts);
}

/** A way lamp on the bank (lanternworld.ts stands them the length of the mountain): the stone lamp's taller
 *  kin, a slim shaft on a stepped foot with its fire box at the height of a rider's head. Its flame box's
 *  floor is at WAY_LAMP_FLAME. */
export const WAY_LAMP_FLAME = 2.34;
export function wayLampGeometry(): BufferGeometry {
  const st = C('#3E3960');
  const dk = C('#27223F');
  const parts: BufferGeometry[] = [box(1.1, 0.24, 1.1, dk, [0, 0.02, 0]), box(0.8, 0.22, 0.8, st, [0, 0.24, 0]), tbox(0.46, 0.3, 1.66, st, [0, 0.34, 0]), box(0.82, 0.14, 0.82, dk, [0, 2.07, 0])];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.1, 0.52, 0.1, dk, [sx * 0.31, 2.4, sz * 0.31]));
  parts.push(...hipRoof(1.06, 1.06, 0.42, 2.66, dk));
  parts.push(part(new IcosahedronGeometry(0.5, 0), SNOW, { pos: [0, 0.1, 0.2], scale: [1.5, 0.4, 1.3], jitter: 0.1 }));
  return merge(parts);
}

/** A standing stone (the sim's `spire` on Lanternfall, modelled 5 m tall inside a 0.95 m radius like the
 *  ice spire it stands in for): a tall dressed menhir leaning a little, a carved band two thirds up, snow
 *  on its head, and a smaller stone fallen against its foot. */
export function standingStoneGeometry(p: Palette): BufferGeometry {
  reseed(4606);
  const a = shade(p.low, 1.15);
  const b = p.lowLit.clone().lerp(p.low, 0.35);
  const main = new CylinderGeometry(0.38, 0.72, 4.9, 5, 3);
  return merge([
    grade(part(main, a, { pos: [0, 2.45, 0], rot: [0.03, 0.4, -0.04], jitter: 0.22 }), 0, 5, 0.8, 1.15, 0.12),
    part(new CylinderGeometry(0.53, 0.57, 0.24, 5), b, { pos: [0.02, 3.2, 0.02], rot: [0.03, 0.4, -0.04] }),
    // Two more courses cut round it, each a ledge that holds a line of snow: at the lens a stone this size
    // was one flat value from foot to head, and read as a box.
    part(new CylinderGeometry(0.66, 0.7, 0.2, 5, 1, true), shade(a, 0.72), { pos: [0.0, 1.45, 0.0], rot: [0.03, 0.4, -0.04] }),
    part(new CylinderGeometry(0.6, 0.68, 0.09, 5, 1, true), SNOW, { pos: [0.0, 1.6, 0.0], rot: [0.03, 0.4, -0.04] }),
    part(new CylinderGeometry(0.47, 0.5, 0.18, 5, 1, true), shade(a, 0.72), { pos: [0.02, 4.05, 0.02], rot: [0.03, 0.4, -0.04] }),
    part(new CylinderGeometry(0.42, 0.49, 0.08, 5, 1, true), SNOW, { pos: [0.02, 4.18, 0.02], rot: [0.03, 0.4, -0.04] }),
    part(new CylinderGeometry(0.2, 0.42, 1.7, 4), shade(a, 0.85), { pos: [0.4, 0.55, 0.22], rot: [0.2, 0.9, -0.42], jitter: 0.08 }),
    part(new IcosahedronGeometry(0.42, 0), SNOW, { pos: [0, 4.86, 0], scale: [1, 0.36, 1], jitter: 0.08 }),
    part(new IcosahedronGeometry(0.8, 0), SNOW, { pos: [0.1, 0.02, 0.1], scale: [1.15, 0.22, 1.1], jitter: 0.1 }),
  ]);
}

/** A row of three standing stones on one footing (the sim's `basalt` on Lanternfall: 1 m of radius, 5 m
 *  tall): the tallest in the middle, each cut off on its own slant. */
export function stoneRowGeometry(p: Palette, low = false): BufferGeometry {
  reseed(4607);
  const a = shade(p.low, 1.1);
  const b = shade(p.low, 0.85);
  const parts: BufferGeometry[] = [];
  const stones: Array<[number, number, number, number, Color]> = [
    [0, 0, 0.5, 5, a],
    [0.52, 0.34, 0.34, 3.4, b],
    [-0.5, -0.3, 0.36, 2.6, b],
  ];
  for (const [x, z, r, h, col] of stones) {
    parts.push(grade(part(new CylinderGeometry(r * 0.62, r, h, 5, low ? 1 : 2), col, { pos: [x, h / 2, z], rot: [0, x * 2.1 + 0.3, 0], jitter: 0.12 }), 0, 5, 0.82, 1.12, 0.1));
    parts.push(part(new IcosahedronGeometry(r * 0.7, 0), SNOW, { pos: [x, h - 0.02, z], scale: [1, 0.34, 1], jitter: 0.06 }));
    if (!low) {
      // A course cut round each, and the snow that lies on it.
      const ry = r * (1 - 0.38 * 0.58);
      parts.push(part(new CylinderGeometry(ry + 0.05, ry + 0.08, 0.2, 5, 1, true), shade(col, 0.7), { pos: [x, h * 0.58, z], rot: [0, x * 2.1 + 0.3, 0] }));
      parts.push(part(new CylinderGeometry(ry, ry + 0.07, 0.08, 5, 1, true), SNOW, { pos: [x, h * 0.58 + 0.14, z], rot: [0, x * 2.1 + 0.3, 0] }));
    }
  }
  parts.push(part(new IcosahedronGeometry(0.9, 0), SNOW, { pos: [0, 0.02, 0], scale: [1.1, 0.2, 1.05], jitter: 0.1 }));
  return merge(parts);
}

/** A marker stone (the sim's `iceblock` on Lanternfall, 1 m of radius): a squat dressed block with a
 *  rounded head and a groove cut round it, half drifted over. */
export function markerStoneGeometry(p: Palette): BufferGeometry {
  reseed(4608);
  const a = shade(p.low, 1.05);
  return merge([
    grade(part(new CylinderGeometry(0.62, 0.82, 0.9, 6, 1), a, { pos: [0, 0.45, 0], rot: [0, 0.5, 0], jitter: 0.1 }), 0, 1, 0.82, 1.1, 0.1),
    part(new CylinderGeometry(0.66, 0.7, 0.1, 6), p.lowLit.clone().lerp(p.low, 0.4), { pos: [0, 0.62, 0], rot: [0, 0.5, 0] }),
    part(new IcosahedronGeometry(0.6, 0), SNOW, { pos: [0.05, 0.9, 0.04], scale: [1.05, 0.34, 1], jitter: 0.08 }),
    part(new IcosahedronGeometry(0.62, 0), SNOW, { pos: [-0.5, 0.1, 0.32], scale: [1.1, 0.3, 0.9], jitter: 0.08 }),
  ]);
}

// ---------------------------------------------------------------- the forest

/** A limb from a to b: four sides, no caps (a forest holds two thousand trees). */
function limb(a: V3, b: V3, r0: number, r1: number, col: Color, sides = 4): BufferGeometry {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(r1, r0, len, sides, 1, true);
  g.translate(0, len / 2, 0);
  // Lean the limb from straight up onto its own line.
  g.rotateZ(-Math.atan2(Math.hypot(dx, dz), dy));
  g.rotateY(-Math.atan2(dz, dx));
  g.translate(a[0], a[1], a[2]);
  return part(g, col);
}

/** A bare silver tree: a pale trunk forking twice, wind-leant, snow in its crooks. The value anchor of the
 *  lamp grove is its ink conifers; this is the light shape among them. `hung` hangs three small lit
 *  lanterns in it (the lamp grove's own tree). */
export function silverTreeGeometry(variant = 0, hung = false): BufferGeometry {
  reseed(4701 + variant * 17);
  const bark = C(SILVER);
  const dark = C('#7A76A4');
  const parts: BufferGeometry[] = [];
  const top: V3 = [0.25, 3.0 + rnd() * 0.5, 0.1];
  parts.push(limb([0, -0.4, 0], top, 0.24, 0.15, dark));
  const tips: V3[] = [];
  const forks = 3;
  for (let k = 0; k < forks; k++) {
    const a = (k / forks) * 6.283 + rnd() * 0.8 + variant;
    const reach = 1.2 + rnd() * 0.7;
    const mid: V3 = [top[0] + Math.cos(a) * reach, top[1] + 1.4 + rnd() * 0.7, top[2] + Math.sin(a) * reach];
    parts.push(limb(top, mid, 0.14, 0.08, bark));
    for (let j = 0; j < 2; j++) {
      const a2 = a + (j === 0 ? -0.7 : 0.6) + (rnd() - 0.5) * 0.4;
      const tip: V3 = [mid[0] + Math.cos(a2) * (0.8 + rnd() * 0.5), mid[1] + 1.1 + rnd() * 0.9, mid[2] + Math.sin(a2) * (0.8 + rnd() * 0.5)];
      parts.push(limb(mid, tip, 0.075, 0.025, bark, 3));
      tips.push(tip);
    }
    parts.push(part(new CylinderGeometry(0, 0.36, 0.2, 4, 1, true), SNOW, { pos: [mid[0], mid[1] + 0.12, mid[2]] }));
  }
  if (hung) {
    for (let k = 0; k < 3; k++) {
      const t = tips[(k * 2 + variant) % tips.length];
      const y = t[1] - 1.1 - k * 0.25;
      parts.push(limb([t[0], y + 0.2, t[2]], [t[0], t[1] - 0.2, t[2]], 0.012, 0.012, C(LAMP_TIMBER)));
      parts.push(part(new CylinderGeometry(0.17, 0.14, 0.34, 5), paper(1.15), { pos: [t[0], y, t[2]] }));
    }
  }
  return merge(parts);
}

// ---------------------------------------------------------------- the kit's pieces

function bankFrame(ctx: SiteCtx, off: number, zOff = 0, turn = 0.55): Sub {
  const s = ctx.side;
  return new Sub(ctx, s * (ctx.post + off), zOff, -s * turn);
}

/** A lamp tower on the bank: the mountain's signature. A narrow stone base on a rock footing, four storeys
 *  of lit paper and timber, a steep cap. Seen from far up the run as a stack of lights. */
function lampTowerPiece(ctx: SiteCtx): Piece {
  const { p } = ctx;
  const f = bankFrame(ctx, 20, 0, 0.5);
  const [lo, hi] = f.range(5, 5);
  const base = hi + 0.6;
  const steps: Array<() => BufferGeometry[]> = [];
  steps.push(() => {
    seed(ctx.seed + 811);
    const parts: BufferGeometry[] = [];
    // Its footing: three beds of the mountain's stone, stepped, snow on each.
    for (let k = 0; k < 3; k++) {
      const w = 9.5 - k * 1.7;
      parts.push(grade(part(new CylinderGeometry(w * 0.62, w * 0.7, base - lo + 1 - k * 0.5, 6, 1), shade(p.low, 0.95 + k * 0.12), { pos: [0, (base + lo - 1) / 2 - k * 0.25 + k * 0.5, 0], rot: [0, k * 0.5, 0], jitter: 0.5 }), lo - 1, base, 0.75, 1.05, 0.12));
    }
    parts.push(drift([0, base - 0.1, 0], [4.6, 0.5, 4.4]));
    return parts;
  });
  steps.push(() => {
    seed(ctx.seed + 812);
    const parts: BufferGeometry[] = [];
    lampTower(parts, p, 0, base, 0, { w: 5, stem: 8.5, n: ctx.low ? 3 : 4, storey: 4.4, fine: !ctx.low, foot: lo });
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false, glows: [{ x: f.x, z: f.z + 4, r: 10 }] };
}

/** A great standing lamp on the bank: one dressed monolith three storeys tall, a niche cut through its
 *  head with a fire in it, a ring of small stones at its foot. */
function greatLampPiece(ctx: SiteCtx): Piece {
  const { p } = ctx;
  const f = bankFrame(ctx, 17, 0, 0.5);
  const [lo, hi] = f.range(4, 4);
  const steps: Array<() => BufferGeometry[]> = [];
  steps.push(() => {
    seed(ctx.seed + 821);
    const parts: BufferGeometry[] = [];
    const st = stone(p, 0.9);
    const H = 13;
    parts.push(grade(part(new CylinderGeometry(1.5, 2.5, H + hi - lo + 1, 5, 4), st, { pos: [0, (hi + lo - 1 + H) / 2, 0], rot: [0, 0.3, 0], jitter: 0.5 }), lo - 1, hi + H, 0.68, 1.06, 0.12));
    // The niche: a dark cut with a fire in it, toward the run, and the lintel stone over it.
    parts.push(box(1.7, 2.3, 3.4, C('#16132C'), [0, hi + H - 2.6, 0]));
    parts.push(part(new ConeGeometry(0.62, 1.5, 6), paper(1.5), { pos: [0, hi + H - 3.0, 0], jitter: 0.2 }));
    parts.push(part(new IcosahedronGeometry(1.5, 0), SNOW, { pos: [0, hi + H + 0.1, 0], scale: [1, 0.35, 1], jitter: 0.12 }));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.283 + 0.3;
      const h = 0.9 + rnd() * 1.1;
      parts.push(crag(shade(p.low, 0.9 + rnd() * 0.25), [Math.cos(a) * 4.6, f.gy(Math.cos(a) * 4.6, Math.sin(a) * 4.6) + h * 0.4, Math.sin(a) * 4.6], [0.6, h, 0.55], 0.25));
    }
    parts.push(drift([0, hi + 0.1, 0], [3.4, 0.5, 3.2]));
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false, glows: [{ x: f.x, z: f.z + 3, r: 8 }] };
}

/** A bell frame across the run: a timber trestle on each bank, a doubled beam high overhead with five
 *  bells hung along it (the greatest in the middle), a plank roof over the beam, and strings of lights
 *  from the trestles' heads to the bank. Nothing hangs under `clear`. */
function bellFramePiece(ctx: SiteCtx): Piece {
  const { clear: H, low } = ctx;
  const X = ctx.post + 2.8;
  const beamY = H + 4.3;
  const timber = C(LAMP_TIMBER);
  const lit = C(LAMP_TIMBER_LIT);
  const steps: Array<() => BufferGeometry[]> = [];
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 831 + s);
      const parts: BufferGeometry[] = [];
      const cx = s * X;
      // The trestle: four raked legs on stone shoes, two collars, and a lantern storey as its head.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const fx = cx + sx * 2.1;
          const fz = sz * 1.9;
          const g = ctx.gy(fx, fz);
          parts.push(grade(seg([fx, g - 0.6, fz], [cx + sx * 0.75, beamY + 0.4, sz * 0.7], 0.3, timber), g, beamY, 0.8, 1.1));
          parts.push(box(1.0, 0.7, 1.0, stone(ctx.p, 0.8), [fx, g + 0.2, fz]));
        }
      }
      for (const k of [0.36, 0.7]) {
        const y = ctx.gy(cx, 0) + (beamY - ctx.gy(cx, 0)) * k;
        const w = 4.4 - 2.9 * k;
        parts.push(box(w, 0.26, w * 0.9, lit, [cx, y, 0]));
        parts.push(box(w + 0.1, 0.14, w * 0.9 + 0.1, SNOW, [cx, y + 0.2, 0]));
      }
      lanternStorey(parts, cx, beamY + 0.9, 0, 2.6, 2.6, !low);
      parts.push(...hipRoof(3.6, 3.6, 2.6, beamY + 3.95, C(LAMP_SLATE), [cx, 0, 0]));
      // A string of lights down to the bank, away from the run.
      if (!low) parts.push(...lanternString([cx + s * 1.4, beamY + 0.6, 0.3], [cx + s * 13, ctx.gy(cx + s * 13, 0.3) + 3.2, 0.3], 1.4, true, '#FFC46A'));
      parts.push(seg([cx + s * 13, ctx.gy(cx + s * 13, 0.3) - 0.3, 0.3], [cx + s * 13, ctx.gy(cx + s * 13, 0.3) + 3.4, 0.3], 0.12, timber, 5));
      return parts;
    });
  }
  steps.push(() => {
    seed(ctx.seed + 833);
    const parts: BufferGeometry[] = [];
    const L = 2 * X;
    for (const z of [-0.5, 0.5]) parts.push(grade(box(L + 2, 0.7, 0.5, lit, [0, beamY, z]), beamY - 0.3, beamY + 0.3, 0.8, 1.08));
    // The plank roof over the beam, and snow on it.
    parts.push(box(L + 3, 0.16, 2.6, C(LAMP_SLATE), [0, beamY + 0.8, 0]));
    parts.push(softPart(new CylinderGeometry(0.5, 0.5, L + 2.6, 8, 1), SNOW, { pos: [0, beamY + 1.05, 0], rot: [0, 0, Math.PI / 2], scale: [0.5, 1, 2.3] }));
    // Five bells, each on its own yoke, the mouth of the greatest a hand over the clear line.
    const bronze = C(LAMP_BRONZE);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const u = i - (n - 1) / 2;
      const x = (u * Math.min(L * 0.62, 30)) / (n - 1);
      const r = 1.25 - Math.abs(u) * 0.24;
      const h = r * 1.5;
      const top = beamY - 0.5;
      parts.push(seg([x, top, 0], [x, top - 0.5, 0], 0.09, C(LAMP_TIMBER), 4));
      const bell = new CylinderGeometry(r * 0.46, r, h, low ? 6 : 9, 2);
      parts.push(grade(part(bell, bronze, { pos: [x, top - 0.5 - h / 2, 0] }), top - 0.5 - h, top - 0.5, 1.15, 0.8, 0.04));
      // A lit rim: the lamplight catches the lip of each bell.
      parts.push(part(new CylinderGeometry(r * 1.03, r * 1.03, 0.1, low ? 6 : 9), paper(0.55), { pos: [x, top - 0.5 - h + 0.05, 0] }));
    }
    return parts;
  });
  return { steps, spots: [], ice: false };
}

/** An arched stone footbridge high over the run, strung with lights: a pier on each bank, one segmental
 *  arch between them, a deck that humps a little over it, lamp posts along the parapet and lamplighters
 *  on the deck. The arch's soffit keeps over `clear`. */
function lightBridgePiece(ctx: SiteCtx): Piece {
  const { p, clear: H, low } = ctx;
  const X = ctx.post + 3.2;
  const rise = 3.4;
  const st = stone(p, 0.92);
  const stD = stone(p, 0.7);
  const spots: Spot[] = [];
  // The soffit: springs at H + 0.3 on the piers, `rise` higher at the crown.
  const soffit = (x: number) => H + 0.3 + rise * (1 - (x / X) * (x / X));
  const deck = (x: number) => soffit(Math.max(-X, Math.min(X, x))) + 1.25 - Math.max(0, Math.abs(x) - X) * 0.12;
  const steps: Array<() => BufferGeometry[]> = [];
  steps.push(() => {
    seed(ctx.seed + 841);
    const parts: BufferGeometry[] = [];
    const n = low ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const x0 = -X + (2 * X * i) / n;
      const x1 = -X + (2 * X * (i + 1)) / n;
      const y0 = soffit(x0);
      const y1 = soffit(x1);
      const len = Math.hypot(x1 - x0, y1 - y0);
      const a = Math.atan2(y1 - y0, x1 - x0);
      // The arch ring (voussoirs, alternately dark), and the wall over it up to the deck.
      parts.push(box(len + 0.06, 0.9, 3.6, i % 2 ? stD : st, [(x0 + x1) / 2 - Math.sin(a) * 0.45, (y0 + y1) / 2 + Math.cos(a) * 0.45, 0], [0, 0, a]));
      const top = Math.max(deck(x0), deck(x1));
      const bot = Math.min(y0, y1) + 0.8;
      if (top - bot > 0.2) parts.push(box(x1 - x0 + 0.04, top - bot, 3.2, st, [(x0 + x1) / 2, (top + bot) / 2, 0]));
      parts.push(box(x1 - x0 + 0.06, 0.3, 4.4, stD, [(x0 + x1) / 2, top + 0.15, 0]));
      parts.push(box(x1 - x0 + 0.06, 0.2, 3.5, SNOW, [(x0 + x1) / 2, top + 0.36, 0]));
    }
    return parts;
  });
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 843 + s);
      const parts: BufferGeometry[] = [];
      const cx = s * (X + 1.6);
      const g = Math.min(ctx.gy(cx, -2), ctx.gy(cx, 2), ctx.gy(cx + s * 2, 0));
      // The pier, battered, and the approach wall stepping down the bank to the snow.
      parts.push(grade(tbox(5.4, 4.2, deck(cx) - g + 1.5, st, [cx, g - 1.5, 0]), g - 1, deck(cx), 0.66, 1.03, 0.1));
      parts.push(box(4.6, 0.34, 4.6, stD, [cx, soffit(s * X) - 0.2, 0]));
      for (let k = 1; k <= 5; k++) {
        const x = cx + s * k * 3.4;
        const gk = ctx.gy(x, 0);
        const top = deck(x);
        if (top - gk < 0.6) break;
        parts.push(grade(box(3.5, top - gk + 1, 3.3, k % 2 ? stD : st, [x, (top + gk - 1) / 2, 0]), gk - 1, top, 0.68, 1.02, 0.08));
        parts.push(box(3.5, 0.2, 3.5, SNOW, [x, top + 0.36, 0]));
      }
      return parts;
    });
  }
  steps.push(() => {
    seed(ctx.seed + 846);
    const parts: BufferGeometry[] = [];
    // Lamp posts along both parapets, a light on each, and a string of lights slung from post to post.
    const n = low ? 5 : 9;
    for (const z of [-1.95, 1.95]) {
      let prev: V3 | null = null;
      for (let i = 0; i < n; i++) {
        const x = -X - 1.2 + ((2 * X + 2.4) * i) / (n - 1);
        const y = deck(x) + 0.4;
        parts.push(seg([x, y - 0.3, z], [x, y + 2.3, z], 0.09, C(LAMP_TIMBER), 4));
        parts.push(box(0.5, 0.56, 0.5, paper(1.1), [x, y + 2.5, z]));
        parts.push(...hipRoof(0.74, 0.74, 0.3, y + 2.78, C(LAMP_SLATE), [x, 0, z], false));
        const head: V3 = [x, y + 2.2, z];
        if (prev && !low && z > 0) parts.push(...lanternString(prev, head, 0.5, true, '#FFC46A'));
        prev = head;
        if (i > 0 && i < n - 1) parts.push(box(((2 * X + 2.4) / (n - 1)) * 0.96, 0.14, 0.14, C(LAMP_TIMBER_LIT), [x - (2 * X + 2.4) / (n - 1) / 2, y + 0.75, z]));
      }
    }
    return parts;
  });
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * (X / 4.2);
    spots.push({ x, y: deck(x) + 0.46, z: 1.1, yaw: 0, flag: i % 3 === 0 });
  }
  return { steps, spots, ice: false, glows: [{ x: -X - 3, z: 2, r: 7 }, { x: X + 3, z: 2, r: 7 }] };
}

/** Lanternfall's piece for a kit kind, or null where the mountain uses the kit's own. */
export function lanternPiece(kind: Kind, ctx: SiteCtx): Piece | null {
  switch (kind) {
    case 'tower':
    case 'pagoda':
    case 'dome':
      return lampTowerPiece(ctx);
    case 'guardian':
    case 'hut':
    case 'falls':
    case 'jump':
      return greatLampPiece(ctx);
    case 'gate':
    case 'torii':
    case 'basalt':
      return bellFramePiece(ctx);
    case 'bridge':
    case 'arch':
      return lightBridgePiece(ctx);
    default:
      return null;
  }
}

// ---------------------------------------------------------------- the town

/** What town.ts hands a house builder (its HouseOpts, by shape). */
export interface LanternHouseOpts {
  w: number;
  d: number;
  storeys: number;
  shop: boolean;
  balconies: boolean;
  s: number;
  jet?: number;
  eave?: number;
  room?: number;
  back?: boolean;
  low?: boolean;
  sunk?: boolean;
}

const STOREY = 3.3;

/** A lamplighter's house, in town.ts's house frame (front at +z, floor at F): a ground floor of stone with
 *  a door of light, timber storeys over it whose bays are panes of lit paper, a steep four-sided roof deep
 *  in snow, and on the roof's point a small lantern of its own. A street of them is a street of lanterns. */
export function lanternHouse(t: Town, F: number, lo: number, o: LanternHouseOpts, stoneC: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const { w, d, storeys, s } = o;
  const jet = o.jet ?? 0;
  const eave = Math.min(1.2, o.eave ?? 1.2);
  const plain = !!o.back || !!o.low;
  const upper = t.upper[Math.floor(rnd() * t.upper.length)];
  const lower = t.lower[Math.floor(rnd() * t.lower.length)];
  const top = F + storeys * STOREY;
  const zr = (storeys - 1) * jet;
  parts.push(grade(box(w + 0.4, F - lo + 1.5, d + 0.2, stoneC, [0, (F + lo - 1.5) / 2, 0]), lo - 1.5, F, 0.68, 0.95));
  if (!o.sunk) parts.push(box(w + 1.4, 0.22, d + 1.4, SNOW, [0, F + 0.02, 0]));
  // Which storeys are lit: the ground floor's door always; of the others, about three in four.
  for (let k = 0; k < storeys; k++) {
    const y0 = F + k * STOREY;
    const out = k * jet;
    const zf = d / 2 + out;
    const col = k === 0 ? lower : upper;
    parts.push(grade(box(w, STOREY, d + out, col, [0, y0 + STOREY / 2, out / 2]), y0, y0 + STOREY, 0.84, 1.04));
    if (k > 0) parts.push(box(w + 0.18, 0.24, d + out + 0.18, t.trim, [0, y0, out / 2]));
    const lit = k === 0 || rnd() < 0.78;
    const pap = lit ? paper(k === 0 ? 0.95 : 0.8 + rnd() * 0.3) : C(PAPER_DARK);
    if (k === 0) {
      // The door, and a shop's long window of paper beside it.
      parts.push(box(1.4, 2.4, 0.14, t.trim, [o.shop ? -w * 0.3 : 0, F + 1.2, zf + 0.04]));
      parts.push(box(1.0, 2.0, 0.16, pap, [o.shop ? -w * 0.3 : 0, F + 1.15, zf + 0.07]));
      if (o.shop) {
        parts.push(box(w * 0.46 + 0.3, 1.9, 0.12, t.trim, [w * 0.16, F + 1.7, zf + 0.04]));
        parts.push(grade(box(w * 0.46, 1.6, 0.14, pap, [w * 0.16, F + 1.7, zf + 0.07]), F + 0.9, F + 2.5, 1.15, 0.55, 0.03));
        if (!plain) for (let i = 1; i < 4; i++) parts.push(box(0.09, 1.6, 0.16, t.trim, [w * 0.16 - w * 0.23 + (i * w * 0.46) / 4, F + 1.7, zf + 0.09]));
      }
      continue;
    }
    // A timber storey: posts at the bays' edges, a pane of paper in each bay, a rail across it.
    const bays = o.low ? 2 : Math.max(2, Math.floor(w / 2.6));
    const bw = w / bays;
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + (i + 0.5) * bw;
      // (A pane is brightest low, where its lamp stands, and a deeper amber under the rail above it: one
      // flat value a pane, a street of them was a wall of orange slabs.)
      parts.push(grade(box(bw - 0.5, STOREY - 1.0, 0.1, pap, [x, y0 + STOREY * 0.52, zf + 0.05]), y0 + 0.6, y0 + STOREY - 0.3, lit ? 1.18 : 1, lit ? 0.5 : 0.8, 0.03));
      if (!plain) parts.push(box(bw - 0.5, 0.09, 0.14, t.trim, [x, y0 + STOREY * 0.66, zf + 0.07]));
    }
    if (!plain && !o.sunk) {
      const m = Math.max(1, Math.floor(d / 3.4));
      for (let i = 0; i < m; i++) parts.push(grade(box(0.1, STOREY - 1.0, d / m - 0.6, pap, [s * (w / 2 + 0.05), y0 + STOREY * 0.52, -d / 2 + ((i + 0.5) * d) / m]), y0 + 0.6, y0 + STOREY - 0.3, lit ? 1.18 : 1, lit ? 0.5 : 0.8, 0.03));
    }
  }
  // The roof, and the lantern on its point.
  const rise = Math.min(w, d + zr) * 0.62 + 1.2;
  parts.push(...hipRoof(w + 2 * eave, d + zr + 2 * eave, rise, top, t.roof, [0, 0, zr / 2]));
  parts.push(box(w + 2 * eave + 0.1, 0.26, d + zr + 2 * eave + 0.1, t.trim, [0, top + 0.05, zr / 2]));
  if (!o.back) {
    parts.push(box(0.8, 0.9, 0.8, paper(1.2), [0, top + rise + 0.25, zr / 2]));
    parts.push(...hipRoof(1.2, 1.2, 0.6, top + rise + 0.7, t.trim, [0, 0, zr / 2], false));
  }
  return parts;
}

/** The town's own landmark, in town.ts's landmark frame (a 21 by 15 m plinth at F): the lamp hall, a great
 *  lamp tower of five storeys with a low stone hall at its foot. */
export function lanternLandmark(p: Palette, F: number, lo: number, low: boolean, scale = 1): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const st = stone(p, 0.95);
  parts.push(grade(box(21, F - lo + 1.5, 15, st, [0, (F + lo - 1.5) / 2, 0]), lo - 1.5, F, 0.68, 0.95));
  parts.push(box(21.2, 0.22, 15.2, SNOW, [0, F + 0.02, 0]));
  // The hall: stone, a row of paper windows, a low hipped roof.
  parts.push(grade(box(11, 5, 10, stone(p, 0.85), [5, F + 2.5, -1]), F, F + 5, 0.8, 1.02));
  for (let i = 0; i < 3; i++) parts.push(box(1.7, 2.4, 0.16, paper(0.9), [2 + i * 3, F + 2.6, 4.06]));
  parts.push(...hipRoof(12.6, 11.6, 4.2, F + 5, C(LAMP_SLATE), [5, 0, -1]));
  const tip = lampTower(parts, p, -4.6, F, 0.5, { w: 7.2 * scale, stem: 9 * scale, n: low ? 4 : 5, storey: 5 * scale, fine: !low });
  parts.push(drift([-4.6, tip - 3.2, 0.5], [0.5, 0.2, 0.5]));
  return parts;
}

/** A street's lamp, in town.ts's lamp frame (foot at gy, head toward +z): a standing stone lamp, lit. */
export function lanternStreetLamp(gy: number, stoneC: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const dk = shade(stoneC, 0.62);
  parts.push(box(1.0, 0.4, 1.0, dk, [0, gy + 0.2, 0]));
  parts.push(tbox(0.5, 0.34, 2.0, shade(stoneC, 0.8), [0, gy + 0.4, 0]));
  parts.push(box(0.9, 0.16, 0.9, dk, [0, gy + 2.48, 0]));
  parts.push(box(0.56, 0.62, 0.56, paper(1.2), [0, gy + 2.87, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.1, 0.62, 0.1, dk, [sx * 0.31, gy + 2.87, sz * 0.31]));
  parts.push(...hipRoof(1.1, 1.1, 0.46, gy + 3.18, dk));
  parts.push(drift([0, gy, 0], [0.5, 0.2, 0.5]));
  return parts;
}

/** The crown of a finish tower: a lantern storey and a steep cap, in the tower's own frame. */
export function lanternCrown(x: number, top: number, low: boolean): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  lanternStorey(parts, x, top + 0.2, 0, 4, 3.6, !low);
  parts.push(...hipRoof(5.4, 5.4, 4.6, top + 4.3, C(LAMP_SLATE), [x, 0, 0]));
  parts.push(part(new SphereGeometry(0.45, 8, 6), paper(1.3), { pos: [x, top + 9.4, 0] }));
  return parts;
}

/** A lamp tower standing alone (the finish town's tall mark, the far villages' own): parts in a frame
 *  whose origin is its foot. */
export function lampTowerParts(p: Palette, base: number, w: number, n: number, low: boolean): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  lampTower(parts, p, 0, base, 0, { w, stem: w * 1.5, n, storey: w * 0.8, fine: !low });
  return parts;
}

