import { CHUNK_LEN, Course, FOREST_LIMIT } from '../sim/course';
import type { Clearing } from './dressing';
import { crestE, standable } from './ground';

// Designed groves: where a mountain's decorative forest is laid out as a place rather than dealt tree by
// tree. Two mountains read as country of their own only when their pieces are grouped:
//
//   Ember Peak   basalt country. Each bank is cut into slots about 28 m long, and each slot is a
//                formation (an organ-pipe outcrop on the crest by the run and another on the shoulder
//                behind, column clusters at their feet), a stand of charred pines in a clump, or clear
//                snow. No two formations follow on one side, so they come at a rhythm of one every 85 m
//                or so a side, with open ground between. A sentinel column stands either side of every
//                leap's approach, where the view opens.
//   Sakura Ridge orchards. Blossom trees stand in rows along the bank's contours (a row keeps its distance
//                from the run's edge, so on a bend it bends with it), 5 m apart in a row and 5.5 m
//                between rows, in blocks with a path across between them; a block is all pink or all
//                pale. Between blocks, a stand of dark pines or an open meadow, so there is a rhythm:
//                orchard, path, orchard, pines, meadow.
//
// Everything is a pure function of the course and the chunk (hashes only), so a chunk builds the same
// every time and on every tier; a lower tier plants fewer trees in the same places. Nothing stands
// inside the treeline (FOREST_LIMIT), on a wall or a ledge's face (standable), or in a clearing.

/** Where to put one grove piece: the near rows (which cast the bank's shadows on Medium and High), the
 *  set and its variant, the bank side, metres past the edge, sim z, its size, its turn and its stretch. */
export type Plant = (near: boolean, set: 'a' | 'b', pick: number, side: number, e: number, z: number, scale: number, yaw: number, tall: number) => void;

/** Whether (side, e, z) stands in a clearing (as dressing.ts inClearing; kept here so the dressing can
 *  read the groves without a cycle). */
function inClearing(list: readonly Clearing[], side: number, e: number, z: number): boolean {
  for (const k of list) if (k.side === side && z >= k.z0 && z <= k.z1 && Math.abs(e - k.e) < k.w) return true;
  return false;
}

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Biomes whose forest is laid out here rather than scattered (props.ts forest()). */
export function hasGrove(biome: string): boolean {
  return biome === 'volcanic' || biome === 'blossom';
}

// ---------------------------------------------------------------- Ember Peak

/** An Ember slot's length down the run, and the share of slots that are formations and stands. */
const SLOT = 28;
const FORMATION = 0.32;
const STAND = 0.66;

export type EmberSlot = 'formation' | 'stand' | 'clear';

/** What slot j on a side holds. A formation never follows a formation: the rock comes at a rhythm. */
export function emberSlot(j: number, side: number): EmberSlot {
  const s = side < 0 ? 0 : 1;
  const r = hashf(j, s, 401);
  if (r < FORMATION) return hashf(j - 1, s, 401) < FORMATION ? 'stand' : 'formation';
  return r < STAND ? 'stand' : 'clear';
}

/** The slot index at sim z. */
export function emberSlotAt(z: number): number {
  return Math.floor(z / SLOT);
}

/** The yaw that turns a piece's own +z to face the run and up the slope, where the rider sees it from. */
function faceRun(side: number, jit: number): number {
  return Math.atan2(-side * 0.65, 0.76) + jit;
}

/** A turn that leaves a round piece (a tree) any way round. */
function anyWay(h: number): number {
  return h * 6.2832;
}

/**
 * Ember Peak's forest for chunk i: formations, stands and clear snow, slot by slot on each bank, and the
 * sentinels at the leaps. `rich` is Medium and High (clusters round the formations' feet, snags among the
 * pines); `dens` thins the stands.
 */
