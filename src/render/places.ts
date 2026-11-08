import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { BiomeId } from '../sim/mountains';
import { crowdColors } from './crowd';
import { SNOW, part, shade } from './flora';
import { LINE_Z, liftLayout } from './liftline';
import { CREAM, Glow, INK, Piece, Rail, ROPE, SiteCtx, Spot, Sub, TIMBER, TIMBER_DARK, TIMBER_LIGHT, V3, banners, box, bunting, crag, drift, grade, lampColor, latticeTower, pagodaParts, place, quad, ribbon, rnd, seed, seg, stone, windowColor } from './landmarkKit';
import { AIR_MARGIN, barrier, frontAt, house, kerbAt, landmark, lantern, streetPiece, townStyle } from './town';

// The places the course's own sections ask for, each read from the rider's lens at 30 m/s:
//  - a bridge (viaduct): the corridor is a ridge of ground 34 m over a chasm, so the piece is what makes
//    it a bridge: rails where the sim turns a sled back, a structure rising past them on both sides, and
//    raked legs and piers that carry the eye down into the fall. Nothing can stand under the deck: the
//    ground is there. Everything hugs the ridge from outside, and the rider never sees its core.
//  - the finish town: the street runs into a square of grandstands cut into both banks, under a real arch
//    over the line, past the biggest buildings the mountain has, and the run-out carries on through it
//    to a hall that closes the view. A sled stops about 35 to 60 m past the line (sim.ts coast), so
//    the square is built round that spot, for a held shot.
//  - the start: the first frame is an occasion. A gate high over the ramp, grandstands packed down both
//    banks, the huts behind them, barriers and flags.
//  - a leap's watching crowd, on rock shoulders either side of the lip.
//  - a lift line crossing overhead (liftline.ts), and its station close beside the run.

const C = (h: string) => new Color(h);

// ---------------------------------------------------------------- lettering

/** A 5 by 7 dot font, the few letters the boards use. */
const FONT: Record<string, readonly string[]> = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
};

/** Letters in merged dots on a board in the x-y plane, facing +z, centred on x and sitting at y. */
function letters(text: string, y: number, z: number, dot: number, col: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const adv = 6 * dot;
  const x0 = -((text.length * adv - dot) / 2);
  for (let i = 0; i < text.length; i++) {
    const g = FONT[text[i]];
    if (!g) continue;
    for (let r = 0; r < 7; r++) {
      // Runs of dots as one box.
      for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '1') continue;
        let e = c;
        while (e + 1 < 5 && g[r][e + 1] === '1') e++;
        parts.push(box((e - c + 1) * dot, dot, 0.12, col, [x0 + i * adv + ((c + e + 1) / 2) * dot, y + (6.5 - r) * dot, z]));
        c = e;
      }
    }
  }
  return parts;
}

/** Hundreds of still spectators in one geometry: a coat and a head, two boxes each, the far rows of a
 *  stand. They cost no draw and no shader, and from the near rows' distance read as a packed crowd. */
