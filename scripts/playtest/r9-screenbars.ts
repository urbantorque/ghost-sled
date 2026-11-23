// Round 9, the truth lane: the screen bars (prompts/round-9-clear-screens-a-garage-worth-it.md section 2, "The
// screens") read from the captures r9-truth.js makes. It merges the raw part files into one JSON per form factor
// (shots/r9/truth/desk.json, phone.json) with each shot's counts, then prints every bar with today's figures. It
// always exits 0: the bars fail today, and this prints by how much (the milestone's baseline).
//   npx tsx scripts/playtest/r9-screenbars.ts [--dir C:/.../shots/r9/truth] [--quiet]
// The detectors are exported for tests/r9screens.test.ts, which holds them to known cases.
//
// How words are counted: a chunk is the text of one text node a reader can see (r9-truth.js MEASURE: not
// display:none or visibility:hidden, not .gs-sr, no ancestor under 0.15 opacity, inside the viewport); a word is any
// whitespace-separated token in it with a letter or a digit, so "+1", "/212" and "0:20.9" are a word each and "·" is
// none. Text drawn by CSS (::before, ::after) and text in the canvas are not counted. On a sheet only the sheet's text
// counts (the title behind it is blurred and inert).
//
// The dev server's mock platform offers rewarded ads (src/platform/mock.ts: on in a dev build), so a capture there has
// Double Gifts, Watch Ad: Double Gifts and a revive that the published build, with no ads, never shows. They are left
// out of every count here (AD_OFFER), so the figures are the published build's.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One visible text node as r9-truth.js keeps it. */
export interface Chunk {
  t: string;
  box: number;
  top?: boolean;
  pop?: boolean;
  inert?: boolean;
  ctl?: boolean;
}
/** One control as r9-truth.js keeps it. */
export interface Control {
  name: string;
  text: string;
  aria?: string;
  fk?: string;
  primary: boolean;
  bg: string;
  iconOnly: boolean;
  top?: boolean;
  pop?: boolean;
  inert?: boolean;
  tabbable?: boolean;
}
export interface Shot {
  top?: string;
  pop?: string | null;
  chunks?: Chunk[];
  controls?: Control[];
}
export interface Figure {
  kind: string;
  text: string;
  box: string;
}
export interface Repeat {
  kind: string;
  what: string;
  n: number;
  boxes: string[];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(HERE, '../..');

/** The names a repeat is looked for by: the mountains, the Daily, and The Twelve (read from the source). */
export function knownNames(root = ROOT): string[] {
  const names = new Set<string>();
  for (const f of ['src/sim/mountains.ts', 'src/bot/roster.ts']) {
    const p = resolve(root, f);
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/name: '([^']+)'/g)) names.add(m[1]);
  }
  return [...names];
}

export const WORD = /[A-Za-z0-9]/;
export const words = (chunks: readonly Chunk[]): number => chunks.reduce((a, c) => a + c.t.split(/\s+/).filter((w) => WORD.test(w)).length, 0);

/** The chunks a reader reads on this shot: a sheet's own when one is open, else everything not made inert. */
export function readable(shot: Shot): Chunk[] {
  const ch = shot.chunks || [];
  const sheet = shot.top && !['title', 'results', 'none'].includes(shot.top);
  return ch.filter((c) => (sheet ? c.top : !c.inert) && !AD_OFFER.test(c.t));
}

/** A rewarded ad's offer, which only the dev server's mock platform makes. */
export const AD_OFFER = /^(Double Gifts|Watch Ad: Double Gifts|Watch Ad|Revive|Watch an ad.*)$/i;

const boxesOf = (chunks: readonly Chunk[]): { box: number; text: string; chunks: Chunk[] }[] => {
  const m = new Map<number, Chunk[]>();
  for (const c of chunks) m.set(c.box, [...(m.get(c.box) || []), c]);
  return [...m.values()].map((cs) => ({ box: cs[0].box, text: cs.map((c) => c.t).join(' '), chunks: cs }));
};
const hasWord = (s: string): boolean => /[A-Za-z]{2,}/.test(s);
/** What a signed figure may be counted in, said as the next chunk. */
const UNIT = /^(gifts?|XP|ghosts?|pages?|stickers?|stars?|medals?|runs?|m|s|seconds?|metres?|points?)\b/i;

