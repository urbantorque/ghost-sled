import { describe, expect, it } from 'vitest';
import { Color, type BufferGeometry } from 'three';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS, biomeForSeed } from '../src/sim/mountains';
import { LAMP_BRONZE, LAMP_SLATE, LAMP_TIMBER, PAPER_DARK, SILVER, markerStoneGeometry, paper, silverTreeGeometry, standingStoneGeometry, stoneLampGeometry, stoneRowGeometry, wayLampGeometry } from '../src/render/lanternkit';
import { cloudDepth } from '../src/render/lanternworld';
import { CLOUD_BREAK, getPalette, journeyPalette } from '../src/render/palette';
import { WHIP_BEFORE_LIP } from '../src/game/shots';

// Round 7, the lanternworld lane: Lanternfall's own biome, its kit and its cloud.

const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const box = (g: BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};
const radius = (g: BufferGeometry, above = 0.3) => {
  const p = g.getAttribute('position');
  let r = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > above) r = Math.max(r, Math.hypot(p.getX(i), p.getZ(i)));
  return r;
};
const dist = (a: Color, b: Color) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

describe('Lanternfall is its own mountain', () => {
  const lf = MOUNTAINS[4];
  const c = courseFor(lf.seed);

  it('is drawn with its own look, and the other four keep theirs', () => {
    expect(biomeForSeed(lf.seed)).toBe('lantern');
    expect(c.biome).toBe('lantern');
    expect(MOUNTAINS.slice(0, 4).map((m) => biomeForSeed(m.seed))).toEqual(['alpine', 'glacier', 'volcanic', 'blossom']);
  });

  it('starts at night under a moon, with ink for everything that stands', () => {
    const p = getPalette('lantern', Mood.None);
    expect(p.moon).toBe(true);
    expect(p.stars).toBe(1);
    const lum = (col: Color) => 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
    expect(lum(p.tall)).toBeLessThan(0.02);
    expect(lum(p.low)).toBeLessThan(0.03);
    // Silver, a value under white (the review lane: at white the snow outshone the lamps), and still the
    // lightest thing that stands in the frame by far.
    expect(lum(p.snowLit)).toBeGreaterThan(0.65);
    expect(lum(p.snowLit)).toBeLessThan(0.75);
    // The run's gates are not the rider's red here.
    expect(dist(p.accentProp, new Color('#FF4D2E'))).toBeGreaterThan(0.4);
  });

  it('closes the air to about forty metres in the Cloud Sea, and opens it before the whip onto the valley', () => {
    const cl = c.cloud!;
    const at = (m: number) => journeyPalette('lantern', m, getPalette('lantern', Mood.None), c);
    expect(at(300).fogFar).toBeGreaterThan(400);
    const mid = (cl.z0 + cl.z1) / 2;
    expect(at(mid).fogFar).toBeLessThan(50);
    expect(at(mid).fogFar).toBeGreaterThan(35);
    expect(at(mid).stars).toBeLessThan(0.05);
    expect(cloudDepth(c, 300)).toBe(0);
    expect(cloudDepth(c, mid)).toBeGreaterThan(0.99);
    // The camera's whip lands WHIP_BEFORE_LIP short of the lip of the break: the cloud is gone by then.
    expect(CLOUD_BREAK).toBeGreaterThan(WHIP_BEFORE_LIP + 40);
    expect(cloudDepth(c, cl.z1 - WHIP_BEFORE_LIP)).toBeLessThan(0.02);
    expect(at(cl.z1 - WHIP_BEFORE_LIP + 4).fogFar).toBeGreaterThan(500);
    // Under the deck: a ceiling of cloud, no moon, and the valley's light from below.
    const under = at(cl.z1 + 60);
    expect(under.deck.k).toBeGreaterThan(0.8);
    expect(under.sunDisc).toBeLessThan(0.05);
    expect(under.under.k).toBeGreaterThan(0.1);
  });

  it('ends on the first rose of morning', () => {
    const p = journeyPalette('lantern', 4480, getPalette('lantern', Mood.None), c);
    expect(p.skyHorizon.r).toBeGreaterThan(p.skyHorizon.b);
    expect(p.skyZenith.b).toBeGreaterThan(p.skyZenith.r * 2);
    expect(p.deck.k).toBeLessThan(0.4);
  });
});

describe("Lanternfall's kit", () => {
  const p = getPalette('lantern', Mood.None);

  it('keeps each hazard inside what the sim collides with', () => {
    // A stone lamp: the sim's lantern, 0.6 m of radius and 1.4 m tall (Sakura's stands 1.7).
    const lamp = box(stoneLampGeometry());
    expect(lamp.max.y).toBeLessThan(1.8);
    expect(radius(stoneLampGeometry())).toBeLessThan(0.72);
    // A standing stone is modelled as the spire it stands in for: 5 m, inside 0.95 m.
    const stone = standingStoneGeometry(p);
    expect(box(stone).max.y).toBeLessThan(5.25);
    expect(radius(stone, 0.6)).toBeLessThan(1.0);
    // A row of stones: basalt's 1 m of radius and 5 m.
    const row = stoneRowGeometry(p);
    expect(box(row).max.y).toBeLessThan(5.3);
    expect(radius(row, 0.5)).toBeLessThan(1.05);
    // A marker stone: the ice block's 1 m.
    expect(radius(markerStoneGeometry(p), 0.4)).toBeLessThan(1.0);
  });

  it('stays light enough to stand in thousands', () => {
    expect(tris(silverTreeGeometry(0, false))).toBeLessThan(110);
    expect(tris(silverTreeGeometry(1, true))).toBeLessThan(170);
    expect(tris(wayLampGeometry())).toBeLessThan(200);
    // (The run's stone lamp is a named piece of the visual lift: every stone dressed and chamfered, as it passes at
    // the lens. About sixty stand on the course, a score in view on Low, where it is leaner: tests/chamfer.test.ts.)
    expect(tris(stoneLampGeometry())).toBeLessThan(460);
    expect(tris(stoneLampGeometry(true))).toBeLessThan(200);
    // (Round 8: its shaft cut finer so it holds at the lens, the forest lane; a stone stands on the run, not in thousands.)
    expect(tris(standingStoneGeometry(p))).toBeLessThan(200);
    expect(tris(stoneRowGeometry(p, true))).toBeLessThanOrEqual(tris(stoneRowGeometry(p)));
  });

  it('uses no signal colour but its own: marigold is the light, never mint or vermillion', () => {
    const mint = new Color('#8FF3E4');
    const vermillion = new Color('#FF4D2E');
    const lit = paper(1);
    // Lit paper is past 1 (it blooms) and warm, on the marigold side of orange.
    expect(lit.r).toBeGreaterThan(1.2);
    expect(lit.g).toBeGreaterThan(lit.b * 2.5);
    expect(lit.g / lit.r).toBeGreaterThan(0.5);
    for (const hex of [LAMP_TIMBER, LAMP_SLATE, LAMP_BRONZE, PAPER_DARK, SILVER]) {
      const col = new Color(hex);
      expect(dist(col, mint), hex).toBeGreaterThan(0.3);
      expect(dist(col, vermillion), hex).toBeGreaterThan(0.3);
    }
  });
});
