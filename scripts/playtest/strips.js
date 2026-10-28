// Beat strips: short frame sequences around named beats, for the play-test phase. Each strip is 4 to
// 10 screenshots taken at fixed frame offsets after a beat lands (frame 0 is the frame the beat was
// named in), keyed on window.__gs.director.log, plus a probe per frame (camera mode, roll, jolt,
// crash hold, FOV, the time scale and the phase) so a strip can be read as numbers too.
//
// The game runs on a virtual clock while strips are taken: requestAnimationFrame, performance.now and
// setTimeout are driven from here in exact 1/60 s steps, so a screenshot never costs game time and
// every strip is frame-exact (the crash beat's held frame, the 950 or 1,150 ms results). CSS and
// WAAPI animations (HUD stamps, tag rings) still run on the wall clock. The clock is handed back to
// the browser before the script returns, error or not: playwright-cli waits on the page's own
// setTimeout after every command, so a page left on the virtual clock hangs the next command.
//
// Run against a preview build:
//   playwright-cli -s=gs run-code --filename=scripts/playtest/strips.js
// Set window.__stripCfg on the current page first (any page of the build) to change the plan:
//   {
//     label: 'land',                       // file name prefix
//     base: 'http://127.0.0.1:4182/',
//     params: 'tier=medium&m=0',           // extra URL parameters (mood=N, event=N, demo=N, ...)
//     out: 'C:/.../shots/strips',          // absolute folder for the PNGs
//     beats: ['stomp', 'crash'],           // director.log types to strip
//     frames: [0, 3, 6, 10, 15, 24],       // frame offsets after the beat (60 Hz frames)
//     framesFor: { crash: [0, 2, 4, 8, 14, 22, 34, 50, 70, 100] },  // per-type override
//     maxPerType: 1, maxSeconds: 120, after: 0,   // after: ignore beats before this run time (s)
//     pilot: 'mid',                        // 'mid' | 'expert' | 'line' | 'none' (none: ?demo= or autoride)
//     reduced: false,                      // emulate prefers-reduced-motion: reduce
//     synth: false,                        // stand in for director beats a tree has not wired yet (below)
//     save: null,                          // a save object to load before the run (localStorage)
//     runs: 1,                             // runs to ride (Run Again between them) until every type is stripped
//   }
// synth: true adds, only where the director has not named them, the beats the camera and the ghost
// layer read: a crash beat with orbitFrom (and the crash render curve), a bump beat with its side,
// ghostTrick beats from the ghosts' trick streams, and the drift fields on the chase camera target.
// Returns JSON: { label, strips: [{ type, t, files, probes }] }.
async (page) => {
  const defaults = {
    label: 'strip',
    base: 'http://127.0.0.1:4182/',
    params: 'tier=medium&m=0',
    out: null,
    beats: ['stomp', 'crash'],
    frames: [0, 3, 6, 10, 15, 24],
    framesFor: { crash: [0, 2, 4, 8, 14, 22, 34, 50, 70, 100] },
    maxPerType: 1,
    maxSeconds: 120,
    after: 0,
    pilot: 'mid',
    reduced: false,
    synth: false,
    save: null,
    runs: 1,
  };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__stripCfg).catch(() => null)) || {}) };
  const out = (cfg.out || 'shots/strips').replace(/\\/g, '/').replace(/\/$/, '');
  await page.emulateMedia({ reducedMotion: cfg.reduced ? 'reduce' : 'no-preference' });
  const url = `${cfg.base}?platform=mock&debug&autoride=1&${cfg.params}`;
  if (cfg.save) {
    await page.goto(`${cfg.base}?platform=mock&debug`);
    await page.evaluate((s) => {
      for (const k of Object.keys(localStorage)) if (/ghost/i.test(k)) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, cfg.save);
  }
  await page.goto(url);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 30000 });

  // The virtual clock.
  await page.evaluate(() => {
    if (window.__vc && window.__vc.on) return;
    const orig = {
      now: performance.now.bind(performance),
      raf: window.requestAnimationFrame.bind(window),
      caf: window.cancelAnimationFrame.bind(window),
      st: window.setTimeout.bind(window),
      ct: window.clearTimeout.bind(window),
    };
    const vc = { t: performance.now(), q: [], timers: [], id: 1, frames: 0, on: true };
    window.__vc = vc;
    // Back to the browser's clock, carrying on from the virtual time (no jump either way), with the
    // queued frame callbacks and timers handed over.
    vc.restore = () => {
      if (!vc.on) return;
      vc.on = false;
      const off = orig.now() - vc.t;
      performance.now = () => orig.now() - off;
      window.requestAnimationFrame = orig.raf;
      window.cancelAnimationFrame = orig.caf;
      window.setTimeout = orig.st;
      window.clearTimeout = orig.ct;
      for (const cb of vc.q) orig.raf(cb);
      for (const x of vc.timers) orig.st(x.fn, Math.max(0, x.at - vc.t));
      vc.q = [];
      vc.timers = [];
    };
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
    vc.step = (n = 1, dt = 1000 / 60) => {
      for (let i = 0; i < n; i++) {
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
      }
    };
  });

  // Stand-ins for beats the director has not wired yet (synth: true).
  if (cfg.synth) {
    await page.evaluate(() => {
      const app = window.__gs;
      if (app.__stripSynth) return;
      app.__stripSynth = true;
      const d = app.director;
      const CRASH = [
        { at: 0, scale: 0 },
        { at: 0.07, scale: 0 },
        { at: 0.07, scale: 0.3 },
        { at: 0.38, scale: 0.3 },
        { at: 0.435, scale: 0.409 },
        { at: 0.49, scale: 0.65 },
        { at: 0.545, scale: 0.891 },
        { at: 0.6, scale: 1 },
      ];
      const cursors = new Map();
      let lastWhisper = -1e9;
      const pose = {};
      const step = d.step.bind(d);
      d.step = (f) => {
        const o = step(f);
        const sim = f.sim;
        const s = sim.s;
        const has = (type) => o.beats.some((b) => b.type === type);
        const log = (type, extra) => d.log.push({ t: sim.tick / 60, type, named: true, ...extra });
        for (const p of f.events) {
          const e = p.e;
          if (e.type === 'crash' && !has('crash')) {
            // The nearest live ghost within 60 m behind or abreast: its bearing from the wreck.
            let best = null;
            for (const t of f.tracks) {
              const g = f.poses.get(t.entry.id);
              if (!g || g.done) continue;
              const dz = g.z - s.z;
              const dist = Math.hypot(g.x - s.x, dz);
              if (dz > 3 || dist > 60) continue;
              if (!best || dist < best.dist) best = { dist, from: Math.atan2(g.x - s.x, g.z - s.z) };
            }
            o.beats.push({ type: 'crash', tick: p.tick, cause: e.cause, stake: 0, orbitFrom: best ? best.from : null });
            log('crash');
            if (!f.reduced) d.time.curve(CRASH, 'render');
          } else if (e.type === 'bump' && !has('bump')) {
            let side = 1;
            const k0 = Math.floor(s.z / 64);
            for (let k = Math.max(0, k0 - 2); k <= k0 + 2; k++) {
              for (const ob of sim.course.chunk(k).obstacles) if (ob.id === e.id) side = ob.x > s.x ? -1 : 1;
            }
            o.beats.push({ type: 'bump', tick: p.tick, side, bank: false });
            log('bump');
          }
        }
        // Ghost tricks: each track's [tick, quality, halfTurns, flips] stream, near you only.
        if (f.phase === 'run') {
          for (const t of f.tracks) {
            if (!t.ready || !t.tricks) continue;
            let c = cursors.get(t) ?? 0;
            while (c < t.tricks.length && t.tricks[c] <= sim.tick) {
              const [tick, q, half, flips] = [t.tricks[c], t.tricks[c + 1], t.tricks[c + 2], t.tricks[c + 3]];
              c += 4;
              if (sim.tick - tick > 4 || !app.ghosts.pose(t, sim.tick, pose)) continue;
              const gap = pose.z - s.z;
              if (gap > 60 || gap < -20) continue;
              const word = flips > 0 ? (flips === 1 ? 'Backflip' : flips === 2 ? 'Double Backflip' : `${flips} Backflips`) : half > 0 ? `Spin ${half * 180}` : null;
              if (sim.tick - lastWhisper < 90) continue;
              lastWhisper = sim.tick;
              const ghost = { id: t.entry.id, name: t.entry.name, kind: t.entry.kind, dx: pose.x - s.x };
              o.beats.push({ type: 'ghostTrick', tick, ghost, quality: q === 1 ? 'perfect' : q === 2 ? 'sketchy' : 'clean', word, x: pose.x, y: pose.y, z: pose.z });
              log('ghostTrick', { label: word ?? '' });
            }
            cursors.set(t, c);
          }
        }
        return o;
      };
      const beginRun = d.beginRun.bind(d);
      d.beginRun = (r) => {
        cursors.clear();
        lastWhisper = -1e9;
        return beginRun(r);
      };
      // The drift on the chase target (world.ts passes steer only until it is wired).
      const cam = app.world.cam;
      const up = cam.update.bind(cam);
      cam.update = (t, dt) => {
        const s = app.run && app.phase === 'run' ? app.run.sim.s : null;
        if (s && t.drifting === undefined) {
          t.drifting = s.drifting;
          t.driftDir = s.driftDir;
          t.slip = s.slip;
        }
        return up(t, dt);
      };
    });
  }

  const installPilot = (skill, seed) =>
    page.evaluate(({ skill, seed }) => {
      const app = window.__gs;
      const run = app.run;
      if (!run || skill === 'none') return;
      let a = seed >>> 0;
      const rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const sim = run.sim;
      const c = sim.course;
      const P = { flight: 0, spin: 0, wasAir: false, drift: 0, bias: 0 };
      const timeToLand = (s) => {
        let y = s.y, vy = s.vy, x = s.x, z = s.z, t = 0;
        while (t < 4) { vy -= sim.gravity / 60; y += vy / 60; x += s.vx / 60; z += s.vz / 60; t += 1 / 60; if (y <= c.ground(x, z)) break; }
        return { t, x, z };
      };
      const steerTo = (s, target, gain, lat) => {
        const look = s.z + 4 + s.speed * 0.35;
        const err = Math.atan2(target(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * lat;
        return Math.max(0, Math.min(8, Math.round(4 + err * gain)));
      };
      const nextRamp = (s) => {
        for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2; k++) {
          for (const rr of c.zones(k).ramps) {
            if (rr.z + rr.len > s.z + 1 && rr.z - s.z < 70) {
              if (Math.abs(rr.x - c.centerX(rr.z)) > c.halfWidth(rr.z) - 4 || Math.abs(rr.x - c.safeX(rr.z + rr.len)) > 2.5) return null;
              return rr;
            }
          }
        }
        return null;
      };
      const pilot = () => {
        const s = sim.s;
        const T = sim.tick / 60;
        if (s.crashed) return { steer: 4, action: false };
        if (skill === 'line') return { steer: steerTo(s, (z) => c.safeX(z), 14, 0.08), action: false };
        if (!s.grounded) {
          const land = timeToLand(s);
          if (!P.wasAir) {
            P.wasAir = true;
            P.flight = land.t;
            const off = land.x - c.safeX(land.z);
            const room = c.halfWidth(land.z) - Math.abs(land.x - c.centerX(land.z));
            P.spin = land.t > 1.45 && room > 4 && Math.abs(off) < 1.5 && rnd() < (skill === 'expert' ? 0.95 : 0.7) ? (off > 0 ? -1 : 1) : 0;
            P.bias = (rnd() - 0.5) * (skill === 'expert' ? 0.05 : 0.16);
          }
          let steer = 4;
          let goal = (skill === 'expert' && P.flight > 2.4 ? 4 : 2) * Math.PI;
          if (goal > 2 * Math.PI && land.t < (goal - Math.abs(s.airYaw)) / 9 + 0.3) goal = 2 * Math.PI;
          const coast = (s.spinRate * s.spinRate) / 44;
          if (P.spin && Math.abs(s.airYaw) + coast < goal - 0.12 && land.t > 0.2) steer = P.spin > 0 ? 8 : 0;
          else {
            const off = land.x - c.safeX(land.z);
            if (Math.abs(off) > 0.8) steer = off > 0 ? 2 : 6;
          }
          const w = land.t - P.bias;
          return { steer, action: w < 0.11 && w > 0.01 };
        }
        P.wasAir = false;
        const ramp = nextRamp(s);
        let target = (z) => c.safeX(z);
        if (ramp) target = () => ramp.x;
        const bend = c.safeX(s.z + 24) - c.safeX(s.z + 4);
        const room = c.halfWidth(s.z) - Math.abs(s.x - c.centerX(s.z));
        if (!ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) P.drift = T + 0.4 + rnd() * 0.4;
        if (P.drift > T && (room < 4 || Math.abs(s.x - c.safeX(s.z)) > 0.8)) P.drift = T;
        if (P.drift > T) return { steer: bend > 0 ? 8 : 0, action: true };
        if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
        if (P.drift < 0 && T > -P.drift) P.drift = 0;
        let action = false;
        if (ramp) {
          const u = (s.z - ramp.z) / ramp.len;
          action = u > -0.7 && u < 0.85;
        }
        return { steer: steerTo(s, target, 14, ramp ? 0 : 0.08), action };
      };
      run.input = { sample: pilot };
    }, { skill, seed });

  const probe = () =>
    page.evaluate(() => {
      const app = window.__gs;
      const cam = app.world.cam;
      const j = cam.joltNow ?? { right: 0, up: 0, back: 0 };
      const ts = app.director.time;
      const p = cam.camera.position;
      return {
        frame: window.__vc.frames,
        t: app.run ? +(app.run.sim.tick / 60).toFixed(3) : null,
        phase: app.phase,
        mode: cam.mode,
        roll: +(cam.rollNow ?? 0).toFixed(4),
        jolt: [+j.right.toFixed(4), +j.up.toFixed(4), +j.back.toFixed(4)],
        hold: +(cam.holdNow ?? 0).toFixed(3),
        fov: +cam.camera.fov.toFixed(2),
        lens: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
        feed: ts.feed,
        render: ts.render,
        // The crash orbit's angle round the wreck and the pack's bearing it is swinging to (null once
        // there, or with no ghost behind).
        orbit: +(cam.orbitAngle ?? 0).toFixed(3),
        orbitFrom: cam.orbitFrom ?? null,
      };
    });

  const strips = [];
  const counts = {};
  const done = () => cfg.beats.every((b) => (counts[b] || 0) >= cfg.maxPerType);
  let logIdx = 0;
  let seed = 4321;
  let error = null;
  try {
    for (let r = 0; r < cfg.runs && !done(); r++) {
      if (r > 0) {
        await page.evaluate(() => window.__gs.runAgain());
        for (let k = 0; k < 600; k++) {
          const ph = await page.evaluate(() => (window.__vc.step(1), window.__gs.phase));
          if (ph === 'run') break;
        }
        logIdx = 0;
      }
      await installPilot(cfg.pilot, seed++);
      // A frame budget per run as well as the sim-time cap: the sim stops at a crash, so a crash that
      // never reached the results would otherwise step forever.
      const frameCap = (await page.evaluate(() => window.__vc.frames)) + Math.ceil(cfg.maxSeconds * 60) + 1200;
      for (;;) {
        const res = await page.evaluate(
          ({ want, idx, after, maxSeconds, frameCap }) => {
            const app = window.__gs;
            const vc = window.__vc;
            for (let i = 0; i < 120; i++) {
              vc.step(1);
              const log = app.director.log;
              if (log.length < idx) idx = 0;
              for (; idx < log.length; idx++) {
                const e = log[idx];
                if (want.includes(e.type) && e.t >= after) return { hit: { type: e.type, t: e.t, label: e.label ?? null }, idx: idx + 1 };
              }
              if (app.phase === 'results' || app.phase === 'title') return { end: true, idx };
              if (app.run && app.run.sim.tick / 60 > maxSeconds) return { end: true, idx };
              if (vc.frames > frameCap) return { end: true, idx };
            }
            return { idx };
          },
          { want: cfg.beats.filter((b) => (counts[b] || 0) < cfg.maxPerType), idx: logIdx, after: cfg.after, maxSeconds: cfg.maxSeconds, frameCap },
        );
        logIdx = res.idx;
        if (res.end) break;
        if (!res.hit) continue;
        const type = res.hit.type;
        const n = (counts[type] = (counts[type] || 0) + 1);
        const frames = (cfg.framesFor && cfg.framesFor[type]) || cfg.frames;
        const strip = { type, t: res.hit.t, label: res.hit.label, files: [], probes: [] };
        let at = 0;
        for (const k of frames) {
          if (k > at) {
            await page.evaluate((m) => window.__vc.step(m), k - at);
            at = k;
          }
          const file = `${out}/${cfg.label}-${type}${n > 1 ? n : ''}-f${String(k).padStart(3, '0')}.png`;
          await page.screenshot({ path: file });
          strip.files.push(file);
          strip.probes.push({ k, ...(await probe()) });
        }
        strips.push(strip);
        if (done()) break;
        // The strip may have ridden through the results: the run is over.
        const ph = await page.evaluate(() => window.__gs.phase);
        if (ph === 'results' || ph === 'title') break;
      }
    }
  } catch (e) {
    error = String((e && e.message) || e);
  } finally {
    await page.evaluate(() => window.__vc && window.__vc.restore()).catch(() => undefined);
  }
  // (run-code has no file system or timers: the caller keeps the JSON, e.g. by redirecting stdout.)
  return JSON.stringify({ label: cfg.label, reduced: cfg.reduced, counts, error, strips });
}
