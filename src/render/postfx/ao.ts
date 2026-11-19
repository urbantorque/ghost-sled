import { NearestFilter, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderTarget, type Camera } from 'three';
import { shared } from '../materials';
import { DEPTH_GLSL, depthUniforms } from './depth';
import { QUAD_VERT, type Quad } from './quad';
import type { PassSettings } from './tiers';

// Ambient occlusion and contact shadows from the frame's depth (ART.md 2: everything sits on the
// ground). One pass at half the frame finds, for each pixel, how much of the sky's half-dome the
// geometry round it hides (a horizon search in a few screen directions, the GTAO integral), and on Ultra
// also marches a short ray toward the sun for the shadow a foot, a runner or a trunk throws where the
// shadow map's texels are too coarse. A second pass blurs both across the 4x4 tile the noise repeats
// in, never across a depth edge. The composite lays the result on as a tint toward the mood's own
// shade (the snow's shade over its lit colour), never as grey, and never on the sky, on the far planes
// the fog owns, or on anything brighter than lit snow (a lamp, a window, a glint).
//
// Normals come from the depth itself (the nearer of each pair of neighbours), which costs four taps and
// no second scene pass. The world's surfaces are flat-shaded planes and smooth snow: a depth normal is
// exactly their geometric normal.
//
// Target: RGBA8 at half the frame. r occlusion (1 open), g contact (1 lit), ba the pixel's depth key
// for the filters downstream.

