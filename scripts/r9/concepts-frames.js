// Round 9, the concepts lane: every greybox view (prototypes/r9/greybox.html) at 1280x720, from the dev server, with
// the triangles each drew and the console's errors and warnings. Dev only; nothing in the game's boot path.
//   playwright-cli -s=r9-concepts eval "window.__cfCfg = { base: 'http://127.0.0.1:4920/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/concepts/' }"
//   playwright-cli -s=r9-concepts --raw run-code --filename=scripts/r9/concepts-frames.js
// `only` (a list of scene ids) shoots some of them; `views` (a list of keys) only those views.
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4920/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/concepts/', only: null, views: null },
    (await page.evaluate(() => window.__cfCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  await page.goto(c.base + 'prototypes/r9/greybox.html', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__gb, null, { timeout: 120000 });
  const list = await page.evaluate(() => window.__gb.list);
  const shots = [];
  for (const s of list) {
    if (c.only && !c.only.includes(s.id)) continue;
    for (const v of s.views) {
      if (c.views && !c.views.includes(v.key)) continue;
      const t0 = Date.now();
      const tris = await page.evaluate(([id, k]) => window.__gb.draw(id, k), [s.id, v.key]).catch((e) => `error: ${String(e).slice(0, 200)}`);
      await page.waitForTimeout(150);
      const path = c.out + `${s.id}-${v.key}.png`;
      await page.locator('#gb').screenshot({ path });
      shots.push({ id: s.id, view: v.key, tris, ms: Date.now() - t0 });
    }
  }
  return JSON.stringify({ shots, errors }, null, 1);
}
