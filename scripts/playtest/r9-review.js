// Round 9 review captures on the live build: a fresh save's title, three runs to results (as r8-screens.js), the
// returning title, the garage's tabs poor and with gifts, and the title's panels; each screen's visible text kept.
// Escape did not close the garage in its first use, so the panels after it came out as the garage again.
//   playwright-cli -s=r9 eval "window.__rvCfg = { base: 'https://urbantorque.github.io/ghost-sled/', out: 'C:/.../shots/r9/review/', tag: 'desk', tier: 'high' }"
//   playwright-cli -s=r9 --raw run-code --filename=scripts/playtest/r9-review.js
async (page) => {
  const c = Object.assign({ base: 'https://urbantorque.github.io/ghost-sled/', out: 'shots/r9/review/', tag: 'desk', tier: 'high', runs: 3, from: 3900 }, (await page.evaluate(() => window.__rvCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 240)); });
  const texts = {};
  const shoot = async (name) => {
    await page.screenshot({ path: c.out + `${c.tag}-${name}.png` }).catch(() => {});
    texts[name] = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, '\n').trim()).catch(() => null);
  };
  const phase = (p, t = 90000) => page.waitForFunction((p) => window.__gs && window.__gs.phase === p, p, { timeout: t, polling: 50 }).catch(() => {});
  const buttons = () => page.evaluate(() => Array.from(document.querySelectorAll('button, [role=tab], [role=button]')).filter((b) => b.checkVisibility && b.checkVisibility({ visibilityProperty: true, opacityProperty: true })).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)));
  const report = { buttons: {} };

  // 1. A fresh save's title.
  await page.goto(c.base + `?debug&tier=${c.tier}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await phase('title');
  await page.waitForTimeout(2000);
  await shoot('01-title-fresh');
  report.buttons.fresh = await buttons();
  await page.waitForTimeout(3000);
  await shoot('02-title-fresh-5s');

  // 2. Three runs on Pinecrest to their results.
  const pinFrom = (from) => page.evaluate((from) => {
    window.__pinOn = true;
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed && window.__pinOn) {
        const q = rr.sim.s, cc = rr.sim.course;
        q.x = cc.safeX(q.z); q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * 30) / 2; q.vz = 30; q.vy = 0; q.speed = 30;
        q.grounded = true; q.heading = Math.atan2(q.vx, q.vz); q.velHeading = q.heading; q.invuln = 10;
      }
      if (window.__pinOn) requestAnimationFrame(pin);
    };
    pin();
    window.__gs.run.sim.s.z = Math.max(window.__gs.run.sim.s.z, from);
  }, from);
  const reach = (z) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 60000, polling: 32 }).catch(() => {});
  await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=0`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await phase('run');
  await page.waitForTimeout(1500);
  await shoot('03-run1-start');
  for (let run = 1; run <= c.runs; run++) {
    await page.waitForTimeout(800);
    await pinFrom(c.from);
    const fz = await page.evaluate(() => window.__gs.run.sim.course.finishZ);
    await reach(fz - 40);
    await page.evaluate(() => { window.__pinOn = false; });
    await phase('results', 60000);
    const t0 = Date.now();
    for (const ms of [1500, 4500, 9000]) {
      const wait = t0 + ms - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      await shoot(`1${run}-results-r${run}-${ms}`);
    }
    report.buttons[`results${run}`] = await buttons();
    if (run === c.runs) break;
    await page.keyboard.press('Space');
    await phase('run');
  }

  // 3. The returning title.
  await page.goto(c.base + `?debug&tier=${c.tier}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await phase('title');
  await page.waitForTimeout(3000);
  await shoot('20-title-returning');
  report.buttons.returning = await buttons();

  // 4. The garage, poor then with gifts, each tab.
  const garageTabs = async (pfx) => {
    await page.getByRole('button', { name: /Garage/ }).first().click().catch((e) => errors.push('garage: ' + String(e).slice(0, 120)));
    await page.waitForTimeout(1500);
    await shoot(`${pfx}-garage`);
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).filter((b) => b.checkVisibility()).map((b) => (b.textContent || '').trim()));
    report.buttons[pfx] = tabs;
    let i = 0;
    for (const t of tabs) {
      await page.getByRole('tab', { name: t, exact: true }).first().click().catch(() => {});
      await page.waitForTimeout(900);
      await shoot(`${pfx}-garage-${++i}-${t.replace(/[^A-Za-z]+/g, '')}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  };
  await garageTabs('30');
  await page.evaluate(() => { window.__gs.save.data.gifts = 6000; });
  await garageTabs('40');

  // 5. The title's panels.
  for (const [n, re] of [['50-menu', /^Menu$/], ['51-missions', /^Missions/], ['52-medals', /^Medals/], ['53-twelve', /^The Twelve/], ['54-cup', /Weekly Cup/], ['55-flame', /flame/i]]) {
    const b = page.getByRole('button', { name: re }).first();
    if (!(await b.isVisible().catch(() => false))) { report.buttons[n] = 'absent'; continue; }
    await b.click().catch(() => {});
    await page.waitForTimeout(1200);
    await shoot(n);
    report.buttons[n] = await buttons();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, texts, errors });
}