const AO_FRAG = /* glsl */ `
  precision highp float;
  ${DEPTH_GLSL}
  // x the radius at the lens (m), y how it grows with distance (m per m), z the widest radius on
  // screen (share of the frame's height), w the power the visibility is raised to.
  uniform vec4 uAOShape;
  // x, y where the effect fades out (m), z the contact ray's strength (0 off).
  uniform vec3 uAOFade;
  uniform vec3 uLightV;
  varying vec2 vUv;

  // An ordered 4x4 tile: sixteen evenly spread values (0, 1/16 .. 15/16), which the blur's 4x4 box
  // then averages exactly.
  float tile2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float tile(vec2 p) { return tile2(0.5 * p) * 0.25 + tile2(p); }
  // Depth taps land on texel centres: on snow seen at a grazing angle a fraction of a texel is metres.
  vec2 snap(vec2 uv) { return (floor(uv / uDepthTexel) + 0.5) * uDepthTexel; }
  vec3 posAt(vec2 uv) { vec2 s = snap(uv); return viewPos(s, depthAt(s)); }
  float facos(float x) {
    float a = abs(x);
    float r = (-0.156583 * a + 1.570796) * sqrt(1.0 - a);
    return x >= 0.0 ? r : 3.14159265 - r;
  }

  void main() {
    vec2 uv = snap(vUv);
    float raw = texture2D(tDepth, uv).r;
    float lin = linDepth(raw);
    float key = depthKey(lin);
    if (raw >= 1.0 || lin >= uAOFade.y) {
      gl_FragColor = vec4(1.0, 1.0, packKey(key));
      return;
    }
    vec3 P = viewPos(uv, lin);
    // The geometric normal, from whichever neighbour on each axis lies on this pixel's own surface.
    vec2 dx = vec2(uDepthTexel.x, 0.0);
    vec2 dy = vec2(0.0, uDepthTexel.y);
    vec3 pl = viewPos(uv - dx, depthAt(uv - dx));
    vec3 pr = viewPos(uv + dx, depthAt(uv + dx));
    vec3 pb = viewPos(uv - dy, depthAt(uv - dy));
    vec3 pt = viewPos(uv + dy, depthAt(uv + dy));
    vec3 ex = abs(pl.z - P.z) < abs(pr.z - P.z) ? P - pl : pr - P;
    vec3 ey = abs(pb.z - P.z) < abs(pt.z - P.z) ? P - pb : pt - P;
    vec3 N = normalize(cross(ex, ey));
    // A sliver (a wire, a rope, a flag's pole: nothing of its own on either side of it) has no normal
    // to speak of and nothing to sit on. It is left alone.
    float sliver = min(abs(pl.z - P.z), abs(pr.z - P.z)) + min(abs(pb.z - P.z), abs(pt.z - P.z));
    if (sliver > 0.04 + lin * 0.02) {
      gl_FragColor = vec4(1.0, 1.0, packKey(key));
      return;
    }
    vec3 V = normalize(-P);
    if (dot(N, V) < 0.0) N = -N;
    // Lift the origin off its own surface: the depth's last bit must not read as an occluder.
    P += N * (0.012 + lin * 0.0012);

    float radius = uAOShape.x + lin * uAOShape.y;
    // The radius on screen, in uv (y); under about a texel and a half there is nothing to find.
    float rv = min(radius * uProjScale.y * 0.5 / lin, uAOShape.z);
    float px = rv / uDepthTexel.y;
    float fade = smoothstep(1.2, 3.0, px) * (1.0 - smoothstep(uAOFade.x, uAOFade.y, lin));
    float vis = 1.0;
    if (fade > 0.0) {
      // What the clamp took off the screen radius comes off the world radius too.
      radius = rv * lin / (uProjScale.y * 0.5);
      float fallRange = 0.615 * radius;
      float fallMul = -1.0 / fallRange;
      float fallAdd = (radius - fallRange) / fallRange + 1.0;
      float n0 = tile(gl_FragCoord.xy);
      // (The same sixteen in another order, so a slice's angle and its steps do not move together.)
      float n1 = fract(n0 * 5.0 + 0.03125);
      float sum = 0.0;
      for (int s = 0; s < SLICES; s++) {
        float phi = (float(s) + n0) * (3.14159265 / float(SLICES));
        vec2 om = vec2(cos(phi), sin(phi));
        vec3 dirV = vec3(om, 0.0);
        vec3 ortho = dirV - dot(dirV, V) * V;
        vec3 axis = normalize(cross(dirV, V));
        vec3 pn = N - axis * dot(N, axis);
        float pnLen = max(length(pn), 1e-4);
        float sgn = sign(dot(ortho, pn));
        float cosN = clamp(dot(pn, V) / pnLen, 0.0, 1.0);
        float n = sgn * facos(cosN);
        float low0 = cos(n + 1.5707963);
        float low1 = cos(n - 1.5707963);
        float h0 = low0;
        float h1 = low1;
        // (The frame is not square: a step in uv is shorter across than up.)
        vec2 stepUv = om * rv * vec2(uProjScale.x / uProjScale.y, 1.0);
        for (int j = 0; j < STEPS; j++) {
          float t = (float(j) + n1) / float(STEPS);
          t = t * t + 1.5 / px;
          vec2 off = stepUv * t;
          vec3 d0 = posAt(uv + off) - P;
          vec3 d1 = posAt(uv - off) - P;
          float l0 = length(d0);
          float l1 = length(d1);
          float w0 = clamp(l0 * fallMul + fallAdd, 0.0, 1.0);
          float w1 = clamp(l1 * fallMul + fallAdd, 0.0, 1.0);
          h0 = max(h0, mix(low0, dot(d0 / max(l0, 1e-4), V), w0));
          h1 = max(h1, mix(low1, dot(d1 / max(l1, 1e-4), V), w1));
        }
        float a0 = n + clamp(-facos(h1) - n, -1.5707963, 1.5707963);
        float a1 = n + clamp(facos(h0) - n, -1.5707963, 1.5707963);
        float sinN = sin(n);
        float arc = (cosN + 2.0 * a0 * sinN - cos(2.0 * a0 - n)) * 0.25 + (cosN + 2.0 * a1 * sinN - cos(2.0 * a1 - n)) * 0.25;
        sum += pnLen * arc;
      }
      vis = clamp(sum / float(SLICES), 0.0, 1.0);
      // The snow's mesh is rows of flat facets under a smooth painted normal: the shallow crease
      // between two rows is not a place to draw a line, so the first few percent count for nothing.
      vis = 1.0 - max(0.0, 1.0 - vis - 0.05) / 0.95;
      vis = mix(1.0, pow(vis, uAOShape.w), fade);
    }
    float lit = 1.0;
    #ifdef CONTACT
    // A short ray toward the sun: what stands in it within reach throws a contact shadow here. Only on
    // a surface that faces the light (the rest is in its own shade already).
    float facing = dot(N, uLightV);
    if (uAOFade.z > 0.0 && facing > 0.02 && fade > 0.0) {
      float reach = clamp(lin * 0.045, 0.3, 1.5);
      float jit = fract(tile(gl_FragCoord.xy) * 7.0 + 0.03125);
      float hit = 0.0;
      for (int i = 0; i < 8; i++) {
        float t = (float(i) + jit) / 8.0;
        vec3 S = P + uLightV * (reach * t + 0.03);
        vec2 suv = viewToUv(S);
        if (suv.x <= 0.0 || suv.x >= 1.0 || suv.y <= 0.0 || suv.y >= 1.0) break;
        float behind = -S.z - depthAt(snap(suv));
        // Behind what the lens sees there, by less than a body's thickness: something is in the way.
        if (behind > 0.03 + lin * 0.002 && behind < 0.25 + reach * 0.6) hit = max(hit, 1.0 - t * t);
      }
      lit = 1.0 - hit * smoothstep(0.02, 0.25, facing) * fade * uAOFade.z;
    }
    #endif
    gl_FragColor = vec4(vis, lit, packKey(key));
  }
`;

