import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  RGBFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedInt101111Type,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { shared } from './materials';

// A small custom post stack (ART.md section 9): bloom via a downsample/upsample mip chain, then one
// composite pass for colour grade, vignette, speed streaks, chromatic punch, grain and dither.
// Low tier skips all of it and renders straight to the screen.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function fullscreenTriangle(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}

export interface GradeParams {
  lift: Color;
  gain: Color;
  saturation: number;
  contrast: number;
  bloom: number;
  /** Film grain strength for this mood (night moods run lighter: grain reads as noise in the dark). */
  grain?: number;
  /** How much the bottom edge of the frame darkens and cools, so the foreground snow keeps form. */
  foot?: number;
  /** Light shafts from a low sun in view (0 for none: night, overcast and high-sun moods). */
  shafts?: number;
}

const sunProbe = new Vector3();

export class PostFX {
  private sceneRT: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private quad: Mesh;
  private qScene = new Scene();
  private qCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private prefilter: ShaderMaterial;
  private down: ShaderMaterial;
  private up: ShaderMaterial;
  private composite: ShaderMaterial;
  private inset: ShaderMaterial;
  private insetRT: WebGLRenderTarget | null = null;
  private screen = new Vector2();
  private levels: number;
  private moodGrain = 1;
  private moodBloom = 0.55;
  private moodFoot = 0;
  private moodShafts = 0;
  /** Taps per pixel for the light shafts: 10 on High, 6 on Medium (Low has no post pass at all). */
  shaftTaps: number;
  enabled = true;
  bloomEnabled = true;
  /** bloomScale tames the bloom (portrait run, results hero shot); feetY is the sled's height on screen and vpX, vpY the
   *  course's vanishing point (uv, origin bottom left), for the avalanche. */
  readonly params = { speed: 0, punch: 0, flash: 0, vignette: 1, grain: 1, time: 0, danger: 0, riderX: 0.5, riderY: 0.4, feetY: 0.3, vpX: 0.5, vpY: 0.75, bloomScale: 1, streakFoot: 0.12, footScale: 1 };

