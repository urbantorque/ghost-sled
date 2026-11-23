// Round 9, the garage lane (milestone 0): the page that shows the garage as a place. The workshop (scene.ts) is built
// on load, as the garage button would build it on demand, and the UI over it browses the proposed shelves: picking a
// shelf moves the camera to what it changes, picking a piece puts it on (try before you buy), Buy plays the moment.
// Below the place: the race-distance sheets, the economy table and every item.
//
// URL switches for captures: ?tier=low, ?shot=home|hatFront|hatBack|paint|trail|chase, ?shelf=<id>&item=<id>,
// ?ui=0 (the scene alone), ?buy=1 (play the moment on load), ?run=20 (the mock save's stage of a career).

import { CHAPTERS, ITEMS, SETS, SLEDS, TIER_NAMES, TRACK_LINES, trackPrice, type Item, type ShelfId } from './catalogue';
import { iconSvg } from '../../../src/ui/icons';
import type { Look } from './items';
import economy from './economy.json';

const T0 = performance.now();
const q = new URLSearchParams(location.search);
const tier = q.get('tier') === 'low' ? 'low' : 'high';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

type Shelf = 'sled' | 'hat' | 'scarf' | 'trail' | 'finish' | 'sound';
const SHELF_LABEL: Record<Shelf, string> = { sled: 'Sled', hat: 'Hats', scarf: 'Scarves', trail: 'Trails', finish: 'Finishes', sound: 'Sounds' };
const SHELF_SHOT = { sled: 'home', hat: 'hatBack', scarf: 'chase', trail: 'trail', finish: 'paint', sound: 'home' } as const;

/** How each piece is put on the rider: today's by its own id, a proposal by its sketch (items.ts). */
const LOOKS: Record<string, Look> = {
  'hat:bobbles': { protoHat: 'bobbles2' },
  'hat:crest': { protoHat: 'crest' },
  'hat:muffs': { protoHat: 'muffs' },
  'hat:downcap': { protoHat: 'downcap' },
  'hat:twintails': { protoHat: 'twintails' },
  'hat:floppeak': { protoHat: 'floppeak' },
  'scarf:chunky': { protoScarf: 'chunky2' },
  'scarf:streamer': { protoScarf: 'streamer2' },
  'scarf:double': { protoScarf: 'double' },
  'scarf:pomtails': { protoScarf: 'pomtails' },
  'scarf:cape': { protoScarf: 'cape' },
  'scarf:almanacveil': { protoScarf: 'veil' },
  'trail:papersnow': { protoTrail: 'papersnow' },
  'trail:kitetails': { protoTrail: 'kitetails' },
  'trail:comet': { protoTrail: 'comet2' },
  'trail:almanackeeper': { protoTrail: 'keeper' },
  'finish:pine': { protoFinish: 'pine2' },
  'finish:midnight': { protoFinish: 'stars' },
  'finish:plum': { protoFinish: 'twotone' },
  'finish:snow': { protoFinish: 'chequer' },
  'finish:stripes': { protoFinish: 'twinstripe' },
  'finish:glacier': { paint: '#9FC4E8' },
  'finish:cocoa': { paint: '#4A3428' },
  'finish:ash': { paint: '#3A3640' },
};

function lookOf(it: Item): Look {
  const k = `${it.shelf}:${it.id}`;
  if (LOOKS[k]) return LOOKS[k];
  if (it.shelf === 'hat') return { hat: it.id };
  if (it.shelf === 'scarf') return { scarf: it.id };
  return {};
}

// ---------------------------------------------------------------- the mock save (a mid pilot near run 20)

const save = {
  gifts: Number(q.get('gifts') ?? 410),
  owned: new Set(['hat:beanie', 'hat:watch', 'hat:twinpom', 'hat:trapper', 'scarf:classic', 'scarf:creambar', 'trail:powder', 'trail:honey', 'finish:natural', 'finish:pine', 'sound:runners', 'sound:timber']),
  /** The Pine Flyer's track: tiers fitted, stage lines ridden on it. */
  tiers: 3,
  lines: 26,
  wearing: {} as Record<string, string>,
};

// ---------------------------------------------------------------- the place