function stillCrowd(list: ReadonlyArray<{ x: number; y: number; z: number; coat: Color; hat: Color }>): BufferGeometry {
  // The faces a stand's figure ever shows, wound outward: toward the run on either bank, the top and the
  // side up the slope. (A corner's signs on x, y and z.)
  const FACES: ReadonlyArray<readonly [V3, V3, V3, V3, V3]> = [
    [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
    [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  ];
  const n = list.length * 2 * FACES.length * 6;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  const skin = C('#F2C9A8');
  const put = (x: number, y: number, z: number, hw: number, hh: number, hd: number, c: Color, cap: Color) => {
    for (const [nv, a, b, d, e] of FACES) {
      for (const v of [a, b, d, a, d, e]) {
        pos[o] = x + v[0] * hw;
        pos[o + 1] = y + v[1] * hh;
        pos[o + 2] = z + v[2] * hd;
        nor[o] = nv[0];
        nor[o + 1] = nv[1];
        nor[o + 2] = nv[2];
        const k = v[1] > 0 ? cap : c;
        col[o] = k.r;
        col[o + 1] = k.g;
        col[o + 2] = k.b;
        o += 3;
      }
    }
  };
  for (const f of list) {
    put(f.x, f.y + 0.42, f.z, 0.23, 0.42, 0.17, f.coat, f.coat);
    put(f.x, f.y + 1.02, f.z, 0.17, 0.17, 0.17, skin, f.hat);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** A long thin pennant streaming off a mast top toward s. */
function pennant(pos: V3, s: number, col: Color, len = 3.4): BufferGeometry {
  const pen = new ConeGeometry(0.55, len, 3);
  pen.rotateZ((s * Math.PI) / 2);
  pen.scale(1, 1, 0.12);
  return part(pen, col, { pos: [pos[0] + (s * len) / 2, pos[1], pos[2]] });
}

// ---------------------------------------------------------------- the bridge

interface SpanStyle {
  post: Color;
  rail: Color;
  beam: Color;
  dark: Color;
  /** What rises past the rails: an arch of ribs, or a girder at this height. */
  arch: boolean;
  rise: number;
  ice: boolean;
}

function spanStyle(biome: BiomeId, ctx: SiteCtx): SpanStyle {
  const { p } = ctx;
  switch (biome) {
    case 'glacier':
      return { post: C('#BFEAFF'), rail: C('#E4F6FF'), beam: C('#7FC4E6'), dark: C('#5E9FD0'), arch: true, rise: 14, ice: true };
    case 'volcanic':
      return { post: C('#3E3440'), rail: C('#4A3E4A'), beam: C('#3A3040'), dark: shade(p.low, 0.42), arch: false, rise: 7, ice: false };
    case 'blossom':
      return { post: C('#93405A'), rail: C('#6A2A40'), beam: C('#93405A'), dark: C('#3A2A36'), arch: true, rise: 11, ice: false };
    case 'alpine':
      return { post: TIMBER_DARK, rail: TIMBER_LIGHT, beam: TIMBER, dark: TIMBER_DARK, arch: false, rise: 4, ice: false };
  }
}

/** The bridge at a `bridge` section: rails where the sim turns a sled back, drawn on past the section's
 *  body as its banks fall away; what rises past them (Frostfang's ice arch, Ember's iron truss, Sakura's
 *  lacquered arch, Pinecrest's timber truss); the portal towers on the rims; and the raked legs, piers
 *  and bracing that reach down round the ground's ridge. Ember's chasm runs with lava. */
export function viaductPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('viaductPiece: no rail');
  const { biome } = ctx;
  const st = spanStyle(biome, ctx);
  const L = rail.len;
  const cols = banners(ctx.p);
  const steps: Array<() => BufferGeometry[]> = [];
  const lead = 34;
  /** The deck's height at dz. */
  const deck = (dz: number) => rail.at(dz, 0, 0).y;
  const railE = (dz: number) => Math.max(rail.limit(dz - 1.3), rail.limit(dz), rail.limit(dz + 1.3)) + 0.14;
  // The rails and the deck's edge beam, a side to a step.
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 601 + s);
      const parts: BufferGeometry[] = [];
      const SP = 2.4;
      let prev: V3 | null = null;
      const edgeA: V3[] = [];
      const edgeB: V3[] = [];
      for (let dz = -L - lead; dz <= L + lead; dz += SP) {
        const e = railE(dz);
        if (e > 5) {
          prev = null;
          continue;
        }
        const pt = rail.at(dz, s, e);
        const here: V3 = [pt.x, pt.y, pt.z];
        if (st.ice) {
          const out = rail.at(dz, s, e + 0.62);
          parts.push(part(new IcosahedronGeometry(1, 0), rnd() < 0.5 ? st.post : st.rail, { pos: [out.x, pt.y + 0.55, out.z], scale: [0.42, 0.72, 1.25], rot: [0, (rnd() - 0.5) * 0.3, 0], jitter: 0.05 }));
        }
        else parts.push(grade(box(0.2, 1.42, 0.2, st.post, [pt.x, pt.y + 0.62, pt.z]), pt.y, pt.y + 1.3, 0.8, 1.05));
        if (prev) {
          parts.push(seg([prev[0], prev[1] + 1.25, prev[2]], [here[0], here[1] + 1.25, here[2]], 0.09, st.rail, 4));
          parts.push(seg([prev[0], prev[1] + 0.68, prev[2]], [here[0], here[1] + 0.68, here[2]], 0.05, st.rail, 3));
        }
        prev = here;
        if (dz >= -L - 4 && dz <= L + 4) {
          // The deck's edge, seen from the rim and from the air: a beam down the ridge's shoulder.
          const out = rail.at(dz, s, e + 0.7);
          edgeA.push([out.x, pt.y + 0.1, out.z]);
          edgeB.push([out.x, pt.y - 1.5, out.z]);
        }
      }
      parts.push(s > 0 ? ribbon(edgeB, edgeA, st.beam) : ribbon(edgeA, edgeB, st.beam));
      return parts;
    });
  }
  // What rises past the rails.
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 611 + s);
      const parts: BufferGeometry[] = [];
      const e = (dz: number) => Math.max(1.3, railE(dz) + 0.45);
      const at = (dz: number, y: number): V3 => {
        const pt = rail.at(dz, s, e(dz));
        return [pt.x, deck(dz) + y, pt.z];
      };
      if (st.arch) {
        // A rib springing from the rims, over the rails and back, with hangers down to the deck's edge.
        const N = 22;
        const y = (dz: number) => 1.2 + (st.rise - 1.2) * (1 - (dz / L) ** 2);
        for (let i = 0; i < N; i++) {
          const a = -L + (2 * L * i) / N;
          const b = -L + (2 * L * (i + 1)) / N;
          parts.push(seg(at(a, y(a)), at(b, y(b)), 0.5, i % 2 ? st.beam : st.dark, 5));
          if (i % 2 === 0 && i > 0) parts.push(seg(at(a, y(a)), at(a, 0.2), 0.1, st.rail, 4));
          if (biome === 'glacier') {
            // Icicles hung along the rib.
            parts.push(part(new ConeGeometry(0.2, 1 + rnd() * 1.6, 5), st.rail, { pos: at((a + b) / 2, y((a + b) / 2) - 1.2), rot: [Math.PI, 0, 0] }));
          } else if (i % 3 === 1) lantern(parts, ...at(a, y(a) - 1.1), 0.42, true, '#FFB45E');
        }
      } else {
        // A through truss: two chords on posts, the diagonals running each way from the middle.
        const B = 6;
        const n = Math.round((2 * L) / B);
        const h = st.rise;
        for (let i = 0; i <= n; i++) {
          const a = -L + (2 * L * i) / n;
          parts.push(seg(at(a, 0), at(a, h), 0.2, st.beam, 4));
          if (i === n) break;
          const b = -L + (2 * L * (i + 1)) / n;
          parts.push(seg(at(a, h), at(b, h), 0.26, st.beam, 4));
          parts.push(i < n / 2 ? seg(at(a, h), at(b, 0), 0.13, st.rail, 4) : seg(at(a, 0), at(b, h), 0.13, st.rail, 4));
          if (biome === 'volcanic' && i % 3 === 1) lantern(parts, ...at(a + B / 2, h - 1), 0.4, true, '#FF9A50');
        }
      }
      return parts;
    });
  }
  // The portals on the rims.
  for (const end of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 621 + end);
      const parts: BufferGeometry[] = [];
      const dz = end * (L + 2);
      for (const s of [-1, 1]) {
        const w = 2.6;
        const pt = rail.at(dz, s, Math.max(rail.limit(dz + 4), rail.limit(dz - 4)) + 2.6);
        const g = deck(dz);
        const h = st.arch ? 12 : 9.5;
        if (st.ice) {
          // A pier of stacked ice, the fall's own.
          for (let k = 0; k < 4; k++) parts.push(crag(k % 2 ? st.beam : st.dark, [pt.x, g + 1 + k * 2.7, pt.z], [w * 0.8, 1.9, w * 0.8], 0.22));
          parts.push(drift([pt.x, g + 11.4, pt.z], [1.9, 0.6, 1.9]));
        } else {
          parts.push(grade(box(w, h + 8, w, biome === 'volcanic' ? st.dark : st.post, [pt.x, g + (h - 8) / 2, pt.z]), g - 8, g + h, 0.65, 1.05));
          parts.push(box(w + 0.8, 0.5, w + 0.8, st.dark, [pt.x, g + h, pt.z]));
          parts.push(box(w + 0.5, 0.5, w + 0.5, SNOW, [pt.x, g + h + 0.4, pt.z]));
        }
        if (biome === 'volcanic') {
          parts.push(part(new CylinderGeometry(1.1, 0.6, 0.7, 8), INK, { pos: [pt.x, g + h + 0.95, pt.z] }));
          parts.push(part(new ConeGeometry(0.85, 2.2, 7), lampColor(true, '#FFA040'), { pos: [pt.x, g + h + 2.2, pt.z], jitter: 0.25 }));
        } else lantern(parts, pt.x + s * 0.0, g + h - 2.4, pt.z + 1.6, 0.46, true, '#FFB45E');
        const top = g + h + (st.ice ? 2 : 0.6);
        parts.push(seg([pt.x, top, pt.z], [pt.x, top + 5, pt.z], 0.07, INK, 4));
        parts.push(pennant([pt.x, top + 4.4, pt.z], s, cols[0]));
      }
      return parts;
    });
  }
  // Under the deck: raked legs round the ridge, struts between them, and the deep piers on the chasm's
  // floor. The ground holds the middle, so all of this stands on its flanks.
  const bents: number[] = [];
  for (let dz = -L + 4; dz <= L - 2; dz += 11) bents.push(dz);
  for (let i0 = 0; i0 < bents.length && !ctx.low; i0 += 3) {
    steps.push(() => {
      seed(ctx.seed + 631 + i0);
      const parts: BufferGeometry[] = [];
      for (const dz of bents.slice(i0, i0 + 3)) {
        for (const s of [-1, 1]) {
          const g = deck(dz);
          const top = rail.at(dz, s, 1.5);
          const foot = rail.at(dz, s, 13);
          const A: V3 = [top.x, g - 0.8, top.z];
          const B: V3 = [foot.x, foot.y - 1.4, foot.z];
          const mid: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
          parts.push(grade(seg(A, B, st.ice ? 0.6 : 0.42, st.beam, 5), B[1], A[1], 0.62, 1.02));
          // A strut out to the next bent, and a brace across.
          const nx = dz + 11;
          if (nx <= L - 2) {
            const t2 = rail.at(nx, s, 1.5);
            const f2 = rail.at(nx, s, 13);
            const g2 = deck(nx);
            const m2: V3 = [(t2.x + f2.x) / 2, (g2 - 0.8 + f2.y - 1.4) / 2, (t2.z + f2.z) / 2];
            parts.push(seg(mid, m2, st.ice ? 0.3 : 0.22, st.dark, 4));
            parts.push(seg(A, m2, 0.13, st.dark, 4));
            parts.push(seg(mid, [t2.x, g2 - 0.8, t2.z], 0.13, st.dark, 4));
          }
        }
      }
      return parts;
    });
  }
  // Ember's lava: a river crossing under the bridge and running away down the chasm on both sides. Near
  // the deck its own edge hides the floor (from the lens it shows only past about 70 m out), so the river
  // is what carries the glow out to where it can be seen.
  if (biome === 'volcanic') {
    steps.push(() => {
      seed(ctx.seed + 651);
      const parts: BufferGeometry[] = [];
      const fire = lampColor(true, '#FF6A20');
      const hot = lampColor(true, '#FFB050');
      const crust = C('#2A2026');
      const zAt = (e: number, s: number) => s * 6 + Math.sin(e * 0.05 + s) * 14 + (e / 140) * s * 26;
      for (const s of [-1, 1]) {
        const banks: V3[][] = [[], [], [], []];
        for (let e = 10; e <= 150; e += 12) {
          const dz = zAt(e, s);
          const half = 6 + e * 0.05;
          [-half - 4, -half, half, half + 4].forEach((o, k) => {
            const q = rail.at(dz + o, s, e);
            banks[k].push([q.x, q.y + (k === 0 || k === 3 ? 0.12 : 0.5), q.z]);
          });
        }
        const flow = s > 0 ? [banks[1], banks[2]] : [banks[2], banks[1]];
        parts.push(ribbon(flow[0], flow[1], fire));
        parts.push(s > 0 ? ribbon(banks[0], banks[1], crust) : ribbon(banks[1], banks[0], crust));
        parts.push(s > 0 ? ribbon(banks[2], banks[3], crust) : ribbon(banks[3], banks[2], crust));
        // Hot veins down the middle.
        const mid = banks[1].map((v, i): V3 => [(v[0] + banks[2][i][0]) / 2, v[1] + 0.1, (v[2] + banks[2][i][2]) / 2]);
        const side = banks[1].map((v, i): V3 => [v[0] * 0.4 + banks[2][i][0] * 0.6, v[1] + 0.1, v[2] * 0.4 + banks[2][i][2] * 0.6]);
        parts.push(s > 0 ? ribbon(mid, side, hot) : ribbon(side, mid, hot));
      }
      return parts;
    });
  }
  return { steps, spots: [], ice: st.ice, glows: [] };
}

