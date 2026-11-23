// Round 9, the screens lane: the results in three beats, a working prototype over a captured frame of the game. It
// reads the contract's own ResultsModel (fixtures.ts) and says, in order: how the run went (the place, the time and
// the one fact that made it, in words); the one reward that matters most, turned over, with Rider Rank's bar at its
// foot; and the one button, with its reason on it. Everything else (the race, the splits, every point of XP, the
// missions, the stickers, the clip, the challenge link) is Details, one level down. A tap or a key lands the story;
// reduced motion shows the end.
import type { IconName } from '../../src/ui/icons';
import type { ResultsModel, RewardCard } from '../../src/ui/contract';
import { biomeArt, riderBust } from '../../src/ui/art';
import { aheadOf, byStanding, clock, margin, type Standing } from '../../src/game/standing';
import { fmt } from '../../src/ui/fmt';
import { backdrop, CASES, resultsBackdrop, resultsModel, type Case } from './fixtures';
import { button, device, h, ico, openSheet, reduced } from './proto';

const q = new URLSearchParams(location.search);
const kase = (CASES as readonly string[]).includes(q.get('case') ?? '') ? (q.get('case') as Case) : 'podium';
const m = resultsModel(kase);
const dev = device();
if (dev === 'phone' || q.get('input') === 'touch') document.documentElement.classList.add('is-touch');
document.querySelector<HTMLElement>('.p9-scene')!.style.backgroundImage = `url("${backdrop(dev, resultsBackdrop(kase))}")`;
const root = document.getElementById('screen')!;

const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;
const you = (): Standing => ({ time: m.finish?.seconds ?? null, distance: m.distance });
const at = (g: ResultsModel['ghosts'][number]): Standing => ({ time: g.time ?? null, distance: g.distance ?? 0 });
const ordinal = (n: number): string => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const nb = (s: string): string => s.replace(/(\d) ([ms])\b/g, '$1 $2');

// ---------------------------------------------------------------- beat one: how you did

interface Beat1 {
  kind: 'win' | 'podium' | 'finish' | 'wreck';
  figure: string;
  of: string;
  word: string;
  time: string | null;
  fact: { text: string; who?: string; whoCls?: string; tone: string; bust?: { hat: string; accent: string } } | null;
}

function place(): { rank: number; of: number } | null {
  if (m.ghosts.length === 0) return null;
  return { rank: 1 + m.ghosts.filter((g) => aheadOf(at(g), you())).length, of: m.ghosts.length + 1 };
}

/** The rider just ahead and the gap, or for a winner the rider just behind. */
function near(): { side: 'behind' | 'ahead'; gap: string; name: string; kind: string } | null {
  const order = [...m.ghosts].sort((a, b) => byStanding(at(a), at(b)));
  const ahead = order.filter((g) => aheadOf(at(g), you()));
  if (ahead.length > 0) {
    const a = ahead[ahead.length - 1];
    const g = margin(at(a), you());
    return g ? { side: 'behind', gap: g, name: a.name, kind: a.kind } : null;
  }
  const b = order.find((g) => !aheadOf(at(g), you()));
  const g = b ? margin(you(), at(b)) : null;
  return b && g ? { side: 'ahead', gap: g, name: b.name, kind: b.kind } : null;
}

/** The medal an event's race line names ("Cup: Bronze. Silver at 2:28.4."), and the next medal's mark. */
function eventMedal(): { medal: string; next: string | null; where: string } | null {
  const l = m.raceLine?.text ?? '';
  const r = /^(Daily|Cup|Trial): (Bronze|Silver|Gold)\.(?: (\w+ at [^.]+(?:\.\d)?)\.)?/.exec(l);
  if (!r) return null;
  return { medal: r[2], next: r[3] ?? null, where: r[1] === 'Daily' ? "on today's Daily" : r[1] === 'Cup' ? "in this week's Cup" : 'in the Trial' };
}

