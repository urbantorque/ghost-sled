import type { MissionView, SettingsModel, SledCard, UIHandlers } from './contract';
import { sledById } from '../sim/sleds';
import { sledArt, sledTint } from './art';
import { btn, captureFocus, h, kbd, Layer, restoreFocus, sr, type Ctx } from './dom';
import { fmt, percent } from './fmt';
import { icon } from './icons';
import { SettingsPanel } from './settings';
import { missionList } from './title';

// Pause overlay (Resume, the run's missions, inline settings, Home) and the two sheets: Sleds and
// Settings.
// Escape is deliberately not bound: on CrazyGames it exits fullscreen. The game maps P to pause.
// The Sleds sheet is a shop: a large preview of the picked sled (rider seated, what it does in one
// plain line, its trade-offs as plus and minus bars, the one action) beside a grid of tiles that
// pick what the preview shows. The sleds are renders of the real in-game meshes when the game hands
// over a portrait source; without one they fall back to the flat vector art.

/** The sim's clean-landing yaw window in radians: a sled's landTol widens it. */
const LAND_WINDOW = 0.62;
/** The pause card shows at most this many missions (the save keeps three active). */
const PAUSE_MISSIONS = 3;

/**
 * The preview's backdrop, painted like the game's own Pinecrest dusk rather than card clip art: the
 * graded sky (zenith blue through mauve to a peach horizon), a low sun with a white core, a pale gold
 * rim and a soft warm corona (no ring), and two ridge layers that pale with distance. The snow mound
 * the sled stands on is the stage's own ::after.
 */
const STAGE_SVG =
  '<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">' +
  '<defs>' +
  '<linearGradient id="gs-stg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F5CA8"/><stop offset="0.36" stop-color="#8E7DB4"/><stop offset="0.66" stop-color="#D49FB5"/><stop offset="0.82" stop-color="#F3B3A6"/></linearGradient>' +
  '<radialGradient id="gs-stg-sun"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.15" stop-color="#FFFBF2"/><stop offset="0.2" stop-color="#FFE3B0"/><stop offset="0.27" stop-color="#FFD3A8" stop-opacity="0.72"/><stop offset="0.55" stop-color="#FFBF98" stop-opacity="0.26"/><stop offset="1" stop-color="#FFB38A" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="gs-stg-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C69DB4"/><stop offset="1" stop-color="#E2B4B8"/></linearGradient>' +
  '<linearGradient id="gs-stg-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C7FAE"/><stop offset="1" stop-color="#B796B8"/></linearGradient>' +
  '</defs>' +
  '<rect width="400" height="200" fill="url(#gs-stg-sky)"/>' +
  '<circle cx="84" cy="98" r="76" fill="url(#gs-stg-sun)"/>' +
  '<path fill="url(#gs-stg-far)" d="M0 121l26-9 22 5 30-19 24 11 30-8 36 15 40-23 34 15 32-9 40 17 36-14 50 10v89H0z"/>' +
  '<path fill="url(#gs-stg-near)" d="M0 138l34-14 30 9 38-17 30 13 34-7 40 14 42-19 30 13 38-12 44 20 40-9v84H0z"/>' +
  '</svg>';

/**
 * Each tile's own stage, so six sleds never read as six copies of one card: its sky (zenith, middle,
 * horizon), the glow low behind the sled and the card's rim. Cool for the Wisp and the saucer, warm
 * for the Lodge Toboggan, comet violet for the Comet Bob, silver for the Tea Tray; the Pine Flyer
 * keeps the preview's own dusk. Every tile stands on the same periwinkle drift.
 */
const TILE_LOOK: Record<number, { sky: [string, string, string]; glow: string; rim: string }> = {
  0: { sky: ['#34418C', '#5B5CA3', '#B88FAE'], glow: '#E8B88C', rim: 'rgba(232, 184, 140, 0.34)' },
  1: { sky: ['#243F8E', '#4B66B4', '#A3A8D6'], glow: '#7FB6F4', rim: 'rgba(127, 182, 244, 0.38)' },
  2: { sky: ['#3B3A86', '#80609E', '#E3A08E'], glow: '#F5A766', rim: 'rgba(245, 167, 102, 0.4)' },
  3: { sky: ['#221A5C', '#4E3A9A', '#A57CC8'], glow: '#B48CFF', rim: 'rgba(180, 140, 255, 0.42)' },
  4: { sky: ['#1E4378', '#336E9E', '#86BBD4'], glow: '#8FE8F0', rim: 'rgba(143, 232, 240, 0.36)' },
  5: { sky: ['#2E3966', '#56628A', '#A6A9C2'], glow: '#D8DEEA', rim: 'rgba(216, 222, 234, 0.32)' },
};

