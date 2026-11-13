// The pipeline's own play-test (round 7, the pipe lane): the same frame with a pass on and off, and the
// GPU time of each pass.
//
// Shots. For each job it rides the safe line at a pinned speed to each distance (as frames.js does),
// stops the game's frame loop on that frame, and redraws the very same scene once for each variant
// (a `?post=` spec, a `?postview=` view, held cine values), so a before and an after differ by the pass
// and nothing else. A variant with `live: true` is shot with the loop running instead (motion blur needs
// a lens that moved).
//
// Times. With `time: N` a job then rides on for N seconds a variant with the GPU timer on
// (EXT_disjoint_timer_query_webgl2) and reports the mean milliseconds of each span of the frame (scene,
// ao, shafts, dof, lens, bloom, composite), with draw calls and triangles summed over every pass.
// These are a lane's numbers from a shared laptop: compare variants within one run, never across runs.
//
// Shimmer. With `shimmer: N` a job also measures how much each still variant's edges crawl: the frozen
// frame is drawn N times with the lens moved by parts of a pixel (a Halton set inside one pixel), and
// the report gives the luma's standard deviation over those draws, per pixel: its mean and its 99th
// percentile (in thousandths of full white) and `crawl`, the share of pixels (per cent) that move by
// more than 4% of white. A picture with no aliasing still moves a little under a part-pixel shift, so
// only compare variants of the same frame. A variant may set `msaa` and `settle` (draws per shift,
// for a pass with a history).
//
//   playwright-cli -s=r7-pipe open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=r7-pipe eval "window.__pipeCfg = { base: 'http://127.0.0.1:4410/', out: 'C:/.../shots/r7/pipe/', jobs: [{ tier: 'ultra', m: 0, at: [707, 3400], variants: [{ tag: 'off', post: 'none' }, { tag: 'on', post: 'all' }] }] }"
//   playwright-cli -s=r7-pipe run-code --filename=scripts/playtest/pipe.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4410/', out: 'shots/r7/pipe/', speed: 30, hud: true, jobs: [] }, (await page.evaluate(() => window.__pipeCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  for (const job of c.jobs) {
    const tier = job.tier || 'high';
    const m = job.m || 0;
    const speed = job.speed || c.speed;
    await page.goto(c.base + `?platform=mock&debug&tier=${tier}&autoride=1&m=${m}&mood=${job.mood || 0}${job.extra || ''}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate((v) => {
      window.__pinSpeed = v;
      const raf = window.requestAnimationFrame.bind(window);
      window.__raf = raf;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const sp = window.__pinSpeed;
          q.x = cc.safeX(q.z);
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * sp) / 2;
          q.vz = sp;
          q.vy = 0;
          q.speed = sp;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
        }
        raf(pin);
      };
      pin();
      const w = window.__gs.world;
      const r = w.renderer;
      r.info.autoReset = false;
      const tick = () => { window.__frameInfo = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.reset(); raf(tick); };
      raf(tick);
      // Applies a variant: the switches, the view, the held cine values.
      window.__pipeApply = (v) => {
        const sw = w.post.pipe.switches;
        const names = Object.keys(sw);
        const spec = v.post == null ? 'all' : v.post;
        const tokens = spec.split(',').map((t) => t.trim()).filter(Boolean);
        const only = tokens.some((t) => t === 'none' || t === 'off' || (!t.startsWith('-') && t !== 'all' && names.includes(t)));
        for (const k of names) sw[k] = !only;
        for (const t of tokens) {
          if (t === 'all') for (const k of names) sw[k] = true;
          else if (t.startsWith('-') && names.includes(t.slice(1))) sw[t.slice(1)] = false;
          else if (names.includes(t)) sw[t] = true;
        }
        w.post.configure(w.quality.passes);
        if (v.msaa != null) w.post.setMsaa(v.msaa);
        w.post.pipe.view = v.view || 'none';
        w.cineHold = v.cine || { dof: 0, motionBlur: 0, letterbox: 0 };
        if (v.set) v.set.forEach(([path, val]) => { const ks = path.split('.'); let o = w; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; });
      };
      // Stops the game's loop after its current frame, and redraws that frame on demand.
      window.__pipeFreeze = (on) => {
        if (on) { window.__held = []; window.requestAnimationFrame = (cb) => { window.__held.push(cb); return 0; }; }
        else { window.requestAnimationFrame = raf; const h = window.__held || []; window.__held = null; for (const cb of h) raf(cb); }
      };
      // The crawl of a frozen frame under part-pixel moves of the lens (see the header).
      window.__pipeShimmer = async (n, settle) => {
        const cam = w.cam.camera;
        const gl = r.getContext();
        const W = gl.drawingBufferWidth;
        const H = gl.drawingBufferHeight;
        const sum = new Float32Array(W * H);
        const sq = new Float32Array(W * H);
        const buf = new Uint8Array(W * H * 4);
        const halton = (i, b) => { let f = 1; let x = 0; while (i > 0) { f /= b; x += f * (i % b); i = Math.floor(i / b); } return x; };
        for (let k = 0; k < n; k++) {
          cam.setViewOffset(W, H, halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5, W, H);
          await new Promise((res) => raf(() => {
            Object.assign(w.cine, w.cineHold || {});
            for (let s = 0; s < (settle || 1); s++) w.post.render(w.scene, cam);
            gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            for (let i = 0, p = 0; i < W * H; i++, p += 4) {
              const l = (0.299 * buf[p] + 0.587 * buf[p + 1] + 0.114 * buf[p + 2]) / 255;
              sum[i] += l;
              sq[i] += l * l;
            }
            res(true);
          }));
        }
        cam.clearViewOffset();
        const sd = new Float32Array(W * H);
        let mean = 0;
        let crawl = 0;
        for (let i = 0; i < W * H; i++) {
          const m = sum[i] / n;
          const s = Math.sqrt(Math.max(0, sq[i] / n - m * m));
          sd[i] = s;
          mean += s;
          if (s > 0.04) crawl++;
        }
        sd.sort();
        const r3 = (x) => Math.round(x * 10000) / 10;
        return { mean: r3(mean / (W * H)), p99: r3(sd[Math.floor(W * H * 0.99)]), crawl: Math.round((crawl / (W * H)) * 10000) / 100 };
      };
      window.__pipeRedraw = () => new Promise((res) => raf(() => {
        Object.assign(w.cine, w.cineHold || {});
        w.post.render(w.scene, w.cam.camera);
        raf(() => res(true));
      }));
    }, speed);
    if (!c.hud) await page.addStyleTag({ content: '#ui, .gs-hud, [class*="hud"] { visibility: hidden !important; }' });
    let last = -1e9;
    for (const z of job.at || []) {
      if (z - last > 160) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
      }
      await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      const still = (job.variants || []).filter((v) => !v.live);
      if (still.length) {
        await page.evaluate(() => window.__pipeFreeze(true));
        await page.waitForTimeout(60);
        for (const v of still) {
          await page.evaluate((vv) => window.__pipeApply(vv), v);
          // Twice: the first draw after a switch may compile a program or rebuild a target.
          await page.evaluate(() => window.__pipeRedraw());
          await page.evaluate(() => window.__pipeRedraw());
          const name = `${tier}-m${m}-z${String(z).padStart(4, '0')}-${v.tag}.png`;
          if (!v.noshot) await page.screenshot({ path: c.out + name });
          const row = { name };
          if (job.shimmer) row.shimmer = await page.evaluate(([n, s]) => window.__pipeShimmer(n, s), [job.shimmer, v.settle || 1]);
          report.push(row);
        }
        await page.evaluate(() => window.__pipeFreeze(false));
      }
      for (const v of (job.variants || []).filter((x) => x.live)) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 25);
        await page.evaluate((vv) => window.__pipeApply(vv), v);
        await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
        const name = `${tier}-m${m}-z${String(z).padStart(4, '0')}-${v.tag}.png`;
        await page.screenshot({ path: c.out + name });
        report.push({ name });
      }
      last = z;
    }
    if (job.time) {
      const from = job.timeFrom || 300;
      for (const v of job.variants || []) {
        await page.evaluate(([vv, zz]) => {
          window.__pipeApply(vv);
          window.__gs.run.sim.s.z = zz;
          const t = window.__gs.world.post.pipe.timer;
          t.on = true;
          t.reset();
          window.__acc = { n: 0, calls: 0, tris: 0, dt: [], last: performance.now() };
          const a = window.__acc;
          const tick = () => {
            if (window.__acc !== a) return;
            const now = performance.now();
            a.dt.push(now - a.last);
            a.last = now;
            const fi = window.__frameInfo;
            if (fi) { a.n++; a.calls += fi.calls; a.tris += fi.tris; }
            window.__raf(tick);
          };
          window.__raf(tick);
        }, [v, from]);
        // The first second settles (a rebuilt target, a compiled program).
        await page.waitForTimeout(1000);
        await page.evaluate(() => { const a = window.__acc; a.n = 0; a.calls = 0; a.tris = 0; a.dt.length = 0; window.__gs.world.post.pipe.timer.reset(); });
        await page.waitForTimeout(job.time * 1000);
        const res = await page.evaluate(() => {
          const a = window.__acc;
          window.__acc = null;
          const t = window.__gs.world.post.pipe.timer;
          const dt = a.dt.slice().sort((x, y) => x - y);
          const ms = {};
          let total = 0;
          for (const k of Object.keys(t.ms)) { ms[k] = Math.round(t.ms[k] * 100) / 100; total += t.ms[k]; }
          return { gpu: ms, gpuTotal: Math.round(total * 100) / 100, calls: Math.round(a.calls / Math.max(1, a.n)), tris: Math.round(a.tris / Math.max(1, a.n)), frameMedian: Math.round(dt[Math.floor(dt.length / 2)] * 10) / 10, frameP90: Math.round(dt[Math.floor(dt.length * 0.9)] * 10) / 10, timer: t.available, plan: Object.assign({}, window.__gs.world.post.pipe.plan), size: [window.__gs.world.renderer.domElement.width, window.__gs.world.renderer.domElement.height] };
        });
        report.push(Object.assign({ tier, m, tag: v.tag }, res));
      }
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
