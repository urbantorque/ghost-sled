import type { MedalSet, MountainCard, ScreenRect, TitleDoor, TitleModel, TitleTrial, UIHandlers } from './contract';
import type { InputMode } from '../game/input';
import { oldLinkLine } from '../game/challenge';
import { clock } from '../game/standing';
import { biomeArt } from './art';
import { h, kbd, Layer, padBtn, sr, type Ctx } from './dom';
import { fmt, metres, NBSP } from './fmt';
import { icon, type IconName } from './icons';
import { b9, ico9, medalDisc, ordinal9, sheetOpen } from './kit9';
import { EASE_OUT, play, reduced } from './motion';
import { pushRect } from './hud';
import { curly, nb, prizeLower } from './words';
import './trials.css';

// The title (round 9, U1): one job at a time. The main screen holds the logo; the mountains as a picker of chips with
// short names, the picked one larger with your best on it; Ride with its reason on it; one quiet line of what you are
// working toward; and four labelled doors (Daily and Cup, Progress, Garage, Settings). Each figure carries its word,
// and each thing is said once: the next duel is Ride's reason and nowhere else; the next unlock is the quiet line, so
// a locked chip shows only its lock; your gifts are on the Garage's door, where they are spent; your flame on the
// Daily's, where it is kept. A door opens a room from the logo's side (the bottom on a phone): rooms.ts, loaded on
// demand. Nothing loading is shown: a room's Choose waits for its field. Moving between mountains is a veil in the new
// place's own air (round 7), which also says the place's feeling, now that the logo carries no place line.

export interface TitleMenuHooks {
  openSleds(): void;
  openSettings(): void;
}

/**
 * Each place's feeling, on the veil that carries the title from one mountain to the next (ART.md 15, in a few
 * words). Round 9 took it from under the logo: the picked chip names the place, Ride rides it.
 */
const PLACES: Readonly<Record<string, string>> = {
  pinecrest: 'The bright day that turns to gold',
  frostfang: 'Blue hour, aurora, dawn',
  ember: 'Under the mountain’s breath',
  sakura: 'The spring morning',
  lanternfall: 'Where the lights come from',
  daily: 'One mountain, new every day',
  cup: 'One week, one field, one mood',
};

/** Short names, as a player says them: the picker's chips and Ride carry these. */
const SHORT: Readonly<Record<string, string>> = { pinecrest: 'Pinecrest', frostfang: 'Frostfang', ember: 'Ember', sakura: 'Sakura', lanternfall: 'Lanternfall' };

/** A mountain's short name, as a player says it: the table's, else its name without a leading "The" or a trailing kind
 *  of place ("The Old Run" is "Old Run", "Frostfang Glacier" "Frostfang"), so a mountain added later has one too. */
export function shortName(c: Pick<MountainCard, 'id' | 'name'>): string {
  return SHORT[c.id] ?? c.name.replace(/^The /, '').replace(/ (Glacier|Peak|Ridge|Mountain)$/, '');
}

/**
 * The picker's order: the unlock path (each mountain's unlockGhosts, gentlest first), the finale last, whatever the
 * order the mountains were registered in (round 9's three are appended to MOUNTAINS in phase B, between the five on the
 * path: Pinecrest 0, Frostfang 4, Gablefall 8, Ember 12, the Old Run 18, Sakura 24, Gullhaven 32, Lanternfall). A card
 * that does not say keeps its place among the rest.
 */
