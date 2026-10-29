import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicMaterial, NormalBlending, Object3D, PerspectiveCamera, ShaderMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import { Course } from '../sim/course';
import type { GhostKind } from '../ui/contract';
import type { GhostPose } from '../game/ghosts';
import { IDLE_FEEL, type Beat, type Feel, type GhostRole } from '../game/beats';
import { GHOST_MOOD_GLSL, ghostStencil, makeGhostMaterial, makeToonMaterial, shared } from './materials';
import { ghostRiderGeometry } from './meshes';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Trail } from './trails';
import { GHOST_PATH } from '../ui/icons';
import { fmt, NBSP } from '../ui/fmt';
import { graveCopy, type GravePlace } from './graves';

// Spectral ghosts: one glass silhouette per rider (a depth prepass, then the glass), a wisp ribbon
// tail, a kind-tinted shadow that sells their height, a luminous groove line showing their line, a
// floating name pill, and a lantern marker planted where they crashed (ART.md section 6).
//
// The fun pass: the tags react to the race. The duel ghost's ring beats at 1.2 Hz (Feel.duelId,
// contract C11) and the start-line call pings it; a ghost that stomps a perfect landing near you rings
// its tag once, and one that lands a trick swaps its name for the trick ('Backflip') for 0.9 s (never
// the rival's under your own fresh stamp); a grudge on a three-run streak reads 'nemesis'; and your best
// and a friend's line on the snow carry a tag with the distance ('Your best · 1,240 m'). A graveyard's
// cairn on the bank carries its name over how many fell there ('4 ghosts fell here').

export const GHOST_COLORS: Record<GhostKind, string> = {
  pool: '#8FF3E4',
  daily: '#8FF3E4',
  friend: '#8FF3E4',
  you: '#FFE08A',
  grudge: '#FF5A7A',
};

type Rect = { x0: number; y0: number; x1: number; y1: number };

/** One floating pill: a ghost's name tag or its crash marker's tag. */
interface Tag {
  el: HTMLDivElement;
  /** Placement priority: special kinds, then pool ghosts, then crash markers. */
  prio: number;
  x: number;
  y: number;
  scale: number;
  /** Distance to the camera (placement order within a priority). */
  d: number;
  /** Distance to the player (which pool ghosts earn a tag). */
  dp: number;
  ok: boolean;
  want: boolean;
  /** Seconds it has been wanted without a break (a tag shows only once it has settled). */
  held: number;
  a: number;
  w: number;
  h: number;
  op: string;
  tx: number;
  ty: number;
  ts: number;
  stacked: boolean;
  /** Collapsed to a small kind-coloured dot above its ghost (it would overlap another pill, or sit by
   *  a callout or the landing stamp). */
  dot: boolean;
  /** This frame's placement wants the dot. */
  wantDot: boolean;
  /** Pulled in from the screen edge while its anchor is on screen, rather than hidden (a landmark on
   *  the bank, which a phone's narrow frame puts right at its edge). */
  pull?: boolean;
}

interface Item {
  id: number;
  kind: GhostKind;
  name: string;
  mesh: Mesh;
  mat: ShaderMaterial;
  depth: ShaderMaterial;
  trail: Trail;
  tag: Tag;
  marker: Object3D | null;
  markTag: Tag | null;
  wasGrounded: boolean;
  fade: number;
  /** Whether the name tag is wanted (with hysteresis, so a ghost at the edge of a fade never flickers it). */
  tagOn: boolean;
  /** Linear kind colour, and its deep shade for the shadow. */
  col: Color;
  deep: Color;
  /** Recent wisp anchor positions (a ring, newest at hHead - 1). */
  hist: Float32Array;
  hHead: number;
  hCount: number;
  /** 0 on the snow, easing to 1 in the air (the wisp's droop). */
  air: number;
  /** Who leads by more than 0.8 m (the race's own pass rule): 1 you, -1 the ghost, 0 not yet. */
  side: number;
  /** Seconds left of a pass beat (you passed it or it passed you): it may thin, never vanish. */
  passT: number;
  /** The tag's placement priority when it is not the rival the HUD names. */
  basePrio: number;
  /** The tag carries the rival ring (contract C11). */
  ringed: boolean;
  /** Eased dimming (1 none) for the one further back where two ghosts overlap on screen. */
  dim: number;
  /** How much of the ghost shows this frame after every fade (0 to 1). */
  shown: number;
  /** This frame's chest on screen (CSS px), its radius there and its depth from the lens; sr 0 when
   *  the ghost is not drawn. */
  sx: number;
  sy: number;
  sr: number;
  sd: number;
  /** The trick word swapped in for the name (created on the first swap), seconds left of the swap,
   *  and the name pill's measured size to restore. */
  tw: HTMLSpanElement | null;
  trickT: number;
  nameW: number;
  nameH: number;
  /** Seconds left of the start-line call's ring ping, and of a perfect landing's stomp ping. */
  callT: number;
  stompT: number;
  /** The ring classes as written (duel heartbeat, call ping, stomp ping). */
  duelOn: boolean;
  callOn: boolean;
  stompOn: boolean;
}

/** How long a ghost's trick word replaces its name, and how often any tag may whisper one. */
const TRICK_HOLD = 0.9;
const TRICK_GAP = 1.5;
/** A stamp this recent keeps the rival's tag as it is. */
const STAMP_QUIET = 1.5;
/** The start-line call's ring ping (the HUD's pill call lasts as long). */
const CALL_HOLD = 2.6;
/** A ghost's perfect landing near you rings its tag once (the world drops a ring of motes there). */
const STOMP_HOLD = 0.55;
/** The best and friend line tags show from this far (metres from the lens). */
const LINE_RANGE = 120;
/** A graveyard's tag shows from this far: a landmark, so further out than a single crash marker's. */
const GRAVE_RANGE = 95;

/** How long a pass beat keeps the ghost in it on screen (about as long as the HUD's pass toast). */
const PASS_HOLD = 2.6;

// Smooth normals make the fresnel glow read as soft spectral light instead of glass facets. Two
// groups over the same triangles: the depth prepass (material 0) draws right before the glass
// (material 1), so each ghost is one silhouette while ghosts behind it still show through.
const riderGeo = (() => {
  const geo = ghostRiderGeometry();
  geo.deleteAttribute('color');
  geo.deleteAttribute('normal');
  const merged = mergeVertices(geo, 0.02);
  merged.computeVertexNormals();
  merged.addGroup(0, Infinity, 0);
  merged.addGroup(0, Infinity, 1);
  return merged;
})();
let markerGeo: BufferGeometry | null = null;

function markerGeometry(): BufferGeometry {
  if (!markerGeo) {
    const parts = [new CylinderGeometry(0.05, 0.06, 1.5, 6).translate(0, 0.75, 0), new BoxGeometry(0.26, 0.06, 0.26).translate(0, 1.5, 0)].map((g) => {
      const n = g.toNonIndexed();
      n.deleteAttribute('uv');
      const count = n.getAttribute('position').count;
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) col.set([0.3, 0.22, 0.2], i * 3);
      n.setAttribute('color', new BufferAttribute(col, 3));
      n.computeVertexNormals();
      return n;
    });
    markerGeo = mergeGeometries(parts);
  }
  return markerGeo!;
}

/** Depth only, pushed back a hair so the glass pass's front surface always wins LEQUAL. The
 *  dissolved lower body (legs and sled, all but invisible glass) writes no depth: an invisible sled
 *  would otherwise cut a sled-shaped hole in every wisp, spark and faint ghost drawn behind it. */
function makeDepthMaterial(): ShaderMaterial {
  return withStencil(new ShaderMaterial({
    transparent: true,
    colorWrite: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
    uniforms: { uCut: { value: 0.36 } },
    vertexShader: /* glsl */ `
      varying float vH;
      void main() {
        vH = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCut;
      varying float vH;
      void main() {
        if (vH < uCut) discard;
        gl_FragColor = vec4(0.0);
      }
    `,
  }));
}

/** Contract C10 on a ghost layer: it draws only off the rider's own pixels (see ghostStencil). */
function withStencil<M extends ShaderMaterial | MeshBasicMaterial>(m: M): M {
  ghostStencil(m);
  return m;
}

// Wisp ribbon tails: one merged, camera-facing strip per ghost, rebuilt in place every frame. The
// body dissolves from the chest down, and the wisp carries on from the waist: a luminous ribbon that
// streams out to one side and flutters, so it reads from the chase camera even at thumbnail size.
// The tail follows the ghost's horizontal path only and is at most 2.6 m long, so a ghost in the air
// or mid-flip trails a ribbon behind it, never a column of smoke above it.
const WISP_SEG = 12;
const WISP_PTS = WISP_SEG + 1;
const HIST = 32;
const WISP_LIFT = 0.5;
const WISP_MAX = 2.6;
/** The aura's centre (the chest, in the rider model) and radius: a soft glow round head and shoulders. */
const AURA_LIFT = 0.98;
const AURA_R = 0.82;

function wispMaterial(): ShaderMaterial {
  return withStencil(new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // The strip is rebuilt facing the camera, but its winding flips with the side it is seen from.
    side: DoubleSide,
    blending: NormalBlending,
    premultipliedAlpha: true,
    uniforms: {
      uTime: shared.uTime,
      uSnowLit: shared.uSnowLit,
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uGlow: { value: 1 },
      uMood: { value: 0 },
      // Clip-space y where the ribbon starts and finishes fading out under the top HUD row.
      uTop: { value: new Vector2(0.7, 0.8) },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aUv;
      attribute vec4 aCol;
      varying vec2 vUv;
      varying vec4 vCol;
      varying vec3 vWorldPos;
      varying float vNdcY;
      void main() {
        vUv = aUv;
        vCol = aCol;
        vWorldPos = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        vNdcY = gl_Position.y / max(gl_Position.w, 1e-3);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSnowLit;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uGlow;
      uniform float uMood;
      uniform vec2 uTop;
      varying vec2 vUv;
      varying vec4 vCol;
      varying vec3 vWorldPos;
      varying float vNdcY;
      ${GHOST_MOOD_GLSL}
      void main() {
        float t = vUv.x;
        float across = abs(vUv.y);
        float soft = 1.0 - smoothstep(0.42, 1.0, across);
        float edge = smoothstep(0.1, 0.85, across);
        // A gentle noise scrolling back along the ribbon breaks it into wisps, more toward the tip:
        // a smooth ribbon read as an opaque mint blade.
        float nz = 0.65 * ghostNoise(vec2(t * 6.0 - uTime * 2.2, vUv.y * 1.3 + 3.7)) + 0.35 * ghostNoise(vec2(t * 13.0 - uTime * 3.6, vUv.y * 2.4));
        float breakup = mix(1.0, 0.3 + 0.9 * nz, smoothstep(0.05, 0.55, t));
        // It grows softly out of the dissolving body (no hard start at the waist) and fades to
        // nothing over the last 60% of its length.
        float a = soft * smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.4, 1.0, t)) * breakup * vCol.a;
        float d = length(cameraPosition - vWorldPos);
        float glowK = max(ghostBlaze(uGlow), uMood);
        a *= (1.0 - smoothstep(uFogNear, uFogFar * 1.4, d) * 0.7 * (1.0 - 0.92 * glowK)) * smoothstep(1.2, 3.6, d);
        // A ghost overhead never runs its tail through the race pills along the top of the screen.
        a *= 1.0 - smoothstep(uTop.x, uTop.y, vNdcY);
        float day = ghostDay(uSnowLit);
        // A hot core inside a saturated edge: by day the edge deepens toward teal (amber, crimson) so
        // the ribbon holds its own against bright snow, by night it is the plain kind colour.
        vec3 kc = ghostSat(vCol.rgb);
        vec3 deep = kc * kc * 0.5;
        vec3 core = mix(kc * 1.12, vec3(1.0), 0.14 * (1.0 - day));
        vec3 col = mix(core, mix(kc, deep, day), edge);
        // Hot in the whiteout; in the dark moods a little less, so the core keeps its mint.
        col *= 1.0 + max(ghostBlaze(uGlow) * 0.9, uMood * 0.45) * (1.0 - edge);
        // By day the ribbon tints the snow (a glassy veil, not paint); at night it is pure light.
        float cover = a * mix(0.12, 0.78, day);
        gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb * a, cover);
      }
    `,
  }));
}

/** Soft kind-tinted blob on the snow: a shadow by day, a pool of ghost light at night. */
function shadowMaterial(): ShaderMaterial {
  return withStencil(new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    side: DoubleSide,
    blending: NormalBlending,
    premultipliedAlpha: true,
    uniforms: { uSnowLit: shared.uSnowLit, uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      attribute vec2 aUv;
      attribute vec4 aCol;
      attribute vec3 aGlow;
      varying vec2 vUv;
      varying vec4 vCol;
      varying vec3 vGlow;
      varying vec3 vWorldPos;
      void main() {
        vUv = aUv;
        vCol = aCol;
        vGlow = aGlow;
        vWorldPos = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSnowLit;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying vec4 vCol;
      varying vec3 vGlow;
      varying vec3 vWorldPos;
      ${GHOST_MOOD_GLSL}
      void main() {
        float r = length(vUv);
        float a = smoothstep(1.0, 0.1, r) * vCol.a;
        a *= 1.0 - smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorldPos));
        float day = ghostDay(uSnowLit);
        vec3 col = mix(vGlow, vCol.rgb, day);
        gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb * a, a * day);
      }
    `,
  }));
}

