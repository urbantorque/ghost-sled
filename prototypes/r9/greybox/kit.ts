import * as THREE from 'three';

// Round 9's greybox (the concepts lane): one small kit that draws a mountain in flat greys from the chase camera's
// height and lens, so a concept and one of the five stand side by side on equal terms. Greyscale is the point: the
// shape has to carry the difference. Dev only: nothing here is in the game's boot path.
//
// Coordinates are the sim's (+z downhill, +x the rider's right facing downhill, +y up); the kit turns them into
// three.js space (x, y, -z) as the game's world does.

export const FRAME_W = 1280;
export const FRAME_H = 720;

/** A view: where the rider is, and how the chase lens frames it. */
export interface View {
  key: string;
  /** What the frame shows, in a few words (for the owner's page, never drawn in the frame). */
  name: string;
  /** Metres down the course. */
  z: number;
  /** Metres off the line the rider rides (+ right). */
  off?: number;
  /** Metres over the ground (airborne). */
  air?: number;
  /** Speed, m/s: sets the lens (62 to 79 degrees) as the game's speed curve does. */
  speed?: number;
  /** Degrees the lens rolls (a wall ride leans the horizon). */
  roll?: number;
  /** How far behind the rider the lens sits, and how far the lens is moved toward the corridor's middle. */
  back?: number;
  inward?: number;
  /** Metres the lens stands higher than the chase's own height (the big-air vista), the row the rider sits on (NDC y,
   *  -0.30 by default), and degrees the lens turns off the line toward a place (+ right). */
  up?: number;
  row?: number;
  turn?: number;
}

export interface Look {
  /** Grey values 0 to 1: the sky's zenith and horizon, the fog's colour and its near and far distances. */
  zenith: number;
  horizon: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  /** The key light: bearing off the fall line (degrees, + to the right), elevation, strength; the fill. */
  sunAz: number;
  sunEl: number;
  sun: number;
  ambient: number;
}

export interface SceneDef {
  id: string;
  title: string;
  /** The ground the sled rides and the world stands on. */
  ground(x: number, z: number): number;
  /** The corridor's middle (the terrain is sampled about it) and the safe line. */
  centre(z: number): number;
  line(z: number): number;
  /** Metres either side of the centre the terrain is drawn, and how far down the run. */
  half: number;
  ahead: number;
  /** Grey for a ground triangle, or null for the default (snow, and rock where it is steep). */
  paint?(x: number, y: number, z: number, ny: number): number | null;
  /** What stands on and beside the run between z0 and z1. */
  props(k: Kit, z0: number, z1: number): void;
  /** The far plane, built about the lens. */
  far?(k: Kit, cam: { x: number; y: number; z: number }): void;
  look: Look;
  views: View[];
}

// ------------------------------------------------------------------ small maths

export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function noise1(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return (hash(seed, i) * (1 - u) + hash(seed, i + 1) * u) * 2 - 1;
}

