import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, Quaternion, ShaderMaterial, Vector3, Vector4 } from 'three';
import { merge, part, shade } from './flora';
import { box, grade, seg, type V3 } from './landmarkKit';
import { shared } from './materials';

// Round 7 (the momentsworld lane): the forms and the materials the legends are drawn with (legendworld.ts
// stages them). Creatures are built in their own frame, facing three.js -z (down the course), y up, in
// metres at scale 1; every part is flat-shaded and vertex-coloured like the rest of the world. The sky
// legends (the fleet, the cranes, the aurora, the eruption) are single draws whose motion lives in the
// vertex shader, so a thousand lanterns cost the frame no script at all.

const Z = new Vector3(0, 0, 1);
const tq = new Quaternion();
const tv = new Vector3();

type Ring = readonly [z: number, y: number, rx: number, ry: number];

/** A faceted skin over a row of elliptical rings along z (each: z, centre y, half-width, half-height),
 *  capped at both ends. */
function loft(rings: readonly Ring[], sides: number, col: Color): BufferGeometry {
  const rs = [...rings].sort((a, b) => a[0] - b[0]);
  const arr: number[] = [];
  const pt = (r: Ring, i: number): V3 => {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    return [Math.cos(a) * r[2], r[1] + Math.sin(a) * r[3], r[0]];
  };
  for (let k = 0; k < rs.length - 1; k++) {
    for (let i = 0; i < sides; i++) {
      const a = pt(rs[k], i);
      const b = pt(rs[k], i + 1);
      const c = pt(rs[k + 1], i + 1);
      const d = pt(rs[k + 1], i);
      arr.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const first = rs[0];
  const last = rs[rs.length - 1];
  for (let i = 0; i < sides; i++) {
    arr.push(0, first[1], first[0], ...pt(first, i + 1), ...pt(first, i));
    arr.push(0, last[1], last[0], ...pt(last, i), ...pt(last, i + 1));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(arr), 3));
  return part(g, col);
}

/** Lays a form built along +z from the origin so it runs from `a` toward `b`. */
function aim(g: BufferGeometry, a: V3, b: V3): BufferGeometry {
  tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  tq.setFromUnitVectors(Z, tv);
  g.applyQuaternion(tq);
  g.translate(a[0], a[1], a[2]);
  g.computeVertexNormals();
  return g;
}

/** A tapered limb from a to b: r0 at a, r1 at b, `flat` narrowing it across. */
function limb(a: V3, b: V3, r0: number, r1: number, col: Color, sides = 6, flat = 1): BufferGeometry {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return aim(loft([[0, 0, r0 * flat, r0], [len * 0.5, 0, (r0 + r1) * 0.52 * flat, (r0 + r1) * 0.52], [len, 0, r1 * flat, r1]], sides, col), a, b);
}

/** A sheet of paper: one triangle seen from both sides. */
function leaf(a: V3, b: V3, c: V3, col: Color): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...b]), 3));
  return part(g, col);
}

// ---------------------------------------------------------------- the stag and the herd

export interface DeerForms {
  torso: BufferGeometry;
  head: BufferGeometry;
  upper: BufferGeometry;
  lower: BufferGeometry;
}

/** Where a deer's parts hang, in the torso's frame (the torso's origin is its middle, at hip height). */
export const DEER = {
  /** The torso's origin over the snow when it stands. */
  stand: 1.5,
  neck: [0, 0.2, -0.82] as V3,
  /** Front and hind hips (x is mirrored for the near and far leg). */
  front: [0.17, -0.2, -0.6] as V3,
  hind: [0.17, -0.12, 0.6] as V3,
  /** A leg's upper part, hip to knee. */
  upper: 0.72,
};

/** A deer in four forms (the torso, the neck and head with its antlers, a leg's upper and lower part), so
 *  a gallop is ten instances. `stag`: the white stag's great many-tined rack. Otherwise one of the herd:
 *  heavier in the chest, its head carried low and forward, antlers swept back with a brow blade. */
