// The garage with a look worn: gives the save gifts, buys and wears a hat and a scarf, opens the garage and
// shoots the Sleds tab (its seated preview should wear them) and the Sounds tab, presses Listen and reads
// the master's level while it plays. Desktop or phone, from the session's viewport.
//   playwright-cli -s=gl eval "window.__glCfg = { base: 'http://127.0.0.1:4320/', out: 'shots/r6/garage' }"
//   playwright-cli -s=gl run-code --filename=scripts/playtest/garage-look.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', out: 'shots/r6/garage', hat: 'trapper', scarf: 'streamer' }, (await page.evaluate(() => window.__glCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(cfg.base + '?platform=mock&debug');
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.keyboard.press('q');
  await page.evaluate(([hat, scarf]) => {
    const g = window.__gs;
    g.save.data.gifts = 5000;
    g.garage('hat', hat);
    g.garage('scarf', scarf);
  }, [cfg.hat, cfg.scarf]);
  // Wearing the look through the garage opens its sheet (app.ts garage shows the shelves).

  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${cfg.out}/${dev}-sleds.png` });
  await page.getByRole('tab', { name: 'Sounds', exact: true }).click();
  await page.waitForTimeout(600);
  const tile = page.getByRole('button', { name: /Sleigh Bells/ }).first();
  await tile.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${cfg.out}/${dev}-sounds.png` });
  // Listen, and read the master's level while it plays against before.
  const level = await page.evaluate(async () => {
    const tap = window.__gs.audio.debugTap();
    if (!tap) return { error: 'no tap' };
    const an = tap.ctx.createAnalyser();
    an.fftSize = 2048;
    tap.out.connect(an);
    const buf = new Float32Array(an.fftSize);
    const rms = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); };
    const sample = async (ms) => { let m = 0; const t = performance.now(); while (performance.now() - t < ms) { m = Math.max(m, rms()); await new Promise((r) => setTimeout(r, 30)); } return m; };
    const before = await sample(600);
    return { before, button: !!document.querySelector('.gs-listen'), ctx: tap.ctx.state, _an: true };
  });
  await page.getByRole('button', { name: /Listen to/ }).click();
  const during = await page.evaluate(async () => {
    const tap = window.__gs.audio.debugTap();
    const an = tap.ctx.createAnalyser();
    an.fftSize = 2048;
    tap.out.connect(an);
    const buf = new Float32Array(an.fftSize);
    let m = 0;
    const t = performance.now();
    while (performance.now() - t < 2200) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; m = Math.max(m, Math.sqrt(s / buf.length)); await new Promise((r) => setTimeout(r, 30)); }
    return { max: m, worn: window.__gs.audio.sledSound };
  });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.__gs.audio.sledSound);
  return JSON.stringify({ errors, level, during, wornAfter: after }, null, 0);
}
