// Round 9, Gablefall's world: the title once MOUNTAINS holds Gablefall, on the save fixtures (`?debug&save=<name>`,
// src/game/devsave.ts). For each fixture: the picker's chips (name, locked, picked, art, aria-label and box, so the rows
// can be counted), the quiet line, the title shot; then Gablefall's chip pressed (picked if open: the title's key art
// travels to Gablefall; locked: the quiet line says what opens it) and shot again. With `unlock` set (a fixture under
// Gablefall's 8 ghosts), a run on Pinecrest is ridden with the sled held fast down its middle so it overtakes the
// ghosts it has seen, the unlock notice watched for and shot, then the sled set near the line to finish and the
// results shot as their sequence plays. Staged by script, not ridden by hand. The console is read throughout.
//   playwright-cli -s=r9-gablefall-world eval "window.__gtCfg = { tag: 'desk', unlock: 'novice-1' }"
//   playwright-cli -s=r9-gablefall-world --raw run-code --filename=scripts/r9/gablefall-world-title.js
// Options in __gtCfg: base, out (absolute, ending in /), tag, fixtures, unlock (a fixture name, or '' for none), v.
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:5000/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gablefall/world/title/',
      tag: 'desk',
      fixtures: ['fresh', 'mid-1', 'novice-1', 'novice-5', 'mid-100'],
      unlock: '',
      v: 40,
    },
    (await page.evaluate(() => window.__gtCfg).catch(() => null)) || {},
  );
  // (A dev server busy with another lane's edits can take a minute to serve the first load.)
  const GO = { timeout: 240000 };
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  const read = () =>
    page.evaluate(() => {
      const chips = [...document.querySelectorAll('.gs9-chip')].map((b) => {
        const r = b.getBoundingClientRect();
        return {
          id: (b.dataset.fk ?? '').replace(/^m-/, ''),
          name: b.querySelector('.gs9-chip-name')?.textContent ?? '',
          art: [...b.classList].find((k) => k.startsWith('b-')) ?? '',
          locked: b.classList.contains('is-locked'),
          sel: b.classList.contains('is-sel'),
          label: b.getAttribute('aria-label'),
          title: b.title || '',
          box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        };
      });
      const tops = [...new Set(chips.map((x) => x.box[1]))].sort((a, b) => a - b);
      const rows = tops.map((t) => chips.filter((x) => x.box[1] === t).map((x) => x.id));
      const strip = document.querySelector('.gs9-pick');
      const sr = strip ? strip.getBoundingClientRect() : null;
      const clipped = chips.filter((x) => sr && (x.box[0] < sr.left - 1 || x.box[0] + x.box[2] > sr.right + 1)).map((x) => x.id);
      return {
        chips,
        rows,
        clipped,
        aim: document.querySelector('.gs9-t-aim')?.textContent ?? '',
        view: [innerWidth, innerHeight],
        phase: window.__gs?.phase,
      };
    });
  const report = { tag: c.tag, titles: {}, unlock: null };
  for (const f of c.fixtures) {
    await page.goto(c.base, GO);
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${f}`, GO);
    // (A first visit has no picker: only Ride and the quiet line.)
    await page.waitForSelector('.gs9-t-aim', { timeout: 180000 });
    await page.waitForTimeout(3000);
    const before = await read();
    await page.screenshot({ path: `${c.out}${c.tag}-${f}-title.png` });
    const gab = before.chips.find((x) => x.id === 'gablefall');
    let after = null;
    if (gab) {
      await page.click('.gs9-chip[data-fk="m-gablefall"]');
      await page.waitForTimeout(gab.locked ? 600 : 4000);
      after = await read();
      await page.screenshot({ path: `${c.out}${c.tag}-${f}-gablefall.png` });
    }
    report.titles[f] = { before, after };
  }
  if (c.unlock) {
    const u = { fixture: c.unlock, toasts: [], shots: [], results: null, error: null, navs: [] };
    report.unlock = u;
    const t00 = Date.now();
    page.on('framenavigated', (fr) => {
      if (fr === page.mainFrame()) u.navs.push(`${Math.round((Date.now() - t00) / 1000)} s: ${fr.url().slice(0, 140)}`);
    });
    try {
    await page.goto(c.base, GO);
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {}
    });
    await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${c.unlock}&m=0&autoride=1`, GO);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 300000 });
    // Held fast down the middle from where it stands, so it overtakes the ghosts it has seen at the start.
    await page.evaluate((v) => {
      let live = true;
      const pin = () => {
        if (!live) return;
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && !rr.sim.s.finished && rr.sim.tick > 60) {
          const s = rr.sim.s;
          const cc = rr.sim.course;
          s.x = cc.centerX(s.z);
          s.y = cc.ground(s.x, s.z);
          s.vx = ((cc.centerX(s.z + 1) - cc.centerX(s.z - 1)) / 2) * v;
          s.vz = v;
          s.vy = 0;
          s.speed = Math.hypot(s.vx, s.vz);
          s.heading = Math.atan2(s.vx, s.vz);
          s.velHeading = s.heading;
          s.grounded = true;
          s.invuln = 30;
        }
        requestAnimationFrame(pin);
      };
      window.__pinOff = () => {
        live = false;
      };
      requestAnimationFrame(pin);
    }, c.v);
    const t0 = Date.now();
    let n = 0;
    while (Date.now() - t0 < 45000) {
      const t = await page.evaluate(() =>
        [...document.querySelectorAll('.gs-toast')].map((e) => ({ cls: e.className, text: e.textContent, sky: !!e.querySelector('.gs-toast-sky'), bg: e.querySelector('.gs-toast-sky') ? getComputedStyle(e.querySelector('.gs-toast-sky')).backgroundImage.slice(0, 160) : '' })),
      );
      const z = await page.evaluate(() => Math.round(window.__gs?.run?.sim.s.z ?? -1));
      for (const x of t) if (!u.toasts.some((y) => y.text === x.text)) u.toasts.push({ ...x, z });
      if (t.some((x) => /unlock/.test(x.cls)) && n < 3) {
        await page.screenshot({ path: `${c.out}${c.tag}-unlock-${n}.png` });
        u.shots.push(`unlock-${n} at ${z} m`);
        n++;
      }
      if (n >= 3) break;
      await page.waitForTimeout(400);
    }
    // Then to the line, and the results as their sequence plays.
    await page.evaluate(() => {
      const rr = window.__gs.run;
      if (rr) rr.sim.s.z = Math.max(rr.sim.s.z, rr.sim.course.finishZ - 120);
    });
    await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 120000 }).catch(() => {});
    await page.evaluate(() => window.__pinOff && window.__pinOff());
    for (const ms of [2500, 4000, 4000, 5000]) {
      await page.waitForTimeout(ms);
      const at = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 600));
      const k = u.shots.length;
      await page.screenshot({ path: `${c.out}${c.tag}-results-${k}.png` });
      u.shots.push(`results-${k}: ${at.slice(0, 200)}`);
    }
    u.results = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200));
    } catch (e) {
      // (The dev server reloading the page under the run, as another lane edits the tree, or a phase never reached.)
      u.error = String(e).slice(0, 300);
    }
  }
  report.errors = errors;
  return JSON.stringify(report);
}