const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tAO;
  uniform vec2 uAOTexel;
  varying vec2 vUv;
  float unpackKey(vec2 p) { return p.x + p.y / 255.0; }
  void main() {
    vec4 c = texture2D(tAO, vUv);
    float key = unpackKey(c.ba);
    vec2 acc = vec2(0.0);
    float wsum = 0.0;
    // The 4x4 box the noise tiles in. A tap across a depth edge (more than about 3% nearer or further)
    // is left out, so the occlusion under a trunk never bleeds onto the trunk.
    for (int y = 0; y < 4; y++) {
      for (int x = 0; x < 4; x++) {
        vec4 s = texture2D(tAO, vUv + (vec2(float(x), float(y)) - 1.5) * uAOTexel);
        float w = max(0.0, 1.0 - abs(unpackKey(s.ba) - key) * 380.0);
        acc += s.rg * w;
        wsum += w;
      }
    }
    gl_FragColor = vec4(wsum > 0.0 ? acc / wsum : c.rg, c.ba);
  }
`;

/** The composite's side: the uniforms post.ts spreads into its own, and the function its shader calls.
 *  tDepth and uDepthNF are the shared depth's (depth.ts). */
export const aoComposite = {
  tAO: { value: null as unknown },
  /** x the occlusion's strength, y the contact shadow's (both 0: the pass is off and the function
   *  returns at once), zw the half-frame's texel. */
  uAO: { value: new Vector4(0, 0, 1, 1) },
  /** What full occlusion multiplies a colour by: the mood's shade over its lit snow. */
  uAOTint: { value: new Vector3(0.6, 0.68, 0.92) },
  /** The crease light (the visual lift, the light lane): x how much light a convex edge catches, y how
   *  dark an inner crease goes (both 0: off), z and w the metres it fades out over. */
  uCrease: { value: new Vector4(0, 0, 35, 60) },
  /** The key light's colour, at full value, and its direction in view space. */
  uCreaseC: { value: new Vector3(1, 1, 1) },
  uCreaseV: { value: new Vector3(0, 1, 0) },
  /** The rider in view space (xyz, its middle) and the reach round it that takes no crease (w, metres). */
  uCreaseHero: { value: new Vector4(0, 0, 1e6, 0) },
};

export const AO_COMPOSITE_GLSL = /* glsl */ `
  uniform sampler2D tAO;
  uniform vec4 uAO;
  uniform vec3 uAOTint;
  uniform vec4 uCrease;
  uniform vec3 uCreaseC;
  uniform vec3 uCreaseV;
  uniform vec4 uCreaseHero;
  // The crease light (the visual lift, the light lane), from the frame's own depth at full resolution:
  // near the lens a convex edge catches a hairline of the key light's colour and an inner crease darkens
  // toward the shade, so a low-poly prop reads hand-bevelled rather than as a box. Found from how the
  // surface turns along each axis: the chords between neighbouring pixels run the same way on a plane
  // and turn at a fold, toward the lens at an edge and away from it at a crease. The outer chords (two
  // pixels out) give the fold's whole turn, which holds along an edge; the inner ones the part of it at
  // this pixel, so a fold between two pixels is shared by both by where it falls and the line is a
  // hairline that does not stair-step. A step in depth (an outline, a gap behind a rail) is no fold and
  // draws nothing, and neither do the rider and its sled (the reach round uCreaseHero), the sky or a
  // light (keep).
  // x: the part of the fold at this pixel, y: its whole turn (about 2 sin of half the angle: 0 on a
  // plane, 1.41 at a box's edge, under 0.4 between the snow's facets), both < 0 at an edge; 0 at a step.
  vec2 creaseAxis(vec2 uv, vec3 P, vec3 m1, vec3 p1, vec2 d, vec3 N, float lin) {
    vec3 m2 = viewPos(uv - 2.0 * d, depthAt(uv - 2.0 * d));
    vec3 p2 = viewPos(uv + 2.0 * d, depthAt(uv + 2.0 * d));
    float lim = 0.07 * lin + 0.04;
    if (max(max(abs(m1.z - P.z), abs(p1.z - P.z)), max(abs(m2.z - m1.z), abs(p2.z - p1.z))) > lim) return vec2(0.0);
    vec3 a = normalize(m1 - m2);
    vec3 b = normalize(P - m1);
    vec3 c = normalize(p1 - P);
    vec3 e = normalize(p2 - p1);
    return vec2(dot(c - b, N), dot(e - a, N));
  }
  vec3 pipeCrease(vec3 col, vec2 uv, float lin, float keep) {
    if (uCrease.x + uCrease.y <= 0.0 || lin >= uCrease.w || keep <= 0.0) return col;
    // (Two pixels in from the frame's edge the outer taps would read the edge's own depth again, a fold
    // that is not there: the second critic found a hairline along the bottom of every High frame.)
    vec2 inFrame = min(uv, 1.0 - uv) / uDepthTexel;
    if (min(inFrame.x, inFrame.y) < 2.5) return col;
    vec3 P = viewPos(uv, lin);
    float hero = smoothstep(uCreaseHero.w, uCreaseHero.w * 1.3, length((P - uCreaseHero.xyz) * vec3(1.0, 0.8, 1.0)));
    if (hero <= 0.0) return col;
    vec2 dx = vec2(uDepthTexel.x, 0.0);
    vec2 dy = vec2(0.0, uDepthTexel.y);
    // The surface's normal toward the lens, across the pixel (at a fold, the bevel's).
    vec3 l = viewPos(uv - dx, depthAt(uv - dx));
    vec3 r = viewPos(uv + dx, depthAt(uv + dx));
    vec3 b = viewPos(uv - dy, depthAt(uv - dy));
    vec3 t = viewPos(uv + dy, depthAt(uv + dy));
    vec3 N = normalize(cross(r - l, t - b));
    N = dot(N, P) > 0.0 ? -N : N;
    vec2 fx = creaseAxis(uv, P, l, r, dx, N, lin);
    vec2 fy = creaseAxis(uv, P, b, t, dy, N, lin);
    float sx = fx.x * fx.y > 0.0 ? clamp(fx.x / fx.y, 0.0, 1.0) : 0.0;
    float sy = fy.x * fy.y > 0.0 ? clamp(fy.x / fy.y, 0.0, 1.0) : 0.0;
    float fade = (1.0 - smoothstep(uCrease.z, uCrease.w, lin)) * hero * keep;
    // (A crease asks for a sharper fold than an edge: beside a near edge a shallow one rang light, dark,
    // light at two pixels.)
    float edge = max(sx * smoothstep(0.5, 1.0, -fx.y), sy * smoothstep(0.5, 1.0, -fy.y)) * fade;
    float crease = max(sx * smoothstep(0.75, 1.2, fx.y), sy * smoothstep(0.75, 1.2, fy.y)) * fade;
    // The edge's bevel takes the key where it turns toward the light, a breath of it where it does not;
    // the surface's own colour lifted toward the light's (a dark face too), never a white outline.
    float toL = smoothstep(-0.25, 0.55, dot(N, uCreaseV));
    col += (col * 0.6 + 0.045) * uCreaseC * (edge * uCrease.x * (0.25 + 0.75 * toL));
    return col * mix(vec3(1.0), uAOTint, crease * uCrease.y);
  }
  // The half-frame occlusion laid on a full-frame colour: its four nearest texels, each weighed by how
  // close its depth is to this pixel's, so a rider's outline stays clean against the snow behind it.
  vec3 pipeAO(vec3 col, vec2 uv) {
    if (uAO.x + uAO.y <= 0.0) return col;
    float raw = texture2D(tDepth, uv).r;
    if (raw >= 1.0) return col;
    float lin = linDepth(raw);
    float key = depthKey(lin);
    vec2 p = uv / uAO.zw - 0.5;
    vec2 f = fract(p);
    vec2 b = (floor(p) + 0.5) * uAO.zw;
    vec4 s00 = texture2D(tAO, b);
    vec4 s10 = texture2D(tAO, b + vec2(uAO.z, 0.0));
    vec4 s01 = texture2D(tAO, b + vec2(0.0, uAO.w));
    vec4 s11 = texture2D(tAO, b + uAO.zw);
    vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
    vec4 keys = vec4(unpackKey(s00.ba), unpackKey(s10.ba), unpackKey(s01.ba), unpackKey(s11.ba));
    w *= max(vec4(0.002), 1.0 - abs(keys - key) * 380.0);
    float ws = w.x + w.y + w.z + w.w;
    vec2 ao = (s00.rg * w.x + s10.rg * w.y + s01.rg * w.z + s11.rg * w.w) / ws;
    // Never on a light: anything brighter than lit snow keeps its value.
    float keep = 1.0 - smoothstep(0.95, 1.45, dot(col, vec3(0.2126, 0.7152, 0.0722)));
    float k = clamp((1.0 - ao.x) * uAO.x + (1.0 - ao.y) * uAO.y, 0.0, 1.0) * keep;
    return pipeCrease(col * mix(vec3(1.0), uAOTint, k), uv, lin, keep);
  }
