import { Color, type ShaderMaterial, Vector4 } from 'three';
import type { GhostPose } from '../game/ghosts';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import { BUDGET, byTier, fx } from './fxhub';
import { shared } from './materials';
import type { Particles } from './particles';

// Trees that live (round 7, ART.md 4 and 15). Three things, all render only:
//
//   The wind. Every foliage material is patched (liveTree) to bend its trees in fronts that cross the slope,
//   each tree in its own phase, the lean growing with the square of the height and the bough ends bobbing by
//   their reach from the trunk, so the tips move and the foot stands still. Reduced motion stills it all.
//
//   The shiver. A tree a rider shaves or passes close shakes for about a second and a half: a fast, decaying
//   tremble, strongest at the tips, its boughs dipping as the load leaves them. Up to four trees at once
//   (uniforms: where, when, how hard), Medium and High.
//
//   What falls. A rider passing a forest tree close at speed shakes its snow off (the player's sift is
//   world.ts's, thrown where the chase lens sees it; a ghost's falls at the tree itself, down the run where
//   you watch it happen). Sakura's blossom sheds petals as you pass and all the time in the wind; Ember's
//   charred pines shed ash; Pinecrest's boughs let a sift go in a gust now and then.

/** The wind's uniforms, shared by every patched material. */
export const wind = {
  /** 1 in play, 0 under reduced motion (eased by TreeLife.update). */
  uWindK: { value: 1 },
  /** Trees shaking: x, z (three.js space), the time it began, how hard (0 to 1). */
  uShiver: { value: [new Vector4(0, 0, -99, 0), new Vector4(0, 0, -99, 0), new Vector4(0, 0, -99, 0), new Vector4(0, 0, -99, 0)] },
};

const WIND_PARS = /* glsl */ `
uniform float uWindK;
#ifdef GS_SHIVER
  uniform vec4 uShiver[4];
#endif
`;

// Added right after the vertex's own position is read: the instance's foot names the tree (its phase, and
// which front of wind it stands in). Offsets are in the tree's own frame, so each leans its own way off the
// wind's line by its yaw: a stand moves together in time, not in step.
const WIND = /* glsl */ `#include <begin_vertex>
  {
    #ifdef USE_INSTANCING
      vec3 gsIp = instanceMatrix[3].xyz;
    #else
      vec3 gsIp = vec3(0.0);
    #endif
    float gsK = max(transformed.y, 0.0) / 6.0;
    float gsK2 = gsK * gsK;
    float gsPh = gsIp.x * 0.37 + gsIp.z * 0.21;
    // Fronts of wind cross the slope about every twelve seconds, a hundred and fifty metres apart.
    float gsFront = 0.5 + 0.5 * sin(uTime * 0.52 - (gsIp.x * 0.8 + gsIp.z * 0.6) * 0.042);
    float gsGust = uWindK * (0.3 + 0.7 * gsFront * gsFront);
    float gsBend = sin(uTime * 1.7 + gsPh) * 0.55 + sin(uTime * 2.9 + gsPh * 1.9) * 0.3 + 0.5;
    transformed.x += 0.24 * gsBend * gsGust * gsK2;
    transformed.z += 0.18 * gsBend * gsGust * gsK2;
    #ifdef GS_SHIVER
      float gsReach = length(transformed.xz);
      // Bough ends bob, more the further out and the higher up they hang.
      transformed.y += sin(uTime * 4.3 + gsPh * 3.1 + gsReach * 2.6 + transformed.y) * gsReach * 0.05 * gsGust * (0.4 + gsK);
      for (int gsI = 0; gsI < 4; gsI++) {
        vec4 gsS = uShiver[gsI];
        float gsAge = uTime - gsS.z;
        if (gsAge > 0.0 && gsAge < 1.6 && distance(gsIp.xz, gsS.xy) < 1.7) {
          float gsAmp = gsS.w * exp(-gsAge * 3.2) * uWindK;
          transformed.x += sin(gsAge * 38.0 + transformed.y * 2.1) * gsAmp * (0.04 + 0.13 * gsK);
          transformed.z += cos(gsAge * 31.0 + transformed.y * 1.7) * gsAmp * (0.04 + 0.13 * gsK);
          // The boughs dip as their load goes, then spring back.
          transformed.y -= gsAmp * gsReach * 0.07 * sin(min(gsAge * 5.0, 3.1416));
        }
      }
    #endif
  }`;