// ---------------------------------------------------------------- the finish town

/** The checker painted across the line: its rows, a check's width and its length down the run (long, as
 *  road paint is: the lens sees the snow at a couple of degrees, and that foreshortens it square), the
 *  cells a check's side is cut into and how far the paint lies over the snow. */
export const LINE_ROWS = 4;
const LINE_CHECK = 3;
export const LINE_DEPTH = 4.5;
const LINE_CELLS = 3;
export const LINE_LIFT = 0.14;

/** A hot-air balloon tethered over the town, visible from the last leap: where the run is going. */
function balloon(x: number, y: number, z: number, g: number, cols: Color[]): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const R = 7;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const q = new SphereGeometry(R, 2, 8, a, (Math.PI * 2) / n);
    parts.push(part(q, i % 2 ? CREAM : cols[(i >> 1) % 2 ? 2 : 0], { pos: [x, y, z], scale: [1, 1.16, 1] }));
  }
  parts.push(part(new ConeGeometry(R * 0.62, 5, 8), cols[0], { pos: [x, y - R * 1.16, z], rot: [Math.PI, 0, 0] }));
  parts.push(box(1.6, 1.1, 1.6, TIMBER, [x, y - R * 1.16 - 4, z]));
  parts.push(seg([x, y - R * 1.16 - 4.6, z], [x, g, z], 0.05, ROPE, 3));
  return parts;
}

/** The biggest things a mountain has, in the frame of a building facing +z with its floor at F: the great
 *  hall that closes the run-out. */
function greatHall(biome: BiomeId, t: ReturnType<typeof townStyle>, night: boolean, F: number, lo: number, ctx: SiteCtx): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const glass = night ? lampColor(true, '#FFC27A') : C('#2A2D48');
  const W = 46;
  const D = 16;
  const H = 15;
  const wall = biome === 'alpine' ? C('#ECE4D6') : biome === 'glacier' ? C('#B5523E') : biome === 'volcanic' ? shade(ctx.p.low, 0.62) : C('#EDE4D8');
  parts.push(grade(box(W + 3, F - lo + 2, D + 3, stone(ctx.p, 0.8), [0, (F + lo - 2) / 2, 0]), lo - 2, F, 0.7, 0.95));
  parts.push(grade(box(W, H, D, wall, [0, F + H / 2, 0]), F, F + H, 0.82, 1.03));
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 11; i++) {
      if (k === 0 && Math.abs(i - 5) < 1) continue;
      parts.push(box(2.4, 3.6, 0.2, glass, [-20 + i * 4, F + 3.4 + k * 6.4, D / 2 + 0.05]));
      parts.push(box(2.9, 0.26, 0.5, biome === 'blossom' ? C('#93405A') : SNOW, [-20 + i * 4, F + 1.45 + k * 6.4, D / 2 + 0.2]));
    }
  }
  parts.push(box(6.5, 6.5, 0.3, t.trim, [0, F + 3.25, D / 2 + 0.05]));
  parts.push(box(5.5, 5.5, 0.34, night ? lampColor(true, '#FFC27A') : C('#3A3650'), [0, F + 3, D / 2 + 0.08]));
  // Its roof, and the tower or dome over the middle that marks the town from the last leap.
  if (biome === 'blossom') {
    parts.push(...place(sweptRoofAt(W + 8, t), 0, F + H + 0.4, 0, 0).map((g) => g.scale(1, 1, 0.5)));
  } else {
    parts.push(box(W + 3, 0.9, D + 3, t.roof, [0, F + H + 0.3, 0]));
    parts.push(box(W + 3.6, 1.1, D + 3.6, SNOW, [0, F + H + 1.1, 0]));
  }
  const cols = banners(ctx.p);
  for (const x of [-16, -8, 8, 16]) parts.push(box(2.2, 11, 0.12, cols[(x + 16) % 3 ? 0 : 2], [x, F + H - 6.4, D / 2 + 0.24]));
  return parts;
}

