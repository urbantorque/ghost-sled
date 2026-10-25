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
};

export const SLEDS: readonly SledDef[] = [
  { ...BASE, id: 0, key: 'flyer', name: 'Pine Flyer', trait: 'Balanced classic', price: 0 },
  { ...BASE, id: 1, key: 'whirl', name: 'Whirl Saucer', trait: 'Spins 20% faster, 8% less grip', price: 120, spin: 1.2, grip: 0.92 },
  { ...BASE, id: 2, key: 'lodge', name: 'Lodge Toboggan', trait: 'Forgiving landings, turns 8% slower', price: 260, landTol: 0.16, turn: 0.92 },
  { ...BASE, id: 3, key: 'comet', name: 'Comet Bob', trait: '3% higher cruise, drifts charge 15% slower', price: 420, drag: 0.94, driftCharge: 0.85 },
  { ...BASE, id: 4, key: 'wisp', name: 'Wisp', trait: 'Drafts 30% stronger, weaker gift pull', price: 640, draft: 1.3, magnet: 0.7 },
  { ...BASE, id: 5, key: 'crumpet', name: 'Tea Tray', trait: 'Combos last 20% longer, 8% lower pop', price: 900, comboWindow: 1.2, pop: 0.92 },
];

export function sledById(id: number): SledDef {
  return SLEDS[id] ?? SLEDS[0];
}
