import type { MedalSet, ResultsGhost, ResultsModel, UIHandlers } from './contract';
import type { InputMode } from '../game/input';
import { type Standing, aheadOf, byStanding, clock, splitGap } from '../game/standing';
import { SLEDS } from '../sim/sleds';
import { h, kbd, Layer, padBtn, type Ctx } from './dom';
import { fmt, metres, NBSP, ordinal, progFigures, seconds } from './fmt';
import { b9, closeTopSheet, ico9, medalDisc, openSheet, sheetFrame, topSheet } from './kit9';
import { reduced } from './motion';
import { Story, eventMedal, storyButton } from './sequence';
import { curly, nb, prize } from './words';
import './meta.css';
import './screens.css';
import './story.css';

// Results (round 9, U2): the story over the scene (sequence.ts: how you did, the one reward, the one button), and
// Details one level down, a sheet from the column's side with everything else: the race in its order, your run
// stage by stage, what it paid point by point (the XP it lists adds up to the total it says), the missions, and
// keeping the run (Watch Your Run, Save Clip, Challenge a Friend). A tap or any key lands the story; Escape,
// Backspace, the pad's B and its own Back close Details and give focus back to Details.

/**
 * The results' sound timeline (ms after they open), which the app's cues are scheduled on (audio/cues.ts
 * resultsCues). Round 9's story plays only the place's stamp from it (PLACE_MS, as the place's word lands at 260 ms);
 * the bar's ticks, the page's stamp, the card's mallet and the missions' chimes and coins follow the story's beats
 * (onResultsBeat, onMissionStamp, onRewardLanded). The other steps are kept for a reduced-motion card, which plays its
 * one chime and one coin from them.
 */
export const RESULTS_TIMING = {
  COUNT_MS: 650,
  PLACE_MS: 300,
  NEW_BEST_MS: 560,
  BEAT_MS: 860,
  BEAT_STEP: 110,
  DONE_MS: 1050,
  DONE_STEP: 140,
  FLY_MS: 1470,
  FLY_STEP: 140,
  FLY_DUR: 680,
  SUB_MS: 440,
  UNLOCK_MS: 480,
  METER_MS: 760,
  METER_DUR: 620,
} as const;

/** A finished mission's coin follows its chime by this much, and each next one this much later. */
const COIN_LEAD_MS = 300;
const COIN_STEP_MS = 140;
/** Challenge is answered by a toast, not by updateResults: it re-arms after this long. */
const CHAL_LOCK_MS = 1500;
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;

export interface ResultsHooks {
  /** The garage, opened the way the title opens it (a sled ready in it, from Details), at a piece when given
   *  ('sled:2', nextUnlock's piece). */
  openGarage(piece?: string): void;
}

export class Results {
  readonly layer: Layer;
  private readonly el: HTMLElement;
  private prev: ResultsModel | null = null;
  private story: Story | null = null;
  private det: { el: HTMLElement; close: () => void } | null = null;
  /** Round 9 (U4): Details' Watch Your Run or Save Clip was pressed (its focus key): the reel hides the results, and
   *  they come back to Details. */
  private backTo: string | null = null;
  /** Offers waiting on the game's answer, and offers pressed on these results (a withdrawn one keeps its slot). */
  private pending = new Set<string>();
  private pressed = new Set<string>();
  private timers: number[] = [];
  /** Mission rows whose chime and coin have been asked for on these results (each once). */
  private readonly stamped = new Set<number>();
  private readonly landedRows = new Set<number>();
  inputMode: InputMode = 'keyboard';

