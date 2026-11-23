// Round 9, the screens lane: today's screens (the game's own UI on the prototypes' fixtures, today.html) and the
// prototypes (title.html, results.html), shot side by side on one captured frame, with each one's visible words and
// controls counted (count.ts: drawn text and drawn controls; a screen reader's extra words left out) and its console
// read. Today's results are shot once the story has landed (it plays about 4.5 s), the prototype's once its 2.4 s land.
//   playwright-cli -s=r9-screens eval "window.__psCfg = { base: 'http://127.0.0.1:4930/prototypes/r9/', out: 'C:/.../shots/r9/screens/frames/', tag: 'desk' }"
//   playwright-cli -s=r9-screens --raw run-code --filename=scripts/playtest/r9-protoshots.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4930/prototypes/r9/', out: 'shots/r9/screens/frames/', tag: 'desk', w: 0, h: 0, only: '' }, (await page.evaluate(() => window.__psCfg).catch(() => null)) || {});
  if (c.w && c.h) await page.setViewportSize({ width: c.w, height: c.h });
  const errors = [];
  let where = '';
  page.on('pageerror', (e) => errors.push(`${where}: ${String(e).slice(0, 200)}`));
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${where}: ${msg.type()} ${msg.text().slice(0, 200)}`); });
  const counts = {};
  const shoot = async (name, url, wait) => {
    if (c.only && !name.includes(c.only)) return;
    where = name;
    await page.goto(c.base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${c.out}${c.tag}-${name}.png` }).catch((e) => errors.push(`${name} shot ${String(e).slice(0, 100)}`));
    counts[name] = await page.evaluate(() => window.__count ? window.__count() : null).catch(() => null);
  };
  // Warm the origin (a fresh browser's first loads stall).
  await page.goto(c.base + 'title.html?stage=run1', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.goto(c.base + 'today.html?screen=title&stage=run1', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);

  for (const s of ['fresh', 'run1', 'run5', 'run20', 'run50']) {
    await shoot(`today-title-${s}`, `today.html?screen=title&stage=${s}`, 3200);
    await shoot(`new-title-${s}`, `title.html?stage=${s}`, 1200);
  }
  for (const s of ['run1', 'run20', 'run50']) {
    for (const d of ['events', 'progress']) await shoot(`new-title-${s}-door-${d}`, `title.html?stage=${s}&open=${d}`, 1200);
  }
  for (const k of ['first', 'podium', 'wreck', 'duel-won', 'duel-lost', 'cup', 'trial', 'daily']) {
    await shoot(`today-results-${k}`, `today.html?screen=results&case=${k}`, 7000);
    await shoot(`new-results-${k}`, `results.html?case=${k}`, 3200);
    await shoot(`today-results-${k}-details`, `today.html?screen=results&case=${k}&open=details`, 2600);
    await shoot(`new-results-${k}-details`, `results.html?case=${k}&open=details`, 1400);
  }
  // Mid-story frames, for the motion: the prototype at 0.6 s and 1.4 s, today's at 1.5 s and 3 s.
  await shoot('new-results-podium-at600', 'results.html?case=podium', 600);
  await shoot('new-results-podium-at1400', 'results.html?case=podium', 1400);
  await shoot('today-results-podium-at1500', 'today.html?screen=results&case=podium', 1500);
  await shoot('today-results-podium-at3000', 'today.html?screen=results&case=podium', 3000);
  await page.goto('about:blank');
  return JSON.stringify({ counts, errors });
}
