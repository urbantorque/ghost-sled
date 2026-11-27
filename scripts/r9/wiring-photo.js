// Round 9, the wiring lane: photo mode and Save Clip on each new mountain, on the merged build, opened as a player
// opens them (adapted from the mountain lanes' world-photo scripts, which called openPhoto and saveClip directly). For
// each mountain (`&m=<i>`, the mid-50 fixture): a run started, the sled held at a spot down its middle; P pauses and the
// pause sheet's Photo opens photo mode; a drag turns the lens; Escape leaves it and P again unpauses; the sled is let go
// near the line to finish; on the results Details opens and its Save Clip starts the clip, shot while it records, and
// its Cancel drops it before anything is saved. The console is read throughout. Staged by script, not ridden by hand.
//   playwright-cli -s=r9-wiring --raw run-code --filename=scripts/r9/wiring-photo.js
// Options in __wpCfg: base, out, save, runs ([{ m, id, z, v }]).
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:5030/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/wiring/photo/',
      save: 'mid-50',
      runs: [
        { m: 5, id: 'oldrun', z: 2330, v: 30 },
        { m: 6, id: 'gullhaven', z: 2150, v: 30 },
        { m: 7, id: 'gablefall', z: 2200, v: 24 },
      ],
    },
    (await page.evaluate(() => window.__wpCfg).catch(() => null)) || {},
  );
  const GO = { timeout: 240000 };
  const report = {};
  for (const r of c.runs) {
    const errors = [];
    const notes = [];
    const onErr = (e) => errors.push('pageerror: ' + String(e).slice(0, 300));
    const onCon = (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
    };
    page.on('pageerror', onErr);
    page.on('console', onCon);
    const shot = (n) => page.screenshot({ path: `${c.out}${r.id}-${n}.png` });
    const click = async (fk) => {
      const ok = await page.evaluate((k) => {
        const b = [...document.querySelectorAll(`[data-fk="${k}"]`)].find((x) => x.offsetParent !== null);
        if (b) b.click();
        return !!b;
      }, fk);
      notes.push(`${fk}: ${ok ? 'pressed' : 'not there'}`);
      return ok;
    };
    await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${c.save}&m=${r.m}`, GO);
    await page.waitForSelector('.gs9-t-aim', { timeout: 180000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__gs.ride());
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
    notes.push('riding ' + (await page.evaluate(() => window.__gs.mountain.id)));
    await page.evaluate((spot) => {
      const run = window.__gs.run;
      const cc = run.sim.course;
      const place = (q) => {
        q.x = cc.centerX(q.z);
        q.y = cc.ground(q.x, q.z);
        q.vx = 0;
        q.vz = spot.v;
        q.vy = 0;
        q.speed = spot.v;
        q.grounded = true;
        q.heading = 0;
        q.velHeading = 0;
        q.invuln = 30;
      };
      run.sim.s.z = spot.z - 45;
      place(run.sim.s);
      let live = true;
      const pin = () => {
        if (!live) return;
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && !rr.sim.s.finished && rr.sim.s.z < spot.z) place(rr.sim.s);
        requestAnimationFrame(pin);
      };
      window.__pinOff = () => {
        live = false;
      };
      requestAnimationFrame(pin);
    }, { z: r.z, v: r.v });
    await page.waitForTimeout(5000);
    await shot('0-riding');
    // Pause as a player does (P), then the pause sheet's Photo.
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(900);
    notes.push('paused: ' + (await page.evaluate(() => window.__gs.paused)));
    await shot('1-paused');
    await click('p-photo');
    await page.waitForTimeout(1500);
    notes.push('photo open: ' + (await page.evaluate(() => !!window.__gs.photo)));
    await shot('2-photo');
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(520, 330, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await shot('3-photo-turned');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    notes.push('photo after Escape: ' + (await page.evaluate(() => !!window.__gs.photo)) + ', paused ' + (await page.evaluate(() => window.__gs.paused)));
    await page.evaluate(() => {
      window.__pinOff && window.__pinOff();
      const s = window.__gs.run.sim.s;
      s.z = window.__gs.run.sim.course.finishZ - 60;
    });
    if (await page.evaluate(() => window.__gs.paused)) await page.keyboard.press('KeyP');
    await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 90000 }).catch(() => notes.push('no results phase'));
    await page.waitForTimeout(4500);
    await shot('4-results');
    await click('details');
    await page.waitForTimeout(1200);
    await shot('5-details');
    if (await click('clip')) {
      await page.waitForTimeout(3500);
      notes.push('phase while the clip records: ' + (await page.evaluate(() => window.__gs.phase)));
      await shot('6-clip-recording');
      const cancelled = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^\s*cancel\s*$/i.test(x.textContent || '') && x.offsetParent !== null);
        if (b) b.click();
        return !!b;
      });
      notes.push('cancel pressed: ' + cancelled);
      await page.waitForTimeout(1800);
      notes.push('phase after cancel: ' + (await page.evaluate(() => window.__gs.phase)));
      await shot('7-after-cancel');
    }
    page.off('pageerror', onErr);
    page.off('console', onCon);
    report[r.id] = { notes, errors };
  }
  return JSON.stringify(report, null, 1);
}
