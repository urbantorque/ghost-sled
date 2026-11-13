// Round 7's set pieces' worlds (the momentsworld lane): for each run named, a frame as each set piece comes
// up and a strip while it plays, three frames of the climax, and with every frame what the stages' kit is
// drawing (draws, triangles) and the frame's whole cost. A run rides hands-off, or a pool rider's (demo: N).
//   playwright-cli -s=r7-momentsworld eval "window.__mwCfg = { base: 'http://127.0.0.1:4520/', out: 'C:/.../shots/r7/momentsworld/verbs', tier: 'high', runs: [{ m: 0, variant: 0 }] }"
//   playwright-cli -s=r7-momentsworld run-code --filename=scripts/playtest/momentsworld.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4520/', out: 'shots/r7/momentsworld/verbs', tier: 'high', per: 4, every: 1.1, runs: [{ m: 0, variant: 0 }] }, (await page.evaluate(() => window.__mwCfg).catch(() => null)) || {});
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
    await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${run.m}&autoride=1&variant=${run.variant}` + (run.demo != null ? `&demo=${run.demo}` : '') + (run.legend ? `&legend=${run.legend}` : ''));
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 90000 });
    const tag = `${dev}-${cfg.tier}-m${run.m}-v${run.variant}` + (run.demo != null ? `-d${run.demo}` : '');
    const seen = {};
    let lastShot = -1e9;
    for (let i = 0; i < 8000; i++) {
      const st = await page.evaluate(() => {
        const g = window.__gs;
        const r = g.run;
        if (!r || g.phase !== 'run') return { phase: g.phase };
        const sim = r.sim;
        const mo = sim.mo;
        const next = sim.plays[mo.active >= 0 ? mo.active : mo.next];
        const w = g.world || (g.app && g.app.world);
        const kit = w && w.marquee && w.marquee.kit ? w.marquee.kit.cost() : null;
        const info = w && w.renderer ? { calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles } : null;
        return { phase: g.phase, z: Math.round(sim.s.z), line: sim.course.finishZ, t: +(sim.tick / 60).toFixed(2), active: mo.active, next: next ? { key: next.key, verb: next.verb, variant: next.variantKey, z0: next.z0, z1: next.z1 } : null, n: mo.n, of: mo.of, won: sim.stats.momentMask, finished: sim.s.finished, kit, info };
      });
      if (st.phase !== 'run') break;
      const shoot = async (name) => {
        lastShot = st.t;
        await page.screenshot({ path: `${cfg.out}/${tag}-${name}.png` });
        log.push({ shot: `${tag}-${name}`, z: st.z, n: st.n, of: st.of, won: st.won, kit: st.kit, info: st.info });
      };
      const p = st.next;
      if (p && (!cfg.only || cfg.only.includes(p.key))) {
        const k = `${p.key}-${p.variant}`;
        const c = seen[k] || 0;
        if (st.z >= p.z0 - 70 && st.z < p.z1 && c === 0) {
          seen[k] = 1;
          await shoot(`${k}-0in`);
        } else if (st.active >= 0 && c > 0 && c <= cfg.per && st.t - lastShot >= cfg.every) {
          seen[k] = c + 1;
          await shoot(`${k}-${c}`);
        }
      }
      if (!cfg.only || cfg.only.includes('climax')) {
        for (const [name, d] of [['a', 330], ['b', 150], ['c', 30]]) {
          if (!seen['cx' + name] && st.z >= st.line - d && st.z < st.line) {
            seen['cx' + name] = 1;
            await shoot(`climax-${name}`);
          }
        }
      }
      if (st.finished) break;
      await page.waitForTimeout(50);
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors, log }, null, 0);
}
