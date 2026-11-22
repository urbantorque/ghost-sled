import { Color, LinearFilter, RedFormat, ShaderMaterial, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderTarget, type PerspectiveCamera, type Texture } from 'three';
import { DEPTH_GLSL, depthUniforms } from './depth';
import { QUAD_VERT, type Quad } from './quad';

// Light shafts cut by the world's depth (ART.md 15: light you can see). Round 6's shafts were a fan of
// taps from the sun through the picture's brightness, drawn in the composite. These are marched: for
// every pixel, how much of the way from it to the light is open sky, read from the depth, so a trunk, a
// tower, a torii post or a cavern's wall stands in the light and throws a bar of shade through the air
// toward the lens, and the gaps between them throw bars of light.
//
// Two passes of a zoom blur at a fraction of the frame. The first asks, at each of TAPS points along
// the first stretch toward the light, whether the lens sees past the light's own distance there (the
// sky, for the sun) and whether what it sees is bright. The second spreads that along the whole way.
// TAPS in each is TAPS squared along the ray. The composite adds the result as light in the air: by the
// depth again, there is more lit air in front of a far ridge than in front of the rider.
//
// Two sources at most a frame:
//  - the sun (or the moon, or any disc the mood names), which post.ts aims as it always did from
//    GradeParams.shafts and the disc's direction, so the light lane's moods and journeys drive it
//    unchanged;
//  - one bright place in the world: a cavern mouth at dawn, a gate, a gap between two walls. Any world
//    system offers one with pushShaftSource() each frame it is in play; the strongest in view is kept.

/** The place source's contract (the names are fixed; the light lane and the set pieces write here). */
export interface ShaftPlace {
  /** Sources offered this frame. */
  pushed: number;
  /** The one kept: 0 when none. */
  strength: number;
  pos: Vector3;
  color: Color;
  /** The opening's radius, metres: taps that see further than the place (less this) are open. */
  radius: number;
}

export const shaftPlace: ShaftPlace = { pushed: 0, strength: 0, pos: new Vector3(), color: new Color(1, 1, 1), radius: 4 };

/** Start a frame: forget last frame's place (world.ts calls it before the world's systems update). */
export function beginShaftSources(): void {
  shaftPlace.pushed = 0;
  shaftPlace.strength = 0;
}

/** Offer a bright place that throws shafts: its middle in world space, its linear colour, a strength
 *  (1 is a low sun's) and the opening's radius in metres. The strongest offered this frame is kept. */
export function pushShaftSource(x: number, y: number, z: number, r: number, g: number, b: number, strength: number, radius = 4): void {
  const s = shaftPlace;
  s.pushed++;
  if (strength <= s.strength) return;
  s.strength = strength;
  s.pos.set(x, y, z);
  s.color.setRGB(r, g, b);
  s.radius = radius;
}

const MARCH_FRAG = /* glsl */ `
  precision highp float;
  ${DEPTH_GLSL}
  uniform sampler2D tScene;
  // xy the light on screen (uv), z its distance from the lens in metres (0: the sky), w the share of
  // the way to it this pass covers.
  uniform vec4 uSrc;
  // The brightness that counts as light (from, to), in the scene's linear values.
  uniform vec2 uLum;
  varying vec2 vUv;
  float open(vec2 uv) {
    uv = clamp(uv, vec2(0.001), vec2(0.999));
    float raw = texture2D(tDepth, uv).r;
    float past = uSrc.z <= 0.0 ? step(1.0, raw) : step(uSrc.z, linDepth(raw));
    if (past <= 0.0) return 0.0;
    return smoothstep(uLum.x, uLum.y, dot(texture2D(tScene, uv).rgb, vec3(0.2126, 0.7152, 0.0722)));
  }
  void main() {
    vec2 toS = (uSrc.xy - vUv) * (uSrc.w / float(TAPS));
    float acc = 0.0;
    for (int i = 0; i < TAPS; i++) acc += open(vUv + toS * (float(i) + 0.5));
    gl_FragColor = vec4(acc / float(TAPS));
  }
`;

const SPREAD_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec4 uSrc;
  varying vec2 vUv;
  void main() {
    vec2 toS = (uSrc.xy - vUv) * (uSrc.w / float(TAPS));
    float acc = 0.0;
    for (int i = 0; i < TAPS; i++) acc += texture2D(tSrc, clamp(vUv + toS * float(i), vec2(0.001), vec2(0.999))).r;
    gl_FragColor = vec4(acc / float(TAPS));
  }
