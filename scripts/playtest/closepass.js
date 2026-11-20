// Round 8, the forest lane: close passes, the trees at the lens a clumsy line meets and the pool rider's line never does.
// The stills' virtual clock (stills.js) and fresh save, but the sled is held 1.2 m inside the run's edge on the side
// `side` names (-1 left, 1 right) at 30 m/s for the 70 m before each frame, the same steps on any build, so a pair
// differs by the build alone. A frame is named m<m>-c<z><L|R>.png.
//   playwright-cli -s=st eval "window.__stillsCfg = { base, out, tier: 'high', m: 0, demo: 0, passes: [[1050, -1], [2550, 1]] }"
//   playwright-cli -s=st run-code --filename=scripts/playtest/closepass.js
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
  for (const [z, side] of c.passes) {
    // Jump to 70 m short (the same on every build: the sim is the same), then hold the line by the edge, step by step.
    const st = await page.evaluate(([zz, sd]) => {
      const run = window.__gs.run;
      if (!run || window.__gs.phase !== 'run') return { z: -1 };
      const s = run.sim.s;
      const cc = run.sim.course;
      s.z = zz - 70;
      for (let i = 0; i < 4000 && s.z < zz; i++) {
        if (window.__gs.phase !== 'run') break;
        const x = cc.centerX(s.z) + sd * (cc.halfWidth(s.z) - 1.2);
        s.x = x;
        s.y = cc.ground(x, s.z);
        s.vx = 0;
        s.vz = 30;
        s.vy = 0;
        s.speed = 30;
        s.grounded = true;
        s.crashed = false;
        s.heading = 0;
        s.velHeading = 0;
        s.invuln = 10;
        window.__stTo(s.z + 0.01, 1);
      }
      return { z: s.z, tick: run.sim.tick };
    }, [z, side]);
    if (st.z < 0) break;
    const name = 'm' + c.m + '-c' + String(z).padStart(4, '0') + (side < 0 ? 'L' : 'R') + '.png';
    await page.screenshot({ path: c.out + name });
    shots.push({ name, z, at: Math.round(st.z * 10) / 10, tick: st.tick });
  }
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, tier: c.tier, demo: c.demo, shots, errors });
}
