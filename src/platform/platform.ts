// Platform layer: CrazyGames HTML5 SDK v3 with a standalone mock fallback.
//
// Every SDK call the game makes goes through this module, and only these, at these moments:
//
//   SDK.init()                       boot, once, via platform.init(). Script loaded dynamically
//                                    (2.5 s timeout), then init() (its own 3 s timeout); timeout,
//                                    load/init error or environment 'disabled' fall back to the
//                                    mock. Awaited before saves are read.
//   SDK.environment                  right after init, to pick 'crazygames' / 'crazygames-local'.
//   SDK.game.loadingStart()          after init, while the first course, sky and ghost pool build.
//   SDK.game.loadingStop()           when the title screen becomes interactive.
//   SDK.game.gameplayStart()         when a run starts, when Run Again starts the next one, and when
//                                    play resumes after a break (unpause, revive ad). Deduped.
//   SDK.game.gameplayStop()          on every break: crash or run end (results), pause menu, back to
//                                    title, and automatically before any ad request. Deduped. Never
//                                    on window blur; the platform handles focus itself. A start
//                                    asked for while an ad is pending or playing is held until the
//                                    ad ends, so the SDK never sees gameplay under an ad.
//   SDK.game.happytime()             new personal best (once per run) and beating the grudge ghost.
//                                    Rate-limited here to once per 120 s.
//   SDK.ad.requestAd('midgame')      only on the Run Again transition, gated by AdPacing (never in
//                                    the first 3 runs, at most once per 4 runs and 3.5 min) on top
//                                    of the SDK's own cooldown. adCooldown / unfilled are 'skipped'.
//   SDK.ad.requestAd('rewarded')     only when the player taps the optional Revive offer (one per
//                                    run). The reward is granted only on adFinished.
//                                    Audio mutes and the game pauses on adStarted (onAdPlaying(true))
//                                    and resumes on adFinished / adError (onAdPlaying(false)).
//   SDK.ad.hasAdblock()              when deciding whether to show the Revive offer at all.
//   SDK.data.getItem/setItem/removeItem
//                                    every save read/write through platform.storage. On first use,
//                                    'ghostsled.*' localStorage keys migrate in if SDK data has none.
//   SDK.game.settings.muteAudio      read at boot; overrides the in-game sound toggle.
//   SDK.game.addSettingsChangeListener
//                                    registered at init; pushes muteAudio changes to onSettingsChange.
//   SDK.game.inviteLink(params)      results screen "Challenge a friend" (live environment only;
//                                    local and mock build the link from location instead).
//   SDK.game.getInviteParam(name)    boot, to pick up a friend's challenge ghost (live only).
//   SDK.user.systemInfo              at init: locale and device type (touch layout, quality tier).
//   SDK.user.isUserAccountAvailable / getUser()
//                                    once after init, to label the player's own ghost.
//
// Dev URL switches (mock only): ?platform=mock skips the SDK; ?mockAds=1 enables mock ads outside
// dev; ?mockAdFail=1 makes ads start then fail, ?mockAdFail=<code> fails before start with that SDK
// code; ?mockMute=1, ?mockUser=<name>, ?mockDevice=desktop|tablet|mobile fake the rest.

import { PlatformFacade } from './facade';

export interface PlatformUser {
  username: string;
}

export type PlatformKind = 'crazygames' | 'crazygames-local' | 'mock';

export interface Platform {
  readonly kind: PlatformKind;
  /** Loads the SDK script dynamically (async, with a ~2.5 s timeout) and initialises it. Falls back to the mock on timeout, load error, init error or environment 'disabled'. Never rejects. */
  init(): Promise<void>;
  loadingStart(): void;
  loadingStop(): void;
  /** Idempotent: tracks state so the SDK never receives two starts or two stops in a row. */
  gameplayStart(): void;
  gameplayStop(): void;
  /** Rate-limited to once per 120 s. */
  happytime(): void;
  /** True when ads can be requested at all (live SDK, local SDK, or mock with ads enabled). */
  readonly adsAvailable: boolean;
  requestMidgame(): Promise<'shown' | 'skipped' | 'error'>;
  /** Resolves true only when adFinished fired. */
  requestRewarded(): Promise<boolean>;
  hasAdblock(): Promise<boolean>;
  /** Fires true when an ad actually starts playing, false when it finishes or errors. */
  onAdPlaying(cb: (playing: boolean) => void): void;
  readonly storage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  readonly muteAudio: boolean;
  onSettingsChange(cb: (s: { muteAudio: boolean }) => void): void;
  inviteLink(params: Record<string, string>): string;
  getInviteParam(name: string): string | null;
  readonly locale: string;
  readonly deviceType: 'desktop' | 'tablet' | 'mobile';
  getUser(): Promise<PlatformUser | null>;
}

let instance: Platform | null = null;

/** Singleton, created lazily. Usable before init() (as the mock); init() swaps in the SDK. */
export function getPlatform(): Platform {
  if (!instance) instance = new PlatformFacade();
  return instance;
}