export function pickerOrder<T extends Pick<MountainCard, 'id' | 'biome' | 'unlockGhosts' | 'finale'>>(cards: readonly T[]): T[] {
  const last = (c: T): boolean => c.finale ?? (c.id === 'lanternfall' || c.biome === 'lantern');
  const at = (c: T, i: number): number => (last(c) ? Number.POSITIVE_INFINITY : (c.unlockGhosts ?? i));
  return cards
    .map((c, i) => ({ c, k: at(c, i), i }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.c);
}

/** More chips than this and the picker lays them out as two rows of four (eight mountains from phase B). */
const STRIP_ONE_ROW = 6;

/** The veil's beats (ms): it sweeps over the scene, the app builds the new mountain under it, the name holds long
 *  enough to read, and it sweeps on and off. screens.css (.gs-t-veil) carries the same figures. */
export const TRAVEL_TIMING = { IN_MS: 260, HOLD_MS: 420, OUT_MS: 460 } as const;

/** How long the quiet line says what opens a locked chip that was pressed. */
const LOCKED_SAY_MS = 3200;

const DOOR_LABEL: Record<TitleDoor, string> = { events: 'Daily and Cup', progress: 'Progress', garage: 'Garage', settings: 'Settings' };
const DOOR_ICON: Record<TitleDoor, IconName> = { events: 'flame', progress: 'book', garage: 'sledBold', settings: 'gear' };

/** Ride's prompt for the last input used: the Space keycap, the pad's A, or none for touch. */
function rideKey(mode: InputMode): HTMLElement | null {
  if (mode === 'touch') return null;
  const k = mode === 'gamepad' ? padBtn('A', 'gs-ride-key') : kbd('Space', 'gs-ride-key');
  k.setAttribute('aria-hidden', 'true');
  return k;
}

/** A room as the title holds it while open (rooms.ts). */
interface OpenRoom {
  door: TitleDoor;
  el: HTMLElement;
  close(): void;
  update(m: TitleModel): void;
}

export class Title {
  readonly layer: Layer;
  private readonly el: HTMLElement;
  /** The model on screen (the rooms read it; the capture scripts too). */
  model: TitleModel | null = null;
  /** The veil that carries the title from one mountain to the next, kept across renders so its sweep is never cut by
   *  the re-render it covers. */
  private readonly veil: HTMLElement;
  private readonly veilName: HTMLElement;
  private readonly veilLine: HTMLElement;
  private travelling = false;
  private travelTimers: number[] = [];
  /** The first-visit sound toggle: muted here, and the master volume it gives back. */
  private muted = false;
  private unmuteTo = 1;
  /** A locked chip just pressed: the quiet line says what opens it, for a moment. */
  private locked: MountainCard | null = null;
  private lockedTimer = 0;
  private main: HTMLElement | null = null;
  private aimEl: HTMLElement | null = null;
  private room: OpenRoom | null = null;
  /** The title's panels moved (a room opened or closed): the ghost tags' occluders are measured again (ui.ts). */
  onLayout: () => void = () => undefined;
  /** The intro lines whose door was opened this session (the app is told too, onIntroSeen). */
  private readonly seen = new Set<string>();
  private entered = false;

  constructor(
    parent: HTMLElement,
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
    private readonly hooks: TitleMenuHooks,
  ) {
    this.el = h('section', 'gs-title gs9-title');
    this.el.setAttribute('aria-label', 'Ghost Sled');
    parent.append(this.el);
    this.veilName = h('span', 'gs-t-veil-name');
    this.veilName.setAttribute('translate', 'no');
    this.veilLine = h('span', 'gs-t-veil-line');
    this.veil = h('div', 'gs-t-veil', h('span', 'gs-t-veil-slab'), h('span', 'gs-t-veil-txt', this.veilName, this.veilLine));
    this.veil.setAttribute('aria-hidden', 'true');
    this.veil.hidden = true;
    this.layer = new Layer(this.el, 220);
    window.addEventListener('resize', () => {
      if (this.layer.open) this.dock();
    });
  }

  /** A room is open over the title. */
  get roomOpen(): boolean {
    return this.room !== null;
  }

  show(m: TitleModel): void {
    if (m.master !== undefined) {
      this.muted = m.master <= 0;
      if (m.master > 0) this.unmuteTo = m.master;
    }
    const fresh = !this.layer.open;
    if (fresh) this.entered = false;
    const a = document.activeElement;
    const fk = !fresh && a instanceof HTMLElement && this.main?.contains(a) ? (a.dataset.fk ?? null) : null;
    const scroll = this.el.querySelector<HTMLElement>('.gs9-strip')?.scrollLeft ?? -1;
    this.model = m;
    this.render(m);
    this.layer.show();
    const strip = this.el.querySelector<HTMLElement>('.gs9-strip');
    if (strip && scroll >= 0 && !fresh) strip.scrollLeft = scroll;
    if (fk) this.el.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
    // A room open over the title takes the new model in place (its Choose appears once its field is in).
    if (this.room) {
      if (m.firstVisit) this.room.close();
      else this.room.update(m);
    }
    this.dock();
  }

  /**
   * Where a toast docks while the title is up (--title-dock on the UI root, used on phones held upright): just under
   * the logo, which sits at the top centre there. Layout offsets, so the entrance animation's transform never moves it.
   */
  private dock(): void {
    const logo = this.el.querySelector<HTMLElement>('.gs-logo');
    if (!logo) return;
    let y = logo.offsetHeight;
    for (let e: HTMLElement | null = logo; e && e !== this.el.parentElement; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
    this.el.parentElement?.style.setProperty('--title-dock', `${Math.round(y)}px`);
  }

  /** The title's panels, for the ghost tags to keep off (ui.ts occluders): each block of the main column (the picker's
   *  chips and the doors one by one, so their gaps stay open to the scene), and a room while one is open. */
  measure(out: ScreenRect[], n: number): number {
    if (!this.layer.open || !this.main) return n;
    for (const block of Array.from(this.main.children)) {
      if (block.classList.contains('gs9-pick') || block.classList.contains('gs9-doors')) for (const c of Array.from(block.querySelectorAll('.gs9-chip, .gs9-door, .gs9-seg'))) n = pushRect(out, n, c);
      else n = pushRect(out, n, block);
    }
    if (this.room) n = pushRect(out, n, this.room.el);
    return n;
  }

  hide(): void {
    this.room?.close();
    this.endTravel();
    window.clearTimeout(this.lockedTimer);
    this.locked = null;
    this.layer.hide();
  }

  /** The reel cut back to the start of its shot: a short dip of ink over the scene, so the loop reads as an edit.
   *  Nothing under reduced motion, and never over a veil already crossing. */
  cut(): void {
    if (!this.layer.open || this.travelling || reduced() || typeof this.el.animate !== 'function') return;
    const scrim = this.el.querySelector('.gs-title-dip');
    scrim?.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 520, easing: EASE_OUT });
  }

  /**
   * Picking another mountain is a designed move, not a swap: a veil in the new place's own air sweeps over the scene
   * from the logo's side, the app builds the mountain under it (`go`), the place's name and its line hold on the veil,
   * and it sweeps on off the far edge to show the new shot. Under reduced motion the mountain changes at once.
   */
  travel(id: string, name: string, go: () => void, line?: string): void {
    if (this.travelling) return;
    if (reduced() || typeof this.veil.animate !== 'function') {
      go();
      return;
    }
    this.travelling = true;
    this.veil.className = `gs-t-veil v-${id} is-in`;
    this.veilName.textContent = name;
    this.veilLine.textContent = line ?? PLACES[id] ?? '';
    this.veil.hidden = false;
    const T = TRAVEL_TIMING;
    this.travelTimers.push(
      window.setTimeout(() => {
        go();
        this.travelTimers.push(
          window.setTimeout(() => {
            this.veil.className = `gs-t-veil v-${id} is-out`;
            this.travelTimers.push(window.setTimeout(() => this.endTravel(), T.OUT_MS));
          }, T.HOLD_MS),
        );
      }, T.IN_MS),
    );
  }

  private endTravel(): void {
    for (const t of this.travelTimers) clearTimeout(t);
    this.travelTimers.length = 0;
    this.travelling = false;
    this.veil.hidden = true;
    this.veil.className = 'gs-t-veil';
  }

  /** The last input used changed while the title is up: Ride's prompt follows it (Space, the pad's A, or none). */
  setInputMode(mode: InputMode): void {
    const ride = this.el.querySelector<HTMLElement>('[data-fk="ride"]');
    if (!ride) return;
    ride.querySelector('.gs-ride-key')?.remove();
    const key = rideKey(mode);
    if (key) ride.append(key);
  }

  // ---------------------------------------------------------------- the main screen

  private render(m: TitleModel): void {
    const el = this.el;
    // (Everything but the veil and an open room: taking the veil out and putting it back would start its sweep again.
    // Round 9, U4: and a view pushed in the room, a sheet of its own here: a title drawn again as the rivals came in
    // took the view out from under the player, leaving the room covered and nothing on screen.)
    for (const c of Array.from(el.children)) if (c !== this.veil && c !== this.room?.el && !(this.room && c.classList.contains('gs9-sheet'))) c.remove();
    if (!this.veil.isConnected) el.append(this.veil);
    el.classList.toggle('is-first', m.firstVisit);
    el.classList.toggle('has-challenge', m.challenge !== null);
    el.prepend(h('div', 'gs9-t-pool'), h('div', 'gs-title-dip'));
    const main = h('div', 'gs9-t');
    this.main = main;
    main.append(logo());
    if (m.firstVisit) main.append(h('p', 'gs9-t-tagline', 'Race the ghosts of every great run.'));
    else main.append(this.picker(m));
    main.append(this.rideBlock(m));
    const how = m.firstVisit ? null : this.how(m);
    if (how) main.append(how);
    this.aimEl = this.aim(m);
    main.append(this.aimEl);
    // A first visit has no doors (and so no Settings): one labelled Sound toggle stands where they will, at the column's
    // foot, so a new player can mute before the first run starts any music. (Round 9, the feelui lane: in the top right
    // corner it sat over the logo's last letter on a phone, where the logo is centred.)
    main.append(m.firstVisit ? this.soundToggle() : this.doors(m));
    // While a room is open the screen under it stays inert (the room gives it back as it closes).
    if (this.room) main.inert = true;
    el.insertBefore(main, this.veil);
    // The column arrives from the logo's side once, top to bottom (ART.md 10: a screen comes and goes the way it is
    // built); a re-render (a mountain picked, the rivals in) swaps in place. Reduced motion: no movement (tokens.css).
    if (!this.entered) {
      this.entered = true;
      Array.from(main.children).forEach((c, i) => {
        const e = c as HTMLElement;
        e.classList.add('gs9-enter');
        e.style.setProperty('--from-x', '-18px');
        e.style.setProperty('--from-y', '0px');
        e.style.setProperty('--delay', `${i * 60}ms`);
      });
    }
  }

  /** The picker: a chip a mountain, its sky and its short name; the picked one larger, with your best on it. */
  private picker(m: TitleModel): HTMLElement {
    const strip = h('div', 'gs9-strip');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Where you ride');
    for (const c of pickerOrder(m.mountains)) strip.append(this.chip(c, c.id === m.selected));
    // (Eight mountains do not fit one row on a 1280 desk or a 390 px phone with every name whole: two rows of four.)
    strip.classList.toggle('is-many', m.mountains.length > STRIP_ONE_ROW);
    // A mouse wheel turns the strip when it scrolls (a phone's five chips).
    strip.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || strip.scrollWidth <= strip.clientWidth) return;
        strip.scrollLeft += e.deltaY;
        e.preventDefault();
      },
      { passive: false },
    );
    return h('div', 'gs9-pick', strip);
  }

  private chip(c: MountainCard, sel: boolean): HTMLButtonElement {
    const b = h('button', `gs9-chip b-${c.biome}${sel ? ' is-sel' : ''}${c.locked ? ' is-locked' : ''}`);
    b.type = 'button';
    b.dataset.fk = `m-${c.id}`;
    b.setAttribute('aria-pressed', String(sel));
    const sky = h('span', 'gs9-chip-sky gs-mtn-sky');
    sky.innerHTML = biomeArt(c.biome);
    if (c.locked) sky.append(h('span', 'gs9-chip-lock', ico9('lock')));
    // (Your best in words: a trophy beside a time read as a medal, or as someone else's record.)
    const best = sel && c.bestTime ? h('span', 'gs9-chip-best', 'Best', NBSP, h('span', 'gs9-num', clock(c.bestTime))) : null;
    if (best) sky.append(best);
    const name = h('span', 'gs9-chip-name', shortName(c));
    name.setAttribute('translate', 'no');
    b.append(sky, name);
    const rank = c.top ? 'Top of the ladder' : typeof c.rank === 'number' ? `${ordinal9(c.rank)} of ${c.rankOf ?? c.rank} on its ladder` : '';
    b.setAttribute('aria-label', c.locked ? `${c.name}. Locked. ${c.unlockText}` : `${c.name}${c.bestTime ? `. Your best ${clock(c.bestTime)}` : ''}${rank ? `. ${rank}` : ''}`);
    if (c.locked) b.title = c.unlockText;
    b.addEventListener('click', () => {
      if (c.locked) {
        this.ctx.sound('back');
        play(b, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 300, easing: 'ease-out' });
        // The quiet line says what opens it, for a moment, then goes back to the nearest goal.
        this.locked = c;
        this.renderAim();
        window.clearTimeout(this.lockedTimer);
        this.lockedTimer = window.setTimeout(() => {
          if (this.locked !== c) return;
          this.locked = null;
          this.renderAim();
        }, LOCKED_SAY_MS);
        return;
      }
      this.ctx.sound('tap');
      if (!sel) this.travel(c.id, c.name, () => this.hd.onSelectMountain(c.id));
    });
    return b;
  }

  /** Ride, and over it a friend's challenge or the Trial's rule and targets when either is what it rides. */
  private rideBlock(m: TitleModel): HTMLElement {
    const box = h('div', 'gs9-t-ride');
    if (m.challenge) box.append(challengeBanner(m.challenge));
    else if (m.selected === 'trial' && m.trial) box.append(trialPanel(m.trial));
    const w = titleRide(m);
    // A link's Daily or Cup is still finding its rivals: Ride waits (aria-disabled, so it keeps its focus and its
    // name) and says nothing about it: nothing loading is shown.
    const waiting = !!m.challenge?.waiting;
    const why = h('span', 'gs9-ride-why', w.why);
    if (w.who || m.challenge) why.setAttribute('translate', 'no');
    const t = h('span', 'gs9-ride-t', h('span', 'gs9-ride-v', w.verb), why);
    const b = b9(this.ctx, 'primary', [t, rideKey(m.inputMode)], { icon: 'play', fk: 'ride', sound: waiting ? 'tap' : 'confirm', gameKey: true, aria: w.aria, cls: 'gs9-ride gs-ride', onClick: () => (waiting ? undefined : this.hd.onRide()) });
    if (waiting) b.setAttribute('aria-disabled', 'true');
    if (m.inputMode !== 'touch') b.setAttribute('aria-keyshortcuts', 'Space');
    box.append(b);
    return box;
  }

  /** How you ride the picked mountain, under Ride once open: its hour (the day or the other hour, each with a swatch of
   *  its sky) and its mirror. On a phone the picked mountain's best stands here too (its chip is small). */
  private how(m: TitleModel): HTMLElement | null {
    const named = m.mountains.find((x) => x.id === m.selected) ?? null;
    if (!named || m.challenge) return null;
    const out = h('div', 'gs9-how');
    if (named.bestTime) out.append(h('span', 'gs9-how-best', 'Best', NBSP, h('span', 'gs9-num', clock(named.bestTime))));
    const name = named.name;
    if (m.hour) {
      const hr = m.hour;
      const seg = h('div', 'gs9-seg');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'Hour');
      for (const alt of [false, true]) {
        const [z, hz] = alt ? hr.alt : hr.day;
        // (Each sky carries its light, so two skies near one colour still read as two hours: Ember's day and night
        // were one brown. Round 9, the polish lane.)
        const sw = h('span', `gs9-swatch l-${hourLight(alt ? hr.name : 'Day')}`);
        sw.style.setProperty('--z', z);
        sw.style.setProperty('--hz', hz);
        sw.setAttribute('aria-hidden', 'true');
        const b = b9(this.ctx, 'quiet', [sw, alt ? hr.name : 'Day'], { fk: alt ? 'hour-alt' : 'hour-day', aria: alt ? `Ride ${name} ${hr.phrase}` : `Ride ${name} by day`, onClick: () => this.hd.onHour?.(alt) });
        b.setAttribute('aria-pressed', String(hr.on === alt));
        seg.append(b);
      }
      out.append(seg);
    }
    // The mirror is a switch, on or off, as settings' switches are, apart from the hour's pair (one of two): drawn as a
    // third pill beside them it read as a third hour. Round 9, the polish lane. (A mirror not yet open says nothing here,
    // the five's and the new mountains' alike: a new one's way in, its three home riders, is said on its board under
    // them. Round 9, the feelui lane, DECISIONS 404: on the title it cost five words a new mountain's title did not have.)
    if (m.mirror) {
      const on = m.mirror.on;
      const b = b9(this.ctx, 'quiet', ['Mirrored', h('span', 'gs9-switch')], { fk: 'mirror', aria: `Ride ${name} mirrored`, cls: 'gs9-mirror', onClick: () => this.hd.onMirror?.(!on) });
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', String(on));
      out.append(b);
    }
    if (out.childElementCount === 1 && named.bestTime) out.classList.add('is-best-only');
    return out.childElementCount > 0 ? out : null;
  }

  private aim(m: TitleModel): HTMLElement {
    const a = titleAim(m, this.locked);
    const el = h('p', `gs9-t-aim is-${a.tone}`, ico9(a.icon), h('span', '', curly(a.text)));
    el.setAttribute('aria-live', 'polite');
    return el;
  }

  private renderAim(): void {
    const m = this.model;
    if (!m || !this.aimEl) return;
    const el = this.aim(m);
    this.aimEl.replaceWith(el);
    this.aimEl = el;
  }

  // ---------------------------------------------------------------- the doors

  private doors(m: TitleModel): HTMLElement {
    const nav = h('nav', 'gs9-doors');
    nav.setAttribute('aria-label', 'More');
    for (const d of ['events', 'progress', 'garage', 'settings'] as TitleDoor[]) nav.append(this.door(d, m));
    return nav;
  }

  /** The intro this door carries: something new, until the door is opened. */
  private introFor(d: TitleDoor, m: TitleModel): string | null {
    const i = m.spine?.intro ?? null;
    return i && i.door === d && !this.seen.has(i.line) ? i.line : null;
  }

  private door(d: TitleDoor, m: TitleModel): HTMLButtonElement {
    const sp = m.spine ?? null;
    let status: string | null = null;
    let aria: string = DOOR_LABEL[d];
    // Each door wears the one figure that belongs to it, with its word: the flame on the Daily's (it is kept by
    // riding), the gifts on the Garage's (they are spent there). Progress wears none: its room says Rider Rank whole.
    if (d === 'events' && sp && sp.flame.streak > 0) {
      const n = sp.flame.streak;
      status = `${n}-day flame`;
      aria += `. Your flame: ${n} ${n === 1 ? 'day' : 'days'}${sp.flame.litToday ? ', lit today' : ', ride today to keep it'}`;
    } else if (d === 'progress' && sp) aria += `. Rider Rank ${sp.bar.page}`;
    else if (d === 'garage') aria += `. ${fmt(m.wallet)} gifts to spend`;
    // (A reader hears what is behind a room's door, so every system is named from the title.)
    if (d === 'events') aria += `. Inside: your flame, today's Daily and contracts, this week's Cup and its league${m.trial ? ', the Trial' : ''}`;
    else if (d === 'progress') aria += `. Inside: the Almanac, The Twelve${sp?.longNight ? ', the Long Night' : ''}${sp?.album ? ', the Spirit Album' : ''}, medals and mastery stars, and missions`;
    const intro = this.introFor(d, m);
    // (A phone under 340 px says "Daily & Cup", so the door's words keep one line over its flame; screens.css.)
    const label = d === 'events' ? h('span', 'gs9-door-l', h('span', 'gs9-door-long', DOOR_LABEL[d]), h('span', 'gs9-door-short', 'Daily & Cup')) : h('span', 'gs9-door-l', DOOR_LABEL[d]);
    // (The gifts drawn as the results and the garage draw them: the glyph, the figure and its word, in marigold. Round
    // 9, the polish lane: in the door's grey they were a third look for one currency, ART.md 1.)
    const said = d === 'garage' ? h('span', 'gs9-door-s is-gift', ico9('gift'), h('span', 'gs9-num', `${fmt(m.wallet)}${NBSP}gifts`)) : status ? h('span', `gs9-door-s${d === 'events' ? ' is-flame' : ''}`, status) : null;
    const words = h('span', 'gs9-door-t', label, said);
    const b = b9(this.ctx, 'secondary', [words, intro ? h('span', 'gs9-tag is-gift gs9-new', 'New') : null], { icon: DOOR_ICON[d], fk: `door-${d}`, cls: 'gs9-door', aria: intro ? `${aria}. Something new` : aria, onClick: () => this.openDoor(d, b) });
    if (d === 'events' || d === 'progress') b.setAttribute('aria-haspopup', 'dialog');
    return b;
  }

  private openDoor(d: TitleDoor, from: HTMLButtonElement): void {
    const m = this.model;
    if (!m) return;
    const intro = this.introFor(d, m);
    if (intro) {
      this.seen.add(intro);
      this.hd.onIntroSeen?.(intro);
      from.querySelector('.gs9-new')?.remove();
      from.setAttribute('aria-label', (from.getAttribute('aria-label') ?? '').replace(/\. Something new$/, ''));
    }
    if (d === 'garage') return this.hooks.openSleds();
    if (d === 'settings') return this.hooks.openSettings();
    if (this.room || sheetOpen()) return;
    // The rooms load on demand (not in the first download).
    void import('./rooms').then((r) => {
      if (!this.layer.open || this.room || !this.model || !this.main) return;
      const main = this.main;
      const room = r.openRoom(d, this.model, {
        ctx: this.ctx,
        hd: this.hd,
        parent: this.el,
        from,
        behind: [main],
        intro,
        travel: (id, name, go, line) => this.travel(id, name, go, line),
        onClose: () => {
          this.room = null;
          if (this.main) this.main.inert = false;
          this.onLayout();
        },
      });
      this.room = { door: d, ...room };
      this.onLayout();
    });
  }

  /**
   * Mute, as a toggle with its words ("Sound On", "Sound Off"). It sets the master volume (0, or what it was before),
   * the same setting the Settings door shows once the doors appear.
   */
  private soundToggle(): HTMLButtonElement {
    const label = h('span', 'gs9-b-t', this.muted ? 'Sound Off' : 'Sound On');
    const b = b9(this.ctx, 'quiet', label, {
      icon: 'speaker',
      fk: 'sound',
      // (Named "Sound", its state pressed or not: the visible words say the same, and contain the name.)
      aria: 'Sound',
      cls: 'gs9-sound',
      onClick: () => {
        this.muted = !this.muted;
        this.hd.onSettings({ master: this.muted ? 0 : this.unmuteTo });
        paint();
      },
    });
    const glyph = b.querySelector('.gs-i');
    const on = glyph?.innerHTML ?? '';
    const paint = () => {
      b.setAttribute('aria-pressed', String(!this.muted));
      label.textContent = this.muted ? 'Sound Off' : 'Sound On';
      if (glyph) glyph.innerHTML = this.muted ? MUTED_SVG : on;
    };
    paint();
    return b;
  }
}

