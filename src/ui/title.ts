import type { MissionView, MountainCard, TitleModel, UIHandlers } from './contract';
import { MOUNTAINS } from '../sim/mountains';
import { biomeArt } from './art';
import { btn, captureFocus, h, kbd, Layer, restoreFocus, sr, type Ctx } from './dom';
import { dailyDate, fmt, metres, NBSP } from './fmt';
import { icon } from './icons';
import { play, reduced } from './motion';

// Title screen. Landscape: one column on the left reads logo, mountain cards, the Ride that rides
// them, then the menu row; wallet and the daily card keep to the right, and the 3D scene owns the
// middle. Portrait: stacked, with Ride in the thumb zone.

export interface TitleMenuHooks {
  openSleds(): void;
  openSettings(): void;
}

/** Medal names by rank (0 none). */
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;

export class Title {
  readonly layer: Layer;
  private readonly el: HTMLElement;
  private popover: HTMLElement | null = null;
  private missionsBtn: HTMLButtonElement | null = null;
  private io: IntersectionObserver | null = null;
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
    this.layer = new Layer(this.el, 220);
    document.addEventListener('pointerdown', (e) => {
      if (!this.popover) return;
      const t = e.target as Node | null;
      if (t && (this.popover.contains(t) || this.missionsBtn?.contains(t))) return;
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
    if (hadPopover) this.openMissions(m.missions, false);
    restoreFocus(this.el, fk);
  }

  hide(): void {
    this.closeMissions();
    this.layer.hide();
  }

  private render(m: TitleModel): void {
    this.io?.disconnect();
    this.io = null;
    this.popover = null;
    const ctx = this.ctx;
    const el = this.el;
    el.replaceChildren();
    el.classList.toggle('is-first', m.firstVisit);
    el.classList.toggle('has-challenge', m.challenge !== null);

    el.append(h('div', 'gs-title-scrim'));

    // Logo + tagline. A brand-new player reads the hook directly above the button that starts it:
    // on a phone that leaves the logo alone at the top, the sky and the rider's band open, and the
    // words on the ink floor under the scene instead of floating over the sky.
    const tagline = h('p', 'gs-tagline', 'Race the ghosts of every great run.');
    el.append(h('div', 'gs-t-main gs-t-anim', logo(), m.firstVisit ? null : tagline));

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
    const sel = m.mountains.find((x) => x.id === m.selected) ?? m.mountains[0];
    const passed = m.firstVisit ? 0 : ghostsPassed(m);
    const bare = !!sel && !sel.locked && sel.best <= 0 && passed <= 0;
    const verb = m.challenge ? 'Accept' : 'Ride';
    const where = m.challenge ? m.challenge.mountain : (sel?.name ?? '');
    const subline = m.challenge || m.firstVisit || bare ? where : (sel?.tagline ?? where);
    const mtn = subline ? h('span', 'gs-ride-mtn', subline) : null;
    if (subline === where) mtn?.setAttribute('translate', 'no');
    const rideBtn = btn(
      ctx,
      {
        cls: 'gs-btn-primary gs-ride',
        icon: 'play',
        sound: 'confirm',
        gameKey: true,
        fk: 'ride',
        onClick: () => this.hd.onRide(),
      },
      h('span', 'gs-btn-label gs-ride-label', h('span', 'gs-ride-verb', verb), mtn),
      showKey ? kbd('Space', 'gs-ride-key') : null,
    );
    rideBtn.setAttribute('aria-label', where ? `${verb}: ${where}` : verb);
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
    const best = m.best > 0 ? h('span', 'gs-stat', icon('trophy', 'gs-stat-trophy'), h('span', 'gs-stat-l', 'Best'), h('span', 'gs-num', fmt(m.best))) : null;
    if (gifts || best) el.append(h('div', 'gs-t-stats gs-panel gs-pill gs-t-anim', gifts, gifts && best ? h('span', 'gs-stat-sep') : null, best));

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
    el.append(side, h('div', 'gs-t-daily gs-t-anim', this.dailyCard(m.daily)));
    this.watchEnds(track, prev, next, strip);

    // Secondary row.
    const bar = h('nav', 'gs-t-bar gs-t-anim');
    bar.setAttribute('aria-label', 'Menu');
    const sledName = h('span', 'gs-btn-sub', m.sledName);
    sledName.setAttribute('translate', 'no');
    const sb = btn(ctx, { cls: 'gs-btn-soft gs-t-sleds', icon: 'sledBold', label: 'Sleds', fk: 'sleds', onClick: () => this.hooks.openSleds() }, sledName);
    sb.setAttribute('aria-label', `Sleds, riding ${m.sledName}`);
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
    bar.append(mb, btn(ctx, { cls: 'gs-btn-soft', icon: 'gear', label: 'Settings', fk: 'settings', onClick: () => this.hooks.openSettings() }));
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
    const said = c.locked ? `Locked. ${c.unlockText}` : [c.best > 0 ? `Best ${fmt(c.best)}` : '', mine && passed > 0 ? `${fmt(passed)} ghosts passed` : ''].filter(Boolean).join('. ') || c.tagline;
    b.setAttribute('aria-label', `${c.name}. ${said}`);
    const sky = h('span', 'gs-mtn-sky');
    sky.innerHTML = biomeArt(c.biome);
    const art = h('span', 'gs-mtn-art', sky);
    // The lock sits on the leading edge, so it still shows when the card only peeks into the strip;
    // the picked card wears a check on its far corner.
    if (c.locked) art.append(h('span', 'gs-mtn-lockico', icon('lock')));
    else if (selected) art.append(h('span', 'gs-mtn-check', icon('check')));
    const name = h('span', 'gs-mtn-name', c.name);
    name.setAttribute('translate', 'no');
    const body = h('span', 'gs-mtn-body', name);
    // A card is its name and one short line: how to unlock it (the lock already says "to unlock", so
    // the card keeps the part that tells you how), or your best there; the picked one shows your best
    // and ghosts passed on two. What a mountain is like rides on the Ride button's subline.
    if (c.locked) body.append(h('span', 'gs-mtn-meta', c.unlockText.replace(/\s+to unlock\.?$/i, '')));
    else if (mine && (c.best > 0 || passed > 0)) {
      const rec = h('span', 'gs-mtn-rec');
      rec.setAttribute('aria-hidden', 'true');
      if (c.best > 0) rec.append(h('span', 'gs-mtn-recl', icon('trophy'), h('span', 'gs-num', fmt(c.best)), h('span', 'gs-mtn-recu', 'best')));
      if (passed > 0) rec.append(h('span', 'gs-mtn-recl is-ghost', icon('ghost'), h('span', 'gs-num', fmt(passed)), h('span', 'gs-mtn-recu', 'passed')));
      body.append(rec);
    } else if (mine) body.append(h('span', 'gs-mtn-meta is-about', c.tagline));
    else if (c.best > 0) body.append(h('span', 'gs-mtn-meta', 'Best ', h('span', 'gs-num', fmt(c.best))));
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
      if (!selected) this.hd.onSelectMountain(c.id);
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

  /** The Daily card: today's best, the day streak ("Day 3") and today's medal disc (TitleModel.daily). */
  private dailyCard(d: TitleModel['daily']): HTMLButtonElement {
    const b = h('button', 'gs-daily');
    b.type = 'button';
    b.dataset.fk = 'daily';
    // Not `disabled` while its rivals are generated: that would drop it from the tab order, and
    // keyboard and screen-reader players could not find the mode or hear its status.
    if (!d.ready) {
      b.setAttribute('aria-disabled', 'true');
      b.classList.add('is-waiting');
    }
    // The key is the UTC day ("2026-10-24"); it shows as a short date in the player's locale.
    const date = dailyDate(d.key);
    const status = d.ready ? 'Fresh rivals' : 'Finding rivals…';
    // Days in a row with a Daily run ("Day 3", from the second day), and today's medal beside the best.
    const streak = Math.floor(d.streak ?? 0);
    const medal = Math.max(0, Math.min(3, Math.floor(d.medal ?? 0)));
    const day = streak >= 2 ? h('span', 'gs-tag gs-daily-day', `Day${NBSP}`, h('span', 'gs-num', String(streak))) : null;
    const meta = h('span', `gs-daily-meta${day ? ' has-day' : ''}`, h('span', 'gs-daily-date gs-num', date), day, h('span', 'gs-tag gs-daily-status', status));
    b.append(
      h('span', 'gs-daily-ico', icon('snowflake')),
      h('span', 'gs-daily-txt', h('span', 'gs-daily-title', 'Daily Mountain'), meta),
    );
    const disc = medal > 0 ? h('span', `gs-medal m-${medal}`, h('span', 'gs-medal-n', MEDAL[medal])) : null;
    if (d.best > 0 || disc) b.append(h('span', `gs-daily-best${disc ? ' has-medal' : ''}`, disc ?? h('span', 'gs-daily-best-l', 'Best'), d.best > 0 ? h('span', 'gs-num', fmt(d.best)) : null));
    // The second call to action: an outlined ink disc with a play glyph. Vermillion Ride stays the
    // only filled play target, and mint stays ghost information.
    b.append(h('span', 'gs-daily-go', icon('play')));
    const said = [`Daily Mountain, ${date}`, status.replace(/…$/, ''), streak >= 2 ? `Day ${streak} in a row` : '', medal > 0 ? `${MEDAL[medal]} medal today` : '', d.best > 0 ? `Best ${fmt(d.best)}` : ''];
    b.setAttribute('aria-label', said.filter(Boolean).join('. '));
    b.addEventListener('click', () => {
      if (!d.ready) return;
      this.ctx.sound('confirm');
      this.hd.onDaily();
    });
    return b;
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
    this.missionsBtn.setAttribute('aria-expanded', 'true');
    this.missionsBtn.setAttribute('aria-controls', pop.id);
  }

  private closeMissions(): void {
    this.popover?.remove();
    this.popover = null;
    this.missionsBtn?.setAttribute('aria-expanded', 'false');
    this.missionsBtn?.removeAttribute('aria-controls');
  }
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
 * A friend's challenge: "Racing Mila's ghost" over "2,340 m on Pinecrest" (how far their run went).
 * A run on today's Daily Mountain reads "on the Daily Mountain"; one on another day's Daily (no
 * mountain named) shows the first line alone. Links from before distances were carried keep the
 * score: "Beat 12,480 on Pinecrest". No live role: it sits right above the Accept button, read in
 * context, and the title re-renders often.
 */
function challengeBanner(c: NonNullable<TitleModel['challenge']>): HTMLElement {
  // Player and mountain names are proper nouns: keep auto-translate off them.
  const who = h('span', '', `${c.name}\u2019s`);
  who.setAttribute('translate', 'no');
  const k = h('span', 'gs-challenge-k', 'Racing ', who, ' ghost');
  const where = c.daily ? (c.mountain ? 'the Daily Mountain' : '') : c.mountain;
  let v: HTMLElement | null = null;
  if (where) {
    const place = h('span', '', where);
    place.setAttribute('translate', 'no');
    v =
      typeof c.distance === 'number' && c.distance > 0
        ? h('span', 'gs-challenge-v', h('span', 'gs-num', metres(c.distance)), ' on ', place)
        : h('span', 'gs-challenge-v', 'Beat ', h('span', 'gs-num', fmt(c.score)), ' on ', place);
  }
  return h('div', 'gs-challenge', icon('ghost', 'gs-challenge-ico'), h('div', 'gs-challenge-txt', k, v));
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

/** "270/800" on screen, "270 of 800" to a reader. */
function progText(n: number, of: number): HTMLElement {
  const slash = h('span', '', '/');
  slash.setAttribute('aria-hidden', 'true');
  return h('span', '', fmt(n), slash, sr(' of '), fmt(of));
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
      h('span', 'gs-mis-prog gs-num', progText(Math.min(mv.progress, mv.target), mv.target)),
      h('span', 'gs-mis-reward is-quiet', icon('gift'), h('span', 'gs-num', fmt(mv.reward), sr(' gifts'))),
    );
    line.style.setProperty('--p', String(pct));
    li.append(h('span', 'gs-mis-text', mv.text), right, line);
    ul.append(li);
  });
  return ul;
}
