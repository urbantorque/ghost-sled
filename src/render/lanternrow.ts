import { BufferGeometry, Color, CylinderGeometry, Mesh, Object3D, type ShaderMaterial } from 'three';
import { titleShot } from '../game/keyart';
import { CHUNK_LEN, type Course } from '../sim/course';
import { MOUNTAINS } from '../sim/mountains';
import { SNOW, merge, part } from './flora';
import { box, seg } from './landmarkKit';
import { LAMP_BRONZE, LAMP_SLATE, LAMP_TIMBER, LAMP_TIMBER_LIT, PAPER_DARK } from './lanternkit';
import { pushLocalLight } from './lights';
import { makeToonMaterial } from './materials';
import type { Palette } from './palette';
import type { Detail } from './postfx/tiers';

// Round 8, the light lane: the Lantern Row's world part (DECISIONS 371, game/lanterns.ts). Each named mountain's
// finish town hangs the lanterns the player has lit there, in row order from the first: a wire across the square
// between two timber masts past the barriers, the lit lanterns hung from it in a gentle sag, marigold (the lantern's
// and the gifts' colour role, ART.md 1). The same row hangs over the stretch the mountain's title shot rides, so the
// title shows what a player has lit. Only lit lanterns hang: a fresh save's town has none and the frame is unchanged.
//
// It is a look and nothing else: nothing here is a collider, nothing stands inside the limit the sim turns a sled
// back at (the masts stand past it, the wire is over the highest air a square allows) and nothing reaches the sim.
// Medium and High light the snow under the row with one local light; Low and the phone's Low draw the lanterns as
// glowing paper with no light of their own. Two draws a row (the paper and its frame), made only when a row hangs.

/** How many lanterns a row holds (game/lanterns.ts ROW_LENGTH). */
const ROW = 8;
/** Past the line, the row hangs over the square's middle, between the arch and where a sled rolls to a stop, so
 *  the finish lens, which swings round to look back up the run at the rider, sees it over the rider. */
const FINISH_AHEAD = 58;
/** Over the title shot's stretch: this far past where its reel starts. */
const TITLE_AHEAD = 170;
/** The wire's height over the snow at its masts, and its sag at the middle. */
const WIRE_Y = 10.5;
const SAG = 2.2;

/** Lit lanterns by mountain id, as the save holds them (game/lanterns.ts litByTown). The game sets it when the save
 *  changes; a dev switch (`?debug&row=N`) hangs N in every town. */
let rowLit: Record<string, number> = {};
let rowStamp = 0;
const DEV_ROW = (() => {
  try {
    const q = new URLSearchParams(location.search);
    const n = q.has('debug') ? Number(q.get('row')) : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(ROW, Math.round(n))) : -1;
  } catch {
    return -1;
  }
})();

/** The save's Lantern Row, for the world (call it with litByTown(save) whenever a lantern is lit or a save loads). */
export function setLanternRow(lit: Record<string, number>): void {
  const same = Object.keys(lit).length === Object.keys(rowLit).length && Object.entries(lit).every(([k, v]) => rowLit[k] === v);
  if (same) return;
  rowLit = { ...lit };
  rowStamp++;
}

/** How many lanterns hang in a mountain's town (the dev switch over the save). */
export function rowCount(id: string | null): number {
  if (!id) return 0;
  if (DEV_ROW >= 0) return DEV_ROW;
  return Math.max(0, Math.min(ROW, Math.floor(rowLit[id] ?? 0)));
}

/** Where a row of n lanterns hangs across a run of half-width X (its own frame: the run's middle at the origin):
 *  each lantern's x and its drop under the wire's line, in row order from the left bank. Pure, for the tests. */
export function rowLayout(n: number, X: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  if (n <= 0) return out;
  // (The eight slots are spread over the middle two thirds of the wire; a row hangs from its first slot, so a
  // part-lit row reads as a row begun, not as lanterns scattered.)
  const span = X * 1.3;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * i) / (ROW - 1);
    const u = x / X;
    out.push({ x, y: -SAG * (1 - u * u) - 0.9 });
  }
  return out;
}

/** One paper lantern hanging from the origin: a ribbed drum fuller at its waist, a slate cap and foot, a tassel.
 *  Its paper is a separate geometry so it can carry the light. */
function smallLantern(x: number, y: number): { paper: BufferGeometry; frame: BufferGeometry[] } {
  const R = 0.42;
  const H = 0.95;
  const body = new CylinderGeometry(R * 0.74, R * 0.74, H, 10, 4);
  const pos = body.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getY(i) / (H / 2);
    const s = 1 + 0.36 * (1 - v * v);
    pos.setX(i, pos.getX(i) * s);
    pos.setZ(i, pos.getZ(i) * s);
  }
  const cy = y - 0.35 - H / 2;
  const t = new Color(LAMP_TIMBER);
  const frame: BufferGeometry[] = [];
  frame.push(seg([x, y, 0], [x, y - 0.35, 0], 0.025, new Color(LAMP_BRONZE), 3));
  frame.push(part(new CylinderGeometry(R * 0.42, R * 0.7, 0.16, 8), new Color(LAMP_SLATE), { pos: [x, y - 0.38, 0] }));
  frame.push(part(new CylinderGeometry(R * 0.7, R * 0.4, 0.14, 8), new Color(LAMP_SLATE), { pos: [x, cy - H / 2 - 0.05, 0] }));
  for (const v of [-0.5, 0.5]) {
    const r = R * 0.74 * (1 + 0.36 * (1 - v * v)) + 0.02;
    frame.push(part(new CylinderGeometry(r, r, 0.06, 10, 1, true), t, { pos: [x, cy + (v * H) / 2, 0] }));
  }
  frame.push(part(new CylinderGeometry(0.07, 0.02, 0.38, 5), new Color('#C08A3A'), { pos: [x, cy - H / 2 - 0.32, 0] }));
  return { paper: part(body, new Color(PAPER_DARK), { pos: [x, cy, 0] }), frame };
}

