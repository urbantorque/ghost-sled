import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type ShaderMaterial,
  type WebGLRenderer,
} from 'three';
import { Mood } from '../sim/chaos';
import { makeToonMaterial, shared } from './materials';
import { RIDER_COLORS, SCARF_KNOT, riderArmGeometry, riderBodyGeometry, sledGeometryFor } from './meshes';
import { getPalette } from './palette';

// Sled shop portraits: each sled's real in-game mesh (and, for the large preview, the rider seated
// on it) drawn once by the game's own renderer into a small offscreen target, in the shared toon
// lighting under Pinecrest's golden-hour colours, then handed to the DOM as an image URL. No second
// WebGL context and no image assets. Every portrait is cached for the session, so the shop costs one
// small render per sled the first time it opens, and the read-back never stalls the GPU.

/** Render target size in device pixels: the crop around the sled is what reaches the page. */
const RT_W = 1280;
const RT_H = 854;
const FOV = 24;

interface Studio {
  scene: Scene;
  camera: PerspectiveCamera;
  rt: WebGLRenderTarget;
  rig: Group;
  sled: Mesh;
  /** The sled's own material, so a pale sled's portrait light never touches the rider. */
  sledMat: ShaderMaterial;
  rider: Group;
  shadow: Mesh;
  bowl: Mesh;
  geos: Map<number, BufferGeometry>;
}

let studio: Studio | null = null;
/** The target's GPU memory (about 25 MB with its MSAA buffer) is freed a few seconds after the last
 *  portrait; three re-creates it if the shop asks for another. */
let idle = 0;
const IDLE_MS = 4000;
const cache = new Map<string, Promise<string | null>>();
const box = new Box3();
const v = new Vector3();
const c = new Vector3();
/** The rim light every portrait shares: the low sun's warm peach-gold, so each sled reads as lit
 *  by the dusk on the shop's stage (its shade side stays the snow's cool periwinkle). */
const WARM_RIM = new Color('#FFC49A');
const WHITE = new Color(1, 1, 1);
const BLACK = new Color(0, 0, 0);

/** The shared key: Pinecrest's clear-sky sun high over the camera's left shoulder. */
const KEY_DIR = new Vector3(-0.45, 0.75, -0.5).normalize();

/**
 * Per-sled portrait light for the sleds that read poorly under the shared light: the Wisp is
 * spectral, so its shade deepens to cool navy, a soft mint rim traces it and its deck glows a little
 * from within; the pewter Tea Tray is lifted toward bright silver over a deep cool shade with a
 * strong warm rim, so it reads as polished metal catching the sunset. The Whirl Saucer's flat blue
 * face, lit from high above and washed by the warm rim at its grazing angle, went the lavender of the
 * drift behind it (a red hoop around a cream dot): a low key, no cool shade and a faint rim keep it
 * a saturated cobalt, and a decal paints it as a glossy bowl (BOWL). The pearl Comet Bob read as a
 * white lump, then as a grey-faceted capsule: its shell is shaded smooth here (`smooth`, its flat
 * facets each caught the studio light differently), a near-white key from in front and to its left
 * models its nose and flanks, the shell is brought down toward blue pearl so the light has a range
 * to work in, and a vermillion rim traces its outline. Every other sled keeps its own colours and the
 * shared key. (A rim colour applies to the bare sled only: with the rider seated the rim stays warm,
 * or it would tint the rider.)
 */
const SLED_LOOK: Record<number, { cool: number; rim: number; rimColor?: Color; glow?: Color; glowK?: number; tint?: Color; key?: Vector3; white?: number; bowl?: boolean; smooth?: Color }> = {
  1: { cool: 0.05, rim: 0.3, tint: new Color(0.8, 0.95, 1.22), key: new Vector3(-0.6, 0.14, -0.79).normalize(), bowl: true },
  3: { cool: 0.95, rim: 1.6, rimColor: new Color('#FF5A3C'), tint: new Color(0.7, 0.78, 1.0), key: new Vector3(-0.8, 0.5, -0.6).normalize(), white: 0.85, smooth: new Color('#D3DDF2') },
  4: { cool: 0.95, rim: 1.8, rimColor: new Color('#8FF3E4'), glow: new Color('#4FD9C4'), glowK: 0.34, tint: new Color(0.62, 1.0, 0.92) },
  5: { cool: 0.9, rim: 1.8, glow: new Color('#8EA4E6'), glowK: 0.16, tint: new Color(1.34, 1.4, 1.52) },
};

