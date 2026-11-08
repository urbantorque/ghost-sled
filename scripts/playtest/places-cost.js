// What the places cost where they are heaviest: draw calls and triangles summed over a frame's passes,
// and frame times riding through at 30 m/s. Compare two builds interleaved (A, B, B, A): other work on
// the GPU moves these numbers more than a change does.
//   playwright-cli -s=lane-places eval "window.__costCfg = { base: 'http://127.0.0.1:4371/', tag: 'new', jobs: [{ tier: 'high', m: 0, mood: 0, z: 3250, secs: 5 }] }"
//   playwright-cli -s=lane-places run-code --filename=scripts/playtest/places-cost.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4371/', tag: '', jobs: [] }, (await page.evaluate(() => window.__costCfg).catch(() => null)) || {});
  const out = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  for (const j of c.jobs) {
    await page.goto(c.base + `?platform=mock&debug&fps&autoride=1&tier=${j.tier}&m=${j.m}&mood=${j.mood || 0}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const res = await page.evaluate(async ({ z, secs }) => {
      const app = window.__gs;
      const r = app.world.renderer;
      const render = r.render.bind(r);
      let acc = { calls: 0, tris: 0 };
      let last = { calls: 0, tris: 0 };
      r.render = (scene, cam) => {
        render(scene, cam);
        acc.calls += r.info.render.calls;
        acc.tris += r.info.render.triangles;
      };
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          q.x = cc.safeX(q.z);
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * 30) / 2;
          q.vz = 30;
          q.vy = 0;
          q.speed = 30;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
      app.run.sim.s.z = z - 150;
      await new Promise((f) => setTimeout(f, 1500));
      app.run.sim.s.z = z;
      await new Promise((f) => setTimeout(f, 300));
      const ts = [];
      const calls = [];
      const tris = [];
      let t0 = performance.now();
      const end = t0 + secs * 1000;
      await new Promise((done) => {
        const tick = () => {
          const t = performance.now();
          ts.push(t - t0);
          t0 = t;
          if (acc.calls > 0) last = acc;
          calls.push(last.calls);
          tris.push(last.tris);
          acc = { calls: 0, tris: 0 };
          if (t < end) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
      const s = ts.slice(2).sort((a, b) => a - b);
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      const sp = app.world.setPieces;
      return { z, frames: s.length, ms: +mean.toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), worst: +s[s.length - 1].toFixed(1), calls: calls.sort((a, b) => a - b)[Math.floor(calls.length * 0.5)], callsMax: calls[calls.length - 1], trisK: Math.round(tris.sort((a, b) => a - b)[Math.floor(tris.length * 0.5)] / 1000), trisMaxK: Math.round(tris[tris.length - 1] / 1000), maxJob: sp.stats ? +sp.stats.maxJobMs.toFixed(1) : null, madeNow: sp.stats ? sp.stats.madeNow : null };
    }, { z: j.z, secs: j.secs || 5 });
    out.push({ tag: c.tag, tier: j.tier, m: j.m, ...res });
  }
  await page.goto('about:blank');
  return JSON.stringify({ out, errors });
}
