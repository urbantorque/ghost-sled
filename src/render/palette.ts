import { Color, Vector3 } from 'three';
import { Mood } from '../sim/chaos';
import { BiomeId } from '../sim/mountains';

// Per-biome base palettes (Clear Skies) and per-mood overrides. See ART.md section 7.

export interface Palette {
  skyZenith: Color;
  skyHorizon: Color;
  /** Colour the gradient passes through halfway up; null blends zenith and horizon evenly. */
  skyMid: Color | null;
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
   *  below the horizon is, and the volcano's crater glow. */
  massif: { peak: HeroPeak; rock: Color; glow: Color; glowK: number; glowLine: number; veil: number; sea: number; lava: number };
  /** grain: film grain strength (night moods run light, where grain reads as digital noise in the
   *  dark). foot: how much the bottom edge of the frame darkens and cools (see post.ts). */
  grade: { lift: Color; gain: Color; saturation: number; contrast: number; grain: number; foot: number; shafts: number };
  /** Painted gouache clouds in the sky dome (sky.ts): low cumulus banks along the horizon and high
   *  wisps (coverage 0..1 each), their sunlit tops, shaded bodies and the low sun's rim on their edges.
   *  shadow: how strongly their slow shadows drift over the snow (materials.ts, 0 for none). */
  clouds: { low: number; high: number; top: number; lit: Color; shade: Color; rim: Color; shadow: number };
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
    massif: { peak: 'summit', rock: c('#5A4E7A'), glow: c('#FF9AA2'), glowK: 0, glowLine: -6000, veil: 0, sea: 1, lava: 0 },
    grade: { lift: c('#0A0F2A'), gain: c('#FFF8F0'), saturation: 1.08, contrast: 1.04, grain: 1, foot: 0.3, shafts: 1 },
    clouds: { low: 0.8, high: 0.6, top: 0.3, lit: c('#FFE6CF'), shade: c('#A48CC0'), rim: c('#FFB088'), shadow: 0.3 },
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
      p.grade = { lift: c('#20283A'), gain: c('#F2F6FF'), saturation: 0.85, contrast: 1.04, grain: 0.8, foot: 0.14, shafts: 0 };
      // The whiteout is its own cloud deck: no painted banks in it and no shadows sliding over the snow.
      p.clouds = { low: 0, high: 0, top: 0.1, lit: c('#F2F4F8'), shade: c('#AEB8C8'), rim: c('#F2F1EA'), shadow: 0 };
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
      p.grade = { lift: c('#03061A'), gain: c('#E8ECFF'), saturation: 1.05, contrast: 1.06, grain: 0.4, foot: 0.2, shafts: 0 };
      // A low, dark bank with moonlit silver edges under the aurora, which keeps the sky above it.
      p.clouds = { low: 0.6, high: 0.18, top: 0.24, lit: c('#4A5A9C'), shade: c('#121A42'), rim: c('#C4D0FF'), shadow: 0 };
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
      p.grade = { lift: c('#021624'), gain: c('#FFFCF4'), saturation: 1.1, contrast: 1.08, grain: 1, foot: 0.24, shafts: 0.8 };
      // Clear, cold air: only a few thin high wisps, gold where the low sun catches them.
      p.clouds = { low: 0, high: 0.4, top: 0.1, lit: c('#F4FCFF'), shade: c('#8CC8E6'), rim: c('#FFDDA0'), shadow: 0.12 };
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
      p.grade = { lift: c('#0E0420'), gain: c('#FAF0FF'), saturation: 1.0, contrast: 1.07, grain: 0.45, foot: 0.26, shafts: 0 };
      // A dusk bank on the ember horizon, its undersides glowing ember; the comet keeps the sky above.
      p.clouds = { low: 0.65, high: 0.15, top: 0.2, lit: c('#5E3268'), shade: c('#2A1642'), rim: c('#FF7A4C'), shadow: 0 };
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
      p.grade = { lift: c('#03100C'), gain: c('#E8FFF4'), saturation: 0.95, contrast: 1.08, grain: 0.45, foot: 0.1, shafts: 0 };
      p.clouds = { low: 0.5, high: 0.12, top: 0.22, lit: c('#3E7464'), shade: c('#0E2A24'), rim: c('#9CFFD8'), shadow: 0 };
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
      p.grade = { lift: c('#061430'), gain: c('#FFFFFF'), saturation: 1.1, contrast: 1.02, grain: 1, foot: 0.26, shafts: 0.5 };
      // Fair-weather puffs low on the horizon and a few high wisps, white on blue.
      p.clouds = { low: 0.4, high: 0.3, top: 0.24, lit: c('#FFFFFF'), shade: c('#B4CCEC'), rim: c('#FFFFFF'), shadow: 0.22 };
      break;
  }
  // Biomes and moods author sunDir as where the disc sits; the key light is lifted from it.
  if (p.diskDir === p.sunDir || mood !== Mood.None || biome !== 'alpine') {
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

const DEG = Math.PI / 180;
const elevationOf = (v: Vector3) => Math.asin(Math.max(-1, Math.min(1, v.y))) / DEG;
/** The same bearing at another elevation (degrees). */
const atElevation = (v: Vector3, el: number) => sunDir(Math.atan2(v.x, -v.z) / DEG, el);

interface JourneyStop {
  zenith: string; mid: string; horizon: string; below: string; sky: number;
  sun: string; sunK: number; discEl: number; lightEl: number; shadowMinEl: number;
  snowLit: string; litK: number; snowShade: string; shadeK: number; snowDeep: string; deepK: number;
  rim: string; rimK: number; fog: string; fogK: number; hemi: string; hemiK: number;
  ridge: [string, string, string]; ridgeK: number;
  /** The alpenglow on the peaks' snow (palette massif.glowK) and the height it has climbed to. */
  glowK: number; glowLine: number;
  gain: string; gainK: number; lift: string; liftK: number;
  cloudLit: string; cloudShade: string; cloudRim: string; cloudK: number;
}

/** About 2 km in: deeper alpenglow. The sun sits lower and warmer, the horizon burns coral, the zenith
 *  deepens and the snow's shade leans violet, with longer shadows. */
const ALPENGLOW: JourneyStop = {
  zenith: '#22357E', mid: '#C27A9C', horizon: '#FF946C', below: '#C7A2D2', sky: 0.5,
  sun: '#FFD0A4', sunK: 0.55, discEl: -3.5, lightEl: -4, shadowMinEl: 11,
  snowLit: '#FFF0E4', litK: 0.5, snowShade: '#8A84D8', shadeK: 0.3, snowDeep: '#4A4AB0', deepK: 0.2,
  rim: '#FFAE8C', rimK: 0.5, fog: '#E8A2A4', fogK: 0.45, hemi: '#9A98E2', hemiK: 0.3,
  ridge: ['#D6A8CA', '#9C7CBA', '#5E5296'], ridgeK: 0.45,
  glowK: 1, glowLine: -120,
  gain: '#FFF0E0', gainK: 0.6, lift: '#120E30', liftK: 0.3,
  cloudLit: '#FFD2B4', cloudShade: '#9A7AB4', cloudRim: '#FF946A', cloudK: 0.55,
};

/** From about 3.5 km: blue hour. The sky cools to deep blue over a dusky rose horizon, the sun sinks to
 *  touch the ridge, the snow turns periwinkle, and gifts, ghosts and a sled lantern glow stronger. */
const BLUE_HOUR: JourneyStop = {
  zenith: '#111A4C', mid: '#5E5AA0', horizon: '#EE9A86', below: '#8A84B8', sky: 0.72,
  sun: '#FFC0A0', sunK: 0.6, discEl: -7.6, lightEl: -7, shadowMinEl: 8,
  snowLit: '#DCDCF4', litK: 0.6, snowShade: '#6870C6', shadeK: 0.5, snowDeep: '#363C96', deepK: 0.5,
  rim: '#D4AEF0', rimK: 0.45, fog: '#8C86BA', fogK: 0.55, hemi: '#6E7CC8', hemiK: 0.5,
  ridge: ['#9C8CC4', '#6A5C9E', '#3C3878'], ridgeK: 0.6,
  glowK: 0.75, glowLine: 520,
  gain: '#EAECFF', gainK: 0.45, lift: '#0A0C30', liftK: 0.5,
  cloudLit: '#B8A0D0', cloudShade: '#4E4A8E', cloudRim: '#FF9C7C', cloudK: 0.7,
};

function journeyStop(base: Palette, s: JourneyStop, dusk: number): Palette {
  const p = lerpPalette(base, base, 0, getPaletteShell());
  const tow = (col: Color, hex: string, k: number) => col.lerp(c(hex), k);
  tow(p.skyZenith, s.zenith, s.sky);
  if (p.skyMid) tow(p.skyMid, s.mid, s.sky);
  tow(p.skyHorizon, s.horizon, s.sky * 0.85);
  tow(p.skyBelow, s.below, s.sky * 0.7);
  tow(p.sunColor, s.sun, s.sunK);
  p.diskDir = atElevation(p.diskDir, Math.max(3.4, elevationOf(p.diskDir) + s.discEl));
  p.sunDir = atElevation(p.sunDir, Math.max(17, elevationOf(p.sunDir) + s.lightEl));
  p.shadowMinEl = s.shadowMinEl;
  p.shadowDir = shadowFrom(p.sunDir, p.shadowSwing, p.shadowMinEl);
  tow(p.snowLit, s.snowLit, s.litK);
  tow(p.snowShade, s.snowShade, s.shadeK);
  tow(p.snowDeep, s.snowDeep, s.deepK);
  tow(p.rim, s.rim, s.rimK);
  tow(p.fog, s.fog, s.fogK);
  tow(p.hemiSky, s.hemi, s.hemiK);
  p.ridge.forEach((r, i) => tow(r, s.ridge[i], s.ridgeK));
  p.massif.glowK = s.glowK;
  p.massif.glowLine = s.glowLine;
  tow(p.grade.gain, s.gain, s.gainK);
  tow(p.grade.lift, s.lift, s.liftK);
  tow(p.clouds.lit, s.cloudLit, s.cloudK);
  tow(p.clouds.shade, s.cloudShade, s.cloudK);
  tow(p.clouds.rim, s.cloudRim, s.cloudK);
  // Dusk: the glows the dark brings out (the gift, ghost and lantern signals keep their own colours).
  p.sunSize *= 1 + 0.15 * dusk;
  p.sunGlow *= 1 + 0.25 * dusk;
  p.bloom += 0.16 * dusk;
  p.giftGlow = Math.max(p.giftGlow, 0.45 * dusk);
  p.ghostGlow += 0.25 * dusk;
  p.lanternGlow = Math.max(p.lanternGlow, 0.5 * dusk);
  p.stars = Math.max(p.stars, 0.35 * dusk);
  p.sparkle *= 1 - 0.15 * dusk;
  p.clouds.shadow *= 1 - 0.6 * dusk;
  return p;
}

/** A blank palette for lerpPalette to fill (it creates every field on the first blend). */
function getPaletteShell(): Palette {
  return {} as Palette;
}

const STOPS = new Map<BiomeId, [Palette, Palette, Palette]>();

/** How far along the journey a run is, as the weights of its two later stops: golden at the start,
 *  full alpenglow by about 2 km, blue hour from about 3.5 km (full by 4 km). Smooth, so no step shows. */
export function journeyWeights(metres: number): { alpenglow: number; blue: number } {
  const s = (x: number) => {
    const k = Math.max(0, Math.min(1, x));
    return k * k * (3 - 2 * k);
  };
  return { alpenglow: s((metres - 200) / 1800), blue: s((metres - 3000) / 1000) };
}

/** Clear Skies' palette `metres` into a run, written into out (which must not be one of the cached
 *  stops). Chaos moods keep their own palette: the caller only calls this for Mood.None. */
export function journeyPalette(biome: BiomeId, metres: number, out: Palette): Palette {
  let st = STOPS.get(biome);
  if (!st) {
    const g = getPalette(biome, Mood.None);
    st = [g, journeyStop(g, ALPENGLOW, 0), journeyStop(g, BLUE_HOUR, 1)];
    STOPS.set(biome, st);
  }
  const w = journeyWeights(metres);
  lerpPalette(st[0], st[1], w.alpenglow, out);
  if (w.blue > 0) lerpPalette(out, st[2], w.blue, out);
  return out;
}
