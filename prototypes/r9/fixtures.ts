// Round 9, the screens lane: the title and the results as the game hands them to a screen (the contract's own
// TitleModel and ResultsModel), at runs 1, 5, 20 and 50 of the lab's mid pilot and for each kind of results. Today's
// screens (today.ts, the real UI) and the prototypes (title.ts, results.ts) read the same objects, so a pair differs
// only in the screen. The figures follow the mid pilot's career (scripts/playtest/r9-firsts.ts on round 9's base:
// pages 2, 6, 16 and 25; mountains open 1, 3, 4 and 5; The Twelve 0, 0, 5 and 10 beaten; the flame 1, 2, 5 and 13
// days), rounded where the harness's own numbers are not a player's (it buys every garage piece it can).
import type { ContractView, FlameView, MountainCard, PrimaryButtonView, ResultsGhost, ResultsModel, ResultsSpine, RewardCard, TitleModel, TitleSpine, TitleTwelve, TwelveRung, XpTickView } from '../../src/ui/contract';
import { rankBar } from '../../src/game/spineview';
import { CALENDAR_GIFTS, CALENDAR_XP } from '../../src/game/flame';

export type Stage = 'fresh' | 'run1' | 'run5' | 'run20' | 'run50';
export const STAGES: readonly Stage[] = ['fresh', 'run1', 'run5', 'run20', 'run50'];
export const STAGE_LABEL: Record<Stage, string> = { fresh: 'A first visit', run1: 'After run 1', run5: 'After run 5', run20: 'After run 20', run50: 'After run 50' };

export type Case = 'first' | 'podium' | 'wreck' | 'duel-won' | 'duel-lost' | 'cup' | 'trial' | 'daily';
export const CASES: readonly Case[] = ['first', 'podium', 'wreck', 'duel-won', 'duel-lost', 'cup', 'trial', 'daily'];
export const CASE_LABEL: Record<Case, string> = {
  first: 'A first finish (run 1)',
  podium: 'A podium that opened a mountain',
  wreck: 'A wreck',
  'duel-won': 'A duel won',
  'duel-lost': 'A duel lost',
  cup: 'The weekly Cup',
  trial: 'A Trial',
  daily: 'The Daily',
};

/** The backdrop each screen stands over: a captured frame of the game with its overlay hidden (r9-backdrops.js). */
export function backdrop(device: 'desk' | 'wide' | 'phone', what: string): string {
  const have: Record<string, string[]> = {
    desk: ['title-pinecrest', 'title-frostfang', 'title-ember', 'title-sakura', 'title-lanternfall', 'results-win', 'results-field', 'results-wreck'],
    wide: ['title-pinecrest', 'title-ember', 'results-win'],
    phone: ['title-pinecrest', 'title-frostfang', 'title-ember', 'title-sakura', 'title-lanternfall', 'results-win', 'results-field', 'results-wreck'],
  };
  // (A frame the wide screen has no capture of is the desk's, scaled: the same scene, a little softer.)
  const dev = have[device].includes(what) ? device : 'desk';
  return new URL(`./frames/${dev}-${what}.jpg`, import.meta.url).href;
}

export function titleBackdrop(stage: Stage): string {
  return stage === 'run20' ? 'title-frostfang' : stage === 'run50' ? 'title-ember' : 'title-pinecrest';
}

export function resultsBackdrop(c: Case): string {
  return c === 'wreck' ? 'results-wreck' : c === 'first' || c === 'cup' || c === 'daily' || c === 'duel-lost' ? 'results-field' : 'results-win';
}

// ---------------------------------------------------------------- the title

const flame = (streak: number, lit = true): FlameView => ({
  streak,
  litToday: lit,
  alive: streak > 0,
  atRisk: !lit && streak > 0,
  ember: streak >= 7,
  best: streak,
  calendar: CALENDAR_XP.map((xp, i) => ({ day: i + 1, xp, gifts: i === 6 ? CALENDAR_GIFTS : 0, ember: i === 6 })),
  nextDay: lit ? (streak % 7) + 1 : streak % 7,
});

const contracts = (done: number): ContractView[] => [
  { text: 'Pass 6 riders on Pinecrest', on: 'pinecrest', done: done > 0, xp: 50 },
  { text: 'Land 3 perfect landings on the Daily', on: 'daily', done: done > 1, xp: 50 },
  { text: 'Win a set piece on Frostfang Glacier', on: 'frostfang', done: done > 2, xp: 50 },
];

