import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { CHUNK_LEN, Course, FOREST_LIMIT, ObstacleKind, Section, SectionKind } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { BARK, SNOW, crystal, merge, part, reseed, shade, softPart, variantSet } from './flora';
import { Palette } from './palette';

// Bank set dressing and the course sections' signatures: decorative pieces on and beyond the banks,
// never in the corridor. Two kits (small and large pieces), each one variant set drawn by one
// InstancedMesh (flora.ts), so the whole of it costs two draw calls on Medium and High; Low draws none.
//
// Signatures, so each section reads before it plays:
//   chute        rock bands on the banks and a line of slalom poles in the mood's blue-violets
//   bowl         a wind-sculpted cornice lip along the rim, curling over the run
//   benches      fence rails along the terraces
//   gully        steep, icicled rock walls on both banks
//   split        a signpost with two arrows at the head of the tree island
//   switchbacks, cruise: the default forest
// Wide sections may carry a distant lift line (towers and a cable) and a cabin in a clearing.

/** Small kit pieces. */
export const S_BUSH = 0;
export const S_STUMP = 1;
export const S_FENCE = 2;
export const S_POLE = 3;
export const S_BIO1 = 4;
export const S_BIO2 = 5;
/** Large kit pieces. */
export const L_CABIN = 0;
export const L_TOWER = 1;
export const L_CABLE = 2;
export const L_ROCKBAND = 3;
export const L_CORNICE = 4;
export const L_WALL = 5;
export const L_SIGN = 6;

/** Fence and bank pieces are modelled this long along local x. */
const FENCE_LEN = 6;
const PIECE_LEN = 6;
/** Height of the lift tower's crossarm (the cable's line). */
const TOWER_TOP = 9.6;

// ---------------------------------------------------------------- kits

function mix(a: Color, b: Color, t: number): Color {
  return a.clone().lerp(b, t);
}

function fence(post: Color, rail: Color, cap: Color): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const x of [-2.9, 0, 2.9]) {
    parts.push(part(new CylinderGeometry(0.07, 0.085, 1.5, 5), post, { pos: [x, 0.45, 0] }));
    parts.push(part(new ConeGeometry(0.11, 0.1, 5), SNOW, { pos: [x, 1.24, 0] }));
  }
  parts.push(part(new BoxGeometry(FENCE_LEN, 0.09, 0.06), rail, { pos: [0, 0.55, 0.06] }));
  parts.push(part(new BoxGeometry(FENCE_LEN, 0.1, 0.07), cap, { pos: [0, 0.98, 0.06] }));
  parts.push(part(new BoxGeometry(FENCE_LEN, 0.07, 0.13), SNOW, { pos: [0, 1.06, 0.06] }));
  return merge(parts);
}

function bush(leaf: Color): BufferGeometry {
  reseed(9101);
  const parts: BufferGeometry[] = [part(new IcosahedronGeometry(0.75, 0), SNOW, { pos: [0, 0.12, 0], scale: [1.45, 0.62, 1.25], jitter: 0.12 })];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * 6.28 + 0.4;
    parts.push(part(new IcosahedronGeometry(0.34, 0), k % 2 ? leaf : shade(leaf, 0.82), { pos: [Math.cos(a) * 0.62, 0.36, Math.sin(a) * 0.5], rot: [a, a * 2, 0], jitter: 0.1 }));
  }
  parts.push(part(new IcosahedronGeometry(0.42, 0), SNOW, { pos: [0.1, 0.5, 0], scale: [1.3, 0.5, 1.1], jitter: 0.08 }));
  return merge(parts);
}

function stump(bark: Color, top: Color): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.32, 0.42, 0.62, 7), bark, { pos: [0, 0.26, 0], jitter: 0.04 }),
    part(new CylinderGeometry(0.3, 0.31, 0.04, 7), top, { pos: [0, 0.58, 0] }),
    part(new CylinderGeometry(0.26, 0.33, 0.16, 7), SNOW, { pos: [0.04, 0.66, 0], scale: [1, 1, 0.9] }),
    part(new IcosahedronGeometry(0.55, 0), SNOW, { pos: [0, 0.02, 0], scale: [1.4, 0.3, 1.3], jitter: 0.08 }),
  ]);
}

/** A slalom marker: a pole with a pennant, white so each instance's colour paints it. */
function pole(): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.045, 0.055, 2.5, 5), new Color('#E6E8F2'), { pos: [0, 1.15, 0] }),
    part(new BoxGeometry(0.95, 0.66, 0.03), new Color('#FFFFFF'), { pos: [0.48, 2.02, 0] }),
    part(new BoxGeometry(0.95, 0.1, 0.035), new Color('#C8CCDC'), { pos: [0.48, 1.86, 0] }),
    part(new IcosahedronGeometry(0.28, 0), SNOW, { pos: [0, 0.0, 0], scale: [1.2, 0.4, 1.2] }),
  ]);
}

function outcrop(p: Palette): BufferGeometry {
  reseed(9202);
  return merge([
    part(new IcosahedronGeometry(0.9, 0), p.low, { pos: [0, 0.3, 0], scale: [1.3, 0.8, 1.0], rot: [rnd(), rnd() * 3, rnd()], jitter: 0.3 }),
    part(new IcosahedronGeometry(0.55, 0), p.lowLit, { pos: [0.6, 0.2, 0.3], rot: [rnd(), rnd(), rnd()], jitter: 0.18 }),
    part(new IcosahedronGeometry(0.7, 0), SNOW, { pos: [0, 0.8, 0], scale: [1.1, 0.3, 0.9], jitter: 0.12 }),
  ]);
}

