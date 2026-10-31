// Rides telemetry.js's stunt pilot against the real Sim in node, with no browser, ghosts or director: a
// quick check that the pilot reaches the fun-pass moments (kickers, tier 2 and 3 drifts, near misses,
// spins and flips, stomps) and lives a human-ish 40 to 150 s. The pilot's source is read out of
// telemetry.js (between its STUNT:BEGIN and STUNT:END markers), so this rides exactly what the play-test
// rides.
//   npx tsx scripts/playtest/stunt-sim.ts [runsPerMountain=6] [firstSeed=1234] [mood=0]
import { readFileSync } from 'node:fs';
import { ChaosEvent, type Mood } from '../../src/sim/chaos';
import { MOUNTAINS } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';

export interface StuntPilot {
  sample(): { steer: number; action: boolean };
  stats: Record<string, unknown> & { msMax: number; rollouts: number; rollTicks: number };
}
type MakeStunt = (sim: Sim, opts?: { seed?: number; err?: Record<string, number> }) => StuntPilot;

/** The stunt pilot's factory, evaluated from telemetry.js's source. */
export function loadStunt(): MakeStunt {
  const src = readFileSync(new URL('./telemetry.js', import.meta.url), 'utf8');
  const m = /\/\* STUNT:BEGIN \*\/([\s\S]*?)\/\* STUNT:END \*\//.exec(src);
  if (!m) throw new Error('telemetry.js has no STUNT:BEGIN/END block');
  return new Function(`${m[1]}\nreturn makeStuntPilot;`)() as MakeStunt;
}

export interface StuntRide {
  m: number;
  seed: number;
  seconds: number;
  distance: number;
  cause: string | null;
  kickers: number;
  boostPops: number;
  drift: [number, number, number];
  /** Seconds each released drift was held (tier >= 1). */
  driftHolds: number[];
  nearMiss: number;
  whisker: number;
  gaps: number[];
  perfect: number;
  clean: number;
  sketchy: number;
  spins: number;
  flips: number;
  maxSimFlow: number;
  bestCombo: number;
  pilot: StuntPilot['stats'];
  /** The packed input bytes, for determinism checks. */
  inputs: number[];
}

/** One stunt run on mountain m (0..3) until a crash or maxSeconds. */
export function rideStunt(make: MakeStunt, m: number, seed: number, maxSeconds = 180, mood = 0): StuntRide {
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: mood as Mood, event: ChaosEvent.None, seed: 0 }, sled: 0 });
  const pilot = make(sim, { seed });
  const r: StuntRide = { m, seed, seconds: 0, distance: 0, cause: null, kickers: 0, boostPops: 0, drift: [0, 0, 0], driftHolds: [], nearMiss: 0, whisker: 0, gaps: [], perfect: 0, clean: 0, sketchy: 0, spins: 0, flips: 0, maxSimFlow: 0, bestCombo: 0, pilot: pilot.stats, inputs: [] };
  let wasGround = true;
  let driftStart = -1;
  const onRamp = (): boolean => {
    const s = sim.s;
    for (let k = Math.floor(s.z / 64) - 1; k <= Math.floor(s.z / 64); k++) {
      if (k < 0) continue;
      for (const rp of sim.course.zones(k).ramps) {
        const u = (s.z - rp.z) / rp.len;
        if (u > 0.4 && u < 1.2 && Math.abs(s.x - rp.x) < rp.w * 0.5 + 0.6) return true;
      }
    }
    return false;
  };
  while (!sim.s.crashed && sim.tick < maxSeconds * 60) {
    const o = pilot.sample();
    const byte = (o.steer | 0) | (o.action ? 16 : 0);
    r.inputs.push(byte);
    sim.step(byte);
    const s = sim.s;
    for (const e of sim.events) {
      if (e.type === 'drift' && e.phase === 'start') driftStart = sim.tick;
      else if (e.type === 'drift' && e.phase === 'release' && e.tier > 0) {
        r.drift[e.tier - 1]++;
        if (driftStart >= 0) r.driftHolds.push(+((sim.tick - driftStart) / 60).toFixed(2));
      } else if (e.type === 'style' && e.kind === 'boostPop') r.boostPops++;
      else if (e.type === 'style' && e.kind === 'nearMiss') {
        r.nearMiss++;
        const gap = e.gap ?? 9;
        r.gaps.push(+gap.toFixed(2));
        if (gap < 0.45 && s.speed >= 18) r.whisker++;
      } else if (e.type === 'land') {
        if (e.quality === 'perfect') r.perfect++;
        else if (e.quality === 'clean') r.clean++;
        else if (e.quality === 'sketchy') r.sketchy++;
        if (e.halfTurns > 0) r.spins++;
        if (e.flips > 0) r.flips++;
      }
    }
    if (wasGround && !s.grounded && onRamp()) r.kickers++;
    wasGround = s.grounded;
    if (s.flow > r.maxSimFlow) r.maxSimFlow = s.flow;
  }
  r.seconds = +(sim.tick / 60).toFixed(1);
  r.distance = Math.round(sim.distance);
  r.cause = sim.s.crashed ? sim.s.crashCause : 'timeout';
  r.bestCombo = sim.stats.bestCombo;
  return r;
}

