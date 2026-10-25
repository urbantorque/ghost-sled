// The one Platform instance the game talks to. It starts as the mock so the game can use it before
// init() settles, then swaps in the SDK backend. State that must survive the swap (and the rules the
// SDK cares about: no double starts/stops, ad-in-progress guard, happytime rate) lives here so both
// backends get it for free.

import type { Platform, PlatformKind, PlatformUser } from './platform';
import { type AdOutcome, type AdType, type Backend, type DeviceType, type PlatformHooks, type PlatformStorage, log, urlParam, withTimeout } from './backend';
import { MockPlatform } from './mock';
import { CrazyGamesPlatform, type CrazySDK, loadCrazySdk } from './crazygames';

const HAPPYTIME_MIN_MS = 120000;
const INIT_TIMEOUT_MS = 3000;
const ADBLOCK_TIMEOUT_MS = 3000;
const USER_TIMEOUT_MS = 4000;
// adError codes that mean "no ad right now" rather than "something broke".
const SKIP_CODES = new Set(['adCooldown', 'unfilled', 'adsDisabledBasicLaunch']);

export interface FacadeOptions {
  /** Resolves the SDK object, or null when it cannot be loaded. Tests inject a fake. */
  loadSdk?: () => Promise<CrazySDK | null>;
  initTimeoutMs?: number;
  /** Clock for the happytime rate limit. */
  now?: () => number;
}

type AdListener = (playing: boolean) => void;
type SettingsListener = (s: { muteAudio: boolean }) => void;

export class PlatformFacade implements Platform {
  /** Stable object so callers may hold on to it across the backend swap. */
  readonly storage: PlatformStorage;
  private impl: Backend;
  private readonly hooks: PlatformHooks;
  private readonly loadSdk: () => Promise<CrazySDK | null>;
  private readonly initTimeoutMs: number;
  private readonly now: () => number;
  private initPromise: Promise<void> | null = null;
  /** What the game last asked for. */
  private playing = false;
  /** What the backend last received; differs from `playing` only while an ad is pending or on. */
  private sentPlaying = false;
  private loading = false;
  private lastHappy = -Infinity;
  private adBusy = false;
  private adOn = false;
  private muted: boolean;
  private readonly adListeners: AdListener[] = [];
  private readonly settingsListeners: SettingsListener[] = [];

  constructor(opts: FacadeOptions = {}) {
    this.loadSdk = opts.loadSdk ?? (() => loadCrazySdk());
    this.initTimeoutMs = opts.initTimeoutMs ?? INIT_TIMEOUT_MS;
    // Monotonic, so a wall-clock jump back (NTP, manual change) cannot lock happytime out for hours.
    this.now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.hooks = {
      adPlaying: (p) => this.setAdPlaying(p),
      settings: (s) => this.setMuted(s.muteAudio),
    };
    this.impl = new MockPlatform(this.hooks);
    this.muted = this.impl.muteAudio;
    this.storage = {
      getItem: (k) => this.impl.storage.getItem(k),
      setItem: (k, v) => this.impl.storage.setItem(k, v),
      removeItem: (k) => this.impl.storage.removeItem(k),
    };
  }

  get kind(): PlatformKind {
    return this.impl.kind;
  }

  get adsAvailable(): boolean {
    return this.impl.adsAvailable;
  }

  get muteAudio(): boolean {
    return this.impl.muteAudio;
  }

  get locale(): string {
    return this.impl.locale;
  }

