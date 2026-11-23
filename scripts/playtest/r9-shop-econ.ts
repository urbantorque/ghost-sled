// Round 9, the shop lane: milestone 0's prototypes/r9/garage/economy.ts pointed at the game's real catalogue
// (r9-shop-catalogue.ts). Its "today" side reads the shelves as they now stand, so only the proposed side (the built
// garage) is this lane's table; milestone 0's today figures stand in notes/r9-garage.md.
// Round 9, the garage lane (milestone 0): the economy table, from the career harness's runs
// (scripts/playtest/r9-garage-economy.ts rides them and calls economyReport).
//
// Today's garage is read as the harness spent it (r8career.ts spendGifts: the cheapest piece on the shelves, again
// while the wallet holds, lanterns and the month's chapter set included). The proposed garage (catalogue.ts) is spent
// by a player's rule, written down so it can be argued with:
//   1. Fit the next tier of the sled you ride the moment it is open and you have the gifts; if it is open and you are
//      short, save for it.
//   2. Once your sled has its lamp (tier IV), the next sled in the shop is what you save for, and you ride it once
//      bought (its own track starts from nothing).
//   3. Otherwise the shelves take turns (hat, scarf, trail, finish, sound, then the month's set): the cheapest piece
//      you do not own on the shelf whose turn it is; save for it if it is dear.
//   4. A lantern only when nothing else is left to want.
// The same rule is also run over today's shelves, so the two garages are compared under one player.
//
// Pure: reads data, no DOM.

import { CHAPTERS, CHAPTER_PRICES, ITEMS, SETS, SET_SHARES, SLEDS, TRACK_LINES, type Buyable, proposedBuyables } from './r9-shop-catalogue';
import { SHELVES } from '../../src/game/garage';
import { PAINTS } from '../../src/game/paints';
import { SLEDS as SIM_SLEDS } from '../../src/sim/sleds';
import { LANTERN_TOWNS, ROW_LENGTH, lanternPrice } from '../../src/game/lanterns';
import { CHAPTER_PAGES, CHAPTER_PAGE_XP, GARAGE_EXTRAS, chapterSet } from '../../src/game/almanac';

/** The shape r9-garage-economy.ts writes (EconCareer there). */
interface Run {
  n: number;
  day: string;
  key: string;
  mountain: string;
  finished: boolean;
  stages: number;
  life: number;
  wallet: number;
  bought: number;
  boughtNow: string[];
  wanted: { pieces: number; gifts: number };
  claimed: number;
  xp: number;
  stars: Record<string, number>;
  open: string[];
  twelve: number;
}
interface Career {
  pilot: string;
  runs: Run[];
  boards: Record<string, number>;
}

export const CHECKPOINTS = [1, 5, 20, 50, 100] as const;
/** "One to three runs away": a piece whose gifts still owed are at most this many runs of the pilot's recent income. */
const AWAY_RUNS = 3;
const RATE_RUNS = 10;

export interface Snapshot {
  run: number;
  life: number;
  wallet: number;
  /** Pieces owned by shelf (the free ones not counted), and sled tiers fitted. */
  owned: Record<string, number>;
  tiers: number;
  sled: string;
  /** Pieces within one to three runs (gifts still owed, or a tier's lines still to ride), by name. */
  near: string[];
  /** What the player is saving for. */
  saving: string | null;
  /** Garage goals left that are not lanterns (pieces to buy or earn), and gifts they cost. */
  goalsLeft: number;
  goalsGifts: number;
  lanternsLit: number;
}

export interface PilotTable {
  pilot: string;
  garage: 'today' | 'proposed';
  rule: 'harness' | 'player';
  rows: Snapshot[];
  /** Runs (of the 100) after which nothing but a lantern was within three runs. */
  dry: number[];
  /** The run the base garage (every shop piece that is not a lantern or a chapter piece) was all owned, or null. */
  buyout: number | null;
  /** When the dearest goals landed: the Tea Tray's last tier, and every sled's track. */
  dearest: { what: string; run: number | null; day: string | null }[];
}

// ---------------------------------------------------------------- the two catalogues as buyables

