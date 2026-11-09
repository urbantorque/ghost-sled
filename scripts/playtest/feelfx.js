// Round 6's feel lane frames: rides a replayed pool run as the player (?demo=N) and shoots each dash (as it
// starts and 0.5 s in), each ward (the lantern whole, cracking and broken: three frames over its slow
// motion), each sky gate from about 60 m and as it is flown, and the finish (fireworks on a win). With
// `street: true` it pushes a synthetic won gates set piece beat a few seconds in, to shoot the street's
// fireworks. `look` (a save's garage fields, e.g. { hats: ['trapper'], hat: 'trapper' }) is worn for the run;
// `at` adds frames at fixed distances, `reduced` emulates reduced motion. One page per call.
//   playwright-cli -s=feel eval "window.__feelfxCfg = { base: 'http://127.0.0.1:4402/', m: 0, demo: 0, tier: 'high', out: 'shots/r6/feel' }"
//   playwright-cli -s=feel run-code --filename=scripts/playtest/feelfx.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4402/', m: 0, demo: 0, tier: 'high', out: 'shots/r6/feel', maxShots: 26, tag: '', street: false, gateAhead: 60, finish: true, stopAt: 0, look: null, at: [], reduced: false }, (await page.evaluate(() => window.__feelfxCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const q = `?platform=mock&debug&tier=${cfg.tier}&m=${cfg.m}&autoride=1&demo=${cfg.demo}`;
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate((look) => {
    try {
      localStorage.clear();
      if (look) localStorage.setItem('ghostsled.save.v1', JSON.stringify({ v: 1, name: 'Feel', ...look }));
    } catch {}
  }, cfg.look);
  if (cfg.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(cfg.base + q);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  const name = (k) => `${cfg.out}/${dev}-${cfg.tier}-m${cfg.m}${cfg.tag}${cfg.reduced ? '-calm' : ''}-${k}.png`;
  const log = [];
  let shots = 0;
  const shoot = async (k) => {
    if (shots >= cfg.maxShots) return;
    shots++;
    await page.screenshot({ path: name(k) });
  };
  const gates = await page.evaluate(() => window.__gs.run.sim.course.skyGates.map((g) => ({ id: g.id, z: g.z, r: g.r })));
  const marks = [...gates.map((g) => ({ z: g.z - cfg.gateAhead, k: `gate${g.id}-${cfg.gateAhead}m` })), ...cfg.at.map((z) => ({ z, k: `z${z}` }))].sort((a, b) => a.z - b.z);
  const seen = { dash: 0, ward: 0, gate: 0 };
  let streetDone = !cfg.street;
  for (let i = 0; i < 3000; i++) {
    const st = await page.evaluate(() => {
      const g = window.__gs;
      const r = g.run;
      if (!r || g.phase !== 'run') return { phase: g.phase };
      const s = r.sim.s;
      const st = r.sim.stats;
      return { phase: g.phase, z: Math.round(s.z), t: +(r.sim.tick / 60).toFixed(1), dash: s.dash, dashes: st.dashes, wards: st.wards, gates: st.skyGates, finished: r.sim.finished };
    });
    if (st.phase !== 'run' || st.finished) {
      log.push(st);
      if (cfg.finish && (st.finished || st.phase === 'finished')) {
        await page.waitForTimeout(700);
        await shoot('finish-a');
        await page.waitForTimeout(500);
        await shoot('finish-b');
        await page.waitForTimeout(700);
        await shoot('finish-c');
      }
      break;
    }
    if (cfg.stopAt && st.z > cfg.stopAt) break;
    if (!streetDone && st.t > 6) {
      streetDone = true;
      // A synthetic won gates set piece: the beat the director will push (beats.ts 'moment').
      await page.evaluate(() => {
        const w = window.__gs.world;
        w.spirit.beats([{ type: 'moment', tick: 0, key: 'test', verb: 'gates', phase: 'won', n: 6, of: 6 }]);
      });
      for (const [k, ms] of [['street-a', 900], ['street-b', 500], ['street-c', 600], ['street-d', 700]]) {
        await page.waitForTimeout(ms);
        await shoot(k);
      }
    }
    if (st.dashes > seen.dash) {
      seen.dash = st.dashes;
      if (seen.dash <= 2) {
        await page.waitForTimeout(60);
        await shoot(`dash${seen.dash}-a`);
        await page.waitForTimeout(450);
        await shoot(`dash${seen.dash}-b`);
        log.push({ why: `dash${seen.dash}`, ...st });
      }
    } else if (st.wards > seen.ward) {
      seen.ward = st.wards;
      if (seen.ward <= 2) {
        for (const [k, ms] of [['a', 0], ['b', 90], ['c', 140], ['d', 220]]) {
          if (ms) await page.waitForTimeout(ms);
          await shoot(`ward${seen.ward}-${k}`);
        }
        log.push({ why: `ward${seen.ward}`, ...st });
      }
    } else if (st.gates > seen.gate) {
      seen.gate = st.gates;
      await shoot(`gate-flown${seen.gate}`);
      log.push({ why: `gate${seen.gate}`, ...st });
    } else if (marks.length && st.z >= marks[0].z) {
      const m = marks.shift();
      await shoot(m.k);
      log.push({ why: m.k, ...st });
    }
    await page.waitForTimeout(40);
  }
  const end = await page.evaluate(() => { const r = window.__gs.run; if (!r) return null; const st = r.sim.stats; return { z: Math.round(r.sim.s.z), finished: r.sim.finished, dashes: st.dashes, wards: st.wards, gates: st.skyGates }; });
  return JSON.stringify({ errors, gates, end, log }, null, 0);
}
