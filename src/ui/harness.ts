// Dev harness for the overlay UI (ui-harness.html). Not part of the game build.
// Mounts the real UI over a painted stand-in scene and drives every screen with fake data.
// URL params: s=<scenario> (see SCENARIOS), mode=keyboard|mouse|touch,
// bg=alpine|blizzard|night|ember|powder|glass, bare=1 hides the control panel (for screenshots).

import type { HudModel, MissionView, ResultsModel, SettingsModel, SledCard, TitleModel, UIHandlers } from './contract';
import type { InputMode, TouchVisual } from '../game/input';
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
