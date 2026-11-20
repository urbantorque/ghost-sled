import { BufferAttribute, BufferGeometry, CanvasTexture, Color, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, LinearFilter, LinearMipmapLinearFilter, Matrix4, NoColorSpace, Quaternion, ShaderMaterial, Vector3, type Camera, type Scene, type Texture, type WebGLRenderer } from 'three';
import { type CharmGate, LANE_W, charmFamily, laneX } from '../sim/charms';
import type { Course } from '../sim/course';
import { FAMILY_HEX, FAMILY_INDEX, STYLE_DEEP_HEX, GLYPH_COLS, GLYPH_ROWS, drawGlyphAtlas } from './charmglyphs';
import { shared } from './materials';

// The charm gates (round 8, G2): at each gate the sim places, three arches stand side by side across the course, one
// a lane, each carrying its charm's glyph on a medallion over its crown in its family's colour. A family is told by
// its shape as well as its colour, so a player reads the choice from far down the run before the glyphs resolve:
// speed is a pointed arch, style a round one, survival a square one, and the medallion over each wears the same
// outline. The medallion holds at least about 30 px tall however far off it stands (up to a little over twice its
// size), so the three outlines read from about 150 m at 40 m/s and the glyphs from about 90 m; the arches' tubes
// hold a few pixels thick the way the sky gates' rings do.
//
// State reads in the world (ART.md 14): the next gate is the brightest thing in it and breathes (steady under reduced
// motion); gates further on wait dimmer. The arch a rider takes answers with light as it is ridden through (it swells
// and burns toward white in its own colour, then is gone) and the other two gutter to an ember dark. A faint veil of
// the family's light fills each opening, so a lane reads as a door to ride through, not a hoop.
//
// The same draw carries the showdown's marker (G3): a finish banner across the run 300 m ahead of a showdown's start,
// two tall posts of gold-white light (the first place's colour) and a banner of ink and cream checks with a band of
// the rival's own colour, findable from the start of the race; it bursts in the winner's colour.
//
// Every arch, medallion, veil and the marker is one instanced draw on every tier. Low draws the same arches flat
// (two values, no core line or shimmer) with the same glyphs and the same veil. Nothing is built before the first
// frame: the mesh, its material and the glyph atlas are made on idle time and join the scene once compiled
// (compileAsync, as the poster does). The material shares only single uniforms (the fog, the clock), never an array.

/** Arch geometry, in metres (the arch's own frame: x across the run, y up, z toward the rider). */
export const ARCH_HALF = 1.75;
export const POST_H = 3.0;
const FOOT = -1.0;
const SQUARE_H = 4.3;
const SQUARE_R = 0.4;
/** The crown of each family's arch: speed (pointed, the tallest), style (round), survival (square). */
export const ARCH_TOP = [POST_H + Math.sqrt(3) * ARCH_HALF, POST_H + ARCH_HALF, SQUARE_H] as const;
/** Samples along an arch (odd, so the middle one is the crown: a pointed arch keeps its point) and sides round its
 *  tube. */
const ALONG = 29;
const AROUND = 5;
/** The tube's radius (m) before the pixel floor. */
const TUBE = 0.17;
/** The marker: a square arch this much wider and taller. */
export const MARKER_SCALE = [2.6, 2.2] as const;
/** The medallion: its half size (m), the least height it keeps on screen (CSS px), the most it may grow (times), and
 *  the gap kept between two as the outer ones step out. */
export const MEDAL_HALF = 0.95;
export const MEDAL_FLOOR_PX = 32;
export const MEDAL_CAP = 5;
export const MEDAL_GAP = 0.4;

/** How far (m) an outer medallion steps out from its arch's centre at a half size (the shader's own sum). */
export function medalSpread(half: number): number {
  return Math.max(0, 2 * half + MEDAL_GAP - LANE_W);
}

/** The medallion's half size (m) at a pixel's span in metres (the shader's own sum). */
export function medalHalf(px: number): number {
  return MEDAL_HALF * Math.min(MEDAL_CAP, Math.max(1, ((MEDAL_FLOOR_PX / 2) * px) / MEDAL_HALF));
}

/** The marker's columns of light stand this tall (m) over its posts. */
export const MARKER_BEAM = 46;