const mtn = (id: string, o: Partial<MountainCard>): MountainCard => {
  const base: Record<string, Pick<MountainCard, 'name' | 'tagline' | 'biome'>> = {
    pinecrest: { name: 'Pinecrest', tagline: 'Pine forest, soft powder, snowmen', biome: 'alpine' },
    frostfang: { name: 'Frostfang Glacier', tagline: 'Glass ice and big drops', biome: 'glacier' },
    ember: { name: 'Ember Peak', tagline: 'Basalt, ash snow, steam vents', biome: 'volcanic' },
    sakura: { name: 'Sakura Ridge', tagline: 'Blossom slopes and spirit gates', biome: 'blossom' },
    lanternfall: { name: 'Lanternfall', tagline: 'Where the spirit lights come from', biome: 'lantern' },
  };
  return { id, ...base[id], locked: false, unlockText: '', best: 0, bestTime: 0, oldBest: 0, rank: null, rankOf: 0, top: false, medals: { stages: [0, 0, 0], run: 0 }, ...o };
};

const RUNGS: Array<Omit<TwelveRung, 'state'>> = [
  { key: 'rosa', name: 'Rosa Quill', hat: 'foxears', emblem: '', accent: '#FFC4B3', bio: 'Learning everything at once, mostly upside down.', mountain: 'Sakura Ridge', time: '2:21.7' },
  { key: 'bram', name: 'Bram Oakhollow', hat: 'antlers', emblem: '', accent: '#CFE8B8', bio: 'Pinecrest born. Rides it slow, rides it all.', mountain: 'Pinecrest', time: '2:23.6' },
  { key: 'wren', name: 'Old Wren', hat: 'stovepipe', emblem: '', accent: '#E6E0C8', bio: 'Keeps every lantern lit. Hit a tree? Wren rides on.', mountain: 'Pinecrest', time: '2:09.6' },
  { key: 'juno', name: 'Juno Vale', hat: 'bobble', emblem: '', accent: '#FFD1F0', bio: 'Every light on the mountain is hers. She will go a long way for one.', mountain: 'Pinecrest', time: '2:05.1' },
  { key: 'mila', name: 'Mila Frost', hat: 'hood', emblem: '', accent: '#BFE6FF', bio: 'Rides Frostfang like she drew it. Never wastes a metre.', mountain: 'Frostfang Glacier', time: '2:12.4' },
  { key: 'pip', name: 'Pip Thistle', hat: 'aviator', emblem: '', accent: '#D9F2A6', bio: 'Fastest thing on two runners for thirty seconds at a time.', mountain: 'Frostfang Glacier', time: '2:08.9' },
  { key: 'tavi', name: 'Tavi Rook', hat: 'beak', emblem: '', accent: '#C7D0FF', bio: 'Pops every kicker for the lights up high. Knows every sky gate.', mountain: 'Frostfang Glacier', time: '2:06.2' },
  { key: 'kaito', name: 'Kaito Mori', hat: 'brim', emblem: '', accent: '#FFC9DA', bio: 'Spins everything with air under it, and lands most of it.', mountain: 'Sakura Ridge', time: '2:10.3' },
  { key: 'nessa', name: 'Nessa Lumen', hat: 'lantern', emblem: '', accent: '#FFE7A8', bio: 'Carries her own lantern, and takes the ice, the squeeze and the long way round.', mountain: 'Sakura Ridge', time: '2:07.5' },
  { key: 'ivo', name: 'Ivo Crag', hat: 'horns', emblem: '', accent: '#F2C18D', bio: 'Takes the fork’s ice and the narrowest squeeze. Every time.', mountain: 'Ember Peak', time: '2:11.8' },
  { key: 'suki', name: 'Suki Ember', hat: 'topknot', emblem: '', accent: '#FFB38A', bio: 'Lights a lantern, spends it. Lights another. Spends it.', mountain: 'Ember Peak', time: '2:07.0' },
  { key: 'crown', name: 'The Hollow King', hat: 'crown', emblem: '', accent: '#E8D9FF', bio: 'Holds the top of every ladder and has never been seen to fall.', mountain: 'Lanternfall', time: '2:19.4' },
];
const MOUNTAIN_ID: Record<string, string> = { Pinecrest: 'pinecrest', 'Frostfang Glacier': 'frostfang', 'Ember Peak': 'ember', 'Sakura Ridge': 'sakura', Lanternfall: 'lanternfall' };

