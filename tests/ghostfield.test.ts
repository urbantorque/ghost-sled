import { afterEach, describe, expect, it, vi } from 'vitest';
import { GhostManager } from '../src/game/ghosts';
import type { WorkerOut } from '../src/game/ghostdata';

// The place pill's "of N" is the race field (GhostManager.fieldSize), not the tracks ready so far:
// a field's replays come ready over several seconds, and the pill must not count them up.

type Inbox = { onMessage(m: WorkerOut): void };

function field(n: number): GhostManager {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const gm = new GhostManager();
  gm.setField(Array.from({ length: n }, (_, i) => ({ name: `G${i}`, kind: 'pool' as const, score: 100, record: '' })));
  return gm;
}

function reply(gm: GhostManager, i: number, samples: number): void {
  const id = gm.tracks[i].entry.id;
  (gm as unknown as Inbox).onMessage({ type: 'trajectory', id, frames: new Float32Array(samples * 12), samples, ticks: samples * 4, crashTick: -1, score: 0, distance: 0, tricks: new Int32Array(0) });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GhostManager.fieldSize', () => {
  it('counts every ghost still loading or ready, plus you', () => {
    const gm = field(5);
    expect(gm.fieldSize).toBe(6);
    // standings() counts only the ready ones meanwhile.
    expect(gm.standings(0, 0).of).toBe(1);
    reply(gm, 0, 40);
    expect(gm.standings(0, 0).of).toBe(2);
    expect(gm.fieldSize).toBe(6);
    for (let i = 1; i < 5; i++) reply(gm, i, 40);
    expect(gm.standings(0, 0).of).toBe(6);
    expect(gm.fieldSize).toBe(6);
  });

  it('drops a replay that failed or came back empty', () => {
    const gm = field(4);
    (gm as unknown as Inbox).onMessage({ type: 'error', id: gm.tracks[1].entry.id, message: 'bad record' });
    expect(gm.fieldSize).toBe(4);
    reply(gm, 0, 0);
    expect(gm.fieldSize).toBe(3);
    reply(gm, 1, 40);
    expect(gm.fieldSize).toBe(3);
  });
});
