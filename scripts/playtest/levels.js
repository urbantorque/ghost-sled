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
//   wind      the ambience bed at 30 m/s with earned flow 0, 0.5 and 1: the singing wind stays at
//             the plain wind's level (within 2 dB), so a long stretch in the flow is a tone, not a
//             louder bed
//   flowIn    'In the flow' on a skilled stretch (drive 0.55, 30 m/s, the wind singing): its chord
//             lands 0.6 s in at least 5 dB over the mix before it
//   flowStomp the same 0.2 s after a perfect landing (half of all flow-ins): the flow's landing still
//             shows over the landing's tail (at least 2 dB over its neighbours)
//   snuffBump, snuffSketchy, snuffBroken, snuffLost
//             'Flow broken' with what broke it, as the director pushes it (a bump bank; a sketchy
//             landing, whose snuff comes alone with 'Flow broken' as its line; a sketchy landing that
//             broke a streak; a crash that lost a 2,500 combo), on a skilled stretch with the wind
//             singing. The pfft alone against the rest of the moment as 10 ms octave-band cells:
//             glimpse (the share of its energy where it is at least as loud as the rest), its best
//             cell over the rest, and what it adds to the mix there; what it adds to the moment's peak
//             and voices (the moment's random bed averaged over 8 renders). Over a bump or a
//             sketchy landing it must read (its best cell at least 2 dB over the rest and 4 dB on
//             the mix; the old 900 Hz puff managed -1.2 to +1.4 and 2.4 to 3.8) and add at most
//             0.5 dB to the moment's peak; with a crash it adds no voice (the stumble says it)
//   flowSnuff, flowCrash
//             'In the flow', then a sketchy landing's snuff 0.35 s later or a crash 0.4 s later,
//             inside its 0.6 s swell: its chord must not land after the snuff (what of the flow-in
//             sounds from the snuff + 0.2 s to + 1 s at least 12 dB under the flow-in alone)
//   gifts     the effects alone: runs of six gift pickups, the same six each run, so the later runs
//             play the rendered takes (src/audio/prerender.ts): takes counts them
//   giftTakes every gift pickup's take (ladder steps 6 to 15, both kinds) against the same pickup
//             built live, sample by sample, started on a render quantum's first frame, at the game's
//             phases at 48 and 44.1 kHz and between two frames, and at the 48 kHz phase in eight
//             render quanta whose start times carry different float noise: where the take plays it
//             is the live sound (every block within 0.1 dB, the residual at least 35 dB down; a
//             take refuses a start that would put a bell on another frame)
// The stress mix also counts its steals: sfxLoudSteals (a victim still above -20 dB) and
// sfxPayoffSteals (of those, payoffs; at most 2).
// It also asserts the live AudioContext is running (a real key press unlocks it first).
// Run against a preview build: playwright-cli -s=audio run-code --filename=scripts/playtest/levels.js
// Set window.__levelsCfg = { base, kinds, seconds, songs } on the current page first to change the plan.
async (page) => {
  const defaults = { kinds: ['cruise', 'ambience', 'music', 'stress', 'shoulder', 'layers', 'wind', 'flowIn', 'flowStomp', 'snuffBump', 'snuffSketchy', 'snuffBroken', 'snuffLost', 'flowSnuff', 'flowCrash', 'gifts', 'giftTakes'], seconds: 10, songs: true };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__levelsCfg).catch(() => null)) || {}) };
  if (!cfg.kinds) cfg.kinds = defaults.kinds;
  const BASE = cfg.base || 'http://127.0.0.1:4173/';
  await page.goto(BASE + '?platform=mock&debug&m=0');
  await page.waitForFunction(() => window.__gs && window.__gs.audio && window.__gs.phase === 'title', null, { timeout: 30000 });
  // A real key press is the gesture that lets the context start (q is bound to nothing).
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.__gs.audio.debugLevels().running === 1, null, { timeout: 5000 }).catch(() => null);
  const running = await page.evaluate(() => window.__gs.audio.debugLevels().running === 1);
  const levels = {};
  // The snuff readings average their random bed inside the probe; snuffReps > 1 also takes the median
  // of that many readings.
  const SNUFF = new Set(['snuffBump', 'snuffSketchy', 'snuffBroken', 'snuffLost', 'flowSnuff', 'flowCrash']);
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  for (const kind of cfg.kinds) {
    const reps = SNUFF.has(kind) ? cfg.snuffReps || 1 : 1;
    const runs = [];
    for (let i = 0; i < reps; i++) runs.push(await page.evaluate(([k, s]) => window.__gs.audio.debugRender(k, s), [kind, cfg.seconds]));
    const round = {};
    for (const [key, v] of Object.entries(runs[0])) {
      const x = Array.isArray(v) ? v : median(runs.map((r) => r[key]));
      round[key] = Array.isArray(x) ? x : key === 'glimpse' ? Math.round(x * 100) / 100 : Math.round(x * 10) / 10;
    }
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
  // Moment envelopes are 20 ms windows from 0.4 s before the moment.
  const env = (k) => (levels[k] && Array.isArray(levels[k].env) ? levels[k].env : null);
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const fi = env('flowIn');
  const fs = env('flowStomp');
  const ws = levels.wind ? levels.wind.windStepsDb : null;
  const gt = levels.giftTakes;
  // The flow chord at 0.6 s after the moment (flowStomp: 0.8 s), against the 0.4 s before it / its neighbours.
  const flowInLift = fi ? Math.max(...fi.slice(20 + 29, 20 + 35)) - avg(fi.slice(0, 20)) : null;
  const flowStompLift = fs ? Math.max(...fs.slice(20 + 39, 20 + 45)) - avg(fs.slice(20 + 30, 20 + 38)) : null;
  const checks = {
    contextRunning: running,
    ambienceNear33: levels.ambience ? Math.abs(levels.ambience.rmsDb + 33) <= 3 : null,
    stressPeakUnder3: levels.stress ? levels.stress.peakDb < -3 : null,
    noPadSteals: levels.stress ? levels.stress.padSteals === 0 : null,
    stressKeepsPayoffs: levels.stress && levels.stress.sfxPayoffSteals !== undefined ? levels.stress.sfxPayoffSteals <= 2 : null,
    windToneFlat: ws ? Math.max(...ws) - Math.min(...ws) <= 2 : null,
    flowInLands: flowInLift !== null ? flowInLift >= 5 : null,
    flowInOverAStomp: flowStompLift !== null ? flowStompLift >= 2 : null,
    shoulderInItsChannel: sh ? sh.closingLR[0] - sh.closingLR[1] >= 4.5 : null,
    shoulderLeavesTheBed: sh ? Math.abs(sh.closingLR[1] - sh.offLR[1]) <= 1.5 : null,
    shoulderSittingQuieter: sh ? sh.sittingLR[0] < sh.closingLR[0] : null,
    songsOneDeck: songList.length ? songList.every((x) => x.decksStarted === 1 && x.cycleBars === 16) : null,
    songsDiffer: songList.length ? new Set(songList.map((x) => x.barLowHz)).size === songList.length : null,
    snuffReadsOverSketchy: levels.snuffSketchy ? levels.snuffSketchy.smrMaxDb >= 2 && levels.snuffSketchy.liftMaxDb >= 4 : null,
    snuffReadsOverStreakBroken: levels.snuffBroken ? levels.snuffBroken.smrMaxDb >= 2 && levels.snuffBroken.liftMaxDb >= 4 : null,
    snuffReadsOverBump: levels.snuffBump ? levels.snuffBump.smrMaxDb >= 2 && levels.snuffBump.liftMaxDb >= 4 : null,
    snuffNoPileUp: ['snuffBump', 'snuffSketchy', 'snuffBroken'].every((k) => !levels[k] || levels[k].peakAddDb <= 0.5),
    snuffAtCrashAddsNoVoice: levels.snuffLost ? levels.snuffLost.voicesAdded === 0 : null,
    snuffKeepsPayoffs: ['snuffBump', 'snuffSketchy', 'snuffBroken', 'snuffLost'].every((k) => !levels[k] || levels[k].sfxPayoffSteals === 0),
    flowInStopsAtSnuff: levels.flowSnuff ? levels.flowSnuff.chordLeftDb <= -12 : null,
    flowInStopsAtCrash: levels.flowCrash ? levels.flowCrash.chordLeftDb <= -12 : null,
    giftsPlayTakes: levels.gifts ? levels.gifts.takes > 0 && levels.gifts.takeFailures === 0 : null,
    giftTakesAreLive: gt ? gt.missing === 0 && gt.takeFailures === 0 && gt.pairs > gt.live && Math.max(...gt.blockDb) <= 0.1 && Math.max(...gt.residDb) <= -35 : null,
  };
  // The envelopes are long: keep the derived lifts, drop the raw windows from the report.
  for (const k of ['flowIn', 'flowStomp']) {
    if (!levels[k]) continue;
    delete levels[k].env;
    delete levels[k].subEnv;
  }
  const lifts = { flowInLiftDb: flowInLift === null ? null : Math.round(flowInLift * 10) / 10, flowStompLiftDb: flowStompLift === null ? null : Math.round(flowStompLift * 10) / 10 };
  return JSON.stringify({ checks, lifts, levels, songs }, null, 1);
}