/** Ride's words: the verb, and its reason (what this run is for), in this order: a friend's challenge; The Twelve's
 *  next duel here; the Daily, the Cup or the Trial picked; your grudge waiting here; the rung above you on this
 *  mountain's ladder; the mountain itself. A duel's reason says the duel, never the rider's time: their slower time
 *  beside your faster best read as already beaten (DECISIONS 391). */
export function titleRide(m: TitleModel): { verb: string; why: string; aria: string; who: string | null } {
  const sel = m.mountains.find((x) => x.id === m.selected) ?? null;
  const name = sel ? shortName(sel) : '';
  if (m.firstVisit && !m.challenge) return { verb: 'Ride', why: sel?.name ?? 'Pinecrest', aria: `Ride ${sel?.name ?? 'Pinecrest'}`, who: null };
  const raced = m.challenge && (m.challenge.old || m.challenge.mountain) ? m.challenge : null;
  if (raced) return { verb: 'Accept', why: raced.mountain, aria: `Accept: ${raced.mountain}`, who: null };
  if (m.selected === 'trial' && m.trial) return { verb: 'Ride', why: 'This week’s Trial', aria: `Ride this week's Trial: ${m.trial.name}. ${m.trial.rule}`, who: null };
  if (m.selected === 'daily') {
    const t = m.daily.time ?? 0;
    return { verb: 'Ride', why: t > 0 ? `Today’s Daily. Best ${clock(t)}` : 'Today’s Daily. Keeps your flame lit', aria: "Ride today's Daily", who: null };
  }
  if (m.selected === 'cup') {
    const b = m.cup?.best ?? 0;
    return { verb: 'Ride', why: b > 0 ? `This week’s Cup. Best ${clock(b)}` : 'This week’s Cup', aria: "Ride this week's Cup", who: null };
  }
  const mirrored = !!m.mirror?.on;
  const hour = m.hour?.on ? m.hour : null;
  const where = `${name}${hour ? ` ${hour.phrase}` : ''}${mirrored ? ', mirrored' : ''}`;
  const tw = m.twelve ?? null;
  if (tw?.next?.here && tw.rides !== false && !mirrored) return { verb: 'Duel', why: `${tw.next.name}, head to head`, aria: `Duel ${tw.next.name} on ${tw.next.mountain}, head to head`, who: tw.next.name };
  if (tw?.final?.here && tw.rides !== false && !mirrored) return { verb: 'Ride', why: 'The last race, all twelve', aria: `Ride the last race: all twelve of The Twelve on ${tw.final.mountain}`, who: null };
  const grudge = m.greet ? /^(?:Your nemesis )?(.+) is waiting on /.exec(m.greet) : null;
  if (grudge && !mirrored) return { verb: 'Ride', why: `${grudge[1]} is waiting`, aria: `Ride ${where}. ${grudge[1]} is waiting here`, who: grudge[1] };
  const rung = /^Next: (.+), [\d:.]+, ([\d.]+ s) up$/.exec(m.nextRung ?? '');
  if (rung && !mirrored && !hour) return { verb: 'Ride', why: `${rung[1]} is ${nb(rung[2])} ahead`, aria: `Ride ${where}. ${rung[1]} is ${rung[2]} ahead of you on its ladder`, who: rung[1] };
  // (The picked chip names the place: Ride says how it rides, or what it is like, never its name a second time.)
  const how = [hour ? hour.phrase.charAt(0).toUpperCase() + hour.phrase.slice(1) : '', mirrored ? (hour ? 'mirrored' : 'Mirrored') : ''].filter(Boolean).join(', ');
  return { verb: 'Ride', why: how || (sel?.tagline ?? where), aria: `Ride ${where}`, who: null };
}

