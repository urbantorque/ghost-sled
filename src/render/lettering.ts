import { BufferGeometry, Color, ExtrudeGeometry, Path, Shape, Vector2 } from 'three';
import { bevelled, chamferLevel, namedChamfer } from './chamfer';
import { part } from './flora';

// The boards' words (the visual lift): built letters, cut from a board's own timber or paint and standing a
// hand proud of it, every edge bevelled so it catches the light (on Low cut square). Round 7's were a 5 by 7
// dot font, runs of boxes in a grid, and every critic read the FINISH board as pixel lettering. These keep the
// dot font's box (5 units wide, 7 tall, 6 to the next letter) so every board lays out as it did, in a sturdy
// sans of straight strokes and true curves. Only the letters the boards use are drawn.

type P = [number, number];

/** A stroke `w` wide along a polyline, as one outline (its left side out, its right side back). */
function stroke(pts: readonly P[], w: number): P[] {
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    left.push([pts[i][0] + (nx * w) / 2, pts[i][1] + (ny * w) / 2]);
    right.push([pts[i][0] - (nx * w) / 2, pts[i][1] - (ny * w) / 2]);
  }
  return [...left, ...right.reverse()];
}

/** Points round an ellipse from angle a0 to a1 (degrees), `n` steps. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** The stroke's width, in the font's units. */
const W = 1.2;

/** Each letter: its outline and its counters (holes), in units, 5 wide and 7 tall from (0, 0). */
const GLYPHS: Record<string, { o: P[]; h?: P[][] }> = {
  F: { o: [[0, 0], [W, 0], [W, 3.05], [4.1, 3.05], [4.1, 4.2], [W, 4.2], [W, 5.8], [4.9, 5.8], [4.9, 7], [0, 7]] },
  I: { o: [[0.8, 0], [4.2, 0], [4.2, 1.1], [3.1, 1.1], [3.1, 5.9], [4.2, 5.9], [4.2, 7], [0.8, 7], [0.8, 5.9], [1.9, 5.9], [1.9, 1.1], [0.8, 1.1]] },
  N: { o: [[0, 0], [W, 0], [W, 4.5], [3.65, 0], [5, 0], [5, 7], [3.8, 7], [3.8, 2.5], [1.35, 7], [0, 7]] },
  H: { o: [[0, 0], [W, 0], [W, 2.95], [3.8, 2.95], [3.8, 0], [5, 0], [5, 7], [3.8, 7], [3.8, 4.1], [W, 4.1], [W, 7], [0, 7]] },
  T: { o: [[1.9, 0], [3.1, 0], [3.1, 5.8], [5, 5.8], [5, 7], [0, 7], [0, 5.8], [1.9, 5.8]] },
  A: { o: [[0, 0], [1.25, 0], [1.62, 1.6], [3.38, 1.6], [3.75, 0], [5, 0], [3.25, 7], [1.75, 7]], h: [[[1.9, 2.75], [3.1, 2.75], [2.5, 5.35]]] },
  R: {
    o: [[0, 0], [W, 0], [W, 2.8], [2.25, 2.8], [3.7, 0], [5.05, 0], [3.5, 3.0], [4.2, 3.2], [4.75, 3.65], [5, 4.35], [5, 5.6], [4.75, 6.4], [4.1, 6.9], [3.4, 7], [0, 7]],
    h: [[[W, 3.95], [3.2, 3.95], [3.65, 4.25], [3.8, 4.9], [3.65, 5.55], [3.2, 5.85], [W, 5.85]]],
  },
  // An S: two bowls on one stroke, the top one from its terminal over the top and down to the spine, the lower
  // one from the spine round to its own terminal.
  S: { o: stroke([...arc(2.5, 4.97, 1.9, 1.47, 22, 270, 12), ...arc(2.5, 2.03, 1.9, 1.47, 90, -158, 12).slice(1)], W) },
};

// A mirrored run (modes.ts) shows the whole picture flipped (world.ts setMirrored), so a board built then is built
// in mirror writing: its letters in the other order, each one turned over within its own box. Flipped with the
// picture, it reads the right way round. Boards made while it is set are made so; the world remakes its pieces
// when it changes (landmarks.ts setCourse).
let mirrored = false;

export function setLetteringMirror(on: boolean): boolean {
  const changed = on !== mirrored;
  mirrored = on;
  return changed;
}

export function letteringMirrored(): boolean {
  return mirrored;
}

const shapes = new Map<string, Shape>();
function shapeOf(ch: string): Shape | null {
  const g = GLYPHS[ch];
  if (!g) return null;
  const key = mirrored ? `~${ch}` : ch;
  let s = shapes.get(key);
  if (!s) {
    // (Turned over within the 5-unit box: x to 5 - x. ExtrudeGeometry winds every outline and hole its own way, so
    // a turned outline still faces out.)
    const at = ([x, y]: P): Vector2 => new Vector2(mirrored ? 5 - x : x, y);
    s = new Shape(g.o.map(at));
    for (const h of g.h ?? []) s.holes.push(new Path(h.map(at)));
    shapes.set(key, s);
  }
  return s;
}

/** Letters standing proud of a board in the x-y plane, facing +z: `text` centred on x, its foot at y, its face
 *  at z, `unit` metres to the font's unit (a letter is 5 units wide and 7 tall), in `col`. */
export function builtLetters(text: string, y: number, z: number, unit: number, col: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const adv = 6 * unit;
  const x0 = -((text.length * adv - unit) / 2);
  // A hand proud of the board, its face bevelled on Medium and High.
  const depth = 0.1;
  const bev = Math.min(0.045, unit * 0.12);
  for (let i = 0; i < text.length; i++) {
    // (In mirror writing the last letter stands first.)
    const s = shapeOf(text[mirrored ? text.length - 1 - i : i]);
    if (!s) continue;
    // (On Low the letters are cut square, a third of the triangles: still built, never dots.)
    const b = chamferLevel() === 'low' ? 0 : namedChamfer(bev) / unit;
    const g = new ExtrudeGeometry(s, { depth: depth / unit, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments: 4 });
    // (Its back stands into the board a little, so no gap shows under the bevel.)
    parts.push(part(bevelled(g, 'z'), col, { pos: [x0 + i * adv, y, z - depth - b * unit + 0.005], scale: [unit, unit, unit] }));
  }
  return parts;
}
