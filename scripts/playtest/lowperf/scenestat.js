// What the world's scene graph holds a Low ride in (unthrottled, at fromZ): objects by kind, how many are visible,
// how many three.js walks each frame (visible, with every ancestor visible), how many keep matrixAutoUpdate (their
// matrix recomposed every frame), and the biggest groups by such descendants, named by their path.
//   playwright-cli -s=r8-lowperf eval "window.__ssCfg = { base: 'http://127.0.0.1:4880/', m: 2, atZ: 400 }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/scenestat.js
async (page) => {
  const cfg = { m: 2, tier: 'low', atZ: 400, query: '', ...((await page.evaluate(() => window.__ssCfg).catch(() => null)) || {}) };
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  await page.evaluate(() => {
    const app = window.__gs;
    const sim = app.run.sim;
    const c = sim.course;
    app.run.input = {
      sample: () => {
        const s = sim.s;
        if (!s.grounded) return { steer: 4, action: false };
        const look = s.z + 4 + s.speed * 0.35;
        const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
        return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false };
      },
    };
  });
  await page.waitForFunction((z) => window.__gs.run && window.__gs.run.sim.s.z >= z, cfg.atZ, { timeout: 120000, polling: 500 });
  return await page.evaluate(() => {
    const w = window.__gs.world;
    const scene = w.scene;
    const st = { all: 0, visible: 0, walked: 0, auto: 0, autoWalked: 0, meshes: 0, walkedMeshes: 0, byType: {} };
    const groups = [];
    const name = (o) => o.name || o.type;
    const walk = (o, path, shown) => {
      st.all++;
      st.byType[o.type] = (st.byType[o.type] ?? 0) + 1;
      if (o.visible) st.visible++;
      const on = shown && o.visible;
      if (on) st.walked++;
      if (o.matrixAutoUpdate) st.auto++;
      if (o.matrixAutoUpdate && on) st.autoWalked++;
      if (o.isMesh || o.isPoints || o.isLine) {
        st.meshes++;
        if (on) st.walkedMeshes++;
      }
      let n = 0;
      for (const c of o.children) n += walk(c, path + '/' + name(c), on);
      if (o.children.length >= 8) groups.push([path, o.children.length, n, on]);
      return n + (on ? 1 : 0);
    };
    walk(scene, 'scene', true);
    groups.sort((a, b) => b[2] - a[2]);
    return JSON.stringify({ z: Math.round(window.__gs.run.sim.s.z), st, groups: groups.slice(0, 25).map((g) => `${g[2]} walked of ${g[1]} children ${g[3] ? '' : '(hidden) '}${g[0]}`) }, null, 1);
  });
}
