import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrazySDK } from '../src/platform/crazygames';
import { PlatformFacade } from '../src/platform/facade';
import { AdPacing } from '../src/platform/pacing';
import { getPlatform } from '../src/platform/platform';

// Node environment: no DOM. The mock must run headless; location / localStorage are stubbed per test.

function stubLocation(url: string): void {
  const u = new URL(url);
  vi.stubGlobal('location', { href: u.href, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash });
}

class MemoryStorage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
}

/** console.debug messages from the platform layer, prefix stripped. */
function platformLog(): { lines: () => string[] } {
  const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  return {
    lines: () =>
      spy.mock.calls
        .map((c) => String(c[0]))
        .filter((s) => s.startsWith('[platform] '))
        .map((s) => s.slice('[platform] '.length)),
  };
}

type AdScript = (type: string, cb: { adStarted(): void; adFinished(): void; adError(e: { code: string; message: string }): void }) => void;

function fakeSdk(env: string, adScript?: AdScript) {
  const calls: string[] = [];
  const data = new Map<string, string>();
  let listener: ((s: { muteAudio: boolean; disableChat: boolean }) => void) | null = null;
  const settings = { muteAudio: false, disableChat: false };
  const sdk = {
    environment: env,
    init: async () => {
      calls.push('init');
    },
    game: {
      gameplayStart: () => calls.push('gameplayStart'),
      gameplayStop: () => calls.push('gameplayStop'),
      loadingStart: () => calls.push('loadingStart'),
      loadingStop: () => calls.push('loadingStop'),
      happytime: () => calls.push('happytime'),
      settings,
      addSettingsChangeListener: (l: typeof listener) => {
        listener = l;
      },
      removeSettingsChangeListener: () => {},
      inviteLink: (p: Record<string, string>) => {
        calls.push('inviteLink');
        return `https://www.crazygames.com/game/ghost-sled?${new URLSearchParams(p).toString()}`;
      },
      getInviteParam: (n: string) => (n === 'challenge' ? 'from-sdk' : null),
      inviteParams: null,
    },
    ad: {
      requestAd: (type: string, cb: Parameters<AdScript>[1]) => {
        calls.push(`requestAd ${type}`);
        (adScript ?? finishAfter(10))(type, cb);
      },
      hasAdblock: async () => true,
    },
    data: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
      clear: () => data.clear(),
    },
    user: {
      systemInfo: { countryCode: 'DE', locale: 'de-DE', device: { type: 'mobile' }, os: {}, browser: {}, applicationType: 'web' },
      isUserAccountAvailable: true,
      getUser: async () => ({ username: 'Sledder', profilePictureUrl: '' }),
    },
  };
  return {
    sdk: sdk as unknown as CrazySDK,
    raw: sdk,
    calls,
    data,
    setMute(m: boolean) {
      settings.muteAudio = m;
      listener?.({ ...settings });
    },
  };
}

function finishAfter(ms: number): AdScript {
  return (_type, cb) => {
    setTimeout(() => {
      cb.adStarted();
      setTimeout(() => cb.adFinished(), ms);
    }, 1);
  };
}

function errorWith(code: string, afterStart = false): AdScript {
  return (_type, cb) => {
    setTimeout(() => {
      if (afterStart) cb.adStarted();
      cb.adError({ code, message: code });
    }, 1);
  };
}

