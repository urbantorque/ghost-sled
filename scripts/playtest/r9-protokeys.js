// Round 9, the screens lane: the prototypes driven as a player would, by keys, by the pad's cursor (the arrows move it
// as the d-pad does) and by touch, with reduced motion; each check passes or fails. Run on the desk config, then on
// the phone config (touch) with `window.__pkCfg = { touch: true }`.
//   playwright-cli -s=r9-screens --raw run-code --filename=scripts/playtest/r9-protokeys.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4930/prototypes/r9/', touch: false }, (await page.evaluate(() => window.__pkCfg).catch(() => null)) || {});
  const out = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const check = (name, ok, detail = '') => out.push(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  const active = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('data-fk') || a.className || a.tagName) : null; });
  const dialog = () => page.evaluate(() => !!document.querySelector('[role=dialog]'));

  await page.goto(c.base + 'title.html?stage=run20', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (!c.touch) {
    // Keys: Tab reaches a door, Enter opens its room on its heading, Escape closes it and gives focus back.
    await page.evaluate(() => document.querySelector('[data-fk="door-events"]').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    check('Enter on a door opens its room', await dialog());
    check('the room opens on its heading', (await active()) === 'p9-sheet-h', String(await active()));
    await page.keyboard.press('Tab');
    check('Tab stays inside the room', await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('Escape closes the room', !(await dialog()));
    check('focus returns to the door', (await active()) === 'door-events', String(await active()));
    // Backspace closes too; the pad's B goes through the same close (proto.ts closeTop).
    await page.evaluate(() => document.querySelector('[data-fk="door-progress"]').click());
    await page.waitForTimeout(300);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    check('Backspace closes a room', !(await dialog()));
    // The arrows move focus as the d-pad does: from Ride, down reaches the hour or the mirror, up a mountain.
    await page.evaluate(() => document.querySelector('[data-fk="ride"]').focus());
    await page.keyboard.press('ArrowDown');
    const down = await active();
    check('the arrow down from Ride moves to the control below', ['hour-day', 'hour-alt', 'mirror'].includes(down), String(down));
    await page.evaluate(() => document.querySelector('[data-fk="ride"]').focus());
    await page.keyboard.press('ArrowUp');
    const up = String(await active());
    check('the arrow up from Ride moves to the picker', up.startsWith('m-'), up);
    // A mountain picked by keys: Enter on a chip picks it, and Ride's words follow.
    await page.evaluate(() => document.querySelector('[data-fk="m-pinecrest"]').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const rideText = await page.evaluate(() => document.querySelector('[data-fk="ride"]').textContent);
    check('picking Pinecrest by keys changes what Ride says', !/Pip Thistle/.test(rideText), rideText.replace(/\s+/g, ' ').slice(0, 60));
    // A locked chip says what opens it, in the quiet line.
    await page.evaluate(() => document.querySelector('[data-fk="m-lanternfall"]').click());
    await page.waitForTimeout(200);
    const aim = await page.evaluate(() => document.querySelector('.t9-aim').textContent);
    check('a locked chip says what opens it', /Lanternfall/.test(aim), aim.slice(0, 60));
    // Choose in the Daily's room picks it; Ride says it.
    await page.evaluate(() => document.querySelector('[data-fk="door-events"]').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-fk="choose-daily"]').click());
    await page.waitForTimeout(300);
    const r2 = await page.evaluate(() => document.querySelector('[data-fk="ride"]').textContent);
    check('Choose in the room picks the Daily and Ride says it', /Daily/.test(r2) && !(await dialog()), r2.replace(/\s+/g, ' ').slice(0, 60));
  } else {
    // Touch: a tap on a door opens its room, a tap on Close shuts it.
    await page.tap('[data-fk="door-progress"]');
    await page.waitForTimeout(400);
    check('a tap on a door opens its room', await dialog());
    await page.tap('[data-fk="close-sheet"]');
    await page.waitForTimeout(300);
    check('a tap on Close shuts it', !(await dialog()));
    await page.tap('[data-fk="m-ember"]');
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => document.querySelector('[data-fk="ride"]').textContent);
    check('a tap on a chip picks it', /Ember/.test(t) || /Suki/.test(t), t.replace(/\s+/g, ' ').slice(0, 60));
  }

  // The results: a key lands the story; the one button takes focus; Details opens and Escape comes back.
  await page.goto(c.base + 'results.html?case=podium', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const playing = await page.evaluate(() => document.querySelector('.r9').classList.contains('is-playing'));
  if (!c.touch) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    check('a key lands the story', await page.evaluate(() => document.querySelector('.r9').classList.contains('is-done')), `was playing: ${playing}`);
    check('the one button has focus', (await active()) === 'again', String(await active()));
    await page.evaluate(() => document.querySelector('[data-fk="details"]').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    check('Enter on Details opens it', await dialog());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check('Escape comes back from Details', !(await dialog()));
    check('focus returns to Details', (await active()) === 'details', String(await active()));
  } else {
    await page.tap('.p9-scene');
    await page.waitForTimeout(100);
    check('a tap lands the story', await page.evaluate(() => document.querySelector('.r9').classList.contains('is-done')), `was playing: ${playing}`);
    await page.tap('[data-fk="details"]');
    await page.waitForTimeout(400);
    check('a tap opens Details', await dialog());
    await page.tap('[data-fk="close-details"]');
    await page.waitForTimeout(300);
    check('a tap on Back comes back', !(await dialog()));
  }

  // Reduced motion: the results open landed, every beat on screen.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(c.base + 'results.html?case=duel-won', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const rm = await page.evaluate(() => ({ done: document.querySelector('.r9').classList.contains('is-done'), hidden: Array.from(document.querySelectorAll('[data-beat]')).filter((e) => getComputedStyle(e).opacity !== '1').length }));
  check('reduced motion opens the results landed', rm.done && rm.hidden === 0, JSON.stringify(rm));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('about:blank');
  return JSON.stringify({ checks: out, errors });
}
