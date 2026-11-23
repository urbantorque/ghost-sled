// Round 9, the garage lane (milestone 0): the proposed pieces built well enough to judge at race distance, on the
// game's own rider. A dev page or a capture script imports this from the running game (vite serves it), so the rider,
// its materials and its scarf are the very ones a run draws; proposals are put on through the rider's own parts
// (its head's geometry, its tails, its sled's mesh), never through anything a player's build reaches.
//
// Built in meshes.ts's style: flat-shaded primitives with vertex colours and the rider's sway attribute, the player's
// vermillion with the beanie's cream or an ink trim (ART.md 5), trails in the lantern's warm family. What milestone 2
// would ship goes into meshes.ts, rider.ts and particles.ts properly; this is a sketch to look at.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RIDER_COLORS, RIDER_NECK, RIDER_POM, SCARF_KNOT, withSway } from '../../../src/render/meshes';
import { liftEdges } from '../../../src/render/chamfer';
import { scarfById } from '../../../src/game/garage';

// ---------------------------------------------------------------- meshes.ts's helpers, in its style

let seed = 4242;
const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

interface PartOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  jitter?: number;
}

function part(geo: BufferGeometry, color: Color | string, o: PartOpts = {}): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (o.jitter) {
    const p = g.getAttribute('position') as BufferAttribute;
    const map = new Map<string, [number, number, number]>();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let d = map.get(key);
      if (!d) map.set(key, (d = [(rnd() - 0.5) * o.jitter, (rnd() - 0.5) * o.jitter, (rnd() - 0.5) * o.jitter]));
      p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
  }
  g.applyMatrix4(new Matrix4().compose(new Vector3(...(o.pos ?? [0, 0, 0])), new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))), new Vector3(...(o.scale ?? [1, 1, 1]))));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const c = color instanceof Color ? color : new Color(color);
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(a, 3));
  liftEdges(g);
  return g;
}

function smoothPart(geo: BufferGeometry, color: Color, o: PartOpts = {}): BufferGeometry {
  geo.applyMatrix4(new Matrix4().compose(new Vector3(...(o.pos ?? [0, 0, 0])), new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))), new Vector3(...(o.scale ?? [1, 1, 1]))));
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new BufferAttribute(a, 3));
  return g;
}

/** The rider's sway weights (meshes.ts sway): x the pom's bounce, z how soft (it lags the body). */
function sway(g: BufferGeometry, w: [number, number, number?] | ((x: number, y: number, z: number) => [number, number, number?])): BufferGeometry {
  const p = g.getAttribute('position');
  const a = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const v = typeof w === 'function' ? w(p.getX(i), p.getY(i), p.getZ(i)) : w;
    a[i * 4] = v[0];
    a[i * 4 + 1] = v[1];
    a[i * 4 + 2] = v[2] ?? 0;
  }
  g.setAttribute('aSway', new BufferAttribute(a, 4));
  return g;
}

const shade = (c: Color, k: number): Color => c.clone().multiplyScalar(k);

function capsule(a: Vector3, b: Vector3, ra: number, rb: number, color: Color, sides = 9): BufferGeometry {
  const d = b.clone().sub(a);
  const L = d.length();
  const prof: Vector2[] = [];
  for (let i = 0; i <= 2; i++) {
    const t = -Math.PI / 2 + (i / 2) * (Math.PI / 2);
    prof.push(new Vector2(ra * Math.cos(t), ra * Math.sin(t)));
  }
  for (let i = 0; i <= 2; i++) {
    const t = (i / 2) * (Math.PI / 2);
    prof.push(new Vector2(rb * Math.cos(t), L + rb * Math.sin(t)));
  }
  prof[0].x = 0;
  prof[prof.length - 1].x = 0;
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()));
  return part(new LatheGeometry(prof, sides), color, { pos: [a.x, a.y, a.z], rot: [e.x, e.y, e.z] });
}

function lathe(profile: Array<[number, number]>, segs: number, color: Color, o: PartOpts = {}): BufferGeometry {
  return part(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segs), color, o);
}

function ribs(g: BufferGeometry, count: number, k: number): BufferGeometry {
  const pos = g.getAttribute('position') as BufferAttribute;
  const col = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * count) % 2) continue;
    for (let j = i; j < i + 3; j++) col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
  }
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts.map(withSway), false);
  if (!g) throw new Error('merge failed');
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- hats

const C = RIDER_COLORS;

/** The head under any hat, as meshes.ts riderHeadGeometry draws it: the face, the bob of hair and its fringe. */
function headBase(): BufferGeometry[] {
  seed = 4242;
  const eye = new Color('#1B1E36');
  const blush = new Color('#FF8E9E');
  const parts: BufferGeometry[] = [
    part(new SphereGeometry(0.24, 14, 10), C.skin, { pos: [0, 0.86, 0] }),
    smoothPart(new SphereGeometry(0.249, 18, 8, -0.25, Math.PI + 0.5, 1.3, 1.15), C.hair, { pos: [0, 0.86, 0.004], scale: [1.05, 1, 1.08] }),
  ];
  for (const [a, s] of [[-0.95, 0.85], [-0.48, 1], [0, 1.08], [0.48, 1], [0.95, 0.85]] as const) {
    parts.push(smoothPart(new SphereGeometry(0.056 * s, 8, 6), C.hair, { pos: [Math.sin(a) * 0.212 * 1.05, 0.725 - 0.012 * Math.abs(a), Math.cos(a) * 0.212 * 1.08 - 0.01], rot: [0.35, a, 0], scale: [1.45, 1.25, 0.6] }));
  }
  for (const sx of [-1, 1]) {
    parts.push(
      part(new SphereGeometry(0.04, 9, 7), eye, { pos: [sx * 0.08, 0.82, -0.211], rot: [0, -sx * 0.34, 0], scale: [0.8, 1.18, 0.5] }),
      part(new SphereGeometry(0.012, 5, 4), C.pom, { pos: [sx * 0.091, 0.836, -0.229] }),
      part(new SphereGeometry(0.042, 8, 6), blush, { pos: [sx * 0.14, 0.77, -0.168], rot: [0, -sx * 0.68, 0], scale: [1.25, 0.72, 0.32] }),
    );
  }
  parts.push(part(new SphereGeometry(0.025, 7, 5), shade(C.skin, 0.93), { pos: [0, 0.797, -0.238], scale: [1, 0.85, 0.7] }));
  return parts;
}

