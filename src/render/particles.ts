import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three';
import { shared } from './materials';

// CPU-simulated point particles in two blend layers (powder and glow), plus a GPU-animated
// weather volume that follows the camera (snowfall, blizzard streaks, petals, embers, wisps).
// Particles live in flat typed arrays (no per-particle objects). Powder is three populations: crisp
// sunlit grains that stretch along their motion through the lens, billows (lumpy clumps of thrown
// powder with a feathered edge, a sunlit crest and rim and a periwinkle belly, the body of a rooster
// tail or a landing burst) and a few large, faint mist puffs. All take their colours from the mood's snow and
// sun, so spray is lavender with an ember rim on Comet Night and icy on Glass Ice.

const KIND_GRAIN = 0;
const KIND_STEAM = 1;
const KIND_MIST = 2;
/** Billows carry a per-particle seed (for their lumpy outline) in the fraction: 3 to 3.9. */
const KIND_PUFF = 3;
const puffKind = () => KIND_PUFF + Math.random() * 0.9;

/** The chase camera's velocity, so sprites stretch along motion as seen through the lens. */
const camVel = new Vector3();

const ATTRS = ['position', 'aVel', 'aColor', 'aSize', 'aAlpha', 'aKind'] as const;

class Layer {
  readonly points: Points;
  private n = 0;
  private cap: number;
  private ring = 0;
  // Simulation state, one slot per particle.
  private x: Float32Array;
  private y: Float32Array;
  private z: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private a: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  /** The carrier: drag pulls a particle toward this velocity, not toward rest. Spray thrown off a
   *  fast sled keeps riding along beside it for a moment instead of stopping dead in the air. */
  private cv: Float32Array;
  private rgbk: Float32Array;
  // GPU buffers.
  private geo: BufferGeometry;
  private attrs: BufferAttribute[];
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private kind: Float32Array;

