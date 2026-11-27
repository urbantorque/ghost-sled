import { AdditiveBlending, BoxGeometry, type BufferGeometry, Color, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { BACK, FRONT, rowAt, rowsOf } from '../sim/gablefall';
import { type MomentPlay, momentPlays } from '../sim/moments';
import type { Sim } from '../sim/sim';
import { merge, part } from './flora';
import { quad } from './landmarkKit';
import { pushLocalLight } from './lights';
import { makeToonMaterial } from './materials';
import type { Particles } from './particles';

// Gablefall's three set pieces as its world draws them (round 9, notes/r9-gablefall-world.md 1b; their sim is the
// lane's, moments.ts and sim.ts). Nothing stands on the snow a sled rides: the roofs and the street are the run.
//  - The Roof Run (chain): a little iron lantern under the front eave of every house down the run, both rows, dark until
//    the rider lands that roof, then lit, so the chain reads as a line of lights down the row and across the street from
//    the other row's roofs; the next roof's lantern breathes; a chain broken guttering every lantern it lit to an ember.
//  - Market Day (awnings): the stalls' striped awnings hung in pairs from the fronts down the market street, over the
//    pavement with their edge three metres up, a pool of lamplight on the street between each pair; the next pair's pool
//    breathes, a stomp there shakes the snow off its awnings in a puff and flares its pool.
//  - The Washing Lines (washing): a line across each alley of the play from a pole over the alley's gate to a pole in
//    the back lane, sagging lowest where the sim rings it (washingOf), hung with sheets, shirts and a long scarf in the
//    town's muted colours; rung by a rider passing in the air, it jumps and throws its frost; a pool on the alley's drift
//    under its lowest point breathes for the next and flares when rung, goes dark when missed.
// No HUD signal is added: the world says it.

type V3 = [number, number, number];

const C = (h: string): Color => new Color(h);
const IRON = C('#2A2830');
const TIMBER = C('#5A4636');
const CREAM = C('#E8E2D4');
const SNOW = C('#F4F2F6');
const ROPE = C('#5E544A');
/** The stalls' muted stripes (gablefallworld.ts AWNINGS): never vermillion. */
const STRIPES = [C('#3E5C86'), C('#4E6E5A'), C('#6A5A7E'), C('#7A6A4A')];
/** The washing: cream sheets, pale blue and sage shirts, a lilac scarf. */
const WASH = [C('#E8E2D4'), C('#9AB0C8'), C('#A8B89C'), C('#E8E2D4'), C('#B4A6C2')];
const LIT = C('#FFD9A0');
/** An unlit lantern's glass: pale, so the chain's lanterns read down the row before they are lit. */
const DARK = C('#7E7A8E');
const EMBER = C('#6E4030');
const POOL = C('#FFE7A8');
const FLARE = C('#FFF3C4');
const MARIGOLD = C('#FFD34D');
const FROST = C('#F4F8FF');
const LAMP_LIN = C('#FFE2BC').convertSRGBToLinear();

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

/** A box in sim metres (x, y, z its centre), coloured. */
function box(x: number, y: number, z: number, w: number, h: number, d: number, col: Color): BufferGeometry {
  return part(new BoxGeometry(w, h, d).translate(x, y, -z), col);
}

/** A quad seen from both sides, corners in sim metres. */
function sheet(out: BufferGeometry[], a: V3, b: V3, c: V3, d: V3, col: Color): void {
  const f = (p: V3): V3 => [p[0], p[1], -p[2]];
  out.push(quad(f(a), f(b), f(c), f(d), col), quad(f(d), f(c), f(b), f(a), col));
}

/** One mark of a set piece: where it is, how it stands (0 to come, 1 taken, -1 missed or guttered) and since when. */
interface Mark {
  x: number;
  y: number;
  z: number;
  /** Its pool's width and length (awnings, washing), or its house's ends (a lantern's z0, z1). */
  w: number;
  l: number;
  side: -1 | 1;
  st: number;
  at: number;
  /** A washing line's own mesh (High and Medium), to jump when rung. */
  mesh: Mesh | null;
}

export class GablefallPieces {
  readonly root = new Object3D();
  private readonly paint = makeToonMaterial({ coolShade: 0.22, rim: 0.2 });
  private readonly poolMat = poolMaterial();
  private readonly glassMat = new MeshBasicMaterial({ color: 0xffffff });
  private readonly owned: Array<{ dispose(): void }> = [this.paint, this.poolMat, this.glassMat];
  private course: Course | null = null;
  private plays: readonly MomentPlay[] = [];
  private low = false;
  private pools: InstancedMesh | null = null;
  private glass: InstancedMesh | null = null;
  /** The chain's lanterns by play index, down the run. */
  private lanterns = new Map<number, Mark[]>();
  /** The awnings' stalls and the washing lines by play index, down the run. */
  private marks = new Map<number, Mark[]>();
  private ended = new Map<number, { t: number; won: boolean }>();
  private time = 0;

  constructor(private readonly particles: Particles | null) {
    this.root.name = 'gablefall-pieces';
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  clear(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const o of this.owned.splice(3)) o.dispose();
    this.pools = null;
    this.glass = null;
    this.lanterns.clear();
    this.marks.clear();
    this.plays = [];
  }

  reset(): void {
    this.ended.clear();
    for (const list of this.lanterns.values()) for (const m of list) m.st = 0;
    for (const list of this.marks.values())
      for (const m of list) {
        m.st = 0;
        if (m.mesh) m.mesh.position.y = 0;
      }
  }

  /** Builds what the plays hold (once per set of plays: a run's own, or the course's plain ones on the title). */
  build(c: Course, plays: readonly MomentPlay[], low: boolean): void {
    this.clear();
    this.course = c;
    this.plays = plays;
    this.low = low;
    const parts: BufferGeometry[] = [];
    for (const p of plays) {
      if (p.verb === 'chain') this.chainFor(c, p, parts);
      else if (p.verb === 'awnings') this.awningsFor(c, p, parts);
      else if (p.verb === 'washing') this.washingFor(c, p, parts, low);
    }
    if (parts.length) {
      const m = new Mesh(this.keep(merge(parts)), this.paint);
      m.castShadow = !low;
      m.receiveShadow = true;
      this.root.add(m);
    }
    let n = 0;
    for (const list of this.marks.values()) n += list.length;
    if (n) {
      const im = new InstancedMesh(this.keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), this.poolMat, n);
      im.frustumCulled = false;
      im.renderOrder = 4;
      im.count = 0;
      im.setColorAt(0, tc.setRGB(0, 0, 0));
      this.root.add(im);
      this.pools = im;
    }
    let k = 0;
    for (const list of this.lanterns.values()) k += list.length;
    if (k) {
      const im = new InstancedMesh(this.keep(new BoxGeometry(0.34, 0.46, 0.34)), this.glassMat, k);
      im.frustumCulled = false;
      let i = 0;
      for (const list of this.lanterns.values())
        for (const m of list) {
          im.setMatrixAt(i, tm.compose(tv.set(m.x, m.y, -m.z), tq.identity(), ts.set(1, 1, 1)));
          im.setColorAt(i++, DARK);
        }
      this.root.add(im);
      this.glass = im;
    }
  }

  /** The Roof Run: a lantern under the front eave of each house of the play, both rows, on an iron bracket. */
  private chainFor(c: Course, p: MomentPlay, parts: BufferGeometry[]): void {
    const list: Mark[] = [];
    for (const row of rowsOf(c))
      for (const q of row.pieces) {
        if (q.kind !== 'house' || q.z1 - q.z0 < 5) continue;
        const z = (q.z0 + q.z1) / 2;
        if (z < p.z0 || z > p.z1) continue;
        const sd = row.side;
        const cx = c.centerX(z);
        const x = cx + sd * (FRONT - 0.5);
        const y = c.ground(cx + sd * (FRONT + 0.05), z) - 1.05;
        // The bracket: an arm out from the wall over the lantern, its drop, and the lantern's cap and foot.
        parts.push(box(cx + sd * (FRONT - 0.29), y + 0.52, z, 0.5, 0.06, 0.06, IRON));
        parts.push(box(x, y + 0.38, z, 0.04, 0.14, 0.04, IRON));
        parts.push(box(x, y + 0.27, z, 0.44, 0.08, 0.44, IRON));
        parts.push(box(x, y - 0.25, z, 0.38, 0.05, 0.38, IRON));
        list.push({ x, y, z, w: q.z0, l: q.z1, side: sd, st: 0, at: 0, mesh: null });
      }
    list.sort((a, b) => a.z - b.z);
    this.lanterns.set(p.index, list);
  }

  /** Market Day: a stall's awning each side at each of the sim's targets, where a house's front stands, over the hold. */
  private awningsFor(c: Course, p: MomentPlay, parts: BufferGeometry[]): void {
    const list: Mark[] = [];
    p.targets.forEach((t, i) => {
      const cx = c.centerX(t.z);
      const by = c.baseY(t.z);
      let any = false;
      for (const sd of [-1, 1] as const) {
        const row = rowAt(c, sd, t.z);
        const q = row?.pieces.find((r) => r.z0 <= t.z - 2.4 && r.z1 >= t.z + 2.4);
        if (!q || q.kind !== 'house') continue;
        any = true;
        const col = STRIPES[(i * 2 + (sd > 0 ? 1 : 0)) % STRIPES.length];
        const x0 = cx + sd * (FRONT - 0.08);
        const x1 = cx + sd * (FRONT - 1.7);
        // (Over the pavement, its edge three metres up: a sled in the street rides under it.)
        // (Its heights follow the street down its grade, so the edge is three metres over it the whole length.)
        const y0 = (z: number): number => c.baseY(z) + 3.9;
        const y1 = (z: number): number => c.baseY(z) + 3.0;
        const L = 5.2;
        const n = 10;
        for (let k = 0; k < n; k++) {
          const za = t.z - L / 2 + (k * L) / n;
          const zb = za + L / n;
          const cc = k % 2 ? CREAM : col;
          sheet(parts, [x0, y0(za), za], [x1, y1(za), za], [x1, y1(zb), zb], [x0, y0(zb), zb], cc);
          // The valance, scalloped by its stripes.
          sheet(parts, [x1, y1(za), za], [x1, y1(za) - 0.32, za + 0.05], [x1, y1(zb) - 0.32, zb - 0.05], [x1, y1(zb), zb], cc);
        }
        // Its snow, and the iron struts that hold it out from the wall, from low on the wall up to its edge.
        const za = t.z - L / 2;
        const zb = t.z + L / 2;
        sheet(parts, [x0, y0(za) + 0.06, za + 0.1], [x1 + sd * 0.12, y1(za) + 0.06, za + 0.2], [x1 + sd * 0.12, y1(zb) + 0.06, zb - 0.2], [x0, y0(zb) + 0.06, zb - 0.1], SNOW);
        for (const z of [za + 0.2, zb - 0.2]) {
          const g = new BoxGeometry(0.04, 0.04, 1.9).rotateY(Math.PI / 2).rotateZ(-sd * 0.85);
          parts.push(part(g.translate((x0 + x1) / 2 + sd * 0.1, c.baseY(z) + 2.45, -z), IRON));
        }
      }
      if (any) list.push({ x: cx, y: by, z: t.z, w: 6.4, l: 3.6, side: 1, st: 0, at: 0, mesh: null });
    });
    this.marks.set(p.index, list);
  }

  /** The Washing Lines: each across its alley at the alley's middle, from a pole over its gate to one in the back lane. */
  private washingFor(c: Course, p: MomentPlay, parts: BufferGeometry[], low: boolean): void {
    const list: Mark[] = [];
    p.targets.forEach((t, i) => {
      const cx = c.centerX(t.z);
      const sd: -1 | 1 = t.x >= cx ? 1 : -1;
      const by = c.baseY(t.z);
      const xF = cx + sd * (FRONT - 0.15);
      const xB = cx + sd * (BACK + 0.9);
      const yLow = c.ground(t.x, t.z) + 1.05;
      const yEnd = yLow + 1.5;
      const aF = (yEnd - yLow) / ((xF - t.x) * (xF - t.x));
      const aB = (yEnd - yLow) / ((xB - t.x) * (xB - t.x));
      const yAt = (x: number): number => yLow + (sd * (x - t.x) < 0 ? aF : aB) * (x - t.x) * (x - t.x);
      // The poles: one standing on the alley's gate (its arch's head, gablefallworld.ts gateway), one in the back lane.
      parts.push(box(xF, (by + 3.6 + yEnd + 0.2) / 2, t.z, 0.1, yEnd + 0.2 - (by + 3.6), 0.1, TIMBER));
      parts.push(box(xB, (by + 0.1 + yEnd + 0.2) / 2, t.z, 0.12, yEnd + 0.1 - by, 0.12, TIMBER));
      const own: BufferGeometry[] = low ? parts : [];
      // The line, in short straight lengths along its sag.
      const n = 14;
      for (let k = 0; k < n; k++) {
        const xa = xF + ((xB - xF) * k) / n;
        const xb = xF + ((xB - xF) * (k + 1)) / n;
        sheet(own, [xa, yAt(xa), t.z], [xb, yAt(xb), t.z], [xb, yAt(xb) - 0.035, t.z], [xa, yAt(xa) - 0.035, t.z], ROPE);
      }
      // The washing along it, pegged at the line and hanging toward the alley's snow (never into it).
      let h = (i * 7 + 3) % 11;
      for (let x = xF + sd * 0.7; sd * (xB - sd * 0.7 - x) > 0; ) {
        h = (h * 5 + 3) % 11;
        const kind = h % 4;
        const w = kind === 0 ? 0.8 : kind === 3 ? 0.2 : 0.5;
        const drop = kind === 0 ? 0.7 : kind === 3 ? 1.05 : 0.48;
        const xm = x + sd * (w / 2);
        const top = yAt(xm) - 0.02;
        const room = top - c.ground(xm, t.z) - 0.25;
        const d = Math.min(drop, room);
        if (d > 0.22) {
          const col = kind === 3 ? WASH[4] : WASH[h % 4];
          const xa = x;
          const xb = x + sd * w;
          sheet(own, [xa, yAt(xa) - 0.02, t.z + 0.01], [xb, yAt(xb) - 0.02, t.z + 0.01], [xb, yAt(xb) - 0.02 - d, t.z + 0.01], [xa, yAt(xa) - 0.02 - d, t.z + 0.01], col);
        }
        x += sd * (w + 0.18 + (h % 3) * 0.12);
      }
      let mesh: Mesh | null = null;
      if (!low && own.length) {
        mesh = new Mesh(this.keep(merge(own)), this.paint);
        mesh.castShadow = true;
        this.root.add(mesh);
      }
      list.push({ x: t.x, y: c.ground(t.x, t.z), z: t.z, w: 2 * t.hw + 0.8, l: 2.4, side: sd, st: 0, at: 0, mesh });
    });
    this.marks.set(p.index, list);
  }

  /** The set pieces' named moments this frame: a roof landed or the chain broken, a stall stomped, a line rung or
   *  missed, a piece won or lost. */
  beats(list: readonly Beat[], s: Snap): void {
    const c = this.course;
    if (!c) return;
    for (const b of list) {
      if (b.type !== 'moment') continue;
      const p = this.plays.find((q) => q.key === b.key);
      if (!p) continue;
      const lan = this.lanterns.get(p.index);
      if (b.phase === 'won' || b.phase === 'lost') {
        const won = b.phase === 'won';
        this.ended.set(p.index, { t: this.time, won });
        if (lan)
          for (const m of lan) {
            if (m.st !== 1) continue;
            if (!won) {
              m.st = -1;
              m.at = this.time;
            } else if (Math.abs(m.z - s.z) < 120) this.particles?.sparkle(tv.set(m.x, m.y, -m.z), MARIGOLD, 10, 2.2, 0.6, 0.16, null, 0.4);
          }
        continue;
      }
      if (b.phase !== 'step' && b.phase !== 'miss') continue;
      const side: -1 | 1 = s.x >= c.centerX(s.z) ? 1 : -1;
      if (p.verb === 'chain') {
        if (!lan) continue;
        if (b.phase === 'miss') {
          for (const m of lan)
            if (m.st === 1) {
              m.st = -1;
              m.at = this.time;
            }
          continue;
        }
        // The roof the rider landed: its house's lantern on the rider's side, or the nearest behind not yet lit.
        let best: Mark | null = null;
        for (const m of lan) if (m.st === 0 && m.side === side && m.w - 2 <= s.z && m.l + 2 >= s.z) best = m;
        if (!best) for (const m of lan) if (m.st === 0 && m.side === side && m.z <= s.z + 2 && (!best || m.z > best.z)) best = m;
        if (!best) continue;
        best.st = 1;
        best.at = this.time;
        this.particles?.sparkle(tv.set(best.x, best.y, -best.z), MARIGOLD, 14, 2, 0.5, 0.16, null, 0.3);
        continue;
      }
      const marks = this.marks.get(p.index);
      if (!marks) continue;
      if (p.verb === 'awnings') {
        // (A stomp anywhere on the market street counts: the stall nearest the rider answers it. A miss there is the row
        // begun again or a sketchy landing, which the sim ends the piece for: the pools say it at the end.)
        if (b.phase !== 'step') continue;
        let best: Mark | null = null;
        for (const m of marks) if (m.st === 0 && Math.abs(m.z - s.z) < 36 && (!best || Math.abs(m.z - s.z) < Math.abs(best.z - s.z))) best = m;
        if (!best) continue;
        best.st = 1;
        best.at = this.time;
        // Its awnings shake their snow off over the street.
        for (const sd of [-1, 1]) this.particles?.sparkle(tv.set(best.x + sd * (FRONT - 0.9), best.y + 3.8, -best.z), FROST, 26, 1.6, 0.9, 0.22, null, -0.6);
        continue;
      }
      // The washing: the line just passed on the rider's own row, the nearest behind not yet answered.
      let best: Mark | null = null;
      for (const m of marks) if (m.st === 0 && m.side === side && m.z <= s.z + 2 && (!best || m.z > best.z)) best = m;
      if (!best) continue;
      best.st = b.phase === 'step' ? 1 : -1;
      best.at = this.time;
      if (best.st === 1) this.particles?.sparkle(tv.set(best.x, best.y + 1.1, -best.z), FROST, 24, 2.4, 0.6, 0.18, null, 0.5);
    }
  }

  update(c: Course, time: number, s: Snap, sim: Sim | null, run: boolean, low: boolean, reduced: boolean, lamps: number): void {
    this.time = time;
    const plays = run && sim ? sim.plays : this.plays.length && c === this.course ? this.plays : momentPlays(c);
    if (plays !== this.plays || low !== this.low || c !== this.course) this.build(c, plays, low);
    const mo = run && sim ? sim.mo : null;
    const breathe = reduced ? 0.75 : 0.6 + 0.4 * Math.sin(time * 3.2);
    const ahead = low ? 260 : 380;
    // The pools: the stalls' on the street, the lines' on the alleys' drift.
    let n = 0;
    const im = this.pools;
    for (const [index, list] of this.marks) {
      const p = this.plays[index];
      if (!p || !im) continue;
      const active = mo !== null && mo.active === index;
      const end = this.ended.get(index);
      const over = !!end || (mo !== null && mo.next > index && !active);
      let next = -1;
      if (!over)
        for (let i = 0; i < list.length; i++)
          if (list[i].st === 0 && list[i].z > s.z - 1) {
            next = i;
            break;
          }
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const near = m.z > s.z - 30 && m.z < s.z + ahead;
        if (m.mesh) {
          m.mesh.visible = near;
          // A rung line jumps and settles.
          const age = time - m.at;
          m.mesh.position.y = m.st === 1 && age < 1.4 && !reduced ? 0.5 * Math.exp(-age * 3.2) * Math.sin(age * 17) : 0;
        }
        if (!near) continue;
        const age = time - m.at;
        let k: number;
        let col = POOL;
        if (m.st === 1) {
          k = age < 0.25 ? 1.6 : Math.max(0.2, 1.4 * (1 - (age - 0.25) / 0.9));
          col = FLARE;
          if (end && !end.won) k = Math.min(k, 0.2);
        } else if (m.st === -1) k = Math.max(0, 0.5 * (1 - age / 0.5));
        else if (over) k = 0;
        else k = i === next ? 0.7 + 0.5 * breathe : 0.28;
        if (k <= 0.01) continue;
        const y = c.ground(m.x, m.z) + 0.12;
        tm.compose(tv.set(m.x, y, -m.z), tq.identity(), ts.set(m.w, 1, m.l));
        im.setMatrixAt(n, tm);
        im.setColorAt(n, tc.copy(col).multiplyScalar(k));
        n++;
        if (k > 0.6 && lamps > 0.3 && Math.abs(m.z - s.z) < 80) pushLocalLight(m.x, y + 2, -m.z, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 7, Math.min(1.2, k * 0.5 * lamps));
      }
    }
    if (im) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    // The chain's lanterns: dark, the next roof's breathing on each side while the chain is on, lit roof by roof, an
    // ember once the chain is broken.
    const g = this.glass;
    if (g) {
      let i = 0;
      let lights = 0;
      for (const [index, list] of this.lanterns) {
        const active = mo !== null && mo.active === index;
        const end = this.ended.get(index);
        const p = this.plays[index];
        const coming = !end && p && s.z > p.z0 - 160 && s.z < p.z1 && (!mo || mo.next <= index);
        const nextAt = { [-1]: Infinity, [1]: Infinity } as Record<number, number>;
        if (active || coming) for (const m of list) if (m.st === 0 && m.z > s.z - 2 && m.z < nextAt[m.side]) nextAt[m.side] = m.z;
        for (const m of list) {
          const age = time - m.at;
          if (m.st === 1) {
            const k = (end?.won ? 1.25 + 0.6 * Math.exp(-(time - end.t) * 1.5) : 1.15) + (age < 0.3 ? 0.6 : 0);
            tc.copy(LIT).multiplyScalar(k);
            if (lights < 6 && Math.abs(m.z - s.z) < 70) {
              pushLocalLight(m.x, m.y, -m.z, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 5, 0.35 + 0.4 * lamps);
              lights++;
            }
          } else if (m.st === -1) tc.copy(EMBER).multiplyScalar(0.55 + 0.45 * Math.max(0, 1 - age / 0.6) * (reduced ? 1 : 0.6 + 0.4 * Math.sin(age * 23)));
          else if (m.z === nextAt[m.side]) tc.copy(DARK).lerp(LIT, 0.45 + 0.4 * breathe);
          else tc.copy(DARK);
          g.setColorAt(i++, tc);
        }
      }
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
    }
  }
}