const cuffC = shade(C.accent, 0.8);
const dome = (sy = 1.12) => part(new SphereGeometry(0.25, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.accent, { pos: [0, 0.915, 0.01], scale: [1.04, sy, 1.04] });
const ribbed = (r0: number, r1: number, h: number, y: number) => ribs(part(new CylinderGeometry(r0, r1, h, 24, 1, true), cuffC, { pos: [0, y, 0.01] }), 24, 0.84);
const seam = (sy = 1.12) => part(new TorusGeometry(0.26, 0.009, 3, 8, Math.PI / 2), shade(C.accent, 0.7), { pos: [0, 0.915, 0.01], rot: [0, -Math.PI / 2, 0], scale: [1.04, sy, 1.04] });
const stripe = (sy = 1.12) => part(new SphereGeometry(0.256, 14, 1, 0, Math.PI * 2, 0.85, 0.16), C.pom, { pos: [0, 0.915, 0.01], scale: [1.04, sy, 1.04] });
const pom = (x: number, y: number, z: number, r: number, w = 1) => sway(part(new IcosahedronGeometry(r, 1), C.pom, { pos: [x, y, z], jitter: 0.3 * r }), [w, 0]);
function flaps(out: BufferGeometry[], scale: [number, number, number] = [0.5, 1.5, 0.98], y = 0.775): void {
  for (const sx of [-1, 1]) out.push(part(new SphereGeometry(0.085, 9, 6), cuffC, { pos: [sx * 0.238, y, 0.035], rot: [0, 0, sx * 0.1], scale }));
}
function goggles(out: BufferGeometry[], y = 1.005, z = -0.232): void {
  for (const sx of [-1, 1]) {
    out.push(
      part(new SphereGeometry(0.06, 10, 7), C.lens, { pos: [sx * 0.086, y, z], rot: [0.28, -sx * 0.36, 0], scale: [1.12, 0.86, 0.42] }),
      part(new TorusGeometry(0.06, 0.017, 5, 14), C.goggles, { pos: [sx * 0.086, y, z + 0.003], rot: [0.28, -sx * 0.36, 0], scale: [1.12, 0.86, 1] }),
    );
  }
  out.push(part(new BoxGeometry(0.06, 0.03, 0.04), C.goggles, { pos: [0, y - 0.005, z - 0.013], rot: [0.28, 0, 0] }));
}
const strap = (r = 0.247, y = 1.0) => part(new TorusGeometry(r, 0.019, 4, 18), C.strap, { pos: [0, y, 0.01], rot: [Math.PI / 2 + 0.06, 0, 0] });
const band = () => part(new TorusGeometry(0.27, 0.018, 4, 18), shade(C.accent, 0.9), { pos: [0, 0.952, 0.01], rot: [Math.PI / 2, 0, 0] });

/** A chain of capsules along a path, softer toward its end (the hat's tail lags). */
function tailChain(path: Vector3[], rad: number[], color: (i: number) => Color, soft = 0.9): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const w0 = (i / (path.length - 1)) * soft;
    const w1 = ((i + 1) / (path.length - 1)) * soft;
    const a = path[i];
    const b = path[i + 1];
    out.push(sway(capsule(a, b, rad[i], rad[i + 1], color(i), 10), (x, y, z) => {
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y) + (z - a.z) * (b.z - a.z)) / a.distanceToSquared(b)));
      return [w0 + (w1 - w0) * t, 0];
    }));
  }
  return out;
}

export type ProtoHat = 'bobbles2' | 'crest' | 'muffs' | 'downcap' | 'twintails' | 'floppeak';

function protoHatParts(id: ProtoHat): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  switch (id) {
    case 'bobbles2':
      // The Bobble Crown reworked: six bobbles stood on short stalks, a spiky ring rather than a fuzz on top.
      out.push(dome(), ribbed(0.268, 0.274, 0.095, 0.905), stripe(), seam(), band());
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const base = new Vector3(Math.sin(a) * 0.17, 1.1, 0.02 + Math.cos(a) * 0.17);
        const tip = new Vector3(Math.sin(a) * 0.23, 1.25, 0.02 + Math.cos(a) * 0.23);
        out.push(capsule(base, tip, 0.022, 0.018, shade(C.accent, 0.9), 6));
        out.push(pom(tip.x, tip.y + 0.03, tip.z, 0.058, 0.7));
      }
      flaps(out);
      goggles(out);
      out.push(strap());
      break;
    case 'crest':
      // A fin of seven cream bobbles from brow to nape: from behind, a vertical stripe standing over the head.
      out.push(dome(), ribbed(0.268, 0.274, 0.095, 0.905), seam(), band());
      for (let i = 0; i < 7; i++) {
        const a = -0.95 + (i / 6) * 2.1;
        const r = 0.052 + 0.022 * Math.sin((i / 6) * Math.PI);
        out.push(pom(0, 0.915 + Math.cos(a) * 0.28 * 1.12, 0.01 + Math.sin(a) * 0.285, r, 0.35 + 0.1 * i));
      }
      flaps(out);
      goggles(out);
      out.push(strap());
      break;
    case 'muffs': {
      // No crown: the hair shows on top. A ribbed knit band over the head from ear to ear and two big fur muffs.
      out.push(smoothPart(new SphereGeometry(0.252, 18, 8, 0, Math.PI * 2, 0, 1.35), C.hair, { pos: [0, 0.86, 0.004], scale: [1.04, 1.06, 1.06] }));
      out.push(ribs(part(new TorusGeometry(0.262, 0.035, 6, 20, Math.PI), C.accent, { pos: [0, 0.86, 0.04], rot: [0, 0, 0], scale: [1.05, 1.08, 1] }), 20, 0.82));
      for (const sx of [-1, 1]) {
        out.push(sway(part(new IcosahedronGeometry(0.115, 1), C.accent, { pos: [sx * 0.275, 0.83, 0.03], scale: [0.72, 1, 1], jitter: 0.03 }), [0.25, 0]));
        out.push(part(new TorusGeometry(0.1, 0.018, 5, 14), C.pom, { pos: [sx * 0.258, 0.83, 0.03], rot: [0, Math.PI / 2, 0], jitter: 0.008 }));
      }
      goggles(out, 0.985, -0.236);
      break;
    }
    case 'downcap': {
      // A big puffed dome in three fat quilted channels, a short brim forward, no pom: stepped sides from behind.
      const prof: Array<[number, number]> = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = t * (Math.PI / 2);
        const puff = 1 + 0.07 * Math.abs(Math.sin(t * Math.PI * 3));
        prof.push([Math.max(0.001, 0.3 * Math.cos(a) * puff), 0.86 + 0.31 * Math.sin(a) * puff]);
      }
      const g = lathe(prof, 18, C.accent, { pos: [0, 0, 0.012] });
      // The quilting's seams a step deeper.
      const pos = g.getAttribute('position') as BufferAttribute;
      const col = g.getAttribute('color') as BufferAttribute;
      for (let i = 0; i < pos.count; i += 3) {
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const t = Math.asin(Math.max(-1, Math.min(1, (y - 0.86) / 0.32))) / (Math.PI / 2);
        const k = Math.abs(Math.sin(t * Math.PI * 3)) < 0.35 ? 0.72 : 1;
        for (let j = i; j < i + 3; j++) col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
      }
      out.push(g);
      out.push(part(new CylinderGeometry(0.2, 0.2, 0.025, 16, 1, false, -Math.PI / 2 - 0.9, 1.8), shade(C.accent, 0.85), { pos: [0, 0.9, -0.14], scale: [1, 1, 1.25] }));
      out.push(part(new TorusGeometry(0.3, 0.03, 5, 22), cuffC, { pos: [0, 0.87, 0.012], rot: [Math.PI / 2, 0, 0] }));
      goggles(out, 1.04, -0.27);
      break;
    }
    case 'twintails': {
      // Two long knit tails off the back of the crown, streaming in a V above the scarf.
      out.push(dome(), ribbed(0.268, 0.274, 0.095, 0.905), stripe(), seam(), band());
      for (const sx of [-1, 1]) {
        const path = [new Vector3(sx * 0.12, 1.07, 0.12), new Vector3(sx * 0.22, 1.06, 0.3), new Vector3(sx * 0.33, 1.0, 0.47), new Vector3(sx * 0.42, 0.92, 0.62), new Vector3(sx * 0.49, 0.85, 0.76)];
        out.push(...tailChain(path, [0.075, 0.062, 0.05, 0.04, 0.034], (i) => (i === 3 ? C.pom : i % 2 ? shade(C.accent, 0.92) : C.accent)));
      }
      flaps(out);
      goggles(out);
      out.push(strap());
      break;
    }
    case 'floppeak': {
      // A tall soft felt cone that flops over to one side, a cream pom swinging at its tip. Felt: smooth, no ribs.
      out.push(dome(1.05), part(new TorusGeometry(0.265, 0.04, 6, 24), cuffC, { pos: [0, 0.9, 0.01], rot: [Math.PI / 2, 0, 0] }));
      const path = [new Vector3(0, 1.0, 0.02), new Vector3(0.01, 1.18, 0.03), new Vector3(0.05, 1.33, 0.05), new Vector3(0.16, 1.43, 0.07), new Vector3(0.29, 1.42, 0.08), new Vector3(0.36, 1.33, 0.09)];
      out.push(...tailChain(path, [0.235, 0.17, 0.11, 0.075, 0.052, 0.04], () => shade(C.accent, 0.95), 0.8));
      out.push(pom(0.37, 1.27, 0.09, 0.07, 1));
      goggles(out, 0.99, -0.236);
      out.push(strap(0.25, 0.975));
      break;
    }
  }
  return out;
}