/** The one quiet line: the nearest thing you are working toward, in words, and never what Ride already says. A
 *  locked chip just pressed (what opens it); the next mountain by ghosts; Lanternfall by The Twelve; the next page of
 *  the Almanac, named as a prize. Nine words at most (ART.md 10): each says the goal and how far, in the same words
 *  whichever way it comes ("3 more ghosts open The Old Run"). */
export function titleAim(m: TitleModel, locked: MountainCard | null = null): { icon: IconName; text: string; tone: 'ghost' | 'plain' } {
  if (m.firstVisit) return { icon: 'ghost', text: 'Pass ghosts to unlock new mountains', tone: 'ghost' };
  const c = locked;
  if (c) {
    // (Round 9, the polish lane: "The Old Run: pass 3 more ghosts to open it" was ten words; the line's own sentence
    // for that mountain is six.)
    const g = /^Pass (\d+) more ghosts? to unlock$/.exec(c.unlockText);
    const tw = /^Beat (\d+) more of The Twelve to unlock$/.exec(c.unlockText);
    if (g) return { icon: 'lock', text: `${g[1]} more ${g[1] === '1' ? 'ghost opens' : 'ghosts open'} ${c.name}`, tone: 'plain' };
    if (tw) return { icon: 'lock', text: twelveAim(tw[1], c.name), tone: 'plain' };
    const what = c.unlockText.replace(/ to unlock$/, '').replace(/^Pass/, 'pass').replace(/^Beat/, 'beat');
    return { icon: 'lock', text: `${c.name}: ${what} to open it`, tone: 'plain' };
  }
  const byGhosts = m.mountains
    .filter((x) => x.locked && /ghost/.test(x.unlockText))
    .map((x) => ({ c: x, n: Number(/(\d+)/.exec(x.unlockText)?.[1] ?? 999) }))
    .sort((a, b) => a.n - b.n)[0];
  if (byGhosts) return { icon: 'ghost', text: `${fmt(byGhosts.n)} more ${byGhosts.n === 1 ? 'ghost opens' : 'ghosts open'} ${byGhosts.c.name}`, tone: 'ghost' };
  const lf = m.mountains.find((x) => x.locked && /Twelve/.test(x.unlockText));
  if (lf) return { icon: 'trophy', text: twelveAim(/(\d+)/.exec(lf.unlockText)?.[1] ?? '', lf.name), tone: 'plain' };
  const bar = m.spine?.bar;
  const next = bar?.next?.[0];
  // (How far, then the prize: "1,281 XP to the Crane's Memory charm". Round 9, the polish lane: with "Rider Rank 26:"
  // between them the line was ten words against ART.md's nine; the prize and the XP are what it is for, and the
  // Progress door's room names the rank whole.)
  if (bar && next) return { icon: 'book', text: `${fmt(bar.need)}${NBSP}XP to ${prizeLower(next)}`, tone: 'plain' };
  return { icon: 'book', text: 'Every page of the Almanac turned', tone: 'plain' };
}

