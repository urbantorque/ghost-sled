// Real-input play-test: drives the keyboard with timing, captures screenshots and telemetry.
async (page) => {
  const out = [];
  const snap = async (name) => {
    const t = await page.evaluate(() => {
      const r = window.__gs.run; const s = r.sim.s;
      return { z: +s.z.toFixed(1), v: +s.speed.toFixed(1), air: !s.grounded, drift: s.drifting, tier: s.driftTier, slip: +s.slip.toFixed(2), score: r.sim.score, crashed: s.crashed, cause: s.crashCause };
    });
    await page.screenshot({ path: `shots/${name}.png` });
    out.push({ name, ...t });
  };
  const k = page.keyboard;
  await page.waitForTimeout(1500);
  await snap('pt-start');
  await k.down('ArrowRight'); await page.waitForTimeout(600); await snap('pt-carve-right'); await k.up('ArrowRight');
  await k.down('ArrowLeft'); await page.waitForTimeout(700); await k.up('ArrowLeft');
  await page.waitForTimeout(500);
  // Drift: crouch + hard steer.
  await k.down('Space'); await page.waitForTimeout(120); await k.down('ArrowRight');
  await page.waitForTimeout(900); await snap('pt-drift-mid');
  await page.waitForTimeout(900);
  await k.up('ArrowRight'); await k.up('Space');
  await page.waitForTimeout(150); await snap('pt-drift-pop');
  await page.waitForTimeout(1200);
  // Charged pop + spin.
  await k.down('Space'); await page.waitForTimeout(600); await k.up('Space');
  await page.waitForTimeout(60); await k.down('ArrowLeft'); await page.waitForTimeout(350); await snap('pt-spin'); await k.up('ArrowLeft');
  await page.waitForTimeout(1500);
  await snap('pt-after');
  const fps = await page.evaluate(() => { const f = window.__gs.frameTimes; return +(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(1); });
  return JSON.stringify({ fps, out }, null, 1);
}