/**
 * Figures without a word a new player understands. What it catches:
 *   delta     a signed figure ("+1", "A new sled +1") with no unit after it, in its chunk or as the next one in its box
 *   fraction  "14 /212", "/212", "3/5" in a box with no word but the fraction's
 *   page      "Page 5", "Chapter page 2" (a page of what, and why it matters)
 *   rank      "Rank 1 of 87" (reads as the race's place, not the ladder's)
 *   togo      "496 to go" with no unit
 *   bare      a chunk that is only a number, in a box with no word at all (the flame's "1", a lone count)
 * A figure labelled only by an icon (a gift box beside "670", the flame beside "5", the word kept for a screen reader)
 * is bare: the bar asks for a word. What it cannot catch: jargon that is a word ("XP"), a figure explained elsewhere on
 * the screen, and numbers drawn by CSS or the canvas.
 */
export function bareFigures(chunks: readonly Chunk[]): Figure[] {
  const out: Figure[] = [];
  for (const b of boxesOf(chunks)) {
    const cs = b.chunks;
    cs.forEach((c, i) => {
      const t = c.t;
      const next = cs[i + 1]?.t ?? '';
      // A signed figure ends its chunk ("+1", "A new sled +1"): it has its word only when the next chunk is its unit.
      if (/(^|\s)[+＋][\d,.]+$/.test(t) && !UNIT.test(next)) out.push({ kind: 'delta', text: t, box: b.text });
      else if (/(^|\s)[+＋][\d,.]+\s/.test(t) && !/[+＋][\d,.]+\s+[A-Za-z]{2,}/.test(t)) out.push({ kind: 'delta', text: t, box: b.text });
      if ((/^\/\s*\d/.test(t) || /\d\s*\/\s*\d/.test(t)) && !hasWord(b.text.replace(/[\d\s/,.]+/g, ' '))) out.push({ kind: 'fraction', text: t, box: b.text });
      if (/\bPage \d+\b/i.test(t)) out.push({ kind: 'page', text: t, box: b.text });
      if (/\bRank \d+ of \d+\b/.test(t)) out.push({ kind: 'rank', text: t, box: b.text });
      if (/\b\d[\d,]* to go\b/.test(t) && !/\d[\d,]* (XP|gifts?|ghosts?|m|s|runs?|pages?) to go/.test(t)) out.push({ kind: 'togo', text: t, box: b.text });
      else if (/^to go$/.test(t) && /^[\d,]+$/.test(cs[i - 1]?.t ?? '')) out.push({ kind: 'togo', text: `${cs[i - 1].t} to go`, box: b.text });
      // (A clock time, "1:53.0", says it is a time by its form, and is not counted bare.)
      if (/^[\d,.:]+$/.test(t) && !/^\d+:\d{2}(\.\d+)?$/.test(t) && !hasWord(b.text)) out.push({ kind: 'bare', text: t, box: b.text });
    });
  }
  return out;
}

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or', 'your', 'you', 'for', 'at', 'is', 'it', 'by', 'with', 'from', 'this', 'that', 'more', 'all', 'one']);
/** A list's field labels: a row of cards each saying "Best 1:48.1, Rank 5 of 87" is a list, not a message said twice. */
const LABELS = new Set(['best', 'rank', 'go', 'beat', 'page', 'week', 'day', 'days', 'stage', 'gold', 'silver', 'bronze', 'medal', 'medals', 'run', 'runs', 'xp', 'gifts', 's', 'm', 'new', 'locked', 'pass', 'ghost', 'ghosts']);

/**
 * Messages said twice on one screen. What it catches: a known name (a mountain, one of The Twelve) in two boxes; a
 * time ("2:09.6", "0:20.9") or a figure of three or more digits in two boxes; any three words in a row (not all small
 * words) in two boxes. What it cannot catch: the same thing said in other words ("Duel" on a button and a rider's
 * portrait on a card), said by an icon or a colour, or said once on a sheet and once on the screen under it.
 */