export function deerForms(stag: boolean): DeerForms {
  const coat = new Color(stag ? '#F2F7FF' : '#DCEBFF');
  const bone = new Color(stag ? '#FFF6DC' : '#F1F8FF').multiplyScalar(stag ? 1.5 : 1.35);
  const hoof = new Color('#CFE6FF').multiplyScalar(1.6);
  const k = stag ? 1 : 1.14;
  const torso = merge([
    grade(loft([[-0.98, 0.12, 0.1 * k, 0.17 * k], [-0.78, 0.03, 0.24 * k, 0.38 * k], [-0.4, -0.06, 0.31 * k, 0.45 * k], [0.15, -0.02, 0.28 * k, 0.37 * k], [0.62, 0.02, 0.27, 0.34], [0.9, 0.08, 0.1, 0.14]], 8, coat), -0.5, 0.42, 0.66, 1.06),
    limb([0, 0.18, 0.84], [0, 0.36, 1.1], 0.075, 0.03, coat, 5),
  ]);
  // The neck and the head, from the neck's root.
  const top: V3 = stag ? [0, 0.8, -0.4] : [0, 0.5, -0.62];
  const nose: V3 = stag ? [0, 0.66, -1.02] : [0, 0.28, -1.22];
  const skull: V3 = [top[0], top[1] - 0.04, top[2] + 0.06];
  const dir = tv.set(nose[0] - skull[0], nose[1] - skull[1], nose[2] - skull[2]);
  const len = dir.length();
  const head: BufferGeometry[] = [
    grade(aim(loft([[0, 0, 0.2 * k, 0.27 * k], [0.45, 0, 0.16 * k, 0.21 * k], [0.92, 0, 0.12, 0.15]], 7, coat), [0, -0.05, 0.05], top), -0.1, 0.8, 0.74, 1.06),
    aim(loft([[0, 0, 0.11, 0.12], [len * 0.3, 0, 0.13, 0.14], [len * 0.72, 0, 0.08, 0.09], [len, 0, 0.052, 0.06]], 6, coat), skull, nose),
  ];
  if (!stag) head.push(limb([0, 0.1, -0.2], [0, -0.42, -0.42], 0.2, 0.05, shade(coat, 0.9), 5, 0.7));
  for (const sd of [-1, 1]) {
    head.push(limb([sd * 0.09, top[1] + 0.04, top[2] + 0.02], [sd * 0.3, top[1] + 0.2, top[2] + 0.12], 0.055, 0.012, coat, 4, 0.5));
    // Antlers: a beam in short straight runs, and its tines.
    const o: V3 = [sd * 0.07, top[1] + 0.06, top[2] - 0.02];
    const at = (x: number, y: number, z: number): V3 => [o[0] + sd * x, o[1] + y, o[2] + z];
    const beam: V3[] = stag ? [at(0, 0, 0), at(0.25, 0.4, 0.17), at(0.43, 0.85, 0.12), at(0.45, 1.25, -0.13), at(0.35, 1.5, -0.43)] : [at(0, 0, 0), at(0.26, 0.42, 0.32), at(0.42, 0.9, 0.6), at(0.38, 1.3, 0.42), at(0.26, 1.52, 0.1)];
    const tines: [number, V3][] = stag
      ? [[0, at(0.1, 0.2, -0.4)], [1, at(0.43, 0.52, -0.3)], [2, at(0.75, 1.1, -0.08)], [3, at(0.23, 1.62, 0.07)], [3, at(0.66, 1.52, -0.3)]]
      : [[1, at(0.5, 0.56, 0.5)], [3, at(0.56, 1.5, 0.52)], [4, at(0.3, 1.74, -0.08)], [4, at(0.1, 1.62, -0.14)]];
    for (let i = 0; i < beam.length - 1; i++) head.push(seg(beam[i], beam[i + 1], 0.045 - i * 0.006, bone, 4));
    for (const [i, tip] of tines) head.push(limb(beam[i], tip, 0.034, 0.012, bone, 4));
    // (The herd's brow blade: a flat shovel of antler over the muzzle.)
    if (!stag) head.push(leaf(at(0, 0.02, -0.04), at(0.02, 0.34, -0.5), at(0.04, 0.04, -0.46), bone));
  }
  const upper = grade(limb([0, 0.06, 0], [0, -DEER.upper, 0], 0.13 * k, 0.062, coat, 6, 0.78), -DEER.upper, 0, 0.74, 1.02);
  const lower = merge([limb([0, 0.03, 0], [0, -0.74, 0], 0.056, 0.04, shade(coat, 0.86), 5), box(0.11, 0.1, 0.15, hoof, [0, -0.78, -0.02])]);
  return { torso, head: merge(head), upper, lower };
}

/** A creature of light with a body: its facets hold their value, its edge burns brighter than its heart
 *  (so it reads on white snow and against a dark wall alike), and `uBody` under 1 lets the world through
 *  it. It writes depth, so a herd is clean silhouettes and never a tangle of insides. */
export function spiritMaterial(body: number, rim: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexColors: true,
    transparent: true,
    uniforms: { uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uAlpha: { value: 1 }, uBody: { value: body }, uRim: { value: rim } },
    vertexShader: /* glsl */ `
      varying vec3 vCol;
      varying vec3 vN;
      varying vec3 vV;
      varying float vDist;
      void main() {
        vCol = color;
        #ifdef USE_INSTANCING_COLOR
          vCol *= instanceColor;
        #endif
        #ifdef USE_INSTANCING
          mat4 m = modelMatrix * instanceMatrix;
        #else
          mat4 m = modelMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vN = normalize(mat3(m) * normal);
        vV = cameraPosition - wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uAlpha;
      uniform float uBody;
      uniform float uRim;
      varying vec3 vCol;
      varying vec3 vN;
      varying vec3 vV;
      varying float vDist;
      void main() {
        vec3 n = normalize(vN);
        float fr = 1.0 - abs(dot(n, normalize(vV)));
        fr = fr * fr;
        // A cool shade under the belly, the light's own colour on top, the edge hottest.
        vec3 c = vCol * mix(vec3(0.62, 0.74, 0.98), vec3(1.0), 0.5 + 0.5 * n.y) + vCol * fr * uRim;
        float f = 0.5 * smoothstep(uFogNear, uFogFar, vDist);
        gl_FragColor = vec4(mix(c, uFog, f), uAlpha * mix(uBody, 1.0, fr));
      }
    `,
  });
}

// ---------------------------------------------------------------- the cinder wyrm

/** One plate of the wyrm's back: a glowing shell with a blade of brighter cinder down its spine. */
export function wyrmPlate(): BufferGeometry {
  const hot = new Color('#FF7A2E');
  const blade = new Color('#FFD06A').multiplyScalar(1.5);
  return merge([
    grade(loft([[-0.66, 0, 0.44, 0.38], [-0.22, 0.02, 0.74, 0.62], [0.34, 0, 0.66, 0.54], [0.66, 0, 0.42, 0.36]], 7, hot), -0.6, 0.6, 0.5, 1.15),
    leaf([0, 0.46, -0.5], [0, 1.3, 0.28], [0, 0.44, 0.6], blade),
    leaf([0.5, 0.1, -0.3], [1.02, 0.34, 0.42], [0.46, 0.06, 0.4], shade(blade, 0.8)),
    leaf([-0.5, 0.1, -0.3], [-1.02, 0.34, 0.42], [-0.46, 0.06, 0.4], shade(blade, 0.8)),
  ]);
}

