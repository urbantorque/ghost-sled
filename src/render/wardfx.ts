import { AddEquation, BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, OneFactor, OneMinusSrcAlphaFactor, Quaternion, ShaderMaterial, Vector3 } from 'three';

// A ward cracks the lantern open (round 6). At the hit a marigold paper lantern stands round the rider,
// glowing from inside; cracks of white-gold light run across its panels, and it breaks: the panels fly
// out as shards that spin, cool from white-gold to marigold and fade, and a ring of light runs out flat
// over the snow from the rider. The lantern is made of its own shards, so shell, shards and ring are one
// instanced draw, and only while a ward plays (about a second); the rest of the time it draws nothing.
// A premultiplied blend lets the panels lay translucent light over the rider (alpha) while the ring and
// the cracks add theirs (alpha 0). The render's slow motion is the director's time scale, not this.
// Colours: marigold, the lantern's (ART.md section 1), burning toward white-gold.

const MARIGOLD = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const CREAM = new Color('#FFF1D6');

/** The lantern round the seated rider: its height, its widest radius and how far over the sled it starts. */
const LANTERN_H = 1.55;
const LANTERN_R = 0.86;
const LANTERN_Y0 = 0.08;
const ROWS = 5;
const COLS = 10;
const SHARDS = ROWS * COLS;
/** Render seconds: the lantern stands whole, its cracks burn in, then it breaks; all gone by END. */
const CRACK_AT = 0.035;
const BREAK_AT = 0.09;
const BREAK_AT_REDUCED = 0.2;
const END = 1.05;
/** How far the ring of light runs out over the snow (m), and how long it takes. */
const RING_R = 5.6;
const RING_S = 0.5;

/** The lantern's radius at height `h` (0 at its foot to LANTERN_H at its top): a round paper lantern,
 *  pinched at both ends where the rims are. */
function lanternR(h: number): number {
  const u = Math.max(0, Math.min(1, h / LANTERN_H));
  return LANTERN_R * (0.42 + 0.58 * Math.sin(Math.PI * u));
}

interface Shard {
  p: Vector3;
  v: Vector3;
  q: Quaternion;
  axis: Vector3;
  spin: number;
  w: number;
  h: number;
  /** Where it sits on the whole lantern, relative to the rider's base. */
  rest: Vector3;
  restQ: Quaternion;
  out: Vector3;
  life: number;
}

function quadGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2));
  return g;
}

function wardMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: {
      uMarigold: { value: MARIGOLD.clone() },
      uWhiteGold: { value: WHITE_GOLD.clone() },
      uCream: { value: CREAM.clone() },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aWard;
      attribute float aSeed;
      varying vec2 vUv;
      varying vec4 vWard;
      varying float vSeed;
      varying float vFace;
      void main() {
        vUv = uv;
        vWard = aWard;
        vSeed = aSeed;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
        vFace = abs(dot(n, normalize(cameraPosition - wp.xyz)));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMarigold;
      uniform vec3 uWhiteGold;
      uniform vec3 uCream;
      varying vec2 vUv;
      varying vec4 vWard;
      varying float vSeed;
      varying float vFace;
      float h1(float x) { return fract(sin(x * 91.17) * 43758.5453); }
      void main() {
        float alpha = vWard.x;
        float crack = vWard.y;
        float heat = vWard.z;
        vec2 q = vUv - 0.5;
        if (vWard.w > 0.5) {
          // The ring of light, flat over the snow: a bright band at its rim and a soft wash inside it.
          float r = length(q) * 2.0;
          if (r > 1.0) discard;
          float band = exp(-pow((r - 0.9) / 0.06, 2.0));
          float wash = 0.12 * smoothstep(1.0, 0.3, r) * smoothstep(0.0, 0.5, r);
          // It tints what it runs over toward marigold as well as adding light (a premultiplied blend with
          // some alpha): added alone, it washed out to white on the snow.
          float k = (band + wash) * alpha;
          vec3 col = linearToOutputTexel(vec4(mix(uMarigold, uWhiteGold, band * 0.5), 1.0)).rgb;
          gl_FragColor = vec4(col * k * 0.9, clamp(k * 0.6, 0.0, 0.9));
          return;
        }
        // Two seeded cuts across the panel: the line it breaks along, and the edge that makes it a shard.
        float a1 = h1(vSeed) * 6.2831;
        float a2 = h1(vSeed + 3.7) * 6.2831;
        vec2 n1 = vec2(cos(a1), sin(a1));
        vec2 n2 = vec2(cos(a2), sin(a2));
        float c1 = 0.12 + 0.18 * h1(vSeed + 1.3);
        float c2 = 0.12 + 0.18 * h1(vSeed + 5.1);
        float d1 = dot(q, n1) - c1;
        float d2 = dot(q, n2) - c2;
        if (crack > 0.5 && (d1 > 0.0 || d2 > 0.0)) discard;
        // Paper lit from inside: brightest in the middle of the panel, a darker rib round its edge.
        float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float rib = smoothstep(0.0, 0.09, e);
        float g = clamp(1.0 - length(q) * 1.5, 0.0, 1.0);
        vec3 paper = mix(uMarigold, mix(uMarigold, uCream, 0.45) * 1.15, g) * (0.6 + 0.4 * rib);
        // The cracks burn white-gold along the cut lines before it breaks; a shard runs hot, then cools.
        float lines = (1.0 - smoothstep(0.0, 0.035, abs(d1))) + (1.0 - smoothstep(0.0, 0.035, abs(d2)));
        vec3 glow = uWhiteGold * (lines * heat * 1.5 * (1.0 - crack) + heat * 0.35 * crack);
        // A paper lantern is densest at its rims, where the eye looks through more of it; face on it stays
        // thin, so it never turns into a wall between the lens and the rider.
        float a = alpha * (0.34 + 0.22 * g + 0.3 * (1.0 - vFace));
        gl_FragColor = vec4(linearToOutputTexel(vec4(paper, 1.0)).rgb * a + linearToOutputTexel(vec4(glow, 1.0)).rgb * alpha, a);
      }
    `,
  });
}

export class WardFx {
  readonly mesh: InstancedMesh;
  private readonly ward: InstancedBufferAttribute;
  private readonly seed: InstancedBufferAttribute;
  private readonly shards: Shard[] = [];
  /** Render seconds since the ward, -1 while none plays. */
  private t = -1;
  private broken = false;
  private reduced = false;
  private readonly anchor = new Vector3();
  private readonly carrier = new Vector3();
  private readonly ringAt = new Vector3();
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly v = new Vector3();
  private readonly flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

  constructor() {
    const geo = quadGeometry();
    this.ward = new InstancedBufferAttribute(new Float32Array((SHARDS + 1) * 4), 4).setUsage(DynamicDrawUsage);
    this.seed = new InstancedBufferAttribute(new Float32Array(SHARDS + 1), 1);
    geo.setAttribute('aWard', this.ward);
    geo.setAttribute('aSeed', this.seed);
    this.mesh = new InstancedMesh(geo, wardMaterial(), SHARDS + 1);
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    // The lantern's panels: rows up its height, columns round it, each a quad tangent to the paper.
    const up = new Vector3(0, 1, 0);
    const sd = this.seed.array as Float32Array;
    for (let r = 0; r < ROWS; r++) {
      const h0 = (r / ROWS) * LANTERN_H;
      const h1 = ((r + 1) / ROWS) * LANTERN_H;
      const hm = (h0 + h1) / 2;
      const rad = lanternR(hm);
      const slope = (lanternR(h1) - lanternR(h0)) / (h1 - h0);
      for (let c = 0; c < COLS; c++) {
        const a = ((c + (r % 2) * 0.5) / COLS) * Math.PI * 2;
        const out = new Vector3(Math.sin(a), 0, Math.cos(a));
        const rest = out.clone().multiplyScalar(rad).setY(LANTERN_Y0 + hm);
        // The panel faces out along the paper's normal (tilted by the lantern's swell).
        const nrm = out.clone().addScaledVector(up, -slope).normalize();
        const restQ = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), nrm);
        const w = ((2 * Math.PI * rad) / COLS) * 1.02;
        const hh = Math.hypot(h1 - h0, lanternR(h1) - lanternR(h0)) * 1.02;
        const i = this.shards.length;
        sd[i] = i * 1.618 + 0.37;
        this.shards.push({ p: new Vector3(), v: new Vector3(), q: new Quaternion(), axis: new Vector3(), spin: 0, w, h: hh, rest, restQ, out: nrm, life: 0 });
      }
    }
    sd[SHARDS] = 0;
    this.seed.needsUpdate = true;
  }

  /** A ward at the rider's base (three.js space), riding at `vel`. */
  start(base: Vector3, vel: Vector3, reduced: boolean): void {
    this.t = 0;
    this.broken = false;
    this.reduced = reduced;
    this.anchor.copy(base);
    this.carrier.copy(vel);
    this.mesh.visible = true;
  }

  get playing(): boolean {
    return this.t >= 0;
  }

  /** Per frame (render dt), with where the rider is now. */
  update(dt: number, base: Vector3, vel: Vector3): void {
    if (this.t < 0) return;
    this.t += dt;
    const t = this.t;
    const breakAt = this.reduced ? BREAK_AT_REDUCED : BREAK_AT;
    if (!this.broken) {
      // Whole, the lantern rides with the rider.
      this.anchor.copy(base);
      this.carrier.copy(vel);
    }
    if (!this.broken && t >= breakAt) this.breakOpen(base);
    const wa = this.ward.array as Float32Array;
    let n = 0;
    if (!this.broken) {
      // It swells into place in a few frames (gentler under reduced motion: no pop of light).
      const k = this.reduced ? Math.min(1, t / 0.12) : Math.min(1, t / 0.03);
      const grow = 0.86 + 0.14 * k * (2 - k);
      const crack = Math.max(0, Math.min(1, (t - CRACK_AT) / Math.max(0.01, breakAt - CRACK_AT)));
      for (const sh of this.shards) {
        this.v.copy(sh.rest).multiplyScalar(grow);
        this.v.y = sh.rest.y * (0.9 + 0.1 * grow);
        this.m.compose(this.v.add(this.anchor), sh.restQ, this.s.set(sh.w * grow, sh.h * grow, 1));
        this.mesh.setMatrixAt(n, this.m);
        wa.set([0.9 * k, 0, crack * (this.reduced ? 0.6 : 1), 0], n * 4);
        n++;
      }
    } else {
      const since = t - breakAt;
      const drag = Math.exp(-2.2 * dt);
      for (const sh of this.shards) {
        if (sh.life <= 0) continue;
        sh.life -= dt;
        // A shard keeps most of the sled's speed (so it streams past rather than vanishing behind),
        // flies out against the drag, droops and spins.
        sh.v.x = this.carrier.x * 0.88 + (sh.v.x - this.carrier.x * 0.88) * drag;
        sh.v.z = this.carrier.z * 0.88 + (sh.v.z - this.carrier.z * 0.88) * drag;
        sh.v.y -= 7.5 * dt;
        sh.p.addScaledVector(sh.v, dt);
        sh.q.premultiply(this.q.setFromAxisAngle(sh.axis, sh.spin * dt));
        const left = Math.max(0, sh.life);
        const fade = Math.min(1, left / 0.35);
        const shrink = 0.55 + 0.45 * fade;
        this.m.compose(sh.p, sh.q, this.s.set(sh.w * shrink, sh.h * shrink, 1));
        this.mesh.setMatrixAt(n, this.m);
        const heat = Math.max(0, 1 - since / 0.45);
        wa.set([fade, 1, heat, 0], n * 4);
        n++;
      }
      // The ring of light runs out flat over the snow from where the lantern broke, riding with the sled.
      if (since < RING_S) {
        const k = since / RING_S;
        const r = 0.9 + (RING_R - 0.9) * (1 - (1 - k) * (1 - k));
        this.ringAt.addScaledVector(this.carrier, dt * 0.92);
        this.m.compose(this.v.copy(this.ringAt), this.flat, this.s.set(r * 2, r * 2, 1));
        this.mesh.setMatrixAt(n, this.m);
        wa.set([(1 - k) * (1 - k) * (this.reduced ? 0.7 : 1), 0, 0, 1], n * 4);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.ward.needsUpdate = true;
    if (t > END || (this.broken && n === 0)) this.stop();
  }

  private breakOpen(base: Vector3): void {
    this.broken = true;
    this.ringAt.copy(base).setY(base.y + 0.25);
    for (const sh of this.shards) {
      sh.p.copy(sh.rest).add(this.anchor);
      sh.q.copy(sh.restQ);
      const out = 2.6 + Math.random() * 3.2;
      sh.v.copy(this.carrier).addScaledVector(sh.out, out);
      sh.v.y += 1.2 + Math.random() * 2.4;
      sh.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      sh.spin = (this.reduced ? 3 : 7) + Math.random() * 8;
      sh.life = 0.55 + Math.random() * 0.4;
    }
  }

  stop(): void {
    this.t = -1;
    this.broken = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }
}
