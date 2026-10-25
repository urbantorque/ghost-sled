import { hash32, hashString } from './prng';

export type BiomeId = 'alpine' | 'glacier' | 'volcanic' | 'blossom';
export type MountainId = 'pinecrest' | 'frostfang' | 'ember' | 'sakura' | 'daily';

/** Generation parameters. A course is a pure function of its seed: the seed selects these. */
export interface MountainParams {
  biome: BiomeId;
  /** Base gradient: metres of descent per metre travelled. */
  slope: number;
  /** Amplitude of the centerline wander at full difficulty, metres. */
  wander: number;
  /** Corridor half-width at the start and at full difficulty, metres. */
  halfWidthStart: number;
  halfWidthEnd: number;
  /** Multiplier on obstacle counts. */
  density: number;
  /** Feature probabilities per chunk. */
  kickerChance: number;
  dropChance: number;
  mogulChance: number;
  iceChance: number;
  ventChance: number;
  gateChance: number;
  snowmanChance: number;
  /** Distance over which difficulty ramps from 0 to 1, metres. */
  rampDistance: number;
}

export interface MountainDef {
  id: MountainId;
  name: string;
  tagline: string;
  seed: number;
  unlockGhosts: number;
}

const BIOME_PARAMS: Record<BiomeId, MountainParams> = {
  alpine: {
    biome: 'alpine',
    slope: 0.29,
    wander: 26,
    halfWidthStart: 19,
    halfWidthEnd: 12.5,
    density: 1,
    kickerChance: 0.5,
    dropChance: 0.1,
    mogulChance: 0.1,
    iceChance: 0.04,
    ventChance: 0,
    gateChance: 0,
    snowmanChance: 0.35,
    rampDistance: 4200,
  },
  glacier: {
    biome: 'glacier',
    slope: 0.31,
    wander: 22,
    halfWidthStart: 21,
    halfWidthEnd: 14,
    density: 0.85,
    kickerChance: 0.6,
    dropChance: 0.16,
    mogulChance: 0.06,
    iceChance: 0.4,
    ventChance: 0,
    gateChance: 0,
    snowmanChance: 0,
    rampDistance: 3800,
  },
  volcanic: {
    biome: 'volcanic',
    slope: 0.3,
    wander: 30,
    halfWidthStart: 18,
    halfWidthEnd: 12,
    density: 1.1,
    kickerChance: 0.4,
    dropChance: 0.12,
    mogulChance: 0.12,
    iceChance: 0,
    ventChance: 0.42,
    gateChance: 0,
    snowmanChance: 0,
    rampDistance: 3600,
  },
  blossom: {
    biome: 'blossom',
    slope: 0.28,
    wander: 28,
    halfWidthStart: 19,
    halfWidthEnd: 13,
    density: 0.95,
    kickerChance: 0.45,
    dropChance: 0.09,
    mogulChance: 0.14,
    iceChance: 0.03,
    ventChance: 0,
    gateChance: 0.38,
    snowmanChance: 0,
    rampDistance: 4000,
  },
};

export const MOUNTAINS: readonly MountainDef[] = [
  { id: 'pinecrest', name: 'Pinecrest', tagline: 'Pine forest, soft powder, snowmen', seed: 0x51ed270b, unlockGhosts: 0 },
  { id: 'frostfang', name: 'Frostfang Glacier', tagline: 'Glass ice and big drops', seed: 0x2b7e1516, unlockGhosts: 4 },
  { id: 'ember', name: 'Ember Peak', tagline: 'Basalt, ash snow, steam vents', seed: 0x6a09e667, unlockGhosts: 12 },
  { id: 'sakura', name: 'Sakura Ridge', tagline: 'Blossom slopes and spirit gates', seed: 0x3c6ef372, unlockGhosts: 24 },
];

const BIOME_BY_SEED = new Map<number, BiomeId>([
  [0x51ed270b, 'alpine'],
  [0x2b7e1516, 'glacier'],
  [0x6a09e667, 'volcanic'],
  [0x3c6ef372, 'blossom'],
]);

const BIOMES: readonly BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom'];

export function biomeForSeed(seed: number): BiomeId {
  return BIOME_BY_SEED.get(seed >>> 0) ?? BIOMES[hash32(seed, 0xb10e) % BIOMES.length];
}

/** Parameters for any seed. Named mountains use their biome table; other seeds (daily) get a
 *  biome from the seed plus a little seeded variation. Pure function of the seed. */
export function paramsForSeed(seed: number): MountainParams {
  const named = BIOME_BY_SEED.get(seed >>> 0);
  if (named) return BIOME_PARAMS[named];
  const base = BIOME_PARAMS[biomeForSeed(seed)];
  const v = (k: number) => (hash32(seed, 0xda11, k) / 4294967296) * 2 - 1;
  return {
    ...base,
    slope: base.slope + v(1) * 0.02,
    wander: base.wander * (1 + v(2) * 0.2),
    density: base.density * (1 + v(3) * 0.15),
    kickerChance: Math.min(0.75, base.kickerChance * (1 + v(4) * 0.3)),
  };
}

export function mountainById(id: MountainId): MountainDef | undefined {
  return MOUNTAINS.find((m) => m.id === id);
}

/** UTC date key like 2026-10-24. */
export function dailyKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(key: string): number {
  return hashString('ghost-sled-daily/' + key);
}

export function dailyMountain(key: string): MountainDef {
  return {
    id: 'daily',
    name: 'Daily Mountain',
    tagline: key,
    seed: dailySeed(key),
    unlockGhosts: 0,
  };
}
