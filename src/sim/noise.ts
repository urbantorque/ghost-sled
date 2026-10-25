import { hash32 } from './prng';

// Seeded value noise. Output is in [-1, 1]. Pure functions of (seed, coordinates).

function lattice1(seed: number, i: number): number {
  return (hash32(seed, i) / 4294967296) * 2 - 1;
}

function lattice2(seed: number, i: number, j: number): number {
  return (hash32(seed, i, j) / 4294967296) * 2 - 1;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function noise1(seed: number, x: number): number {
  const i = Math.floor(x);
  const t = fade(x - i);
  const a = lattice1(seed, i);
  const b = lattice1(seed, i + 1);
  return a + (b - a) * t;
}

export function noise2(seed: number, x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const tx = fade(x - i);
  const ty = fade(y - j);
  const a = lattice2(seed, i, j);
  const b = lattice2(seed, i + 1, j);
  const c = lattice2(seed, i, j + 1);
  const d = lattice2(seed, i + 1, j + 1);
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * ty;
}

/** Two-octave 1D fractal noise, roughly in [-1, 1]. */
export function fbm1(seed: number, x: number): number {
  return noise1(seed, x) * 0.7 + noise1(seed ^ 0x5bd1e995, x * 2.13 + 17.1) * 0.3;
}
