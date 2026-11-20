import type { MedalSet, MissionView, MountainCard, TitleCup, TitleModel, TitleSpine, TitleTwelve, TwelveRung, UIHandlers } from './contract';
import { barShare } from './almanac';
import type { InputMode } from '../game/input';
import { oldLinkLine } from '../game/challenge';
import { clock } from '../game/standing';
import { MOUNTAINS } from '../sim/mountains';
import { biomeArt, riderBust } from './art';
import { btn, captureFocus, h, kbd, Layer, padBtn, restoreFocus, sr, type Ctx } from './dom';
import { dailyDate, fmt, metres, NBSP, progFigures } from './fmt';
import { icon } from './icons';
import { EASE_OUT, SPRING, play, reduced } from './motion';

// Title screen. Landscape: one column on the left reads logo, mountain cards, the Ride that rides
// them, then the menu row; wallet and the daily and Cup cards keep to the right, and the 3D scene owns
// the middle. Portrait: stacked, with Ride in the thumb zone. Each mountain card carries your rank and
// medals on it, and Ride names the rider above you.

export interface TitleMenuHooks {
  openSleds(): void;
  openSettings(): void;
}

/**
 * Each place's line under the logo and on the veil that carries the title from one mountain to the next:
 * the feeling ART.md 15 gives it, in a few words. The title is that mountain's key art, so the words under
 * the logo are the mountain's own.
 */
const PLACES: Readonly<Record<string, string>> = {
  pinecrest: 'The bright day that turns to gold',
  frostfang: 'Blue hour, aurora, dawn',
  ember: 'Under the mountain\u2019s breath',
  sakura: 'The spring morning',
  lanternfall: 'Where the lights come from',
  daily: 'One mountain, new every day',
  cup: 'One week, one field, one mood',
};

/** The veil's beats (ms): it sweeps over the scene, the app builds the new mountain under it, the name
 *  holds long enough to read, and it sweeps on and off. style.css (.gs-t-veil) carries the same figures. */
export const TRAVEL_TIMING = { IN_MS: 260, HOLD_MS: 420, OUT_MS: 460 } as const;

/** Medal names by rank (0 none). */
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;

/** Ride's prompt for the last input used: the Space keycap, the pad's A, or none for touch. */
function rideKey(mode: InputMode): HTMLElement | null {
  if (mode === 'touch') return null;
  return mode === 'gamepad' ? padBtn('A', 'gs-ride-key') : kbd('Space', 'gs-ride-key');
}

export class Title {
  readonly layer: Layer;
  private readonly el: HTMLElement;
  private popover: HTMLElement | null = null;
  private popKind: 'missions' | 'medals' | 'twelve' | 'flame' = 'missions';
  /** Round 8: the flame's button in the corner pill (its calendar's popover hangs under it). */
  private flameBtnEl: HTMLButtonElement | null = null;
  private missionsBtn: HTMLButtonElement | null = null;
  private medalsBtn: HTMLButtonElement | null = null;
  private twelveBtn: HTMLButtonElement | null = null;
  private io: IntersectionObserver | null = null;
  /** The veil that carries the title from one mountain to the next, kept across renders so its sweep is
   *  never cut by the re-render it covers. */
  private readonly veil: HTMLElement;
  private readonly veilName: HTMLElement;
  private readonly veilLine: HTMLElement;
  private travelling = false;
  private travelTimers: number[] = [];
  /** The first-visit sound toggle: muted here, and the master volume it gives back. */
  private muted = false;
  private unmuteTo = 1;

  constructor(
    parent: HTMLElement,
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
    private readonly hooks: TitleMenuHooks,
  ) {
    this.el = h('section', 'gs-title');
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
    document.addEventListener('pointerdown', (e) => {
      if (!this.popover) return;
      const t = e.target as Node | null;
      if (t && (this.popover.contains(t) || this.missionsBtn?.contains(t) || this.medalsBtn?.contains(t) || this.twelveBtn?.contains(t))) return;
      this.closeMissions();
    });
  }

  show(m: TitleModel): void {
    if (m.master !== undefined) {
      this.muted = m.master <= 0;
      if (m.master > 0) this.unmuteTo = m.master;
    }
    const fresh = !this.layer.open;
    const fk = fresh ? null : captureFocus(this.el);
    const oldTrack = this.el.querySelector<HTMLElement>('.gs-mtns');
    const keepScroll = !fresh && oldTrack ? oldTrack.scrollLeft : -1;
    const hadPopover = !fresh && this.popover !== null;
    const popKind = this.popKind;
    // A refresh while open (mountain picked, daily ready) swaps content in place: no entrance replay.
    this.el.classList.toggle('is-static', !fresh);
    this.render(m);
    this.layer.show();
    // The strip is centred on the selected card synchronously, before the first paint: deferring the
    // read to a frame later would show the strip at its start and then jump. One layout per title
    // render (opening it, picking a mountain) is the price.
    const track = this.el.querySelector<HTMLElement>('.gs-mtns');
    if (track) {
      if (keepScroll >= 0) track.scrollLeft = keepScroll;
      else {
        const sel = track.querySelector<HTMLElement>('.is-sel');
        if (sel) track.scrollLeft = Math.max(0, sel.offsetLeft - track.clientWidth / 2 + sel.offsetWidth / 2);
      }
    }
    if (hadPopover && popKind === 'medals') this.openMedals(m, false);
    else if (hadPopover && popKind === 'twelve') this.openTwelve(m, false);
    else if (hadPopover && popKind === 'flame' && m.spine) this.openFlame(m.spine, false);
    else if (hadPopover) this.openMissions(m.missions, false);
    restoreFocus(this.el, fk);
    this.dock();
  }

  /**
   * Where a toast docks while the title is up (--title-dock on the UI root, used on phones held
   * upright): just under the wordmark and its tagline, which sit at the top centre there and hid
   * "Challenge from an older Ghost Sled" under their letters. Layout offsets, so the entrance
   * animation's transform never moves it; read in the same layout pass as the strip's centring above.
   */
  private dock(): void {
    const main = this.el.querySelector<HTMLElement>('.gs-t-main');
    if (!main) return;
    const bottom = this.el.offsetTop + main.offsetTop + main.offsetHeight;
    this.el.parentElement?.style.setProperty('--title-dock', `${Math.round(bottom)}px`);
  }

  hide(): void {
    this.closeMissions();
    this.endTravel();
    this.layer.hide();
  }

