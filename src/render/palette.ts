import { Color, Vector3 } from 'three';
import { Mood } from '../sim/chaos';
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
   *  moving through a run never makes the mountain jump sides). */
  massif: { peak: HeroPeak; rock: Color; glow: Color; glowK: number; glowLine: number; veil: number; sea: number; lava: number; flow: number; heroAz: number };
  /** grain: film grain strength (night moods run light, where grain reads as digital noise in the
   *  dark). foot: how much the bottom edge of the frame darkens and cools (see post.ts). */
  grade: { lift: Color; gain: Color; saturation: number; contrast: number; grain: number; foot: number; shafts: number; lens: number; focal: number; gust: number; glitter: number; focalDir?: Vector3 };
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
    massif: { peak: 'summit', rock: c('#5A4E7A'), glow: c('#FF9AA2'), glowK: 0, glowLine: -6000, veil: 0, sea: 1, lava: 0, flow: 0, heroAz: 0 },
    grade: { lift: c('#0A0F2A'), gain: c('#FFF8F0'), saturation: 1.08, contrast: 1.04, grain: 1, foot: 0.3, shafts: 1, lens: 1, focal: 1, gust: 0, glitter: 0.15 },
    clouds: { low: 0.8, high: 0.6, top: 0.3, lit: c('#FFE6CF'), shade: c('#A48CC0'), rim: c('#FFB088'), shadow: 0.3 },
    deck: { k: 0, lit: c('#FFFFFF'), shade: c('#FFFFFF'), glow: c('#FFFFFF') },
    atmo: { rays: 1, halo: 0, meteors: 0, banner: 0.8, slide: 1, sweep: 1, valley: 0.7, valleyColor: c('#E8C4C8'), drift: 0.3 },
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
  }
  p.shadowDir = shadowFrom(p.sunDir, p.shadowSwing, p.shadowMinEl);
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

/** The journey of every mountain, in metres. RETUNE HERE when run lengths change: every distance in the
 *  sun's journey is in this table and nowhere else. */