/** Foliage materials patched so far, with the sway each was made with (reduced motion stills that too). */
const live: Array<{ mat: ShaderMaterial; sway: number }> = [];

/** Patches a toon material made for foliage (materials.ts, `sway` > 0) to move in the wind. `shiver` adds
 *  the bough bob and the shaken trees (Medium and High). Safe on a material already patched for variants. */
export function liveTree(mat: ShaderMaterial, shiver: boolean): ShaderMaterial {
  if (!mat.vertexShader.includes('#include <begin_vertex>')) throw new Error('liveTree: no begin_vertex');
  mat.vertexShader = WIND_PARS + mat.vertexShader.replace('#include <begin_vertex>', WIND);
  mat.uniforms.uWindK = wind.uWindK;
  if (shiver) {
    mat.uniforms.uShiver = wind.uShiver;
    mat.defines = { ...mat.defines, GS_SHIVER: 1 };
  }
  live.push({ mat, sway: (mat.uniforms.uSway?.value as number) ?? 0 });
  if (live.length > 24) live.splice(0, live.length - 24);
  return mat;
}

/** A forest tree passed within this many metres of its trunk, at this speed or more, is shaken. */
const SHED_R = 2.5;
const SHED_SPEED = 18;
const PETAL = [new Color('#FFC9DA'), new Color('#FFE3EC'), new Color('#F7A8C4')];
const ASH = [new Color('#8E8690'), new Color('#B9AEB6'), new Color('#5E5866')];
const WHITE = [new Color('#FFFFFF')];

export class TreeLife {
  private course: Course | null = null;
  private readonly buf: number[] = new Array(48).fill(0);
  private readonly mine = new Set<number>();
  private readonly theirs = new Set<number>();
  private slot = 0;
  private turn = 0;
  private acc = 0;
  private lastZ = Number.NaN;
  /** Sheds and shivers since the run began (tests and the cost report). */
  shed = 0;

  constructor(private readonly particles: Particles) {}

  setCourse(c: Course): void {
    this.course = c;
    this.reset();
  }

  reset(): void {
    this.mine.clear();
    this.theirs.clear();
    this.lastZ = Number.NaN;
    this.shed = 0;
    for (const v of wind.uShiver.value) v.set(0, 0, -99, 0);
  }

  /** A tree at sim (x, z) shakes, `amp` 0 to 1 (a shaved tree shakes hardest). */
  shiver(x: number, z: number, amp: number): void {
    if (byTier(BUDGET.shivers) === 0 || fx.reduced) return;
    wind.uShiver.value[this.slot].set(x, -z, shared.uTime.value, amp);
    this.slot = (this.slot + 1) % 4;
  }

  /** What a tree of this mountain lets go of when shaken: snow, and on Sakura petals, on Ember ash. */
  private fall(x: number, z: number, k: number, atTree: boolean): void {
    const c = this.course!;
    const y = c.ground(x, z);
    const biome = c.biome;
    // (The player's own sift is thrown beside the lens by world.ts: only what a mountain adds falls here.)
    if (atTree) this.particles.shedAt(x, y, -z, 16 * k);
    if (biome === 'blossom') this.particles.flakes(x, y + 3.6, -z, PETAL, 12 * k, 1.5, 1.4, 0.13);
    else if (biome === 'volcanic') this.particles.flakes(x, y + 3.2, -z, ASH, 9 * k, 1.1, 0.8, 0.1);
  }

