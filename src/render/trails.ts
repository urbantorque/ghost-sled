import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Mesh, NormalBlending, ShaderMaterial } from 'three';
import { Course } from '../sim/course';
import { LANTERN_POOL_GLSL, shared } from './materials';

// Skill written in the snow (ART.md section 4). The sled leaves two runner tracks pressed into the
// snow, a runner's width apart. A deep carve presses a wide periwinkle floor between them and throws
// up a broken, noisy lip on the outside (bright on the sun side), and a drift scrubs a wide fan of
// parallel scratches. The groove runs all the way down to the bottom of the frame, thinning a little
// near the lens, so the line you carved is written across the foreground. Ghost trails are one thin, crisp line each (about 15 cm, in the
// ghost's colour), normally blended at low alpha and fading with age and near the camera, so a pack
// of them reads as a few drawn lines, never a pastel band.

export type TrailStyle = 'groove' | 'ghost';

/** Half the distance between the sled's runners (meshes.ts sledGeometry), metres. */
const RUNNER = 0.28;
/** Half-width of a ghost trail ribbon: room for the 15 cm line plus its anti-aliased edge. */
const GHOST_HW = 0.13;

export class Trail {
  readonly mesh: Mesh;
  private geo: BufferGeometry;
  private pos: Float32Array;
  private across: Float32Array;
  private depth: Float32Array;
  private born: Float32Array;
  private perp: Float32Array;
  private fan: Float32Array;
  private hw: Float32Array;
  private head = 0;
  private count = 0;
  private lastX = NaN;
  private lastZ = NaN;
  private broken = true;
  private mat: ShaderMaterial;
  private segStart: Uint8Array;
  private dirtyFlag = false;
  private ghost: boolean;

