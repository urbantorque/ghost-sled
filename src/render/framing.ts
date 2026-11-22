import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import type { Course } from '../sim/course';
import type { ComposePlan, Composed } from './compose';
import { SNOW, basaltSentinelGeometry, heavyPineGeometry, organPipeGeometry, part, shade } from './flora';
import { visualGround } from './ground';
import { box, seg, type V3 } from './landmarkKit';
import type { Palette } from './palette';

// Round 8, the compose lane: what frames a composed place (compose.ts) from the lens, stood past the limit on what is
// drawn there, never on the run and never over a line a sled flies:
//   Pinecrest    two or three big spruces left standing on the valley side's crest, leaning out over the fall, dark
//                against the open sky (the forest behind them stands back);
//   Frostfang    a natural arch of blue ice from the canyon's wall to wall, high over the slot, and seracs on the
//                crests;
//   Ember        organ-pipe basalt along the wall's crest and a sentinel column on the fall's lip;
//   Sakura       torii in plum lacquer (never the rider's vermillion) standing on the terrace flats, their faces
//                to the lens, with stone lanterns;
//   Lanternfall  nothing new: its crest carries the overlook's rail and the cloud and the lights do the rest.
// A place's pieces are one geometry in one draw (overlook.ts Overlooks), built on idle time as it comes in range.

const UPV = new Vector3(0, 1, 0);
/** The kit's forms a palette was built for, made once (a spruce's boughs take most of a place's build). */
const kits = new WeakMap<Palette, Map<string, BufferGeometry>>();
function kit(p: Palette, key: string, make: () => BufferGeometry): BufferGeometry {
  let m = kits.get(p);
  if (!m) kits.set(p, (m = new Map()));
  let g = m.get(key);
  if (!g) m.set(key, (g = plain(make())));
  return g;
}
const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s = new Vector3();

/** A geometry with only what the toon material reads (position, normal, colour), non-indexed, so pieces from
 *  different kits merge. */
function plain(g: BufferGeometry): BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const out = new BufferGeometry();
  out.setAttribute('position', src.getAttribute('position').clone());
  if (!src.getAttribute('normal')) src.computeVertexNormals();
  out.setAttribute('normal', src.getAttribute('normal').clone());
  const col = src.getAttribute('color');
  if (col && col.itemSize === 3) out.setAttribute('color', col.clone());
  else {
    const n = src.getAttribute('position').count;
    out.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  return out;
}

/** Bakes a piece at a world transform: (x, y, z) three.js, turned `yaw`, leaning `lean` radians about the run's
 *  axis toward +x (`lx`), scaled `k`. */
function at(g: BufferGeometry, x: number, y: number, z: number, yaw: number, k: number, lean = 0): BufferGeometry {
  q.setFromAxisAngle(UPV, yaw);
  if (lean !== 0) q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -lean));
  m4.compose(v.set(x, y, z), q, s.set(k, k, k));
  return plain(g).applyMatrix4(m4);
}

