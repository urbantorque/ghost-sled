// Round 9, the screens lane: the title as one job at a time, a working prototype over a captured frame of the game.
// It reads the contract's own TitleModel (fixtures.ts), so what it shows is what the game already knows, and where it
// needs one thing more it says so (`intro`, below).
//
// The main screen holds only the logo, the picker (where you ride, and how), Ride with its reason on it, one quiet
// line of what you are working toward, and four labelled doors: Daily and Cup, Progress, Garage, Settings. Each
// figure carries its word, and each thing is said once: the next duel is Ride's reason and nowhere else; the next
// unlock is the quiet line, so its locked card shows only the lock; your best is on the picked card; your gifts are on
// the Garage's door, where they are spent; your flame on the Daily's, where it is kept; your rank on Progress.
import type { IconName } from '../../src/ui/icons';
import type { MountainCard, TitleModel } from '../../src/ui/contract';
import { biomeArt, riderBust } from '../../src/ui/art';
import { clock } from '../../src/game/standing';
import { fmt } from '../../src/ui/fmt';
import { backdrop, titleBackdrop, titleModel, STAGES, type Stage } from './fixtures';
import { button, closeTop, device, h, ico, openSheet, reduced } from './proto';
import { prize } from './words';

/** Short names, as a player says them: the picker's chips carry these. */
const SHORT: Record<string, string> = { pinecrest: 'Pinecrest', frostfang: 'Frostfang', ember: 'Ember', sakura: 'Sakura', lanternfall: 'Lanternfall', daily: 'Today’s Daily', cup: 'This week’s Cup' };

/**
 * What a returning player is told once, the first time they have it: one line in the door it lives behind, and a "New"
 * tag on that door until it is opened. The model does not carry this today (TitleSpine.whatsNew is the day's news);
 * milestone 1 adds `intro: { door, line } | null`, set from the pages opened since the last title.
 */
type Door = 'events' | 'progress' | 'garage' | 'settings';
const INTRO: Partial<Record<Stage, { door: Door; line: string }>> = {
  run1: { door: 'events', line: 'New: daily contracts. Three small goals a day, each worth 50 XP.' },
  run5: { door: 'garage', line: 'New: the Whirl Saucer is yours. It spins faster in the air.' },
  run50: { door: 'events', line: 'New: you went up to division 4 of the Cup.' },
};

interface State {
  stage: Stage;
  m: TitleModel;
  selected: string;
  hourOn: boolean;
  mirrorOn: boolean;
  opened: Set<Door>;
  /** A locked card was pressed: the quiet line says what opens it, for a moment. */
  locked: MountainCard | null;
}

const q = new URLSearchParams(location.search);
const stage = (STAGES as readonly string[]).includes(q.get('stage') ?? '') ? (q.get('stage') as Stage) : 'run20';
const st: State = { stage, m: titleModel(stage), selected: '', hourOn: false, mirrorOn: false, opened: new Set(), locked: null };
st.selected = st.m.selected;
const dev = device();
if (dev === 'phone' || q.get('input') === 'touch') document.documentElement.classList.add('is-touch');

const sceneEl = document.querySelector<HTMLElement>('.p9-scene')!;
const root = document.getElementById('screen')!;
sceneEl.style.backgroundImage = `url("${backdrop(dev, titleBackdrop(stage))}")`;

// ---------------------------------------------------------------- what the screen says

/** Ride's words: the verb, and its reason (what this run is for). */
function rideWords(): { verb: string; why: string; aria: string } {
  const m = st.m;
  if (m.firstVisit) return { verb: 'Ride', why: 'Pinecrest', aria: 'Ride Pinecrest' };
  if (st.selected === 'daily') return { verb: 'Ride', why: m.daily.medal ? `Today’s Daily. Best ${clock(m.daily.time ?? 0)}` : 'Today’s Daily. Keeps your flame lit', aria: "Ride today's Daily" };
  if (st.selected === 'cup') return { verb: 'Ride', why: m.cup?.best ? `This week’s Cup. Best ${clock(m.cup.best)}` : 'This week’s Cup', aria: "Ride this week's Cup" };
  // (A duel only when the next run is one: a save's first two runs hold it back, which today's model does not say.)
  const tw = (m.twelve as { rides?: boolean } | null | undefined)?.rides === false ? null : m.twelve?.next;
  if (tw && tw.mountainId === st.selected && !st.mirrorOn) return { verb: 'Duel', why: `${tw.name}. ${tw.time} to beat`, aria: `Duel ${tw.name} on ${tw.mountain}, ${tw.time} to beat` };
  const rung = /^Next: (.+), [\d:.]+, ([\d.]+ s) up$/.exec(m.nextRung ?? '');
  const where = `${SHORT[st.selected]}${st.hourOn && m.hour ? ` ${m.hour.phrase}` : ''}${st.mirrorOn ? ', mirrored' : ''}`;
  if (rung && st.selected === m.selected) return { verb: 'Ride', why: `${rung[1]} is ${rung[2].replace(' ', '\u00a0')} ahead`, aria: `Ride ${where}. ${rung[1]} is ${rung[2]} ahead on the ladder` };
  return { verb: 'Ride', why: where, aria: `Ride ${where}` };
}

