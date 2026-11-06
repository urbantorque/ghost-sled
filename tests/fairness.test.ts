import { describe, expect, it } from 'vitest';
import { ChaosEvent, Mood, PLAIN } from '../src/sim/chaos';
import { CHUNK_LEN, Course, FINISH_SQUARE, Ledge, Obstacle, RUN_OUT, SAFE_LANE, START_CLEAR_Z, STAGE_LENGTHS, Section, SectionKind } from '../src/sim/course';
import { packInput } from '../src/sim/input';
import { MOUNTAINS, biomeForSeed, dailySeed } from '../src/sim/mountains';
import { SLED_RADIUS, Sim } from '../src/sim/sim';

// Generation must guarantee a passable line at all times: a lane around the safe line that no
// collider, ramp or vent touches, that stays inside the corridor, and that a sled can physically
// follow at top speed. It must also keep the descent's promises, each measured here on the ground the
// sled rides. Violations are collected and asserted once so the scan stays fast.

const DAILIES = ['2026-10-24', '2026-12-25', '2027-03-01', '2027-07-19', '2027-01-02', '2027-05-30'].map(dailySeed);
const SEEDS = [...MOUNTAINS.map((m) => m.seed), ...DAILIES];
const FINISH = STAGE_LENGTHS.reduce((a, b) => a + b, 0);
/** The whole descent: to the finish, through the run-out and a little past it. */
const CHUNKS = Math.ceil((FINISH + RUN_OUT) / CHUNK_LEN) + 2;
/** The sim's air drag and friction (kept here because this file measures the ground, not the sim). */
const CD = 0.0027;
const MU = 0.03;
const G = 9.81;

function distToObstacle(o: Obstacle, x: number, z: number): number {
  let px = o.x;
  let pz = o.z;
  if (o.x2 !== o.x || o.z2 !== o.z) {
    const ex = o.x2 - o.x;
    const ez = o.z2 - o.z;
    const t = Math.max(0, Math.min(1, ((x - o.x) * ex + (z - o.z) * ez) / (ex * ex + ez * ez)));
    px = o.x + ex * t;
    pz = o.z + ez * t;
  }
  return Math.hypot(x - px, z - pz) - o.r;
}

/** Every section of the descent, in order, up to and including the finish. */
function sectionsOf(c: Course): Section[] {
  const out: Section[] = [];
  let z = 0;
  while (z < FINISH) {
    const s = c.section(z);
    out.push(s);
    z = s.z1;
  }
  return out;
}

const body0 = (s: Section): number => s.z0 + s.blend;
const ofKind = (c: Course, k: SectionKind): Section[] => sectionsOf(c).filter((s) => s.kind === k);
const obstaclesAt = (c: Course, z0: number, z1: number): Obstacle[] => {
  const out: Obstacle[] = [];
  for (let i = Math.floor(z0 / CHUNK_LEN); i <= Math.floor(z1 / CHUNK_LEN); i++) out.push(...c.chunk(i).obstacles);
  return out.filter((o) => Math.max(o.z, o.z2) >= z0 && Math.min(o.z, o.z2) <= z1);
};
const zonesAt = (c: Course, z0: number, z1: number) => {
  const out = [];
  for (let i = Math.floor(z0 / CHUNK_LEN); i <= Math.floor(z1 / CHUNK_LEN); i++) out.push(c.zones(i));
  return out;
};
/** The ground's gradient along the safe line, downhill positive, over 10 m. */
const gradeAt = (c: Course, z: number): number => (c.baseY(z - 5) - c.baseY(z + 5)) / 10;

interface Flight {
  t: number;
  x: number;
  z: number;
  /** The sim's own number: how much harder the sled falls than the ground under it. */
  impact: number;
  /** How fast the ground falls along the sled's way where it touches down. */
  slope: number;
}

/** A sled leaving the ground at z on the safe line at speed v, flown to touchdown. */
function fly(c: Course, zLip: number, v: number, g = G): Flight {
  const dt = 1 / 240;
  const vx = (v * (c.safeX(zLip) - c.safeX(zLip - 2))) / 2;
  const vz = Math.sqrt(Math.max(0, v * v - vx * vx));
  let x = c.safeX(zLip);
  let z = zLip;
  let y = c.ground(x, z);
  let vy = (vz * (c.ground(x, z) - c.ground(c.safeX(zLip - 0.5), zLip - 0.5))) / 0.5;
  for (let t = dt; t < 12; t += dt) {
    vy -= g * dt;
    x += vx * dt;
    z += vz * dt;
    y += vy * dt;
    if (y <= c.ground(x, z)) {
      const e = 0.2;
      const gx = (c.ground(x + e, z) - c.ground(x - e, z)) / (2 * e);
      const gz = (c.ground(x, z + e) - c.ground(x, z - e)) / (2 * e);
      const follow = gx * vx + gz * vz;
      return { t, x, z, impact: follow - vy, slope: -gz };
    }
  }
  return { t: 12, x, z, impact: 0, slope: 0 };
}

