// The clean break, end to end: makes a real save and a real challenge link on the old build, carries them
// to the new build, and checks nothing was erased. Serve both builds, then:
//   playwright-cli -s=mig eval "window.__migCfg = { old: 'http://127.0.0.1:4310/', now: 'http://127.0.0.1:4173/', out: 'shots/r3/mig/' }"
//   playwright-cli -s=mig run-code --filename=scripts/playtest/migrate.js
async (page) => {
  const cfg = await page.evaluate(() => window.__migCfg);
  const KEY = 'ghostsled.save.v1';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 240)); });

  // ---- On the old build: ride a real run to its end, so the save holds a real best and a real grudge.
  await page.goto(cfg.old + '?platform=mock&debug&tier=low');
  await page.evaluate(() => localStorage.clear());
  await page.goto(cfg.old + '?platform=mock&debug&tier=low&autoride=1&m=0&demo=20');
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'results', null, { timeout: 300000, polling: 200 });
  await page.waitForTimeout(1200);
  const old = await page.evaluate((k) => {
    const g = window.__gs;
    g.save && g.save.flush && g.save.flush();
    return { raw: localStorage.getItem(k), run: g.run ? g.run.toRecord('Mila') : null };
  }, KEY);
  const oldSave = JSON.parse(old.raw);
  const oldBest = oldSave.best.pinecrest;
  const oldGrudge = oldSave.grudge.pinecrest || null;
  // A real challenge link: exactly what the old build's share button makes.
  const link = await page.evaluate(() => {
    const g = window.__gs;
    return g.save.data.best.pinecrest.record;
  });

  // ---- On the new build: load that save.
  await page.goto(cfg.now + '?platform=mock&debug&tier=low');
  await page.evaluate(([k, raw]) => localStorage.setItem(k, raw), [KEY, old.raw]);
  await page.goto(cfg.now + '?platform=mock&debug&tier=low');
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: cfg.out + 'title-after-migration.png' });
  const after = await page.evaluate(() => {
    const g = window.__gs;
    g.save.flush();
    const d = g.save.data;
    return { card: document.body.innerText.includes('Old best'), d: JSON.parse(JSON.stringify(d)) };
  });
  // Save again and reload: the archive must be stable.
  await page.goto(cfg.now + '?platform=mock&debug&tier=low');
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  const again = await page.evaluate((k) => { window.__gs.save.flush(); return JSON.parse(localStorage.getItem(k)); }, KEY);

  // ---- The old link, on the new build.
  await page.evaluate(() => localStorage.clear());
  await page.goto(cfg.now + '?platform=mock&debug&tier=low&c=' + encodeURIComponent(link));
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: cfg.out + 'title-old-link.png' });
  const linkText = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /beat it|rode/i.test(l)).slice(0, 4));

  const a = after.d;
  const out = {
    oldBest: { score: oldBest.score, distance: oldBest.distance, recordLen: oldBest.record.length },
    oldGrudge: oldGrudge ? { name: oldGrudge.name, them: oldGrudge.them, recordLen: (oldGrudge.record || '').length } : null,
    archiveBestSame: a.archive?.best?.pinecrest?.record === oldBest.record,
    archiveGrudgeSame: oldGrudge ? a.archive?.grudge?.pinecrest?.record === oldGrudge.record : 'no grudge in this save',
    freshBestOpen: !a.best?.pinecrest || !a.best.pinecrest.record,
    oldBestShown: after.card,
    grudgeTally: a.grudge?.pinecrest ? { name: a.grudge.pinecrest.name, them: a.grudge.pinecrest.them, record: a.grudge.pinecrest.record } : null,
    gifts: [oldSave.gifts, a.gifts],
    runs: [oldSave.runs, a.runs],
    ghostsPassed: [oldSave.ghostsPassed, a.ghostsPassed],
    stable: JSON.stringify(again.archive) === JSON.stringify(a.archive),
    linkText,
    errors,
  };
  await page.goto('about:blank');
  return JSON.stringify(out);
}
