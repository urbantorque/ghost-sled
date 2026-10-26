// Mix levels, headless. Offline renders of scripted mixes through the game's own audio Core
// (engine.debugRender -> src/audio/probe.ts, loaded on demand), so the numbers are the shipped DSP:
//   cruise    the whole mix at a novice cruise (20 m/s, x1, no tricks)
//   ambience  the same with the music off: the wind and snow bed (target near -33 dBFS RMS)
//   music     the same with the effects bus off
//   stress    everything at once (full band, avalanche, boost, drift whine, shoulder hiss, fuse,
//             heartbeat and a burst of rewards every 0.25 s): peak after the limiter under -3 dBFS,
//             and the voice-steal counters (padSteals must stay 0)
// It also asserts the live AudioContext is running (a real key press unlocks it first).
// Run against a preview build: playwright-cli -s=audio run-code --filename=scripts/playtest/levels.js
// Set window.__levelsCfg = { base, kinds, seconds } on the current page first to change the plan.
async (page) => {
  const defaults = { kinds: ['cruise', 'ambience', 'music', 'stress'], seconds: 10 };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__levelsCfg).catch(() => null)) || {}) };
  const BASE = cfg.base || 'http://127.0.0.1:4173/';
  await page.goto(BASE + '?platform=mock&debug&m=0');
  await page.waitForFunction(() => window.__gs && window.__gs.audio && window.__gs.phase === 'title', null, { timeout: 30000 });
  // A real key press is the gesture that lets the context start (q is bound to nothing).
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.__gs.audio.debugLevels().running === 1, null, { timeout: 5000 }).catch(() => null);
  const running = await page.evaluate(() => window.__gs.audio.debugLevels().running === 1);
  const levels = {};
  for (const kind of cfg.kinds) {
    const r = await page.evaluate(([k, s]) => window.__gs.audio.debugRender(k, s), [kind, cfg.seconds]);
    const round = {};
    for (const [key, v] of Object.entries(r)) round[key] = Array.isArray(v) ? v : Math.round(v * 10) / 10;
    levels[kind] = round;
  }
  const checks = {
    contextRunning: running,
    ambienceNear33: levels.ambience ? Math.abs(levels.ambience.rmsDb + 33) <= 3 : null,
    stressPeakUnder3: levels.stress ? levels.stress.peakDb < -3 : null,
    noPadSteals: levels.stress ? levels.stress.padSteals === 0 : null,
  };
  return JSON.stringify({ checks, levels }, null, 1);
}
