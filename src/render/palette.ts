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
   *  Skies); 0 keeps them gaps in a sea of cloud. seaWarm lights the sea from beneath in patches, in the
   *  deck's glow colour (Lanternfall: the valley of lanterns under the cloud). bands lays mist in three
   *  layers across the panorama's lower slopes (Sakura's run-in: the mist lifting off the cone). */
  massif: { peak: HeroPeak; rock: Color; glow: Color; glowK: number; glowLine: number; veil: number; sea: number; lava: number; flow: number; heroAz: number; seaIce: number; seaWarm: number; bands: number };
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
  /** Low's painted pools (lights.ts): 0 adds the light in two flat values; 1 lays it over the snow in the
   *  light's own hue without clipping (Ember: added to a coloured snow, they clipped to mustard). */
  poolSoft: number;
  /** How much a canopy glows with the light behind it (Sakura's blossom). */
  leaf: number;
  /** The visual lift's light (materials.ts LIFT_GLSL, the light lane). bounce: how much light the snow
   *  throws back up onto what faces sideways and down; sun: the share of the snow round the lens in the
   *  key light (1 the bounce is the lit snow's colour, 0 the shade's: warm in the sun, cool in a slot or a
   *  street); tint: what the place colours it (white: the snow's own); sky: the sky's fill by the way a
   *  face is turned; through: light through what is thin with the key behind it (blossom and foliage, ice,
   *  the ghosts' glass); sheen: the snow's sheen at a grazing angle toward the light. All 0 is round 7. */
  lift: { bounce: number; sun: number; tint: Color; sky: number; through: number; sheen: number };
  /** How much of the lit snow's colour Low's poster keeps (1: all of it). With no film to roll it off, a
   *  warm light on the snow that reads as light on High reads as sand on Low. */
  posterSnowSat: number;
  /** Low's poster (the visual lift, ART.md 15 "Tiers, designed"): what Low paints where the other tiers
   *  draw an effect. None of it touches another tier. See PosterLook below. */
  poster: PosterLook;
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

/** Low's poster: the stylised tricks Low draws instead of the effects it cannot afford (ART.md 15, "Tiers,
 *  designed"). Read only on Low (materials.ts POSTER_GLSL, poster.ts, sky.ts); blended like every field. */
