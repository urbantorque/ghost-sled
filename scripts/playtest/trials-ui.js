// Round 8, the trials lane: the week's Trial in the browser, one week a pass. A save with the Almanac's page 35 open
// (Trials); the title on the Cup (the week's two halves under Ride), the Trial picked (its rule and targets over Ride),
// the medal wall; then a run of the Trial ridden by one of its own field's riders replayed as the player (`demo`), shot
// at its start (the twist named, the stage line's target) and on, and the results with the medal it won; the save's
// Trial, the results' line and the console.
//   playwright-cli -s=r8-trials eval "window.__trCfg = { base: 'http://127.0.0.1:4890/', out: '<abs>/', tier: 'high', tag: 'desk', week: '2026-W48', demo: 12 }"
//   playwright-cli -s=r8-trials --raw run-code --filename=scripts/playtest/trials-ui.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4890/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/trials/ui/', tier: 'high', tag: 'desk', week: '2026-W48', demo: 12, ride: true }, (await page.evaluate(() => window.__trCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  const name = (s) => `${c.out}${c.tag}-${c.week}-${s}.png`;
  await page.goto(c.base);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  const t0 = Date.now();
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&week=${c.week}&demo=${c.demo}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title' && document.querySelector('.gs-ride'), null, { timeout: 120000 });
  const cold = Date.now() - t0;
  await page.evaluate(() => {
    const gs = window.__gs;
    const d = gs.save.data;
    d.runs = 120;
    d.ghostsPassed = 900;
    d.rank = { xp: 120000, claimed: 36 };
    gs.save.flush();
    gs.refreshTitle();
  });
  await page.waitForFunction(() => window.__gs.trialReady, null, { timeout: 180000, polling: 500 });
  const gen = Date.now() - t0;
  const state = () =>
    page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      return {
        selected: window.__gs.trialPick ? 'trial' : window.__gs.mountain.id,
        place: q('.gs-t-place')?.textContent ?? null,
        panel: q('.gs-t-trial')?.textContent ?? null,
        week: [...document.querySelectorAll('.gs-t-week .gs-t-hour-opt')].map((b) => ({ label: b.textContent, aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') })),
        ride: q('.gs-ride')?.getAttribute('aria-label') ?? null,
        rideLine: q('.gs-ride-mtn')?.textContent ?? null,
        news: q('.gs-t-news')?.textContent ?? null,
      };
    });
  const out = { cfg: c, cold, gen, trial: await page.evaluate(() => ({ ...window.__gs.trial, goals: window.__gs.trialGoals })), title: {} };
  await page.waitForTimeout(1200);
  out.title.start = await state();
  await page.screenshot({ path: name('title-news') });
  await page.evaluate(() => document.querySelector('[data-fk="cup"]')?.click());
  await page.waitForTimeout(2800);
  out.title.cup = await state();
  await page.screenshot({ path: name('title-cup') });
  await page.evaluate(() => document.querySelector('[data-fk="week-trial"]')?.click());
  await page.waitForTimeout(3200);
  out.title.trial = await state();
  await page.screenshot({ path: name('title-trial') });
  await page.evaluate(() => document.querySelector('[data-fk="medals"]')?.click());
  await page.waitForTimeout(700);
  await page.screenshot({ path: name('title-medals') });
  out.title.wall = await page.evaluate(() => document.querySelector('.gs-wall')?.textContent ?? null);
  await page.evaluate(() => document.querySelector('[data-fk="medals"]')?.click());
  await page.waitForTimeout(400);
  if (c.ride) {
    await page.evaluate(() => document.querySelector('.gs-ride')?.click());
    await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 20000 });
    out.run = await page.evaluate(() => ({ key: window.__gs.mountainKey(), config: window.__gs.run.sim.config, mirror: window.__gs.mirrorRun }));
    // The reveal (a mood or an event) collapses about 2.2 s in; the twist's card follows it.
    await page.waitForTimeout(out.trial.sky === 'mood' || out.trial.sky === 'event' ? 3000 : 1300);
    await page.screenshot({ path: name('run-start') });
    out.run.toast = await page.evaluate(() => [...document.querySelectorAll('.gs-toast')].map((e) => e.textContent));
    out.run.stage = await page.evaluate(() => document.querySelector('.gs-leg-t')?.textContent ?? null);
    await page.waitForTimeout(9000);
    await page.screenshot({ path: name('run-mid') });
    out.run.stageMid = await page.evaluate(() => document.querySelector('.gs-leg-t')?.textContent ?? null);
    await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 300000, polling: 500 });
    await page.waitForTimeout(6500);
    await page.screenshot({ path: name('results') });
    out.results = await page.evaluate(() => ({ out: window.__gs.trialOut, save: window.__gs.save.data.trials, line: window.__gs.results?.raceLine, button: window.__gs.results?.spine?.primary ?? window.__gs.results?.runAgainLabel, finish: window.__gs.results?.finish?.medal, tally: window.__gs.trialTally }));
  }
  out.errors = errors;
  return JSON.stringify(out, null, 1);
}
