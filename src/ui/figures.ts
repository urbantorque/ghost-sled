// The HUD's running figures (score, clock, distance), for the renderer to draw in the canvas on Low.
// At 30 m/s the metres change on every second frame, and each change in the DOM is a style, a layout and
// a paint: on a throttled Low frame the three figures cost more page work than everything else on the
// page together (decision 205 put them on one beat; round 7 measured what was left). On Low the DOM keeps
// each figure's box and its text for a reader, painted clear and written once a second, and the numerals
// a player sees are sprites in the canvas (render/hudfigs.ts, labels.ts). The HUD writes this each frame;
// the renderer reads it. Like presence.ts, it is presentation only and never read by the sim.

export interface Fig {
  /** What it reads now ('' draws nothing). */
  text: string;
  /** Its box's top left in CSS px and its line box's height, from the HUD's own layout. */
  x: number;
  y: number;
  lh: number;
  /** Its face: the CSS font shorthand without the family, its size and letter-spacing (px), its colour. */
  font: string;
  size: number;
  ls: number;
  color: string;
  /** A bump on a change: how far it swells, over how long (ms), from when (performance.now()). */
  bump: number;
  bumpMs: number;
  bumpAt: number;
}

function fig(color = '#f5f3ff'): Fig {
  return { text: '', x: 0, y: 0, lh: 0, font: '', size: 0, ls: 0, color, bump: 1, bumpMs: 0, bumpAt: -1e9 };
}

export const figures = {
  /** The renderer draws the figures (it sets this with the tier: Low). The HUD reads it. */
  canvas: false,
  /** The HUD is up and has measured its boxes: there is something to draw. */
  on: false,
  score: fig(),
  clock: fig(),
  // (The distance is a step quieter than the clock: style.css .gs-dist.)
  dist: fig('rgba(245, 243, 255, 0.86)'),
};

/** Whether the page may hand its figures to the canvas at all: never with forced colours on (the clear
 *  DOM text would be forced visible again, over the canvas's). */
export function figuresAllowed(): boolean {
  return !(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(forced-colors: active)').matches);
}
