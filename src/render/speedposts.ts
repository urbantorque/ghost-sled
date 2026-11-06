import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, OctahedronGeometry, ShaderMaterial } from 'three';
import type { Course } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { reduced } from '../ui/motion';
import { merge, part, softPart } from './flora';
import { makeToonMaterial, shared } from './materials';
import type { Tier } from './world';

// Speed posts: thin stakes, snow poles, slalom flags and roped fence posts along both corridor edges,
// 0.8 to 3 m past the edge and 10 to 18 m apart, for a strobe of parallax at speed. They are the first
// thing in the frame to read as "close", and they are markers, not hazards: slim, pale, in the biome's
// cool accent, never the dark faceted hazard silhouette and never a signal colour (ART.md section 1).
// Nothing here is a collider: the sim never hears of a post, and a post dissolves round a rider who
// wall-rides through it. One instanced draw on Medium and High, nothing on Low.
//
// Everything is planned from the course's own corridor (centerX, halfWidth, edgeExcess, edgeLimit) and
// its ground, so a ravine, a bridge or a street arrives without a change here: a post stops short of
// whatever solid thing edgeLimit names, and none stands where the ground past the edge falls away.

export enum PostKind {
  Stake = 0,
  Pole = 1,
  Flag = 2,
  Fence = 3,
}

/** How far past the corridor's edge a post stands (metres). */
export const POST_E_MIN = 0.8;
export const POST_E_MAX = 3;
/** Metres of run one stretch of posts holds; its kind and spacing change from one to the next. */
export const POST_CELL = 96;
/** Spacing per kind (metres): a slalom's flags come slowest, a fence's posts quickest. */
export const POST_GAP: Record<PostKind, readonly [number, number]> = {
  [PostKind.Stake]: [13, 15],
  [PostKind.Pole]: [11, 14],
  [PostKind.Flag]: [16, 18],
  [PostKind.Fence]: [10, 11],
};
/** The ground may dip this far under the corridor's edge, or over the next 1.5 m out, before a post
 *  gives up: the corridor's banks rise, so a dip means the ground falls away there. */
const FALL_AWAY = 0.25;
/** The nearest a post stands to something solid at the corridor's edge. */
const LIMIT_CLEAR = 0.4;

/** Posts drawn and how far ahead they reach (metres), per tier. */
const CAP: Record<Tier, number> = { low: 0, medium: 72, high: 104 };
const REACH: Record<Tier, number> = { low: 0, medium: 190, high: 260 };
/** Metres behind the rider a post stays (the lens is a few metres back, and the banks are in view). */
const BEHIND = 14;

const hash = (a: number, b: number, c: number): number => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

interface Style {
  /** Relative chances of each kind, stake to fence. */
  weights: readonly [number, number, number, number];
  /** The shaft, a stake's or pole's band and the fence's timber. */
  shaft: string;
  band: string;
  fence: string;
  /** A slalom's flags, in turn (never a signal colour). */
  flags: readonly [string, string];
}

/** Per biome: the sticks people really plant there. Birch poles and sky-blue gates in the Alps, ice
 *  wands with lilac tags on the glacier, ash-pale stakes on the volcano, bamboo and paper on Sakura. */
const STYLES: Record<BiomeId, Style> = {
  alpine: { weights: [3, 2, 3, 2], shaft: '#F2EADB', band: '#5C7BD0', fence: '#D8C6AC', flags: ['#5F8FE6', '#E4ECFB'] },
  glacier: { weights: [4, 3, 3, 0], shaft: '#E2ECF5', band: '#6C8AD8', fence: '#D5DDEA', flags: ['#9A88E6', '#DCE8FA'] },
  volcanic: { weights: [4, 3, 1, 2], shaft: '#D3CED7', band: '#7A70B4', fence: '#C2BCC8', flags: ['#9484D0', '#E2DEE8'] },
  blossom: { weights: [2, 2, 4, 2], shaft: '#EFE7D8', band: '#9C86CC', fence: '#E0D6C4', flags: ['#EDBFD8', '#B09EE8'] },
};

/** Every colour a post can wear (a test holds them clear of the locked roles). */
export function postColours(): string[] {
  const out: string[] = [];
  for (const s of Object.values(STYLES)) out.push(s.shaft, s.band, s.fence, ...s.flags);
  return out;
}