/** Gates are drawn from this far ahead (fading in over the last 60 m) to this far behind. */
export const DRAW_AHEAD = 460;
const DRAW_BEHIND = 25;
/** A taken arch's answer (s) and the others' guttering (s). */
export const BURST_S = 0.9;
export const GUTTER_S = 0.5;
/** A showdown marker's burst (s). */
const MARKER_BURST_S = 1.1;
const MAX_INSTANCES = 3 * 3 + 1;

/** One arch's centreline, ALONG points from its left foot over its crown to its right foot, for a family (0 speed,
 *  1 style, 2 survival). Points are spaced evenly along the arch. */
export function archPath(family: number, n = ALONG): Array<[number, number]> {
  const a = ARCH_HALF;
  const dense: Array<[number, number]> = [];
  const seg = (x0: number, y0: number, x1: number, y1: number) => {
    for (let i = 0; i < 24; i++) dense.push([x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * i) / 24]);
  };
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    for (let i = 0; i < 48; i++) {
      const t = a0 + ((a1 - a0) * i) / 48;
      dense.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
  };
  if (family === 0) {
    // Pointed: an equilateral arch, each side an arc of radius twice the half-width centred on the other post.
    seg(-a, FOOT, -a, POST_H);
    arc(a, POST_H, 2 * a, Math.PI, (2 * Math.PI) / 3);
    arc(-a, POST_H, 2 * a, Math.PI / 3, 0);
  } else if (family === 1) {
    // Round: a half circle on the posts.
    seg(-a, FOOT, -a, POST_H);
    arc(0, POST_H, a, Math.PI, 0);
  } else {
    // Square: a flat lintel on the posts, its corners rounded (a reward is friendly, ART.md 3).
    const r = SQUARE_R;
    seg(-a, FOOT, -a, SQUARE_H - r);
    arc(-a + r, SQUARE_H - r, r, Math.PI, Math.PI / 2);
    seg(-a + r, SQUARE_H, a - r, SQUARE_H);
    arc(a - r, SQUARE_H - r, r, Math.PI / 2, 0);
  }
  // (The right post, mirrored.)
  dense.push([a, family === 2 ? SQUARE_H - SQUARE_R : POST_H]);
  seg(a, family === 2 ? SQUARE_H - SQUARE_R : POST_H, a, FOOT);
  dense.push([a, FOOT]);
  // Even spacing along its length.
  const len: number[] = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[len.length - 1];
  const out: Array<[number, number]> = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (total * i) / (n - 1);
    while (j < len.length - 2 && len[j + 1] < s) j++;
    const k = (s - len[j]) / Math.max(1e-6, len[j + 1] - len[j]);
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * k, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * k]);
  }
  return out;
}

