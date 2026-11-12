import { Color, Vector3 } from 'three';
import { Mood } from '../sim/chaos';
import type { Course, SectionKind } from '../sim/course';
import { BiomeId } from '../sim/mountains';

// Per-biome base palettes (Clear Skies) and per-mood overrides. See ART.md section 7.

export interface Palette {
  skyZenith: Color;
  skyHorizon: Color;
  /** Colour the gradient passes through halfway up; null blends zenith and horizon evenly. */
  skyMid: Color | null;
  /** The bright band hugging the horizon: its colour (null: the horizon's own, a shade brighter), how
   *  fast it fades upward (higher is thinner) and how strong it is. Apart from skyHorizon because that
   *  colour also feeds the haze, the sea and the glazed snow's mirror. */
  skyBand: { color: Color | null; fade: number; k: number };
  /** Sine of the elevation where the zenith colour is reached (lower = the zenith comes down sooner). */
  skySpread: number;
  /** Gradient curve: below 1 holds the zenith colour longer, above 1 holds the horizon colour. */
  skyCurve: number;
  skyBelow: Color;
  sunColor: Color;
  /** Direction the key light comes from (lighting and shadows). */
  sunDir: Vector3;
  /** Where the sun or moon disc is drawn. Kept lower than the light for silhouettes: a stylised
   *  cheat so downhill slopes stay lit while the disc sits near the horizon. */
  diskDir: Vector3;
  /** The key light is lifted to at least this elevation (degrees) above the disc. */
  lightMin: number;
  /** Where cast shadows fall from (derived, see shadowFrom): the key light swung further across the
   *  slope and lowered, so tree and prop shadows rake across the run toward the lens. */
  shadowDir: Vector3;
  /** Degrees the shadow light swings further across the slope than the key light, and the lowest
   *  elevation it drops to. */
  shadowSwing: number;
  shadowMinEl: number;
  sunSize: number;
  sunGlow: number;
  /** Brightness of the sun or moon disc itself (0 hides it; the light and its glow stay). */
  sunDisc: number;
  /** 0 is a crisp disc in a clear sky, 1 a sun diffused behind a cloud deck: soft-edged and wide. */
  sunSoft: number;
  /** The disc's hot core (values over 1 bloom). White-hot by default; Clear Skies colours its own suns,
   *  so Frostfang's reads lemon and Ember's a dim orange through the smoke. */
  sunCore: Color;
  /** How much of the sun's own colour the corona takes, over its stock warm gold (0..1). */
  sunTint: number;
  snowLit: Color;
  snowShade: Color;
  snowDeep: Color;
  rim: Color;
  fog: Color;
  fogNear: number;
  fogFar: number;
  hemiSky: Color;
  tall: Color;
  tallDark: Color;
  low: Color;
  lowLit: Color;
  accentProp: Color;
  ghost: Color;
  /** Ghost glow for GhostVisuals.setGlow: above 1 the ghosts blaze (Blizzard). */
  ghostGlow: number;
  /** Distant ridge colours, farthest (palest) first: three atmospheric value steps. */
  ridge: [Color, Color, Color];
  /** Night moods: a moonlit mist pooled in the valleys between the ridge layers (sky.ts), and how
   *  dense it is. Null for none. */
  mist: Color | null;
  mistK: number;
  /** The mountain panorama (massif.ts): the biome's hero peak, the colour of its bare rock, the
   *  alpenglow that paints the snow on the summits (its colour, how strongly, and the height in metres
   *  relative to the lens above which the peaks still catch the light: the valleys sink into shade
   *  first), how much of the panorama a mood veils (Blizzard hides it), how full the sea of clouds
   *  below the horizon is, the volcano's crater glow, the hero's own light (flow: lava streams down the
   *  volcano, glacier ice lit from within on the fang), and its bearing in degrees (0: the far side of
   *  the fall line from the sun, as chaos moods have it. Clear Skies pins it per mountain, so a sun
   *  moving through a run never makes the mountain jump sides). seaIce 1 reads the sea's white as a
   *  snowfield on the valley floor and its openings as frozen lakes that hold still (Pinecrest's Clear
   *  Skies); 0 keeps them gaps in a sea of cloud. */
  massif: { peak: HeroPeak; rock: Color; glow: Color; glowK: number; glowLine: number; veil: number; sea: number; lava: number; flow: number; heroAz: number; seaIce: number };
  /** grain: film grain strength (night moods run light, where grain reads as digital noise in the
   *  dark). foot: how much the bottom edge of the frame darkens and cools (see post.ts). */
  grade: Grade;
  /** The living sky and air (sky.ts, massif.ts): crepuscular rays fanning from a low sun through the
   *  clouds, the 22 degree halo and sun dogs of ice-crystal air, shooting stars, a snow banner blown off
   *  the hero summit, a distant avalanche down its face, cloud shadows sweeping the panorama, the
   *  valley mist layers drifting below the run, and how much the ground mist drifts and pools. */
  atmo: { rays: number; halo: number; meteors: number; banner: number; slide: number; sweep: number; valley: number; valleyColor: Color; drift: number };
  /** Painted gouache clouds in the sky dome (sky.ts): low cumulus banks along the horizon and high
   *  wisps (coverage 0..1 each), their sunlit tops, shaded bodies and the low sun's rim on their edges.
   *  shadow: how strongly their slow shadows drift over the snow (materials.ts, 0 for none). */
  clouds: { low: number; high: number; top: number; lit: Color; shade: Color; rim: Color; shadow: number };
  /** A ceiling of cloud across the whole dome (sky.ts): k is its cover (0 none, 1 unbroken), lit and
   *  shade its billows, glow the light on its underside, strongest low in the sky toward the hero. */
  deck: { k: number; lit: Color; shade: Color; glow: Color };
  /** Round 7, the air between the planes (materials.ts fogColor, midground.ts, massif.ts). far: what the
   *  haze turns to with distance, so the far plane is the mountain's blue (or its own air) and not only a
   *  paler near plane; cool: what the air is multiplied by looking away from the sun; low: how much thicker
   *  it lies below the lens (the valleys fill first); scatter: the sun's forward scatter in it. */
  air: { far: Color; cool: Color; low: number; scatter: number };
  /** A second key light on the snow, moving (Frostfang's aurora): its colour, its strength (0: none), and
   *  what the shade between its curtains turns to. */
  key2: { color: Color; k: number; shade: Color };
  /** Light from below (Ember's lava and caldera): colour and strength. */
  under: { color: Color; k: number };
  /** How strongly lamps, windows, lanterns and lava light the world (lights.ts): about 0.2 at noon, 1 at
   *  night. */
  lamps: number;
  /** How much a canopy glows with the light behind it (Sakura's blossom). */
  leaf: number;
  /** A sled lantern short of Lantern Night's (0..1): blue hour lights a soft one at the end of a long
   *  Clear Skies run. Lantern Night's own lantern (lantern: true) is always full. */
  lanternGlow: number;
  bloom: number;
  stars: number;
  aurora: number;
  moon: boolean;
  /** 0 is a full moon, 1 a thin crescent. */
  moonPhase: number;
  comet: boolean;
  lantern: boolean;
  snowfall: number;
  windStreaks: number;
  petals: number;
  embers: number;
  wisps: number;
  sparkle: number;
  ice: number;
  /** Value multiplier on hazards (1 = as authored); Glass Ice darkens them so danger stays darkest. */
  hazardDim: number;
  /** Gifts glow marigold from within and hold through the fog (low-visibility moods), and grow by a
   *  fifth so the trail still reads at a distance. */
  giftGlow: number;
  /** Cast-shadow strength (1 = full; Blizzard's flat diffuse light keeps only faint, soft shadows). */
  shadowK: number;
  /** How much the fog swallows hazards (1 = like everything else); low-visibility moods keep dangers
   *  dark, hard shapes in the murk. */
  hazardFog: number;
  exposure: number;
}

/** The frame's finish (post.ts GradeParams reads these by name). Round 7 adds the film curve's strength
 *  (tone), the place's exposure, and a split tone of its own: what the lit values (hi) and the shade (lo)
 *  lean to, as near-white colours. getPalette fills the four in where a mood leaves them out. */
export interface Grade {
  lift: Color;
  gain: Color;
  saturation: number;
  contrast: number;
  grain: number;
  foot: number;
  shafts: number;
  lens: number;
  focal: number;
  gust: number;
  glitter: number;
  focalDir?: Vector3;
  tone?: number;
  exposure?: number;
  hi?: Color;
  lo?: Color;
}

/** The film curve's numbers, in one place: the composite pass compiles them into its shader (post.ts) and
 *  Low, which has no post pass, bakes the same curve into its colours (filmValue below). Scene values run
 *  straight through the mid-tones; under `knee` a short toe deepens the darks by up to `toe`; over it a
 *  shoulder climbs toward `white` and never reaches it, so the brightest snow stops short of paper white. */
export const FILM = { knee: 0.45, white: 0.98, toe: 0.18 };

/** The film curve on one value (the GLSL filmCurve in post.ts, line for line). */
export function filmValue(x: number): number {
  const { knee: K, white: W, toe: T } = FILM;
  if (x < K) {
    const t = 1 - x / K;
    return x - T * x * t * t;
  }
  return K + (W - K) * (1 - Math.exp(-(x - K) / (W - K)));
}

/** Each biome's signature mountain (massif.ts): a classic snow-capped summit, an ice fang, a
 *  smoking volcano or a symmetrical snow-capped cone. */
export type HeroPeak = 'summit' | 'fang' | 'volcano' | 'cone';

const c = (hex: string) => new Color(hex);

/** Where Comet Night's comet hangs (sky.ts draws it; the post pass's light pass centres on it). */
export const COMET_DIR = new Vector3(0.0, 0.165, -0.986).normalize();