export interface PosterLook {
  /** The painted rim on silhouettes, in the key light's colour: a hard band of it on the edge that faces the
   *  light, all round when the light is behind (0: none). The hero takes `hero`. */
  rim: number;
  hero: number;
  /** Painted shafts (poster.ts): how much of the grade's `shafts` Low paints as cards fanning from the disc. */
  shafts: number;
  /** The frame's foot: the lower frame laid over with the shade's colour, so the near snow has a value
   *  under the rider (High's cool foot, painted). And the corners, a little. */
  foot: number;
  vignette: number;
  /** The sky in steps: how many flat bands its gradient is painted in (0: smooth), and the horizon's band
   *  as a printed stripe of its colour (0: the soft glow every tier has, 1: a flat stripe). */
  bands: number;
  stripe: number;
  /** The sun's scatter on the dome in rings: how many (0: the smooth glow). */
  rings: number;
  /** The snow's light in flat values: how many steps from shade to lit (2: shade, a middle and lit; 0: the
   *  smooth ramp every other tier draws), and how soft each step's edge is (a share of a step, 0 to 0.5). */
  steps: number;
  soft: number;
  /** A cast shadow as Low paints it (the far shadow field, when it lands: POSTER_GLSL posterShadow): the
   *  colour it leans to, how far (0: the snow's own shade, as every tier), and how hard its edge is (0: as
   *  the field gives it, 1: cut). */
  shadow: Color;
  shadowK: number;
  edge: number;
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
  /** How much of the glass shows at speed (post.ts GradeParams.glass; 1 when left out). */
  glass?: number;
  /** How much of a beat's white flash shows (post.ts GradeParams.flash; 1 when left out). */
  flash?: number;
  tone?: number;
  exposure?: number;
  hi?: Color;
  lo?: Color;
  /** Low's poster only: how far the lit snow is pulled back toward white of its own value after the
   *  grade is baked in (0: none). A gold hour tints the snow twice on Low, by the light and by the
   *  baked grade, and at full strength the slopes read as sand. */
  posterSnow?: number;
  /** Low's poster only: the brightest the lit snow is drawn, its strongest channel (0: no limit). A
   *  morning baked through the grade and the curve reached paper white on Low, and a slope with no
   *  shadow on it then had no form at all. */
  posterKey?: number;
  /** Low's poster only: how far the lit snow leans to the baked shade's hue (0: none). With no cast
   *  shadow and no curve to cool it, the lit snow on Low was a neutral grey-white, read as paper. */
  posterCool?: number;
  /** Low's poster only: how far the baked shade is pulled toward its own grey (0: none). A gold hour's
   *  violet shade, baked through a raised saturation, lay on Low's banks as a cobalt stain. */
  posterMute?: number;
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
    massif: { peak: 'summit', rock: c('#5A4E7A'), glow: c('#FF9AA2'), glowK: 0, glowLine: -6000, veil: 0, sea: 1, lava: 0, flow: 0, heroAz: 0, seaIce: 0, seaWarm: 0, bands: 0 },
    grade: { lift: c('#0A0F2A'), gain: c('#FFF8F0'), saturation: 1.08, contrast: 1.04, grain: 1, foot: 0.3, shafts: 1, lens: 1, focal: 1, gust: 0, glitter: 0.15 },
    clouds: { low: 0.8, high: 0.6, top: 0.3, lit: c('#FFE6CF'), shade: c('#A48CC0'), rim: c('#FFB088'), shadow: 0.3 },
    deck: { k: 0, lit: c('#FFFFFF'), shade: c('#FFFFFF'), glow: c('#FFFFFF') },
    atmo: { rays: 1, halo: 0, meteors: 0, banner: 0.8, slide: 1, sweep: 1, valley: 0.7, valleyColor: c('#E8C4C8'), drift: 0.3 },
    air: { far: c('#9A8AC6'), cool: c('#F0F2FF'), low: 0.35, scatter: 1 },
    key2: { color: c('#58E0A8'), k: 0, shade: c('#5A46B0') },
    under: { color: c('#FF6A28'), k: 0 },
    lamps: 0.25,
    poolSoft: 0,
    leaf: 0,
    lift: { bounce: 0, sun: 0.7, tint: c('#FFFFFF'), sky: 0, through: 0, sheen: 0 },
    posterSnowSat: 1,
    // (After the lane's critic: no rings by default, a hard-edged disc round the sun read as a sticker; the snow's
    // steps softer, hard-edged they turned the macro tone into camouflage; a cast shadow's edge only a little
    // harder than the field gives it; the hero's rim stronger, it was not seen. After the merge's critics: the
    // snow in one smooth ramp here (Pinecrest), since stepped, the far shadows' soft fall-off on Low printed
    // as hard pale islands, a tree run's floor read as a river; the shade a periwinkle, not cobalt. Frostfang,
    // Ember and Lanternfall keep their two steps.)
    poster: { rim: 0.55, hero: 1.3, shafts: 1, foot: 0.3, vignette: 0.2, bands: 5, stripe: 0.5, rings: 0, steps: 0, soft: 0.3, shadow: c('#5C6CC4'), shadowK: 0.3, edge: 0.2 },
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
    case 'lantern':
      // What the chaos moods stand on at Lanternfall: lilac snow, ink stone and trees, violet ranges.
      p.skyZenith = c('#2A2C8C');
      p.skyHorizon = c('#E8B4C8');
      p.skyMid = c('#8C78C4');
      p.skyBelow = c('#B8A8DC');
      p.sunColor = c('#F4E8F4');
      p.sunDir = sunDir(18, 16);
      p.snowLit = c('#F4F0FC');
      p.snowShade = c('#8478CC');
      p.snowDeep = c('#4C3C9C');
      p.rim = c('#F0D8F0');
      p.fog = c('#D2C2E2');
      p.hemiSky = c('#A294E4');
      p.tall = c('#26223C');
      p.tallDark = c('#14122A');
      p.low = c('#2E2A4A');
      p.lowLit = c('#5A5484');
      p.ridge = [c('#C6BCE4'), c('#9486CC'), c('#5E52A4')];
      p.massif.rock = c('#3A3470');
      p.massif.glow = c('#FFC0A8');
      p.clouds = { low: 0.8, high: 0.5, top: 0.3, lit: c('#F4E6F2'), shade: c('#A092CC'), rim: c('#FFC8B4'), shadow: 0.25 };
      p.atmo.valleyColor = c('#DCCCE8');
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
      visualLift(p, biome);
      break;
    case Mood.Blizzard:
      p.skyZenith = c('#6D7C93');
      p.skyHorizon = c('#C9D2DE');
      p.skyMid = null;
      p.skyBelow = c('#B8C3D2');
      p.sunColor = c('#F2F1EA');
      // (Low's poster: an overcast sky has no bands, no rings and almost no rim to paint; the light is flat.)
      Object.assign(p.poster, { rim: 0.2, bands: 0, stripe: 0, rings: 0, steps: 0 });
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
  p.grade.glass ??= 1;
  p.grade.flash ??= 1;
  p.grade.exposure ??= 1;
  p.grade.hi ??= new Color(1, 1, 1);
  p.grade.lo ??= new Color(1, 1, 1);
  p.grade.posterSnow ??= 0;
  p.grade.posterKey ??= 0;
  p.grade.posterCool ??= 0;
  p.grade.posterMute ??= 0;
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
      // (Round 7's review: the disc sits low over the band, a blue hour's sun and not a day's. The run-in
      // read as a bright noon: the snow is now two blues, a pale steel lit side and a cobalt shade, with
      // the lemon only on its rim and in the band; the sky is a step deeper and the low sun throws no
      // starburst, so the Fang and the far ranges stand dark against the band. At the merge its horizon went
      // a step paler and its lit snow a step bluer, so its start stays its own beside Lanternfall's darker
      // night.)
      setSun(p, -35, 3.9, 19, 9);
      p.sunColor = c('#FFE9AE');
      p.sunCore = new Color(2.5, 2.3, 1.3);
      p.sunTint = 0.85;
      p.sunSize = 0.75;
      p.sunGlow = 0.45;
      p.skyZenith = c('#0A2266');
      p.skyMid = c('#2856A8');
      p.skyHorizon = c('#A2C4EC');
      p.skyBand = { color: c('#FFE98C'), fade: 30, k: 0.95 };
      p.skyBelow = c('#5E80C0');
      p.skySpread = 0.62;
      p.skyCurve = 0.44;
      p.snowLit = c('#B2CAF0');
      p.snowShade = c('#4268B8');
      p.snowDeep = c('#183584');
      p.rim = c('#FFEB9E');
      p.fog = c('#7094D2');
      p.fogNear = 50;
      p.fogFar = 470;
      p.hemiSky = c('#5C88D8');
      p.tall = c('#2C8CCC');
      p.tallDark = c('#114A8A');
      p.low = c('#1E3A6E');
      p.lowLit = c('#3E6AA4');
      // (The ice spires along the banks are the frame's darks in the blue hour, not pale shapes in the sun:
      // they go down a step and the air pales their crowns less.)
      p.hazardDim = 0.78;
      p.hazardFog = 0.65;
      p.sunDisc = 0.55;
      p.ridge = [c('#5E80C6'), c('#33529E'), c('#162E72')];
      p.massif.rock = c('#0E1A4A');
      p.massif.glow = c('#FFEFB0');
      p.massif.heroAz = 17;
      p.massif.sea = 0.8;
      p.massif.flow = 0.35;
      // (Round 7's review: the ranges are in the blue hour's shade below the summits, so the Fang stands
      // dark against the band with only its crown still in the last lemon light.)
      p.massif.glowLine = 1450;
      p.massif.glowK = 0.55;
      p.ice = 0.6;
      p.grade = { lift: c('#030A26'), gain: c('#F0F5FF'), saturation: 1.1, contrast: 1.12, grain: 0.7, foot: 0.3, shafts: 0.3, lens: 0.25, focal: 1, gust: 0, glitter: 0.25 };
      // (Low's poster: the blue hour in printed steps of cobalt over the thin lemon band, a line of it printed
      // over its glow, ART.md 15.)
      Object.assign(p.poster, { steps: 2, bands: 6, stripe: 0.6, rim: 0.6, shadow: c('#3A2E9A'), shadowK: 0.35 });
      p.clouds = { low: 0.3, high: 0.35, top: 0.13, lit: c('#AFC6EC'), shade: c('#34559E'), rim: c('#FFEFAE'), shadow: 0.08 };
      p.atmo = { rays: 0.25, halo: 0, meteors: 0.2, banner: 1, slide: 1, sweep: 0.3, valley: 0.6, valleyColor: c('#6084C8'), drift: 0.1 };
      p.stars = 0.7;
      p.bloom = 0.5;
      // (Fewer, finer glints: a field of them read as noise on the blue snow.)
      p.sparkle = 0.65;
      p.snowfall = 0.03;
      p.giftGlow = 0.2;
      p.ghostGlow = 1.35;
      p.lanternGlow = 0.2;
      return;
    case 'volcanic':
      // Under ash: a heavy overcast of smoke lit from below, a dim orange disc, ash-grey snow, and the
      // volcano dead ahead at the end of the valley. Warmth stays in the sky so the snow still sets off
      // the rider's vermillion and the gifts' marigold.
      // (The key well above the slope, decision 27: at 30 degrees every face turned downhill sat half lit,
      // where a warm lit side and a cold shade mixed to grey-mauve.)
      setSun(p, 34, 15, 44, 15);
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
      // The valley below is a sea of smoke lit from beneath in pools. (At half cover its gaps were cold
      // navy lakes in peach billows: a camouflage that read as neither cloud nor lava.)
      p.massif.sea = 1.25;
      p.massif.seaWarm = 1.4;
      // (The crater glows and the flanks run from the start line: at 0.6 the cone read as a dull brown
      // triangle. Kept under the 0.75 that wakes the night moods' lightning.)
      p.massif.lava = 0.72;
      p.massif.flow = 0.75;
      p.deck = { k: 0.85, lit: c('#54403E'), shade: c('#241A20'), glow: c('#FF6A28') };
      // (Smoke, lit from below: pale billows over the valley read as a beige plain with black holes.)
      p.clouds = { low: 0.7, high: 0, top: 0.16, lit: c('#5A2A26'), shade: c('#24141A'), rim: c('#FF7A38'), shadow: 0 };
      p.shadowK = 0.7;
      p.grade = { lift: c('#120A10'), gain: c('#FFF4EA'), saturation: 1.06, contrast: 1.06, grain: 0.8, foot: 0.3, shafts: 0, lens: 0, focal: 0.8, gust: 0, glitter: 0 };
      // (Low's poster: the deck's glow in four steps, no rings round a dim coin. The frame's foot shallow: at
      // 0.34 the merge's critic saw Ember's warm snow turn to brown mud across the bottom of most Low frames.)
      Object.assign(p.poster, { steps: 2, bands: 4, stripe: 0, foot: 0.16, shadow: c('#3A2A55'), shadowK: 0.15 });
      p.atmo = { rays: 0.25, halo: 0, meteors: 0, banner: 0, slide: 0, sweep: 0.2, valley: 0.8, valleyColor: c('#8A4A38'), drift: 0.4 };
      // (Bloom kept for the fire: more washed the planes together and bleached the coat.)
      p.bloom = 0.42;
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
      // (Low's poster: the calm mountain, low contrast on purpose: three soft steps of peach sky, a light foot, the snow
      // in its smooth light: in flat steps its banks read as camouflage.)
      Object.assign(p.poster, { bands: 3, stripe: 0, steps: 0, foot: 0.2, vignette: 0.14, shadow: c('#7A6CC0'), shadowK: 0.3 });
      p.atmo = { rays: 0.8, halo: 0, meteors: 0, banner: 0.3, slide: 0, sweep: 0.2, valley: 1, valleyColor: c('#FFE4D2'), drift: 0.7 };
      p.bloom = 0.22;
      p.sparkle = 0.6;
      p.snowfall = 0;
      p.giftGlow = 0.2;
      p.ghostGlow = 1.5;
      return;
    case 'lantern':
      // The Crown, at the end of night above a sea of cloud (ART.md 15): an indigo zenith full of stars, a
      // great pale moon off to the right, silver on the snow's lit side and lilac in its shade, ink for
      // everything that stands. The cloud below is lit warm in patches by what is under it.
      // (The moon at 9.5 degrees, right of the run: at 15 it stood at the frame's top edge or under the
      // HUD in every frame down the Crown.)
      setSun(p, 17, 9.5, 42, 12);
      p.moon = true;
      // (The run's gates and marks are bronze here: the rider's vermillion is the one red on this mountain.)
      p.accentProp = c('#B88A4A');
      p.moonPhase = 0;
      p.sunColor = c('#E6EAFF');
      p.sunCore = new Color(1.9, 1.95, 2.3);
      p.sunTint = 0.9;
      p.sunSize = 1.75;
      p.sunGlow = 0.85;
      p.skyZenith = c('#0B0A3E');
      p.skyMid = c('#1C1868');
      p.skyHorizon = c('#5648B0');
      p.skyBand = { color: c('#A898E4'), fade: 26, k: 0.4 };
      p.skyBelow = c('#2E2674');
      p.skySpread = 0.6;
      p.skyCurve = 0.5;
      // (A value under white: at #E8EAFC the snow was the brightest thing in a night frame, brighter than the
      // lamps, and the moon's silver rim could not be read on it.)
      p.snowLit = c('#D4D6F4');
      p.snowShade = c('#5E52B8');
      p.snowDeep = c('#261C6C');
      p.rim = c('#EEF0FF');
      p.fog = c('#3A3096');
      p.fogNear = 60;
      p.fogFar = 560;
      p.hemiSky = c('#6C5ED0');
      p.tall = c('#1C1934');
      p.tallDark = c('#0E0C20');
      p.low = c('#242040');
      p.lowLit = c('#4C4678');
      p.hazardDim = 0.9;
      p.ridge = [c('#5A50AE'), c('#342C84'), c('#1C1858')];
      p.massif.rock = c('#191646');
      p.massif.glow = c('#FFC49C');
      p.massif.heroAz = -18;
      p.massif.sea = 1;
      p.massif.seaWarm = 0.75;
      p.deck = { k: 0, lit: c('#8E82CE'), shade: c('#3C3284'), glow: c('#FFB24E') };
      p.grade = { lift: c('#08062A'), gain: c('#F4F2FF'), saturation: 1.1, contrast: 1.08, grain: 0.6, foot: 0.3, shafts: 0, lens: 0.1, focal: 0.9, gust: 0, glitter: 0.5 };
      // (Low's poster: the indigo night in six printed steps, a silver rim.)
      Object.assign(p.poster, { steps: 2, bands: 6, stripe: 0, rim: 0.6, vignette: 0.26, shadow: c('#2A2270'), shadowK: 0.35 });
      p.grade.saturation = 1.02;
      p.grade.contrast = 1.12;
      // (A night of point lights: at speed each lantern split into a red, a green and a blue one, and the
      // streaks drew every one as a dashed line. The glass stays out of this mountain's frames.)
      p.grade.glass = 0.15;
      // (A perfect landing's white flash, over a night frame, bleached the rider to cream.)
      p.grade.flash = 0.3;
      // (The sea's shade is a mid violet, not navy: at #352C84 its hollows were dark blots and the sea read as
      // a frozen lake under the moon.)
      p.clouds = { low: 0.25, high: 0.2, top: 0.12, lit: c('#A49CE0'), shade: c('#544A9E'), rim: c('#DCD6FF'), shadow: 0 };
      // (No 22 degree halo: with the moon in the frame it drew a ring across the whole sky.)
      p.atmo = { rays: 0, halo: 0, meteors: 0.35, banner: 0.6, slide: 0, sweep: 0.2, valley: 0.9, valleyColor: c('#8A78CC'), drift: 0.3 };
      p.stars = 1;
      p.bloom = 0.62;
      // (The moon's glints on the near snow: at 1.15 the near plane read as a featureless lilac wash.)
      p.sparkle = 1.7;
      p.snowfall = 0.02;
      p.giftGlow = 0.45;
      // (A night frame needs little of a ghost's glow to find it: at 1.6 to 2.6 a ghost near the lens was a mint blaze
      // over the rider and in the lantern sky, which belongs to marigold.)
      p.ghostGlow = 1.1;
      p.lanternGlow = 0.45;
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
      p.grade.shafts = 0.8;
      p.atmo.rays = 0.6;
      // The review's first pass: no frame of the morning showed where its light came from. The disc
      // sits lower and nearer the fall line (the key light keeps its height), so it stands just over the
      // frame's top right and its shafts fan down into the picture. The powder's glints are fewer: at
      // 1.25 the whole foreground was confetti.
      setSun(p, 24, 11, 44, 24);
      p.sparkle = 0.7;
      p.grade.glitter = 0.35;
      p.grade.lens = 0.15;
      // (Third pass: the lower half of a morning frame was one pale field with nothing painted in it, and
      // on Low paper white from the start to the lake. The exposure comes down a step, the cloud's
      // shadows cross the open slopes from the start line, and Low's lit snow stops short of paper.)
      p.grade.exposure = 1.0;
      p.grade.contrast = 1.12;
      p.clouds.shadow = 0.34;
      p.grade.posterKey = 0.92;
      p.grade.posterCool = 0.16;
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
      // The snow itself stays pale (a warm white): the light carries the orange, once. Tinted twice (a
      // pink-grey snow under an orange light) the slopes read as sand.
      p.sunColor = c('#FFDCC4');
      // (The lit side warm and bright, the shade a cold plum-slate: the pair is what reads as firelight
      // on snow. A near-white lit side read lilac-grey, and a saturated blue shade as a paint error.)
      // (Bright enough that the snow shader reads it as day and takes only a trace of the key's colour:
      // a warmer, darker lit snow took the key's orange as well, twice tinted, and Low read as dunes.)
      p.snowLit = c('#FFF0E6');
      // (Plum-slate: a bluer shade rendered as a saturated navy.)
      p.snowShade = c('#463E60');
      p.snowDeep = c('#2A2444');
      p.hemiSky = c('#5C5A78');
      p.fog = c('#5A3438');
      p.low = c('#1C181C');
      p.lowLit = c('#3A2C30');
      p.tall = c('#1E1A20');
      p.tallDark = c('#0E0C10');
      p.massif.rock = c('#140E12');
      p.air = { far: c('#3A1C24'), cool: c('#C4CCE4'), low: 0.6, scatter: 1.3 };
      // (Basalt and the rider take a hot edge from the deck and the lava from the first metre.)
      p.under = { color: c('#FF6A28'), k: 0.3 };
      p.lamps = 0.9;
      p.poolSoft = 1;
      // The smoke deck's own shadows drift over the slopes: the firelit snow lies in pools between
      // cold plum-teal shade, so a wide slope is never one even peach (which read as sand).
      p.clouds.shadow = 0.6;
      p.grade.exposure = 1.08;
      p.grade.saturation = 1.18;
      p.grade.contrast = 1.12;
      p.grade.hi = c('#FFE8CE');
      p.grade.lo = c('#CCE4F2');
      // (Glints: snow glitters in firelight, where sand would not.)
      p.sparkle = 0.9;
      return;
    case 'blossom':
      // A peach morning, not a yellow one: the light leans to rose, and the shafts are thin until the
      // orchards (a full fan of them over white snow washed the frame custard).
      p.sunColor = c('#FFF0E6');
      p.grade.shafts = 0.35;
      // (The lit snow takes the peach light, so it is not one lilac with the shade; Low's poster keeps only a
      // third of that colour, where with no film to roll it off it read as sand.)
      p.snowLit = c('#FFF2EA');
      p.posterSnowSat = 0.5;
      p.snowShade = c('#7E8CD6');
      p.snowDeep = c('#6452AC');
      p.fog = c('#F4DAD8');
      p.low = c('#2E2A44');
      p.lowLit = c('#5E5878');
      p.tall = c('#FF8EBC');
      p.tallDark = c('#96306A');
      p.air = { far: c('#9AB0DE'), cool: c('#E8EEFF'), low: 0.8, scatter: 1.3 };
      p.lamps = 0.3;
      // (The blossom is the light from the first metre: at 0.5 the canopies against the sun were lit pink
      // polyhedra, not light coming through them.)
      p.leaf = 0.9;
      p.grade.lift = c('#1A1E2A');
      p.grade.contrast = 1.1;
      p.grade.saturation = 1.12;
      p.grade.exposure = 0.96;
      p.grade.hi = c('#FFF5EE');
      p.grade.lo = c('#E2E0FF');
      // (A neutral gain and a pale blue sky light: the warm gain and the old celadon sky light took the lit
      // snow to tan on Low, where nothing rolls it off, and the shade toward green.)
      p.grade.gain = c('#FFFFFF');
      p.hemiSky = c('#D4DCF0');
      // Round 7's review. Peach mist, not cream (ART.md 15): the horizon, the air under it and the sea of
      // cloud were three creams, and with a celadon zenith over them the run-in read yellow-green. The
      // horizon is peach, the zenith a pale morning blue, and the cloud's shade is rose-lavender, so the
      // mist has a lit side and a shade side. The cone stands nearer the fall line (it was cut by the
      // frame's edge, and off a phone's altogether) and is a pale ghost from the first metre.
      p.skyZenith = c('#A4C4DC');
      p.skyMid = c('#EEDCDC');
      p.skyHorizon = c('#FFD8C6');
      p.skyBelow = c('#F4CFC6');
      p.fog = c('#F4D4D4');
      p.ridge = [c('#F2DAD6'), c('#D8CEDC'), c('#B4BAD8')];
      // (The cloud's shadows lie on the snow as big soft cool shapes, a middle value between the lit snow
      // and the shade: at 0.1 the slopes were one white sheet from the lens to the far bank. The frame's
      // foot holds a value frame round the rider.)
      p.clouds = { low: 0.3, high: 0.35, top: 0.16, lit: c('#FFEEE6'), shade: c('#D6BCCC'), rim: c('#FFC4AE'), shadow: 0.22 };
      p.grade.foot = 0.24;
      p.atmo.valleyColor = c('#FAD2C8');
      p.massif.heroAz = 17;
      // (A thin veil only: the bands below carry the mist, and the cone stands sunlit over them.)
      p.massif.veil = 0.05;
      // The mist lies on the cone's lower slopes in layers and its summit stands clear over them.
      p.massif.bands = 0.85;
      p.massif.glow = c('#FFBCA8');
      p.massif.glowK = 0.35;
      p.tallDark = c('#7E2459');
      return;
    case 'lantern':
      // The far plane is the night's own violet, the lit values lean silver and the shade lilac. Lamps are
      // the mountain's light from the first metre.
      p.air = { far: c('#221C6A'), cool: c('#DCD8FF'), low: 0.7, scatter: 1.1 };
      p.lamps = 1;
      p.grade.exposure = 1.0;
      p.grade.hi = c('#F4F6FF');
      p.grade.lo = c('#E6DCFF');
      return;
  }
}

