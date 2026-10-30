import { describe, expect, it } from 'vitest';
import { ChaosEvent } from '../src/sim/chaos';
import { burstName, DUEL_HOLD_MS, duelRoute, enqueueFlash, EVENT_TINY, FLOW_SNUFF_MS, GAP_DWELL_MS, gapShown, newsKey, OF_STABLE_MS, OF_WAIT_MS, pillGap, pillOwner, placeSettled, RANK_SETTLE_MS, rankSettled, releaseBand, RESULT_STALE_MS, resultStale, ScoreHold, shownScore, sideWord, SLUNG_KEY, type Waiting } from '../src/ui/hud';
import { landAt, MORE_MIN_PX, moreCue, RESULTS_TIMING, stampInView, type MoreBlock } from '../src/ui/results';

// The overlay's small decisions, away from the DOM: who may take the rival pill during a duel, the
// phone countdown chip's words, and where the results card's More cue goes.

describe('duelRoute', () => {
  it('gives every message the pill while no duel is open', () => {
    for (const t of ['pass', 'lost', 'news', 'call'] as const) expect(duelRoute(null, 'Mika', t)).toBe('pill');
  });

  it('keeps the pill on the duel ghost and sends other ghosts to the callout line', () => {
    expect(duelRoute('Mika', 'Mika', 'pass')).toBe('pill');
    expect(duelRoute('Mika', 'Mika', 'lost')).toBe('pill');
    expect(duelRoute('Mika', 'Tess', 'pass')).toBe('line');
    expect(duelRoute('Mika', 'Tess', 'lost')).toBe('line');
    expect(duelRoute('Mika', 'Tess', 'news')).toBe('line');
    // The start-line call keeps its turn.
    expect(duelRoute('Mika', 'Tess', 'call')).toBe('pill');
  });

  it("sends the duel ghost's own news to the callout line too (the unlock tease keyed to it)", () => {
    // '1 more ghost opens Ember Peak' came with 'Passed Your best', then the duel with your best opened:
    // it flashed in the duel pill with no name while the ring named Your best.
    expect(duelRoute('Noor Frostberg', 'Noor Frostberg', 'news')).toBe('line');
    expect(duelRoute(null, 'Noor Frostberg', 'news')).toBe('pill');
  });
});

describe('pillOwner', () => {
  it("keeps the pill on a resolved duel's ghost for its 1.5 s hold, then frees it", () => {
    const held = { name: 'Kai_on_Tour', until: 1000 + DUEL_HOLD_MS };
    expect(DUEL_HOLD_MS).toBe(1500);
    expect(pillOwner(null, held, 1000)).toBe('Kai_on_Tour');
    // 'Took back SparkleCedar' 0.8 s after 'Held off Kai_on_Tour' goes to the callout line.
    expect(duelRoute(pillOwner(null, held, 1800), 'SparkleCedar', 'pass')).toBe('line');
    expect(duelRoute(pillOwner(null, held, 1800), 'Kai_on_Tour', 'pass')).toBe('pill');
    expect(pillOwner(null, held, 1000 + DUEL_HOLD_MS)).toBeNull();
    // An open duel always owns it.
    expect(pillOwner('Mika', held, 1200)).toBe('Mika');
  });

  it('holds while the result still waits its turn under a banner, however long the banner stays', () => {
    // 'Held off RidgeUlla' at 9.37 s under the GRUDGE SETTLED banner: the wall-clock hold is long over
    // when the banner goes, but the result has not shown yet.
    const held = { name: 'RidgeUlla', until: 9370 + DUEL_HOLD_MS };
    expect(pillOwner(null, held, 11300, null, true)).toBe('RidgeUlla');
    expect(pillOwner(null, held, 11300, null, false)).toBeNull();
    // No duel yet: nothing holds.
    expect(pillOwner(null, { name: '', until: -1e9 }, 0, null, true)).toBeNull();
  });

  it("follows the director's duel-result hold when the game sends it", () => {
    // Slow motion stretches the director's 1.5 s in sim time past the HUD's wall clock: 'Triple pass
    // Your best' took the pill while the ring still named RidgeUlla.
    const held = { name: 'RidgeUlla', until: 1000 };
    expect(pillOwner(null, held, 1400, 'RidgeUlla')).toBe('RidgeUlla');
    expect(duelRoute(pillOwner(null, held, 1400, 'RidgeUlla'), 'Noor Frostberg', 'pass')).toBe('line');
    // Without it, the wall-clock copy.
    expect(pillOwner(null, held, 1400)).toBeNull();
    expect(pillOwner('Mika', held, 1400, 'RidgeUlla')).toBe('Mika');
  });
});