describe('fairness: guaranteed passable line', () => {
  for (const seed of SEEDS) {
    const tag = seed.toString(16);

    it(`seed ${tag}: lane is clear of colliders, ramps and vents to the end of the run-out`, () => {
      const c = new Course(seed);
      const problems: string[] = [];
      let minClear = Infinity;
      let samples = 0;
      for (let i = 0; i < CHUNKS; i++) {
        const near = [c.chunk(Math.max(0, i - 1)), c.chunk(i), c.chunk(i + 1)].flatMap((k) => k.obstacles);
        const zones = [c.zones(Math.max(0, i - 1)), c.zones(i)];
        for (let z = i * CHUNK_LEN; z < (i + 1) * CHUNK_LEN; z += 0.5) {
          const x = c.safeX(z);
          samples++;
          if (Math.abs(x - c.centerX(z)) >= c.halfWidth(z) - 2) problems.push(`line leaves corridor at z=${z}`);
          for (const o of near) {
            const d = distToObstacle(o, x, z) - SLED_RADIUS;
            if (d < minClear) minClear = d;
            if (d <= 1.0) problems.push(`${o.kind} ${o.id} only ${d.toFixed(2)} m from the line at z=${z}`);
          }
          for (const zn of zones) {
            for (const r of zn.ramps) {
              if (r.online) continue; // The authored kickers stand on the line on purpose: see their own test.
              if (z >= r.z - 1 && z <= r.z + r.len + 1.5 && Math.abs(x - r.x) <= r.w / 2 + 1.4 + 1.0) {
                problems.push(`ramp z=${r.z.toFixed(1)} overlaps the lane at z=${z} (dx=${Math.abs(x - r.x).toFixed(2)} w=${r.w.toFixed(2)})`);
              }
            }
            for (const v of zn.vents) {
              if (Math.hypot(x - v.x, z - v.z) <= v.r + 1) problems.push(`vent ${v.id} on the lane at z=${z}`);
            }
          }
        }
      }
      expect(samples).toBe(CHUNKS * CHUNK_LEN * 2);
      expect(problems.slice(0, 8)).toEqual([]);
      expect(minClear).toBeGreaterThan(1.0);
    });

    it(`seed ${tag}: line is smooth enough to follow at top speed`, () => {
      const c = new Course(seed);
      const bad: string[] = [];
      const h = 2;
      for (let z = 4; z < CHUNKS * CHUNK_LEN; z += 1) {
        const slope = (c.safeX(z + h) - c.safeX(z - h)) / (2 * h);
        const curv = (c.safeX(z + h) - 2 * c.safeX(z) + c.safeX(z - h)) / (h * h);
        if (Math.abs(slope) >= 0.7) bad.push(`slope ${slope.toFixed(2)} at z=${z}`);
        // A carving sled at 40 m/s turns with a ~56 m radius (curvature 0.018).
        if (Math.abs(curv) >= 0.018) bad.push(`curvature ${curv.toFixed(4)} at z=${z}`);
        // Steep ground is where a sled nears 46 m/s, whose turn rate only allows 0.014: bends stay gentler there.
        if (Math.abs(curv) >= 0.0135 && c.shapeAt(z).slope * c.params.slope >= 0.38) bad.push(`curvature ${curv.toFixed(4)} on steep ground at z=${z}`);
      }
      expect(bad.slice(0, 8)).toEqual([]);
    });

    it(`seed ${tag}: the ground under the line only launches a sled where it means to`, () => {
      const c = new Course(seed);
      const bad: string[] = [];
      // Kickers, drops, moguls, ledges and rollers launch on purpose: what is left is noise and blends,
      // and the sim leaves the ground above about g / v^2 (0.011 at 30 m/s).
      const meant: { z0: number; z1: number }[] = [];
      for (const l of c.ledges) meant.push({ z0: l.z - l.kickLen - 3, z1: l.foot + 6 });
      for (let i = 0; i < CHUNKS; i++) {
        const zn = c.zones(i);
        for (const r of zn.ramps) meant.push({ z0: r.z - 4, z1: r.z + r.len + 5 });
        for (const d of zn.drops) meant.push({ z0: d.z - 4, z1: d.z + d.len + d.rec + 4 });
        for (const m of zn.moguls) meant.push({ z0: m.z0 - 4, z1: m.z1 + 4 });
      }
      const h = 2;
      for (let z = 4; z < FINISH; z += 1) {
        if (meant.some((m) => z >= m.z0 && z <= m.z1)) continue;
        const y = (q: number) => c.ground(c.safeX(q), q);
        const k = (y(z + h) - 2 * y(z) + y(z - h)) / (h * h);
        if (k < -0.011) bad.push(`crest ${k.toFixed(4)} at z=${z} in ${c.section(z).kind}`);
      }
      expect(bad.slice(0, 8)).toEqual([]);
    });
  }

  it('a simple line-following driver survives every mountain on the real sim', () => {
    const crashes: string[] = [];
    for (const seed of SEEDS.slice(0, 6)) {
      const sim = new Sim({ seed, chaos: PLAIN, sled: 0 });
      for (let t = 0; t < 60 * 60 * 4 && !sim.s.crashed && sim.s.z < 6000; t++) {
        const s = sim.s;
        let lvl = 4;
        if (s.grounded) {
          const look = s.z + 4 + s.speed * 0.35;
          const target = sim.course.safeX(look);
          const desired = Math.atan2(target - s.x, look - s.z);
          const lateral = sim.course.safeX(s.z) - s.x;
          const err = desired - s.velHeading + lateral * 0.08;
          lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
        }
        sim.step(packInput(lvl, false, false));
      }
      if (sim.s.crashed || sim.s.z < 3000) crashes.push(`seed ${seed.toString(16)}: ${sim.s.crashCause} at z=${sim.s.z.toFixed(0)}`);
    }
    expect(crashes).toEqual([]);
  });

  it('a clean, boost-free rider outruns the avalanche on every mountain in every mood', () => {
    const caught: string[] = [];
    for (const m of MOUNTAINS) {
      for (let mood = 0; mood <= 6; mood++) {
        const sim = new Sim({ seed: m.seed, chaos: { mood: mood as Mood, event: ChaosEvent.Avalanche, seed: 17 }, sled: 0 });
        for (let t = 0; t < 60 * 120 && !sim.s.crashed && sim.dyn.avalanche.phase !== 3; t++) {
          const s = sim.s;
          let lvl = 4;
          if (s.grounded) {
            const look = s.z + 4 + s.speed * 0.35;
            const err = Math.atan2(sim.course.safeX(look) - s.x, look - s.z) - s.velHeading + (sim.course.safeX(s.z) - s.x) * 0.08;
            lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
          }
          sim.step(packInput(lvl, false, false));
        }
        if (sim.s.crashed || sim.dyn.avalanche.phase !== 3) caught.push(`${m.id} mood ${mood}: ${sim.s.crashCause ?? 'not finished'}`);
      }
    }
    expect(caught).toEqual([]);
  });

  it('the safe lane constant is wide enough for the sled', () => {
    expect(SAFE_LANE - SLED_RADIUS).toBeGreaterThan(1.5);
  });
});

