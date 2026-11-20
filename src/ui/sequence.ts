import type { GhostKind, RankBarView, ResultsModel, RewardCard, StickerCard, UnlockedMountain, XpTickView } from './contract';
import type { InputMode } from '../game/input';
import { type Standing, aheadOf, byStanding, margin } from '../game/standing';
import { biomeArt } from './art';
import { btn, h, kbd, padBtn, sr, type Ctx } from './dom';
import { fmt, metres, NBSP } from './fmt';
import { icon } from './icons';
import { barShare, rewardGlyph } from './almanac';
import { EASE_OUT, reduced } from './motion';

// Round 8 (V8 with G5): the results as a directed sequence of about five seconds over the live scene. The moment
// slams in first (results.ts momentEl, on its own beats); then the place with the nearest rider named ("0.4 s behind
// Old Wren"); then Rider Rank's bar fills with what the run paid and stops short of the next page on purpose; then
// what opened turns over, one card at a time; then the one button the spine chose, vermillion, its words whole. A tap
// or a key skips to the end; reduced motion shows the end at once, every beat still there. Everything else (the
// splits, the missions, the race order, Watch Your Run, Challenge a Friend, the swap) is one level down, behind
// Details, in the card it always was.

/** The sequence's beats, ms after the results open. The moment's own beats are results.ts RESULTS_TIMING (0 to
 *  about 860 ms); these follow it. */
export const SEQ_TIMING = {
  /** The place line, as the moment's words settle. */
  PLACE_MS: 640,
  /** The rank's row arrives; its bar starts to fill BAR_LEAD later. */
  BAR_MS: 1150,
  BAR_LEAD: 220,
  /** The whole fill, shared across its segments by their length (a page turned holds TURN_MS at the top). */
  FILL_MS: 1150,
  TURN_MS: 320,
  /** The first card turns this long after the fill ends; each next one CARD_STEP later; a turn takes CARD_MS. */
  CARDS_GAP: 180,
  CARD_STEP: 200,
  CARD_MS: 520,
  /** The button comes forward this long after the last beat before it lands. */
  BUTTON_GAP: 120,
  BUTTON_MS: 380,
} as const;

/** One stretch of the bar's fill: on page `page` (the page turned), from one share of the way to the next page to
 *  another. A run that turns a page fills to the top, holds, turns, and fills on. */
export interface BarSegment {
  page: number;
  from: number;
  to: number;
}

/** The bar's segments from where the run started to where it ended. Whole pages between are shown at most twice
 *  (a returning save can open several at once; the fill stays about a second). Empty when nothing moved. */
export function barSegments(before: RankBarView, after: RankBarView): BarSegment[] {
  const f0 = barShare(before);
  const f1 = barShare(after);
  if (after.page < before.page || (after.page === before.page && f1 <= f0)) return [];
  if (after.page === before.page) return [{ page: before.page, from: f0, to: f1 }];
  const out: BarSegment[] = [{ page: before.page, from: f0, to: 1 }];
  const whole = Math.min(2, after.page - before.page - 1);
  for (let i = 0; i < whole; i++) out.push({ page: after.page - whole + i, from: 0, to: 1 });
  if (f1 > 0) out.push({ page: after.page, from: 0, to: f1 });
  return out;
}

/** When each beat lands (ms after the results open), from what the run has to show. */
export interface SeqPlan {
  place: number | null;
  bar: number | null;
  /** Each fill segment's start and length. */
  fill: Array<{ at: number; ms: number }>;
  cards: number[];
  button: number;
  /** Everything has landed. */
  end: number;
}

export function seqPlan(o: { place: boolean; segments: readonly BarSegment[]; bar: boolean; cards: number }): SeqPlan {
  const T = SEQ_TIMING;
  let t = 0;
  const place = o.place ? T.PLACE_MS : null;
  if (place !== null) t = place + 260;
  let bar: number | null = null;
  const fill: SeqPlan['fill'] = [];
  if (o.bar) {
    bar = Math.max(t, T.BAR_MS);
    t = bar + T.BAR_LEAD;
    const total = o.segments.reduce((s, g) => s + (g.to - g.from), 0);
    for (const g of o.segments) {
      const ms = total > 0 ? Math.max(160, Math.round((T.FILL_MS * (g.to - g.from)) / total)) : 0;
      fill.push({ at: t, ms });
      t += ms;
      if (g.to >= 1) t += T.TURN_MS;
    }
    if (o.segments.length === 0) t += 260;
  }
  const cards: number[] = [];
  if (o.cards > 0) {
    t += T.CARDS_GAP;
    for (let i = 0; i < o.cards; i++) cards.push(t + i * T.CARD_STEP);
    t = cards[cards.length - 1] + T.CARD_MS;
  }
  const button = Math.max(t + T.BUTTON_GAP, place ?? 0, 900);
  return { place, bar, fill, cards, button, end: button + T.BUTTON_MS };
}

