// Round 9, milestone 0: each mountain's course drawn from the sim's own course (course.ts, not the render), one SVG a
// mountain and one sheet of every mountain the game registers, all on one scale, so the five can be seen to be one
// course at a glance and a new mountain can be laid beside them later on the same scale. Node only, no browser.
//   npx tsx scripts/playtest/r9-profiles.ts [--out <dir>] [--rides <r9-courses.json>]
// --out defaults to the main checkout's shots/r9/measure/profiles/. --rides (default: r9-courses.json beside it) is
// r9-courses.ts's output, read for where the mid pilot flew; without it the flight rows are left empty.
//
// Each mountain's panel, top to bottom, on one z axis (metres down the run; dashed lines are stage lines, the dark
// band at the end is the town square, the solid line the finish):
//   sections   the descent's sections, shaded by family (open ground, a place, a leap, the start and the square),
//              the set pieces bracketed over them
//   height     baseY, the ground's long profile, metres below the gate (leaps and steps are cut into it); each leap's
//              lip is marked with its cliff
//   grade      the 25 m grade ahead, with the pitch (0.38) and flat (0.16) lines; pitches and flats ruled under it
//   plan       the corridor from above (world x): its floor between the edges, the turn-back line past the banks
//              (dashed), the safe line with its bends ticked, and every collider the sim reads, by kind
//   width      the corridor's width, 2 x halfWidth, with the 12 m and 30 m lines
//   air        the leaps (lip to last landing), kickers (tall ticks on the line, short off it), terrace steps and a
//              lake's outlet; then the mid pilot's flights, one row a seed
//   colliders  a tick per collider, one row a kind group
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { courseFor } from '../../src/sim/course';
import { type CourseFacts, type Flight, FIVE, MOUNTAINS, type Samples, collidersOf, courseFacts, groupOf, sample } from './r9-courselib';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const OUT = opt('out', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/profiles');
const RIDES = opt('rides', join(OUT, '..', 'r9-courses.json'));

/** The shared scale: every panel and every mountain, now and later. */
export const SCALE = {
  /** Pixels a metre down the run. */
  z: 0.3,
  /** Pixels a metre of height. */
  y: 0.1,
  /** Height shown: metres below the gate. */
  yRange: 1800,
  /** Pixels a unit of grade, and the most shown. */
  grade: 70,
  gradeMax: 0.9,
  /** Pixels a metre across, and the half-width shown either side of x = 0. */
  x: 1.1,
  xRange: 72,
  /** Pixels a metre of width, and the most shown. */
  w: 1.3,
  wMax: 56,
  /** The z axis always shows at least this far. */
  zMin: 4700,
};

const LEFT = 120;
const RIGHT = 30;

interface Midflights {
  seed: number;
  flights: Flight[];
}
const midFlights = new Map<string, Midflights[]>();
if (existsSync(RIDES)) {
  const j = JSON.parse(readFileSync(RIDES, 'utf8'));
  for (const m of j.mountains ?? []) midFlights.set(m.id, m.midFlights ?? []);
}

const FAMILY: Record<string, 'open' | 'place' | 'leap' | 'end'> = {
  cruise: 'open',
  chute: 'open',
  bowl: 'open',
  switchbacks: 'open',
  benches: 'open',
  gully: 'open',
  split: 'open',
  ravine: 'place',
  treerun: 'place',
  lake: 'place',
  fork: 'place',
  street: 'place',
  bridge: 'place',
  tunnel: 'place',
  terraces: 'place',
  leap: 'leap',
  start: 'end',
  finish: 'end',
};
const SHORT: Record<string, string> = {
  cruise: 'cruise',
  chute: 'chute',
  bowl: 'bowl',
  switchbacks: 'switch',
  benches: 'bench',
  gully: 'gully',
  split: 'split',
  ravine: 'ravine',
  treerun: 'trees',
  lake: 'lake',
  fork: 'fork',
  street: 'street',
  bridge: 'bridge',
  tunnel: 'tunnel',
  terraces: 'terrace',
  leap: 'leap',
  start: 'start',
  finish: 'square',
};

const STYLE = `<style>
  svg { --surface:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --axis:#c3c2b7;
        --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; --open:#efeee9; --place:#d3d2ca; --leap:#9a9890; --end:#52514e;
        --floor:#e9eef5; --wash:rgba(11,11,11,0.05); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  @media (prefers-color-scheme: dark) {
    svg { --surface:#1a1a19; --ink:#f0efec; --ink2:#c3c2b7; --muted:#898781; --grid:#2c2c2a; --axis:#383835;
          --s1:#3987e5; --s2:#d95926; --s3:#199e70; --open:#262624; --place:#3a3a37; --leap:#5c5b56; --end:#c3c2b7;
          --floor:#1f2733; --wash:rgba(255,255,255,0.05); }
  }
  .bg { fill: var(--surface); }
  .t1 { fill: var(--ink); font-size: 15px; font-weight: 600; }
  .t2 { fill: var(--ink2); font-size: 11px; }
  .t3 { fill: var(--muted); font-size: 10px; }
  .tin { fill: var(--ink); font-size: 9px; }
  .tinv { fill: var(--surface); font-size: 9px; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .axis { stroke: var(--axis); stroke-width: 1; }
  .stage { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3; }
  .line { stroke: var(--ink); stroke-width: 2px; fill: none; stroke-linejoin: round; }
  .line1 { stroke: var(--ink); stroke-width: 1.2px; fill: none; }
  .ref { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 2 3; }
  .reach { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; fill: none; }
  .floor { fill: var(--floor); }
  .area { fill: var(--axis); }
  .wash { fill: var(--wash); }
  .open { fill: var(--open); } .place { fill: var(--place); } .leap { fill: var(--leap); } .end { fill: var(--end); }
  .tall { fill: var(--s1); } .low { fill: var(--s2); } .other { fill: var(--s3); }
  .tallS { stroke: var(--s1); } .lowS { stroke: var(--s2); } .otherS { stroke: var(--s3); }
  .flight { fill: var(--ink2); }
  .feat { stroke: var(--ink); stroke-width: 1.5; }
  .featL { stroke: var(--ink2); stroke-width: 1; }
  .sq { fill: var(--wash); }
  .fin { stroke: var(--ink); stroke-width: 2; }
</style>`;

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n1 = (v: number): string => (Math.round(v * 10) / 10).toString();

/** One mountain's panel, drawn at (0, top); returns its markup and height. */
function panel(c: CourseFacts, s: Samples, top: number, zMax: number): { svg: string; h: number } {
  const course = courseFor(c.seed);
  const X = (z: number): number => LEFT + z * SCALE.z;
  const out: string[] = [];
  let y = top;
  const zEnd = X(c.length);
  // Title.
  const mid = (() => {
    const fl = midFlights.get(c.id);
    return fl && fl.length ? `, mid pilot's flights over ${fl.length} seeds` : '';
  })();
  out.push(`<text class="t1" x="${LEFT}" y="${y + 15}">${esc(c.name)}</text>`);
  out.push(`<text class="t2" x="${LEFT + 170}" y="${y + 15}">${c.length} m in ${c.stages.length} stages (${c.stages.map((q) => q.len).join(', ')}); ${n1(c.drop)} m down, ${c.leaps.length} leaps, plain grade ${c.slope.toFixed(3)}, mean width ${n1(c.width)} m, ${n1(c.hazards.all)} colliders a km, ${c.bends.toFixed(2)} bends a km${mid}</text>`);
  y += 24;
  const trackTop = y;
  const label = (t: string, yy: number, sub = ''): void => {
    out.push(`<text class="t2" x="8" y="${yy}">${t}</text>`);
    if (sub) out.push(`<text class="t3" x="8" y="${yy + 12}">${sub}</text>`);
  };

  // Sections and set pieces.
  label('sections', y + 24, 'set pieces over');
  for (const p of c.setPieces) {
    const a = X(p.z0);
    const b = X(p.z1);
    out.push(`<path class="line1" d="M${n1(a)},${y + 9} V${y + 4} H${n1(b)} V${y + 9}"><title>${esc(`${p.key}: ${p.verb}, ${p.z0.toFixed(0)} to ${p.z1.toFixed(0)} m`)}</title></path>`);
    out.push(`<text class="t3" x="${n1(a + 2)}" y="${y + 2}">${esc(p.verb)}</text>`);
  }
  y += 12;
  for (const sec of c.sections) {
    const a = X(sec.z0);
    const b = X(sec.z1);
    const fam = sec.gate ? 'open' : FAMILY[sec.kind];
    out.push(`<rect class="${fam}" x="${n1(a)}" y="${y}" width="${n1(Math.max(0.5, b - a - 1))}" height="16"><title>${esc(`${sec.kind}${sec.gate ? ' (a stage line\'s threshold)' : ''}: ${sec.z0.toFixed(0)} to ${sec.z1.toFixed(0)} m`)}</title></rect>`);
    if (b - a > 30) out.push(`<text class="${fam === 'end' ? 'tinv' : 'tin'}" x="${n1(a + 3)}" y="${y + 11.5}">${SHORT[sec.kind]}${sec.gate ? '*' : ''}</text>`);
  }
  y += 24;

  // Height.
  const hTop = y;
  const hH = SCALE.yRange * SCALE.y;
  label('height', y + 12, 'm below the gate');
  for (let m = 0; m <= SCALE.yRange; m += 300) {
    const yy = hTop + m * SCALE.y;
    out.push(`<line class="grid" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${yy}" y2="${yy}"/>`);
    out.push(`<text class="t3" x="${LEFT - 6}" y="${yy + 3}" text-anchor="end">${m}</text>`);
  }
  out.push(`<rect class="sq" x="${n1(X(c.length - c.finish.square))}" y="${hTop}" width="${n1(c.finish.square * SCALE.z)}" height="${hH}"/>`);
  for (const p of c.setPieces) out.push(`<rect class="wash" x="${n1(X(p.z0))}" y="${hTop}" width="${n1((p.z1 - p.z0) * SCALE.z)}" height="${hH}"/>`);
  const y0 = s.y[0];
  let d = '';
  for (let i = 0; i < s.z.length; i += 2) d += `${i ? 'L' : 'M'}${n1(X(s.z[i]))},${n1(hTop + (y0 - s.y[i]) * SCALE.y)}`;
  out.push(`<path class="line" d="${d}"/>`);
  for (const l of c.leaps) {
    const yy = hTop + (y0 - course.baseY(l.z)) * SCALE.y;
    out.push(`<circle cx="${n1(X(l.z))}" cy="${n1(yy)}" r="4" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"><title>${esc(`leap: lip at ${l.z.toFixed(0)} m, a ${l.height.toFixed(1)} m cliff`)}</title></circle>`);
    out.push(`<text class="t3" x="${n1(X(l.z) + 6)}" y="${n1(yy - 5)}">${l.z.toFixed(0)} m, ${l.height.toFixed(1)} m cliff</text>`);
  }
  y += hH + 10;

  // Grade.
  const gTop = y;
  const gH = SCALE.gradeMax * SCALE.grade;
  label('grade', y + 12, '25 m ahead');
  const gy = (g: number): number => gTop + gH - Math.max(0, Math.min(SCALE.gradeMax, g)) * SCALE.grade;
  out.push(`<line class="axis" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${gy(0)}" y2="${gy(0)}"/>`);
  let ga = `M${LEFT},${gy(0)}`;
  for (let i = 0; i < s.z.length; i += 2) {
    const j = Math.min(s.z.length - 1, i + 25);
    const g = j > i ? (s.y[i] - s.y[j]) / (j - i) : 0;
    ga += `L${n1(X(s.z[i]))},${n1(gy(g))}`;
  }
  ga += `L${n1(zEnd)},${gy(0)}Z`;
  out.push(`<path class="area" d="${ga}"/>`);
  for (const [g, t] of [
    [0.38, 'pitch 0.38'],
    [0.16, 'flat 0.16'],
  ] as const) {
    out.push(`<line class="ref" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${gy(g)}" y2="${gy(g)}"/>`);
    out.push(`<text class="t3" x="${LEFT - 6}" y="${gy(g) + 3}" text-anchor="end">${t}</text>`);
  }
  y += gH + 3;
  for (const p of c.pitches) out.push(`<rect class="end" x="${n1(X(p.z0))}" y="${y}" width="${n1((p.z1 - p.z0) * SCALE.z)}" height="3"><title>pitch ${p.z0} to ${p.z1} m</title></rect>`);
  for (const p of c.flats) out.push(`<rect class="place" x="${n1(X(p.z0))}" y="${y}" width="${n1((p.z1 - p.z0) * SCALE.z)}" height="3"><title>flat ${p.z0} to ${p.z1} m</title></rect>`);
  y += 12;

  // Plan.
  const pTop = y;
  const pH = 2 * SCALE.xRange * SCALE.x;
  label('plan', y + 12, 'world x, m');
  const px = (x: number): number => pTop + pH / 2 + Math.max(-SCALE.xRange, Math.min(SCALE.xRange, x)) * SCALE.x;
  for (const m of [-60, -30, 0, 30, 60]) {
    out.push(`<line class="grid" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${px(m)}" y2="${px(m)}"/>`);
    out.push(`<text class="t3" x="${LEFT - 6}" y="${px(m) + 3}" text-anchor="end">${m}</text>`);
  }
  let fl = '';
  let fr = '';
  let rl = '';
  let rr = '';
  let sl = '';
  for (let i = 0; i < s.z.length; i += 3) {
    const xz = n1(X(s.z[i]));
    fl += `${i ? 'L' : 'M'}${xz},${n1(px(s.cx[i] - s.hw[i]))}`;
    fr = `L${xz},${n1(px(s.cx[i] + s.hw[i]))}` + fr;
    rl += `${i ? 'L' : 'M'}${xz},${n1(px(s.cx[i] - s.hw[i] - s.limit[i]))}`;
    rr += `${i ? 'L' : 'M'}${xz},${n1(px(s.cx[i] + s.hw[i] + s.limit[i]))}`;
    sl += `${i ? 'L' : 'M'}${xz},${n1(px(s.sx[i]))}`;
  }
  out.push(`<path class="floor" d="${fl}${fr.replace(/^L/, 'L')}Z"/>`);
  out.push(`<path class="reach" d="${rl}"/><path class="reach" d="${rr}"/>`);
  const obs = collidersOf(course);
  for (const o of obs) {
    const grp = groupOf(o);
    const cls = grp === 'tall' ? 'tall' : grp === 'low' ? 'low' : 'other';
    out.push(`<circle class="${cls}" cx="${n1(X((o.z + o.z2) / 2))}" cy="${n1(px((o.x + o.x2) / 2))}" r="1.6"><title>${o.kind} at ${((o.z + o.z2) / 2).toFixed(0)} m</title></circle>`);
  }
  out.push(`<path class="line" d="${sl}"/>`);
  for (const z of c.bendZ) out.push(`<line class="line1" x1="${n1(X(z))}" x2="${n1(X(z))}" y1="${n1(px(s.sx[Math.round(z)]) - 5)}" y2="${n1(px(s.sx[Math.round(z)]) + 5)}"><title>a bend of the safe line at ${z} m</title></line>`);
  y += pH + 10;

  // Width.
  const wTop = y;
  const wH = SCALE.wMax * SCALE.w;
  label('width', y + 12, '2 x halfWidth, m');
  const wy = (w: number): number => wTop + wH - Math.min(SCALE.wMax, w) * SCALE.w;
  let wa = `M${LEFT},${wy(0)}`;
  for (let i = 0; i < s.z.length; i += 3) wa += `L${n1(X(s.z[i]))},${n1(wy(2 * s.hw[i]))}`;
  wa += `L${n1(zEnd)},${wy(0)}Z`;
  out.push(`<path class="area" d="${wa}"/>`);
  out.push(`<line class="axis" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${wy(0)}" y2="${wy(0)}"/>`);
  for (const w of [12, 30]) {
    out.push(`<line class="ref" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${wy(w)}" y2="${wy(w)}"/>`);
    out.push(`<text class="t3" x="${LEFT - 6}" y="${wy(w) + 3}" text-anchor="end">${w} m</text>`);
  }
  y += wH + 10;

  // Air.
  label('air', y + 12, 'course, then mid');
  for (const l of c.leaps) out.push(`<rect class="leap" x="${n1(X(l.z))}" y="${y}" width="${n1((l.land1 - l.z) * SCALE.z)}" height="10"><title>${esc(`leap: lip ${l.z.toFixed(0)} m, cliff ${l.height.toFixed(1)} m, landing to ${l.land1.toFixed(0)} m`)}</title></rect>`);
  for (const k of c.kicks) out.push(`<line class="${k.online ? 'feat' : 'featL'}" x1="${n1(X(k.z))}" x2="${n1(X(k.z))}" y1="${k.online ? y : y + 4}" y2="${y + 10}"><title>${k.online ? 'kicker on the line' : 'kicker off the line'} at ${k.z.toFixed(0)} m</title></line>`);
  for (const l of c.ledges.filter((q) => q.kind !== 'leap')) out.push(`<rect class="end" x="${n1(X(l.z) - 1)}" y="${y + 2}" width="3" height="8"><title>${l.kind} at ${l.z.toFixed(0)} m, ${l.height.toFixed(1)} m</title></rect>`);
  y += 14;
  const rows = midFlights.get(c.id) ?? [];
  for (let r = 0; r < Math.max(6, rows.length); r++) {
    const row = rows[r];
    if (row) for (const f of row.flights) out.push(`<rect class="flight" x="${n1(X(f.z0))}" y="${y}" width="${n1(Math.max(1, (f.z1 - f.z0) * SCALE.z))}" height="3"><title>${esc(`mid pilot, seed ${row.seed}: ${f.s.toFixed(2)} s in the air, ${f.z0.toFixed(0)} to ${f.z1.toFixed(0)} m`)}</title></rect>`);
    y += 4.5;
  }
  y += 8;

  // Colliders: a tick each, a row a group.
  label('colliders', y + 10, 'a tick each');
  const groups: { name: string; cls: string; test: (g: string) => boolean }[] = [
    { name: 'tall: trees, spires, seracs, basalt', cls: 'tallS', test: (g) => g === 'tall' },
    { name: 'low: rocks, ice blocks, lava, lanterns', cls: 'lowS', test: (g) => g === 'low' },
    { name: 'logs, gate posts, snowmen', cls: 'otherS', test: (g) => g !== 'tall' && g !== 'low' },
  ];
  for (const g of groups) {
    let dd = '';
    for (const o of obs) if (g.test(groupOf(o))) dd += `M${n1(X((o.z + o.z2) / 2))},${n1(y)}v8`;
    out.push(`<path class="${g.cls}" stroke-width="1" d="${dd}"/>`);
    out.push(`<text class="t3" x="${n1(zEnd + 6)}" y="${n1(y + 7)}">${g.name}</text>`);
    y += 10;
  }
  y += 4;

  // Stage lines, the square and the finish over every track.
  for (const st of c.stages.slice(0, -1)) out.push(`<line class="stage" x1="${n1(X(st.z1))}" x2="${n1(X(st.z1))}" y1="${trackTop}" y2="${y}"/>`);
  out.push(`<line class="fin" x1="${n1(zEnd)}" x2="${n1(zEnd)}" y1="${trackTop}" y2="${y}"/>`);
  // The z axis.
  out.push(`<line class="axis" x1="${LEFT}" x2="${n1(X(zMax))}" y1="${y}" y2="${y}"/>`);
  for (let z = 0; z <= zMax; z += 500) out.push(`<text class="t3" x="${n1(X(z))}" y="${y + 12}" text-anchor="middle">${z} m</text>`);
  y += 22;
  return { svg: out.join('\n'), h: y - top };
}

/** The legend: what each mark is. */
function legend(top: number): { svg: string; h: number } {
  const o: string[] = [];
  let x = LEFT;
  const item = (mark: string, text: string, w: number): void => {
    o.push(`<g transform="translate(${x},${top})">${mark}<text class="t2" x="18" y="10">${esc(text)}</text></g>`);
    x += w;
  };
  item('<rect class="open" width="14" height="12"/>', 'open ground', 100);
  item('<rect class="place" width="14" height="12"/>', 'a place', 80);
  item('<rect class="leap" width="14" height="12"/>', 'a leap', 70);
  item('<rect class="end" width="14" height="12"/>', 'start, square; pitch rule', 150);
  item('<line class="stage" x1="7" x2="7" y1="0" y2="12"/>', 'stage line', 90);
  item('<circle class="tall" cx="7" cy="6" r="4"/>', 'tall collider', 100);
  item('<circle class="low" cx="7" cy="6" r="4"/>', 'low collider', 95);
  item('<circle class="other" cx="7" cy="6" r="4"/>', 'log, gate post, snowman', 170);
  item('<rect class="flight" y="4" width="14" height="4"/>', "mid pilot's flight", 130);
  item('<rect class="floor" width="14" height="12"/><path class="reach" d="M0,1H14M0,11H14"/>', 'corridor floor; turn-back', 180);
  return { svg: o.join('\n'), h: 22 };
}

function doc(w: number, h: number, body: string, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n1(w)}" height="${n1(h)}" viewBox="0 0 ${n1(w)} ${n1(h)}" role="img" aria-label="${esc(title)}">\n<title>${esc(title)}</title>\n${STYLE}\n<rect class="bg" width="100%" height="100%"/>\n${body}\n</svg>\n`;
}