const canvas = document.getElementById('g9-canvas') as HTMLCanvasElement;
const ui = document.getElementById('g9-ui') as HTMLElement;
const momentEl = document.getElementById('g9-moment') as HTMLElement;
const { GarageScene } = await import('./scene');
const T1 = performance.now();
const scene = new GarageScene(canvas, tier, 5);
const sceneLook: Look = { tiers: save.tiers };
scene.wear(sceneLook);
scene.show((q.get('shot') as never) ?? 'home', true);

let shelf: Shelf = (q.get('shelf') as Shelf) ?? 'sled';
let picked: string | null = q.get('item');
let running = true;
let frames = 0;
const loop = (now: number): void => {
  if (running) {
    scene.frame(now / 1000);
    frames++;
    if (frames === 1) {
      const w = window as unknown as { __garage: unknown };
      w.__garage = { scene, cost: { ...scene.cost, moduleMs: T1 - T0, openMs: performance.now() - T0 }, tier };
    }
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
new IntersectionObserver((e) => (running = e[0].isIntersecting)).observe(canvas);
addEventListener('resize', () => scene.resize());

// ---------------------------------------------------------------- the UI

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Array<Node | string | null>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null) e.append(k);
  return e;
}

function glyph(name: Parameters<typeof iconSvg>[0]): HTMLElement {
  const s = el('span', 'g9-i');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = iconSvg(name);
  return s;
}

const fmt = (n: number): string => n.toLocaleString('en-GB');

function shelfItems(s: Shelf): Item[] {
  return ITEMS.filter((it) => it.shelf === s);
}

function priceOf(it: Item): number | null {
  return it.source.kind === 'shop' ? it.source.price : null;
}

function sourceLine(it: Item): HTMLElement {
  const box = el('div', 'g9-source');
  const s = it.source;
  if (save.owned.has(`${it.shelf}:${it.id}`) || s.kind === 'free') box.append(el('span', 'g9-tag', 'Yours'));
  else if (s.kind === 'shop') box.append(el('span', 'g9-tag is-gift', glyph('gift'), el('span', 'g9-num', fmt(s.price))), el('span', '', s.price > save.gifts ? `${fmt(s.price - save.gifts)} more gifts` : 'You can have it now'));
  else if (s.kind === 'almanac') box.append(el('span', 'g9-tag', glyph('book'), `Almanac, page ${s.page}`), el('span', '', 'Found, never sold'));
  if (it.status === 'new') box.append(el('span', 'g9-tag', 'New'));
  return box;
}

function render(): void {
  ui.replaceChildren();
  // The top: back, the place's name, the wallet.
  const back = el('button', 'g9-b g9-b-quiet', glyph('back'), 'Title');
  back.type = 'button';
  const wallet = el('span', 'g9-tag is-gift g9-wallet', glyph('gift'), el('span', 'g9-num', fmt(save.gifts)), ' gifts');
  ui.append(el('div', 'g9-top', back, el('h1', 'g9-title', 'Garage'), wallet));
  // The shelves.
  const tabs = el('div', 'g9-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Shelves');
  for (const s of Object.keys(SHELF_LABEL) as Shelf[]) {
    const b = el('button', 'g9-tab', SHELF_LABEL[s]);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(s === shelf));
    b.addEventListener('click', () => {
      shelf = s;
      picked = null;
      scene.show(SHELF_SHOT[s], reduced);
      render();
    });
    tabs.append(b);
  }
  // Arrow keys move between the shelves, as tabs do; the picked one is the one tab in the page's tab order.
  const all = [...tabs.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  all.forEach((b) => (b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1));
  tabs.addEventListener('keydown', (e) => {
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (i < 0 || !step) return;
    e.preventDefault();
    const next = all[(i + step + all.length) % all.length];
    next.click();
    (ui.querySelectorAll<HTMLButtonElement>('[role=tab]')[(i + step + all.length) % all.length])?.focus();
  });
  ui.append(tabs);
  ui.append(shelf === 'sled' ? sledCard() : itemCard());
  ui.append(strip());
}

