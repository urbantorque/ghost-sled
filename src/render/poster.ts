import { AddEquation, BufferAttribute, BufferGeometry, Color, CustomBlending, Mesh, OneFactor, ShaderMaterial, SrcAlphaFactor, Vector3, Vector4, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { posterFrame, shared } from './materials';
import { shaftPlace } from './postfx/shafts';

// Low's poster, drawn (the visual lift, poster lane; ART.md 15, "Tiers, designed": "shafts and glows as a few
// painted quads"). Low draws straight to the canvas, so it has no shafts pass and no composite to darken the
// frame's foot. In their place, one draw, on Low only:
//  - painted shafts: a fan of long soft cards from the sun's disc (and from the one bright place a frame
//    offers, postfx/shafts.ts pushShaftSource), laid in the air at a fixed depth, so the near slope, the
//    trees, the rider and anything else nearer than that stands in front of them and cuts them, and the
//    far ranges, the valley and the sky take them. Driven by the grade's `shafts` and the palette's
//    poster.shafts, as High's are by the grade; gone with a low clear sun (a high sun, a moon, a night).
//  - the frame: its foot laid over with the shade's colour (High's cool foot, which the composite draws),
//    and the corners a little, so the near snow under the rider holds a value and the eye is held on the
//    rider. Light against shade, painted.
// One mesh: the frame's quad and every card in one geometry, placed in the vertex shader from a few
// uniforms (no matrix work on the CPU but projecting one direction). Cards whose light is out collapse to
// nothing. Blended as dst * a + src: the cards add their light and keep a little of what is behind them
// (so bright snow under a shaft does not clip); the frame keeps 1 - a of the picture and lays the shade's
// colour in.

/** The sun's cards: angle off the fan's middle (radians), half-width at the far end (frame heights),
 *  length (frame heights), and brightness: a beam of light, or (negative) a beam of the air's cool shade
 *  between two of them, as a low sun throws through cloud and ridges (ART.md 12). Uneven on purpose: a
 *  painter's fan, not a comb. */
const SUN_CARDS: ReadonlyArray<[number, number, number, number]> = [
  [-0.8, 0.07, 1.05, 0.55],
  [-0.62, 0.09, 1.3, -0.6],
  [-0.46, 0.11, 1.45, 0.9],
  [-0.27, 0.06, 1.2, -0.75],
  [-0.12, 0.05, 1.25, 0.6],
  [0.02, 0.14, 1.7, 1.0],
  [0.2, 0.08, 1.4, -0.7],
  [0.36, 0.1, 1.55, 0.85],
  [0.54, 0.07, 1.25, -0.55],
  [0.72, 0.05, 1.1, 0.5],
];
/** The bright place's cards: shorter and closer together (a mouth or a gap throws a narrower fan). */
const PLACE_CARDS: ReadonlyArray<[number, number, number, number]> = [
  [-0.36, 0.06, 0.8, 0.7],
  [-0.22, 0.05, 0.85, -0.5],
  [-0.1, 0.09, 1.0, 1.0],
  [0.1, 0.05, 0.9, 0.75],
  [0.22, 0.05, 0.8, -0.5],
  [0.33, 0.08, 0.85, 0.85],
];

/** The layer the poster draws on: only the chase lens enables it. */
export const POSTER_LAYER = 5;
/** How far into the air the cards hang (metres from the lens): what stands nearer cuts them. A place's light
 *  (a cavern's mouth) falls in toward the lens through the air it lights, so its cards hang nearer, and
 *  never past the place itself. */
export const POSTER_CARD_DEPTH = 42;
export const POSTER_PLACE_DEPTH = 14;
/** A card's whole light at full strength (it is added over the picture), and a shade beam's share of it. */
const SHAFT_GAIN = 0.3;

/** The geometry: the frame's quad (group 0) first in the vertex list and last in the draw, so the foot lies
 *  over the light; then the sun's cards (group 1) and the place's (group 2). position: x along a card (0 at
 *  the light, 1 at its far end), y across it (-1 to 1), z the group; the frame's quad keeps its corners in
 *  x and y. Exported for the tests. */
export function posterGeometry(): BufferGeometry {
  const cards = [...SUN_CARDS.map((c) => [1, ...c]), ...PLACE_CARDS.map((c) => [2, ...c])];
  const n = 4 + cards.length * 4;
  const pos = new Float32Array(n * 3);
  const card = new Float32Array(n * 4);
  const idx: number[] = [];
  const frame = [-1, -1, 1, -1, 1, 1, -1, 1];
  for (let i = 0; i < 4; i++) pos.set([frame[i * 2], frame[i * 2 + 1], 0], i * 3);
  cards.forEach((c, k) => {
    const v0 = 4 + k * 4;
    const corners = [0, -1, 1, -1, 1, 1, 0, 1];
    for (let i = 0; i < 4; i++) {
      pos.set([corners[i * 2], corners[i * 2 + 1], c[0]], (v0 + i) * 3);
      card.set([c[1], c[2], c[3], c[4]], (v0 + i) * 4);
    }
    idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  });
  idx.push(0, 1, 2, 0, 2, 3);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aCard', new BufferAttribute(card, 4));
  g.setIndex(idx);
  return g;
}

/** How much of a sky direction's light reaches the frame as painted shafts: 1 with the disc inside the frame,
 *  falling to 0 by `margin` (NDC) past its edge, 0 behind the lens; and 0 as the disc climbs from 0.2 to
 *  0.32 (a high sun throws no shafts you can see, as on the other tiers). */
export function shaftReach(ndcX: number, ndcY: number, behind: boolean, dirY: number, margin = 0.55): number {
  if (behind) return 0;
  const off = Math.max(Math.abs(ndcX), Math.abs(ndcY)) - 1;
  const inFrame = 1 - Math.max(0, Math.min(1, off / margin));
  const climb = Math.max(0, Math.min(1, (dirY - 0.2) / 0.12));
  return inFrame * (1 - climb * climb * (3 - 2 * climb));
}

const probe = new Vector3();

export class PosterLayer {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;
  private low = false;
  /** Made part of the scene on idle time after Low's first frame, its program compiled off the frame (World
   *  hands it the renderer and the scene): nothing of it runs before the first frame, and the other tiers
   *  never compile it at all. */
  private stage: 'out' | 'waiting' | 'in' = 'out';
  host: { renderer: WebGLRenderer; scene: Scene } | null = null;

  constructor() {
    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: SrcAlphaFactor,
      uniforms: {
        uTime: shared.uTime,
        uSun: { value: new Vector4() },
        uPlace: { value: new Vector4() },
        uPlaceGap: { value: 4 },
        uSunLight: { value: new Color() },
        uPlaceLight: { value: new Color() },
        uFoot: { value: new Vector4() },
        uFrame: { value: new Vector4() },
        uSway: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aCard;
        uniform float uTime;
        uniform vec4 uSun;
        uniform vec4 uPlace;
        uniform float uPlaceGap;
        uniform float uSway;
        varying vec3 vP;
        varying float vK;
        void main() {
          vP = position;
          vK = 0.0;
          float g = position.z;
          if (g < 0.5) {
            // The frame: its corners, on the near plane (nothing stands in front of it).
            gl_Position = vec4(position.xy, -0.999, 1.0);
            return;
          }
          float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
          vec4 src;
          float depth = ${POSTER_CARD_DEPTH.toFixed(1)};
          if (g < 1.5) {
            src = projectionMatrix * vec4(mat3(viewMatrix) * uSun.xyz, 0.0);
            vK = uSun.w;
          } else {
            vec4 pv = viewMatrix * vec4(uPlace.xyz, 1.0);
            src = projectionMatrix * pv;
            vK = uPlace.w;
            // A place's light lies between the lens and the place, never past it.
            depth = clamp(-pv.z - uPlaceGap, 2.0, ${POSTER_PLACE_DEPTH.toFixed(1)});
          }
          if (vK <= 0.0 || src.w <= 0.0) {
            gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
            return;
          }
          // Frame heights from the middle (x across, y up), so a fan keeps its shape on any aspect.
          vec2 s = src.xy / src.w;
          s.x *= aspect;
          // The fan opens from the light toward the frame's lower middle, where the run goes, and turns very
          // slowly (held under reduced motion).
          vec2 aim = vec2(0.0, -0.5) - s;
          float ang = atan(aim.y, aim.x) + aCard.x + uSway * 0.035 * sin(uTime * 0.05 + aCard.w * 9.0);
          vec2 dir = vec2(cos(ang), sin(ang));
          vec2 side = vec2(-dir.y, dir.x);
          // A wedge: from just clear of the disc, narrow at the light and wide at its far end.
          float r = 0.06 + aCard.z * position.x;
          float hw = aCard.y * (0.12 + 0.88 * position.x);
          vec2 p = s + dir * r + side * hw * position.y;
          vec4 dc = projectionMatrix * vec4(0.0, 0.0, -depth, 1.0);
          gl_Position = vec4(p.x / aspect, p.y, dc.z / dc.w, 1.0);
          // Each card breathes a little on its own clock (a shade beam carries its sign through).
          vK *= aCard.w * (0.8 + 0.2 * uSway * sin(uTime * 0.21 + aCard.w * 13.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunLight;
        uniform vec3 uPlaceLight;
        uniform vec4 uFoot;
        uniform vec4 uFrame;
        varying vec3 vP;
        varying float vK;
        void main() {
          if (vP.z < 0.5) {
            // The frame. The foot: the lower frame laid over with the shade's colour, deepest at the edge,
            // gone by half way up (High's cool foot, which the composite draws on every other tier). The
            // corners: a little of the same, so the frame closes round the rider.
            float uy = vP.y * 0.5 + 0.5;
            float foot = 1.0 - smoothstep(0.0, 0.48, uy);
            float rr = length(vP.xy * vec2(uFrame.z, 1.0) * 0.5) / max(0.5 * length(vec2(uFrame.z, 1.0)), 0.001);
            float corner = smoothstep(0.55, 1.0, rr);
            float a = clamp(uFrame.x * foot * foot + uFrame.y * corner * corner, 0.0, 0.85);
            gl_FragColor = vec4(uFoot.rgb * a, 1.0 - a);
            return;
          }
          // A card: brightest a little out from the light, long and level, fading out toward its far end; soft
          // at its sides, flat across its middle (painted, not airbrushed).
          float along = smoothstep(0.0, 0.14, vP.x) * (1.0 - smoothstep(0.42, 1.0, vP.x));
          float across = 1.0 - smoothstep(0.42, 1.0, abs(vP.y));
          float a = along * across * abs(vK);
          if (vK < 0.0) {
            // A beam of shade: the picture a step down and a breath cooler, so the light beams beside it read
            // as light on any snow, bright or not.
            gl_FragColor = vec4(uFoot.rgb * a * 0.35, 1.0 - 0.7 * a);
            return;
          }
          vec3 light = vP.z < 1.5 ? uSunLight : uPlaceLight;
          gl_FragColor = vec4(light * a, 1.0 - 0.3 * a);
        }
      `,
    });
    this.mesh = new Mesh(posterGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    // Over the whole scene, after every see-through thing (the labels draw after the scene, over it).
    this.mesh.renderOrder = 9;
    // Only the chase lens draws it (World enables the layer on its camera): the avalanche mirror's inset,
    // the lake's bake and the sled shop's portraits never see the frame.
    this.mesh.layers.set(POSTER_LAYER);
    this.mesh.visible = false;
  }

  /** Low draws it; every other tier has the passes it stands in for. */
  setTier(low: boolean): void {
    this.low = low;
    if (!low) this.mesh.visible = false;
  }

  /**
   * Each frame on Low, after the world's systems have offered their bright place (shaftPlace) and the
   * camera has moved: aims the cards and sets the frame. `enclosed` is how far under a roof the run is (0 to 1,
   * the set pieces' light.shade). Allocates nothing.
   */
  update(camera: PerspectiveCamera, aspect: number, reduced: boolean, enclosed = 0): void {
    if (!this.low) return;
    if (this.stage !== 'in') {
      this.join(camera);
      return;
    }
    const f = posterFrame;
    const u = this.mat.uniforms;
    // The sun's fan.
    const d = shared.uDiskDir.value;
    probe.copy(d).transformDirection(camera.matrixWorldInverse);
    const behind = probe.z >= -0.02;
    let sunK = 0;
    if (f.shafts > 0.001 && !behind) {
      probe.copy(camera.position).add(d).project(camera);
      // (Under a roof (a gallery, the cavern, the Thousand Torii) the sun's own fan goes: laid over the floor at a
      // fixed depth it washed out the bars of light the roof's own gaps throw, the lane's critic.)
      sunK = f.shafts * shaftReach(probe.x, probe.y, false, d.y) * (1 - Math.max(0, Math.min(1, enclosed * 1.5)));
    }
    u.uSun.value.set(d.x, d.y, d.z, sunK * SHAFT_GAIN);
    (u.uSunLight.value as Color).copy(f.light);
    // The bright place, if one was offered this frame (inside the frame or just off it, in front of the lens).
    let placeK = 0;
    const p = shaftPlace;
    if (p.strength > 0.001) {
      probe.copy(p.pos).applyMatrix4(camera.matrixWorldInverse);
      if (probe.z < -1) {
        probe.copy(p.pos).project(camera);
        placeK = p.strength * f.place * shaftReach(probe.x, probe.y, false, 0, 0.4);
      }
    }
    u.uPlace.value.set(p.pos.x, p.pos.y, p.pos.z, placeK * SHAFT_GAIN);
    u.uPlaceGap.value = p.radius;
    (u.uPlaceLight.value as Color).copy(p.color).multiplyScalar(1 / Math.max(p.color.r, p.color.g, p.color.b, 0.001));
    u.uFoot.value.set(f.shade.r, f.shade.g, f.shade.b, 0);
    u.uFrame.value.set(f.foot, f.vignette, aspect, 0);
    u.uSway.value = reduced ? 0 : 1;
    this.mesh.visible = sunK > 0.001 || placeK > 0.001 || f.foot > 0.001 || f.vignette > 0.001;
  }

  private join(camera: PerspectiveCamera): void {
    const host = this.host;
    if (this.stage !== 'out' || !host) return;
    this.stage = 'waiting';
    const go = (): void => {
      const done = (): void => {
        host.scene.add(this.mesh);
        this.stage = 'in';
      };
      // (compileAsync asks the driver to build the program in parallel where it can, KHR_parallel_shader_compile.)
      host.renderer.compileAsync(this.mesh, camera, host.scene).then(done, done);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 400);
  }

  /** The draw this frame is making (for play-tests): the frame and any light. */
  get state(): { visible: boolean; sun: number; place: number } {
    const u = this.mat.uniforms;
    return { visible: this.mesh.visible && this.stage === 'in', sun: (u.uSun.value as Vector4).w, place: (u.uPlace.value as Vector4).w };
  }
}
