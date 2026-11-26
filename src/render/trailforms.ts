import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Euler, Group, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, CylinderGeometry, Object3D, Quaternion, Vector3 } from 'three';
import type { FlakeMotion, FlakeShape, TrailForm } from '../game/garage';

// Round 9, the shop lane: a garage trail's own shapes (G3), beside particles.ts's motes and spray. Round 6's trails
// were pale spray with warm specks in one of three motions, and two critics took four of today's six for one trail
// at race distance; these are shapes and behaviours in the air behind and beside the sled, never a mark on the snow
// (DECISIONS 392 keeps ART.md 4's one painted line): cut-paper flakes that flutter, petals that sail out flat, leaf
// that spirals up, ribbons of light that rise off the runners and bend with the carve, strings of bows flying off
// the stern, moths of light that circle, a lantern on a line. Warm roles only (garage.ts holds the colours to them).
//
// One system per trail worn, and only one is worn: flakes are one instanced draw, ribbons one, kites two (the bows
// and their lines), moths one, the keeper's lantern two. Each draws with a plain material in its own colours (paper
// is cream with a lit edge; what is light runs past 1 so the bloom takes it on Medium and up, and Low keeps its
// hue). Low and the phone get fewer flakes and shorter ribbons (setLow), never a broken High. What moves on its own
// is drawn after the temporal rebuild (world.ts adopts `movers`), so nothing smears.
//
// Also used by the garage's place (garagescene.ts), where the rider rides the yard's loop to show a trail.

/** What the sled is doing this frame, as a trail reads it (three.js space). */
export interface TrailFeed {
  pos: Vector3;
  vel: Vector3;
  /** The sled's heading (rider.ts's: -z ahead at 0). */
  heading: number;
  speed: number;
  grounded: boolean;
  /** Whether it leaves anything: riding, not crashed, not the title's reel. */
  active: boolean;
  time: number;
  /** The lens, so a ribbon turns its face to it. */
  eye: Vector3;
}

const UP = new Vector3(0, 1, 0);
const v1 = new Vector3();
const q1 = new Quaternion();
const e1 = new Euler();
const m1 = new Matrix4();
const s1 = new Vector3();

/** A flat cut shape (x across, y along, in the xy plane), its outline lit at the edge and its middle the body colour;
 *  `glow` runs the colours past 1. Built round its centre, unit size (about a metre across, scaled by the trail). */