/** The whole head wearing a proposed hat, in the rider's neck space (as rider.ts buildHead wants it). */
export function protoHead(id: ProtoHat): BufferGeometry {
  return merge([...headBase(), ...protoHatParts(id)]).translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z);
}

// ---------------------------------------------------------------- the rider's own parts, reached at runtime

/** What a prototype needs of a live Rider (its private parts: this is a dev sketch, never the game). */
interface RiderParts {
  head: Mesh;
  crashHead: Mesh;
  sled: Mesh;
  scarf: Mesh;
  bodyPivot: Group;
  tails: Array<{ pts: Vector3[]; seg: number }>;
  tailGeo: BufferGeometry;
  scarfBase: Float32Array | null;
  burnK: number;
  burnShown: number;
  setHat(id: string): void;
  setScarf(def: unknown): void;
  setPaint(hex: string): void;
  setSled(id: number): void;
  setBurn(k: number): void;
  hat: string;
  scarfLook: unknown;
  paintHex: string;
  sledId: number;
}

const ownGeo = new WeakMap<object, BufferGeometry>();
const extras = new Set<Object3D>();

function clearExtras(): void {
  for (const o of extras) o.removeFromParent();
  extras.clear();
}

// ---------------------------------------------------------------- scarves

const BURN_MID = new Color('#FF6A1A').multiplyScalar(1.15);
const BURN_TIP = new Color('#FFC23A').multiplyScalar(1.1);
const V = RIDER_COLORS.accent;
const VLUM = 0.2126 * V.r + 0.7152 * V.g + 0.0722 * V.b;

/** The burn that keeps the knit (the proposal): each stitch burns at its own value, so an ink band stays dark in the
 *  flame and a cream one burns pale gold, where today's burn lerps every stitch to the same flame colour. */
function burnKeepingPattern(this: RiderParts, k: number): void {
  const base = this.scarfBase;
  if (!base) return;
  const col = this.tailGeo.getAttribute('color') as BufferAttribute;
  const a = col.array as Float32Array;
  const R = 17;
  const hot = new Color();
  for (let i = 0; i < col.count; i++) {
    const along = i < 2 * R * 2 ? (Math.floor(i / 2) % R) / (R - 1) : 1;
    const b = k * Math.min(1, Math.max(0, (along - 0.25) / 0.6));
    const e = b * b * (3 - 2 * b);
    hot.copy(BURN_MID).lerp(BURN_TIP, Math.min(1, Math.max(0, (along - 0.55) / 0.45)));
    const lum = 0.2126 * base[i * 3] + 0.7152 * base[i * 3 + 1] + 0.0722 * base[i * 3 + 2];
    const v = lum / VLUM;
    if (v > 1.25) hot.lerp(new Color('#FFF0C8'), 0.6);
    else hot.multiplyScalar(Math.max(0.28, Math.min(1, v)));
    a[i * 3] = base[i * 3] + (hot.r - base[i * 3]) * e;
    a[i * 3 + 1] = base[i * 3 + 1] + (hot.g - base[i * 3 + 1]) * e;
    a[i * 3 + 2] = base[i * 3 + 2] + (hot.b - base[i * 3 + 2]) * e;
  }
  col.needsUpdate = true;
  this.burnShown = k;
}

export type ProtoScarf = 'chunky2' | 'streamer2' | 'double' | 'pomtails' | 'cape' | 'veil';

/** Something that follows a scarf tail's tip each frame (a pom, a paper lamp). */
function tipFollower(rp: RiderParts, k: number, mesh: Mesh): void {
  mesh.frustumCulled = false;
  mesh.onBeforeRender = () => {
    const pts = rp.tails[k].pts;
    mesh.position.copy(pts[pts.length - 1]);
    mesh.updateMatrixWorld();
  };
  extras.add(mesh);
}