export interface PostStretch {
  kind: PostKind;
  gap: number;
  /** Where the stretch's first post stands past its start (metres). */
  from: number;
  /** Which sides carry it: 0 both, -1 or 1 one side. */
  only: -1 | 0 | 1;
  /** Both sides, staggered half a gap, for the strobe to flick side to side (else level, gate-like). */
  stagger: boolean;
}

/** One stretch of posts on a course: pure, so a stretch always reads alike. */
export function postStretch(seed: number, biome: BiomeId, cell: number): PostStretch {
  const w = STYLES[biome].weights;
  const sum = w[0] + w[1] + w[2] + w[3];
  let r = hash(seed, cell, 1) * sum;
  let kind = PostKind.Stake;
  for (let k = 0; k < 4; k++) {
    if (r < w[k]) {
      kind = k as PostKind;
      break;
    }
    r -= w[k];
  }
  const [a, b] = POST_GAP[kind];
  const gap = a + (b - a) * hash(seed, cell, 2);
  const side = hash(seed, cell, 3) < 0.5 ? -1 : 1;
  return {
    kind,
    gap,
    from: gap * 0.5 * hash(seed, cell, 4),
    // A fence runs down one bank (a stake answers it down the other); a slalom's flags take turns.
    only: kind === PostKind.Fence ? side : 0,
    stagger: kind === PostKind.Stake || kind === PostKind.Flag,
  };
}

/** The corridor a post reads. */
export type PostCourse = Pick<Course, 'centerX' | 'halfWidth' | 'edgeExcess' | 'edgeLimit' | 'ground'>;

export interface PostSpot {
  x: number;
  y: number;
  /** Metres past the corridor's edge. */
  e: number;
}

/** Where a post stands on one side at sim z, `e0` metres past the edge if it can, or null: short of
 *  anything solid at the edge, and nowhere the ground past the edge falls away. */
export function placePost(c: PostCourse, z: number, side: -1 | 1, e0: number): PostSpot | null {
  const e = Math.min(e0, c.edgeLimit(z) - LIMIT_CLEAR);
  if (e < POST_E_MIN) return null;
  const cx = c.centerX(z);
  const hw = c.halfWidth(z);
  const x = cx + side * (hw + e);
  const y = c.ground(x, z);
  if (y < c.ground(cx + side * hw, z) - FALL_AWAY) return null;
  if (c.ground(cx + side * (hw + e + 1.5), z) < y - FALL_AWAY) return null;
  return { x, y, e: c.edgeExcess(x, z) };
}

/** The post mesh, height 1 and radius 1 along y (the shader scales it per instance): a contact shadow,
 *  a shaft of five painted lengths and a small head, and one strip that becomes a flag or a rope. */
