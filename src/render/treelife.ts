import { Color, type ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
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
  /** Round 8, the near trees (nearforest.ts): the distances from the lens over which a tree is handed from the far
   *  build to the near one, the forest wall's and the run's own trees' (each switched on only once its near trees are
   *  made). Off (NEAR_OFF): no tree is handed over and the near batches draw nothing. */
  uNearWall: { value: new Vector2(-1, -0.5) },
  uNearOb: { value: new Vector2(-1, -0.5) },
  /** Where the near trees were gathered round this frame (the chase lens): every pass that draws the forest (the
   *  mirror, the ice's reflection) splits it by the distance from here, so it splits it as the gathering did. */
  uNearEye: { value: new Vector3() },
};

/** The hand-over switched off. */
export const NEAR_OFF = new Vector2(-1, -0.5);

const WIND_PARS = /* glsl */ `
uniform float uWindK;
#ifdef GS_SHIVER
  uniform vec4 uShiver[4];
#endif
#ifdef GS_HANDOFF
  uniform vec2 uNearLod;
  uniform vec3 uNearEye;
  varying float vHand;
#endif
#ifdef GS_LENS
  varying float vLens;
#endif
`;

// Round 8: a tree beside or behind the rider dissolves whole through a screen-door as it nears the lens, before it can
// fill the frame's side: on Low (no near build there) from LENS_LOW, before its few broad facets do; on Medium and up
// from LENS_NEAR, a near tree, which a still caught half dissolved by the fragments' own near fade as a milky dome (the
// first critic). A tree ahead of the rider is a threat and stays solid however near.
export const LENS_LOW: [number, number] = [4.5, 8];
export const LENS_NEAR: [number, number] = [3, 5.5];
const LENS_VERT = /* glsl */ `
  #ifdef GS_LENS
    {
      vec3 gsF = (modelMatrix * vec4(gsIp, 1.0)).xyz;
      vec3 gsFw = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
      float gsRd = dot(uFocus - cameraPosition, gsFw);
      float gsBeside = smoothstep(gsRd + 2.0, gsRd + 0.5, dot(gsF - cameraPosition, gsFw));
      vLens = mix(1.0, smoothstep(GS_LENS_A, GS_LENS_B, distance(gsF.xz, cameraPosition.xz)), gsBeside);
    }
  #endif`;

// Round 8: a tree is handed between its far build and its near one by its foot's distance from the lens, whole: the far
// batch lets go of it inside the band and the near batch takes it, each through the other's half of one screen-door
// (the same noise, so between them every pixel is drawn once), and outside the band each draws nothing of it.
const HAND_VERT = /* glsl */ `
  #ifdef GS_HANDOFF
    {
      float gsD = distance((modelMatrix * vec4(gsIp, 1.0)).xyz, uNearEye);
      vHand = (gsD - uNearLod.x) / max(uNearLod.y - uNearLod.x, 0.001);
      #ifdef GS_NEAR
        if (vHand >= 1.0) {
      #else
        if (vHand <= 0.0) {
      #endif
          gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
          return;
        }
    }
  #endif`;

const HAND_FRAG = /* glsl */ `
#ifdef GS_HANDOFF
  varying float vHand;
#endif
#ifdef GS_LENS
  varying float vLens;
#endif
void main() {
  #ifdef GS_LENS
    // (Only the middle of the band is dithered, as a near prop's own fade is, materials.ts: a tree is solid, then gone in
    // the few tenths of a metre a frame carries the lens, and no still catches it stippled or milky.)
    if (vLens < 1.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) >= (vLens - 0.42) / 0.16) discard;
  #endif
  #ifdef GS_HANDOFF
    if (vHand < 1.0) {
      float gsN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      #ifdef GS_NEAR
        if (gsN < vHand) discard;
      #else
        if (gsN >= vHand) discard;
      #endif
    }
  #endif`;

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
    ${HAND_VERT}
    ${LENS_VERT}
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
 *  the bough bob and the shaken trees (Medium and High). Safe on a material already patched for variants.
 *  Round 8: with `shiver` a tree also hands itself to its near build inside the near band (the forest wall's batch,
 *  a variant material, by uNearWall; the run's own trees by uNearOb); `near` makes the near build's own material,
 *  which draws a tree only inside the band. */
export function liveTree(mat: ShaderMaterial, shiver: boolean, near?: 'wall' | 'ob'): ShaderMaterial {
  if (!mat.vertexShader.includes('#include <begin_vertex>')) throw new Error('liveTree: no begin_vertex');
  if (!mat.fragmentShader.includes('void main() {')) throw new Error('liveTree: no main');
  mat.vertexShader = WIND_PARS + mat.vertexShader.replace('#include <begin_vertex>', WIND);
  mat.uniforms.uWindK = wind.uWindK;
  if (shiver) {
    mat.uniforms.uShiver = wind.uShiver;
    mat.defines = { ...mat.defines, GS_SHIVER: 1 };
    const group = near ?? (mat.vertexShader.includes('attribute float aVar') ? 'wall' : 'ob');
    mat.uniforms.uNearLod = group === 'wall' ? wind.uNearWall : wind.uNearOb;
    mat.uniforms.uNearEye = wind.uNearEye;
    // (What share of a tree standing at `foot` this material draws, for the playtest probes: scripts/playtest/shards.js.)
    const band = mat.uniforms.uNearLod.value as Vector2;
    mat.userData.gsKeep = (_mid: number[], foot: number[] | null) => {
      if (!foot) return 1;
      const e = wind.uNearEye.value;
      const h = Math.max(0, Math.min(1, (Math.hypot(foot[0] - e.x, foot[1] - e.y, foot[2] - e.z) - band.x) / Math.max(band.y - band.x, 1e-3)));
      return near ? 1 - h : h;
    };
    mat.defines = { ...mat.defines, GS_HANDOFF: 1, ...(near ? { GS_NEAR: 1 } : {}) };
    mat.fragmentShader = mat.fragmentShader.replace('void main() {', HAND_FRAG);
  }
  {
    // (Every tree dissolves whole beside the lens: LENS_VERT. Low's, and the far rows', which never come this near, from
    // further off.)
    const lens = shiver ? LENS_NEAR : LENS_LOW;
    mat.defines = { ...mat.defines, GS_LENS: 1, GS_LENS_A: lens[0].toFixed(2), GS_LENS_B: lens[1].toFixed(2) };
    if (!shiver) mat.fragmentShader = mat.fragmentShader.replace('void main() {', HAND_FRAG);
    const hand = mat.userData.gsKeep as ((m: number[], f: number[] | null) => number) | undefined;
    const ss = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    mat.userData.gsKeep = (mid: number[], foot: number[] | null, eye: { x: number; y: number; z: number }, fw: number[]) => {
      const h = hand ? hand(mid, foot) : 1;
      if (h < 0.5) return h;
      const f = mat.uniforms.uFocus?.value as { x: number; y: number; z: number } | undefined;
      if (!foot || !f || !fw) return h;
      const rd = (f.x - eye.x) * fw[0] + (f.y - eye.y) * fw[1] + (f.z - eye.z) * fw[2];
      const ah = (foot[0] - eye.x) * fw[0] + (foot[1] - eye.y) * fw[1] + (foot[2] - eye.z) * fw[2];
      const beside = ss(rd + 2, rd + 0.5, ah);
      return Math.min(h, 1 + (ss(lens[0], lens[1], Math.hypot(foot[0] - eye.x, foot[2] - eye.z)) - 1) * beside);
    };
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
