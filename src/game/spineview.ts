import { MOUNTAINS } from '../sim/mountains';
import type { AlbumModel, AlmanacModel, ChapterView, ContractView, FlameView, LanternTownView, LeagueView, RankBarView, ResultsSpine, RewardCard, StickerCard, TitleSpine } from '../ui/contract';
import { ALMANAC, CHAPTER_PAGES, CHAPTER_PAGE_XP, PAGES, type Reward, chapterKey, chapterOf, chapterSet, featureOpen, hourOpen, legsOpen, mirrorOpen, pageAt, pagesOpened, rewardName, titlesEarned } from './almanac';
import { albumCatalogue, albumCompletion } from './album';
import { CONTRACT_XP, FORM_XP, contractText } from './contracts';
import { CALENDAR_GIFTS, CALENDAR_XP, flameNow } from './flame';
import type { PoolGhostData } from './ghostdata';
import { LANTERNS, LANTERN_TOWNS, ROW_LENGTH, litIn } from './lanterns';
import { leagueField, leagueNow } from './league';
import { missionDef, missionTier, swappable } from './missions';
import type { SpineOutcome } from './rank';
import type { SaveData } from './save';
import type { Contract } from './spinesave';
import { prevDay } from './settle';

// The spine's models for the screens (round 8): the results' part (the bar filling, what opened, the stickers, the
// flame, the contracts, the league, the one button), the title's (the bar, the flame and its calendar, contracts,
// the league, the chapter, the album's count, the one line of news), the Almanac's pages and the album's book. The
// screens lane draws these; nothing here touches the DOM.
//
// Pure: no DOM, render or audio imports.

function card(r: Reward, page: number, chapter: string | null = null, name: string = rewardName(r)): RewardCard {
  // (A mirror's card names its mountain's id too: its Almanac page rides it, the modes lane.)
  // (Round 9, the shop lane: a reward the save already held says what it gave instead, rank.ts grant.)
  return r.kind === 'mirror' ? { kind: r.kind, name, page, chapter, mountain: r.mountain } : { kind: r.kind, name, page, chapter };
}

/** The rank bar at an amount of XP. */
export function rankBar(xp: number, title: string | null = null): RankBarView {
  const at = pageAt(xp);
  return { page: at.page, of: PAGES, xp, into: at.into, need: at.need, next: at.page < PAGES ? ALMANAC[at.page].rewards.map((r) => card(r, at.page + 1)) : null, title };
}

function contractView(c: Contract, done: boolean, xp: number): ContractView {
  return { text: contractText(c), on: c.on, done, xp };
}

function todaysContracts(d: SaveData, day: string): ContractView[] {
  const c = d.contracts;
  if (!c || c.day !== day) return [];
  return c.list.map((k, i) => contractView(k, (c.done & (1 << i)) !== 0, CONTRACT_XP));
}

/** The results' spine part, from the settle's outcome and the save after it. */
export function resultsSpine(o: SpineOutcome, d: SaveData, day: string): ResultsSpine {
  const cat = new Map(albumCatalogue().map((s) => [s.id, s]));
  const runs = d.album?.runs ?? {};
  const stickers: StickerCard[] = o.stickers.map((id) => {
    const s = cat.get(id);
    const n = d.album?.got[id];
    return { id, name: s?.name ?? id, mountain: s?.mountain ?? '', group: s?.group ?? '', hint: s?.hint ?? '', frame: n !== undefined && runs[String(n)] !== undefined };
  });
  // (Never the mission the one button is asking you to finish.)
  const swapId = swappable(d.missions, day);
  const def = swapId ? missionDef(swapId) : undefined;
  const text = def ? missionTier(def, d.missions.active.find((a) => a.id === swapId)?.tier).text : '';
  const swap = swapId && !(o.primary.kind === 'mission' && o.primary.goal?.names.includes(text)) ? swapId : null;
  return {
    ticks: o.ticks.map((t) => ({ ...t })),
    before: rankBar(o.xpBefore, d.title ?? null),
    after: rankBar(o.xpAfter, d.title ?? null),
    opened: o.opened.map((x) => ({ ...card(x.reward, x.page, x.chapter ?? null, x.name), ...(x.from ? { from: x.from } : {}) })),
    stickers,
    flame: { lit: o.flame.lit, streak: o.flame.streak, calendarDay: o.flame.calendar, embered: o.flame.embered, emberEarned: o.flame.emberEarned },
    contracts: { met: o.contracts.met, bonus: o.contracts.bonus, form: o.contracts.form, today: todaysContracts(d, day), formNext: d.contracts?.form ? contractView(d.contracts.form, false, FORM_XP) : null },
    league: o.league ? { place: o.league.place, was: o.league.was, division: o.league.div } : null,
    primary: { kind: o.primary.kind, text: o.primary.text, sub: o.primary.sub, aria: o.primary.aria },
    swap: swap ? { id: swap, text } : null,
  };
}