/** The saucer's dish face in sled space: its centre, the height just over it, and the radius inside
 *  the vermillion rim (meshes.ts: a 0.62 m face under a 0.6 m torus rim). */
const BOWL = { x: 0, y: 0.1312, z: 0.05, r: 0.585 };

/**
 * The portrait of a sled as an object URL (a transparent PNG cropped to the sled and its contact
 * shadow), or null when the renderer cannot draw one (a lost context, no canvas encoder).
 * `seated` puts the rider on it, in the in-game seated pose, for the shop's large preview.
 */
export function sledPortrait(r: WebGLRenderer, id: number, seated: boolean): Promise<string | null> {
  const key = `${id}:${seated ? 1 : 0}`;
  let p = cache.get(key);
  if (!p) {
    p = draw(r, id, seated).catch(() => null);
    cache.set(key, p);
    // A failed portrait (a context lost mid-render) is tried again the next time it is asked for.
    void p.then((u) => {
      if (!u) cache.delete(key);
    });
  }
  return p;
}

function toon(): ShaderMaterial {
  // The rider's own toon setup. The prop dissolves (near the lens, in the line of sight to the
  // player) are switched off: the portrait camera sits a few metres off, looking straight at it.
  const m = makeToonMaterial({ coolShade: 0.5, rim: 0.8, nearFade: [0.001, 0.002] });
  m.uniforms.uFocus = { value: new Vector3(0, 1e6, 0) };
  return m;
}

