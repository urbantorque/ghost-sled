// Towns and enclosed runs: ride into each mountain's first village and first enclosure on the safe line
// (the sled is pinned to it, so the bot cannot crash mid-shot) and shoot the approach, the inside and
// the way out (an enclosure's last frame waits for its exit flash), by day and at Lantern Night.
// Run against the preview build: set BASE and OUT below, then
//   playwright-cli -s=gs run-code --filename=scripts/playtest/towns.js
async (page) => {
  const BASE = 'http://127.0.0.1:4192/';
  const OUT = 'shots/r2B/';
  const TIER = 'high';
  const JOBS = [
    { m: 0, mood: 0, kinds: ['village', 'enc'] },
    { m: 1, mood: 0, kinds: ['village', 'enc'] },
    { m: 2, mood: 0, kinds: ['village', 'enc'] },
    { m: 3, mood: 0, kinds: ['village', 'enc'] },
    { m: 0, mood: 2, kinds: ['village'] },
    { m: 3, mood: 2, kinds: ['village'] },
    { m: 2, mood: 2, kinds: ['village'] },
  ];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  const go = async (m, mood) => {
    await page.goto(BASE + `?debug&tier=${TIER}&autoride=1&m=${m}&mood=${mood}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
  };
  // Teleport to z and keep the sled on the safe line at 26 m/s from then on.
  const ride = (z) => page.evaluate((z) => {
    const r = window.__gs.run;
    const s = r.sim.s;
    const c = r.sim.course;
    s.z = z;
    window.__pin = window.__pin || (() => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed) {
        const q = rr.sim.s;
        const cc = rr.sim.course;
        q.x = cc.safeX(q.z);
        q.y = cc.ground(q.x, q.z);
        q.vx = (cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * 13;
        q.vz = 26;
        q.vy = 0;
        q.speed = 26;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
      }
      requestAnimationFrame(window.__pin);
    });
    if (!window.__pinOn) {
      window.__pinOn = true;
      requestAnimationFrame(window.__pin);
    }
    s.x = c.safeX(z);
    s.y = c.ground(s.x, z);
  }, z);
  const state = () => page.evaluate(() => {
    const r = window.__gs.run;
    const w = window.__gs.world;
    return { z: r ? Math.round(r.sim.s.z) : null, crashed: r ? r.sim.s.crashed : null, light: w.setPieces.light, crowd: w.setPieces.crowd.count, calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles, fps: window.__gs.frameStats ? window.__gs.frameStats().fps : null };
  });
  for (const { m, mood, kinds } of JOBS) {
    await go(m, mood);
    const sites = await page.evaluate(() => {
      const sp = window.__gs.world.setPieces;
      sp.plan.planTo(8000);
      return sp.planned.map((s) => ({ kind: s.kind, z: s.z, len: s.len, clear: s.clear }));
    });
    report.push({ m, mood, sites: sites.map((s) => `${s.kind}@${Math.round(s.z)}${s.len ? '/' + Math.round(s.len) : ''}`).join(' ') });
    const vil = sites.find((s) => s.kind === 'village');
    const enc = sites.find((s) => ['gallery', 'icetunnel', 'lavatunnel', 'toriirow'].includes(s.kind));
    for (const which of kinds) {
      const t = which === 'village' ? vil : enc;
      if (!t) continue;
      const z0 = t.z - t.len;
      const at = which === 'village' ? [z0 - 55, z0 + 25, t.z + 10] : [z0 - 50, z0 + 15, t.z + t.len - 14, t.z + t.len + 2];
      const names = which === 'village' ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd'];
      await ride(at[0] - 40);
      await page.waitForTimeout(1600);
      for (let k = 0; k < at.length; k++) {
        if (which === 'enc' && k === 3) await page.waitForFunction(() => window.__gs.world.setPieces.light.flash > 0.3, null, { timeout: 30000, polling: 16 }).catch(() => {});
        else await page.waitForFunction((z) => !window.__gs.run || window.__gs.run.sim.s.z >= z || window.__gs.run.sim.s.crashed, at[k], { timeout: 30000, polling: 16 }).catch(() => {});
        const st = await state();
        await page.screenshot({ path: OUT + `${TIER}-m${m}-mood${mood}-${t.kind}-${names[k]}.png` });
        report.push({ shot: `${t.kind}-${names[k]}`, st });
      }
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors }, null, 1);
}