export function noise2(seed: number, x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(seed, i, j);
  const b = hash(seed, i + 1, j);
  const c = hash(seed, i, j + 1);
  const d = hash(seed, i + 1, j + 1);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

export const smooth = (a: number, b: number, t: number): number => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ------------------------------------------------------------------ the kit: flat grey primitives, merged

/** Collects flat-shaded grey pieces (in the sim's coordinates) and merges them into one mesh. */
export class Kit {
  private pos: number[] = [];
  private col: number[] = [];
  private readonly tmp = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  /** Adds a three.js geometry, placed by a matrix given in sim space. */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, grey: number): void {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute('position');
    const a = new THREE.Vector3();
    // Flipping z mirrors a piece, so each triangle's winding is turned back (0, 2, 1) to keep its outside out.
    for (let t = 0; t + 2 < p.count; t += 3) {
      for (const i of [t, t + 2, t + 1]) {
        a.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m);
        this.pos.push(a.x, a.y, -a.z);
        this.col.push(grey, grey, grey);
      }
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  /** A matrix from a place, a yaw (about y, + turns toward +x), a pitch and a roll, and a scale, in sim space. */
  place(x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1, pitch = 0, roll = 0): THREE.Matrix4 {
    // (Sim space is left-handed against three's once z is flipped, so a yaw toward +x is a negative turn here
    // before the flip; the flip in add() makes it right again.)
    this.e.set(pitch, yaw, roll, 'YXZ');
    this.q.setFromEuler(this.e);
    return this.tmp.compose(this.v.set(x, y, z), this.q, this.s.set(sx, sy, sz));
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, grey: number, yaw = 0, pitch = 0, roll = 0): void {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    this.add(g, this.place(x, y, z, yaw, w, h, d, pitch, roll), grey);
  }

  /** A cylinder standing on (x, y, z). */
  cyl(x: number, y: number, z: number, rTop: number, rBot: number, h: number, grey: number, seg = 7, yaw = 0, pitch = 0, roll = 0): void {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
    g.translate(0, h / 2, 0);
    this.add(g, this.place(x, y, z, yaw, 1, 1, 1, pitch, roll), grey);
  }

  cone(x: number, y: number, z: number, r: number, h: number, grey: number, seg = 7, yaw = 0): void {
    const g = new THREE.ConeGeometry(r, h, seg, 1);
    g.translate(0, h / 2, 0);
    this.add(g, this.place(x, y, z, yaw), grey);
  }

  sphere(x: number, y: number, z: number, r: number, grey: number, seg = 7, sy = 1): void {
    const g = new THREE.IcosahedronGeometry(1, seg > 6 ? 1 : 0);
    this.add(g, this.place(x, y, z, 0, r, r * sy, r), grey);
  }

  /** A round bar from one point to another (a log, a beam, a cable). */
  bar(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, grey: number, seg = 6): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    // Lay the cylinder's axis (y) along the bar: in sim space, then add() flips z.
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1));
    this.add(g, m, grey);
  }

  /** A gabled house on (x, y, z): w across the run (x), d along it (z), walls h high, the roof rising rh more. The
   *  ridge runs along z unless `across`. */
  house(x: number, y: number, z: number, w: number, d: number, h: number, rh: number, grey: number, roof: number, across = false, yaw = 0): void {
    this.box(x, y, z, w, h, d, grey, yaw);
    const shape = new THREE.Shape();
    const a = across ? d : w;
    shape.moveTo(-a / 2 - 0.4, 0);
    shape.lineTo(a / 2 + 0.4, 0);
    shape.lineTo(0, rh);
    shape.lineTo(-a / 2 - 0.4, 0);
    const len = (across ? w : d) + 0.6;
    const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    this.add(g, this.place(x, y + h, z, yaw + (across ? Math.PI / 2 : 0)), roof);
  }

  /** A faceted range or peak: a cone of few sides. */
  peak(x: number, y: number, z: number, r: number, h: number, grey: number, seg = 5, yaw = 0, sx = 1): void {
    const g = new THREE.ConeGeometry(1, 1, seg, 1);
    g.translate(0, 0.5, 0);
    this.add(g, this.place(x, y, z, yaw, r * sx, h, r), grey);
  }

  /** A flat quad (sea, a lake, a cloud sheet) at height y. */
  sheet(x0: number, z0: number, x1: number, z1: number, y: number, grey: number): void {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    this.add(g, this.place((x0 + x1) / 2, y, (z0 + z1) / 2, 0, Math.abs(x1 - x0), 1, Math.abs(z1 - z0)), grey);
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  /** Every piece so far as one flat-shaded mesh. */
  mesh(shadows = true): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, greyMaterial());
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    this.pos = [];
    this.col = [];
    return m;
  }
}

let shared: THREE.MeshLambertMaterial | null = null;
export function greyMaterial(): THREE.MeshLambertMaterial {
  if (!shared) {
    shared = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // (An open heightfield casts from both faces, or a cliff or a wall would throw no shadow on the snow under it.)
    shared.shadowSide = THREE.DoubleSide;
  }
  return shared;
}

// ------------------------------------------------------------------ the ground

/** Offsets across the run: fine near the line, coarser out to `half`. */
function offsets(half: number): number[] {
  const out = [0];
  let u = 0;
  let step = 0.45;
  while (u < half) {
    u += step;
    out.push(u);
    step = Math.min(step * 1.045, 9);
  }
  return [...out.slice(1).map((v) => -v).reverse(), ...out];
}

/** Metres down the run from z0: fine near the lens, coarser far off. */
function rows(z0: number, ahead: number): number[] {
  const out: number[] = [];
  let z = z0;
  let step = 0.5;
  while (z < z0 + ahead) {
    out.push(z);
    z += step;
    step = Math.min(step * 1.018, 10);
  }
  out.push(z);
  return out;
}

