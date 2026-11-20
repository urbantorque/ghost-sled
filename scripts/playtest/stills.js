// Round 8: still frames that hold the run still, for blind before-and-after pairs. frames.js shoots a live pilot's
// run, so two builds' frames at the same metre differ in where the rider is, which ghost is in view and what the HUD
// says, and a critic judges the run rather than the change. Here a pool rider is replayed as the player (?demo=N:
// its own inputs, dashes and wards) on a virtual clock, exactly as motion30.js does, and each frame is the first
// tick at or past its metre, so two builds with the same sim and pools show the same tick: the same rider pose, the
// same ghosts, the same light. The HUD's DOM is hidden; labels drawn in the canvas stay (they are part of the picture
// and the same on both builds). Effects that roll Math.random may differ; the sim does not.
//   playwright-cli -s=st eval "window.__stillsCfg = { base: 'http://127.0.0.1:4860/', out: 'C:/.../high/', tier: 'high', m: 0, demo: 0, zs: [300, 900] }"
//   playwright-cli -s=st run-code --filename=scripts/playtest/stills.js
// scripts/playtest/stills.sh shoots the round's fixed list (frames-r7.json) for every mountain on the tiers named.
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4860/', out: 'shots/r8/stills/', tier: 'high', m: 0, demo: 0, zs: [300], extra: '' },
    (await page.evaluate(() => window.__stillsCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  if (c.width && c.height) await page.setViewportSize({ width: c.width, height: c.height });
  // A fresh save every load: a save left by the last load lays a different field (a first run's riders read you).
  await page.goto(c.base);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate(() => {
    const vc = { t: performance.now(), q: [], timers: [], id: 1 };
    performance.now = () => vc.t;
    window.requestAnimationFrame = (cb) => {
      vc.q.push(cb);
      return vc.id++;
    };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn, ms, ...a) => {
      const id = vc.id++;
      vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} });
      return id;
    };
    window.clearTimeout = (id) => {
      vc.timers = vc.timers.filter((x) => x.id !== id);
    };
    vc.step = (dt) => {
      vc.t += dt;
      const due = vc.timers.filter((x) => x.at <= vc.t);
      if (due.length) vc.timers = vc.timers.filter((x) => x.at > vc.t);
      for (const x of due) {
        try {
          x.fn();
        } catch (e) {
          console.error(e);
        }
      }
      const q = vc.q;
      vc.q = [];
      for (const cb of q) cb(vc.t);
    };
    const zNow = () => {
      const r = window.__gs.run;
      return r && window.__gs.phase === 'run' ? r.sim.s.z : -1;
    };
    window.__stSkip = (zTo) => {
      for (let i = 0; i < 400; i++) {
        const z = zNow();
        if (z < 0) return { end: true, z };
        if (z >= zTo) return { done: true, z };
        vc.step(50);
      }
      return { more: true, z: zNow() };
    };
    // Exact steps until the sled reaches z (at most n of them), then the tick it is on.
    window.__stTo = (z, n) => {
      for (let i = 0; i < n; i++) {
        const now = zNow();
        if (now < 0 || now >= z) break;
        vc.step(1000 / 60);
      }
      const r = window.__gs.run;
      return { z: zNow(), tick: r ? r.sim.tick : -1 };
    };
  });
  const shots = [];
  for (const z of [...c.zs].sort((a, b) => a - b)) {
    let st;
    // Exact 1/60 s steps from the start line (a coarse fast-forward leaves the camera's smoothing with a different
    // history, so the same tick was framed differently), handing back to the driver every 300 steps.
    do st = await page.evaluate((zz) => window.__stTo(zz, 300), z);
    while (st.z >= 0 && st.z < z);
    if (st.z < 0) break;
    const name = `m${c.m}-z${String(z).padStart(4, '0')}.png`;
    await page.screenshot({ path: `${c.out}${name}` });
    shots.push({ z, at: Math.round(st.z * 10) / 10, tick: st.tick });
  }
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, tier: c.tier, demo: c.demo, shots, errors });
}
