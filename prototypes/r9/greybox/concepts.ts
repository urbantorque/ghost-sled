import { Kit, SceneDef, clamp, hash, lerp, noise1, noise2, smooth } from './kit';

// The seven concepts for round 9's three new mountains, as greybox ground and pieces: each one's opening and one
// place, from the chase lens, in the five's greys (notes/r9-concepts.md has every concept's page). These are
// pictures of a shape, not courses: the numbers are the concepts' own (lengths, grades, widths, heights), so the
// frame shows what the page says.

const TREE = 0.32;
const ROCK = 0.46;
const WOOD = 0.42;

function pine(k: Kit, x: number, y: number, z: number, s: number): void {
  k.cyl(x, y, z, 0.2, 0.3, 2.4 * s, 0.3, 5);
  k.cone(x, y + 1.8 * s, z, 2.0 * s, 4.6 * s, TREE, 6);
  k.cone(x, y + 4.2 * s, z, 1.45 * s, 3.6 * s, TREE, 6);
  k.cone(x, y + 6.2 * s, z, 0.85 * s, 2.8 * s, TREE, 6);
}

// =================================================================== 1. The Old Run: a banked ice track

const OR_GRADE = 0.17;
const OR_FLOOR = 2.6;
const OR_WALL = 4.4;
const OR_LAMBDA = 200;

function orAmp(z: number): number {
  return 16 * smooth(150, 300, z);
}
function orCentre(z: number): number {
  return orAmp(z) * Math.sin((2 * Math.PI * z) / OR_LAMBDA);
}
function orCurve(z: number): number {
  const e = 2;
  return (orCentre(z + e) + orCentre(z - e) - 2 * orCentre(z)) / (e * e);
}
/** The wall's height on one side (+1 right): the outside of a bend banks up to seven and a half metres. */
function orWallH(z: number, side: number): number {
  const k = orCurve(z);
  const outside = k < 0 ? 1 : -1;
  return side === outside ? 3 + Math.min(4.5, Math.abs(k) * 300) : 2.6;
}
function orHill(u: number, z: number): number {
  return -0.8 - 0.14 * u + 0.6 * noise2(3, u / 14, z / 18);
}
function orGround(x: number, z: number): number {
  const base = -OR_GRADE * z;
  const u = x - orCentre(z);
  const a = Math.abs(u);
  const side = u >= 0 ? 1 : -1;
  const h = orWallH(z, side);
  const lip = OR_FLOOR + OR_WALL;
  if (z < -6) return base + Math.max(orHill(u, z), 0);
  if (a <= OR_FLOOR) return base + 0.15 * (a / OR_FLOOR) ** 2;
  if (a <= lip) {
    const t = (a - OR_FLOOR) / OR_WALL;
    return base + 0.15 + h * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  }
  if (a <= lip + 0.7) return base + 0.15 + h;
  return base + Math.max(orHill(u, z), 0.15 + h - 1.4 * (a - lip - 0.7));
}

const oldRun: SceneDef = {
  id: 'oldrun',
  title: 'The Old Run',
  ground: orGround,
  centre: orCentre,
  line: orCentre,
  half: 90,
  ahead: 800,
  paint(x, _y, z, ny) {
    const u = Math.abs(x - orCentre(z));
    if (z > -6 && u < OR_FLOOR) return 0.84;
    if (z > -6 && u < OR_FLOOR + OR_WALL) {
      // The glaze: the polished band high on the wall that a fast line keeps to.
      const t = (u - OR_FLOOR) / OR_WALL;
      return t > 0.55 && t < 0.92 ? 0.97 : 0.86;
    }
    if (z > -6 && u < OR_FLOOR + OR_WALL + 0.7) return 0.6;
    return ny < 0.6 ? 0.5 : 0.9;
  },
  props(k, z0, z1) {
    // The forest the run is cut through, standing close past the embankments.
    for (let z = Math.max(-80, z0); z < z1; z += 2.6) {
      for (const side of [-1, 1]) {
        for (let n = 0; n < 6; n++) {
          if (hash(Math.round(z * 10), side, n) < 0.3) continue;
          const u = side * (10.5 + n * 5 + hash(Math.round(z * 10), side, n + 20) * 4.5);
          const x = orCentre(z) + u;
          const zz = z + hash(Math.round(z * 7), n, side) * 2.6;
          pine(k, x, orGround(x, zz) - 0.3, zz, 1 + 0.5 * hash(n, Math.round(z), side));
        }
      }
    }
    // Iron lamps on the parapet, every 22 m on the outside of each bend.
    for (let z = Math.max(0, Math.ceil(z0 / 22) * 22); z < z1; z += 22) {
      const k2 = orCurve(z);
      const side = k2 < 0 ? 1 : -1;
      const x = orCentre(z) + side * (OR_FLOOR + OR_WALL + 0.35);
      const y = orGround(x, z);
      k.cyl(x, y, z, 0.07, 0.09, 3.6, 0.25, 5);
      k.box(x, y + 3.6, z, 0.45, 0.55, 0.45, 0.3);
    }
    // The start house over the track's head, and the grand hotel up the hill behind it.
    if (z0 < 40) {
      const y = orGround(0, -4);
      for (const side of [-1, 1]) k.box(side * 7.6, y - 1, -4, 1.2, 6.5, 9, WOOD);
      k.house(0, y + 5, -4, 16.5, 9, 0.6, 2.6, WOOD, 0.36);
      k.house(-18, orGround(-18, -70) - 2, -70, 46, 18, 16, 8, 0.6, 0.38, true);
    }
    // A timber footbridge over the track, as every bend has a place.
    for (const zb of [430, 1030]) {
      if (zb < z0 || zb > z1) continue;
      const y = -OR_GRADE * zb + 7.2;
      k.box(orCentre(zb), y, zb, 22, 0.5, 2.4, WOOD);
      for (const side of [-1, 1]) k.box(orCentre(zb) + side * 8.6, -OR_GRADE * zb, zb, 0.5, 7.2, 0.5, WOOD);
    }
  },
  far(k, cam) {
    // The lake far below in the valley, the town on its shore, the far side's long forested ridge.
    const lake = cam.y - 640;
    k.sheet(cam.x - 9000, cam.z + 900, cam.x + 9000, cam.z + 9000, lake, 0.8);
    for (let i = 0; i < 60; i++) {
      const x = cam.x - 400 + hash(i, 3) * 1300;
      const z = cam.z + 1500 + hash(i, 4) * 500;
      k.house(x, lake, z, 14, 18, 10, 6, 0.65, 0.42);
    }
    for (let i = 0; i < 26; i++) {
      const x = cam.x - 7000 + i * 560;
      k.peak(x, lake - 20, cam.z + 6500 + hash(i, 6) * 1500, 900, 700 + hash(i, 7) * 500, 0.5, 5, hash(i, 8) * 3, 1.6);
    }
  },
  look: { zenith: 0.52, horizon: 0.86, fog: 0.82, fogNear: 90, fogFar: 7000, sunAz: -55, sunEl: 17, sun: 2.4, ambient: 0.85 },
  views: [
    { key: 'opening', name: 'Out of the start house, the first straight', z: 24, speed: 20 },
    { key: 'place', name: 'High on the wall through the Horseshoe', z: 646, off: 6.1, speed: 38, roll: 16, inward: 1.8, back: 5.5 },
  ],
};

