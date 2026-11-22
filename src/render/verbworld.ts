import { type BufferGeometry, Color, CylinderGeometry, LatheGeometry, Mesh, Object3D, Quaternion, Vector2, Vector3 } from 'three';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { type MomentPlay, fallZ, gateX, machineZ } from '../sim/moments';
import { merge, part, shade } from './flora';
import { box, quad, seg } from './landmarkKit';
import { pushLocalLight } from './lights';
import { cablePoint } from './marqueeworld';
import { DECAL_CHEVRON, DECAL_LINE, DECAL_POOL, DECAL_RING, DECAL_RIPPLE, GLOW_FLAME, GLOW_RING, GLOW_SOFT, GLOW_STAR, type MomentKit, type Pool, type StageCtx } from './momentkit';

// Round 7 (the momentsworld lane): each verb's own world on the four older mountains. Where round 7's sim
// lane left an orb, a beam or a disc of light, this builds the thing itself, from the sim's own account
// (Sim.plays, Sim.mo, the run's variant) and nothing else:
//   gates     paper lanterns on a yoke; a gate that sits hangs from the wire, one that swings is a real
//             pendulum from a pivot over the street, where the sim's sway has it this tick
//   shatter   bronze bells on ropes over the street, as high as a sled must be; a rung bell swings, throws
//             a ring of light and sheds its chimes
//   surge     a forge gate at the lip whose flames climb with the sled's speed and roar when it leaves
//             fast enough, and a line of braziers where the flight must come down
//   collapse  lamps down the span that go out with the fall, a crack of light at the fall line, and the
//             keystone as two beacons when the span falls from its far end
//   race      the machine's own light, its station's signal (it waits, it leaves, it has gone) and the
//             far end as a lit line; a chase's cars burn until they are caught
//   rings     chevrons to the take-off and a dotted arc of light through the three rings, low or high,
//             on the side they hang
//   slide     the drift scribed in the ice behind the sled, brighter by the quarter, with ice dust
//   steps     lantern arches over the steps or the street that take light stomp by stomp, a mark where
//             each stomp lands; in a row, the arches are tied by one garland
//   flourish  paper wheels at the lip that say the trick: one that lies flat and spins is a spin, one that
//             stands and turns is a flip
// State reads in the world: the next target burns brightest and breathes, a hit is answered with light and
// debris, a miss gutters quietly. Nothing here is a collider and nothing stands on the snow a sled rides.

const LIGHT = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const PAPER = new Color('#FFE9B8');
const EMBER = new Color('#FF8A3A');
const HOT = new Color('#FFD9A0');
const ICE = new Color('#CFE6FF');
const ROSE = new Color('#FFB7C9');
const BRONZE = new Color('#F0B050');
const DIM = new Color('#8A5A3A');
const MUTE = new Color('#B48A5E');
/** A mark on sunlit snow: deep marigold, so it has value against white as well as hue. */
const MARK = new Color('#FF9E1A');
const INK = new Color('#2A2D48');
const PETALS: readonly Color[] = [new Color('#FFC9DA'), new Color('#FFE3EC'), new Color('#FF9DBB')];

/** A set piece's world is drawn from this far up the run, and this far past it. */
const REACH = 420;
const PAST = 90;
/** A swinging gate's pivot over the snow, and its yoke at rest. */
const PIVOT_H = 11;
const YOKE_H = 5.7;
const WIRE_H = 9.1;
/** How far apart the lantern arches of a street of hops stand. */
const ARCH_STEP = 36;

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const AXIS_X = new Vector3(1, 0, 0);
const q1 = new Quaternion();
const q2 = new Quaternion();
const v1 = new Vector3();
const v2 = new Vector3();

/** A paper lantern: a bulged drum, pale so the instance's colour is its light, with a dark cap, foot and tassel. */
export function lanternGeo(sides: number): BufferGeometry {
  // (Four bands of paper between hoops: each band its own value, palest at the waist, so the drum has
  // ribs and a glowing belly.)
  const bands: BufferGeometry[] = [];
  const ys = [-0.33, -0.17, 0, 0.17, 0.33];
  const rad = (y: number): number => 0.34 * (1 + 0.36 * (1 - Math.min(1, Math.abs(y) / 0.33) ** 2));
  const tones = ['#D9A070', '#FFFFFF', '#FFF2DC', '#E2AC7C'];
  for (let b = 0; b < 4; b++) {
    const g = new CylinderGeometry(rad(ys[b + 1]), rad(ys[b]), ys[b + 1] - ys[b], sides, 1, true);
    g.translate(0, (ys[b] + ys[b + 1]) / 2, 0);
    bands.push(part(g, tones[b]));
  }
  const dark = new Color('#241C2A');
  return merge([...bands, box(0.4, 0.09, 0.4, dark, [0, 0.37, 0]), box(0.32, 0.07, 0.32, dark, [0, -0.36, 0]), box(0.06, 0.34, 0.06, new Color('#7A2A20'), [0, -0.56, 0])]);
}

/** A temple bell, hung from its crown at the origin: a flared bronze body, a dark lip and a clapper. */
function bellGeo(sides: number): BufferGeometry {
  const prof = [new Vector2(0.001, 0), new Vector2(0.2, -0.04), new Vector2(0.34, -0.2), new Vector2(0.4, -0.62), new Vector2(0.46, -0.98), new Vector2(0.6, -1.2), new Vector2(0.56, -1.24), new Vector2(0.001, -1.1)];
  const bell = part(new LatheGeometry(prof, sides), '#FFFFFF');
  return merge([bell, box(0.16, 0.16, 0.16, new Color('#3A2A20'), [0, 0.06, 0]), box(0.12, 0.3, 0.12, new Color('#3A2A20'), [0, -1.3, 0])]);
}