function twelve(beaten: number, nextKey: string | null, open: string[], here: string): TitleTwelve {
  const keys = RUNGS.map((r) => r.key);
  const beatenKeys = new Set(beaten > 0 ? keys.filter((k) => k !== 'crown').slice(0, beaten) : []);
  const rungs: TwelveRung[] = RUNGS.map((r) => ({ ...r, state: beatenKeys.has(r.key) ? 'beaten' : r.key === nextKey ? 'next' : open.includes(MOUNTAIN_ID[r.mountain]) ? 'open' : 'locked' }));
  const n = rungs.find((r) => r.key === nextKey) ?? null;
  return {
    beaten,
    of: 12,
    tally: `${beaten} of 12 beaten`,
    next: n ? { ...n, mountainId: MOUNTAIN_ID[n.mountain], here: MOUNTAIN_ID[n.mountain] === here } : null,
    final: null,
    waiting: null,
    hook: beaten < 11 ? `${11 - beaten} more open Lanternfall` : null,
    crowned: false,
    rungs,
  };
}

const MISSIONS_EARLY = [
  { text: 'Pass 3 ghosts in one run', progress: 2, target: 3, reward: 40, done: false, justCompleted: false },
  { text: 'Land 2 perfect landings', progress: 1, target: 2, reward: 40, done: false, justCompleted: false },
  { text: 'Ride 2,000 m in one run', progress: 2000, target: 2000, reward: 30, done: true, justCompleted: false },
];
const MISSIONS_LATE = [
  { text: 'Bank a 10,000 point combo', progress: 8200, target: 10000, reward: 90, done: false, justCompleted: false },
  { text: 'Ride through 4 spirit gates', progress: 3, target: 4, reward: 60, done: false, justCompleted: false },
  { text: 'Land a 720 spin', progress: 0, target: 1, reward: 90, done: false, justCompleted: false },
];

function spine(o: { xp: number; streak: number; contractsDone: number; album: [number, number] | null; news: string | null; legs?: { legs: number; best: { legs: number; z: number } | null } | null; mirrors?: string[]; hours?: string[]; titles?: string[]; league?: TitleSpine['league'] }): TitleSpine {
  return {
    bar: rankBar(o.xp, o.titles?.[o.titles.length - 1] ?? null),
    flame: flame(o.streak),
    contracts: contracts(o.contractsDone),
    form: { text: 'Pass 5 riders in one run', on: 'any', done: false, xp: 40 },
    league: o.league ?? null,
    chapter: { key: '2026-12', name: 'Lantern Night', line: 'Every lantern lit for the year', page: 1, of: 10, into: 120, need: 280, set: [], older: [] },
    album: o.album ? { got: o.album[0], of: o.album[1], byMountain: {} } : null,
    whatsNew: o.news,
    longNight: o.legs ?? null,
    mirrors: o.mirrors ?? [],
    hours: o.hours ?? [],
    titles: o.titles ?? [],
    lanterns: [],
  };
}

const CUP = (ready = true, medal = 0, best = 0): TitleModel['cup'] => ({ key: '2026-W49', week: 49, ready, mood: 'Powder Day', event: 'Light Storm', best, medal });