/** The wyrm's head: a long wedge with a white-hot brow, two swept blades and a mane's roots. */
export function wyrmHead(): BufferGeometry {
  const hot = new Color('#FFB24A').multiplyScalar(1.25);
  const white = new Color('#FFF1C2').multiplyScalar(1.9);
  const blade = new Color('#FFD06A').multiplyScalar(1.5);
  const parts: BufferGeometry[] = [
    grade(loft([[-1.7, -0.1, 0.16, 0.13], [-1.15, -0.04, 0.42, 0.3], [-0.4, 0.06, 0.8, 0.6], [0.3, 0.05, 0.84, 0.68], [0.9, 0, 0.5, 0.44]], 7, hot), -0.6, 0.7, 0.55, 1.2),
    loft([[-1.5, -0.42, 0.14, 0.07], [-0.5, -0.5, 0.5, 0.12], [0.2, -0.42, 0.42, 0.1]], 5, shade(hot, 0.8)),
  ];
  for (const sd of [-1, 1]) {
    parts.push(box(0.2, 0.16, 0.34, white, [sd * 0.5, 0.36, -0.62], [0, sd * 0.3, 0]));
    parts.push(leaf([sd * 0.42, 0.52, -0.2], [sd * 0.95, 1.5, 1.25], [sd * 0.5, 0.4, 0.6], blade));
    parts.push(leaf([sd * 0.72, 0.1, -0.1], [sd * 1.7, 0.36, 1.1], [sd * 0.7, 0, 0.6], blade));
  }
  parts.push(leaf([0, 0.62, -0.5], [0, 1.7, 0.7], [0, 0.6, 0.8], white));
  return merge(parts);
}

// ---------------------------------------------------------------- the lantern dragon

/** One lantern of the dragon's body: a paper drum on its side (the instance's colour is the paper's),
 *  lacquer hoops at its ends, a paper crest on its back and a tassel under it. */
export function dragonDrum(): BufferGeometry {
  const paper = new Color('#FFF6E4');
  const wine = new Color('#5E1F33');
  const gold = new Color('#FFD98A').multiplyScalar(1.3);
  return merge([
    grade(loft([[-0.6, 0, 0.6, 0.6], [-0.3, 0, 0.8, 0.8], [0.3, 0, 0.8, 0.8], [0.6, 0, 0.6, 0.6]], 10, paper), -0.8, 0.8, 1.25, 0.9, 0),
    loft([[-0.7, 0, 0.5, 0.5], [-0.58, 0, 0.63, 0.63]], 10, wine),
    loft([[0.58, 0, 0.63, 0.63], [0.7, 0, 0.5, 0.5]], 10, wine),
    // (Seen end-on, a drum is its lit paper end, not a dark disc.)
    loft([[-0.73, 0, 0.3, 0.3], [-0.705, 0, 0.47, 0.47]], 10, gold),
    loft([[0.705, 0, 0.47, 0.47], [0.73, 0, 0.3, 0.3]], 10, gold),
    leaf([0, 0.76, -0.5], [0, 1.5, 0.1], [0, 0.76, 0.5], new Color('#FFE9EE').multiplyScalar(1.15)),
    limb([0, -0.78, 0], [0, -1.25, 0.12], 0.07, 0.02, gold, 4),
  ]);
}

/** The dragon's head (an original shape: a long lacquered muzzle under a paper brow, two forked horns of
 *  gilt wood, lit eyes, a paper mane), from the neck's joint at the origin. */
export function dragonHead(): BufferGeometry {
  const paper = new Color('#FFD25A').multiplyScalar(1.15);
  const rose = new Color('#FF8FA8').multiplyScalar(1.1);
  const wine = new Color('#5E1F33');
  const gold = new Color('#FFE2A0').multiplyScalar(1.45);
  const white = new Color('#FFFBEA').multiplyScalar(1.9);
  const parts: BufferGeometry[] = [
    grade(loft([[-2.3, -0.12, 0.3, 0.22], [-1.5, 0, 0.52, 0.4], [-0.6, 0.18, 0.92, 0.78], [0.25, 0.12, 0.95, 0.86], [0.8, 0, 0.6, 0.6]], 8, paper), -0.7, 0.9, 1.2, 0.92, 0),
    // The jaw, hung open, lacquer with a gilt lip.
    loft([[-2.05, -0.72, 0.24, 0.08], [-1.0, -0.86, 0.5, 0.14], [0.1, -0.7, 0.6, 0.16]], 6, wine),
    box(0.9, 0.07, 1.5, gold, [0, -0.7, -1.0], [0.1, 0, 0]),
    // The nose and the brow.
    box(0.5, 0.26, 0.3, wine, [0, 0.14, -2.3]),
    box(1.5, 0.2, 0.5, wine, [0, 0.86, -0.72], [0.25, 0, 0]),
  ];
  for (const sd of [-1, 1]) {
    parts.push(box(0.3, 0.3, 0.12, white, [sd * 0.62, 0.52, -0.95], [0, sd * 0.5, 0]));
    // A horn that forks once.
    const a: V3 = [sd * 0.45, 0.9, -0.3];
    const b: V3 = [sd * 0.75, 1.75, 0.5];
    parts.push(limb(a, b, 0.11, 0.07, gold, 5), limb(b, [sd * 0.6, 2.6, 1.2], 0.07, 0.02, gold, 4), limb(b, [sd * 1.25, 2.15, 1.05], 0.06, 0.02, gold, 4));
    // The mane: paper flames swept back off the cheeks and the crown.
    parts.push(leaf([sd * 0.9, 0.5, -0.4], [sd * 1.8, 0.95, 1.2], [sd * 0.92, 0, 0.5], rose));
    parts.push(leaf([sd * 0.86, -0.1, -0.2], [sd * 1.55, -0.3, 1.3], [sd * 0.8, -0.5, 0.5], new Color('#FFF3F6')));
    parts.push(leaf([sd * 0.3, 0.9, 0.0], [sd * 0.5, 1.5, 1.5], [sd * 0.3, 0.8, 0.9], rose));
  }
  return merge(parts);
}

