import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, ShaderMaterial, SphereGeometry, Vector3, Vector4 } from 'three';
import type { BiomeId } from '../sim/mountains';
import { makeToonMaterial } from './materials';
import { merge, part, softPart } from './flora';
import type { Palette } from './palette';

// Spectators: little toy-proportioned figures (the rider's proportions, ART.md section 5: the head
// about a third of the height, a round beanie with a pom-pom, a scarf, mitts) lining the banks at the
// course's set pieces. One instanced mesh draws every crowd in view. Each figure is coloured per
// instance (coat, and beanie and scarf) and animated in the vertex shader: an idle bob and sway, a
// few who wave, heads turning to follow the rider past, and a cheer (arms up in a V and a jump) that
// ripples out from where the rider made a moment (a pass, a stomp, a bank). Never vermillion (the
// player's colour), marigold, mint, rose or gold-white (ART.md section 1): coats in the cool and
// muted earth range, accents in creams, sky blues and lilacs.

/** Figure height, metres (a touch taller than the seated rider, so a crowd on the bank reads). */
export const FIGURE_H = 1.62;
/** Shoulder pivot of the arms, model metres. */
const SHOULDER_X = 0.27;
const SHOULDER_Y = 1.0;

/** Vertex slots: what the per-instance colours paint. */
const SLOT_FIXED = 0;
const SLOT_COAT = 1;
const SLOT_HAT = 2;
const SLOT_LAMP = 3;

/** Tags every vertex of a part with its slot and arm (-1 left, 1 right, 0 body). */
function tag(g: BufferGeometry, slot: number, arm: number): BufferGeometry {
  const n = g.getAttribute('position').count;
  g.setAttribute('aSlot', new BufferAttribute(new Float32Array(n).fill(slot), 1));
  g.setAttribute('aArm', new BufferAttribute(new Float32Array(n).fill(arm), 1));
  return g;
}

/** One spectator, standing on the origin and facing +z. White parts take the instance's colours. */
export function figureGeometry(): BufferGeometry {
  const white = new Color('#FFFFFF');
  const skin = new Color('#F2C9A8');
  const boot = new Color('#3A3550');
  const mitt = new Color('#5A5470');
  const ink = new Color('#1E2238');
  const parts: BufferGeometry[] = [
    // The contact shadow: a soft dark-blue blob on the snow (ART.md section 2).
    tag(softPart(new CylinderGeometry(0.34, 0.34, 0.02, 8, 1, true), new Color('#5A6496'), { pos: [0, 0.01, 0], scale: [1, 1, 0.8] }), SLOT_FIXED, 0),
    // Boots and legs.
    tag(part(new CylinderGeometry(0.07, 0.085, 0.42, 5), boot, { pos: [-0.1, 0.2, 0] }), SLOT_FIXED, 0),
    tag(part(new CylinderGeometry(0.07, 0.085, 0.42, 5), boot, { pos: [0.1, 0.2, 0] }), SLOT_FIXED, 0),
    // The chunky coat: a lathed bell, wider at the hem, tapering to the shoulders.
    tag(softPart(new CylinderGeometry(0.2, 0.27, 0.62, 8, 1, true), white, { pos: [0, 0.68, 0] }), SLOT_COAT, 0),
    tag(softPart(new SphereGeometry(0.205, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), white, { pos: [0, 0.99, 0], scale: [1, 0.5, 1] }), SLOT_COAT, 0),
    // The scarf: a thick ring at the neck and a tail down the front.
    tag(softPart(new CylinderGeometry(0.15, 0.17, 0.11, 8, 1, true), white, { pos: [0, 1.06, 0] }), SLOT_HAT, 0),
    tag(part(new BoxGeometry(0.1, 0.3, 0.05), white, { pos: [0.09, 0.88, 0.15], rot: [0.15, 0, 0.1], scale: [1, 1, 0.55] }), SLOT_HAT, 0),
    // The head: a big round toy head, a third of the height.
    tag(softPart(new SphereGeometry(0.235, 9, 6), skin, { pos: [0, 1.32, 0] }), SLOT_FIXED, 0),
    // Two dark eyes on the face.
    tag(softPart(new IcosahedronGeometry(0.036, 0), ink, { pos: [-0.085, 1.33, 0.212] }), SLOT_FIXED, 0),
    tag(softPart(new IcosahedronGeometry(0.036, 0), ink, { pos: [0.085, 1.33, 0.212] }), SLOT_FIXED, 0),
    // The beanie: a dome over the crown, a cuff, and the pom-pom.
    tag(softPart(new SphereGeometry(0.248, 9, 3, 0, Math.PI * 2, 0, Math.PI * 0.52), white, { pos: [0, 1.36, -0.01] }), SLOT_HAT, 0),
    tag(softPart(new CylinderGeometry(0.252, 0.252, 0.08, 9, 1, true), white, { pos: [0, 1.37, -0.01] }), SLOT_HAT, 0),
    tag(part(new IcosahedronGeometry(0.09, 0), white, { pos: [0, 1.65, -0.02] }), SLOT_HAT, 0),
  ];
  // The arms hang from the shoulders (the vertex shader swings them up), each ending in a mitt.
  for (const s of [-1, 1]) {
    parts.push(tag(part(new CylinderGeometry(0.06, 0.075, 0.42, 5, 1, true), white, { pos: [s * SHOULDER_X, SHOULDER_Y - 0.22, 0], rot: [0, 0, s * 0.12] }), SLOT_COAT, s));
    parts.push(tag(softPart(new IcosahedronGeometry(0.08, 0), mitt, { pos: [s * (SHOULDER_X + 0.05), SHOULDER_Y - 0.45, 0] }), SLOT_FIXED, s));
  }
  // A lantern held in the right mitt, shown only for the lamp holders on a night mood.
  parts.push(tag(part(new CylinderGeometry(0.008, 0.008, 0.14, 3), ink, { pos: [SHOULDER_X + 0.05, SHOULDER_Y - 0.54, 0.02] }), SLOT_LAMP, 1));
  parts.push(tag(part(new IcosahedronGeometry(0.07, 0), new Color('#FFB45E').multiplyScalar(2.6), { pos: [SHOULDER_X + 0.05, SHOULDER_Y - 0.66, 0.02] }), SLOT_LAMP, 1));
  // (Keep the custom attributes through the merge: every part carries them.)
  return merge(parts);
}

