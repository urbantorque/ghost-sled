import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three';
import type { Course } from '../sim/course';
import { reduced } from '../ui/motion';
import { shared } from './materials';
import { cameraVelocity, lensPx } from './particles';
import type { Tier } from './world';

// The near field's sense of speed, in one capped point cloud (one draw call, none on Low):
//  - flurries: fine flakes hanging in the air around the lens, which the chase camera's own motion
//    stretches into short streaks flying past the frame (denser at speed and on a boost);
//  - spindrift: sunlit powder blown off the bank crests ahead in long soft wisps;
//  - the avalanche's breath: cold powder gusts and dark grit overtaking the lens from behind along
//    the frame's lower edges, and powder shaken off the treeline tops ahead of it, sifting down off
//    the crowns, all thickening as the wall closes (the danger value).
// Everything is simulated on the CPU in flat typed arrays and drawn as stretched sprites; nothing is
// ever drawn over the rider's outline (the same rule as the powder in particles.ts).

const K_FLURRY = 0;
const K_DRIFT = 1;
const K_GUST = 2;
const K_GRIT = 3;

/** Point budget per tier: Low draws none (its CPU has no headroom), Medium about half. */
const CAP: Record<Tier, number> = { low: 0, medium: 260, high: 520 };
const MAX = CAP.high;
/** Shares of the cap: flurries, spindrift, avalanche gusts and grit. */
const SHARE = { flurry: 0.5, drift: 0.28, gust: 0.22 };

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface NearFieldInput {
  course: Course;
  camPos: Vector3;
  /** Sim position of the rider (sim z is downhill, world z is -z). */
  x: number;
  z: number;
  speed: number;
  boost: number;
  /** 0 far or no chase, 1 the wall at the rider's back. */
  danger: number;
  /** False once the run is over (crashed): everything thins away. */
  live: boolean;
  dt: number;
  tier: Tier;
}

export class NearField {
  readonly points: Points;
  private mat: ShaderMaterial;
  private geo: BufferGeometry;
  private n = 0;
  private kind = new Uint8Array(MAX);
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private z = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private vz = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private max = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private peak = new Float32Array(MAX);
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private attr = new Float32Array(MAX * 3);
  private attrs: BufferAttribute[];
  private acc = { flurry: 0, drift: 0, gust: 0, tree: 0 };
  private fwd = new Vector3(0, 0, -1);
  /** Fades everything out over a quarter second once the run is over (a crash, the results). */
  private fade = 1;