mkdirSync(OUT, { recursive: true });
const all = MOUNTAINS.map((m) => {
  const c = courseFor(m.seed);
  const s = sample(c);
  return { facts: courseFacts(m, s), s };
});
const zMax = Math.max(SCALE.zMin, ...all.map((a) => a.facts.length));
const width = LEFT + zMax * SCALE.z + RIGHT + 200;

// One a mountain.
for (const a of all) {
  const lg = legend(10);
  const p = panel(a.facts, a.s, 10 + lg.h + 6, zMax);
  writeFileSync(join(OUT, `${a.facts.id}.svg`), doc(width, 10 + lg.h + 6 + p.h + 10, lg.svg + '\n' + p.svg, `${a.facts.name}: the course from the sim`));
}

// The sheet: the skeletons first (every mountain's sections and leaps in a row each), then every panel.
const parts: string[] = [];
let top = 10;
parts.push(`<text class="t1" x="${LEFT}" y="${top + 15}">Every mountain on one scale: the course from the sim (r9-profiles.ts)</text>`);
top += 26;
const lg = legend(top);
parts.push(lg.svg);
top += lg.h + 8;
parts.push(`<text class="t2" x="8" y="${top + 11}">skeletons</text>`);
const X = (z: number): number => LEFT + z * SCALE.z;
const skelTop = top;
for (const a of all) {
  const c = a.facts;
  parts.push(`<text class="t2" x="${LEFT - 6}" y="${top + 12}" text-anchor="end">${esc(c.name.split(' ')[0])}${FIVE.includes(c.id) ? '' : ' (new)'}</text>`);
  for (const sec of c.sections) {
    const fam = sec.gate ? 'open' : FAMILY[sec.kind];
    parts.push(`<rect class="${fam}" x="${n1(X(sec.z0))}" y="${top}" width="${n1(Math.max(0.5, (sec.z1 - sec.z0) * SCALE.z - 1))}" height="16"><title>${esc(`${c.name}: ${sec.kind}, ${sec.z0.toFixed(0)} to ${sec.z1.toFixed(0)} m`)}</title></rect>`);
    if ((sec.z1 - sec.z0) * SCALE.z > 30) parts.push(`<text class="${fam === 'end' ? 'tinv' : 'tin'}" x="${n1(X(sec.z0) + 3)}" y="${top + 11.5}">${SHORT[sec.kind]}${sec.gate ? '*' : ''}</text>`);
  }
  for (const l of c.leaps) parts.push(`<path d="M${n1(X(l.z))},${top - 2}l-4,-5h8z" fill="var(--ink)"><title>${esc(`leap lip ${l.z.toFixed(0)} m, ${l.height.toFixed(1)} m cliff`)}</title></path>`);
  for (const p of c.setPieces) parts.push(`<rect x="${n1(X(p.z0))}" y="${top + 17}" width="${n1((p.z1 - p.z0) * SCALE.z)}" height="3" fill="var(--ink2)"><title>${esc(`${p.key}: ${p.verb}`)}</title></rect>`);
  top += 30;
}
for (const z of [1450, 2950]) parts.push(`<line class="stage" x1="${n1(X(z))}" x2="${n1(X(z))}" y1="${skelTop - 8}" y2="${top - 6}"/>`);
parts.push(`<line class="fin" x1="${n1(X(4500))}" x2="${n1(X(4500))}" y1="${skelTop - 8}" y2="${top - 6}"/>`);
parts.push(`<text class="t3" x="${LEFT}" y="${top + 4}">Each row: the sections, a triangle at each leap's lip, a bar under each set piece. Dashed: 1,450 and 2,950 m; solid: 4,500 m.</text>`);
top += 20;
for (const a of all) {
  const p = panel(a.facts, a.s, top, zMax);
  parts.push(p.svg);
  top += p.h + 14;
}
writeFileSync(join(OUT, 'sheet.svg'), doc(width, top + 10, parts.join('\n'), 'Every mountain on one scale: the course from the sim'));
console.log(`wrote ${all.length} panels and the sheet to ${OUT}${midFlights.size ? '' : ' (no rides file: the flight rows are empty)'}`);