function sweptRoofAt(w: number, t: ReturnType<typeof townStyle>): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  parts.push(box(w, 0.8, w, t.roof, [0, 0, 0]));
  parts.push(part(new ConeGeometry(w * 0.72, w * 0.16, 4, 1), t.roof, { pos: [0, w * 0.08, 0], rot: [0, Math.PI / 4, 0] }));
  parts.push(part(new ConeGeometry(w * 0.66, w * 0.13, 4, 1), SNOW, { pos: [0, w * 0.1, 0], rot: [0, Math.PI / 4, 0], jitter: 0.06 }));
  return parts;
}

/** The arch over the line: two great towers past the barriers, a board across at the height the air
 *  allows, a checker over and under it, the word, banners down the towers, and the mountain's own
 *  crown on each tower. */
function finishArch(ctx: SiteCtx, rail: Rail, F: number): BufferGeometry[] {
  const { biome, night, p } = ctx;
  const c = rail.at(F, 0, 0);
  const f = new Sub(ctx, c.x, c.z, c.yaw);
  const t = townStyle(biome, p);
  const cols = banners(p);
  const X = c.hw + kerbAt(rail, F) + 1.9;
  const H = Math.max(rail.air(F - 6, F + 6) + AIR_MARGIN, rail.floor(F) + 10);
  const B = 6;
  const top = H + B + 2.2;
  const blossom = biome === 'blossom';
  const towerC = blossom ? C('#93405A') : biome === 'volcanic' ? shade(p.low, 0.55) : biome === 'glacier' ? C('#B5523E') : TIMBER;
  const parts: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const x = s * X;
    const g = f.gy(x, 0);
    parts.push(grade(box(3.4, top - g + 2, 3.4, towerC, [x, (top + g - 2) / 2, 0]), g, top, 0.68, 1.05));
    parts.push(box(4, 2.4, 4, stone(p, 0.8), [x, g + 0.8, 0]));
    // Banners down its face to the run.
    for (const u of [-0.9, 0.9]) {
      parts.push(box(1.3, top - g - 3.4, 0.08, cols[u < 0 ? 0 : 2], [x + u, (top + g) / 2 + 0.6, 1.76]));
      parts.push(box(1.3, 0.34, 0.1, CREAM, [x + u, g + 2.1, 1.77]));
    }
    lantern(parts, x, H - 1.4, 2.4, 0.55, night || t.lampAlways, t.lamp);
    // The crown.
    if (biome === 'alpine') {
      parts.push(part(new ConeGeometry(3.4, 5.4, 4), t.roof, { pos: [x, top + 2.7, 0], rot: [0, Math.PI / 4, 0] }));
      parts.push(part(new ConeGeometry(2.7, 3.4, 4), SNOW, { pos: [x, top + 2.2, 0], rot: [0, Math.PI / 4, 0], jitter: 0.06 }));
    } else if (biome === 'glacier') {
      parts.push(box(4, 0.6, 4, C('#EEF4FA'), [x, top + 0.3, 0]));
      parts.push(seg([x, top + 0.6, 0], [x, top + 7, 0], 0.12, C('#C8CCD8'), 5));
      parts.push(part(new SphereGeometry(0.45, 8, 6), lampColor(true, '#FF7060'), { pos: [x, top + 7.2, 0] }));
    } else if (biome === 'volcanic') {
      parts.push(part(new CylinderGeometry(2.1, 1.2, 1.3, 8), INK, { pos: [x, top + 0.6, 0] }));
      parts.push(part(new ConeGeometry(1.7, 4.4, 7), lampColor(true, '#FFA040'), { pos: [x, top + 3.3, 0], jitter: 0.3 }));
    } else {
      parts.push(...place(sweptRoofAt(5.6, t), x, top + 0.3, 0, 0));
    }
  }
  // The board.
  const W = 2 * X + 3.4;
  parts.push(box(W, B, 1.5, CREAM, [0, H + B / 2, 0]));
  parts.push(box(W + 0.3, 0.5, 1.8, towerC, [0, H + 0.1, 0]));
  parts.push(box(W + 0.3, 0.5, 1.8, towerC, [0, H + B + 0.05, 0]));
  if (blossom) {
    // The kasagi: a black beam curving up to its ends.
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x0 = -W / 2 - 2 + ((W + 4) * i) / n;
      const x1 = -W / 2 - 2 + ((W + 4) * (i + 1)) / n;
      const lift = (x: number) => 1.8 * Math.pow(Math.abs(x) / (W / 2 + 2), 2.6);
      parts.push(seg([x0, H + B + 1.1 + lift(x0), 0], [x1, H + B + 1.1 + lift(x1), 0], 0.8, C('#24202E'), 4));
      parts.push(seg([x0, H + B + 1.8 + lift(x0), 0], [x1, H + B + 1.8 + lift(x1), 0], 0.36, SNOW, 4));
    }
  } else parts.push(box(W + 0.6, 0.5, 2, SNOW, [0, H + B + 0.55, 0]));
  // Checkers along its foot and head, on the face the rider comes to and on the back.
  const n = Math.round(W / 0.9);
  for (const z of [0.78, -0.78]) {
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (i + 0.5) * (W / n);
      parts.push(box(W / n, 0.72, 0.06, (i & 1) === 0 ? INK : CREAM, [x, H + 0.74, z]));
      parts.push(box(W / n, 0.72, 0.06, (i & 1) === 1 ? INK : CREAM, [x, H + B - 0.54, z]));
    }
  }
  parts.push(...letters('FINISH', H + 1.42, 0.86, 0.46, INK));
  for (const u of [-1, 1]) parts.push(...bunting([u * X, top - 0.8, 2], [u * 1.2, H + B + 0.6, 2], 1.1, cols, 1.0));
  return f.out(parts);
}

/** The line's paint: rows of big checks in both colours, barrier to barrier, so it never leans on the
 *  snow to read and stays a checker from the lens at speed: three rows a metre deep were a broken dashed
 *  line from 30 m. Each check is a few cells, so it lies on the ground up the banks, a hand over the
 *  snow, where no tier's coarser terrain comes up through it. */
function finishLine(f: Sub, hw: number): BufferGeometry[] {
  const n = Math.round((2 * hw) / LINE_CHECK);
  const w = (2 * hw) / n;
  const y = (u: number, v: number) => f.gy(u, v) + LINE_LIFT;
  const line: BufferGeometry[] = [];
  for (let r = 0; r < LINE_ROWS; r++) {
    for (let i = 0; i < n; i++) {
      const col = (i + r) & 1 ? CREAM : INK;
      for (let a = 0; a < LINE_CELLS; a++) {
        const u0 = -hw + (i + a / LINE_CELLS) * w;
        const u1 = -hw + (i + (a + 1) / LINE_CELLS) * w;
        for (let b = 0; b < LINE_CELLS; b++) {
          const v0 = (r - LINE_ROWS / 2 + b / LINE_CELLS) * LINE_DEPTH;
          const v1 = (r - LINE_ROWS / 2 + (b + 1) / LINE_CELLS) * LINE_DEPTH;
          line.push(quad([u0, y(u0, v0), v0], [u0, y(u0, v1), v1], [u1, y(u1, v1), v1], [u1, y(u1, v0), v0], col));
        }
      }
    }
  }
  return line;
}

