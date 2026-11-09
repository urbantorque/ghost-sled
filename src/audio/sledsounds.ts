// The garage's sled sounds (round 6): what the runners sound like under you. Cosmetic only: a sound changes the
// timbre of your own runners, landings and carves, never a cue that tells you something (a telegraph, a fuse,
// a perfect-landing ring), and never anything a ghost makes. The shop sells them for gifts; 'runners' is the
// one every rider starts with.

export type SledSoundId = 'runners' | 'bells' | 'timber' | 'glass' | 'lantern';

export interface SledSoundDef {
  id: SledSoundId;
  name: string;
  /** One line for the shop. */
  blurb: string;
  /** Gifts; 0 for the one you start with. */
  price: number;
}

export const SLED_SOUNDS: readonly SledSoundDef[] = [
  { id: 'runners', name: 'Steel Runners', blurb: 'The hiss of steel on packed snow', price: 0 },
  { id: 'bells', name: 'Sleigh Bells', blurb: 'A string of bells that ring with every turn', price: 140 },
  { id: 'timber', name: 'Old Timber', blurb: 'Creaking boards and a wooden knock on every landing', price: 120 },
  { id: 'glass', name: 'Glass Chime', blurb: 'Runners that sing like a rubbed glass', price: 180 },
  { id: 'lantern', name: 'Lantern Song', blurb: 'A warm hum that brightens as the lantern fills', price: 220 },
];

export function isSledSound(v: unknown): v is SledSoundId {
  return typeof v === 'string' && SLED_SOUNDS.some((s) => s.id === v);
}