function main(): void {
  const runs = Number(process.argv[2] ?? 6);
  const first = Number(process.argv[3] ?? 1234);
  const mood = Number(process.argv[4] ?? 0);
  const make = loadStunt();
  const all: StuntRide[] = [];
  for (let m = 0; m < 4; m++) {
    for (let i = 0; i < runs; i++) {
      const t0 = Date.now();
      const r = rideStunt(make, m, first + i, 180, mood);
      all.push(r);
      const p = r.pilot as Record<string, unknown>;
      console.log(
        `m${m} seed ${r.seed}: ${r.seconds}s ${r.distance}m ${r.cause} | kick ${r.kickers} (boost ${r.boostPops}) | drift t1/t2/t3 ${r.drift.join('/')} holds ${r.driftHolds.join(',')} | near ${r.nearMiss} (whisker ${r.whisker}) gaps ${r.gaps.join(',')} | land P/C/S ${r.perfect}/${r.clean}/${r.sketchy} spins ${r.spins} flips ${r.flips} | flow ${r.maxSimFlow.toFixed(2)} combo ${r.bestCombo} | ms ${Date.now() - t0} max ${p.msMax} rollouts ${p.rollouts} bails ${p.driftBails} kickTries ${p.kickTries} skips ${p.kickSkips} grazeTries ${p.grazeTries} blind ${p.grazeBlind}`,
      );
    }
  }
  const secs = all.map((r) => r.seconds).sort((a, b) => a - b);
  const sum = (f: (r: StuntRide) => number): number => all.reduce((s, r) => s + f(r), 0);
  console.log(
    `\n${all.length} runs: seconds median ${secs[secs.length >> 1]} min ${secs[0]} max ${secs[secs.length - 1]}; in 40..150 s: ${all.filter((r) => r.seconds >= 40 && r.seconds <= 150).length}; kickers ${sum((r) => r.kickers)}; drift t1/t2/t3 ${sum((r) => r.drift[0])}/${sum((r) => r.drift[1])}/${sum((r) => r.drift[2])}; near ${sum((r) => r.nearMiss)} whisker ${sum((r) => r.whisker)}; perfect ${sum((r) => r.perfect)} sketchy ${sum((r) => r.sketchy)}; spins ${sum((r) => r.spins)} flips ${sum((r) => r.flips)}; causes ${JSON.stringify(all.reduce<Record<string, number>>((o, r) => ((o[r.cause ?? '?'] = (o[r.cause ?? '?'] ?? 0) + 1), o), {}))}`,
  );
}

if (process.argv[1] && /stunt-sim\.ts$/.test(process.argv[1])) main();
