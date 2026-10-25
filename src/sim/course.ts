import { clamp, dcos, dsin, lerp, smoothstep } from './dmath';
import { BiomeId, MountainParams, paramsForSeed } from './mountains';
import { fbm1, noise1, noise2 } from './noise';
import { Rng, hash32 } from './prng';

// The course is a pure function of its seed. +z is downhill, +x is the rider's right when facing
// downhill, +y is up. Chunks are generated lazily and cached, but every chunk depends only on
// (seed, index), so generation order never matters.

export const CHUNK_LEN = 64;
/** Half-width of the guaranteed obstacle-free lane around the safe line, metres. */
export const SAFE_LANE = 2.45;
/** Distance up the bank (past the corridor edge) where the treeline crashes you. */
export const FOREST_LIMIT = 10;
export const START_CLEAR_Z = 150;

export type ObstacleKind =
  | 'pine'
  | 'rock'
  | 'log'
  | 'snowman'
  | 'spire'
  | 'serac'
  | 'iceblock'
  | 'basalt'
  | 'lavarock'
  | 'charpine'
  | 'blossom'
  | 'lantern'
  | 'pillar';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Second endpoint for capsule colliders (logs). Equal to x, z for circles. */
  x2: number;
  z2: number;
  r: number;
  /** Collider height above its base. A sled whose bottom is higher clears it. */
  h: number;
  /** Ground height at the obstacle centre. */
  y: number;
  soft: boolean;
  scale: number;
  rot: number;
}

export interface Ramp {
  x: number;
  z: number;
  len: number;
  w: number;
  h: number;
}

export interface Drop {
  z: number;
  depth: number;
  len: number;
  rec: number;
}

export interface Moguls {
  z0: number;
  z1: number;
  amp: number;
  phase: number;
  wave: number;
}

export interface IcePatch {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

export interface Vent {
  id: number;
  x: number;
  z: number;
  r: number;
  power: number;
}

export interface Gate {
  id: number;
  x1: number;
  x2: number;
  z: number;
}

export interface Gift {
  id: number;
  x: number;
  z: number;
  /** Height above the ground at x, z. */
  hover: number;
  value: number;
}

interface Box {
  z0: number;
  z1: number;
  x0: number;
  x1: number;
}

export interface Zones {
  ramps: Ramp[];
  drops: Drop[];
  moguls: Moguls[];
  ice: IcePatch[];
  vents: Vent[];
  keepOut: Box[];
}

export interface Chunk {
  index: number;
  z0: number;
  z1: number;
  zones: Zones;
  obstacles: Obstacle[];
  gates: Gate[];
  gifts: Gift[];
}

export interface Surface {
  grip: number;
  drag: number;
  ice: boolean;
}

const TALL: Record<BiomeId, ObstacleKind[]> = {
  alpine: ['pine', 'pine', 'pine'],
  glacier: ['spire', 'spire', 'serac'],
  volcanic: ['basalt', 'charpine', 'basalt'],
  blossom: ['blossom', 'blossom', 'pine'],
};

const LOW: Record<BiomeId, ObstacleKind[]> = {
  alpine: ['rock', 'rock', 'log'],
  glacier: ['iceblock', 'iceblock', 'rock'],
  volcanic: ['lavarock', 'lavarock', 'log'],
  blossom: ['lantern', 'rock', 'log'],
};

/** Corridor bank profile: a rounded rise past the edge that eases into a gentle forest floor. */
function bank(e: number): number {
  if (e < 5) return 0.16 * e * e;
  if (e < 12) {
    const t = e - 5;
    return 4 + 1.6 * t - 0.1 * t * t;
  }
  return 10.3 + 0.2 * (e - 12);
}

export class Course {
  readonly seed: number;
  readonly params: MountainParams;
  private readonly sC: number;
  private readonly sW: number;
  private readonly sS: number;
  private readonly sY: number;
  private readonly sR: number;
  private zoneCache = new Map<number, Zones>();
  private featureCache = new Map<number, Zones>();
  private chunkCache = new Map<number, Chunk>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.params = paramsForSeed(this.seed);
    this.sC = hash32(this.seed, 1);
    this.sW = hash32(this.seed, 2);
    this.sS = hash32(this.seed, 3);
    this.sY = hash32(this.seed, 4);
    this.sR = hash32(this.seed, 5);
  }

