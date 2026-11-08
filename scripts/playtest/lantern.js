// The lantern round's frames: rides a replayed pool run as the player (?demo=N, whose record dashes and
// wards as its rider did) or hands-off (?autoride=1), and shoots a frame at every dash, ward, sky gate and
// lantern lit, plus fixed distances, with the console. One page per call.
//   playwright-cli -s=lan eval "window.__lanCfg = { base: 'http://127.0.0.1:4174/', m: 0, demo: 0, out: 'shots/r5/lantern' }"
//   playwright-cli -s=lan run-code --filename=scripts/playtest/lantern.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', m: 0, demo: 0, tier: 'high', out: 'shots/r5/lantern', at: [250, 700, 1500, 2400, 3300, 4300], maxShots: 14, tag: '' }, (await page.evaluate(() => window.__lanCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const q = `?platform=mock&debug&tier=${cfg.tier}&m=${cfg.m}` + (cfg.demo === null ? '&autoride=1' : `&autoride=1&demo=${cfg.demo}`) + (cfg.mood ? `&mood=${cfg.mood}` : '') + (cfg.event ? `&event=${cfg.event}` : '');
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(cfg.base + q);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  const log = [];
  let shots = 0;
  const name = (k) => `${cfg.out}/${dev}-m${cfg.m}${cfg.tag}-${k}.png`;
  // Every marquee moment: a frame as its title shows and one in its middle.
  const mq = cfg.marquee ? await page.evaluate(() => (window.__gs.director.run?.marquee ?? []).map((m) => ({ key: m.key, z0: m.z0, z1: m.z1 }))) : [];
  // Each sky gate about a second before it is flown (gates: true).
  const gates = cfg.gates ? await page.evaluate(() => window.__gs.run.sim.course.skyGates.map((g) => ({ id: g.id, z: g.z }))) : [];
  const marks = [...cfg.at.map((z) => ({ z, k: `z${z}` })), ...mq.flatMap((m) => [{ z: m.z0 - 45, k: `mq-${m.key}-in` }, { z: (m.z0 + m.z1) / 2, k: `mq-${m.key}-mid` }]), ...gates.map((g) => ({ z: g.z - 38, k: `gate${g.id}-ahead` }))].sort((a, b) => a.z - b.z);
  // A tap of a steer key teaches the steer lesson, so the dash lesson can show when a lantern lights.
  if (cfg.tapSteer) {
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowLeft');
  }
  const at = marks.map((m) => m.z);
  const atK = marks.map((m) => m.k);
  const seen = { dash: 0, ward: 0, skyGate: 0, lantern: 0 };
  for (let i = 0; i < 2400; i++) {
    const st = await page.evaluate(() => {
      const g = window.__gs;
      const r = g.run;
      if (!r || g.phase !== 'run') return { phase: g.phase };
      const s = r.sim.s;
      const st = r.sim.stats;
      return { phase: g.phase, z: Math.round(s.z), t: +(r.sim.tick / 60).toFixed(1), lantern: Math.round(s.lantern), dash: s.dash, dashes: st.dashes, wards: st.wards, gates: st.skyGates, lights: st.lights, finished: r.sim.finished };
    });
    if (st.phase !== 'run' || st.finished) {
      log.push(st);
      // Over the line: the square (and fireworks, on a win).
      if ((st.finished || st.phase === 'finished') && cfg.finish !== false) {
        await page.waitForTimeout(900);
        await page.screenshot({ path: name('finish') });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: name('finish-2') });
      }
      break;
    }
    let why = null;
    if (st.dashes > seen.dash) { seen.dash = st.dashes; if (seen.dash <= 2) why = `dash${seen.dash}`; }
    else if (st.wards > seen.ward) { seen.ward = st.wards; if (seen.ward <= 2) why = `ward${seen.ward}`; }
    else if (st.gates > seen.skyGate) { seen.skyGate = st.gates; why = `skygate${seen.skyGate}`; }
    else if (at.length && st.z >= at[0]) { at.shift(); why = atK.shift(); }
    if (why && shots < cfg.maxShots) {
      if (why.startsWith('ward') || why.startsWith('skygate')) await page.waitForTimeout(120);
      await page.screenshot({ path: name(why) });
      shots++;
      log.push({ why, ...st });
    }
    await page.waitForTimeout(60);
  }
  const end = await page.evaluate(() => { const r = window.__gs.run; if (!r) return null; const st = r.sim.stats; return { z: Math.round(r.sim.s.z), t: +(r.sim.tick / 60).toFixed(1), finished: r.sim.finished, crash: r.sim.s.crashCause, lights: st.lights, great: st.greatLights, lit: Math.round(st.lit), dashes: st.dashes, wards: st.wards, gates: st.skyGates, phased: st.phased }; });
  return JSON.stringify({ errors, end, log }, null, 0);
}
