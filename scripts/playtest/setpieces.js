// The set pieces, frame by frame (round 6): rides a replayed pool run as the player (?demo=N) and shoots a
// strip through each set piece: as its card comes up, then every `every` seconds of run time while it plays,
// with the sim's own account (the verb's count, the race machine's gap, the fall's gap) and the console.
//   playwright-cli -s=gs eval "window.__spCfg = { base: 'http://127.0.0.1:4320/', m: 0, demo: 12, out: 'shots/r6/sp' }"
//   playwright-cli -s=gs run-code --filename=scripts/playtest/setpieces.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', m: 0, demo: 0, tier: 'high', out: 'shots/r6/sp', every: 0.8, per: 7, only: null, tag: '' }, (await page.evaluate(() => window.__spCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${cfg.m}&autoride=1&demo=${cfg.demo}` + (cfg.mood ? `&mood=${cfg.mood}` : ''));
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  const plays = await page.evaluate(() => window.__gs.run.sim.plays.map((p) => ({ index: p.index, key: p.key, verb: p.verb, z0: p.z0, z1: p.z1 })));
  const log = [];
  for (const p of plays) {
    if (cfg.only && !cfg.only.includes(p.key)) continue;
    let shots = 0;
    let lastT = -1e9;
    let shotIn = false;
    for (let i = 0; i < 4000; i++) {
      const st = await page.evaluate((idx) => {
        const g = window.__gs;
        const r = g.run;
        if (!r || g.phase !== 'run') return { phase: g.phase };
        const sim = r.sim;
        const mo = sim.mo;
        const p = sim.plays[idx];
        let gap = null;
        if (mo.active === idx && p.verb === 'race') {
          const D = p.z1 - p.z0 - p.lead, v0 = 1.25 * p.pace, v1 = 0.75 * p.pace, a = (v1 * v1 - v0 * v0) / (2 * D), t = (sim.tick - mo.t0) / 60;
          gap = +(p.z0 + p.lead + Math.min(D, v0 * t + 0.5 * a * t * t) - sim.s.z).toFixed(1);
        }
        if (mo.active === idx && p.verb === 'collapse') gap = +(sim.s.z - (p.z0 - p.lead + (mo.pace * (sim.tick - mo.t0)) / 60)).toFixed(1);
        return { phase: g.phase, z: Math.round(sim.s.z), t: +(sim.tick / 60).toFixed(2), active: mo.active, n: mo.n, of: mo.of, won: (sim.stats.momentMask >> idx) & 1, gap, speed: +sim.s.speed.toFixed(1) };
      }, p.index);
      if (st.phase !== 'run') break;
      if (st.z > p.z1 + 10) break;
      if (!shotIn && st.z >= p.z0 - 35) {
        shotIn = true;
        await page.screenshot({ path: `${cfg.out}/${dev}-m${cfg.m}${cfg.tag}-${p.key}-0in.png` });
        log.push({ key: p.key, shot: 'in', ...st });
      } else if (st.z >= p.z0 && st.t - lastT >= cfg.every && shots < cfg.per) {
        lastT = st.t;
        shots++;
        await page.screenshot({ path: `${cfg.out}/${dev}-m${cfg.m}${cfg.tag}-${p.key}-${shots}.png` });
        log.push({ key: p.key, shot: shots, ...st });
      }
      await page.waitForTimeout(40);
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors, plays, log }, null, 0);
}