/** The place with the nearest rider named: who was just ahead and by how much, or, for a winner, how far clear of
 *  the next. Margins are the rows' own ("0.4 s" between finishers, "85 m" between the rest); a rider who stopped
 *  short of a finisher above is told how far short of the line. */
export interface NearLine {
  /** behind: the rider just ahead; clear: you won, the rider just behind; short: you stopped short of the line. */
  side: 'behind' | 'clear' | 'short';
  gap: string;
  name: string | null;
  kind: GhostKind | null;
}

const youAt = (m: ResultsModel): Standing => ({ time: m.finish?.seconds ?? null, distance: m.distance });
const ghostAt = (g: ResultsModel['ghosts'][number]): Standing => ({ time: g.time ?? null, distance: g.distance ?? 0 });

export function nearLine(m: ResultsModel): NearLine | null {
  const me = youAt(m);
  const order = [...m.ghosts].sort((a, b) => byStanding(ghostAt(a), ghostAt(b)));
  const ahead = order.filter((g) => aheadOf(ghostAt(g), me));
  if (ahead.length > 0) {
    const above = ahead[ahead.length - 1];
    const gap = margin(ghostAt(above), me);
    if (gap === null) {
      const short = Math.max(1, Math.round((m.finishZ ?? above.distance ?? m.distance) - m.distance));
      return { side: 'short', gap: metres(short), name: null, kind: null };
    }
    return { side: 'behind', gap: gap.replace(/(\d) ([ms])$/, `$1${NBSP}$2`), name: above.name, kind: above.kind };
  }
  const below = order.find((g) => !aheadOf(ghostAt(g), me));
  if (!below) return null;
  const gap = margin(me, ghostAt(below));
  if (gap === null) return m.finish ? { side: 'clear', gap: 'the only finisher', name: null, kind: null } : null;
  return { side: 'clear', gap: gap.replace(/(\d) ([ms])$/, `$1${NBSP}$2`), name: below.name, kind: below.kind };
}

/** What turned over: a mountain opened, an Almanac page's reward, the run's stickers (one card), or how many more
 *  wait one level down. */
export type StoryCard =
  | { kind: 'mountain'; id: string | null; name: string; biome: UnlockedMountain['biome'] | null }
  | { kind: 'reward'; reward: RewardCard }
  | { kind: 'stickers'; count: number; first: StickerCard }
  | { kind: 'more'; count: number; names: string[] };

/** At most this many cards turn over; past it the last slot says how many more are in Details. */
export const MAX_CARDS = 3;

export function storyCards(m: ResultsModel): StoryCard[] {
  const all: StoryCard[] = [];
  const mtns = m.unlockedMountains && m.unlockedMountains.length > 0 ? m.unlockedMountains : null;
  if (mtns) for (const u of mtns) all.push({ kind: 'mountain', id: u.id, name: u.name, biome: u.biome });
  else for (const n of m.unlocked) all.push({ kind: 'mountain', id: null, name: n, biome: null });
  const names = new Set(all.map((c) => (c.kind === 'mountain' ? c.name : '')));
  for (const r of m.spine?.opened ?? []) if (!names.has(r.name)) all.push({ kind: 'reward', reward: r });
  const st = m.spine?.stickers ?? [];
  if (st.length > 0) all.push({ kind: 'stickers', count: st.length, first: st[0] });
  if (all.length <= MAX_CARDS) return all;
  const rest = all.slice(MAX_CARDS - 1);
  const name = (c: StoryCard): string => (c.kind === 'mountain' ? c.name : c.kind === 'reward' ? c.reward.name : c.kind === 'stickers' ? (c.count > 1 ? `${c.count} stickers` : c.first.name) : '');
  return [...all.slice(0, MAX_CARDS - 1), { kind: 'more', count: rest.length, names: rest.map(name) }];
}

