// Internal contract between the platform facade and its two backends (mock, CrazyGames SDK).
//
// The facade owns everything that must survive a backend swap (listeners, gameplay/loading state,
// rate limits, the ad-in-progress guard), so each backend stays a thin, stateless-ish translator.

import type { PlatformKind, PlatformUser } from './platform';

export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type AdType = 'midgame' | 'rewarded';

/** ok only when adFinished fired; code mirrors the SDK adError codes (plus 'timeout'). */
export type AdOutcome = { ok: true } | { ok: false; code: string };

export interface PlatformStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Backends report through these; the facade dedupes and fans out to game listeners. */
export interface PlatformHooks {
  adPlaying(playing: boolean): void;
  settings(s: { muteAudio: boolean }): void;
}

export interface Backend {
  readonly kind: PlatformKind;
  readonly adsAvailable: boolean;
  readonly storage: PlatformStorage;
  readonly muteAudio: boolean;
  readonly locale: string;
  readonly deviceType: DeviceType;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  requestAd(type: AdType): Promise<AdOutcome>;
  hasAdblock(): Promise<boolean>;
  inviteLink(params: Record<string, string>): string;
  getInviteParam(name: string): string | null;
  getUser(): Promise<PlatformUser | null>;
}

/** One string per call so play-tests can match console messages exactly. */
export function log(msg: string): void {
  try {
    console.debug(`[platform] ${msg}`);
  } catch {
    // Console can be missing in exotic embeds; logging must never break the game.
  }
}

export function hasDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Query-string switch reader that tolerates a missing or exotic location object. */
export function urlParam(name: string): string | null {
  try {
    if (typeof location === 'undefined') return null;
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

/** Resolves to `fallback` when `p` rejects or takes longer than `ms`. Never rejects. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => finish(fallback), ms);
    function finish(v: T): void {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    }
    p.then(finish, () => finish(fallback));
  });
}
