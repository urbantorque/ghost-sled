import type { ResultsGhost, ResultsModel, ResultsNextUnlock, UIHandlers, UnlockedMountain } from './contract';
import type { InputMode } from '../game/input';
import { SLEDS } from '../sim/sleds';
import { biomeArt } from './art';
import { btn, captureFocus, h, kbd, Layer, restoreFocus, sr, type Ctx } from './dom';
import { fmt, kindCls, metres, NBSP, ordinal, seconds } from './fmt';
import { icon, type IconName } from './icons';
import { bump, reduced } from './motion';
import { missionList } from './title';
import './meta.css';

// Results: slides in fast, then lands one beat at a time (the score counts up, then your place, the
// race, and the missions last), so the card reads as a story rather than a form. The head is the
// score with your finishing place, how the run ended, how far the next place was and the gifts it
// earned; under it the run's best stats (only those worth naming), the race (the finishing order
// by distance, windowed around you), missions folded to one row, and a tip for next time when the
// run had nothing to show. Run again is the default focus and
// the only loud button; rewarded options sit beside it at Home size, easy to skip. On wide landscape
// screens the card keeps to the right, so the live crash scene on the left is the hero shot.

const COUNT_MS = 650;
/**
 * The card's beat timeline (ms after it opens), for sound sync (engine.ui delays). The values mirror
 * the constants and style.css delays they are named after; they change together.
 */
export const RESULTS_TIMING = {
  COUNT_MS,
  PLACE_MS: 300,
  NEW_BEST_MS: 560,
  BEAT_MS: 860,
  BEAT_STEP: 110,
  DONE_MS: 1050,
  DONE_STEP: 140,
  FLY_MS: 1470,
  FLY_STEP: 140,
  FLY_DUR: 680,
  /** The head's sub block (crash line, race line, gifts) steps in (style.css .gs-res-sub). */
  SUB_MS: 440,
  /** The unlock slot pops in: a new mountain's card, or the next-unlock meter (style.css .gs-ul). */
  UNLOCK_MS: 480,
  /** The next-unlock meter fills from where the run started to where it ended (meta.css). */
  METER_MS: 760,
  METER_DUR: 620,
} as const;
/** When the missions land (ms after the card opens), matching the stagger in style.css. Their bars
 *  fill, each completed one's Done stamp lands 140 ms after the last, then its reward flies. */
const MIS_STAMP_MS = 1050;
/** The finishing order shows your row, the two places above it (the next ghosts to beat) and the one
 *  below; Show All opens the rest. A field this small or smaller always shows whole. */
const WIN_ABOVE = 2;
const WIN_ROWS = 4;
/** Phones in portrait show one place above yours and one below (see standings). */
const WIN_ROWS_PHONE = 3;
/**
 * A trick stat earns a slot only when it says something: under these floors ("Max air 0.4 s") it
 * reads as a list of near misses. The air floor is the air mission's own target. A stat the game
 * flags as a personal record always shows, first, with a Record tag.
 */
const FLOOR = { bestCombo: 1000, perfects: 1, maxAir: 1.5, bestStreak: 3 } as const;
/** At most this many trick stats, so the score and the race carry the card. */
const MAX_STATS = 2;
/** Challenge is answered by a toast, not by updateResults: it re-arms after this long. */
const CHAL_LOCK_MS = 1500;
/** A lost combo from this big is named on the crash line ("with 4,960 on the line"). */
const LOST_LINE_MIN = 1000;
/** Results opened this session, so the tip for next time rotates through the moves to learn. */
let tipTurn = 0;

type StatKey = keyof typeof FLOOR;

export class Results {
  readonly layer: Layer;
  private readonly el: HTMLElement;
  private prev: ResultsModel | null = null;
  private raf = 0;
  private pending = new Set<string>();
  /** Offers pressed on these results: one the game then withdraws keeps its slot as a status. */
  private pressed = new Set<string>();
  private io: IntersectionObserver | null = null;
  private timers: number[] = [];
  /** Phone disclosures, kept across re-renders of the same results (an ad answered, gifts doubled). */
  private raceAll = false;
  private misOpen = false;
  /** This card's tip for next time, picked once per results (an update keeps it). */
  private tipIx = 0;
  inputMode: InputMode = 'keyboard';

  constructor(
    parent: HTMLElement,
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
  ) {
    this.el = h('div', 'gs-results gs-scrim');
    this.layer = new Layer(this.el, 200);
    parent.append(this.el);
    // A mouse or touch press leaves no focus on the button it hit (the UI root blurs it, so Space
    // stays the game's Run again): focus falls back to the dialog itself, where focusDefault puts
    // pointer players, rather than out to the page behind the modal.
    this.el.addEventListener('click', () => {
      if (!this.layer.open) return;
      const a = document.activeElement;
      if (a === null || a === document.body) this.el.querySelector<HTMLElement>('.gs-res-card')?.focus({ preventScroll: true });
    });
  }

  show(m: ResultsModel): void {
    this.prev = null;
    this.pending.clear();
    this.pressed.clear();
    this.raceAll = false;
    // With no race to show (no ghosts rode), the missions have the room: they open from the start.
    this.misOpen = m.ghosts.length === 0;
    this.tipIx = tipTurn++;
    this.render(m, true);
    this.layer.show();
    this.focusDefault();
    if (!reduced()) this.countUp(m.score);
    this.flyRewards(m);
  }

