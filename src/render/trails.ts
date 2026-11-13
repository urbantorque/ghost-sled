import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Mesh, NormalBlending, ShaderMaterial } from 'three';
import { Course } from '../sim/course';
import { BUDGET, byTier } from './fxhub';
import { LANTERN_POOL_GLSL, shared } from './materials';

// Round 7: ruts last the run. Your own groove no longer ages away or thins toward the lens: it is cut into
// the snow for as long as it is in the buffer (540 m and more behind the sled), so the finish's swing, a
// wreck's orbit, the mirror and the reel all see the line you rode. Every ghost cuts real ruts too (two
// runner cuts in the snow's own shade, a lit lip beside each), which stay on the snow ahead of you until you
// ride over them; its light still fades in seven seconds, the rut under it does not. Budgets per tier are
// fxhub.ts BUDGET (samples kept, their spacing, how far ahead a rut is drawn and where it drops to every
// third sample); a far rut is the shader's own pixel-wide line. Only the samples added are uploaded.
//
// Skill written in the snow (ART.md section 4). The sled leaves two runner tracks pressed into the
// snow, a runner's width apart. A deep carve presses a wide periwinkle floor between them and throws
// up a broken, noisy lip on the outside (bright on the sun side), and a drift scrubs a wide fan of
// parallel scratches. The groove runs all the way down to the bottom of the frame, thinning a little
// near the lens, so the line you carved is written across the foreground. Ghosts leave two thin
// luminous runner lines each (GhostTrails, the whole field in one mesh), normally blended at low
// alpha and fading with age and near the camera, so a pack of them reads as a few sled tracks drawn
// in light, never a pastel band. (Trail's 'ghost' style, one line, is kept for any single trail.)

export type TrailStyle = 'groove' | 'ghost';

/** Half the distance between the sled's runners (meshes.ts sledGeometry), metres. */
const RUNNER = 0.28;
/** Half-width of a ghost trail ribbon: room for the 15 cm line plus its anti-aliased edge. */
const GHOST_HW = 0.13;
/** How far a groove's broken edges stretch along the track at speed: the snow's noise runs this many
 *  times longer at the cap, so a fast line reads as long streaks where a slow one reads as clumps. */
const STRETCH = 4.5;
const STRETCH_FROM = 14;
const STRETCH_TO = 46;

