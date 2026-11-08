// Sled paints (round 5): the garage's first shelf. A paint recolours a sled's body and wood, never its
// runners, its trim or the rider's scarf and beanie, which stay the player's vermillion (ART.md section 1).
// Paints are bought with gifts and change nothing in a race: they are a look, not an edge.
//
// Pure data: no DOM, render or audio imports.

export interface Paint {
  id: string;
  name: string;
  /** The body's colour (the wood's grain and the hull's shading are kept under it). */
  hex: string;
  price: number;
}

/** No mint (ghosts), no rose (a grudge), no gold-white (your best), no vermillion (you): those are taken. */
export const PAINTS: readonly Paint[] = [
  { id: 'natural', name: 'Natural', hex: '', price: 0 },
  { id: 'pine', name: 'Pine Lacquer', hex: '#3E7A5C', price: 60 },
  { id: 'glacier', name: 'Glacier', hex: '#9FC4E8', price: 80 },
  { id: 'midnight', name: 'Midnight', hex: '#2A3570', price: 100 },
  { id: 'plum', name: 'Plum', hex: '#7A4A8C', price: 120 },
  { id: 'cocoa', name: 'Cocoa', hex: '#6A4636', price: 140 },
  { id: 'snow', name: 'Snowfield', hex: '#E9ECF5', price: 180 },
  { id: 'ash', name: 'Basalt', hex: '#3A3640', price: 220 },
];

export function paintById(id: string | null | undefined): Paint {
  return PAINTS.find((p) => p.id === id) ?? PAINTS[0];
}
