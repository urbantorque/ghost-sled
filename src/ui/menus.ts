import type { AlbumModel, AlmanacModel, GarageCard, GarageShelf, GarageShelfId, LanternTownView, MissionView, PaintCard, SettingsModel, SledCard, UIHandlers } from './contract';
import type { RideMode } from './almanac';
import { sledById } from '../sim/sleds';
import { sledArt, sledTint } from './art';
import { btn, captureFocus, h, kbd, Layer, restoreFocus, sr, type Ctx } from './dom';
import { fmt, percent, progFigures } from './fmt';
import { icon } from './icons';
import { b9, coverSheets, ico9, openSheet, sheetFrame } from './kit9';
import { SettingsPanel } from './settings';
import { hatArt, paintArt, scarfArt, soundArt, trailArt } from './garageart';
import type { GarageAct, GarageView } from './garageview';
import type { GarageUI } from './garage';

// The pause card (Resume, the run's missions, Settings, Photo, Home), Settings, the books and the garage's layer.
// Round 9 (U4): the pause card, Settings and the books are sheets in the round's language (kit9.ts), each in a layer
// of its own here; the round 6 garage sheet below stays as it was, for the dev harness.
// Escape and Backspace close the top sheet (round 9, DECISIONS 392: ui.ts back() calls closeTop below), as the pad's
// B and each sheet's Close do. Until round 9 Escape was deliberately unbound because on CrazyGames it exits
// fullscreen; it still does there, as the browser takes it first, so in fullscreen a player presses it twice (and
// Backspace and B always work). The pause card is not a sheet: the game maps P to pause and resume.
// The Garage is a shop in tabs (round 6): Sleds, Paint, Scarves, Hats, Trails and Sounds. Each tab is a
// large preview of the picked item (what it is in one plain line, the one action) beside a grid of tiles
// that pick what the preview shows. The sleds are renders of the real in-game meshes when the game hands
// over a portrait source, with the flat vector art as the fallback; the looks are drawn from the numbers
// the game builds them from (garageart.ts). Buying is two taps everywhere: Buy arms, Confirm spends.

/** A round 9 sheet's close says where it goes: Back (to the surface it was opened over) or Close. */
function closeWords(sheet: HTMLElement, back: boolean): void {
  const x = sheet.querySelector<HTMLElement>('.gs9-sheet-head [data-fk^="close-"]');
  const t = x?.querySelector('.gs9-b-t');
  if (!x || !t || t.textContent === (back ? 'Back' : 'Close')) return;
  t.textContent = back ? 'Back' : 'Close';
  x.querySelector('.gs9-i')?.replaceWith(ico9(back ? 'back' : 'close'));
}

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