  constructor() {
    this.geo = new BufferGeometry();
    const p = new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage);
    const v = new BufferAttribute(this.vel, 3).setUsage(DynamicDrawUsage);
    const a = new BufferAttribute(this.attr, 3).setUsage(DynamicDrawUsage);
    this.geo.setAttribute('position', p);
    this.geo.setAttribute('aVel', v);
    this.geo.setAttribute('aAttr', a);
    this.attrs = [p, v, a];
    this.geo.setDrawRange(0, 0);
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uScale: { value: 600 },
        uCamVel: { value: cameraVelocity() },
        uMainCam: { value: new Vector3() },
        uFocus: shared.uFocus,
        uSunDir: shared.uSunDir,
        uSunColor: shared.uSunColor,
        uSnowLit: shared.uSnowLit,
        uSnowShade: shared.uSnowShade,
        uFog: shared.uFog,
        uFogNear: shared.uFogNear,
        uFogFar: shared.uFogFar,
        uGrit: { value: new Color('#1E2646') },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aVel;
        attribute vec3 aAttr;
        uniform float uScale;
        uniform vec3 uCamVel;
        uniform vec3 uMainCam;
        uniform vec3 uFocus;
        uniform vec3 uSunDir;
        uniform float uFogNear;
        uniform float uFogFar;
        varying float vKind;
        varying float vAlpha;
        varying vec2 vAxis;
        varying float vRatio;
        varying float vFog;
        varying float vBack;
        void main() {
          vKind = aAttr.x;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = max(-mv.z, 0.05);
          vFog = smoothstep(uFogNear, uFogFar, depth);
          // Only the chase camera sees the near field: the rear-view mirror's camera sits elsewhere.
          float a = aAttr.z * (1.0 - step(0.75, distance(cameraPosition, uMainCam)));
          // Nothing grows into a blot right at the lens: flakes fade in from about a metre and a half,
          // the avalanche's gusts and grit (which overtake the lens itself) from a few metres.
          a *= vKind > 1.5 ? smoothstep(2.2, 5.0, depth) : smoothstep(1.1, 2.6, depth);
          // The avalanche's breath stays low on the snow, never up against the sky (particles.ts grit).
          if (vKind > 1.5) a *= 1.0 - smoothstep(cameraPosition.y - 1.0, cameraPosition.y - 0.3, position.y);
          // Never a veil over the hero (particles.ts): over the rider's outline on screen, between the
          // lens and the rider or just beside it, a streak thins to almost nothing.
          vec4 rv = viewMatrix * vec4(uFocus, 1.0);
          if (rv.z < -0.5 && mv.z < -0.05) {
            float ov = length((mv.xy / -mv.z - rv.xy / -rv.z) * -rv.z / vec2(0.7, 1.1));
            a *= 1.0 - 0.92 * (1.0 - smoothstep(0.8, 1.5, ov)) * smoothstep(-2.5, 0.2, mv.z - rv.z);
          }
          float px720 = uScale / 720.0;
          float size = aAttr.y * uScale / depth;
          // Flurries and grit stay crisp specks; spindrift and gusts are soft wisps.
          size = clamp(size, (vKind < 0.5 ? 2.2 : 1.6) * px720, uScale * (vKind > 0.5 && vKind < 2.5 ? 0.05 : 0.012));
          // Stretch along the motion relative to the lens over a short virtual shutter: the flakes
          // the chase camera rushes past streak out of the frame, wisps smear along the wind.
          vec4 c0 = projectionMatrix * mv;
          // Spindrift is a soft wisp hung in the wind: it smears along its own drift only (stretched by
          // the lens's motion, wisps high on the banks streaked across the sky like meteors).
          bool wisp = vKind > 0.5 && vKind < 1.5;
          vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + (wisp ? aVel * 0.22 : (aVel - uCamVel) * (vKind < 0.5 ? 0.045 : 0.032)), 1.0);
          vAxis = vec2(1.0, 0.0);
          vRatio = 1.0;
          if (c1.w > 0.1 && c0.w > 0.1) {
            vec2 dpx = (c1.xy / c1.w - c0.xy / c0.w) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0) * uScale * 0.5;
            float len = length(dpx);
            if (len > 0.5) vAxis = vec2(dpx.x, -dpx.y) / len;
            float lmax = (vKind < 0.5 ? 84.0 : vKind > 2.5 ? 26.0 : 70.0) * px720;
            float l = clamp(size + len, size, max(wisp ? size * 2.4 : lmax, size));
            vRatio = clamp(size / l, 0.04, 1.0);
            // A streak is a thin smear, thinner than the fleck it smears out.
            if (vKind < 0.5 || vKind > 2.5) vRatio *= mix(1.0, 0.6, smoothstep(1.0, 4.0, l / size));
            size = l;
          }
          // Backlit by a low sun ahead of the lens, powder glows (forward scattering).
          vBack = pow(clamp(-normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz).z, 0.0, 1.0), 1.5);
          vAlpha = a;
          gl_PointSize = size;
          gl_Position = c0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor;
        uniform vec3 uSnowLit;
        uniform vec3 uSnowShade;
        uniform vec3 uFog;
        uniform vec3 uGrit;
        varying float vKind;
        varying float vAlpha;
        varying vec2 vAxis;
        varying float vRatio;
        varying float vFog;
        varying float vBack;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          vec2 q = vec2(dot(c, vAxis), dot(c, vec2(-vAxis.y, vAxis.x)) / vRatio) * 2.0;
          float r2 = dot(q, q);
          if (r2 > 1.0) discard;
          vec3 lit = mix(uSnowLit, vec3(1.0, 0.96, 0.9), 0.4) * uSunColor;
          // Sunlit powder keeps only a trace of the sun's hue (particles.ts): never a yellow smear.
          lit = mix(lit, vec3(dot(lit, vec3(0.3, 0.59, 0.11))), 0.5);
          lit *= 1.0 + 0.7 * smoothstep(0.6, 0.25, dot(lit, vec3(0.3, 0.59, 0.11)));
          vec3 col;
          float a;
          if (vKind < 0.5) {
            // A fine flake: a bright head trailing off into a tail of the snow's own periwinkle shade, so
            // the streak reads over lit snow (white on white vanished) as well as over shade and trees.
            vec3 head = mix(lit, vec3(1.0), 0.25 + 0.3 * vBack);
            vec3 tail = mix(uSnowShade, uSnowLit, 0.2);
            col = mix(tail, head, smoothstep(-0.7, 0.75, q.x));
            a = (1.0 - r2) * (0.85 + 0.15 * q.x);
          } else if (vKind < 1.5) {
            // Spindrift: a soft sunlit wisp, faint at its edges, a step brighter when backlit.
            col = mix(mix(uSnowShade, uSnowLit, 0.55), lit, 0.7 + 0.3 * vBack);
            float k = 1.0 - r2;
            a = k * k * 0.75;
          } else if (vKind < 2.5) {
            // The avalanche's breath: cold, pale powder, a shade cooler than spindrift.
            col = mix(uSnowShade, mix(uSnowLit, vec3(0.86, 0.93, 1.05), 0.4), 0.72);
            float k = 1.0 - r2;
            a = k * k * 0.8;
          } else {
            // Grit off the wall: dark, hard slate flecks (a danger reads dark and hard).
            col = uGrit;
            a = smoothstep(1.0, 0.55, r2);
          }
          col = mix(col, uFog, vFog * (vKind > 2.5 ? 0.4 : 0.8));
          a *= vAlpha * (1.0 - vFog * 0.6);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.visible = false;
  }

  clear(): void {
    this.n = 0;
    this.acc.flurry = this.acc.drift = this.acc.gust = this.acc.tree = 0;
    this.fade = 1;
    this.geo.setDrawRange(0, 0);
    this.points.visible = false;
  }

  private emit(k: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, alpha: number, cap: number): void {
    if (this.n >= cap) return;
    const i = this.n++;
    this.kind[i] = k;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = 0;
    this.max[i] = life;
    this.size[i] = size;
    this.peak[i] = alpha;
  }

  update(o: NearFieldInput): void {
    const cap = reduced() ? Math.round(CAP[o.tier] * 0.4) : CAP[o.tier];
    if (cap <= 0) {
      if (this.n) this.clear();
      return;
    }
    const dt = Math.min(0.05, Math.max(0, o.dt));
    const cam = o.camPos;
    this.mat.uniforms.uMainCam.value.copy(cam);
    this.mat.uniforms.uScale.value = lensPx();
    const cv = cameraVelocity();
    const hs = Math.hypot(cv.x, cv.z);
    if (hs > 2) this.fwd.set(cv.x / hs, 0, cv.z / hs);
    const f = this.fwd;
    // Sideways to the right of travel.
    const rx = -f.z;
    const rz = f.x;
    const c = o.course;
    // The lens's height over the snow under it (flurries hang at that height over their own snow).
    const g0 = c.ground(cam.x, -cam.z);
    const camH = Math.max(0.8, Math.min(6, cam.y - g0));
    // The fall line's drop per metre ahead of the lens (the avalanche's breath skims down it).
    const fall = Math.max(0, Math.min(0.8, (g0 - c.ground(cam.x + f.x * 10, -(cam.z + f.z * 10))) / 10));
    const live = o.live ? 1 : 0;
    this.fade = o.live ? 1 : Math.max(0, this.fade - dt * 4);
    if (this.fade <= 0) {
      if (this.n) this.clear();
      this.fade = 0;
      return;
    }

    // Spawn rates (per second) from speed, boost and danger.
    const fast = smooth(15, 36, o.speed);
    const flurryK = live * (reduced() ? 0 : Math.min(1.25, fast * (0.7 + 0.55 * o.boost) + 0.3 * o.boost * fast));
    const driftK = live * (0.35 + 0.65 * fast) * (reduced() ? 0.5 : 1);
    const gustK = live * o.danger * o.danger * (reduced() ? 0.5 : 1);
    const capF = cap * SHARE.flurry;
    const capD = cap * (SHARE.flurry + SHARE.drift);

    // Flurries: flakes hung in the air ahead and to the sides of the lens, never on the line of sight
    // to the rider; the lens's own motion streaks them past the frame.
    // From about 22 m/s a growing share of them skims just over the snow beside the sled instead (the
    // camera and motion round): crystals the lens races over, streaking past the frame's lower corners,
    // so the ground itself reads as rushing by at speed (and not at all at a 15 m/s cruise).
    const skimP = reduced() ? 0 : 0.5 * smooth(22, 34, o.speed);
    this.acc.flurry += flurryK * cap * SHARE.flurry * 2.4 * (1 + 0.5 * skimP) * dt;
    while (this.acc.flurry >= 1) {
      this.acc.flurry -= 1;
      const skim = Math.random() < skimP;
      const ahead = skim ? 2.5 + Math.random() * 8 : 3.5 + Math.random() * 13;
      // Out to either side, or high over the lens: the middle of the frame (the rider) stays clear.
      const side = (Math.random() < 0.5 ? -1 : 1) * (skim ? 1.4 + Math.random() * 3.4 : 1.6 + Math.random() * 5.5);
      // Below the lens, over the snow: flakes streaking through the sky read as rain or meteors over
      // the sun (a phone's chase camera looks down, so even the lens's own height is high on its screen).
      const up = -2.2 + Math.random() * 2.2;
      // Held at the lens's height over the snow where it hangs, not at the lens's height now: the lens
      // runs down the fall line, so a flake hung level ahead ended up over it, in the sky.
      const fx = cam.x + f.x * ahead + rx * side;
      const fz = cam.z + f.z * ahead + rz * side;
      const fg = c.ground(fx, -fz);
      this.emit(
        K_FLURRY,
        fx,
        skim ? fg + 0.06 + Math.random() * 0.4 : fg + camH + up,
        fz,
        (Math.random() - 0.5) * 1.2,
        -0.6 - Math.random() * 0.6,
        (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 0.45,
        0.03 + Math.random() * 0.025,
        0.7 + 0.3 * Math.random(),
        this.n < capF ? cap : 0,
      );
    }

    // Spindrift off both bank crests ahead: a sunny wind lifts powder off the lip in long wisps that
    // blow out over the corridor and back up the slope past the lens.
    this.acc.drift += driftK * cap * SHARE.drift * 1.1 * dt;
    while (this.acc.drift >= 1) {
      this.acc.drift -= 1;
      const sz = o.z + 4 + Math.random() * 34;
      const sgn = Math.random() < 0.5 ? -1 : 1;
      const e = 4.5 + Math.random() * 3.5;
      const px = c.centerX(sz) + sgn * (c.halfWidth(sz) + e);
      const py = c.ground(px, sz) + 0.2 + Math.random() * 0.6;
      const wind = 2.5 + Math.random() * 3;
      this.emit(
        K_DRIFT,
        px,
        py,
        -sz,
        -sgn * wind * (0.6 + Math.random() * 0.5),
        0.5 + Math.random() * 0.9,
        // A little back up the slope: the wind comes up the mountain.
        1.2 + Math.random() * 2.5,
        1.1 + Math.random() * 1.1,
        0.55 + Math.random() * 0.6,
        0.3 + Math.random() * 0.2,
        this.n < capD ? cap : 0,
      );
    }

    // The avalanche's breath: powder gusts and grit blasting past the lens from behind, low along the
    // snow at the frame's lower edges, overtaking at the sled's speed and more.
    this.acc.gust += gustK * cap * SHARE.gust * 3 * dt;
    while (this.acc.gust >= 1) {
      this.acc.gust -= 1;
      const grit = Math.random() < 0.3;
      const side = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 5);
      const back = 0.5 + Math.random() * 3;
      const gx = cam.x - f.x * back + rx * side;
      const gz = cam.z - f.z * back + rz * side;
      const ground = c.ground(gx, -gz);
      // Low on the frame: under the lens's height, never on a bank that rises up beside it (seen from a
      // phone's lowered gaze, grit at the lens's height sat at the top of the screen, over the HUD).
      const gy = Math.min(ground + 0.3 + Math.random() * (Math.abs(side) > 4 ? 2.0 : 1.0), cam.y - 1.3 - Math.random());
      if (gy < ground + 0.15) continue;
      const over = o.speed + 9 + Math.random() * 10;
      this.emit(
        grit ? K_GRIT : K_GUST,
        gx,
        gy,
        gz,
        f.x * over + (Math.random() - 0.5) * 2,
        // Skims down the slope with the snow (the lens looks down it): it never flies off into the sky.
        -fall * over - Math.random() * 1.2,
        f.z * over + (Math.random() - 0.5) * 2,
        0.55 + Math.random() * 0.4,
        grit ? 0.05 + Math.random() * 0.05 : 0.35 + Math.random() * 0.4,
        grit ? 0.9 : 0.5 + 0.3 * Math.random(),
        cap,
      );
    }

    // The treeline shaking ahead of the wall: powder sifting off the pine crowns along both forest
    // edges, in short bursts that sink as they thin (spindrift's soft wisps, falling).
    this.acc.tree += live * smooth(0.1, 0.6, o.danger) * cap * 0.5 * dt * (reduced() ? 0.5 : 1);
    let burst = 0;
    let bx = 0;
    let by = 0;
    let bz = 0;
    let bs = 1;
    while (this.acc.tree >= 1) {
      this.acc.tree -= 1;
      if (burst <= 0) {
        // A new crown: somewhere along either treeline from beside you to a few dozen metres ahead.
        burst = 3 + Math.floor(Math.random() * 3);
        const tz = o.z + 6 + Math.random() * 40;
        bs = Math.random() < 0.5 ? -1 : 1;
        bx = c.centerX(tz) + bs * (c.halfWidth(tz) + 9.5 + Math.random() * 2.5);
        by = c.ground(bx, tz) + 6 + Math.random() * 3;
        bz = -tz;
      }
      burst--;
      this.emit(
        K_DRIFT,
        bx + (Math.random() - 0.5) * 1.6,
        by + (Math.random() - 0.5) * 1.2,
        bz + (Math.random() - 0.5) * 1.6,
        -bs * (0.5 + Math.random() * 1.2),
        -1.2 - Math.random() * 1.5,
        (Math.random() - 0.5) * 1.2,
        0.9 + Math.random() * 0.6,
        0.6 + Math.random() * 0.6,
        0.38 + Math.random() * 0.2,
        cap,
      );
    }

    // Integrate, fading in fast and out smoothly; swap-remove the dead (order does not matter).
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        const j = --this.n;
        if (i !== j) this.move(j, i);
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      i++;
    }
    const n = this.n;
    const pos = this.pos;
    const vel = this.vel;
    const at = this.attr;
    for (let j = 0; j < n; j++) {
      const t = this.life[j] / this.max[j];
      const j3 = j * 3;
      pos[j3] = this.x[j];
      pos[j3 + 1] = this.y[j];
      pos[j3 + 2] = this.z[j];
      vel[j3] = this.vx[j];
      vel[j3 + 1] = this.vy[j];
      vel[j3 + 2] = this.vz[j];
      at[j3] = this.kind[j];
      // Wisps swell as they blow out; flakes and grit keep their size.
      at[j3 + 1] = this.size[j] * (this.kind[j] === K_DRIFT || this.kind[j] === K_GUST ? 0.7 + 0.8 * t : 1);
      at[j3 + 2] = this.peak[j] * Math.min(1, t / 0.15) * (1 - smooth(0.55, 1, t)) * this.fade;
    }
    this.geo.setDrawRange(0, n);
    for (const a of this.attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * 3);
      a.needsUpdate = true;
    }
    this.points.visible = n > 0;
  }

  private move(from: number, to: number): void {
    this.kind[to] = this.kind[from];
    this.x[to] = this.x[from];
    this.y[to] = this.y[from];
    this.z[to] = this.z[from];
    this.vx[to] = this.vx[from];
    this.vy[to] = this.vy[from];
    this.vz[to] = this.vz[from];
    this.life[to] = this.life[from];
    this.max[to] = this.max[from];
    this.size[to] = this.size[from];
    this.peak[to] = this.peak[from];
  }
}