// =================================================================== 2. Gullhaven: sea cliffs, updrafts, a harbour

const GH_SEA = -950;
const GH_GULLIES = [330, 770, 1200, 1660, 2080];
const GH_GAP = 84;
const GH_DROP = 26;
const GH_DETOUR = 15;

function ghCoast(z: number): number {
  return 26 * Math.sin(z / 900) - 0.00007 * Math.max(0, z - 150) ** 2;
}
function ghDetour(z: number): number {
  let d = 0;
  for (const g of GH_GULLIES) d += smooth(g - 90, g + 5, z) * (1 - smooth(g + GH_GAP - 5, g + GH_GAP + 90, z));
  return GH_DETOUR * d;
}
function ghLine(z: number): number {
  return ghCoast(z) - ghDetour(z);
}
/** The clifftop's height: shelves at 0.16 that step down at every gully. Inland the step is the path's ramp. */
function ghShelf(z: number, x: number): number {
  let y = -0.16 * z;
  const head = ghCoast(z) - 4;
  const notch = smooth(head - 6, head + 6, x);
  for (const g of GH_GULLIES) {
    if (z <= g) continue;
    const ramp = GH_DROP * smooth(g - 20, g + GH_GAP + 40, z);
    const step = z >= g + GH_GAP ? GH_DROP : 0;
    y -= lerp(ramp, step, notch);
  }
  return y;
}
function ghGround(x: number, z: number): number {
  const c = ghCoast(z);
  let y = ghShelf(z, x) + 0.5 * noise2(11, x / 9, z / 11);
  // Inland, the moor climbs away from the sea.
  const inland = c - 30 - x;
  if (inland > 0) y += 0.22 * inland + 3 * noise2(12, x / 40, z / 50);
  // The gully: a notch in the cliff from the sea side, its floor a steep chute to the far shelf.
  for (const g of GH_GULLIES) {
    const head = c - 4;
    if (z < g - 2 || z > g + GH_GAP + 2 || x < head - 8) continue;
    const t = clamp((z - g) / GH_GAP, 0, 1);
    const shelfNear = -0.16 * g - GH_DROP * GH_GULLIES.filter((q) => q < g).length;
    const shelfFar = shelfNear - 0.16 * GH_GAP - GH_DROP;
    const floor = lerp(shelfNear - 0.5 * GH_DROP, shelfFar, t) - 6 * Math.sin(Math.PI * t) - 0.03 * (x - head);
    const into = smooth(head - 8, head + 2, x) * smooth(g - 2, g + 1.5, z) * (1 - smooth(g + GH_GAP - 1.5, g + GH_GAP + 2, z));
    y = lerp(y, Math.min(y, floor), into);
  }
  // The cliff edge, and a fall of hundreds of metres to the sea.
  const edge = c + 24 + 6 * noise1(13, z / 60);
  if (x > edge) y = Math.max(GH_SEA, y - (x - edge) * 4.2 - 30 * smooth(edge, edge + 40, x));
  // Across the bay, the next cape: a long ridge out of the sea, its cliff toward the run.
  const across = x - (ghCoast(z) + 520 + 0.25 * z);
  if (across > -120) y = Math.max(y, GH_SEA + Math.min(640, 9 * (across + 120)) - 0.3 * Math.max(0, z - 600) + 40 * noise2(14, x / 90, z / 120));
  return y;
}

