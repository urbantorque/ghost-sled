// Round 9, the shop lane: the garage's place under playwright, from the title of a save fixture (dev server only,
// the real save untouched): open it, browse each shelf (a hat from behind and in front, a scarf, a trail on the yard's
// loop, a finish, a sound), buy a piece and watch its moment, fit a tier, turn up to the Lantern Row, close it; frames,
// what the place cost to open (app.ts garageCost) and every console error.
//   playwright-cli -s=r9-shop eval "window.__placeCfg = { base: 'http://127.0.0.1:4960/', tag: 'desk', tier: 'high' }"
//   playwright-cli -s=r9-shop run-code --filename=scripts/playtest/r9-shop-place.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4960/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/place/', tag: 'desk', tier: 'high', save: 'mid-50', reduced: false }, (await page.evaluate(() => window.__placeCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  if (c.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  const out = { cfg: c, shots: [], cost: null, closeCost: null, errors };
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (name) => {
    await page.screenshot({ path: `${c.out}${c.tag}-${name}.png` });
    out.shots.push(name);
  };
  // (A tile re-renders the strip when picked, so each click finds its element afresh.)
  const nth = async (sel, i) => {
    const els = await page.$$(sel);
    if (els[i]) await els[i].click().catch((e) => errors.push('click: ' + String(e).slice(0, 120)));
    else errors.push('missing: ' + sel + ' #' + i);
  };
  const click = async (sel) => {
    const el = await page.$(sel);
    if (!el) {
      errors.push('missing: ' + sel);
      return false;
    }
    await el.click();
    return true;
  };
  await page.goto(`${c.base}?debug&platform=mock&save=${c.save}&tier=${c.tier}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 120000 });
  await wait(2500);
  // (The fixture's careers rode before tracks existed: give it a few lines on its sled and gifts to spend, in the
  // fixture's own store, so a purchase and a tier can be shown.)
  await page.evaluate(() => {
    const d = window.__gs.save.data;
    d.gifts = Math.max(d.gifts, 2400);
    d.tracks = { ...(d.tracks || {}), flyer: { lines: 20, fitted: 2 } };
  });
  await page.evaluate(() => window.__gs.applyLook());
  // The way in: the title's Garage door (the app's own path; the title is the ui lane's).
  // (Focused first, as a keyboard player's would be, so the close can be seen to hand focus back to it.)
  const door = await page.$('[data-fk="sleds"]');
  if (door) {
    await door.focus();
    await page.keyboard.press('Enter');
  } else {
    errors.push('missing: the title Garage door');
    await page.evaluate(() => window.__gs.openGarage());
  }
  await page.waitForFunction(() => window.__gs.garageCost && window.__gs.garageCost.firstFrameMs > 0, null, { timeout: 60000 });
  out.cost = await page.evaluate(() => ({ ...window.__gs.garageCost, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }));
  await wait(1500);
  await shot('home');
  // (By now the place has drawn its fortieth frame: what one settled frame costs.)
  out.settled = await page.evaluate(() => (window.__gs.garageCost ? window.__gs.garageCost.settled || null : null));
  // Hats: a hat tried on, from behind, then the same tile again, from the front.
  await click('[data-fk="g-tab-hat"]');
  await wait(400);
  await nth('[data-fk^="g-tile-hat-"]', 3);
  await wait(1300);
  await shot('hat-back');
  await nth('.gs-gar-tile[aria-pressed="true"]', 0);
  await wait(1300);
  await shot('hat-front');
  await click('[data-fk="g-tab-scarf"]');
  await wait(400);
  await nth('[data-fk^="g-tile-scarf-"]', 4);
  await wait(1400);
  await shot('scarf');
  await click('[data-fk="g-tab-finish"]');
  await wait(400);
  await nth('[data-fk^="g-tile-finish-"]', 3);
  await wait(1300);
  await shot('finish');
  await click('[data-fk="g-tab-trail"]');
  await wait(400);
  await nth('[data-fk^="g-tile-trail-"]', 5);
  await wait(3200);
  await shot('trail');
  // A purchase: the first piece on sale on the Hats shelf, two taps (Buy arms, Confirm spends), then its moment.
  await click('[data-fk="g-tab-hat"]');
  await wait(300);
  const buyable = await page.$('.gs-gar-tile.is-buy');
  if (buyable) {
    await buyable.click().catch(() => undefined);
    await wait(900);
    await click('[data-fk="g-act"]');
    await wait(200);
    await click('[data-fk="g-act"]');
    await wait(450);
    await shot('buy-drop');
    await wait(650);
    await shot('buy-open');
    await wait(1600);
    await shot('buy-end');
  } else errors.push('note: nothing on sale on the hats shelf');
  // The sled: its card, its track, a tier fitted if one is open.
  await click('[data-fk="g-tab-sled"]');
  await wait(1300);
  await shot('sled');
  const fit = await page.$('.gs-gar-fit');
  if (fit) {
    await fit.click().catch(() => undefined);
    await wait(200);
    await click('.gs-gar-fit');
    await wait(1100);
    await shot('tier-moment');
    await wait(1800);
    await shot('tier-end');
  }
  await click('[data-fk="g-watch"]');
  await wait(900);
  await shot('trick');
  await click('[data-fk="g-rafters"]');
  await wait(1400);
  await shot('lanterns');
  // Close: Escape, and the world back.
  await page.keyboard.press('Escape');
  await wait(1200);
  await shot('closed');
  out.closeCost = await page.evaluate(() => ({ phase: window.__gs.phase, open: !!window.__gs.garagePlace, focus: document.activeElement ? document.activeElement.dataset.fk || document.activeElement.tagName : null }));
  // The results' "Ready in the shop" path: the garage opened at a piece (the Comet Bob), then closed by its Back button.
  await page.evaluate(() => window.__gs.openGarage('sled:3'));
  await wait(2200);
  await shot('at-piece');
  out.atPiece = await page.evaluate(() => {
    const on = document.querySelector('.gs-gar-tile[aria-pressed="true"]');
    return { tab: (document.querySelector('.gs-gar-tab.is-on') || {}).textContent || null, picked: on ? on.dataset.fk : null };
  });
  await click('[data-fk="close-garage"]');
  await wait(1000);
  return JSON.stringify(out);
}
