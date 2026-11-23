// Round 9, the "Not paintings" bar (brief section 2): the still set every mountain is shot at, by one rule, so the set
// can be shot again on a new mountain and laid beside the five. Five frames a mountain: its opening (60 m, on the start
// ramp), three places at a quarter, a half and three quarters of its run (one in each stage on the five), and its finish
// (60 m short of the line). Each is named by its metre and the sim's own section kind there, and the set piece it falls
// in, if any. Writes the plan as JSON for r9-stills.sh; prints it.
//   npx tsx scripts/playtest/r9-stills-plan.ts [--out <plan.json>]
import { writeFileSync } from 'node:fs';
import { courseFor } from '../../src/sim/course';
import { MOUNTAINS } from '../../src/sim/mountains';
import { planMoments } from '../../src/sim/moments';

const argv = process.argv.slice(2);
const at = argv.indexOf('--out');
const OUT = at >= 0 ? argv[at + 1] : 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/stills-plan.json';

/** The opening and the finish, metres from the gate and from the line. */
const OPENING = 60;
const SHORT_OF_LINE = 60;

const out: Record<string, { id: string; frames: { slot: string; z: number; stage: number; kind: string; piece: string }[] }> = {};
for (const [m, def] of MOUNTAINS.entries()) {
  const c = courseFor(def.seed);
  const pts = [{ slot: 'opening', z: OPENING }, ...[1, 2, 3].map((q) => ({ slot: `q${q}`, z: Math.round((q * c.finishZ) / 4) })), { slot: 'finish', z: Math.round(c.finishZ - SHORT_OF_LINE) }];
  const pieces = planMoments(c);
  const frames = pts.map((p) => {
    const sec = c.section(p.z);
    const sp = pieces.find((q) => p.z >= q.z0 && p.z < q.z1);
    return { ...p, stage: c.stageAt(p.z).index + 1, kind: sec.kind + (sec.gate ? '-threshold' : ''), piece: sp ? sp.key : '' };
  });
  out[m] = { id: def.id, frames };
  console.log(def.id.padEnd(12), frames.map((f) => `${f.slot}:${f.z}:${f.kind}${f.piece ? `:${f.piece}` : ''}`).join('  '));
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