  /** Per frame: the wind eases in and out of reduced motion; the rider and one ghost a frame shake the
   *  trees they pass; and the trees ahead let petals, ash or a sift of snow go in the wind. */
  update(dt: number, mode: 'run' | 'title' | 'results', s: Snap, poses: ReadonlyMap<number, GhostPose | null>): void {
    const to = fx.reduced ? 0 : 1;
    wind.uWindK.value += (to - wind.uWindK.value) * Math.min(1, dt * 4);
    for (const l of live) if (l.mat.uniforms.uSway) l.mat.uniforms.uSway.value = l.sway * wind.uWindK.value;
    const trees = fx.trees;
    const c = this.course;
    if (!trees || !c || mode === 'results') return;
    // A new run (or a jump far down the course) forgets which trees have shed.
    if (!(Math.abs(s.z - this.lastZ) < 120)) {
      this.mine.clear();
      this.theirs.clear();
    }
    this.lastZ = s.z;
    if (mode === 'run' && !s.crashed && s.speed >= SHED_SPEED) {
      const n = trees.treesNear(s.x, s.z, SHED_R, 1.5, this.buf);
      for (let k = 0; k < n; k++) {
        const key = this.buf[k * 3];
        if (this.mine.has(key)) continue;
        this.mine.add(key);
        if (this.mine.size > 256) this.mine.delete(this.mine.values().next().value as number);
        this.shiver(this.buf[k * 3 + 1], this.buf[k * 3 + 2], 0.8);
        this.fall(this.buf[k * 3 + 1], this.buf[k * 3 + 2], 1, false);
        this.shed++;
      }
    }
    // One ghost a frame (a ghost at 30 m/s is looked at every few metres: the window ahead covers it).
    if (poses.size > 0) {
      let i = 0;
      const pick = this.turn++ % poses.size;
      for (const p of poses.values()) {
        if (i++ !== pick) continue;
        if (!p || p.done || !p.grounded || p.speed < SHED_SPEED) break;
        const dz = p.z - s.z;
        if (dz < -12 || dz > 150) break;
        const n = trees.treesNear(p.x, p.z, SHED_R, 6, this.buf);
        for (let k = 0; k < n; k++) {
          const key = this.buf[k * 3];
          if (this.theirs.has(key)) continue;
          this.theirs.add(key);
          if (this.theirs.size > 256) this.theirs.delete(this.theirs.values().next().value as number);
          this.shiver(this.buf[k * 3 + 1], this.buf[k * 3 + 2], 0.7);
          this.fall(this.buf[k * 3 + 1], this.buf[k * 3 + 2], 0.8, true);
          this.shed++;
        }
        break;
      }
    }
    // The wind takes something off a tree ahead: petals all the time on Sakura, ash on Ember, and on the
    // other mountains a sift of snow off a bough now and then. Stilled under reduced motion.
    if (fx.reduced) return;
    this.acc += dt;
    const biome = c.biome;
    const every = biome === 'blossom' ? 0.07 : biome === 'volcanic' ? 0.16 : 0.9;
    if (this.acc < every) return;
    this.acc = 0;
    const n = trees.treesNear(s.x, s.z + 8 + Math.random() * 70, 60, 8, this.buf);
    if (n === 0) return;
    const k = Math.floor(Math.random() * n);
    const x = this.buf[k * 3 + 1];
    const z = this.buf[k * 3 + 2];
    const y = c.ground(x, z);
    if (biome === 'blossom') this.particles.flakes(x, y + 3.4, -z, PETAL, 2.4, 1.4, 1.2, 0.13);
    else if (biome === 'volcanic') this.particles.flakes(x, y + 3, -z, ASH, 2, 1, 0.7, 0.1);
    else this.particles.flakes(x, y + 3.2, -z, WHITE, 7, 0.8, 0.5, 0.06, true);
  }

  /** A near miss on a tree (the director's beat): the tree you shaved shakes hardest. */
  nearMiss(x: number, z: number, whisker: boolean): void {
    this.shiver(x, z, whisker ? 1 : 0.85);
    if (this.course) this.fall(x, z, whisker ? 1 : 0.7, false);
  }
}
