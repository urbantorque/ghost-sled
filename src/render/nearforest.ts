import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Object3D, type ShaderMaterial, type Vector3 } from 'three';
import { CHUNK_LEN, type Course } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { CEDAR, type NearBuild, blossomGeometry, nearPineGeometry, nearSteps, nearWall } from './flora';
import { makeToonMaterial } from './materials';
import type { Palette } from './palette';
import type { Props } from './props';
import { NEAR_OFF, liveTree, wind } from './treelife';

// Round 8: a forest that holds up at the lens (ART.md 12). The far forest is built to be seen from a few metres off the
// run and further; within a tree or two of the lens its tiers were a handful of planes a third of the frame wide. So the
// trees nearest the lens are drawn again from a near build (flora.ts nearPineGeometry, the blossom's 'close' canopy):
// the same tiers, reach, snow and turn, as layered rounded boughs under shelves of snow on a real trunk.
//
// Each frame the forest wall's trees and the run's own trees standing within GATHER metres of the lens are copied out of
// the props' packed chunks (props.ts packedAt: nothing is made) into one small batch a kind of tree. The far batches and
// these hand each tree over between NEAR_IN and NEAR_OUT metres by its foot's distance from where they were gathered,
// in the vertex shader (treelife.ts), so whatever lens draws the frame (the chase, the mirror, the ice's reflection)
// every tree is drawn once. A kind's batch costs a draw only while one of its trees is near; nothing is made before the first frame,
// and each near build is made on idle time after it. Medium and High (the phone on Medium a leaner build); Low keeps
// its own trees.

/** Within NEAR_IN m of the lens a tree is its near build, past NEAR_OUT its far one, between them it is handed over. */
export const NEAR_IN = 20;
export const NEAR_OUT = 24;
/** How far from the lens trees are gathered: a little past NEAR_OUT. */
const GATHER = NEAR_OUT + 0.5;
/** Trees a near batch holds (a tree run crowds about thirty of one kind within GATHER of the lens). */
const CAP = 80;
/** No near build is made before this long after the first frame, then one an idle callback. */
const START_MS = 1500;

interface Slot {
  /** The packed batch it draws from ('fw:a', 'ob:pine'), and for the wall which pick. */
  from: string;
  pick: number;
  group: 'wall' | 'ob';
  make: () => BufferGeometry;
  mesh: InstancedMesh | null;
}

/** The kinds of tree a mountain draws near: its wall's four (where its wall moves in the wind) and its run's trees. */
export function nearSlots(biome: BiomeId, p: Palette, nb: NearBuild): Array<Omit<Slot, 'mesh'>> {
  const out: Array<Omit<Slot, 'mesh'>> = [];
  if (nearWall(biome)) {
    for (const set of ['a', 'b'] as const) {
      nearSteps(biome, p, set, nb).forEach((make, pick) => out.push({ from: 'fw:' + set, pick, group: 'wall', make }));
    }
  }
  // (Ember's charred pines are a bare trunk and stubs, already fine at the lens: they stay as they are.)
  if (biome === 'alpine' || biome === 'blossom') out.push({ from: 'ob:pine', pick: 0, group: 'ob', make: () => nearPineGeometry(p, 'hazard', 0, biome === 'blossom' ? CEDAR : undefined, nb) });
  if (biome === 'blossom') out.push({ from: 'ob:blossom', pick: 0, group: 'ob', make: () => blossomGeometry(p, nb === 'fine' ? 'close' : 'rich') });
  return out;
}

export class NearForest {
  readonly root = new Object3D();
  private slots: Slot[] = [];
  private mats: ShaderMaterial[] = [];
  private look: { course: Course | null; palette: Palette | null; smoothFade: boolean; rich: boolean; nb: NearBuild } = { course: null, palette: null, smoothFade: false, rich: false, nb: 'fine' };
  /** A rebuild's number: idle work queued for an older one is dropped. */
  private gen = 0;
  private startAt = -1;
  private busy = false;
  /** Trees drawn near this frame (tests and the cost report). */
  drawn = 0;

  constructor() {
    this.root.name = 'near-forest';
  }

  /** Per frame, after the lens has moved: the near trees round `lens` (three.js space). `fine` is High and Ultra's
   *  build, else Medium's. */
  update(lens: Vector3, props: Props, fine: boolean): void {
    const l = props.forestLook;
    const nb: NearBuild = fine ? 'fine' : 'lean';
    const k = this.look;
    if (l.course !== k.course || l.palette !== k.palette || l.smoothFade !== k.smoothFade || l.rich !== k.rich || nb !== k.nb) this.rebuild(l.course, l.palette, l.smoothFade, l.rich, nb);
    if (!l.rich) return;
    if (this.startAt < 0) this.startAt = performance.now() + START_MS;
    this.pump();
    wind.uNearEye.value.copy(lens);
    this.gather(lens, props);
  }

