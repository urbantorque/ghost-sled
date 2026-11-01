import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  Vector4,
} from 'three';
import { Mood } from '../sim/chaos';
import { CHUNK_LEN, Course } from '../sim/course';
import type { Beat } from '../game/beats';
import { LIFT_STEP, LIFT_TOP, cabinSpot, flagColors, liftLine, signature } from './dressing';
import { merge, part } from './flora';
import { LIGHT_GLSL, shared } from './materials';
import type { Palette } from './palette';
import { lensPx } from './particles';
import type { Tier } from './world';

// Ambient life: the things that move in the world besides the race. Everything here is decoration,
// never in the corridor and never near the safe line, small and soft and moving away from the run, so
// none of it reads as a hazard.
//
//   birds     crows and choughs wheeling over the banks and the valley, a flock crossing high up now
//             and then, scattering from a stomp or a crash; a rare owl at night, cranes over Sakura
//             Ridge; Ember Peak has none (its ash falls in the motes instead)
//   chairs    the lift lines the bank dressing stands (dressing.ts liftLine) run: chairs travel the
//             cables, some with passengers
//   figures   deer or ibex at the treeline's foot that bound off into the trees as you come, hares
//             darting, a fox trotting along the forest edge; skiers and snowboarders carving S-turns
//             on the open slopes past the trees; a snowcat with its lights on at night
//   smoke     the bank cabins' chimneys smoke: soft gouache puffs rising and leaning with the wind, lit
//             warm on the sun side
//   flags     prayer-flag lines by the cabins (Sakura Ridge: a string of paper lanterns, lit at night)
//             and a pair of feather banners at each section's head, fluttering
//   motes     diamond dust glittering in the sunbeams (Clear Skies and Glass Ice), ash drifting down
//             on Ember Peak
//
// Six draw calls at most (one per system), on Medium and High; Low keeps the birds only (one call).
// Nearly all the motion is in the vertex shaders, keyed off shared.uTime: the CPU re-places the cable
// chairs, the chimneys and the flags only when the view's chunk range moves (about every 64 m), and
// each frame it walks the few dozen figures along the banks (one matrix and one vec4 each) and
// re-anchors a bird flock once it falls behind. No per-frame allocations.

const NIGHT: ReadonlySet<Mood> = new Set([Mood.Lantern, Mood.Comet, Mood.Haunted]);

/** Jacket colours for people (skiers, chair passengers): cool and neutral, never the signal hues. */
const JACKETS = ['#2F7F86', '#6A5AA8', '#2C3256', '#E2DACB', '#4C6FB0', '#6E4A7A', '#6F8F7A', '#3E5C8C'].map((h) => new Color(h));

/** A collapsed vertex: outside the clip volume, so its triangles draw nothing. */
const COLLAPSE = 'gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return;';

/** The lit, faceted look every solid here shares: the toon model's two-tone wrap with the cool shade,
 *  the sled lantern at night and the fog. Facet normals come from screen derivatives, so wings and
 *  legs bent in the vertex shader light correctly. */
const SOLID_FRAG = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uGlowC;
uniform float uGlowK;
varying vec3 vWP;
varying vec3 vCol;
varying float vGlow;
void main() {
  vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP)));
  vec3 v = normalize(cameraPosition - vWP);
  if (dot(n, v) < 0.0) n = -n;
  vec3 base = vCol;
  vec3 shade = mix(base * 0.42, uShadeTint * (0.35 + 0.4 * dot(base, vec3(0.33))), 0.45);
  vec3 col = toonLightK(base, shade, n, v, 1.0, 0.35);
  col = lanternLight(col, base, vWP, n);
  col += uGlowC * vGlow * uGlowK;
  col = fogged(col, vWP);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function solidUniforms(extra: Record<string, { value: unknown }>): Record<string, { value: unknown }> {
  return { ...shared, uGlowC: { value: new Color('#FFD9A0') }, uGlowK: { value: 0 }, ...extra };
}

// ---------------------------------------------------------------- geometry helpers

/** A part for a rigged mesh: position, colour and a per-vertex (part, hip) tag. */
function rp(geo: BufferGeometry, color: string | Color, o: Parameters<typeof part>[2], tag = 0, hip = 0): BufferGeometry {
  const g = part(geo, color, o);
  g.deleteAttribute('normal');
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    a[i * 2] = tag;
    a[i * 2 + 1] = hip;
  }
  g.setAttribute('aRig', new BufferAttribute(a, 2));
  return g;
}

function tagVariant(g: BufferGeometry, v: number): BufferGeometry {
  const n = g.getAttribute('position').count;
  g.setAttribute('aVar', new BufferAttribute(new Float32Array(n).fill(v), 1));
  return g;
}

// ---------------------------------------------------------------- birds

type BirdKind = 'crow' | 'crane' | 'owl';
const BIRD_COLORS: Record<BirdKind, string[]> = {
  // body, wing, wingtip, beak and legs
  crow: ['#2B2838', '#302C42', '#221F2E', '#D9B860'],
  crane: ['#F0EEEA', '#ECE8E4', '#2A2733', '#5E5866'],
  owl: ['#8C7A6A', '#7E6E62', '#5E5249', '#3A3330'],
};

/** A bird along +x, wings out along z; tags: 0 body, 1 inner wing, 2 wingtip, 3 beak and legs. */
function birdGeometry(kind: BirdKind): BufferGeometry {
  const w = '#FFFFFF';
  const P: BufferGeometry[] = [];
  if (kind === 'crane') {
    P.push(rp(new IcosahedronGeometry(1, 0), w, { scale: [0.4, 0.13, 0.14] }, 0));
    P.push(rp(new BoxGeometry(0.5, 0.04, 0.04), w, { pos: [0.48, 0.03, 0] }, 0));
    P.push(rp(new IcosahedronGeometry(0.06, 0), w, { pos: [0.75, 0.04, 0] }, 0));
    P.push(rp(new ConeGeometry(0.025, 0.2, 4), w, { pos: [0.87, 0.03, 0], rot: [0, 0, -Math.PI / 2] }, 3));
    P.push(rp(new BoxGeometry(0.55, 0.025, 0.05), w, { pos: [-0.62, -0.02, 0] }, 3));
    for (const s of [-1, 1]) {
      P.push(rp(new BoxGeometry(0.44, 0.014, 0.62), w, { pos: [-0.02, 0, s * 0.37] }, 1));
      P.push(rp(new BoxGeometry(0.34, 0.014, 0.58), w, { pos: [-0.06, 0, s * 0.96], rot: [0, s * 0.12, 0] }, 2));
    }
  } else if (kind === 'owl') {
    P.push(rp(new IcosahedronGeometry(1, 0), w, { scale: [0.22, 0.16, 0.16] }, 0));
    P.push(rp(new IcosahedronGeometry(0.13, 0), w, { pos: [0.18, 0.08, 0] }, 0));
    P.push(rp(new BoxGeometry(0.16, 0.02, 0.18), w, { pos: [-0.26, 0, 0] }, 0));
    for (const s of [-1, 1]) {
      P.push(rp(new BoxGeometry(0.32, 0.016, 0.42), w, { pos: [0, 0.02, s * 0.29] }, 1));
      P.push(rp(new BoxGeometry(0.26, 0.016, 0.32), w, { pos: [-0.03, 0.02, s * 0.64], rot: [0, s * 0.18, 0] }, 2));
    }
  } else {
    P.push(rp(new IcosahedronGeometry(1, 0), w, { scale: [0.28, 0.09, 0.1] }, 0));
    P.push(rp(new IcosahedronGeometry(0.075, 0), w, { pos: [0.27, 0.04, 0] }, 0));
    P.push(rp(new ConeGeometry(0.03, 0.11, 4), w, { pos: [0.37, 0.03, 0], rot: [0, 0, -Math.PI / 2] }, 3));
    P.push(rp(new BoxGeometry(0.2, 0.016, 0.16), w, { pos: [-0.35, 0, 0] }, 0));
    for (const s of [-1, 1]) {
      P.push(rp(new BoxGeometry(0.24, 0.014, 0.44), w, { pos: [0, 0.01, s * 0.27] }, 1));
      // The fingered primaries swept back a little.
      P.push(rp(new BoxGeometry(0.17, 0.014, 0.38), w, { pos: [-0.04, 0.01, s * 0.66], rot: [0, s * 0.22, 0] }, 2));
    }
  }
  return merge(P);
}