const gullhaven: SceneDef = {
  id: 'gullhaven',
  title: 'Gullhaven',
  ground: ghGround,
  centre: (z) => ghCoast(z) + 10,
  line: ghLine,
  half: 900,
  ahead: 1400,
  paint(_x, y, _z, ny) {
    if (y < GH_SEA + 2) return 0.34;
    return ny < 0.45 ? 0.36 : ny < 0.7 ? 0.55 : 0.9;
  },
  props(k, z0, z1) {
    // The old beacon tower at the head of the cape, where the run starts.
    if (z0 < 30) {
      const x = ghCoast(-30) + 9;
      k.cyl(x, ghGround(x, -30) - 1, -30, 4.2, 5, 15, 0.5, 9);
      k.box(ghCoast(-12) - 14, ghGround(ghCoast(-12) - 14, -12) - 0.5, -12, 7, 3.4, 9, 0.55);
    }
    // Snow-fence posts along the cliff edge, a dry-stone dyke on the moor.
    for (let z = Math.max(-20, Math.ceil(z0 / 7) * 7); z < z1; z += 7) {
      const xe = ghCoast(z) + 21;
      const inGully = GH_GULLIES.some((g) => z > g - 6 && z < g + GH_GAP + 6);
      if (!inGully) k.cyl(xe, ghGround(xe, z) - 0.2, z, 0.07, 0.08, 1.6, 0.3, 4);
      const xd = ghCoast(z) - 26;
      k.box(xd, ghGround(xd, z) - 0.3, z, 0.9, 1.3, 7.2, 0.45);
    }
    // Gulls hanging still in the updraft over each gully (what tells a rider the wind is lifting there).
    for (const g of GH_GULLIES) {
      if (g < z0 || g > z1) continue;
      for (let n = 0; n < 7; n++) {
        const x = ghCoast(g) + 4 + hash(g, n) * 30;
        const z = g + 10 + hash(g, n, 1) * 60;
        k.box(x, ghShelf(g, x) + 6 + hash(g, n, 2) * 18, z, 1.3, 0.08, 0.35, 0.25, hash(g, n, 3));
      }
      // Rock ribs down the gully's walls.
      for (let n = 0; n < 6; n++) {
        const x = ghCoast(g) + 2 + n * 6;
        k.box(x, ghShelf(g, ghCoast(g) - 20) - 9, g - 1, 3.5, 9, 2.5, ROCK, 0.3 * n);
      }
    }
  },
  far(k, cam) {
    // The sea to the horizon, stacks standing out of it, headlands receding down the coast, the harbour far below.
    k.sheet(cam.x - 2000, cam.z - 4000, cam.x + 40000, cam.z + 40000, GH_SEA, 0.34);
    for (let i = 0; i < 14; i++) {
      const x = cam.x + 260 + hash(i, 1) * 2200;
      const z = cam.z + 200 + hash(i, 2) * 4200;
      const r = 25 + hash(i, 3) * 45;
      k.cyl(x, GH_SEA, z, r * 0.8, r, 120 + hash(i, 4) * 300, 0.4, 6, hash(i, 5) * 3);
    }
    const hz = cam.z + 4600;
    k.cyl(cam.x + 380, GH_SEA, hz, 6, 8, 40, 0.75, 8);
    for (let i = 0; i < 40; i++) k.house(cam.x + 120 + hash(i, 9) * 300, GH_SEA, hz - 300 + hash(i, 10) * 400, 10, 14, 8, 5, 0.6, 0.35);
    // A storm deck over the sea: a ceiling of cloud with the low sun under its edge.
    k.sheet(cam.x - 3000, cam.z + 600, cam.x + 20000, cam.z + 20000, cam.y + 900, 0.42);
  },
  look: { zenith: 0.1, horizon: 0.7, fog: 0.55, fogNear: 260, fogFar: 9000, sunAz: 38, sunEl: 9, sun: 2.8, ambient: 0.6 },
  views: [
    { key: 'opening', name: 'From the beacon: the first shelf and the sea', z: 40, off: 9, speed: 24, turn: 24 },
    { key: 'place', name: 'At the lip of the second gully: the gap, the far shelf, the sea', z: 764, off: GH_DETOUR + 6, speed: 31, back: 7, up: 1.5, turn: 14 },
  ],
};

// =================================================================== 3. Gablefall: the roofs of a hill town

const GF_GRADE = 0.22;
const GF_STREET = 3.8;
const GF_DEPTH = 11;

