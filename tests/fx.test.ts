import { describe, expect, it } from 'vitest';
import { BANK_CHIP_MS, BANK_MS, BANK_PEAK, BANK_ROLL_MS, BANK_T1, BANK_T2, BANK_T3, BANK_TICKS } from '../src/game/stake';
import { admit, CHIP_ABSORB_MS, CHIP_FADE_REDUCED_MS, chipFrames, CRACK_MS, crackFrames, crackSnapFrames, crackTier, HOLD_MS, LOW_FLOOR, LOW_GAP, LOW_MIN, queueFresh, raceHolds, SAME_FRAME_MS, sideAction, stampSpot, stepBackAt } from '../src/ui/fx';

// The one-line callout slot: a payoff line that has only just landed (New ground, New best, a trick)
// keeps the slot against a lower-ranked or 'lost' newcomer, which waits its turn instead of erasing it.

describe('admit', () => {
  it('holds a young New ground against a Sketchy landing, then lets it through', () => {
    const top = { tone: 'best' as const, born: 1000 };
    expect(admit(top, 'lost', 1200)).toBe('queue');
    expect(admit(top, 'lost', 1000 + HOLD_MS - 1)).toBe('queue');
    expect(admit(top, 'lost', 1000 + HOLD_MS)).toBe('show');
  });

  it('holds a young payoff line against lower and equal ranks', () => {
    const top = { tone: 'big' as const, born: 0 };
    expect(admit(top, 'lost', 100)).toBe('queue');
    expect(admit(top, 'normal', 100)).toBe('queue');
    // IN THE FLOW keeps its moment against SURVIVED WRECK HOLLOW 0.35 s later.
    expect(admit(top, 'big', 350)).toBe('queue');
    expect(admit(top, 'big', HOLD_MS)).toBe('show');
    // A higher rank still takes the slot (your best, the landing stamp).
    expect(admit(top, 'best', 100)).toBe('show');
    expect(admit(top, 'perfect', 100)).toBe('show');
  });

  it('holds New ground against a New best in the same frame or the next', () => {
    const top = { tone: 'best' as const, born: 0 };
    expect(admit(top, 'best', 0)).toBe('queue');
    expect(admit(top, 'best', 25)).toBe('queue');
    expect(admit(top, 'lost', 1)).toBe('queue');
    expect(admit(top, 'best', HOLD_MS)).toBe('show');
  });

  it('never holds a plain or lost line, an empty slot, or against a crash', () => {
    expect(admit(null, 'lost', 0)).toBe('show');
    expect(admit({ tone: 'normal', born: 0 }, 'lost', 10)).toBe('show');
    expect(admit({ tone: 'lost', born: 0 }, 'lost', 10)).toBe('show');
    expect(admit({ tone: 'best', born: 0 }, 'lost', 10, true)).toBe('show');
  });

  it('lets the later beat of one frame take the slot (a sketchy landing spin, then Streak broken)', () => {
    const top = { tone: 'big' as const, born: 500 };
    expect(admit(top, 'lost', 500)).toBe('show');
    expect(admit(top, 'lost', 500 + SAME_FRAME_MS - 1)).toBe('show');
    expect(admit(top, 'lost', 500 + SAME_FRAME_MS)).toBe('queue');
  });

  it("lets a landing's two tricks of one frame replace each other (the stamp names both)", () => {
    expect(admit({ tone: 'big', born: 500 }, 'big', 500 + SAME_FRAME_MS - 1)).toBe('show');
  });

  it('keeps the hold about 600 ms', () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(500);
    expect(HOLD_MS).toBeLessThanOrEqual(700);
  });

  it("holds 'In the flow' over your best's lines, and never makes it wait (it comes forced)", () => {
    const flow = { tone: 'big' as const, born: 0, flow: true };
    // New ground 0.2 s after IN THE FLOW waits its turn; before, its 'best' rank took the slot.
    expect(admit(flow, 'best', 200)).toBe('queue');
    expect(admit({ tone: 'big', born: 0 }, 'best', 200)).toBe('show');
    expect(admit(flow, 'big', 200)).toBe('queue');
    expect(admit(flow, 'best', HOLD_MS)).toBe('show');
    // The stamp and a crash's lost combo still take it.
    expect(admit(flow, 'perfect', 100)).toBe('show');
    expect(admit(flow, 'lost', 100, true)).toBe('show');
    // Over a young Whisker it is forced: no queue.
    expect(admit({ tone: 'big', born: 0 }, 'big', 100, true)).toBe('show');
  });
});

