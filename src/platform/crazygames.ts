// CrazyGames HTML5 SDK v3 backend. Constructed only after SDK.init() resolved in the 'crazygames'
// or 'local' environment. Every SDK touch is wrapped: a throwing SDK must never take the game down.

import type { PlatformUser } from './platform';
import { type AdOutcome, type AdType, type Backend, type DeviceType, type PlatformHooks, type PlatformStorage, hasDom, log, withTimeout } from './backend';
import { SafeStorage, buildInviteLink, guessDeviceType, guessLocale, localStore, readInviteParam } from './mock';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const LOAD_TIMEOUT_MS = 2500;
// Only guards against an SDK that never answers; real no-fill answers arrive far sooner.
const AD_START_TIMEOUT_MS = 15000;
const SAVE_PREFIX = 'ghostsled.';
const MIGRATED_KEY = 'ghostsled.migrated';

// Minimal ambient types: only what this file touches.
export interface CrazyAdError {
  code: string;
  message: string;
}

interface CrazyAdCallbacks {
  adStarted(): void;
  adFinished(): void;
  adError(error: CrazyAdError): void;
}

interface CrazySettings {
  muteAudio: boolean;
  disableChat: boolean;
}

interface CrazySystemInfo {
  countryCode: string;
  locale: string;
  device: { type: string };
  os: unknown;
  browser: unknown;
  applicationType: string;
}

export interface CrazySDK {
  init(): Promise<void>;
  /** 'local' | 'crazygames' | 'disabled' (meaningful after init). */
  readonly environment: string;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    readonly settings: CrazySettings;
    addSettingsChangeListener(listener: (s: CrazySettings) => void): void;
    removeSettingsChangeListener(listener: (s: CrazySettings) => void): void;
    inviteLink(params: Record<string, string>): string;
    getInviteParam(name: string): string | null;
    readonly inviteParams: Record<string, string> | null;
  };
  ad: {
    requestAd(type: AdType, callbacks: CrazyAdCallbacks): unknown;
    hasAdblock(): Promise<boolean>;
  };
  data: {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
    removeItem(k: string): void;
    clear(): void;
  };
  user: {
    readonly systemInfo: CrazySystemInfo;
    readonly isUserAccountAvailable: boolean;
    getUser(): Promise<{ username: string; profilePictureUrl: string } | null>;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySDK };
  }
}

function currentSdk(): CrazySDK | null {
  try {
    return (typeof window !== 'undefined' && window.CrazyGames?.SDK) || null;
  } catch {
    return null;
  }
}

/** Injects the SDK script (unless index.html already did) and resolves the SDK object, or null. */
export function loadCrazySdk(timeoutMs = LOAD_TIMEOUT_MS): Promise<CrazySDK | null> {
  if (!hasDom()) return Promise.resolve(null);
  const existing = currentSdk();
  if (existing) return Promise.resolve(existing);
  const load = new Promise<CrazySDK | null>((resolve) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => resolve(currentSdk());
    s.onerror = () => resolve(null);
    (document.head || document.documentElement).appendChild(s);
  });
  return withTimeout(load, timeoutMs, null);
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isDeviceType(s: unknown): s is DeviceType {
  return s === 'desktop' || s === 'tablet' || s === 'mobile';
}

/**
 * One-time copy of legacy 'ghostsled.*' localStorage saves into SDK data. A marker key makes it
 * one-time per SDK store, so a later progress reset cannot be undone by re-importing stale saves.
 */
export function migrateToSdkData(data: CrazySDK['data'], local: Storage | null): number {
  // Loose checks: an SDK build answering undefined for a missing key must not read as "has data".
  if (data.getItem(MIGRATED_KEY) != null) return 0;
  let copied = 0;
  if (local) {
    const keys: string[] = [];
    for (let i = 0; i < local.length; i++) {
      const k = local.key(i);
      if (k !== null && k.startsWith(SAVE_PREFIX) && k !== MIGRATED_KEY) keys.push(k);
    }
    if (!keys.some((k) => data.getItem(k) != null)) {
      for (const k of keys) {
        const v = local.getItem(k);
        if (v === null) continue;
        data.setItem(k, v);
        copied++;
      }
    }
  }
  data.setItem(MIGRATED_KEY, '1');
  return copied;
}

/** SDK data when it works (synced for logged-in players), else localStorage. */
function pickStorage(sdk: CrazySDK): PlatformStorage {
  const fallback = new SafeStorage();
  let data: CrazySDK['data'];
  try {
    data = sdk.data;
    data.getItem(MIGRATED_KEY);
  } catch {
    log('data module unavailable, using localStorage');
    return fallback;
  }
  try {
    const n = migrateToSdkData(data, localStore());
    if (n > 0) log(`migrated ${n} localStorage keys into SDK data`);
  } catch (e) {
    log(`migration failed: ${errText(e)}`);
  }
  // Keys whose newest value only reached the fallback; reads must prefer it over the stale SDK copy.
  const spilled = new Set<string>();
  return {
    getItem: (k) => {
      if (spilled.has(k)) return fallback.getItem(k);
      try {
        const v = data.getItem(k);
        return typeof v === 'string' ? v : null;
      } catch {
        return fallback.getItem(k);
      }
    },
    setItem: (k, v) => {
      try {
        data.setItem(k, v);
        if (spilled.delete(k)) fallback.removeItem(k);
      } catch (e) {
        // Most likely the 1 MB limit; keep the session working locally.
        log(`data.setItem ${k} failed: ${errText(e)}`);
        spilled.add(k);
        fallback.setItem(k, v);
      }
    },
    removeItem: (k) => {
      if (spilled.delete(k)) fallback.removeItem(k);
      try {
        data.removeItem(k);
      } catch {
        fallback.removeItem(k);
      }
    },
  };
}