function gfCentre(z: number): number {
  return 6 * Math.sin(z / 140);
}
function gfStreet(z: number): number {
  return -GF_GRADE * z;
}
/** The houses down one side: blocks of four to six, alleys between them; each house's roof a step under the last. */
interface Block {
  z0: number;
  z1: number;
  top: number;
}
const gfBlocks: Record<number, Block[]> = { [-1]: [], [1]: [] };
for (const side of [-1, 1]) {
  let z = side < 0 ? 6 : -4;
  let n = 0;
  while (z < 1600) {
    const len = 34 + hash(n, side, 1) * 28;
    const top = 6.8 + hash(n, side, 2) * 2;
    gfBlocks[side].push({ z0: z, z1: z + len, top });
    z += len + 7 + hash(n, side, 3) * 5;
    n++;
  }
}
function gfRoof(side: number, z: number): { y: number; ok: boolean } {
  for (const b of gfBlocks[side]) {
    if (z < b.z0 || z > b.z1) continue;
    // Each house ten metres long, its snow ridge level, the next a step lower: a stair of roofs down the block.
    const house = Math.floor((z - b.z0) / 10);
    return { y: gfStreet(b.z0) + b.top - house * 1.9, ok: true };
  }
  return { y: 0, ok: false };
}
function gfGround(x: number, z: number): number {
  const u = x - gfCentre(z);
  const a = Math.abs(u);
  const side = u >= 0 ? 1 : -1;
  const st = gfStreet(z);
  // The church on the hill: the nave's ridge on the left row's line, where the run starts.
  if (z < 0) {
    const nu = Math.abs(u + GF_STREET + GF_DEPTH / 2);
    const ridge = gfStreet(0) + 11 - 0.12 * z;
    if (z > -64 && nu < 6.5) return ridge - 0.42 * nu;
    return gfStreet(0) + 1.5 - 0.1 * z + (u < -20 ? 0.35 * (-u - 20) : 0);
  }
  if (a < GF_STREET) return st;
  if (a < GF_STREET + GF_DEPTH) {
    const r = gfRoof(side, z);
    if (!r.ok) return st;
    const mid = GF_STREET + GF_DEPTH / 2;
    // A pitched roof under its snow: a rounded ridge, straight pitches down to the eaves.
    const d = Math.abs(a - mid) / (GF_DEPTH / 2);
    return r.y - (d < 0.12 ? 0.6 * (d / 0.12) ** 2 * 0.12 : 0.072 + 2.9 * (d - 0.12));
  }
  // Behind the row, the hillside: up to the left, down to the right, with the town on it.
  return st + (side < 0 ? 2 + 0.3 * (a - GF_STREET - GF_DEPTH) : -3 - 0.32 * (a - GF_STREET - GF_DEPTH));
}

const gablefall: SceneDef = {
  id: 'gablefall',
  title: 'Gablefall',
  ground: gfGround,
  centre: gfCentre,
  line: (z) => gfCentre(z) - GF_STREET - GF_DEPTH / 2,
  half: 120,
  ahead: 700,
  paint(x, _y, z, ny) {
    const u = Math.abs(x - gfCentre(z));
    if (z >= 0 && u < GF_STREET) return 0.72;
    return ny < 0.5 ? 0.55 : ny < 0.75 ? 0.8 : 0.93;
  },
  props(k, z0, z1) {
    // The church: the steeple behind the nave's west end.
    if (z0 < 0) {
      const x = gfCentre(-70) - GF_STREET - GF_DEPTH / 2;
      k.box(x, gfStreet(0), -72, 8, 34, 8, 0.6);
      k.peak(x, gfStreet(0) + 34, -72, 5.6, 14, 0.4, 4, Math.PI / 4);
    }
    // Chimneys and dormers on the roofs, off the ridge.
    for (const side of [-1, 1]) {
      for (const b of gfBlocks[side]) {
        if (b.z1 < z0 || b.z0 > z1) continue;
        for (let z = b.z0 + 3; z < b.z1 - 2; z += 10) {
          const r = gfRoof(side, z);
          const off = (hash(Math.round(z), side, 5) > 0.5 ? 1 : -1) * (2.4 + hash(Math.round(z), side, 6) * 1.6);
          const x = gfCentre(z) + side * (GF_STREET + GF_DEPTH / 2) + off;
          k.box(x, r.y - 1.2, z + 2, 0.9, 2.6, 0.9, 0.4);
        }
        // The alley's gable ends, faces of the houses either side of the gap.
        k.box(gfCentre(b.z1) + side * (GF_STREET + GF_DEPTH / 2), gfStreet(b.z1), b.z1, GF_DEPTH, gfRoof(side, b.z1 - 0.5).y - gfStreet(b.z1) - 1.5, 0.3, 0.58);
      }
    }
    // The town beyond the rows: roofs up the hill to the left, down to the river on the right.
    for (let z = Math.max(-40, z0); z < z1; z += 13) {
      for (const side of [-1, 1]) {
        for (let row = 1; row < 5; row++) {
          if (hash(Math.round(z), side, row) < 0.2) continue;
          const u = side * (GF_STREET + GF_DEPTH + 5 + row * 13);
          const x = gfCentre(z) + u;
          k.house(x, gfGround(x, z) - 1, z, 10, 11, 6 + hash(row, Math.round(z)) * 4, 4, 0.64, 0.86);
        }
      }
    }
  },
  far(k, cam) {
    // The valley's other side: more of the town climbing it, a viaduct over the river, no peaks (the cloud is down).
    for (let i = 0; i < 160; i++) {
      const x = cam.x + 260 + hash(i, 1) * 700;
      const z = cam.z - 200 + hash(i, 2) * 1600;
      const y = cam.y - 60 + (x - cam.x - 260) * 0.35 - (z - cam.z) * 0.12;
      k.house(x, y, z, 12, 12, 8, 5, 0.66, 0.88);
    }
    k.sheet(cam.x + 150, cam.z - 2000, cam.x + 4000, cam.z + 6000, cam.y - 120, 0.82);
    for (let i = 0; i < 9; i++) k.box(cam.x + 200, cam.y - 125, cam.z + 300 + i * 26, 12, 34, 4, 0.55);
    k.box(cam.x + 200, cam.y - 91, cam.z + 300 + 104, 12, 4, 240, 0.55);
  },
  look: { zenith: 0.7, horizon: 0.8, fog: 0.8, fogNear: 40, fogFar: 900, sunAz: -20, sunEl: 40, sun: 1.1, ambient: 1.45 },
  views: [
    { key: 'opening', name: 'On the church roof, the town below', z: -24, speed: 22 },
    { key: 'place', name: 'Roof to roof: an alley gap and the next roof down', z: 0, speed: 28, back: 6, up: 1.4 },
  ],
};
// (The place: just short of the alley at the end of the fourth block down the left row.)
{
  const b = gfBlocks[-1][4];
  gablefall.views[1].z = b.z1 - 5;
}