export function repeats(chunks: readonly Chunk[], names: readonly string[] = knownNames()): Repeat[] {
  const boxes = boxesOf(chunks);
  const out: Repeat[] = [];
  const lower = boxes.map((b) => b.text.toLowerCase());
  for (const n of names) {
    const re = new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const where = boxes.filter((_, i) => re.test(lower[i]));
    if (where.length >= 2) out.push({ kind: 'name', what: n, n: where.length, boxes: where.map((b) => b.text.slice(0, 80)) });
  }
  const figs = new Map<string, typeof boxes>();
  boxes.forEach((b) => {
    for (const m of new Set(b.text.match(/\b\d+:\d{2}(?:\.\d)?\b|\b\d{1,3}(?:,\d{3})+\b|\b\d{3,}\b/g) || [])) figs.set(m, [...(figs.get(m) || []), b]);
  });
  for (const [f, bs] of figs) if (bs.length >= 2) out.push({ kind: 'figure', what: f, n: bs.length, boxes: bs.map((b) => b.text.slice(0, 80)) });
  const sh = new Map<string, typeof boxes>();
  // (A figure is one token, '#': "1 more ghost" and "Pass 1 more ghost" share "# more ghost".)
  const wordsOf = boxes.map((_, i) => lower[i].replace(/\d[\d:.,]*/g, ' # ').replace(/[^a-z#' ]+/g, ' ').split(/\s+/).filter(Boolean));
  boxes.forEach((b, i) => {
    const ws = wordsOf[i];
    const seen = new Set();
    for (let k = 0; k + 3 <= ws.length; k++) {
      const g = ws.slice(k, k + 3);
      if (g.every((w) => STOP.has(w) || LABELS.has(w) || w === '#')) continue;
      // Words that are only a name and figures ("frostfang glacier #") are the name's repeat, counted above.
      const real = g.filter((w) => w !== '#');
      if (names.some((n) => real.every((w) => n.toLowerCase().split(/\s+/).includes(w)))) continue;
      const key = g.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      sh.set(key, [...(sh.get(key) || []), b]);
    }
  });
  // Overlapping runs of three in the same boxes are one phrase said twice: joined, and reported once.
  const groups = new Map<string, { grams: string[]; bs: typeof boxes }>();
  for (const [g, bs] of sh) {
    if (bs.length < 2) continue;
    const sig = bs.map((b) => b.box).join(',');
    const e = groups.get(sig) ?? { grams: [], bs };
    e.grams.push(g);
    groups.set(sig, e);
  }
  for (const { grams, bs } of groups.values()) {
    const ws = wordsOf[boxes.indexOf(bs[0])];
    const cover = new Array(ws.length).fill(false);
    for (const g of grams) {
      const p = g.split(' ');
      for (let k = 0; k + 3 <= ws.length; k++) if (ws[k] === p[0] && ws[k + 1] === p[1] && ws[k + 2] === p[2]) cover.fill(true, k, k + 3);
    }
    let run: string[] = [];
    for (let k = 0; k <= ws.length; k++) {
      if (k < ws.length && cover[k]) run.push(ws[k]);
      else if (run.length) {
        out.push({ kind: 'words', what: run.join(' '), n: bs.length, boxes: bs.map((b) => b.text.slice(0, 80)) });
        run = [];
      }
    }
  }
  return out;
}

/** Loading shown as content: a waiting word, or a short line that trails off in an ellipsis. */
export function loadingShown(chunks: readonly Chunk[]): string[] {
  return chunks.filter((c) => /finding rivals|loading|generating|please wait|connecting|searching/i.test(c.t) || (c.t.length < 30 && /…$|\.\.\.$/.test(c.t))).map((c) => c.t);
}

const rgb = (s: string): number[] | null => (s && /rgba?\(([^)]+)\)/.exec(s)?.[1].split(',').map((x) => Number(x.trim()))) || null;
/** Styled like the primary: the vermillion family (ART.md 1, the rider's colour) as a solid fill. */
export function vermillionFill(bg: string): boolean {
  const c = rgb(bg);
  if (!c || (c.length > 3 && c[3] < 0.6)) return false;
  const [r, g, b] = c;
  return r > 180 && g < 130 && b < 110 && r - g > 90;
}

/** One thing to press: the primaries, the controls styled like one, the lone icons, the controls with no name. */
export function pressables(shot: Shot): { controls: number; primaries: string[]; lookalikes: string[]; loneIcons: string[]; unnamed: number } {
  const sheet = shot.top && !['title', 'results', 'none'].includes(shot.top);
  const cs = (shot.controls || []).filter((c) => (sheet ? c.top : !c.inert) && !AD_OFFER.test(c.text) && !/Double Gifts|Watch Ad|Revive/i.test(c.name));
  const prim = cs.filter((c) => c.primary);
  const lookalike = cs.filter((c) => !c.primary && (vermillionFill(c.bg) || prim.some((p) => p.bg === c.bg && c.bg !== 'rgba(0, 0, 0, 0)')));
  return {
    controls: cs.length,
    primaries: prim.map((c) => c.name || c.text),
    lookalikes: lookalike.map((c) => c.name || c.text),
    loneIcons: cs.filter((c) => c.iconOnly).map((c) => c.name || '(no name)'),
    unnamed: cs.filter((c) => !c.name).length,
  };
}

/** Every count for one shot. */
export function shotFigures(shot: Shot, names: readonly string[]) {
  const ch = readable(shot);
  return {
    words: words(ch),
    popoverWords: shot.pop ? words(ch.filter((c) => c.pop)) : null,
    ...pressables(shot),
    bare: bareFigures(ch),
    repeats: repeats(ch, names),
    loading: loadingShown(ch),
  };
}

// ------------------------------------------------------------ the systems, for "nothing lost"

/** The systems the brief lists, each with the words that name it on a screen. */
export const SYSTEMS: Record<string, RegExp> = {
  'rank and Almanac': /Rider Rank|Almanac/i,
  album: /Spirit Album|sticker/i,
  flame: /flame/i,
  gifts: /\bgifts?\b/i,
  bests: /\bbest\b/i,
  'The Twelve': /The Twelve/i,
  // (Round 9: the title's door and its room say "Daily and Cup" and "This Week's Cup".)
  'the Cup': /Weekly Cup|Cup/i,
  'the league': /league|division/i,
  Trials: /\bTrial/i,
  'the Daily': /Daily Mountain|today's Daily|\bDaily\b/i,
  contracts: /contract/i,
  missions: /\bMissions?\b/i,
  medals: /\bMedals?\b/i,
  mastery: /mastery|\bstars?\b/i,
  'the Long Night': /Long Night/i,
  hours: /\b(dusk|dawn|night|hour|by day|blue hour|golden)\b/i,
  mirrors: /mirror/i,
  photo: /\bphoto/i,
  clips: /\bclip\b|Save Clip/i,
  'the garage': /Garage/i,
};

/** For each system: the fewest taps from the title that show it by pointer (0 named on the title, 1 behind one of
 *  its doors, 2 behind a tab of a door), and whether that door is in the Tab order, the pad's reach, and named. */
export function reach(crawl: Any): Record<string, { taps: number | null; via: string | null; keyboard: boolean | null; pad: boolean | null; named: boolean | null }> {
  const out: ReturnType<typeof reach> = {};
  if (!crawl) return out;
  const tabSet = new Set<string>(crawl.tab || []);
  const padSet = new Set<string>(crawl.pad?.reached || []);
  for (const [sys, re] of Object.entries(SYSTEMS)) {
    const onTitle = (crawl.title || []).filter((c: Any) => re.test(`${c.name} ${c.text}`));
    // Named by a control on the title, or shown in the title's own text (a control's name may only be heard).
    let taps = onTitle.length || re.test(crawl.titleText || '') ? 0 : null;
    let via: string | null = onTitle[0]?.name ?? (taps === 0 ? '(the title shows it)' : null);
    const doors: Any[] = (crawl.doors || []).filter((d: Any) => !d.skipped);
    const one = doors.find((d) => re.test(d.text || '') || (d.doors || []).some((x: string) => re.test(x)));
    if (taps === null && one) {
      taps = 1;
      via = one.from;
    }
    const two = doors.find((d) => (d.second || []).some((s: Any) => re.test(s.text)));
    if (taps === null && two) {
      taps = 2;
      via = `${two.from} > ${(two.second || []).find((s: Any) => re.test(s.text)).via}`;
    }
    const door = via ? via.split(' > ')[0] : null;
    const ctl = door ? (crawl.title || []).find((c: Any) => c.name === door) : null;
    // (By its focus key where it has one: a card's name changes as its rivals arrive.)
    const inList = (set: Set<string>): boolean => !!ctl && [...set].some((f) => (ctl.fk ? f.endsWith(`[${ctl.fk}]`) : f.startsWith(String(ctl.name).slice(0, 30))));
    out[sys] = { taps, via, keyboard: ctl ? !!ctl.tabbable && inList(tabSet) : null, pad: ctl ? inList(padSet) : null, named: ctl ? re.test(ctl.name) || taps === 0 : null };
  }
  return out;
}

// ------------------------------------------------------------ the merge and the bars

function main(): void {
  const argv = process.argv.slice(2);
  const opt = (k: string, d: string): string => (argv.indexOf(`--${k}`) >= 0 ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const DIR = opt('dir', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/truth');
  const names = knownNames();
  const raw = resolve(DIR, 'raw');
  if (!existsSync(raw)) {
    console.log(`no captures in ${raw}`);
    return;
  }
  const forms: Record<string, Any> = {};
  for (const f of readdirSync(raw).filter((x) => x.endsWith('.json')).sort()) {
    const form = f.split('-')[0];
    let j: Any;
    try {
      j = JSON.parse(readFileSync(resolve(raw, f), 'utf8'));
      if (typeof j === 'string') j = JSON.parse(j);
    } catch {
      console.log(`  (unreadable: ${f})`);
      continue;
    }
    const F = (forms[form] ??= { form, shots: {}, sheets: [], again: [], crawl: {}, errors: [], notes: [], parts: [] });
    F.parts.push(f);
    for (const [k, s] of Object.entries<Any>(j.shots || {})) F.shots[k] = { ...s, figures: shotFigures(s, names) };
    F.sheets.push(...(j.sheets || []));
    F.again.push(...(j.again || []));
    if (j.crawl) F.crawl[j.crawl.stage] = { ...j.crawl, reach: reach(j.crawl) };
    F.errors.push(...(j.errors || []).map((e: string) => `${f}: ${e}`));
    F.notes.push(...(j.notes || []).map((e: string) => `${f}: ${e}`));
    if (j.results) F.notes.push(`${f}: results ${JSON.stringify(j.results).slice(0, 300)}`);
  }
  for (const F of Object.values(forms)) writeFileSync(resolve(DIR, `${F.form}.json`), JSON.stringify(F, null, 1));
  if (argv.includes('--quiet')) return;
  // --md: the capture table for the notes, a row a shot: words, controls, primaries, lone icons, bare figures, repeats.
  if (argv.includes('--md')) {
    for (const F of Object.values(forms)) {
      console.log(`\n**${F.form}** (${Object.keys(F.shots).length} shots)\n`);
      console.log('| shot | words | controls | primaries | look-alikes | lone icons | bare figures | repeats | loading |');
      console.log('|---|---|---|---|---|---|---|---|---|');
      for (const [k, s] of Object.entries<Any>(F.shots)) {
        const f = s.figures;
        console.log(`| ${k} | ${f.words}${f.popoverWords !== null ? ` (${f.popoverWords} in the popover)` : ''} | ${f.controls} | ${f.primaries.length} | ${f.lookalikes.length} | ${f.loneIcons.length} | ${f.bare.length} | ${f.repeats.length} | ${f.loading.length} |`);
      }
    }
    return;
  }

  const fmtList = (xs: string[], n = 6): string => (xs.length ? xs.slice(0, n).join('; ') + (xs.length > n ? ` (+${xs.length - n})` : '') : '-');
  for (const F of Object.values(forms)) {
    const S: Record<string, Any> = F.shots;
    console.log(`\n=== ${F.form}: ${Object.keys(S).length} shots from ${F.parts.length} parts ===`);
    console.log(`\nWORDS (bars: the title at run 50 at most 40; the results' first view at most 35; a fresh title no worse than today)`);
    for (const [k, s] of Object.entries(S)) {
      // (Every shot; the bars only on theirs. Details is one level down: the 35 is the first view's.)
      const bar = /-50-title(-ready)?$/.test(k) ? 40 : /-results-/.test(k) && !k.endsWith('-details') ? 35 : null;
      console.log(`  ${k.padEnd(34)} ${String(s.figures.words).padStart(4)} words${bar ? `   bar ${bar}: ${s.figures.words <= bar ? 'MET' : `fails by ${s.figures.words - bar}`}` : ''}`);
    }
    console.log(`\nONE THING TO PRESS (bar: one primary a screen, nothing else styled like one, no lone icons)`);
    for (const [k, s] of Object.entries(S)) {
      const f = s.figures;
      const ok = f.primaries.length === 1 && !f.lookalikes.length && !f.loneIcons.length;
      console.log(`  ${k.padEnd(34)} primaries ${f.primaries.length}  look-alikes ${f.lookalikes.length}  lone icons ${f.loneIcons.length}  ${ok ? 'MET' : 'fails'}   ${f.lookalikes.length ? `alike: ${fmtList(f.lookalikes, 3)}  ` : ''}${f.loneIcons.length ? `icons: ${fmtList(f.loneIcons, 4)}` : ''}`);
    }
    console.log(`\nPLAIN FIGURES (bar: none without a word)`);
    for (const [k, s] of Object.entries(S)) if (s.figures.bare.length) console.log(`  ${k.padEnd(34)} ${String(s.figures.bare.length).padStart(3)}  ${fmtList(s.figures.bare.map((b: Figure) => `${b.kind} "${b.text}"`), 6)}`);
    console.log(`\nSAID ONCE, NEVER LOADING (bars: no message twice on a screen; no loading shown as content)`);
    for (const [k, s] of Object.entries(S)) {
      const r: Repeat[] = s.figures.repeats;
      if (r.length || s.figures.loading.length) console.log(`  ${k.padEnd(34)} repeats ${String(r.length).padStart(2)}  ${fmtList(r.map((x) => `${x.kind} "${x.what}" x${x.n}`), 5)}${s.figures.loading.length ? `   LOADING: ${fmtList(s.figures.loading, 2)}` : ''}`);
    }
    if (F.sheets.length) {
      console.log(`\nESCAPE AND THE PAD'S B (U4's bar: each closes every sheet and popover)`);
      for (const x of F.sheets as Any[]) console.log(`  ${`${x.stage} ${x.name}`.padEnd(24)} ${x.opened ? `${(x.surface || '').padEnd(18)} Escape ${x.escape?.closed ? 'closes ' : 'stays  '} (focus ${x.escape?.focus})   B ${x.padB?.closed ? 'closes ' : 'stays  '} (focus ${x.padB?.focus})` : `not opened ${x.note || ''}`}`);
    }
    for (const [st, cr] of Object.entries<Any>(F.crawl)) {
      console.log(`\nNOTHING LOST at ${st} (bar: every system in two taps from the title by pointer, keyboard and pad, and named)`);
      for (const [sys, r] of Object.entries<Any>(cr.reach)) console.log(`  ${sys.padEnd(18)} ${r.taps === null ? 'NOT FOUND in two taps' : `${r.taps} tap${r.taps === 1 ? '' : 's'}`.padEnd(22)} ${r.via ? `via "${r.via.slice(0, 60)}"` : ''}  ${r.keyboard === false ? 'keyboard NO ' : ''}${r.pad === false ? 'pad NO ' : ''}${r.named === false ? 'unnamed' : ''}`);
      console.log(`  Tab order: ${cr.tab.length} stops; pad reached ${cr.pad?.reached.length} of ${cr.title.length} title controls in ${cr.pad?.presses} presses`);
    }
    // (A run behind the dev server's mock midgame ad is the mock's wait, not the game's: the published build has no
    // ads. Older captures did not flag it; a press over 2 s with no flag is listed apart for a person to read.)
    const warm = (F.again as Any[]).filter((a) => a.warm && a.rideAt);
    if (warm.length) {
      const clean = warm.filter((a) => !a.ad);
      const xs: number[] = clean.map((a) => a.rideAt).sort((a: number, b: number) => a - b);
      const ads = warm.filter((a) => a.ad).map((a) => `${a.rideAt} ms`);
      console.log(`\nAS FAST AS TODAY (bar: Run Again to riding under 2 s): warm presses ${xs.join(', ')} ms; median ${xs[xs.length >> 1]} ms, worst ${xs[xs.length - 1]} ms${ads.length ? `; behind a mock ad (left out): ${ads.join(', ')}` : ''}`);
      for (const a of warm) if (a.button) console.log(`    press ${a.i}: ${a.rideAt} ms, the button said "${a.button}"${a.ad ? ' (a mock ad played)' : ''}`);
    }
    if (F.errors.length) console.log(`\nconsole errors: ${F.errors.length}\n  ${F.errors.slice(0, 8).join('\n  ')}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(HERE, 'r9-screenbars.ts')) main();
