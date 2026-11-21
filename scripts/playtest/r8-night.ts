// Round 8, the modes lane: Long Nights ridden in node (r8night.ts) by the lab's mid pilot, each leg's record replayed
// alone from its string. Prints each leg (mountain, chaos, what it carried in and out, the hashes) and the depth.
//   npx tsx scripts/playtest/r8-night.ts [--nights 4] [--legs 3] [--pilot mid] [--out <abs json>]
import { writeFileSync } from 'node:fs';
import { rideNight } from './r8night';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const nights = Number(opt('nights', '4'));
const legs = Number(opt('legs', '3'));
const pilot = opt('pilot', 'mid') as 'mid';
const out = opt('out', '');
const t0 = performance.now();
let best: Parameters<typeof rideNight>[0]['best'];
const all = [];
for (let i = 0; i < nights; i++) {
  const r = rideNight({ seed: 0x6e19 + i * 104729, pilotSeed: 1234 + i * 37, legs, pilot, best });
  best = r.best.after;
  all.push(r);
  console.log(`night ${i + 1} (seed ${r.seed}): depth ${r.depth.legs} legs ${r.depth.z} m${r.best.newBest ? ', a new best' : ''}; carries ${r.ok.carries ? 'exact' : 'WRONG'}, replays ${r.ok.replays ? 'exact' : 'WRONG'}, chaos ${r.ok.chaosRises ? 'rising' : 'NOT RISING'}`);
  for (const l of r.legs) {
    const c = l.carriedIn;
    const fmt = (h: { lantern: number; getUps: number; charms: number[] }): string => `lantern ${Math.round(h.lantern)}, get-ups ${h.getUps}, charms [${h.charms.join(',')}]`;
    console.log(`  leg ${l.n} ${l.mountain}${l.mirror ? ' (mirror)' : ''} step ${l.step} ${l.mood || 'plain'}${l.event ? ' + ' + l.event : ''}: ${l.finished ? `finished ${l.seconds.toFixed(1)} s` : `fell at ${Math.round(l.metres)} m`}`);
    console.log(`    in:  ${c ? fmt(c) : '(fresh)'}; sim took ${fmt(l.startHeld)}; record holds ${l.recordCarry ? fmt(l.recordCarry) : 'no carry'}`);
    console.log(`    out: ${fmt(l.heldOut)} (${l.charmNames.join(', ') || 'no charms'}); hash ${l.hash} replay ${l.replayHash} ${l.hash === l.replayHash ? 'same' : 'DIFFERENT'}; ${l.recordBytes} chars`);
  }
}
console.log(`best depth after ${nights} nights: ${best ? `${best.legs} legs ${best.z} m` : 'none'} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
if (out) writeFileSync(out, JSON.stringify(all, null, 1));
