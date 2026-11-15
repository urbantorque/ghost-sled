// A mountain's best 30 seconds in motion on the top tier, for a store page (round 7): a pool rider replayed as the
// player (?demo=N: its dashes, wards and lines as it rode them) on a virtual clock. Up to `z0 - lead` the clock
// runs in long steps (the sim catches up tick by tick, so the replay is exact); from there in exact 1/60 s steps,
// and from `z0` a frame is shot every other step for `secs` seconds (30 fps), the HUD hidden (its banners run on
// the wall clock and would double-expose). The frames are JPEGs in `out`; encode-motion.mjs makes the clip.
//   playwright-cli -s=mo30 open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=mo30 eval "window.__m30Cfg = { base: 'http://127.0.0.1:4536/', out: 'C:/.../frames/m0/', m: 0, demo: 2, z0: 3250 }"
//   playwright-cli -s=mo30 run-code --filename=scripts/playtest/motion30.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4536/', out: 'shots/r7/motion/frames/', tier: 'ultra', m: 0, demo: 2, z0: 3000, lead: 90, secs: 30, every: 2, width: 1920, height: 1080, quality: 92, extra: '' },
    (await page.evaluate(() => window.__m30Cfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.setViewportSize({ width: c.width, height: c.height });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate(() => {
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
      vc.frames++;
    };
    const zNow = () => {
      const r = window.__gs.run;
      return r && window.__gs.phase === 'run' ? r.sim.s.z : -1;
    };
    // Long steps to the window's lead-in, handing back now and then so the page stays responsive.
    window.__m30Skip = (zTo) => {
      for (let i = 0; i < 400; i++) {
        const z = zNow();
        if (z < 0) return { end: true, z };
        if (z >= zTo) return { done: true, z };
        vc.step(50);
      }
      return { more: true, z: zNow() };
    };
    window.__m30Step = (n) => {
      for (let i = 0; i < n; i++) vc.step(1000 / 60);
      return { z: zNow(), phase: window.__gs.phase };
    };
  });
  let st;
  do st = await page.evaluate((z) => window.__m30Skip(z), c.z0 - c.lead);
  while (st.more);
  // Exact frames from the lead-in: the camera and the effects settle on the real step.
  do st = await page.evaluate(() => window.__m30Step(6));
  while (st.z >= 0 && st.z < c.z0);
  const n = Math.round(c.secs * (60 / c.every));
  let shot = 0;
  const zs = [];
  for (; shot < n; shot++) {
    await page.screenshot({ path: `${c.out}f${String(shot).padStart(4, '0')}.jpg`, type: 'jpeg', quality: c.quality });
    st = await page.evaluate((k) => window.__m30Step(k), c.every);
    if (shot % 30 === 0) zs.push(Math.round(st.z));
    if (st.z < 0 || st.phase !== 'run') break;
  }
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, demo: c.demo, z0: c.z0, frames: shot, zBySecond: zs, errors });
}
