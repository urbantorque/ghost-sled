import type { MountainCard, TitleDoor, TitleModel, UIHandlers } from './contract';
import { clock } from '../game/standing';
import { DIVISIONS, LEAGUE_MOVE, LEAGUE_SIZE } from '../game/league';
import { riderBust } from './art';
import { barShare } from './almanac';
import { h, type Ctx } from './dom';
import { fmt, progFigures } from './fmt';
import { b9, ico9, medalDisc, openSheet, ordinal9, sheetFrame } from './kit9';
import { medalDots, medalWords } from './title';
import { curly, lowerFirst, prizesLine } from './words';
import './rooms.css';

// Round 9 (U1): the title's two rooms, loaded on demand (title.ts imports this module when a door is opened, so none of
// it is in the first download). Each is a sheet from the logo's side (the bottom on a phone) with its blocks, each block
// its words and its one action.
//   Daily and Cup: the flame and its seven days; today's Daily (Choose); today's three contracts and the form
//     contract; this week's Cup (Choose) and your place in its league, with the league's table; the week's Trial once
//     open (Choose). Everything that changes by the day or the week, so "come back tomorrow" has one place.
//   Progress: Rider Rank and what the next page holds (the Almanac); The Twelve (all twelve, a duel's home a press
//     away); the Long Night once open; the Spirit Album; the medals (each mountain's, its ladder and its stars, the
//     Cup's and the Trial's); the missions. Everything that is a long count of what you have done.
// Choose picks that run and closes the room; Ride then says what it rides. Nothing loading is shown: a block whose field
// is not in yet says what it is and offers nothing. A view pushed in a room (the league's table, all twelve, the
// medals) is a sheet over it, and Back, Escape, Backspace and the pad's B close the top one.

export interface RoomOpts {
  ctx: Ctx;
  hd: UIHandlers;
  /** Where the room is drawn (the title's section) and the door that opened it. */
  parent: HTMLElement;
  from: HTMLElement;
  /** The title's screen under it, inert while it is open. */
  behind: HTMLElement[];
  /** The door's one line of what is new, once. */
  intro: string | null;
  /** The veil to another place (title.ts travel). */
  travel(id: string, name: string, go: () => void, line?: string): void;
  onClose(): void;
}

export interface Room {
  el: HTMLElement;
  close(): void;
  update(m: TitleModel): void;
}

const TITLE: Record<'events' | 'progress', string> = { events: 'Daily and Cup', progress: 'Progress' };
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;

export function openRoom(door: TitleDoor, m: TitleModel, o: RoomOpts): Room {
  const d = door === 'progress' ? 'progress' : 'events';
  let close = (): void => {};
  /** Views pushed in this room, closed with it. */
  const pushed: Array<() => void> = [];
  const f = sheetFrame(o.ctx, { cls: `gs9-room is-${d}`, title: TITLE[d], close: 'Close', closeIcon: 'close', fk: 'close-room', onClose: () => close() });
  const fill = (mm: TitleModel): void => {
    f.body.replaceChildren();
    if (o.intro) {
      const i = o.intro.indexOf(':');
      f.body.append(h('p', 'gs9-intro', i > 0 ? h('b', '', o.intro.slice(0, i + 1)) : null, i > 0 ? o.intro.slice(i + 1) : o.intro));
    }
    const ctx: Fill = { m: mm, o, body: f.body, close: () => close(), push: (title, build, fromEl) => pushView(title, build, fromEl) };
    if (d === 'events') eventsRoom(ctx);
    else progressRoom(ctx);
  };
  /** A view pushed over the room: its own sheet with Back. */
  const pushView = (title: string, build: (body: HTMLElement) => void, fromEl: HTMLElement): void => {
    let shut = (): void => {};
    const v = sheetFrame(o.ctx, { cls: `gs9-room is-view is-${d}`, title, close: 'Back', closeIcon: 'back', fk: 'close-view', onClose: () => shut() });
    build(v.body);
    o.parent.append(v.el);
    shut = openSheet(v.el, fromEl, [], () => {
      v.el.remove();
      const i = pushed.indexOf(shut);
      if (i >= 0) pushed.splice(i, 1);
    });
    pushed.push(shut);
  };
  fill(m);
  o.parent.append(f.el);
  close = openSheet(f.el, o.from, o.behind, () => {
    for (const p of [...pushed].reverse()) p();
    f.el.remove();
    o.onClose();
  });
  return {
    el: f.el,
    close: () => {
      for (const p of [...pushed].reverse()) p();
      close();
    },
    update: (mm) => {
      const a = document.activeElement;
      const fk = a instanceof HTMLElement && f.body.contains(a) ? (a.dataset.fk ?? null) : null;
      const top = f.body.scrollTop;
      fill(mm);
      f.body.scrollTop = top;
      if (fk) f.body.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
    },
  };
}

