// Round 9, the wiring lane: how a save already past a new mountain's hour page is told it, and how a new mountain's
// mirror opens, on the dev server with a save fixture. The title before; then runs on the fixture's save (a run started
// and the sled set near the line to finish, by script), each one's results shot once their story has landed, with the
// reward card's words and Details' "Opened" line; then the title after. With `riders` set, that mountain's three home
// riders are marked beaten to the line in the page's save before the first run (as its board's row would hold them),
// so the run's results tell its mirror. Staged by script, not ridden by hand. The console is read throughout.
//   playwright-cli -s=r9-wiring eval "window.__wrCfg = { tag: 'desk', save: 'mid-50', m: 7, runs: 2, riders: 'gablefall' }"
//   playwright-cli -s=r9-wiring --raw run-code --filename=scripts/r9/wiring-results.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:5030/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/wiring/results/', tag: 'desk', save: 'mid-50', m: 7, runs: 2, riders: '' },
    (await page.evaluate(() => window.__wrCfg).catch(() => null)) || {},
  );
  const GO = { timeout: 240000 };
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  const name = `${c.tag}-${c.save}-m${c.m}${c.riders ? '-riders' : ''}`;
  const title = () =>
    page.evaluate(() => ({
      mountain: window.__gs.mountain.id,
      how: document.querySelector('.gs9-how')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      aim: document.querySelector('.gs9-t-aim')?.textContent ?? '',
      told: window.__gs.save.data.rank?.told ?? [],
    }));
  const report = { tag: c.tag, save: c.save, before: null, runs: [], after: null };
  await page.goto(`${c.base}?platform=mock&debug&tier=high&save=${c.save}&m=${c.m}`, GO);
  await page.waitForSelector('.gs9-t-aim', { timeout: 180000 });
  await page.waitForTimeout(2500);
  if (c.riders) {
    await page.evaluate((id) => {
      const gs = window.__gs;
      const d = gs.save.data;
      const keys = { oldrun: ['orsolo', 'fennick', 'lotte'], gullhaven: ['ina', 'tam', 'grizel'], gablefall: ['wren', 'abel', 'hettie'] }[id];
      d.mastery = d.mastery ?? {};
      d.mastery[id] = { gates: [], moments: [], clean: false, ...(d.mastery[id] ?? {}), riders: keys };
    }, c.riders);
  }
  report.before = await title();
  await page.screenshot({ path: `${c.out}${name}-title-before.png` });
  for (let k = 0; k < c.runs; k++) {
    await page.evaluate(() => (window.__gs.phase === 'title' ? window.__gs.ride() : document.querySelector('[data-fk="again"]')?.click()));
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const s = window.__gs.run.sim.s;
      s.z = window.__gs.run.sim.course.finishZ - 60;
    });
    await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 120000 });
    await page.waitForTimeout(5000);
    const card = await page.evaluate(() => ({
      text: document.querySelector('.gs-results')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 600) ?? '',
      opened: (window.__gs.results?.spine?.opened ?? []).map((o) => `${o.from ?? (o.chapter ? 'chapter' : 'page ' + o.page)}: ${o.name}`),
    }));
    await page.screenshot({ path: `${c.out}${name}-results-${k + 1}.png` });
    await page.evaluate(() => document.querySelector('[data-fk="details"]')?.click());
    await page.waitForTimeout(1200);
    card.details = await page.evaluate(() => [...document.querySelectorAll('p')].map((p) => p.textContent || '').find((t) => /^Opened:/.test(t)) ?? '');
    await page.screenshot({ path: `${c.out}${name}-details-${k + 1}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    report.runs.push(card);
  }
  // Home, and the title as it stands now.
  await page.evaluate(() => document.querySelector('[data-fk="home"]')?.click());
  await page.waitForFunction(() => window.__gs.phase === 'title', null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  report.after = await title();
  await page.screenshot({ path: `${c.out}${name}-title-after.png` });
  report.errors = errors;
  return JSON.stringify(report, null, 1);
}