/** The ticks the bar names as it fills: the biggest few, in the order they were paid. */
export function namedTicks(ticks: readonly XpTickView[], n: number): XpTickView[] {
  const keep = new Set([...ticks].map((t, i) => ({ t, i })).sort((a, b) => b.t.xp - a.t.xp || a.i - b.i).slice(0, n).map((x) => x.i));
  return ticks.filter((_, i) => keep.has(i));
}

/** What a reward card says under its name. */
function rewardSub(r: RewardCard): string {
  return r.chapter ? `Chapter page ${r.page}` : `Page ${r.page}`;
}

export interface StoryHooks {
  again(): void;
  home(): void;
  details(): void;
  /** A mountain card's Ride It. */
  ride(id: string): void;
  /** A beat landed, for its sound: the bar's ticks, a page turned, a card turned, the button. */
  beat(kind: 'fill' | 'page' | 'card' | 'button', i: number): void;
  /** The bar's fill starts: the run's finished missions are paid now (their chimes). */
  paid(): void;
}

/**
 * The sequence, built once per results and played or landed whole. Its element sits over the scene beside the
 * moment; Details swaps it for the full card (results.ts).
 */
export class Story {
  readonly el: HTMLElement;
  readonly again: HTMLButtonElement;
  private readonly steps: HTMLElement[] = [];
  private timers: number[] = [];
  private anims: Animation[] = [];
  private raf = 0;
  private done = false;
  private isPaid = false;
  private readonly plan: SeqPlan;
  private readonly segs: BarSegment[];
  private readonly fillEl: HTMLElement | null = null;
  private readonly pageEl: HTMLElement | null = null;
  private readonly xpEl: HTMLElement | null = null;
  private readonly cardEls: HTMLElement[] = [];
  private readonly tickEls: HTMLElement[] = [];
  private readonly xp: number;