let rs = 7;
function rnd(): number {
  rs = (rs * 1664525 + 1013904223) >>> 0;
  return rs / 4294967296;
}

function trailSign(): BufferGeometry {
  const wood = new Color('#6E5C62');
  return merge([
    part(new CylinderGeometry(0.06, 0.07, 1.7, 5), wood, { pos: [0, 0.7, 0] }),
    part(new BoxGeometry(0.7, 0.36, 0.05), new Color('#D9D2CC'), { pos: [0, 1.38, 0.05] }),
    part(new BoxGeometry(0.74, 0.08, 0.12), SNOW, { pos: [0, 1.6, 0.05] }),
    part(new IcosahedronGeometry(0.3, 0), SNOW, { pos: [0, 0, 0], scale: [1.2, 0.4, 1.2] }),
  ]);
}

function iceShards(p: Palette): BufferGeometry {
  const ice = p.lowLit.clone().lerp(new Color('#DDF4FF'), 0.35);
  return merge([
    crystal(ice, 0.24, 1.3, [0, 0, 0], [0.12, 0.2, -0.2]),
    crystal(shade(ice, 0.85), 0.18, 0.9, [0.35, 0, 0.2], [0.3, 0.9, 0.45]),
    crystal(shade(ice, 1.08), 0.15, 0.65, [-0.32, 0, -0.1], [-0.3, 0.3, -0.5]),
    part(new IcosahedronGeometry(0.6, 0), SNOW, { pos: [0, 0.0, 0], scale: [1.3, 0.3, 1.2], jitter: 0.08 }),
  ]);
}

/** Ember Peak: a dark fissure in the snow with pale steam pooled over it. */
function steamFissure(p: Palette): BufferGeometry {
  reseed(9303);
  const rock = shade(p.low, 0.7);
  const steam = new Color('#E8E4F0');
  return merge([
    part(new BoxGeometry(2.4, 0.3, 0.7, 3, 1, 1), rock, { pos: [0, 0.05, 0], jitter: 0.18 }),
    part(new BoxGeometry(2.0, 0.12, 0.3), new Color('#2A2032'), { pos: [0, 0.2, 0] }),
    part(new IcosahedronGeometry(0.55, 0), steam, { pos: [-0.5, 0.75, 0], scale: [1.1, 0.8, 0.9], jitter: 0.06 }),
    part(new IcosahedronGeometry(0.45, 0), steam, { pos: [0.4, 1.25, 0.1], scale: [1.0, 0.9, 0.9], jitter: 0.06 }),
    part(new IcosahedronGeometry(0.35, 0), steam, { pos: [0.1, 1.75, -0.05], jitter: 0.05 }),
    part(new IcosahedronGeometry(0.7, 0), SNOW, { pos: [0, -0.02, 0.55], scale: [1.8, 0.3, 0.6], jitter: 0.08 }),
    part(new IcosahedronGeometry(0.7, 0), SNOW, { pos: [0, -0.02, -0.55], scale: [1.8, 0.3, 0.6], jitter: 0.08 }),
  ]);
}

function basaltPair(p: Palette): BufferGeometry {
  return merge([
    part(new CylinderGeometry(0.42, 0.45, 1.6, 6), p.tall, { pos: [0, 0.7, 0] }),
    part(new CylinderGeometry(0.4, 0.42, 0.1, 6), SNOW, { pos: [0, 1.55, 0] }),
    part(new CylinderGeometry(0.34, 0.36, 1.0, 6), p.tallDark, { pos: [0.6, 0.4, 0.2], rot: [0, 0.4, 0] }),
    part(new CylinderGeometry(0.32, 0.34, 0.1, 6), SNOW, { pos: [0.6, 0.95, 0.2], rot: [0, 0.4, 0] }),
    part(new IcosahedronGeometry(0.75, 0), SNOW, { pos: [0.2, 0.0, 0], scale: [1.4, 0.3, 1.2], jitter: 0.08 }),
  ]);
}

/** Sakura Ridge: an unlit stone lantern on the bank (the run's own lanterns are the lit hazards). */
function stoneLantern(): BufferGeometry {
  const stone = new Color('#8A8496');
  const dark = new Color('#5E586C');
  return merge([
    part(new BoxGeometry(0.7, 0.2, 0.7), dark, { pos: [0, 0.1, 0] }),
    part(new CylinderGeometry(0.12, 0.16, 0.5, 6), stone, { pos: [0, 0.45, 0] }),
    part(new BoxGeometry(0.55, 0.42, 0.55), stone, { pos: [0, 0.88, 0] }),
    part(new BoxGeometry(0.34, 0.24, 0.57), new Color('#4A4458'), { pos: [0, 0.88, 0] }),
    part(new ConeGeometry(0.5, 0.3, 4), dark, { pos: [0, 1.24, 0], rot: [0, Math.PI / 4, 0] }),
    part(new ConeGeometry(0.4, 0.16, 4), SNOW, { pos: [0, 1.35, 0], rot: [0, Math.PI / 4, 0] }),
  ]);
}

