import './tokens.css';
import './style.css';
import './phone.css';
import type {
  AlbumModel,
  AlmanacModel,
  GameUI,
  GhostKind,
  HintKind,
  HudModel,
  LanternTownView,
  MissionView,
  ResultsModel,
  RevealModel,
  ScreenRect,
  SettingsModel,
  GarageShelf,
  PaintCard,
  SledCard,
  StyleTone,
  TitleModel,
  ToastTone,
  UIHandlers,
} from './contract';
import { ChaosEvent } from '../sim/chaos';
import type { Beat } from '../game/beats';
import type { InputMode, TouchVisual } from '../game/input';
import type { PadMenu } from '../game/pad';
import { BeatRouter } from './beatsui';
import { h, type Ctx, type UiSound } from './dom';
import { Fx } from './fx';
import { Hint } from './hint';
import { Hud, pushRect } from './hud';
import { closeTopSheet, sheetOpen, topSheet } from './kit9';
import { Menus } from './menus';
import type { GarageAct, GarageView } from './garageview';
import { Notices } from './notices';
import { PadNav } from './padnav';
import { Results } from './results';
import { Reveal } from './reveal';
import { Title } from './title';
import { TouchViz } from './touch';

/**
 * Optional hooks beyond the fixed contract. The title screen's Sleds and Settings buttons need the
 * game to supply data (SledCard[] / SettingsModel), and UIHandlers has no "open" intent for them.
 * When these are present the UI calls them and the game answers with showSleds / showSettings.
 * Without them, the UI reopens the last data it was given.
 */
export interface UIMenuHandlers {
  /** Opens the garage (round 9: at a piece when given, the results' "Ready in the shop": 'sled:3', 'hat:muffs'). */
  onOpenSleds?(piece?: string): void;
  onOpenSettings?(): void;
}

const GAME_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
/** Keys a focused UI control uses itself, kept away from the game's window-level key handler. */
const CONTROL_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

const DEFAULT_SETTINGS: SettingsModel = { master: 1, music: 0.8, sfx: 1, quality: 'auto', currentTier: 'high', hints: true, rumble: true };

export class UI implements GameUI {
  private readonly el: HTMLElement;
  private readonly title: Title;
  private readonly hud: Hud;
  private readonly fx: Fx;
  private readonly notices: Notices;
  /** Turns the director's beats into fx, race-row and banner calls. */
  private readonly router: BeatRouter;
  private readonly revealer: Reveal;
  private readonly hints: Hint;
  private readonly results: Results;
  private readonly menus: Menus;
  private readonly touch: TouchViz;
  private readonly padNav = new PadNav();
  private readonly hd: UIHandlers & UIMenuHandlers;
  private readonly loadEl: HTMLElement;
  private loadShown = false;
  private lastLoad = -1;
  private gameKeyAt = -1e9;
  private inputMode: InputMode = 'keyboard';
  private modeSet = false;
  /** The player has steered and drifted: touch zone outlines are gone for good. */
  private learned = false;
  /** The hint the game asked for, and whether it is on screen (one already performed is not). */
  private hintKind: HintKind | null = null;
  private hintUp = false;
  /** Drifted or drafted this run: those hints go the moment it happens and stay gone until the next run. */
  private didDrift = false;
  private didDraft = false;
  /** Occluder rects: a reused pool, and the array handed to the world (the first n of the pool). */
  private readonly occPool: ScreenRect[] = [];
  private readonly occ: ScreenRect[] = [];
  private occDirty = false;
  private occRO: ResizeObserver | null = null;
  private readonly occProbe: HTMLElement;