interface Fill {
  m: TitleModel;
  o: RoomOpts;
  body: HTMLElement;
  close(): void;
  push(title: string, build: (body: HTMLElement) => void, from: HTMLElement): void;
}

/** A block: its heading and line on the left, its one action on the right, and what it holds under them. */
function block(head: string, line: Node | string | null, action: HTMLElement | null, extra?: Node | null, cls = ''): HTMLElement {
  return h('div', `gs9-block${cls ? ` ${cls}` : ''}`, h('div', '', h('h3', 'gs9-block-h', head), line ? h('p', 'gs9-block-p', line) : null), action, extra ? h('div', 'gs9-block-x', extra) : null);
}

const sep = (): HTMLElement => h('div', 'gs9-sep');

/** A list row: its words, and its figure with its word at the far end. */
function row(t: Array<Node | string | null>, v: Node | string | null, cls = ''): HTMLLIElement {
  return h('li', `gs9-row${cls ? ` ${cls}` : ''}`, h('span', 'gs9-row-t', ...t), v !== null ? h('span', 'gs9-row-v gs9-num', v) : null);
}

const check = (done: boolean): HTMLElement => h('span', 'gs9-check', done ? ico9('check') : null);

/** "a Light Storm", "an Avalanche". */
const aOr = (w: string): string => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;

// ---------------------------------------------------------------- Daily and Cup