export function emberGrove(c: Course, i: number, dens: number, rich: boolean, clear: readonly Clearing[], plant: Plant): void {
  const z0 = i * CHUNK_LEN;
  const z1 = z0 + CHUNK_LEN;
  const ok = (side: number, e: number, z: number) => z >= z0 && z < z1 && standable(c, z, e) && !(clear.length > 0 && inClearing(clear, side, e, z));
  // The bank's first metres: the treeline's foot, or a wall's crest where the ground is a wall.
  const inner = (z: number) => {
    const sh = c.shapeAt(z);
    return sh.wall > 0.3 ? crestE(sh.limit) + 5 : FOREST_LIMIT;
  };
  const put = (near: boolean, set: 'a' | 'b', pick: number, side: number, e: number, z: number, scale: number, yaw: number, tall: number) => {
    if (ok(side, e, z)) plant(near, set, pick, side, e, z, scale, yaw, tall);
  };
  for (let side = -1; side <= 1; side += 2) {
    const sd = side < 0 ? 0 : 1;
    // Slots reaching into this chunk (a clump can spill a few metres over its slot's ends).
    for (let j = Math.floor((z0 - 12) / SLOT); j <= Math.floor((z1 + 12) / SLOT); j++) {
      const kind = emberSlot(j, side);
      if (kind === 'clear') continue;
      const zc = (j + 0.5) * SLOT + (hashf(j, sd, 402) - 0.5) * 8;
      const e0 = inner(zc);
      const h = (k: number) => hashf(j, sd, 410 + k);
      if (kind === 'formation') {
        // On the crest by the run: an organ-pipe outcrop, facing the rider, with a cluster at each foot.
        const en = e0 + 1.4 + h(1) * 2.6;
        put(true, 'b', 0, side, en, zc, 0.95 + h(2) * 0.35, faceRun(side, (h(3) - 0.5) * 0.4), 0.85 + h(4) * 0.35);
        if (rich) {
          put(true, 'b', 1, side, en + 1.5 + h(5) * 2, zc - 6 - h(6) * 3, 0.9 + h(7) * 0.4, anyWay(h(8)), 0.9 + h(9) * 0.3);
          if (h(10) < 0.6) put(true, 'b', 1, side, en + 0.5 + h(11) * 2, zc + 6 + h(12) * 3, 0.8 + h(13) * 0.3, anyWay(h(14)), 0.8 + h(15) * 0.3);
        }
        // On the shoulder behind: a bigger outcrop, its own cluster beside it.
        const es = 24 + h(16) * 34;
        put(false, 'b', 0, side, es, zc + (h(17) - 0.5) * 10, 1.5 + h(18) * 0.8, faceRun(side, (h(19) - 0.5) * 0.6), 0.9 + h(20) * 0.4);
        if (rich) put(false, 'b', 1, side, es + 3 + h(21) * 3, zc + (h(22) - 0.5) * 14, 1.2 + h(23) * 0.5, anyWay(h(24)), 1);
      } else {
        // A stand of charred pines in a clump, on a golden-angle spiral so it is dense and never a grid,
        // its snags at the edge; and a smaller one further out.
        const clumps: Array<[number, number, number, boolean]> = [
          [e0 + 2.5 + h(30) * 4, zc, Math.round((6 + h(31) * 6) * Math.max(0.45, dens)), true],
          [22 + h(32) * 40, zc + (h(33) - 0.5) * 12, Math.round((4 + h(34) * 5) * Math.max(0.45, dens)), false],
        ];
        clumps.forEach(([ec, zcl, n, near], ci) => {
          const rad = 1.9 + Math.sqrt(n) * 1.25;
          for (let k = 0; k < n; k++) {
            const t = Math.sqrt((k + 0.5) / n);
            const a = k * 2.39996 + h(40 + ci);
            const hk = hashf(j * 31 + k, sd + 2 * ci, 450);
            const e = ec + Math.cos(a) * rad * t * 0.75 + (hk - 0.5) * 0.8;
            const z = zcl + Math.sin(a) * rad * t * 1.3;
            // The outer ring stands dead, as a burn leaves a stand's edge.
            const snag = rich && t > 0.78 && hashf(j * 31 + k, sd, 451) < 0.55;
            put(near && e < e0 + 9, 'a', snag ? 1 : 0, side, e, z, 0.85 + hashf(j * 31 + k, sd, 452) * 0.45, anyWay(hashf(j * 31 + k, sd, 453)), 0.8 + 0.45 * hashf(j * 31 + k, sd, 454));
          }
        });
      }
    }
  }
  // A sentinel either side of each leap's approach, where the view opens past the lip.
  for (const l of c.ledges) {
    if (l.kind !== 'leap') continue;
    const z = l.z - 36;
    if (z < z0 - 2 || z >= z1 + 2) continue;
    for (let side = -1; side <= 1; side += 2) {
      const hz = hashf(Math.round(l.z), side < 0 ? 0 : 1, 470);
      put(true, 'b', rich ? 2 : 0, side, inner(z) + 1.6 + hz * 1.2, z + (hz - 0.5) * 4, rich ? 1 : 1.1, faceRun(side, 0), rich ? 0.95 + hz * 0.2 : 1.1);
    }
  }
}