/** A grandstand down one bank from dz a to b: rows of seats stepping up the bank, a near crowd that
 *  moves and far rows that stand still, masts and banners along its back. On a bank that gives it no
 *  height of its own (the start's stands, behind the crest) each row stands `rise` metres over the last. */
function stand(ctx: SiteCtx, rail: Rail, s: number, a: number, b: number, rows: number, spots: Spot[], still: Array<{ x: number; y: number; z: number; coat: Color; hat: Color }>, glows: Glow[], rise = 0): { seats: BufferGeometry[]; masts: Array<{ pos: V3; dz: number }> } {
  const { p, biome } = ctx;
  const { coats, hats } = crowdColors(biome, p);
  const seats: BufferGeometry[] = [];
  const wood = biome === 'blossom' ? C('#5A2F42') : biome === 'volcanic' ? shade(p.low, 0.7) : biome === 'glacier' ? C('#7A8098') : TIMBER_LIGHT;
  const riser = shade(wood, 0.72);
  const STEP = 7;
  const RUN = 0.95;
  const yAt = (dz: number, r: number): number => {
    const e = kerbAt(rail, dz) + 0.6 + r * RUN;
    return Math.max(rail.at(dz, s, e).y, rail.at(dz, s, e + RUN).y) + 0.2 + r * rise;
  };
  for (let r = 0; r < rows; r++) {
    const inner: V3[] = [];
    const outer: V3[] = [];
    const foot: V3[] = [];
    for (let dz = a; dz <= b + 0.01; dz += STEP) {
      const e = kerbAt(rail, dz) + 0.6 + r * RUN;
      const y = yAt(dz, r);
      const i = rail.at(dz, s, e);
      const o = rail.at(dz, s, e + RUN);
      inner.push([i.x, y, i.z]);
      outer.push([o.x, y, o.z]);
      foot.push([i.x, r > 0 ? yAt(dz, r - 1) : i.y - 0.2, i.z]);
    }
    // The tread, up; and the riser, facing the run.
    seats.push(s > 0 ? ribbon(inner, outer, r % 2 ? wood : shade(wood, 0.9)) : ribbon(outer, inner, r % 2 ? wood : shade(wood, 0.9)));
    seats.push(s > 0 ? ribbon(foot, inner, riser) : ribbon(inner, foot, riser));
  }
  const masts: Array<{ pos: V3; dz: number }> = [];
  for (let dz = a + 4; dz < b - 2; dz += 13) {
    const e = kerbAt(rail, dz) + 0.6 + rows * RUN + 0.5;
    const pt = rail.at(dz, s, e);
    masts.push({ pos: [pt.x, Math.max(pt.y, yAt(dz, rows - 1)), pt.z], dz });
  }
  // The crowd: the two nearest rows move (crowd.ts), the rest are baked in.
  const low = !!ctx.low;
  for (let r = 0; r < rows; r++) {
    for (let dz = a + 0.6 + (r & 1) * 0.45; dz < b - 0.5; dz += r < 2 ? 1.05 : low ? 2.4 : 0.92) {
      if (rnd() < 0.08) continue;
      const jz = dz + (rnd() - 0.5) * 0.3;
      const e = kerbAt(rail, jz) + 0.6 + r * RUN + 0.45;
      const pt = rail.at(jz, s, e);
      const y = yAt(jz, r);
      if (r < 2 && !low) spots.push({ x: pt.x, y, z: pt.z, yaw: pt.yaw + s * 0.5 + (rnd() - 0.5) * 0.5, flag: rnd() < 0.34 });
      else still.push({ x: pt.x, y, z: pt.z, coat: coats[Math.floor(rnd() * coats.length)], hat: hats[Math.floor(rnd() * hats.length)] });
    }
  }
  for (let dz = a + 6; dz < b; dz += 18) {
    const pt = rail.at(dz, s, kerbAt(rail, dz) + 1.2);
    glows.push({ x: pt.x, z: pt.z, r: 3.6 });
  }
  return { seats, masts };
}

/** The masts along a stand's back on side s: long banners, a pennant each, and strings between them. */
function standMasts(ctx: SiteCtx, masts: ReadonlyArray<{ pos: V3; dz: number }>, s: number): BufferGeometry[] {
  const cols = banners(ctx.p);
  const parts: BufferGeometry[] = [];
  for (const { pos, dz } of masts) {
    const top = pos[1] + 13 + (Math.round(dz) & 3);
    parts.push(grade(seg([pos[0], pos[1] - 1, pos[2]], [pos[0], top, pos[2]], 0.15, ctx.biome === 'blossom' ? C('#93405A') : TIMBER_DARK, 5), pos[1], top, 0.8, 1.05));
    parts.push(box(1.5, 7.5, 0.08, cols[(Math.round(dz / 13) & 1) * 2], [pos[0], top - 4.6, pos[2] + 1]));
    parts.push(box(1.5, 0.3, 0.1, CREAM, [pos[0], top - 8.3, pos[2] + 1]));
    parts.push(pennant([pos[0], top, pos[2]], s, cols[0]));
  }
  for (let i = 0; i + 1 < masts.length; i++) {
    const a = masts[i].pos;
    const b = masts[i + 1].pos;
    parts.push(...bunting([a[0], a[1] + 12, a[2]], [b[0], b[1] + 12, b[2]], 1.4, cols, 1.0));
  }
  return parts;
}

/** The finish town (see the file's head). The street comes in down the blend, the square holds the line
 *  and the spot sleds stop on, and the run-out street ends at the great hall. */
