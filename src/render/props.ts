import { AdditiveBlending, BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, OctahedronGeometry, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { CHUNK_LEN, Course, FOREST_LIMIT, ObstacleKind } from '../sim/course';
import { Clearing, Dresser, L_ROCKBAND, inClearing, largeKitSteps, signature, smallKitSteps, wallThinning } from './dressing';
import { crestE, standable, visualGround } from './ground';
import { AERIAL_PICK, Lod, VARIANT_SHARE, canLean, forestSteps, hasLod, merge, part, variantDepthMaterial, variantMaterial, variantRange, variantSet, variantView } from './flora';
import { Plant, emberGrove, hasGrove, orchard } from './groves';
import { makeToonMaterial, shared } from './materials';
import {
  cairnGeometry,
  gateBeamGeometry,
  lightGeometry,
  kickerLipGeometry,
  kmArchGeometry,
  lanternPostGeometry,
  obstacleGeometry,
  obstacleModelRadius,
  ventGeometry,
} from './meshes';
import { Palette } from './palette';

// Instanced props for the visible chunk window: obstacles, the decorative forest beyond the
// treeline, gifts, kicker lips, vents and spirit gates. Instance lists are rebuilt only when the
// window moves or something is collected or smashed.

const KINDS: ObstacleKind[] = ['pine', 'rock', 'log', 'snowman', 'spire', 'serac', 'iceblock', 'basalt', 'lavarock', 'charpine', 'blossom', 'lantern', 'pillar'];

interface Batch {
  mesh: InstancedMesh;
  count: number;
  /** Instances in the chunks up to the player's (they are packed in chunk order). */
  near: number;
  /** Variant batches (flora.ts): each instance's variant, and its colour (instanceColor). */
  pick?: InstancedBufferAttribute;
  /** A forest batch: the key of the variant set it draws (swapped in when made on idle time). */
  setKey?: string;
  /** A dressing batch waits unseen until its kit is made on idle time. */
  waiting?: boolean;
  /** A bank dressing batch (left out of the rear-view mirror). */
  dress?: boolean;
}

/** One chunk's static instances for a batch: matrices, and each one's variant and colour. */
interface Packed {
  m: Float32Array;
  p: Float32Array;
  c: Float32Array;
}

/** The variant sets (forest and dressing kits) made for the last palette, kept across rebuilds so a
 *  quality change or a new run on the same mountain and mood shows them at once. */
const sets = new Map<string, BufferGeometry>();

/** The palette colours a variant set is built from. */
function paletteKey(biome: string, p: Palette): string {
  const cs = [p.tall, p.tallDark, p.low, p.lowLit, p.accentProp, p.snowShade];
  return biome + ':' + cs.map((c) => c.getHexString()).join(',');
}

/** The forest's and the gifts' detail range: chunks this many past the player's (128 to 192 m ahead
 *  and on) draw the far trees and far gifts (flora.ts Lod 2), where a tree stands a few dozen pixels
 *  tall and a gift a few. Nearer chunks draw the full trees (Low's own cheaper ones on Low, whose
 *  detail range ends a chunk sooner: 64 to 128 m ahead). */
export const LOD_AHEAD = 3;

/** Dressing caps (instances in the visible window): bank clutter and poles, and the big pieces. */
const DRESS_SMALL_CAP = 900;
const DRESS_LARGE_CAP = 420;

/** The soft amber halo round a trail lantern's lamp (Lantern Night): a camera-facing glow about
 *  1.4 m across up close that never shrinks below about a hundredth of the screen height far away, so
 *  a lamp a few hundred metres down the corridor still reads as a point of warm light. Additive, and
 *  only half swallowed by the fog. */
function haloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color('#FFB45E') }, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vQ;
      varying float vFade;
      void main() {
        vQ = position.xy * 2.0;
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float d = max(-c.z, 0.1);
        c.xy += position.xy * max(1.4, 0.04 * d / projectionMatrix[1][1]);
        vFade = (1.0 - 0.55 * smoothstep(uFogNear, uFogFar * 1.4, d)) * smoothstep(3.0, 10.0, d);
        gl_Position = projectionMatrix * c;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vQ;
      varying float vFade;
      void main() {
        float r = length(vQ);
        float a = (exp(-r * r * 14.0) * 1.0 + exp(-r * 3.6) * 0.3) * (1.0 - smoothstep(0.75, 1.0, r)) * vFade;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor * 2.2, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The kilometre mark (1, 2, ...) whose 1,000 m line falls in chunk `i`, or 0 for none. Static
 *  geometry: it never depends on chaos. */
export function kmInChunk(i: number): number {
  const k = Math.ceil((i * CHUNK_LEN) / 1000);
  return k >= 1 && k * 1000 < (i + 1) * CHUNK_LEN ? k : 0;
}

/** At most this many graveyard cairns a run, each built up to about 2.4 m of stones under a 3.8 m
 *  marker, so it reads as a place from 30 m up the run. */
export const CAIRN_CAP = 4;
const CAIRN_SCALE = 1.7;

/** Where the km arch's posts stand: 2 m outside the corridor's edge on each side, at the mark. */
function archSpan(c: Course, km: number): number {
  return 2 * (c.halfWidth(km * 1000) + 2);
}

/** The landmark meshes (the km arches and the cairns) are made off the frame, on idle time: none
 *  before LANDMARK_START_MS after the first frame (built in the constructor, the first arch cost
 *  startup about 140 ms at 6x CPU throttle, for a mark no run reaches in under about 40 s), then one
 *  per idle callback (a few ms each), each at most LANDMARK_IDLE_MS late. The next mark's arch is made
 *  as soon as one stands. A landmark in range before its mesh is made waits unseen (it comes into
 *  range several hundred metres out, in the fog), unless it is within LANDMARK_NOW chunks of the
 *  player, when it is made there and then. */
const LANDMARK_START_MS = 1500;
const LANDMARK_IDLE_MS = 1000;
const LANDMARK_NOW = 3;
/** Built landmark meshes kept per kind (the arch standing, the next, and one spare; cairns per palette). */
const LANDMARK_KEEP = 3;
/** A landmark batch's mesh until its geometry is built (drawn with no instances meanwhile). */
const NO_GEOMETRY = new BufferGeometry();

/** Runs `fn` on idle time (requestIdleCallback, at most LANDMARK_IDLE_MS late), or soon after where
 *  there is none (Safari). */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: LANDMARK_IDLE_MS });
  else setTimeout(fn, 50);
}