  constructor(
    private readonly m: ResultsModel,
    ctx: Ctx,
    private readonly mode: InputMode,
    private readonly hooks: StoryHooks,
    offers: HTMLElement[],
  ) {
    const spine = m.spine ?? null;
    // Built waiting (each step hidden) unless reduced motion lands it whole: a step never fades out as the results open.
    this.el = h('section', `gs-story${reduced() ? '' : ' is-playing'}`);
    this.el.setAttribute('aria-label', 'Run summary');

    // The place, the nearest rider named.
    const near = nearLine(m);
    let place: HTMLElement | null = null;
    if (near) {
      const who = near.name ? h('span', `gs-sq-who ${near.kind === 'grudge' ? 'k-grudge' : near.kind === 'you' ? 'k-you' : 'k-ghost'}`, near.kind === 'you' ? 'your best' : near.name) : null;
      who?.setAttribute('translate', 'no');
      const gap = h('span', 'gs-sq-gap gs-num', near.gap);
      const words =
        near.side === 'behind'
          ? [gap, ' behind ', who]
          : near.side === 'clear'
            ? who
              ? [gap, ' clear of ', who]
              : ['You were ', gap]
            : [gap, ' short of the line'];
      place = h('p', `gs-sq-place gs-sq-step is-${near.side}`, icon(near.side === 'short' ? 'flag' : 'ghost', 'gs-sq-place-ico'), h('span', 'gs-sq-place-t', ...words));
      this.steps.push(place);
    }

    // Rider Rank: the page turned, what the run paid filling the bar, and what the next page holds.
    let rank: HTMLElement | null = null;
    this.segs = spine ? barSegments(spine.before, spine.after) : [];
    this.xp = spine ? spine.ticks.reduce((s, t) => s + t.xp, 0) : 0;
    if (spine) {
      const a = spine.after;
      this.pageEl = h('span', 'gs-sq-page-n gs-num', String(spine.before.page));
      this.xpEl = h('span', 'gs-num', `+${fmt(this.xp)}`);
      const gifts = m.giftsEarned > 0 ? h('span', 'gs-sq-gifts', h('span', 'gs-num', `+${fmt(m.giftsEarned)}`), icon('gift'), sr(' gifts')) : null;
      const flame = spine.flame.lit ? h('span', 'gs-sq-flame', icon('flame'), h('span', 'gs-num', `Day ${spine.flame.streak}`), sr(' of your flame')) : null;
      const head = h('div', 'gs-sq-rank-head', h('span', 'gs-sq-page', h('span', 'gs-sq-page-k', 'Rider Rank'), this.pageEl), h('span', 'gs-sq-xp', this.xpEl, h('span', 'gs-sq-xp-u', NBSP + 'XP')), flame, gifts);
      this.fillEl = h('span', 'gs-sq-fill');
      const bar = h('span', 'gs-sq-bar', this.fillEl);
      bar.setAttribute('aria-hidden', 'true');
      this.fillEl.style.transform = `scaleX(${barShare(spine.before).toFixed(4)})`;
      const nextR = a.next && a.next.length > 0 ? a.next.map((r) => r.name).join(', ') : null;
      const next = nextR
        ? h('p', 'gs-sq-next', h('span', 'gs-sq-next-k', `Page ${a.page + 1}`), h('span', 'gs-sq-next-n', nextR), h('span', 'gs-sq-togo', h('span', 'gs-num', fmt(a.need)), `${NBSP}to go`))
        : h('p', 'gs-sq-next', h('span', 'gs-sq-next-n', 'Every page turned'));
      const ticks = h('ul', 'gs-sq-ticks');
      for (const t of namedTicks(spine.ticks, 3)) {
        const li = h('li', 'gs-sq-tick', h('span', 'gs-sq-tick-l', t.label), h('span', 'gs-num', `+${fmt(t.xp)}`));
        ticks.append(li);
        this.tickEls.push(li);
      }
      const spoken = sr(`Rider Rank page ${a.page} of ${a.of}, ${fmt(this.xp)} XP this run.${nextR ? ` Page ${a.page + 1}, ${nextR}, ${fmt(a.need)} XP to go.` : ''}`);
      rank = h('div', 'gs-sq-rank gs-sq-step', head, bar, next, ticks.childElementCount > 0 ? ticks : null, spoken);
      this.steps.push(rank);
    }

    // What turned over.
    const cards = storyCards(m);
    let row: HTMLElement | null = null;
    if (cards.length > 0) {
      row = h('ul', `gs-sq-cards gs-sq-step n-${cards.length}`);
      row.setAttribute('aria-label', 'Opened this run');
      cards.forEach((c, i) => {
        const li = h('li', 'gs-sq-card');
        li.style.setProperty('--i', String(i));
        li.append(h('span', 'gs-sq-back', icon('book')), this.face(c, ctx));
        row!.append(li);
        this.cardEls.push(li);
      });
      this.steps.push(row);
    }

    // The one button: the spine's choice, its words whole, the line under it the reason.
    const label = m.runAgainLabel?.text ?? 'Run Again';
    // The reason under it. A page named as the nearest goal is already the rank's line above, so the button keeps
    // its number and what it needs ("Page 6: 300 to go").
    const raw = spine && spine.primary.text === label ? spine.primary.sub : null;
    const page = raw ? /^Page (\d+): .*: (\d[\d,]* to go)$/.exec(raw) : null;
    const sub = page ? `Page ${page[1]}: ${page[2]}` : raw;
    const len = [...label].length;
    const key = mode === 'touch' ? null : mode === 'gamepad' ? padBtn('A') : kbd('Space');
    key?.setAttribute('aria-hidden', 'true');
    this.again = btn(
      ctx,
      { cls: `gs-btn-primary gs-sq-again${len > 18 ? ' is-long' : ''}${len > 24 ? ' is-xlong' : ''}`, icon: 'play', sound: 'confirm', fk: 'st-again', gameKey: true, onClick: () => this.hooks.again() },
      h('span', 'gs-btn-label gs-sq-again-t', h('span', 'gs-sq-again-l', label), sub ? h('span', 'gs-sq-again-sub', sub) : null),
      key,
    );
    this.again.setAttribute('aria-label', m.runAgainLabel?.aria ?? label);
    if (key) this.again.setAttribute('aria-keyshortcuts', 'Space');
    this.again.querySelector('.gs-sq-again-l')?.setAttribute('translate', 'no');
    const go = h('div', 'gs-sq-go gs-sq-step', this.again);
    this.steps.push(go);

    const home = btn(ctx, { cls: 'gs-btn-soft gs-sq-home', icon: 'back', label: 'Home', sound: 'back', fk: 'st-home', onClick: () => this.hooks.home() });
    const more = btn(ctx, { cls: 'gs-btn-soft gs-sq-details', icon: 'chevR', label: 'Details', sound: 'tap', fk: 'details', onClick: () => this.hooks.details() });
    more.setAttribute('aria-label', 'Details: the race, your splits and missions');
    const foot = h('div', 'gs-sq-foot gs-sq-step', home, ...offers, more);
    this.steps.push(foot);
    this.el.append(...[place, rank, row, go, foot].filter((x): x is HTMLElement => x !== null));
    this.plan = seqPlan({ place: place !== null, segments: this.segs, bar: rank !== null, cards: this.cardEls.length });
  }

