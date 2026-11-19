import { CHARM, type CharmFamily } from '../sim/charms';

// The charms' glyphs and their families' colours (round 8, G2). Each of the 24 charms has one small pictogram, drawn
// once into an atlas on idle time (a 2D canvas, white on clear; the shader tints it), so a gate's three arches, a
// ghost's pick and any later card can show it. A family is told by its shape as well as its colour (charmgates.ts):
// speed is pointed, style round, survival square.
//
// The families' colours take none of the locked roles (ART.md 1: vermillion is the rider's, mint the ghosts', marigold
// the lantern's, rose the grudge's, gold-white your best's, amber the clock's) and none of the hazards' darks: an
// azure, an orchid and a leaf green, each light enough to glow on dusk snow and deep enough to hold on white.

export const FAMILY_HEX: Record<CharmFamily, string> = {
  speed: '#4DA6FF',
  style: '#D07BFF',
  survival: '#7ED957',
};

/** The family's index: its arch's shape (charmgates.ts) and its place in FAMILY_HEX. */
export const FAMILY_INDEX: Record<CharmFamily, number> = { speed: 0, style: 1, survival: 2 };

/** The atlas: 8 columns by 4 rows of 64 px cells; a charm's cell is its id. */
export const GLYPH_CELL = 64;
export const GLYPH_COLS = 8;
export const GLYPH_ROWS = 4;

/** A glyph's cell in the atlas, as uv (origin bottom left, as a texture is sampled): its corner and size. */
export function glyphCell(id: number): { u: number; v: number; w: number; h: number } {
  const c = id % GLYPH_COLS;
  const r = Math.floor(id / GLYPH_COLS);
  return { u: c / GLYPH_COLS, v: 1 - (r + 1) / GLYPH_ROWS, w: 1 / GLYPH_COLS, h: 1 / GLYPH_ROWS };
}

type Ctx = CanvasRenderingContext2D;

/** Each charm's pictogram in a 64 px cell centred on (32, 32), within a radius of about 24: strokes with round ends,
 *  a few fills. Plain shapes a player can tell apart at a glance: a comet, a kite, a snowflake, an owl's face... */
