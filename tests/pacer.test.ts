import { describe, expect, it, vi } from 'vitest';
import { FLAG_GROUNDED, FRAME_STRIDE, F_FLAGS, F_Z, SAMPLE_EVERY } from '../src/game/ghostdata';
import { GhostManager, clock, realStanding, trackStanding, unclock, type GhostEntry } from '../src/game/ghosts';
import { AIR_RATE, PACE_EASE, PACE_FROM, PACE_MAX, PACE_MIN, PACE_OPEN, PACE_SLEW, inReach, ownOnMap, paceRate, playedOnMap, reading, slowMap, stringOffset } from '../src/game/pacer';
import { FINISH_Z } from '../src/game/standing';

/** A straight run at `speed` m/s, flying over [airFrom, airTo) of its samples. */
function run(samples: number, speed: number, airFrom = -1, airTo = -1): Float32Array {
  const f = new Float32Array(samples * FRAME_STRIDE);
  for (let i = 0; i < samples; i++) {
    f[i * FRAME_STRIDE + F_Z] = (speed * (i + 1) * SAMPLE_EVERY) / 60;
    f[i * FRAME_STRIDE + F_FLAGS] = i >= airFrom && i < airTo ? 0 : FLAG_GROUNDED;
  }
  return f;
}

function field(entries: Array<Partial<GhostEntry>>, frames: Float32Array, samples: number, finishTick: number): GhostManager {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const g = new GhostManager();
  g.setField(entries.map((e, i) => ({ name: `r${i}`, kind: 'pool', score: 0, record: `rec${i}`, role: 'pack', ...e })) as Array<Omit<GhostEntry, 'id'>>);
  for (const t of g.tracks) {
    (g as unknown as { onMessage(m: unknown): void }).onMessage({
      type: 'trajectory',
      id: t.entry.id,
      frames,
      samples,
      ticks: samples * SAMPLE_EVERY,
      crashTick: -1,
      finishTick,
      stageTicks: [Math.round(finishTick / 3), Math.round((finishTick * 2) / 3)],
      distance: FINISH_Z,
      tricks: new Int32Array(0),
    });
  }
  return g;
}

describe('the string a first run rides on', () => {
  it('leaves the line in one bunch, then strings out around you', () => {
    for (let i = 0; i < 5; i++) expect(Math.abs(stringOffset(i, 5, 0, FINISH_Z))).toBeLessThan(1);
    const mid = [0, 1, 2, 3, 4].map((i) => stringOffset(i, 5, 1000, FINISH_Z));
    expect(mid[0]).toBeLessThan(-20);
    expect(mid[4]).toBeGreaterThan(20);
  });

  it('opens as you go, so the riders ahead come back to you', () => {
    const at = (z: number): number => stringOffset(4, 5, z, FINISH_Z) - 16 * Math.sin((2 * Math.PI * z) / (700 + 120 * 4) + 1.9 * 4);
    expect(at(4000)).toBeLessThan(at(500) - 30);
  });

  it('stops reading you before the line: the end of the run is a real race', () => {
    expect(reading(FINISH_Z - PACE_OPEN - 1, FINISH_Z)).toBe(true);
    expect(reading(FINISH_Z - PACE_OPEN, FINISH_Z)).toBe(false);
  });

  it('keeps a rate moving gently and inside what a rider can ride', () => {
    expect(paceRate(1, 3)).toBeCloseTo(1 + PACE_SLEW);
    expect(paceRate(1, 0)).toBeCloseTo(1 - PACE_EASE);
    expect(PACE_EASE).toBeGreaterThan(PACE_SLEW);
    expect(paceRate(PACE_MAX, 3)).toBe(PACE_MAX);
    expect(paceRate(PACE_MIN, 0)).toBe(PACE_MIN);
  });
});