/** The rider's look changed in the garage: seated previews are drawn again, in the new hat and scarf. */
export function forgetSeatedPortraits(): void {
  for (const k of [...portraitUrls.keys()]) if (k.endsWith(':1')) portraitUrls.delete(k);
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
    { label: 'Light pull', pct: (d.magnet - 1) * 100 },
    { label: 'Combo time', pct: (d.comboWindow - 1) * 100 },
    { label: 'Pop', pct: (d.pop - 1) * 100 },
    // The lantern (round 5): what lights it, and what a dash and a ward do with it.
    { label: 'Lights', pct: (d.lightGain - 1) * 100 },
    { label: 'Trick light', pct: (d.skillGain - 1) * 100 },
    { label: 'Dash', pct: (d.dashLen - 1) * 100 },
    { label: 'Ward', pct: (d.wardKeep - 1) * 100 },
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
  'Light pull': [(p) => `${p}% stronger light pull`, (p) => `${p}% weaker light pull`],
  Lights: [(p) => `lights fill the lantern ${p}% more`, (p) => `lights fill the lantern ${p}% less`],
  'Trick light': [(p) => `skill fills the lantern ${p}% more`, (p) => `skill fills the lantern ${p}% less`],
  Dash: [(p) => `dashes last ${p}% longer`, (p) => `dashes run ${p}% shorter`],
  Ward: [(p) => `wards keep ${p}% more speed`, (p) => `wards keep ${p}% less speed`],
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

/** The garage's tabs: the sleds, their paints, and the round 6 shelves. */
// (Round 8: the Lantern Row's tab, a plain list until the screens lane draws it.)
type GarageTab = 'sleds' | 'paint' | GarageShelfId | 'lanterns';
type LookTab = Exclude<GarageTab, 'sleds' | 'lanterns'>;
const SHELF_ORDER: readonly GarageShelfId[] = ['scarf', 'hat', 'trail', 'sound'];
const TAB_LABEL: Record<GarageTab, string> = { sleds: 'Sleds', paint: 'Paint', scarf: 'Scarves', hat: 'Hats', trail: 'Trails', sound: 'Sounds', lanterns: 'Lanterns' };
/** What an item already on says, by shelf. */
const ON_WORD: Record<LookTab, string> = { paint: 'On your sled', scarf: 'Wearing', hat: 'Wearing', trail: 'On your sled', sound: 'On your sled' };
/** One plain line under each shelf's preview: what the look touches, and that it is only a look. */
const NOTE: Record<LookTab, string> = {
  paint: 'A look only: every sled rides the same in any paint.',
  scarf: 'A look only. Your scarf stays vermillion, so you always know which rider is you.',
  hat: 'Seen from behind, as you see it on the run. A look only.',
  trail: 'What your sled leaves in the snow. A look only.',
  sound: 'How your own runners sound. Cues that tell you something never change.',
};

/** A look shelf's item as the garage draws it (a paint or a garage card, with its preview). */
interface LookItem {
  id: string;
  name: string;
  blurb: string;
  price: number;
  owned: boolean;
  on: boolean;
  affordable: boolean;
  art: string;
}

export class Menus {
  readonly pause: Layer;
  readonly sleds: Layer;
  readonly settings: Layer;
  /** Round 8: the Almanac and the Spirit Album, one sheet with a tab each (almanac.ts draws them). */
  readonly books: Layer;
  /** Round 9 (the shop lane): the garage as a place: its UI (garage.ts, loaded on demand) over the scene the app
   *  draws in the canvas. The round 6 sheet (`sleds`) stays for the dev harness. */
  readonly garage: Layer;
  private garageUi: GarageUI | null = null;
  private garageAct: ((a: GarageAct) => void) | null = null;
  private garageLoad: Promise<void> | null = null;
  private readonly booksSheet: HTMLElement;
  private readonly booksBody: HTMLElement;
  private booksTab: 'almanac' | 'album' = 'almanac';
  private lastAlmanac: AlmanacModel | null = null;
  private lastAlbum: AlbumModel | null = null;
  /** Round 9 (U4): the books' builders (books.ts), loaded when a book is first opened; an album page open over the
   *  contents, and its close. */
  private booksMod: Promise<typeof import('./books')> | null = null;
  private bookPage: (() => void) | null = null;
  /** The pause card, and its Settings (focus comes back to it when settings close over the card). */
  private readonly pauseCard: HTMLElement;
  private readonly pauseSettings: HTMLButtonElement;
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
  lastSleds: { cards: SledCard[]; wallet: number; paints?: PaintCard[]; shelves?: GarageShelf[]; lanterns?: LanternTownView[] } | null = null;
  /** The garage's open tab, and the item each look shelf's preview shows. */
  private tab: GarageTab = 'sleds';
  private itemPick: Partial<Record<GarageTab, string>> = {};
  private itemShown = '';
  /** The sled the shop preview shows. */
  private sledPick = 0;
  private heroShown = -1;

  constructor(
    parent: HTMLElement,
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
  ) {
    // Pause (round 9, U4): one sheet at the reading edge (the bottom on a phone). The word set like the wordmark, what
    // the run is working toward (its missions as they stand), Resume (the one primary, its key on it), then Settings,
    // Photo and Home, each with its word. The settings are one press away, not on the card.
    const pauseEl = h('div', 'gs9-layer');
    // (The way back, in the keys' words and in the pad's: the UI root shows the one in use, .gs-pad-mode.)
    const keys = h('span', 'gs-kbd-only', h('span', 'gs-key-keys', kbd('P')), h('span', 'gs-key-pad', kbd('Start', 'gs-pad-start')));
    keys.setAttribute('aria-hidden', 'true');
    this.resumeBtn = b9(ctx, 'primary', ['Resume', keys], {
      icon: 'play',
      sound: 'confirm',
      fk: 'resume',
      onClick: () => {
        this.hidePause();
        hd.onPause(false);
      },
    });
    this.resumeBtn.setAttribute('aria-keyshortcuts', 'P');
    // Home throws the run away (no results, missions or rewards), so it is two taps like Buy: the first
    // arms it for a few seconds, the second quits.
    const home = b9(ctx, 'quiet', 'Home', {
      icon: 'back',
      sound: 'back',
      fk: 'p-home',
      cls: 'gs9-pause-home',
      onClick: () => {
        if (this.homeArmed) {
          this.disarmHome();
          this.hidePause();
          hd.onHome();
          return;
        }
        const label = home.querySelector('.gs9-b-t');
        if (label) label.textContent = 'Quit Run?';
        home.classList.add('is-armed');
        home.setAttribute('aria-label', 'Quit Run? Press again to leave without results');
        this.homeArmed = window.setTimeout(() => this.disarmHome(), 3000);
      },
    });
    this.homeBtn = home;
    const title = h('h2', 'gs9-pause-h', 'Paused');
    title.id = 'gs9-pause-t';
    title.tabIndex = -1;
    // Under the word, what the run is working toward: each mission's live progress, Done once it popped.
    this.pauseMis = h('section', 'gs9-pause-mis');
    this.pauseMis.setAttribute('aria-labelledby', 'gs9-pause-mis-h');
    this.pauseMis.hidden = true;
    this.pauseSettings = b9(ctx, 'secondary', 'Settings', { icon: 'gear', fk: 'p-settings', onClick: () => (this.lastSettings ? this.showSettings(this.lastSettings) : undefined) });
    // Round 8 (the photo lane): photo mode holds the run where it stopped and hands the lens to the player.
    const photo = hd.onPhoto ? b9(ctx, 'secondary', 'Photo', { icon: 'camera', fk: 'p-photo', onClick: () => hd.onPhoto?.() }) : null;
    const card = h('section', 'gs9-sheet is-fit gs9-pause', h('header', 'gs9-sheet-head', title), h('div', 'gs9-sheet-body', this.pauseMis, this.resumeBtn, h('div', 'gs9-pause-acts', this.pauseSettings, photo, home)));
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', title.id);
    this.pauseCard = card;
    pauseEl.append(card);
    this.pause = new Layer(pauseEl, 180);
    parent.append(pauseEl);

    // Sleds sheet.
    this.sledsWallet = h('span', 'gs-num');
    this.sledsBody = h('div', 'gs-sheet-body');
    const sledsHead = this.sheetHead('Garage', 'gs-sleds-title', () => this.closeSheet(this.sleds), h('span', 'gs-wallet gs-panel gs-pill', icon('gift'), this.sledsWallet, sr(' gifts')));
    this.sledsSheet = this.sheet('gs-sheet-sleds', 'gs-sleds-title', sledsHead, this.sledsBody);
    const sledsWrap = this.wrap(this.sledsSheet, () => this.closeSheet(this.sleds));
    this.sleds = new Layer(sledsWrap, 200);
    parent.append(sledsWrap);

    // Settings (round 9, U4): a sheet from the logo's side (the bottom on a phone), as a room is: Close from the title's
    // door, Back over the pause card.
    this.sheetPanel = new SettingsPanel(ctx, hd);
    const sf = sheetFrame(ctx, { cls: 'is-fit gs9-settings', title: 'Settings', close: 'Close', closeIcon: 'close', fk: 'close-settings', onClose: () => this.closeSheet(this.settings) });
    sf.body.append(this.sheetPanel.el);
    this.settingsSheet = sf.el;
    const setWrap = h('div', 'gs9-layer', sf.el);
    this.settings = new Layer(setWrap, 200);
    parent.append(setWrap);

    // The books (round 8; round 9, U4: a sheet over the Progress room, with Back, its builders loaded on demand).
    const bf = sheetFrame(ctx, { cls: 'gs9-books', title: 'Almanac', close: 'Back', closeIcon: 'back', fk: 'close-books', onClose: () => this.closeSheet(this.books) });
    this.booksSheet = bf.el;
    this.booksBody = bf.body;
    const booksWrap = h('div', 'gs9-layer', bf.el);
    this.books = new Layer(booksWrap, 200);
    parent.append(booksWrap);

    // The garage's place (round 9): no scrim, the scene is the picture.
    const garageWrap = h('div', 'gs-gar-layer');
    this.garage = new Layer(garageWrap, 200);
    parent.append(garageWrap);
  }

  /** Round 9: opens the garage over its place, or shows it its new state (a purchase, a tier fitted). Its module loads
   *  on the first open. `act` hears every request the garage makes, its close included. */
  async showGarage(v: GarageView, act: (a: GarageAct) => void): Promise<void> {
    this.garageAct = act;
    if (!this.garageUi) {
      this.garageLoad ??= import('./garage').then((m) => {
        this.garageUi = new m.GarageUI(this.ctx, (a) => (a.kind === 'close' ? this.closeGarage() : this.garageAct?.(a)));
        this.garage.el.append(this.garageUi.el);
      });
      await this.garageLoad;
    }
    const ui = this.garageUi;
    if (!ui) return;
    if (this.garage.show()) this.rememberFocus();
    this.garage.el.parentElement?.classList.add('gs-garage-on');
    // (Inert lifted before it shows: over the results every other layer is inert, and the garage takes focus as it
    // shows; opened from Details, focus fell to the page.)
    this.onChange();
    ui.show(v);
  }

  /** Round 9: the purchase's line over the place ("Yours: the Pom Muffs"), for a couple of seconds. */
  garageMoment(text: string | null): void {
    this.garageUi?.moment(text);
  }

  /** Closes the garage (its Back, Escape, the pad's B) and tells the app, which puts the world back. */
  closeGarage(): void {
    if (!this.garage.open) return;
    const door = this.returnFocus?.dataset.fk;
    this.garage.hide();
    this.garage.el.parentElement?.classList.remove('gs-garage-on');
    this.garageUi?.reset();
    this.onChange();
    this.garageAct?.({ kind: 'close' });
    if (!this.anyOpen) this.restore();
    // (The app redraws the title as the garage closes: the door that opened it is found again by its data-fk.)
    if (door && !this.anyOpen && (document.activeElement === document.body || !document.activeElement)) {
      document.querySelector<HTMLElement>(`[data-fk="${CSS.escape(door)}"]`)?.focus({ preventScroll: true });
    }
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
    return this.pause.el.contains(n) || this.sleds.el.contains(n) || this.settings.el.contains(n) || this.books.el.contains(n) || this.garage.el.contains(n);
  }

  get anyOpen(): boolean {
    return this.pause.open || this.sleds.open || this.settings.open || this.books.open || this.garage.open;
  }

  /** The open menu surface on top (settings over sleds over pause), or null. */
  get topEl(): HTMLElement | null {
    if (this.settings.open) return this.settings.el;
    if (this.books.open) return this.books.el;
    if (this.garage.open) return this.garage.el;
    if (this.sleds.open) return this.sleds.el;
    if (this.pause.open) return this.pause.el;
    return null;
  }

  /** Called after any open/close, so the UI can make everything underneath inert. */
  onChange: () => void = () => undefined;

  showPause(s: SettingsModel, missions?: MissionView[]): void {
    this.lastSettings = { ...s };
    const list = (missions ?? []).slice(0, PAUSE_MISSIONS);
    this.pauseMis.replaceChildren();
    if (list.length > 0) {
      // (Each as the Progress room says it: its words, a check once done, and "270 of 800".)
      const head = h('h3', 'gs9-cap', 'This Run’s Missions');
      head.id = 'gs9-pause-mis-h';
      const ul = h('ul', 'gs9-list');
      for (const mv of list) {
        const [v, t] = progFigures(Math.min(mv.progress, mv.target), mv.target, mv.dp);
        ul.append(h('li', `gs9-row${mv.done ? ' is-done' : ''}`, h('span', 'gs9-row-t', h('span', 'gs9-check', mv.done ? ico9('check') : null), mv.text), h('span', 'gs9-row-v gs9-num', mv.done ? 'Done' : `${v} of ${t}`)));
      }
      this.pauseMis.append(head, ul);
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
    const label = this.homeBtn.querySelector('.gs9-b-t');
    if (label) label.textContent = 'Home';
    this.homeBtn.classList.remove('is-armed');
    this.homeBtn.removeAttribute('aria-label');
  }

  hidePause(): void {
    if (!this.pause.open) return;
    this.disarmHome();
    // (Round 9, U4: settings opened over the card go with it: P resumes from under them too.)
    if (this.settings.open) {
      this.settings.hide();
      this.uncover();
    }
    this.pause.hide();
    // Lift inert from the surfaces underneath first, or the focus return below cannot land.
    this.onChange();
    this.restore();
  }

  showSettings(s: SettingsModel): void {
    this.lastSettings = { ...s };
    this.sheetPanel.set(s);
    // (Over the pause card it is a step down from it: Back, and the card out of sight under it.)
    const over = this.pause.open;
    closeWords(this.settingsSheet, over);
    const fresh = this.settings.show();
    if (fresh && !over) this.rememberFocus();
    // (Inert lifted first: over the pause card every other layer is inert, and focus cannot land in one.)
    this.onChange();
    if (fresh) {
      this.pauseCard.classList.toggle('is-covered', over);
      coverSheets(true);
      this.settingsSheet.querySelector<HTMLElement>('.gs9-sheet-h')?.focus({ preventScroll: true });
    }
  }

  showSleds(cards: SledCard[], wallet: number, paints?: PaintCard[], shelves?: GarageShelf[], lanterns?: LanternTownView[]): void {
    this.lastSleds = { cards: cards.map((c) => ({ ...c })), wallet, paints: paints?.map((p) => ({ ...p })), shelves: shelves?.map((s) => ({ id: s.id, items: s.items.map((i) => ({ ...i })) })), lanterns: lanterns?.map((t) => ({ ...t, lanterns: t.lanterns.map((l) => ({ ...l })), next: t.next ? { ...t.next } : null })) };
    const fresh = !this.sleds.open;
    // A fresh open previews the equipped sled and what is worn on every shelf; a refresh (bought,
    // equipped) keeps the picks and the tab.
    if (fresh || !cards.some((c) => c.id === this.sledPick)) this.sledPick = (cards.find((c) => c.equipped) ?? cards[0])?.id ?? 0;
    if (fresh) this.itemPick = {};
    if (!this.tabs().includes(this.tab)) this.tab = 'sleds';
    this.renderShop(fresh);
    if (this.sleds.show()) {
      this.rememberFocus();
      this.sledsBody.scrollTop = 0;
      this.sledsSheet.querySelector<HTMLElement>('[data-fk^="close-"]')?.focus({ preventScroll: true });
    }
    this.onChange();
  }

  /** The garage's tabs the game handed data for, in their order. */
  private tabs(): GarageTab[] {
    const last = this.lastSleds;
    const out: GarageTab[] = ['sleds'];
    if (last?.paints?.length) out.push('paint');
    for (const id of SHELF_ORDER) if (last?.shelves?.some((s) => s.id === id && s.items.length)) out.push(id);
    if (last?.lanterns?.length) out.push('lanterns');
    return out;
  }

  /** Builds the garage from lastSleds (its tabs, then the open tab's preview and tiles), keeping focus and
   *  scroll when it is already open. */
  private renderShop(fresh: boolean): void {
    const last = this.lastSleds;
    if (!last) return;
    const { cards, wallet } = last;
    const fk = fresh ? null : captureFocus(this.sledsSheet);
    const scroll = this.sledsBody.scrollTop;
    this.sledsWallet.textContent = fmt(wallet);
    const tabs = this.tabs();
    const bar = tabs.length > 1 ? this.tabBar(tabs) : null;
    let panel: HTMLElement;
    if (this.tab === 'sleds') {
      const pick = cards.find((c) => c.id === this.sledPick) ?? cards[0];
      const grid = h('div', 'gs-shop-grid');
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'All sleds');
      for (const c of cards) grid.append(this.sledTile(c, c === pick, wallet));
      panel = h('div', 'gs-shop', pick ? this.sledHero(pick, wallet, fresh) : null, grid);
    } else if (this.tab === 'lanterns') {
      panel = this.lanternPanel(last.lanterns ?? [], wallet);
    } else {
      panel = this.lookPanel(this.tab, wallet, fresh);
    }
    panel.id = 'gs-garage-panel';
    if (bar) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `gs-gtab-${this.tab}`);
    }
    this.sledsBody.replaceChildren(...(bar ? [bar] : []), panel);
    // On a phone the tabs scroll sideways: keep the open one in view (set directly, so the sheet's own
    // scroll never moves with it).
    const on = bar?.querySelector<HTMLElement>('.gs-gtab.is-on');
    if (bar && on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    if (!fresh) {
      this.sledsBody.scrollTop = scroll;
      if (!restoreFocus(this.sledsSheet, fk)) this.sledsSheet.querySelector<HTMLElement>('[data-fk="sled-act"]')?.focus({ preventScroll: true });
    }
  }

  /** The garage's tabs: a row of pills, one per shelf (arrow keys move between them, as tabs do). */
  private tabBar(tabs: GarageTab[]): HTMLElement {
    const bar = h('div', 'gs-gtabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Garage shelves');
    const pick = (t: GarageTab, focus: boolean) => {
      if (t === this.tab) return;
      this.ctx.sound('tap');
      this.tab = t;
      this.renderShop(false);
      if (focus) this.sledsSheet.querySelector<HTMLElement>(`[data-fk="gtab-${t}"]`)?.focus({ preventScroll: true });
    };
    for (const t of tabs) {
      const on = t === this.tab;
      const b = h('button', `gs-gtab${on ? ' is-on' : ''}`, TAB_LABEL[t]);
      b.type = 'button';
      b.id = `gs-gtab-${t}`;
      b.dataset.fk = `gtab-${t}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('aria-controls', 'gs-garage-panel');
      b.tabIndex = on ? 0 : -1;
      b.addEventListener('click', () => pick(t, true));
      b.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(t);
        const to = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : null;
        if (!to) return;
        e.preventDefault();
        pick(to, true);
      });
      bar.append(b);
    }
    return bar;
  }

  /**
   * The Lantern Row (round 8, game/lanterns.ts): each open finish town's eight lanterns, lit in order with gifts. Each
   * town is its row of eight drawn as they hang (the lit ones marigold, the lantern's and the gifts' colour; the next
   * one outlined; the rest dark), its count, and one button for the next. A look only, hung in the town at the
   * finish: nothing in it reaches a race.
   */
  private lanternPanel(towns: LanternTownView[], wallet: number): HTMLElement {
    const list = h('ul', 'gs-lrow-list');
    list.setAttribute('aria-label', 'The Lantern Row, by finish town');
    for (const t of towns) {
      const name = h('span', 'gs-shop-name', t.town);
      name.setAttribute('translate', 'no');
      const count = h('span', 'gs-shop-effect', h('span', 'gs-num', `${t.lit} of ${t.of}`), ' lit');
      let act: HTMLElement;
      if (!t.next) act = h('span', 'gs-sled-state', icon('check'), 'All Lit');
      else if (t.next.affordable) {
        const next = t.next;
        act = btn(this.ctx, { cls: 'gs-btn-primary gs-shop-btn', label: 'Light a Lantern', fk: `lantern-${t.mountain}`, onClick: () => this.hd.onLightLantern?.(next.id) }, h('span', 'gs-shop-price', icon('gift'), h('span', 'gs-num', fmt(next.price))));
        act.setAttribute('aria-label', `Light the next lantern in ${t.town} for ${fmt(next.price)} gifts`);
      } else act = h('span', 'gs-shop-effect', icon('gift'), h('span', 'gs-num', fmt(t.next.price)), `, ${fmt(Math.max(1, t.next.price - wallet))} more to go`);
      const row = h('span', 'gs-lrow-row');
      row.setAttribute('aria-hidden', 'true');
      for (const l of t.lanterns) row.append(h('span', `gs-lrow-lamp${l.lit ? ' is-lit' : t.next?.id === l.id ? ' is-next' : ''}`, icon('lantern')));
      list.append(h('li', 'gs-lrow-town', h('span', 'gs-lrow-head', name, count), row, act));
    }
    return h('div', 'gs-shop gs-lrow-shop', h('p', 'gs-look-note', 'Lanterns you light hang in the finish town. A look only.'), list);
  }

  /** A look shelf's items, paints included, in the one shape the preview and the tiles draw. */
  private lookItems(tab: LookTab): LookItem[] {
    const last = this.lastSleds;
    if (tab === 'paint') {
      return (last?.paints ?? []).map((p) => ({ id: p.id, name: p.name, blurb: p.hex ? 'Recolours the deck; the grain and the vermillion trim stay' : "The sled's own wood", price: p.price, owned: p.owned, on: p.on, affordable: p.affordable, art: paintArt(p.hex) }));
    }
    const shelf = last?.shelves?.find((s) => s.id === tab);
    const art = (c: GarageCard) => (tab === 'scarf' ? scarfArt(c.id) : tab === 'hat' ? hatArt(c.id) : tab === 'trail' ? trailArt(c.id) : soundArt(c.id));
    return (shelf?.items ?? []).map((c) => ({ ...c, art: art(c) }));
  }

  /** A look shelf (paint, scarf, hat, trail or sound): the picked item's preview and its one action beside
   *  a grid of tiles that pick what the preview shows, as the sleds do. */
  private lookPanel(tab: LookTab, wallet: number, fresh: boolean): HTMLElement {
    const items = this.lookItems(tab);
    const picked = items.find((i) => i.id === this.itemPick[tab]) ?? items.find((i) => i.on) ?? items[0];
    if (picked) this.itemPick[tab] = picked.id;
    const grid = h('div', `gs-shop-grid gs-looks is-${tab}`);
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', `All ${TAB_LABEL[tab].toLowerCase()}`);
    for (const it of items) grid.append(this.lookTile(tab, it, it === picked, wallet));
    return h('div', 'gs-shop gs-look-shop', picked ? this.lookHero(tab, picked, wallet, fresh) : null, grid);
  }

  private lookTile(tab: LookTab, it: LookItem, picked: boolean, wallet: number): HTMLButtonElement {
    const short = !it.owned && !it.affordable;
    const b = h('button', `gs-look${picked ? ' is-pick' : ''}${it.on ? ' is-on' : ''}${short ? ' is-short' : ''}${!it.owned && it.affordable ? ' is-buy' : ''}`);
    b.type = 'button';
    b.dataset.fk = `look-${tab}-${it.id}`;
    b.setAttribute('aria-pressed', String(picked));
    const art = h('span', `gs-look-art is-${tab}`);
    art.innerHTML = it.art;
    const name = h('span', 'gs-look-name', it.name);
    // Item names are names, like the sleds': auto-translate stays off them.
    name.setAttribute('translate', 'no');
    let foot: HTMLElement;
    let state: string;
    if (it.on) {
      foot = h('span', 'gs-look-foot is-on', icon('check'), ON_WORD[tab]);
      state = ON_WORD[tab];
    } else if (it.owned) {
      foot = h('span', 'gs-look-foot', 'Owned');
      state = 'Owned';
    } else {
      const need = Math.max(1, it.price - wallet);
      foot = h('span', `gs-look-foot is-price${short ? ' is-short' : ''}`, icon('gift'), h('span', 'gs-num', fmt(it.price)));
      state = short ? `${fmt(it.price)} gifts, ${fmt(need)} more to go` : `${fmt(it.price)} gifts`;
    }
    b.append(art, name, foot);
    b.setAttribute('aria-label', `${it.name}. ${state}`);
    b.addEventListener('click', () => {
      if (this.itemPick[tab] === it.id) return;
      this.ctx.sound('tap');
      this.itemPick[tab] = it.id;
      this.renderShop(false);
    });
    return b;
  }

  /** The picked item large on the shop's dusk stage, what it is in one line, and its one action: Equip,
   *  Buy (two taps, as a sled), what it still needs, or a chip when it is already on. */
  private lookHero(tab: LookTab, it: LookItem, wallet: number, fresh: boolean): HTMLElement {
    const sky = h('span', 'gs-shop-sky');
    sky.innerHTML = STAGE_SVG;
    const art = h('span', `gs-look-big is-${tab}`);
    art.innerHTML = it.art;
    const stage = h('div', `gs-shop-stage gs-look-stage is-${tab}`, sky, art);
    const key = `${tab}:${it.id}`;
    if (!fresh && this.itemShown !== key) stage.classList.add('is-new');
    this.itemShown = key;
    const name = h('h3', 'gs-shop-name', it.name);
    name.setAttribute('translate', 'no');
    name.id = 'gs-look-name';
    const blurb = h('p', 'gs-shop-effect', it.blurb);
    const note = h('p', 'gs-look-note', NOTE[tab]);
    const act = h('div', 'gs-shop-act');
    const apply = () => (tab === 'paint' ? this.hd.onPaint?.(it.id) : this.hd.onGarage?.(tab, it.id));
    if (it.on) {
      const st = h('span', 'gs-sled-state', icon('check'), ON_WORD[tab]);
      st.tabIndex = -1;
      st.dataset.fk = 'sled-act';
      act.append(st);
    } else if (it.owned) {
      const b = btn(this.ctx, { cls: 'gs-btn-primary gs-btn-lg gs-shop-btn', icon: 'check', label: 'Equip', fk: 'sled-act', onClick: apply });
      b.setAttribute('aria-label', `Equip ${it.name}`);
      act.append(b);
    } else if (it.affordable) {
      let armed = 0;
      const price = h('span', 'gs-shop-price', icon('gift'), h('span', 'gs-num', fmt(it.price)));
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
              apply();
              return;
            }
            if (label) label.textContent = 'Confirm';
            b.classList.add('is-armed');
            b.setAttribute('aria-label', `Confirm: spend ${fmt(it.price)} gifts on ${it.name}`);
            armed = window.setTimeout(() => {
              armed = 0;
              if (label) label.textContent = 'Buy';
              b.classList.remove('is-armed');
              b.setAttribute('aria-label', `Buy ${it.name} for ${fmt(it.price)} gifts`);
            }, 3000);
          },
        },
        price,
      );
      b.setAttribute('aria-label', `Buy ${it.name} for ${fmt(it.price)} gifts`);
      act.append(b);
    } else {
      const need = Math.max(0, it.price - wallet);
      const b = btn(this.ctx, { cls: 'gs-btn-quiet gs-btn-lg gs-shop-btn', icon: 'lock', fk: 'sled-act', disabled: true, onClick: () => undefined }, h('span', 'gs-need', h('span', 'gs-num', fmt(need)), ' gifts to go'));
      b.setAttribute('aria-label', `${it.name} costs ${fmt(it.price)} gifts. You need ${fmt(need)} more`);
      act.append(b);
    }
    // A sound is heard before it is bought: Listen plays a few seconds of it under a carving rider.
    if (tab === 'sound' && this.hd.onListenSound) {
      const listen = btn(this.ctx, { cls: 'gs-btn-quiet gs-btn-lg gs-shop-btn gs-listen', icon: 'play', label: 'Listen', fk: 'look-listen', onClick: () => this.hd.onListenSound?.(it.id) });
      listen.setAttribute('aria-label', `Listen to ${it.name}`);
      act.append(listen);
    }
    const hero = h('section', 'gs-shop-hero', stage, h('div', 'gs-shop-info', h('div', 'gs-shop-title', name, blurb), note, act));
    hero.setAttribute('aria-labelledby', name.id);
    return hero;
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
    const was = this.sleds.open || this.settings.open || this.books.open;
    if (this.garage.open) this.closeGarage();
    this.closeBookPage();
    this.sleds.hide();
    this.settings.hide();
    this.books.hide();
    this.uncover();
    this.onChange();
    if (was && !this.pause.open) this.restore();
  }

  /** Round 9: closes the sheet on top (settings over the books over the garage), as its own Close does, for Escape,
   *  Backspace (ui.ts back) and the pad's B. False with none open: the pause card is not one. */
  closeTop(): boolean {
    // (The garage's place, the shop lane's layer, sits under settings and the books and over the round 6 sheet, as
    // topEl has it; its own close hands focus back to the door, silent as its Back and Escape are.)
    if (this.garage.open && !this.settings.open && !this.books.open) {
      this.closeGarage();
      return true;
    }
    const top = this.settings.open ? this.settings : this.books.open ? this.books : this.sleds.open ? this.sleds : null;
    if (!top) return false;
    this.ctx.sound('back');
    // (Round 9, U4: an album page open over its contents goes first.)
    if (top === this.books && this.bookPage) {
      this.closeBookPage();
      return true;
    }
    this.closeSheet(top);
    return true;
  }

  private closeSheet(l: Layer): void {
    if (l === this.books) this.closeBookPage();
    l.hide();
    this.uncover();
    this.onChange();
    // (Settings over the pause card give focus back to its Settings.)
    if (l === this.settings && this.pause.open) this.pauseSettings.focus({ preventScroll: true });
    else if (!this.sleds.open && !this.settings.open && !this.books.open) this.restore();
  }

  /** Round 9 (U4): what a sheet of this file put out of sight comes back as it closes (the pause card under settings, a
   *  room under the books or settings). */
  private uncover(): void {
    if (!this.settings.open) this.pauseCard.classList.remove('is-covered');
    if (!this.settings.open && !this.books.open) coverSheets(false);
  }

  /** The Almanac (round 8; round 9, U4: this month's chapter and the fifty ranks as rows), opened at the rank the bar
   *  fills toward. */
  showAlmanac(m: AlmanacModel): void {
    this.lastAlmanac = m;
    this.booksTab = 'almanac';
    this.renderBooks();
  }

  /** The Spirit Album (round 8; round 9, U4: its contents, a page a row; a page opens over them). */
  showAlbum(m: AlbumModel): void {
    this.lastAlbum = m;
    this.booksTab = 'album';
    this.renderBooks();
  }

  /** Round 9 (U4): one book at a time, each from its own button in the Progress room (the round 8 sheet had a tab for
   *  each). Its builders load on the first open; a book already up takes its new model in place. */
  private renderBooks(): void {
    void (this.booksMod ??= import('./books')).then((bk) => {
      const tab = this.booksTab;
      const a = this.lastAlmanac;
      const al = this.lastAlbum;
      const name = tab === 'almanac' ? 'Almanac' : 'Spirit Album';
      const head = this.booksSheet.querySelector<HTMLElement>('.gs9-sheet-h');
      if (head) head.textContent = name;
      this.booksSheet.setAttribute('aria-label', name);
      this.closeBookPage();
      // (The modes lane: an opened rank's Ride, for a mirror, the Long Night or the Trial.)
      const ride = this.hd.onRideMode ? (mode: RideMode) => this.hd.onRideMode?.(mode) : undefined;
      const body = tab === 'almanac' && a ? bk.almanacBody(a, this.ctx, ride) : tab === 'album' && al ? bk.albumContents(al, this.ctx, (id, from) => this.openBookPage(bk, id, from)) : h('div');
      this.booksBody.replaceChildren(body);
      const fresh = this.books.show();
      if (fresh) this.rememberFocus();
      this.onChange();
      if (fresh) {
        coverSheets(true);
        head?.focus({ preventScroll: true });
      }
      // The Almanac opens at the rank being filled toward (a third of the way down); the Album at its top.
      const next = tab === 'almanac' ? body.querySelector<HTMLElement>('[data-next]') : null;
      const sc = this.booksBody;
      sc.scrollTop = 0;
      if (next) sc.scrollTop = Math.max(0, next.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight / 3);
    });
  }

  /** An album page over the contents: its own sheet with Back, focus back on its row as it closes. */
  private openBookPage(bk: typeof import('./books'), id: string, from: HTMLElement): void {
    const sec = this.lastAlbum?.sections.find((s) => s.id === id);
    if (!sec || this.bookPage) return;
    let shut = (): void => {};
    const v = sheetFrame(this.ctx, { cls: 'gs9-books is-page', title: sec.name, close: 'Back', closeIcon: 'back', fk: 'close-page', onClose: () => shut() });
    v.el.querySelector('.gs9-sheet-h')?.setAttribute('translate', 'no');
    v.body.append(bk.albumPage(sec));
    this.books.el.append(v.el);
    this.booksSheet.classList.add('is-covered');
    shut = openSheet(v.el, from, [this.booksSheet], () => {
      v.el.remove();
      this.booksSheet.classList.remove('is-covered');
      this.bookPage = null;
    });
    this.bookPage = shut;
  }

  private closeBookPage(): void {
    const p = this.bookPage;
    this.bookPage = null;
    p?.();
  }

  private rememberFocus(): void {
    if (this.returnFocus) return;
    const a = document.activeElement;
    this.returnFocus = a instanceof HTMLElement && a !== document.body ? a : null;
  }

  private restore(): void {
    const r = this.returnFocus;
    this.returnFocus = null;
    if (!r || this.anyOpen) return;
    // (Round 9, U4: a room drawn again while the books were open has the same control under the same focus key.)
    const fk = r.dataset.fk;
    const to = r.isConnected ? r : fk ? Array.from(document.querySelectorAll<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`)).find((e) => !e.closest('[inert], [hidden]')) : null;
    to?.focus({ preventScroll: true });
  }
}