function beat1(): Beat1 {
  const fin = m.finish ?? null;
  const p = place();
  const tw = m.twelve ?? null;
  let fact: Beat1['fact'] = null;
  const n = near();
  const em = eventMedal();
  if (m.trial) fact = { text: m.trial.fact ?? '', tone: 'plain' };
  else if (tw && (tw.tone === 'fell' || tw.tone === 'crowned')) fact = { text: ` beaten. ${tw.beaten} of ${tw.of} down.`, who: tw.rider?.name, whoCls: 'k-rider', tone: 'twelve', bust: tw.rider ?? undefined };
  else if (tw && tw.tone === 'held' && n) fact = { text: ` held you off by ${nb(n.gap)}`, who: tw.rider?.name, whoCls: 'k-rider', tone: 'twelve', bust: tw.rider ?? undefined };
  else if (em) fact = { text: `${em.medal} ${em.where}`, tone: 'plain' };
  else if (fin?.newBest) fact = { text: fin.bestTime === null ? 'Your first finish here' : `A new best, ${(fin.bestTime - fin.seconds).toFixed(1)} s quicker`, tone: 'best' };
  else if (n) fact = n.side === 'behind' ? { text: `${nb(n.gap)} behind `, who: n.name, whoCls: n.kind === 'grudge' ? 'k-grudge' : '', tone: 'plain' } : { text: `${nb(n.gap)} ahead of `, who: n.name, whoCls: n.kind === 'grudge' ? 'k-grudge' : '', tone: 'plain' };
  if (!fin) {
    const short = Math.round((m.finishZ ?? m.distance) - m.distance);
    return { kind: 'wreck', figure: `${fmt(m.distance)} m`, of: '', word: 'Wiped out', time: null, fact: { text: `${m.crashCause}, ${fmt(short)} m short of the line`, tone: 'plain' } };
  }
  if (m.trial?.figure) {
    const md = m.trial.medal;
    return { kind: md >= 3 ? 'win' : md > 0 ? 'podium' : 'finish', figure: m.trial.figure, of: m.trial.unit, word: m.trial.word ?? 'Across the line', time: clock(fin.seconds), fact };
  }
  if (!p) return { kind: 'finish', figure: clock(fin.seconds), of: '', word: 'Across the line', time: null, fact };
  const kind = p.rank === 1 ? 'win' : p.rank <= 3 && p.of >= 4 ? 'podium' : 'finish';
  return { kind, figure: ordinal(p.rank), of: `of ${p.of}`, word: kind === 'win' ? 'First down the mountain' : kind === 'podium' ? 'On the podium' : 'Across the line', time: clock(fin.seconds), fact };
}

// ---------------------------------------------------------------- beat two: the one reward

const RANK_ORDER: RewardCard['kind'][] = ['open', 'sled', 'feature', 'mirror', 'legs', 'hour', 'gate', 'garage', 'charm', 'flourish', 'title', 'gifts'];
const SAYS: Partial<Record<string, string>> = {
  'Daily contracts': 'Three small goals a day, in Daily and Cup',
  'The Spirit Album': 'A sticker for everything you do, in Progress',
  'A new sled': 'The Whirl Saucer is yours, in the Garage',
  'A second charm gate': 'Two charm gates on every run',
  'A third charm gate': 'Three charm gates on every run',
  'The Long Night': 'Whole mountains back to back, in Progress',
};
const GLYPH: Partial<Record<RewardCard['kind'], IconName>> = { charm: 'star', gate: 'star', feature: 'book', sled: 'sledBold', mirror: 'flag', hour: 'snowflake', flourish: 'feather', garage: 'gift', title: 'flag', gifts: 'gift', legs: 'lantern', open: 'flag' };

interface Beat2 {
  art: HTMLElement;
  kicker: string;
  name: string;
  line: string | null;
  more: number;
}

function beat2(): Beat2 | null {
  const sp = m.spine;
  const opened = [...(sp?.opened ?? [])].sort((a, b) => RANK_ORDER.indexOf(a.kind) - RANK_ORDER.indexOf(b.kind));
  const mt = m.unlockedMountains?.[0];
  const extra = opened.length + (m.unlockedMountains?.length ?? 0) + ((sp?.stickers.length ?? 0) > 0 ? 1 : 0) - 1;
  if (mt) {
    const art = h('span', `r9-got-art b-${mt.biome}`);
    const sky = h('span', 't9-sky');
    sky.style.cssText = 'position:absolute;inset:0';
    sky.innerHTML = biomeArt(mt.biome);
    art.append(sky);
    art.classList.add(`b-${mt.biome}`);
    return { art, kicker: 'A new mountain', name: mt.name, line: m.spine?.primary.kind === 'again' ? null : 'Ready to ride from the title', more: extra };
  }
  if (opened.length > 0) {
    const r = opened[0];
    const page = sp ? sp.after.page : r.page;
    return { art: h('span', 'r9-got-art is-gift', ico(GLYPH[r.kind] ?? 'gift')), kicker: `Rider Rank ${page} opens`, name: r.name.replace(/^Charm: /, '').replace(/^Title: /, 'The title '), line: SAYS[r.name] ?? null, more: extra };
  }
  const fin = m.finish;
  if (fin && fin.medal > 0) return { art: h('span', 'r9-got-art', h('span', `p9-medal m-${fin.medal}`)), kicker: 'A medal for the whole run', name: `${MEDAL[fin.medal]}`, line: null, more: extra };
  if (sp && sp.stickers.length > 0) return { art: h('span', 'r9-got-art is-gift', ico('sticker')), kicker: 'Spirit Album', name: sp.stickers.length === 1 ? sp.stickers[0].name : `${sp.stickers.length} new stickers`, line: null, more: 0 };
  return null;
}

