import { Color, SRGBColorSpace } from 'three';
import { describe, expect, it } from 'vitest';
import { CHARM_GIST, CHARM_SHORT, charmTakeLine, offersGistLine } from '../src/game/charmcopy';
import { SIG, lanternSignals, wispUp } from '../src/game/charmsignals';
import { ARCH_TOP, BURST_S, DRAW_AHEAD, GUTTER_S, MEDAL_FLOOR_PX, MEDAL_GAP, MEDAL_HALF, archPath, archState, charmGateGeometry, medalHalf, medalSpread, offersLine } from '../src/render/charmgates';
import { FAMILY_HEX, GLYPH_COLS, GLYPH_ROWS, STYLE_DEEP_HEX, glyphCell, glyphIds } from '../src/render/charmglyphs';
import { stompWindowS } from '../src/render/landing';
import { grabDanger, trickPose, type TrickIn } from '../src/render/trickpose';
import { pathFromOf } from '../src/render/world';
import { ALL_CHARMS, CHARM, CHARMS, LANE_W, PATH_STEP, laneX } from '../src/sim/charms';
import { PLAIN } from '../src/sim/chaos';
import { packInput } from '../src/sim/input';
import { MOUNTAINS } from '../src/sim/mountains';
import { FIRST_RUN_STOMP, Sim } from '../src/sim/sim';
import { TRICK } from '../src/sim/tricks';

// Round 8, the play lane: what a player sees and hears of the new mechanics, kept honest. The trick poses are one
// per trick and tell the grab's tiers apart; the gates' arches are told apart by shape as well as colour and never
// take a locked role's colour; a gate's state reads from the sim's own (next, taken, guttering); the first run's gold
// flash keeps to the sim's own window; Lamplit Path never draws a spark the sim did not lay.

function air(over: Partial<TrickIn> = {}): TrickIn {
  return { move: 0, grab: 0, tier: 0, tweak: 0, spin: 0, flip: 0, danger: 0, time: 1, calm: false, ...over };
}