interface Hung {
  root: Object3D;
  /** Sim z of the wire, the light's place, and the row's count. */
  z: number;
  x: number;
  y: number;
  n: number;
  paper: Mesh;
}

/** The Lantern Row as it hangs on the course in hand: at the finish and over the title shot's stretch. */
export class LanternRow {
  readonly root = new Object3D();
  private course: Course | null = null;
  private id: string | null = null;
  private rows: Hung[] = [];
  private built = -1;
  private low = false;
  private readonly kept: Array<BufferGeometry | { dispose(): void }> = [];

  setDetail(d: Detail): void {
    this.low = d === 'low';
  }

  setCourse(c: Course): void {
    this.course = c;
    const m = MOUNTAINS.find((x) => x.seed === c.seed);
    this.id = m ? m.id : null;
    this.built = -1;
  }

  private clear(): void {
    for (const r of this.rows) this.root.remove(r.root);
    for (const k of this.kept) k.dispose();
    this.kept.length = 0;
    this.rows = [];
  }

  private build(c: Course, n: number): void {
    this.clear();
    if (n <= 0 || !this.id) return;
    const shot = titleShot(this.id);
    for (const z of [c.finishZ + FINISH_AHEAD, shot.from + TITLE_AHEAD]) {
      if (z <= CHUNK_LEN || z > c.finishZ + 110) continue;
      const cx = c.centerX(z);
      const X = c.halfWidth(z) + c.edgeLimit(z) + 2.6;
      const g0 = c.ground(cx, z);
      const top = WIRE_Y;
      const paperParts: BufferGeometry[] = [];
      const frameParts: BufferGeometry[] = [];
      // The masts, past the barriers on both banks, each with a slate cap under snow.
      for (const s of [-1, 1]) {
        const g = c.ground(cx + s * X, z) - g0;
        frameParts.push(seg([s * X, g - 0.6, 0], [s * X, top + 0.6, 0], 0.18, new Color(LAMP_TIMBER), 5));
        frameParts.push(box(0.7, 0.18, 0.7, new Color(LAMP_SLATE), [s * X, top + 0.75, 0]));
        frameParts.push(box(0.64, 0.14, 0.64, SNOW, [s * X, top + 0.9, 0]));
        frameParts.push(seg([s * X, top - 1.6, 0], [s * (X - 1.1), top - 0.1, 0], 0.07, new Color(LAMP_TIMBER_LIT), 4));
      }
      // The wire, in eight soft spans.
      const N = 8;
      for (let i = 0; i < N; i++) {
        const x0 = -X + (2 * X * i) / N;
        const x1 = -X + (2 * X * (i + 1)) / N;
        const y0 = top - SAG * (1 - (x0 / X) ** 2);
        const y1 = top - SAG * (1 - (x1 / X) ** 2);
        frameParts.push(seg([x0, y0, 0], [x1, y1, 0], 0.03, new Color(LAMP_BRONZE), 3));
      }
      for (const l of rowLayout(n, X)) {
        const y = top + l.y + 0.9;
        const piece = smallLantern(l.x, y);
        paperParts.push(piece.paper);
        frameParts.push(...piece.frame);
      }
      const root = new Object3D();
      root.position.set(cx, g0, -z);
      const fg = merge(frameParts);
      const pg = merge(paperParts);
      const fm = makeToonMaterial({ coolShade: 0.4, rim: 0.3 });
      const pm = makeToonMaterial({ coolShade: 0.25, rim: 0.2, emissive: new Color('#FFC24E'), emissiveStrength: 1.6 });
      this.kept.push(fg, pg, fm, pm);
      const frame = new Mesh(fg, fm);
      const paper = new Mesh(pg, pm);
      root.add(frame, paper);
      this.root.add(root);
      this.rows.push({ root, z, x: cx, y: g0 + top - SAG - 1.4, n, paper });
    }
  }

  /** Each frame: the rows as the save has them, shown near the lens, their light on the snow on Medium and High. */
  update(z: number, mode: 'run' | 'title' | 'results', p: Palette): void {
    const c = this.course;
    if (!c) return;
    const n = rowCount(this.id);
    const stamp = n * 1000 + rowStamp;
    if (stamp !== this.built) {
      this.built = stamp;
      this.build(c, n);
    }
    // (A lantern's paper glows the same by day, a step brighter as the lamps come on.)
    const glow = 1.15 + 0.6 * Math.min(1, p.lamps);
    for (const r of this.rows) {
      const d = r.z - z;
      r.root.visible = d > -160 && d < 520;
      if (!r.root.visible) continue;
      const u = (r.paper.material as ShaderMaterial).uniforms;
      u.uEmissiveStrength.value = glow;
      if (!this.low && Math.abs(d) < 90) pushLocalLight(r.x, r.y, -r.z, 1, 0.7, 0.26, 9 + r.n * 0.9, 0.35 + 0.06 * r.n);
    }
    void mode;
  }

  dispose(): void {
    this.clear();
  }
}