/** A crowd's colour range for a biome: coats (cool, muted earth) and accents (beanie and scarf). */
export function crowdColors(biome: BiomeId, p: Palette): { coats: Color[]; hats: Color[] } {
  const base = ['#3E5A9A', '#2F6E78', '#6A4C86', '#47704A', '#E6DCC8', '#2E3A66', '#8A7DB8', '#5C6F8E', '#7A6458'];
  const hats = ['#F2EBDD', '#9CC0EE', '#B9A6E0', '#FFFFFF', '#5B8FD6', '#D7E3F4', '#7A63B0', '#3F7F8A'];
  if (biome === 'volcanic') base.push('#4A3E5A', '#5A4A50', '#3A4256');
  if (biome === 'blossom') hats.push('#F4CFDC', '#EBC2D4');
  if (biome === 'glacier') hats.push('#BDEBFF', '#E6F6FF');
  // A trace of the mood's light in the coats, so a night crowd is not a row of day colours.
  const k = p.lantern || p.moon ? 0.72 : 1;
  return { coats: base.map((h) => new Color(h).multiplyScalar(k)), hats: hats.map((h) => new Color(h).multiplyScalar(k)) };
}

/** The crowd's cheer and the rider, shared by every figure (world coordinates). */
export interface CrowdUniforms {
  /** x, z where the moment was made, the time it was, and its strength (0..1). */
  uCheer: { value: Vector4 };
  /** The rider (world). */
  uRider: { value: Vector3 };
  /** Lamps lit (night moods): 1 shows the lamp holders' lanterns. */
  uLamps: { value: number };
}

const ATTRS = /* glsl */ `
  attribute float aSlot;
  attribute float aArm;
  attribute vec3 aCoat;
  attribute vec3 aHat;
  attribute vec4 aSeed;
  uniform vec4 uCheer;
  uniform vec3 uRider;
  uniform float uLamps;
`;