/** Hue in degrees and saturation of an sRGB hex. */
function hsl(hex: string): { h: number; s: number; l: number } {
  const c = new Color();
  c.setStyle(hex);
  const o = { h: 0, s: 0, l: 0 };
  c.getHSL(o, SRGBColorSpace);
  return { h: o.h * 360, s: o.s, l: o.l };
}

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('trick poses', () => {
  it('nothing done in the air takes no pose', () => {
    expect(trickPose(air()).k).toBe(0);
  });

  it('every named trick has its own pose', () => {
    const names = new Set<string>();
    const cases: TrickIn[] = [
      air({ spin: 9 }),
      air({ flip: 6 }),
      air({ grab: 1, tier: 1 }),
      air({ grab: 1, tier: 2 }),
      air({ grab: 1, tier: 3 }),
      air({ grab: -1, tier: 1, spin: 9 }),
      air({ grab: -1, tier: 1, flip: 6 }),
      air({ spin: 9, flip: 6 }),
      air({ grab: 1, tier: 1, spin: 9, flip: 6 }),
      air({ move: TRICK.lamppost, grab: 1 }),
      air({ move: TRICK.snowHare, grab: -1 }),
      ...[TRICK.pineBow, TRICK.spinningTop, TRICK.fireside, TRICK.cometTail, TRICK.willowisp, TRICK.teacup].map((m) => air({ move: m })),
    ];
    for (const c of cases) {
      const p = trickPose(c);
      expect(p.k).toBe(1);
      expect(names.has(p.name)).toBe(false);
      names.add(p.name);
    }
    // Spin, Backflip, the three grabs, four combinations, two specials, six sleds' own: seventeen poses (the
    // eighteenth, Crosswind, shoves any grab: below).
    expect(names.size).toBe(17);
  });

  it('a grab holds its hand on the rail on its own side, and the deeper tiers reach further', () => {
    const right = trickPose(air({ grab: 1, tier: 1 }));
    expect(right.armK[1]).toBe(1);
    expect(right.arm[3]).toBeLessThan(0.3);
    // (The rail hand hangs straight down: the free arm is the left.)
    const reach = trickPose(air({ grab: 1, tier: 2 }));
    expect(reach.arm[1]).toBeGreaterThan(2.5);
    const left = trickPose(air({ grab: -1, tier: 2 }));
    expect(left.arm[3]).toBeGreaterThan(2.5);
    expect(left.roll).toBeCloseTo(-reach.roll, 6);
    const stretch = trickPose(air({ grab: 1, tier: 3 }));
    expect(Math.abs(stretch.roll)).toBeGreaterThan(Math.abs(reach.roll));
  });

  it('a tweak shoves the sled out against the grab and leans the body the other way', () => {
    const base = trickPose(air({ grab: 1, tier: 1 }));
    const tw = trickPose(air({ grab: 1, tier: 1, tweak: 12 }));
    expect(tw.name).toContain('crosswind');
    expect(tw.sledYaw).toBeLessThan(0);
    expect(tw.roll).toBeGreaterThan(base.roll);
    expect(trickPose(air({ grab: -1, tier: 1, tweak: 12 })).sledYaw).toBeGreaterThan(0);
  });

  it('a deep grab held as the snow comes up strains the rider, without the shake under reduced motion', () => {
    const p = trickPose(air({ grab: 1, tier: 2, danger: 1, time: 0.3 }));
    expect(p.nod).toBeGreaterThan(0.3);
    expect(Math.abs(p.shake)).toBeGreaterThan(0);
    const calm = trickPose(air({ grab: 1, tier: 2, danger: 1, time: 0.3, calm: true }));
    expect(calm.nod).toBe(p.nod);
    expect(calm.shake).toBe(0);
  });

  it('warns only for a deep grab, ramping from about half a second out to touchdown', () => {
    expect(grabDanger(false, 0.1)).toBe(0);
    expect(grabDanger(true, 2)).toBe(0);
    expect(grabDanger(true, Infinity)).toBe(0);
    expect(grabDanger(true, 0.3)).toBeGreaterThan(0);
    expect(grabDanger(true, 0)).toBe(1);
  });
});

describe('the landing ring', () => {
  it("burns gold for the sim's own window, a wider one on a first run", () => {
    expect(stompWindowS(false)).toBeCloseTo(9 / 60, 9);
    expect(stompWindowS(true)).toBeCloseTo(FIRST_RUN_STOMP / 60, 9);
    expect(stompWindowS(true)).toBeGreaterThan(stompWindowS(false));
  });
});