/** Sakura Ridge: a torii-like fence: dark posts under a lacquered top rail with upturned ends. */
function toriiFence(p: Palette): BufferGeometry {
  const lacquer = new Color('#3A2A36');
  const top = shade(p.accentProp, 0.5).lerp(new Color('#3A2A36'), 0.35);
  const parts: BufferGeometry[] = [];
  for (const x of [-2.6, 2.6]) parts.push(part(new CylinderGeometry(0.1, 0.12, 1.8, 6), lacquer, { pos: [x, 0.7, 0] }));
  parts.push(part(new BoxGeometry(5.6, 0.1, 0.1), lacquer, { pos: [0, 1.1, 0] }));
  parts.push(part(new BoxGeometry(6.4, 0.16, 0.2), top, { pos: [0, 1.6, 0] }));
  parts.push(part(new BoxGeometry(0.5, 0.14, 0.2), top, { pos: [-3.3, 1.66, 0], rot: [0, 0, 0.3] }));
  parts.push(part(new BoxGeometry(0.5, 0.14, 0.2), top, { pos: [3.3, 1.66, 0], rot: [0, 0, -0.3] }));
  parts.push(part(new BoxGeometry(6.2, 0.08, 0.26), SNOW, { pos: [0, 1.72, 0] }));
  return merge(parts);
}

/** The small kit (bush, stump, fence, pole and two biome pieces), as one variant set. */
export function smallKitSteps(biome: BiomeId, p: Palette): Array<() => BufferGeometry> {
  if (biome === 'alpine') {
    return [() => bush(shade(p.tall, 0.9)), () => stump(BARK, new Color('#9A8890')), () => fence(new Color('#5E4E56'), new Color('#6E5C62'), new Color('#6E5C62')), pole, () => outcrop(p), trailSign];
  }
  if (biome === 'glacier') {
    // (Frostfang's "stump" is a frosted boulder, its first piece a cluster of ice shards.)
    const pale = new Color('#5A5E78');
    return [() => bush(mix(p.lowLit, new Color('#DDF4FF'), 0.2)), () => outcrop(p), () => fence(pale, new Color('#3A3C52'), pale), pole, () => iceShards(p), trailSign];
  }
  if (biome === 'volcanic') {
    const char = new Color('#2E2836');
    return [() => bush(new Color('#3A3242')), () => stump(char, new Color('#4E4658')), () => fence(char, new Color('#3A3344'), new Color('#3A3344')), pole, () => steamFissure(p), () => basaltPair(p)];
  }
  return [() => bush(shade(p.tall, 0.72)), () => stump(BARK, new Color('#9A8890')), () => fence(new Color('#3A2A36'), new Color('#3A2A36'), shade(p.accentProp, 0.45)), pole, stoneLantern, () => toriiFence(p)];
}

export function smallKit(biome: BiomeId, p: Palette): BufferGeometry {
  return variantSet(smallKitSteps(biome, p).map((f) => f()));
}

function cabin(biome: BiomeId, p: Palette): BufferGeometry {
  const wall = biome === 'volcanic' ? shade(p.low, 0.9) : biome === 'blossom' ? new Color('#5E4650') : new Color('#5A4A50');
  const roof = new Color('#2E2A3A');
  const stone = shade(p.low, 1.05);
  const win = new Color('#2A2540');
  return merge([
    part(new BoxGeometry(4.2, 2.3, 3.2), wall, { pos: [0, 1.0, 0] }),
    // The gables: a diamond prism whose lower half sits in the walls.
    part(new BoxGeometry(4.2, 1.6, 1.6), shade(wall, 0.9), { pos: [0, 2.15, 0], rot: [Math.PI / 4, 0, 0] }),
    part(new BoxGeometry(4.8, 0.16, 2.35), roof, { pos: [0, 2.72, 0.82], rot: [Math.PI / 4.2, 0, 0] }),
    part(new BoxGeometry(4.8, 0.16, 2.35), roof, { pos: [0, 2.72, -0.82], rot: [-Math.PI / 4.2, 0, 0] }),
    // Thick snow on the roof, rounded over the ridge.
    part(new BoxGeometry(4.9, 0.32, 2.2), SNOW, { pos: [0, 2.92, 0.74], rot: [Math.PI / 4.2, 0, 0] }),
    part(new BoxGeometry(4.9, 0.32, 2.2), SNOW, { pos: [0, 2.92, -0.74], rot: [-Math.PI / 4.2, 0, 0] }),
    part(new CylinderGeometry(0.28, 0.28, 4.9, 7), SNOW, { pos: [0, 3.62, 0], rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.8] }),
    part(new BoxGeometry(0.45, 1.3, 0.45), stone, { pos: [1.3, 3.3, -0.5] }),
    part(new BoxGeometry(0.55, 0.16, 0.55), SNOW, { pos: [1.3, 4.0, -0.5] }),
    part(new BoxGeometry(0.7, 0.6, 0.06), win, { pos: [-1.1, 1.3, 1.61] }),
    part(new BoxGeometry(0.7, 0.6, 0.06), win, { pos: [1.1, 1.3, 1.61] }),
    part(new BoxGeometry(0.06, 0.6, 0.7), win, { pos: [2.11, 1.3, 0] }),
    part(new BoxGeometry(0.06, 1.5, 0.8), shade(wall, 0.7), { pos: [-2.11, 0.85, 0.4] }),
    part(new IcosahedronGeometry(1.2, 0), SNOW, { pos: [0, 0.0, 1.8], scale: [2.0, 0.4, 0.7], jitter: 0.12 }),
    part(new IcosahedronGeometry(1.2, 0), SNOW, { pos: [0, 0.0, -1.8], scale: [2.0, 0.45, 0.7], jitter: 0.12 }),
  ]);
}