function eventsRoom(f: Fill): void {
  const { m, o, body } = f;
  const sp = m.spine ?? null;
  // The flame: its days, and what keeps it.
  if (sp) {
    const fl = sp.flame;
    const days = h('ol', 'gs9-days');
    days.setAttribute('aria-label', 'This week of your flame');
    for (const c of fl.calendar) {
      const state = c.day < fl.nextDay ? 'is-done' : c.day === fl.nextDay ? 'is-next' : '';
      const li = h('li', `gs9-day ${state}`, ico9('flame'), h('span', '', `Day ${c.day}`));
      li.setAttribute('aria-label', `Day ${c.day}: ${fmt(c.xp)} XP${c.gifts ? ` and ${fmt(c.gifts)} gifts` : ''}${c.ember ? ' and an ember' : ''}${state === 'is-done' ? ', lit' : state === 'is-next' ? ', next' : ''}`);
      days.append(li);
    }
    const n = fl.streak;
    const line = fl.litToday ? 'Lit today. Any run tomorrow keeps it going.' : fl.atRisk ? 'Ride today to keep it lit.' : 'Any run lights the day.';
    const ember = fl.ember ? ' You hold an ember: it keeps the flame through one missed day.' : ' Day 7 gives an ember, which keeps it through one missed day.';
    body.append(block(n > 0 ? `Your Flame: ${n} ${n === 1 ? 'Day' : 'Days'}` : 'Your Flame', line + ember, null, days, 'is-flame'), sep());
  }
  // Today's Daily.
  const dm = m.daily;
  const dailyLine = dm.medal ? h('span', '', medalDisc(dm.medal), ` ${MEDAL[dm.medal]} today${dm.time && dm.time > 0 ? `, best ${clock(dm.time)}` : ''}.`) : 'A new mountain and a new field every day.';
  body.append(block('Today’s Daily', dailyLine, choose(f, 'daily')));
  // Today's contracts and the form contract.
  if (sp && sp.contracts.length > 0) {
    const list = h('ul', 'gs9-list');
    for (const c of sp.contracts) list.append(row([check(c.done), c.text], c.done ? 'Done' : `${fmt(c.xp)} XP`, c.done ? 'is-done' : ''));
    if (sp.form) list.append(row([check(sp.form.done), `Your form: ${lowerFirst(sp.form.text)}`], sp.form.done ? 'Done' : `${fmt(sp.form.xp)} XP`, sp.form.done ? 'is-done' : ''));
    const done = sp.contracts.filter((c) => c.done).length;
    body.append(block('Today’s Contracts', `${done} of ${sp.contracts.length} done. New ones come each day.`, null, list));
  }
  body.append(sep());
  // This week's Cup and its league.
  const cup = m.cup ?? null;
  if (cup) {
    const line = h('span', '', `${cup.mood}${cup.event ? `, with ${aOr(cup.event)}` : ''}.`, cup.medal ? h('span', '', ' ', medalDisc(cup.medal), ` ${MEDAL[cup.medal]} this week${cup.best > 0 ? `, best ${clock(cup.best)}` : ''}.`) : null);
    const lg = sp?.league ?? null;
    let league: HTMLElement;
    if (lg && lg.place) {
      const tb = b9(o.ctx, 'secondary', 'League Table', { icon: 'trophy', fk: 'league', aria: `The league table: division ${lg.division}`, onClick: () => f.push('This Week’s League', (b) => leagueTable(b, m), tb) });
      league = h('div', 'gs9-det-act', h('p', 'gs9-block-p', `Division ${lg.division} of ${DIVISIONS}: you are ${ordinal9(lg.place)} of ${LEAGUE_SIZE}. The top ${LEAGUE_MOVE} go up when the week turns.`), tb);
    } else league = h('p', 'gs9-block-p', 'Ride it once to join a league of the week’s records.');
    body.append(block('This Week’s Cup', line, choose(f, 'cup'), league));
  }
  // The week's Trial, once Trials are open.
  const t = m.trial ?? null;
  if (t) {
    const line = h('span', '', `${t.name}. ${t.rule}.`, t.medal ? h('span', '', ' ', medalDisc(t.medal), ` ${MEDAL[t.medal]} held${t.best ? `, best ${t.best}` : ''}.`) : null);
    const goals = t.targets ? h('p', 'gs9-block-p', `Bronze ${t.targets[0]}, silver ${t.targets[1]}, gold ${t.targets[2]}${t.unit ? ` ${t.unit}` : ''}. ${t.left}.`) : null;
    body.append(sep(), block('This Week’s Trial', line, choose(f, 'trial'), goals));
  }
}

/** A block's Choose: it picks that run and closes the room (Ride then says it), once its field is in. A run already
 *  picked says so. Until the field is in, nothing (nothing loading is shown). */