function mergeAll(list: BufferGeometry[]): BufferGeometry | null {
  if (list.length === 0) return null;
  let n = 0;
  for (const g of list) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const c = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array as Float32Array, o * 3);
    nrm.set(g.getAttribute('normal').array as Float32Array, o * 3);
    col.set(g.getAttribute('color').array as Float32Array, o * 3);
    o += c;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nrm, 3));
  out.setAttribute('color', new BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** A point `e` metres past the edge on `side` at sim z, on what is drawn (three.js). */
function bank(c: Course, side: number, e: number, z: number): V3 {
  const x = c.centerX(z) + side * (c.halfWidth(z) + e);
  return [x, visualGround(c, x, z), -z];
}

/** A torii in deep plum lacquer, its face toward the lens (across the run), `w` between its posts. */
function torii(w: number, h: number): BufferGeometry[] {
  const lac = new Color('#93405A');
  const lacD = new Color('#6A2A40');
  const black = new Color('#24202E');
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    parts.push(part(new CylinderGeometry(0.34, 0.42, h, 10), lac, { pos: [sx * w * 0.5, h / 2 - 0.4, 0] }));
    parts.push(part(new CylinderGeometry(0.52, 0.58, 0.7, 10), black, { pos: [sx * w * 0.5, 0.1, 0] }));
  }
  parts.push(box(w + 1.6, 0.42, 0.34, lac, [0, h * 0.78, 0]));
  parts.push(box(0.3, h * 0.2, 0.26, lacD, [0, h * 0.88, 0]));
  const L = w + 3.2;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + (L * i) / n;
    const x1 = -L / 2 + (L * (i + 1)) / n;
    const lift = (x: number) => 0.5 * Math.pow(Math.abs(x) / (L / 2), 2.6);
    parts.push(seg([x0, h + lift(x0), 0], [x1, h + lift(x1), 0], 0.26, lac, 4));
    parts.push(seg([x0, h + 0.36 + lift(x0) * 1.15, 0], [x1, h + 0.36 + lift(x1) * 1.15, 0], 0.3, black, 4));
    parts.push(seg([x0, h + 0.62 + lift(x0) * 1.15, 0], [x1, h + 0.62 + lift(x1) * 1.15, 0], 0.16, SNOW, 4));
  }
  return parts;
}

/** A stone lantern: a footed post, a fire box and a cap with snow on it. */
function stoneLantern(p: Palette): BufferGeometry[] {
  const st = shade(p.low.clone().lerp(new Color('#9A9AA6'), 0.6), 0.9);
  return [
    box(0.9, 0.3, 0.9, shade(st, 0.85), [0, 0.15, 0]),
    part(new CylinderGeometry(0.2, 0.26, 1.2, 6), st, { pos: [0, 0.9, 0] }),
    box(0.8, 0.6, 0.8, new Color('#F2C27A'), [0, 1.8, 0]),
    part(new CylinderGeometry(0.1, 0.75, 0.5, 4), shade(st, 0.8), { pos: [0, 2.35, 0], rot: [0, Math.PI / 4, 0] }),
    part(new CylinderGeometry(0.05, 0.55, 0.3, 4), SNOW, { pos: [0, 2.6, 0], rot: [0, Math.PI / 4, 0] }),
  ];
}

/** An arch of blue ice across a canyon at sim z, from wall to wall at `y` over its crests' foot: a thick, sagging
 *  band of faceted ice with icicles under it. */
function iceArch(c: Course, z: number, lim: number, rise: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const body = [new Color('#7FC4E6'), new Color('#A8DDF2'), new Color('#5E9FD0')];
  const a = bank(c, -1, lim + 13, z);
  const b = bank(c, 1, lim + 13, z);
  const base = Math.min(a[1], b[1]);
  const n = 18;
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = a[0] + (b[0] - a[0]) * u;
    const yEnd = a[1] + (b[1] - a[1]) * u;
    const sag = Math.sin(Math.PI * u);
    pts.push([x, Math.max(yEnd, base) + rise * Math.pow(sag, 0.6) - 4 * (1 - sag), -z + Math.sin(u * 7.1) * 1.4]);
  }
  for (let i = 0; i < n; i++) {
    const r = 2.6 + 1.6 * (1 - Math.sin((Math.PI * (i + 0.5)) / n));
    parts.push(seg(pts[i], pts[i + 1], r, body[i % 3], 5));
    // Icicles under the span.
    if (i > 1 && i < n - 2) {
      const m: V3 = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2 - r * 0.8, (pts[i][2] + pts[i + 1][2]) / 2];
      const len = 2 + ((i * 37) % 5);
      parts.push(part(new CylinderGeometry(0.5, 0.02, len, 4), body[1], { pos: [m[0], m[1] - len / 2, m[2]] }));
    }
  }
  // Snow lying along the top of the span.
  for (let i = 1; i < n - 1; i += 2) parts.push(part(new IcosahedronGeometry(1, 0), SNOW, { pos: [pts[i][0], pts[i][1] + 2.4, pts[i][2]], scale: [3.2, 0.7, 2.2], jitter: 0.12 }));
  return parts;
}