// ---------------------------------------------------------------- Sakura Ridge

/** A tree's spacing along an orchard row, the spacing of the rows, and how many rows a block has. */
const TREE_GAP = 5;
const ROW_GAP = 5.5;
const ROWS = 6;
/** A block's length down the run (in trees) and the path across between blocks (metres). */
const BLOCK_MIN = 6;
const BLOCK_MORE = 5;
const PATH = 7;

export type OrchardBlock = { kind: 'orchard' | 'pines' | 'meadow'; z0: number; z1: number; pale: boolean };

/** The blocks along one bank, laid from the top of the run down: each its length, then a path. The
 *  sequence repeats a rhythm (orchard, orchard, pines or meadow) with its lengths dealt by hash. Cached
 *  per course and side. */
const orchardCache = new WeakMap<Course, [OrchardBlock[], OrchardBlock[]]>();
export function orchardBlocks(c: Course, side: number): OrchardBlock[] {
  let both = orchardCache.get(c);
  if (!both) {
    both = [layBlocks(c, 0), layBlocks(c, 1)];
    orchardCache.set(c, both);
  }
  return both[side < 0 ? 0 : 1];
}

function layBlocks(c: Course, sd: number): OrchardBlock[] {
  const out: OrchardBlock[] = [];
  const end = c.finishZ + 1000;
  // Every leap lands between orchards: from the air the rows either side frame the landing and lead
  // the eye down the run, so no meadow or pine stand falls there.
  const landings = c.ledges.filter((l) => l.kind === 'leap').map((l) => [l.z + 8, l.z + 260] as const);
  const landing = (a: number, b: number) => landings.some(([l0, l1]) => b > l0 && a < l1);
  // The two banks are out of step by half a block, so the rows never mirror across the run.
  let z = -20 + sd * 17;
  for (let n = 0; z < end; n++) {
    const h = hashf(n, sd, 501);
    const beat = n % 3;
    if (beat < 2 || landing(z, z + 48)) {
      const len = (BLOCK_MIN + Math.floor(h * BLOCK_MORE)) * TREE_GAP;
      out.push({ kind: 'orchard', z0: z, z1: z + len, pale: hashf(n, sd, 502) < 0.32 && !landing(z, z + len) });
      z += len + PATH;
    } else {
      const len = 22 + h * 26;
      out.push({ kind: hashf(n, sd, 503) < 0.55 ? 'pines' : 'meadow', z0: z, z1: z + len, pale: false });
      z += len + PATH * 0.5;
    }
  }
  return out;
}

/**
 * Sakura Ridge's forest for chunk i: orchard rows on both banks in blocks, stands of pines and open
 * meadows between them. Low plants the first three rows of each block and every other pine.
 */
