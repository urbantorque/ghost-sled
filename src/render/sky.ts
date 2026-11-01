import { BackSide, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, Object3D, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { COMET_DIR, Palette } from './palette';
import { shared } from './materials';
import { Massif, NOISE, SEA_GLSL, makeSeaUniforms } from './massif';

// Sky dome (gradient, sun or moon, stars, aurora, comet, and the sea of clouds below the horizon)
// and the mountain panorama (massif.ts). Both follow the camera so they read as infinitely far away.

export class Sky {
  readonly root = new Object3D();
  private dome: Mesh;
  private domeMat: ShaderMaterial;
  private massif: Massif;
  /** The valley mist below the run (Medium and High). */
  private mist = new ValleyMist();
  private sea = makeSeaUniforms();
  private wisps = true;
  private highClouds = 0;

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
        uCometDir: { value: COMET_DIR.clone() },
        uCloudLow: { value: 0 },
        uCloudHigh: { value: 0 },
        uCloudTop: { value: 0.15 },
        uCloudLit: { value: new Color() },
        uCloudShade: { value: new Color() },
        uCloudRim: { value: new Color() },
        uRays: { value: 0 },
        uHalo: { value: 0 },
        uMeteors: { value: 0 },
        ...this.sea,
      },
      defines: { CLOUD_Q: 1, SEA_Q: 1 },
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
        uniform float uCloudLow;
        uniform float uCloudHigh;
        uniform float uCloudTop;
        uniform vec3 uCloudLit;
        uniform vec3 uCloudShade;
        uniform vec3 uCloudRim;
        uniform float uRays;
        uniform float uHalo;
        uniform float uMeteors;
        varying vec3 vDir;
        varying vec4 vClip;
        varying vec4 vSunClip;
        varying vec4 vShadowClip;
        varying vec2 vTan;
        ${SEA_GLSL}
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
        // The same gradient noise wrapped every period cells along x, so clouds laid round the sky by
        // azimuth close up behind the lens without a seam (the results hero shot turns right round).
        vec2 pgrad(vec2 c) { return vec2(hash2(c), hash2(c + 17.31)) * 2.0 - 1.0; }
        float pnoise(vec2 p, float period) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          // Wrapped by comparison rather than mod(): on D3D, mod() can land a hair under a whole cell
          // and hash a different corner, which tore the clouds with vertical seams.
          float x0 = i.x >= period - 0.5 ? i.x - period : i.x;
          float x1 = i.x + 1.0 >= period - 0.5 ? i.x + 1.0 - period : i.x + 1.0;
          float a = dot(pgrad(vec2(x0, i.y)), f);
          float b = dot(pgrad(vec2(x1, i.y)), f - vec2(1.0, 0.0));
          float c = dot(pgrad(vec2(x0, i.y + 1.0)), f - vec2(0.0, 1.0));
          float d = dot(pgrad(vec2(x1, i.y + 1.0)), f - vec2(1.0, 1.0));
          return clamp(0.5 + mix(mix(a, b, u.x), mix(c, d, u.x), u.y), 0.0, 1.0);
        }
        // Painted shading: light stepped into three flat values with short soft transitions (gouache,
        // not a smooth photographic ramp).
        float steps3(float l) {
          float q = clamp(l, 0.0, 0.999) * 3.0;
          return (floor(q) + smoothstep(0.4, 0.6, fract(q))) / 3.0;
        }
        // Cumulus banks along the horizon: lumpy, crisp-edged tops over a solid foot that the distant
        // ridges hide, gaps between the banks, flat stepped shading, the edges and the side toward the
        // sun catching its colour, and the lower cloud hazed toward the horizon. sunSide is 1 under the
        // sun's bearing. They drift round the sky very slowly. Returns colour and coverage.
        vec4 cloudBank(float az, float h, float sunSide, float sunBelow, float nearSun, float sunH) {
          // Under the sun's bearing the bank dips to pass below the disc, framing it (and leaving a
          // clear gap for it to set into once it sinks toward the ridge).
          float y = h / mix(uCloudTop, max(sunH - 0.075, 0.012), nearSun);
          if (y > 1.2) return vec4(0.0);
          float X = fract(az / 6.2831853 + uTime * 0.0004);
          // The bank is a height field rising from the horizon (so it reads as heaped towers and
          // shoulders standing on the ridges, never lenses floating in the sky): broad swells with
          // clear gaps between them, shoulders on those, and puffs bubbling the tops. (Gradient noise
          // stays close to its mean, so each octave's swing is stretched.)
          // The banks are alive: each octave also slides through its second axis with time, so swells
          // build and sink and the puffs on their tops bubble over a minute or so, while the whole
          // bank drifts round the sky.
          float top = 0.8 + (uCloudLow - 0.6) * 0.8
            + (pnoise(vec2(X * 6.0, 0.37 + uTime * 0.0021), 6.0) - 0.5) * 2.4
            + (pnoise(vec2(X * 15.0 + 0.5, 1.61 + uTime * 0.0047), 15.0) - 0.5) * 1.1;
          #if CLOUD_Q > 0
            top += (pnoise(vec2(X * 38.0, y * 2.6 + 2.3 + uTime * 0.012), 38.0) - 0.5) * 0.6 + (pnoise(vec2(X * 83.0, y * 5.0 + 0.7 + uTime * 0.03), 83.0) - 0.5) * 0.22;
          #else
            top += (pnoise(vec2(X * 38.0, y * 2.6 + 2.3), 38.0) - 0.5) * 0.6;
          #endif
          // Towers round off under the top of the band rather than being cut flat.
          top = min(top, 1.05 - 0.25 * smoothstep(0.8, 1.4, top));
          float dens = top - y;
          float a = smoothstep(0.0, 0.025, dens);
          if (a <= 0.0) return vec4(0.0);
          // 0 on the silhouette, 1 deep inside the bank: the heaped tops catch the light, the body
          // under them sits in shade, in three flat values.
          float depth = clamp(dens / 0.42, 0.0, 1.0);
          float l = (1.0 - depth) * 0.7 + clamp(y, 0.0, 1.0) * 0.3;
          vec3 col = mix(uCloudShade, uCloudLit, steps3(l));
          // The side toward the sun is warmer and brighter (smoothly: stepped, its contours ran as
          // vertical seams down the bank), with a thin rim on the silhouette there; and where the sun
          // has sunk below the tops it lights the bank's underside.
          col = mix(col, uCloudLit, sunSide * 0.3);
          float edge = 1.0 - smoothstep(0.04, 0.2, depth);
          col = mix(col, uCloudRim, edge * (0.12 + 0.78 * sunSide));
          col = mix(col, uCloudRim, sunSide * sunBelow * (1.0 - smoothstep(0.0, 0.55, y)) * 0.6);
          // Aerial haze toward the foot of the bank.
          col = mix(col, uHorizon, (1.0 - clamp(y, 0.0, 1.0)) * 0.28);
          return vec4(col, a * min(1.0, uCloudLow * 1.5));
        }
        // High wisps: long thin strokes stretched along the horizon, pale with their sun side warm.
        vec4 cloudWisps(float az, float h, float sunSide) {
          if (h < 0.16 || h > 0.56) return vec4(0.0);
          float band = smoothstep(0.16, 0.24, h) * (1.0 - smoothstep(0.42, 0.56, h));
          float X = fract(az / 6.2831853 + 0.37 + uTime * 0.0007);
          float yy = h * 10.0 + uTime * 0.006;
          float warp = pnoise(vec2(X * 4.0, yy * 0.5), 4.0);
          float n = pnoise(vec2(X * 9.0 + warp * 0.8, yy + warp * 1.5), 9.0) * 0.7 + pnoise(vec2(X * 23.0, yy * 2.2 + warp * 2.0), 23.0) * 0.3;
          n += (uCloudHigh - 0.5) * 0.25;
          float a = smoothstep(0.6, 0.64, n) * band;
          if (a <= 0.0) return vec4(0.0);
          float depth = smoothstep(0.6, 0.76, n);
          vec3 col = mix(uCloudLit, mix(uCloudShade, uCloudLit, 0.5), steps3(depth) * 0.8);
          col = mix(col, uCloudRim, sunSide * (1.0 - depth * 0.6) * 0.75);
          return vec4(col, a * min(1.0, uCloudHigh * 1.6) * 0.62);
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
            // Fine vertical rays that ripple sideways along the curtain, and slow surges of brightness
            // running along it, so the display breathes rather than hanging still.
            float rays = gnoise(ROT * vec2(drift * 20.0 + uTime * 0.05, above * 2.5 + fk * 3.1));
            float surge = gnoise(vec2(drift * 2.6 - uTime * 0.09, fk * 4.7 + uTime * 0.02));
            body *= arc * (0.25 + 0.75 * folds) * (0.5 + 0.5 * rays * rays * 1.6) * (0.55 + 0.9 * surge * surge);
            vec3 col = mix(vec3(0.3, 1.0, 0.74), vec3(0.58, 0.36, 1.0), smoothstep(0.0, span * 1.6, above));
            // A strong display's rose fringe along the lower hem, under the green.
            col = mix(col, vec3(1.0, 0.36, 0.62), (1.0 - smoothstep(-0.02, 0.016, above)) * 0.7 * smoothstep(0.45, 0.8, surge));
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
            // The sea of clouds far below, which the ranges rise out of.
            if (uSea > 0.0) {
              vec4 sea = seaOfClouds(d);
              col = mix(col, sea.rgb, sea.a);
            }
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
          // Painted clouds, under the sun and moon: they part round the disc (its core is never
          // covered) and only veil the corona, which shines on over them.
          float cloudA = 0.0;
          if ((uCloudLow > 0.0 || uCloudHigh > 0.0) && h > -0.01 && h < 0.56) {
            vec3 sdn = normalize(uSunDir);
            float az = atan(d.x, -d.z);
            float dAz = acos(clamp(cos(az - atan(sdn.x, -sdn.z)), -1.0, 1.0));
            float sunSide = pow(max(cos(dAz), 0.0), 5.0) * smoothstep(-0.05, 0.05, sdn.y) * (uMoon > 0.5 ? 0.6 : 1.0);
            float nearSun = (1.0 - smoothstep(0.1, 0.42, dAz)) * step(0.01, uSunDisc) * step(sdn.y, uCloudTop + 0.08);
            float sunBelow = smoothstep(uCloudTop * 1.1, uCloudTop * 0.4, sdn.y);
            float part = mix(1.0, smoothstep(R * 1.02, R * 1.75, sunScr), step(0.01, uSunDisc) * (1.0 - uSunSoft));
            vec4 cl = vec4(0.0);
            if (uCloudLow > 0.0 && h < uCloudTop * 1.2) cl = cloudBank(az, max(h, 0.0), sunSide, sunBelow, nearSun, sdn.y);
            #if CLOUD_Q > 0
              if (uCloudHigh > 0.0 && cl.a < 0.99) {
                vec4 w = cloudWisps(az, h, sunSide);
                cl = vec4(mix(w.rgb, cl.rgb, cl.a > 0.0 ? cl.a / max(cl.a + w.a * (1.0 - cl.a), 0.001) : 0.0), cl.a + w.a * (1.0 - cl.a));
              }
            #endif
            cloudA = cl.a * part;
            col = mix(col, cl.rgb, cloudA);
          }
          #if CLOUD_Q > 0
            // Crepuscular rays: beams of light fanning out from the sun through the gaps in the cloud
            // banks and the ridges, between cooler beams of shadow, turning very slowly. Strongest close
            // to the disc and thinning out across the sky; they veil the clouds only lightly.
            if (uRays > 0.0 && h > -0.03 && sunAng < 1.5 && sunAng > 0.015) {
              vec3 sr = normalize(uSunDir);
              vec3 sideR = normalize(cross(sr, vec3(0.0, 1.0, 0.0)));
              vec3 upR = cross(sideR, sr);
              float phi = atan(dot(d, upR), dot(d, sideR));
              vec2 rg = vec2(cos(phi), sin(phi));
              // Behind a cloud deck the beams spread broad and soft.
              float fq = 1.0 - 0.45 * uSunSoft;
              float beam = gnoise(rg * 3.1 * fq + vec2(uTime * 0.009, 3.7)) * 0.66 + gnoise(rg * 7.4 * fq + vec2(-uTime * 0.014, 9.1)) * 0.34;
              beam = smoothstep(0.34, 0.74, beam);
              float fallR = exp(-sunAng * 1.5) * smoothstep(0.02, 0.2, sunAng);
              vec3 rayC = mix(uSunColor, uCloudRim, 0.45);
              col += rayC * beam * fallR * uRays * 0.11 * (1.0 - 0.5 * cloudA);
              col *= 1.0 - (1.0 - beam) * fallR * uRays * 0.12 * (1.0 - cloudA);
            }
          #endif
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
            col += corona * (exp(-out0 / (R * 0.8)) * 0.3 + exp(-out0 / (R * 3.0)) * 0.1) * (1.0 - disc) * uSunDisc * clear * (1.0 - 0.45 * cloudA);
            col += sunCol * glow * uSunGlow * mix(1.0, 0.75, clear);
            col += sunCol * exp(-sunScr / (R * 2.4)) * 0.32 * uSunSoft * uSunGlow;
          }
          if (uHalo > 0.0) {
            // Ice-crystal air: the 22 degree halo, a thin ring reddish on its inner edge with the sky
            // inside it a shade darker, brightest along its top; two sun dogs either side of the sun at
            // its own height, red toward it with a white tail outward; and a faint parhelic line
            // through the sun along its height.
            vec3 sh = normalize(uSunDir);
            float hr = (sunAng - 0.384) / 0.011;
            float topArc = 1.0 + 0.7 * smoothstep(0.3, 0.95, normalize(d - sh * sd + vec3(0.0, 1e-5, 0.0)).y);
            // Round a moon the ring takes the moonlight's own pale colour (Haunted Hollow's lunar halo).
            vec3 hTint = uMoon > 0.5 ? mix(vec3(1.0), uSunColor, 0.7) : vec3(1.0);
            vec3 hc = mix(vec3(1.0, 0.6, 0.4), vec3(0.94, 0.97, 1.0), smoothstep(-1.2, 1.4, hr + uMoon * 2.0)) * hTint;
            col += hc * exp(-hr * hr) * 0.16 * uHalo * topArc * smoothstep(-0.03, 0.03, h) * (1.0 - 0.6 * cloudA);
            col *= 1.0 - 0.08 * uHalo * smoothstep(0.375, 0.26, sunAng) * smoothstep(0.07, 0.2, sunAng);
            float sEl = asin(clamp(sh.y, -1.0, 1.0));
            float dEl = asin(clamp(d.y, -1.0, 1.0));
            float sAz = atan(sh.x, -sh.z);
            float dAzH = atan(sin(atan(d.x, -d.z) - sAz), cos(atan(d.x, -d.z) - sAz)) * cos(dEl);
            float dy = (dEl - sEl) / 0.024;
            float vert = exp(-dy * dy);
            for (int k = 0; k < 2; k++) {
              float dx = dAzH * (float(k) * 2.0 - 1.0) - 0.39 / max(cos(sEl), 0.5);
              float spot = exp(-dx * dx / 0.00016) + 0.5 * step(0.0, dx) * exp(-dx / 0.06) * exp(-dy * dy * 1.2);
              vec3 dc = mix(vec3(1.0, 0.46, 0.28), vec3(0.88, 0.94, 1.0), smoothstep(-0.006, 0.012, dx));
              col += dc * spot * vert * 0.55 * uHalo * hTint * (1.0 - 0.7 * uMoon);
            }
            col += vec3(0.95, 0.97, 1.0) * exp(-dy * dy * 30.0) * 0.035 * uHalo * smoothstep(0.06, 0.35, abs(dAzH)) * exp(-abs(dAzH) * 1.4);
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
            col += vec3(0.9, 0.95, 1.0) * star * uStars * smoothstep(0.03, 0.22, h) * dark * 1.4 * (1.0 - cloudA);
          }
          if (uMeteors > 0.0 && h > 0.06) {
            // Shooting stars: three slots, each firing now and then (a different place and heading each
            // time) and crossing for about a second, a hot head drawing a fading tail down the dark sky.
            float darkM = 1.0 - smoothstep(0.08, 0.4, skyLum);
            for (int k = 0; k < 3; k++) {
              float fk = float(k);
              float tt = uTime / (5.3 + fk * 3.1) + fk * 0.37;
              float idm = floor(tt);
              float um = fract(tt) / 0.16;
              if (um > 1.0) continue;
              float ha = hash2(vec2(idm, fk * 7.1 + 0.3));
              float hb = hash2(vec2(fk * 3.3 + 0.7, idm + 0.5));
              float hc = hash2(vec2(idm * 1.37 + 0.2, fk + 2.2));
              float am = (ha - 0.5) * 2.2;
              float em = 0.32 + hb * 0.42;
              vec3 st = vec3(sin(am) * cos(em), sin(em), -cos(am) * cos(em));
              vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), st));
              vec3 down = normalize(vec3(0.0, -1.0, 0.0) + st * st.y);
              vec3 tdir = normalize(down * 0.75 + east * (hc - 0.5) * 2.2);
              float len = 0.2 + hc * 0.14;
              vec3 head = normalize(st + tdir * len * um);
              vec3 tail = normalize(st + tdir * len * max(um - 0.5, 0.0));
              vec3 ba = head - tail;
              vec3 pa = d - tail;
              float q = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
              float dm = length(pa - ba * q);
              float fadeM = smoothstep(0.0, 0.12, um) * (1.0 - smoothstep(0.75, 1.0, um));
              float core = smoothstep(0.0022, 0.0, dm) + exp(-dm / 0.0035) * 0.3;
              col += mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.96, 0.88), q) * core * q * q * fadeM * 1.8 * uMeteors * darkM * (1.0 - cloudA);
            }
          }
          if (uAurora > 0.0 && h > 0.04) {
            float az = atan(d.x, -d.z);
            col += aurora(az, h) * uAurora * 0.72;
          }
          if (uComet > 0.0) {
            vec3 cd = normalize(uCometDir);
            float hd = acos(clamp(dot(d, cd), -1.0, 1.0));
            // A hot nucleus inside a soft coma, then the twin tail sweeping away from the sun side:
            // a long, straight, narrow ion tail in ice blue over a broader dust tail that curves away
            // from it, cream fading to rose. It is the night's hero light, so it is drawn big.
            col += vec3(1.0, 0.97, 0.92) * smoothstep(0.016, 0.0, hd) * 2.8 * uComet;
            col += vec3(0.92, 0.96, 1.0) * (exp(-hd * 24.0) * 1.0 + exp(-hd * 7.0) * 0.18) * uComet;
            // A vast faint glow round the whole comet, so it lights its quarter of the sky.
            col += vec3(0.62, 0.66, 0.95) * exp(-hd * 2.2) * 0.07 * uComet;
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
            float front = step(0.3, dot(d, cd));
            if (front > 0.0 && ia > 0.0 && ia < 0.95) {
              // The ion tail: a narrow blue streak that widens and fades softly along its length, with
              // a soft glow either side of its core. A bright, even core read as a laser line. Long
              // streamers ripple down it, drifting outward, so it reads as gas blown off the head.
              float w = 0.006 + ia * 0.034;
              float ix = length(rel - ion * ia) / w;
              float sx = dot(rel - ion * ia, normalize(cross(cd, ion))) / w;
              float streamers = 0.7 + 0.5 * gnoise(vec2(sx * 2.2, ia * 3.0 - uTime * 0.05));
              float fall = pow(1.0 - ia / 0.95, 2.0) * smoothstep(0.0, 0.015, ia);
              col += vec3(0.4, 0.74, 1.0) * (exp(-ix * ix * 0.8) * 0.9 * streamers + exp(-abs(ix) * 0.6) * 0.18) * fall * uComet;
            }
            // The dust tail: broad and bright, opening about 35 degrees off the ion tail and curving
            // further away from it, cream at the head fading to rose, soft at both edges. As a faint,
            // near-horizontal smear it merged with the ion tail and the comet read as one streak.
            vec3 dust = normalize(side * 0.995 + upT * 0.1);
            vec3 bend = normalize(upT - dust * dot(upT, dust));
            float da = dot(rel, dust);
            if (front > 0.0 && da > 0.0 && da < 1.02) {
              float w = 0.02 + da * 0.27;
              float dx = length(rel - dust * da + bend * da * da * 0.6) / w;
              float fall = pow(1.0 - da / 1.02, 1.2) * smoothstep(0.0, 0.03, da);
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

    this.massif = new Massif(seed, this.sea);
    this.root.add(this.massif.root, this.mist.mesh);
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
    u.uCloudLow.value = p.clouds.low;
    u.uCloudHigh.value = this.wisps ? p.clouds.high : 0;
    u.uCloudTop.value = p.clouds.top;
    u.uCloudLit.value.copy(p.clouds.lit);
    u.uCloudShade.value.copy(p.clouds.shade);
    u.uCloudRim.value.copy(p.clouds.rim);
    this.highClouds = p.clouds.high;
    // Rays only from a sun (a moon's fought the aurora and the comet), and only while it is low.
    u.uRays.value = p.moon ? 0 : p.atmo.rays * (1 - Math.max(0, Math.min(1, (p.diskDir.y - 0.3) / 0.25)));
    u.uHalo.value = p.atmo.halo;
    u.uMeteors.value = p.atmo.meteors;
    this.massif.setPalette(p);
    this.mist.setPalette(p);
  }

  /** Cloud and panorama detail by quality tier: Low keeps the horizon banks at two octaves, drops the
   *  high wisps and the sea of clouds' fine octave (no extra pass on any tier: the clouds are part of
   *  the dome's own shader), and draws one coarse range (massif.ts). */
  setDetail(tier: 'low' | 'medium' | 'high'): void {
    const q = tier === 'low' ? 0 : 1;
    this.wisps = q > 0;
    this.domeMat.uniforms.uCloudHigh.value = this.wisps ? this.highClouds : 0;
    if (this.domeMat.defines.CLOUD_Q !== q) {
      this.domeMat.defines.CLOUD_Q = q;
      this.domeMat.defines.SEA_Q = q;
      this.domeMat.needsUpdate = true;
    }
    this.massif.setDetail(tier);
    this.mist.setDetail(tier);
  }

  follow(cam: Vector3): void {
    this.root.position.set(cam.x, cam.y, cam.z);
  }
}