/** A soft additive glow round each ghost's head and shoulders: spirit light, not a glass statue.
 *  Faint by day (a breath of mint where the head meets the sky), a real halo at night and in the
 *  glowing moods. Depth tested, so the rider in front of a ghost always hides it. */
function auraMaterial(): ShaderMaterial {
  return withStencil(new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uSnowLit: shared.uSnowLit, uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uMood: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aUv;
      attribute vec4 aCol;
      varying vec2 vUv;
      varying vec4 vCol;
      varying vec3 vWorldPos;
      void main() {
        vUv = aUv;
        vCol = aCol;
        vWorldPos = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSnowLit;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uMood;
      uniform float uGlow;
      varying vec2 vUv;
      varying vec4 vCol;
      varying vec3 vWorldPos;
      ${GHOST_MOOD_GLSL}
      void main() {
        // Taller than wide (head over shoulders), falling off smoothly to nothing at the quad's edge.
        vec2 q = vUv * vec2(1.25, 1.0);
        float r2 = dot(q, q);
        float g = exp(-r2 * 3.2) * (1.0 - smoothstep(0.55, 1.0, r2));
        float day = ghostDay(uSnowLit);
        float glowK = max(ghostBlaze(uGlow), uMood);
        float d = length(cameraPosition - vWorldPos);
        float k = mix(0.55, 0.16, day) * (1.0 + 1.4 * glowK) * (1.0 - smoothstep(uFogNear, uFogFar * 1.6, d) * (1.0 - 0.9 * glowK));
        vec3 col = ghostSat(vCol.rgb) * g * k * vCol.a;
        gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb, 1.0);
      }
    `,
  }));
}

const STYLE_ID = 'ghost-label-style';
function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
  .ghost-layer { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 2; }
  .ghost-label { position: absolute; left: 0; top: 0; padding: 3px 9px 4px; border-radius: 999px; transform-origin: 50% 100%;
    font: 800 12px/1.1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: 0.02em; white-space: nowrap;
    color: #121933; background: var(--c); opacity: 0; will-change: transform, opacity;
    box-shadow: 0 0 0 1px rgba(18, 25, 51, 0.3), 0 2px 6px rgba(18, 25, 51, 0.3), 0 0 14px color-mix(in srgb, var(--c) 55%, transparent); }
  .ghost-label::after { content: ''; position: absolute; left: 50%; bottom: -3px; width: 7px; height: 7px; margin-left: -3.5px;
    background: inherit; border-radius: 1px; transform: rotate(45deg); box-shadow: 1px 1px 0 rgba(18, 25, 51, 0.3); }
  .ghost-label.stacked::after { display: none; }
  .ghost-label.dot { width: ${DOT - 3}px; height: ${DOT - 3}px; padding: 0; overflow: hidden; color: transparent; font-size: 0; line-height: 0;
    box-shadow: 0 0 0 1.5px #121933, 0 0 8px color-mix(in srgb, var(--c) 65%, transparent); }
  .ghost-label.dot::after, .ghost-label.dot .tag { display: none; }
  .ghost-label.rival { box-shadow: 0 0 0 1.5px #121933, 0 0 0 3.5px var(--c), 0 2px 8px rgba(18, 25, 51, 0.35), 0 0 16px color-mix(in srgb, var(--c) 60%, transparent); }
  .ghost-label.marker { background: #121933; color: var(--c); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 55%, transparent), 0 2px 6px rgba(18, 25, 51, 0.3); font-weight: 700; }
  .ghost-label .tag { font-size: 11px; opacity: 0.9; margin-left: 5px; text-transform: uppercase; letter-spacing: 0.05em; }
  .ghost-label .tw { display: none; font-style: italic; }
  .ghost-label.trick .nm, .ghost-label.trick .tag { display: none; }
  .ghost-label.trick .tw { display: inline-block; animation: ghost-trick 0.22s cubic-bezier(0.2, 0.9, 0.2, 1.1) both; }
  @keyframes ghost-trick { 0% { opacity: 0; transform: scale(0.55); } 60% { opacity: 1; transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes ghost-trick-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
  .ghost-label::before { content: ''; position: absolute; inset: -5px; border-radius: 999px; border: 2px solid var(--c); opacity: 0; pointer-events: none; }
  .ghost-label.duel::before { animation: ghost-ring 0.833s ease-out infinite; }
  .ghost-label.call::before { animation: ghost-ring-call 0.866s ease-out 3; }
  .ghost-label.stomp::before { animation: ghost-ring-stomp ${STOMP_HOLD}s cubic-bezier(0.2, 0.8, 0.2, 1) 1 both; }
  .ghost-label.dot::before { display: none; }
  @keyframes ghost-ring { 0% { opacity: 0.95; transform: scale(1); } 70% { opacity: 0; transform: scale(1.18, 1.55); } 100% { opacity: 0; transform: scale(1.18, 1.55); } }
  @keyframes ghost-ring-call { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.32, 1.9); } }
  @keyframes ghost-ring-stomp { 0% { opacity: 1; transform: scale(0.92); } 100% { opacity: 0; transform: scale(1.45, 2.2); } }
  @keyframes ghost-ring-out { 0% { opacity: 1; } 100% { opacity: 0; } }
  .ghost-label.line { background: #121933; color: var(--c); font-weight: 800; box-shadow: inset 0 0 0 1.5px var(--c), 0 2px 6px rgba(18, 25, 51, 0.35), 0 0 12px color-mix(in srgb, var(--c) 40%, transparent); }
  .ghost-label.grave { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 11px 5px; border-radius: 9px; text-align: center; }
  .ghost-label.grave .gn { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
  .ghost-label.grave .gf { font-size: 11px; font-weight: 650; letter-spacing: 0.01em; color: #F5F3FF; }
  @media (prefers-reduced-motion: reduce) {
    .ghost-label.trick .tw { animation-name: ghost-trick-fade; animation-timing-function: linear; }
    .ghost-label.duel::before, .ghost-label.call::before { animation: none; opacity: 1; transform: none; }
    .ghost-label.stomp::before { animation: ghost-ring-out ${STOMP_HOLD}s linear 1 both; transform: none; }
  }
  .ghost-rival { position: absolute; left: 0; top: 0; opacity: 0; will-change: transform, opacity; }
  .ghost-rival .plate { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 11px 0 7px; border-radius: 999px;
    background: #121933; color: #F5F3FF; transform-origin: 50% 50%;
    font: italic 800 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap;
    box-shadow: inset 0 0 0 1.5px var(--c), 0 2px 8px rgba(18, 25, 51, 0.45), 0 0 12px color-mix(in srgb, var(--c) 45%, transparent); }
  .ghost-rival .gap { letter-spacing: 0.01em; }
  .ghost-rival svg { flex: none; color: var(--c); }
  .ghost-rival .gh { width: 16px; height: 16px; }
  .ghost-rival .arrow { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; overflow: visible; }
  .ghost-rival.close .plate { animation: ghost-rival-pulse 0.9s ease-in-out infinite;
    box-shadow: inset 0 0 0 2px var(--c), 0 2px 8px rgba(18, 25, 51, 0.45), 0 0 20px color-mix(in srgb, var(--c) 75%, transparent); }
  @keyframes ghost-rival-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
  @media (prefers-reduced-motion: reduce) { .ghost-rival.close .plate { animation: none; } }
  `;
  document.head.appendChild(s);
}

/** Pool ghosts beyond the nearest few keep their bodies but lose their tags. */
const POOL_TAGS = 3;
/** A collapsed tag's dot (CSS px, its ring included). */
const DOT = 12;
const TAG_RANGE = 140;
const MARK_RANGE = 70;

const tmp = new Vector3();
const tmpP = new Vector3();
const tmpF = new Vector3();
const tmpA = new Vector3();
const UP = new Vector3(0, 1, 0);
const grad = { x: 0, z: 0 };

const smooth01 = (x: number) => {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * (3 - 2 * k);
};
const mix01 = (a: number, b: number, k: number) => a + (b - a) * k;

function newTag(el: HTMLDivElement, prio: number): Tag {
  return { el, prio, x: 0, y: 0, scale: 1, d: 0, dp: 0, ok: false, want: false, held: 0, a: 0, w: 0, h: 0, op: '0', tx: -1e9, ty: -1e9, ts: -1e9, stacked: false, dot: false, wantDot: false };
}

export class GhostVisuals {
  readonly root = new Object3D();
  readonly layer: HTMLDivElement;
  private items: Item[] = [];
  private glow = 1;
  labels = true;
  /** The title's attract reel: ghosts may race closer beside the hero before they fade. */
  reel = false;
  private lanternMat = withStencil(new MeshBasicMaterial({ color: '#8FF3E4', transparent: true, blending: AdditiveBlending, depthWrite: false }));
  private markerMat = makeToonMaterial({ coolShade: 0.5 });
  private lanternGeo = new SphereGeometry(0.16, 10, 8);
  private wispMat = wispMaterial();
  private shadowMat = shadowMaterial();
  private auraMat = auraMaterial();
  private wisp: Mesh | null = null;
  private shadow: Mesh | null = null;
  private aura: Mesh | null = null;
  /** 0 to 1: how much brighter ghosts glow in this mood (night, a dark dusk sky, the whiteout). */
  private mood = 0;
  private lastTime = NaN;
  private dt = 0;
  // Reused every frame: label candidates, placed rects (x0, y0, x1, y1).
  private cands: Tag[] = [];
  private pool: Tag[] = [];
  private rects = new Float32Array(64 * 4);
  /** How many of `rects` are placed this frame (the first is the rider's). */
  private nr = 0;
  /** Scratch: one wisp centre line. */
  private wc = new Float32Array(WISP_PTS * 3);
  private riderRect: Rect = { x0: -1, y0: -1, x1: -1, y1: -1 };
  private viewW = 0;
  private byPrio = (a: Tag, b: Tag) => a.prio - b.prio || a.d - b.d;
  private byPlayer = (a: Tag, b: Tag) => a.dp - b.dp;
  // The off-screen rival marker: an edge chevron pointing at the ghost the HUD's rival pill names.
  private rivalEl: HTMLDivElement;
  private rivalChev: SVGElement;
  private rivalGap: HTMLSpanElement;
  /** The gap text on the chip (written only when it changes). */
  private rivalTxt = '';
  private rivalA = 0;
  private rivalOp = '';
  private rivalId = -1;
  /** The chip's width, measured once per viewport (0 until then). */
  private rivalW = 0;
  /** Safe-area insets (CSS px), read once per viewport size from a probe padded with env(). */
  private safe = { t: 0, r: 0, b: 0, l: 0 };
  private safeProbe: HTMLDivElement;
  private viewKey = -1;
  /** Seconds the rival has been off screen (it must stay off a moment before the marker shows). */
  private rivalOff = 0;
  private rivalX = 0;
  private rivalY = 0;
  private rivalAng = 0;
  /** Last written marker x, y, arrow angle and chip width (style writes only when they move). */
  private rivalM = new Float32Array([-1e9, -1e9, -1e9, -1]);
  /** The rival is within 3 m: the chip pulses. */
  private rivalClose = false;
  /** Seconds since the run began (passes in its first moments, off the start line, are no news). */
  private runT = 0;

  /** The top safe-area inset (CSS px), as of the last update. */
  get safeTop(): number {
    return this.safe.t;
  }

  constructor(
    private course: Course,
    host: HTMLElement,
  ) {
    injectStyle();
    this.layer = document.createElement('div');
    this.layer.className = 'ghost-layer';
    // World-space tags only echo the HUD's rival readout; a reader would hear a pile of moving names.
    this.layer.setAttribute('aria-hidden', 'true');
    host.appendChild(this.layer);
    this.safeProbe = document.createElement('div');
    this.safeProbe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    this.layer.appendChild(this.safeProbe);
    // A solid ink-navy plate with the ghost glyph in the ghost's kind colour (at partial opacity on
    // bright snow the old chip all but vanished) and the gap in metres (contract C12, the short form
    // "6 m": the arrow says which way, and without a distance a pin read as no threat or target), and
    // a filled arrowhead just outside it pointing at the ghost: a chevron rotated inside the plate
    // read as a checkmark. The outer box is placed; the plate inside it pulses while the rival is
    // within 3 m.
    this.rivalEl = document.createElement('div');
    this.rivalEl.className = 'ghost-rival';
    this.rivalEl.innerHTML =
      // The HUD rival pill's own ghost glyph, so the chip reads as that ghost.
      `<div class="plate"><svg class="gh" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${GHOST_PATH}"/></svg><span class="gap"></span></div>` +
      '<svg class="arrow" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 1.8 12.6 7 2.5 12.2 4.6 7Z" fill="currentColor" stroke="#121933" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    this.rivalChev = this.rivalEl.lastElementChild as SVGElement;
    this.rivalGap = this.rivalEl.querySelector('.gap') as HTMLSpanElement;
    this.layer.appendChild(this.rivalEl);
  }

  setCourse(course: Course): void {
    this.course = course;
    for (const it of this.items) it.trail.setCourse(course);
  }

  /** Blizzard makes ghosts blaze so they can guide you through the white. Called after the mood's
   *  palette is applied: on dark snow (Lantern Night, Haunted Hollow) and under a dark dusk sky (Comet
   *  Night) the ghosts glow brighter too, with longer, hotter wisps, so the one you are chasing stays
   *  a light in the frame instead of fading into the night with the ridges. */
  setGlow(g: number): void {
    this.glow = g;
    const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const night = 1 - smooth01((lum(shared.uSnowLit.value) - 0.25) / 0.4);
    const dusk = 1 - smooth01((lum(shared.uSkyZenith.value) - 0.012) / 0.03);
    this.mood = Math.min(1, Math.max(night, dusk, smooth01((g - 1.4) / 0.8)));
    this.wispMat.uniforms.uGlow.value = g;
    this.wispMat.uniforms.uMood.value = this.mood;
    this.auraMat.uniforms.uGlow.value = g;
    this.auraMat.uniforms.uMood.value = this.mood;
    for (const it of this.items) {
      it.mat.uniforms.uGlow.value = g;
      it.mat.uniforms.uMood.value = this.mood;
    }
  }

  /** This frame's feel (the duel ghost, the best and friend lines), for update(). */
  private feel: Feel = IDLE_FEEL;
  /** Seconds since the last landing stamp (stomp or finale stamp), and since the last trick whisper. */
  private sinceStamp = Infinity;
  private sinceTrick = Infinity;
  /** The ghost the HUD names (contract C11), as of the last update. */
  private rivalNow = -1;
  /** Tags for the gold-white band of your best and the mint band of a friend's line (contract C8,
   *  priority 2 like the crash markers), created on first use. */
  private bestTag: Tag | null = null;
  private friendTag: Tag | null = null;
  private bestTxt = '';
  private friendTxt = '';
  /** The side of the course each line tag stands on (-1 or 1): away from the rider, chosen while the
   *  tag is hidden and kept while it shows (the rider rides the middle, where a centred tag hid). */
  private bestSide = 1;
  private friendSide = -1;
  /** This run's graveyard tags over their cairns (contract C8: priority 2 like the crash markers, so
   *  never a dot; one touching the HUD or another tag hides). Kept across setField. */
  private graves: Array<{ tag: Tag; x: number; y: number; z: number }> = [];

  /** This run's graveyards (World.setGraveyards forwards the placed cairns, sim metres, with the tag's
   *  anchor height): a two-line tag at each, the place's name over '4 ghosts fell here', on every tier
   *  (Low draws no cairn). An empty list clears them. */
  setGraveyards(list: ReadonlyArray<GravePlace>): void {
    for (const g of this.graves) g.tag.el.remove();
    this.graves = list.map((g) => {
      const copy = graveCopy(g.name, g.fell);
      const l = document.createElement('div');
      l.className = 'ghost-label marker grave';
      l.style.setProperty('--c', GHOST_COLORS.pool);
      const nm = document.createElement('span');
      nm.className = 'gn';
      nm.textContent = copy.name;
      // A place's name is a proper noun; the count line is plain copy.
      nm.translate = false;
      const ln = document.createElement('span');
      ln.className = 'gf';
      ln.textContent = copy.line;
      l.append(nm, ln);
      this.layer.appendChild(l);
      const tag = newTag(l, 2);
      tag.pull = true;
      return { tag, x: g.x, y: g.y, z: g.z };
    });
  }

  /** This frame's named moments and feel: the start-line call pings its ghost's ring, a stamp quiets
   *  the rival's tag, and a ghost's trick near you swaps its name for the trick. Never keeps the list. */
  beats(list: readonly Beat[], feel: Feel): void {
    this.feel = feel;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.type === 'stomp' || (b.type === 'finale' && b.stamp)) {
        this.sinceStamp = 0;
        // The rival's tag never changes under the stamp: a swap on it ends now.
        const r = this.items.find((it) => it.id === this.rivalNow);
        if (r && r.trickT > 0) this.endTrick(r);
      } else if (b.type === 'raceCall') {
        const it = this.items.find((g) => g.id === b.ghost.id);
        if (it) it.callT = CALL_HOLD;
      } else if (b.type === 'ghostTrick') {
        const it = this.items.find((g) => g.id === b.ghost.id);
        if (!it) continue;
        // A perfect landing rings the tag once; a spin or a flip swaps the name for the trick. The
        // rival's tag stays as it is under a fresh stamp.
        if (it.id === this.rivalNow && this.sinceStamp < STAMP_QUIET) continue;
        if (b.quality === 'perfect') it.stompT = STOMP_HOLD;
        if (b.word) this.trick(it, b.word);
      }
    }
  }

  /** Swaps a ghost's name for its trick for 0.9 s: only while its full tag shows (never a dot), at
   *  most one whisper per 1.5 s across the field, and never on the rival under a fresh stamp. */
  private trick(it: Item, word: string): void {
    const t = it.tag;
    if (this.reel || !this.labels || this.sinceTrick < TRICK_GAP || it.trickT > 0) return;
    if (!it.tagOn || t.a !== 1 || t.dot || !t.w) return;
    if (it.id === this.rivalNow && this.sinceStamp < STAMP_QUIET) return;
    if (!it.tw) {
      it.tw = document.createElement('span');
      it.tw.className = 'tw';
      it.tw.translate = true;
      t.el.appendChild(it.tw);
    }
    it.tw.textContent = word;
    it.nameW = t.w;
    it.nameH = t.h;
    t.el.classList.add('trick');
    // The pill's new size (one layout read per whisper, at most one each 1.5 s).
    t.w = t.el.offsetWidth || t.w;
    t.h = t.el.offsetHeight || t.h;
    it.trickT = TRICK_HOLD;
    this.sinceTrick = 0;
  }

  private endTrick(it: Item): void {
    it.trickT = 0;
    if (!it.tag.el.classList.contains('trick')) return;
    it.tag.el.classList.remove('trick');
    if (it.nameW) {
      it.tag.w = it.nameW;
      it.tag.h = it.nameH;
    }
  }

  setField(list: Array<{ id: number; name: string; kind: GhostKind; role?: GhostRole; nemesis?: boolean }>): void {
    this.clear();
    for (const g of list) {
      const color = new Color(GHOST_COLORS[g.kind]);
      // Your best rides in gold-white glass; the others in the default spectral glass.
      const mat = makeGhostMaterial(color, g.kind === 'you' ? 1 : 0);
      mat.uniforms.uGlow.value = this.glow;
      mat.uniforms.uMood.value = this.mood;
      const depth = makeDepthMaterial();
      const mesh = new Mesh(riderGeo, [depth, mat]);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      const trail = new Trail(this.course, 360, 'ghost', color);
      const label = document.createElement('div');
      label.className = 'ghost-label';
      label.style.setProperty('--c', GHOST_COLORS[g.kind]);
      const nm = document.createElement('span');
      nm.className = 'nm';
      // Contract C7: your own best is never named by your own name, which read as a rival wearing it.
      if (g.kind === 'you') nm.textContent = 'Your best';
      else {
        nm.textContent = g.name;
        // Player names are proper nouns: keep auto-translate off them.
        label.translate = false;
      }
      label.appendChild(nm);
      if (g.kind !== 'pool' && g.kind !== 'you') {
        const tag = document.createElement('span');
        tag.className = 'tag';
        // A grudge that has beaten you three runs running is a nemesis (rose, like any grudge).
        tag.textContent = g.kind === 'grudge' ? (g.nemesis ? 'nemesis' : 'grudge') : g.kind === 'friend' ? 'challenge' : 'daily';
        label.appendChild(tag);
      }
      this.layer.appendChild(label);
      this.root.add(mesh, trail.mesh);
      const special = g.kind === 'you' || g.kind === 'grudge' || g.kind === 'friend';
      this.items.push({
        id: g.id,
        kind: g.kind,
        name: g.name,
        mesh,
        mat,
        depth,
        trail,
        tag: newTag(label, special ? 0 : 1),
        marker: null,
        markTag: null,
        wasGrounded: true,
        fade: 1,
        tagOn: false,
        col: color,
        deep: color.clone().multiply(color).multiplyScalar(0.22),
        hist: new Float32Array(HIST * 3),
        hHead: 0,
        hCount: 0,
        air: 0,
        side: 0,
        passT: 0,
        basePrio: special ? 0 : 1,
        ringed: false,
        dim: 1,
        shown: 0,
        sx: 0,
        sy: 0,
        sr: 0,
        sd: 0,
        tw: null,
        trickT: 0,
        nameW: 0,
        nameH: 0,
        callT: 0,
        stompT: 0,
        duelOn: false,
        callOn: false,
        stompOn: false,
      });
    }
    this.buildFx(list.length);
  }

  /** One merged mesh for every wisp tail and one for every shadow: two draw calls for the field. */
  private buildFx(n: number): void {
    if (n === 0) return;
    const wv = n * WISP_PTS * 2;
    const wgeo = new BufferGeometry();
    wgeo.setAttribute('position', new BufferAttribute(new Float32Array(wv * 3), 3).setUsage(DynamicDrawUsage));
    wgeo.setAttribute('aCol', new BufferAttribute(new Float32Array(wv * 4), 4).setUsage(DynamicDrawUsage));
    const wuv = new Float32Array(wv * 2);
    const widx: number[] = [];
    for (let g = 0; g < n; g++) {
      for (let k = 0; k < WISP_PTS; k++) {
        const v = (g * WISP_PTS + k) * 2;
        wuv.set([k / WISP_SEG, -1, k / WISP_SEG, 1], v * 2);
        if (k < WISP_SEG) widx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    wgeo.setAttribute('aUv', new BufferAttribute(wuv, 2));
    wgeo.setIndex(widx);
    this.wisp = new Mesh(wgeo, this.wispMat);
    this.wisp.frustumCulled = false;
    // After the bodies: the tail streams toward the chase camera, in front of the glass.
    this.wisp.renderOrder = 6;

    const sv = n * 4;
    const sgeo = new BufferGeometry();
    sgeo.setAttribute('position', new BufferAttribute(new Float32Array(sv * 3), 3).setUsage(DynamicDrawUsage));
    sgeo.setAttribute('aCol', new BufferAttribute(new Float32Array(sv * 4), 4).setUsage(DynamicDrawUsage));
    const glow = new Float32Array(sv * 3);
    const suv = new Float32Array(sv * 2);
    const sidx: number[] = [];
    for (let g = 0; g < n; g++) {
      const it = this.items[g];
      for (let k = 0; k < 4; k++) glow.set([it.col.r * 0.45, it.col.g * 0.45, it.col.b * 0.45], (g * 4 + k) * 3);
      suv.set([-1, -1, 1, -1, 1, 1, -1, 1], g * 8);
      const v = g * 4;
      sidx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    sgeo.setAttribute('aGlow', new BufferAttribute(glow, 3));
    sgeo.setAttribute('aUv', new BufferAttribute(suv, 2));
    sgeo.setIndex(sidx);
    this.shadow = new Mesh(sgeo, this.shadowMat);
    this.shadow.frustumCulled = false;
    this.shadow.renderOrder = 2;

    // The auras: one camera-facing quad per ghost (same corner layout as the shadows).
    const ageo = new BufferGeometry();
    ageo.setAttribute('position', new BufferAttribute(new Float32Array(sv * 3), 3).setUsage(DynamicDrawUsage));
    ageo.setAttribute('aCol', new BufferAttribute(new Float32Array(sv * 4), 4).setUsage(DynamicDrawUsage));
    ageo.setAttribute('aUv', new BufferAttribute(suv.slice(), 2));
    ageo.setIndex(sidx);
    this.aura = new Mesh(ageo, this.auraMat);
    this.aura.frustumCulled = false;
    this.aura.renderOrder = 6;
    this.root.add(this.wisp, this.shadow, this.aura);
  }

  clear(): void {
    for (const it of this.items) {
      this.root.remove(it.mesh, it.trail.mesh);
      it.trail.dispose();
      it.mat.dispose();
      it.depth.dispose();
      it.tag.el.remove();
      if (it.marker) this.root.remove(it.marker);
      it.markTag?.el.remove();
    }
    this.items = [];
    for (const m of [this.wisp, this.shadow, this.aura]) {
      if (!m) continue;
      this.root.remove(m);
      m.geometry.dispose();
    }
    this.wisp = this.shadow = this.aura = null;
  }

  /** Restart trails and markers for a new run on the same field. */
  resetRun(): void {
    for (const it of this.items) {
      it.trail.clear();
      if (it.marker) this.root.remove(it.marker);
      it.marker = null;
      it.markTag?.el.remove();
      it.markTag = null;
      it.fade = 1;
      it.tagOn = false;
      it.hCount = 0;
      it.air = 0;
      it.side = 0;
      it.passT = 0;
      it.dim = 1;
      this.endTrick(it);
      it.callT = 0;
      it.stompT = 0;
    }
    this.rivalOff = 0;
    this.runT = 0;
    this.sinceStamp = Infinity;
    this.sinceTrick = Infinity;
  }

  update(
    poses: Map<number, GhostPose | null>,
    camera: PerspectiveCamera,
    w: number,
    h: number,
    time: number,
    player: Vector3,
    onPoof: (p: Vector3, c: Color) => void,
    occluders?: ReadonlyArray<Rect>,
    rival?: { id: number; gap: number } | null,
  ): void {
    const dt = Number.isNaN(this.lastTime) ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    this.dt = dt;
    this.viewW = w;
    this.runT += dt;
    this.syncView(w, h);
    // The rider is the hero: no tag ever sits on it.
    this.riderBounds(player, camera, w, h);
    const portrait = w < h;
    const rivalId = rival && this.labels && !this.reel ? rival.id : -1;
    // Screen-size fades are measured against the frame height (a phone's narrow width caps it).
    const sizeRef = portrait ? Math.min(h, 1.6 * w) : h;
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const fwd = camera.getWorldDirection(tmpF);
    const riderDepth = (player.x - camera.position.x) * fwd.x + (player.y + 0.55 - camera.position.y) * fwd.y + (player.z - camera.position.z) * fwd.z;
    // The wisp fades out under the top HUD row (about 90 px).
    const top = this.wispMat.uniforms.uTop.value as Vector2;
    top.set(1 - (2 * 130) / h, 1 - (2 * 70) / h);
    this.rivalNow = rivalId;
    this.sinceStamp += dt;
    this.sinceTrick += dt;
    const duelId = this.labels && !this.reel ? this.feel.duelId : null;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const p = poses.get(it.id);
      it.tag.ok = false;
      if (it.markTag) it.markTag.ok = false;
      // The tag's race state: a trick word running out, the call's ring ping, the duel's heartbeat.
      if (it.trickT > 0) {
        it.trickT -= dt;
        if (it.trickT <= 0) this.endTrick(it);
      }
      it.callT = Math.max(0, it.callT - dt);
      const call = it.callT > 0 && this.labels && !this.reel;
      if (call !== it.callOn) {
        it.callOn = call;
        it.tag.el.classList.toggle('call', call);
      }
      it.stompT = Math.max(0, it.stompT - dt);
      const stomp = it.stompT > 0 && !call && this.labels && !this.reel;
      if (stomp !== it.stompOn) {
        it.stompOn = stomp;
        it.tag.el.classList.toggle('stomp', stomp);
      }
      const duel = duelId === it.id && !!p && !p.done;
      if (duel !== it.duelOn) {
        it.duelOn = duel;
        it.tag.el.classList.toggle('duel', duel);
      }
      if (!p) {
        it.shown = 0;
        it.mesh.visible = false;
        this.hideFx(i);
        continue;
      }
      const pos = tmp.set(p.x, p.y, -p.z);
      if (p.done) {
        // Crashed: fade out with a poof, leave a lantern marker.
        if (it.fade === 1) onPoof(pos.clone().add(new Vector3(0, 0.8, 0)), it.col.clone());
        it.fade = Math.max(0, 1 - p.sinceDone / 0.6);
        if (!it.marker) this.plantMarker(it, pos);
      } else it.fade = 1;
      it.mesh.position.copy(pos);
      it.mesh.rotation.set(0, 0, 0);
      it.mesh.rotateY(-(p.heading + p.airYaw));
      it.mesh.rotateX(-p.airPitch);
      it.mesh.rotateZ(-p.lean * 0.35);
      // A ghost fades only where it would hide or tint the rider, or fill the lens; anywhere else in
      // the frame it is a glass spirit, head and shoulders solid and dissolving into its wisp (the
      // overtake beside you is the duel the game is about, and a ghost thinned to a few mint hairlines
      // read as no ghost at all). These fades are even, rim and all: an outline left behind over the
      // rider read as reticle rings round its head, and a pill hanging over nothing as a glitch.
      // Sitting on top of you (DECISIONS 34): blending in linear light lets even a few percent of
      // bright mint per ghost wash the dark coat teal at the start line, so a ghost whose body runs
      // into yours goes, from about 0.9 m in. One a metre off, side by side, hides nothing (behind you
      // the depth test hides it, in front `over` below takes it). The title reel's riders bunch for
      // its first seconds, so there the fade starts a little further out.
      const dPlayer = pos.distanceTo(player);
      const near = this.reel ? smooth01((dPlayer - 0.7) / 0.8) : smooth01((dPlayer - 0.5) / 0.4);
      // A pass beat (the race's own rule: one of you leads the other by 0.8 m where the other led):
      // the ghost you just passed, or that just passed you, stays on screen while the HUD names it.
      if (!this.reel && !p.done) {
        // Sim z runs downhill; the player position is in three.js space (z negated).
        const lead = p.z + player.z;
        const side = lead > 0.8 ? -1 : lead < -0.8 ? 1 : it.side;
        if (side !== it.side) {
          if (it.side !== 0 || this.runT > 1.5) it.passT = PASS_HOLD;
          it.side = side;
        }
      }
      it.passT = Math.max(0, it.passT - dt);
      const beat = smooth01(it.passT / 0.4);
      const isRival = rivalId === it.id && !p.done;
      // By size: from about 30% of the screen height (sooner when the frame edge cuts it) a ghost's
      // dissolve climbs from the hips toward its shoulders, so none outweighs the rider and none
      // hollows into an outline; from about 40% it goes evenly, gone by about 60% (riding beside the
      // lens at 80% it hung in the sky as a giant soap-bubble head). One in a pass beat keeps at least
      // half, and never vanishes until it is right at the lens.
      let body = 1;
      let lens = 1;
      let crop = 0;
      it.sr = 0;
      tmpP.copy(pos).addScaledVector(UP, 0.8);
      const depth = (tmpP.x - camera.position.x) * fwd.x + (tmpP.y - camera.position.y) * fwd.y + (tmpP.z - camera.position.z) * fwd.z;
      if (depth < 0.4) lens = 0;
      else {
        const pxPerM = h / (2 * tanV * depth);
        const size = (1.7 * pxPerM) / sizeRef;
        const c = tmpP.project(camera);
        const cx = (c.x * 0.5 + 0.5) * w;
        const cy = (-c.y * 0.5 + 0.5) * h;
        const half = 0.5 * pxPerM;
        crop = smooth01((Math.abs(cx - w * 0.5) + half - w * 0.5) / (2 * half));
        body = 1 - smooth01((size * (1 + 0.45 * crop) - 0.28) / 0.22);
        lens = 1 - smooth01((size - 0.38) / 0.24);
        // One flipping over the lens shows only its sled's underside, cut by the top edge under the
        // race pills: it goes evenly as its chest climbs past the top tenth of the screen.
        if (depth < 7) lens *= smooth01(cy / (0.1 * h));
        // (Only level with the rider or beyond it: one you have just passed is sliding past the lens,
        // where it must still go.)
        const k = beat * smooth01((depth - riderDepth + 0.2) / 0.4);
        if (k > 0) {
          body = Math.max(body, 0.5 * k);
          lens = Math.max(lens, 0.6 * k);
        }
        // Its head and shoulders on screen, for the overlap dimming below.
        it.sx = cx;
        it.sy = cy - 0.25 * pxPerM;
        it.sr = 0.62 * pxPerM;
        it.sd = depth;
        // Between the lens and the rider, over the rider on screen (a chaser right behind you, or one
        // you have just passed): it goes, rim and all, as one sitting on top of you does. Thinned there
        // it hung over the rider's head as a giant hollow outline.
        const rr = this.riderRect;
        if (depth < riderDepth - 0.4 && rr.x1 > rr.x0 && !this.reel) {
          const ox = Math.max(rr.x0 - cx, 0, cx - rr.x1);
          const oy = Math.max(rr.y0 - it.sy, 0, it.sy - rr.y1);
          lens *= 1 - 0.9 * (1 - smooth01(Math.hypot(ox, oy) / (0.6 * it.sr)));
        }
      }
      // Near the lens fill, rim and lip thin together (the material's uNear), so a near ghost frames
      // the rider as a faint tinted veil: on a phone to about a tenth within 3 m of the
      // lens (two near-lens ghosts filled both lower quarters with milky fog), on a wide screen within
      // about 2.5 m, and sooner for one the frame edge cuts (a just-passed ghost at the right edge
      // covered a fifth of the frame at near full strength).
      const camD = tmpP.copy(pos).addScaledVector(UP, 0.8).distanceTo(camera.position);
      // (The title reel's low lens rides about 4.6 m behind the hero, with its duel partner level with
      // it: there only a ghost right by the lens thins.)
      let nearCam = portrait ? (this.reel ? 0.1 + 0.9 * smooth01((camD - 2.2) / 1.6) : 0.1 + 0.9 * smooth01((camD - 3.0) / 2.6)) : 0.2 + 0.8 * smooth01((camD - 2.0) / 2.0);
      nearCam = Math.min(nearCam, 1 - 0.75 * crop * (1 - smooth01((camD - 4) / 4)));
      // Everywhere else a ghost is a glass spirit, head and shoulders solid and dissolving into its
      // wisp, whether it rides beside, behind or in front of you: contract C10 keeps every ghost layer
      // off the rider's own pixels, so a ghost overlapping the rider on screen shows around its
      // silhouette (the slipstreamed ghost squarely ahead, the one passing you) and never tints the
      // coat. These fades are even, rim and all: an outline left behind read as reticle rings, and a
      // pill hanging over nothing as a glitch. Sitting on top of you (DECISIONS 34) a ghost goes, from
      // about 0.9 m in, which is the whole field on the shared start line. The title reel's riders
      // bunch for its first seconds, so there the fade starts a little further out.
      // (A ghost passing right through you keeps a little of itself through its pass beat: the stencil
      // keeps it off your silhouette, and faded to nothing it read as a few stray sparkles.)
      const nearK = Math.max(near, 0.45 * beat);
      const core = it.fade * nearK * lens;
      const vis = core * nearCam;
      // A crashing ghost keeps its rim as it poofs; every other fade, near the lens included, is even.
      it.mat.uniforms.uFade.value = it.fade;
      it.mat.uniforms.uLens.value = nearK * lens * mix01(0.45, 1, nearCam);
      it.mat.uniforms.uBody.value = body;
      it.mat.uniforms.uNear.value = nearCam;
      it.mat.uniforms.uDim.value = it.dim;
      it.mesh.visible = core > 0.004;
      it.shown = vis;
      if (!it.mesh.visible) it.sr = 0;
      // Every ghost writes depth (head and torso), so its own limbs stay hidden behind its glass:
      // without it every limb draws its own rim, an x-ray tangle instead of one soft silhouette with a
      // clean mint edge. A faint ghost (beside you, passing the lens, poofing) draws after every solid
      // ghost and wisp instead, so its depth never hard-cuts anything behind it along its outline.
      it.mesh.renderOrder = vis > 0.6 ? 5 : 7;
      if (!p.done) {
        if (p.grounded) it.trail.add(p.x, p.z, 0.26 + p.carve * 0.2, 1.1, time);
        else if (it.wasGrounded) it.trail.lift();
        it.wasGrounded = p.grounded;
      }
      it.trail.flush();
      // Near the lens the wisp shortens with the fade, so a tail never sweeps a lower corner; a big
      // ghost keeps half its wisp (the tail streams on from the dissolving waist), and the one further
      // back of an overlapping pair dims with its body.
      const fx = vis * mix01(0.5, 1, body) * it.dim;
      this.updateWisp(i, it, pos, p, fx, camera, nearCam);
      this.updateShadow(i, it, p, vis * body);
      // The halo stays off a ghost right by you: around your silhouette it read as an outline ring.
      this.updateAura(i, it, pos, fx * body * smooth01((dPlayer - 1.2) / 1.0), camera);

      // A ghost inside any of the fades shows no tag at all (with a little hysteresis). Contract C11:
      // the ghost the HUD's rival pill names keeps its tag whenever it is on screen and not sitting on
      // you or at the lens, ringed in its kind colour and placed before every other tag.
      if (isRival !== it.ringed) {
        it.ringed = isRival;
        it.tag.el.classList.toggle('rival', isRival);
        it.tag.prio = isRival ? -1 : it.basePrio;
      }
      // (The title reel names the ghost racing at the hero's shoulder, about the hero's size, so its
      // size-based dissolve does not hide the tag there.)
      it.tagOn = this.labels && !p.done && (isRival ? core > (it.tagOn ? 0.2 : 0.3) : vis * (this.reel ? 1 : body) > (it.tagOn ? 0.9 : 0.97));
      if (it.tagOn) {
        // Above the body's centre, wherever a flip has swung it, not above the sled's pivot.
        tmpP.set(0, 0.8, 0).applyQuaternion(it.mesh.quaternion).add(pos).addScaledVector(UP, 0.95);
        this.project(it.tag, tmpP, camera, w, h, TAG_RANGE);
        it.tag.dp = dPlayer;
      }
      // The title reel names only the ghost racing the hero; crash markers keep to the race.
      if (it.marker && it.markTag && this.labels && !this.reel) {
        tmpP.copy(it.marker.position).addScaledVector(UP, 1.95);
        this.project(it.markTag, tmpP, camera, w, h, MARK_RANGE);
      }
    }
    this.lineTags(camera, w, h, player);
    // Graveyard tags keep to the race, like the crash markers.
    const graves = this.labels && !this.reel;
    for (const g of this.graves) {
      g.tag.ok = false;
      if (graves) this.project(g.tag, tmpP.set(g.x, g.y, -g.z), camera, w, h, GRAVE_RANGE);
    }
    this.dimOverlaps(dt, riderDepth);
    if (this.wisp) {
      const g = this.wisp.geometry;
      g.getAttribute('position').needsUpdate = true;
      g.getAttribute('aCol').needsUpdate = true;
    }
    for (const m of [this.shadow, this.aura]) {
      if (!m) continue;
      m.geometry.getAttribute('position').needsUpdate = true;
      m.geometry.getAttribute('aCol').needsUpdate = true;
    }
    this.declutter(occluders, h);
    this.animateTags(dt);
    this.placeRival(rival ?? null, poses, camera, w, h, dt, occluders);
  }

  /** The tags over the best and friend bands on the snow: 'Your best · 1,240 m' in gold-white and
   *  'Mila · 2,340 m' in mint, standing at the band on the side of the course away from the rider
   *  (centred, it sat behind the rider and hid). Your best's tag goes
   *  once its ghost has crashed there (its lantern marker says it from then on). */
  private lineTags(camera: PerspectiveCamera, w: number, h: number, player: Vector3): void {
    const f = this.feel;
    const on = this.labels && !this.reel;
    const best = on ? f.bestLine : null;
    if (this.bestTag) this.bestTag.ok = false;
    if (best && !this.items.some((it) => it.kind === 'you' && it.marker)) {
      const txt = `Your best${NBSP}·${NBSP}${fmt(best.distance)}${NBSP}m`;
      const t = (this.bestTag ??= this.makeLineTag(GHOST_COLORS.you));
      if (txt !== this.bestTxt) {
        this.bestTxt = txt;
        t.el.textContent = txt;
        t.w = 0;
      }
      if (t.a === 0) this.bestSide = this.awaySide(best.z, player);
      this.projectLine(t, best.z, this.bestSide, camera, w, h);
    }
    const friend = on ? f.friendLine : null;
    if (this.friendTag) this.friendTag.ok = false;
    if (friend) {
      const txt = `${friend.name}${NBSP}·${NBSP}${fmt(friend.distance)}${NBSP}m`;
      const t = (this.friendTag ??= this.makeLineTag(GHOST_COLORS.friend));
      if (txt !== this.friendTxt) {
        this.friendTxt = txt;
        t.el.textContent = txt;
        t.w = 0;
      }
      if (t.a === 0) this.friendSide = this.awaySide(friend.z, player);
      this.projectLine(t, friend.z, this.friendSide, camera, w, h);
    }
  }

  private makeLineTag(color: string): Tag {
    const l = document.createElement('div');
    l.className = 'ghost-label line';
    l.style.setProperty('--c', color);
    // A friend's name is a proper noun; the copy around it is plain.
    l.translate = false;
    this.layer.appendChild(l);
    const t = newTag(l, 2);
    // (A band across the snow: on a phone its tag's spot is often at the frame's edge.)
    t.pull = true;
    return t;
  }

  /** The side of the course at a band away from the rider (player is three.js: sim z is -z). */
  private awaySide(z: number, player: Vector3): number {
    const c = this.course;
    const pz = Math.min(-player.z, z);
    return player.x > c.centerX(pz) ? -1 : 1;
  }

  /** A line tag over the band at sim z, standing on one side of the course, halfway to its edge. */
  private projectLine(t: Tag, z: number, side: number, camera: PerspectiveCamera, w: number, h: number): void {
    const c = this.course;
    const x = c.centerX(z) + side * c.halfWidth(z) * 0.45;
    tmpP.set(x, c.ground(x, z) + 1.7, -z);
    this.project(t, tmpP, camera, w, h, LINE_RANGE);
  }

  /** Where two ghosts overlap on screen, the one further from the lens dims to under half (body, rim,
   *  wisp and halo), so the pair reads as one ghost in front of another rather than two glass
   *  outlines tangled into one shape round the rider's head. Eased, so a ghost sliding behind another
   *  never pops; applied from the next frame. */
  private dimOverlaps(dt: number, riderDepth: number): void {
    const items = this.items;
    const k = dt === 0 ? 1 : Math.min(1, dt * 6);
    const rr = this.riderRect;
    // The rider's head on screen (its rect's top fifth): a ghost right behind it, bigger than it,
    // showed only as a ring round the beanie (a reticle), so it dims to about half there too.
    const hx = (rr.x0 + rr.x1) / 2;
    const hr = (rr.y1 - rr.y0) * 0.22;
    const hy = rr.y0 + hr * 1.3;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      let target = 1;
      if (a.sr > 0 && rr.x1 > rr.x0 && a.sd > riderDepth + 0.3 && !this.reel) {
        const r = a.sr + hr;
        target = 1 - 0.5 * (1 - smooth01((Math.hypot(a.sx - hx, a.sy - hy) - 0.25 * r) / (0.6 * r)));
      }
      if (a.sr > 0) {
        for (let j = 0; j < items.length; j++) {
          const b = items[j];
          // Only a ghost at least 0.3 m nearer the lens dims this one.
          if (j === i || b.sr <= 0 || b.sd > a.sd - 0.3) continue;
          const r = a.sr + b.sr;
          const over = 1 - smooth01((Math.hypot(a.sx - b.sx, a.sy - b.sy) - 0.3 * r) / (0.6 * r));
          target = Math.min(target, 1 - 0.58 * over);
        }
      }
      a.dim += (target - a.dim) * k;
    }
  }

  /** The rider's screen rect (CSS px), with a little headroom above the pom-pom so no tag sits on the
   *  head. Snug to the seated rider and its scarf: a rect half as wide again and 80 px taller left a
   *  ghost racing right beside or behind the rider nowhere to hang its name. */
  private riderBounds(player: Vector3, camera: PerspectiveCamera, w: number, h: number): Rect {
    const rr = this.riderRect;
    const foot = tmpP.copy(player).project(camera);
    const fx = (foot.x * 0.5 + 0.5) * w;
    const fy = (-foot.y * 0.5 + 0.5) * h;
    const fz = foot.z;
    // (1.5 m: the pom-pom's top on the seated rider.)
    const head = tmpP.copy(player).addScaledVector(UP, 1.5).project(camera);
    const hy = (-head.y * 0.5 + 0.5) * h;
    const span = Math.max(20, fy - hy);
    if (fz < 1 && head.z < 1) {
      rr.x0 = fx - span * 0.46;
      rr.x1 = fx + span * 0.46;
      rr.y0 = hy - 4 - span * 0.06;
      rr.y1 = fy;
    } else rr.x0 = rr.x1 = rr.y0 = rr.y1 = -1;
    return rr;
  }

  /** Contract C1: while the ghost the HUD's rival pill names is off screen or behind the lens, a
   *  chip sits on the screen edge with its glyph and a filled arrowhead in its kind colour pointing
   *  at it, and the gap in metres (contract C12). It hides while the ghost is in frame and slides clear
   *  of the HUD's own elements. */
  /** On a viewport size change: re-read the safe-area insets and drop the measured chip widths (the
   *  HUD's type scales with the viewport). Style reads only, once per resize. */
  private syncView(w: number, h: number): void {
    const key = w * 100000 + h;
    if (key === this.viewKey) return;
    this.viewKey = key;
    this.rivalW = 0;
    const cs = getComputedStyle(this.safeProbe);
    this.safe.t = parseFloat(cs.paddingTop) || 0;
    this.safe.r = parseFloat(cs.paddingRight) || 0;
    this.safe.b = parseFloat(cs.paddingBottom) || 0;
    this.safe.l = parseFloat(cs.paddingLeft) || 0;
  }

  private placeRival(
    rival: { id: number; gap: number } | null,
    poses: Map<number, GhostPose | null>,
    camera: PerspectiveCamera,
    w: number,
    h: number,
    dt: number,
    occluders?: ReadonlyArray<Rect>,
  ): void {
    let it: Item | null = null;
    if (rival) for (const g of this.items) if (g.id === rival.id) it = g;
    const p = it ? poses.get(it.id) : null;
    let off = false;
    if (it && p && !p.done && this.labels) {
      // The ghost's chest in view space (the camera looks down -z).
      const v = tmpP.set(p.x, p.y + 0.8, -p.z).applyMatrix4(camera.matrixWorldInverse);
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const tanH = tanV * camera.aspect;
      let sx: number;
      let sy: number;
      // A chaser between the lens and you is faded off your silhouette (update), so it counts as
      // behind the lens: pointed at from the bottom edge, never left with neither a body nor a marker.
      if (-v.z > 0.3 && !(it.shown < 0.3 && rival!.gap < 0)) {
        sx = (v.x / (-v.z * tanH)) * w * 0.5;
        sy = (-v.y / (-v.z * tanV)) * h * 0.5;
        off = Math.abs(sx) > w * 0.5 - 6 || Math.abs(sy) > h * 0.5 - 6;
      } else {
        // Behind the lens means behind you: the marker sits on the bottom edge, on the ghost's side.
        sx = Math.max(-1, Math.min(1, v.x / Math.max(1.5, Math.abs(v.z)))) * w * 0.5;
        sy = h;
        // Only a chaser close enough to threaten your lead (within about 15 m and a lane or so either
        // side) earns the marker; a ghost further back is no news. (At 10 m a leader 10 m clear saw no
        // rival anywhere in the frame.)
        const gap = Math.abs(rival!.gap);
        off = gap < 15 && Math.abs(v.x) < 3.2 + 0.1 * gap;
      }
      if (off) {
        if (it.id !== this.rivalId) {
          this.rivalId = it.id;
          this.rivalEl.style.setProperty('--c', GHOST_COLORS[it.kind]);
        }
        const close = Math.abs(rival!.gap) < 3;
        if (close !== this.rivalClose) {
          this.rivalClose = close;
          this.rivalEl.classList.toggle('close', close);
        }
        // Contract C12: the gap as a positive whole number of metres (the arrow gives the side).
        const txt = `${Math.max(1, Math.round(Math.abs(rival!.gap)))} m`;
        if (txt !== this.rivalTxt) {
          // The chip's width holds while the digit count does (tabular figures), so it is measured
          // again only when that changes (and once per viewport).
          if (txt.length !== this.rivalTxt.length) this.rivalW = 0;
          this.rivalTxt = txt;
          this.rivalGap.textContent = txt;
        }
        if (this.rivalW <= 0) this.rivalW = this.rivalEl.offsetWidth || 64;
        // Room for the arrowhead outside the chip, on whichever side it points.
        const hw = this.rivalW / 2 + 22;
        const hh = 14 + 22;
        // Walk out from the centre of the screen toward the ghost until the chip meets the edge,
        // then keep it inside the safe area (a notch or the home indicator in landscape).
        const ax = Math.abs(sx) > 1e-3 ? (w * 0.5 - hw) / Math.abs(sx) : Infinity;
        const ay = Math.abs(sy) > 1e-3 ? (h * 0.5 - hh) / Math.abs(sy) : Infinity;
        const k = Math.min(ax, ay);
        const safe = this.safe;
        let x = Math.max(hw + safe.l, Math.min(w - hw - safe.r, w * 0.5 + sx * k));
        // On a portrait phone the bottom quarter belongs to the thumbs (the steer and drift zones):
        // the chip stays above it, so a ghost behind you is pointed at from beside the rider's sled.
        const bottom = w < h ? Math.min(h - hh - safe.b, h * 0.75 - hh) : h - hh - safe.b;
        let y = Math.max(hh + safe.t, Math.min(bottom, h * 0.5 + sy * k));
        // Slide clear of a HUD element: below it in the top half (the race pills), above it in the
        // bottom half (the thumb controls).
        if (occluders) {
          for (let pass = 0; pass < 2; pass++) {
            for (let j = 0; j < occluders.length; j++) {
              const o = occluders[j];
              if (x - hw + 10 < o.x1 && x + hw - 10 > o.x0 && y - hh + 10 < o.y1 && y + hh - 10 > o.y0) {
                y = y < h * 0.5 ? o.y1 + hh - 4 : o.y0 - hh + 4;
              }
            }
          }
        }
        this.rivalX = x;
        this.rivalY = y;
        // The arrowhead points from the chip at the ghost itself (from where the chip ended up, after
        // the safe area and the HUD moved it).
        this.rivalAng = Math.atan2(h * 0.5 + sy - y, w * 0.5 + sx - x);
      }
    }
    // Only a rival that stays out of frame for a moment earns the marker (no flicker at the edge);
    // once earned it comes in fast, so it is never caught half transparent.
    this.rivalOff = off ? this.rivalOff + dt : 0;
    const want = off && this.rivalOff > 0.2;
    const target = want ? 1 : 0;
    this.rivalA = dt === 0 ? target : this.rivalA + (target - this.rivalA) * Math.min(1, dt * 16);
    if (Math.abs(this.rivalA - target) < 0.02) this.rivalA = target;
    const op = this.rivalA.toFixed(2);
    if (op !== this.rivalOp) {
      this.rivalOp = op;
      this.rivalEl.style.opacity = op;
    }
    if (this.rivalA === 0) return;
    const m = this.rivalM;
    if (Math.abs(this.rivalX - m[0]) > 0.05 || Math.abs(this.rivalY - m[1]) > 0.05) {
      m[0] = this.rivalX;
      m[1] = this.rivalY;
      this.rivalEl.style.transform = `translate3d(${this.rivalX.toFixed(1)}px, ${this.rivalY.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
    if (Math.abs(this.rivalAng - m[2]) > 0.01 || this.rivalW !== m[3]) {
      m[2] = this.rivalAng;
      m[3] = this.rivalW;
      // Out from the chip's centre to just past its pill-shaped edge along the arrow's direction.
      const c = Math.cos(this.rivalAng);
      const s = Math.sin(this.rivalAng);
      const ph = 14;
      const cx = Math.max(0, this.rivalW / 2 - ph);
      let t = ph / Math.max(Math.abs(s), 1e-3);
      if (Math.abs(c) * t > cx) {
        const b = Math.abs(c) * cx;
        t = b + Math.sqrt(Math.max(0, b * b - cx * cx + ph * ph));
      }
      this.rivalChev.style.transform = `rotate(${((this.rivalAng * 180) / Math.PI).toFixed(1)}deg) translateX(${(t + 7).toFixed(1)}px)`;
    }
  }

  private hideFx(i: number): void {
    if (this.wisp) {
      const col = this.wisp.geometry.getAttribute('aCol').array as Float32Array;
      for (let v = i * WISP_PTS * 2; v < (i + 1) * WISP_PTS * 2; v++) col[v * 4 + 3] = 0;
    }
    for (const m of [this.shadow, this.aura]) {
      if (!m) continue;
      const col = m.geometry.getAttribute('aCol').array as Float32Array;
      for (let v = i * 4; v < i * 4 + 4; v++) col[v * 4 + 3] = 0;
    }
  }

  /** The aura: a camera-facing quad round the head and shoulders (wherever a flip has swung them). */
  private updateAura(i: number, it: Item, pos: Vector3, vis: number, camera: PerspectiveCamera): void {
    if (!this.aura) return;
    const c = tmpA.set(0, AURA_LIFT, 0).applyQuaternion(it.mesh.quaternion).add(pos);
    const e = camera.matrixWorld.elements;
    const posA = this.aura.geometry.getAttribute('position').array as Float32Array;
    const colA = this.aura.geometry.getAttribute('aCol').array as Float32Array;
    for (let k = 0; k < 4; k++) {
      const su = (k === 0 || k === 3 ? -1 : 1) * AURA_R;
      const sv = (k < 2 ? -1 : 1) * AURA_R;
      const v = (i * 4 + k) * 3;
      posA[v] = c.x + e[0] * su + e[4] * sv;
      posA[v + 1] = c.y + e[1] * su + e[5] * sv;
      posA[v + 2] = c.z + e[2] * su + e[6] * sv;
      const o = (i * 4 + k) * 4;
      colA[o] = it.col.r;
      colA[o + 1] = it.col.g;
      colA[o + 2] = it.col.b;
      colA[o + 3] = vis;
    }
  }

  /** The wisp follows where the ghost's body has just been across the snow (its horizontal path, held
   *  at the ghost's own height), tapering to a point 1 to 2 m back. */
  private updateWisp(i: number, it: Item, pos: Vector3, p: GhostPose, vis: number, camera: PerspectiveCamera, lenK: number): void {
    if (!this.wisp) return;
    const hist = it.hist;
    // Anchored at the shoulders as the body turns, so a flipping ghost's tail sweeps an arc behind
    // the flip instead of hanging off the empty air above its sled.
    const anc = tmpA.set(0, WISP_LIFT, 0).applyQuaternion(it.mesh.quaternion);
    const ax = pos.x + anc.x;
    const ay = pos.y + anc.y;
    const az = pos.z + anc.z;
    // In the air the tip droops a little instead of lifting: seen from the chase camera below, a tail
    // held level above eye height already climbs the screen toward the lens.
    it.air += ((p.grounded ? 0 : 1) - it.air) * Math.min(1, this.dt * 6);
    const rise = 0.12 - 0.3 * it.air;
    // Record the anchor every 12 cm; a jump (new run, revive) restarts the history.
    const last = ((it.hHead - 1 + HIST) % HIST) * 3;
    const d2 = it.hCount > 0 ? (ax - hist[last]) ** 2 + (ay - hist[last + 1]) ** 2 + (az - hist[last + 2]) ** 2 : Infinity;
    if (d2 > 36) it.hCount = 0;
    if (d2 >= 0.0144) {
      const n = it.hHead * 3;
      hist[n] = ax;
      hist[n + 1] = ay;
      hist[n + 2] = az;
      it.hHead = (it.hHead + 1) % HIST;
      it.hCount = Math.min(HIST, it.hCount + 1);
    }
    const posA = this.wisp.geometry.getAttribute('position').array as Float32Array;
    const colA = this.wisp.geometry.getAttribute('aCol').array as Float32Array;
    const base = i * WISP_PTS * 2;
    // Length grows with speed; walk back along the recorded path (newest first) by horizontal arc
    // length. Height is left out on purpose: a ghost dropping from a jump or mid-flip would otherwise
    // trail a vertical column up into the sky.
    let avail = 0;
    let px = ax;
    let pz = az;
    for (let k = 0; k < it.hCount; k++) {
      const o = ((it.hHead - 1 - k + HIST * 2) % HIST) * 3;
      avail += Math.sqrt((hist[o] - px) ** 2 + (hist[o + 2] - pz) ** 2);
      px = hist[o];
      pz = hist[o + 2];
    }
    // Longer in the glowing moods, where the trail is how you find the ghost ahead.
    const len = Math.min(avail, Math.max(1.2, Math.min(WISP_MAX, 1.5 + (p.speed - 10) * 0.05 + this.mood * 0.4)) * (0.35 + 0.65 * lenK));
    const strength = len > 0.3 ? vis * Math.min(1, len / 1.0) : 0;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    let acc = 0;
    let k = 0;
    let seg = 0;
    px = ax;
    pz = az;
    let qx = ax;
    let qz = az;
    let sl = 0;
    const t0 = this.lastTime * 7 + i * 1.7;
    const side = i % 2 === 0 ? 1 : -1;
    const wc = this.wc;
    while (k < WISP_PTS) {
      const target = (k / WISP_SEG) * len;
      // Advance along the history until the current segment spans the target arc length.
      while (acc + sl < target && seg < it.hCount) {
        acc += sl;
        px = qx;
        pz = qz;
        const o = ((it.hHead - 1 - seg + HIST * 2) % HIST) * 3;
        qx = hist[o];
        qz = hist[o + 2];
        sl = Math.sqrt((qx - px) ** 2 + (qz - pz) ** 2);
        seg++;
      }
      const u = sl > 1e-4 ? Math.min(1, Math.max(0, (target - acc) / sl)) : 0;
      const x = px + (qx - px) * u;
      const z = pz + (qz - pz) * u;
      // Direction along the tail (toward the tip), for the sideways flutter.
      let tx = qx - px;
      let tz = qz - pz;
      let tl = Math.sqrt(tx * tx + tz * tz);
      if (tl < 1e-4) {
        // Straight back from the sled (world forward is (sin, 0, -cos) of the heading).
        tx = -Math.sin(p.heading);
        tz = Math.cos(p.heading);
        tl = 1;
      }
      tx /= tl;
      tz /= tl;
      const t = k / WISP_SEG;
      // A travelling wave flutters the ribbon sideways, growing toward the tip, and the tail lifts a
      // little as it trails off. Straight back it would hide behind the ghost's own body from the
      // chase camera; this way it streams out past the silhouette. Each ghost streams to its own
      // side, so the flutter never folds the tail back behind the body.
      const fl = (side * 0.62 + Math.sin(t * 5.2 - t0 * 1.3) * 0.2) * t ** 1.1;
      const o = k * 3;
      wc[o] = x - tz * fl;
      wc[o + 1] = ay + rise * t ** 1.4 + Math.sin(t * 3.6 - t0) * 0.06 * t;
      wc[o + 2] = z + tx * fl;
      k++;
    }
    // Camera-facing width from the tangent of the curled centre line itself. Where the tail points
    // into the lens the cross product with the view vanishes and its sign is noise, so each step
    // keeps the previous side's orientation and leans on it when the cross product gets short.
    const e = camera.matrixWorld.elements;
    let ux = e[0];
    let uy = e[1];
    let uz = e[2];
    for (k = 0; k < WISP_PTS; k++) {
      const o = k * 3;
      const a = Math.max(0, k - 1) * 3;
      const b = Math.min(WISP_SEG, k + 1) * 3;
      const tx = wc[b] - wc[a];
      const ty = wc[b + 1] - wc[a + 1];
      const tz = wc[b + 2] - wc[a + 2];
      const vx = wc[o] - cx;
      const vy = wc[o + 1] - cy;
      const vz = wc[o + 2] - cz;
      let sx = ty * vz - tz * vy;
      let sy = tz * vx - tx * vz;
      let sz = tx * vy - ty * vx;
      const sl2 = Math.sqrt(sx * sx + sy * sy + sz * sz);
      const ref = Math.sqrt(tx * tx + ty * ty + tz * tz) * Math.sqrt(vx * vx + vy * vy + vz * vz);
      // How much to trust the cross product: the sine of the angle between the tail and the view.
      const trust = ref > 1e-6 ? Math.min(1, sl2 / ref / 0.35) : 0;
      if (sl2 > 1e-9) {
        sx /= sl2;
        sy /= sl2;
        sz /= sl2;
        if (sx * ux + sy * uy + sz * uz < 0) {
          sx = -sx;
          sy = -sy;
          sz = -sz;
        }
      }
      sx = sx * trust + ux * (1 - trust);
      sy = sy * trust + uy * (1 - trust);
      sz = sz * trust + uz * (1 - trust);
      const sn = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      ux = sx / sn;
      uy = sy / sn;
      uz = sz / sn;
      const t = k / WISP_SEG;
      // A flame profile: narrow where it leaves the waist, fullest about a quarter of the way, then a
      // point (as wide as the waist at the root, it read as a blade cut from the body).
      const hw = 0.03 + 0.3 * (1 - t) ** 1.3 * (0.22 + 0.78 * smooth01(t / 0.3));
      const v = (base + k * 2) * 3;
      posA[v] = wc[o] - ux * hw;
      posA[v + 1] = wc[o + 1] - uy * hw;
      posA[v + 2] = wc[o + 2] - uz * hw;
      posA[v + 3] = wc[o] + ux * hw;
      posA[v + 4] = wc[o + 1] + uy * hw;
      posA[v + 5] = wc[o + 2] + uz * hw;
      const c = (base + k * 2) * 4;
      colA[c] = colA[c + 4] = it.col.r;
      colA[c + 1] = colA[c + 5] = it.col.g;
      colA[c + 2] = colA[c + 6] = it.col.b;
      colA[c + 3] = colA[c + 7] = strength;
    }
  }

  /** A kind-tinted blob on the snow under the ghost; it spreads and softens as the ghost climbs. */
  private updateShadow(i: number, it: Item, p: GhostPose, vis: number): void {
    if (!this.shadow) return;
    const c = this.course;
    const gy = c.ground(p.x, p.z);
    c.gradient(p.x, p.z, grad);
    const hgt = Math.max(0, p.y - gy);
    const air = Math.min(1, Math.max(0, (hgt - 0.15) / 0.7));
    const spread = Math.min(2.2, 0.8 + hgt * 0.16);
    const alpha = vis * (0.22 + 0.4 * air) * (1 - Math.min(1, Math.max(0, (hgt - 2) / 8)) * 0.55);
    // Along and across the heading, in world space (sim z is negated).
    const fx = Math.sin(p.heading);
    const fz = -Math.cos(p.heading);
    const rx = -fz;
    const rz = fx;
    // Long along the heading: the low chase camera sees the snow at a grazing angle.
    const la = spread * 1.25;
    const lb = spread * 0.62;
    const posA = this.shadow.geometry.getAttribute('position').array as Float32Array;
    const colA = this.shadow.geometry.getAttribute('aCol').array as Float32Array;
    for (let k = 0; k < 4; k++) {
      const su = k === 0 || k === 3 ? -1 : 1;
      const sv = k < 2 ? -1 : 1;
      const dx = rx * su * lb + fx * sv * la;
      const dz = rz * su * lb + fz * sv * la;
      const v = (i * 4 + k) * 3;
      posA[v] = p.x + dx;
      // Lie on the local slope plane (gradient is in sim space, where z points downhill).
      posA[v + 1] = gy + grad.x * dx - grad.z * dz + 0.06;
      posA[v + 2] = -p.z + dz;
      const o = (i * 4 + k) * 4;
      colA[o] = it.deep.r;
      colA[o + 1] = it.deep.g;
      colA[o + 2] = it.deep.b;
      colA[o + 3] = alpha;
    }
  }

  private project(tag: Tag, world: Vector3, camera: PerspectiveCamera, w: number, h: number, range: number): void {
    const d = world.distanceTo(camera.position);
    if (d > range) return;
    const v = world.project(camera);
    if (v.z > 1 || v.z < -1) return;
    tag.x = (v.x * 0.5 + 0.5) * w;
    tag.y = (-v.y * 0.5 + 0.5) * h - 4;
    const far = Math.max(0, Math.min(1, (d - range * 0.35) / (range * 0.65)));
    // The title reel's one tag names the ghost racing at the hero's shoulder: a touch larger than a
    // run's on a wide screen (at 0.86 the hook barely showed), a little smaller on a phone.
    tag.scale = (1 - 0.22 * far) * (this.reel ? (w < h ? 0.92 : 1.12) : 1);
    tag.d = d;
    tag.ok = true;
  }

  /** The rival the HUD names first (contract C11), then special kinds, then the nearest pool ghosts,
   *  then crash markers (contract C8). Each pill sits right over its own ghost's head; no tag ever
   *  covers the rider (one that clips it slides out to its side). Pills never stack: a ghost tag that
   *  would overlap one already placed, or sit within a few pixels of a HUD element, collapses to a
   *  small dot in its kind colour over its ghost (a staircase of overlapping pills tied no name to a
   *  ghost), and while the landing stamp is up every tag but the rival's does. The rival's pill never
   *  collapses. A tag cut by the screen edge or on a HUD element, or a dot with no room, hides. The
   *  title reel names only the ghost nearest the hero: a row of names competed with the menu. */
  private declutter(occluders: ReadonlyArray<Rect> | undefined, h: number): void {
    const cands = this.cands;
    const pool = this.pool;
    cands.length = 0;
    pool.length = 0;
    for (const it of this.items) {
      it.tag.want = false;
      if (it.markTag) it.markTag.want = false;
      if (it.tag.ok) (it.tag.prio <= 0 && !this.reel ? cands : pool).push(it.tag);
      if (it.markTag && it.markTag.ok) cands.push(it.markTag);
    }
    for (const t of [this.bestTag, this.friendTag]) {
      if (!t) continue;
      t.want = false;
      if (t.ok) cands.push(t);
    }
    for (const g of this.graves) {
      g.tag.want = false;
      if (g.tag.ok) cands.push(g.tag);
    }
    pool.sort(this.byPlayer);
    for (let i = 0; i < pool.length && i < (this.reel ? 1 : POOL_TAGS); i++) cands.push(pool[i]);
    cands.sort(this.byPrio);
    const r = this.rects;
    const rr = this.riderRect;
    r[0] = rr.x0;
    r[1] = rr.y0;
    r[2] = rr.x1;
    r[3] = rr.y1;
    this.nr = 1;
    const safe = this.safe;
    const W = this.viewW;
    // The landing stamp (a big card in the middle of the screen, never a pill or a meter): while it
    // is up, every tag but the rival's is a dot.
    let busy = false;
    if (occluders) {
      for (let k = 0; k < occluders.length && !busy; k++) {
        const o = occluders[k];
        const cy = (o.y0 + o.y1) / 2;
        busy = (o.x1 - o.x0) * (o.y1 - o.y0) > 0.018 * W * h && cy > 0.2 * h && cy < 0.8 * h;
      }
    }
    for (const t of cands) {
      if (this.nr >= 64) break;
      // Label sizes never change, so measure once (no per-frame layout reads).
      if (!t.w) {
        t.w = t.el.offsetWidth || 90;
        t.h = t.el.offsetHeight || 20;
      }
      t.wantDot = false;
      const tw = t.w * t.scale;
      const th = t.h * t.scale;
      const y = t.y;
      const y0 = y - th;
      // A ghost's own tag (not the rival's, not a crash marker's, not on the title) may collapse.
      const canDot = t.prio >= 0 && t.prio < 2 && !this.reel;
      let placed = false;
      let gone = false;
      // Centred over its ghost first; a tag that only clips the rider then slides out to the side of
      // the rider (up to about half its width) rather than up over the rider's head.
      for (let pass = 0; pass < 2 && !(canDot && busy); pass++) {
        let x = t.x;
        // The rival's tag (contract C11), the title's one tag, a graveyard's and a line's are pulled in
        // from the screen edge rather than hidden while what they name is on screen: a ghost racing
        // beside you on a phone sits right at the edge, and so do a cairn on the bank and a band's tag.
        if ((t.prio < 0 || this.reel || t.pull) && t.x > 0 && t.x < W) x = Math.max(8 + safe.l + tw / 2, Math.min(W - 8 - safe.r - tw / 2, x));
        if (pass === 1) {
          if (!(y0 < rr.y1 && y > rr.y0 && rr.x1 > rr.x0)) break;
          const slide = x >= (rr.x0 + rr.x1) / 2 ? rr.x1 + 3 - (x - tw / 2) : rr.x0 - 3 - (x + tw / 2);
          // The title's one tag, and the rival's (contract C11), may slide a whole width: the ghost
          // racing the hero, or the one the HUD names, is named, always.
          if (Math.abs(slide) > tw * (this.reel || t.prio < 0 ? 1 : 0.55)) break;
          x += slide;
        }
        const x0 = x - tw / 2;
        const x1 = x + tw / 2;
        // A tag on the HUD (a collapsible one: within a few pixels of it), or cut by the screen edge,
        // never shows as a pill.
        if (x0 < 6 + safe.l || x1 > W - 6 - safe.r || y0 < 4 + safe.t || y > h - 4 - safe.b || this.onHud(occluders, x0, y0, x1, y, canDot ? 24 : 0)) {
          gone = pass === 0;
          break;
        }
        if (this.hits(x0, y0, x1, y)) continue;
        this.claim(x0, y0, x1, y);
        t.want = true;
        // A slid tag drops its pointer: it no longer sits right above its ghost.
        const slid = Math.abs(x - t.x) > 4;
        t.x = x;
        if (slid !== t.stacked) {
          t.stacked = slid;
          t.el.classList.toggle('stacked', slid);
        }
        placed = true;
        break;
      }
      if (placed || !canDot || (gone && (t.x < 0 || t.x > W))) continue;
      // Collapsed: a dot right over its ghost's head, where nothing else sits. A dot is small enough
      // to sit beside the rider's body inside its rect's margin (kept for the scarf and the pills).
      const d0x = t.x - DOT / 2;
      const d1x = t.x + DOT / 2;
      const d0y = y - DOT - 2;
      const bx = (rr.x1 - rr.x0) * 0.3;
      const onBody = d0x < (rr.x0 + rr.x1) / 2 + bx && d1x > (rr.x0 + rr.x1) / 2 - bx && d0y < rr.y1 && y > rr.y0;
      if (onBody || d0x < 6 + safe.l || d1x > W - 6 - safe.r || d0y < 4 + safe.t || y > h - 4 - safe.b || this.onHud(occluders, d0x, d0y, d1x, y, 4) || this.hits(d0x, d0y, d1x, y, 1)) continue;
      this.claim(d0x, d0y, d1x, y);
      t.want = true;
      t.wantDot = true;
    }
  }

  private claim(x0: number, y0: number, x1: number, y1: number): void {
    const r = this.rects;
    const k = this.nr++ * 4;
    r[k] = x0;
    r[k + 1] = y0;
    r[k + 2] = x1;
    r[k + 3] = y1;
  }

  /** Whether a rect overlaps any placed rect from index `from` on (0, the rider's, by default). */
  private hits(x0: number, y0: number, x1: number, y1: number, from = 0): boolean {
    const r = this.rects;
    for (let k = from; k < this.nr; k++) if (x0 < r[k * 4 + 2] && x1 > r[k * 4] && y0 < r[k * 4 + 3] && y1 > r[k * 4 + 1]) return true;
    return false;
  }

  /** Whether a rect comes within `pad` px of any HUD element. */
  private onHud(occluders: ReadonlyArray<Rect> | undefined, x0: number, y0: number, x1: number, y1: number, pad: number): boolean {
    if (!occluders) return false;
    for (let k = 0; k < occluders.length; k++) {
      const o = occluders[k];
      if (x0 < o.x1 + pad && x1 > o.x0 - pad && y0 < o.y1 + pad && y1 > o.y0 - pad) return true;
    }
    return false;
  }

  /** Contract C8: a tag is shown at full opacity or hidden, never half transparent (a fade caught
   *  mid-way read as an orphaned pill floating over the snow). */
  private animateTags(dt: number): void {
    for (const it of this.items) {
      this.animate(it.tag, dt);
      if (it.markTag) this.animate(it.markTag, dt);
    }
    if (this.bestTag) this.animate(this.bestTag, dt);
    if (this.friendTag) this.animate(this.friendTag, dt);
    for (const g of this.graves) this.animate(g.tag, dt);
  }

  private animate(t: Tag, dt: number): void {
    // It shows once it has held its place for a tenth of a second (no flicker as its ghost crosses a
    // fade threshold or two tags trade a slot) and hides the frame it is no longer wanted.
    t.held = t.want ? t.held + dt : 0;
    const on = t.want && (t.a === 1 || t.held >= 0.1);
    // Pill or dot: a class flip only when the state changes (the dot's size is fixed in CSS, so the
    // pill's measured size stays valid).
    if (t.want && t.wantDot !== t.dot) {
      t.dot = t.wantDot;
      t.el.classList.toggle('dot', t.dot);
      t.ts = -1;
    }
    const scale = t.dot ? 1 : t.scale;
    if (t.want && (Math.abs(t.x - t.tx) > 0.05 || Math.abs(t.y - t.ty) > 0.05 || Math.abs(scale - t.ts) > 0.002)) {
      t.tx = t.x;
      t.ty = t.y;
      t.ts = scale;
      t.el.style.transform = `translate3d(${t.x.toFixed(1)}px, ${(t.dot ? t.y - 2 : t.y).toFixed(1)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
    }
    t.a = on ? 1 : 0;
    const op = on ? '1' : '0';
    if (op !== t.op) {
      t.op = op;
      t.el.style.opacity = op;
    }
  }

  private plantMarker(it: Item, pos: Vector3): void {
    const g = new Object3D();
    const post = new Mesh(markerGeometry(), this.markerMat);
    const lantern = new Mesh(this.lanternGeo, this.lanternMat.clone());
    (lantern.material as MeshBasicMaterial).color.set(GHOST_COLORS[it.kind]);
    lantern.position.set(0, 1.68, 0);
    g.add(post, lantern);
    const gy = this.course.ground(pos.x, -pos.z);
    g.position.set(pos.x, gy, pos.z);
    this.root.add(g);
    it.marker = g;
    const l = document.createElement('div');
    l.className = 'ghost-label marker';
    l.style.setProperty('--c', GHOST_COLORS[it.kind]);
    const who = document.createElement('span');
    // Contract C7: your own best is "Your best", never your name.
    who.textContent = it.kind === 'you' ? 'Your best' : it.name;
    who.translate = it.kind === 'you';
    l.append(who, ' wiped out here');
    this.layer.appendChild(l);
    it.markTag = newTag(l, 2);
  }
}