  get biome(): BiomeId {
    return this.params.biome;
  }

  /** 0 at the top, 1 once the ramp distance is reached. */
  difficulty(z: number): number {
    const t = clamp((z - START_CLEAR_Z) / (this.params.rampDistance - START_CLEAR_Z), 0, 1);
    return 1 - (1 - t) * (1 - t);
  }

  centerX(z: number): number {
    const amp = this.params.wander * (0.35 + 0.65 * this.difficulty(z)) * smoothstep(0, 220, z);
    return amp * fbm1(this.sC, z / 300);
  }

  halfWidth(z: number): number {
    const p = this.params;
    return lerp(p.halfWidthStart, p.halfWidthEnd, this.difficulty(z)) + 2.5 * noise1(this.sW, z / 180);
  }

  /** The guaranteed passable line: no collider comes within SAFE_LANE of it. */
  safeX(z: number): number {
    const span = Math.max(0, this.halfWidth(z) - 4.2) * 0.8 * smoothstep(0, 120, z);
    return this.centerX(z) + span * fbm1(this.sS, z / 150);
  }

  baseY(z: number): number {
    return -this.params.slope * z + 10 * noise1(this.sY, z / 260) * smoothstep(0, 300, z);
  }

  /** Distance past the corridor edge (negative inside the corridor). */
  edgeExcess(x: number, z: number): number {
    return Math.abs(x - this.centerX(z)) - this.halfWidth(z);
  }