/** The one quiet line: the nearest thing you are working toward, in words (never what Ride already says). */
function aimWords(): { icon: IconName; text: string; cls: string; about: string | null } {
  const m = st.m;
  if (m.firstVisit) return { icon: 'ghost', text: 'Pass ghosts to unlock new mountains', cls: '', about: null };
  if (st.locked) {
    const c = st.locked;
    return { icon: 'lock', text: `${c.name}: ${c.unlockText.replace(/ to unlock$/, '').replace(/^Pass/, 'pass').replace(/^Beat/, 'beat')} to open it`, cls: 'is-rank', about: c.id };
  }
  // The next mountain opened by ghosts, then Lanternfall by The Twelve, then the next page of the Almanac.
  const byGhosts = m.mountains.filter((c) => c.locked && /ghost/.test(c.unlockText)).map((c) => ({ c, n: Number(/(\d+)/.exec(c.unlockText)?.[1] ?? 999) })).sort((a, b) => a.n - b.n)[0];
  if (byGhosts) return { icon: 'ghost', text: `${byGhosts.n} more ${byGhosts.n === 1 ? 'ghost opens' : 'ghosts open'} ${byGhosts.c.name}`, cls: '', about: byGhosts.c.id };
  const lf = m.mountains.find((c) => c.locked && /Twelve/.test(c.unlockText));
  if (lf) return { icon: 'trophy', text: `Beat ${/(\d+)/.exec(lf.unlockText)?.[1]} more of The Twelve to open Lanternfall`, cls: 'is-rank', about: lf.id };
  const bar = m.spine?.bar;
  const next = bar?.next?.[0];
  // (The rank and the XP first, the prize after: "900 XP to Rider Rank 26: the Memory charm".)
  if (bar && next) return { icon: 'book', text: `${fmt(bar.need)}\u00a0XP to Rider Rank ${bar.page + 1}: ${lower(prize(next))}`, cls: 'is-rank', about: null };
  return { icon: 'book', text: 'Every page of the Almanac turned', cls: 'is-rank', about: null };
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

// ---------------------------------------------------------------- the screen

function logo(): HTMLElement {
  const l = h('h1', 't9-logo');
  l.setAttribute('aria-label', 'Ghost Sled');
  l.setAttribute('translate', 'no');
  const runner = h('span', 'runner');
  runner.innerHTML = '<svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M3 17H160c16 0 26-4 32-13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  l.append(h('span', 'l1', 'Ghost'), ' ', h('span', 'l2', 'Sled'), runner);
  return l;
}

function chip(c: MountainCard, aboutId: string | null): HTMLElement {
  const sel = c.id === st.selected;
  const b = h('button', `t9-mtn b-${c.biome}${sel ? ' is-sel' : ''}${c.locked ? ' is-locked' : ''}`);
  b.type = 'button';
  b.dataset.fk = `m-${c.id}`;
  const sky = h('span', 't9-sky');
  sky.innerHTML = biomeArt(c.biome);
  if (c.locked) sky.append(h('span', 't9-lock', ico('lock')));
  // (Your best in words: a trophy beside a time read as a medal, or as someone else's record.)
  const best = sel && c.bestTime ? h('span', 't9-mtn-best', 'Best', h('span', 'gs9-num', clock(c.bestTime))) : null;
  if (best) sky.append(best);
  const name = h('span', 't9-mtn-name', SHORT[c.id] ?? c.name);
  name.setAttribute('translate', 'no');
  b.append(sky, name);
  b.setAttribute('aria-pressed', String(sel));
  const rank = c.top ? 'Top of the ladder' : c.rank ? `${ordinal(c.rank)} of ${c.rankOf} on the ladder` : '';
  b.setAttribute('aria-label', c.locked ? `${c.name}. Locked. ${c.unlockText}` : `${c.name}${c.bestTime ? `. Your best ${clock(c.bestTime)}` : ''}${rank ? `. ${rank}` : ''}`);
  if (c.locked && c.id !== aboutId) b.title = c.unlockText;
  b.addEventListener('click', () => {
    if (c.locked) {
      st.locked = c;
      if (!reduced()) b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 260 });
      renderAim();
      window.setTimeout(() => {
        if (st.locked === c) {
          st.locked = null;
          renderAim();
        }
      }, 3200);
      return;
    }
    if (sel) return;
    st.selected = c.id;
    st.hourOn = false;
    st.mirrorOn = false;
    render(`m-${c.id}`);
  });
  return b;
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