export function flameView(d: SaveData, today: string): FlameView {
  const f = flameNow(d.flame, today);
  return { ...f, calendar: CALENDAR_XP.map((xp, i) => ({ day: i + 1, xp, gifts: i === 6 ? CALENDAR_GIFTS : 0, ember: i === 6 })) };
}

export function chapterView(d: SaveData, today: string): ChapterView | null {
  const key = chapterKey(today);
  const def = chapterOf(key);
  if (!def) return null;
  const ch = d.chapters?.[key] ?? { xp: 0, claimed: 0 };
  const page = Math.min(CHAPTER_PAGES, Math.floor(ch.xp / CHAPTER_PAGE_XP));
  const owned = (shelf: string, id: string): boolean => (shelf === 'scarf' ? d.scarves : shelf === 'trail' ? d.trails : d.paints)?.includes(id) ?? false;
  return {
    key,
    name: def.name,
    line: def.line,
    page,
    of: CHAPTER_PAGES,
    into: page >= CHAPTER_PAGES ? 0 : ch.xp - page * CHAPTER_PAGE_XP,
    need: page >= CHAPTER_PAGES ? 0 : (page + 1) * CHAPTER_PAGE_XP - ch.xp,
    set: chapterSet(def.month).map((e) => ({ id: e.id, shelf: e.shelf, name: e.name, price: e.price, owned: owned(e.shelf, e.id) })),
    older: Object.keys(d.chapters ?? {}).filter((k) => k !== key && (d.chapters![k].claimed ?? 0) < CHAPTER_PAGES).sort(),
  };
}

/** The league this week: the nineteen records of your division from the week's Cup pool, and you among them. */
export function leagueView(d: SaveData, week: string, pool: readonly PoolGhostData[] | null): LeagueView | null {
  if (!pool || !pool.length) return d.league ? { week, division: leagueNow(d.league, week).div, place: null, rows: [], last: null } : null;
  const l = leagueNow(d.league, week);
  const rows: LeagueView['rows'] = leagueField(pool, l.div).map((r) => ({ ...r }));
  if (l.best) rows.push({ name: d.name, time: l.best, you: true });
  rows.sort((a, b) => a.time - b.time);
  return { week, division: l.div, place: l.place ?? null, rows, last: l.last ? { division: l.last.div, place: l.last.place, moved: l.last.moved } : null };
}

/** The one line of what is new today, for a returning player: the first that applies. */
export function whatsNew(d: SaveData, today: string): string | null {
  const f = flameNow(d.flame, today);
  const ck = chapterKey(today);
  const ch = chapterOf(ck);
  if (d.flame && f.atRisk && d.flame.last !== prevDay(today)) return 'Your ember will keep your flame if you ride today.';
  if (ch && d.runs > 0 && !d.chapters?.[ck]) return `New this month: ${ch.name}. ${ch.line}.`;
  if (f.atRisk && f.streak >= 2) return `Day ${f.streak + 1} of your flame: ride today to keep it lit.`;
  if (featureOpen(d, 'contracts') && d.contracts?.day !== today) return 'Three new contracts today.';
  const moved = d.league?.last;
  if (moved && moved.moved !== 0) return moved.moved < 0 ? `Up to division ${moved.div - 1} of the Cup.` : `Down to division ${moved.div + 1} of the Cup: win it back.`;
  return null;
}

