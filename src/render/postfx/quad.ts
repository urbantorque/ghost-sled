import { BufferAttribute, BufferGeometry, Mesh, OrthographicCamera, Scene, type ShaderMaterial, type WebGLRenderTarget, type WebGLRenderer } from 'three';

// One full-screen triangle for every pass of postfx/. Each pass is a ShaderMaterial drawn through it
// into its own target; nothing here clears or blends unless the material says so.

export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class Quad {
  private mesh: Mesh;
  private scene = new Scene();
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(private renderer: WebGLRenderer) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  draw(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.mesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  /** Compiles a pass's program now, so its first frame (a camera beat's first frame) does not stall. */
  compile(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.mesh.material = mat;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.compile(this.scene, this.cam);
    this.renderer.setRenderTarget(prev);
  }

  /** As compile(), without waiting on the driver where the browser compiles in parallel: settles once the
   *  program is linked. */
  compileAsync(mat: ShaderMaterial, target: WebGLRenderTarget | null): Promise<unknown> {
    this.mesh.material = mat;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    const done = this.renderer.compileAsync(this.scene, this.cam);
    this.renderer.setRenderTarget(prev);
    return done;
  }
}
