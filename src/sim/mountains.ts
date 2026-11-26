import { hash32, hashString } from './prng';

/** The looks the world and the music are dressed for: the four, Lanternfall's own (round 7) and the Old Run's (round
 *  9, notes/r9-oldrun.md section 2). */
export type BiomeId = 'alpine' | 'glacier' | 'volcanic' | 'blossom' | 'lantern' | 'oldrun';
/** What a course is built as. Since Lanternfall's world was built this is the look itself; the name is kept for
 *  the sim's tables. (Round 9: and a new mountain that lays its own ground, under its own id, until its world lane makes
 *  it a look of its own: it borrows one meanwhile, LOOK below. The Old Run's is its own.) */
export type CourseBiome = BiomeId | 'gullhaven';
export type MountainId = 'pinecrest' | 'frostfang' | 'ember' | 'sakura' | 'lanternfall' | 'oldrun' | 'daily';

/** A new mountain's borrowed look, until its world lane gives it its own (round 9; Lanternfall's round 7 path).
 *  Gullhaven (notes/r9-gullhaven.md) borrows Pinecrest's while its lab runs. */
const LOOK: Partial<Record<CourseBiome, BiomeId>> = { gullhaven: 'alpine' };

/** The look a course biome is drawn and scored with: its own (Lanternfall borrowed Frostfang's until its world
 *  was built), or a new mountain's borrowed one. */
export function lookOf(b: CourseBiome): BiomeId {
  return LOOK[b] ?? (b as BiomeId);
}

/** Generation parameters. A course is a pure function of its seed: the seed selects these. */
export interface MountainParams {
  biome: CourseBiome;
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
  /** The finale (Lanternfall). The Twelve opens it (src/game/twelve.ts `mountainOpen`), never a pass count: its
   *  `unlockGhosts` opens nothing (the ladder and the unlock notices skip the finale, and no mission is set on
   *  its biome). `?debug&m=4` opens it in dev whatever the save holds. */
  finale?: boolean;
}

/** The descent's length, metres (the sum of course.ts's STAGE_LENGTHS): difficulty arrives at the finish. */
const DESCENT = 4500;

const BIOME_PARAMS: Record<CourseBiome, MountainParams> = {
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
    rampDistance: DESCENT,
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
    rampDistance: DESCENT,
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
    rampDistance: DESCENT,
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
    rampDistance: DESCENT,
  },
  // Lanternfall: the summit the spirit lights come from (ART.md 15). Open and calm above the cloud, a little
  // glass underfoot, lamp arches over the line (the spirit gates' pillars) and no vents or snowmen.
  lantern: {
    biome: 'lantern',
    slope: 0.3,
    wander: 24,
    halfWidthStart: 20,
    halfWidthEnd: 13,
    density: 0.9,
    kickerChance: 0.5,
    dropChance: 0.1,
    mogulChance: 0.08,
    iceChance: 0.1,
    ventChance: 0,
    gateChance: 0.24,
    snowmanChance: 0,
    rampDistance: DESCENT,
  },
  // The Old Run (round 9): an old ice track down a forest, laid by its own file (oldrun.ts). Its channel is the kit's,
  // so nothing here lays a feature: no colliders, kickers, drops, moguls, ice patches, vents or gates; its grade is
  // the track's steady 0.17 and its ramp its own 3,000 m.
  oldrun: {
    biome: 'oldrun',
    slope: 0.17,
    wander: 0,
    halfWidthStart: 7.5,
    halfWidthEnd: 7.5,
    density: 0,
    kickerChance: 0,
    dropChance: 0,
    mogulChance: 0,
    iceChance: 0,
    ventChance: 0,
    gateChance: 0,
    snowmanChance: 0,
    rampDistance: 3000,
  },
  // Gullhaven (round 9, notes/r9-gullhaven.md): a clifftop run down a cape's seaward flank, laid by its own file
  // (gullhaven.ts). Its kit stands its own few rocks and lays its own lines, so nothing here lays a feature; its slope is
  // the course's real mean grade (a get-up's push and the far terrain read it), its ramp its own 4,800 m.
  gullhaven: {
    biome: 'gullhaven',
    slope: 0.22,
    wander: 0,
    halfWidthStart: 10,
    halfWidthEnd: 10,
    density: 0,
    kickerChance: 0,
    dropChance: 0,
    mogulChance: 0,
    iceChance: 0,
    ventChance: 0,
    gateChance: 0,
    snowmanChance: 0,
    rampDistance: 4800,
  },
};

