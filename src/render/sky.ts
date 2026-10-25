import { BackSide, BufferAttribute, DoubleSide, BufferGeometry, Color, Mesh, Object3D, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { Palette } from './palette';
import { shared } from './materials';

// Sky dome (gradient, sun or moon, stars, aurora, comet) and three layers of distant ridges.
// Both follow the camera so they read as infinitely far away.

/** Ridge layers, nearest first. Each is a ring of peaks; y is the base relative to the camera, so
 *  the crests climb from just under the horizon (near) to well above it (far). */
const LAYERS = [
  { r: 1400, h: 150, y: -110, seg: 200, rough: 0.06, sharp: 1.25, detail: 0.05 },
  { r: 2300, h: 210, y: -45, seg: 240, rough: 0.1, sharp: 1.6, detail: 0.08 },
  { r: 3200, h: 380, y: 30, seg: 300, rough: 0.14, sharp: 2.1, detail: 0.11 },
];
/** How far each layer leans toward the horizon haze (atmospheric perspective). */
const AERIAL = [0, 0.12, 0.3];
/** How strongly each layer's crest catches the sun right under the disc. Only the nearest range
 *  keeps a rim: on the far ones a bright crest line read as a cut-out halo round a paper layer. */
const RIM = [0.6, 0, 0];
/** How much moonlit mist pools in the valley at the foot of each layer (night moods), nearest first:
 *  the far ranges stand out of it, so the three-layer depth holds when the sky is dark. */
const MIST = [0.35, 0.7, 0.8];

export class Sky {
  readonly root = new Object3D();
  private dome: Mesh;
  private domeMat: ShaderMaterial;
  private ridgeMats: ShaderMaterial[] = [];

  constructor(seed: number) {
    this.domeMat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uMid: { value: new Color() },
        uSpread: { value: 1 },
        uCurve: { value: 0.5 },
        uBelow: { value: new Color() },
        uSunColor: shared.uSunColor,
        uSunDir: { value: new Vector3(0, 0.2, -1).normalize() },
        uSunSize: { value: 1 },
        uSunGlow: { value: 1 },
        uSunDisc: { value: 1 },
        uSunSoft: { value: 0 },
        uStars: { value: 0 },
        uAurora: { value: 0 },
        uMoon: { value: 0 },
        uMoonPhase: { value: 0 },
        uComet: { value: 0 },
        uTime: shared.uTime,
        uCometDir: { value: new Vector3(0.0, 0.165, -0.986).normalize() },
      },
      // The sun and moon discs are measured on the screen plane, not by angle, so they stay round
      // near the frame edges where a wide lens stretches an angular disc into an egg.
      vertexShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform float uSunSize;
        uniform float uMoonPhase;
        varying vec3 vDir;
        varying vec4 vClip;
        varying vec4 vSunClip;
        varying vec4 vShadowClip;
        varying vec2 vTan;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vClip = p;
          mat3 rot = mat3(viewMatrix);
          vec3 s = normalize(uSunDir);
          vSunClip = projectionMatrix * vec4(rot * s, 0.0);
          // The disc that eats the moon into a crescent, offset up and to the side.
          vec3 right = normalize(cross(s, vec3(0.0, 1.0, 0.0)));
          vec3 o = normalize(s + (right * 0.8 + cross(right, s) * 0.6) * 0.085 * uSunSize * uMoonPhase);
          vShadowClip = projectionMatrix * vec4(rot * o, 0.0);
          vTan = vec2(1.0 / projectionMatrix[0][0], 1.0 / projectionMatrix[1][1]);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uMid;
        uniform float uSpread;
        uniform float uCurve;
        uniform vec3 uBelow;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uSunSize;
        uniform float uSunGlow;
        uniform float uSunDisc;
        uniform float uSunSoft;
        uniform float uStars;
        uniform float uAurora;
        uniform float uMoon;
        uniform float uMoonPhase;
        uniform float uComet;
        uniform float uTime;
        uniform vec3 uCometDir;
        varying vec3 vDir;
        varying vec4 vClip;
        varying vec4 vSunClip;
        varying vec4 vShadowClip;
        varying vec2 vTan;
        // Distance from this pixel to a projected direction on the screen plane, in units of the
        // view's tangent (radians at the centre of the frame); far away when it is behind the lens.
        float screenDist(vec4 c) {
          if (c.w <= 0.0) return 10.0;
          return length((vClip.xy / vClip.w - c.xy / c.w) * vTan);
        }
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float hash2(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        // Zenith to horizon through a mid colour, interpolated in a perceptual (square-root) space so a
        // dark zenith reads as dark instead of being swamped by a bright horizon in linear light.
        vec3 gradient(float h) {
          float t = pow(clamp(h / uSpread, 0.0, 1.0), uCurve);
          vec3 a = sqrt(uHorizon);
          vec3 z = sqrt(uZenith);
          vec3 m = 2.0 * sqrt(uMid) - 0.5 * (a + z);
          vec3 c = mix(mix(a, m, t), mix(m, z, t), t);
          c = max(c, 0.0);
          return c * c;
        }
        // Gradient noise with a quintic fade. Value noise leaves faint creases along its lattice, and
        // with the sky's azimuth as one axis those creases are straight meridians: visible seams.
        float gnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          vec2 ga = vec2(hash2(i), hash2(i + 17.31)) * 2.0 - 1.0;
          vec2 gb = vec2(hash2(i + vec2(1.0, 0.0)), hash2(i + vec2(18.31, 17.31))) * 2.0 - 1.0;
          vec2 gc = vec2(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(17.31, 18.31))) * 2.0 - 1.0;
          vec2 gd = vec2(hash2(i + vec2(1.0, 1.0)), hash2(i + 18.31)) * 2.0 - 1.0;
          float n = mix(mix(dot(ga, f), dot(gb, f - vec2(1.0, 0.0)), u.x), mix(dot(gc, f - vec2(0.0, 1.0)), dot(gd, f - vec2(1.0, 1.0)), u.x), u.y);
          return clamp(0.5 + n, 0.0, 1.0);
        }
        // Three long curtains, each a soft ribbon whose bright lower hem snakes across the sky and
        // whose height swells and thins along it, fading upward from mint at the hem to violet. The
        // folds drift slowly; the noise runs in a rotated domain so no lattice line lines up with
        // the sky.
        vec3 aurora(float az, float h) {
          vec3 acc = vec3(0.0);
          const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
          for (int k = 0; k < 3; k++) {
            float fk = float(k);
            // Each ribbon spans an arc of the sky (centred near the view down the course), never a ring.
            float centre = (fk - 0.8) * 0.95 + 0.25 * sin(uTime * 0.02 + fk * 4.0);
            float off = acos(clamp(cos(az - centre), -1.0, 1.0));
            float arc = smoothstep(1.4 - fk * 0.2, 0.3, off);
            if (arc <= 0.0) continue;
            float hem = 0.12 + fk * 0.085 + 0.05 * sin(az * 2.0 + fk * 2.3 + uTime * 0.035) + 0.02 * sin(az * 5.0 - fk * 1.7 - uTime * 0.06);
            float above = h - hem;
            // Skip below the hem and where even the tallest swell has faded out (most of the sky).
            if (above < -0.05 || above > (0.06 + fk * 0.03) * 6.7) continue;
            float drift = az - uTime * 0.012 * (1.0 + fk);
            vec2 ring = vec2(cos(drift), sin(drift));
            float swell = gnoise(ROT * (ring * 2.2 + vec2(fk * 5.1, uTime * 0.01)));
            float span = (0.06 + fk * 0.03) * (0.55 + 0.9 * swell);
            float body = smoothstep(-0.045, 0.012, above) * exp(-max(above, 0.0) / span);
            float folds = gnoise(ROT * (ring * 5.0 + vec2(fk * 7.3, above * 6.0 - uTime * 0.015)));
            float rays = gnoise(ROT * vec2(drift * 20.0, above * 2.5 + fk * 3.1));
            body *= arc * (0.25 + 0.75 * folds) * (0.75 + 0.25 * rays);
            vec3 col = mix(vec3(0.3, 1.0, 0.74), vec3(0.58, 0.36, 1.0), smoothstep(0.0, span * 1.6, above));
            acc += col * body * (1.0 - fk * 0.22);
          }
          return acc;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col;
          if (h >= 0.0) {
            col = gradient(h);
            // A warm band hugging the horizon.
            col = mix(col, uHorizon * 1.08, exp(-h * 28.0) * 0.6);
          } else {
            col = mix(uHorizon, uBelow, clamp(-h * 6.0, 0.0, 1.0));
          }
          float skyLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          float sd = dot(d, normalize(uSunDir));
          float sunAng = acos(clamp(sd, -1.0, 1.0));
          float R = 0.0415 * uSunSize;
          float sunScr = screenDist(vSunClip);
          // A crisp edge in a clear sky; behind a cloud deck the disc melts into a wide soft blot.
          float edge = mix(0.0035 * uSunSize, R * 0.85, uSunSoft);
          float disc = smoothstep(R + edge, R - edge, sunScr);
          float glow = exp(-sunAng * 8.0) * 0.45 * (1.0 - 0.6 * uSunSoft) + exp(-sunAng * 2.6) * 0.14 + exp(-sunAng * 4.5) * 0.3 * uSunSoft;
          vec3 sunCol = uSunColor;
          if (uMoon > 0.5) {
            // Moon: crisp disc with a soft halo and a few dark maria. A second disc offset up and
            // to the side eats the face for a crescent, leaving a faint earthshine.
            float crater = 0.0;
            if (disc > 0.0) {
              vec2 rel = (vClip.xy / vClip.w - vSunClip.xy / vSunClip.w) * vTan / R;
              crater = 0.14 * smoothstep(0.42, 0.1, length(rel - vec2(-0.28, 0.22)))
                + 0.1 * smoothstep(0.3, 0.05, length(rel - vec2(0.3, -0.12)))
                + 0.08 * smoothstep(0.24, 0.04, length(rel - vec2(-0.05, -0.42)));
            }
            float shadowDisc = smoothstep(R + 0.0035 * uSunSize, R - 0.0035 * uSunSize, screenDist(vShadowClip));
            float lit = disc * (1.0 - shadowDisc * step(0.01, uMoonPhase));
            col += sunCol * lit * (1.1 - crater) * uSunDisc;
            col += sunCol * disc * shadowDisc * 0.05 * step(0.01, uMoonPhase) * uSunDisc;
            col += sunCol * glow * 0.45 * uSunGlow * (1.0 - 0.5 * uMoonPhase);
          } else {
            // A low alpenglow sun, not a flat white hole: a white-hot core whose limb warms to
            // #FFE3B0, inside a warm corona that hugs the disc and fades out into the sky. Behind a
            // cloud deck (uSunSoft) there is no disc at all, only a wide, dim, diffused glow.
            // The limb and corona stay under the bloom threshold and the tone curve's knee, which would
            // otherwise bleach them white; only the core is hot enough to bloom.
            vec3 corona = vec3(1.0, 0.77, 0.43) * mix(vec3(1.0), sunCol / max(max(sunCol.r, sunCol.g), max(sunCol.b, 0.001)), 0.2);
            float clear = 1.0 - uSunSoft;
            vec3 face = mix(corona * 1.35, vec3(2.3, 2.15, 1.95), smoothstep(R * 0.85, R * 0.2, sunScr));
            col = mix(col, face, disc * min(uSunDisc, 1.0) * clear);
            float out0 = max(sunScr - R, 0.0);
            col += corona * (exp(-out0 / (R * 0.8)) * 0.3 + exp(-out0 / (R * 3.0)) * 0.1) * (1.0 - disc) * uSunDisc * clear;
            col += sunCol * glow * uSunGlow * mix(1.0, 0.75, clear);
            col += sunCol * exp(-sunScr / (R * 2.4)) * 0.32 * uSunSoft * uSunGlow;
          }
          if (uStars > 0.0 && h > 0.0) {
            vec3 g = d * 180.0;
            vec3 cell = floor(g);
            float s = hash(cell);
            vec3 pt = cell + vec3(hash(cell + 1.7), hash(cell + 4.1), hash(cell + 8.3));
            float dist = length(g - pt);
            float tw = 0.65 + 0.35 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
            float star = step(0.985, s) * smoothstep(0.14, 0.0, dist) * tw;
            // Stars live in the dark upper band and fade out where the horizon glow is bright.
            float dark = 1.0 - smoothstep(0.06, 0.3, skyLum);
            col += vec3(0.9, 0.95, 1.0) * star * uStars * smoothstep(0.03, 0.22, h) * dark * 1.4;
          }
          if (uAurora > 0.0 && h > 0.04) {
            float az = atan(d.x, -d.z);
            col += aurora(az, h) * uAurora * 0.62;
          }
          if (uComet > 0.0) {
            vec3 cd = normalize(uCometDir);
            float hd = acos(clamp(dot(d, cd), -1.0, 1.0));
            // A hot nucleus inside a soft coma, then the twin tail sweeping away from the sun side:
            // a long, straight, narrow ion tail in ice blue over a broader dust tail that curves away
            // from it, cream fading to rose. It is the night's hero light, so it is drawn big.
            col += vec3(1.0, 0.97, 0.92) * smoothstep(0.013, 0.0, hd) * 2.6 * uComet;
            col += vec3(0.92, 0.96, 1.0) * (exp(-hd * 30.0) * 0.95 + exp(-hd * 9.0) * 0.14) * uComet;
            // The tails fan out up and to the right, two clearly separate strokes about 35 degrees
            // long (a quarter of the sky in frame): the ion tail straight and narrow, the dust tail
            // broader, lower, curving away from it.
            vec3 side = normalize(cross(cd, vec3(0.0, 1.0, 0.0)));
            vec3 upT = normalize(cross(side, cd));
            // Offsets on the plane tangent to the sky at the head, so a long tail stays straight instead
            // of curling off its own axis with the curve of the dome.
            vec3 rel = d - cd;
            rel -= cd * dot(rel, cd);
            vec3 ion = normalize(side * 0.74 + upT * 0.67);
            float ia = dot(rel, ion);
            float front = step(0.6, dot(d, cd));
            if (front > 0.0 && ia > 0.0 && ia < 0.62) {
              // The ion tail: a narrow blue streak that widens and fades softly along its length, with
              // a soft glow either side of its core. A bright, even core read as a laser line.
              float w = 0.005 + ia * 0.03;
              float ix = length(rel - ion * ia) / w;
              float fall = pow(1.0 - ia / 0.62, 2.2) * smoothstep(0.0, 0.015, ia);
              col += vec3(0.4, 0.74, 1.0) * (exp(-ix * ix * 0.8) * 0.85 + exp(-abs(ix) * 0.6) * 0.16) * fall * uComet;
            }
            // The dust tail: broad and bright, opening about 35 degrees off the ion tail and curving
            // further away from it, cream at the head fading to rose, soft at both edges. As a faint,
            // near-horizontal smear it merged with the ion tail and the comet read as one streak.
            vec3 dust = normalize(side * 0.995 + upT * 0.1);
            vec3 bend = normalize(upT - dust * dot(upT, dust));
            float da = dot(rel, dust);
            if (front > 0.0 && da > 0.0 && da < 0.72) {
              float w = 0.018 + da * 0.25;
              float dx = length(rel - dust * da + bend * da * da * 0.7) / w;
              float fall = pow(1.0 - da / 0.72, 1.2) * smoothstep(0.0, 0.03, da);
              // Brightest down its leading edge (the side away from the ion tail), the way dust tails are.
              float lead = 0.8 + 0.35 * clamp(-dot(rel - dust * da, bend) / w, -1.0, 1.0);
              col += mix(vec3(1.0, 0.88, 0.72), vec3(1.0, 0.56, 0.64), smoothstep(0.0, 0.45, da)) * (exp(-dx * dx) * 0.95 * lead + exp(-abs(dx) * 1.1) * 0.2) * fall * uComet;
            }
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.dome = new Mesh(new SphereGeometry(4000, 48, 24), this.domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.root.add(this.dome);

    // Ridges.
    let s = seed >>> 0;
    const rand = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    LAYERS.forEach((L, li) => {
      const seg = L.seg;
      const peaks: number[] = [];
      const p1 = rand() * 6.28;
      const p2 = rand() * 6.28;
      const p3 = rand() * 6.28;
      const p4 = rand() * 6.28;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        let v = 0.55 + 0.25 * Math.sin(a * 3 + p1) + 0.15 * Math.sin(a * 7 + p2) + 0.08 * Math.sin(a * 17 + p3) + L.detail * Math.sin(a * 41 + p4);
        v += (rand() - 0.5) * 2 * L.rough;
        // Sharpen into peaks: the far range is jagged, the near hills rounded.
        v = Math.pow(Math.max(0.05, v), L.sharp);
        peaks.push(i === seg ? peaks[0] : v);
      }
      const pos: number[] = [];
      const uv: number[] = [];
      const depth: number[] = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const x = Math.sin(a) * L.r;
        const z = -Math.cos(a) * L.r;
        const top = L.y + peaks[i] * L.h;
        pos.push(x, L.y - 600, z, x, top, z);
        uv.push(i / seg, 0, i / seg, 1);
        depth.push(top - (L.y - 600), 0);
      }
      const idx: number[] = [];
      for (let i = 0; i < seg; i++) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
      g.setAttribute('aDepth', new BufferAttribute(new Float32Array(depth), 1));
      g.setIndex(idx);
      const mat = new ShaderMaterial({
        side: DoubleSide,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color() },
          uHaze: { value: new Color() },
          uRimColor: { value: new Color() },
          uSunDir: shared.uSunDir,
          uHazeDepth: { value: L.r * 0.06 },
          uRimWidth: { value: L.r * 0.0035 },
          uRimK: { value: RIM[li] },
          uMist: { value: new Color() },
          uMistK: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute float aDepth;
          varying float vDepth;
          varying vec3 vDir;
          void main() {
            vDepth = aDepth;
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform vec3 uHaze;
          uniform vec3 uRimColor;
          uniform vec3 uSunDir;
          uniform float uHazeDepth;
          uniform float uRimWidth;
          uniform float uRimK;
          uniform vec3 uMist;
          uniform float uMistK;
          varying float vDepth;
          varying vec3 vDir;
          void main() {
            // Each layer is darkest at its crest and sinks into valley haze below, so every crest line
            // stands out against the paler mist of the range behind it.
            float haze = 1.0 - exp(-vDepth / uHazeDepth);
            vec3 col = mix(uColor, uHaze, haze * 0.72);
            // At night a moonlit mist pools in the valley at the foot of each range, so the crest of the
            // range in front stands dark against the mist behind it instead of navy on navy.
            col = mix(col, uMist, uMistK * smoothstep(uHazeDepth * 0.35, uHazeDepth * 2.4, vDepth));
            // The nearest crests catch a warm rim right under the disc, and only there.
            float facing = max(dot(normalize(vDir.xz), normalize(uSunDir.xz)), 0.0);
            float rim = exp(-vDepth / uRimWidth) * pow(facing, 14.0) * 0.8 * uRimK;
            col = mix(col, uRimColor, min(rim, 1.0));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      });
      const m = new Mesh(g, mat);
      m.frustumCulled = false;
      m.renderOrder = -9 + (2 - li);
      this.ridgeMats.push(mat);
      this.root.add(m);
    });
  }

  setPalette(p: Palette): void {
    const u = this.domeMat.uniforms;
    u.uZenith.value.copy(p.skyZenith);
    u.uHorizon.value.copy(p.skyHorizon);
    const mid = u.uMid.value as Color;
    if (p.skyMid) mid.copy(p.skyMid);
    else {
      // Even blend in the same square-root space the shader interpolates in.
      const z = p.skyZenith;
      const hz = p.skyHorizon;
      const avg = (a: number, b: number) => ((Math.sqrt(a) + Math.sqrt(b)) / 2) ** 2;
      mid.setRGB(avg(z.r, hz.r), avg(z.g, hz.g), avg(z.b, hz.b));
    }
    u.uSpread.value = p.skySpread;
    u.uCurve.value = p.skyCurve;
    u.uBelow.value.copy(p.skyBelow);
    u.uSunDir.value.copy(p.diskDir);
    u.uSunSize.value = p.sunSize;
    u.uSunGlow.value = p.sunGlow;
    u.uSunDisc.value = p.sunDisc;
    u.uSunSoft.value = p.sunSoft;
    u.uStars.value = p.stars;
    u.uAurora.value = p.aurora;
    u.uMoon.value = p.moon ? 1 : 0;
    u.uMoonPhase.value = p.moon ? p.moonPhase : 0;
    u.uComet.value = p.comet ? 1 : 0;
    this.ridgeMats.forEach((m, i) => {
      const mu = m.uniforms;
      const haze = (mu.uHaze.value as Color).copy(p.fog).lerp(p.skyHorizon, 0.5);
      // Nearest layer takes the deepest colour; farther layers lean into the haze.
      (mu.uColor.value as Color).copy(p.ridge[2 - i]).lerp(haze, AERIAL[i]);
      (mu.uRimColor.value as Color).copy(p.sunColor).lerp(p.skyHorizon, 0.45).multiplyScalar(p.moon ? 0.5 : 1);
      (mu.uMist.value as Color).copy(p.mist ?? p.fog);
      mu.uMistK.value = p.mist ? MIST[i] * p.mistK : 0;
    });
  }

  follow(cam: Vector3): void {
    this.root.position.set(cam.x, cam.y, cam.z);
  }
}