/** The dragon's tail: a fan of three paper blades. */
export function dragonTail(): BufferGeometry {
  const rose = new Color('#FF8FA8').multiplyScalar(1.15);
  const cream = new Color('#FFF3F6').multiplyScalar(1.1);
  return merge([leaf([0, 0.3, -0.3], [0, 1.7, 1.9], [0, 0.1, 1.2], rose), leaf([0, 0, -0.3], [0, 0.1, 2.5], [0, -0.5, 1.3], cream), leaf([0, -0.3, -0.3], [0, -1.5, 1.9], [0, -0.6, 1.0], rose), leaf([-0.2, 0, -0.2], [-1.2, 0.2, 1.8], [-0.3, 0, 1.2], cream), leaf([0.2, 0, -0.2], [1.2, 0.2, 1.8], [0.3, 0, 1.2], cream)]);
}

/** A metre of ribbon (a whisker's link), running back from the origin. */
export function ribbonLink(): BufferGeometry {
  const c = new Color('#FFFFFF');
  return merge([leaf([-0.09, 0, 0], [0.09, 0, 0], [0.07, 0, 1.02], c), leaf([-0.09, 0, 0], [0.07, 0, 1.02], [-0.07, 0, 1.02], c)]);
}

// ---------------------------------------------------------------- the lantern fleet

export interface Field {
  geo: InstancedBufferGeometry;
  mat: ShaderMaterial;
  /** When each lantern was let go, on the legend's clock (a far future until it is). */
  launch: InstancedBufferAttribute;
}

/** A field of sky lanterns in one draw. Each is a sprite that turns to the lens: a paper bag wider at its
 *  crown, hot at its mouth, in a halo of its own light. `base` is where each leaves the ground (three.js
 *  space), `seed` its size, its climb in m/s, a phase and how far the wind takes it. */
export function lanternField(base: Float32Array, seed: Float32Array): Field {
  const n = base.length / 3;
  const quad = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('aBase', new InstancedBufferAttribute(base, 3));
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4));
  const launch = new InstancedBufferAttribute(new Float32Array(n).fill(1e9), 1);
  geo.setAttribute('aLaunch', launch);
  geo.instanceCount = n;
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: { uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uNow: { value: 0 }, uFade: { value: 1 }, uMove: { value: 1 }, uWind: { value: new Vector3(1, 0, 0) }, uSize: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aBase;
      attribute vec4 aSeed;
      attribute float aLaunch;
      uniform float uNow;
      uniform float uMove;
      uniform float uSize;
      uniform vec3 uWind;
      varying vec2 vP;
      varying float vDist;
      varying float vSeed;
      varying float vAge;
      void main() {
        float age = uNow - aLaunch;
        vAge = age;
        vSeed = aSeed.z;
        vP = position.xy * 2.0;
        if (age < 0.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          vDist = 0.0;
          return;
        }
        // Let go: slow off the ground, then its own steady climb, the wind taking it as it rises.
        float up = aSeed.y * (age - (1.0 - exp(-age * 0.8)) / 0.8);
        vec3 c = aBase + vec3(0.0, up, 0.0) + vec3(uWind.x * aSeed.w, uWind.y * abs(aSeed.w), uWind.z * abs(aSeed.w)) * age;
        c.x += sin(age * 0.55 + aSeed.z * 31.0) * 1.3 * uMove;
        c.z += cos(age * 0.43 + aSeed.z * 17.0) * 1.3 * uMove;
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float s = aSeed.x * uSize * smoothstep(0.0, 1.4, age);
        mv.xy += position.xy * s * 2.0;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uNow;
      uniform float uFade;
      uniform float uMove;
      varying vec2 vP;
      varying float vDist;
      varying float vSeed;
      varying float vAge;
      void main() {
        // The sprite is twice the lantern's height, so its halo has room: the paper sits in the middle.
        vec2 p = vP * 2.0;
        float y = clamp(p.y, -1.0, 1.0);
        float w = mix(0.4, 0.66, smoothstep(-0.8, 0.35, y));
        float crown = max(0.0, (y - 0.45) / 0.5);
        w *= sqrt(max(0.0, 1.0 - crown * crown));
        float body = (1.0 - smoothstep(w - 0.07, w + 0.02, abs(p.x))) * step(-0.85, p.y) * step(p.y, 0.95);
        float flick = 1.0 + 0.08 * uMove * sin(uNow * 7.0 + vSeed * 40.0);
        // Hot at the mouth, marigold through the paper, a deeper orange at the crown.
        vec3 paper = mix(vec3(1.75, 1.2, 0.45), vec3(1.2, 0.5, 0.12), smoothstep(-0.85, 0.75, p.y));
        paper = mix(paper, vec3(1.0, 0.36, 0.1), smoothstep(0.5, 1.0, p.y) * 0.6);
        paper *= (1.0 - 0.25 * abs(p.x) / max(w, 0.05)) * flick;
        float r = length(vP * vec2(1.0, 0.9) + vec2(0.0, 0.18));
        float halo = max(0.0, 1.0 - r);
        halo = halo * halo * 0.5;
        // Far lanterns go to the air's colour and their halos carry them.
        float f = 0.55 * smoothstep(uFogNear, uFogFar * 1.6, vDist);
        paper = mix(paper, uFog * 1.1 + vec3(0.25, 0.14, 0.02), f);
        float a = body * uFade;
        gl_FragColor = vec4(paper * a + vec3(1.0, 0.62, 0.2) * halo * flick * uFade, a);
      }
    `,
  });
  return { geo, mat, launch };
}

// ---------------------------------------------------------------- the aurora

/** The aurora's curtain: a sheet standing on a line on the snow (position is its foot; aUv.x metres along
 *  it, aUv.y 0 at the foot and 1 at the top; aAcross the way a fold moves it and how far its foot has been
 *  lifted back to the sky at the line's ends). Rays, a travelling fold, a bright hem where it touches down. */
export function curtainMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uT: { value: 0 }, uDown: { value: 0 }, uHeight: { value: 24 }, uFade: { value: 1 }, uMove: { value: 1 }, uGain: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aUv;
      attribute vec3 aAcross;
      uniform float uT;
      uniform float uDown;
      uniform float uHeight;
      uniform float uMove;
      varying vec2 vUv;
      varying float vDist;
      varying float vLift;
      varying float vHeld;
      void main() {
        vUv = aUv.xy;
        vLift = aAcross.z;
        // It comes down out of the sky, the near end first, and hangs with its foot on the snow.
        float held = clamp(uDown * 1.6 - aUv.x * 0.0016, 0.0, 1.0);
        held = held * held * (3.0 - 2.0 * held);
        vec3 p = position;
        p.y += aAcross.z + uHeight * aUv.z * aUv.y * (0.6 + 0.4 * held) + (1.0 - held) * 56.0;
        vHeld = held;
        float fold = sin(aUv.x * 0.105 - uT * 0.9) * 1.5 + sin(aUv.x * 0.041 + uT * 0.33) * 2.6;
        p.xz += aAcross.xy * fold * (0.12 + aUv.y) * uMove;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uFade;
      uniform float uMove;
      uniform float uGain;
      varying vec2 vUv;
      varying float vDist;
      varying float vLift;
      varying float vHeld;
      void main() {
        float u = vUv.x;
        float v = clamp(vUv.y, 0.0, 1.0);
        float t = uT * uMove;
        float rays = 0.5 + 0.5 * sin(u * 2.1 + sin(u * 0.31 + t * 0.5) * 3.0);
        rays = 0.3 + 0.7 * rays * (0.6 + 0.4 * sin(u * 0.63 - t * 1.2));
        float hem = exp(-v * 11.0);
        float body = pow(1.0 - v, 1.5);
        // Violet at the foot, rose in its height, ice where it touches the snow. Never mint.
        vec3 col = mix(vec3(0.5, 0.3, 1.0), vec3(1.0, 0.36, 0.74), smoothstep(0.1, 0.8, v + 0.14 * sin(u * 0.047 + t * 0.21)));
        col = mix(col, vec3(0.86, 0.94, 1.0), min(1.0, hem * 1.2));
        float a = (body * rays * 0.6 + hem * 0.85) * uFade * uGain;
        // (Clear of the lens, so it never veils the rider.)
        a *= (1.0 + 0.9 * (1.0 - vHeld)) * smoothstep(5.0, 16.0, vDist) * (1.0 - smoothstep(0.0, 60.0, vLift) * 0.6);
        gl_FragColor = vec4(col * a, 1.0);
      }
    `,
  });
}