/** The valley mist's rings: three stacked layers (metres below the course's floor, and how much each
 *  carries), so where a slope or a range's foot cuts through them the mist thins out over a height
 *  rather than ending on one line. */
const MIST_LAYERS = [
  { depth: 190, k: 0.55 },
  { depth: 225, k: 0.8 },
  { depth: 262, k: 1 },
];
const MIST_SEG = 96;
const MIST_ROWS = 20;
/** The mist's reach round the lens (metres): it rises out of the snow's own haze, then runs on past
 *  the mid-ground's end and into the feet of the nearest ranges before melting into the far haze. */
const MIST_R0 = 140;
const MIST_R1 = 2300;

function mistGeometry(): BufferGeometry {
  const verts = MIST_LAYERS.length * (MIST_SEG + 1) * (MIST_ROWS + 1);
  const pos = new Float32Array(verts * 3);
  const idx = new Uint16Array(MIST_LAYERS.length * MIST_SEG * MIST_ROWS * 6);
  let v = 0;
  let k = 0;
  // Farthest layer first (it is the lowest), so the nearer, higher sheets draw over it.
  for (let l = MIST_LAYERS.length - 1; l >= 0; l--) {
    const start = v;
    for (let j = 0; j <= MIST_ROWS; j++) {
      const r = MIST_R0 + (MIST_R1 - MIST_R0) * Math.pow(j / MIST_ROWS, 1.6);
      for (let i = 0; i <= MIST_SEG; i++) {
        const a = (i / MIST_SEG) * Math.PI * 2;
        pos[v * 3] = Math.sin(a) * r;
        pos[v * 3 + 1] = l;
        pos[v * 3 + 2] = -Math.cos(a) * r;
        v++;
      }
    }
    const w = MIST_SEG + 1;
    for (let j = 0; j < MIST_ROWS; j++) {
      for (let i = 0; i < MIST_SEG; i++) {
        const a = start + j * w + i;
        idx[k++] = a;
        idx[k++] = a + 1;
        idx[k++] = a + w;
        idx[k++] = a + 1;
        idx[k++] = a + w + 1;
        idx[k++] = a + w;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

/**
 * Valley mist (Medium and High, one draw): sheets of drifting cloud lying in the valleys a couple of
 * hundred metres below the run, following the course's floor down the mountain (shared.uFogFloor), so
 * the slopes, the villages and the nearest ranges' feet rise out of it in layers and the depth of the
 * world reads in steps. It is world-anchored (its banks drift on the wind, not with the lens), gapped so
 * the valley floor shows through, lit on its tops and warmer toward the sun, and it melts into the
 * haze at both ends. Depth-tested and drawn first among the see-through things, so the near world, the
 * weather and the ghosts all stand in front of it.
 */
export class ValleyMist {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;
  private on = true;
  private amount = 0;

  constructor() {
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTime: shared.uTime,
        uFogFloor: shared.uFogFloor,
        uSunDir: shared.uDiskDir,
        uSunColor: shared.uSunColor,
        uFog: shared.uFog,
        uLit: { value: new Color() },
        uShade: { value: new Color() },
        uHaze: { value: new Color() },
        uAmount: { value: 0 },
        uDepth: { value: new Vector3(MIST_LAYERS[0].depth, MIST_LAYERS[1].depth, MIST_LAYERS[2].depth) },
      },
      vertexShader: /* glsl */ `
        uniform vec2 uFogFloor;
        uniform vec3 uDepth;
        varying vec3 vWorld;
        varying float vLayer;
        varying float vR;
        void main() {
          vec4 wp = modelMatrix * vec4(position.x, 0.0, position.z, 1.0);
          vLayer = position.y;
          float depth = position.y < 0.5 ? uDepth.x : position.y < 1.5 ? uDepth.y : uDepth.z;
          // The course's floor, fitted over the stretch ahead, followed down past the lens.
          wp.y = uFogFloor.x + uFogFloor.y * wp.z - depth;
          vWorld = wp.xyz;
          vR = length(position.xz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uLit;
        uniform vec3 uShade;
        uniform vec3 uHaze;
        uniform float uAmount;
        varying vec3 vWorld;
        varying float vLayer;
        varying float vR;
        ${NOISE}
        void main() {
          // Banks a few hundred metres across, drifting slowly on the wind and changing as they go,
          // each sheet with its own pattern so the gaps never line up.
          vec2 p = vWorld.xz * 0.0024 + vec2(uTime * 0.006, uTime * 0.0022) + vLayer * 7.3;
          float n = snoise(p) * 0.6 + snoise(p * 2.3 + vec2(3.1, -uTime * 0.004)) * 0.28 + snoise(p * 5.9 + 1.7) * 0.12;
          float dens = smoothstep(-0.25, 0.55, n);
          float a = dens * (0.18 + 0.1 * vLayer) * uAmount;
          // Rises out of the snow's haze close in, and melts into the far haze past the nearest ranges.
          a *= smoothstep(${MIST_R0.toFixed(1)}, ${(MIST_R0 + 260).toFixed(1)}, vR) * (1.0 - smoothstep(${(MIST_R1 - 700).toFixed(1)}, ${MIST_R1.toFixed(1)}, vR));
          if (a < 0.004) discard;
          // Lit tops (the densest parts of the top sheet) and cooler, shaded thin edges; toward the sun
          // the mist glows with its warmth.
          vec3 col = mix(uShade, uLit, smoothstep(0.25, 0.85, dens) * (0.55 + 0.2 * vLayer));
          vec3 vd = normalize(vWorld - cameraPosition);
          float fwd = pow(max(dot(vd, normalize(uSunDir)), 0.0), 3.0);
          col = mix(col, max(col, uSunColor * 0.95), fwd * 0.45);
          col = mix(col, uHaze, smoothstep(500.0, ${MIST_R1.toFixed(1)}, vR) * 0.6);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.mesh = new Mesh(mistGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    // First among the see-through things (the weather, the ghosts and the life all draw over it).
    this.mesh.renderOrder = -5;
  }

  setPalette(p: Palette): void {
    const u = this.mat.uniforms;
    this.amount = p.atmo.valley * (1 - p.massif.veil);
    u.uAmount.value = this.amount;
    (u.uLit.value as Color).copy(p.atmo.valleyColor).lerp(p.snowLit, 0.15);
    (u.uShade.value as Color).copy(p.atmo.valleyColor).lerp(p.snowShade, 0.45).lerp(p.fog, 0.2);
    (u.uHaze.value as Color).copy(p.fog).lerp(p.skyHorizon, 0.5);
    this.mesh.visible = this.on && this.amount > 0.01;
  }

  setDetail(tier: 'low' | 'medium' | 'high'): void {
    this.on = tier !== 'low';
    this.mesh.visible = this.on && this.amount > 0.01;
  }
}
