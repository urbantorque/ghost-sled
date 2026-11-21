import { AdditiveBlending, AlwaysStencilFunc, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Euler, Group, InstancedBufferAttribute, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, ReplaceStencilOp, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { FLOW_HEX } from '../game/beats';
import { type HatId, type ScarfDef, SCARVES } from '../game/garage';
import { Course } from '../sim/course';
import { reduced } from '../ui/motion';
import { inRock, visualGround } from './ground';
import { ghostStencil, makeToonMaterial, shared, type ToonOptions } from './materials';
import { type TrickIn, emptyTrickPose, trickPose } from './trickpose';
import { ARM_ELBOW, ARM_REST_BEND, ARM_WRIST, RIDER_COLORS, RIDER_HALF_WIDTH, RIDER_HEIGHT, RIDER_NECK, RIDER_SCALE, RIDER_SHOULDER, SCARF_KNOT, type RiderDetail, type SledSeat, ghostRiderGeometry, paintSled, riderArmGeometry, riderHeadGeometry, riderTorsoGeometry, sledGeometryFor, sledSeat, withSway } from './meshes';

// The player's rider: sled + body + arms with procedural poses and a verlet scarf. The scarf's
// wrap and knot are part of the body mesh; its two tails are simulated here and stream from the
// knot. All motion here is presentation only; the sim never reads it.

export interface RiderPose {
  /** three.js world position of the sled base. */
  pos: Vector3;
  heading: number;
  airYaw: number;
  airPitch: number;
  /** Ground normal in three.js space (for tilting on slopes). */
  normal: Vector3;
  lean: number;
  crouch: number;
  drifting: boolean;
  driftDir: number;
  airborne: boolean;
  speed: number;
  wobble: number;
  /** World velocity (three.js space) for the scarf and crash tumble. */
  vel: Vector3;
  perfectPulse: number;
  /** What the rider is acting out (moments.ts); absent reads as just riding. */
  act?: RiderAct;
  /** The held drift's charge, 0 to 1 (Feel.driftCharge): the drift's lean deepens with it. */
  driftCharge?: number;
  /** Round 8: what the sim says the rider is doing in the air (trickpose.ts reads the turn rates itself). */
  trick?: { move: number; grab: number; tier: number; tweak: number; danger: number };
}

/** A reaction the rider plays once: a look and a lean at a ghost going by ('look'); a glance at one it
 *  goes by ('glance'), with a fist for a pass worth one ('pump') or both arms ('cheer', a set piece
 *  swept too); a flinch from something it only just missed ('flinch'); the shoulders dropped over a set
 *  piece lost ('slump'); and the head shaken and the snow brushed off after a tumble ('dust'). */
export type RiderCue = 'look' | 'glance' | 'pump' | 'cheer' | 'flinch' | 'slump' | 'dust';

/** The moments that take over the rider's pose. */
export interface RiderAct {
  /** A wipeout: 0 riding, else 0 to 1 through it, from the hit to back on the line. */
  tumble: number;
  /** How long the wipeout lasts in all (seconds; the sim's own length). From WIPE_MIN_S up the rider
   *  plays the whole fall (thrown off, a slide on its back beside the sled, a sit-up, a scramble back
   *  on); a shorter one is the old roll of the whole rig. Absent reads as short. */
  tumbleS?: number;
  /** Where the fall's phases change, as shares of it: the end of the tumble and slide, and the end of
   *  lying in the snow (the sim's FALL_TICKS and DOWN_TICKS over TUMBLE_TICKS). Absent: 0.4 and 0.7. */
  tumbleCuts?: readonly [number, number];
  /** On a rail. */
  grind: boolean;
  /** Riding the wall: + the bank on three.js +x, - on -x, 0 none. */
  wall: number;
  /** Over the line, arms up. */
  finish: boolean;
  /** Real seconds since the line, and the place it finished in (1 first, 0 not known). */
  finT?: number;
  rank?: number;
  /** Loading for a lip ahead with the action held, 0 to 1. */
  load?: number;
  /** The latest reaction and a count that moves with each new one (each is played once), and the side
   *  it happened on (+1 three.js +x). */
  cue?: RiderCue | null;
  cueN?: number;
  cueSide?: number;
  /** How hard the reaction is played, 0 to 1 (a whisker flinches harder than a near miss); absent: 1. */
  cueK?: number;
}

/** A wipeout this long or longer (seconds) is played as the whole fall and get-up. */
export const WIPE_MIN_S = 1.3;

/** A frame of the finish celebration: how far it stands (0 to 1) and rises, its torso's and head's
 *  turn, how far it leans back in its seat, the round sled's spin, the seconds since the line, the
 *  place it is played for (first, the podium, or any finish), whether its sled has a deck to stand on,
 *  and how far the celebration has taken over from the arms-up V. */
interface Celebration {
  stand: number;
  lift: number;
  yaw: number;
  look: number;
  lean: number;
  sledSpin: number;
  t: number;
  champ: boolean;
  podium: boolean;
  deck: boolean;
  k: number;
}

/** How long each reaction plays (s). */
const CUE_S: Record<RiderCue, number> = { look: 1.35, glance: 0.85, pump: 1.1, cheer: 1.3, flinch: 0.55, slump: 1.6, dust: 1.55 };

/** The deck a standing rider's boots come down on, by sled (metres over the sled's base); the round
 *  sleds have none to stand on (their rider spins instead). */
const STAND_DECK: Record<number, number> = { 0: 0.23, 2: 0.11, 3: 0.3, 4: 0.225 };

/** 0 to 1 through a beat: in over `a` seconds, held to `b`, out by `c`. */
function env(t: number, a: number, b: number, c: number): number {
  if (t <= 0 || t >= c) return 0;
  return t < a ? smooth(t / a) : t < b ? 1 : 1 - smooth((t - b) / (c - b));
}

const UP = new Vector3(0, 1, 0);
// Scarf tails: verlet chains of TAIL_N points, drawn as smoothed ribbons of TAIL_ROWS rows. One
// tail is longer than the other, like a real scarf knotted off centre. Short segments let the cloth
// curve and ripple along its length: with five long links each tail read as a stiff flat plank.
const TAIL_N = 9;
const TAIL_ROWS = (TAIL_N - 1) * 2 + 1;
const TAIL_SEG = [0.165 * RIDER_SCALE, 0.135 * RIDER_SCALE];
/** Ribbon width at its fullest; pinched where it leaves the knot, then tapering to a narrow tip (a
 *  tip as wide as the middle read as a paddle). */
const TAIL_W = 0.27 * RIDER_SCALE;
function tailWidth(u: number): number {
  const s = Math.min(1, u / 0.18);
  return TAIL_W * (0.5 + 0.5 * s * s * (3 - 2 * s)) * (1 - 0.7 * Math.pow(u, 1.4));
}
/** Height of the rider's middle above the sled base: flips turn about it, as a real rider's do.
 *  Turning about the runners swung a flipping rider's head a full body length below the sled and
 *  toward the chase camera, out of the bottom of the frame. */
const FLIP_PIVOT = 0.5;
/** The temporal reconstruction's boxes round the rider's rigid parts (postfx/taa.ts), in each part's own
 *  frame (model units, before RIDER_SCALE): the riding rig in its lean group (the sled under it, the body
 *  and the head over it, a sled's length either way, its foot just clear of the snow), and the wreck's body
 *  and sled while they tumble. */
const MOTION_RIDE: [Vector3, Vector3] = [new Vector3(0, 0.76, 0), new Vector3(0.66, 0.7, 1.15)];
const MOTION_BODY: [Vector3, Vector3] = [new Vector3(0, 0.6, 0), new Vector3(0.7, 0.85, 0.7)];
const MOTION_SLED: [Vector3, Vector3] = [new Vector3(0, 0.2, 0), new Vector3(0.7, 0.4, 1.15)];
const motionInv = new Matrix4();
const motionP = new Vector3();
const motionLo = new Vector3();
const motionHi = new Vector3();
const motionC = new Vector3();
const motionH = new Vector3();
/** Steepest climb of a tail segment above level: sin and cos of 30 degrees. */
const SCARF_MAX_RISE = 0.5;
const SCARF_MAX_RUN = Math.sqrt(3) / 2;
/** The head and beanie as the camera sees them (neck space): the tails keep out of the cone it
 *  sweeps toward the lens, so the scarf never covers the head, however the rider is posed. */
const HEAD_VIEW = new Vector3(0, 0.97 - RIDER_NECK.y, 0);
const HEAD_VIEW_R = 0.37 * RIDER_SCALE;
/** Spheres the tails slide around instead of passing through the rider: the torso (body-pivot
 *  space), the head with its ear flaps (neck space) and the hood on the back (body-pivot space again;
 *  the radii are the drawn rider's, RIDER_SCALE included). */
const COLLIDERS: Array<[Vector3, number]> = [
  [new Vector3(0, 0.34, 0.02), 0.27 * RIDER_SCALE],
  [new Vector3(0, 0.86 - RIDER_NECK.y, 0), 0.3 * RIDER_SCALE],
  [new Vector3(0, 0.46, 0.2), 0.17 * RIDER_SCALE],
];
/** A tumble's turns of the whole rig (a whole number, so it ends upright) and how high it bounces. */
const TUMBLE_TURNS = 2;
const TUMBLE_BOUNCE = 0.85;
/** How far a rail turns the sled off the line, for the slide. */
const GRIND_YAW = 0.42;
/** Torso roll off vertical, at most (radians): about 35 degrees. */
const MAX_ROLL = 0.61;
/** A dash's after-images: frames of the rig's pose kept, and each image's lag (render seconds) and strength. */
const ECHO_HIST = 40;
const ECHO_LAGS: readonly (readonly [number, number])[] = [
  [0.03, 0.34],
  [0.065, 0.18],
];
/** A scarf's tassels: strands at each tip, and how long they hang. */
const TASSELS = 4;
const TASSEL_L = 0.11 * RIDER_SCALE;
const CREAM_KNIT = new Color('#F3E6D4');
const INK_KNIT = new Color('#1A2140');

/** The after-image's glass: a white-gold fresnel edge with a breath of light inside, added over the scene. */
function echoMaterial(): ShaderMaterial {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color('#FFE29A') } },
    vertexShader: /* glsl */ `
      attribute float aEcho;
      varying float vA;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        // An image near the lens would fill the frame with glass: it fades out inside about 3.5 m.
        vA = aEcho * smoothstep(2.2, 3.6, distance(wp.xyz, cameraPosition));
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        gl_FragColor = vec4(linearToOutputTexel(vec4(uColor * (pow(f, 1.6) * 1.1 + 0.2) * vA, 1.0)).rgb, 1.0);
      }
    `,
  });
  ghostStencil(m);
  return m;
}

/** Results only: dazed stars orbiting the beanie (neck space), and how many. */
const STAR_Y = 0.5;
const STAR_R = 0.32;
const STARS = 3;

/** Contract C10: the rider writes 1 into the stencil wherever it is drawn, and every ghost layer
 *  draws only where the stencil is not 1, so no ghost ever covers or tints the rider's own pixels. */
function riderStencil(m: Material): void {
  m.stencilWrite = true;
  m.stencilFunc = AlwaysStencilFunc;
  m.stencilRef = 1;
  m.stencilZPass = ReplaceStencilOp;
}