function choose(f: Fill, kind: 'daily' | 'cup' | 'trial'): HTMLElement | null {
  const { m, o } = f;
  const picked = m.selected === kind;
  if (picked) return h('span', 'gs9-tag', ico9('check'), 'Picked');
  const ready = kind === 'daily' ? m.daily.ready : kind === 'cup' ? (m.cup?.ready ?? false) : (m.trial?.ready ?? false);
  if (!ready) return null;
  const what = kind === 'daily' ? 'today’s Daily' : kind === 'cup' ? 'this week’s Cup' : 'this week’s Trial';
  return b9(o.ctx, 'secondary', 'Choose', {
    icon: 'play',
    fk: `choose-${kind}`,
    sound: 'confirm',
    aria: `Choose ${what}`,
    onClick: () => {
      f.close();
      // (Ride says what it rides now, so it takes the focus: Space or A rides the run just chosen, where focus left on
      // the door would open the room again.)
      document.querySelector<HTMLElement>('.gs9-title [data-fk="ride"]')?.focus({ preventScroll: true });
      const t = m.trial;
      if (kind === 'daily') o.travel('daily', 'Daily Mountain', () => o.hd.onDaily());
      else if (kind === 'cup') o.travel('cup', 'Weekly Cup', () => o.hd.onCup?.());
      else if (t) o.travel(t.mountain, `Week ${t.week} Trial`, () => o.hd.onTrial?.(true), t.name);
    },
  });
}

/** The league's table: the nineteen records of your division and you among them (records, never live players). */
function leagueTable(body: HTMLElement, m: TitleModel): void {
  const lg = m.spine?.league ?? null;
  if (!lg) return;
  body.append(h('p', 'gs9-block-p', `Division ${lg.division} of ${DIVISIONS}. The top ${LEAGUE_MOVE} go up and the bottom ${LEAGUE_MOVE} go down when the week turns. The others are the week’s records, each one a run.`));
  const list = h('ol', 'gs9-list gs9-order');
  list.setAttribute('aria-label', 'The league table');
  lg.rows.forEach((r, i) => {
    const n = h('span', '', r.you ? 'You' : r.name);
    if (!r.you) n.setAttribute('translate', 'no');
    const li = row([h('span', 'gs9-order-n gs9-num', String(i + 1)), n], clock(r.time), `${r.you ? 'is-you' : ''}${i === LEAGUE_MOVE - 1 ? ' is-line' : ''}`);
    if (r.you) li.setAttribute('aria-current', 'true');
    list.append(li);
  });
  body.append(list);
  if (lg.last) body.append(h('p', 'gs9-block-p', `Last week: ${lg.last.place ? `${ordinal9(lg.last.place)} in division ${lg.last.division}` : `division ${lg.last.division}, not ridden`}${lg.last.moved < 0 ? ', and up' : lg.last.moved > 0 ? ', and down' : ''}.`));
}

// ---------------------------------------------------------------- Progress