/** Renders a sled's portrait (World.sledPortrait): an image URL, or null when it cannot. */
export type SledPortraitSource = (id: number, seated: boolean) => Promise<string | null>;

let portraitSource: SledPortraitSource | null = null;
/** Portraits already drawn this session, by "id:seated", so a re-render shows them at once. */
const portraitUrls = new Map<string, string>();

/**
 * Hands the shop the game's portrait renderer (src/game/app.ts calls this once with
 * `(id, seated) => world.sledPortrait(id, seated)`). Until then the shop draws the vector art.
 */
export function setSledPortraits(src: SledPortraitSource | null): void {
  portraitSource = src;
}

/**
 * Draws the shop's portraits ahead of time (the seated preview of `seated`, then every tile), one
 * at a time while `ok()` holds, so a first visit to the shop opens with its pictures in rather than
 * fading them in over most of a second. Whatever is left when `ok()` fails is drawn on demand.
 */
export function prewarmSledPortraits(ids: readonly number[], seated: number, ok: () => boolean): void {
  const src = portraitSource;
  if (!src) return;
  const jobs: [number, boolean][] = [[seated, true], ...ids.map((id): [number, boolean] => [id, false])];
  let chain = Promise.resolve();
  for (const [id, s] of jobs) {
    const key = `${id}:${s ? 1 : 0}`;
    chain = chain.then(() => {
      if (portraitUrls.has(key) || !ok()) return;
      return src(id, s)
        .then((url) => {
          if (url) portraitUrls.set(key, url);
        })
        .catch(() => undefined);
    });
  }
}

interface StatRow {
  label: string;
  pct: number;
}

/** A sled's trade-offs against the baseline sled, read from the sim's own multipliers. */
function sledStats(id: number): StatRow[] {
  const d = sledById(id);
  const rows: StatRow[] = [
    // Drag scales top speed by 1 / sqrt(drag).
    { label: 'Top speed', pct: (1 / Math.sqrt(d.drag) - 1) * 100 },
    { label: 'Spin', pct: (d.spin - 1) * 100 },
    { label: 'Flip', pct: (d.flip - 1) * 100 },
    { label: 'Landing', pct: (d.landTol / LAND_WINDOW) * 100 },
    { label: 'Grip', pct: (d.grip - 1) * 100 },
    { label: 'Turning', pct: (d.turn - 1) * 100 },
    { label: 'Drift charge', pct: (d.driftCharge - 1) * 100 },
    { label: 'Slipstream', pct: (d.draft - 1) * 100 },
    { label: 'Gift pull', pct: (d.magnet - 1) * 100 },
    { label: 'Combo time', pct: (d.comboWindow - 1) * 100 },
    { label: 'Pop', pct: (d.pop - 1) * 100 },
  ];
  return rows.filter((r) => Math.abs(r.pct) >= 0.5).sort((a, b) => b.pct - a.pct);
}

/** Each trade-off in plain words, for the one-line effect: [gain, loss], given whole percent points. */
const EFFECT: Record<string, [(p: number) => string, (p: number) => string]> = {
  'Top speed': [(p) => `${p}% higher top speed`, (p) => `${p}% lower top speed`],
  Spin: [(p) => `spins ${p}% faster`, (p) => `spins ${p}% slower`],
  Flip: [(p) => `flips ${p}% faster`, (p) => `flips ${p}% slower`],
  Landing: [(p) => `landings ${p}% more forgiving`, (p) => `landings ${p}% stricter`],
  Grip: [(p) => `${p}% more grip`, (p) => `${p}% less grip`],
  Turning: [(p) => `turns ${p}% sharper`, (p) => `turns ${p}% slower`],
  'Drift charge': [(p) => `drifts charge ${p}% faster`, (p) => `drifts charge ${p}% slower`],
  Slipstream: [(p) => `drafts ${p}% stronger`, (p) => `drafts ${p}% weaker`],
  'Gift pull': [(p) => `${p}% stronger gift pull`, (p) => `${p}% weaker gift pull`],
  'Combo time': [(p) => `combos last ${p}% longer`, (p) => `combos last ${p}% shorter`],
  Pop: [(p) => `${p}% higher pop`, (p) => `${p}% lower pop`],
};