/** How you ride the picked mountain: the day or its other hour, and the mirror, once open. */
function how(): HTMLElement | null {
  const m = st.m;
  const here = st.selected === m.selected;
  const sel = m.mountains.find((c) => c.id === st.selected);
  const out = h('div', 't9-how');
  if (dev === 'phone' && sel?.bestTime) out.append(h('span', 't9-how-best', ico('trophy'), '\u00a0Best\u00a0', h('span', 'gs9-num', clock(sel.bestTime))));
  if (here && m.hour) {
    const hr = m.hour;
    const seg = h('div', 't9-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Hour');
    for (const alt of [false, true]) {
      const [z, hz] = alt ? hr.alt : hr.day;
      const sw = h('span', 't9-swatch');
      sw.style.setProperty('--z', z);
      sw.style.setProperty('--hz', hz);
      const b = button('secondary', [sw, alt ? hr.name : 'Day'], { fk: alt ? 'hour-alt' : 'hour-day', onClick: () => ((st.hourOn = alt), render(alt ? 'hour-alt' : 'hour-day')) });
      b.setAttribute('aria-pressed', String(st.hourOn === alt));
      seg.append(b);
    }
    out.append(seg);
  }
  if (here && m.mirror) {
    const seg = h('div', 't9-seg');
    const b = button('secondary', [h('span', 't9-tick', st.mirrorOn ? ico('check') : null), 'Mirrored'], { fk: 'mirror', onClick: () => ((st.mirrorOn = !st.mirrorOn), render('mirror')) });
    b.setAttribute('aria-pressed', String(st.mirrorOn));
    seg.append(b);
    out.append(seg);
  }
  return out.childElementCount > 0 ? out : null;
}

function rideButton(): HTMLButtonElement {
  const w = rideWords();
  const t = h('span', 't9-ride-t', h('span', 't9-ride-v', w.verb), h('span', 't9-ride-why', w.why));
  t.querySelector('.t9-ride-why')?.setAttribute('translate', 'no');
  const b = button('primary', [t, h('span', 't9-key', 'Space')], { icon: 'play', fk: 'ride', aria: w.aria, cls: 't9-ride', onClick: () => toast(`${w.aria}: the run would start`) });
  b.setAttribute('aria-keyshortcuts', 'Space');
  b.dataset.first = '';
  return b;
}

let aimEl: HTMLElement | null = null;
function renderAim(): void {
  const a = aimWords();
  const el = h('p', `t9-aim ${a.cls}`, ico(a.icon), h('span', '', a.text));
  el.setAttribute('aria-live', 'polite');
  if (aimEl) aimEl.replaceWith(el);
  aimEl = el;
}

function doorButton(d: Door): HTMLButtonElement {
  const m = st.m;
  const sp = m.spine;
  const label: Record<Door, string> = { events: 'Daily and Cup', progress: 'Progress', garage: 'Garage', settings: 'Settings' };
  const icn: Record<Door, IconName> = { events: 'snowflake', progress: 'book', garage: 'sledBold', settings: 'gear' };
  let status: HTMLElement | null = null;
  let aria = label[d];
  if (d === 'events' && sp && sp.flame.streak > 0) {
    status = h('span', 't9-door-s', h('span', 'is-flame', `${sp.flame.streak}-day flame`));
    aria += `. Your flame: ${sp.flame.streak} ${sp.flame.streak === 1 ? 'day' : 'days'}${sp.flame.litToday ? ', lit today' : ', ride today to keep it'}`;
  } else if (d === 'progress' && sp) {
    // (No figure on Progress's door: its room says Rider Rank whole; a bare "Rank 16" read as a race place.)
    aria += `. Rider Rank ${sp.bar.page} of ${sp.bar.of}`;
  } else if (d === 'garage') {
    status = h('span', 't9-door-s', `${fmt(m.wallet)} gifts`);
    aria += `. ${fmt(m.wallet)} gifts to spend`;
  }
  const intro = INTRO[st.stage];
  const isNew = intro && intro.door === d && !st.opened.has(d);
  const t = h('span', 't9-door-t', h('span', 't9-door-l', label[d]), status);
  const b = button('secondary', [t, isNew ? h('span', 'gs9-tag is-gift t9-new', 'New') : null], { icon: icn[d], fk: `door-${d}`, cls: 't9-door', aria: isNew ? `${aria}. Something new` : aria });
  b.setAttribute('aria-haspopup', 'dialog');
  b.addEventListener('click', () => openDoor(d, b));
  return b;
}