describe('chipFrames', () => {
  const offsets = (k: Keyframe[]) => k.map((f) => f.offset);
  it('slams the chip in by the roll start and absorbs it within CHIP_ABSORB_MS of it', () => {
    for (const tier of [1, 2, 3] as const) {
      const C = BANK_CHIP_MS;
      const T = BANK_MS[tier];
      const k = chipFrames(C, T);
      expect(offsets(k)).toEqual([0, (C * 0.75) / T, C / T, (C + CHIP_ABSORB_MS) / T, 1]);
      // Full strength from the slam to the roll's start, gone at the end of the absorb.
      expect(k[2].opacity).toBe(1);
      expect(k[3].opacity).toBe(0);
      expect(k[4].opacity).toBe(0);
      // Gone long before the figure lands (the old hold ran to the landing, minus 20 ms).
      expect(C + CHIP_ABSORB_MS).toBeLessThan(C + BANK_ROLL_MS[tier]);
      // By the roll's second tick the chip is most of the way into the figure.
      const second = C + BANK_ROLL_MS[tier] / BANK_TICKS[tier];
      expect(second - C).toBeGreaterThanOrEqual(CHIP_ABSORB_MS / 3);
      // Reduced motion fades it linearly, so it is gone by the second tick.
      const r = chipFrames(C, T, CHIP_FADE_REDUCED_MS);
      expect(r[3].offset).toBe((C + CHIP_FADE_REDUCED_MS) / T);
      expect(C + CHIP_FADE_REDUCED_MS).toBeLessThanOrEqual(second);
    }
    expect(CHIP_ABSORB_MS).toBe(120);
  });
});

describe('crack', () => {
  it('grades a lost combo by its stake with the cash-in thresholds', () => {
    expect(crackTier(300)).toBe(0);
    expect(crackTier(BANK_T1 - 1)).toBe(0);
    expect(crackTier(BANK_T1)).toBe(1);
    // rivals-crash: a 4,205 loss is a tier-1 crack, held 800 ms.
    expect(crackTier(4205)).toBe(1);
    expect(CRACK_MS[crackTier(4205)]).toBe(800);
    expect(crackTier(BANK_T2)).toBe(2);
    expect(crackTier(BANK_T3)).toBe(3);
    expect(CRACK_MS).toEqual([600, 800, 1000, 1200]);
  });

  it('punches to its peak in the first 15%, holds grey, then falls in the last 510 ms', () => {
    for (const tier of [0, 1, 2, 3] as const) {
      const ms = CRACK_MS[tier];
      const k = crackFrames(BANK_PEAK[tier], ms);
      const peak = k.find((f) => String(f.transform).includes(`scale(${BANK_PEAK[tier].toFixed(2)})`));
      expect(peak?.offset).toBeLessThan(0.15);
      const end = k[k.length - 1];
      expect(end.offset).toBe(1);
      expect(end.opacity).toBe(0);
      // The fall starts 510 ms before the end (at the punch's end at tier 0, as before: 0.15 to 1).
      const still = k.filter((f) => String(f.transform).includes('rotate(0deg)'));
      const fallAt = Math.max(...still.map((f) => Number(f.offset)));
      expect(fallAt * ms).toBeCloseTo(Math.max(0.15 * ms, ms - 510), 6);
      // Offsets climb.
      for (let i = 1; i < k.length; i++) expect(Number(k[i].offset)).toBeGreaterThanOrEqual(Number(k[i - 1].offset));
      // The grey snaps in only once the punch is spent.
      const g = crackSnapFrames(ms);
      expect(g[1]).toEqual({ opacity: 0, offset: 0.15 });
      expect(Number(g[2].offset)).toBeGreaterThan(0.15);
      expect(g[2].opacity).toBe(1);
    }
    // Tier 0 keeps the old 600 ms life and its fall's midpoint (0.55).
    const t0 = crackFrames(BANK_PEAK[0], 600);
    expect(t0.find((f) => String(f.transform).includes('rotate(3.5deg)'))?.offset).toBeCloseTo(0.55, 6);
  });
});