// =================================================================== 4. Windfall: the storm's forest (duck and hop)

function wfCentre(z: number): number {
  return 18 * Math.sin(z / 240) + 5 * Math.sin(z / 85);
}
function wfGround(x: number, z: number): number {
  const u = x - wfCentre(z);
  const a = Math.abs(u);
  let y = -0.24 * z + 0.7 * noise2(21, x / 11, z / 13) + 0.3 * noise2(22, x / 4, z / 5);
  if (a > 10) y += 0.18 * (a - 10) * (u < 0 ? 1.3 : 0.7);
  return y;
}
interface Trunk {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  r: number;
  /** Height of its underside over the snow: 0 lying (hop it), about 1.2 hung up (duck it). */
  lift: number;
}
export const wfTrunks: Trunk[] = [];
{
  let z = 160;
  let n = 0;
  while (z < 2600) {
    const hung = hash(n, 31) < (z > 1300 && z < 1700 ? 0.7 : 0.38);
    const ang = (hash(n, 32) - 0.5) * 0.9;
    const len = 10 + hash(n, 33) * 12;
    const c = wfCentre(z) + (hash(n, 34) - 0.5) * 6;
    const dx = Math.cos(ang) * len * 0.5;
    const dz = Math.sin(ang) * len * 0.5;
    if (hung) wfTrunks.push({ x0: c - dx, z0: z - dz, x1: c + dx, z1: z + dz, r: 0.42, lift: 1.25 + hash(n, 35) * 0.2 });
    else {
      // A lying trunk across the line is broken where the line runs (the safe lane is never closed by one).
      const gap = 2.8;
      const s = gap / len;
      wfTrunks.push({ x0: c - dx, z0: z - dz, x1: c - dx * s, z1: z - dz * s, r: 0.45, lift: 0 });
      if (hash(n, 36) < 0.6) wfTrunks.push({ x0: c + dx * s + 0.4, z0: z + dz * s, x1: c + dx, z1: z + dz, r: 0.4, lift: 0 });
    }
    z += (z > 1300 && z < 1700 ? 24 : 34) + hash(n, 37) * 22;
    n++;
  }
}

const windfall: SceneDef = {
  id: 'windfall',
  title: 'Windfall',
  ground: wfGround,
  centre: wfCentre,
  line: wfCentre,
  half: 80,
  ahead: 600,
  paint(x, _y, z, ny) {
    if (z < 140 && Math.abs(x - wfCentre(z)) < 1.6) return 0.6;
    return ny < 0.6 ? 0.5 : 0.9;
  },
  props(k, z0, z1) {
    // The timber slide out of the log landing: a plank trough down the first 140 m.
    if (z0 < 140) {
      for (let z = Math.max(-30, z0); z < 140; z += 3) {
        const c = wfCentre(z);
        const y = wfGround(c, z) - 0.25;
        k.box(c, y, z + 1.5, 3.6, 0.25, 3.05, WOOD);
        for (const side of [-1, 1]) k.box(c + side * 1.9, y, z + 1.5, 0.25, 1.25, 3.05, WOOD);
      }
      for (const side of [-1, 1]) {
        for (let n = 0; n < 18; n++) {
          const x = wfCentre(-20) + side * (5 + (n % 3) * 0.95);
          const z = -40 + Math.floor(n / 3) * 4.5;
          k.bar(x, wfGround(x, z) + 0.5 + (n % 2) * 0.9, z - 2, x, wfGround(x, z) + 0.5 + (n % 2) * 0.9, z + 2, 0.45, 0.36);
        }
      }
    }
    // The trunks across the run: lying ones to hop, hung-up ones to duck, each hung one's root plate standing.
    for (const t of wfTrunks) {
      if (Math.max(t.z0, t.z1) < z0 || Math.min(t.z0, t.z1) > z1) continue;
      const y0 = wfGround(t.x0, t.z0) + t.r + t.lift;
      const y1 = wfGround(t.x1, t.z1) + t.r + t.lift;
      k.bar(t.x0, y0, t.z0, t.x1, y1, t.z1, t.r, t.lift > 0 ? 0.62 : 0.5, 7);
      if (t.lift > 0) {
        k.cyl(t.x0, wfGround(t.x0, t.z0) - 0.4, t.z0, 2.1, 2.1, 0.7, 0.26, 9, 0, Math.PI / 2, 0);
        k.cyl(t.x1, wfGround(t.x1, t.z1) - 0.3, t.z1, 0.35, 0.45, 3.2, 0.3, 6);
      }
    }
    // The forest: standing trunks, half of them snapped by the storm; tall crowns on the rest.
    for (let z = Math.max(-60, z0); z < z1; z += 2.4) {
      for (const side of [-1, 1]) {
        for (let n = 0; n < 6; n++) {
          if (hash(Math.round(z * 10), side, n + 40) < 0.35) continue;
          const u = side * (10.5 + n * 4.6 + hash(Math.round(z * 10), side, n + 41) * 4);
          const x = wfCentre(z) + u;
          const y = wfGround(x, z) - 0.3;
          const snapped = hash(Math.round(z * 10), side, n + 42) < 0.45;
          const h = snapped ? 3 + hash(n, Math.round(z)) * 6 : 15 + hash(n, Math.round(z), 2) * 8;
          k.cyl(x, y, z, 0.28, 0.42, h, 0.28, 6, 0, snapped ? 0 : (hash(n, side, Math.round(z)) - 0.5) * 0.18);
          if (!snapped) k.cone(x, y + h * 0.55, z, 2.6, h * 0.55, TREE, 6);
          else if (hash(n * 7 + 1, side, Math.round(z)) < 0.4) {
            // Its top lies on the bank beside it.
            k.bar(x, y + 0.4, z, x + side * 6, y + 0.5, z + 4 * (hash(n, 2) - 0.5), 0.3, 0.3);
          }
        }
      }
    }
  },
  far(k, cam) {
    // Through the gaps the storm made: the valley's other side, a long forested ridge.
    for (let i = 0; i < 40; i++) {
      const x = cam.x - 4000 + i * 220;
      k.peak(x, cam.y - 700, cam.z + 3200 + hash(i, 5) * 600, 520, 820 + hash(i, 6) * 220, 0.36, 5, hash(i, 7), 1.5);
    }
  },
  look: { zenith: 0.58, horizon: 0.9, fog: 0.86, fogNear: 60, fogFar: 3500, sunAz: 62, sunEl: 15, sun: 2.6, ambient: 0.8 },
  views: [
    { key: 'opening', name: 'Down the timber slide into the fallen forest', z: 40, speed: 24 },
    { key: 'place', name: 'The hung-up gallery: duck, hop, duck', z: 0, speed: 30 },
  ],
};
// (The place: 14 m short of the first hung-up trunk in the gallery.)
{
  const t = wfTrunks.find((q) => q.lift > 0 && Math.min(q.z0, q.z1) > 1330)!;
  windfall.views[1].z = Math.min(t.z0, t.z1) - 9;
}