async function sdkFacade(env: string, adScript?: AdScript) {
  const fake = fakeSdk(env, adScript);
  const p = new PlatformFacade({ loadSdk: async () => fake.sdk });
  await p.init();
  return { p, ...fake };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AdPacing', () => {
  it('never shows a midgame during the first three runs', () => {
    const a = new AdPacing();
    expect(a.shouldShowMidgame(0)).toBe(false);
    a.runEnded();
    a.runEnded();
    expect(a.shouldShowMidgame(1e9)).toBe(false);
    a.runEnded();
    expect(a.shouldShowMidgame(0)).toBe(true);
    // Asking is free: no state changes until adShown.
    expect(a.shouldShowMidgame(0)).toBe(true);
  });

  it('after an ad needs both 4 more runs and 210 s', () => {
    const a = new AdPacing();
    for (let i = 0; i < 3; i++) a.runEnded();
    a.adShown(1000);
    for (let i = 0; i < 3; i++) a.runEnded();
    expect(a.shouldShowMidgame(1000 + 999999)).toBe(false); // runs short
    a.runEnded();
    expect(a.shouldShowMidgame(1000 + 209999)).toBe(false); // time short
    expect(a.shouldShowMidgame(1000 + 210000)).toBe(true);
    for (let i = 0; i < 10; i++) a.runEnded();
    expect(a.shouldShowMidgame(1000 + 210000)).toBe(true);
  });

  it('a rewarded ad resets the midgame clock and run count', () => {
    const a = new AdPacing();
    for (let i = 0; i < 5; i++) a.runEnded();
    expect(a.shouldShowMidgame(0)).toBe(true);
    a.adShown(50000); // revive
    a.runEnded();
    expect(a.shouldShowMidgame(500000)).toBe(false);
    for (let i = 0; i < 3; i++) a.runEnded();
    expect(a.shouldShowMidgame(50000 + 100000)).toBe(false);
    expect(a.shouldShowMidgame(50000 + 210000)).toBe(true);
  });

  it('respects custom options', () => {
    const a = new AdPacing({ minRunsBeforeFirst: 0, minRunsBetween: 1, minMsBetween: 10 });
    expect(a.shouldShowMidgame(0)).toBe(true);
    a.adShown(0);
    expect(a.shouldShowMidgame(100)).toBe(false);
    a.runEnded();
    expect(a.shouldShowMidgame(9)).toBe(false);
    expect(a.shouldShowMidgame(10)).toBe(true);
  });
});

