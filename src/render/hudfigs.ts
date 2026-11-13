import { figures, type Fig } from '../ui/figures';
import type { InkStyle, LabelBatch, Run } from './labels';

// Low's running figures (ui/figures.ts): the score, the clock and the distance drawn in the canvas from
// baked numerals, where the HUD's own layout put their boxes. One sprite a character, laid on the
// advances the atlas measured (digits tabular), so a figure reads as its DOM text did.

interface Set {
  style: InkStyle;
  text: string;
  epoch: number;
  runs: Array<Run | null>;
}

const sets = new Map<Fig, Set>();
/** The figures' shared alpha: they come and go with the HUD, over about a fifth of a second. */
let alpha = 0;

function styleOf(f: Fig): InkStyle {
  return { key: `${f.font}/${f.lh}/${f.ls}/${f.color}`, font: f.font, size: f.size, lh: f.lh, ls: f.ls, color: f.color, halo: true };
}

function draw(b: LabelBatch, f: Fig, now: number, still: boolean): void {
  if (!f.text || !f.font) return;
  let s = sets.get(f);
  const key = `${f.font}/${f.lh}/${f.ls}/${f.color}`;
  if (!s || s.style.key !== key) {
    s = { style: styleOf(f), text: '', epoch: -1, runs: [] };
    sets.set(f, s);
  }
  if (s.text !== f.text || s.epoch !== b.epoch) {
    // The figure changed (twenty times a second at most), or the atlas was emptied: its sprites again.
    s.runs.length = 0;
    let whole = true;
    for (let i = 0; i < f.text.length; i++) {
      const r = b.ink(f.text[i], s.style);
      s.runs.push(r);
      if (!r) whole = false;
    }
    s.text = whole ? f.text : '';
    s.epoch = b.epoch;
  }
  // A bump swells it from its left edge's middle and lets it settle (none under reduced motion).
  let k = 1;
  const t = (now - f.bumpAt) / Math.max(1, f.bumpMs);
  if (!still && t >= 0 && t < 1) k = 1 + (f.bump - 1) * (t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65);
  b.at(f.x, f.y + (f.lh / 2) * (1 - k), k, alpha);
  let x = 0;
  for (let i = 0; i < s.runs.length; i++) {
    const r = s.runs[i];
    if (!r) continue;
    b.inked(r, x, 0, 1);
    x += r.w;
  }
}

/** Draws the figures into this frame's batch (after the labels, so a figure is never under a pill). */
export function drawFigures(b: LabelBatch, dt: number, still: boolean): void {
  const want = figures.canvas && figures.on ? 1 : 0;
  alpha += (want - alpha) * Math.min(1, dt * 14);
  if (Math.abs(want - alpha) < 0.02) alpha = want;
  if (alpha <= 0) return;
  const now = performance.now();
  draw(b, figures.score, now, still);
  draw(b, figures.clock, now, still);
  draw(b, figures.dist, now, still);
}
