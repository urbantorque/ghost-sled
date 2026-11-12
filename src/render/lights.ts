// Round 7's local lights: lamps, windows, lantern gates, lava, fireworks and the rider's own lantern
// light the snow, the rider and the riders round them. Any world system pushes the lights near the lens
// each frame; the shared lighting model reads the nearest few. Render only: nothing here touches the sim.
//
// The contract (the light lane owns the implementation and may change the internals, not these names):
//   beginLocalLights()            once a frame, before the world's systems update
//   pushLocalLight(x, y, z, r, g, b, radius, power?)   linear colour, radius in metres
//   localLights.count / .data     what the materials upload (the nearest MAX_LOCAL_LIGHTS to the focus)
export const MAX_LOCAL_LIGHTS = 8;

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

const focus = { x: 0, y: 0, z: 0 };
const score = new Float32Array(MAX_LOCAL_LIGHTS);

/** Start a frame: forget last frame's lights and say where the picture's focus is (the rider). */
export function beginLocalLights(fx = 0, fy = 0, fz = 0): void {
  focus.x = fx;
  focus.y = fy;
  focus.z = fz;
  localLights.pushed = 0;
  localLights.count = 0;
}

/** Offer a light. The nearest to the focus (weighted by reach) are kept. */
export function pushLocalLight(x: number, y: number, z: number, r: number, g: number, b: number, radius: number, power = 1): void {
  const L = localLights;
  L.pushed++;
  const dx = x - focus.x;
  const dy = y - focus.y;
  const dz = z - focus.z;
  const s = Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
  let slot = L.count;
  if (slot >= MAX_LOCAL_LIGHTS) {
    slot = -1;
    let worst = s;
    for (let i = 0; i < MAX_LOCAL_LIGHTS; i++) {
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
}