describe('platform facade on the mock', () => {
  it('getPlatform is a lazy singleton and init falls back to the mock without a DOM', async () => {
    const p = getPlatform();
    expect(getPlatform()).toBe(p);
    await expect(p.init()).resolves.toBeUndefined();
    expect(p.kind).toBe('mock');
    expect(p.init()).toBe(p.init());
  });

  it('gameplayStart/Stop and loadingStart/Stop never repeat', () => {
    const log = platformLog();
    const p = new PlatformFacade();
    p.gameplayStop(); // stop before any start is dropped
    p.gameplayStart();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStop();
    p.gameplayStart();
    p.loadingStart();
    p.loadingStart();
    p.loadingStop();
    p.loadingStop();
    expect(log.lines()).toEqual(['gameplayStart', 'gameplayStop', 'gameplayStart', 'loadingStart', 'loadingStop']);
  });

  it('happytime is rate-limited to once per 120 s', () => {
    const log = platformLog();
    let now = 5000;
    const p = new PlatformFacade({ now: () => now });
    p.happytime();
    now += 60000;
    p.happytime();
    now += 59999;
    p.happytime();
    now += 1;
    p.happytime();
    expect(log.lines().filter((l) => l === 'happytime')).toHaveLength(2);
  });

  it('mock rewarded ad plays for 2 s, brackets onAdPlaying and pays out', async () => {
    vi.useFakeTimers();
    platformLog();
    const p = new PlatformFacade();
    expect(p.adsAvailable).toBe(true); // import.meta.env.DEV is true under vitest
    const seen: boolean[] = [];
    p.onAdPlaying((on) => seen.push(on));
    p.gameplayStart();
    const reward = p.requestRewarded();
    expect(seen).toEqual([true]);
    // A second request while one is running is refused, not queued.
    await expect(p.requestMidgame()).resolves.toBe('skipped');
    await vi.advanceTimersByTimeAsync(1999);
    expect(seen).toEqual([true]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(reward).resolves.toBe(true);
    expect(seen).toEqual([true, false]);
    const mid = p.requestMidgame();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(mid).resolves.toBe('shown');
  });

  it('requesting an ad stops gameplay first', async () => {
    vi.useFakeTimers();
    const log = platformLog();
    const p = new PlatformFacade();
    p.gameplayStart();
    const mid = p.requestMidgame();
    await vi.advanceTimersByTimeAsync(2000);
    await mid;
    p.gameplayStart();
    expect(log.lines().filter((l) => l.startsWith('gameplay'))).toEqual(['gameplayStart', 'gameplayStop', 'gameplayStart']);
  });

  it('a gameplayStart during an ad is held until the ad ends', async () => {
    vi.useFakeTimers();
    const log = platformLog();
    const gameplay = () => log.lines().filter((l) => l.startsWith('gameplay'));
    const p = new PlatformFacade();
    const mid = p.requestMidgame();
    // A caller that starts the next run without awaiting the ad.
    p.gameplayStart();
    p.gameplayStart();
    expect(gameplay()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(mid).resolves.toBe('shown');
    expect(gameplay()).toEqual(['gameplayStart']);
    // Start then stop inside an ad sends nothing at all.
    p.gameplayStop();
    const mid2 = p.requestMidgame();
    p.gameplayStart();
    p.gameplayStop();
    await vi.advanceTimersByTimeAsync(2000);
    await mid2;
    expect(gameplay()).toEqual(['gameplayStart', 'gameplayStop']);
  });

  it('?mockAdFail=1 starts the ad then fails without a reward', async () => {
    vi.useFakeTimers();
    platformLog();
    stubLocation('http://127.0.0.1:5173/?mockAdFail=1');
    const p = new PlatformFacade();
    const seen: boolean[] = [];
    p.onAdPlaying((on) => seen.push(on));
    const reward = p.requestRewarded();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(reward).resolves.toBe(false);
    expect(seen).toEqual([true, false]);
    const mid = p.requestMidgame();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(mid).resolves.toBe('error');
  });

  it('?mockAdFail=<code> fails before start; cooldown is a skip', async () => {
    vi.useFakeTimers();
    platformLog();
    stubLocation('http://127.0.0.1:5173/?mockAdFail=adCooldown');
    const p = new PlatformFacade();
    const seen: boolean[] = [];
    p.onAdPlaying((on) => seen.push(on));
    const mid = p.requestMidgame();
    await vi.advanceTimersByTimeAsync(500);
    await expect(mid).resolves.toBe('skipped');
    expect(seen).toEqual([]);
  });

  it('without dev mode or ?mockAds=1 ads are unavailable and resolve at once', async () => {
    vi.stubEnv('DEV', false);
    const p = new PlatformFacade();
    expect(p.adsAvailable).toBe(false);
    await expect(p.requestRewarded()).resolves.toBe(false);
    await expect(p.requestMidgame()).resolves.toBe('skipped');
    stubLocation('http://127.0.0.1:5173/?mockAds=1');
    expect(new PlatformFacade().adsAvailable).toBe(true);
  });

  it('storage works without localStorage and uses it when present', () => {
    const p = new PlatformFacade();
    p.storage.setItem('ghostsled.a', '1');
    expect(p.storage.getItem('ghostsled.a')).toBe('1');
    p.storage.removeItem('ghostsled.a');
    expect(p.storage.getItem('ghostsled.a')).toBeNull();
    const ls = new MemoryStorage();
    vi.stubGlobal('localStorage', ls);
    p.storage.setItem('ghostsled.b', '2');
    expect(ls.getItem('ghostsled.b')).toBe('2');
  });
});

describe('invite links (mock)', () => {
  beforeEach(() => stubLocation('https://games.example.test/ghost-sled/index.html?lang=en&challenge=old#frag'));

  it('round-trips params and keeps unrelated query params', () => {
    const p = new PlatformFacade();
    const value = 'AbC-_9 x&y=z/+ö';
    const link = p.inviteLink({ challenge: value, from: 'Rio' });
    expect(link.startsWith('https://games.example.test/ghost-sled/index.html?')).toBe(true);
    expect(link).not.toContain('#');
    const q = new URL(link).searchParams;
    expect(q.getAll('challenge')).toEqual([value]); // overrides, never duplicates
    expect(q.get('lang')).toBe('en');
    stubLocation(link);
    expect(p.getInviteParam('challenge')).toBe(value);
    expect(p.getInviteParam('from')).toBe('Rio');
    expect(p.getInviteParam('missing')).toBeNull();
  });

  it('falls back to hash params', () => {
    const p = new PlatformFacade();
    stubLocation('https://games.example.test/ghost-sled/#challenge=h1');
    expect(p.getInviteParam('challenge')).toBe('h1');
    stubLocation('https://games.example.test/ghost-sled/#?challenge=h2');
    expect(p.getInviteParam('challenge')).toBe('h2');
  });
});

describe('platform facade on the CrazyGames SDK', () => {
  it('falls back to the mock on disabled environment, null loader, init error or init hang', async () => {
    platformLog();
    expect((await sdkFacade('disabled')).p.kind).toBe('mock');
    const nullLoader = new PlatformFacade({ loadSdk: async () => null });
    await nullLoader.init();
    expect(nullLoader.kind).toBe('mock');
    const throwing = fakeSdk('crazygames');
    throwing.raw.init = () => {
      throw new Error('boom');
    };
    const t = new PlatformFacade({ loadSdk: async () => throwing.sdk });
    await t.init();
    expect(t.kind).toBe('mock');
    const hanging = fakeSdk('crazygames');
    hanging.raw.init = () => new Promise<void>(() => {});
    const h = new PlatformFacade({ loadSdk: async () => hanging.sdk, initTimeoutMs: 20 });
    await h.init();
    expect(h.kind).toBe('mock');
  });

  it('dedupes gameplay calls and replays loading state across the swap', async () => {
    platformLog();
    const fake = fakeSdk('crazygames');
    const p = new PlatformFacade({ loadSdk: async () => fake.sdk });
    p.loadingStart(); // before init: goes to the mock, then is replayed to the SDK
    await p.init();
    expect(p.kind).toBe('crazygames');
    p.loadingStop();
    p.gameplayStart();
    p.gameplayStart();
    p.gameplayStop();
    p.gameplayStop();
    expect(fake.calls).toEqual(['init', 'loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop']);
    expect(p.locale).toBe('de-DE');
    expect(p.deviceType).toBe('mobile');
    await expect(p.getUser()).resolves.toEqual({ username: 'Sledder' });
    await expect(p.hasAdblock()).resolves.toBe(true);
  });

  it('rewards only on adFinished and pauses only once the ad starts', async () => {
    platformLog();
    const ok = await sdkFacade('crazygames');
    const seen: boolean[] = [];
    ok.p.onAdPlaying((on) => seen.push(on));
    await expect(ok.p.requestRewarded()).resolves.toBe(true);
    expect(seen).toEqual([true, false]);

    const unfilled = await sdkFacade('crazygames', errorWith('unfilled'));
    const seen2: boolean[] = [];
    unfilled.p.onAdPlaying((on) => seen2.push(on));
    await expect(unfilled.p.requestRewarded()).resolves.toBe(false);
    await expect(unfilled.p.requestMidgame()).resolves.toBe('skipped');
    expect(seen2).toEqual([]);

    const broken = await sdkFacade('crazygames', errorWith('other', true));
    const seen3: boolean[] = [];
    broken.p.onAdPlaying((on) => seen3.push(on));
    await expect(broken.p.requestRewarded()).resolves.toBe(false);
    await expect(broken.p.requestMidgame()).resolves.toBe('error');
    expect(seen3).toEqual([true, false, true, false]);

    const cooldown = await sdkFacade('crazygames', errorWith('adCooldown'));
    await expect(cooldown.p.requestMidgame()).resolves.toBe('skipped');
  });

  it('gives up on an SDK that never answers, yet still brackets a late ad', async () => {
    vi.useFakeTimers();
    platformLog();
    const late: { cb: Parameters<AdScript>[1] | null } = { cb: null };
    const fake = fakeSdk('crazygames', (_t, cb) => {
      late.cb = cb;
    });
    const p = new PlatformFacade({ loadSdk: async () => fake.sdk });
    await p.init();
    const seen: boolean[] = [];
    p.onAdPlaying((on) => seen.push(on));
    const reward = p.requestRewarded();
    await vi.advanceTimersByTimeAsync(15000);
    await expect(reward).resolves.toBe(false);
    late.cb?.adStarted();
    late.cb?.adFinished();
    expect(seen).toEqual([true, false]);
  });

  it('a late-starting ad stops gameplay that is running and resumes it after', async () => {
    vi.useFakeTimers();
    platformLog();
    const late: { cb: Parameters<AdScript>[1] | null } = { cb: null };
    const fake = fakeSdk('crazygames', (_t, cb) => {
      late.cb = cb;
    });
    const p = new PlatformFacade({ loadSdk: async () => fake.sdk });
    await p.init();
    const mid = p.requestMidgame();
    await vi.advanceTimersByTimeAsync(15000);
    await expect(mid).resolves.toBe('error');
    p.gameplayStart(); // the next run begins
    late.cb?.adStarted();
    expect(fake.calls.filter((c) => c.startsWith('gameplay'))).toEqual(['gameplayStart', 'gameplayStop']);
    late.cb?.adFinished();
    expect(fake.calls.filter((c) => c.startsWith('gameplay'))).toEqual(['gameplayStart', 'gameplayStop', 'gameplayStart']);
  });

  it('forwards muteAudio from SDK settings', async () => {
    platformLog();
    const fake = fakeSdk('crazygames');
    fake.raw.game.settings.muteAudio = true;
    const p = new PlatformFacade({ loadSdk: async () => fake.sdk });
    const seen: boolean[] = [];
    p.onSettingsChange((s) => seen.push(s.muteAudio));
    await p.init();
    expect(p.muteAudio).toBe(true);
    fake.setMute(false);
    fake.setMute(false);
    expect(p.muteAudio).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('migrates ghostsled.* localStorage keys once, only into empty SDK data', async () => {
    platformLog();
    const ls = new MemoryStorage();
    ls.setItem('ghostsled.save', '{"best":1200}');
    ls.setItem('ghostsled.settings', '{"q":"high"}');
    ls.setItem('other.game', 'x');
    vi.stubGlobal('localStorage', ls);

    const fresh = await sdkFacade('crazygames');
    expect(fresh.data.get('ghostsled.save')).toBe('{"best":1200}');
    expect(fresh.data.get('ghostsled.settings')).toBe('{"q":"high"}');
    expect(fresh.data.has('other.game')).toBe(false);
    expect(fresh.p.storage.getItem('ghostsled.save')).toBe('{"best":1200}');

    // A reset after migration must not resurrect the stale local copy next session.
    fresh.p.storage.removeItem('ghostsled.save');
    fresh.p.storage.removeItem('ghostsled.settings');
    const again = new PlatformFacade({ loadSdk: async () => fresh.sdk });
    await again.init();
    expect(again.storage.getItem('ghostsled.save')).toBeNull();

    const synced = fakeSdk('crazygames');
    synced.data.set('ghostsled.save', '{"best":9000}');
    const s = new PlatformFacade({ loadSdk: async () => synced.sdk });
    await s.init();
    expect(synced.data.get('ghostsled.save')).toBe('{"best":9000}');
    expect(synced.data.has('ghostsled.settings')).toBe(false);
  });

  it('migrates even when SDK data answers undefined for missing keys', async () => {
    platformLog();
    const ls = new MemoryStorage();
    ls.setItem('ghostsled.save', '{"best":5}');
    vi.stubGlobal('localStorage', ls);
    const fake = fakeSdk('crazygames');
    fake.raw.data.getItem = (k: string) => fake.data.get(k) as unknown as string | null;
    const p = new PlatformFacade({ loadSdk: async () => fake.sdk });
    await p.init();
    expect(fake.data.get('ghostsled.save')).toBe('{"best":5}');
    expect(p.storage.getItem('ghostsled.missing')).toBeNull();
  });

  it('a failed SDK write reads back from the local fallback, not the stale SDK copy', async () => {
    platformLog();
    const ls = new MemoryStorage();
    vi.stubGlobal('localStorage', ls);
    const f = await sdkFacade('crazygames');
    f.p.storage.setItem('ghostsled.save', 'v1');
    const realSet = f.raw.data.setItem;
    f.raw.data.setItem = () => {
      throw new Error('quota');
    };
    f.p.storage.setItem('ghostsled.save', 'v2');
    expect(f.p.storage.getItem('ghostsled.save')).toBe('v2');
    f.raw.data.setItem = realSet;
    f.p.storage.setItem('ghostsled.save', 'v3');
    expect(f.data.get('ghostsled.save')).toBe('v3');
    expect(f.p.storage.getItem('ghostsled.save')).toBe('v3');
    expect(ls.getItem('ghostsled.save')).toBeNull();
  });

  it('uses SDK invite links live and location-built links locally', async () => {
    platformLog();
    stubLocation('http://localhost:5173/?challenge=from-url');
    const live = await sdkFacade('crazygames');
    expect(live.p.inviteLink({ challenge: 'abc' })).toBe('https://www.crazygames.com/game/ghost-sled?challenge=abc');
    expect(live.p.getInviteParam('challenge')).toBe('from-sdk');
    expect(live.p.getInviteParam('lang')).toBeNull();

    const local = await sdkFacade('local');
    expect(local.p.kind).toBe('crazygames-local');
    expect(local.p.inviteLink({ challenge: 'abc' })).toBe('http://localhost:5173/?challenge=abc');
    expect(local.p.getInviteParam('challenge')).toBe('from-url');
    expect(local.calls).not.toContain('inviteLink');
  });
});