/** The finale's goal by The Twelve, in seven words: the place, then what opens it ("Lanternfall: beat 9 more of The
 *  Twelve"). Round 9, the feelui lane, DECISIONS 404: "Beat 9 more of The Twelve to open Lanternfall" was nine, and with
 *  eight chips the run-50 title went past its forty; the count and its word are kept. */
function twelveAim(n: string, name: string): string {
  return n ? `${name}: beat ${n} more of The Twelve` : `${name}: beat more of The Twelve`;
}

const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;

/** The light an hour's swatch carries, by the hour's name (palette.ts ALT_HOURS): the sun high, the sun low, the moon,
 *  a glow under the range, a lamp. */
export function hourLight(name: string): 'sun' | 'low' | 'moon' | 'glow' | 'lamp' {
  if (/night|moon/i.test(name)) return 'moon';
  if (/dusk|evening|sunset/i.test(name)) return 'low';
  if (/first light|dawn/i.test(name)) return 'glow';
  if (/lamp/i.test(name)) return 'lamp';
  return 'sun';
}

/** What a row of medals says to a reader: "Stage 1 gold, whole run bronze", only what you hold. */
export function medalWords(m: MedalSet): string {
  const parts = m.stages.flatMap((x, i) => (x > 0 ? [`Stage ${i + 1} ${MEDAL[x].toLowerCase()}`] : []));
  if (m.run > 0) parts.push(`whole run ${MEDAL[m.run].toLowerCase()}`);
  return parts.length > 0 ? `Medals: ${parts.join(', ')}` : 'No medals yet';
}