describe('resultStale', () => {
  it("lets a duel's result wait out a banner or two back to back, never a longer chain", () => {
    // Under GRUDGE SETTLED it showed 2.19 to 2.23 s after the duel ended; under GRUDGE SETTLED and then
    // 'Ember Peak unlocked' it comes about 5 s on.
    expect(resultStale(8830, 8830 + 2230)).toBe(false);
    expect(resultStale(8150, 8150 + 4970)).toBe(false);
    expect(resultStale(8830, 8830 + RESULT_STALE_MS)).toBe(false);
    // Cut by banner after banner, it played 6 s after the duel: by then it is dropped.
    expect(resultStale(8420, 8420 + 6010)).toBe(true);
    expect(RESULT_STALE_MS).toBeLessThan(6000);
  });
});

describe('burstName', () => {
  it('names your best for the rest of a slingshot burst once the burst passed it (C7)', () => {
    const b = { at: -1e9, you: '' };
    expect(burstName(b, 'Brave Rhea', 'pool', 6370)).toEqual({ raw: 'Brave Rhea', kind: 'pool' });
    expect(burstName(b, 'Noor Frostberg', 'you', 6570)).toEqual({ raw: 'Noor Frostberg', kind: 'you' });
    // 'Slung past 5 SparkleCedar' 60 ms later reads 'Slung past 5 Your best'.
    expect(burstName(b, 'SparkleCedar', 'grudge', 6630)).toEqual({ raw: 'Noor Frostberg', kind: 'you' });
    // The duel ghost keeps its own pass.
    expect(burstName(b, 'MarmotMateo', 'pool', 6700, 'MarmotMateo')).toEqual({ raw: 'MarmotMateo', kind: 'pool' });
    // A later burst starts clean.
    expect(burstName(b, 'Tess', 'pool', 6700 + 1600)).toEqual({ raw: 'Tess', kind: 'pool' });
  });
});

