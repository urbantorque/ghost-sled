// What the page's lifecycle does each frame of a Low ride at 6x, and why: a devtools trace with invalidation
// tracking, read as per-frame counts (style recalcs and the elements they styled, layouts and their dirty
// objects, paints) and the nodes most often invalidated, by reason; plus the CSS animations and transitions seen
// running, sampled every half second through the ride.
//   playwright-cli -s=r8-lowperf eval "window.__ltCfg = { base: 'http://127.0.0.1:4880/', m: 2 }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/lifetrace.js
async (page) => {
  const cfg = { m: 2, tier: 'low', throttle: 6, warm: 8, seconds: 10, query: '', ...((await page.evaluate(() => window.__ltCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
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
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout(cfg.warm * 1000);
  await page.evaluate(() => {
    const desc = (el) => (el ? `${el.tagName?.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}` : '?');
    window.__lt = { f: 0, anims: new Map(), samples: 0 };
    const tick = () => {
      window.__lt.f++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__ltTimer = setInterval(() => {
      const lt = window.__lt;
      lt.samples++;
      for (const a of document.getAnimations()) {
        if (a.playState !== 'running') continue;
        const t = a.effect?.target;
        const k = `${a.animationName ?? a.transitionProperty ?? 'Animation'} ${desc(t)} <${desc(t?.parentElement)}>`;
        lt.anims.set(k, (lt.anims.get(k) ?? 0) + 1);
      }
    }, 500);
  });
  const browser = page.context().browser();
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.invalidationTracking', 'blink'] });
  const f0 = await page.evaluate(() => window.__lt.f);
  await page.waitForTimeout(cfg.seconds * 1000);
  const buf = await browser.stopTracing();
  const r = await page.evaluate(() => {
    clearInterval(window.__ltTimer);
    return { f: window.__lt.f, anims: [...window.__lt.anims].sort((a, b) => b[1] - a[1]), samples: window.__lt.samples };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const frames = Math.max(1, r.f - f0);
  const events = JSON.parse(buf.toString('utf8')).traceEvents || [];
  const threads = new Map();
  for (const e of events) if (e.name === 'FireAnimationFrame') threads.set(`${e.pid}:${e.tid}`, (threads.get(`${e.pid}:${e.tid}`) ?? 0) + 1);
  const main = [...threads].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ev = events.filter((e) => `${e.pid}:${e.tid}` === main);
  const by = new Map();
  const add = (k, n = 1, ms = 0) => {
    const b = by.get(k) ?? { n: 0, sum: 0, ms: 0 };
    b.n++;
    b.sum += n;
    b.ms += ms;
    by.set(k, b);
  };
  const inval = new Map();
  for (const e of ev) {
    const d = e.args?.data ?? e.args?.beginData ?? {};
    const ms = e.dur ? e.dur / 1000 : 0;
    if (e.name === 'UpdateLayoutTree') add('UpdateLayoutTree elements', e.args?.elementCount ?? d.elementCount ?? 0, ms);
    else if (e.name === 'Layout') add('Layout dirty/total', e.args?.beginData?.dirtyObjects ?? 0, ms);
    else if (/^(Paint|PrePaint|Layerize|Commit|UpdateLayer|CompositeLayers|ParseAuthorStyleSheet|RecalculateStyles|HitTest|ScheduleStyleRecalculation|InvalidateLayout|ScrollLayer|UpdateLayerTree)$/.test(e.name)) add(e.name, 1, ms);
    if (/InvalidationTracking$/.test(e.name)) {
      const k = `${e.name.replace('InvalidationTracking', '')} ${d.nodeName ?? ''} ${d.reason ?? ''} ${d.extraData ?? ''} ${(d.invalidationList ?? []).map((x) => x.classes?.join('.') ?? x.id ?? '').join(',')}`.trim();
      inval.set(k, (inval.get(k) ?? 0) + 1);
    }
  }
  const per = [...by].map(([k, b]) => `${(b.n / frames).toFixed(2)}/frame sum ${(b.sum / frames).toFixed(1)}/frame ${(b.ms / frames).toFixed(2)} ms/frame  ${k}`);
  const inv = [...inval].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(v / frames).toFixed(2)}/frame ${k}`);
  return JSON.stringify({ cfg: { base: cfg.base, m: cfg.m, tier: cfg.tier, throttle: cfg.throttle, query: cfg.query }, frames, fps: +(frames / cfg.seconds).toFixed(1), per, inv, anims: r.anims.slice(0, 30).map(([k, v]) => `${(v / r.samples).toFixed(2)} ${k}`) }, null, 1);
}