function progressRoom(f: Fill): void {
  const { m, o, body } = f;
  const sp = m.spine ?? null;
  // Rider Rank and what the next page holds.
  if (sp) {
    const b = sp.bar;
    const fill = h('span', 'gs9-bar-fill');
    fill.style.transform = `scaleX(${barShare(b).toFixed(4)})`;
    const bar = h('span', 'gs9-bar', fill);
    bar.setAttribute('aria-hidden', 'true');
    const next = b.next && b.next.length > 0 ? `Next: ${prizesLine(b.next)}. ${fmt(b.need)} XP to go.` : 'Every page of the Almanac turned.';
    const ch = sp.chapter;
    const chapter = ch ? h('p', 'gs9-block-p', `This month’s chapter, ${ch.name}: ${ch.page} of ${ch.of} turned.`) : null;
    const al = b9(o.ctx, 'secondary', 'Almanac', { icon: 'book', fk: 'almanac', onClick: () => o.hd.onOpenAlmanac?.() });
    body.append(block(`Rider Rank ${b.page}`, curly(next), al, h('div', 'gs9-stack', bar, chapter)));
  }
  // The Twelve.
  const tw = m.twelve ?? null;
  if (tw) {
    const busts = h('div', 'gs9-busts');
    for (const r of tw.rungs) {
      const s = h('span', `gs9-bust is-${r.state}`);
      s.innerHTML = riderBust(r.hat, r.accent);
      s.style.setProperty('--rider', r.accent);
      s.setAttribute('role', 'img');
      s.setAttribute('aria-label', `${r.name}, ${r.mountain}: ${r.state === 'beaten' ? 'beaten' : r.state === 'next' ? 'rides next' : r.state === 'locked' ? 'their mountain is locked' : 'waiting'}`);
      busts.append(s);
    }
    const nx = tw.next;
    const line = tw.crowned ? 'All twelve beaten, and all of them at once.' : nx ? `${nx.name} rides next, on ${nx.mountain}. ${nx.bio}` : tw.final ? `The last race: all twelve at once on ${tw.final.mountain}.` : tw.waiting ? `${tw.waiting.rider.name} waits on ${tw.waiting.rider.mountain}. ${tw.waiting.opens}.` : (tw.hook ?? '');
    const all = b9(o.ctx, 'secondary', 'All Twelve', { icon: 'trophy', fk: 'twelve', onClick: () => f.push('The Twelve', (b) => ladder(b, m, f), all) });
    body.append(block(`The Twelve: ${tw.beaten} of ${tw.of} Beaten`, curly(line), all, busts));
  }
  // The Long Night, once open.
  const ln = sp?.longNight ?? null;
  if (ln) {
    const deep = ln.best ? `Your deepest: ${ln.best.legs} ${ln.best.legs === 1 ? 'leg' : 'legs'} and ${fmt(ln.best.z)} m.` : 'Not ridden yet.';
    const go = b9(o.ctx, 'secondary', 'Ride It', {
      icon: 'play',
      fk: 'night',
      sound: 'confirm',
      aria: 'Ride the Long Night from its first leg',
      onClick: () => {
        f.close();
        o.hd.onRideMode?.({ kind: 'night' });
      },
    });
    body.append(block('The Long Night', `${ln.legs} mountains back to back. ${deep}`, go));
  }
  // The Spirit Album.
  if (sp?.album) body.append(block('Spirit Album', `${fmt(sp.album.got)} of ${fmt(sp.album.of)} stickers found.`, b9(o.ctx, 'secondary', 'Album', { icon: 'sticker', fk: 'album', onClick: () => o.hd.onOpenAlbum?.() })));
  // The medals: each mountain's, its ladder and its stars, the Cup's and the Trial's.
  const golds = m.mountains.reduce((n, c) => n + (c.medals ? c.medals.stages.filter((x) => x >= 3).length + (c.medals.run >= 3 ? 1 : 0) : 0), 0);
  const md = b9(o.ctx, 'secondary', 'Medals', { icon: 'trophy', fk: 'medals', onClick: () => f.push('Medals', (b) => medalWall(b, m), md) });
  body.append(block('Medals', `${golds} of ${m.mountains.length * 4} golds. Each mountain’s ladder and mastery stars are inside.`, md));
  // The missions.
  if (m.missions.length > 0) {
    const list = h('ul', 'gs9-list');
    for (const mv of m.missions) {
      const [v, t] = progFigures(Math.min(mv.progress, mv.target), mv.target, mv.dp);
      list.append(row([check(mv.done), mv.text], mv.done ? 'Done' : `${v} of ${t}`, mv.done ? 'is-done' : ''));
    }
    const left = m.missions.filter((x) => !x.done).length;
    body.append(block('Missions', left > 0 ? `${left} to finish. Each pays gifts.` : 'All done. New ones come with the next run.', null, list));
  }
}

/** All twelve, gentlest first: each one's bust, home ground and time there, and who has fallen. The one that rides
 *  now is a press away: Go travels to their mountain and Ride becomes the duel. */
