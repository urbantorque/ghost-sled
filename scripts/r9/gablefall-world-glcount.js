// Round 9, Gablefall's world (adapted from gullhaven-world-glcount.js): what a frame asks of WebGL on a held run, counted
// exactly (glcount.js's counter), so Gablefall's Low is set against Pinecrest's call for call on the same kind of stretch
// (notes/r9-gablefall-world.md section 0). The sled is held on a line at a speed from `z0` (the street's middle, or with
// line 'roof' the ridge of the right-hand row, gablefall.ts RIDGE), the first `warm` seconds are let go by (streaming,
// idle-time builds), then every call is counted for `seconds`. Counts do not drift with the machine's speed; frames a
// second are the main lane's to time, never this script's. The last frame's triangles are read from three.js.
//   playwright-cli -s=r9-gablefall-world eval "window.__glCfg = { base: 'http://127.0.0.1:5000/', tier: 'low', seed: '5be0cd19', z0: 300 }"
//   playwright-cli -s=r9-gablefall-world --raw run-code --filename=scripts/r9/gablefall-world-glcount.js
// Pinecrest: { m: 0 } in place of the seed.
async (page) => {
  const cfg = { tier: 'low', seed: '', m: 0, z0: 300, v: 30, warm: 8, seconds: 10, save: 'fresh', query: '', kit: false, line: 'street', ...((await page.evaluate(() => window.__glCfg).catch(() => null)) || {}) };
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.addInitScript(() => {
    if (WebGL2RenderingContext.prototype.__countedTris) return;
    WebGL2RenderingContext.prototype.__countedTris = true;
    const counts = new Map();
    // (Triangles and points drawn, summed from the draw calls themselves: three.js resets its own count at every pass.)
    const prims = { tris: 0, points: 0 };
    const add = (mode, n) => { if (mode === 4) prims.tris += n / 3; else if (mode === 0) prims.points += n; };
    let on = false;
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const P = C.prototype;
      for (const k of Object.getOwnPropertyNames(P)) {
        const d = Object.getOwnPropertyDescriptor(P, k);
        if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
        const f = d.value;
        P[k] = function (...a) {
          if (on) {
            counts.set(k, (counts.get(k) ?? 0) + 1);
            if (k === 'drawElements') add(a[0], a[1]);
            else if (k === 'drawArrays') add(a[0], a[2]);
            else if (k === 'drawElementsInstanced') add(a[0], a[1] * a[4]);
            else if (k === 'drawArraysInstanced') add(a[0], a[2] * a[3]);
          }
          return f.apply(this, a);
        };
      }
    }
    window.__gl = { start: () => { counts.clear(); prims.tris = 0; prims.points = 0; on = true; }, stop: () => { on = false; return { counts: [...counts], tris: prims.tris, points: prims.points }; } };
  });
  const q = cfg.seed ? `&seed=${cfg.seed}` : `&m=${cfg.m}`;
  await page.goto(`${cfg.base}?platform=mock&debug&save=${cfg.save}&autoride=1&tier=${cfg.tier}${q}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && (window.__gs.phase === 'run' || window.__gs.dailyReady), null, { timeout: 300000 });
  await page.evaluate(() => window.__gs.phase === 'run' || window.__gs.ride());
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.evaluate(({ z0, v, kit, line }) => {
    const run = window.__gs.run;
    const cc = run.sim.course;
    const at = (z) => (line === 'roof' ? cc.centerX(z) + 11 : kit ? cc.centerX(z) : cc.safeX(z));
    const place = (s) => {
      s.x = at(s.z);
      s.y = cc.ground(s.x, s.z);
      s.vx = ((at(s.z + 1) - at(s.z - 1)) / 2) * v;
      s.vz = v;
      s.vy = 0;
      s.speed = Math.hypot(s.vx, s.vz);
      s.grounded = true;
      s.heading = Math.atan2(s.vx, s.vz);
      s.velHeading = s.heading;
      s.invuln = 30;
    };
    run.sim.s.z = z0;
    place(run.sim.s);
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed && !rr.sim.s.finished) place(rr.sim.s);
      requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
    window.__glf = 0;
    const tick = () => {
      window.__glf++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { z0: cfg.z0, v: cfg.v, kit: !!cfg.seed || cfg.kit, line: cfg.line });
  await page.waitForTimeout(cfg.warm * 1000);
  const z0 = await page.evaluate(() => { window.__glf0 = window.__glf; window.__gl.start(); return Math.round(window.__gs.run.sim.s.z); });
  await page.waitForTimeout(cfg.seconds * 1000);
  const r = await page.evaluate(() => ({ ...window.__gl.stop(), frames: window.__glf - window.__glf0, z: Math.round(window.__gs.run?.sim.s.z ?? 0), programs: window.__gs.world.renderer.info.programs?.length }));
  const f = Math.max(1, r.frames);
  const get = (k) => (r.counts.find(([n]) => n === k)?.[1] ?? 0) / f;
  const total = r.counts.reduce((a, [, n]) => a + n, 0);
  return JSON.stringify({
    cfg: { seed: cfg.seed, m: cfg.m, tier: cfg.tier, z0: cfg.z0, v: cfg.v, save: cfg.save, query: cfg.query, line: cfg.line },
    z: [z0, r.z],
    frames: r.frames,
    programs: r.programs,
    trianglesPerFrame: Math.round(r.tris / f),
    pointsPerFrame: Math.round(r.points / f),
    callsPerFrame: +(total / f).toFixed(1),
    drawsPerFrame: +(get('drawElements') + get('drawArrays') + get('drawElementsInstanced') + get('drawArraysInstanced')).toFixed(1),
    byName: r.counts.sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => `${(n / f).toFixed(1)} ${k}`),
  }, null, 1);
}