`;

/** The composite's side. uShaftSun and uShaftPlace: xy the light on screen, z its strength (0: off),
 *  w its distance in metres (0: the sky). */
export const shaftComposite = {
  tShaftSun: { value: null as Texture | null },
  tShaftPlace: { value: null as Texture | null },
  uShaftSun: { value: new Vector4(0.5, 0.8, 0, 0) },
  uShaftPlace: { value: new Vector4(0.5, 0.5, 0, 0) },
  uShaftPlaceColor: { value: new Color(1, 1, 1) },
  /** Metres of air that take up most of a shaft's light: nearer surfaces show less of it. */
  uShaftAir: { value: 42 },
};

/** Spliced into the composite after its noise functions (it uses vnoise, uAspect and uTime). */
export const SHAFT_COMPOSITE_GLSL = /* glsl */ `
  uniform sampler2D tShaftSun;
  uniform sampler2D tShaftPlace;
  uniform vec4 uShaftSun;
  uniform vec4 uShaftPlace;
  uniform vec3 uShaftPlaceColor;
  uniform float uShaftAir;
  // One source's light in the air at a pixel lin metres deep. The marched texture says how much of the
  // way to the light is open; a slow grain along the bearing keeps a wide open sky from reading as a
  // flat wash; the light falls away from its source across the frame.
  vec3 pipeShaft(sampler2D t, vec4 src, vec3 color, vec2 uv, float lin) {
    vec2 toS = src.xy - uv;
    float dS = length(toS * vec2(uAspect, 1.0));
    if (dS >= 1.05) return vec3(0.0);
    float acc = texture2D(t, uv).r;
    float ang = atan(toS.y, toS.x * uAspect);
    float grain = 0.4 + 0.6 * vnoise(vec2(ang * 11.0 + uTime * 0.03, 1.7)) * vnoise(vec2(ang * 23.0 + 4.0 - uTime * 0.05, 3.1)) * 2.0;
    float fall = (exp(-dS * 2.5) + 0.14 * exp(-dS * 0.9)) * (1.0 - smoothstep(0.7, 1.05, dS));
    // Lit air lies between the lens and what it sees, and (for a place) no further than the place.
    float reach = src.w > 0.0 ? min(lin, src.w) : lin;
    // (Round 8's review loop, Pinecrest: the first metres of air hold none of it, so a low sun ahead lays no fan of
    // white rays over the near ice and snow under the lens, ART.md 12: shafts hang in the air, never on the near snow.)
    float air = 1.0 - exp(-max(reach - 10.0, 0.0) / uShaftAir);
    return color * (acc * grain * fall * air * src.z);
  }
  vec3 pipeShafts(vec2 uv, vec3 sunColor) {
    if (uShaftSun.z + uShaftPlace.z <= 0.001) return vec3(0.0);
    float raw = texture2D(tDepth, uv).r;
    float lin = raw >= 1.0 ? 4000.0 : linDepth(raw);
    vec3 sum = vec3(0.0);
    if (uShaftSun.z > 0.001) sum += pipeShaft(tShaftSun, uShaftSun, mix(sunColor, vec3(1.0, 0.7, 0.4), 0.5), uv, lin) * 1.15;
    if (uShaftPlace.z > 0.001) sum += pipeShaft(tShaftPlace, uShaftPlace, uShaftPlaceColor, uv, lin) * 1.15;
    return sum;
  }