const DRAW: Record<number, (g: Ctx) => void> = {
  [CHARM.slip]: (g) => {
    // A lantern with the wind of a slipstream streaming past it.
    rrect(g, 30, 16, 16, 26, 5, true);
    line(g, 38, 12, 38, 16);
    line(g, 34, 46, 42, 46);
    line(g, 10, 22, 24, 22);
    line(g, 6, 31, 24, 31);
    line(g, 12, 40, 24, 40);
  },
  [CHARM.comet]: (g) => {
    // A comet's head and its tail.
    disc(g, 42, 22, 9);
    line(g, 34, 29, 10, 52);
    line(g, 38, 33, 22, 52);
    line(g, 30, 25, 10, 38);
  },
  [CHARM.kite]: (g) => {
    // A kite on its string.
    poly(g, [[38, 8], [52, 22], [38, 40], [24, 22]], true);
    g.beginPath();
    g.moveTo(38, 40);
    g.bezierCurveTo(30, 48, 22, 44, 12, 56);
    g.stroke();
  },
  [CHARM.frost]: (g) => {
    // A snowflake.
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      const c = Math.cos(a) * 22;
      const s = Math.sin(a) * 22;
      line(g, 32 - c, 32 - s, 32 + c, 32 + s);
      for (const e of [-1, 1]) {
        const ex = 32 + c * 0.6 * e;
        const ey = 32 + s * 0.6 * e;
        line(g, ex, ey, ex + Math.cos(a + 0.8 * e) * 7 * e, ey + Math.sin(a + 0.8 * e) * 7 * e);
        line(g, ex, ey, ex + Math.cos(a - 0.8 * e) * 7 * e, ey + Math.sin(a - 0.8 * e) * 7 * e);
      }
    }
  },
  [CHARM.star]: (g) => {
    // A falling star: five points and its streak.
    star(g, 40, 24, 13, 5.5);
    line(g, 28, 34, 10, 52);
    line(g, 33, 40, 22, 52);
  },
  [CHARM.drum]: (g) => {
    // A drum with a drift's ring swung round it.
    g.beginPath();
    g.ellipse(32, 24, 14, 6, 0, 0, Math.PI * 2);
    g.stroke();
    line(g, 18, 24, 18, 40);
    line(g, 46, 24, 46, 40);
    g.beginPath();
    g.ellipse(32, 40, 14, 6, 0, 0, Math.PI);
    g.stroke();
    g.beginPath();
    g.arc(32, 34, 26, Math.PI * 0.85, Math.PI * 1.35);
    g.stroke();
  },
  [CHARM.step]: (g) => {
    // An ember under a quick step.
    flame(g, 32, 46, 13, 30);
    line(g, 12, 54, 26, 54);
    line(g, 38, 54, 52, 54);
  },
  [CHARM.stride]: (g) => {
    // Two long chevrons.
    poly(g, [[10, 16], [28, 32], [10, 48]], false);
    poly(g, [[30, 16], [48, 32], [30, 48]], false);
    line(g, 50, 32, 56, 32);
  },
  [CHARM.owl]: (g) => {
    // An owl's face: two round eyes and a beak.
    ring(g, 21, 28, 9);
    ring(g, 43, 28, 9);
    disc(g, 21, 28, 3.2);
    disc(g, 43, 28, 3.2);
    poly(g, [[28, 40], [36, 40], [32, 48]], true);
    line(g, 12, 16, 22, 20);
    line(g, 52, 16, 42, 20);
  },
  [CHARM.hearth]: (g) => {
    // A flame on a hearthstone.
    flame(g, 32, 40, 12, 26);
    rrect(g, 14, 44, 36, 10, 3, true);
  },
  [CHARM.paper]: (g) => {
    // A paper ribbon folding in the wind.
    poly(g, [[8, 40], [20, 22], [30, 36], [42, 16], [54, 30]], false);
    poly(g, [[8, 48], [20, 30], [30, 44], [42, 24], [54, 38]], false);
  },
  [CHARM.whirl]: (g) => {
    // A spiral.
    g.beginPath();
    for (let t = 0; t <= 1; t += 0.02) {
      const a = t * Math.PI * 4.2;
      const r = 3 + t * 21;
      const x = 32 + Math.cos(a) * r;
      const y = 32 + Math.sin(a) * r;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  },
  [CHARM.memory]: (g) => {
    // A paper crane.
    poly(g, [[8, 38], [30, 30], [36, 12], [40, 32], [56, 22], [44, 40], [24, 46]], true);
  },
  [CHARM.festival]: (g) => {
    // A drum's face and two sticks crossed over it.
    ring(g, 32, 38, 15);
    line(g, 14, 10, 34, 30);
    line(g, 50, 10, 30, 30);
    disc(g, 14, 10, 3.5);
    disc(g, 50, 10, 3.5);
  },
  [CHARM.bell]: (g) => {
    // A bell on its rope.
    g.beginPath();
    g.moveTo(16, 46);
    g.quadraticCurveTo(20, 42, 20, 32);
    g.quadraticCurveTo(20, 16, 32, 16);
    g.quadraticCurveTo(44, 16, 44, 32);
    g.quadraticCurveTo(44, 42, 48, 46);
    g.closePath();
    g.fill();
    disc(g, 32, 52, 4.5);
    line(g, 32, 6, 32, 16);
  },
  [CHARM.spirit]: (g) => {
    // Three rising waves of flow.
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      const y = 46 - k * 12;
      g.moveTo(8, y);
      g.bezierCurveTo(20, y - 10, 30, y + 6, 40, y - 4);
      g.quadraticCurveTo(48, y - 10, 56, y - 8);
      g.stroke();
    }
  },
  [CHARM.second]: (g) => {
    // A gust curling back on itself.
    g.beginPath();
    g.moveTo(8, 26);
    g.lineTo(40, 26);
    g.arc(40, 18, 8, Math.PI / 2, -Math.PI * 0.9, true);
    g.stroke();
    g.beginPath();
    g.moveTo(8, 38);
    g.lineTo(46, 38);
    g.arc(46, 46, 8, -Math.PI / 2, Math.PI * 0.9, false);
    g.stroke();
  },
  [CHARM.feather]: (g) => {
    // A feather.
    g.beginPath();
    g.moveTo(14, 54);
    g.quadraticCurveTo(26, 30, 50, 10);
    g.stroke();
    g.beginPath();
    g.moveTo(50, 10);
    g.quadraticCurveTo(52, 34, 24, 44);
    g.quadraticCurveTo(30, 22, 50, 10);
    g.fill();
  },
  [CHARM.stone]: (g) => {
    // A stone lantern: its cap, its light box and its foot.
    poly(g, [[16, 22], [32, 10], [48, 22]], true);
    rrect(g, 22, 24, 20, 14, 2, false);
    disc(g, 32, 31, 3.5);
    rrect(g, 28, 40, 8, 8, 1, true);
    rrect(g, 18, 48, 28, 6, 2, true);
  },
  [CHARM.bark]: (g) => {
    // A shield with the bark's grain in it.
    g.beginPath();
    g.moveTo(32, 8);
    g.lineTo(52, 16);
    g.quadraticCurveTo(52, 44, 32, 56);
    g.quadraticCurveTo(12, 44, 12, 16);
    g.closePath();
    g.stroke();
    line(g, 26, 20, 26, 44);
    line(g, 38, 20, 38, 44);
    line(g, 32, 16, 32, 50);
  },
  [CHARM.lamp]: (g) => {
    // A small oil lamp and its flame.
    flame(g, 32, 34, 9, 22);
    g.beginPath();
    g.moveTo(14, 38);
    g.quadraticCurveTo(32, 56, 50, 38);
    g.closePath();
    g.fill();
    line(g, 50, 38, 56, 34);
  },
  [CHARM.path]: (g) => {
    // A dotted path running off up the snow.
    const pts: [number, number, number][] = [[14, 54, 5], [22, 42, 4.4], [32, 32, 3.8], [40, 23, 3.2], [46, 15, 2.6], [50, 9, 2.2]];
    for (const [x, y, r] of pts) disc(g, x, y, r);
  },
  [CHARM.quick]: (g) => {
    // A spring under a foot.
    poly(g, [[16, 50], [48, 44], [16, 38], [48, 32], [16, 26]], false);
    rrect(g, 18, 10, 28, 10, 4, true);
  },
  [CHARM.wisp]: (g) => {
    // A wisp circling.
    disc(g, 38, 22, 8);
    g.beginPath();
    g.arc(30, 34, 18, -0.6, Math.PI * 1.25);
    g.stroke();
  },
};