// ---------------------------------------------------------------- beat three: the one button

function primary(): { label: string; why: string | null; aria: string } {
  const p = m.spine?.primary;
  const label = p?.text ?? m.runAgainLabel?.text ?? 'Run Again';
  let why = p?.sub ?? null;
  if (p?.kind === 'mission') {
    // "Pass a ghost: done before, so again" says what a player already knows: the button is the run, the reason the mission.
    const mission = /^(.+?): (.+)$/.exec(why ?? '');
    const what = mission ? mission[1] : (why ?? '');
    const short = mission && !/done before/.test(mission[2]) ? ` ${mission[2]}` : '';
    return { label: 'Run Again', why: `Mission: ${what.charAt(0).toLowerCase()}${what.slice(1)}.${short}`, aria: `Run again. Mission: ${what}` };
  }
  if (p?.kind === 'duel') {
    const t = /Time to beat (.+)$/.exec(why ?? '');
    return { label, why: t ? `${t[1]} to beat` : why, aria: p.aria };
  }
  // A medal's mark gets the gap to it: "Silver at 2:28.4: 2.6 s to find".
  const mark = /^(Gold|Silver|Bronze) at (\d+):(\d+\.\d)$/.exec(why ?? '');
  if (mark && m.finish) {
    const gap = m.finish.seconds - (Number(mark[2]) * 60 + Number(mark[3]));
    if (gap > 0) why = `${why}, ${gap.toFixed(1)} s to find`;
  }
  if (why) why = nb(why);
  return { label, why, aria: p?.aria ?? label };
}

// ---------------------------------------------------------------- the screen

let landed = false;
const timers: number[] = [];