/** A flat five-pointed star in the xy plane (the dazed stars face the lens). */
function starGeometry(): BufferGeometry {
  const pos: number[] = [];
  const pt = (k: number) => {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 === 0 ? 0.07 : 0.03;
    return [Math.cos(a) * r, Math.sin(a) * r, 0];
  };
  for (let k = 0; k < 10; k++) pos.push(0, 0, 0, ...pt(k), ...pt(k + 1));
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

/** Results hero shot: where the overturned sled comes to rest beside the seated wreck, in the
 *  hero camera's frame (metres to the right of the rider on screen, and away from the lens; `side`
 *  -1 when it lies on the rider's left instead, downhill on a steep bank). The camera frames the
 *  pair between them, so both read and neither is cut by the frame edge. It lies just past the boots
 *  and a little beyond them: nearer, the outstretched legs lay across it and the two halves of the
 *  wreck merged into one heap. */
export const WRECK_SLED = { right: 0.9 * RIDER_SCALE, away: 0.72 * RIDER_SCALE, side: 1 };

const smooth = (x: number) => {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * (3 - 2 * k);
};

interface Tail {
  pts: Vector3[];
  prev: Vector3[];
  seg: number;
  /** Which side of the knot the tail leaves (+1 right, -1 left); it also sets the ribbon's twist. */
  sign: number;
  /** How far the tail flares out sideways at speed (push per m/s of speed, + toward the right). */
  flare: number;
  phase: number;
}

/** Uniforms every rider material shares by reference. */
interface RiderUniforms {
  /** The perfect landing's white rim, 1 easing to 0. */
  flash: { value: number };
  /** The results hero shot's lens-side fill, 0 to 1. */
  fill: { value: number };
  /** How warm a dusk the sky is (Comet Night): the ember rim on the coat, 0 to 1. */
  ember: { value: number };
  /** Earned flow (x, 0 to 1) and the 'In the flow' rim pulse (y, 0 to 1). Declared when the materials
   *  are made, so the first flow frame never recompiles anything. */
  flow: { value: Vector2 };
  /** The pom-pom's bounce (metres, roughly head space) and the coat hem's flutter (0 to 1). */
  pom: { value: Vector3 };
  hem: { value: number };
  /** Standing up on the sled (0 seated to 1 standing): the legs out in front swing down. */
  stand: { value: number };
  /** A dash (round 6): x how much of the spirit shimmer shows (0 to 1, eased), y the rider's base height in
   *  the world (the glow bands rise from it), z how fast the bands rise (slower under reduced motion). */
  spirit: { value: Vector3 };
  /** What hangs off the rider and arrives late (round 7): the offset of the soft parts (the hood, a
   *  hat's tail, the boots' toes), metres in the body's own frame. */
  soft: { value: Vector3 };
  /** The hero's own light (round 7): x the soft key's floor, y the rim from the frame's light, z how
   *  firmly the vermillion holds its value and hue. 1 each; the results' fill and a tier may trim them. */
  hero: { value: Vector3 };
  /** Round 8 (the events lane): light running up the rider. x the band's height over the rider's base (m), y its
   *  strength (0 to 1), z its half-height (m), w its colour (0 the snow's white for a perfect landing, 1 the
   *  spirit's white-gold for a dash's ignition). */
  rise: { value: Vector4 };
}

/** Secondary motion in the vertex shader (presentation only, no extra draw): vertices weighted by
 *  meshes.ts's aSway take the pom-pom's spring offset (x), the coat hem's flutter (y) and the soft
 *  parts' lag (z); an arm's forearm bends about its elbow and its mitt flops about its wrist (w, by
 *  the arm's own uJoint: x the elbow's bend, y the wrist's nod, z its sideways flop, radians). The hem
 *  flares a little and ripples round its rim, more at the back, so at speed the coat reads as cloth
 *  in the wind rather than a moulded shell. */
function addSway(m: ShaderMaterial, u: RiderUniforms, joint?: { value: Vector3 }): void {
  m.uniforms.uPom = u.pom;
  m.uniforms.uHem = u.hem;
  m.uniforms.uStand = u.stand;
  m.uniforms.uSoft = u.soft;
  m.uniforms.uJoint = joint ?? { value: new Vector3() };
  const at = '#include <begin_vertex>';
  if (!m.vertexShader.includes(at)) {
    console.warn('rider material: vertex anchor not found, secondary motion disabled');
    return;
  }
  m.vertexShader =
    'attribute vec4 aSway;\nuniform vec3 uPom;\nuniform float uHem;\nuniform float uStand;\nuniform vec3 uSoft;\nuniform vec3 uJoint;\n' +
    m.vertexShader.replace(
      at,
      /* glsl */ `${at}
        transformed += max(aSway.x, 0.0) * uPom + aSway.z * uSoft;
        // An arm's joints: the mitt turns about the wrist, then the forearm and the mitt about the elbow.
        if (aSway.w > 0.5) {
          vec3 jq = transformed;
          vec3 jn = objectNormal;
          if (aSway.w > 1.5) {
            vec3 wr = vec3(${ARM_WRIST.x.toFixed(3)}, ${ARM_WRIST.y.toFixed(3)}, ${ARM_WRIST.z.toFixed(3)});
            float sw = sin(uJoint.y);
            float cw = cos(uJoint.y);
            float sz = sin(uJoint.z);
            float cz = cos(uJoint.z);
            jq -= wr;
            jq.yz = vec2(jq.y * cw - jq.z * sw, jq.y * sw + jq.z * cw);
            jn.yz = vec2(jn.y * cw - jn.z * sw, jn.y * sw + jn.z * cw);
            jq.xy = vec2(jq.x * cz - jq.y * sz, jq.x * sz + jq.y * cz);
            jn.xy = vec2(jn.x * cz - jn.y * sz, jn.x * sz + jn.y * cz);
            jq += wr;
          }
          vec3 el = vec3(${ARM_ELBOW.x.toFixed(3)}, ${ARM_ELBOW.y.toFixed(3)}, ${ARM_ELBOW.z.toFixed(3)});
          float se = sin(uJoint.x);
          float ce = cos(uJoint.x);
          jq -= el;
          jq.yz = vec2(jq.y * ce - jq.z * se, jq.y * se + jq.z * ce);
          jn.yz = vec2(jn.y * ce - jn.z * se, jn.y * se + jn.z * ce);
          transformed = jq + el;
          objectNormal = jn;
        }
        // Standing up on the sled: the legs out in front swing down about the hips (a quarter turn);
        // the feet, turned up from the shins, come down flat on the deck.
        if (aSway.x < -0.5 && uStand > 0.0) {
          float sa = sin(-1.5708 * uStand);
          float ca = cos(-1.5708 * uStand);
          vec3 hipP = vec3(0.0, 0.05, -0.02);
          vec3 q = transformed - hipP;
          vec3 nq = objectNormal;
          q.yz = vec2(q.y * ca - q.z * sa, q.y * sa + q.z * ca);
          nq.yz = vec2(nq.y * ca - nq.z * sa, nq.y * sa + nq.z * ca);
          transformed = q + hipP;
          objectNormal = nq;
        }
        if (aSway.y > 0.0) {
          float hemA = atan(transformed.x, transformed.z);
          float rip = 0.6 * sin(hemA * 5.0 - uTime * 17.0) + 0.4 * sin(hemA * 3.0 + uTime * 11.0);
          float back = 0.45 + 0.55 * smoothstep(-0.15, 0.2, transformed.z);
          float hk = aSway.y * uHem * back;
          transformed.xz *= 1.0 + hk * (0.06 + 0.045 * rip);
          transformed.z += hk * 0.035 * (0.6 + 0.4 * rip);
          transformed.y += hk * 0.018 * rip;
          // The hem has weight too: it swings out late on a carve and drops on a landing (uSoft).
          transformed.x += aSway.y * uSoft.x * 0.9;
          transformed.y += aSway.y * min(uSoft.y, 0.0) * 0.5;
        }`,
    );
}

/** A sled carries what its underside is (riderMaterial) in aSway.w: -1 the classic sled's five slats, -2 Low's three,
 *  -3 the toboggan's three broad ones, -4 a flat deck over runners (the Wisp), -5 a round or shelled hull (the
 *  saucer, the tray), whose whole underside is the hull. (Round 8: Comet Bob is slatted as the classic sled is.) */
function markSled(g: BufferGeometry, id: number, lite: boolean): BufferGeometry {
  const a = g.getAttribute('aSway') as BufferAttribute | undefined;
  if (!a || a.itemSize !== 4) return g;
  const code = id === 2 ? -3 : id === 4 ? -4 : id === 1 || id === 5 ? -5 : lite ? -2 : -1;
  for (let i = 0; i < a.count; i++) a.setW(i, code);
  a.needsUpdate = true;
  return g;
}

/** Flow's colour is the player's own vermillion: no gold and no groove tint (decision 69). */
const FLOW_C = new Color(FLOW_HEX);

/** The shared toon material plus the rider-only terms: dark cloth keeps its ink navy in shade (the
 *  snow's periwinkle shade tint lifted the coat to a mauve-grey stump from behind, and under Comet
 *  Night to pink-grey), with a cool bounce off the snow on every shaded facet; a warm rim on the sun
 *  side of the silhouette, so the navy coat lifts off shaded snow; a thin, cooled rim in the horizon
 *  colour all round it, so a backlit rider never collapses into a flat dark block yet never washes
 *  out either, raised on the coat's shoulders and back where the sky catches them, so from behind the
 *  rider separates from a dark saucer and the snow; an ember rim under a warm dusk sky (Comet Night);
 *  a fill from the lens side in the results hero shot, which also holds the rims down there (backlit,
 *  the wreck read milky); a thin white rim flash on a perfect landing; and, for the double-sided
 *  scarf, back faces that flip their normal and sit a shade darker so every twist of the ribbon reads. */
function riderMaterial(opts: ToonOptions, u: RiderUniforms, sunRim: number, horizonRim: number, sway = false, joint?: { value: Vector3 }): ShaderMaterial {
  // Props dissolve within about 3 m of the lens; the chase camera now rides closer than that on a
  // hard landing, which screen-doored the whole rider. The rider only gives way to a lens inside it.
  // (hero: on Low the rider takes the poster's widest painted rim, materials.ts POSTER_GLSL; the visual lift's poster lane.)
  const m = makeToonMaterial({ nearFade: [0.25, 0.45], hero: true, ...opts });
  riderStencil(m);
  if (sway) {
    addSway(m, u, joint);
    // The sled's own frame, for its underside (below): its vertices carry what that underside is in aSway.w
    // (markSled), every other part 0 or an arm's joint. vSledI: x 1 on a sled, y its slats' pitch (0 for none), z
    // where its slats start across it, w the lowest underside that is hull (under it, the runners).
    const sledAt = [
      'float sledC = -aSway.w;',
      'vSledI = sledC < 0.5 ? vec4(0.0) : vec4(1.0, sledC < 1.5 ? 0.12 : sledC < 2.5 ? 0.2 : sledC < 3.5 ? 0.21 : 0.0, sledC > 2.5 && sledC < 3.5 ? -0.315 : -0.3, sledC > 2.5 && sledC < 3.5 ? 0.03 : sledC > 4.5 ? -10.0 : 0.1);',
      'vSledP = position;',
      'vSledN = normal;',
    ].join('\n        ');
    if (m.vertexShader.includes('attribute vec4 aSway;')) m.vertexShader = 'varying vec4 vSledI;\nvarying vec3 vSledP;\nvarying vec3 vSledN;\n' + m.vertexShader.replace('void main() {', 'void main() {\n        ' + sledAt);
  }
  const under = m.vertexShader.includes('vSledI = ');
  m.uniforms.uFlash = u.flash;
  m.uniforms.uFill = u.fill;
  m.uniforms.uEmber = u.ember;
  m.uniforms.uFlow = u.flow;
  m.uniforms.uFlowC = { value: FLOW_C };
  m.uniforms.uSunRim = { value: sunRim };
  m.uniforms.uHorizonRim = { value: horizonRim };
  m.uniforms.uSpirit = u.spirit;
  m.uniforms.uHero = u.hero;
  m.uniforms.uRise = u.rise;
  // The toon shader dissolves whatever sits on the sight line from the camera to the rider. The
  // rider itself must never dissolve (least of all the scarf, which streams back toward the
  // camera), so its own focus sits far overhead: that sight line runs straight up, clear of it.
  m.uniforms.uFocus = { value: new Vector3(0, 1e6, 0) };
  const before = m.fragmentShader;
  let fs = before.replace('uniform float uRimK;', 'uniform float uRimK;\n      uniform float uFlash;\n      uniform float uFill;\n      uniform float uEmber;\n      uniform vec2 uFlow;\n      uniform vec3 uFlowC;\n      uniform float uSunRim;\n      uniform float uHorizonRim;\n      uniform vec3 uSnowLit;\n      uniform vec3 uSpirit;\n      uniform vec3 uHero;\n      uniform vec4 uRise;');
  fs = fs.replace(
    'vec3 n = normalize(vNormalW);',
    `vec3 n = normalize(vNormalW);
        #ifdef DOUBLE_SIDED
          n = gl_FrontFacing ? n : -n;
        #endif`,
  );
  // The local lights (lamps, gates, the lantern's moments) on the rider roll off past a lamp's strength, so a
  // moment's flash of light right by the rider lights it without washing its pale parts (the sled's wood, the
  // fur, the beanie's stripe) to cream (round 7, the shared lane; a lamp's ordinary light is under the knee).
  const localAt = 'col += (base * 0.9 + 0.05) * L;';
  if (fs.includes(localAt)) fs = fs.replace(localAt, 'col += (base * 0.9 + 0.05) * L / (1.0 + 0.8 * max(L - 0.35, 0.0));');
  const shadeAt = 'vec3 col = toonLightK(litBase, shade, n, v, shadow, uRimK);';
  fs = fs.replace(
    shadeAt,
    /* glsl */ `// Ink cloth keeps its own deep hue in shade instead of taking the snow's shade tint, and takes
        // only a quarter of the toon fresnel: leaning over a saucer or squashed on a landing, the
        // coat's back turns to a grazing angle and the full rim washed it to a grey-white wedge.
        float inkK = 1.0 - smoothstep(0.06, 0.3, dot(base, vec3(0.2126, 0.7152, 0.0722)));
        shade = mix(shade, base * 0.66 + uShadeTint * 0.02, inkK);
        vec3 col = toonLightK(litBase, shade, n, v, shadow, uRimK * (1.0 - 0.75 * inkK));
        // A lighter sun-side panel on dark cloth (its second tone in the light): the facets turned
        // to the sun lift a step, so the torso is never one flat navy block.
        col += base * uSunColor * 0.45 * inkK * smoothstep(0.05, 0.55, dot(n, uSunDir)) * mix(0.3, 1.0, shadow);`,
  );
  const rim = /* glsl */ `
        float riderEdge = 1.0 - clamp(dot(n, v), 0.0, 1.0);
        float sunSide = smoothstep(-0.1, 0.45, dot(n, uSunDir));
        // Strongest on dark cloth (the navy coat, whose silhouette must lift off shaded snow) and on
        // upright faces; pale sleds and decks seen from a low camera would only wash out.
        float darkCloth = 1.0 - smoothstep(0.08, 0.5, dot(base, vec3(0.2126, 0.7152, 0.0722)));
        float upright = 1.0 - smoothstep(0.5, 0.9, n.y);
        // A cool bounce off the snow lifts facets turned away from the sky (the face under the
        // beanie, the coat's flanks), so the head never reads as a dark hole against bright snow.
        col += base * mix(uSnowLit, uShadeTint, 0.5) * 0.3 * clamp(0.45 - n.y, 0.0, 1.0);
        // The results hero shot is backlit: a soft fill from the lens side brings the vermillion and
        // the navy back to full saturation, and every rim below is held down (on the head they
        // bloomed it to peach-white).
        col += base * vec3(1.0, 0.94, 0.88) * (0.3 + 0.7 * clamp(dot(n, v), 0.0, 1.0)) * 0.6 * uFill;
        float rimCut = 1.0 - 0.75 * uFill;
        // Warm and kept to the outer facets: a wide, near-white band ran down the coat's sides and
        // read as pale legs (or neon piping) rather than low sun on cloth.
        col += uSunColor * vec3(1.0, 0.72, 0.58) * smoothstep(0.5, 0.94, riderEdge) * sunSide * darkCloth * upright * uSunRim * mix(0.6, 1.0, shadow) * rimCut;
        // ART.md section 2: a fresnel rim in the horizon colour on the whole silhouette, lit or
        // shaded, and strongest looking into the low sun, where the backlit coat otherwise reads as
        // one near-black block. On dark cloth it is cooled and capped: at full strength the warm
        // horizon (peach by day, ember under the comet) washed the navy coat to mauve-grey.
        float backlit = smoothstep(-0.3, 0.65, -dot(v, uSunDir));
        float rimL = dot(uRim, vec3(0.2126, 0.7152, 0.0722));
        vec3 rimC = mix(uRim, vec3(0.62, 0.74, 1.15) * rimL, 0.6 * darkCloth);
        // Dark cloth turned up to the sky: the coat's back in a saucer lean or a landing squash. It
        // holds ink navy, its rims kept to the outermost silhouette facets (a grazing back is all
        // edge, and rimmed it read as a grey tombstone from the chase camera).
        float skyBack = darkCloth * smoothstep(0.2, 0.7, n.y);
        // A thin line on the silhouette facets only, faint on the vermillion and the pale wood so
        // the beanie and the runners keep their colour.
        col += rimC * smoothstep(mix(0.64, 0.8, darkCloth), 0.97, riderEdge) * mix(0.45, 1.0, backlit) * mix(0.3, 0.6, darkCloth) * (1.0 - 0.8 * skyBack) * uHorizonRim * rimCut;
        // The yoke's shoulders catch a breath of sky where they turn away from the lens, so from
        // behind a navy rider over a dark saucer still separates. (Across the whole back it washed
        // the navy to lavender, then to grey.)
        col += rimC * 0.1 * darkCloth * smoothstep(0.35, 0.9, n.y) * smoothstep(0.55, 0.85, riderEdge) * uHorizonRim * rimCut;
        // Under a warm dusk sky (Comet Night) the ember horizon behind the lens rims the coat's back
        // and shoulders, so the hero sits in the dusk light rather than reading as a cold cut-out.
        col += vec3(1.0, 0.42, 0.16) * uEmber * darkCloth * (0.6 * smoothstep(0.45, 0.95, riderEdge) + 0.04 + 0.1 * smoothstep(0.3, 0.9, n.y) * smoothstep(0.25, 0.7, riderEdge)) * rimCut;
        // Lit like a hero (round 7, ART.md 15 rule 4). Everything here is the rider's own and reads only
        // the shared light's direction and colours, so it holds whatever the shared model above becomes.
        //   A soft key from over the lens's shoulder, leaning toward the frame's light: a floor under
        //   every surface in its own colour, so the coat's face reads in a polar night and under a smoke
        //   deck. It takes the light's hue but not its level: a dim light still keys the hero.
        vec3 heroN = uSunColor / max(max(uSunColor.r, uSunColor.g), max(uSunColor.b, 0.001));
        vec3 heroKeyDir = normalize(v + vec3(0.0, 0.55, 0.0) + uSunDir * 0.45);
        float heroKey = smoothstep(-0.25, 0.85, dot(n, heroKeyDir));
        vec3 heroFloor = base * mix(vec3(1.0), heroN, 0.3) * (0.2 + 0.3 * heroKey) * uHero.x;
        // (Ink cloth takes a little more, and a cool lift with it: navy at a fifth of its value is black.)
        heroFloor += (base * 0.16 + vec3(0.012, 0.018, 0.04)) * heroKey * darkCloth * uHero.x;
        col = max(col, heroFloor);
        //   A rim from the frame's key light: the silhouette's edge on the light's side burns in the
        //   light's own colour, brighter as the frame gets darker, so the hero is cut out of a dark
        //   frame by the same light that lights it.
        float heroSide = smoothstep(-0.35, 0.5, dot(n, uSunDir));
        vec3 heroRimC = mix(uRim, heroN, 0.55) * mix(1.0, 0.5, uDayK);
        col += heroRimC * pow(riderEdge, 2.6) * heroSide * mix(0.4, 0.95, darkCloth) * uHero.y * rimCut;
        //   The vermillion holds: a saturated warm surface never sinks under a third of its own value
        //   nor climbs past it into pink or white, and keeps its hue under any light (a blue night turned
        //   it plum, a white noon bleached the beanie's sunlit side).
        float heroHi = max(base.r, 0.001);
        float heroWarm = smoothstep(0.5, 0.8, (base.r - max(base.g, base.b)) / heroHi) * uHero.z;
        float heroL = dot(col, vec3(0.2126, 0.7152, 0.0722)) / max(dot(base, vec3(0.2126, 0.7152, 0.0722)), 0.001);
        col = mix(col, base * clamp(heroL, 0.36, 1.12), heroWarm * 0.85);
        #ifdef DOUBLE_SIDED
          if (!gl_FrontFacing) col *= 0.8;
        #endif
        ${
          under
            ? `if (vSledI.x > 0.5) {
          // A sled's underside (round 7, the shared lane): seen from below in a flip it was one flat slab. What
          // faces down in the sled's own frame sits a step into shade with the snow's cool bounce in it, grained
          // along its length and darker toward its edges; a slatted sled's slats are split by dark seams.
          float underK = smoothstep(-0.3, -0.75, normalize(vSledN).y) * step(vSledI.w, vSledP.y);
          if (underK > 0.001) {
            float pitch = max(vSledI.y, 0.01);
            float slat = fract((vSledP.x - vSledI.z) / pitch);
            float seam = (1.0 - smoothstep(0.004, 0.012, min(slat, 1.0 - slat) * pitch)) * step(0.05, vSledI.y);
            float grainU = 0.5 + 0.5 * sin(vSledP.x * 210.0 + sin(vSledP.z * 9.0) * 2.2);
            float edgeU = smoothstep(0.17, 0.32, abs(vSledP.x));
            vec3 underC = col * (0.62 + 0.1 * grainU) * (1.0 - 0.55 * seam) * (1.0 - 0.3 * edgeU) + base * mix(uSnowLit, uShadeTint, 0.5) * 0.14;
            col = mix(col, underC, underK);
          }
        }`
            : ''
        }
        // The flash is a thin rim on the upright silhouette facets, so the stomp pops while the rider
        // keeps its colour: over the whole body it read as bleached, and across a pale saucer's face,
        // seen edge-on from the low camera, as the sled blown out to white.
        col = mix(col, vec3(1.5), uFlash * 0.9 * smoothstep(0.74, 0.96, riderEdge) * upright);
        // Round 8 (the events lane): a band of light runs up the rider from the runners to the hat, a perfect
        // landing's in the snow's white and a dash's ignition in the spirit's white-gold. It burns on the
        // silhouette's edge and only breathes over the dark cloth inside it, so the navy and the vermillion hold
        // as it passes (at a fifth over the whole body the dash's ignition bleached the rider to peach).
        if (uRise.y > 0.001) {
          float rb = (vWorldPos.y - uSpirit.y - uRise.x) / uRise.z;
          float rk = exp(-rb * rb * 1.6) * uRise.y;
          vec3 riseC = mix(vec3(1.35, 1.32, 1.25), vec3(1.4, 1.12, 0.62), uRise.w);
          col += riseC * rk * (0.05 * darkCloth + 1.1 * smoothstep(0.55, 0.95, riderEdge)) * rimCut;
        }
        // Earned flow burns in the player's own vermillion: a rim on the silhouette facets that thickens
        // and brightens as it builds (a warm edge at 0.3, a clear rim at 0.6, a hot one at full flow,
        // eased in so the first steps already show; the 'In the flow' pulse to full strength, past the
        // bloom threshold on Medium and High) and a brighter scarf, which goes HDR and blooms. On Low it
        // reads as saturated colour. Never gold and never a tint on the snow (decision 69). The results
        // fill holds it down.
        // (Round 7, the shared lane: the rim keeps to the silhouette's outer facets and the coat keeps its navy
        // inside it. Grown in from a third of the way across at 1.7, a full flow turned the whole coat red and the
        // pulse bloomed the rider into one vermillion blob, its silhouette lost.)
        float flowE = pow(uFlow.x, 0.7);
        #ifdef DOUBLE_SIDED
          col *= 1.0 + (0.7 * flowE + 0.35 * uFlow.y) * rimCut;
        #else
          float flowK = 0.55 * flowE + 0.8 * uFlow.y;
          col += uFlowC * smoothstep(mix(0.72, 0.58, uFlow.x), 0.96, riderEdge) * flowK * 1.45 * rimCut;
        #endif
        // A dash (round 6): the rider as a spirit for its 1.4 s. The body goes pale and luminous, a white-gold
        // rim burns round the whole silhouette, and bands of light ripple up through the coat and the scarf
        // from the sled. Past the bloom threshold on Medium and High; on Low the rim and bands read as
        // white-gold on their own. Eased in and out (uSpirit.x), never a flash.
        if (uSpirit.x > 0.001) {
          float sk = uSpirit.x;
          float sh = vWorldPos.y - uSpirit.y;
          float wob = 0.035 * sin(vWorldPos.x * 11.0 + uTime * 6.0 * uSpirit.z) + 0.035 * sin(vWorldPos.z * 9.0 - uTime * 5.0 * uSpirit.z);
          float ph = fract((sh + wob) * 2.4 - uTime * 1.6 * uSpirit.z);
          float band = smoothstep(0.0, 0.14, ph) * (1.0 - smoothstep(0.14, 0.36, ph));
          // (Linear light: a pale white-gold for the rim, a deeper gold for the bands, so the bands still
          // read over the rim's glow and over the snow behind.)
          vec3 spiritC = vec3(1.0, 0.86, 0.5);
          vec3 bandC = vec3(1.0, 0.74, 0.34);
          #ifdef DOUBLE_SIDED
            // The scarf keeps the player's vermillion (ART.md section 1): only a breath of the rim.
            col += spiritC * smoothstep(0.5, 0.95, riderEdge) * 0.5 * sk * rimCut;
          #else
            // (Round 7, the shared lane: the rim on the silhouette's edge only and the bands over the coat's own
            // value, so the rider stays a navy and vermillion figure in a white-gold outline. A rim from a third
            // of the way in at 1.5 and the body lifted toward white-gold bleached it to a cream blob in every
            // dash frame of the review.)
            col = mix(col, col * 0.85 + spiritC * 0.06, 0.25 * sk);
            col += (spiritC * smoothstep(0.56, 0.95, riderEdge) * 1.45 + bandC * band * 0.85 * mix(0.4, 1.0, darkCloth)) * sk * rimCut;
          #endif
        }
        `;
  // (Three places it may go, in order: the shared model is the light lane's to change.)
  const anchor = ['col = lanternLight(col, base, vWorldPos, n);', 'col = fogged(col, vWorldPos);', 'gl_FragColor = vec4(col, keep);'].find((a) => fs.includes(a)) ?? 'gl_FragColor';
  fs = fs.replace(anchor, rim + anchor);
  if (fs === before || !fs.includes('inkK')) console.warn('rider material: toon shader anchors not found, rider shading partly disabled');
  if (under) fs = 'varying vec4 vSledI;\nvarying vec3 vSledP;\nvarying vec3 vSledN;\n' + fs;
  m.fragmentShader = fs;
  return m;
}

export class Rider {
  readonly root = new Group();
  private tilt = new Group();
  private yaw = new Group();
  private flip = new Group();
  /** Inside the flip: the carve lean, which still tips the rig over its runners. */
  private leanG = new Group();
  private sled: Mesh;
  private bodyPivot = new Group();
  private body: Mesh;
  /** The head turns on the neck: held toward upright while the torso leans, and kept at its own
   *  size through a squash. */
  private neck = new Group();
  /** How far the neck rises above its modelled height (on a saucer the leaning torso sank the head
   *  into the shoulders). */
  private headLift = 0.03;
  private armL = new Group();
  private armR = new Group();
  private knot = new Object3D();
  private tails: Tail[] = [];
  private tailGeo: BufferGeometry;
  private scarf: Mesh;
  private rows: Vector3[] = [];
  private anchor = new Vector3();
  private anchorPrev = new Vector3();
  private fromAnchor = new Vector3();
  private stepAnchor = new Vector3();
  private travel = new Vector3();
  private side = new Vector3();
  private colliders: Array<[Vector3, number]> = COLLIDERS.map(([c, r]) => [c.clone(), r]);
  private headC = new Vector3();
  /** The sight line from the camera to the head (unit), its length (0: no camera) and the level
   *  direction across it; plus which way across it the tails flare. */
  private sightU = new Vector3();
  private sightS = new Vector3();
  private sightL = 0;
  private sightSide = 1;
  private planeN = new Vector3(0, 1, 0);
  private planeP = new Vector3();
  private usePlane = false;
  private hPrev = 1 / 60;
  private vA = new Vector3();
  private vB = new Vector3();
  private vC = new Vector3();
  private vD = new Vector3();
  private tmpQ = new Quaternion();
  /** The camera: the scarf ribbons turn their faces partly toward it so they never read edge-on. */
  eye: Object3D | null = null;
  /** Which side the tails flare to (+1 right, -1 left): away from a camera off to one side, where a
   *  tail streaming toward the lens would cover the rider's back in red. */
  private flareSide = 1;
  private crash: {
    t: number;
    bodyPos: Vector3;
    bodyVel: Vector3;
    sledPos: Vector3;
    sledVel: Vector3;
    spin: Vector3;
    sledSpin: Vector3;
    /** 0 while tumbling, rising to 1 as the wreck sits up for the results hero shot. */
    rest: number;
    restFrom: Quaternion;
    restY: number;
    /** Where the sled was, and how it lay, when the wreck began to settle. */
    sledFrom: Vector3;
    sledQFrom: Quaternion;
    /** How far the settling wreck slides out from under the trees (x, z), and how much of it is done. */
    clearX: number;
    clearZ: number;
    clearK: number;
  } | null = null;
  /** Whether a prop stands within `r` metres of a three.js (x, z): a wreck in the trees slides out
   *  from under the canopy as it settles. */
  blocked: ((x: number, z: number, r: number) => boolean) | null = null;
  private crashBody = new Group();
  private crashNeck = new Group();
  private crashSled = new Group();
  private crashArmL = new Group();
  private crashArmR = new Group();
  /** Results only: gold-white stars circling the dazed wreck's beanie (world space, facing the lens). */
  private stars = new Group();
  private starT = 0;
  private restQ = new Quaternion();
  private restE = new Euler(0, 0, 0, 'YXZ');
  /** Results hero shot: the compass direction the camera looks along (null: no hero shot). Once the
   *  tumble is over the wreck sits up in the snow, dazed, turned to show its profile to the lens. */
  restView: number | null = null;
  private readonly u: RiderUniforms = { flash: { value: 0 }, fill: { value: 0 }, ember: { value: 0 }, flow: { value: new Vector2() }, pom: { value: new Vector3() }, hem: { value: 0 }, stand: { value: 0 }, spirit: { value: new Vector3(0, 0, 1) }, soft: { value: new Vector3() }, hero: { value: new Vector3(1, 1, 1) }, rise: { value: new Vector4(0, 0, 0.3, 0) } };
  /** Each arm's joints (left, right): x the elbow's bend, y the wrist's nod, z its sideways flop. */
  private readonly joints = [{ value: new Vector3(ARM_REST_BEND, 0, 0) }, { value: new Vector3(ARM_REST_BEND, 0, 0) }];
  /** Low's cheaper build (setDetail). */
  private lite = false;
  private armMats: ShaderMaterial[] = [];
  /** The head on the neck and the tumbling wreck's head (both rebuilt for a hat from the garage). */
  private head: Mesh;
  private crashHead: Mesh;
  private hat: HatId = 'beanie';
  /** The scarf from the garage (garage.ts): its tails' length, width, knit pattern and tassels. */
  private scarfLook: ScarfDef = SCARVES[0];
  /** A dash's after-images: two faint white-gold silhouettes of the seated rider a few hundredths of a
   *  second behind it (one instanced draw, only while it dashes, never on Low), drawn only where the
   *  rider is not (contract C10's stencil, as a ghost is). */
  private echo: InstancedMesh;
  private echoA: InstancedBufferAttribute;
  private echoHist: Matrix4[] = Array.from({ length: ECHO_HIST }, () => new Matrix4());
  private echoT = new Float64Array(ECHO_HIST);
  private echoHead = 0;
  private echoN = 0;
  private echoSeat = 0;
  private echoOn = false;
  /** The reaction playing (rider cue), its seconds and side, and the last cue count seen (NaN until
   *  the first frame of a run, which only takes the count: a cue from before is never played). */
  private react: RiderCue | null = null;
  private reactT = 0;
  private reactSide = 1;
  private cueSeen = NaN;
  /** Eased weights: loading for a lip, the drift's lean. */
  private loadK = 0;
  private driftK = 0;
  /** The finish wave's arm (+1 the right), picked toward the lens as the wave begins (0 not yet). */
  private waveSide = 0;
  /** The pom-pom's spring: offset (m) and velocity (m/s), up/down and side to side; and last frame's
   *  vertical speed and lean, whose changes kick it. */
  private pomY = 0;
  private pomVY = 0;
  private pomX = 0;
  private pomVX = 0;
  private lastVy = 0;
  private lastLean = 0;
  private mat: ShaderMaterial;
  /** Seconds since the last perfect landing (drives the squash, the crouch and the rim flash). */
  private landT = 9;
  /** The body's own secondary motion (tickBody): the carve lean it is carried into on a spring (it
   *  lags the sled's bank and settles a touch past it), the height it soaks a bump or a landing up by
   *  (metres, negative compressed) and its rate, and the speed tuck (0 to 1). */
  private leanS = 0;
  private leanV = 0;
  private bobY = 0;
  private bobV = 0;
  private bodyVy = 0;
  private tuckK = 0;
  private chatY = 0;
  /** Take-off and touchdown (round 7), read off the pose itself: whether it was in the air last frame
   *  and how fast it was falling; the pop's seconds and strength (the release that extends), and the
   *  touchdown's seconds, strength and length (the compression that recovers, longer for a harder hit). */
  private wasAir = false;
  private airVy = 0;
  private popT = 9;
  private popK = 0;
  private touchT = 9;
  private touchK = 0;
  private touchS = 0.3;
  /** What hangs off the rider (the hood, a hat's tail, the boots' toes): a soft spring in the body's
   *  frame, kicked by every change of speed, bank and height, so it arrives late and settles. */
  private softP = new Vector3();
  private softV = new Vector3();
  private softVy = 0;
  private softLean = 0;
  private lastSpeed = 0;
  /** Each arm's elbow bend this frame (left, right), last frame's arm angles, and each wrist's eased
   *  lag (nod, flop). */
  private bends = new Float32Array([ARM_REST_BEND, ARM_REST_BEND]);
  private armPrev = new Float32Array(4);
  private wrists = new Float32Array(4);
  /** The eased weights of a rail, a wall ride (signed) and the arms-up finish. */
  private grindK = 0;
  private wallS = 0;
  private finK = 0;
  /** The upper body's eased turn toward the direction of travel while the sled slides sideways. */
  private twist = 0;
  /** How the rider sits the current sled, and the two body meshes it can wear. */
  private seat: SledSeat = sledSeat(0);
  private sitGeo: BufferGeometry;
  private crossGeo: BufferGeometry | null = null;
  private sledRestQ = new Quaternion();
  private sledRestE = new Euler(0, 0, 0, 'YXZ');
  private sledSpot = new Vector3();
  private slopeG = { x: 0, z: 0 };
  /** The snow plane under a settling wreck (its normal and a point on it). */
  private restN = new Vector3(0, 1, 0);
  private restP = new Vector3();
  /** The scarf of a wreck sitting up for the results: its tails spread out across the snow. */
  private settled = false;
  /** Round 8: the trick's pose (trickpose.ts), the last one held while it eases out, its eased weight, last
   *  frame's turn in the air (for the rates), and the turn a Spinning Top's rider sits still against. */
  private readonly tpIn: TrickIn = { move: 0, grab: 0, tier: 0, tweak: 0, spin: 0, flip: 0, danger: 0, time: 0, calm: false };
  private readonly tpNew = emptyTrickPose();
  private readonly tp = emptyTrickPose();
  private tpK = 0;
  private tpYaw = NaN;
  private tpPitch = NaN;
  private tpYaw0 = 0;
  /** The pose the trick weight is on now (for play-tests: window.__gs). */
  get trickName(): string {
    return this.tpK > 0.05 ? this.tp.name : '';
  }

  constructor() {
    const mat = riderMaterial({ coolShade: 0.5, rim: 0.4 }, this.u, 0.7, 0.75, true);
    this.mat = mat;
    // Each arm bends at its own elbow: the same shader, its own joint angles.
    this.armMats = this.joints.map((j) => riderMaterial({ coolShade: 0.5, rim: 0.4 }, this.u, 0.7, 0.75, true, j));
    this.sled = new Mesh(markSled(withSway(sledGeometryFor(0)), 0, false), mat);
    this.sitGeo = riderTorsoGeometry();
    this.body = new Mesh(this.sitGeo, mat);
    const headGeo = riderHeadGeometry().translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z);
    const head = new Mesh(headGeo, mat);
    this.head = head;
    this.neck.position.copy(RIDER_NECK);
    this.neck.add(head);
    const armGeo = riderArmGeometry({ bend: 0 });
    this.armL.add(new Mesh(armGeo, this.armMats[0]));
    this.armR.add(new Mesh(armGeo, this.armMats[1]));
    this.armL.position.set(-RIDER_SHOULDER.x, RIDER_SHOULDER.y, RIDER_SHOULDER.z);
    this.armR.position.copy(RIDER_SHOULDER);
    // The whole rig is drawn RIDER_SCALE times its modelled size, about the sled's base on the snow.
    this.root.scale.setScalar(RIDER_SCALE);
    this.bodyPivot.position.set(0, 0.24, 0.1);
    // The turn toward the travel comes first, so the crouch and the lean follow the turned torso.
    this.bodyPivot.rotation.order = 'YXZ';
    this.knot.position.copy(SCARF_KNOT);
    this.bodyPivot.add(this.body, this.neck, this.armL, this.armR, this.knot);
    this.leanG.add(this.sled, this.bodyPivot);
    this.leanG.position.y = -FLIP_PIVOT;
    this.flip.position.y = FLIP_PIVOT;
    this.flip.add(this.leanG);
    this.yaw.add(this.flip);
    this.tilt.add(this.yaw);
    this.root.add(this.tilt);
    for (const m of [this.sled, this.body, head, ...this.armL.children, ...this.armR.children] as Mesh[]) {
      m.castShadow = true;
    }

    // Scarf tails: two ribbons in one dynamic mesh.
    for (let k = 0; k < 2; k++) {
      const t: Tail = { pts: [], prev: [], seg: TAIL_SEG[k], sign: k === 0 ? 1 : -1, flare: k === 0 ? 2.3 : 1.15, phase: k * 2.3 };
      for (let i = 0; i < TAIL_N; i++) {
        t.pts.push(new Vector3());
        t.prev.push(new Vector3());
      }
      this.tails.push(t);
    }
    for (let r = 0; r < TAIL_ROWS; r++) this.rows.push(new Vector3());
    // Two ribbons of TAIL_ROWS rows, then each tail's tassels (three vertices a strand, collapsed to a
    // point when the scarf has none).
    const verts = 2 * TAIL_ROWS * 2 + 2 * TASSELS * 3;
    this.tailGeo = new BufferGeometry();
    const col = new Float32Array(verts * 3);
    const idx: number[] = [];
    for (let k = 0; k < 2; k++) {
      for (let r = 0; r < TAIL_ROWS - 1; r++) {
        const a = (k * TAIL_ROWS + r) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    for (let i = 2 * TAIL_ROWS * 2; i < verts; i += 3) idx.push(i, i + 1, i + 2);
    this.tailGeo.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage));
    this.tailGeo.setAttribute('normal', new BufferAttribute(new Float32Array(verts * 3), 3).setUsage(DynamicDrawUsage));
    this.tailGeo.setAttribute('color', new BufferAttribute(col, 3));
    this.tailGeo.setIndex(idx);
    this.paintScarf();
    // A ribbon is all edge when seen at a grazing angle, so a fresnel rim would wash the whole face
    // out: the scarf keeps only a trace of it and stays saturated vermillion.
    this.scarf = new Mesh(this.tailGeo, riderMaterial({ coolShade: 0.35, doubleSided: true, rim: 0.15 }, this.u, 0.12, 0));
    this.scarf.frustumCulled = false;
    this.scarf.castShadow = true;

    // The tumbling body keeps its arms (flung out, then propping it up once it sits) and its head
    // (tilted, dazed, once it sits).
    this.crashArmL.add(new Mesh(armGeo, this.armMats[0]));
    this.crashArmR.add(new Mesh(armGeo, this.armMats[1]));
    this.crashBody.scale.setScalar(RIDER_SCALE);
    this.crashSled.scale.setScalar(RIDER_SCALE);
    this.crashArmL.position.copy(this.armL.position);
    this.crashArmR.position.copy(this.armR.position);
    const crashHead = new Mesh(headGeo, mat);
    this.crashHead = crashHead;
    this.crashNeck.position.copy(RIDER_NECK);
    // The dazed head turns first, then nods and lolls about its turned axes.
    this.crashNeck.rotation.order = 'YXZ';
    this.crashNeck.add(crashHead);
    this.crashBody.add(new Mesh(this.body.geometry, mat), this.crashNeck, this.crashArmL, this.crashArmR);
    this.crashSled.add(new Mesh(this.sled.geometry, mat));
    for (const m of [this.crashBody.children[0], crashHead, this.crashArmL.children[0], this.crashArmR.children[0], this.crashSled.children[0]] as Mesh[]) m.castShadow = true;
    this.crashBody.visible = false;
    this.crashSled.visible = false;
    // Gold-white, bright enough to catch the bloom: the wreck is seeing stars. Each sits on a slightly
    // larger ink star just behind it, a thin outline that keeps it on bright snow.
    const starMat = new MeshBasicMaterial({ color: new Color('#FFE9A6').multiplyScalar(1.7), side: DoubleSide });
    const inkMat = new MeshBasicMaterial({ color: new Color('#121933'), side: DoubleSide });
    riderStencil(starMat);
    riderStencil(inkMat);
    const starGeo = starGeometry();
    for (let i = 0; i < STARS; i++) {
      const s = new Group();
      const ink = new Mesh(starGeo, inkMat);
      ink.scale.setScalar(1.32);
      ink.position.z = -0.006;
      s.add(ink, new Mesh(starGeo, starMat));
      this.stars.add(s);
    }
    this.stars.visible = false;

    this.echoA = new InstancedBufferAttribute(new Float32Array(ECHO_LAGS.length), 1).setUsage(DynamicDrawUsage);
    // The after-images' body is made on idle time after the first frame (or by the first dash, if one comes
    // sooner: tickEcho), not here: a whole ghost rider's build that the first frame never draws.
    this.echo = new InstancedMesh(new BufferGeometry(), echoMaterial(), ECHO_LAGS.length);
    this.echoSeat = -1;
    this.echo.count = 0;
    this.echo.visible = false;
    this.echo.frustumCulled = false;
    const idle = (fn: () => void): void => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 4000 });
      else setTimeout(fn, 1500);
    };
    idle(() => this.makeEcho());
  }

  /** The garage's hat (garage.ts): the head and the wreck's head are rebuilt wearing it. */
  setHat(id: HatId): void {
    if (id === this.hat) return;
    this.hat = id;
    this.buildHead();
  }

  private buildHead(): void {
    const geo = riderHeadGeometry(false, this.hat, this.lite).translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z);
    this.head.geometry.dispose();
    this.head.geometry = geo;
    this.crashHead.geometry = geo;
  }

  /** The seated rider as drawn (metres): sled base to the top of the pom-pom, and half its width at
   *  rest. The playtest probes read them. */
  readonly height = RIDER_HEIGHT;
  readonly halfWidth = RIDER_HALF_WIDTH;

  /** Which build the hero wears: the whole figure, or Low's (about a third of the triangles: fewer
   *  sides to every round part and none of the trim only a close lens resolves). The pose, the scarf
   *  and the shading are the same on every tier. */
  setDetail(detail: RiderDetail): void {
    const lite = detail === 'lite';
    if (lite === this.lite) return;
    this.lite = lite;
    this.buildHead();
    this.sitGeo.dispose();
    this.crossGeo?.dispose();
    this.sitGeo = riderTorsoGeometry(false, false, lite);
    this.crossGeo = null;
    this.body.geometry = this.seat.crossLegged ? (this.crossGeo = riderTorsoGeometry(true, false, lite)) : this.sitGeo;
    (this.crashBody.children[0] as Mesh).geometry = this.body.geometry;
    const armGeo = riderArmGeometry({ bend: 0, lite });
    const arms = [this.armL.children[0], this.armR.children[0], this.crashArmL.children[0], this.crashArmR.children[0]] as Mesh[];
    arms[0].geometry.dispose();
    for (const m of arms) m.geometry = armGeo;
    const id = this.sledId;
    this.sledId = -1;
    this.setSled(id);
  }

  /** The garage's scarf: its tails' length and width, its knit and its tassels. The wrap round the neck
   *  stays the classic vermillion knot. */
  setScarf(def: ScarfDef): void {
    if (def === this.scarfLook) return;
    this.scarfLook = def;
    for (let k = 0; k < this.tails.length; k++) this.tails[k].seg = TAIL_SEG[k] * def.length;
    this.paintScarf();
  }

  /** The scarf's knit in its vertex colours: vermillion, a touch deeper at the knot where the cloth bunches,
   *  and the scarf's own pattern down each tail (the classic's two deeper stripes near the tip make the
   *  flutter easy to read). Its accent, if any, is cream or ink, never a third colour. */
  private paintScarf(): void {
    const col = this.tailGeo.getAttribute('color') as BufferAttribute;
    const def = this.scarfLook;
    const R = TAIL_ROWS;
    const V = RIDER_COLORS.accent;
    const A = def.accent === 'cream' ? CREAM_KNIT : def.accent === 'ink' ? INK_KNIT : V;
    const c = new Color();
    for (let i = 0; i < 2 * R * 2; i++) {
      const r = Math.floor(i / 2) % R;
      let k = r < 3 ? 0.86 : 1;
      let accent = false;
      switch (def.pattern) {
        case 'tipStripes':
          if (r === R - 6 || r === R - 3) k = 0.7;
          break;
        case 'bars':
          accent = r === R - 7 || r === R - 6 || r === R - 4 || r === R - 3;
          break;
        case 'tip':
          accent = r >= R - 3;
          if (r === R - 4) k = 0.8;
          break;
        case 'bands':
          accent = r >= 4 && r % 4 === 0;
          break;
        case 'rib':
          k = r % 2 === 0 ? 0.8 : 1;
          break;
        case 'plain':
          break;
      }
      c.copy(accent ? A : V).multiplyScalar(accent ? 1 : k);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    // Tassels in the accent if it is cream, else a deeper vermillion.
    const t = def.accent === 'cream' ? CREAM_KNIT : c.copy(V).multiplyScalar(0.82);
    for (let i = 2 * R * 2; i < col.count; i++) col.setXYZ(i, t.r, t.g, t.b);
    col.needsUpdate = true;
  }

  /** A dash's spirit shimmer, eased (0 to 1): uniforms on every rider material, plus the after-images
   *  when `echoes` (Medium and High). `calm` (reduced motion) slows the bands' rise. */
  setSpirit(k: number, echoes: boolean, calm: boolean): void {
    const s = this.u.spirit.value;
    // (Round 8: the first frame of a dash ignites the rider: tickFlash runs the light up it.)
    if (s.x === 0 && k > 0) this.igniteT = 0;
    s.x = Math.max(0, Math.min(1, k));
    s.z = calm ? 0.35 : 1;
    this.echoOn = echoes && !this.crash;
  }

  /** The after-images' body, seated as this sled seats the rider (made again only when the seat changes). */
  private makeEcho(): void {
    if (this.echoSeat === this.sledId || this.sledId < 0) return;
    this.echoSeat = this.sledId;
    const g = ghostRiderGeometry(false, sledSeat(this.sledId));
    g.setAttribute('aEcho', this.echoA);
    this.echo.geometry.dispose();
    this.echo.geometry = g;
  }

  /** Keeps the rig's pose for the after-images and places them, a few hundredths of a second behind. */
  private tickEcho(time: number): void {
    const k = this.u.spirit.value.x;
    if (k <= 0.02 || !this.echoOn) {
      this.echo.visible = false;
      this.echoN = 0;
      return;
    }
    this.makeEcho();
    this.echoHead = (this.echoHead + 1) % ECHO_HIST;
    this.echoHist[this.echoHead].copy(this.leanG.matrixWorld);
    this.echoT[this.echoHead] = time;
    this.echoN = Math.min(ECHO_HIST, this.echoN + 1);
    const a = this.echoA.array as Float32Array;
    let n = 0;
    for (const [lag, strength] of ECHO_LAGS) {
      for (let j = 0; j < this.echoN; j++) {
        const i = (this.echoHead - j + ECHO_HIST) % ECHO_HIST;
        if (time - this.echoT[i] < lag) continue;
        this.echo.setMatrixAt(n, this.echoHist[i]);
        a[n] = strength * k;
        n++;
        break;
      }
    }
    this.echo.count = n;
    this.echo.visible = n > 0;
    this.echo.instanceMatrix.needsUpdate = true;
    this.echoA.needsUpdate = true;
  }

  private sledId = 0;

  /** Swap the sled model (unlocks show up on the slope, not just in a menu), and the way the rider
   *  sits it: on a saucer or a tray it sits cross-legged and leans over the rim. A wreck thrown
   *  clear of its sled always sits in the snow with its legs out. */
  /** The sled's paint (game/paints.ts): '' is its natural finish. Applied on the next setSled. */
  private paintHex = '';

  setPaint(hex: string): void {
    if (hex === this.paintHex) return;
    this.paintHex = hex;
    const id = this.sledId;
    this.sledId = -1;
    this.setSled(id);
  }

  setSled(id: number): void {
    if (id === this.sledId) return;
    this.sledId = id;
    const geo = markSled(withSway(paintSled(sledGeometryFor(id, this.lite), this.paintHex)), id, this.lite);
    this.sled.geometry.dispose();
    this.sled.geometry = geo;
    (this.crashSled.children[0] as Mesh).geometry = geo;
    this.seat = sledSeat(id);
    this.body.geometry = this.seat.crossLegged ? (this.crossGeo ??= riderTorsoGeometry(true, false, this.lite)) : this.sitGeo;
    (this.crashBody.children[0] as Mesh).geometry = this.body.geometry;
    this.bodyPivot.position.set(0, this.seat.y, this.seat.z);
    // Leaning over a saucer's rim the head sank behind the shoulders: from behind the rider read as
    // a navy obelisk with no head. There the neck rises about 0.15 m.
    this.headLift = this.seat.crossLegged ? 0.15 : 0.03;
  }

  /** Objects to add to the scene (scarf and crash parts live in world space). */
  get objects(): Object3D[] {
    return [this.root, this.scarf, this.crashBody, this.crashSled, this.stars, this.echo];
  }

  /**
   * The rider's rigid parts this frame, for the temporal reconstruction's own motion (postfx/taa.ts): the
   * riding rig's lean group (the sled and the body sit in it) while it rides, the wreck's body and sled while
   * they tumble; each with an id of its own (0 to 2) and its box in its own frame.
   */
  motionParts(cb: (id: number, frame: Object3D, center: Vector3, half: Vector3) => void): void {
    if (this.root.visible) {
      this.leanG.updateWorldMatrix(true, false);
      cb(0, this.leanG, MOTION_RIDE[0], MOTION_RIDE[1]);
      // The scarf streams in world space, out past the rig's box: a box of its own round its points this
      // frame (in the lean group's frame), carried by the rig's motion.
      if (this.scarf.visible) {
        const pos = this.tailGeo.getAttribute('position');
        motionInv.copy(this.leanG.matrixWorld).invert();
        motionLo.set(Infinity, Infinity, Infinity);
        motionHi.set(-Infinity, -Infinity, -Infinity);
        for (let i = 0; i < pos.count; i++) {
          motionP.fromBufferAttribute(pos, i).applyMatrix4(this.scarf.matrixWorld).applyMatrix4(motionInv);
          motionLo.min(motionP);
          motionHi.max(motionP);
        }
        if (pos.count > 0) {
          motionC.addVectors(motionLo, motionHi).multiplyScalar(0.5);
          motionH.subVectors(motionHi, motionLo).multiplyScalar(0.5).addScalar(0.06);
          cb(3, this.leanG, motionC, motionH);
        }
      }
    }
    if (this.crashBody.visible) cb(1, this.crashBody, MOTION_BODY[0], MOTION_BODY[1]);
    if (this.crashSled.visible) cb(2, this.crashSled, MOTION_SLED[0], MOTION_SLED[1]);
  }

  /** Show or hide the rider; the world-space scarf follows (it also stays with a tumbling body). */
  setVisible(v: boolean): void {
    this.root.visible = v && !this.crash;
    this.scarf.visible = v || this.crash !== null;
    if (!this.crash) this.stars.visible = false;
  }

  /** Perfect landing: a white rim flash and a punchy squash into a crouch (ART.md section 5). */
  flash(): void {
    this.landT = 0;
  }

  /** Earned flow (0 to 1, the director's fk) and the 'In the flow' rim pulse (0 to 1): the vermillion
   *  rim and the brighter scarf (uniforms only), and the scarf's tails flare up to 20% wider. */
  setFlow(flow: number, pulse: number): void {
    this.u.flow.value.set(Math.max(0, Math.min(1, flow)), Math.max(0, Math.min(1, pulse)));
  }

  /** A point along the long scarf tail (u: 0 at the knot, 1 at the tip), in three.js space: where
   *  flow's motes stream off. */
  scarfPoint(u: number, out: Vector3): Vector3 {
    const pts = this.tails[0].pts;
    const f = Math.max(0, Math.min(1, u)) * (TAIL_N - 1);
    const i = Math.min(TAIL_N - 2, Math.floor(f));
    return out.lerpVectors(pts[i], pts[i + 1], f - i);
  }

  reset(pos: Vector3): void {
    this.crash = null;
    this.root.visible = true;
    this.scarf.visible = true;
    this.crashBody.visible = false;
    this.crashSled.visible = false;
    this.stars.visible = false;
    this.u.fill.value = 0;
    this.u.flow.value.set(0, 0);
    this.mat.uniforms.uRimK.value = 0.4;
    this.landT = 9;
    this.leanS = this.leanV = this.bobY = this.bobV = this.tuckK = this.chatY = 0;
    this.grindK = this.wallS = this.finK = 0;
    this.react = null;
    this.cueSeen = NaN;
    this.loadK = this.driftK = this.waveSide = 0;
    this.u.stand.value = 0;
    this.wasAir = false;
    this.popT = this.touchT = 9;
    this.popK = this.touchK = 0;
    this.softP.set(0, 0, 0);
    this.softV.set(0, 0, 0);
    this.u.soft.value.set(0, 0, 0);
    this.wrists.fill(0);
    // Hang the tails down the back; the first update carries them to the knot.
    this.anchor.copy(pos).add(this.vA.set(0, 0.85 * RIDER_SCALE, 0.35 * RIDER_SCALE));
    this.anchorPrev.copy(this.anchor);
    for (const t of this.tails) {
      for (let i = 0; i < TAIL_N; i++) {
        t.pts[i].copy(this.anchor).add(this.vA.set(t.sign * 0.04 * i, -0.04 * i, 0.12 * i));
        t.prev[i].copy(t.pts[i]);
      }
    }
  }

  update(p: RiderPose, dt: number, time: number): void {
    this.tickFlash(dt);
    this.tickEmber();
    this.tickSway(p, dt);
    if (this.crash) {
      this.crashBody.updateMatrixWorld();
      this.anchor.copy(SCARF_KNOT).applyMatrix4(this.crashBody.matrixWorld);
      // Once the wreck sits up, the tails come to rest on the snow and stop fluttering.
      const settled = this.crash.rest > 0.2 && this.restView !== null;
      this.usePlane = settled;
      this.settled = settled;
      if (settled) {
        this.planeN.copy(this.restN);
        this.planeP.copy(this.restP);
      }
      this.setColliders(this.crashBody.matrixWorld.elements, this.crashNeck.matrixWorld.elements);
      this.updateScarf(dt, time, this.crash.bodyVel, !settled);
      return;
    }
    this.settled = false;
    this.root.position.copy(p.pos);
    // The moments (moments.ts): a tumble rolls the whole rig forward twice and it bounces, losing height
    // as it slows; under reduced motion the rider only curls up, with no spin.
    const calm = reduced();
    const act = p.act;
    this.grindK += ((act?.grind ? 1 : 0) - this.grindK) * Math.min(1, dt * 14);
    this.wallS += ((act?.wall ?? 0) - this.wallS) * Math.min(1, dt * 8);
    this.finK += ((act?.finish ? 1 : 0) - this.finK) * Math.min(1, dt * (calm ? 8 : 3.2));
    const tumble = act?.tumble ?? 0;
    const fin0 = this.finK;
    // A wipeout long enough is played whole (wipeout() below): the rider is thrown from the sled, and
    // the sled skids on beside it. A short one rolls the whole rig, as it always did.
    const wipe = tumble > 0 && !calm && (act?.tumbleS ?? 0) >= WIPE_MIN_S ? this.wipeout(tumble, act!.tumbleS!, act!.tumbleCuts, time, p) : null;
    if (tumble === 0) this.wipeSide = 0;
    const spun = tumble > 0 && !calm && !wipe ? tumble : 0;
    const rollEase = 1 - (1 - spun) * (1 - spun);
    const rollSin = Math.sin(Math.PI * spun);
    if (spun > 0) this.root.position.y += Math.abs(Math.sin(Math.PI * 2.5 * spun)) * (1 - spun) * TUMBLE_BOUNCE;
    this.tickCue(act, dt);
    const cel = this.celebrate(p, calm);
    // Round 8: the trick's pose (trickpose.ts), eased in fast and out a little slower; it lets go at touchdown.
    const tp = this.trickFrame(p, dt, time, calm, tumble > 0 || fin0 > 0.5 || wipe !== null);
    const tk = this.tpK;
    // Tilt the whole rig to the ground normal when grounded; level out in the air.
    const n = p.airborne ? UP : p.normal;
    this.tmpQ.setFromUnitVectors(UP, n);
    this.tilt.quaternion.slerp(this.tmpQ, Math.min(1, dt * (p.airborne ? 4 : 14)));
    // (A round sled spins under its rider over the line.)
    this.yaw.rotation.set(0, -(p.heading + p.airYaw) + rollSin * 1.3 + this.grindK * GRIND_YAW + cel.sledSpin + (wipe ? wipe.sledYaw : 0) + tp.sledYaw * tk, 0);
    const wob = p.wobble > 0 ? Math.sin(time * 38) * 0.08 * Math.min(1, p.wobble / 20) : 0;
    this.flip.rotation.set(-p.airPitch - rollEase * Math.PI * 2 * TUMBLE_TURNS, 0, 0);
    // The sled banks a little; most of the carve lean comes from the hips (below), so the rider bends
    // into the turn rather than tipping over as one rigid block with its sled.
    // (A rail's balance sways it side to side; a tumble throws it over.)
    this.leanG.rotation.set(0, 0, -p.lean * 0.2 + wob + rollSin * 0.8 + (calm ? 0 : Math.sin(time * 11) * 0.05 * this.grindK) + (wipe ? wipe.sledRock : 0) + tp.sledRoll * tk);

    // Body pose. A perfect landing squashes the torso and legs flat on touchdown (0.7 tall, 1.25
    // wide) and holds it for about 150 ms, springs back through a stretch, and rides the landing out
    // in a deep crouch with the arms flung up and out, released over most of a second. The head keeps
    // its own size and pops up out of the squash: squashed with the body it sank into the shoulders.
    // A squash that sprang straight back read as no squash at all: caught a tenth of a second after
    // touchdown the pose looked like normal riding.
    const lt = this.landT;
    // Take-off and touchdown. Leaving the snow with any lift, the body extends (the release of whatever
    // it had loaded: a held crouch into a lip gives the most); coming down, it compresses by how hard
    // it hit and takes longer to come back up from a harder one. A tumble has its own motion.
    if (tumble === 0 && fin0 < 0.5) {
      if (p.airborne && !this.wasAir) {
        this.popT = 0;
        this.popK = Math.max(this.loadK, smooth((p.vel.y - 1.5) / 7));
      } else if (!p.airborne && this.wasAir) {
        this.touchT = 0;
        this.touchK = smooth((-this.airVy - 2.5) / 12);
        this.touchS = 0.22 + 0.5 * this.touchK;
      }
    }
    this.wasAir = p.airborne;
    if (p.airborne) this.airVy = p.vel.y;
    this.popT += dt;
    this.touchT += dt;
    const ext = calm ? 0 : this.popK * env(this.popT, 0.05, 0.13, 0.42);
    const sq = lt < 0.15 ? 1 : 1 - smooth((lt - 0.15) / 0.1);
    const rebound = lt > 0.15 && lt < 0.42 ? Math.sin((Math.PI * (lt - 0.15)) / 0.27) : 0;
    const stomp = lt < 0.9 ? (lt < 0.05 ? lt / 0.05 : 1 - smooth((lt - 0.3) / 0.6)) : 0;
    // (A perfect landing's own squash owns the frame; under reduced motion the body only sinks.)
    const touch = this.touchK * env(this.touchT, 0.045, 0.045 + 0.25 * this.touchS, this.touchS + 0.25) * (1 - stomp) * (calm ? 0.5 : 1);
    this.tickBody(p, dt, time);
    const fin = this.finK;
    // Loading for a lip with the action held: it sinks lower than a plain crouch, pitches over its
    // knees, draws both arms back past its hips and lifts its chin to the lip; letting go at the lip
    // springs it all forward (fast out, so the pop reads).
    const loadT = p.airborne ? 0 : act?.load ?? 0;
    this.loadK += (loadT - this.loadK) * Math.min(1, dt * (loadT > this.loadK ? 9 : 18));
    const load = this.loadK * (1 - fin);
    // Into a drift: the body leans further to the inside as the charge builds, a little lower, the
    // inside mitt reaching down toward the snow and the outside arm up for balance.
    this.driftK += ((p.drifting && !p.airborne ? 1 : 0) - this.driftK) * Math.min(1, dt * 7);
    const dk = this.driftK * (1 - fin) * (1 - stomp);
    const inside = p.driftDir >= 0 ? 1 : -1;
    // Riding the wall the body leans in toward it, over the sled's own tilt up the bank.
    const air0 = p.airborne ? 1 : 0;
    const lean = this.leanS + this.wallS * 0.85 + inside * dk * (0.16 + 0.14 * (p.driftCharge ?? 0));
    const bob = this.bobY + this.chatY;
    const speedTuck = this.tuckK;
    const crouch = Math.max(p.crouch * (1 - tk * (1 - tp.crouch)), stomp * 0.85, speedTuck * 0.62, this.grindK * 0.8, load, touch * 0.9, dk * 0.3, tp.crouch * tk, tumble > 0 && calm ? 1 : 0) * (1 - fin) * (1 - 0.8 * ext);
    const tuck = p.airborne && p.crouch > 0.5 ? 1 : 0;
    // Drifting, the sled slides sideways while the rider keeps its chest to the way it is going, as a
    // rider does: crouched over a sled turned across the view, it read from the chase camera as a
    // body lying flat on its side.
    let twist = 0;
    if (!p.airborne && Math.hypot(p.vel.x, p.vel.z) > 2) {
      const d = Math.atan2(p.vel.x, -p.vel.z) - p.heading;
      twist = Math.max(-0.95, Math.min(0.95, 0.7 * (d - Math.round(d / (2 * Math.PI)) * 2 * Math.PI)));
    }
    this.twist += (twist - this.twist) * Math.min(1, dt * 8);
    // The crouch sinks more than it pitches: a deep forward pitch on top of a carve lean read as a fall.
    // (The body's weight shift lags the sled's bank a little and settles past it, and a bump or a
    // landing it soaks up pitches it forward over its knees for a moment.)
    // (Over the line it sits up tall.)
    // (Standing over the line it is upright, so its legs hang straight down to the deck.)
    // (The pop's release throws the chest up and back off the knees; a touchdown folds it over them.)
    let pitch = (-0.15 - this.seat.lean - crouch * 0.3 - load * 0.14 - dk * 0.06 - tuck * 0.35 - stomp * 0.2 - speedTuck * 0.14 - touch * 0.16 + ext * 0.34 + Math.min(0, bob) * 1.6) * (1 - fin * 0.85) * (1 - cel.stand) + cel.lean;
    // (A trick's pose sets the body's pitch itself, but a backflip keeps the flight's tuck.)
    if (!Number.isNaN(tp.pitch)) pitch += (tp.pitch - pitch) * tk;
    // Weight into a carve (round 7): the shoulders open toward the turn and the hips slide to its inside
    // further than they did, so a carve is a shift of the whole body and not a tilt of it; held by the
    // finish, a drift (which has its own posture) and a reaction.
    const carve = lean * (1 - fin) * (1 - dk) * (1 - air0);
    // (A trick turns, rolls and lifts the body over its sled; a Spinning Top's rider sits still while the saucer
    // spins under it.)
    const counter = tp.counter > 0 ? (p.airYaw - this.tpYaw0) * tp.counter : 0;
    this.bodyPivot.rotation.set(pitch + this.cuePitch + rollSin * 0.5, -this.twist - this.grindK * GRIND_YAW * 0.7 + cel.yaw + this.cueTwist - carve * 0.16 + (tp.yaw + counter) * tk, -lean * 0.26 + this.cueRoll + (tp.roll + tp.shake) * tk);
    // (A tumble throws the body up off the sled; over the line it may hop up to stand on it.)
    // (A Pine Bow stands on the deck as the finish does.)
    const deck = STAND_DECK[this.sledId];
    const trickStand = deck !== undefined ? tp.stand * tk : 0;
    if (trickStand > this.u.stand.value) this.u.stand.value = trickStand;
    const standLift = deck !== undefined ? (deck + 0.59 - this.seat.y) * Math.max(0, trickStand - cel.stand) : 0;
    this.bodyPivot.position.y = this.seat.y - crouch * 0.08 - load * 0.05 - dk * 0.025 - stomp * 0.05 + ext * 0.07 - this.cueDip + bob + rollSin * 0.2 + (calm ? 0 : fin * (1 - cel.stand) * Math.abs(Math.sin(time * 3.4)) * 0.05) + cel.lift + (tp.lift * tk + standLift);
    // The hips slide to the inside of the carve: the weight goes where the turn is.
    this.bodyPivot.position.x = Math.max(-0.085, Math.min(0.085, lean * 0.075));
    // (A Comet Tail streams the body out off the back of the sled.)
    this.bodyPivot.position.z = this.seat.z + tp.back * tk;
    // (The release stretches the body a touch, the touchdown squashes it by its impact.)
    const sx = 1 + sq * 0.25 - rebound * 0.04 + touch * 0.14 - ext * 0.05;
    const sy = 1 - sq * 0.3 + rebound * 0.08 - touch * 0.2 + ext * 0.1;
    this.bodyPivot.scale.set(sx, sy, sx);
    this.neck.scale.set(1 / sx, 1 / sy, 1 / sx);
    this.neck.position.set(RIDER_NECK.x, (RIDER_NECK.y + this.headLift) * (1 + (1 / sy - 1) * 0.75), RIDER_NECK.z);
    // The head holds toward upright as the torso pitches forward, chin a little up, so the face and
    // beanie stay above the shoulder line (the roll is countered once the lean is capped, below).
    // A reaction turns it on the neck (a look, a nod, a shake), and loading for a lip lifts the chin.
    // (Into a carve it looks where it is going; a touchdown nods it.)
    this.neck.rotation.set(-(pitch + 0.15) * 0.7 + 0.06 + stomp * 0.12 + load * 0.12 - touch * 0.14 + this.cueNod - tp.nod * tk, this.cueYaw + cel.look - carve * 0.42, 0);
    const air = p.airborne ? 1 : 0;
    const flail = air * (1 - tuck);
    const armSwing = Math.sin(time * 9) * 0.25 * flail;
    // Arms (positive x swings a hanging arm forward): relaxed down and forward to the knees on the
    // snow, a little out from the hips so they still read from behind; out wide in the air, hugging
    // the knees in a tuck, thrown up and out in a V on a stomp. Held back toward the chase camera they
    // read as stiff T-pose sticks.
    // (On a stomp the raised arms swing back against the torso's forward pitch, more on a saucer where
    // it pitches furthest, so they point up out of the squash rather than out at the snow ahead.)
    // A speed tuck draws the arms in to the knees; a bump the body soaks up flicks them out for balance.
    let armX = 0.72 - flail * 0.57 + tuck * 0.38 + stomp * (this.seat.crossLegged ? 0.6 : 0.35) + speedTuck * 0.3 - this.grindK * 0.4;
    // Seated cross-legged on a tray the mitts rest on the knees, close in.
    let armOut = (this.seat.crossLegged ? 0.14 : 0.3) + flail * 0.88 - tuck * 0.12 + stomp * (2.25 - flail * 0.88) - speedTuck * 0.14 + Math.min(0.35, Math.abs(this.bobV) * 0.9) * (1 - stomp) + this.grindK * 0.85;
    // Over the line both arms go up in a V and pump; a tumble windmills them.
    if (fin > 0.001) {
      armX += (0.38 - armX) * fin;
      armOut += (2.5 + (calm ? 0 : Math.sin(time * 6.5) * 0.24) - armOut) * fin;
    }
    if (spun > 0) {
      armX += Math.sin(time * 19) * 1.1;
      armOut += 0.9 + Math.sin(time * 15) * 0.7;
    }
    // A touchdown throws both arms out for balance, by its impact.
    armOut += touch * 0.75;
    // Each arm on its own from here (x: swung forward, o: out from the side, + away from the body), and
    // each elbow's bend: relaxed on the snow, nearly straight flung out in the air or up in a V, folded
    // in a tuck (the mitts to the knees).
    const arm = this.arms;
    const bend = this.bends;
    arm[0] = armX + armSwing;
    arm[1] = armOut;
    arm[2] = armX - armSwing;
    arm[3] = armOut;
    bend[0] = bend[1] = ARM_REST_BEND + (0.18 - ARM_REST_BEND) * Math.max(flail, stomp, fin, touch) + tuck * 0.75 + speedTuck * 0.45 - this.grindK * 0.2;
    if (spun > 0) {
      bend[0] = 0.5 + 0.4 * Math.sin(time * 17);
      bend[1] = 0.5 + 0.4 * Math.sin(time * 13 + 1);
    }
    // Loading: both arms drawn back past the hips, elbows bent.
    if (load > 0.001) for (let k = 0; k < 4; k += 2) {
      arm[k] += (-0.6 - arm[k]) * load;
      arm[k + 1] += (0.4 - arm[k + 1]) * load;
      bend[k >> 1] += (1.05 - bend[k >> 1]) * load;
    }
    // The release: both arms thrown forward and up as the body extends, straightening as they go.
    if (ext > 0.001) for (let k = 0; k < 4; k += 2) {
      arm[k] += (2.1 - arm[k]) * ext;
      arm[k + 1] += (0.55 - arm[k + 1]) * ext;
      bend[k >> 1] += (0.12 - bend[k >> 1]) * ext;
    }
    // Drifting: a posture that reads at a glance. The inside arm goes straight down to the snow, its
    // mitt trailing in it; the outside arm comes up and over, bent, the way a rider holds a slide; more
    // of both as the charge builds.
    if (dk > 0.001) {
      const i = inside > 0 ? 2 : 0;
      const o = 2 - i;
      const ch = p.driftCharge ?? 0;
      arm[i] += (-0.05 - arm[i]) * dk;
      arm[i + 1] += (0.8 + 0.1 * ch - arm[i + 1]) * dk;
      bend[i >> 1] += (0.08 - bend[i >> 1]) * dk;
      arm[o] += (0.75 - arm[o]) * dk;
      arm[o + 1] += (1.7 + 0.25 * ch - arm[o + 1]) * dk;
      bend[o >> 1] += (0.95 - bend[o >> 1]) * dk;
    }
    this.cueArms(arm, calm, (1 - fin) * (1 - stomp) * (tumble > 0 ? 0 : 1) * (1 - 0.6 * tuck));
    this.celebrateArms(arm, cel);
    // Round 8: the trick's arms over the flight's (a hand on the rail, an arm up for a Lantern Reach...).
    if (tk > 0.001) for (let i = 0; i < 2; i++) {
      const w = tk * tp.armK[i];
      if (w <= 0) continue;
      arm[i * 2] += (tp.arm[i * 2] - arm[i * 2]) * w;
      arm[i * 2 + 1] += (tp.arm[i * 2 + 1] - arm[i * 2 + 1]) * w;
      bend[i] += (tp.bend[i] - bend[i]) * w;
    }
    if (wipe) {
      arm.set(wipe.arm);
      bend.set(wipe.bend);
    }
    this.tickJoints(arm, dt, calm);
    // Balancing a carve: the outside arm reaches out and up, the inside one tucks in, more while the
    // body is still catching up with the sled's bank (the lag between them).
    const bal = Math.max(-1, Math.min(1, lean * 0.9 + (p.lean - lean) * 1.4)) * (1 - air) * (1 - stomp) * (1 - fin) * (1 - dk);
    this.armL.rotation.set(arm[0], 0, -arm[1] + p.lean * 0.15 - Math.max(0, bal) * 0.5);
    this.armR.rotation.set(arm[2], 0, arm[3] + p.lean * 0.15 - Math.min(0, bal) * 0.5);
    if (wipe) {
      // Thrown from the sled: the body has its own place beside it, its own roll and its own head.
      this.bodyPivot.position.set(wipe.x, wipe.y, this.seat.z + wipe.z);
      this.bodyPivot.rotation.set(wipe.pitch, wipe.yaw, wipe.roll);
      this.bodyPivot.scale.set(1, wipe.sy, 1);
      this.neck.scale.set(1, 1 / wipe.sy, 1);
      this.neck.position.set(RIDER_NECK.x, RIDER_NECK.y + this.headLift, RIDER_NECK.z);
      this.neck.rotation.set(wipe.nod, wipe.headYaw, wipe.headRoll);
      this.armL.rotation.set(arm[0], 0, -arm[1]);
      this.armR.rotation.set(arm[2], 0, arm[3]);
    }

    this.root.updateMatrixWorld(true);
    const roll = p.airborne || wipe ? 0 : this.capLean(p.heading + p.airYaw);
    // ...and holds toward upright against the torso's roll.
    if (roll !== 0) {
      this.neck.rotation.z = -roll * 0.55;
      this.neck.updateMatrixWorld(true);
    }
    this.knot.getWorldPosition(this.anchor);
    this.setColliders(this.bodyPivot.matrixWorld.elements, this.neck.matrixWorld.elements);
    // The tails rest on the sled deck and never dig into the slope.
    this.usePlane = !p.airborne;
    this.planeN.copy(p.normal);
    this.planeP.copy(p.pos).addScaledVector(p.normal, 0.26 * RIDER_SCALE);
    this.updateScarf(dt, time, p.vel, p.airborne, p.heading + p.airYaw);
    this.u.spirit.value.y = p.pos.y;
    this.tickEcho(time);
  }

  /** This frame of a wipeout played whole (wipeout()): where the thrown body is (metres from its seat,
   *  in the sled's frame) and how it is turned, its head, its arms, and what the sled does. */
  private wp = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, sy: 1, nod: 0, headYaw: 0, headRoll: 0, sledYaw: 0, sledRock: 0, arm: new Float32Array(4), bend: new Float32Array(2) };
  /** The side the rider was thrown to (+1 the right; 0 before a fall picks one). */
  private wipeSide = 0;

  /**
   * A wipeout the run survives, played whole (round 7): `u` is 0 to 1 through it and `secs` how long the
   * sim says it lasts. In order, by share of that time: the rider is thrown off to one side and rolls
   * twice over the snow, bouncing, arms windmilling, while the sled skids on askew (to 40%, or the
   * sim's own share, act.tumbleCuts); it slides on its back beside the sled and sits up, dazed, shakes its head and looks
   * across at the sled (to 70%); it scrambles up and hops back onto the seat (to 94%); and it settles
   * into its crouch, ready for the snow to be brushed off (the 'dust' reaction the tumble's end cues).
   * The sim moves the pair down the hill throughout (rider.root): this only says where the rider is
   * about its sled. Nothing here is read back.
   */
  private wipeout(u: number, secs: number, cuts: readonly [number, number] | undefined, time: number, p: RiderPose): typeof this.wp {
    const w = this.wp;
    if (this.wipeSide === 0) this.wipeSide = Math.abs(p.lean) > 0.05 ? (p.lean > 0 ? -1 : 1) : Math.sin(time * 91.7) > 0 ? 1 : -1;
    const sd = this.wipeSide;
    const t = u * secs;
    const tR = (cuts ? cuts[0] : 0.4) * secs;
    const tS = (cuts ? cuts[1] : 0.7) * secs;
    const tM = 0.94 * secs;
    const sitY = 0.13;
    const OUT = 0.98;
    const BACK = 0.5;
    const tau = Math.PI * 2;
    w.sy = 1;
    w.sledYaw = w.sledRock = w.headRoll = 0;
    // (The arm on the sled's side: thrown to the right, the sled lies on the rider's left.)
    const near = sd > 0 ? 0 : 2;
    const far = 2 - near;
    if (t < tR) {
      const r = t / tR;
      const e = 1 - (1 - r) * (1 - r);
      w.x = sd * OUT * smooth(r * 1.5);
      w.z = BACK * smooth(r);
      w.y = this.seat.y + (sitY - this.seat.y) * smooth(r * 1.3) + Math.abs(Math.sin(Math.PI * 2.5 * r)) * (1 - r) * 0.7;
      w.pitch = -e * tau * TUMBLE_TURNS + 0.2 * smooth((r - 0.8) / 0.2);
      w.yaw = sd * 0.55 * r;
      w.roll = -sd * Math.sin(Math.PI * r) * 0.55;
      w.nod = 0.2 * Math.sin(time * 14);
      w.headYaw = 0.4 * Math.sin(time * 9);
      w.sledYaw = -sd * Math.sin(Math.PI * Math.min(1, r * 1.2)) * 0.6;
      w.sledRock = Math.sin(r * Math.PI * 3) * 0.22 * (1 - r);
      w.arm[0] = 0.5 + Math.sin(time * 19) * 1.1;
      w.arm[1] = 1.2 + Math.sin(time * 15) * 0.7;
      w.arm[2] = 0.5 - Math.sin(time * 19) * 1.1;
      w.arm[3] = 1.2 + Math.sin(time * 15 + 2) * 0.7;
      w.bend[0] = 0.5 + 0.4 * Math.sin(time * 17);
      w.bend[1] = 0.5 + 0.4 * Math.sin(time * 13 + 1);
    } else if (t < tS) {
      const q = (t - tR) / (tS - tR);
      const up = smooth((q - 0.25) / 0.35);
      w.x = sd * OUT;
      w.z = BACK;
      w.y = sitY + Math.abs(Math.sin(q * Math.PI * 2)) * 0.05 * (1 - q);
      // Flat on its back at first, then sitting up, propped on its mitts.
      w.pitch = 0.2 + 0.85 * (1 - up);
      w.yaw = sd * 0.55 * (1 - 0.6 * smooth((q - 0.5) / 0.5));
      w.roll = 0;
      const look = smooth((q - 0.62) / 0.25);
      w.nod = -0.35 * (1 - up) - 0.1 * up;
      w.headYaw = Math.sin((q - 0.3) * tau * 3.2) * 0.38 * env(q - 0.3, 0.06, 0.2, 0.36) + sd * 0.95 * look;
      w.headRoll = Math.sin(time * 2.6) * 0.16 * up * (1 - look);
      w.sledRock = Math.sin(q * Math.PI * 4) * 0.04 * (1 - q);
      // Arms flung wide on its back, then propping it up behind; the near one reaches for the sled.
      const prop = up;
      w.arm[0] = w.arm[2] = 0.2 + (-0.75 - 0.2) * prop;
      w.arm[1] = w.arm[3] = 1.35 + (0.5 - 1.35) * prop;
      w.bend[0] = w.bend[1] = 0.25;
      w.arm[near] += (0.5 - w.arm[near]) * look;
      w.arm[near + 1] += (1.25 - w.arm[near + 1]) * look;
    } else if (t < tM) {
      const m = (t - tS) / (tM - tS);
      const e = smooth(m);
      const hop = Math.sin(Math.PI * m);
      w.x = sd * OUT * (1 - e);
      w.z = BACK * (1 - e);
      w.y = sitY + (this.seat.y - sitY) * e + hop * 0.4;
      w.pitch = 0.2 * (1 - e) - 0.45 * hop - 0.15 * e;
      w.yaw = sd * 0.22 * (1 - e) + sd * 0.5 * hop * (1 - e);
      w.roll = sd * 0.25 * hop;
      w.nod = 0.15 * hop;
      w.headYaw = sd * 0.95 * (1 - e);
      w.arm[near] = 0.9;
      w.arm[near + 1] = 0.9 - 0.5 * e;
      w.arm[far] = 0.3 + 0.8 * hop;
      w.arm[far + 1] = 0.6 + 0.9 * hop;
      w.bend[0] = w.bend[1] = 0.7;
    } else {
      const s2 = (t - tM) / Math.max(1e-3, secs - tM);
      const sq = Math.sin(Math.PI * Math.min(1, s2 * 1.4)) * (1 - s2);
      w.x = w.z = 0;
      w.y = this.seat.y - 0.07 * (1 - s2);
      w.sy = 1 - 0.18 * sq;
      w.pitch = -0.15 - 0.28 * (1 - s2);
      w.yaw = w.roll = 0;
      w.nod = 0.1 * (1 - s2);
      w.headYaw = 0;
      w.sledRock = Math.sin(s2 * Math.PI * 3) * 0.06 * (1 - s2);
      w.arm[0] = w.arm[2] = 0.72;
      w.arm[1] = w.arm[3] = 0.3 + 0.6 * sq;
      w.bend[0] = w.bend[1] = ARM_REST_BEND;
    }
    return w;
  }

  /** The arms' joints for this frame (round 7): each elbow eases to its bend, and each mitt lags the arm
   *  it hangs from (a swing forward leaves it trailing, a stop lets it catch up and settle), a little
   *  more in the wind of a flight. The upper arm is posed, the forearm and the mitt follow: that is
   *  what makes an arm read as an arm and not as a paddle. Reduced motion keeps the bends and drops the
   *  lag. */
  private tickJoints(arm: Float32Array, dt: number, calm: boolean): void {
    const h = Math.min(Math.max(dt, 0), 1 / 20);
    const prev = this.armPrev;
    const w = this.wrists;
    for (let k = 0; k < 2; k++) {
      const j = this.joints[k].value;
      const b = Math.max(0, Math.min(1.9, this.bends[k]));
      j.x += (b - j.x) * Math.min(1, dt * 18);
      const vSwing = h > 0 ? Math.max(-12, Math.min(12, (arm[k * 2] - prev[k * 2]) / h)) : 0;
      const vOut = h > 0 ? Math.max(-12, Math.min(12, (arm[k * 2 + 1] - prev[k * 2 + 1]) / h)) : 0;
      prev[k * 2] = arm[k * 2];
      prev[k * 2 + 1] = arm[k * 2 + 1];
      // (A hanging arm swung forward turns positive about x; the mitt's nod is about the same axis.)
      const nodT = calm ? 0 : Math.max(-0.75, Math.min(0.75, -vSwing * 0.075));
      const flopT = calm ? 0 : Math.max(-0.6, Math.min(0.6, vOut * 0.06 * (k === 0 ? 1 : -1)));
      w[k * 2] += (nodT - w[k * 2]) * Math.min(1, dt * 13);
      w[k * 2 + 1] += (flopT - w[k * 2 + 1]) * Math.min(1, dt * 13);
      j.y = w[k * 2];
      j.z = w[k * 2 + 1];
    }
  }

  /** This frame's arms: left swing, left out, right swing, right out (radians). */
  private arms = new Float32Array(4);
  /** This frame's reaction on the head and shoulders: the head's turn and nod, the torso's turn and roll. */
  private cueYaw = 0;
  private cueNod = 0;
  private cueTwist = 0;
  private cueRoll = 0;
  /** ...and the chest's pitch (+ back) and how far the body dips (metres). */
  private cuePitch = 0;
  private cueDip = 0;
  private reactK = 1;
  /** This frame's finish celebration (celebrate()). */
  private cel: Celebration = { stand: 0, lift: 0, yaw: 0, look: 0, lean: 0, sledSpin: 0, t: 0, champ: false, podium: false, deck: false, k: 0 };

  /** Takes a new reaction cue (each count once) and works out its head and shoulders for this frame. A
   *  tumble or the finish owns the rider: no reaction shows through them. */
  private tickCue(act: RiderAct | undefined, dt: number): void {
    if (act && act.cueN !== undefined) {
      if (Number.isNaN(this.cueSeen)) this.cueSeen = act.cueN;
      else if (act.cueN !== this.cueSeen) {
        this.cueSeen = act.cueN;
        if (act.cue) {
          this.react = act.cue;
          this.reactT = 0;
          this.reactSide = (act.cueSide ?? 1) < 0 ? -1 : 1;
          this.reactK = Math.max(0, Math.min(1, act.cueK ?? 1));
        }
      }
    }
    this.cueYaw = this.cueNod = this.cueTwist = this.cueRoll = this.cuePitch = this.cueDip = 0;
    const r = this.react;
    if (!r) return;
    this.reactT += dt;
    const t = this.reactT;
    if (t >= CUE_S[r]) {
      this.react = null;
      return;
    }
    const calm = reduced();
    const s = this.reactSide;
    const tau = Math.PI * 2;
    if (r === 'look') {
      // Passed: a look at it over the shoulder on its side (the head turns most of the way, far enough
      // that the face shows in profile from behind, the shoulders a little), a lean in after it, and
      // the head coming back with a small shake.
      const w = env(t, 0.18, 0.8, 1.2);
      this.cueYaw = -s * (calm ? 0.9 : 1.35) * w + (calm ? 0 : Math.sin((t - 1.0) * tau * 3) * 0.12 * env(t - 1.0, 0.05, 0.2, 0.33));
      this.cueTwist = -s * 0.3 * w;
      this.cueRoll = -s * 0.1 * w;
      this.cuePitch = -0.08 * env(t - 0.5, 0.2, 0.5, 0.8);
    } else if (r === 'glance') {
      // Passing: a glance across at it as it drops back, a lean toward it, a nod.
      const w = env(t, 0.12, 0.45, CUE_S.glance);
      this.cueYaw = -s * (calm ? 0.6 : 0.95) * w;
      this.cueTwist = -s * 0.18 * w;
      this.cueRoll = -s * 0.09 * w;
      this.cueNod = calm ? 0 : -0.12 * env(t - 0.3, 0.07, 0.16, 0.32);
    } else if (r === 'pump') {
      // A glance across first, then the head nods in time with the fist.
      const g = env(t, 0.1, 0.24, 0.42);
      const w = env(t - 0.15, 0.12, 0.65, CUE_S.pump - 0.15);
      this.cueYaw = -s * 0.8 * g;
      this.cueRoll = -s * 0.07 * g;
      this.cueNod = calm ? -0.06 * w : -0.15 * Math.max(0, Math.sin((t - 0.15) * tau * 2.6)) * w;
    } else if (r === 'cheer') {
      // Chin up and chest out under both arms.
      const w = env(t, 0.12, 0.95, CUE_S.cheer);
      this.cueNod = 0.16 * w;
      this.cuePitch = 0.1 * w;
    } else if (r === 'flinch') {
      // A near miss: the head ducks and turns away from it, the shoulders hunch and roll away, and the
      // whole body dips for a moment. Fast in, a breath to come back.
      const w = env(t, 0.045, 0.17, CUE_S.flinch) * this.reactK;
      this.cueNod = -0.34 * w;
      this.cueYaw = s * 0.5 * w;
      this.cueRoll = (calm ? 0.08 : 0.2) * s * w;
      this.cueDip = 0.05 * w;
      this.cuePitch = -0.1 * w;
    } else if (r === 'slump') {
      // A set piece lost: the shoulders drop, the head hangs and shakes slowly, and it sits back up.
      const w = env(t, 0.22, 1.05, CUE_S.slump);
      this.cueNod = -0.4 * w;
      this.cuePitch = -0.17 * w;
      this.cueDip = 0.035 * w;
      this.cueYaw = calm ? 0 : Math.sin((t - 0.45) * tau * 1.5) * 0.2 * env(t - 0.45, 0.15, 0.6, 0.85);
    } else {
      // A shake of the head, a shiver of the shoulders like a dog shaking off water, then a look down
      // at the coat while the snow is slapped off it.
      const w = env(t, 0.08, 0.55, 0.8);
      this.cueYaw = Math.sin(t * tau * (calm ? 1.25 : 3.4)) * (calm ? 0.22 : 0.42) * w;
      this.cueRoll = calm ? 0 : Math.sin((t - 0.45) * tau * 6.5) * 0.11 * env(t - 0.45, 0.06, 0.35, 0.5);
      this.cueNod = -0.14 * env(t - 0.7, 0.12, 0.65, 0.85);
    }
    const k = (1 - this.finK) * ((act?.tumble ?? 0) > 0 ? 0 : 1);
    this.cueYaw *= k;
    this.cueNod *= k;
    this.cueTwist *= k;
    this.cueRoll *= k;
    this.cuePitch *= k;
    this.cueDip *= k;
  }

  /** The reaction's arms, over the riding pose by weight `w` (a stomp, a tuck or the finish hold them
   *  down): one fist pumped up on the side away from the ghost it passed, or both arms; after a
   *  tumble, the right mitt brushing the snow off the left shoulder and chest. */
  private cueArms(arm: Float32Array, calm: boolean, w: number): void {
    const r = this.react;
    if (!r || w <= 0.001) return;
    const t = this.reactT;
    const tau = Math.PI * 2;
    const bend = this.bends;
    const to = (i: number, x: number, o: number, k: number, b: number) => {
      arm[i] += (x - arm[i]) * k;
      arm[i + 1] += (o - arm[i + 1]) * k;
      bend[i >> 1] += (b - bend[i >> 1]) * k;
    };
    if (r === 'pump') {
      // The fist on the far side from the ghost punches up: the elbow drives it, bent then straight.
      const ph = (t - 0.15) * tau * 2.6;
      to(this.reactSide > 0 ? 0 : 2, 0.25, 2.7 + (calm ? 0 : Math.sin(ph) * 0.2), env(t - 0.15, 0.12, 0.65, CUE_S.pump - 0.15) * w, calm ? 0.3 : 0.5 - 0.42 * Math.sin(ph));
    } else if (r === 'cheer') {
      const k = env(t, 0.12, 0.95, CUE_S.cheer) * w;
      to(0, 0.3, 2.45 + (calm ? 0 : Math.sin(t * tau * 2.4) * 0.22), k, calm ? 0.2 : 0.3 - 0.25 * Math.sin(t * tau * 2.4));
      to(2, 0.3, 2.45 + (calm ? 0 : Math.sin(t * tau * 2.4 + 2) * 0.22), k, calm ? 0.2 : 0.3 - 0.25 * Math.sin(t * tau * 2.4 + 2));
    } else if (r === 'flinch') {
      // The arm on its side comes up as a shield, the other pulls in to the chest.
      const k = env(t, 0.045, 0.17, CUE_S.flinch) * this.reactK * w;
      const near = this.reactSide > 0 ? 2 : 0;
      to(near, 0.7, 1.35, k, 1.25);
      to(2 - near, 0.85, 0.2, k, 1.4);
    } else if (r === 'slump') {
      // Both arms hang, limp, the mitts on the deck.
      const k = env(t, 0.22, 1.05, CUE_S.slump) * w;
      to(0, 0.28, 0.16, k, 0.12);
      to(2, 0.28, 0.16, k, 0.12);
    } else if (r === 'dust') {
      // Both mitts slap the snow off the coat's sides in turn, out and in, where the lens behind sees
      // them (a mitt brushing the chest hid behind the back, and the toy's arms never reach its beanie).
      const k = env(t - 0.7, 0.12, 0.65, 0.85) * w;
      const ph = (t - 0.7) * tau * (calm ? 1 : 3.2);
      const amp = calm ? 0.15 : 0.42;
      to(0, 0.1, 0.55 + amp * Math.sin(ph), k, 0.9 + 0.3 * Math.sin(ph));
      to(2, 0.1, 0.55 + amp * Math.sin(ph + Math.PI), k, 0.9 - 0.3 * Math.sin(ph));
    }
  }

  /** Over the line (real seconds since it, act.finT): arms up in a V at once, then the place decides
   *  (round 7: three celebrations, told apart at a glance).
   *    A win: it hops up to stand on the deck (from 0.8 s), throws both fists up in turn, turns a full
   *    circle in the air, and lands with both arms flung wide to the sky, bouncing.
   *    The podium (second or third): it stands, punches one fist up twice and holds it high, then
   *    waves to the crowd on the lens's side with the other hand on its hip.
   *    Any other finish: it stays in its seat, leans back and stretches both arms over its head (made
   *    it), then gives the lens a wave and a nod.
   *  A round sled has no deck to stand on and spins under its rider instead (once and a half for a
   *  win). Reduced motion stays seated and still: arms up for first place, out wide for any other
   *  (standing, the stopped rider filled the chase lens that reduced motion keeps through the results). */
  /** This frame's trick pose (trickpose.ts) and its eased weight (tpK): the turn rates come off the pose's own
   *  air yaw and pitch. While it eases out the last pose held is kept, so a landing lets go of a grab rather than
   *  snapping through a blend toward nothing. `off`: a tumble, the finish or a wipeout owns the body. */
  private trickFrame(p: RiderPose, dt: number, time: number, calm: boolean, off: boolean) {
    const t = this.tpIn;
    const tr = p.trick;
    const h = Math.max(1 / 240, dt);
    t.spin = Number.isNaN(this.tpYaw) || !p.airborne ? 0 : (p.airYaw - this.tpYaw) / h;
    t.flip = Number.isNaN(this.tpPitch) || !p.airborne ? 0 : (p.airPitch - this.tpPitch) / h;
    this.tpYaw = p.airYaw;
    this.tpPitch = p.airPitch;
    t.move = tr?.move ?? 0;
    t.grab = tr?.grab ?? 0;
    t.tier = tr?.tier ?? 0;
    t.tweak = tr?.tweak ?? 0;
    t.danger = tr?.danger ?? 0;
    t.time = time;
    t.calm = calm;
    const pose = trickPose(t, this.tpNew);
    const want = p.airborne && !off && tr !== undefined ? pose.k : 0;
    if (want > 0) {
      // (A new sled move that counter-turns starts from the turn it is at.)
      if (pose.counter > 0 && this.tp.counter === 0) this.tpYaw0 = p.airYaw;
      const tp = this.tp;
      tp.pitch = pose.pitch;
      tp.roll = pose.roll;
      tp.yaw = pose.yaw;
      tp.lift = pose.lift;
      tp.back = pose.back;
      tp.crouch = pose.crouch;
      tp.stand = pose.stand;
      tp.sledRoll = pose.sledRoll;
      tp.sledYaw = pose.sledYaw;
      tp.arm[0] = pose.arm[0];
      tp.arm[1] = pose.arm[1];
      tp.arm[2] = pose.arm[2];
      tp.arm[3] = pose.arm[3];
      tp.bend[0] = pose.bend[0];
      tp.bend[1] = pose.bend[1];
      tp.armK[0] = pose.armK[0];
      tp.armK[1] = pose.armK[1];
      tp.nod = pose.nod;
      tp.shake = pose.shake;
      tp.counter = pose.counter;
      tp.name = pose.name;
    } else if (!p.airborne) this.tp.counter = 0;
    // In fast (a grab is a snap of the hand), out a touch slower; on the snow it is gone in about 0.15 s.
    this.tpK += (want - this.tpK) * Math.min(1, dt * (want > this.tpK ? 16 : p.airborne ? 9 : 22));
    if (this.tpK < 0.002) this.tpK = 0;
    return this.tp;
  }

  private celebrate(p: RiderPose, calm: boolean): Celebration {
    const c = this.cel;
    const a = p.act;
    c.stand = c.lift = c.yaw = c.look = c.lean = c.sledSpin = c.k = 0;
    c.champ = a?.rank === 1;
    c.podium = a?.rank === 2 || a?.rank === 3;
    // (Only a win or a podium stands up; anyone else keeps its seat.)
    const deck = calm || !(c.champ || c.podium) ? undefined : STAND_DECK[this.sledId];
    c.deck = deck !== undefined;
    if (!a?.finish || this.finK < 0.01) {
      this.u.stand.value = 0;
      this.waveSide = 0;
      return c;
    }
    const t = a.finT ?? 0;
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    c.t = t;
    const seated = !calm && !c.champ && !c.podium && STAND_DECK[this.sledId] !== undefined;
    if (deck !== undefined) {
      c.stand = smooth((t - 0.8) / 0.32);
      c.lift = (deck + 0.59 - this.seat.y) * c.stand + Math.sin(Math.PI * clamp01((t - 0.75) / 0.45)) * 0.2;
      if (c.champ) {
        const u = clamp01((t - 1.7) / 0.6);
        c.yaw = Math.PI * 2 * smooth(u);
        c.lift += Math.sin(Math.PI * u) * 0.3;
      }
    } else if (seated) {
      // Any other finish: back in its seat, a long stretch.
      c.lean = 0.3 * smooth((t - 0.7) / 0.5) * (1 - 0.5 * smooth((t - 2.3) / 0.5));
    } else if (!calm) c.sledSpin = Math.PI * 2 * (c.champ ? 1.5 : 1) * smooth((t - 0.9) / (c.champ ? 1.5 : 2.2));
    this.u.stand.value = c.stand;
    c.k = smooth((t - 1.05) / 0.3);
    if ((c.deck || seated) && !c.champ && c.k > 0) {
      if (this.waveSide === 0 && this.eye) {
        const h = p.heading + p.airYaw;
        this.waveSide = (this.eye.position.x - p.pos.x) * Math.cos(h) + (this.eye.position.z - p.pos.z) * Math.sin(h) >= 0 ? 1 : -1;
      }
      const s = this.waveSide || 1;
      // (The podium turns to the crowd once its fist is down; a seated finish once it has stretched.)
      const turn = c.k * smooth((t - (seated ? 2.3 : 2.1)) / 0.4);
      c.look = -s * (seated ? 0.7 : 0.45) * turn;
      c.yaw += -s * (seated ? 0.16 : 0.3) * turn;
    }
    return c;
  }

  /** The celebration's arms over the arms-up V (see celebrate). */
  private celebrateArms(arm: Float32Array, c: Celebration): void {
    const k = c.k;
    if (k <= 0.001) return;
    const tau = Math.PI * 2;
    const bend = this.bends;
    const to = (i: number, x: number, o: number, b: number, w = 1) => {
      arm[i] += (x - arm[i]) * k * w;
      arm[i + 1] += (o - arm[i + 1]) * k * w;
      bend[i >> 1] += (b - bend[i >> 1]) * k * w;
    };
    const t = c.t;
    const wv = this.waveSide > 0 ? 2 : 0;
    // The wave to the lens's side: the forearm does the waving, the other hand on the hip.
    const wave = (w: number) => {
      to(wv, 0.12, 2.2 + Math.sin(t * tau * 1.7) * 0.2, 0.55 + 0.5 * Math.sin(t * tau * 1.7 + 0.8), w);
      to(2 - wv, -0.4, 0.72, 1.45, w);
    };
    if (c.champ) {
      // (On a round sled first place keeps the V as it spins.)
      if (!c.deck) return;
      // Both fists up in turn; once the spin has landed, both arms flung wide to the sky.
      const wide = smooth((t - 2.35) / 0.25);
      to(0, 0.35, 2.35 + Math.max(0, Math.sin(t * tau * 2)) * 0.45, 0.45 - 0.35 * Math.max(0, Math.sin(t * tau * 2)), 1 - wide);
      to(2, 0.35, 2.35 + Math.max(0, Math.sin(t * tau * 2 + Math.PI)) * 0.45, 0.45 - 0.35 * Math.max(0, Math.sin(t * tau * 2 + Math.PI)), 1 - wide);
      to(0, 0.1, 2.05 + Math.sin(t * tau * 1.1) * 0.12, 0.12, wide);
      to(2, 0.1, 2.05 + Math.sin(t * tau * 1.1) * 0.12, 0.12, wide);
    } else if (c.podium && c.deck) {
      // One fist punched up twice and held, then the wave.
      const turn = smooth((t - 2.1) / 0.4);
      const ph = (t - 1.05) * tau * 1.9;
      to(2 - wv, 0.3, 2.7 + 0.18 * Math.sin(ph) * (1 - smooth((t - 1.7) / 0.3)), 0.5 - 0.4 * Math.max(Math.sin(ph), smooth((t - 1.7) / 0.3)), 1 - turn);
      to(wv, -0.4, 0.72, 1.45, 1 - turn);
      wave(turn);
    } else if (!c.deck && STAND_DECK[this.sledId] === undefined) {
      to(0, 0.15, 1.55, 0.3);
      to(2, 0.15, 1.55, 0.3);
    } else {
      // Seated: both arms stretched up and back over the head, then the wave.
      const turn = smooth((t - 2.3) / 0.4);
      to(0, -0.25, 2.85, 0.1, 1 - turn);
      to(2, -0.25, 2.85, 0.1, 1 - turn);
      to(wv, 0.12, 1.9 + Math.sin(t * tau * 1.7) * 0.18, 0.6 + 0.5 * Math.sin(t * tau * 1.7 + 0.8), turn);
      to(2 - wv, 0.72, 0.3, ARM_REST_BEND, turn);
    }
  }

  /** Carving up a bank, the slope's own tilt plus the carve lean laid the rider almost flat, which
   *  read as a crash, and a rigid torso tipped past about 40 degrees read as a toppling fridge. The
   *  torso never rolls more than about 35 degrees off vertical: past that the body sits back up over
   *  the tilted sled. Returns the torso's roll (radians, after the cap). */
  private capLean(facing: number): number {
    const e = this.bodyPivot.matrixWorld.elements;
    // The body's up (its y column, scale removed) against the level direction across the sled.
    const ul = Math.hypot(e[4], e[5], e[6]) || 1;
    const roll = Math.atan2((e[4] * Math.cos(facing) + e[6] * Math.sin(facing)) / ul, e[5] / ul);
    if (Math.abs(roll) <= MAX_ROLL) return roll;
    // A positive turn about the body's own forward axis rolls its top back toward the left.
    this.bodyPivot.rotation.z += roll > 0 ? roll - MAX_ROLL : roll + MAX_ROLL;
    this.bodyPivot.updateMatrixWorld(true);
    return roll > 0 ? MAX_ROLL : -MAX_ROLL;
  }

  /** The body rides its sled rather than being bolted to it. Its carve lean follows the sled's on a
   *  spring (about 3 Hz, a little under-damped), so a turn in is a weight shift that lags and settles
   *  and a quick flick back swings through. A sudden change of vertical speed (a landing, a bump, a
   *  pop) drops it into its knees, and it springs back up (about 4 Hz); at speed the snow's chatter
   *  runs through it. From about 22 m/s on a straight line it folds into a real tuck: lower, pitched
   *  over its knees, arms in. All of it is presentation only, eased so a frame hitch never kicks it. */
  private tickBody(p: RiderPose, dt: number, time: number): void {
    const h = Math.min(dt, 1 / 30);
    if (h <= 0) return;
    const dvy = Math.max(-12, Math.min(12, p.vel.y - this.bodyVy));
    this.bodyVy = p.vel.y;
    // A landing (vertical speed jumping up) or a bump throws the body down into its knees.
    if (!p.airborne) this.bobV -= Math.max(0, dvy) * 0.22 + Math.max(0, -dvy) * 0.05;
    const sub = Math.ceil(h * 240);
    const s = h / sub;
    for (let i = 0; i < sub; i++) {
      this.leanV += (-(this.leanS - p.lean) * 340 - this.leanV * 20) * s;
      this.leanS += this.leanV * s;
      this.bobV += (-this.bobY * 620 - this.bobV * 22) * s;
      this.bobY += this.bobV * s;
    }
    this.bobY = Math.max(-0.1, Math.min(0.04, this.bobY));
    const speed = Math.hypot(p.vel.x, p.vel.z);
    // The snow's chatter under the runners at speed: a fine, uneven shiver.
    // (Reduced motion keeps the body still on the snow: the springs stay, the shiver goes.)
    this.chatY = p.airborne || reduced() ? 0 : (Math.sin(time * 41) * 0.6 + Math.sin(time * 67 + 1.3) * 0.4) * 0.006 * smooth((speed - 14) / 16);
    const want = p.airborne || p.drifting ? 0 : smooth((speed - 22) / 9) * (1 - smooth((Math.abs(p.lean) - 0.15) / 0.35));
    this.tuckK += (want - this.tuckK) * Math.min(1, dt * 3.5);
  }

  /** The perfect landing's white rim: a thin line that burns for a moment on touchdown and is gone
   *  by 0.15 s (held for 0.4 s, the saucer was still blown out to white 70 ms in). */
  private tickFlash(dt: number): void {
    this.landT += dt;
    const lt = this.landT;
    this.u.flash.value = lt < 0.03 ? 1 : lt < 0.15 ? 1 - smooth((lt - 0.03) / 0.12) : 0;
    // Round 8 (the events lane): the light that runs up the rider, a perfect landing's from the runners to the
    // hat in a quarter of a second, a dash's ignition wider, white-gold and a little slower. (The perfect's hold,
    // timescale.ts, keeps it at the runners for the held beat, so it leaves the snow as the picture lets go.)
    // Reduced motion keeps the beat as a glow over the whole figure that fades, with no band moving.
    this.igniteT += dt;
    const r = this.u.rise.value;
    // (Low keeps round 7's thin rim flash and the dash's own rim and bands: a changing uniform on every rider
    // material is a dozen GL calls a frame there, and Low's main thread is its budget.)
    if (this.lite) {
      r.y = 0;
      return;
    }
    const calm = reduced() || this.u.spirit.value.z < 1;
    const it = this.igniteT;
    if (it < 0.42) {
      const k = it < 0.03 ? it / 0.03 : 1 - smooth((it - 0.24) / 0.18);
      if (calm) r.set(0.7, 0.45 * k, 1.6, 1);
      else r.set(-0.2 + 2.1 * smooth(it / 0.32), 0.6 * k, 0.26, 1);
    } else if (lt < 0.3) {
      const k = lt < 0.02 ? lt / 0.02 : 1 - smooth((lt - 0.16) / 0.14);
      if (calm) r.set(0.7, 0.35 * k, 1.6, 0);
      else r.set(-0.15 + 1.95 * smooth(lt / 0.24), 0.85 * k, 0.22, 0);
    } else r.y = 0;
  }
  /** Seconds since a dash lit the rider up (setSpirit's rising edge). */
  private igniteT = 9;

  /** Secondary motion: the pom-pom rides a damped spring that a landing, a bump or a pop kicks (any
   *  sudden change of vertical speed, capped so a hard landing is a bounce, not a launch) and a
   *  change of lean swings sideways; the coat hem flutters harder with speed and in the air. A
   *  wreck's pom settles and its hem stills. */
  private tickSway(p: RiderPose, dt: number): void {
    const h = Math.min(dt, 1 / 30);
    const live = !this.crash;
    if (live && h > 0) {
      const dvy = Math.max(-14, Math.min(14, p.vel.y - this.lastVy));
      // A landing (vertical speed jumping up) throws the pom down into the beanie, then it springs.
      this.pomVY -= dvy * 0.12;
      this.pomVX += Math.max(-0.5, Math.min(0.5, p.lean - this.lastLean)) * 1.6;
    }
    this.lastVy = p.vel.y;
    this.lastLean = p.lean;
    if (h > 0) {
      // About 3 Hz, settling in about half a second.
      const sub = Math.ceil(h * 240);
      const s = h / sub;
      for (let i = 0; i < sub; i++) {
        this.pomVY += (-360 * this.pomY - 11 * this.pomVY) * s;
        this.pomVX += (-300 * this.pomX - 10 * this.pomVX) * s;
        this.pomY += this.pomVY * s;
        this.pomX += this.pomVX * s;
      }
      this.pomY = Math.max(-0.06, Math.min(0.05, this.pomY));
      this.pomX = Math.max(-0.05, Math.min(0.05, this.pomX));
    }
    this.u.pom.value.set(this.pomX, this.pomY, 0);
    const speed = Math.hypot(p.vel.x, p.vel.z);
    const want = live ? smooth((speed - 4) / 18) * (p.airborne ? 1 : 0.8) : 0;
    this.u.hem.value += (want - this.u.hem.value) * Math.min(1, dt * 4);
    // The soft parts (the hood on the back, a hat's tail, the toes of the boots): heavier and slower
    // than the pom-pom (about 2.4 Hz, three swings to settle), kicked down by a landing, across by a
    // change of bank and back by a burst of speed, and streaming back a little at speed. Reduced motion
    // holds them still.
    const sp = this.softP;
    const sv = this.softV;
    if (live && h > 0 && !reduced()) {
      const dvy = Math.max(-14, Math.min(14, p.vel.y - this.softVy));
      sv.y -= dvy * 0.1;
      sv.x += Math.max(-0.5, Math.min(0.5, p.lean - this.softLean)) * 1.3;
      sv.z += Math.max(-6, Math.min(6, speed - this.lastSpeed)) * 0.09;
      const sub = Math.ceil(h * 240);
      const s = h / sub;
      for (let i = 0; i < sub; i++) {
        sv.x += (-225 * sp.x - 8.5 * sv.x) * s;
        sv.y += (-225 * sp.y - 8.5 * sv.y) * s;
        sv.z += (-225 * sp.z - 8.5 * sv.z) * s;
        sp.addScaledVector(sv, s);
      }
      sp.set(Math.max(-0.07, Math.min(0.07, sp.x)), Math.max(-0.07, Math.min(0.05, sp.y)), Math.max(-0.05, Math.min(0.08, sp.z)));
      this.u.soft.value.set(sp.x, sp.y, sp.z + 0.035 * this.u.hem.value);
    } else {
      sp.set(0, 0, 0);
      sv.set(0, 0, 0);
      this.u.soft.value.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
    this.softVy = p.vel.y;
    this.softLean = p.lean;
    this.lastSpeed = speed;
  }

  /** How warm a dusk the mood's sky is: a dark zenith over a warm horizon (Comet Night) lays an ember
   *  rim on the coat. Read from the shared palette uniforms, so any mood change carries it. */
  private tickEmber(): void {
    const z = shared.uSkyZenith.value;
    const r = shared.uRim.value;
    const dusk = 1 - smooth((0.2126 * z.r + 0.7152 * z.g + 0.0722 * z.b - 0.012) / 0.03);
    const warm = smooth(((r.r - r.b) / Math.max(r.r, 1e-3) - 0.3) / 0.3);
    this.u.ember.value = dusk * warm;
  }

  /** Where the scarf tails must keep out: the torso (from the body pivot's world matrix `e`) and the
   *  head and its sight cone (from the neck's, `hE`). */
  private setColliders(e: ArrayLike<number>, hE: ArrayLike<number>): void {
    for (let i = 0; i < COLLIDERS.length; i++) {
      const [c] = COLLIDERS[i];
      const m = i === 1 ? hE : e;
      const out = this.colliders[i][0];
      out.set(m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13], m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14]);
    }
    const h = HEAD_VIEW;
    this.headC.set(hE[0] * h.x + hE[4] * h.y + hE[8] * h.z + hE[12], hE[1] * h.x + hE[5] * h.y + hE[9] * h.z + hE[13], hE[2] * h.x + hE[6] * h.y + hE[10] * h.z + hE[14]);
  }

  /** Start the wipeout tumble from the current pose. `carry` scales how far the speed throws the
   *  wreck on (a rider lost in the forest is stopped by the first trees, not thrown deep among them). */
  startCrash(vel: Vector3, carry = 1): void {
    if (this.crash) return;
    this.u.stand.value = 0;
    this.react = null;
    this.root.updateMatrixWorld(true);
    const bodyPos = this.body.getWorldPosition(new Vector3());
    const sledPos = this.sled.getWorldPosition(new Vector3());
    this.crash = {
      t: 0,
      bodyPos,
      bodyVel: vel.clone().multiplyScalar(0.75 * carry).add(new Vector3(0, 4.5, 0)),
      sledPos,
      sledVel: vel.clone().multiplyScalar(0.55 * carry).add(new Vector3((Math.random() - 0.5) * 3, 2.5, 0)),
      spin: new Vector3(8 + Math.random() * 4, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8),
      sledSpin: new Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 12, 6),
      rest: 0,
      restFrom: new Quaternion(),
      restY: 0,
      sledFrom: new Vector3(),
      sledQFrom: new Quaternion(),
      clearX: 0,
      clearZ: 0,
      clearK: 0,
    };
    this.crashBody.position.copy(bodyPos);
    this.crashSled.position.copy(sledPos);
    this.crashBody.quaternion.copy(this.body.getWorldQuaternion(new Quaternion()));
    this.crashSled.quaternion.copy(this.sled.getWorldQuaternion(new Quaternion()));
    this.root.visible = false;
    this.crashBody.visible = true;
    this.crashSled.visible = true;
  }

  get crashing(): boolean {
    return this.crash !== null;
  }

  /** Advance the tumble; returns the body position for the camera. */
  updateCrash(dt: number, course: Course): Vector3 | null {
    const c = this.crash;
    if (!c) return null;
    c.t += dt;
    // Results hero shot: once the tumble has played out, the wreck sits up in the snow, dazed and
    // propped on its mitts, turned to show the lens its profile, so the shot reads as a rider
    // rather than a heap of navy and red.
    if (this.restView !== null && c.t > 0.9 && c.rest < 1) {
      if (c.rest === 0) {
        c.restFrom.copy(this.crashBody.quaternion);
        c.restY = c.bodyPos.y;
        c.sledFrom.copy(c.sledPos);
        c.sledQFrom.copy(this.crashSled.quaternion);
        this.findClearing(c.bodyPos, course);
      }
      c.rest = Math.min(1, c.rest + dt / 0.8);
    }
    const k = c.rest * c.rest * (3 - 2 * c.rest);
    // Settled, one arm props the rider up behind it and the other flops forward onto its knee, both
    // bent at the elbow: two straight props read as a stiff mannequin rather than a dazed rider.
    this.crashArmL.rotation.set(-0.3 - 0.5 * k, 0, -1.4 + 1.0 * k);
    this.crashArmR.rotation.set(-0.3 + 1.05 * k, 0.25 * k, 1.4 - 1.15 * k);
    // Sitting up dazed: the head turns to the lens, lolls well over to one side and sways, chin up.
    this.starT += dt;
    this.crashNeck.rotation.set(0.16 * k, -0.8 * k, (0.36 + 0.08 * Math.sin(this.starT * 1.6)) * k);
    // The hero shot's fill comes up as the wreck settles; the toon rim (shared with the snow's
    // rim colour) is held down with the rider's own rims.
    const fill = this.restView !== null ? k : 0;
    this.u.fill.value = fill;
    this.mat.uniforms.uRimK.value = 0.4 * (1 - 0.6 * fill);
    const step = (pos: Vector3, vel: Vector3, obj: Object3D, spin: Vector3, r: number) => {
      vel.y -= 14 * dt;
      const fromX = pos.x;
      const fromZ = pos.z;
      pos.addScaledVector(vel, dt);
      // The sim's ground runs on under a wall's rock, so a wreck thrown that way came to rest inside it,
      // where no lens could find it. It stops at the rock's face and drops to its foot.
      if (inRock(course, pos.x, pos.y - r, -pos.z)) {
        pos.x = fromX;
        pos.z = fromZ;
        vel.x *= -0.2;
        vel.z *= -0.2;
      }
      const gy = visualGround(course, pos.x, -pos.z) + r;
      if (pos.y < gy) {
        pos.y = gy;
        if (vel.y < 0) vel.y = -vel.y * 0.35;
        vel.x *= 0.82;
        vel.z *= 0.82;
        spin.multiplyScalar(0.75);
      }
      obj.position.copy(pos);
      obj.rotateX(spin.x * dt);
      obj.rotateY(spin.y * dt);
      obj.rotateZ(spin.z * dt);
    };
    if (c.rest > 0 && this.restView !== null) {
      // Slide to a stop and settle onto the seat, facing right of the view and half round toward the lens.
      const damp = Math.exp(-dt * 4);
      c.bodyVel.set(c.bodyVel.x * damp, 0, c.bodyVel.z * damp);
      const fromX = c.bodyPos.x;
      const fromZ = c.bodyPos.z;
      c.bodyPos.x += c.bodyVel.x * dt + c.clearX * (k - c.clearK);
      c.bodyPos.z += c.bodyVel.z * dt + c.clearZ * (k - c.clearK);
      if (inRock(course, c.bodyPos.x, c.bodyPos.y - 0.1, -c.bodyPos.z)) {
        c.bodyPos.x = fromX;
        c.bodyPos.z = fromZ;
      }
      c.clearK = k;
      const gy = visualGround(course, c.bodyPos.x, -c.bodyPos.z) + 0.1 * RIDER_SCALE;
      c.bodyPos.y = c.restY + (gy - c.restY) * k;
      this.crashBody.position.copy(c.bodyPos);
      // The snow under the wreck, which the scarf's tails settle onto (hanging free behind the seated
      // rider they read as a stiff red slab).
      course.gradient(c.bodyPos.x, -c.bodyPos.z, this.slopeG);
      this.restN.set(-this.slopeG.x, 1, this.slopeG.z).normalize();
      this.restP.set(c.bodyPos.x, gy - 0.07, c.bodyPos.z);
      // The body sits side on to the lens, its legs out across the frame toward the sled, and the head
      // turns to the lens, three-quarter front: turned square on, its legs and boot soles pointed into
      // the lens, and a phone's low shot saw two boots and a profile.
      this.restQ.setFromEuler(this.restE.set(0.3, -(this.restView + Math.PI - 1.3), 0.14));
      this.crashBody.quaternion.slerpQuaternions(c.restFrom, this.restQ, k);
      // The sled skids to a stop on its back just beside the rider, toward the middle of the frame
      // and a little beyond, settled flat on the snow upside down with its curled runners in the air:
      // the shot tells the crash with both halves of the wreck in it, and a sled tumbling on down the
      // slope never leaves the frame. (Tipped on its side it read as hanging against a trunk.)
      const az = this.restView;
      const fx = Math.sin(az);
      const fz = -Math.cos(az);
      // On a steep bank the sled comes to rest on the rider's downhill side, turned side on to the
      // lens along the bank, curled runners up: laid uphill of the rider on the bank's face, pointing
      // away up the slope, it read as a sled on its side rather than one upside down beside the rider.
      // (Downhill in three.js x and z is (-gradient x, gradient z); the lens's right is (-fz, fx).)
      const bank = smooth((Math.hypot(this.slopeG.x, this.slopeG.z) - 0.25) / 0.25);
      const downR = this.slopeG.x * fz + this.slopeG.z * fx;
      if (c.rest < 0.05) WRECK_SLED.side = bank > 0.5 && downR < -0.05 ? -1 : 1;
      // (Downhill on the left it comes a little toward the lens too, clear of the rider's back.)
      const right = WRECK_SLED.right * WRECK_SLED.side;
      const away = WRECK_SLED.side < 0 ? -0.15 : WRECK_SLED.away;
      const spot = this.sledSpot.set(c.bodyPos.x - fz * right + fx * away, 0, c.bodyPos.z + fx * right + fz * away);
      course.gradient(spot.x, -spot.z, this.slopeG);
      // On a steep bank it lies only half as tilted as the slope (and a little proud of it at its
      // uphill end), so it still reads as a sled upside down beside the rider: laid flat on the bank's
      // face it read as standing on its side up the slope.
      const steep = Math.hypot(this.slopeG.x, this.slopeG.z);
      spot.y = visualGround(course, spot.x, -spot.z) + 0.4 + 0.3 * Math.min(1, steep);
      c.sledPos.lerpVectors(c.sledFrom, spot, k);
      c.sledVel.set(0, 0, 0);
      this.crashSled.position.copy(c.sledPos);
      this.tmpQ.setFromUnitVectors(UP, this.vD.set(-this.slopeG.x * 0.45, 1, this.slopeG.z * 0.45).normalize());
      this.sledRestQ.setFromEuler(this.sledRestE.set(0.06, -(az + 0.5 + 0.85 * bank), Math.PI - 0.1)).premultiply(this.tmpQ);
      this.crashSled.quaternion.slerpQuaternions(c.sledQFrom, this.sledRestQ, k);
    } else {
      step(c.bodyPos, c.bodyVel, this.crashBody, c.spin, 0.3 * RIDER_SCALE);
      step(c.sledPos, c.sledVel, this.crashSled, c.sledSpin, 0.12 * RIDER_SCALE);
    }
    this.placeStars(c.rest);
    return c.bodyPos;
  }

  /** A wreck that comes to rest under the trees (a forest crash stops at the treeline wall) slides
   *  out toward the open course as it settles, up to 4 m, until no trunk stands within 1.6 m: under
   *  the canopy no lens could frame it, and its sled ended up hanging against a trunk. Asked once,
   *  as the wreck begins to settle. */
  private findClearing(at: Vector3, course: Course): void {
    const c = this.crash!;
    c.clearX = c.clearZ = c.clearK = 0;
    const blocked = this.blocked;
    if (!blocked || !blocked(at.x, at.z, 1.6)) return;
    const s = Math.sign(course.centerX(-at.z) - at.x) || 1;
    for (let d = 0.5; d <= 4; d += 0.5) {
      if (!blocked(at.x + s * d, at.z, 1.6)) {
        c.clearX = s * d;
        return;
      }
    }
    c.clearX = s * 4;
  }

  /** Results only: three small gold-white stars circle the dazed wreck's beanie, tilted with its
   *  head, each turned to face the lens. */
  private placeStars(rest: number): void {
    const show = this.restView !== null && rest > 0.3 && this.eye !== null;
    this.stars.visible = show;
    if (!show) return;
    this.crashBody.updateMatrixWorld(true);
    const pop = smooth((rest - 0.3) / 0.5);
    const t = this.starT;
    for (let i = 0; i < STARS; i++) {
      const s = this.stars.children[i];
      const a = t * 2.1 + (i / STARS) * Math.PI * 2;
      s.position.set(Math.cos(a) * STAR_R, STAR_Y + Math.sin(a * 2 + i) * 0.035, Math.sin(a) * STAR_R);
      this.crashNeck.localToWorld(s.position);
      s.quaternion.copy(this.eye!.quaternion);
      s.rotateZ(t * 2.5 + i * 1.3);
      s.scale.setScalar(RIDER_SCALE * pop * (0.85 + 0.15 * Math.sin(t * 7 + i * 2.1)));
    }
  }

  /** Verlet tails. Still-air drag streams them back at speed. Seen from the chase camera a tail
   *  streaming straight back lies along the line of sight and collapses into a blob on the back,
   *  so a sideways push that grows with speed flares both out past one shoulder, the long
   *  tail wider than the short one, drooping a little so neither covers the head: the right one,
   *  or the far one from a camera off to the side. (Flared to opposite sides, the pair read as red
   *  wings from behind.) A travelling wave flutters and twists them, harder in the air. */
  private updateScarf(dt: number, time: number, vel: Vector3, airborne: boolean, facing = 0): void {
    if (dt <= 0) {
      this.buildScarf(time, airborne);
      return;
    }
    // A teleport (revive, the title reel changing leads) carries the scarf along instead of
    // whipping it across the slope. Otherwise the knot's vertical motion is carried too: the
    // rider drops, launches and falls far harder than real gravity, and a scarf left to lag
    // behind that would fly up like ears or drape over the sled. Only the horizontal motion
    // shapes the tails, through the drag.
    const jump = this.vA.subVectors(this.anchor, this.anchorPrev);
    if (jump.lengthSq() < 9) jump.set(0, jump.y, 0);
    for (const t of this.tails) {
      for (let i = 0; i < TAIL_N; i++) {
        t.pts[i].add(jump);
        t.prev[i].add(jump);
      }
    }
    this.fromAnchor.copy(this.anchorPrev).add(jump);
    this.anchorPrev.copy(this.anchor);

    const speed = Math.hypot(vel.x, vel.z);
    if (speed > 1) this.travel.set(vel.x / speed, 0, vel.z / speed);
    else this.travel.set(Math.sin(facing), 0, -Math.cos(facing));
    this.side.set(-this.travel.z, 0, this.travel.x);
    if (this.eye) {
      // Swap sides only once the camera is well off to one side, so a chase camera swinging through
      // a carve never flips the scarf back and forth.
      const off = (this.eye.position.x - this.anchor.x) * this.side.x + (this.eye.position.z - this.anchor.z) * this.side.z;
      if (off > 1.5) this.flareSide = -1;
      else if (off < -1.5) this.flareSide = 1;
    }
    // Substeps of at most 1/60 s keep the shape the same at 20 fps as at 60: with one long step
    // the drag outweighs the sideways and lifting pushes and the tails trail flat behind.
    const span = Math.min(dt, 0.1);
    const steps = Math.min(3, Math.ceil(span * 60 - 0.01));
    for (let k = 1; k <= steps; k++) {
      this.stepAnchor.lerpVectors(this.fromAnchor, this.anchor, k / steps);
      this.stepScarf(span / steps, time - span * (1 - k / steps), speed, airborne);
    }
    this.buildScarf(time, airborne);
  }

  private stepScarf(h: number, time: number, speed: number, airborne: boolean): void {
    const side = this.side;
    const speedK = Math.min(1.3, speed / 24);
    const ratio = h / this.hPrev;
    this.hPrev = h;
    const damp = Math.exp(-3.4 * h) * ratio;
    const dampY = Math.exp(-1.4 * h) * ratio;
    const h2 = h * h;
    const flut = airborne ? 1.6 : 1;
    // At speed the lift carries the tails a few degrees above level, which from the raised chase
    // camera reads as streaming out at shoulder height rather than hanging down the back like a
    // cape; slowing down, it fades and they hang.
    const liftK = Math.min(1, speed / 12) * (airborne ? 0.85 : 1);
    const fA = 17 + 9 * speedK;
    const fB = 12 + 6 * speedK;
    // A perfect landing whips both tails out to the flare side and a little up for about half a
    // second, so the squash shows the coat's back and both arms: draped over a saucer rider's back the
    // scarf turned the stomp into a red blob.
    const lt = this.landT;
    const drape = lt < 0.65 ? (lt < 0.05 ? lt / 0.05 : 1 - smooth((lt - 0.3) / 0.35)) : 0;
    // In the flow the tails stream out up to a fifth wider: the scarf is the motion indicator.
    const flowFlare = 1 + 0.2 * this.u.flow.value.x;
    // The drag above pulls back at about 3.4 m/s^2 per m/s, so a sideways push of flare * speed
    // holds a tail at a steady angle to the track whatever the speed (about 34 degrees for the
    // long tail, 19 for the short one).
    for (const t of this.tails) {
      t.pts[0].copy(this.stepAnchor).addScaledVector(side, t.sign * this.flareSide * 0.04 * RIDER_SCALE);
      t.prev[0].copy(t.pts[0]);
      for (let i = 1; i < TAIL_N; i++) {
        const u = i / (TAIL_N - 1);
        const p = t.pts[i];
        const q = t.prev[i];
        const vx = (p.x - q.x) * damp;
        const vy = (p.y - q.y) * dampY;
        const vz = (p.z - q.z) * damp;
        q.copy(p);
        // A travelling wave runs down each tail, growing toward the tip, which flutters hardest.
        const wave = Math.sin(time * fA - i * 1.25 + t.phase);
        const wave2 = Math.cos(time * fB - i * 0.85 + t.phase * 1.7);
        const uf = u * Math.sqrt(u);
        // (Settled in the snow, a breeze spreads the two tails apart and out across it, so they lie on
        // the snow in a fan rather than hanging down the rider's back as one stiff red slab.)
        const lat = t.flare * flowFlare * this.flareSide * speed + wave * (3 + 1.1 * speed) * uf * flut + drape * 48 * this.flareSide + (this.settled ? t.sign * 4.4 + this.flareSide * 2.4 : 0);
        // The cloth sags a little near the knot and the tip lifts back to about level: a gentle curve,
        // never a plank held straight out.
        const lift = liftK * (9.8 * (0.25 + 0.65 * uf) + 0.1 * speed * u * u) + wave2 * (2 + 0.6 * speed) * u * flut - 9.8 + drape * 7 * u;
        p.x += vx + side.x * lat * h2;
        p.y += vy + lift * h2;
        p.z += vz + side.z * lat * h2;
      }
    }
    this.sightL = 0;
    if (this.eye) {
      const u = this.sightU.subVectors(this.headC, this.eye.position);
      const l = u.length();
      this.sightS.crossVectors(u, UP);
      const sl = this.sightS.length();
      // (A camera straight overhead has no across direction; the cone is skipped.)
      if (l > 0.6 && sl > 0.3 * l) {
        u.multiplyScalar(1 / l);
        this.sightS.multiplyScalar(1 / sl);
        this.sightL = l;
        this.sightSide = this.side.dot(this.sightS) * this.flareSide < 0 ? -1 : 1;
      }
    }
    for (let it = 0; it < 4; it++) {
      for (const t of this.tails) {
        const pts = t.pts;
        for (let i = 1; i < TAIL_N; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const d = this.vB.subVectors(b, a);
          const len = d.length() || 1e-4;
          const corr = (len - t.seg) / len;
          if (i === 1) b.addScaledVector(d, -corr);
          else {
            a.addScaledVector(d, corr * 0.5);
            b.addScaledVector(d, -corr * 0.5);
          }
        }
        for (let i = 1; i < TAIL_N; i++) this.collide(pts[i]);
      }
    }
    // A few relaxation passes cannot hold the lengths against strong drag (the tails stretched
    // by 40% at speed), so finish with one exact pass from the knot out that only shortens.
    for (const t of this.tails) {
      const pts = t.pts;
      for (let i = 1; i < TAIL_N; i++) {
        const d = this.vB.subVectors(pts[i], pts[i - 1]);
        const len = d.length();
        if (len > t.seg) pts[i].copy(pts[i - 1]).addScaledVector(d, t.seg / len);
      }
    }
    // No segment climbs more than 30 degrees above level, so no tail can rise more than that from
    // the knot: on a stomp, a flip or a tumble a tail flung upward would otherwise stand straight up
    // over the head and turn the rider into a red flame from the chase camera. A segment over the
    // limit is laid back down along its own heading (straight up falls back against the travel),
    // carrying the rest of the chain with it, and loses its upward speed like cloth hitting a wall.
    for (const t of this.tails) {
      const pts = t.pts;
      const prev = t.prev;
      for (let i = 1; i < TAIL_N; i++) {
        const d = this.vB.subVectors(pts[i], pts[i - 1]);
        const len = d.length();
        if (d.y <= len * SCARF_MAX_RISE) continue;
        const hl = Math.hypot(d.x, d.z);
        const hx = hl > 1e-4 ? d.x / hl : -this.travel.x;
        const hz = hl > 1e-4 ? d.z / hl : -this.travel.z;
        const shift = this.vC.set(pts[i - 1].x + hx * len * SCARF_MAX_RUN - pts[i].x, pts[i - 1].y + len * SCARF_MAX_RISE - pts[i].y, pts[i - 1].z + hz * len * SCARF_MAX_RUN - pts[i].z);
        for (let j = i; j < TAIL_N; j++) {
          pts[j].add(shift);
          prev[j].add(shift);
          if (pts[j].y > prev[j].y) prev[j].y = pts[j].y;
        }
      }
    }
  }

  private collide(p: Vector3): void {
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i][0];
      const r = this.colliders[i][1];
      const d = this.vC.subVectors(p, c);
      const l2 = d.lengthSq();
      if (l2 < r * r && l2 > 1e-8) p.copy(c).addScaledVector(d, r / Math.sqrt(l2));
    }
    if (this.sightL > 0 && this.eye) {
      // Between the lens and the head, inside the cone the head's silhouette sweeps toward the
      // camera, a tail point moves sideways (to the side it already leans, else the flare side)
      // until it clears the head on screen. It keeps its height, so it reads as the scarf
      // whipping out past a shoulder rather than as a red flame over the beanie.
      const w = this.vC.subVectors(p, this.eye.position);
      const along = w.dot(this.sightU);
      if (along > 0.3 && along < this.sightL + 0.1) {
        const ox = w.dot(this.sightS);
        const oy2 = Math.max(0, w.lengthSq() - along * along - ox * ox);
        const r = (HEAD_VIEW_R * along) / this.sightL;
        if (ox * ox + oy2 < r * r) {
          const s = Math.abs(ox) > 0.02 ? Math.sign(ox) : this.sightSide;
          p.addScaledVector(this.sightS, s * Math.sqrt(r * r - oy2) - ox);
        }
      }
    }
    if (this.usePlane) {
      const depth = this.vC.subVectors(p, this.planeP).dot(this.planeN);
      if (depth < 0) p.addScaledVector(this.planeN, -depth);
    }
  }

  /** Smooth each chain (Catmull-Rom) into ribbon rows, tapered and twisted along its length. */
  private buildScarf(time: number, airborne: boolean): void {
    const pos = this.tailGeo.getAttribute('position') as BufferAttribute;
    const nrm = this.tailGeo.getAttribute('normal') as BufferAttribute;
    const rows = this.rows;
    const side = this.side;
    const T = this.vA;
    const W = this.vB;
    const B = this.vC;
    const twistAmp = airborne ? 1.1 : 0.75;
    let v = 0;
    for (const t of this.tails) {
      const P = t.pts;
      for (let r = 0; r < TAIL_ROWS; r++) {
        const i = r >> 1;
        if ((r & 1) === 0) {
          rows[r].copy(P[i]);
          continue;
        }
        const p0 = P[Math.max(0, i - 1)];
        const p1 = P[i];
        const p2 = P[i + 1];
        const p3 = P[Math.min(TAIL_N - 1, i + 2)];
        // Catmull-Rom at the segment midpoint.
        rows[r].set(
          (-p0.x + 9 * p1.x + 9 * p2.x - p3.x) / 16,
          (-p0.y + 9 * p1.y + 9 * p2.y - p3.y) / 16,
          (-p0.z + 9 * p1.z + 9 * p2.z - p3.z) / 16,
        );
      }
      for (let r = 0; r < TAIL_ROWS; r++) {
        const u = r / (TAIL_ROWS - 1);
        T.subVectors(rows[Math.min(TAIL_ROWS - 1, r + 1)], rows[Math.max(0, r - 1)]);
        const tl = T.length();
        if (tl < 1e-5) T.set(0, -1, 0);
        else T.multiplyScalar(1 / tl);
        // Width runs across the direction of travel (the face catches the sky and the sun), blended
        // with the across-the-view direction so a camera low in front or to the side still sees
        // the face rather than an edge; then it banks outward and twists with the wave.
        W.copy(side).addScaledVector(T, -side.dot(T));
        if (W.lengthSq() < 1e-4) W.copy(UP).addScaledVector(T, -UP.dot(T));
        W.normalize();
        if (this.eye) {
          const A = this.vD.subVectors(this.eye.position, rows[r]).cross(T);
          const al = A.length();
          if (al > 1e-4) W.addScaledVector(A, (A.dot(W) < 0 ? -1 : 1) / al).normalize();
        }
        B.crossVectors(T, W);
        // A standing half twist along the length (a flat ribbon read as a board) plus a travelling one.
        const th = t.sign * (0.3 + 0.5 * u) + Math.sin(time * 9 + t.phase - u * 6.5) * twistAmp * u;
        const c = Math.cos(th);
        const s = Math.sin(th);
        W.multiplyScalar(c).addScaledVector(B, s);
        B.crossVectors(W, T);
        const hw = 0.5 * tailWidth(u) * this.scarfLook.width;
        const p = rows[r];
        pos.setXYZ(v, p.x - W.x * hw, p.y - W.y * hw, p.z - W.z * hw);
        pos.setXYZ(v + 1, p.x + W.x * hw, p.y + W.y * hw, p.z + W.z * hw);
        nrm.setXYZ(v, B.x, B.y, B.z);
        nrm.setXYZ(v + 1, B.x, B.y, B.z);
        v += 2;
      }
    }
    // The tassels: thin strands fanned off each tip along its last run, drooping a little (collapsed to a
    // point when the scarf has none).
    const fringe = this.scarfLook.tassels;
    let tv = 2 * TAIL_ROWS * 2;
    for (let k = 0; k < 2; k++) {
      const end = (k * TAIL_ROWS + TAIL_ROWS - 1) * 2;
      const lx = pos.getX(end);
      const ly = pos.getY(end);
      const lz = pos.getZ(end);
      const rx = pos.getX(end + 1);
      const ry = pos.getY(end + 1);
      const rz = pos.getZ(end + 1);
      // The run of the tip (this tail's last two rows), recomputed from the ribbon itself.
      const px = (pos.getX(end - 2) + pos.getX(end - 1)) / 2;
      const py = (pos.getY(end - 2) + pos.getY(end - 1)) / 2;
      const pz = (pos.getZ(end - 2) + pos.getZ(end - 1)) / 2;
      const ex = (lx + rx) / 2;
      const ey = (ly + ry) / 2;
      const ez = (lz + rz) / 2;
      let dx = ex - px;
      let dy = ey - py;
      let dz = ez - pz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl;
      dy /= dl;
      dz /= dl;
      const nx = nrm.getX(end);
      const ny = nrm.getY(end);
      const nz = nrm.getZ(end);
      for (let j = 0; j < TASSELS; j++) {
        if (!fringe) {
          for (let q = 0; q < 3; q++) {
            pos.setXYZ(tv + q, ex, ey, ez);
            nrm.setXYZ(tv + q, nx, ny, nz);
          }
          tv += 3;
          continue;
        }
        const f0 = j / TASSELS;
        const f1 = (j + 0.72) / TASSELS;
        const fm = (f0 + f1) / 2;
        const spread = (fm - 0.5) * 0.9;
        const len = TASSEL_L * (0.85 + 0.3 * ((j * 37 + k * 11) % 5) / 4) * this.scarfLook.length;
        const wave = Math.sin(time * 14 + j * 1.7 + k) * 0.015;
        const bx = lx + (rx - lx) * fm;
        const by = ly + (ry - ly) * fm;
        const bz = lz + (rz - lz) * fm;
        pos.setXYZ(tv, lx + (rx - lx) * f0, ly + (ry - ly) * f0, lz + (rz - lz) * f0);
        pos.setXYZ(tv + 1, lx + (rx - lx) * f1, ly + (ry - ly) * f1, lz + (rz - lz) * f1);
        pos.setXYZ(tv + 2, bx + dx * len + (rx - lx) * spread + nx * wave, by + dy * len - 0.025 + (ry - ly) * spread + ny * wave, bz + dz * len + (rz - lz) * spread + nz * wave);
        for (let q = 0; q < 3; q++) nrm.setXYZ(tv + q, nx, ny, nz);
        tv += 3;
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
  }
}