describe('charm gates', () => {
  it('tells the families apart by shape: pointed, round and square, each standing on its feet', () => {
    const tops = [0, 1, 2].map((f) => Math.max(...archPath(f).map((p) => p[1])));
    tops.forEach((t, f) => expect(t).toBeCloseTo(ARCH_TOP[f], 1));
    expect(tops[0]).toBeGreaterThan(tops[1]);
    expect(tops[1]).toBeGreaterThan(tops[2]);
    for (let f = 0; f < 3; f++) {
      const p = archPath(f);
      expect(p[0][1]).toBeLessThan(0);
      expect(p[p.length - 1][1]).toBeLessThan(0);
      expect(p[0][0]).toBeCloseTo(-p[p.length - 1][0], 6);
      // The square's crown is flat: many points share its height.
      const crown = p.filter((q) => q[1] > ARCH_TOP[f] - 0.05).length;
      if (f === 2) expect(crown).toBeGreaterThan(3);
      else expect(crown).toBeLessThanOrEqual(3);
    }
  });

  it('is one geometry: three tubes, a medallion and a veil, a few thousand triangles at most', () => {
    const g = charmGateGeometry();
    const info = g.getAttribute('aInfo');
    const parts = new Set<number>();
    for (let i = 0; i < info.count; i++) parts.add(info.getX(i));
    expect([...parts].sort()).toEqual([0, 1, 2]);
    expect(g.index!.count / 3).toBeLessThan(1000);
  });

  it("never takes a locked role's colour: no family near mint, vermillion, marigold, rose, gold-white or amber", () => {
    const locked = ['#8FF3E4', '#FF4D2E', '#FFD34D', '#FF5A7A', '#FFE08A', '#FFB040', '#FF9E1A'];
    // (Sakura's deeper violet for the style family too.)
    const fam = [...Object.values(FAMILY_HEX), STYLE_DEEP_HEX].map(hsl);
    for (const f of fam) {
      expect(f.s).toBeGreaterThan(0.5);
      for (const l of locked) expect(hueGap(f.h, hsl(l).h)).toBeGreaterThan(30);
    }
    // ...and the three are far apart from each other.
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(hueGap(fam[i].h, fam[j].h)).toBeGreaterThan(60);
    // The deeper violet keeps its family's hue and is darker than it.
    expect(hueGap(fam[3].h, fam[1].h)).toBeLessThan(15);
    expect(fam[3].l).toBeLessThan(fam[1].l);
  });

  it('has a glyph for every charm, each in its own cell of the atlas', () => {
    expect(glyphIds()).toEqual(CHARMS.map((c) => c.id));
    const seen = new Set<string>();
    for (const c of CHARMS) {
      const cell = glyphCell(c.id);
      expect(cell.w).toBeCloseTo(1 / GLYPH_COLS, 9);
      expect(cell.h).toBeCloseTo(1 / GLYPH_ROWS, 9);
      expect(cell.u).toBeGreaterThanOrEqual(0);
      expect(cell.v).toBeGreaterThanOrEqual(0);
      seen.add(`${cell.u}:${cell.v}`);
    }
    expect(seen.size).toBe(CHARMS.length);
  });

  it('reads the gate from the sim: the next breathes, a taken arch answers and goes, the others gutter', () => {
    const gate = { z: 400, offers: [CHARM.comet, CHARM.second, CHARM.owl] as [number, number, number], lane: -1 };
    expect(archState(gate, 0, true, 0, 0)).toEqual({ next: 1, burst: 0, gutter: 0, alpha: 1 });
    expect(archState(gate, 1, false, 0, 0)!.next).toBe(0);
    // Too far off: not drawn; fading in over its last 60 m.
    expect(archState({ ...gate, z: DRAW_AHEAD + 10 }, 0, true, 0, 0)).toBeNull();
    expect(archState({ ...gate, z: DRAW_AHEAD - 30 }, 0, true, 0, 0)!.alpha).toBeCloseTo(0.5, 6);
    // An empty lane draws nothing.
    expect(archState({ ...gate, offers: [-1, CHARM.second, CHARM.owl] }, 0, true, 0, 0)).toBeNull();
    const taken = { ...gate, lane: 2 };
    const mid = archState(taken, 2, false, 400, BURST_S / 2)!;
    expect(mid.burst).toBeCloseTo(0.5, 6);
    expect(mid.gutter).toBe(0);
    expect(archState(taken, 2, false, 400, BURST_S)).toBeNull();
    expect(archState(taken, 0, false, 400, GUTTER_S)!.gutter).toBe(1);
    expect(archState(taken, 0, false, 400, BURST_S + 0.1)).toBeNull();
  });

  it("gives the rider the charm of the arch it stands in: lane 0 is three.js -x, the arches' own placing", () => {
    for (const lane of [0, 1, 2]) {
      const sim = new Sim({ seed: MOUNTAINS[0].seed, chaos: PLAIN, sled: 0, charmPool: ALL_CHARMS });
      const g = sim.charmGates[0];
      const offers = g.offers.slice();
      const events: number[] = [];
      for (let i = 0; i < 1200 && g.lane < 0; i++) {
        // Held in the lane's arch by hand (the pilot's pin), at cruise.
        const s = sim.s;
        s.x = laneX(g.x, lane);
        s.vx = 0;
        sim.step(packInput(4, false, false));
        for (const e of sim.events) if (e.type === 'charm') events.push(e.id);
      }
      expect(g.lane).toBe(lane);
      expect(sim.charms[0]).toBe(offers[lane]);
      expect(events).toEqual([offers[lane]]);
    }
  });

  it('holds a medallion at least 32 px tall far off, and never lets two overlap as they grow', () => {
    // At speed the lens is about 80 degrees: 720 px tall, a metre spans about 1 / (2 d tan 40 / 720) px.
    const pxAt = (d: number) => (2 * d * Math.tan((40 * Math.PI) / 180)) / 720;
    for (const d of [40, 90, 120]) {
      const half = medalHalf(pxAt(d));
      expect((2 * half) / pxAt(d)).toBeGreaterThanOrEqual(MEDAL_FLOOR_PX - 0.5);
      // Neighbours stand LANE_W apart, the outer ones stepped out by medalSpread: the gap between two is kept.
      expect(LANE_W + medalSpread(half) - 2 * half).toBeGreaterThanOrEqual(MEDAL_GAP - 1e-9);
    }
    // Close in it is its own size, standing over its own arch.
    expect(medalHalf(pxAt(10))).toBe(MEDAL_HALF);
    expect(medalSpread(MEDAL_HALF)).toBe(0);
  });

  it('names each offer with a gist of two or three words before the choice, one line on a desktop', () => {
    for (const c of CHARMS) {
      const words = (CHARM_GIST[c.id] ?? '').split(' ').filter(Boolean).length;
      expect(words).toBeGreaterThanOrEqual(2);
      expect(words).toBeLessThanOrEqual(3);
    }
    const dot = '  ' + String.fromCharCode(0xb7) + '  ';
    expect(offersGistLine([CHARM.drum, CHARM.wisp, CHARM.paper])).toBe(['Drift Drum: faster drifts', 'Guardian Wisp: a free hit', 'Paper Kite: grabs pay'].join(dot));
    expect(offersGistLine([-1, CHARM.wisp, CHARM.paper])).toBe(['Guardian Wisp: a free hit', 'Paper Kite: grabs pay'].join(dot));
    // The longest three a gate can deal, one of each family: one line on a 1280 px desktop at 15 px or more, and two
    // lines on a 390 px phone at 11 px or more (style.css .is-gate: 0.62 em a letter, 16 px gutters).
    const longest = (fam: string) => Math.max(...CHARMS.filter((c) => c.family === fam).map((c) => c.name.length + 2 + CHARM_GIST[c.id].length));
    const len = longest('speed') + longest('style') + longest('survival') + 10;
    expect((1280 - 32) / (len * 0.62)).toBeGreaterThanOrEqual(15);
    expect((390 - 32) / ((len / 2) * 0.62)).toBeGreaterThanOrEqual(11);
  });

  it('says what each charm does as it is taken, in a few words after its name', () => {
    for (const c of CHARMS) {
      expect(CHARM_SHORT[c.id]?.length ?? 0).toBeGreaterThan(8);
      expect(CHARM_SHORT[c.id].length).toBeLessThanOrEqual(34);
      expect(charmTakeLine(c.id)).toBe(`${c.name}: ${CHARM_SHORT[c.id]}`);
    }
    expect(charmTakeLine(CHARM.slip)).toBe('Slipstream Lantern: drafting fills your lantern');
  });

  it('names the three offers left to right as the arches stand, an empty one left out', () => {
    const name = (id: number) => CHARMS[id].name;
    expect(offersLine([CHARM.comet, CHARM.second, CHARM.owl], name)).toBe("Comet's Tail  ·  Second Wind  ·  Owl's Breath");
    expect(offersLine([-1, CHARM.second, CHARM.owl], name)).toBe("Second Wind  ·  Owl's Breath");
  });
});