function shapeGeometry(shape: FlakeShape, body: Color, edge: Color): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number], ca: Color, cb: Color, cc: Color): void => {
    pos.push(...a, ...b, ...c);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };
  /** A star-shaped outline round the centre: a fan, the centre in the body colour, the rim in the edge's. */
  const fan = (r: (a: number) => number, n: number, sx = 1, sy = 1, cy = 0): void => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      tri([0, cy, 0], [Math.cos(a0) * r(a0) * sx, cy + Math.sin(a0) * r(a0) * sy, 0], [Math.cos(a1) * r(a1) * sx, cy + Math.sin(a1) * r(a1) * sy, 0], body, edge, edge);
    }
  };
  /** An outline given as points (convex or star-shaped from the origin). */
  const poly = (pts: Array<[number, number]>): void => {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      tri([0, 0, 0], [p[0], p[1], 0], [q[0], q[1], 0], body, edge, edge);
    }
  };
  switch (shape) {
    case 'snowflake':
      // Six arms, a notch between each: cut paper.
      fan((a) => (Math.round((a / (Math.PI * 2)) * 12) % 2 === 0 ? 0.5 : 0.2), 12);
      break;
    case 'star':
      fan((a) => (Math.round((a / (Math.PI * 2)) * 10) % 2 === 0 ? 0.5 : 0.22), 10);
      break;
    case 'blossom':
      fan((a) => 0.32 + 0.18 * Math.cos(5 * a), 20);
      break;
    case 'sun':
      fan((a) => (Math.round((a / (Math.PI * 2)) * 16) % 2 === 0 ? 0.5 : 0.34), 16);
      break;
    case 'petal':
      poly([[0, -0.5], [0.2, -0.2], [0.24, 0.12], [0.12, 0.42], [0, 0.5], [-0.12, 0.42], [-0.24, 0.12], [-0.2, -0.2]]);
      break;
    case 'leaf':
      poly([[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]);
      break;
    case 'strip':
      poly([[-0.09, -0.5], [0.09, -0.46], [0.11, 0], [0.09, 0.48], [-0.09, 0.5], [-0.11, 0]]);
      break;
    case 'ember':
    case 'spark':
      poly([[0, -0.5], [0.22, 0], [0, 0.5], [-0.22, 0]]);
      break;
    case 'ray':
      poly([[0, -0.5], [0.08, 0], [0, 0.5], [-0.08, 0]]);
      break;
    case 'icicle':
      poly([[-0.14, 0.5], [0.14, 0.5], [0.04, -0.1], [0, -0.5], [-0.04, -0.1]]);
      break;
    case 'drop':
      fan((a) => 0.28 + 0.2 * Math.max(0, Math.sin(a)) ** 3, 14, 1, 1, -0.08);
      break;
    case 'tongue':
      poly([[0, 0.5], [0.12, 0.1], [0.22, -0.2], [0.1, -0.45], [0, -0.38], [-0.1, -0.45], [-0.22, -0.2], [-0.12, 0.1]]);
      break;
    case 'bow':
      tri([0, 0, 0], [-0.5, 0.3, 0], [-0.5, -0.3, 0], body, edge, edge);
      tri([0, 0, 0], [0.5, -0.3, 0], [0.5, 0.3, 0], body, edge, edge);
      break;
    case 'fan':
      for (let i = 0; i < 7; i++) {
        const a0 = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7;
        const a1 = Math.PI * 0.15 + ((i + 1) / 7) * Math.PI * 0.7;
        const c = i % 2 ? edge : body;
        tri([0, -0.2, 0], [Math.cos(a0) * 0.55, -0.2 + Math.sin(a0) * 0.55, 0], [Math.cos(a1) * 0.55, -0.2 + Math.sin(a1) * 0.55, 0], body, c, c);
      }
      break;
    case 'crescent':
      for (let i = 0; i < 10; i++) {
        const a0 = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
        const a1 = -Math.PI * 0.75 + ((i + 1) / 10) * Math.PI * 1.5;
        const o = (a: number): [number, number, number] => [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0];
        const n = (a: number): [number, number, number] => [Math.cos(a) * 0.32 + 0.12, Math.sin(a) * 0.36, 0];
        tri(o(a0), n(a0), o(a1), edge, body, edge);
        tri(n(a0), n(a1), o(a1), body, body, edge);
      }
      break;
    case 'hollow': {
      fan(() => 0.48, 14);
      const ink = new Color('#2A2230');
      for (const sx of [-1, 1]) {
        const ex = sx * 0.17;
        tri([ex - 0.07, 0.06, 0.01], [ex + 0.07, 0.06, 0.01], [ex, 0.2, 0.01], ink, ink, ink);
      }
      tri([-0.14, -0.14, 0.01], [0.14, -0.14, 0.01], [0, -0.06, 0.01], ink, ink, ink);
      break;
    }
    case 'crane':
      tri([0, 0, 0], [-0.5, 0.18, 0.1], [-0.05, 0.25, 0], body, edge, edge);
      tri([0, 0, 0], [0.05, 0.25, 0], [0.5, 0.18, 0.1], body, edge, edge);
      tri([0, -0.3, 0], [0.06, 0.2, 0], [-0.06, 0.2, 0], edge, body, body);
      tri([0, 0.2, 0], [0.05, 0.42, -0.1], [-0.03, 0.4, -0.12], body, edge, edge);
      break;
    case 'frond':
      for (let i = 0; i < 6; i++) {
        const y = -0.4 + i * 0.15;
        const w = 0.28 * (1 - i / 7);
        tri([0, y, 0], [w, y + 0.12, 0], [0, y + 0.15, 0], body, edge, body);
        tri([0, y, 0], [0, y + 0.15, 0], [-w, y + 0.12, 0], body, body, edge);
      }
      break;
    case 'ring': {
      // (Round 9, G6, the Old Run's Peal Rings: a hoop of light, its outer edge the brighter.)
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const o = (a: number): [number, number, number] => [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0];
        const n0 = (a: number): [number, number, number] => [Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0];
        tri(n0(a0), o(a0), o(a1), body, edge, edge);
        tri(n0(a0), o(a1), n0(a1), body, edge, body);
      }
      break;
    }
    case 'gull': {
      // (Gullhaven's Gulls: built in the bird's own frame, x across, y up, z back, the head toward -z, its wings bent
      // as a gull's are, up from the body and down to the tips, so from behind it is the gull's own M; the tips in
      // the edge colour.)
      const W = (sx: number): void => {
        const sh: [number, number, number] = [sx * 0.06, 0.02, -0.04];
        const el: [number, number, number] = [sx * 0.24, 0.12, 0.0];
        const tip: [number, number, number] = [sx * 0.5, -0.04, 0.12];
        const back: [number, number, number] = [sx * 0.05, 0.0, 0.12];
        const trail: [number, number, number] = [sx * 0.26, 0.08, 0.14];
        tri(sh, el, back, body, body, body);
        tri(el, trail, back, body, body, body);
        tri(el, tip, trail, body, edge, body);
      };
      W(-1);
      W(1);
      tri([0, 0.02, -0.2], [0.05, 0.0, 0.18], [-0.05, 0.0, 0.18], body, body, body);
      tri([0, 0.0, 0.14], [0.08, 0.0, 0.26], [-0.08, 0.0, 0.26], edge, body, body);
      break;
    }
    case 'pinwheel': {
      // (Gablefall's Pinwheels: four vanes round a pin, each a curled triangle half paper and half its colour.)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const r = (x: number, y: number): [number, number, number] => [x * c - y * s, x * s + y * c, 0];
        tri([0, 0, 0], r(0.5, 0), r(0.5, 0.46), body, body, edge);
        tri([0, 0, 0], r(0.5, 0.46), r(0.08, 0.16), edge, edge, edge);
      }
      break;
    }
    case 'ball':
    case 'lantern': {
      const g = shape === 'ball' ? new IcosahedronGeometry(0.5, 1) : new CylinderGeometry(0.34, 0.4, 0.8, 8, 1);
      const ng = g.index ? g.toNonIndexed() : g;
      const a = ng.getAttribute('position');
      for (let i = 0; i < a.count; i++) {
        pos.push(a.getX(i), a.getY(i), a.getZ(i));
        const c = shape === 'lantern' && Math.abs(a.getY(i)) > 0.39 ? edge : body;
        col.push(c.r, c.g, c.b);
      }
      break;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

/** How a motion launches a shape and moves it: life (s), gravity (m/s/s, down), drag (per s), how fast it spins, and
 *  whether it lies flat (spinning about its face) or tumbles. */
const MOTION: Record<FlakeMotion, { life: number; grav: number; drag: number; spin: number; flat: boolean }> = {
  flutter: { life: 1.9, grav: 1.7, drag: 0.7, spin: 7, flat: false },
  sail: { life: 1.6, grav: 0.5, drag: 0.9, spin: 9, flat: true },
  rise: { life: 2.2, grav: -0.7, drag: 0.8, spin: 3, flat: false },
  flick: { life: 0.6, grav: 7, drag: 0.4, spin: 10, flat: false },
  drop: { life: 0.55, grav: 9, drag: 0.2, spin: 1.5, flat: false },
  pop: { life: 1.4, grav: 1, drag: 1.0, spin: 2.5, flat: false },
  roll: { life: 1.3, grav: 0, drag: 0.5, spin: 9, flat: false },
  bob: { life: 1.7, grav: 0, drag: 0.3, spin: 0.8, flat: false },
  tumble: { life: 1.6, grav: 2.5, drag: 0.7, spin: 8, flat: false },
  hop: { life: 0.75, grav: 9, drag: 0.1, spin: 0, flat: false },
  // (Round 9, G6.) A peal rings out beside the stern facing the lens and widens as it falls back; a gull is thrown up
  // beside the rider, holds pace there in the wind with its wings beating, then peels away behind.
  peal: { life: 1.0, grav: 0, drag: 0, spin: 0, flat: false },
  hang: { life: 1.8, grav: 0, drag: 0, spin: 0, flat: false },
};

interface Flake {
  p: Vector3;
  v: Vector3;
  r: Vector3;
  w: Vector3;
  age: number;
  life: number;
  size: number;
  phase: number;
}

const rnd = (): number => Math.random();

/** A form's colour, run past 1 for a lit one. */
function hex(c: string, glow: boolean): Color {
  return new Color(c).multiplyScalar(glow ? 1.6 : 1);
}

export class TrailForms {
  readonly root = new Group();
  private form: TrailForm | null = null;
  private low = false;
  private acc = 0;
  // Flakes.
  private inst: InstancedMesh | null = null;
  private flakes: Flake[] = [];
  private next = 0;
  // Ribbons.
  private ribbons: Array<{ mesh: Mesh; pos: Float32Array; col: Float32Array; hist: Array<{ p: Vector3; t: number }> }> = [];
  // Kites.
  private kiteBows: InstancedMesh | null = null;
  private kiteLines: LineSegments | null = null;
  private kitePts: Vector3[][] = [];
  private kiteInit = false;
  // Moths and the keeper's lantern.
  private moths: InstancedMesh | null = null;
  private keeper: Group | null = null;
  private keeperLine: LineSegments | null = null;
  private keeperAt = new Vector3();
  private keeperInit = false;
  /** Where a lit trail's light is this frame (the keeper's lantern), for the world's local lights; null for none. */
  readonly light = new Vector3();
  lightOn = false;
  private readonly fwdV = new Vector3();
  private readonly sideV = new Vector3();

  constructor() {
    this.root.name = 'trailforms';
    this.root.frustumCulled = false;
  }

  /** What draws on its own, for the temporal rebuild's after-pass (world.ts adopts each). */
  get movers(): Object3D[] {
    return this.root.children;
  }

  /** Low and the phone: fewer flakes, shorter ribbons. */
  setLow(low: boolean): void {
    if (low === this.low) return;
    this.low = low;
    const f = this.form;
    this.form = null;
    this.set(f);
  }

  /** Puts a trail's form on (null: spray and motes only). */
  set(form: TrailForm | null): void {
    if (form === this.form) return;
    this.dispose();
    this.form = form;
    if (!form) return;
    if (form.kind === 'flakes') {
      const n = this.low ? 80 : 220;
      const geo = shapeGeometry(form.shape, hex(form.body, !!form.glow), hex(form.edge, !!form.glow));
      const mat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      this.inst = new InstancedMesh(geo, mat, n);
      this.inst.instanceMatrix.setUsage(DynamicDrawUsage);
      this.inst.frustumCulled = false;
      this.inst.count = 0;
      this.flakes = Array.from({ length: n }, () => ({ p: new Vector3(), v: new Vector3(), r: new Vector3(), w: new Vector3(), age: 9, life: 1, size: 1, phase: rnd() * 6 }));
      this.root.add(this.inst);
    } else if (form.kind === 'ribbons') {
      const N = this.low ? 24 : 44;
      for (let k = 0; k < 2; k++) {
        const g = new BufferGeometry();
        const pos = new Float32Array(N * 2 * 3);
        const col = new Float32Array(N * 2 * 3);
        const idx: number[] = [];
        for (let i = 0; i < N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
        g.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
        g.setAttribute('color', new BufferAttribute(col, 3).setUsage(DynamicDrawUsage));
        g.setIndex(idx);
        const mesh = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
        mesh.frustumCulled = false;
        this.root.add(mesh);
        this.ribbons.push({ mesh, pos, col, hist: [] });
      }
    } else if (form.kind === 'kites') {
      const per = this.low ? 7 : 11;
      const geo = shapeGeometry(form.shape, hex(form.body, false), hex(form.alt, false));
      this.kiteBows = new InstancedMesh(geo, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), 2 * (per - 1));
      this.kiteBows.instanceMatrix.setUsage(DynamicDrawUsage);
      this.kiteBows.frustumCulled = false;
      const lg = new BufferGeometry();
      lg.setAttribute('position', new BufferAttribute(new Float32Array(2 * (per - 1) * 2 * 3), 3).setUsage(DynamicDrawUsage));
      this.kiteLines = new LineSegments(lg, new LineBasicMaterial({ color: new Color('#F2E4C8') }));
      this.kiteLines.frustumCulled = false;
      this.kitePts = [0, 1].map(() => Array.from({ length: per }, () => new Vector3()));
      this.kiteInit = false;
      this.root.add(this.kiteBows, this.kiteLines);
    } else if (form.kind === 'moths') {
      this.moths = new InstancedMesh(new IcosahedronGeometry(0.14, 1), new MeshBasicMaterial({ color: hex(form.body, true) }), 3);
      this.moths.instanceMatrix.setUsage(DynamicDrawUsage);
      this.moths.frustumCulled = false;
      this.root.add(this.moths);
    } else if (form.kind === 'keeper') {
      const g = new Group();
      // Ribs: four bands of paper, palest at the waist, a small umber cap and foot (ART.md 14).
      const sides = this.low ? 8 : 12;
      for (let i = 0; i < 4; i++) {
        const m = (i + 0.5) / 4;
        const band = new Mesh(new CylinderGeometry(0.2 + 0.05 * Math.sin(((i + 1) / 4) * Math.PI), 0.2 + 0.05 * Math.sin((i / 4) * Math.PI), 0.118, sides), new MeshBasicMaterial({ color: new Color('#FFE7B0').multiplyScalar(1.25 + 0.45 * Math.sin(m * Math.PI)) }));
        band.position.y = -0.23 + 0.115 * (i + 0.5);
        g.add(band);
      }
      const ink = new MeshBasicMaterial({ color: new Color('#5A4030') });
      const cap = new Mesh(new CylinderGeometry(0.08, 0.2, 0.06, 10), ink);
      cap.position.y = 0.26;
      const foot = new Mesh(new CylinderGeometry(0.18, 0.1, 0.05, 10), ink);
      foot.position.y = -0.255;
      g.add(cap, foot);
      for (const o of g.children) o.frustumCulled = false;
      const lg = new BufferGeometry();
      lg.setAttribute('position', new BufferAttribute(new Float32Array(6), 3).setUsage(DynamicDrawUsage));
      this.keeperLine = new LineSegments(lg, new LineBasicMaterial({ color: new Color('#F2E4C8') }));
      this.keeperLine.frustumCulled = false;
      this.keeper = g;
      this.keeperInit = false;
      this.root.add(g, this.keeperLine);
    }
  }

  /** Empties what is in the air (a new run, a teleport). */
  clear(): void {
    for (const f of this.flakes) f.age = 9;
    if (this.inst) this.inst.count = 0;
    for (const r of this.ribbons) r.hist.length = 0;
    this.kiteInit = false;
    this.keeperInit = false;
  }

  dispose(): void {
    for (const o of [...this.root.children]) {
      o.removeFromParent();
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material as MeshBasicMaterial | undefined;
      mat?.dispose?.();
    }
    for (const c of this.keeper?.children ?? []) {
      (c as Mesh).geometry.dispose();
      ((c as Mesh).material as MeshBasicMaterial).dispose();
    }
    this.inst = null;
    this.flakes = [];
    this.ribbons = [];
    this.kiteBows = null;
    this.kiteLines = null;
    this.moths = null;
    this.keeper = null;
    this.keeperLine = null;
    this.lightOn = false;
  }

  update(dt: number, s: TrailFeed): void {
    const form = this.form;
    this.lightOn = false;
    if (!form || dt <= 0) return;
    // Ahead along the sled's travel (its heading when it is all but still), and across it.
    const hs = Math.hypot(s.vel.x, s.vel.z);
    const fwd = hs > 0.5 ? this.fwdV.set(s.vel.x / hs, 0, s.vel.z / hs) : this.fwdV.set(Math.sin(s.heading), 0, -Math.cos(s.heading));
    const side = this.sideV.set(-fwd.z, 0, fwd.x);
    if (form.kind === 'flakes') this.tickFlakes(dt, s, form, fwd, side);
    else if (form.kind === 'ribbons') this.tickRibbons(s, form, fwd, side);
    else if (form.kind === 'kites') this.tickKites(dt, s, fwd, side);
    else if (form.kind === 'moths') this.tickMoths(s);
    else this.tickKeeper(dt, s, fwd, side);
  }

  private tickFlakes(dt: number, s: TrailFeed, form: Extract<TrailForm, { kind: 'flakes' }>, fwd: Vector3, side: Vector3): void {
    const inst = this.inst;
    if (!inst) return;
    const M = MOTION[form.motion];
    // More with speed (none below a walk), fewer on Low.
    if (s.active && s.speed > 5) this.acc += form.rate * 1.8 * dt * Math.min(1.4, s.speed / 28) * (this.low ? 0.5 : 1);
    while (this.acc >= 1) {
      this.acc -= 1;
      const f = this.flakes[this.next];
      this.next = (this.next + 1) % this.flakes.length;
      this.launch(f, form.motion, s, fwd, side);
      // (A pinwheel faces the lens and spins about its pin, whatever its motion.)
      if (form.shape === 'pinwheel') {
        f.r.set(0, -Math.atan2(fwd.x, -fwd.z), 0);
        f.w.set(0, 0, (rnd() < 0.5 ? -1 : 1) * (11 + rnd() * 6));
      }
      f.life = M.life * (0.8 + 0.4 * rnd());
      f.size = form.size * 1.5 * (0.8 + 0.4 * rnd());
    }
    let n = 0;
    for (const f of this.flakes) {
      if (f.age >= f.life) continue;
      f.age += dt;
      if (f.age >= f.life) continue;
      const k = f.age / f.life;
      // (A gull holds pace beside the rider in the wind, then falls back and peels away to its side.)
      if (form.motion === 'hang') f.v.lerp(v1.copy(s.vel).multiplyScalar(k < 0.62 ? 1 : 0.84).addScaledVector(side, (f.phase > 3.14 ? 1 : -1) * (k < 0.62 ? 0 : 2.4)), Math.min(1, 2.6 * dt));
      f.v.y -= M.grav * dt;
      f.v.multiplyScalar(Math.max(0, 1 - M.drag * dt));
      f.p.addScaledVector(f.v, dt);
      f.r.addScaledVector(f.w, dt);
      // Solid, then gone (ART.md 12): a quick shrink over its last quarter; a pop grows in first; a drop bursts.
      let sc = k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
      if (form.motion === 'pop') sc *= Math.min(1, f.age / 0.12);
      if (form.motion === 'drop' && k > 0.7) sc = 1 + (k - 0.7) * 3;
      // (A peal widens as it rings out, then is gone.)
      if (form.motion === 'peal') sc = (0.35 + 1.05 * k) * (k > 0.85 ? Math.max(0, (1 - k) / 0.15) : 1);
      let y = f.p.y;
      if (form.motion === 'bob') y += Math.sin(s.time * 5 + f.phase) * 0.12;
      if (M.flat) e1.set(-Math.PI / 2 + Math.sin(f.phase) * 0.3, f.r.y, 0);
      else if (form.motion === 'hang') e1.set(0.18 * Math.sin(s.time * 2.1 + f.phase), -Math.atan2(fwd.x, -fwd.z), 0.22 * Math.sin(s.time * 1.7 + f.phase));
      else if (form.shape === 'pinwheel') e1.set(0, f.r.y, f.r.z);
      else e1.set(f.r.x, f.r.y, f.r.z);
      q1.setFromEuler(e1);
      s1.setScalar(f.size * sc);
      // (A gull's wings beat: the bird's height is its wings' bend, flattened and lifted.)
      if (form.motion === 'hang') s1.y *= 0.4 + 1.1 * Math.abs(Math.sin(s.time * 7 + f.phase * 2));
      inst.setMatrixAt(n++, m1.compose(v1.set(f.p.x, y, f.p.z), q1, s1));
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
  }

  private launch(f: Flake, motion: FlakeMotion, s: TrailFeed, fwd: Vector3, side: Vector3): void {
    const sd = rnd() < 0.5 ? -1 : 1;
    const back = 0.6 + rnd() * 0.3;
    const p = s.pos;
    f.age = 0;
    f.phase = rnd() * 6.28;
    f.r.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
    const sp = MOTION[motion].spin;
    f.w.set((rnd() - 0.5) * sp, (rnd() - 0.5) * sp, (rnd() - 0.5) * sp);
    const vx = s.vel.x;
    const vy = s.vel.y;
    const vz = s.vel.z;
    switch (motion) {
      case 'flutter':
        f.p.set(p.x - fwd.x * back + side.x * sd * 0.35, p.y + 0.45, p.z - fwd.z * back + side.z * sd * 0.35);
        f.v.set(vx * 0.97 + side.x * sd * (2.2 + rnd() * 2.2), vy * 0.97 + 2.2 + rnd() * 1.6, vz * 0.97 + side.z * sd * (2.2 + rnd() * 2.2));
        break;
      case 'sail':
        f.p.set(p.x + side.x * sd * 0.4, p.y + 0.35, p.z + side.z * sd * 0.4);
        f.v.set(vx * 0.97 + side.x * sd * (3.4 + rnd() * 2.2), vy * 0.97 + 1.4 + rnd(), vz * 0.97 + side.z * sd * (3.4 + rnd() * 2.2));
        f.w.set(0, (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 6), 0);
        break;
      case 'rise':
        f.p.set(p.x - fwd.x * back + side.x * sd * 0.25 * rnd(), p.y + 0.3 + rnd() * 0.3, p.z - fwd.z * back + side.z * sd * 0.25 * rnd());
        f.v.set(vx * 0.96 + side.x * sd * (0.8 + rnd() * 1.4), vy * 0.96 + 1.8 + rnd(), vz * 0.96 + side.z * sd * (0.8 + rnd() * 1.4));
        break;
      case 'flick':
        f.p.set(p.x + side.x * sd * 0.3 - fwd.x * 0.5, p.y + 0.08, p.z + side.z * sd * 0.3 - fwd.z * 0.5);
        f.v.set(vx * 0.97 + side.x * sd * (2.2 + rnd() * 1.8), vy * 0.97 + 2.8 + rnd() * 1.6, vz * 0.97 + side.z * sd * (2.2 + rnd() * 1.8));
        break;
      case 'drop':
        f.p.set(p.x - fwd.x * 0.7 + side.x * sd * 0.25, p.y + 0.5, p.z - fwd.z * 0.7 + side.z * sd * 0.25);
        f.v.set(vx * 0.97, vy * 0.97 - 0.4, vz * 0.97);
        f.r.set(0, rnd() * 6.28, 0);
        break;
      case 'pop':
        f.p.set(p.x + side.x * sd * 0.5, p.y + 0.35, p.z + side.z * sd * 0.5);
        f.v.set(vx * 0.97 + side.x * sd * (2.8 + rnd() * 1.6), vy * 0.97 + 1.6 + rnd(), vz * 0.97 + side.z * sd * (2.8 + rnd() * 1.6));
        break;
      case 'roll':
        f.p.set(p.x + side.x * sd * (0.45 + rnd() * 0.3), p.y + 0.12, p.z + side.z * sd * (0.45 + rnd() * 0.3));
        f.v.set(vx * 0.97 + side.x * sd * (0.9 + rnd() * 0.8), vy * 0.97, vz * 0.97 + side.z * sd * (0.9 + rnd() * 0.8));
        f.w.copy(side).multiplyScalar(-(4 + rnd() * 4));
        break;
      case 'bob':
        f.p.set(p.x - fwd.x * (1 + rnd() * 0.5) + side.x * sd * (0.6 + rnd() * 0.4), p.y + 0.8 + rnd() * 0.4, p.z - fwd.z * (1 + rnd() * 0.5) + side.z * sd * (0.6 + rnd() * 0.4));
        f.v.set(vx * 0.985, vy * 0.985, vz * 0.985);
        f.r.set(0, -Math.atan2(fwd.x, -fwd.z) + Math.PI, 0);
        break;
      case 'tumble':
        f.p.set(p.x - fwd.x * back, p.y + 0.6, p.z - fwd.z * back);
        f.v.set(vx * 0.97 + side.x * sd * (1.6 + rnd() * 1.6), vy * 0.97 + 1.8 + rnd(), vz * 0.97 + side.z * sd * (1.6 + rnd() * 1.6));
        f.w.copy(side).multiplyScalar(8 + rnd() * 4).setY((rnd() - 0.5) * 3);
        break;
      case 'hop':
        f.p.set(p.x + side.x * sd * (1.3 + rnd() * 0.5) + fwd.x * 0.6, p.y + 0.15, p.z + side.z * sd * (1.3 + rnd() * 0.5) + fwd.z * 0.6);
        f.v.set(vx, vy + 3.2, vz);
        break;
      case 'peal':
        // Beside the stern, low, facing the lens; carried at nearly the sled's speed, so it falls back slowly as it widens.
        f.p.set(p.x - fwd.x * 0.5 + side.x * sd * (0.75 + rnd() * 0.2), p.y + 0.45 + rnd() * 0.2, p.z - fwd.z * 0.5 + side.z * sd * (0.75 + rnd() * 0.2));
        f.v.set(vx * 0.95 + side.x * sd * 0.5, vy * 0.95 + 0.3, vz * 0.95 + side.z * sd * 0.5);
        f.r.set(0, -Math.atan2(fwd.x, -fwd.z), 0);
        f.w.set(0, 0, 0);
        break;
      case 'hang':
        // Thrown up and out to one side of the rider (the side kept in its phase, for the peel away).
        f.phase = sd > 0 ? 3.5 + rnd() * 2.5 : rnd() * 3;
        f.p.set(p.x - fwd.x * 0.3 + side.x * sd * 0.5, p.y + 0.6, p.z - fwd.z * 0.3 + side.z * sd * 0.5);
        f.v.set(vx + side.x * sd * (2.2 + rnd() * 1.2), vy + 2.2 + rnd() * 1.2, vz + side.z * sd * (2.2 + rnd() * 1.2));
        break;
    }
  }

  private tickRibbons(s: TrailFeed, form: Extract<TrailForm, { kind: 'ribbons' }>, fwd: Vector3, side: Vector3): void {
    const head = hex(form.head, true);
    const tail = hex(form.tail, true);
    const c = new Color();
    // (They stream with speed: folded down to nothing at a stop, at full length from a cruise.)
    const k0 = Math.min(1, Math.max(0, (s.speed - 4) / 14)) * (s.active ? 1 : 0);
    this.ribbonK += (k0 - this.ribbonK) * 0.08;
    const K = this.ribbonK;
    for (let k = 0; k < this.ribbons.length; k++) {
      const r = this.ribbons[k];
      const sx = k === 0 ? -1 : 1;
      const N = r.pos.length / 6;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        // Back off the runner's tail, up in an arc and out beside the rider, waving harder toward the tip.
        // (From the chase lens anything laid back down the run lies toward the lens's foot as a stripe: these climb.)
        const back = (u * 0.5 + u * u * 1.1) * K;
        const out = (0.3 + u * 0.55 + u * u * 0.6 + Math.sin(s.time * 5 + u * 5 + k) * 0.22 * u) * K + 0.3 * (1 - K);
        const up = 0.14 + (Math.sin(u * Math.PI * 0.62) * 1.9 + Math.sin(s.time * 6.3 + u * 4 + k * 2) * 0.16 * u) * K;
        const px = s.pos.x - fwd.x * (0.7 + back) + side.x * sx * out;
        const py = s.pos.y + up;
        const pz = s.pos.z - fwd.z * (0.7 + back) + side.z * sx * out;
        // Its face to the lens: across = the run of the streamer crossed with the way to the eye.
        const tx = -fwd.x * 0.35 + side.x * sx * 0.3;
        const ty = 1;
        const tz = -fwd.z * 0.35 + side.z * sx * 0.3;
        const ex = s.eye.x - px;
        const ey = s.eye.y - py;
        const ez = s.eye.z - pz;
        let ax = ty * ez - tz * ey;
        let ay = tz * ex - tx * ez;
        let az = tx * ey - ty * ex;
        const al = Math.hypot(ax, ay, az) || 1;
        const w = 0.07 * (1 - 0.8 * u) + 0.008;
        ax = (ax / al) * w;
        ay = (ay / al) * w;
        az = (az / al) * w;
        r.pos[i * 6] = px - ax;
        r.pos[i * 6 + 1] = py - ay;
        r.pos[i * 6 + 2] = pz - az;
        r.pos[i * 6 + 3] = px + ax;
        r.pos[i * 6 + 4] = py + ay;
        r.pos[i * 6 + 5] = pz + az;
        c.copy(head).lerp(tail, Math.min(1, u * 1.4)).lerp(this.cream, Math.max(0, u - 0.6) * 1.5);
        r.col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
      }
      const g = r.mesh.geometry;
      (g.getAttribute('position') as BufferAttribute).needsUpdate = true;
      (g.getAttribute('color') as BufferAttribute).needsUpdate = true;
      r.mesh.visible = K > 0.03;
    }
  }

  private ribbonK = 0;
  private readonly cream = new Color('#FFF4DE').multiplyScalar(1.3);

  private tickKites(dt: number, s: TrailFeed, fwd: Vector3, side: Vector3): void {
    const bows = this.kiteBows;
    const lines = this.kiteLines;
    if (!bows || !lines) return;
    const seg = 0.34;
    const lp = lines.geometry.getAttribute('position') as BufferAttribute;
    let n = 0;
    let l = 0;
    for (let k = 0; k < 2; k++) {
      const pts = this.kitePts[k];
      const sx = k === 0 ? -1 : 1;
      // From the stern's post height, flying up and back, each bow chasing the one before it and swinging out to its
      // side: high enough to read beside the rider from the chase lens, never along the ruts.
      const ax = s.pos.x - fwd.x * 0.8 + side.x * sx * 0.25;
      const ay = s.pos.y + 1.1;
      const az = s.pos.z - fwd.z * 0.8 + side.z * sx * 0.25;
      if (!this.kiteInit) for (let i = 0; i < pts.length; i++) pts[i].set(ax - fwd.x * seg * i, ay + 0.1 * i, az - fwd.z * seg * i);
      pts[0].set(ax, ay, az);
      for (let i = 1; i < pts.length; i++) {
        const swing = Math.sin(s.time * 3.2 + i * 0.55 + k * 1.7) * (0.12 + 0.05 * i);
        const wx = pts[i - 1].x - fwd.x * seg * 0.25 + side.x * (sx * 0.3 + swing);
        const wy = pts[i - 1].y + 0.24 + Math.sin(s.time * 4.1 + i) * 0.05;
        const wz = pts[i - 1].z - fwd.z * seg * 0.25 + side.z * (sx * 0.3 + swing);
        pts[i].lerp(v1.set(wx, wy, wz), Math.min(1, dt * 12));
        const d = v1.subVectors(pts[i], pts[i - 1]);
        const dl = d.length() || 1;
        pts[i].copy(pts[i - 1]).addScaledVector(d, seg / dl);
      }
      for (let i = 1; i < pts.length; i++) {
        const d = v1.subVectors(pts[i], pts[i - 1]).normalize();
        q1.setFromUnitVectors(UP, d);
        e1.set(0, 0, Math.sin(s.time * 9 + i) * 0.6);
        q1.multiply(new Quaternion().setFromEuler(e1));
        s1.setScalar(0.34 - i * 0.01);
        bows.setMatrixAt(n++, m1.compose(pts[i], q1, s1));
        lp.setXYZ(l++, pts[i - 1].x, pts[i - 1].y, pts[i - 1].z);
        lp.setXYZ(l++, pts[i].x, pts[i].y, pts[i].z);
      }
    }
    this.kiteInit = true;
    bows.count = n;
    bows.instanceMatrix.needsUpdate = true;
    lp.needsUpdate = true;
  }

  private tickMoths(s: TrailFeed): void {
    const m = this.moths;
    if (!m) return;
    for (let i = 0; i < 3; i++) {
      const a = s.time * (2.6 + i * 0.4) + (i * Math.PI * 2) / 3;
      const r = 1.25 + 0.2 * Math.sin(s.time * 1.7 + i);
      m.setMatrixAt(i, m1.makeTranslation(s.pos.x + Math.cos(a) * r, s.pos.y + 1.35 + Math.sin(s.time * 3 + i * 2) * 0.3, s.pos.z + Math.sin(a) * r));
    }
    m.count = 3;
    m.instanceMatrix.needsUpdate = true;
  }

  private tickKeeper(dt: number, s: TrailFeed, fwd: Vector3, side: Vector3): void {
    const g = this.keeper;
    const line = this.keeperLine;
    if (!g || !line) return;
    // Where it rides, in the sled's frame (back, out, up), on a soft spring there, and swaying on its line.
    if (!this.keeperInit) this.keeperAt.set(0.4, 1.25, 1.5);
    this.keeperInit = true;
    this.keeperAt.lerp(v1.set(0.4 + Math.min(0.5, s.speed * 0.012), 1.25, 1.5), Math.min(1, dt * 4));
    const o = this.keeperAt;
    g.position.set(s.pos.x - fwd.x * o.x + side.x * o.y, s.pos.y + o.z, s.pos.z - fwd.z * o.x + side.z * o.y).add(v1.set(Math.sin(s.time * 2.3) * 0.08, Math.sin(s.time * 3.1) * 0.05, 0));
    g.rotation.z = Math.sin(s.time * 2.3) * 0.12;
    const lp = line.geometry.getAttribute('position') as BufferAttribute;
    lp.setXYZ(0, s.pos.x - fwd.x * 0.75 + side.x * 0.3, s.pos.y + 0.9, s.pos.z - fwd.z * 0.75 + side.z * 0.3);
    lp.setXYZ(1, g.position.x, g.position.y + 0.22, g.position.z);
    lp.needsUpdate = true;
    this.light.copy(g.position);
    this.lightOn = true;
  }
}