/**
 * A row of medal discs: one per stage, a hairline, then the larger whole-run disc. A disc you do not hold is an empty
 * ring. `fresh` lands those this run raised (0 to 2 a stage, 3 the whole run); `quiet` leaves the words to its parent,
 * whose own name says them.
 */
export function medalDots(m: MedalSet, fresh: readonly number[] = [], quiet = false): HTMLElement {
  const dot = (v: number, at: number, run: boolean): HTMLElement => h('span', `gs-mdot m-${Math.max(0, Math.min(3, Math.floor(v)))}${run ? ' is-run' : ''}${fresh.includes(at) ? ' is-new' : ''}`);
  const row = h('span', 'gs-mdots', ...m.stages.map((v, i) => dot(v, i, false)), m.stages.length > 0 ? h('span', 'gs-mdots-sep') : null, dot(m.run, 3, true));
  if (quiet) row.setAttribute('aria-hidden', 'true');
  else {
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', medalWords(m));
  }
  return row;
}

/**
 * Round 8, the trials lane: the Trial picked, over Ride. Round 9 (U4): one ink card in the round's language, every
 * figure with its word. Where it rides ("Mirrored Sakura Ridge in the Evening": no chip is picked while it is); its rule,
 * under the star; then the three targets as the medals they win ("Bronze 13, Silver 16,
 * Gold 18 perfects", each with its disc, a target already won struck through); then your best this week and the days
 * it has left. Until its field is in, the rule alone (nothing loading is shown).
 */
