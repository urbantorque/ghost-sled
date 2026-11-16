// The same frames of the same replayed run on any build (the visual lift's temporal lane): a pool rider replayed
// as the player (?demo=N) from a fresh save, on a virtual clock, in long steps to `lead` metres short of each
// distance and then in exact 1/60 s frames (as the shared lane's motion.js and motion30.js), shot at set distances
// and, from each, `burst` more frames `every` steps apart, the HUD hidden. Each shot reports its sim tick: a
// before and an after are the same moment when their ticks match.
// `set` applies [path, value] pairs to the world before the run (a tuning to compare); `extra` is added to the
// page's query (?post=-taa, ?tier=...). Shots are PNGs `<out><tag>-z<dddd>[-<k>].png`.
//   playwright-cli -s=vl-temporal eval "window.__mvCfg = { base: 'http://127.0.0.1:4601/vl-temporal/', out: 'C:/.../', tag: 'after', m: 0, zs: [900, 1800, 3464] }"
//   playwright-cli -s=vl-temporal run-code --filename=scripts/playtest/motion-vl.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4601/vl-temporal/', out: 'shots/x/', tag: 'mo', tier: 'high', m: 0, demo: 2, extra: '', zs: [], burst: 0, every: 2, set: [], lead: 80 },
    (await page.evaluate(() => window.__mvCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  // A fresh save every time: a run changes the field the next one races (the ghosts laid across your runs).
  await page.goto(c.base, { timeout: 120000 });
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (indexedDB.databases) for (const d of await indexedDB.databases()) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}${c.extra}`, { timeout: 120000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate((set) => {
    const w = window.__gs.world;
    for (const [path, val] of set) {
      const ks = path.split('.');
      let o = w;
      for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
      o[ks[ks.length - 1]] = val;
    }
    const vc = { t: performance.now(), q: [], timers: [], id: 1, frames: 0 };
    window.__vc = vc;
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
    vc.step = (dt = 1000 / 60) => {
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
      vc.frames++;
    };
    const r = window.__gs.world.renderer;
    r.info.autoReset = false;
    // Steps until the run reaches z (or ends), up to 600 frames a call: in long steps (the sim catches up tick by
    // tick, so the replay is exact, as motion30.js) to `lead` metres short of it, then in exact 1/60 s frames so
    // the lens, the effects and the temporal history settle on the real step.
    window.__mvTo = (z, lead) => {
      for (let i = 0; i < 600; i++) {
        const run = window.__gs.run;
        if (!run || window.__gs.phase !== 'run') return { end: true };
        if (run.sim.s.z >= z) return { z: run.sim.s.z, f: vc.frames, tick: run.sim.tick };
        vc.step(run.sim.s.z < z - lead ? 50 : 1000 / 60);
      }
      return { more: true };
    };
    window.__mvStep = (n) => {
      r.info.reset();
      for (let i = 0; i < n; i++) {
        if (i === n - 1) r.info.reset();
        vc.step();
      }
      const run = window.__gs.run;
      return { z: run ? Math.round(run.sim.s.z) : -1, tick: run ? run.sim.tick : -1, f: vc.frames, calls: r.info.render.calls, tris: r.info.render.triangles };
    };
  }, c.set);
  const shots = [];
  for (const z of c.zs) {
    let st;
    do st = await page.evaluate(([zz, lead]) => window.__mvTo(zz, lead), [z, c.lead]);
    while (st.more);
    if (st.end) break;
    const info = await page.evaluate(() => window.__mvStep(1));
    const name = `${c.tag}-z${String(z).padStart(4, '0')}`;
    await page.screenshot({ path: `${c.out}${name}.png` });
    shots.push({ name, ...info });
    for (let k = 1; k <= c.burst; k++) {
      const bi = await page.evaluate((n) => window.__mvStep(n), c.every);
      const bn = `${name}-${k}`;
      await page.screenshot({ path: `${c.out}${bn}.png` });
      shots.push({ name: bn, ...bi });
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ shots, errors });
}