/** Paints the tail rows (2 vertices a row, 17 rows a tail, two tails) by a function of the row. */
function paintRows(rp: RiderParts, f: (r: number) => Color): void {
  const col = rp.tailGeo.getAttribute('color') as BufferAttribute;
  const R = 17;
  for (let i = 0; i < 2 * R * 2; i++) {
    const c = f(Math.floor(i / 2) % R);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  rp.scarfBase = (col.array as Float32Array).slice();
}

const CREAM = new Color('#F3E6D4');
const INK = new Color('#1A2140');
const TAIL_SEG = [0.165 * 1.2, 0.135 * 1.2];

function protoScarf(rp: RiderParts, id: ProtoScarf, scene: Object3D): void {
  const mat = rp.scarf.material as Material;
  const bodyMat = rp.sled.material as Material;
  switch (id) {
    case 'chunky2':
      rp.setScarf({ ...scarfById('chunky'), width: 1.6, length: 0.78 });
      paintRows(rp, (r) => shade(V, r < 3 ? 0.86 : r % 2 ? 1 : 0.62));
      break;
    case 'streamer2':
      rp.setScarf({ ...scarfById('streamer'), width: 0.82 });
      rp.tails[0].seg = TAIL_SEG[0] * 1.75;
      rp.tails[1].seg = TAIL_SEG[1] * 0.55;
      break;
    case 'double': {
      // Four tails: the scarf's own two, and a second, shorter pair drawn from the same chain a hand lower and
      // pushed out, with cream piping read as a cream row every third.
      rp.setScarf({ ...scarfById('classic'), length: 1.05 });
      paintRows(rp, (r) => (r >= 3 && r % 3 === 0 ? CREAM : shade(V, r < 3 ? 0.86 : 1)));
      const twin = new Mesh(rp.tailGeo, mat);
      twin.frustumCulled = false;
      twin.onBeforeRender = () => {
        const knot = rp.tails[0].pts[0];
        twin.matrixWorld.makeTranslation(-knot.x, -knot.y, -knot.z).premultiply(new Matrix4().makeScale(0.78, 0.8, 0.78)).premultiply(new Matrix4().makeTranslation(knot.x, knot.y - 0.1, knot.z + 0.02));
      };
      twin.matrixAutoUpdate = false;
      scene.add(twin);
      extras.add(twin);
      break;
    }
    case 'pomtails':
      rp.setScarf({ ...scarfById('classic'), length: 0.95 });
      for (let k = 0; k < 2; k++) {
        const g = merge([part(new IcosahedronGeometry(0.085, 1), shade(V, 0.95), { jitter: 0.03 })]);
        const m = new Mesh(g, bodyMat);
        scene.add(m);
        tipFollower(rp, k, m);
      }
      break;
    case 'veil':
      rp.setScarf({ ...scarfById('streamer'), length: 1.4, width: 0.8 });
      paintRows(rp, (r) => (r >= 13 ? CREAM : shade(V, r < 3 ? 0.86 : 1)));
      for (let k = 0; k < 2; k++) {
        const g = merge([
          part(new CylinderGeometry(0.045, 0.05, 0.1, 8), CREAM),
          part(new CylinderGeometry(0.03, 0.046, 0.025, 8), INK, { pos: [0, 0.06, 0] }),
          part(new CylinderGeometry(0.046, 0.03, 0.02, 8), INK, { pos: [0, -0.06, 0] }),
        ]);
        const lamp = new Mesh(g, bodyMat);
        const glow = new Mesh(new SphereGeometry(0.035, 8, 6), new MeshBasicMaterial({ color: new Color('#FFE6A8').multiplyScalar(1.4) }));
        lamp.add(glow);
        scene.add(lamp);
        tipFollower(rp, k, lamp);
      }
      break;
    case 'cape': {
      // One broad knit panel from the shoulders down the back to the waist, a cream chevron at its hem, flapping.
      rp.setScarf({ ...scarfById('classic'), length: 0.55 });
      const W = 6;
      const H = 9;
      const geo = new BufferGeometry();
      const pos = new Float32Array((W + 1) * (H + 1) * 3);
      const colA = new Float32Array((W + 1) * (H + 1) * 3);
      const idx: number[] = [];
      const rest: Vector3[] = [];
      for (let j = 0; j <= H; j++) {
        const v = j / H;
        for (let i = 0; i <= W; i++) {
          const u = i / W - 0.5;
          const half = 0.2 + 0.14 * v;
          const x = u * 2 * half;
          const y = 0.6 - 0.5 * v;
          const z = 0.2 + 0.1 * Math.cos(u * Math.PI) + 0.06 * v;
          rest.push(new Vector3(x, y, z));
          const hem = v > 0.72 && Math.abs(Math.abs(u) * 2 - (v - 0.72) * 3.2) < 0.22;
          const c = hem ? CREAM : shade(V, j % 2 ? 0.9 : 1);
          colA.set([c.r, c.g, c.b], (j * (W + 1) + i) * 3);
          if (i < W && j < H) {
            const a = j * (W + 1) + i;
            idx.push(a, a + W + 1, a + 1, a + 1, a + W + 1, a + W + 2);
          }
        }
      }
      geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
      geo.setAttribute('color', new BufferAttribute(colA, 3));
      geo.setIndex(idx);
      withSway(geo);
      const cape = new Mesh(geo, rp.scarf.material as Material);
      cape.frustumCulled = false;
      cape.onBeforeRender = () => {
        const t = performance.now() / 1000;
        for (let k = 0; k < rest.length; k++) {
          const p = rest[k];
          const v = (0.6 - p.y) / 0.5;
          const flap = v * v * (0.09 * Math.sin(t * 9 + p.x * 6 + v * 3) + 0.14);
          pos[k * 3] = p.x;
          pos[k * 3 + 1] = p.y + flap * 0.35;
          pos[k * 3 + 2] = p.z + flap;
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
      };
      rp.bodyPivot.add(cape);
      extras.add(cape);
      break;
    }
  }
}

// ---------------------------------------------------------------- finishes (paint as finish and motif)

export type ProtoFinish = 'pine2' | 'stars' | 'twotone' | 'chequer' | 'twinstripe';

/** Paints a Pine Flyer's geometry as a finish: the trim's vermillion and the steel kept (ART.md 13), the wood's value
 *  kept under the base colour, and a motif laid on by where each facet sits (the tail, the slats' edges). */
function paintFinish(g: BufferGeometry, id: ProtoFinish): BufferGeometry {
  const col = g.getAttribute('color') as BufferAttribute;
  const pos = g.getAttribute('position') as BufferAttribute;
  const keep = [RIDER_COLORS.accent, new Color('#B9C3D8'), RIDER_COLORS.pom];
  const base: Record<ProtoFinish, string> = { pine2: '#2F6A4E', stars: '#232E66', twotone: '#6E3F82', chequer: '#EDEFF6', twinstripe: '#2B2A33' };
  const paint = new Color(base[id]);
  seed = 99;
  const c = new Color();
  for (let i = 0; i < col.count; i += 3) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    if (keep.some((k) => Math.abs(k.r - c.r) + Math.abs(k.g - c.g) + Math.abs(k.b - c.b) < 0.32)) continue;
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const v = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const k = Math.max(0.55, Math.min(1.3, v / 0.52));
    let out = paint.clone().multiplyScalar(k);
    const deck = y > 0.17 && y < 0.24;
    if (id === 'pine2' && (Math.abs(x) > 0.265 || (deck && Math.abs(z - 0.05) > 0.6))) out = CREAM.clone();
    if (id === 'stars' && z > 0.0 && rnd() < 0.12) out = CREAM.clone();
    if (id === 'twotone' && (Math.abs(x) > 0.2 || !deck)) out = CREAM.clone().multiplyScalar(Math.min(1, k));
    if (id === 'chequer' && z > 0.3 && (Math.floor((x + 0.3) / 0.12) + Math.floor((z + 2) / 0.12)) % 2 === 0) out = INK.clone();
    if (id === 'twinstripe' && deck && Math.abs(Math.abs(x) - 0.17) < 0.065) out = CREAM.clone();
    for (let j = i; j < i + 3; j++) col.setXYZ(j, out.r, out.g, out.b);
  }
  col.needsUpdate = true;
  return g;
}

// ---------------------------------------------------------------- the Pine Flyer's track

/** The five tiers, built onto the sled where the chase lens sees it (sled space: deck along -z, the tail at +z). */
function trackParts(tiers: number): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const wood = RIDER_COLORS.woodDark;
  if (tiers >= 1) {
    // I, runners: the tails run on and scroll up into two curls behind the seat.
    for (const sx of [-0.3, 0.3]) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 7; i++) {
        const a = Math.PI / 2 + (i / 7) * Math.PI * 1.3;
        const r = 0.12 * (1 - 0.35 * (i / 7));
        pts.push(new Vector3(sx, 0.22 + r * Math.sin(a) - 0.0, 0.86 + r * Math.cos(a) + 0.0));
      }
      out.push(capsule(new Vector3(sx, 0.1, 0.86), pts[0], 0.022, 0.02, RIDER_COLORS.accent, 7));
      for (let i = 0; i < 7; i++) out.push(capsule(pts[i], pts[i + 1], 0.02 - 0.0015 * i, 0.02 - 0.0015 * (i + 1), RIDER_COLORS.accent, 7));
    }
  }
  if (tiers >= 2) {
    // II, deck: a cream quilted pad over the seat, its stitched edge proud past the hips.
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) out.push(part(new BoxGeometry(0.155, 0.045, 0.16), shade(CREAM, (i + j) % 2 ? 0.92 : 1), { pos: [-0.2325 + i * 0.155, 0.245, 0.12 + j * 0.16] }));
    out.push(part(new BoxGeometry(0.66, 0.03, 0.5), shade(CREAM, 0.8), { pos: [0, 0.228, 0.28] }));
  }
  if (tiers >= 3) {
    // III, crest: the bow becomes a carved crest, a scalloped backboard twice its height, edged in vermillion.
    const prof: Array<[number, number]> = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12 - 0.5;
      prof.push([u * 0.64, 0.22 + 0.3 * Math.cos(u * Math.PI * 0.9) + 0.05 * Math.cos(u * Math.PI * 6)]);
    }
    for (let i = 0; i < 12; i++) {
      const [x0, y0] = prof[i];
      const [x1, y1] = prof[i + 1];
      const h = (y0 + y1) / 2 - 0.2;
      out.push(part(new BoxGeometry(x1 - x0 + 0.004, h, 0.035), i % 2 ? wood : RIDER_COLORS.wood, { pos: [(x0 + x1) / 2, 0.2 + h / 2, 0.7] }));
      out.push(capsule(new Vector3(x0, y0, 0.705), new Vector3(x1, y1, 0.705), 0.016, 0.016, RIDER_COLORS.accent, 6));
    }
  }
  if (tiers >= 4) {
    // IV, stern lamp: a post off the crest's right shoulder with a paper lamp hung from its arm.
    out.push(capsule(new Vector3(0.24, 0.2, 0.74), new Vector3(0.24, 0.92, 0.76), 0.022, 0.02, wood, 7));
    out.push(capsule(new Vector3(0.24, 0.92, 0.76), new Vector3(0.24, 0.95, 0.9), 0.017, 0.015, wood, 6));
    out.push(part(new CylinderGeometry(0.075, 0.085, 0.16, 10), CREAM, { pos: [0.24, 0.8, 0.9] }));
    for (const dy of [-0.04, 0.0, 0.04]) out.push(part(new TorusGeometry(0.084, 0.006, 3, 12), shade(CREAM, 0.82), { pos: [0.24, 0.8 + dy, 0.9], rot: [Math.PI / 2, 0, 0] }));
    out.push(part(new ConeGeometry(0.085, 0.05, 10), INK, { pos: [0.24, 0.905, 0.9] }));
    out.push(part(new CylinderGeometry(0.05, 0.07, 0.03, 10), INK, { pos: [0.24, 0.705, 0.9] }));
  }
  return out;
}

