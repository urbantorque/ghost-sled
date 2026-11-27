// Round 9, the u4 lane: a quick look at the other screens on the dev server's fixtures, for the lane's own eyes
// between changes (the bars and the critics' frames are r9-truth.js's). Each step is a list of presses (data-fk keys,
// in order, each pressed as a keyboard player presses it: focused, then clicked) from the title of a stage, then a
// frame; `run` steps start a run with autoride and press P first. Console errors are kept.
//   playwright-cli -s=r9-u4 eval "window.__u4 = { base: 'http://127.0.0.1:4950/', out: 'C:/.../shots/r9/u4/look1/', tag: 'desk', steps: [...] }"
//   playwright-cli -s=r9-u4 --raw run-code --filename=scripts/playtest/r9-u4-look.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4950/', out: 'shots/r9/u4/look/', tag: 'desk', tier: 'high', steps: [] }, (await page.evaluate(() => window.__u4).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
  });
  const out = { tag: c.tag, shots: [], errors };
  const phase = (p, t = 90000) => page.waitForFunction((p) => window.__gs && window.__gs.phase === p, p, { timeout: t, polling: 50 }).then(() => true).catch(() => false);
  const press = async (fk, t = 5000) => {
    const sel = fk.startsWith('key:') ? null : `[data-fk="${fk}"]`;
    if (!sel) {
      await page.keyboard.press(fk.slice(4));
      await page.waitForTimeout(500);
      return true;
    }
    const ok = await page.waitForFunction((s) => {
      const all = Array.from(document.querySelectorAll(s)).filter((e) => e.checkVisibility() && !e.closest('[inert]'));
      return all.length > 0;
    }, sel, { timeout: t, polling: 100 }).then(() => true).catch(() => false);
    if (!ok) return false;
    await page.evaluate((s) => {
      const el = Array.from(document.querySelectorAll(s)).filter((e) => e.checkVisibility() && !e.closest('[inert]')).pop();
      el.focus({ preventScroll: true });
      el.click();
    }, sel);
    await page.waitForTimeout(900);
    return true;
  };
  let at = '';
  for (const s of c.steps) {
    // (A harness page, ui-harness.html?s=...: loaded and shot as it stands.)
    if (s.url) {
      await page.goto(c.base + s.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(s.wait || 1500);
      const file = `${c.tag}-${s.name}.png`;
      await page.screenshot({ path: c.out + file }).catch((e) => errors.push(`shot ${s.name}: ${String(e).slice(0, 120)}`));
      out.shots.push({ name: s.name, file });
      at = '';
      continue;
    }
    // (`results`: a run ridden to its line, pinned on the safe line at 30 m/s as r9-truth.js does, then its results.)
    const want = s.run || s.results ? 'run' : 'title';
    // (Round 9, the feelui lane: `q` adds to the query, a mountain picked by `&m=<i>` say.)
    const where = `${s.stage}${s.run ? ':run' : s.results ? ':results' : ''}${s.q || ''}`;
    if (at !== where || s.fresh) {
      await page.goto(`${c.base}?debug&tier=${c.tier}&save=${s.stage}${s.run || s.results ? '&autoride=1' : ''}${s.q || ''}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await phase(want);
      await page.waitForTimeout(2500);
      if (s.results) {
        await page.evaluate(() => {
          window.__pinOn = true;
          const pin = () => {
            const rr = window.__gs.run;
            if (rr && !rr.sim.s.crashed && window.__pinOn) {
              const q = rr.sim.s;
              const cc = rr.sim.course;
              q.x = cc.safeX(q.z);
              q.y = cc.ground(q.x, q.z);
              q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * 30) / 2;
              q.vz = 30;
              q.vy = 0;
              q.speed = 30;
              q.grounded = true;
              q.heading = Math.atan2(q.vx, q.vz);
              q.velHeading = q.heading;
              q.invuln = 10;
            }
            if (window.__pinOn) requestAnimationFrame(pin);
          };
          pin();
          window.__gs.run.sim.s.z = Math.max(window.__gs.run.sim.s.z, 3900);
        });
        await phase('results', 120000);
        await page.evaluate(() => {
          window.__pinOn = false;
        });
        await page.waitForTimeout(6000);
      }
      at = where;
    } else {
      // Back to the bare surface: Escape until nothing is open (a run stays paused under its card).
      for (let i = 0; i < 5; i++) {
        const open = await page.evaluate(() => !!document.querySelector('.gs9-sheet:not([hidden])') && Array.from(document.querySelectorAll('.gs9-sheet')).some((e) => e.checkVisibility()));
        if (!open) break;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(350);
      }
    }
    if (s.run) {
      const paused = await page.evaluate(() => window.__gs.ui.menus.pause.open);
      if (!paused) {
        await page.keyboard.press('KeyP');
        await page.waitForTimeout(900);
      }
    }
    const done = [];
    for (const fk of s.press || []) done.push((await press(fk, s.patience || 5000)) ? fk : `!${fk}`);
    if (s.scroll) {
      await page.evaluate((y) => {
        const b = Array.from(document.querySelectorAll('.gs9-sheet-body')).filter((e) => e.checkVisibility()).pop();
        if (b) b.scrollTop = y;
      }, s.scroll);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(s.wait || 400);
    const file = `${c.tag}-${s.name}.png`;
    await page.screenshot({ path: c.out + file }).catch((e) => errors.push(`shot ${s.name}: ${String(e).slice(0, 120)}`));
    const focus = await page.evaluate(() => {
      const a = document.activeElement;
      return a && a !== document.body ? `${(a.getAttribute('aria-label') || a.textContent || a.tagName).replace(/\s+/g, ' ').trim().slice(0, 60)}${a.dataset && a.dataset.fk ? ` [${a.dataset.fk}]` : ''}` : 'body';
    });
    out.shots.push({ name: s.name, file, pressed: done, focus });
    if (s.after) for (const fk of s.after) await press(fk);
  }
  return JSON.stringify(out);
}