export function finishPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('finishPiece: no rail');
  const { p, biome, night } = ctx;
  const F = ctx.line ?? 0;
  const last = ctx.lastZ ?? rail.len;
  const t = townStyle(biome, p);
  const cols = banners(p);
  const low = !!ctx.low;
  const sq0 = F - 72;
  const sq1 = F + 118;
  const base = streetPiece(ctx, { runs: [[-rail.len, sq0], [sq1, last - 8]], houses: true, hotel: true, mark: false, gates: true });
  const steps = base.steps;
  const spots = base.spots;
  const glows = base.glows ?? [];
  seed(ctx.seed + 701);
  const still: Array<{ x: number; y: number; z: number; coat: Color; hat: Color }> = [];
  const made = [-1, 1].map((s) => stand(ctx, rail, s, sq0 + 3, sq1 - 3, low ? 4 : 6, spots, still, glows));
  // The stands.
  steps.push(() => made.flatMap((m) => m.seats));
  // The far rows: a few hundred to a step, each a batch of plain arrays.
  for (let i = 0; i < still.length; i += 500) {
    steps.push(() => [stillCrowd(still.slice(i, i + 500))]);
  }
  // Masts, long banners and strings along the backs of the stands.
  steps.push(() => {
    seed(ctx.seed + 711);
    return made.flatMap((m, k) => standMasts(ctx, m.masts, k ? 1 : -1));
  });
  // The streets' barrier, carried through the square.
  steps.push(() => {
    seed(ctx.seed + 713);
    return barrier(rail, sq0, sq1, cols);
  });
  // The arch over the line, and the line.
  steps.push(() => {
    seed(ctx.seed + 721);
    const parts = finishArch(ctx, rail, F);
    const c = rail.at(F, 0, 0);
    const f = new Sub(ctx, c.x, c.z, c.yaw);
    return [...parts, ...f.out(finishLine(f, c.hw + rail.limit(F)))];
  });
  // The square's great buildings, on the crests behind the stands.
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 731 + s);
      const parts: BufferGeometry[] = [];
      const own = s === ctx.side;
      const dz = F + (own ? 46 : 14);
      const e = kerbAt(rail, dz) + 0.6 + 6.6 + (own ? 7.4 : 6);
      const pt = rail.at(dz, s, e + 6);
      const f = new Sub(ctx, pt.x, pt.z, pt.yaw + (own ? s * -0.25 : s * 0.2));
      const [lo, hi] = f.range(11, 8);
      if (own) parts.push(...f.out(landmark(t, biome, night, hi + 0.4, lo, p, s)));
      else {
        const stoneC = biome === 'volcanic' ? shade(p.low, 0.55) : stone(p, 0.85);
        parts.push(...f.out(house(t, biome, night, hi + 0.4, lo, { w: 22, d: 12, storeys: biome === 'glacier' ? 4 : 6, shop: true, balconies: true, s, eave: 1.3, room: 3, low }, stoneC)));
      }
      return parts;
    });
  }
  // The great hall that closes the run-out, and the mountain's tall mark.
  steps.push(() => {
    seed(ctx.seed + 741);
    const dz = last + 26;
    const c = rail.at(dz, 0, 0);
    const f = new Sub(ctx, c.x, c.z, c.yaw);
    const [lo, hi] = f.range(23, 8);
    const parts = f.out(greatHall(biome, t, night, hi + 0.4, lo, ctx));
    // Biggest of all, over the hall: what is seen from the last leap.
    const tall = new Sub(ctx, c.x, c.z - 0, c.yaw);
    const top = hi + 0.4 + 15;
    if (biome === 'blossom') parts.push(...tall.out(place(pagodaParts(night, top, top - 1, p), 0, 0, -1, 0)));
    else if (biome === 'alpine') {
      const white = C('#ECE6EE');
      parts.push(...tall.out([
        grade(box(9, 26, 9, white, [0, top + 13, 0]), top, top + 26, 0.85, 1.03),
        box(10, 0.8, 10, t.trim, [0, top + 26.3, 0]),
        part(new ConeGeometry(6.6, 19, 4), C('#3E3A5C'), { pos: [0, top + 36, 0], rot: [0, Math.PI / 4, 0] }),
        part(new ConeGeometry(4.8, 9, 4), SNOW, { pos: [0, top + 31.5, 0], rot: [0, Math.PI / 4, 0], jitter: 0.06 }),
        part(new CylinderGeometry(2.8, 2.8, 0.3, 18), CREAM, { pos: [0, top + 19, 4.6], rot: [Math.PI / 2, 0, 0] }),
        seg([0, top + 45, 0], [0, top + 50, 0], 0.14, C('#C9A867'), 4),
      ]));
    } else if (biome === 'glacier') {
      parts.push(...tall.out([
        part(new CylinderGeometry(9.5, 10.5, 9, 14), C('#D8E2EE'), { pos: [0, top + 4.5, 0] }),
        part(new SphereGeometry(11.5, 14, 9), C('#EEF4FA'), { pos: [0, top + 13.5, 0] }),
        seg([0, top + 24, 0], [0, top + 46, 0], 0.3, C('#C8CCD8'), 6),
        part(new SphereGeometry(0.8, 8, 6), lampColor(true, '#FF7060'), { pos: [0, top + 46.6, 0] }),
      ]));
    } else {
      parts.push(...tall.out([
        grade(part(new CylinderGeometry(3.6, 5.6, 46, 10), shade(p.low, 0.5), { pos: [0, top + 23, 0] }), top, top + 46, 0.7, 1.0),
        part(new CylinderGeometry(4.2, 4.2, 1.2, 10), INK, { pos: [0, top + 46.4, 0] }),
        part(new ConeGeometry(3.4, 8, 8), lampColor(true, '#FFA040'), { pos: [0, top + 51, 0], jitter: 0.4 }),
      ]));
    }
    return parts;
  });
  // Two balloons tethered over the town.
  if (!low) {
    steps.push(() => {
      seed(ctx.seed + 751);
      const parts: BufferGeometry[] = [];
      for (const [s, dz, h] of [[ctx.side, F + 30, 62], [-ctx.side, F - 40, 74]] as const) {
        const pt = rail.at(dz, s, 34);
        parts.push(...balloon(pt.x, rail.floor(dz) + h, pt.z, pt.y, cols));
      }
      return parts;
    });
  }
  return { steps, spots, ice: false, glows, steam: base.steam };
}

// ---------------------------------------------------------------- the start

/** The start's grandstands (metres from the site's start, either side of the gate), their rows and the
 *  height each row stands over the last. The rows stand past the bank's crest, 10 m out, where flat rows
 *  would show as a line of heads over the barrier. */
const START_STANDS: ReadonlyArray<readonly [number, number]> = [
  [2, 30],
  [38, 114],
];
const START_ROWS = 9;
const START_ROWS_LOW = 5;
const START_RISE = 0.62;
/** Steps the stands' still rows are baked over, 500 figures to a step. */
const START_STILL_STEPS = 4;
/** How far past the street's fronts the huts stand: behind the stands, looking over them. */
const HUT_BACK = 14;

/** A start hut and its banner, facing the ramp from the bank. */
function startHut(ctx: SiteCtx, rail: Rail, s: number, dz: number, w: number): BufferGeometry[] {
  const { p, biome, night } = ctx;
  const t = townStyle(biome, p);
  const cols = banners(p);
  const stoneC = biome === 'volcanic' ? shade(p.low, 0.55) : stone(p, 0.85);
  const pt = rail.at(dz, s, frontAt(rail, dz) + HUT_BACK);
  const f = new Sub(ctx, pt.x, pt.z, pt.yaw + s * 0.45);
  const [lo, hi] = f.range(w / 2 + 0.6, 5.6);
  const F = hi + 0.4;
  const parts = house(t, biome, night, F, lo, { w, d: 9, storeys: 2, shop: true, balconies: true, s, low: ctx.low }, stoneC);
  parts.push(box(w * 0.7, 2.2, 0.2, cols[0], [0, F + 8.2 + w * 0.05, 5.6]));
  parts.push(...letters(s === ctx.side ? 'START' : '', F + 7.4 + w * 0.05, 5.74, 0.28, CREAM));
  return f.out(parts);
}

/** The start: a gate high over the ramp with the word on it, two huts on the banks, and the street's
 *  own barriers, crowd and masts down the whole ramp. */