/** The ground as flat grey triangles, sampled about the centre line. */
export function terrain(def: SceneDef, z0: number): THREE.Mesh {
  const us = offsets(def.half);
  const zs = rows(z0, def.ahead);
  const nu = us.length;
  const P: number[] = new Array(us.length * zs.length * 3);
  for (let j = 0; j < zs.length; j++) {
    const z = zs[j];
    const c = def.centre(z);
    for (let i = 0; i < nu; i++) {
      const x = c + us[i];
      const k = (j * nu + i) * 3;
      P[k] = x;
      P[k + 1] = def.ground(x, z);
      P[k + 2] = z;
    }
  }
  const pos: number[] = [];
  const col: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = (p: number, q: number, r: number): void => {
    // In three's space (z flipped), counter-clockwise from above.
    const ax = P[p], ay = P[p + 1], az = -P[p + 2];
    const bx = P[q], by = P[q + 1], bz = -P[q + 2];
    const cx = P[r], cy = P[r + 1], cz = -P[r + 2];
    a.set(bx - ax, by - ay, bz - az);
    b.set(cx - ax, cy - ay, cz - az);
    n.crossVectors(a, b).normalize();
    const ny = Math.abs(n.y);
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = -(az + bz + cz) / 3;
    let g = def.paint ? def.paint(mx, my, mz, ny) : null;
    if (g === null) g = ny < 0.6 ? 0.5 : ny < 0.72 ? 0.68 : 0.9;
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    col.push(g, g, g, g, g, g, g, g, g);
  };
  for (let j = 0; j + 1 < zs.length; j++) {
    for (let i = 0; i + 1 < nu; i++) {
      const p00 = (j * nu + i) * 3;
      const p10 = (j * nu + i + 1) * 3;
      const p01 = ((j + 1) * nu + i) * 3;
      const p11 = ((j + 1) * nu + i + 1) * 3;
      tri(p00, p10, p11);
      tri(p00, p11, p01);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, greyMaterial());
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------------ the rider, the lens, the light

/** The rider on its sled, as a few grey blocks at the game's size (drawn 1.2 times its model, ART.md 5). */
function rider(def: SceneDef, x: number, y: number, z: number, heading: number): THREE.Object3D {
  const k = new Kit();
  // Sled, legs, coat, head, hood: the coat a dark value (ink navy), the sled a mid one.
  k.box(0, 0.05, 0, 0.62, 0.16, 1.35, 0.5);
  k.box(0, 0.21, 0.18, 0.5, 0.22, 0.7, 0.3);
  k.cyl(0, 0.3, -0.18, 0.2, 0.27, 0.58, 0.22, 8);
  k.sphere(0, 1.06, -0.2, 0.22, 0.3, 7);
  k.sphere(0, 1.17, -0.24, 0.17, 0.85, 7, 0.8);
  const mesh = k.mesh(true);
  const o = new THREE.Object3D();
  o.add(mesh);
  o.scale.setScalar(1.2);
  // Stand it on the ground's normal, turned to its heading.
  const e = 0.3;
  const gx = (def.ground(x + e, z) - def.ground(x - e, z)) / (2 * e);
  const gz = (def.ground(x, z + e) - def.ground(x, z - e)) / (2 * e);
  const nrm = new THREE.Vector3(-gx, 1, gz).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading);
  o.quaternion.copy(tilt).multiply(yaw);
  o.position.set(x, y, -z);
  return o;
}

/** The chase lens's vertical field of view for a speed (src/render/speedfeel.ts chaseFov). */
export function chaseFov(v: number): number {
  const c01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
  const s01 = (t: number): number => {
    const k = c01(t);
    return k * k * (3 - 2 * k);
  };
  const speedK = c01((v - 8) / 38);
  const fastK = 0.6 * s01((v - 15) / 13) + 0.4 * Math.pow(c01((v - 28) / 18), 1.15);
  return 62 + 3 * speedK + 14 * fastK;
}

/** Builds and draws one view. Returns the triangles drawn (for the notes). */
export function renderView(renderer: THREE.WebGLRenderer, def: SceneDef, view: View): number {
  const scene = new THREE.Scene();
  const L = def.look;
  const sky = new THREE.Color().setScalar(L.horizon);
  scene.fog = new THREE.Fog(new THREE.Color().setScalar(L.fog), L.fogNear, L.fogFar);

  const z = view.z;
  const off = view.off ?? 0;
  const rx = def.line(z) + off;
  const ry = def.ground(rx, z) + (view.air ?? 0);
  // The rider's way: along the line here, eased toward where it goes in 1.5 s.
  const dir = Math.atan2(def.line(z + 4) + off - (def.line(z - 4) + off), 8);
  const v = view.speed ?? 30;
  const ahead = Math.max(20, v * 1.5);
  const toward = Math.atan2(def.line(z + ahead) + off - rx, ahead);
  const yaw = dir + (toward - dir) * 0.33 + ((view.turn ?? 0) * Math.PI) / 180;

  // The lens: behind the rider, a little to the corridor's middle, 1.5 m over the snow under it (ART.md 8).
  const back = view.back ?? 5;
  let cx = rx - Math.sin(dir) * back;
  const cz = z - Math.cos(dir) * back;
  const towardMid = Math.sign(def.centre(cz) - cx) || 1;
  cx += towardMid * (view.inward ?? 0.35);
  const cy = Math.max(def.ground(cx, cz) + 1.5, ry + 1.3) + (view.up ?? 0);
  const fov = chaseFov(v);
  const camera = new THREE.PerspectiveCamera(fov, FRAME_W / FRAME_H, 0.3, 30000);
  camera.position.set(cx, cy, -cz);
  // Aim so the rider's middle sits at the game's row (src/render/speedfeel.ts chaseRow: -0.30 at 30 m/s).
  const horiz = Math.hypot(rx - cx, z - cz);
  const thetaR = Math.atan2(cy - (ry + 0.75), horiz);
  const pitch = thetaR - Math.atan(-(view.row ?? -0.3) * Math.tan(((fov / 2) * Math.PI) / 180));
  const tx = cx + Math.sin(yaw) * Math.cos(pitch) * 100;
  const tz = cz + Math.cos(yaw) * Math.cos(pitch) * 100;
  const ty = cy - Math.sin(pitch) * 100;
  camera.lookAt(tx, ty, -tz);
  if (view.roll) camera.rotateZ((view.roll * Math.PI) / 180);

  // The sky: a dome graded from the horizon to the zenith, outside the fog.
  const dome = new THREE.SphereGeometry(20000, 32, 16);
  const dc: number[] = [];
  const dp = dome.getAttribute('position');
  for (let i = 0; i < dp.count; i++) {
    const t = Math.max(0, dp.getY(i) / 20000);
    const g = lerp(L.horizon, L.zenith, Math.pow(t, 0.55));
    dc.push(g, g, g);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  const domeMesh = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  domeMesh.position.copy(camera.position);
  domeMesh.renderOrder = -1;
  scene.add(domeMesh);
  scene.background = sky;

  // One key light and a flat fill.
  const sun = new THREE.DirectionalLight(0xffffff, L.sun);
  const az = (L.sunAz * Math.PI) / 180;
  const el = (L.sunEl * Math.PI) / 180;
  const focus = new THREE.Vector3(rx + Math.sin(yaw) * 45, ry, -(z + Math.cos(yaw) * 45));
  // The sun stands ahead of the rider, `az` off the line (ART.md 7's bearings are seen from the run looking down it).
  const sx = Math.sin(yaw + az) * Math.cos(el);
  const sz = Math.cos(yaw + az) * Math.cos(el);
  sun.position.set(focus.x + sx * 400, focus.y + Math.sin(el) * 400, focus.z - sz * 400);
  sun.target.position.copy(focus);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -110;
  sc.right = 110;
  sc.top = 110;
  sc.bottom = -110;
  sc.near = 10;
  sc.far = 1200;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.08;
  scene.add(sun, sun.target);
  scene.add(new THREE.AmbientLight(0xffffff, L.ambient));

  // The ground, what stands on it, the far plane and the rider.
  const z0 = z - 40;
  const ground = terrain(def, z0);
  scene.add(ground);
  const k = new Kit();
  def.props(k, z0, z0 + def.ahead);
  let tris = ground.geometry.getAttribute('position').count / 3 + k.triangles;
  scene.add(k.mesh(true));
  if (def.far) {
    const f = new Kit();
    def.far(f, { x: cx, y: cy, z: cz });
    tris += f.triangles;
    const fm = f.mesh(false);
    scene.add(fm);
  }
  scene.add(rider(def, rx, ry, z, yaw));

  renderer.setSize(FRAME_W, FRAME_H, false);
  renderer.render(scene, camera);
  // Free what was built: each view is its own scene.
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  sun.shadow.map?.dispose();
  return Math.round(tris);
}

export function makeRenderer(canvas?: HTMLCanvasElement): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(FRAME_W, FRAME_H, false);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping;
  return r;
}