/** The groove's per-sample attributes and their sizes (each sample is two vertices). */
const TRAIL_DYNAMIC: ReadonlyArray<readonly [string, number]> = [
  ['position', 3],
  ['aDepth', 1],
  ['aBorn', 1],
  ['aPerp', 2],
  ['aFan', 1],
  ['aHw', 1],
  ['aArc', 1],
];

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
  /** Metres along the track, stretched by speed (the groove's noise runs along this). */
  private arc: Float32Array;
  private arcNow = 0;
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
    this.arc = new Float32Array(max * 2);
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
    this.geo.setAttribute('aArc', new BufferAttribute(this.arc, 1).setUsage(DynamicDrawUsage));
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
        attribute float aArc;
        uniform float uTime;
        uniform vec3 uSunDir;
        varying float vAcross;
        varying float vSunSide;
        varying float vSunK;
        varying float vDepth;
        varying float vFan;
        varying float vAge;
        varying float vHw;
        varying float vArc;
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
          vArc = aArc;
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
        varying float vArc;
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
          #ifdef GHOST
            float fade = clamp(1.0 - vAge / uLife, 0.0, 1.0);
          #else
            // A rut lasts the run: fresh it is crisp, and it settles a little over its first seconds (wind
            // softening its lips), never further.
            float fade = mix(0.84, 1.0, exp(-vAge * 0.3));
          #endif
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
            // (The noise runs along the track, stretched by the speed it was cut at.)
            vec2 tq = vec2(x, vArc);
            float nz = vnoise(tq * 2.7) - 0.5;
            float nz2 = vnoise(tq * 7.3 + 17.0) - 0.5;
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
            // Snow moved, not marked: a deep carve throws clods out past its lip, each a small lit crumb
            // with its own shade under it, thinning with distance from the cut. Stretched along the track
            // with the rest of the groove's noise, so at speed they are flecks, not dots.
            vec2 cq = vec2(x * 9.0, vArc * 3.2);
            vec2 ci = floor(cq);
            vec2 cf = fract(cq) - 0.5;
            float ch = h12(ci);
            float clod = step(0.8, ch) * smoothstep(0.34, 0.12, length(cf + (vec2(h12(ci + 7.0), h12(ci + 13.0)) - 0.5) * 0.4));
            float outside = smoothstep(floorW, floorW + 0.05, an) * smoothstep(vHw - 0.02, vHw - 0.2, an);
            float kcl = clod * outside * smoothstep(0.25, 0.7, deep) * (1.0 - soft * 0.5) * (1.0 - smoothstep(0.02, 0.06, px));
            vec3 clodCol = mix(mix(uShade, uDeep, 0.3), brightLip, smoothstep(-0.1, 0.25, cf.y * sign(vSunK + 0.0001) + 0.1));
            P = clodCol * kcl + P * (1.0 - kcl);
            A = kcl + A * (1.0 - kcl);
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
            // (Round 7: at full strength to the bottom edge. The groove no longer thins toward the lens;
            // its feather there, 'soft', is what keeps it from reading as paint.)
            alpha *= fade * smoothstep(vHw, vHw - 0.05, an) * (1.0 - fogF * 0.5);
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

  /** Add a sample at sim coordinates. Width in metres, depth 0..1, and the speed it was cut at. */
  add(x: number, z: number, width: number, depth: number, time: number, speed = 0): void {
    if (!Number.isNaN(this.lastX)) {
      const dx = x - this.lastX;
      const dz = z - this.lastZ;
      const gap = this.ghost ? 0.6 : byTier(BUDGET.rutGap);
      if (dx * dx + dz * dz < gap * gap) return;
    }
    let tx = 0;
    let tz = 1;
    if (!Number.isNaN(this.lastX)) {
      const dx = x - this.lastX;
      const dz = z - this.lastZ;
      const l = Math.sqrt(dx * dx + dz * dz) || 1;
      tx = dx / l;
      tz = dz / l;
      const st = Math.max(0, Math.min(1, (speed - STRETCH_FROM) / (STRETCH_TO - STRETCH_FROM)));
      this.arcNow += l / (1 + (STRETCH - 1) * st);
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
    // (A deep carve's ribbon runs a hand wider than its lip, for the clods it throws out.)
    const hw = this.ghost ? GHOST_HW : Math.max(RUNNER + 0.12 + 0.42 * Math.min(1, depth), width * 0.45 * fan);
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
    this.arc[i * 2] = this.arc[i * 2 + 1] = this.arcNow;
    this.segStart[i] = startNew ? 1 : 0;
    this.head = (this.head + 1) % this.max;
    this.count = Math.min(this.count + 1, this.max);
    this.dirtyFlag = true;
    for (const [name, size] of TRAIL_DYNAMIC) (this.geo.getAttribute(name) as BufferAttribute).addUpdateRange(i * 2 * size, 2 * size);
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
    idx.clearUpdateRanges();
    idx.addUpdateRange(0, Math.max(q, 3));
    idx.needsUpdate = true;
    this.geo.setDrawRange(0, q);
    // (Each attribute uploads only the samples added since the last flush: its update ranges.)
    for (const [name] of TRAIL_DYNAMIC) (this.geo.getAttribute(name) as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** A rut is kept this far behind the rider (the mirror, a wreck's orbit and the finish's swing look back). */
const RUT_BEHIND = 60;

/** Half-width of a ghost's runner ribbon: both runner lines and their glow. */
const GHOST_RUNNERS_HW = RUNNER + 0.12;
/** The strip is laid wider than the runner lines, so the ghost you draft can spread its slipstream
 *  over it (each edge sits on the snow under it; the lines alone draw for every other ghost). */
const GHOST_STRIP_HW = GHOST_RUNNERS_HW + 0.7;

/**
 * Every ghost's runner lines in one mesh (one draw call for the whole field, where each ghost used to
 * draw its own trail): two thin luminous lines in the ghost's kind colour, a runner's width apart, so
 * the snow behind a ghost reads as a sled's track rather than one painted stripe. Each line is a crisp
 * core in a soft glow; by day the colour deepens so it shows on bright snow, at night it glows (past
 * the bloom threshold on Medium and High). They fade with age, with distance, and before they reach
 * the lens, as the single lines did. Under the light lies the rut itself (round 7), which does not fade:
 * the same strip, the same draw.
 */
export class GhostTrails {
  readonly mesh: Mesh;
  private geo: BufferGeometry;
  private pos: Float32Array;
  private born: Float32Array;
  private heads: Int32Array;
  private counts: Int32Array;
  private lastX: Float64Array;
  private lastZ: Float64Array;
  private broken: Uint8Array;
  private segStart: Uint8Array;
  private dirtyFlag = false;
  private mat: ShaderMaterial;

  /** Metres between a rut's samples, how far ahead of the rider it is drawn, and where it drops to every
   *  third sample (fxhub.ts BUDGET, read once as the field is made). */
  private gap: number;
  private far: number;
  private coarse: number;

  constructor(
    private course: Course,
    private n: number,
    private max: number,
    colors: Color[],
  ) {
    // The tier's budget: a rut keeps the visible range ahead of the rider (Low keeps round 6's vertex
    // count and spaces its samples wider).
    this.max = max = Math.max(max, byTier(BUDGET.rutSamples));
    this.gap = byTier(BUDGET.rutGap);
    this.far = byTier(BUDGET.rutFar);
    this.coarse = byTier(BUDGET.rutCoarse);
    const verts = n * max * 2;
    this.pos = new Float32Array(verts * 3);
    this.born = new Float32Array(verts);
    const across = new Float32Array(verts);
    const col = new Float32Array(verts * 3);
    const gi = new Float32Array(verts);
    for (let g = 0; g < n; g++) {
      const c = colors[g];
      for (let k = 0; k < max * 2; k++) {
        const v = g * max * 2 + k;
        across[v] = k % 2 ? 1 : -1;
        col.set([c.r, c.g, c.b], v * 3);
        gi[v] = g;
      }
    }
    this.heads = new Int32Array(n);
    this.counts = new Int32Array(n);
    this.lastX = new Float64Array(n).fill(NaN);
    this.lastZ = new Float64Array(n).fill(NaN);
    this.broken = new Uint8Array(n).fill(1);
    this.segStart = new Uint8Array(n * max);
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aAcross', new BufferAttribute(across, 1));
    this.geo.setAttribute('aBorn', new BufferAttribute(this.born, 1).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aCol', new BufferAttribute(col, 3));
    this.geo.setAttribute('aG', new BufferAttribute(gi, 1));
    // (A 16-bit index wherever the field's vertices fit one: half the bytes a rebuild sends.)
    const indices = Math.max(1, n * (max - 1) * 6);
    this.geo.setIndex(new BufferAttribute(verts <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices), 1).setUsage(DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      blending: NormalBlending,
      uniforms: {
        uTime: shared.uTime,
        uLit: shared.uSnowLit,
        uShade: shared.uSnowShade,
        uDeep: shared.uSnowDeep,
        uSunColor: shared.uSunColor,
        uIceMood: shared.uIceMood,
        uFog: shared.uFog,
        uFogNear: shared.uFogNear,
        uFogFar: shared.uFogFar,
        uFocus: shared.uFocus,
        uLife: { value: 7 },
        uWake: { value: 0 },
        uWakeG: { value: -1 },
      },
      vertexShader: /* glsl */ `
        attribute float aAcross;
        attribute float aBorn;
        attribute vec3 aCol;
        attribute float aG;
        uniform float uTime;
        uniform float uWake;
        uniform float uWakeG;
        varying float vAcross;
        varying float vAge;
        varying vec3 vCol;
        varying vec3 vWorldPos;
        varying float vWake;
        void main() {
          vAcross = aAcross;
          vAge = uTime - aBorn;
          vCol = aCol;
          vWake = abs(aG - uWakeG) < 0.5 ? uWake : 0.0;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uLit;
        uniform vec3 uShade;
        uniform vec3 uDeep;
        uniform vec3 uSunColor;
        uniform float uIceMood;
        uniform vec3 uFog;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform vec3 uFocus;
        uniform float uLife;
        varying float vAcross;
        varying float vAge;
        varying vec3 vCol;
        varying vec3 vWorldPos;
        varying float vWake;
        float line(float x, float hw, float px) {
          float w = max(hw, px * 0.6);
          return smoothstep(w + px * 0.75, w - px * 0.75, abs(x)) * (hw / w);
        }
        void main() {
          float fade = clamp(1.0 - vAge / uLife, 0.0, 1.0);
          float d = length(cameraPosition - vWorldPos);
          float fogF = smoothstep(uFogNear, uFogFar, d);
          float zf = -(viewMatrix * vec4(vWorldPos, 1.0)).z;
          float zr = max(-(viewMatrix * vec4(uFocus - vec3(0.0, 0.9, 0.0), 1.0)).z, 0.0);
          float x = vAcross * ${GHOST_STRIP_HW.toFixed(2)};
          float px = max(fwidth(x), 0.0005);
          // Distance across from the nearer runner's line.
          float r = abs(abs(x) - ${RUNNER.toFixed(2)});
          float core = line(r, 0.026, px);
          // The glow round each line; far off, where a pixel spans more than the gap, it is all glow.
          float glow = exp(-r * r / 0.0045) * (1.0 - smoothstep(0.02, 0.06, px));
          float day = smoothstep(0.25, 0.65, dot(uLit, vec3(0.2126, 0.7152, 0.0722)));
          vec3 col = mix(vCol * 1.6, pow(vCol, vec3(1.7)) * 0.85, day * 0.6);
          // Shown from just behind the rider onward, gone before the lens (the lower third is the snow's).
          float nearK = zr > 1.0 ? smoothstep(zr * 0.7, zr * 1.35, zf) : 1.0;
          float alpha = (core * mix(0.62, 0.5, day) + glow * mix(0.3, 0.14, day)) * fade * sqrt(fade) * nearK * (1.0 - fogF) * mix(1.0, 0.5, smoothstep(25.0, 80.0, d));
          if (vWake > 0.0) {
            // The slipstream you ride in behind this ghost: a soft sheet of its light over its track,
            // densest just behind it and reaching back under your sled, with chevrons of brighter light
            // riding along with it (like a boat's wake), and a hot seam down each runner line.
            float ax = abs(x);
            float sheet = exp(-ax * ax / 0.32);
            float reach = smoothstep(0.0, 0.06, vAge) * (1.0 - smoothstep(0.9, 2.0, vAge));
            float chev = smoothstep(0.62, 1.0, 0.5 + 0.5 * sin((vAge * 7.0 + ax * 1.6) * 6.2832));
            float nearW = zr > 1.0 ? smoothstep(zr * 0.3, zr * 0.75, zf) : 1.0;
            float wa = min(0.85, vWake * reach * nearW * (1.0 - fogF) * (sheet * (0.3 + 0.45 * chev) + core * 0.5));
            col = mix(col, mix(vCol * 1.5, pow(vCol, vec3(1.4)) * 1.05, day * 0.5), wa / max(alpha + wa, 0.001));
            alpha = alpha + wa * (1.0 - alpha);
          }
          col = mix(col, uFog, fogF * 0.5);
          // The rut under the light (round 7): two runner cuts pressed into the snow in its own shade, a lip
          // of packed snow outside each catching the light. It does not age: it lies on the snow ahead of
          // you until you ride over it, shallower than your own groove, and on glass ice only a scratch.
          float cut = line(r, 0.034, px);
          float lipX = abs(x) - 0.28 - 0.062;
          float lip = line(lipX, 0.022, px) * (1.0 - smoothstep(0.015, 0.05, px));
          float rutK = (1.0 - fogF) * mix(1.0, 0.6, smoothstep(50.0, 160.0, d)) * (uIceMood >= 1.0 ? 0.5 : 1.0) * smoothstep(0.0, 0.25, vAge);
          float ka = cut * 0.46 * rutK;
          float kl = lip * 0.3 * rutK;
          vec3 rutCol = mix(mix(uShade, uDeep, 0.38), uFog, fogF);
          vec3 lipCol = mix(mix(uLit, vec3(1.0), 0.15) * mix(vec3(1.0), uSunColor, 0.4), uFog, fogF);
          // Under the light: the rut and its lip first, the luminous line over them.
          vec3 P = rutCol * ka;
          float A = ka;
          P = lipCol * kl + P * (1.0 - kl);
          A = kl + A * (1.0 - kl);
          P = col * alpha + P * (1.0 - alpha);
          A = alpha + A * (1.0 - alpha);
          if (A < 0.004) discard;
          gl_FragColor = vec4(P / A, A);
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
    this.heads.fill(0);
    this.counts.fill(0);
    this.broken.fill(1);
    this.lastX.fill(NaN);
    this.lastZ.fill(NaN);
    this.geo.setDrawRange(0, 0);
  }

  /** The ghost whose slipstream you ride (-1 none) and its strength, 0 to 1. */
  setWake(i: number, k: number): void {
    this.mat.uniforms.uWakeG.value = i;
    this.mat.uniforms.uWake.value = k;
  }

  /** End ghost i's current stroke (it went airborne). */
  lift(i: number): void {
    this.broken[i] = 1;
  }

  /** Add a sample for ghost i at sim coordinates, every 0.6 m. */
  add(i: number, x: number, z: number, time: number): void {
    const lx0 = this.lastX[i];
    const lz0 = this.lastZ[i];
    let tx = 0;
    let tz = 1;
    if (!Number.isNaN(lx0)) {
      const dx = x - lx0;
      const dz = z - lz0;
      const l2 = dx * dx + dz * dz;
      if (l2 < this.gap * this.gap) return;
      const l = Math.sqrt(l2);
      tx = dx / l;
      tz = dz / l;
      // A jump (a new run, the reel changing leads) starts a new stroke.
      if (l2 > 64) this.broken[i] = 1;
    }
    this.lastX[i] = x;
    this.lastZ[i] = z;
    const k = this.heads[i];
    const s = i * this.max + k;
    this.segStart[s] = this.broken[i];
    this.broken[i] = 0;
    const hw = GHOST_STRIP_HW;
    const px = tz;
    const pz = -tx;
    const c = this.course;
    const o = s * 6;
    const ax = x - px * hw;
    const az = z - pz * hw;
    const bx = x + px * hw;
    const bz = z + pz * hw;
    this.pos[o] = ax;
    this.pos[o + 1] = c.ground(ax, az) + 0.04;
    this.pos[o + 2] = -az;
    this.pos[o + 3] = bx;
    this.pos[o + 4] = c.ground(bx, bz) + 0.04;
    this.pos[o + 5] = -bz;
    this.born[s * 2] = this.born[s * 2 + 1] = time;
    this.heads[i] = (k + 1) % this.max;
    this.counts[i] = Math.min(this.counts[i] + 1, this.max);
    this.dirtyFlag = true;
    // Only this sample goes up to the GPU.
    (this.geo.getAttribute('position') as BufferAttribute).addUpdateRange(o, 6);
    (this.geo.getAttribute('aBorn') as BufferAttribute).addUpdateRange(s * 2, 2);
  }

  /** Triangles in the last flush (tests and the cost report). */
  get triangles(): number {
    return this.geo.drawRange.count / 3;
  }

  flush(): void {
    if (!this.dirtyFlag) return;
    this.dirtyFlag = false;
    const idx = this.geo.index as BufferAttribute;
    const arr = idx.array as Uint16Array | Uint32Array;
    const max = this.max;
    let q = 0;
    // Where the rider is down the run (three.js z is the sim's, negated): a rut is drawn from a little
    // behind the lens to the tier's range ahead, and past `coarse` metres it keeps every third sample (a
    // far rut is a pixel wide, and its bends are long).
    const fz = -shared.uFocus.value.z;
    for (let g = 0; g < this.n; g++) {
      const n = this.counts[g];
      const start = (this.heads[g] - n + max) % max;
      const base = g * max;
      let k = 0;
      while (k < n - 1) {
        const a = (start + k) % max;
        const ahead = -this.pos[(base + a) * 6 + 2] - fz;
        if (ahead < -RUT_BEHIND || ahead > this.far) {
          k++;
          continue;
        }
        const want = ahead > this.coarse ? 3 : 1;
        let b = a;
        let step = 0;
        while (step < want && k + step + 1 < n) {
          const c = (start + k + step + 1) % max;
          if (this.segStart[base + c]) break;
          b = c;
          step++;
        }
        if (step === 0) {
          k++;
          continue;
        }
        k += step;
        const a0 = (base + a) * 2;
        const b0 = (base + b) * 2;
        arr[q++] = a0;
        arr[q++] = a0 + 1;
        arr[q++] = b0;
        arr[q++] = a0 + 1;
        arr[q++] = b0 + 1;
        arr[q++] = b0;
      }
    }
    // (Only the indices in use go up, and only the samples added since the last flush.)
    idx.clearUpdateRanges();
    idx.addUpdateRange(0, Math.max(q, 3));
    idx.needsUpdate = true;
    this.geo.setDrawRange(0, q);
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aBorn') as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
