import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The simulation (and the bot that feeds it) must be pure and deterministic across JS engines.

function files(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const SIM_DIRS = ['src/sim', 'src/bot'];
const sources = SIM_DIRS.flatMap((d) => files(d)).map((p) => ({
  path: p,
  // Strip comments so prose that mentions banned names does not trip the scan.
  code: readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1'),
}));

describe('simulation purity', () => {
  it('finds the sim sources', () => {
    expect(sources.length).toBeGreaterThan(8);
  });

  it('never uses Math.random', () => {
    for (const s of sources) expect(s.code, s.path).not.toMatch(/Math\s*\.\s*random/);
  });

  it('never uses engine-dependent transcendental Math functions or **', () => {
    const banned = /Math\s*\.\s*(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log2|log10|log1p|pow|cbrt|hypot)\b/;
    for (const s of sources) {
      expect(s.code, s.path).not.toMatch(banned);
      expect(s.code, s.path).not.toMatch(/\*\*/);
    }
  });

  it('has no rendering, DOM, timer or clock dependencies', () => {
    const banned = [
      /from\s+['"]three/,
      /from\s+['"]\.\.\/(render|ui|audio|platform|game|workers)/,
      /\bdocument\./,
      /\bwindow\./,
      /\bperformance\./,
      /\bDate\.now\b/,
      /new Date\(\)/,
      /\bsetTimeout\b/,
      /\brequestAnimationFrame\b/,
      /\blocalStorage\b/,
    ];
    for (const s of sources) for (const b of banned) expect(s.code, `${s.path} ${b}`).not.toMatch(b);
  });

  it('a planted Math.random would be caught', () => {
    const planted = 'const x = Math.random();'.replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(planted).toMatch(/Math\s*\.\s*random/);
  });
});