function render(): void {
  root.replaceChildren();
  const b1 = beat1();
  const screen = h('main', `r9${reduced() || q.get('land') ? ' is-done' : ' is-playing'}`);
  screen.dataset.screen = '';
  screen.setAttribute('aria-label', 'Run results');

  const mo = h('section', `r9-mo is-${b1.kind}`);
  mo.setAttribute('aria-label', 'How the run went');
  const figRow = h('div', 'r9-mo-figrow', h('span', 'r9-mo-fig gs9-num', b1.figure), b1.of ? h('span', 'r9-mo-of', b1.of) : null);
  figRow.dataset.beat = '0';
  const rule = h('span', 'r9-mo-rule');
  rule.dataset.beat = '0';
  const word = h('div', 'r9-mo-word', h('span', '', b1.word), b1.time ? h('span', 'r9-mo-time gs9-num', b1.time) : null);
  word.dataset.beat = '1';
  mo.append(figRow, rule, word);
  if (b1.fact) {
    const f = b1.fact;
    const fact = h('p', `r9-mo-fact is-${f.tone}`);
    fact.style.margin = '0';
    if (f.bust) {
      const bust = h('span', 'r9-mo-bust');
      bust.innerHTML = riderBust(f.bust.hat, f.bust.accent);
      fact.style.setProperty('--rider', f.bust.accent);
      fact.append(bust);
    }
    const who = f.who ? h('span', `who ${f.whoCls ?? ''}`, f.who) : null;
    who?.setAttribute('translate', 'no');
    // The rider's name leads ("Bram Oakhollow beaten") or follows ("0.4 s behind tove_runs").
    const lead = f.text.startsWith(' ');
    fact.append(h('span', '', lead ? who : null, f.text, lead ? null : who));
    fact.dataset.beat = '2';
    mo.append(fact);
  }

  const col = h('section', 'r9-col');
  col.setAttribute('aria-label', 'What it earned, and what is next');
  const b2 = beat2();
  const sp = m.spine;
  const got = h('div', 'gs9-card r9-got');
  got.dataset.beat = '3';
  if (b2) {
    got.append(b2.art, h('span', 'r9-got-k', b2.kicker), h('span', 'r9-got-n', b2.name));
    got.querySelector('.r9-got-n')?.setAttribute('translate', 'no');
    if (b2.line || b2.more > 0) {
      const line = h('span', 'r9-got-k', b2.line ?? '', b2.more > 0 ? `${b2.line ? '. ' : ''}${b2.more} more in Details` : '');
      line.style.gridColumn = '2';
      got.append(line);
    }
  }
  if (sp) {
    const a = sp.after;
    const bar = h('div', 'p9-bar', h('span', ''));
    const fill = bar.firstElementChild as HTMLElement;
    const share = (b: typeof a) => (b.page >= b.of ? 1 : b.into / Math.max(1, b.into + b.need));
    fill.style.transform = `scaleX(${(landed ? share(a) : sp.before.page < a.page ? 0 : share(sp.before)).toFixed(3)})`;
    fill.dataset.to = share(a).toFixed(3);
    const gifts = m.giftsEarned > 0 ? h('span', 'r9-gifts', ico('gift'), ` +${fmt(m.giftsEarned)} gifts`) : null;
    got.append(h('div', 'r9-rank', h('span', '', `Rider Rank ${a.page}`), bar, gifts));
    if (!b2) {
      const nx = a.next?.[0]?.name;
      got.prepend(h('span', 'r9-got-art', ico('book')), h('span', 'r9-got-k', `Rider Rank ${a.page + 1} opens`), h('span', 'r9-got-n', nx ? nx.replace(/^Charm: /, 'The charm ').replace(/^Title: /, 'The title ') : 'Every page'));
      const togo = h('span', 'r9-got-k', `${fmt(a.need)} XP to go`);
      togo.style.gridColumn = '2';
      got.querySelector('.r9-got-n')?.after(togo);
      got.querySelector('.r9-rank > span')!.textContent = `Rider Rank ${a.page}`;
    }
  }

  const pr = primary();
  const t = h('span', 't9-ride-t', h('span', 't9-ride-v', pr.label), pr.why ? h('span', 't9-ride-why', pr.why) : null);
  t.querySelector('.t9-ride-v')?.setAttribute('translate', 'no');
  const again = button('primary', [t, h('span', 't9-key', 'Space')], { icon: 'play', fk: 'again', aria: pr.aria, cls: 'r9-again', onClick: () => toast(`${pr.aria}: the next run would start`) });
  again.setAttribute('aria-keyshortcuts', 'Space');
  const go = h('div', '', again);
  go.dataset.beat = '4';
  const foot = h(
    'div',
    'r9-foot',
    button('quiet', 'Home', { icon: 'back', fk: 'home', onClick: () => toast('Home: the title would open') }),
    button('quiet', 'Photo', { icon: 'camera', fk: 'photo', onClick: () => toast('Photo mode would open over this scene') }),
    button('secondary', 'Details', { icon: 'chevR', fk: 'details', aria: 'Details: the race, your run and what it paid', onClick: (e?: unknown) => openDetails(e) }),
  );
  foot.dataset.beat = '5';
  col.append(got, go, foot);
  screen.append(mo, col);
  root.append(screen);
}

