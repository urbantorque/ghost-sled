// The visual lift's props lane: close stills of the named pieces at the lens (a kicker's lip, the stone
// lanterns and Lanternfall's stone lamps, the run's rock, Sakura's blossom, the FINISH board), the same
// places on any build and tier, so a before and an after sit side by side. Each place is found from the
// course itself: the obstacles of each kind nearest the safe line (1.2 to 4.5 m off it, a lantern to 5 m), the first kickers on the line,
// the finish line. It rides the safe line at a pinned speed (as frames.js), the HUD, ghosts and tags hidden.
//   playwright-cli -s=vl-props-desk open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=vl-props-desk eval "window.__stillsCfg = { base: 'http://127.0.0.1:4604/', out: 'C:/.../shots/vl/props/stills/after/high/', tier: 'high', ms: [3] }"
//   playwright-cli -s=vl-props-desk run-code --filename=scripts/playtest/props-stills.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4604/', out: 'shots/vl/props/stills/x/', tier: 'high', speed: 30, ms: [0, 1, 2, 3, 4], mood: 0 }, (await page.evaluate(() => window.__stillsCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  for (const m of c.ms) {
    await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${m}&mood=${c.mood}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 180000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas.game-canvas { visibility: visible !important; }' });
    await page.evaluate((speed) => {
      window.__pinSpeed = speed;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          q.x = cc.safeX(q.z);
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
          q.vz = v;
          q.vy = 0;
          q.speed = v;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
        }
        // (The race and its tags are not what these stills judge.)
        const w = window.__gs.world;
        if (w && w.ghosts && w.ghosts.root) w.ghosts.root.visible = false;
        if (w && w.labels && w.labels.root) w.labels.root.visible = false;
        requestAnimationFrame(pin);
      };
      pin();
      const r = window.__gs.world && window.__gs.world.renderer;
      if (r && r.info) {
        r.info.autoReset = false;
        const tick = () => { window.__frameInfo = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.reset(); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
    }, c.speed);
    const list = await page.evaluate(() => {
      const cc = window.__gs.run.sim.course;
      const out = [];
      const fin = cc.finishZ;
      const n = Math.ceil(fin / 64);
      const near = {};
      const ramps = [];
      for (let i = 0; i < n; i++) {
        const ch = cc.chunk(i);
        for (const o of ch.obstacles) {
          if (!['lantern', 'rock', 'lavarock', 'blossom'].includes(o.kind) || o.soft || o.z < 300 || o.z > fin - 120) continue;
          const dx = Math.abs(o.x - cc.safeX(o.z));
          if (dx < 1.2 || dx > (o.kind === 'lantern' ? 5 : 4.5)) continue;
          (near[o.kind] = near[o.kind] || []).push({ z: o.z, dx });
        }
        for (const r of ch.zones.ramps) if (r.z > 300 && Math.abs(r.x - cc.safeX(r.z + r.len)) < 1.5) ramps.push(r.z + r.len);
      }
      for (const [k, list] of Object.entries(near)) {
        // The two nearest the line, a good way apart.
        list.sort((a, b) => a.dx - b.dx);
        const kept = [];
        for (const o of list) if (kept.length < 2 && kept.every((q) => Math.abs(q.z - o.z) > 200)) kept.push(o);
        kept.forEach((o, i) => {
          out.push({ z: Math.round(o.z - 3), why: `${k}${i}-by` });
          out.push({ z: Math.round(o.z - 7), why: `${k}${i}-ahead` });
        });
      }
      ramps.slice(0, 2).forEach((z, i) => {
        out.push({ z: Math.round(z - 14), why: `lip${i}-ahead` });
        out.push({ z: Math.round(z + 2), why: `lip${i}-over` });
      });
      out.push({ z: Math.round(fin - 60), why: 'finish-far' });
      out.push({ z: Math.round(fin - 26), why: 'finish-near' });
      out.sort((a, b) => a.z - b.z);
      // Two shots closer than 6 m are one.
      return out.filter((f, i) => i === 0 || f.z - out[i - 1].z > 6);
    });
    let last = -1e9;
    for (const f of list) {
      const z = f.z;
      if (z - last > 90) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
      }
      // (The rider all but stops as it reaches the place, so a loaded machine's slow screenshot is still taken there:
      // at 30 m/s a still came out 30 to 50 m late.)
      await page.waitForFunction((d) => { const r = window.__gs.run; if (!r || r.sim.s.z >= d) { window.__pinSpeed = 0.5; return true; } return false; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      const name = `m${m}-${f.why}.png`;
      await page.screenshot({ path: c.out + name });
      const st = await page.evaluate(() => window.__frameInfo || null);
      const at = await page.evaluate((v) => { const z = window.__gs.run.sim.s.z; window.__pinSpeed = v; return z; }, c.speed);
      report.push({ name, z, at: Math.round(at * 10) / 10, calls: st && st.calls, tris: st && st.tris });
      last = z;
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