`;

const lightProbe = new Vector3();
const creaseProbe = new Vector3();
const creaseWhite = new Vector3(1, 1, 1);

export class AOPass {
  private raw: WebGLRenderTarget;
  private blurred: WebGLRenderTarget;
  private mat: ShaderMaterial;
  private blur: ShaderMaterial;
  private mode: PassSettings['ao'] = 'off';
  private contact = false;
  /** How dark full occlusion goes, and the contact shadow's share (the light lane may tune both). */
  strength = 0.8;
  contactStrength = 0.5;
  /** The crease light (the visual lift): 1 as tuned, 0 off. creaseEdge is how much light a convex edge
   *  catches, creaseDark how dark an inner crease goes. */
  crease = 1;
  creaseEdge = 1.3;
  creaseDark = 0.35;

  constructor(private quad: Quad) {
    const opts = { format: RGBAFormat, type: UnsignedByteType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
    this.raw = new WebGLRenderTarget(2, 2, opts);
    this.blurred = new WebGLRenderTarget(2, 2, opts);
    this.raw.texture.name = 'ao-raw';
    this.blurred.texture.name = 'ao';
    this.mat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: AO_FRAG,
      defines: { SLICES: 1, STEPS: 2 },
      uniforms: {
        tDepth: depthUniforms.tDepth,
        uDepthNF: depthUniforms.uDepthNF,
        uProj: depthUniforms.uProj,
        uProjScale: depthUniforms.uProjScale,
        uDepthTexel: depthUniforms.uDepthTexel,
        uAOShape: { value: new Vector4(1.1, 0.014, 0.16, 1.6) },
        uAOFade: { value: new Vector3(60, 160, 1) },
        uLightV: { value: new Vector3(0, 1, 0) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.blur = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tAO: { value: this.raw.texture }, uAOTexel: { value: new Vector2(1, 1) } },
      depthTest: false,
      depthWrite: false,
    });
  }

  /** The tier's variant: 'lite' is one slice of two steps a pixel (four depth taps and the normal's
   *  four), 'gtao' three slices of three (eighteen), with the contact ray's eight where asked. */
  configure(mode: PassSettings['ao'], contact: boolean): void {
    if (mode === this.mode && contact === this.contact) return;
    this.mode = mode;
    this.contact = contact;
    const d: Record<string, number | string> = { SLICES: mode === 'gtao' ? 3 : 1, STEPS: mode === 'gtao' ? 3 : 2 };
    if (contact) d.CONTACT = '';
    this.mat.defines = d;
    this.mat.needsUpdate = true;
    if (mode !== 'off') this.quad.compile(this.mat, this.raw);
    if (mode !== 'off') this.quad.compile(this.blur, this.blurred);
  }

  /** w, h: the frame's own size in pixels; the pass works at half of it. */
  setSize(w: number, h: number): void {
    const hw = Math.max(1, Math.ceil(w / 2));
    const hh = Math.max(1, Math.ceil(h / 2));
    this.raw.setSize(hw, hh);
    this.blurred.setSize(hw, hh);
    this.blur.uniforms.uAOTexel.value.set(1 / hw, 1 / hh);
    aoComposite.uAO.value.z = 1 / hw;
    aoComposite.uAO.value.w = 1 / hh;
  }

  /** Draws the occlusion for this frame's depth and points the composite at it. `lightDir` is the
   *  world direction to the light that casts the shadows; `contact` whether its ray is marched. */
  render(camera: Camera, lightDir: Vector3, contact: boolean): void {
    const u = this.mat.uniforms;
    // The effect dies away before the fog takes the picture: a far plane is the air's, not the ground's.
    const far = Math.max(70, Math.min(190, shared.uFogFar.value * 0.5));
    // A night mood's shadows are faint (shared.uShadowK), and so is what stands in the moon's way.
    u.uAOFade.value.set(far * 0.45, far, contact ? Math.min(1, shared.uShadowK.value) * (0.35 + 0.65 * shared.uDayK.value) : 0);
    u.uLightV.value.copy(lightProbe.copy(lightDir).transformDirection(camera.matrixWorldInverse));
    this.quad.draw(this.mat, this.raw);
    this.quad.draw(this.blur, this.blurred);
    const c = aoComposite;
    c.tAO.value = this.blurred.texture;
    c.uAO.value.x = this.strength;
    c.uAO.value.y = contact ? this.contactStrength : 0;
    // Toward the shade's cool colour, never grey: fully occluded lit snow becomes the mood's shaded
    // snow. Held inside a band so a night mood's near-equal pair still darkens and a harsh one never
    // goes to ink.
    const lit = shared.uSnowLit.value;
    const sh = shared.uSnowShade.value;
    const r = sh.r / Math.max(lit.r, 0.05);
    const g = sh.g / Math.max(lit.g, 0.05);
    const b = sh.b / Math.max(lit.b, 0.05);
    const m = Math.max(r, g, b, 1e-3);
    // Scale the ratio so its brightest channel sits at 0.78 at most: the hue of the shade, a set depth.
    const k = Math.min(1, 0.78 / m);
    c.uAOTint.value.set(Math.max(0.3, r * k), Math.max(0.3, g * k), Math.max(0.3, b * k));
    this.aimCrease(camera, far);
  }

  /** The crease light's uniforms for this frame (the visual lift, the light lane): the key's colour and
   *  direction in view space, the rider's place, and how far out it reaches (to about 60 m, nearer when
   *  the fog closes in). */
  private aimCrease(camera: Camera, far: number): void {
    const c = aoComposite;
    const reach = Math.min(60, far * 0.55);
    c.uCrease.value.set(this.creaseEdge * this.crease, this.creaseDark * this.crease, reach * 0.55, reach);
    const s = shared.uSunColor.value;
    const top = Math.max(s.r, s.g, s.b, 1e-3);
    c.uCreaseC.value.set(s.r / top, s.g / top, s.b / top).lerp(creaseWhite, 0.3);
    c.uCreaseV.value.copy(shared.uSunDir.value).transformDirection(camera.matrixWorldInverse);
    creaseProbe.copy(shared.uFocus.value).applyMatrix4(camera.matrixWorldInverse);
    c.uCreaseHero.value.set(creaseProbe.x, creaseProbe.y, creaseProbe.z, 1.5);
  }

  /** The pass is off this frame: the composite's function returns at once. */
  rest(): void {
    aoComposite.uAO.value.x = 0;
    aoComposite.uAO.value.y = 0;
    aoComposite.uCrease.value.x = 0;
    aoComposite.uCrease.value.y = 0;
  }

  get texture() {
    return this.blurred.texture;
  }

  dispose(): void {
    this.raw.dispose();
    this.blurred.dispose();
    this.mat.dispose();
    this.blur.dispose();
  }
}
