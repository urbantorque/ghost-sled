// The garage, finished (round 6): scarves, hats, trails and sled sounds beside the round 5 paints. Every one
// is bought with gifts and every one is a look or a sound, never an edge: nothing here reaches the sim, a
// sled's handling or the lantern, and nothing a ghost wears or makes. The rider's vermillion stays the
// player's signal (ART.md sections 1 and 5): a scarf varies its pattern, length, knit and tassels with
// vermillion dominant and at most a cream or ink accent; a hat varies its silhouette, in vermillion, and
// carries its detail at the back where the chase lens sees it; a trail changes what the sled leaves in
// warm roles only (marigold sparks, white-gold glints, a pale honey spray), never mint, rose, coral or
// vermillion (those are the ghosts', the grudge's and your drift's). The sled sounds' list is the audio
// lane's (sledsounds.ts); the garage sells them and saves the choice.
//
// Pure data: no DOM, render or audio engine imports.

import { SLED_SOUNDS, type SledSoundId } from '../audio/sledsounds';

export type ShelfId = 'scarf' | 'hat' | 'trail' | 'sound';

/** The scarf's accent: none, a cream knit or an ink knit (ART.md section 5: at most one). */
export type ScarfAccent = 'none' | 'cream' | 'ink';
/** Where the accent (or a deeper vermillion) falls along each tail. */
export type ScarfPattern = 'tipStripes' | 'bars' | 'tip' | 'bands' | 'rib' | 'plain';

export interface ScarfDef {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** Tail length against the classic (1). */
  length: number;
  /** Ribbon width against the classic (1). */
  width: number;
  pattern: ScarfPattern;
  accent: ScarfAccent;
  /** A fringe of strands at each tip. */
  tassels: boolean;
}

/** A hat's silhouette (meshes.ts riderHeadGeometry builds each). */
export type HatId = 'beanie' | 'trapper' | 'longcap' | 'bobbles' | 'chullo' | 'watch' | 'twinpom';

export interface HatDef {
  id: HatId;
  name: string;
  blurb: string;
  price: number;
}

export type TrailId = 'powder' | 'honey' | 'sparks' | 'glints' | 'stardust' | 'comet';

export interface TrailDef {
  id: TrailId;
  name: string;
  blurb: string;
  price: number;
  /** The spray's tint (mixed into the snow's white), '' for plain snow. */
  tint: string;
  /** How much of the tint the spray takes, 0 to 1. */
  tintK: number;
  /** Motes the runners throw, '' for none. */
  mote: string;
  /** How many motes a second at cruise. */
  motes: number;
  /** How the motes move: flicked up off the runners, twinkling low on the snow, or streaming straight back. */
  moteStyle: 'flick' | 'twinkle' | 'stream';
}

export interface SoundDef {
  id: SledSoundId;
  name: string;
  blurb: string;
  price: number;
}

/** The classic knit comes first: every rider has it, and it is what the rider wore before round 6. */
export const SCARVES: readonly ScarfDef[] = [
  { id: 'classic', name: 'Classic Knit', blurb: 'Two deeper stripes near the tips', price: 0, length: 1, width: 1, pattern: 'tipStripes', accent: 'none', tassels: false },
  { id: 'creambar', name: 'Cream Bar', blurb: 'Two cream bars across each tail', price: 60, length: 1, width: 1, pattern: 'bars', accent: 'cream', tassels: false },
  { id: 'chunky', name: 'Chunky Rib', blurb: 'Short, broad and ribbed all the way', price: 90, length: 0.86, width: 1.32, pattern: 'rib', accent: 'none', tassels: false },
  { id: 'tassel', name: 'Fringe Knit', blurb: 'A fringe of strands at each tip', price: 110, length: 1.05, width: 1, pattern: 'tipStripes', accent: 'none', tassels: true },
  { id: 'inkband', name: 'Ink Bands', blurb: 'Narrow ink bands down its length', price: 140, length: 1.1, width: 0.95, pattern: 'bands', accent: 'ink', tassels: false },
  { id: 'snowtip', name: 'Snow Tip', blurb: 'Dipped in cream at both ends, with a fringe', price: 170, length: 1.15, width: 1, pattern: 'tip', accent: 'cream', tassels: true },
  { id: 'streamer', name: 'Long Streamer', blurb: 'Half as long again, slim and plain', price: 210, length: 1.5, width: 0.78, pattern: 'plain', accent: 'none', tassels: false },
];

