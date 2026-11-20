// Round 8, the screens lane: the harness's screens shot as they build. Each job is a scenario of ui-harness.html (with
// its own extra query, e.g. "view=details" or "land=1") and the moments (ms after it opens) to shoot it at; the console
// is read throughout.
//   playwright-cli -s=r8-screens eval "window.__harCfg = { base: 'http://127.0.0.1:4800/', out: 'C:/.../shots/r8/screens/after/', tag: 'desk', jobs: [{ s: 'seq-turn', at: [300, 2000, 5500] }] }"
//   playwright-cli -s=r8-screens --raw run-code --filename=scripts/playtest/r8-harness.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4800/', out: 'shots/r8/screens/', tag: 'desk', mode: 'mouse', jobs: [], reduced: false }, (await page.evaluate(() => window.__harCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 240)}`);
  });
  if (c.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const report = [];
  for (const j of c.jobs) {
    const q = `s=${j.s}&mode=${j.mode ?? c.mode}&bare=1${j.q ? `&${j.q}` : ''}`;
    await page.goto(`${c.base}ui-harness.html?${q}`);
    const t0 = Date.now();
    for (const ms of j.at ?? [1200]) {
      const wait = t0 + ms - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: `${c.out}${c.tag}-${j.s}${j.q ? `-${j.q.replace(/[=&]/g, '')}` : ''}-${String(ms).padStart(4, '0')}.png` }).catch(() => {});
    }
    if (j.probe) report.push({ s: j.s, probe: await page.evaluate(j.probe).catch((e) => String(e)) });
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
