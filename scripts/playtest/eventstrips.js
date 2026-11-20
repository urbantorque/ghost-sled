// Round 8, the events lane: strips of the game's events on a virtual clock, for before-and-after pairs. A pool
// rider is replayed as the player (?demo=N: its own inputs, dashes and wards), as stills.js and motion30.js do, so
// two builds with the same sim and pools reach the same tick with the same rider; each strip starts on the first
// frame whose sim tick is at or past the event's and shoots `n` frames `every` steps apart (1/60 s each).
//   scan   (cfg.scan: true) rides the whole run in long steps and returns every event worth a strip: the sim's
//          landings, dashes, wards, tumbles and crash (read through Run.drain) and the director's passes, finish
//          and new best (director.log), each with its tick and metre.
//   shoot  (cfg.events: [{ name, tick, n, every, lead }]) rides once from the start, exact steps from `lead`
//          ticks before each event, and writes <out><name>-<k>.png. With cfg.gl it counts the GL calls of the
//          frame after each shot (glcount.js's wrapper), so a held event frame's calls compare build to build.
//   playwright-cli -s=r8-events eval "window.__evCfg = { base: 'http://127.0.0.1:4770/', m: 0, demo: 0, scan: true }"
//   playwright-cli -s=r8-events --raw run-code --filename=scripts/playtest/eventstrips.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4770/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/events/x/', tier: 'high', m: 0, demo: 0, scan: false, events: [], gl: false, extra: '', width: 0, height: 0 },
    (await page.evaluate(() => window.__evCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  if (c.width && c.height) await page.setViewportSize({ width: c.width, height: c.height });
  if (c.gl) {
    await page.addInitScript(() => {
      if (WebGL2RenderingContext.prototype.__counted) return;
      WebGL2RenderingContext.prototype.__counted = true;
      let n = 0;
      let on = false;
      for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
        const P = C.prototype;
        for (const k of Object.getOwnPropertyNames(P)) {
          const d = Object.getOwnPropertyDescriptor(P, k);
          if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
          const f = d.value;
          P[k] = function (...a) {
            if (on) n++;
            return f.apply(this, a);
          };
        }
      }
      window.__gl = { start: () => { n = 0; on = true; }, stop: () => { on = false; return n; } };
    });
  }
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
    // The run's events as the app drains them, and the director's log: what a strip can be keyed to.
    const seen = [];
    let hooked = null;
    const hook = () => {
      const r = window.__gs.run;
      if (!r || r === hooked) return;
      hooked = r;
      const drain = r.drain.bind(r);
      r.drain = () => {
        const out = drain();
        for (const p of out) {
          const e = p.e;
          const s = r.sim.s;
          if (e.type === 'land' && e.quality !== 'hop') seen.push({ tick: p.tick, type: 'land', q: e.quality, air: Math.round(e.airtime * 100) / 100, z: Math.round(s.z) });
          else if (e.type === 'dash' || e.type === 'tumble') seen.push({ tick: p.tick, type: e.type, q: e.phase, z: Math.round(s.z) });
          else if (e.type === 'ward' || e.type === 'crash') seen.push({ tick: p.tick, type: e.type, z: Math.round(s.z) });
        }
        return out;
      };
    };
    hook();
    const tickNow = () => {
      const r = window.__gs.run;
      return r ? r.sim.tick : -1;
    };
    const live = () => {
      const g = window.__gs;
      return g.run && g.phase === 'run';
    };
    window.__evScan = () => {
      for (let i = 0; i < 300; i++) {
        hook();
        if (!live()) return { end: true, tick: tickNow() };
        vc.step(50);
      }
      return { more: true, tick: tickNow() };
    };
    window.__evLog = () => {
      const d = window.__gs.director;
      const log = d && d.log ? d.log.filter((x) => x.type === 'pass' || x.type === 'finish' || x.type === 'newBest' || x.type === 'stomp' || x.type === 'crash').map((x) => ({ tick: Math.round(x.t * 60), type: x.type, label: x.label, word: x.word })) : [];
      const r = window.__gs.run;
      return { seen, log, finished: r ? r.sim.s.finished : null, crashed: r ? r.sim.s.crashed : null, phase: window.__gs.phase };
    };
    // Exact steps until the sim's tick reaches `t` (at most n of them).
    window.__evTo = (t, n) => {
      for (let i = 0; i < n; i++) {
        const now = tickNow();
        if (now < 0 || now >= t || !live()) break;
        vc.step(1000 / 60);
      }
      return { tick: tickNow(), live: !!live() };
    };
    window.__evSkip = (t) => {
      for (let i = 0; i < 300; i++) {
        const now = tickNow();
        if (now < 0 || now >= t || !live()) return { done: true, tick: now };
        vc.step(50);
      }
      return { more: true, tick: tickNow() };
    };
    window.__evStep = (k, gl) => {
      if (gl && window.__gl) window.__gl.start();
      for (let i = 0; i < k; i++) vc.step(1000 / 60);
      const calls = gl && window.__gl ? window.__gl.stop() / k : null;
      const r = window.__gs.run;
      return { tick: tickNow(), z: r ? Math.round(r.sim.s.z * 10) / 10 : -1, phase: window.__gs.phase, calls };
    };
  });
  if (c.scan) {
    let st;
    do st = await page.evaluate(() => window.__evScan());
    while (st.more);
    const out = await page.evaluate(() => window.__evLog());
    await page.goto('about:blank');
    return JSON.stringify({ m: c.m, demo: c.demo, ...out, errors });
  }
  const shots = [];
  for (const ev of [...c.events].sort((a, b) => a.tick - b.tick)) {
    const lead = ev.lead ?? 150;
    let st;
    do st = await page.evaluate((t) => window.__evSkip(t), ev.tick - lead);
    while (st.more);
    do st = await page.evaluate((t) => window.__evTo(t, 300), ev.tick);
    while (st.live && st.tick < ev.tick);
    const n = ev.n ?? 8;
    const every = ev.every ?? 3;
    const frames = [];
    for (let k = 0; k < n; k++) {
      const name = `${ev.name}-${k}.png`;
      await page.screenshot({ path: `${c.out}${name}` });
      const r = await page.evaluate(([kk, gl]) => window.__evStep(kk, gl), [every, !!c.gl && k < 4]);
      frames.push(r);
    }
    shots.push({ name: ev.name, tick: ev.tick, frames });
  }
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, demo: c.demo, tier: c.tier, shots, errors });
}
