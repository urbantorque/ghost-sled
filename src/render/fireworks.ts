import { AddEquation, BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, type Vector3 } from 'three';

// Fireworks that read as fireworks (round 6). The old shells were particle sparkles and gouache dabs: from
// the lens, red and gold puffs. Now a shell climbs on a thin trail of embers, bursts with a flash into a
// sphere of bright streaks that stretch along their motion, slow against the air, droop under gravity and
// fade, and the crackling kinds break into glitter as they die. Every spark of every shell is one instanced
// draw of screen-facing streaks, drawn only while a show is in the air.
//
// Each streak lays its colour over the sky and takes a little of the sky away behind it (a premultiplied
// blend with a small alpha), so a vermillion star still reads against a bright peach dusk; on Medium and
// High its core runs past the bloom threshold, and on Low a soft halo in the streak itself does the glow.
// Colours are the rider's warm ones and the lantern's (ART.md section 13): vermillion, coral, marigold and
// white-gold, never mint or rose. Reduced motion keeps the show and drops the glitter's twinkle and most
// of the burst's flash.

export const FW_VERMILLION = new Color('#FF4D2E');
export const FW_CORAL = new Color('#FF8A5C');
export const FW_MARIGOLD = new Color('#FFD34D');
export const FW_WHITE_GOLD = new Color('#FFF3C4');
/** Shell pairs (main stars, accent stars) in the show's order. */
export const FW_PAIRS: readonly (readonly [Color, Color])[] = [
  [FW_VERMILLION, FW_WHITE_GOLD],
  [FW_MARIGOLD, FW_CORAL],
  [FW_WHITE_GOLD, FW_VERMILLION],
  [FW_CORAL, FW_MARIGOLD],
];

export type ShellKind = 'peony' | 'chrysanthemum' | 'ring' | 'willow' | 'crackle';
const KINDS: readonly ShellKind[] = ['peony', 'chrysanthemum', 'crackle', 'ring', 'willow'];

/** Spark kinds: a burst's star, an ember of a climbing shell's trail, a glitter fleck, the burst's flash (the climbing shells themselves are drawn from `pending`). */
const STAR = 0;
const EMBER = 2;
const GLITTER = 3;
const FLASH = 4;

const CAP = 2600;
const GRAV = 9.8;

interface Pending {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  a: Color;
  b: Color;
  kind: ShellKind;
  emberAcc: number;
}

function streakGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  // Two triangles; aCorner x runs across the streak, y from its tail cap (-1) to its head cap (+1).
  const c = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
  g.setAttribute('position', new BufferAttribute(new Float32Array(18), 3));
  g.setAttribute('aCorner', new BufferAttribute(new Float32Array(c), 2));
  return g;
}

function streakMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // (A streak turns with its motion on screen; either winding may face the lens.)
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: {
      uViewH: { value: 720 },
      uAspect: { value: 16 / 9 },
      uHalo: { value: 0.3 },
      uTime: { value: 0 },
      uTwinkle: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aCorner;
      attribute vec3 iPos;
      attribute vec3 iVel;
      attribute vec4 iCol;
      attribute vec4 iShape;
      uniform float uViewH;
      uniform float uAspect;
      uniform float uTime;
      uniform float uTwinkle;
      varying vec2 vQ;
      varying float vHalfL;
      varying vec4 vCol;
      varying float vRound;
      void main() {
        vec4 hv = viewMatrix * vec4(iPos, 1.0);
        vec4 hc = projectionMatrix * hv;
        float round = step(iShape.y, 0.0);
        vec4 tc = projectionMatrix * (viewMatrix * vec4(iPos - iVel * max(iShape.y, 0.0), 1.0));
        vec2 hs = hc.xy / max(hc.w, 0.001);
        vec2 ts = tc.xy / max(tc.w, 0.001);
        // Screen space with x in the same units as y.
        vec2 d = (hs - ts) * vec2(uAspect, 1.0);
        float L = length(d);
        vec2 dir = L > 1e-5 ? d / L : vec2(0.0, 1.0);
        vec2 perp = vec2(dir.y, -dir.x);
        // Half its width on screen, never under about a pixel and a half.
        float w = max(iShape.x * projectionMatrix[1][1] / max(-hv.z, 0.1), 1.6 * 2.0 / uViewH);
        float halfL = L * 0.5;
        vec2 mid = (hs + ts) * 0.5 * vec2(uAspect, 1.0);
        vec2 p = mid + dir * aCorner.y * (halfL + w) + perp * aCorner.x * w;
        vQ = vec2(aCorner.x, aCorner.y * (halfL / w + 1.0));
        vHalfL = halfL / w;
        vRound = round;
        // Glitter twinkles (from its seed in iShape.z); everything else is steady.
        float tw = iShape.w > 0.5 ? mix(1.0, step(0.45, fract(uTime * 17.0 + iShape.z * 7.3)), uTwinkle) : 1.0;
        vCol = vec4(iCol.rgb, iCol.a * tw);
        gl_Position = vec4(p.x / uAspect * hc.w, p.y * hc.w, hc.z, hc.w);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHalo;
      varying vec2 vQ;
      varying float vHalfL;
      varying vec4 vCol;
      varying float vRound;
      void main() {
        float dy = max(abs(vQ.y) - vHalfL, 0.0);
        float dist = length(vec2(vQ.x, dy));
        if (dist > 1.0) discard;
        // A white-hot core, the colour round it, and a soft halo that carries the glow on Low.
        float core = exp(-dist * dist * 14.0);
        float body = exp(-dist * dist * 3.2);
        float halo = exp(-dist * dist * 1.1) * uHalo;
        // Brightest at the head, thinning toward the tail.
        float along = vRound > 0.5 ? 1.0 : clamp((vQ.y + vHalfL) / max(2.0 * vHalfL, 0.001), 0.0, 1.0);
        float k = mix(0.18, 1.0, along * along);
        vec3 col = (vCol.rgb * (body * 1.35 + halo) + mix(vCol.rgb, vec3(1.0, 0.95, 0.8), 0.4) * core * 0.5) * k * vCol.a;
        float a = clamp(body * 0.75 * k * vCol.a, 0.0, 1.0);
        gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb, a);
      }
    `,
  });
}

export class Fireworks {
  readonly mesh: InstancedMesh;
  private readonly mat: ShaderMaterial;
  private readonly iPos: InstancedBufferAttribute;
  private readonly iVel: InstancedBufferAttribute;
  private readonly iCol: InstancedBufferAttribute;
  private readonly iShape: InstancedBufferAttribute;
  // Sparks, one slot each.
  private n = 0;
  private readonly px = new Float32Array(CAP);
  private readonly py = new Float32Array(CAP);
  private readonly pz = new Float32Array(CAP);
  private readonly vx = new Float32Array(CAP);
  private readonly vy = new Float32Array(CAP);
  private readonly vz = new Float32Array(CAP);
  private readonly life = new Float32Array(CAP);
  private readonly max = new Float32Array(CAP);
  private readonly rgb = new Float32Array(CAP * 3);
  private readonly bright = new Float32Array(CAP);
  private readonly width = new Float32Array(CAP);
  private readonly tail = new Float32Array(CAP);
  private readonly drag = new Float32Array(CAP);
  private readonly grav = new Float32Array(CAP);
  private readonly kind = new Uint8Array(CAP);
  private readonly crackle = new Uint8Array(CAP);
  private readonly seed = new Float32Array(CAP);
  private readonly pending: Pending[] = [];
  private budget = 1;
  private reduced = false;
  private time = 0;

  constructor() {
    const geo = streakGeometry();
    this.iPos = new InstancedBufferAttribute(new Float32Array(CAP * 3), 3).setUsage(DynamicDrawUsage);
    this.iVel = new InstancedBufferAttribute(new Float32Array(CAP * 3), 3).setUsage(DynamicDrawUsage);
    this.iCol = new InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(DynamicDrawUsage);
    this.iShape = new InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iVel', this.iVel);
    geo.setAttribute('iCol', this.iCol);
    geo.setAttribute('iShape', this.iShape);
    this.mat = streakMaterial();
    this.mesh = new InstancedMesh(geo, this.mat, CAP);
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  /** How many sparks a shell throws (the tier's particle budget), and whether bloom carries the glow. */
  setQuality(budget: number, bloom: boolean): void {
    this.budget = Math.max(0.3, Math.min(1, budget));
    this.mat.uniforms.uHalo.value = bloom ? 0.22 : 0.5;
  }

  setViewport(hPx: number, aspect: number): void {
    this.mat.uniforms.uViewH.value = Math.max(1, hPx);
    this.mat.uniforms.uAspect.value = Math.max(0.1, aspect);
  }

  setReduced(on: boolean): void {
    this.reduced = on;
    this.mat.uniforms.uTwinkle.value = on ? 0 : 1;
  }

  get busy(): boolean {
    return this.n > 0 || this.pending.length > 0;
  }

  clear(): void {
    this.n = 0;
    this.pending.length = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /** A shell from `from` that bursts at `to` after `rise` seconds (three.js space). */
  shell(from: Vector3, to: Vector3, rise: number, a: Color, b: Color, kind?: ShellKind): void {
    const t = Math.max(0.3, rise);
    const g = GRAV * 0.55;
    this.pending.push({
      t,
      x: from.x,
      y: from.y,
      z: from.z,
      vx: (to.x - from.x) / t,
      vy: (to.y - from.y) / t + 0.5 * g * t,
      vz: (to.z - from.z) / t,
      a,
      b,
      kind: kind ?? KINDS[Math.floor(Math.random() * KINDS.length)],
      emberAcc: 0,
    });
  }

  private spark(k: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, c: Color, bright: number, width: number, tail: number, drag: number, grav: number): number {
    if (this.n >= CAP) return -1;
    const i = this.n++;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.rgb[i * 3] = c.r;
    this.rgb[i * 3 + 1] = c.g;
    this.rgb[i * 3 + 2] = c.b;
    this.bright[i] = bright;
    this.width[i] = width;
    this.tail[i] = tail;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.kind[i] = k;
    this.crackle[i] = 0;
    this.seed[i] = Math.random();
    return i;
  }

  private burst(p: Pending): void {
    const { x, y, z, a, b, kind } = p;
    // The flash: a soft round burst of light, held down under reduced motion.
    this.spark(FLASH, x, y, z, 0, 0, 0, 0.2, FW_WHITE_GOLD, this.reduced ? 0.6 : 2.4, 5.5, 0, 0, 0);
    this.spark(FLASH, x, y, z, 0, 0, 0, 0.32, a, this.reduced ? 0.35 : 1.1, 10, 0, 0, 0);
    const willow = kind === 'willow';
    const ring = kind === 'ring';
    const chrys = kind === 'chrysanthemum';
    const count = Math.round((willow ? 84 : ring ? 64 : 120) * this.budget);
    const gold = Math.PI * (3 - Math.sqrt(5));
    // A ring is tipped toward the lens a little, at its own angle.
    const tilt = Math.random() * Math.PI;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const speed = willow ? 17 : chrys ? 26 : 23;
    for (let i = 0; i < count; i++) {
      let dx: number;
      let dy: number;
      let dz: number;
      if (ring) {
        const th = (i / count) * Math.PI * 2;
        const rx = Math.cos(th);
        const ry = Math.sin(th);
        dx = rx;
        dy = ry * ct;
        dz = ry * st;
      } else {
        dy = 1 - ((i + 0.5) / count) * 2;
        const r = Math.sqrt(Math.max(0, 1 - dy * dy));
        const th = i * gold + Math.random() * 0.2;
        dx = Math.cos(th) * r;
        dz = Math.sin(th) * r;
      }
      const s = speed * (0.86 + Math.random() * 0.28);
      const c = willow ? FW_MARIGOLD : i % 4 === 3 ? b : a;
      const life = willow ? 2.2 + Math.random() * 0.7 : 1.25 + Math.random() * 0.6;
      const j = this.spark(STAR, x, y, z, dx * s, dy * s, dz * s, life, c, willow ? 1.3 : 1.7, willow ? 0.34 : 0.45, willow ? 0.45 : chrys ? 0.32 : 0.24, willow ? 1.25 : 1.7, willow ? 4.2 : 3.2);
      if (j >= 0 && (kind === 'crackle' || (chrys && i % 3 === 0))) this.crackle[j] = 1;
    }
  }

  /** Per frame, render seconds. */
  update(dt: number): void {
    if (!this.busy) return;
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    const g = GRAV * 0.55;
    // Shells on their way up: a bright head on a thin trail of embers.
    for (let k = this.pending.length - 1; k >= 0; k--) {
      const p = this.pending[k];
      const step = Math.min(dt, p.t);
      p.vy -= g * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.z += p.vz * step;
      p.t -= step;
      p.emberAcc += step;
      while (p.emberAcc > 0.018) {
        p.emberAcc -= 0.018;
        this.spark(EMBER, p.x, p.y, p.z, p.vx * 0.08 + (Math.random() - 0.5) * 0.6, p.vy * 0.08, p.vz * 0.08 + (Math.random() - 0.5) * 0.6, 0.38 + Math.random() * 0.3, FW_WHITE_GOLD, 0.7, 0.07, 0.05, 1.4, 2.5);
      }
      if (p.t <= 0) {
        this.pending.splice(k, 1);
        this.burst(p);
      }
    }
    // The heads of the shells still climbing are drawn as streaks along their climb.
    let w = 0;
    const pos = this.iPos.array as Float32Array;
    const vel = this.iVel.array as Float32Array;
    const col = this.iCol.array as Float32Array;
    const shp = this.iShape.array as Float32Array;
    for (const p of this.pending) {
      pos[w * 3] = p.x;
      pos[w * 3 + 1] = p.y;
      pos[w * 3 + 2] = p.z;
      vel[w * 3] = p.vx;
      vel[w * 3 + 1] = p.vy;
      vel[w * 3 + 2] = p.vz;
      col.set([p.a.r * 1.6, p.a.g * 1.6, p.a.b * 1.6, 1], w * 4);
      shp.set([0.12, 0.06, 0, 0], w * 4);
      w++;
    }
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const dr = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= dr;
      this.vy[i] = this.vy[i] * dr - this.grav[i] * dt;
      this.vz[i] *= dr;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      const age = 1 - this.life[i] / this.max[i];
      const kd = this.kind[i];
      // A dying crackle star throws glitter.
      if (this.crackle[i] && age > 0.55 && Math.random() < dt * 9) {
        this.spark(GLITTER, this.px[i], this.py[i], this.pz[i], this.vx[i] * 0.3 + (Math.random() - 0.5) * 2, this.vy[i] * 0.3 + (Math.random() - 0.5) * 2, this.vz[i] * 0.3 + (Math.random() - 0.5) * 2, 0.3 + Math.random() * 0.35, FW_WHITE_GOLD, 1.5, 0.09, 0, 1.5, 4);
      }
      let fade: number;
      if (kd === FLASH) fade = (1 - age) * (1 - age);
      else if (kd === STAR) fade = age < 0.06 ? age / 0.06 : 1 - Math.pow(Math.max(0, (age - 0.35) / 0.65), 1.6);
      else fade = 1 - age;
      // A star cools toward the end of its life: its colour deepens a little as it fades.
      const cool = kd === STAR ? 1 - 0.25 * age : 1;
      const b = this.bright[i] * fade;
      if (w < CAP) {
        pos[w * 3] = this.px[i];
        pos[w * 3 + 1] = this.py[i];
        pos[w * 3 + 2] = this.pz[i];
        vel[w * 3] = this.vx[i];
        vel[w * 3 + 1] = this.vy[i];
        vel[w * 3 + 2] = this.vz[i];
        col[w * 4] = this.rgb[i * 3] * b;
        col[w * 4 + 1] = this.rgb[i * 3 + 1] * b * cool;
        col[w * 4 + 2] = this.rgb[i * 3 + 2] * b * cool;
        col[w * 4 + 3] = Math.min(1, fade * 1.2);
        shp[w * 4] = this.width[i];
        shp[w * 4 + 1] = kd === FLASH || kd === GLITTER ? 0 : this.tail[i];
        shp[w * 4 + 2] = this.seed[i];
        shp[w * 4 + 3] = kd === GLITTER ? 1 : 0;
        w++;
      }
      i++;
    }
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    this.iPos.needsUpdate = true;
    this.iVel.needsUpdate = true;
    this.iCol.needsUpdate = true;
    this.iShape.needsUpdate = true;
  }

  /** Swaps the last spark into slot `i`. */
  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.px[i] = this.px[j];
    this.py[i] = this.py[j];
    this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j];
    this.vy[i] = this.vy[j];
    this.vz[i] = this.vz[j];
    this.life[i] = this.life[j];
    this.max[i] = this.max[j];
    this.rgb[i * 3] = this.rgb[j * 3];
    this.rgb[i * 3 + 1] = this.rgb[j * 3 + 1];
    this.rgb[i * 3 + 2] = this.rgb[j * 3 + 2];
    this.bright[i] = this.bright[j];
    this.width[i] = this.width[j];
    this.tail[i] = this.tail[j];
    this.drag[i] = this.drag[j];
    this.grav[i] = this.grav[j];
    this.kind[i] = this.kind[j];
    this.crackle[i] = this.crackle[j];
    this.seed[i] = this.seed[j];
  }
}
