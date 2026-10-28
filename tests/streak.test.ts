import { describe, expect, it } from 'vitest';
import { CLEAN_BREAK_TICKS, StompStreak, stompTitle, streakLine } from '../src/game/streak';

describe('stomp streak', () => {
  it('counts consecutive perfect landings and keeps the best', () => {
    const s = new StompStreak();
    expect(s.land('perfect', false, 100).n).toBe(1);
    expect(s.land('perfect', false, 300).n).toBe(2);
    expect(s.land('perfect', false, 500).n).toBe(3);
    expect(s.best).toBe(3);
    expect(s.land('sketchy', false, 700)).toEqual({ n: 0, broke: 3 });
    expect(s.n).toBe(0);
    expect(s.land('perfect', false, 900).n).toBe(1);
    expect(s.best).toBe(3);
  });

  it('a clean landing then a late perfect within 5 ticks counts once', () => {
    const s = new StompStreak();
    s.land('perfect', false, 100);
    expect(s.land('clean', false, 300)).toEqual({ n: 1, broke: 0 });
    expect(s.tick(302)).toBeNull();
    // The press just after touchdown upgrades the clean landing: one more, not a break and a restart.
    expect(s.land('perfect', true, 304)).toEqual({ n: 2, broke: 0 });
    // Its deferred break was cancelled.
    expect(s.tick(300 + CLEAN_BREAK_TICKS)).toBeNull();
    expect(s.tick(400)).toBeNull();
    expect(s.n).toBe(2);
  });

  it('a clean landing alone breaks the streak after 6 ticks', () => {
    const s = new StompStreak();
    s.land('perfect', false, 100);
    s.land('perfect', false, 200);
    s.land('clean', false, 300);
    expect(s.n).toBe(2);
    expect(s.tick(300 + CLEAN_BREAK_TICKS - 1)).toBeNull();
    expect(s.tick(300 + CLEAN_BREAK_TICKS)).toEqual({ broke: 2 });
    expect(s.n).toBe(0);
    expect(s.best).toBe(2);
  });

  it('a new flight after an unresolved clean landing starts over', () => {
    const s = new StompStreak();
    s.land('perfect', false, 100);
    s.land('clean', false, 200);
    // (No frame tick in between: the next landing still sees the clean one's break first.)
    expect(s.land('perfect', false, 260)).toEqual({ n: 1, broke: 1 });
  });

  it('hops are neutral', () => {
    const s = new StompStreak();
    s.land('perfect', false, 100);
    expect(s.land('hop', false, 150)).toEqual({ n: 1, broke: 0 });
    expect(s.tick(400)).toBeNull();
    expect(s.land('perfect', false, 500).n).toBe(2);
  });

  it('sketchy, crash and revive break it', () => {
    const s = new StompStreak();
    s.land('perfect', false, 1);
    s.land('perfect', false, 2);
    expect(s.land('sketchy', false, 3).broke).toBe(2);
    s.land('perfect', false, 4);
    s.crash();
    expect(s.n).toBe(0);
    s.land('perfect', false, 5);
    s.revive();
    expect(s.n).toBe(0);
    expect(s.best).toBe(2);
    s.reset();
    expect(s.best).toBe(0);
  });
});

describe('stomp titles', () => {
  it('names grow with the streak', () => {
    expect(stompTitle(1)).toBe('Perfect landing');
    expect(stompTitle(2)).toBe('Double stomp');
    expect(stompTitle(3)).toBe('Triple stomp');
    expect(stompTitle(4)).toBe('Quad stomp');
    expect(stompTitle(5)).toBe('Stomp streak 5');
    expect(stompTitle(12)).toBe('Stomp streak 12');
  });

  it('the sub-line names the run, never a number beside it', () => {
    expect(streakLine(1)).toBeNull();
    expect(streakLine(2)).toBe('2 in a row');
    expect(streakLine(7)).toBe('7 in a row');
  });
});