  update(m: ResultsModel): void {
    if (!this.layer.open) return;
    const fk = captureFocus(this.el);
    const before = this.prev;
    this.pending.clear();
    this.render(m, false);
    if (!restoreFocus(this.el, fk)) this.focusDefault();
    if (before && !before.doubled && m.doubled) {
      const g = this.el.querySelector('.gs-res-gifts');
      if (g) bump(g, 1.12, 320);
    }
  }

  /** Scrolls the details for a scroll key pressed inside the card. The UI root never lets those keys
   *  through: Up and Down are also the game's action keys, which would start the next run here. */
  scrollKey(code: string): void {
    const body = this.el.querySelector<HTMLElement>('.gs-res-body');
    if (!body || body.scrollHeight <= body.clientHeight) return;
    const page = body.clientHeight * 0.85;
    const by = code === 'ArrowDown' ? 60 : code === 'ArrowUp' ? -60 : code === 'PageDown' ? page : code === 'PageUp' ? -page : 0;
    const behavior = reduced() ? 'auto' : 'smooth';
    if (code === 'Home') body.scrollTo({ top: 0, behavior });
    else if (code === 'End') body.scrollTo({ top: body.scrollHeight, behavior });
    else body.scrollBy({ top: by, behavior });
  }

  hide(): void {
    cancelAnimationFrame(this.raf);
    this.clearTimers();
    this.io?.disconnect();
    this.io = null;
    this.layer.hide();
  }

  /**
   * Keyboard players land on Run again (Space and Enter both work anywhere on this screen). Mouse and
   * touch players have no keyboard focus to aim, so focus goes to the dialog itself: screen readers
   * still start inside it, and Run again shows its glow without a focus ring stacked around it.
   */
  private focusDefault(): void {
    const target = this.inputMode !== 'keyboard' ? this.el.querySelector<HTMLElement>('.gs-res-card') : this.el.querySelector<HTMLElement>('[data-fk="again"]');
    target?.focus({ preventScroll: true });
  }

