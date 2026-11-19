// Where a throttled Low frame's time goes, inside the frame callback and outside it: a devtools timeline trace of
// the renderer's main thread over a ride, read as milliseconds a second by kind (the frame callback, the page's
// lifecycle, idle callbacks, timers, garbage collection, other tasks), the frame intervals' spread (how many frames
// took one, two or three vsyncs), and the longest tasks outside the frame callback by what ran in them. Fps under
// vsync is too coarse to see a 2 ms cost; this is the measure to compare two builds or two switches of one build.
//   playwright-cli -s=ft eval "window.__ftCfg = { base: 'http://127.0.0.1:4711/', m: 0, tier: 'low', throttle: 6, query: '&farbake=0' }"
//   playwright-cli -s=ft --raw run-code --filename=scripts/playtest/frametrace.js
// A very first run (the save cleared), the safe-line pilot of perf.js, no `fps` switch (its counter writes a frame).
async (page) => {
  const cfg = { m: 0, tier: 'low', throttle: 6, warm: 8, seconds: 15, query: '', ...((await page.evaluate(() => window.__ftCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
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
    window.__ft = { t: [] };
    const tick = (t) => {
      window.__ft.t.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const browser = page.context().browser();
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'v8', 'blink', 'disabled-by-default-v8.gc'] });
  const z0 = await page.evaluate(() => Math.round(window.__gs.run?.sim.s.z ?? 0));
  await page.waitForTimeout(cfg.seconds * 1000);
  const buf = await browser.stopTracing();
  const r = await page.evaluate(() => ({ t: window.__ft.t, z: Math.round(window.__gs.run?.sim.s.z ?? 0), far: window.__gs.world.far?.stats ?? null }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Frame intervals from the page's own rAF timestamps.
  const iv = [];
  for (let i = 1; i < r.t.length; i++) iv.push(r.t[i] - r.t[i - 1]);
  const span = (r.t[r.t.length - 1] - r.t[0]) / 1000;
  const vs = 1000 / 60;
  const hist = [0, 0, 0, 0, 0];
  for (const d of iv) hist[Math.min(4, Math.max(0, Math.round(d / vs) - 1))]++;
  const sorted = [...iv].sort((a, b) => a - b);
  const events = JSON.parse(buf.toString('utf8')).traceEvents || [];
  const threads = new Map();
  for (const e of events) if (e.name === 'FireAnimationFrame') threads.set(`${e.pid}:${e.tid}`, (threads.get(`${e.pid}:${e.tid}`) ?? 0) + 1);
  const main = [...threads].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ev = events.filter((e) => `${e.pid}:${e.tid}` === main && e.ph === 'X' && e.dur != null).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  // Top-level tasks only (a task's own RunTask nests inside the scheduler's).
  const tasks = [];
  for (const e of ev) {
    if (e.name !== 'ThreadControllerImpl::RunTask' && e.name !== 'RunTask') continue;
    const last = tasks[tasks.length - 1];
    if (last && e.ts < last.ts + last.dur) continue;
    tasks.push(e);
  }
  const tStart = tasks[0]?.ts ?? 0;
  const tEnd = tasks.length ? tasks[tasks.length - 1].ts + tasks[tasks.length - 1].dur : 1;
  const secs = (tEnd - tStart) / 1e6;
  // Each task: what kind it is, by the first event inside it that names one.
  const KINDS = [
    ['FireAnimationFrame', 'raf'],
    ['FireIdleCallback', 'idle'],
    ['TimerFire', 'timer'],
    ['MajorGC', 'gc'],
    ['MinorGC', 'gc'],
    ['V8.GC_SCAVENGER', 'gc'],
    ['V8.GCScavenger', 'gc'],
    ['V8.GC_MARK_COMPACTOR', 'gc'],
    ['ProfileCall', ''],
    ['UpdateLayoutTree', 'lifecycle'],
    ['Layout', 'lifecycle'],
    ['PrePaint', 'lifecycle'],
    ['Paint', 'lifecycle'],
    ['Layerize', 'lifecycle'],
    ['Commit', 'lifecycle'],
    ['EventDispatch', 'event'],
    ['FunctionCall', 'script'],
    ['EvaluateScript', 'script'],
    ['v8.callFunction', 'script'],
    ['ParseHTML', 'parse'],
  ];
  const kindOf = new Map(KINDS);
  const byKind = new Map();
  const cpuKind = new Map();
  const sum = new Map();
  const gcSum = { minor: 0, major: 0, n: 0, longest: 0 };
  const long = [];
  let j = 0;
  for (const t of tasks) {
    const end = t.ts + t.dur;
    let kind = '';
    let fn = '';
    let gcIn = 0;
    while (j < ev.length && ev[j].ts < t.ts) j++;
    for (let k = j; k < ev.length && ev[k].ts < end; k++) {
      const e = ev[k];
      if (e === t) continue;
      sum.set(e.name, (sum.get(e.name) ?? 0) + e.dur);
      if (e.name === 'MinorGC' || e.name === 'MajorGC') {
        gcIn += e.dur;
        if (e.name === 'MinorGC') gcSum.minor += e.dur;
        else gcSum.major += e.dur;
        gcSum.n++;
        gcSum.longest = Math.max(gcSum.longest, e.dur);
      }
      const kk = kindOf.get(e.name);
      if (!kind && kk) {
        kind = kk;
        if (e.name === 'FunctionCall') fn = `${e.args?.data?.functionName || '?'}@${(e.args?.data?.url || '').split('/').pop()}:${e.args?.data?.lineNumber ?? ''}`;
        if (e.name === 'TimerFire' || e.name === 'FireIdleCallback') {
          const f = ev.slice(k + 1, k + 6).find((x) => x.name === 'FunctionCall' && x.ts < end);
          if (f) fn = `${f.args?.data?.functionName || '?'}@${(f.args?.data?.url || '').split('/').pop()}:${f.args?.data?.lineNumber ?? ''}:${f.args?.data?.columnNumber ?? ''}`;
        }
      }
    }
    if (!kind) kind = 'other';
    byKind.set(kind, (byKind.get(kind) ?? 0) + t.dur);
    cpuKind.set(kind, (cpuKind.get(kind) ?? 0) + (t.tdur ?? 0));
    if (kind !== 'raf' && t.dur > 1500) long.push({ ms: +(t.dur / 1000).toFixed(1), kind, fn, gc: +(gcIn / 1000).toFixed(1) });
  }
  const per = (us) => +(us / 1000 / secs).toFixed(1);
  const kinds = Object.fromEntries([...byKind].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, per(v)]));
  const busy = tasks.reduce((a, t) => a + t.dur, 0);
  const lifeNames = [...sum].filter(([k]) => /Lifecycle|UpdateLayoutTree|^Layout$|PrePaint|^Paint$|Layerize|^Commit$/.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${per(v)} ${k}`);
  const longBy = new Map();
  for (const l of long) {
    const k = `${l.kind} ${l.fn}`;
    const o = longBy.get(k) ?? { n: 0, ms: 0, max: 0 };
    o.n++;
    o.ms += l.ms;
    o.max = Math.max(o.max, l.ms);
    longBy.set(k, o);
  }
  const out = {
    cfg: { m: cfg.m, tier: cfg.tier, throttle: cfg.throttle, query: cfg.query, base: cfg.base },
    z: [z0, r.z],
    fps: +(iv.length / span).toFixed(1),
    intervals: { med: +sorted[sorted.length >> 1].toFixed(1), p90: +sorted[Math.floor(sorted.length * 0.9)].toFixed(1), max: +sorted[sorted.length - 1].toFixed(1), vsyncs1to5: hist },
    busyMsPerS: per(busy),
    // Per frame (wall ms, and the thread's own CPU ms, which a throttle does not stretch): the frame callback's
    // task (its script, then the page's lifecycle) and everything else.
    perFrame: (() => {
      const f = iv.length / span * secs;
      const raf = byKind.get('raf') ?? 0;
      const cpu = [...cpuKind.values()].reduce((a, b) => a + b, 0);
      return { raf: +(raf / 1000 / f).toFixed(2), rest: +((busy - raf) / 1000 / f).toFixed(2), rafCpu: +((cpuKind.get('raf') ?? 0) / 1000 / f).toFixed(3), restCpu: +((cpu - (cpuKind.get('raf') ?? 0)) / 1000 / f).toFixed(3), idleCpu: +((cpuKind.get('idle') ?? 0) / 1000 / f).toFixed(3) };
    })(),
    msPerSByKind: kinds,
    msPerSLifecycle: lifeNames.slice(0, 8),
    gc: { msPerS: per(gcSum.minor + gcSum.major), minorMsPerS: per(gcSum.minor), majorMsPerS: per(gcSum.major), perS: +(gcSum.n / secs).toFixed(1), longestMs: +(gcSum.longest / 1000).toFixed(1) },
    longOutsideRaf: [...longBy].sort((a, b) => b[1].ms - a[1].ms).slice(0, 12).map(([k, o]) => `${(o.ms / secs).toFixed(1)} ms/s n=${o.n} max=${o.max} ${k}`),
    far: r.far ? { jobs: r.far.jobs, maxJobMs: +r.far.maxJobMs.toFixed(1), fineMs: Math.round(r.far.fineMs), coarseMs: Math.round(r.far.coarseMs), over: r.far.over, top: r.far.top } : null,
  };
  return JSON.stringify(out, null, 1);
}
