// Round 9, Gablefall's pool read off (notes/r9-gablefall.md section 3): its ghosts' finish times, spread and home riders,
// beside the five's, the Old Run's and Gullhaven's spread. Light. `npx tsx scripts/r9/gablefall-pool.ts`
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'src/data/ghosts');
const f1 = (v: number): string => v.toFixed(1);
for (const id of ['pinecrest', 'oldrun', 'gullhaven', 'gablefall']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool: any = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  const gs = pool.ghosts ?? pool;
  const fin = 2800;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const times = gs.filter((g: any) => (g.distance ?? 0) >= (id === 'gablefall' ? fin : id === 'oldrun' ? 3000 : id === 'gullhaven' ? 4800 : 4500)).map((g: any) => g.ticks / 60).sort((a: number, b: number) => a - b);
  const q = (p: number): number => times[Math.min(times.length - 1, Math.floor(p * times.length))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const home = gs.filter((g: any) => ['Wren Slater', 'Abel Thorne', 'Hettie Lamb'].includes(g.name)).map((g: any) => `${g.name} ${f1(g.ticks / 60)}`);
  console.log(`${id.padEnd(10)} ${gs.length} ghosts, ${times.length} finished; ${f1(times[0])} to ${f1(times[times.length - 1])} s, median ${f1(q(0.5))}, p90/p10 ${(q(0.9) / q(0.1)).toFixed(2)}${id === 'gablefall' ? `; ${home.join(', ')}` : ''}`);
}