/** The lane the aurora lays on the snow (aUv.x metres along it, aUv.y -1 to 1 across, the lane's own
 *  edge at laneEdge): bands of light flowing down it, its two edges drawn, brighter as it charges. */
export function laneMaterial(laneEdge: number): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    uniforms: { uT: { value: 0 }, uFade: { value: 1 }, uMove: { value: 1 }, uCharge: { value: 0 }, uEdge: { value: laneEdge }, uDown: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aUv;
      varying vec3 vUv;
      void main() {
        vUv = aUv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uFade;
      uniform float uMove;
      uniform float uCharge;
      uniform float uEdge;
      uniform float uDown;
      varying vec3 vUv;
      void main() {
        float u = vUv.x;
        float v = vUv.y;
        float t = uT * uMove;
        float across = max(0.0, 1.0 - v * v);
        float flow = 0.5 + 0.5 * sin(u * 0.33 - t * 2.4 + 2.0 * sin(v * 2.2 + u * 0.07));
        float e = (abs(v) - uEdge) / 0.06;
        float edge = exp(-e * e);
        vec3 col = mix(vec3(0.52, 0.32, 1.0), vec3(1.0, 0.4, 0.76), 0.5 + 0.5 * sin(u * 0.05 + v * 1.4 + t * 0.4));
        float a = across * across * (0.3 + 0.34 * flow) * (1.0 + 0.9 * uCharge) + edge * (0.42 + 0.5 * uCharge);
        col = mix(col, vec3(0.88, 0.95, 1.0), edge * 0.8 + uCharge * 0.25 * flow);
        // It is laid as the curtain touches down, the near end first.
        float laid = clamp(uDown * 2.2 - 0.6 - u * 0.0016, 0.0, 1.0);
        gl_FragColor = vec4(col * a * vUv.z * uFade * laid, 1.0);
      }
    `,
  });
}

// ---------------------------------------------------------------- the thousand cranes

export const CRANE_RIBBONS = 6;

/** A flock of folded-paper cranes in one draw. Every crane rides one of six ribbons through the air (the
 *  ribbons are uniforms: legendworld.ts lays them over the leap); its place on the ribbon, its beat and
 *  its turn to the ribbon's bend are worked out in the vertex shader. `n` cranes; aA is the ribbon, the
 *  crane's place along it, and its place across it; aB a seed, a size, a tint and when it takes the air. */
export function craneFlock(n: number, ribbons: number): { geo: InstancedBufferGeometry; mat: ShaderMaterial } {
  // One crane, a metre and a half across the wings, facing -z. aPart: 0 the body, +1 and -1 the wings
  // (how far out a wing a vertex is: the beat turns it about the body). aShade: each fold's own value.
  const P: number[] = [];
  const W: number[] = [];
  const S: number[] = [];
  const tri = (a: V3, b: V3, c: V3, sh: number, wa = 0, wb = 0, wc = 0) => {
    P.push(...a, ...b, ...c);
    W.push(wa, wb, wc);
    S.push(sh, sh, sh);
  };
  const A: V3 = [0, 0, -0.34];
  const B: V3 = [0, 0, 0.34];
  const T: V3 = [0, 0.17, 0];
  tri(A, T, [-0.15, 0, 0], 0.86);
  tri(T, B, [-0.15, 0, 0], 0.74);
  tri(A, [0.15, 0, 0], T, 1.0);
  tri(T, [0.15, 0, 0], B, 0.9);
  // The neck and its bent head, the tail.
  tri([-0.05, 0, -0.26], [0.05, 0, -0.26], [0, 0.46, -0.68], 0.95);
  tri([0, 0.46, -0.68], [0, 0.36, -0.9], [0, 0.38, -0.62], 0.7);
  tri([-0.05, 0, 0.26], [0.05, 0, 0.26], [0, 0.52, 0.74], 0.8);
  for (const sd of [-1, 1]) {
    const rf: V3 = [sd * 0.1, 0.08, -0.22];
    const rb: V3 = [sd * 0.1, 0.08, 0.24];
    const rm: V3 = [sd * 0.1, 0.13, 0.0];
    const tip: V3 = [sd * 0.98, 0.1, 0.06];
    tri(rf, tip, rm, sd > 0 ? 1.0 : 0.88, 0, sd, 0);
    tri(rm, tip, rb, sd > 0 ? 0.82 : 0.72, 0, sd, 0);
  }
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
  geo.setAttribute('aPart', new BufferAttribute(new Float32Array(W), 1));
  geo.setAttribute('aShade', new BufferAttribute(new Float32Array(S), 1));
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  let r = 0x9e3779b9;
  const rnd = () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const rib = i % ribbons;
    // (A flock bunches: thick at its middle, thin at its ends.)
    const along = (rnd() + rnd() + rnd()) / 3;
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd());
    a.set([rib, along, Math.cos(ang) * rad, Math.sin(ang) * rad], i * 4);
    b.set([rnd(), 0.8 + rnd() * 0.7, rnd(), rib === 0 ? rnd() * 0.3 : 0.2 + rnd() * 0.8], i * 4);
  }
  geo.setAttribute('aA', new InstancedBufferAttribute(a, 4));
  geo.setAttribute('aB', new InstancedBufferAttribute(b, 4));
  geo.instanceCount = n;
  const v4 = () => Array.from({ length: CRANE_RIBBONS }, () => new Vector4());
  const mat = new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uT: { value: 0 },
      uRise: { value: 0 },
      uLeave: { value: 0 },
      uMove: { value: 1 },
      uSize: { value: 1 },
      uOrigin: { value: new Vector3() },
      // Per ribbon: A = its middle's x, how far it swings, the swing's length, its height;
      // B = how far it rises and falls, its climb a metre, where it starts down the course, its way (+1 down, -1 up, 0 a wheel);
      // C = its speed, its length, a phase, its thickness.
      uRibA: { value: v4() },
      uRibB: { value: v4() },
      uRibC: { value: v4() },
    },
    vertexShader: /* glsl */ `
      attribute float aPart;
      attribute float aShade;
      attribute vec4 aA;
      attribute vec4 aB;
      uniform float uT;
      uniform float uRise;
      uniform float uLeave;
      uniform float uMove;
      uniform float uSize;
      uniform vec3 uOrigin;
      uniform vec4 uRibA[${CRANE_RIBBONS}];
      uniform vec4 uRibB[${CRANE_RIBBONS}];
      uniform vec4 uRibC[${CRANE_RIBBONS}];
      varying vec3 vCol;
      varying float vDist;
      vec3 along(vec4 a, vec4 b, vec4 c, float q) {
        float th = q / a.z + c.z;
        float x = a.x + a.y * sin(th);
        float y = a.w + b.x * sin(th * 1.37 + c.z * 2.0) + b.y * q;
        // Down the course is three.js -z. A wheel turns in place.
        float z = b.w == 0.0 ? b.z + a.y * cos(th) : b.z + b.w * q;
        return vec3(x, y, -z);
      }
      void main() {
        int k = int(aA.x + 0.5);
        vec4 a = uRibA[k];
        vec4 b = uRibB[k];
        vec4 c = uRibC[k];
        float q = fract(aA.y + uT * c.x / c.y) * c.y;
        float ends = smoothstep(0.0, 0.07, q / c.y) * (1.0 - smoothstep(0.9, 1.0, q / c.y));
        vec3 p0 = along(a, b, c, q);
        vec3 fw = normalize(along(a, b, c, q + 2.0) - p0);
        vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
        vec3 up = cross(rt, fw);
        // Its own place in the flock, and a little life of its own.
        vec3 ctr = uOrigin + p0 + (rt * aA.z + up * aA.w * 0.6) * c.w;
        ctr.y += sin(uT * 1.7 + aB.x * 40.0) * 0.5 * uMove;
        // Taking the air: each rises from under the lip in its turn. Leaving: up and away, smaller.
        float on = smoothstep(aB.w, aB.w + 0.22, uRise);
        ctr.y -= (1.0 - on) * (1.0 - on) * 46.0;
        ctr.y += uLeave * uLeave * (60.0 + 70.0 * aB.x);
        float size = aB.y * uSize * ends * on * (1.0 - smoothstep(0.55, 1.0, uLeave));
        // The beat: the wings turn about the body, down faster than up.
        float beat = sin(uT * (6.0 + aB.x * 3.0) + aB.x * 50.0);
        float ang = (0.12 + 0.7 * beat * uMove + 0.25 * (1.0 - uMove)) * aPart;
        vec3 l = position;
        if (aPart != 0.0) {
          float x0 = 0.1 * aPart;
          float dx = l.x - x0;
          float cs = cos(ang);
          float sn = sin(ang);
          l.x = x0 + dx * cs;
          l.y = l.y + abs(dx) * sn * sign(aPart) * sign(dx);
        }
        l *= size;
        vec3 wp = ctr + rt * l.x + up * l.y - fw * l.z;
        // White, rose and a few of pale gold; each fold holds its own value, cooler in its shade.
        vec3 paper = aB.z < 0.56 ? vec3(1.0, 0.99, 0.97) : aB.z < 0.9 ? vec3(1.0, 0.66, 0.76) : vec3(1.0, 0.9, 0.62);
        vCol = paper * mix(vec3(0.7, 0.76, 0.95), vec3(1.08), aShade);
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vCol;
      varying float vDist;
      void main() {
        float f = 0.45 * smoothstep(uFogNear, uFogFar * 1.5, vDist);
        gl_FragColor = vec4(mix(vCol, uFog, f), 1.0);
      }
    `,
  });
  return { geo, mat };
}

// ---------------------------------------------------------------- the eruption

/** Where the cone's summit stands from the lens (three.js space): the far range is drawn round the lens, so
 *  the eruption is placed from it too and sits on the crater from anywhere on the mountain. */
export const ERUPT_AT = { value: new Vector3(0, 1340, -4400) };

/** A sheet that faces the lens from the cone's summit (x across, y up from its foot, in metres). */
function sheet(w: number, h: number): BufferGeometry {
  const g = new PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  return g;
}

/** The fountain of lava over the crater: jets that climb and fall back, white at the vent, red at the top. */
export function fountain(w: number, h: number): { geo: BufferGeometry; mat: ShaderMaterial } {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uAt: ERUPT_AT, uT: { value: 0 }, uPower: { value: 0 }, uMove: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform vec3 uAt;
      vec4 place(vec2 p) {
        vec2 d = normalize(uAt.xz);
        vec3 wp = cameraPosition + uAt + vec3(-d.y, 0.0, d.x) * p.x + vec3(0.0, p.y, 0.0);
        return projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = place(position.xy);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uPower;
      uniform float uMove;
      varying vec2 vUv;
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float t = uT * uMove;
        // It breathes: taller on each pulse.
        float top = uPower * (0.72 + 0.2 * sin(t * 1.7) + 0.08 * sin(t * 4.3));
        float y = vUv.y / max(0.05, top);
        float wide = 0.05 + 0.62 * pow(clamp(y, 0.0, 1.0), 1.25);
        float core = max(0.0, 1.0 - abs(x) / wide);
        // Jets: streaks that lean out as they climb.
        float jets = 0.55 + 0.45 * sin(x / wide * 7.0 + sin(vUv.y * 9.0 - t * 5.0) * 1.6 + t * 0.7);
        float a = core * core * (1.0 - smoothstep(0.55, 1.05, y)) * (0.45 + 0.55 * jets);
        a += exp(-dot(vec2(x * 3.2, vUv.y * 9.0), vec2(x * 3.2, vUv.y * 9.0))) * 1.6 * min(1.0, uPower * 2.0);
        vec3 col = mix(vec3(1.9, 1.5, 0.75), vec3(1.5, 0.42, 0.08), smoothstep(0.0, 0.75, y));
        col = mix(col, vec3(0.9, 0.12, 0.04), smoothstep(0.6, 1.0, y));
        gl_FragColor = vec4(col * a * min(1.0, uPower * 3.0), 1.0);
      }
    `,
  });
  return { geo: sheet(w, h), mat };
}