  constructor(
    parent: HTMLElement,
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
    private readonly hooks: ResultsHooks,
  ) {
    this.el = h('div', 'gs-results gs9-results');
    this.layer = new Layer(this.el, 200);
    parent.append(this.el);
    // A tap anywhere but on a control, or any key, lands the story whole (the key still does what it does: Space is
    // the game's Run Again once the results have been up 700 ms).
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.layer.open || !this.story?.playing) return;
      if (e.target instanceof Element && e.target.closest('button')) return;
      this.skip();
    });
    window.addEventListener(
      'keydown',
      () => {
        if (this.layer.open && this.story?.playing) this.skip();
      },
      { capture: true },
    );
  }

  /** Details is up (one level down). */
  get detailsOpen(): boolean {
    return this.det !== null;
  }

  /** The story lands at its end at once (a tap or a key), and focus goes to the one button. */
  private skip(): void {
    this.story?.finish();
    this.focusDefault();
  }

  show(m: ResultsModel): void {
    // (Round 9, U4: back from the reel or a clip asked for in Details, the same results come back landed, with Details
    // open again and focus on what was pressed: one Escape skipped the reel and did nothing else.)
    const back = this.backTo && m === this.prev ? this.backTo : null;
    this.backTo = null;
    this.prev = null;
    this.stamped.clear();
    this.landedRows.clear();
    this.pending.clear();
    if (!back) this.pressed.clear();
    this.closeDetails();
    this.render(m, true);
    this.layer.show();
    if (back) {
      this.story?.finish();
      this.openDetails(false);
      this.det?.el.querySelector<HTMLElement>(`[data-fk="${back}"]`)?.focus({ preventScroll: true });
      return;
    }
    this.story?.play();
    this.focusDefault();
  }

  update(m: ResultsModel): void {
    if (!this.layer.open) return;
    const fk = document.activeElement instanceof HTMLElement && this.el.contains(document.activeElement) ? (document.activeElement.dataset.fk ?? null) : null;
    const wasDetails = this.det !== null;
    const scroll = this.det?.el.querySelector<HTMLElement>('.gs9-sheet-body')?.scrollTop ?? 0;
    this.pending.clear();
    if (wasDetails) this.closeDetails(false);
    this.render(m, false);
    if (wasDetails) {
      this.openDetails(false);
      const body = this.det?.el.querySelector<HTMLElement>('.gs9-sheet-body');
      if (body) body.scrollTop = scroll;
    }
    const back = fk ? this.el.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`) : null;
    if (back) back.focus({ preventScroll: true });
    else this.focusDefault();
  }

  /** Scrolls Details for a scroll key pressed inside the results. The UI root never lets those keys through: Up and
   *  Down are also the game's action keys, which would start the next run here. */
  scrollKey(code: string): void {
    const body = this.det?.el.querySelector<HTMLElement>('.gs9-sheet-body');
    if (!body || body.scrollHeight <= body.clientHeight) return;
    const page = body.clientHeight * 0.85;
    const by = code === 'ArrowDown' ? 60 : code === 'ArrowUp' ? -60 : code === 'PageDown' ? page : code === 'PageUp' ? -page : 0;
    const behavior = reduced() ? 'auto' : 'smooth';
    if (code === 'Home') body.scrollTo({ top: 0, behavior });
    else if (code === 'End') body.scrollTo({ top: body.scrollHeight, behavior });
    else body.scrollBy({ top: by, behavior });
  }

  hide(): void {
    this.story?.dispose();
    this.clearTimers();
    this.closeDetails(false);
    this.layer.hide();
  }

  /** Keyboard players land on the one button once it has come forward (the story itself until then, so no ring
   *  stands round a button not yet drawn); pointer and touch players on the story, where a reader starts. */
  private focusDefault(): void {
    if (this.det) return;
    const s = this.story;
    if (!s) return;
    (this.inputMode === 'keyboard' && !s.playing ? s.again : s.el).focus({ preventScroll: true });
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
  }

  /** The run's finished missions are paid as the bar starts to fill: each one's chime, then its coin (the app plays
   *  them in landing order, once each; under reduced motion it plays the one chime and coin itself). */
  private pay(m: ResultsModel): void {
    let k = 0;
    m.missions.forEach((mv, i) => {
      if (!mv.justCompleted || this.stamped.has(i)) return;
      this.stamped.add(i);
      this.hd.onMissionStamp?.(i);
      if (mv.reward > 0 && !this.landedRows.has(i)) {
        this.landedRows.add(i);
        this.timers.push(window.setTimeout(() => this.hd.onRewardLanded?.(i), COIN_LEAD_MS + k++ * COIN_STEP_MS));
      }
    });
  }

  private render(m: ResultsModel, intro: boolean): void {
    this.clearTimers();
    this.prev = m;
    this.story?.dispose();
    const offers: HTMLElement[] = [];
    // (Rewarded ads are dormant in the published build, which has none; the dev server's mock platform still offers
    // them, and they ride in the story's foot.)
    if (m.canRevive) offers.push(this.rewarded('revive', 'video', 'Revive', true, () => this.hd.onRevive()));
    else if (this.pressed.has('revive')) offers.push(this.spent('revive', 'Revive Used'));
    if (m.canDouble && !m.doubled) offers.push(this.rewarded('double', 'video', 'Double Gifts', true, () => this.hd.onDouble()));
    else if (this.pressed.has('double')) offers.push(this.spent('double', m.doubled ? 'Gifts Doubled' : 'No Ad Right Now'));
    const story = new Story(
      m,
      this.ctx,
      this.inputMode,
      {
        again: () => this.hd.onRunAgain(),
        home: () => this.hd.onHome(),
        details: () => this.openDetails(true),
        beat: (kind, i) => this.hd.onResultsBeat?.(kind, i),
        paid: () => this.pay(m),
        photo: this.hd.onPhoto ? () => this.hd.onPhoto?.() : undefined,
        sendBack: m.canChallenge && m.sendItBack === true ? () => this.hd.onChallenge() : undefined,
      },
      offers,
    );
    this.story = story;
    story.el.tabIndex = -1;
    story.el.setAttribute('role', 'dialog');
    story.el.setAttribute('aria-modal', 'true');
    story.el.setAttribute('aria-label', 'Run results');
    if (!intro) story.finish();
    this.el.replaceChildren(story.el);
    // A mirrored run's picture is turned over (the canvas at scaleX(-1), world.ts), so its results shot stands the rider
    // on the other side: the moment and the column change sides with it, and the rider stays the picture.
    this.el.classList.toggle('is-flipped', (document.querySelector('canvas')?.style.transform ?? '').includes('scaleX(-1)'));
    this.el.dataset.view = 'story';
  }

  // ---------------------------------------------------------------- Details

  private openDetails(fresh: boolean): void {
    const m = this.prev;
    if (!m || this.det) return;
    this.story?.finish();
    const from = this.el.querySelector<HTMLElement>('[data-fk="details"]');
    let close = (): void => {};
    const f = sheetFrame(this.ctx, { cls: 'gs9-det is-right', title: 'Details', close: 'Back', closeIcon: 'back', fk: 'close-details', onClose: () => close() });
    detailsBody(f.body, m, this.ctx, this.hd, {
      mode: this.inputMode,
      garage: (piece) => this.hooks.openGarage(piece),
      watch: this.hd.onWatchReel
        ? () => {
            this.backTo = 'reel';
            this.hd.onWatchReel?.();
          }
        : null,
      clip: this.hd.onSaveClip
        ? () => {
            this.backTo = 'clip';
            this.hd.onSaveClip?.();
          }
        : null,
      challenge: m.canChallenge ? this.rewarded('challenge', 'link', m.sendItBack ? 'Send It Back' : 'Challenge a Friend', false, () => this.hd.onChallenge()) : null,
      swap: m.spine?.swap && this.hd.onSwapMission ? m.spine.swap : null,
      swapped: this.pressed.has('swap'),
      onSwap: (id) => {
        this.pressed.add('swap');
        this.hd.onSwapMission?.(id);
      },
    });
    if (!fresh) f.el.classList.add('is-static');
    this.el.append(f.el);
    this.el.dataset.view = 'details';
    const shut = openSheet(f.el, from, this.story ? [this.story.el] : [], () => {
      f.el.remove();
      this.det = null;
      this.el.dataset.view = 'story';
    });
    close = shut;
    this.det = { el: f.el, close: shut };
  }

  /** Closes Details (Escape, Backspace, B and its Back go through the sheet stack: ui.ts). */
  closeDetails(focusBack = true): void {
    const d = this.det;
    if (!d) return;
    if (focusBack && topSheet() === d.el) closeTopSheet();
    else d.close();
  }

  /**
   * An optional offer. One press per offer until the game answers with updateResults; Challenge, answered by a toast,
   * re-arms after a moment. A pressed offer is aria-disabled, never `disabled`, so focus never drops to the page (and
   * then onto Run Again, where the next Space would start a run).
   */
  private rewarded(key: string, ic: 'video' | 'link', label: string, ad: boolean, run: () => void): HTMLButtonElement {
    const words = h('span', 'gs9-b-t', ad ? h('span', 'gs9-opt-pre', 'Watch Ad: ') : null, label);
    const b = b9(this.ctx, 'secondary', words, {
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
    });
    b.addEventListener(
      'click',
      (e) => {
        if (this.pending.has(key)) e.stopImmediatePropagation();
      },
      { capture: true },
    );
    const idle = [...words.childNodes];
    const busy = (on: boolean): void => {
      if (on) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
      b.setAttribute('aria-busy', String(on && ad));
      if (ad) words.replaceChildren(...(on ? ['Loading…'] : idle));
    };
    if (this.pending.has(key)) busy(true);
    return b;
  }

  /** A withdrawn offer's slot: a quiet status with the offer's focus key, inert but focusable. */
  private spent(key: string, label: string): HTMLButtonElement {
    const b = b9(this.ctx, 'quiet', label, { icon: 'check', fk: key, onClick: () => undefined });
    b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', (e) => e.stopImmediatePropagation(), { capture: true });
    return b;
  }
}

// ---------------------------------------------------------------- Details' body

interface DetailsActs {
  mode: InputMode;
  garage(piece?: string): void;
  watch: (() => void) | null;
  clip: (() => void) | null;
  challenge: HTMLButtonElement | null;
  swap: { id: string; text: string } | null;
  swapped: boolean;
  onSwap(id: string): void;
}

const youAt = (m: ResultsModel): Standing => ({ time: m.finish?.seconds ?? null, distance: m.distance });
const ghostAt = (g: ResultsGhost): Standing => ({ time: g.time ?? null, distance: g.distance ?? 0 });

/** A section of Details: its small caps heading, then its rows. */
function section(title: string, ...kids: Array<Node | null>): HTMLElement {
  return h('section', 'gs9-det-sec', h('h3', 'gs9-det-h', title), ...kids);
}

/** One row: its words, and its figure with its word at the far end. */
function row(t: Node | string | Array<Node | string | null>, v: Node | string | null, cls = ''): HTMLLIElement {
  return h('li', `gs9-row${cls ? ` ${cls}` : ''}`, h('span', 'gs9-row-t', ...(Array.isArray(t) ? t : [t])), v !== null ? h('span', 'gs9-row-v gs9-num', v) : null);
}

/** A row of medals in words: "Stage 1 gold, whole run bronze", only what you hold. */
function medalWords(m: MedalSet): string {
  const parts = m.stages.flatMap((x, i) => (x > 0 ? [`stage ${i + 1} ${MEDAL[x].toLowerCase()}`] : []));
  if (m.run > 0) parts.push(`whole run ${MEDAL[m.run].toLowerCase()}`);
  return parts.length > 0 ? parts.join(', ').replace(/^./, (c) => c.toUpperCase()) : 'None yet';
}

function detailsBody(body: HTMLElement, m: ResultsModel, ctx: Ctx, hd: UIHandlers, acts: DetailsActs): void {
  const fin = m.finish ?? null;
  // The race: the finishing order, you in it; what was said, and why the place is not the one you fell in.
  if (m.ghosts.length > 0) {
    const me = youAt(m);
    const order = [...m.ghosts].sort((a, b) => byStanding(ghostAt(a), ghostAt(b)));
    const list = h('ol', 'gs9-list gs9-order');
    list.setAttribute('aria-label', 'Finishing order');
    let i = 1;
    const fig = (s: Standing): string => (s.time !== null ? clock(s.time) : metres(s.distance));
    const add = (name: string, s: Standing, cls: string): void => {
      const n = h('span', '', name);
      if (cls !== 'is-you') n.setAttribute('translate', 'no');
      const li = row([h('span', 'gs9-order-n gs9-num', String(i++)), n], fig(s), cls);
      if (cls === 'is-you') li.setAttribute('aria-current', 'true');
      list.append(li);
    };
    let mine = false;
    for (const g of order) {
      if (!mine && !aheadOf(ghostAt(g), me)) {
        add('You', me, 'is-you');
        mine = true;
      }
      add(g.kind === 'you' ? 'Your best' : g.name, ghostAt(g), g.kind === 'grudge' ? 'is-grudge' : g.kind === 'you' ? 'is-best' : 'is-ghost');
    }
    if (!mine) add('You', me, 'is-you');
    const notes: string[] = [];
    const q = m.twelve?.rider && m.twelve.says ? { name: m.twelve.rider.name, text: m.twelve.says } : m.quote ? { name: m.quote.name, text: m.quote.text } : null;
    if (q) notes.push(`“${q.text}” ${q.name}`);
    // (The Daily's, the Cup's and the Trial's medal lines are beat one's words and the button's reason already.)
    if (m.raceLine && m.raceLine.text !== m.crashNote && !/^(Daily|Cup|Trial):/.test(m.raceLine.text) && m.raceLine.tone !== 'event') notes.push(m.raceLine.text);
    if (m.crashNote) notes.push(m.crashNote);
    if (m.stages?.line && !notes.includes(m.stages.line)) notes.push(m.stages.line);
    body.append(section('The Race', list, ...notes.map((n) => notP(n))));
  }

  // Your run: the clock at each stage line against your best, and what it did worth naming.
  const run = h('ul', 'gs9-list');
  for (const s of fin?.splits ?? []) {
    const g = s.vsBest === null ? null : splitGap(s.seconds, s.vsBest);
    const vs = s.vsBest === null ? '' : g === null ? ', level with your best' : `, ${nb(g)} ${s.vsBest < 0 ? 'ahead of' : 'behind'} your best`;
    run.append(row(s.name, `${clock(s.seconds)}${vs}`));
  }
  if (!fin) run.append(row(m.crashCause || 'Wiped out', `${metres(m.distance)} down`));
  const em = eventMedal(m);
  if (fin && fin.medal > 0 && !m.trial && !em) run.append(row('Medal for your time', h('span', '', medalDisc(fin.medal), ` ${MEDAL[fin.medal]}`)));
  const rec = new Set(m.records ?? []);
  const said = (v: string, k: 'bestCombo' | 'perfects' | 'maxAir'): string => (rec.has(k) ? `${v}, a record` : v);
  run.append(row('Style score', fmt(m.score)));
  if (m.bestCombo >= 1000) run.append(row('Best combo', said(`${fmt(m.bestCombo)} points`, 'bestCombo')));
  if (m.perfects > 0) run.append(row('Perfect landings', said(fmt(m.perfects), 'perfects')));
  if ((m.bestStreak ?? 0) >= 3) run.append(row('Stomp streak', fmt(m.bestStreak ?? 0)));
  if (m.maxAir >= 1.5) run.append(row('Longest air', said(seconds(m.maxAir), 'maxAir')));
  const lad = m.ladder;
  if (lad) {
    const place = lad.top ? 'Top of the ladder' : lad.rank !== null ? `${ordinal(lad.rank)} of ${lad.of}${lad.up > 0 ? `, up ${lad.up}` : ''}` : 'Not on it yet';
    run.append(row(`The ${m.mountain} ladder`, place));
    if (lad.moment) run.append(row(curly(lad.moment), lad.gifts > 0 ? `${fmt(lad.gifts)} gifts` : null));
    run.append(row('Medals held here', medalWords(lad.medals)));
  }
  if (m.mastery) run.append(row('Mastery', `${m.mastery.got} of ${m.mastery.of} stars${m.mastery.fresh.length ? `, ${m.mastery.fresh.length} new` : ''}`));
  body.append(section('Your Run', run));

  // What it paid: every point of XP (the total is the sum of the rows above it), the gifts, and all that opened.
  const sp = m.spine ?? null;
  const paid = h('ul', 'gs9-list');
  if (sp) {
    const total = sp.ticks.reduce((s, t) => s + t.xp, 0);
    for (const t of sp.ticks) paid.append(row(t.label, `${fmt(t.xp)}${NBSP}XP`));
    paid.append(row(h('b', '', `Rider Rank ${sp.after.page}`), `${fmt(total)}${NBSP}XP this run`, 'is-total'));
  }
  paid.append(row('Gifts', `${fmt(m.giftsEarned)} this run${m.doubled ? ', doubled' : ''}, ${fmt(m.wallet)} to spend`));
  const lines: Array<Node> = [];
  const opened = [...(m.unlockedMountains ?? []).map((u) => u.name), ...(sp?.opened ?? []).filter((r) => r.kind !== 'open').map((r) => prize(r))];
  if (opened.length) lines.push(notP(`Opened: ${opened.join(', ')}.`));
  if (sp?.stickers.length) lines.push(notP(`${sp.stickers.length} ${sp.stickers.length === 1 ? 'sticker' : 'stickers'} for the album: ${sp.stickers.slice(0, 3).map((s) => s.name).join(', ')}${sp.stickers.length > 3 ? ' and more' : ''}.`));
  if (sp?.contracts.met.length) lines.push(notP(`${sp.contracts.met.length === 1 ? 'Contract' : 'Contracts'} met: ${sp.contracts.met.join(', ')}${sp.contracts.bonus ? ', and all three today' : ''}.`));
  if (sp?.contracts.form) lines.push(notP(`Your form: ${sp.contracts.form}.`));
  if (sp?.league && sp.league.place !== null) lines.push(notP(`Your Cup league: ${ordinal(sp.league.place)} in division ${sp.league.division}${sp.league.was !== null && sp.league.was !== sp.league.place ? `, was ${ordinal(sp.league.was)}` : ''}.`));
  if (sp?.flame.lit) lines.push(notP(`Day ${sp.flame.streak} of your flame${sp.flame.emberEarned ? ', and an ember: it keeps the flame through one missed day' : ''}.`));
  // The next unlock, and the way into the garage when a sled is ready there.
  const u = m.nextUnlock ?? null;
  if (u?.kind === 'mountain') lines.push(notP(`${u.name} opens at ${fmt(u.need)} ghosts passed: you have ${fmt(Math.min(u.have, u.need))}.`));
  else if (u?.kind === 'sled') {
    // (The garage's price, which nextUnlock carries since the shop lane; sim/sleds.ts keeps an older one.)
    const price = u.price ?? SLEDS.find((s) => s.name === u.name)?.price ?? 0;
    if (u.gifts > 0) lines.push(notP(`The ${u.name}: ${fmt(u.gifts)} gifts to go${price ? ` of ${fmt(price)}` : ''}.`));
    else lines.push(h('div', 'gs9-det-act', notP(`The ${u.name} is ready in the garage.`), b9(ctx, 'secondary', 'Open the Garage', { icon: 'sledBold', fk: 'det-garage', aria: `Open the garage at the ${u.name}`, onClick: () => acts.garage(u.piece) })));
  }
  body.append(section('What It Paid', paid, ...lines));

  // The missions, each with its progress in words.
  if (m.missions.length > 0) {
    const mis = h('ul', 'gs9-list');
    for (const mv of m.missions) {
      const [v, t] = progFigures(Math.min(mv.progress, mv.target), mv.target, mv.dp);
      const li = row([h('span', 'gs9-check', mv.done ? ico9('check') : null), mv.text], mv.done ? (mv.justCompleted ? `Done this run, ${fmt(mv.reward)} gifts` : 'Done') : `${v} of ${t}`, mv.done ? 'is-done' : '');
      mis.append(li);
    }
    const swap = acts.swap;
    const sw = swap ? b9(ctx, 'quiet', 'Swap Mission', { icon: 'flag', fk: 'swap', aria: `Swap the mission: ${swap.text}`, onClick: () => acts.onSwap(swap.id) }) : acts.swapped ? notP('Mission swapped.') : null;
    body.append(section('Missions', mis, sw));
  }

  // Keep this run: the reel, the clip, the link; and a wreck's ride home.
  const keep = h(
    'div',
    'gs9-det-acts',
    acts.watch ? b9(ctx, 'secondary', 'Watch Your Run', { icon: 'video', fk: 'reel', onClick: () => acts.watch?.() }) : null,
    acts.clip ? b9(ctx, 'secondary', 'Save Clip', { icon: 'clip', fk: 'clip', onClick: () => acts.clip?.() }) : null,
    acts.challenge,
    m.canRideHome ? b9(ctx, 'secondary', 'Ride Home as a Spirit', { icon: 'ghost', fk: 'homeward', onClick: () => hd.onRideHome?.() }) : null,
  );
  if (keep.childElementCount > 0) body.append(section('Keep This Run', keep));

  // And the same one button at its foot, so Details never has to be closed to ride.
  const bw = storyButton(m);
  const t = h('span', 'gs9-go-t', h('span', 'gs9-go-v', bw.label), bw.why ? h('span', 'gs9-go-why', bw.why) : null);
  t.querySelector('.gs9-go-v')?.setAttribute('translate', 'no');
  const key = acts.mode === 'touch' ? null : acts.mode === 'gamepad' ? padBtn('A') : kbd('Space');
  key?.setAttribute('aria-hidden', 'true');
  const again = b9(ctx, 'primary', [t, key], { icon: 'play', fk: 'again-det', sound: 'confirm', gameKey: true, aria: bw.aria, cls: `gs9-go${[...bw.label].length > 18 ? ' is-long' : ''}`, onClick: () => hd.onRunAgain() });
  if (key) again.setAttribute('aria-keyshortcuts', 'Space');
  body.append(h('div', 'gs9-det-go', again));
}

const notP = (t: string): HTMLParagraphElement => {
  const p = h('p', 'gs9-det-p', t);
  p.setAttribute('translate', 'no');
  return p;
};