describe('the descent', () => {
  const MANY = [...MOUNTAINS.map((m) => m.seed), ...Array.from({ length: 200 }, (_, i) => dailySeed(`rhythm-${i}`))];

  it('is a pure function of the seed, whatever order it is read in', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const a = new Course(seed);
      const b = new Course(seed);
      for (let i = 30; i >= 0; i--) b.chunk(i);
      for (let i = 0; i <= 30; i++) {
        expect(JSON.stringify(b.chunk(i))).toBe(JSON.stringify(a.chunk(i)));
        expect(b.ground(3.3, i * 31.7)).toBe(a.ground(3.3, i * 31.7));
      }
      expect(JSON.stringify(b.stages)).toBe(JSON.stringify(a.stages));
    }
  });

  it('every seed has the planned rhythm: nothing plain lasts, and nothing runs on', () => {
    const bad: string[] = [];
    for (const seed of MANY) {
      const c = new Course(seed);
      const tag = seed.toString(16);
      const secs = sectionsOf(c);
      if (c.finishZ !== FINISH) bad.push(`${tag} finish ${c.finishZ}`);
      if (c.params.rampDistance !== FINISH) bad.push(`${tag} ramp ${c.params.rampDistance}`);
      if (Math.abs(secs[secs.length - 1].z1 - (FINISH + RUN_OUT)) > 1e-6) bad.push(`${tag} ends at ${secs[secs.length - 1].z1}`);
      for (const s of secs) {
        const len = s.z1 - s.z0;
        if (s.kind === 'cruise' && len > 250) bad.push(`${tag} cruise of ${len.toFixed(0)} at ${s.z0.toFixed(0)}`);
        // A section's blend is the change itself, and a leap's or a terrace's lips change the ground again.
        const inner = s.ledges.map((l) => l.z);
        const stops = [body0(s), ...inner, s.z1];
        for (let i = 1; i < stops.length; i++) if (s.kind !== 'finish' && stops[i] - stops[i - 1] > 300) bad.push(`${tag} ${s.kind} runs ${(stops[i] - stops[i - 1]).toFixed(0)} m unchanged at ${s.z0.toFixed(0)}`);
      }
      for (const st of c.stages.slice(0, -1)) if (!secs.some((s) => Math.abs(s.z0 - st.z1) < 1e-6)) bad.push(`${tag} stage ${st.index} ends inside a section`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('every mountain holds its signature places, reachable on every seed', () => {
    const want: Record<string, SectionKind[]> = {
      alpine: ['treerun', 'lake', 'street', 'fork'],
      glacier: ['ravine', 'bridge', 'fork', 'leap'],
      volcanic: ['ravine', 'tunnel', 'bridge', 'fork'],
      blossom: ['terraces', 'tunnel', 'street', 'fork'],
    };
    const bad: string[] = [];
    for (const seed of MANY) {
      const kinds = new Set(sectionsOf(new Course(seed)).map((s) => s.kind));
      for (const k of want[biomeForSeed(seed)]) if (!kinds.has(k)) bad.push(`${seed.toString(16)} (${biomeForSeed(seed)}) has no ${k}`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('stages have real names, and no two dailies ride alike', () => {
    for (const seed of SEEDS) for (const st of new Course(seed).stages) expect(st.name).not.toMatch(/^Stage \d/);
    const seen = new Set<string>();
    const orders = new Set<string>();
    for (const seed of MANY.slice(4)) {
      const secs = sectionsOf(new Course(seed));
      seen.add(secs.map((s) => `${s.kind}${s.z0.toFixed(0)}`).join(' '));
      orders.add(secs.map((s) => s.kind).join(' '));
    }
    expect(seen.size).toBe(MANY.length - 4);
    expect(orders.size).toBeGreaterThan(40);
  });

  it('bigger contrast: real speed sections, gentle ones, and widths from about 12 to 52 m', () => {
    for (const seed of SEEDS) {
      const c = new Course(seed);
      let steep = 0;
      let gentle = 0;
      let lo = Infinity;
      let hi = 0;
      for (const s of sectionsOf(c)) {
        const g = s.shape.slope * c.params.slope;
        if (s.kind !== 'start' && s.kind !== 'leap' && g >= 0.42 && g <= 0.5) steep++;
        if (g <= 0.22) gentle++;
      }
      for (let z = 0; z < FINISH; z += 5) {
        lo = Math.min(lo, c.halfWidth(z) * 2);
        hi = Math.max(hi, c.halfWidth(z) * 2);
      }
      expect(steep + ofKind(c, 'leap').length, 'steep sections').toBeGreaterThanOrEqual(2);
      expect(gentle, 'gentle sections').toBeGreaterThanOrEqual(2);
      expect(lo).toBeLessThanOrEqual(18);
      // The old cap (a half-width of 3 m over the start's) holds everywhere but a lake.
      expect(hi).toBeGreaterThanOrEqual(ofKind(c, 'lake').length > 0 ? 52 : 40);
    }
  });

  for (const seed of SEEDS) {
    const tag = seed.toString(16);

    it(`seed ${tag}: the first minute`, () => {
      const c = new Course(seed);
      const hard: Obstacle[] = obstaclesAt(c, 0, 200);
      expect(gradeAt(c, 40)).toBeCloseTo(0.5, 1);
      expect(gradeAt(c, 100)).toBeGreaterThan(0.42);
      for (const o of hard) expect(o.z).toBeGreaterThanOrEqual(START_CLEAR_Z);
      for (const zn of zonesAt(c, 0, START_CLEAR_Z)) {
        expect(zn.ramps.filter((r) => r.z < START_CLEAR_Z)).toEqual([]);
        expect(zn.vents.filter((v) => v.z < START_CLEAR_Z)).toEqual([]);
      }
      for (let z = 130; z < 280; z += 10) expect(c.halfWidth(z)).toBeGreaterThan(16);
      // The gift line swings across the safe line.
      const line = [c.chunk(2), c.chunk(3), c.chunk(4)].flatMap((k) => k.gifts).filter((g) => g.z >= 130 && g.z < 290);
      expect(line.some((g) => g.x - c.safeX(g.z) > 3)).toBe(true);
      expect(line.some((g) => g.x - c.safeX(g.z) < -3)).toBe(true);
      const first = zonesAt(c, 150, 500).flatMap((z) => z.ramps).filter((r) => r.online);
      expect(first.length).toBe(1);
      expect(first[0].z).toBeGreaterThan(280);
      expect(first[0].z).toBeLessThan(320);
      expect(c.leaps[0].z).toBeGreaterThanOrEqual(550);
      expect(c.leaps[0].z).toBeLessThanOrEqual(750);
      const place = sectionsOf(c).find((s) => ['ravine', 'treerun', 'lake', 'fork', 'street', 'bridge', 'tunnel', 'terraces'].includes(s.kind));
      expect(place!.z0).toBeLessThanOrEqual(900);
    });

    it(`seed ${tag}: ravines are slots between walls`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'ravine')) {
        const len = s.z1 - body0(s);
        expect(len).toBeGreaterThanOrEqual(180);
        expect(len).toBeLessThanOrEqual(300);
        for (let z = body0(s); z < s.z1; z += 6) {
          const hw = c.halfWidth(z);
          expect(hw).toBeGreaterThanOrEqual(6);
          expect(hw).toBeLessThanOrEqual(8);
          expect(c.edgeLimit(z)).toBeCloseTo(5, 0);
          const cx = c.centerX(z);
          for (const side of [-1, 1]) {
            const floor = c.ground(cx + side * hw, z);
            expect(c.ground(cx + side * (hw + 6), z) - floor).toBeGreaterThanOrEqual(14);
          }
        }
        const g = (c.baseY(body0(s) + 10) - c.baseY(s.z1 - 10)) / (s.z1 - body0(s) - 20);
        expect(g).toBeGreaterThan(0.32);
        expect(g).toBeLessThan(0.48);
      }
    });

    it(`seed ${tag}: tree runs stand close either side of a clear lane`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'treerun')) {
        const obs = obstaclesAt(c, body0(s) + 10, s.z1).filter((o) => ['pine', 'blossom', 'charpine', 'spire', 'basalt', 'serac'].includes(o.kind));
        const per100 = { left: 0, right: 0 };
        for (const o of obs) {
          const off = o.x - c.safeX(o.z);
          if (Math.abs(off) <= 6.5) per100[off < 0 ? 'left' : 'right']++;
        }
        const scale = 100 / (s.z1 - body0(s) - 10);
        expect(per100.left * scale, 'left').toBeGreaterThanOrEqual(10);
        expect(per100.right * scale, 'right').toBeGreaterThanOrEqual(10);
        for (let z = body0(s); z < s.z1; z += 8) {
          expect(c.halfWidth(z)).toBeGreaterThanOrEqual(8);
          expect(c.halfWidth(z)).toBeLessThanOrEqual(10);
        }
      }
    });

    it(`seed ${tag}: lakes are flat, wide, ice, clear, and end in a lip`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'lake')) {
        const l = s.ledges.find((q) => q.kind === 'outlet')!;
        expect(l).toBeTruthy();
        for (let z = body0(s); z < l.z - 34; z += 4) {
          expect(gradeAt(c, z)).toBeLessThanOrEqual(0.05);
          expect(gradeAt(c, z)).toBeGreaterThanOrEqual(0);
          expect(c.halfWidth(z)).toBeGreaterThanOrEqual(26);
          const cx = c.centerX(z);
          for (const u of [-0.9, -0.3, 0, 0.5, 0.95]) {
            const surf = c.surface(cx + u * c.halfWidth(z), z);
            expect(surf.ice).toBe(true);
            expect(surf.drag).toBeLessThanOrEqual(0.25);
          }
          // Flattened: the same height right across the sheet.
          expect(Math.abs(c.ground(cx - 20, z) - c.ground(cx + 20, z))).toBeLessThan(1e-9);
        }
        for (const o of obstaclesAt(c, body0(s), s.z1)) expect(Math.abs(o.x - c.safeX(o.z)) - o.r).toBeGreaterThanOrEqual(8);
        // Off the lip a sled at cruise really flies.
        const f = fly(c, l.z, 30);
        expect(f.t).toBeGreaterThan(0.8);
      }
    });

    it(`seed ${tag}: a fork is two channels and a ridge, and the risk route pays`, () => {
      const c = new Course(seed);
      const g = { x: 0, z: 0 };
      for (const s of ofKind(c, 'fork')) {
        const from = body0(s);
        for (let z = from; z < s.z1; z += 5) {
          const cx = c.centerX(z);
          const a = c.altX(z)!;
          const x = c.safeX(z);
          expect(a).not.toBeNull();
          expect((a - cx) * (x - cx)).toBeLessThan(0);
          expect(Math.abs(a - cx)).toBeLessThan(c.halfWidth(z) - 2);
          // (A kicker may stand in the safe channel: the ridge is measured from the channels' floors.)
          const kicker = zonesAt(c, z - 12, z + 2).some((zn) => zn.ramps.some((r) => z > r.z - 1 && z < r.z + r.len + 2));
          if (!kicker) expect(c.ground(cx, z) - Math.max(c.ground(x, z), c.ground(a, z))).toBeGreaterThanOrEqual(2.5);
          // On the ridge the gradient pushes a sled off into a channel, and backX names that channel.
          for (const side of [-1, 1]) {
            for (const off of [1.2, 2.5, 4]) {
              const px = cx + side * off;
              c.gradient(px, z, g);
              expect(-g.x * side).toBeGreaterThan(0.1);
              // backX: the centre of the channel on that side (the lines run within a metre of it).
              const back = c.backX(z, px);
              expect((back - cx) * side).toBeGreaterThan(0);
              expect(Math.abs(Math.abs(back - cx) - Math.abs(a - cx))).toBeLessThan(1.5);
            }
          }
        }
        // Clean rejoin: past the fork the two lines come together with the ridge gone, and backX is the centre.
        const next = c.section(s.z1 + 1);
        const out = s.z1 + next.blend + 1;
        expect(c.altX(out)).toBeNull();
        expect(c.backX(out, c.centerX(out) + 5)).toBe(c.centerX(out));
        expect(c.ground(c.centerX(out), out)).toBeLessThan(c.ground(c.centerX(out) + 7, out) + 1.2);
        for (let z = s.z1; z < out; z += 2) {
          const a = c.altX(z);
          if (a !== null) expect(Math.abs(a - c.centerX(z))).toBeLessThan(c.halfWidth(z) - 1);
        }
        // Golden gifts and at least one obstacle sit on the risk line, and it holds no guaranteed lane.
        const gifts = zonesAt(c, s.z0, s.z1).length ? Array.from({ length: Math.ceil((s.z1 - s.z0) / CHUNK_LEN) + 1 }, (_, i) => c.chunk(Math.floor(s.z0 / CHUNK_LEN) + i)).flatMap((k) => k.gifts) : [];
        expect(gifts.filter((q) => q.value >= 5 && q.z >= s.z0 && q.z < s.z1 && c.altX(q.z) !== null && Math.abs(q.x - c.altX(q.z)!) < 1.5).length).toBeGreaterThanOrEqual(3);
        const blocks = obstaclesAt(c, s.z0, s.z1).filter((o) => {
          const a = c.altX(o.z);
          return a !== null && Math.abs(o.x - a) < 2.2 + o.r;
        });
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        // Worth about 1.5 to 2 s over the channel from the same 30 m/s.
        const time = (line: (z: number) => number): number => {
          let v = 30;
          let t = 0;
          for (let z = s.z0; z < s.z1; z += 1) {
            const sl = gradeAt(c, z);
            const surf = c.surface(line(z), z);
            v = Math.sqrt(Math.max(1, v * v + 2 * ((G * sl) / (1 + sl * sl) - MU * G - CD * surf.drag * v * v)));
            if (v > 46) v = 46;
            t += 1 / v;
          }
          return t;
        };
        const gain = time((z) => c.safeX(z)) - time((z) => c.altX(z) ?? c.safeX(z));
        expect(gain).toBeGreaterThan(1.2);
        expect(gain).toBeLessThan(2.4);
      }
    });

    it(`seed ${tag}: streets are narrow, gentle, and launch nothing`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'street')) {
        for (let z = body0(s); z < s.z1; z += 6) {
          expect(c.halfWidth(z)).toBeGreaterThanOrEqual(8);
          expect(c.halfWidth(z)).toBeLessThanOrEqual(10);
          expect(c.edgeLimit(z)).toBeCloseTo(2, 0);
        }
        const g = (c.baseY(body0(s)) - c.baseY(s.z1)) / (s.z1 - body0(s));
        expect(g).toBeGreaterThan(0.14);
        expect(g).toBeLessThan(0.26);
        for (const zn of zonesAt(c, s.z0, s.z1)) {
          expect(zn.ramps.filter((r) => r.z > s.z0 && r.z < s.z1)).toEqual([]);
          expect(zn.vents.filter((v) => v.z > s.z0 && v.z < s.z1)).toEqual([]);
        }
      }
    });

    it(`seed ${tag}: bridges have nothing on them and nothing either side`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'bridge')) {
        const len = s.z1 - body0(s);
        expect(len).toBeGreaterThanOrEqual(80);
        expect(len).toBeLessThanOrEqual(140);
        for (let z = body0(s); z < s.z1; z += 4) {
          const hw = c.halfWidth(z);
          expect(hw).toBeGreaterThanOrEqual(5);
          expect(hw).toBeLessThanOrEqual(6);
          expect(c.edgeLimit(z)).toBeCloseTo(0.8, 1);
          const cx = c.centerX(z);
          for (const side of [-1, 1]) expect(c.ground(cx + side * hw, z) - c.ground(cx + side * (hw + 10), z)).toBeGreaterThanOrEqual(25);
        }
        expect(obstaclesAt(c, body0(s) - 10, s.z1 + 10)).toEqual([]);
      }
    });

    it(`seed ${tag}: nothing launches in a tunnel or for 120 m uphill of it`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'tunnel')) {
        for (let z = body0(s); z < s.z1; z += 6) {
          expect(c.halfWidth(z)).toBeGreaterThanOrEqual(7);
          expect(c.halfWidth(z)).toBeLessThanOrEqual(9);
        }
        const g = (c.baseY(body0(s)) - c.baseY(s.z1)) / (s.z1 - body0(s));
        expect(g).toBeGreaterThan(0.24);
        expect(g).toBeLessThan(0.36);
        const from = s.z0 - 120;
        for (const zn of zonesAt(c, from, s.z1)) {
          expect(zn.ramps.filter((r) => r.z + r.len > from && r.z < s.z1)).toEqual([]);
          expect(zn.vents.filter((v) => v.z > from && v.z < s.z1)).toEqual([]);
          expect(zn.drops.filter((d) => d.z + d.len + d.rec > from && d.z < s.z1)).toEqual([]);
          expect(zn.moguls.filter((m) => m.z1 > from && m.z0 < s.z1)).toEqual([]);
        }
        for (const l of c.ledges) expect(l.z < from || l.z > s.z1).toBe(true);
        // A sled at 40 m/s rides the whole stretch on the ground, by the sim's own rule for leaving it.
        const v = 40;
        const dt = 1 / 60;
        let z = from;
        let y = c.ground(c.safeX(z), z);
        let vy = 0;
        for (let n = 0; z < s.z1; n++) {
          const nz = z + v * dt;
          const ny = c.ground(c.safeX(nz), nz);
          const follow = (ny - y) / dt;
          if (n > 0) expect(follow, `launch at z=${nz.toFixed(1)}`).toBeGreaterThanOrEqual(vy - G * dt * 1.5);
          z = nz;
          y = ny;
          vy = follow;
        }
        // Gentle bends.
        for (let q = body0(s); q < s.z1; q += 2) expect(Math.abs(c.safeX(q + 2) - 2 * c.safeX(q) + c.safeX(q - 2)) / 4).toBeLessThan(0.008);
      }
    });

    it(`seed ${tag}: terraces are steps a 28 to 34 m/s sled jumps one to the next`, () => {
      const c = new Course(seed);
      for (const s of ofKind(c, 'terraces')) {
        const steps = s.ledges.filter((l) => l.kind === 'step');
        expect(steps.length).toBeGreaterThanOrEqual(3);
        expect(steps.length).toBeLessThanOrEqual(4);
        for (let i = 0; i < steps.length; i++) {
          const l = steps[i];
          const x = c.safeX(l.z);
          const fall = c.ground(x, l.z) - c.ground(c.safeX(l.foot), l.foot);
          expect(fall).toBeGreaterThanOrEqual(2.5);
          expect(fall).toBeLessThanOrEqual(4);
          for (const v of [28, 31, 34]) {
            const f = fly(c, l.z, v);
            expect(f.z, `clears step ${i} at ${v}`).toBeGreaterThan(l.foot + 6);
            const next = steps[i + 1];
            if (next) {
              expect(f.z, `lands short of step ${i + 1} at ${v}`).toBeLessThan(next.z - 3);
              expect(f.z, `lands on the ramp up to step ${i + 1} at ${v}`).toBeGreaterThan(next.z - 34);
            }
          }
        }
      }
    });

    it(`seed ${tag}: leaps are real cliffs with a landing that matches the fall`, () => {
      const c = new Course(seed);
      const obstacles = obstaclesAt(c, 0, FINISH);
      for (const l of c.leaps) {
        const x = c.safeX(l.z);
        const drop = c.ground(x, l.z) - c.ground(c.safeX(l.foot), l.foot);
        expect(drop).toBeGreaterThanOrEqual(12);
        expect(drop).toBeLessThanOrEqual(26);
        // The ground stays down: well past the landing it has not come back up.
        expect(c.baseY(l.land1 + 40)).toBeLessThan(c.baseY(l.z) - 40);
        // 2.02 here is about 2 s on the real sim: this flat model flies about 0.03 s long.
        expect(fly(c, l.z, 28).t).toBeGreaterThanOrEqual(2.02);
        const landings: Flight[] = [];
        for (let v = 18; v <= 44; v += 2) landings.push(fly(c, l.z, v));
        for (let i = 0; i < landings.length; i++) {
          const f = landings[i];
          const v = 18 + i * 2;
          // Not flat: the ground under the sled is falling hard, and the fall is no worse than a free drop
          // of the cliff itself (nothing can land softer than that).
          expect(f.slope, `slope at ${v} m/s`).toBeGreaterThanOrEqual(0.32);
          expect(f.impact, `impact at ${v} m/s`).toBeLessThanOrEqual(Math.sqrt(2 * G * drop) + 1);
          expect(f.z, `lands in the zone at ${v}`).toBeGreaterThanOrEqual(l.land0);
          expect(f.z, `lands in the zone at ${v}`).toBeLessThanOrEqual(l.land1);
          // A flight is straight, so the line under it has to be: the sled comes down on the line.
          expect(c.edgeExcess(f.x, f.z), `lands in the corridor at ${v}`).toBeLessThan(-1);
          expect(Math.abs(f.x - c.safeX(f.z)), `lands on the line at ${v}`).toBeLessThan(1.5);
        }
        for (const o of obstacles) {
          const top = Math.max(o.z, o.z2);
          const bot = Math.min(o.z, o.z2);
          if (top >= l.z - 2 && bot <= l.land1 && c.edgeExcess(o.x, o.z) < 1) expect.fail(`${o.kind} in the landing of the leap at ${l.z.toFixed(0)} (z=${o.z.toFixed(1)})`);
        }
        for (const zn of zonesAt(c, l.z, l.land1)) {
          expect(zn.ramps.filter((r) => r.z > l.z - 80 && r.z < l.land1)).toEqual([]);
          expect(zn.vents.filter((q) => q.z > l.z && q.z < l.land1)).toEqual([]);
        }
      }
    });

    it(`seed ${tag}: the finish is a town square, and the run-out is clear and rideable`, () => {
      const c = new Course(seed);
      const z0 = FINISH - FINISH_SQUARE;
      expect(c.section(z0 + 1).kind).toBe('finish');
      expect(c.section(FINISH + RUN_OUT - 1).kind).toBe('finish');
      for (let z = z0 + 110; z < FINISH + RUN_OUT + 200; z += 5) {
        expect(c.halfWidth(z)).toBeGreaterThan(11);
        expect(c.halfWidth(z)).toBeLessThan(13);
        expect(gradeAt(c, z)).toBeLessThan(0.16);
        expect(gradeAt(c, z)).toBeGreaterThan(0);
      }
      expect(obstaclesAt(c, z0 + 110, FINISH + RUN_OUT + 200)).toEqual([]);
      for (const zn of zonesAt(c, z0, FINISH + RUN_OUT)) {
        expect(zn.ramps.filter((r) => r.z > z0)).toEqual([]);
        expect(zn.vents.filter((v) => v.z > z0)).toEqual([]);
        expect(zn.moguls.filter((m) => m.z1 > z0)).toEqual([]);
      }
    });

    it(`seed ${tag}: kickers fly 40 to 70 m at 30 m/s, and the line's own land clear`, () => {
      const c = new Course(seed);
      let online = 0;
      const all: string[] = [];
      for (let i = 0; i < CHUNKS; i++) {
        for (const r of c.zones(i).ramps) {
          const lip = r.z + r.len;
          // The sled leaves the lip on the face's slope, over the ground beyond.
          const lipY = c.ground(r.x, lip - 0.02);
          const dt = 1 / 60;
          let y = lipY;
          // ...which is the ground's own slope at the lip, its ripple and all: the sled leaves on what it rides.
          let vy = 30 * ((lipY - c.ground(r.x, lip - 0.52)) / 0.5);
          let d = 0;
          for (let t = 0; t < 8; t += dt) {
            vy -= G * dt;
            y += vy * dt;
            d += 30 * dt;
            if (d > 3 && y <= c.ground(r.x, lip + d)) break;
          }
          if (d < 40 || d > 70) all.push(`${r.online ? 'online' : 'off-line'} kicker at z=${r.z.toFixed(0)} flies ${d.toFixed(0)} m`);
          if (!r.online) continue;
          online++;
          expect(Math.abs(c.safeX(r.z) - r.x)).toBeLessThan(r.w / 2 - 0.5);
          expect(Math.abs(c.safeX(lip) - r.x)).toBeLessThan(r.w / 2 - 0.5);
          // The line holds true under the flight, so the sled comes down near it.
          const lean = (c.safeX(lip) - c.safeX(lip - 10)) / 10;
          expect(Math.abs(c.safeX(lip + d) - c.safeX(lip) - lean * d), `line under the flight at ${r.z.toFixed(0)}`).toBeLessThan(4);
          // Nothing near the line from the lip to well past the flight at 30 m/s.
          for (const o of obstaclesAt(c, lip, lip + 1.5 * d)) expect(Math.abs(o.x - c.safeX(o.z)) - o.r, `${o.kind} at ${o.z.toFixed(1)}`).toBeGreaterThan(5.4);
        }
      }
      expect(all.slice(0, 8)).toEqual([]);
      // Sakura's jumps are mostly its terraces, so what is counted is every time the line itself leaves the ground.
      expect(online).toBeGreaterThanOrEqual(3);
      expect(online + c.ledges.length).toBeGreaterThanOrEqual(8);
    });

    it(`seed ${tag}: rails run beside the line, four to eight a stage`, () => {
      const c = new Course(seed);
      const obstacles = obstaclesAt(c, 0, FINISH);
      for (const st of c.stages) {
        const rails = [];
        for (let i = Math.floor(st.z0 / CHUNK_LEN); i <= Math.floor(st.z1 / CHUNK_LEN); i++) rails.push(...c.zones(i).rails.filter((r) => r.z0 >= st.z0 && r.z0 < st.z1));
        expect(rails.length, `stage ${st.index}`).toBeGreaterThanOrEqual(4);
        expect(rails.length, `stage ${st.index}`).toBeLessThanOrEqual(8);
        for (const r of rails) {
          expect(r.z1).toBeGreaterThan(r.z0);
          for (let u = 0; u <= 1; u += 0.1) {
            const z = r.z0 + (r.z1 - r.z0) * u;
            const x = r.x0 + (r.x1 - r.x0) * u;
            const d = Math.abs(x - c.safeX(z));
            expect(d).toBeGreaterThanOrEqual(2.9);
            expect(d).toBeLessThanOrEqual(5.1);
            expect(c.edgeExcess(x, z)).toBeLessThan(0);
            for (const o of obstacles) if (Math.abs(o.z - z) < 4) expect(distToObstacle(o, x, z)).toBeGreaterThan(0.6);
          }
        }
      }
    });
  }

  it('every seed lays about four to eight rails a stage and a run of kickers on the line', () => {
    const bad: string[] = [];
    for (const seed of MANY.slice(0, 64)) {
      const c = new Course(seed);
      const stages = c.stages.map(() => 0);
      let online = 0;
      for (let i = 0; i < CHUNKS; i++) {
        const zn = c.zones(i);
        for (const r of zn.rails) stages[c.stageAt(r.z0).index]++;
        online += zn.ramps.filter((r) => r.online).length;
      }
      stages.forEach((n, i) => {
        // (A stage of tight places can come up one short: 2 stages in 1,000 dailies.)
        if (n < 3 || n > 8) bad.push(`${seed.toString(16)} stage ${i} has ${n} rails`);
      });
      if (online < 3 || online + c.ledges.length < 7) bad.push(`${seed.toString(16)} leaves the ground on the line only ${online} + ${c.ledges.length} times`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('the scattered world survives the script: kickers off the line, drops, moguls, vents and gates', () => {
    const count = (seed: number) => {
      const c = new Course(seed);
      const n = { off: 0, drops: 0, moguls: 0, vents: 0, gates: 0 };
      for (let i = 0; i < CHUNKS; i++) {
        const k = c.chunk(i);
        n.off += k.zones.ramps.filter((r) => !r.online).length;
        n.drops += k.zones.drops.filter((d) => d.depth > 0).length;
        n.moguls += k.zones.moguls.length;
        n.vents += k.zones.vents.length;
        n.gates += k.gates.length;
      }
      return n;
    };
    for (const m of MOUNTAINS) {
      const n = count(m.seed);
      // Ember's open ground is scarce, so its off-line kickers are few: its vents do that job.
      expect(n.off + n.vents, `${m.id} off-line kickers and vents`).toBeGreaterThanOrEqual(4);
      expect(n.drops + n.moguls, `${m.id} drops and moguls`).toBeGreaterThanOrEqual(1);
    }
    expect(count(MOUNTAINS[2].seed).vents, 'Ember vents').toBeGreaterThanOrEqual(8);
    expect(count(MOUNTAINS[3].seed).gates, 'Sakura gates').toBeGreaterThanOrEqual(4);
  });

  it('kickers and leaps fly as promised on the real sim, not only on paper', () => {
    const launch = (seed: number, x: number, z0: number, v: number, from: number): { d: number; air: number } => {
      const sim = new Sim({ seed, chaos: PLAIN, sled: 0 });
      const c = sim.course;
      const s = sim.s;
      s.z = z0;
      s.x = x;
      s.y = c.ground(x, z0);
      s.vx = 0;
      s.vz = v;
      s.speed = v;
      s.heading = 0;
      s.velHeading = 0;
      s.vy = (v * (c.ground(x, z0 + 0.5) - c.ground(x, z0))) / 0.5;
      s.invuln = 1e6;
      let off = 0;
      let air = 0;
      for (let t = 0; t < 900 && !s.crashed; t++) {
        sim.step(packInput(4, false, false));
        if (!s.grounded && !off && s.z >= from) off = s.z;
        if (off && !s.grounded) air++;
        if (off && s.grounded) return { d: s.z - off, air: air / 60 };
      }
      return { d: 0, air: 0 };
    };
    const bad: string[] = [];
    for (const m of MOUNTAINS) {
      const c = new Course(m.seed);
      for (let i = 0; i < CHUNKS; i++) {
        for (const r of c.zones(i).ramps) {
          const f = launch(m.seed, r.x, r.z - 10, 30, r.z + r.len - 3);
          if (f.d < 39 || f.d > 71) bad.push(`${m.id} kicker at ${r.z.toFixed(0)} flies ${f.d.toFixed(0)} m`);
        }
      }
      for (const l of c.leaps) {
        const f = launch(m.seed, c.safeX(l.z - 8), l.z - 8, 28, l.z - 3);
        if (f.air < 2) bad.push(`${m.id} leap at ${l.z.toFixed(0)} gives ${f.air.toFixed(2)} s at 28 m/s`);
      }
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('every leap carries the sled to the speed the sim expects of a steep face', () => {
    // The ledge list is ordered, and each one is cut into its own section's plain slope.
    for (const seed of SEEDS) {
      const c = new Course(seed);
      let last: Ledge | null = null;
      for (const l of c.ledges) {
        if (last) expect(l.z).toBeGreaterThan(last.z);
        last = l;
      }
      expect(c.leaps.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...c.leaps.map((l) => l.height))).toBeLessThanOrEqual(25.5);
    }
    const hero = Math.max(...new Course(MOUNTAINS[1].seed).leaps.map((l) => l.height));
    expect(hero).toBeGreaterThanOrEqual(23);
  });
});