function sunDir(azimuthDeg: number, elevationDeg: number): Vector3 {
  // Azimuth 0 = straight down the course (-z in three.js), positive = toward +x (right).
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

function base(): Palette {
  return {
    skyZenith: c('#2B4C9B'),
    skyHorizon: c('#FFB38A'),
    skyMid: c('#B88EB4'),
    skyBand: { color: null, fade: 28, k: 0.6 },
    skySpread: 0.68,
    skyCurve: 0.6,
    skyBelow: c('#C9B7E0'),
    sunColor: c('#FFEAD6'),
    sunDir: sunDir(-24, 25),
    diskDir: sunDir(-17, 11),
    lightMin: 24,
    shadowDir: new Vector3(0, 1, 0),
    shadowSwing: 26,
    shadowMinEl: 15,
    sunSize: 1,
    sunGlow: 1,
    sunDisc: 1,
    sunSoft: 0,
    sunCore: new Color(2.3, 2.15, 1.95),
    sunTint: 0.2,
    snowLit: c('#FFF8F2'),
    snowShade: c('#7E92DA'),
    snowDeep: c('#4757B2'),
    rim: c('#FFC9A8'),
    fog: c('#E9B9B0'),
    fogNear: 60,
    fogFar: 520,
    hemiSky: c('#8EA6E8'),
    // Spruce teal (ART.md section 7), a step greener than the shaded snow's periwinkle.
    tall: c('#1F5753'),
    tallDark: c('#133B3E'),
    low: c('#4A4063'),
    lowLit: c('#7D6E93'),
    accentProp: c('#FF4D2E'),
    ghost: c('#8FF3E4'),
    ghostGlow: 1.25,
    ridge: [c('#C8B4DE'), c('#9A8AC6'), c('#6660A6')],
    mist: null,
    mistK: 0,
    massif: { peak: 'summit', rock: c('#5A4E7A'), glow: c('#FF9AA2'), glowK: 0, glowLine: -6000, veil: 0, sea: 1, lava: 0, flow: 0, heroAz: 0, seaIce: 0 },
    grade: { lift: c('#0A0F2A'), gain: c('#FFF8F0'), saturation: 1.08, contrast: 1.04, grain: 1, foot: 0.3, shafts: 1, lens: 1, focal: 1, gust: 0, glitter: 0.15 },
    clouds: { low: 0.8, high: 0.6, top: 0.3, lit: c('#FFE6CF'), shade: c('#A48CC0'), rim: c('#FFB088'), shadow: 0.3 },
    deck: { k: 0, lit: c('#FFFFFF'), shade: c('#FFFFFF'), glow: c('#FFFFFF') },
    atmo: { rays: 1, halo: 0, meteors: 0, banner: 0.8, slide: 1, sweep: 1, valley: 0.7, valleyColor: c('#E8C4C8'), drift: 0.3 },
    air: { far: c('#9A8AC6'), cool: c('#F0F2FF'), low: 0.35, scatter: 1 },
    key2: { color: c('#58E0A8'), k: 0, shade: c('#5A46B0') },
    under: { color: c('#FF6A28'), k: 0 },
    lamps: 0.25,
    leaf: 0,
    lanternGlow: 0,
    bloom: 0.38,
    stars: 0,
    aurora: 0,
    moon: false,
    moonPhase: 0,
    comet: false,
    lantern: false,
    snowfall: 0.08,
    windStreaks: 0,
    petals: 0,
    embers: 0,
    wisps: 0,
    sparkle: 1,
    ice: 0,
    hazardDim: 1,
    giftGlow: 0,
    shadowK: 1,
    hazardFog: 1,
    exposure: 1,
  };
}

/** What the chaos moods are built on. Their looks depend on every field of this that they do not set,
 *  so a change here changes all six: Clear Skies' own light is clearSkies(), over the top of this. */
function biomeBase(biome: BiomeId): Palette {
  const p = base();
  switch (biome) {
    case 'alpine':
      return p;
    case 'glacier':
      p.skyZenith = c('#2B5FA8');
      p.skyHorizon = c('#FFD9C4');
      p.skyMid = c('#A9A8D8');
      p.skyBelow = c('#BFD3F0');
      p.sunColor = c('#FFEFE0');
      p.sunDir = sunDir(24, 15);
      p.snowLit = c('#F6FBFF');
      p.snowShade = c('#6A98D4');
      p.snowDeep = c('#3A62AA');
      p.rim = c('#FFE3D6');
      p.fog = c('#E6DCE6');
      p.hemiSky = c('#9CC2F2');
      p.tall = c('#7FD8F0');
      p.tallDark = c('#3E8FC0');
      p.low = c('#9FD6EE');
      p.lowLit = c('#D8F6FF');
      p.ridge = [c('#D0DAF0'), c('#9CB2DE'), c('#6886C4')];
      p.massif.peak = 'fang';
      p.massif.rock = c('#34508E');
      p.ice = 0.6;
      p.clouds = { low: 0.75, high: 0.6, top: 0.3, lit: c('#FFF2E8'), shade: c('#A8B2DA'), rim: c('#FFC6AE'), shadow: 0.28 };
      p.atmo.valleyColor = c('#DCDCEC');
      return p;
    case 'volcanic':
      p.skyZenith = c('#2A1E3A');
      p.skyHorizon = c('#FF8A50');
      p.skyMid = c('#8C3C5C');
      p.skyBelow = c('#6B3A44');
      p.sunColor = c('#FFB37A');
      p.sunDir = sunDir(-20, 10);
      p.snowLit = c('#F7E7E0');
      p.snowShade = c('#7A6C98');
      p.snowDeep = c('#4C3C70');
      p.rim = c('#FF9A6A');
      p.fog = c('#B9787A');
      p.hemiSky = c('#7A6A9E');
      p.tall = c('#2B2830');
      p.tallDark = c('#18161C');
      p.low = c('#3A3138');
      p.lowLit = c('#6A4B52');
      p.accentProp = c('#FF6A2A');
      p.ridge = [c('#A06878'), c('#6E465E'), c('#40284A')];
      p.massif.peak = 'volcano';
      p.massif.rock = c('#3A2A3C');
      p.massif.lava = 0.45;
      p.embers = 0.6;
      p.grade.lift = c('#14081A');
      p.clouds = { low: 0.8, high: 0.5, top: 0.3, lit: c('#FFC4A0'), shade: c('#6E4662'), rim: c('#FF8A50'), shadow: 0.3 };
      // The volcano smokes instead of flying a snow banner; its valleys hold an ashen, ember-lit haze.
      p.atmo.banner = 0;
      p.atmo.slide = 0;
      p.atmo.valleyColor = c('#C08484');
      return p;
    case 'blossom':
      p.skyZenith = c('#3A5BA8');
      p.skyHorizon = c('#FFC4D6');
      p.skyMid = c('#C49CCC');
      p.skyBelow = c('#D9C6E8');
      p.sunColor = c('#FFE6E0');
      p.sunDir = sunDir(-22, 14);
      p.snowLit = c('#FFF6F8');
      p.snowShade = c('#8792D4');
      p.snowDeep = c('#5662B2');
      p.rim = c('#FFD0DE');
      p.fog = c('#EEC6D6');
      p.hemiSky = c('#A8B6EE');
      p.tall = c('#FF9EC0');
      p.tallDark = c('#C9668E');
      p.low = c('#7B7090');
      p.lowLit = c('#A79CBB');
      p.accentProp = c('#E8473F');
      p.ridge = [c('#DEC6E6'), c('#B29BD0'), c('#8070B4')];
      p.massif.peak = 'cone';
      p.massif.rock = c('#6A5A86');
      p.massif.glow = c('#FFA0B8');
      p.petals = 0.7;
      p.clouds = { low: 0.8, high: 0.6, top: 0.3, lit: c('#FFEAF0'), shade: c('#B49CCC'), rim: c('#FFB4C6'), shadow: 0.28 };
      p.atmo.valleyColor = c('#F0CCDA');
      return p;
  }
}

/** The direction cast shadows come from. Decision 27 lifts the key light that shades the snow to
 *  at least 24 degrees, which left tree shadows short stubs under their casters that never reached
 *  the run. Shadows are only cast by props and riders (the terrain never casts), so their light can
 *  sit lower and further across the slope than the shading light: the treeline and the props in the
 *  corridor then rake long blue shadows across the run toward the lens, from the sun's side. */
function shadowFrom(light: Vector3, swingDeg: number, minElDeg: number): Vector3 {
  const az = Math.atan2(light.x, -light.z);
  const el = Math.asin(Math.max(-1, Math.min(1, light.y)));
  const swing = (Math.sign(az || -1) * swingDeg * Math.PI) / 180;
  const az2 = Math.sign(az + swing) * Math.min(Math.abs(az + swing), (72 * Math.PI) / 180);
  const el2 = Math.max((minElDeg * Math.PI) / 180, Math.min(el, el - (10 * Math.PI) / 180));
  return new Vector3(Math.sin(az2) * Math.cos(el2), Math.sin(el2), -Math.cos(az2) * Math.cos(el2)).normalize();
}

/** Light direction derived from a disc direction: same azimuth side, lifted to at least minDeg. */
function liftLight(disk: Vector3, minDeg: number): Vector3 {
  const el = Math.asin(disk.y);
  const target = Math.max(el, (minDeg * Math.PI) / 180);
  const h = Math.sqrt(1 - disk.y * disk.y) || 1;
  return new Vector3((disk.x / h) * Math.cos(target), Math.sin(target), (disk.z / h) * Math.cos(target)).normalize();
}

export function getPalette(biome: BiomeId, mood: Mood): Palette {
  const p = biomeBase(biome);
  switch (mood) {
    case Mood.None:
      clearSkies(p, biome);
      round7(p, biome);
      break;
    case Mood.Blizzard:
      p.skyZenith = c('#6D7C93');
      p.skyHorizon = c('#C9D2DE');
      p.skyMid = null;
      p.skyBelow = c('#B8C3D2');
      p.sunColor = c('#F2F1EA');
      // A pale sun glows through the cloud deck low ahead-left: a soft focal point that gives the
      // grey sky some value range. The light itself stays high and flat.
      p.sunDir = sunDir(-16, 15);
      p.lightMin = 34;
      p.sunGlow = 0.5;
      p.sunSize = 1.7;
      p.sunDisc = 0.2;
      p.sunSoft = 1;
      p.snowLit = c('#EEF2F7');
      // The shade sits about a tenth darker than the whiteout's own grey, so the foreground keeps a dark
      // anchor (at #98A6BC everything but the coat was one mid grey).
      p.snowShade = c('#8A97AE');
      p.snowDeep = c('#5F6F8E');
      p.rim = c('#DDE6F0');
      p.fog = c('#C2CCD8');
      p.fogNear = 12;
      p.fogFar = 150;
      p.hemiSky = c('#B8C4D6');
      p.ghost = c('#7FFFEA');
      // Ghosts are the brightest things in the whiteout: they blaze so they can guide you.
      p.ghostGlow = 3;
      // Gifts glow through the white too, a marigold trail you can steer for.
      p.giftGlow = 1;
      // Flat, diffuse light under the cloud deck: cast shadows keep about 40% of their strength and
      // soften (crisp long shadows contradicted the overcast), and hazards stay dark through the fog.
      p.shadowK = 0.4;
      p.hazardFog = 0.55;
      // Hazards a step darker too: a spire or serac within about 40 m must stand clearly darker than
      // the fog, a hard shape in the murk rather than a blue-grey ghost of one.
      p.hazardDim = 0.82;
      if (biome === 'glacier') {
        // Hazards stay dark, hard silhouettes in the flat grey light.
        p.tall = c('#4F84B4');
        p.tallDark = c('#25507E');
        p.low = c('#3C4C6C');
        p.lowLit = c('#5E7296');
      }
      p.ridge = [c('#BCC6D4'), c('#A8B4C6'), c('#93A2B8')];
      // The whiteout swallows the panorama: at most a ghost of the nearest range shows through.
      p.massif.veil = 0.86;
      p.massif.sea = 0;
      p.massif.lava = 0;
      p.snowfall = 1;
      p.windStreaks = 1;
      p.bloom = 0.8;
      p.sparkle = 0.3;
      p.grade = { lift: c('#20283A'), gain: c('#F2F6FF'), saturation: 0.85, contrast: 1.04, grain: 0.8, foot: 0.14, shafts: 0, lens: 0, focal: 0.6, gust: 1, glitter: 0 };
      // The whiteout is its own cloud deck: no painted banks in it and no shadows sliding over the snow.
      p.clouds = { low: 0, high: 0, top: 0.1, lit: c('#F2F4F8'), shade: c('#AEB8C8'), rim: c('#F2F1EA'), shadow: 0 };
      // Pale rays through the overcast round the hidden sun and the gusts' curtains of snow (post.ts);
      // nothing far off shows: the whiteout hides the banner, the slides and the valley.
      p.atmo = { rays: 0.7, halo: 0, meteors: 0, banner: 0, slide: 0, sweep: 0, valley: 0, valleyColor: c('#DDE3EC'), drift: 0.5 };
      break;
    case Mood.Lantern:
      p.skyZenith = c('#070B22');
      p.skyHorizon = c('#1E2B5E');
      p.skyMid = c('#0F1844');
      p.skySpread = 0.7;
      p.skyCurve = 0.7;
      p.skyBelow = c('#121A40');
      p.sunColor = c('#D2DCFF');
      // The moon hangs low enough that the run-start reveal (its lens rides high, looking down the
      // corridor) shows the whole disc in clear sky instead of cropped by the top edge by the HUD.
      p.sunDir = sunDir(25, 8);
      // A low moon off to the side puts the banks facing away from it into deep shade and rakes long
      // tree shadows across the corridor, so the snow has form.
      p.lightMin = 13;
      p.sunGlow = 0.5;
      p.sunSize = 0.8;
      p.snowLit = c('#7E92CC');
      p.snowShade = c('#3B4A86');
      p.snowDeep = c('#232C64');
      p.rim = c('#8EA0E8');
      p.fog = c('#1A2452');
      p.fogNear = 30;
      p.fogFar = 330;
      p.hemiSky = c('#2A3A78');
      p.tall = c('#14303A');
      p.tallDark = c('#0B1C24');
      p.low = c('#2A2848');
      p.lowLit = c('#4A4878');
      p.ghostGlow = 1.4;
      // At night the far ridges sit closest to the faint horizon glow (lifted toward the #1E2B5E
      // horizon), with a moonlit mist pooled in the valleys between them.
      p.ridge = [c('#3C4D8A'), c('#29376F'), c('#19234F')];
      p.mist = c('#5568AE');
      p.mistK = 0.6;
      // Moonlit snow on dark rock over a silver sea of clouds; the crater glows brighter in the dark.
      p.massif.rock = c('#161C3C');
      p.massif.sea = 0.85;
      p.massif.lava = p.massif.lava > 0 ? 1 : 0;
      p.stars = 1;
      p.aurora = 1;
      p.moon = true;
      p.lantern = true;
      p.snowfall = 0.15;
      p.bloom = 0.9;
      p.sparkle = 0.8;
      p.grade = { lift: c('#03061A'), gain: c('#E8ECFF'), saturation: 1.05, contrast: 1.06, grain: 0.4, foot: 0.2, shafts: 0, lens: 0, focal: 0.8, gust: 0, glitter: 0.25 };
      // A low, dark bank with moonlit silver edges under the aurora, which keeps the sky above it.
      p.clouds = { low: 0.6, high: 0.18, top: 0.24, lit: c('#4A5A9C'), shade: c('#121A42'), rim: c('#C4D0FF'), shadow: 0 };
      // Shooting stars under the aurora, and a moonlit mist lying in the valleys.
      p.atmo = { rays: 0, halo: 0, meteors: 1, banner: 0.45, slide: 0, sweep: 0, valley: 0.9, valleyColor: c('#4A5C9E'), drift: 0.4 };
      break;
    case Mood.GlassIce:
      p.skyZenith = c('#0E6FA8');
      p.skyHorizon = c('#BDF6FF');
      p.skyMid = c('#4AB2DE');
      p.skySpread = 0.75;
      p.skyCurve = 0.62;
      p.skyBelow = c('#9EDCF0');
      // ART.md's low key light rather than cyan on cyan: a pale-gold sun low ahead-left lays long
      // shadows toward the camera, draws a gold specular path down the glaze and rims the spires
      // warm, so the cold blues have something to read against.
      p.sunColor = c('#FFD99E');
      p.sunDir = sunDir(-26, 8);
      p.lightMin = 13;
      p.sunSize = 1.05;
      p.sunGlow = 1.6;
      p.snowLit = c('#EEF9FC');
      p.snowShade = c('#5A9EC6');
      p.snowDeep = c('#24669A');
      p.rim = c('#FFD8A8');
      p.fog = c('#B2E4F4');
      p.hemiSky = c('#86D2EE');
      if (biome === 'glacier') {
        // Deep blue ice hazards against the bright glaze, never the same value as the snow.
        p.tall = c('#2F84BA');
        p.tallDark = c('#134A78');
        p.low = c('#235684');
        p.lowLit = c('#3E78AA');
      }
      p.ridge = [c('#A6DCF0'), c('#5EA8D2'), c('#2A72A8')];
      // Clear, cold air: glassy blue rock over a broken sea of clouds.
      p.massif.rock = c('#2E5E8E');
      p.massif.sea = 0.75;
      p.ice = 1;
      // Pines and crystals in the cyan light sat close to the #7FC6DF shade snow: a quarter darker,
      // they read as hard dark silhouettes again.
      p.hazardDim = 0.75;
      p.sparkle = 1.1;
      p.snowfall = 0;
      p.bloom = 0.42;
      p.grade = { lift: c('#021624'), gain: c('#FFFCF4'), saturation: 1.1, contrast: 1.08, grain: 1, foot: 0.24, shafts: 0.9, lens: 0.8, focal: 1, gust: 0, glitter: 0.7 };
      // Clear, cold air: only a few thin high wisps, gold where the low sun catches them.
      p.clouds = { low: 0, high: 0.4, top: 0.1, lit: c('#F4FCFF'), shade: c('#8CC8E6'), rim: c('#FFDDA0'), shadow: 0.12 };
      // Ice-crystal air: a 22 degree halo and two sun dogs round the low sun, diamond dust glittering in
      // it (post.ts), and air clear enough to see the far banner and slide; the valleys hold little haze.
      p.atmo = { rays: 0.45, halo: 1, meteors: 0, banner: 1, slide: 1, sweep: 0.4, valley: 0.25, valleyColor: c('#CDEFF8'), drift: 0 };
      break;
    case Mood.Comet:
      // Night with an ember afterglow on the horizon: a deep violet zenith, stars and lavender snow.
      // The comet is the only bright thing in the sky.
      p.skyZenith = c('#1A0F3D');
      p.skyHorizon = c('#FF7A5C');
      p.skyMid = c('#5A2464');
      p.skySpread = 0.55;
      p.skyCurve = 0.55;
      p.skyBelow = c('#4A2A6A');
      p.sunColor = c('#FFF0FA');
      p.sunDir = sunDir(-32, 14);
      // The moon still lights the snow, but its disc and glow are gone from the sky: the comet is
      // the single hero light, not one of three competing with the ember horizon.
      p.sunGlow = 0;
      p.sunSize = 0.5;
      p.sunDisc = 0;
      // Lit snow is a near-white lavender (a saturated lilac covered half the frame in one flat value),
      // and the moon is low enough that the banks turned from it fall into the #6B4FB0 shade.
      p.lightMin = 16;
      p.snowLit = c('#EFE8FB');
      p.snowShade = c('#6B4FB0');
      p.snowDeep = c('#40287A');
      p.rim = c('#FF9C80');
      p.fog = c('#7A4686');
      p.fogNear = 40;
      p.fogFar = 420;
      p.hemiSky = c('#6A4EA8');
      p.ridge = [c('#A0587E'), c('#64366E'), c('#341E52')];
      p.massif.rock = c('#2A1A44');
      p.massif.glow = c('#FF8C8C');
      p.massif.sea = 0.8;
      p.massif.lava = p.massif.lava > 0 ? 1 : 0;
      p.stars = 1;
      p.moon = true;
      p.moonPhase = 0.72;
      p.comet = true;
      p.snowfall = 0.05;
      p.bloom = 0.85;
      p.grade = { lift: c('#0E0420'), gain: c('#FAF0FF'), saturation: 1.0, contrast: 1.07, grain: 0.45, foot: 0.26, shafts: 0, lens: 0, focal: 1, gust: 0, glitter: 0.2, focalDir: COMET_DIR };
      // A dusk bank on the ember horizon, its undersides glowing ember; the comet keeps the sky above.
      p.clouds = { low: 0.65, high: 0.15, top: 0.2, lit: c('#5E3268'), shade: c('#2A1642'), rim: c('#FF7A4C'), shadow: 0 };
      // The comet's company: shooting stars (its debris), and an ember-lit dusk haze in the valleys.
      p.atmo = { rays: 0, halo: 0, meteors: 1.4, banner: 0.4, slide: 0, sweep: 0, valley: 0.8, valleyColor: c('#7E4A88'), drift: 0.3 };
      break;
    case Mood.Haunted:
      p.skyZenith = c('#0B1F1C');
      p.skyHorizon = c('#3E7F6B');
      p.skyMid = null;
      p.skySpread = 0.75;
      p.skyBelow = c('#1C3A34');
      p.sunColor = c('#CFFFE0');
      p.sunDir = sunDir(-20, 20);
      p.sunGlow = 0.6;
      p.snowLit = c('#CFE9DE');
      p.snowShade = c('#4A7872');
      p.snowDeep = c('#2A524E');
      p.rim = c('#9CFFD8');
      p.fog = c('#2F5C55');
      p.fogNear = 20;
      p.fogFar = 260;
      p.hemiSky = c('#3F6E64');
      p.tall = c('#16302C');
      p.tallDark = c('#0B1C1A');
      p.ghost = c('#9CFFD8');
      p.ghostGlow = 1.5;
      p.ridge = [c('#3A6A5E'), c('#244A42'), c('#132C28')];
      p.mist = c('#4E8C78');
      p.mistK = 0.45;
      p.massif.rock = c('#0E2622');
      p.massif.sea = 0.9;
      p.massif.lava = p.massif.lava > 0 ? 0.8 : 0;
      p.stars = 0.4;
      // A pale green full moon, not a sun: it is a night mood.
      p.moon = true;
      p.sunSize = 0.85;
      p.wisps = 1;
      p.snowfall = 0.1;
      p.bloom = 0.95;
      p.grade = { lift: c('#03100C'), gain: c('#E8FFF4'), saturation: 0.95, contrast: 1.08, grain: 0.45, foot: 0.1, shafts: 0, lens: 0, focal: 1.2, gust: 0, glitter: 0 };
      p.clouds = { low: 0.5, high: 0.12, top: 0.22, lit: c('#3E7464'), shade: c('#0E2A24'), rim: c('#9CFFD8'), shadow: 0 };
      // Ground mist drifts over the course and pools in the hollows, the valleys brim with it, a pale
      // ring stands round the moon, and now and then a lost soul streaks across the sky.
      p.atmo = { rays: 0, halo: 0.45, meteors: 0.5, banner: 0, slide: 0, sweep: 0, valley: 1, valleyColor: c('#4E8C78'), drift: 1 };
      break;
    case Mood.Powder:
      p.skyZenith = c('#2F7BE0');
      p.skyHorizon = c('#CDE8FF');
      p.skyMid = c('#7EB4F0');
      p.skyBelow = c('#BCD8F4');
      p.sunColor = c('#FFFFFF');
      p.sunDir = sunDir(-16, 34);
      p.snowLit = c('#FFFFFF');
      p.snowShade = c('#AAC6EC');
      p.snowDeep = c('#7298D2');
      p.rim = c('#E8F4FF');
      p.fog = c('#D6E8FA');
      p.hemiSky = c('#A8CCF4');
      p.ridge = [c('#CCE0F6'), c('#A2C2EA'), c('#759EDA')];
      p.massif.rock = c('#56689A');
      p.massif.sea = 0.9;
      p.snowfall = 0.35;
      p.sparkle = 1.3;
      p.bloom = 0.5;
      p.grade = { lift: c('#061430'), gain: c('#FFFFFF'), saturation: 1.1, contrast: 1.02, grain: 1, foot: 0.26, shafts: 0.6, lens: 0.5, focal: 0.7, gust: 0, glitter: 1 };
      // Fair-weather puffs low on the horizon and a few high wisps, white on blue.
      p.clouds = { low: 0.4, high: 0.3, top: 0.24, lit: c('#FFFFFF'), shade: c('#B4CCEC'), rim: c('#FFFFFF'), shadow: 0.22 };
      // Fresh snow everywhere: the air sparkles with it (post.ts), the summit flies a long banner and the
      // fair-weather clouds' shadows race across the panorama.
      p.atmo = { rays: 0.5, halo: 0, meteors: 0, banner: 1.2, slide: 1, sweep: 1.3, valley: 0.5, valleyColor: c('#E4F0FC'), drift: 0 };
      break;
  }
  // The volcano smokes (massif.ts) rather than flying a snow banner, and its ash slopes never slide.
  if (p.massif.peak === 'volcano') {
    p.atmo.banner = 0;
    p.atmo.slide = 0;
  }
  // Moods author sunDir as where the disc sits, and the key light is lifted from it. Clear Skies sets
  // both itself (setSun).
  if (mood !== Mood.None) {
    p.diskDir = p.sunDir.clone();
    p.sunDir = liftLight(p.diskDir, p.lightMin);
    // A chaos mood's far air is its own middle ridge, leaning to its fog; at night the lamps own the dark.
    p.air.far.copy(p.ridge[1]).lerp(p.fog, 0.35);
    p.air.low = p.fogFar < 300 ? 0.15 : 0.35;
    p.lamps = p.lantern || p.moon || p.comet ? 1 : mood === Mood.Blizzard ? 0.7 : 0.25;
  }
  p.shadowDir = shadowFrom(p.sunDir, p.shadowSwing, p.shadowMinEl);
  // Round 7's grade fields, wherever a mood's own grade leaves them out (so every palette blends).
  p.grade.tone ??= 1;
  p.grade.exposure ??= 1;
  p.grade.hi ??= new Color(1, 1, 1);
  p.grade.lo ??= new Color(1, 1, 1);
  return p;
}

// ---------------------------------------------------------------------------------------------------
// Palette blending and the sun's journey over a run.

type Field = Palette[keyof Palette];

function lerpField(a: unknown, b: unknown, t: number, o: unknown): unknown {
  if (a instanceof Color && b instanceof Color) {
    const oc = o instanceof Color && o !== b ? o : new Color();
    return oc.copy(a).lerp(b, t);
  }
  if (a instanceof Vector3 && b instanceof Vector3) {
    const ov = o instanceof Vector3 && o !== b ? o : new Vector3();
    return ov.copy(a).lerp(b, t).normalize();
  }
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) {
    const oa = Array.isArray(o) && o !== b ? o : [];
    for (let i = 0; i < a.length; i++) oa[i] = lerpField(a[i], b[i], t, oa[i]);
    return oa;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const oo = (o && typeof o === 'object' && o !== b ? o : {}) as Record<string, unknown>;
    const ar = a as Record<string, unknown>;
    const br = b as Record<string, unknown>;
    for (const k of Object.keys(ar)) oo[k] = lerpField(ar[k], br[k], t, oo[k]);
    return oo;
  }
  // Flags (and a null sky mid against a colour) switch over at the halfway point; a colour is copied,
  // never shared, so a later blend cannot write into the palette it came from.
  const pick = t < 0.5 ? a : b;
  return pick instanceof Color ? (o instanceof Color && o !== a && o !== b ? o.copy(pick) : pick.clone()) : pick;
}

