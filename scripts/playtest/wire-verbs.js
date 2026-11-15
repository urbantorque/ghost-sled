// Round 7, the wire lane: does every set piece's verb sound? For each mountain named the sled is put on the
// safe line before each set piece in turn and ridden through it at a pinned speed, and the audio's own
// account is read back: which stinger its card played (`stinger.<verb>` from the produced score, `call.<verb>`
// from the live band), which of its beats came (the director's log) and which cues they played.
// A pinned sled on the safe line wins few set pieces, so `won` is rare here: the steps are what is checked.
//   playwright-cli -s=r7-wire eval "window.__verbCfg = { base: 'http://127.0.0.1:4540/', ms: [0, 1, 2, 3, 4] }"
//   playwright-cli -s=r7-wire --raw run-code --filename=scripts/playtest/wire-verbs.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4540/', tier: 'low', speed: 34, ms: [0, 1, 2, 3, 4], extra: '' }, (await page.evaluate(() => window.__verbCfg).catch(() => null)) || {});
  const notes = [];
  page.on('pageerror', (e) => notes.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') notes.push(m.type() + ': ' + m.text().slice(0, 200));
  });
  const out = [];
  for (const m of cfg.ms) {
    await page.goto(cfg.base + `?platform=mock&debug&tier=${cfg.tier}&m=${m}&autoride=1${cfg.extra}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 90000 });
    await page.evaluate(() => window.__gs.audio.unlock());
    // The produced score has to be decoded before its stingers can play.
    await page.waitForFunction(() => window.__gs.audio.debugStems()?.produced === true, null, { timeout: 60000 }).catch(() => null);
    const plays = await page.evaluate((speed) => {
      const sim = window.__gs.run.sim;
      window.__pinSpeed = 0;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const s = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          s.x = cc.safeX(s.z);
          s.y = cc.ground(s.x, s.z);
          s.vx = ((cc.safeX(s.z + 1) - cc.safeX(s.z - 1)) * v) / 2;
          s.vz = v;
          s.vy = 0;
          s.speed = v;
          s.grounded = true;
          s.heading = Math.atan2(s.vx, s.vz);
          s.velHeading = s.heading;
          s.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
      window.__pinSpeed = speed;
      return sim.plays.map((p) => ({ verb: p.verb, z0: Math.round(p.z0), z1: Math.round(p.z1) }));
    }, cfg.speed);
    const produced = await page.evaluate(() => window.__gs.audio.debugStems()?.produced === true);
    for (const p of plays) {
      const before = await page.evaluate((z) => {
        const g = window.__gs;
        if (g.run.sim.s.z < z - 320) g.run.sim.s.z = z - 320;
        return { cues: g.audio.debugCues(), log: g.director.log.length };
      }, p.z0);
      await page.waitForFunction((z) => !window.__gs.run || window.__gs.run.sim.s.z >= z || window.__gs.phase !== 'run', p.z1 + 40, { timeout: 90000, polling: 50 });
      const after = await page.evaluate((from) => {
        const g = window.__gs;
        return { cues: g.audio.debugCues(), beats: g.director.log.slice(from).filter((b) => b.type === 'marquee' || b.type === 'moment').map((b) => b.label || b.type), phase: g.phase };
      }, before.log);
      const d = {};
      for (const k of Object.keys(after.cues)) if (after.cues[k] !== (before.cues[k] || 0)) d[k] = after.cues[k] - (before.cues[k] || 0);
      out.push(`m${m} ${p.verb} produced=${produced} cues=${JSON.stringify(d)} beats=${after.beats.length}`);
      if (after.phase !== 'run') break;
    }
  }
  return out.join(' ;; ') + ' ;; notes: ' + JSON.stringify([...new Set(notes)]);
}
