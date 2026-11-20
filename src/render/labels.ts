import { BufferAttribute, BufferGeometry, Camera, CanvasTexture, CustomBlending, DoubleSide, DynamicDrawUsage, InterleavedBuffer, InterleavedBufferAttribute, LinearFilter, Mesh, NoColorSpace, OneFactor, OneMinusSrcAlphaFactor, Scene, ShaderMaterial, Vector2, type WebGLRenderer } from 'three';

// The riders' labels, drawn in the canvas (round 7). Every name tag, emblem, crash-marker tag, speech
// chip and the edge chip that points at an off-screen rival is a handful of quads in one mesh, drawn once
// over the finished frame: pills, rings, shadows and pointers are signed-distance shapes in the fragment
// shader, and words and glyphs are sprites from one atlas (a 2D canvas, rasterised once a word and
// uploaded as a texture). Nothing here touches the DOM while a run plays, which is the point: with riders
// in frame all run, moving their DOM pills cost a throttled Low frame as much page work as the scene
// (decisions 217 and 238).
//
// Colours are sRGB, written straight to the canvas and blended there, as CSS composites them, so a pill
// here is the colour its CSS was. Sizes are CSS px. The atlas holds whole words, not letters: the
// browser shapes and kerns each one exactly as it did in the DOM, in any script, and a name is rasterised
// once a field. Digits are their own sprites (tabular), so a gap that changes costs no upload.
//
// The HUD's running figures on Low (hudfigs.ts) come through here too: each numeral is a sprite baked
// in its own colour with the HUD's ink halo round it, so a score that changes twenty times a second is a
// few quads and no style, layout or paint.
//
// The labels are decoration over what the HUD's rival pill already says in text: nothing in this file is
// read by a screen reader, and nothing needs to be.

export type RGB = readonly [number, number, number];

/** A CSS hex colour as sRGB floats. */
export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** color-mix(in srgb, a k, b). */
export function mixRgb(a: RGB, b: RGB, k: number): RGB {
  return [a[0] * k + b[0] * (1 - k), a[1] * k + b[1] * (1 - k), a[2] * k + b[2] * (1 - k)];
}

export const INK: RGB = rgb('#121933');
export const PAPER: RGB = rgb('#F5F3FF');

const FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** A face a label is set in: the CSS font shorthand without its family, its size, its line box's height
 *  and its letter-spacing (px). They are the label layer's old CSS, kept to the pixel. */
export interface Face {
  font: string;
  size: number;
  lh: number;
  ls: number;
  upper?: boolean;
}

export const FACES = {
  /** A ghost's name. */
  name: { font: '800 12px', size: 12, lh: 13.2, ls: 0.24 },
  /** Its kind word ('GRUDGE'). */
  kind: { font: '800 11px', size: 11, lh: 12.1, ls: 0.55, upper: true },
  /** A crash marker ('Mila wiped out here') and a graveyard's name. */
  mark: { font: '700 12px', size: 12, lh: 13.2, ls: 0.24 },
  /** A trick word swapped in for a name. */
  trick: { font: 'italic 800 12px', size: 12, lh: 13.2, ls: 0.24 },
  /** A graveyard's count line. */
  fell: { font: '650 11px', size: 11, lh: 12.1, ls: 0.11 },
  /** A signature rider's line. */
  say: { font: 'italic 700 12.5px', size: 12.5, lh: 14.4, ls: 0 },
  /** The edge chip's gap. */
  chip: { font: 'italic 800 14px', size: 14, lh: 16, ls: 0.14 },
} as const satisfies Record<string, Face>;
export type FaceId = keyof typeof FACES;

/** How a HUD figure's numerals are set: the CSS font shorthand without its family, its size, line box and
 *  letter-spacing (px), its colour as CSS, and whether the HUD's ink halo is baked round it. `key` names
 *  the style in the atlas. */
export interface InkStyle {
  key: string;
  font: string;
  size: number;
  lh: number;
  ls: number;
  color: string;
  halo: boolean;
}