/** The three families' tubes, the medallion's quad and the veil's quad in one geometry (charmgates' header). */
export function charmGateGeometry(): BufferGeometry {
  const pos: number[] = [];
  const off: number[] = [];
  const info: number[] = [];
  const idx: number[] = [];
  for (let f = 0; f < 3; f++) {
    const path = archPath(f);
    const base = pos.length / 3;
    for (let i = 0; i < path.length; i++) {
      const p0 = path[Math.max(0, i - 1)];
      const p1 = path[Math.min(path.length - 1, i + 1)];
      let tx = p1[0] - p0[0];
      let ty = p1[1] - p0[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      // In-plane normal (the tube's frame: that and the z axis).
      const nx = -ty;
      const ny = tx;
      for (let k = 0; k < AROUND; k++) {
        const t = (k / AROUND) * Math.PI * 2;
        pos.push(path[i][0], path[i][1], 0);
        off.push(nx * Math.cos(t), ny * Math.cos(t), Math.sin(t));
        info.push(0, f, i / (path.length - 1), 0);
      }
    }
    for (let i = 0; i < path.length - 1; i++) {
      for (let k = 0; k < AROUND; k++) {
        const a = base + i * AROUND + k;
        const b = base + i * AROUND + ((k + 1) % AROUND);
        const c = a + AROUND;
        const d = b + AROUND;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  // The medallion (part 1) and the veil (part 2): one quad each, placed and sized in the vertex shader.
  for (const part of [1, 2]) {
    const base = pos.length / 3;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(x, y, 0);
      off.push(0, 0, 0);
      info.push(part, -1, 0, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aOff', new BufferAttribute(new Float32Array(off), 3));
  g.setAttribute('aInfo', new BufferAttribute(new Float32Array(info), 4));
  g.setIndex(idx);
  return g;
}

/** A colour in linear light as GLSL (the shader's constants: hex values are sRGB). */
function glsl(hex: string): string {
  const c = new Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

function gateMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: {
      uTime: shared.uTime,
      uFog: shared.uFog,
      uSunDir: shared.uSunDir,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uViewH: { value: 720 },
      uLow: { value: 0 },
      uDeep: { value: 0 },
      uCalm: { value: 0 },
      uAtlas: { value: null as Texture | null },
      uAtlasOn: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOff;
      attribute vec4 aInfo;
      attribute vec4 aInst;
      attribute vec4 aState;
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uViewH;
      uniform float uCalm;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec2 vQ;
      varying float vPart;
      varying float vFam;
      varying float vMarker;
      varying float vGlyph;
      varying vec4 vState;
      varying float vNext;
      varying float vSeed;
      varying vec3 vTint;
      varying float vPx;
      varying float vTop;
      float topOf(float f) { return f < 0.5 ? ${ARCH_TOP[0].toFixed(3)} : (f < 1.5 ? ${ARCH_TOP[1].toFixed(3)} : ${ARCH_TOP[2].toFixed(3)}); }
      void main() {
        float part = aInfo.x;
        float marker = step(2.5, aInst.x);
        float fam = marker > 0.5 ? 2.0 : aInst.x;
        vec2 mk = marker > 0.5 ? vec2(${MARKER_SCALE[0].toFixed(2)}, ${MARKER_SCALE[1].toFixed(2)}) : vec2(1.0);
        mat4 m = modelMatrix * instanceMatrix;
        vec3 mid = (m * vec4(0.0, 2.5 * mk.y, 0.0, 1.0)).xyz;
        float dist = max(1.0, distance(mid, cameraPosition));
        // Metres a pixel spans at the arch's distance.
        float px = 2.0 * dist / (projectionMatrix[1][1] * uViewH);
        float b = aState.x;
        // A taken arch swells as it answers; the next one breathes (under reduced motion neither moves: the light says it).
        float grow = 1.0 + 0.22 * b * (2.0 - b) * (1.0 - uCalm) + aInst.z * (1.0 - uCalm) * 0.025 * sin(uTime * 3.4 + aInst.w * 6.0);
        float top = topOf(fam);
        vec3 p;
        vec3 n = vec3(0.0, 0.0, 1.0);
        vPx = 0.0;
        vQ = vec2(0.0);
        if (part < 0.5) {
          // This instance's family only: the other families' tubes fall outside the clip volume.
          if (abs(aInfo.y - fam) > 0.5) {
            gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
            return;
          }
          float r = max(${TUBE.toFixed(2)}, 2.6 * px) * (1.0 + 0.5 * b) * (marker > 0.5 ? 1.5 : 1.0);
          n = aOff;
          p = vec3(position.xy * mk, 0.0) + aOff * r;
          vQ = vec2(aInfo.z, position.y * mk.y);
        } else if (part < 1.5) {
          // An empty lane has no medallion.
          if (aInst.y < -0.5 && marker < 0.5) {
            gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
            return;
          }
          // At least MEDAL_FLOOR_PX tall on screen up to MEDAL_CAP times its size: at speed the lens is wide (about 80
          // degrees), so a gate 120 m out is a few pixels a metre. As they grow the outer two step out sideways
          // (medalSpread), so the three never overlap however far off they stand.
          float half0 = ${MEDAL_HALF.toFixed(2)};
          float half1 = half0 * clamp(${(MEDAL_FLOOR_PX / 2).toFixed(1)} * px / half0, 1.0, ${MEDAL_CAP.toFixed(1)});
          vec2 hs = marker > 0.5 ? vec2(4.3, 0.85) : vec2(half1);
          float cy = marker > 0.5 ? ${(SQUARE_H * MARKER_SCALE[1]).toFixed(2)} - 0.55 : top + 0.35 + half1;
          float spread = marker > 0.5 ? 0.0 : aState.w * max(0.0, 2.0 * half1 + ${MEDAL_GAP.toFixed(2)} - ${LANE_W.toFixed(2)});
          p = vec3(position.x * hs.x + spread, cy + position.y * hs.y, 0.14);
          vQ = position.xy;
          vPx = px / hs.y;
        } else {
          // The veil fills the opening, from the snow to the crown. A marker's is two columns of light standing
          // ${MARKER_BEAM} m over its posts, so the finish of the race is found over a crest from its start (in metres).
          if (marker > 0.5) {
            p = vec3(position.x * (${ARCH_HALF.toFixed(2)} * mk.x + 1.5), (position.y * 0.5 + 0.5) * ${MARKER_BEAM.toFixed(1)}, -0.06);
            vQ = p.xy;
            vPx = px;
          } else {
            p = vec3(position.x * ${ARCH_HALF.toFixed(2)} * mk.x, (position.y * 0.5 + 0.5) * top * mk.y, -0.06);
            vQ = vec2(position.x * ${ARCH_HALF.toFixed(2)}, (position.y * 0.5 + 0.5) * top);
          }
        }
        p.xy = vec2(p.x * grow, (p.y - 2.2 * mk.y) * grow + 2.2 * mk.y);
        vec4 wp = m * vec4(p, 1.0);
        vWorld = wp.xyz;
        vN = normalize(mat3(m) * n);
        vPart = part;
        vFam = fam;
        vMarker = marker;
        vGlyph = aInst.y;
        vState = aState;
        vNext = aInst.z;
        vSeed = aInst.w;
        vTint = aTint;
        vTop = top;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFog;
      uniform vec3 uSunDir;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uLow;
      uniform float uDeep;
      uniform float uCalm;
      uniform sampler2D uAtlas;
      uniform float uAtlasOn;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec2 vQ;
      varying float vPart;
      varying float vFam;
      varying float vMarker;
      varying float vGlyph;
      varying vec4 vState;
      varying float vNext;
      varying float vSeed;
      varying vec3 vTint;
      varying float vPx;
      varying float vTop;
      const vec3 SPEED = ${glsl(FAMILY_HEX.speed)};
      const vec3 STYLE = ${glsl(FAMILY_HEX.style)};
      const vec3 STYLE_DEEP = ${glsl(STYLE_DEEP_HEX)};
      const vec3 SURVIVAL = ${glsl(FAMILY_HEX.survival)};
      const vec3 INK = ${glsl('#121933')};
      const vec3 CREAM = ${glsl('#F5F3FF')};
      const vec3 GOLDW = ${glsl('#FFE08A')};
      const vec3 EMBER = ${glsl('#4A3436')};
      const vec3 DEEPGOLD = ${glsl('#D08A1E')};
      vec3 famCol(float f) { return f < 0.5 ? SPEED : (f < 1.5 ? mix(STYLE, STYLE_DEEP, uDeep) : SURVIVAL); }
      // The medallion's outline, a signed distance in its own units (about -1 inside to 0 on the edge).
      float medal(vec2 q, float f) {
        if (vMarker > 0.5) {
          vec2 d = abs(q) - vec2(0.97);
          return max(d.x, d.y);
        }
        if (f < 0.5) {
          // Pointed: straight sides, an equilateral crown.
          float side = max(abs(q.x) - 0.75, -(q.y + 0.92));
          float yb = -0.35;
          float arcs = max(length(q - vec2(-0.75, yb)), length(q - vec2(0.75, yb))) - 1.5;
          return q.y > yb ? max(side, arcs) : side;
        }
        if (f < 1.5) return length(q) - 0.94;
        vec2 d = abs(q) - vec2(0.88 - 0.22);
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.22;
      }
      // Inside the arch's opening (its own metres), for the veil.
      float opening(vec2 q, float f) {
        float a = ${ARCH_HALF.toFixed(2)};
        float y0 = ${POST_H.toFixed(2)};
        if (abs(q.x) > a) return 0.0;
        if (f < 0.5) return q.y < y0 ? 1.0 : step(max(length(q - vec2(a, y0)), length(q - vec2(-a, y0))), 2.0 * a);
        if (f < 1.5) return q.y < y0 ? 1.0 : step(length(q - vec2(0.0, y0)), a);
        return step(q.y, ${SQUARE_H.toFixed(2)});
      }
      void main() {
        vec3 fc = vMarker > 0.5 ? GOLDW : famCol(vFam);
        float burst = vState.x;
        float gutter = vState.y;
        float alpha = vState.z;
        vec3 dv = vWorld - cameraPosition;
        float d = length(dv);
        // A light holds through the fog better than paint does.
        float fogK = smoothstep(uFogNear, uFogFar, d) * 0.5;
        float breath = vNext * (uCalm > 0.5 ? 0.1 : 0.1 + 0.16 * sin(uTime * 3.4 + vSeed * 6.0));
        float lit = mix(0.62, 1.0, vNext) + breath;
        // The answer: up toward white in its own colour, then gone.
        float flare = clamp(burst * (1.0 - burst) * 4.0, 0.0, 1.0);
        float fade = 1.0 - burst * burst;
        vec3 col;
        float a;
        if (vPart < 0.5) {
          // Light, not a structure, painted in the gouache's three values: a lit side toward the key light, the body,
          // and a shade side in a deeper, cooler step of its own colour, with a thin darker edge where the tube turns
          // away so it holds on white snow. Its foot rises out of the snow as light: nothing solid stands on the line.
          vec3 nn = normalize(vN);
          float face = abs(dot(nn, normalize(-dv)));
          float l = dot(nn, normalize(uSunDir));
          vec3 litC = mix(fc, vec3(1.0, 0.98, 0.92), 0.42);
          vec3 shadeC = mix(fc * 0.5, vec3(0.16, 0.18, 0.34), 0.25);
          if (uLow > 0.5) {
            // Low: two flat values, the lit side and the body.
            col = mix(fc, litC, step(0.3, l));
          } else {
            col = mix(shadeC, fc, smoothstep(-0.3, -0.12, l));
            col = mix(col, litC, smoothstep(0.22, 0.4, l));
            col = mix(col * 0.78, col, smoothstep(0.08, 0.3, face));
            float run = pow(max(0.0, cos((vQ.x - uTime * 0.18 - vSeed) * 6.2831)), 14.0) * (1.0 - uCalm);
            col = mix(col, mix(fc, vec3(1.0), 0.55), run * 0.35 * vNext);
          }
          col *= lit;
          a = smoothstep(-0.1, 1.3, vQ.y);
        } else if (vPart < 1.5) {
          vec2 q = vQ;
          float sd = medal(q, vFam);
          float aa = max(vPx * 1.5, 0.02);
          float inside = 1.0 - smoothstep(-aa, aa, sd);
          if (inside <= 0.0) discard;
          if (vMarker > 0.5) {
            // A finish banner: ink and cream checks, a band of the rival's colour along its foot.
            float ck = mod(floor((q.x + 1.0) * 9.0) + floor((q.y + 1.0) * 1.5), 2.0);
            col = mix(INK, CREAM, ck);
            col = mix(col, vTint, step(q.y, -0.55));
            col = mix(col, vTint * 1.4 + 0.25, flare);
            a = inside * 0.95;
          } else {
            float rw = max(0.09, vPx * 2.6);
            float rim = smoothstep(-rw - aa, -rw + aa, sd);
            col = mix(INK, fc * lit, rim);
            float ga = 0.0;
            if (uAtlasOn > 0.5 && vGlyph >= 0.0) {
              vec2 g = q / 1.14 + 0.5;
              if (g.x > 0.0 && g.x < 1.0 && g.y > 0.0 && g.y < 1.0) {
                float cx = mod(vGlyph, ${GLYPH_COLS.toFixed(1)});
                float cy = floor(vGlyph / ${GLYPH_COLS.toFixed(1)});
                vec2 uv = vec2((cx + g.x) / ${GLYPH_COLS.toFixed(1)}, 1.0 - (cy + 1.0 - g.y) / ${GLYPH_ROWS.toFixed(1)});
                ga = texture2D(uAtlas, uv).a;
              }
            }
            col = mix(col, mix(fc, vec3(1.0), 0.4) * lit, ga * (1.0 - rim));
            a = inside * mix(0.8, 1.0, max(rim, ga));
          }
        } else {
          // The veil: the family's light filling the opening, stronger toward the crown. The marker's columns
          // of light: soft beams over its posts that thin away upward, held a few pixels wide however far off.
          if (vMarker > 0.5) {
            float post = ${(ARCH_HALF * MARKER_SCALE[0]).toFixed(2)};
            float w = max(0.35, 2.5 * vPx);
            float dx = (abs(vQ.x) - post) / w;
            float beam = exp(-dx * dx) * (1.0 - smoothstep(${(MARKER_BEAM * 0.6).toFixed(1)}, ${MARKER_BEAM.toFixed(1)}, vQ.y));
            if (beam < 0.01) discard;
            // (A deep gold edge round a gold-white core, as the sky gates' amber edge, so the column holds against a bright
            // sky and white snow, where pale light alone vanished.)
            col = mix(DEEPGOLD, mix(fc, vec3(1.0), 0.35), smoothstep(0.35, 0.05, dx * dx)) * (1.0 + 2.0 * flare);
            a = beam * 0.8 * (1.0 + flare);
            col = mix(col, mix(vTint, vec3(1.0), 0.4) * 1.6, flare);
            a *= alpha * (1.0 - burst * burst);
            col = mix(col, uFog, fogK * 0.6);
            gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb * a, a);
            return;
          }
          float inside = opening(vQ, vFam);
          if (inside <= 0.0) discard;
          float h = clamp(vQ.y / vTop, 0.0, 1.0);
          float k = uLow > 0.5 ? 0.12 : 0.05 + 0.15 * h * h;
          col = fc * lit;
          a = k * (vMarker > 0.5 ? 0.5 : 1.0) * (0.6 + 0.4 * lit) * (1.0 + 2.0 * flare);
        }
        col = mix(col, mix(fc, vec3(1.0), 0.6) * 2.0, flare);
        // The other arches gutter to an ember and thin away.
        col = mix(col, EMBER, gutter);
        a *= alpha * fade * (1.0 - 0.75 * gutter);
        // Whatever the lens passes through dissolves over its last metres (ART.md 14), so the take never fills the frame.
        a *= smoothstep(4.0, 16.0, d);
        col = mix(col, uFog, fogK);
        gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb * a, a);
      }
    `,
  });
}

/** What one arch shows this frame (pure, for tests): next 1 for the gate to be taken next; burst and gutter are the
 *  taken arch's answer and the others' guttering (0 to 1); alpha the fade in from far off. Null: not drawn. */
export function archState(gate: Pick<CharmGate, 'z' | 'offers' | 'lane'>, lane: number, isNext: boolean, riderZ: number, sinceTaken: number): { next: number; burst: number; gutter: number; alpha: number } | null {
  const id = gate.offers[lane];
  if (id < 0) return null;
  const dz = gate.z - riderZ;
  if (dz > DRAW_AHEAD || dz < -DRAW_BEHIND) return null;
  const alpha = Math.max(0, Math.min(1, (DRAW_AHEAD - dz) / 60));
  if (gate.lane >= 0) {
    if (gate.lane === lane) {
      const b = Math.min(1, sinceTaken / BURST_S);
      return b >= 1 ? null : { next: 0, burst: b, gutter: 0, alpha };
    }
    const g = Math.min(1, sinceTaken / GUTTER_S);
    return sinceTaken > BURST_S ? null : { next: 0, burst: 0, gutter: g, alpha };
  }
  return { next: isNext ? 1 : 0, burst: 0, gutter: 0, alpha };
}

/** The line a gate's three offers are named in as it comes up (left to right, as the arches stand). */
export function offersLine(offers: readonly number[], name: (id: number) => string): string {
  return offers
    .filter((id) => id >= 0)
    .map(name)
    .join('  ·  ');
}

interface Host {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
}

/** Every charm gate in reach and a showdown's marker, in one instanced draw (see the header). */
export class CharmGates {
  mesh: InstancedMesh | null = null;
  private mat: ShaderMaterial | null = null;
  private atlas: CanvasTexture | null = null;
  private inst!: InstancedBufferAttribute;
  private state!: InstancedBufferAttribute;
  private tint!: InstancedBufferAttribute;
  private stage: 'out' | 'waiting' | 'in' = 'out';
  host: Host | null = null;
  private course: Course | null = null;
  private low = false;
  private viewH = 720;
  private clock = 0;
  /** When each gate was first seen taken (the clock), by gate index. */
  private readonly takenAt = new Map<number, number>();
  private marker: { z: number; tint: Color; endAt: number; won: boolean | null } | null = null;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly v = new Vector3();
  private readonly one = new Vector3(1, 1, 1);
  private readonly up = new Vector3(0, 1, 0);

  setCourse(c: Course): void {
    this.course = c;
    this.deep = c.biome === 'blossom';
    if (this.mat) this.mat.uniforms.uDeep.value = this.deep ? 1 : 0;
    this.reset();
  }

  /** A new run: every gate stands again, no marker. */
  reset(): void {
    this.takenAt.clear();
    this.marker = null;
  }

  /** Sakura's shade is lavender: there the style family takes its deeper violet. */
  private deep = false;

  setLow(low: boolean): void {
    this.low = low;
    if (this.mat) this.mat.uniforms.uLow.value = low ? 1 : 0;
  }

  /** The viewport's height in CSS pixels: the medallions' and the tubes' floors are what the eye sees, on any tier's
   *  pixel ratio (in device pixels High's supersampled canvas never reached the floor). */
  setViewport(px: number): void {
    this.viewH = Math.max(1, px);
    if (this.mat) this.mat.uniforms.uViewH.value = this.viewH;
  }

  /** A showdown has started: its marker stands at z (sim metres) with a band of the rival's colour. */
  showdown(z: number, tint: Color): void {
    this.marker = { z, tint: tint.clone(), endAt: -1, won: null };
  }

  /** It is decided: the marker bursts in the winner's colour. */
  showdownEnd(winner: Color, won: boolean): void {
    if (!this.marker) return;
    this.marker.tint.copy(winner);
    this.marker.endAt = this.clock;
    this.marker.won = won;
  }

  /** Builds the mesh on idle time after the first frame and adds it to the scene once its program is compiled. */
  private join(): void {
    const host = this.host;
    if (this.stage !== 'out' || !host) return;
    this.stage = 'waiting';
    const go = (): void => {
      const geo = charmGateGeometry();
      this.inst = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 4), 4).setUsage(DynamicDrawUsage);
      this.state = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 4), 4).setUsage(DynamicDrawUsage);
      this.tint = new InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3), 3).setUsage(DynamicDrawUsage);
      geo.setAttribute('aInst', this.inst);
      geo.setAttribute('aState', this.state);
      geo.setAttribute('aTint', this.tint);
      const mat = gateMaterial();
      mat.uniforms.uLow.value = this.low ? 1 : 0;
      mat.uniforms.uDeep.value = this.deep ? 1 : 0;
      mat.uniforms.uViewH.value = this.viewH;
      const cv = drawGlyphAtlas();
      if (cv) {
        const tex = new CanvasTexture(cv);
        tex.colorSpace = NoColorSpace;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.anisotropy = 4;
        this.atlas = tex;
        mat.uniforms.uAtlas.value = tex;
        mat.uniforms.uAtlasOn.value = 1;
      }
      this.mat = mat;
      const mesh = new InstancedMesh(geo, mat, MAX_INSTANCES);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      // Drawn after the world's other light, as the sky gates are.
      mesh.renderOrder = 2;
      mesh.name = 'charmGates';
      const done = (): void => {
        this.mesh = mesh;
        host.scene.add(mesh);
        this.stage = 'in';
      };
      // (Compiled with the mesh visible, then hidden until a gate is in reach.)
      mesh.visible = true;
      host.renderer.compileAsync(mesh, host.camera, host.scene).then(done, done);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 400);
  }

  /** This frame: `gates` the run's (sim.charmGates; null outside a run), the rider's z, reduced motion. */
  update(dt: number, gates: readonly CharmGate[] | null, riderZ: number, calm: boolean): void {
    this.clock += dt;
    if (this.stage === 'out') this.join();
    const mesh = this.mesh;
    const mat = this.mat;
    const c = this.course;
    if (!mesh || !mat || !c) return;
    mat.uniforms.uCalm.value = calm ? 1 : 0;
    let n = 0;
    const inst = this.inst.array as Float32Array;
    const st = this.state.array as Float32Array;
    const tn = this.tint.array as Float32Array;
    if (gates) {
      let next = -1;
      for (const g of gates) {
        if (g.lane < 0 && g.offers.some((o) => o >= 0)) {
          next = g.index;
          break;
        }
      }
      for (const g of gates) {
        if (g.lane >= 0 && !this.takenAt.has(g.index)) this.takenAt.set(g.index, this.clock);
        const since = g.lane >= 0 ? this.clock - (this.takenAt.get(g.index) ?? this.clock) : 0;
        // The run's line through the gate: the arches face along it.
        const slope = (c.safeX(g.z + 4) - c.safeX(g.z - 4)) / 8;
        this.q.setFromAxisAngle(this.up, Math.atan2(-slope, 1));
        for (let lane = 0; lane < 3; lane++) {
          const a = archState(g, lane, g.index === next, riderZ, since);
          if (!a || n >= MAX_INSTANCES - 1) continue;
          const id = g.offers[lane];
          const x = laneX(g.x, lane);
          this.m.compose(this.v.set(x, c.ground(x, g.z), -g.z), this.q, this.one);
          mesh.setMatrixAt(n, this.m);
          inst[n * 4] = FAMILY_INDEX[charmFamily(id)];
          inst[n * 4 + 1] = id;
          inst[n * 4 + 2] = a.next;
          inst[n * 4 + 3] = ((g.index * 0.618 + lane * 0.29) % 1 + 1) % 1;
          st[n * 4] = a.burst;
          st[n * 4 + 1] = a.gutter;
          st[n * 4 + 2] = a.alpha;
          // (The arch's place in the gate, -1 left to 1 right: its medallion steps out that way as it grows.)
          st[n * 4 + 3] = lane - 1;
          tn[n * 3] = tn[n * 3 + 1] = tn[n * 3 + 2] = 1;
          n++;
        }
      }
      // The showdown's marker, until its burst is over.
      const mk = this.marker;
      if (mk) {
        const t = mk.endAt >= 0 ? (this.clock - mk.endAt) / MARKER_BURST_S : 0;
        if (t >= 1) this.marker = null;
        else {
          const x = c.safeX(mk.z);
          const slope = (c.safeX(mk.z + 4) - c.safeX(mk.z - 4)) / 8;
          this.q.setFromAxisAngle(this.up, Math.atan2(-slope, 1));
          this.m.compose(this.v.set(x, c.ground(x, mk.z), -mk.z), this.q, this.one);
          mesh.setMatrixAt(n, this.m);
          inst[n * 4] = 3;
          inst[n * 4 + 1] = -1;
          inst[n * 4 + 2] = mk.endAt >= 0 ? 0 : 1;
          inst[n * 4 + 3] = 0.37;
          st[n * 4] = mk.endAt >= 0 ? Math.min(1, t) : 0;
          st[n * 4 + 1] = 0;
          st[n * 4 + 2] = Math.max(0, Math.min(1, (DRAW_AHEAD + 200 - (mk.z - riderZ)) / 60));
          st[n * 4 + 3] = 0;
          tn[n * 3] = mk.tint.r;
          tn[n * 3 + 1] = mk.tint.g;
          tn[n * 3 + 2] = mk.tint.b;
          n++;
        }
      }
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      this.inst.needsUpdate = true;
      this.state.needsUpdate = true;
      this.tint.needsUpdate = true;
    }
  }

  /** The world position (three.js) of a lane's arch crown at a gate, for the effects of taking it. */
  crown(g: CharmGate, lane: number, out: Vector3): Vector3 {
    const c = this.course;
    const x = laneX(g.x, lane);
    const fam = FAMILY_INDEX[charmFamily(g.offers[lane] ?? 0)];
    return out.set(x, (c ? c.ground(x, g.z) : 0) + ARCH_TOP[fam] - 0.3, -g.z);
  }

  /** For play-tests: what the draw holds now. */
  get drawn(): { in: boolean; count: number } {
    return { in: this.stage === 'in', count: this.mesh?.visible ? this.mesh.count : 0 };
  }

  dispose(): void {
    this.mesh?.geometry.dispose();
    this.mat?.dispose();
    this.atlas?.dispose();
  }
}

/** The lanes' half spread: the outer arches' outer posts stand this far either side of the safe line. */
export const GATE_SPAN = LANE_W + ARCH_HALF;