// =================================================================== 5. Longswell: the ice cap's swells (pump)

const LS_A = 2.1;
const LS_L = 45;
function lsCentre(z: number): number {
  return 14 * Math.sin(z / 700);
}
function lsGround(x: number, z: number): number {
  const swell = LS_A * Math.sin((2 * Math.PI * (z + 0.27 * x)) / LS_L) * smooth(60, 160, z);
  const band = smooth(0.2, 0.5, noise2(41, x / 120, z / 160));
  const sastrugi = 0.28 * band * Math.max(0, Math.sin((2 * Math.PI * (0.9 * x + 0.45 * z)) / 5)) ** 3;
  let y = -0.17 * z + swell + sastrugi + 0.6 * noise2(42, x / 70, z / 90) - 0.00006 * x * x;
  // A crevasse across the run, bridged where the wands lead.
  const cz = 1450 + 0.35 * x;
  const d = Math.abs(z - cz);
  if (d < 1.4 && Math.abs(x - lsCentre(z)) > 3.5) y -= 9 * (1 - d / 1.4);
  return y;
}

const longswell: SceneDef = {
  id: 'longswell',
  title: 'Longswell',
  ground: lsGround,
  centre: lsCentre,
  line: lsCentre,
  half: 280,
  ahead: 1000,
  paint(_x, _y, _z, ny) {
    return ny < 0.35 ? 0.3 : ny < 0.8 ? 0.85 : 0.95;
  },
  props(k, z0, z1) {
    // The wands that mark the way, flags on the bridges.
    for (let z = Math.max(0, Math.ceil(z0 / 45) * 45); z < z1; z += 45) {
      for (const side of [-1, 1]) {
        const x = lsCentre(z) + side * 34;
        const y = lsGround(x, z);
        k.cyl(x, y, z, 0.04, 0.05, 2.2, 0.3, 4);
        k.box(x + 0.25, y + 1.75, z, 0.5, 0.35, 0.04, 0.3);
      }
    }
    // The research camp the run starts from: a dome, a mast, tents and sledges.
    if (z0 < 40) {
      const x = lsCentre(0) - 26;
      k.sphere(x, lsGround(x, -14) - 0.5, -14, 5, 0.75, 7, 0.75);
      k.cyl(x + 8, lsGround(x + 8, -26), -26, 0.15, 0.22, 22, 0.35, 5);
      for (let n = 0; n < 4; n++) k.house(x - 6 + n * 4.5, lsGround(x, 4 + n), 6 + n * 3, 2.4, 3.2, 0.4, 1.8, 0.7, 0.55);
      for (let n = 0; n < 3; n++) k.box(x + 6 + n * 1.6, lsGround(x + 6, 8), 8, 0.8, 0.5, 3.4, 0.4);
    }
    // Marker flags at the crevasse's bridge.
    if (z0 < 1450 && z1 > 1450) {
      for (const side of [-1, 1]) {
        const x = lsCentre(1450) + side * 3.6;
        const z = 1450 + 0.35 * x - 2;
        k.cyl(x, lsGround(x, z), z, 0.05, 0.05, 2.6, 0.25, 4);
        k.box(x + 0.3, lsGround(x, z) + 2.1, z, 0.6, 0.4, 0.04, 0.25);
      }
    }
  },
  far(k, cam) {
    // Nothing but the ice to a flat horizon, and two low nunataks far off to one side.
    k.peak(cam.x - 9000, cam.y - 400, cam.z + 16000, 1300, 520, 0.5, 5, 0.2, 1.8);
    k.peak(cam.x - 6000, cam.y - 400, cam.z + 19000, 900, 380, 0.52, 5, 1.2, 1.4);
  },
  look: { zenith: 0.5, horizon: 0.96, fog: 0.93, fogNear: 300, fogFar: 14000, sunAz: 152, sunEl: 14, sun: 2.8, ambient: 0.6 },
  views: [
    { key: 'opening', name: 'From the camp onto the swells', z: 22, speed: 20 },
    { key: 'place', name: 'On a swell, the next ones to the horizon', z: 1386, speed: 34 },
  ],
};

