import type { MountainCard, TitleDoor, TitleModel, UIHandlers } from './contract';
import { clock } from '../game/standing';
import { DIVISIONS, LEAGUE_MOVE, LEAGUE_SIZE } from '../game/league';
import { LEGS } from '../game/modes';
import { SETS, SET_SHARES } from '../game/garage';
import { STAR_GIFTS } from '../game/mastery';
import { riderBust } from './art';
import { barShare } from './almanac';
import { h, sr, type Ctx } from './dom';
import { fmt, NBSP, progFigures } from './fmt';
import { b9, ico9, medalDisc, openSheet, ordinal9, sheetFrame } from './kit9';
import { medalDots, medalWords, pickerOrder } from './title';
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

/** A medal's disc and its word as one unit that never breaks between them ("● Silver"; round 9, the polish lane: the
 *  family critic found the disc ending one line and "Silver this week." starting the next). */
const medalWord = (medal: number): HTMLElement => h('span', 'gs9-nw', medalDisc(medal), `${NBSP}${MEDAL[medal]}`);

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
    // (Round 9, U4: a view with a row to look at first, the rider who rides next, opens with it in sight.)
    const at = v.body.querySelector<HTMLElement>('[data-next]');
    if (at) v.body.scrollTop = Math.max(0, at.getBoundingClientRect().top - v.body.getBoundingClientRect().top - v.body.clientHeight / 2);
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
  const dailyLine = dm.medal ? h('span', '', medalWord(dm.medal), ` today${dm.time && dm.time > 0 ? `, best ${clock(dm.time)}` : ''}.`) : 'A new mountain and a new field every day.';
  body.append(block('Today’s Daily', dailyLine, choose(f, 'daily')));
  // Today's contracts and the form contract.
  if (sp && sp.contracts.length > 0) {
    const list = h('ul', 'gs9-list');
    for (const c of sp.contracts) list.append(row([check(c.done), c.text], c.done ? 'Done' : `${fmt(c.xp)} XP`, c.done ? 'is-done' : ''));
    if (sp.form) list.append(row([check(sp.form.done), `Your form: ${lowerFirst(sp.form.text)}`], sp.form.done ? 'Done' : `${fmt(sp.form.xp)} XP`, sp.form.done ? 'is-done' : ''));
    // (Round 9, U4: the count says what is listed, the form contract with the day's three.)
    const done = sp.contracts.filter((c) => c.done).length + (sp.form?.done ? 1 : 0);
    const of = sp.contracts.length + (sp.form ? 1 : 0);
    body.append(block('Today’s Contracts', `${done} of ${of} done. New ones come each day.`, null, list));
  }
  body.append(sep());
  // This week's Cup and its league.
  const cup = m.cup ?? null;
  if (cup) {
    const line = h('span', '', `${cup.mood}${cup.event ? `, with ${aOr(cup.event)}` : ''}.`, cup.medal ? h('span', '', ' ', medalWord(cup.medal), ` this week${cup.best > 0 ? `, best ${clock(cup.best)}` : ''}.`) : null);
    const lg = sp?.league ?? null;
    let league: HTMLElement;
    if (lg && lg.place) {
      const tb = b9(o.ctx, 'secondary', 'League Table', { icon: 'trophy', fk: 'league', aria: `The league table: division ${lg.division}`, onClick: () => f.push('This Week’s League', (b) => leagueTable(b, m), tb) });
      league = h('div', 'gs9-det-act', h('p', 'gs9-block-p', `${divisionWords(lg.division)}: you are ${ordinal9(lg.place)} of ${LEAGUE_SIZE}. ${leagueMoves(lg.division)}`), tb);
    } else league = h('p', 'gs9-block-p', 'Ride it once to join a league of the week’s records.');
    body.append(block('This Week’s Cup', line, choose(f, 'cup'), league));
  }
  // The week's Trial, once Trials are open.
  const t = m.trial ?? null;
  if (t) {
    const line = h('span', '', `${t.name}. ${t.rule}.`, t.medal ? h('span', '', ' ', medalWord(t.medal), ` held${t.best ? `, best ${t.best}` : ''}.`) : null);
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

/** Who moves at the week's turn, said only for the moves this division has (the top one has none above, the last none
 *  below). */
/** A division and where it stands: "Division 5 of 5, the first" (a new rider's), "Division 1 of 5, the top". */
function divisionWords(division: number): string {
  return `Division ${division} of ${DIVISIONS}${division === DIVISIONS ? ', the first' : division === 1 ? ', the top' : ''}`;
}

function leagueMoves(division: number): string {
  const up = division > 1;
  const down = division < DIVISIONS;
  return up && down ? `The top ${LEAGUE_MOVE} go up and the bottom ${LEAGUE_MOVE} go down when the week turns.` : up ? `The top ${LEAGUE_MOVE} go up when the week turns.` : `The bottom ${LEAGUE_MOVE} go down when the week turns.`;
}

/** The league's table: the nineteen records of your division and you among them (records, never live players). */
function leagueTable(body: HTMLElement, m: TitleModel): void {
  const lg = m.spine?.league ?? null;
  if (!lg) return;
  body.append(h('p', 'gs9-block-p', `${divisionWords(lg.division)}. ${leagueMoves(lg.division)} The others are this week’s runs on the Cup, each one a ghost.`));
  const list = h('ol', 'gs9-list gs9-order');
  list.setAttribute('aria-label', 'The league table');
  lg.rows.forEach((r, i) => {
    // (Round 9, U4: the others are the week's records, each a ghost's run: their names in the ghosts' mint.)
    const n = h('span', r.you ? '' : 'gs9-who is-ghost', r.you ? 'You' : r.name);
    if (!r.you) n.setAttribute('translate', 'no');
    const li = row([h('span', 'gs9-order-n gs9-num', String(i + 1)), n], clock(r.time), `${r.you ? 'is-you' : ''}${(i === LEAGUE_MOVE - 1 && lg.division > 1) || (i === lg.rows.length - LEAGUE_MOVE - 1 && lg.division < DIVISIONS) ? ' is-line' : ''}`);
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
    const all = b9(o.ctx, 'secondary', 'All Twelve', { icon: 'rider', fk: 'twelve', onClick: () => f.push('The Twelve', (b) => ladder(b, m, f), all) });
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
    body.append(block('The Long Night', `${nightLegs(ln.legs)} ${deep}`, go));
  }
  // The Spirit Album.
  if (sp?.album) body.append(block('Spirit Album', `${fmt(sp.album.got)} of ${fmt(sp.album.of)} stickers found.`, b9(o.ctx, 'secondary', 'Album', { icon: 'sticker', fk: 'album', onClick: () => o.hd.onOpenAlbum?.() })));
  // The medals: each mountain's, its ladder and its stars, the Cup's and the Trial's.
  const golds = m.mountains.reduce((n, c) => n + (c.medals ? c.medals.stages.filter((x) => x >= 3).length + (c.medals.run >= 3 ? 1 : 0) : 0), 0);
  const md = b9(o.ctx, 'secondary', 'Medals', { icon: 'trophy', fk: 'medals', onClick: () => f.push('Medals', (b) => medalWall(b, m, f), md) });
  body.append(block('Medals', `${golds} of ${m.mountains.length * 4} golds. Each mountain’s ladder and its board of stars are inside.`, md));
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

/** The Long Night's legs in words, however many are open (round 9, U4: the night is every mountain in the order they
 *  open, then the same mirrored, so three new mountains make sixteen legs with no second pass here). */
export function nightLegs(legs: number): string {
  const half = LEGS.length / 2;
  if (legs <= half) return `${legs} mountains back to back.`;
  const more = legs - half;
  return `${legs} legs: every mountain back to back, then ${more >= half ? 'all of them' : more === 1 ? 'the first' : `the first ${more}`} mirrored.`;
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
    // (Their time on their home ground, said as theirs: a bare time beside a name read as anyone's.)
    const meta = h('span', 'gs9-rung-m', r.time ? `Rides ${r.mountain} in ${r.time}` : r.mountain);
    meta.setAttribute('translate', 'no');
    let tag: HTMLElement | null = null;
    if (r.state === 'beaten') tag = h('span', 'gs9-tag', ico9('check'), 'Beaten');
    else if (r.state === 'locked') tag = h('span', 'gs9-tag', ico9('lock'), 'Locked');
    else if (r.state === 'next' && tw.next) {
      const n = tw.next;
      tag = n.here ? h('span', 'gs9-tag', 'Rides Now') : b9(f.o.ctx, 'secondary', 'Go', { icon: 'arrowR', fk: 'twelve-go', aria: `Go to ${n.mountain} to duel ${n.name}`, onClick: () => {
        f.close();
        f.o.travel(n.mountainId, n.mountain, () => f.o.hd.onSelectMountain(n.mountainId));
      } });
    }
    // (Round 9, U4: the one who rides next says their line; the rest their name, home and time, so the twelve read as
    // a ladder at a glance and not twelve paragraphs; a reader still hears each one's line.)
    const next = r.state === 'next';
    const li = h('li', `gs9-rung is-${r.state}`, h('span', 'gs9-order-n gs9-num', String(i + 1)), bust, h('span', 'gs9-rung-t', name, r.state === 'next' ? h('span', 'gs9-rung-b', r.bio) : sr(r.bio), meta), tag);
    if (next) li.dataset.next = '';
    list.append(li);
  });
  body.append(list);
}

/** The medal wall: every mountain's place on its ladder, its medals and its mastery stars, in the picker's order; the
 *  week's Cup and Trial. Round 9 (U4): an open mountain's row opens its mastery board. */
function medalWall(body: HTMLElement, m: TitleModel, f: Fill): void {
  body.append(h('p', 'gs9-block-p', 'Each mountain’s place on its ladder, its medals and its stars. A row opens its board.'));
  const list = h('ul', 'gs9-list gs9-wall');
  // The discs' legend stands over their column, "Stages" over the three and "Run" over the larger, where a glance at a
  // row finds it (round 9, the polish lane: a critic asked for a closer legend than a line at the top). Each row says
  // its medals in words to a reader, so the key is for the eye.
  const key = h('li', 'gs9-wall-key', h('span', 'gs9-wall-key-t'), h('span', 'gs9-wall-key-d', h('span', 'k-st', 'Stages'), h('span', 'k-run', 'Run')), h('span', 'gs9-wall-key-s'));
  key.setAttribute('aria-hidden', 'true');
  list.append(key);
  const place = (c: MountainCard): string => (c.top ? 'Top of its ladder' : typeof c.rank === 'number' ? `${ordinal9(c.rank)} of ${c.rankOf ?? c.rank} on its ladder` : 'No run yet');
  for (const c of pickerOrder(m.mountains)) {
    const name = h('span', 'gs9-wall-n', c.name);
    name.setAttribute('translate', 'no');
    if (c.locked) {
      list.append(h('li', 'gs9-row is-done', h('span', 'gs9-row-t', name), h('span', 'gs9-tag', ico9('lock'), 'Locked')));
      continue;
    }
    // (A mountain's stars are counted only here, once: a board builds its whole course.)
    const st = c.stars ?? null;
    const stars = st ? `${st.got} of ${st.of} stars` : '';
    const words = h('span', 'gs9-row-t', name, h('span', 'gs9-wall-p', `${place(c)}${stars ? `, ${stars}` : ''}`));
    const dots = c.medals ? medalDots(c.medals, [], true) : null;
    const aria = `${c.name}. ${place(c)}${stars ? `, ${stars}` : ''}. ${c.medals ? medalWords(c.medals) : 'No medals yet'}. Its board`;
    const b: HTMLButtonElement = b9(f.o.ctx, 'quiet', [words, dots, ico9('chevR', 'gs9-wall-chev')], { fk: `board-${c.id}`, aria, cls: 'gs9-wall-b', onClick: () => f.push(`${c.name}’s Board`, (bb) => masteryBoard(bb, c, st), b) });
    list.append(h('li', '', b));
  }
  // (A week's medal with no figure kept for it says the medal, not "No run yet" beside a disc.)
  const week = (medal: number, best: string | null): string => (best ? `Best ${best}` : medal > 0 ? `${MEDAL[medal]} this week` : 'No run yet');
  // (A week's one disc stands in the Run column, the chevron's room kept beside it.)
  if (m.cup) list.append(h('li', 'gs9-row', h('span', 'gs9-row-t', h('span', 'gs9-wall-n', `Week ${m.cup.week} Cup`), h('span', 'gs9-wall-p', week(m.cup.medal, m.cup.best > 0 ? clock(m.cup.best) : null))), medalDots({ stages: [], run: m.cup.medal }), h('span', 'gs9-wall-key-s')));
  if (m.trial) list.append(h('li', 'gs9-row', h('span', 'gs9-row-t', h('span', 'gs9-wall-n', `Week ${m.trial.week} Trial`), h('span', 'gs9-wall-p', week(m.trial.medal, m.trial.best ?? null))), medalDots({ stages: [], run: m.trial.medal }), h('span', 'gs9-wall-key-s')));
  body.append(list);
}

const BOARD_ROWS: ReadonlyArray<[NonNullable<NonNullable<MountainCard['stars']>['board']>[number]['group'], string]> = [
  ['medal', 'Medals for the Whole Run'],
  ['gate', 'Sky Gates'],
  ['moment', 'Set Pieces'],
  ['rider', 'Home Riders'],
  ['clean', 'A Clean Finish'],
];

/** A mountain's mastery board (round 9, U4: drawn for the first time): every star and its goal, held or not, in the
 *  board's rows, and where its set in the garage opens. */
function masteryBoard(body: HTMLElement, c: MountainCard, st: MountainCard['stars'] | null): void {
  const board = st?.board ?? [];
  const set = SETS[c.id] ? SET_SHARES.map((s) => Math.ceil(s * board.length - 1e-9)) : null;
  const left = board.length - (st?.got ?? 0);
  const line = left > 0 ? `${st?.got ?? 0} of ${board.length} stars. Each pays ${STAR_GIFTS} gifts, once.` : `All ${board.length} stars held.`;
  body.append(h('p', 'gs9-block-p', line, set ? ` Its set opens in the garage at ${set[0]}, ${set[1]} and ${set[2]} stars.` : ''));
  for (const [g, title] of BOARD_ROWS) {
    const stars = board.filter((s) => s.group === g);
    if (stars.length === 0) continue;
    const ul = h('ul', 'gs9-list');
    // (Held is the check, in the gifts' marigold as a mission done; a reader hears it.)
    for (const s of stars) ul.append(row([check(s.done), curly(s.label), sr(s.done ? ', held' : ', not yet')], null, s.done ? 'is-done' : ''));
    body.append(h('section', '', h('h3', 'gs9-cap', title), ul));
  }
}
