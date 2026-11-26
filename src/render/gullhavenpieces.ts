import { AdditiveBlending, BufferGeometry, Color, CylinderGeometry, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { type MomentGate, type MomentPlay, gateX, momentPlays } from '../sim/moments';
import type { Sim } from '../sim/sim';
import { merge, part } from './flora';
import { quad } from './landmarkKit';
import { pushLocalLight } from './lights';
import { makeToonMaterial } from './materials';
import type { Particles } from './particles';

// Gullhaven's three set pieces as its world draws them (round 9, notes/r9-gullhaven-world.md; their sim is the lane's,
// moments.ts and sim.ts). Nothing of them stands on the snow a sled rides: what is on the run is paint and light.
//  - The Lighthouse (beam): its marks down the Cape's second shelf, a limewashed daymark with a slate band each side of
//    the path past the limit at every mark, and the lighthouse's beam falling on the path at the mark, a pool of
//    lamplight swinging across it on the sim's own clock (gateX), the shaft from the lantern ahead and to seaward down
//    to it. The next mark's pool breathes; a mark ridden in the beam flares; a missed one goes dark.
//  - The Great Geo (soar): its far shelf's line, two tall banded poles past the limit either side with a lamp at their
//    heads and a dashed line in paint across the shelf between them, where the flight has to come down past. The lamps
//    breathe while the rider is in the air off the lip, flare for the win, gutter for the loss.
//  - The Sea Stacks (stack): each gap on the shore road between its two jaws of paint, the stacks themselves standing
//    in the sea beside the road (gullhavenworld.ts stacks); the next gap's pool breathes, a gap threaded flares, a
//    missed one goes dark.
// No HUD signal is added: the world says it.

type V3 = [number, number, number];

const WHITE = new Color('#ECE6DA');
const SLATE = new Color('#2E3448');
const BLUE = new Color('#3E6CA8');
const CREAM = new Color('#EEE4D0');
const INK = new Color('#26242E');
const IRON = new Color('#26242E');
/** The beam's pool, the lantern's warm white; a mark ridden flares to the gift's white-gold. */
const POOL = new Color('#FFE7A8');
const FLARE = new Color('#FFF3C4');
const MARIGOLD = new Color('#FFD34D');
const LAMP_LIN = new Color('#FFE2BC').convertSRGBToLinear();
const Y = new Vector3(0, 1, 0);

const tm = new Matrix4();
const tq = new Quaternion();
const tv = new Vector3();
const ts = new Vector3();
const tc = new Color();

/** A flat pool of light on the snow: a radial falloff, added to what is under it (instanced, each its own colour). */
function poolMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
        #else
        vCol = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.3, 1.0, d);
        gl_FragColor = vec4(vCol, a * a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
}

/** The beam's shaft from the lantern to the pool: a long open cone, its light the length of air it passes through, so
 *  strongest along its middle and toward the pool, soft at its edges and fading back toward the lantern. */
function shaftMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color('#FFF0D0') }, uK: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFace;
      void main() {
        vAlong = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFace = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uK;
      varying float vAlong;
      varying float vFace;
      void main() {
        float a = pow(vFace, 2.0) * smoothstep(0.0, 0.7, vAlong) * (1.0 - smoothstep(0.97, 1.0, vAlong)) * uK;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/** One mark of a set piece: where it is drawn and how it stands (0 to come, 1 taken, -1 missed), and when it changed. */
interface Mark {
  x: number;
  z: number;
  /** The ground under it (for a sparkle). */
  y: number;
  w: number;
  st: number;
  at: number;
  gate: MomentGate | null;
}

export class GullhavenPieces {
  readonly root = new Object3D();
  private readonly paint = makeToonMaterial({ coolShade: 0.18, rim: 0.22 });
  private readonly poolMat = poolMaterial();
  private readonly shaftMat = shaftMaterial();
  private readonly lampMat = new MeshBasicMaterial({ color: 0xffffff });
  private readonly owned: Array<{ dispose(): void }> = [this.paint, this.poolMat, this.shaftMat, this.lampMat];
  private plays: readonly MomentPlay[] = [];
  private pools: InstancedMesh | null = null;
  private shaft: Mesh | null = null;
  private lamps: InstancedMesh | null = null;
  private lampAt: V3[] = [];
  /** The marks of each set piece, by play index. */
  private marks = new Map<number, Mark[]>();
  private beamPlay = -1;
  private soarPlay = -1;
  private ended = new Map<number, { t: number; won: boolean }>();
  private time = 0;
  /** The lighthouse's lantern (sim x, y, z), from the world. */
  lantern: V3 | null = null;

  constructor(private readonly particles: Particles | null) {
    this.root.name = 'gullhaven-pieces';
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  clear(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const o of this.owned.splice(4)) o.dispose();
    this.pools = null;
    this.shaft = null;
    this.lamps = null;
    this.lampAt = [];
    this.marks.clear();
    this.beamPlay = this.soarPlay = -1;
    this.plays = [];
  }

  reset(): void {
    this.ended.clear();
    for (const list of this.marks.values()) for (const m of list) m.st = 0;
  }

  /** Builds what the plays hold (once per set of plays: a run's own, or the course's plain ones on the title). */
  build(c: Course, plays: readonly MomentPlay[], low: boolean): void {
    this.clear();
    this.plays = plays;
    const parts: BufferGeometry[] = [];
    for (const p of plays) {
      if (p.verb === 'beam') this.beamFor(c, p, parts, low);
      else if (p.verb === 'soar') this.soarFor(c, p, parts, low);
      else if (p.verb === 'stacks') this.stacksFor(c, p, parts);
    }
    if (parts.length) {
      const m = new Mesh(this.keep(merge(parts)), this.paint);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
    let n = 0;
    for (const list of this.marks.values()) n += list.length;
    if (n) {
      const g = this.keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
      const im = new InstancedMesh(g, this.poolMat, n);
      im.frustumCulled = false;
      im.renderOrder = 4;
      im.count = 0;
      im.setColorAt(0, tc.setRGB(0, 0, 0));
      this.root.add(im);
      this.pools = im;
    }
    if (this.beamPlay >= 0) {
      const g = this.keep(new CylinderGeometry(1, 0.05, 1, low ? 8 : 14, 1, true).translate(0, 0.5, 0));
      const m = new Mesh(g, this.shaftMat);
      m.frustumCulled = false;
      m.renderOrder = 5;
      m.visible = false;
      this.root.add(m);
      this.shaft = m;
    }
    if (this.lampAt.length) {
      const im = new InstancedMesh(this.keep(new SphereGeometry(0.32, 10, 8)), this.lampMat, this.lampAt.length);
      this.lampAt.forEach((q, i) => {
        im.setMatrixAt(i, tm.makeTranslation(q[0], q[1], -q[2]));
        im.setColorAt(i, tc.setRGB(0.2, 0.2, 0.26));
      });
      im.computeBoundingSphere();
      this.root.add(im);
      this.lamps = im;
    }
  }

  /** A flat strip of paint on the snow from (xa, za) to (xb, zb), `w` wide, its corners on the ground. */
  private stripe(c: Course, xa: number, za: number, xb: number, zb: number, w: number, col: Color, out: BufferGeometry[]): void {
    const dx = xb - xa;
    const dz = zb - za;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * (w / 2);
    const nz = (dx / l) * (w / 2);
    const p = (x: number, z: number): V3 => [x, c.ground(x, z) + 0.05, -z];
    out.push(quad(p(xa - nx, za - nz), p(xb - nx, zb - nz), p(xb + nx, zb + nz), p(xa + nx, za + nz), col));
  }

  /** A post past the limit either side at z: limewashed, banded, `h` tall; its head (sim x, y, z) for a lamp. */
  private posts(c: Course, z: number, h: number, r: number, band: Color, bands: number, out: BufferGeometry[]): V3[] {
    const heads: V3[] = [];
    const lim = c.edgeLimit(z);
    const hw = c.halfWidth(z);
    for (const side of [-1, 1]) {
      // (Seaward just past the fence's line; landward just past the limit, on the bank.)
      const e = (side > 0 ? Math.min(lim, 0.8) + 0.6 : lim + 0.4) + r;
      const x = c.centerX(z) + side * (hw + e);
      const y = c.ground(x, z) - 0.3;
      out.push(part(new CylinderGeometry(r * 0.85, r, h + 0.3, 6, 1), WHITE, { pos: [x, y + (h + 0.3) / 2, -z] }));
      for (let k = 0; k < bands; k++) out.push(part(new CylinderGeometry(r * 0.9 + 0.02, r * 0.9 + 0.02, h * 0.12, 6, 1, true), band, { pos: [x, y + h * (0.35 + (0.5 * k) / Math.max(1, bands)), -z] }));
      heads.push([x, y + h + 0.6, z]);
    }
    return heads;
  }

  private beamFor(c: Course, p: MomentPlay, out: BufferGeometry[], low: boolean): void {
    this.beamPlay = p.index;
    const list: Mark[] = [];
    for (const g of p.gates) {
      // The mark: a daymark each side, white with a slate band, as the harbour's leading marks are.
      this.posts(c, g.z, 1.7, 0.16, SLATE, 1, out);
      if (!low) for (const side of [-1, 1]) this.stripe(c, c.centerX(g.z) + side * (c.halfWidth(g.z) - 0.6), g.z - 1.2, c.centerX(g.z) + side * (c.halfWidth(g.z) - 0.6), g.z + 1.2, 0.35, CREAM, out);
      list.push({ x: gateX(g, 0), z: g.z, y: c.ground(gateX(g, 0), g.z), w: g.hw, st: 0, at: -9, gate: g });
    }
    this.marks.set(p.index, list);
  }

  private soarFor(c: Course, p: MomentPlay, out: BufferGeometry[], low: boolean): void {
    this.soarPlay = p.index;
    const z = p.far;
    // The far shelf's line: two tall poles banded in the fence's blue, a lamp at their heads, a dashed line between.
    const heads = this.posts(c, z, 6.5, 0.2, BLUE, low ? 2 : 3, out);
    for (const q of heads) out.push(part(new CylinderGeometry(0.4, 0.4, 0.12, 8, 1), IRON, { pos: [q[0], q[1] - 0.45, -z] }));
    this.lampAt.push(...heads);
    const hw = c.halfWidth(z);
    const cx = c.centerX(z);
    const n = Math.floor((hw * 2) / 1.6);
    for (let i = 0; i < n; i += 1) {
      const xa = cx - hw + i * 1.6 + 0.2;
      this.stripe(c, xa, z, xa + 1.2, z, 0.5, i % 2 ? CREAM : BLUE, out);
    }
  }

  private stacksFor(c: Course, p: MomentPlay, out: BufferGeometry[]): void {
    const list: Mark[] = [];
    for (const t of p.targets) {
      // Each gap's jaws: two bars of ink in the snow either side of it, along the run.
      for (const side of [-1, 1]) {
        const x = t.x + side * (t.hw + 0.18);
        this.stripe(c, x, t.z - 1.6, x, t.z + 1.6, 0.32, INK, out);
      }
      list.push({ x: t.x, z: t.z, y: c.ground(t.x, t.z), w: t.hw, st: 0, at: -9, gate: null });
    }
    this.marks.set(p.index, list);
  }

  /** The set pieces' named moments (the director's beats): a mark ridden or missed, a set piece won or lost. */
  beats(list: readonly Beat[], s: Snap): void {
    for (const b of list) {
      if (b.type !== 'moment') continue;
      const p = this.plays.find((q) => q.key === b.key);
      if (!p) continue;
      if (b.phase === 'won' || b.phase === 'lost') {
        this.ended.set(p.index, { t: this.time, won: b.phase === 'won' });
        if (p.index === this.soarPlay && b.phase === 'won') for (const q of this.lampAt) this.particles?.sparkle(tv.set(q[0], q[1], -q[2]), MARIGOLD, 30, 3.6, 0.8, 0.24, null, 0.5);
      }
      const marks = this.marks.get(p.index);
      if (!marks || (b.phase !== 'step' && b.phase !== 'miss')) continue;
      // The mark just passed: the nearest behind the rider not yet answered.
      let best: Mark | null = null;
      for (const m of marks) if (m.st === 0 && m.z <= s.z + 2 && (!best || m.z > best.z)) best = m;
      if (!best) continue;
      best.st = b.phase === 'step' ? 1 : -1;
      best.at = this.time;
      if (best.st === 1) this.particles?.sparkle(tv.set(best.x, best.y + 0.6, -best.z), MARIGOLD, 22, 3, 0.6, 0.2, null, 0.4);
    }
  }

  update(c: Course, time: number, s: Snap, sim: Sim | null, run: boolean, low: boolean, reduced: boolean, lamps: number): void {
    this.time = time;
    const plays = run && sim ? sim.plays : this.plays.length ? this.plays : momentPlays(c);
    if (plays !== this.plays) this.build(c, plays, low);
    const mo = run && sim ? sim.mo : null;
    const breathe = reduced ? 0.75 : 0.6 + 0.4 * Math.sin(time * 3.2);
    // The pools: the beam's at its marks, the stacks' in their gaps.
    let n = 0;
    let shaftTo: V3 | null = null;
    let shaftK = 0;
    let shaftW = 2;
    const im = this.pools;
    for (const [index, list] of this.marks) {
      const p = this.plays[index];
      if (!p || !im) continue;
      const active = mo !== null && mo.active === index;
      const over = this.ended.has(index) || (mo !== null && mo.next > index && !active);
      const ticks = active && sim ? sim.tick - mo!.t0 : 0;
      let next = -1;
      if (!over) for (let i = 0; i < list.length; i++) if (list[i].st === 0) {
        next = i;
        break;
      }
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m.z < s.z - 30 || m.z > s.z + (low ? 220 : 320)) continue;
        // (The beam's pool is where the sim's sway has it on this tick: at rest until the rider arrives, held where it
        // was once the mark is decided.)
        if (m.gate && m.st === 0 && active) m.x = gateX(m.gate, ticks);
        const age = time - m.at;
        let k = 0;
        let col = POOL;
        if (m.st === 1) {
          k = age < 0.25 ? 1.6 : Math.max(0.15, 1.4 * (1 - (age - 0.25) / 0.9));
          col = FLARE;
        } else if (m.st === -1) k = Math.max(0, 0.5 * (1 - age / 0.5));
        else if (over) k = 0;
        else k = i === next ? 0.7 + 0.5 * breathe : 0.3;
        if (k <= 0.01) continue;
        m.y = c.ground(m.x, m.z);
        const y = m.y + 0.12;
        tm.compose(tv.set(m.x, y, -m.z), tq.identity(), ts.set(m.w * 2 + 1.2, 1, m.gate ? 4.2 : 3.4));
        im.setMatrixAt(n, tm);
        im.setColorAt(n, tc.copy(col).multiplyScalar(k));
        n++;
        if (m.gate && i === next && Math.abs(m.z - s.z) < 200) {
          shaftTo = [m.x, y, m.z];
          shaftK = k;
          shaftW = m.w;
        }
        if (k > 0.6 && lamps > 0.3 && Math.abs(m.z - s.z) < 80) pushLocalLight(m.x, y + 2, -m.z, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 7, Math.min(1.2, k * 0.5 * lamps));
      }
    }
    if (im) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    // The shaft from the lantern down to the next mark's pool: faint by day, plain once the lamps are lit.
    if (this.shaft) {
      const L = this.lantern;
      this.shaft.visible = !!(L && shaftTo);
      if (L && shaftTo) {
        const from = tv.set(L[0], L[1], -L[2]);
        const dir = new Vector3(shaftTo[0], shaftTo[1] + 0.2, -shaftTo[2]).sub(from);
        const len = dir.length();
        tq.setFromUnitVectors(Y, dir.normalize());
        this.shaft.position.copy(from);
        this.shaft.quaternion.copy(tq);
        this.shaft.scale.set(shaftW * 1.1, len, shaftW * 1.1);
        this.shaftMat.uniforms.uK.value = Math.min(1, shaftK) * (0.14 + 0.36 * Math.min(1, lamps));
      }
    }
    // The Great Geo's lamps.
    if (this.lamps && this.soarPlay >= 0) {
      const p = this.plays[this.soarPlay];
      const near = s.z > p.z0 - (low ? 420 : 700) && s.z < p.z1 + 120;
      this.lamps.visible = near;
      if (near) {
        const active = mo !== null && mo.active === this.soarPlay;
        const end = this.ended.get(this.soarPlay);
        let k = 0.1;
        if (end) {
          const t = time - end.t;
          k = end.won ? 0.9 + 2.2 * Math.exp(-t * 1.4) : 0.5 * Math.exp(-t * 2) * (0.6 + 0.4 * Math.sin(t * 23));
        } else if (active) k = mo!.aux > 0 ? 1.1 + 0.6 * breathe : 0.45 + 0.35 * breathe;
        else if (!mo || mo.next <= this.soarPlay) k = 0.35;
        tc.copy(LAMP_LIN).multiplyScalar(0.5 + k);
        if (k < 0.15) tc.setRGB(0.2, 0.2, 0.26);
        for (let i = 0; i < this.lampAt.length; i++) {
          this.lamps.setColorAt(i, tc);
          const q = this.lampAt[i];
          if (k > 0.5 && Math.abs(q[2] - s.z) < 160) pushLocalLight(q[0], q[1], -q[2], LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 12, Math.min(1.4, k * 0.6));
        }
        if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
      }
    }
  }
}