/** The scarf's two tails at rest, trailing back off the knot as if in a light breeze. */
function scarfGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const a = RIDER_COLORS.accent;
  const tails: Array<[number, number]> = [
    [1, 6],
    [-1, 5],
  ];
  for (const [side, n] of tails) {
    const first = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      // Back (+z) and down from the knot, flaring a little to its own side, with a soft wave.
      const x = SCARF_KNOT.x + side * (0.03 + 0.07 * u) + Math.sin(u * 5 + side) * 0.03;
      const y = SCARF_KNOT.y - 0.05 - 0.22 * u * u;
      const z = SCARF_KNOT.z + 0.04 + 0.6 * u * (side > 0 ? 1 : 0.8);
      const w = 0.075 * (1 - 0.45 * u) * (u < 0.15 ? 0.6 + u * 2.6 : 1);
      const k = i === n - 2 ? 0.74 : u < 0.2 ? 0.86 : 1;
      pos.push(x - w, y + w * 0.35, z, x + w, y - w * 0.35, z);
      col.push(a.r * k, a.g * k, a.b * k, a.r * k, a.g * k, a.b * k);
      if (i > 0) {
        const b = first + (i - 1) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A white radial alpha gradient (opaque core to `mid` at half radius, clear at the edge). */
function softDisc(mid: number): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.5, `rgba(255,255,255,${mid})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * A soft periwinkle contact shadow (ART.md section 2) on a ground quad, dense at its core and wider
 * than the sled, so it shows past the sled's near edge from the portrait's low angle (under a flat
 * saucer it hid entirely, and every tile sled seemed to float over the drift).
 */
function shadowMesh(): Mesh {
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: softDisc(0.85), color: new Color('#1A2464'), transparent: true, opacity: 0.95, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = -1;
  return m;
}

/**
 * Shades the faces of one vertex colour smooth (a portrait's own copy of a sled mesh): every vertex of
 * that colour at one position takes the average of its faces' normals. Runs once per sled a session.
 */
function smoothFaces(geo: BufferGeometry, col: Color): void {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const clr = geo.getAttribute('color');
  if (!pos || !nrm || !clr) return;
  const sums = new Map<string, Vector3>();
  const keys: Array<string | null> = [];
  for (let i = 0; i < pos.count; i++) {
    const hit = Math.abs(clr.getX(i) - col.r) + Math.abs(clr.getY(i) - col.g) + Math.abs(clr.getZ(i) - col.b) < 0.02;
    const k = hit ? `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}` : null;
    keys.push(k);
    if (!k) continue;
    let sum = sums.get(k);
    if (!sum) sums.set(k, (sum = new Vector3()));
    sum.x += nrm.getX(i);
    sum.y += nrm.getY(i);
    sum.z += nrm.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const sum = keys[i] ? sums.get(keys[i]!) : undefined;
    if (!sum) continue;
    const l = sum.length() || 1;
    nrm.setXYZ(i, sum.x / l, sum.y / l, sum.z / l);
  }
  nrm.needsUpdate = true;
}

/**
 * The saucer's dish as a glossy bowl (portrait only): a decal over its flat face with the near inner
 * wall in shade under the rim, the far wall catching the light, a soft inner shadow all round the rim
 * and a crisp specular arc on the far wall, so the dish reads as a solid, deep object rather than a
 * disc the colour of the snow behind it. The canvas top is the near (-z) edge, its right +x.
 */
function bowlMesh(): Mesh {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  if (g) {
    g.beginPath();
    g.arc(128, 128, 127, 0, Math.PI * 2);
    g.clip();
    const wall = g.createLinearGradient(40, 0, 216, 256);
    wall.addColorStop(0, 'rgba(8, 18, 64, 0.62)');
    wall.addColorStop(0.42, 'rgba(8, 18, 64, 0.14)');
    wall.addColorStop(0.7, 'rgba(150, 196, 255, 0.06)');
    wall.addColorStop(1, 'rgba(176, 214, 255, 0.4)');
    g.fillStyle = wall;
    g.fillRect(0, 0, 256, 256);
    const lip = g.createRadialGradient(128, 128, 84, 128, 128, 128);
    lip.addColorStop(0, 'rgba(8, 18, 64, 0)');
    lip.addColorStop(0.75, 'rgba(8, 18, 64, 0.2)');
    lip.addColorStop(1, 'rgba(8, 18, 64, 0.58)');
    g.fillStyle = lip;
    g.fillRect(0, 0, 256, 256);
    // The seat pad's own soft shadow, cast away from the key, so it reads as a raised cushion and
    // not as a pale dot printed on the dish.
    const pad = g.createRadialGradient(136, 136, 38, 136, 136, 66);
    pad.addColorStop(0, 'rgba(8, 18, 64, 0.5)');
    pad.addColorStop(1, 'rgba(8, 18, 64, 0)');
    g.fillStyle = pad;
    g.fillRect(64, 64, 144, 144);
    // The specular arc: a few strokes, wide and faint to narrow and bright, read as one soft-edged
    // highlight with a crisp core (canvas filters are not everywhere).
    g.lineCap = 'round';
    for (const [w, a] of [
      [26, 0.08],
      [16, 0.18],
      [9, 0.42],
      [4.5, 0.95],
    ]) {
      g.strokeStyle = `rgba(255, 255, 255, ${a})`;
      g.lineWidth = w;
      g.beginPath();
      g.arc(128, 128, 96, Math.PI * 0.56, Math.PI * 0.88);
      g.stroke();
    }
    const dot = g.createRadialGradient(112, 222, 0, 112, 222, 16);
    dot.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    dot.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = dot;
    g.fillRect(88, 198, 48, 48);
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(
    new PlaneGeometry(BOWL.r * 2, BOWL.r * 2),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(BOWL.x, BOWL.y, BOWL.z);
  m.renderOrder = 1;
  m.visible = false;
  return m;
}

function setup(r: WebGLRenderer): Studio {
  const mat = toon();
  const sledMat = toon();
  const scarfMat = makeToonMaterial({ coolShade: 0.35, doubleSided: true, rim: 0.15, nearFade: [0.001, 0.002] });
  scarfMat.uniforms.uFocus = { value: new Vector3(0, 1e6, 0) };
  const sled = new Mesh(sledGeometryFor(0), sledMat);
  // The rider as rider.ts seats it at rest: body pivot over the deck, leaning back a touch, the arms
  // relaxed down and forward to the knees, a little out from the hips (rider.ts: positive x swings a
  // hanging arm forward; a negative one held them back like a skier's poles).
  const body = new Group();
  body.position.set(0, 0.24, 0.1);
  body.rotation.x = -0.15;
  const armGeo = riderArmGeometry();
  const armL = new Mesh(armGeo, mat);
  const armR = new Mesh(armGeo, mat);
  armL.position.set(-0.27, 0.56, 0);
  armR.position.set(0.27, 0.56, 0);
  armL.rotation.set(0.72, 0, -0.3);
  armR.rotation.set(0.72, 0, 0.3);
  body.add(new Mesh(riderBodyGeometry(), mat), armL, armR, new Mesh(scarfGeometry(), scarfMat));
  const rider = new Group();
  rider.add(body);
  const bowl = bowlMesh();
  const rig = new Group();
  rig.add(sled, bowl, rider);
  const shadow = shadowMesh();
  const scene = new Scene();
  scene.add(shadow, rig);
  // sRGB storage, so the GPU encodes on write and blends in linear light, like the main frame.
  const samples = r.capabilities.isWebGL2 ? 4 : 0;
  const rt = new WebGLRenderTarget(RT_W, RT_H, { samples, colorSpace: SRGBColorSpace });
  return { scene, camera: new PerspectiveCamera(FOV, RT_W / RT_H, 0.1, 60), rt, rig, sled, sledMat, rider, shadow, bowl, geos: new Map([[0, sled.geometry]]) };
}

/** The shared lighting uniforms this module overrides for its one render, saved to put back. */
const SAVED = {
  sunDir: new Vector3(),
  sunColor: new Color(),
  hemi: new Color(),
  rim: new Color(),
  shadeTint: new Color(),
  fogNear: 0,
  fogFar: 0,
  lantern: 0,
  clear: new Color(),
  clearAlpha: 1,
};

async function draw(r: WebGLRenderer, id: number, seated: boolean): Promise<string | null> {
  if (r.getContext().isContextLost()) return null;
  const s = (studio ??= setup(r));
  const look = SLED_LOOK[id];
  let geo = s.geos.get(id);
  if (!geo) {
    geo = sledGeometryFor(id);
    if (look?.smooth) smoothFaces(geo, look.smooth);
    s.geos.set(id, geo);
  }
  s.sled.geometry = geo;
  s.rider.visible = seated;
  s.bowl.visible = false;

  // The contact shadow spans the sled's footprint (and the rider's, seated), with a margin all round
  // that the low camera sees past the sled's near edge.
  s.shadow.visible = false;
  s.rig.updateMatrixWorld(true);
  box.setFromObject(s.rig, true);
  box.getSize(v);
  box.getCenter(c);
  s.shadow.visible = true;
  s.bowl.visible = !!look?.bowl;
  s.shadow.position.set(c.x, 0.004, c.z - 0.08);
  s.shadow.scale.set(v.x * 1.15 + 0.22, v.z * 1.12 + 0.4, 1);

  // A three-quarter hero view from the front right and a little above (about 17 degrees), the nose
  // coming toward the lens on the right, so each sled shows its nose, its near side and its deck as
  // a solid object rather than a flat plan; the large preview sits a touch lower, nearer the rider's
  // eye line.
  const cam = s.camera;
  const dir = v.set(seated ? 0.95 : 0.8, seated ? 0.3 : 0.4, -1).normalize();
  box.expandByObject(s.shadow);
  const radius = box.getSize(new Vector3()).length() / 2;
  const dist = (radius / Math.sin(((FOV / 2) * Math.PI) / 180)) * 1.02;
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.lookAt(c);
  cam.updateMatrixWorld();

  // Studio light, the same small rig for every portrait: Pinecrest's clear-sky key light high over
  // the camera's left shoulder, so the top and the near side are lit and the nose turns into the
  // cool shade, and the low sun's warm rim along every silhouette, like the stage's dusk behind it.
  // A sled that reads poorly under it gets its own touch (SLED_LOOK).
  const sm = s.sledMat.uniforms;
  sm.uCool.value = look?.cool ?? 0.5;
  sm.uRimK.value = look?.rim ?? 1.0;
  sm.uTint.value.copy(look?.tint ?? WHITE);
  sm.uEmissive.value.copy(look?.glow ?? BLACK);
  sm.uEmissiveStrength.value = look?.glowK ?? 0;
  const p = getPalette('alpine', Mood.None);
  const u = shared;
  SAVED.sunDir.copy(u.uSunDir.value);
  SAVED.sunColor.copy(u.uSunColor.value);
  SAVED.hemi.copy(u.uHemi.value);
  SAVED.rim.copy(u.uRim.value);
  SAVED.shadeTint.copy(u.uShadeTint.value);
  SAVED.fogNear = u.uFogNear.value;
  SAVED.fogFar = u.uFogFar.value;
  SAVED.lantern = u.uLantern.value;
  r.getClearColor(SAVED.clear);
  SAVED.clearAlpha = r.getClearAlpha();
  const prevTarget = r.getRenderTarget();
  const prevAuto = r.autoClear;
  u.uSunDir.value.copy(look?.key ?? KEY_DIR);
  // The golden-hour key a third of the way to white: a pale shell or a spectral deck keeps its own
  // colour instead of turning to sand, and wood still reads warm.
  u.uSunColor.value.copy(p.sunColor).lerp(WHITE, look?.white ?? 0.35);
  u.uHemi.value.copy(p.hemiSky);
  // The rim colour is one shared uniform, so with the rider seated it stays the warm one: a mint rim
  // would tint the rider like a ghost.
  u.uRim.value.copy((!seated && look?.rimColor) || WARM_RIM);
  u.uShadeTint.value.copy(p.snowShade).lerp(p.snowDeep, 0.5);
  u.uFogNear.value = 1e4;
  u.uFogFar.value = 2e4;
  u.uLantern.value = 0;
  try {
    r.setRenderTarget(s.rt);
    r.setClearColor(0x000000, 0);
    r.autoClear = true;
    r.clear();
    r.render(s.scene, cam);
  } finally {
    u.uSunDir.value.copy(SAVED.sunDir);
    u.uSunColor.value.copy(SAVED.sunColor);
    u.uHemi.value.copy(SAVED.hemi);
    u.uRim.value.copy(SAVED.rim);
    u.uShadeTint.value.copy(SAVED.shadeTint);
    u.uFogNear.value = SAVED.fogNear;
    u.uFogFar.value = SAVED.fogFar;
    u.uLantern.value = SAVED.lantern;
    r.setRenderTarget(prevTarget);
    r.setClearColor(SAVED.clear, SAVED.clearAlpha);
    r.autoClear = prevAuto;
  }

  // Read back without stalling the frame (a fence, then a mapped copy), then crop and encode.
  const px = new Uint8Array(RT_W * RT_H * 4);
  if (typeof r.readRenderTargetPixelsAsync === 'function') await r.readRenderTargetPixelsAsync(s.rt, 0, 0, RT_W, RT_H, px);
  else r.readRenderTargetPixels(s.rt, 0, 0, RT_W, RT_H, px);
  window.clearTimeout(idle);
  idle = window.setTimeout(() => s.rt.dispose(), IDLE_MS);
  return encode(px);
}

/** Crops the pixels to what was drawn, flips them upright, undoes the premultiplied edges and
 *  encodes a PNG object URL. */
function encode(px: Uint8Array): Promise<string | null> {
  let x0 = RT_W;
  let y0 = RT_H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < RT_H; y++) {
    const row = y * RT_W * 4;
    for (let x = 0; x < RT_W; x++) {
      if (px[row + x * 4 + 3] > 4) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return Promise.resolve(null);
  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(RT_W - 1, x1 + pad);
  y1 = Math.min(RT_H - 1, y1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (!g) return Promise.resolve(null);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    // WebGL rows run bottom up.
    const src = ((y1 - y) * RT_W + x0) * 4;
    const dst = y * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      const a = px[src + x + 3];
      d[dst + x + 3] = a;
      if (a === 0) continue;
      const k = a === 255 ? 1 : 255 / a;
      d[dst + x] = Math.min(255, px[src + x] * k);
      d[dst + x + 1] = Math.min(255, px[src + x + 1] * k);
      d[dst + x + 2] = Math.min(255, px[src + x + 2] * k);
    }
  }
  g.putImageData(img, 0, 0);
  return new Promise((resolve) => {
    if (typeof cv.toBlob !== 'function') {
      resolve(cv.toDataURL('image/png'));
      return;
    }
    cv.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/png');
  });
}
