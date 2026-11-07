import { afterEach, describe, expect, it, vi } from 'vitest';

async function beat(): Promise<{ at: (t: number) => boolean }> {
  vi.resetModules();
  const timeline = { currentTime: 0 };
  vi.stubGlobal('document', { timeline });
  const { pageBeat } = await import('../src/ui/pagebeat');
  return {
    at: (t) => {
      timeline.currentTime = t;
      return pageBeat();
    },
  };
}

describe('the page beat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives everyone in a frame the same answer, however often they ask', async () => {
    const b = await beat();
    expect(b.at(1000)).toBe(true);
    expect(b.at(1000)).toBe(true);
    expect(b.at(1016.7)).toBe(false);
    expect(b.at(1016.7)).toBe(false);
  });

  it('lands on every third frame at 60 Hz, so two in three do no page work', async () => {
    const b = await beat();
    const on: boolean[] = [];
    for (let f = 0; f < 12; f++) on.push(b.at(1000 + f * (1000 / 60)));
    expect(on.filter(Boolean).length).toBe(4);
    expect(on.slice(0, 6)).toEqual([true, false, false, true, false, false]);
  });

  it('keeps time on a slow frame rate: every second frame at 40 fps', async () => {
    const b = await beat();
    const on: boolean[] = [];
    for (let f = 0; f < 8; f++) on.push(b.at(1000 + f * 25));
    expect(on).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('works where a page has no document timeline', async () => {
    vi.resetModules();
    vi.stubGlobal('document', {});
    const { pageBeat } = await import('../src/ui/pagebeat');
    expect(pageBeat()).toBe(true);
  });
});