/** Lanternfall's seed. Chosen among eight: its descent keeps every promise the fairness test makes of a
 *  mountain, and its two streets stay inside the village's triangle budget on Low (notes/r7-moments.md). */
export const LANTERNFALL_SEED = 0x510e527f;

/** Round 9: the Old Run's seed (SHA-256's sixth initial word, beside Lanternfall's fifth): the groundwork's lab course,
 *  kept as the mountain's own (it is no Daily's and no Cup's to 2040, and its track is the one the lab tuned). */
export const OLDRUN_SEED = 0x9b05688c;
/** (The name the groundwork and its lab knew it by.) */
export const OLDRUN_LAB_SEED = OLDRUN_SEED;
/** Round 9: Gullhaven's lab course (SHA-256's seventh initial word, beside the Old Run's sixth), in BIOME_BY_SEED only
 *  until the mountain registers (notes/r9-gullhaven.md). */
export const GULLHAVEN_LAB_SEED = 0x1f83d9ab;

export const MOUNTAINS: readonly MountainDef[] = [
  { id: 'pinecrest', name: 'Pinecrest', tagline: 'Pine forest, soft powder, snowmen', seed: 0x51ed270b, unlockGhosts: 0 },
  { id: 'frostfang', name: 'Frostfang Glacier', tagline: 'Glass ice and big drops', seed: 0x2b7e1516, unlockGhosts: 4 },
  { id: 'ember', name: 'Ember Peak', tagline: 'Basalt, ash snow, steam vents', seed: 0x6a09e667, unlockGhosts: 12 },
  { id: 'sakura', name: 'Sakura Ridge', tagline: 'Blossom slopes and spirit gates', seed: 0x3c6ef372, unlockGhosts: 24 },
  { id: 'lanternfall', name: 'Lanternfall', tagline: 'Where the spirit lights come from', seed: LANTERNFALL_SEED, unlockGhosts: 48, finale: true },
  // Round 9: the new mountains are appended, never inserted (MOUNTAINS is read by index: the Trials, The Twelve's homes,
  // ?debug&m=, the pool generator, the graveyards' naming order).
  { id: 'oldrun', name: 'The Old Run', tagline: 'An old ice track: ride high on the glaze', seed: OLDRUN_SEED, unlockGhosts: 18 },
];


const BIOME_BY_SEED = new Map<number, CourseBiome>([
  [0x51ed270b, 'alpine'],
  [0x2b7e1516, 'glacier'],
  [0x6a09e667, 'volcanic'],
  [0x3c6ef372, 'blossom'],
  [LANTERNFALL_SEED, 'lantern'],
  [OLDRUN_LAB_SEED, 'oldrun'],
  [GULLHAVEN_LAB_SEED, 'gullhaven'],
]);

const BIOMES: readonly BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom'];

/** Whether a seed is one of the named mountains (the rest are dailies). */
export function isNamedSeed(seed: number): boolean {
  return BIOME_BY_SEED.has(seed >>> 0);
}

/** What a seed's course is built as. A Daily or a Cup is one of the four: Lanternfall is the finale's alone. */
export function courseBiomeForSeed(seed: number): CourseBiome {
  return BIOME_BY_SEED.get(seed >>> 0) ?? BIOMES[hash32(seed, 0xb10e) % BIOMES.length];
}

/** The look a seed is drawn and scored with. */
export function biomeForSeed(seed: number): BiomeId {
  return lookOf(courseBiomeForSeed(seed));
}

/** Parameters for any seed. Named mountains use their biome table; other seeds (daily) get a
 *  biome from the seed plus a little seeded variation. Pure function of the seed. */
export function paramsForSeed(seed: number): MountainParams {
  const named = BIOME_BY_SEED.get(seed >>> 0);
  if (named) return BIOME_PARAMS[named];
  const base = BIOME_PARAMS[courseBiomeForSeed(seed)];
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
