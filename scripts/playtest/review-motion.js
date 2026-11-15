// The review loop's frames in motion: a pool rider's real run (?demo=N, no pinned speed), three stills
// 0.25 s apart at each distance named, so a hero vista and a set piece are judged as they are ridden.
//   playwright-cli -s=rv open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=rv eval "window.__motionCfg = { base: 'http://127.0.0.1:4533/', out: 'C:/.../motion/', m: 3, at: [250, 900] }"
//   playwright-cli -s=rv run-code --filename=scripts/playtest/review-motion.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4533/', out: 'shots/r7/x/', tier: 'high', m: 3, demo: 2, at: [300], stills: 3, gap: 250 }, (await page.evaluate(() => window.__motionCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=0&demo=${c.demo}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 180000, waitUntil: 'domcontentloaded' });
  const shot = [];
  for (const z of c.at) {
    const ok = await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 90000, polling: 16 }).then(() => true).catch(() => false);
    if (!ok) break;
    for (let i = 0; i < c.stills; i++) {
      const name = `m${c.m}-motion-z${String(z).padStart(4, '0')}-${i}.png`;
      await page.screenshot({ path: c.out + name });
      shot.push(name);
      await page.waitForTimeout(c.gap);
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ shot, errors });
}