function tower(): BufferGeometry {
  const steel = new Color('#4A4E66');
  const dark = new Color('#33354A');
  return merge([
    part(new BoxGeometry(1.3, 0.7, 1.3), new Color('#8A8496'), { pos: [0, 0.15, 0] }),
    part(new CylinderGeometry(0.2, 0.34, TOWER_TOP, 6), steel, { pos: [0, TOWER_TOP / 2, 0] }),
    part(new BoxGeometry(0.34, 0.34, 3.6), dark, { pos: [0, TOWER_TOP, 0] }),
    part(new BoxGeometry(0.5, 0.26, 0.4), steel, { pos: [0, TOWER_TOP - 0.15, 1.6] }),
    part(new BoxGeometry(0.5, 0.26, 0.4), steel, { pos: [0, TOWER_TOP - 0.15, -1.6] }),
    part(new BoxGeometry(0.4, 0.1, 3.6), SNOW, { pos: [0, TOWER_TOP + 0.22, 0] }),
    part(new IcosahedronGeometry(1.0, 0), SNOW, { pos: [0, 0.1, 0], scale: [1.3, 0.4, 1.3], jitter: 0.1 }),
  ]);
}

/** Two cable lines, unit length along +x from the origin (stretched per span). */
function cable(): BufferGeometry {
  const c = new Color('#2A2838');
  return merge([part(new BoxGeometry(1, 0.05, 0.05), c, { pos: [0.5, -0.15, 1.6] }), part(new BoxGeometry(1, 0.05, 0.05), c, { pos: [0.5, -0.15, -1.6] })]);
}

/** A chunky faceted rock mass (ART.md: rocks are chunky crystals; a box with a flat snow lid reads
 *  as concrete). */
function crag(col: Color, pos: [number, number, number], scale: [number, number, number], jitter = 0.32): BufferGeometry {
  return part(new IcosahedronGeometry(1, 0), col, { pos, scale, rot: [rnd() * 0.4, rnd() * 3, rnd() * 0.4], jitter });
}

/** A lumpy drift of snow lying on a ledge. */
function drift(pos: [number, number, number], scale: [number, number, number]): BufferGeometry {
  return part(new IcosahedronGeometry(1, 0), SNOW, { pos, scale, rot: [0, rnd() * 3, 0], jitter: 0.14 });
}

/** Chute: dark rock bands stepping up the bank, snow lying on their ledges; the face looks along +z. */
function rockBand(p: Palette): BufferGeometry {
  reseed(9404);
  rs = 9404;
  const dark = shade(p.low, 0.72);
  const mid = shade(p.low, 0.9);
  return merge([
    crag(dark, [-1.6, 0.4, 0.2], [1.9, 1.1, 1.4]),
    crag(mid, [1.4, 0.3, 0.4], [1.8, 0.95, 1.3]),
    crag(dark, [0.2, 1.4, -0.5], [2.1, 1.0, 1.2]),
    crag(shade(p.lowLit, 0.85), [1.9, 1.5, -0.6], [1.1, 0.8, 0.9], 0.22),
    crag(mid, [-0.6, 2.4, -1.1], [1.5, 0.9, 1.0], 0.26),
    drift([-1.4, 1.3, 0.75], [1.5, 0.22, 0.6]),
    drift([1.3, 1.08, 0.95], [1.4, 0.2, 0.55]),
    drift([0.2, 2.3, 0.05], [1.6, 0.22, 0.6]),
    drift([-0.6, 3.2, -1.0], [1.2, 0.28, 0.8]),
  ]);
}

/** Bowl: a cornice, the wind-sculpted lip of snow at the top of the bank, curling out over +z with
 *  a periwinkle shadow under its overhang. Soft, rounded (snow is safe space). */
function cornice(p: Palette): BufferGeometry {
  const under = mix(SNOW, p.snowShade, 0.85);
  const parts: BufferGeometry[] = [];
  // Three overlapping wind-rounded lumps along the lip, each its own height and reach, so a run of
  // them reads as one sculpted edge rather than a rail.
  const lumps = [
    [-2.1, 1.15, 1.0, 2.5],
    [0.1, 1.45, 1.35, 2.7],
    [2.2, 1.25, 1.15, 2.4],
  ];
  for (const [x, h, reach, len] of lumps) {
    parts.push(softPart(new SphereGeometry(1, 8, 4), SNOW, { pos: [x, h * 0.55, 0.4 + reach * 0.35], scale: [len * 0.62, h * 0.62, reach] }));
    // The overhang's underside in periwinkle shade, tucked under the lip.
    parts.push(softPart(new SphereGeometry(1, 6, 3), under, { pos: [x, h * 0.2, 0.3 + reach * 0.55], scale: [len * 0.5, h * 0.3, reach * 0.62] }));
  }
  // The wind-loaded back slope behind the lip, falling away from the run.
  parts.push(softPart(new SphereGeometry(1, 8, 3), SNOW, { pos: [0, 0.35, -1.2], scale: [PIECE_LEN * 0.6, 0.95, 2.0] }));
  return merge(parts);
}