export function startPiece(ctx: SiteCtx): Piece {
  const rail = ctx.rail;
  if (!rail) throw new Error('startPiece: no rail');
  const { p, biome, night } = ctx;
  const t = townStyle(biome, p);
  const cols = banners(p);
  const low = !!ctx.low;
  const runs = START_STANDS.map(([a, b]) => [-rail.len + a, -rail.len + b] as const);
  const base = streetPiece(ctx, { runs: [[-rail.len + 2, rail.len]], houses: false, hotel: false, mark: false, gates: false, stands: runs, standBack: 6.5 });
  const steps = base.steps;
  /** Sim z of the gate over the ramp, and of the huts, from the site's start. */
  const GATE = 34;
  const HUT = 50;
  // The grandstands: the near rows move, the rest are baked in, so the crowd costs no draw of its own.
  // Worked out in a step of their own, on idle time: a site's plan runs on the frame that asks for it,
  // here a run's first, and 1,800 spots on the ground is 30 ms.
  // (No lamplight: a pool of it at night would be a draw the start has never had.)
  const still: Array<{ x: number; y: number; z: number; coat: Color; hat: Color }> = [];
  let made: Array<{ s: number; seats: BufferGeometry[]; masts: Array<{ pos: V3; dz: number }> }> = [];
  steps.push(() => {
    seed(ctx.seed + 791);
    made = [-1, 1].flatMap((s) => runs.map(([a, b]) => ({ s, ...stand(ctx, rail, s, a, b, low ? START_ROWS_LOW : START_ROWS, base.spots, still, [], START_RISE) })));
    return made.flatMap((m) => m.seats);
  });
  for (let k = 0; k < START_STILL_STEPS; k++) steps.push(() => (still.length > k * 500 ? [stillCrowd(still.slice(k * 500, (k + 1) * 500))] : []));
  steps.push(() => {
    seed(ctx.seed + 793);
    return made.flatMap((m) => standMasts(ctx, m.masts, m.s));
  });
  steps.push(() => {
    seed(ctx.seed + 801);
    const dz = -rail.len + GATE;
    const c = rail.at(dz, 0, 0);
    const f = new Sub(ctx, c.x, c.z, c.yaw);
    const X = c.hw + kerbAt(rail, dz) + 2;
    const H = Math.max(rail.air(dz - 6, dz + 6) + AIR_MARGIN, rail.floor(dz) + 12);
    const post = biome === 'blossom' ? C('#93405A') : biome === 'volcanic' ? shade(p.low, 0.55) : biome === 'glacier' ? C('#B5523E') : TIMBER;
    const B = 3.6;
    const parts: BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const g = f.gy(s * X, 0);
      const top = H + B + 1.4;
      parts.push(grade(box(2.2, top - g + 2, 2.2, post, [s * X, (top + g - 2) / 2, 0]), g, top, 0.7, 1.05));
      parts.push(box(2.8, 0.5, 2.8, SNOW, [s * X, top + 0.2, 0]));
      parts.push(seg([s * X, top, 0], [s * X, top + 6, 0], 0.08, INK, 4));
      parts.push(pennant([s * X, top + 5.4, 0], s, cols[0], 4));
      lantern(parts, s * (X - 1.7), H - 1.2, 0.8, 0.45, night || t.lampAlways, t.lamp);
    }
    const W = 2 * X + 2.2;
    parts.push(box(W, B, 0.9, CREAM, [0, H + B / 2, 0]));
    parts.push(box(W, 0.4, 1.1, post, [0, H + 0.1, 0]));
    parts.push(box(W, 0.4, 1.1, post, [0, H + B, 0]));
    parts.push(box(W + 0.3, 0.32, 1.3, SNOW, [0, H + B + 0.34, 0]));
    parts.push(...letters('START', H + 0.82, 0.52, 0.34, INK));
    return f.out(parts);
  });
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 811 + s);
      return startHut(ctx, rail, s, -rail.len + HUT + (s === ctx.side ? 0 : 16), s === ctx.side ? 13 : 10);
    });
  }
  return { steps, spots: base.spots, ice: false, glows: base.glows, steam: base.steam };
}

// ---------------------------------------------------------------- a leap's crowd

/** Rock shoulders either side of a leap's lip, each a flat-topped outcrop past the keep line with a crowd
 *  along its edge, flags, and a rope along the drop. */
export function lipPiece(ctx: SiteCtx): Piece {
  const { p, biome, post } = ctx;
  const low = !!ctx.low;
  const rock = biome === 'volcanic' ? [shade(p.low, 0.62), shade(p.low, 0.74), shade(p.low, 0.54)] : biome === 'glacier' ? [C('#7C8EB0'), C('#94A8C4'), C('#687AA0')] : [stone(p, 0.95), stone(p, 1.05), stone(p, 0.84)];
  const cols = banners(p);
  const steps: Array<() => BufferGeometry[]> = [];
  const spots: Spot[] = [];
  seed(ctx.seed + 901);
  const tops: Array<{ s: number; y: number; x: number }> = [];
  for (const s of [-1, 1]) {
    const x = s * (post + 11.6);
    let g = -Infinity;
    for (const u of [-6, 0, 6]) for (const v of [-13, 0, 13]) g = Math.max(g, ctx.gy(x + u, v));
    const y = g + 1.9;
    tops.push({ s, y, x });
    for (let r = 0; r < 3; r++) {
      for (let v = -13; v <= 13; v += 1.3) {
        if (rnd() < 0.14 + r * 0.08) continue;
        spots.push({ x: x - s * (5.8 - r * 1.05), y, z: v + (rnd() - 0.5) * 0.4, yaw: Math.atan2(-s, 0.55) + (rnd() - 0.5) * 0.5, flag: rnd() < 0.3 });
      }
    }
  }
  for (const { s, y, x } of tops) {
    steps.push(() => {
      seed(ctx.seed + 903 + s);
      const parts: BufferGeometry[] = [];
      const plinth = new CylinderGeometry(1, 1.16, 1, 8);
      parts.push(grade(part(plinth, rock[0], { pos: [x, y - 3.4, 0], scale: [8.2, 6.8, 17], rot: [0, Math.PI / 8, 0] }), y - 7, y, 0.7, 1.0));
      parts.push(part(new CylinderGeometry(1, 1, 1, 8), SNOW, { pos: [x, y - 0.06, 0], scale: [7.9, 0.16, 16.6], rot: [0, Math.PI / 8, 0] }));
      for (let k = 0; k < (low ? 3 : 8); k++) {
        const v = -15 + rnd() * 30;
        parts.push(crag(rock[k % 3], [x - s * (6.8 + rnd() * 1.4), y - 3 - rnd() * 2, v], [1.8 + rnd(), 2.6, 2.4 + rnd() * 1.6], 0.3));
      }
      // A rope along the edge on stakes, and flags at the shoulder's corners.
      let prev: V3 | null = null;
      for (let v = -15; v <= 15; v += 5) {
        const pt: V3 = [x - s * 6.5, y, v];
        parts.push(seg(pt, [pt[0], y + 1.1, v], 0.05, INK, 3));
        if (prev) parts.push(seg([prev[0], y + 1, prev[2]], [pt[0], y + 1, v], 0.03, ROPE, 3));
        prev = pt;
      }
      for (const v of [-13, 0, 13]) {
        const top = y + 8 + rnd() * 2;
        parts.push(seg([x + s * 3, y - 0.5, v], [x + s * 3, top, v], 0.08, TIMBER_DARK, 4));
        parts.push(pennant([x + s * 3, top - 0.3, v], s, cols[(Math.round(v) & 1) * 2]));
      }
      return parts;
    });
  }
  return { steps, spots, ice: false };
}