function render(focus?: string): void {
  const m = st.m;
  root.replaceChildren();
  const main = h('main', 't9');
  main.dataset.screen = '';
  main.setAttribute('aria-label', 'Ghost Sled');
  main.append(logo());
  if (m.firstVisit) {
    main.append(h('p', 't9-tagline', 'Race the ghosts of every great run.'));
    const ride = rideButton();
    main.append(ride);
    renderAim();
    main.append(aimEl!);
    const snd = button('quiet', 'Sound On', { icon: 'speaker', fk: 'sound', cls: 't9-sound' });
    snd.setAttribute('aria-pressed', 'true');
    snd.addEventListener('click', () => {
      const on = snd.getAttribute('aria-pressed') !== 'true';
      snd.setAttribute('aria-pressed', String(on));
      snd.lastChild!.textContent = on ? 'Sound On' : 'Sound Off';
    });
    root.append(h('div', 't9-pool'), main, snd);
  } else {
    const a = aimWords();
    const strip = h('div', 't9-strip');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Where you ride');
    for (const c of m.mountains) strip.append(chip(c, a.about));
    const pick = h('div', 't9-pick', strip);
    renderAim();
    const doors = h('nav', 't9-doors');
    doors.setAttribute('aria-label', 'More');
    for (const d of ['events', 'progress', 'garage', 'settings'] as Door[]) doors.append(doorButton(d));
    const hw = how();
    main.append(pick, rideButton(), ...(hw ? [hw] : []), aimEl!, doors);
    root.append(h('div', 't9-pool'), main);
  }
  // The column arrives from the logo's side once, top to bottom (ART.md 10: a screen comes and goes the way it is built);
  // a re-render (a mountain picked) swaps in place. Reduced motion: no movement (tokens.css).
  if (!entered) {
    entered = true;
    Array.from(main.children).forEach((c, i) => {
      const el = c as HTMLElement;
      el.classList.add('gs9-enter');
      el.style.setProperty('--from-x', '-18px');
      el.style.setProperty('--from-y', '0px');
      el.style.setProperty('--delay', `${i * 60}ms`);
    });
  }
  if (focus) root.querySelector<HTMLElement>(`[data-fk="${focus}"]`)?.focus({ preventScroll: true });
}

let entered = false;

// ---------------------------------------------------------------- the doors' rooms

function sheet(title: string, from: HTMLElement, fill: (body: HTMLElement, close: () => void) => void): void {
  const el = h('section', 'p9-sheet');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title);
  const body = h('div', 'p9-sheet-body');
  let close = (): void => {};
  const x = button('quiet', 'Close', { icon: 'close', fk: 'close-sheet', onClick: () => close() });
  const head = Object.assign(h('h2', 'p9-sheet-h', title), { tabIndex: -1 });
  head.dataset.first = '';
  el.append(h('header', 'p9-sheet-head', head, x));
  el.append(body);
  document.body.append(el);
  close = openSheet(el, from, () => {
    el.remove();
    setOpen(null);
  });
  fill(body, close);
}

function block(head: string, line: string | Node | null, action: HTMLButtonElement | null, extra?: Node | null): HTMLElement {
  return h('div', 'p9-block', h('div', '', h('h3', 'p9-block-h', head), line ? h('p', 'p9-block-p', line) : null), action, extra ? h('div', 'p9-block-x', extra) : null);
}

