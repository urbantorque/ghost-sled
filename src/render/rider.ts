import { AdditiveBlending, AlwaysStencilFunc, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Euler, Group, InstancedBufferAttribute, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, ReplaceStencilOp, ShaderMaterial, Vector2, Vector3 } from 'three';
import { FLOW_HEX } from '../game/beats';
import { type HatId, type ScarfDef, SCARVES } from '../game/garage';
import { Course } from '../sim/course';
import { reduced } from '../ui/motion';
import { inRock, visualGround } from './ground';
import { ghostStencil, makeToonMaterial, shared, type ToonOptions } from './materials';
import { RIDER_COLORS, RIDER_NECK, SCARF_KNOT, type SledSeat, ghostRiderGeometry, paintSled, riderArmGeometry, riderHeadGeometry, riderTorsoGeometry, sledGeometry, sledGeometryFor, sledSeat, withSway } from './meshes';

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
}

/** A reaction the rider plays once: a look at a ghost going by, a fist pump (or both arms) for one it
 *  went by, and the head shaken and the snow brushed off after a tumble. */
export type RiderCue = 'look' | 'pump' | 'cheer' | 'dust';

/** The moments that take over the rider's pose. */
export interface RiderAct {
  /** A wipeout's roll: 0 riding, else 0 to 1 through it. */
  tumble: number;
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
}

/** A frame of the finish celebration: how far it stands (0 to 1) and rises, its torso's and head's
 *  turn, the round sled's spin, the seconds since the line, first place, whether its sled has a deck
 *  to stand on, and how far the celebration has taken over from the arms-up V. */
interface Celebration {
  stand: number;
  lift: number;
  yaw: number;
  look: number;
  sledSpin: number;
  t: number;
  champ: boolean;
  deck: boolean;
  k: number;
}

/** How long each reaction plays (s). */
const CUE_S: Record<RiderCue, number> = { look: 1.25, pump: 0.95, cheer: 1.2, dust: 1.55 };

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
const TAIL_SEG = [0.165, 0.135];
/** Ribbon width at its fullest; pinched where it leaves the knot, then tapering to a narrow tip (a
 *  tip as wide as the middle read as a paddle). */
const TAIL_W = 0.27;
function tailWidth(u: number): number {
  const s = Math.min(1, u / 0.18);
  return TAIL_W * (0.5 + 0.5 * s * s * (3 - 2 * s)) * (1 - 0.7 * Math.pow(u, 1.4));
}
/** Height of the rider's middle above the sled base: flips turn about it, as a real rider's do.
 *  Turning about the runners swung a flipping rider's head a full body length below the sled and
 *  toward the chase camera, out of the bottom of the frame. */
const FLIP_PIVOT = 0.5;
/** Steepest climb of a tail segment above level: sin and cos of 30 degrees. */
const SCARF_MAX_RISE = 0.5;
const SCARF_MAX_RUN = Math.sqrt(3) / 2;
/** The head and beanie as the camera sees them (neck space): the tails keep out of the cone it
 *  sweeps toward the lens, so the scarf never covers the head, however the rider is posed. */
const HEAD_VIEW = new Vector3(0, 0.97 - RIDER_NECK.y, 0);
const HEAD_VIEW_R = 0.37;
/** Spheres the tails slide around instead of passing through the rider: the torso (body-pivot
 *  space) and the head with its ear flaps (neck space). */
const COLLIDERS: Array<[Vector3, number]> = [
  [new Vector3(0, 0.34, 0.02), 0.27],
  [new Vector3(0, 0.86 - RIDER_NECK.y, 0), 0.3],
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
  [0.05, 0.32],
  [0.1, 0.16],
];
/** A scarf's tassels: strands at each tip, and how long they hang. */
const TASSELS = 4;
const TASSEL_L = 0.11;
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
        vA = aEcho;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
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
export const WRECK_SLED = { right: 0.9, away: 0.72, side: 1 };

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
}

/** Secondary motion in the vertex shader (presentation only, no extra draw): vertices weighted by
 *  meshes.ts's aSway take the pom-pom's spring offset (x) and the coat hem's flutter (y). The hem
 *  flares a little and ripples round its rim, more at the back, so at speed the coat reads as cloth
 *  in the wind rather than a moulded shell. */
