// Round 7's legends, shot as strips (the momentsworld lane): for each run named, the sled is put on the
// safe line a little before the legend is said and ridden through it at a pinned speed, and a frame is
// taken at each of ten places from the saying to past the end, with the legend's own account and cost.
//   playwright-cli -s=r7-mw-lg open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=r7-mw-lg eval "window.__lgCfg = { base: 'http://127.0.0.1:4521/', out: 'C:/.../shots/r7/momentsworld/legends', tier: 'high', runs: [{ m: 0, legend: 1 }] }"
//   playwright-cli -s=r7-mw-lg run-code --filename=scripts/playtest/legends-r7.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4521/', out: 'shots/r7/momentsworld/legends', tier: 'high', speed: 34, extra: '', runs: [{ m: 0, legend: 1 }] }, (await page.evaluate(() => window.__lgCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300));
  });
  const log = [];
  for (const run of cfg.runs) {
    await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${run.m}&autoride=1&legend=${run.legend}${cfg.extra}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const lg = await page.evaluate((speed) => {
      const sim = window.__gs.run.sim;
      const l = sim.legend;
      if (!l) return null;
      const q = sim.s;
      q.z = l.z0 - 300;
      window.__pinSpeed = speed;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const s = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          s.x = cc.safeX(s.z) + (window.__pinOff || 0);
          s.y = cc.ground(s.x, s.z);
          s.vx = ((cc.safeX(s.z + 1) - cc.safeX(s.z - 1)) * v) / 2;
          s.vz = v;
          s.vy = 0;
          s.speed = v;
          s.grounded = true;
          s.heading = Math.atan2(s.vx, s.vz);
          s.velHeading = s.heading;
          s.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
      return { key: l.key, kind: l.kind, z0: l.z0, z1: l.z1, side: l.side };
    }, cfg.speed);
    if (!lg) {
      log.push({ run, none: true });
      continue;
    }
    const tag = `${dev}-${cfg.tier}-${lg.key}`;
    const len = lg.z1 - lg.z0;
    const at = [lg.z0 - 190, lg.z0 - 110, lg.z0 - 30, lg.z0 + len * 0.15, lg.z0 + len * 0.35, lg.z0 + len * 0.55, lg.z0 + len * 0.78, lg.z1 - 8, lg.z1 + 45, lg.z1 + 110];
    for (let i = 0; i < at.length; i++) {
      await page.waitForFunction((z) => !window.__gs.run || window.__gs.run.sim.s.z >= z || window.__gs.phase !== 'run', at[i], { timeout: 60000, polling: 16 });
      const st = await page.evaluate(() => {
        const g = window.__gs;
        if (!g.run || g.phase !== 'run') return null;
        const sim = g.run.sim;
        const find = (o, d) => {
          if (!o || d > 3) return null;
          for (const k of Object.keys(o)) {
            const v = o[k];
            if (v && typeof v === 'object' && v.legends && v.kit) return v;
          }
          return null;
        };
        const mw = find(g.world, 0);
        const cost = mw ? { kit: mw.kit.cost(), own: mw.legends.cost(), shot: mw.legends.shot() && { ...mw.legends.shot() } } : null;
        return { z: Math.round(sim.s.z), phase: sim.lg.phase, n: sim.lg.n, head: Math.round(sim.lg.head), cost, info: window.__gs.world.renderer ? { calls: window.__gs.world.renderer.info.render.calls, tris: window.__gs.world.renderer.info.render.triangles } : null };
      });
      if (!st) break;
      await page.screenshot({ path: `${cfg.out}/${tag}-${i}.png` });
      log.push({ shot: `${tag}-${i}`, ...st });
    }
    await page.evaluate(() => { window.__pinSpeed = 0; });
  }
  return { log, errors };
}