// ---------------------------------------------------------------- a lift line and its station

/** A lift crossing the run: the station close beside it, its cable hall at the height the line runs at,
 *  on a tall base where the bank is lower than the air; a tower on the far bank and two more climbing
 *  away from the run; both cables. Pinecrest in timber and steel, Frostfang a red ropeway house, Ember
 *  a basalt mine head, Sakura a lacquered temple cableway. */
export function liftPiece(ctx: SiteCtx): Piece {
  const { p, biome, night } = ctx;
  const s = ctx.side;
  const { C: H, nodes } = liftLayout(ctx.post, ctx.clear, s, ctx.gy);
  const steel = biome === 'volcanic' ? C('#3E3440') : C('#6A7088');
  const steelD = biome === 'volcanic' ? C('#2E2830') : C('#4A5068');
  const wall = biome === 'alpine' ? C('#E4DACA') : biome === 'glacier' ? C('#B5523E') : biome === 'volcanic' ? shade(p.low, 0.6) : C('#EDE4D8');
  const upper = biome === 'alpine' ? TIMBER : biome === 'glacier' ? C('#D8E2EE') : biome === 'volcanic' ? shade(p.low, 0.8) : C('#93405A');
  const roof = biome === 'blossom' ? C('#3E3A50') : C('#3A3448');
  const trim = biome === 'blossom' ? C('#2E2230') : TIMBER_DARK;
  const glass = windowColor(night);
  const cols = banners(p);
  const steps: Array<() => BufferGeometry[]> = [];
  const spots: Spot[] = [];
  const sx = nodes[0][0];
  const hx = sx + s * 5;
  const g0 = Math.min(ctx.gy(hx - 7, -6), ctx.gy(hx + 7, -6), ctx.gy(hx - 7, 6), ctx.gy(hx + 7, 6));
  const g1 = Math.max(ctx.gy(hx - 7, -6), ctx.gy(hx + 7, -6), ctx.gy(hx - 7, 6), ctx.gy(hx + 7, 6));
  seed(ctx.seed + 951);
  // The queue at the foot of the station.
  for (let k = 0; k < 16; k++) {
    const v = 9 + rnd() * 9;
    const x = hx - s * (4 - rnd() * 8);
    spots.push({ x, y: ctx.gy(x, v) - 0.03, z: v, yaw: Math.PI + (rnd() - 0.5) * 1.2, flag: rnd() < 0.2 });
  }
  // The station.
  steps.push(() => {
    seed(ctx.seed + 953);
    const parts: BufferGeometry[] = [];
    const W = 14;
    const D = 13;
    const hall = H - 3.2;
    const y0 = g0 - 2;
    parts.push(grade(box(W + 1, g1 + 0.6 - y0, D + 1, stone(p, 0.8), [hx, (g1 + 0.6 + y0) / 2, 0]), y0, g1 + 0.6, 0.68, 0.95));
    parts.push(grade(box(W, hall - g1, D, wall, [hx, (hall + g1) / 2, 0]), g1, hall, 0.84, 1.02));
    // Rows of windows up the base, toward the run and up the slope.
    for (let y = g1 + 2.6; y < hall - 1.6; y += 3.3) {
      for (let i = 0; i < 4; i++) {
        parts.push(box(1.5, 1.5, 0.14, glass, [hx - W / 2 + (i + 0.5) * (W / 4), y, D / 2 + 0.04]));
        parts.push(box(0.14, 1.5, 1.5, glass, [hx - (s * W) / 2 - s * 0.04, y, -D / 2 + (i + 0.5) * (D / 4)]));
      }
    }
    parts.push(box(W + 0.5, 0.4, D + 0.5, trim, [hx, hall, 0]));
    // The cable hall, open toward the run, its bull wheel showing under a long overhanging roof.
    parts.push(grade(box(W + 2, 6.4, D + 2, upper, [hx + s * 0.6, hall + 3.2, 0]), hall, hall + 6.4, 0.84, 1.02));
    parts.push(box(1.6, 5, D + 2.2, C('#1E2238'), [hx - s * (W / 2 + 0.7), hall + 3.1, 0]));
    const wheel = new TorusGeometry(LINE_Z, 0.26, 6, 18);
    wheel.rotateX(Math.PI / 2);
    parts.push(part(wheel, steelD, { pos: [sx, H, 0] }));
    parts.push(seg([sx, H - 0.1, -LINE_Z], [sx, H - 0.1, LINE_Z], 0.2, steelD, 5));
    parts.push(seg([sx - s * 2.2, H, 0], [hx, H, 0], 0.32, steelD, 5));
    const R = hall + 6.8;
    parts.push(box(W + 7, 0.6, D + 5, roof, [hx - s * 1.5, R, 0]));
    parts.push(part(new CylinderGeometry(1, 1, 1, 4), SNOW, { pos: [hx - s * 1.5, R + 0.6, 0], rot: [0, Math.PI / 4, 0], scale: [(W + 7) * 0.72, 0.9, (D + 5) * 0.72], jitter: 0.1 }));
    parts.push(seg([hx, R, -3], [hx, R + 8, -3], 0.09, INK, 4));
    parts.push(pennant([hx, R + 7.4, -3], s, cols[0], 4));
    // The name board and a banner down its face.
    parts.push(box(W * 0.8, 1.8, 0.2, CREAM, [hx, hall + 1.6, D / 2 + 1.1]));
    parts.push(box(W * 0.8, 0.34, 0.24, cols[0], [hx, hall + 2.3, D / 2 + 1.12]));
    parts.push(box(2.4, Math.max(3, hall - g1 - 2), 0.1, cols[2], [hx - s * 4.6, (hall + g1) / 2, D / 2 + 0.1]));
    return parts;
  });
  // The far towers and the cables.
  steps.push(() => {
    seed(ctx.seed + 955);
    const parts: BufferGeometry[] = [];
    for (let i = 1; i < nodes.length; i++) {
      const [x, y] = nodes[i];
      parts.push(...latticeTower(ctx, x, 0, 3.4, y - 0.6, biome === 'alpine' ? TIMBER : steel, biome === 'alpine' ? TIMBER_DARK : steelD));
      parts.push(box(2.2, 0.5, 2 * LINE_Z + 1.6, steelD, [x, y - 0.6, 0]));
      for (const v of [-LINE_Z, LINE_Z]) parts.push(part(new CylinderGeometry(0.42, 0.42, 0.3, 8), steelD, { pos: [x, y - 0.14, v], rot: [0, 0, Math.PI / 2] }));
    }
    for (const v of [-LINE_Z, LINE_Z]) {
      for (let i = 0; i + 1 < nodes.length; i++) parts.push(seg([nodes[i][0], nodes[i][1], v], [nodes[i + 1][0], nodes[i + 1][1], v], 0.075, INK, 4));
    }
    return parts;
  });
  return { steps, spots, ice: false };
}
