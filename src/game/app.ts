import { resultsCues } from '../audio/cues';
import { AudioEngine, AudioFrame, type UiSound } from '../audio/engine';
import { ghostName } from '../bot/names';
import { getPlatform, Platform } from '../platform/platform';
import { AdPacing } from '../platform/pacing';
import { World, qualityFor, Tier } from '../render/world';
import { ChaosEvent, ChaosRoll, EVENTS, MOODS, Mood, eventInfo, moodInfo, rollChaos } from '../sim/chaos';
import { MOUNTAINS, MountainDef, biomeForSeed, dailyKey, dailyMountain } from '../sim/mountains';
import { Rng, hashString } from '../sim/prng';
import { RunRecord, fromBase64Url, recordFromString, recordToString } from '../sim/replay';
import { decodeLog } from '../sim/input';
import { Sim, SimEvent } from '../sim/sim';
import { SLEDS, sledById } from '../sim/sleds';
import { UI } from '../ui/ui';
import { reduced } from '../ui/motion';
import { REVEAL_TIMING } from '../ui/reveal';
import { RESULTS_TIMING } from '../ui/results';
import { prewarmSledPortraits, setSledPortraits } from '../ui/menus';
import type { GhostKind, HintKind, HudModel, ResultsModel, SettingsModel, TitleModel } from '../ui/contract';
import { CRASH_RESULTS_MS, CRASH_RESULTS_REDUCED_MS } from './beats';
import { Director } from './director';
import { anchorFor, pickField } from './field';
import { PoolGhostData } from './ghostdata';
import { GhostEntry, GhostManager, GhostPose, RaceEvent, emptyPose } from './ghosts';
import { type Graveyard, bundledGraveyards, graveyards } from './graveyards';
import { HintCoach } from './hints';
import { intensity } from './intensity';
import { InputController, startsFromMenu } from './input';
import { FixedLoop } from './loop';
import { RunSummary, missionViews, unlockedBiomes } from './missions';
import { challengeShareTitle, friendLine, missionsCrossed, nextUnlock, resultsRaceLine, revealGoal, runAgainLabel, titleGreeting } from './progress';
import { TierController, guessTier } from './quality';
import { type InputSource, Run, emptySnap, lerpSnap } from './run';
import { Grudge, SaveStore } from './save';
import { Settlement, dailyMedalNow, dailyStreakNow, isNemesis, medalThresholds, settleGrudge, settleRun } from './settle';

// The app: boot, title attract mode, run lifecycle, results, menus, ads and saves. Owns every
// subsystem and is the only place where they meet.

type Phase = 'boot' | 'title' | 'run' | 'crashed' | 'results';

/** Dev-only overrides for play-tests and screenshots: ?mood=3&event=1&m=2&autoride=1. */
const DEV = new URLSearchParams(location.search);
const DEV_ON = import.meta.env.DEV || DEV.has('debug');
/** The attract reel starts at least 6 s into the replays: before that its riders sit on top of each
 *  other at the start line, where the ghost layer fades them, so the title showed no race at all.
 *  Within the first 30 s it starts where two riders duel side by side (pickAttractHero). */
const REEL_START = 360;
const REEL_SCAN_END = 1800;
/** The title reel's duel partner: this ghost is replayed off its own clock, `lead` metres ahead of
 *  the hero and `lat` metres off its line (sim x), so it races at the hero's shoulder
 *  (App.pickReelMate; id -1 for none). A phone's narrow frame has the partner closer in and a little
 *  further ahead, where the frame is wider: 2.3 m abreast it sat cut in half by the screen's edge. */
const reelMate = { id: -1, tick: 0, side: 1, off: 0, lead: 0.5, lat: 2.3 };
function reelSpacing(): void {
  const tall = innerWidth < innerHeight;
  reelMate.lead = tall ? 1.1 : 0.5;
  reelMate.lat = tall ? 1.6 : 2.3;
}

const pools = import.meta.glob('../data/ghosts/*.json', { eager: true, import: 'default' }) as Record<string, { mountain: string; ghosts: PoolGhostData[] }>;

function poolFor(id: string): PoolGhostData[] {
  for (const [path, data] of Object.entries(pools)) if (path.endsWith(`/${id}.json`)) return data.ghosts ?? [];
  return [];
}


/** No race events outside the run phase. */
const NO_RACE: readonly RaceEvent[] = [];

/** A challenge link from an older build. Short enough for the toast pill at 390 px; the sub gives
 *  way first when space runs out. */
const STALE_LINK = { text: 'Challenge from an older Ghost Sled', sub: 'Ride it fresh' } as const;

/** A saved or shared record that still replays on this build (a stale one degrades to no ghost). */
function validRecord(r: string | undefined | null): boolean {
  if (!r) return false;
  try {
    recordFromString(r);
    return true;
  } catch {
    return false;
  }
}

