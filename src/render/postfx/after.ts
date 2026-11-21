import { AdditiveBlending, AlwaysStencilFunc, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, type Camera, type Material, type Object3D, type Scene, type WebGLRenderTarget, type WebGLRenderer } from 'three';

// What the temporal reconstruction cannot know (taa.ts), drawn after it over the rebuilt frame, at the
// frame's own size and with the lens back in its place: point sprites (powder, spray, sparks, weather,
// motes, the lantern world's lights) and glows that add light (a spirit light's glow and its motes in the
// air, fireworks, a ward's ring, the sky gates). None of them writes depth, so a reprojection from the depth
// behind them fetches their history from the wrong place: a spark trails or is clipped away, a glow smears.
// Drawn after, each is exactly where it is this frame, sharp, depth-tested against the world (the
// reconstruction's sharpen writes the scene's depth at the frame's size), and never kept in the history.
//
// Nothing is listed by hand. After each scene pass, the frame's transparent draws are read once (three.js's
// own render list: a few dozen items) and anything that matches drawsAfter() is moved to its own layer for
// good; the lens draws that layer in its own pass from then on, and every other lens (the avalanche's
// mirror, Low and Medium's single pass) draws both layers as before. So a system's new sprite is found on
// its first frame and drawn after the rebuild from its second.
//
// What stays in the scene: anything that writes depth or is lit by the scene's lights; every layer under the
// contract C10 stencil (the ghosts' glass, wisps, aura and shadow, the rider's echo, the chaos spirits: they
// must never cover the rider, which only the scene's stencil knows); blending that is not additive (ruts,
// decals, the painted mist), whose order among the scene's other transparent things matters; and anything
// under a root kept in the scene (the sky dome and the far ranges, which a lens of their own also draws: the
// lake's mirror bake).

/** The layer what draws after the rebuild is moved to (the scene's own is 0). */
export const AFTER_LAYER = 1;
/** Round 8 (image): the rider's layer, beside the scene's own. The rider is drawn in the scene (its depth and the
 *  stencil that keeps every ghost off it, contract C10, are the scene's) and again over the rebuilt frame, at the
 *  frame's size with the tier's MSAA: the rebuild's own rider underneath is never what is seen, so the hero is as
 *  crisp at speed as round 7's and nothing of its history can smear or halo it. */
export const HERO_LAYER = 2;
const SCENE_MASK = 1 << 0;
const AFTER_MASK = 1 << AFTER_LAYER;
const HERO_MASK = 1 << HERO_LAYER;

/** Whether a transparent draw of this object with this material is drawn after the reconstruction. */
export function drawsAfter(o: Object3D, m: Material): boolean {
  if (m.depthWrite || (m as Material & { lights?: boolean }).lights) return false;
  if (m.stencilWrite && m.stencilFunc !== AlwaysStencilFunc) return false;
  if ((o as Object3D & { isPoints?: boolean }).isPoints) return true;
  if (m.blending === AdditiveBlending) return true;
  // Custom: additive (one onto the frame), or premultiplied light over it (one, one minus alpha).
  if (m.blending === CustomBlending && m.blendDst === OneFactor) return true;
  if (m.blending === CustomBlending && m.blendSrc === OneFactor && m.blendDst === OneMinusSrcAlphaFactor) return true;
  return false;
}

interface ListItem {
  object: Object3D;
  material: Material;
}

export class AfterDraw {
  /** Roots whose objects always stay in the scene. */
  readonly kept: Object3D[] = [];
  /** How many objects have been moved, and which (a dev read). */
  moved = 0;
  readonly list: Object3D[] = [];

  /** Dev: false keeps everything in the scene (nothing new is moved). */
  enabled = true;

  /** After the scene pass: moves this frame's new candidates to the after layer. */
  scan(renderer: WebGLRenderer, scene: Scene): void {
    if (!this.enabled) return;
    const list = renderer.renderLists.get(scene, 0) as unknown as { transparent: ListItem[] };
    const items = list.transparent;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const o = it.object;
      // (Decided once an object: the answer is kept on it.)
      if (o.userData.taaAfter !== undefined) continue;
      const after = drawsAfter(o, it.material) && !this.underKept(o);
      o.userData.taaAfter = after;
      if (after) {
        o.layers.set(AFTER_LAYER);
        this.moved++;
        if (this.list.length < 64) this.list.push(o);
      }
    }
  }

  private underKept(o: Object3D): boolean {
    for (let p: Object3D | null = o; p; p = p.parent) if (this.kept.includes(p)) return true;
    return false;
  }

  /**
   * Round 8 (image): an opaque thing that moves on its own (a lift's chairs and gondolas) is drawn only after the
   * rebuild, as the sprites are: the history never holds it, so it cannot trail or double where it was (the
   * reprojection knows the lens's motion, not its own), and the history holds the world behind it. It is drawn
   * first in that pass (opaque before transparent), with the tier's MSAA, depth-tested against the world and
   * writing its own depth for the sprites after it. Nothing draws it twice: every other lens draws both layers.
   */
  adopt(o: Object3D): void {
    if (o.userData.taaAfter === true) return;
    o.userData.taaAfter = true;
    o.layers.set(AFTER_LAYER);
    this.moved++;
    if (this.list.length < 64) this.list.push(o);
  }

  /** Round 8 (image): the rider's opaque parts are drawn again over the rebuilt frame (HERO_LAYER). A part that
   *  blends is left to the scene (drawn twice it would be twice as strong), as is one already drawn after. */
  hero(root: Object3D): void {
    root.traverse((o) => {
      const m = (o as Object3D & { material?: Material | Material[] }).material;
      if (!m || Array.isArray(m) || m.transparent || o.userData.taaAfter === true) return;
      o.layers.enable(HERO_LAYER);
    });
  }

  /** The lens draws the scene's own layer only (the scene pass under the reconstruction). */
  sceneOnly(camera: Camera): void {
    camera.layers.mask = SCENE_MASK;
  }

  /** Every layer (any other pass, and every lens that is not the reconstruction's). */
  all(camera: Camera): void {
    camera.layers.mask = SCENE_MASK | AFTER_MASK | HERO_MASK;
  }

  /**
   * Draws the after layer over `target` (the rebuilt frame, with the scene's depth), with the lens as it
   * stands, and with `hero` the rider again (opaque, so first). Nothing is cleared, the scene's matrices are
   * this frame's already, and no shadow is drawn.
   */
  draw(renderer: WebGLRenderer, scene: Scene, camera: Camera, target: WebGLRenderTarget, hero = false): void {
    const autoClear = renderer.autoClear;
    const autoShadow = renderer.shadowMap.autoUpdate;
    const autoMatrix = scene.matrixWorldAutoUpdate;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    scene.matrixWorldAutoUpdate = false;
    camera.layers.mask = AFTER_MASK | (hero ? HERO_MASK : 0);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    camera.layers.mask = SCENE_MASK | AFTER_MASK | HERO_MASK;
    scene.matrixWorldAutoUpdate = autoMatrix;
    renderer.shadowMap.autoUpdate = autoShadow;
    renderer.autoClear = autoClear;
  }
}
