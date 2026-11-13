// Round 7's set pieces, variants and legends, shot as a hands-off sled rides them (the moments lane): for each
// run named, a frame as each set piece comes up and two while it plays, and two of the run's legend, with the
// sim's own account and the console.
//   playwright-cli -s=r7-moments eval "window.__mrCfg = { base: 'http://127.0.0.1:4450/', out: 'shots/r7/moments', runs: [{ m: 4, variant: 2, legend: 2 }] }"
//   playwright-cli -s=r7-moments run-code --filename=scripts/playtest/moments-r7.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4450/', out: 'shots/r7/moments', tier: 'high', runs: [{ m: 4, variant: 0, legend: 1 }] }, (await page.evaluate(() => window.__mrCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300));
  });
  const log = [];
  for (const run of cfg.runs) {
    await page.goto(cfg.base + '?platform=mock');
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${run.m}&autoride=1&variant=${run.variant}` + (run.legend ? `&legend=${run.legend}` : ''));
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
    const tag = `${dev}-${cfg.tier}-m${run.m}-v${run.variant}`;
    const seen = {};
    let lastShot = -1e9;
    for (let i = 0; i < 6000; i++) {
      const st = await page.evaluate(() => {
        const g = window.__gs;
        const r = g.run;
        if (!r || g.phase !== 'run') return { phase: g.phase };
        const sim = r.sim;
        const mo = sim.mo;
        const lg = sim.legend;
        const next = sim.plays[mo.active >= 0 ? mo.active : mo.next];
        return { phase: g.phase, z: Math.round(sim.s.z), t: +(sim.tick / 60).toFixed(2), active: mo.active, next: next ? { key: next.key, verb: next.verb, variant: next.variantKey, z0: next.z0, z1: next.z1 } : null, n: mo.n, of: mo.of, mask: sim.stats.momentMask, legend: lg ? { key: lg.key, z0: lg.z0, z1: lg.z1, phase: sim.lg.phase } : null, finished: !!sim.finished };
      });
      if (st.phase !== 'run' || st.finished) break;
      const p = st.next;
      if (p) {
        const k = `${p.key}-${p.variant}`;
        const want = st.z >= p.z0 - 40 && !seen[k] ? 'in' : st.active >= 0 && st.t - lastShot >= 1.6 && (seen[k] || 0) < 3 ? String(seen[k]) : null;
        if (want) {
          seen[k] = (seen[k] || 0) + 1;
          lastShot = st.t;
          await page.screenshot({ path: `${cfg.out}/${tag}-${k}-${want}.png` });
          log.push({ shot: `${tag}-${k}-${want}`, z: st.z, n: st.n, of: st.of });
        }
      }
      const lg = st.legend;
      if (lg && st.z >= lg.z0 - 30 && st.z < lg.z1 && st.t - lastShot >= 1.6 && (seen[lg.key] || 0) < 2) {
        seen[lg.key] = (seen[lg.key] || 0) + 1;
        lastShot = st.t;
        await page.screenshot({ path: `${cfg.out}/${tag}-legend-${lg.key}-${seen[lg.key]}.png` });
        log.push({ shot: `${tag}-legend-${lg.key}-${seen[lg.key]}`, z: st.z, phase: lg.phase });
      }
      await page.waitForTimeout(60);
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors, log }, null, 0);
}