function line(g: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

function disc(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function ring(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
}

function poly(g: Ctx, pts: readonly (readonly [number, number])[], closed: boolean): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  if (closed) {
    g.closePath();
    g.fill();
  } else g.stroke();
}

function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number, fill: boolean): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  if (fill) g.fill();
  else g.stroke();
}

function star(g: Ctx, x: number, y: number, r: number, ri: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : ri;
    if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** A teardrop flame standing on (x, y), `w` wide and `h` tall. */
function flame(g: Ctx, x: number, y: number, w: number, h: number): void {
  g.beginPath();
  g.moveTo(x, y);
  g.bezierCurveTo(x - w, y, x - w, y - h * 0.55, x, y - h);
  g.bezierCurveTo(x + w, y - h * 0.55, x + w, y, x, y);
  g.closePath();
  g.fill();
}

/** Draws every charm's glyph into a fresh canvas atlas (white on clear). Null where there is no 2D canvas (tests). */
export function drawGlyphAtlas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = GLYPH_CELL * GLYPH_COLS;
  cv.height = GLYPH_CELL * GLYPH_ROWS;
  const g = cv.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#FFFFFF';
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 6.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const k of Object.keys(DRAW)) {
    const id = Number(k);
    g.save();
    g.translate((id % GLYPH_COLS) * GLYPH_CELL, Math.floor(id / GLYPH_COLS) * GLYPH_CELL);
    g.beginPath();
    g.rect(0, 0, GLYPH_CELL, GLYPH_CELL);
    g.clip();
    DRAW[id](g);
    g.restore();
  }
  return cv;
}

/** The charms with a glyph (all 24). */
export function glyphIds(): number[] {
  return Object.keys(DRAW).map(Number).sort((a, b) => a - b);
}