  /** A card's face: what opened, in the card's own words. */
  private face(c: StoryCard, ctx: Ctx): HTMLElement {
    if (c.kind === 'mountain') {
      const sky = h('span', 'gs-mtn-sky');
      if (c.biome) sky.innerHTML = biomeArt(c.biome);
      const name = h('span', 'gs-sq-card-n', c.name);
      name.setAttribute('translate', 'no');
      const face = h('span', `gs-sq-face is-mountain${c.biome ? ` b-${c.biome}` : ''}`, h('span', 'gs-sq-card-art', sky), h('span', 'gs-sq-card-k', icon('check'), 'Unlocked'), name);
      if (c.id) {
        const id = c.id;
        const ride = btn(ctx, { cls: 'gs-sq-card-go', label: 'Ride It', icon: 'play', sound: 'confirm', fk: `st-ul-${id}`, onClick: () => this.hooks.ride(id) });
        ride.setAttribute('aria-label', `Ride It: ${c.name}`);
        face.append(ride);
      }
      return face;
    }
    if (c.kind === 'reward') {
      const r = c.reward;
      const name = h('span', 'gs-sq-card-n', r.name);
      name.setAttribute('translate', 'no');
      return h('span', `gs-sq-face is-reward k-${r.kind}`, h('span', 'gs-sq-card-ico', icon(rewardGlyph(r.kind))), name, h('span', 'gs-sq-card-k', rewardSub(r)));
    }
    if (c.kind === 'stickers') {
      const name = h('span', 'gs-sq-card-n', c.count > 1 ? `${c.count} stickers` : c.first.name);
      if (c.count === 1) name.setAttribute('translate', 'no');
      return h('span', 'gs-sq-face is-sticker', h('span', 'gs-sq-card-ico', icon('sticker')), name, h('span', 'gs-sq-card-k', c.count > 1 ? `${c.first.name} and more` : 'New sticker'));
    }
    // What waits in Details, named (two at most), so the slot is a card and not a blank.
    const list = h('span', 'gs-sq-more-l', c.names.slice(0, 2).join(', ') + (c.names.length > 2 ? ', and more' : ''));
    list.setAttribute('translate', 'no');
    const all = btn(ctx, { cls: 'gs-sq-face is-more', sound: 'tap', fk: 'st-more', onClick: () => this.hooks.details() }, h('span', 'gs-sq-card-n gs-num', `+${c.count} more`), list, h('span', 'gs-sq-card-k', 'In Details', icon('chevR')));
    all.setAttribute('aria-label', `${c.count} more opened: ${c.names.join(', ')}. See Details`);
    return all;
  }

  get playing(): boolean {
    return !this.done;
  }