describe('enqueueFlash', () => {
  const w = (type: Waiting['type'], name: string, at: number, word?: string): Waiting => ({ type, name, at, word });

  it('plays a slingshot burst held behind a stamp as one growing count, in its place in the queue', () => {
    const pend: Waiting[] = [];
    enqueueFlash(pend, w('pass', 'RidgeUlla', 0, 'slung'));
    enqueueFlash(pend, w('lost', 'Tess', 20));
    enqueueFlash(pend, w('pass', 'MarmotMateo', 50, 'slung'));
    enqueueFlash(pend, w('pass', 'fjord348', 100, 'slung'));
    expect(pend.map((p) => p.name)).toEqual(['fjord348', 'Tess']);
    // A slung pass of a later burst is a burst of its own.
    enqueueFlash(pend, w('pass', 'Mila', 2000, 'slung'));
    expect(pend.map((p) => p.name)).toEqual(['Tess', 'Mila']);
  });

  it('replaces an older flash about the same ghost and keeps two at most, news going first', () => {
    const pend: Waiting[] = [];
    enqueueFlash(pend, w('pass', 'Tess', 0, 'passed'));
    enqueueFlash(pend, w('news', 'Mila', 10));
    enqueueFlash(pend, w('lost', 'Tess', 20));
    expect(pend.map((p) => `${p.type}:${p.name}`)).toEqual(['news:Mila', 'lost:Tess']);
    enqueueFlash(pend, w('pass', 'Kai', 30, 'passed'));
    expect(pend.map((p) => `${p.type}:${p.name}`)).toEqual(['lost:Tess', 'pass:Kai']);
  });

  it("never drops a duel's result to make room", () => {
    const pend: Waiting[] = [];
    enqueueFlash(pend, w('pass', 'RidgeUlla', 0, 'heldOff'));
    enqueueFlash(pend, w('pass', 'Tess', 10, 'passed'));
    enqueueFlash(pend, w('pass', 'Kai', 20, 'double'));
    expect(pend.map((p) => `${p.word}:${p.name}`)).toEqual(['heldOff:RidgeUlla', 'double:Kai']);
  });

  it('drops arriving news rather than a slingshot burst that passed your best (best-d s56)', () => {
    // Under GRUDGE SETTLED MarmotMateo: the burst (now 'Slung past 5 Your best') and the grudge's own
    // pass wait; then the unlock tease comes. It used to push the burst out, and played alone after.
    const pend: Waiting[] = [
      { type: 'pass', name: 'Your best', kind: 'you', word: 'slung', at: 6670, band: true },
      { type: 'pass', name: 'MarmotMateo', kind: 'grudge', word: 'slung', at: 6500, band: true },
    ];
    enqueueFlash(pend, { type: 'news', name: '', at: 6670, band: true });
    expect(pend.map((p) => p.name)).toEqual(['Your best', 'MarmotMateo']);
    // A plain pass arriving pushes out the oldest that is not your best's.
    enqueueFlash(pend, { type: 'pass', name: 'Tess', kind: 'pool', word: 'passed', at: 6800, band: true });
    expect(pend.map((p) => p.name)).toEqual(['Your best', 'Tess']);
  });
});

describe('sideWord', () => {
  it('words a waiting flash for the callout line as the pill would have said it', () => {
    const base = { name: 'RidgeUlla', raw: 'RidgeUlla', k: '', tail: '', strong: false };
    expect(sideWord({ ...base, type: 'pass', k: 'Passed', word: 'passed' })).toEqual({ text: 'Passed RidgeUlla', tone: 'normal', key: 'RidgeUlla', name: 'RidgeUlla' });
    expect(sideWord({ ...base, type: 'pass', k: 'Slung past 3', word: 'slung', strong: true })).toEqual({ text: 'Slung past 3 RidgeUlla', tone: 'big', key: SLUNG_KEY, name: 'RidgeUlla' });
    // Your own best keeps its words (C7) and its own case on the line.
    expect(sideWord({ ...base, type: 'lost', name: 'Your best', raw: 'Noor Frostberg' })).toEqual({ text: 'Your best passed you', tone: 'normal', key: 'Noor Frostberg', name: 'Your best' });
    expect(sideWord({ ...base, type: 'lost' }).text).toBe('RidgeUlla passed you');
    // News never shares a key with a pass word about the same ghost.
    const news = sideWord({ ...base, type: 'news', line: '1 more ghost opens Frostfang Glacier' });
    expect(news.text).toBe('1 more ghost opens Frostfang Glacier');
    expect(news.key).toBe(newsKey('RidgeUlla', news.text));
    expect(news.key).not.toBe('RidgeUlla');
  });
});

