// The legend's card: rides a run with the mountain's legend forced (`?legend=1` or 2) and shoots the HUD
// as the card comes up, a moment on, and as it goes.
//   playwright-cli -s=pw eval "window.__legendCfg = { base: 'http://127.0.0.1:4500/game/', out: 'shots/r7/reel/legend/', m: 0, legend: 1 }"
//   playwright-cli -s=pw --raw run-code --filename=scripts/playtest/legend.js
async (page) => {
  const cfg = { m: 0, tier: 'high', legend: 1, out: 'shots/legend/', tag: 'desk', ...((await page.evaluate(() => window.__legendCfg).catch(() => null)) || {}) };
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}&legend=${cfg.legend}`);
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
  const lg = await page.evaluate(() => { const l = window.__gs.run.sim.legend; return l ? { name: l.name, line: l.line, z0: l.z0, kind: l.kind } : null; });
  if (!lg) return JSON.stringify({ error: 'this run has no legend', errors });
  const seen = await page.waitForFunction(() => document.querySelector('.gs-legend'), null, { timeout: 200000, polling: 'raf' }).then(() => true).catch(() => false);
  if (!seen) return JSON.stringify({ error: 'no legend card came up', lg, z: await page.evaluate(() => window.__gs.run?.sim.s.z), errors });
  const shots = [];
  for (const [name, wait] of [['in', 120], ['held', 900], ['late', 1600]]) {
    await page.waitForTimeout(wait);
    const file = `${cfg.out}${cfg.tag}-m${cfg.m}-l${cfg.legend}-${name}.png`;
    await page.screenshot({ path: file });
    shots.push(file.split('/').pop());
  }
  const card = await page.evaluate(() => document.querySelector('.gs-legend')?.textContent ?? null);
  return JSON.stringify({ lg, card, z: await page.evaluate(() => Math.round(window.__gs.run?.sim.s.z ?? 0)), shots, errors });
}
