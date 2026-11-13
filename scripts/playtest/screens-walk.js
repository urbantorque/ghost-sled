// The screens lane's walk (round 7): a first visit, the five title shots, the ladder, the garage, a move between
// mountains, a duel's start, pause and results, on the session's viewport, with the first-frame timing.
//   playwright-cli -s=x eval "() => { window.__cfg = { base: 'http://127.0.0.1:4490/', out: 'shots/r7/screens', tier: 'high' }; }"
//   playwright-cli -s=x run-code --filename=scripts/playtest/screens-walk.js
async (page) => {
  const cfg = await page.evaluate(() => window.__cfg);
  const vp = page.viewportSize();
  const tag = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  const shot = (n) => page.screenshot({ path: `${cfg.out}/${tag}-${n}.png` });
  const url = (q) => cfg.base + '?platform=mock&debug&tier=' + cfg.tier + (q ? '&' + q : '');
  const title = () => page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 90000 });
  const notes = {};

  // 1. A first visit.
  await page.goto(url(''));
  await page.evaluate(() => localStorage.clear());
  await page.goto(url(''));
  await title();
  await page.waitForTimeout(4000);
  await shot('01-title-first');

  // The first frame: navigation to the title's first frame, on a mountain staged far down its course
  // (Pinecrest, 3,640 m) and on one staged at its start (Ember, 60 m).
  const first = {};
  for (const m of [0, 2, 0, 2, 0, 2]) {
    await page.goto(url('m=' + m));
    const t = await page.evaluate(() => new Promise((res) => { const go = () => (window.__gs && window.__gs.phase === 'title' ? requestAnimationFrame(() => res(performance.now())) : setTimeout(go, 16)); go(); }));
    (first['m' + m] ||= []).push(Math.round(t));
  }
  notes.firstFrameMs = first;

  // 2. A returning player, three of The Twelve down: the next duel is on Pinecrest.
  await page.goto(url('m=0'));
  await title();
  await page.evaluate(() => { const g = window.__gs; Object.assign(g.save.data, { runs: 6, ghostsPassed: 60, gifts: 449, twelve: { beaten: ['rosa', 'bram', 'pip'] } }); g.save.flush(); });
  for (const [m, id] of [[0, 'pinecrest'], [1, 'frostfang'], [2, 'ember'], [3, 'sakura'], [4, 'lanternfall']]) {
    await page.goto(url('m=' + m));
    await title();
    await page.waitForTimeout(5500);
    await shot(`02-title-${id}`);
    if (m === 0) { await page.waitForTimeout(6000); await shot('02-title-pinecrest-later'); }
  }

  // 3. The ladder, the garage, and a move from one mountain to the next.
  await page.goto(url('m=0'));
  await title();
  await page.waitForTimeout(3000);
  await page.click('[data-fk="t12-ladder"]');
  await page.waitForTimeout(900);
  await shot('03-twelve-ladder');
  await page.click('[data-fk="t12-close"]');
  await page.click('[data-fk="sleds"]');
  await page.waitForTimeout(1600);
  await shot('04-garage');
  await page.evaluate(() => window.__gs.ui.closeMenus());
  await page.waitForTimeout(500);
  await page.click('[data-fk="m-frostfang"]');
  await page.waitForTimeout(230);
  await shot('05-travel-1-veil');
  await page.waitForTimeout(330);
  await shot('05-travel-2-name');
  await page.waitForTimeout(420);
  await shot('05-travel-3-lifting');
  await page.waitForTimeout(1800);
  await shot('05-travel-4-arrived');
  await page.click('[data-fk="m-pinecrest"]');
  await page.waitForTimeout(3500);

  // 4. The duel: Ride on the next rider's home ground, hands-off.
  await page.goto(url('m=0&autoride=1'));
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot('06-run-start-duel');
  notes.field = await page.evaluate(() => window.__gs.ghosts.tracks.map((t) => t.entry.name + (t.entry.rival ? '*' : '')));
  await page.waitForTimeout(2500);
  await page.keyboard.press('p');
  await page.waitForTimeout(900);
  await shot('07-pause');
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 300000, polling: 250 });
  await page.waitForTimeout(450);
  await shot('08-results-landing');
  await page.waitForTimeout(3200);
  await shot('08-results');
  notes.results = await page.evaluate(() => ({ moment: document.querySelector('.gs-mo')?.innerText, twelve: window.__gs.results?.twelve, again: window.__gs.results?.runAgainLabel, save: window.__gs.save.data.twelve }));
  notes.errors = errors;
  return JSON.stringify(notes);
}