  constructor(
    private course: Course,
    private max: number,
    style: TrailStyle,
    color?: Color,
  ) {
    this.ghost = style === 'ghost';
    this.segStart = new Uint8Array(max);
    this.geo = new BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3);
    this.across = new Float32Array(max * 2);
    this.depth = new Float32Array(max * 2);
    this.born = new Float32Array(max * 2);
    this.perp = new Float32Array(max * 2 * 2);
    this.fan = new Float32Array(max * 2);
    this.hw = new Float32Array(max * 2);
    for (let i = 0; i < max; i++) {
      this.across[i * 2] = -1;
      this.across[i * 2 + 1] = 1;
    }
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aAcross', new BufferAttribute(this.across, 1));
    this.geo.setAttribute('aDepth', new BufferAttribute(this.depth, 1).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aBorn', new BufferAttribute(this.born, 1).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aPerp', new BufferAttribute(this.perp, 2).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aFan', new BufferAttribute(this.fan, 1).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aHw', new BufferAttribute(this.hw, 1).setUsage(DynamicDrawUsage));
    const idx = new Uint32Array((max - 1) * 6);
    this.geo.setIndex(new BufferAttribute(idx, 1).setUsage(DynamicDrawUsage));
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      blending: NormalBlending,
      defines: this.ghost ? { GHOST: 1 } : {},
      uniforms: {
        uTime: shared.uTime,
        uDeep: shared.uSnowDeep,
        uShade: shared.uSnowShade,
        uLit: shared.uSnowLit,
        uSunColor: shared.uSunColor,
        uSunDir: shared.uSunDir,
        uFog: shared.uFog,
        uFogNear: shared.uFogNear,
        uFogFar: shared.uFogFar,
        uLanternPos: shared.uLanternPos,
        uLanternColor: shared.uLanternColor,
        uLantern: shared.uLantern,
        uLanternLow: shared.uLanternLow,
        uFocus: shared.uFocus,
        uIceMood: shared.uIceMood,
        uColor: { value: color ?? new Color('#8FF3E4') },
        uLife: { value: this.ghost ? 7 : 26 },
      },
      vertexShader: /* glsl */ `
        attribute float aAcross;
        attribute float aDepth;
        attribute float aBorn;
        attribute vec2 aPerp;
        attribute float aFan;
        attribute float aHw;
        uniform float uTime;
        uniform vec3 uSunDir;
        varying float vAcross;
        varying float vSunSide;
        varying float vSunK;
        varying float vDepth;
        varying float vFan;
        varying float vAge;
        varying float vHw;
        varying vec3 vWorldPos;
        // How far up the screen this point sits, from the bottom edge (0) to the sled (1), so the groove
        // fades by where it lands in the frame, whatever the lens: a tall phone camera sees far more of
        // the wake below the sled than a low landscape one.
        varying float vScreenK;
        uniform vec3 uFocus;
        void main() {
          vAcross = aAcross;
          // +1 when this edge of the ribbon is the one facing the sun, -1 on the far edge; vSunK is the
          // same for the +across direction alone (constant along a segment).
          vec2 sxz = uSunDir.xz / max(length(uSunDir.xz), 0.001);
          vSunK = clamp(dot(aPerp, sxz) * 2.5, -1.0, 1.0);
          vSunSide = aAcross * vSunK;
          vDepth = aDepth;
          vFan = aFan;
          vHw = aHw;
          vAge = uTime - aBorn;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
          vec4 rc = projectionMatrix * viewMatrix * vec4(uFocus - vec3(0.0, 0.9, 0.0), 1.0);
          vScreenK = gl_Position.w > 0.05 && rc.w > 0.05 ? (gl_Position.y / gl_Position.w + 1.0) / max(rc.y / rc.w + 1.0, 0.05) : 0.0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uDeep;
        uniform vec3 uShade;
        uniform vec3 uLit;
        uniform vec3 uSunColor;
        uniform vec3 uFog;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform vec3 uLanternPos;
        uniform vec3 uLanternColor;
        uniform float uLantern;
        uniform vec4 uLanternLow;
        uniform vec3 uFocus;
        uniform float uIceMood;
        uniform vec3 uColor;
        uniform float uLife;
        varying float vAcross;
        varying float vSunSide;
        varying float vSunK;
        varying float vDepth;
        varying float vFan;
        varying float vAge;
        varying float vHw;
        varying vec3 vWorldPos;
        varying float vScreenK;
        ${LANTERN_POOL_GLSL}
        float h12(vec2 p) {
          vec3 q = fract(vec3(p.xyx) * 0.1031);
          q += dot(q, q.yzx + 33.33);
          return fract((q.x + q.y) * q.z);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        /** A line |x| < hw in metres, anti-aliased and never thinner than about a pixel: past that
         *  it keeps its pixel width and thins out instead, so a far line never crawls. */
        float line(float x, float hw, float px) {
          float w = max(hw, px * 0.6);
          return smoothstep(w + px * 0.75, w - px * 0.75, abs(x)) * (hw / w);
        }
        /** A soft band from lo to hi metres across, feathered by f on both edges, held to at least
         *  about a pixel wide (and fainter) far away. */
        float band(float x, float lo, float hi, float f, float px) {
          float w = hi - lo;
          float wp = max(w, px * 1.2);
          float h = wp * 0.5;
          return (1.0 - smoothstep(h - f * 0.5 - px * 0.4, h + f * 0.5 + px * 0.4, abs(x - (lo + hi) * 0.5))) * (w / wp);
        }
        void main() {
          float fade = clamp(1.0 - vAge / uLife, 0.0, 1.0);
          float d = length(cameraPosition - vWorldPos);
          float fogF = smoothstep(uFogNear, uFogFar, d);
          // View depth of this fragment and of the rider (the sled, under the focus point). The near
          // fades run on depth relative to the rider, so they hold at any camera distance, and they
          // fall evenly across the bottom of the frame instead of curving round the lens. A camera
          // looking away from the rider (the rear-view mirror) sees the trails at full strength.
          float zf = -(viewMatrix * vec4(vWorldPos, 1.0)).z;
          float zr = max(-(viewMatrix * vec4(uFocus - vec3(0.0, 0.9, 0.0), 1.0)).z, 0.0);
          // Across the ribbon in metres, and how many metres one pixel spans there.
          float x = vAcross * vHw;
          float px = max(fwidth(x), 0.0005);
          #ifdef GHOST
            // One thin, crisp line in the ghost's colour. Bright snow needs a deeper tint of it to
            // show at all (a pale line on cream reads as nothing); at night the line glows.
            float day = smoothstep(0.25, 0.65, dot(uLit, vec3(0.2126, 0.7152, 0.0722)));
            float core = line(x, 0.075, px);
            vec3 col = mix(uColor, pow(uColor, vec3(1.7)) * 0.85, day * 0.55);
            // Gone before it reaches the lens: the lower third of the frame belongs to the snow. A line
            // shows from just behind the rider onward, where it says which way that ghost went.
            float nearK = zr > 1.0 ? smoothstep(zr * 0.7, zr * 1.35, zf) : 1.0;
            float alpha = core * fade * sqrt(fade) * mix(0.55, 0.42, day) * nearK * (1.0 - fogF) * mix(1.0, 0.45, smoothstep(25.0, 80.0, d));
            col = mix(col, uFog, fogF * 0.5);
            gl_FragColor = vec4(col, alpha);
          #else
            float a = abs(x);
            float deep = vDepth;
            // Edges and the lip wander with the snow, never a ruled line.
            float nz = vnoise(vWorldPos.xz * 2.7) - 0.5;
            float nz2 = vnoise(vWorldPos.xz * 7.3 + 17.0) - 0.5;
            float an = a + nz * 0.07 * (0.4 + deep);
            // Toward the lens the marks soften (a wider feather, a little less contrast), so up close
            // they read as carved snow under raking light, never as two hard stripes of road paint.
            float soft = zr > 1.0 ? 1.0 - smoothstep(0.12, 0.6, vScreenK) : 0.0;
            // Which way the sun lies across the track, and how strongly (0 with the sun straight ahead).
            float sunK = abs(vSunK);
            // Two runner cuts pressed into the snow, a runner's width apart, wider and deeper the harder
            // the carve. Each wanders a little and presses deeper in places, so it reads carved, not ruled.
            float tw = (0.03 + 0.05 * deep) * (0.8 + 0.4 * (nz + 0.5));
            // Across one cut in metres from its centre line, signed toward the sun.
            float u = sign(x) * (a - ${RUNNER.toFixed(2)} + nz2 * 0.014) * sign(vSunK + 0.0001);
            float fe = tw * mix(0.5, 1.4, soft);
            float cut = band(u, -tw, tw, fe, px) * (0.75 + 0.25 * (nz2 + 0.5)) * (1.0 - vFan * 0.7);
            // The sun-side wall of each cut sits in its own shadow, the far wall in the light.
            float cutShade = smoothstep(-0.3 * tw, 0.9 * tw, u) * sunK;
            // And a bright lip of packed snow along its sun-side edge, catching the light; the far lip
            // more faintly. With the low sun ahead (sunK near 0) both lips are backlit and catch it: a cut
            // with no bright edge read as a soft blue shadow line, not snow pressed aside.
            float lw = 0.03 + 0.04 * deep;
            float lipS = band(u, tw * 0.75, tw * 0.75 + lw, lw * mix(0.6, 1.2, soft), px) * mix(0.6, 1.0, sunK) * (1.0 - vFan * 0.6);
            float lipF = band(-u, tw * 0.75, tw * 0.75 + lw, lw * mix(0.6, 1.2, soft), px) * (1.0 - sunK * 0.6) * 0.65 * (1.0 - vFan * 0.6);
            float scratch = (0.5 + 0.5 * sin(vAcross * 21.0 + nz * 3.0)) * smoothstep(vHw, vHw * 0.6, an) * vFan;
            // The pressed floor between and just around the runners, as deep as the carve.
            float floorW = ${RUNNER.toFixed(2)} + tw + 0.03 + (vHw - ${RUNNER.toFixed(2)}) * 0.35 * deep;
            float floor0 = smoothstep(floorW + px + 0.04 * soft, floorW - px - 0.04 - 0.1 * soft, an);
            // A deep carve throws a lip of snow up on the outside, broken into clumps.
            float lipR = mix(floorW, vHw, 0.55);
            float lip = smoothstep(floorW - 0.01, lipR, an) * smoothstep(vHw, lipR, an) * smoothstep(0.22, 0.65, deep);
            lip *= smoothstep(-0.25, 0.2, nz2 + nz * 0.5);
            float sunLip = lip * smoothstep(-0.3, 0.4, vSunSide);
            // Soft periwinkle in the cut (never navy: a navy cut read as a painted line), deeper with the
            // carve, and a step deeper on the shaded wall.
            vec3 floorCol = mix(uShade, uDeep, 0.15 + 0.3 * deep);
            vec3 cutCol = mix(mix(uShade, uDeep, 0.12 + 0.3 * deep), mix(uShade, uDeep, 0.6), cutShade);
            vec3 lipCol = mix(mix(uShade, uLit, 0.7), uLit * uSunColor * 1.1, smoothstep(-0.3, 0.4, vSunSide));
            // A packed lip catching the sun reads a step above the lit snow beside it.
            vec3 brightLip = mix(uLit, vec3(1.0), 0.15) * mix(vec3(1.0), uSunColor, 0.4);
            // Layered bottom to top, premultiplied: the floor, the drift's scratches, the cuts and lips.
            float kf = floor0 * (0.06 + 0.46 * smoothstep(0.15, 0.7, deep) + 0.18 * vFan);
            vec3 P = floorCol * kf;
            float A = kf;
            float ks = scratch * 0.5;
            P = mix(uShade, uDeep, 0.5) * ks + P * (1.0 - ks);
            A = ks + A * (1.0 - ks);
            // The wall under the outer sun-side lip of a deep carve sits in its own shadow.
            float wall = smoothstep(floorW - 0.06, floorW, an) * (1.0 - smoothstep(floorW, lipR, an)) * deep * smoothstep(0.1, 0.5, vSunSide) * 0.45;
            P = mix(uShade, uDeep, 0.55) * wall + P * (1.0 - wall);
            A = wall + A * (1.0 - wall);
            float kc = cut * (0.36 + 0.4 * deep) * mix(1.0, 0.8, soft);
            P = cutCol * kc + P * (1.0 - kc);
            A = kc + A * (1.0 - kc);
            float kl = max(sunLip * 0.9, lip * 0.45);
            P = lipCol * kl + P * (1.0 - kl);
            A = kl + A * (1.0 - kl);
            // Never a white stripe: the trail cannot see the cast shadows, and a full-strength lip across shaded
            // snow (the rider's own shadow, a phone's darker foreground) read as a painted line.
            float kb = max(lipS * 0.42, lipF * 0.28) * mix(1.0, 0.45, soft);
            P = brightLip * kb + P * (1.0 - kb);
            A = kb + A * (1.0 - kb);
            vec3 col = P / max(A, 0.001);
            // The sled lantern's amber pool falls into the groove too (the same pool as the snow's).
            if (uLantern > 0.0) {
              // Exactly the snow's pool, so outside it the cut never glows amber on its own; inside it
              // the cut sits a step darker than the lit snow around it.
              float pool = lanternPool(vWorldPos.xz, uLanternLow) * uLantern;
              col = col * (1.0 - 0.8 * min(pool, 1.0)) + lanternLamp(uLanternColor) * pool * 0.72;
            }
            col = mix(col, uFog, fogF);
            float alpha = A;
            // Full behind the sled down through the near-mid ground, easing evenly to a little over half
            // by the bottom edge: the critics wanted the carve written in the foreground, where a groove
            // that dissolved early left the lower third blank. A camera looking away from the rider
            // (the rear-view mirror) sees it at full strength.
            float nearK = zr > 1.0 ? mix(0.6, 1.0, smoothstep(0.0, 0.6, vScreenK)) : 1.0;
            alpha *= fade * nearK * smoothstep(vHw, vHw - 0.05, an) * (1.0 - fogF * 0.5);
            // Runners only scratch glass ice: a shallower, fainter cut than in powder.
            if (uIceMood >= 1.0) alpha *= 0.55;
            gl_FragColor = vec4(col, alpha);
          #endif
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  setCourse(course: Course): void {
    this.course = course;
    this.clear();
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
    this.broken = true;
    this.lastX = NaN;
    this.geo.setDrawRange(0, 0);
  }

  /** End the current stroke (sled went airborne). */
  lift(): void {
    this.broken = true;
  }

  /** Add a sample at sim coordinates. Width in metres, depth 0..1. */
  add(x: number, z: number, width: number, depth: number, time: number): void {
    if (!Number.isNaN(this.lastX)) {
      const dx = x - this.lastX;
      const dz = z - this.lastZ;
      if (dx * dx + dz * dz < 0.36) return;
    }
    let tx = 0;
    let tz = 1;
    if (!Number.isNaN(this.lastX)) {
      const dx = x - this.lastX;
      const dz = z - this.lastZ;
      const l = Math.sqrt(dx * dx + dz * dz) || 1;
      tx = dx / l;
      tz = dz / l;
    }
    const startNew = this.broken;
    this.lastX = x;
    this.lastZ = z;
    this.broken = false;
    const i = this.head;
    // A drift asks for a much wider groove than any carve (world.ts): that is the scrubbed fan.
    const fan = this.ghost ? 0 : Math.max(0, Math.min(1, (width - 0.95) / 0.7));
    // Ghost lines are a fixed hairline. The groove is a runner's width plus a lip that grows with
    // the carve; only a drift fans out wider.
    const hw = this.ghost ? GHOST_HW : Math.max(RUNNER + 0.12 + 0.3 * Math.min(1, depth), width * 0.45 * fan);
    // Perpendicular in sim space.
    const px = tz;
    const pz = -tx;
    const lx = x - px * hw;
    const lz = z - pz * hw;
    const rx = x + px * hw;
    const rz = z + pz * hw;
    const c = this.course;
    const o = i * 6;
    this.pos[o] = lx;
    this.pos[o + 1] = c.ground(lx, lz) + 0.04;
    this.pos[o + 2] = -lz;
    this.pos[o + 3] = rx;
    this.pos[o + 4] = c.ground(rx, rz) + 0.04;
    this.pos[o + 5] = -rz;
    this.depth[i * 2] = this.depth[i * 2 + 1] = depth;
    this.born[i * 2] = this.born[i * 2 + 1] = time;
    // Across direction in three.js space (z flipped), for the sun-side lip.
    this.perp[i * 4] = this.perp[i * 4 + 2] = px;
    this.perp[i * 4 + 1] = this.perp[i * 4 + 3] = -pz;
    this.fan[i * 2] = this.fan[i * 2 + 1] = fan;
    this.hw[i * 2] = this.hw[i * 2 + 1] = hw;
    this.segStart[i] = startNew ? 1 : 0;
    this.head = (this.head + 1) % this.max;
    this.count = Math.min(this.count + 1, this.max);
    this.dirtyFlag = true;
  }

  flush(): void {
    if (!this.dirtyFlag) return;
    this.dirtyFlag = false;
    const idx = this.geo.index as BufferAttribute;
    const arr = idx.array as Uint32Array;
    let q = 0;
    const n = this.count;
    const start = (this.head - n + this.max) % this.max;
    for (let k = 0; k < n - 1; k++) {
      const a = (start + k) % this.max;
      const b = (a + 1) % this.max;
      if (this.segStart[b]) continue;
      const a0 = a * 2;
      const b0 = b * 2;
      arr[q++] = a0;
      arr[q++] = a0 + 1;
      arr[q++] = b0;
      arr[q++] = a0 + 1;
      arr[q++] = b0 + 1;
      arr[q++] = b0;
    }
    idx.needsUpdate = true;
    this.geo.setDrawRange(0, q);
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aDepth') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aBorn') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aPerp') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aFan') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aHw') as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