/** The beats land one after another (0 to about 2.4 s); a tap or a key lands them all. */
function play(): void {
  const screen = root.querySelector<HTMLElement>('.r9')!;
  const at = [0, 260, 520, 900, 2050, 2200];
  const fill = root.querySelector<HTMLElement>('.p9-bar > span');
  if (screen.classList.contains('is-done')) return land();
  for (const el of root.querySelectorAll<HTMLElement>('[data-beat]')) {
    const i = Number(el.dataset.beat);
    timers.push(window.setTimeout(() => el.classList.add('is-on'), at[i]));
  }
  if (fill && typeof fill.animate === 'function') {
    timers.push(
      window.setTimeout(() => {
        const from = fill.style.transform;
        fill.animate([{ transform: from }, { transform: `scaleX(${fill.dataset.to})` }], { duration: 760, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
      }, 1250),
    );
  }
  timers.push(window.setTimeout(land, 2450));
}

function land(): void {
  if (landed) return;
  landed = true;
  for (const t of timers) clearTimeout(t);
  const screen = root.querySelector<HTMLElement>('.r9')!;
  screen.classList.remove('is-playing');
  screen.classList.add('is-done');
  const fill = root.querySelector<HTMLElement>('.p9-bar > span');
  if (fill) {
    fill.getAnimations().forEach((a) => a.cancel());
    fill.style.transform = `scaleX(${fill.dataset.to})`;
  }
  if (!document.documentElement.classList.contains('is-touch')) root.querySelector<HTMLElement>('[data-fk="again"]')?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- Details

function openDetails(_e?: unknown): void {
  land();
  const from = root.querySelector<HTMLElement>('[data-fk="details"]');
  const el = h('section', 'p9-sheet is-right r9-det');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Details');
  let close = (): void => {};
  el.append(h('header', 'p9-sheet-head', h('h2', 'p9-sheet-h', 'Details'), button('quiet', 'Back', { icon: 'back', fk: 'close-details', onClick: () => close() })));
  const body = h('div', 'p9-sheet-body');
  el.append(body);

  // The race: the finishing order, you in it.
  if (m.ghosts.length > 0) {
    const order = [...m.ghosts].sort((a, b) => byStanding(at(a), at(b)));
    const list = h('ol', 'p9-list r9-order');
    let i = 1;
    const row = (name: string, fig: string, cls: string) => list.append(h('li', `p9-row ${cls}`, h('span', 'p9-row-n gs9-num', String(i++)), h('span', 'p9-row-t', name), h('span', 'p9-row-v gs9-num', fig)));
    let mine = false;
    for (const g of order) {
      if (!mine && !aheadOf(at(g), you())) {
        row('You', m.finish ? clock(m.finish.seconds) : `${fmt(m.distance)} m`, 'is-you');
        mine = true;
      }
      row(g.kind === 'you' ? 'Your best' : g.name, g.time != null ? clock(g.time) : `${fmt(g.distance ?? 0)} m`, g.kind === 'grudge' ? 'k-grudge' : '');
    }
    if (!mine) row('You', m.finish ? clock(m.finish.seconds) : `${fmt(m.distance)} m`, 'is-you');
    const sec = h('section', '', h('h3', 'r9-sec-h', 'The race'), list);
    const said = m.twelve?.says && m.twelve.rider ? h('p', 'p9-block-p', `“${m.twelve.says}” ${m.twelve.rider.name}`) : m.raceLine && !/^(Daily|Cup|Trial):/.test(m.raceLine.text) ? h('p', 'p9-block-p', m.raceLine.text) : null;
    if (said) sec.append(said);
    if (m.crashNote) sec.append(h('p', 'p9-block-p', m.crashNote));
    body.append(sec);
  }

  // Your run: the clock at each stage line against your best, and the tricks worth naming.
  const runList = h('ul', 'p9-list');
  for (const s of m.finish?.splits ?? []) runList.append(h('li', 'p9-row', h('span', 'p9-row-t', s.name), h('span', 'p9-row-v gs9-num', `${clock(s.seconds)}${s.vsBest === null ? '' : `, ${Math.abs(s.vsBest).toFixed(1)} s ${s.vsBest < 0 ? 'ahead of' : 'behind'} your best`}`)));
  runList.append(h('li', 'p9-row', h('span', 'p9-row-t', 'Style score'), h('span', 'p9-row-v gs9-num', fmt(m.score))));
  if (m.bestCombo >= 1000) runList.append(h('li', 'p9-row', h('span', 'p9-row-t', 'Best combo'), h('span', 'p9-row-v gs9-num', fmt(m.bestCombo))));
  if (m.perfects > 0) runList.append(h('li', 'p9-row', h('span', 'p9-row-t', 'Perfect landings'), h('span', 'p9-row-v gs9-num', fmt(m.perfects))));
  body.append(h('section', '', h('h3', 'r9-sec-h', 'Your run'), runList));

  // What it paid: every point of XP, the gifts, what opened, the stickers, the contracts and the missions.
  const sp = m.spine;
  const paid = h('ul', 'p9-list');
  if (sp) {
    const total = sp.ticks.reduce((s, t) => s + t.xp, 0);
    for (const t of sp.ticks) paid.append(h('li', 'p9-row', h('span', 'p9-row-t', t.label), h('span', 'p9-row-v gs9-num', `${fmt(t.xp)} XP`)));
    paid.append(h('li', 'p9-row', h('span', 'p9-row-t', h('b', '', `Rider Rank ${sp.after.page}`)), h('span', 'p9-row-v gs9-num', `${fmt(total)} XP this run`)));
  }
  paid.append(h('li', 'p9-row', h('span', 'p9-row-t', 'Gifts'), h('span', 'p9-row-v gs9-num', `${fmt(m.giftsEarned)} this run, ${fmt(m.wallet)} to spend`)));
  const sec = h('section', '', h('h3', 'r9-sec-h', 'What it paid'), paid);
  const opened = [...(m.unlockedMountains ?? []).map((u) => u.name), ...(sp?.opened ?? []).map((r) => r.name)];
  if (opened.length) sec.append(h('p', 'p9-block-p', `Opened: ${opened.join(', ')}.`));
  if (sp?.stickers.length) sec.append(h('p', 'p9-block-p', `${sp.stickers.length} ${sp.stickers.length === 1 ? 'sticker' : 'stickers'} for the album: ${sp.stickers.slice(0, 3).map((s) => s.name).join(', ')}${sp.stickers.length > 3 ? ' and more' : ''}.`));
  if (sp?.contracts.met.length) sec.append(h('p', 'p9-block-p', `Contract met: ${sp.contracts.met.join(', ')}.`));
  if (sp?.league?.place) sec.append(h('p', 'p9-block-p', `Your league: ${ordinal(sp.league.place)} in division ${sp.league.division}${sp.league.was ? `, up from ${ordinal(sp.league.was)}` : ''}.`));
  const mis = h('ul', 'p9-list');
  for (const mv of m.missions) mis.append(h('li', `p9-row${mv.done ? ' is-done' : ''}`, h('span', 'p9-check', mv.done ? ico('check') : null), h('span', 'p9-row-t', mv.text), h('span', 'p9-row-v gs9-num', mv.done ? (mv.justCompleted ? 'Done this run' : 'Done') : `${fmt(mv.progress)} of ${fmt(mv.target)}`)));
  sec.append(h('h3', 'r9-sec-h', 'Missions'), mis);
  body.append(sec);

  // The run itself, kept or sent.
  body.append(
    h(
      'section',
      '',
      h('h3', 'r9-sec-h', 'Keep this run'),
      h(
        'div',
        'r9-acts',
        button('secondary', 'Watch your run', { icon: 'video', fk: 'watch', onClick: () => toast('The reel would play') }),
        button('secondary', 'Save a clip', { icon: 'clip', fk: 'clip', onClick: () => toast('The clip would record') }),
        m.canChallenge ? button('secondary', 'Challenge a friend', { icon: 'link', fk: 'challenge', onClick: () => toast('A challenge link would be copied') }) : null,
      ),
    ),
  );
  const pr = primary();
  const t = h('span', 't9-ride-t', h('span', 't9-ride-v', pr.label), pr.why ? h('span', 't9-ride-why', pr.why) : null);
  body.append(h('div', 'r9-det-go', button('primary', [t], { icon: 'play', fk: 'again-det', aria: pr.aria, cls: 'r9-again', onClick: () => toast(`${pr.aria}: the next run would start`) })));
  document.body.append(el);
  close = openSheet(el, from, () => el.remove());
}

function toast(text: string): void {
  const t = h('p', 'gs9-card', text);
  t.setAttribute('role', 'status');
  t.style.cssText = 'position:fixed;left:50%;top:var(--st);transform:translateX(-50%);margin:0;padding:10px 18px;border-radius:999px;font-weight:800;z-index:9';
  document.body.append(t);
  window.setTimeout(() => t.remove(), 1800);
}

render();
play();
const opened = Date.now();
window.addEventListener('pointerdown', (e: PointerEvent) => {
  if (!landed && !(e.target instanceof Element && e.target.closest('button'))) land();
});
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (document.querySelector('.p9-sheet')) return;
  if (!landed) {
    land();
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  // Space is the run again, as in the game, once the results have been up 700 ms.
  if (e.code === 'Space' && Date.now() - opened > 700 && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    root.querySelector<HTMLButtonElement>('[data-fk="again"]')?.click();
  }
});
if (q.get('open') === 'details') openDetails();