function sledCard(): HTMLElement {
  const flyer = SLEDS[0];
  const card = el('section', 'g9-card');
  card.setAttribute('aria-label', flyer.name);
  card.append(el('h2', '', flyer.name), el('p', 'g9-reads', 'Your sled. Ride it to open each tier, then fit it.'));
  const list = el('ol', 'g9-track');
  list.setAttribute('aria-label', 'Its five tiers');
  let primary: HTMLButtonElement | null = null;
  TIER_NAMES.forEach((name, t) => {
    const fitted = t < save.tiers;
    const open = !fitted && save.lines >= TRACK_LINES[t];
    const next = t === save.tiers;
    const runs = Math.ceil((TRACK_LINES[t] - save.lines) / 3);
    const state = fitted ? 'Fitted' : open ? `Ready to fit` : next ? `${runs} more ${runs === 1 ? 'run' : 'runs'} on it` : `${TRACK_LINES[t] / 3} runs on it`;
    const li = el('li', `${fitted ? 'is-fitted' : open ? 'is-open' : ''} ${next ? 'is-next' : ''}`, el('span', 'g9-pip'), el('span', '', name), el('span', 'g9-state', state));
    li.addEventListener('pointerenter', () => scene.wear({ ...sceneLook, tiers: Math.max(save.tiers, t + 1) }));
    li.addEventListener('pointerleave', () => scene.wear(sceneLook));
    list.append(li);
    if (next && open) {
      primary = el('button', 'g9-b g9-b-primary', `Fit ${name}`, el('span', 'g9-price', glyph('gift'), el('span', 'g9-num', fmt(trackPrice('flyer', t)))));
    }
  });
  card.append(list);
  const nextT = save.tiers;
  if (!primary && nextT < 5) {
    const runs = Math.ceil((TRACK_LINES[nextT] - save.lines) / 3);
    card.append(el('p', 'g9-reads', `${runs} more ${runs === 1 ? 'run' : 'runs'} and your sled gets its ${TIER_NAMES[nextT].toLowerCase()}. Then ${fmt(trackPrice('flyer', nextT))} gifts to fit it.`));
  }
  const watch = el('button', 'g9-b g9-b-quiet', glyph('play'), 'Watch');
  watch.type = 'button';
  card.append(el('div', 'g9-sig', el('span', '', `Signature: ${flyer.signature}`, el('small', '', flyer.signatureHow)), watch));
  if (primary) card.append(el('div', 'g9-actions', primary));
  return card;
}

function itemCard(): HTMLElement {
  const items = shelfItems(shelf);
  const it = items.find((x) => x.id === picked) ?? items.find((x) => save.wearing[shelf] === x.id) ?? items[0];
  const card = el('section', 'g9-card');
  card.setAttribute('aria-label', it.name);
  card.append(el('h2', '', it.name), el('p', 'g9-reads', it.reads), sourceLine(it));
  const owned = save.owned.has(`${it.shelf}:${it.id}`) || it.source.kind === 'free';
  const price = priceOf(it);
  const actions = el('div', 'g9-actions');
  if (!owned && price !== null) {
    const buy = el('button', 'g9-b g9-b-primary', 'Buy', el('span', 'g9-price', glyph('gift'), el('span', 'g9-num', fmt(price))));
    buy.type = 'button';
    if (price > save.gifts) buy.setAttribute('aria-disabled', 'true');
    buy.addEventListener('click', () => {
      if (price > save.gifts) return;
      purchase(it, price);
    });
    actions.append(buy);
  } else if (owned && save.wearing[shelf] !== it.id) {
    const wear = el('button', 'g9-b g9-b-secondary', glyph('check'), shelf === 'trail' || shelf === 'finish' || shelf === 'sound' ? 'Use it' : 'Wear it');
    wear.type = 'button';
    wear.addEventListener('click', () => {
      save.wearing[shelf] = it.id;
      render();
    });
    actions.append(wear);
  }
  if (shelf === 'hat') {
    for (const [label, shot] of [
      ['Front', 'hatFront'],
      ['Back', 'hatBack'],
    ] as const) {
      const b = el('button', 'g9-b g9-b-quiet', label);
      b.type = 'button';
      b.addEventListener('click', () => scene.show(shot, reduced));
      actions.append(b);
    }
  }
  card.append(actions);
  return card;
}

