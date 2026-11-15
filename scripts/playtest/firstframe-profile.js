// Where the first frame's time goes: a CPU profile from navigation to the 'gs-first-frame' mark at a CPU throttle on
// a fresh save, summed by function (self and inclusive), for each build in turn. Run it on unminified builds
// (npx vite build --minify false) so the names mean something; compare two builds' tables side by side.
//   playwright-cli -s=ffp eval "window.__ffpCfg = { builds: ['http://127.0.0.1:4320/', 'http://127.0.0.1:4321/'], throttle: 6, rounds: 2 }"
//   playwright-cli -s=ffp run-code --filename=scripts/playtest/firstframe-profile.js
async (page) => {
  const cfg = Object.assign({ builds: [], throttle: 6, rounds: 2, top: 45, interval: 250 }, (await page.evaluate(() => window.__ffpCfg).catch(() => null)) || {});
  const cdp = await page.context().newCDPSession(page);
  const result = {};
  for (let r = 0; r < cfg.rounds; r++) {
    for (const base of cfg.builds) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await page.goto(base + '?platform=mock');
      await page.waitForTimeout(1200);
      await page.evaluate(() => localStorage.clear());
      await page.goto('about:blank');
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: cfg.interval });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
      await cdp.send('Profiler.start');
      await page.goto(base + '?platform=mock', { timeout: 120000 });
      const t = await page
        .waitForFunction(() => { const e = performance.getEntriesByName('gs-first-frame')[0]; return e ? e.startTime : null; }, null, { timeout: 120000, polling: 50 })
        .then((h) => h.jsonValue());
      const { profile } = await cdp.send('Profiler.stop');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      // Self and inclusive time by function, in ms of wall time under the throttle.
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const dt = [];
      for (let i = 0; i < profile.samples.length; i++) dt.push((profile.timeDeltas[i + 1] ?? profile.timeDeltas[i] ?? 0) / 1000);
      const selfMs = new Map();
      for (let i = 0; i < profile.samples.length; i++) selfMs.set(profile.samples[i], (selfMs.get(profile.samples[i]) || 0) + dt[i]);
      const parent = new Map();
      for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
      const key = (n) => {
        const f = n.callFrame;
        const file = (f.url || '').split('/').pop().replace(/-[\w-]{8}\.js$/, '.js');
        return `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`;
      };
      const self = new Map();
      const incl = new Map();
      for (const [id, ms] of selfMs) {
        const n = byId.get(id);
        self.set(key(n), (self.get(key(n)) || 0) + ms);
        // Inclusive: each distinct function on the stack once.
        const seen = new Set();
        let cur = id;
        while (cur !== undefined) {
          const k = key(byId.get(cur));
          if (!seen.has(k)) {
            seen.add(k);
            incl.set(k, (incl.get(k) || 0) + ms);
          }
          cur = parent.get(cur);
        }
      }
      const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, cfg.top).map(([k, v]) => [k, Math.round(v)]);
      (result[base] ??= []).push({ firstFrame: Math.round(t), sampled: Math.round(dt.reduce((a, b) => a + b, 0)), self: top(self), incl: top(incl) });
    }
  }
  return JSON.stringify(result);
}