/** A paper wheel in the xy plane, a metre in radius: eight vanes, two papers, both faces. */
function wheelGeo(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const rose = new Color('#FF9DBB');
  const white = new Color('#FFF4F0');
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = a0 + 0.62;
    const col = i % 2 ? rose : white;
    // (A vane is a quad with a short outer edge; one a face, so it is seen from both sides.)
    const a: [number, number, number] = [Math.cos(a0) * 0.12, Math.sin(a0) * 0.12, 0];
    const b: [number, number, number] = [Math.cos(a0), Math.sin(a0), 0];
    const d: [number, number, number] = [Math.cos(a1) * 0.9, Math.sin(a1) * 0.9, 0];
    const e: [number, number, number] = [Math.cos(a1) * 0.12, Math.sin(a1) * 0.12, 0];
    parts.push(quad(a, b, d, e, col), quad(e, d, b, a, col));
  }
  parts.push(box(0.26, 0.26, 0.1, new Color('#FFD34D'), [0, 0, 0]));
  return merge(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

interface Stamp {
  x: number;
  z: number;
  t: number;
}

interface Look {
  p: MomentPlay;
  /** What stands for this set piece (wires, pylons, posts), or null. */
  mesh: Mesh | null;
  /** Per item (a gate, a bell, an arch): 0 waiting, 1 taken, -1 missed; when it changed; a gate's last place. */
  st: Float32Array;
  at: Float32Array;
  gx: Float32Array;
  seen: number;
  mask: number;
  /** The leap's lip (rings, flourish), the arches of a street or a stair, and the side its rings hang. */
  lip: number;
  arches: number[];
  /** When it was won or lost (the world's clock), 0 before. */
  doneAt: number;
  won: boolean;
  /** Surge: when the sled left the lip and whether it left fast enough. */
  offAt: number;
  roar: boolean;
  wave: number;
}

export class VerbWorld {
  readonly root = new Object3D();
  private looks: Look[] = [];
  private readonly lanterns: Pool;
  private readonly bells: Pool;
  private readonly ropes: Pool;
  private readonly wheels: Pool;
  /** Marks where stomps landed, and the slide's scribe: rings of the last few. */
  private readonly stamps: Stamp[] = [];
  private readonly scribe: { x: number; z: number; yaw: number; dir: number }[] = [];
  private scribeLive = false;
  private scribeBroke = 0;
  private dust = 0;

  constructor(private readonly kit: MomentKit) {
    this.lanterns = kit.pool(lanternGeo(8), 150, kit.lit);
    this.bells = kit.pool(bellGeo(10), 40, kit.lit);
    this.ropes = kit.pool(box(0.07, 1, 0.07, INK, [0, -0.5, 0]), 120);
    this.wheels = kit.pool(wheelGeo(), 6, kit.lit);
  }

  /** Whether this file draws this set piece's verb (the fifth mountain's are the lanternworld lane's). */
  owns(p: MomentPlay): boolean {
    return p.verb !== 'follow' && p.verb !== 'kindle' && p.verb !== 'carry';
  }

  build(c: Course, plays: readonly MomentPlay[]): void {
    for (const l of this.looks) {
      if (!l.mesh) continue;
      this.root.remove(l.mesh);
      l.mesh.geometry.dispose();
    }
    this.looks = [];
    for (const p of plays) {
      if (!this.owns(p)) continue;
      const lip = c.leaps.find((q) => q.z >= p.z0 && q.z < p.z1)?.z ?? p.lip;
      const arches: number[] = [];
      if (p.verb === 'steps') {
        if (p.steps.length) arches.push(...p.steps);
        else for (let z = p.z0 + 24; z < p.z1 - 10; z += ARCH_STEP) arches.push(z);
      }
      const n = Math.max(1, p.gates.length, p.targets.length, arches.length, 8);
      const parts = this.statics(c, p, lip, arches);
      const mesh = parts.length ? new Mesh(merge(parts), this.kit.toon) : null;
      if (mesh) {
        mesh.visible = false;
        this.root.add(mesh);
      }
      this.looks.push({ p, mesh, st: new Float32Array(n), at: new Float32Array(n), gx: new Float32Array(n), seen: 0, mask: 0, lip, arches, doneAt: 0, won: false, offAt: 0, roar: false, wave: -1 });
    }
    this.reset();
  }

  reset(): void {
    this.stamps.length = 0;
    this.scribe.length = 0;
    this.scribeLive = false;
    this.scribeBroke = 0;
    for (const l of this.looks) {
      l.st.fill(0);
      l.at.fill(0);
      l.p.gates.forEach((g, i) => (l.gx[i] = gateX(g, 0)));
      l.seen = 0;
      l.mask = 0;
      l.doneAt = 0;
      l.won = false;
      l.offAt = 0;
      l.roar = false;
      l.wave = -1;
    }
  }

  /** What stands for a set piece: wires over a street, a forge gate's pylons, an arch's posts. Always outside
   *  the corridor or over it, never on the snow a sled rides. */
  private statics(c: Course, p: MomentPlay, lip: number, arches: number[]): BufferGeometry[] {
    const out: BufferGeometry[] = [];
    const edge = (z: number, side: number, pad: number): number => c.centerX(z) + side * (c.halfWidth(z) + pad);
    if (p.verb === 'gates') {
      for (const g of p.gates) {
        const y = c.ground(g.x, g.z) + (g.amp > 0 ? PIVOT_H : WIRE_H);
        out.push(seg([edge(g.z, -1, 1.4), y, -g.z], [edge(g.z, 1, 1.4), y, -g.z], 0.05, INK, 3));
        if (g.amp > 0) out.push(box(0.5, 0.36, 0.5, shade(INK, 1.5), [g.x, y, -g.z]));
      }
    } else if (p.verb === 'shatter') {
      for (const t of p.targets) {
        const y = c.ground(t.x, t.z) + PIVOT_H;
        out.push(seg([edge(t.z, -1, 1.4), y, -t.z], [edge(t.z, 1, 1.4), y, -t.z], 0.05, INK, 3));
      }
    } else if (p.verb === 'surge' && p.far > 0) {
      // The forge gate: two pylons of stacked basalt outside the lip (two pairs for the far shelf), a brazier
      // shelf for each flame; and low braziers either side of the far line.
      const rock = new Color('#1E1A22');
      const iron = new Color('#3B3036');
      const pairs = p.speed >= 46 ? [lip - 3, lip - 19] : [lip - 3];
      for (const z of pairs) {
        for (const side of [-1, 1]) {
          // (A slim iron mast with a bowl a flame: a torch stand, never a wall beside the run.)
          const x = edge(z, side, 2.6);
          const y = c.ground(x, z) - 0.6;
          out.push(seg([x, y, -z], [x, y + 9.2, -z], 0.12, iron, 5));
          for (let k = 0; k < 5; k++) out.push(box(0.8, 0.14, 0.8, shade(iron, 1.3), [x, y + 1.5 + k * 1.5, -z], [0, 0.6, 0]));
        }
      }
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const z = p.far + (k - 1) * 5;
          const x = edge(z, side, 1.4);
          out.push(seg([x, c.ground(x, z) - 0.4, -z], [x, c.ground(x, z) + 1.1, -z], 0.1, iron, 5), box(0.9, 0.14, 0.9, shade(rock, 1.6), [x, c.ground(x, z) + 1.1, -z], [0, 0.6, 0]));
        }
      }
    } else if (p.verb === 'collapse') {
      // Lamp posts down the span's edges; from the far end, the keystone's two pylons of ice.
      const post = new Color('#56607E');
      for (let z = p.z0 + 6; z < p.z1; z += 12) {
        for (const side of [-1, 1]) {
          const x = edge(z, side, 0.7);
          const y = c.ground(x, z);
          out.push(seg([x, y - 0.3, -z], [x, y + 2.3, -z], 0.07, post, 4), box(0.3, 0.08, 0.3, post, [x, y + 2.3, -z]));
        }
      }
      if (p.from === 1) {
        const ice = new Color('#BFD9F5');
        for (const side of [-1, 1]) {
          const x = edge(p.keystone, side, 1.5);
          const y = c.ground(x, p.keystone);
          out.push(box(1.3, 4.4, 1.3, ice, [x, y + 1.9, -p.keystone], [0, 0.6, side * 0.08]), box(0.8, 2.4, 0.8, shade(ice, 1.15), [x + side * 0.2, y + 5, -p.keystone], [0, 0.2, side * 0.14]));
        }
      }
    } else if (p.verb === 'steps') {
      // A lantern arch a step: two slim posts outside the run and a rope between their heads.
      const wood = new Color('#5E2A3A');
      for (const z of arches) {
        const xa = edge(z, -1, 1.5);
        const xb = edge(z, 1, 1.5);
        const y = Math.max(c.ground(xa, z), c.ground(xb, z), c.baseY(z)) + 6.4;
        if (p.steps.length) out.push(seg([xa, c.ground(xa, z) - 0.4, -z], [xa, y, -z], 0.09, wood, 4), seg([xb, c.ground(xb, z) - 0.4, -z], [xb, y, -z], 0.09, wood, 4));
        out.push(seg([xa, y, -z], [xb, y, -z], 0.04, INK, 3));
      }
    } else if (p.verb === 'flourish') {
      const wood = new Color('#5E2A3A');
      for (const side of [-1, 1]) {
        const x = edge(lip - 4, side, 2.4);
        const y = c.ground(x, lip - 4);
        out.push(seg([x, y - 0.5, -(lip - 4)], [x, y + 6.2, -(lip - 4)], 0.11, wood, 5));
      }
    } else if (p.verb === 'race' && p.style === 'sprint') {
      // The station's signal mast (three lamps the frame lights) and two brackets at the far end.
      const iron = new Color('#3B3036');
      const zs = p.z0 + Math.max(0, p.lead) - 6;
      cablePoint(c, p.side, zs, v1);
      out.push(seg([v1.x - p.side * 1.2, v1.y - 5.5, v1.z], [v1.x - p.side * 1.2, v1.y - 0.4, v1.z], 0.09, iron, 4), box(0.5, 2.2, 0.3, iron, [v1.x - p.side * 1.2, v1.y - 1.6, v1.z]));
    }
    return out;
  }

  /** The director's beats: which set piece is on, and each gate threaded or missed as the sim decides it. */
  beats(list: readonly Beat[], ctx: StageCtx): void {
    const s = ctx.s;
    for (const b of list) {
      if (b.type !== 'moment') continue;
      const l = this.looks.find((q) => q.p.key === b.key);
      if (!l) continue;
      const carrier = v2.set(s.vx, 0, -s.vz);
      const here = v1.set(s.x, s.y + 0.8, -s.z);
      if (b.verb === 'gates' && (b.phase === 'step' || b.phase === 'miss')) {
        const i = l.seen++;
        if (i < l.p.gates.length) {
          l.st[i] = b.phase === 'step' ? 1 : -1;
          l.at[i] = ctx.time;
          if (b.phase === 'step') ctx.particles.sparkle(v1.set(l.gx[i], s.y + 1.4, -l.p.gates[i].z), WHITE_GOLD, ctx.low ? 12 : 26, 3.6, 0.6, 0.24, carrier, 0.5);
        }
      } else if (b.verb === 'steps' && b.phase === 'step') {
        this.stamp(s.x, s.z, ctx.time);
        ctx.particles.flakes(s.x, s.y + 0.4, -s.z, l.p.steps.length ? PETALS : [WHITE_GOLD, PAPER], ctx.low ? 14 : 34, 2.6, 2.2, 0.16);
        ctx.particles.sparkle(here, l.p.steps.length ? ROSE : WHITE_GOLD, ctx.low ? 10 : 24, 3.6, 0.8, 0.24, carrier, 0.6);
        // The arch nearest behind the stomp takes it; down a street, a wave of light runs on ahead.
        let k = -1;
        for (let i = 0; i < l.arches.length; i++) if (l.arches[i] <= s.z + 6) k = i;
        if (l.p.steps.length && k >= 0) {
          l.st[k] = 1;
          l.at[k] = ctx.time;
        }
        l.seen = b.n;
        l.wave = ctx.time;
      } else if (b.verb === 'steps' && b.phase === 'miss') {
        // A row broken: what was lit gutters, and the count starts again.
        if (l.p.row) {
          l.st.fill(0);
          l.seen = 0;
        }
        l.wave = -1;
      } else if (b.verb === 'rings' && b.phase === 'step') {
        ctx.particles.sparkle(here, WHITE_GOLD, ctx.low ? 14 : 30, 4, 0.7, 0.26, carrier, 0.3);
      } else if (b.verb === 'slide' && b.phase === 'step') {
        this.stamp(s.x, s.z, ctx.time);
        ctx.particles.sparkle(here, ICE, ctx.low ? 10 : 22, 3.2, 0.6, 0.22, carrier, 0.4);
      } else if (b.verb === 'slide' && b.phase === 'miss') {
        this.scribeBroke = ctx.time;
      }
      if (b.phase === 'won' || b.phase === 'lost') {
        l.doneAt = ctx.time;
        l.won = b.phase === 'won';
        if (l.won) {
          ctx.particles.sparkle(here, LIGHT, ctx.low ? 18 : 44, 4.6, 0.8, 0.28, carrier, 0.5);
          if (b.verb === 'flourish') for (const side of [-1, 1]) ctx.particles.flakes(s.x + side * 4, s.y + 0.6, -s.z - 6, PETALS, ctx.low ? 24 : 70, 4.5, 3.4, 0.17);
        }
      }
    }
  }

  /** A paper lantern: half as large again as its form and bright enough to be the light in a day frame. */
  private lan(x: number, y: number, z: number, q: Quaternion | null, sx: number, sy: number, sz: number, col: Color, lum: number): void {
    this.lanterns.put(x, y, z, q, sx * 1.45, sy * 1.45, sz * 1.45, col, lum * 1.8);
  }

  private stamp(x: number, z: number, t: number): void {
    if (this.stamps.length >= 8) this.stamps.shift();
    this.stamps.push({ x, z, t });
  }

  update(ctx: StageCtx): void {
    const sim = ctx.sim;
    if (!sim || ctx.mode === 'title') {
      for (const l of this.looks) if (l.mesh) l.mesh.visible = false;
      return;
    }
    const s = ctx.s;
    const c = ctx.course;
    const mo = sim.mo;
    const breathe = ctx.reduced ? 1.4 : 1.3 + 0.4 * Math.sin(ctx.time * 6.2);
    for (const l of this.looks) {
      const p = l.p;
      const on = s.z > p.z0 - REACH && s.z < p.z1 + PAST;
      if (l.mesh && l.mesh.visible !== on) l.mesh.visible = on;
      if (!on) continue;
      const active = mo.active === p.index;
      const over = !active && mo.next > p.index;
      if (active) l.mask = mo.mask;
      switch (p.verb) {
        case 'gates':
          this.gates(ctx, l, active, over, breathe);
          break;
        case 'shatter':
          this.shatter(ctx, l, active, over, breathe);
          break;
        case 'surge':
          this.surge(ctx, l, active, over, breathe);
          break;
        case 'collapse':
          this.collapse(ctx, l, active, over, breathe);
          break;
        case 'race':
          this.race(ctx, l, active, over, breathe);
          break;
        case 'rings':
          this.rings(ctx, l, active, over, breathe);
          break;
        case 'slide':
          this.slide(ctx, l, active, over);
          break;
        case 'steps':
          this.steps(ctx, l, active, over, breathe);
          break;
        case 'flourish':
          this.flourish(ctx, l, active, over);
          break;
        default:
          break;
      }
    }
    // Where stomps landed and a slide's quarters fell: ripples that fade in three seconds.
    for (const m of this.stamps) {
      const age = ctx.time - m.t;
      if (age > 3 || age < 0) continue;
      const k = 1 - age / 3;
      this.kit.decal(c, m.x, m.z, 3 + age * 4, 3 + age * 4, WHITE_GOLD, 1.6 * k * k, DECAL_RIPPLE);
      if (age < 0.5) pushLocalLight(m.x, c.ground(m.x, m.z) + 1, -m.z, 1, 0.85, 0.55, 12, 1.4 * (1 - age * 2));
    }
  }

  // ---------------------------------------------------------------- gates

  private gates(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    const per = ctx.low ? 2 : 3;
    const ticks = sim && active ? sim.tick - sim.mo.t0 : 0;
    const nextI = active ? l.seen : over ? -1 : 0;
    let linked = 0;
    for (let i = 0; i < p.gates.length; i++) {
      const g = p.gates[i];
      if (g.z < s.z - 40 || g.z > s.z + 300) continue;
      const st = l.st[i];
      const age = ctx.time - l.at[i];
      // A gate that swings is where the sim's sway has it: at rest until the rider arrives, held where it
      // was once it is decided.
      if (g.amp > 0 && active && st === 0) l.gx[i] = gateX(g, ticks);
      const gx = l.gx[i];
      const y0 = c.ground(gx, g.z);
      const next = i === nextI;
      let lum = next ? breathe : 0.75;
      let col = LIGHT;
      if (st === 1) {
        lum = age < 0.25 ? 1.5 : Math.max(0, 1.3 * (1 - (age - 0.25) / 0.9));
        col = WHITE_GOLD;
      } else if (st === -1) {
        lum = 0.2;
        col = DIM;
      }
      // The yoke: hung from the wire where a gate sits; on a pendulum's two ropes where it swings.
      const swing = g.amp > 0;
      const py = c.ground(g.x, g.z) + PIVOT_H;
      const len = PIVOT_H - YOKE_H;
      const a = swing ? Math.asin(Math.max(-0.95, Math.min(0.95, (gx - g.x) / len))) : 0;
      const yy = swing ? py - len * Math.cos(a) : y0 + YOKE_H;
      const half = g.hw + 0.2;
      q1.setFromAxisAngle(AXIS_Z, a);
      const flown = st === 1 && age > 0.1;
      if (!flown || age < 1.2) {
        // (The yoke is a rope drawn level: the rope's form lies along -y, so it is turned a quarter.)
        q2.setFromAxisAngle(AXIS_Z, a + Math.PI / 2);
        this.ropes.put(gx - half * Math.cos(a), yy - half * Math.sin(a), g.z, q2, 1.6, 2 * half, 1.6, null);
      }
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? -1 : 1;
        const ex = gx + side * half * Math.cos(a);
        const ey = yy + side * half * Math.sin(a);
        if (swing) {
          v1.set(ex - g.x, ey - py, 0);
          const rl = v1.length();
          q2.setFromUnitVectors(DOWN, v1.multiplyScalar(1 / rl));
          this.ropes.put(g.x, py, g.z, q2, 1, rl, 1, null);
        } else {
          this.ropes.put(ex, y0 + WIRE_H, g.z, null, 1, y0 + WIRE_H - ey, 1, null);
        }
        // Three lanterns down each string, the largest lowest. Threaded, they slip the string and rise.
        for (let j = 0; j < per; j++) {
          const t = st === 1 ? Math.max(0, age - j * 0.12) : 0;
          if (t > 7.5) continue;
          const lx = ex + side * t * (0.3 + 0.15 * j) - a * 0.25 * (j + 1);
          const ly = ey - 0.62 - j * 1.0 + t * (2 + t * 0.55);
          const k2 = (1.7 - j * 0.16) * (per === 2 ? 1.25 : 1);
          this.lan(lx, ly, g.z, null, k2, k2, k2, col, st === 1 ? Math.max(0.9, lum) : lum);
        }
        if (lum > 0.3) kit.glow(ex, ey - 1.6, g.z, 4.2, col, 0.22 * lum, GLOW_SOFT, 0.6);
      }
      // Its light on the snow in the opening; the next gate is called with a chevron.
      kit.decal(c, gx, g.z, 2 * g.hw + 2, 6, col, Math.min(1.5, lum));
      if (next && g.z > s.z + 6) kit.decal(c, gx, g.z - 8, 4.4, 6, MARK, breathe, DECAL_CHEVRON);
      if (st === 1 && age < 0.7 && g.z > s.z + 4) kit.glow(gx, y0 + 2.6, g.z, 4 + age * 8, WHITE_GOLD, 0.6 * (1 - age / 0.7), GLOW_RING);
      if (swing && st === 0 && !ctx.low) kit.decal(c, g.x, g.z, 1, 2 * g.amp + 2 * g.hw, LIGHT, 0.55, DECAL_LINE, Math.PI / 2);
      // Gates that sit: a faint line on the snow from one opening to the next, so the pattern reads (turn
      // about, or two and two).
      if (!swing && st === 0 && i + 1 < p.gates.length && g.z > s.z - 4 && linked < (ctx.low ? 2 : 4)) {
        const h = p.gates[i + 1];
        const dx = h.x - g.x;
        const dz = h.z - g.z;
        kit.decal(c, g.x + dx / 2, g.z + dz / 2, 1.3, Math.hypot(dx, dz) - 4, LIGHT, linked === 0 ? 1 : 0.6, DECAL_LINE, Math.atan2(dx, dz));
        linked++;
      }
      if (lum > 0.05 && Math.abs(g.z - s.z) < 95) pushLocalLight(gx, y0 + 3.6, -g.z, col.r, col.g * 0.8, col.b * 0.5, 9 + g.hw * 1.6, Math.min(1.6, lum * 0.75));
    }
  }

  // ---------------------------------------------------------------- shatter

  private shatter(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    const at = sim && active ? sim.mo.at : over ? p.targets.length : 0;
    for (let i = 0; i < p.targets.length; i++) {
      const t = p.targets[i];
      if (t.z < s.z - 60 || t.z > s.z + 320) continue;
      const rung = ((l.mask >> i) & 1) === 1;
      if (rung && l.st[i] !== 1) {
        // Rung this frame: a ring of light, bronze sparks, and the chimes under it shatter.
        l.st[i] = 1;
        l.at[i] = ctx.time;
        ctx.particles.sparkle(v1.set(s.x, s.y + 1.6, -t.z), HOT, ctx.low ? 14 : 34, 4.2, 0.7, 0.24, v2.set(s.vx, 0, -s.vz), 0.5);
        ctx.breaks?.shatter('ice', s.x, s.y + 1.2, -t.z, v2.set(s.vx * 0.5, 0, -s.vz * 0.5), 0.8, 0);
      }
      const missed = !rung && i < at;
      const next = !rung && i === at && !over;
      const age = ctx.time - l.at[i];
      const y0 = c.ground(t.x, t.z);
      const wy = y0 + PIVOT_H;
      // The bell's mouth hangs where a sled's rider must reach: its height is the bell's own.
      const by = y0 + t.h + 2.5;
      const wide = Math.min(t.hw, 5.2);
      const swingA = rung && !ctx.reduced ? 0.95 * Math.exp(-1.1 * age) * Math.sin(7.5 * age) : 0;
      q1.setFromAxisAngle(AXIS_X, swingA);
      const col = rung ? WHITE_GOLD : missed ? MUTE : BRONZE;
      const lum = rung ? 1.3 + 0.9 * Math.exp(-2 * age) : missed ? 0.8 : next ? 1.5 : 1.15;
      this.ropes.put(t.x, wy, t.z, null, 1, wy - by, 1, null);
      this.bells.put(t.x, by + 1.9, t.z, q1, 3, 3, 3, col, lum);
      // A bar of small bells either side, as wide as the sled may pass under (they shatter when it rings).
      if (!rung) {
        const n = ctx.low ? 2 : 4;
        for (let k = 0; k < n; k++) {
          const u = ((k + 0.5) / n) * 2 - 1;
          if (Math.abs(u * wide) < 0.9) continue;
          this.bells.put(t.x + u * wide, by + 0.9, t.z, null, 0.9, 0.9, 0.9, col, lum * 0.9);
          this.ropes.put(t.x + u * wide, wy, t.z, null, 0.5, wy - by - 0.9, 0.5, null);
        }
      }
      if (next) {
        kit.glow(t.x, by - 0.9, t.z, 4.6, HOT, 0.5 * breathe, GLOW_SOFT);
        kit.decal(c, t.x, t.z, 2 * wide, 7, HOT, 1.1 * breathe, DECAL_RING);
        // How high: a thread of light from the snow to the bell's mouth.
        kit.glow(t.x, y0 + (t.h + 1.2) / 2, t.z, t.h + 1.2, HOT, 0.35, GLOW_SOFT, 0.1);
      } else if (!rung && !missed) kit.decal(c, t.x, t.z, 2 * wide, 4, BRONZE, 0.35);
      if (rung && age < 1.4) {
        kit.glow(t.x, by - 0.8, t.z, 4 + age * 14, WHITE_GOLD, 0.8 * (1 - age / 1.4), GLOW_RING);
        kit.glow(t.x, by - 0.8, t.z, 6, WHITE_GOLD, 0.8 * (1 - age / 1.4), GLOW_STAR);
      }
      if (Math.abs(t.z - s.z) < 110 && !missed) pushLocalLight(t.x, by - 1, -t.z, 1, 0.82, 0.5, rung ? 22 : 11, rung ? 0.5 + 2 * Math.exp(-2.5 * age) : next ? 0.9 : 0.4);
    }
  }

  // ---------------------------------------------------------------- surge

  private surge(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    if (!(p.far > 0) || !sim) return;
    const lip = l.lip;
    const off = active && sim.mo.aux === 1;
    if (off && l.offAt === 0) {
      // Off the lip: fast enough, the gate roars; too slow, it gutters.
      l.offAt = ctx.time;
      l.roar = sim.mo.pace >= p.speed;
      if (l.roar) {
        for (const side of [-1, 1]) ctx.particles.sparkle(v1.set(c.centerX(lip) + side * (c.halfWidth(lip) + 1.2), s.y + 3, -lip), EMBER, ctx.low ? 20 : 60, 7, 1.1, 0.3, null, 1.6);
      }
    }
    if (!active && !over) {
      l.offAt = 0;
      l.roar = false;
    }
    const age = l.offAt > 0 ? ctx.time - l.offAt : -1;
    // The flames climb the pylons with the sled's speed: the top one lights at the speed asked.
    const k = l.offAt > 0 ? (l.roar ? 1 : 0.12) : Math.max(0, Math.min(1, (s.speed - (p.speed - 14)) / 14));
    const hot = k >= 0.999;
    const pairs = p.speed >= 46 ? [lip - 3, lip - 19] : [lip - 3];
    const jets = ctx.low ? 3 : 5;
    if (s.z < lip + 160) {
      for (const z of pairs) {
        for (const side of [-1, 1]) {
          const x = c.centerX(z) + side * (c.halfWidth(z) + 2.6);
          const y = c.ground(x, z) + 0.9;
          for (let j = 0; j < jets; j++) {
            const lit = k * jets > j + 0.02;
            const top = j === jets - 1;
            const jy = y + j * (7.5 / jets);
            const boost = l.roar && age >= 0 && age < 1.6 ? 1 + 2.2 * (1 - age / 1.6) : 1;
            // (A flame a bowl and a bowl's height or more: at a third smaller the gate read as a row of
            // candles beside the run. Cold, each bowl still smoulders.)
            if (lit) kit.glow(x, jy + 1.9 * boost, z, (top && hot ? 7.6 : 5.8) * boost, top && hot ? WHITE_GOLD : EMBER, (top && hot ? 2.4 : 1.7) * (ctx.reduced ? 1 : 0.9 + 0.2 * Math.sin(ctx.time * 9 + j * 2 + side)), GLOW_FLAME, 0.7);
            else kit.glow(x, jy + 1.1, z, 3.4, EMBER, 1.35, GLOW_FLAME, 0.7);
          }
          kit.glow(x, y + 4, z, 16, hot ? HOT : EMBER, 0.3 + 0.4 * k, GLOW_SOFT, 0.5);
        }
        if (Math.abs(z - s.z) < 120) pushLocalLight(c.centerX(z), c.baseY(z) + 4, -z, 1, 0.55, 0.22, 26, (0.5 + 1.3 * k) * (l.roar && age < 1.2 ? 2 : 1));
      }
      // The run to the lip: chevrons that take the gate's heat.
      if (s.z < lip && !over) {
        for (let j = 0; j < 3; j++) {
          const z = lip - 9 - j * 9;
          if (z > s.z + 3) kit.decal(c, c.safeX(z), z, 5.5, 7, WHITE_GOLD, (0.7 + 0.8 * k) * (j === 0 ? breathe * 0.8 : 0.8), DECAL_CHEVRON);
        }
      }
      if (l.roar && age >= 0 && age < 1.2) kit.glow(c.centerX(lip), c.baseY(lip) + 4, lip, 10 + age * 30, HOT, 0.8 * (1 - age / 1.2), GLOW_RING, 1.6);
    }
    // The far line: braziers either side and a line of fire across the shelf. Won, it flares.
    if (s.z > p.far - 260) {
      const done = l.doneAt > 0 ? ctx.time - l.doneAt : -1;
      const lum = over ? (l.won ? 1.2 + 1.6 * Math.max(0, 1 - done / 1.5) : 0.25) : off ? breathe : 0.8;
      const col = over && l.won ? WHITE_GOLD : EMBER;
      const hw = c.halfWidth(p.far);
      kit.decal(c, c.centerX(p.far), p.far, 2.2, 2 * hw, col, lum, DECAL_LINE, Math.PI / 2);
      for (const side of [-1, 1]) {
        for (let j = 0; j < 3; j++) {
          const z = p.far + (j - 1) * 5;
          const x = c.centerX(z) + side * (hw + 1.4);
          kit.glow(x, c.ground(x, z) + 2.4, z, j === 1 ? 3.6 : 2.6, col, lum * 1.3, GLOW_FLAME, 0.7);
        }
      }
      if (Math.abs(p.far - s.z) < 120) pushLocalLight(c.centerX(p.far), c.baseY(p.far) + 2, -p.far, 1, 0.6, 0.3, 20, Math.min(2, lum));
    }
  }

  // ---------------------------------------------------------------- collapse

  private collapse(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    const ticks = sim && active ? sim.tick - sim.mo.t0 : 0;
    // Where the fall stands: not begun, at the sim's own line, or (once decided) where it stopped.
    let fz = p.from === 1 ? p.z1 + 4 : p.z0 - p.lead - 4;
    if (sim && active) {
      fz = fallZ(p, ticks, sim.mo.pace);
      l.gx[0] = fz;
    } else if (over) fz = p.from === 1 ? Math.max(l.gx[0] || p.keystone, p.keystone) : p.z1 + 4;
    const gone = (z: number): boolean => (p.from === 1 ? z > fz : z < fz);
    // Lamps down both edges, lit while their part of the span stands. In surges they pulse with the fall.
    const surge = p.surge > 0 && active && !ctx.reduced ? 0.5 + 0.5 * Math.sin((Math.PI * 2 * ticks) / 240) : 0;
    for (let z = p.z0 + 6; z < p.z1; z += 12) {
      if (z < s.z - 30 || z > s.z + 240 || gone(z)) continue;
      const near = Math.abs(z - fz) < 26;
      const lum = (near && active ? 1.7 : 0.9) + surge * 1.1;
      for (const side of [-1, 1]) {
        const x = c.centerX(z) + side * (c.halfWidth(z) + 0.7);
        const y = c.ground(x, z) + 2.75;
        this.lan(x, y, z, null, 1.1, 1.1, 1.1, near && active ? WHITE_GOLD : ICE, lum);
        if (!ctx.low) kit.glow(x, y, z, 2.6, ICE, 0.25 * lum, GLOW_SOFT);
      }
    }
    if (active) {
      // The fall line: a crack of light across the deck and the powder that stands over it.
      const hw = c.halfWidth(fz);
      const y = c.baseY(fz);
      kit.decalAt(c.centerX(fz), y + 0.12, fz, 1.6, 2 * hw + 2, ICE, 2.2, DECAL_LINE, Math.PI / 2);
      for (let k = 0; k < (ctx.low ? 3 : 6); k++) {
        const u = (k + 0.5) / (ctx.low ? 3 : 6);
        const off = p.from === 1 ? 3 + k * 2.5 : -3 - k * 2.5;
        kit.glow(c.centerX(fz) + (u * 2 - 1) * hw, y + 1.5 + ((k * 5) % 3), fz + off, 6 + k, ICE, 0.32 - k * 0.03, GLOW_SOFT);
      }
      if (Math.abs(fz - s.z) < 110) pushLocalLight(c.centerX(fz), y + 1.5, -fz, 0.6, 0.85, 1, 22, 1.4 + surge);
    }
    if (p.from === 1) {
      // The keystone: two beacons on pylons of ice and a ring on the deck. Reached, they flare.
      const done = l.doneAt > 0 ? ctx.time - l.doneAt : -1;
      const lum = over ? (l.won ? 1 + 2 * Math.max(0, 1 - done / 1.5) : 0.3) : breathe;
      const kz = p.keystone;
      for (const side of [-1, 1]) {
        const x = c.centerX(kz) + side * (c.halfWidth(kz) + 1.5);
        const y = c.ground(x, kz) + 6.6;
        kit.glow(x, y, kz, 3.4, WHITE_GOLD, lum * 1.3, GLOW_STAR);
        kit.glow(x, y - 2.5, kz, 9, ICE, 0.3 * lum, GLOW_SOFT, 0.4);
      }
      if (!over) kit.decalAt(c.centerX(kz), c.baseY(kz) + 0.12, kz, 2 * c.halfWidth(kz), 5, WHITE_GOLD, 0.7 * lum, DECAL_RING);
      if (Math.abs(kz - s.z) < 130) pushLocalLight(c.centerX(kz), c.baseY(kz) + 4, -kz, 0.8, 0.9, 1, 20, Math.min(2, lum));
    }
  }

  // ---------------------------------------------------------------- race

  private race(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    if (!sim) return;
    const ticks = active ? sim.tick - sim.mo.t0 : 0;
    const chase = p.style === 'chase';
    const cars = Math.max(1, p.cars.length);
    const warm = c.biome === 'volcanic' ? EMBER : HOT;
    for (let k = 0; k < cars; k++) {
      const z0 = p.z0 + (p.cars[k]?.lead ?? p.lead);
      const z = active ? machineZ(p, ticks, k) : over ? p.z1 : z0;
      if (over && l.doneAt > 0 && ctx.time - l.doneAt > 4) continue;
      cablePoint(c, p.side, z, v1);
      const caught = chase && ((l.mask >> k) & 1) === 1;
      if (caught && l.st[k] !== 1) {
        l.st[k] = 1;
        l.at[k] = ctx.time;
        ctx.particles.sparkle(v2.set(v1.x, v1.y - 2, v1.z), WHITE_GOLD, ctx.low ? 14 : 36, 4.4, 0.8, 0.26, null, 0.4);
      }
      const age = ctx.time - l.at[k];
      const lead = !chase && active && sim.mo.ahead;
      // The machine's own light: seen far down the bank, hot while it leads, pale once it is behind or caught.
      const col = caught ? WHITE_GOLD : k === 1 ? ROSE : warm;
      const lum = caught ? 0.5 + 2 * Math.max(0, 1 - age) : lead ? 0.6 : active ? breathe : 1;
      kit.glow(v1.x, v1.y - 2.4, z, 10, col, 0.5 * lum, GLOW_SOFT);
      kit.glow(v1.x, v1.y - 0.9, z, 2.6, WHITE_GOLD, 1.1 * lum, GLOW_STAR);
      if (caught && age < 1) kit.glow(v1.x, v1.y - 2.4, z, 5 + age * 18, WHITE_GOLD, 1.4 * (1 - age), GLOW_RING);
    }
    // The far end: a line of light across the run and a beacon at the station, the deadline.
    if (s.z > p.z1 - 300 && !(over && l.doneAt > 0 && ctx.time - l.doneAt > 3)) {
      const done = l.doneAt > 0 ? ctx.time - l.doneAt : -1;
      const lum = over ? (l.won ? 1 + 1.8 * Math.max(0, 1 - done / 1.2) : 0.25) : !chase && active && sim.mo.ahead ? breathe : 0.75;
      const col = over && l.won ? WHITE_GOLD : LIGHT;
      kit.decal(c, c.centerX(p.z1), p.z1, 1.8, 2 * c.halfWidth(p.z1), col, lum, DECAL_LINE, Math.PI / 2);
      cablePoint(c, p.side, p.z1 + 6, v1);
      kit.glow(v1.x, v1.y + 1.2, p.z1 + 6, 4, col, 1.2 * lum, GLOW_STAR, 1, ctx.reduced ? 0 : ctx.time * 0.8);
      kit.glow(v1.x, v1.y + 1.2, p.z1 + 6, 12, col, 0.2 * lum, GLOW_SOFT);
    }
    if (chase) return;
    // A sprint's station signal: three lamps. It leaves as you arrive (they go out as you come), it left
    // early (all dark, the machine away down the cable), it leaves late (all lit, and it waits).
    const zs = p.z0 + Math.max(0, p.lead) - 6;
    if (s.z > zs + 60) return;
    cablePoint(c, p.side, zs, v1);
    const gap = p.z0 - s.z;
    for (let j = 0; j < 3; j++) {
      const lit = p.lead > 30 ? false : p.lead < 0 ? !active || ticks < 20 : gap > 30 * (2 - j);
      const y = v1.y - 0.9 - j * 0.7;
      kit.glow(v1.x - p.side * 1.2, y, zs - 0.3, lit ? 2.6 : 1, lit ? (p.lead < 0 ? WHITE_GOLD : LIGHT) : DIM, lit ? 1.8 : 0.5, lit ? GLOW_STAR : GLOW_SOFT);
    }
  }

  // ---------------------------------------------------------------- rings

  private rings(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    if (p.rings.length < 3 || !sim) return;
    const lip = l.lip;
    const r0 = p.rings[0];
    const r1 = p.rings[1];
    // The slot on the lip the line is flown from (the first ring's own side), and where the flight begins.
    const x0 = r0.x - ((r1.x - r0.x) / (r1.z - r0.z)) * (r0.z - lip);
    const y0 = c.ground(x0, lip - 0.1) + 0.6;
    const high = p.variantKey === 'high';
    if (s.z < lip && !over) {
      const n = ctx.low ? 3 : 4;
      for (let j = 0; j < n; j++) {
        const z = lip - 7 - j * 10;
        if (z < s.z + 3) continue;
        const u = Math.min(1, (j * 10 + 7) / 44);
        const x = x0 + (c.safeX(z) - x0) * u * u;
        kit.decal(c, x, z, 5.5, 7, MARK, j === 0 ? breathe : 1, DECAL_CHEVRON);
      }
      // The high line is flown off a pop: the lip is marked where to spring.
      if (high) {
        kit.decal(c, x0, lip - 2.5, 4.4, 4.4, WHITE_GOLD, breathe, DECAL_RING);
        kit.glow(x0, y0 + 1.6, lip - 1, 3.2, WHITE_GOLD, 0.9 * breathe, GLOW_STAR);
      }
    }
    // A dotted arc of light from the lip through the three rings: taken, a span turns white gold; missed,
    // it gutters.
    const at = active ? sim.mo.at : over ? 3 : 0;
    const per = ctx.low ? 4 : 7;
    let ax = x0;
    let ay = y0;
    let az = lip;
    for (let i = 0; i < 3; i++) {
      const r = p.rings[i];
      const flown = i < at;
      const took = sim.mo.ok || over ? l.won || sim.mo.ok : false;
      const next = i === at && !over;
      for (let j = 1; j <= per; j++) {
        const u = j / (per + 1);
        const z = az + (r.z - az) * u;
        if (z < s.z - 10) continue;
        // (A little lift mid-span, so three straight spans read as one arc.)
        const y = ay + (r.y - ay) * u + (high ? 1.1 : 0.7) * Math.sin(Math.PI * u);
        kit.glow(ax + (r.x - ax) * u, y, z, flown ? 0.9 : next ? 1.6 : 1.2, flown && took ? WHITE_GOLD : LIGHT, flown ? 0.6 : next ? 1.3 * breathe : 1, GLOW_SOFT);
      }
      ax = r.x;
      ay = r.y;
      az = r.z;
    }
  }

  // ---------------------------------------------------------------- slide

  private slide(ctx: StageCtx, l: Look, active: boolean, over: boolean): void {
    const { kit, s, sim } = ctx;
    const c = ctx.course;
    const p = l.p;
    if (!sim) return;
    // The sign on the ice as the lake opens: one long crescent, or two that face each other.
    if (!over && s.z < p.z0 + 70) {
      const n = ctx.low ? 5 : 8;
      const arcs = p.both ? 2 : 1;
      for (let a = 0; a < arcs; a++) {
        const dir = a === 0 ? 1 : -1;
        const zc = p.z0 + (p.both ? 22 + a * 30 : 34);
        const len = p.both ? 26 : 54;
        for (let j = 0; j < n; j++) {
          const u = (j + 0.5) / n;
          const z = zc - len / 2 + u * len;
          const x = c.safeX(z) + dir * 5.5 * Math.sin(Math.PI * u);
          const yaw = Math.atan2((dir * 5.5 * Math.PI * Math.cos(Math.PI * u)) / len, 1);
          kit.decalAt(x, c.ground(x, z) + 0.07, z, 1.6, len / n + 0.6, WHITE_GOLD, 0.8 + 0.3 * Math.sin(Math.PI * u), DECAL_LINE, yaw);
        }
      }
    }
    // The drift itself, scribed in the ice behind the sled.
    const drifting = active && s.grounded && s.drifting && s.onIce && sim.mo.n > 0;
    if (drifting) {
      const last = this.scribe[this.scribe.length - 1];
      if (!this.scribeLive) {
        // A new drift: the last one's line is let go unless it stands for a way already won.
        if (!(p.both && l.mask !== 0)) this.scribe.length = 0;
        this.scribeBroke = 0;
      }
      if (!last || !this.scribeLive || Math.hypot(s.x - last.x, s.z - last.z) > 1.5) {
        if (this.scribe.length >= (ctx.low ? 48 : 110)) this.scribe.shift();
        this.scribe.push({ x: s.x, z: s.z, yaw: Math.atan2(s.vx, s.vz), dir: s.driftDir });
      }
      this.dust += ctx.dt;
      if (this.dust > (ctx.low ? 0.12 : 0.05)) {
        this.dust = 0;
        ctx.particles.sparkle(v1.set(s.x, s.y + 0.25, -s.z), ICE, ctx.low ? 2 : 5, 2.4, 0.5, 0.16, v2.set(s.vx * 0.6, 0, -s.vz * 0.6), 0.5);
      }
      pushLocalLight(s.x, s.y + 0.6, -s.z, 0.7, 0.9, 1, 9, 0.8 + 0.25 * sim.mo.at);
    }
    this.scribeLive = drifting;
    if (this.scribe.length === 0) return;
    const done = l.doneAt > 0 ? ctx.time - l.doneAt : -1;
    const broke = this.scribeBroke > 0 && !drifting ? Math.min(1, (ctx.time - this.scribeBroke) / 0.8) : 0;
    const q = active ? sim.mo.at : 0;
    let lum = (0.9 + 0.45 * q) * (1 - 0.8 * broke);
    let col = ICE;
    if (over && l.won) {
      lum = 1.2 + 2.2 * Math.max(0, 1 - done / 1.6);
      col = WHITE_GOLD;
      if (done > 9) this.scribe.length = 0;
    } else if (over) lum = Math.max(0, 0.3 - done * 0.05);
    for (let i = 0; i < this.scribe.length; i++) {
      const m = this.scribe[i];
      if (m.z < s.z - 150) continue;
      const head = i > this.scribe.length - 6 && drifting;
      kit.decalAt(m.x, c.ground(m.x, m.z) + 0.07, m.z, 1.4, 2.3, col, head ? lum * 1.5 : lum, DECAL_LINE, m.yaw);
      if (head && !ctx.low) kit.glow(m.x, c.ground(m.x, m.z) + 0.3, m.z, 0.9, WHITE_GOLD, 0.9, GLOW_STAR);
    }
  }

  // ---------------------------------------------------------------- steps

  private steps(ctx: StageCtx, l: Look, active: boolean, over: boolean, breathe: number): void {
    const { kit, s } = ctx;
    const c = ctx.course;
    const p = l.p;
    const stair = p.steps.length > 0;
    const per = ctx.low ? 3 : stair ? 7 : 5;
    const done = l.doneAt > 0 ? ctx.time - l.doneAt : -1;
    const share = p.need > 0 ? Math.min(1, l.seen / p.need) : 0;
    let nextArch = -1;
    for (let i = 0; i < l.arches.length; i++) if (nextArch < 0 && l.arches[i] > s.z + 4) nextArch = i;
    for (let i = 0; i < l.arches.length; i++) {
      const z = l.arches[i];
      if (z < s.z - 30 || z > s.z + 280) continue;
      const xa = c.centerX(z) - c.halfWidth(z) - 1.5;
      const xb = c.centerX(z) + c.halfWidth(z) + 1.5;
      const y = Math.max(c.ground(xa, z), c.ground(xb, z), c.baseY(z)) + 6.4;
      // An arch's light: on the stair, its own stomp; down a street, the count so far, arriving as a wave
      // that runs on ahead of the sled.
      let lum = stair ? 0.75 : 0.5;
      // (Round 8's review: a stair's waiting lanterns were the blossom's pink, which under the peach morning read as
      // crimson paper beside the rider's vermillion. A lantern is marigold, the lantern's own colour, ART.md 14.)
      let col = LIGHT;
      if (stair) {
        if (l.st[i] === 1) {
          const age = ctx.time - l.at[i];
          lum = 1.3 + 1.5 * Math.exp(-2.2 * age);
          col = WHITE_GOLD;
        } else if (i === nextArch && !over) lum = 0.5 + 0.45 * breathe;
      } else {
        const front = l.wave >= 0 ? (ctx.reduced ? 1e9 : s.z - 20 + (ctx.time - l.wave) * 150) : -1e9;
        const lit = z < front ? share : Math.max(0, share - 1 / Math.max(1, p.need));
        // (The review loop: at 0.45 a street's lanterns hung as dark drums until the first stomp, at dusk,
        // over snow they did not light. They burn low from the start, enough to pool on the snow under
        // them, and a stomp still doubles them.)
        lum = 0.85 + 1.1 * lit + (z < front && z > front - 40 ? 0.9 : 0);
        if (lit > 0.6) col = WHITE_GOLD;
      }
      if (over) {
        lum = l.won ? 1.3 + 1.2 * Math.max(0, 1 - done / 2) : 0.3;
        col = l.won ? WHITE_GOLD : DIM;
      }
      for (let j = 0; j < per; j++) {
        const u = (j + 0.5) / per;
        const sag = 0.9 * Math.sin(Math.PI * u);
        const k = 1.15 + 0.35 * Math.sin(Math.PI * u);
        this.lan(xa + (xb - xa) * u, y - 0.75 - sag, z, null, k, k, k, col, lum);
      }
      if (lum > 0.8 && !ctx.low) kit.glow((xa + xb) / 2, y - 1.4, z, 5, col, 0.16 * lum, GLOW_SOFT, 3);
      // In a row: one garland ties each arch to the next, so a row is seen before it is ridden.
      // (Round 8's review: from an arch the sled has passed, the garland ran from over the lens down to the next arch,
      // a black wire splitting the sky from the frame's top. It is drawn only from an arch still ahead.)
      if (p.row && i + 1 < l.arches.length && !ctx.low && z > s.z + 10) {
        const z2 = l.arches[i + 1];
        const y2 = Math.max(c.ground(c.centerX(z2) - c.halfWidth(z2) - 1.5, z2), c.ground(c.centerX(z2) + c.halfWidth(z2) + 1.5, z2), c.baseY(z2)) + 6.4;
        const xm = (xa + xb) / 2;
        const xm2 = c.centerX(z2);
        v1.set(xm2 - xm, y2 - y, -(z2 - z));
        const len = v1.length();
        q2.setFromUnitVectors(DOWN, v1.multiplyScalar(1 / len));
        this.ropes.put(xm, y, z, q2, 0.8, len, 0.8, null);
        for (let j = 1; j <= 3; j++) {
          const u = j / 4;
          this.lan(xm + (xm2 - xm) * u, y + (y2 - y) * u - 0.6 - 0.5 * Math.sin(Math.PI * u), z + (z2 - z) * u, null, 0.8, 0.8, 0.8, col, lum);
        }
      }
      // The tread under a stair's arch: where a stomp lands.
      if (stair && !over && l.st[i] !== 1) {
        const tz = z + 11;
        kit.decal(c, c.safeX(tz), tz, 7.5, 7.5, new Color('#FF7EB2'), i === nextArch ? breathe : 0.6, DECAL_RING);
      }
      if (Math.abs(z - s.z) < 90 && lum > 0.6) pushLocalLight((xa + xb) / 2, y - 2, -z, 1, 0.8, stair ? 0.7 : 0.5, 13, Math.min(1.6, lum * 0.6));
    }
    void active;
  }

  // ---------------------------------------------------------------- flourish

  private flourish(ctx: StageCtx, l: Look, active: boolean, over: boolean): void {
    const { kit, s } = ctx;
    const c = ctx.course;
    const p = l.p;
    const z = l.lip - 4;
    if (s.z > z + 200) return;
    // Which wheel stands on which pole: a spin lies flat and spins, a flip stands and turns.
    const spins = Math.floor(p.half / 2);
    const kinds = spins > 0 && p.flips > 0 ? [0, 1] : spins > 0 ? [0, 0] : [1, 1];
    const done = l.doneAt > 0 ? ctx.time - l.doneAt : -1;
    const near = Math.max(0, Math.min(1, 1 - (z - s.z) / 260));
    const rate = ctx.reduced ? 0 : over ? (l.won ? 9 : 0.3) : 1.5 + 4 * near;
    const lum = over ? (l.won ? 1.3 + 1.5 * Math.max(0, 1 - done / 1.5) : 0.5) : 1.05 + 0.25 * near;
    const col = over && l.won ? WHITE_GOLD : PAPER;
    [-1, 1].forEach((side, k) => {
      const x = c.centerX(z) + side * (c.halfWidth(z) + 2.4);
      const y = c.ground(x, z) + 6.6;
      const turn = ctx.time * rate + k * 1.3;
      if (kinds[k] === 0) {
        // Flat, tipped a little toward the rider so its face is seen from the run.
        q1.setFromAxisAngle(AXIS_X, -Math.PI / 2 + 0.5);
        q2.setFromAxisAngle(AXIS_Z, turn);
        q1.multiply(q2);
      } else q1.setFromAxisAngle(AXIS_Z, -turn);
      this.wheels.put(x, y, z, q1, 3.6, 3.6, 3.6, col, lum * 1.3);
      kit.glow(x, y, z, 7, kinds[k] === 0 ? ROSE : WHITE_GOLD, 0.22 * lum, GLOW_SOFT);
      if (over && l.won && done < 1.2) kit.glow(x, y, z, 5 + done * 14, WHITE_GOLD, 1.3 * (1 - done / 1.2), GLOW_RING);
      if (Math.abs(z - s.z) < 90) pushLocalLight(x, y - 1, -z, 1, 0.8, 0.78, 14, 0.6 * lum);
    });
    void active;
    void UP;
    void DECAL_POOL;
  }
}
