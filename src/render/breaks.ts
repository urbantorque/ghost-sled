import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Course } from '../sim/course';
import { BUDGET, byTier, fx } from './fxhub';
import { shared } from './materials';
import type { Particles } from './particles';

// The world breaks (round 7). Render-only reactions to what the sim already reports: a snowman bursts into
// lumps of snow, its carrot and its hat; a barrier scraped at speed splinters; ice shaved by a runner throws
// shards; a cornice lets go in blocks; icicles drop off a gully's walls as a rider passes under them. Every
// piece is one instance of one small faceted shard in one pooled draw, thrown, tumbling, bouncing once on the
// snow and gone in about a second; the pool is the tier's (fxhub.ts BUDGET.shards) and nothing is drawn while
// nothing is broken. Never a collider, never anything a run can feel: a piece is light and paint.

export type BreakKind = 'ice' | 'wood' | 'snow' | 'snowman' | 'icicle';

const SNOW = new Color('#F4F7FF');
const SNOW_SHADE = new Color('#C9D4F2');
const ICE = [new Color('#DDF6FF'), new Color('#A9D8F2'), new Color('#7FB6E0')];
const WOOD = [new Color('#6E4A36'), new Color('#8A6248'), new Color('#4E3428')];
const CARROT = new Color('#FF8A2A');
const COAL = new Color('#1A1A28');
const SCARF = new Color('#3E7FD8');

/** One shard: an irregular wedge, six faces' worth of facets in eight triangles. */
function shardGeometry(): BufferGeometry {
  const v: Array<[number, number, number]> = [
    [0, 0.62, 0.05],
    [-0.5, -0.1, 0.34],
    [0.46, -0.16, 0.3],
    [0.08, -0.2, -0.5],
    [0, -0.55, 0],
  ];
  const faces = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 1],
    [4, 2, 1],
    [4, 3, 2],
    [4, 1, 3],
  ];
  const pos: number[] = [];
  for (const f of faces) for (const i of f) pos.push(...v[i]);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

function shardMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uShade: shared.uShadeTint,
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aTint;
      uniform vec3 uSunDir;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vCol;
      varying float vLit;
      varying float vFog;
      varying float vGlint;
      void main() {
        vCol = aTint.rgb;
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vLit = smoothstep(-0.25, 0.6, dot(n, uSunDir));
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 toCam = normalize(cameraPosition - wp.xyz);
        // Ice (aTint.a) flashes as a facet turns through the light.
        vGlint = aTint.a * pow(max(dot(reflect(-uSunDir, n), toCam), 0.0), 12.0);
        vec4 mv = viewMatrix * wp;
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor;
      uniform vec3 uShade;
      uniform vec3 uFog;
      varying vec3 vCol;
      varying float vLit;
      varying float vFog;
      varying float vGlint;
      void main() {
        // The game's two-tone light: the piece's own colour in the sun, a cool step of it in shade.
        vec3 shade = mix(vCol * 0.62, uShade, 0.3);
        vec3 col = mix(shade, vCol * mix(vec3(1.0), uSunColor, 0.5), vLit) + uSunColor * vGlint * 1.6;
        gl_FragColor = vec4(mix(col, uFog, vFog), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export class Breaks {
  readonly mesh: InstancedMesh;
  private readonly cap: number;
  private readonly tint: InstancedBufferAttribute;
  // One slot a piece (flat arrays: nothing is allocated while pieces fly).
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly axis: Float32Array;
  private readonly size: Float32Array;
  private readonly life: Float32Array;
  private readonly spin: Float32Array;
  private readonly angle: Float32Array;
  private readonly bounced: Uint8Array;
  private next = 0;
  private alive = 0;
  private course: Course | null = null;
  private icicleAcc = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly a = new Vector3();
  private readonly s = new Vector3();
  private readonly at = new Vector3();
  private readonly car = new Vector3();
  /** Things broken since the run began (tests and the cost report). */
  count = 0;

  constructor(private readonly particles: Particles) {
    // The pool is the largest tier's; a tier uses its own share of it (BUDGET.shards).
    this.cap = BUDGET.shards[3];
    const n = this.cap;
    const geo = shardGeometry();
    this.tint = new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage);
    geo.setAttribute('aTint', this.tint);
    this.mesh = new InstancedMesh(geo, shardMaterial(), n);
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3);
    this.axis = new Float32Array(n * 3);
    this.size = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.angle = new Float32Array(n);
    this.bounced = new Uint8Array(n);
  }

  setCourse(c: Course): void {
    this.course = c;
    this.clear();
  }

  clear(): void {
    this.life.fill(0);
    this.alive = 0;
    this.count = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /** Pieces in the air now, and the most this tier may have. */
  get pieces(): number {
    return this.alive;
  }
  get budget(): number {
    return byTier(BUDGET.shards);
  }

  private piece(x: number, y: number, z: number, vx: number, vy: number, vz: number, col: Color, sx: number, sy: number, sz: number, life: number, glint = 0): void {
    const lim = this.budget;
    // The tier's share of the pool, round-robin: a new break takes the oldest pieces' slots.
    const i = this.next % lim;
    this.next = (this.next + 1) % lim;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.axis.set([this.a.x, this.a.y, this.a.z], i * 3);
    this.size.set([sx, sy, sz], i * 3);
    this.life[i] = life;
    this.spin[i] = fx.reduced ? 2 : 5 + Math.random() * 9;
    this.angle[i] = Math.random() * 6.28;
    this.bounced[i] = 0;
    const k = 0.92 + Math.random() * 0.16;
    this.tint.setXYZW(i, col.r * k, col.g * k, col.b * k, glint);
  }

  /**
   * Something breaks at three.js (x, y, z), `carrier` the velocity its pieces ride on (a rider's, so a
   * break at speed plays out beside the sled and not behind the lens), `k` its size (about 0.5 to 1.5).
   * `side` throws the pieces to one side of the line of travel (+1 toward +x), 0 all round.
   */
  shatter(kind: BreakKind, x: number, y: number, z: number, carrier: Vector3 | null, k = 1, side = 0): void {
    const tier = fx.tier;
    const n = Math.round((kind === 'snowman' ? 16 : kind === 'icicle' ? 4 : 11) * k * [0.5, 0.8, 1, 1.3][tier]);
    const cx = carrier ? carrier.x * 0.86 : 0;
    const cy = carrier ? Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * 0.86 : 0;
    const cz = carrier ? carrier.z * 0.86 : 0;
    this.count++;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = (1.5 + Math.random() * 4) * (fx.reduced ? 0.5 : 1);
      let dx = Math.cos(a);
      const dz = Math.sin(a);
      if (side !== 0) dx = side * Math.abs(dx);
      const up = 1.5 + Math.random() * 4.5;
      if (kind === 'ice' || kind === 'icicle') {
        const c = ICE[i % 3];
        const long = kind === 'icicle' ? 0.5 + Math.random() * 0.5 : 0.16 + Math.random() * 0.3;
        if (kind === 'icicle') this.piece(x + dx * 0.4, y, z + dz * 0.4, cx * 0.2 + dx * 0.6, -1 - Math.random() * 2, cz * 0.2 + dz * 0.6, c, 0.1, long, 0.1, 1.1, 1);
        else this.piece(x + dx * 0.3, y + 0.3 + Math.random() * 0.8, z + dz * 0.3, cx + dx * out, cy + up, cz + dz * out, c, long * 0.6, long, long * 0.5, 0.7 + Math.random() * 0.5, 1);
      } else if (kind === 'wood') {
        const c = WOOD[i % 3];
        const long = 0.3 + Math.random() * 0.6;
        this.piece(x + dx * 0.2, y + 0.3 + Math.random() * 0.7, z + dz * 0.2, cx + dx * out, cy + up * 0.8, cz + dz * out, c, 0.07, long, 0.1, 0.8 + Math.random() * 0.5);
      } else {
        // Snow: blocks and lumps, a step of shade among them; a snowman's own carrot, coals and scarf.
        const part = kind === 'snowman' && i < 5 ? i : -1;
        const c = part === 0 ? CARROT : part === 1 || part === 2 ? COAL : part === 3 ? SCARF : i % 3 === 0 ? SNOW_SHADE : SNOW;
        const big = part >= 0 ? 0.14 + (part === 0 ? 0.1 : 0) : 0.18 + Math.random() * 0.34 * Math.min(1.4, k);
        this.piece(x + dx * 0.3, y + 0.3 + Math.random() * (kind === 'snowman' ? 1.5 : 0.8), z + dz * 0.3, cx + dx * out * 0.8, cy + up * (kind === 'snowman' ? 1 : 0.6), cz + dz * out * 0.8, c, big, part === 0 ? big * 2.2 : big * 0.8, big, 0.8 + Math.random() * 0.6);
      }
    }
    // The powder a break throws with it (the particle layers' own budget scales it).
    this.at.set(x, y + (kind === 'icicle' ? -1 : 0.3), z);
    if (kind === 'snowman') this.particles.burst(this.at, 1.3, 22, carrier ?? undefined);
    else if (kind === 'snow') this.particles.burst(this.at, 1.0 * k, 16, carrier ?? undefined);
    else if (kind === 'ice') this.particles.burst(this.at, 0.6, 8, carrier ?? undefined, ICE[0]);
    this.mesh.visible = true;
  }

  /** A cornice lets go along `len` metres at three.js (x, y, z), running along z: blocks of snow break off
   *  in turn and tumble down `dx` (the way the drop lies). For the collapse set piece's fall and any other
   *  edge that gives way; the main lane calls it where a span's snow goes (see notes/r7-fx.md). */
  cornice(x: number, y: number, z: number, len: number, dx: number, carrier: Vector3 | null = null): void {
    const blocks = Math.max(2, Math.round((len / 4) * [0.5, 0.8, 1, 1.2][fx.tier]));
    for (let b = 0; b < blocks; b++) {
      const bz = z + (b / Math.max(1, blocks - 1) - 0.5) * len;
      this.shatter('snow', x, y, bz, carrier, 1.3, Math.sign(dx) || 1);
    }
  }

  /** Per frame (render dt): pieces fly, bounce once on the snow and shrink away; a gully's icicles drop
   *  as the rider passes under them (Medium and High, where the walls that carry them are drawn). */
  update(dt: number, riderZ: number, speed: number, running: boolean): void {
    const c = this.course;
    if (c && running && fx.tier > 0 && !fx.reduced && speed > 14) {
      this.icicleAcc += dt;
      if (this.icicleAcc > 0.3) {
        this.icicleAcc = 0;
        const z = riderZ + 10 + Math.random() * 16;
        if (c.section(z).kind === 'gully') {
          const side = Math.random() < 0.5 ? -1 : 1;
          const x = c.centerX(z) + side * (c.halfWidth(z) + c.shapeAt(z).limit + 1.6);
          this.shatter('icicle', x, c.ground(x, z) + 4.2, -z, null, 1);
        }
      }
    }
    if (this.alive === 0 && !this.mesh.visible) return;
    const lim = this.budget;
    let n = 0;
    let top = 0;
    for (let i = 0; i < lim; i++) {
      if (this.life[i] <= 0) {
        // (A dead slot inside the drawn range collapses to nothing.)
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      this.life[i] -= dt;
      const o = i * 3;
      this.v[o + 1] -= 13 * dt;
      this.p[o] += this.v[o] * dt;
      this.p[o + 1] += this.v[o + 1] * dt;
      this.p[o + 2] += this.v[o + 2] * dt;
      if (c) {
        const g = c.ground(this.p[o], -this.p[o + 2]);
        if (this.p[o + 1] < g + 0.05) {
          this.p[o + 1] = g + 0.05;
          if (!this.bounced[i]) {
            // One bounce, most of its fall spent: a puff where it lands.
            this.bounced[i] = 1;
            this.v[o + 1] = Math.abs(this.v[o + 1]) * 0.3;
            this.v[o] *= 0.6;
            this.v[o + 2] *= 0.6;
            this.spin[i] *= 0.5;
            if ((i & 3) === 0) this.particles.burst(this.at.set(this.p[o], g + 0.05, this.p[o + 2]), 0.35, 3);
          } else {
            this.v[o + 1] = 0;
            this.v[o] *= 0.8;
            this.v[o + 2] *= 0.8;
            this.spin[i] = 0;
          }
        }
      }
      this.angle[i] += this.spin[i] * dt;
      const fade = Math.min(1, this.life[i] / 0.3);
      this.q.setFromAxisAngle(this.a.set(this.axis[o], this.axis[o + 1], this.axis[o + 2]), this.angle[i]);
      this.m.compose(this.at.set(this.p[o], this.p[o + 1], this.p[o + 2]), this.q, this.s.set(this.size[o] * fade, this.size[o + 1] * fade, this.size[o + 2] * fade));
      this.mesh.setMatrixAt(i, this.m);
      n++;
      top = i + 1;
    }
    this.alive = n;
    this.mesh.count = top;
    this.mesh.visible = n > 0;
    if (n > 0) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(0, top * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.tint.clearUpdateRanges();
      this.tint.addUpdateRange(0, top * 4);
      this.tint.needsUpdate = true;
    }
  }

  /** Every kind of break at once round sim (x, z), for the capture tool. Returns how many things broke. */
  demo(x: number, z: number): number {
    const c = this.course;
    if (!c) return 0;
    const kinds: BreakKind[] = ['snowman', 'ice', 'wood', 'snow'];
    kinds.forEach((k, i) => {
      const px = x + (i - 1.5) * 3.2;
      const pz = z + 16 + (i % 2) * 4;
      this.shatter(k, px, c.ground(px, pz), -pz, this.car.set(0, 0, -8), 1.2);
    });
    this.cornice(x - 9, c.ground(x - 9, z + 26) + 2.5, -(z + 26), 12, 1);
    this.shatter('icicle', x + 7, c.ground(x + 7, z + 14) + 4, -(z + 14), null, 1.5);
    return kinds.length + 2;
  }
}
