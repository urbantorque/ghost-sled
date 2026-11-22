// The lowperf lane's profile: profile.js's ride (a fresh save, the safe-line pilot, Low, 6x), returning the call tree
// merged by label path (so it can be read offline under any node), plus per-frame counts of the calls that make
// garbage or work outside script: audio nodes made, canvas text drawn, DOM mutations.
//   playwright-cli -s=r8-lowperf eval "window.__lpCfg = { base, m: 2 }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/prof.js
async (page) => {
  const cfg = { m: 2, tier: 'low', throttle: 6, seconds: 20, warm: 8, query: '', prof: true, ...((await page.evaluate(() => window.__lpCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.addInitScript(() => {
    if (window.__lpc) return;
    const c = { on: false, n: {}, st: {}, stack: null };
    window.__lpc = c;
    const wrap = (P, names, pre) => {
      if (!P) return;
      for (const k of names) {
        const f = P[k];
        if (typeof f !== 'function') continue;
        P[k] = function (...a) {
          if (c.on) {
            c.n[pre + k] = (c.n[pre + k] ?? 0) + 1;
            if (c.stack && c.stack.includes(pre + k)) {
              // Who asked: the stack's frames past this wrapper, file positions dropped.
              const st = (new Error().stack ?? '').split('\n').slice(2, 9).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*\)$/, '').replace(/https?:\S+/, '')).join(' < ');
              const key = pre + k + ' ' + st;
              c.st[key] = (c.st[key] ?? 0) + 1;
            }
          }
          return f.apply(this, a);
        };
      }
    };
    const A = window.BaseAudioContext?.prototype;
    if (A) wrap(A, Object.getOwnPropertyNames(A).filter((k) => /^create/.test(k)), 'audio.');
    wrap(window.AudioNode?.prototype, ['connect', 'disconnect'], 'audio.');
    wrap(window.AudioScheduledSourceNode?.prototype, ['start', 'stop'], 'audio.');
    wrap(window.AudioParam?.prototype, ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues', 'setValueCurveAtTime'], 'param.');
    wrap(window.CanvasRenderingContext2D?.prototype, ['measureText', 'fillText', 'strokeText', 'drawImage', 'getImageData', 'putImageData', 'clearRect', 'fillRect'], '2d.');
    wrap(window.OffscreenCanvasRenderingContext2D?.prototype, ['measureText', 'fillText', 'strokeText', 'drawImage', 'clearRect'], 'o2d.');
    wrap(window.WebGL2RenderingContext?.prototype, ['texImage2D', 'texSubImage2D', 'bufferData', 'bufferSubData', 'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'useProgram'], 'gl.');
    // workcal.js's ruler: the same arithmetic every 250 ms, so a run's ms can be read in rulers.
    c.cal = [];
    setInterval(() => {
      if (!c.on) return;
      const t = performance.now();
      let s = 0;
      for (let i = 0; i < 60000; i++) s += Math.sin(i * 0.001) * Math.sqrt(i);
      c.cal.push(performance.now() - t);
      c.sink = s;
    }, 250);
    const mo = new MutationObserver((l) => {
      if (!c.on) return;
      for (const m of l) c.n['dom.' + m.type] = (c.n['dom.' + m.type] ?? 0) + 1;
    });
    const go = () => mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    if (document.documentElement) go();
    else document.addEventListener('DOMContentLoaded', go);
  });
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  await page.evaluate(() => {
    const app = window.__gs;
    const sim = app.run.sim;
    const c = sim.course;
    app.run.input = {
      sample: () => {
        const s = sim.s;
        if (!s.grounded) return { steer: 4, action: false };
        const look = s.z + 4 + s.speed * 0.35;
        const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
        return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false };
      },
    };
    window.__lpf = 0;
    const tick = () => {
      window.__lpf++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout(cfg.warm * 1000);
  if (cfg.prof) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  }
  const z0 = await page.evaluate((stack) => {
    window.__lpf0 = window.__lpf;
    window.__lpt0 = performance.now();
    window.__lpc.n = {};
    window.__lpc.st = {};
    window.__lpc.cal = [];
    window.__lpc.stack = stack;
    window.__lpc.on = true;
    return Math.round(window.__gs.run.sim.s.z);
  }, cfg.stack ?? null);
  if (cfg.prof) await cdp.send('Profiler.start');
  await page.waitForTimeout(cfg.seconds * 1000);
  const prof = cfg.prof ? (await cdp.send('Profiler.stop')).profile : null;
  const r = await page.evaluate(() => {
    window.__lpc.on = false;
    // What the page animates on its own while the ride runs (CSS animations and transitions under way).
    const desc = (el) => (el ? `${el.tagName?.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}` : '?');
    const anims = document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
      const t = a.effect?.target;
      const shown = t && t.isConnected ? getComputedStyle(t).display !== 'none' && t.getClientRects().length > 0 : false;
      return `${a.animationName ?? a.transitionProperty ?? a.constructor.name} ${desc(t)} <${desc(t?.parentElement)}> ${shown ? 'shown' : 'hidden'}`;
    });
    const batch = window.__gs.world?.ghosts?.batch;
    return { cal: window.__lpc.cal.reduce((a, b) => a + b, 0) / Math.max(1, window.__lpc.cal.length), st: window.__lpc.st, frames: window.__lpf - window.__lpf0, s: (performance.now() - window.__lpt0) / 1000, n: window.__lpc.n, z: Math.round(window.__gs.run?.sim.s.z ?? -1), anims, rasters: batch?.rasters, uploads: batch?.uploads, domNodes: document.getElementsByTagName('*').length };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const counts = Object.fromEntries(Object.entries(r.n).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / r.frames).toFixed(2)]));
  let tree = null;
  if (prof) {
    const byId = new Map(prof.nodes.map((n) => [n.id, n]));
    const self = new Map();
    for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) ?? 0) + (prof.timeDeltas[i] ?? 0));
    const label = (n) => {
      const f = n.callFrame;
      return `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`;
    };
    // Merge by label path: out[i] = [parent, label, selfUs, totalUs].
    const out = [];
    const key = new Map();
    const walk = (id, parent) => {
      const n = byId.get(id);
      const l = label(n);
      const k = parent + '|' + l;
      let idx = key.get(k);
      if (idx === undefined) {
        idx = out.length;
        key.set(k, idx);
        out.push([parent, l, 0, 0]);
      }
      const s = self.get(id) ?? 0;
      out[idx][2] += s;
      let t = s;
      for (const c of n.children ?? []) t += walk(c, idx);
      out[idx][3] += t;
      return t;
    };
    walk(prof.nodes[0].id, -1);
    tree = out.map((x) => [x[0], x[1], Math.round(x[2]), Math.round(x[3])]);
  }
  return JSON.stringify({ cfg: { base: cfg.base, m: cfg.m, tier: cfg.tier, throttle: cfg.throttle, query: cfg.query }, z: [z0, r.z], frames: r.frames, fps: +(r.frames / r.s).toFixed(1), calMs: +r.cal.toFixed(3), counts, stacks: Object.entries(r.st).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => `${(v / r.frames).toFixed(3)} ${k}`), anims: r.anims, rasters: r.rasters, uploads: r.uploads, domNodes: r.domNodes, tree });
}