const BIRD_VERT = /* glsl */ `
attribute vec2 aRig;
attribute vec4 aOrbit;
attribute vec4 aFly;
attribute vec4 aWay;
uniform float uTime;
uniform vec4 uScatter;
uniform vec3 uBirdC[4];
uniform float uFlapAmp;
uniform float uSoar;
varying vec3 vWP;
varying vec3 vCol;
varying float vGlow;
void main() {
  float size = aFly.w;
  if (size <= 0.0) { ${COLLAPSE} }
  float t = uTime;
  vec3 p;
  vec3 fwd;
  float bank = 0.0;
  if (aWay.x < 0.5) {
    // Wheeling: a lazy circle that wanders into an ellipse, rising and falling.
    float a = aFly.y + aFly.x * t;
    float r = aOrbit.w * (1.0 + 0.25 * sin(t * 0.21 + aFly.y * 3.0));
    p = aOrbit.xyz + vec3(cos(a) * r, 2.0 * sin(t * 0.37 + aFly.y * 5.0), sin(a) * r * 0.8);
    fwd = normalize(vec3(-sin(a), 0.0, cos(a) * 0.8) * sign(aFly.x));
    bank = sign(aFly.x) * 0.4;
  } else {
    // Crossing: straight on, high, in formation (the formation offset is in the centre), wrapping
    // round a long stretch so the flock comes by again.
    float span = 1400.0;
    vec3 d = vec3(aWay.y, 0.0, aWay.z);
    float s = mod(t * aWay.w + aFly.y * span, span) - span * 0.5;
    p = aOrbit.xyz + d * s;
    p.y += 0.8 * sin(t * 0.5 + aFly.y * 9.0);
    fwd = d;
  }
  // A stomp or a crash nearby: the birds burst up and away from it, flapping hard, and settle back.
  vec3 dS = p - uScatter.xyz;
  float age = t - uScatter.w;
  float k = 0.0;
  if (age > 0.0 && age < 16.0) {
    float near = 1.0 - smoothstep(90.0, 220.0, length(dS));
    k = near * (1.0 - exp(-age * 2.0)) * (1.0 - smoothstep(6.0, 16.0, age));
    vec3 away = normalize(vec3(dS.x, 0.0, dS.z) + vec3(0.01, 0.0, 0.0));
    vec3 push = away * 22.0 + vec3(0.0, 24.0, 0.0);
    p += push * k;
    fwd = normalize(mix(fwd, normalize(push + fwd * 10.0), min(1.0, k * 2.0)));
    bank *= 1.0 - k;
  }
  float ph = t * aFly.z * (1.0 + 1.5 * k) * 6.2832 + aFly.y * 17.0;
  // Most birds glide part of the time, wings held in a shallow V.
  float glide = smoothstep(0.2, 0.7, sin(t * 0.45 + aFly.y * 7.0)) * uSoar * (1.0 - min(1.0, k * 2.0));
  float flap = sin(ph) * (1.0 - glide);
  vec3 lp = position;
  float span = abs(lp.z);
  if (aRig.x > 0.5 && aRig.x < 2.5) {
    lp.y += (flap * 0.85 * uFlapAmp + glide * 0.18) * span;
    if (aRig.x > 1.5) lp.y += sin(ph - 1.0) * max(span - 0.4, 0.0) * 0.5 * uFlapAmp * (1.0 - glide);
  }
  p.y -= flap * 0.05 * size;
  lp *= size;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(fwd, up));
  vec3 up2 = normalize(up * cos(bank) + right * sin(bank));
  right = normalize(cross(fwd, up2));
  vec3 wp = p + fwd * lp.x + up2 * lp.y + right * lp.z;
  int pi = int(aRig.x + 0.5);
  vCol = uBirdC[pi];
  vGlow = 0.0;
  vWP = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

interface Flock {
  /** Sim z it wheels over, its bank side, and how many birds it has (0 for none). */
  z: number;
  side: number;
  n: number;
  first: number;
  /** 1 for the high crossing flock. */
  cross: boolean;
}

// ---------------------------------------------------------------- chairs

/** A double chair hanging from its grip (the origin) on the cable, facing +x along its travel; tags:
 *  0 frame, 1 helmets, legs and skis, 2 first passenger's jacket, 3 the second's; 4 the second's
 *  helmet, legs and skis. */
function chairGeometry(): BufferGeometry {
  const steel = '#3A3C52';
  const seat = '#5A5E80';
  const pants = '#2E3044';
  const helmet = '#E4DCD2';
  const P: BufferGeometry[] = [
    rp(new BoxGeometry(0.26, 0.2, 0.2), steel, { pos: [0, 0, 0] }, 0),
    rp(new CylinderGeometry(0.035, 0.035, 2.0, 5), steel, { pos: [0, -1.0, 0] }, 0),
    rp(new BoxGeometry(0.06, 0.06, 1.4), steel, { pos: [0, -1.95, 0] }, 0),
    rp(new BoxGeometry(0.55, 0.09, 1.3), seat, { pos: [0.08, -2.12, 0] }, 0),
    rp(new BoxGeometry(0.07, 0.55, 1.3), seat, { pos: [-0.2, -1.84, 0] }, 0),
    rp(new BoxGeometry(0.4, 0.04, 0.04), steel, { pos: [0.3, -1.62, 0.66] }, 0),
    rp(new BoxGeometry(0.4, 0.04, 0.04), steel, { pos: [0.3, -1.62, -0.66] }, 0),
    rp(new BoxGeometry(0.04, 0.04, 1.32), steel, { pos: [0.5, -1.62, 0] }, 0),
    // A cap of snow on the backrest.
    rp(new BoxGeometry(0.12, 0.05, 1.3), '#F4F7FF', { pos: [-0.2, -1.55, 0] }, 0),
  ];
  for (const [z, jacket, rest] of [
    [0.32, 2, 1],
    [-0.32, 3, 4],
  ] as const) {
    P.push(rp(new BoxGeometry(0.26, 0.42, 0.3), '#FFFFFF', { pos: [-0.04, -1.86, z] }, jacket));
    P.push(rp(new IcosahedronGeometry(0.12, 0), helmet, { pos: [-0.01, -1.54, z] }, rest));
    P.push(rp(new BoxGeometry(0.42, 0.12, 0.24), pants, { pos: [0.2, -2.0, z] }, rest));
    P.push(rp(new BoxGeometry(0.1, 0.4, 0.2), pants, { pos: [0.38, -2.22, z] }, rest));
    P.push(rp(new BoxGeometry(1.1, 0.03, 0.08), '#3A3550', { pos: [0.5, -2.44, z - 0.06], rot: [0, 0, -0.35] }, rest));
    P.push(rp(new BoxGeometry(1.1, 0.03, 0.08), '#3A3550', { pos: [0.5, -2.44, z + 0.06], rot: [0, 0, -0.35] }, rest));
  }
  return merge(P);
}

const CHAIR_VERT = /* glsl */ `
attribute vec2 aRig;
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aC;
uniform float uTime;
uniform float uRate;
uniform float uPass;
uniform vec3 uJackets[8];
varying vec3 vWP;
varying vec3 vCol;
varying float vGlow;
float h11(float n) { return fract(sin(n * 91.7 + 0.31) * 43758.5453); }
void main() {
  // aA, aB: the span's grip line (xyz) and, in w, whether it is the line's first or last span (bits 1
  // and 2) and the chairs per span. aC: the chair's slot (span index + k / n), its direction, the
  // line's seed.
  float g = aC.x + aC.y * uTime * uRate;
  float u = fract(g);
  float n = aB.w;
  // A chair keeps its passengers from span to span: they are hashed from its slot on the whole line.
  float id = floor(g * n + 0.5) + aC.z * 131.0;
  float h = h11(id);
  float pass = h < uPass * 0.35 ? 2.0 : h < uPass ? 1.0 : 0.0;
  if (aC.y < 0.0) pass = h < uPass * 0.2 ? 1.0 : 0.0;
  float tag = aRig.x;
  if ((tag > 0.5 && tag < 2.5 && pass < 0.5) || (tag > 2.5 && pass < 1.5)) { ${COLLAPSE} }
  // Chairs come out of the end towers small, as if round a bullwheel.
  float ends = aA.w;
  float sz = 1.0;
  if (mod(ends, 2.0) > 0.5) sz = min(sz, smoothstep(0.0, 0.1, u));
  if (ends > 1.5) sz = min(sz, smoothstep(1.0, 0.9, u));
  if (sz < 0.02) { ${COLLAPSE} }
  vec3 grip = mix(aA.xyz, aB.xyz, u);
  vec3 d = aB.xyz - aA.xyz;
  vec3 fwd = normalize(vec3(d.x, 0.0, d.z)) * sign(aC.y);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  // A slow swing on the hanger, and a jolt over each tower.
  float tower = 1.0 - smoothstep(0.0, 0.05, min(u, 1.0 - u));
  float sw = 0.05 * sin(uTime * 1.2 + id * 1.7) + 0.1 * tower * sin(uTime * 7.0 + id);
  vec3 lp = position * sz;
  float cs = cos(sw);
  float sn = sin(sw);
  lp.xy = vec2(lp.x * cs - lp.y * sn, lp.x * sn + lp.y * cs);
  vec3 wp = grip + fwd * lp.x + vec3(0.0, lp.y, 0.0) + right * lp.z;
  vCol = color;
  if (tag > 1.5 && tag < 3.5) vCol = uJackets[int(mod(floor(h11(id + tag) * 8.0), 8.0))];
  vGlow = 0.0;
  vWP = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

// ---------------------------------------------------------------- figures

const F_DEER = 0;
const F_IBEX = 1;
const F_HARE = 2;
const F_FOX = 3;
const F_SKIER = 4;
const F_BOARD = 5;
const F_CAT = 6;

/** Rig tags for figures: 0 body, 1-4 legs (front left, front right, hind left, hind right), 5 jacket
 *  (tinted per instance), 6 head (grazes), 7 lamp (glows at night). */
function legs(P: BufferGeometry[], col: string, fx: number, hx: number, w: number, hip: number, r: number): void {
  P.push(rp(new BoxGeometry(r, hip, r), col, { pos: [fx, hip / 2, w] }, 1, hip));
  P.push(rp(new BoxGeometry(r, hip, r), col, { pos: [fx, hip / 2, -w] }, 2, hip));
  P.push(rp(new BoxGeometry(r * 1.2, hip, r * 1.2), col, { pos: [hx, hip / 2, w] }, 3, hip));
  P.push(rp(new BoxGeometry(r * 1.2, hip, r * 1.2), col, { pos: [hx, hip / 2, -w] }, 4, hip));
}

function deer(ibex: boolean): BufferGeometry {
  const coat = ibex ? '#9A8470' : '#AE7650';
  const dark = ibex ? '#5A4C40' : '#6A4632';
  const P: BufferGeometry[] = [
    rp(new IcosahedronGeometry(1, 1), coat, { pos: [0, 1.0, 0], scale: [0.6, 0.29, 0.24] }),
    rp(new IcosahedronGeometry(0.15, 0), '#E8DCC8', { pos: [-0.56, 1.08, 0] }),
    rp(new BoxGeometry(0.17, 0.5, 0.16), coat, { pos: [0.5, 1.32, 0], rot: [0, 0, -0.55] }, 6),
    rp(new IcosahedronGeometry(1, 0), coat, { pos: [0.72, 1.56, 0], scale: [0.21, 0.12, 0.11] }, 6),
    rp(new IcosahedronGeometry(0.05, 0), '#2A2228', { pos: [0.92, 1.52, 0] }, 6),
    rp(new ConeGeometry(0.05, 0.16, 4), dark, { pos: [0.62, 1.7, 0.08], rot: [0.4, 0, 0] }, 6),
    rp(new ConeGeometry(0.05, 0.16, 4), dark, { pos: [0.62, 1.7, -0.08], rot: [-0.4, 0, 0] }, 6),
  ];
  if (ibex) {
    // Great swept-back horns.
    for (const s of [-1, 1]) {
      P.push(rp(new BoxGeometry(0.06, 0.32, 0.06), dark, { pos: [0.62, 1.78, s * 0.05], rot: [0, 0, 0.5] }, 6));
      P.push(rp(new BoxGeometry(0.05, 0.28, 0.05), dark, { pos: [0.5, 1.98, s * 0.06], rot: [0, 0, 1.2] }, 6));
      P.push(rp(new BoxGeometry(0.04, 0.2, 0.04), dark, { pos: [0.33, 1.98, s * 0.07], rot: [0, 0, 2.1] }, 6));
    }
    P.push(rp(new ConeGeometry(0.04, 0.14, 4), dark, { pos: [0.8, 1.42, 0], rot: [0, 0, Math.PI] }, 6));
  } else {
    const ant = '#CBBBA4';
    for (const s of [-1, 1]) {
      P.push(rp(new BoxGeometry(0.035, 0.42, 0.035), ant, { pos: [0.66, 1.82, s * 0.1], rot: [s * 0.35, 0, 0.25] }, 6));
      P.push(rp(new BoxGeometry(0.03, 0.2, 0.03), ant, { pos: [0.74, 1.9, s * 0.16], rot: [s * 0.5, 0, -0.5] }, 6));
      P.push(rp(new BoxGeometry(0.03, 0.18, 0.03), ant, { pos: [0.58, 2.02, s * 0.2], rot: [s * 0.6, 0, 0.6] }, 6));
    }
  }
  legs(P, dark, 0.4, -0.42, 0.12, 0.92, 0.07);
  return merge(P);
}

function hare(): BufferGeometry {
  const fur = '#9A8070';
  const P: BufferGeometry[] = [
    rp(new IcosahedronGeometry(1, 1), fur, { pos: [0, 0.27, 0], scale: [0.24, 0.15, 0.13] }),
    rp(new IcosahedronGeometry(0.1, 0), fur, { pos: [0.22, 0.38, 0] }, 6),
    rp(new BoxGeometry(0.035, 0.22, 0.06), fur, { pos: [0.17, 0.55, 0.04], rot: [0.15, 0, 0.35] }, 6),
    rp(new BoxGeometry(0.035, 0.22, 0.06), fur, { pos: [0.17, 0.55, -0.04], rot: [-0.15, 0, 0.35] }, 6),
    rp(new IcosahedronGeometry(0.06, 0), '#F2EDE6', { pos: [-0.25, 0.3, 0] }),
  ];
  legs(P, '#7A6254', 0.12, -0.12, 0.06, 0.16, 0.05);
  return merge(P);
}

function fox(): BufferGeometry {
  const fur = '#9C5A38';
  const P: BufferGeometry[] = [
    rp(new IcosahedronGeometry(1, 1), fur, { pos: [0, 0.44, 0], scale: [0.36, 0.14, 0.12] }),
    rp(new IcosahedronGeometry(1, 0), fur, { pos: [-0.5, 0.42, 0], scale: [0.3, 0.09, 0.09], rot: [0, 0, 0.25] }),
    rp(new IcosahedronGeometry(0.07, 0), '#F0E6D8', { pos: [-0.76, 0.34, 0] }),
    rp(new IcosahedronGeometry(0.12, 0), fur, { pos: [0.42, 0.54, 0] }, 6),
    rp(new ConeGeometry(0.06, 0.18, 4), fur, { pos: [0.58, 0.51, 0], rot: [0, 0, -Math.PI / 2] }, 6),
    rp(new ConeGeometry(0.04, 0.1, 4), '#3A2A28', { pos: [0.4, 0.68, 0.06] }, 6),
    rp(new ConeGeometry(0.04, 0.1, 4), '#3A2A28', { pos: [0.4, 0.68, -0.06] }, 6),
    rp(new IcosahedronGeometry(1, 0), '#EADFCF', { pos: [0.12, 0.38, 0], scale: [0.2, 0.06, 0.08] }),
  ];
  legs(P, '#3A2A28', 0.24, -0.24, 0.07, 0.34, 0.045);
  return merge(P);
}

function skier(board: boolean): BufferGeometry {
  const pants = '#2C3046';
  const P: BufferGeometry[] = [
    rp(new BoxGeometry(0.3, 0.44, 0.24), '#FFFFFF', { pos: [0.04, 0.82, 0], rot: [0, 0, -0.25] }, 5),
    rp(new IcosahedronGeometry(0.12, 0), '#E8C8B0', { pos: [0.12, 1.16, 0] }),
    rp(new ConeGeometry(0.12, 0.14, 5), '#FFFFFF', { pos: [0.12, 1.28, 0] }, 5),
  ];
  if (board) {
    // Stood across the board, which runs along the travel; turned to face the slope's side (+z).
    P.push(rp(new BoxGeometry(0.11, 0.5, 0.11), pants, { pos: [0.18, 0.3, 0], rot: [0, 0, 0.2] }));
    P.push(rp(new BoxGeometry(0.11, 0.5, 0.11), pants, { pos: [-0.16, 0.3, 0], rot: [0, 0, -0.2] }));
    P.push(rp(new BoxGeometry(1.4, 0.04, 0.3), '#4A4E66', { pos: [0, 0.03, 0] }));
  } else {
    for (const s of [-1, 1]) {
      P.push(rp(new BoxGeometry(0.11, 0.5, 0.11), pants, { pos: [0.05, 0.32, s * 0.1], rot: [0, 0, -0.35] }));
      P.push(rp(new BoxGeometry(1.6, 0.035, 0.08), '#3A3550', { pos: [0.1, 0.03, s * 0.12] }));
      P.push(rp(new CylinderGeometry(0.015, 0.015, 1.0, 3), '#2A2838', { pos: [-0.05, 0.55, s * 0.3], rot: [0, 0, 0.45] }));
    }
  }
  return merge(P);
}

function snowcat(): BufferGeometry {
  const body = '#5B6A9A';
  const track = '#2A2838';
  return merge([
    rp(new BoxGeometry(3.0, 0.9, 2.0), body, { pos: [0, 1.05, 0] }),
    rp(new BoxGeometry(1.5, 1.0, 1.8), '#D8D4CC', { pos: [0.45, 1.95, 0] }),
    rp(new BoxGeometry(1.52, 0.5, 1.82), '#2A2540', { pos: [0.45, 2.05, 0] }),
    rp(new BoxGeometry(1.6, 0.1, 1.9), '#F4F7FF', { pos: [0.45, 2.5, 0] }),
    rp(new BoxGeometry(3.4, 0.7, 0.55), track, { pos: [0, 0.35, 0.85] }),
    rp(new BoxGeometry(3.4, 0.7, 0.55), track, { pos: [0, 0.35, -0.85] }),
    rp(new BoxGeometry(0.2, 0.8, 2.8), '#8A8496', { pos: [1.95, 0.5, 0] }),
    rp(new BoxGeometry(0.8, 0.5, 2.4), '#4A4E66', { pos: [-2.0, 0.4, 0] }),
    rp(new BoxGeometry(0.1, 0.18, 0.3), '#FFE6B8', { pos: [1.22, 2.3, 0.55] }, 7),
    rp(new BoxGeometry(0.1, 0.18, 0.3), '#FFE6B8', { pos: [1.22, 2.3, -0.55] }, 7),
    rp(new BoxGeometry(0.1, 0.16, 0.34), '#FFE6B8', { pos: [1.52, 1.2, 0.7] }, 7),
    rp(new BoxGeometry(0.1, 0.16, 0.34), '#FFE6B8', { pos: [1.52, 1.2, -0.7] }, 7),
  ]);
}

function figureSet(): BufferGeometry {
  return merge([deer(false), deer(true), hare(), fox(), skier(false), skier(true), snowcat()].map((g, i) => tagVariant(g, i)));
}

const FIGURE_VERT = /* glsl */ `
attribute vec2 aRig;
attribute float aVar;
attribute float aPick;
attribute vec4 aAnim;
uniform float uTime;
uniform vec3 uJackets[8];
uniform float uLamps;
varying vec3 vWP;
varying vec3 vCol;
varying float vGlow;
void main() {
  if (abs(aVar - aPick) > 0.5) { ${COLLAPSE} }
  // aAnim: gait phase (radians), how much it is moving (0..1), hop height, jacket index.
  vec3 lp = position;
  float g = aAnim.x;
  float mv = aAnim.y;
  float tag = aRig.x;
  if (tag > 0.5 && tag < 4.5) {
    // Legs swing from the hip: a gallop's pairs together, a trot's diagonals.
    float off = tag < 1.5 ? 0.0 : tag < 2.5 ? (aAnim.z > 0.2 ? 0.4 : 3.1416) : tag < 3.5 ? (aAnim.z > 0.2 ? 2.6 : 3.1416) : (aAnim.z > 0.2 ? 3.0 : 0.0);
    float sw = sin(g + off) * mv * 0.7;
    lp.x += sw * max(aRig.y - lp.y, 0.0);
  }
  // Standing, the head dips to graze now and then.
  if (tag > 5.5 && tag < 6.5) {
    float graze = (1.0 - mv) * smoothstep(0.3, 0.9, sin(uTime * 0.5 + aAnim.w * 3.0));
    lp.y -= graze * (lp.y - 0.0) * 0.32;
    lp.x += graze * 0.12;
  }
  // A bound's arc and the body pitching through it.
  float hop = aAnim.z * max(sin(g), 0.0);
  float pitch = aAnim.z * cos(g) * 0.25;
  float cp = cos(pitch);
  float sp = sin(pitch);
  lp.xy = vec2(lp.x * cp - lp.y * sp, lp.x * sp + lp.y * cp);
  lp.y += hop;
  vec4 wp = modelMatrix * instanceMatrix * vec4(lp, 1.0);
  vCol = color;
  if (tag > 4.5 && tag < 5.5) vCol = uJackets[int(mod(aAnim.w, 8.0))] * color;
  vGlow = tag > 6.5 ? uLamps : 0.0;
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

interface Fig {
  kind: number;
  side: number;
  /** Where it stands or started (edge excess and sim z), and where it is now. */
  e0: number;
  z0: number;
  e: number;
  z: number;
  /** Seconds since it was placed; when it was startled (-1: not yet). */
  age: number;
  fled: number;
  gait: number;
  /** Its heading in (edge excess, z) space, radians from +z toward +e. */
  dir: number;
  speed: number;
  amp: number;
  period: number;
  tint: number;
  live: boolean;
  /** Rides the mid-ground (farGround) rather than the course's banks. */
  far: boolean;
  /** A far rider's last ground height and the frames until it is asked again (the mid-ground's
   *  height query is the costly part of a frame's walk; 150 m out, a height three frames old is
   *  centimetres off). */
  gy: number;
  gk: number;
}

// ---------------------------------------------------------------- smoke

const SMOKE_VERT = /* glsl */ `
attribute vec4 aSrc;
uniform float uTime;
uniform vec3 uWind;
varying vec2 vUv;
varying float vA;
varying vec3 vWP;
varying float vSeed;
void main() {
  // aSrc.w: the puff's phase, plus 2 for a far chimney (a village's), whose smoke is drawn larger.
  float far = step(1.5, aSrc.w);
  float ph = fract(aSrc.w);
  float age = fract(uTime * mix(0.07, 0.035, far) + ph);
  float k = 1.0 + 3.0 * far;
  vec3 c = aSrc.xyz + (vec3(0.0, age * 13.0, 0.0) + uWind * (age * age * 9.0 + age * 1.5)) * k;
  c.x += sin(age * 5.0 + ph * 40.0) * 0.5 * age * k;
  c.z += cos(age * 4.0 + ph * 30.0) * 0.4 * age * k;
  float size = mix(0.9, 4.6, sqrt(age)) * k;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0;
  vA = smoothstep(0.0, 0.05, age) * pow(1.0 - age, 1.1);
  vWP = c;
  vSeed = ph * 37.0;
}
`;

const SMOKE_FRAG = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uSmokeLit;
uniform vec3 uSmokeShade;
uniform float uSmokeA;
uniform float uDayK;
varying vec2 vUv;
varying float vA;
varying vec3 vWP;
varying float vSeed;
void main() {
  // A puff of gouache: a round blot with a lumpy, painted edge, lit as a ball.
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  float edge = 0.86 + 0.07 * sin(ang * 5.0 + vSeed) + 0.04 * sin(ang * 9.0 - vSeed * 1.7);
  float a = 1.0 - smoothstep(edge - 0.1, edge, r);
  if (a * vA < 0.01) discard;
  vec3 nV = vec3(vUv, sqrt(max(0.0, 1.0 - r * r)));
  vec3 n = normalize(nV * mat3(viewMatrix));
  float lit = smoothstep(-0.25, 0.45, dot(n, uSunDir));
  // Three soft value steps, as a painter would lay them.
  lit = mix(lit, floor(lit * 3.0 + 0.5) / 3.0, 0.6);
  vec3 litC = uSmokeLit * mix(vec3(1.0), uSunColor, 0.6 * uDayK);
  vec3 col = mix(mix(uSmokeShade, uShadeTint, 0.2), litC, lit);
  // Seen against the low sun, the thin smoke glows through (forward scatter), warmest at its edges.
  float back = pow(max(dot(normalize(vWP - cameraPosition), uSunDir), 0.0), 3.0) * uDayK;
  col = mix(col, litC * 1.08, back * (0.35 + 0.4 * (1.0 - nV.z)));
  col += uRim * pow(1.0 - nV.z, 3.0) * 0.18;
  col = fogged(col, vWP);
  gl_FragColor = vec4(col, a * vA * uSmokeA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ---------------------------------------------------------------- flags

/** A cloth panel along +x from its hoist (x 0 to 1), hanging down from its top edge (y 0 to -1). */
function flagGeometry(): BufferGeometry {
  const g = new BoxGeometry(1, 1, 0.02, 6, 2, 1).toNonIndexed();
  g.translate(0.5, -0.5, 0);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return g;
}

const FLAG_VERT = /* glsl */ `
attribute vec4 aFlag;
attribute vec4 aCol;
uniform float uTime;
uniform float uWindK;
varying vec3 vWP;
varying vec3 vCol;
varying float vGlow;
void main() {
  // aFlag: flutter, phase, kind (0 hung from its top edge, 1 flown from its hoist, 2 rigid, 3 a
  // lantern swinging from its top), and the colour's glow at night in aCol.w.
  vec3 lp = position;
  float kind = aFlag.z;
  float t = uTime * (0.8 + 0.6 * uWindK);
  // A feather banner's top edge sweeps down toward its fly.
  if (kind > 0.5 && kind < 1.5) lp.y = -1.0 + (lp.y + 1.0) * (1.0 - 0.4 * lp.x * lp.x);
  if (kind < 1.5) {
    float w = kind < 0.5 ? -lp.y : lp.x;
    float wave = sin(lp.x * 4.0 + lp.y * 2.0 - t * 7.0 + aFlag.y) * 0.7 + sin(t * 3.1 + aFlag.y * 2.0) * 0.3;
    lp.z += w * aFlag.x * (wave * (0.5 + 0.5 * uWindK) + 0.3 * uWindK);
    lp.y += w * aFlag.x * 0.1 * sin(t * 5.0 + lp.x * 3.0 + aFlag.y);
  } else if (kind > 2.5) {
    float a = sin(t * 1.6 + aFlag.y) * 0.08 * (0.5 + uWindK);
    lp.yz = vec2(lp.y * cos(a) - lp.z * sin(a), lp.y * sin(a) + lp.z * cos(a));
  }
  vec4 wp = modelMatrix * instanceMatrix * vec4(lp, 1.0);
  vCol = aCol.rgb;
  vGlow = aCol.w;
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// ---------------------------------------------------------------- motes

const MOTE_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCentre;
uniform vec3 uBox;
uniform float uAsh;
uniform float uPx;
uniform vec3 uDiskDir;
varying float vB;
varying float vAsh;
void main() {
  vec3 drift = uAsh > 0.5 ? vec3(0.5, -0.7, 0.35) * uTime : vec3(0.25, -0.08, 0.15) * uTime;
  vec3 p = aSeed.xyz * uBox + drift;
  if (uAsh > 0.5) p += vec3(sin(uTime * 0.9 + aSeed.w * 30.0), 0.0, cos(uTime * 0.7 + aSeed.w * 20.0)) * 0.8;
  else p.y += sin(uTime * 0.4 + aSeed.w * 30.0) * 0.4;
  p = uCentre + (fract((p - uCentre) / uBox + 0.5) - 0.5) * uBox;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.1);
  float fade = smoothstep(2.0, 5.0, d) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.48, d));
  if (uAsh > 0.5) {
    vB = fade;
    gl_PointSize = uPx * 0.07 / d;
  } else {
    // Diamond dust: each grain flashes now and then, and only where it hangs in the sunbeams (looking
    // toward the sun) does it glitter in earnest.
    float tw = pow(max(0.0, sin(uTime * (1.3 + aSeed.w * 2.2) + aSeed.w * 61.0)), 5.0);
    float beam = pow(max(0.0, dot(normalize(p - cameraPosition), uDiskDir)), 2.5);
    vB = fade * tw * (0.25 + 1.5 * beam);
    gl_PointSize = uPx * 0.07 / d * (0.7 + 1.0 * tw);
  }
  if (vB < 0.01) gl_PointSize = 0.0;
  vAsh = uAsh;
}
`;

const MOTE_FRAG = /* glsl */ `
uniform vec3 uMoteC;
varying float vB;
varying float vAsh;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float a = vAsh > 0.5 ? (1.0 - smoothstep(0.5, 1.0, r)) * 0.8 : exp(-r * 3.5);
  gl_FragColor = vec4(uMoteC * (vAsh > 0.5 ? 1.0 : a * vB * 1.6), vAsh > 0.5 ? a * vB : 1.0);
  #include <colorspace_fragment>
}
`;

// ---------------------------------------------------------------- the system

const BIRD_CAP = 64;
const CHAIR_CAP = 192;
const FIG_CAP = 40;
const SMOKE_PER = 10;
const SMOKE_CAP = 22 * SMOKE_PER;
const FLAG_CAP = 420;
const MOTE_N = 700;

interface Plan {
  birds: boolean;
  flocks: number;
  crossing: boolean;
  /** Everything but the birds (Medium and High). */
  rich: boolean;
  deerGroups: number;
  hares: number;
  foxes: number;
  skiers: number;
}

const PLANS: Record<Tier, Plan> = {
  low: { birds: true, flocks: 3, crossing: false, rich: false, deerGroups: 0, hares: 0, foxes: 0, skiers: 0 },
  medium: { birds: true, flocks: 5, crossing: true, rich: true, deerGroups: 2, hares: 2, foxes: 1, skiers: 7 },
  high: { birds: true, flocks: 7, crossing: true, rich: true, deerGroups: 3, hares: 3, foxes: 2, skiers: 12 },
};

export class Life {
  readonly root = new Group();
  /** Optional, wired by the world: the mid-ground's ground height at a world x and sim z, from the
   *  terrain's edge out. With it the skiers and the snowcat ride the far slopes 140 to 420 m out,
   *  where the low chase lens sees them over the bank's crest; without it they keep to the course's
   *  own upper banks (seen from the title orbit, the bends and the crash and results lenses). */
  farGround: ((x: number, z: number) => number) | null = null;
  /** Optional, wired by the world: far chimney tops (a valley village's, world space) to smoke as
   *  well; writes up to out.length points and returns how many. */
  farChimneys: ((out: Vector3[]) => number) | null = null;
  private chimBuf: Vector3[] = Array.from({ length: 6 }, () => new Vector3());
  private course: Course;
  private plan: Plan;
  private tier: Tier;
  private dens: number;
  private mood: Mood = Mood.None;
  private night = false;
  private seed = 1;

  // Birds.
  private birdGeo: InstancedBufferGeometry;
  private birdMat: ShaderMaterial;
  private birdMesh: Mesh;
  private aOrbit: InstancedBufferAttribute;
  private aFly: InstancedBufferAttribute;
  private aWay: InstancedBufferAttribute;
  private birdKind: BirdKind | null = null;
  private flocks: Flock[] = [];
  private birdSize = 1;
  private flapHz = 3;

  // Chairs.
  private chairGeo: InstancedBufferGeometry;
  private chairMat: ShaderMaterial;
  private aA: InstancedBufferAttribute;
  private aB: InstancedBufferAttribute;
  private aC: InstancedBufferAttribute;

  // Figures.
  private figMesh: InstancedMesh;
  private figMat: ShaderMaterial;
  private aPick: InstancedBufferAttribute;
  private aAnim: InstancedBufferAttribute;
  private figs: Fig[] = [];

  // Smoke.
  private smokeGeo: InstancedBufferGeometry;
  private smokeMat: ShaderMaterial;
  private aSrc: InstancedBufferAttribute;

  // Flags.
  private flagMesh: InstancedMesh;
  private flagMat: ShaderMaterial;
  private aFlag: InstancedBufferAttribute;
  private aCol: InstancedBufferAttribute;
  private flagN = 0;
  private flagCols: Color[] = [];

  // Motes.
  private moteMat: ShaderMaterial;
  private motes: Points;

  /** The chunk range last placed (from * 4096 + to), -1 to force a re-place. */
  private range = -1;
  private lastZ = Number.NaN;
  private m = new Matrix4();
  private q = new Quaternion();
  private q2 = new Quaternion();
  private v = new Vector3();
  private v2 = new Vector3();
  private s = new Vector3();
  private up = new Vector3(0, 1, 0);
  private xAxis = new Vector3(1, 0, 0);
  private secs = new Set<number>();

  constructor(course: Course, palette: Palette, tier: Tier, dens: number) {
    this.course = course;
    this.tier = tier;
    this.plan = PLANS[tier];
    this.dens = dens;

    // Birds.
    this.birdGeo = new InstancedBufferGeometry();
    this.aOrbit = new InstancedBufferAttribute(new Float32Array(BIRD_CAP * 4), 4);
    this.aFly = new InstancedBufferAttribute(new Float32Array(BIRD_CAP * 4), 4);
    this.aWay = new InstancedBufferAttribute(new Float32Array(BIRD_CAP * 4), 4);
    this.birdMat = new ShaderMaterial({
      side: DoubleSide,
      uniforms: solidUniforms({ uScatter: { value: new Vector4(0, -9999, 0, -999) }, uBirdC: { value: [new Color(), new Color(), new Color(), new Color()] }, uFlapAmp: { value: 1 }, uSoar: { value: 1 } }),
      vertexShader: BIRD_VERT,
      fragmentShader: SOLID_FRAG,
    });
    this.birdMesh = new Mesh(this.birdGeo, this.birdMat);
    this.setBirdKind('crow');

    // Chairs.
    this.chairGeo = new InstancedBufferGeometry();
    const cg = chairGeometry();
    for (const n of ['position', 'color', 'aRig']) this.chairGeo.setAttribute(n, cg.getAttribute(n));
    this.aA = new InstancedBufferAttribute(new Float32Array(CHAIR_CAP * 4), 4);
    this.aB = new InstancedBufferAttribute(new Float32Array(CHAIR_CAP * 4), 4);
    this.aC = new InstancedBufferAttribute(new Float32Array(CHAIR_CAP * 4), 4);
    this.chairGeo.setAttribute('aA', this.aA);
    this.chairGeo.setAttribute('aB', this.aB);
    this.chairGeo.setAttribute('aC', this.aC);
    this.chairGeo.instanceCount = 0;
    this.chairMat = new ShaderMaterial({
      vertexColors: true,
      side: DoubleSide,
      uniforms: solidUniforms({ uRate: { value: 2.4 / LIFT_STEP }, uPass: { value: 0.7 }, uJackets: { value: JACKETS } }),
      vertexShader: CHAIR_VERT,
      fragmentShader: SOLID_FRAG,
    });
    const chairs = new Mesh(this.chairGeo, this.chairMat);

    // Figures.
    const fg = figureSet();
    this.aPick = new InstancedBufferAttribute(new Float32Array(FIG_CAP), 1);
    this.aAnim = new InstancedBufferAttribute(new Float32Array(FIG_CAP * 4), 4);
    this.aPick.setUsage(DynamicDrawUsage);
    this.aAnim.setUsage(DynamicDrawUsage);
    fg.setAttribute('aPick', this.aPick);
    fg.setAttribute('aAnim', this.aAnim);
    fg.deleteAttribute('normal');
    this.figMat = new ShaderMaterial({
      vertexColors: true,
      side: DoubleSide,
      uniforms: solidUniforms({ uJackets: { value: JACKETS }, uLamps: { value: 0 } }),
      vertexShader: FIGURE_VERT,
      fragmentShader: SOLID_FRAG,
    });
    this.figMesh = new InstancedMesh(fg, this.figMat, FIG_CAP);
    this.figMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.figMesh.count = 0;
    for (let i = 0; i < FIG_CAP; i++) this.figs.push({ kind: 0, side: 1, e0: 0, z0: 0, e: 0, z: 0, age: 0, fled: -1, gait: 0, dir: 0, speed: 0, amp: 0, period: 1, tint: 0, live: false, far: false, gy: 0, gk: 0 });

    // Smoke.
    this.smokeGeo = new InstancedBufferGeometry();
    const pg = new PlaneGeometry(1, 1);
    this.smokeGeo.setIndex(pg.getIndex());
    this.smokeGeo.setAttribute('position', pg.getAttribute('position'));
    this.aSrc = new InstancedBufferAttribute(new Float32Array(SMOKE_CAP * 4), 4);
    this.smokeGeo.setAttribute('aSrc', this.aSrc);
    this.smokeGeo.instanceCount = 0;
    this.smokeMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { ...shared, uWind: { value: new Vector3(1, 0, 0.3) }, uSmokeLit: { value: new Color('#FFF6EE') }, uSmokeShade: { value: new Color('#9A9CC0') }, uSmokeA: { value: 0.85 } },
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
    });
    const smoke = new Mesh(this.smokeGeo, this.smokeMat);
    smoke.renderOrder = 2;

    // Flags.
    const flg = flagGeometry();
    this.aFlag = new InstancedBufferAttribute(new Float32Array(FLAG_CAP * 4), 4);
    this.aCol = new InstancedBufferAttribute(new Float32Array(FLAG_CAP * 4), 4);
    flg.setAttribute('aFlag', this.aFlag);
    flg.setAttribute('aCol', this.aCol);
    this.flagMat = new ShaderMaterial({
      side: DoubleSide,
      uniforms: solidUniforms({ uWindK: { value: 0.4 } }),
      vertexShader: FLAG_VERT,
      fragmentShader: SOLID_FRAG,
    });
    this.flagMesh = new InstancedMesh(flg, this.flagMat, FLAG_CAP);
    this.flagMesh.count = 0;

    // Motes.
    const mg = new BufferGeometry();
    const seeds = new Float32Array(MOTE_N * 4);
    let r = 977;
    const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    mg.setAttribute('position', new BufferAttribute(new Float32Array(MOTE_N * 3), 3));
    mg.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    this.moteMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: shared.uTime, uDiskDir: shared.uDiskDir, uCentre: { value: new Vector3() }, uBox: { value: new Vector3(44, 18, 44) }, uAsh: { value: 0 }, uPx: { value: 600 }, uMoteC: { value: new Color('#FFF4E0') } },
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
    });
    this.motes = new Points(mg, this.moteMat);
    this.motes.renderOrder = 3;

    for (const o of [this.birdMesh, chairs, this.figMesh, smoke, this.flagMesh, this.motes]) {
      o.frustumCulled = false;
      this.root.add(o);
    }
    this.setPalette(palette, Mood.None);
  }

  // ---------------------------------------------------------------- settings

  setCourse(c: Course, p: Palette, mood: Mood): void {
    this.course = c;
    this.lastZ = Number.NaN;
    this.setPalette(p, mood);
  }

  setQuality(tier: Tier, dens: number): void {
    this.tier = tier;
    this.plan = PLANS[tier];
    this.dens = dens;
    this.range = -1;
    this.lastZ = Number.NaN;
    this.applyMood();
  }

  /** Re-colours and re-casts the life for a mountain and mood: which birds fly, whether the motes are
   *  dust or ash, who is out on the slopes at night. Light and fog come through the shared uniforms. */
  setPalette(p: Palette, mood: Mood): void {
    this.mood = mood;
    this.night = NIGHT.has(mood);
    // The flags' cloth: the mood's slalom blue-violets, then cream, sage and a dusty lilac, muted so
    // none of them borrows a signal colour.
    const [a, b] = flagColors(p);
    this.flagCols = [a, new Color('#E6DED0'), b, new Color('#7E9A88'), new Color('#A08AB4')];
    const wind = p.windStreaks > 0 ? 1 : this.night ? 0.25 : 0.45;
    this.flagMat.uniforms.uWindK.value = wind;
    (this.smokeMat.uniforms.uWind.value as Vector3).set(0.6 + 4.5 * (wind - 0.25), 0, 0.25 + 0.6 * wind);
    this.smokeMat.uniforms.uSmokeLit.value.set(this.night ? '#C8CCE6' : '#FFF6EE');
    (this.smokeMat.uniforms.uSmokeShade.value as Color).copy(p.snowShade).lerp(new Color('#E4E0EE'), 0.45);
    this.smokeMat.uniforms.uSmokeA.value = this.night ? 0.6 : p.windStreaks > 0 ? 0.55 : 0.95;
    const lamps = this.night ? 2.2 : 0;
    this.figMat.uniforms.uLamps.value = lamps;
    this.flagMat.uniforms.uGlowK.value = this.night ? 1.6 : 0;
    this.chairMat.uniforms.uPass.value = this.night ? 0.25 : p.windStreaks > 0 ? 0.4 : 0.75;
    this.applyMood();
    this.range = -1;
  }

  private applyMood(): void {
    const biome = this.course.biome;
    const pl = this.plan;
    let kind: BirdKind | null = this.night ? 'owl' : biome === 'blossom' ? 'crane' : 'crow';
    if (biome === 'volcanic') kind = null;
    if (kind) this.setBirdKind(kind);
    this.birdMesh.visible = pl.birds && kind !== null;
    // Motes: diamond dust in the clear, sunny moods; ash on Ember Peak. Medium and High.
    let mode = 0;
    if (pl.rich) {
      if (biome === 'volcanic') mode = 2;
      else if (this.mood === Mood.None || this.mood === Mood.GlassIce) mode = 1;
    }
    this.motes.visible = mode > 0;
    this.moteMat.uniforms.uAsh.value = mode === 2 ? 1 : 0;
    this.moteMat.blending = mode === 2 ? NormalBlending : AdditiveBlending;
    this.moteMat.uniforms.uMoteC.value.set(mode === 2 ? '#8A8296' : '#FFF4E0');
    this.motes.geometry.setDrawRange(0, this.tier === 'high' ? MOTE_N : Math.round(MOTE_N * 0.6));
    this.lastZ = Number.NaN;
  }

  private setBirdKind(kind: BirdKind): void {
    if (kind === this.birdKind) return;
    this.birdKind = kind;
    const g = birdGeometry(kind);
    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', g.getAttribute('position'));
    geo.setAttribute('aRig', g.getAttribute('aRig'));
    geo.setAttribute('aOrbit', this.aOrbit);
    geo.setAttribute('aFly', this.aFly);
    geo.setAttribute('aWay', this.aWay);
    geo.instanceCount = 0;
    this.birdGeo.dispose();
    this.birdGeo = geo;
    this.birdMesh.geometry = geo;
    const cols = BIRD_COLORS[kind];
    const u = this.birdMat.uniforms.uBirdC.value as Color[];
    for (let i = 0; i < 4; i++) u[i].set(cols[i]);
    this.birdSize = kind === 'crane' ? 1.9 : kind === 'owl' ? 1.6 : 1.35;
    this.flapHz = kind === 'crane' ? 1.1 : kind === 'owl' ? 1.6 : 2.8;
    this.birdMat.uniforms.uFlapAmp.value = kind === 'crane' ? 0.7 : 1;
    this.birdMat.uniforms.uSoar.value = kind === 'owl' ? 0.6 : 1;
  }

  // ---------------------------------------------------------------- per frame

  /** Moves the life on: (x, z) is the focus in sim space; `time` the shared clock.
   *  Beats scatter birds (a stomp, a crash) and startle the animals near them. */
  update(x: number, z: number, time: number, dt: number, beats: readonly Beat[], camPos: Vector3, camDir: Vector3): void {
    // A cut (a new run, the title reel) or a revive far off: re-cast everything round the focus.
    const jump = !(Math.abs(z - this.lastZ) < 200);
    this.lastZ = z;
    for (const b of beats) {
      if (b.type === 'stomp') this.startle(b.x, b.z, time);
      else if (b.type === 'crash') this.startle(x, z, time);
    }
    if (this.birdMesh.visible) this.updateBirds(z, jump);
    if (this.plan.rich) {
      const ci = Math.floor(z / CHUNK_LEN);
      const from = ci <= 0 ? -2 : ci - 1;
      const to = ci + (this.tier === 'high' ? 9 : 7);
      const key = from * 4096 + to;
      if (key !== this.range) {
        this.range = key;
        this.place(from, to);
      }
      this.updateFigures(z, time, dt, jump);
    } else {
      this.chairGeo.instanceCount = 0;
      this.smokeGeo.instanceCount = 0;
      this.flagMesh.count = 0;
      this.figMesh.count = 0;
    }
    if (this.motes.visible) {
      (this.moteMat.uniforms.uCentre.value as Vector3).copy(camPos).addScaledVector(camDir, 16);
      this.moteMat.uniforms.uPx.value = lensPx();
    }
  }

  /** A stomp or a crash at sim (x, z): birds within about 100 m burst up and away, and the animals
   *  near it bolt. */
  private startle(x: number, z: number, time: number): void {
    const c = this.course;
    const sc = this.birdMat.uniforms.uScatter.value as Vector4;
    sc.set(x, c.ground(x, z), -z, time);
    for (const f of this.figs) {
      if (f.live && f.kind <= F_FOX && f.fled < 0 && Math.abs(f.z - z) < 70) f.fled = time;
    }
  }

  // ---------------------------------------------------------------- birds

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private updateBirds(z: number, jump: boolean): void {
    const pl = this.plan;
    if (jump || this.flocks.length === 0) {
      // Lay the flocks out ahead of the focus (and one just behind), and the crossing flock.
      this.seed = (this.course.seed ^ 0x5bd1e995) >>> 0 || 1;
      this.flocks.length = 0;
      let first = 0;
      const owl = this.birdKind === 'owl';
      const n = owl ? 1 : this.mood === Mood.Blizzard ? 2 : pl.flocks;
      for (let k = 0; k < n; k++) {
        const size = owl ? 1 : this.birdKind === 'crane' ? 4 + Math.floor(this.rand() * 3) : 5 + Math.floor(this.rand() * 4);
        const f: Flock = { z: 0, side: 1, n: size, first, cross: false };
        first += size;
        this.flocks.push(f);
        this.anchor(f, z + 30 + (k / n) * 440 + this.rand() * 40);
      }
      if (pl.crossing && !owl && this.mood !== Mood.Blizzard) {
        const f: Flock = { z, side: this.rand() < 0.5 ? -1 : 1, n: this.birdKind === 'crane' ? 7 : 9, first, cross: true };
        first += f.n;
        this.flocks.push(f);
        this.anchor(f, z);
      }
      this.birdGeo.instanceCount = Math.min(BIRD_CAP, first);
      return;
    }
    for (const f of this.flocks) {
      // A flock wheeling behind the focus moves on ahead of it, into the fog.
      if (!f.cross && z - f.z > 70) this.anchor(f, z + 300 + this.rand() * 180);
      // The crossing flock keeps abreast of the focus; it is re-laid when far behind.
      if (f.cross && z - f.z > 500) this.anchor(f, z + 300);
    }
  }

  /** Puts flock f over sim z: over a bank (most) or the valley past it, its birds' circles round it. */
  private anchor(f: Flock, z: number): void {
    const c = this.course;
    f.z = z;
    f.side = this.rand() < 0.5 ? -1 : 1;
    const o = this.aOrbit.array as Float32Array;
    const fl = this.aFly.array as Float32Array;
    const w = this.aWay.array as Float32Array;
    const owl = this.birdKind === 'owl';
    if (f.cross) {
      // High over one side, flying along the valley in a loose V.
      const e = 70 + this.rand() * 60;
      const x = c.centerX(z) + f.side * (c.halfWidth(z) + e);
      const y = c.ground(c.centerX(z), z) + 55 + this.rand() * 20;
      const ang = (this.rand() - 0.5) * 0.5;
      const dx = Math.sin(ang);
      const dz = -Math.cos(ang) * (this.rand() < 0.5 ? 1 : -1);
      for (let i = 0; i < f.n; i++) {
        const k = f.first + i;
        const row = Math.ceil(i / 2);
        const s = i % 2 ? 1 : -1;
        o[k * 4] = x + (-dz * s * row * 2.6) - dx * row * 2.4;
        o[k * 4 + 1] = y + row * 0.3;
        o[k * 4 + 2] = -z + dx * s * row * 2.6 - dz * row * 2.4;
        o[k * 4 + 3] = 0;
        fl[k * 4] = 0;
        fl[k * 4 + 1] = 0.13;
        fl[k * 4 + 2] = this.flapHz * (0.9 + 0.2 * this.rand());
        fl[k * 4 + 3] = this.birdSize * 1.1;
        w[k * 4] = 1;
        w[k * 4 + 1] = dx;
        w[k * 4 + 2] = dz;
        w[k * 4 + 3] = this.birdKind === 'crane' ? 9 : 12;
      }
    } else {
      // Most wheel over the treeline (the circle kept outside the corridor), some over the valley.
      const valley = !owl && this.rand() < 0.2;
      const rad = owl ? 26 : valley ? 22 + this.rand() * 16 : 8 + this.rand() * 8;
      const e = valley ? 60 + this.rand() * 45 : rad * 1.3 + 2 + this.rand() * 14;
      const x = c.centerX(z) + f.side * (c.halfWidth(z) + e);
      const y = c.ground(x, z) + (owl ? 14 : valley ? 28 + this.rand() * 18 : 12 + this.rand() * 12);
      const dirn = this.rand() < 0.5 ? -1 : 1;
      for (let i = 0; i < f.n; i++) {
        const k = f.first + i;
        o[k * 4] = x + (this.rand() - 0.5) * 6;
        o[k * 4 + 1] = y + (this.rand() - 0.5) * 6;
        o[k * 4 + 2] = -z + (this.rand() - 0.5) * 6;
        o[k * 4 + 3] = rad * (0.75 + 0.5 * this.rand());
        // Angular speed for about 6 to 9 m/s round the circle.
        fl[k * 4] = (dirn * (owl ? 5 : 6 + 3 * this.rand())) / o[k * 4 + 3];
        fl[k * 4 + 1] = this.rand() * 6.28;
        fl[k * 4 + 2] = this.flapHz * (0.85 + 0.3 * this.rand());
        fl[k * 4 + 3] = this.birdSize * (0.85 + 0.3 * this.rand());
        w[k * 4] = 0;
      }
    }
    for (const a of [this.aOrbit, this.aFly, this.aWay]) {
      a.addUpdateRange(f.first * 4, f.n * 4);
      a.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- placed by chunk range

  /** Re-places the chairs, chimneys and flags for chunks from..to. Runs when the range moves. */
  private place(from: number, to: number): void {
    const c = this.course;
    const z0 = Math.max(0, from * CHUNK_LEN);
    const z1 = (to + 1) * CHUNK_LEN;
    // Chairs on every lift line in range.
    let nc = 0;
    this.secs.clear();
    const A = this.aA.array as Float32Array;
    const B = this.aB.array as Float32Array;
    const C = this.aC.array as Float32Array;
    const PER = 4;
    for (let z = z0; z < z1; z += 8) {
      const sec = c.section(z);
      if (this.secs.has(sec.z0)) continue;
      this.secs.add(sec.z0);
      const l = liftLine(sec);
      if (!l) continue;
      const towers: number[] = [];
      for (let tz = l.z0; tz <= l.z1; tz += LIFT_STEP) towers.push(tz);
      for (let j = 0; j + 1 < towers.length; j++) {
        const ta = towers[j];
        const tb = towers[j + 1];
        if (tb < z0 - 10 || ta > z1) continue;
        const a = this.v.set(c.centerX(ta) + l.side * (c.halfWidth(ta) + l.e), 0, 0);
        a.y = c.ground(a.x, ta) - 0.3 + LIFT_TOP;
        a.z = -ta;
        const bx = c.centerX(tb) + l.side * (c.halfWidth(tb) + l.e);
        const b = this.v2.set(bx, c.ground(bx, tb) - 0.3 + LIFT_TOP, -tb);
        // The cable's frame as the dressing builds it: along the span, up, and across.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dy, dz);
        const ux = dx / len;
        const uy = dy / len;
        const uz = dz / len;
        let yx = -uy * ux;
        let yy = 1 - uy * uy;
        let yz = -uy * uz;
        const yl = Math.hypot(yx, yy, yz);
        yx /= yl;
        yy /= yl;
        yz /= yl;
        const zx = uy * yz - uz * yy;
        const zy = uz * yx - ux * yz;
        const zz = ux * yy - uy * yx;
        const ends = (j === 0 ? 1 : 0) + (j + 2 === towers.length ? 2 : 0);
        for (const line of [-1, 1]) {
          for (let k = 0; k < PER && nc < CHAIR_CAP; k++) {
            const o = nc * 4;
            A[o] = a.x - 0.15 * yx + line * 1.6 * zx;
            A[o + 1] = a.y - 0.15 * yy + line * 1.6 * zy;
            A[o + 2] = a.z - 0.15 * yz + line * 1.6 * zz;
            A[o + 3] = ends;
            B[o] = b.x - 0.15 * yx + line * 1.6 * zx;
            B[o + 1] = b.y - 0.15 * yy + line * 1.6 * zy;
            B[o + 2] = b.z - 0.15 * yz + line * 1.6 * zz;
            B[o + 3] = PER;
            // One line rides up the slope (toward -sim z: from b back to a), the other down.
            C[o] = j + k / PER + (line > 0 ? 0.5 / PER : 0);
            C[o + 1] = line > 0 ? -1 : 1;
            C[o + 2] = (sec.z0 % 997) + (line > 0 ? 0.5 : 0);
            C[o + 3] = 0;
            nc++;
          }
        }
      }
    }
    this.chairGeo.instanceCount = nc;
    for (const a of [this.aA, this.aB, this.aC]) a.needsUpdate = true;

    // Chimneys and the flags by each cabin, and the section heads' banners.
    let ns = 0;
    this.flagN = 0;
    const S = this.aSrc.array as Float32Array;
    const blossom = c.biome === 'blossom';
    for (let i = Math.max(0, from); i <= to; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const sp = cabinSpot(c, i, side, this.dens);
        if (!sp) continue;
        const cs = Math.cos(sp.yaw);
        const sn = Math.sin(sp.yaw);
        // The cabin's local point (lx, ly, lz) in the world.
        const wx = (lx: number, lz: number) => sp.x + lx * cs + lz * sn;
        const wz = (lx: number, lz: number) => sp.z - lx * sn + lz * cs;
        if (ns + SMOKE_PER <= SMOKE_CAP) {
          const hx = wx(1.3, -0.5);
          const hz = wz(1.3, -0.5);
          const ph = (i * 0.618 + side * 0.31) % 1;
          for (let k = 0; k < SMOKE_PER; k++) {
            const o = ns * 4;
            S[o] = hx;
            S[o + 1] = sp.y + 4.2;
            S[o + 2] = hz;
            S[o + 3] = (k / SMOKE_PER + ph + 1) % 1;
            ns++;
          }
        }
        // A line from the gable end to a pole out along the bank, prayer flags or paper lanterns on it.
        const px = wx(-8, 0.8);
        const pz = wz(-8, 0.8);
        const py = c.ground(px, -pz) - 0.1;
        this.v.set(wx(-2.3, 0), sp.y + 3.3, wz(-2.3, 0));
        this.v2.set(px, py + 3.4, pz);
        this.flagLine(this.v, this.v2, blossom, i * 7 + side);
        this.rigid(px, py, pz, px, py + 3.6, pz, 0.09, '#5E4E56');
      }
    }
    if (this.farChimneys) {
      const n = this.farChimneys(this.chimBuf);
      for (let k = 0; k < n; k++) {
        const ch = this.chimBuf[k];
        for (let j = 0; j < SMOKE_PER && ns < SMOKE_CAP; j++) {
          const o = ns * 4;
          S[o] = ch.x;
          S[o + 1] = ch.y;
          S[o + 2] = ch.z;
          S[o + 3] = 2 + ((j / SMOKE_PER + k * 0.37) % 1);
          ns++;
        }
      }
    }
    this.smokeGeo.instanceCount = ns;
    this.aSrc.needsUpdate = true;
    // A pair of feather banners at each section's head, at the treeline's foot.
    this.secs.clear();
    for (let z = z0; z < z1; z += 8) {
      const sec = c.section(z);
      if (this.secs.has(sec.z0)) continue;
      this.secs.add(sec.z0);
      const hz = sec.z0 + 34;
      if (hz < z0 || hz > z1 || hz < 120) continue;
      for (let side = -1; side <= 1; side += 2) {
        const x = c.centerX(hz) + side * (c.halfWidth(hz) + 10.4);
        const y = c.ground(x, hz) - 0.1;
        this.rigid(x, y, -hz, x, y + 4.6, -hz, 0.1, '#4A4E66');
        // The banner along the pole's top 2.8 m, flying down the run.
        this.m.makeBasis(this.v.set(0, 0, 1.0), this.v2.set(0, 2.8, 0), this.s.set(-1, 0, 0));
        this.m.setPosition(x, y + 4.5, -hz);
        this.pushFlag(this.m, 1, 0.8, (side + 2) * 1.3 + hz * 0.01, this.flagCols[side < 0 ? 0 : 2], 0);
      }
    }
    this.flagMesh.count = this.flagN;
    this.flagMesh.instanceMatrix.needsUpdate = true;
    this.aFlag.needsUpdate = true;
    this.aCol.needsUpdate = true;
  }

  /** A flag line sagging from a to b (two rigid lengths of cord), hung with flags or lanterns. */
  private flagLine(from: Vector3, to: Vector3, lanterns: boolean, seed: number): void {
    // (Its own copies: the pieces below are placed through the shared temporaries.)
    const a = this.la.copy(from);
    const b = this.lb.copy(to);
    const SAG = 0.7;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - SAG;
    const mz = (a.z + b.z) / 2;
    this.rigid(a.x, a.y, a.z, mx, my, mz, 0.025, '#3A3550');
    this.rigid(mx, my, mz, b.x, b.y, b.z, 0.025, '#3A3550');
    const n = lanterns ? 5 : 8;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const hl = Math.hypot(dx, dz);
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const x = a.x + dx * t;
      const y = a.y + (b.y - a.y) * t - SAG * 4 * t * (1 - t);
      const z = a.z + dz * t;
      if (lanterns) {
        // A paper lantern on a short drop, glowing a soft peach at night.
        this.m.makeBasis(this.v.set(0.46, 0, 0), this.v2.set(0, 0.6, 0), this.s.set(0, 0, 23));
        this.m.setPosition(x - 0.23, y - 0.05, z);
        this.pushFlag(this.m, 3, 0, seed + k * 1.7, new Color('#F4D2C4'), 1);
      } else {
        // Each flag hangs from the cord, its face across the line.
        this.m.makeBasis(this.v.set((dx / hl) * 0.44, 0, (dz / hl) * 0.44), this.v2.set(0, 0.55, 0), this.s.set(-dz / hl, 0, dx / hl));
        this.m.setPosition(x - (dx / hl) * 0.22, y, z - (dz / hl) * 0.22);
        this.pushFlag(this.m, 0, 0.8, seed + k * 1.3, this.flagCols[k % this.flagCols.length], 0);
      }
    }
  }

  /** A rigid stick from (x0, y0, z0) to (x1, y1, z1) of thickness w (a pole, a cord). */
  private rigid(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, col: string): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const ax = this.rx.set(dx, dy, dz);
    // Any axis across it for the thickness.
    const l = Math.hypot(dx, dy, dz);
    const ay = Math.abs(dy) > 0.9 * l ? this.ry.set(w, 0, 0) : this.ry.set(0, w, 0);
    const az = this.rz.crossVectors(ax, ay).normalize().multiplyScalar(w / 0.02);
    this.m.makeBasis(ax, ay, az);
    // (The panel hangs from y 0 to -1: lift the stick by half its thickness.)
    this.m.setPosition(x0 + ay.x * 0.5, y0 + ay.y * 0.5, z0 + ay.z * 0.5);
    this.pushFlag(this.m, 2, 0, 0, this.tmpCol.set(col), 0);
  }

  private tmpCol = new Color();
  private la = new Vector3();
  private lb = new Vector3();
  private rx = new Vector3();
  private ry = new Vector3();
  private rz = new Vector3();

  private pushFlag(m: Matrix4, kind: number, flutter: number, phase: number, col: Color, glow: number): void {
    const i = this.flagN;
    if (i >= FLAG_CAP) return;
    this.flagMesh.setMatrixAt(i, m);
    const f = this.aFlag.array as Float32Array;
    f[i * 4] = flutter;
    f[i * 4 + 1] = phase;
    f[i * 4 + 2] = kind;
    const a = this.aCol.array as Float32Array;
    a[i * 4] = col.r;
    a[i * 4 + 1] = col.g;
    a[i * 4 + 2] = col.b;
    a[i * 4 + 3] = glow;
    this.flagN++;
  }

  // ---------------------------------------------------------------- figures

  private updateFigures(z: number, time: number, dt: number, jump: boolean): void {
    const pl = this.plan;
    const figs = this.figs;
    const people = !this.night && this.mood !== Mood.Haunted;
    const wantSkiers = people ? (this.mood === Mood.Blizzard ? Math.ceil(pl.skiers / 3) : pl.skiers) : 0;
    const wantCat = this.night ? 1 : 0;
    if (jump) for (const f of figs) f.live = false;
    // Count who is out, and send off whoever the focus has left behind.
    let deer = 0;
    let hares = 0;
    let foxes = 0;
    let skiers = 0;
    let cats = 0;
    for (const f of figs) {
      if (!f.live) continue;
      if (z - f.z > 45 || (f.kind === F_CAT && z - f.z > 80)) {
        f.live = false;
        continue;
      }
      if (f.kind === F_DEER || f.kind === F_IBEX) deer++;
      else if (f.kind === F_HARE) hares++;
      else if (f.kind === F_FOX) foxes++;
      else if (f.kind === F_CAT) cats++;
      else skiers++;
    }
    const ibex = this.course.biome === 'glacier' || this.course.biome === 'volcanic';
    // Deer come in small groups, standing together at the treeline's foot.
    while (deer < pl.deerGroups * 2) {
      const n = 1 + Math.floor(this.rand() * 3);
      deer += n;
      const zz = this.foot(this.ahead(z, jump, 0));
      if (zz < 0) continue;
      const side = this.rand() < 0.5 ? -1 : 1;
      for (let k = 0; k < n; k++) this.spawn(ibex ? F_IBEX : F_DEER, side, 9.3 + this.rand() * 0.5 + k * 0.3, zz + k * 2.6 + this.rand());
    }
    for (; hares < pl.hares; hares++) this.spawn(F_HARE, this.rand() < 0.5 ? -1 : 1, 9.3 + this.rand() * 0.7, this.foot(this.ahead(z, jump, 0)));
    for (; foxes < pl.foxes; foxes++) this.spawn(F_FOX, this.rand() < 0.5 ? -1 : 1, 9.3 + this.rand() * 0.4, this.foot(this.ahead(z, jump, 0)));
    for (; skiers < wantSkiers; skiers++) this.spawn(this.rand() < 0.35 ? F_BOARD : F_SKIER, this.rand() < 0.5 ? -1 : 1, this.farGround ? 140 + this.rand() * 280 : 15 + this.rand() * 35, this.ahead(z, jump, -150 + this.rand() * 100));
    for (; cats < wantCat; cats++) this.spawn(F_CAT, this.rand() < 0.5 ? -1 : 1, this.farGround ? 120 + this.rand() * 200 : 16 + this.rand() * 20, this.ahead(z, jump, 0));

    // Walk them on, and write each one's matrix and gait.
    const c = this.course;
    const P = this.aPick.array as Float32Array;
    const N = this.aAnim.array as Float32Array;
    let n = 0;
    for (const f of figs) {
      if (!f.live) continue;
      f.age += dt;
      let move = 0;
      let hop = 0;
      let rate = 0;
      let lean = 0;
      if (f.kind <= F_FOX) {
        const trig = f.kind === F_HARE ? 32 : f.kind === F_FOX ? 38 : 48;
        if (f.fled < 0 && z > f.z - trig) f.fled = time;
        if (f.fled >= 0) {
          // Away from the run, up the bank into the trees and a little down the slope.
          const t = time - f.fled;
          const target = f.kind === F_HARE ? 0.9 + 0.5 * Math.sin(t * 5) : f.kind === F_FOX ? 1.15 : 0.95;
          f.dir += (target * f.side - f.dir) * Math.min(1, dt * 6);
          const sp = Math.min(1, t * 3) * f.speed;
          f.e += Math.sin(Math.abs(f.dir)) * sp * dt;
          f.z += Math.cos(f.dir) * sp * dt;
          move = 1;
          rate = f.kind === F_HARE ? 4.2 : f.kind === F_FOX ? 3.4 : 2.3;
          hop = f.kind === F_HARE ? 0.32 : f.kind === F_FOX ? 0.08 : 0.55;
          if (t > 9) f.live = false;
        } else if (f.kind === F_FOX) {
          // A fox trots along the forest's edge, down the slope.
          f.z += 1.3 * dt;
          move = 0.7;
          rate = 2.0;
          hop = 0.02;
        }
      } else if (f.kind === F_CAT) {
        f.z -= 2.4 * dt;
        f.dir = Math.PI;
        move = 0;
      } else {
        // Carving S-turns down the slope.
        const w = (2 * Math.PI) / f.period;
        f.z += f.speed * dt;
        const s = Math.sin(f.age * w);
        f.e = f.e0 + f.amp * s;
        const de = f.amp * w * Math.cos(f.age * w);
        f.dir = Math.atan2(de * f.side, f.speed);
        lean = -f.amp * w * w * s * f.side * 0.05;
      }
      f.gait += dt * rate * 2 * Math.PI;
      // World position and heading.
      const hw = c.halfWidth(f.z);
      const x = c.centerX(f.z) + f.side * (hw + f.e);
      let gy: number;
      if (f.far && this.farGround) {
        if (f.gk <= 0) {
          f.gy = this.farGround(x, f.z);
          f.gk = 3;
        }
        f.gk--;
        gy = f.gy;
      } else gy = c.ground(x, f.z);
      if (!(gy > -1e6)) {
        f.live = false;
        continue;
      }
      // The run's own direction here, and the heading off it.
      const cx2 = c.centerX(f.z + 2) + f.side * (c.halfWidth(f.z + 2) + f.e);
      const run = Math.atan2(cx2 - x, 2);
      const head = run + f.dir;
      // Sim heading (from +z toward +x) to a yaw about three's up: local +x along (sin h, -cos h).
      const yaw = Math.atan2(Math.cos(head), Math.sin(head));
      this.q.setFromAxisAngle(this.up, yaw);
      if (lean !== 0) this.q.multiply(this.q2.setFromAxisAngle(this.xAxis, Math.max(-0.6, Math.min(0.6, lean))));
      const sc = f.kind === F_HARE ? 2.0 : f.kind === F_FOX ? 1.7 : f.kind === F_SKIER || f.kind === F_BOARD ? 1.6 : f.kind === F_CAT ? 1 : 1.25;
      this.m.compose(this.v.set(x, gy - 0.05, -f.z), this.q, this.s.setScalar(sc));
      this.figMesh.setMatrixAt(n, this.m);
      P[n] = f.kind;
      N[n * 4] = f.gait;
      N[n * 4 + 1] = move;
      N[n * 4 + 2] = hop;
      N[n * 4 + 3] = f.tint;
      n++;
    }
    this.figMesh.count = n;
    this.figMesh.instanceMatrix.needsUpdate = true;
    this.aPick.needsUpdate = true;
    this.aAnim.needsUpdate = true;
  }

  /** Where a newcomer is placed: well ahead, in the fog (anywhere in view after a cut). */
  private ahead(z: number, jump: boolean, k: number): number {
    return z + (jump ? 30 + this.rand() * 420 : 300 + this.rand() * 180) + k;
  }

  /** Animals stand at the treeline's foot, where the gully's walls and the bowl's cornice would hide
   *  them: those stretches are passed over (-1: none near). */
  private foot(z: number): number {
    for (let k = 0; k < 6; k++, z += 45) {
      const sig = signature(this.course, z);
      if (!((sig.kind === 'gully' || sig.kind === 'bowl') && sig.k > 0.05)) return z;
    }
    return -1;
  }

  private spawn(kind: number, side: number, e: number, z: number): void {
    const f = this.figs.find((g) => !g.live);
    if (!f || z < 0) return;
    f.live = true;
    f.kind = kind;
    f.side = side;
    f.e0 = f.e = e;
    f.z0 = f.z = Math.max(80, z);
    f.age = this.rand() * 10;
    f.fled = -1;
    f.gait = this.rand() * 6.28;
    f.tint = Math.floor(this.rand() * JACKETS.length);
    f.far = kind >= F_SKIER && this.farGround !== null;
    f.gk = 0;
    if (kind === F_DEER || kind === F_IBEX) {
      // Standing turned toward the run, a little off square.
      f.dir = side * (-1.3 + this.rand() * 0.8);
      f.speed = 7 + this.rand() * 2;
    } else if (kind === F_HARE) {
      f.dir = side * (this.rand() - 0.5) * 2;
      f.speed = 9 + this.rand() * 3;
    } else if (kind === F_FOX) {
      f.dir = side * 0.15;
      f.speed = 6;
    } else {
      f.speed = kind === F_CAT ? 2.4 : 6 + this.rand() * 5;
      f.amp = 3 + this.rand() * 5;
      f.period = 3 + this.rand() * 2.5;
      f.dir = 0;
    }
  }
}
