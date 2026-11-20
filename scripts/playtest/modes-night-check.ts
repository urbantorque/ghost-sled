// Round 8, the modes lane: checks a browser-ridden Long Night (modes-night.js's JSON) in node. Each leg's record is
// replayed alone: it must end on the hash the browser's sim had on the same tick, and what it held as it crossed its
// line must be what the next leg's record carried in.
//   npx tsx scripts/playtest/modes-night-check.ts <abs night.json>
import { readFileSync } from 'node:fs';
import { CARRIED_CHARMS } from '../../src/game/modes';
import { type RunRecord, recordFromString, recordToString, replayRecord } from '../../src/sim/replay';

type Held = { lantern: number; getUps: number; charms: number[] };
interface Leg {
  leg: number;
  mountain: string;
  mirror: boolean;
  chaos: { mood: number; event: number };
  carry: Held | null;
  start: Held;
  flipped: string;
  end?: { hash: number; tick: number; finished: boolean; distance: number; held: Held; record: Omit<RunRecord, 'inputs'> & { inputs: number[] } };
}

const raw = readFileSync(process.argv[2], 'utf8');
// (playwright-cli --raw prints the returned string as a JSON string, after its own banner.)
const body = raw.slice(Math.min(...['"{', '{'].map((k) => raw.indexOf(k)).filter((i) => i >= 0)));
const once = JSON.parse(body) as unknown;
const data = (typeof once === 'string' ? JSON.parse(once) : once) as { legs: Leg[]; save: unknown; label: string | null; errors: string[] };
let ok = true;
const atLine: Held[] = [];
for (const l of data.legs) {
  if (!l.end) {
    console.log(`leg ${l.leg + 1} ${l.mountain}: no end captured`);
    ok = false;
    continue;
  }
  const rec: RunRecord = { ...l.end.record, inputs: Uint8Array.from(l.end.record.inputs) };
  // (Through the record's own string, as a ghost or the reel would take it.)
  const back = recordFromString(recordToString(rec));
  let line: Held | null = null;
  const sim = replayRecord(back, (s) => {
    if (!line && s.finished) line = { lantern: s.s.lantern, getUps: s.s.getUps, charms: [...s.charms] };
  });
  const same = sim.hash() === l.end.hash && sim.tick === l.end.tick;
  ok &&= same;
  atLine.push(line ?? { lantern: sim.s.lantern, getUps: sim.s.getUps, charms: [...sim.charms] });
  const prev = atLine.length > 1 ? atLine[atLine.length - 2] : null;
  const want = prev ? { lantern: Math.max(0, Math.min(300, Math.round(prev.lantern))), getUps: prev.getUps, charms: prev.charms.slice(-CARRIED_CHARMS) } : null;
  const got = back.carry ? { lantern: back.carry.lantern, getUps: back.carry.getUps, charms: back.carry.charms } : null;
  const carried = JSON.stringify(want) === JSON.stringify(got);
  ok &&= carried;
  console.log(
    `leg ${l.leg + 1} ${l.mountain}${l.mirror ? ' mirrored' : ''} (canvas ${l.flipped}) mood ${l.chaos.mood} event ${l.chaos.event}: ${l.end.finished ? 'finished' : `fell at ${Math.round(l.end.distance)} m`}; replay ${same ? 'same hash' : `DIFFERENT (${sim.hash()} vs ${l.end.hash})`}; carried in ${JSON.stringify(got)} ${carried ? '= the last line' : `!= ${JSON.stringify(want)}`}`,
  );
}
console.log(`save: ${JSON.stringify(data.save)}`);
console.log(`button: ${data.label}`);
console.log(`console: ${data.errors.length ? data.errors.join(' | ') : 'clean'}`);
console.log(ok ? 'ALL EXACT' : 'NOT EXACT');