/** The fifth tier's inlay: ink lines down the runners and round the crest that burn with the scarf at Spirit Flow. */
function inlay(flow: number): Mesh {
  const parts: BufferGeometry[] = [];
  for (const sx of [-0.3, 0.3]) parts.push(part(new BoxGeometry(0.02, 0.012, 1.3), INK, { pos: [sx, 0.06, 0.03] }));
  for (let i = 0; i < 12; i++) {
    const u0 = i / 12 - 0.5;
    const u1 = (i + 1) / 12 - 0.5;
    const y = (u: number) => 0.22 + 0.27 * Math.cos(u * Math.PI * 0.9);
    parts.push(capsule(new Vector3(u0 * 0.56, y(u0), 0.72), new Vector3(u1 * 0.56, y(u1), 0.72), 0.008, 0.008, INK, 4));
  }
  const burn = flow >= 2 ? new Color('#FF6A1A').lerp(new Color('#FFC23A'), Math.min(1, (flow - 2) / 3)).multiplyScalar(1.6) : INK;
  return new Mesh(merge(parts), new MeshBasicMaterial({ color: burn }));
}

// ---------------------------------------------------------------- trails

export type ProtoTrail = 'papersnow' | 'kitetails' | 'comet2' | 'keeper';

/** A prototype trail: its own meshes in the world, fed the sled's place each frame. */
class TrailSketch {
  readonly root = new Group();
  private last = -1;
  private prev = new Vector3();
  private vel = new Vector3();
  private tick: (dt: number, pos: Vector3, vel: Vector3, heading: Vector3) => void = () => {};
  constructor(
    private rider: { root: Object3D },
    readonly id: ProtoTrail,
  ) {
    this.root.frustumCulled = false;
    const hook = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
    hook.frustumCulled = false;
    hook.onBeforeRender = () => this.step();
    // (An empty mesh still calls onBeforeRender only if it draws: a single degenerate triangle.)
    hook.geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    this.root.add(hook);
    this.build();
  }
  private step(): void {
    const t = performance.now() / 1000;
    if (t === this.last) return;
    const dt = this.last < 0 ? 1 / 60 : Math.min(0.1, t - this.last);
    this.last = t;
    const pos = new Vector3().setFromMatrixPosition(this.rider.root.matrixWorld);
    if (this.prev.lengthSq() > 0 && dt > 0) this.vel.copy(pos).sub(this.prev).divideScalar(dt);
    this.prev.copy(pos);
    const heading = this.vel.clone().setY(0);
    if (heading.lengthSq() < 0.01) heading.set(0, 0, -1);
    heading.normalize();
    this.tick(dt, pos, this.vel, heading);
  }
  private build(): void {
    const warm = new Color('#FFE6B0');
    if (this.id === 'papersnow') {
      // Cut-paper snowflakes: a six-pointed flake, palm-sized, fluttering and turning as it falls behind.
      const shape: number[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const b = a + Math.PI / 6;
        shape.push(0, 0, 0, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0, Math.cos(b) * 0.06, Math.sin(b) * 0.06, 0);
        shape.push(0, 0, 0, Math.cos(b) * 0.06, Math.sin(b) * 0.06, 0, Math.cos(a + Math.PI / 3) * 0.13, Math.sin(a + Math.PI / 3) * 0.13, 0);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(shape), 3));
      const N = 70;
      const inst = new InstancedMesh(g, new MeshBasicMaterial({ color: new Color('#FFF4DE'), side: DoubleSide }), N);
      inst.frustumCulled = false;
      this.root.add(inst);
      const ps = Array.from({ length: N }, () => ({ p: new Vector3(), v: new Vector3(), r: new Vector3(), w: new Vector3(), life: 0 }));
      let acc = 0;
      let at = 0;
      const m = new Matrix4();
      const q = new Quaternion();
      const e = new Euler();
      this.tick = (dt, pos, vel, h) => {
        acc += dt * 26;
        while (acc >= 1) {
          acc--;
          const p = ps[at++ % N];
          const side = rnd() < 0.5 ? -1 : 1;
          p.p.set(pos.x - h.z * side * 0.3 + h.x * 0.5, pos.y + 0.25, pos.z + h.x * side * 0.3 + h.z * 0.5);
          p.v.copy(vel).multiplyScalar(0.82).add(new Vector3(-h.z * side * (1 + rnd() * 1.6), 1.2 + rnd() * 1.4, h.x * side * (1 + rnd() * 1.6)));
          p.r.set(rnd() * 6, rnd() * 6, rnd() * 6);
          p.w.set((rnd() - 0.5) * 9, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9);
          p.life = 1.5;
        }
        for (let i = 0; i < N; i++) {
          const p = ps[i];
          p.life -= dt;
          if (p.life <= 0) {
            inst.setMatrixAt(i, m.makeScale(0, 0, 0));
            continue;
          }
          p.v.y -= 2.2 * dt;
          p.v.multiplyScalar(1 - 0.9 * dt);
          p.p.addScaledVector(p.v, dt);
          p.r.addScaledVector(p.w, dt);
          const s = Math.min(1, p.life * 2);
          inst.setMatrixAt(i, m.compose(p.p, q.setFromEuler(e.set(p.r.x, p.r.y, p.r.z)), new Vector3(s, s, s)));
        }
        inst.instanceMatrix.needsUpdate = true;
      };
    } else if (this.id === 'kitetails') {
      // Two strings of paper bows streaming three metres back off the stern, on a chain that trails and swings.
      const bow = new BufferGeometry();
      bow.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, -0.11, 0.07, 0, -0.11, -0.07, 0, 0, 0, 0, 0.11, -0.07, 0, 0.11, 0.07, 0]), 3));
      const N = 11;
      const mats = [new MeshBasicMaterial({ color: new Color('#FFF1D6'), side: DoubleSide }), new MeshBasicMaterial({ color: new Color('#FFD34D'), side: DoubleSide })];
      const strings = [-1, 1].map((sx) => {
        const pts = Array.from({ length: N }, () => new Vector3());
        const bows = Array.from({ length: N - 1 }, (_, i) => {
          const b = new Mesh(bow, mats[i % 2]);
          b.frustumCulled = false;
          this.root.add(b);
          return b;
        });
        return { sx, pts, bows, init: false };
      });
      const seg = 0.3;
      this.tick = (dt, pos, _vel, h) => {
        const t = performance.now() / 1000;
        const up = new Vector3(0, 1, 0);
        for (const s of strings) {
          const side = new Vector3(-h.z * s.sx, 0, h.x * s.sx);
          const anchor = new Vector3(pos.x, pos.y + 0.55, pos.z).addScaledVector(side, 0.22).addScaledVector(h, 0.85);
          if (!s.init) {
            for (let i = 0; i < N; i++) s.pts[i].copy(anchor).addScaledVector(h, -seg * i);
            s.init = true;
          }
          s.pts[0].copy(anchor);
          for (let i = 1; i < N; i++) {
            // Each bow chases the one before it, back down the run, swinging out to its side and lifting a little.
            const want = s.pts[i - 1].clone().addScaledVector(h, -seg).addScaledVector(side, 0.05 + 0.07 * Math.sin(t * 6 + i * 0.8)).addScaledVector(up, 0.02 + 0.03 * Math.sin(t * 4.3 + i));
            s.pts[i].lerp(want, Math.min(1, dt * 14));
            const d = s.pts[i].clone().sub(s.pts[i - 1]);
            s.pts[i].copy(s.pts[i - 1]).addScaledVector(d, seg / (d.length() || 1));
          }
          for (let i = 0; i < N - 1; i++) {
            const bw = s.bows[i];
            bw.position.copy(s.pts[i + 1]);
            const d = s.pts[i + 1].clone().sub(s.pts[i]).normalize();
            bw.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), d);
            bw.rotateX(0.9 + Math.sin(t * 9 + i) * 0.5);
            bw.scale.setScalar(1.25 - i * 0.035);
          }
        }
      };
    } else if (this.id === 'comet2') {
      // Two long light streaks off the runner tails that hang a second and a half: a long exposure.
      const N = 60;
      const ribbons = [-1, 1].map((sx) => {
        const g = new BufferGeometry();
        const pos = new Float32Array(N * 2 * 3);
        const col = new Float32Array(N * 2 * 3);
        const idx: number[] = [];
        for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
        g.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
        g.setAttribute('color', new BufferAttribute(col, 3).setUsage(DynamicDrawUsage));
        g.setIndex(idx);
        const m = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
        m.frustumCulled = false;
        this.root.add(m);
        return { sx, g, pos, col, hist: [] as { p: Vector3; t: number }[] };
      });
      const head = new Color('#FFD34D');
      const tail = new Color('#FFF1D6');
      this.tick = (_dt, p, _v, h) => {
        const t = performance.now() / 1000;
        for (const r of ribbons) {
          r.hist.unshift({ p: new Vector3(p.x - h.z * r.sx * 0.36 - h.x * 0.9, p.y + 0.12, p.z + h.x * r.sx * 0.36 - h.z * 0.9), t });
          while (r.hist.length > N || (r.hist.length && t - r.hist[r.hist.length - 1].t > 1.5)) r.hist.pop();
          for (let i = 0; i < N; i++) {
            const e = r.hist[Math.min(i, r.hist.length - 1)];
            const age = e ? Math.min(1, (t - e.t) / 1.5) : 1;
            const w = 0.07 * (1 - age * 0.6);
            const q = e ? e.p : p;
            r.pos.set([q.x - h.z * w, q.y + 0.01, q.z + h.x * w, q.x + h.z * w, q.y - 0.01, q.z - h.x * w], i * 6);
            const c = head.clone().lerp(tail, age).multiplyScalar((1 - age) * 1.4);
            r.col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
          }
          r.g.attributes.position.needsUpdate = true;
          r.g.attributes.color.needsUpdate = true;
        }
      };
    } else {
      // Keeper's Lantern: a paper lantern on a line, two metres behind and a metre up, its pool on the snow.
      const lamp = new Mesh(
        merge([
          part(new CylinderGeometry(0.13, 0.15, 0.3, 10), CREAM),
          part(new ConeGeometry(0.15, 0.08, 10), INK, { pos: [0, 0.19, 0] }),
          part(new CylinderGeometry(0.09, 0.12, 0.04, 10), INK, { pos: [0, -0.17, 0] }),
          ...[-0.08, 0, 0.08].map((dy) => part(new TorusGeometry(0.145, 0.008, 3, 14), shade(CREAM, 0.8), { pos: [0, dy, 0], rot: [Math.PI / 2, 0, 0] })),
        ]),
        new MeshBasicMaterial({ vertexColors: true }),
      );
      const heart = new Mesh(new SphereGeometry(0.08, 10, 8), new MeshBasicMaterial({ color: warm.clone().multiplyScalar(1.6), transparent: true, opacity: 0.9 }));
      lamp.add(heart);
      const pool = new Mesh(new PlaneGeometry(2.4, 2.4), new MeshBasicMaterial({ color: new Color('#FFC873'), transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2;
      const line = new Mesh(new CylinderGeometry(0.006, 0.006, 1, 4), new MeshBasicMaterial({ color: new Color('#5A4A36') }));
      for (const o of [lamp, pool, line]) {
        o.frustumCulled = false;
        this.root.add(o);
      }
      const at = new Vector3();
      let init = false;
      this.tick = (dt, p, _v, h) => {
        const want = new Vector3(p.x - h.x * 2.1, p.y + 1.15, p.z - h.z * 2.1);
        if (!init) at.copy(want);
        init = true;
        at.lerp(want, Math.min(1, dt * 6));
        const t = performance.now() / 1000;
        lamp.position.copy(at).add(new Vector3(Math.sin(t * 2.3) * 0.08, Math.sin(t * 3.1) * 0.05, 0));
        lamp.rotation.z = Math.sin(t * 2.3) * 0.12;
        pool.position.set(lamp.position.x, p.y + 0.03, lamp.position.z);
        const stern = new Vector3(p.x - h.x * 0.8, p.y + 0.75, p.z - h.z * 0.8);
        line.position.copy(stern).add(lamp.position).multiplyScalar(0.5);
        const d = lamp.position.clone().sub(stern);
        line.scale.set(1, d.length(), 1);
        line.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
      };
    }
  }
}

// ---------------------------------------------------------------- putting a look on

export interface Look {
  /** Today's hat id (garage.ts), or a proposal. */
  hat?: string;
  protoHat?: ProtoHat;
  scarf?: string;
  protoScarf?: ProtoScarf;
  /** Today's trail id (world.setTrail), or a proposal. */
  trail?: string;
  protoTrail?: ProtoTrail;
  /** Today's paint hex, or a proposed finish. */
  paint?: string;
  protoFinish?: ProtoFinish;
  /** The Pine Flyer's track, 0 to 5 tiers; and Spirit Flow's level for the fifth's inlay and the scarf's burn. */
  tiers?: number;
  flow?: number;
  /** The burn that keeps the knit's pattern (the proposal) rather than today's. */
  burnKeeps?: boolean;
  sled?: number;
}

let trail: TrailSketch | null = null;
let burnToday: ((k: number) => void) | null = null;

/**
 * Puts a look on the live rider (rider.ts Rider) in a scene: today's pieces through the rider's own setters, the
 * proposals through its parts. `setTrail` is world.setTrail for today's trails.
 */
export function applyLook(riderObj: object, scene: Object3D, look: Look, setTrail?: (id: string) => void): void {
  const rp = riderObj as unknown as RiderParts;
  clearExtras();
  if (trail) {
    trail.root.removeFromParent();
    trail = null;
  }
  // The sled and its paint first (setSled rebuilds the geometry, so the finish goes on after).
  rp.setPaint(look.paint ?? '');
  if (look.sled !== undefined) rp.setSled(look.sled);
  if (look.protoFinish) {
    const g = paintFinish(rp.sled.geometry.clone(), look.protoFinish);
    ownGeo.set(rp.sled, g);
    rp.sled.geometry = g;
  }
  if (look.tiers) {
    const parts = trackParts(look.tiers);
    if (parts.length) {
      const m = new Mesh(merge(parts), rp.sled.material as Material);
      m.castShadow = true;
      rp.sled.add(m);
      extras.add(m);
    }
    if (look.tiers >= 4) {
      const glow = new Mesh(new SphereGeometry(0.06, 10, 8), new MeshBasicMaterial({ color: new Color('#FFE2A0').multiplyScalar(1.5) }));
      glow.position.set(0.24, 0.8, 0.9);
      rp.sled.add(glow);
      extras.add(glow);
    }
    if (look.tiers >= 5) {
      const m = inlay(look.flow ?? 0);
      rp.sled.add(m);
      extras.add(m);
    }
  }
  // The hat.
  if (look.protoHat) {
    rp.hat = `proto:${look.protoHat}`;
    const g = protoHead(look.protoHat);
    rp.head.geometry = g;
    rp.crashHead.geometry = g;
  } else {
    if (rp.hat.startsWith('proto:')) rp.hat = '';
    rp.setHat(look.hat ?? 'beanie');
  }
  // The scarf (today's burn unless asked for the proposal's).
  const proto = Object.getPrototypeOf(rp) as { burnScarf: (k: number) => void };
  burnToday ??= proto.burnScarf;
  (rp as unknown as { burnScarf: (k: number) => void }).burnScarf = look.burnKeeps ? burnKeepingPattern : burnToday;
  rp.tails[0].seg = TAIL_SEG[0];
  rp.tails[1].seg = TAIL_SEG[1];
  rp.scarfLook = null;
  if (look.protoScarf) protoScarf(rp, look.protoScarf, scene);
  else rp.setScarf(scarfById(look.scarf ?? 'classic'));
  rp.burnShown = -1;
  // Spirit Flow pinned for a shot: the world sets the burn and the rim every frame from the run's own flow.
  const P = proto as unknown as { setBurn: (k: number) => void; setFlow: (f: number, p: number) => void };
  const inst = rp as unknown as Record<string, unknown>;
  delete inst.setBurn;
  delete inst.setFlow;
  if (look.flow !== undefined) {
    const burn = look.flow >= 2 ? Math.min(1, (look.flow - 1) / 3) : 0;
    const flow = look.flow;
    inst.setBurn = () => P.setBurn.call(rp, burn);
    inst.setFlow = () => P.setFlow.call(rp, flow, 0);
  }
  rp.setBurn(0);
  // The trail.
  setTrail?.(look.trail ?? 'powder');
  if (look.protoTrail) {
    trail = new TrailSketch(riderObj as { root: Object3D }, look.protoTrail);
    scene.add(trail.root);
  }
}

/** Every look the race-distance sheet shoots, by shelf: today's pieces and the proposals, mixed, each with a key. */
export const SHEET: Record<string, Array<{ key: string; name: string; today: boolean; look: Look }>> = {
  hats: [
    { key: 'beanie', name: 'Pom Beanie', today: true, look: { hat: 'beanie' } },
    { key: 'watch', name: 'Watch Cap', today: true, look: { hat: 'watch' } },
    { key: 'twinpom', name: 'Twin Pom', today: true, look: { hat: 'twinpom' } },
    { key: 'trapper', name: 'Trapper', today: true, look: { hat: 'trapper' } },
    { key: 'bobbles', name: 'Bobble Crown', today: true, look: { hat: 'bobbles' } },
    { key: 'chullo', name: 'Braided Chullo', today: true, look: { hat: 'chullo' } },
    { key: 'longcap', name: 'Long Knit Cap', today: true, look: { hat: 'longcap' } },
    { key: 'bobbles2', name: 'Bobble Crown, reworked', today: false, look: { protoHat: 'bobbles2' } },
    { key: 'crest', name: 'Crest Knit', today: false, look: { protoHat: 'crest' } },
    { key: 'muffs', name: 'Pom Muffs', today: false, look: { protoHat: 'muffs' } },
    { key: 'downcap', name: 'Down Cap', today: false, look: { protoHat: 'downcap' } },
    { key: 'twintails', name: 'Twin Tails', today: false, look: { protoHat: 'twintails' } },
    { key: 'floppeak', name: 'Flop Peak', today: false, look: { protoHat: 'floppeak' } },
  ],
  scarves: [
    { key: 'classic', name: 'Classic Knit', today: true, look: { scarf: 'classic' } },
    { key: 'creambar', name: 'Cream Bar', today: true, look: { scarf: 'creambar' } },
    { key: 'chunky', name: 'Chunky Rib', today: true, look: { scarf: 'chunky' } },
    { key: 'inkband', name: 'Ink Bands', today: true, look: { scarf: 'inkband' } },
    { key: 'streamer', name: 'Long Streamer', today: true, look: { scarf: 'streamer' } },
    { key: 'snowtip', name: 'Snow Tip', today: true, look: { scarf: 'snowtip' } },
    { key: 'chunky2', name: 'Chunky Rib, reworked', today: false, look: { protoScarf: 'chunky2' } },
    { key: 'streamer2', name: 'Long Streamer, reworked', today: false, look: { protoScarf: 'streamer2' } },
    { key: 'double', name: 'Double Wrap', today: false, look: { protoScarf: 'double' } },
    { key: 'pomtails', name: 'Pom Tails', today: false, look: { protoScarf: 'pomtails' } },
    { key: 'cape', name: "Wanderer's Cape", today: false, look: { protoScarf: 'cape' } },
    { key: 'veil', name: 'Night Veil', today: false, look: { protoScarf: 'veil' } },
  ],
  burn: [
    { key: 'inkband-flow-today', name: 'Ink Bands at full flow, today\'s burn', today: true, look: { scarf: 'inkband', flow: 4 } },
    { key: 'inkband-flow-keeps', name: 'Ink Bands at full flow, the burn that keeps the knit', today: false, look: { scarf: 'inkband', flow: 4, burnKeeps: true } },
    { key: 'creambar-flow-today', name: 'Cream Bar at full flow, today\'s burn', today: true, look: { scarf: 'creambar', flow: 4 } },
    { key: 'creambar-flow-keeps', name: 'Cream Bar at full flow, the burn that keeps the knit', today: false, look: { scarf: 'creambar', flow: 4, burnKeeps: true } },
  ],
  finishes: [
    { key: 'natural', name: 'Natural', today: true, look: {} },
    { key: 'pine', name: 'Pine Lacquer (flat)', today: true, look: { paint: '#3E7A5C' } },
    { key: 'midnight', name: 'Midnight (flat)', today: true, look: { paint: '#2A3570' } },
    { key: 'plum', name: 'Plum (flat)', today: true, look: { paint: '#7A4A8C' } },
    { key: 'ash', name: 'Basalt (flat)', today: true, look: { paint: '#3A3640' } },
    { key: 'pine2', name: 'Pine Lacquer, pinstriped', today: false, look: { protoFinish: 'pine2' } },
    { key: 'stars', name: 'Midnight Stars', today: false, look: { protoFinish: 'stars' } },
    { key: 'twotone', name: 'Plum Two-Tone', today: false, look: { protoFinish: 'twotone' } },
    { key: 'chequer', name: 'Finish Chequer', today: false, look: { protoFinish: 'chequer' } },
    { key: 'twinstripe', name: 'Twin Stripe', today: false, look: { protoFinish: 'twinstripe' } },
  ],
  sleds: [
    { key: 'stock', name: 'Pine Flyer, stock', today: true, look: {} },
    { key: 'tier2', name: 'Pine Flyer, runners and deck', today: false, look: { tiers: 2 } },
    { key: 'tier4', name: 'Pine Flyer, to its stern lamp', today: false, look: { tiers: 4 } },
    { key: 'tier5', name: 'Pine Flyer, every tier', today: false, look: { tiers: 5 } },
    { key: 'tier5-flow', name: 'Pine Flyer, every tier, at Spirit Flow', today: false, look: { tiers: 5, flow: 4 } },
  ],
  trails: [
    { key: 'powder', name: 'Fresh Powder', today: true, look: { trail: 'powder' } },
    { key: 'sparks', name: 'Lantern Sparks', today: true, look: { trail: 'sparks' } },
    { key: 'glints', name: 'Gold Glints', today: true, look: { trail: 'glints' } },
    { key: 'stardust', name: 'Stardust', today: true, look: { trail: 'stardust' } },
    { key: 'comet', name: 'Comet Tail', today: true, look: { trail: 'comet' } },
    { key: 'papersnow', name: 'Paper Snow', today: false, look: { protoTrail: 'papersnow' } },
    { key: 'kitetails', name: 'Kite Tails', today: false, look: { protoTrail: 'kitetails' } },
    { key: 'comet2', name: 'Comet Tail, reworked', today: false, look: { protoTrail: 'comet2' } },
    { key: 'keeper', name: "Keeper's Lantern", today: false, look: { protoTrail: 'keeper' } },
  ],
};

/** The pom's centre, for the page's close camera on a hat. */
export const POM = RIDER_POM;
export const KNOT = SCARF_KNOT;