export class CrazyGamesPlatform implements Backend {
  readonly kind: 'crazygames' | 'crazygames-local';
  readonly adsAvailable = true;
  readonly storage: PlatformStorage;
  readonly locale: string;
  readonly deviceType: DeviceType;
  /** Invite links only work on the live site; 'local' builds them from location like the mock. */
  private readonly live: boolean;

  constructor(
    private readonly sdk: CrazySDK,
    env: 'crazygames' | 'local',
    private readonly hooks: PlatformHooks,
  ) {
    this.live = env === 'crazygames';
    this.kind = this.live ? 'crazygames' : 'crazygames-local';
    let info: CrazySystemInfo | null = null;
    try {
      info = sdk.user.systemInfo;
    } catch {
      info = null;
    }
    this.locale = (info && typeof info.locale === 'string' && info.locale) || guessLocale();
    const dt = info?.device?.type;
    this.deviceType = isDeviceType(dt) ? dt : guessDeviceType();
    this.storage = pickStorage(sdk);
    try {
      sdk.game.addSettingsChangeListener((s) => hooks.settings({ muteAudio: !!s?.muteAudio }));
    } catch (e) {
      log(`addSettingsChangeListener failed: ${errText(e)}`);
    }
  }

  get muteAudio(): boolean {
    try {
      return !!this.sdk.game.settings.muteAudio;
    } catch {
      return false;
    }
  }

  loadingStart(): void {
    this.call('loadingStart', () => this.sdk.game.loadingStart());
  }

  loadingStop(): void {
    this.call('loadingStop', () => this.sdk.game.loadingStop());
  }

  gameplayStart(): void {
    this.call('gameplayStart', () => this.sdk.game.gameplayStart());
  }

  gameplayStop(): void {
    this.call('gameplayStop', () => this.sdk.game.gameplayStop());
  }

  happytime(): void {
    this.call('happytime', () => this.sdk.game.happytime());
  }

  requestAd(type: AdType): Promise<AdOutcome> {
    return new Promise<AdOutcome>((resolve) => {
      let settled = false;
      let started = false;
      const settle = (o: AdOutcome): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(o);
      };
      // Pause/mute only once the ad really plays, and always pair it with a resume.
      const end = (): void => {
        if (!started) return;
        started = false;
        this.hooks.adPlaying(false);
      };
      // A start that arrives after this still pauses the game through the hook; only the result is lost.
      const timer = setTimeout(() => {
        if (started) return;
        log(`requestAd ${type}: no answer, giving up`);
        settle({ ok: false, code: 'timeout' });
      }, AD_START_TIMEOUT_MS);
      const callbacks: CrazyAdCallbacks = {
        adStarted: () => {
          log(`adStarted ${type}`);
          clearTimeout(timer);
          started = true;
          this.hooks.adPlaying(true);
        },
        adFinished: () => {
          log(`adFinished ${type}`);
          end();
          settle({ ok: true });
        },
        adError: (error) => {
          const code = (error && typeof error.code === 'string' && error.code) || 'other';
          log(`adError ${type} ${code}`);
          end();
          settle({ ok: false, code });
        },
      };
      try {
        // Some SDK builds also return a promise; a rejection there is just another adError.
        const r = this.sdk.ad.requestAd(type, callbacks);
        // Duck-typed: a thenable from another realm or a polyfill must not leak an unhandled rejection.
        if (r && typeof (r as PromiseLike<unknown>).then === 'function') {
          Promise.resolve(r).catch((e: unknown) => callbacks.adError({ code: 'other', message: errText(e) }));
        }
      } catch (e) {
        callbacks.adError({ code: 'other', message: errText(e) });
      }
    });
  }

  async hasAdblock(): Promise<boolean> {
    try {
      return !!(await this.sdk.ad.hasAdblock());
    } catch {
      return false;
    }
  }

  inviteLink(params: Record<string, string>): string {
    if (this.live) {
      try {
        const link = this.sdk.game.inviteLink(params);
        if (typeof link === 'string' && link) return link;
      } catch (e) {
        log(`inviteLink failed: ${errText(e)}`);
      }
    }
    return buildInviteLink(params);
  }

  getInviteParam(name: string): string | null {
    if (this.live) {
      try {
        const v = this.sdk.game.getInviteParam(name);
        if (typeof v === 'string') return v;
      } catch {
        // fall through to the page URL
      }
    }
    return readInviteParam(name);
  }

  async getUser(): Promise<PlatformUser | null> {
    try {
      if (!this.sdk.user.isUserAccountAvailable) return null;
      const u = await this.sdk.user.getUser();
      return u && typeof u.username === 'string' ? { username: u.username } : null;
    } catch {
      return null;
    }
  }

  private call(name: string, fn: () => void): void {
    log(name);
    try {
      fn();
    } catch (e) {
      log(`${name} failed: ${errText(e)}`);
    }
  }
}