  constructor(root: HTMLElement, handlers: UIHandlers & UIMenuHandlers) {
    const hd = handlers;
    this.hd = hd;
    this.el = h('div', 'gs-ui');
    root.append(this.el);

    const ctx: Ctx = {
      sound: (kind: UiSound) => hd.onUiSound(kind),
      gameKeyJustPressed: () => performance.now() - this.gameKeyAt < 600,
    };

    // Keyboard routing. A focused control keeps the keys it uses (arrows on a slider, Space on a
    // button) so the game does not steer or ride at the same time. Ride and Run again are mapped by
    // the game to Space/Enter already, so for those the game gets the key and the click is dropped.
    this.el.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      // Inside the results card the scroll keys scroll the details. Up and Down are also the game's
      // action keys, and on this screen the action is Run again: reading below the fold must never
      // start a run. Space and Enter stay Run again.
      if (SCROLL_KEYS.has(e.code) && this.results.layer.open && this.results.layer.el.contains(t) && !(t instanceof HTMLInputElement)) {
        e.stopPropagation();
        e.preventDefault();
        if (!e.repeat || e.code === 'ArrowUp' || e.code === 'ArrowDown') this.results.scrollKey(e.code);
        return;
      }
      const control = t.tagName === 'BUTTON' || t.tagName === 'INPUT';
      if (!control) return;
      if (t.dataset.gamekey !== undefined && GAME_KEYS.has(e.code)) {
        this.gameKeyAt = performance.now();
        return;
      }
      // Arrows steer during a run even if the HUD pause button holds focus.
      if (ARROWS.has(e.code) && this.hud.el.contains(t)) return;
      if (CONTROL_KEYS.has(e.code)) e.stopPropagation();
    });

    // A mouse or touch press on a non-modal surface (HUD, title, results) must not leave focus on
    // the button: Space and Enter belong to the game there (ride, run again, crouch), and a focused
    // button would take them instead. Keyboard activation (detail 0) keeps focus as usual. Menus
    // (pause, sheets) keep focus so keyboard users stay inside the dialog.
    this.el.addEventListener(
      'click',
      (e) => {
        if (e.detail === 0) return;
        const t = e.target instanceof Element ? e.target.closest('button') : null;
        // (Round 9: a room or Details is a sheet too, and keeps focus inside it.)
        if (!t || this.menus.contains(t) || t.closest('.gs9-sheet')) return;
        t.blur();
      },
      true,
    );

    // Round 9: Escape and Backspace go back (back(), above): on the window's bubbling phase, so photo mode, which
    // takes every key at capture while it is open, keeps its own Escape. A field being typed in keeps Backspace.
    window.addEventListener('keydown', (e) => {
      if ((e.code !== 'Escape' && e.code !== 'Backspace') || e.repeat) return;
      const t = e.target;
      if (e.code === 'Backspace' && t instanceof HTMLElement && (t.isContentEditable || (t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox'))) return;
      if (this.back()) e.preventDefault();
    });

    this.touch = new TouchViz(this.el);
    this.hud = new Hud(this.el, ctx, hd);
    this.fx = new Fx(this.el, this.hud);
    this.hints = new Hint(this.el);
    this.notices = new Notices(this.el);
    this.router = new BeatRouter(this.hud, this.fx, this.notices);
    this.revealer = new Reveal(this.notices.revealSlot, this.hud);
    this.menus = new Menus(this.el, ctx, hd);
    this.title = new Title(this.el, ctx, hd, {
      openSleds: () => this.openGarage(),
      openSettings: () => {
        if (hd.onOpenSettings) hd.onOpenSettings();
        else this.menus.showSettings(this.menus.lastSettings ?? DEFAULT_SETTINGS);
      },
    });
    // (Round 9: Details' "Open the Garage" takes the title's own way into the garage.)
    this.results = new Results(this.el, ctx, hd, { openGarage: () => this.openGarage() });
    // Menus are created before title/results for module wiring; keep them stacked on top.
    this.el.append(this.menus.pause.el, this.menus.sleds.el, this.menus.garage.el, this.menus.settings.el, this.menus.books.el);

    this.loadEl = h('div', 'gs-load');
    this.loadEl.setAttribute('role', 'progressbar');
    this.loadEl.setAttribute('aria-label', 'Loading…');
    this.loadEl.setAttribute('aria-valuemin', '0');
    this.loadEl.setAttribute('aria-valuemax', '100');
    this.loadEl.hidden = true;
    this.el.append(this.loadEl);
    this.menus.onChange = () => this.syncInert();

    // Occluder cache. Any HUD layout change marks it dirty; the rects are then read once, inside a
    // ResizeObserver callback, which runs right after the browser's own layout pass, so the reads
    // never force an extra layout. Re-observing a 1 px probe guarantees one callback per change.
    this.occProbe = h('div', 'gs-sr');
    this.occProbe.setAttribute('aria-hidden', 'true');
    this.el.append(this.occProbe);
    if (typeof ResizeObserver === 'function') this.occRO = new ResizeObserver(() => this.measureOcc());
    const dirty = () => this.markOcc();
    // A pass of yours flashing in the race row (at once, or after waiting out a landing stamp) is the
    // headline: minor callout lines roll up into the total.
    this.hud.onPassFlash = () => this.fx.yieldToPass();
    // While a duel (or its result) holds the pill, another ghost's pass or news is a line under the
    // combo meter.
    this.hud.onSideLine = (w) => this.fx.side(w);
    // A pass waiting under the banner that names its ghost ("GRUDGE SETTLED Mila") was said by it.
    this.hud.bannerName = () => this.notices.currentName;
    this.hud.onLayout = dirty;
    // (Round 9: a title's room opening or closing moves its panels.)
    this.title.onLayout = dirty;
    this.fx.onLayout = dirty;
    this.notices.onLayout = dirty;
    this.hints.onLayout = dirty;
    this.markOcc();
  }

  /** The garage, the one way in (the title's Garage door, and the results' Details when a sled is ready there). */
  private openGarage(): void {
    if (this.hd.onOpenSleds) this.hd.onOpenSleds();
    else if (this.menus.lastSleds) this.menus.showSleds(this.menus.lastSleds.cards, this.menus.lastSleds.wallet, this.menus.lastSleds.paints, this.menus.lastSleds.shelves, this.menus.lastSleds.lanterns);
  }

  /**
   * Round 9: Escape and Backspace close the top surface, as the pad's B does: a sheet (the garage, settings, the
   * books), else a room or Details (kit9.ts), and focus goes back to the control that opened it. In fullscreen the
   * browser takes Escape first (on CrazyGames it leaves fullscreen), so there a player presses it twice; Backspace and
   * B always work. The pause card keeps P and Start. Returns true when it closed something.
   */
  private back(): boolean {
    return this.menus.closeTop() || closeTopSheet();
  }

  private markOcc(): void {
    if (this.occDirty && this.occRO) return;
    this.occDirty = true;
    if (this.occRO) {
      this.occRO.unobserve(this.occProbe);
      this.occRO.observe(this.occProbe);
    }
  }

  private measureOcc(): void {
    if (!this.occDirty) return;
    this.occDirty = false;
    const pool = this.occPool;
    let n = this.hud.measure(pool, 0);
    if (this.hud.layer.open) {
      const stamp = this.fx.stampEl;
      if (stamp) n = pushRect(pool, n, stamp);
      // The cash-in figure (until it flies) and a lost combo's cracked figure (contract C8).
      n = this.fx.measure(pool, n);
      const banner = this.notices.current;
      if (banner) n = pushRect(pool, n, banner);
      for (const c of Array.from(this.notices.revealSlot.children)) n = pushRect(pool, n, c);
      // The hint where it lands (not mid-entry), and one still fading out after a swap.
      n = this.hints.measure(pool, n);
    }
    // The title's panels (while it is up), so its one ghost tag never sits on them.
    n = this.title.measure(pool, n);
    this.occ.length = 0;
    for (let i = 0; i < n; i++) this.occ.push(pool[i]);
  }

  occluders(): Array<{ x0: number; y0: number; x1: number; y1: number }> {
    // Without ResizeObserver, measure on demand (still only after a change).
    if (this.occDirty && !this.occRO) this.measureOcc();
    return this.occ;
  }

  mirrorRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.occDirty && !this.occRO) this.measureOcc();
    return this.hud.mirrorRect();
  }

  /** While a modal surface is up, everything beneath it is inert: no stray focus or clicks. */
  private syncInert(): void {
    const top = this.menus.topEl ?? (this.results.layer.open ? this.results.layer.el : null);
    // The notices layer holds no controls, and over the results it carries their feedback ("Challenge
    // link copied", "No ad available"), so it stays live and rises above the results scrim.
    const overResults = top !== null && top === this.results.layer.el;
    for (const child of Array.from(this.el.children)) {
      if (!(child instanceof HTMLElement) || child === this.loadEl) continue;
      child.inert = top !== null && child !== top && !(overResults && child === this.notices.el);
    }
    this.notices.el.classList.toggle('is-over-results', overResults);
  }

  get modal(): boolean {
    // (Round 9: a title's room is a sheet: Space and Enter do not ride under it.)
    return this.results.layer.open || this.menus.anyOpen || sheetOpen();
  }

  private setMode(mode: InputMode): void {
    if (mode === this.inputMode && this.modeSet) return;
    this.modeSet = true;
    this.inputMode = mode;
    this.el.classList.toggle('gs-touch-mode', mode === 'touch');
    this.el.classList.toggle('gs-pad-mode', mode === 'gamepad');
  }

  /** The last input used changed kind (keys, mouse, touch, pad): the glyphs on screen follow it at once,
   *  the title's prompt and a hint that is up included. */
  inputModeChanged(mode: InputMode): void {
    if (mode === 'gamepad') this.el.classList.add('gs-has-pad');
    this.setMode(mode);
    this.results.inputMode = mode;
    if (this.title.layer.open) this.title.setInputMode(mode);
    if (this.hintUp) this.hints.set(this.hintKind, mode, this.learned);
  }

  /**
   * The pad in the menus, once a frame (InputController.poll). A direction moves focus on whatever is on
   * top (a sheet or the pause card, else the results, else the title), A presses what is focused, B goes
   * back, and Start pauses a run or resumes it. Returns true when it took the A or Start press, so the
   * game does not also read it as Ride or Run again. While a run is being ridden it does nothing but
   * Start: the run reads the pad itself.
   */
  padMenu(p: PadMenu): boolean {
    const menu = this.menus.topEl;
    if (p.start && this.menus.pause.open) {
      if (menu === this.menus.pause.el) menu.querySelector<HTMLElement>('[data-fk="resume"]')?.click();
      return true;
    }
    // (Round 9: a room over the title or Details over the results is the scope, and modal: B closes it.)
    const sheet = menu ? null : topSheet();
    if (sheet && p.b) {
      this.back();
      return false;
    }
    const scope = menu ?? sheet ?? (this.results.layer.open ? this.results.layer.el : this.title.layer.open ? this.title.layer.el : null);
    if (!scope) {
      this.padNav.idle();
      if (p.start && this.hud.layer.open) {
        this.hd.onPause(true);
        return true;
      }
      return false;
    }
    // A pad plugged in and left alone while the keys or the mouse are used moves nothing and marks nothing.
    if (this.inputMode !== 'gamepad' && !p.a && !p.b && !p.start && p.x === 0 && p.y === 0) {
      this.padNav.idle();
      return false;
    }
    // In a sheet over the title, Start is not Ride.
    return this.padNav.step(p, scope, menu !== null || sheet !== null, performance.now()) || (p.start && (menu !== null || sheet !== null));
  }

  showTitle(m: TitleModel): void {
    this.setMode(m.inputMode);
    this.title.show(m);
    // Measured again once the panels have risen into place (the entrance is over by 620 ms).
    this.markOcc();
    window.setTimeout(() => this.markOcc(), 700);
  }

  hideTitle(): void {
    this.title.hide();
  }

  /** The title reel cut back to the start of its shot (round 7): the title dips over the cut. */
  titleCut(): void {
    this.title.cut();
  }

  showHud(): void {
    this.hud.show();
  }

  /** Whether the world draws the avalanche rear-view mirror (not on the Low tier). */
  setMirror(on: boolean): void {
    this.hud.setMirror(on);
  }

  hideHud(): void {
    this.hud.hide();
    this.fx.clear();
    this.revealer.finish();
    this.notices.clear();
    this.hintKind = null;
    this.hintUp = false;
    this.didDrift = false;
    this.didDraft = false;
    this.hints.set(null, this.inputMode, this.learned);
  }

  updateHud(m: HudModel): void {
    this.hud.update(m);
    // Each number once: a callout whose points are the whole combo total shows its label alone.
    this.fx.syncTotal(m.combo.active, m.combo.pending);
    // A hint the player is already doing goes at once (the game marks a drift only on its release,
    // and holds a hint on screen for a beat): "Hold while turning to drift" never sits under a drift.
    if (m.driftTier > 0 && !this.didDrift) {
      this.didDrift = true;
      this.syncHint();
    }
    if (m.draft > 0 && !this.didDraft) {
      this.didDraft = true;
      this.syncHint();
    }
  }

  /** True when the player has already performed this hint's move this run. */
  private performed(kind: HintKind): boolean {
    return (kind === 'drift' && this.didDrift) || (kind === 'draft' && this.didDraft);
  }

  private syncHint(): void {
    const k = this.hintKind;
    const up = k !== null && !this.performed(k);
    if (up === this.hintUp) return;
    this.hintUp = up;
    this.hints.set(up ? k : null, this.inputMode, this.learned);
  }

  popStyle(label: string, points: number, _mult: number, tone: StyleTone): void {
    this.fx.pop(label, points, tone);
  }

  comboBank(points: number, mult: number): void {
    this.fx.bank(points, mult);
  }

  toast(text: string, tone: ToastTone, sub?: string): void {
    this.notices.toast(text, tone, sub);
  }

  beats(list: readonly Beat[]): void {
    if (list.length) this.router.handle(list);
  }

  ghostPass(name: string, kind: GhostKind, passed: boolean): void {
    // Passes flash inside the race row. Settling the grudge is the one pass that is also a banner:
    // the game's "Grudge settled" toast from the same tick takes the ghost's name. One message per
    // beat: while a perfect-landing stamp is up the pass waits its turn (the Hud queues it).
    this.hud.flashPass(name, kind, passed);
    if (passed && kind === 'grudge') this.notices.grudge(name);
  }

  reveal(m: RevealModel): Promise<void> {
    return this.revealer.run(m);
  }

  warn(text: string, event: ChaosEvent): void {
    this.notices.warn(text, event);
    if (event === ChaosEvent.Avalanche) this.hud.expectChase();
  }

  hint(kind: HintKind | null, mode: InputMode, learned?: boolean): void {
    this.setMode(mode);
    if (learned !== undefined) this.learned = learned;
    this.hintKind = kind;
    const up = kind !== null && !this.performed(kind);
    this.hintUp = up;
    this.hints.set(up ? kind : null, mode, this.learned);
  }

  showResults(m: ResultsModel): void {
    this.results.inputMode = this.inputMode;
    this.hintKind = null;
    this.hintUp = false;
    this.hints.set(null, this.inputMode, this.learned);
    this.results.show(m);
    this.syncInert();
  }

  updateResults(m: ResultsModel): void {
    this.results.update(m);
  }

  hideResults(): void {
    this.results.hide();
    this.syncInert();
  }

  showPause(settings: SettingsModel, missions?: MissionView[]): void {
    this.menus.showPause(settings, missions);
  }

  hidePause(): void {
    this.menus.hidePause();
  }

  /** Round 9 (the shop lane): the garage over its place (menus.ts showGarage). */
  showGarage(v: GarageView, act: (a: GarageAct) => void): Promise<void> {
    return this.menus.showGarage(v, act);
  }

  /** Round 9: the purchase's line over the place, or none. */
  garageMoment(text: string | null): void {
    this.menus.garageMoment(text);
  }

  closeGarage(): void {
    this.menus.closeGarage();
  }

  showSleds(cards: SledCard[], wallet: number, paints?: PaintCard[], shelves?: GarageShelf[], lanterns?: LanternTownView[]): void {
    this.menus.showSleds(cards, wallet, paints, shelves, lanterns);
  }

  showSettings(m: SettingsModel): void {
    this.menus.showSettings(m);
  }

  showAlmanac(m: AlmanacModel): void {
    this.menus.showAlmanac(m);
  }

  showAlbum(m: AlbumModel): void {
    this.menus.showAlbum(m);
  }

  closeMenus(): void {
    this.menus.closeMenus();
  }

  touchVisual(v: TouchVisual, visible: boolean): void {
    this.touch.set(v, visible);
  }

  setRiderScreen(x: number, y: number): void {
    this.fx.setRider(x, y);
    this.hud.setRider(x, y);
  }

  setLoading(p: number | null): void {
    if (p === null) {
      if (!this.loadShown) return;
      this.loadShown = false;
      this.lastLoad = -1;
      this.loadEl.classList.add('is-done');
      window.setTimeout(() => {
        if (!this.loadShown) this.loadEl.hidden = true;
      }, 360);
      return;
    }
    const v = Math.max(0, Math.min(1, p));
    if (!this.loadShown) {
      this.loadShown = true;
      this.loadEl.hidden = false;
      this.loadEl.classList.remove('is-done');
    }
    if (Math.abs(v - this.lastLoad) < 0.002) return;
    this.lastLoad = v;
    this.loadEl.style.transform = `scaleX(${v.toFixed(3)})`;
    this.loadEl.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }
}
