// Round 9, the wiring lane: the title's key art on all eight mountains at three stages of a player's life (the save
// fixtures, `?debug&save=<name>`, src/game/devsave.ts; `&m=<i>` picks the mountain, opened for the dev if the save has
// not opened it), after the reel has settled; with what the hour pair says (the hour, the mirror toggle, or a new
// mountain's way to its mirror), the quiet line, the title's visible words (a rough count: every text node shown in
// the title, not r9-screenbars' bar) and the console. Then, for each fixture, Progress opened to the new mountains'
// boards (the medal wall), each shot with what its Home Riders row says. Staged by script, not ridden by hand.
//   playwright-cli -s=r9-wiring eval "window.__wtCfg = { tag: 'desk' }"
//   playwright-cli -s=r9-wiring --raw run-code --filename=scripts/r9/wiring-title.js
// Options in __wtCfg: base, out (absolute, ending in /), tag, fixtures, ms (mountain indices), wait (ms), boards.
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:5030/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/wiring/title/',
      tag: 'desk',
      fixtures: ['mid-1', 'mid-50', 'mid-100'],
      // (Extra shots: a fixture and the mountain indices to shoot on it as well, e.g. novice-5 on Gablefall.)
      extra: [['novice-5', [7]]],
      ms: [0, 1, 2, 3, 4, 5, 6, 7],
      wait: 7000,
      settle: 1500,
      boards: true,
    },
    (await page.evaluate(() => window.__wtCfg).catch(() => null)) || {},
  );
  const GO = { timeout: 240000 };
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  const read = () =>
    page.evaluate(() => {
      const root = document.querySelector('.gs9-title');
      const shown = (el) => {
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.15 || e.classList.contains('gs-sr')) return false;
        }
        return true;
      };
      let words = 0;
      if (root) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const t = (n.textContent || '').trim();
          if (!t || !n.parentElement || !shown(n.parentElement)) continue;
          const r = n.parentElement.getBoundingClientRect();
          if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
          words += t.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)).length;
        }
      }
      const gs = window.__gs;
      const hero = gs && gs.attract ? gs.attract.focus : null;
      return {
        mountain: gs && gs.mountain ? gs.mountain.id : null,
        how: document.querySelector('.gs9-how')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
        way: document.querySelector('.gs9-how-way')?.textContent ?? '',
        aim: document.querySelector('.gs9-t-aim')?.textContent ?? '',
        ride: document.querySelector('.gs9-ride')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
        words,
        field: gs && gs.ghosts ? gs.ghosts.tracks.map((t) => t.entry.name) : [],
        hero: gs && gs.ghosts ? (gs.ghosts.tracks.find((t) => t.entry.id === hero)?.entry.name ?? null) : null,
        view: [innerWidth, innerHeight],
      };
    });
  const report = { tag: c.tag, titles: {}, boards: {} };
  const plan = [...c.fixtures.map((f) => [f, c.ms]), ...c.extra];
  for (const [f, ms] of plan) {
    for (const i of ms) {
      await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${f}&m=${i}`, GO);
      await page.waitForSelector('.gs9-t-aim', { timeout: 180000 });
      await page.waitForTimeout(c.wait);
      // (Never on a cut: the reel loops back to its opening under a dip while the lens glides back to the hero, about half
      // a second, so wait for the dip to clear and the lens to stand behind the hero again.)
      await page.waitForFunction(() => {
        const gs = window.__gs;
        const dip = document.querySelector('.gs-title-dip');
        const hero = gs.ghosts.tracks.find((t) => t.entry.id === gs.attract.focus);
        const p = {};
        if (!hero || !gs.ghosts.pose(hero, gs.attract.tick, p)) return false;
        // (The lens rests 2 to 12 m behind the hero; gliding back after a cut it is ahead of it.)
        const dz = -gs.world.cam.camera.position.z - p.z;
        return (!dip || Number(getComputedStyle(dip).opacity) < 0.01) && dz < -2 && dz > -12;
      }, null, { timeout: 30000, polling: 100 }).catch(() => {});
      // (Then the lens's drift to its rest beside the hero, which takes a second or so after a cut.)
      await page.waitForTimeout(c.settle);
      const r = await read();
      const key = `${f}-${r.mountain ?? i}`;
      await page.screenshot({ path: `${c.out}${c.tag}-${key}.png` });
      report.titles[key] = r;
    }
    if (!c.boards || !c.fixtures.includes(f)) continue;
    // The new mountains' boards: Progress, then each one's row on the medal wall.
    for (const id of ['oldrun', 'gullhaven', 'gablefall']) {
      const i = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall', 'oldrun', 'gullhaven', 'gablefall'].indexOf(id);
      await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${f}&m=${i}`, GO);
      await page.waitForSelector('.gs9-t-aim', { timeout: 180000 });
      await page.waitForTimeout(1500);
      const click = async (fk) => {
        const ok = await page.evaluate((k) => {
          const b = document.querySelector(`[data-fk="${k}"]`);
          if (b) b.click();
          return !!b;
        }, fk);
        await page.waitForTimeout(1000);
        return ok;
      };
      const opened = (await click('door-progress')) && (await click('medals')) && (await click(`board-${id}`));
      const board = await page.evaluate(() => {
        const caps = [...document.querySelectorAll('h3.gs9-cap')].filter((x) => /Home Riders/.test(x.textContent || ''));
        const sec = caps[0]?.parentElement;
        return sec ? sec.innerText.replace(/\s+/g, ' ').trim() : null;
      });
      // Scroll the Home Riders row into view for the shot.
      await page.evaluate(() => [...document.querySelectorAll('h3.gs9-cap')].find((x) => /Home Riders/.test(x.textContent || ''))?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${c.out}${c.tag}-${f}-board-${id}.png` });
      report.boards[`${f}-${id}`] = { opened, board };
    }
  }
  report.errors = errors;
  return JSON.stringify(report, null, 1);
}