  /** Plays the sequence from the start (the results just opened). Reduced motion lands it whole. */
  play(): void {
    if (reduced()) {
      this.finish();
      return;
    }
    this.el.classList.add('is-playing');
    const P = this.plan;
    const at = (ms: number, f: () => void) => this.timers.push(window.setTimeout(f, ms));
    const steps = [...this.steps];
    let k = 0;
    const show = (el: HTMLElement | undefined) => el?.classList.add('is-on');
    if (P.place !== null) {
      const placeEl = steps[k++];
      at(P.place, () => show(placeEl));
    }
    if (P.bar !== null) {
      const rankEl = steps[k++];
      at(P.bar, () => show(rankEl));
      this.fill(P);
    }
    if (P.cards.length > 0) {
      const rowEl = steps[k++];
      at(P.cards[0] - 60, () => show(rowEl));
      P.cards.forEach((t, i) =>
        at(t, () => {
          this.cardEls[i]?.classList.add('is-turned');
          this.hooks.beat('card', i);
        }),
      );
    }
    const goEl = steps[k++];
    const footEl = steps[k++];
    at(P.button, () => {
      show(goEl);
      this.hooks.beat('button', 0);
    });
    at(P.button + 140, () => show(footEl));
    at(P.end, () => this.finish());
  }

  /** The bar fills segment by segment; the page figure turns at each top; the XP counts up alongside; the ticks
   *  it names light as the fill passes their share. */
  private fill(P: SeqPlan): void {
    const fillEl = this.fillEl;
    if (!fillEl) return;
    const total = P.fill.reduce((s, f) => s + f.ms, 0);
    const t0 = P.fill[0]?.at ?? (P.bar ?? 0) + SEQ_TIMING.BAR_LEAD;
    this.segs.forEach((g, i) => {
      const f = P.fill[i];
      this.timers.push(
        window.setTimeout(() => {
          if (this.pageEl) this.pageEl.textContent = String(g.page);
          if (typeof fillEl.animate === 'function') {
            this.anims.push(fillEl.animate([{ transform: `scaleX(${g.from})` }, { transform: `scaleX(${g.to})` }], { duration: f.ms, easing: i === this.segs.length - 1 ? EASE_OUT : 'cubic-bezier(0.4, 0, 0.7, 1)', fill: 'forwards' }));
          }
          this.hooks.beat('fill', i);
          if (g.to >= 1)
            this.timers.push(
              window.setTimeout(() => {
                this.el.querySelector('.gs-sq-rank')?.classList.remove('is-turn');
                void (this.el.querySelector('.gs-sq-rank') as HTMLElement | null)?.offsetWidth;
                this.el.querySelector('.gs-sq-rank')?.classList.add('is-turn');
                if (this.pageEl) this.pageEl.textContent = String(g.page + 1);
                this.hooks.beat('page', i);
              }, f.ms),
            );
        }, f.at),
      );
    });
    this.timers.push(window.setTimeout(() => this.pay(), t0));
    // The XP figure counts up over the whole fill, and the named ticks light in order across it.
    const xpEl = this.xpEl;
    const n = this.tickEls.length;
    this.timers.push(
      window.setTimeout(() => {
        const s = performance.now();
        const dur = Math.max(400, total);
        const step = (now: number) => {
          const p = Math.min(1, (now - s) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          if (xpEl) xpEl.textContent = `+${fmt(this.xp * e)}`;
          for (let i = 0; i < n; i++) if (e >= (i + 0.5) / n) this.tickEls[i].classList.add('is-on');
          if (p < 1 && !this.done) this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
      }, t0),
    );
  }

  /** Lands everything at once: a tap or a key, the end of the timeline, or reduced motion. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    cancelAnimationFrame(this.raf);
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
    const spine = this.m.spine;
    if (spine && this.fillEl) this.fillEl.style.transform = `scaleX(${barShare(spine.after).toFixed(4)})`;
    if (spine && this.pageEl) this.pageEl.textContent = String(spine.after.page);
    if (this.xpEl) this.xpEl.textContent = `+${fmt(this.xp)}`;
    for (const t of this.tickEls) t.classList.add('is-on');
    for (const c of this.cardEls) c.classList.add('is-turned');
    for (const s of this.steps) s.classList.add('is-on');
    this.el.classList.remove('is-playing');
    this.el.classList.add('is-done');
    // A keyboard player waiting on the section lands on the button as it arrives.
    if (this.mode === 'keyboard' && document.activeElement === this.el) this.again.focus({ preventScroll: true });
    this.pay();
  }

  /** The run's finished missions are paid once, as the fill starts or as the sequence lands whole. */
  private pay(): void {
    if (this.isPaid) return;
    this.isPaid = true;
    this.hooks.paid();
  }

  dispose(): void {
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    cancelAnimationFrame(this.raf);
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
  }
}