function addSway(m: ShaderMaterial, u: RiderUniforms): void {
  m.uniforms.uPom = u.pom;
  m.uniforms.uHem = u.hem;
  m.uniforms.uStand = u.stand;
  const at = '#include <begin_vertex>';
  if (!m.vertexShader.includes(at)) {
    console.warn('rider material: vertex anchor not found, secondary motion disabled');
    return;
  }
  m.vertexShader =
    'attribute vec2 aSway;\nuniform vec3 uPom;\nuniform float uHem;\nuniform float uStand;\n' +
    m.vertexShader.replace(
      at,
      /* glsl */ `${at}
        transformed += max(aSway.x, 0.0) * uPom;
        // Standing up on the sled: the legs out in front swing down about the hips (a quarter turn),
        // and each boot turns back about its ankle first, so its sole stays flat on the deck.
        if (aSway.x < -0.5 && uStand > 0.0) {
          float sa = sin(-1.5708 * uStand);
          float ca = cos(-1.5708 * uStand);
          vec3 hipP = vec3(0.0, 0.05, -0.02);
          vec3 ank = vec3(0.0, -0.015, -0.55);
          vec3 q = transformed - hipP;
          vec3 nq = objectNormal;
          if (aSway.x < -1.5) {
            q -= ank;
            q.yz = vec2(q.y * ca + q.z * sa, q.z * ca - q.y * sa);
            nq.yz = vec2(nq.y * ca + nq.z * sa, nq.z * ca - nq.y * sa);
            q += ank;
          }
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
        }`,
    );
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
function riderMaterial(opts: ToonOptions, u: RiderUniforms, sunRim: number, horizonRim: number, sway = false): ShaderMaterial {
  // Props dissolve within about 3 m of the lens; the chase camera now rides closer than that on a
  // hard landing, which screen-doored the whole rider. The rider only gives way to a lens inside it.
  const m = makeToonMaterial({ nearFade: [0.25, 0.45], ...opts });
  riderStencil(m);
  if (sway) addSway(m, u);
  m.uniforms.uFlash = u.flash;
  m.uniforms.uFill = u.fill;
  m.uniforms.uEmber = u.ember;
  m.uniforms.uFlow = u.flow;
  m.uniforms.uFlowC = { value: FLOW_C };
  m.uniforms.uSunRim = { value: sunRim };
  m.uniforms.uHorizonRim = { value: horizonRim };
  m.uniforms.uSpirit = u.spirit;
  // The toon shader dissolves whatever sits on the sight line from the camera to the rider. The
  // rider itself must never dissolve (least of all the scarf, which streams back toward the
  // camera), so its own focus sits far overhead: that sight line runs straight up, clear of it.
  m.uniforms.uFocus = { value: new Vector3(0, 1e6, 0) };
  const before = m.fragmentShader;
  let fs = before.replace('uniform float uRimK;', 'uniform float uRimK;\n      uniform float uFlash;\n      uniform float uFill;\n      uniform float uEmber;\n      uniform vec2 uFlow;\n      uniform vec3 uFlowC;\n      uniform float uSunRim;\n      uniform float uHorizonRim;\n      uniform vec3 uSnowLit;\n      uniform vec3 uSpirit;');
  fs = fs.replace(
    'vec3 n = normalize(vNormalW);',
    `vec3 n = normalize(vNormalW);
        #ifdef DOUBLE_SIDED
          n = gl_FrontFacing ? n : -n;
        #endif`,
  );
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
        #ifdef DOUBLE_SIDED
          if (!gl_FrontFacing) col *= 0.8;
        #endif
        // The flash is a thin rim on the upright silhouette facets, so the stomp pops while the rider
        // keeps its colour: over the whole body it read as bleached, and across a pale saucer's face,
        // seen edge-on from the low camera, as the sled blown out to white.
        col = mix(col, vec3(1.5), uFlash * 0.9 * smoothstep(0.74, 0.96, riderEdge) * upright);
        // Earned flow burns in the player's own vermillion: a rim on the silhouette facets that thickens
        // and brightens as it builds (a warm edge at 0.3, a clear rim at 0.6, a hot one at full flow,
        // eased in so the first steps already show; the 'In the flow' pulse to full strength, past the
        // bloom threshold on Medium and High) and a brighter scarf, which goes HDR and blooms. On Low it
        // reads as saturated colour. Never gold and never a tint on the snow (decision 69). The results
        // fill holds it down.
        float flowE = pow(uFlow.x, 0.7);
        #ifdef DOUBLE_SIDED
          col *= 1.0 + (0.7 * flowE + 0.35 * uFlow.y) * rimCut;
        #else
          float flowK = 0.55 * flowE + uFlow.y;
          col += uFlowC * smoothstep(mix(0.55, 0.38, uFlow.x), 0.94, riderEdge) * flowK * 1.7 * rimCut;
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
          vec3 bandC = vec3(1.0, 0.62, 0.16);
          #ifdef DOUBLE_SIDED
            // The scarf keeps the player's vermillion (ART.md section 1): only a breath of the rim.
            col += spiritC * smoothstep(0.5, 0.95, riderEdge) * 0.5 * sk * rimCut;
          #else
            col = mix(col, col * 0.7 + spiritC * 0.22, 0.25 * sk);
            col += (spiritC * smoothstep(0.32, 0.92, riderEdge) * 1.5 + bandC * band * 1.1) * sk * rimCut;
          #endif
        }
        `;
  const anchor = fs.includes('col = lanternLight(col, base, vWorldPos, n);') ? 'col = lanternLight(col, base, vWorldPos, n);' : 'col = fogged(col, vWorldPos);';
  fs = fs.replace(anchor, rim + anchor);
  if (fs === before || !fs.includes('inkK')) console.warn('rider material: toon shader anchors not found, rider shading partly disabled');
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
  private readonly u: RiderUniforms = { flash: { value: 0 }, fill: { value: 0 }, ember: { value: 0 }, flow: { value: new Vector2() }, pom: { value: new Vector3() }, hem: { value: 0 }, stand: { value: 0 }, spirit: { value: new Vector3(0, 0, 1) } };
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

  constructor() {
    const mat = riderMaterial({ coolShade: 0.5, rim: 0.4 }, this.u, 0.7, 0.75, true);
    this.mat = mat;
    this.sled = new Mesh(withSway(sledGeometry()), mat);
    this.sitGeo = riderTorsoGeometry();
    this.body = new Mesh(this.sitGeo, mat);
    const headGeo = riderHeadGeometry().translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z);
    const head = new Mesh(headGeo, mat);
    this.head = head;
    this.neck.position.copy(RIDER_NECK);
    this.neck.add(head);
    const armGeo = riderArmGeometry();
    this.armL.add(new Mesh(armGeo, mat));
    this.armR.add(new Mesh(armGeo, mat));
    this.armL.position.set(-0.27, 0.56, 0.0);
    this.armR.position.set(0.27, 0.56, 0.0);
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
    this.crashArmL.add(new Mesh(armGeo, mat));
    this.crashArmR.add(new Mesh(armGeo, mat));
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
    const echoGeo = ghostRiderGeometry(false, sledSeat(0));
    echoGeo.setAttribute('aEcho', this.echoA);
    this.echo = new InstancedMesh(echoGeo, echoMaterial(), ECHO_LAGS.length);
    this.echo.count = 0;
    this.echo.visible = false;
    this.echo.frustumCulled = false;
  }

  /** The garage's hat (garage.ts): the head and the wreck's head are rebuilt wearing it. */
  setHat(id: HatId): void {
    if (id === this.hat) return;
    this.hat = id;
    const geo = riderHeadGeometry(false, id).translate(-RIDER_NECK.x, -RIDER_NECK.y, -RIDER_NECK.z);
    this.head.geometry.dispose();
    this.head.geometry = geo;
    this.crashHead.geometry = geo;
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
    s.x = Math.max(0, Math.min(1, k));
    s.z = calm ? 0.35 : 1;
    this.echoOn = echoes && !this.crash;
  }

  /** Keeps the rig's pose for the after-images and places them, a few hundredths of a second behind. */
  private tickEcho(time: number): void {
    const k = this.u.spirit.value.x;
    if (k <= 0.02 || !this.echoOn) {
      this.echo.visible = false;
      this.echoN = 0;
      return;
    }
    if (this.echoSeat !== this.sledId && this.sledId >= 0) {
      // The images sit the rider as this sled seats it.
      this.echoSeat = this.sledId;
      const g = ghostRiderGeometry(false, sledSeat(this.sledId));
      g.setAttribute('aEcho', this.echoA);
      this.echo.geometry.dispose();
      this.echo.geometry = g;
    }
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
    const geo = withSway(paintSled(sledGeometryFor(id), this.paintHex));
    this.sled.geometry.dispose();
    this.sled.geometry = geo;
    (this.crashSled.children[0] as Mesh).geometry = geo;
    this.seat = sledSeat(id);
    this.body.geometry = this.seat.crossLegged ? (this.crossGeo ??= riderTorsoGeometry(true)) : this.sitGeo;
    this.bodyPivot.position.set(0, this.seat.y, this.seat.z);
    // Leaning over a saucer's rim the head sank behind the shoulders: from behind the rider read as
    // a navy obelisk with no head. There the neck rises about 0.15 m.
    this.headLift = this.seat.crossLegged ? 0.15 : 0.03;
  }

  /** Objects to add to the scene (scarf and crash parts live in world space). */
  get objects(): Object3D[] {
    return [this.root, this.scarf, this.crashBody, this.crashSled, this.stars, this.echo];
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
    // Hang the tails down the back; the first update carries them to the knot.
    this.anchor.copy(pos).add(this.vA.set(0, 0.85, 0.35));
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
    const spun = tumble > 0 && !calm ? tumble : 0;
    const rollEase = 1 - (1 - spun) * (1 - spun);
    const rollSin = Math.sin(Math.PI * spun);
    if (spun > 0) this.root.position.y += Math.abs(Math.sin(Math.PI * 2.5 * spun)) * (1 - spun) * TUMBLE_BOUNCE;
    this.tickCue(act, dt);
    const cel = this.celebrate(p, calm);
    // Tilt the whole rig to the ground normal when grounded; level out in the air.
    const n = p.airborne ? UP : p.normal;
    this.tmpQ.setFromUnitVectors(UP, n);
    this.tilt.quaternion.slerp(this.tmpQ, Math.min(1, dt * (p.airborne ? 4 : 14)));
    // (A round sled spins under its rider over the line.)
    this.yaw.rotation.set(0, -(p.heading + p.airYaw) + rollSin * 1.3 + this.grindK * GRIND_YAW + cel.sledSpin, 0);
    const wob = p.wobble > 0 ? Math.sin(time * 38) * 0.08 * Math.min(1, p.wobble / 20) : 0;
    this.flip.rotation.set(-p.airPitch - rollEase * Math.PI * 2 * TUMBLE_TURNS, 0, 0);
    // The sled banks a little; most of the carve lean comes from the hips (below), so the rider bends
    // into the turn rather than tipping over as one rigid block with its sled.
    // (A rail's balance sways it side to side; a tumble throws it over.)
    this.leanG.rotation.set(0, 0, -p.lean * 0.2 + wob + rollSin * 0.8 + (calm ? 0 : Math.sin(time * 11) * 0.05 * this.grindK));

    // Body pose. A perfect landing squashes the torso and legs flat on touchdown (0.7 tall, 1.25
    // wide) and holds it for about 150 ms, springs back through a stretch, and rides the landing out
    // in a deep crouch with the arms flung up and out, released over most of a second. The head keeps
    // its own size and pops up out of the squash: squashed with the body it sank into the shoulders.
    // A squash that sprang straight back read as no squash at all: caught a tenth of a second after
    // touchdown the pose looked like normal riding.
    const lt = this.landT;
    const sq = lt < 0.15 ? 1 : 1 - smooth((lt - 0.15) / 0.1);
    const rebound = lt > 0.15 && lt < 0.42 ? Math.sin((Math.PI * (lt - 0.15)) / 0.27) : 0;
    const stomp = lt < 0.9 ? (lt < 0.05 ? lt / 0.05 : 1 - smooth((lt - 0.3) / 0.6)) : 0;
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
    const lean = this.leanS + this.wallS * 0.85 + inside * dk * (0.12 + 0.1 * (p.driftCharge ?? 0));
    const bob = this.bobY + this.chatY;
    const speedTuck = this.tuckK;
    const crouch = Math.max(p.crouch, stomp * 0.85, speedTuck * 0.62, this.grindK * 0.8, load, tumble > 0 && calm ? 1 : 0) * (1 - fin);
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
    const pitch = (-0.15 - this.seat.lean - crouch * 0.3 - load * 0.14 - dk * 0.06 - tuck * 0.35 - stomp * 0.2 - speedTuck * 0.14 + Math.min(0, bob) * 1.6) * (1 - fin * 0.85) * (1 - cel.stand);
    this.bodyPivot.rotation.set(pitch + rollSin * 0.5, -this.twist - this.grindK * GRIND_YAW * 0.7 + cel.yaw + this.cueTwist, -lean * 0.26 + this.cueRoll);
    // (A tumble throws the body up off the sled; over the line it may hop up to stand on it.)
    this.bodyPivot.position.y = this.seat.y - crouch * 0.08 - load * 0.05 - dk * 0.025 - stomp * 0.05 + bob + rollSin * 0.2 + (calm ? 0 : fin * (1 - cel.stand) * Math.abs(Math.sin(time * 3.4)) * 0.05) + cel.lift;
    // The hips slide a little to the inside of the carve: the weight goes where the turn is.
    this.bodyPivot.position.x = Math.max(-0.05, Math.min(0.05, lean * 0.045));
    const sx = 1 + sq * 0.25 - rebound * 0.04;
    const sy = 1 - sq * 0.3 + rebound * 0.08;
    this.bodyPivot.scale.set(sx, sy, sx);
    this.neck.scale.set(1 / sx, 1 / sy, 1 / sx);
    this.neck.position.set(RIDER_NECK.x, (RIDER_NECK.y + this.headLift) * (1 + (1 / sy - 1) * 0.75), RIDER_NECK.z);
    // The head holds toward upright as the torso pitches forward, chin a little up, so the face and
    // beanie stay above the shoulder line (the roll is countered once the lean is capped, below).
    // A reaction turns it on the neck (a look, a nod, a shake), and loading for a lip lifts the chin.
    this.neck.rotation.set(-(pitch + 0.15) * 0.7 + 0.06 + stomp * 0.12 + load * 0.12 + this.cueNod, this.cueYaw + cel.look, 0);
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
    // Each arm on its own from here (x: swung forward, o: out from the side, + away from the body).
    const arm = this.arms;
    arm[0] = armX + armSwing;
    arm[1] = armOut;
    arm[2] = armX - armSwing;
    arm[3] = armOut;
    // Loading: both arms drawn back past the hips.
    if (load > 0.001) for (let k = 0; k < 4; k += 2) {
      arm[k] += (-0.6 - arm[k]) * load;
      arm[k + 1] += (0.4 - arm[k + 1]) * load;
    }
    // Drifting: the inside mitt reaches down toward the snow, the outside arm goes up and out.
    if (dk > 0.001) {
      const i = inside > 0 ? 2 : 0;
      const o = 2 - i;
      arm[i] += (0.2 - arm[i]) * dk;
      arm[i + 1] += (1.0 + 0.15 * (p.driftCharge ?? 0) - arm[i + 1]) * dk;
      arm[o] += (0.55 - arm[o]) * dk;
      arm[o + 1] += (1.45 - arm[o + 1]) * dk;
    }
    this.cueArms(arm, calm, (1 - fin) * (1 - stomp) * (tumble > 0 ? 0 : 1) * (1 - 0.6 * tuck));
    this.celebrateArms(arm, cel);
    // Balancing a carve: the outside arm reaches out and up, the inside one tucks in, more while the
    // body is still catching up with the sled's bank (the lag between them).
    const bal = Math.max(-1, Math.min(1, lean * 0.9 + (p.lean - lean) * 1.4)) * (1 - air) * (1 - stomp) * (1 - fin) * (1 - dk);
    this.armL.rotation.set(arm[0], 0, -arm[1] + p.lean * 0.15 - Math.max(0, bal) * 0.5);
    this.armR.rotation.set(arm[2], 0, arm[3] + p.lean * 0.15 - Math.min(0, bal) * 0.5);

    this.root.updateMatrixWorld(true);
    const roll = p.airborne ? 0 : this.capLean(p.heading + p.airYaw);
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
    this.planeP.copy(p.pos).addScaledVector(p.normal, 0.26);
    this.updateScarf(dt, time, p.vel, p.airborne, p.heading + p.airYaw);
    this.u.spirit.value.y = p.pos.y;
    this.tickEcho(time);
  }

  /** This frame's arms: left swing, left out, right swing, right out (radians). */
  private arms = new Float32Array(4);
  /** This frame's reaction on the head and shoulders: the head's turn and nod, the torso's turn and roll. */
  private cueYaw = 0;
  private cueNod = 0;
  private cueTwist = 0;
  private cueRoll = 0;
  /** This frame's finish celebration (celebrate()). */
  private cel: Celebration = { stand: 0, lift: 0, yaw: 0, look: 0, sledSpin: 0, t: 0, champ: false, deck: false, k: 0 };

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
        }
      }
    }
    this.cueYaw = this.cueNod = this.cueTwist = this.cueRoll = 0;
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
      // A look at it over the shoulder on its side: the head turns most of the way (far enough that
      // the face shows in profile from behind), the shoulders a little.
      const w = env(t, 0.18, 0.8, CUE_S.look);
      this.cueYaw = -s * (calm ? 0.9 : 1.35) * w;
      this.cueTwist = -s * 0.3 * w;
    } else if (r === 'pump') {
      // Nods in time with the pump.
      const w = env(t, 0.12, 0.65, CUE_S.pump);
      this.cueNod = calm ? -0.06 * w : -0.15 * Math.max(0, Math.sin(t * tau * 2.6)) * w;
    } else if (r === 'cheer') {
      this.cueNod = 0.14 * env(t, 0.12, 0.9, CUE_S.cheer);
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
  }

  /** The reaction's arms, over the riding pose by weight `w` (a stomp, a tuck or the finish hold them
   *  down): one fist pumped up on the side away from the ghost it passed, or both arms; after a
   *  tumble, the right mitt brushing the snow off the left shoulder and chest. */
  private cueArms(arm: Float32Array, calm: boolean, w: number): void {
    const r = this.react;
    if (!r || w <= 0.001) return;
    const t = this.reactT;
    const tau = Math.PI * 2;
    const to = (i: number, x: number, o: number, k: number) => {
      arm[i] += (x - arm[i]) * k;
      arm[i + 1] += (o - arm[i + 1]) * k;
    };
    if (r === 'pump') {
      to(this.reactSide > 0 ? 0 : 2, 0.25, 2.75 + (calm ? 0 : Math.sin(t * tau * 2.6) * 0.22), env(t, 0.12, 0.65, CUE_S.pump) * w);
    } else if (r === 'cheer') {
      const k = env(t, 0.12, 0.9, CUE_S.cheer) * w;
      to(0, 0.3, 2.45 + (calm ? 0 : Math.sin(t * tau * 2.4) * 0.22), k);
      to(2, 0.3, 2.45 + (calm ? 0 : Math.sin(t * tau * 2.4 + 2) * 0.22), k);
    } else if (r === 'dust') {
      // Both mitts slap the snow off the coat's sides in turn, out and in, where the lens behind sees
      // them (a mitt brushing the chest hid behind the back, and the toy's arms never reach its beanie).
      const k = env(t - 0.7, 0.12, 0.65, 0.85) * w;
      const ph = (t - 0.7) * tau * (calm ? 1 : 3.2);
      const amp = calm ? 0.15 : 0.42;
      to(0, 0.1, 0.55 + amp * Math.sin(ph), k);
      to(2, 0.1, 0.55 + amp * Math.sin(ph + Math.PI), k);
    }
  }

  /** Over the line (real seconds since it, act.finT): arms up in a V at once; then on a sled with a
   *  deck it hops up to stand on it (from 0.8 s), and a round sled spins under its rider instead.
   *  First place throws both fists up in turn and turns a full circle in the air; any other place
   *  waves to the crowd on the lens's side with the other hand on its hip. Reduced motion stays seated
   *  and still: arms up for first place, out wide for any other (standing, the stopped rider filled
   *  the chase lens that reduced motion keeps through the results). */
  private celebrate(p: RiderPose, calm: boolean): Celebration {
    const c = this.cel;
    const a = p.act;
    c.stand = c.lift = c.yaw = c.look = c.sledSpin = c.k = 0;
    const deck = calm ? undefined : STAND_DECK[this.sledId];
    c.deck = deck !== undefined;
    if (!a?.finish || this.finK < 0.01) {
      this.u.stand.value = 0;
      this.waveSide = 0;
      return c;
    }
    const t = a.finT ?? 0;
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    c.t = t;
    c.champ = a.rank === 1;
    if (deck !== undefined) {
      c.stand = smooth((t - 0.8) / 0.32);
      c.lift = (deck + 0.59 - this.seat.y) * c.stand + Math.sin(Math.PI * clamp01((t - 0.75) / 0.45)) * 0.2;
      if (c.champ) {
        const u = clamp01((t - 1.7) / 0.6);
        c.yaw = Math.PI * 2 * smooth(u);
        c.lift += Math.sin(Math.PI * u) * 0.3;
      }
    } else if (!calm) c.sledSpin = Math.PI * 2 * (c.champ ? 1.5 : 1) * smooth((t - 0.9) / (c.champ ? 1.5 : 2.2));
    this.u.stand.value = c.stand;
    c.k = smooth((t - 1.05) / 0.3);
    if (c.deck && !c.champ && c.k > 0) {
      if (this.waveSide === 0 && this.eye) {
        const h = p.heading + p.airYaw;
        this.waveSide = (this.eye.position.x - p.pos.x) * Math.cos(h) + (this.eye.position.z - p.pos.z) * Math.sin(h) >= 0 ? 1 : -1;
      }
      const s = this.waveSide || 1;
      c.look = -s * 0.45 * c.k;
      c.yaw += -s * 0.3 * c.k;
    }
    return c;
  }

  /** The celebration's arms over the arms-up V (see celebrate). */
  private celebrateArms(arm: Float32Array, c: Celebration): void {
    const k = c.k;
    if (k <= 0.001) return;
    const tau = Math.PI * 2;
    const to = (i: number, x: number, o: number) => {
      arm[i] += (x - arm[i]) * k;
      arm[i + 1] += (o - arm[i + 1]) * k;
    };
    if (c.champ) {
      // (On a round sled first place keeps the V as it spins.)
      if (!c.deck) return;
      to(0, 0.35, 2.35 + Math.max(0, Math.sin(c.t * tau * 2)) * 0.45);
      to(2, 0.35, 2.35 + Math.max(0, Math.sin(c.t * tau * 2 + Math.PI)) * 0.45);
    } else if (!c.deck) {
      to(0, 0.15, 1.55);
      to(2, 0.15, 1.55);
    } else {
      const wv = this.waveSide > 0 ? 2 : 0;
      to(wv, 0.12, 2.5 + Math.sin(c.t * tau * 1.7) * 0.38);
      to(2 - wv, -0.45, 0.7);
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
  }

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
      const m = i === 0 ? e : hE;
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
      const gy = visualGround(course, c.bodyPos.x, -c.bodyPos.z) + 0.1;
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
      spot.y = visualGround(course, spot.x, -spot.z) + 0.3 + 0.3 * Math.min(1, steep);
      c.sledPos.lerpVectors(c.sledFrom, spot, k);
      c.sledVel.set(0, 0, 0);
      this.crashSled.position.copy(c.sledPos);
      this.tmpQ.setFromUnitVectors(UP, this.vD.set(-this.slopeG.x * 0.45, 1, this.slopeG.z * 0.45).normalize());
      this.sledRestQ.setFromEuler(this.sledRestE.set(0.06, -(az + 0.5 + 0.85 * bank), Math.PI - 0.1)).premultiply(this.tmpQ);
      this.crashSled.quaternion.slerpQuaternions(c.sledQFrom, this.sledRestQ, k);
    } else {
      step(c.bodyPos, c.bodyVel, this.crashBody, c.spin, 0.3);
      step(c.sledPos, c.sledVel, this.crashSled, c.sledSpin, 0.12);
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
      s.scale.setScalar(pop * (0.85 + 0.15 * Math.sin(t * 7 + i * 2.1)));
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
      t.pts[0].copy(this.stepAnchor).addScaledVector(side, t.sign * this.flareSide * 0.04);
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