// aSeed: x phase (0..1), y temperament (0..1: above 0.62 waves at rest), z lamp holder (1), w height scale.
const ANIMATE = /* glsl */ `#include <begin_vertex>
  {
    vec3 ip = instanceMatrix[3].xyz;
    float ph = aSeed.x * 6.2831;
    // The rider passing: within about 20 m they are all up and turned to follow it, fading by 70 m.
    vec2 toR = uRider.xz - ip.xz;
    float dR = length(toR);
    float nearK = 1.0 - smoothstep(20.0, 70.0, dR);
    // A cheer ripples out from where the moment was made, a little later the further it has to go.
    float dC = distance(ip.xz, uCheer.xy);
    float tc = uTime - uCheer.z - dC / 40.0;
    float cheer = uCheer.w * smoothstep(0.0, 0.1, tc) * (1.0 - smoothstep(1.3, 2.8, tc)) * (1.0 - smoothstep(60.0, 120.0, dC));
    float ex = clamp(max(cheer, nearK * 0.4), 0.0, 1.0);
    float wave = sin(uTime * (4.0 + aSeed.y * 3.0) + ph);
    if (aSlot > 2.5 && (uLamps < 0.5 || aSeed.z < 0.5)) transformed *= 0.0;
    if (aArm != 0.0) {
      // Arms: hang a little out at rest; a waver swings one high; a cheer throws both up in a V.
      float rest = 0.18 + 0.06 * sin(uTime * 1.3 + ph);
      if (aSeed.y > 0.62 && aArm > 0.0) rest = 2.35 + 0.42 * wave;
      // A lamp holder keeps the lamp hand low.
      if (aSeed.z > 0.5 && uLamps > 0.5 && aArm > 0.0) rest = 0.5 + 0.08 * wave;
      float up = 2.55 + 0.3 * sin(uTime * 9.0 + ph + aArm);
      float a = mix(rest, up, ex) * aArm;
      vec2 q = transformed.xy - vec2(aArm * ${SHOULDER_X.toFixed(3)}, ${SHOULDER_Y.toFixed(3)});
      float ca = cos(a);
      float sa = sin(a);
      transformed.xy = vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca) + vec2(aArm * ${SHOULDER_X.toFixed(3)}, ${SHOULDER_Y.toFixed(3)});
      objectNormal.xy = vec2(objectNormal.x * ca - objectNormal.y * sa, objectNormal.x * sa + objectNormal.y * ca);
    }
    // Turned toward the rider as it comes by (at most about 70 degrees off their own facing).
    vec3 lr = transpose(mat3(instanceMatrix)) * vec3(toR.x, 0.0, toR.y);
    float yaw = clamp(atan(lr.x, max(lr.z, -0.2)), -1.2, 1.2) * nearK;
    // A sway from side to side, livelier when excited, and a bob on the knees.
    float sway = sin(uTime * 1.7 + ph) * (0.05 + 0.06 * ex);
    float cy = cos(yaw);
    float sy = sin(yaw);
    if (transformed.y > 0.05) {
      transformed.xz = vec2(transformed.x * cy + transformed.z * sy, -transformed.x * sy + transformed.z * cy);
      objectNormal.xz = vec2(objectNormal.x * cy + objectNormal.z * sy, -objectNormal.x * sy + objectNormal.z * cy);
      transformed.x += sway * transformed.y;
      float hop = cheer * abs(sin(uTime * 7.5 + ph)) * 0.42 + nearK * 0.08 * abs(sin(uTime * 6.0 + ph));
      transformed.y += 0.03 * sin(uTime * 2.2 + ph) + hop;
    }
  }`;

const COLOUR = /* glsl */ `vColor = color;
  if (aSlot > 0.5 && aSlot < 1.5) vColor = aCoat;
  else if (aSlot > 1.5 && aSlot < 2.5) vColor = aHat;`;

/** The crowd's material: the shared toon model, patched to colour and animate each figure. */
export function crowdMaterial(u: CrowdUniforms): ShaderMaterial {
  const m = makeToonMaterial({ coolShade: 0.4, rim: 0.42, nearFade: [1.8, 3.6] });
  if (!m.vertexShader.includes('#include <begin_vertex>') || !m.vertexShader.includes('vColor = color;')) throw new Error('crowdMaterial: shader hooks missing');
  m.vertexShader = ATTRS + m.vertexShader.replace('vColor = color;', COLOUR).replace('#include <begin_vertex>', ANIMATE);
  Object.assign(m.uniforms, u);
  return m;
}