describe('releaseBand', () => {
  it('starts the stale clock of a flash that waited under a banner once the banner goes', () => {
    const under: Waiting = { type: 'pass', name: 'Your best', at: 100, band: true };
    const stamp: Waiting = { type: 'pass', name: 'Tess', at: 100 };
    releaseBand([under, stamp], 2300);
    expect(under.at).toBe(2300);
    expect(under.band).toBe(false);
    expect(stamp.at).toBe(100);
  });

  it('plays only the newest of the passes that waited under it, keeping other words', () => {
    const pend: Waiting[] = [
      { type: 'pass', name: 'TobogganTeo', word: 'slung', at: 0, band: true },
      { type: 'lost', name: 'Tess', at: 300, band: true },
      { type: 'pass', name: 'SparkleCedar', word: 'streak', at: 800, band: true },
    ];
    releaseBand(pend, 2900);
    expect(pend.map((p) => `${p.type}:${p.name}@${p.at}`)).toEqual(['lost:Tess@2900', 'pass:SparkleCedar@2900']);
  });

  it("plays a duel's result first, ahead of the newer plain pass that waited with it", () => {
    // s105-r2: 'Held off RidgeUlla' under GRUDGE SETTLED, then 'Slung past SparkleCedar'.
    const pend: Waiting[] = [
      { type: 'pass', name: 'SparkleCedar', word: 'passed', at: 0, band: true },
      { type: 'pass', name: 'RidgeUlla', word: 'heldOff', at: 130, band: true },
      { type: 'pass', name: 'SparkleCedar', word: 'slung', at: 1830, band: true },
    ];
    releaseBand(pend, 2230);
    expect(pend.map((p) => `${p.word}:${p.name}@${p.at}`)).toEqual(['heldOff:RidgeUlla@2230', 'slung:SparkleCedar@2230']);
  });

  it("keeps a lost duel's 'pulled away' first, though it is worded as news", () => {
    // ver-3: 'Your best pulled away' waited under a mission banner and was dropped as news once
    // 'Took back Your best' waited with it.
    const pend: Waiting[] = [
      { type: 'news', name: 'Your best', kind: 'you', at: 0, band: true, result: true },
      { type: 'pass', name: 'SparkleCedar', kind: 'pool', word: 'passed', at: 300, band: true },
      { type: 'news', name: '', at: 400, band: true },
    ];
    releaseBand(pend, 2600);
    expect(pend.map((p) => `${p.type}:${p.name}@${p.at}`)).toEqual(['news:Your best@2600', 'pass:SparkleCedar@2600']);
  });

  it("keeps your best's pass over a newer plain one (C7)", () => {
    const pend: Waiting[] = [
      { type: 'pass', name: 'Your best', kind: 'you', word: 'streak', at: 0, band: true },
      { type: 'pass', name: 'MarmotMateo', kind: 'pool', word: 'streak', at: 120, band: true },
    ];
    releaseBand(pend, 2000);
    expect(pend.map((p) => p.name)).toEqual(['Your best']);
  });

  it('drops news that waited under the banner when a pass waits too, and keeps it otherwise', () => {
    // best-d s60: '1 more ghost opens Ember Peak' played after the banner while its pass went stale.
    const pend: Waiting[] = [
      { type: 'pass', name: 'Your best', kind: 'you', word: 'slung', at: 0, band: true },
      { type: 'news', name: '', at: 10, band: true },
    ];
    releaseBand(pend, 2300);
    expect(pend.map((p) => `${p.type}:${p.name}`)).toEqual(['pass:Your best']);
    const alone: Waiting[] = [{ type: 'news', name: 'Tess', at: 10, band: true }];
    releaseBand(alone, 2300);
    expect(alone.map((p) => `${p.type}@${p.at}`)).toEqual(['news@2300']);
  });
});

describe('pillGap', () => {
  it("shows the game's held whole-metre gap unchanged, so the pill and the edge chip read alike", () => {
    // The chip rounds the same number: 'SparkleCedar 10 m behind' beside a chip reading '9 m' is gone.
    expect(pillGap(-9, 10, 0)).toBe(9);
    expect(pillGap(14, 13, 10)).toBe(14);
    expect(pillGap(13, 14, 10)).toBe(13);
  });

  it('holds a raw gap itself (C12) when the game sends one with a fraction', () => {
    expect(pillGap(5.52, 5)).toBe(gapShown(5.52, 5));
    expect(pillGap(-15.2, 13, GAP_DWELL_MS - 1)).toBe(13);
  });
});

