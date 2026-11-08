// Sleds and their deliberately tiny traits. Every sled is a sidegrade: each bonus is paid for.

export interface SledDef {
  id: number;
  key: string;
  name: string;
  trait: string;
  price: number;
  /** Multipliers applied to the sim. 1 = baseline. */
  grip: number;
  turn: number;
  spin: number;
  flip: number;
  driftCharge: number;
  draft: number;
  magnet: number;
  pop: number;
  /** Multiplier on air drag. Below 1 means a higher cruise speed. */
  drag: number;
  comboWindow: number;
  /** Extra landing tolerance in radians. */
  landTol: number;
  /** Multipliers on what lights the lantern: spirit lights, and skill (stomps, near misses, slingshots...). */
  lightGain: number;
  skillGain: number;
  /** Multiplier on a dash's length. */
  dashLen: number;
  /** Multiplier on the speed a ward keeps (1 keeps 84%). */
  wardKeep: number;
}

const BASE = {
  grip: 1,
  turn: 1,
  spin: 1,
  flip: 1,
  driftCharge: 1,
  draft: 1,
  magnet: 1,
  pop: 1,
  drag: 1,
  comboWindow: 1,
  landTol: 0,
  lightGain: 1,
  skillGain: 1,
  dashLen: 1,
  wardKeep: 1,
};

// Each trait is a way of riding, not a better sled: what it gives one style it takes from another, and the
// lantern is part of every trade (a ghost race cannot sell an edge).
export const SLEDS: readonly SledDef[] = [
  { ...BASE, id: 0, key: 'flyer', name: 'Pine Flyer', trait: 'Balanced classic', price: 0 },
  { ...BASE, id: 1, key: 'whirl', name: 'Whirl Saucer', trait: 'Spins 20% faster and tricks light more, 8% less grip', price: 120, spin: 1.2, grip: 0.92, skillGain: 1.15, lightGain: 0.9 },
  { ...BASE, id: 2, key: 'lodge', name: 'Lodge Toboggan', trait: 'Forgiving landings and softer wards, turns 8% slower', price: 260, landTol: 0.16, turn: 0.92, wardKeep: 1.1, dashLen: 0.85 },
  { ...BASE, id: 3, key: 'comet', name: 'Comet Bob', trait: '3% higher cruise, drifts charge 15% slower', price: 420, drag: 0.94, driftCharge: 0.85, skillGain: 0.9 },
  { ...BASE, id: 4, key: 'wisp', name: 'Wisp', trait: 'Drafts 30% stronger, weaker light pull', price: 640, draft: 1.3, magnet: 0.7 },
  { ...BASE, id: 5, key: 'crumpet', name: 'Tea Tray', trait: 'Dashes last 25% longer, 8% lower pop', price: 900, dashLen: 1.25, pop: 0.92, lightGain: 0.9 },
];

export function sledById(id: number): SledDef {
  return SLEDS[id] ?? SLEDS[0];
}
