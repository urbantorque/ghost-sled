// Round 8, the hours lane: the title's hour pick, checked. A save with every Almanac page open; on each named mountain
// the title by day and at its other hour (the key art relit), then on one mountain the pick by the keys (Tab to it,
// Space on it: it picks and Ride does not go), by the pad (down from Ride, right, A) and under reduced motion; the
// save's field after each, Ride's words, a run started at the hour, and the console.
//   playwright-cli -s=r8-hours eval "window.__huCfg = { base: 'http://127.0.0.1:4840/', out: 'C:/.../shots/r8/hours/ui/', tier: 'high', tag: 'desk' }"
//   playwright-cli -s=r8-hours run-code --filename=scripts/playtest/hours-ui.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4840/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/hours/ui/', tier: 'high', tag: 'desk', mountains: [0, 1, 2, 3, 4], focus: 2 }, (await page.evaluate(() => window.__huCfg).catch(() => null)) || {});
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
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title' && document.querySelector('.gs-ride'), null, { timeout: 120000 });
  await page.evaluate(() => {
    const gs = window.__gs;
    const d = gs.save.data;
    d.runs = 80;
    d.ghostsPassed = 600;
    d.rank = { xp: 900000, claimed: 50 };
    gs.save.flush();
    gs.refreshTitle();
  });
  await page.waitForTimeout(1500);
  const state = () =>
    page.evaluate(() => {
      const g = document.querySelector('.gs-t-hour');
      const opts = [...document.querySelectorAll('.gs-t-hour-opt')].map((b) => ({ label: b.textContent, aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') }));
      const row = document.querySelector('.gs-t-opts');
      const r = row ? row.getBoundingClientRect() : null;
      return {
        mountain: window.__gs.mountain.id,
        group: g ? g.getAttribute('aria-label') : null,
        opts,
        ride: document.querySelector('.gs-ride')?.getAttribute('aria-label'),
        rideLine: document.querySelector('.gs-ride-mtn')?.textContent,
        row: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
        hours: window.__gs.save.data.hours ?? null,
        focus: document.activeElement?.getAttribute('data-fk') ?? document.activeElement?.tagName,
        sky: '#' + window.__gs.world.palette.skyZenith.getHexString(),
      };
    });
  const out = { mountains: [], keys: [], pad: [], reduced: null, run: null };
  // Each mountain, by day and at its hour.
  for (const i of c.mountains) {
    const id = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'][i];
    await page.evaluate((m) => window.__gs.selectMountain(m), id);
    await page.waitForTimeout(2500);
    const day = await state();
    await page.screenshot({ path: `${c.out}${c.tag}-m${i}-title-day.png` });
    await page.evaluate(() => document.querySelector('[data-fk="hour-alt"]')?.click());
    await page.waitForTimeout(3500);
    const alt = await state();
    await page.screenshot({ path: `${c.out}${c.tag}-m${i}-title-hour.png` });
    out.mountains.push({ id, day, alt });
  }
  // The keys, on one mountain: back to the day by Space on its half, then Tab from Ride to the halves.
  const fid = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'][c.focus];
  await page.evaluate((m) => window.__gs.selectMountain(m), fid);
  await page.waitForTimeout(1500);
  await page.focus('[data-fk="hour-day"]');
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  out.keys.push({ after: 'Space on Day', phase: await page.evaluate(() => window.__gs.phase), ...(await state()) });
  await page.focus('[data-fk="ride"]');
  await page.keyboard.press('Tab');
  out.keys.push({ after: 'Tab from Ride', ...(await state()) });
  await page.keyboard.press('Tab');
  out.keys.push({ after: 'Tab again', ...(await state()) });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  out.keys.push({ after: 'Enter', phase: await page.evaluate(() => window.__gs.phase), ...(await state()) });
  await page.screenshot({ path: `${c.out}${c.tag}-keys-focus.png` });
  // The pad: nothing focused, then down from Ride, right, A.
  await page.evaluate(() => document.activeElement?.blur());
  const pad = async (p, label) => {
    await page.evaluate((q) => {
      const ui = window.__gs.ui;
      ui.padMenu({ x: 0, y: 0, a: false, b: false, start: false });
      ui.padMenu(q);
      ui.padMenu({ x: 0, y: 0, a: false, b: false, start: false });
    }, p);
    await page.waitForTimeout(500);
    out.pad.push({ after: label, phase: await page.evaluate(() => window.__gs.phase), ...(await state()) });
  };
  await page.evaluate(() => window.__gs.input && (window.__gs.input.mode = 'gamepad'));
  await pad({ x: 0, y: 1, a: false, b: false, start: false }, 'first press');
  await pad({ x: 0, y: 1, a: false, b: false, start: false }, 'down');
  await pad({ x: 1, y: 0, a: false, b: false, start: false }, 'right');
  await pad({ x: 0, y: 0, a: true, b: false, start: false }, 'A');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${c.out}${c.tag}-pad-focus.png` });
  await pad({ x: 1, y: 0, a: false, b: false, start: false }, 'right again');
  // Reduced motion: the pick still picks, and nothing in the row moves.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.querySelector('[data-fk="hour-day"]')?.click());
  await page.waitForTimeout(1500);
  out.reduced = { ...(await state()), transition: await page.evaluate(() => getComputedStyle(document.querySelector('.gs-t-hour-opt')).transitionDuration) };
  await page.screenshot({ path: `${c.out}${c.tag}-reduced-day.png` });
  await page.evaluate(() => document.querySelector('[data-fk="hour-alt"]')?.click());
  await page.waitForTimeout(1500);
  await page.emulateMedia({ reducedMotion: null });
  // A run at the hour: Ride, and the run's light is the hour's.
  await page.evaluate(() => document.querySelector('[data-fk="ride"]')?.click());
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(4000);
  out.run = await page.evaluate(() => ({ phase: window.__gs.phase, mountain: window.__gs.mountain.id, sky: '#' + window.__gs.world.palette.skyZenith.getHexString(), hours: window.__gs.save.data.hours }));
  await page.screenshot({ path: `${c.out}${c.tag}-run-hour.png` });
  out.errors = errors;
  return JSON.stringify(out, null, 1);
};
