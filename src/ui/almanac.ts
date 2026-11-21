import type { AlbumModel, AlmanacModel, ChapterView, RankBarView, RewardCard, StickerCard } from './contract';
import { biomeArt } from './art';
import { h, sr } from './dom';
import { fmt, NBSP } from './fmt';
import { icon, type IconName } from './icons';
import './books.css';

// Round 8: the Almanac and the Spirit Album, the two books of the spine (menus.ts holds them in one sheet with a tab
// each). The Almanac is fifty pages in five rows of ten, each page its rewards: the pages opened, the one the bar
// is filling toward (outlined, with what it still needs), and the pages ahead dimmed; the month's chapter heads it.
// The Album is a section a mountain and one for each of the rest, each sticker a painted card in its mountain's
// sky once held, and a silhouette with where to find it until then. Pure builders: no state, no handlers.

/** The pages shown together, as a row with its own heading. */
export const PAGES_A_ROW = 10;

/** A reward's glyph, as the results' cards draw it. */
export function rewardGlyph(k: RewardCard['kind']): IconName {
  switch (k) {
    case 'sled':
      return 'sledBold';
    case 'gifts':
      return 'gift';
    case 'garage':
      return 'sled';
    case 'mirror':
    case 'hour':
    case 'open':
    case 'legs':
      return 'flag';
    case 'feature':
      return 'book';
    default:
      return 'star';
  }
}

/** The bar's share toward the next page, 0 to 1. */
export function barShare(b: RankBarView): number {
  return b.need <= 0 ? 1 : Math.max(0, Math.min(1, b.into / (b.into + b.need)));
}

/** Rider Rank's bar as the books head it: the page, the share filled and what the next page needs. */
export function rankHead(b: RankBarView): HTMLElement {
  const fill = h('span', 'gs-bk-fill');
  fill.style.transform = `scaleX(${barShare(b).toFixed(4)})`;
  const bar = h('span', 'gs-bk-bar', fill);
  bar.setAttribute('aria-hidden', 'true');
  const next = b.next && b.next.length > 0 ? b.next.map((r) => r.name).join(', ') : null;
  const line = next ? h('span', 'gs-bk-rank-next', `Page ${b.page + 1}: `, h('span', '', next), h('span', 'gs-bk-togo', `${NBSP}${fmt(b.need)}${NBSP}to go`)) : h('span', 'gs-bk-rank-next', 'Every page turned');
  return h(
    'div',
    'gs-bk-rank',
    h('span', 'gs-bk-rank-n', h('span', 'gs-bk-rank-k', 'Rank'), h('span', 'gs-num', String(b.page)), h('span', 'gs-bk-rank-of gs-num', `of ${b.of}`)),
    b.title ? h('span', 'gs-bk-rank-title', b.title) : null,
    bar,
    line,
  );
}

/** The month's chapter: its name and line, its ten pages and its set (also on the garage's shelf). */
export function chapterBox(c: ChapterView): HTMLElement {
  const name = h('h3', 'gs-bk-ch-name', c.name);
  name.setAttribute('translate', 'no');
  const pips = h('span', 'gs-bk-ch-pips');
  pips.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < c.of; i++) pips.append(h('span', `gs-bk-ch-pip${i < c.page ? ' is-on' : i === c.page ? ' is-next' : ''}`));
  const set = h('ul', 'gs-bk-ch-set');
  for (const s of c.set) set.append(h('li', `gs-bk-ch-item${s.owned ? ' is-owned' : ''}`, s.owned ? icon('check') : null, h('span', '', s.name)));
  const box = h(
    'section',
    'gs-bk-ch',
    h('div', 'gs-bk-ch-head', name, h('span', 'gs-bk-ch-count gs-num', `${c.page} of ${c.of}`)),
    h('p', 'gs-bk-ch-line', c.line),
    pips,
    sr(`Chapter page ${c.page} of ${c.of}.${c.page < c.of ? ` ${fmt(c.need)} XP to the next.` : ''}`),
    c.set.length > 0 ? set : null,
  );
  box.setAttribute('aria-label', `This month's chapter: ${c.name}`);
  return box;
}

