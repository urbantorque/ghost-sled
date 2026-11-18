// The props lane's triangle breakdown: at given distances on one mountain and tier, every visible mesh's
// triangles (instances times its draw range), the shadow casters counted again, the biggest first, so a frame's
// cost can be laid at the door of what drew it. Run on two builds at the same places to weigh a change.
//   playwright-cli -s=vl-props-desk eval "window.__breakCfg = { base: 'http://127.0.0.1:4604/', tier: 'high', m: 3, zs: [2152, 3405] }"
//   playwright-cli -s=vl-props-desk run-code --filename=scripts/playtest/tris-break.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4604/', tier: 'high', m: 3, zs: [1000], speed: 30, top: 18 }, (await page.evaluate(() => window.__breakCfg).catch(() => null)) || {});
  await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=0`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.evaluate((speed) => {
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed) {
        const q = rr.sim.s;
        const cc = rr.sim.course;
        q.x = cc.safeX(q.z);
        q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * speed) / 2;
        q.vz = speed;
        q.vy = 0;
        q.speed = speed;
        q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
  }, c.speed);
  const out = [];
  for (const z of c.zs) {
    await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
    await page.waitForFunction(() => window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
    await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
    await page.waitForFunction((d) => window.__gs.run.sim.s.z >= d, z, { timeout: 30000, polling: 16 }).catch(() => {});
    const rows = await page.evaluate((top) => {
      const w = window.__gs.world;
      const scene = w.scene;
      const shadows = w.renderer.shadowMap.enabled;
      const list = [];
      scene.updateMatrixWorld();
      const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      scene.traverse((o) => {
        if (!o.isMesh || !visible(o)) return;
        const g = o.geometry;
        if (!g || !g.attributes || !g.attributes.position) return;
        const per = g.index ? g.index.count : g.attributes.position.count;
        const dr = g.drawRange;
        const n = Math.min(per, dr.count === Infinity ? per : dr.count) / 3;
        const inst = o.isInstancedMesh ? o.count : 1;
        if (!inst) return;
        const t = n * inst;
        const name = (o.name || '') + '|' + (o.parent && o.parent.name ? o.parent.name : '') + '|' + (o.material && o.material.type) + '|' + Math.round(n) + 'x' + inst;
        list.push({ name, t, cast: shadows && o.castShadow });
      });
      list.sort((a, b) => b.t - a.t);
      const sum = list.reduce((a, r) => a + r.t * (r.cast ? 2 : 1), 0);
      const meshes = list.length + list.filter((r) => r.cast).length;
      return { sum, meshes, top: list.slice(0, top).map((r) => `${Math.round(r.t)}${r.cast ? '*2' : ''} ${r.name}`) };
    }, c.top);
    out.push({ z, ...rows });
  }
  await page.goto('about:blank');
  return JSON.stringify(out, null, 1);
}