export function orchard(c: Course, i: number, dens: number, rich: boolean, clear: readonly Clearing[], plant: Plant): void {
  const z0 = i * CHUNK_LEN;
  const z1 = z0 + CHUNK_LEN;
  const rows = rich ? (dens >= 0.9 ? ROWS : ROWS - 1) : 3;
  for (let side = -1; side <= 1; side += 2) {
    const sd = side < 0 ? 0 : 1;
    for (const b of orchardBlocks(c, side)) {
      if (b.z1 < z0 - 6 || b.z0 > z1 + 6) continue;
      if (b.kind === 'orchard') {
        // Each row keeps its distance from the run's edge: a contour of the bank.
        for (let r = 0; r < rows; r++) {
          // The rows step a little with the rows above, as terraces do, and the outer rows thin.
          const stagger = r % 2 ? TREE_GAP / 2 : 0;
          for (let z = b.z0 + stagger; z <= b.z1; z += TREE_GAP) {
            if (z < z0 || z >= z1) continue;
            const k = Math.round(z / TREE_GAP) * 8 + r;
            const sh = c.shapeAt(z);
            const inner = sh.wall > 0.3 ? crestE(sh.limit) + 5 : FOREST_LIMIT;
            const e = inner + 1.2 + r * ROW_GAP + (hashf(k, sd, 510) - 0.5) * 0.5;
            // An old tree gone from the row now and then: an orchard, not a wallpaper.
            if (hashf(k, sd, 511) < 0.07 + r * 0.03) continue;
            if (!standable(c, z, e) || (clear.length > 0 && inClearing(clear, side, e, z))) continue;
            const zz = z + (hashf(k, sd, 512) - 0.5) * 0.6;
            plant(r < 2, 'a', b.pale && rich ? 1 : 0, side, e, zz, 0.86 + hashf(k, sd, 513) * 0.18, anyWay(hashf(k, sd, 514)), 0.92 + hashf(k, sd, 515) * 0.16);
          }
        }
      } else if (b.kind === 'pines') {
        // A dark stand: pines and young pines crowded on the bank, the contrast the blossom needs.
        const n = Math.round((b.z1 - b.z0) * 0.55 * Math.max(0.5, dens) * (rich ? 1 : 0.6));
        for (let k = 0; k < n; k++) {
          const kk = Math.round(b.z0) * 64 + k;
          const z = b.z0 + hashf(kk, sd, 520) * (b.z1 - b.z0);
          if (z < z0 || z >= z1) continue;
          const sh = c.shapeAt(z);
          const inner = sh.wall > 0.3 ? crestE(sh.limit) + 5 : FOREST_LIMIT;
          const e = inner + 0.8 + Math.pow(hashf(kk, sd, 521), 1.4) * 26;
          if (!standable(c, z, e) || (clear.length > 0 && inClearing(clear, side, e, z))) continue;
          plant(e < inner + 9, 'b', rich && hashf(kk, sd, 522) < 0.3 ? 1 : 0, side, e, z, 0.95 + hashf(kk, sd, 523) * 0.5, anyWay(hashf(kk, sd, 524)), 0.85 + 0.35 * hashf(kk, sd, 525));
        }
      }
      // A meadow holds nothing: open snow down to the next block.
    }
    // Past the orchards, the shoulder: a few dark pines, so the high slopes keep a little contrast
    // without a scatter of pink over them.
    const n = Math.round(6 * dens);
    for (let t = 0; t < n; t++) {
      const z = z0 + hashf(i, t * 2 + sd, 530) * CHUNK_LEN;
      const e = FOREST_LIMIT + rows * ROW_GAP + 8 + Math.pow(hashf(i, t * 2 + sd, 531), 1.3) * 50;
      if (!standable(c, z, e) || (clear.length > 0 && inClearing(clear, side, e, z))) continue;
      plant(false, 'b', 0, side, e, z, 0.85 + hashf(i, t * 2 + sd, 533) * 0.6, anyWay(hashf(i, t * 2 + sd, 534)), 0.85 + 0.3 * hashf(i, t * 2 + sd, 535));
    }
  }
}
