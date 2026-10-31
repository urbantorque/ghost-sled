// Dev harness for the overlay UI (ui-harness.html). Not part of the game build.
// Mounts the real UI over a painted stand-in scene and drives every screen with fake data.
// URL params: s=<scenario> (see SCENARIOS), mode=keyboard|mouse|touch,
// bg=alpine|blizzard|night|ember|powder|glass, bare=1 hides the control panel (for screenshots).

import type { GhostKind, HudModel, MissionView, ResultsModel, SettingsModel, SledCard, TitleModel, UIHandlers } from './contract';
import type { Beat, BankTier, GhostRef, PassWord } from '../game/beats';
import type { InputMode, TouchVisual } from '../game/input';
import { bankHeader, bankTier } from '../game/stake';
import { ChaosEvent, EVENTS, Mood, MOODS } from '../sim/chaos';
import { UI, type UIMenuHandlers } from './ui';

const params = new URLSearchParams(location.search);
const mode = (params.get('mode') as InputMode) || 'keyboard';
const bare = params.get('bare') === '1';

const BGS: Record<string, [string, string, string, string, string]> = {
  alpine: ['#2B4C9B', '#FFB38A', '#FFF4E6', '#C9D3F5', '#9DB2EC'],
  blizzard: ['#6D7C93', '#C9D2DE', '#EEF2F7', '#D5DCE7', '#A8B5C8'],
  night: ['#070B22', '#1E2B5E', '#7E92CC', '#55669F', '#3B4A86'],
  ember: ['#2A1E3A', '#FF8A50', '#F2DDD0', '#B9A3C6', '#8C7FA6'],
  powder: ['#2F7BE0', '#CDE8FF', '#FFFFFF', '#E6F0FC', '#B9D3F2'],
  glass: ['#0E6FA8', '#BDF6FF', '#E6FDFF', '#C2EEF8', '#7FC6DF'],
};
const bg = BGS[params.get('bg') ?? 'alpine'] ?? BGS.alpine;
const scene = document.getElementById('scene')!;
['--z', '--hz', '--s1', '--s2', '--s3'].forEach((k, i) => scene.style.setProperty(k, bg[i]));

const logEl = document.createElement('div');
logEl.className = 'log';
const logLines: string[] = [];
/** Every handler call and harness event, readable from automation as window.__calls. */
const calls: string[] = [];
(window as unknown as { __calls: string[] }).__calls = calls;
function log(s: string): void {
  calls.push(s);
  logLines.unshift(s);
  logLines.length = Math.min(logLines.length, 4);
  logEl.textContent = logLines.join('\n');
}

// ---------------------------------------------------------------- Fake data

const missions: MissionView[] = [
  { text: 'Pass 3 ghosts in one run', progress: 2, target: 3, reward: 40, done: false, justCompleted: false },
  { text: 'Land 5 perfect stomps', progress: 5, target: 5, reward: 60, done: true, justCompleted: true },
  { text: 'Drift for 400 m total', progress: 120, target: 400, reward: 30, done: false, justCompleted: false },
];

let settings: SettingsModel = { master: 0.9, music: 0.7, sfx: 1, quality: 'auto', currentTier: 'high', hints: true };

let wallet = 1240;
let sleds: SledCard[] = [
  { id: 0, name: 'Pine Flyer', trait: 'Balanced classic', price: 0, owned: true, equipped: true, affordable: true },
  { id: 1, name: 'Whirl Saucer', trait: 'Spins 20% faster, 8% less grip', price: 120, owned: true, equipped: false, affordable: true },
  { id: 2, name: 'Lodge Toboggan', trait: 'Forgiving landings, turns 8% slower', price: 260, owned: false, equipped: false, affordable: true },
  { id: 3, name: 'Comet Bob', trait: '3% higher cruise, drifts charge 15% slower', price: 420, owned: false, equipped: false, affordable: true },
  { id: 4, name: 'Wisp', trait: 'Drafts 30% stronger, weaker gift pull', price: 640, owned: false, equipped: false, affordable: true },
  { id: 5, name: 'Tea Tray', trait: 'Combos last 20% longer, 8% lower pop', price: 1900, owned: false, equipped: false, affordable: false },
];

let selected = 'pinecrest';
function titleModel(over: Partial<TitleModel> = {}): TitleModel {
  return {
    mountains: [
      { id: 'pinecrest', name: 'Pinecrest', tagline: 'Spruce woods and big kickers', biome: 'alpine', locked: false, unlockText: '', best: 14280 },
      { id: 'frostfang', name: 'Frostfang Glacier', tagline: 'Glass ice and big drops', biome: 'glacier', locked: false, unlockText: '', best: 6315 },
      { id: 'ember', name: 'Ember Peak', tagline: 'Ash snow over a lava glow', biome: 'volcanic', locked: true, unlockText: 'Pass 8 more ghosts to unlock', best: 0 },
      { id: 'sakura', name: 'Sakura Ridge', tagline: 'Petals and spirit gates', biome: 'blossom', locked: true, unlockText: 'Pass 20 more ghosts to unlock', best: 0 },
    ],
    selected,
    daily: { key: '2026-10-24', best: 8420, ready: true },
    best: 14280,
    wallet,
    sledName: sleds.find((s) => s.equipped)?.name ?? 'Pine Flyer',
    challenge: null,
    missions,
    inputMode: mode,
    firstVisit: false,
    ...over,
  };
}

function hudModel(over: Partial<HudModel> = {}): HudModel {
  return {
    score: 12480,
    distance: 1284,
    gifts: 37,
    combo: { active: true, pending: 1240, mult: 4, chain: 5, timer: 0.62 },
    speed: 21,
    nextGhost: { name: 'Mika', kind: 'pool', gap: 34 },
    place: { rank: 3, of: 7 },
    draft: 0.6,
    driftTier: 2,
    danger: { kind: 'avalanche', gap: 34 },
    mood: Mood.Blizzard,
    ...over,
  };
}

function resultsModel(over: Partial<ResultsModel> = {}): ResultsModel {
  return {
    score: 15862,
    distance: 2140,
    best: 14280,
    newBest: true,
    giftsEarned: 38,
    wallet: 1278,
    ghosts: [
      { name: 'Mika', kind: 'pool', score: 15420, distance: 1980, passed: true },
      { name: 'Your best', kind: 'you', score: 14280, distance: 1755, passed: true },
      { name: 'Juniper', kind: 'grudge', score: 15990, distance: 2310, passed: false },
      { name: 'Tove', kind: 'friend', score: 13010, distance: 1420, passed: true },
      { name: 'Ansel', kind: 'pool', score: 16700, distance: 2460, passed: false },
      { name: 'Rook', kind: 'pool', score: 17320, distance: 2604, passed: false },
    ],
    ghostsPassed: 3,
    missions,
    crashCause: 'Clipped a pine',
    bestCombo: 3420,
    perfects: 6,
    maxAir: 2.4,
    mountain: 'Pinecrest',
    mood: 'Blizzard',
    canRevive: true,
    canDouble: true,
    doubled: false,
    canChallenge: true,
    unlocked: [],
    ...over,
  };
}

const reveal = (moodId: Mood, ev: ChaosEvent | null) => {
  const mi = MOODS[moodId];
  return {
    mood: { id: mi.id, name: mi.name, rule: mi.rule },
    event: ev ? { id: ev, name: EVENTS[ev].name } : null,
    reel: MOODS.map((m) => m.name),
  };
};

// ---------------------------------------------------------------- The UI and a fake game

let screen: 'title' | 'run' | 'results' = 'title';
let results = resultsModel();
let live = 0;

