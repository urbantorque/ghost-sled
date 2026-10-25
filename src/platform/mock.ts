// Standalone backend: the game runs anywhere without the SDK. It logs SDK-like calls so play-tests
// can assert on them, fakes ads only when asked to, and keeps saves in localStorage.

import type { PlatformUser } from './platform';
import { type AdOutcome, type AdType, type Backend, type DeviceType, type PlatformHooks, type PlatformStorage, log, urlParam } from './backend';
import { confettiBurst, showAdOverlay } from './mockfx';

const MOCK_AD_MS = 2000;
const MOCK_FAIL_AFTER_START_MS = 800;
const MOCK_FAIL_BEFORE_START_MS = 150;

function devBuild(): boolean {
  try {
    return import.meta.env.DEV === true;
  } catch {
    // Plain Node (tsx scripts) has no import.meta.env.
    return false;
  }
}

/** localStorage when the browser lets us touch it; sandboxed iframes and privacy modes can throw. */
export function localStore(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' && localStorage ? localStorage : null;
  } catch {
    return null;
  }
}

/** localStorage with an in-memory fallback for keys that could not be written (quota, sandbox). */
export class SafeStorage implements PlatformStorage {
  private readonly memory = new Map<string, string>();

  getItem(k: string): string | null {
    const m = this.memory.get(k);
    if (m !== undefined) return m;
    const ls = localStore();
    if (!ls) return null;
    try {
      return ls.getItem(k);
    } catch {
      return null;
    }
  }

  setItem(k: string, v: string): void {
    const ls = localStore();
    if (ls) {
      try {
        ls.setItem(k, v);
        this.memory.delete(k);
        return;
      } catch {
        // Drop the stale persisted copy so it cannot shadow the newer in-memory value later.
        try {
          ls.removeItem(k);
        } catch {
          // ignore
        }
      }
    }
    this.memory.set(k, v);
  }

  removeItem(k: string): void {
    this.memory.delete(k);
    const ls = localStore();
    if (!ls) return;
    try {
      ls.removeItem(k);
    } catch {
      // ignore
    }
  }
}

/** origin + pathname + merged query (existing params kept, given ones override). Hash is dropped. */
export function buildInviteLink(params: Record<string, string>): string {
  try {
    if (typeof location === 'undefined') return '';
    const q = new URLSearchParams(location.search);
    for (const k of Object.keys(params)) q.set(k, params[k]);
    // file:// pages report origin 'null'; fall back to the bare href there.
    const base = location.origin && location.origin !== 'null' ? location.origin + location.pathname : location.href.split(/[?#]/)[0];
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  } catch {
    return '';
  }
}

/** Query string first, then the hash (accepts both '#k=v' and '#?k=v'). */
export function readInviteParam(name: string): string | null {
  try {
    if (typeof location === 'undefined') return null;
    const v = new URLSearchParams(location.search).get(name);
    if (v !== null) return v;
    const h = (location.hash || '').replace(/^#\??/, '');
    return h ? new URLSearchParams(h).get(name) : null;
  } catch {
    return null;
  }
}

export function guessLocale(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  } catch {
    // ignore
  }
  return 'en-US';
}

export function guessDeviceType(): DeviceType {
  try {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent || '';
    // iPadOS reports a Mac user agent; touch points give it away.
    const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
    if (iPad || /Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
      return Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'mobile';
    }
  } catch {
    // ignore
  }
  return 'desktop';
}

function isDeviceType(s: string | null): s is DeviceType {
  return s === 'desktop' || s === 'tablet' || s === 'mobile';
}

export class MockPlatform implements Backend {
  readonly kind = 'mock' as const;
  readonly storage: PlatformStorage = new SafeStorage();
  readonly adsAvailable: boolean;
  readonly muteAudio: boolean;
  readonly locale: string;
  readonly deviceType: DeviceType;
  /** null = ads succeed, '1' = start then fail, any other value = fail before start with that code. */
  private readonly failMode: string | null;
  private readonly user: string | null;

  constructor(private readonly hooks: PlatformHooks) {
    this.adsAvailable = urlParam('mockAds') === '1' || devBuild();
    this.failMode = urlParam('mockAdFail') || null;
    this.muteAudio = urlParam('mockMute') === '1';
    this.user = urlParam('mockUser') || null;
    const dev = urlParam('mockDevice');
    this.deviceType = isDeviceType(dev) ? dev : guessDeviceType();
    this.locale = guessLocale();
  }

  loadingStart(): void {
    log('loadingStart');
  }

  loadingStop(): void {
    log('loadingStop');
  }

  gameplayStart(): void {
    log('gameplayStart');
  }

  gameplayStop(): void {
    log('gameplayStop');
  }

  happytime(): void {
    log('happytime');
    confettiBurst();
  }

  requestAd(type: AdType): Promise<AdOutcome> {
    if (!this.adsAvailable) return Promise.resolve({ ok: false, code: 'adsDisabledBasicLaunch' });
    const fail = this.failMode;
    if (fail && fail !== '1') {
      return new Promise((resolve) => {
        setTimeout(() => {
          log(`adError ${fail} (mock)`);
          resolve({ ok: false, code: fail });
        }, MOCK_FAIL_BEFORE_START_MS);
      });
    }
    return new Promise((resolve) => {
      const close = showAdOverlay(type === 'rewarded' ? 'Rewarded' : 'Midgame', MOCK_AD_MS);
      log(`adStarted ${type} (mock)`);
      this.hooks.adPlaying(true);
      setTimeout(
        () => {
          close();
          this.hooks.adPlaying(false);
          if (fail) {
            log('adError other (mock)');
            resolve({ ok: false, code: 'other' });
          } else {
            log(`adFinished ${type} (mock)`);
            resolve({ ok: true });
          }
        },
        fail ? MOCK_FAIL_AFTER_START_MS : MOCK_AD_MS,
      );
    });
  }

  hasAdblock(): Promise<boolean> {
    return Promise.resolve(this.failMode === 'adblock');
  }

  inviteLink(params: Record<string, string>): string {
    return buildInviteLink(params);
  }

  getInviteParam(name: string): string | null {
    return readInviteParam(name);
  }

  getUser(): Promise<PlatformUser | null> {
    return Promise.resolve(this.user ? { username: this.user } : null);
  }
}
