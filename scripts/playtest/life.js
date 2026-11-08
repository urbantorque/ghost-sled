// The living background: rides a mountain on the safe line at a set speed and shoots bursts of frames
// at set distances (the crowds turning and reacting, animals bolting, birds lifting off), optionally
// a clipped close-up of one part of the frame. Settles per jump so the idle builds are done.
//   playwright-cli -s=life eval "window.__lifeCfg = { base: 'http://127.0.0.1:4401/', out: 'shots/r5/life/', tier: 'high', jobs: [{ m: 0, mood: 0, at: [40, 600], burst: 3, gap: 250 }] }"
//   playwright-cli -s=life run-code --filename=scripts/playtest/life.js
// A job may set `clip: [x, y, w, h]` (CSS px), `speed`, `off` (metres off the safe line), `tier`, `stomp`
// (a list of distances to fire a stomp beat at, to see the crowd cheer and the birds scatter) and `url`
// (extra query, e.g. '&reduced=1'), `vp` ([w, h], a bigger viewport for a close look), `cam` (a fixed lens,
// below) and `lead` (metres before each distance it jumps to; 60).
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4401/', out: 'shots/r5/life/', tier: 'high', speed: 30, tag: '', jobs: [] }, (await page.evaluate(() => window.__lifeCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  for (const job of c.jobs) {
    const tier = job.tier || c.tier;
    await page.setViewportSize({ width: (job.vp || [1280, 720])[0], height: (job.vp || [1280, 720])[1] });
    await page.goto(c.base + `?debug&tier=${tier}&autoride=1&m=${job.m}&mood=${job.mood || 0}${job.url || ''}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(([speed, off]) => {
      window.__pinSpeed = speed;
      window.__pinOff = off;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed >= 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          q.x = cc.safeX(q.z) + (window.__pinOff || 0);
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
          q.vz = v;
          q.vy = 0;
          q.speed = v;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
    }, [job.speed ?? c.speed, job.off ?? 0]);
    // A fixed lens for a close look: `cam` is [ox, oy, oz, tx, ty, tz], the lens and its target as offsets
    // from the rider in world space, put on the camera before every render the game makes.
    await page.evaluate((cam) => {
      window.__camOverride = cam || null;
      const w = window.__gs.world;
      if (w.__camHooked) return;
      w.__camHooked = true;
      const r = w.renderer;
      const orig = r.render.bind(r);
      r.render = (scene, camera) => {
        const o = window.__camOverride;
        const run = window.__gs.run;
        if (o && run && camera && camera.isPerspectiveCamera) {
          // (Round the rider, or round a target found by `find` when `tcam` set one.)
          const s = run.sim.s;
          const t = window.__camTarget || { x: s.x, y: s.y, z: -s.z };
          camera.position.set(t.x + o[0], t.y + o[1], t.z + o[2]);
          camera.lookAt(t.x + o[3], t.y + o[4], t.z + o[5]);
          camera.updateMatrixWorld();
        }
        orig(scene, camera);
      };
    }, job.cam);
    // `find`: jump to `from`, pick the nearest of that kind of life ahead (herd, fox, rock fox,
    // perch, sled, drop), and shoot as the rider comes within each of `dists` metres of it, then
    // `after` ms (each a step) past the last. The shots are frame-exact: the page runs on a virtual
    // clock in 1/60 s steps while they are taken (as strips.js does), so a busy machine moves nothing.
    if (job.find) {
      await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, job.from);
      await page.waitForTimeout(900);
      // (Looked for until one is out, up to `settle` ms: a drop-in comes a few hundred metres on.)
      let target = null;
      for (let tries = 0; !target && tries * 250 < (job.settle ?? 0) + 1; tries++) {
        if (tries) await page.waitForTimeout(250);
        target = await page.evaluate(([kind, zr]) => {
        const life = window.__gs.world.life;
        const z = window.__gs.run.sim.s.z;
        const ahead = (q) => q.z > z + (zr ?? 90);
        let list = [];
        if (kind === 'perch') list = life.flocks.filter((f) => f.perch && f.off === Infinity && ahead(f));
        else {
          const want = { herd: [0, 1], fox: [3], sitfox: [3], sled: [8], drop: [5] }[kind];
          list = life.figs.filter((f) => f.live && want.includes(f.kind) && ahead(f) && (kind !== 'sitfox' || f.sit) && (kind !== 'drop' || f.drop === 1));
        }
        list.sort((a, b) => a.z - b.z);
        if (!list.length) return null;
        const q = list[0];
        const c = window.__gs.run.sim.course;
        // Its place in the world: a flock's first bird, or the figure.
        let w;
        if (kind === 'perch') { const o = life.aOrbit.array; w = { x: o[q.first * 4], y: o[q.first * 4 + 1], z: o[q.first * 4 + 2] }; }
        else { const x = c.centerX(q.z) + q.side * (c.halfWidth(q.z) + q.e); w = { x, y: c.ground(x, q.z), z: -q.z }; }
        return { z: q.z, side: q.side, e: q.e ?? null, w };
        }, [job.find, job.ahead]);
      }
      report.push({ find: job.find, from: job.from, target });
      if (target && job.tcam) {
        // A lens near the target: mirrored to its bank (offsets in x flip with the side).
        const o = job.tcam.slice();
        o[0] *= target.side;
        o[3] *= target.side;
        await page.evaluate(([t, oo]) => { window.__camTarget = t; window.__camOverride = oo; }, [target.w, o]);
      }
      if (target) {
        await page.evaluate(() => {
          const orig = { now: performance.now.bind(performance), raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window), st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window) };
          const vc = { t: performance.now(), q: [], timers: [], id: 1 };
          window.__vc = vc;
          performance.now = () => vc.t;
          window.requestAnimationFrame = (cb) => { vc.q.push(cb); return vc.id++; };
          window.cancelAnimationFrame = () => {};
          window.setTimeout = (fn, ms, ...a) => { const id = vc.id++; vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} }); return id; };
          window.clearTimeout = (id) => { vc.timers = vc.timers.filter((x) => x.id !== id); };
          vc.step = () => {
            vc.t += 1000 / 60;
            const due = vc.timers.filter((x) => x.at <= vc.t);
            if (due.length) vc.timers = vc.timers.filter((x) => x.at > vc.t);
            for (const x of due) { try { x.fn(); } catch (e) { console.error(e); } }
            const q = vc.q;
            vc.q = [];
            for (const cb of q) cb(vc.t);
          };
          // Back to the browser's clock, carrying on from the virtual time, frames and timers handed over.
          vc.restore = () => {
            const off = orig.now() - vc.t;
            performance.now = () => orig.now() - off;
            window.requestAnimationFrame = (cb) => orig.raf((ts) => cb(ts - off));
            window.cancelAnimationFrame = orig.caf;
            window.setTimeout = orig.st;
            window.clearTimeout = orig.ct;
            for (const cb of vc.q) window.requestAnimationFrame(cb);
            for (const x of vc.timers) orig.st(x.fn, Math.max(0, x.at - vc.t));
          };
        });
        try {
          for (const d of job.dists || [60, 40, 25]) {
            await page.evaluate((zz) => { for (let k = 0; k < 1800 && window.__gs.run && window.__gs.run.sim.s.z < zz; k++) window.__vc.step(); }, target.z - d);
            const name = `${c.tag}m${job.m}-${tier}-${job.find}-d${d}.png`;
            await page.screenshot({ path: c.out + name });
            report.push(name);
          }
          let ms = 0;
          for (const dt of job.after || []) {
            ms += dt;
            await page.evaluate((n) => { for (let k = 0; k < n; k++) window.__vc.step(); }, Math.round(dt / (1000 / 60)));
            const name = `${c.tag}m${job.m}-${tier}-${job.find}-t${ms}.png`;
            await page.screenshot({ path: c.out + name });
            report.push(name);
          }
        } finally {
          await page.evaluate(() => window.__vc.restore());
        }
      }
    }
    await page.evaluate(() => { window.__camTarget = null; });
    const list = (job.at || []).slice().sort((a, b) => a - b);
    let last = -1e9;
    for (const z of list) {
      if (z - last > 160) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - (job.lead ?? 60));
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - (job.lead ?? 60));
      }
      await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      if (job.stomp && job.stomp.includes(z)) {
        await page.evaluate(() => {
          // (Straight into the two systems that hear a stomp: the crowd's cheer and the life's startle.)
          const w = window.__gs.world;
          const s = window.__gs.run.sim.s;
          const sp = w.setPieces;
          sp.cheer({ type: 'stomp' }, sp.uniforms.uRider.value, sp.lastT);
          w.life.startle(s.x, s.z, sp.lastT);
        });
      }
      const n = job.burst || 1;
      for (let k = 0; k < n; k++) {
        const name = `${c.tag}m${job.m}-${tier}-z${String(z).padStart(4, '0')}${n > 1 ? '-' + k : ''}.png`;
        await page.screenshot({ path: c.out + name, ...(job.clip ? { clip: { x: job.clip[0], y: job.clip[1], width: job.clip[2], height: job.clip[3] } } : {}) });
        report.push(name);
        if (k + 1 < n) await page.waitForTimeout(job.gap || 250);
      }
      last = z;
    }
    const st = await page.evaluate(() => {
      const w = window.__gs.world;
      const info = w.renderer?.info?.render;
      return { crowd: w.setPieces.crowd.count, calls: info?.calls, tris: info?.triangles, fps: window.__gs.frameStats ? window.__gs.frameStats().fps : null };
    });
    report.push({ m: job.m, tier, st });
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