function todayBuyables(): Buyable[] {
  const out: Buyable[] = [];
  for (const s of SIM_SLEDS) if (s.price > 0) out.push({ id: `sled:${s.id}`, shelf: 'sled', price: s.price });
  for (const [shelf, items] of Object.entries(SHELVES)) for (const it of items) if (it.price > 0) out.push({ id: `${shelf}:${it.id}`, shelf: shelf as Buyable['shelf'], price: it.price });
  for (const p of PAINTS) if (p.price > 0) out.push({ id: `paint:${p.id}`, shelf: 'finish', price: p.price });
  for (let month = 1; month <= 12; month++) {
    for (const e of chapterSet(month)) out.push({ id: `${e.shelf}:${e.id}`, shelf: e.shelf === 'paint' ? 'finish' : e.shelf, price: e.price, month });
  }
  return out;
}

const lanternBuyables = (): (Buyable & { mountain: string; index: number })[] =>
  LANTERN_TOWNS.flatMap((t) => Array.from({ length: ROW_LENGTH }, (_, i) => ({ id: `lantern:${t.mountain}:${i}`, shelf: 'lantern' as const, price: lanternPrice(i), mountain: t.mountain, index: i })));

/** Months a day's shelf sells (almanac.ts shelfExtras: every chapter from 2026-12 to the day, a year at most). */
function monthsOnSale(day: string): Set<number> {
  const out = new Set<number>();
  let [y, m] = [2026, 12];
  const [ny, nm] = day.split('-').map(Number);
  while (y < ny || (y === ny && m <= nm)) {
    out.add(m);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- the month's chapter, as rank.ts settles it

/** Follows a chapter's experience from a run (this month's, then the oldest unfinished, from a save's second run) and
 *  returns the pieces its pages open now: 'scarf' (page 3), 'trail' (page 6) and the third piece (page 8). */
function chapterPieces(chapters: Record<string, { xp: number; claimed: number }>, r: Run): { month: number; piece: 'scarf' | 'trail' | 'third' }[] {
  const out: { month: number; piece: 'scarf' | 'trail' | 'third' }[] = [];
  if (r.n < 2) return out;
  const key = r.day.slice(0, 7);
  chapters[key] ??= { xp: 0, claimed: 0 };
  let at = key;
  if (chapters[key].claimed >= CHAPTER_PAGES) at = Object.keys(chapters).filter((k) => chapters[k].claimed < CHAPTER_PAGES).sort()[0] ?? key;
  const ch = chapters[at];
  ch.xp += r.xp;
  const to = Math.min(CHAPTER_PAGES, Math.floor(ch.xp / CHAPTER_PAGE_XP));
  const month = Number(at.slice(5, 7));
  for (let p = ch.claimed + 1; p <= to; p++) {
    if (p === 3) out.push({ month, piece: 'scarf' });
    if (p === 6) out.push({ month, piece: 'trail' });
    if (p === 8) out.push({ month, piece: 'third' });
  }
  ch.claimed = Math.max(ch.claimed, to);
  return out;
}

// ---------------------------------------------------------------- the player's rule

interface State {
  wallet: number;
  owned: Set<string>;
  sled: string;
  lines: Record<string, number>;
  turn: number;
  chapters: Record<string, { xp: number; claimed: number }>;
  saving: string | null;
}

const ROTATION = ['hat', 'scarf', 'trail', 'finish', 'sound', 'chapter'] as const;
const NAME = new Map<string, string>([
  ...ITEMS.map((it) => [`${it.shelf}:${it.id}`, it.name] as [string, string]),
  ...SLEDS.map((s) => [`sled:${s.id}`, s.name] as [string, string]),
  ...SIM_SLEDS.map((s) => [`sled:${s.id}`, s.name] as [string, string]),
  ...Object.entries(SHELVES).flatMap(([shelf, items]) => items.map((it) => [`${shelf}:${it.id}`, it.name] as [string, string])),
  ...PAINTS.map((p) => [`paint:${p.id}`, `${p.name} paint`] as [string, string]),
]);
function nameOf(id: string): string {
  const t = /^track:(\w+):(\d)$/.exec(id);
  if (t) return `${SLEDS.find((s) => s.id === t[1])?.name ?? t[1]} tier ${'I II III IV V'.split(' ')[+t[2]]}`;
  const ch = /^chapter:(\d+):(\w+)$/.exec(id);
  if (ch) return `${CHAPTERS[+ch[1] - 1].name} ${ch[2]}`;
  const l = /^lantern:(\w+):(\d)$/.exec(id);
  if (l) return `${l[1]} lantern ${+l[2] + 1}`;
  const sc = /^(scarf|trail|paint):(ch\d+\w+)$/.exec(id);
  if (sc) return `chapter ${sc[2]}`;
  return NAME.get(id) ?? id;
}

/** Spends a career with the player's rule over a catalogue. `proposed`: the proposed garage (tracks, sets, the
 *  Almanac's pieces never sold, chapter pages paying back a piece bought first); else today's shelves. */
function playerSpend(c: Career, proposed: boolean): PilotTable {
  const buy = proposed ? proposedBuyables() : todayBuyables();
  const lanterns = lanternBuyables();
  const s: State = { wallet: 0, owned: new Set(), sled: 'flyer', lines: {}, turn: 0, chapters: {}, saving: null };
  const rows: Snapshot[] = [];
  const dry: number[] = [];
  let buyout: number | null = null;
  const landed: Record<string, Run | null> = {};
  const incomes: number[] = [];
  const linesPerRun: number[] = [];
  let prevLife = 0;
  const sledOrder = proposed ? SLEDS.filter((x) => x.source.kind === 'shop').map((x) => x.id) : SIM_SLEDS.filter((x) => x.price > 0).map((x) => String(x.id));
  const base = buy.filter((b) => b.month === undefined && b.shelf !== 'track');

  for (const r of c.runs) {
    const income = r.life - prevLife;
    prevLife = r.life;
    incomes.push(income);
    linesPerRun.push(r.stages);
    s.wallet += income;
    s.lines[s.sled] = (s.lines[s.sled] ?? 0) + r.stages;
    // What the run grants: the Almanac's pieces, a mountain's set, the month's chapter.
    if (r.claimed >= 5) s.owned.add(proposed ? 'sled:whirl' : 'sled:1');
    for (const it of proposed ? ITEMS : []) if (it.source.kind === 'almanac' && r.claimed >= it.source.page) s.owned.add(`${it.shelf}:${it.id}`);
    if (!proposed) for (const e of GARAGE_EXTRAS) if (e.page && r.claimed >= e.page) s.owned.add(`${e.shelf}:${e.id}`);
    if (proposed)
      for (const set of SETS)
        SET_SHARES.forEach((share, k) => {
          if ((r.stars[set.mountain] ?? 0) >= Math.ceil(share * c.boards[set.mountain])) s.owned.add(`set:${set.mountain}:${k}`);
        });
    for (const { month: m, piece: p } of chapterPieces(s.chapters, r)) {
      const piece = p === 'third' ? (proposed ? 'ornament' : 'paint') : p;
      const id = proposed ? `chapter:${m}:${piece}` : `${piece}:ch${m}${piece}`;
      // (Proposed: a page whose piece you bought pays its price back, so no page is empty.)
      if (s.owned.has(id) && proposed) s.wallet += CHAPTER_PRICES[piece as 'scarf' | 'trail' | 'ornament'];
      s.owned.add(id);
    }

    // The spend.
    const onSale = monthsOnSale(r.day);
    const avail = (b: Buyable): boolean => !s.owned.has(b.id) && (b.month === undefined || onSale.has(b.month)) && (!b.track || (b.track.sled === s.sled && (s.owned.has(`sled:${s.sled}`) || s.sled === 'flyer')));
    const ready = (b: Buyable): boolean => !b.track || ((s.lines[b.track.sled] ?? 0) >= b.track.lines && (b.track.tier === 0 || s.owned.has(`track:${b.track.sled}:${b.track.tier - 1}`)));
    const openLantern = lanterns.filter((l) => r.open.includes(l.mountain) && !s.owned.has(l.id) && (l.index === 0 || s.owned.has(`lantern:${l.mountain}:${l.index - 1}`)));
    for (let guard = 0; guard < 200; guard++) {
      const tier = buy.filter((b) => b.track && avail(b)).sort((a, b) => a.track!.tier - b.track!.tier)[0];
      let target: Buyable | undefined;
      if (tier && ready(tier)) target = tier;
      else {
        const lamp = proposed ? s.owned.has(`track:${s.sled}:3`) : true;
        const nextSled = sledOrder.map((id) => buy.find((b) => b.id === `sled:${id}`)!).find((b) => b && avail(b));
        if (lamp && nextSled && !(tier && !ready(tier) && (s.lines[s.sled] ?? 0) + 9 >= tier.track!.lines)) target = nextSled;
        else {
          for (let k = 0; k < ROTATION.length && !target; k++) {
            const shelf = ROTATION[(s.turn + k) % ROTATION.length];
            const pool = buy.filter((b) => avail(b) && !b.track && b.shelf !== 'sled' && (shelf === 'chapter' ? b.month !== undefined : b.month === undefined && b.shelf === shelf));
            target = pool.sort((a, b) => a.price - b.price)[0];
          }
          if (!target) target = openLantern.sort((a, b) => a.price - b.price)[0];
        }
      }
      if (!target) {
        s.saving = null;
        break;
      }
      s.saving = target.id;
      if (target.price > s.wallet) break;
      s.wallet -= target.price;
      s.owned.add(target.id);
      if (target.shelf === 'sled') {
        s.sled = proposed ? target.id.slice(5) : target.id.slice(5);
      }
      if (!target.track && target.shelf !== 'sled' && target.shelf !== 'lantern') s.turn++;
      if (target.shelf === 'lantern') openLantern.splice(openLantern.indexOf(target as never), 1);
    }
    if (buyout === null && base.every((b) => s.owned.has(b.id))) buyout = r.n;
    if (proposed) for (const sl of SLEDS) for (let t = 0; t < 5; t++) if (s.owned.has(`track:${sl.id}:${t}`) && landed[`track:${sl.id}:${t}`] === undefined) landed[`track:${sl.id}:${t}`] = r;

    // One to three runs away: gifts still owed (or a tier's lines still to ride) within three runs of recent form.
    const rate = mean(incomes.slice(-RATE_RUNS));
    const lpr = Math.max(1, mean(linesPerRun.slice(-RATE_RUNS)));
    const near: string[] = [];
    for (const b of buy) {
      if (!avail(b)) continue;
      const owe = Math.max(0, b.price - s.wallet);
      const ride = b.track ? Math.max(0, b.track.lines - (s.lines[b.track.sled] ?? 0)) / lpr : 0;
      if (b.track && b.track.tier > 0 && !s.owned.has(`track:${b.track.sled}:${b.track.tier - 1}`)) continue;
      if (Math.max(owe / Math.max(1, rate), ride) <= AWAY_RUNS) near.push(nameOf(b.id));
    }
    if (proposed)
      for (const set of SETS)
        SET_SHARES.forEach((share, k) => {
          const need = Math.ceil(share * c.boards[set.mountain]) - (r.stars[set.mountain] ?? 0);
          if (!s.owned.has(`set:${set.mountain}:${k}`) && need > 0 && need <= 2 && r.open.includes(set.mountain)) near.push(`${[set.scarf, set.trail, set.ornament][k].name} (${need} ${need === 1 ? 'star' : 'stars'} on ${set.mountain})`);
        });
    if (!near.length) dry.push(r.n);
    const goals = buy.filter((b) => !s.owned.has(b.id) && (b.month === undefined || onSale.has(b.month)) && (!b.track || s.owned.has(`sled:${b.track.sled}`) || b.track.sled === 'flyer'));
    const setLeft = proposed ? SETS.length * 3 - [...s.owned].filter((x) => x.startsWith('set:')).length : 0;
    if (CHECKPOINTS.includes(r.n as (typeof CHECKPOINTS)[number])) {
      const owned: Record<string, number> = {};
      for (const id of s.owned) {
        const shelf = id.startsWith('chapter:') ? 'chapter' : id.startsWith('set:') ? 'set' : id.split(':')[0];
        owned[shelf] = (owned[shelf] ?? 0) + 1;
      }
      rows.push({
        run: r.n,
        life: r.life,
        wallet: s.wallet,
        owned,
        tiers: [...s.owned].filter((x) => x.startsWith('track:')).length,
        sled: proposed ? (SLEDS.find((x) => x.id === s.sled)?.name ?? s.sled) : 'Pine Flyer',
        near: near.slice(0, 8),
        saving: s.saving ? nameOf(s.saving) : null,
        goalsLeft: goals.length + setLeft,
        goalsGifts: goals.reduce((a, b) => a + b.price, 0),
        lanternsLit: [...s.owned].filter((x) => x.startsWith('lantern:')).length,
      });
    }
  }
  const dearest: PilotTable['dearest'] = [];
  if (proposed) {
    for (const sl of SLEDS) {
      const r = landed[`track:${sl.id}:4`] ?? null;
      dearest.push({ what: `${sl.name}: all five tiers`, run: r?.n ?? null, day: r?.day ?? null });
    }
  }
  return { pilot: c.pilot, garage: proposed ? 'proposed' : 'today', rule: 'player', rows, dry, buyout, dearest };
}

/** Today's garage as the harness spent it (its own record of each run). */
function harnessToday(c: Career): PilotTable {
  const buy = todayBuyables();
  const owned = new Set<string>();
  const rows: Snapshot[] = [];
  const dry: number[] = [];
  let buyout: number | null = null;
  const incomes: number[] = [];
  let prev = 0;
  const base = buy.filter((b) => b.month === undefined);
  const chapters: Record<string, { xp: number; claimed: number }> = {};
  for (const r of c.runs) {
    for (const { month, piece } of chapterPieces(chapters, r)) {
      const p = piece === 'third' ? 'paint' : piece;
      owned.add(`${p}:ch${month}${p}`);
    }
    incomes.push(r.life - prev);
    prev = r.life;
    for (const id of r.boughtNow) owned.add(id);
    if (r.claimed >= 5) owned.add('sled:1');
    for (const e of GARAGE_EXTRAS) if (e.page && r.claimed >= e.page) owned.add(`${e.shelf}:${e.id}`);
    if (buyout === null && base.every((b) => owned.has(b.id))) buyout = r.n;
    const onSale = monthsOnSale(r.day);
    const rate = mean(incomes.slice(-RATE_RUNS));
    const left = buy.filter((b) => !owned.has(b.id) && (b.month === undefined || onSale.has(b.month)));
    const near = left.filter((b) => Math.max(0, b.price - r.wallet) / Math.max(1, rate) <= AWAY_RUNS).map((b) => nameOf(b.id));
    if (!near.length) dry.push(r.n);
    if (CHECKPOINTS.includes(r.n as (typeof CHECKPOINTS)[number])) {
      const by: Record<string, number> = {};
      for (const id of owned) {
        const shelf = /:ch\d/.test(id) ? 'chapter' : id.split(':')[0];
        by[shelf] = (by[shelf] ?? 0) + 1;
      }
      rows.push({
        run: r.n,
        life: r.life,
        wallet: r.wallet,
        owned: by,
        tiers: 0,
        sled: 'Pine Flyer',
        near: near.slice(0, 8),
        saving: left.sort((a, b) => a.price - b.price)[0] ? nameOf(left[0].id) : null,
        goalsLeft: left.length,
        goalsGifts: left.reduce((a, b) => a + b.price, 0),
        lanternsLit: [...owned].filter((x) => x.startsWith('lantern:')).length,
      });
    }
  }
  return { pilot: c.pilot, garage: 'today', rule: 'harness', rows, dry, buyout, dearest: [] };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// ---------------------------------------------------------------- the report

export interface EconomyData {
  tables: PilotTable[];
  /** Lifetime gifts by run, each pilot (the income every table spends). */
  income: Record<string, number[]>;
  /** When lifetime gifts first cover the base garage (6,270 today). */
  baseCost: { today: number; proposed: number };
  coversBase: Record<string, { today: number | null; proposed: number | null }>;
  /** The Whirl Saucer bought before Almanac page 5 (rank.ts 207: the page then gives nothing). */
  whirlBoughtFirst: Record<string, number | null>;
  proposedTotals: Record<string, number>;
}

export function economyReport(careers: Career[]): { text: string; data: EconomyData } {
  const tables: PilotTable[] = [];
  const income: Record<string, number[]> = {};
  const coversBase: EconomyData['coversBase'] = {};
  const whirlBoughtFirst: EconomyData['whirlBoughtFirst'] = {};
  const todayBase = todayBuyables().filter((b) => b.month === undefined).reduce((a, b) => a + b.price, 0);
  const propBase = proposedBuyables().filter((b) => b.month === undefined && b.shelf !== 'track').reduce((a, b) => a + b.price, 0);
  const totals: Record<string, number> = {};
  for (const b of proposedBuyables()) totals[b.month !== undefined ? 'chapter' : b.shelf] = (totals[b.month !== undefined ? 'chapter' : b.shelf] ?? 0) + b.price;
  totals.lantern = lanternBuyables().reduce((a, b) => a + b.price, 0);
  for (const c of careers) {
    income[c.pilot] = c.runs.map((r) => r.life);
    coversBase[c.pilot] = { today: c.runs.find((r) => r.life >= todayBase)?.n ?? null, proposed: c.runs.find((r) => r.life >= propBase)?.n ?? null };
    const w = c.runs.find((r) => r.boughtNow.includes('sled:1'));
    const p5 = c.runs.find((r) => r.claimed >= 5);
    whirlBoughtFirst[c.pilot] = w && (!p5 || w.n < p5.n) ? w.n : null;
    tables.push(harnessToday(c), playerSpend(c, false), playerSpend(c, true));
  }
  const L: string[] = [];
  L.push(`Base garage: today ${todayBase} gifts (sleds, the four shelves, paints); proposed shop ${propBase} (no tracks, sets, chapters or lanterns).`);
  L.push(`Proposed gift sinks by shelf: ${Object.entries(totals).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  for (const c of careers) {
    L.push(`${c.pilot}: lifetime gifts ${CHECKPOINTS.map((n) => `${n}:${c.runs[n - 1]?.life}`).join('  ')}; lifetime covers today's base garage at run ${coversBase[c.pilot].today}, the proposed shop at ${coversBase[c.pilot].proposed ?? 'never (100)'}; Whirl Saucer bought before page 5: ${whirlBoughtFirst[c.pilot] ? `run ${whirlBoughtFirst[c.pilot]} (page 5 then gives nothing)` : 'no'}`);
  }
  for (const t of tables) {
    L.push('');
    L.push(`${t.pilot.toUpperCase()}  ${t.garage} garage, ${t.rule === 'harness' ? "the harness's cheapest-first spender" : "the player's rule"}: base garage owned at run ${t.buyout ?? 'never'}; runs with nothing but a lantern within three runs: ${t.dry.length}${t.dry.length ? ` (${compress(t.dry)})` : ''}`);
    for (const row of t.rows) {
      const own = Object.entries(row.owned).map(([k, v]) => `${k} ${v}`).join(', ');
      L.push(`  run ${String(row.run).padStart(3)}  earned ${String(row.life).padStart(6)}  wallet ${String(row.wallet).padStart(5)}  owns: ${own || '-'}${row.tiers ? `; riding the ${row.sled}` : ''}`);
      L.push(`           within 1-3 runs: ${row.near.join('; ') || '-'}`);
      L.push(`           saving for: ${row.saving ?? '-'}   goals left that are not lanterns: ${row.goalsLeft} (${row.goalsGifts} gifts)   lanterns lit: ${row.lanternsLit}`);
    }
    if (t.dearest.length) L.push(`  the dearest: ${t.dearest.map((d) => `${d.what} ${d.run ? `run ${d.run} (${d.day})` : 'not by run 100'}`).join('; ')}`);
  }
  return { text: L.join('\n'), data: { tables, income, baseCost: { today: todayBase, proposed: propBase }, coversBase, whirlBoughtFirst, proposedTotals: totals } };
}

function compress(xs: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < xs.length; ) {
    let j = i;
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
    out.push(i === j ? `${xs[i]}` : `${xs[i]}-${xs[j]}`);
    i = j + 1;
  }
  return out.join(' ');
}

/** The proposed track's lines, for the page. */
export const LINES = TRACK_LINES;