/** The mountain seed of a record that no longer decodes (an older build's link), when it reads. */
function rawSeed(raw: string): number | null {
  try {
    const b = fromBase64Url(raw);
    if (b.length < 8 || b[0] !== 0x47 || b[1] !== 0x53) return null;
    return (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
  } catch {
    return null;
  }
}

/** A results sound asked for while the audio context wakes after a rewarded ad waits at most this
 *  long (ms) for it to run (it resumes within a few frames of the unmute). */
const WAKE_WAIT_MS = 700;

/** How many Beat stamps the results card shows at first (results.ts standings): your row, the two
 *  places above it and the one below in a field over 5 rows (first place shows the three it beat);
 *  a smaller field shows whole. One soft mallet sounds per stamp in view. */
function beatStampsShown(ghosts: number, ahead: number): number {
  const n = ghosts + 1;
  const beaten = ghosts - ahead;
  if (n <= 5) return beaten;
  const lo = Math.max(0, Math.min(ahead - 2, n - 4));
  return Math.max(0, Math.min(beaten, lo + 4 - 1 - ahead));
}

interface Challenge {
  record: RunRecord;
  attempts: number;
}

export class App {
  private platform: Platform;
  private save: SaveStore;
  private world: World;
  private ui: UI;
  private audio = new AudioEngine();
  private input: InputController;
  private ghosts = new GhostManager();
  /** Turns each frame's sim and race events into beats and feel (window.__gs.director for probes). */
  readonly director = new Director(reduced);
  private pacing = new AdPacing();
  private tiers: TierController;
  private phase: Phase = 'boot';
  private run: Run | null = null;
  private loop: FixedLoop | null = null;
  private view = emptySnap();
  private mountain: MountainDef;
  private daily: MountainDef;
  private dailyPool: PoolGhostData[] = [];
  private dailyReady = false;
  private challenge: Challenge | null = null;
  private sessionRuns = 0;
  private lastMood: Mood = Mood.None;
  private chaos: ChaosRoll = { mood: Mood.None, event: ChaosEvent.None, seed: 0 };
  private crashTime = 0;
  /** Counts crashes, so a stale auto-results timer never opens the next crash's results early. */
  private crashSeq = 0;
  private reviveUsed = false;
  private doubled = false;
  private giftsPersisted = 0;
  private bestPersisted = false;
  private results: ResultsModel | null = null;
  /** Counts results cards shown and hidden: a card's first-frame sounds skip a card already gone. */
  private resultsSeq = 0;
  /** Rewards landed on this card (each coin's index). */
  private coinsLanded = 0;
  /** Mission Done stamps drawn on this card (each chime's index), and which rows already chimed. */
  private chimesLanded = 0;
  private readonly chimedRows = new Set<number>();
  /** Results sounds asked for while the audio context is still waking after a rewarded ad (the ad
   *  muted it and the engine suspended it): played together once it runs, or dropped after
   *  WAKE_WAIT_MS. Same moment, same sound: the doubled coin and the landings it sets off play once. */
  private uiWaiting: Array<{ name: UiSound; detail?: number }> = [];
  private uiWaitSince = 0;
  /** Ride with a reveal card: 'go' follows the reveal's timeline from its first frame. */
  private goAfterReveal = false;
  /** What this run has already credited to the save (a revive settles it again, by difference). */
  private settlement: Settlement | null = null;
  private passedThisRun = new Set<number>();
  /** Gifts earned for passing ghosts (kept out of the sim so live state matches replays). */
  private passBonus = 0;
  private grudgeBeaten = false;
  private paused = false;
  private adPlaying = false;
  private last = performance.now();
  private time = 0;
  private attract = { tick: 0, focus: -1 };
  private ghostPoses = new Map<number, GhostPose | null>();
  /** This frame's standings, computed once (the world's rival, the HUD pill and the hints read them). */
  private frameStandings: ReturnType<GhostManager['standings']> | null = null;
  private airTicks = 0;
  private hintTimer = 0;
  private hintShown: HintKind | null = null;
  /** Which teach-move hint shows, for how long, and the per-run caps (hints.ts). */
  private hints = new HintCoach();
  private hintLearned = false;
  private newBestThisRun = false;
  /** The grudge on this mountain as the run started: settleGrudge reads it again after a revive. */
  private grudgeAtStart: Grudge | null = null;
  /** The results' one rose line from the grudge settlement (null for none), and whether it settled
   *  the grudge or names a nemesis (it then outranks the event note). */
  private grudgeLine: string | null = null;
  private grudgeStrong = false;
  /** Missions already popped this run (kept across a revive; the results still credit them). */
  private missionsPopped = new Set<string>();
  /** Missions a results card of this run already showed Done (seeded into missionsPopped on a revive). */
  private missionsSettled = new Set<string>();
  /** The stake the crash took (results: "with 4,960 on the line"). */
  private lostCombo = 0;
  /** This mountain's graveyards (graveyards.ts): the cairns the world places and the director's beat. */
  private graves: Graveyard[] = [];
  /** Lifetime ghosts passed as the run started (the results' unlocks are this run's, revive or not). */
  private passedAtStart = 0;
  /** Held the button through a kicker's lip: the boosted-pop hint shows on the next approach. */
  private heldLip = false;
  /** Presentation time for shader bobs and wisps: scaled by the director's render scale in a run. */
  private renderTime = 0;
  /** The crash-phase ghost clock, in sim ticks past the crash, integrated from scaled render time. */
  private crashTicks = 0;
  /** This run's stats that beat the lifetime record, noted before persistRun raises it. */
  private recordsThisRun = new Set<'bestCombo' | 'maxAir'>();
  private adblock = false;
  /** Recent frame times in ms, for play-test scripts and the ?fps overlay. */
  readonly frameTimes: number[] = [];
  private fpsEl: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.platform = getPlatform();
    const nameSeed = hashString(String(Date.now()) + Math.random());
    this.save = new SaveStore(this.platform.storage, ghostName(new Rng(nameSeed)));
    const guess = guessTier();
    const pref = this.save.data.settings.quality;
    const forced = DEV_ON && DEV.has('tier') ? (DEV.get('tier') as Tier) : null;
    this.tiers = new TierController(forced ?? (pref === 'auto' ? guess : pref));
    this.tiers.locked = forced !== null || pref !== 'auto';
    this.mountain = MOUNTAINS.find((m) => m.id === this.save.data.mountain) ?? MOUNTAINS[0];
    if (DEV_ON && DEV.has('m')) this.mountain = MOUNTAINS[Number(DEV.get('m'))] ?? this.mountain;
    this.daily = dailyMountain(dailyKey(new Date()));
    this.world = new World(root, this.mountain.seed, qualityFor(this.tiers.tier));
    this.tiers.onChange = (t: Tier) => {
      this.world.setQuality(qualityFor(t));
      this.ui.setMirror(t !== 'low');
    };
    // The shop shows the real sled meshes, rendered once each by the main renderer.
    setSledPortraits((id, seated) => this.world.sledPortrait(id, seated));
    this.input = new InputController(this.world.renderer.domElement);
    this.ui = new UI(root, {
      onRide: () => this.ride(),
      onRunAgain: () => this.runAgain(),
      onRevive: () => this.revive(),
      onDouble: () => this.doubleGifts(),
      onChallenge: () => this.shareChallenge(),
      onHome: () => this.home(),
      onPause: (p) => this.setPaused(p),
      onSelectMountain: (id) => this.selectMountain(id),
      onDaily: () => this.selectMountain('daily'),
      onSelectSled: (id) => this.selectSled(id),
      onBuySled: (id) => this.buySled(id),
      onSettings: (s) => this.applySettings(s),
      onOpenSleds: () => this.ui.showSleds(this.sledCards(), this.save.data.gifts),
      onOpenSettings: () => this.ui.showSettings(this.settingsModel()),
      onUiSound: (k) => {
        this.audio.unlock();
        this.audio.ui(k);
      },
      onRewardLanded: () => this.rewardLanded(),
      onMissionStamp: (row) => this.missionStamp(row),
    });
    // Low draws no rear-view picture, so the avalanche unit closes up to its chip and meter.
    this.ui.setMirror(this.tiers.tier !== 'low');
    this.wireInput();
    this.wirePlatformEvents();
    this.applyAudioSettings();
  }

  async start(): Promise<void> {
    this.ui.setLoading(0.2);
    // First frame immediately: the title scene renders while the SDK loads.
    requestAnimationFrame((t) => this.frame(t));
    this.enterTitle();
    await this.platform.init();
    this.platform.loadingStart();
    this.save.rebind(this.platform.storage);
    if (this.platform.muteAudio) this.audio.setMuted('sdk', true);
    this.applyAudioSettings();
    const user = await this.platform.getUser().catch(() => null);
    if (user?.username && this.save.data.runs === 0) this.save.data.name = user.username.slice(0, 16);
    const stale = this.readChallenge();
    this.adblock = await this.platform.hasAdblock().catch(() => false);
    this.ui.setLoading(null);
    this.platform.loadingStop();
    this.refreshTitle();
    // Said once the title is up and painting (its first frames compile shaders and can hold the
    // main thread for a second or more), so the toast's whole time on screen can be read.
    if (stale) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.setTimeout(() => {
            if (this.phase === 'title') this.ui.toast(STALE_LINK.text, 'info', STALE_LINK.sub);
          }, 600);
        }),
      );
    }
    // Once the title has settled, the shop's portraits are drawn in the background (title only).
    window.setTimeout(() => prewarmSledPortraits(SLEDS.map((s) => s.id), this.save.data.sled, () => this.phase === 'title'), 1200);
    if (DEV_ON && DEV.has('autoride')) this.ride();
    this.generateDaily();
  }

  /** Fresh rivals for the Daily Mountain, generated by the bot in the worker. */
  private generateDaily(): void {
    const daily = this.daily;
    void this.ghosts.generatePool(daily.seed, 10, hashString(daily.tagline), 16, 60 * 60 * 3.5).then((g) => {
      // A tab left open past UTC midnight may have moved on to the next day's mountain meanwhile.
      if (daily !== this.daily) return;
      this.dailyPool = g;
      this.dailyReady = true;
      if (this.phase === 'title') this.refreshTitle();
    });
  }

  /** Today's Daily Mountain, recomputed on every title entry (a tab left open past UTC midnight). */
  private refreshDaily(): void {
    const today = dailyMountain(dailyKey(new Date()));
    if (today.tagline === this.daily.tagline) return;
    const wasDaily = this.mountain === this.daily;
    this.daily = today;
    this.dailyPool = [];
    this.dailyReady = false;
    if (wasDaily) this.mountain = MOUNTAINS.find((m) => m.id === this.save.data.mountain) ?? MOUNTAINS[0];
    this.generateDaily();
  }

  // ------------------------------------------------------------------ wiring

  private wireInput(): void {
    this.input.onPress((source, code) => {
      this.audio.unlock();
      if (this.ui.modal && this.phase !== 'results') return;
      // On the title and the results only Space (Enter below) and a click or tap start a run: Shift is
      // an action key in a run, and Shift+Tab there only moves focus.
      if ((this.phase === 'title' || this.phase === 'results') && !startsFromMenu(source, code)) return;
      if (this.phase === 'title' && !this.ui.modal) this.ride();
      else if (this.phase === 'crashed' && performance.now() - this.crashTime > 350) this.showResults();
      else if (this.phase === 'results' && performance.now() - this.crashTime > 700) this.runAgain();
    });
    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'KeyP' && (this.phase === 'run' || this.paused)) this.setPaused(!this.paused);
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) {
        if (this.phase === 'title' && !this.ui.modal) this.ride();
        else if (this.phase === 'results') this.runAgain();
      }
    });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      const hidden = document.hidden;
      this.audio.setMuted('hidden', hidden);
      if (hidden) {
        this.input.releaseAll();
        // The platform handles focus and visibility itself, so this pause must not send gameplayStop.
        if (this.phase === 'run' && !this.paused) this.setPaused(true, false);
      }
      this.last = performance.now();
    });
  }

  private wirePlatformEvents(): void {
    this.platform.onAdPlaying((playing) => {
      this.adPlaying = playing;
      this.audio.setMuted('ad', playing);
      this.input.releaseAll();
    });
    this.platform.onSettingsChange((s) => this.audio.setMuted('sdk', s.muteAudio));
  }

  private applyAudioSettings(): void {
    const s = this.save.data.settings;
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
  }

  /** Reads the challenge link; true when it was made on an older build (the caller says so). */
  private readChallenge(): boolean {
    const raw = this.platform.getInviteParam('c') ?? new URLSearchParams(location.search).get('c');
    if (!raw) return false;
    const before = this.mountain;
    let stale = false;
    try {
      const rec = recordFromString(raw);
      this.challenge = { record: rec, attempts: 0 };
      const m = MOUNTAINS.find((mm) => mm.seed === rec.seed);
      if (m) this.mountain = m;
    } catch {
      // A link made on an older build (or mangled in transit): say so, and still open on its
      // mountain when its seed can be read.
      const seed = rawSeed(raw);
      const m = seed !== null ? MOUNTAINS.find((mm) => mm.seed === seed) : undefined;
      if (m) this.mountain = m;
      stale = true;
    }
    // The title was built before the link was read: rebuild its course and reel on the link's mountain.
    if (this.mountain !== before && this.phase === 'title') {
      this.world.setCourse(this.mountain.seed);
      this.audio.setMood(Mood.None, biomeForSeed(this.mountain.seed));
      this.setAttractField();
    }
    return stale;
  }

  // ------------------------------------------------------------------ title

  private enterTitle(): void {
    this.phase = 'title';
    this.paused = false;
    this.run = null;
    this.loop = null;
    this.refreshDaily();
    this.world.setCourse(this.mountain.seed);
    this.world.setMood(Mood.None);
    this.audio.setScene('title');
    this.audio.setMood(Mood.None, biomeForSeed(this.mountain.seed));
    this.ui.hideHud();
    this.hideResults();
    this.setAttractField();
    this.refreshTitle();
  }

  /** The results card goes, and any of its sounds still scheduled with it (av-sync). */
  private hideResults(): void {
    this.resultsSeq++;
    this.ui.hideResults();
    this.audio.cancelPending();
  }

  private setAttractField(): void {
    const pool = this.poolForMountain(this.mountain);
    // Mid-pool riders: stylish but clean, so the hero reel is carving and flying, not tumbling.
    const picks = pool.length ? [pool[Math.floor(pool.length * 0.6)], pool[Math.floor(pool.length * 0.72)], pool[Math.floor(pool.length * 0.84)]].filter(Boolean) : [];
    const entries = picks.map((g) => ({ name: g.name, kind: 'pool' as GhostKind, score: g.score, record: g.record }));
    this.ghosts.setField(entries);
    this.world.setGhostField(this.ghostField());
    this.attract = { tick: REEL_START, focus: -1 };
    const pose = emptySnap();
    pose.z = 2;
    pose.x = this.world.course.safeX(2);
    pose.y = this.world.course.ground(pose.x, 2);
    this.world.beginRun(pose, ChaosEvent.None);
  }

  private poolForMountain(m: MountainDef): PoolGhostData[] {
    return m.id === 'daily' ? this.dailyPool : poolFor(m.id);
  }

  private graveNames: Map<string, Graveyard[]> | null = null;

  /** Every bundled mountain's graveyards, named once in the mountains' order (graveyards.ts). */
  private bundledGraves(): Map<string, Graveyard[]> {
    return (this.graveNames ??= bundledGraveyards(MOUNTAINS.map((m) => ({ key: m.id, pool: poolFor(m.id) }))));
  }

  /** The title's friend line: the challenge's rider, score, distance and where (the Daily Mountain
   *  only for today's; another day's daily hides the distance). */
  private challengeModel(): TitleModel['challenge'] {
    const c = this.challenge;
    if (!c) return null;
    const rec = c.record;
    const named = MOUNTAINS.find((m) => m.seed === rec.seed);
    if (named) return { name: rec.name, score: rec.score, mountain: named.name, distance: rec.distance };
    if (rec.seed === this.daily.seed) return { name: rec.name, score: rec.score, mountain: 'the Daily Mountain', distance: rec.distance, daily: true };
    // Another day's Daily Mountain: no mountain named, so the title shows the first line alone.
    return { name: rec.name, score: rec.score, mountain: '', daily: true };
  }

  private refreshTitle(): void {
    if (this.phase !== 'title') return;
    const d = this.save.data;
    // (The Daily's day key; settleRun records the day streak and medal under it.)
    const today = this.daily.tagline;
    const model: TitleModel = {
      mountains: MOUNTAINS.map((m) => ({
        id: m.id,
        name: m.name,
        tagline: m.tagline,
        biome: biomeForSeed(m.seed),
        locked: d.ghostsPassed < m.unlockGhosts,
        unlockText: d.ghostsPassed < m.unlockGhosts ? `Pass ${m.unlockGhosts - d.ghostsPassed} more ghosts to unlock` : '',
        best: d.best[m.id]?.score ?? 0,
      })),
      selected: this.mountain.id,
      daily: { key: today, best: d.daily.key === today ? d.daily.best : 0, ready: this.dailyReady, medal: dailyMedalNow(d.daily, today), streak: dailyStreakNow(d.daily, today) },
      best: d.best[this.mountain.id]?.score ?? 0,
      wallet: d.gifts,
      sledName: sledById(d.sled).name,
      challenge: this.challengeModel(),
      missions: missionViews(d.missions),
      inputMode: this.input.mode,
      firstVisit: d.runs === 0,
      master: d.settings.master,
      ghostsPassed: d.ghostsPassed,
      greet: titleGreeting(d, this.mountainKey(), this.mountain.name),
    };
    this.ui.showTitle(model);
  }

  private selectMountain(id: string): void {
    if (id === 'daily') {
      if (!this.dailyReady) return;
      this.mountain = this.daily;
    } else {
      const m = MOUNTAINS.find((mm) => mm.id === id);
      if (!m || this.save.data.ghostsPassed < m.unlockGhosts) return;
      this.mountain = m;
      this.save.data.mountain = m.id;
      this.save.save();
    }
    if (this.phase === 'title') {
      this.world.setCourse(this.mountain.seed);
      this.audio.setMood(Mood.None, biomeForSeed(this.mountain.seed));
      this.setAttractField();
      this.refreshTitle();
    }
  }

  private selectSled(id: number): void {
    if (!this.save.data.ownedSleds.includes(id)) return;
    this.save.data.sled = id;
    this.save.save();
    this.ui.showSleds(this.sledCards(), this.save.data.gifts);
    this.refreshTitle();
  }

  private buySled(id: number): void {
    const def = SLEDS[id];
    const d = this.save.data;
    if (!def || d.ownedSleds.includes(id) || d.gifts < def.price) return;
    d.gifts -= def.price;
    d.ownedSleds.push(id);
    d.sled = id;
    this.save.flush();
    this.audio.ui('unlock');
    this.ui.toast(`${def.name} unlocked`, 'gift', def.trait);
    this.ui.showSleds(this.sledCards(), d.gifts);
    this.refreshTitle();
  }

  sledCards() {
    const d = this.save.data;
    return SLEDS.map((s) => ({ id: s.id, name: s.name, trait: s.trait, price: s.price, owned: d.ownedSleds.includes(s.id), equipped: d.sled === s.id, affordable: d.gifts >= s.price }));
  }

  private settingsModel(): SettingsModel {
    const s = this.save.data.settings;
    return { master: s.master, music: s.music, sfx: s.sfx, quality: s.quality, currentTier: this.tiers.tier, hints: s.hints };
  }

  private applySettings(p: Partial<SettingsModel>): void {
    const s = this.save.data.settings;
    if (p.master !== undefined) s.master = p.master;
    if (p.music !== undefined) s.music = p.music;
    if (p.sfx !== undefined) s.sfx = p.sfx;
    if (p.hints !== undefined) s.hints = p.hints;
    if (p.quality !== undefined && p.quality !== s.quality) {
      s.quality = p.quality;
      this.tiers.force(p.quality, guessTier());
    }
    this.applyAudioSettings();
    this.save.save();
  }

  // ------------------------------------------------------------------ runs

  private ride(): void {
    if (this.phase !== 'title') return;
    this.audio.unlock();
    // With a reveal card coming, 'go' waits for the card's first frame (startRun) and then 0.9 s, so
    // it never stacks on the card's slam.
    this.goAfterReveal = true;
    if (!this.startRun()) this.audio.ui('go', 0, 0);
  }

  /** The run's field (field.ts pickField), as ghost entries with their role and nemesis flags. */
  private pickField(chaos: ChaosRoll): Omit<GhostEntry, 'id'>[] {
    const d = this.save.data;
    const key = this.mountainKey();
    // A stale saved ghost (recorded on an older build) rides no more, quietly: the score, distance and
    // tally it carried stay in the save.
    const ownRec = d.best[key];
    const own = ownRec && validRecord(ownRec.record) ? ownRec : undefined;
    const grudgeRec = d.grudge[key];
    const grudge = grudgeRec && validRecord(grudgeRec.record) ? grudgeRec : undefined;
    const friend = this.challenge && this.challenge.record.seed === this.mountain.seed ? this.challenge.record : null;
    const picks = pickField({
      pool: this.poolForMountain(this.mountain),
      kind: this.mountain.id === 'daily' ? 'daily' : 'pool',
      mood: chaos.mood,
      event: chaos.event,
      count: 5 + moodInfo(chaos.mood).params.extraGhosts,
      anchor: anchorFor(d.runDists ?? {}, key),
      seed: chaos.seed,
      bestScore: ownRec?.score ?? 0,
      you: own?.record ? { name: d.name, score: own.score, distance: own.distance, record: own.record } : null,
      grudge: grudge?.record ? { name: grudge.name, score: grudge.score, record: grudge.record, distance: grudge.distance, nemesis: isNemesis(grudge) } : null,
      friend: friend ? { name: friend.name, score: friend.score, record: recordToString(friend) } : null,
    });
    return picks.map((g) => {
      const e: Omit<GhostEntry, 'id'> = { name: g.name, kind: g.kind, score: g.score, record: g.record };
      if (g.role) e.role = g.role;
      if (g.nemesis) e.nemesis = true;
      return e;
    });
  }

  /** The save's key for this mountain (a Daily Mountain is keyed by its day). */
  private mountainKey(): string {
    return this.mountain.id === 'daily' ? `daily:${this.daily.tagline}` : this.mountain.id;
  }

  /** Starts a run; returns whether a reveal card opens it. */
  private startRun(): boolean {
    const d = this.save.data;
    // ('go' belongs to a Ride: only ride() sets it, just before this.)
    const go = this.goAfterReveal;
    this.goAfterReveal = false;
    this.ui.closeMenus();
    this.ui.hideTitle();
    // (Run Again and a new reveal both cancel any sound still scheduled by the last screen.)
    this.hideResults();
    // Chaos: the first run of a session is always plain. A friend's challenge replays their
    // conditions from the second attempt on (the rematch).
    const seed = (Math.random() * 4294967296) >>> 0;
    let chaos = rollChaos(seed, this.sessionRuns, this.lastMood);
    if (this.challenge && this.challenge.record.seed === this.mountain.seed) {
      chaos = this.challenge.attempts > 0 && this.sessionRuns > 0 ? this.challenge.record.chaos : { ...chaos, mood: Mood.None, event: ChaosEvent.None };
      this.challenge.attempts++;
    }
    if (DEV_ON && (DEV.has('mood') || DEV.has('event'))) chaos = { mood: Number(DEV.get('mood') ?? 0) as Mood, event: Number(DEV.get('event') ?? 0) as ChaosEvent, seed: chaos.seed || 7 };
    this.chaos = chaos;
    if (chaos.mood !== Mood.None) this.lastMood = chaos.mood;
    this.sessionRuns++;

    this.world.setCourse(this.mountain.seed);
    this.world.setMood(chaos.mood);
    const field = this.pickField(chaos);
    this.ghosts.setField(field);
    this.world.setGhostField(this.ghostField());
    // The mountain's graveyards, from the whole pool's crashes (not the field's): cairns on the bank,
    // and a beat for riding past each alive. Set every run ([] clears the last mountain's).
    // (The bundled mountains are named together, so no place name stands on two of them.)
    this.graves = this.mountain.id === 'daily' ? graveyards(this.dailyPool, this.mountainKey()) : (this.bundledGraves().get(this.mountain.id) ?? []);
    this.world.setGraveyards(this.graves);

    this.input.releaseAll();
    // Dev demo: the rider replays an expert pool run (for capturing showcase moments).
    let source: InputSource = this.input;
    let sled = d.sled;
    let demo = false;
    if (DEV_ON && DEV.has('demo')) {
      const pool = this.poolForMountain(this.mountain);
      const pick = pool[Math.max(0, pool.length - 1 - Number(DEV.get('demo')))];
      if (pick) {
        const rec = recordFromString(pick.record);
        const log = decodeLog(rec.inputs);
        let i = 0;
        // The recorded slipstream bit too: drafting this live field instead made the physics diverge
        // (fox84's 3,584 m run hit a tree at 216 m).
        source = { sample: () => { const b = log.inputs[Math.min(i++, log.inputs.length - 1)] ?? 4; return { steer: b & 15, action: (b & 16) !== 0, draft: (b & 32) !== 0 }; } };
        demo = true;
        chaos = rec.chaos;
        this.chaos = chaos;
        sled = rec.sled;
        this.world.setMood(chaos.mood);
        // The replayed run rides exactly on the rider: drop it from the field however it came in
        // (the pool entry, or your best or grudge saved from an earlier demo run).
        const same = (r: string): boolean => {
          try {
            const o = recordFromString(r).inputs;
            return o.length === rec.inputs.length && o.every((v, i) => v === rec.inputs[i]);
          } catch {
            return false;
          }
        };
        this.ghosts.setField(field.filter((f) => f.name !== pick.name && !same(f.record)));
        this.world.setGhostField(this.ghostField());
      }
    }
    this.run = new Run(this.mountain.seed, chaos, sled, source);
    this.run.draftProbe = demo ? null : this.ghosts.draftProbe;
    this.loop = new FixedLoop(() => this.run!.tick());
    this.world.beginRun(this.run.cur, chaos.event, sled);
    this.world.resetFeel();
    this.phase = 'run';
    this.paused = false;
    this.reviveUsed = false;
    this.doubled = false;
    this.giftsPersisted = 0;
    this.bestPersisted = false;
    this.newBestThisRun = false;
    this.recordsThisRun.clear();
    this.passedThisRun.clear();
    this.passBonus = 0;
    this.grudgeBeaten = false;
    this.passedAtStart = d.ghostsPassed;
    this.settlement = null;
    this.results = null;
    this.airTicks = 0;
    this.hintTimer = 0;
    this.hintShown = null;
    this.hints.reset();
    this.heldLip = false;
    this.lostCombo = 0;
    this.grudgeLine = null;
    this.grudgeStrong = false;
    this.missionsPopped.clear();
    this.missionsSettled.clear();
    this.crashTicks = 0;
    this.renderTime = this.time;
    // A deep copy of the grudge as the run started: settleGrudge reads it again after a revive, so a
    // second crash settles the same run the same way.
    const g = d.grudge[this.mountainKey()];
    this.grudgeAtStart = g ? (JSON.parse(JSON.stringify(g)) as Grudge) : null;
    this.beginDirector(chaos);

    this.audio.setScene('run');
    this.audio.setMood(chaos.mood, biomeForSeed(this.mountain.seed));
    this.ui.showHud();
    const reveal = chaos.mood !== Mood.None || chaos.event !== ChaosEvent.None;
    if (reveal) {
      const mi = moodInfo(chaos.mood);
      void this.ui.reveal({
        mood: { id: chaos.mood, name: mi.name, rule: mi.rule },
        event: chaos.event !== ChaosEvent.None ? { id: chaos.event, name: eventInfo(chaos.event).name, goal: revealGoal(chaos.event) ?? undefined } : null,
        reel: MOODS.map((m) => m.name),
      });
      // The reveal's sounds on its own timeline (a tick per reel name, the slam on the stamp), with
      // nothing left over from the last screen, from the card's first animation frame: reveal.ts
      // starts its timers there too, so a long first frame of a run no longer runs the ticks ahead of
      // a frozen reel. 'go' (Ride) waits on the same clock, clear of the slam.
      const run = this.run;
      requestAnimationFrame(() => {
        if (this.run !== run || this.phase !== 'run') return;
        this.audio.cancelPending();
        this.audio.cueReveal(REVEAL_TIMING, reduced());
        if (go) this.audio.ui('go', 0, 0.9);
      });
    }
    this.platform.gameplayStart();
    return reveal;
  }

  /** The ghost layer's field: each track's id, name and kind, with its role and nemesis flags. */
  private ghostField(): Array<{ id: number; name: string; kind: GhostKind; role?: GhostEntry['role']; nemesis?: boolean }> {
    return this.ghosts.tracks.map((t) => {
      const g: { id: number; name: string; kind: GhostKind; role?: GhostEntry['role']; nemesis?: boolean } = { id: t.entry.id, name: t.entry.name, kind: t.entry.kind };
      if (t.entry.role) g.role = t.entry.role;
      if (t.entry.nemesis) g.nemesis = true;
      return g;
    });
  }

  /** Hands the director this run's snapshots (taken before the run can change the save). */
  private beginDirector(chaos: ChaosRoll): void {
    const d = this.save.data;
    const key = this.mountainKey();
    const g = d.grudge[key];
    const friend = this.challenge && this.challenge.record.seed === this.mountain.seed ? this.challenge.record : null;
    const reveal = chaos.mood !== Mood.None || chaos.event !== ChaosEvent.None;
    this.director.beginRun({
      mood: chaos.mood,
      event: chaos.event,
      triggerZ: this.run ? this.run.sim.dyn.triggerZ : Infinity,
      hasReveal: reveal,
      revealLeaveS: reveal ? REVEAL_TIMING.T_LEAVE / 1000 : 0,
      bestDistAtStart: d.best[key]?.distance ?? 0,
      bestScoreAtStart: d.best[key]?.score ?? 0,
      bestComboAtStart: d.stats.bestCombo,
      grudgeAtStart: g ? { name: g.name, record: g.record, them: g.them ?? 1, streak: g.streak ?? 1 } : null,
      friend: friend ? { name: friend.name, distance: friend.distance } : null,
      lifetimePassed: d.ghostsPassed,
      unlockLadder: MOUNTAINS.filter((m) => m.unlockGhosts > d.ghostsPassed).map((m) => ({ id: m.id, name: m.name, biome: biomeForSeed(m.seed), need: m.unlockGhosts })),
      missionsCrossed: () => this.missionsCrossedNow(),
      graveyards: this.graves,
    });
    this.director.time.reset();
  }

  /** Missions this run has newly met (display only: settleRun still credits them). Pass metrics
   *  count only the passes that showed, so a start-line jostle never pops 'Pass a ghost'. After a
   *  revive the run is judged against the missions it started with, as its settlement is. */
  private missionsCrossedNow(): Array<{ id: string; text: string; reward: number }> {
    if (!this.run) return [];
    const d = this.save.data;
    const sum = this.summary();
    sum.ghostsPassed = Math.min(this.passedThisRun.size, this.director.shownPasses.size);
    const state = this.settlement ? this.settlement.missionsBefore : d.missions;
    const met = missionsCrossed(state, sum, this.missionsPopped, { unlockedBiomes: unlockedBiomes(d.ghostsPassed) });
    for (const m of met) this.missionsPopped.add(m.id);
    return met;
  }

  private runAgain(): void {
    if (this.phase !== 'results' && this.phase !== 'crashed') return;
    this.finalizeRun();
    this.pacing.runEnded();
    if (this.platform.adsAvailable && this.pacing.shouldShowMidgame(Date.now())) {
      this.hideResults();
      void this.platform.requestMidgame().then((r) => {
        if (r === 'shown') this.pacing.adShown(Date.now());
        this.startRun();
      });
      return;
    }
    this.startRun();
  }

  private home(): void {
    this.finalizeRun();
    this.platform.gameplayStop();
    this.enterTitle();
  }

  /** userInitiated=false means the tab was hidden: pause locally but leave the SDK state alone. */
  private setPaused(p: boolean, userInitiated = true): void {
    if (this.phase !== 'run') return;
    this.paused = p;
    if (this.run) this.run.paused = p;
    this.input.releaseAll();
    if (p) {
      if (userInitiated) this.platform.gameplayStop();
      this.ui.showPause(this.settingsModel());
    } else {
      this.ui.hidePause();
      this.last = performance.now();
      this.platform.gameplayStart();
    }
  }

  private revive(): void {
    if (!this.run || this.reviveUsed || !this.run.crashed) return;
    this.reviveUsed = true;
    void this.platform.requestRewarded().then((ok) => {
      if (!ok || !this.run) {
        // The revive is spent either way (one per run), so say so.
        this.ui.toast('No ad available, so no revive this run', 'info');
        if (this.results) {
          this.results.canRevive = false;
          this.ui.updateResults(this.results);
        }
        return;
      }
      this.pacing.adShown(Date.now());
      this.hideResults();
      // What the first results card already showed Done is not news again mid-run.
      for (const id of this.missionsSettled) this.missionsPopped.add(id);
      this.run.revive();
      // (The director's revive also resets its time scale: no crash curve, no held pulse.)
      this.director.revive();
      this.world.resetFeel();
      this.crashTicks = 0;
      this.phase = 'run';
      this.world.cam.mode = 'chase';
      this.last = performance.now();
      this.platform.gameplayStart();
      this.ui.showHud();
    });
  }

  private doubleGifts(): void {
    if (!this.results || this.doubled || !this.run) return;
    void this.platform.requestRewarded().then((ok) => {
      if (!ok || !this.results || !this.run) {
        this.ui.toast('No ad available. Try again in a moment.', 'info');
        // Re-arm the offer: its button waits on "Loading…" until the results are updated.
        if (this.results) this.ui.updateResults(this.results);
        return;
      }
      this.pacing.adShown(Date.now());
      this.doubled = true;
      const bonus = this.run.sim.gifts + this.passBonus;
      this.save.data.gifts += bonus;
      this.save.data.lifetimeGifts += bonus;
      this.save.flush();
      this.results.doubled = true;
      this.results.canDouble = false;
      this.results.giftsEarned = bonus * 2;
      this.results.wallet = this.save.data.gifts;
      this.ui.updateResults(this.results);
      // (The ad muted the audio and the engine suspended it: this coin, and the landings the re-render
      // just set off, wait for it to run again, then play as one.)
      this.resultsSound('coin');
    });
  }

  /** A results sound now, or, while the audio context is still waking after a rewarded ad, as soon
   *  as it runs (every sound waiting goes together, so one moment's coins play once). A context that
   *  stays down (muted, hidden) drops them after WAKE_WAIT_MS: late is worse than none. */
  private resultsSound(name: UiSound, detail?: number): void {
    if (this.audio.ready && this.uiWaiting.length === 0) {
      this.audio.ui(name, detail);
      return;
    }
    if (this.uiWaiting.length === 0) {
      this.uiWaitSince = performance.now();
      const seq = this.resultsSeq;
      const poll = (): void => {
        if (seq !== this.resultsSeq || this.phase !== 'results') {
          this.uiWaiting.length = 0;
          return;
        }
        if (!this.audio.ready && performance.now() - this.uiWaitSince < WAKE_WAIT_MS) {
          window.setTimeout(poll, 16);
          return;
        }
        const list = this.uiWaiting;
        this.uiWaiting = [];
        if (this.audio.ready) for (const q of list) this.audio.ui(q.name, q.detail);
      };
      window.setTimeout(poll, 0);
    }
    this.uiWaiting.push({ name, detail });
  }

  private shareChallenge(): void {
    if (!this.run) return;
    const rec = this.run.toRecord(this.save.data.name);
    const link = this.platform.inviteLink({ c: recordToString(rec) });
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    // Beat a friend's link and it goes back to them with the margin: "Send It Back".
    const fr = this.friendRecord();
    const dist = this.run.sim.distance;
    const answer = !!fr && dist > fr.distance;
    const title = fr && answer ? challengeShareTitle(fr.name, fr.distance, this.mountain.name, Math.round(dist - fr.distance)) : challengeShareTitle(this.save.data.name, dist, this.mountain.name, null);
    // The clipboard carries the answer back too: the same line the phone's share sheet sends, then the link.
    const done = () => (fr && answer ? this.ui.toast(`Copied your answer to ${fr.name}`, 'ghost') : this.ui.toast('Challenge link copied', 'ghost', 'Send it to a friend to race your ghost'));
    if (this.platform.deviceType !== 'desktop' && nav.share) {
      nav.share({ title, url: link }).catch(() => undefined);
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(answer ? `${title} ${link}` : link).then(done, () => this.ui.toast('Could not copy the link', 'info'));
    } else done();
  }

  // ------------------------------------------------------------------ results

  /** The friend's challenge record when it races on this mountain, else null. */
  private friendRecord(): RunRecord | null {
    return this.challenge && this.challenge.record.seed === this.mountain.seed ? this.challenge.record : null;
  }

  private crashed(): void {
    this.phase = 'crashed';
    this.crashTime = performance.now();
    this.platform.gameplayStop();
    this.ui.hint(null, this.input.mode);
    this.persistRun();
    // The crash beat (a held frame, slow motion, a still lens) plays out before the results arrive.
    const wait = reduced() ? CRASH_RESULTS_REDUCED_MS : CRASH_RESULTS_MS;
    const seq = ++this.crashSeq;
    setTimeout(() => {
      if (this.phase === 'crashed' && seq === this.crashSeq) this.showResults();
    }, wait);
  }

  private summary(): RunSummary {
    const sim = this.run!.sim;
    const st = sim.stats;
    return {
      mountain: this.mountain.id,
      biome: biomeForSeed(this.mountain.seed),
      score: sim.score,
      distance: sim.distance,
      gifts: sim.gifts,
      perfects: st.perfects,
      maxAirtime: st.maxAirtime,
      maxHalfTurns: st.maxHalfTurns,
      flips: st.flips,
      driftSeconds: st.driftTicks / 60,
      draftSeconds: st.draftTicks / 60,
      nearMisses: st.nearMisses,
      bestCombo: st.bestCombo,
      maxSpeed: st.maxSpeed,
      smashes: st.smashes,
      gates: st.gates,
      yetiHop: st.yetiHop,
      outranAvalanche: st.outranAvalanche,
      ghostsPassed: this.passedThisRun.size,
      grudgeBeaten: this.grudgeBeaten,
      chaos: this.chaos.mood !== Mood.None || this.chaos.event !== ChaosEvent.None,
    };
  }

  /** Persist progress at the moment of the crash (and again after a revive), so closing the tab on
   *  the results screen never loses a run. Gifts are credited incrementally. */
  private persistRun(): void {
    if (!this.run) return;
    const d = this.save.data;
    const sim = this.run.sim;
    const key = this.mountain.id === 'daily' ? `daily:${this.daily.tagline}` : this.mountain.id;
    const giftsNow = sim.gifts + this.passBonus;
    const delta = giftsNow - this.giftsPersisted;
    d.gifts += delta;
    d.lifetimeGifts += delta;
    this.giftsPersisted = giftsNow;
    const score = sim.score;
    const prev = d.best[key]?.score ?? 0;
    if (score > prev) {
      d.best[key] = { score, distance: sim.distance, record: recordToString(this.run.toRecord(d.name)) };
      if (prev > 0 && !this.newBestThisRun) this.platform.happytime();
      this.newBestThisRun = true;
    }
    // (Spread, so fields a later build adds to the daily record survive this write.)
    if (this.mountain.id === 'daily') d.daily = { ...d.daily, key: this.daily.tagline, best: Math.max(d.daily.key === this.daily.tagline ? d.daily.best : 0, score) };
    d.stats.bestScore = Math.max(d.stats.bestScore, score);
    // A record needs one to beat: a first combo or jump is not news. (Also caught after a revive.)
    if (d.stats.bestCombo > 0 && sim.stats.bestCombo > d.stats.bestCombo) this.recordsThisRun.add('bestCombo');
    if (d.stats.longestAir > 0 && sim.stats.maxAirtime > d.stats.longestAir) this.recordsThisRun.add('maxAir');
    d.stats.bestCombo = Math.max(d.stats.bestCombo, sim.stats.bestCombo);
    d.stats.longestAir = Math.max(d.stats.longestAir, sim.stats.maxAirtime);
    d.stats.topSpeed = Math.max(d.stats.topSpeed, sim.stats.maxSpeed);
    // The grudge, settled from the snapshot taken at the start (so a revive's second crash gives the
    // same answer): it stays and its tally grows, or you beat it and the Next row takes its place.
    const settled = settleGrudge(this.grudgeAtStart, this.grudgeOutcome(sim));
    if (settled.grudge) d.grudge[key] = settled.grudge;
    else delete d.grudge[key];
    this.grudgeLine = settled.line;
    // A settled grudge or a nemesis outranks the event note on the results; a fresh grudge does not.
    this.grudgeStrong = settled.settled || isNemesis(settled.grudge);
    this.bestPersisted = true;
    this.save.flush();
  }

  /** How the run ended against its grudge: did the grudge ride, was it passed, and the results'
   *  Next row (the nearest ghost whose whole run went further than yours; never 'you' or a friend).
   *  'Passed' is the director's verdict (its grudgeSettled beat fired: a shown pass, a duel beaten, or
   *  riding past where it ended), so the results settle exactly what the run showed settled: a
   *  start-line jostle past it is no overtake. */
  private grudgeOutcome(sim: Sim): Parameters<typeof settleGrudge>[1] {
    const g = this.grudgeAtStart;
    let rode: { distance: number; passed: boolean } | null = null;
    let next: { name: string; score: number; record: string; distance: number; kind: GhostKind } | null = null;
    // Everyone who went further: a settled grudge's successor is elected from these, never itself.
    const ahead: Array<{ name: string; score: number; record: string; distance: number; kind: GhostKind }> = [];
    for (const t of this.ghosts.tracks) {
      if (!t.ready) continue;
      if (g && t.entry.kind === 'grudge' && t.entry.record === g.record) rode = { distance: t.distance, passed: this.director.grudgeSettled };
      if (t.entry.kind === 'you' || t.entry.kind === 'friend') continue;
      const by = t.distance - sim.distance;
      if (by <= 0) continue;
      const row = { name: t.entry.name, score: t.entry.score, record: t.entry.record, distance: t.distance, kind: t.entry.kind };
      ahead.push(row);
      if (!next || by < next.distance - sim.distance) next = row;
    }
    return { youDistance: sim.distance, rode, next, ahead };
  }

  private finalizeRun(): void {
    if (!this.run || !this.bestPersisted) return;
    this.bestPersisted = false;
  }

  private showResults(): void {
    if (!this.run) return;
    this.phase = 'results';
    // The crash beat is over: no curve or pulse carries into the results scene.
    this.director.time.reset();
    const d = this.save.data;
    const sim = this.run.sim;
    // A revive and a second crash settle the same run again: settleRun credits only the difference.
    // A Daily run is graded against the day's pool (bronze, silver and gold distances).
    const medals = this.mountain.id === 'daily' ? medalThresholds(this.dailyPool.map((g) => g.distance)) : null;
    const settled = settleRun(d, this.summary(), this.settlement, this.mountainKey(), medals);
    this.settlement = settled.settlement;
    // The missions this card shows Done: a revive never pops them again mid-run.
    for (const mv of settled.missions) if (mv.justCompleted) this.missionsSettled.add(mv.id);
    const missions = { views: settled.missions };
    const unlocked: string[] = [];
    const unlockedMountains: NonNullable<ResultsModel['unlockedMountains']> = [];
    // What this run unlocked, counted from the run's start: a revive's re-settle has already credited
    // the first crash's passes (its passedBefore), and the card still belongs to this run's results.
    const before = Math.min(settled.passedBefore, this.passedAtStart);
    for (const m of MOUNTAINS) {
      if (before < m.unlockGhosts && d.ghostsPassed >= m.unlockGhosts) {
        unlocked.push(m.name);
        unlockedMountains.push({ id: m.id, name: m.name, biome: biomeForSeed(m.seed), tagline: m.tagline });
      }
    }
    this.save.flush();
    const key = this.mountain.id === 'daily' ? `daily:${this.daily.tagline}` : this.mountain.id;
    // The race is decided by distance: each ghost carries how far its whole run went (the replay
    // worker reports it), and the Passed stamps are exactly the overtakes counted this run.
    const ghosts = this.ghosts.tracks
      .filter((t) => t.ready)
      .map((t) => ({ name: t.entry.name, kind: t.entry.kind, score: t.entry.score, distance: t.distance, passed: this.passedThisRun.has(t.entry.id) }))
      .sort((a, b) => b.distance - a.distance);
    this.results = {
      score: sim.score,
      distance: sim.distance,
      best: d.best[key]?.score ?? sim.score,
      newBest: this.newBestThisRun,
      giftsEarned: sim.gifts + this.passBonus,
      wallet: d.gifts,
      ghosts,
      ghostsPassed: ghosts.filter((g) => g.passed).length,
      missions: missions.views,
      crashCause: this.crashText(sim.s.crashCause),
      crashKind: sim.s.crashCause,
      bestCombo: sim.stats.bestCombo,
      perfects: sim.stats.perfects,
      maxAir: sim.stats.maxAirtime,
      records: [...this.recordsThisRun],
      mountain: this.mountain.name,
      mood: moodInfo(this.chaos.mood).name,
      canRevive: !this.reviveUsed && this.platform.adsAvailable && !this.adblock && sim.distance > 120,
      canDouble: this.platform.adsAvailable && !this.adblock && sim.gifts + this.passBonus > 0,
      doubled: false,
      canChallenge: sim.score > 0,
      unlocked,
      unlockedMountains,
      bestStreak: this.director.bestStreak,
      lostCombo: this.lostCombo,
      // One race line (C6): a friend's challenge, the Daily medal, a settled grudge or a nemesis, the
      // event the run never reached, then any other grudge line.
      raceLine: resultsRaceLine({
        friend: this.friendLine(sim),
        daily: this.mountain.id === 'daily' ? (settled.daily?.line ?? null) : null,
        grudge: this.grudgeLine ? { text: this.grudgeLine, strong: this.grudgeStrong } : null,
        event: this.director.eventNote(sim),
      }),
      runAgainLabel: runAgainLabel(this.friendForLabel(sim), d.grudge[key] ? { name: d.grudge[key].name } : null),
      nextUnlock: unlocked.length ? null : nextUnlock(d),
      sendItBack: this.friendBeaten(sim),
    };
    this.ui.hideHud();
    this.ui.showResults(this.results);
    this.audio.setScene('results');
    // The card's sounds start on its first painted frame, where its CSS beats start: anchored here, a
    // long frame at open put the count-up ticks over a frozen card. Skipped if the card went meanwhile.
    this.coinsLanded = 0;
    this.chimesLanded = 0;
    this.chimedRows.clear();
    const seq = ++this.resultsSeq;
    const model = this.results;
    const live = (): boolean => seq === this.resultsSeq && this.phase === 'results' && this.results === model;
    requestAnimationFrame(() => {
      if (!live()) return;
      // The beats start when the card's CSS animations do: their start time, once it is resolved (a
      // frame or so after the card is styled). Anchored at this frame the sounds ran about 22 ms early,
      // and at the animations' ready promise about 33 ms late, so the cues carry the measured lag.
      const first = document.querySelector('.gs-results')?.getAnimations?.({ subtree: true }).find((a) => a.pending);
      let done = false;
      const go = (): void => {
        if (done || !live()) return;
        done = true;
        const st = first ? first.startTime : null;
        this.resultsSounds(model, typeof st === 'number' ? Math.max(0, (performance.now() - st) / 1000) : 0);
      };
      if (!first) return go();
      first.ready.then(go, go);
      window.setTimeout(go, 250);
    });
  }

  /** A results reward landed in the wallet (results.ts, flown or not): its coin, in landing order. Under
   *  reduced motion the card lands whole and cueResults plays the one coin. */
  private rewardLanded(): void {
    if (this.phase !== 'results' || reduced()) return;
    this.resultsSound('coin', this.coinsLanded++);
  }

  /** A mission's Done stamp started on screen (results.ts): its chime, in landing order, once per row.
   *  A list folded away or scrolled out of view draws no stamp and makes no sound. Under reduced
   *  motion the card lands whole and cueResults plays the one chime. */
  private missionStamp(row: number): void {
    if (this.phase !== 'results' || reduced() || this.chimedRows.has(row)) return;
    this.chimedRows.add(row);
    this.resultsSound('mission', this.chimesLanded++);
  }

  /** The friend's challenge on this mountain, for the Rematch label. */
  private friendForLabel(sim: Sim): { name: string; beaten: boolean } | null {
    const fr = this.friendRecord();
    return fr ? { name: fr.name, beaten: sim.distance > fr.distance } : null;
  }

  private friendBeaten(sim: Sim): boolean {
    const fr = this.friendRecord();
    return !!fr && sim.distance > fr.distance;
  }

  /** The friend line: 'You beat Mila by 120 m.' or 'Mila is 340 m ahead.' Names only. */
  private friendLine(sim: Sim): string | null {
    const fr = this.friendRecord();
    return fr ? friendLine(fr.name, fr.distance, sim.distance) : null;
  }

  /** The results card's sounds on its CSS beats (results.ts RESULTS_TIMING), laid by the engine: the
   *  count-up ticking up the ladder, the place stamp, the New best chord on its stamp and a mallet per
   *  Beat stamp in view. Each mission's chime plays as its Done stamp starts on screen (missionStamp)
   *  and each reward's coin as it lands (rewardLanded), which the card calls whichever path it took: a
   *  phone's folded list chimes for nothing it does not draw. Reduced motion plays it all at once, the
   *  one chime and the one coin included. (The only mission sound: settleRun credits, nothing chimes
   *  twice.) */
  private resultsSounds(m: ResultsModel, lagS = 0): void {
    const rows = (pred: (mv: ResultsModel['missions'][number]) => boolean): number[] => m.missions.flatMap((mv, i) => (pred(mv) ? [i] : []));
    const ahead = m.ghosts.filter((g) => (g.distance ?? 0) > m.distance).length;
    const still = reduced();
    const show = {
      count: m.score > 0,
      newBest: m.newBest,
      beats: beatStampsShown(m.ghosts.length, ahead),
      missions: still ? rows((mv) => mv.justCompleted) : [],
      coins: still ? rows((mv) => mv.justCompleted && mv.reward > 0) : [],
    };
    if (lagS <= 0.001) {
      this.audio.cueResults(show, RESULTS_TIMING, still);
      return;
    }
    // The card started lagS ago: the same timeline (engine.cueResults' own cues), that much sooner.
    for (const q of resultsCues(show, RESULTS_TIMING, still)) this.audio.ui(q.name, q.detail, Math.max(0, q.at - lagS));
  }

  private crashText(cause: string | null): string {
    switch (cause) {
      case 'tree':
        return 'Hugged a tree';
      case 'rock':
        return 'Found a rock';
      case 'forest':
        return 'Lost in the forest';
      case 'landing':
        return 'Bad landing';
      case 'yeti':
        return 'Met the yeti';
      case 'avalanche':
        return 'Buried by the avalanche';
      default:
        return 'Wipeout';
    }
  }

  // ------------------------------------------------------------------ per frame

  private firstFrame = true;

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    if (this.firstFrame) {
      this.firstFrame = false;
      // Measured by play-tests: time from navigation start to the first rendered frame.
      requestAnimationFrame(() => performance.mark('gs-first-frame'));
    }
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    this.tiers.frame(dt);
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 300) this.frameTimes.shift();
    if (DEV.has('fps')) this.drawFps();
    if (this.phase === 'title' || this.phase === 'boot') this.frameTitle(dt);
    else this.frameRun(dt);
  }

  /** Frame time stats over the last ~5 s: average fps, p90 frame time, current tier. */
  frameStats(): { fps: number; p90: number; tier: Tier } {
    const f = [...this.frameTimes].sort((x, y) => x - y);
    const avg = f.reduce((s, v) => s + v, 0) / Math.max(1, f.length);
    return { fps: Math.round(1000 / Math.max(1, avg)), p90: f[Math.floor(f.length * 0.9)] ?? 0, tier: this.tiers.tier };
  }

  private drawFps(): void {
    if (!this.fpsEl) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99;color:#F5F3FF;font:700 12px/1 ui-monospace,monospace;background:rgba(18,25,51,.7);padding:4px 6px;border-radius:6px;pointer-events:none';
      document.body.appendChild(this.fpsEl);
    }
    if (this.frameTimes.length % 15 === 0) {
      const s = this.frameStats();
      this.fpsEl.textContent = `${s.fps} fps  p90 ${s.p90.toFixed(1)} ms  ${s.tier}`;
    }
  }

  /** The attract reel's hero, and the moment the reel starts: the title should open on two riders
   *  sharing one slope. The replays are scanned (from 6 s in, every 0.1 s) for the stretch where one
   *  rider has another racing right beside it on the snow, a lane aside and half a length to two
   *  lengths ahead (one trailing behind the hero is behind the lens). That rider is the hero and the reel
   *  starts just before the stretch: a reel opening on a far mate showed it as a 40 px speck, or
   *  flying at sun height off a kicker. With no such stretch, the rider running second 10 s in is
   *  the hero, so the leader races ahead of it in frame (with the leader as hero every ghost
   *  trailed behind the camera). Among duels, one with more of the pack in frame at mid-distance
   *  ahead (5 to 18 m) scores higher: "race the ghosts" sells better as a pack than as one companion.
   *  Deterministic per mountain, so a loop re-picks the same moment. -1 until the tracks are in. */
  private pickAttractHero(): number {
    const tracks = this.ghosts.tracks;
    const n = tracks.length;
    const p = emptyPose();
    for (const t of tracks) if (!this.ghosts.pose(t, 600, p)) return -1;
    if (n === 0) return -1;
    const STEP = 6;
    const samples = Math.floor((REEL_SCAN_END - REEL_START) / STEP);
    // The duel score of each rider as hero at each sample: 1 for a grounded mate half a length to two
    // lengths ahead and a lane or so aside (it reads as a rival at about two thirds of the hero's size,
    // where level with it, from the camera behind, it read as a companion and further back as a
    // bystander), less when abreast, further out or closer in, plus a little for each of up to two
    // more riders racing ahead down the corridor (a second, smaller ghost turns a duel into a race).
    const q = new Float32Array(n * samples);
    const poses = tracks.map(() => emptyPose());
    for (let k = 0; k < samples; k++) {
      const tick = REEL_START + k * STEP;
      for (let i = 0; i < n; i++) if (!this.ghosts.pose(tracks[i], tick, poses[i])) poses[i].done = true;
      for (let i = 0; i < n; i++) {
        const h = poses[i];
        if (h.done || !h.grounded) continue;
        let best = 0;
        let pack = 0;
        for (let j = 0; j < n; j++) {
          const m = poses[j];
          if (j === i || m.done) continue;
          const dx = m.x - h.x;
          const dz = m.z - h.z;
          const d = Math.hypot(dx, dz);
          const along = dx * Math.sin(h.heading) + dz * Math.cos(h.heading);
          if (d >= 5 && d <= 18 && along > 3 && Math.abs(dx * Math.cos(h.heading) - dz * Math.sin(h.heading)) < 8) pack++;
          if (!m.grounded) continue;
          // (+ on the hero's right, toward the open sky beside the hero on the desktop title.)
          const side = dx * Math.cos(h.heading) - dz * Math.sin(h.heading);
          const lat = Math.abs(side);
          // Best: 2 to 3 m off the hero's shoulder at nearly the same depth, so the ghost is about the
          // hero's size, wisp and all (half a length or more ahead it read as a small mint figure at
          // the edge of the frame); then a little further ahead, or closer in.
          const lane = lat >= 1.0 && lat <= 3.6;
          const shoulder = lat >= 1.7 && lat <= 3.3;
          const s =
            (shoulder && along >= -0.4 && along <= 1.2 ? 1 : lane && along >= -0.5 && along <= 2.6 ? 0.72 : d >= 2.2 && d <= 6.5 ? 0.42 : d >= 1.6 && d < 2.2 ? 0.25 : 0) *
            (along >= -0.5 ? 1 : 0.15) *
            (side > 0 ? 1 : 0.88);
          if (s > best) best = s;
        }
        q[i * samples + k] = best > 0 ? best + 0.3 * Math.min(2, pack) : 0;
      }
    }
    // The best 5 s stretch, weighted toward its first seconds (what a first glance at the title sees).
    const W = Math.floor(300 / STEP);
    let bestSum = 0;
    let hero = -1;
    let start = REEL_START;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k + W <= samples; k++) {
        let sum = 0;
        for (let j = 0; j < W; j++) sum += q[i * samples + k + j] * (j < W * 0.6 ? 1 : 0.6);
        if (sum > bestSum + 1e-6) {
          bestSum = sum;
          hero = i;
          start = REEL_START + k * STEP;
        }
      }
    }
    let heroId: number;
    if (hero >= 0 && bestSum > W * 0.35) {
      // Half a second of lead-in, so the pair is already together when the first frame settles.
      this.attract.tick = Math.max(REEL_START, start - 30);
      heroId = tracks[hero].entry.id;
    } else {
      this.attract.tick = REEL_START;
      const ranked: { id: number; z: number }[] = [];
      for (const t of tracks) {
        this.ghosts.pose(t, 600, p);
        if (!p.done) ranked.push({ id: t.entry.id, z: p.z });
      }
      if (!ranked.length) return tracks[0].entry.id;
      ranked.sort((a, b) => b.z - a.z);
      // A leader already out of sight is no race to show: then the leader is the hero.
      heroId = ranked.length > 1 && ranked[0].z - ranked[1].z < 40 ? ranked[1].id : ranked[0].id;
    }
    const duel = this.pickReelMate(heroId);
    return duel >= 0 ? duel : heroId;
  }

  /** The title reel's duel, made certain: one ghost rides at the hero's shoulder, 2 to 3 m to one
   *  side and level with it (half a metre ahead), at nearly its size with its wisp in the frame. In
   *  their natural timing most fields never ride abreast (a mate 5 m ahead read as a small mint figure
   *  at the edge of the frame), and recorded lines rarely sit more than a metre or so apart. So the
   *  partner is replayed off its own clock, at whatever moment of its run keeps it level with the hero,
   *  and eased across to reelMate.lat metres off the hero's line wherever that spot is clear of every
   *  hazard and inside the corridor (it rejoins its own line where it is not, so it never rides
   *  through a tree). The pair and side chosen are the ones, among the opening stretches every 3 s
   *  and every hero and mate, that stay clear (and need the least shift) for most of 5 s; the hero's
   *  right, toward the open sky beside it on the desktop title, scores a little higher. Returns the
   *  hero and sets the reel's start, or -1 to keep the natural pick. Deterministic per mountain. */
  private pickReelMate(natural: number): number {
    reelMate.id = -1;
    reelMate.off = NaN;
    reelSpacing();
    const tracks = this.ghosts.tracks;
    const h = emptyPose();
    const m = emptyPose();
    // 8 s at 0.27 s steps: the duel should outlast a first look at the title.
    const SAMPLES = 30;
    const EVERY = 16;
    let best = SAMPLES * 0.45;
    let heroId = -1;
    let start = REEL_START;
    // The natural pick's opening first, then the stretches every 4 s through the first 25 s.
    const starts = [this.attract.tick];
    for (let s = REEL_START; s <= REEL_SCAN_END - SAMPLES * EVERY; s += 240) starts.push(s);
    for (const from of starts) {
      for (const ht of tracks) {
        for (const mt of tracks) {
          if (mt === ht) continue;
          for (const sign of [1, -1]) {
            let sum = 0;
            let mTick = -1;
            for (let j = 0; j < SAMPLES; j++) {
              const tick = from + j * EVERY;
              if (!this.ghosts.pose(ht, tick, h) || h.done) continue;
              // (Each step searches on from the last: the partner's clock never runs backward.)
              mTick = mTick < 0 ? this.tickAtZ(mt, h.z + reelMate.lead) : this.tickAtZ(mt, h.z + reelMate.lead, mTick, mTick + 160, 12);
              if (!h.grounded || !this.ghosts.pose(mt, mTick, m) || m.done || !m.grounded) continue;
              // The opening five seconds (the first look at the title) keep a hazard out from behind the hero.
              if (j < 18 && this.reelBackdrop(h)) {
                sum -= 1;
                continue;
              }
              const off = this.reelOffset(h, m, sign);
              if (!this.reelClear(m.x + off, m.z)) continue;
              sum += (1 - 0.25 * Math.abs(off) / reelMate.lat) * (sign > 0 ? 1 : 0.85) * (j < SAMPLES * 0.6 ? 1 : 0.7) * (ht.entry.id === natural ? 1.1 : 1);
            }
            if (sum > best + 1e-6) {
              best = sum;
              heroId = ht.entry.id;
              reelMate.id = mt.entry.id;
              reelMate.side = sign;
              start = from;
            }
          }
        }
      }
    }
    if (heroId >= 0) this.attract.tick = start;
    return heroId;
  }

  /** How far across (sim x) the reel's partner `m` moves to ride reelMate.lat metres to `sign` of hero `h`
   *  (across the hero's heading), at most a little more than that. */
  private reelOffset(h: GhostPose, m: GhostPose, sign: number): number {
    const lat = (m.x - h.x) * Math.cos(h.heading) - (m.z - h.z) * Math.sin(h.heading);
    const k = reelMate.lat;
    return Math.max(-k - 0.4, Math.min(k + 0.4, sign * k - lat));
  }

  /** Whether a hazard or a kicker lies on the hero's line 2.5 to 10 m ahead, where the title's low
   *  lens sees it right behind the hero's shoulders: a kicker's dark face there merged with the navy
   *  coat into one slab. */
  private reelBackdrop(h: GhostPose): boolean {
    const c = this.world.course;
    const sn = Math.sin(h.heading);
    const cs = Math.cos(h.heading);
    const behind = (x: number, z: number, r: number) => {
      const dx = x - h.x;
      const dz = z - h.z;
      const along = dx * sn + dz * cs;
      return along > 2.5 && along < 10 && Math.abs(dx * cs - dz * sn) < r + 1.2;
    };
    const i = Math.floor(h.z / 64);
    for (let k = i; k <= i + 1; k++) {
      for (const o of c.chunk(k).obstacles) {
        // (A log is a segment: its ends and middle.)
        if (behind(o.x, o.z, o.r) || behind(o.x2, o.z2, o.r) || behind((o.x + o.x2) / 2, (o.z + o.z2) / 2, o.r)) return true;
      }
      for (const r of c.zones(k).ramps) if (behind(r.x, r.z + r.len, r.w / 2) || behind(r.x, r.z, r.w / 2)) return true;
    }
    return false;
  }

  /** Whether a rider at sim (x, z) is inside the corridor and clear of every hazard by a body's width. */
  private reelClear(x: number, z: number): boolean {
    const c = this.world.course;
    if (Math.abs(x - c.centerX(z)) > c.halfWidth(z) - 0.8) return false;
    // (64 m: the course chunk length, CHUNK_LEN.)
    const i = Math.floor(z / 64);
    for (let k = i - 1; k <= i + 1; k++) {
      if (k < 0) continue;
      for (const o of c.chunk(k).obstacles) {
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < (o.r + 0.85) * (o.r + 0.85)) return false;
      }
    }
    return true;
  }

  /** The tick at which a ghost's replay reaches course progress `z` (its z never falls), by bisection. */
  private tickAtZ(t: GhostManager['tracks'][number], z: number, lo = 0, hi = 60 * 60 * 6, steps = 20): number {
    const p = this.reelTmp;
    for (let k = 0; k < steps; k++) {
      const mid = (lo + hi) / 2;
      if (this.ghosts.pose(t, mid, p) && !p.done && p.z < z) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  private reelTmp = emptyPose();
  private reelHero = emptyPose();

  private frameTitle(dt: number): void {
    // Picking the hero also sets where the reel starts.
    if (this.attract.focus < 0) this.attract.focus = this.pickAttractHero();
    this.attract.tick += dt * 60;
    const tick = this.attract.tick;
    this.ghostPoses.clear();
    let focus: GhostPose | null = null;
    let focusId = -1;
    let allDone = this.ghosts.tracks.length > 0;
    // The duel partner rides level with the hero (pickReelMate): the moment of its own run that puts
    // it reelMate.lead metres ahead, so it keeps the hero's pace, eased across to reelMate.lat metres off the
    // hero's line where that is clear; after the hero's run it rides on alone, on its own line.
    let mateTick = -1;
    const hp = this.reelHero;
    let heroLive = false;
    if (reelMate.id >= 0) {
      const ht = this.ghosts.tracks.find((t) => t.entry.id === this.attract.focus);
      const mt = this.ghosts.tracks.find((t) => t.entry.id === reelMate.id);
      heroLive = !!ht && this.ghosts.pose(ht, tick, hp) && !hp.done;
      mateTick = mt && heroLive ? this.tickAtZ(mt, hp.z + reelMate.lead) : reelMate.tick + dt * 60;
      reelMate.tick = mateTick;
    }
    for (const t of this.ghosts.tracks) {
      const p = emptyPose();
      const mate = t.entry.id === reelMate.id && mateTick >= 0;
      if (this.ghosts.pose(t, mate ? mateTick : tick, p)) {
        if (mate) {
          // Where its spot at the hero's shoulder is blocked it holds its current offset if that is clear,
          // else rejoins its own line.
          const want = this.reelOffset(hp, p, reelMate.side);
          const off = !heroLive || p.done ? 0 : this.reelClear(p.x + want, p.z) ? want : !Number.isNaN(reelMate.off) && this.reelClear(p.x + reelMate.off, p.z) ? reelMate.off : 0;
          reelMate.off = dt === 0 || Number.isNaN(reelMate.off) ? off : reelMate.off + (off - reelMate.off) * (1 - Math.exp(-dt * 2.5));
          // Across the slope, at the same height over the snow.
          const c = this.world.course;
          p.y += c.ground(p.x + reelMate.off, p.z) - c.ground(p.x, p.z);
          p.x += reelMate.off;
        }
        this.ghostPoses.set(t.entry.id, p);
        if (!p.done) {
          allDone = false;
          const hero = focusId === this.attract.focus;
          if (!focus || (!hero && (t.entry.id === this.attract.focus || p.z > focus.z))) {
            focus = p;
            focusId = t.entry.id;
          }
        }
      } else {
        this.ghostPoses.set(t.entry.id, null);
        allDone = false;
      }
    }
    if (allDone || tick > 60 * 45) {
      this.ghosts.resetRace();
      this.world.ghosts.resetRun();
      this.world.trail.clear();
      // The next frame picks again, back to the same opening moment.
      this.attract.tick = REEL_START;
      this.attract.focus = -1;
    }
    const snap = this.view;
    if (focus) {
      // The hero is shown in full colour; the rest stay ghosts.
      this.ghostPoses.set(focusId, null);
      snap.x = focus.x;
      snap.y = focus.y;
      snap.z = focus.z;
      snap.heading = focus.heading;
      snap.airYaw = focus.airYaw;
      snap.airPitch = focus.airPitch;
      snap.lean = focus.lean;
      snap.speed = focus.speed;
      snap.vx = Math.sin(focus.heading) * focus.speed;
      snap.vz = Math.cos(focus.heading) * focus.speed;
      snap.vy = 0;
      snap.carve = focus.carve;
      snap.grounded = focus.grounded;
      snap.drifting = focus.drifting;
    } else {
      snap.z = 2 + this.time * 0.5;
      snap.x = this.world.course.safeX(snap.z);
      snap.y = this.world.course.ground(snap.x, snap.z);
      snap.speed = 0;
    }
    snap.crashed = false;
    this.world.frame({
      mode: 'title',
      snap,
      dt,
      time: this.time,
      events: [],
      collected: new Set(),
      destroyed: new Set(),
      sim: null,
      airTicks: 0,
      ghostPoses: this.ghostPoses,
      playerVisible: focus !== null,
    });
  }

  private frameRun(dt: number): void {
    const run = this.run;
    if (!run || !this.loop) return;
    const frozen = this.paused || this.adPlaying || this.ui.modal && this.phase === 'run';
    let alpha = 1;
    // Hit-stop and slow motion are the director's time scale. Only the real-time feed into the fixed
    // loop is scaled, so the simulation itself stays tick-exact.
    const time = this.director.time;
    time.step(frozen ? 0 : dt);
    if (!frozen && this.phase === 'run') alpha = this.loop.advance(dt * time.feed);
    lerpSnap(run.prev, run.cur, alpha, this.view);
    const sim = run.sim;
    // Render time runs at the director's render scale: a held frame also holds the shader bobs.
    const renderDt = frozen ? 0 : dt * time.render;
    this.renderTime += renderDt;
    // Ghosts keep riding past you while you tumble and read the results, on the scaled clock, so the
    // pack slows and holds with the crash beat and never jumps.
    if (this.phase !== 'run') this.crashTicks += renderDt * 60;
    const tick = this.phase === 'run' ? sim.tick - 1 + alpha : sim.tick + this.crashTicks;

    // Ghost poses and race events.
    this.ghostPoses.clear();
    for (const t of this.ghosts.tracks) {
      const p = emptyPose();
      this.ghostPoses.set(t.entry.id, this.ghosts.pose(t, tick, p) ? p : null);
    }
    const race: readonly RaceEvent[] = this.phase === 'run' ? this.ghosts.race(sim.tick, sim.s.z) : NO_RACE;
    for (const ev of race) this.onRace(ev);

    const drained = run.drain();
    const events = drained.map((p) => p.e);
    if (!sim.s.grounded) this.airTicks++;
    else this.airTicks = 0;
    // Standings once per frame: the world's rival, the HUD pill and the hints all read these.
    const st = this.ghosts.standings(sim.tick, sim.s.z);
    this.frameStandings = st;

    // The frame's named moments: the race's first, then the sim events' in order.
    const out = this.director.step({
      phase: this.phase === 'run' ? 'run' : 'crashed',
      dt: frozen ? 0 : dt,
      sim,
      events: drained,
      race,
      tracks: this.ghosts.tracks,
      poses: this.ghostPoses,
      // The rider as rendered, on the poses' render tick: the pill's gap no longer flickers.
      riderZ: this.view.z,
      standings: st,
      passedThisRun: this.passedThisRun.size,
      settledPassed: this.settlement?.passed ?? 0,
      timeToLand: this.world.landing.timeToLand,
      airTicks: this.airTicks,
      reduced: reduced(),
    });
    // Beats never touch the sim: their gifts go to passBonus (so live state matches replays). The
    // director already capped the extras (EXTRA_GIFTS_CAP), so each beat's gifts are what it pays.
    for (const b of out.beats) {
      switch (b.type) {
        case 'pass':
        case 'duel':
        case 'finale':
        case 'graveyard':
          this.passBonus += b.gifts;
          break;
        case 'grudgeSettled':
          // The grudge's premium, paid once at the settle (less what its passes already paid).
          this.passBonus += b.paid;
          this.grudgeBeaten = true;
          this.platform.happytime();
          break;
        case 'crash':
          this.lostCombo = b.stake;
          break;
        default:
          break;
      }
    }
    this.ui.beats(out.beats);
    // Before this frame's raw sounds, so streak and whisker data are known when they play.
    this.audio.beats(out.beats);
    for (const e of events) {
      this.audio.simEvent(e);
      this.onSimEvent(e);
    }

    this.world.frame({
      mode: this.phase === 'results' ? 'results' : 'run',
      labels: this.phase !== 'results',
      snap: this.view,
      dt: renderDt,
      time: this.renderTime,
      events,
      collected: sim.collected,
      destroyed: sim.destroyed,
      sim,
      airTicks: this.airTicks,
      ghostPoses: this.ghostPoses,
      playerVisible: true,
      occluders: this.ui.occluders(),
      // Where the HUD hung the avalanche mirror (top-centre, over its danger meter); null with no chase.
      mirror: this.ui.mirrorRect(),
      // The ghost the rival pill names.
      rival: this.phase === 'run' ? out.rival : null,
      beats: out.beats,
      feel: out.feel,
    });
    this.ui.setRiderScreen(this.world.riderScreen.x, this.world.riderScreen.y);
    this.ui.touchVisual(this.input.visual, this.input.mode === 'touch' && this.phase === 'run');

    if (this.phase === 'run' || this.phase === 'crashed') {
      const c = sim.combo;
      const av = sim.dyn.avalanche;
      const rv = out.rival;
      const rt = rv ? this.ghosts.tracks.find((t) => t.entry.id === rv.id) : undefined;
      const hm = out.hud;
      // gap: the director's held C12 number, the edge chip's too. hold: a duel's result holds the pill
      // on this ghost on the director's clock (RIVAL_HOLD_S), so the HUD gates other ghosts' flashes
      // on it (HudModel.nextGhost.hold, a contract amendment the HUD reads once it lands).
      const next: (NonNullable<HudModel['nextGhost']> & { hold?: boolean }) | null = rv && rt ? { name: rt.entry.name, kind: rt.entry.kind, gap: rv.gap, duel: hm.duel, hold: hm.hold } : null;
      this.ui.updateHud({
        score: sim.score,
        distance: sim.distance,
        gifts: sim.gifts + this.passBonus,
        combo: { active: c.active, pending: c.pending, mult: c.multiplier, chain: c.chain, timer: c.window > 0 ? c.timer / c.window : 0, stake: hm.stake, fuse: hm.fuse, pace: hm.pace },
        speed: sim.s.speed,
        nextGhost: next,
        // 'of N' is the whole field from the first ghost ready on (the pill shows from there), not the
        // count of tracks ready so far: those come ready over several seconds ("1st of 2", "of 4"...).
        place: { rank: st.rank, of: st.of > 1 ? Math.max(st.of, this.ghosts.fieldSize) : st.of },
        draft: sim.s.drafting ? sim.s.draftCharge : 0,
        driftTier: sim.s.drifting ? sim.s.driftTier : 0,
        danger: av.phase === 2 ? { kind: 'avalanche', gap: sim.s.z - av.z } : null,
        mood: this.chaos.mood,
        bestIn: hm.bestIn,
        countdown: hm.countdown,
      });
      const danger = av.phase === 2 ? Math.max(0, 1 - (sim.s.z - av.z) / 60) : sim.dyn.yeti.phase === 2 ? 0.5 : 0;
      const a = out.audio;
      const frame: AudioFrame = {
        speed: sim.s.speed,
        grounded: sim.s.grounded,
        carve: sim.s.carve,
        drifting: sim.s.drifting,
        slip: sim.s.slip,
        onIce: sim.s.onIce,
        boostGlow: sim.s.boostGlow,
        drafting: sim.s.drafting,
        comboChain: c.chain,
        comboMult: c.multiplier,
        intensity: intensity({
          speed: sim.s.speed,
          drafting: a.drafting,
          mult: c.multiplier,
          skillChain: a.skillChain,
          earnedFlow: a.earnedFlow,
          raceNear: a.race > 0,
          danger,
          eventRolled: this.chaos.event !== ChaosEvent.None,
          lift: a.lift,
          runTime: sim.tick / 60,
          countIn: a.countIn,
        }),
        danger,
        crashed: sim.s.crashed,
        flow: a.flow,
        driftCharge: a.driftCharge,
        skillMult: a.skillMult,
        race: a.race,
        duel: a.duel,
        shoulder: a.shoulder,
        fuse: a.fuse,
        streak: a.streak,
        countIn: a.countIn,
        choir: a.choir,
      };
      this.audio.update(frame, frozen ? 0 : dt);
      if (this.phase === 'run') this.updateHints(dt);
    }
  }

  /** Race bookkeeping only: what the director names, sounds and pays travels in its beats. (The
   *  'Beat your grudge ghost' mission counts the grudgeSettled beat, as the settlement does.) */
  private onRace(ev: RaceEvent): void {
    if (ev.type !== 'pass' || !ev.first) return;
    this.passedThisRun.add(ev.track.entry.id);
  }

  /** A sim event's game logic: the crash, onboarding, the event telegraph and the revive cut. */
  private onSimEvent(e: SimEvent): void {
    switch (e.type) {
      case 'land':
        if (e.quality === 'perfect') this.markHint('stomp');
        if (e.quality !== 'sketchy' && e.halfTurns >= 2) this.markHint('spin');
        if (e.quality !== 'sketchy' && e.flips >= 1) this.markHint('flip');
        break;
      case 'drift':
        if (e.phase === 'release') this.markHint('drift');
        break;
      case 'takeoff':
        if (e.kind === 'pop') this.markHint('pop');
        // Holding the button through a kicker's lip wastes its pop: taught on the next approach.
        if (e.kind === 'lip' && this.run) this.heldLip = this.run.sim.s.action;
        break;
      case 'style':
        if (e.kind === 'boostPop') {
          this.markHint('boostPop');
          this.heldLip = false;
        }
        break;
      case 'chaos':
        if (e.phase === 'warn') {
          this.ui.warn(EVENTS[e.event]?.warn ?? 'Something stirs', e.event);
          this.audio.ui('warn');
        }
        break;
      case 'crash':
        this.crashed();
        break;
      case 'revive':
        this.world.snapCamera(this.view);
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ onboarding

  private markHint(k: HintKind): void {
    const h = this.save.data.hints;
    h[k] = (h[k] ?? 0) + 1;
    if (this.hintShown === k) {
      this.ui.hint(null, this.input.mode);
      this.hintShown = null;
      this.hints.drop();
    }
  }

  /** A kicker's lip ahead on the line, within 1.2 s at this speed and inside its width. */
  private kickerAhead(sim: Sim): boolean {
    const s = sim.s;
    const reach = s.speed * 1.2;
    const ci = Math.floor(s.z / 64);
    for (let k = ci; k <= ci + 1; k++) {
      for (const r of sim.course.zones(k).ramps) {
        const lip = r.z + r.len - s.z;
        if (lip > 0 && lip <= reach && Math.abs(s.x - r.x) < r.w / 2) return true;
      }
    }
    return false;
  }

  private updateHints(dt: number): void {
    if (!this.save.data.settings.hints || !this.run) return;
    this.hintTimer += dt;
    const h = this.save.data.hints;
    const sim = this.run.sim;
    const s = sim.s;
    const ttl = this.world.landing.timeToLand;
    let draftTarget = false;
    if (this.hintTimer > 20 && (h.draft ?? 0) < 1 && this.ghosts.tracks.length) {
      const st = this.frameStandings ?? this.ghosts.standings(sim.tick, s.z);
      draftTarget = !!st.next && st.next.gap > 2 && st.next.gap < 25;
    }
    const hint = this.hints.step(
      {
        dt,
        timer: this.hintTimer,
        steered: this.input.steering,
        grounded: s.grounded,
        drifting: s.drifting,
        action: s.action,
        drafting: s.drafting,
        airTicks: this.airTicks,
        ttl,
        runs: this.save.data.runs,
        kickerAhead: s.grounded && (((h.pop ?? 0) >= 1 && (h.boostPop ?? 0) < 1) || this.heldLip) && this.kickerAhead(sim),
        heldLip: this.heldLip,
        draftTarget,
        // The avalanche banner, meter and rear-view mirror own the lower screen while it chases you.
        chased: sim.dyn.avalanche.phase === 1 || sim.dyn.avalanche.phase === 2,
      },
      h,
    );
    // Lessons learned by doing (steering while the steer hint is wanted; any slipstream).
    for (const k of hint.learned) h[k] = Math.max(1, h[k] ?? 0);
    // Steered and drifted once: the touch zone outlines fade out for good (the labels stay).
    const learned = (h.steer ?? 0) >= 1 && (h.drift ?? 0) >= 1;
    if (hint.show !== undefined) {
      this.hintShown = hint.show;
      this.hintLearned = learned;
      this.ui.hint(hint.show, this.input.mode, learned);
    } else if (learned !== this.hintLearned) {
      this.hintLearned = learned;
      this.ui.hint(this.hintShown, this.input.mode, learned);
    }
  }
}
