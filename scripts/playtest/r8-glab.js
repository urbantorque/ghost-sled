// Round 8, the play lane: what the charm gates cost a frame, counted exactly in one build (glcount.js's counter):
// the same approach to a gate ridden twice on a virtual clock, once as built and once with the gates' draw switched
// off, so nothing else in the frame differs. A build apart would also count every other lane's change.
//   playwright-cli -s=r8-play eval "window.__glabCfg = { base: 'http://127.0.0.1:4830/', tier: 'low' }"
//   playwright-cli -s=r8-play --raw run-code --filename=scripts/playtest/r8-glab.js
async (page) => {
  const cfg = { base: 'http://127.0.0.1:4830/', tier: 'low', m: 0, query: '&charms=all&gates=3', speed: 30, ...((await page.evaluate(() => window.__glabCfg).catch(() => null)) || {}) };
  await page.addInitScript(() => {
    if (WebGL2RenderingContext.prototype.__counted) return;
    WebGL2RenderingContext.prototype.__counted = true;
    const counts = new Map();
    let on = false;
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const P = C.prototype;
      for (const k of Object.getOwnPropertyNames(P)) {
        const d = Object.getOwnPropertyDescriptor(P, k);
        if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
        const f = d.value;
        P[k] = function (...a) {
          if (on) counts.set(k, (counts.get(k) ?? 0) + 1);
          return f.apply(this, a);
        };
      }
    }
    window.__gl = { start: () => { counts.clear(); on = true; }, stop: () => { on = false; return [...counts]; } };
  });
  const out = [];
  for (const gatesOn of [true, false, true, false]) {
    await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
    const r = await page.evaluate(async (c) => {
      const app = window.__gs;
      const vc = { t: performance.now(), q: [] };
      performance.now = () => vc.t;
      window.requestAnimationFrame = (cb) => { vc.q.push(cb); return 1; };
      const step = () => { vc.t += 1000 / 60; const q = vc.q; vc.q = []; for (const cb of q) cb(vc.t); };
      const w = app.world;
      // Built on idle time after the first frame: wait for it (on the real clock) before riding.
      const t0 = Date.now();
      while (!w.charmGates.drawn.in && Date.now() - t0 < 15000) { step(); await new Promise((res) => setTimeout(res, 50)); }
      if (!c.gatesOn) {
        w.charmGates.update = () => {};
        if (w.charmGates.mesh) w.charmGates.mesh.visible = false;
      }
      const pin = () => {
        const s = app.run.sim.s;
        const cc = app.run.sim.course;
        s.x = cc.safeX(s.z);
        s.y = cc.ground(s.x, s.z);
        s.vx = ((cc.safeX(s.z + 1) - cc.safeX(s.z - 1)) * c.speed) / 2;
        s.vz = c.speed;
        s.vy = 0;
        s.speed = c.speed;
        s.grounded = true;
        s.heading = Math.atan2(s.vx, s.vz);
        s.velHeading = s.heading;
        s.invuln = 10;
      };
      // The second gate's approach: from 240 m out (it fades in from about 460) to just short of its line.
      const g = app.run.sim.charmGates[1] || app.run.sim.charmGates[0];
      c.from = g.z - 240;
      c.to = g.z - 5;
      app.run.sim.s.z = c.from - 60;
      for (let i = 0; i < 90; i++) { pin(); step(); }
      while (app.run.sim.s.z < c.from) { pin(); step(); }
      window.__gl.start();
      let frames = 0;
      let drawn = 0;
      while (app.run.sim.s.z < c.to) { pin(); step(); frames++; drawn += w.charmGates.drawn.count > 0 ? 1 : 0; }
      const counts = window.__gl.stop();
      const per = (re) => counts.filter(([k]) => re.test(k)).reduce((a, [, v]) => a + v, 0) / frames;
      return { gateZ: g.z, frames, gateFrames: drawn, calls: +per(/./).toFixed(1), draws: +per(/^draw/).toFixed(2), uniforms: +per(/^uniform/).toFixed(1), programs: +per(/^useProgram$/).toFixed(2) };
    }, { ...cfg, gatesOn });
    out.push({ gatesOn, ...r });
  }
  await page.goto('about:blank');
  return JSON.stringify({ cfg, out }, null, 1);
}