export const JOURNEY: Record<BiomeId, JourneyStop[]> = {
  alpine: [
    {
      // The cloud builds through the afternoon.
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
        p.clouds.shadow = 0.34;
        p.clouds.lit = c('#FFF8EC');
        p.clouds.shade = c('#8FA6CE');
      },
    },
    {
      // It goes golden under the cloud: gold against blue, never the old lilac.
      from: 2300, at: 3500, dusk: 0.55,
      edit: (p) => {
        setSun(p, 46, 9, 28, 13);
        p.sunColor = c('#FFE4BC');
        p.sunCore.setRGB(3, 2.5, 1.7);
        p.sunTint = 0.6;
        p.sunSize = 1.1;
        p.sunGlow = 1.1;
        p.skyZenith = c('#1E4A96');
        p.skyMid = c('#A8BCCB');
        p.skyHorizon = c('#FFC98A');
        p.skyBelow = c('#E8C8A8');
        p.snowLit = c('#FFF9F0');
        p.snowShade = c('#6E90DC');
        p.snowDeep = c('#2C56BA');
        p.rim = c('#FFD2A0');
        p.fog = c('#F2D4B0');
        p.hemiSky = c('#8AA8E0');
        p.clouds.lit = c('#FFE0B4');
        p.clouds.shade = c('#7E8CB8');
        p.clouds.rim = c('#FFB86C');
        p.massif.glowK = 0.7;
        p.massif.glowLine = -60;
        p.atmo.rays = 0.6;
        p.grade.gain = c('#FFF9F0');
        p.grade.shafts = 0.7;
        p.giftGlow = 0.2;
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
      },
    },
    {
      // Polar night comes on, and the aurora is at its strongest over the Crevasse Fields in the middle
      // of the run.
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
        p.snowShade = c('#34569E');
        p.snowDeep = c('#132A6C');
        p.fog = c('#2E4E94');
        p.hemiSky = c('#4E78CC');
        p.aurora = 1;
        p.stars = 1;
        p.massif.flow = 1;
        p.bloom = 0.7;
        p.giftGlow = 0.6;
        p.ghostGlow = 1.7;
        p.lanternGlow = 0.55;
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
        p.snowLit = c('#F0DDEA');
        p.snowShade = c('#5A6CB8');
        p.snowDeep = c('#26388C');
        p.rim = c('#FFD2B4');
        p.fog = c('#A69CCC');
        p.hemiSky = c('#8A98DC');
        p.clouds.lit = c('#FFD8C4');
        p.clouds.shade = c('#6A6AB4');
        p.clouds.rim = c('#FFBC8C');
        p.massif.glow = c('#FFB4A4');
        p.massif.glowK = 0.85;
        p.massif.glowLine = -40;
        p.aurora = 0.12;
        p.stars = 0.15;
        p.atmo.rays = 0.8;
        p.grade.shafts = 0.75;
        p.grade.gain = c('#FFF4EE');
        p.bloom = 0.6;
        p.giftGlow = 0.3;
        p.ghostGlow = 1.45;
        p.lanternGlow = 0.25;
      },
    },
  ],
  volcanic: [
    {
      // The ash thickens: the deck closes, the disc dims and the air draws in.
      from: 500, at: 1800, dusk: 0.4,
      edit: (p) => {
        setSun(p, 42, 11, 27, 14);
        p.sunDisc = 0.5;
        p.sunSoft = 0.6;
        p.skyZenith = c('#150E12');
        p.skyHorizon = c('#C84E22');
        p.snowLit = c('#BCB2B6');
        p.snowShade = c('#4A3C54');
        p.fogFar = 340;
        p.deck.k = 1;
        p.embers = 1;
      },
    },
    {
      // A glowing dusk: the sky goes dark, and the lava lights what is left of it.
      from: 2300, at: 3400, dusk: 1,
      edit: (p) => {
        setSun(p, 48, 6, 24, 13);
        p.sunDisc = 0.25;
        p.skyZenith = c('#0E0A0E');
        p.skyMid = c('#36181C');
        p.skyHorizon = c('#E8481A');
        p.snowLit = c('#9A8E96');
        p.snowShade = c('#382C46');
        p.snowDeep = c('#1E1634');
        p.fog = c('#40222A');
        // Under the 0.75 that wakes the night moods' lightning: nothing strobes on a Clear Skies run.
        p.massif.lava = 0.7;
        p.massif.flow = 1;
        p.deck.glow = c('#FF5A1E');
        p.embers = 1.3;
        p.bloom = 0.7;
        p.giftGlow = 0.6;
        p.ghostGlow = 1.75;
        p.lanternGlow = 0.5;
      },
    },
  ],
  blossom: [
    {
      // The mist lifts off the cone and the sun climbs out of it.
      from: 400, at: 1600, dusk: 0,
      edit: (p) => {
        setSun(p, -28, 27, 36, 19);
        p.sunDisc = 1;
        p.sunSoft = 0.2;
        p.skyZenith = c('#90C4CC');
        p.skyMid = c('#C6E2D8');
        p.skyHorizon = c('#FFF4E2');
        p.fogNear = 120;
        p.fogFar = 720;
        p.massif.veil = 0;
        p.shadowK = 0.95;
        p.atmo.valley = 0.55;
        p.atmo.drift = 0.15;
        p.grade.contrast = 1.06;
      },
    },
    {
      // A clear spring day with the wind in the blossom.
      from: 2400, at: 3400, dusk: 0.5,
      edit: (p) => {
        p.sunColor = c('#FFF8EE');
        p.skyZenith = c('#7FB4D0');
        p.skyMid = c('#BCDCE0');
        p.clouds.low = 0.5;
        p.clouds.high = 0.5;
        p.petals = 1.1;
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

/** Clear Skies' palette `metres` into a run, written into out (which must not be one of the cached
 *  stops). Chaos moods keep their own palette: the caller only calls this for Mood.None. */
export function journeyPalette(biome: BiomeId, metres: number, out: Palette): Palette {
  const st = journeyStops(biome);
  const at = journeyProgress(biome, metres);
  const i = Math.min(Math.floor(at), st.length - 2);
  return lerpPalette(st[i], st[i + 1], at - i, out);
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