// =================================================================== 6. Whitemantle: the open face (read your line)

const WM_BANDS = [300, 620, 960, 1300, 1650];
function wmBand(b: number, x: number): number {
  // A cliff band's height along it, and three passages where it has none.
  const h = Math.max(0, 3 + 10 * noise1(50 + b, x / 45));
  let gap = 1;
  for (let g = 0; g < 3; g++) {
    const gx = -150 + hash(b, g) * 300;
    gap = Math.min(gap, smooth(5, 16, Math.abs(x - gx)));
  }
  return h * gap;
}
function wmGround(x: number, z: number): number {
  // The summit ridge, its crest 10 m above the face's top, and the roll the run drops in over.
  let y = z >= 0 ? -(0.4 * z + 0.000035 * z * z) : 4 - 4 * smooth(-10, 0, z) + 0.06 * Math.max(0, -10 - z);
  const a = Math.abs(x);
  y += 0.00045 * Math.min(a, 200) ** 2;
  if (a > 190) y += 1.1 * (a - 190) + 18 * noise2(51, x / 30, z / 40);
  y += 0.7 * noise2(52, x / 25, z / 30) + 2.5 * noise2(53, x / 160, z / 200);
  for (let i = 0; i < WM_BANDS.length; i++) {
    const zb = WM_BANDS[i];
    if (z < zb - 60 || z > zb + 3) continue;
    const h = wmBand(i, x);
    y += h * (smooth(zb - 55, zb, z) - smooth(zb, zb + 2.5, z));
  }
  return y;
}
function wmLine(z: number): number {
  // The marked route: down the passages, the gentlest way through every band.
  let x = -40 + 30 * Math.sin(z / 380);
  for (let i = 0; i < WM_BANDS.length; i++) {
    const gx = -150 + hash(i, 0) * 300;
    x = lerp(x, gx, smooth(WM_BANDS[i] - 160, WM_BANDS[i] - 40, z) * (1 - smooth(WM_BANDS[i] + 20, WM_BANDS[i] + 140, z)));
  }
  return x;
}

const whitemantle: SceneDef = {
  id: 'whitemantle',
  title: 'Whitemantle',
  ground: wmGround,
  centre: () => 0,
  line: wmLine,
  half: 300,
  ahead: 2600,
  paint(_x, _y, _z, ny) {
    return ny < 0.55 ? 0.42 : ny < 0.7 ? 0.7 : 0.92;
  },
  props(k, z0, z1) {
    // Rock along the bands' brows where a cliff stands; marker poles down the marked route.
    for (let i = 0; i < WM_BANDS.length; i++) {
      const zb = WM_BANDS[i];
      if (zb < z0 || zb > z1) continue;
      for (let x = -240; x < 240; x += 6) {
        const h = wmBand(i, x);
        if (h < 2) continue;
        k.box(x + hash(i, x) * 3, wmGround(x, zb + 3) - 0.5, zb + 1, 4 + hash(i, x, 1) * 3, h * 0.8, 2.2, ROCK, hash(i, x, 2) - 0.5);
        if (h > 4) k.box(x + hash(i, x, 4) * 3, wmGround(x, zb - 3) - 0.6, zb - 3, 3 + hash(i, x, 5) * 3, 1.2 + (h - 4) * 0.35, 3, ROCK, hash(i, x, 6) - 0.5, 0.1, 0.05);
      }
    }
    for (let z = Math.max(0, Math.ceil(z0 / 50) * 50); z < Math.min(z1, 2400); z += 50) {
      const x = wmLine(z);
      k.cyl(x + 3, wmGround(x + 3, z), z, 0.05, 0.06, 2, 0.3, 4);
    }
    // The summit cornice the run drops in from, and the ridge either side.
    if (z0 < 10) {
      for (let x = -60; x < 60; x += 4) k.box(x, wmGround(x, -14), -14, 4.2, 2 + hash(x, 3) * 1.5, 5, 0.88, 0, 0.12);
    }
  },
  far(k, cam) {
    // The glacier and the valley under the face, the ranges across it low on the horizon; the summit's cloud cap
    // above, not a sea of cloud below.
    const glacier = -(0.4 * 2400 + 0.000035 * 2400 * 2400) - 120;
    k.sheet(cam.x - 6000, cam.z + 2500, cam.x + 6000, cam.z + 9000, glacier, 0.86);
    for (let i = 0; i < 30; i++) {
      const x = cam.x - 12000 + i * 820;
      k.peak(x, glacier - 300, cam.z + 14000 + hash(i, 2) * 3000, 1800, 900 + hash(i, 3) * 600, 0.55, 5, hash(i, 4) * 3, 1.3);
    }
  },
  look: { zenith: 0.4, horizon: 0.86, fog: 0.84, fogNear: 300, fogFar: 20000, sunAz: -72, sunEl: 21, sun: 2.5, ambient: 0.85 },
  views: [
    { key: 'opening', name: 'The drop-in: the whole face at once', z: -3, speed: 16 },
    { key: 'place', name: 'Reading the second band: which passage', z: 520, speed: 36 },
  ],
};