  ground(x: number, z: number): number {
    let h = this.baseY(z) + 1.1 * noise2(this.sR, x / 36, z / 44);
    const e = this.edgeExcess(x, z);
    if (e > 0) h += bank(e);
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 2; k <= ci; k++) {
      if (k < 0) continue;
      const zn = this.zones(k);
      for (const d of zn.drops) {
        if (z < d.z) continue;
        const a = z - d.z;
        if (a < d.len) h -= d.depth * smoothstep(0, d.len, a);
        else if (a < d.len + d.rec) h -= d.depth * (1 - smoothstep(d.len, d.len + d.rec, a));
      }
      for (const r of zn.ramps) {
        const u = (z - r.z) / r.len;
        if (u < 0 || u > 1 + 1.4 / r.len) continue;
        const dx = Math.abs(x - r.x);
        const side = 1 - smoothstep(r.w * 0.5, r.w * 0.5 + 1.4, dx);
        if (side <= 0) continue;
        let f: number;
        if (u <= 1) f = u * u;
        else {
          const b = 1 - ((u - 1) * r.len) / 1.4;
          f = b * b;
        }
        h += r.h * f * side;
      }
      for (const m of zn.moguls) {
        if (z < m.z0 || z > m.z1) continue;
        const env = smoothstep(m.z0, m.z0 + 8, z) * (1 - smoothstep(m.z1 - 8, m.z1, z));
        const s1 = dsin(x / m.wave + m.phase);
        const s2 = dsin(z / m.wave + m.phase * 1.7);
        h += m.amp * env * s1 * s1 * s2 * s2;
      }
    }
    return h;
  }

  /** Writes the ground gradient (dh/dx, dh/dz) into out. */
  gradient(x: number, z: number, out: { x: number; z: number }): void {
    const e = 0.2;
    out.x = (this.ground(x + e, z) - this.ground(x - e, z)) / (2 * e);
    out.z = (this.ground(x, z + e) - this.ground(x, z - e)) / (2 * e);
  }

  surface(x: number, z: number): Surface {
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci; k++) {
      if (k < 0) continue;
      for (const p of this.zones(k).ice) {
        const dx = (x - p.x) / p.rx;
        const dz = (z - p.z) / p.rz;
        if (dx * dx + dz * dz < 1) return { grip: 0.45, drag: 0.82, ice: true };
      }
    }
    return { grip: 1, drag: 1, ice: false };
  }

  zones(i: number): Zones {
    let zn = this.zoneCache.get(i);
    if (!zn) {
      zn = this.buildZones(i);
      this.zoneCache.set(i, zn);
    }
    return zn;
  }

  chunk(i: number): Chunk {
    let c = this.chunkCache.get(i);
    if (!c) {
      c = this.buildChunk(i);
      this.chunkCache.set(i, c);
    }
    return c;
  }

  /** Pure per-index decision used to keep drops apart without recursion. */
  private wantsDrop(i: number): boolean {
    if (i < 5) return false;
    return hash32(this.seed, i, 0xd409) / 4294967296 < this.params.dropChance * (0.6 + 0.6 * this.difficulty(i * CHUNK_LEN));
  }

  /** Terrain features (drops, kickers, moguls, ice) and their keep-out boxes. Pure per index. */
  private features(i: number): Zones {
    let f = this.featureCache.get(i);
    if (!f) {
      f = this.buildFeatures(i);
      this.featureCache.set(i, f);
    }
    return f;
  }

  private buildFeatures(i: number): Zones {
    const p = this.params;
    const rng = new Rng(hash32(this.seed, i, 0x20e5));
    const z0 = i * CHUNK_LEN;
    const diff = this.difficulty(z0);
    const zn: Zones = { ramps: [], drops: [], moguls: [], ice: [], vents: [], keepOut: [] };
    if (z0 < START_CLEAR_Z - CHUNK_LEN) return zn;

    const drop = this.wantsDrop(i) && !this.wantsDrop(i - 1) && !this.wantsDrop(i - 2);
    if (drop) {
      const dz = z0 + rng.range(16, 40);
      const d: Drop = { z: dz, depth: lerp(3.5, 7.5, diff) * rng.range(0.85, 1.15), len: rng.range(7, 10), rec: rng.range(90, 120) };
      zn.drops.push(d);
      zn.keepOut.push({ z0: dz - 22, z1: dz + d.len + 52, x0: -1e9, x1: 1e9 });
    }

    if (!drop && rng.chance(p.kickerChance * (0.75 + 0.5 * diff))) {
      const count = diff > 0.55 && rng.chance(0.35) ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const rz = z0 + rng.range(8, 36) + k * 22;
        const big = rng.chance(0.2 + 0.35 * diff);
        const rel = big ? rng.range(0.36, 0.44) : rng.range(0.22, 0.32);
        const len = big ? rng.range(8.5, 10) : rng.range(8, 11);
        const h = (rel * len) / 2;
        const w = rng.range(4.2, 6.5);
        const hw = this.halfWidth(rz);
        const sx = this.safeX(rz);
        const cx = this.centerX(rz);
        // Off the safe line: centre at least SAFE_LANE + half width + 1 away, inside the corridor.
        const minOff = SAFE_LANE + w * 0.5 + 1.2;
        let side = rng.chance(0.5) ? 1 : -1;
        let room = side > 0 ? cx + hw - 1 - (sx + minOff) : sx - minOff - (cx - hw + 1);
        if (room < 0) {
          side = -side;
          room = side > 0 ? cx + hw - 1 - (sx + minOff) : sx - minOff - (cx - hw + 1);
        }
        if (room < 0) continue;
        const rx = sx + side * (minOff + rng.next() * room);
        // The safe line moves along the ramp; keep the whole footprint clear of the lane.
        let clear = true;
        for (let zz = rz - 1.5; zz <= rz + len + 2; zz += 1) {
          if (Math.abs(rx - this.safeX(zz)) < w * 0.5 + 1.4 + SAFE_LANE * 0.5 + 0.4) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        zn.ramps.push({ x: rx, z: rz, len, w, h });
        zn.keepOut.push({ z0: rz - 14, z1: rz + len + 2, x0: rx - w * 0.5 - 1.6, x1: rx + w * 0.5 + 1.6 });
        zn.keepOut.push({ z0: rz + len, z1: rz + len + (big ? 62 : 46), x0: rx - 6.5, x1: rx + 6.5 });
      }
    }

    if (!drop && rng.chance(p.mogulChance * (0.6 + 0.8 * diff))) {
      const mz = z0 + rng.range(0, 24);
      zn.moguls.push({ z0: mz, z1: mz + rng.range(28, 48), amp: lerp(0.32, 0.55, diff), phase: rng.range(0, 6.28), wave: rng.range(2.6, 3.4) });
    }

    if (rng.chance(p.iceChance)) {
      const iz = z0 + rng.range(10, 50);
      const off = rng.signed() * this.halfWidth(iz) * 0.5;
      zn.ice.push({ x: this.centerX(iz) + off, z: iz, rx: rng.range(5, 10), rz: rng.range(14, 30) });
    }

    return zn;
  }

  /** Zones = terrain features plus vents. Vents are placed in a second pass that checks the
   *  feature keep-out boxes of neighbouring chunks, so nobody lands on a geyser by surprise. */
  private buildZones(i: number): Zones {
    const f = this.features(i);
    const zn: Zones = { ...f, vents: [], keepOut: f.keepOut.slice() };
    const p = this.params;
    const z0 = i * CHUNK_LEN;
    if (z0 < START_CLEAR_Z - CHUNK_LEN || p.ventChance <= 0) return zn;
    const rng = new Rng(hash32(this.seed, i, 0x7e47));
    const diff = this.difficulty(z0);
    const blocked = (x: number, z: number): boolean => {
      for (let k = i - 2; k <= i + 1; k++) {
        if (k < 0) continue;
        for (const b of this.features(k).keepOut) if (z + 4 > b.z0 && z - 4 < b.z1 && x + 6 > b.x0 && x - 6 < b.x1) return true;
      }
      for (const b of zn.keepOut) if (z + 4 > b.z0 && z - 4 < b.z1 && x + 6 > b.x0 && x - 6 < b.x1) return true;
      return false;
    };
    if (rng.chance(p.ventChance)) {
      const n = rng.int(1, 2 + Math.floor(diff * 2));
      for (let k = 0; k < n; k++) {
        const vz = z0 + rng.range(6, 56);
        const hw = this.halfWidth(vz);
        const sx = this.safeX(vz);
        const off = (rng.chance(0.5) ? 1 : -1) * rng.range(SAFE_LANE + 1.6, Math.max(SAFE_LANE + 1.7, hw - 2));
        const vx = clamp(sx + off, this.centerX(vz) - hw + 2, this.centerX(vz) + hw - 2);
        if (Math.abs(vx - sx) < SAFE_LANE + 1.6 || blocked(vx, vz)) continue;
        zn.vents.push({ id: i * 16 + k, x: vx, z: vz, r: 1.5, power: rng.range(8.5, 10.5) });
        zn.keepOut.push({ z0: vz - 6, z1: vz + 44, x0: vx - 6, x1: vx + 6 });
      }
    }
    return zn;
  }

  private inKeepOut(x: number, z: number, r: number, i: number): boolean {
    // Big kicker landing zones reach two chunks forward, so look two chunks back.
    for (let k = i - 2; k <= i + 1; k++) {
      if (k < 0) continue;
      for (const b of this.zones(k).keepOut) {
        if (z + r > b.z0 && z - r < b.z1 && x + r > b.x0 && x - r < b.x1) return true;
      }
    }
    return false;
  }

  private buildChunk(i: number): Chunk {
    const p = this.params;
    const zones = this.zones(i);
    const z0 = i * CHUNK_LEN;
    const z1 = z0 + CHUNK_LEN;
    const chunk: Chunk = { index: i, z0, z1, zones, obstacles: [], gates: [], gifts: [] };
    const rng = new Rng(hash32(this.seed, i, 0x0b57));
    const diff = this.difficulty(z0);
    const beyond = clamp((z0 - p.rampDistance) / 4000, 0, 0.5);
    const obs = chunk.obstacles;
    let nextId = i * 256;

    const clearOf = (x: number, z: number, r: number): boolean => {
      if (z - r < START_CLEAR_Z) return false;
      if (Math.abs(x - this.safeX(z)) < r + SAFE_LANE) return false;
      if (this.edgeExcess(x, z) > 1.5 - r) return false;
      if (this.inKeepOut(x, z, r, i)) return false;
      for (const o of obs) {
        const dx = o.x - x;
        const dz = o.z - z;
        const min = o.r + r + 1.0;
        if (dx * dx + dz * dz < min * min) return false;
        if (o.x2 !== o.x || o.z2 !== o.z) {
          const ex = o.x2 - x;
          const ez = o.z2 - z;
          if (ex * ex + ez * ez < min * min) return false;
        }
      }
      return true;
    };

    const add = (kind: ObstacleKind, x: number, z: number, r: number, h: number, soft = false, x2 = x, z2 = z): Obstacle => {
      const o: Obstacle = {
        id: nextId++,
        kind,
        x,
        z,
        x2,
        z2,
        r,
        h,
        y: this.ground((x + x2) / 2, (z + z2) / 2),
        soft,
        scale: rng.range(0.85, 1.2),
        rot: rng.range(0, 6.283),
      };
      obs.push(o);
      return o;
    };

    const tallKinds = TALL[p.biome];
    const lowKinds = LOW[p.biome];
    const template = rng.weighted([1, 1.25, 0.9, 1.4]); // open, forest, rocks, mixed
    const templateMul = [0.45, 1.3, 1.15, 1.0][template];
    const target = Math.round((3 + 13 * diff) * p.density * templateMul * (1 + beyond));

    const placeOne = (kind: ObstacleKind, x: number, z: number): boolean => {
      switch (kind) {
        case 'pine':
        case 'blossom':
        case 'charpine': {
          const r = rng.range(0.7, 0.95);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, kind === 'blossom' ? 5.5 : 6.5);
          return true;
        }
        case 'spire':
        case 'basalt': {
          const r = rng.range(0.7, 1.1);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, rng.range(3.5, 6.5));
          return true;
        }
        case 'serac': {
          const r = rng.range(1.5, 2.2);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, rng.range(3, 4.5));
          return true;
        }
        case 'rock':
        case 'iceblock':
        case 'lavarock': {
          const r = rng.range(0.75, 1.3);
          if (!clearOf(x, z, r)) return false;
          add(kind, x, z, r, rng.range(0.8, 1.25));
          return true;
        }
        case 'lantern': {
          if (!clearOf(x, z, 0.6)) return false;
          add(kind, x, z, 0.6, 1.4);
          return true;
        }
        case 'log': {
          // Logs lie mostly across the slope.
          const hx = rng.range(3, 5.2) * 0.5;
          const ang = rng.range(-0.5, 0.5);
          const ca = dcos(ang);
          const sa = dsin(ang);
          const ax = x - ca * hx;
          const az = z - sa * hx;
          const bx = x + ca * hx;
          const bz = z + sa * hx;
          const rr = 0.42;
          for (let s = 0; s <= 4; s++) {
            const t = s / 4;
            if (!clearOf(ax + (bx - ax) * t, az + (bz - az) * t, rr)) return false;
          }
          add('log', ax, az, rr, 0.75, false, bx, bz);
          return true;
        }
        default:
          return false;
      }
    };

    if (template === 1) {
      // Forest slalom: staggered rows of tall obstacles leaving the lane open.
      let z = z0 + rng.range(2, 8);
      let flip = rng.chance(0.5) ? 1 : -1;
      while (z < z1 - 2) {
        const sx = this.safeX(z);
        const cx = this.centerX(z);
        const hw = this.halfWidth(z);
        const n = rng.int(1, 2 + Math.floor(diff * 2));
        for (let k = 0; k < n; k++) {
          const off = SAFE_LANE + 1.4 + rng.range(0, 5) + k * rng.range(3.5, 6);
          const x = sx + flip * off;
          if (Math.abs(x - cx) > hw + 0.5) continue;
          placeOne(rng.pick(tallKinds), x, z + rng.range(-1.5, 1.5));
        }
        flip = -flip;
        z += rng.range(9, 15) - diff * 3;
      }
    }

    let tries = target * 6;
    let placed = obs.length;
    while (placed < target && tries-- > 0) {
      const z = z0 + rng.next() * CHUNK_LEN;
      const x = this.centerX(z) + rng.signed() * (this.halfWidth(z) + 0.5);
      let kind: ObstacleKind;
      const roll = rng.next();
      if (template === 2) kind = roll < 0.75 ? rng.pick(lowKinds) : rng.pick(tallKinds);
      else if (template === 1) kind = roll < 0.75 ? rng.pick(tallKinds) : rng.pick(lowKinds);
      else kind = roll < 0.55 ? rng.pick(tallKinds) : rng.pick(lowKinds);
      if (placeOne(kind, x, z)) placed++;
    }

    // Soft snowmen: smash for points, slow you a little.
    if (rng.chance(p.snowmanChance)) {
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const z = z0 + rng.next() * CHUNK_LEN;
        const x = this.centerX(z) + rng.signed() * this.halfWidth(z) * 0.8;
        if (clearOf(x, z, 0.65)) add('snowman', x, z, 0.65, 1.7, true);
      }
    }

    // Spirit gates: two pillars straddling the safe line.
    if (p.gateChance > 0 && rng.chance(p.gateChance)) {
      const gz = z0 + rng.range(10, 54);
      const sx = this.safeX(gz);
      const half = SAFE_LANE + 0.45 + 0.75;
      const gx = sx + rng.range(-0.6, 0.6);
      const x1 = gx - half;
      const x2 = gx + half;
      if (clearOf(x1, gz, 0.45) && clearOf(x2, gz, 0.45)) {
        add('pillar', x1, gz, 0.45, 5);
        add('pillar', x2, gz, 0.45, 5);
        chunk.gates.push({ id: i * 8, x1, x2, z: gz });
      }
    }

    this.placeGifts(chunk, rng, diff);
    return chunk;
  }

  private placeGifts(chunk: Chunk, rng: Rng, diff: number): void {
    const gifts = chunk.gifts;
    let id = chunk.index * 64;
    const blocked = (x: number, z: number): boolean => {
      for (const o of chunk.obstacles) {
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < (o.r + 1.1) * (o.r + 1.1)) return true;
      }
      return this.edgeExcess(x, z) > 0.5;
    };
    if (chunk.z0 < 40) return;

    // Lines: one follows the safe line, another (later) tempts you off it.
    const lines = rng.int(1, 2);
    for (let l = 0; l < lines; l++) {
      const startZ = chunk.z0 + rng.range(4, 30);
      const n = rng.int(5, 8);
      const risky = l > 0 || rng.chance(0.35 * diff);
      const off = risky ? rng.signed() * this.halfWidth(startZ) * 0.6 : rng.range(-0.8, 0.8);
      const sway = rng.range(-0.08, 0.08);
      for (let k = 0; k < n; k++) {
        const z = startZ + k * 3.4;
        const x = (risky ? this.centerX(z) : this.safeX(z)) + off + sway * k * 3.4;
        if (blocked(x, z)) continue;
        gifts.push({ id: id++, x, z, hover: 0.8, value: 1 });
      }
    }

    // Arcs over kickers at a typical takeoff speed.
    for (const r of chunk.zones.ramps) {
      const v = lerp(20, 27, diff);
      const lipZ = r.z + r.len;
      const lipY = this.ground(r.x, lipZ - 0.05);
      const faceSlope = (2 * r.h) / r.len + (this.baseY(lipZ) - this.baseY(lipZ - 1));
      const vy = v * faceSlope;
      const count = 5;
      for (let k = 1; k <= count; k++) {
        const t = k * 0.22;
        const z = lipZ + v * t;
        const y = lipY + vy * t - 4.9 * t * t;
        const hover = y - this.ground(r.x, z);
        if (hover < 0.8) break;
        const golden = k === 3 && rng.chance(0.3 + diff * 0.3);
        gifts.push({ id: id++, x: r.x, z, hover: Math.min(hover, 9), value: golden ? 5 : 1 });
      }
    }

    // A rare golden gift squeezed between obstacles.
    if (chunk.obstacles.length >= 2 && rng.chance(0.12 + 0.12 * diff)) {
      const a = rng.pick(chunk.obstacles);
      let best: Obstacle | null = null;
      let bestD = 1e9;
      for (const o of chunk.obstacles) {
        if (o === a) continue;
        const ddx = o.x - a.x;
        const ddz = o.z - a.z;
        const d = ddx * ddx + ddz * ddz;
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      if (best && bestD < 64) {
        const x = (a.x + best.x) / 2;
        const z = (a.z + best.z) / 2;
        if (!blocked(x, z)) gifts.push({ id: id++, x, z, hover: 0.9, value: 5 });
      }
    }
  }
}

/** Shared course cache so worker replays and the live run reuse generated chunks. */
const courses = new Map<number, Course>();
export function courseFor(seed: number): Course {
  const key = seed >>> 0;
  let c = courses.get(key);
  if (!c) {
    c = new Course(key);
    courses.set(key, c);
    if (courses.size > 8) {
      const first = courses.keys().next().value;
      if (first !== undefined && first !== key) courses.delete(first);
    }
  }
  return c;
}