describe('stampSpot', () => {
  // A 390 x 844 phone: the rider's head point near 443 px, the thumbs' zone from 658 px, the
  // bottom-centre pill row at 610 to 644 px.
  const phone = { vw: 390, vh: 844, room: { left: 12, right: 378, top: 260 }, u: 14, rx: 195, ry: 443 };
  const spot = (subRows: number, bottom: number | null = null, ry = phone.ry) => stampSpot(phone.vw, phone.vh, phone.room, phone.u, phone.rx, ry, subRows, bottom);

  it('seats the phone stamp under the rider, clear of the sled, above the thumbs, never over the head', () => {
    const s = spot(1);
    expect(s.low).toBe(true);
    expect(s.top).toBeCloseTo(phone.ry + LOW_GAP * phone.vh, 6);
    expect(s.top).toBeGreaterThan(phone.ry);
    // Its foot (the tilt's low end included) stays above the thumbs' zone.
    const foot = s.top + (1.1 + 0.75) * s.f + 0.035 * s.w;
    expect(foot).toBeLessThanOrEqual(LOW_FLOOR * phone.vh);
    expect(s.cx).toBe(phone.rx);
    expect(s.f).toBeCloseTo(Math.min(Math.max(24, 2.12 * phone.u), 38, 366 / 12.4), 6);
  });

  it('shrinks a two-row stamp to fit under the rider, down to LOW_MIN', () => {
    const one = spot(1);
    const two = spot(2);
    expect(two.low).toBe(true);
    expect(two.f).toBeLessThan(one.f);
    expect(two.f).toBeGreaterThanOrEqual(LOW_MIN * one.f);
    expect(two.top + (1.1 + 1.5) * two.f + 0.035 * two.w).toBeLessThanOrEqual(LOW_FLOOR * phone.vh);
  });

  it('goes back above the head at LOW_MIN when the band is too short (a pill showing in it)', () => {
    const full = spot(1);
    const s = spot(1, 610);
    expect(s.low).toBe(false);
    expect(s.f).toBeCloseTo(LOW_MIN * full.f, 6);
    expect(s.top + 1.85 * s.f).toBeLessThanOrEqual(phone.ry);
    // A rider low on the screen has no band either.
    expect(spot(1, null, 600).low).toBe(false);
  });

  it('leaves landscape exactly where it was', () => {
    const room = { left: 24, right: 1256, top: 190 };
    const s = stampSpot(1280, 720, room, 18, 640, 430, 1, 300);
    const f = Math.min(Math.max(24, 2.12 * 18), 38, (room.right - room.left) / 12.4);
    const w = 12.4 * f;
    const hgt = (1.1 + 0.75) * f;
    expect(s).toEqual({ cx: Math.max(room.left + w / 2, Math.min(room.right - w / 2, 640 + 0.19 * 1280)), top: Math.max(room.top, 430 - 0.13 * 720 - hgt), w, f, low: false });
  });
});

describe('sideAction', () => {
  it('holds a race word on the side line against the next one, which waits its turn', () => {
    const top = { race: 'fjord348', born: 8267 };
    // 'Passed MarmotMateo' 130 ms after 'Took back fjord348' waits, then shows.
    expect(sideAction(top, 'MarmotMateo', 8400)).toBe('queue');
    expect(sideAction(top, 'MarmotMateo', 8267 + HOLD_MS)).toBe('show');
  });

  it('grows a slingshot burst (or a newer word about the same ghost) in place', () => {
    expect(sideAction({ race: 'slung', born: 0 }, 'slung', 33)).toBe('replace');
    expect(sideAction({ race: 'Tess', born: 0 }, 'Tess', 200)).toBe('replace');
  });

  it('goes through the line slot over anything but a young race word', () => {
    expect(sideAction(null, 'Tess', 0)).toBe('show');
    expect(sideAction({ born: 0 }, 'Tess', 10)).toBe('show');
  });
});

describe('stepBackAt', () => {
  it('steps a young race word back once, on the stale clock of its first arrival', () => {
    // 'TobogganTeo wiped out' arrived at 32,820 ms and showed at 32,850; a trick lands at 33,080.
    const word = { race: 'news\u0000TobogganTeo', born: 32850, arrived: 32820, stepped: false };
    expect(stepBackAt(word, 33080)).toBe(32820);
    // Back on the line after the trick (born again), a second trick on it retires it.
    expect(stepBackAt({ ...word, born: 33700, stepped: true }, 33900)).toBeNull();
    // Its moment had passed, or it is no race word: nothing steps back.
    expect(stepBackAt({ ...word, born: 32850 }, 32850 + HOLD_MS)).toBeNull();
    expect(stepBackAt({ born: 0, arrived: 0, stepped: false }, 10)).toBeNull();
    expect(stepBackAt(undefined, 10)).toBeNull();
  });

  it('lets it go stale from its first arrival, however often it came back', () => {
    // Before: the clock restarted at each showing, so one word printed four times over 4 s.
    expect(queueFresh(32820, 32820 + 1000)).toBe(true);
    expect(queueFresh(32820, 32820 + 2 * HOLD_MS + 251)).toBe(false);
  });
});

describe('raceHolds', () => {
  it('keeps a minor line out under a race word for its hold, as under a pass in the pill', () => {
    expect(raceHolds({ race: 'Tess', born: 1000 }, 1200)).toBe(true);
    expect(raceHolds({ race: 'Tess', born: 1000 }, 1000 + HOLD_MS)).toBe(false);
    expect(raceHolds({ born: 1000 }, 1200)).toBe(false);
    expect(raceHolds(undefined, 1200)).toBe(false);
  });
});