/** Retaining walls of dressed stone up a flight of terraces on `side`, sim z0 to z1: one along each riser, from the
 *  flat under it to the flat over it, in blocks with a mossy coping. */
function terraceWalls(c: Course, side: number, z0: number, z1: number, p: Palette, out: BufferGeometry[]): void {
  const stone = p.low.clone().lerp(new Color('#C9BBAE'), 0.7);
  const moss = new Color('#4F6B4A');
  // (Plain blocks, not the kit's chamfered boxes: a hundred and more of them at 30 m and further.)
  const SEG = 15;
  for (let k = 0; k < 6; k++) {
    const t = 3 + k * 10.4 + 8 + 1.2;
    for (let z = z0; z < z1 - 1; z += SEG) {
      const zm = Math.min(z1, z + SEG) - SEG / 2;
      const lim = c.shapeAt(zm).limit;
      const lo = bank(c, side, lim + t - 2.6, zm);
      const hi = bank(c, side, lim + t + 2.6, zm);
      const h = hi[1] - lo[1];
      if (h < 1) continue;
      const mid = bank(c, side, lim + t, zm);
      // Dressed blocks, each its own value and standing a little proud or back of its neighbours, so a wall reads as
      // stone in courses and not one grey slab (the third critic's "untextured boxes").
      const BLOCKS = 3;
      const bl = SEG / BLOCKS;
      for (let j = 0; j < BLOCKS; j++) {
        const u = Math.sin(k * 3.1 + z * 0.37 + j * 2.3);
        const tone = 0.84 + 0.22 * (0.5 + 0.5 * u);
        const proud = 0.12 * Math.sin(j * 1.7 + z * 0.9 + k);
        const g = part(new BoxGeometry(1.4, h + 0.5 + 0.25 * u, bl - 0.22), stone.clone().multiplyScalar(tone), { pos: [0, (h + 0.5) / 2, 0], jitter: 0.06 });
        out.push(at(g, mid[0] - side * (0.6 + proud), lo[1] - 0.2, mid[2] - SEG / 2 + bl * (j + 0.5), 0, 1));
      }
      out.push(at(part(new BoxGeometry(1.6, 0.35, SEG - 0.1), moss), mid[0] - side * 0.6, lo[1] + h + 0.42, mid[2], 0, 1));
    }
  }
}

/** The pieces that frame one composed place of a course (its index in the plan), in one geometry (null for none). */
export function framingGeometry(c: Course, plan: ComposePlan, n: number, p: Palette): BufferGeometry | null {
  const out: BufferGeometry[] = [];
  const cp = plan.planned[n];
  if (cp) placeFrames(c, cp, p, out);
  return mergeAll(out);
}

