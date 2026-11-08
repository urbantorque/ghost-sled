// The arrangement on a live run (round 6): the band's sections second by second, every drop it lands
// (music.ts plan) against the moments it lands for (stage lines, set pieces' 'enter' and 'start', the finish),
// and the master chain's state. Each pass is a fresh replayed run (?demo=N) or a hands-off cruise (demo: null).
// What it shows: whether a stage line, a set piece's first metre and the finish line land on the band's
// downbeat (|land - crossing| in seconds), how often a chorus (the hook) plays, and that nothing errors.
//   playwright-cli -s=music eval "window.__arrCfg = { base: 'http://127.0.0.1:4401/', passes: [{ m: 0, demo: 0 }] }"
//   playwright-cli -s=music run-code --filename=scripts/playtest/arrange.js
async (page) => {
  const cfg = Object.assign(
    { base: 'http://127.0.0.1:4173/', seconds: 170, passes: null, tier: 'high' },
    (await page.evaluate(() => window.__arrCfg).catch(() => null)) || {},
  );
  const passes = cfg.passes || [{ m: 0, demo: 0 }];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const out = [];
  for (const p of passes) {
    await page.goto(cfg.base + '?platform=mock');
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    const demo = p.demo === undefined ? 0 : p.demo;
    await page.goto(cfg.base + `?platform=mock&debug&tier=${p.tier || cfg.tier}&m=${p.m}&autoride=1` + (demo === null ? '' : `&demo=${demo}`) + (p.mood !== undefined ? `&mood=${p.mood}` : ''));
    await page.waitForFunction(() => window.__gs && window.__gs.audio, null, { timeout: 60000 });
    await page.keyboard.press('q');
    const res = await page.evaluate(async (seconds) => {
      const g = window.__gs;
      const a = g.audio;
      const t0 = performance.now();
      while (!a.debugTap() && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
      const tap = a.debugTap();
      if (!tap) return { error: 'no tap' };
      const ctx = tap.ctx;
      if (ctx.state !== 'running') await ctx.resume().catch(() => null);
      a.setVolumes({ master: 1, music: 0.8, sfx: 0.8 });
      const beats = [];
      const orig = a.beats.bind(a);
      a.beats = (list) => {
        for (const b of list) {
          if (b.type === 'stage' || b.type === 'finish' || b.type === 'marquee' || b.type === 'moment' || b.type === 'crash' || b.type === 'tumble') {
            beats.push({ t: Math.round(ctx.currentTime * 1000) / 1000, type: b.type, phase: b.phase, verb: b.verb, name: b.name, index: b.index, n: b.n, of: b.of, last: b.last });
          }
        }
        orig(list);
      };
      const names = ['intro', 'verse', 'chorus', 'bridge', 'finale'];
      const secs = [];
      const lands = [];
      let lastLand = -1;
      let lastSec = -1;
      let first = null;
      const start = performance.now();
      while (performance.now() - start < seconds * 1000) {
        await new Promise((r) => setTimeout(r, 100));
        const lv = a.debugLevels();
        first = first || lv;
        const now = ctx.currentTime;
        if (lv.landedAgo >= 0 && lv.landedAgo < 1e6) {
          const at = Math.round((now - lv.landedAgo) * 1000) / 1000;
          if (Math.abs(at - lastLand) > 0.05) {
            lands.push(at);
            lastLand = at;
          }
        }
        if (lv.section !== lastSec) {
          secs.push([Math.round(now * 10) / 10, names[lv.section] ?? lv.section]);
          lastSec = lv.section;
        }
        if (g.phase === 'results' && performance.now() - start > 8000) {
          await new Promise((r) => setTimeout(r, 3000));
          break;
        }
      }
      a.beats = orig;
      // Each landmark beat against the nearest landing.
      const near = (t) => lands.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), Infinity);
      const marks = beats
        .filter((b) => b.type === 'stage' || b.type === 'finish' || (b.type === 'marquee' && b.phase === 'enter') || (b.type === 'moment' && b.phase === 'start'))
        .map((b) => ({ ...b, landOff: Math.round((near(b.t) - b.t) * 1000) / 1000 }));
      const lv = a.debugLevels();
      return { lands, secs, marks, moments: beats.filter((b) => b.type === 'moment').length, chain: { sidechain: lv.sidechain, truePeak: lv.truePeak, lite: lv.lite, marks: lv.marks }, phase: g.phase, landings: lv.landings };
    }, p.seconds || cfg.seconds);
    out.push({ m: p.m, demo, ...res });
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors: errors.slice(0, 20), out }, null, 0);
}
