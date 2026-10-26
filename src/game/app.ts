import { AudioEngine, AudioFrame } from '../audio/engine';
import { ghostName } from '../bot/names';
import { getPlatform, Platform } from '../platform/platform';
import { AdPacing } from '../platform/pacing';
import { World, qualityFor, Tier } from '../render/world';
import { ChaosEvent, ChaosRoll, EVENTS, MOODS, Mood, eventInfo, moodInfo, rollChaos } from '../sim/chaos';
import { MOUNTAINS, MountainDef, biomeForSeed, dailyKey, dailyMountain } from '../sim/mountains';
import { Rng, hashString } from '../sim/prng';
import { RunRecord, recordFromString, recordToString } from '../sim/replay';
import { decodeLog } from '../sim/input';
import { SimEvent } from '../sim/sim';
import { SLEDS, sledById } from '../sim/sleds';
import { STYLE_LABEL } from '../sim/scoring';
import { UI } from '../ui/ui';
import { prewarmSledPortraits, setSledPortraits } from '../ui/menus';
import type { GhostKind, HintKind, ResultsModel, SettingsModel, StyleTone, TitleModel } from '../ui/contract';
import { PoolGhostData } from './ghostdata';
import { GhostEntry, GhostManager, GhostPose, emptyPose } from './ghosts';
import { InputController } from './input';
import { FixedLoop } from './loop';
import { RunSummary, missionViews } from './missions';
import { TierController, guessTier } from './quality';
import { Run, emptySnap, lerpSnap } from './run';
import { SaveStore } from './save';
import { Settlement, settleRun } from './settle';

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
  private reviveUsed = false;
  private doubled = false;
  private giftsPersisted = 0;
  private bestPersisted = false;
  private results: ResultsModel | null = null;
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
  private airTicks = 0;
  private hintTimer = 0;
  private hintShown: HintKind | null = null;
  private hintHold = 0;
  private hintLearned = false;
  private newBestThisRun = false;
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
    this.readChallenge();
    this.adblock = await this.platform.hasAdblock().catch(() => false);
    this.ui.setLoading(null);
    this.platform.loadingStop();
    this.refreshTitle();
    // Once the title has settled, the shop's portraits are drawn in the background (title only).
    window.setTimeout(() => prewarmSledPortraits(SLEDS.map((s) => s.id), this.save.data.sled, () => this.phase === 'title'), 1200);
    if (DEV_ON && DEV.has('autoride')) this.ride();
    // Fresh rivals for the Daily Mountain, generated by the bot in the worker.
    void this.ghosts.generatePool(this.daily.seed, 10, hashString(this.daily.tagline), 16, 60 * 60 * 3.5).then((g) => {
      this.dailyPool = g;
      this.dailyReady = true;
      if (this.phase === 'title') this.refreshTitle();
    });
  }

  // ------------------------------------------------------------------ wiring

  private wireInput(): void {
    this.input.onPress(() => {
      this.audio.unlock();
      if (this.ui.modal && this.phase !== 'results') return;
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

  private readChallenge(): void {
    const raw = this.platform.getInviteParam('c') ?? new URLSearchParams(location.search).get('c');
    if (!raw) return;
    try {
      const rec = recordFromString(raw);
      this.challenge = { record: rec, attempts: 0 };
      const m = MOUNTAINS.find((mm) => mm.seed === rec.seed);
      if (m) this.mountain = m;
    } catch (err) {
      console.warn('[challenge] bad link', err);
    }
  }

  // ------------------------------------------------------------------ title

  private enterTitle(): void {
    this.phase = 'title';
    this.paused = false;
    this.run = null;
    this.loop = null;
    this.world.setCourse(this.mountain.seed);
    this.world.setMood(Mood.None);
    this.audio.setScene('title');
    this.audio.setMood(Mood.None, biomeForSeed(this.mountain.seed));
    this.ui.hideHud();
    this.ui.hideResults();
    this.setAttractField();
    this.refreshTitle();
  }

  private setAttractField(): void {
    const pool = this.poolForMountain(this.mountain);
    // Mid-pool riders: stylish but clean, so the hero reel is carving and flying, not tumbling.
    const picks = pool.length ? [pool[Math.floor(pool.length * 0.6)], pool[Math.floor(pool.length * 0.72)], pool[Math.floor(pool.length * 0.84)]].filter(Boolean) : [];
    const entries = picks.map((g) => ({ name: g.name, kind: 'pool' as GhostKind, score: g.score, record: g.record }));
    this.ghosts.setField(entries);
    this.world.setGhostField(this.ghosts.tracks.map((t) => ({ id: t.entry.id, name: t.entry.name, kind: t.entry.kind })));
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

  private refreshTitle(): void {
    if (this.phase !== 'title') return;
    const d = this.save.data;
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
      daily: { key: this.daily.tagline, best: d.daily.key === this.daily.tagline ? d.daily.best : 0, ready: this.dailyReady },
      best: d.best[this.mountain.id]?.score ?? 0,
      wallet: d.gifts,
      sledName: sledById(d.sled).name,
      challenge: this.challenge
        ? { name: this.challenge.record.name, score: this.challenge.record.score, mountain: MOUNTAINS.find((m) => m.seed === this.challenge!.record.seed)?.name ?? 'a mountain' }
        : null,
      missions: missionViews(d.missions),
      inputMode: this.input.mode,
      firstVisit: d.runs === 0,
      master: d.settings.master,
      ghostsPassed: d.ghostsPassed,
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
    this.audio.ui('go');
    this.startRun();
  }

  private pickField(mood: Mood): Omit<GhostEntry, 'id'>[] {
    const d = this.save.data;
    const key = this.mountain.id === 'daily' ? `daily:${this.daily.tagline}` : this.mountain.id;
    const best = d.best[key]?.score ?? 0;
    const pool = this.poolForMountain(this.mountain);
    const count = 5 + moodInfo(mood).params.extraGhosts;
    const above = pool.filter((g) => g.score > best);
    let picks: PoolGhostData[];
    if (above.length >= count) {
      // The next few just above your best, spread so they are not all the same pace.
      const span = above.slice(0, Math.max(count, Math.min(above.length, count * 2)));
      picks = [];
      for (let i = 0; i < count; i++) picks.push(span[Math.floor((i * span.length) / count)]);
    } else picks = pool.slice(Math.max(0, pool.length - count));
    const kind: GhostKind = this.mountain.id === 'daily' ? 'daily' : 'pool';
    const out: Omit<GhostEntry, 'id'>[] = picks.map((g) => ({ name: g.name, kind, score: g.score, record: g.record }));
    const own = d.best[key];
    if (own?.record) out.push({ name: d.name, kind: 'you', score: own.score, record: own.record });
    const grudge = d.grudge[key];
    if (grudge?.record && !out.some((o) => o.record === grudge.record)) {
      const i = out.findIndex((o) => o.name === grudge.name);
      if (i >= 0) out.splice(i, 1);
      out.push({ name: grudge.name, kind: 'grudge', score: grudge.score, record: grudge.record });
    }
    if (this.challenge && this.challenge.record.seed === this.mountain.seed) {
      out.push({ name: this.challenge.record.name, kind: 'friend', score: this.challenge.record.score, record: recordToString(this.challenge.record) });
    }
    return out;
  }

  private startRun(): void {
    const d = this.save.data;
    this.ui.closeMenus();
    this.ui.hideTitle();
    this.ui.hideResults();
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
    const field = this.pickField(chaos.mood);
    this.ghosts.setField(field);
    this.world.setGhostField(this.ghosts.tracks.map((t) => ({ id: t.entry.id, name: t.entry.name, kind: t.entry.kind })));

    this.input.releaseAll();
    // Dev demo: the rider replays an expert pool run (for capturing showcase moments).
    let source: { sample(): { steer: number; action: boolean } } = this.input;
    let sled = d.sled;
    if (DEV_ON && DEV.has('demo')) {
      const pool = this.poolForMountain(this.mountain);
      const pick = pool[Math.max(0, pool.length - 1 - Number(DEV.get('demo')))];
      if (pick) {
        const rec = recordFromString(pick.record);
        const log = decodeLog(rec.inputs);
        let i = 0;
        source = { sample: () => { const b = log.inputs[Math.min(i++, log.inputs.length - 1)] ?? 4; return { steer: b & 15, action: (b & 16) !== 0 }; } };
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
        this.world.setGhostField(this.ghosts.tracks.map((t) => ({ id: t.entry.id, name: t.entry.name, kind: t.entry.kind })));
      }
    }
    this.run = new Run(this.mountain.seed, chaos, sled, source);
    this.run.draftProbe = this.ghosts.draftProbe;
    this.loop = new FixedLoop(() => this.run!.tick());
    this.world.beginRun(this.run.cur, chaos.event, sled);
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
    this.settlement = null;
    this.results = null;
    this.airTicks = 0;
    this.hintTimer = 0;
    this.hintShown = null;

    this.audio.setScene('run');
    this.audio.setMood(chaos.mood, biomeForSeed(this.mountain.seed));
    this.ui.showHud();
    if (chaos.mood !== Mood.None || chaos.event !== ChaosEvent.None) {
      const mi = moodInfo(chaos.mood);
      void this.ui.reveal({
        mood: { id: chaos.mood, name: mi.name, rule: mi.rule },
        event: chaos.event !== ChaosEvent.None ? { id: chaos.event, name: eventInfo(chaos.event).name } : null,
        reel: MOODS.map((m) => m.name),
      });
      this.audio.ui('reveal-land');
    }
    this.platform.gameplayStart();
  }

  private runAgain(): void {
    if (this.phase !== 'results' && this.phase !== 'crashed') return;
    this.finalizeRun();
    this.pacing.runEnded();
    if (this.platform.adsAvailable && this.pacing.shouldShowMidgame(Date.now())) {
      this.ui.hideResults();
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
      this.ui.hideResults();
      this.run.revive();
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
      this.audio.ui('coin');
    });
  }

  private shareChallenge(): void {
    if (!this.run) return;
    const rec = this.run.toRecord(this.save.data.name);
    const link = this.platform.inviteLink({ c: recordToString(rec) });
    const done = () => this.ui.toast('Challenge link copied', 'ghost', 'Send it to a friend to race your ghost');
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (this.platform.deviceType !== 'desktop' && nav.share) {
      nav.share({ title: 'Beat my Ghost Sled run', url: link }).catch(() => undefined);
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(done, () => this.ui.toast('Could not copy the link', 'info'));
    } else done();
  }

  // ------------------------------------------------------------------ results

  private crashed(): void {
    this.phase = 'crashed';
    this.crashTime = performance.now();
    this.platform.gameplayStop();
    this.ui.hint(null, this.input.mode);
    this.persistRun();
    setTimeout(() => {
      if (this.phase === 'crashed') this.showResults();
    }, 950);
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
    if (this.mountain.id === 'daily') d.daily = { key: this.daily.tagline, best: Math.max(d.daily.key === this.daily.tagline ? d.daily.best : 0, score) };
    d.stats.bestScore = Math.max(d.stats.bestScore, score);
    // A record needs one to beat: a first combo or jump is not news. (Also caught after a revive.)
    if (d.stats.bestCombo > 0 && sim.stats.bestCombo > d.stats.bestCombo) this.recordsThisRun.add('bestCombo');
    if (d.stats.longestAir > 0 && sim.stats.maxAirtime > d.stats.longestAir) this.recordsThisRun.add('maxAir');
    d.stats.bestCombo = Math.max(d.stats.bestCombo, sim.stats.bestCombo);
    d.stats.longestAir = Math.max(d.stats.longestAir, sim.stats.maxAirtime);
    d.stats.topSpeed = Math.max(d.stats.topSpeed, sim.stats.maxSpeed);
    // Grudge: the closest ghost that finished ahead of you comes back next time.
    const tick = sim.tick;
    let grudge: { name: string; score: number; record: string; gap: number } | null = null;
    for (const t of this.ghosts.tracks) {
      if (!t.ready || t.entry.kind === 'you') continue;
      const gap = this.ghosts.zAt(t, tick) - sim.distance;
      if (t.status === -1 && gap > 0 && (!grudge || gap < grudge.gap)) grudge = { name: t.entry.name, score: t.entry.score, record: t.entry.record, gap };
    }
    if (grudge) d.grudge[key] = { name: grudge.name, score: grudge.score, record: grudge.record };
    else if (this.grudgeBeaten) delete d.grudge[key];
    this.bestPersisted = true;
    this.save.flush();
  }

  private finalizeRun(): void {
    if (!this.run || !this.bestPersisted) return;
    this.bestPersisted = false;
  }

  private showResults(): void {
    if (!this.run) return;
    this.phase = 'results';
    const d = this.save.data;
    const sim = this.run.sim;
    // A revive and a second crash settle the same run again: settleRun credits only the difference.
    const settled = settleRun(d, this.summary(), this.settlement);
    this.settlement = settled.settlement;
    const missions = { views: settled.missions };
    if (settled.missionReward > 0) this.audio.ui('mission');
    const unlocked: string[] = [];
    const unlockedMountains: NonNullable<ResultsModel['unlockedMountains']> = [];
    for (const m of MOUNTAINS) {
      const before = settled.passedBefore;
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
    };
    this.ui.hideHud();
    this.ui.showResults(this.results);
    this.audio.setScene('results');
    this.audio.ui('results-stamp');
    if (this.newBestThisRun) this.audio.ui('new-best');
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
    // Hit-stop: time briefly thickens on a perfect landing. Only the real-time feed into the fixed
    // loop is scaled, so the simulation itself stays tick-exact.
    const scale = this.hitstop > 0 ? 0.35 : 1;
    this.hitstop = Math.max(0, this.hitstop - dt);
    if (!frozen && this.phase === 'run') alpha = this.loop.advance(dt * scale);
    lerpSnap(run.prev, run.cur, alpha, this.view);
    const sim = run.sim;
    // Ghosts keep riding past you while you tumble and read the results.
    const tick = this.phase === 'run' ? sim.tick - 1 + alpha : sim.tick + ((performance.now() - this.crashTime) / 1000) * 60;

    // Ghost poses and race events.
    this.ghostPoses.clear();
    for (const t of this.ghosts.tracks) {
      const p = emptyPose();
      this.ghostPoses.set(t.entry.id, this.ghosts.pose(t, tick, p) ? p : null);
    }
    if (this.phase === 'run') {
      for (const ev of this.ghosts.race(sim.tick, sim.s.z)) this.onRace(ev);
    }

    const events = run.drain().map((p) => p.e);
    // The sim emits a landing's trick styles before the land event itself; read the land first so
    // spin and flip callouts name this landing, not the previous one.
    for (const e of events) if (e.type === 'land') this.lastLand = { halfTurns: e.halfTurns, flips: e.flips };
    for (const e of events) this.onSimEvent(e);
    if (!sim.s.grounded) this.airTicks++;
    else this.airTicks = 0;

    this.world.frame({
      mode: this.phase === 'results' ? 'results' : 'run',
      labels: this.phase !== 'results',
      snap: this.view,
      dt: frozen ? 0 : dt,
      time: this.time,
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
      // The ghost the rival pill names (standings are cheap; the HUD reads them again below).
      rival: this.phase === 'run' ? ((n) => (n ? { id: n.track.entry.id, gap: n.gap } : null))(this.ghosts.standings(sim.tick, sim.s.z).next) : null,
    });
    this.ui.setRiderScreen(this.world.riderScreen.x, this.world.riderScreen.y);
    this.ui.touchVisual(this.input.visual, this.input.mode === 'touch' && this.phase === 'run');

    if (this.phase === 'run' || this.phase === 'crashed') {
      const st = this.ghosts.standings(sim.tick, sim.s.z);
      const c = sim.combo;
      const av = sim.dyn.avalanche;
      this.ui.updateHud({
        score: sim.score,
        distance: sim.distance,
        gifts: sim.gifts + this.passBonus,
        combo: { active: c.active, pending: c.pending, mult: c.multiplier, chain: c.chain, timer: c.window > 0 ? c.timer / c.window : 0 },
        speed: sim.s.speed,
        nextGhost: st.next ? { name: st.next.track.entry.name, kind: st.next.track.entry.kind, gap: st.next.gap } : null,
        place: { rank: st.rank, of: st.of },
        draft: sim.s.drafting ? sim.s.draftCharge : 0,
        driftTier: sim.s.drifting ? sim.s.driftTier : 0,
        danger: av.phase === 2 ? { kind: 'avalanche', gap: sim.s.z - av.z } : null,
        mood: this.chaos.mood,
      });
      const danger = av.phase === 2 ? Math.max(0, 1 - (sim.s.z - av.z) / 60) : sim.dyn.yeti.phase === 2 ? 0.5 : 0;
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
        intensity: Math.min(1, Math.max(0, (sim.s.speed - 10) / 34) * 0.55 + Math.min(1, c.multiplier / 8) * 0.3 + danger * 0.35 + (this.chaos.event !== ChaosEvent.None ? 0.05 : 0)),
        danger,
        crashed: sim.s.crashed,
      };
      this.audio.update(frame, frozen ? 0 : dt);
      if (this.phase === 'run') this.updateHints(dt);
    }
  }

  private onRace(ev: ReturnType<GhostManager['race']>[number]): void {
    const t = ev.track;
    if (ev.type === 'pass') {
      if (ev.first) {
        this.passedThisRun.add(t.entry.id);
        const bonus = (this.chaos.mood === Mood.Haunted ? 2 : 1) * (t.entry.kind === 'grudge' ? 10 : 5);
        this.passBonus += bonus;
        if (t.entry.kind === 'grudge' && !this.grudgeBeaten) {
          this.grudgeBeaten = true;
          this.platform.happytime();
          this.ui.toast('Grudge settled', 'grudge', `+${bonus} gifts`);
        }
        this.ui.ghostPass(t.entry.name, t.entry.kind, true);
        this.audio.ui('ghost-pass', this.passedThisRun.size);
      } else {
        this.ui.ghostPass(t.entry.name, t.entry.kind, true);
        this.audio.ui('ghost-pass', this.passedThisRun.size);
      }
    } else if (ev.type === 'passedBy') {
      this.ui.ghostPass(t.entry.name, t.entry.kind, false);
      this.audio.ui('ghost-passed-you');
    }
  }

  private styleTone(kind: string, points: number): StyleTone {
    if (kind === 'perfect') return 'perfect';
    if (points >= 300 || kind === 'flip' || kind === 'spin' || kind === 'yetiHop' || kind === 'avalanche') return 'big';
    return 'normal';
  }

  private onSimEvent(e: SimEvent): void {
    this.audio.simEvent(e);
    switch (e.type) {
      case 'style': {
        let label = STYLE_LABEL[e.kind];
        // Every number on a callout carries its label, and "x" is the combo multiplier's alone.
        if (e.kind === 'spin' && this.lastLand && this.lastLand.halfTurns > 0) label = `Spin ${this.lastLand.halfTurns * 180}`;
        if (e.kind === 'flip' && this.lastLand) label = ['Backflip', 'Double Backflip', 'Triple Backflip'][Math.max(1, this.lastLand.flips) - 1] ?? `${this.lastLand.flips} Backflips`;
        this.ui.popStyle(label, e.points, e.mult, this.styleTone(e.kind, e.points));
        break;
      }
      case 'land':
        this.lastLand = { halfTurns: e.halfTurns, flips: e.flips };
        if (e.quality === 'sketchy') this.ui.popStyle('Sketchy', 0, 1, 'lost');
        if (e.quality === 'perfect') {
          this.markHint('stomp');
          this.hitstop = 0.13;
        }
        break;
      case 'comboBank':
        this.ui.comboBank(e.points, e.mult);
        break;
      case 'comboLost':
        this.ui.popStyle('Combo lost', e.points, 1, 'lost');
        break;
      case 'drift':
        if (e.phase === 'release') this.markHint('drift');
        break;
      case 'takeoff':
        if (e.kind === 'pop') this.markHint('pop');
        break;
      case 'chaos':
        if (e.phase === 'warn') {
          this.ui.warn(EVENTS[e.event]?.warn ?? 'Something stirs', e.event);
          this.audio.ui('warn');
        } else if (e.phase === 'success') this.ui.toast('Outran the avalanche', 'info', '+2,000 style');
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

  private lastLand: { halfTurns: number; flips: number } | null = null;
  private hitstop = 0;

  // ------------------------------------------------------------------ onboarding

  private markHint(k: HintKind): void {
    const h = this.save.data.hints;
    h[k] = (h[k] ?? 0) + 1;
    if (this.hintShown === k) {
      this.ui.hint(null, this.input.mode);
      this.hintShown = null;
    }
  }

  private updateHints(dt: number): void {
    if (!this.save.data.settings.hints || !this.run) return;
    this.hintTimer += dt;
    const h = this.save.data.hints;
    const sim = this.run.sim;
    const steered = this.input.steering;
    let want: HintKind | null = null;
    if ((h.steer ?? 0) < 1 && this.hintTimer > 0.6) want = 'steer';
    if (steered && want === 'steer') {
      h.steer = 1;
      want = null;
    }
    if (!want && (h.drift ?? 0) < 2 && this.hintTimer > 6 && sim.s.grounded && !sim.s.drifting) want = 'drift';
    if (!want && (h.pop ?? 0) < 1 && sim.s.action && sim.s.grounded && !sim.s.drifting) want = 'pop';
    if (!sim.s.grounded && (h.stomp ?? 0) < 3 && this.world.landing.timeToLand < 1.2) want = 'stomp';
    if (!want && (h.draft ?? 0) < 1 && this.hintTimer > 20 && this.ghosts.tracks.length) {
      const st = this.ghosts.standings(sim.tick, sim.s.z);
      if (st.next && st.next.gap > 2 && st.next.gap < 25) want = 'draft';
    }
    if (sim.s.drafting) h.draft = 1;
    // The avalanche banner, meter and rear-view mirror own the lower screen while it chases you.
    const chased = sim.dyn.avalanche.phase === 1 || sim.dyn.avalanche.phase === 2;
    if (chased) want = null;
    // Hold a hint on screen for a beat so quick state changes never make it flicker.
    this.hintHold = Math.max(0, this.hintHold - dt);
    // Steered and drifted once: the touch zone outlines fade out for good (the labels stay).
    const learned = (h.steer ?? 0) >= 1 && (h.drift ?? 0) >= 1;
    // A hint the player is already doing goes at once, without the hold: steering, or a drift that is
    // under way (the drift is only counted on its release).
    const doing = (this.hintShown === 'steer' && steered) || (this.hintShown === 'drift' && sim.s.drifting);
    if (want !== this.hintShown && (this.hintHold <= 0 || chased || doing || want === null && this.hintShown === 'stomp')) {
      this.hintShown = want;
      this.hintHold = want ? 1.6 : 0;
      this.hintLearned = learned;
      this.ui.hint(want, this.input.mode, learned);
    } else if (learned !== this.hintLearned) {
      this.hintLearned = learned;
      this.ui.hint(this.hintShown, this.input.mode, learned);
    }
  }
}