function postGeometry(): BufferGeometry {
  const white = new Color('#FFFFFF');
  const tag = (g: BufferGeometry, p: number): BufferGeometry => {
    const n = g.getAttribute('position').count;
    g.setAttribute('aPart', new BufferAttribute(new Float32Array(n).fill(p), 1));
    g.setAttribute('aStrip', new BufferAttribute(new Float32Array(n * 2), 2));
    return g;
  };
  const parts: BufferGeometry[] = [tag(softPart(new CylinderGeometry(3.2, 3.2, 0.001, 7, 1, true), new Color('#6470A4'), { pos: [0, 0.004, 0] }), 0)];
  // (Bands near the top, where they read: a real pole is striped at eye height.)
  const lengths = [0, 0.55, 0.66, 0.76, 0.87, 1];
  for (let i = 0; i < 5; i++) {
    const a = lengths[i];
    const b = lengths[i + 1];
    const r = (y: number) => 1 - 0.28 * y;
    parts.push(tag(part(new CylinderGeometry(r(b), r(a), b - a, 6, 1, true), white, { pos: [0, (a + b) / 2, 0] }), i % 2 === 0 ? 1 : 2));
  }
  parts.push(tag(softPart(new OctahedronGeometry(1.1, 0), white, { pos: [0, 1, 0], scale: [1, 0.03, 1] }), 2));
  // The strip: five rungs of two vertices (u along, v across), a flag's cloth or a rope's sag.
  const SEG = 4;
  const n = (SEG + 1) * 2;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3).fill(1);
  const strip = new Float32Array(n * 2);
  for (let i = 0; i <= SEG; i++) {
    for (let k = 0; k < 2; k++) {
      strip[(i * 2 + k) * 2] = i / SEG;
      strip[(i * 2 + k) * 2 + 1] = k;
      nor[(i * 2 + k) * 3 + 2] = 1;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < SEG; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const s = new BufferGeometry();
  s.setAttribute('position', new BufferAttribute(pos, 3));
  s.setAttribute('normal', new BufferAttribute(nor, 3));
  s.setAttribute('color', new BufferAttribute(col, 3));
  s.setIndex(idx);
  const flat = s.toNonIndexed();
  const m = flat.getAttribute('position').count;
  const fs = new Float32Array(m * 2);
  for (let i = 0; i < idx.length; i++) {
    fs[i * 2] = strip[idx[i] * 2];
    fs[i * 2 + 1] = strip[idx[i] * 2 + 1];
  }
  flat.setAttribute('aPart', new BufferAttribute(new Float32Array(m).fill(3), 1));
  flat.setAttribute('aStrip', new BufferAttribute(fs, 2));
  parts.push(flat);
  return merge(parts);
}

const ATTRS = /* glsl */ `
  attribute float aPart;
  attribute vec2 aStrip;
  attribute vec4 aPost;
  attribute vec3 aColA;
  attribute vec3 aColB;
  attribute vec3 aSpan;
  uniform float uPostLive;
`;

// aPost: x kind, y height (m), z seed (0..1), w radius (m).
const ANIMATE = /* glsl */ `#include <begin_vertex>
  {
    vec3 pIp = instanceMatrix[3].xyz;
    float pPh = aPost.z * 6.2831;
    float pH = aPost.y;
    vec2 pToR = pIp.xz - uFocus.xz;
    float pDR = length(pToR);
    // Round a rider riding through them they fold away into the snow: never a collider.
    float pKeep = smoothstep(0.7, 2.3, pDR);
    // A rider rushing past shakes the post: a quick whip away from it, dying with distance.
    float pWhip = uPostLive * exp(-pDR * pDR / 42.0) * (0.75 + 0.25 * sin(uTime * 31.0 + pPh));
    float pIdle = uPostLive * sin(uTime * 2.1 + pPh) * 0.012;
    if (aPart > 2.5) {
      if (aPost.x > 2.5) {
        // A rope slung to the next post, sagging, flat to the lens.
        float u = aStrip.x;
        vec3 sp = transpose(mat3(instanceMatrix)) * aSpan;
        float sag = 4.0 * u * (1.0 - u) * (0.16 + 0.05 * sin(uTime * 1.7 + pPh + u * 3.0));
        transformed = sp * u + vec3(0.0, pH * 0.86 - sag - aStrip.y * 0.075, 0.0);
        if (dot(aSpan, aSpan) < 0.5) transformed = vec3(0.0);
      } else if (aPost.x > 1.5) {
        // A slalom's flag: a panel hung from the pole's top, its free edge flapping harder with speed.
        float u = aStrip.x;
        float wv = uPostLive * sin(uTime * 13.0 + pPh + u * 5.0);
        transformed = vec3(u * 0.84, pH - 0.04 - aStrip.y * (0.66 - 0.24 * u), wv * 0.12 * u);
        transformed.y += wv * 0.02 * u;
      } else transformed = vec3(0.0);
      transformed.xz *= pKeep;
      transformed.y *= mix(0.2, 1.0, pKeep);
    } else if (aPart > 0.5) {
      float t = transformed.y;
      transformed.xz *= aPost.w * pKeep;
      transformed.y = t * pH * mix(0.2, 1.0, pKeep);
      float bend = t * t;
      vec2 pDir = pToR / max(pDR, 0.01);
      transformed.x += (pDir.x * pWhip * 0.3 + pIdle) * bend;
      transformed.z += pDir.y * pWhip * 0.3 * bend;
    } else {
      transformed.xz *= aPost.w * pKeep;
    }
  }`;

const COLOUR = /* glsl */ `vColor = color;
  if (aPart > 2.5) vColor = aPost.x > 2.5 ? mix(aColA, aColB, 0.35) : aColB;
  else if (aPart > 1.5) vColor = aColB;
  else if (aPart > 0.5) vColor = aColA;`;

function postMaterial(): ShaderMaterial {
  // (nearFade: a post the lens sweeps past dithers away inside about 2 m. Its rim stays strong enough
  // to hold on the snow; double-sided for the flag and rope.)
  // (A little light of their own: backlit by a low sun a bare stick fell to the dark of a hazard.)
  const m = makeToonMaterial({ coolShade: 0.32, rim: 0.34, nearFade: [0.9, 2.2], doubleSided: true, emissive: new Color('#AEB6DC'), emissiveStrength: 0.26 });
  if (!m.vertexShader.includes('#include <begin_vertex>') || !m.vertexShader.includes('vColor = color;')) throw new Error('postMaterial: shader hooks missing');
  m.vertexShader = ATTRS + m.vertexShader.replace('vColor = color;', COLOUR).replace('#include <begin_vertex>', ANIMATE);
  // (The toon material takes uFocus and uTime from the shared set already.)
  m.uniforms.uFocus = shared.uFocus;
  m.uniforms.uPostLive = { value: 1 };
  return m;
}

/** A post's height and radius, per kind (metres). */
const SIZE: Record<PostKind, readonly [number, number, number]> = {
  [PostKind.Stake]: [1.45, 1.85, 0.05],
  [PostKind.Pole]: [2.6, 3.2, 0.06],
  [PostKind.Flag]: [2.2, 2.5, 0.055],
  [PostKind.Fence]: [1.15, 1.3, 0.075],
};

const colA = new Color();
const colB = new Color();

export class SpeedPosts {
  readonly mesh: InstancedMesh;
  private course: Course;
  private seed = 0;
  private cap = 0;
  private reach = 0;
  private slot = 0;
  private filled = 0;
  /** The walk down the course: the stretch in hand, its index and the next station in it. */
  private cell = NaN;
  private stretch: PostStretch | null = null;
  private station = 0;
  private lastZ = NaN;
  /** The last fence post placed, for the rope back to it. */
  private rope = { slot: -1, x: 0, y: 0, z: 0, cell: NaN };
  private post = new InstancedBufferAttribute(new Float32Array(CAP.high * 4), 4).setUsage(DynamicDrawUsage);
  private a = new InstancedBufferAttribute(new Float32Array(CAP.high * 3), 3).setUsage(DynamicDrawUsage);
  private b = new InstancedBufferAttribute(new Float32Array(CAP.high * 3), 3).setUsage(DynamicDrawUsage);
  private span = new InstancedBufferAttribute(new Float32Array(CAP.high * 3), 3).setUsage(DynamicDrawUsage);
  private dirty = false;
  /** Keeps a set piece's ground clear of posts (the world's crowds, buildings and gates). */
  kept: ((x: number, z: number) => boolean) | null = null;

  constructor(course: Course, tier: Tier) {
    this.course = course;
    const g = postGeometry();
    g.setAttribute('aPost', this.post);
    g.setAttribute('aColA', this.a);
    g.setAttribute('aColB', this.b);
    g.setAttribute('aSpan', this.span);
    this.mesh = new InstancedMesh(g, postMaterial(), CAP.high);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.setTier(tier);
    this.setCourse(course);
  }

  setCourse(c: Course): void {
    this.course = c;
    this.seed = (c as unknown as { seed?: number }).seed ?? 0;
    this.clear();
  }

  setTier(tier: Tier): void {
    this.cap = CAP[tier];
    this.reach = REACH[tier];
    this.mesh.visible = this.cap > 0;
    this.clear();
  }

  private clear(): void {
    this.slot = this.filled = 0;
    this.mesh.count = 0;
    this.cell = NaN;
    this.stretch = null;
    this.station = 0;
    this.lastZ = NaN;
    this.rope.slot = -1;
  }

  /** Keeps the posts round sim z in the ring: a station at a time as the rider comes on, all at once
   *  after a cut (a new run, a revive far off, the title reel moving to another rider). */
  update(z: number): void {
    if (this.cap <= 0) return;
    // (Reduced motion: they stand still, no flap and no whip.)
    (this.mesh.material as ShaderMaterial).uniforms.uPostLive.value = reduced() ? 0 : 1;
    if (!(Math.abs(z - this.lastZ) < 120)) this.seek(z);
    this.lastZ = z;
    const to = z + this.reach;
    // (Never more than a few new posts in a frame, unless the ring has only just been emptied.)
    let budget = this.filled < this.cap / 2 ? this.cap : 6;
    while (budget > 0 && this.next(to)) budget--;
    this.mesh.count = this.filled;
    if (this.dirty) {
      this.dirty = false;
      this.mesh.instanceMatrix.needsUpdate = true;
      this.post.needsUpdate = true;
      this.a.needsUpdate = true;
      this.b.needsUpdate = true;
      this.span.needsUpdate = true;
    }
  }

  private seek(z: number): void {
    this.clear();
    const from = z - BEHIND;
    this.cell = Math.floor(from / POST_CELL);
    this.stretch = postStretch(this.seed, this.course.biome, this.cell);
    const s = this.stretch;
    const at = this.cell * POST_CELL + s.from;
    this.station = Math.max(0, Math.ceil((from - at) / s.gap));
  }

  /** Places the next station if it stands short of `to`. */
  private next(to: number): boolean {
    let s = this.stretch;
    if (!s) return false;
    let z = this.cell * POST_CELL + s.from + this.station * s.gap;
    if (z >= (this.cell + 1) * POST_CELL) {
      this.cell++;
      this.stretch = s = postStretch(this.seed, this.course.biome, this.cell);
      this.station = 0;
      z = this.cell * POST_CELL + s.from;
    }
    if (z >= to) return false;
    const st = this.station++;
    for (const side of [-1, 1] as const) {
      if (s.only !== 0 && s.only !== side) {
        // The other bank of a fence: a light stake on every second post.
        if (st % 2 === 0) this.place(PostKind.Stake, z, side, st);
        continue;
      }
      this.place(s.kind, s.stagger && side > 0 ? z + s.gap * 0.5 : z, side, st);
    }
    return true;
  }

  private place(kind: PostKind, z: number, side: -1 | 1, st: number): void {
    if (z < 2) return;
    const c = this.course;
    const key = Math.floor(z * 8) * side;
    // (Weighted toward the near end of the band: the closer to the road, the more of a strobe.)
    const he = hash(this.seed, key, 5);
    const e0 = POST_E_MIN + (POST_E_MAX - POST_E_MIN) * he * he;
    const at = placePost(c, z, side, kind === PostKind.Fence ? Math.min(e0, 1.8) : e0);
    if (!at || this.kept?.(at.x, z)) {
      if (kind === PostKind.Fence) this.rope.slot = -1;
      return;
    }
    const i = this.slot;
    this.slot = (this.slot + 1) % this.cap;
    this.filled = Math.min(this.cap, this.filled + 1);
    const [h0, h1, r] = SIZE[kind];
    const h = h0 + (h1 - h0) * hash(this.seed, key, 6);
    const seed = hash(this.seed, key, 7);
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    // Hand-planted: turned at random about its own axis, leaning a degree or two.
    const yaw = seed * 6.2831;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const lx = (hash(this.seed, key, 8) - 0.5) * 0.05;
    const lz = (hash(this.seed, key, 9) - 0.5) * 0.05;
    m[o] = cy;
    m[o + 1] = 0;
    m[o + 2] = -sy;
    m[o + 3] = 0;
    m[o + 4] = lx;
    m[o + 5] = 1;
    m[o + 6] = lz;
    m[o + 7] = 0;
    m[o + 8] = sy;
    m[o + 9] = 0;
    m[o + 10] = cy;
    m[o + 11] = 0;
    m[o + 12] = at.x;
    m[o + 13] = at.y - 0.03;
    m[o + 14] = -z;
    m[o + 15] = 1;
    this.post.setXYZW(i, kind, h, seed, r);
    const st0 = STYLES[c.biome];
    colA.set(kind === PostKind.Fence ? st0.fence : st0.shaft);
    colB.set(kind === PostKind.Flag ? st0.flags[st % 2] : st0.band);
    this.a.setXYZ(i, colA.r, colA.g, colA.b);
    this.b.setXYZ(i, colB.r, colB.g, colB.b);
    this.span.setXYZ(i, 0, 0, 0);
    if (kind === PostKind.Fence) {
      // The rope back from the last post to this one hangs from the last.
      const p = this.rope;
      if (p.slot >= 0 && p.cell === this.cell && z - p.z < 14) this.span.setXYZ(p.slot, at.x - p.x, at.y - p.y, -(z - p.z));
      p.slot = i;
      p.x = at.x;
      p.y = at.y;
      p.z = z;
      p.cell = this.cell;
    }
    this.dirty = true;
  }

  /** Posts in the ring, for probes. */
  get count(): number {
    return this.filled;
  }
}