/** Blends palette a toward b by t into out, reusing out's colours and vectors (out may be a, never b).
 *  Directions are blended and renormalised; flags switch over halfway. */
export function lerpPalette(a: Palette, b: Palette, t: number, out: Palette): Palette {
  const o = out as unknown as Record<string, Field>;
  const ar = a as unknown as Record<string, Field>;
  const br = b as unknown as Record<string, Field>;
  for (const k of Object.keys(ar)) o[k] = lerpField(ar[k], br[k], t, o[k]) as Field;
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Clear Skies: each mountain's own light, and how it changes over a run.

/** Places the sun: its bearing, how high the disc sits, how high the key light is (decision 27: well
 *  above the slope, or every downhill face falls into shade) and the lowest the shadow light drops. */
function setSun(p: Palette, az: number, disc: number, light: number, shadowEl: number): void {
  p.diskDir = sunDir(az, disc);
  p.sunDir = sunDir(az, light);
  p.shadowMinEl = shadowEl;
}

/** Each mountain's light at the start of a run, which is also the title's. Over biomeBase(), so the
 *  chaos moods never see any of it. */
function clearSkies(p: Palette, biome: BiomeId): void {
  switch (biome) {
    case 'alpine':
      // A bright ski day: a high white sun off to the right, deep cobalt over pale blue, teal pines and
      // short, sharp blue shadows.
      setSun(p, 31, 24, 44, 24);
      p.sunColor = c('#FFF7EA');
      p.sunCore = new Color(3, 2.95, 2.8);
      p.sunTint = 0.9;
      p.sunSize = 0.82;
      p.sunGlow = 0.75;
      p.skyZenith = c('#123F9E');
      p.skyMid = c('#3E86DC');
      p.skyHorizon = c('#CBE8F8');
      p.skyBelow = c('#BAD7EF');
      p.skySpread = 0.62;
      p.skyCurve = 0.72;
      p.snowLit = c('#FFFFFF');
      p.snowShade = c('#7CA6EC');
      p.snowDeep = c('#2F62C8');
      p.rim = c('#DCEEFF');
      p.fog = c('#CDE3F6');
      p.fogNear = 70;
      p.fogFar = 640;
      p.hemiSky = c('#86B6F2');
      p.tall = c('#0E5A5C');
      p.tallDark = c('#07343C');
      p.low = c('#3C4864');
      p.lowLit = c('#6C7C9C');
      p.ridge = [c('#CFE3F7'), c('#94BCE8'), c('#5A8AD0')];
      p.massif.rock = c('#46587E');
      p.massif.glow = c('#FFD9A0');
      p.massif.heroAz = -21;
      p.massif.sea = 0.7;
      // The valley floor's white is snow on Pinecrest's Clear Skies, and its openings frozen lakes.
      p.massif.seaIce = 1;
      p.grade = { lift: c('#040E28'), gain: c('#FFFFFF'), saturation: 1.12, contrast: 1.08, grain: 0.7, foot: 0.26, shafts: 0, lens: 0.25, focal: 0.45, gust: 0, glitter: 0.55 };
      p.clouds = { low: 0.5, high: 0.4, top: 0.2, lit: c('#FFFFFF'), shade: c('#A8C4EA'), rim: c('#FFFFFF'), shadow: 0.22 };
      p.atmo = { rays: 0, halo: 0, meteors: 0, banner: 1, slide: 1, sweep: 1, valley: 0.5, valleyColor: c('#E8F3FC'), drift: 0 };
      p.bloom = 0.3;
      p.snowfall = 0.02;
      p.sparkle = 1.25;
      return;
    case 'glacier':
      // Polar blue hour: deep cobalt down to a thin lemon band, a low cold sun off to the left, long
      // steel-blue light and glazed snow. Hazards are a deep ice blue so they stay darker than the snow.
      setSun(p, -35, 5.5, 23, 9);
      p.sunColor = c('#FFF2C4');
      p.sunCore = new Color(2.5, 2.4, 1.5);
      p.sunTint = 0.85;
      p.sunSize = 0.9;
      p.sunGlow = 0.7;
      p.skyZenith = c('#0A2470');
      p.skyMid = c('#2E67BE');
      p.skyHorizon = c('#A6C6EE');
      p.skyBand = { color: c('#FFF0A0'), fade: 30, k: 0.95 };
      p.skyBelow = c('#6E92CC');
      p.skySpread = 0.62;
      p.skyCurve = 0.44;
      p.snowLit = c('#D4E4FA');
      p.snowShade = c('#4C76C4');
      p.snowDeep = c('#1C3C8C');
      p.rim = c('#FFF2BE');
      p.fog = c('#7FA4DC');
      p.fogNear = 50;
      p.fogFar = 470;
      p.hemiSky = c('#6A9CEC');
      p.tall = c('#2C8CCC');
      p.tallDark = c('#114A8A');
      p.low = c('#1E3A6E');
      p.lowLit = c('#3E6AA4');
      p.hazardDim = 0.9;
      p.ridge = [c('#6F95D4'), c('#3F66B4'), c('#1F3C8A')];
      p.massif.rock = c('#1A2E68');
      p.massif.glow = c('#FFEFB0');
      p.massif.heroAz = 17;
      p.massif.sea = 0.8;
      p.massif.flow = 0.35;
      p.ice = 0.6;
      p.grade = { lift: c('#030A26'), gain: c('#F0F5FF'), saturation: 1.1, contrast: 1.08, grain: 0.7, foot: 0.3, shafts: 0.55, lens: 0.5, focal: 1, gust: 0, glitter: 0.45 };
      p.clouds = { low: 0.3, high: 0.35, top: 0.13, lit: c('#BCD2F2'), shade: c('#3A5EAC'), rim: c('#FFF3BE'), shadow: 0.08 };
      p.atmo = { rays: 0.55, halo: 0, meteors: 0.2, banner: 1, slide: 1, sweep: 0.3, valley: 0.6, valleyColor: c('#6C92D2'), drift: 0.1 };
      p.stars = 0.55;
      p.bloom = 0.5;
      p.sparkle = 1;
      p.snowfall = 0.03;
      p.giftGlow = 0.2;
      p.ghostGlow = 1.35;
      p.lanternGlow = 0.2;
      return;
    case 'volcanic':
      // Under ash: a heavy overcast of smoke lit from below, a dim orange disc, ash-grey snow, and the
      // volcano dead ahead at the end of the valley. Warmth stays in the sky so the snow still sets off
      // the rider's vermillion and the gifts' marigold.
      setSun(p, 34, 15, 30, 15);
      p.sunColor = c('#E8E0DC');
      p.sunCore = new Color(1.7, 0.62, 0.16);
      p.sunTint = 0.85;
      p.sunSize = 1.15;
      p.sunGlow = 0.5;
      p.sunDisc = 0.85;
      p.sunSoft = 0.25;
      p.skyZenith = c('#1C1316');
      p.skyMid = c('#4C2B2A');
      p.skyHorizon = c('#D8602C');
      p.skyBelow = c('#3C1E1E');
      p.skySpread = 0.5;
      p.skyCurve = 0.7;
      p.snowLit = c('#CFC8CC');
      p.snowShade = c('#54465E');
      p.snowDeep = c('#2A2038');
      p.rim = c('#FF8A50');
      p.fog = c('#54383C');
      p.fogNear = 40;
      p.fogFar = 420;
      p.hemiSky = c('#6E5866');
      p.low = c('#2E272E');
      p.lowLit = c('#5A4248');
      p.ridge = [c('#7A4638'), c('#4A2A2C'), c('#2A181E')];
      p.massif.rock = c('#1C1418');
      p.massif.glow = c('#FF7A3A');
      p.massif.heroAz = 7;
      p.massif.sea = 0.55;
      p.massif.lava = 0.6;
      p.massif.flow = 0.5;
      p.deck = { k: 0.85, lit: c('#54403E'), shade: c('#241A20'), glow: c('#FF6A28') };
      p.clouds = { low: 0.7, high: 0, top: 0.16, lit: c('#6A4A44'), shade: c('#2A1C22'), rim: c('#FF7A38'), shadow: 0 };
      p.shadowK = 0.7;
      p.grade = { lift: c('#120A10'), gain: c('#FFF4EA'), saturation: 1.06, contrast: 1.06, grain: 0.8, foot: 0.3, shafts: 0, lens: 0, focal: 0.8, gust: 0, glitter: 0 };
      p.atmo = { rays: 0.25, halo: 0, meteors: 0, banner: 0, slide: 0, sweep: 0.2, valley: 0.8, valleyColor: c('#8A4A38'), drift: 0.4 };
      p.bloom = 0.5;
      p.sparkle = 0.35;
      p.snowfall = 0;
      p.giftGlow = 0.3;
      p.ghostGlow = 1.45;
      return;
    case 'blossom':
      // A soft spring morning: a pale celadon sky over cream, peach mist, low contrast, and the blossom
      // the one saturated thing against the pale air. The mist hides the cone at first.
      setSun(p, -24, 19, 29, 17);
      p.sunColor = c('#FFF4E2');
      p.sunCore = new Color(2.6, 2.4, 2.1);
      p.sunTint = 0.7;
      p.sunSize = 1.2;
      p.sunGlow = 0.6;
      p.sunDisc = 0.75;
      p.sunSoft = 0.55;
      p.skyZenith = c('#9CCFC2');
      p.skyMid = c('#D6E8D4');
      p.skyHorizon = c('#FFF1DA');
      p.skyBelow = c('#FBE6D4');
      p.skySpread = 0.8;
      p.skyCurve = 0.95;
      p.snowLit = c('#FFFBF4');
      p.snowShade = c('#A5ACDC');
      p.snowDeep = c('#9674BC');
      p.rim = c('#FFE2D0');
      p.fog = c('#FFE6D2');
      p.fogNear = 85;
      p.fogFar = 520;
      p.hemiSky = c('#D2E2DC');
      p.tall = c('#F88CBC');
      p.tallDark = c('#D65290');
      p.low = c('#454159');
      p.lowLit = c('#76728E');
      p.ridge = [c('#F2E8DC'), c('#DCE0D2'), c('#BCCDC6')];
      p.massif.rock = c('#8492A8');
      p.massif.glow = c('#FFC8B4');
      p.massif.heroAz = 27;
      p.massif.veil = 0.3;
      p.clouds = { low: 0.3, high: 0.35, top: 0.16, lit: c('#FFF8EE'), shade: c('#E4DCCF'), rim: c('#FFDCC4'), shadow: 0.1 };
      p.shadowK = 0.82;
      p.grade = { lift: c('#22282E'), gain: c('#FFFDF8'), saturation: 1.06, contrast: 1.03, grain: 0.5, foot: 0.14, shafts: 0.7, lens: 0.3, focal: 0.5, gust: 0, glitter: 0.1 };
      p.atmo = { rays: 0.8, halo: 0, meteors: 0, banner: 0.3, slide: 0, sweep: 0.2, valley: 1, valleyColor: c('#FFE4D2'), drift: 0.7 };
      p.bloom = 0.22;
      p.sparkle = 0.6;
      p.snowfall = 0;
      p.giftGlow = 0.2;
      p.ghostGlow = 1.5;
      return;
  }
}

/** Round 7's direction over each mountain's Clear Skies (ART.md 15): the air between the planes, the
 *  film grade, how strongly lamps light the world, and the changes of colour the review asked for. Ember's
 *  snow is snow in firelight (an orange lit side against a cold plum-teal shade) and its basalt true
 *  black; Sakura gains a spine of darks (ink rock, a wine underside to the blossom) and blossom that
 *  glows; Frostfang and Pinecrest keep their palettes and gain a far plane of their own blue. */
function round7(p: Palette, biome: BiomeId): void {
  switch (biome) {
    case 'alpine':
      p.air = { far: c('#6E9AE2'), cool: c('#E4ECFF'), low: 0.5, scatter: 1.1 };
      p.lamps = 0.2;
      p.leaf = 0.05;
      p.grade.exposure = 1.06;
      p.grade.hi = c('#FFFDF4');
      p.grade.lo = c('#E6EEFF');
      p.grade.shafts = 0.35;
      p.atmo.rays = 0.3;
      return;
    case 'glacier':
      p.air = { far: c('#27469C'), cool: c('#D8E2FF'), low: 0.5, scatter: 1.25 };
      p.lamps = 0.6;
      p.grade.exposure = 1.05;
      p.grade.hi = c('#FFF8E4');
      p.grade.lo = c('#DCE4FF');
      return;
    case 'volcanic':
      // The deck is what lights the ground: its orange on the lit side, its complement in the shade.
      p.sunColor = c('#FFD4B8');
      p.snowLit = c('#F2E2D8');
      p.snowShade = c('#3C4A66');
      p.snowDeep = c('#2A2444');
      p.hemiSky = c('#5C5A78');
      p.fog = c('#5A3438');
      p.low = c('#1C181C');
      p.lowLit = c('#3A2C30');
      p.tall = c('#1E1A20');
      p.tallDark = c('#0E0C10');
      p.massif.rock = c('#140E12');
      p.air = { far: c('#3A1C24'), cool: c('#C4CCE4'), low: 0.6, scatter: 1.3 };
      p.under = { color: c('#FF6A28'), k: 0.1 };
      p.lamps = 0.9;
      p.grade.exposure = 1.08;
      p.grade.saturation = 1.12;
      p.grade.contrast = 1.1;
      p.grade.hi = c('#FFEAD2');
      p.grade.lo = c('#D6E2F4');
      p.sparkle = 0.5;
      return;
    case 'blossom':
      p.snowLit = c('#FFF4E8');
      p.snowShade = c('#7E8CD6');
      p.snowDeep = c('#6452AC');
      p.fog = c('#F4DCD6');
      p.low = c('#2E2A44');
      p.lowLit = c('#5E5878');
      p.tall = c('#FF9CC4');
      p.tallDark = c('#A8386E');
      p.air = { far: c('#9AB0DE'), cool: c('#E8EEFF'), low: 0.8, scatter: 1.3 };
      p.lamps = 0.3;
      p.leaf = 0.5;
      p.grade.lift = c('#1A1E2A');
      p.grade.contrast = 1.1;
      p.grade.saturation = 1.12;
      p.grade.exposure = 0.96;
      p.grade.hi = c('#FFF4E6');
      p.grade.lo = c('#E2E0FF');
      return;
  }
}

/** One change of light on a mountain's run. */
export interface JourneyStop {
  /** Metres where the light starts to leave the stop before. */
  from: number;
  /** Metres where this stop is full. Stops run in order and never overlap. */
  at: number;
  /** How much of the day has gone, 0..1 (the soundscape's valley bell, in place of an evening's dusk). */
  dusk: number;
  /** What changes from the stop before. Anything live through the shared uniforms or the sky can change
   *  here; the props and the mid-ground keep their baked colours (tall, low), so a late stop keeps
   *  hazards dark with hazardDim rather than recolouring them. */
  edit: (p: Palette) => void;
}

/** The journey of every mountain, in metres: the time of day, which is the same on any course of the
 *  mountain. RETUNE HERE when run lengths change: every distance in the sun's journey is in this table and
 *  nowhere else. What belongs to a place rather than to the hour (a street's lamplight, a cavern's dark)
 *  is in PLACES below, keyed to the course's own sections. Round 7 restaged every row to ART.md 15. */
export const JOURNEY: Record<BiomeId, JourneyStop[]> = {
  alpine: [
    {
      // The cloud builds through the afternoon. The grade holds cool, so the gold later is a change.
      from: 500, at: 1700, dusk: 0,
      edit: (p) => {
        setSun(p, 38, 17, 36, 18);
        p.sunColor = c('#FFF0D8');
        p.skyZenith = c('#184A9E');
        p.skyMid = c('#6FA2D8');
        p.skyHorizon = c('#EDE8DC');
        p.fogFar = 600;
        p.clouds.low = 0.95;
        p.clouds.high = 0.8;
        p.clouds.top = 0.3;
        p.clouds.shadow = 0.38;
        p.clouds.lit = c('#FFF8EC');
        p.clouds.shade = c('#8FA6CE');
        p.atmo.rays = 0.6;
        p.grade.shafts = 0.6;
      },
    },
    {
      // The gold comes: the sun drops under the cloud, honey light, long violet-blue shadows, the peaks
      // glowing, and the saturation rises. Gold against blue, never the old lilac.
      from: 2300, at: 3250, dusk: 0.55,
      edit: (p) => {
        setSun(p, 46, 9, 28, 13);
        p.sunColor = c('#FFDCA8');
        p.sunCore.setRGB(3, 2.5, 1.7);
        p.sunTint = 0.6;
        p.sunSize = 1.1;
        p.sunGlow = 1.1;
        p.skyZenith = c('#1E4A96');
        p.skyMid = c('#A8BCCB');
        p.skyHorizon = c('#FFC98A');
        p.skyBelow = c('#E8C8A8');
        p.snowLit = c('#FFF6E6');
        p.snowShade = c('#6480D8');
        p.snowDeep = c('#3446B4');
        p.rim = c('#FFD2A0');
        p.fog = c('#F0CFA8');
        p.hemiSky = c('#8AA8E0');
        p.air.far = c('#8C8CD2');
        p.air.scatter = 1.5;
        p.clouds.lit = c('#FFE0B4');
        p.clouds.shade = c('#7E8CB8');
        p.clouds.rim = c('#FFB86C');
        p.massif.glowK = 0.7;
        p.massif.glowLine = -60;
        p.atmo.rays = 0.8;
        p.grade.gain = c('#FFF9F0');
        p.grade.shafts = 0.8;
        p.grade.saturation = 1.2;
        p.grade.exposure = 1.02;
        p.grade.hi = c('#FFF0D2');
        p.grade.lo = c('#E2E0FF');
        p.giftGlow = 0.2;
        p.lamps = 0.7;
        p.bloom = 0.4;
      },
    },
    {
      // Dusk at the line: the finish town in a pool of gold, everything else in long shadow, the sky
      // deepening behind the fireworks.
      from: 3700, at: 4250, dusk: 0.85,
      edit: (p) => {
        setSun(p, 50, 5, 22, 11);
        p.sunColor = c('#FFC890');
        p.sunCore.setRGB(3, 2.1, 1.2);
        p.skyZenith = c('#16306E');
        p.skyMid = c('#7A7CB8');
        p.skyHorizon = c('#FFB07A');
        p.skyBelow = c('#C89C98');
        p.snowLit = c('#F8E4D2');
        p.snowShade = c('#5868C8');
        p.snowDeep = c('#2A389C');
        p.fog = c('#D8B4B0');
        p.hemiSky = c('#7888D8');
        p.air.far = c('#6A6CB8');
        p.clouds.lit = c('#FFC89C');
        p.clouds.shade = c('#5E64A8');
        p.massif.glowK = 0.9;
        p.massif.glowLine = 120;
        p.grade.hi = c('#FFE8C6');
        p.grade.lo = c('#DCDCFF');
        p.hazardDim = 0.9;
        p.stars = 0.2;
        p.giftGlow = 0.4;
        p.ghostGlow = 1.5;
        p.lanternGlow = 0.3;
        p.lamps = 1;
        p.bloom = 0.5;
      },
    },
  ],
  glacier: [
    {
      // The sun sinks onto the band.
      from: 600, at: 1450, dusk: 0.5,
      edit: (p) => {
        setSun(p, -40, 3.4, 19, 8);
        p.sunColor = c('#FFE9B8');
        p.skyZenith = c('#071C5C');
        p.skyMid = c('#2553A8');
        p.skyHorizon = c('#8CAEE0');
        p.skyBand.color = c('#FFD97A');
        p.snowLit = c('#BCCFF2');
        p.stars = 0.8;
        p.giftGlow = 0.35;
        p.ghostGlow = 1.5;
        p.lanternGlow = 0.35;
        p.lamps = 0.9;
        p.air.far = c('#1E3A8C');
      },
    },
    {
      // Polar night comes on, and it is not one blue: the aurora is the key light over the Crevasse
      // Fields, green on the snow that faces it with violet in the shade, moving.
      from: 1700, at: 2250, dusk: 1,
      edit: (p) => {
        setSun(p, -44, 3, 18, 8);
        p.sunColor = c('#B8C4EC');
        p.sunDisc = 0.25;
        p.hazardDim = 0.78;
        p.skyZenith = c('#040E3C');
        p.skyMid = c('#143A8A');
        p.skyHorizon = c('#4A7EC0');
        p.skyBand.color = c('#7FC4D0');
        p.skyBand.k = 0.6;
        p.skyBelow = c('#2E4E94');
        p.snowLit = c('#9DB6EA');
        p.snowShade = c('#343C9C');
        p.snowDeep = c('#161A6A');
        p.fog = c('#24367E');
        p.hemiSky = c('#4E78CC');
        p.air.far = c('#101A58');
        p.key2 = { color: c('#3FD89A'), k: 1, shade: c('#4A3CB4') };
        p.aurora = 1;
        p.stars = 1;
        p.massif.flow = 1;
        p.bloom = 0.7;
        p.giftGlow = 0.6;
        p.ghostGlow = 1.7;
        p.lanternGlow = 0.55;
        p.lamps = 1;
        p.grade.exposure = 1.1;
        p.grade.contrast = 1.14;
        p.grade.lo = c('#E8E0FF');
      },
    },
    {
      // The deep of the night on the way to the Fang: the aurora past its crest, the band gone, the
      // glacier holding what light there is. It is darkest at the Ice Cavern's mouth.
      from: 2700, at: 3180, dusk: 1,
      edit: (p) => {
        p.sunDisc = 0.1;
        p.skyZenith = c('#030A30');
        p.skyMid = c('#102E74');
        p.skyHorizon = c('#3A68AC');
        p.skyBand.k = 0.35;
        p.snowLit = c('#93ACE2');
        p.aurora = 0.75;
        p.key2.k = 0.7;
        p.lanternGlow = 0.6;
      },
    },
    {
      // Out of the cavern into the dawn: the sun comes up beside the Fang (it crosses the sky ahead while
      // the rider is under the ice, so the far mouth opens onto it), rose gold on the snow and the peaks,
      // the stars and the aurora fading out of a lightening sky.
      from: 3300, at: 3580, dusk: 1,
      edit: (p) => {
        setSun(p, 30, 3.6, 20, 9);
        p.sunColor = c('#FFC8A4');
        p.sunCore.setRGB(2.9, 2.1, 1.5);
        p.sunDisc = 1;
        p.sunGlow = 1.2;
        p.sunSize = 1.05;
        p.hazardDim = 0.88;
        p.skyZenith = c('#1A3A86');
        p.skyMid = c('#7678C4');
        p.skyHorizon = c('#F2B49A');
        p.skyBand.color = c('#FFB884');
        p.skyBand.k = 1;
        p.skyBelow = c('#B88EB4');
        p.snowLit = c('#F6DCE4');
        p.snowShade = c('#5A64BC');
        p.snowDeep = c('#2A3490');
        p.rim = c('#FFD2B4');
        p.fog = c('#A69CCC');
        p.hemiSky = c('#8A98DC');
        p.air.far = c('#8A7CC6');
        p.air.scatter = 1.7;
        p.key2.k = 0.06;
        p.clouds.lit = c('#FFD8C4');
        p.clouds.shade = c('#6A6AB4');
        p.clouds.rim = c('#FFBC8C');
        p.massif.glow = c('#FFB4A4');
        p.massif.glowK = 0.85;
        p.massif.glowLine = -40;
        p.aurora = 0.12;
        p.stars = 0.15;
        p.atmo.rays = 1;
        p.grade.shafts = 1;
        p.grade.gain = c('#FFF4EE');
        p.grade.exposure = 1.04;
        p.grade.contrast = 1.08;
        p.grade.hi = c('#FFE6D2');
        p.grade.lo = c('#E0D8FF');
        p.bloom = 0.6;
        p.giftGlow = 0.3;
        p.ghostGlow = 1.45;
        p.lanternGlow = 0.25;
        p.lamps = 0.6;
      },
    },
  ],
  volcanic: [
    {
      // The deck closes over the basalt slopes: the disc dims and the air draws in.
      from: 500, at: 1250, dusk: 0.4,
      edit: (p) => {
        setSun(p, 42, 11, 27, 14);
        p.sunDisc = 0.5;
        p.sunSoft = 0.6;
        p.skyZenith = c('#150E12');
        p.skyHorizon = c('#C84E22');
        p.snowLit = c('#E4CCC0');
        p.snowShade = c('#34425E');
        p.fogFar = 360;
        p.deck.k = 1;
        p.embers = 1;
        p.under.k = 0.16;
      },
    },
    {
      // Out on the shield the deck is lit from below, and breathes.
      from: 1700, at: 2250, dusk: 0.7,
      edit: (p) => {
        setSun(p, 45, 8, 25, 13);
        p.sunDisc = 0.35;
        p.sunColor = c('#FFB48A');
        p.skyHorizon = c('#DC4C1C');
        p.deck.glow = c('#FF6222');
        p.snowLit = c('#DCC2B6');
        p.under.k = 0.24;
        p.massif.lava = 0.68;
        p.massif.flow = 0.8;
        p.embers = 1.15;
        p.bloom = 0.6;
      },
    },
    {
      // A glowing dusk through the Basalt Halls: the sky goes dark, and the lava lights what is left of
      // it. The air is thick with ash and warm with light, never a grey fog with nothing in it.
      from: 2700, at: 3400, dusk: 1,
      edit: (p) => {
        setSun(p, 48, 6, 24, 13);
        p.sunDisc = 0.25;
        p.sunColor = c('#FFA070');
        p.skyZenith = c('#0E0A0E');
        p.skyMid = c('#36181C');
        p.skyHorizon = c('#E8481A');
        p.snowLit = c('#D2B4A8');
        p.snowShade = c('#2C3858');
        p.snowDeep = c('#1E1836');
        p.fog = c('#4E2024');
        p.air.far = c('#2E1218');
        p.under.k = 0.3;
        // Under the 0.75 that wakes the night moods' lightning: nothing strobes on a Clear Skies run.
        p.massif.lava = 0.7;
        p.massif.flow = 1;
        p.deck.glow = c('#FF5A1E');
        p.embers = 1.3;
        p.bloom = 0.7;
        p.giftGlow = 0.6;
        p.ghostGlow = 1.75;
        p.lanternGlow = 0.5;
        p.lamps = 1.1;
      },
    },
    {
      // Night under a red deck over Ash Market and the forge town: lanterns, forge mouths and windows
      // light the snow, the cone runs with lava behind the roofs.
      from: 3500, at: 4100, dusk: 1,
      edit: (p) => {
        p.sunDisc = 0.12;
        p.sunColor = c('#F08C5C');
        p.skyZenith = c('#0A0608');
        p.skyMid = c('#2C1014');
        p.skyHorizon = c('#D03A12');
        p.snowLit = c('#BC9C92');
        p.snowShade = c('#28324E');
        p.fog = c('#3E181C');
        p.hazardDim = 0.9;
        p.lamps = 1.3;
        p.bloom = 0.8;
        p.grade.exposure = 1.14;
        p.grade.hi = c('#FFE0C0');
      },
    },
  ],
  blossom: [
    {
      // The mist lifts off the cone in layers and the sun climbs out of it.
      from: 400, at: 1100, dusk: 0,
      edit: (p) => {
        setSun(p, -27, 22, 33, 18);
        p.sunDisc = 1;
        p.sunSoft = 0.2;
        p.skyZenith = c('#90C4CC');
        p.skyMid = c('#C6E2D8');
        p.skyHorizon = c('#FFF4E2');
        p.fogNear = 120;
        p.fogFar = 720;
        p.massif.veil = 0;
        p.shadowK = 0.95;
        p.atmo.valley = 0.7;
        p.atmo.drift = 0.15;
        p.grade.contrast = 1.12;
        p.air.low = 0.65;
      },
    },
    {
      // The orchards: sun through blossom. The canopies glow from behind and shafts fall between the rows.
      from: 1100, at: 1700, dusk: 0.2,
      edit: (p) => {
        p.sunColor = c('#FFF0DC');
        p.leaf = 0.85;
        p.atmo.rays = 1;
        p.grade.shafts = 1;
        p.grade.saturation = 1.18;
        p.petals = 0.9;
      },
    },
    {
      // A clear, high frame: the cone sharp at last, the air blue behind it, a river of petals on the wind.
      from: 2200, at: 2700, dusk: 0.5,
      edit: (p) => {
        setSun(p, -28, 27, 36, 19);
        p.sunColor = c('#FFF8EE');
        p.skyZenith = c('#74B0DA');
        p.skyMid = c('#B6D8E4');
        p.fog = c('#EEDCDC');
        p.fogFar = 880;
        p.air.far = c('#86A6E0');
        p.air.low = 0.5;
        p.snowShade = c('#7686D6');
        p.clouds.low = 0.5;
        p.clouds.high = 0.5;
        p.petals = 1.1;
        p.grade.exposure = 0.94;
      },
    },
    {
      // Late morning, the clearest light on the mountain, over Temple Town.
      from: 3300, at: 3900, dusk: 0.6,
      edit: (p) => {
        p.skyZenith = c('#62A4DC');
        p.snowShade = c('#7A8CDA');
        p.snowDeep = c('#5E54B4');
        p.grade.contrast = 1.14;
        p.petals = 1.3;
        p.lamps = 0.45;
      },
    },
  ],
};

/** A place on a mountain: what its section of the course does to the light of the hour. */
export interface Place {
  /** The section it is. */
  kind: SectionKind;
  /** Which of the mountain's sections of that kind, from 0 down the run (omitted: every one). */
  nth?: number;
  /** What the place changes, over the journey's palette at its own middle. */
  edit: (p: Palette) => void;
}

const lamps = (p: Palette, k: number): void => {
  p.lamps = Math.max(p.lamps, k);
};

/** The grade by place (ART.md 15, rule 5), keyed to the course's own sections, so a Daily's shuffled
 *  acts carry their places with them. A row is a place's own picture: its exposure and split tone, its
 *  air, and what lights it. Blended in over the section's own blend and out past its end. */
export const PLACES: Record<BiomeId, Place[]> = {
  alpine: [
    {
      // The First Drop and the Valley Leap: the valley opens, haze in layers below, shafts through the cloud.
      kind: 'leap',
      edit: (p) => {
        p.fogFar *= 1.25;
        p.air.low = 0.75;
        p.atmo.valley = 0.85;
        p.atmo.rays = Math.max(p.atmo.rays, 0.7);
        p.grade.shafts = Math.max(p.grade.shafts, 0.7);
      },
    },
    {
      // Timberline Glades: dappled, teal-green anchors the frame.
      kind: 'treerun',
      edit: (p) => {
        p.grade.exposure! *= 0.95;
        p.grade.contrast = 1.12;
        p.grade.saturation += 0.06;
        p.grade.lo = c('#D8F0EC');
        p.clouds.shadow = Math.max(p.clouds.shadow, 0.4);
        p.grade.shafts = 1;
        p.atmo.rays = Math.max(p.atmo.rays, 0.8);
      },
    },
    {
      // Mirror Lake: high-key and wide, the one place the grade goes almost monochrome blue.
      kind: 'lake',
      edit: (p) => {
        p.grade.saturation = 0.9;
        p.grade.exposure! *= 1.05;
        p.grade.hi = c('#EEF6FF');
        p.grade.lo = c('#D4E4FF');
        p.fog = c('#BCD8F8');
        p.air.far = c('#6498E8');
      },
    },
    {
      // The covered bridge: the lamps come on against blue shade.
      kind: 'bridge',
      edit: (p) => {
        lamps(p, 0.9);
        p.grade.lo = c('#D8DEFF');
      },
    },
    {
      // Old Town: lamplight against blue shade, the warmest grade on the mountain.
      kind: 'street',
      edit: (p) => {
        lamps(p, 1);
        p.snowShade = c('#586CD0');
        p.grade.gain = c('#FFF4E0');
        p.grade.hi = c('#FFEAC4');
        p.grade.lo = c('#D4D8FF');
        p.grade.saturation += 0.05;
        p.bloom += 0.1;
      },
    },
    {
      kind: 'finish',
      edit: (p) => {
        lamps(p, 1.1);
        p.grade.hi = c('#FFE8C2');
        p.bloom += 0.08;
      },
    },
  ],
  glacier: [
    {
      // Serac Gate and the Crevasse Fields: the walls go down into the dark and the abyss holds the air.
      kind: 'ravine',
      edit: (p) => {
        p.grade.contrast += 0.06;
        p.air.low = 0.9;
        p.under = { color: c('#38C8FF'), k: 0.14 };
      },
    },
    {
      // A span over an abyss that glows cyan from below.
      kind: 'bridge',
      edit: (p) => {
        p.under = { color: c('#38C8FF'), k: 0.3 };
        p.air.low = 1;
      },
    },
    {
      // Station Street: hot hulls and amber windows against cobalt. The only warm place before the dawn.
      kind: 'street',
      edit: (p) => {
        lamps(p, 1);
        p.snowShade = c('#2E4AA6');
        p.grade.hi = c('#FFEED6');
        p.bloom += 0.12;
      },
    },
    {
      // The Ice Cavern: near-black cobalt. The only light is what the cavern holds.
      kind: 'tunnel',
      edit: (p) => {
        p.snowLit = c('#5C78C8');
        p.snowShade = c('#1C2C7A');
        p.snowDeep = c('#0A1248');
        p.fog = c('#0E1A52');
        p.air.far = c('#081040');
        p.fogNear = 24;
        p.fogFar = 260;
        p.hemiSky = c('#2A4A9C');
        p.key2.k = 0;
        p.under = { color: c('#38C8FF'), k: 0.22 };
        p.hazardDim = 0.7;
        p.grade.exposure = 0.95;
        p.grade.contrast = 1.18;
        p.grade.hi = c('#F0F6FF');
        p.grade.lo = c('#DCE0FF');
        p.lanternGlow = 0.7;
        p.bloom = 0.9;
        lamps(p, 1.35);
      },
    },
    {
      kind: 'finish',
      edit: (p) => {
        lamps(p, 0.9);
        p.bloom += 0.06;
      },
    },
  ],
  volcanic: [
    {
      // The basalt slots: lava in the joints lights the walls from their feet.
      kind: 'ravine',
      edit: (p) => {
        p.under.k = Math.max(p.under.k, 0.4);
        p.fog = c('#4A1E20');
        p.grade.contrast += 0.04;
        lamps(p, 1.1);
      },
    },
    {
      // Cinder Gate and the Halls' roof: black, lit from below, the far mouth a hot disc.
      kind: 'tunnel',
      edit: (p) => {
        p.snowLit = c('#A88474');
        p.snowShade = c('#201E38');
        p.snowDeep = c('#120E22');
        p.fog = c('#1E0C10');
        p.air.far = c('#3A1210');
        p.fogNear = 24;
        p.fogFar = 280;
        p.under.k = 0.6;
        p.grade.exposure = 1;
        p.grade.contrast = 1.18;
        p.bloom = 0.9;
        lamps(p, 1.3);
      },
    },
    {
      // A span over a lava river.
      kind: 'bridge',
      edit: (p) => {
        p.under.k = Math.max(p.under.k, 0.5);
        lamps(p, 1.1);
      },
    },
    {
      // The Caldera Leap: the whole frame is lit from underneath, the smoke over it glows.
      kind: 'leap',
      nth: 1,
      edit: (p) => {
        p.under.k = 0.85;
        p.fog = c('#7A2A18');
        p.air.far = c('#A03A14');
        p.air.low = 1;
        p.fogFar *= 1.2;
        p.deck.glow = c('#FF7430');
        p.atmo.valleyColor = c('#E0541C');
        p.atmo.valley = 1;
        p.embers = 1.7;
        p.grade.hi = c('#FFDCB4');
        p.grade.exposure! *= 1.04;
        p.bloom += 0.15;
        lamps(p, 1.2);
      },
    },
    {
      kind: 'street',
      edit: (p) => {
        lamps(p, 1.15);
        p.bloom += 0.1;
      },
    },
    {
      kind: 'finish',
      edit: (p) => {
        lamps(p, 1.15);
        p.bloom += 0.1;
      },
    },
  ],
  blossom: [
    {
      // Petal Steps: the flooded terraces are mirrors of the sky, and the grade goes clear to let them.
      kind: 'terraces',
      edit: (p) => {
        p.grade.hi = c('#F4FAFF');
        p.grade.contrast += 0.03;
        p.air.low = 0.9;
      },
    },
    {
      // The Thousand Torii: dark lacquer and bars of light.
      kind: 'tunnel',
      edit: (p) => {
        p.grade.exposure! *= 0.93;
        p.grade.contrast = 1.18;
        p.grade.lo = c('#F0D6E0');
        p.grade.shafts = 1;
        p.snowShade = c('#7078C8');
        lamps(p, 0.7);
      },
    },
    {
      // The Blossom Leap: orchard rows combed across a valley floor that lies in its own mist.
      kind: 'leap',
      edit: (p) => {
        p.fogFar *= 1.2;
        p.air.low = 0.9;
        p.atmo.valley = Math.max(p.atmo.valley, 0.8);
      },
    },
    {
      kind: 'street',
      edit: (p) => {
        lamps(p, 0.65);
        p.grade.hi = c('#FFEED8');
      },
    },
    {
      kind: 'finish',
      edit: (p) => {
        lamps(p, 0.65);
        p.grade.hi = c('#FFEED8');
      },
    },
  ],
};

const copyOf = (p: Palette): Palette => lerpPalette(p, p, 0, {} as Palette);

const STOPS = new Map<BiomeId, Palette[]>();

/** A mountain's palettes at the start and at each stop of its journey, built on first use. */
function journeyStops(biome: BiomeId): Palette[] {
  let st = STOPS.get(biome);
  if (!st) {
    st = [getPalette(biome, Mood.None)];
    for (const stop of JOURNEY[biome]) {
      const p = copyOf(st[st.length - 1]);
      stop.edit(p);
      p.shadowDir = shadowFrom(p.sunDir, p.shadowSwing, p.shadowMinEl);
      st.push(p);
    }
    STOPS.set(biome, st);
  }
  return st;
}

/** How far along its journey a run is: 0 at the start, n at the n-th stop, smooth between, flat where
 *  the light holds (so the world re-blends only while it moves). */
export function journeyProgress(biome: BiomeId, metres: number): number {
  const stops = JOURNEY[biome];
  let at = 0;
  for (let i = 0; i < stops.length; i++) {
    const k = Math.max(0, Math.min(1, (metres - stops[i].from) / (stops[i].at - stops[i].from)));
    if (k <= 0) break;
    at = i + k * k * (3 - 2 * k);
  }
  return at;
}

/** The hour's palette `metres` into a run, with no place in it. */
function hourPalette(biome: BiomeId, metres: number, out: Palette): Palette {
  const st = journeyStops(biome);
  const at = journeyProgress(biome, metres);
  const i = Math.min(Math.floor(at), st.length - 2);
  return lerpPalette(st[i], st[i + 1], at - i, out);
}

/** A place as it lies on one course: its section's ends, the metres it comes in and goes out over, and
 *  its palette (the hour's at its middle, with the place's edit). */
interface LaidPlace {
  z0: number;
  z1: number;
  rise: number;
  fall: number;
  pal: Palette;
}

const LAID = new WeakMap<Course, LaidPlace[]>();

/** A course's places, in order down the run, laid on first use (a walk of its sections, once). */
function laidPlaces(course: Course): LaidPlace[] {
  let laid = LAID.get(course);
  if (laid) return laid;
  laid = [];
  const table = PLACES[course.biome];
  const seen = new Map<SectionKind, number>();
  for (let z = 0, guard = 0; guard < 80; guard++) {
    const sec = course.section(z);
    const n = seen.get(sec.kind) ?? 0;
    seen.set(sec.kind, n + 1);
    for (const pl of table) {
      if (pl.kind !== sec.kind || (pl.nth !== undefined && pl.nth !== n)) continue;
      const pal = copyOf(hourPalette(course.biome, (sec.z0 + sec.z1) / 2, {} as Palette));
      pl.edit(pal);
      // A roof closes over quickly and lets go quickly (the burst out of a cavern is under two seconds);
      // an open place comes in over its section's own blend.
      const roof = sec.kind === 'tunnel';
      laid.push({ z0: sec.z0 + (roof ? sec.blend * 0.5 : 0), z1: sec.z1, rise: roof ? Math.max(30, sec.blend * 0.5) : Math.max(40, sec.blend), fall: roof ? 75 : 90, pal });
      break;
    }
    if (sec.kind === 'finish') break;
    z = sec.z1 + 0.5;
  }
  LAID.set(course, laid);
  return laid;
}

const smooth01 = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** How fully a laid place holds the frame at `metres` (0..1). */
function placeWeight(l: LaidPlace, metres: number): number {
  if (metres <= l.z0 || metres >= l.z1 + l.fall) return 0;
  return smooth01((metres - l.z0) / l.rise) * (1 - smooth01((metres - (l.z1 - 10)) / (l.fall + 10)));
}

/** Clear Skies' palette `metres` into a run, written into out (which must not be one of the cached
 *  stops): the hour's light, and over it the place the course is in there, when the course is given.
 *  Chaos moods keep their own palette: the caller only calls this for Mood.None. */
export function journeyPalette(biome: BiomeId, metres: number, out: Palette, course?: Course): Palette {
  hourPalette(biome, metres, out);
  if (course && course.biome === biome) {
    for (const l of laidPlaces(course)) {
      const w = placeWeight(l, metres);
      if (w > 0) lerpPalette(out, l.pal, w, out);
    }
  }
  return out;
}

/** A number that changes whenever journeyPalette's answer would, in steps fine enough to blend smoothly
 *  and coarse enough that the world re-blends only while the light moves. */
export function journeyStamp(biome: BiomeId, metres: number, course?: Course): number {
  let key = Math.round(journeyProgress(biome, metres) * 400);
  if (course && course.biome === biome) {
    const laid = laidPlaces(course);
    for (let i = 0; i < laid.length; i++) {
      const w = placeWeight(laid[i], metres);
      if (w > 0) key += (i + 1) * 4001 * Math.round(w * 64);
    }
  }
  return key;
}

/** How much of the day has gone `metres` into a run, 0..1. Allocates nothing (the soundscape asks
 *  every frame). */
export function journeyDusk(biome: BiomeId, metres: number): number {
  const stops = JOURNEY[biome];
  const at = journeyProgress(biome, metres);
  const i = Math.min(Math.floor(at), stops.length - 1);
  const a = i > 0 ? stops[i - 1].dusk : 0;
  return a + (stops[i].dusk - a) * (at - i);
}
