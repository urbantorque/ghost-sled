// Sled finishes (round 5's paints, round 9's finishes): a finish is a base and a motif where the chase lens sees a
// sled (the tail, the rails, the slats' ends, a round sled's rim and face), never one flat hex. A finish recolours a
// sled's body and wood at their own value, so the grain and the hull's shading stay; the runners, the trim and the
// rider's scarf and hat stay the player's vermillion (ART.md section 1). The tiers of a sled's track take its finish
// (meshes.ts finishSled paints the sled and its tiers as one).
//
// Round 9's second pass: no navy and no near-ink ground (the coat owns ink navy, and a dark blue sled merged with it
// into one mass at race distance), so today's Midnight and Basalt keep their ids under warm or mid grounds. The
// months' chapter paints left the shelf (each chapter's third piece is an ornament); a save that holds one keeps it
// as a plain finish. Ids never change: a save's paints are its finishes.
//
// Pure data: no DOM, render or audio imports.

import type { Source } from './garage';

/** Where a finish's motif falls, in its accent (cream or ink): a pinstripe round the deck's edge, star specks over
 *  the tail, a light frame round a dark deck, burnt scrolls at the slats' ends, a chequer band across the tail, a
 *  hex lattice, two racing stripes, scrollwork along the rails, ruled lines like a page. */
export type FinishMotif = 'none' | 'pinstripe' | 'stars' | 'twotone' | 'scroll' | 'chequer' | 'hex' | 'stripes' | 'gilt' | 'ruled';

export interface Paint {
  id: string;
  name: string;
  blurb: string;
  /** The ground's colour (the wood's grain and the hull's shading are kept under it); '' the natural wood. */
  hex: string;
  price: number;
  motif: FinishMotif;
  accent: 'cream' | 'ink';
  source: Source;
}

const SHOP: Source = { kind: 'shop' };

/** No mint (ghosts), no rose (a grudge), no gold-white (your best), no vermillion (you), no ink navy (the coat). */
export const PAINTS: readonly Paint[] = [
  { id: 'natural', name: 'Natural', blurb: 'Oiled wood: two browns and the grain', hex: '', price: 0, motif: 'none', accent: 'cream', source: { kind: 'free' } },
  { id: 'pine', name: 'Pine Lacquer', blurb: 'Forest green lacquer, a cream pinstripe round the edge', hex: '#3C6A34', price: 80, motif: 'pinstripe', accent: 'cream', source: SHOP },
  { id: 'glacier', name: 'Glacier Enamel', blurb: 'Steel-blue enamel, an ink pinstripe round the edge', hex: '#6F8FB2', price: 110, motif: 'pinstripe', accent: 'ink', source: SHOP },
  { id: 'midnight', name: 'Midnight Stars', blurb: 'A warm night-black, cream stars across the tail', hex: '#3A2C2A', price: 150, motif: 'stars', accent: 'cream', source: SHOP },
  { id: 'plum', name: 'Plum Two-Tone', blurb: 'Plum slats in a cream frame', hex: '#6E3F82', price: 200, motif: 'twotone', accent: 'cream', source: SHOP },
  { id: 'cocoa', name: 'Burnt Scroll', blurb: 'Walnut stain with scrolls burnt into the slats\' ends', hex: '#8A5534', price: 250, motif: 'scroll', accent: 'ink', source: SHOP },
  { id: 'snow', name: 'Snowfield Frame', blurb: 'Snow-white slats in a dark walnut frame', hex: '#EEF0F6', price: 310, motif: 'twotone', accent: 'ink', source: SHOP },
  { id: 'ash', name: 'Basalt Hex', blurb: 'Dark slate under a fine cream hex lattice', hex: '#4A4650', price: 380, motif: 'hex', accent: 'cream', source: SHOP },
  { id: 'gilt', name: 'Gilt Scroll', blurb: 'Black-green lacquer, cream scrollwork along the rails', hex: '#22362C', price: 650, motif: 'gilt', accent: 'cream', source: SHOP },
  { id: 'almanacdusk', name: 'Almanac Pages', blurb: 'A parchment deck ruled in ink like a page of the Almanac', hex: '#D4B784', price: 0, motif: 'ruled', accent: 'ink', source: { kind: 'almanac', page: 38 } },
];

/** The months' chapter paints of round 8, kept for a save that holds one (never sold, never found again). */
const CHAPTER_PAINT_HEX = ['#5B7F6A', '#8FB4D9', '#3F3A66', '#C79AB0', '#5A3B36', '#A8C6D8', '#6B4A3A', '#B49AC0', '#7A6A3A', '#3A3A52', '#D8DEE9', '#4A3550'];
const CHAPTER_PAINT_NAMES = ['First Light', 'The Long Frost', 'Thaw Lanterns', 'Blossom Run', 'Ash and Ember', 'Midsummer Snow', 'Night Market', 'Paper Cranes', 'Harvest Moon', 'The Haunting', 'First Snow', 'Lantern Night'];
export const KEPT_PAINTS: readonly Paint[] = CHAPTER_PAINT_HEX.map((hex, i) => ({ id: `ch${i + 1}paint`, name: `${CHAPTER_PAINT_NAMES[i]} Paint`, blurb: 'A chapter paint of round 8, kept', hex, price: 0, motif: 'none', accent: 'cream', source: { kind: 'chapter', month: i + 1 } }));

export function paintById(id: string | null | undefined): Paint {
  return PAINTS.find((p) => p.id === id) ?? KEPT_PAINTS.find((p) => p.id === id) ?? PAINTS[0];
}

/** A finish a save may hold: the shelf's own, the Almanac's, or a kept chapter paint. */
export function isPaint(id: unknown): id is string {
  return typeof id === 'string' && (PAINTS.some((p) => p.id === id) || KEPT_PAINTS.some((p) => p.id === id));
}