  constructor(
    private renderer: WebGLRenderer,
    w: number,
    h: number,
    private msaa: number,
    levels = 5,
  ) {
    this.levels = levels;
    this.shaftTaps = levels >= 5 ? 10 : 6;
    const type = renderer.capabilities.isWebGL2 ? HalfFloatType : UnsignedByteType;
    // The HDR scene buffer is R11G11B10F where float colour buffers are renderable: half the bytes
    // per (MSAA) sample of RGBA16F, which matters on integrated GPUs, and nothing reads its alpha.
    const packed = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    // Contract C10: a combined depth-stencil buffer (the rider masks the ghosts). Nothing reads depth or
    // stencil after the scene pass, so the MSAA resolve copies colour only: a stencil resolve is slow
    // on D3D, and the depth one was never needed.
    this.sceneRT = new WebGLRenderTarget(w, h, {
      type: packed ? UnsignedInt101111Type : type,
      format: packed ? RGBFormat : RGBAFormat,
      samples: msaa,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      stencilBuffer: true,
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
    });
    this.quad = new Mesh(fullscreenTriangle());
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.prefilter = new ShaderMaterial({
      vertexShader: VERT,
      // Lit snow tops out around 0.9 in every mood (materials.ts holds it there), so with this
      // threshold and knee only the sun, the comet, gifts, glows, ghosts and sparkle glints bloom:
      // a broad glow over a bright foreground is what turns warm snow milky.
      uniforms: { tSrc: { value: null }, uThreshold: { value: 1.1 }, uTexel: { value: new Vector2() } },
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc;
        uniform float uThreshold;
        uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
                 + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
          c *= 0.25;
          float l = max(c.r, max(c.g, c.b));
          float k = smoothstep(uThreshold, uThreshold + 0.6, l);
          gl_FragColor = vec4(min(c * k, vec3(3.0)), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.down = new ShaderMaterial({
      vertexShader: VERT,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } },
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc;
        uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
          gl_FragColor = vec4(c / 8.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.up = new ShaderMaterial({
      vertexShader: VERT,
      uniforms: { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new Vector2() } },
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc;
        uniform sampler2D tBase;
        uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          vec3 c = vec3(0.0);
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
          c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb * 2.0;
          c += texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
          c += texture2D(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb * 2.0;
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
          c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
          gl_FragColor = vec4(c / 12.0 * 0.7 + texture2D(tBase, vUv).rgb, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.composite = new ShaderMaterial({
      vertexShader: VERT,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0.55 },
        uLift: { value: new Color(0, 0, 0) },
        uGain: { value: new Color(1, 1, 1) },
        uSat: { value: 1 },
        uContrast: { value: 1 },
        uSpeed: { value: 0 },
        uPunch: { value: 0 },
        uFlash: { value: 0 },
        uVignette: { value: 1 },
        uGrain: { value: 1 },
        uFoot: { value: 0 },
        uTime: { value: 0 },
        uDanger: { value: 0 },
        uRider: { value: new Vector2(0.5, 0.4) },
        uFeet: { value: 0.3 },
        uVp: { value: new Vector2(0.5, 0.75) },
        uStreakFoot: { value: 0.12 },
        uAspect: { value: 1 },
        uUseBloom: { value: 1 },
        uFxaa: { value: msaa > 0 ? 0 : 1 },
        uTexel: { value: new Vector2(1, 1) },
        // The mood's own snow and sun, shared by reference: the avalanche bank is lit like its powder.
        uPowLit: shared.uSnowLit,
        uPowShade: shared.uSnowShade,
        uPowDeep: shared.uSnowDeep,
        uSunUv: { value: new Vector2(0.5, 0.8) },
        uShaft: { value: 0 },
        uShaftTaps: { value: 8 },
        uShaftColor: shared.uSunColor,
      },
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float uFxaa;
        uniform vec2 uTexel;
        uniform float uBloom;
        uniform vec3 uLift;
        uniform vec3 uGain;
        uniform float uSat;
        uniform float uContrast;
        uniform float uSpeed;
        uniform float uPunch;
        uniform float uFlash;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uFoot;
        uniform float uTime;
        uniform float uDanger;
        uniform vec2 uRider;
        uniform float uFeet;
        uniform vec2 uVp;
        uniform float uStreakFoot;
        uniform float uAspect;
        uniform float uUseBloom;
        uniform vec3 uPowLit;
        uniform vec3 uPowShade;
        uniform vec3 uPowDeep;
        uniform vec2 uSunUv;
        uniform float uShaft;
        uniform float uShaftTaps;
        uniform vec3 uShaftColor;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        // A lattice hash without sin: the sine hash amplifies a one-ulp difference between two
        // evaluations of the same corner into a different value, which tore value noise into blocks.
        float hashL(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hashL(i), hashL(i + vec2(1.0, 0.0)), f.x), mix(hashL(i + vec2(0.0, 1.0)), hashL(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        // Three octaves of value noise: the avalanche's powder.
        float fbm3(vec2 p) {
          return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 - 3.7) * 0.15;
        }
        // One row of round billows along x (frame heights), their tops reaching about top, rolling
        // sideways by drift and bobbing: the signed distance to the row's outline (negative inside),
        // and the sphere normal of the billow this point belongs to. Below its centre a billow runs
        // straight down into the body of the bank. Three fixed taps, no texture reads.
        float billowRow(vec2 q, float top, float R, float drift, float salt, out vec3 nrm) {
          float x = q.x + drift;
          float pitch = R * 1.5;
          float cell = floor(x / pitch);
          float best = 1e3;
          nrm = vec3(0.0, -0.3, 0.95);
          for (int k = -1; k <= 1; k++) {
            float c = cell + float(k);
            float h = hashL(vec2(c, salt));
            float r = R * (0.65 + 0.7 * h);
            float bob = sin(uTime * (1.0 + h) + h * 40.0) * R * 0.14;
            vec2 ctr = vec2((c + 0.5 + (h - 0.5) * 0.4) * pitch, top * (0.68 + 0.32 * hashL(vec2(c, salt + 2.9))) - r + bob);
            vec2 d = vec2(x, q.y) - ctr;
            float dc = length(d) - r;
            float sd = d.y < 0.0 ? min(dc, abs(d.x) - r) : dc;
            if (sd < best) {
              best = sd;
              nrm = vec3(d / r, sqrt(max(1.0 - dot(d, d) / (r * r), 0.0)));
            }
          }
          return best;
        }
        float lumaP(vec3 c) { return sqrt(dot(min(c, vec3(1.0)), vec3(0.299, 0.587, 0.114))); }
        // FXAA (the compact console variant) for a scene rendered without MSAA (Medium, most phones):
        // five taps find an edge in perceptual luma, and only edge pixels take four more along it, so
        // the stair-steps on the rider, scarf, runners and tree edges smooth out for a fraction of a
        // millisecond. It reads the linear HDR scene before bloom and grade.
        vec3 fxaa(vec2 uv) {
          vec3 rgbM = texture2D(tScene, uv).rgb;
          float lNW = lumaP(texture2D(tScene, uv + vec2(-1.0, -1.0) * uTexel).rgb);
          float lNE = lumaP(texture2D(tScene, uv + vec2(1.0, -1.0) * uTexel).rgb);
          float lSW = lumaP(texture2D(tScene, uv + vec2(-1.0, 1.0) * uTexel).rgb);
          float lSE = lumaP(texture2D(tScene, uv + vec2(1.0, 1.0) * uTexel).rgb);
          float lM = lumaP(rgbM);
          float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
          float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
          if (lMax - lMin < max(0.04, lMax * 0.12)) return rgbM;
          vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
          float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
          dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-8.0), vec2(8.0)) * uTexel;
          vec3 a = 0.5 * (texture2D(tScene, uv - dir / 6.0).rgb + texture2D(tScene, uv + dir / 6.0).rgb);
          vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
          float lB = lumaP(b);
          return (lB < lMin || lB > lMax) ? a : b;
        }
        void main() {
          vec2 uv = vUv;
          vec2 dc = uv - 0.5;
          float r = length(dc * vec2(uAspect, 1.0));
          // Speed streaks: a short radial smear that only touches the edges of the frame, strongest at
          // the sides and all but gone across the bottom, where it smeared the foreground snow's sparkle
          // and ripples into one pale sheet of radial lines (worst on a tall phone screen).
          vec3 col;
          float streak = uSpeed * smoothstep(0.3, 0.8, r) * mix(uStreakFoot, 1.0, smoothstep(0.25, 0.6, uv.y)) * mix(0.5, 1.0, smoothstep(0.12, 0.45, abs(dc.x) * uAspect));
          if (streak > 0.002) {
            vec3 acc = vec3(0.0);
            for (int i = 0; i < 6; i++) {
              float k = float(i) / 5.0;
              acc += texture2D(tScene, uv - dc * k * streak * 0.07).rgb;
            }
            col = acc / 6.0;
          } else if (uFxaa > 0.5) {
            col = fxaa(uv);
          } else {
            col = texture2D(tScene, uv).rgb;
          }
          // Chromatic punch on boosts and perfect landings.
          if (uPunch > 0.01) {
            vec2 off = dc * 0.0035 * uPunch;
            col.r = mix(col.r, texture2D(tScene, uv + off).r, 0.85);
            col.b = mix(col.b, texture2D(tScene, uv - off).b, 0.85);
          }
          if (uUseBloom > 0.5) col += texture2D(tBloom, uv).rgb * uBloom;
          // Light shafts: while a low sun is in view, warm rays fan out from it through the gaps in the
          // treeline and the ridges. Each pixel near the sun looks back along the line to it for bright
          // sky; what stands in the way (a trunk, a crest) leaves a cool gap between the rays. Taps
          // crowd toward the sun, where the light is, and the rays never fall over the rider.
          if (uShaft > 0.001) {
            vec2 toS = uSunUv - uv;
            float dS = length(toS * vec2(uAspect, 1.0));
            if (dS < 0.62) {
              float j = hash(gl_FragCoord.xy);
              float acc = 0.0;
              for (int i = 0; i < 10; i++) {
                if (float(i) >= uShaftTaps) break;
                float f = (float(i) + j) / uShaftTaps;
                vec3 s = texture2D(tScene, uSunUv - toS * (f * f * 0.92)).rgb;
                acc += smoothstep(0.55, 1.5, dot(s, vec3(0.2126, 0.7152, 0.0722)));
              }
              acc /= uShaftTaps;
              float ang = atan(toS.y, toS.x * uAspect);
              float rays = 0.45 + 0.55 * vnoise(vec2(ang * 11.0, 1.7)) * vnoise(vec2(ang * 23.0 + 4.0, 3.1));
              float fall = exp(-dS * 3.4) * (1.0 - smoothstep(0.42, 0.62, dS));
              vec2 rq = (uv - uRider + vec2(0.0, 0.06)) * vec2(uAspect, 0.62);
              float clearRider = smoothstep(0.09, 0.17, length(rq));
              vec3 warm = mix(uShaftColor, vec3(1.0, 0.7, 0.4), 0.5);
              col += warm * acc * rays * fall * clearRider * uShaft * 0.3;
            }
          }
          // Grade: lift / gain, saturation, contrast around mid grey.
          col = col * uGain + uLift * (1.0 - col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          col = (col - 0.18) * uContrast + 0.18;
          // Soft tone curve so highlights roll off instead of clipping.
          col = col / (1.0 + max(col - 0.85, 0.0) * 0.6);
          col += uFlash * 0.35;
          float vig = smoothstep(1.05, 0.35, r);
          col *= mix(1.0, vig, 0.38 * uVignette);
          // A cool darkening toward the bottom edge (deepest in day moods), so the bright snow under the
          // lens keeps its sparkle and ripples instead of flattening into one cream value, and the
          // lower frame holds a value frame round the rider.
          // It leans to the mood's own periwinkle shade, not grey: darkened warm cream read as flat grey.
          float foot = 1.0 - smoothstep(0.0, 0.46, uv.y);
          vec3 coolTint = mix(vec3(0.56, 0.64, 0.9), uPowShade / max(uPowLit, vec3(0.05)), 0.25);
          col *= mix(vec3(1.0), coolTint, min(1.0, uFoot * foot * foot * 2.4));
          if (uDanger > 0.001) {
            // Avalanche, building from about 60 m, drawn as something in the world chasing you rather
            // than a frame round the picture: its cold shadow races up the lower snow ahead of it,
            // cooling and greying it; a soft-edged, layered haze of powder surges up from the bottom
            // edge across the whole width, streaming in toward the vanishing point as it overtakes the
            // lens; dark broken chunks of snow and ice tumble past at the frame's sides and spindrift
            // streaks by. Its crest never rises past the rider's feet and the sky keeps its colour, so
            // the frame keeps its value anchor (DECISIONS 41). Under about 20 m it heaves like a
            // heartbeat that quickens as it gains. A row of crisp billows with cream crest rims read as
            // a sticker border of cartoon clouds, and a flat dark haze as a vignette.
            float urgent = smoothstep(0.62, 0.82, uDanger);
            float beat = pow(0.5 + 0.5 * sin(uTime * mix(6.0, 10.5, urgent)), 3.0) * urgent;
            // Height units: x runs across the frame in multiples of its height.
            vec2 q = vec2(uv.x * uAspect, uv.y);
            // The highest the powder may reach: just under the sled.
            float cap = max(0.05, uFeet - 0.02);
            // A log-polar frame round the vanishing point: powder passing the lens streams in toward it,
            // its features shrinking with distance as they would in the world.
            vec2 dv = (uv - uVp) * vec2(uAspect, 1.0);
            float rv = max(length(dv), 0.03);
            float th = atan(dv.x, -dv.y);
            float lr = log(rv);
            // Keeps clear of the rider's outline.
            float clearR = smoothstep(0.1, 0.19, length((uv - uRider) * vec2(uAspect, 1.0)));
            // The cold shadow: the wall's own shade racing up the snow ahead of it, with a ragged edge.
            float shTop = mix(0.04, cap + 0.05, smoothstep(0.0, 0.8, uDanger)) * (1.0 + 0.3 * (vnoise(vec2(q.x * 2.6 - uTime * 0.6, uTime * 0.25)) - 0.5));
            float shK = (1.0 - smoothstep(shTop - 0.12, shTop + 0.05, uv.y)) * uDanger;
            float dl = dot(col, vec3(0.2126, 0.7152, 0.0722));
            col = mix(col, dl * vec3(0.76, 0.85, 1.08), shK * 0.6) * (1.0 - 0.3 * shK);
            // The rest of the lower frame cools a little and its sides darken slightly.
            float below = 1.0 - smoothstep(0.45, 0.85, uv.y);
            col = mix(col, dot(col, vec3(0.2126, 0.7152, 0.0722)) * vec3(0.84, 0.92, 1.08), uDanger * 0.16 * below);
            col *= 1.0 - uDanger * 0.2 * smoothstep(0.5, 1.1, r) * below;
            float top = min(mix(0.07, 0.3, smoothstep(0.0, 0.9, uDanger)) + beat * 0.02, cap);
            // Backlit by the low sun ahead, the face of the cloud the lens sees is in its own shade, a cool
            // grey-blue clearly darker than the lit snow; its upper billows lighten softly where thinning
            // powder lets the light through, a gradual glow and never an outline.
            vec3 crestC = mix(uPowShade, uPowLit, 0.55);
            vec3 bodyC = mix(uPowShade, uPowDeep, 0.45);
            bodyC = mix(bodyC, vec3(dot(bodyC, vec3(0.2126, 0.7152, 0.0722))), 0.3);
            if (uv.y < top * 1.6 + 0.08) {
              // The haze, in three layers from back to front: a tall, thin veil of powder thrown up ahead
              // of the wall, a bank of round billows rolling and surging in front of it, and a dense, dark
              // churn nearest the lens, with powder streaming in toward the vanishing point through all
              // three. Every edge is feathered and frayed by the streaming powder; nothing is outlined.
              float stream = fbm3(vec2(th * 8.0, lr * 6.0 + uTime * 2.6));
              float stream2 = vnoise(vec2(th * 14.0 + 3.1, lr * 10.0 + uTime * 3.6));
              // Nearer the frame's sides the bank stands a little taller: it is overtaking the lens there.
              float wrap = 1.0 + 0.35 * smoothstep(0.2, 0.5, abs(uv.x - 0.5));
              // A phone's narrow frame gets smaller billows, so the bank still spans it as a row of them
              // instead of two blobs in its bottom corners.
              float bw = mix(0.6, 1.0, smoothstep(0.6, 1.3, uAspect));
              float soft = 0.01 + 0.04 * top;
              float on = smoothstep(0.0, 0.2, uDanger);
              // The veil: big, slow billows feathered wide, paler where more light passes through them.
              vec3 nc;
              float topC = min(top * wrap * 1.25, cap);
              float sdC = billowRow(q, topC, (0.15 + 0.12 * top) * bw, uTime * 0.05 + 2.3, 5.3, nc) + (stream - 0.5) * (0.05 + 0.14 * top);
              float dC = smoothstep(soft * 2.0, -soft * 4.0, sdC);
              vec3 hazeC = mix(bodyC * 0.9, crestC * 0.85, 0.3 + 0.4 * smoothstep(-0.3, 0.9, nc.y));
              hazeC = hazeC * uGain + uLift * (1.0 - hazeC);
              col = mix(col, hazeC, dC * (0.4 + 0.2 * stream) * on);
              // The bank: the lens sees the billows' shaded faces, a cool grey-blue clearly darker than the
              // lit snow, deepest in the clefts between them and underneath. The low sun leaks through only
              // where a billow thins toward its top: a broad, soft glow over the outer part of its upper
              // half (sdA runs from 0 at its edge to minus its radius at its heart), never along the edge.
              float topA = min(top * wrap * (1.0 + 0.1 * sin(q.x * 3.1 - uTime * 2.4)), cap + 0.06 * (wrap - 1.0) / 0.35);
              vec3 nb;
              float sdA = billowRow(q, topA, (0.11 + 0.1 * top) * bw, uTime * 0.08, 1.7, nb);
              sdA += (stream - 0.5) * (0.03 + 0.12 * top);
              float dA = smoothstep(soft, -soft * 1.5, sdA);
              float upK = smoothstep(-0.35, 0.95, nb.y * 0.85 + nb.z * 0.25);
              float thinA = smoothstep(-0.07 - 0.12 * top, -0.005, sdA) * smoothstep(-0.1, 0.7, nb.y);
              vec3 hazeA = mix(bodyC * 0.58, bodyC * 0.92, upK);
              hazeA = mix(hazeA, crestC, thinA * (0.55 + 0.35 * stream));
              hazeA = hazeA * uGain + uLift * (1.0 - hazeA);
              col = mix(col, hazeA * (1.0 + 0.1 * beat), dA * (0.82 + 0.14 * stream) * on);
              // The front churn: low, dense and darkest nearest the lens, its top frayed by the powder.
              float cB = top * wrap * (0.3 + 0.36 * fbm3(vec2(q.x * 3.8 / bw + uTime * 0.32, 4.0 + uTime * 0.55)));
              float eB = cB - uv.y + (stream2 - 0.5) * (0.03 + 0.14 * top);
              float dB = smoothstep(-soft, soft * 1.6, eB);
              vec3 deepC = mix(uPowDeep, vec3(0.03, 0.04, 0.115), 0.55);
              vec3 hazeB = mix(deepC, bodyC * 0.8, smoothstep(0.0, max(cB, 0.02), uv.y) * (0.6 + 0.4 * stream2));
              hazeB = hazeB * uGain + uLift * (1.0 - hazeB);
              col = mix(col, hazeB, dB * (0.65 + 0.3 * stream2) * smoothstep(0.08, 0.35, uDanger));
            }
            // Chunks: dark, hard-edged broken blocks of snow and ice tumbling in the churn and overtaking
            // the lens at the frame's sides, each spinning and shrinking as it flies on toward the
            // vanishing point. Never out over open snow, where they read as floating slabs.
            float ex = min(uv.x, 1.0 - uv.x) * uAspect;
            float churn = max(1.0 - smoothstep(top * 0.9, top * 1.3, uv.y), (1.0 - smoothstep(0.06, 0.16, ex)) * (1.0 - smoothstep(cap, cap + 0.2, uv.y)));
            // The angles scale with the frame's width, so a phone's narrow frame gets its chunks too.
            float thK = mix(0.45, 1.0, smoothstep(0.6, 1.5, uAspect));
            float sideK = smoothstep(0.42 * thK, 0.7 * thK, abs(th)) * (1.0 - smoothstep(2.2, 2.6, abs(th))) * churn;
            if (sideK > 0.0) {
              vec2 cg = vec2(th / 0.3, (lr + uTime * 1.5) / 0.42);
              vec2 cc = floor(cg);
              float h = hashL(cc + 11.3);
              float on = step(1.0 - 0.5 * smoothstep(0.15, 0.65, uDanger), h);
              vec2 f = (fract(cg) - 0.5 - (vec2(hashL(cc + 2.7), hashL(cc + 5.9)) - 0.5) * 0.3) * vec2(0.3, 0.42);
              float sz = 0.034 + 0.032 * hashL(cc + 8.3);
              float ang = uTime * (2.0 + 3.0 * h) * (h > 0.82 ? 1.0 : -1.0) + h * 20.0;
              vec2 e = vec2(cos(ang) * f.x + sin(ang) * f.y, -sin(ang) * f.x + cos(ang) * f.y);
              // A box with one corner knocked off: an angular broken block, not a pebble.
              float sdc = max(max(abs(e.x) - sz, abs(e.y) - sz * 0.7), (e.x + e.y) * 0.7071 - sz * 0.72);
              float pxl = uTexel.y * 1.2 / rv;
              float ka = smoothstep(pxl, -pxl, sdc) * on * sideK * smoothstep(-1.25, -0.7, lr) * clearR;
              vec3 navy = vec3(0.03, 0.04, 0.115);
              // Ink dark, with only a faint lit face: a pale face read as a grey slab lying on the snow.
              vec3 chunk = mix(navy * 1.2, mix(uPowShade, crestC, 0.25), step(sz * 0.15, e.y - e.x * 0.35) * 0.2);
              col = mix(col, chunk * uGain + uLift * (1.0 - chunk), ka * 0.95 * smoothstep(0.1, 0.35, uDanger));
            }
            // Spindrift: fine streaks of powder whipping past the lens toward the vanishing point, just
            // over the haze and up the frame's sides, never over the rider.
            vec2 sg = vec2(th / 0.035, (lr + uTime * 4.2) / 0.32);
            vec2 sc = floor(sg);
            float sh = hashL(sc + 21.7);
            if (sh > 0.88) {
              vec2 sf = fract(sg) - 0.5;
              float drift = (1.0 - smoothstep(0.15, 0.48, abs(sf.y))) * (1.0 - smoothstep(0.06, 0.22, abs(sf.x + (hashL(sc + 4.4) - 0.5) * 0.5)));
              float zoneS = max(1.0 - smoothstep(top * 0.5, top + 0.16, uv.y), smoothstep(0.55 * thK, 0.8 * thK, abs(th)) * (1.0 - smoothstep(cap, cap + 0.28, uv.y))) * smoothstep(-1.2, -0.6, lr);
              col = mix(col, crestC * 1.12 * uGain, drift * zoneS * clearR * 0.42 * smoothstep(0.1, 0.5, uDanger));
            }
          }
          // Film grain scales with the value: a fixed amount of noise in linear light turns into coarse
          // digital speckle across dark skies and pines once the sRGB curve lifts the shadows.
          float gl = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col *= 1.0 + (hash(uv * 813.0 + fract(uTime) * 91.0) - 0.5) * 0.07 * uGrain * smoothstep(0.015, 0.25, gl);
          gl_FragColor = vec4(max(col, 0.0), 1.0);
          #include <colorspace_fragment>
          // Dither to break up banding in the big sky gradients.
          gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime * 7.0)) - 0.5) / 255.0;
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    // Picture-in-picture (the avalanche mirror): the same grade as the main frame, rounded corners,
    // a soft shadow so it sits above the world, and the danger meter's own frame: an ink-navy rim
    // with a faint ice-blue hairline, so the picture, not its border, is what the eye finds. Only
    // when the wall is close does the hairline heat to the meter's full ice blue, glowing a little
    // way inside and pulsing with the meter under 20 m (one cold unit, never the player's vermillion).
    const cu = this.composite.uniforms;
    this.inset = new ShaderMaterial({
      vertexShader: VERT,
      uniforms: {
        tScene: { value: null },
        uLift: cu.uLift,
        uGain: cu.uGain,
        uSat: cu.uSat,
        uContrast: cu.uContrast,
        uTime: cu.uTime,
        uSize: { value: new Vector2(1, 1) },
        uMargin: { value: 14 },
        uRadius: { value: 18 },
        uFade: { value: 1 },
        uDanger: { value: 0 },
      },
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform vec3 uLift;
        uniform vec3 uGain;
        uniform float uSat;
        uniform float uContrast;
        uniform float uTime;
        uniform vec2 uSize;
        uniform float uMargin;
        uniform float uRadius;
        uniform float uFade;
        uniform float uDanger;
        varying vec2 vUv;
        float box(vec2 p, vec2 inner) {
          vec2 q = abs(p - uSize * 0.5) - (inner * 0.5 - uRadius);
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
        }
        void main() {
          vec2 p = vUv * uSize;
          vec2 inner = uSize - 2.0 * uMargin;
          float d = box(p, inner);
          vec3 col = texture2D(tScene, clamp((p - uMargin) / inner, 0.0, 1.0)).rgb;
          col = col * uGain + uLift * (1.0 - col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          // A touch more contrast than the main frame, so the dark wall reads hard at this size.
          col = (col - 0.2) * (uContrast * 1.12) + 0.2;
          col = max(col, 0.0);
          col = col / (1.0 + max(col - 0.85, 0.0) * 0.6);
          // Hot only when the wall is close (about 27 m in), urgent from 20 m like the meter.
          float heat = smoothstep(0.45, 0.75, uDanger);
          float urgent = smoothstep(0.6, 0.75, uDanger);
          float beat = pow(0.5 + 0.5 * sin(uTime * mix(6.0, 10.5, urgent)), 2.0) * urgent;
          // Linear-light #0A0F24 (the meter's ink panel) and #6FC3FF (its hazard accent).
          vec3 ink = vec3(0.003, 0.0048, 0.0176);
          vec3 hazard = vec3(0.159, 0.546, 1.0);
          // Heat glows a little way inside the picture, like the meter's inset glow.
          col = mix(col, hazard, smoothstep(-16.0, -4.0, d) * (heat * 0.16 + beat * 0.22));
          // The ink rim, 2 px wide (the card radius rounds the corners), so the picture reads as glass.
          float rim = 2.0 + heat;
          col = mix(col, ink, smoothstep(-rim - 0.75, -rim + 0.25, d));
          // The hairline on the rim's outer edge: the meter's 32% ice blue, full and wider when hot.
          float hair = 1.0 + heat * 1.2 + beat * 0.6;
          float line = smoothstep(-hair - 0.75, -hair + 0.25, d);
          col = mix(col, hazard * (1.0 + beat * 0.7), line * mix(0.36, 1.0, heat));
          float inside = 1.0 - smoothstep(-0.5, 0.5, d);
          float shadow = (1.0 - smoothstep(0.0, uMargin, box(p + vec2(0.0, 4.0), inner))) * 0.5;
          gl_FragColor = vec4(mix(vec3(0.006, 0.01, 0.033), col, inside), max(inside, shadow) * uFade);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.setSize(w, h);
  }

  setSize(w: number, h: number): void {
    this.sceneRT.setSize(w, h);
    for (const m of this.mips) m.dispose();
    for (const m of this.ups) m.dispose();
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, Math.floor(w / 2));
    let mh = Math.max(1, Math.floor(h / 2));
    const type = this.renderer.capabilities.isWebGL2 ? HalfFloatType : UnsignedByteType;
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new WebGLRenderTarget(mw, mh, { type, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false }));
      if (i < this.levels - 1) this.ups.push(new WebGLRenderTarget(mw, mh, { type, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false }));
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
    }
    this.composite.uniforms.uAspect.value = w / h;
    this.composite.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  setMsaa(samples: number): void {
    if (samples === this.msaa) return;
    this.msaa = samples;
    this.composite.uniforms.uFxaa.value = samples > 0 ? 0 : 1;
    this.sceneRT.samples = samples;
    this.sceneRT.dispose();
  }

  setGrade(g: GradeParams): void {
    const u = this.composite.uniforms;
    u.uLift.value.copy(g.lift).multiplyScalar(0.6);
    u.uGain.value.copy(g.gain);
    u.uSat.value = g.saturation;
    u.uContrast.value = g.contrast;
    this.moodBloom = g.bloom;
    this.moodGrain = g.grain ?? 1;
    this.moodFoot = g.foot ?? 0;
    this.moodShafts = g.shafts ?? 0;
  }

  /** How strong the light shafts are this frame, and where the sun sits on screen: only for a low,
   *  clear sun (shared.uDiskDir) inside or just off the frame, fading out as it climbs or leaves. */
  private aimShafts(camera: Camera): void {
    const u = this.composite.uniforms;
    let k = this.moodShafts;
    const dir = shared.uDiskDir.value;
    if (k > 0) k *= 1 - Math.max(0, Math.min(1, (dir.y - 0.2) / 0.12));
    if (k > 0) {
      // Behind the lens, project() mirrors the point back into the frame: no shafts then.
      const ahead = sunProbe.copy(dir).transformDirection(camera.matrixWorldInverse).z < 0 ? 1 : 0;
      const p = sunProbe.copy(camera.position).addScaledVector(dir, 1000).project(camera);
      const off = Math.max(Math.abs(p.x), Math.abs(p.y));
      k *= ahead * (1 - Math.max(0, Math.min(1, (off - 1) / 0.25)));
      u.uSunUv.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    }
    u.uShaft.value = k;
    u.uShaftTaps.value = this.shaftTaps;
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  /** The target the scene pass draws into (null: the canvas, with the post pass off). Shader programs
   *  depend on it (a linear HDR buffer or the sRGB canvas), so a prewarm compiles into it. */
  get sceneTarget(): WebGLRenderTarget | null {
    return this.enabled ? this.sceneRT : null;
  }

  render(scene: Scene, camera: Camera): void {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    if (this.bloomEnabled) {
      const first = this.mips[0];
      this.prefilter.uniforms.tSrc.value = this.sceneRT.texture;
      this.prefilter.uniforms.uTexel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
      this.pass(this.prefilter, first);
      for (let i = 1; i < this.mips.length; i++) {
        this.down.uniforms.tSrc.value = this.mips[i - 1].texture;
        this.down.uniforms.uTexel.value.set(1 / this.mips[i - 1].width, 1 / this.mips[i - 1].height);
        this.pass(this.down, this.mips[i]);
      }
      // Upsample back up the chain into separate accumulation targets (no read/write feedback).
      for (let i = this.mips.length - 1; i > 0; i--) {
        const src = i === this.mips.length - 1 ? this.mips[i] : this.ups[i];
        this.up.uniforms.tSrc.value = src.texture;
        this.up.uniforms.tBase.value = this.mips[i - 1].texture;
        this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.up, this.ups[i - 1]);
      }
    }
    const u = this.composite.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom.value = (this.ups[0] ?? this.mips[0]).texture;
    u.uUseBloom.value = this.bloomEnabled ? 1 : 0;
    u.uBloom.value = this.moodBloom * this.params.bloomScale;
    u.uFoot.value = this.moodFoot * this.params.footScale;
    u.uSpeed.value = this.params.speed;
    u.uPunch.value = this.params.punch;
    u.uFlash.value = this.params.flash;
    u.uVignette.value = this.params.vignette;
    u.uGrain.value = this.params.grain * this.moodGrain;
    u.uTime.value = this.params.time;
    u.uDanger.value = this.params.danger;
    u.uRider.value.set(this.params.riderX, this.params.riderY);
    u.uFeet.value = this.params.feetY;
    u.uVp.value.set(this.params.vpX, this.params.vpY);
    u.uStreakFoot.value = this.params.streakFoot;
    this.aimShafts(camera);
    this.pass(this.composite, null);
  }

  /** Renders the scene from a second camera into a framed inset. x, y, w, h are CSS pixels with the
   *  origin at the bottom left, like WebGLRenderer.setViewport. */
  /** `refresh` false re-composites the last inset image without rendering the scene again. */
  renderInset(scene: Scene, camera: Camera, x: number, y: number, w: number, h: number, fade: number, danger: number, refresh = true): void {
    const r = this.renderer;
    const pr = r.getPixelRatio();
    const pw = Math.max(1, Math.round(w * pr));
    const ph = Math.max(1, Math.round(h * pr));
    if (!this.insetRT) {
      refresh = true;
      const type = r.capabilities.isWebGL2 ? HalfFloatType : UnsignedByteType;
      // No MSAA: at inset size the edges barely show it, and the resolve is not free.
      // A stencil buffer too, so the rider masks the ghosts here as in the main view (C10).
      this.insetRT = new WebGLRenderTarget(pw, ph, { type, minFilter: LinearFilter, magFilter: LinearFilter, stencilBuffer: true });
    } else if (this.insetRT.width !== pw || this.insetRT.height !== ph) {
      this.insetRT.setSize(pw, ph);
      refresh = true;
    }
    if (refresh) {
      r.setRenderTarget(this.insetRT);
      r.render(scene, camera);
    }
    const u = this.inset.uniforms;
    const m = u.uMargin.value as number;
    u.tScene.value = this.insetRT.texture;
    u.uSize.value.set(w + m * 2, h + m * 2);
    u.uFade.value = fade;
    u.uDanger.value = danger;
    u.uTime.value = this.params.time;
    const autoClear = r.autoClear;
    r.autoClear = false;
    r.getSize(this.screen);
    r.setRenderTarget(null);
    r.setViewport(x - m, y - m, w + m * 2, h + m * 2);
    this.quad.material = this.inset;
    r.render(this.qScene, this.qCam);
    r.setViewport(0, 0, this.screen.x, this.screen.y);
    r.autoClear = autoClear;
  }

  dispose(): void {
    this.sceneRT.dispose();
    for (const m of this.mips) m.dispose();
    for (const m of this.ups) m.dispose();
    this.insetRT?.dispose();
  }
}
