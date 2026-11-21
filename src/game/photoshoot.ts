// Round 8, the photo lane: frames taken from the canvas the moment the picture is drawn (World.onPicture), before the
// riders' tags and the avalanche mirror go over it. A photo is the canvas at its full size as a PNG, with the run's
// card in a corner when asked; an album sticker's frame is a small crop round the rider. The page may show the canvas
// mirrored (a mirror mountain: CSS turns the canvas over, so its own pixels are the unmirrored picture), so every
// frame taken here takes `mirrored` and turns itself over to match what the player saw.

/** An album sticker's frame (px): the sticker cards' shape, twice the size they are drawn at on a phone. */
export const THUMB_W = 320;
export const THUMB_H = 200;
/** WebP's quality for a sticker's frame (a JPEG's where WebP cannot be written). */
const THUMB_Q = 0.8;

/** The run, as its card in a photo's corner says it. */
export interface RunCard {
  mountain: string;
  /** The time over the line, or how far the run has come ("1:58.4", "1,240 m"). */
  time: string;
  /** "1st of 7", or null with no race to speak of. */
  place: string | null;
  /** First place: the place is set in gold-white (ART.md 1). */
  first: boolean;
  /** The rider's name (theirs: vermillion). */
  name: string;
}

function canvas2d(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  return g ? { c, g } : null;
}

/** The crop of a `w` x `h` picture at the sticker's shape, as large as fits, centred on (fx, fy) and kept inside. */
export function cropAround(w: number, h: number, fx: number, fy: number, aspect = THUMB_W / THUMB_H): { x: number; y: number; w: number; h: number } {
  let cw = w;
  let ch = w / aspect;
  if (ch > h) {
    ch = h;
    cw = h * aspect;
  }
  const x = Math.max(0, Math.min(w - cw, fx - cw / 2));
  const y = Math.max(0, Math.min(h - ch, fy - ch / 2));
  return { x, y, w: cw, h: ch };
}

/** A sticker's frame from the canvas as it stands: the crop round the rider (`fx`, `fy` in the canvas's own pixels;
 *  the rider sits a little under the middle). Null when the canvas cannot be read. */
export function thumbOf(src: HTMLCanvasElement, fx: number, fy: number, mirrored: boolean): HTMLCanvasElement | null {
  const t = canvas2d(THUMB_W, THUMB_H);
  if (!t) return null;
  const r = cropAround(src.width, src.height, fx, fy - src.height * 0.04);
  try {
    if (mirrored) {
      t.g.translate(THUMB_W, 0);
      t.g.scale(-1, 1);
    }
    t.g.imageSmoothingQuality = 'high';
    t.g.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, THUMB_W, THUMB_H);
  } catch {
    return null;
  }
  return t.c;
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      c.toBlob((b) => resolve(b), type, q);
    } catch {
      resolve(null);
    }
  });
}

/** A sticker's frame as a small WebP, or a JPEG where the browser cannot write WebP (it hands back a PNG). */
export async function encodeThumb(c: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await toBlob(c, 'image/webp', THUMB_Q);
  if (webp && webp.type === 'image/webp') return webp;
  return toBlob(c, 'image/jpeg', 0.82);
}

const FACE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** The run's card, in the game's type and colours, in the picture's lower left (ART.md 10: ink at 86% with an inner
 *  hairline, an 18 px corner, weight 800 to 900, italic for the mountain). */
export function drawRunCard(g: CanvasRenderingContext2D, w: number, h: number, card: RunCard): void {
  const u = Math.max(0.6, Math.min(w, h * 1.6) / 1152);
  const pad = 22 * u;
  const m = 28 * u;
  const lines: Array<{ text: string; font: string; color: string; gap: number; track?: number }> = [
    { text: 'GHOST SLED', font: `800 ${13 * u}px ${FACE}`, color: 'rgba(245, 243, 255, 0.68)', gap: 0, track: 0.14 },
    { text: card.mountain.toUpperCase(), font: `italic 900 ${34 * u}px ${FACE}`, color: '#F5F3FF', gap: 10 * u },
  ];
  g.save();
  g.textBaseline = 'alphabetic';
  const width = (text: string, font: string, track = 0) => {
    g.font = font;
    return g.measureText(text).width + track * parseFloat(font.split('px')[0].split(' ').pop() ?? '0') * text.length;
  };
  const statFont = `800 ${21 * u}px ${FACE}`;
  const nameFont = `italic 900 ${19 * u}px ${FACE}`;
  const dot = '  ';
  const stat = card.place ? `${card.time}${dot}` : card.time;
  const statW = width(stat, statFont) + (card.place ? width(card.place, statFont) : 0);
  let inner = Math.max(statW, width(card.name, nameFont));
  for (const l of lines) inner = Math.max(inner, width(l.text, l.font, l.track ?? 0));
  const lh = (px: number) => px * 1.22;
  const boxH = pad * 2 + lh(13 * u) + 10 * u + lh(34 * u) + 8 * u + lh(21 * u) + 6 * u + lh(19 * u);
  const boxW = inner + pad * 2;
  const x = m;
  const y = h - m - boxH;
  const r = 18 * u;
  const round = (rx: number, ry: number, rw: number, rh: number, rr: number) => {
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(rx, ry, rw, rh, rr);
    else g.rect(rx, ry, rw, rh);
  };
  round(x, y, boxW, boxH, r);
  g.fillStyle = 'rgba(18, 25, 51, 0.86)';
  g.fill();
  g.lineWidth = Math.max(1, u);
  g.strokeStyle = 'rgba(245, 243, 255, 0.1)';
  round(x + g.lineWidth / 2, y + g.lineWidth / 2, boxW - g.lineWidth, boxH - g.lineWidth, r - g.lineWidth / 2);
  g.stroke();
  let ty = y + pad;
  const put = (text: string, font: string, color: string, px: number, at = x + pad, track = 0) => {
    g.font = font;
    g.fillStyle = color;
    if (track > 0 && 'letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${track * px}px`;
    g.fillText(text, at, ty + px);
    if (track > 0 && 'letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  };
  put(lines[0].text, lines[0].font, lines[0].color, 13 * u, x + pad, 0.14);
  ty += lh(13 * u) + 10 * u;
  put(lines[1].text, lines[1].font, lines[1].color, 34 * u);
  ty += lh(34 * u) + 8 * u;
  put(stat, statFont, '#F5F3FF', 21 * u);
  if (card.place) put(card.place, statFont, card.first ? '#FFE08A' : '#F5F3FF', 21 * u, x + pad + width(stat, statFont));
  ty += lh(21 * u) + 6 * u;
  put(card.name, nameFont, '#FF4D2E', 19 * u);
  g.restore();
}

/** The photo: the canvas at its full size, turned over to match a mirrored page, with the run's card when given. */
export function photoOf(src: HTMLCanvasElement, mirrored: boolean, card: RunCard | null): HTMLCanvasElement | null {
  const t = canvas2d(src.width, src.height);
  if (!t) return null;
  try {
    t.g.save();
    if (mirrored) {
      t.g.translate(src.width, 0);
      t.g.scale(-1, 1);
    }
    t.g.drawImage(src, 0, 0);
    t.g.restore();
    if (card) drawRunCard(t.g, src.width, src.height, card);
  } catch {
    return null;
  }
  return t.c;
}

export function pngOf(c: HTMLCanvasElement): Promise<Blob | null> {
  return toBlob(c, 'image/png');
}

/** Hands a file to the browser to save. False where it could not (no DOM, a sandbox without downloads). */
export function download(blob: Blob, name: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  } catch {
    return false;
  }
}