  /** The reel cut back to the start of its shot: a short dip of ink over the scene, so the loop reads as
   *  an edit. Nothing under reduced motion, and never over a veil already crossing. */
  cut(): void {
    if (!this.layer.open || this.travelling || reduced() || typeof this.el.animate !== 'function') return;
    const scrim = this.el.querySelector('.gs-title-dip');
    scrim?.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 520, easing: EASE_OUT });
  }

  /**
   * Picking another mountain is a designed move, not a swap: a veil in the new place's own air sweeps over
   * the scene from the logo's side, the app builds the mountain under it (`go`), the place's name and its
   * line hold on the veil, and it sweeps on off the far edge to show the new shot. The controls stay
   * where they are, above it. Under reduced motion the mountain changes at once.
   */
  private travel(id: string, name: string, go: () => void): void {
    if (this.travelling) return;
    if (reduced() || typeof this.veil.animate !== 'function') {
      go();
      return;
    }
    this.travelling = true;
    this.closeMissions();
    this.veil.className = `gs-t-veil v-${id} is-in`;
    this.veilName.textContent = name;
    this.veilLine.textContent = PLACES[id] ?? '';
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

  /** The last input used changed while the title is up: Ride's prompt follows it (Space, the pad's A, or
   *  none for touch). */
  setInputMode(mode: InputMode): void {
    const ride = this.el.querySelector<HTMLElement>('[data-fk="ride"]');
    if (!ride) return;
    ride.querySelector('.gs-ride-key')?.remove();
    const key = rideKey(mode);
    if (key) ride.append(key);
  }

  private render(m: TitleModel): void {
    this.io?.disconnect();
    this.io = null;
    this.popover = null;
    const ctx = this.ctx;
    const el = this.el;
    // (Everything but the veil: taking it out and putting it back would start its sweep again mid-crossing.)
    for (const c of Array.from(el.children)) if (c !== this.veil) c.remove();
    if (!this.veil.isConnected) el.append(this.veil);
    el.classList.toggle('is-first', m.firstVisit);
    el.classList.toggle('has-challenge', m.challenge !== null);

    this.twelveBtn = null;
    el.prepend(h('div', 'gs-title-scrim'), h('div', 'gs-title-dip'));

    // Logo + tagline. A brand-new player reads the hook directly above the button that starts it:
    // on a phone that leaves the logo alone at the top, the sky and the rider's band open, and the
    // words on the ink floor under the scene instead of floating over the sky.
    const tagline = h('p', 'gs-tagline', 'Race the ghosts of every great run.');
    // A returning player reads the mountain picked under the logo: its name and the feeling of its key art.
    const placeLine = PLACES[m.selected];
    const picking = m.selected === 'daily' ? 'Daily Mountain' : m.selected === 'cup' ? 'Weekly Cup' : (m.mountains.find((x) => x.id === m.selected)?.name ?? '');
    const placeName = h('span', 'gs-t-place-n', picking);
    placeName.setAttribute('translate', 'no');
    const place = !m.firstVisit && placeLine && picking ? h('p', 'gs-t-place', placeName, h('span', 'gs-t-place-l', placeLine)) : null;
    el.append(h('div', 'gs-t-main gs-t-anim', logo(), m.firstVisit ? null : (place ?? tagline)));

    // Challenge banner + Ride.
    const ride = h('div', 'gs-t-ride gs-t-anim');
    if (m.firstVisit) ride.append(tagline);
    if (m.challenge) {
      // A friend's link opens on their ghost: "Racing Mila's ghost" over how far it went and where.
      ride.append(challengeBanner(m.challenge));
    } else if (m.greet && !m.firstVisit) {
      // A returning player gets one line over Ride: who is waiting, what is close, or the nearest
      // mission. It is read in context right above Ride, so it carries no live role.
      ride.append(greeting(m.greet));
    }
    const showKey = m.inputMode !== 'touch';
    // The button carries the choice it acts on. With the mountain cards on screen (the selected one
    // outlined right above it) its subline says what that mountain is like, so the cards keep to a
    // name and a lock line; a first visit has no cards, so it names the mountain, as does a challenge.
    // A picked mountain with no record of yours yet wears what it is like on its own card (its lower
    // half would stand empty), and the button names it instead.
    // The Daily and the Cup are picked from cards of their own, so the button names those itself.
    // With a ladder to climb it carries the name above you: what the next run is for.
    const sel = m.mountains.find((x) => x.id === m.selected) ?? m.mountains[0];
    const picked = m.selected === 'daily' ? 'Daily Mountain' : m.selected === 'cup' ? 'Weekly Cup' : null;
    const passed = m.firstVisit ? 0 : ghostsPassed(m);
    const bare = !picked && !!sel && !sel.locked && sel.best <= 0 && !sel.oldBest && passed <= 0;
    // Another day's Daily or another week's Cup: its course has gone, so nobody is being raced and the
    // button is the plain one. The banner says so rather than promising a ghost that will not ride.
    const raced = m.challenge && (m.challenge.old || m.challenge.mountain) ? m.challenge : null;
    // The Twelve: on the next rider's home ground the run is the duel, and the button says so.
    const tw = raced || m.firstVisit || picked ? null : (m.twelve ?? null);
    const duel = tw?.next?.here ? tw.next.name : tw?.final?.here ? 'The last race' : null;
    const verb = raced ? 'Accept' : tw?.next?.here ? 'Duel' : 'Ride';
    const where = raced ? raced.mountain : (picked ?? sel?.name ?? '');
    const aim = raced || m.firstVisit || picked ? null : (m.nextRung ?? null);
    // A link's Daily or Cup is still finding its rivals: the banner says where, the button why it does
    // not go yet. (Not `disabled`, for the mode cards' reason: it keeps its focus and its name.)
    const waiting = !!m.challenge?.waiting;
    const status = 'Finding rivals…';
    const subline = waiting ? status : (duel ?? aim ?? (raced || m.firstVisit || bare || picked ? where : (sel?.tagline ?? where)));
    const mtn = subline ? h('span', 'gs-ride-mtn', subline) : null;
    if (subline === where || aim || duel) mtn?.setAttribute('translate', 'no');
    const rideBtn = btn(
      ctx,
      {
        cls: 'gs-btn-primary gs-ride',
        icon: 'play',
        sound: waiting ? 'tap' : 'confirm',
        gameKey: true,
        fk: 'ride',
        onClick: () => {
          if (!waiting) this.hd.onRide();
        },
      },
      h('span', 'gs-btn-label gs-ride-label', h('span', 'gs-ride-verb', verb), mtn),
      rideKey(m.inputMode),
    );
    rideBtn.setAttribute('aria-label', where ? `${verb}: ${duel ? `${duel} on ` : ''}${where}${aim && !duel ? `. ${aim}` : ''}${waiting ? `. ${status.slice(0, -1)}` : ''}` : verb);
    if (waiting) rideBtn.setAttribute('aria-disabled', 'true');
    if (showKey) rideBtn.setAttribute('aria-keyshortcuts', 'Space');
    ride.append(rideBtn);
    // A brand-new player learns the loop before the first tap: what the ghosts are for.
    if (m.firstVisit && !m.challenge) ride.append(h('p', 'gs-t-goal', 'Pass ghosts to unlock new mountains'));
    el.append(ride);

    // A first visit has no menu row (and so no Settings), so a small sound toggle keeps the top
    // right: a new player can mute before the first run starts any music.
    if (m.firstVisit) {
      el.append(this.soundToggle());
      return;
    }

    // Wallet + best. A zero is left out (a returning player who sees "0 / Best 0" reads it as lost
    // progress), and with both at zero the pill is not drawn at all.
    const gifts = m.wallet > 0 ? h('span', 'gs-stat gs-stat-gift', icon('gift'), h('span', 'gs-num', fmt(m.wallet)), sr(' gifts')) : null;
    const rec = record(m);
    const best = rec ? h('span', 'gs-stat', icon('trophy', 'gs-stat-trophy'), h('span', 'gs-stat-l', rec.label), h('span', 'gs-num', rec.value)) : null;
    // Round 8: the spine's corner (TitleSpine). The flame leads the pill (its calendar a tap away), Rider Rank's
    // card under it opens the Almanac at the page being filled toward, and the one line of what is new today under
    // that. The corner is one stack, so a phone keeps it at the top in the same order.
    const sp = m.spine ?? null;
    const flame = sp && (sp.flame.streak > 0 || sp.flame.ember) ? this.flameBtn(sp) : null;
    this.flameBtnEl = flame;
    const pill = gifts || best || flame ? h('div', 'gs-t-stats gs-panel gs-pill', flame, flame && (gifts || best) ? h('span', 'gs-stat-sep') : null, gifts, gifts && best ? h('span', 'gs-stat-sep') : null, best) : null;
    const book = sp ? this.bookCard(sp) : null;
    const news = sp?.whatsNew ? h('p', 'gs-t-news', icon('star'), h('span', 'gs-t-news-t', sp.whatsNew)) : null;
    if (pill || book || news) el.append(h('div', 'gs-t-top gs-t-anim', pill, book, news));

    // Mountains + daily.
    const side = h('div', 'gs-t-side gs-t-anim');
    const track = h('div', 'gs-mtns');
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', 'Mountains');
    for (const c of m.mountains) track.append(this.mountainCard(c, c.id === m.selected, passed));
    const prev = btn(ctx, { cls: 'gs-btn-soft gs-btn-round gs-mtns-prev', icon: 'chevL', aria: 'Previous mountains', onClick: () => this.page(track, -1) });
    const next = btn(ctx, { cls: 'gs-btn-soft gs-btn-round gs-mtns-next', icon: 'chevR', aria: 'More mountains', onClick: () => this.page(track, 1) });
    const strip = h('div', 'gs-mtns-wrap', track, prev, next);
    side.append(strip);
    track.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || track.scrollWidth <= track.clientWidth) return;
        track.scrollLeft += e.deltaY;
        e.preventDefault();
      },
      { passive: false },
    );
    // The mountain cards sit directly above the Ride that rides them; the daily is its own card.
    el.append(side, h('div', `gs-t-daily gs-t-anim${m.cup ? ' has-cup' : ''}`, m.cup ? this.cupCard(m.cup, m.selected === 'cup') : null, this.dailyCard(m.daily, m.selected === 'daily')));
    this.watchEnds(track, prev, next, strip);
    if (m.twelve) el.append(this.twelveCard(m.twelve, m));

    // Secondary row.
    const bar = h('nav', 'gs-t-bar gs-t-anim');
    bar.setAttribute('aria-label', 'Menu');
    const sledName = h('span', 'gs-btn-sub', m.sledName);
    sledName.setAttribute('translate', 'no');
    const sb = btn(ctx, { cls: 'gs-btn-soft gs-t-sleds', icon: 'sledBold', label: 'Garage', fk: 'sleds', onClick: () => this.hooks.openSleds() }, sledName);
    sb.setAttribute('aria-label', `Garage, riding ${m.sledName}`);
    bar.append(sb);
    const mb = btn(ctx, {
      cls: 'gs-btn-soft',
      icon: 'flag',
      label: 'Missions',
      fk: 'missions',
      onClick: () => (this.popover ? this.closeMissions() : this.openMissions(m.missions, true)),
    });
    const left = m.missions.filter((x) => !x.done).length;
    if (left > 0) {
      mb.append(h('span', 'gs-count', String(left)));
      mb.setAttribute('aria-label', `Missions, ${left} open`);
    }
    // aria-controls is set while the popover exists (it must point at a live element).
    mb.setAttribute('aria-expanded', 'false');
    this.missionsBtn = mb;
    const md = btn(ctx, { cls: 'gs-btn-soft', icon: 'trophy', label: 'Medals', fk: 'medals', onClick: () => (this.popover && this.popKind === 'medals' ? this.closeMissions() : this.openMedals(m, true)) });
    md.setAttribute('aria-expanded', 'false');
    this.medalsBtn = md;
    bar.append(mb, md, btn(ctx, { cls: 'gs-btn-soft', icon: 'gear', label: 'Settings', fk: 'settings', onClick: () => this.hooks.openSettings() }));
    el.append(bar);
  }

  private mountainCard(c: MountainCard, selected: boolean, passed: number): HTMLButtonElement {
    const b = h('button', `gs-mtn b-${c.biome}${selected ? ' is-sel' : ''}${c.locked ? ' is-locked' : ''}`);
    b.type = 'button';
    b.dataset.fk = 'm-' + c.id;
    b.setAttribute('aria-pressed', String(selected));
    if (c.locked) b.setAttribute('aria-disabled', 'true');
    // The picked card carries the player's own record in its lower half: the best there and the
    // ghosts passed so far (what unlocks the next mountain), each only once it is more than zero.
    const mine = selected && !c.locked;
    const best = record(c);
    const rung = rankText(c);
    const held = c.medals && !c.locked && hasMedal(c.medals) ? medalWords(c.medals) : '';
    const said = c.locked ? `Locked. ${c.unlockText}` : [best ? `${best.label} ${best.value}` : '', rung ?? '', held, mine && passed > 0 ? `${fmt(passed)} ghosts passed` : ''].filter(Boolean).join('. ') || c.tagline;
    b.setAttribute('aria-label', `${c.name}. ${said}`);
    const sky = h('span', 'gs-mtn-sky');
    sky.innerHTML = biomeArt(c.biome);
    const art = h('span', 'gs-mtn-art', sky);
    // The lock sits on the leading edge, so it still shows when the card only peeks into the strip;
    // the picked card wears a check on its far corner.
    if (c.locked) art.append(h('span', 'gs-mtn-lockico', icon('lock')));
    else if (selected) art.append(h('span', 'gs-mtn-check', icon('check')));
    // What you hold here: three stages, then the whole run. Empty rings are what is left to take.
    if (!c.locked && c.medals) art.append(medalDots(c.medals, [], true));
    const name = h('span', 'gs-mtn-name', c.name);
    name.setAttribute('translate', 'no');
    const body = h('span', 'gs-mtn-body', name);
    // A card is its name and one short line: how to unlock it (the lock already says "to unlock", so
    // the card keeps the part that tells you how), or your best there; the picked one shows your best
    // and ghosts passed on two. What a mountain is like rides on the Ride button's subline.
    if (c.locked) body.append(h('span', 'gs-mtn-meta', c.unlockText.replace(/\s+to unlock\.?$/i, '')));
    else if (mine && (best || passed > 0 || rung)) {
      const rec = h('span', 'gs-mtn-rec');
      rec.setAttribute('aria-hidden', 'true');
      // (The trophy is a live record's: an old best gives its width to its label.)
      const live = best?.label === 'Best';
      if (best) rec.append(h('span', 'gs-mtn-recl', live ? icon('trophy') : null, h('span', 'gs-num', best.value), h('span', 'gs-mtn-recu', best.label.toLowerCase())));
      // Your rank takes the second line once there is one: the locked cards still say how close the
      // next mountain is, in ghosts.
      if (rung) rec.append(rankRow(c, rung));
      else if (passed > 0) rec.append(h('span', 'gs-mtn-recl is-ghost', icon('ghost'), h('span', 'gs-num', fmt(passed)), h('span', 'gs-mtn-recu', 'passed')));
      body.append(rec);
    } else if (mine) body.append(h('span', 'gs-mtn-meta is-about', c.tagline));
    else if (best) {
      body.append(h('span', 'gs-mtn-meta', `${best.label} `, h('span', 'gs-num', best.value)));
      if (rung) body.append(h('span', 'gs-mtn-rec', rankRow(c, rung)));
    } else if (rung) body.append(h('span', 'gs-mtn-rec', rankRow(c, rung)));
    b.append(art, body);
    b.addEventListener('click', () => {
      if (c.locked) {
        this.ctx.sound('back');
        play(b, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], {
          duration: 300,
          easing: 'ease-out',
        });
        return;
      }
      this.ctx.sound('tap');
      if (!selected) this.travel(c.id, c.name, () => this.hd.onSelectMountain(c.id));
    });
    return b;
  }

  /**
   * Mute, as a pressed/unpressed toggle with a fixed name. It sets the master volume (0, or what it
   * was before), the same setting the Settings sheet shows once the menu row appears.
   */
  private soundToggle(): HTMLButtonElement {
    const b = btn(this.ctx, {
      cls: 'gs-btn-soft gs-btn-round gs-t-sound gs-t-anim',
      icon: 'speaker',
      aria: 'Mute',
      fk: 'sound',
      onClick: () => {
        this.muted = !this.muted;
        this.hd.onSettings({ master: this.muted ? 0 : this.unmuteTo });
        paint();
      },
    });
    const glyph = b.querySelector('.gs-i');
    const on = glyph?.innerHTML ?? '';
    const paint = () => {
      b.setAttribute('aria-pressed', String(this.muted));
      b.classList.toggle('is-muted', this.muted);
      if (glyph) glyph.innerHTML = this.muted ? MUTED_SVG : on;
    };
    paint();
    return b;
  }

  /** The Daily card: today's best, the day streak ("3 days in a row") and today's medal disc (TitleModel.daily). */
  private dailyCard(d: TitleModel['daily'], selected: boolean): HTMLButtonElement {
    const b = h('button', `gs-daily${selected ? ' is-sel' : ''}`);
    b.type = 'button';
    b.dataset.fk = 'daily';
    b.setAttribute('aria-pressed', String(selected));
    // Not `disabled` while its rivals are generated: that would drop it from the tab order, and
    // keyboard and screen-reader players could not find the mode or hear its status.
    if (!d.ready) {
      b.setAttribute('aria-disabled', 'true');
      b.classList.add('is-waiting');
    }
    // The key is the UTC day ("2026-10-24"); it shows as a short date in the player's locale.
    const date = dailyDate(d.key);
    const status = d.ready ? 'Fresh rivals' : 'Finding rivals…';
    // Days in a row with a Daily run ("3 days in a row", from the second day: "Day 3" alone read as a
    // date or a level), and today's medal beside the best. Round 8: with `flame` the days are the flame's (a run of
    // any kind lights the day), and the flame is drawn in the title's corner, so the card leaves them to it.
    const streak = Math.floor(d.streak ?? 0);
    const medal = Math.max(0, Math.min(3, Math.floor(d.medal ?? 0)));
    const days = `${NBSP}days in a row`;
    const day = streak >= 2 && !d.flame ? h('span', 'gs-tag gs-daily-day', h('span', 'gs-num', String(streak)), days) : null;
    const meta = h('span', `gs-daily-meta${day ? ' has-day' : ''}`, h('span', 'gs-daily-date gs-num', date), day, h('span', 'gs-tag gs-daily-status', status));
    b.append(
      h('span', 'gs-daily-ico', icon('snowflake')),
      h('span', 'gs-daily-txt', h('span', 'gs-daily-title', 'Daily Mountain'), meta),
    );
    // Every number carries its label: with a medal the best reads "Bronze · Best 7,967", never a bare
    // "Bronze 7,967" (the figure is the day's best score, not the medal's).
    const disc = medal > 0 ? h('span', `gs-medal m-${medal}`, h('span', 'gs-medal-n', MEDAL[medal])) : null;
    // (Round 8: the medal is won on time, so the best beside it is the day's best time; a day with no finish yet shows
    // the score only when no medal stands beside it.)
    const figure = d.time && d.time > 0 ? clock(d.time) : !disc && d.best > 0 ? fmt(d.best) : '';
    if (figure || disc) {
      const num = figure ? h('span', 'gs-num', figure) : null;
      const best = disc
        ? [disc, num ? h('span', 'gs-daily-score', h('span', 'gs-daily-sep', '·'), h('span', 'gs-daily-best-l', 'Best'), num) : null]
        : [h('span', 'gs-daily-best-l', 'Best'), num];
      b.append(h('span', `gs-daily-best${disc ? ' has-medal' : ''}`, ...best));
    }
    // The second call to action: an outlined ink disc with a play glyph. Vermillion Ride stays the
    // only filled play target, and mint stays ghost information.
    b.append(h('span', 'gs-daily-go', icon('play')));
    const said = [`Daily Mountain, ${date}`, status.replace(/…$/, ''), streak >= 2 && !d.flame ? `${streak} days in a row` : '', medal > 0 ? `${MEDAL[medal]} medal today` : '', figure ? `Best ${figure}` : ''];
    b.setAttribute('aria-label', said.filter(Boolean).join('. '));
    b.addEventListener('click', () => {
      if (!d.ready) return;
      this.ctx.sound('confirm');
      if (selected) this.hd.onDaily();
      else this.travel('daily', 'Daily Mountain', () => this.hd.onDaily());
    });
    return b;
  }

  /**
   * The week's Cup, the Daily's sibling: the same card, marigold-free (a Cup medal is the disc), with
   * the week's mood and event where the Daily says what day it is, and your best time this week.
   */
  private cupCard(c: TitleCup, selected: boolean): HTMLButtonElement {
    const b = h('button', `gs-daily gs-cup${selected ? ' is-sel' : ''}`);
    b.type = 'button';
    b.dataset.fk = 'cup';
    b.setAttribute('aria-pressed', String(selected));
    if (!c.ready) {
      b.setAttribute('aria-disabled', 'true');
      b.classList.add('is-waiting');
    }
    const medal = Math.max(0, Math.min(3, Math.floor(c.medal)));
    const what = c.ready ? [c.mood, c.event].filter(Boolean).join(', ') : 'Finding rivals…';
    // (A phone's half-width card keeps the mood: the reveal names the event.)
    const tag = h('span', 'gs-tag gs-daily-status', c.ready ? c.mood : what, c.ready && c.event ? h('span', 'gs-cup-ev', `, ${c.event}`) : null);
    const meta = h('span', 'gs-daily-meta', h('span', 'gs-daily-date gs-num', `Week ${c.week}`), tag);
    b.append(h('span', 'gs-daily-ico', icon('trophy')), h('span', 'gs-daily-txt', h('span', 'gs-daily-title', 'Weekly Cup'), meta));
    const disc = medal > 0 ? h('span', `gs-medal m-${medal}`, h('span', 'gs-medal-n', MEDAL[medal])) : null;
    if (c.best > 0 || disc) {
      const num = c.best > 0 ? h('span', 'gs-num', clock(c.best)) : null;
      b.append(h('span', `gs-daily-best${disc ? ' has-medal' : ''}`, disc, num ? h('span', 'gs-daily-score', h('span', 'gs-daily-best-l', 'Best'), num) : null));
    }
    b.append(h('span', 'gs-daily-go', icon('play')));
    const said = [`Weekly Cup, week ${c.week}`, what.replace(/…$/, ''), medal > 0 ? `${MEDAL[medal]} medal this week` : '', c.best > 0 ? `Best ${clock(c.best)}` : ''];
    b.setAttribute('aria-label', said.filter(Boolean).join('. '));
    b.addEventListener('click', () => {
      if (!c.ready) return;
      this.ctx.sound('confirm');
      if (selected) this.hd.onCup?.();
      else this.travel('cup', 'Weekly Cup', () => this.hd.onCup?.());
    });
    return b;
  }

  /**
   * The Twelve's home on the title: who rides next, their bust, their home ground and a line of their
   * character. The card picks that mountain (the title travels there and Ride becomes the duel); its
   * count opens the ladder. With nobody to duel yet it names who waits and what opens them.
   */
  private twelveCard(t: TitleTwelve, m: TitleModel): HTMLElement {
    const box = h('div', 'gs-t12 gs-t-anim');
    const face: Pick<TwelveRung, 'hat' | 'accent'> = t.next ?? t.waiting?.rider ?? { hat: 'crown', accent: '#E8D9FF' };
    const bust = h('span', 'gs-t12-bust');
    bust.innerHTML = riderBust(face.hat, face.accent);
    let kicker = 'Next of The Twelve';
    let name = '';
    let line: (string | HTMLElement)[] = [];
    let bio = '';
    let said = '';
    let go: (() => void) | null = null;
    if (t.next) {
      const n = t.next;
      name = n.name;
      const where = h('span', '', n.mountain);
      where.setAttribute('translate', 'no');
      line = n.time ? [where, ', ', h('span', 'gs-num', n.time), ' to beat'] : [where];
      bio = n.bio;
      said = `Next of The Twelve: ${n.name}, on ${n.mountain}${n.time ? `, ${n.time} to beat` : ''}. ${n.bio}`;
      if (!n.here) go = () => this.travel(n.mountainId, n.mountain, () => this.hd.onSelectMountain(n.mountainId));
    } else if (t.final) {
      const f = t.final;
      kicker = 'The Twelve';
      name = 'The Last Race';
      line = [`All twelve at once on ${f.mountain}`];
      said = `The Twelve: the last race, all twelve at once on ${f.mountain}`;
      if (!f.here) go = () => this.travel(f.mountainId, f.mountain, () => this.hd.onSelectMountain(f.mountainId));
    } else if (t.waiting) {
      const w = t.waiting;
      kicker = 'The Twelve';
      name = w.rider.name;
      line = [`Waits on ${w.rider.mountain}. ${w.opens}`];
      said = `The Twelve: ${w.rider.name} waits on ${w.rider.mountain}. ${w.opens}`;
      box.classList.add('is-waiting');
    } else {
      kicker = 'The Twelve';
      name = t.crowned ? 'The crown is yours' : t.tally;
      line = [t.crowned ? 'All twelve beaten in one race' : (t.hook ?? '')];
      said = `The Twelve: ${name}`;
      box.classList.add('is-crowned');
    }
    box.style.setProperty('--rider', face.accent);
    const who = h('span', 'gs-t12-name', name);
    who.setAttribute('translate', 'no');
    const main = h('button', 'gs-t12-main', bust, h('span', 'gs-t12-txt', h('span', 'gs-t12-k', kicker), who, h('span', 'gs-t12-line', ...line), bio ? h('span', 'gs-t12-bio', bio) : null));
    main.type = 'button';
    main.dataset.fk = 't12';
    main.setAttribute('aria-label', go ? `${said}. Go to their mountain` : `${said}. Open the ladder`);
    main.addEventListener('click', () => {
      this.ctx.sound('tap');
      if (go) go();
      else if (this.popover && this.popKind === 'twelve') this.closeMissions();
      else this.openTwelve(m, true);
    });
    const count = h('button', 'gs-t12-count', h('span', 'gs-t12-count-n gs-num', String(t.beaten)), h('span', 'gs-t12-count-of gs-num', `of ${t.of}`), icon('chevR'));
    count.type = 'button';
    count.dataset.fk = 't12-ladder';
    count.setAttribute('aria-label', `The Twelve: ${t.tally}. Open the ladder`);
    count.setAttribute('aria-expanded', 'false');
    count.addEventListener('click', () => {
      this.ctx.sound('tap');
      if (this.popover && this.popKind === 'twelve') this.closeMissions();
      else this.openTwelve(m, true);
    });
    this.twelveBtn = count;
    box.append(main, count);
    return box;
  }

  /**
   * The ladder: all twelve, gentlest first, each with their bust, their home ground and their time there,
   * and who has fallen. The one that rides now can be gone to from its row. A popover like the medal
   * wall's, so there is no sheet to dismiss.
   */
  private openTwelve(m: TitleModel, animate: boolean): void {
    this.closeMissions();
    const t = m.twelve;
    if (!t || !this.twelveBtn) return;
    const pop = h('div', 'gs-pop gs-panel gs-t12-pop');
    pop.id = 'gs-twelve-pop';
    pop.setAttribute('role', 'region');
    pop.setAttribute('aria-label', 'The Twelve');
    const close = btn(this.ctx, { cls: 'gs-btn-soft gs-btn-round gs-t12-close', icon: 'close', aria: 'Close the ladder', sound: 'back', fk: 't12-close', onClick: () => this.closeMissions() });
    pop.append(h('div', 'gs-t12-head', h('h2', 'gs-h2 gs-t12-h', 'The Twelve', h('span', 'gs-wall-n', h('span', 'gs-num', t.tally))), close));
    pop.append(h('p', 'gs-t12-key', t.crowned ? 'Every one of them beaten, and all of them at once.' : `Beat each rider on their home ground, one duel at a time.${t.hook ? ` ${t.hook}.` : ''}`));
    const list = h('ol', 'gs-t12-list');
    t.rungs.forEach((r, i) => {
      const li = h('li', `gs-t12-rung is-${r.state}`);
      li.style.setProperty('--rider', r.accent);
      li.style.setProperty('--i', String(i));
      const bust = h('span', 'gs-t12-bust');
      bust.innerHTML = riderBust(r.hat, r.accent);
      const name = h('span', 'gs-t12-rname', r.name);
      name.setAttribute('translate', 'no');
      const where = h('span', '', r.mountain);
      where.setAttribute('translate', 'no');
      const meta = h('span', 'gs-t12-rmeta', where, r.time ? h('span', 'gs-num', r.time) : null);
      let tag: HTMLElement | null = null;
      if (r.state === 'beaten') tag = h('span', 'gs-t12-tag is-beaten', icon('check'), 'Beaten');
      else if (r.state === 'locked') tag = h('span', 'gs-t12-tag is-locked', icon('lock'), sr('Their mountain is locked'));
      else if (r.state === 'next' && t.next) {
        const n = t.next;
        if (n.here) tag = h('span', 'gs-t12-tag is-next', 'Rides now');
        else {
          tag = btn(this.ctx, { cls: 'gs-btn-soft gs-t12-go', label: 'Go', icon: 'arrowR', aria: `Go to ${n.mountain} to duel ${n.name}`, fk: 't12-go', onClick: () => this.travel(n.mountainId, n.mountain, () => this.hd.onSelectMountain(n.mountainId)) });
        }
      }
      li.append(h('span', 'gs-t12-num gs-num', String(i + 1)), bust, h('span', 'gs-t12-rtxt', name, h('span', 'gs-t12-rbio', r.bio), meta));
      if (tag) li.append(tag);
      list.append(li);
    });
    pop.append(list);
    this.el.append(pop);
    if (animate) {
      play(pop, [{ opacity: 0, transform: 'translateY(14px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: SPRING });
      if (!reduced()) for (const li of Array.from(list.children)) play(li, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 60 + 28 * Number((li as HTMLElement).style.getPropertyValue('--i')), easing: EASE_OUT, fill: 'backwards' });
    }
    this.popover = pop;
    this.popKind = 'twelve';
    this.twelveBtn.setAttribute('aria-expanded', 'true');
    this.twelveBtn.setAttribute('aria-controls', pop.id);
  }

  private page(track: HTMLElement, dir: number): void {
    const card = track.querySelector<HTMLElement>('.gs-mtn');
    const stepW = card ? card.offsetWidth + 10 : 160;
    track.scrollBy({ left: dir * stepW, behavior: reduced() ? 'auto' : 'smooth' });
  }

  /**
   * Hide each arrow (and its edge fade) when that end of the strip is already in view, and mark the
   * cards cut by an edge: they fade their text and keep only the art and lock, so a peeking card
   * never shows a word sliced in half.
   */
  private watchEnds(track: HTMLElement, prev: HTMLButtonElement, next: HTMLButtonElement, strip: HTMLElement): void {
    const cards = track.querySelectorAll<HTMLElement>('.gs-mtn');
    if (cards.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const first = cards[0];
    const last = cards[cards.length - 1];
    const seen = new Map<Element, boolean>();
    this.io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const whole = en.intersectionRatio > 0.95;
          seen.set(en.target, whole);
          en.target.classList.toggle('is-peek', !whole);
        }
        const a = seen.get(first) === true;
        const z = seen.get(last) === true;
        prev.disabled = a;
        next.disabled = z;
        strip.classList.toggle('more-l', !a);
        strip.classList.toggle('more-r', !z);
      },
      { root: track, threshold: [0, 0.95, 1] },
    );
    for (const c of cards) this.io.observe(c);
  }

  /**
   * The medal wall: every mountain's rank and what you hold, the week's Cup under them. A popover like
   * the missions' (they share the slot), so it stays small and there is no sheet to dismiss.
   */
  private openMedals(m: TitleModel, animate: boolean): void {
    this.closeMissions();
    const bar = this.el.querySelector('.gs-t-bar');
    if (!bar || !this.medalsBtn) return;
    const pop = h('div', 'gs-pop gs-panel gs-wall');
    pop.id = 'gs-medals-pop';
    pop.setAttribute('role', 'region');
    pop.setAttribute('aria-label', 'Medals');
    const open = m.mountains.filter((c) => !c.locked);
    const gold = open.reduce((n, c) => n + (c.medals ? c.medals.stages.filter((x) => x >= 3).length + (c.medals.run >= 3 ? 1 : 0) : 0), 0);
    pop.append(h('h2', 'gs-h2 gs-wall-h', 'Medals', h('span', 'gs-wall-n', h('span', 'gs-num', `${gold} of ${m.mountains.length * 4}`), ' gold')));
    const list = h('ul', 'gs-wall-list');
    for (const c of m.mountains) {
      const rung = rankText(c);
      const name = h('span', 'gs-wall-name', c.name);
      name.setAttribute('translate', 'no');
      // Mastery's stars ride in the rank's cell, so the row keeps its three columns.
      const stars = !c.locked && c.stars ? h('span', 'gs-wall-stars', ` · ★ ${c.stars.got}/${c.stars.of}`) : null;
      stars?.setAttribute('aria-label', `, mastery ${c.stars?.got} of ${c.stars?.of} stars`);
      const li = h('li', `gs-wall-row${c.locked ? ' is-locked' : ''}${c.top ? ' is-top' : ''}`, name, h('span', 'gs-wall-rank gs-num', c.locked ? 'Locked' : (rung ?? 'No run yet'), stars), !c.locked && c.medals ? medalDots(c.medals) : null);
      list.append(li);
    }
    if (m.cup) {
      const c = m.cup;
      list.append(h('li', 'gs-wall-row is-cup', h('span', 'gs-wall-name', `Week ${c.week} Cup`), h('span', 'gs-wall-rank gs-num', c.best > 0 ? clock(c.best) : 'No run yet'), medalDots({ stages: [], run: c.medal })));
    }
    pop.append(list, h('p', 'gs-wall-key', 'Three stages, then the whole run. Stars: medals, sky gates, set pieces swept clean, home riders beaten, a clean finish.'));
    bar.append(pop);
    if (animate) play(pop, [{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1.1)' });
    this.popover = pop;
    this.popKind = 'medals';
    this.medalsBtn.setAttribute('aria-expanded', 'true');
    this.medalsBtn.setAttribute('aria-controls', pop.id);
  }

  private openMissions(list: MissionView[], animate: boolean): void {
    this.closeMissions();
    const bar = this.el.querySelector('.gs-t-bar');
    if (!bar || !this.missionsBtn) return;
    const pop = h('div', 'gs-pop gs-panel');
    pop.id = 'gs-missions-pop';
    pop.setAttribute('role', 'region');
    pop.setAttribute('aria-label', 'Missions');
    pop.append(h('h2', 'gs-h2', 'Missions'));
    pop.append(missionList(list));
    bar.append(pop);
    if (animate) play(pop, [{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1.1)' });
    this.popover = pop;
    this.popKind = 'missions';
    this.missionsBtn.setAttribute('aria-expanded', 'true');
    this.missionsBtn.setAttribute('aria-controls', pop.id);
  }

  private closeMissions(): void {
    this.popover?.remove();
    this.popover = null;
    this.missionsBtn?.setAttribute('aria-expanded', 'false');
    this.missionsBtn?.removeAttribute('aria-controls');
    this.medalsBtn?.setAttribute('aria-expanded', 'false');
    this.medalsBtn?.removeAttribute('aria-controls');
    this.twelveBtn?.setAttribute('aria-expanded', 'false');
    this.twelveBtn?.removeAttribute('aria-controls');
    this.flameBtnEl?.setAttribute('aria-expanded', 'false');
    this.flameBtnEl?.removeAttribute('aria-controls');
  }

  /**
   * Keep the lantern lit (round 8): the flame and its days, in the corner pill. A day not yet ridden leaves the
   * flame drawn hollow (the ember, if held, beside it); a tap opens the seven-day calendar.
   */
  private flameBtn(sp: TitleSpine): HTMLButtonElement {
    const f = sp.flame;
    const b = h('button', `gs-t-flame${f.litToday ? ' is-lit' : ''}${f.atRisk ? ' is-risk' : ''}`, icon('flame'), h('span', 'gs-num', String(f.streak)), f.ember ? h('span', 'gs-t-ember') : null);
    b.type = 'button';
    b.dataset.fk = 'flame';
    b.setAttribute('aria-label', `Your flame: ${f.streak} ${f.streak === 1 ? 'day' : 'days'}${f.litToday ? ', lit today' : f.atRisk ? ', ride today to keep it' : ''}${f.ember ? ', an ember held' : ''}. Open the calendar`);
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => {
      this.ctx.sound('tap');
      if (this.popover && this.popKind === 'flame') this.closeMissions();
      else this.openFlame(sp, true);
    });
    return b;
  }

  /** The seven-day calendar: the days ridden, today's, and what each pays (the seventh pays gifts and an ember). */
  private openFlame(sp: TitleSpine, animate: boolean): void {
    this.closeMissions();
    const top = this.el.querySelector('.gs-t-top');
    if (!top || !this.flameBtnEl) return;
    const f = sp.flame;
    const pop = h('div', 'gs-pop gs-panel gs-flame-pop');
    pop.id = 'gs-flame-pop';
    pop.setAttribute('role', 'region');
    pop.setAttribute('aria-label', 'Your flame');
    const days = h('ol', 'gs-flame-days');
    for (const c of f.calendar) {
      const state = c.day < f.nextDay ? 'is-done' : c.day === f.nextDay ? 'is-next' : 'is-ahead';
      const pay = h('span', 'gs-flame-pay', h('span', 'gs-num', `+${fmt(c.xp)}`), ' XP');
      const gift = c.gifts > 0 ? h('span', 'gs-flame-gift', icon('gift'), h('span', 'gs-num', fmt(c.gifts))) : null;
      const li = h('li', `gs-flame-day ${state}${c.ember ? ' has-ember' : ''}`, h('span', 'gs-flame-dn gs-num', String(c.day)), icon('flame', 'gs-flame-ico'), pay, gift);
      li.setAttribute('aria-label', `Day ${c.day}: ${fmt(c.xp)} XP${c.gifts > 0 ? `, ${fmt(c.gifts)} gifts` : ''}${c.ember ? ' and an ember' : ''}${state === 'is-done' ? ', done' : state === 'is-next' ? ', next' : ''}`);
      days.append(li);
    }
    const line = f.litToday ? 'Lit today. Come back tomorrow for the next day.' : f.atRisk ? 'Ride today to keep it lit.' : 'Any run lights the day.';
    const ember = f.ember ? 'You hold an ember: it keeps the flame through one missed day.' : 'Day 7 gives an ember, which keeps the flame through one missed day.';
    pop.append(
      h('h2', 'gs-h2 gs-flame-h', 'Your Flame', h('span', 'gs-wall-n', h('span', 'gs-num', `${f.streak} ${f.streak === 1 ? 'day' : 'days'}`), f.best > f.streak ? h('span', 'gs-flame-best', `, best ${f.best}`) : null)),
      days,
      h('p', 'gs-flame-line', line),
      h('p', 'gs-flame-key', ember),
    );
    top.append(pop);
    if (animate) play(pop, [{ opacity: 0, transform: 'translateY(-8px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: SPRING });
    this.popover = pop;
    this.popKind = 'flame';
    this.flameBtnEl.setAttribute('aria-expanded', 'true');
    this.flameBtnEl.setAttribute('aria-controls', pop.id);
  }

  /**
   * Rider Rank on the title (round 8): the page reached, the bar toward the next and what that page gives; it opens
   * the Almanac. The Spirit Album's count rides beside it once the album is open.
   */
  private bookCard(sp: TitleSpine): HTMLElement {
    const b = sp.bar;
    const fill = h('span', 'gs-t-book-fill');
    fill.style.transform = `scaleX(${barShare(b).toFixed(4)})`;
    const bar = h('span', 'gs-t-book-bar', fill);
    bar.setAttribute('aria-hidden', 'true');
    const next = b.next && b.next.length > 0 ? b.next.map((r) => r.name).join(', ') : null;
    const nextEl = next
      ? h('span', 'gs-t-book-next', h('span', 'gs-t-book-nk', `Page ${b.page + 1}`), h('span', 'gs-t-book-nn', next), h('span', 'gs-t-book-togo gs-num', `${fmt(b.need)}${NBSP}to go`))
      : h('span', 'gs-t-book-next', 'Every page turned');
    const main = h('button', 'gs-t-book-main', icon('book', 'gs-t-book-ico'), h('span', 'gs-t-book-txt', h('span', 'gs-t-book-rank', 'Rider Rank ', h('span', 'gs-num', String(b.page))), bar, nextEl));
    main.type = 'button';
    main.dataset.fk = 'almanac';
    main.setAttribute('aria-label', `Almanac: Rider Rank ${b.page} of ${b.of}${next ? `. Page ${b.page + 1}: ${next}, ${fmt(b.need)} XP to go` : ''}`);
    main.addEventListener('click', () => {
      this.ctx.sound('tap');
      this.hd.onOpenAlmanac?.();
    });
    const al = sp.album;
    const album = al
      ? btn(this.ctx, { cls: 'gs-t-album', icon: 'sticker', fk: 'album', aria: `Spirit Album: ${al.got} of ${al.of} stickers`, sound: 'tap', onClick: () => this.hd.onOpenAlbum?.() }, h('span', 'gs-num', String(al.got)), h('span', 'gs-t-album-of gs-num', `/${al.of}`))
      : null;
    return h('div', 'gs-t-book', main, album);
  }
}

/** The card's rank: "Rank 19 of 37", "Top of the ladder" once you have beaten it, null with no run. */
function rankText(c: Pick<MountainCard, 'rank' | 'rankOf' | 'top'>): string | null {
  if (c.top) return 'Top of the ladder';
  return typeof c.rank === 'number' ? `Rank ${c.rank} of ${c.rankOf ?? c.rank}` : null;
}

/** A card's rank line. A narrow card has no room for "Top of the ladder": the top wears the trophy and
 *  your best's gold-white on its own figures, and the card's name for a reader still says it. */
function rankRow(c: Pick<MountainCard, 'rank' | 'rankOf' | 'top'>, text: string): HTMLElement {
  return h('span', `gs-mtn-recl is-rank${c.top ? ' is-top' : ''}`, c.top ? icon('trophy') : null, h('span', 'gs-num', c.top ? `Rank ${c.rank ?? 1} of ${c.rankOf ?? 1}` : text));
}

const hasMedal = (m: MedalSet): boolean => m.run > 0 || m.stages.some((x) => x > 0);

/** What a row of medals says to a reader: "Stage 1 gold, whole run bronze", only what you hold. */
function medalWords(m: MedalSet): string {
  const parts = m.stages.flatMap((x, i) => (x > 0 ? [`Stage ${i + 1} ${MEDAL[x].toLowerCase()}`] : []));
  if (m.run > 0) parts.push(`whole run ${MEDAL[m.run].toLowerCase()}`);
  return parts.length > 0 ? `Medals: ${parts.join(', ')}` : 'No medals yet';
}

/**
 * A row of medal discs: one per stage, a hairline, then the larger whole-run disc. A disc you do not
 * hold is an empty ring. `fresh` lands those this run raised (0 to 2 a stage, 3 the whole run); `quiet`
 * leaves the words to its parent, whose own name says them.
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
 * How many ghosts the player has passed in all: the game's own count when the model carries one,
 * otherwise read back from a locked mountain's "Pass N more ghosts" line against its threshold
 * (0 once every mountain is open and no count is given).
 */
function ghostsPassed(m: TitleModel): number {
  if (typeof m.ghostsPassed === 'number') return m.ghostsPassed;
  for (const c of m.mountains) {
    const need = c.locked ? /(\d+)/.exec(c.unlockText) : null;
    const def = need ? MOUNTAINS.find((d) => d.id === c.id) : undefined;
    if (need && def) return Math.max(0, def.unlockGhosts - Number(need[1]));
  }
  return 0;
}

/**
 * A friend's challenge: "Racing Mila's ghost" over "2:31.4 on Pinecrest" (their finish), or "2,340 m on
 * Pinecrest" (how far a run that did not finish went). A run on today's Daily Mountain reads "on the
 * Daily Mountain" and one on this week's Cup "on the Weekly Cup". One on another day's Daily or another
 * week's Cup has no course left and no ghost to ride (no mountain named): "Mila's race has closed". Links
 * from before distances were carried keep the score: "Beat a score of 12,480 on Pinecrest". A link from
 * an older course has no ghost to race, only a distance to pass: "Mila rode 2,340 m on the old
 * Pinecrest. Beat it." No live role: it sits right above the Accept button, read in context, and the
 * title re-renders often.
 */
function challengeBanner(c: NonNullable<TitleModel['challenge']>): HTMLElement {
  if (c.old) {
    // (Names in it are handles and places: auto-translate stays off the short line.)
    const line = h('span', 'gs-challenge-k', oldLinkLine({ name: c.name, distance: c.distance ?? 0, mountain: c.mountain }));
    line.setAttribute('translate', 'no');
    return h('div', 'gs-challenge', icon('ghost', 'gs-challenge-ico'), h('div', 'gs-challenge-txt', line));
  }
  // Player and mountain names are proper nouns: keep auto-translate off them.
  const who = h('span', '', `${c.name}\u2019s`);
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

/** The record a card or the stats pill shows: your best time, else your best score, else the old
 *  course's best until a new one exists; null with nothing to show. */
function record(c: { best: number; bestTime?: number; oldBest?: number }): { label: string; value: string } | null {
  if (c.bestTime && c.bestTime > 0) return { label: 'Best', value: clock(c.bestTime) };
  if (c.best > 0) return { label: 'Best', value: fmt(c.best) };
  return c.oldBest && c.oldBest > 0 ? { label: 'Old best', value: fmt(c.oldBest) } : null;
}

/**
 * The returning player's greeting (progress.titleGreeting): a grudge waiting here (the rival's name in
 * rose, "Your nemesis" when it is one), the ghosts still to pass for the next mountain (mint), or the
 * nearest mission (its flag).
 */
function greeting(text: string): HTMLElement {
  const grudge = /^(Your nemesis )?(.+) is waiting on (.+)$/.exec(text);
  if (grudge) {
    const who = h('span', 'gs-t-greet-who', grudge[2]);
    who.setAttribute('translate', 'no');
    const where = h('span', '', grudge[3]);
    where.setAttribute('translate', 'no');
    return h('p', 'gs-t-greet is-grudge', icon('ghost'), h('span', '', grudge[1] ?? '', who, ' is waiting on ', where));
  }
  const unlock = /^(\d+) (more ghosts? opens?) (.+)$/.exec(text);
  if (unlock) {
    const where = h('span', '', unlock[3]);
    where.setAttribute('translate', 'no');
    return h('p', 'gs-t-greet is-unlock', icon('ghost'), h('span', '', h('span', 'gs-t-greet-n gs-num', unlock[1]), ` ${unlock[2]} `, where));
  }
  // "1,600 m" never breaks before its unit.
  return h('p', 'gs-t-greet is-mission', icon('flag'), h('span', '', text.replace(/(\d) m\b/g, `$1${NBSP}m`)));
}

/** "270/800" on screen, "270 of 800" to a reader (the mission rows, and the results' folded row). */
export function progText(n: number, of: number, dp?: 0 | 1): HTMLElement {
  const [v, t] = progFigures(n, of, dp);
  const slash = h('span', '', '/');
  slash.setAttribute('aria-hidden', 'true');
  return h('span', '', v, slash, sr(' of '), t);
}

/**
 * Mission rows: text, a progress bar (fill over a visible track) and the gift reward. A finished
 * mission reads as finished, never as a dimmer open one: its reward in full marigold ("+25"), and
 * its bar row traded for a check-and-Done stamp beside a full gold bar. The stamp has that row to
 * itself, so it never lands on the reward or any other number. On the results, one this run
 * completed (`flashNew`) lands its stamp with a flash.
 */
export function missionList(list: MissionView[], flashNew = false): HTMLElement {
  const ul = h('ul', 'gs-missions');
  list.forEach((mv, i) => {
    const pct = mv.target > 0 ? Math.max(0, Math.min(1, mv.progress / mv.target)) : 0;
    const li = h('li', `gs-mis${mv.done ? ' is-done' : ''}${flashNew && mv.justCompleted ? ' is-new' : ''}`);
    li.style.setProperty('--i', String(i));
    li.dataset.row = String(i);
    const right = h('span', 'gs-mis-right');
    const line = h('span', 'gs-mis-line');
    line.setAttribute('aria-hidden', 'true');
    if (mv.done) {
      right.append(h('span', 'gs-mis-reward', h('span', 'gs-num', '+' + fmt(mv.reward), sr(' gifts')), icon('gift')));
      line.style.setProperty('--p', '1');
      li.append(h('span', 'gs-mis-text', mv.text), right, h('span', 'gs-mis-foot', h('span', 'gs-mis-complete', icon('check'), 'Done'), line));
      ul.append(li);
      return;
    }
    right.append(
      h('span', 'gs-mis-prog gs-num', progText(Math.min(mv.progress, mv.target), mv.target, mv.dp)),
      h('span', 'gs-mis-reward is-quiet', icon('gift'), h('span', 'gs-num', fmt(mv.reward), sr(' gifts'))),
    );
    line.style.setProperty('--p', String(pct));
    li.append(h('span', 'gs-mis-text', mv.text), right, line);
    ul.append(li);
  });
  return ul;
}