describe('placeSettled', () => {
  it("waits for the field's count to hold before the place pill shows, or gives up waiting", () => {
    // '1st of 2' at 500 ms, then 'of 4', 'of 5', 'of 6' by 570 ms.
    expect(placeSettled(500, 570, 600)).toBe(false);
    expect(placeSettled(500, 570, 570 + OF_STABLE_MS)).toBe(true);
    // A count that keeps moving still shows by OF_WAIT_MS.
    expect(placeSettled(500, 500 + OF_WAIT_MS - 20, 500 + OF_WAIT_MS - 1)).toBe(false);
    expect(placeSettled(500, 500 + OF_WAIT_MS - 20, 500 + OF_WAIT_MS)).toBe(true);
    expect(OF_WAIT_MS).toBeLessThanOrEqual(1000);
  });
});

describe('rankSettled', () => {
  it('holds a new place for the settle, except the first place shown', () => {
    expect(RANK_SETTLE_MS).toBe(180);
    // A bunched pack swaps places every frame: a new place waits until it has held.
    expect(rankSettled(3, 1000, 1050, false)).toBe(false);
    expect(rankSettled(3, 1000, 1000 + RANK_SETTLE_MS - 1, false)).toBe(false);
    expect(rankSettled(3, 1000, 1000 + RANK_SETTLE_MS, false)).toBe(true);
    expect(rankSettled(-1, 1000, 1000, false)).toBe(true);
  });

  it("steps the place on a wreck pass's frame, so the chip and the pill agree", () => {
    // r2-rivals-05 f80: '1st of 8' beside 'SparkleCedar PASSED YOU', the chip reading '2nd' only at
    // f96. The standings crossed a frame or two before the wreck pass: on its frame the place shows.
    expect(rankSettled(1, 1000, 1033, true)).toBe(true);
    expect(rankSettled(1, 1033, 1033, true)).toBe(true);
  });
});

describe('gapShown', () => {
  it('rounds to whole metres, and moves only once the gap is a metre from the shown number', () => {
    expect(gapShown(5.4, Number.NaN)).toBe(5);
    expect(gapShown(5.52, 5)).toBe(5);
    expect(gapShown(5.48, 6)).toBe(6);
    expect(gapShown(5.7, 5)).toBe(5);
    expect(gapShown(5.99, 5)).toBe(5);
    expect(gapShown(6.0, 5)).toBe(6);
    expect(gapShown(4.3, 5)).toBe(5);
    expect(gapShown(4.0, 5)).toBe(4);
    expect(gapShown(12, 5)).toBe(12);
  });

  it('holds each number at least the dwell, so a 0.9 m jitter never shimmers', () => {
    expect(gapShown(15, 13, GAP_DWELL_MS - 1)).toBe(13);
    expect(gapShown(15, 13, GAP_DWELL_MS)).toBe(15);
    // The measured jitter (13.1 to 13.9 m every frame) holds one number.
    let shown = Number.NaN;
    let at = 0;
    let changes = 0;
    for (let f = 0; f < 120; f++) {
      const now = f * 16.7;
      const r = gapShown(13.5 + (f % 2 ? 0.42 : -0.42), shown, now - at);
      if (r !== shown) {
        if (Number.isFinite(shown)) changes++;
        shown = r;
        at = now;
      }
    }
    expect(changes).toBe(0);
  });
});

describe('ScoreHold', () => {
  it("keeps a cash-in's points out of the score until its figure lands, then shows the full total", () => {
    // bank3: 2,133 banked at a score of 2,700. The counter reads 567 until the figure lands.
    const h = new ScoreHold();
    h.hold(1, 2133);
    expect(shownScore(2700, h.held)).toBe(567);
    // The score keeps counting under the flight (the figure lands into 649, then 2,782).
    expect(shownScore(2782, h.held)).toBe(649);
    expect(h.release(1)).toBe(true);
    expect(shownScore(2782, h.held)).toBe(2782);
    // A second release, or one for a cash-in never held, changes nothing.
    expect(h.release(1)).toBe(false);
    expect(h.release(7)).toBe(false);
  });

  it('lets everything through at once for a newer cash-in or the HUD going, and never shows below 0', () => {
    const h = new ScoreHold();
    h.hold(1, 400);
    h.hold(2, 900);
    expect(h.held).toBe(1300);
    h.release(1);
    expect(h.held).toBe(900);
    h.hold(3, 50);
    expect(h.release()).toBe(true);
    expect(h.held).toBe(0);
    expect(h.release()).toBe(false);
    h.hold(4, -20);
    expect(h.held).toBe(0);
    expect(shownScore(100, 300)).toBe(0);
  });

  it('greys a snuffed flow for a short beat only', () => {
    expect(FLOW_SNUFF_MS).toBe(150);
  });
});

