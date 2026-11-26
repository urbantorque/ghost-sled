import type { AlbumModel, AlmanacModel, ChapterView, StickerCard } from './contract';
import { biomeArt, mountainBiome } from './art';
import { h, type Ctx } from './dom';
import { fmt, NBSP } from './fmt';
import { type IconName } from './icons';
import { b9, ico9 } from './kit9';
import { rewardGlyph, type RideMode } from './almanac';
import { curly, prize, prizesLine } from './words';
import { pickerOrder } from './title';
import { MOUNTAINS } from '../sim/mountains';
import './books.css';

// Round 9 (U4): the two books, in the round's language and loaded on demand (menus.ts imports this module when the
// Progress room first opens one, so none of it is in the first download). Each is a sheet from the logo's side (the
// bottom on a phone) over the room, with Back.
//   The Almanac: this month's chapter, then the fifty Rider Ranks in rows of ten, each rank one row with its prizes in
//     words: the ranks reached checked, the next outlined with the XP it still needs, the ranks ahead dimmed. It opens
//     at the next. A rank that opened a way to ride (a mirror, the Long Night, the Trials) has Ride on its row.
//   The Spirit Album: its contents first, a row a page (each mountain's in its sky, then Tricks, The Twelve, Charms and
//     the Long Night), each with how many are found; a page opens over it: the stickers found, each a frame from its
//     run or painted in its mountain's sky, then the ones still to find, each with where to find it.
// Pure builders: no state; the sheet, its focus and its Back are menus.ts's.

/** The ranks shown together, as a section with its own heading. */
const RANKS_A_ROW = 10;

/** A page's ride, when the ranks it opened let you ride something from here (only off the title's room). */
function rideOn(m: AlmanacModel, rewards: AlmanacModel['pages'][number]['rewards'], ctx: Ctx, ride: (mode: RideMode) => void): HTMLElement | null {
  const modes = m.modes;
  if (!modes) return null;
  const mirror = rewards.find((r) => r.kind === 'mirror' && r.mountain && modes.mirrors.includes(r.mountain));
  const night = modes.night && rewards.some((r) => r.kind === 'legs') ? modes.night : null;
  // (The trials lane: the page that opens Trials rides this week's.)
  const trial = modes.trial && rewards.some((r) => r.kind === 'feature' && r.name === 'Trials') ? modes.trial : null;
  if (mirror?.mountain) {
    const id = mirror.mountain;
    return b9(ctx, 'secondary', 'Ride', { icon: 'play', fk: `ride-mirror-${id}`, sound: 'confirm', aria: `Ride ${mirror.name.replace(/^Mirror /, '')} mirrored`, cls: 'gs9-b-s', onClick: () => ride({ kind: 'mirror', mountain: id }) });
  }
  if (night) return b9(ctx, 'secondary', 'Ride', { icon: 'play', fk: 'ride-night', sound: 'confirm', aria: `Ride the Long Night, ${night.legs} legs${night.best ? `. Your deepest: ${night.best}` : ''}`, cls: 'gs9-b-s', onClick: () => ride({ kind: 'night' }) });
  if (trial) return b9(ctx, 'secondary', 'Ride', { icon: 'play', fk: 'ride-trial', sound: 'confirm', aria: `Ride this week's Trial: ${trial.name}. ${trial.rule}`, cls: 'gs9-b-s', onClick: () => ride({ kind: 'trial' }) });
  return null;
}

/** This month's chapter: its name and line, how far it is, and its set (the garage's shelf shows the set too). */
function chapterBlock(c: ChapterView): HTMLElement {
  const done = c.page >= c.of;
  const line = `${curly(c.line)}. ${done ? `All ${c.of} of its pages turned.` : `${c.page} of its ${c.of} pages turned, ${fmt(c.need)}${NBSP}XP to the next.`}`;
  const name = h('span', '', c.name);
  name.setAttribute('translate', 'no');
  const head = h('h3', 'gs9-block-h', 'This Month: ', name);
  const set = c.set.length > 0 ? h('ul', 'gs9-bk-set', ...c.set.map((s) => h('li', `gs9-tag${s.owned ? ' is-held' : ''}`, s.owned ? ico9('check') : null, h('span', '', s.name)))) : null;
  set?.setAttribute('aria-label', 'Its set');
  const box = h('section', 'gs9-bk-ch', head, h('p', 'gs9-block-p', line), set);
  box.setAttribute('aria-label', `This month's chapter: ${c.name}`);
  return box;
}

