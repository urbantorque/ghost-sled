// What the set pieces cost where they are heaviest: their draw calls and triangles (the piece slots,
// the crowd, a village's lamplight pools and steam) in a village, a gallery and at a plain gate, per
// tier, with the idle jobs' longest time; and Low-tier frames of a village and the enclosures.
//   playwright-cli -s=gs run-code --filename=scripts/playtest/towns-cost.js
async (page) => {
  const BASE = 'http://127.0.0.1:4192/';
  const OUT = 'shots/r2B/';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  const go = async (tier, m, mood) => {
    await page.goto(BASE + `?debug&tier=${tier}&autoride=1&m=${m}&mood=${mood}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
  };
  const ride = (z) => page.evaluate((z) => {
    const r = window.__gs.run;
    r.sim.s.z = z;
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
  }, z);
  const lane = () => page.evaluate(() => {
    const w = window.__gs.world;
    const sp = w.setPieces;
    const fig = sp.crowd.geometry;
    const figTris = (fig.index ? fig.index.count : fig.attributes.position.count) / 3;
    let calls = 0;
    let tris = 0;
    const parts = [];
    for (const m of sp.slots) {
      if (!m.visible) continue;
      const g = m.geometry;
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      calls++;
      tris += t;
      parts.push('slot ' + Math.round(t) + (m.castShadow ? ' (casts)' : ''));
    }
    if (sp.crowd.visible && sp.crowd.count) {
      calls++;
      tris += sp.crowd.count * figTris;
      parts.push('crowd ' + sp.crowd.count + ' x ' + figTris);
    }
    for (const [name, m] of [['pools', sp.pools], ['steam', sp.steam]]) {
      if (!m.visible) continue;
      calls++;
      tris += m.geometry.drawRange.count / 3;
      parts.push(name + ' ' + m.geometry.drawRange.count / 3);
    }
    return { z: Math.round(window.__gs.run.sim.s.z), calls, tris: Math.round(tris), parts, light: sp.light, fps: window.__gs.frameStats().fps, maxJobMs: +sp.stats.maxJobMs.toFixed(1), madeNow: sp.stats.madeNow, maxPlanMs: +sp.plan.stats.maxPlanMs.toFixed(1) };
  });
  const site = (kind) => page.evaluate((kind) => {
    const sp = window.__gs.world.setPieces;
    sp.plan.planTo(8000);
    const s = sp.planned.find((q) => (kind === 'enc' ? ['gallery', 'icetunnel', 'lavatunnel', 'toriirow'].includes(q.kind) : q.kind === kind));
    return s ? { z: s.z, len: s.len, kind: s.kind } : null;
  }, kind);
  for (const [tier, m, mood, kind, shoot] of [
    ['high', 0, 0, 'village', false],
    ['high', 0, 0, 'gate', false],
    ['high', 0, 0, 'enc', false],
    ['high', 2, 2, 'village', true],
    ['medium', 0, 0, 'village', false],
    ['low', 0, 0, 'village', true],
    ['low', 0, 0, 'enc', true],
    ['low', 3, 0, 'enc', true],
  ]) {
    await go(tier, m, mood);
    const s = await site(kind);
    if (!s) continue;
    await ride(s.z - s.len - 120);
    await page.waitForFunction((z) => !window.__gs.run || window.__gs.run.sim.s.z >= z, s.z - s.len + 20, { timeout: 30000, polling: 16 }).catch(() => {});
    const st = await lane();
    report.push({ tier, m, mood, kind: s.kind, st });
    if (shoot) await page.screenshot({ path: OUT + `${tier}-m${m}-mood${mood}-${s.kind}-measure.png` });
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