/** The visual lift's light over each mountain's Clear Skies (the light lane, DECISIONS 361): the snow's
 *  bounce, the sky's fill, light through what is thin and the snow's sheen (Palette.lift). The chaos moods
 *  keep round 7's light (all 0). The journey's stops and the places shade it from here: a slot or a
 *  street is cooler (less of the snow round it in the sun), Ember's halls bounce the lava's orange,
 *  Lanternfall's lamp roads marigold, Frostfang's fields the aurora's teal. */
function visualLift(p: Palette, biome: BiomeId): void {
  switch (biome) {
    case 'alpine':
      p.lift = { bounce: 0.42, sun: 0.75, tint: c('#FFFFFF'), sky: 0.48, through: 0.6, sheen: 0.8 };
      return;
    case 'glacier':
      p.lift = { bounce: 0.38, sun: 0.65, tint: c('#FFFFFF'), sky: 0.5, through: 0.9, sheen: 0.7 };
      return;
    case 'volcanic':
      p.lift = { bounce: 0.36, sun: 0.6, tint: c('#FFE6D2'), sky: 0.34, through: 0.5, sheen: 0.55 };
      return;
    case 'blossom':
      // (The critic: at a sky of 0.46 and a peach bounce the spine's darks softened and the torii's plum went
      // toward crimson. A softer fill, and a bounce with no warmth of its own.)
      p.lift = { bounce: 0.32, sun: 0.8, tint: c('#F6F4F6'), sky: 0.3, through: 1, sheen: 0.7 };
      return;
    case 'lantern':
      p.lift = { bounce: 0.38, sun: 0.55, tint: c('#FFFFFF'), sky: 0.42, through: 0.6, sheen: 0.5 };
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
        // (The disc comes down over the valley's far side, inside the frame from the First Drop's lip on:
        // the cloud's shafts fall from it onto the lake.)
        setSun(p, 23, 9.5, 36, 18);
        p.sunColor = c('#FFF0D8');
        p.sunGlow = 1;
        p.skyZenith = c('#184A9E');
        p.skyMid = c('#6FA2D8');
        p.skyHorizon = c('#EDE8DC');
        p.fogFar = 600;
        p.clouds.low = 0.95;
        p.clouds.high = 0.8;
        p.clouds.top = 0.3;
        p.clouds.shadow = 0.44;
        p.clouds.lit = c('#FFF8EC');
        p.clouds.shade = c('#8FA6CE');
        p.atmo.rays = 0.75;
        p.grade.shafts = 1;
        p.grade.lens = 0.15;
      },
    },
    {
      // The gold comes: the sun drops under the cloud, honey light, long violet-blue shadows, the peaks
      // glowing, and the saturation rises. Gold against blue, never the old lilac.
      // (Full by the benches under the second leap: at 3250 the leap's own frames, 2430 to 2700, were
      // a quarter of the way there and read as beige. The disc stays inside the frame.)
      from: 2250, at: 2800, dusk: 0.55,
      edit: (p) => {
        setSun(p, 29, 8, 28, 13);
        // (Second pass: honey, not orange. At #FFDCA8 on cream snow under a 1.22 saturation the slopes
        // were peach dunes against electric ultramarine; the light pales, the shade goes to a quieter
        // violet-blue and the saturation rises less.)
        p.sunColor = c('#FFE2BA');
        p.sunCore.setRGB(3, 2.5, 1.7);
        p.sunTint = 0.6;
        p.sunSize = 1.1;
        p.sunGlow = 0.9;
        p.skyZenith = c('#1E4A96');
        p.skyMid = c('#A8BCCB');
        p.skyHorizon = c('#FFC98A');
        p.skyBelow = c('#E8C8A8');
        p.snowLit = c('#FFFAF0');
        // (Third pass: the second pass's quieter shade and a cream fog left the whole stretch one milky
        // cream with nothing in long shadow. The shade takes back a step of violet, and the air is a
        // deeper honey that holds its value, so the far planes and the shadows read against the light.)
        p.snowShade = c('#6670C6');
        p.snowDeep = c('#3A44A4');
        p.rim = c('#FFD2A0');
        p.fog = c('#DDB494');
        p.fogFar = 760;
        p.hemiSky = c('#8AA8E0');
        p.air.far = c('#7C80CA');
        p.air.scatter = 1.0;
        p.clouds.lit = c('#FFE0B4');
        p.clouds.shade = c('#7E8CB8');
        p.clouds.rim = c('#FFB86C');
        p.massif.glowK = 0.7;
        p.massif.glowLine = -60;
        p.atmo.rays = 0.8;
        p.grade.gain = c('#FFF9F0');
        p.grade.shafts = 1;
        p.grade.saturation = 1.16;
        p.grade.contrast = 1.17;
        p.grade.exposure = 0.97;
        p.grade.hi = c('#FFF4DE');
        p.grade.lo = c('#DCD8FF');
        p.grade.lens = 0.1;
        p.grade.posterSnow = 0.7;
        p.grade.posterMute = 0.3;
        p.sparkle = 0.6;
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
        setSun(p, 31, 5, 22, 11);
        p.sunColor = c('#FFDAB0');
        p.sunCore.setRGB(3, 2.1, 1.2);
        p.sunGlow = 0.8;
        p.grade.shafts = 0.7;
        p.grade.saturation = 1.1;
        p.skyZenith = c('#16306E');
        p.skyMid = c('#7A7CB8');
        p.skyHorizon = c('#FFB07A');
        p.skyBelow = c('#C89C98');
        p.snowLit = c('#FBEEE2');
        p.snowShade = c('#6068B8');
        p.snowDeep = c('#2A389C');
        p.fog = c('#D8B4B0');
        p.hemiSky = c('#7888D8');
        p.air.far = c('#6A6CB8');
        p.clouds.lit = c('#FFC89C');
        p.clouds.shade = c('#5E64A8');
        p.massif.glowK = 0.9;
        p.massif.glowLine = 120;
        p.grade.hi = c('#FFEED6');
        p.grade.lo = c('#DCDCFF');
        p.grade.posterSnow = 0.75;
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
      // The sun sinks onto the band and is gone by Serac Gate: the stars are out over the span.
      from: 480, at: 1340, dusk: 0.5,
      edit: (p) => {
        setSun(p, -40, 2.9, 19, 8);
        p.sunDisc = 0.3;
        p.sunGlow = 0.45;
        p.massif.rock = c('#0A1440');
        // (The light leaves the Fang's crown too: by the span it is one dark shape in the band.)
        p.massif.glowLine = 2400;
        p.grade.shafts = 0.2;
        p.sunColor = c('#FFE9B8');
        p.skyZenith = c('#071C5C');
        p.skyMid = c('#2553A8');
        p.skyHorizon = c('#8CAEE0');
        p.skyBand.color = c('#FFD97A');
        // Two blues and a lemon rim: the lit snow pales, the shade and the air go down a step under it.
        p.snowLit = c('#B2C4EA');
        p.snowShade = c('#3A58B0');
        p.snowDeep = c('#16297C');
        p.fog = c('#5A80CC');
        p.rim = c('#FFF0A0');
        p.grade.contrast = 1.13;
        p.stars = 0.9;
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
      // (It has come by the Crevasse Fields' leap: night falls over Station Street, whose lamps hold it off.)
      from: 1480, at: 1820, dusk: 1,
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
        // The night's three hues: moon-pale steel where the snow is lit, violet (not cobalt) in the shade,
        // and the aurora's green over both. The ice walls keep the cobalt to themselves.
        p.snowLit = c('#A6BAE8');
        p.snowShade = c('#3A3296');
        p.snowDeep = c('#181050');
        p.fog = c('#1E2268');
        p.hemiSky = c('#4A5CC0');
        p.rim = c('#9CF0D0');
        p.air.far = c('#101A58');
        p.key2 = { color: c('#44D8A2'), k: 1, shade: c('#5C3CC4') };
        p.grade.saturation = 1.0;
        // (Over 1: the curtains in the sky are bright enough to be what lights the snow.)
        p.aurora = 1.7;
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
        p.aurora = 1.3;
        p.key2.k = 0.7;
        p.lanternGlow = 0.6;
      },
    },
    {
      // Out of the cavern into the dawn: the sun comes up beside the Fang (it crosses the sky ahead while
      // the rider is under the ice, so the far mouth opens onto it), rose gold on the snow and the peaks,
      // the stars and the aurora fading out of a lightening sky.
      // (It turns in the cavern's first hundred metres, so the far mouth is the dawn from the moment it shows.)
      from: 3185, at: 3345, dusk: 1,
      edit: (p) => {
        setSun(p, 30, 3.6, 20, 9);
        p.sunColor = c('#FFC8A4');
        p.sunCore.setRGB(2.9, 2.1, 1.5);
        p.sunDisc = 1;
        p.sunGlow = 1.2;
        p.sunSize = 1.05;
        p.hazardDim = 0.88;
        p.hazardFog = 0.9;
        p.skyZenith = c('#1A3A86');
        p.skyMid = c('#7678C4');
        p.skyHorizon = c('#F2B49A');
        p.skyBand.color = c('#FFB884');
        p.skyBand.k = 1;
        p.skyBelow = c('#B88EB4');
        // (Round 7's review: rose-gold, not lilac: the lit snow takes the sun's warmth.)
        p.snowLit = c('#FFD8C4');
        // (Round 7's review: Fang Town sank into a lilac haze, the middle plane and the Fang lost in it. The
        // shade is a deeper violet and the air clearer, so the lit snow, the long shadows and the far range
        // stand in three planes.)
        p.snowShade = c('#4E54B2');
        p.snowDeep = c('#242C88');
        p.rim = c('#FFD2B4');
        p.fog = c('#8E84C2');
        p.fogFar = 620;
        p.hemiSky = c('#8A98DC');
        p.air.far = c('#7064B6');
        p.air.scatter = 1.15;
        p.key2.k = 0.06;
        p.clouds.lit = c('#FFD8C4');
        p.clouds.shade = c('#6A6AB4');
        p.clouds.rim = c('#FFBC8C');
        p.massif.rock = c('#222C70');
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
        setSun(p, 42, 11, 42, 14);
        p.sunDisc = 0.5;
        p.sunSoft = 0.6;
        // The deck closes: the top of the sky goes to smoke, the fire draws down to a band at the
        // horizon, and the slopes fall a stop, so the lava in the rock is what lights them.
        p.skyZenith = c('#0C080C');
        p.skyMid = c('#2E1618');
        p.skyHorizon = c('#C04A20');
        p.snowLit = c('#FAE8DE');
        p.snowShade = c('#3E3858');
        p.fogFar = 340;
        p.deck.k = 1;
        p.deck.lit = c('#3A2A2E');
        p.deck.shade = c('#160E14');
        p.grade.exposure = 1.02;
        p.grade.contrast = 1.15;
        p.embers = 1;
        p.under.k = 0.34;
      },
    },
    {
      // Out on the shield the deck is lit from below, and breathes.
      from: 1700, at: 2250, dusk: 0.7,
      edit: (p) => {
        setSun(p, 45, 8, 40, 13);
        p.sunDisc = 0.35;
        p.sunColor = c('#FFD4BC');
        p.skyHorizon = c('#E8521C');
        p.skyMid = c('#5A2018');
        p.deck.glow = c('#FF6A22');
        // (Lit from below: the deck's own body takes the fire, not only its far edge.)
        p.deck.lit = c('#8E3A1E');
        p.deck.shade = c('#3A1612');
        p.snowLit = c('#FFEEE2');
        p.grade.exposure = 1.08;
        p.grade.contrast = 1.12;
        p.under.k = 0.3;
        p.massif.lava = 0.68;
        p.massif.flow = 0.8;
        p.embers = 1.15;
        p.bloom = 0.48;
      },
    },
    {
      // A glowing dusk through the Basalt Halls: the sky goes dark, and the lava lights what is left of
      // it. The air is thick with ash and warm with light, never a grey fog with nothing in it.
      from: 2700, at: 3400, dusk: 1,
      edit: (p) => {
        setSun(p, 48, 6, 40, 13);
        p.sunDisc = 0.25;
        p.sunColor = c('#FFC8AC');
        p.skyZenith = c('#0E0A0E');
        p.skyMid = c('#36181C');
        p.skyHorizon = c('#E8481A');
        // As the day goes the light is the deck's and the lava's, and it is ember, not peach: a pale
        // light on a dusk snow gave a grey-mauve floor that nothing lit.
        p.sunColor = c('#FFB490');
        p.snowLit = c('#FCE6DA');
        p.snowShade = c('#3A3456');
        // The ash stands off the lens: thick from the first metre it turned the shade under it brown.
        p.fogNear = 60;
        p.fogFar = 430;
        p.snowDeep = c('#1C183C');
        // Ash with the lava's light in it: a deep ember red near, hotter with distance, and no cooling
        // away from the disc (cooled, it went to the grey the review saw at 3450 m).
        p.fog = c('#6E2C1E');
        p.air.far = c('#521A10');
        p.air.cool = c('#F0E0E0');
        p.under.k = 0.38;
        // Under the 0.75 that wakes the night moods' lightning: nothing strobes on a Clear Skies run.
        p.massif.lava = 0.7;
        p.massif.flow = 1;
        p.deck.glow = c('#FF5A1E');
        p.embers = 1.3;
        p.bloom = 0.52;
        p.giftGlow = 0.6;
        p.ghostGlow = 1.75;
        p.lanternGlow = 0.5;
        p.lamps = 1.1;
      },
    },
    {
      // Night under a red deck over Ash Market and the forge town: lanterns, forge mouths and windows
      // light the snow, the cone runs with lava behind the roofs.
      // (It has come by the market's bridge: begun at 3500 m, the bridge was still the halls' dusk.)
      // (Full night by the bridge: half blended there, the bridge was still the afternoon's orange.)
      from: 3400, at: 3540, dusk: 1,
      edit: (p) => {
        p.sunDisc = 0.12;
        // (A dim key under the dark deck: a peach one on the night's lilac snow read as candy pink.)
        p.sunColor = c('#D8B0A8');
        p.skyZenith = c('#0A0608');
        p.skyMid = c('#2C1014');
        p.skyHorizon = c('#9E2A10');
        // Night snow under a red deck is a cold lilac over plum, and the lamps are what is orange (a rose
        // snow under orange lamps went to brown mud). The deck darkens to embers: the town is lit by its
        // own windows and forges now, not by the sky.
        // (Darker than the lamps' pools, so the slopes are the dark plane and the town is the light: a
        // mid lilac read as mud lit by nothing.)
        p.snowLit = c('#A8A2C8');
        p.snowShade = c('#22244C');
        p.fog = c('#3C1416');
        p.deck.lit = c('#3A1616');
        p.deck.shade = c('#120A0E');
        p.deck.glow = c('#B4341A');
        // The cone runs with lava behind the roofs (kept under the lightning's 0.75).
        p.massif.lava = 0.74;
        p.massif.flow = 1;
        p.hazardDim = 0.9;
        p.lamps = 1.3;
        p.bloom = 0.6;
        p.grade.exposure = 1.04;
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
        p.skyZenith = c('#7EB4E0');
        p.skyMid = c('#CFE0EC');
        p.skyHorizon = c('#FFE4D6');
        p.skyBelow = c('#EED6D8');
        p.fog = c('#EED8DA');
        p.clouds.shade = c('#C4BCD8');
        p.atmo.valleyColor = c('#F0D8DC');
        p.fogNear = 120;
        p.fogFar = 720;
        p.massif.veil = 0;
        p.massif.bands = 0.4;
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
        p.sunColor = c('#FFF2E4');
        p.leaf = 1.6;
        // (The visual lift: the canopies are lit through most here.)
        p.lift.through = 1.25;
        p.atmo.rays = 1;
        p.grade.shafts = 0.75;
        p.snowShade = c('#7482D4');
        p.fog = c('#EEDADE');
        p.grade.saturation = 1.18;
        p.petals = 0.9;
        p.massif.bands = 0;
        p.clouds.shadow = 0.26;
      },
    },
    {
      // A clear, high frame: the cone sharp at last, the air blue behind it, a river of petals on the wind.
      from: 2100, at: 2450, dusk: 0.5,
      edit: (p) => {
        setSun(p, -28, 27, 36, 19);
        p.sunColor = c('#FFF8F2');
        // The sky comes down a full step under the snow, so the snow is the light and the cone stands
        // on blue: at one value with the snow the frame was paper.
        p.skyZenith = c('#4E94DC');
        p.skyMid = c('#94C4EA');
        p.skyHorizon = c('#D6DAF2');
        p.skyBelow = c('#B4C0EA');
        p.fog = c('#C0CAEE');
        p.fogFar = 1000;
        p.air.far = c('#7694DE');
        p.air.low = 0.6;
        p.snowShade = c('#5466CC');
        p.snowDeep = c('#43389E');
        p.grade.lift = c('#0C1020');
        p.tall = c('#FF7EB2');
        p.tallDark = c('#862660');
        // (The far range and the openings in the sea of cloud under it are the air's blue, not cobalt: a
        // saturated blue there read as camouflage blotches on the valley floor.)
        p.ridge = [c('#C6D0F0'), c('#A2B2E2'), c('#8E9ED6')];
        p.atmo.rays = 0.45;
        p.atmo.valleyColor = c('#C4CEF0');
        p.grade.shafts = 0.3;
        p.grade.contrast = 1.24;
        p.grade.hi = c('#FFF8F4');
        p.clouds.low = 0.5;
        p.clouds.high = 0.5;
        // (The sea of cloud and the valley's haze are lit white and shaded blue here: cream, they filled
        // the valley floor with custard under a blue sky. The sun's scatter and glow come down with them,
        // so the lit snow is white and only the shade carries colour.)
        p.clouds.lit = c('#F8F4FC');
        p.clouds.shade = c('#A4B2E4');
        p.clouds.rim = c('#FFE0DC');
        p.sunGlow = 0.4;
        p.air.scatter = 0.8;
        p.bloom = 0.17;
        p.massif.veil = 0;
        p.petals = 1.1;
        p.grade.exposure = 0.9;
        // (The valley under the Leap opens: the sea of cloud thins so the far plane is flat blue openings
        // between white, not one white floor, and the cloud's shadows break the slopes either side.)
        p.massif.sea = 0.8;
        p.clouds.shadow = 0.22;
        // Late morning's light on the snow is a warm cream (white, the Leap's slopes were one pale sheet).
        p.snowLit = c('#FFF2E6');
      },
    },
    {
      // Late morning, the clearest light on the mountain, over Temple Town.
      from: 3300, at: 3900, dusk: 0.6,
      edit: (p) => {
        p.skyZenith = c('#4A90DC');
        p.snowShade = c('#6C7CD4');
        p.snowDeep = c('#5448AC');
        p.grade.contrast = 1.16;
        p.petals = 1.3;
        p.lamps = 0.45;
        // (The clearest light on the mountain: the air thins so the town under the last leap and the pagoda
        // over the square stand in it, not a pale ghost of them.)
        p.fogFar = 1350;
        p.air.low = 0.4;
      },
    },
  ],
  lantern: [
    {
      // Under the deck. The change of hour is ridden blind, inside the Cloud Sea (PLACES below), so the
      // break at its foot opens on a different night: the moon gone behind a ceiling of cloud lit marigold
      // from beneath, and the valley's lanterns the light of the frame, from below and ahead.
      from: 900, at: 1420, dusk: 1,
      edit: (p) => {
        p.sunColor = c('#C0B4EC');
        p.sunDisc = 0;
        p.sunGlow = 0.2;
        p.skyZenith = c('#120E44');
        p.skyMid = c('#34267E');
        p.skyHorizon = c('#5A3E8C');
        p.skyBand = { color: c('#C88466'), fade: 26, k: 0.24 };
        // (What lies under the horizon in the valley is the dome's own below: the lanterns' lit haze, not a
        // dark hole for them to float in.)
        p.skyBelow = c('#4A3268');
        p.deck.k = 0.92;
        p.deck.lit = c('#5C50A6');
        p.deck.shade = c('#221A60');
        p.deck.glow = c('#8E5C8C');
        p.snowLit = c('#DAD8F6');
        p.snowShade = c('#6656B2');
        p.snowDeep = c('#2A1A6E');
        p.rim = c('#FFD9A0');
        p.fog = c('#3A2C80');
        p.fogFar = 640;
        // (Less of the sky's light between the lamps, so the Lamp Road's snow is lilac in pools of marigold
        // and not lilac all over.)
        p.hemiSky = c('#5E4EBC');
        p.air.far = c('#3A2670');
        p.air.low = 0.9;
        p.under = { color: c('#FFB04A'), k: 0.14 };
        p.atmo.valley = 1;
        p.atmo.valleyColor = c('#B27C62');
        p.atmo.meteors = 0;
        p.massif.sea = 0;
        p.massif.seaWarm = 0;
        p.massif.veil = 0.6;
        p.ridge = [c('#4A3E96'), c('#2C2470'), c('#181446')];
        p.massif.glow = c('#FFB870');
        p.massif.glowK = 0.5;
        p.massif.glowLine = -900;
        p.stars = 0.15;
        p.shadowK = 0.6;
        p.bloom = 0.78;
        p.lamps = 1.3;
        p.giftGlow = 0.6;
        p.ghostGlow = 1.2;
        p.lanternGlow = 0.6;
        p.grade.exposure = 1.0;
        p.grade.saturation = 1.0;
        p.grade.hi = c('#FFF6E8');
        p.grade.lo = c('#E2D6FF');
      },
    },
    {
      // Down to Firstlight: the deck thins and lifts off the far range, and the east begins to pale. The
      // hour turns here, so the town is a different picture from the Lamp Road: the air lighter and bluer,
      // the shade a cold blue-violet, the lamps no longer the only light, the lit snow taking a rose edge.
      from: 2900, at: 3600, dusk: 1,
      edit: (p) => {
        p.deck.k = 0.62;
        p.skyZenith = c('#1A1A5C');
        p.skyMid = c('#5444A0');
        p.skyHorizon = c('#9A66A4');
        p.skyBand = { color: c('#F0A088'), fade: 22, k: 0.7 };
        p.snowLit = c('#D8D0F2');
        p.snowShade = c('#5658BE');
        p.rim = c('#FFD2C0');
        p.hemiSky = c('#7468CC');
        p.fog = c('#5C4A9C');
        p.air.far = c('#4A3480');
        p.under.k = 0.1;
        p.lamps = 1.05;
        p.stars = 0.35;
        p.massif.glowK = 0.45;
        p.grade.exposure = 1.02;
        p.grade.hi = c('#FFEEE6');
        p.grade.lo = c('#DCDEFF');
        p.grade.saturation = 0.97;
      },
    },
    {
      // The first rose of morning at the line, as the lanterns leave the valley. Not yet a sun: a band of
      // rose under an indigo that is letting go of its stars, and rose on the snow that faces it.
      // (It comes in from 3650 m, so the leap into Firstlight and the town are already under the rose: from
      // 3900 the run was at the line before a frame showed it.)
      from: 3650, at: 4300, dusk: 1,
      edit: (p) => {
        setSun(p, 24, 6, 26, 10);
        p.sunColor = c('#F4DCE4');
        p.deck.k = 0.3;
        p.deck.glow = c('#FFB48E');
        p.skyZenith = c('#22206C');
        p.skyMid = c('#8656A8');
        p.skyHorizon = c('#DC8CA0');
        p.skyBand = { color: c('#FFC09A'), fade: 24, k: 1.0 };
        p.skyBelow = c('#6A4A8C');
        p.snowLit = c('#E6DAF2');
        p.snowShade = c('#6650B8');
        p.rim = c('#FFC6B4');
        p.fog = c('#6A4E9C');
        p.hemiSky = c('#7A66CC');
        p.air.far = c('#5E3E88');
        p.air.scatter = 1.2;
        p.clouds.lit = c('#FFC4B8');
        p.clouds.rim = c('#FFB49A');
        p.massif.glow = c('#FFAA9C');
        p.massif.glowK = 0.8;
        p.massif.glowLine = -300;
        p.stars = 0.25;
        p.under.k = 0.08;
        p.grade.hi = c('#FFF2E6');
        p.grade.lo = c('#E6D8FF');
        p.grade.exposure = 1.02;
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
  /** A place that is not a section (Lanternfall's Cloud Sea, which lies between two lips): where it lies
   *  on a course, the metres it comes in and goes out over; null where the course has none. Its kind is
   *  then only a label. */
  span?: (course: Course) => { z0: number; z1: number; rise: number; fall: number } | null;
  /** Metres before its section's end that the place lets go (a roof that stops short of its section). */
  ends?: number;
  /** The metres it lets go over, past its end (omitted: 75 for a roof, 90 in the open). */
  fall?: number;
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
      // The gold's own leap (the second): honey on the lit snow, violet in the long shadows, the valley's
      // haze lit from the sun's side.
      kind: 'leap',
      nth: 1,
      edit: (p) => {
        // (Third pass: at 0.85 the valley's haze was a cream plate under the leap. Thinner, and honey
        // rather than cream, so the valley floor keeps its forms in the light.)
        p.fogFar *= 1.3;
        p.air.low = 0.5;
        p.atmo.valley = 0.55;
        p.atmo.valleyColor = c('#F2B878');
        p.atmo.rays = 1;
        p.grade.shafts = 1;
        p.grade.contrast += 0.04;
        p.grade.exposure! *= 0.95;
      },
    },
    {
      // The Valley Leap: the finish town in a pool of gold, everything else in long shadow.
      kind: 'leap',
      nth: 2,
      edit: (p) => {
        // (Third pass: the haze at 0.8 bleached the town to cream boxes with no spires. It thins and
        // deepens to amber, so the town's roofs and lit windows hold their darks inside the gold.)
        p.fogFar *= 1.4;
        p.air.low = 0.45;
        p.atmo.valley = 0.45;
        p.atmo.valleyColor = c('#EE9C5C');
        p.atmo.rays = 1;
        p.grade.shafts = 1;
        p.grade.contrast += 0.07;
        p.snowShade = c('#5A60B4');
        // (1.6 after the third pass; 1.3 after the fourth: on Low the lamps' pools on the open slope
        // under the leap were hard pale ovals.)
        lamps(p, 1.3);
      },
    },
    {
      // The First Drop (and any leap a shuffled course adds): the valley opens, haze in layers below,
      // shafts through the cloud.
      kind: 'leap',
      edit: (p) => {
        // (Second pass: at 0.85 the valley's haze lay over the lake as milk on High, and Low, which draws
        // less of it, showed the lake better. The haze thins and the frame takes more contrast.)
        p.fogFar *= 1.35;
        p.air.low = 0.5;
        p.atmo.valley = 0.5;
        p.grade.contrast += 0.05;
        p.grade.exposure! *= 0.95;
        p.atmo.rays = 1;
        p.grade.shafts = 1;
        // (Third pass: the valley floor was one white-cyan plate. Its snowfield opens into more frozen
        // lake, and the haze over it is blue, so the floor reads as lake and haze in layers.)
        p.massif.sea = 0.5;
        p.atmo.valleyColor = c('#9CC0EC');
        p.atmo.valley = 0.4;
        p.air.low = 0.25;
        p.fog = c('#B4D0F2');
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
      // The glades run on through the fork and the chute to the lake's shore (ART.md 15: 700 to 1700):
      // the same dappled, teal-anchored grade, held a little under the morning's exposure so the open
      // slopes above the lake keep their blue shade instead of bleaching.
      kind: 'fork',
      nth: 0,
      edit: (p) => {
        p.grade.exposure! *= 0.94;
        p.grade.contrast = 1.13;
        p.grade.saturation += 0.06;
        p.grade.lo = c('#D8F0EC');
        p.clouds.shadow = Math.max(p.clouds.shadow, 0.42);
        p.grade.shafts = 1;
        p.atmo.rays = Math.max(p.atmo.rays, 0.8);
      },
    },
    {
      kind: 'chute',
      nth: 0,
      edit: (p) => {
        p.grade.exposure! *= 0.88;
        p.grade.contrast = 1.17;
        p.grade.saturation += 0.08;
        p.grade.lo = c('#D4ECF0');
        p.snowShade = c('#6690E4');
        // (The air clears toward the lake: the shore, the lodge and the ice ahead keep their darks.)
        p.fog = c('#B4D0F4');
        p.fogFar *= 1.3;
        p.air.low = 0.3;
        p.clouds.shadow = Math.max(p.clouds.shadow, 0.45);
        // (Fourth pass: with the sun ahead down the chute, full shafts fanned white rays across the lake's
        // first ice and blew it out to a grey road.)
        p.grade.shafts = 0.5;
        p.atmo.rays = 0.45;
      },
    },
    {
      // The benches under the second leap and the fork after them: the gold has come. Long violet-blue
      // shadows, the saturation up, the shafts full.
      kind: 'benches',
      edit: (p) => {
        p.grade.contrast += 0.04;
        p.grade.shafts = 1;
        p.atmo.rays = 1;
      },
    },
    {
      kind: 'fork',
      nth: 1,
      edit: (p) => {
        p.grade.contrast += 0.04;
        p.grade.shafts = 1;
        p.atmo.rays = 1;
      },
    },
    {
      // Mirror Lake: high-key and wide, the one place the grade goes almost monochrome blue.
      kind: 'lake',
      edit: (p) => {
        p.grade.saturation = 0.92;
        p.grade.contrast = 1.14;
        p.snowDeep = c('#123A8C');
        // (Third pass: the ice read mid-blue because at a rider's angle it mirrors the horizon, which the
        // cloud stop had made cream. Over the lake the low sky is a clear pale blue, so the mirror holds
        // the black-cyan body under a blue sky.)
        // (Fourth pass: still mid-blue. A step deeper.)
        p.skyHorizon = c('#8CB0E2');
        p.skyMid = c('#3E78C8');
        p.grade.shafts = 0.7;
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
        lamps(p, 1.2);
        p.grade.lo = c('#D8DEFF');
      },
    },
    {
      // Old Town: lamplight against blue shade, the warmest grade on the mountain.
      // (Third pass: at 1 the street's snow was flat lavender, with no amber under the lanterns.)
      kind: 'street',
      edit: (p) => {
        lamps(p, 1.6);
        p.snowShade = c('#5064C8');
        // (The visual lift: half the street's snow is in the fronts' shade and the rest in lamplight, so
        // what it throws up under the eaves and balconies is cooler and a little amber.)
        p.lift.sun = 0.45;
        p.lift.tint = c('#FFF0DC');
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
        p.grade.hi = c('#FFEED2');
        p.bloom += 0.04;
        // (The sun stands in the street's mouth at the line: at full shafts it flooded the frame orange
        // and bleached the coat.)
        p.grade.shafts = 0.35;
        p.sunGlow = 0.6;
      },
    },
  ],
  glacier: [
    {
      // Serac Gate and the Crevasse Fields: the walls go down into the dark and the abyss holds the air.
      kind: 'ravine',
      edit: (p) => {
        // A slot in the ice is the dark of the frame: its floor drops to violet-black and its air closes,
        // so the walls' cobalt, the glow at their feet and the lit valley at the far end are the picture.
        p.grade.contrast += 0.08;
        p.grade.exposure! *= 0.94;
        // (Round 7's review: the walls were the brightest, flattest thing in the slot. Under 0.75 the ice
        // goes down, cubed (materials.ts), so the walls are its dark frame; at night the aurora still finds
        // their crests.)
        p.hazardDim = 0.66;
        p.snowShade = c('#2C2A84');
        p.snowDeep = c('#120C44');
        p.fog.lerp(c('#141A58'), 0.6);
        p.air.low = 0.9;
        p.under = { color: c('#38C8FF'), k: 0.2 };
        // (The visual lift: the slot's floor is shade, so it bounces its own cold blue.)
        p.lift.sun = 0.25;
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
        // (The visual lift: the windows' amber lies on the street's snow and comes back up the hulls.)
        p.lift.tint = c('#FFE2B8');
        p.grade.hi = c('#FFEED6');
        p.bloom += 0.12;
      },
    },
    {
      // The Ice Cavern: near-black cobalt. The only light is what the cavern holds.
      kind: 'tunnel',
      // (Night to full dawn is the widest step in the game: it takes ten metres more than a roof's 75.)
      fall: 85,
      edit: (p) => {
        // (Round 7's review: the hour outside is the dawn by the cavern's middle, so the far mouth is a
        // blade of rose gold in the dark. Inside, the sun's own light is held down to a dim violet and
        // the walls drop a step, so the mouth, the lanterns and the rider's rim are the brightest things.)
        p.sunColor = c('#4E5098');
        p.snowLit = c('#546CC0');
        p.snowShade = c('#16226A');
        p.snowDeep = c('#080E3C');
        p.fog = c('#0E1A52');
        p.air.far = c('#1A1650');
        p.air.scatter = 1;
        p.sunGlow = 0.8;
        p.fogNear = 24;
        p.fogFar = 260;
        p.hemiSky = c('#22408E');
        p.key2.k = 0;
        p.under = { color: c('#38C8FF'), k: 0.22 };
        p.hazardDim = 0.45;
        // (No sky under a roof: the floor's glaze mirrors little, and the ice's crowns do not pale to
        // white-cyan, so the vault stays a dark shape round the mouth.)
        p.ice = 0.15;
        p.hazardFog = 0.4;
        p.grade.exposure = 0.86;
        p.grade.contrast = 1.22;
        p.grade.gain = c('#F2F6FF');
        p.grade.hi = c('#FFE8D8');
        p.grade.lo = c('#D6DCFF');
        p.lanternGlow = 0.7;
        p.bloom = 0.9;
        lamps(p, 1.35);
        // (The visual lift: the floor under the roof is dark, so it bounces little, and that cold.)
        p.lift.sun = 0.15;
        p.lift.bounce = 0.2;
        p.lift.sky = 0.12;
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
        p.under.k = Math.max(p.under.k, 0.5);
        p.fog = c('#5A1E18');
        p.air.far = c('#6A2010');
        // The slot's floor lies in the walls' shade: cold, so the lava's light on it is seen.
        p.snowShade = c('#383254');
        p.grade.contrast += 0.04;
        lamps(p, 1.25);
        // (The visual lift: the floor's own shade, with the lava's light lying on it, comes back up orange.)
        p.lift.sun = 0.35;
        p.lift.tint = c('#FFC8A0');
      },
    },
    {
      // Cinder Gate and the Halls' roof: black, lit from below, the far mouth a hot disc. The roof stops
      // short of its section: held to the section's end, the hall's dark air and its bloom lay over the
      // open slope past the mouth as a grey veil.
      kind: 'tunnel',
      ends: 46,
      fall: 34,
      edit: (p) => {
        // A cold mauve floor, so the lava's pools on it are the only warm thing (a warm grey floor under
        // an orange light went to brown mud).
        p.snowLit = c('#949CBC');
        p.snowShade = c('#1C1E40');
        p.snowDeep = c('#120E26');
        // (The air thickens to the fire's colour with distance, so the far mouth is a hot disc and not a
        // pale slot of the slope beyond.)
        p.fog = c('#6A1E0A');
        p.air.far = c('#A0360E');
        p.fogNear = 24;
        p.fogFar = 280;
        p.under.k = 0.6;
        p.grade.exposure = 1;
        p.grade.contrast = 1.18;
        p.bloom = 0.7;
        lamps(p, 1.3);
        // (The visual lift: under the roof no sky fills the shade; the lava's pools on the floor bounce.)
        p.lift.sun = 0.3;
        p.lift.sky = 0.1;
        p.lift.tint = c('#FFC8A0');
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
        // (The shade stays cold under the fire: a warm plum shade under an orange key made the landing one
        // orange mid-value.)
        p.snowShade = c('#423A5C');
        p.snowDeep = c('#2C2040');
        p.rim = c('#FF9A54');
        p.hemiSky = c('#C05A34');
        p.fog = c('#7A2A18');
        p.air.far = c('#A03A14');
        p.air.low = 1;
        p.fogFar *= 1.2;
        // The smoke over it is lit from below: the whole deck takes the lake's colour, darkest overhead.
        p.deck.k = 1;
        p.deck.lit = c('#C8501C');
        p.deck.shade = c('#5A1C12');
        p.deck.glow = c('#FF8A38');
        p.skyZenith = c('#2A0E0C');
        p.skyMid = c('#8A2C12');
        p.skyHorizon = c('#FF6A22');
        p.sunDisc = 0.2;
        p.snowLit = c('#FFE8D8');
        p.atmo.valleyColor = c('#E0541C');
        p.atmo.valley = 1;
        p.massif.seaWarm = 2.2;
        p.embers = 1.7;
        p.grade.hi = c('#FFDCB4');
        p.grade.exposure! *= 1.04;
        p.bloom += 0.15;
        lamps(p, 1.2);
        p.lift.tint = c('#FFC090');
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
        // (The lit snow keeps the morning's peach here: with a cold split tone the steps were one lavender.)
        p.grade.hi = c('#FFF4EA');
        p.grade.contrast += 0.05;
        p.snowShade = c('#6878D2');
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
        // (A deep plum-blue between the bars, so each bar of sun lands on the snow as a hard band.)
        p.snowShade = c('#5C56A8');
        lamps(p, 0.7);
      },
    },
    {
      // The Blossom Leap: orchard rows combed across a valley floor that lies in its own mist.
      kind: 'leap',
      edit: (p) => {
        // (Clear, not misted: a floor in its own mist was a floor nobody could see, and the town under
        // the last leap a ghost.)
        p.fogFar *= 1.45;
        p.air.low = 0.4;
        p.atmo.valley = Math.min(p.atmo.valley, 0.35);
        p.snowShade = c('#4A5CC4');
        p.snowDeep = c('#3C3096');
        p.grade.contrast += 0.04;
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
  lantern: [
    {
      // The Cloud Sea: inside the cloud, white-violet, visibility closing to forty metres. It closes over
      // the dive off the Crown and lets go in under two seconds, a breath before the lip of the break, so
      // the valley opens while the sled is still on the ground and the leap flies into it.
      kind: 'ravine',
      span: (course) => {
        const cl = course.cloud;
        return cl ? { z0: cl.z0 + 55, z1: cl.z1 - CLOUD_BREAK, rise: 150, fall: 50 } : null;
      },
      edit: (p) => {
        // (A value under the white it was: in a cloud as bright as its snow the lamps' halos had nothing to
        // loom out of, and the frame was one lilac wash.)
        p.fog = c('#9A92D8');
        p.air.far = c('#8A80CE');
        p.air.cool = c('#F2F0FF');
        p.air.low = 0.2;
        p.air.scatter = 0.4;
        // (The near plane keeps its whole palette for the first few metres, so the snow under the rider is
        // snow and the cloud is beyond it: from 2 m the near, the middle and the far were one violet.)
        p.fogNear = 7;
        p.fogFar = 49;
        p.skyZenith = c('#6A60BC');
        p.skyMid = c('#9A90DA');
        p.skyHorizon = c('#B6AEE6');
        p.skyBelow = c('#A49ADC');
        p.skyBand = { color: c('#C8C0F0'), fade: 8, k: 0.3 };
        p.deck = { k: 1, lit: c('#BCB4EA'), shade: c('#9086D0'), glow: c('#C8BEEE') };
        p.sunColor = c('#DCD8FF');
        p.sunDisc = 0;
        p.sunGlow = 0.35;
        p.sunSoft = 1;
        p.snowLit = c('#E0DEFA');
        p.snowShade = c('#6658BE');
        p.snowDeep = c('#46389A');
        p.rim = c('#F0EEFF');
        p.hemiSky = c('#A69CE0');
        p.ridge = [c('#B6AEE6'), c('#AEA6E2'), c('#A49ADC')];
        p.massif.veil = 1;
        p.massif.sea = 1;
        p.massif.seaWarm = 0;
        p.massif.glowK = 0;
        p.under = { color: c('#FFB04A'), k: 0 };
        p.atmo.valley = 0;
        p.atmo.meteors = 0;
        p.stars = 0;
        p.shadowK = 0.3;
        p.hazardFog = 0.5;
        p.hazardDim = 0.78;
        p.giftGlow = 1;
        p.ghostGlow = 1.6;
        p.lanternGlow = 0.8;
        p.sparkle = 0.5;
        // (Less bloom and more contrast than a white-out would have: at 0.85 and 1.02 the cloud was a milky
        // veil of one lilac value over everything, the rider bleached in it as it came out.)
        p.bloom = 0.62;
        p.grade.exposure = 1.0;
        p.grade.contrast = 1.1;
        p.grade.saturation = 1.04;
        p.grade.hi = c('#F8F6FF');
        p.grade.lo = c('#E4DCFF');
        p.grade.focal = 0.5;
        lamps(p, 1.3);
      },
    },
    {
      // The break: the whole valley under the deck. The air opens as far as it ever does on this mountain,
      // so the far plane, the town and the lanterns between are all in the frame.
      kind: 'leap',
      nth: 1,
      edit: (p) => {
        p.fogFar *= 1.6;
        p.fogNear = 110;
        p.air.low = 0.5;
        // (The valley's air is lit from inside by its lanterns: a dusky rose-violet the dots stand in, where
        // the night's own violet made the valley under the lip a dark hole.)
        p.air.far = c('#6A4890');
        p.fog = c('#4C3A8C');
        p.skyBelow = c('#644678');
        p.under.k = 0.3;
        p.bloom += 0.12;
        p.grade.hi = c('#FFF4E2');
        p.grade.contrast += 0.04;
        lamps(p, 1.35);
      },
    },
    {
      // The Lamp Road's avenue and Firstlight's street: lilac snow in pools of marigold.
      kind: 'street',
      edit: (p) => {
        lamps(p, 1.15);
        p.snowShade = c('#5440AC');
        // (The visual lift: the pools of marigold on the snow come back up under the eaves and the lamps'
        // stone. Marigold is the world's own light here, and only here: ART.md 15.)
        p.lift.tint = c('#FFC878');
        p.lift.bounce = 0.46;
        p.grade.hi = c('#FFF2DC');
        p.grade.lo = c('#DCD0FF');
        p.grade.saturation += 0.05;
        p.bloom += 0.1;
      },
    },
    {
      // An arched bridge strung with lights, over the river that carries them.
      kind: 'bridge',
      edit: (p) => {
        lamps(p, 1.15);
        p.under.k = Math.max(p.under.k, 0.24);
        p.air.low = 1;
        p.grade.hi = c('#FFF2DC');
        p.lift.tint = c('#FFD08C');
      },
    },
    {
      // The lamp grove: ink trunks, and the light between them.
      kind: 'treerun',
      edit: (p) => {
        lamps(p, 1.4);
        p.grade.contrast += 0.06;
        p.grade.exposure! *= 0.96;
        p.grade.lo = c('#DCCCFF');
        p.lift.tint = c('#FFC878');
        p.lift.bounce = 0.46;
      },
    },
    {
      // The leap into Firstlight: the town below in its own light, the east paling behind it.
      kind: 'leap',
      nth: 2,
      edit: (p) => {
        p.fogFar *= 1.3;
        p.air.low = 0.8;
        p.grade.hi = c('#FFEAD0');
      },
    },
    {
      kind: 'finish',
      edit: (p) => {
        lamps(p, 1);
        p.lift.tint = c('#FFD08C');
        // (Warm light on pale paint and stands of people: at the journey's bloom the square bloomed into a
        // cream veil when the great lantern lit. The lantern is the brightest thing here, and the bloom its.)
        p.grade.hi = c('#FFE8CC');
        p.bloom -= 0.2;
        p.grade.exposure! *= 0.94;
      },
    },
  ],
};

/** Lanternfall's cloud lets go this many metres above the lip of the break, so the camera's whip onto the
 *  valley (game/shots.ts lands it 26 m short of the lip) finds it already open. */
export const CLOUD_BREAK = 80;

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
  /** How finely its weight steps the stamp (a span changes the whole picture, so it steps finer). */
  steps?: number;
}

const LAID = new WeakMap<Course, LaidPlace[]>();

/** A course's places, in order down the run, laid on first use (a walk of its sections, once). */
function laidPlaces(course: Course): LaidPlace[] {
  let laid = LAID.get(course);
  if (laid) return laid;
  laid = [];
  const table = PLACES[course.biome];
  const seen = new Map<SectionKind, number>();
  // (Places that are not sections lie where they say; they are laid after the sections', below.)
  const spans: LaidPlace[] = [];
  for (const pl of table) {
    const sp = pl.span?.(course);
    if (!sp) continue;
    const pal = copyOf(hourPalette(course.biome, (sp.z0 + sp.z1) / 2, {} as Palette));
    pl.edit(pal);
    spans.push({ ...sp, pal, steps: 240 });
  }
  for (let z = 0, guard = 0; guard < 80; guard++) {
    const sec = course.section(z);
    const n = seen.get(sec.kind) ?? 0;
    seen.set(sec.kind, n + 1);
    for (const pl of table) {
      if (pl.span || pl.kind !== sec.kind || (pl.nth !== undefined && pl.nth !== n)) continue;
      const pal = copyOf(hourPalette(course.biome, (sec.z0 + sec.z1) / 2, {} as Palette));
      pl.edit(pal);
      // A roof closes over quickly and lets go quickly (the burst out of a cavern is under two seconds);
      // an open place comes in over its section's own blend.
      const roof = sec.kind === 'tunnel';
      laid.push({ z0: sec.z0 + (roof ? sec.blend * 0.5 : 0), z1: sec.z1 - (pl.ends ?? 0), rise: roof ? Math.max(30, sec.blend * 0.5) : Math.max(40, sec.blend), fall: pl.fall ?? (roof ? 75 : 90), pal });
      break;
    }
    if (sec.kind === 'finish') break;
    z = sec.z1 + 0.5;
  }
  // A span is blended last, over whatever section it crosses: inside the cloud nothing else is seen.
  laid.push(...spans);
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
      if (w > 0) key += (i + 1) * 4001 * Math.round(w * (laid[i].steps ?? 64));
    }
  }
  return key;
}

/** How much of the day has gone `metres` into a run, 0..1. Allocates nothing (the soundscape asks
 *  every frame). */
export function journeyDusk(biome: BiomeId, metres: number): number {
  // Lanternfall is ridden at the end of night, from the first metre: its lamps and windows are always lit.
  if (biome === 'lantern') return 1;
  const stops = JOURNEY[biome];
  const at = journeyProgress(biome, metres);
  const i = Math.min(Math.floor(at), stops.length - 1);
  const a = i > 0 ? stops[i - 1].dusk : 0;
  return a + (stops[i].dusk - a) * (at - i);
}

// ---------------------------------------------------------------------------------------------------
// Low's poster. Low and the phone's lowest tier have no post pass, so the grade by place and the film
// curve cannot be drawn over the frame: they are baked into the colours the frame is drawn with (ART.md
// 15, "Tiers, designed"). The same exposure, lift and gain, saturation, contrast and split tone the
// composite applies, and the same curve, on the snow, the sky, the air, the clouds and the far ranges.

let poster = false;
const posterWhite = new Color();
let posterOut: Palette | null = null;

/** Low draws the poster (materials.ts turns it on with the tier). */
export function setPoster(on: boolean): void {
  poster = on;
}

/** One colour through a palette's grade and the film curve, in place. `lit` is how bright the surface
 *  is drawn with this colour (lit snow about 0.85 of it), so the curve bends it where it will sit. */
function gradeColor(col: Color, g: Grade, lit = 1): Color {
  const e = (g.exposure ?? 1) * lit;
  let r = col.r * e;
  let gg = col.g * e;
  let b = col.b * e;
  r = r * g.gain.r + g.lift.r * 0.6 * Math.max(1 - r, 0);
  gg = gg * g.gain.g + g.lift.g * 0.6 * Math.max(1 - gg, 0);
  b = b * g.gain.b + g.lift.b * 0.6 * Math.max(1 - b, 0);
  let l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  r = Math.max(0, (l + (r - l) * g.saturation - 0.18) * g.contrast + 0.18);
  gg = Math.max(0, (l + (gg - l) * g.saturation - 0.18) * g.contrast + 0.18);
  b = Math.max(0, (l + (b - l) * g.saturation - 0.18) * g.contrast + 0.18);
  l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  const hiK = Math.max(0, Math.min(1, (l - 0.3) / 0.6));
  const loK = 1 - Math.max(0, Math.min(1, (l - 0.04) / 0.36));
  if (g.hi && g.lo) {
    r *= (1 + (g.hi.r - 1) * hiK) * (1 + (g.lo.r - 1) * loK);
    gg *= (1 + (g.hi.g - 1) * hiK) * (1 + (g.lo.g - 1) * loK);
    b *= (1 + (g.hi.b - 1) * hiK) * (1 + (g.lo.b - 1) * loK);
  }
  const m = Math.max(r, gg, b);
  const d = (0.2126 * r + 0.7152 * gg + 0.0722 * b) * 0.4 + m * 0.6 + 1e-4;
  const k = (filmValue(d) / d / lit) * (g.tone ?? 1) + (1 - (g.tone ?? 1)) / lit;
  return col.setRGB(r * k, gg * k, b * k);
}

/** The palette a tier draws with: the palette itself, or on Low its poster (a scratch copy, reused). */
export function tierLook(p: Palette): Palette {
  if (!poster) return p;
  const o = (posterOut = lerpPalette(p, p, 0, posterOut ?? ({} as Palette)));
  const g = p.grade;
  gradeColor(o.snowLit, g, 0.85);
  if (g.posterSnow) {
    const l = Math.max(o.snowLit.r, o.snowLit.g, o.snowLit.b);
    o.snowLit.lerp(posterWhite.setRGB(l, l, l), g.posterSnow);
  }
  if (g.posterKey) {
    const l = Math.max(o.snowLit.r, o.snowLit.g, o.snowLit.b);
    if (l > g.posterKey) o.snowLit.multiplyScalar(g.posterKey / l);
  }
  if (p.posterSnowSat < 1) {
    const s = o.snowLit;
    const l = 0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b;
    s.setRGB(l + (s.r - l) * p.posterSnowSat, l + (s.g - l) * p.posterSnowSat, l + (s.b - l) * p.posterSnowSat);
  }
  for (const col of [o.snowShade, o.snowDeep, o.fog, o.air.far, o.skyZenith, o.skyHorizon, o.skyBelow, o.hemiSky, o.ridge[0], o.ridge[1], o.ridge[2], o.clouds.lit, o.clouds.shade, o.clouds.rim, o.deck.lit, o.deck.shade, o.deck.glow, o.massif.rock, o.atmo.valleyColor, o.poster.shadow]) gradeColor(col, g);
  if (g.posterMute) {
    for (const col of [o.snowShade, o.snowDeep]) {
      const l = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
      col.lerp(posterWhite.setRGB(l, l, l), g.posterMute);
    }
  }
  if (g.posterCool) {
    // The baked shade's hue at the lit snow's own value.
    const l = Math.max(o.snowLit.r, o.snowLit.g, o.snowLit.b);
    const s = Math.max(o.snowShade.r, o.snowShade.g, o.snowShade.b, 1e-4);
    o.snowLit.lerp(posterWhite.copy(o.snowShade).multiplyScalar(l / s), g.posterCool);
  }
  if (o.skyMid) gradeColor(o.skyMid, g);
  if (o.skyBand.color) gradeColor(o.skyBand.color, g);
  if (o.mist) gradeColor(o.mist, g);
  // A poster's sun is a flat disc of the light's own colour: nothing on Low can bloom, and a core over 1
  // only clips to white.
  const top = Math.max(o.sunCore.r, o.sunCore.g, o.sunCore.b, 1);
  o.sunCore.multiplyScalar(1.05 / top);
  // The sun's scatter is a gradient on the dome where the other tiers have shafts.
  o.sunGlow *= 1.25;
  return o;
}