// =================================================================== 7. Rimewater Gorge: under the ice (turn on the snow)

const RW_FALLS = [420, 760, 1080, 1420];
function rwCentre(z: number): number {
  return (18 * Math.sin(z / 75) + 8 * Math.sin(z / 31)) * smooth(110, 220, z);
}
function rwFloor(z: number): number {
  let y = -0.09 * z;
  for (const f of RW_FALLS) y -= (5 + hash(f, 1) * 4) * smooth(f, f + 2.5, z);
  return y;
}
function rwHalf(z: number): number {
  return lerp(40, 11 + 3 * Math.sin(z / 50), smooth(90, 130, z));
}
function rwCurve(z: number): number {
  const e = 3;
  return (rwCentre(z + e) + rwCentre(z - e) - 2 * rwCentre(z)) / (e * e);
}
function rwGround(x: number, z: number): number {
  const u = x - rwCentre(z);
  const a = Math.abs(u);
  const hw = rwHalf(z);
  let y = rwFloor(z);
  // A snow bar on the inside of each meander: where a sled can turn.
  const k = rwCurve(z);
  const inside = k > 0 ? 1 : -1;
  const bar = Math.max(0, 1 - ((u - inside * hw * 0.5) / 4.5) ** 2) * clamp(Math.abs(k) * 25, 0, 1);
  y += 0.55 * bar;
  if (a > hw) y += Math.min(46, (a - hw) * 9) + 2 * noise2(61, x / 6, z / 8);
  return y;
}
interface Slab {
  z0: number;
  z1: number;
}
const rwSlabs: Slab[] = [];
{
  let z = 120;
  let n = 0;
  while (z < 2000) {
    const len = n === 0 ? 60 : 14 + hash(n, 71) * 30;
    rwSlabs.push({ z0: z, z1: z + len });
    z += len + 5 + hash(n, 72) * 14;
    n++;
  }
}

const rimewater: SceneDef = {
  id: 'rimewater',
  title: 'Rimewater Gorge',
  ground: rwGround,
  centre: rwCentre,
  line: (z) => rwCentre(z),
  half: 90,
  ahead: 700,
  paint(x, _y, z, ny) {
    const u = x - rwCentre(z);
    const hw = rwHalf(z);
    if (Math.abs(u) < hw && z > 110) {
      const k = rwCurve(z);
      const inside = k > 0 ? 1 : -1;
      const bar = Math.max(0, 1 - ((u - inside * hw * 0.5) / 4.5) ** 2) * clamp(Math.abs(k) * 25, 0, 1);
      return bar > 0.15 ? 0.95 : 0.72;
    }
    return ny < 0.5 ? 0.5 : 0.9;
  },
  props(k, z0, z1) {
    // The ceiling: ice and snow bridges spanning the gorge, light falling through the gaps between them.
    for (const s of rwSlabs) {
      if (s.z1 < z0 || s.z0 > z1) continue;
      for (let z = s.z0; z < s.z1; z += 4) {
        const c = rwCentre(z + 2);
        const hw = rwHalf(z + 2) + 8;
        const y = rwFloor(z) + 24 + 4 * hash(Math.round(z), 1);
        const thick = s === rwSlabs[0] ? 22 : 5;
        k.box(c, y, z + 2, 2 * hw, thick, 4.05, 0.62);
        if (hash(Math.round(z), 2) < 0.5) k.cone(c + (hash(Math.round(z), 3) - 0.5) * hw * 1.6, y - 3.5, z + 2, 0.5, 3.5, 0.75, 5);
      }
    }
    // Ice columns where a bridge has grown to the floor, off the line.
    for (let n = 0; n < 60; n++) {
      const z = 150 + n * 31;
      if (z < z0 || z > z1) continue;
      const side = hash(n, 81) < 0.5 ? -1 : 1;
      const x = rwCentre(z) + side * (4 + hash(n, 82) * 5);
      k.cyl(x, rwGround(x, z) - 0.5, z, 0.9, 1.4, 28, 0.78, 7);
    }
    // A frozen fall's lip: curtains of ice down its face.
    for (const f of RW_FALLS) {
      if (f < z0 || f > z1) continue;
      for (let i = -9; i <= 9; i += 1.5) k.cone(rwCentre(f) + i, rwFloor(f + 3), f + 1.4, 0.35, rwFloor(f - 1) - rwFloor(f + 3), 0.85, 5);
    }
  },
  far(k, cam) {
    // The snowfield the river leaves, above the gorge's walls.
    for (let i = 0; i < 14; i++) k.box(cam.x - 300 + hash(i, 1) * 600, cam.y + 30, cam.z + 200 + hash(i, 2) * 900, 8, 4, 8, ROCK, hash(i, 3));
  },
  look: { zenith: 0.55, horizon: 0.9, fog: 0.55, fogNear: 40, fogFar: 1400, sunAz: 15, sunEl: 64, sun: 2.9, ambient: 0.32 },
  views: [
    { key: 'opening', name: 'Into the mouth where the river goes under', z: 30, speed: 22 },
    { key: 'place', name: 'Under the ice: light through the bridges, a fall ahead', z: 668, speed: 30 },
  ],
};

export const CONCEPTS: SceneDef[] = [oldRun, gullhaven, gablefall, windfall, longswell, whitemantle, rimewater];
