import { BufferAttribute, BufferGeometry, type Camera, CircleGeometry, Color, Mesh, NormalBlending, Object3D, Quaternion, RingGeometry, Sphere, ShaderMaterial, Vector3 } from 'three';
import { Course } from '../sim/course';
import type { Snap } from '../game/run';
import { shared } from './materials';

// The perfect-landing telegraph: while airborne, a ring on the snow marks where you will touch
// down and closes in as the moment approaches. Inside the stomp window it flashes gold-white:
// press then. A perfect landing presses a burst crater (a raised ridge of displaced powder ringing
// the whole sled, sunlit gold-cream on the faces turned to the sun and periwinkle on the others,
// feathering into the snow, with tongues of powder thrown out past it, a ring that reads from the low
// chase camera and at thumbnail size; particles.ts throws the airborne burst of billows, the crown
// and a few gold sparks low over the snow) that settles into the snow and dissolves once the
// rider has raced on, and gifts crowding the rider shrink away for a moment so the stomp reads. Also a soft contact shadow under the sled on every quality tier.

function ringMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    blending: NormalBlending,
    uniforms: { uColor: { value: new Color('#FFFFFF') }, uEdge: { value: shared.uSnowDeep.value.clone() }, uAlpha: { value: 0 }, uHot: { value: 0 }, uInner: { value: 0.62 }, uSpin: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uEdge;
      uniform float uAlpha;
      uniform float uHot;
      uniform float uInner;
      uniform float uSpin;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float band = smoothstep(uInner, uInner + 0.1, d) * smoothstep(0.9, 0.82, d);
        // A thin dark outline just outside the bright band keeps the ring readable on bright snow.
        float edge = smoothstep(0.82, 0.88, d) * smoothstep(1.0, 0.93, d);
        // In the stomp window a soft halo just inside the band, not a fill: a filled disc reads as a
        // white plate under the sled from the low chase camera.
        float glow = smoothstep(uInner - 0.14, uInner, d) * 0.3 * uHot;
        vec3 col = uColor * (1.0 + uHot * 0.9);
        // Dashed like a reticle while it closes, solid in the stomp window. A solid ring seen from the
        // low chase camera read as a white plate lying under the sled, not as a telegraph.
        vec2 q = vUv - 0.5;
        float turn = fract(atan(q.y, q.x) / 6.2831853 * 14.0 + uSpin);
        float dash = mix(smoothstep(0.0, 0.06, turn) * smoothstep(0.62, 0.56, turn), 1.0, uHot);
        float a = max(band * dash, glow);
        edge *= dash;
        vec3 c = mix(uEdge, col, a / max(a + edge * 0.55, 0.001));
        gl_FragColor = vec4(c, max(a, edge * 0.55) * uAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

function blobMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    uniforms: { uColor: { value: new Color('#3E4C9A') }, uAlpha: { value: 0.4 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float d = length((vUv - 0.5) * vec2(1.0, 0.75)) * 2.0;
        gl_FragColor = vec4(uColor, smoothstep(1.0, 0.1, d) * uAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Crater decal radius in metres (the longest streaks, about 2.4 m off a lip 1.5 m out, reach about
 *  95% of it). */
const CRATER_R = 4.2;
const CRATER_SEGS = 18;
const CRATER_LIFE = 6;
/** Seconds the crater rides along under the sled before it is left in the snow. */
const FOLLOW = 0.42;

function craterMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    blending: NormalBlending,
    uniforms: {
      uT: { value: 0 },
      uSeed: { value: 0 },
      uFwd: { value: new Vector3(0, 0, -1) },
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uLit: shared.uSnowLit,
      uShade: shared.uSnowShade,
      uDeep: shared.uSnowDeep,
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uFocus: shared.uFocus,
    },
    vertexShader: /* glsl */ `
      attribute vec2 aP;
      varying vec2 vP;
      varying vec3 vWorldPos;
      void main() {
        vP = aP;
        vWorldPos = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uSeed;
      uniform vec3 uFwd;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uDeep;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uFocus;
      varying vec2 vP;
      varying vec3 vWorldPos;
      float h11(float x) { return fract(sin(x * 127.1 + uSeed * 311.7) * 43758.5453); }
      // Metres to the decal's unit radius.
      #define M(x) ((x) / ${CRATER_R.toFixed(2)})
      #define FOLLOW_S ${FOLLOW.toFixed(2)}
      // A hard-edged band lo < r < hi, anti-aliased by one pixel either side.
      float band(float r, float lo, float hi, float aa) {
        return smoothstep(lo - aa, lo + aa, r) * smoothstep(hi + aa, hi - aa, r);
      }
      void main() {
        float r = length(vP);
        if (r > 1.0) discard;
        // One pixel of radius, capped: seen at a grazing angle the radial derivative is huge, and an
        // edge padded by it smears into a soft blob (the oil puddle the critics saw).
        float aa = min(fwidth(r) * 0.75, M(0.03));
        vec2 dir = vP / max(r, 0.0001);
        vec2 sun = uSunDir.xz / max(length(uSunDir.xz), 0.001);
        float sunward = dot(dir, sun);
        float t = uT;
        // The bowl punches open in the first 0.1 s and the streaks shoot out over 0.14 s (slower, the
        // frame the eye catches at touchdown showed a glowing ring with no powder thrown out of it).
        float open = 1.0 - pow(1.0 - clamp(t / 0.1, 0.0, 1.0), 3.0);
        float shoot = 1.0 - pow(1.0 - clamp(t / 0.14, 0.0, 1.0), 2.0);
        // The impact flash: about 80 ms of white-gold on the lip and the streak roots, the one
        // instant the burst may bloom. After it the gold sits just under the bloom threshold.
        float flash = exp(-t * 14.0);
        // Gold while it rides with the sled; left in the snow it settles to a pale cream lip (seen at a
        // grazing angle a full gold rim behind the lens read as a streak across the bottom of the frame).
        float goldK = 1.0 - smoothstep(FOLLOW_S - 0.1, FOLLOW_S + 0.3, t);
        float ang = atan(vP.y, vP.x);
        vec2 fw2 = normalize(uFwd.xz + vec2(0.0001));
        float ahead = dot(dir, fw2);
        // 1 straight out to either side of the sled, 0 ahead and behind.
        float sideK = abs(dir.x * fw2.y - dir.y * fw2.x);
        // The burst crater (ART.md section 4): a round bowl 1.4 m out to its lip, ringing the whole tray
        // and rider, so the low chase camera sees the lip either side of the sled. It is displaced snow,
        // not paint: the lip is a raised ridge of powder, lit on its faces turned to the sun and shaded
        // periwinkle on the others, feathering out into the snow with no outer stroke, and powder streaks
        // are thrown out over it. A flat gold band over a navy groove ringed by dark spokes read as a UI
        // target reticle painted on the snow (and a soft blob before it as an oil puddle).
        float R0 = M(1.4) * (0.5 + 0.5 * open);
        vec3 gold = vec3(1.0, 0.76, 0.3);
        // Fresh powder, a step brighter than the lit snow it is thrown over, with a trace of the sun.
        vec3 powder = mix(uLit, vec3(1.0, 0.97, 0.92), 0.4) * mix(vec3(1.0), uSunColor, 0.35) * 1.05;
        // The shaded faces of thrown powder: the snow's own periwinkle, a step deeper than its shade, so
        // the ridge holds its form seen edge-on from the low chase camera.
        vec3 shadeP = mix(uShade, uDeep, 0.3);
        // Premultiplied colour and coverage, layered bottom to top.
        vec3 P = vec3(0.0);
        float A = 0.0;
        // The pressed bowl: only the faintest cool tint, so it reads as snow, not a pool.
        float kb = (1.0 - smoothstep(R0 - M(0.4), R0 - M(0.05), r)) * 0.18;
        P = uShade * kb;
        A = kb;
        // Streaks: 12 rays of powder thrown out over the lip, longest to the sides (where the chase camera
        // sees them fan across the snow), shorter ahead and behind. Each is a soft tapering tongue of
        // fresh powder with a periwinkle shadow along its side away from the sun, so it reads as snow
        // lying on snow. (The ones thrown back at the lens are shorter, so a high phone camera does not
        // see searchlights.)
        float N = 12.0;
        float u = (ang / 6.2831853 + 0.5) * N;
        float sec = floor(u);
        float jit = (h11(sec) - 0.5) * 0.36;
        float sAcross = (fract(u) - 0.5 - jit) * 6.2831853 * r / N;
        float across = abs(sAcross);
        float r0 = R0 + M(0.04);
        float len = M(1.2 + 1.0 * h11(sec + 7.0)) * mix(0.5, 1.0, sideK) * mix(1.0, 0.7, smoothstep(0.3, 0.9, abs(ahead)));
        float tip = r0 + len * shoot;
        float along = clamp((r - r0) / max(len, 0.01), 0.0, 1.0);
        float w = M(0.22) * (1.0 - along) + 0.0005;
        float awx = min(fwidth(across), M(0.02)) + w * 0.35;
        float ray = smoothstep(w + awx, w - awx, across) * smoothstep(r0 - M(0.1), r0 + M(0.05), r) * smoothstep(tip + M(0.12), tip - M(0.25), r);
        // Which side of the streak faces away from the sun (its own little shadow), across the ray.
        vec2 tang = vec2(-dir.y, dir.x);
        float awaySun = sAcross * sign(dot(tang, sun) + 0.0001);
        vec3 rayCol = mix(powder, shadeP, smoothstep(-0.25 * w, 0.6 * w, -awaySun) * 0.85);
        rayCol = mix(rayCol, mix(powder, gold, 0.5), 0.4 * (1.0 - smoothstep(0.0, 0.35, along)) * goldK);
        rayCol = mix(rayCol, vec3(1.0, 0.95, 0.82), flash * 0.6);
        float kr = ray * mix(0.9, 0.3, along);
        P = rayCol * kr + P * (1.0 - kr);
        A = kr + A * (1.0 - kr);
        // The lip: a ridge of powder about 0.3 m wide. Each face is lit where it turns to the sun (the
        // outer face on the sun side, the inner face on the far side) and shaded periwinkle where it
        // turns away; its crest is the brightest line, and both its edges feather into the snow.
        float Rc = R0 + M(0.06);
        float lw = M(0.3);
        float q = (r - Rc) / lw;
        float face = clamp(q * 1.6, -1.0, 1.0) * sunward;
        float litK = smoothstep(-0.55, 0.45, face + 0.12);
        vec3 lipCol = mix(shadeP, powder, litK);
        // Gold catches the sunlit faces while the crater rides with the sled; left in the snow it settles
        // to the snow's own cream (a gold rim seen from behind read as a streak across the frame).
        lipCol = mix(lipCol, mix(powder, gold, 0.7), litK * goldK * 0.3);
        lipCol = mix(lipCol, mix(lipCol, vec3(1.0, 0.98, 0.94), 0.45), (1.0 - smoothstep(0.0, 0.35, abs(q))) * (0.4 + 0.6 * litK));
        lipCol = mix(lipCol, vec3(1.25, 1.18, 1.05), flash);
        float kk = smoothstep(-1.15, -0.55, q) * (1.0 - smoothstep(0.4, 1.5, q)) * 0.96;
        P = lipCol * kk + P * (1.0 - kk);
        A = kk + A * (1.0 - kk);
        float life = 1.0 - smoothstep(${CRATER_LIFE - 2}.0, ${CRATER_LIFE}.0, t);
        float d = length(cameraPosition - vWorldPos);
        float fogF = smoothstep(uFogNear, uFogFar, d);
        vec3 col = mix(P / max(A, 0.001), uFog, fogF);
        // The burst belongs around the rider. For the first moment the whole ring shows, its near
        // side too (only right under the lens does it give way), so it reads as a burst all round the
        // sled; once the sled has raced on and the crater slides back toward the lens, it dissolves
        // (by view depth relative to the rider's) instead of sweeping across the bottom of the frame.
        float zf = -(viewMatrix * vec4(vWorldPos, 1.0)).z;
        float zr = -(viewMatrix * vec4(uFocus - vec3(0.0, 0.9, 0.0), 1.0)).z;
        float nearK = zr > 1.0 ? mix(smoothstep(zr * 0.38, zr * 0.62, zf), smoothstep(zr * 0.55, zr * 0.9, zf), smoothstep(${FOLLOW.toFixed(2)}, ${(FOLLOW + 0.5).toFixed(2)}, t)) : 1.0;
        float a = A * life * (1.0 - fogF) * nearK;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** One crater decal: a small grid conformed to the ground. For its first moment (FOLLOW) it rides
 *  along under the sled while it bursts open, so the chase camera sees the ring round the sled for
 *  as long as the eye needs (at 20 m/s a crater left where the sled touched down was behind the lens
 *  within a tenth of a second, a gold smear across the bottom of the frame); then it stays pressed
 *  into the snow where it was released. */
class Crater {
  readonly mesh: Mesh;
  readonly mat = craterMaterial();
  private geo = new BufferGeometry();
  private pos: Float32Array;
  t = -1;
  following = false;

  constructor() {
    const n = CRATER_SEGS + 1;
    this.pos = new Float32Array(n * n * 3);
    const p = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        p[(j * n + i) * 2] = (i / CRATER_SEGS) * 2 - 1;
        p[(j * n + i) * 2 + 1] = (j / CRATER_SEGS) * 2 - 1;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < CRATER_SEGS; j++) {
      for (let i = 0; i < CRATER_SEGS; i++) {
        const a = j * n + i;
        idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aP', new BufferAttribute(p, 2));
    this.geo.setIndex(idx);
    this.geo.boundingSphere = new Sphere(new Vector3(), CRATER_R * 1.5);
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
  }

  stamp(c: Course, x: number, z: number, fx: number, fz: number): void {
    this.place(c, x, z, fx, fz);
    this.mat.uniforms.uSeed.value = Math.random() * 100;
    this.mat.uniforms.uT.value = 0;
    this.t = 0;
    this.following = true;
    this.mesh.visible = true;
  }

  /** Conforms the grid to the ground around (x, z), sim coordinates. */
  place(c: Course, x: number, z: number, fx: number, fz: number): void {
    const n = CRATER_SEGS + 1;
    const p = this.geo.getAttribute('aP') as BufferAttribute;
    for (let k = 0; k < n * n; k++) {
      // Local x is world x, local y is three.js z (sim z is flipped).
      const wx = x + p.getX(k) * CRATER_R;
      const sz = z - p.getY(k) * CRATER_R;
      this.pos[k * 3] = wx;
      this.pos[k * 3 + 1] = c.ground(wx, sz) + 0.05;
      this.pos[k * 3 + 2] = -sz;
    }
    (this.geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.geo.boundingSphere!.center.set(x, c.ground(x, z), -z);
    this.mat.uniforms.uFwd.value.set(fx, 0, fz);
  }

  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    if (this.t >= FOLLOW) this.following = false;
    if (this.t >= CRATER_LIFE) {
      this.t = -1;
      this.mesh.visible = false;
      return;
    }
    this.mat.uniforms.uT.value = this.t;
  }
}

const tmpN = new Vector3();
const Z_AXIS = new Vector3(0, 0, 1);

export class LandingAid {
  readonly root = new Object3D();
  private ring: Mesh;
  private ringMat = ringMaterial();
  private blob: Mesh;
  private blobMat = blobMaterial();
  private q = new Quaternion();
  private g = { x: 0, z: 0 };
  /** Seconds until predicted touchdown (Infinity when grounded). */
  timeToLand = Infinity;
  /** The chase camera (world.ts), so an airborne sled's shadow is kept in its frame. */
  eye: Camera | null = null;
  private probe = new Vector3();
  private shown = 0;
  private craters: Crater[] = [];
  private next = 0;
  /** Seconds left of the moment after a perfect landing when gifts crowding the rider shrink away. */
  private clearT = 0;

  constructor(private course: Course) {
    this.ring = new Mesh(new RingGeometry(0.5, 1, 48, 1), this.ringMat);
    this.ring.renderOrder = 2;
    this.blob = new Mesh(new CircleGeometry(1, 24), this.blobMat);
    this.blob.renderOrder = 2;
    this.root.add(this.ring, this.blob);
    // A few craters, so a quick chain of perfect landings each leaves its own mark.
    for (let i = 0; i < 3; i++) {
      const c = new Crater();
      this.craters.push(c);
      this.root.add(c.mesh);
    }
  }

  /** Burst crater pressed into the snow on a perfect landing. */
  pulse(x: number, z: number, heading = 0): void {
    const c = this.craters[this.next];
    this.next = (this.next + 1) % this.craters.length;
    c.stamp(this.course, x, z, Math.sin(heading), -Math.cos(heading));
    this.clearT = 0.5;
    // The telegraph has done its job: it goes at once, so the burst reads on its own.
    this.shown = 0;
    this.ring.visible = false;
  }

  setCourse(c: Course): void {
    this.course = c;
    this.clearT = 0;
    shared.uFocusClear.value = 0;
    for (const cr of this.craters) {
      cr.t = -1;
      cr.mesh.visible = false;
    }
  }

  update(s: Snap, gravity: number, airTicks: number, dt: number, blobVisible: boolean): void {
    const c = this.course;
    for (const cr of this.craters) {
      cr.update(dt);
      // While it bursts open the ring rides with the sled (a jump or a crash lets it go).
      if (cr.following) {
        if (s.grounded && !s.crashed) cr.place(c, s.x, s.z, Math.sin(s.heading), -Math.cos(s.heading));
        else cr.following = false;
      }
    }
    // Full for 0.3 s, then the gifts grow back over 0.2 s.
    this.clearT = Math.max(0, this.clearT - dt);
    shared.uFocusClear.value = Math.min(1, this.clearT / 0.2);
    const g = this.g;
    // Contact shadow under the sled.
    const h = Math.max(0, s.y - c.ground(s.x, s.z));
    this.blob.visible = blobVisible && !s.crashed;
    if (this.blob.visible) {
      // An airborne sled's shadow falls a little ahead of the point under it, as if from a high light
      // behind the lens, so the chase camera (which rises with the sled) keeps it in the frame: straight
      // down it fell below the bottom edge after a metre or two of air, and a jump's height was
      // unreadable. Where the cast shadows are faint (Blizzard) it leans further, carrying the read.
      const faintK = 1 - shared.uShadowK.value;
      const vl = Math.hypot(s.vx, s.vz);
      let lead = vl > 0.5 ? (h * (0.55 + 0.6 * faintK)) / vl : 0;
      let bx = s.x + s.vx * lead;
      let bz = s.z + s.vz * lead;
      // On a big jump the chase camera rises with the sled and even that point drops below the bottom
      // edge: the shadow slides further ahead, a few steps at most, until it sits just inside the frame.
      if (this.eye && h > 0.3 && vl > 0.5) {
        const step = Math.max(0.6, h * 0.3) / vl;
        for (let i = 0; i < 12; i++) {
          if (this.probe.set(bx, c.ground(bx, bz), -bz).project(this.eye).y > -0.78) break;
          lead += step;
          bx = s.x + s.vx * lead;
          bz = s.z + s.vz * lead;
        }
      }
      const gy = c.ground(bx, bz);
      c.gradient(bx, bz, g);
      const n = tmpN.set(-g.x, 1, g.z).normalize();
      this.blob.position.set(bx, gy + 0.03, -bz);
      this.blob.quaternion.setFromUnitVectors(Z_AXIS, n);
      this.blob.rotateZ(-s.heading);
      // It is how you judge a jump (ART.md section 2), so an airborne sled keeps a clear one: it
      // spreads and thins only gently with height, and where the cast shadows are faint (Blizzard's
      // overcast) it carries the read on its own, a little darker.
      const k = 1 + h * 0.09;
      this.blob.scale.set(0.55 * k, 0.95 * k, 1);
      this.blobMat.uniforms.uColor.value.copy(shared.uSnowDeep.value).multiplyScalar(0.75 - 0.15 * faintK);
      this.blobMat.uniforms.uAlpha.value = Math.min(0.7, Math.max(0.3 + 0.2 * faintK, (0.5 + 0.25 * faintK) / (1 + h * 0.15)));
    }

    // Predict touchdown with a ballistic march over the real ground function.
    this.timeToLand = Infinity;
    let px = s.x;
    let py = s.y;
    let pz = s.z;
    if (!s.grounded && !s.crashed) {
      let vy = s.vy;
      const step = 1 / 60;
      for (let t = 0; t < 5; t += step) {
        vy -= gravity * step;
        px += s.vx * step;
        py += vy * step;
        pz += s.vz * step;
        if (py <= c.ground(px, pz)) {
          this.timeToLand = t + step;
          break;
        }
      }
    }
    const want = this.timeToLand < 5 && airTicks > 14 ? 1 : 0;
    this.shown += (want - this.shown) * Math.min(1, dt * (want ? 14 : 12));
    this.ring.visible = this.shown > 0.02;
    if (!this.ring.visible) return;
    // Once down there is no prediction left: the ring fades out where and as it was at touchdown
    // (recomputing it from no prediction blew it up to its widest, a pale disc round the landing).
    if (!want) {
      this.ringMat.uniforms.uAlpha.value = this.shown;
      return;
    }
    const t = this.timeToLand;
    const hot = t <= 0.15 ? 1 : 0;
    // It closes in to just around the sled, so the stomp flash still shows past the rider.
    const radius = 1.05 + 1.9 * Math.min(1, t / 1.1);
    c.gradient(px, pz, g);
    const n = tmpN.set(-g.x, 1, g.z).normalize();
    this.ring.position.set(px, c.ground(px, pz) + 0.05, -pz);
    this.ring.quaternion.copy(this.q.setFromUnitVectors(Z_AXIS, n));
    this.ring.scale.setScalar(radius * (hot ? 1.08 : 1));
    this.ringMat.uniforms.uColor.value.set(hot ? '#FFE08A' : '#F5F3FF');
    this.ringMat.uniforms.uEdge.value.copy(shared.uSnowDeep.value).multiplyScalar(0.7);
    this.ringMat.uniforms.uHot.value = hot;
    // The dashes wind inward as it closes (one dash per second of fall).
    this.ringMat.uniforms.uSpin.value = (t * 1.0) % 1;
    // The band thickens in the stomp window. It stays a ring: from the low chase camera a band much
    // wider than this foreshortens into a solid white plate under the sled.
    this.ringMat.uniforms.uInner.value = hot ? 0.68 : 0.75;
    this.ringMat.uniforms.uAlpha.value = this.shown * (hot ? 1 : 0.7 + 0.25 * (1 - Math.min(1, t / 1.1)));
  }
}