function placeFrames(c: Course, cp: Composed, p: Palette, out: BufferGeometry[]): void {
  const len = cp.z1 - cp.z0;
  const lim = (z: number) => c.shapeAt(z).limit;
  const zAt = (u: number) => cp.z0 + len * u;
  const biome = c.biome;
  if (biome === 'alpine') {
    // The spruces on the valley side's crest, leaning out over the fall.
    const side = cp.open || 1;
    const pine = kit(p, 'pine', () => heavyPineGeometry(p));
    // (Where the opening's frames see them: a spruce is in frame from about 45 m ahead at the crest's distance.)
    for (const [u, e, k, lean] of [[0.24, 4, 2.3, 0.16], [0.29, 6, 1.7, 0.1], [0.66, 4, 2.1, 0.2], [0.76, 5, 1.6, 0.12]] as const) {
      const z = zAt(u);
      const pt = bank(c, side, lim(z) + e, z);
      out.push(at(pine, pt[0], pt[1] - 0.2, pt[2], u * 9, k, lean * side));
    }
  } else if (biome === 'glacier') {
    if (cp.look === 'canyon') {
      // The arch over the canyon's slot, where its walls stand whole.
      const wall = cp.banks.filter((b) => b.kind === 'wall');
      const z1 = Math.min(...wall.map((b) => b.z1 - b.rout));
      const z0 = Math.max(...wall.map((b) => b.z0 + b.rin));
      if (z1 - z0 > 30) for (const g of iceArch(c, z0 + (z1 - z0) * 0.55, lim(z0), 30)) out.push(at(g, 0, 0, 0, 0, 1));
    }
    // Seracs on the wall's crest.
    for (const b of cp.banks) {
      if (b.kind !== 'wall') continue;
      for (let k = 0; k < 4; k++) {
        const z = b.z0 + b.rin + ((b.z1 - b.rout - b.z0 - b.rin) * (k + 0.5)) / 4;
        const pt = bank(c, b.side, lim(z) + 11 + (k % 2) * 3, z);
        out.push(at(part(new BoxGeometry(2.6, 9, 2.2), new Color(k % 2 ? '#A8DDF2' : '#7FC4E6'), { jitter: 0.35 }), pt[0], pt[1] + 3, pt[2], k * 1.7, 1 + 0.3 * (k % 3), 0.12 * b.side * (k % 2 ? 1 : -1)));
      }
    }
  } else if (biome === 'volcanic') {
    const organ = kit(p, 'organ', () => organPipeGeometry(p));
    const sentinel = kit(p, 'sentinel', () => basaltSentinelGeometry(p));
    for (const b of cp.banks) {
      if (b.kind === 'wall') {
        // (Round 8's review: three outcrops a place read as "a squat dark block" and "no ridge": the wall is a rank
        // of organ pipes along its crest, a stand every 20 m or so, each its own height, the near ones a little
        // lower, so from the low lens it is a wall of basalt beside the run with the fall on the other hand.)
        const n = Math.max(3, Math.round((b.z1 - b.z0) / 20));
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const h = Math.abs(Math.sin(k * 12.9898 + b.z0 * 0.0137) * 43758.5453) % 1;
          const z = b.z0 + (b.z1 - b.z0) * u + (h - 0.5) * 6;
          const pt = bank(c, b.side, lim(z) + 8 + 2.5 * h, z);
          // (Its broad face toward the run.)
          out.push(at(organ, pt[0], pt[1] - 0.6, pt[2], (b.side > 0 ? -Math.PI / 2 : Math.PI / 2) + (h - 0.5) * 0.5, 1.05 + 0.5 * h));
        }
      } else if (b.kind === 'fall') {
        for (const u of [0.3, 0.68]) {
          const z = b.z0 + (b.z1 - b.z0) * u;
          const pt = bank(c, b.side, lim(z) + 3.4, z);
          out.push(at(sentinel, pt[0], pt[1] - 0.3, pt[2], u * 5, 1.25));
        }
      }
    }
  } else if (biome === 'blossom') {
    const gate = torii(5.6, 6.2);
    // The terraces up the hill face the run: each riser a retaining wall of dressed stone with a coping of moss.
    for (const b of cp.banks) if (b.kind === 'rise') terraceWalls(c, b.side, b.z0 + b.rin * 0.6, b.z1 - b.rout * 0.6, p, out);
    const lamp = stoneLantern(p);
    for (const b of cp.banks) {
      if (b.kind !== 'steps' && b.kind !== 'rise') continue;
      for (const [u, flat] of [[0.3, 0], [0.62, 1]] as const) {
        const z = b.z0 + (b.z1 - b.z0) * u;
        // On a flat, its face across the run to the lens.
        const e = lim(z) + 3 + flat * 10.4 + 4.2;
        const pt = bank(c, b.side, e, z);
        for (const g of gate) out.push(at(g, pt[0], pt[1] - 0.1, pt[2], 0, 1));
        for (const dz of [-6, 6]) {
          const lp = bank(c, b.side, e - 1.5, z + dz);
          for (const g of lamp) out.push(at(g, lp[0], lp[1] - 0.05, lp[2], 0.4, 1));
        }
      }
    }
  }
}
