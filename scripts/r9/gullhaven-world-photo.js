// Round 9, Gullhaven's world: photo mode and Save Clip on Gullhaven (?debug&seed=1f83d9ab rides it in the Daily's
// place, or ?debug&m=<i> once registered). The sled is held at a spot as gullhaven-world-frames.js holds it; then the
// run is paused (Escape) and photo mode opened from pause, as a player opens it, and the picture shot with its bar;
// then photo mode is left, the sled let go near the line to finish, and from the results Save Clip is started, shot
// while it records, and cancelled before anything is saved. The console is read throughout.
//   playwright-cli -s=r9-gullhaven-world --raw run-code --filename=scripts/r9/gullhaven-world-photo.js
// Options in __photoCfg: base, out, tier, m, z (the spot), v.
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4990/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gullhaven/world/photo/', tier: 'high', z: 1530, v: 30 },
    (await page.evaluate(() => window.__photoCfg).catch(() => null)) || {},
  );
  const errors = [];
  const notes = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(`${c.base}?platform=mock&debug&save=fresh&tier=${c.tier}${c.m !== undefined ? '&m=' + c.m : '&seed=1f83d9ab'}`);
  await page.waitForFunction(() => window.__gs && (window.__gs.phase === 'run' || window.__gs.dailyReady), null, { timeout: 300000 });
  await page.evaluate(() => window.__gs.phase === 'run' || window.__gs.ride());
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
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
  }, { z: c.z, v: c.v });
  await page.waitForTimeout(6000);
  // Pause, as a player does (P), then Photo.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(800);
  const paused = await page.evaluate(() => window.__gs.paused);
  notes.push('paused: ' + paused);
  await page.screenshot({ path: `${c.out}photo-0-paused.png` });
  await page.evaluate(() => window.__gs.openPhoto());
  await page.waitForTimeout(1500);
  notes.push('photo open: ' + (await page.evaluate(() => !!window.__gs.photo)));
  await page.screenshot({ path: `${c.out}photo-1-open.png` });
  // Turn the lens a little, as a player drags it.
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(520, 330, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${c.out}photo-2-turned.png` });
  // Leave photo mode (Escape, or its Done), unpause, let the sled run to the line.
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^s*done/i.test(x.textContent || '')); if (b) b.click(); });
  await page.waitForTimeout(800);
  notes.push('photo after Escape: ' + (await page.evaluate(() => !!window.__gs.photo)));
  await page.evaluate(() => {
    window.__pinOff && window.__pinOff();
    const s = window.__gs.run.sim.s;
    s.z = window.__gs.run.sim.course.finishZ - 60;
  });
  if (await page.evaluate(() => window.__gs.paused)) await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 90000 }).catch(() => notes.push('no results phase'));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${c.out}clip-0-results.png` });
  const canClip = await page.evaluate(() => typeof window.__gs.saveClip === 'function');
  notes.push('saveClip there: ' + canClip);
  if (canClip) {
    await page.evaluate(() => {
      window.__clipP = window.__gs.saveClip();
    });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${c.out}clip-1-recording.png` });
    // Cancel before anything is saved.
    const cancelled = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /cancel/i.test(x.textContent || ''));
      if (b) b.click();
      return !!b;
    });
    notes.push('cancel clicked: ' + cancelled);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${c.out}clip-2-after.png` });
  }
  return JSON.stringify({ notes, errors });
}