function ladder(body: HTMLElement, m: TitleModel, f: Fill): void {
  const tw = m.twelve;
  if (!tw) return;
  body.append(h('p', 'gs9-block-p', tw.crowned ? 'Every one of them beaten, and all of them at once.' : `Beat each rider on their home ground, one duel at a time.${tw.hook ? ` ${curly(tw.hook)}.` : ''}`));
  const list = h('ol', 'gs9-list gs9-ladder');
  tw.rungs.forEach((r, i) => {
    const bust = h('span', `gs9-bust is-${r.state}`);
    bust.innerHTML = riderBust(r.hat, r.accent);
    bust.style.setProperty('--rider', r.accent);
    const name = h('span', 'gs9-rung-n', r.name);
    name.setAttribute('translate', 'no');
    name.style.setProperty('--rider', r.accent);
    const meta = h('span', 'gs9-rung-m', `${r.mountain}${r.time ? `, ${r.time}` : ''}`);
    meta.setAttribute('translate', 'no');
    let tag: HTMLElement | null = null;
    if (r.state === 'beaten') tag = h('span', 'gs9-tag', ico9('check'), 'Beaten');
    else if (r.state === 'locked') tag = h('span', 'gs9-tag', ico9('lock'), 'Locked');
    else if (r.state === 'next' && tw.next) {
      const n = tw.next;
      tag = n.here ? h('span', 'gs9-tag is-gift', 'Rides now') : b9(f.o.ctx, 'secondary', 'Go', { icon: 'arrowR', fk: 'twelve-go', aria: `Go to ${n.mountain} to duel ${n.name}`, onClick: () => {
        f.close();
        f.o.travel(n.mountainId, n.mountain, () => f.o.hd.onSelectMountain(n.mountainId));
      } });
    }
    const li = h('li', `gs9-rung is-${r.state}`, h('span', 'gs9-order-n gs9-num', String(i + 1)), bust, h('span', 'gs9-rung-t', name, h('span', 'gs9-rung-b', r.bio), meta), tag);
    list.append(li);
  });
  body.append(list);
}

/** The medal wall: every mountain's place on its ladder, its medals and its mastery stars; the week's Cup and Trial. */
function medalWall(body: HTMLElement, m: TitleModel): void {
  body.append(h('p', 'gs9-block-p', 'Three stages, then the whole run. Stars: medals, sky gates, set pieces swept clean, home riders beaten, a clean finish.'));
  const list = h('ul', 'gs9-list gs9-wall');
  const place = (c: MountainCard): string => (c.locked ? 'Locked' : c.top ? 'Top of its ladder' : typeof c.rank === 'number' ? `${ordinal9(c.rank)} of ${c.rankOf ?? c.rank} on its ladder` : 'No run yet');
  for (const c of m.mountains) {
    const name = h('span', 'gs9-wall-n', c.name);
    name.setAttribute('translate', 'no');
    // (A mountain's stars are counted only here: a board builds its whole course.)
    const stars = !c.locked && c.stars ? `, ${c.stars.got} of ${c.stars.of} stars` : '';
    const li = h('li', `gs9-row${c.locked ? ' is-done' : ''}`, h('span', 'gs9-row-t', name, h('span', 'gs9-wall-p', `${place(c)}${stars}`)), !c.locked && c.medals ? medalDots(c.medals) : null);
    if (!c.locked && c.medals) li.setAttribute('aria-label', `${c.name}. ${place(c)}${stars}. ${medalWords(c.medals)}`);
    list.append(li);
  }
  if (m.cup) list.append(h('li', 'gs9-row', h('span', 'gs9-row-t', h('span', 'gs9-wall-n', `Week ${m.cup.week} Cup`), h('span', 'gs9-wall-p', m.cup.best > 0 ? `Best ${clock(m.cup.best)}` : 'No run yet')), medalDots({ stages: [], run: m.cup.medal })));
  if (m.trial) list.append(h('li', 'gs9-row', h('span', 'gs9-row-t', h('span', 'gs9-wall-n', `Week ${m.trial.week} Trial`), h('span', 'gs9-wall-p', m.trial.best ? `Best ${m.trial.best}` : 'No run yet')), medalDots({ stages: [], run: m.trial.medal })));
  body.append(list);
}