/** The Almanac's body: the chapter, then the fifty ranks in sections of ten. `ride` takes an opened rank's mode. */
export function almanacBody(m: AlmanacModel, ctx: Ctx, ride?: (mode: RideMode) => void): HTMLElement {
  const out = h('div', 'gs9-bk gs9-bk-almanac');
  if (m.chapter) out.append(chapterBlock(m.chapter));
  for (let r = 0; r < m.pages.length; r += RANKS_A_ROW) {
    const rows = m.pages.slice(r, r + RANKS_A_ROW);
    const list = h('ol', 'gs9-list gs9-bk-ranks');
    for (const p of rows) {
      const glyph: IconName = rewardGlyph(p.rewards[0]?.kind ?? 'charm', p.rewards[0]);
      const n = h('span', 'gs9-bk-n', 'Rank', NBSP, h('span', 'gs9-num', String(p.n)));
      // (A rank's prizes a line each: "Sakura Ridge, mirrored and the title Petal Chaser" read as one thing.)
      const prizes = h('span', 'gs9-bk-p', ...p.rewards.map((r) => h('span', '', curly(prize(r)))));
      let v: HTMLElement | null = null;
      if (p.state === 'opened') v = h('span', 'gs9-check', ico9('check'));
      else if (p.state === 'next') v = h('span', 'gs9-bk-v gs9-num', `${fmt(m.bar.need)}${NBSP}XP to go`);
      else if (p.state === 'turned') v = h('span', 'gs9-bk-v', 'Opens on your next results');
      const go = p.state === 'opened' && ride ? rideOn(m, p.rewards, ctx, ride) : null;
      const li = h('li', `gs9-row gs9-bk-rank is-${p.state}`, h('span', 'gs9-row-t', n, h('span', `gs9-bk-g${glyph === 'gift' ? ' is-gift' : ''}`, ico9(glyph)), prizes), go, v);
      if (p.state === 'next') li.dataset.next = '';
      if (p.state === 'opened') li.setAttribute('aria-label', `Rider Rank ${p.n}, reached: ${prizesLine(p.rewards)}`);
      else if (p.state === 'next') li.setAttribute('aria-label', `Rider Rank ${p.n}, next: ${prizesLine(p.rewards)}. ${fmt(m.bar.need)} XP to go`);
      else if (p.state === 'turned') li.setAttribute('aria-label', `Rider Rank ${p.n}, reached: ${prizesLine(p.rewards)}. Opens on your next results`);
      else li.setAttribute('aria-label', `Rider Rank ${p.n}, ahead: ${prizesLine(p.rewards)}`);
      list.append(li);
    }
    out.append(h('section', 'gs9-bk-sec', h('h3', 'gs9-cap', `Ranks ${rows[0].n} to ${rows[rows.length - 1].n}`), list));
  }
  return out;
}

/** A page of the album's sky: a mountain's own, else the page's glyph on ink. */
const PAGE_GLYPH: Readonly<Record<string, IconName>> = { tricks: 'feather', twelve: 'rider', charms: 'star', night: 'lantern' };

function pageArt(id: string): HTMLElement {
  const biome = mountainBiome(id);
  const art = h('span', `gs9-bk-sky${biome ? '' : ' is-glyph'}`);
  art.setAttribute('aria-hidden', 'true');
  if (biome) art.innerHTML = biomeArt(biome);
  else art.append(ico9(PAGE_GLYPH[id] ?? 'sticker'));
  return art;
}