function trialPanel(t: TitleTrial): HTMLElement {
  // (Where it rides first: no chip is picked while the Trial is, so the card names the place and its twist.)
  const where = h('p', 'gs9-trial-where', curly(t.name));
  where.setAttribute('translate', 'no');
  const box = h('div', 'gs9-trial', where, h('p', 'gs9-trial-rule', ico9('star'), h('span', '', curly(t.rule))));
  if (t.targets) {
    const goals = h('p', 'gs9-trial-goals');
    t.targets.forEach((v, i) => {
      const held = t.medal > i;
      const goal = h('span', `gs9-trial-goal${held ? ' is-held' : ''}`, medalDisc(i + 1), h('span', 'gs9-num', `${MEDAL[i + 1]} ${v}${i === 2 && t.unit ? ` ${t.unit}` : ''}`), held ? sr(', held') : null);
      goals.append(goal);
    });
    box.append(goals, h('p', 'gs9-trial-left', t.best ? `Your best this week ${t.best}. ${t.left}.` : `${t.left}.`));
  }
  return box;
}

/** The speaker glyph struck out, in the icon family's 2 px round strokes. */
const MUTED_SVG =
  '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.8 9.4l5.2 5.2M21 9.4l-5.2 5.2"/></g></svg>';

function logo(): HTMLElement {
  const l = h('h1', 'gs-logo');
  l.setAttribute('aria-label', 'Ghost Sled');
  l.setAttribute('translate', 'no');
  const runner = h('span', 'gs-logo-runner');
  runner.innerHTML =
    '<svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 17H160c16 0 26-4 32-13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  l.append(h('span', 'gs-logo-l1', 'Ghost'), ' ', h('span', 'gs-logo-l2', 'Sled'), runner);
  return l;
}