describe('EVENT_TINY', () => {
  it('names every event in one short word for the phone chip', () => {
    for (const e of [ChaosEvent.Avalanche, ChaosEvent.Yeti, ChaosEvent.GiftStorm, ChaosEvent.GhostTrain]) {
      expect(EVENT_TINY[e]).toMatch(/^[A-Z][a-z]+$/);
      expect(EVENT_TINY[e].length).toBeLessThanOrEqual(9);
    }
    expect(EVENT_TINY[ChaosEvent.GiftStorm]).toBe('Storm');
  });
});

describe('moreCue', () => {
  const view = { top: 17, bottom: 554, right: 1240 };
  const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });
  const mis: MoreBlock = { key: 'mis', r: box(562, 287, 864, 400) };
  const race: MoreBlock = { key: 'race', r: box(898, 287, 1239, 498) };
  const tipCut: MoreBlock = { key: 'tip', r: box(562, 516, 1238, 571) };
  const head = box(562, 287, 864, 330);

  it('stays out for a sliver (the desktop revive card cut by 17 px)', () => {
    expect(moreCue(17, view, [mis, race, tipCut], head, 89)).toBeNull();
    expect(moreCue(MORE_MIN_PX - 1, view, [mis, race, tipCut], head, 89)).toBeNull();
  });

  it('sits at the right end of the tip row when only the tip is cut, and says More', () => {
    const cue = moreCue(60, view, [mis, race, tipCut], head, 89);
    expect(cue).toEqual({ x: 1240 - 89 / 2, label: 'more' });
  });

  it('names the missions and sits on their column while their header is below the fold', () => {
    const low: MoreBlock = { key: 'mis', r: box(562, 560, 864, 700) };
    const cue = moreCue(200, view, [low, race, tipCut], box(562, 560, 864, 600), 89);
    expect(cue).toEqual({ x: 713, label: 'missions' });
  });

  it('says More over the column cut deepest once the missions header is in view', () => {
    const open: MoreBlock = { key: 'mis', r: box(562, 287, 864, 640) };
    const cue = moreCue(120, view, [open, race, tipCut], head, 89);
    expect(cue).toEqual({ x: 713, label: 'more' });
    const long: MoreBlock = { key: 'race', r: box(898, 287, 1239, 760) };
    expect(moreCue(220, view, [open, long, tipCut], head, 89)).toEqual({ x: 1068.5, label: 'more' });
  });
});

describe('stampInView', () => {
  const view = { left: 0, right: 390, top: 60, bottom: 700 };
  it('counts a Done stamp in the results body, and never one folded away or scrolled out', () => {
    expect(stampInView({ left: 20, right: 80, top: 300, bottom: 320 }, view)).toBe(true);
    // Folded away: no box at all.
    expect(stampInView({ left: 0, right: 0, top: 0, bottom: 0 }, view)).toBe(false);
    // Below the fold, or scrolled up past the top.
    expect(stampInView({ left: 20, right: 80, top: 760, bottom: 780 }, view)).toBe(false);
    expect(stampInView({ left: 20, right: 80, top: 40, bottom: 58 }, view)).toBe(false);
  });
});

describe('landAt', () => {
  it('matches the card timeline the sound cues read (a reward leaves at FLY_MS, 140 ms a row)', () => {
    expect(landAt(0)).toBe(RESULTS_TIMING.FLY_MS);
    expect(landAt(2) - landAt(0)).toBe(2 * RESULTS_TIMING.FLY_STEP);
  });
});
