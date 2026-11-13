// Round 7's feel frames: a fall got up from (falling, down, up, riding again) with the get-up pips, the steer
// hint and its leaving, and a gamepad's glyphs on the title, in the hint pill and on the pause card. The pad
// is a scripted one (navigator.getGamepads is replaced before the page loads), read by the game's own poll.
// The fall is asked of the sim directly (a capture, not a record: this run would not replay). One page a call.
//   playwright-cli -s=r7-feel open --config=.playwright/cli-headless.config.json      (or mobile-headless)
//   playwright-cli -s=r7-feel goto http://127.0.0.1:4460/
//   playwright-cli -s=r7-feel eval "window.__feelCfg = { base: 'http://127.0.0.1:4460/', out: 'shots/r7/feel' }"
//   playwright-cli -s=r7-feel run-code --filename=scripts/playtest/feel-frames.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4460/', out: 'shots/r7/feel', tier: 'medium', m: 0 }, (await page.evaluate(() => window.__feelCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  const log = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const shot = async (k) => {
    await page.screenshot({ path: `${cfg.out}/${dev}-${k}.png` });
    log.push(k);
  };
  const state = () => page.evaluate(() => {
    const g = window.__gs;
    const r = g.run;
    if (!r) return { phase: g.phase };
    const s = r.sim.s;
    return { phase: g.phase, z: Math.round(s.z), t: +(r.sim.tick / 60).toFixed(2), fall: s.fall, getUps: s.getUps, tumble: s.tumble, mode: g.input.mode, hint: g.hintShown };
  });
  const until = async (fn, ms = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const st = await state();
      if (fn(st)) return st;
      await page.waitForTimeout(40);
    }
    return state();
  };
  const fresh = async (q) => {
    await page.goto(cfg.base + '?platform=mock');
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${cfg.m}` + q);
  };

  // 1. The steer hint, and its leaving: nobody steers, and it has its eight seconds and goes.
  await fresh('&autoride=1');
  await until((s) => s.phase === 'run' && s.t > 1.5);
  await shot('hint-steer');
  log.push(await until((s) => s.t > 9.6));
  await shot('hint-steer-gone');

  // 2. A fall past the first stretch: falling, down, up, riding again one get-up short, then a second.
  await until((s) => s.z > 760 && s.fall === 0, 90000);
  // A screenshot takes longer than a phase of a fall lasts, so the page itself holds the run still the frame
  // the moment comes (the pause flag, without the pause card), the frame is shot, and the run goes on.
  const held = async (k, fall, tumbleMax) => {
    await page.evaluate(([f, t]) => {
      window.__held = null;
      const g = window.__gs;
      const watch = () => {
        const s = g.run && g.run.sim.s;
        if (!s) return;
        if (s.fall === f && s.tumble <= t) {
          g.paused = true;
          window.__held = { z: Math.round(s.z), t: +(g.run.sim.tick / 60).toFixed(2), fall: s.fall, tumble: s.tumble, getUps: s.getUps };
        } else requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }, [fall, tumbleMax]);
    await page.waitForFunction(() => window.__held, null, { timeout: 20000 });
    await page.waitForTimeout(250);
    log.push(await page.evaluate(() => window.__held));
    await shot(k);
    await page.evaluate(() => { window.__gs.paused = false; });
  };
  const fall = async (tag) => {
    await page.evaluate(() => { const sim = window.__gs.run.sim; sim.s.invuln = 0; sim.s.lantern = Math.min(sim.s.lantern, 50); sim.wipeout('tree'); });
    await held(`${tag}-1-falling`, 1, 72);
    await held(`${tag}-2-down`, 2, 40);
    await held(`${tag}-3-up`, 3, 12);
    await held(`${tag}-4-riding`, 0, 0);
  };
  await fall('fall');
  await fall('fall2');
  await fall('fall3');

  // 3. The gamepad. A scripted pad, read by the game's own poll.
  await page.addInitScript(() => {
    window.__pad = { id: 'Scripted Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), vibrationActuator: null };
    navigator.getGamepads = () => [window.__pad, null, null, null];
  });
  const button = async (i, ms = 140) => {
    await page.evaluate((k) => { window.__pad.buttons[k] = { pressed: true, touched: true, value: 1 }; }, i);
    await page.waitForTimeout(ms);
    await page.evaluate((k) => { window.__pad.buttons[k] = { pressed: false, touched: false, value: 0 }; }, i);
    await page.waitForTimeout(160);
  };
  await fresh('');
  await until((s) => s.phase === 'title', 60000);
  await page.waitForTimeout(1500);
  await shot('pad-title-before');
  // A direction: the pad is the input in use, Ride's prompt is its A, and focus lands on Ride.
  await button(13);
  await page.waitForTimeout(400);
  log.push(await state());
  await shot('pad-title');
  await button(13);
  await button(13);
  await page.waitForTimeout(300);
  await shot('pad-title-focus');
  await button(12);
  await button(12);
  await button(12);
  await page.waitForTimeout(200);
  // Start rides (A would too; Start is not the run's button, so the sled does not hop off the line).
  await button(9);
  const st = await until((s) => s.phase === 'run' && s.t > 1.5, 60000);
  log.push(st);
  await shot('pad-hint-steer');
  // The stick steers: the lesson is learned and the hint goes.
  await page.evaluate(() => { window.__pad.axes[0] = 0.7; });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__pad.axes[0] = 0; });
  await page.waitForTimeout(600);
  log.push(await state());
  await shot('pad-hint-steer-learned');
  // The next lesson with the pad's A in it (the lip, on the first kicker).
  const lip = await until((s) => s.hint && s.hint !== 'steer', 30000);
  log.push(lip);
  await page.waitForTimeout(250);
  await shot('pad-hint-' + (lip.hint || 'none'));
  // Start pauses; the card is the pad's.
  await button(9);
  await page.waitForTimeout(700);
  await shot('pad-pause');
  await button(13);
  await page.waitForTimeout(300);
  await shot('pad-pause-focus');
  await button(9);
  await page.waitForTimeout(500);
  log.push(await state());
  return JSON.stringify({ dev, errors, log });
}