/** The HUD's halo (style.css --halo): a 2 px ink stroke as eight offsets, inside a tight glow. */
const HALO_C = 'rgba(18, 25, 51, 0.95)';
const HALO_OFFS: ReadonlyArray<readonly [number, number]> = [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]];
/** Room round a haloed glyph for its glow. */
const HALO_PAD = 12;

/** One sprite in the atlas: a word's line box or a glyph's square. `w` and `h` are CSS px, `base` the
 *  baseline's drop from the box's top; the uv rect covers the box and `pad` px round it. */
export interface Run {
  w: number;
  h: number;
  base: number;
  pad: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  epoch: number;
}

/** Most quads a frame: a full field's tags with every ring on is about 150. */
const MAX_QUADS = 320;
/** Floats a vertex: position 2, local 2, half 2, shape 4 (radius, stroke, blur, kind), fill 4, stroke 4, uv 2. */
const STRIDE = 20;
const PAD = 2;

const VERT = /* glsl */ `
  attribute vec2 aLocal;
  attribute vec2 aHalf;
  attribute vec4 aShape;
  attribute vec4 aFill;
  attribute vec4 aStroke;
  attribute vec2 aUv;
  uniform vec2 uView;
  // -1 on a mirrored run: the canvas is shown flipped (world.ts setMirrored), so the labels are drawn flipped back.
  uniform float uFlip;
  varying vec2 vLocal;
  varying vec2 vHalf;
  varying vec4 vShape;
  varying vec4 vFill;
  varying vec4 vStroke;
  varying vec2 vUv;
  void main() {
    vLocal = aLocal;
    vHalf = aHalf;
    vShape = aShape;
    vFill = aFill;
    vStroke = aStroke;
    vUv = aUv;
    gl_Position = vec4((position.x / uView.x * 2.0 - 1.0) * uFlip, 1.0 - position.y / uView.y * 2.0, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tAtlas;
  /** Device px a CSS px (the edge's one-pixel ramp). */
  uniform float uPx;
  varying vec2 vLocal;
  varying vec2 vHalf;
  varying vec4 vShape;
  varying vec4 vFill;
  varying vec4 vStroke;
  varying vec2 vUv;
  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    float kind = vShape.w;
    vec4 col;
    if (kind > 2.5) {
      // A numeral baked in its own colours (the atlas is premultiplied): drawn as it is.
      gl_FragColor = texture2D(tAtlas, vUv) * vFill.a;
      return;
    } else if (kind > 1.5) {
      // A word or a glyph: the atlas's coverage in the quad's colour.
      col = vec4(vFill.rgb, vFill.a * texture2D(tAtlas, vUv).a);
    } else {
      // A rounded box, or a square stood on its corner (the pill's pointer).
      float d = kind > 0.5 ? (abs(vLocal.x) + abs(vLocal.y) - vHalf.x) * 0.7071 : sdBox(vLocal, vHalf, min(vShape.x, min(vHalf.x, vHalf.y)));
      if (vShape.z > 0.0) {
        // A soft shadow or a glow: the box's edge blurred over vShape.z px.
        float a = 1.0 - smoothstep(-0.55 * vShape.z, vShape.z, d);
        col = vec4(vFill.rgb, vFill.a * a * a);
      } else {
        float edge = clamp(0.5 - d * uPx, 0.0, 1.0);
        // An inner ring vShape.y px wide in the stroke colour, the fill inside it.
        float inner = vShape.y > 0.0 ? clamp(0.5 - (d + vShape.y) * uPx, 0.0, 1.0) : 1.0;
        col = mix(vStroke, vFill, inner);
        col.a *= edge;
      }
    }
    if (col.a < 0.003) discard;
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

export class LabelBatch {
  private readonly scene = new Scene();
  private readonly camera = new Camera();
  private readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly buf: InterleavedBuffer;
  private readonly data: Float32Array;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tex: CanvasTexture | null = null;
  private runs = new Map<string, Run>();
  /** The atlas's scale (device px a CSS px, whole) and its size. */
  private scale = 1;
  private aw = 0;
  private ah = 0;
  /** The shelf packer: the next free x, the shelf's top and its height. */
  private sx = 0;
  private sy = 0;
  private sh = 0;
  private full = false;
  private dirty = false;
  private quads = 0;
  /** Bumped whenever the atlas is cleared: a Run from an older epoch must be asked for again. */
  epoch = 1;
  /** Nothing is rasterised until the first frame has been drawn (arm()): the atlas is never part of it. */
  private armed = false;
  // This frame's transform: local px to screen px.
  private ox = 0;
  private oy = 0;
  private os = 1;
  private oa = 1;
  /** Quads drawn last frame (the cost: one draw call whatever the count). */
  drawn = 0;
  /** Sprites rasterised and texture uploads since the start (play-tests read them). */
  rasters = 0;
  uploads = 0;

  constructor() {
    this.data = new Float32Array(MAX_QUADS * 4 * STRIDE);
    this.buf = new InterleavedBuffer(this.data, STRIDE);
    this.buf.setUsage(DynamicDrawUsage);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new InterleavedBufferAttribute(this.buf, 2, 0));
    geo.setAttribute('aLocal', new InterleavedBufferAttribute(this.buf, 2, 2));
    geo.setAttribute('aHalf', new InterleavedBufferAttribute(this.buf, 2, 4));
    geo.setAttribute('aShape', new InterleavedBufferAttribute(this.buf, 4, 6));
    geo.setAttribute('aFill', new InterleavedBufferAttribute(this.buf, 4, 10));
    geo.setAttribute('aStroke', new InterleavedBufferAttribute(this.buf, 4, 14));
    geo.setAttribute('aUv', new InterleavedBufferAttribute(this.buf, 2, 18));
    const idx = new Uint16Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setDrawRange(0, 0);
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { tAtlas: { value: null }, uView: { value: new Vector2(1, 1) }, uPx: { value: 1 }, uFlip: { value: 1 } },
      transparent: true,
      // (Screen px count down the frame, so a quad's winding is the other way round in clip space.)
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** A mirrored run (modes.ts): the whole canvas is shown flipped, so the labels are drawn flipped back. Everything is
   *  laid out in screen px as the player sees the screen (a ghost's tag where its ghost shows, the edge chip on the
   *  edge its rival is past, the HUD's figures in their boxes); only the draw turns it over, so a word reads the right
   *  way round where it was laid. */
  setFlip(on: boolean): void {
    this.mat.uniforms.uFlip.value = on ? -1 : 1;
  }

  get flipped(): boolean {
    return this.mat.uniforms.uFlip.value < 0;
  }

  /** The first frame is out: words may be rasterised from now on. */
  arm(): void {
    this.armed = true;
  }

  get ready(): boolean {
    return this.armed;
  }

  /** Drops every sprite (a new field's names): callers ask again and the atlas fills from empty. */
  reset(): void {
    this.runs.clear();
    this.sx = this.sy = this.sh = 0;
    this.full = false;
    this.epoch++;
    if (this.ctx && this.canvas) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.dirty = true;
    }
  }

  /** The 2D canvas, made on first use at the frame's own pixel scale (1 on Low, 2 or 3 on a dense
   *  screen), so a word at rest maps a texel to a pixel. */
  private surface(): CanvasRenderingContext2D | null {
    if (this.ctx) return this.ctx;
    if (typeof document === 'undefined') return null;
    const s = this.scale;
    this.aw = s <= 2 ? 1024 : 2048;
    this.ah = s <= 1 ? 512 : 1024;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.aw;
    this.canvas.height = this.ah;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return null;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = NoColorSpace;
    // (Kept premultiplied, as the 2D canvas holds it: a baked numeral's soft halo blends with no fringe.)
    this.tex.premultiplyAlpha = true;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = LinearFilter;
    this.tex.magFilter = LinearFilter;
    this.mat.uniforms.tAtlas.value = this.tex;
    return this.ctx;
  }

  /** Room for a sprite w by h CSS px (padded), or null when the atlas is full (it empties next frame). */
  private alloc(w: number, h: number, pad = PAD): { x: number; y: number } | null {
    const s = this.scale;
    const cw = Math.ceil((w + pad * 2) * s) + 1;
    const ch = Math.ceil((h + pad * 2) * s) + 1;
    if (this.sx + cw > this.aw) {
      this.sx = 0;
      this.sy += this.sh;
      this.sh = 0;
    }
    if (this.sy + ch > this.ah || cw > this.aw) {
      this.full = true;
      return null;
    }
    const at = { x: this.sx, y: this.sy };
    this.sx += cw;
    this.sh = Math.max(this.sh, ch);
    return at;
  }

  private entry(x: number, y: number, w: number, h: number, base: number, pad = PAD): Run {
    const s = this.scale;
    return { w, h, base, pad, u0: x / this.aw, v0: 1 - y / this.ah, u1: (x + (w + pad * 2) * s) / this.aw, v1: 1 - (y + (h + pad * 2) * s) / this.ah, epoch: this.epoch };
  }

  /** A numeral (or any short text) of a HUD figure, baked in its colour with the halo round it. Digits
   *  are set on one advance (tabular), whatever the face. Draw it with inked(). */
  ink(ch: string, st: InkStyle): Run | null {
    if (!this.armed || this.full) return null;
    const key = `i\u0000${st.key}\u0000${ch}`;
    const hit = this.runs.get(key);
    if (hit) return hit;
    const ctx = this.surface();
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${st.font} ${FAMILY}`;
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    const digit = ch.length === 1 && ch >= '0' && ch <= '9';
    let adv = ctx.measureText(ch).width;
    if (digit) for (let d = 0; d < 10; d++) adv = Math.max(adv, ctx.measureText(String(d)).width);
    const own = ctx.measureText(ch);
    const asc = own.fontBoundingBoxAscent ?? st.size * 0.93;
    const desc = own.fontBoundingBoxDescent ?? st.size * 0.25;
    const base = (st.lh - (asc + desc)) / 2 + asc;
    const w = adv + st.ls;
    const pad = st.halo ? HALO_PAD : PAD + 2;
    const at = this.alloc(w, st.lh, pad);
    if (!at) return null;
    const s = this.scale;
    ctx.setTransform(s, 0, 0, s, at.x, at.y);
    ctx.textBaseline = 'alphabetic';
    // (A digit sits in the middle of the shared advance.)
    const x = pad + (adv - own.width) / 2;
    const y = pad + base;
    if (st.halo) {
      // The glow first, as CSS paints a shadow list from its last entry up; then the stroke; then the type.
      for (const g of [{ c: 'rgba(18, 25, 51, 0.5)', blur: 9, dy: 1 }, { c: 'rgba(18, 25, 51, 0.9)', blur: 4, dy: 0 }]) {
        ctx.shadowColor = g.c;
        ctx.shadowBlur = g.blur * s;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = g.dy * s;
        ctx.fillStyle = g.c;
        ctx.fillText(ch, x, y);
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = HALO_C;
      for (const o of HALO_OFFS) ctx.fillText(ch, x + o[0], y + o[1]);
    }
    ctx.fillStyle = st.color;
    ctx.fillText(ch, x, y);
    const r = this.entry(at.x, at.y, w, st.lh, base, pad);
    this.runs.set(key, r);
    this.dirty = true;
    this.rasters++;
    return r;
  }

  /** A word in a face: its sprite, rasterised on first asking. Null before the first frame is out, with
   *  no 2D canvas (a test), or in the one frame the atlas is full. */
  run(text: string, face: FaceId): Run | null {
    if (!this.armed || this.full) return null;
    const key = `${face}\u0000${text}`;
    const hit = this.runs.get(key);
    if (hit) return hit;
    const ctx = this.surface();
    if (!ctx) return null;
    const f: Face = FACES[face];
    const str = f.upper ? text.toUpperCase() : text;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${f.font} ${FAMILY}`;
    const spaced = 'letterSpacing' in ctx;
    if (spaced) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${f.ls}px`;
    const m = ctx.measureText(str);
    const w = Math.ceil(m.width + (spaced ? 0 : f.ls * str.length));
    const asc = m.fontBoundingBoxAscent ?? f.size * 0.93;
    const desc = m.fontBoundingBoxDescent ?? f.size * 0.25;
    const base = (f.lh - (asc + desc)) / 2 + asc;
    const at = this.alloc(w, f.lh);
    if (!at) return null;
    const s = this.scale;
    ctx.setTransform(s, 0, 0, s, at.x, at.y);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.fillText(str, PAD, PAD + base);
    const r = this.entry(at.x, at.y, w, f.lh, base);
    this.runs.set(key, r);
    this.dirty = true;
    this.rasters++;
    return r;
  }

  /** A glyph from an SVG path, `size` CSS px square from a `box` unit viewBox: filled, or stroked `stroke`
   *  units wide; `n` draws it that many times round the middle (a petal into a blossom); `evenodd` for a
   *  path with holes. */
  glyph(key: string, d: string, box: number, size: number, o: { stroke?: number; n?: number; evenodd?: boolean; join?: CanvasLineJoin } = {}): Run | null {
    if (!this.armed || this.full) return null;
    const k = `g\u0000${key}`;
    const hit = this.runs.get(k);
    if (hit) return hit;
    const ctx = this.surface();
    if (!ctx || typeof Path2D === 'undefined') return null;
    const at = this.alloc(size, size);
    if (!at) return null;
    const s = this.scale;
    const u = size / box;
    const path = new Path2D(d);
    const n = o.n ?? 1;
    for (let i = 0; i < n; i++) {
      ctx.setTransform(s, 0, 0, s, at.x, at.y);
      ctx.translate(PAD, PAD);
      ctx.scale(u, u);
      if (i) {
        ctx.translate(box / 2, box / 2);
        ctx.rotate((Math.PI * 2 * i) / n);
        ctx.translate(-box / 2, -box / 2);
      }
      if (o.stroke) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = o.stroke;
        ctx.lineCap = 'round';
        ctx.lineJoin = o.join ?? 'round';
        ctx.stroke(path);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fill(path, o.evenodd ? 'evenodd' : 'nonzero');
      }
    }
    const r = this.entry(at.x, at.y, size, size, size);
    this.runs.set(k, r);
    this.dirty = true;
    this.rasters++;
    return r;
  }

  /** Starts a frame's labels: the view in CSS px and the frame's pixel ratio. */
  begin(w: number, h: number, pixelRatio: number): void {
    this.quads = 0;
    (this.mat.uniforms.uView.value as Vector2).set(w, h);
    this.mat.uniforms.uPx.value = pixelRatio;
    const s = Math.min(3, Math.max(1, Math.ceil(pixelRatio - 0.01)));
    if (s !== this.scale) {
      // The tier or the screen changed: the atlas is rebuilt at the new scale.
      this.scale = s;
      this.tex?.dispose();
      this.tex = null;
      this.ctx = null;
      this.canvas = null;
      this.mat.uniforms.tAtlas.value = null;
      this.reset();
    } else if (this.full) this.reset();
    this.ox = this.oy = 0;
    this.os = this.oa = 1;
  }

  /** The transform for what follows: local (0, 0) lands on (x, y), a local px is `s` px, and every alpha
   *  is multiplied by `a`. */
  at(x: number, y: number, s = 1, a = 1): void {
    this.ox = x;
    this.oy = y;
    this.os = s;
    this.oa = a;
  }

  private quad(cx: number, cy: number, hw: number, hh: number, ext: number, c: number, sn: number, radius: number, strokeW: number, blur: number, kind: number, fill: RGB, fa: number, stroke: RGB | null, sa: number, run: Run | null): void {
    if (this.quads >= MAX_QUADS) return;
    const d = this.data;
    const s = this.os;
    const X = this.ox + cx * s;
    const Y = this.oy + cy * s;
    // The quad reaches `ext` px past the shape (a blur's reach, an edge's ramp).
    const ex = hw + ext;
    const ey = hh + ext;
    let o = this.quads * 4 * STRIDE;
    const a = fa * this.oa;
    const sA = sa * this.oa;
    const st = stroke ?? fill;
    for (let k = 0; k < 4; k++) {
      const lx = k === 0 || k === 3 ? -ex : ex;
      const ly = k < 2 ? -ey : ey;
      d[o] = X + (lx * c - ly * sn) * s;
      d[o + 1] = Y + (lx * sn + ly * c) * s;
      d[o + 2] = lx;
      d[o + 3] = ly;
      d[o + 4] = hw;
      d[o + 5] = hh;
      d[o + 6] = radius;
      d[o + 7] = strokeW;
      d[o + 8] = blur;
      d[o + 9] = kind;
      d[o + 10] = fill[0];
      d[o + 11] = fill[1];
      d[o + 12] = fill[2];
      d[o + 13] = a;
      d[o + 14] = st[0];
      d[o + 15] = st[1];
      d[o + 16] = st[2];
      d[o + 17] = sA;
      if (run) {
        d[o + 18] = k === 0 || k === 3 ? run.u0 : run.u1;
        d[o + 19] = k < 2 ? run.v0 : run.v1;
      } else d[o + 18] = d[o + 19] = 0;
      o += STRIDE;
    }
    this.quads++;
  }

  /** A rounded box centred on local (cx, cy), `hw` by `hh` half-sizes, corner `r`: filled, with an inner
   *  ring `sw` px wide in `stroke` when given. */
  box(cx: number, cy: number, hw: number, hh: number, r: number, fill: RGB, fa: number, stroke: RGB | null = null, sa = 1, sw = 0): void {
    this.quad(cx, cy, hw, hh, 1, 1, 0, r, stroke ? sw : 0, 0, 0, fill, fa, stroke, sa, null);
  }

  /** A ring: a rounded box's outline `sw` px wide, nothing inside it. */
  ring(cx: number, cy: number, hw: number, hh: number, r: number, col: RGB, a: number, sw: number): void {
    this.quad(cx, cy, hw, hh, 1, 1, 0, r, sw, 0, 0, col, 0, col, a, null);
  }

  /** A box-shadow: the rounded box blurred over `blur` px. */
  shadow(cx: number, cy: number, hw: number, hh: number, r: number, col: RGB, a: number, blur: number): void {
    this.quad(cx, cy, hw, hh, blur + 1, 1, 0, r, 0, blur, 0, col, a, null, 0, null);
  }

  /** A square stood on its corner, `half` from its middle to a corner. */
  diamond(cx: number, cy: number, half: number, col: RGB, a: number): void {
    this.quad(cx, cy, half, half, 1, 1, 0, 0, 0, 0, 1, col, a, null, 0, null);
  }

  /** A sprite with its box's top left at local (x, y), `k` times its size. */
  sprite(run: Run, x: number, y: number, col: RGB, a: number, k = 1): void {
    const hw = (run.w / 2 + run.pad) * k;
    const hh = (run.h / 2 + run.pad) * k;
    this.quad(x + (run.w / 2) * k, y + (run.h / 2) * k, hw, hh, 0, 1, 0, 0, 0, 0, 2, col, a, null, 0, run);
  }

  /** A baked numeral (ink()) with its box's top left at local (x, y), in its own colours. */
  inked(run: Run, x: number, y: number, a: number): void {
    this.quad(x + run.w / 2, y + run.h / 2, run.w / 2 + run.pad, run.h / 2 + run.pad, 0, 1, 0, 0, 0, 0, 3, PAPER, a, null, 0, run);
  }

  /** A sprite centred on local (cx, cy), turned `ang` radians. */
  spriteAt(run: Run, cx: number, cy: number, ang: number, col: RGB, a: number): void {
    this.quad(cx, cy, run.w / 2 + run.pad, run.h / 2 + run.pad, 0, Math.cos(ang), Math.sin(ang), 0, 0, 0, 2, col, a, null, 0, run);
  }

  /** Draws the frame's labels over the finished picture: one draw call, none with nothing to show. */
  draw(renderer: WebGLRenderer): void {
    this.drawn = this.quads;
    if (this.dirty && this.tex) {
      this.tex.needsUpdate = true;
      this.dirty = false;
      this.uploads++;
    }
    if (this.quads === 0 || !this.tex) return;
    this.buf.clearUpdateRanges();
    this.buf.addUpdateRange(0, this.quads * 4 * STRIDE);
    this.buf.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, this.quads * 6);
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }

  dispose(): void {
    this.tex?.dispose();
    this.mat.dispose();
    this.mesh.geometry.dispose();
  }
}
