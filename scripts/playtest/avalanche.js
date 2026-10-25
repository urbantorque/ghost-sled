// Rides into an avalanche with a cautious real-keyboard pilot and screenshots the rear-view mirror.
async (page) => {
  await page.goto('http://127.0.0.1:4173/?platform=mock&tier=high&debug&fps&autoride=1&m=0&event=1');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  // Bring the event forward so the chase comes before the pilot meets anything it cannot steer round.
  await page.evaluate(() => { const r = window.__gs.run; r.sim.dyn.triggerZ = Math.min(r.sim.dyn.triggerZ, r.sim.s.z + 60); });
  const held = new Set();
  const t0 = Date.now();
  let shot = false;
  while (Date.now() - t0 < 120000 && !shot) {
    const d = await page.evaluate(() => {
      const a = window.__gs; const r = a.run; if (!r || a.phase !== 'run') return { done: true };
      const s = r.sim.s, c = r.sim.course, av = r.sim.dyn.avalanche;
      const look = s.z + 8 + s.speed * 0.3;
      const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.05;
      return { keys: s.grounded ? (err > 0.05 ? ['ArrowRight'] : err < -0.05 ? ['ArrowLeft'] : []) : [], phase: av.phase, gap: s.z - av.z };
    });
    if (d.done) break;
    const want = new Set(d.keys);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    if (d.phase === 2 && d.gap < 42) { await page.waitForTimeout(250); await page.screenshot({ path: 'shots/v2-avalanche.png' }); shot = true; }
    await page.waitForTimeout(16);
  }
  for (const k of held) await page.keyboard.up(k);
  return shot ? 'ok' : 'no shot';
}
