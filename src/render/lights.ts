// Round 7's local lights: lamps, windows, lantern gates, lava, fireworks and the rider's own lantern
// light the snow, the rider and the riders round them. Any world system pushes the lights near the lens
// each frame; the shared lighting model reads the nearest few. Render only: nothing here touches the sim.
//
// The contract (the light lane owns the implementation and may change the internals, not these names):
//   beginLocalLights()            once a frame, before the world's systems update
//   pushLocalLight(x, y, z, r, g, b, radius, power?)   linear colour, radius in metres
//   localLights.count / .data     what the materials upload (the nearest MAX_LOCAL_LIGHTS to the focus)
//
// How it reaches the picture (materials.ts LOCAL_GLSL): every material built on the shared model takes
// localUniforms by reference, so nothing is uploaded by hand. A light falls off smoothly to nothing at its
// radius (no inverse-square spike at the lamp, no hard edge on the snow), wraps a little round a form, and
// is scaled by the palette's `lamps` (a street lamp at noon lights nothing; at dusk it owns the street).
// On Low the snow alone takes the nearest LOW_LIGHTS as painted pools and the props take none, so the
// tier draws nothing more and shades almost nothing more.
//
// A system that knows where its lights stand without being asked each frame (the terrain's lava joints)
// registers a source with addLightSource: beginLocalLights runs every source after it has cleared the
// frame, so those lights are offered first and the frame's own pushes compete with them on distance.
export const MAX_LOCAL_LIGHTS = 8;
/** How many of them Low's snow takes. */
export const LOW_LIGHTS = 4;

export interface LocalLights {
  /** Lights pushed this frame, before selection. */
  pushed: number;
  /** Lights kept (at most MAX_LOCAL_LIGHTS). */
  count: number;
  /** x, y, z, radius per kept light. */
  pos: Float32Array;
  /** r, g, b, power per kept light. */
  col: Float32Array;
}

export const localLights: LocalLights = {
  pushed: 0,
  count: 0,
  pos: new Float32Array(MAX_LOCAL_LIGHTS * 4),
  col: new Float32Array(MAX_LOCAL_LIGHTS * 4),
};

/** What the materials read, by reference: the kept lights (vec4 arrays), how many the snow takes and how
 *  many the props take (0 on Low). */
export const localUniforms = {
  uLocalPos: { value: localLights.pos },
  uLocalCol: { value: localLights.col },
  uLocalCount: { value: 0 },
  uLocalProps: { value: 0 },
};

const focus = { x: 0, y: 0, z: 0 };
const score = new Float32Array(MAX_LOCAL_LIGHTS);
let low = false;

/** Low keeps the nearest few on the snow alone (painted pools); the other tiers light everything. */
export function setLocalLightTier(isLow: boolean): void {
  low = isLow;
  sync();
}

function sync(): void {
  localUniforms.uLocalCount.value = localLights.count;
  localUniforms.uLocalProps.value = low ? 0 : localLights.count;
}

/** A standing source of lights: called once a frame with the picture's focus, it pushes what is near. */
export type LightSource = (fx: number, fy: number, fz: number) => void;
const sources: LightSource[] = [];

/** Registers a source (once: the same function twice is kept once). Returns a function that removes it. */
export function addLightSource(src: LightSource): () => void {
  if (!sources.includes(src)) sources.push(src);
  return () => {
    const i = sources.indexOf(src);
    if (i >= 0) sources.splice(i, 1);
  };
}

/** Start a frame: forget last frame's lights and say where the picture's focus is (the rider). */
export function beginLocalLights(fx = 0, fy = 0, fz = 0): void {
  focus.x = fx;
  focus.y = fy;
  focus.z = fz;
  localLights.pushed = 0;
  localLights.count = 0;
  for (let i = 0; i < sources.length; i++) sources[i](fx, fy, fz);
  sync();
}

/** Offer a light. The nearest to the focus (weighted by reach) are kept. */
export function pushLocalLight(x: number, y: number, z: number, r: number, g: number, b: number, radius: number, power = 1): void {
  if (!(radius > 0) || !(power > 0)) return;
  const L = localLights;
  L.pushed++;
  const dx = x - focus.x;
  const dy = y - focus.y;
  const dz = z - focus.z;
  const s = Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
  // (Low keeps fewer, so its few are the nearest ones.)
  const cap = low ? LOW_LIGHTS : MAX_LOCAL_LIGHTS;
  let slot = L.count;
  if (slot >= cap) {
    slot = -1;
    let worst = s;
    for (let i = 0; i < cap; i++) {
      if (score[i] > worst) {
        worst = score[i];
        slot = i;
      }
    }
    if (slot < 0) return;
  } else {
    L.count++;
  }
  score[slot] = s;
  const o = slot * 4;
  L.pos[o] = x;
  L.pos[o + 1] = y;
  L.pos[o + 2] = z;
  L.pos[o + 3] = radius;
  L.col[o] = r;
  L.col[o + 1] = g;
  L.col[o + 2] = b;
  L.col[o + 3] = power;
  sync();
}