describe('a rider reading you', () => {
  const samples = 4800; // 160 s of its own run
  const frames = run(samples, 30);
  const end = 150 * 60;

  it('falls back to a slow rider, and its finish moves with it', () => {
    const g = field([{ reads: true }], frames, samples, end);
    const t = g.tracks[0];
    const was = t.finishTick;
    for (let tick = PACE_FROM; tick < 60 * 40; tick += 15) g.pace(tick, (tick / 60) * 15, true);
    expect(t.rate).toBeLessThan(0.7);
    expect(t.finishTick).toBeGreaterThan(was + 60 * 20);
    expect(Math.abs(g.zAt(t, 60 * 40) - 40 * 15)).toBeLessThan(90);
  });

  it('has its clock run on without a jump at every reading', () => {
    const g = field([{ reads: true }], frames, samples, end);
    const t = g.tracks[0];
    let was = clock(t, PACE_FROM);
    for (let tick = PACE_FROM; tick < 60 * 30; tick += 15) {
      was = clock(t, tick);
      g.pace(tick, (tick / 60) * 18, true);
      expect(Math.abs(clock(t, tick) - was)).toBeLessThan(1e-6);
    }
  });

  it('keeps its real run for a grudge or a rematch, whatever it rode against you', () => {
    const g = field([{ reads: true }, {}], frames, samples, end);
    const [t, plain] = g.tracks;
    for (let tick = PACE_FROM; tick < 60 * 40; tick += 15) g.pace(tick, (tick / 60) * 15, true);
    expect(trackStanding(t).time!).toBeGreaterThan(end / 60 + 20);
    expect(realStanding(t).time).toBeCloseTo(end / 60, 3);
    expect(realStanding(plain)).toEqual(trackStanding(plain));
  });

  it('promises a rider who read you only if its real run is a race for you', () => {
    expect(inReach(145, 150)).toBe(true);
    expect(inReach(135, 150)).toBe(true);
    expect(inReach(150, 300)).toBe(false);
    expect(inReach(null, 150)).toBe(false);
  });

  it('leaves what it has already done alone', () => {
    const g = field([{ reads: true }], frames, samples, end);
    const t = g.tracks[0];
    const first = t.stageTicks[0];
    for (let tick = PACE_FROM; tick < first + 600; tick += 15) g.pace(tick, (tick / 60) * 31, true);
    const stood = t.stageTicks[0];
    expect(Math.abs(stood - first)).toBeLessThan(first);
    for (let tick = first + 600; tick < first + 1200; tick += 15) g.pace(tick, (tick / 60) * 16, true);
    expect(t.stageTicks[0]).toBe(stood);
  });

  it('holds its rate once your run is over, or near the line', () => {
    const g = field([{ reads: true }], frames, samples, end);
    const t = g.tracks[0];
    for (let tick = PACE_FROM; tick < 600; tick += 15) g.pace(tick, (tick / 60) * 20, true);
    const held = t.rate;
    for (let tick = 600; tick < 1200; tick += 15) g.pace(tick, 200, false);
    expect(t.rate).toBe(held);
    for (let tick = 1200; tick < 1800; tick += 15) g.pace(tick, FINISH_Z - 10, true);
    expect(t.rate).toBe(held);
  });

  it('flies near true speed, however slowly it is riding', () => {
    const air = run(samples, 30, 300, 900);
    const g = field([{ reads: true }], air, samples, end);
    const t = g.tracks[0];
    t.rate = 0.5;
    g.pace(PACE_FROM, 10, false);
    expect(t.warp!.rate).toBe(0.5);
    t.warp = { from: 1200, at: 800, rate: 0.5 };
    (g as unknown as { paceAt: number }).paceAt = 0;
    g.pace(1200, 300, false);
    expect(t.warp!.rate).toBe(AIR_RATE);
  });

  it('never touches a rider that does not read you, and costs nothing with nobody reading', () => {
    const g = field([{ reads: true }, { kind: 'you', role: undefined }, { kind: 'grudge', role: undefined }, { kind: 'friend', role: undefined }], frames, samples, end);
    for (let tick = PACE_FROM; tick < 60 * 40; tick += 15) g.pace(tick, (tick / 60) * 15, true);
    for (const t of g.tracks.slice(1)) {
      expect(t.warp).toBeNull();
      expect(t.finishTick).toBe(end);
      expect(clock(t, 1000)).toBe(1000);
    }
    const quiet = field([{}, {}], frames, samples, end);
    for (let tick = PACE_FROM; tick < 60 * 40; tick += 15) quiet.pace(tick, (tick / 60) * 15, true);
    for (const t of quiet.tracks) {
      expect(t.warp).toBeNull();
      expect(t.finishTick).toBe(end);
    }
  });
});

describe('a slow rider in the air', () => {
  const samples = 3000;
  const end = samples * SAMPLE_EVERY;
  const frames = run(samples, 30, 1000, 1150);
  const pace = 0.5;
  const map = slowMap(frames, samples, pace, end)!;

  it('still reaches its end on its real time', () => {
    expect(map[samples]).toBeCloseTo(end / pace, 0);
    for (let i = 1; i <= samples; i++) expect(map[i]).toBeGreaterThan(map[i - 1]);
  });

  it('flies near true speed and takes the time back on the ground', () => {
    const rate = (i: number): number => SAMPLE_EVERY / (map[i + 1] - map[i]);
    expect(rate(1075)).toBeCloseTo(AIR_RATE, 2);
    expect(rate(500)).toBeLessThan(pace);
    expect(rate(500)).toBeGreaterThan(pace * 0.9);
  });

  it('eases into the flight rather than snapping', () => {
    for (let i = 960; i < 1040; i++) {
      const a = SAMPLE_EVERY / (map[i + 1] - map[i]);
      const b = SAMPLE_EVERY / (map[i + 2] - map[i + 1]);
      expect(Math.abs(a - b)).toBeLessThan(0.05);
    }
  });

  it('reads the same both ways', () => {
    for (const own of [0, 10, 1999, 2100, 2200, 5000, end, end + 40]) expect(ownOnMap(map, playedOnMap(map, own, pace), pace)).toBeCloseTo(own, 2);
    const t = { pace, swing: 0, swingEnd: 0, map };
    for (const own of [100, 2150, 5000]) expect(clock(t, unclock(t, own))).toBeCloseTo(own, 0);
    const surging = { pace, swing: 0.018 * 12000, swingEnd: 12000, map };
    for (const own of [100, 2150, 5000]) expect(Math.abs(clock(surging, unclock(surging, own)) - own)).toBeLessThan(1);
  });

  it('leaves a true-speed rider, or a run with no flight, to its plain clock', () => {
    expect(slowMap(frames, samples, 1, end)).toBeNull();
    expect(slowMap(run(samples, 30), samples, pace, end)).toBeNull();
  });

  it('keeps its finish when it coasts on past the line', () => {
    const finish = 5000;
    const m = slowMap(frames, samples, pace, finish)!;
    expect(playedOnMap(m, finish, pace)).toBeCloseTo(finish / pace, 0);
  });
});
