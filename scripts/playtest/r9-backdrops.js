// Round 9, the screens lane: clean frames of the game (the overlay hidden) for the screens' prototypes to stand over:
// each mountain's title shot, a run won to its results, a run finished down the field, and a wreck. The rider is held
// on the line for the finishes (as r9-review.js does), so their times are not real; the frame is what matters. The
// wreck is the sim's own crash, called as a tree would call it, with its event handed to the game as a step would.
//   playwright-cli -s=r9-screens eval "window.__bdCfg = { base: 'http://127.0.0.1:4930/', out: 'C:/.../shots/r9/screens/backdrops/', tag: 'desk' }"
//   playwright-cli -s=r9-screens --raw run-code --filename=scripts/playtest/r9-backdrops.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4930/', out: 'shots/r9/screens/backdrops/', tag: 'desk', tier: 'high', titles: [0, 1, 2, 3, 4], runs: ['win', 'field', 'wreck'], w: 0, h: 0 }, (await page.evaluate(() => window.__bdCfg).catch(() => null)) || {});
  if (c.w && c.h) await page.setViewportSize({ width: c.w, height: c.h });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 240)); });
  const phase = (p, t = 90000) => page.waitForFunction((p) => window.__gs && window.__gs.phase === p, p, { timeout: t, polling: 50 }).catch(() => {});
  const hideUi = () => page.evaluate(() => { for (const el of document.querySelectorAll('.gs-ui')) el.style.visibility = 'hidden'; });
  const shot = async (name) => {
    await hideUi();
    await page.waitForTimeout(250);
    await page.screenshot({ path: c.out + `${c.tag}-${name}.jpg`, type: 'jpeg', quality: 84 }).catch((e) => errors.push('shot ' + String(e).slice(0, 120)));
  };
  // A fresh browser's first loads stall: warm the origin once.
  await page.goto(c.base + `?debug&tier=${c.tier}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await phase('title');
  await page.waitForTimeout(1500);

  const names = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
  for (const m of c.titles) {
    await page.goto(c.base + `?debug&tier=${c.tier}&m=${m}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await phase('title');
    await page.waitForTimeout(4500);
    await shot(`title-${names[m]}`);
  }

  // Runs to their results, the rider held on the line from `from` at `speed`.
  const pin = (from, speed) => page.evaluate(([from, speed]) => {
    window.__pinOn = true;
    const go = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed && window.__pinOn) {
        const q = rr.sim.s, cc = rr.sim.course;
        q.x = cc.safeX(q.z); q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * speed) / 2; q.vz = speed; q.vy = 0; q.speed = speed;
        q.grounded = true; q.heading = Math.atan2(q.vx, q.vz); q.velHeading = q.heading; q.invuln = 10;
      }
      if (window.__pinOn) requestAnimationFrame(go);
    };
    go();
    window.__gs.run.sim.s.z = Math.max(window.__gs.run.sim.s.z, from);
  }, [from, speed]);
  const reach = (z) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 90000, polling: 32 }).catch(() => {});
  for (const kind of c.runs) {
    await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=0`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await phase('run');
    await page.waitForTimeout(1200);
    if (kind === 'wreck') {
      await pin(2600, 26);
      await reach(2700);
      await page.evaluate(() => { window.__pinOn = false; const rr = window.__gs.run; rr.sim.s.getUps = 0; rr.sim.s.invuln = 0; rr.sim.crash('tree'); rr.pending.push({ tick: rr.sim.tick, e: { type: 'crash', cause: 'tree' } }); });
    } else {
      // A win rides the last stretch fast from far up; down the field rides it slowly from near the line.
      await pin(kind === 'win' ? 3900 : 4150, kind === 'win' ? 30 : 15);
      const fz = await page.evaluate(() => window.__gs.run.sim.course.finishZ);
      await reach(fz - 40);
      await page.evaluate(() => { window.__pinOn = false; });
    }
    await phase('results', 90000);
    await page.waitForTimeout(3200);
    await shot(`results-${kind}`);
    const place = await page.evaluate(() => document.querySelector('.gs-mo-fig')?.textContent ?? '').catch(() => '');
    errors.push(`(${kind}: ${place})`);
  }
  await page.goto('about:blank');
  return JSON.stringify({ errors });
}
