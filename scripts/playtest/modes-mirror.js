// Round 8, the modes lane: a mirrored run's frames where words and glyphs stand (the start's run-in and its charm gate,
// the second gate close, the FINISH board coming up), a pool rider replayed as the player (?demo=0) from a fresh save
// on a virtual clock in 50 ms steps (coarser than stills.js: this is a check for anything backwards, not a blind pair).
// The HUD's DOM stays on: the canvas's labels and the DOM over it are both looked at.
//   playwright-cli -s=r8-modes eval "window.__mirCfg = { base: 'http://127.0.0.1:4810/', out: 'C:/.../mirror/high/', tier: 'high', m: 0, zs: [95, 1535, 4440] }"
//   playwright-cli -s=r8-modes --raw run-code --filename=scripts/playtest/modes-mirror.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4810/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/modes/mirror/', tier: 'high', m: 0, zs: [95, 1535, 4440], extra: '&mirror' }, (await page.evaluate(() => window.__mirCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(c.base);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=0${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
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
    window.__vc = vc;
    window.__mirTo = (z) => {
      const gs = window.__gs;
      for (let i = 0; i < 200; i++) {
        const r = gs.run;
        if (!r || gs.phase !== 'run') return -1;
        if (r.sim.s.z >= z) return r.sim.s.z;
        vc.step(r.sim.s.z > z - 30 ? 1000 / 60 : 50);
      }
      return gs.run ? gs.run.sim.s.z : -1;
    };
  });
  const shots = [];
  for (const z of c.zs) {
    let at;
    do at = await page.evaluate((zz) => window.__mirTo(zz), z);
    while (at >= 0 && at < z);
    if (at < 0) break;
    // (A few frames on, so the lens and the labels settle on the tick.)
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) window.__vc.step(1000 / 60);
    });
    await page.screenshot({ path: `${c.out}m${c.m}-z${String(z).padStart(4, '0')}.png` });
    shots.push(Math.round(at));
  }
  const flip = await page.evaluate(() => getComputedStyle(window.__gs.world.renderer.domElement).transform);
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, tier: c.tier, shots, flip, errors });
}