  constructor(
    private capMax: number,
    additive: boolean,
  ) {
    this.cap = capMax;
    const f = () => new Float32Array(capMax);
    this.x = f();
    this.y = f();
    this.z = f();
    this.vx = f();
    this.vy = f();
    this.vz = f();
    this.life = f();
    this.max = f();
    this.s0 = f();
    this.s1 = f();
    this.a = f();
    this.grav = f();
    this.drag = f();
    this.cv = new Float32Array(capMax * 3);
    this.rgbk = new Float32Array(capMax * 4);
    this.geo = new BufferGeometry();
    this.pos = new Float32Array(capMax * 3);
    this.vel = new Float32Array(capMax * 3);
    this.col = new Float32Array(capMax * 3);
    this.size = f();
    this.alpha = f();
    this.kind = f();
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aVel', new BufferAttribute(this.vel, 3).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aColor', new BufferAttribute(this.col, 3).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aSize', new BufferAttribute(this.size, 1).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1).setUsage(DynamicDrawUsage));
    this.geo.setAttribute('aKind', new BufferAttribute(this.kind, 1).setUsage(DynamicDrawUsage));
    this.attrs = ATTRS.map((name) => this.geo.getAttribute(name) as BufferAttribute);
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      uniforms: {
        uScale: { value: 600 },
        uCamVel: { value: camVel },
        uSunDir: shared.uSunDir,
        uSunColor: shared.uSunColor,
        uSnowLit: shared.uSnowLit,
        uSnowShade: shared.uSnowShade,
        uSnowDeep: shared.uSnowDeep,
        uRim: shared.uRim,
        uFog: shared.uFog,
        uFogNear: shared.uFogNear,
        uFogFar: shared.uFogFar,
        uFocus: shared.uFocus,
        uLanternPos: shared.uLanternPos,
        uLanternColor: shared.uLanternColor,
        uLantern: shared.uLantern,
      },
      defines: additive ? { ADD: 1 } : {},
      vertexShader: /* glsl */ `
        attribute vec3 aVel;
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        attribute float aKind;
        uniform float uScale;
        uniform vec3 uCamVel;
        uniform vec3 uSunDir;
        uniform vec3 uFocus;
        uniform vec3 uLanternPos;
        uniform float uLantern;
        uniform float uFogNear;
        uniform float uFogFar;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vFog;
        varying float vKind;
        varying vec2 vAxis;
        varying float vRatio;
        varying vec3 vSun;
        varying float vLamp;
        varying vec2 vLampDir;
        void main() {
          vColor = aColor;
          vKind = aKind;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = max(-mv.z, 0.05);
          vFog = smoothstep(uFogNear, uFogFar, depth);
          float size = aSize * uScale / max(depth, 0.5);
          // Nothing blurs into a bokeh blob right in front of the lens. Mist puffs fade out sooner,
          // over the near half of the way to the rider (so a closer chase camera keeps the plume
          // around the rider in full); grains and billows hold until about a third of the way.
          vec4 rv = viewMatrix * vec4(uFocus, 1.0);
          float zr = max(-rv.z, 3.0);
          float a = aAlpha * (aKind > 1.5 && aKind < 2.5 ? smoothstep(zr * 0.4, zr * 0.75, depth) : aKind < 0.5 ? smoothstep(zr * 0.22, zr * 0.55, depth) : aKind > 2.5 ? smoothstep(zr * 0.48, zr * 0.82, depth) : smoothstep(1.2, 3.4, depth));
          // Never a veil over the hero: powder between the lens and the rider, over the rider's outline
          // on screen (sled to beanie, about 0.6 m either side of its middle), thins to a fifth. Beside
          // the rider it keeps its full strength (a 3D radius here hid the whole rooster tail), and
          // behind it the rider's own depth hides it.
          float over = 0.0;
          float beside = 0.0;
          if (rv.z < -0.5 && mv.z < -0.05) {
            float ov = length((mv.xy / -mv.z - rv.xy / -rv.z) * -rv.z / vec2(0.62, 1.0));
            over = (1.0 - smoothstep(0.75, 1.15, ov)) * smoothstep(0.1, 0.6, mv.z - rv.z);
            // Beside the rider at about its own depth (its rooster tail, its landing burst), a billow
            // touching its outline on screen (grown by the billow's own size) stays small and sparse,
            // so the rider is never buried in powder and stays the second-clearest thing in the frame.
            beside = (1.0 - smoothstep(0.95, 1.75, ov)) * (1.0 - smoothstep(0.8, 2.2, abs(mv.z - rv.z)));
          }
          vAxis = vec2(1.0, 0.0);
          vRatio = 1.0;
          vSun = vec3(0.0, 0.0, 1.0);
          vLamp = 0.0;
          vLampDir = vec2(0.0, 1.0);
          #ifdef ADD
            // Motes stay small: a big additive sprite near the lens is a blot of light, not a glint.
            size = min(size, uScale * 0.032);
            // Sparkles stay out of the rider's silhouette.
            a *= 1.0 - 0.7 * over;
          #else
            a *= 1.0 - 0.8 * over;
            // Billows belong to the burst or plume round the rider: one that has drifted a few metres off
            // (a drift carried it out over the slope) thins away rather than hanging in the air.
            if (aKind > 2.5) a *= 1.0 - smoothstep(2.5, 4.8, distance(position, uFocus));
            // Grains stay crisp specks and billows small clumps; only mist and steam grow into soft puffs.
            size = min(size, uScale * (aKind > 2.5 ? 0.075 : aKind > 0.5 ? 0.085 : 0.032));
            if (aKind > 2.5) {
              size *= mix(1.0, 0.55, beside);
              a *= mix(1.0, 0.4, beside);
            }
            // A sub-pixel grain would shimmer: hold it at two pixels and thin it out instead.
            float minPx = 2.0 * uScale / 720.0;
            if (size < minPx) {
              a *= size / minPx;
              size = minPx;
            }
            if (aKind < 0.5) {
              // Stretch along the motion relative to the lens over a short virtual shutter. Only
              // fast, fresh spray streaks: powder that has settled stays a speck rather than smearing
              // into a flat disc as the camera races past it.
              float fresh = smoothstep(1.5, 6.0, length(aVel));
              // Spray that has nearly come to rest shrinks to a speck and thins out instead of lying
              // about as white pellets (near the lens they would be the biggest shapes in the snow).
              a *= mix(0.25, 1.0, fresh);
              // Fine specks, not a field of matching ovals (a few hundred same-sized grains read as
              // cotton balls): the billows carry the body of a plume.
              size = min(size, uScale * mix(0.006, 0.014, fresh));
              vec4 c0 = projectionMatrix * mv;
              vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + (aVel - uCamVel) * 0.02 * fresh, 1.0);
              if (c1.w > 0.1 && c0.w > 0.1) {
                vec2 px = (c1.xy / c1.w - c0.xy / c0.w) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0) * (uScale / 0.9) * 0.5;
                float len = length(px);
                float longAxis = min(clamp(size + len, size, size * 3.0), max(uScale * 0.045, size));
                if (len > 0.5) vAxis = vec2(px.x, -px.y) / len;
                // A streak is thinner than the grain it smears out.
                float thin = mix(1.0, 0.65, smoothstep(1.0, 3.0, longAxis / size));
                vRatio = size * thin / max(longAxis, 0.001);
                a *= mix(1.0, 0.8, 1.0 - vRatio);
                size = longAxis;
              }
            }
            // Steam rises as tall, thin wisps.
            if (aKind > 0.5 && aKind < 1.5) {
              vAxis = vec2(0.0, 1.0);
              vRatio = 0.45;
            }
            vSun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
            if (uLantern > 0.0) {
              vLamp = uLantern * pow(clamp(1.0 - distance(position, uLanternPos) / 15.0, 0.0, 1.0), 2.0);
              // Which way the lantern lies on screen, so only the side of a puff facing it turns amber.
              vec2 ld = (viewMatrix * vec4(uLanternPos - position, 0.0)).xy;
              vLampDir = ld / max(length(ld), 0.001);
            }
          #endif
          vAlpha = a;
          gl_PointSize = size;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor;
        uniform vec3 uSnowLit;
        uniform vec3 uSnowShade;
        uniform vec3 uSnowDeep;
        uniform vec3 uRim;
        uniform vec3 uFog;
        uniform vec3 uLanternColor;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vFog;
        varying float vKind;
        varying vec2 vAxis;
        varying float vRatio;
        varying vec3 vSun;
        varying float vLamp;
        varying vec2 vLampDir;
        float hash2(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vnoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          #ifdef ADD
            // A glinting mote of light: a hot core in a soft round halo, with no rays. Four-point star
            // sprites hanging in the air read as stock clip-art twinkles pasted over the painting;
            // the snow keeps its own rayed glints (materials.ts).
            float d = length(c) * 2.0;
            float core = smoothstep(0.4, 0.0, d);
            float halo = smoothstep(1.0, 0.15, d);
            float a = clamp(core * core * 1.15 + halo * halo * 0.3, 0.0, 1.0) * vAlpha;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vColor * a, a);
          #else
            // An ellipse along the motion axis, mapped back to a unit disc.
            vec2 perp = vec2(-vAxis.y, vAxis.x);
            vec2 q = vec2(dot(c, vAxis), dot(c, perp) / vRatio) * 2.0;
            float r2 = dot(q, q);
            if (r2 > 1.0) discard;
            float r = sqrt(r2);
            // Where this fragment sits across the sprite, y up, against the sun's direction on screen.
            vec2 cp = vAxis * q.x + perp * q.y;
            vec2 sun2 = vSun.xy / max(length(vSun.xy), 0.001);
            float side = dot(vec2(cp.x, -cp.y), sun2);
            // A low sun ahead of the lens backlights the spray: it glows (forward scattering).
            float back = pow(clamp(-vSun.z, 0.0, 1.0), 1.5);
            vec3 litCol = mix(uSnowLit, vec3(1.0, 0.95, 0.86), 0.35) * uSunColor;
            // Sunlit powder is cream with only a trace of the sun's hue: under a gold sun (Glass Ice)
            // the full colour turned a plume into mustard-yellow crumbs.
            litCol = mix(litCol, vec3(dot(litCol, vec3(0.3, 0.59, 0.11))), 0.55);
            // Under a dim moon, powder still reads a step brighter than the snow it is thrown over.
            litCol *= 1.0 + 0.8 * smoothstep(0.6, 0.25, dot(litCol, vec3(0.3, 0.59, 0.11)));
            vec3 shadeCol = mix(uSnowShade, uSnowLit, 0.35);
            vec3 col;
            float a;
            // How much of this fragment faces the sled lantern (Lantern Night), set per kind below.
            float lampK = 0.5;
            if (vKind > 2.5) {
              // A billow of thrown powder, lit like a small cloud: its crest (the top and the sun side)
              // catches the light a step above the lit snow it flies over, its underside falls into the
              // mood's periwinkle shade (moon blue at night), and a sunlit rim runs round its sunward
              // edge. Its edge is feathered, powder thinning out into the air: a crisp round ball of one
              // value read as a cotton ball.
              float seed = fract(vKind) * 11.0;
              float ang = atan(c.y, c.x);
              float rr = length(c) * 2.0;
              float edge = 0.88 + 0.07 * sin(ang * 5.0 + seed * 5.7) + 0.04 * sin(ang * 8.0 - seed * 3.1);
              // Broken up by two octaves of noise, so a billow frays into grains at its rim like thrown
              // powder instead of ending in a smooth round outline.
              float fray = vnoise2(c * 7.0 + seed * 3.7) * 0.62 + vnoise2(c * 15.0 - seed * 2.3) * 0.38;
              a = vAlpha * smoothstep(edge, edge * 0.45, rr + (fray - 0.5) * 0.55);
              if (a < 0.01) discard;
              // A sphere normal with y up the screen (gl_PointCoord runs down).
              vec3 nrm = vec3(c.x * 2.0, -c.y * 2.0, sqrt(max(1.0 - rr * rr, 0.0)));
              vec2 sun2 = vSun.xy / max(length(vSun.xy), 0.001);
              float crestK = smoothstep(-0.05, 0.55, nrm.y * 0.6 + dot(nrm.xy, sun2) * 0.45);
              vec3 belly = mix(uSnowShade, uSnowDeep, 0.25);
              // A thinning billow (old, or drifting off) disperses: its belly lightens toward the crest,
              // so it never lingers as a grey smudge on the snow.
              belly = mix(mix(uSnowShade, uSnowLit, 0.55), belly, smoothstep(0.12, 0.55, vAlpha));
              // The crest is the lit snow's own cream, a step brighter, with only a trace of the sun's hue
              // (a gold sun turned whole plumes into yellow puffs).
              vec3 crestC = mix(litCol, vec3(dot(litCol, vec3(0.3, 0.59, 0.11))), 0.7) * 1.15;
              col = mix(belly, crestC, crestK) * vColor;
              // The sunlit rim, brightest when a low sun backlights the plume (forward scattering).
              col += litCol * smoothstep(0.45, 0.85, rr) * smoothstep(-0.1, 0.7, dot(nrm.xy, sun2)) * (0.3 + 0.6 * back);
              lampK = smoothstep(-0.3, 0.7, dot(nrm.xy, vLampDir) * 0.8 + nrm.z * 0.2);
            } else if (vKind > 1.5) {
              // Mist: a soft sunlit veil with no edge, lit a little more on the sun side. Under a dim
              // moon it would read as smoke, so it thins out unless the lantern lights it.
              float k = 1.0 - r2;
              float bright = clamp(dot(uSnowLit * uSunColor, vec3(0.3, 0.59, 0.11)) * 1.4 + vLamp, 0.0, 1.0);
              a = vAlpha * k * k * mix(0.25, 1.0, bright);
              col = mix(shadeCol, litCol, 0.7 + 0.3 * side) * vColor * (1.0 + 0.2 * back);
              // A puff of spray sits in its own shade underneath, so it reads as a volume over lit snow.
              col = mix(col, mix(uSnowShade, uSnowLit, 0.25) * vColor, smoothstep(0.0, 0.9, cp.y) * 0.45);
            } else if (vKind > 0.5) {
              // Vent steam: a faint, soft wisp with no edge at all.
              float k = 1.0 - r2;
              a = vAlpha * k * k;
              col = mix(uSnowShade, uSnowLit * uSunColor, 0.75 + 0.25 * side) * vColor;
            } else {
              // A sunlit grain: warm cream on the sun side, the mood's shade colour on the far side,
              // and a crisp bright rim where the sun catches its edge, brightest when backlit. Soft
              // edges and a motion stretch, so grains merge into spray instead of reading as pellets.
              // A streak is a smear of light, not a lit ball: it flattens toward the lit colour.
              float lit = mix(smoothstep(-0.65, 0.1, side), 0.9, smoothstep(0.7, 0.3, vRatio));
              col = mix(shadeCol, litCol, mix(0.2, 1.0, lit)) * vColor;
              // Each puff's underside sits in its own periwinkle shade (cp.y runs down the screen; moon
              // blue at night), so spray thrown over lit snow keeps its form instead of reading as cotton.
              col = mix(col, mix(uSnowShade, uSnowDeep, 0.15) * vColor, smoothstep(-0.15, 0.7, cp.y) * 0.6 * smoothstep(0.35, 0.75, vRatio));
              float rim = smoothstep(0.45, 0.85, r) * smoothstep(0.1, 0.7, side);
              col += mix(uRim, vec3(1.0), 0.35) * rim * (0.5 + 1.1 * back);
              // The sun side of a fresh grain glows a step above the lit snow it is thrown over.
              col *= 1.0 + 0.15 * smoothstep(0.0, 0.8, side) * (1.0 - smoothstep(0.0, 0.9, cp.y));
              col += litCol * back * 0.3 * (1.0 - r2);
              // Translucent powder, densest at the heart and thinning to nothing at the edge.
              a = vAlpha * 0.85 * (1.0 - r2) * smoothstep(1.0, 0.6, r);
              lampK = smoothstep(-0.4, 0.6, dot(vec2(cp.x, -cp.y), vLampDir));
            }
            // Lantern Night: the side facing the sled lantern takes its desaturated amber; the far side
            // keeps the moon's blue, so a plume reads as a lit volume rather than grey cotton.
            vec3 lampC = mix(vec3(dot(uLanternColor, vec3(0.2126, 0.7152, 0.0722))), uLanternColor, 0.7);
            col += lampC * vLamp * mix(0.12, 1.25, lampK);
            col = mix(col, uFog, vFog);
            gl_FragColor = vec4(col, a * (1.0 - vFog * 0.6));
          #endif
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  setScale(px: number): void {
    (this.points.material as ShaderMaterial).uniforms.uScale.value = px;
  }

  setCap(cap: number): void {
    this.cap = Math.max(1, Math.min(cap, this.capMax));
    if (this.n > this.cap) this.n = this.cap;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, max: number, s0: number, s1: number, r: number, g: number, b: number, a: number, grav: number, drag: number, kind = KIND_GRAIN, carrier: Vector3 | null = null): void {
    let i = this.n;
    if (i >= this.cap) {
      // Full: recycle slots round-robin rather than shifting the whole list.
      i = this.ring;
      this.ring = (this.ring + 1) % this.cap;
    } else this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = 0;
    this.max[i] = max;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.a[i] = a;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.cv[i * 3] = carrier ? carrier.x : 0;
    this.cv[i * 3 + 1] = carrier ? carrier.y : 0;
    this.cv[i * 3 + 2] = carrier ? carrier.z : 0;
    this.rgbk[i * 4] = r;
    this.rgbk[i * 4 + 1] = g;
    this.rgbk[i * 4 + 2] = b;
    this.rgbk[i * 4 + 3] = kind;
  }

  private copy(from: number, to: number): void {
    this.x[to] = this.x[from];
    this.y[to] = this.y[from];
    this.z[to] = this.z[from];
    this.vx[to] = this.vx[from];
    this.vy[to] = this.vy[from];
    this.vz[to] = this.vz[from];
    this.life[to] = this.life[from];
    this.max[to] = this.max[from];
    this.s0[to] = this.s0[from];
    this.s1[to] = this.s1[from];
    this.a[to] = this.a[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
    this.cv.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.rgbk.copyWithin(to * 4, from * 4, from * 4 + 4);
  }

  update(dt: number): void {
    // Integrate, swap-removing dead particles (order does not matter for blended points).
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        this.n--;
        if (i !== this.n) this.copy(this.n, i);
        continue;
      }
      this.vy[i] -= this.grav[i] * dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      const c3 = i * 3;
      this.vx[i] = this.cv[c3] + (this.vx[i] - this.cv[c3]) * k;
      this.vy[i] = this.cv[c3 + 1] + (this.vy[i] - this.cv[c3 + 1]) * k;
      this.vz[i] = this.cv[c3 + 2] + (this.vz[i] - this.cv[c3 + 2]) * k;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      i++;
    }
    if (this.ring >= this.n) this.ring = 0;
    const n = this.n;
    for (let j = 0; j < n; j++) {
      const t = this.life[j] / this.max[j];
      const j3 = j * 3;
      this.pos[j3] = this.x[j];
      this.pos[j3 + 1] = this.y[j];
      this.pos[j3 + 2] = this.z[j];
      this.vel[j3] = this.vx[j];
      this.vel[j3 + 1] = this.vy[j];
      this.vel[j3 + 2] = this.vz[j];
      this.col[j3] = this.rgbk[j * 4];
      this.col[j3 + 1] = this.rgbk[j * 4 + 1];
      this.col[j3 + 2] = this.rgbk[j * 4 + 2];
      this.kind[j] = this.rgbk[j * 4 + 3];
      this.size[j] = this.s0[j] + (this.s1[j] - this.s0[j]) * t;
      // Quick fade in, then a smooth fade over the rest of the life.
      const out = 1 - (t - 0.1) / 0.9;
      this.alpha[j] = this.a[j] * (t < 0.1 ? t / 0.1 : out * (2 - out));
    }
    this.geo.setDrawRange(0, n);
    for (let k = 0; k < this.attrs.length; k++) {
      const attr = this.attrs[k];
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, n * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  clear(): void {
    this.n = 0;
    this.ring = 0;
    this.geo.setDrawRange(0, 0);
  }
}

const WHITE = new Color('#FFFFFF');
const ICE = new Color('#DDF6FF');
const GOLD = new Color('#FFE08A');
/** Grit knocked off a hazard's foot: dark slate chips (as the avalanche's debris), or ice shards. */
const SLATE = new Color(0.3, 0.34, 0.5);
const SHARD = new Color(0.78, 0.92, 1.05);
const tmpTint = new Color();
/** Tint for freshly thrown powder: a touch over white, so a burst outshines the lit snow under it. */
const POWDER = 1.12;
const tmpF = new Vector3();
const tmpS = new Vector3();
const tmpC = new Vector3();

export class Particles {
  readonly powder: Layer;
  readonly glow: Layer;
  private budget = 1;

  constructor(cap: number) {
    this.powder = new Layer(cap, false);
    this.glow = new Layer(Math.round(cap * 0.6), true);
  }

  get objects(): Points[] {
    return [this.powder.points, this.glow.points];
  }

  setQuality(budget: number, viewportHeight: number): void {
    this.budget = budget;
    this.powder.setCap(Math.round(1700 * budget));
    this.glow.setCap(Math.round(900 * budget));
    const scale = viewportHeight * 0.9;
    this.powder.setScale(scale);
    this.glow.setScale(scale);
  }

  update(dt: number): void {
    this.powder.update(dt);
    this.glow.update(dt);
  }

  clear(): void {
    this.powder.clear();
    this.glow.clear();
  }

  private n(count: number): number {
    const v = count * this.budget;
    return Math.floor(v) + (Math.random() < v - Math.floor(v) ? 1 : 0);
  }

  /** Horizontal unit direction of travel (falls back to downhill when nearly stopped). */
  private forward(vel: Vector3): Vector3 {
    const l = Math.hypot(vel.x, vel.z);
    return l > 0.5 ? tmpF.set(vel.x / l, 0, vel.z / l) : tmpF.set(0, 0, -1);
  }

  /** A rooster tail off the outside runner while carving or drifting: sunlit grains and billows of
   *  powder thrown up, out to the side and back. The spray keeps most of the sled's speed, so in the
   *  chase camera's view it rises beside the rider and streams back past the lens at the frame's side
   *  instead of vanishing behind it in a blink; plus a faint mist puff now and then. `toward` is +1 to
   *  throw to the sled's right, -1 to its left. */
  spray(pos: Vector3, heading: number, toward: number, vel: Vector3, amount: number, ice = false, heat: Color | null = null, heatK = 0, glowShare = 0): void {
    const f = this.forward(vel);
    // Thrown square to the line of travel, not to the sled's nose: in a drift the nose swings well
    // off the line, and spray thrown off it flew out ahead of the rider and hung in the sky.
    const side = vel.x * vel.x + vel.z * vel.z > 4 ? tmpS.set(-f.z * toward, 0, f.x * toward) : tmpS.set(Math.cos(heading) * toward, 0, Math.sin(heading) * toward);
    // Drift heat (a held drift's charge, 0 to 1): the spray warms inside the player's vermillion, the
    // colour picked once per emit (mix(white or ice, tier colour, 0.25 + 0.5k)), at no extra cost.
    const base = ice ? ICE : WHITE;
    const tint = heat ? tmpTint.copy(base).lerp(heat, 0.25 + 0.5 * Math.max(0, Math.min(1, heatK))) : base;
    // Spray rides on most of the sled's velocity (its carrier), so it must keep the matching share of
    // its descent too: otherwise the slope drops away under it and it floats off into the sky. It
    // falls back from the sled at about 3 m/s, so it streams past the lens in about half a second.
    const fall = Math.max(vel.y, -Math.hypot(vel.x, vel.z) * 0.7);
    const car = tmpC.set(vel.x * 0.85, fall * 0.85, vel.z * 0.85);
    const count = this.n(amount * 3.6);
    for (let i = 0; i < count; i++) {
      const s = 1.3 + Math.random() * (1.2 + 1.4 * amount);
      const back = 0.1 + Math.random() * 0.5;
      const j = (Math.random() - 0.5) * 1.6;
      const big = Math.random();
      if (heat && glowShare > 0 && Math.random() < glowShare) {
        // A fully charged drift throws hot vermillion motes off the runner: low and short-lived,
        // skimming the snow with the spray (decision 67), hot enough to bloom.
        this.glow.emit(
          pos.x + side.x * 0.35 - f.x * back,
          pos.y + 0.06,
          pos.z + side.z * 0.35 - f.z * back,
          car.x + side.x * s * 0.8 + f.x * j,
          car.y + 0.3 + Math.random() * 0.6,
          car.z + side.z * s * 0.8 + f.z * j,
          0.22 + Math.random() * 0.2,
          0.13,
          0.04,
          heat.r * 1.45,
          heat.g * 1.45,
          heat.b * 1.45,
          1,
          6,
          2.4,
          KIND_GRAIN,
          car,
        );
        continue;
      }
      this.powder.emit(
        pos.x + side.x * 0.4 - f.x * back + (Math.random() - 0.5) * 0.16,
        pos.y + 0.08,
        pos.z + side.z * 0.4 - f.z * back + (Math.random() - 0.5) * 0.16,
        car.x + side.x * s + f.x * j,
        car.y + 1.4 + Math.random() * (1.2 + 1.0 * amount),
        car.z + side.z * s + f.z * j,
        // Short-lived: spray fades in the air, never lying about on the snow as white pellets.
        0.3 + Math.random() * 0.28,
        0.05 + big * 0.035,
        0.07 + big * big * 0.07,
        POWDER * tint.r,
        POWDER * tint.g,
        POWDER * tint.b,
        0.6 + Math.random() * 0.4,
        7.5,
        1.8,
        KIND_GRAIN,
        car,
      );
    }
    // Billows: the body of the rooster tail, lumps of powder that rise off the runner, swell and
    // hang for a moment, crest lit and belly in shade.
    const puffs = this.n(amount * 1.2);
    for (let i = 0; i < puffs; i++) {
      const s = 0.8 + Math.random() * (0.9 + 0.8 * amount);
      const back = 0.15 + Math.random() * 0.45;
      const big = Math.random();
      this.powder.emit(
        pos.x + side.x * 0.45 - f.x * back,
        pos.y + 0.12,
        pos.z + side.z * 0.45 - f.z * back,
        car.x + side.x * s,
        car.y + 1.1 + Math.random() * (0.8 + 0.6 * amount),
        car.z + side.z * s,
        0.26 + Math.random() * 0.22,
        0.09 + big * 0.05,
        0.16 + big * big * 0.26 * (0.6 + 0.4 * amount),
        tint.r,
        tint.g,
        tint.b,
        0.85,
        3.2,
        2.2,
        puffKind(),
        car,
      );
    }
    // Mist rolls out low and slow off the runner and swells as it thins: the body of the plume.
    // Many faint, overlapping puffs, so the mist reads as one continuous veil and never as balls.
    const mist = this.n(amount * 0.5);
    // The mist veil takes half the heat, so the plume's body stays snow and its spray carries the colour.
    const mr = (base.r + tint.r) * 0.5;
    const mg = (base.g + tint.g) * 0.5;
    const mb = (base.b + tint.b) * 0.5;
    for (let i = 0; i < mist; i++) {
      const s = 0.6 + Math.random() * 1.6;
      const back = 0.3 + Math.random() * 0.7;
      this.powder.emit(
        pos.x + side.x * 0.55 - f.x * back + (Math.random() - 0.5) * 0.4,
        pos.y + 0.12,
        pos.z + side.z * 0.55 - f.z * back + (Math.random() - 0.5) * 0.4,
        side.x * s + vel.x * 0.6,
        fall * 0.6 + 0.2 + Math.random() * 0.4,
        side.z * s + vel.z * 0.6,
        0.45 + Math.random() * 0.35,
        0.22,
        0.75 + Math.random() * 0.4,
        mr,
        mg,
        mb,
        0.17,
        1.8,
        3,
        KIND_MIST,
      );
    }
  }

  /** Powder burst on landing, crashing or smashing. With `vel` (a landing) the powder fans out
   *  low to the sides and behind, so the rider stays clear and visible. */
  burst(pos: Vector3, power: number, count = 30, vel?: Vector3, tint: Color = WHITE): void {
    const n = this.n(count * Math.min(2, power) * 1.6);
    const f = vel ? this.forward(vel) : null;
    const fx = f ? f.x : 0;
    const fz = f ? f.z : 0;
    const keep = vel ? 0.35 : 0;
    const vxk = vel ? vel.x * keep : 0;
    const vzk = vel ? vel.z * keep : 0;
    const vyk = vel ? Math.max(vel.y, -Math.hypot(vel.x, vel.z) * 0.7) * keep : 0;
    for (let i = 0; i < n; i++) {
      let dx: number;
      let dz: number;
      if (f) {
        // Sideways and back: angles from 70 to 170 degrees off the direction of travel.
        const a = (Math.random() < 0.5 ? -1 : 1) * (1.22 + Math.random() * 1.75);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        dx = fx * ca - fz * sa;
        dz = fz * ca + fx * sa;
      } else {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a);
        dz = Math.sin(a);
      }
      const s = (1.2 + Math.random() * 3.6) * power;
      // Every fifth is a billow, so the burst has a body (crest lit, belly in shade), not only grains.
      const puff = i % 5 === 0;
      this.powder.emit(
        pos.x + dx * 0.35,
        pos.y + (puff ? 0.15 : 0.06),
        pos.z + dz * 0.35,
        dx * s * (puff ? 0.6 : 1) + vxk,
        (f ? 0.6 + Math.random() * 1.6 : 0.9 + Math.random() * 2.4) * power * (puff ? 0.5 : 1) + vyk,
        dz * s * (puff ? 0.6 : 1) + vzk,
        puff ? 0.45 + Math.random() * 0.3 : 0.35 + Math.random() * 0.4,
        puff ? 0.14 : 0.03,
        puff ? 0.32 + Math.random() * 0.22 : 0.05 + Math.random() * 0.07,
        tint.r,
        tint.g,
        tint.b,
        puff ? 0.8 : 0.55 + Math.random() * 0.4,
        puff ? 2.5 : 8,
        puff ? 3 : 2.2,
        puff ? puffKind() : KIND_GRAIN,
      );
    }
  }

  /** Perfect landing, about half a second of payoff all round the tray (it rides on most of the
   *  sled's velocity, so it stays around the rider while it plays): a radial burst of powder billows
   *  blown out flat from the crater (cream crests, periwinkle bellies), a crown of grains splashed
   *  up, and a ring of gold sparks skimming out over the snow, which blooms. Nothing hangs over the
   *  rider. */
  perfect(pos: Vector3, vel: Vector3, strength = 1): void {
    const fall = Math.max(vel.y, -Math.hypot(vel.x, vel.z) * 0.7);
    const car = tmpC.set(vel.x * 0.84, fall * 0.84, vel.z * 0.84);
    // Thrown back toward the lens is thrown uphill: it climbs with the slope (about 0.3) or sinks into it.
    const f = this.forward(vel);
    const up = (dx: number, dz: number, out: number) => 0.32 * out * Math.max(0, -(dx * f.x + dz * f.z));
    // A stomp streak (strength up to 2, from the streak count) throws more of everything, a little
    // further out, to match its wider crater; the budget still scales every count.
    const st = Math.max(1, Math.min(2, strength));
    const reach = 1 + 0.18 * (st - 1);
    // The burst: billows thrown out all round from the crater's lip, low and flat, swelling as they
    // slow. Fewer and smaller than the crater ring could hold: the ones crossing the rider's outline
    // shrink further (the powder shader), so the stomp never buries the rider.
    const nb = this.n(20 * st);
    for (let i = 0; i < nb; i++) {
      const a = (i / Math.max(1, nb)) * Math.PI * 2 + Math.random() * 0.25;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const out = (4.2 + Math.random() * 2.8) * reach;
      this.powder.emit(
        pos.x + dx * 1.2,
        pos.y + 0.1,
        pos.z + dz * 1.2,
        car.x + dx * out,
        car.y + 0.7 + Math.random() * 0.9 + up(dx, dz, out),
        car.z + dz * out,
        0.4 + Math.random() * 0.22,
        0.18 + Math.random() * 0.05,
        0.42 + Math.random() * 0.26,
        POWDER,
        POWDER,
        POWDER,
        0.92,
        3,
        3.6,
        puffKind(),
        car,
      );
    }
    // The crown: grains splashed up and out all round the sled, backlit by the low sun.
    const crown = this.n(44 * st);
    for (let i = 0; i < crown; i++) {
      const a = (i / Math.max(1, crown)) * Math.PI * 2 + Math.random() * 0.3;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const out = (2.4 + Math.random() * 2.6) * reach;
      this.powder.emit(
        pos.x + dx * 0.6,
        pos.y + 0.08,
        pos.z + dz * 0.6,
        car.x + dx * out,
        car.y + 2.4 + Math.random() * 2.4 + up(dx, dz, out),
        car.z + dz * out,
        0.45 + Math.random() * 0.3,
        0.035,
        0.06 + Math.random() * 0.05,
        POWDER,
        POWDER,
        POWDER,
        0.8 + Math.random() * 0.2,
        9,
        1.6,
        KIND_GRAIN,
        car,
      );
    }
    // A few gold sparks skimming out over the snow and dying in about a third of a second, about a
    // third as many as before and never lifted off it: a ring of star sprites salted the sky, the
    // ghosts and the crater, and the hit lost its focus. None are thrown back at the lens, where even
    // a low spark climbs the frame. Hot enough to bloom (a few gold-white among them).
    const ns = this.n(11 * st);
    for (let i = 0; i < ns; i++) {
      const a = (i / Math.max(1, ns)) * Math.PI * 2 + Math.random() * 0.2;
      let dx = Math.cos(a);
      let dz = Math.sin(a);
      const back = -(dx * f.x + dz * f.z);
      if (back > 0.35) {
        // Swing it out to the side instead.
        dx += f.x * (back + 0.2);
        dz += f.z * (back + 0.2);
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
      }
      const out = (4.6 + Math.random() * 2.0) * reach;
      const c = i % 4 === 0 ? WHITE : GOLD;
      const hot = 1.35;
      this.glow.emit(
        pos.x + dx * 0.9,
        pos.y + 0.08,
        pos.z + dz * 0.9,
        car.x + dx * out,
        car.y + 0.15 + Math.random() * 0.3 + up(dx, dz, out),
        car.z + dz * out,
        0.28 + Math.random() * 0.16,
        0.2,
        0.06,
        c.r * hot,
        c.g * hot,
        c.b * hot,
        1,
        6,
        3,
        KIND_GRAIN,
        car,
      );
    }
  }

  /** Additive sparkles (a gift pickup, a boost, a drift tier, a ghost's poof): a brief, compact burst
   *  of glinting motes thrown out low round `pos`, which arc back down onto the snow within about half
   *  a second. With a `carrier` (the sled's velocity) the burst rides along beside the rider instead
   *  of hanging where it was thrown while the lens races past it: a pickup burst left in the air at the
   *  gift rose up the frame as the camera passed under it, a column of stars in open sky. `lift`
   *  scales how high it is thrown (a spirit's poof rises a little more than a pickup). */
  sparkle(pos: Vector3, color: Color, count: number, speed = 2.6, life = 0.45, size = 0.2, carrier: Vector3 | null = null, lift = 0.35): void {
    const n = this.n(count);
    const cx = carrier ? carrier.x * 0.9 : 0;
    const cy = carrier ? Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * 0.9 : 0;
    const cz = carrier ? carrier.z * 0.9 : 0;
    const car = carrier ? tmpC.set(cx, cy, cz) : null;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.45 + Math.random() * 0.75);
      this.glow.emit(
        pos.x,
        pos.y,
        pos.z,
        cx + Math.cos(a) * s,
        cy + speed * lift * (0.35 + Math.random() * 0.65),
        cz + Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.7),
        size,
        size * 0.25,
        color.r,
        color.g,
        color.b,
        1,
        7,
        3.2,
        KIND_GRAIN,
        car,
      );
    }
  }

  /** A ring of glinting motes thrown out flat over the snow round `pos` (a tier-3 drift release, a
   *  ghost's stomp): evenly round, skimming low and gone in about half a second (decision 67). With a
   *  `carrier` it rides along with the sled. Every `whiteEvery`th mote is snow-white; `hot` lifts the
   *  colour past the bloom threshold; `cap` limits the count after the budget (a ghost's ring on Low). */
  ring(pos: Vector3, color: Color, count: number, speed: number, carrier: Vector3 | null, whiteEvery = 0, hot = 1.35, life = 0.42, size = 0.18, cap = Infinity): void {
    const n = Math.min(cap, this.n(count));
    const cx = carrier ? carrier.x * 0.9 : 0;
    const cy = carrier ? Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * 0.9 : 0;
    const cz = carrier ? carrier.z * 0.9 : 0;
    const car = carrier ? tmpC.set(cx, cy, cz) : null;
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / Math.max(1, n)) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const s = speed * (0.85 + Math.random() * 0.3);
      const c = whiteEvery > 0 && i % whiteEvery === whiteEvery - 1 ? WHITE : color;
      this.glow.emit(
        pos.x + dx * 0.5,
        pos.y + 0.08,
        pos.z + dz * 0.5,
        cx + dx * s,
        cy + 0.15 + Math.random() * 0.35,
        cz + dz * s,
        life * (0.75 + Math.random() * 0.5),
        size,
        size * 0.3,
        c.r * hot,
        c.g * hot,
        c.b * hot,
        1,
        5,
        2.6,
        KIND_GRAIN,
        car,
      );
    }
  }

  /** Snow shaken off a tree's boughs as you shave past it (a near miss): grains and soft clumps
   *  dropping from its lower boughs, 1.4 to 3.2 m up, on the side facing you (`pos` is the canopy's
   *  near edge on the snow and `out` the level direction from the tree toward you), swept out toward
   *  your line by the wind of your passing and dragged along in your wake. The tree is already a couple
   *  of metres behind the sled when the beat lands (and dissolving before the lens), so the snow keeps
   *  nearly the sled's speed: it hangs beside the rider, at the frame's side, as it falls. */
  boughs(pos: Vector3, out: Vector3, carrier: Vector3, count = 16): void {
    const n = this.n(count);
    const car = tmpC.set(carrier.x * 0.95, Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * 0.95, carrier.z * 0.95);
    const tx = -out.z;
    const tz = out.x;
    for (let i = 0; i < n; i++) {
      const r = i % 10;
      // Six in ten are grains, three soft clumps and one a faint veil.
      const kind = r < 6 ? KIND_GRAIN : r < 9 ? puffKind() : KIND_MIST;
      const along = (Math.random() - 0.5) * 1.6;
      const o = Math.random() * 0.5;
      const push = 0.8 + Math.random() * 1.6;
      const grain = kind === KIND_GRAIN;
      this.powder.emit(
        pos.x + out.x * o + tx * along,
        pos.y + 1.4 + Math.random() * 1.8,
        pos.z + out.z * o + tz * along,
        car.x + out.x * push + tx * along * 0.4,
        car.y - 0.4 + Math.random() * 0.9,
        car.z + out.z * push + tz * along * 0.4,
        grain ? 0.7 + Math.random() * 0.35 : 0.8 + Math.random() * 0.4,
        grain ? 0.045 : kind === KIND_MIST ? 0.3 : 0.12,
        grain ? 0.07 + Math.random() * 0.04 : kind === KIND_MIST ? 0.9 : 0.3 + Math.random() * 0.18,
        POWDER,
        POWDER,
        POWDER,
        grain ? 0.85 : kind === KIND_MIST ? 0.2 : 0.75,
        grain ? 5 : 2.4,
        1.2,
        kind,
        car,
      );
    }
  }

  /** Grit knocked off a hazard's foot as you shave past it (a near miss): dark slate chips (`ice`:
   *  pale shards) and snow thrown out toward your line, low and quick. `pos` is the hazard's near edge
   *  on the snow, `out` the level direction from it toward you. */
  grit(pos: Vector3, out: Vector3, carrier: Vector3, ice: boolean, count = 8): void {
    const n = this.n(count);
    // (Swept along in your wake at nearly the sled's speed, like the bough snow, so it reads in frame.)
    const car = tmpC.set(carrier.x * 0.9, Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * 0.9, carrier.z * 0.9);
    const chipC = ice ? SHARD : SLATE;
    for (let i = 0; i < n; i++) {
      const chip = i % 2 === 0;
      const s = 1.5 + Math.random() * 2.2;
      const j = (Math.random() - 0.5) * 1.4;
      const c = chip ? chipC : WHITE;
      this.powder.emit(
        pos.x + out.x * 0.2 + (Math.random() - 0.5) * 0.4,
        pos.y + 0.1 + Math.random() * 0.4,
        pos.z + out.z * 0.2 + (Math.random() - 0.5) * 0.4,
        car.x + out.x * s - out.z * j,
        car.y + 1.2 + Math.random() * 1.6,
        car.z + out.z * s + out.x * j,
        0.35 + Math.random() * 0.25,
        chip ? 0.04 : 0.035,
        chip ? 0.06 : 0.07,
        chip ? c.r : POWDER,
        chip ? c.g : POWDER,
        chip ? c.b : POWDER,
        chip ? 0.95 : 0.8,
        9,
        1.5,
        KIND_GRAIN,
        car,
      );
    }
  }

  /** Motes streaming off the scarf, strung between two points on it (`a`, `b`). `glow`: vermillion
   *  embers in the additive layer (going into the flow); otherwise a cold puff of periwinkle-grey
   *  powder (the flow snuffed out). They ride with the sled a moment and fall behind. */
  scarf(a: Vector3, b: Vector3, color: Color, count: number, carrier: Vector3, glow: boolean): void {
    const n = this.n(count);
    const ck = glow ? 0.9 : 0.85;
    const car = tmpC.set(carrier.x * ck, Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * ck, carrier.z * ck);
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t;
      if (glow) {
        this.glow.emit(x, y, z, car.x + (Math.random() - 0.5) * 2.2, car.y + 0.3 + Math.random() * 0.8, car.z + (Math.random() - 0.5) * 2.2, 0.45 + Math.random() * 0.35, 0.2, 0.05, color.r * 1.8, color.g * 1.8, color.b * 1.8, 1, 2.2, 2.5, KIND_GRAIN, car);
      } else {
        this.powder.emit(x, y, z, car.x + (Math.random() - 0.5) * 1.6, car.y + 0.3 + Math.random() * 0.6, car.z + (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.3, 0.1, 0.26 + Math.random() * 0.1, color.r, color.g, color.b, 0.8, 0.6, 2, puffKind(), car);
      }
    }
  }

  /** Glinting motes strung along a line on the snow from `a` to `b` (crossing your best distance),
   *  skimming low and carried along with the sled (decision 67). */
  line(a: Vector3, b: Vector3, color: Color, count: number, carrier: Vector3, hot = 1.3): void {
    const n = this.n(count);
    const car = tmpC.set(carrier.x * 0.9, Math.max(carrier.y, -Math.hypot(carrier.x, carrier.z) * 0.7) * 0.9, carrier.z * 0.9);
    for (let i = 0; i < n; i++) {
      const t = (i + Math.random()) / Math.max(1, n);
      this.glow.emit(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t + 0.1,
        a.z + (b.z - a.z) * t,
        car.x + (Math.random() - 0.5) * 1.2,
        car.y + 0.25 + Math.random() * 0.6,
        car.z + (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 0.4,
        0.2,
        0.05,
        color.r * hot,
        color.g * hot,
        color.b * hot,
        1,
        4,
        2.2,
        KIND_GRAIN,
        car,
      );
    }
  }

  /** Powder and debris from an avalanche blasting past the camera from behind, as crisp flecks
   *  streaking along the frame edges (kept out of a cone around the lens, where it would read as
   *  bokeh): sunlit powder grains with a few dark slate chips of debris among them. No soft mist:
   *  big faint puffs this close to the lens read as smudges on it. */
  rush(cam: Vector3, dir: Vector3, speed: number, intensity: number, climb = 0): void {
    const n = this.n(12 * intensity);
    for (let i = 0; i < n; i++) {
      const side = (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 6.5);
      // Low along the snow, where the bank rolls in: up in the sky they read as specks on the lens. Out
      // at the frame's sides a few ride higher, spindrift whipping past the lens from behind.
      const up = -2.2 + Math.random() * (Math.abs(side) > 5 ? 3.0 : 2.0);
      const back = Math.random() * 3;
      const chip = i % 4 === 0;
      this.powder.emit(
        cam.x - dir.x * back + dir.z * side,
        cam.y + up,
        cam.z - dir.z * back - dir.x * side,
        dir.x * (speed + 20) + (Math.random() - 0.5) * 3,
        // Skimming down the slope past the lens (`climb` is the ground's rise per metre along dir):
        // flying level, the slope fell away under them and they ended up in the sky as specks on the lens.
        // Fast enough relative to the lens that each one smears into a short streak of spindrift.
        climb * (speed + 20) - 0.4 + Math.random() * 0.8,
        dir.z * (speed + 20) + (Math.random() - 0.5) * 3,
        0.5 + Math.random() * 0.5,
        0.05,
        0.1 + Math.random() * 0.08,
        chip ? 0.3 : 1.05,
        chip ? 0.34 : 1.05,
        chip ? 0.5 : 1.08,
        (chip ? 0.95 : 0.8) * Math.min(1, intensity),
        0,
        0.5,
        KIND_GRAIN,
      );
    }
  }

  /** Vent steam: low, faint, slowly rising wisps that telegraph the vent without hiding anything. */
  steam(pos: Vector3, strength: number): void {
    this.steamAt(pos.x, pos.y, pos.z, strength);
  }

  steamAt(x: number, y: number, z: number, strength: number): void {
    const n = this.n(2 * strength);
    for (let i = 0; i < n; i++) {
      this.powder.emit(
        x + (Math.random() - 0.5) * 1.4,
        y + 0.15,
        z + (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 0.5,
        0.6 + Math.random() * (0.5 + 0.5 * strength),
        (Math.random() - 0.5) * 0.5,
        1.1 + Math.random() * 0.8,
        0.3,
        1.3,
        1,
        0.97,
        0.96,
        0.08 + 0.02 * Math.min(4, strength),
        -0.4,
        0.9,
        KIND_STEAM,
      );
    }
  }
}

/** Camera-following weather volume animated entirely in the vertex shader. The volume sits mostly
 *  ahead of the lens (wrapping in world space, so flakes never swim when the camera turns). */
export class Weather {
  readonly points: Points;
  private mat: ShaderMaterial;
  private lastCam = new Vector3();
  private lastT = -1;
  private tmp = new Vector3();

  constructor(count: number) {
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random();
      pos[i * 3 + 1] = Math.random();
      pos[i * 3 + 2] = Math.random();
      seed[i] = Math.random();
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: shared.uTime,
        uCam: { value: new Vector3() },
        uCamVel: { value: camVel },
        uBox: { value: new Vector3(60, 34, 70) },
        uFall: { value: new Vector3(0.6, -2.2, 1.0) },
        uSize: { value: 0.12 },
        uStreak: { value: 0 },
        uColor: { value: new Color(1, 1, 1) },
        uFog: shared.uFog,
        uAlpha: { value: 0.8 },
        uScale: { value: 600 },
        uDensity: { value: 1 },
        uKind: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uCamVel;
        uniform vec3 uBox;
        uniform vec3 uFall;
        uniform float uSize;
        uniform float uScale;
        uniform float uDensity;
        uniform float uKind;
        uniform float uStreak;
        varying float vAlpha;
        varying float vSeed;
        varying vec2 vAxis;
        varying float vRatio;
        varying float vFar;
        void main() {
          vSeed = aSeed;
          // Blizzard streaks come in three layers: heavy fast flakes, a mid layer and fine slow ones.
          float layer = uStreak > 0.0 ? (aSeed < 0.3 ? 0.0 : aSeed < 0.65 ? 1.0 : 2.0) : 1.0;
          // And a few big, fast flakes whipping past close to the lens, in a small box just ahead of
          // it, so the storm still reads at thumbnail size (small, the frame read as plain grey fog).
          float nearL = uStreak > 0.0 && aSeed < 0.03 ? 1.0 : 0.0;
          float speed = (0.7 + aSeed * 0.6) * (uStreak > 0.0 ? 1.3 - layer * 0.25 : 1.0) * (1.0 + 0.7 * nearL);
          vec3 drift = uFall * uTime * speed;
          drift.x += sin(uTime * (0.6 + aSeed) + aSeed * 30.0) * (uKind > 1.5 ? 2.5 : 0.8);
          // The box is centred ahead of the lens, so almost every flake is in view.
          vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
          vec3 box = mix(uBox, vec3(9.0, 6.0, 9.0), nearL);
          vec3 centre = uCam + vec3(fwd.x, fwd.y * 0.3, fwd.z) * mix(uBox.z * 0.3, 5.5, nearL);
          vec3 p = position * box + drift - centre;
          p = mod(p, box) - box * 0.5;
          vec3 wp = centre + p;
          vec4 mv = modelViewMatrix * vec4(wp, 1.0);
          float depth = -mv.z;
          float keep = step(aSeed, uDensity);
          // Nothing near the lens grows into an out-of-focus blob (it reads as a smudge on the lens):
          // flakes fade in from 2.5 m and never draw bigger than about 9 px at 720p (petals, embers
          // and wisps a little bigger).
          vAlpha = keep * smoothstep(mix(2.5, 1.4, nearL), mix(6.0, 2.6, nearL), depth) * (1.0 - smoothstep(uBox.z * 0.55, uBox.z * 0.78, depth));
          float size = keep * min(uSize * uScale / max(depth, 0.5), uScale * (uKind < 0.5 ? 0.0125 : 0.022));
          vAxis = vec2(1.0, 0.0);
          vRatio = 1.0;
          vFar = layer * 0.5;
          if (uStreak > 0.0 && keep > 0.0) {
            // Sideways motion streaks: the wind plus a little of the camera's own travel, 8 to 20 px
            // long (at 720p), thinner and fainter in the far layer and faint right by the lens.
            vec3 rel = uFall * speed - uCamVel * 0.12;
            vec4 c0 = projectionMatrix * mv;
            vec4 c1 = projectionMatrix * modelViewMatrix * vec4(wp + rel * 0.05, 1.0);
            float px720 = uScale / 720.0;
            vec2 dpx = vec2(1.0, 0.0);
            if (c0.w > 0.1 && c1.w > 0.1) dpx = (c1.xy / c1.w - c0.xy / c0.w) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0) * uScale * 0.5;
            float len = length(dpx);
            vAxis = len > 0.001 ? vec2(dpx.x, -dpx.y) / len : vec2(1.0, 0.0);
            float lmax = mix(mix(20.0, 11.0, layer * 0.5), 48.0, nearL) * px720;
            float lmin = mix(mix(12.0, 8.0, layer * 0.5), 30.0, nearL) * px720;
            float l = clamp(len, lmin, lmax);
            float thick = mix(mix(2.2, 1.1, layer * 0.5) * clamp(28.0 / max(depth, 1.0), 0.6, 1.4), 4.2, nearL) * px720;
            vRatio = clamp(thick / l, 0.05, 1.0);
            size = l;
            vAlpha *= mix(mix(0.95, 0.6, layer * 0.5) * mix(0.25, 1.0, smoothstep(2.5, 12.0, depth)), 0.85, nearL);
            vFar = mix(vFar, 0.0, nearL);
          }
          gl_PointSize = size;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uFog;
        uniform float uAlpha;
        uniform float uStreak;
        uniform float uKind;
        varying float vAlpha;
        varying float vSeed;
        varying vec2 vAxis;
        varying float vRatio;
        varying float vFar;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a;
          vec3 col = uColor;
          if (uStreak > 0.0) {
            // A tapered streak along the motion axis, its head a little brighter than its tail.
            vec2 q = vec2(dot(c, vAxis), dot(c, vec2(-vAxis.y, vAxis.x)) / vRatio) * 2.0;
            a = smoothstep(1.0, 0.2, abs(q.x)) * smoothstep(1.0, 0.25, abs(q.y)) * (0.75 + 0.25 * q.x) * vAlpha * uAlpha;
            // Never darker than the fog behind it: far streaks lean toward the fog, near ones are white.
            col = max(mix(uColor, uFog, vFar * 0.45), uFog * 1.04);
          } else {
            // Petals are little ovals.
            if (uKind > 0.5 && uKind < 1.5) c.y *= 1.8;
            float d = length(c) * 2.0;
            a = smoothstep(1.0, 0.6, d) * vAlpha * uAlpha;
            if (uKind > 2.5) col *= 0.8 + 0.4 * vSeed;
          }
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  /** kind: 0 snow, 1 petals, 2 embers, 3 wisps. */
  configure(opts: { density: number; kind: number; color: Color; streak: number; size: number; alpha: number; fall: Vector3; additive: boolean }): void {
    const u = this.mat.uniforms;
    u.uDensity.value = opts.density;
    u.uKind.value = opts.kind;
    u.uColor.value.copy(opts.color);
    u.uStreak.value = opts.streak;
    u.uSize.value = opts.size;
    u.uAlpha.value = opts.alpha;
    u.uFall.value.copy(opts.fall);
    this.mat.blending = opts.additive ? AdditiveBlending : NormalBlending;
    this.mat.needsUpdate = true;
    this.points.visible = opts.density > 0.001;
  }

  setScale(px: number): void {
    this.mat.uniforms.uScale.value = px;
  }

  /** Called once per frame with the camera position; also tracks the camera's velocity, which
   *  the powder and the blizzard streaks use to stretch along their motion through the lens. */
  follow(cam: Vector3): void {
    this.mat.uniforms.uCam.value.copy(cam);
    const t = shared.uTime.value;
    const dt = t - this.lastT;
    if (this.lastT < 0 || dt > 0.25 || dt < 0) camVel.set(0, 0, 0);
    else if (dt > 1e-4) {
      this.tmp.subVectors(cam, this.lastCam).divideScalar(dt);
      // Camera cuts (revive, results) would read as a huge velocity for a frame.
      if (this.tmp.lengthSq() > 80 * 80) this.tmp.setLength(80);
      camVel.lerp(this.tmp, 0.5);
    }
    if (dt !== 0 || this.lastT < 0) {
      this.lastCam.copy(cam);
      this.lastT = t;
    }
  }
}