const handlers: UIHandlers & UIMenuHandlers = {
  onRide: () => {
    log('onRide');
    startRun(true);
  },
  onRunAgain: () => {
    log('onRunAgain');
    ui.hideResults();
    startRun(true);
  },
  onRevive: () => {
    log('onRevive');
    window.setTimeout(() => {
      results = { ...results, canRevive: false };
      ui.updateResults(results);
    }, 400);
  },
  onDouble: () => {
    log('onDouble');
    window.setTimeout(() => {
      results = { ...results, doubled: true, canDouble: false, giftsEarned: results.giftsEarned * 2, wallet: results.wallet + results.giftsEarned };
      ui.updateResults(results);
    }, 400);
  },
  onChallenge: () => {
    log('onChallenge');
    ui.toast('Challenge link copied', 'info', 'Send it to a friend');
  },
  onHome: () => {
    log('onHome');
    goTitle();
  },
  onPause: (p) => {
    log(`onPause(${p})`);
    if (p) ui.showPause(settings);
    else ui.hidePause();
  },
  onSelectMountain: (id) => {
    log(`onSelectMountain(${id})`);
    selected = id;
    ui.showTitle(titleModel());
  },
  onDaily: () => log('onDaily'),
  onSelectSled: (id) => {
    log(`onSelectSled(${id})`);
    sleds = sleds.map((s) => ({ ...s, equipped: s.id === id }));
    ui.showSleds(sleds, wallet);
  },
  onBuySled: (id) => {
    log(`onBuySled(${id})`);
    const s = sleds.find((x) => x.id === id);
    if (!s) return;
    wallet -= s.price;
    sleds = sleds.map((x) => (x.id === id ? { ...x, owned: true } : { ...x, affordable: x.owned || x.price <= wallet }));
    ui.showSleds(sleds, wallet);
  },
  onSettings: (s) => {
    settings = { ...settings, ...s };
    log(`onSettings(${JSON.stringify(s)})`);
  },
  onUiSound: () => undefined,
  onOpenSleds: () => ui.showSleds(sleds, wallet),
  onOpenSettings: () => ui.showSettings(settings),
};

const ui = new UI(document.getElementById('app')!, handlers);
/** The live UI, for automation (window.__ui.toast(...) etc.). */
(window as unknown as { __ui: UI }).__ui = ui;

// The game owns Space/Enter for Ride and Run again, and P for pause. Simulate that here.
window.addEventListener('keydown', (e) => {
  log(`window keydown ${e.code}`);
  if (e.code === 'Space' || e.code === 'Enter') {
    if (ui.modal && screen !== 'results') return;
    if (screen === 'title') handlers.onRide();
    else if (screen === 'results') handlers.onRunAgain();
  } else if (e.code === 'KeyP' && screen === 'run') {
    handlers.onPause(!ui.modal);
  }
});

// Taps on empty scene space start a ride from the title (the overlay must let them through).
scene.addEventListener('pointerdown', () => {
  log('scene pointerdown (passed through)');
});

const rider = document.getElementById('rider')!;
function placeRider(): void {
  const r = rider.getBoundingClientRect();
  ui.setRiderScreen(r.left + r.width / 2, r.top + r.height / 2);
}
window.addEventListener('resize', placeRider);
placeRider();

function stopLive(): void {
  cancelAnimationFrame(live);
  live = 0;
}

function goTitle(over: Partial<TitleModel> = {}): void {
  stopLive();
  screen = 'title';
  ui.hideHud();
  ui.hideResults();
  ui.hidePause();
  ui.closeMenus();
  ui.showTitle(titleModel(over));
}

function startRun(withReveal: boolean, moodId: Mood = Mood.Lantern, ev: ChaosEvent | null = ChaosEvent.Avalanche): void {
  screen = 'run';
  ui.hideTitle();
  ui.closeMenus();
  ui.showHud();
  const t0 = performance.now();
  const m = hudModel({ mood: moodId, danger: null, combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, draft: 0, driftTier: 0 });
  stopLive();
  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    m.distance = t * 24;
    m.score = Math.round(m.distance * 9.7);
    m.gifts = Math.floor(t / 1.7);
    const cyc = t % 6;
    m.combo = { active: cyc > 1 && cyc < 5, pending: Math.round((cyc - 1) * 420), mult: 1 + Math.floor(Math.max(0, cyc - 1)), chain: 3, timer: 1 - ((cyc * 1.5) % 1) };
    m.draft = Math.max(0, Math.sin(t * 0.8));
    m.driftTier = cyc > 2 && cyc < 4 ? Math.min(3, 1 + Math.floor((cyc - 2) * 1.5)) : 0;
    m.nextGhost = { name: t % 10 < 5 ? 'Mika' : 'Juniper', kind: t % 10 < 5 ? 'pool' : 'grudge', gap: 40 - ((t * 6) % 70) };
    m.place = { rank: 3 + (Math.floor(t / 4) % 3), of: 7 };
    m.danger = t > 8 ? { kind: 'avalanche', gap: Math.max(8, 160 - (t - 8) * 14) } : null;
    ui.updateHud(m);
    live = requestAnimationFrame(tick);
  };
  live = requestAnimationFrame(tick);
  if (withReveal) void ui.reveal(reveal(moodId, ev)).then(() => log('reveal resolved'));
}

/**
 * A fixed HUD model, re-sent every frame like the game does (pass flashes expire on update). The model
 * is returned, so a scenario can change it later (a rank gain, a chase starting).
 */
function staticHud(over: Partial<HudModel> = {}): HudModel {
  stopLive();
  screen = 'run';
  ui.hideTitle();
  ui.showHud();
  const m = hudModel(over);
  ui.updateHud(m);
  const tick = () => {
    ui.updateHud(m);
    live = requestAnimationFrame(tick);
  };
  live = requestAnimationFrame(tick);
  return m;
}

// ?occ=1 outlines the cached ghost-tag occluder rects, to check them against the HUD.
if (params.get('occ') === '1') {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none';
  document.body.append(layer);
  window.setInterval(() => {
    layer.replaceChildren();
    for (const r of ui.occluders()) {
      const b = document.createElement('div');
      b.style.cssText = `position:absolute;left:${r.x0}px;top:${r.y0}px;width:${r.x1 - r.x0}px;height:${r.y1 - r.y0}px;outline:1.5px solid #f0f;background:rgba(255,0,255,0.06)`;
      layer.append(b);
    }
  }, 120);
}

function showResults(over: Partial<ResultsModel> = {}): void {
  stopLive();
  screen = 'results';
  ui.hideTitle();
  ui.hideHud();
  results = resultsModel(over);
  ui.showResults(results);
}

function callouts(): void {
  const seq: Array<[string, number, number, 'normal' | 'big' | 'perfect' | 'lost']> = [
    ['Carve', 40, 1, 'normal'],
    ['Backflip', 320, 2, 'big'],
    ['Perfect landing', 310, 4, 'perfect'],
    ['Drift tier 2', 120, 4, 'normal'],
  ];
  seq.forEach(([l, p, mlt, tone], i) => window.setTimeout(() => ui.popStyle(l, p, mlt, tone), i * 260));
}

const quietHud: Partial<HudModel> = { combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null, draft: 0, driftTier: 0 };

/** A quiet HUD on a fresh run, for the onboarding hints. */
function hintRun(): HudModel {
  ui.hideHud();
  return staticHud({ ...quietHud });
}

// The rear-view mirror is WebGL in the game: here a painted stand-in fills the rect the HUD reports.
const mirrorStandIn = document.createElement('div');
mirrorStandIn.style.cssText =
  'position:fixed;z-index:5;pointer-events:none;display:none;border-radius:18px;background:linear-gradient(180deg,#9fb0de 0%,#4a5c9a 38%,#1d2a5a 62%,#e9e2ee 64%,#f6efe8 100%);box-shadow:inset 0 0 0 2px rgba(18,25,51,0.9),inset 0 0 0 3px rgba(111,195,255,0.5)';
