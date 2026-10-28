import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source scans (like purity.test.ts) for rules a refactor could quietly break: the guarded platform
// calls, the one ad path, and the pure game modules staying pure.

function code(path: string): string {
  // Comments stripped so prose that names a call does not count as one.
  return readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The body of a class method `name(`...`) {` ... `}` (brace-matched), or '' when absent. */
function method(src: string, name: string): { start: number; end: number; body: string } {
  const re = new RegExp(`\\n\\s*(?:private |public |protected )?(?:async )?${name}\\([^)]*\\)(?::[^{]+)?\\{`);
  const m = re.exec(src);
  if (!m) return { start: -1, end: -1, body: '' };
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { start: open, end: i, body: src.slice(open, i + 1) };
  }
  return { start: open, end: src.length, body: src.slice(open) };
}

function indexes(src: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = src.indexOf(needle); i >= 0; i = src.indexOf(needle, i + 1)) out.push(i);
  return out;
}

const app = code('src/game/app.ts');

describe('app guards', () => {
  it('happytime is reached only from the new-best path in persistRun and the grudge settle', () => {
    const at = indexes(app, 'platform.happytime(');
    expect(at).toHaveLength(2);
    const persist = method(app, 'persistRun');
    const frame = method(app, 'frameRun');
    expect(at.some((i) => i > persist.start && i < persist.end)).toBe(true);
    // The other is the grudgeSettled beat's handler.
    const other = at.find((i) => !(i > persist.start && i < persist.end))!;
    expect(other > frame.start && other < frame.end).toBe(true);
    expect(app.slice(Math.max(0, other - 200), other)).toMatch(/case 'grudgeSettled'/);
  });

  it('a midgame ad is requested only inside runAgain()', () => {
    const at = indexes(app, 'requestMidgame');
    expect(at.length).toBeGreaterThan(0);
    const ra = method(app, 'runAgain');
    expect(ra.start).toBeGreaterThan(0);
    for (const i of at) expect(i > ra.start && i < ra.end, `requestMidgame at ${i}`).toBe(true);
  });

  it('every way into a run goes through ride() or runAgain()', () => {
    const calls = indexes(app, 'this.startRun(');
    expect(calls.length).toBeGreaterThan(0);
    const ride = method(app, 'ride');
    const again = method(app, 'runAgain');
    for (const i of calls) expect((i > ride.start && i < ride.end) || (i > again.start && i < again.end), `startRun at ${i}`).toBe(true);
    // The UI's start handlers are those two.
    expect(app).toMatch(/onRide:\s*\(\)\s*=>\s*this\.ride\(\)/);
    expect(app).toMatch(/onRunAgain:\s*\(\)\s*=>\s*this\.runAgain\(\)/);
  });
});

describe('pure game modules', () => {
  const PURE = ['director', 'race', 'streak', 'finales', 'field', 'timescale', 'intensity', 'stake'];
  for (const name of PURE) {
    it(`${name}.ts imports nothing from the DOM, the UI runtime, render or audio`, () => {
      const src = code(`src/game/${name}.ts`);
      const imports = src.match(/^\s*import[^;]*;/gm) ?? [];
      for (const imp of imports) {
        const from = /from\s+['"]([^'"]+)['"]/.exec(imp)?.[1] ?? '';
        if (/^three/.test(from)) throw new Error(`${name}.ts imports three`);
        if (/\.\.\/(render|audio|ui|platform|workers)\//.test(from) || /^\.\/(app|input|quality|loop|ghosts)$/.test(from)) {
          // Types only (the contract's shapes), never runtime code.
          expect(/^\s*import\s+type\b/.test(imp), `${name}.ts: ${imp.trim()}`).toBe(true);
        }
      }
      for (const b of [/\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\brequestAnimationFrame\b/, /\bsetTimeout\b/, /\bperformance\.now\b/]) expect(src, `${name}.ts ${b}`).not.toMatch(b);
    });
  }
});