`;

const probe = new Vector3();

export class ShaftsPass {
  private rts: WebGLRenderTarget[] = [];
  private march: ShaderMaterial;
  private spread: ShaderMaterial;
  private taps = 0;
  private div = 4;
  private w = 2;
  private h = 2;

  constructor(private quad: Quad) {
    this.march = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: MARCH_FRAG,
      defines: { TAPS: 6 },
      uniforms: {
        tDepth: depthUniforms.tDepth,
        uDepthNF: depthUniforms.uDepthNF,
        tScene: { value: null },
        uSrc: { value: new Vector4() },
        uLum: { value: new Vector2(0.45, 1.3) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.spread = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: SPREAD_FRAG,
      defines: { TAPS: 6 },
      uniforms: { tSrc: { value: null }, uSrc: { value: new Vector4() } },
      depthTest: false,
      depthWrite: false,
    });
  }

  private target(i: number): WebGLRenderTarget {
    let t = this.rts[i];
    if (!t) {
      t = new WebGLRenderTarget(this.w, this.h, { format: RedFormat, type: UnsignedByteType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      t.texture.name = 'shafts-' + i;
      this.rts[i] = t;
    }
    return t;
  }

  /** Taps in each pass (0: off) and the frame's divisor. */
  configure(taps: number, div: number): void {
    if (taps === this.taps && div === this.div) return;
    const resize = div !== this.div;
    this.taps = taps;
    this.div = div;
    if (taps > 0) {
      this.march.defines = { TAPS: taps };
      this.spread.defines = { TAPS: taps };
      this.march.needsUpdate = this.spread.needsUpdate = true;
      this.quad.compile(this.march, this.target(0));
      this.quad.compile(this.spread, this.target(1));
    }
    if (resize) this.setSize(this.fw, this.fh);
  }

  private fw = 2;
  private fh = 2;

  setSize(w: number, h: number): void {
    this.fw = w;
    this.fh = h;
    this.w = Math.max(1, Math.ceil(w / this.div));
    this.h = Math.max(1, Math.ceil(h / this.div));
    for (const t of this.rts) t?.setSize(this.w, this.h);
  }

  private one(slot: number, scene: Texture, u: number, v: number, dist: number, lumFrom: number, lumTo: number): Texture {
    const a = this.target(slot * 2);
    const b = this.target(slot * 2 + 1);
    const m = this.march.uniforms;
    m.tScene.value = scene;
    // The first pass looks a quarter of the way to the light; the second carries that nine tenths of it.
    m.uSrc.value.set(u, v, dist, 0.25);
    m.uLum.value.set(lumFrom, lumTo);
    this.quad.draw(this.march, a);
    const s = this.spread.uniforms;
    s.tSrc.value = a.texture;
    s.uSrc.value.set(u, v, dist, 0.9);
    this.quad.draw(this.spread, b);
    return b.texture;
  }

  /**
   * Marches this frame's shafts and points the composite at them. `sunUv` and `sunK` are the sun's
   * place on screen and the shafts' strength there (post.ts aims them); the place source is read from
   * shaftPlace. Returns how many sources were marched.
   */
  render(scene: Texture, camera: PerspectiveCamera, sunUv: Vector2, sunK: number): number {
    const c = shaftComposite;
    let n = 0;
    if (sunK > 0.001) {
      c.tShaftSun.value = this.one(0, scene, sunUv.x, sunUv.y, 0, 0.45, 1.3);
      c.uShaftSun.value.set(sunUv.x, sunUv.y, sunK, 0);
      n++;
    } else c.uShaftSun.value.z = 0;
    const p = shaftPlace;
    let k = 0;
    let dist = 0;
    if (p.strength > 0.001) {
      // In front of the lens, and inside the frame or just off it.
      dist = -probe.copy(p.pos).applyMatrix4(camera.matrixWorldInverse).z;
      if (dist > 0.5) {
        probe.copy(p.pos).project(camera);
        const off = Math.max(Math.abs(probe.x), Math.abs(probe.y));
        k = p.strength * (1 - Math.max(0, Math.min(1, (off - 1) / 0.35)));
      }
    }
    if (k > 0.001) {
      const u = probe.x * 0.5 + 0.5;
      const v = probe.y * 0.5 + 0.5;
      const past = Math.max(0.5, dist - p.radius);
      // A place is bright against its own dark: a lower bar than the open sky's.
      c.tShaftPlace.value = this.one(1, scene, u, v, past, 0.25, 0.9);
      c.uShaftPlace.value.set(u, v, k, dist);
      c.uShaftPlaceColor.value.copy(p.color);
      n++;
    } else c.uShaftPlace.value.z = 0;
    return n;
  }

  /** No shafts this frame: the composite's function returns on its first line. */
  rest(): void {
    shaftComposite.uShaftSun.value.z = 0;
    shaftComposite.uShaftPlace.value.z = 0;
  }

  dispose(): void {
    for (const t of this.rts) t?.dispose();
    this.march.dispose();
    this.spread.dispose();
  }
}