export const HATS: readonly HatDef[] = [
  { id: 'beanie', name: 'Pom Beanie', blurb: 'The cuffed beanie and its pom-pom', price: 0 },
  { id: 'watch', name: 'Watch Cap', blurb: 'Short, snug, with a thick rolled cuff', price: 60 },
  { id: 'twinpom', name: 'Twin Pom', blurb: 'A pom-pom over each ear', price: 90 },
  { id: 'trapper', name: 'Trapper', blurb: 'A cream fur brim and long ear flaps', price: 120 },
  { id: 'bobbles', name: 'Bobble Crown', blurb: 'A ring of bobbles round the crown', price: 150 },
  { id: 'chullo', name: 'Braided Chullo', blurb: 'Pointed flaps with braided ties', price: 180 },
  { id: 'longcap', name: 'Long Knit Cap', blurb: 'A stocking cap that streams out behind', price: 220 },
];

export const TRAILS: readonly TrailDef[] = [
  { id: 'powder', name: 'Fresh Powder', blurb: 'Snow, and only snow', price: 0, tint: '', tintK: 0, mote: '', motes: 0, moteStyle: 'flick' },
  { id: 'honey', name: 'Honey Spray', blurb: 'Spray warmed to a pale honey', price: 70, tint: '#FFEFC2', tintK: 0.6, mote: '', motes: 0, moteStyle: 'flick' },
  { id: 'sparks', name: 'Lantern Sparks', blurb: 'Marigold sparks flicked off the runners', price: 120, tint: '#FFF1D6', tintK: 0.25, mote: '#FFD34D', motes: 40, moteStyle: 'flick' },
  { id: 'glints', name: 'Gold Glints', blurb: 'Gold glints left twinkling in the groove', price: 150, tint: '', tintK: 0, mote: '#F5C542', motes: 34, moteStyle: 'twinkle' },
  { id: 'stardust', name: 'Stardust', blurb: 'A low drift of cream and gold specks', price: 190, tint: '#FFF6E6', tintK: 0.3, mote: '#FFE9B0', motes: 48, moteStyle: 'twinkle' },
  { id: 'comet', name: 'Comet Tail', blurb: 'Two marigold streams back off the runners', price: 240, tint: '#FFE6B3', tintK: 0.35, mote: '#FFD34D', motes: 60, moteStyle: 'stream' },
];

export const SOUNDS: readonly SoundDef[] = SLED_SOUNDS.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, price: s.price }));

export function scarfById(id: string | null | undefined): ScarfDef {
  return SCARVES.find((s) => s.id === id) ?? SCARVES[0];
}

export function hatById(id: string | null | undefined): HatDef {
  return HATS.find((h) => h.id === id) ?? HATS[0];
}

export function trailById(id: string | null | undefined): TrailDef {
  return TRAILS.find((t) => t.id === id) ?? TRAILS[0];
}

export function soundById(id: string | null | undefined): SoundDef {
  return SOUNDS.find((s) => s.id === id) ?? SOUNDS.find((s) => s.price === 0) ?? SOUNDS[0];
}

/** Every shelf's items by id, for the save's sanitising and the shop. */
export const SHELVES: Readonly<Record<ShelfId, readonly { id: string; name: string; blurb: string; price: number }[]>> = {
  scarf: SCARVES,
  hat: HATS,
  trail: TRAILS,
  sound: SOUNDS,
};

/** The one every rider starts with on a shelf (its price is 0). */
export function freeItem(shelf: ShelfId): string {
  return (SHELVES[shelf].find((i) => i.price === 0) ?? SHELVES[shelf][0]).id;
}

export function isItem(shelf: ShelfId, id: unknown): id is string {
  return typeof id === 'string' && SHELVES[shelf].some((i) => i.id === id);
}
