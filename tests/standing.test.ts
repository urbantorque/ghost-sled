import { describe, expect, it } from 'vitest';
import { FINISH_Z, aheadOf, byStanding, clock, figure, margin, marginPhrase, predictedTime, recordStanding, splitGap, timeGap, type Standing } from '../src/game/standing';

// The race's one order: finishers by time, then the rest by distance.

const done = (time: number, distance = FINISH_Z + 100): Standing => ({ time, distance });
const fell = (distance: number): Standing => ({ time: null, distance });

describe('the race order', () => {
  it('ranks a faster finisher ahead, even one that stopped short of a slower one', () => {
    expect(aheadOf(done(150, FINISH_Z + 20), done(160, FINISH_Z + 200))).toBe(true);
    expect(aheadOf(done(160, FINISH_Z + 200), done(150, FINISH_Z + 20))).toBe(false);
  });

  it('ranks any finisher ahead of any rider who did not finish', () => {
    expect(aheadOf(done(400), fell(FINISH_Z - 1))).toBe(true);
    expect(aheadOf(fell(FINISH_Z - 1), done(400))).toBe(false);
  });

  it('ranks the rest by distance', () => {
    expect(aheadOf(fell(900), fell(800))).toBe(true);
    expect(aheadOf(fell(800), fell(900))).toBe(false);
  });

  it('gives nobody the lead on a dead heat', () => {
    expect(aheadOf(done(150), done(150))).toBe(false);
    expect(aheadOf(fell(900), fell(900))).toBe(false);
    expect(byStanding(done(150), done(150))).toBe(0);
  });

  it('sorts first place first', () => {
    const rows = [fell(1000), done(170), fell(3000), done(150)];
    expect(rows.sort(byStanding).map(figure)).toEqual(['2:30.0', '2:50.0', '3,000 m', '1,000 m']);
  });

  it("reads a record's header: a finished run's ticks is its finish", () => {
    expect(recordStanding({ ticks: 9000, distance: FINISH_Z + 60 })).toEqual({ time: 150, distance: FINISH_Z + 60 });
    expect(recordStanding({ ticks: 9000, distance: 3000 })).toEqual({ time: null, distance: 3000 });
  });
});

describe('how a time reads', () => {
  it('is a clock, in floored tenths', () => {
    expect(clock(151.46)).toBe('2:31.4');
    expect(clock(0)).toBe('0:00.0');
    expect(clock(59.99)).toBe('0:59.9');
    expect(clock(60)).toBe('1:00.0');
    expect(clock(605.5)).toBe('10:05.5');
  });

  it('never rounds a tick up onto the next tenth', () => {
    expect(clock(9086 / 60)).toBe('2:31.4');
    expect(clock(9084 / 60)).toBe('2:31.4');
    expect(clock(9090 / 60)).toBe('2:31.5');
  });
});

describe('margins agree with the rows', () => {
  it('between finishers is the difference of the two rows as they read', () => {
    // Rows of 2:31.4 and 2:32.6: 1.2 s, whatever the hidden hundredths.
    expect(timeGap(151.49, 152.6)).toBe(12);
    expect(margin(done(151.49), done(152.6))).toBe('1.2 s');
    expect(marginPhrase(done(151.49), done(152.6))).toBe('by 1.2 s');
  });

  it('a split is the same sum: the clocks as they read, so a line never disagrees with its neighbour', () => {
    // 2:12.3 against a best of 2:06.0: 6.3 s, though the raw gap (6.283) floors to 6.2.
    expect(margin({ time: 126.0667, distance: 4600 }, { time: 132.35, distance: 4600 })).toBe('6.3 s');
    expect(splitGap(132.35, 132.35 - 126.0667)).toBe('6.3 s');
    expect(splitGap(126.0667, 126.0667 - 132.35)).toBe('6.3 s');
    expect(splitGap(132.35, 0.04)).toBeNull();
  });

  it('says so under a tenth', () => {
    expect(margin(done(151.41), done(151.45))).toBe('less than 0.1 s');
  });

  it('between the rest is whole metres as the rows show them', () => {
    expect(margin(fell(759.6), fell(752.5))).toBe('7 m');
    expect(margin(fell(500.2), fell(500.1))).toBe('less than 1 m');
  });

  it('has no number between a time and a distance: the words are the finish', () => {
    expect(margin(done(150), fell(3000))).toBeNull();
    expect(marginPhrase(done(150), fell(3000))).toBe('to the finish');
  });
});

describe('predicted finish time', () => {
  it('is the time itself for a finisher', () => {
    expect(predictedTime(FINISH_Z + 80, 170)).toBe(170);
  });

  it('carries an unfinished run to the line', () => {
    expect(predictedTime(FINISH_Z / 2, 100)).toBe(200);
  });

  it('has nothing to say about a run that never started', () => {
    expect(predictedTime(0, 10)).toBe(0);
    expect(predictedTime(100, 0)).toBe(0);
  });
});