/** Marks the first `n` values of an instance attribute for upload (the rest of its cap stays). */
function upload(a: InstancedBufferAttribute, n: number): void {
  a.clearUpdateRanges();
  a.addUpdateRange(0, n);
  a.needsUpdate = true;
}

/** A spirit light past the detail range (meshes.ts lightGeometry, a few pixels across there): a drawn-out
 *  diamond of marigold with a pale core, and for a great light a wider one. */
function farLightGeometry(great: boolean): BufferGeometry {
  const s = great ? 2.5 : 1.7;
  return merge([
    part(new OctahedronGeometry(0.2 * s, 0), new Color('#FFC94A'), { scale: [1, 1.9, 1], pos: [0, 0.1 * s, 0] }),
    part(new OctahedronGeometry(0.12 * s, 0), new Color('#FFF6D8').multiplyScalar(1.4), { scale: [1, 1.9, 1], pos: [0, 0.08 * s, 0.06 * s] }),
  ]);
}

/** Whether a forest pick carries snow on its boughs to shake off (Props.treesNear). */
function boughs(biome: string, set: 'a' | 'b', pick: number): boolean {
  if (biome === 'alpine') return !(set === 'b' && pick === 1);
  if (biome === 'volcanic') return set === 'a' && pick === 0;
  return biome === 'blossom';
}

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export class Props {
  readonly root = new Object3D();
  private batches = new Map<string, Batch>();
  private materials: ShaderMaterial[] = [];
  private giftMat: ShaderMaterial;
  /** The far gifts' material (the gift's, drawing one of two variants: plain or golden). */
  private giftFarMat: ShaderMaterial;
  /** The far gifts' variant set, made once. */
  private giftFarGeo: BufferGeometry | null = null;
  /** A chunk's forest batch key to its batch in the detail range and past it (build). */
  private route = new Map<string, [string, string]>();
  private range = { from: -1, to: -1 };
  private dirty = true;
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private up = new Vector3(0, 1, 0);
  private xAxis = new Vector3(1, 0, 0);
  private tilt = new Vector3();
  private lean = new Quaternion();
  private cache = new Map<number, Map<string, Packed>>();
  private collecting: Map<string, { m: number[]; p: number[]; c: number[] }> | null = null;
  /** Bank dressing and section signatures (Medium and High, with the landmarks). */
  private dresser: Dresser | null = null;
  /** Variant sets and kits waiting for idle time (run before the landmark meshes). */
  private jobs: Array<() => void> = [];
  /** Per-batch geometries this build made (views and placeholders), disposed on the next. */
  private owned: BufferGeometry[] = [];
  /** Built landmark meshes by key ('arch:' and the posts' span, 'cairn:' and its palette's stone
   *  colours), oldest first; and those waiting for idle time, with how to make each. */
  private landmarks = new Map<string, BufferGeometry>();
  private queued = new Map<string, () => BufferGeometry>();
  /** Idle building has begun (LANDMARK_START_MS after the first update), and a callback is pending. */
  private idleOpen = false;
  private idleBusy = false;
  private started = false;
  /** This run's graveyard cairns (sim x and z on the bank), at most CAIRN_CAP. */
  private graves: Array<{ x: number; z: number }> = [];
  /** The set pieces' footprints and crowd rows (landmarks.ts), kept clear of the forest. */
  siteClearings: ((z0: number, z1: number, out: Clearing[]) => void) | null = null;
  /** Ground no dressing stands on either: the set pieces' footprints and crowd rows (landmarks.ts). */
  siteKeep: ((z0: number, z1: number, out: Clearing[]) => void) | null = null;

  constructor(
    private course: Course,
    private palette: Palette,
    private forestDensity: number,
    private shadows: boolean,
    /** The scene renders to a multisampled target: near props fade through coverage, not a dither. */
    private smoothFade = false,
    /** Landmarks: the kilometre arches and graveyard cairns (Medium and High; Low skips the meshes and
     *  keeps their callouts, tags and sound). */
    private arches = false,
  ) {
    // Spirit lights glow (they are light, not paint), and shrink away as they pass the lens (and right around
    // the rider after a perfect landing).
    const giftOpts = { bob: true, coolShade: 0.1, emissive: new Color('#FFD34D'), emissiveStrength: 0.62, nearFade: [3.0, 5.2] as [number, number], clearFocus: true };
    this.giftMat = makeToonMaterial(giftOpts);
    this.giftFarMat = variantMaterial(makeToonMaterial(giftOpts));
    this.build();
  }

  setCourse(course: Course, palette: Palette): void {
    this.course = course;
    this.palette = palette;
    this.build();
  }

  setQuality(forestDensity: number, shadows: boolean, smoothFade = this.smoothFade, arches = this.arches): void {
    this.forestDensity = forestDensity;
    this.shadows = shadows;
    this.smoothFade = smoothFade;
    this.arches = arches;
    this.build();
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** This run's graveyards (where several ghosts fell), as cairn spots on the bank in sim metres; the
   *  list is kept on every tier (the mesh is drawn only on Medium and High) and replaced each run. Only
   *  the chunks holding an old or new cairn are rebuilt. */
  setGraveyards(list: ReadonlyArray<{ x: number; z: number }>): void {
    const next = list.slice(0, CAIRN_CAP).map((g) => ({ x: g.x, z: g.z }));
    if (next.length === this.graves.length && next.every((g, i) => g.x === this.graves[i].x && g.z === this.graves[i].z)) return;
    for (const g of this.graves) this.cache.delete(Math.floor(g.z / CHUNK_LEN));
    for (const g of next) this.cache.delete(Math.floor(g.z / CHUNK_LEN));
    this.graves = next;
    this.dirty = true;
  }

  private build(): void {
    for (const b of this.batches.values()) {
      this.root.remove(b.mesh);
      b.mesh.dispose();
    }
    this.batches.clear();
    // Meshes queued for the old course or palette would only be made to be thrown away.
    this.queued.clear();
    this.jobs = [];
    for (const g of this.owned) g.dispose();
    this.owned = [];
    this.cache.clear();
    for (const mat of this.materials) mat.dispose();
    this.materials = [];
    const p = this.palette;
    const biome = this.course.biome;
    // Props dissolve out fully well before the lens, so nothing screen-doors at the frame edges.
    const near: [number, number] = [1.8, 3.6];
    const cf = this.smoothFade;
    // Obstacles and forest are hazards: the sled lantern never warms them (a cool moon rim instead).
    // Kicker lips and gate beams are friendly signals and keep the lantern's light.
    const toon = makeToonMaterial({ sway: 0, coolShade: 0.5, nearFade: near, coverageFade: cf, hazard: true });
    // Foliage keeps its spruce teal in shade (at 0.55 the cool shade tint turned every pine indigo).
    const foliage = makeToonMaterial({ sway: 0.12, coolShade: 0.38, nearFade: near, coverageFade: cf, hazard: true });
    const plain = makeToonMaterial({ sway: 0, coolShade: 0.5, nearFade: near, coverageFade: cf });
    const glow = makeToonMaterial({ coolShade: 0.3, emissive: new Color('#FF9A4A'), emissiveStrength: 0.2, nearFade: near, coverageFade: cf });
    // Stone lanterns and lava rocks are hazards too: dark and cold, with only a stone lantern's
    // window lit (a pale moonlit paper glow). A warm glow over the whole prop read as an orange crate.
    const hazGlow = makeToonMaterial({ coolShade: 0.5, emissive: new Color('#CFE4FF'), emissiveStrength: 0.75, glowMask: true, nearFade: near, coverageFade: cf, hazard: true });
    // Frostfang's spires, seracs and crystal rocks are translucent ice (still hazards).
    const ice = makeToonMaterial({ coolShade: 0.5, nearFade: near, coverageFade: cf, hazard: true, ice: true });
    // The far rows of the forest lean into the fog with distance (materials.ts AERIAL).
    const farFoliage = makeToonMaterial({ sway: 0.12, coolShade: 0.38, nearFade: near, coverageFade: cf, hazard: true, aerial: true });
    const farToon = makeToonMaterial({ sway: 0, coolShade: 0.5, nearFade: near, coverageFade: cf, hazard: true, aerial: true });
    const farIce = makeToonMaterial({ coolShade: 0.5, nearFade: near, coverageFade: cf, hazard: true, ice: true, aerial: true });
    this.materials.push(toon, foliage, plain, glow, hazGlow, ice, farFoliage, farToon, farIce);
    const add = (key: string, geo: BufferGeometry, mat: ShaderMaterial, cap: number, cast = true) => {
      const mesh = new InstancedMesh(geo, mat, cap);
      mesh.count = 0;
      mesh.castShadow = cast && this.shadows;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.batches.set(key, { mesh, count: 0, near: 0 });
    };
    for (const k of KINDS) {
      const mat = k === 'pine' || k === 'blossom' || k === 'charpine' ? foliage : k === 'lantern' || k === 'lavarock' ? hazGlow : k === 'spire' || k === 'serac' || k === 'iceblock' ? ice : toon;
      add('ob:' + k, obstacleGeometry(k, p), mat, k === 'pine' || k === 'rock' ? 700 : 300);
    }
    // Decorative forest: biome-appropriate silhouettes, each batch a variant set (flora.ts): the
    // original tree and a variant (a snow-laden spruce, a young one, a dead snag; a snapped spire, a
    // crystal mound; a burnt-out snag, broken basalt stubs; a pale spreading blossom), so a treeline
    // is no longer a wall of copies, at no extra draw call. Their own copies of the forest materials
    // (patched to pick a variant per instance), so the run's obstacles keep theirs untouched.
    const forestCap = Math.round(2200 * this.forestDensity) + 10;
    const vFor = (opts: Parameters<typeof makeToonMaterial>[0], aerialPick = false) => {
      const m = variantMaterial(makeToonMaterial(opts), aerialPick);
      this.materials.push(m);
      return m;
    };
    const glacier = biome === 'glacier';
    const vol = biome === 'volcanic';
    const wallMat = vFor({ sway: glacier || vol ? 0 : 0.12, coolShade: glacier || vol ? 0.5 : 0.38, nearFade: near, coverageFade: cf, hazard: true, ice: glacier });
    // The far rows lean into the fog with distance, the treeline wall does not: one material for both,
    // each instance's pick saying which it is (flora.ts AERIAL_PICK).
    const farMat = vFor({ sway: glacier || vol ? 0 : 0.12, coolShade: glacier || vol ? 0.5 : 0.38, nearFade: near, coverageFade: cf, hazard: true, ice: glacier, aerial: true }, true);
    const key = paletteKey(biome, p);
    // Medium and High draw the full trees in the detail range, Low its own cheaper ones; past it every
    // tier draws the far trees. A set with no cheaper build shares the full set's buffers.
    const nearLod: Lod = this.arches ? 0 : 1;
    const setKey = (set: 'a' | 'b', lod: Lod) => 'flora:' + set + ':' + (hasLod(biome, set) ? lod : 0) + ':' + key;
    const bases = new Map<string, BufferGeometry>();
    // Until a variant set is made on idle time, both picks draw the original tree. Low keeps just the
    // original (every pick 0): a set's second variant doubles the forest's vertices.
    const baseFor = (set: 'a' | 'b', lod: Lod) => {
      const sk = setKey(set, lod);
      let g = bases.get(sk);
      if (!g) {
        const b0 = forestSteps(biome, p, set, lod)[0]();
        g = this.arches ? variantSet([b0, b0]) : variantSet([b0]);
        b0.dispose();
        bases.set(sk, g);
        this.owned.push(g);
      }
      return g;
    };
    // In the detail range the treeline wall casts the long bank shadows (Medium and High); the far
    // rows never reach the shadow frustum, nor does anything past the detail range, so those skip the
    // (instanced, uncullable) shadow pass entirely. Without shadows (Low) the wall rides with the far
    // rows in one batch.
    const forestPair = (prefix: string, cast: boolean, cap: number, mat: ShaderMaterial, lod: Lod) => {
      for (const set of ['a', 'b'] as const) {
        const k = prefix + set;
        const pick = new InstancedBufferAttribute(new Float32Array(cap), 1);
        const sk = setKey(set, lod);
        const src = this.arches ? sets.get(sk) : undefined;
        const geo = variantView(src ?? baseFor(set, lod), pick);
        this.owned.push(geo);
        add(k, geo, mat, cap, cast);
        const b = this.batches.get(k)!;
        b.pick = pick;
        b.setKey = sk;
        b.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
        if (cast) b.mesh.customDepthMaterial = variantDepthMaterial();
      }
    };
    const wall = this.shadows;
    if (wall) forestPair('fw:', true, Math.round(forestCap * 0.25) + 10, wallMat, nearLod);
    forestPair('fo:', false, Math.round(forestCap * 0.5) + 10, farMat, nearLod);
    forestPair('fl:', false, forestCap, farMat, 2);
    // Where each chunk's forest goes: the wall's own batch or the far rows' in the detail range, the
    // far trees' past it (no strings made per frame).
    this.route.clear();
    for (const set of ['a', 'b'] as const) {
      this.route.set('fw:' + set, [wall ? 'fw:' + set : 'fo:' + set, 'fl:' + set]);
      this.route.set('fo:' + set, ['fo:' + set, 'fl:' + set]);
    }
    const keep = new Set<string>();
    for (const set of ['a', 'b'] as const) {
      for (const lod of [nearLod, 2] as const) {
        const sk = setKey(set, lod);
        if (keep.has(sk)) continue;
        keep.add(sk);
        if (sets.has(sk) || !this.arches) continue;
        this.stage(forestSteps(biome, p, set, lod), (made) => {
          sets.set(sk, made);
          for (const b of this.batches.values()) {
            if (b.setKey !== sk || !b.pick) continue;
            const v = variantView(made, b.pick);
            this.owned.push(v);
            b.mesh.geometry = v;
          }
        });
      }
    }
    this.dresser = null;
    if (this.arches) {
      // Bank dressing and the sections' signatures: two kits, three draw calls (Medium and High; Low
      // draws none). The large kit's signature pieces (rock bands, cornices, rock walls) are their own
      // batch on the same set, so each batch's draw range holds only the pieces in view (a variant
      // set's instances otherwise run every piece's vertices). Their pieces are made on idle time and
      // the batches wait unseen till then.
      this.dresser = new Dresser(this.course, p, this.forestDensity);
      const dressMat = vFor({ sway: 0, coolShade: 0.5, nearFade: near, coverageFade: cf });
      for (const [k, cap, steps, kit] of [
        ['dr:s', DRESS_SMALL_CAP, smallKitSteps, 'dr:s'],
        ['dr:l', DRESS_LARGE_CAP, largeKitSteps, 'dr:l'],
        ['dr:w', DRESS_LARGE_CAP, largeKitSteps, 'dr:l'],
      ] as const) {
        const skey = 'kit:' + kit + ':' + key;
        const pick = new InstancedBufferAttribute(new Float32Array(cap), 1);
        const src = sets.get(skey);
        const geo = src ? variantView(src, pick) : NO_GEOMETRY;
        if (src) this.owned.push(geo);
        add(k, geo, dressMat, cap, false);
        const b = this.batches.get(k)!;
        b.pick = pick;
        b.setKey = skey;
        b.waiting = !src;
        b.dress = true;
        b.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
        if (!src && !keep.has(skey)) {
          this.stage(steps(biome, p), (g) => {
            sets.set(skey, g);
            for (const bb of this.batches.values()) {
              if (bb.setKey !== skey || !bb.pick) continue;
              const v = variantView(g, bb.pick);
              this.owned.push(v);
              bb.mesh.geometry = v;
              bb.waiting = false;
            }
          });
        }
        keep.add(skey);
      }
    }
    // Sets made for another palette are dropped (their buffers freed).
    for (const [k, g] of sets) {
      if (keep.has(k)) continue;
      g.dispose();
      sets.delete(k);
    }
    this.pump();
    add('gift', lightGeometry(false), this.giftMat, 900, false);
    add('gift5', lightGeometry(true), this.giftMat, 200, false);
    // Past the detail range a light is a few pixels: a drawn-out diamond, sparks and great lights in one batch.
    this.giftFarGeo ??= variantSet([farLightGeometry(false), farLightGeometry(true)]);
    const gPick = new InstancedBufferAttribute(new Float32Array(900), 1);
    const gView = variantView(this.giftFarGeo, gPick);
    this.owned.push(gView);
    add('giftL', gView, this.giftFarMat, 900, false);
    const gb = this.batches.get('giftL')!;
    gb.pick = gPick;
    gb.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(900 * 3).fill(1), 3);
    add('lip', kickerLipGeometry(p), plain, 120, false);
    add('vent', ventGeometry(), glow, 120, false);
    add('beam', gateBeamGeometry(p), plain, 60);
    if (this.arches) {
      // Kilometre arches: one batch of at most two, in the plain toon material (no new shader), casting
      // no shadow. It is culled by its own bounds (update), so it costs a draw only while one is in view;
      // its geometry is each mark's own span, made on idle time (whenIdle) and put in as that mark comes
      // into range. The first mark's is made after startup, the cairn's for this palette with it.
      add('arch', NO_GEOMETRY, plain, 2, false);
      const arch = this.batches.get('arch')!.mesh;
      arch.frustumCulled = true;
      // Not a prop the results lens must keep clear of: its instance sits on the corridor's middle.
      arch.userData.noBlock = true;
      const span = archSpan(this.course, 1);
      this.queue('arch:' + span, () => kmArchGeometry(span));
      // Graveyard cairns: the same rules (one batch, at most four, plain material, no shadow, culled by
      // its bounds, so a draw only while one is in view).
      add('cairn', NO_GEOMETRY, plain, CAIRN_CAP, false);
      this.batches.get('cairn')!.mesh.frustumCulled = true;
      this.queue(this.cairnKey(), () => cairnGeometry(p));
    }
    if (p.lantern) {
      // Lantern Night: a trail lantern at the treeline every few chunks, so the far end of the corridor
      // holds a few faint warm lights instead of a dead void at the vanishing point.
      const lamp = makeToonMaterial({ coolShade: 0.5, emissive: new Color('#FFB45E'), emissiveStrength: 1.6, glowMask: true, nearFade: near, coverageFade: cf });
      const halo = haloMaterial();
      this.materials.push(lamp, halo);
      add('beacon', lanternPostGeometry(), lamp, 24, false);
      add('halo', new PlaneGeometry(1, 1), halo, 24, false);
      this.batches.get('halo')!.mesh.renderOrder = 2;
    }
    this.dirty = true;
  }

  /** `nearChunk` is the player's chunk: the instances up to it are what the rear-view mirror needs. */
  update(from: number, to: number, collected: Set<number>, destroyed: Set<number>, nearChunk = to): void {
    if (!this.started) {
      // The first frame is drawn: idle time may start on the landmark meshes a little after it.
      this.started = true;
      setTimeout(() => {
        this.idleOpen = true;
        this.pump();
      }, LANDMARK_START_MS);
    }
    if (!this.dirty && from === this.range.from && to === this.range.to) return;
    this.range = { from, to };
    this.dirty = false;
    for (const b of this.batches.values()) b.count = b.near = 0;
    const c = this.course;
    for (const k of this.cache.keys()) if (k < from - 2 || k > to + 2) this.cache.delete(k);
    // The first km mark in range gets an arch built to its own span (made ahead on idle time; see
    // whenIdle), and the next mark's is queued behind it. Null while it waits.
    let archGeo: BufferGeometry | null = null;
    if (this.arches) {
      // At the course start (a new run, with no rebuild when the mood is unchanged), the first mark's
      // arch is queued again in case a long run evicted it.
      if (from <= 0) {
        const s1 = archSpan(c, 1);
        this.queue('arch:' + s1, () => kmArchGeometry(s1));
      }
      for (let i = Math.max(-2, from); i <= to; i++) {
        const km = kmInChunk(i);
        if (!km) continue;
        const span = archSpan(c, km);
        archGeo = this.landmark('arch:' + span, () => kmArchGeometry(span), i - nearChunk <= LANDMARK_NOW);
        if (archGeo) {
          const next = archSpan(c, km + 1);
          this.queue('arch:' + next, () => kmArchGeometry(next));
          this.batches.get('arch')!.mesh.geometry = archGeo;
        }
        break;
      }
    }
    for (let i = Math.max(-2, from); i <= to; i++) {
      // Static instances are computed once per chunk; only gifts and smashables change.
      let st = this.cache.get(i);
      if (!st) {
        st = this.buildStatic(i);
        this.cache.set(i, st);
      }
      const far = i >= nearChunk + (this.arches ? LOD_AHEAD : LOD_AHEAD - 1);
      for (const [key, pk] of st) {
        const r = this.route.get(key);
        const b = this.batches.get(r ? r[far ? 1 : 0] : key);
        if (!b) continue;
        const arr = pk.m;
        const room = b.mesh.instanceMatrix.count - b.count;
        const n = Math.min(room, arr.length / 16);
        (b.mesh.instanceMatrix.array as Float32Array).set(n * 16 === arr.length ? arr : arr.subarray(0, n * 16), b.count * 16);
        if (b.pick) {
          (b.pick.array as Float32Array).set(n === pk.p.length ? pk.p : pk.p.subarray(0, n), b.count);
          const ic = b.mesh.instanceColor;
          if (ic) (ic.array as Float32Array).set(n * 3 === pk.c.length ? pk.c : pk.c.subarray(0, n * 3), b.count * 3);
        }
        b.count += n;
      }
      const chunk = c.chunk(i);
      for (const o of chunk.obstacles) {
        if (!o.soft || destroyed.has(o.id)) continue;
        this.q.setFromAxisAngle(this.up, o.rot);
        this.v.set(o.x, o.y - 0.05, -o.z);
        this.s.setScalar(o.scale);
        this.push('ob:' + o.kind, this.v, this.q, this.s);
      }
      // In low visibility (Blizzard) lights grow by a fifth, so the marigold trail reads through the fog.
      const gs = 1 + 0.2 * Math.min(1, this.palette.giftGlow);
      for (const g of chunk.lights) {
        if (collected.has(g.id)) continue;
        // Each light stands upright (a flame), sways a little and is its own size (where it is stays the
        // sim's), so a line reads as lights left along a way, not a ruled fence.
        const h1 = hashf(g.id, 7, 1);
        this.q.setFromAxisAngle(this.up, h1 * 6.28);
        this.v.set(g.x, c.ground(g.x, g.z) + g.hover + (hashf(g.id, 7, 3) - 0.5) * 0.18, -g.z);
        this.s.setScalar(gs * (0.9 + 0.2 * hashf(g.id, 7, 4)));
        if (far) this.push('giftL', this.v, this.q, this.s, g.value > 1 ? 1 : 0);
        else this.push(g.value > 1 ? 'gift5' : 'gift', this.v, this.q, this.s);
      }
      if (i === nearChunk) for (const b of this.batches.values()) b.near = b.count;
    }
    // A landmark whose mesh is still to be made waits unseen.
    const ab = this.batches.get('arch');
    if (ab && !archGeo) ab.count = ab.near = 0;
    const cb = this.batches.get('cairn');
    if (cb && cb.count > 0) {
      // (Built there and then for a cairn within LANDMARK_NOW chunks.)
      const now = this.graves.some((g) => {
        const ci = Math.floor(g.z / CHUNK_LEN);
        return ci >= from && ci - nearChunk <= LANDMARK_NOW;
      });
      const p = this.palette;
      const geo = this.landmark(this.cairnKey(), () => cairnGeometry(p), now);
      if (geo) cb.mesh.geometry = geo;
      else cb.count = cb.near = 0;
    }
    for (const b of this.batches.values()) {
      // A dressing kit still to be made waits unseen.
      if (b.waiting) b.count = b.near = 0;
      if (nearChunk >= to) b.near = b.count;
      b.mesh.count = b.count;
      // An empty batch is hidden: three still binds its program and uploads its uniforms otherwise
      // (in every pass: the scene, the shadow map, the mirror).
      b.mesh.visible = b.count > 0;
      // Only the instances in use go up to the GPU.
      if (b.count === 0) continue;
      upload(b.mesh.instanceMatrix, b.count * 16);
      if (b.pick) {
        upload(b.pick, b.count);
        if (b.mesh.instanceColor) upload(b.mesh.instanceColor, b.count * 3);
        // Only the variants its instances pick are drawn.
        variantRange(b.mesh.geometry, b.pick, b.count);
      }
    }
    // The culled landmark batches get bounds round their instances in range.
    for (const key of ['arch', 'cairn']) {
      const b = this.batches.get(key);
      if (b && b.count > 0) b.mesh.computeBoundingSphere();
    }
  }

  /** The cairn mesh's key: its stones take the palette's low ground colours. */
  private cairnKey(): string {
    const p = this.palette;
    return `cairn:${p.low.r},${p.low.g},${p.low.b},${p.lowLit.r},${p.lowLit.g},${p.lowLit.b}`;
  }

  /** A landmark's mesh: built already, else made now (`now`) or queued for idle time (null till then). */
  private landmark(key: string, make: () => BufferGeometry, now: boolean): BufferGeometry | null {
    const have = this.landmarks.get(key);
    if (have) {
      // Most recently used last, so the keep limit drops the stalest mesh.
      this.landmarks.delete(key);
      this.landmarks.set(key, have);
      return have;
    }
    if (!now) {
      this.queue(key, make);
      return null;
    }
    const g = make();
    this.queued.delete(key);
    this.keep(key, g);
    return g;
  }

  /** Makes a variant set on idle time, one variant per idle callback (each a few ms; a whole set at
   *  once ran past a frame at 6x CPU throttle), then merges it and hands it to `done`. */
  private stage(steps: Array<() => BufferGeometry>, done: (g: BufferGeometry) => void): void {
    const made: BufferGeometry[] = [];
    for (const s of steps) this.jobs.push(() => made.push(s()));
    this.jobs.push(() => {
      const g = variantSet(made);
      for (const m of made) m.dispose();
      done(g);
    });
  }

  private queue(key: string, make: () => BufferGeometry): void {
    if (this.landmarks.has(key) || this.queued.has(key)) return;
    this.queued.set(key, make);
    this.pump();
  }

  /** Makes the queued landmark meshes one per idle callback, once idle building has begun. Each one
   *  made redraws the batches (a landmark waiting unseen shows). */
  private pump(): void {
    if (!this.idleOpen || this.idleBusy || (this.queued.size === 0 && this.jobs.length === 0)) return;
    this.idleBusy = true;
    whenIdle(() => {
      this.idleBusy = false;
      // The forest's variant sets and the dressing kits first: one per idle callback.
      const job = this.jobs.shift();
      if (job) {
        job();
        this.dirty = true;
        this.pump();
        return;
      }
      const next = this.queued.entries().next();
      if (next.done) return;
      const [key, make] = next.value;
      this.queued.delete(key);
      if (!this.landmarks.has(key)) {
        this.keep(key, make());
        this.dirty = true;
      }
      this.pump();
    });
  }

  /** Keeps a built landmark mesh, dropping the oldest of its kind past LANDMARK_KEEP (never one a batch
   *  still draws). */
  private keep(key: string, g: BufferGeometry): void {
    this.landmarks.set(key, g);
    const kind = key.slice(0, key.indexOf(':') + 1);
    const keys = [...this.landmarks.keys()].filter((k) => k.startsWith(kind));
    for (let i = 0; i < keys.length - LANDMARK_KEEP; i++) {
      const old = this.landmarks.get(keys[i])!;
      let used = false;
      for (const b of this.batches.values()) if (b.mesh.geometry === old) used = true;
      if (used) continue;
      old.dispose();
      this.landmarks.delete(keys[i]);
    }
  }

  /**
   * The rear-view mirror looks back up the slope, so it draws only the instances in the chunks behind
   * the player. The batches span the whole visible course and cannot be frustum culled, so without
   * this the mirror paid the vertex cost of every tree downhill too.
   */
  nearOnly(on: boolean): void {
    // (The bank dressing stays out of the mirror: it adds nothing to the avalanche behind you and
    // would cost the inset two more draws.)
    for (const b of this.batches.values()) {
      b.mesh.count = on ? (b.dress ? 0 : b.near) : b.count;
      b.mesh.visible = b.mesh.count > 0;
    }
  }

  private buildStatic(i: number): Map<string, Packed> {
    const c = this.course;
    const chunk = c.chunk(i);
    this.collecting = new Map();
    for (const o of chunk.obstacles) {
      if (o.soft) continue;
      if (o.kind === 'log') {
        const dx = o.x2 - o.x;
        const dz = o.z2 - o.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        this.q.setFromAxisAngle(this.up, Math.atan2(dz, dx));
        this.v.set((o.x + o.x2) / 2, o.y, -(o.z + o.z2) / 2);
        this.s.set(len + 0.4, 1, 1);
      } else {
        const model = obstacleModelRadius(o.kind);
        const k = model > 0 ? o.r / model : o.scale;
        this.q.setFromAxisAngle(this.up, o.rot);
        this.v.set(o.x, o.y - 0.05, -o.z);
        // Pines in the run vary in height (only ever up: their collider stands taller than the model).
        const tallK = o.kind === 'pine' || o.kind === 'charpine' || o.kind === 'blossom' ? 1 + 0.3 * hashf(o.id, 3, 9) : 1;
        this.s.set(k, o.kind === 'spire' || o.kind === 'basalt' ? o.h / 5 : k * tallK, k);
      }
      this.push('ob:' + o.kind, this.v, this.q, this.s);
    }
    for (const gate of chunk.gates) {
      this.q.identity();
      const x = (gate.x1 + gate.x2) / 2;
      this.v.set(x, c.ground(x, gate.z), -gate.z);
      this.s.set(gate.x2 - gate.x1 + 0.9, 1, 1);
      this.push('beam', this.v, this.q, this.s);
    }
    for (const r of chunk.zones.ramps) {
      const lz = r.z + r.len - 0.15;
      this.q.setFromAxisAngle(this.xAxis, Math.atan((2 * r.h) / r.len - c.params.slope));
      this.v.set(r.x, c.ground(r.x, lz) - 0.02, -lz);
      this.s.set(r.w, 1, 1);
      this.push('lip', this.v, this.q, this.s);
    }
    for (const vt of chunk.zones.vents) {
      this.q.identity();
      this.v.set(vt.x, c.ground(vt.x, vt.z) + 0.02, -vt.z);
      this.s.set(vt.r / 1.2, 1, vt.r / 1.2);
      this.push('vent', this.v, this.q, this.s);
    }
    if (this.palette.lantern && i >= 1 && i % 3 === 1) {
      const side = (i / 3) % 2 < 1 ? -1 : 1;
      const z = i * CHUNK_LEN + 32;
      const x = c.centerX(z) + side * (c.halfWidth(z) + FOREST_LIMIT + 0.1);
      // The lamp arm reaches out over the run.
      this.q.setFromAxisAngle(this.up, side < 0 ? 0 : Math.PI);
      this.v.set(x, c.ground(x, z) - 0.05, -z);
      this.s.set(1, 1, 1);
      this.push('beacon', this.v, this.q, this.s);
      this.q.identity();
      this.v.set(x - side * 0.3, c.ground(x, z) + 2.27, -z);
      this.push('halo', this.v, this.q, this.s);
    }
    const km = this.arches ? kmInChunk(i) : 0;
    if (km) {
      // The arch stands over the 1,000 m line, its beam about 7 m over the higher of its two posts'
      // footings (the posts reach well below the snow on the lower side).
      const z = km * 1000;
      const cx = c.centerX(z);
      const half = archSpan(c, km) / 2;
      this.q.identity();
      this.v.set(cx, Math.max(c.ground(cx - half, z), c.ground(cx + half, z)), -z);
      this.s.set(1, 1, 1);
      this.push('arch', this.v, this.q, this.s);
    }
    if (this.arches) {
      for (const g of this.graves) {
        if (Math.floor(g.z / CHUNK_LEN) !== i) continue;
        // Turned a little each its own way, and its marker leaning out over the run.
        this.q.setFromAxisAngle(this.up, (g.x > c.centerX(g.z) ? Math.PI : 0) + (hashf(Math.round(g.z), 11, 1) - 0.5) * 0.8);
        this.v.set(g.x, c.ground(g.x, g.z), -g.z);
        this.s.setScalar(CAIRN_SCALE);
        this.push('cairn', this.v, this.q, this.s);
      }
    }
    // Bank dressing and the section signatures, then the forest round the clearings they keep.
    const keep: Clearing[] = [];
    if (this.siteKeep) this.siteKeep(i * CHUNK_LEN, (i + 1) * CHUNK_LEN, keep);
    const clear: Clearing[] = keep.slice();
    if (this.siteClearings) this.siteClearings(i * CHUNK_LEN, (i + 1) * CHUNK_LEN, clear);
    if (this.dresser) {
      this.dresser.chunk(
        i,
        (key, m, pick, r, g, b) => this.pushM(key === 'dr:l' && pick >= L_ROCKBAND ? 'dr:w' : key, m, pick, r, g, b),
        clear,
        keep,
      );
    }
    this.forest(i, clear);
    const out = new Map<string, Packed>();
    for (const [k, arr] of this.collecting) out.set(k, { m: Float32Array.from(arr.m), p: Float32Array.from(arr.p), c: Float32Array.from(arr.c) });
    this.collecting = null;
    return out;
  }

  /** The decorative forest. Where a tree stands is unchanged from before the variants (the same
   *  hashes); each now also picks its variant, colour and lean. With the dressing on (Medium and
   *  High), a section's signature takes part of the treeline wall (the gully's rock walls stand there)
   *  and clearings (a cabin's, a lift line's cut) stay open. */
  private forest(i: number, clear: Clearing[]): void {
    const c = this.course;
    const dens = this.forestDensity;
    // Ember's basalt country and Sakura's orchards are laid out as places, not scattered (groves.ts).
    if (hasGrove(c.biome)) {
      (c.biome === 'volcanic' ? emberGrove : orchard)(c, i, dens, this.arches, clear, this.plantFn);
      return;
    }
    const z0 = i * CHUNK_LEN;
    const share = VARIANT_SHARE[c.biome];
    const dress = !!this.dresser;
    let k = 0;
    for (let side = -1; side <= 1; side += 2) {
      // A dense wall right at the treeline so the forest limit reads clearly.
      for (let z = z0; z < z0 + CHUNK_LEN; z += 3.4 / Math.max(0.35, dens)) {
        const jz = z + (hashf(i, k, 1) - 0.5) * 2.5;
        const sh = c.shapeAt(jz);
        // A tree run's wall closes in to its own limit; a wall's forest stands back behind its crest.
        const inner = sh.limit < FOREST_LIMIT && c.section(jz).kind === 'treerun' ? sh.limit : sh.wall > 0.3 ? crestE(sh.limit) + 5 : FOREST_LIMIT;
        const e = inner + 0.6 + hashf(i, k, 2) * 3.2;
        if (!standable(c, jz, e)) {
          k++;
          continue;
        }
        if (dress || clear.length > 0) {
          const sig = signature(c, jz);
          const thin = dress ? wallThinning(sig.kind, sig.k) : 0;
          if ((thin > 0 && hashf(i, k, 13) < thin) || (clear.length > 0 && inClearing(clear, side, e, jz))) {
            k++;
            continue;
          }
        }
        const set = hashf(i, k, 3) < 0.7 ? 'a' : 'b';
        this.tree('fw:' + set, set, share[set], i, k, c.centerX(jz) + side * (c.halfWidth(jz) + e), jz, 0.9 + hashf(i, k, 4) * 0.6, hashf(i, k, 5) * 6.28, 0.75 + 0.5 * hashf(i, k, 11));
        k++;
      }
      // Sparser forest further out.
      const n = Math.round(26 * dens);
      for (let t = 0; t < n; t++) {
        const jz = z0 + hashf(i, k, 6) * CHUNK_LEN;
        const e = FOREST_LIMIT + 4 + Math.pow(hashf(i, k, 7), 1.6) * 75;
        if ((clear.length > 0 && inClearing(clear, side, e, jz)) || !standable(c, jz, e)) {
          k++;
          continue;
        }
        const set = hashf(i, k, 8) < 0.6 ? 'a' : 'b';
        this.tree('fo:' + set, set, share[set], i, k, c.centerX(jz) + side * (c.halfWidth(jz) + e), jz, 0.8 + hashf(i, k, 9) * 0.9, hashf(i, k, 10) * 6.28, 0.75 + 0.5 * hashf(i, k, 12));
        k++;
      }
      // A tree run is a forest you ride through: a second, taller rank right behind the wall, crowded
      // close, so the run has a dark mass either side and tops closing over it.
      for (let t = 0; t < 22; t++) {
        const jz = z0 + hashf(i, k, 6) * CHUNK_LEN;
        const sec = c.section(jz);
        const sh = c.shapeAt(jz);
        if (sec.kind !== 'treerun' || jz < sec.z0 + sec.blend * 0.5 || jz > sec.z1 - 8) {
          k++;
          continue;
        }
        const e = sh.limit + 0.8 + hashf(i, k, 7) * 7;
        if (clear.length > 0 && inClearing(clear, side, e, jz)) {
          k++;
          continue;
        }
        const set = hashf(i, k, 8) < 0.75 ? 'a' : 'b';
        this.tree('fw:' + set, set, share[set], i, k, c.centerX(jz) + side * (c.halfWidth(jz) + e), jz, 1.25 + hashf(i, k, 9) * 0.7, hashf(i, k, 10) * 6.28, 0.95 + 0.4 * hashf(i, k, 12));
        k++;
      }
    }
  }

  /** One forest tree; `tall` stretches it (about +-25%), so no two neighbours stand the same height.
   *  It takes the set's variant with chance `share`, a colour a step off its neighbours' (value and a
   *  trace of warm or cool), and one upright tree in eight leans a little. */
  private tree(b: string, set: 'a' | 'b', share: number, i: number, k: number, x: number, z: number, scale: number, rot: number, tall: number): void {
    const pick = this.arches && hashf(i, k, 14) < share ? 1 : 0;
    this.q.setFromAxisAngle(this.up, rot);
    if (hashf(i, k, 15) < 0.125 && canLean(this.course.biome, set, pick)) {
      const a = hashf(i, k, 16) * 6.28;
      this.tilt.set(Math.cos(a), 0, Math.sin(a));
      this.lean.setFromAxisAngle(this.tilt, 0.06 + 0.11 * hashf(i, k, 17));
      this.q.premultiply(this.lean);
    }
    this.v.set(x, visualGround(this.course, x, z) - 0.1, -z);
    this.s.set(scale, scale * tall, scale);
    const v = 0.9 + 0.11 * hashf(i, k, 18);
    const w = (hashf(i, k, 19) - 0.5) * 0.09;
    // (A far row's tree is marked to lean into the fog, wherever its chunk's batch is.)
    this.push(b, this.v, this.q, this.s, b.startsWith('fo:') ? pick + AERIAL_PICK : pick, v * (1 + w), v, v * (1 - w));
  }

  /**
   * The near rows' trees with snow on their boughs (a pine, a blossom, a charred pine; never a snag, a
   * spire or a basalt formation) standing within `r` metres of sim (x, z) across the run and within
   * `ahead` metres down it: what a rider passing close shakes snow from (world.ts). Writes triples (a key
   * that names the tree for this course, its sim x and z) into out and returns how many trees. Reads the
   * chunks' packed batches: nothing is made.
   */
  treesNear(x: number, z: number, r: number, ahead: number, out: number[]): number {
    const biome = this.course.biome;
    if (biome === 'glacier') return 0;
    let n = 0;
    for (let i = Math.floor((z - 1) / CHUNK_LEN); i <= Math.floor((z + ahead) / CHUNK_LEN); i++) {
      const packed = this.cache.get(i);
      if (!packed) continue;
      for (let s = 0; s < 2; s++) {
        const set = s === 0 ? 'a' : 'b';
        const b = packed.get(s === 0 ? 'fw:a' : 'fw:b');
        if (!b) continue;
        for (let k = 0; k < b.p.length; k++) {
          const pick = b.p[k] >= AERIAL_PICK - 0.5 ? b.p[k] - AERIAL_PICK : b.p[k];
          if (!boughs(biome, set, pick)) continue;
          const tx = b.m[k * 16 + 12];
          const tz = -b.m[k * 16 + 14];
          if (Math.abs(tx - x) > r || tz < z - 1 || tz > z + ahead) continue;
          if (n * 3 + 2 >= out.length) return n;
          out[n * 3] = i * 65536 + s * 32768 + k;
          out[n * 3 + 1] = tx;
          out[n * 3 + 2] = tz;
          n++;
        }
      }
    }
    return n;
  }

  /** One grove piece (groves.ts): its variant is the grove's choice (Low draws each set's first only), its
   *  colour a step off its neighbours' as a forest tree's, and it never leans (a formation stands plumb,
   *  an orchard is planted straight). */
  private readonly plantFn: Plant = (near, set, pick, side, e, z, scale, yaw, tall) => {
    const c = this.course;
    const x = c.centerX(z) + side * (c.halfWidth(z) + e);
    const zi = Math.round(z * 8);
    this.q.setFromAxisAngle(this.up, yaw);
    this.v.set(x, visualGround(c, x, z) - 0.1, -z);
    this.s.set(scale, scale * tall, scale);
    const v = 0.9 + 0.11 * hashf(zi, side, 18);
    const w = (hashf(zi, side, 19) - 0.5) * 0.09;
    const b = (near ? 'fw:' : 'fo:') + set;
    const p = this.arches ? pick : 0;
    this.push(b, this.v, this.q, this.s, near ? p : p + AERIAL_PICK, v * (1 + w), v, v * (1 - w));
  };

  private push(key: string, pos: Vector3, q: Quaternion, s: Vector3, pick = 0, r = 1, g = 1, bl = 1): void {
    this.m.compose(pos, q, s);
    this.pushM(key, this.m, pick, r, g, bl);
  }

  private pushM(key: string, m: Matrix4, pick = 0, r = 1, g = 1, bl = 1): void {
    if (this.collecting) {
      let arr = this.collecting.get(key);
      if (!arr) this.collecting.set(key, (arr = { m: [], p: [], c: [] }));
      for (let k = 0; k < 16; k++) arr.m.push(m.elements[k]);
      arr.p.push(pick);
      arr.c.push(r, g, bl);
      return;
    }
    const b = this.batches.get(key);
    if (!b || b.count >= b.mesh.instanceMatrix.count) return;
    if (b.pick) {
      b.pick.setX(b.count, pick);
      b.mesh.instanceColor?.setXYZ(b.count, r, g, bl);
    }
    b.mesh.setMatrixAt(b.count++, m);
  }
}
