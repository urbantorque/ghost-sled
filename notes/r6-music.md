# Round 6, music and sound lane: notes for the main lane

(Working notes; the decisions and numbers are folded in at the end.)

## Before (d8aae90 audio, with the new probe-only meter)

`scripts/playtest/audiocpu.js` (engine.debugCpu), Pinecrest, measured 8 s to 48 s into the run, headless Chrome,
laptop on its charger state of the day.

| Run | Tier, CPU | Engine ms a second (frame calls + scheduler) | Nodes a second | Made inside a frame |
| --- | --- | --- | --- | --- |
| Hands off (a plain cruise, drive 0.4 to 0.6) | High, 1x | 10.5 (5.8 + 4.7) | 54.7 | 0.7 |
| Hands off | Low, 1x | 12.1 (6.8 + 5.3) | 50.4 | 0.15 |
| Hands off | Low, 6x | 24.5 (15.1 + 9.4) | 45.1 | 0.15 |
| Best pool run (?demo=0, drive 0.6 to 0.95) | High, 1x | 12.5 (6.4 + 6.1) | 112.6 | 5.4 |
| Best pool run | Low, 1x | 9.5 (4.1 + 5.4) | 109.4 | 4.6 |
| Best pool run | Low, 6x | 58.7 (23.6 + 35.1) | 112.5 | 5.4 |