function strip(): HTMLElement {
  const row = el('div', 'g9-strip');
  row.setAttribute('aria-label', `${SHELF_LABEL[shelf]} on the shelf`);
  if (shelf === 'sled') {
    for (const s of SLEDS) {
      const b = el('button', 'g9-tile', el('b', '', s.name), el('span', s.source.kind === 'shop' ? 'is-gift' : '', s.source.kind === 'shop' ? `${fmt(s.source.price)} gifts` : s.source.kind === 'almanac' ? `Almanac, page ${s.source.page}` : 'Yours'));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(s.id === 'flyer'));
      row.append(b);
    }
    return row;
  }
  for (const it of shelfItems(shelf)) {
    const owned = save.owned.has(`${it.shelf}:${it.id}`) || it.source.kind === 'free';
    const p = priceOf(it);
    const state = owned ? (save.wearing[shelf] === it.id ? 'On' : 'Yours') : p !== null ? `${fmt(p)} gifts` : it.source.kind === 'almanac' ? `Almanac, page ${it.source.page}` : '';
    const b = el('button', 'g9-tile', el('b', '', it.name), el('span', !owned && p !== null ? 'is-gift' : '', state));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(it.id === picked));
    b.addEventListener('click', () => {
      picked = it.id;
      // Try it on: the rider wears it in the scene before it is bought.
      scene.wear({ ...sceneLook, ...lookOf(it) });
      render();
    });
    row.append(b);
  }
  return row;
}

/** The buy moment: the gifts go, a gift opens in the scene, the piece goes on, its own sound, one line said. */
function purchase(it: Item, price: number): void {
  save.gifts -= price;
  save.owned.add(`${it.shelf}:${it.id}`);
  save.wearing[shelf] = it.id;
  chime();
  const skip = (): void => scene.skipMoment();
  addEventListener('pointerdown', skip, { once: true });
  scene.buyMoment(
    () => scene.wear({ ...sceneLook, ...lookOf(it) }),
    () => {
      removeEventListener('pointerdown', skip);
      momentEl.replaceChildren(el('b', '', it.name), el('span', '', 'Yours, and on'));
      momentEl.hidden = false;
      setTimeout(() => (momentEl.hidden = true), 2400);
      scene.show(SHELF_SHOT[shelf], reduced);
      render();
    },
    reduced,
  );
}

/** The moment's own sound: paper torn, then two soft bells a fifth apart (made here; the audio lane would own it). */
function chime(): void {
  try {
    const ac = new AudioContext();
    const t = ac.currentTime;
    const noise = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ac.createBufferSource();
    src.buffer = noise;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    const ng = ac.createGain();
    ng.gain.value = 0.18;
    src.connect(bp).connect(ng).connect(ac.destination);
    src.start(t + 0.55);
    for (const [f, at] of [
      [880, 0.9],
      [1318.5, 1.02],
    ] as const) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(0.16, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.1);
      o.connect(g).connect(ac.destination);
      o.start(t + at);
      o.stop(t + at + 1.2);
    }
  } catch {
    // (No audio: the moment still plays.)
  }
}

if (q.get('ui') !== '0') render();
if (q.get('item')) {
  const it = ITEMS.find((x) => x.shelf === shelf && x.id === q.get('item'));
  if (it) scene.wear({ ...sceneLook, ...lookOf(it) });
}
if (q.get('buy') === '1') {
  const it = ITEMS.find((x) => x.shelf === shelf && x.id === picked);
  if (it && priceOf(it) !== null) purchase(it, priceOf(it)!);
}

// ---------------------------------------------------------------- the notes below the place

const doc = document.getElementById('g9-doc') as HTMLElement;

function section(title: string, ...kids: Node[]): HTMLElement {
  return el('section', '', el('h2', '', title), ...kids);
}

/** The sheets' own sizes (the copies in ./frames), so the page keeps their space before they load. */
const SHEET_SIZE: Record<string, [number, number]> = { hats: [1932, 1932], scarves: [1932, 1451], burn: [1448, 368], finishes: [1932, 1451], sleds: [1456, 732], trails: [1292, 1292] };

const SHEETS: Array<[string, string]> = [
  ['hats', 'Hats: today\'s seven and six proposals'],
  ['scarves', 'Scarves: six of today\'s and six proposals'],
  ['burn', 'A pattern through Spirit Flow: today\'s burn and the one that keeps the knit'],
  ['finishes', 'Finishes: today\'s flat paints and five proposals'],
  ['sleds', 'The Pine Flyer: stock, and its track tier by tier'],
  ['trails', 'Trails: five of today\'s and four proposals'],
];
const sheets = el('div', '', el('p', '', 'Each piece on the live rider, mid-run on Pinecrest at High, the chase lens\'s own frame cropped round the rider at its real size. Numbered and shuffled for the critic; the key is in notes/r9-garage.md.'));
for (const [k, label] of SHEETS) {
  const img = el('img');
  const [w, hh] = SHEET_SIZE[k];
  img.width = w;
  img.height = hh;
  img.src = `./frames/${k}.jpg`;
  img.alt = `${label}, at race distance`;
  img.loading = 'lazy';
  img.decoding = 'async';
  sheets.append(el('figure', 'g9-sheet', img, el('figcaption', '', label)));
}
doc.append(section('At race distance', sheets));