/** Gully: a steep rock wall with icicles hanging off its ledges; the face looks along +z, its foot
 *  buried deep in the bank. */
function rockWall(p: Palette): BufferGeometry {
  reseed(9505);
  rs = 9505;
  const ice = new Color('#E2F2FF');
  const dark = shade(p.low, 0.66);
  const mid = shade(p.low, 0.82);
  // Tall leaning slabs of dark rock, shoulder to shoulder, a lighter one set back above; snow lying
  // on the mid ledge and the top.
  const parts: BufferGeometry[] = [
    crag(dark, [-2.2, 1.0, 0.1], [1.5, 3.9, 1.1], 0.4),
    crag(mid, [0.0, 1.3, 0.25], [1.6, 4.3, 1.15], 0.4),
    crag(dark, [2.2, 0.9, 0.05], [1.5, 3.7, 1.1], 0.4),
    crag(shade(p.lowLit, 0.8), [0.6, 4.2, -0.6], [2.4, 1.4, 1.0], 0.3),
    drift([0.1, 2.45, 1.05], [2.7, 0.16, 0.42]),
    drift([-1.4, 4.95, 0.2], [1.9, 0.3, 1.0]),
    drift([1.5, 5.1, 0.0], [1.8, 0.32, 1.0]),
  ];
  for (let k = 0; k < 8; k++) {
    const x = -2.9 + k * 0.82 + (rnd() - 0.5) * 0.3;
    const len = 0.7 + rnd() * 1.1;
    const r = 0.1 + rnd() * 0.08;
    const high = k % 2 === 0;
    parts.push(part(new ConeGeometry(r, len, 5), ice, { pos: [x, (high ? 4.85 : 2.3) - len / 2, high ? 1.05 : 1.3], rot: [Math.PI, 0, 0] }));
  }
  return merge(parts);
}

/** Split: a signpost with two arrows, one down each side of the island; it faces up the run (+z). */
function signpost(): BufferGeometry {
  const wood = new Color('#5E4E56');
  const board = new Color('#EDE6DA');
  const ink = new Color('#3A3550');
  const arrow = (dir: number, y: number, tilt: number): BufferGeometry[] => [
    part(new BoxGeometry(1.15, 0.32, 0.07), board, { pos: [dir * 0.62, y, 0.1], rot: [0, 0, dir * tilt] }),
    part(new ConeGeometry(0.3, 0.42, 3), board, { pos: [dir * 1.38, y - dir * tilt * 0.75, 0.1], rot: [0, 0, -dir * Math.PI / 2 + dir * tilt], scale: [1, 1, 0.25] }),
    part(new BoxGeometry(0.7, 0.07, 0.08), ink, { pos: [dir * 0.6, y, 0.12], rot: [0, 0, dir * tilt] }),
    part(new BoxGeometry(1.15, 0.07, 0.12), SNOW, { pos: [dir * 0.62, y + 0.2, 0.1], rot: [0, 0, dir * tilt] }),
  ];
  return merge([
    part(new CylinderGeometry(0.08, 0.1, 3.1, 6), wood, { pos: [0, 1.35, 0] }),
    part(new ConeGeometry(0.14, 0.16, 6), SNOW, { pos: [0, 2.98, 0] }),
    ...arrow(-1, 2.55, 0.16),
    ...arrow(1, 2.1, 0.16),
    part(new IcosahedronGeometry(0.45, 0), SNOW, { pos: [0, 0.0, 0], scale: [1.3, 0.4, 1.3] }),
  ]);
}

/** The large kit (cabin, lift tower and cable, and the section signatures), as one variant set. */
export function largeKitSteps(biome: BiomeId, p: Palette): Array<() => BufferGeometry> {
  return [() => cabin(biome, p), tower, cable, () => rockBand(p), () => cornice(p), () => rockWall(p), signpost];
}

export function largeKit(biome: BiomeId, p: Palette): BufferGeometry {
  return variantSet(largeKitSteps(biome, p).map((f) => f()));
}

// ---------------------------------------------------------------- colours

/** Slalom flag colours for a mood: its zenith's hue held in the blue-violets (never vermillion,
 *  marigold, mint, rose, gold-white or the hazards' ice blue; ART.md section 1), at a mid value so
 *  they read on snow and against the trees. */
export function flagColors(p: Palette): [Color, Color] {
  const hsl = { h: 0, s: 0, l: 0 };
  p.skyZenith.getHSL(hsl);
  let h = hsl.h * 360;
  if (h < 215 || h > 290) h = h >= 150 && h < 215 ? 228 : 262;
  const a = new Color().setHSL(h / 360, 0.6, 0.42);
  const b = new Color().setHSL(((h + 34) % 360) / 360, 0.5, 0.36);
  return [a, b];
}

// ---------------------------------------------------------------- placement

export type Put = (key: 'dr:s' | 'dr:l', m: Matrix4, pick: number, r: number, g: number, b: number) => void;

/** Ground kept clear of the far forest: a cabin's clearing, a lift line's cut. */
export interface Clearing {
  side: number;
  e: number;
  z0: number;
  z1: number;
  /** Half-width across the bank (metres of edge excess). */
  w: number;
}