  get deviceType(): DeviceType {
    return this.impl.deviceType;
  }

  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.boot().catch(() => log('init: mock (unexpected error)'));
    return this.initPromise;
  }

  loadingStart(): void {
    if (this.loading) return;
    this.loading = true;
    this.impl.loadingStart();
  }

  loadingStop(): void {
    if (!this.loading) return;
    this.loading = false;
    this.impl.loadingStop();
  }

  gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    this.syncGameplay();
  }

  gameplayStop(): void {
    if (!this.playing) return;
    this.playing = false;
    this.syncGameplay();
  }

  happytime(): void {
    const t = this.now();
    if (t - this.lastHappy < HAPPYTIME_MIN_MS) return;
    this.lastHappy = t;
    this.impl.happytime();
  }

  async requestMidgame(): Promise<'shown' | 'skipped' | 'error'> {
    const r = await this.runAd('midgame');
    if (!r) return 'skipped';
    if (r.ok) return 'shown';
    return SKIP_CODES.has(r.code) ? 'skipped' : 'error';
  }

  async requestRewarded(): Promise<boolean> {
    const r = await this.runAd('rewarded');
    return r !== null && r.ok;
  }

  hasAdblock(): Promise<boolean> {
    try {
      return withTimeout(this.impl.hasAdblock(), ADBLOCK_TIMEOUT_MS, false);
    } catch {
      return Promise.resolve(false);
    }
  }

  onAdPlaying(cb: AdListener): void {
    this.adListeners.push(cb);
  }

  onSettingsChange(cb: SettingsListener): void {
    this.settingsListeners.push(cb);
  }

  inviteLink(params: Record<string, string>): string {
    return this.impl.inviteLink(params);
  }

  getInviteParam(name: string): string | null {
    return this.impl.getInviteParam(name);
  }

  getUser(): Promise<PlatformUser | null> {
    try {
      return withTimeout(this.impl.getUser(), USER_TIMEOUT_MS, null);
    } catch {
      return Promise.resolve(null);
    }
  }

  private async boot(): Promise<void> {
    if (urlParam('platform') === 'mock') {
      log('init: mock (forced by ?platform=mock)');
      return;
    }
    const sdk = await this.loadSdk().catch(() => null);
    if (!sdk) {
      log('init: mock (SDK unavailable)');
      return;
    }
    // The executor form also catches a synchronous throw from init().
    const initOk = await withTimeout(
      new Promise<void>((resolve) => resolve(sdk.init())).then(() => true),
      this.initTimeoutMs,
      false,
    );
    if (!initOk) {
      log('init: mock (SDK init failed or timed out)');
      return;
    }
    let env: string | undefined;
    try {
      env = sdk.environment;
    } catch {
      env = undefined;
    }
    if (env !== 'crazygames' && env !== 'local') {
      log(`init: mock (environment ${String(env)})`);
      return;
    }
    let next: Backend;
    try {
      next = new CrazyGamesPlatform(sdk, env, this.hooks);
    } catch {
      log('init: mock (SDK adapter failed)');
      return;
    }
    this.attach(next);
    log(`init: ${next.kind}`);
  }

  /** Swap backends, replaying the state the new one has not seen yet. */
  private attach(next: Backend): void {
    this.impl = next;
    if (this.loading) next.loadingStart();
    if (this.sentPlaying) next.gameplayStart();
    this.setMuted(next.muteAudio);
  }

  private async runAd(type: AdType): Promise<AdOutcome | null> {
    if (this.adBusy || this.adOn || !this.impl.adsAvailable) return null;
    this.adBusy = true;
    // An ad is a break: the SDK must never see gameplay running underneath it. The game calls
    // gameplayStart again when play actually resumes.
    this.gameplayStop();
    log(`requestAd ${type}`);
    try {
      return await this.impl.requestAd(type);
    } catch {
      return { ok: false, code: 'other' };
    } finally {
      this.adBusy = false;
      // Guarantees listeners always see a closing false, even if a backend forgot to send it.
      this.setAdPlaying(false);
      this.syncGameplay();
    }
  }

  /**
   * The SDK must never see gameplay running under an ad: a start asked for while an ad is pending
   * or playing is sent once it ends, and a late-starting ad stops gameplay that was already running.
   */
  private syncGameplay(): void {
    const want = this.playing && !this.adBusy && !this.adOn;
    if (want === this.sentPlaying) return;
    this.sentPlaying = want;
    if (want) this.impl.gameplayStart();
    else this.impl.gameplayStop();
  }

  private setAdPlaying(p: boolean): void {
    if (p === this.adOn) return;
    this.adOn = p;
    this.syncGameplay();
    for (const cb of this.adListeners.slice()) {
      try {
        cb(p);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private setMuted(m: boolean): void {
    if (m === this.muted) return;
    this.muted = m;
    for (const cb of this.settingsListeners.slice()) {
      try {
        cb({ muteAudio: m });
      } catch (e) {
        console.error(e);
      }
    }
  }
}