// The economy: each pilot at runs 1, 5, 20, 50 and 100, today and proposed.
type Row = { run: number; life: number; wallet: number; owned: Record<string, number>; near: string[]; saving: string | null; goalsLeft: number; goalsGifts: number; lanternsLit: number; tiers: number; sled: string };
type Table = { pilot: string; garage: string; rule: string; rows: Row[]; dry: number[]; buyout: number | null };
const econ = economy as unknown as { tables: Table[] };
const econBox = el('div', '', el('p', '', 'From the career harness (scripts/playtest/r9-garage-economy.ts): the mid pilot and the novice, 100 runs each, spent by the player\'s rule written in prototypes/r9/garage/economy.ts.'));
for (const t of econ.tables.filter((x) => x.rule === 'player')) {
  const head = el('tr', '', ...['Run', 'Earned', 'Owns', 'Within 1 to 3 runs', 'Saving for', 'Goals left (not lanterns)'].map((h) => el('th', '', h)));
  head.querySelectorAll('th').forEach((th) => th.setAttribute('scope', 'col'));
  const body = el('tbody');
  for (const r of t.rows) {
    const own = Object.entries(r.owned).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing yet';
    body.append(el('tr', '', el('td', 'is-num', String(r.run)), el('td', 'is-num', fmt(r.life)), el('td', '', own), el('td', '', r.near.slice(0, 4).join('; ') || 'nothing but a lantern'), el('td', '', r.saving ?? '-'), el('td', 'is-num', `${r.goalsLeft} (${fmt(r.goalsGifts)})`)));
  }
  econBox.append(el('h3', '', `${t.pilot === 'mid' ? 'Mid pilot' : 'Novice'}, ${t.garage === 'today' ? "today's garage" : 'the proposed garage'}`), el('p', '', `Runs after which nothing but a lantern was within three runs: ${t.dry.length}. The base garage all owned: ${t.buyout ? `run ${t.buyout}` : 'not by run 100'}.`), el('div', 'g9-table-wrap', el('table', 'g9-table', el('thead', '', head), body)));
}
doc.append(section('The economy', econBox));

// Every item, by shelf.
const items = el('div', '');
for (const s of ['hat', 'scarf', 'trail', 'finish', 'sound'] as ShelfId[]) {
  const grid = el('div', 'g9-items');
  for (const it of ITEMS.filter((x) => x.shelf === s)) {
    const src = it.source.kind === 'shop' ? `${fmt(it.source.price)} gifts` : it.source.kind === 'almanac' ? `Almanac, page ${it.source.page}` : 'Every rider has it';
    grid.append(el('div', 'g9-item', el('b', '', it.name), el('span', '', `${src}. ${it.status === 'kept' ? 'Kept' : it.status === 'new' ? 'New' : 'Reworked'}.`), el('span', '', it.reads)));
  }
  items.append(el('h3', '', SHELF_LABEL[s as Shelf] ?? s), grid);
}
const sets = el('div', 'g9-items');
for (const st of SETS) for (const [kind, p] of [['scarf', st.scarf], ['trail', st.trail], ['ornament', st.ornament]] as const) sets.append(el('div', 'g9-item', el('b', '', p.name), el('span', '', `${st.name}, its ${kind}: mastery`), el('span', '', p.reads)));
items.append(el('h3', '', 'The mountains\' sets'), sets);
const chs = el('div', 'g9-items');
for (const ch of CHAPTERS) chs.append(el('div', 'g9-item', el('b', '', ch.name), el('span', '', `Month ${ch.month}: ${ch.motif}`), el('span', '', `${ch.scarf.name}, ${ch.trail.name}, ${ch.ornament.name}`)));
items.append(el('h3', '', 'The months\' chapters'), chs);
doc.append(section('Every item', items));