/** How a section's signature fades in and out at z: 0 outside, 1 in its body. */
export function signature(c: Course, z: number): { kind: SectionKind; k: number; sec: Section } {
  const sec = c.section(z);
  const k = smooth(sec.z0 + 10, sec.z0 + 60, z) * (1 - smooth(sec.z1 - 20, sec.z1, z));
  return { kind: sec.kind, k, sec };
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

const TALL_KINDS: ReadonlySet<ObstacleKind> = new Set(['pine', 'spire', 'basalt', 'charpine', 'blossom', 'serac', 'pillar']);
/** How far a tall obstacle's canopy reaches up the run at a signpost's board height (model metres). */
const CANOPY: Partial<Record<ObstacleKind, number>> = { pine: 1.15, blossom: 2.3, charpine: 0.9, spire: 1.0, basalt: 1.2, pillar: 0.6 };

/** A lift line on a section: wide sections (bowl, split) often carry one, a cruise now and then. */
function liftOf(sec: Section): { side: number; e: number; z0: number; z1: number } | null {
  const h = hashf(Math.round(sec.z0), 0x11f7, 1);
  const chance = sec.kind === 'bowl' || sec.kind === 'split' ? 0.55 : sec.kind === 'cruise' ? 0.2 : 0;
  if (h >= chance || sec.z1 - sec.z0 < 180) return null;
  return { side: hashf(Math.round(sec.z0), 0x11f7, 2) < 0.5 ? -1 : 1, e: 24 + hashf(Math.round(sec.z0), 0x11f7, 3) * 14, z0: sec.z0 + 30, z1: sec.z1 - 30 };
}
const TOWER_STEP = 46;

/**
 * Bank dressing for one chunk. Every piece stands at or past the treeline's foot (an edge excess of
 * 9.2 m or more, where a sled is already about to crash into the forest at 10), never in the
 * corridor, never near the safe line; the split's signpost stands inside the island's first tree's
 * collider. Deterministic: only the course and the hash helpers.
 */
export class Dresser {
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private a = new Vector3();
  private b = new Vector3();
  private xa = new Vector3();
  private ya = new Vector3();
  private za = new Vector3();
  private up = new Vector3(0, 1, 0);
  /** Split sections' island heads (sim x and z, and how far uphill of it the sign stands), by section start. */
  private heads = new Map<number, { x: number; z: number; clear: number } | null>();
  private flags: [Color, Color];

  constructor(
    private c: Course,
    p: Palette,
    private dens: number,
  ) {
    this.flags = flagColors(p);
  }

  /** Places chunk i's dressing through `put`, and lists the clearings the forest must keep. */
  chunk(i: number, put: Put, clear: Clearing[]): void {
    const c = this.c;
    const z0 = i * CHUNK_LEN;
    const z1 = z0 + CHUNK_LEN;
    if (z1 < 60) return;
    // The sections this chunk touches.
    const secs: Section[] = [];
    for (let z = z0; z < z1; z += 8) {
      const s = c.section(z);
      if (!secs.includes(s)) secs.push(s);
    }
    for (const sec of secs) {
      const lift = liftOf(sec);
      if (lift) this.lift(i, lift, put, clear);
      if (sec.kind === 'split') this.splitHead(i, sec, put);
    }
    for (let side = -1; side <= 1; side += 2) {
      this.signatures(i, side, put);
      this.cabin(i, side, put, clear, secs);
      this.clutter(i, side, put);
    }
  }

  /** The bank point at edge excess e on `side` at sim z, in world space. */
  private bankPoint(side: number, e: number, z: number, out: Vector3): Vector3 {
    const c = this.c;
    const x = c.centerX(z) + side * (c.halfWidth(z) + e);
    return out.set(x, c.ground(x, z), -z);
  }

  /** A piece laid along the bank: centred at z, its local x along the run, local +z facing the
   *  corridor, pitched to the ground between its ends. */
  private alongBank(side: number, e: number, z: number, len: number, sx: number, sy: number, sz: number, drop: number): Matrix4 {
    this.bankPoint(side, e, z - len / 2, this.a);
    this.bankPoint(side, e, z + len / 2, this.b);
    this.xa.subVectors(this.b, this.a).normalize();
    if (side > 0) this.xa.negate();
    this.ya.copy(this.up).addScaledVector(this.xa, -this.xa.dot(this.up)).normalize();
    this.za.crossVectors(this.xa, this.ya);
    this.bankPoint(side, e, z, this.v);
    const mid = Math.min(this.v.y, (this.a.y + this.b.y) / 2);
    this.m.makeBasis(this.xa.multiplyScalar(sx), this.ya.multiplyScalar(sy), this.za.multiplyScalar(sz));
    this.m.setPosition(this.v.x, mid - drop, this.v.z);
    return this.m;
  }

  private upright(x: number, y: number, z: number, yaw: number, scale: number): Matrix4 {
    this.q.setFromAxisAngle(this.up, yaw);
    this.v.set(x, y, z);
    this.s.setScalar(scale);
    return this.m.compose(this.v, this.q, this.s);
  }

  private signatures(i: number, side: number, put: Put): void {
    const c = this.c;
    const z0 = i * CHUNK_LEN;
    const sd = side < 0 ? 0 : 1;
    // Gully walls and bowl cornices: continuous along both banks, every 5 m.
    for (let n = 0; n < 13; n++) {
      const z = z0 + n * 5 + 2.5;
      const sig = signature(c, z);
      if (sig.k <= 0 || hashf(i, n * 2 + sd, 21) > sig.k * 1.15) continue;
      const h = hashf(i, n * 2 + sd, 22);
      if (sig.kind === 'gully') {
        put('dr:l', this.alongBank(side, 9.9 + h * 0.5, z, 5, 1.0 + h * 0.12, 0.9 + 0.45 * hashf(i, n * 2 + sd, 23), 1, 0.6), L_WALL, 1, 1, 1);
      } else if (sig.kind === 'bowl') {
        put('dr:l', this.alongBank(side, 10.2, z, 5, 0.95 + h * 0.15, 0.85 + 0.45 * hashf(i, n * 2 + sd, 23), 1, 0.25), L_CORNICE, 1, 1, 1);
      }
    }
    // Benches: fence rails along the terraces, with a gap now and then.
    for (let n = 0; n < 10; n++) {
      const z = z0 + n * 6.4 + 3.2;
      const sig = signature(c, z);
      if (sig.kind !== 'benches' || hashf(i, n * 2 + sd, 31) > sig.k * 0.85) continue;
      put('dr:s', this.alongBank(side, 9.4, z, FENCE_LEN, 1.04, 1, 1, 0.05), S_FENCE, 1, 1, 1);
    }
    // Chute: a line of slalom poles at the treeline's foot, the colours alternating down the run, and
    // rock bands stepping up the banks every 20 m or so.
    for (let n = 0; n < 6; n++) {
      const z = z0 + n * 11 + (side < 0 ? 2 : 7.5);
      const sig = signature(c, z);
      if (sig.kind !== 'chute' || sig.k < 0.3) continue;
      const g = Math.floor(z / 11);
      const col = this.flags[g & 1];
      const p = this.bankPoint(side, 9.3, z, this.v);
      put('dr:s', this.upright(p.x, p.y - 0.05, p.z, side < 0 ? 0 : Math.PI, 1), S_POLE, col.r, col.g, col.b);
    }
    for (let n = 0; n < 3; n++) {
      const z = z0 + n * 21 + hashf(i, n * 2 + sd, 41) * 12;
      const sig = signature(c, z);
      if (sig.kind !== 'chute' || hashf(i, n * 2 + sd, 42) > sig.k) continue;
      const h = hashf(i, n * 2 + sd, 43);
      put('dr:l', this.alongBank(side, 10.4 + h * 1.6, z, 5, 0.8 + h * 0.5, 0.8 + 0.6 * hashf(i, n * 2 + sd, 44), 1, 0.6), L_ROCKBAND, 1, 1, 1);
    }
  }

  /** The split's signpost, facing up the run, on the island's line just uphill of its first tree:
   *  clear of the canopy (inside it the boards were hidden), so close to the trunk that a sled
   *  passing the thin post is already on the tree. The boards ride above a rider's head. */
  private splitHead(i: number, sec: Section, put: Put): void {
    let head = this.heads.get(sec.z0);
    if (head === undefined) {
      head = this.findHead(sec);
      this.heads.set(sec.z0, head);
    }
    if (!head) return;
    const z = head.z - head.clear;
    if (Math.floor(z / CHUNK_LEN) !== i) return;
    const c = this.c;
    put('dr:l', this.upright(head.x, c.ground(head.x, z) - 0.25, -z, 0, 1.4), L_SIGN, 1, 1, 1);
  }

  private findHead(sec: Section): { x: number; z: number; clear: number } | null {
    const c = this.c;
    let zs = -1;
    for (let z = sec.z0; z < sec.z1; z += 2) {
      if (c.shapeAt(z).split >= 0.3) {
        zs = z;
        break;
      }
    }
    if (zs < 0) return null;
    let best: { x: number; z: number; clear: number } | null = null;
    for (let k = Math.floor(zs / CHUNK_LEN); k <= Math.floor(zs / CHUNK_LEN) + 1; k++) {
      for (const o of c.chunk(k).obstacles) {
        if (o.soft || !TALL_KINDS.has(o.kind) || o.z < zs - 1 || Math.abs(o.x - c.centerX(o.z)) > 1.7) continue;
        if (!best || o.z < best.z) best = { x: o.x, z: o.z, clear: Math.max(o.r + 0.5, (CANOPY[o.kind] ?? 1) * o.scale) };
      }
    }
    return best;
  }

  private lift(i: number, l: { side: number; e: number; z0: number; z1: number }, put: Put, clear: Clearing[]): void {
    const z0 = i * CHUNK_LEN;
    const z1 = z0 + CHUNK_LEN;
    if (l.z1 < z0 || l.z0 > z1) return;
    clear.push({ side: l.side, e: l.e, z0: Math.max(z0, l.z0 - 4), z1: Math.min(z1, l.z1 + 4), w: 3.4 });
    const n0 = Math.max(0, Math.ceil((z0 - l.z0) / TOWER_STEP));
    for (let n = n0; ; n++) {
      const z = l.z0 + n * TOWER_STEP;
      if (z >= z1 || z > l.z1) break;
      // The tower turned to the run's direction, its crossarm across it.
      this.bankPoint(l.side, l.e, z - 1, this.a);
      this.bankPoint(l.side, l.e, z + 1, this.b);
      const yaw = Math.atan2(-(this.b.z - this.a.z), this.b.x - this.a.x);
      const t = this.bankPoint(l.side, l.e, z, this.v);
      const tx = t.x;
      const ty = t.y;
      const tz = t.z;
      put('dr:l', this.upright(tx, ty - 0.3, tz, yaw, 1), L_TOWER, 1, 1, 1);
      const zn = z + TOWER_STEP;
      if (zn > l.z1) continue;
      // The cable to the next tower down, from crossarm to crossarm.
      const nb = this.bankPoint(l.side, l.e, zn, this.b);
      this.a.set(tx, ty - 0.3 + TOWER_TOP, tz);
      this.b.set(nb.x, nb.y - 0.3 + TOWER_TOP, nb.z);
      this.xa.subVectors(this.b, this.a);
      const len = this.xa.length();
      this.xa.divideScalar(len);
      this.ya.copy(this.up).addScaledVector(this.xa, -this.xa.dot(this.up)).normalize();
      this.za.crossVectors(this.xa, this.ya);
      this.m.makeBasis(this.xa.multiplyScalar(len), this.ya, this.za);
      this.m.setPosition(this.a);
      put('dr:l', this.m, L_CABLE, 1, 1, 1);
    }
  }

  /** Now and then a cabin in a clearing past the treeline (more often on the wide sections), with a
   *  stump and a short fence by it. */
  private cabin(i: number, side: number, put: Put, clear: Clearing[], secs: Section[]): void {
    const sd = side < 0 ? 0 : 1;
    const wide = secs.some((s) => s.kind === 'bowl' || s.kind === 'split');
    if (hashf(i, sd, 51) > (wide ? 0.26 : 0.09) * this.dens) return;
    const z = i * CHUNK_LEN + 12 + hashf(i, sd, 52) * 40;
    const e = 14 + hashf(i, sd, 53) * 6;
    for (const s of secs) {
      const l = liftOf(s);
      if (l && l.side === side && Math.abs(l.e - e) < 9 && z > l.z0 - 10 && z < l.z1 + 10) return;
    }
    clear.push({ side, e, z0: z - 7, z1: z + 7, w: 6.5 });
    const p = this.bankPoint(side, e, z, this.v);
    // Turned roughly to face the run, a little off square.
    const yaw = (side < 0 ? Math.PI / 2 : -Math.PI / 2) + (hashf(i, sd, 54) - 0.5) * 0.5;
    put('dr:l', this.upright(p.x, p.y - 0.35, p.z, yaw, 1), L_CABIN, 1, 1, 1);
    const fz = z + 5.5;
    put('dr:s', this.alongBank(side, e - 1.5, fz, FENCE_LEN, 1, 1, 1, 0.05), S_FENCE, 1, 1, 1);
    const sp = this.bankPoint(side, e + 3.2, z - 4.2, this.v);
    put('dr:s', this.upright(sp.x, sp.y - 0.05, sp.z, hashf(i, sd, 55) * 6.28, 1), S_STUMP, 1, 1, 1);
  }

  /** Sparse clutter at the treeline's foot and among the trees past it. */
  private clutter(i: number, side: number, put: Put): void {
    const c = this.c;
    const sd = side < 0 ? 0 : 1;
    const n = Math.round((3 + 2 * hashf(i, sd, 61)) * this.dens);
    const z0 = i * CHUNK_LEN;
    for (let t = 0; t < n; t++) {
      const k = t * 2 + sd;
      const z = z0 + hashf(i, k, 62) * CHUNK_LEN;
      const sig = signature(c, z);
      // The gully's walls and the bowl's cornice own the treeline's foot.
      const foot = hashf(i, k, 63) < 0.6 && !((sig.kind === 'gully' || sig.kind === 'bowl') && sig.k > 0.2);
      const e = foot ? 9.3 + hashf(i, k, 64) * 1.1 : 11.5 + hashf(i, k, 64) * 16;
      const r = hashf(i, k, 65);
      let pick: number;
      if (r < 0.34) pick = S_BUSH;
      else if (r < 0.52) pick = S_STUMP;
      else if (r < 0.74) pick = S_BIO1;
      else if (r < 0.9) pick = S_BIO2;
      else pick = S_FENCE;
      const v = 0.92 + 0.1 * hashf(i, k, 66);
      if (pick === S_FENCE) {
        put('dr:s', this.alongBank(side, e, z, FENCE_LEN, 1, 1, 1, 0.05), S_FENCE, v, v, v);
        continue;
      }
      const p = this.bankPoint(side, e, z, this.v);
      put('dr:s', this.upright(p.x, p.y - 0.08, p.z, hashf(i, k, 67) * 6.28, 0.8 + 0.5 * hashf(i, k, 68)), pick, v, v, v);
    }
  }
}

/** Whether a forest tree at (side, e, z) stands in a clearing. */
export function inClearing(list: Clearing[], side: number, e: number, z: number): boolean {
  for (const k of list) {
    if (k.side !== side || z < k.z0 || z > k.z1) continue;
    if (Math.abs(e - k.e) < k.w) return true;
  }
  return false;
}

/** The share of the treeline wall a section's signature replaces at z (its pieces stand there). */
export function wallThinning(kind: SectionKind, k: number): number {
  if (kind === 'gully') return 0.8 * k;
  if (kind === 'chute') return 0.3 * k;
  if (kind === 'bowl') return 0.35 * k;
  return 0;
}

export { FOREST_LIMIT };
