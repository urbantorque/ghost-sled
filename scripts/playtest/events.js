// Captures each mid-run chaos event (warn + active) with a real-keyboard autopilot.
async (page) => {
  const out = [];
  const pilot = () =>
    page.evaluate(() => {
      window.__decide = () => {
        const app = window.__gs;
        const r = app.run;
        if (!r) return { keys: [], phase: app.phase };
        const sim = r.sim, s = sim.s, c = sim.course;
        if (s.crashed) return { keys: [], crashed: true };
        const keys = [];
        let tx = c.safeX(s.z + 10);
        const y = sim.dyn.yeti;
        // Dodge the yeti: aim for the side of the corridor it is walking away from.
        if (y.phase === 2 && y.z - s.z < 60 && y.z > s.z) tx = y.x + (y.dir > 0 ? -5 : 5);
        if (s.grounded) {
          const look = s.z + 6 + s.speed * 0.3;
          const err = Math.atan2(tx - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.02;
          if (err > 0.05) keys.push('ArrowRight'); else if (err < -0.05) keys.push('ArrowLeft');
        }
        const d = sim.dyn;
        return { keys, av: d.avalanche.phase, yeti: d.yeti.phase, storm: d.stormPhase, train: d.trainPhase, z: s.z };
      };
    });
  const drive = async (ms, until) => {
    const held = new Set();
    const t0 = Date.now();
    let d = null;
    while (Date.now() - t0 < ms) {
      d = await page.evaluate(() => window.__decide());
      if (d.crashed || (until && (await until(d)))) break;
      const want = new Set(d.keys);
      for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
      await page.waitForTimeout(16);
    }
    for (const k of held) await page.keyboard.up(k);
    return d;
  };
  const events = [
    { id: 1, key: 'avalanche', phase: (d) => d.av },
    { id: 2, key: 'yeti', phase: (d) => d.yeti },
    { id: 3, key: 'giftstorm', phase: (d) => d.storm },
    { id: 4, key: 'ghosttrain', phase: (d) => d.train },
  ];
  for (const e of events) {
    await page.goto(`http://127.0.0.1:4173/?debug&fps&autoride=1&m=0&event=${e.id}`);
    await page.waitForTimeout(2500);
    await pilot();
    let d = await drive(90000, (d) => e.phase(d) >= 1);
    if (!d || e.phase(d) < 1) { out.push(`${e.key}: never triggered`); continue; }
    await page.waitForTimeout(700);
    await page.screenshot({ path: `shots/ev-${e.key}-warn.png` });
    d = await drive(15000, (d) => e.phase(d) >= 2);
    await drive(e.key === 'yeti' ? 3200 : e.key === 'ghosttrain' ? 5200 : 3000);
    await page.screenshot({ path: `shots/ev-${e.key}-active.png` });
    out.push(`${e.key}: ok z=${Math.round(d ? d.z : 0)}`);
  }
  return out.join(' | ');
}
