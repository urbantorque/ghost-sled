// The audio engine's main-thread cost on a live run (engine.debugCpu, round 6): milliseconds a second
// spent in the frame's audio calls (update, beats, simEvent) and in the 25 ms scheduler passes, the
// worst single call, and nodes made a second (and of those, made inside a frame's call, where a node
// lengthens the frame: DECISIONS 89). Each pass is a fresh replayed run (?demo=N) on a tier, measured
// from `from` seconds in for `seconds`, optionally under a CPU throttle (CDP, e.g. 6 for Low's bar).
// Not a frame-rate probe: it reads the audio engine's own clock only.
//   playwright-cli -s=music eval "window.__cpuCfg = { base: 'http://127.0.0.1:4401/' }"
//   playwright-cli -s=music run-code --filename=scripts/playtest/audiocpu.js
async (page) => {
  const cfg = Object.assign(
    { base: 'http://127.0.0.1:4173/', demo: 0, from: 8, seconds: 40, passes: null },
    (await page.evaluate(() => window.__cpuCfg).catch(() => null)) || {},
  );
  const passes = cfg.passes || [
    { tier: 'high', m: 0 },
    { tier: 'low', m: 0 },
  ];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const out = [];
  let cdp = null;
  for (const p of passes) {
    await page.goto(cfg.base + '?platform=mock');
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    if (p.throttle && p.throttle > 1) {
      cdp = cdp || (await page.context().newCDPSession(page));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.throttle });
    }
    // demo: null rides hands off (a plain cruise); a number replays that pool run.
    const demo = p.demo !== undefined ? p.demo : cfg.demo;
    await page.goto(cfg.base + `?platform=mock&debug&tier=${p.tier}&m=${p.m}&autoride=1` + (demo === null ? '' : `&demo=${demo}`));
    await page.waitForFunction(() => window.__gs && window.__gs.audio, null, { timeout: 60000 });
    await page.keyboard.press('q');
    const res = await page.evaluate(async ([from, seconds]) => {
      const g = window.__gs;
      const a = g.audio;
      const t0 = performance.now();
      while (!a.debugTap() && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
      if (!a.debugCpu) return { error: 'no debugCpu on this build' };
      const tap = a.debugTap();
      if (tap && tap.ctx.state !== 'running') await tap.ctx.resume().catch(() => null);
      a.setVolumes({ master: 1, music: 0.8, sfx: 0.8 });
      await new Promise((r) => setTimeout(r, from * 1000));
      a.debugCpu(true);
      const layers = [];
      const start = performance.now();
      while (performance.now() - start < seconds * 1000) {
        await new Promise((r) => setTimeout(r, 1000));
        const lv = a.debugLevels();
        layers.push(Math.round((lv.drive ?? 0) * 100) / 100);
        if (g.phase === 'results') break;
      }
      const cpu = a.debugCpu();
      const lv = a.debugLevels();
      return { ...cpu, drive: layers, phase: g.phase, musicPeak: lv.musicPeak, reserveMisses: lv.reserveMisses };
    }, [cfg.from, p.seconds || cfg.seconds]);
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    out.push({ tier: p.tier, m: p.m, demo: p.demo !== undefined ? p.demo : cfg.demo, throttle: p.throttle || 1, ...res });
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors, out }, null, 0);
}