describe("a held charm's signal", () => {
  // (A stub with the sim's read-only getters for the charm state, sim.ts perfectTick and the rest.)
  function sim(charms: number[], over: Record<string, unknown> = {}): Sim {
    const mask = charms.reduce((m, id) => m | (1 << id), 0);
    return {
      charms,
      charmGates: [],
      stageTicks: [100],
      tick: 500,
      s: { lantern: 120, getUps: 2 },
      has: (id: number) => (mask & (1 << id)) !== 0,
      perfectTick: -1000,
      hearthOwing: 0,
      featherSpentStage: -1,
      lampSpentStage: -1,
      wispSpentStage: -1,
      ...over,
    } as unknown as Sim;
  }

  it('says nothing for a rider with no charms', () => {
    expect(lanternSignals(sim([]), true)).toBe(0);
  });

  it("draws Comet's Tail without the ward ring and Stone Lantern in halves, for as long as they are held", () => {
    expect(lanternSignals(sim([CHARM.comet, CHARM.stone]), false)).toBe(SIG.noWard | SIG.halves);
  });

  it("opens Ember Step's half price just after a perfect landing, and only with half a lantern to spend", () => {
    expect(lanternSignals(sim([CHARM.step], { perfectTick: 480 }), false) & SIG.step).toBe(SIG.step);
    expect(lanternSignals(sim([CHARM.step], { perfectTick: 400 }), false) & SIG.step).toBe(0);
    expect(lanternSignals(sim([CHARM.step], { perfectTick: 480, s: { lantern: 30, getUps: 2 } }), false) & SIG.step).toBe(0);
  });

  it("keeps a stage's spare on the lantern until it is spent in that stage", () => {
    expect(lanternSignals(sim([CHARM.feather]), false) & SIG.feather).toBe(SIG.feather);
    expect(lanternSignals(sim([CHARM.feather], { featherSpentStage: 1 }), false) & SIG.feather).toBe(0);
    // Last Lamp's ember shows only once the get-ups are gone.
    expect(lanternSignals(sim([CHARM.lamp]), false) & SIG.ember).toBe(0);
    expect(lanternSignals(sim([CHARM.lamp], { s: { lantern: 0, getUps: 0 } }), false) & SIG.ember).toBe(SIG.ember);
    expect(wispUp(sim([CHARM.wisp]))).toBe(true);
    expect(wispUp(sim([CHARM.wisp], { wispSpentStage: 1 }))).toBe(false);
  });

  it('leans the Slipstream Lantern only while drafting, and outlines a Hearthstone cell while it is owed', () => {
    expect(lanternSignals(sim([CHARM.slip]), false)).toBe(0);
    expect(lanternSignals(sim([CHARM.slip]), true)).toBe(SIG.lean);
    expect(lanternSignals(sim([CHARM.hearth], { hearthOwing: 100 }), false)).toBe(SIG.owed);
  });
});

describe('Lamplit Path', () => {
  const gate = (z: number, pick: number) => ({ index: 0, z, x: 0, offers: [-1, pick, -1] as [number, number, number], lane: 1, pick });

  it('draws nothing for a rider without it, and from the start for one who carried it in', () => {
    expect(pathFromOf({ charms: [], charmGates: [] })).toBe(-1);
    expect(pathFromOf({ charms: [CHARM.path], charmGates: [] })).toBe(1);
  });

  it('never draws a spark the sim did not lay, whichever tick past the gate it was taken on', () => {
    for (const gz of [110, 1550, 3049.5, 3044.2, 2913]) {
      const k = pathFromOf({ charms: [CHARM.path], charmGates: [gate(gz, CHARM.path)] });
      // The sim's first: ceil((z + 1) / PATH_STEP) for the z it was taken at, up to a tick (0.8 m) past the line.
      for (let z = gz; z <= gz + 0.8; z += 0.05) expect(k).toBeGreaterThanOrEqual(Math.ceil((z + 1) / PATH_STEP));
      expect(k).toBeLessThanOrEqual(Math.ceil((gz + 1) / PATH_STEP) + 1);
    }
  });
});
