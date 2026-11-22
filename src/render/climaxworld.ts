import { type BufferGeometry, Color, Mesh, Object3D, Vector3 } from 'three';
import type { Course } from '../sim/course';
import { type Climax, climaxOf } from '../sim/moments';
import { merge } from './flora';
import { FW_PAIRS, type ShellKind } from './fireworks';
import { seg } from './landmarkKit';
import { pushLocalLight } from './lights';
import { DECAL_LINE, GLOW_SOFT, GLOW_STAR, type MomentKit, type Pool, type StageCtx } from './momentkit';
import { lanternGeo } from './verbworld';

// Round 7 (the momentsworld lane): the last stage's picture, built to peak at the line. From the last leap's
// lip (moments.ts climaxOf: where the music takes its breath) to the finish, strings of lanterns over the
// run take light in a wave that runs ahead of the sled and reaches the line before it; two beams stand up
// over the line and grow as the sled comes; shells go up as the sled lands the leap, as it enters the
// town and as it nears the line, each timed from the sled's own speed to break over the line as it
// arrives. Everything is keyed to the sled's place, never the clock, as the music's finale is. Nothing here
// is a collider: the strings hang 9 m over the snow from points outside the run.

const LIGHT = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const INK = new Color('#2A2D48');
const STRING_STEP = 34;
const STRING_H = 9.4;
const KINDS: readonly ShellKind[] = ['peony', 'willow', 'ring', 'chrysanthemum', 'crackle'];

const from = new Vector3();
const to = new Vector3();

/** The volley that breaks over the line: how many shells and how high, for a rider who leads and one who does not. */
export function lineShells(leading: boolean): { n: number; high: number } {
  return leading ? { n: 5, high: 58 } : { n: 2, high: 44 };
}

export class ClimaxWorld {
  readonly root = new Object3D();
  private cx: Climax | null = null;
  private wires: Mesh | null = null;
  private strings: number[] = [];
  private readonly lanterns: Pool;
  /** Which volleys this run has sent up, a bit each, and whether the line's own burst has gone. */
  private sent = 0;
  private lineAt = 0;
  /** The rider is at the head of the field (marqueeworld.ts hands it on each frame). */
  leading = true;

  constructor(private readonly kit: MomentKit) {
    this.lanterns = kit.pool(lanternGeo(6), 72, kit.lit);
  }

  setCourse(c: Course): void {
    if (this.wires) {
      this.root.remove(this.wires);
      this.wires.geometry.dispose();
      this.wires = null;
    }
    this.cx = climaxOf(c);
    this.strings = [];
    const parts: BufferGeometry[] = [];
    // (Round 8: the strings stop 40 m short of the line, not 12. From the last 60 m of the approach a string within
    // 12 to 46 m of the line hung across the FINISH board's lettering at its own height; 40 m short, it is overhead by
    // then and the board reads clear.)
    // (Round 8, the review loop: on Lanternfall the last string 40 m short still hung
    // across the board's top from 60 m out, and on a phone over its letters: there they stop 70 m short.)
    const short = c.biome === 'lantern' ? 70 : 40;
    for (let z = this.cx.landZ + 20; z < this.cx.lineZ - short; z += STRING_STEP) {
      this.strings.push(z);
      const hw = c.halfWidth(z) + 1.6;
      const y = c.baseY(z) + STRING_H;
      parts.push(seg([c.centerX(z) - hw, y, -z], [c.centerX(z) + hw, y, -z], 0.04, INK, 3));
    }
    if (parts.length) {
      this.wires = new Mesh(merge(parts), this.kit.toon);
      this.wires.visible = false;
      this.root.add(this.wires);
    }
    this.reset();
  }

  reset(): void {
    this.sent = 0;
    this.lineAt = 0;
  }

  /** A volley of shells that break over the line, sent from behind the square. */
  private volley(ctx: StageCtx, n: number, rise: number, high: number): void {
    const fw = ctx.fireworks;
    const cx = this.cx;
    if (!fw || !cx) return;
    const c = ctx.course;
    const count = ctx.low ? Math.ceil(n / 2) : n;
    for (let k = 0; k < count; k++) {
      const side = k % 2 ? 1 : -1;
      const z = cx.lineZ + 50 + ((k * 37) % 60);
      const x = c.centerX(cx.lineZ) + side * (14 + ((k * 53) % 26));
      const y = c.baseY(cx.lineZ);
      const pair = FW_PAIRS[(k + this.sent) % FW_PAIRS.length];
      fw.shell(from.set(x + side * 6, y, -z - 10), to.set(x, y + high + ((k * 11) % 14), -z), rise + k * 0.16, pair[0], pair[1], KINDS[(k + this.sent) % KINDS.length]);
    }
  }