  private rebuild(course: Course, palette: Palette, smoothFade: boolean, rich: boolean, nb: NearBuild): void {
    this.gen++;
    for (const s of this.slots) {
      if (!s.mesh) continue;
      this.root.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.dispose();
    }
    for (const m of this.mats) m.dispose();
    this.slots = [];
    this.mats = [];
    this.look = { course, palette, smoothFade, rich, nb };
    wind.uNearWall.value.copy(NEAR_OFF);
    wind.uNearOb.value.copy(NEAR_OFF);
    this.drawn = 0;
    if (!rich) return;
    const biome = course.biome;
    // The far forest's own foliage material (props.ts: the wall's and the run's trees share its options), made to draw a
    // tree only inside the band.
    const leafCool = biome === 'blossom' ? 0.2 : 0.38;
    const mat = (group: 'wall' | 'ob') => {
      const m = liveTree(makeToonMaterial({ sway: 0.12, coolShade: leafCool, nearFade: [1.8, 3.6], coverageFade: smoothFade, hazard: true }), true, group);
      this.mats.push(m);
      return m;
    };
    this.wallMat = mat('wall');
    this.obMat = mat('ob');
    for (const s of nearSlots(biome, palette, nb)) this.slots.push({ ...s, mesh: null });
  }

  private wallMat: ShaderMaterial | null = null;
  private obMat: ShaderMaterial | null = null;

  /** Makes the next near build on idle time, one a callback, and switches a group's hand-over on once every kind in it
   *  is made. */
  private pump(): void {
    if (this.busy || performance.now() < this.startAt) return;
    const next = this.slots.find((s) => !s.mesh);
    if (!next) return;
    this.busy = true;
    const gen = this.gen;
    const run = () => {
      this.busy = false;
      if (gen !== this.gen) return;
      const geo = next.make();
      const mesh = new InstancedMesh(geo, (next.group === 'wall' ? this.wallMat : this.obMat)!, CAP);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
      next.mesh = mesh;
      this.root.add(mesh);
      for (const g of ['wall', 'ob'] as const) {
        const all = this.slots.filter((s) => s.group === g);
        if (all.length > 0 && all.every((s) => s.mesh)) (g === 'wall' ? wind.uNearWall : wind.uNearOb).value.set(NEAR_IN, NEAR_OUT);
      }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1000 });
    else setTimeout(run, 30);
  }

  private gather(lens: Vector3, props: Props): void {
    const counts = this.slots.map(() => 0);
    const z = -lens.z;
    const r2 = GATHER * GATHER;
    for (let i = Math.floor((z - GATHER) / CHUNK_LEN); i <= Math.floor((z + GATHER) / CHUNK_LEN); i++) {
      const packed = props.packedAt(i);
      if (!packed) continue;
      for (let si = 0; si < this.slots.length; si++) {
        const s = this.slots[si];
        const mesh = s.mesh;
        if (!mesh) continue;
        const pk = packed.get(s.from);
        if (!pk) continue;
        const im = mesh.instanceMatrix.array as Float32Array;
        const ic = mesh.instanceColor!.array as Float32Array;
        for (let k = 0; k < pk.p.length; k++) {
          if (s.group === 'wall' && Math.round(pk.p[k]) !== s.pick) continue;
          const o = k * 16;
          const dx = pk.m[o + 12] - lens.x;
          const dy = pk.m[o + 13] - lens.y;
          const dz = pk.m[o + 14] - lens.z;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          const n = counts[si];
          if (n >= CAP) continue;
          im.set(pk.m.subarray(o, o + 16), n * 16);
          ic.set(pk.c.subarray(k * 3, k * 3 + 3), n * 3);
          counts[si] = n + 1;
        }
      }
    }
    let drawn = 0;
    this.slots.forEach((s, si) => {
      const mesh = s.mesh;
      if (!mesh) return;
      const n = counts[si];
      if (n > 0 || mesh.count > 0) {
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, Math.max(1, n) * 16);
        mesh.instanceMatrix.needsUpdate = true;
        const ic = mesh.instanceColor!;
        ic.clearUpdateRanges();
        ic.addUpdateRange(0, Math.max(1, n) * 3);
        ic.needsUpdate = true;
      }
      mesh.count = n;
      mesh.visible = n > 0;
      drawn += n;
    });
    this.drawn = drawn;
  }
}