document.body.append(mirrorStandIn);
// Every frame, like the world (contract C9: the rect never animates, but a banner can move the unit).
// The world draws the inset only once the chase is on, though the rect is out from the telegraph.
const followMirror = () => {
  const r = document.querySelector('.gs-hud.is-chased') ? ui.mirrorRect() : null;
  mirrorStandIn.style.display = r ? 'block' : 'none';
  if (r) Object.assign(mirrorStandIn.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  requestAnimationFrame(followMirror);
};
requestAnimationFrame(followMirror);

const touchV: TouchVisual = { steer: null, action: null };

// ---------------------------------------------------------------- Beats (src/game/beats.ts)

const ghost = (name: string, kind: GhostKind = 'pool', dx = 1.5): GhostRef => ({ id: name.length * 7 + kind.length, name, kind, dx });
/** One frame's beats, the way the director hands them over. */
const beats = (...list: Beat[]): void => ui.beats(list);
/** A cash-in of `points` at `mult`, graded the way the director grades it (skill chain 6, given best). */
function bankBeat(points: number, mult: number, best = 0, bump = false): Beat {
  const tier: BankTier = bankTier(points, 6, best);
  return { type: 'bank', tick: 0, points, mult, origin: Math.round(points / mult), tier, header: bankHeader(points, tier, best), bump };
}
const passBeat = (g: GhostRef, word: PassWord, text: string, muted = false): Beat => ({ type: 'pass', tick: 0, ghost: g, word, text, first: true, chain: 0, ladder: 5, octave: false, gifts: 5, muted });
const quietCombo = { active: false, pending: 0, mult: 1, chain: 0, timer: 0 };
/** A HUD whose combo banks the moment the beat arrives (the meter drops as the figure takes over). */
function bankHud(): HudModel {
  const m = staticHud({ ...quietHud, combo: { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.1, stake: 4960 } });
  return m;
}
function cashIn(m: HudModel, b: Beat, at: number): void {
  window.setTimeout(() => {
    if (b.type === 'bank') m.combo = { active: true, pending: b.origin, mult: b.mult, chain: 12, timer: 0.05, stake: b.points };
    window.setTimeout(() => {
      m.combo = { ...quietCombo };
      beats(b);
    }, 260);
  }, at);
}

const SCENARIOS: Record<string, () => void> = {
  title: () => goTitle(),
  'title-first': () => goTitle({ firstVisit: true }),
  'title-challenge': () => goTitle({ challenge: { name: 'Mika', score: 15420, mountain: 'Frostfang' } }),
  'title-missions': () => {
    goTitle();
    window.setTimeout(() => (document.querySelector('[data-fk="missions"]') as HTMLElement | null)?.click(), 450);
  },
  'title-touch': () => goTitle({ inputMode: 'touch' }),
  // A returning player with nothing yet: no zero chips, and the picked card says what it is like.
  'title-zero': () =>
    goTitle({
      wallet: 0,
      best: 0,
      mountains: titleModel().mountains.map((m) => ({ ...m, best: 0, locked: m.id !== 'pinecrest', unlockText: m.id === 'pinecrest' ? '' : `Pass ${m.id === 'frostfang' ? 4 : m.id === 'ember' ? 12 : 24} more ghosts to unlock` })),
      daily: { key: '2026-10-24', best: 0, ready: true },
    }),
  hud: () => staticHud(),
  'hud-live': () => startRun(false, Mood.Haunted, null),
  'hud-grudge': () => staticHud({ nextGhost: { name: 'Juniper', kind: 'grudge', gap: -12 }, danger: { kind: 'avalanche', gap: 18 }, driftTier: 3, draft: 1 }),
  'hud-you': () => staticHud({ nextGhost: { name: 'Your best', kind: 'you', gap: 8 }, danger: null, combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, draft: 0, driftTier: 1, mood: Mood.None }),
  'hud-even': () => staticHud({ nextGhost: { name: 'Mika', kind: 'pool', gap: 0.8 }, danger: null }),
  'hud-behind': () => staticHud({ nextGhost: { name: 'Yusuf42', kind: 'pool', gap: -13 }, place: { rank: 1, of: 6 }, danger: null }),
  // Your own best run as the rival is "Your best" in gold-white (contract C7), whatever its name.
  'hud-you-named': () => staticHud({ ...quietHud, nextGhost: { name: 'Nico Sledsen', kind: 'you', gap: 2 }, place: { rank: 5, of: 7 } }),
  // A gained place: the numeral flips, the pill punches and flashes mint (every 1.6 s, 5th up to 1st).
  'rank-gain': () => {
    const m = staticHud({ ...quietHud, place: { rank: 5, of: 7 } });
    let r = 5;
    const step = () => {
      if (!ui.modal && screen === 'run' && r > 1) {
        r -= 1;
        m.place = { rank: r, of: 7 };
        window.setTimeout(step, 1600);
      }
    };
    window.setTimeout(step, 700);
  },
  // Two places at once, then one back: "5th of 7" reads "3rd ▲2" in mint, then "4th ▼1" dimmed, in
  // the "of 7" slot (the row never changes width).
  'rank-swing': () => {
    const m = staticHud({ ...quietHud, place: { rank: 5, of: 7 }, nextGhost: { name: 'Kai_on_Tour', kind: 'pool', gap: 6 } });
    window.setTimeout(() => (m.place = { rank: 3, of: 7 }), 700);
    window.setTimeout(() => (m.place = { rank: 4, of: 7 }), 2600);
  },
  'rank-first': () => staticHud({ ...quietHud, place: { rank: 1, of: 6 }, nextGhost: { name: 'bjorn.swoosh', kind: 'pool', gap: -9 } }),
  // Leading in a Blizzard with your best behind: the gap reads "7 m behind" in gold-white, your
  // best's own colour (contract C12: a number and a word, never a sign or a chevron).
  'rank-first-you': () => staticHud({ ...quietHud, place: { rank: 1, of: 7 }, nextGhost: { name: 'Nico Sledsen', kind: 'you', gap: -7 }, mood: Mood.Blizzard }),
  // Slipstream charge: two of five lit (ink-grey unlit chevrons, mint lit ones), then the full state
  // (a mint-filled pill). Slipstream ticks never get a callout line while the pill names them.
  'draft-pill': () => {
    const m = staticHud({ ...quietHud, draft: 0.4, combo: { active: true, pending: 40, mult: 1, chain: 1, timer: 0.9 } });
    ui.popStyle('Draft', 40, 1, 'normal');
    window.setTimeout(() => (m.draft = 1), 1800);
  },
  // Night moods: navy pills get a moon-blue hairline so their edges hold on a navy sky.
  'night-pills': () => {
    staticHud({ ...quietHud, mood: Mood.Lantern, draft: 1, place: { rank: 2, of: 7 }, nextGhost: { name: 'Kai_on_Tour', kind: 'pool', gap: 6 } });
    ui.toast('Mission complete', 'mission', 'Land 5 perfect stomps');
  },
  // One move at x1: the total shows over the timer with no "x1" chip, and the line names the move
  // without repeating its number ("+120" over "BOOSTED POP"); a second move brings the line's own back.
  'combo-single': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 120, mult: 1, chain: 1, timer: 0.9 } });
    ui.popStyle('Boosted pop', 120, 1, 'normal');
    window.setTimeout(() => {
      m.combo = { active: true, pending: 160, mult: 1, chain: 2, timer: 0.95 };
      ui.popStyle('Carve', 40, 1, 'normal');
    }, 1500);
  },
  callouts: () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null, draft: 0, driftTier: 0 });
    callouts();
  },
  // Repeats merge into one callout ("SLIPSTREAM", count pips, "+28": never "x3", which is the combo
  // multiplier's; the sim's "Draft" renamed at display time); empty and "0" labels never render.
  'callouts-merge': () => {
    staticHud(quietHud);
    ui.popStyle('', 50, 1, 'normal');
    ui.popStyle('0', 50, 1, 'normal');
    [8, 9, 11].forEach((p, i) => window.setTimeout(() => ui.popStyle('Draft', p, 2, 'normal'), i * 180));
  },
  // One landing fires several style events in the same frame: a perfect landing becomes one stamp
  // beside the rider, the flip folded into its sub-line and the air tick into the combo total.
  'callouts-landing': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.8 }, nextGhost: { name: 'Brave Rhea', kind: 'pool', gap: 1 }, place: { rank: 5, of: 6 } });
    ui.popStyle('Air', 113, 1, 'normal');
    ui.popStyle('Backflip', 600, 2, 'big');
    ui.popStyle('Perfect landing', 490, 2, 'perfect');
  },
  // A late stomp: the clean landing line shows for a moment, then the perfect stamp takes it back.
  'callouts-late-stomp': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 980, mult: 3, chain: 7, timer: 0.9 } });
    ui.popStyle('360', 300, 3, 'big');
    ui.popStyle('Clean landing', 80, 3, 'normal');
    window.setTimeout(() => ui.popStyle('Perfect landing', 250, 3, 'perfect'), 80);
  },
  // A plain stomp, no tricks: the stamp alone.
  'callouts-perfect': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 250, mult: 1, chain: 1, timer: 1 } });
    ui.popStyle('Perfect landing', 250, 1, 'perfect');
  },
  // During a chase: one callout line above the mirror, and the stamp under the unit.
  'callouts-chase': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.5 }, danger: { kind: 'avalanche', gap: 31 } });
    ui.popStyle('Slipstream', 40, 2, 'normal');
    ui.popStyle('Deep carve', 120, 2, 'normal');
    window.setTimeout(() => {
      ui.popStyle('Backflip', 600, 2, 'big');
      ui.popStyle('Perfect landing', 490, 2, 'perfect');
    }, 500);
  },
  // A banner during a chase: the combo steps into the callout line, never into the mirror.
  'callouts-chase-band': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.5 }, danger: { kind: 'avalanche', gap: 24 } });
    ui.warn('Avalanche! Outrun it', ChaosEvent.Avalanche);
    ui.popStyle('Deep carve', 120, 2, 'normal');
  },
  // The same burst while a banner holds the band: the race row fades, the second tier steps down.
  'callouts-band': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.8 } });
    ui.warn('Avalanche! Outrun it', ChaosEvent.Avalanche);
    ui.popStyle('Backflip', 600, 2, 'big');
    ui.popStyle('Perfect landing', 490, 2, 'perfect');
  },
  // A pass flashes in the race row while a landing pays out under the combo: still two tiers.
  'callouts-pass': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.8 }, place: { rank: 2, of: 7 } });
    ui.ghostPass('Mika', 'pool', true);
    ui.popStyle('Draft', 40, 1, 'normal');
    ui.popStyle('Backflip', 600, 2, 'big');
  },
  lost: () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.popStyle('Combo lost', 1240, 4, 'lost');
  },
  bank: () => {
    staticHud({ danger: null });
    window.setTimeout(() => {
      ui.updateHud(hudModel({ danger: null, combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 } }));
      ui.comboBank(4960, 4);
    }, 300);
  },
  toasts: () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.toast('Mission complete', 'mission', 'Land 5 perfect stomps');
    window.setTimeout(() => ui.toast('+5 gifts', 'gift', 'Gift gate'), 150);
    window.setTimeout(() => ui.toast('Juniper is out for revenge', 'grudge'), 300);
  },
  'toasts-2': () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.toast('Mika is on your tail', 'ghost', 'Draft to gain');
    window.setTimeout(() => ui.toast('Thin ice ahead', 'warn'), 150);
    window.setTimeout(() => ui.toast('No ad available right now', 'info'), 300);
  },
  'results-doubled': () => showResults({ doubled: true, canDouble: false, giftsEarned: 76, canRevive: false }),
  pass: () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.ghostPass('Mika', 'pool', true);
  },
  'pass-grudge': () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.ghostPass('Juniper', 'grudge', true);
  },
  // Being passed is quiet: "<name> passed you" a step smaller, no glow, for about a second, and the
  // place ticks down (the numeral drops in and a dim down-arrow and "1" stand after it) once the
  // standings settle.
  'passed-by': () => {
    const m = staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null, place: { rank: 4, of: 6 } });
    window.setTimeout(() => {
      ui.ghostPass('Brave Rhea', 'pool', false);
      m.place = { rank: 5, of: 6 };
    }, 400);
  },
  'passed-by-grudge': () => {
    const m = staticHud({ ...quietHud, place: { rank: 2, of: 7 } });
    window.setTimeout(() => {
      ui.ghostPass('Juniper', 'grudge', false);
      m.place = { rank: 3, of: 7 };
    }, 400);
  },
  // The overtake frame the critics saw: a combo while slipstreaming, a ghost getting past you, then a
  // perfect landing with a backflip. The stamp is the headline (the stamp's sub-line labels each
  // number); a pass in its beat waits and flashes in the race row once it has gone.
  'overtake-frame': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 1243, mult: 2, chain: 6, timer: 0.9 }, place: { rank: 4, of: 6 }, draft: 1, nextGhost: { name: 'MarmotMateo', kind: 'pool', gap: 2.4 } });
    ui.popStyle('Draft', 40, 2, 'normal');
    window.setTimeout(() => {
      ui.ghostPass('Brave Rhea', 'pool', false);
      m.place = { rank: 5, of: 6 };
    }, 300);
    window.setTimeout(() => {
      ui.popStyle('Air', 113, 2, 'normal');
      ui.popStyle('Backflip', 600, 2, 'big');
      ui.popStyle('Perfect landing', 490, 2, 'perfect');
      ui.popStyle('Draft', 8, 2, 'normal');
    }, 600);
  },
  // A big landing: three parts break onto two sub-lines, "PERFECT +490" over the tricks.
  'callouts-landing-big': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 2480, mult: 3, chain: 6, timer: 0.9 } });
    ui.popStyle('Spin 540', 450, 3, 'big');
    ui.popStyle('Double Backflip', 1200, 3, 'big');
    ui.popStyle('Perfect landing', 490, 3, 'perfect');
  },
  // Your own best run passing you, and you passing it (contract C7): never your own name.
  'passed-by-you': () => {
    staticHud({ ...quietHud, nextGhost: { name: 'Nico Sledsen', kind: 'you', gap: -1 } });
    ui.ghostPass('Nico Sledsen', 'you', false);
  },
  'pass-you': () => {
    staticHud({ ...quietHud, place: { rank: 4, of: 7 } });
    ui.ghostPass('Nico Sledsen', 'you', true);
  },
  // A pass and a perfect landing together: one message per beat. The stamp lands, and the pass that
  // started flashing in the same beat steps back and flashes once the stamp has gone.
  'pass-landing': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.8 }, place: { rank: 4, of: 7 } });
    ui.ghostPass('Mika', 'pool', true);
    ui.popStyle('Backflip', 600, 2, 'big');
    ui.popStyle('Perfect landing', 490, 2, 'perfect');
  },
  // A stamp already up when you pass someone holds; the pass waits and flashes after it, and a ghost
  // getting past you in the same moment waits behind that pass.
  'landing-pass': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1203, mult: 2, chain: 3, timer: 0.8 }, place: { rank: 4, of: 7 } });
    ui.popStyle('Perfect landing', 490, 2, 'perfect');
    window.setTimeout(() => ui.ghostPass('Mika', 'pool', true), 500);
    window.setTimeout(() => ui.ghostPass('Brave Rhea', 'pool', false), 700);
  },
  // The game sends the grudge toast and the grudge pass in the same tick: one banner, one sub-line.
  'pass-grudge-settled': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 640, mult: 3, chain: 4, timer: 0.7 } });
    ui.toast('Grudge settled', 'grudge', '+10 gifts');
    ui.ghostPass('Juniper', 'grudge', true);
  },
  // Priority queue: a pass beats "passed you", bad news during a celebration is dropped, the mission
  // toast waits its turn, and an event telegraph cuts in (the celebration comes back after it).
  queue: () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 640, mult: 3, chain: 4, timer: 0.7 } });
    ui.ghostPass('Ansel', 'pool', false);
    window.setTimeout(() => ui.ghostPass('Mika', 'pool', true), 300);
    window.setTimeout(() => ui.ghostPass('Rook', 'pool', false), 500);
    window.setTimeout(() => ui.toast('Mission complete', 'mission', 'Pass 3 ghosts'), 600);
    window.setTimeout(() => ui.warn('Avalanche! Outrun it', ChaosEvent.Avalanche), 900);
  },
  reveal: () => startRun(true, Mood.Blizzard, null),
  'reveal-lantern': () => startRun(true, Mood.Lantern, ChaosEvent.Avalanche),
  'reveal-comet': () => startRun(true, Mood.Comet, null),
  'reveal-haunted': () => startRun(true, Mood.Haunted, null),
  // Avalanche meter at three gaps: far (just started, with its "Avalanche" tag the first time in a
  // run), closing, and urgent (under 20 m: the bar and the rider badge pulse).
  'danger-far': () => {
    ui.hideHud();
    staticHud({ ...quietHud, danger: { kind: 'avalanche', gap: 45 } });
  },
  'danger-mid': () => staticHud({ ...quietHud, danger: { kind: 'avalanche', gap: 28 }, driftTier: 2, draft: 0.6 }),
  // A chase starting: the telegraph, then the mirror, its nameplate and the meter, all in their slot
  // from the chase's first frame (contract C9). The wall then closes from 45 m.
  'danger-chase': () => {
    ui.hideHud();
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 640, mult: 2, chain: 3, timer: 0.9 } });
    ui.warn('Avalanche! Outrun it', ChaosEvent.Avalanche);
    const t0 = performance.now() + 3000;
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      if (screen !== 'run') return;
      if (t >= 0) m.danger = { kind: 'avalanche', gap: Math.max(6, 45 - t * 3.2) };
      window.setTimeout(step, 50);
    };
    step();
  },
  'danger-urgent': () => staticHud({ ...quietHud, danger: { kind: 'avalanche', gap: 9 }, driftTier: 1 }),
  // Under 25 m the mirror's rim pulses in a dark hazard tone; under 12 m the bottom edge darkens too.
  'danger-near': () => staticHud({ ...quietHud, danger: { kind: 'avalanche', gap: 21 } }),
  'reveal-event': () => startRun(true, Mood.GlassIce, ChaosEvent.Yeti),
  'reveal-plain': () => startRun(true, Mood.None, ChaosEvent.GiftStorm),
  'warn-avalanche': () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.warn('Avalanche! Outrun it', ChaosEvent.Avalanche);
  },
  'warn-yeti': () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.warn('Yeti crossing ahead', ChaosEvent.Yeti);
  },
  'warn-gifts': () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.warn('Gift storm incoming', ChaosEvent.GiftStorm);
  },
  'warn-train': () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    ui.warn('Spirit train! Draft them', ChaosEvent.GhostTrain);
  },
  // Hints start a fresh run (the HUD reopens), since a move already done this run keeps its hint away.
  'hint-steer': () => {
    hintRun();
    ui.hint('steer', mode);
  },
  'hint-crouch': () => {
    hintRun();
    ui.hint('crouch', mode);
  },
  'hint-drift': () => {
    hintRun();
    ui.hint('drift', mode);
  },
  'hint-pop': () => {
    hintRun();
    ui.hint('pop', mode);
  },
  'hint-stomp': () => {
    hintRun();
    ui.hint('stomp', mode);
  },
  'hint-draft': () => {
    hintRun();
    ui.hint('draft', mode);
  },
  // The player starts drifting while "Hold while turning to drift" is up: it goes at once, and does not
  // come back this run when the game asks for it again after the drift's release.
  'hint-drift-done': () => {
    const m = hintRun();
    ui.hint('drift', mode);
    window.setTimeout(() => (m.driftTier = 1), 1500);
    window.setTimeout(() => {
      m.driftTier = 0;
      ui.hint(null, mode, false);
      ui.hint('drift', mode, false);
    }, 2600);
  },
  // Touch: the player steers and drifts while the zones are up; the outlines fade out for good.
  'hint-learn': () => {
    hintRun();
    ui.hint('drift', mode, false);
    window.setTimeout(() => ui.hint('drift', mode, true), 1500);
    window.setTimeout(() => ui.hint('pop', mode), 3200);
  },
  // Stress cases: long names and copy everywhere they can appear, to catch overflow and truncation.
  'title-long': () =>
    goTitle({
      challenge: { name: 'Maximilian the Unstoppable', score: 1234567, mountain: 'Sakura Ridge Night Descent' },
      sledName: 'Lodge Toboggan Deluxe Edition',
      mountains: titleModel().mountains.map((m, i) => (i === 0 ? { ...m, name: 'Pinecrest Grand Traverse', best: 1234567 } : m)),
      missions: [{ text: 'Pass 3 ghosts in a single run without crashing into anything at all', progress: 1, target: 3, reward: 1200, done: false, justCompleted: false }, ...missions],
    }),
  'hud-long': () => {
    staticHud({ score: 12345678, distance: 123456, gifts: 12345, nextGhost: { name: 'Maximilian the Unstoppable', kind: 'friend', gap: 1234 }, place: { rank: 12, of: 14 } });
    ui.toast('Mission complete: pass three ghosts in a single run without crashing', 'mission', 'Pass 3 ghosts in one run, reward 40 gifts');
    ui.ghostPass('Maximilian the Unstoppable', 'friend', true);
  },
  results: () => showResults(),
  'results-plain': () =>
    showResults({ newBest: false, score: 9120, canRevive: false, canDouble: false, canChallenge: false, crashCause: 'Hit a rock', mood: '', missions: missions.map((m) => ({ ...m, justCompleted: false })), unlocked: [] }),
  'results-unlock': () => showResults({ unlocked: ['Ember Peak'], canRevive: false }),
  // A personal record (the optional `records` the game may send) shows first, with a Record tag.
  'results-record': () => showResults({ records: ['maxAir'], perfects: 0, canRevive: false }),
  // A first run on a phone: sixth of eight after passing every ghost once (most went on further),
  // a new mountain, no ad offers yet. The race must tell one story and Run again must fit.
  'results-mid': () =>
    showResults({
      score: 429,
      distance: 270,
      best: 0,
      newBest: true,
      giftsEarned: 56,
      wallet: 115,
      ghosts: [
        { name: 'TobogganTeo', kind: 'pool', score: 4100, distance: 605, passed: true },
        { name: 'Kai_on_Tour', kind: 'pool', score: 3900, distance: 604, passed: true },
        { name: 'Tundra Hana', kind: 'pool', score: 2400, distance: 388, passed: true },
        { name: 'xavi.hops', kind: 'pool', score: 2300, distance: 372, passed: true },
        { name: 'thabo.swoosh', kind: 'grudge', score: 2200, distance: 365, passed: true },
        { name: 'KestrelHailstone', kind: 'pool', score: 1500, distance: 256, passed: true },
        { name: 'Your best', kind: 'you', score: 1200, distance: 215, passed: true },
      ],
      ghostsPassed: 7,
      crashCause: 'Hugged a tree',
      crashKind: 'tree',
      bestCombo: 0,
      perfects: 0,
      maxAir: 0.4,
      mood: 'Clear Skies',
      canRevive: false,
      canDouble: false,
      unlocked: ['Ember Peak'],
      unlockedMountains: [{ id: 'ember', name: 'Ember Peak', biome: 'volcanic', tagline: 'Basalt, ash snow, steam vents' }],
    }),
  // Last of seven: nobody beaten, a mission done (its stamp and the reward fly).
  'results-last': () =>
    showResults({
      score: 77,
      distance: 77,
      best: 605,
      newBest: false,
      giftsEarned: 10,
      wallet: 152,
      ghosts: [
        { name: 'FlurrySpruce', kind: 'pool', score: 5200, distance: 702, passed: false },
        { name: 'TobogganTeo', kind: 'pool', score: 4100, distance: 605, passed: false },
        { name: 'Kai_on_Tour', kind: 'pool', score: 3900, distance: 604, passed: false },
        { name: 'Tundra Hana', kind: 'pool', score: 2400, distance: 388, passed: true },
        { name: 'xavi.hops', kind: 'pool', score: 2300, distance: 372, passed: false },
        { name: 'Your best', kind: 'you', score: 1200, distance: 286, passed: true },
      ],
      crashCause: 'Lost in the forest',
      crashKind: 'forest',
      mood: 'Clear Skies',
      canRevive: false,
    }),
  // A bad first run: no tricks scored and no gifts, so the zero stats give way to one tip and the
  // gifts line shows only the wallet.
  'results-zero': () =>
    showResults({
      score: 96,
      distance: 133,
      best: 242,
      newBest: false,
      giftsEarned: 0,
      wallet: 592,
      ghosts: [
        { name: 'Brave Rhea', kind: 'pool', score: 4100, distance: 604, passed: false },
        { name: 'MarmotMateo', kind: 'pool', score: 3900, distance: 489, passed: false },
        { name: 'nils_goes', kind: 'pool', score: 2400, distance: 372, passed: false },
        { name: 'thabo.swoosh', kind: 'pool', score: 2300, distance: 365, passed: false },
        { name: 'Your best', kind: 'you', score: 242, distance: 133, passed: false },
        { name: 'ida_runs', kind: 'pool', score: 900, distance: 124, passed: true },
      ],
      missions: missions.map((m) => ({ ...m, done: false, justCompleted: false, progress: Math.min(m.progress, m.target - 1) })),
      crashCause: 'Lost in the forest',
      crashKind: 'forest',
      bestCombo: 0,
      perfects: 0,
      maxAir: 0,
      mood: 'Clear Skies',
      canRevive: false,
      canDouble: false,
    }),
  pause: () => {
    staticHud();
    ui.showPause(settings);
  },
  sleds: () => {
    goTitle();
    ui.showSleds(sleds, wallet);
  },
  settings: () => {
    goTitle();
    ui.showSettings(settings);
  },
  touch: () => {
    staticHud({ combo: { active: false, pending: 0, mult: 1, chain: 0, timer: 0 }, danger: null });
    const w = innerWidth;
    const hgt = innerHeight;
    touchV.steer = { ox: w * 0.22, x: w * 0.3, y: hgt * 0.8 };
    touchV.action = { x: w * 0.82, y: hgt * 0.78 };
    ui.touchVisual(touchV, true);
  },
  loading: () => {
    goTitle();
    let p = 0;
    const step = () => {
      p += 0.07;
      ui.setLoading(p >= 1 ? null : p);
      if (p < 1) window.setTimeout(step, 120);
    };
    step();
  },
  'loading-hold': () => {
    goTitle();
    ui.setLoading(0.62);
  },

  // ------------------------------------------------------------ Beats: cash-in (src/game/stake.ts)
  // Four tiers in a row, 2.4 s apart: "+80" alone; "+600 x4" rolling to "+2,400"; "+1,500 x6" to
  // "+9,000" with sparks; "+5,000 x8" to "+40,000" under MASSIVE. Each lands on the product alone.
  'bank-tiers': () => {
    const m = bankHud();
    [bankBeat(80, 1), bankBeat(2400, 4), bankBeat(9000, 6), bankBeat(40000, 8)].forEach((b, i) => cashIn(m, b, 300 + i * 2400));
  },
  'bank-t0': () => cashIn(bankHud(), bankBeat(80, 1), 200),
  'bank-t1': () => cashIn(bankHud(), bankBeat(2400, 4), 200),
  'bank-t2': () => cashIn(bankHud(), bankBeat(9000, 6), 200),
  'bank-t3': () => cashIn(bankHud(), bankBeat(40000, 8), 200),
  // A new lifetime best combo (best 3,000 at the start): tier 3 with the gold-white header.
  'bank-best': () => cashIn(bankHud(), bankBeat(4960, 4, 3000), 200),
  // A draft-only x10 never slams: capped at tier 1 by its skill chain.
  'bank-draft': () => {
    const m = bankHud();
    cashIn(m, { type: 'bank', tick: 0, points: 12400, mult: 10, origin: 1240, tier: bankTier(12400, 1, 0), header: null, bump: false }, 200);
  },
  // A bump bank: the same roll, kept small, no sparks.
  'bank-bump': () => cashIn(bankHud(), bankBeat(9000, 6, 0, true), 200),
  // The stake line from x2, then the pace (gold-white, after the Best combo pace beat), then the fuse
  // throbbing faster as the timer drains.
  stake: () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 620, mult: 2, chain: 6, timer: 0.9, stake: 1240 } });
    window.setTimeout(() => (m.combo = { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.85, stake: 4960 }), 900);
    window.setTimeout(() => {
      m.combo = { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.8, stake: 4960, pace: true };
      beats({ type: 'bestComboPace', tick: 0, stake: 4960 });
    }, 1900);
  },
  'stake-fuse': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.38, stake: 4960, fuse: 0.05 } });
    let t = 0.38;
    const step = () => {
      if (screen !== 'run' || t <= 0.02) return;
      t -= 0.01;
      m.combo = { active: true, pending: 1240, mult: 4, chain: 12, timer: t, stake: 4960, fuse: 1 - t / 0.4 };
      window.setTimeout(step, 90);
    };
    window.setTimeout(step, 600);
  },
  'stake-held': () => staticHud({ ...quietHud, combo: { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.3, stake: 4960, fuse: 0.6 } }),
  // A crash with 4,960 on the line: the figure cracks, greys, tilts and falls under COMBO LOST.
  'lost-crack': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.6, stake: 4960 } });
    window.setTimeout(() => {
      m.combo = { ...quietCombo };
      beats({ type: 'comboLost', tick: 0, points: 4960, stake: 4960, best: false, crack: true });
    }, 700);
  },
  'lost-best': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 2480, mult: 5, chain: 15, timer: 0.6, stake: 12400 } });
    window.setTimeout(() => {
      m.combo = { ...quietCombo };
      beats({ type: 'comboLost', tick: 0, points: 12400, stake: 12400, best: true, crack: true });
    }, 700);
  },
  'lost-small': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 120, mult: 1, chain: 2, timer: 0.6, stake: 120 } });
    window.setTimeout(() => {
      m.combo = { ...quietCombo };
      beats({ type: 'comboLost', tick: 0, points: 120, stake: 120, best: false, crack: false });
    }, 700);
  },

  // ------------------------------------------------------------ Beats: stomps
  // Perfect landing, then Double, Triple, Quad stomp and Stomp streak 5, 1.9 s apart, with a spin folded in.
  streak: () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 2480, mult: 4, chain: 12, timer: 0.9, stake: 9920 } });
    const titles = ['Perfect landing', 'Double stomp', 'Triple stomp', 'Quad stomp', 'Stomp streak 5'];
    titles.forEach((title, i) =>
      window.setTimeout(() => {
        const n = i + 1;
        const lead = [{ label: n === 1 ? 'Stomp' : 'Perfect', points: 250 }];
        beats(
          { type: 'callout', tick: 0, source: 'spin', say: { label: 'Spin 540', points: 450, tone: 'big' } },
          { type: 'stomp', tick: 0, streak: n, late: false, title, lead, x: 0, z: 0, heading: 0, yetiHop: false },
        );
      }, 300 + i * 1900),
    );
    window.setTimeout(() => beats({ type: 'streakBroken', tick: 0, was: 5 }), 300 + 5 * 1900);
  },
  'streak-5': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 2480, mult: 4, chain: 12, timer: 0.9, stake: 9920 } });
    beats(
      { type: 'callout', tick: 0, source: 'flip', say: { label: 'Backflip', points: 600, tone: 'big' } },
      { type: 'callout', tick: 0, source: 'spin', say: { label: 'Spin 360', points: 300, tone: 'big' } },
      { type: 'stomp', tick: 0, streak: 5, late: false, title: 'Stomp streak 5', lead: [{ label: 'Perfect', points: 250 }], x: 0, z: 0, heading: 0, yetiHop: false },
    );
  },

  // ------------------------------------------------------------ Beats: the race row
  // Every pass word, 1.7 s apart (jostle is muted: nothing shows).
  'pass-words': () => {
    staticHud({ ...quietHud, place: { rank: 4, of: 7 } });
    const words: Array<[PassWord, string, GhostRef]> = [
      ['jostle', 'Passed', ghost('ida_runs')],
      ['passed', 'Passed', ghost('Mika')],
      ['double', 'Double pass', ghost('Kai_on_Tour')],
      ['triple', 'Triple pass', ghost('TobogganTeo')],
      ['streak', 'Pass streak 4', ghost('MarmotMateo')],
      ['slung', 'Slung past', ghost('Brave Rhea')],
      ['tookBack', 'Took back', ghost('thabo.swoosh')],
      ['beat', 'Beat', ghost('KestrelHailstone')],
      ['duelWon', 'Duel won', ghost('fjord348')],
      ['heldOff', 'Held off', ghost('Juniper', 'grudge')],
      ['yourBest', 'Passed', ghost('Nico Sledsen', 'you')],
    ];
    words.forEach(([w, text, g], i) => window.setTimeout(() => beats(passBeat(g, w, text, w === 'jostle')), 200 + i * 1700));
  },
  'pass-streak': () => {
    staticHud({ ...quietHud, place: { rank: 3, of: 7 } });
    beats(passBeat(ghost('MaximilianTheUnstoppable'), 'streak', 'Pass streak 4'));
  },
  // Race news: a wipeout ahead, your best, the grudge's lantern line, behind you, and the unlock tease.
  'race-news': () => {
    staticHud({ ...quietHud, place: { rank: 4, of: 7 }, nextGhost: { name: 'Mika', kind: 'pool', gap: 18 } });
    const lines: Array<[GhostRef, string]> = [
      [ghost('Tess'), 'Tess wiped out'],
      [ghost('Nico Sledsen', 'you'), 'Your best wiped out'],
      [ghost('Juniper', 'grudge'), 'Juniper wiped out. Pass the lantern'],
      [ghost('Kai_on_Tour'), 'Kai_on_Tour wiped out behind you'],
      [ghost('Tess'), '1 more ghost opens Frostfang Glacier'],
    ];
    lines.forEach(([g, text], i) =>
      window.setTimeout(() => beats({ type: 'raceNews', tick: 0, ghost: g, news: i === 4 ? 'unlockTease' : 'wipeout', text, pan: 0, gain: 1 }), 200 + i * 1600),
    );
  },
  // A pass arriving over news: the pass takes the pill at once; news waiting behind a pass is dropped first.
  'race-queue': () => {
    staticHud({ ...quietHud, place: { rank: 4, of: 7 } });
    beats({ type: 'raceNews', tick: 0, ghost: ghost('Tess'), news: 'wipeout', text: 'Tess wiped out', pan: 0, gain: 1 });
    window.setTimeout(() => beats(passBeat(ghost('Mika'), 'passed', 'Passed')), 400);
    window.setTimeout(() => beats({ type: 'passedBy', tick: 0, ghost: ghost('Brave Rhea'), muted: false }), 500);
    window.setTimeout(() => beats({ type: 'raceNews', tick: 0, ghost: ghost('Rook'), news: 'wipeout', text: 'Rook wiped out', pan: 0, gain: 1 }), 600);
    window.setTimeout(() => beats({ type: 'raceNews', tick: 0, ghost: ghost('Ansel'), news: 'wipeout', text: 'Ansel wiped out', pan: 0, gain: 1 }), 700);
  },
  // The start-line call: "CHASE fjord348", then (as on later runs) the rose "REMATCH Juniper" and "NEMESIS".
  'race-call': () => {
    staticHud({ ...quietHud, place: { rank: 5, of: 6 }, nextGhost: { name: 'fjord348', kind: 'pool', gap: 42 } });
    beats({ type: 'raceCall', tick: 0, ghost: ghost('fjord348'), word: 'Chase', sr: 'Chase fjord348. fjord348 rode 1,820 m.' });
  },
  'race-call-grudge': () => {
    staticHud({ ...quietHud, place: { rank: 5, of: 6 }, nextGhost: { name: 'Juniper', kind: 'grudge', gap: 12 } });
    beats({ type: 'raceCall', tick: 0, ghost: ghost('Juniper', 'grudge'), word: 'Rematch', sr: 'Rematch Juniper. Juniper beat you by 38 m.' });
  },
  'race-call-you': () => {
    staticHud({ ...quietHud, place: { rank: 5, of: 6 }, nextGhost: { name: 'Nico Sledsen', kind: 'you', gap: 30 } });
    beats({ type: 'raceCall', tick: 0, ghost: ghost('Nico Sledsen', 'you'), word: 'Chase', sr: 'Chase your best. 1,240 m.' });
  },
  // A duel: "DUEL Mika" with its ring beating, neck and neck, then "DUEL WON Mika".
  duel: () => {
    const m = staticHud({ ...quietHud, place: { rank: 3, of: 7 }, nextGhost: { name: 'Mika', kind: 'pool', gap: 0.6, duel: true } });
    beats({ type: 'duel', tick: 0, phase: 'open', ghost: ghost('Mika'), gifts: 0 });
    window.setTimeout(() => (m.nextGhost = { name: 'Mika', kind: 'pool', gap: -2.6, duel: true }), 1800);
    window.setTimeout(() => {
      m.nextGhost = { name: 'Rook', kind: 'pool', gap: 22 };
      m.place = { rank: 2, of: 7 };
      beats({ type: 'duel', tick: 0, phase: 'won', ghost: ghost('Mika'), gifts: 5 }, passBeat(ghost('Mika'), 'duelWon', 'Duel won'));
    }, 3200);
  },
  'duel-lost': () => {
    const m = staticHud({ ...quietHud, place: { rank: 3, of: 7 }, nextGhost: { name: 'Juniper', kind: 'grudge', gap: 1.1, duel: true } });
    window.setTimeout(() => {
      m.nextGhost = { name: 'Juniper', kind: 'grudge', gap: 5 };
      beats({ type: 'duel', tick: 0, phase: 'lost', ghost: ghost('Juniper', 'grudge'), gifts: 0 });
    }, 1400);
  },
  // Taking the lead: the crown pulses with a gold-white ring as the pill turns to first place.
  lead: () => {
    const m = staticHud({ ...quietHud, place: { rank: 2, of: 7 }, nextGhost: { name: 'Rook', kind: 'pool', gap: 3 } });
    window.setTimeout(() => {
      m.place = { rank: 1, of: 7 };
      m.nextGhost = { name: 'Rook', kind: 'pool', gap: -2 };
      beats(passBeat(ghost('Rook'), 'passed', 'Passed'), { type: 'lead', tick: 0, of: 7 });
    }, 600);
  },

  // ------------------------------------------------------------ Beats: banners and best
  'grudge-settled': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 640, mult: 3, chain: 4, timer: 0.7, stake: 1920 } });
    const g = ghost('Juniper', 'grudge');
    beats({ type: 'grudgeSettled', tick: 0, ghost: g, nemesis: false, after: 1, paid: 10 }, passBeat(g, 'passed', 'Passed'));
  },
  'nemesis-down': () => {
    staticHud({ ...quietHud });
    const g = ghost('MarmotMateo', 'grudge');
    beats({ type: 'grudgeSettled', tick: 0, ghost: g, nemesis: true, after: 3, paid: 20 }, passBeat(g, 'passed', 'Passed'));
  },
  'finale-avalanche': () => {
    staticHud({ ...quietHud, mood: Mood.Blizzard });
    beats({ type: 'finale', tick: 0, event: ChaosEvent.Avalanche, outcome: 'outran', text: 'Outran the avalanche', sub: '+2,000 style', gifts: 0, grade: 1, banner: true, stamp: false });
  },
  'finale-storm': () => {
    staticHud({ ...quietHud, mood: Mood.Powder });
    beats({ type: 'finale', tick: 0, event: ChaosEvent.GiftStorm, outcome: 'caught', text: 'Caught 48 of 48', sub: 'Clean sweep: +10 gifts', gifts: 10, grade: 3, banner: true, stamp: false });
  },
  'finale-train': () => {
    staticHud({ ...quietHud, mood: Mood.Haunted });
    beats({ type: 'finale', tick: 0, event: ChaosEvent.GhostTrain, outcome: 'rode', text: 'Rode the Spirit Train 6.2 s', sub: '+6 gifts', gifts: 6, grade: 2, banner: true, stamp: false });
  },
  'finale-yeti': () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 1500, mult: 1, chain: 1, timer: 1 } });
    beats({ type: 'finale', tick: 0, event: ChaosEvent.Yeti, outcome: 'hopped', text: 'Yeti hop', sub: 'Yeti hop +1,500', gifts: 0, grade: 1, banner: false, stamp: true });
  },
  'finale-dodged': () => {
    staticHud({ ...quietHud });
    beats({ type: 'finale', tick: 0, event: ChaosEvent.Yeti, outcome: 'dodged', text: 'Yeti dodged', sub: null, gifts: 5, grade: 1, banner: false, stamp: false });
  },
  // Priority: a mission pop on stage yields to a finale, then comes back; the unlock waits its turn.
  pops: () => {
    staticHud({ ...quietHud });
    beats({ type: 'missionPop', tick: 0, id: 'pass1', text: 'Pass a ghost', reward: 40 });
    window.setTimeout(() => beats({ type: 'finale', tick: 0, event: ChaosEvent.Avalanche, outcome: 'outran', text: 'Outran the avalanche', sub: '+2,000 style', gifts: 0, grade: 1, banner: true, stamp: false }), 1100);
    window.setTimeout(() => beats({ type: 'unlockPop', tick: 0, id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier' }), 1300);
  },
  'pop-mission': () => {
    staticHud({ ...quietHud });
    beats({ type: 'missionPop', tick: 0, id: 'pass1', text: 'Pass a ghost', reward: 40 });
  },
  'pop-unlock': () => {
    staticHud({ ...quietHud });
    beats({ type: 'unlockPop', tick: 0, id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier' });
  },
  'new-best': () => {
    staticHud({ ...quietHud, score: 5020 });
    beats({ type: 'newBest', tick: 0, score: 5020 });
  },
  'friend-beaten': () => {
    staticHud({ ...quietHud });
    beats({ type: 'friendBeaten', tick: 0, name: 'Mila', distance: 2340 });
  },
  // Say on any beat: a whisker, a max drift, In the flow, 1 km, New ground.
  says: () => {
    staticHud({ ...quietHud, combo: { active: true, pending: 980, mult: 3, chain: 9, timer: 0.9, stake: 2940 } });
    const list: Beat[] = [
      { type: 'nearMiss', tick: 0, grade: 'whisker', gap: 0.2, side: 1, x: 0, z: 0, obs: 'pine', speed: 24, say: { label: 'Whisker', points: 120, tone: 'big' } },
      { type: 'flow', tick: 0, phase: 'in', say: { label: 'In the flow', points: 0, tone: 'big' } },
      { type: 'km', tick: 0, km: 1, say: { label: '1 km', points: 0, tone: 'big' } },
      { type: 'newGround', tick: 0, z: 0, say: { label: 'New ground', points: 0, tone: 'best' } },
    ];
    list.forEach((b, i) => window.setTimeout(() => beats(b), 200 + i * 1400));
  },
  // The countdown chip beside the mood chip, "Best in 240 m" under the distance, both counting down.
  countdown: () => {
    const m = staticHud({ ...quietHud, mood: Mood.Haunted, distance: 1000, bestIn: 240, countdown: { event: ChaosEvent.Avalanche, metres: 380 } });
    let d = 380;
    let b = 240;
    const step = () => {
      if (screen !== 'run') return;
      d = Math.max(10, d - 10);
      b = Math.max(0, b - 10);
      m.countdown = { event: ChaosEvent.Avalanche, metres: d };
      m.bestIn = b > 0 ? b : null;
      window.setTimeout(step, 420);
    };
    window.setTimeout(step, 1200);
  },
  'countdown-storm': () => staticHud({ ...quietHud, mood: Mood.Powder, bestIn: 120, countdown: { event: ChaosEvent.GiftStorm, metres: 90 } }),
  'countdown-plain': () => staticHud({ ...quietHud, mood: Mood.None, countdown: { event: ChaosEvent.GhostTrain, metres: 260 } }),
  'countdown-yeti': () => staticHud({ ...quietHud, mood: Mood.Lantern, bestIn: 60, countdown: { event: ChaosEvent.Yeti, metres: 120 } }),
  // A portrait phone in a chase with the stake line and a big cash-in: the row stays clear of the unit.
  'chase-stake': () => {
    const m = staticHud({ ...quietHud, combo: { active: true, pending: 1240, mult: 4, chain: 12, timer: 0.55, stake: 4960 }, danger: { kind: 'avalanche', gap: 30 } });
    window.setTimeout(() => {
      m.combo = { ...quietCombo };
      beats(bankBeat(4960, 4));
    }, 1600);
  },
};

// ---------------------------------------------------------------- Control panel

const panel = document.getElementById('harness')!;
if (bare) panel.hidden = true;
const head = document.createElement('div');
head.className = 'row';
const toggle = document.createElement('button');
toggle.textContent = 'harness';
toggle.addEventListener('click', () => panel.classList.toggle('min'));
head.append(toggle, document.createTextNode(` mode=${mode}`));
panel.append(head);
const groups = document.createElement('div');
groups.className = 'groups';
const GROUPS: Record<string, string[]> = {
  title: ['title', 'title-first', 'title-zero', 'title-challenge', 'title-missions', 'title-touch', 'title-long', 'loading'],
  hud: ['hud', 'hud-live', 'hud-grudge', 'hud-you', 'hud-you-named', 'hud-even', 'hud-behind', 'hud-long', 'rank-gain', 'rank-swing', 'rank-first', 'rank-first-you', 'combo-single', 'draft-pill', 'night-pills', 'touch', 'danger-far', 'danger-mid', 'danger-near', 'danger-urgent', 'danger-chase'],
  fx: ['callouts', 'callouts-merge', 'callouts-landing', 'callouts-landing-big', 'callouts-late-stomp', 'callouts-perfect', 'callouts-chase', 'callouts-chase-band', 'callouts-band', 'callouts-pass', 'overtake-frame', 'lost', 'bank', 'toasts', 'toasts-2', 'pass', 'pass-you', 'pass-landing', 'landing-pass', 'pass-grudge', 'pass-grudge-settled', 'passed-by', 'passed-by-grudge', 'passed-by-you', 'queue'],
  chaos: ['reveal', 'reveal-lantern', 'reveal-comet', 'reveal-haunted', 'reveal-event', 'reveal-plain', 'warn-avalanche', 'warn-yeti', 'warn-gifts', 'warn-train'],
  hints: ['hint-steer', 'hint-crouch', 'hint-drift', 'hint-drift-done', 'hint-pop', 'hint-stomp', 'hint-draft', 'hint-learn'],
  menus: ['results', 'results-plain', 'results-unlock', 'results-record', 'results-mid', 'results-last', 'results-zero', 'results-doubled', 'pause', 'sleds', 'settings'],
  cash: ['bank-tiers', 'bank-t0', 'bank-t1', 'bank-t2', 'bank-t3', 'bank-best', 'bank-draft', 'bank-bump', 'stake', 'stake-fuse', 'stake-held', 'lost-crack', 'lost-best', 'lost-small', 'chase-stake'],
  beats: ['streak', 'streak-5', 'pass-words', 'pass-streak', 'race-news', 'race-queue', 'race-call', 'race-call-grudge', 'race-call-you', 'duel', 'duel-lost', 'lead', 'grudge-settled', 'nemesis-down', 'finale-avalanche', 'finale-storm', 'finale-train', 'finale-yeti', 'finale-dodged', 'pops', 'pop-mission', 'pop-unlock', 'new-best', 'friend-beaten', 'says', 'countdown', 'countdown-storm', 'countdown-plain', 'countdown-yeti'],
};
for (const [g, list] of Object.entries(GROUPS)) {
  const row = document.createElement('div');
  row.className = 'row';
  const b = document.createElement('b');
  b.textContent = g;
  row.append(b);
  for (const s of list) {
    const btn = document.createElement('button');
    btn.textContent = s.replace(/^(title|hud|hint|warn|reveal|results)-/, '');
    btn.title = s;
    btn.addEventListener('click', () => run(s));
    row.append(btn);
  }
  groups.append(row);
}
const modes = document.createElement('div');
modes.className = 'row';
const mb = document.createElement('b');
mb.textContent = 'mode';
modes.append(mb);
for (const m of ['keyboard', 'mouse', 'touch']) {
  const btn = document.createElement('button');
  btn.textContent = m;
  btn.addEventListener('click', () => {
    const q = new URLSearchParams(location.search);
    q.set('mode', m);
    location.search = q.toString();
  });
  modes.append(btn);
}
groups.append(modes);
panel.append(groups, logEl);

function run(s: string): void {
  const fn = SCENARIOS[s];
  if (!fn) return;
  ui.hint(null, mode);
  ui.touchVisual(touchV, false);
  ui.hidePause();
  ui.closeMenus();
  fn();
  log(`scenario ${s}`);
  const q = new URLSearchParams(location.search);
  q.set('s', s);
  history.replaceState(null, '', `?${q.toString()}`);
}

run(params.get('s') ?? 'title');