  private countUp(target: number): void {
    const el = this.el.querySelector<HTMLElement>('.gs-res-score');
    if (!el || target <= 0) return;
    const t0 = performance.now();
    el.textContent = '0';
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / COUNT_MS);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * e);
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(step);
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
  }

  /**
   * A mission finished on this run pays out where you can see it: once its Complete stamp lands, the
   * reward flies from the card into the wallet line, which counts up as it arrives. Reduced motion
   * skips it, and a card scrolled out of view (phones) just counts the wallet.
   */
  private flyRewards(m: ResultsModel): void {
    const wins = m.missions.map((mv, i) => ({ mv, i })).filter((x) => x.mv.justCompleted && x.mv.reward > 0);
    const walletN = this.el.querySelector<HTMLElement>('.gs-res-wallet .gs-num');
    if (wins.length === 0 || !walletN || reduced()) return;
    let shown = m.wallet - wins.reduce((s, x) => s + x.mv.reward, 0);
    walletN.textContent = fmt(shown);
    const cards = this.el.querySelectorAll<HTMLElement>('.gs-res-missions .gs-mis');
    for (const { mv, i } of wins) {
      const land = () => {
        shown += mv.reward;
        walletN.textContent = fmt(shown);
        bump(walletN, 1.25, 340);
      };
      // Just after the card's Done stamp (its CSS delay is MIS_STAMP_MS plus 140 ms per row).
      const t = window.setTimeout(() => {
        const src = cards[i]?.querySelector<HTMLElement>('.gs-mis-reward');
        const body = this.el.querySelector<HTMLElement>('.gs-res-body');
        if (!src || !body || typeof src.animate !== 'function') return land();
        const a = src.getBoundingClientRect();
        const b = walletN.getBoundingClientRect();
        const v = body.getBoundingClientRect();
        const o = this.el.getBoundingClientRect();
        if (a.top < v.top || a.bottom > v.bottom || b.top < v.top || b.bottom > v.bottom) return land();
        const chip = h('span', 'gs-res-fly gs-num', '+' + fmt(mv.reward), icon('gift'));
        chip.setAttribute('aria-hidden', 'true');
        chip.style.left = `${(a.left - o.left).toFixed(1)}px`;
        chip.style.top = `${(a.top - o.top).toFixed(1)}px`;
        this.el.append(chip);
        const dx = b.left - a.left;
        const dy = b.top - a.top;
        const fly = chip.animate(
          [
            { transform: 'translate(0, 0) scale(0.8)', opacity: 0 },
            { transform: 'translate(0, -12px) scale(1.12)', opacity: 1, offset: 0.18, easing: 'cubic-bezier(0.55, 0, 0.85, 0.35)' },
            { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.7)`, opacity: 0.9 },
          ],
          { duration: 680, fill: 'forwards' },
        );
        fly.onfinish = () => {
          chip.remove();
          land();
        };
      }, MIS_STAMP_MS + 420 + i * 140);
      this.timers.push(t);
    }
  }

  private render(m: ResultsModel, intro: boolean): void {
    this.clearTimers();
    this.prev = m;
    const ctx = this.ctx;
    this.el.classList.toggle('is-static', !intro);

    // Head: where, the score with your place beside it, and how the run ended.
    const mtnName = h('span', '', m.mountain);
    mtnName.setAttribute('translate', 'no');
    const where = h('p', 'gs-res-where', mtnName);
    where.id = 'gs-res-where';
    if (m.mood) where.append(h('span', 'gs-res-mood', m.mood));
    // The visible score counts up from 0 as focus lands, so readers get a fixed copy instead.
    const score = h('div', 'gs-res-score gs-num', fmt(m.score));
    score.setAttribute('aria-hidden', 'true');
    const scoreSr = sr(`Score ${fmt(m.score)}`);
    scoreSr.id = 'gs-res-score';
    // Beside the score: where you finished in the race, then the new-best stamp or the best to beat.
    const side = h('div', 'gs-res-side');
    const place = finish(m);
    if (place) {
      const chip = h('p', 'gs-res-place', sr('Finished '), h('span', 'gs-res-place-n gs-num', ordinal(place.rank)), h('span', 'gs-res-place-of gs-num', `of ${place.of}`));
      if (place.rank === 1) chip.classList.add('is-first');
      side.append(chip);
    }
    if (m.newBest) side.append(h('span', 'gs-stamp gs-res-newbest', 'New best'));
    else if (m.best > 0) side.append(h('span', 'gs-res-best', icon('trophy'), 'Best ', h('span', 'gs-num', fmt(m.best))));
    const scoreRow = h('div', 'gs-res-scorerow', scoreSr, score, side.childElementCount > 0 ? side : null);
    // How the run ended is the lesson: an icon line in full off-white. Straight under it, the hook to
    // ride again (how far short of the next place you stopped), then what the run paid: the reward
    // beat sits in the head on every screen, so a phone never folds it below the race.
    // A big combo the crash took is named right on that line: it is what the run lost. "on the line"
    // keeps together, so a wrap never leaves "line" alone on a row of its own.
    const lost = (m.lostCombo ?? 0) >= LOST_LINE_MIN ? h('span', 'gs-res-lost', ' with ', h('span', 'gs-num', fmt(m.lostCombo!)), ` on${NBSP}the${NBSP}line`) : null;
    const cause = m.crashCause ? h('p', 'gs-res-cause', icon(causeIcon(m), 'gs-res-cause-ico'), h('span', 'gs-res-cause-t', m.crashCause, lost)) : null;
    // When the race line already names the margin to the place above ("Brave Rhea beat you by 85 m."
    // is the Next row's 85 m), the place note would say the same number twice: the line takes its slot.
    // On a phone the race line always takes the note's slot (meta.css, has-line): the head keeps its
    // line count (C6), so your row stays in the first view under an unlock card and three offers.
    const line = raceLine(m);
    const note = raceNote(m);
    const sub = h('div', `gs-res-sub${line ? ' has-line' : ''}`, cause, line && note && sameMargin(line, note) ? null : note, line, giftsRow(m));
    // A newly unlocked mountain is the run's reveal: it rides in the head, beside the crash line on
    // wide screens and straight under it on phones, so it is never below the fold. With none, the
    // same slot holds the next unlock to ride for, with how close it is.
    const unlock = this.unlocks(m) ?? nextUnlockCard(m);
    const subRow = unlock ? h('div', 'gs-res-subrow', sub, unlock) : sub;
    // The dialog is named by a fixed heading: the score counts up from 0 as focus lands, so naming the
    // dialog by it read "0, dialog". The score and the mountain describe it instead.
    const title = h('h2', 'gs-sr', 'Run results');
    title.id = 'gs-res-title';
    const head = h('header', 'gs-res-head', title, where, scoreRow, subRow);

    // Your run: only what it did well. A trick stat earns a slot by clearing its floor or setting a
    // record (two at most, records first), so the score and the race carry the card; four equal
    // stats read as a form, and a weak one ("Max air 0.4 s") as a near miss. Distance leads only
    // when no race shows it (the order ranks by it, on your own row). A run with nothing worth naming
    // has no stats block at all, and one tip for next time takes a full-width row of its own above
    // the buttons: inside the left column it either left that column ending early beside a full race
    // or pushed the missions down past the race's end.
    const picks = notable(m);
    const showDist = m.ghosts.length === 0;
    const stats = picks.length > 0 || showDist ? h('dl', 'gs-res-stats', showDist ? stat('Distance', metres(m.distance), 'is-key') : null, ...picks) : null;
    const tip = picks.length === 0 ? h('p', 'gs-res-tip', h('span', 'gs-res-tip-k', 'Next time', sr(':')), h('span', 'gs-res-tip-t', runTip(m, this.tipIx, this.inputMode))) : null;
    const run = stats ? h('section', 'gs-res-run', stats) : null;
    run?.setAttribute('aria-label', 'Your run');

    // The race tells one story, the finishing order by distance: the head counts the ghosts you
    // beat (finished ahead of) and only those rows wear a Beat stamp; the row just above yours wears
    // a Next tag, and the line in the card's head says how far that place was. A run that beat nobody
    // leaves the count out: "Beat 0 of 6" in bold caps only read as a verdict. Overtakes are
    // celebrated during the run, where they happen.
    let race: HTMLElement | null = null;
    if (m.ghosts.length > 0) {
      const beat = m.ghosts.filter((g) => dist(g) <= m.distance).length;
      const list = standings(m);
      const all = list.querySelector('.is-far, .is-far-p') ? this.showAll(list, m.ghosts.length + 1) : null;
      // A field only the phone window folds needs the link on phones alone.
      if (all && !list.querySelector('.is-far')) all.classList.add('is-p-only');
      const meta = beat > 0 ? h('span', 'gs-res-h-meta', 'Beat ', h('span', 'gs-num', `${beat} of ${m.ghosts.length}`)) : null;
      // h3: the sections sit under the dialog's own h2 ("Run results").
      race = h('section', 'gs-res-race', h('h3', 'gs-h2 gs-res-h', 'Race', meta), list, all);
    }
    const mis = m.missions.length > 0 ? this.missions(m) : null;

    // Actions. In portrait the "Watch Ad:" prefix is read but not shown (the video glyph carries it),
    // so the offers stay one-line pills.
    // An offer the player pressed and the game then withdrew (the revive spent, the gifts doubled)
    // keeps its slot as a quiet status, so focus stays where it was instead of falling onto Run
    // again, where the next Space would start a run.
    const extra = h('div', 'gs-res-extra');
    if (m.canRevive) extra.append(this.rewarded('revive', 'video', 'Revive', true, () => this.hd.onRevive()));
    else if (this.pressed.has('revive')) extra.append(this.spent('revive', 'Revive Used'));
    if (m.canDouble && !m.doubled) extra.append(this.rewarded('double', 'video', 'Double Gifts', true, () => this.hd.onDouble()));
    else if (this.pressed.has('double')) extra.append(this.spent('double', m.doubled ? 'Gifts Doubled' : 'No Ad Right Now'));
    // You beat a friend's challenge: answering back is the move, so the challenge leads the offers as
    // a filled mint Send It Back (mint: it sends your ghost), full label on every screen. Run again
    // keeps the vermillion and the Space key.
    const back = m.canChallenge && m.sendItBack === true;
    if (back) {
      const send = this.rewarded('challenge', 'link', 'Send It Back', false, () => this.hd.onChallenge());
      send.classList.add('gs-res-send');
      extra.prepend(send);
    }
    // Challenge a Friend rides with Home: at the far left of that row on wide screens, and a compact
    // glyph button beside Home on phones, so Run again carries the footer on its own.
    const chal = m.canChallenge && !back ? this.rewarded('challenge', 'link', 'Challenge a Friend', false, () => this.hd.onChallenge()) : null;
    if (chal) {
      chal.classList.add('gs-res-chal');
      // Phones show "Challenge" under the glyph; the rest stays in the name for readers and voice.
      chal.querySelector('.gs-btn-label')?.replaceChildren('Challenge', h('span', 'gs-res-chal-tail', ' a Friend'));
    }
    const label = m.runAgainLabel?.text ?? 'Run Again';
    const rematch = label.startsWith('Rematch ');
    const again = btn(
      ctx,
      { cls: `gs-btn-primary gs-btn-xl gs-again${rematch ? ' is-rematch' : ''}`, icon: 'play', label, aria: m.runAgainLabel?.aria, sound: 'confirm', fk: 'again', gameKey: true, onClick: () => this.hd.onRunAgain() },
      this.inputMode !== 'touch' ? kbd('Space') : null,
    );
    // "Rematch Mila": the rival's name is a handle, so auto-translate leaves it alone. On a phone the
    // word stacks over the name (meta.css), so the name keeps the button's width to itself.
    if (rematch) {
      const who = h('span', 'gs-again-who', label.slice('Rematch '.length));
      who.setAttribute('translate', 'no');
      again.querySelector('.gs-btn-label')?.replaceChildren(h('span', 'gs-again-k', 'Rematch '), who);
    }
    // The keycap is a hint, not part of the name.
    if (this.inputMode !== 'touch') {
      again.querySelector('kbd')?.setAttribute('aria-hidden', 'true');
      again.setAttribute('aria-keyshortcuts', 'Space');
    }
    const home = btn(ctx, { cls: 'gs-btn-soft gs-res-home', icon: 'back', label: 'Home', sound: 'back', fk: 'home', onClick: () => this.hd.onHome() });
    const actions = h('div', 'gs-res-actions', extra.childElementCount > 0 ? extra : null, h('div', `gs-res-main${chal ? ' has-chal' : ''}`, chal, home, again));

    // The body scrolls on short screens. A sentinel at its end drives a bottom fade and a More cue,
    // so a clipped card never looks like a layout bug.
    const end = h('div', 'gs-res-end');
    end.setAttribute('aria-hidden', 'true');
    const body = h('div', `gs-res-body${race ? '' : ' no-race'}${unlock ? ' has-ul' : ''}${run ? '' : ' no-run'}`, head, run, race, mis, tip, end);
    // Focusable, so keyboard players can reach what sits below the fold (Safari never focuses a
    // scroller on its own). The UI root routes the scroll keys here instead of to the game.
    body.tabIndex = 0;
    // A named region: a bare div may not carry aria-label, and readers announce the scroller by it.
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', 'Run details');
    // Missions are what usually waits below, so the cue names them.
    const more = h('button', 'gs-res-more', h('span', '', mis ? 'Missions' : 'More'), icon('chevR', 'gs-res-more-ico'));
    more.type = 'button';
    more.tabIndex = -1;
    more.setAttribute('aria-hidden', 'true');
    more.addEventListener('click', () => body.scrollBy({ top: Math.max(120, body.clientHeight * 0.7), behavior: reduced() ? 'auto' : 'smooth' }));
    const scroll = h('div', 'gs-res-scroll', body, more);

    const card = h('div', 'gs-res-card gs-panel', scroll, actions);
    card.tabIndex = -1;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', title.id);
    card.setAttribute('aria-describedby', `${scoreSr.id} ${where.id}`);
    this.el.replaceChildren(card);
    this.watchMore(body, end, scroll);
  }

  /** Toggles the bottom fade and More cue while the end of the body is out of view. */
  private watchMore(body: HTMLElement, end: HTMLElement, scroll: HTMLElement): void {
    this.io?.disconnect();
    this.io = null;
    if (typeof IntersectionObserver === 'undefined') return;
    // The sentinel sits right under the last block (the rows have no gap; margins set the rhythm), so
    // it comes into view once that block shows whole, and a row with nothing below it is never faded
    // as if it ran on.
    this.io = new IntersectionObserver((entries) => {
      for (const en of entries) scroll.classList.toggle('has-more', !en.isIntersecting);
    }, { root: body, threshold: 0 });
    this.io.observe(end);
  }

  /** The order shows a window around your row; this compact link under it opens the rest. */
  private showAll(list: HTMLElement, total: number): HTMLButtonElement {
    list.id = 'gs-res-order';
    const label = h('span', 'gs-btn-label');
    const b = btn(this.ctx, { cls: 'gs-res-all', fk: 'race-all', onClick: () => {
      this.raceAll = !this.raceAll;
      sync();
    } }, label, icon('chevR', 'gs-res-chev'));
    b.setAttribute('aria-controls', list.id);
    const sync = () => {
      list.classList.toggle('is-all', this.raceAll);
      b.setAttribute('aria-expanded', String(this.raceAll));
      label.textContent = this.raceAll ? 'Show Less' : `Show All ${total}`;
    };
    sync();
    return b;
  }

  /**
   * Missions, folded into one row (what is left, and a chevron that opens the list in place), so the
   * race and the score carry the card. On wide screens a mission this run finished stands open under
   * that row on its own, where its Done stamp lands and its reward flies to the wallet; the row then
   * counts what is left. A phone folds even that one away (under the race), and its row shows the pay.
   */
  private missions(m: ResultsModel): HTMLElement {
    const list = missionList(m.missions, true);
    list.id = 'gs-res-mis-list';
    const won = m.missions.filter((x) => x.justCompleted);
    const open = m.missions.filter((x) => !x.done).length;
    const pay = won.reduce((s, x) => s + x.reward, 0);
    const left = open > 0 ? h('span', 'gs-res-mis-left', h('span', 'gs-num', String(open)), ' open') : h('span', 'gs-res-mis-left', 'All done');
    const sum =
      won.length > 0
        ? h('span', 'gs-res-mis-sum is-won', h('span', 'gs-res-mis-pay', h('span', 'gs-num', `+${fmt(pay)}`), icon('gift'), sr(` gifts, ${won.length} complete`)), left)
        : h('span', 'gs-res-mis-sum', left);
    const toggle = btn(this.ctx, { cls: 'gs-btn-quiet gs-res-mis-toggle', icon: 'flag', label: 'Missions', fk: 'mis-toggle', onClick: () => {
      this.misOpen = !this.misOpen;
      sync();
      if (this.misOpen) list.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    } }, sum, icon('chevR', 'gs-res-chev'));
    toggle.setAttribute('aria-controls', list.id);
    const sec = h('section', `gs-res-missions is-fold${won.length > 0 ? ' has-new' : ''}`, h('h3', 'gs-h2 gs-res-h gs-res-mis-h', 'Missions'), toggle, list);
    sec.setAttribute('aria-label', 'Missions');
    const sync = () => {
      sec.classList.toggle('is-open', this.misOpen);
      toggle.setAttribute('aria-expanded', String(this.misOpen));
    };
    sync();
    return sec;
  }

  /** Newly unlocked mountains as reveal cards: the biome art, the name and a Ride it shortcut. */
  private unlocks(m: ResultsModel): HTMLElement | null {
    const list: UnlockedMountain[] | null = m.unlockedMountains && m.unlockedMountains.length > 0 ? m.unlockedMountains : null;
    if (!list && m.unlocked.length === 0) return null;
    const box = h('div', 'gs-res-unlock');
    if (!list) {
      for (const name of m.unlocked) {
        const n = h('span', '', name);
        n.setAttribute('translate', 'no');
        box.append(h('span', 'gs-unlock gs-pill', icon('check'), 'Unlocked ', n));
      }
      return box;
    }
    for (const u of list) {
      const sky = h('span', 'gs-mtn-sky');
      sky.innerHTML = biomeArt(u.biome);
      const name = h('span', 'gs-ul-name', u.name);
      name.setAttribute('translate', 'no');
      const ride = btn(this.ctx, {
        cls: 'gs-btn-soft gs-ul-ride',
        label: 'Ride It',
        icon: 'play',
        sound: 'confirm',
        fk: `ul-${u.id}`,
        onClick: () => {
          this.hd.onSelectMountain(u.id);
          this.hd.onRunAgain();
        },
      });
      // Starts with the visible label, so voice control's "click Ride It" still finds it.
      ride.setAttribute('aria-label', `Ride It: ${u.name}`);
      const card = h(
        'div',
        `gs-ul b-${u.biome}`,
        h('span', 'gs-ul-art', sky),
        h('span', 'gs-ul-txt', h('span', 'gs-ul-k', icon('check'), 'Unlocked'), name),
        ride,
      );
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `Unlocked ${u.name}`);
      box.append(card);
    }
    return box;
  }

  /**
   * An optional offer. One press per offer until the game answers with updateResults (which
   * re-renders the card); Challenge, answered by a toast, re-arms after a moment. A pressed offer is
   * aria-disabled, never `disabled`: a disabled button drops focus to the page, and focus then fell
   * back onto Run again, where the next Space started a run. A capture guard swallows presses (and
   * their tap sound) while it waits.
   */
  private rewarded(key: string, ic: 'video' | 'link', label: string, ad: boolean, run: () => void): HTMLButtonElement {
    const b = btn(
      this.ctx,
      {
        cls: 'gs-btn-soft gs-res-opt',
        icon: ic,
        fk: key,
        onClick: () => {
          this.pending.add(key);
          this.pressed.add(key);
          busy(true);
          run();
          if (!ad)
            this.timers.push(
              window.setTimeout(() => {
                this.pending.delete(key);
                busy(false);
              }, CHAL_LOCK_MS),
            );
        },
      },
      h('span', 'gs-btn-label', ad ? h('span', 'gs-res-opt-pre', 'Watch Ad: ') : null, label),
    );
    b.addEventListener(
      'click',
      (e) => {
        if (this.pending.has(key)) e.stopImmediatePropagation();
      },
      { capture: true },
    );
    const l = b.querySelector('.gs-btn-label');
    const idle = l ? [...l.childNodes] : [];
    const busy = (on: boolean): void => {
      if (on) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
      b.setAttribute('aria-busy', String(on && ad));
      if (l && ad) l.replaceChildren(...(on ? ['Loading…'] : idle));
    };
    if (this.pending.has(key)) busy(true);
    return b;
  }

  /** A withdrawn offer's slot: a quiet status with the offer's focus key, inert but focusable. */
  private spent(key: string, label: string): HTMLButtonElement {
    const b = btn(this.ctx, { cls: 'gs-btn-soft gs-res-opt is-spent', icon: 'check', label, fk: key, onClick: () => undefined });
    b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', (e) => e.stopImmediatePropagation(), { capture: true });
    return b;
  }
}

function stat(label: string, value: string, cls = '', record = false): HTMLElement {
  return h('div', `gs-res-stat${cls ? ' ' + cls : ''}`, h('dt', '', label), h('dd', 'gs-num', value, record ? h('span', 'gs-res-rec', sr(', '), 'Record') : null));
}

/**
 * The trick stats worth a slot: each one that set a record or cleared its floor (FLOOR), picked
 * records first and then by how far past its floor, two at most, shown in one fixed order.
 */
function notable(m: ResultsModel): HTMLElement[] {
  const rec = new Set<StatKey>(m.records ?? []);
  const streak = m.bestStreak ?? 0;
  const all: Array<{ k: StatKey; label: string; v: number; text: string; i: number }> = [
    { k: 'bestCombo', label: 'Best combo', v: m.bestCombo, text: fmt(m.bestCombo), i: 0 },
    { k: 'perfects', label: 'Perfects', v: m.perfects, text: fmt(m.perfects), i: 1 },
    // A stomp streak of 3 or more is the run's rhythm: "Stomp streak 4", like its stamp read.
    { k: 'bestStreak', label: 'Stomp streak', v: streak, text: fmt(streak), i: 2 },
    { k: 'maxAir', label: 'Max air', v: m.maxAir, text: seconds(m.maxAir), i: 3 },
  ];
  // A streak says more than the perfects count it is made of: it takes that slot (unless the count is
  // a record) and ranks right after records.
  const hasStreak = streak >= FLOOR.bestStreak;
  const rank = (s: (typeof all)[number]) => (rec.has(s.k) ? 100 : 0) + (s.k === 'bestStreak' ? 10 : 0) + s.v / FLOOR[s.k];
  return all
    .filter((s) => !(hasStreak && s.k === 'perfects' && !rec.has('perfects')))
    .filter((s) => s.v > 0 && (rec.has(s.k) || s.v >= FLOOR[s.k]))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, MAX_STATS)
    .sort((a, b) => a.i - b.i)
    .map((s) => stat(s.label, s.text, '', rec.has(s.k)));
}

/**
 * What the run paid: the gifts earned (x2 once doubled) and the wallet they landed in. A run that
 * earned nothing shows only the wallet, never a "+0", and a first run with an empty wallet no line.
 */
function giftsRow(m: ResultsModel): HTMLElement | null {
  if (m.giftsEarned <= 0 && m.wallet <= 0) return null;
  const g = h('p', 'gs-res-gifts', icon('gift', 'gs-res-gifts-ico'));
  if (m.giftsEarned > 0) {
    g.append(h('span', 'gs-res-gifts-n gs-num', '+' + fmt(m.giftsEarned), sr(' gifts')));
    if (m.doubled) g.append(h('span', 'gs-x2 gs-num', 'x2'));
  }
  g.append(h('span', 'gs-res-wallet', h('span', 'gs-num', fmt(m.wallet)), m.giftsEarned > 0 ? ' in wallet' : ' gifts in wallet'));
  return g;
}

/**
 * One short tip for a run with no stat worth naming, in the onboarding hints' own words: what ended
 * this run if a habit fixes it, otherwise the next move to learn, rotating card to card through the
 * pop, the spin, the backflip and the boosted pop (touch words on touch).
 */
function runTip(m: ResultsModel, turn: number, mode: InputMode): string {
  switch (m.crashKind) {
    case 'forest':
      return 'Ride between the banks: they push you back onto the line.';
    case 'landing':
      return 'Land with the sled pointing down the hill.';
    case 'avalanche':
      return 'Tuck in behind a ghost to draft away from the wall.';
  }
  const touch = mode === 'touch';
  const moves = [
    'Hold to crouch, then release to pop off a kicker.',
    touch ? 'Drag in the air to spin.' : mode === 'mouse' ? 'Move in the air to spin.' : 'Steer in the air to spin.',
    touch ? 'Hold in the air to flip.' : 'Press and hold in the air to flip.',
    'Hold, then let go at the lip for a boosted pop.',
  ];
  return moves[turn % moves.length];
}

/**
 * The one extra race line (C6 budget: friend, then grudge, then the event note), hung under the crash
 * line like the place note. A friend or grudge line wears its ghost's colour and a ghost glyph in the
 * crash line's icon column; an event note stays quiet off-white.
 */
function raceLine(m: ResultsModel): HTMLElement | null {
  const l = m.raceLine;
  if (!l || !l.text) return null;
  // The Daily medal line ("Daily: Silver. Gold at 2,410 m.") wears its medal disc in the icon column.
  const medal = l.tone === 'event' ? /^Daily: (Bronze|Silver|Gold)\./.exec(l.text) : null;
  const rank = medal ? ['Bronze', 'Silver', 'Gold'].indexOf(medal[1]) + 1 : 0;
  const disc = rank > 0 ? h('span', `gs-medal m-${rank} gs-res-line-ico`) : null;
  disc?.setAttribute('aria-hidden', 'true');
  const glyph = l.tone === 'event' ? disc : icon('ghost', 'gs-res-line-ico');
  // "85 m" never breaks between the number and its unit.
  const text = l.text.replace(/(\d) m\b/g, `$1${NBSP}m`);
  const p = h('p', `gs-res-line is-${l.tone}${l.tone === 'grudge' ? ' k-grudge' : l.tone === 'friend' ? ' k-ghost' : ''}`, glyph, h('span', 'gs-res-line-t', text));
  // Names in it are handles: auto-translate would mangle them, and the rest is a short plain line.
  if (l.tone !== 'event') p.setAttribute('translate', 'no');
  return p;
}

/** The race line names the same margin as the place note (its first figure, "85 m"). */
function sameMargin(line: HTMLElement, note: HTMLElement): boolean {
  const fig = note.querySelector('.gs-num')?.textContent;
  return !!fig && (line.textContent ?? '').includes(fig);
}

/**
 * The next unlock, in the unlock card's slot when this run opened nothing: the next mountain with its
 * biome art under a lock and how many ghosts open it, else the next sled and the gifts to go. The bar
 * grows from where it stood before this run to where it stands now (reduced motion: it just shows).
 */
function nextUnlockCard(m: ResultsModel): HTMLElement | null {
  const u: ResultsNextUnlock | null | undefined = m.nextUnlock;
  if (!u) return null;
  let art: HTMLElement;
  let name: string;
  let what: HTMLElement;
  let said: string;
  let p: number;
  let p0: number;
  if (u.kind === 'mountain') {
    const sky = h('span', 'gs-mtn-sky');
    sky.innerHTML = biomeArt(u.biome);
    art = h('span', `gs-ul-art gs-nu-art b-${u.biome}`, sky, h('span', 'gs-nu-lock', icon('lock')));
    name = u.name;
    const have = Math.min(u.have, u.need);
    what = h('span', 'gs-nu-what', h('span', 'gs-num', `${fmt(have)} of ${fmt(u.need)}`), ' ghosts');
    said = `Next unlock: ${u.name}, ${fmt(have)} of ${fmt(u.need)} ghosts passed`;
    p = u.need > 0 ? have / u.need : 0;
    p0 = u.need > 0 ? Math.max(0, have - m.ghostsPassed) / u.need : 0;
  } else {
    const price = SLEDS.find((s) => s.name === u.name)?.price ?? 0;
    art = h('span', 'gs-nu-sled', icon('sledBold'));
    name = u.name;
    what =
      u.gifts > 0
        ? h('span', 'gs-nu-what', h('span', 'gs-num', fmt(u.gifts)), ' gifts to go')
        : h('span', 'gs-nu-what is-ready', 'Ready in the shop');
    said = u.gifts > 0 ? `Next unlock: ${u.name}, ${fmt(u.gifts)} gifts to go` : `Next unlock: ${u.name}, ready in the shop`;
    p = price > 0 ? Math.max(0, Math.min(1, (price - u.gifts) / price)) : 1;
    p0 = price > 0 ? Math.max(0, Math.min(p, (price - u.gifts - Math.max(0, m.giftsEarned)) / price)) : p;
  }
  const n = h('span', 'gs-ul-name gs-nu-name', name);
  n.setAttribute('translate', 'no');
  const bar = h('span', 'gs-nu-bar');
  bar.setAttribute('aria-hidden', 'true');
  bar.style.setProperty('--p', p.toFixed(3));
  bar.style.setProperty('--p0', p0.toFixed(3));
  const txt = h('span', 'gs-ul-txt gs-nu-txt', h('span', 'gs-nu-row', n, what), bar);
  txt.setAttribute('aria-hidden', 'true');
  const card = h('div', `gs-ul gs-nu is-${u.kind}`, art, txt, sr(said));
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', 'Next unlock');
  return h('div', 'gs-res-unlock', card);
}

const dist = (g: ResultsGhost): number => g.distance ?? 0;

/**
 * Where you finished. The race is decided by distance, the number every row shows: your place is one
 * more than the ghosts whose run went further than yours. Passed stamps are separate (ghosts you
 * overtook at some point), so a ghost you passed that kept going after your crash still ranks above.
 */
function finish(m: ResultsModel): { rank: number; of: number } | null {
  if (m.ghosts.length === 0) return null;
  let ahead = 0;
  for (const g of m.ghosts) if (dist(g) > m.distance) ahead++;
  return { rank: ahead + 1, of: m.ghosts.length + 1 };
}

/**
 * One line under the crash line, in the same terms as the order: how far short of the next place
 * you stopped, or how far clear of second you finished. Null when it would say nothing.
 */
function raceNote(m: ResultsModel): HTMLElement | null {
  let above = Infinity;
  let below = -Infinity;
  for (const g of m.ghosts) {
    const d = dist(g);
    if (d > m.distance) above = Math.min(above, d);
    else below = Math.max(below, d);
  }
  const place = finish(m);
  if (!place) return null;
  if (place.rank > 1) return h('p', 'gs-res-note', h('span', 'gs-num', metres(Math.max(1, above - m.distance))), ` short of ${ordinal(place.rank - 1)} place.`);
  const lead = m.distance - below;
  return Number.isFinite(lead) && lead >= 1 ? h('p', 'gs-res-note', h('span', 'gs-num', metres(lead)), ' clear of 2nd place.') : null;
}

/**
 * The finishing order: everyone by distance, furthest first, you among them. The ghosts below your
 * row are the ones you beat, so they (and only they) wear a Beat stamp. Rows outside the window
 * around yours are marked far and fold behind Show All, so the race reads as your next targets.
 */
function standings(m: ResultsModel): HTMLElement {
  const sorted = [...m.ghosts].sort((a, b) => dist(b) - dist(a));
  const n = sorted.length + 1;
  const long = m.ghosts.length > 6;
  const ol = h('ol', `gs-standings${long ? ' is-long' : ''}`);
  ol.setAttribute('aria-label', 'Finishing order by distance');
  // The two places above yours and the one below, slid to stay inside the list (first place shows
  // the three it beat). Folding a single row would cost as much as the link that opens it. Phones
  // keep three of those rows (is-far-p folds the fourth): the next place, you and the one you beat,
  // so your row stays in the first view under the stats line and the footer's offers.
  const youAt = sorted.filter((g) => dist(g) > m.distance).length;
  const windowed = n > WIN_ROWS + 1;
  const lo = Math.max(0, Math.min(youAt - WIN_ABOVE, n - WIN_ROWS));
  const windowedP = n > WIN_ROWS_PHONE + 1;
  const loP = Math.max(0, Math.min(youAt - 1, n - WIN_ROWS_PHONE));
  let i = 0;
  let stamp = 0;
  const add = (li: HTMLElement) => {
    if (windowed && (i < lo || i >= lo + WIN_ROWS)) li.classList.add('is-far');
    else if (windowedP && (i < loP || i >= loP + WIN_ROWS_PHONE)) li.classList.add('is-far-p');
    i++;
    ol.append(li);
  };
  const youRow = () => {
    const you = h('li', 'gs-st-row is-you', h('span', 'gs-st-rank gs-num', String(i + 1)), icon('rider', 'gs-st-ico'), h('span', 'gs-st-name', 'You'), h('span', 'gs-st-val gs-num', metres(m.distance)));
    you.setAttribute('aria-current', 'true');
    add(you);
  };
  for (let k = 0; k < sorted.length; k++) {
    if (k === youAt) youRow();
    const beat = k >= youAt;
    const row = ghostRow(sorted[k], i + 1, beat ? stamp++ : -1);
    // The place right above yours is the one to chase next: a quiet outlined tag in the stamp column.
    if (k === youAt - 1) {
      row.classList.add('is-next');
      row.append(h('span', 'gs-st-next', 'Next', sr(' place to beat')));
    }
    add(row);
  }
  if (youAt === sorted.length) youRow();
  return ol;
}

/**
 * One ghost's row. A ghost you beat wears its kind colour and a Beat stamp; the stamp has a column
 * of its own after the distance (every row keeps it, stamped or not), so it never lands on a number.
 */
function ghostRow(g: ResultsGhost, rank: number, beatOrder: number): HTMLElement {
  // Your own best run reads as that, not as your player name repeated in a list of rivals.
  // The friend whose challenge this was wears a small vs badge, like their pill in the race; the name
  // ellipsizes before the badge does.
  const name =
    g.kind === 'friend'
      ? h('span', 'gs-st-name has-vs', h('span', 'gs-st-nm', g.name), h('span', 'gs-st-vs', 'vs'), sr(', challenge'))
      : h('span', 'gs-st-name', g.kind === 'you' ? 'Your best' : g.name);
  if (g.kind !== 'you') name.setAttribute('translate', 'no');
  const beat = beatOrder >= 0;
  const li = h(
    'li',
    `gs-st-row ${kindCls(g.kind)}${beat ? ' is-beat' : ''}${g.kind === 'friend' ? ' is-friend' : ''}`,
    h('span', 'gs-st-rank gs-num', String(rank)),
    icon('ghost', 'gs-st-ico'),
    name,
    h('span', 'gs-st-val gs-num', metres(dist(g))),
  );
  if (beat) {
    const s = h('span', 'gs-st-stamp', 'Beat');
    s.style.setProperty('--i', String(beatOrder));
    li.append(s);
  }
  return li;
}

/** A glyph for the crash line: from the crash kind, or read from the cause text without one. */
function causeIcon(m: ResultsModel): IconName {
  switch (m.crashKind) {
    case 'tree':
    case 'forest':
      return 'pine';
    case 'rock':
      return 'rock';
    case 'yeti':
      return 'yeti';
    case 'avalanche':
      return 'avalanche';
    case 'landing':
    case 'daylight':
      return 'impact';
  }
  const c = m.crashCause.toLowerCase();
  if (/tree|pine|forest|spruce/.test(c)) return 'pine';
  if (/rock|boulder|stone/.test(c)) return 'rock';
  if (c.includes('yeti')) return 'yeti';
  if (c.includes('avalanche')) return 'avalanche';
  return 'impact';
}