/**
 * A friend's challenge: "Racing Mila's ghost" over "2:31.4 on Pinecrest" (their finish), or "2,340 m on Pinecrest" (how
 * far a run that did not finish went). One on another day's Daily or another week's Cup has no course left: "Mila's
 * race has closed". A link from an older course: "Mila rode 2,340 m on the old Pinecrest. Beat it."
 */
function challengeBanner(c: NonNullable<TitleModel['challenge']>): HTMLElement {
  if (c.old) {
    const line = h('span', 'gs-challenge-k', oldLinkLine({ name: c.name, distance: c.distance ?? 0, mountain: c.mountain }));
    line.setAttribute('translate', 'no');
    return h('div', 'gs-challenge', icon('ghost', 'gs-challenge-ico'), h('div', 'gs-challenge-txt', line));
  }
  const who = h('span', '', `${c.name}’s`);
  who.setAttribute('translate', 'no');
  const k = c.mountain ? h('span', 'gs-challenge-k', 'Racing ', who, ' ghost') : h('span', 'gs-challenge-k', who, ' race has closed');
  const where = c.daily ? (c.mountain ? 'the Daily Mountain' : '') : c.mountain;
  let v: HTMLElement | null = null;
  if (where) {
    const place = h('span', '', where);
    place.setAttribute('translate', 'no');
    v =
      typeof c.distance === 'number' && c.distance > 0
        ? h('span', 'gs-challenge-v', h('span', 'gs-num', typeof c.time === 'number' ? clock(c.time) : metres(c.distance)), ' on ', place)
        : h('span', 'gs-challenge-v', 'Beat a score of ', h('span', 'gs-num', fmt(c.score)), ' on ', place);
  }
  return h('div', 'gs-challenge', icon('ghost', 'gs-challenge-ico'), h('div', 'gs-challenge-txt', k, v));
}