  update(ctx: StageCtx): void {
    const cx = this.cx;
    const s = ctx.s;
    const on = !!cx && !!ctx.sim && ctx.mode !== 'title' && s.z > cx.peakZ - 80;
    if (this.wires && this.wires.visible !== on) this.wires.visible = on;
    if (!on || !cx) return;
    const c = ctx.course;
    const kit = this.kit;
    const span = cx.lineZ - cx.peakZ;
    const u = Math.max(0, Math.min(1, (s.z - cx.peakZ) / span));
    const done = s.finished || s.z >= cx.lineZ;
    if (done && this.lineAt === 0) this.lineAt = ctx.time;
    const after = this.lineAt > 0 ? ctx.time - this.lineAt : -1;
    // The wave of light runs ahead of the sled and is at the line while the sled is still coming.
    const front = done ? 1e9 : s.z + 50 + 260 * u;
    const per = ctx.low ? 3 : 5;
    // (Lanternfall's snow is pale and its night is lit already: the climax's lights at full washed the whole
    // finish to cream. There they lay a third of their light, and the great lantern is the light at the line.)
    const lay = c.biome === 'lantern' ? 0.35 : 1;
    for (let i = 0; i < this.strings.length; i++) {
      const z = this.strings[i];
      if (z < s.z - 40 || z > s.z + 340) continue;
      const lit = z < front;
      const edge = lit && !done && z > front - 45 && !ctx.reduced ? 1 : 0;
      const beat = done && !ctx.reduced ? 0.5 + 0.5 * Math.sin(ctx.time * 7 - i * 0.9) : 0;
      const lum = lit ? 1.15 + 0.9 * edge + 0.8 * beat : 0.45;
      const hw = c.halfWidth(z) + 1.6;
      const y = c.baseY(z) + STRING_H;
      for (let j = 0; j < per; j++) {
        const v = (j + 0.5) / per;
        const k = 1.9 + 0.6 * Math.sin(Math.PI * v);
        this.lanterns.put(c.centerX(z) + (v * 2 - 1) * hw, y - 0.7 - 1.1 * Math.sin(Math.PI * v), z, null, k, k, k, lit ? WHITE_GOLD : LIGHT, lum * 1.8);
      }
      if (lit && Math.abs(z - s.z) < 80) pushLocalLight(c.centerX(z), y - 3, -z, 1, 0.85, 0.55, 15, Math.min(1.5, lum * 0.6) * lay);
    }
    // The line itself: two beams that stand taller as the sled comes, and a bar of light across the snow.
    const rise = u * u;
    const flare = after >= 0 ? Math.max(0, 1 - after / 2.5) : 0;
    const lx = c.centerX(cx.lineZ);
    const lhw = c.halfWidth(cx.lineZ);
    const ly = c.baseY(cx.lineZ);
    if (s.z > cx.lineZ - 420 && s.z < cx.lineZ + 60) {
      const h = 18 + 46 * rise;
      for (const side of [-1, 1]) {
        // (On Lanternfall the beams are a fifth: at the line the lens stands between them, and two columns of
        // white-gold sixty metres tall were a veil over the whole frame.)
        kit.glow(lx + side * (lhw + 2.5), ly + h / 2, cx.lineZ + 2, h, WHITE_GOLD, (0.5 + 1.1 * rise + flare) * (lay < 1 ? 0.2 : 1), GLOW_SOFT, 0.1);
        kit.glow(lx + side * (lhw + 2.5), ly + 2, cx.lineZ + 2, 4 + 3 * rise, WHITE_GOLD, (0.8 + rise + 1.5 * flare) * (0.5 + 0.5 * lay), GLOW_STAR);
      }
      kit.decal(c, lx, cx.lineZ, 2.4, 2 * lhw, WHITE_GOLD, (0.5 + 0.9 * rise + 1.5 * flare) * (0.4 + 0.6 * lay), DECAL_LINE, Math.PI / 2);
      // (The review loop, three passes running: at up to 3.1 over 34 m the line's light flooded the snow
      // and the square orange as the sled crossed and bleached the rider to a peach ghost. It peaks at
      // 1.6: the beams, the bar and the shells carry the moment. On Lanternfall it is a sliver of the stock
      // one: at the flare it lit the square cream, and the great lantern is the light at the line there.)
      pushLocalLight(lx, ly + 5, -cx.lineZ, 1, 0.9, 0.65, 34, lay < 1 ? (0.4 + 1.2 * rise + 1.5 * flare) * 0.12 : 0.35 + 0.75 * rise + 0.5 * flare);
    }
    if (ctx.mode !== 'run') return;
    // Shells, each volley once a run: as the sled lands the leap, as it comes into the town, and timed from
    // its own speed to break over the line as it crosses.
    const v = Math.max(18, s.speed);
    const eta = (cx.lineZ - s.z) / v;
    const send = (bit: number, when: boolean, n: number, riseS: number, high: number): void => {
      if (!when || this.sent & bit) return;
      this.volley(ctx, n, riseS, high);
      this.sent |= bit;
    };
    send(1, s.z >= cx.landZ && s.grounded, 2, 1.3, 46);
    send(2, s.z >= cx.townZ, 3, 1.2, 52);
    // The volley over the line is the win's: five shells, high, for a rider at the head of the field. Anyone
    // else is still welcomed home, by two that break lower, so a win reads as a win from the saddle. (Decided
    // on the frame they are sent, about 1.7 s out: a pass on the line itself comes too late to change it.)
    const shells = lineShells(this.leading);
    send(4, eta < 1.7 && s.z < cx.lineZ, shells.n, Math.max(0.6, eta - 0.1), shells.high);
  }
}