/** What a sled does, in one plain sentence built from the sim's own numbers. */
function sledEffect(stats: StatRow[]): string {
  if (stats.length === 0) return 'The all-rounder: no bonus, no catch.';
  const say = (r: StatRow) => {
    const f = EFFECT[r.label];
    const p = Math.round(Math.abs(r.pct));
    return f ? f[r.pct > 0 ? 0 : 1](p) : `${r.label.toLowerCase()} ${r.pct > 0 ? '+' : '-'}${p}%`;
  };
  const ups = stats.filter((r) => r.pct > 0).map(say);
  const downs = stats.filter((r) => r.pct < 0).map(say);
  const s = ups.length > 0 ? ups.join(', ') + (downs.length > 0 ? ', but ' + downs.join(', ') : '') : downs.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

/** One trade-off: sign badge, label, a bar around the baseline tick, and the signed percentage. */
function statRow(r: StatRow): HTMLElement {
  const up = r.pct > 0;
  const v = Math.round(r.pct);
  // Deltas are small (3 to 30%), so the bar scales them up around the halfway baseline, with a floor
  // so a 3% change still reads as a bar rather than a dot.
  const span = Math.min(46, Math.max(7, Math.abs(r.pct) * 1.5));
  const end = up ? 50 + span : 50 - span;
  const bar = h('span', 'gs-stat-bar', h('span', 'gs-stat-fill'), h('span', 'gs-stat-delta'));
  bar.style.setProperty('--end', `${end.toFixed(1)}%`);
  const val = h('span', 'gs-stat-v gs-num', `${up ? '+' : '−'}${percent(Math.abs(v))}`);
  const name = h('span', 'gs-stat-name', r.label);
  bar.setAttribute('aria-hidden', 'true');
  val.setAttribute('aria-hidden', 'true');
  return h('li', `gs-stat-row ${up ? 'is-up' : 'is-down'}`, icon(up ? 'plus' : 'minus', 'gs-stat-sign'), name, sr(` ${up ? 'plus' : 'minus'} ${Math.abs(v)} percent`), bar, val);
}

export class Menus {
  readonly pause: Layer;
  readonly sleds: Layer;
  readonly settings: Layer;
  private readonly pausePanel: SettingsPanel;
  /** The run's missions on the pause card, as they stand now (hidden with none). */
  private readonly pauseMis: HTMLElement;
  private readonly sheetPanel: SettingsPanel;
  private readonly resumeBtn: HTMLButtonElement;
  private readonly sledsBody: HTMLElement;
  private readonly sledsWallet: HTMLElement;
  private readonly settingsSheet: HTMLElement;
  private readonly sledsSheet: HTMLElement;
  private returnFocus: HTMLElement | null = null;
  private readonly homeBtn: HTMLButtonElement;
  private homeArmed = 0;
  /** Last data the game gave us, so the title buttons can reopen a sheet without a round trip. */
  lastSettings: SettingsModel | null = null;
  lastSleds: { cards: SledCard[]; wallet: number } | null = null;
  /** The sled the shop preview shows. */
  private sledPick = 0;
  private heroShown = -1;

  constructor(
    parent: HTMLElement,
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
  ) {
    // Pause.
    const pauseEl = h('div', 'gs-pause gs-scrim');
    this.pausePanel = new SettingsPanel(ctx, hd);
    this.resumeBtn = btn(ctx, {
      cls: 'gs-btn-primary gs-btn-lg',
      icon: 'play',
      label: 'Resume',
      sound: 'confirm',
      fk: 'resume',
      onClick: () => {
        this.hidePause();
        hd.onPause(false);
      },
    });
    // Home throws the run away (no results, missions or rewards), so it is two taps like Buy: the first
    // arms it for a few seconds, the second quits.
    const home = btn(ctx, {
      cls: 'gs-btn-soft gs-pause-home',
      icon: 'back',
      label: 'Home',
      sound: 'back',
      fk: 'p-home',
      onClick: () => {
        if (this.homeArmed) {
          this.disarmHome();
          this.hidePause();
          hd.onHome();
          return;
        }
        const label = home.querySelector('.gs-btn-label');
        if (label) label.textContent = 'Quit Run?';
        home.classList.add('is-armed');
        home.setAttribute('aria-label', 'Quit run: press again to leave without results');
        this.homeArmed = window.setTimeout(() => this.disarmHome(), 3000);
      },
    });
    this.homeBtn = home;
    const title = h('h2', 'gs-pause-title', 'Paused');
    title.id = 'gs-pause-title';
    const key = h('p', 'gs-pause-key gs-kbd-only', kbd('P'), ' to resume');
    // Under the title, what the run is working toward: each mission's live progress, Done once it popped.
    this.pauseMis = h('section', 'gs-pause-mis');
    this.pauseMis.setAttribute('aria-labelledby', 'gs-pause-mis-h');
    this.pauseMis.hidden = true;
    const card = h('div', 'gs-pause-card gs-panel', title, this.pauseMis, this.resumeBtn, this.pausePanel.el, home, key);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', title.id);
    pauseEl.append(card);
    this.pause = new Layer(pauseEl, 180);
    parent.append(pauseEl);

    // Sleds sheet.
    this.sledsWallet = h('span', 'gs-num');
    this.sledsBody = h('div', 'gs-sheet-body');
    const sledsHead = this.sheetHead('Sleds', 'gs-sleds-title', () => this.closeSheet(this.sleds), h('span', 'gs-wallet gs-panel gs-pill', icon('gift'), this.sledsWallet, sr(' gifts')));
    this.sledsSheet = this.sheet('gs-sheet-sleds', 'gs-sleds-title', sledsHead, this.sledsBody);
    const sledsWrap = this.wrap(this.sledsSheet, () => this.closeSheet(this.sleds));
    this.sleds = new Layer(sledsWrap, 200);
    parent.append(sledsWrap);

    // Settings sheet.
    this.sheetPanel = new SettingsPanel(ctx, hd);
    const setHead = this.sheetHead('Settings', 'gs-settings-title', () => this.closeSheet(this.settings), null);
    this.settingsSheet = this.sheet('gs-sheet-settings', 'gs-settings-title', setHead, h('div', 'gs-sheet-body', this.sheetPanel.el));
    const setWrap = this.wrap(this.settingsSheet, () => this.closeSheet(this.settings));
    this.settings = new Layer(setWrap, 200);
    parent.append(setWrap);
  }

  private sheetHead(title: string, id: string, onClose: () => void, extra: HTMLElement | null): HTMLElement {
    const t = h('h2', 'gs-sheet-title', title);
    t.id = id;
    const close = btn(this.ctx, { cls: 'gs-btn-soft gs-btn-round', icon: 'back', aria: 'Close', sound: 'back', fk: `close-${id}`, onClick: onClose });
    return h('div', 'gs-sheet-head', close, t, extra);
  }

  private sheet(cls: string, labelId: string, head: HTMLElement, body: HTMLElement): HTMLElement {
    const s = h('div', `gs-sheet gs-panel ${cls}`, head, body);
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-modal', 'true');
    s.setAttribute('aria-labelledby', labelId);
    return s;
  }

  private wrap(sheet: HTMLElement, onScrim: () => void): HTMLElement {
    const w = h('div', 'gs-sheetwrap gs-scrim', sheet);
    w.addEventListener('pointerdown', (e) => {
      if (e.target === w) {
        this.ctx.sound('back');
        onScrim();
      }
    });
    return w;
  }

  /** True when the node is part of the pause overlay or one of the sheets. */
  contains(n: Node): boolean {
    return this.pause.el.contains(n) || this.sleds.el.contains(n) || this.settings.el.contains(n);
  }

  get anyOpen(): boolean {
    return this.pause.open || this.sleds.open || this.settings.open;
  }

  /** The open menu surface on top (settings over sleds over pause), or null. */
  get topEl(): HTMLElement | null {
    if (this.settings.open) return this.settings.el;
    if (this.sleds.open) return this.sleds.el;
    if (this.pause.open) return this.pause.el;
    return null;
  }

  /** Called after any open/close, so the UI can make everything underneath inert. */
  onChange: () => void = () => undefined;

  showPause(s: SettingsModel, missions?: MissionView[]): void {
    this.lastSettings = { ...s };
    this.pausePanel.set(s);
    const list = (missions ?? []).slice(0, PAUSE_MISSIONS);
    this.pauseMis.replaceChildren();
    if (list.length > 0) {
      const head = h('h3', 'gs-pause-mis-h', 'Missions');
      head.id = 'gs-pause-mis-h';
      this.pauseMis.append(head, missionList(list));
    }
    this.pauseMis.hidden = list.length === 0;
    if (this.pause.show()) {
      this.rememberFocus();
      this.resumeBtn.focus({ preventScroll: true });
    }
    this.onChange();
  }

  private disarmHome(): void {
    window.clearTimeout(this.homeArmed);
    this.homeArmed = 0;
    const label = this.homeBtn.querySelector('.gs-btn-label');
    if (label) label.textContent = 'Home';
    this.homeBtn.classList.remove('is-armed');
    this.homeBtn.removeAttribute('aria-label');
  }

  hidePause(): void {
    if (!this.pause.open) return;
    this.disarmHome();
    this.pause.hide();
    // Lift inert from the surfaces underneath first, or the focus return below cannot land.
    this.onChange();
    this.restore();
  }

  showSettings(s: SettingsModel): void {
    this.lastSettings = { ...s };
    this.sheetPanel.set(s);
    if (this.settings.show()) {
      this.rememberFocus();
      this.settingsSheet.querySelector<HTMLElement>('[data-fk^="close-"]')?.focus({ preventScroll: true });
    }
    this.onChange();
  }

  showSleds(cards: SledCard[], wallet: number): void {
    this.lastSleds = { cards: cards.map((c) => ({ ...c })), wallet };
    const fresh = !this.sleds.open;
    // A fresh open previews the equipped sled; a refresh (bought, equipped) keeps the pick.
    if (fresh || !cards.some((c) => c.id === this.sledPick)) this.sledPick = (cards.find((c) => c.equipped) ?? cards[0])?.id ?? 0;
    this.renderShop(fresh);
    if (this.sleds.show()) {
      this.rememberFocus();
      this.sledsBody.scrollTop = 0;
      this.sledsSheet.querySelector<HTMLElement>('[data-fk^="close-"]')?.focus({ preventScroll: true });
    }
    this.onChange();
  }

  /** Builds the shop from lastSleds, keeping focus and scroll when it is already open. */
  private renderShop(fresh: boolean): void {
    const last = this.lastSleds;
    if (!last) return;
    const { cards, wallet } = last;
    const fk = fresh ? null : captureFocus(this.sledsSheet);
    const scroll = this.sledsBody.scrollTop;
    this.sledsWallet.textContent = fmt(wallet);
    const pick = cards.find((c) => c.id === this.sledPick) ?? cards[0];
    const grid = h('div', 'gs-shop-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'All sleds');
    for (const c of cards) grid.append(this.sledTile(c, c === pick, wallet));
    const shop = h('div', 'gs-shop', pick ? this.sledHero(pick, wallet, fresh) : null, grid);
    this.sledsBody.replaceChildren(shop);
    if (!fresh) {
      this.sledsBody.scrollTop = scroll;
      if (!restoreFocus(this.sledsSheet, fk)) this.sledsSheet.querySelector<HTMLElement>('[data-fk="sled-act"]')?.focus({ preventScroll: true });
    }
  }

  /**
   * The sled's picture: the portrait of its real mesh when the game renders them (drawn once, then
   * cached), the vector art until a portrait source exists or when one cannot be drawn. Decorative:
   * the tile and the preview name the sled in words.
   */
  private sledPic(id: number, seated: boolean): HTMLElement {
    const key = `${id}:${seated ? 1 : 0}`;
    const known = portraitUrls.get(key);
    const src = portraitSource;
    const vector = () => {
      const s = h('span', 'gs-sled-svg');
      s.innerHTML = sledArt(id, seated);
      return s;
    };
    if (!known && !src) return vector();
    const img = h('img', 'gs-sled-img');
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    if (known) {
      img.src = known;
      return img;
    }
    // A first draw takes a frame or two (the render, then the PNG encode): the picture fades in.
    img.classList.add('is-loading');
    void src!(id, seated)
      .catch(() => null)
      .then((url) => {
        if (url) {
          portraitUrls.set(key, url);
          img.addEventListener('load', () => img.classList.remove('is-loading'), { once: true });
          img.src = url;
        } else if (img.isConnected) img.replaceWith(vector());
      });
    return img;
  }

  /**
   * A grid tile: picking one shows it in the preview. Every sled stands on the same small stage as
   * the preview (a snow disc and its contact shadow under a cool rim light), so none floats on flat
   * navy. Under the name, the one thing the sled is better at with its number (so the grid compares
   * at a glance), then price, Owned or Equipped. A sled you can buy right now wears a marigold edge;
   * one you are still saving for shows in full colour, dimmed, with a lock and how many gifts it
   * still needs, so you can see what you are working toward.
   */
  private sledTile(c: SledCard, picked: boolean, wallet: number): HTMLButtonElement {
    const buy = !c.owned && c.affordable;
    const short = !c.owned && !c.affordable;
    const b = h('button', `gs-tile${picked ? ' is-pick' : ''}${c.equipped ? ' is-equipped' : ''}${c.owned ? ' is-owned' : ''}${short ? ' is-short' : ''}${buy ? ' is-buy' : ''}`);
    b.type = 'button';
    b.dataset.fk = `tile-${c.id}`;
    b.setAttribute('aria-pressed', String(picked));
    const art = h('span', 'gs-tile-art', this.sledPic(c.id, false));
    // Sleds are bought with gifts, so what a locked one needs is its price less the wallet: the tag
    // says it in gifts ("174 to go" beside the gift glyph; "174 more" never said more of what).
    const need = Math.max(1, c.price - wallet);
    if (short) art.append(h('span', 'gs-tile-lockico', icon('gift', 'gs-tile-need-ico'), h('span', 'gs-tile-need', h('span', 'gs-num', fmt(need)), ' to go')));
    const look = TILE_LOOK[c.id];
    if (look) {
      b.style.setProperty('--sky1', look.sky[0]);
      b.style.setProperty('--sky2', look.sky[1]);
      b.style.setProperty('--sky3', look.sky[2]);
      b.style.setProperty('--tile-rim', look.rim);
    }
    b.style.setProperty('--tint', look?.glow ?? sledTint(c.id));
    let foot: HTMLElement;
    let state: string;
    if (c.equipped) {
      foot = h('span', 'gs-tile-foot is-on', icon('check'), 'Equipped');
      state = 'Equipped';
    } else if (c.owned) {
      foot = h('span', 'gs-tile-foot', 'Owned');
      state = 'Owned';
    } else {
      foot = h('span', `gs-tile-foot is-price${c.affordable ? '' : ' is-short'}`, icon('gift'), h('span', 'gs-num', fmt(c.price)));
      state = short ? `Locked: ${fmt(c.price)} gifts, ${fmt(need)} more to go` : `${fmt(c.price)} gifts`;
    }
    const best = sledStats(c.id).find((r) => r.pct > 0);
    const gain = best ? `${best.label} +${Math.round(best.pct)}%` : 'All-rounder';
    const trait = h('span', 'gs-tile-trait', gain);
    // Sled names are proper nouns, like mountain names: keep auto-translate off them.
    const tileName = h('span', 'gs-tile-name', c.name);
    tileName.setAttribute('translate', 'no');
    b.append(art, tileName, trait, foot);
    b.setAttribute('aria-label', `${c.name}. ${best ? `${best.label} plus ${Math.round(best.pct)} percent` : 'All-rounder'}. ${state}`);
    b.addEventListener('click', () => {
      if (this.sledPick === c.id) return;
      this.ctx.sound('tap');
      this.sledPick = c.id;
      this.renderShop(false);
    });
    return b;
  }

  /** The preview: the sled with the rider seated, what it does, its trade-offs, and the one action. */
  private sledHero(c: SledCard, wallet: number, fresh: boolean): HTMLElement {
    const sky = h('span', 'gs-shop-sky');
    sky.innerHTML = STAGE_SVG;
    const stage = h('div', 'gs-shop-stage', sky, this.sledPic(c.id, true));
    // The art bobs in once per pick; a refresh of the same pick (bought, equipped) stays still.
    if (!fresh && this.heroShown !== c.id) stage.classList.add('is-new');
    this.heroShown = c.id;
    const name = h('h3', 'gs-shop-name', c.name);
    name.id = 'gs-shop-name';
    name.setAttribute('translate', 'no');
    const stats = sledStats(c.id);
    // What it does in one plain sentence, from the sim's own numbers; the bars below show how much.
    const effect = h('p', 'gs-shop-effect', sledEffect(stats));
    const list = h('ul', 'gs-stats');
    list.setAttribute('aria-label', `Trade-offs against the ${sledById(0).name}`);
    if (stats.length === 0) list.append(h('li', 'gs-stat-row is-even', h('span', 'gs-stat-even-sub', 'The baseline every other sled is measured against.')));
    else for (const r of stats) list.append(statRow(r));
    const act = h('div', 'gs-shop-act');
    if (c.equipped) {
      // A status, not a control: a small chip where the action would be, so the slot reads as
      // "nothing to do here" (a large outlined pill looked like a live button).
      const st = h('span', 'gs-sled-state', icon('check'), 'Equipped');
      st.tabIndex = -1;
      st.dataset.fk = 'sled-act';
      act.append(st);
    } else if (c.owned) {
      const b = btn(this.ctx, { cls: 'gs-btn-primary gs-btn-lg gs-shop-btn', icon: 'sledBold', label: 'Equip', fk: 'sled-act', onClick: () => this.hd.onSelectSled(c.id) });
      b.setAttribute('aria-label', `Equip ${c.name}`);
      act.append(b);
    } else if (c.affordable) {
      // The preview's primary action: a vermillion Buy with the price inside it. Spending is two
      // taps: Buy arms the button for a few seconds, Confirm spends.
      let armed = 0;
      const price = h('span', 'gs-shop-price', icon('gift'), h('span', 'gs-num', fmt(c.price)));
      const b = btn(
        this.ctx,
        {
          cls: 'gs-btn-primary gs-btn-lg gs-shop-btn gs-shop-buy',
          label: 'Buy',
          fk: 'sled-act',
          onClick: () => {
            const label = b.querySelector('.gs-btn-label');
            if (armed) {
              window.clearTimeout(armed);
              armed = 0;
              this.ctx.sound('confirm');
              this.hd.onBuySled(c.id);
              return;
            }
            if (label) label.textContent = 'Confirm';
            b.classList.add('is-armed');
            b.setAttribute('aria-label', `Confirm: spend ${fmt(c.price)} gifts on ${c.name}`);
            armed = window.setTimeout(() => {
              armed = 0;
              if (label) label.textContent = 'Buy';
              b.classList.remove('is-armed');
              b.setAttribute('aria-label', `Buy ${c.name} for ${fmt(c.price)} gifts`);
            }, 3000);
          },
        },
        price,
      );
      b.setAttribute('aria-label', `Buy ${c.name} for ${fmt(c.price)} gifts`);
      act.append(b);
    } else {
      const need = Math.max(0, c.price - wallet);
      const b = btn(
        this.ctx,
        { cls: 'gs-btn-quiet gs-btn-lg gs-shop-btn', icon: 'lock', fk: 'sled-act', disabled: true, onClick: () => undefined },
        h('span', 'gs-need', h('span', 'gs-num', fmt(need)), ' gifts to go'),
      );
      b.setAttribute('aria-label', `${c.name} costs ${fmt(c.price)} gifts. You need ${fmt(need)} more`);
      // Saving up: how far the wallet already goes toward the price.
      const save = h('span', 'gs-shop-save-bar');
      save.style.setProperty('--p', String(Math.max(0, Math.min(1, wallet / Math.max(1, c.price)))));
      save.setAttribute('aria-hidden', 'true');
      const meter = h('p', 'gs-shop-save', save, h('span', 'gs-shop-save-t', icon('gift'), h('span', 'gs-num', fmt(wallet)), ' / ', h('span', 'gs-num', fmt(c.price))));
      act.append(b, meter);
    }
    const hero = h('section', 'gs-shop-hero', stage, h('div', 'gs-shop-info', h('div', 'gs-shop-title', name, effect), list, act));
    hero.setAttribute('aria-labelledby', name.id);
    return hero;
  }

  /** Closes the sheets (Sleds, Settings). Pause and results are closed by their own calls. */
  closeMenus(): void {
    const was = this.sleds.open || this.settings.open;
    this.sleds.hide();
    this.settings.hide();
    this.onChange();
    if (was && !this.pause.open) this.restore();
  }

  private closeSheet(l: Layer): void {
    l.hide();
    this.onChange();
    if (!this.sleds.open && !this.settings.open) this.restore();
  }

  private rememberFocus(): void {
    if (this.returnFocus) return;
    const a = document.activeElement;
    this.returnFocus = a instanceof HTMLElement && a !== document.body ? a : null;
  }

  private restore(): void {
    const r = this.returnFocus;
    this.returnFocus = null;
    if (r && r.isConnected && !this.anyOpen) r.focus({ preventScroll: true });
  }
}