function openDoor(d: Door, from: HTMLElement): void {
  const m = st.m;
  const sp = m.spine;
  const intro = INTRO[st.stage];
  const fresh = intro && intro.door === d && !st.opened.has(d) ? h('p', 'p9-intro', h('b', '', intro.line.split(':')[0] + ':'), intro.line.slice(intro.line.indexOf(':') + 1)) : null;
  st.opened.add(d);
  setOpen(d);
  from.querySelector('.t9-new')?.remove();
  if (d === 'events') {
    sheet('Daily and Cup', from, (body, close) => {
      if (fresh) body.append(fresh);
      if (sp) {
        const days = h('div', 'p9-days');
        for (const c of sp.flame.calendar) {
          const done = c.day < sp.flame.nextDay || (sp.flame.litToday && c.day === ((sp.flame.streak - 1) % 7) + 1);
          const today = sp.flame.litToday ? c.day === ((sp.flame.streak - 1) % 7) + 1 : c.day === sp.flame.nextDay;
          const li = h('span', `p9-day${done ? ' is-done' : ''}${today ? ' is-today' : ''}`, ico('flame'), `Day ${c.day}`);
          li.setAttribute('aria-label', `Day ${c.day}: ${c.xp} XP${c.gifts ? ` and ${c.gifts} gifts` : ''}${done ? ', lit' : ''}`);
          days.append(li);
        }
        const n = sp.flame.streak;
        body.append(block(`Your Flame: ${n} ${n === 1 ? 'day' : 'days'}`, sp.flame.litToday ? 'Lit today. Any run tomorrow keeps it going.' : 'Ride today to keep it lit.', null, days));
        body.append(h('div', 'p9-sep'));
      }
      const pick = (id: 'daily' | 'cup', label: string) =>
        button('secondary', 'Choose', {
          icon: 'play',
          fk: `choose-${id}`,
          aria: `Choose ${label}`,
          onClick: () => {
            close();
            st.selected = id;
            render('ride');
          },
        });
      const dm = m.daily;
      const dailyLine = dm.medal ? h('span', '', h('span', `p9-medal m-${dm.medal}`), ` ${['', 'Bronze', 'Silver', 'Gold'][dm.medal]} today, best ${clock(dm.time ?? 0)}`) : 'A new mountain and a new field every day';
      body.append(block('Today’s Daily', dailyLine, dm.ready ? pick('daily', "today's Daily") : null));
      if (sp && sp.contracts.length > 0) {
        const list = h('ul', 'p9-list');
        for (const c of sp.contracts) list.append(h('li', `p9-row${c.done ? ' is-done' : ''}`, h('span', 'p9-check', c.done ? ico('check') : null), h('span', 'p9-row-t', c.text), h('span', 'p9-row-v', c.done ? 'Done' : `${c.xp} XP`)));
        body.append(block('Today’s Contracts', `${sp.contracts.filter((c) => c.done).length} of 3 done`, null, list));
      }
      body.append(h('div', 'p9-sep'));
      const cup = m.cup;
      if (cup) {
        const lg = sp?.league;
        const line = h('span', '', `${cup.mood}${cup.event ? `, with a ${cup.event}` : ''}.`, cup.medal ? h('span', '', ' ', h('span', `p9-medal m-${cup.medal}`), ` ${['', 'Bronze', 'Silver', 'Gold'][cup.medal]}, best ${clock(cup.best)}`) : null);
        const league = lg && lg.place ? h('p', 'p9-block-p', `Division ${lg.division} of 5: you are ${ordinal(lg.place)} of 20. The top 4 go up when the week turns.`) : h('p', 'p9-block-p', 'Ride it once to join a league of the week’s records.');
        body.append(block('This Week’s Cup', line, cup.ready ? pick('cup', "this week's Cup") : null, league));
      }
    });
  } else if (d === 'progress') {
    sheet('Progress', from, (body) => {
      if (fresh) body.append(fresh);
      if (sp) {
        const b = sp.bar;
        const bar = h('div', 'p9-bar', h('span', ''));
        (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${(b.into / Math.max(1, b.into + b.need)).toFixed(3)})`;
        const next = b.next?.map((r, i) => (i === 0 ? prize(r) : prize(r).charAt(0).toLowerCase() + prize(r).slice(1))).join(' and ');
        body.append(block(`Rider Rank ${b.page} of ${b.of}`, next ? `Next page: ${next}. ${fmt(b.need)} XP to go.` : 'Every page turned.', button('secondary', 'Almanac', { icon: 'book', fk: 'almanac', onClick: () => toast('The Almanac would open') }), bar));
      }
      const tw = m.twelve;
      if (tw) {
        const busts = h('div', 'p9-busts');
        for (const r of tw.rungs) {
          const s = h('span', `p9-bust is-${r.state}`);
          s.innerHTML = riderBust(r.hat, r.accent);
          s.style.setProperty('--rider', r.accent);
          s.title = `${r.name}, ${r.mountain}: ${r.state === 'beaten' ? 'beaten' : r.state === 'next' ? 'rides next' : r.state === 'locked' ? 'their mountain is locked' : 'waiting'}`;
          s.setAttribute('role', 'img');
          s.setAttribute('aria-label', s.title);
          busts.append(s);
        }
        const nx = tw.next;
        body.append(block(`The Twelve: ${tw.beaten} of 12 beaten`, nx ? `${nx.name} rides next, on ${nx.mountain}. ${nx.bio}` : (tw.hook ?? ''), button('secondary', 'All Twelve', { icon: 'trophy', fk: 'twelve', onClick: () => toast('The ladder of The Twelve would open') }), busts));
      }
      if (sp?.longNight) {
        const ln = sp.longNight;
        const deep = ln.best ? `Your deepest: ${ln.best.legs} ${ln.best.legs === 1 ? 'leg' : 'legs'} and ${fmt(ln.best.z)} m.` : 'Not ridden yet.';
        body.append(block('The Long Night', `${ln.legs} mountains back to back. ${deep}`, button('secondary', 'Choose', { icon: 'play', fk: 'choose-night', onClick: () => toast('The Long Night would be picked') })));
      }
      if (sp?.album) body.append(block('Spirit Album', `${sp.album.got} of ${sp.album.of} stickers found.`, button('secondary', 'Album', { icon: 'sticker', fk: 'album', onClick: () => toast('The album would open') })));
      const golds = m.mountains.reduce((n, c) => n + (c.medals ? c.medals.stages.filter((x) => x >= 3).length + (c.medals.run >= 3 ? 1 : 0) : 0), 0);
      body.append(block('Medals', `${golds} of ${m.mountains.length * 4} golds: three stages and the whole run, on each mountain.`, button('secondary', 'Medals', { icon: 'trophy', fk: 'medals', onClick: () => toast('The medal wall would open') })));
      const list = h('ul', 'p9-list');
      for (const mv of m.missions) list.append(h('li', `p9-row${mv.done ? ' is-done' : ''}`, h('span', 'p9-check', mv.done ? ico('check') : null), h('span', 'p9-row-t', mv.text), h('span', 'p9-row-v', mv.done ? 'Done' : `${fmt(mv.progress)} of ${fmt(mv.target)}`)));
      body.append(block('Missions', null, null, list));
    });
  } else if (d === 'garage') {
    sheet('Garage', from, (body) => {
      if (fresh) body.append(fresh);
      // (The garage itself is the garage lane's, a place and not a sheet: this door is where it opens from. Its page sits
      // beside this one once the lanes are merged.)
      const go = Object.assign(h('a', 'gs9-b gs9-b-secondary', ico('sledBold'), 'Open the Garage'), { href: './garage.html' });
      body.append(block(`${fmt(m.wallet)} gifts to spend`, `Riding the ${m.sledName}.`, null, go));
    });
  } else {
    sheet('Settings', from, (body) => {
      body.append(block('Sound, quality and hints', "Today's settings sheet, in this system's card and buttons, is milestone 1's U4.", null));
    });
  }
}

/** The open room is in the URL (?open=events), so a state can be shared and reloaded. */
function setOpen(v: string | null): void {
  const u = new URL(location.href);
  if (v) u.searchParams.set('open', v);
  else u.searchParams.delete('open');
  history.replaceState(null, '', u);
}

// ---------------------------------------------------------------- feedback

function toast(text: string): void {
  const t = h('p', 'gs9-card', text);
  t.setAttribute('role', 'status');
  t.style.cssText = 'position:fixed;left:50%;top:var(--st);transform:translateX(-50%);margin:0;padding:10px 18px;border-radius:999px;font-weight:800;z-index:9';
  document.body.append(t);
  window.setTimeout(() => t.remove(), 1800);
}

render();
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Space' && !document.querySelector('.p9-sheet') && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    root.querySelector<HTMLButtonElement>('[data-fk="ride"]')?.click();
  }
});
// The capture can ask for a door open: ?open=events|progress|garage|settings.
const openQ = q.get('open') as Door | null;
if (openQ) {
  const b = root.querySelector<HTMLButtonElement>(`[data-fk="door-${openQ}"]`);
  if (b) openDoor(openQ, b);
}
(window as unknown as { __closeTop: typeof closeTop }).__closeTop = closeTop;