/** The album's contents: the book's count, then a row a page, each with how many of its stickers are found. */
export function albumContents(m: AlbumModel, ctx: Ctx, open: (id: string, from: HTMLElement) => void): HTMLElement {
  const out = h('div', 'gs9-bk gs9-bk-album');
  out.append(h('p', 'gs9-block-p', `${fmt(m.got)} of ${fmt(m.of)} stickers found.`));
  const list = h('ul', 'gs9-list gs9-bk-pages');
  // (The mountains' pages in the order the title's picker holds them, the unlock path with the finale last; then the rest.)
  const cards = MOUNTAINS.map((x) => ({ id: x.id as string, biome: mountainBiome(x.id) ?? 'alpine', unlockGhosts: x.unlockGhosts, finale: x.finale === true }));
  const order = pickerOrder(cards).map((c) => c.id);
  const rank = (id: string): number => (order.includes(id) ? order.indexOf(id) : order.length);
  const secs = m.sections.map((sec, i) => ({ sec, i })).sort((a, b) => rank(a.sec.id) - rank(b.sec.id) || a.i - b.i).map((x) => x.sec);
  for (const sec of secs) {
    if (sec.of === 0) continue;
    const name = h('span', 'gs9-bk-pn', sec.name);
    name.setAttribute('translate', 'no');
    const all = sec.got >= sec.of;
    const b = b9(ctx, 'quiet', [pageArt(sec.id), h('span', 'gs9-bk-pt', name, h('span', 'gs9-bk-pc gs9-num', all ? `All ${fmt(sec.of)} found` : `${fmt(sec.got)} of ${fmt(sec.of)} found`)), ico9('chevR', 'gs9-bk-chev')], {
      fk: `album-${sec.id}`,
      cls: 'gs9-bk-page',
      onClick: () => open(sec.id, b),
    });
    list.append(h('li', '', b));
  }
  out.append(list);
  return out;
}

const GROUP_GLYPH: Readonly<Record<string, IconName>> = { variant: 'star', legend: 'ghost', mood: 'snowflake', rival: 'trophy', mirror: 'flag', trick: 'feather', duel: 'rider', charm: 'star', synergy: 'bolt', night: 'lantern' };

/** A sticker found: a frame from its run where one was kept, else painted in its mountain's sky; its name under it. */
function stickerFound(s: StickerCard): HTMLElement {
  const art = h('span', 'gs9-st-art');
  art.setAttribute('aria-hidden', 'true');
  const biome = mountainBiome(s.mountain);
  if (s.img) {
    const img = h('img', 'gs9-st-img');
    img.src = s.img;
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.width = 320;
    img.height = 200;
    art.append(img);
  } else art.innerHTML = biomeArt(biome ?? 'alpine');
  art.append(h('span', 'gs9-st-g', ico9(GROUP_GLYPH[s.group] ?? 'sticker')));
  // (A count never breaks: "The First Drop, 1 of 3".)
  const name = h('span', 'gs9-st-n', curly(s.name).replace(/(\d+) of (\d+)/g, `$1${NBSP}of${NBSP}$2`));
  name.setAttribute('translate', 'no');
  return h('li', `gs9-st${s.img ? ' is-shot' : ''}`, art, name);
}

/** A sticker still to find: its kind's glyph on a silhouette, and where to find it. */
function stickerToFind(s: StickerCard): HTMLElement {
  const li = h('li', 'gs9-st is-unseen', h('span', 'gs9-st-art', h('span', 'gs9-st-g', ico9(GROUP_GLYPH[s.group] ?? 'sticker'))), h('span', 'gs9-st-n', curly(s.hint)));
  li.firstElementChild?.setAttribute('aria-hidden', 'true');
  return li;
}

/** One page of the album: the stickers found, then the ones still to find. */
export function albumPage(sec: AlbumModel['sections'][number]): HTMLElement {
  const out = h('div', 'gs9-bk gs9-bk-stickers');
  const found = sec.stickers.filter((s) => s.got);
  const left = sec.stickers.filter((s) => !s.got);
  out.append(h('p', 'gs9-block-p', found.length === 0 ? `None found yet: all ${fmt(sec.of)} are still to find.` : left.length === 0 ? `All ${fmt(sec.of)} found.` : `${fmt(found.length)} of ${fmt(sec.of)} found.`));
  if (found.length > 0) out.append(h('section', 'gs9-bk-sec', h('h3', 'gs9-cap', 'Found'), h('ul', 'gs9-st-grid', ...found.map(stickerFound))));
  if (left.length > 0) out.append(h('section', 'gs9-bk-sec', h('h3', 'gs9-cap', 'Still to Find'), h('ul', 'gs9-st-grid', ...left.map(stickerToFind))));
  return out;
}