/** The Almanac's body: the chapter, then the fifty pages in rows of ten. */
export function almanacBody(m: AlmanacModel): HTMLElement {
  const out = h('div', 'gs-bk gs-bk-almanac');
  if (m.chapter) out.append(chapterBox(m.chapter));
  for (let r = 0; r < m.pages.length; r += PAGES_A_ROW) {
    const row = m.pages.slice(r, r + PAGES_A_ROW);
    const head = h('h3', 'gs-bk-h', `Pages ${row[0].n} to ${row[row.length - 1].n}`);
    const list = h('ol', 'gs-bk-pages');
    for (const p of row) {
      const li = h('li', `gs-bk-page is-${p.state}`);
      if (p.state === 'next') li.dataset.next = '';
      const said = p.state === 'opened' ? 'opened' : p.state === 'turned' ? 'turned, opens on your next results' : p.state === 'next' ? `next, ${fmt(m.bar.need)} XP to go` : 'ahead';
      li.append(
        h('span', 'gs-bk-page-n gs-num', String(p.n)),
        h('span', 'gs-bk-page-rw', ...p.rewards.map((rw) => h('span', `gs-bk-rw k-${rw.kind}`, icon(rewardGlyph(rw.kind)), h('span', 'gs-bk-rw-n', rw.name)))),
        ...(p.state === 'opened' ? [h('span', 'gs-bk-page-ok', icon('check'))] : p.state === 'next' ? [h('span', 'gs-bk-page-togo gs-num', `${fmt(m.bar.need)}${NBSP}to go`)] : []),
        sr(`, ${said}`),
      );
      list.append(li);
    }
    out.append(h('section', 'gs-bk-row', head, list));
  }
  return out;
}

/** A sticker's card: painted in its mountain's sky once held, a silhouette with its hint until then. */
export function stickerCard(s: StickerCard & { got: boolean }): HTMLElement {
  const biome = BIOME[s.mountain] ?? null;
  const name = h('span', 'gs-bk-st-n', s.got ? s.name : 'Not yet seen');
  if (s.got) name.setAttribute('translate', 'no');
  const art = h('span', 'gs-bk-st-art');
  // Round 8 (the photo lane): a sticker held is a frame from the run it happened in where one was kept; the painted
  // card in its mountain's sky where not (a sticker from before frames were kept, or another device's).
  const shot = s.got && s.img ? s.img : null;
  if (shot) {
    const img = h('img', 'gs-bk-st-img');
    img.src = shot;
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.width = 320;
    img.height = 200;
    art.append(img);
  } else if (s.got && biome) art.innerHTML = biomeArt(biome);
  const li = h('li', `gs-bk-st${s.got ? ' is-got' : ' is-unseen'}${shot ? ' is-shot' : ''}${biome ? ` b-${biome}` : ''} g-${s.group}`, art, h('span', 'gs-bk-st-ico', icon(GROUP_GLYPH[s.group] ?? 'sticker')), name);
  if (!s.got) li.append(h('span', 'gs-bk-st-hint', s.hint));
  li.setAttribute('aria-label', s.got ? s.name : `Not yet seen. ${s.hint}`);
  return li;
}

const BIOME: Readonly<Record<string, 'alpine' | 'glacier' | 'volcanic' | 'blossom' | 'lantern'>> = { pinecrest: 'alpine', frostfang: 'glacier', ember: 'volcanic', sakura: 'blossom', lanternfall: 'lantern' };
const GROUP_GLYPH: Readonly<Record<string, IconName>> = { variant: 'star', legend: 'ghost', mood: 'snowflake', rival: 'trophy', mirror: 'flag', trick: 'feather', duel: 'rider', charm: 'star', synergy: 'bolt', night: 'lantern' };

/** The Album's body: the whole book's figure, then each section with its own. */
export function albumBody(m: AlbumModel): HTMLElement {
  const pct = m.of > 0 ? Math.floor((m.got / m.of) * 100) : 0;
  const fill = h('span', 'gs-bk-fill');
  fill.style.transform = `scaleX(${(m.of > 0 ? m.got / m.of : 0).toFixed(4)})`;
  const bar = h('span', 'gs-bk-bar', fill);
  bar.setAttribute('aria-hidden', 'true');
  const out = h('div', 'gs-bk gs-bk-album', h('div', 'gs-bk-al-head', h('span', 'gs-bk-al-n', h('span', 'gs-num', fmt(m.got)), h('span', 'gs-bk-rank-of gs-num', `of ${fmt(m.of)}`), h('span', 'gs-bk-al-pct gs-num', `${pct}%`)), bar));
  for (const sec of m.sections) {
    if (sec.of === 0) continue;
    const name = h('span', '', sec.name);
    name.setAttribute('translate', 'no');
    const head = h('h3', 'gs-bk-h', name, h('span', 'gs-bk-h-n gs-num', `${sec.got} of ${sec.of}`));
    // Held first, then the silhouettes, so a section reads as what you have and what is left.
    const list = h('ul', 'gs-bk-stickers');
    for (const s of [...sec.stickers].sort((a, b) => Number(b.got) - Number(a.got))) list.append(stickerCard(s));
    out.append(h('section', 'gs-bk-row', head, list));
  }
  return out;
}
