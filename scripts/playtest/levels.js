// Mix levels, headless. Offline renders of scripted mixes through the game's own audio Core
// (engine.debugRender -> src/audio/probe.ts, loaded on demand), so the numbers are the shipped DSP:
//   cruise    the whole mix at a novice cruise (20 m/s, x1, no tricks)
//   ambience  the same with the music off: the wind and snow bed (target near -33 dBFS RMS)
//   music     the same with the effects bus off
//   stress    everything at once (full band, avalanche, boost, drift whine, shoulder hiss, fuse,
//             heartbeat and a burst of rewards every 0.25 s): peak after the limiter under -3 dBFS,
//             and the voice-steal counters (padSteals must stay 0)
//   shoulder  the ambience bed alone, then a ghost 2 m to the left closing from 5.5 m to 0.5 m
//             behind, then one sitting 2 m behind: L and R per phase. The cue sits in its channel
//             (closing L - R at least 4.5 dB) and leaves the bed alone (the far channel within
//             1.5 dB of the bed, a sitting ghost under the closing one)
//   layers    each music layer soloed at a cruise (0.36), a skilled drive (0.6) and the stress drive
//             (1.0): dBFS RMS on the music bus
//   songs     each mountain's Clear Skies song (A A B B, 4 bars each) for 20 s, past the A to B
//             change at 17 s: one deck the whole way (no crossfade), a 16-bar loop, and a per-bar
//             low-band reading that differs per mountain
// It also asserts the live AudioContext is running (a real key press unlocks it first).
// Run against a preview build: playwright-cli -s=audio run-code --filename=scripts/playtest/levels.js
// Set window.__levelsCfg = { base, kinds, seconds, songs } on the current page first to change the plan.
async (page) => {
  const defaults = { kinds: ['cruise', 'ambience', 'music', 'stress', 'shoulder', 'layers'], seconds: 10, songs: true };
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
  const songs = {};
  if (cfg.songs) {
    for (const biome of ['alpine', 'glacier', 'volcanic', 'blossom']) {
      const r = await page.evaluate((b) => window.__gs.audio.debugRender('song', 20, { biome: b }), biome);
      songs[biome] = { rmsDb: Math.round(r.rmsDb * 10) / 10, decksStarted: r.decksStarted, cycleBars: r.cycleBars, barLowHz: r.barLowHz.join(' ') };
    }
  }
  const songList = Object.values(songs);
  const sh = levels.shoulder;
  const checks = {
    contextRunning: running,
    ambienceNear33: levels.ambience ? Math.abs(levels.ambience.rmsDb + 33) <= 3 : null,
    stressPeakUnder3: levels.stress ? levels.stress.peakDb < -3 : null,
    noPadSteals: levels.stress ? levels.stress.padSteals === 0 : null,
    shoulderInItsChannel: sh ? sh.closingLR[0] - sh.closingLR[1] >= 4.5 : null,
    shoulderLeavesTheBed: sh ? Math.abs(sh.closingLR[1] - sh.offLR[1]) <= 1.5 : null,
    shoulderSittingQuieter: sh ? sh.sittingLR[0] < sh.closingLR[0] : null,
    songsOneDeck: songList.length ? songList.every((x) => x.decksStarted === 1 && x.cycleBars === 16) : null,
    songsDiffer: songList.length ? new Set(songList.map((x) => x.barLowHz)).size === songList.length : null,
  };
  return JSON.stringify({ checks, levels, songs }, null, 1);
}