/** The column of smoke the cone throws up: billows climbing, lit orange from below, plum above. */
export function smokeColumn(w: number, h: number): { geo: BufferGeometry; mat: ShaderMaterial } {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uAt: ERUPT_AT, uT: { value: 0 }, uGrow: { value: 0 }, uGlow: { value: 1 }, uMove: { value: 1 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform vec3 uAt;
      vec4 place(vec2 p) {
        vec2 d = normalize(uAt.xz);
        vec3 wp = cameraPosition + uAt + vec3(-d.y, 0.0, d.x) * p.x + vec3(0.0, p.y, 0.0);
        return projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = place(position.xy);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uGrow;
      uniform float uGlow;
      uniform float uMove;
      uniform float uFade;
      varying vec2 vUv;
      float billow(vec2 p) {
        return sin(p.x) * sin(p.y) + 0.5 * sin(p.x * 2.3 + 1.7) * sin(p.y * 2.1 + 0.6) + 0.25 * sin(p.x * 4.7 + 0.3) * sin(p.y * 5.3 + 2.1);
      }
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float t = uT * uMove;
        float y = vUv.y / max(0.04, uGrow);
        // A stem that swells into a head.
        float wide = 0.16 + 0.3 * y + 0.4 * smoothstep(0.55, 1.0, y);
        float b = billow(vec2(x * 5.0 + sin(y * 3.0) * 0.6, vUv.y * 11.0 - t * 0.55));
        float edge = wide * (0.82 + 0.16 * b);
        float in_ = 1.0 - smoothstep(edge - 0.1, edge, abs(x));
        float head = 1.0 - smoothstep(0.86 + 0.06 * b, 1.0, y);
        float a = in_ * head;
        // Lit from under by the fountain, and down its hot core; the rest is ash plum.
        float lit = exp(-vUv.y * 5.5) * 1.5 + max(0.0, 0.5 - abs(x) / wide) * exp(-vUv.y * 2.4) * 0.9;
        vec3 smoke = mix(vec3(0.16, 0.085, 0.1), vec3(0.34, 0.2, 0.2), 0.5 + 0.5 * b);
        vec3 col = smoke + vec3(1.5, 0.52, 0.12) * lit * uGlow * (0.75 + 0.25 * b);
        gl_FragColor = vec4(col, a * 0.92 * uFade);
      }
    `,
  });
  return { geo: sheet(w, h), mat };
}

/** Lava bombs: each a streak on its own arc out of the crater, born again when it has fallen. The arc
 *  lives in the sheet's plane (x across, y up) and the streak is the bomb's last second. */
export function lavaBombs(n: number): { geo: InstancedBufferGeometry; mat: ShaderMaterial } {
  const SEG = 5;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEG; i++) pos.push(i / SEG, -1, 0, i / SEG, 1, 0);
  for (let i = 0; i < SEG; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  const a = new Float32Array(n * 4);
  let r = 0x51ed270b;
  const rnd = () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const out = (rnd() - 0.5) * 2;
    // Across (m/s), up (m/s), its period and where in it it starts.
    // (Low and wide, so most of a bomb's life is its fall down the flanks, where the lens is looking.)
    a.set([out * (90 + rnd() * 190), 105 + rnd() * 130, 8 + rnd() * 4, rnd()], i * 4);
  }
  geo.setAttribute('aArc', new InstancedBufferAttribute(a, 4));
  geo.instanceCount = n;
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uAt: ERUPT_AT, uT: { value: 0 }, uPower: { value: 0 }, uWidth: { value: 16 } },
    vertexShader: /* glsl */ `
      attribute vec4 aArc;
      uniform float uT;
      uniform float uPower;
      uniform float uWidth;
      varying float vK;
      varying float vAge;
      uniform vec3 uAt;
      vec4 place(vec2 p) {
        vec2 d = normalize(uAt.xz);
        vec3 wp = cameraPosition + uAt + vec3(-d.y, 0.0, d.x) * p.x + vec3(0.0, p.y, 0.0);
        return projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
      varying float vOn;
      vec2 arc(float t) {
        return vec2(aArc.x * t, aArc.y * t - 34.0 * t * t);
      }
      void main() {
        // (A bomb is thrown only while the cone has the power for it: uT is the eruption's own clock.)
        float cycle = uT / aArc.z + aArc.w;
        float t = fract(cycle) * aArc.z;
        float born = (floor(cycle) - aArc.w) * aArc.z;
        vOn = step(0.0, born) * step(0.02, uPower);
        vK = position.x;
        vAge = t / aArc.z;
        float tt = max(0.0, t - position.x * 0.9);
        vec2 p = arc(tt);
        vec2 v = normalize(vec2(aArc.x, aArc.y - 68.0 * tt) + vec2(0.0001));
        p += vec2(-v.y, v.x) * position.y * uWidth * (1.0 - position.x) * (1.0 - 0.5 * vAge);
        gl_Position = place(p);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vK;
      varying float vAge;
      varying float vOn;
      void main() {
        // White-hot at the bomb, cooling to red down its trail and as it falls.
        vec3 col = mix(vec3(2.0, 1.5, 0.7), vec3(1.2, 0.2, 0.04), clamp(vK * 0.9 + vAge * 0.7, 0.0, 1.0));
        float a = (1.0 - vK) * (1.0 - vK) * (1.0 - smoothstep(0.75, 1.0, vAge)) * vOn;
        gl_FragColor = vec4(col * a, 1.0);
      }
    `,
  });
  return { geo, mat };
}

/** Lava running down the cone's flank from the crater: `runs` rivers, each a strip that widens and
 *  wanders as it falls (x across, y down from 0, metres), a bright head leading each. */
export function lavaRuns(runs: number, drop: number): { geo: BufferGeometry; mat: ShaderMaterial } {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const N = 14;
  for (let k = 0; k < runs; k++) {
    const lean = runs === 1 ? 0 : (k / (runs - 1) - 0.5) * 2;
    const base = pos.length / 3;
    const len = drop * (0.62 + 0.38 * Math.abs(Math.sin(k * 2.4 + 1)));
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const d = u * len;
      // The cone is concave: a river falls steeply off the rim and runs out across the flank.
      const x = lean * (40 + d * 0.55 + 0.0009 * d * d) + Math.sin(u * 7 + k * 1.9) * 26 * u;
      const w = 16 + 26 * u;
      pos.push(x - w, -d, 0, x + w, -d, 0);
      uv.push(u, -1, k, u, 1, k);
    }
    for (let i = 0; i < N; i++) idx.push(base + i * 2, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aUv', new BufferAttribute(new Float32Array(uv), 3));
  geo.setIndex(idx);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uAt: ERUPT_AT, uT: { value: 0 }, uFlow: { value: 0 }, uMove: { value: 1 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aUv;
      uniform vec3 uAt;
      vec4 place(vec2 p) {
        vec2 d = normalize(uAt.xz);
        vec3 wp = cameraPosition + uAt + vec3(-d.y, 0.0, d.x) * p.x + vec3(0.0, p.y, 0.0);
        return projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
      varying vec3 vUv;
      void main() {
        vUv = aUv;
        gl_Position = place(position.xy);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uT;
      uniform float uFlow;
      uniform float uMove;
      uniform float uFade;
      varying vec3 vUv;
      void main() {
        float u = vUv.x;
        // Each river runs at its own pace; its head is the brightest of it.
        float reach = uFlow * (0.75 + 0.25 * sin(vUv.z * 3.1 + 0.7));
        float behind = reach - u;
        float on = smoothstep(0.0, 0.03, behind);
        float head = exp(-behind * behind * 500.0);
        float core = exp(-vUv.y * vUv.y * 5.0);
        float pulse = 0.7 + 0.3 * sin(u * 34.0 - uT * 2.6 * uMove + vUv.z * 2.0);
        vec3 col = mix(vec3(1.7, 0.62, 0.12), vec3(2.0, 1.5, 0.7), head + core * core * 0.35);
        gl_FragColor = vec4(col * core * (on * pulse * (1.0 - 0.45 * u) + head) * uFade, 1.0);
      }
    `,
  });
  return { geo, mat };
}
