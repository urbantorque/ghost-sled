// Round 8, the modes lane: a Long Night ridden in the browser by a scripted pilot, from a fresh save (?night&legs=N:
// the dev switch that opens it), on a virtual clock as stills.js runs one. The pilot holds the course's safe line and
// dashes when a lantern is lit; on a mirrored leg it steers by the picture as a player would, so the input's mirror
// is what the sim sees. Each leg's carry (from the run's own config), chaos, record and the sim's hash where the
// record ends are written out for scripts/playtest/modes-night-check.ts to replay in node; the beat between legs and
// the night's results are shot. The JSON it returns (redirect it to a file) is what the check reads.
//   playwright-cli -s=r8-modes eval "window.__nightCfg = { base: 'http://127.0.0.1:4810/', out: 'C:/.../shots/r8/modes/night/', tier: 'high', legs: 3 }"
//   playwright-cli -s=r8-modes run-code --filename=scripts/playtest/modes-night.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4810/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/modes/night/', tier: 'high', legs: 3, extra: '' }, (await page.evaluate(() => window.__nightCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(c.base);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&night&legs=${c.legs}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.evaluate(() => {
    const vc = { t: performance.now(), q: [], timers: [], id: 1 };
    performance.now = () => vc.t;
    window.requestAnimationFrame = (cb) => {
      vc.q.push(cb);
      return vc.id++;
    };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn, ms, ...a) => {
      const id = vc.id++;
      vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} });
      return id;
    };
    window.clearTimeout = (id) => {
      vc.timers = vc.timers.filter((x) => x.id !== id);
    };
    vc.step = (dt) => {
      vc.t += dt;
      const due = vc.timers.filter((x) => x.at <= vc.t);
      if (due.length) vc.timers = vc.timers.filter((x) => x.at > vc.t);
      for (const x of due) {
        try {
          x.fn();
        } catch (e) {
          console.error(e);
        }
      }
      const q = vc.q;
      vc.q = [];
      for (const cb of q) cb(vc.t);
    };
    window.__vc = vc;
    // The pilot: the safe line 25 m ahead, a dash with a lantern lit on the straight. It steers by the picture, so on
    // a mirrored leg its left is the sim's right.
    const gs = window.__gs;
    const inp = gs.input;
    inp.sampleHeld = () => {
      const r = gs.run;
      if (!r || gs.phase !== 'run') return { steer: 4, action: false, spirit: false };
      const s = r.sim.s;
      const course = r.sim.course;
      const err = course.safeX(s.z + 25) - s.x;
      let lvl = Math.max(-4, Math.min(4, Math.round(err * 0.9 - s.vx * 0.25)));
      if (inp.mirrored) lvl = -lvl;
      const spirit = s.lantern >= 100 && r.sim.tick % 240 === 0;
      return { steer: 4 + lvl, action: false, spirit };
    };
  });
  const legs = [];
  const shots = [];
  let lastRun = null;
  for (let guard = 0; guard < 20000; guard++) {
    const st = await page.evaluate(() => {
      const gs = window.__gs;
      const vc = window.__vc;
      for (let i = 0; i < 40; i++) {
        vc.step(50);
        if (gs.phase !== 'run' || document.querySelector('.gs-nightbeat')) break;
      }
      const r = gs.run;
      return {
        phase: gs.phase,
        id: r ? r.sim.seed + ':' + r.chaos.seed : null,
        z: r ? Math.round(r.sim.s.z) : -1,
        beat: !!document.querySelector('.gs-nightbeat'),
        results: !!document.querySelector('.gs-results:not([hidden])'),
        night: gs.night ? { leg: gs.night.leg, legs: gs.night.legs } : null,
      };
    });
    if (st.id && st.id !== lastRun && st.phase === 'run') {
      lastRun = st.id;
      const leg = await page.evaluate(() => {
        const gs = window.__gs;
        const r = gs.run;
        return { leg: gs.night ? gs.night.leg : -1, mountain: gs.mountain.id, mirror: gs.mirrorRun, chaos: r.chaos, carry: r.extra.carry ?? null, start: { lantern: r.sim.s.lantern, getUps: r.sim.s.getUps, charms: [...r.sim.charms] }, flipped: getComputedStyle(gs.world.renderer.domElement).transform };
      });
      legs.push(leg);
    }
    if (st.beat && !shots.includes('beat' + legs.length)) {
      // The leg just crossed: its record and its hash, taken on one tick.
      const end = await page.evaluate(() => {
        const r = window.__gs.run;
        const rec = r.toRecord('pilot');
        return { hash: r.sim.hash(), tick: r.sim.tick, finished: r.sim.finished, distance: r.sim.distance, held: { lantern: r.sim.s.lantern, getUps: r.sim.s.getUps, charms: [...r.sim.charms] }, record: { ...rec, inputs: Array.from(rec.inputs) } };
      });
      legs[legs.length - 1].end = end;
      await page.evaluate(() => window.__vc.step(400));
      await page.screenshot({ path: `${c.out}beat-${legs.length}.png` });
      shots.push('beat' + legs.length);
    }
    if (st.phase === 'results' && !st.beat && st.results) {
      const end = await page.evaluate(() => {
        const r = window.__gs.run;
        const rec = r.toRecord('pilot');
        return { hash: r.sim.hash(), tick: r.sim.tick, finished: r.sim.finished, distance: r.sim.distance, held: { lantern: r.sim.s.lantern, getUps: r.sim.s.getUps, charms: [...r.sim.charms] }, record: { ...rec, inputs: Array.from(rec.inputs) } };
      });
      legs[legs.length - 1].end = end;
      for (const ms of [800, 5200]) {
        await page.evaluate((m) => window.__vc.step(m), ms);
        await page.screenshot({ path: `${c.out}results-${ms}.png` });
      }
      break;
    }
  }
  const save = await page.evaluate(() => {
    try {
      const raw = Object.entries(localStorage).find(([k]) => /ghost/i.test(k));
      const d = raw ? JSON.parse(raw[1]) : null;
      return { longNight: d?.longNight ?? null, keys: d ? Object.keys(d.best ?? {}) : [], album: d?.album ?? null };
    } catch (e) {
      return { error: String(e) };
    }
  });
  const label = await page.evaluate(() => document.querySelector('.gs-sq-again')?.textContent ?? null);
  await page.goto('about:blank');
  return JSON.stringify({ legs, save, label, errors });
}