export function titleSpine(d: SaveData, today: string, o: { week: string; cupPool?: readonly PoolGhostData[] | null; open: (mountain: string) => boolean }): TitleSpine {
  const c = d.contracts;
  const legs = legsOpen(d);
  return {
    bar: rankBar(d.rank?.xp ?? 0, d.title ?? null),
    flame: flameView(d, today),
    contracts: featureOpen(d, 'contracts') ? todaysContracts(d, today) : [],
    form: c?.form ? contractView(c.form, false, FORM_XP) : null,
    league: leagueView(d, o.week, o.cupPool ?? null),
    chapter: chapterView(d, today),
    album: featureOpen(d, 'album') ? albumCompletion(d.album) : null,
    whatsNew: whatsNew(d, today),
    longNight: legs > 0 ? { legs, best: d.longNight ?? null } : null,
    mirrors: MOUNTAINS.filter((m) => mirrorOpen(d, m.id)).map((m) => m.id),
    hours: MOUNTAINS.filter((m) => hourOpen(d, m.id)).map((m) => m.id),
    titles: titlesEarned(d),
    lanterns: lanternRow(d, o.open),
  };
}

/** The Lantern Row, a town a mountain that is open: for the title, the garage's shelf and the world. */
export function lanternRow(d: SaveData, open: (mountain: string) => boolean): LanternTownView[] {
  return LANTERN_TOWNS.filter((t) => open(t.mountain)).map((t) => {
    const lit = litIn(d, t.mountain);
    const row = LANTERNS.filter((l) => l.mountain === t.mountain);
    const next = row[lit];
    return { mountain: t.mountain, town: t.town, lit, of: ROW_LENGTH, lanterns: row.map((l) => ({ id: l.id, index: l.index, price: l.price, lit: l.index < lit })), next: next ? { id: next.id, price: next.price, affordable: d.gifts >= next.price } : null };
  });
}

export function almanacModel(d: SaveData, today: string): AlmanacModel {
  const opened = pagesOpened(d);
  const turned = pageAt(d.rank?.xp ?? 0).page;
  return {
    bar: rankBar(d.rank?.xp ?? 0, d.title ?? null),
    pages: ALMANAC.map((p) => ({ n: p.n, state: p.n <= opened ? 'opened' : p.n <= turned ? 'turned' : p.n === turned + 1 ? 'next' : 'ahead', rewards: p.rewards.map((r) => card(r, p.n)) })),
    chapter: chapterView(d, today),
  };
}

export function albumModel(d: SaveData): AlbumModel {
  const got = d.album?.got ?? {};
  const runs = d.album?.runs ?? {};
  const all = albumCatalogue();
  const section = (id: string, name: string, list: typeof all): AlbumModel['sections'][number] => {
    const stickers = list.map((s) => ({ id: s.id, name: s.name, mountain: s.mountain, group: s.group, hint: s.hint, got: got[s.id] !== undefined, frame: got[s.id] !== undefined && runs[String(got[s.id])] !== undefined }));
    return { id, name, got: stickers.filter((s) => s.got).length, of: stickers.length, stickers };
  };
  const sections = MOUNTAINS.map((m) => section(m.id, m.name, all.filter((s) => s.mountain === m.id)));
  sections.push(section('tricks', 'Tricks', all.filter((s) => s.group === 'trick')));
  sections.push(section('twelve', 'The Twelve', all.filter((s) => s.group === 'duel')));
  sections.push(section('charms', 'Charms', all.filter((s) => s.group === 'charm' || s.group === 'synergy')));
  sections.push(section('night', 'The Long Night', all.filter((s) => s.group === 'night')));
  const c = albumCompletion(d.album);
  return { got: c.got, of: c.of, sections };
}