export function titleModel(stage: Stage): TitleModel {
  const common = { inputMode: 'keyboard' as const, master: 0.9, challenge: null, firstVisit: false, sledName: 'Pine Flyer' };
  if (stage === 'fresh') {
    return {
      ...common,
      mountains: [mtn('pinecrest', {}), mtn('frostfang', { locked: true, unlockText: 'Pass 4 ghosts to unlock' }), mtn('ember', { locked: true, unlockText: 'Pass 12 ghosts to unlock' }), mtn('sakura', { locked: true, unlockText: 'Pass 24 ghosts to unlock' }), mtn('lanternfall', { locked: true, unlockText: 'Beat 11 more of The Twelve to unlock' })],
      selected: 'pinecrest',
      daily: { key: '2026-12-01', best: 0, ready: false, flame: true },
      best: 0,
      wallet: 0,
      missions: MISSIONS_EARLY.map((m) => ({ ...m, done: false, progress: 0 })),
      firstVisit: true,
      ghostsPassed: 0,
      greet: null,
      nextRung: null,
      cup: CUP(false),
      twelve: null,
      spine: null,
    };
  }
  if (stage === 'run1') {
    return {
      ...common,
      mountains: [
        mtn('pinecrest', { best: 31240, bestTime: 126.4, rank: 24, rankOf: 87, medals: { stages: [1, 0, 0], run: 0 } }),
        mtn('frostfang', { locked: true, unlockText: 'Pass 1 more ghost to unlock' }),
        mtn('ember', { locked: true, unlockText: 'Pass 9 more ghosts to unlock' }),
        mtn('sakura', { locked: true, unlockText: 'Pass 21 more ghosts to unlock' }),
        mtn('lanternfall', { locked: true, unlockText: 'Beat 11 more of The Twelve to unlock' }),
      ],
      selected: 'pinecrest',
      daily: { key: '2026-12-01', best: 0, ready: true, flame: true, streak: 1 },
      best: 31240,
      bestTime: 126.4,
      wallet: 140,
      missions: MISSIONS_EARLY,
      ghostsPassed: 3,
      greet: '1 more ghost opens Frostfang Glacier',
      nextRung: 'Next: valo_rides, 2:06.3, 0.1 s up',
      cup: CUP(),
      // (As app.ts builds it after one run: twelveModel() names Bram as next, here, while duelHere() holds the first
      // duel back until the third run (FIRST_DUEL_RUN). Today's Ride therefore says DUEL Bram Oakhollow on a run that
      // is not a duel; `rides: false` is the one fact the prototype needs to say Ride instead.)
      twelve: { ...twelve(0, 'bram', ['pinecrest'], 'pinecrest'), rides: false } as TitleTwelve,
      spine: spine({ xp: 820, streak: 1, contractsDone: 0, album: null, news: 'New this month: Lantern Night. Every lantern lit for the year.' }),
    };
  }
  if (stage === 'run5') {
    return {
      ...common,
      mountains: [
        mtn('pinecrest', { best: 38410, bestTime: 124.8, rank: 19, rankOf: 87, medals: { stages: [2, 1, 1], run: 1 } }),
        mtn('frostfang', { best: 29900, bestTime: 131.0, rank: 31, rankOf: 64, medals: { stages: [1, 0, 0], run: 0 } }),
        mtn('ember', {}),
        mtn('sakura', { locked: true, unlockText: 'Pass 3 more ghosts to unlock' }),
        mtn('lanternfall', { locked: true, unlockText: 'Beat 11 more of The Twelve to unlock' }),
      ],
      selected: 'pinecrest',
      daily: { key: '2026-12-02', best: 27310, time: 119.6, ready: true, medal: 2, flame: true, streak: 2 },
      best: 38410,
      bestTime: 124.8,
      wallet: 245,
      missions: MISSIONS_EARLY,
      ghostsPassed: 21,
      greet: 'tove_runs is waiting on Pinecrest',
      nextRung: 'Next: Brindle, 2:04.5, 0.3 s up',
      cup: CUP(),
      twelve: twelve(0, 'bram', ['pinecrest', 'frostfang', 'ember'], 'pinecrest'),
      spine: spine({ xp: 2900, streak: 2, contractsDone: 1, album: [30, 212], news: 'Three new contracts today.' }),
    };
  }
  if (stage === 'run20') {
    return {
      ...common,
      mountains: [
        mtn('pinecrest', { best: 44120, bestTime: 121.9, rank: 9, rankOf: 87, medals: { stages: [3, 2, 2], run: 2 } }),
        mtn('frostfang', { best: 41800, bestTime: 126.3, rank: 14, rankOf: 64, medals: { stages: [2, 2, 1], run: 1 } }),
        mtn('ember', { best: 36020, bestTime: 128.7, rank: 22, rankOf: 58, medals: { stages: [1, 1, 0], run: 1 } }),
        mtn('sakura', { best: 30550, bestTime: 129.4, rank: 27, rankOf: 61, medals: { stages: [1, 0, 0], run: 0 } }),
        mtn('lanternfall', { locked: true, unlockText: 'Beat 6 more of The Twelve to unlock' }),
      ],
      selected: 'frostfang',
      daily: { key: '2026-12-05', best: 0, ready: true, flame: true, streak: 5 },
      best: 41800,
      bestTime: 126.3,
      wallet: 420,
      missions: MISSIONS_LATE,
      ghostsPassed: 96,
      greet: 'Bank a 10,000 point combo: 8,200/10,000',
      nextRung: 'Next: SparkleCedar, 2:06.1, 0.2 s up',
      mirror: { on: false },
      hour: { name: 'Noon', phrase: 'at Noon', on: false, day: ['#0A2470', '#A6C6EE'], alt: ['#163E8C', '#F4F1E8'] },
      cup: CUP(),
      twelve: twelve(5, 'pip', ['pinecrest', 'frostfang', 'ember', 'sakura'], 'frostfang'),
      spine: spine({ xp: 13600, streak: 5, contractsDone: 2, album: [84, 212], news: null, legs: { legs: 3, best: { legs: 1, z: 2100 } }, mirrors: ['pinecrest', 'frostfang'], hours: ['pinecrest', 'frostfang'], titles: ['Rider', 'Night Rider', 'Glass Walker'] }),
    };
  }
  return {
    ...common,
    mountains: [
      mtn('pinecrest', { best: 51200, bestTime: 119.8, rank: 1, rankOf: 87, top: true, medals: { stages: [3, 3, 3], run: 3 } }),
      mtn('frostfang', { best: 47930, bestTime: 122.6, rank: 4, rankOf: 64, medals: { stages: [3, 3, 2], run: 2 } }),
      mtn('ember', { best: 44100, bestTime: 124.1, rank: 10, rankOf: 58, medals: { stages: [3, 2, 2], run: 2 } }),
      mtn('sakura', { best: 40700, bestTime: 125.0, rank: 12, rankOf: 61, medals: { stages: [2, 2, 1], run: 1 } }),
      mtn('lanternfall', { best: 22400, bestTime: 139.2, rank: 30, rankOf: 49, medals: { stages: [1, 0, 0], run: 0 } }),
    ],
    selected: 'ember',
    daily: { key: '2026-12-13', best: 0, ready: true, flame: true, streak: 13 },
    best: 44100,
    bestTime: 124.1,
    wallet: 610,
    missions: MISSIONS_LATE,
    ghostsPassed: 270,
    greet: 'Ride through 4 spirit gates: 3/4',
    nextRung: 'Next: elif.twirl, 2:03.2, 0.9 s up',
    mirror: { on: false },
    hour: { name: 'Night', phrase: 'at Night', on: false, day: ['#1C1316', '#D8602C'], alt: ['#0E0A14', '#7A2A1C'] },
    cup: CUP(true, 1, 151.0),
    twelve: twelve(10, 'suki', ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'], 'ember'),
    spine: spine({
      xp: 30400,
      streak: 13,
      contractsDone: 0,
      album: [115, 212],
      news: 'Up to division 4 of the Cup.',
      legs: { legs: 6, best: { legs: 3, z: 1450 } },
      mirrors: ['pinecrest', 'frostfang', 'ember'],
      hours: ['pinecrest', 'frostfang', 'ember', 'sakura'],
      titles: ['Rider', 'Night Rider', 'Glass Walker', 'Ash Runner', 'Petal Chaser'],
      league: { week: '2026-W49', division: 4, place: 6, rows: [], last: { division: 5, place: 3, moved: -1 } },
    }),
  };
}

// ---------------------------------------------------------------- the results

const NAMES = ['Juno Vale', 'valo_rides', 'tove_runs', 'Brindle', 'SparkleCedar', 'elif.twirl', 'HailstoneSpin', 'CocoaAvalanche', 'FoxCrest', 'TobogganPine', 'BorealLantern', 'mika.k', 'Pebblefrost', 'Snowmoth', 'rua_downhill', 'Larkspur', 'Quillfeather', 'ottersled', 'dune.rider'];

/** A field of `n` other riders with you `place`-th; `gap` the seconds to the rider just ahead (or behind for a win). */
function field(n: number, you: number, place: number, gap: number, named: Record<number, { name: string; kind?: ResultsGhost['kind'] }> = {}, dnf = 0): ResultsGhost[] {
  const out: ResultsGhost[] = [];
  for (let i = 0; i < n; i++) {
    const pos = i + 1 < place ? i + 1 : i + 2; // their place in the race
    const ahead = pos < place;
    const t = ahead ? you - gap - (place - 1 - pos) * 1.7 : you + gap + (pos - place - 1) * 2.1;
    const nm = named[pos] ?? { name: NAMES[i % NAMES.length] };
    const finished = !(pos > n + 1 - dnf);
    out.push({ name: nm.name, kind: nm.kind ?? 'pool', score: 20000 + i * 900, time: finished ? Math.round(t * 10) / 10 : null, distance: finished ? 4520 : 2600 + i * 80, passed: !ahead });
  }
  return out;
}

const tick = (source: string, label: string, xp: number): XpTickView => ({ source, label, xp });
const card = (kind: RewardCard['kind'], name: string, page: number): RewardCard => ({ kind, name, page, chapter: null });

function spineR(o: { xpBefore: number; ticks: XpTickView[]; opened?: RewardCard[]; stickers?: number; streak?: number; lit?: boolean; met?: string[]; league?: ResultsSpine['league']; primary: PrimaryButtonView }): ResultsSpine {
  const xp = o.ticks.reduce((s, t) => s + t.xp, 0);
  const st = Array.from({ length: o.stickers ?? 0 }, (_, i) => ({ id: `s${i}`, name: ['The First Drop', 'Haunted Hollow on Pinecrest', 'Spin 540', 'The Pine Chute swept', 'A ghost passed at the line'][i % 5], mountain: 'pinecrest', group: 'variant', hint: '', frame: false }));
  return {
    ticks: o.ticks,
    before: rankBar(o.xpBefore),
    after: rankBar(o.xpBefore + xp),
    opened: o.opened ?? [],
    stickers: st,
    flame: { lit: o.lit ?? false, streak: o.streak ?? 1, calendarDay: o.streak ?? 1, embered: false, emberEarned: false },
    contracts: { met: o.met ?? [], bonus: false, form: null, today: contracts((o.met ?? []).length), formNext: null },
    league: o.league ?? null,
    primary: o.primary,
    swap: null,
  };
}

const base = (o: Partial<ResultsModel>): ResultsModel => ({
  score: 31240,
  distance: 4520,
  finishZ: 4520,
  best: 0,
  newBest: false,
  giftsEarned: 52,
  wallet: 192,
  ghosts: [],
  ghostsPassed: 3,
  missions: MISSIONS_EARLY,
  crashCause: '',
  bestCombo: 4210,
  perfects: 3,
  maxAir: 1.6,
  mountain: 'Pinecrest',
  mood: '',
  canRevive: false,
  canDouble: false,
  doubled: false,
  canChallenge: true,
  unlocked: [],
  ...o,
});

const splits = (a: number, b: number, c: number, vs: [number | null, number | null, number | null]) => [
  { name: 'Stage 1', seconds: a, vsBest: vs[0] },
  { name: 'Stage 2', seconds: b, vsBest: vs[1] },
  { name: 'Stage 3', seconds: c, vsBest: vs[2] },
];

export function resultsModel(c: Case): ResultsModel {
  switch (c) {
    case 'first': {
      const t = 126.4;
      return base({
        finish: { seconds: t, medal: 0, splits: splits(40.6, 82.9, t, [null, null, null]), bestTime: null, newBest: true },
        ghosts: field(5, t, 4, 0.3, { 3: { name: 'Juno Vale' } }),
        newBest: true,
        missions: MISSIONS_EARLY.map((m, i) => (i === 2 ? { ...m, justCompleted: true } : m)),
        runAgainLabel: { text: 'Rematch Juno Vale', aria: 'Rematch Juno Vale, run again' },
        raceLine: { text: 'Juno Vale beat you by 0.3 s. Juno Vale will be waiting.', tone: 'grudge' },
        nextUnlock: { kind: 'mountain', name: 'Frostfang Glacier', biome: 'glacier', have: 3, need: 4 },
        spine: spineR({
          xpBefore: 0,
          ticks: [tick('finish', 'Finished', 110), tick('place', '2 behind you', 16), tick('pass', '3 passed', 18), tick('mission', 'Mission', 40), tick('first', "The day's first run", 200), tick('ride', 'Riding', 50), tick('medal', 'A stage medal', 15), tick('star', 'A mastery star', 30), tick('stars', '2 stars', 60), tick('best', 'A best', 20), tick('trick', 'Tricks', 21)],
          opened: [card('gate', 'A second charm gate', 1), card('charm', 'Charm: Slipstream Lantern', 1), card('feature', 'Daily contracts', 2), card('charm', 'Charm: Ember Step', 2)],
          stickers: 10,
          streak: 1,
          lit: true,
          primary: { kind: 'rematch', text: 'Rematch Juno Vale', sub: '0.3 s behind', aria: 'Rematch Juno Vale, 0.3 s behind, run again' },
        }),
      });
    }
    case 'podium': {
      const t = 124.8;
      return base({
        finish: { seconds: t, medal: 1, splits: splits(39.9, 81.2, t, [-0.4, -0.9, -1.6]), bestTime: 126.4, newBest: true },
        ghosts: field(8, t, 2, 0.4, { 1: { name: 'tove_runs', kind: 'grudge' } }),
        newBest: true,
        score: 38410,
        giftsEarned: 68,
        wallet: 260,
        unlocked: ['Frostfang Glacier'],
        unlockedMountains: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', tagline: 'Glass ice and big drops' }],
        runAgainLabel: { text: 'Rematch tove_runs', aria: 'Rematch tove_runs, run again' },
        raceLine: { text: 'tove_runs held you off by 0.4 s.', tone: 'grudge' },
        ladder: { rank: 19, of: 87, top: false, next: 'Next: Brindle, 2:04.5, 0.3 s up', up: 5, medals: { stages: [2, 1, 1], run: 1 }, fresh: [3], moment: 'Beat Larkspur and 4 more.', topNow: false, gifts: 20 },
        spine: spineR({
          xpBefore: 820,
          ticks: [tick('finish', 'Finished', 110), tick('place', '7 behind you', 56), tick('medal', 'Medals', 120), tick('pass', '6 passed', 36), tick('ride', 'Riding', 50), tick('best', 'A best', 20), tick('trick', 'Tricks', 18)],
          opened: [card('feature', 'The Spirit Album', 3), card('title', 'Title: Rider', 3)],
          stickers: 4,
          primary: { kind: 'rematch', text: 'Rematch tove_runs', sub: '0.4 s behind', aria: 'Rematch tove_runs, 0.4 s behind, run again' },
        }),
      });
    }
    case 'wreck':
      return base({
        finish: null,
        distance: 3340,
        finishZ: 4520,
        score: 18820,
        mountain: 'Pinecrest',
        crashCause: 'Hit a tree',
        crashKind: 'tree',
        lostCombo: 2085,
        giftsEarned: 24,
        wallet: 444,
        ghosts: field(9, 999, 7, 1, {}, 2).map((g, i) => ({ ...g, time: i < 6 ? 123 + i * 1.4 : null, distance: i < 6 ? 4520 : 2400 + i * 60 })),
        missions: MISSIONS_LATE,
        crashNote: 'You were 4th at the crash. Brindle rode on past.',
        rankAtCrash: 4,
        runAgainLabel: { text: 'Finish the mission', aria: 'Finish the mission, Bank a 10,000 point combo, run again' },
        raceLine: { text: 'Brindle rode past your wreck.', tone: 'crash' },
        spine: spineR({
          xpBefore: 13400,
          ticks: [tick('ride', 'Riding', 40), tick('stage', '2 stage lines', 20), tick('pass', '4 passed', 24), tick('trick', 'Tricks', 30)],
          primary: { kind: 'mission', text: 'Finish the mission', sub: 'Bank a 10,000 point combo: done before, so again', aria: 'Finish the mission, Bank a 10,000 point combo, run again' },
        }),
      });
    case 'duel-won': {
      const t = 122.9;
      return base({
        finish: { seconds: t, medal: 2, splits: splits(39.1, 80.0, t, [-0.2, -0.6, -1.9]), bestTime: 124.8, newBest: true },
        ghosts: field(10, t, 1, 0.7, { 2: { name: 'Bram Oakhollow' } }),
        newBest: true,
        score: 40210,
        giftsEarned: 100,
        wallet: 345,
        twelve: { tone: 'fell', line: 'Bram Oakhollow falls. 1 of 12 beaten.', rider: { key: 'bram', name: 'Bram Oakhollow', hat: 'antlers', emblem: '', accent: '#CFE8B8' }, says: 'Slow and all of it. You took the fast half.', beaten: 1, of: 12, gifts: 120 },
        runAgainLabel: { text: 'Next Duel: Old Wren', aria: 'Duel Old Wren' },
        spine: spineR({
          xpBefore: 2400,
          ticks: [tick('duel', 'A duel won', 300), tick('finish', 'Finished', 110), tick('contract', 'Contracts', 90), tick('place', '10 behind you', 80), tick('ride', 'Riding', 50)],
          opened: [card('sled', 'A new sled', 5), card('flourish', 'A flourish for Spinning Top', 5)],
          stickers: 2,
          met: ['Pass 6 riders on Pinecrest'],
          primary: { kind: 'duel', text: 'Next Duel: Old Wren', sub: 'Time to beat 2:09.6', aria: 'Duel Old Wren' },
        }),
      });
    }
    case 'duel-lost': {
      const t = 127.5;
      return base({
        finish: { seconds: t, medal: 1, splits: splits(41.0, 83.3, t, [0.3, 0.2, 1.2]), bestTime: 126.3, newBest: false },
        ghosts: field(10, t, 2, 1.2, { 1: { name: 'Pip Thistle' } }),
        mountain: 'Frostfang Glacier',
        score: 39050,
        giftsEarned: 46,
        wallet: 466,
        missions: MISSIONS_LATE,
        twelve: { tone: 'held', line: 'Pip Thistle held you off by 1.2 s.', rider: { key: 'pip', name: 'Pip Thistle', hat: 'aviator', emblem: '', accent: '#D9F2A6' }, says: 'Thirty seconds at a time. You nearly had the last thirty.', beaten: 5, of: 12, gifts: 0 },
        runAgainLabel: { text: 'Rematch Pip Thistle', aria: 'Rematch Pip Thistle, run again' },
        spine: spineR({
          xpBefore: 13600,
          ticks: [tick('finish', 'Finished', 110), tick('place', '9 behind you', 72), tick('duel', 'A duel ridden', 40), tick('ride', 'Riding', 50), tick('trick', 'Tricks', 26)],
          primary: { kind: 'rematch', text: 'Rematch Pip Thistle', sub: '1.2 s behind', aria: 'Rematch Pip Thistle, 1.2 s behind, run again' },
        }),
      });
    }
    case 'cup': {
      const t = 151.0;
      return base({
        finish: { seconds: t, medal: 1, splits: splits(48.2, 99.0, t, [null, null, null]), bestTime: null, newBest: true },
        ghosts: field(11, t, 5, 0.8),
        mountain: 'Weekly Cup',
        mood: 'Powder Day',
        score: 36120,
        giftsEarned: 74,
        wallet: 684,
        missions: MISSIONS_LATE,
        runAgainLabel: { text: 'Run Again', aria: 'Run Again' },
        raceLine: { text: 'Cup: Bronze. Silver at 2:28.4.', tone: 'event' },
        spine: spineR({
          xpBefore: 30200,
          ticks: [tick('cup', 'A Cup medal', 20), tick('finish', 'Finished', 110), tick('place', '7 behind you', 56), tick('first', "The day's first run", 200), tick('ride', 'Riding', 50)],
          league: { place: 6, was: 9, division: 4 },
          streak: 13,
          lit: true,
          primary: { kind: 'again', text: 'Run Again', sub: 'Silver at 2:28.4', aria: 'Run Again, Silver at 2:28.4' },
        }),
      });
    }
    case 'trial': {
      const t = 133.2;
      return base({
        finish: { seconds: t, medal: 0, splits: splits(43.0, 88.1, t, [null, null, null]), bestTime: null, newBest: true },
        ghosts: field(9, t, 3, 1.1),
        mountain: 'Ember Peak',
        mood: 'Blizzard',
        score: 52300,
        perfects: 17,
        giftsEarned: 60,
        wallet: 744,
        missions: MISSIONS_LATE,
        trial: { medal: 2, line: 'Trial: Silver. Gold at 19 perfects.', figure: '17', unit: 'perfects', word: 'Silver in the Trial', fact: '17 perfects, 2 short of gold' },
        runAgainLabel: { text: 'Run Again', aria: 'Run Again' },
        raceLine: { text: 'Trial: Silver. Gold at 19 perfects.', tone: 'event' },
        spine: spineR({
          xpBefore: 52000,
          ticks: [tick('trial', 'A Trial medal', 35), tick('finish', 'Finished', 110), tick('place', '6 behind you', 48), tick('ride', 'Riding', 50)],
          primary: { kind: 'again', text: 'Run Again', sub: 'Gold at 19 perfects', aria: 'Run Again, Gold at 19 perfects' },
        }),
      });
    }
    case 'daily': {
      const t = 119.2;
      return base({
        finish: { seconds: t, medal: 2, splits: splits(38.3, 78.1, t, [null, null, null]), bestTime: null, newBest: true },
        ghosts: field(9, t, 3, 0.6),
        mountain: 'Daily Mountain',
        mood: 'Glass Ice',
        score: 30110,
        giftsEarned: 58,
        wallet: 302,
        runAgainLabel: { text: 'Run Again', aria: 'Run Again' },
        raceLine: { text: 'Daily: Silver. Gold at 1:57.8.', tone: 'event' },
        spine: spineR({
          xpBefore: 2600,
          ticks: [tick('first', "The day's first run", 200), tick('finish', 'Finished', 110), tick('contract', 'A contract', 50), tick('daily', 'A Daily medal', 35), tick('place', '6 behind you', 48)],
          streak: 6,
          lit: true,
          met: ['Land 3 perfect landings on the Daily'],
          primary: { kind: 'again', text: 'Run Again', sub: 'Gold at 1:57.8', aria: 'Run Again, Gold at 1:57.8' },
        }),
      });
    }
  }
}
