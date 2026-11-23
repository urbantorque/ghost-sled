// Round 9, the truth lane: every screen, sheet and popover at every stage of a player's life, on the dev server with
// the save fixtures (`?debug&save=<name>`, src/game/devsave.ts), each one's visible words and controls counted. The
// sibling of r9-review.js (which shot the live build from a fresh save); run by r9-truth.sh, one part at a time:
//   titles   the title of each stage given, after 3 s (as a player meets it) and once the rivals are in; then for a
//            returning stage the Cup picked, the Trial picked (where open) and the Daily picked; `link` adds a
//            challenge link's title (`?c=` with the record given)
//   sheets   every sheet and popover the title opens (the garage's every shelf, the Almanac, the album, missions,
//            medals, the flame's calendar, The Twelve, settings), then pause and photo mode in a run; each is closed
//            with Escape and with the pad's B (a scripted pad), and where focus lands is kept
//   results  the results of one scenario (first, crash, duel-won, duel-lost, cup, trial, daily, night): its first
//            view once the directed sequence has landed, and Details
//   again    Run Again to riding, timed `n` times after a warm load (Space pressed to the sim's first moving tick)
//   crawl    the title's doors: every control on the title opened once (pointer), what it shows and the doors on
//            that, the Tab order (keyboard), where the pad can move (a scripted pad's directions) and each one's name
// Each shot keeps its visible text as chunks (text a reader can see: not display:none, not .gs-sr, no ancestor under
// 0.15 opacity, inside the viewport, and inside the surface on top when a sheet is open), the controls (label,
// aria-label, accessible name, primary class and colour, icon only, disabled), the surface on top and the phase.
// scripts/playtest/r9-screenbars.mjs counts words, bare figures, repeats and loading from these.
//   playwright-cli -s=r9-truth eval "window.__t9 = { base: 'http://127.0.0.1:4900/', out: 'C:/.../shots/r9/truth/', tag: 'desk', part: 'titles', stages: ['fresh'] }"
//   playwright-cli -s=r9-truth --raw run-code --filename=scripts/playtest/r9-truth.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4900/', out: 'shots/r9/truth/', tag: 'desk', tier: 'high', part: 'titles', stages: ['fresh'], scenario: 'first', n: 5, link: '', from: 3900 }, (await page.evaluate(() => window.__t9).catch(() => null)) || {});
  const errors = [];
  const warns = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 240));
    else if (msg.type() === 'warning') warns.push(msg.text().slice(0, 240));
  });
  const report = { tag: c.tag, part: c.part, shots: {}, sheets: [], again: [], crawl: null, notes: [] };

  // ------------------------------------------------------------ in the page: what a reader sees, and the controls
  const MEASURE = (o) => {
    const vw = innerWidth;
    const vh = innerHeight;
    const gs = window.__gs;
    const ui = gs && gs.ui;
    const menus = ui && ui.menus;
    const photo = document.querySelector('.gs-photo');
    let top = null;
    let topName = 'none';
    if (photo && photo.checkVisibility()) {
      top = photo;
      topName = 'photo';
    } else if (menus && menus.topEl) {
      top = menus.topEl;
      topName = menus.settings.open ? 'settings' : menus.books.open ? 'books' : menus.sleds.open ? 'garage' : 'pause';
    } else if (ui && ui.results && ui.results.layer.open) {
      top = ui.results.layer.el;
      topName = 'results';
    } else if (ui && ui.title && ui.title.layer.open) {
      top = ui.title.layer.el;
      topName = 'title';
    }
    const pop = ui && ui.title && ui.title.popover && ui.title.popover.isConnected ? ui.title.popover : null;
    const scope = (o && o.sel && document.querySelector(o.sel)) || (topName === 'title' || topName === 'results' || topName === 'none' ? document.querySelector('.gs-ui') || document.body : top);
    const opacityOf = (el) => {
      let a = 1;
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) a *= Number(getComputedStyle(e).opacity);
      return a;
    };
    const shown = (el) => !!el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true }) && !el.closest('.gs-sr') && opacityOf(el) > 0.15;
    const inView = (r) => r.width >= 2 && r.height >= 4 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
    // Clipped away by a scrolling or clipping ancestor (the mountain strip's cards scrolled out of it): a control with
    // less than a third of it inside a clip box on the way up, a text with none of it (an ellipsis keeps a little).
    const clipped = (el, r, frac = 0) => {
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const c = e.getBoundingClientRect();
        const w = Math.min(r.right, c.right) - Math.max(r.left, c.left);
        const h = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
        if (w <= 0 || h <= 0 || w * h < r.width * r.height * frac) return true;
      }
      return false;
    };
    // A box is what a reader takes in as one item: the control the text is on (a card that is a button reads as one),
    // else the nearest list item, paragraph, heading or element with a class naming an item (a token ending in -card,
    // -pill, -stat, -chip, -row, -tile, -item, -cell, -count, -wallet, -panel or -pop).
    const CTL = 'button, a[href], [role=tab], [role=button]';
    const BOX = 'li, [role=listitem], [role=dialog], label, h1, h2, h3, h4, p';
    const BOXTOKEN = /-(card|pill|stat|chip|row|tile|item|cell|count|wallet|panel|pop)$/;
    const boxIds = new Map();
    const boxOf = (el) => {
      let b = el.closest(CTL);
      if (!b || !scope.contains(b))
        for (let e = el; e && e !== scope && e !== document.body; e = e.parentElement) {
          const cls = typeof e.className === 'string' ? e.className.split(/\s+/) : [];
          if (e.matches(BOX) || cls.some((k) => BOXTOKEN.test(k))) {
            b = e;
            break;
          }
        }
      if (!b) b = el;
      if (!boxIds.has(b)) boxIds.set(b, boxIds.size);
      return boxIds.get(b);
    };
    const chunks = [];
    const textOf = (root) => {
      const out = [];
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const t = n.textContent.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!shown(el)) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const rs = Array.from(rg.getClientRects()).filter((r) => inView(r) && !clipped(el, r));
        if (!rs.length) continue;
        out.push({ t, el, r: rs[0] });
      }
      return out;
    };
    for (const x of textOf(scope)) {
      const inTop = top ? top.contains(x.el) : true;
      const inPop = pop ? pop.contains(x.el) : false;
      const ctl = x.el.closest('button, [role=button], [role=tab], a[href]');
      chunks.push({ t: x.t, box: boxOf(x.el), x: Math.round(x.r.left), y: Math.round(x.r.top), h: Math.round(x.r.height), top: inTop, pop: inPop, ctl: !!ctl, inert: !!x.el.closest('[inert]') });
    }
    const controls = [];
    for (const el of scope.querySelectorAll('button, [role=button], [role=tab], [role=switch], a[href], input, select')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (!inView(r) || clipped(el, r, 1 / 3)) continue;
      const vis = textOf(el)
        .map((x) => x.t)
        .join(' ');
      const aria = el.getAttribute('aria-label');
      const lb = el.getAttribute('aria-labelledby');
      const lbText = lb ? lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim() : '';
      const inputLabel = el.id ? (document.querySelector(`label[for="${el.id}"]`) || {}).textContent || '' : '';
      const cs = getComputedStyle(el);
      controls.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        fk: el.dataset.fk || '',
        text: vis,
        aria: aria || '',
        name: (aria || lbText || inputLabel || vis || el.getAttribute('title') || el.value || '').replace(/\s+/g, ' ').trim(),
        primary: el.classList.contains('gs-btn-primary'),
        bg: cs.backgroundColor,
        bgImage: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 80),
        iconOnly: vis === '' && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'tab'),
        disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
        top: top ? top.contains(el) : true,
        pop: pop ? pop.contains(el) : false,
        inert: !!el.closest('[inert]'),
        tabbable: el.tabIndex >= 0 && !el.closest('[inert]') && !el.disabled,
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    const a = document.activeElement;
    const focus = a && a !== document.body ? (a.getAttribute('aria-label') || a.textContent || a.tagName).replace(/\s+/g, ' ').trim().slice(0, 80) + (a.dataset && a.dataset.fk ? ` [${a.dataset.fk}]` : '') : 'body';
    return { phase: gs ? gs.phase : null, top: topName, pop: pop ? pop.getAttribute('aria-label') || 'popover' : null, vw, vh, chunks, controls, focus };
  };

  const shoot = async (name, extra) => {
    const file = `${c.tag}-${name}.png`;
    await page.screenshot({ path: c.out + file }).catch((e) => errors.push('shot ' + name + ': ' + String(e).slice(0, 120)));
    const m = await page.evaluate(MEASURE, extra && extra.sel ? { sel: extra.sel } : {}).catch((e) => ({ error: String(e).slice(0, 200) }));
    report.shots[name] = { file, ...m, ...(extra || {}) };
    return m;
  };
  const url = (stage, q = '') => `${c.base}?debug&tier=${c.tier}&save=${stage}${q}`;
  const phase = (p, t = 90000) => page.waitForFunction((p) => window.__gs && window.__gs.phase === p, p, { timeout: t, polling: 50 }).then(() => true).catch(() => false);
  const go = async (stage, q = '', want = 'title') => {
    await page.goto(url(stage, q), { waitUntil: 'domcontentloaded', timeout: 90000 });
    return phase(want);
  };
  const click = async (sel, t = 4000) => {
    const ok = await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !!el && el.checkVisibility() && el.getAttribute('aria-disabled') !== 'true' && !el.disabled;
    }, sel, { timeout: t, polling: 100 }).then(() => true).catch(() => false);
    if (!ok) return false;
    // Focused first, as a keyboard or a pad user presses it: a sheet remembers what opened it and gives focus back.
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      el.focus({ preventScroll: true });
      el.click();
    }, sel);
    return true;
  };
  // A selector for the first visible button whose aria-label (or text) starts with `p`.
  const byLabel = async (p) =>
    page.evaluate((p) => {
      const all = Array.from(document.querySelectorAll('button, [role=button], [role=tab]'));
      const el = all.find((b) => b.checkVisibility() && ((b.getAttribute('aria-label') || '').startsWith(p) || (b.textContent || '').trim().startsWith(p)));
      if (!el) return null;
      el.setAttribute('data-t9', p);
      return `[data-t9="${p.replace(/"/g, '\\"')}"]`;
    }, p);
  const surface = () =>
    page.evaluate(() => {
      const ui = window.__gs && window.__gs.ui;
      if (!ui) return null;
      const photo = document.querySelector('.gs-photo');
      if (photo && photo.checkVisibility()) return 'photo';
      const m = ui.menus;
      if (m.settings.open) return 'settings';
      if (m.books.open) return 'books';
      if (m.sleds.open) return 'garage';
      if (m.pause.open) return 'pause';
      if (ui.title.popover && ui.title.popover.isConnected) return `popover:${ui.title.popKind}`;
      if (ui.results.layer.open) return `results:${ui.results.el ? ui.results.el.dataset.view : ''}`;
      if (ui.title.layer.open) return 'title';
      return window.__gs.phase;
    });
  const focusNow = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return a && a !== document.body ? (a.getAttribute('aria-label') || a.textContent || a.tagName).replace(/\s+/g, ' ').trim().slice(0, 80) + (a.dataset && a.dataset.fk ? ` [${a.dataset.fk}]` : '') : 'body';
    });
  // A scripted pad: navigator.getGamepads hands the game one standard pad whose buttons and axes we set.
  const padOn = () =>
    page.evaluate(() => {
      if (window.__pad) return;
      const b = () => ({ pressed: false, touched: false, value: 0 });
      window.__pad = { id: 'r9-truth scripted pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, b) };
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__pad, null, null, null] });
      window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: window.__pad }));
    });
  const padPress = async (i, ms = 120) => {
    await padOn();
    await page.evaluate((i) => {
      window.__pad.buttons[i] = { pressed: true, touched: true, value: 1 };
      window.__pad.timestamp = performance.now();
    }, i);
    await page.waitForTimeout(ms);
    await page.evaluate((i) => {
      window.__pad.buttons[i] = { pressed: false, touched: false, value: 0 };
      window.__pad.timestamp = performance.now();
    }, i);
    await page.waitForTimeout(150);
  };
  // The pad's d-pad: 12 up, 13 down, 14 left, 15 right.
  const padDir = (d) => padPress({ up: 12, down: 13, left: 14, right: 15 }[d], 90);
  const pinFrom = (from, speed = 30) =>
    page.evaluate(
      ({ from, speed }) => {
        window.__pinOn = true;
        const pin = () => {
          const rr = window.__gs.run;
          if (rr && !rr.sim.s.crashed && window.__pinOn) {
            const q = rr.sim.s;
            const cc = rr.sim.course;
            q.x = cc.safeX(q.z);
            q.y = cc.ground(q.x, q.z);
            q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * speed) / 2;
            q.vz = speed;
            q.vy = 0;
            q.speed = speed;
            q.grounded = true;
            q.heading = Math.atan2(q.vx, q.vz);
            q.velHeading = q.heading;
            q.invuln = 10;
          }
          if (window.__pinOn) requestAnimationFrame(pin);
        };
        pin();
        if (from > 0) window.__gs.run.sim.s.z = Math.max(window.__gs.run.sim.s.z, from);
      },
      { from, speed },
    );
  const reach = (z, t = 200000) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: t, polling: 64 }).catch(() => {});
  /** Rides the run in progress to its line (pinned on the safe line from `from`), and waits for the results. */
  const finishRun = async (from = c.from, speed = 30, want = 'results') => {
    await page.waitForFunction(() => window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(800);
    await pinFrom(from, speed);
    const fz = await page.evaluate(() => window.__gs.run.sim.course.finishZ);
    await reach(fz - 40);
    await page.evaluate(() => { window.__pinOn = false; });
    return phase(want, 60000);
  };
  // The results' first view: the directed sequence has landed (its last beat is under 5 s; 8 s leaves room), then
  // Details.
  const shootResults = async (name) => {
    await page.waitForTimeout(8000);
    await shoot(`${name}`);
    const det = await byLabel('Details');
    if (det) {
      await page.evaluate((s) => document.querySelector(s).click(), det);
      await page.waitForTimeout(1200);
      await shoot(`${name}-details`);
      const more = await page.evaluate(() => {
        const b = document.querySelector('.gs-res-body, [data-view="details"] .gs-res-scroll');
        return b ? b.scrollHeight > b.clientHeight + 4 : false;
      }).catch(() => false);
      report.shots[`${name}-details`].scrolls = more;
    }
  };
  const ready = (label) =>
    page.waitForFunction((label) => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => (x.getAttribute('aria-label') || '').startsWith(label));
      return !!b && !/Finding rivals/.test(b.getAttribute('aria-label') || '') && b.getAttribute('aria-disabled') !== 'true';
    }, label, { timeout: 60000, polling: 250 }).then(() => true).catch(() => false);

  // ------------------------------------------------------------ titles
  if (c.part === 'titles') {
    for (const st of c.stages) {
      await go(st);
      await page.waitForTimeout(3000);
      const first = await shoot(`${st}-title`, { stage: st, screen: 'title', at: '3 s' });
      const loading = (first.chunks || []).some((x) => /Finding rivals/.test(x.t));
      if (loading) {
        await ready('Daily Mountain');
        await ready('Weekly Cup');
        await page.waitForTimeout(800);
        await shoot(`${st}-title-ready`, { stage: st, screen: 'title', at: 'rivals in' });
      }
      if (st === 'fresh') continue;
      // The Cup picked, then the Trial (where Trials are open), then the Daily. (Each looked up once its rivals are
      // in: the title is drawn again when they arrive.)
      const cupSel = (await ready('Weekly Cup')) ? await byLabel('Weekly Cup') : null;
      if (cupSel) {
        await page.evaluate((s) => document.querySelector(s).click(), cupSel);
        await page.waitForTimeout(1500);
        await shoot(`${st}-title-cup`, { stage: st, screen: 'title-cup' });
        if (await click('[data-fk="week-trial"]', 30000)) {
          await page.waitForTimeout(1500);
          await shoot(`${st}-title-trial`, { stage: st, screen: 'title-trial' });
        }
      }
      const daySel = (await ready('Daily Mountain')) ? await byLabel('Daily Mountain') : null;
      if (daySel) {
        await page.evaluate((s) => document.querySelector(s).click(), daySel);
        await page.waitForTimeout(1500);
        await shoot(`${st}-title-daily`, { stage: st, screen: 'title-daily' });
      }
    }
    if (c.link) {
      for (const st of c.linkStages || ['fresh']) {
        await go(st, `&c=${c.link}`);
        await page.waitForTimeout(3000);
        await shoot(`${st}-title-link`, { stage: st, screen: 'title-link' });
      }
    }
  }

  // ------------------------------------------------------------ sheets and popovers, with Escape and the pad's B
  if (c.part === 'sheets') {
    const st = c.stages[0];
    await go(st);
    await page.waitForTimeout(3000);
    const openers = [
      ['garage', '[data-fk="sleds"]'],
      ['almanac', 'Almanac'],
      ['album', 'Spirit Album'],
      ['missions', '[data-fk="missions"]'],
      ['medals', '[data-fk="medals"]'],
      ['flame', 'Your flame'],
      ['twelve', 'The Twelve:'],
      ['settings', '[data-fk="settings"]'],
    ];
    const open = async (sel) => {
      const s = sel.startsWith('[') ? sel : await byLabel(sel);
      if (!s) return false;
      const ok = await click(s, 3000);
      await page.waitForTimeout(900);
      return ok;
    };
    const closeAny = async () => {
      // Back to the bare title: a sheet's close button, a popover's own toggle, else a click on the scene's corner.
      for (let i = 0; i < 3; i++) {
        const sf = await surface();
        if (sf === 'title') return;
        const closed = await page.evaluate(() => {
          const ui = window.__gs.ui;
          const top = ui.menus.topEl;
          const x = top && top.querySelector('[data-fk^="close-"]');
          if (x) {
            x.click();
            return true;
          }
          if (ui.title.popover) {
            ui.title.closeMissions();
            return true;
          }
          return false;
        });
        if (!closed) await page.mouse.click(c.tag === 'phone' ? 195 : 640, c.tag === 'phone' ? 420 : 360);
        await page.waitForTimeout(700);
      }
    };
    // Three passes, so the pad never puts its glyphs into a shot: every sheet and popover shot (the garage's every
    // shelf), then each closed with Escape, then (a scripted pad plugged in) each closed with B.
    const found = [];
    for (const [name, sel] of openers) {
      await closeAny();
      if (!(await open(sel))) {
        report.sheets.push({ name, stage: st, opened: false });
        continue;
      }
      const sf = await surface();
      await shoot(`${st}-${name}`, { stage: st, screen: name, surface: sf });
      found.push({ name, sel, sf, focusOpen: await focusNow() });
      if (name === 'garage') {
        const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).filter((b) => b.checkVisibility() && !b.closest('[inert]')).map((b) => (b.textContent || '').trim()));
        for (const t of tabs) {
          await page.evaluate((t) => Array.from(document.querySelectorAll('[role=tab]')).find((b) => (b.textContent || '').trim() === t).click(), t);
          await page.waitForTimeout(900);
          await shoot(`${st}-garage-${t.replace(/[^A-Za-z]+/g, '')}`, { stage: st, screen: `garage-${t}`, surface: 'garage' });
        }
      }
      if (name === 'almanac' || name === 'album') {
        const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).filter((b) => b.checkVisibility() && !b.closest('[inert]')).map((b) => (b.textContent || '').trim()));
        report.notes.push(`${st} ${name} tabs: ${tabs.join(', ') || 'none'}`);
      }
    }
    const esc = {};
    for (const x of found) {
      await closeAny();
      await open(x.sel);
      const was = await surface();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
      esc[x.name] = { open: was, closed: (await surface()) !== was, now: await surface(), focus: await focusNow() };
    }
    await closeAny();
    await padOn();
    for (const x of found) {
      await closeAny();
      await open(x.sel);
      const was = await surface();
      await padPress(1);
      await page.waitForTimeout(600);
      const now = await surface();
      report.sheets.push({ name: x.name, stage: st, opened: true, surface: x.sf, popover: x.sf.startsWith('popover'), focusOnOpen: x.focusOpen, escape: esc[x.name], padB: { reopened: was === x.sf, closed: now !== was, now, focus: await focusNow() } });
    }
    await closeAny();
    // Pause and photo mode, in a run.
    await go(st, '&autoride=1', 'run');
    await page.waitForTimeout(2500);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(900);
    const ps = await surface();
    await shoot(`${st}-pause`, { stage: st, screen: 'pause', surface: ps });
    const pFocus = await focusNow();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const pEsc = await surface();
    const pEscFocus = await focusNow();
    if (pEsc !== 'pause') {
      await page.keyboard.press('KeyP');
      await page.waitForTimeout(900);
    }
    await padPress(1);
    await page.waitForTimeout(700);
    const pB = await surface();
    const pBFocus = await focusNow();
    report.sheets.push({ name: 'pause', stage: st, opened: ps === 'pause', surface: ps, focusOnOpen: pFocus, escape: { closed: pEsc !== 'pause', now: pEsc, focus: pEscFocus }, padB: { reopened: true, closed: pB !== 'pause', now: pB, focus: pBFocus } });
    if (pB !== 'pause') {
      await page.keyboard.press('KeyP');
      await page.waitForTimeout(900);
    }
    if (await click('[data-fk="p-photo"]', 3000)) {
      await page.waitForTimeout(1500);
      const ph = await surface();
      await shoot(`${st}-photo`, { stage: st, screen: 'photo', surface: ph });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const phEsc = await surface();
      const phEscFocus = await focusNow();
      if (phEsc !== 'photo') await click('[data-fk="p-photo"]', 3000);
      await page.waitForTimeout(1200);
      await padPress(1);
      await page.waitForTimeout(800);
      const phB = await surface();
      report.sheets.push({ name: 'photo', stage: st, opened: ph === 'photo', surface: ph, escape: { closed: phEsc !== 'photo', now: phEsc, focus: phEscFocus }, padB: { reopened: true, closed: phB !== 'photo', now: phB, focus: await focusNow() } });
    } else report.sheets.push({ name: 'photo', stage: st, opened: false, note: 'no Photo on the pause card' });
  }

  // ------------------------------------------------------------ results
  if (c.part === 'results') {
    const st = c.stages[0];
    const sc = c.scenario;
    const tag = `${st}-results-${sc}`;
    const pickThenRide = async (label, trial) => {
      await go(st);
      if (!(await ready(label))) return false;
      await page.waitForTimeout(600);
      const s = await byLabel(label);
      if (!s) return false;
      await page.evaluate((s) => document.querySelector(s).click(), s);
      await page.waitForTimeout(1200);
      if (trial && !(await click('[data-fk="week-trial"]', 30000))) return false;
      await page.waitForTimeout(800);
      return click('[data-fk="ride"]', 30000);
    };
    let ok = true;
    if (sc === 'first') {
      ok = await go(st, '&autoride=1', 'run');
      ok = ok && (await finishRun());
    } else if (sc === 'crash') {
      ok = await go(st, '&autoride=1', 'run');
      await page.waitForTimeout(800);
      await pinFrom(1800);
      await page.waitForTimeout(1500);
      // Into the next obstacle with no get-up and no lantern to ward it, again until the sim crashes on its own tick
      // (a crash made outside a tick is never drained to the app).
      await page.evaluate(() => {
        window.__pinOn = false;
        const until = performance.now() + 15000;
        const hit = () => {
          const rr = window.__gs.run;
          if (!rr || rr.sim.s.crashed || performance.now() > until) return;
          const sim = rr.sim;
          const s = sim.s;
          s.getUps = 0;
          s.lantern = 0;
          s.invuln = 0;
          s.ghost = 0;
          let o = null;
          for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 4 && !o; k++) for (const q of sim.course.chunk(k).obstacles) if (q.z > s.z + 4 && (!o || q.z < o.z)) o = q;
          if (o) {
            s.x = o.x;
            s.z = o.z - 2.5;
            s.y = sim.course.ground(s.x, s.z);
            s.vx = 0;
            s.vz = 18;
            s.vy = 0;
            s.speed = 18;
            s.heading = 0;
            s.velHeading = 0;
            s.grounded = true;
          }
          setTimeout(hit, 400);
        };
        hit();
      });
      ok = ok && (await phase('results', 60000));
    } else if (sc === 'duel-won' || sc === 'duel-lost') {
      // The next of The Twelve's home, from the title's card; then the duel there.
      await go(st);
      await page.waitForTimeout(1500);
      const where = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => /^Next of The Twelve: .*, on /.test(x.getAttribute('aria-label') || ''));
        const m = b && /, on ([^,]+),/.exec(b.getAttribute('aria-label'));
        return m ? m[1] : null;
      });
      const mi = await page.evaluate((name) => {
        const b = Array.from(document.querySelectorAll('.gs-mtns button')).map((x) => x.getAttribute('aria-label') || '');
        return b.findIndex((l) => l.startsWith(name + '.'));
      }, where);
      report.notes.push(`duel on ${where} (mountain ${mi})`);
      ok = mi >= 0 && (await go(st, `&autoride=1&m=${mi}`, 'run'));
      // Won: on the line from 3.9 km at 30 m/s. Lost: the whole course at 30 m/s (about 150 s), slower than any of
      // The Twelve.
      ok = ok && (sc === 'duel-won' ? await finishRun() : await finishRun(0, 30));
    } else if (sc === 'cup') {
      ok = (await pickThenRide('Weekly Cup', false)) && (await finishRun());
    } else if (sc === 'trial') {
      ok = (await pickThenRide('Weekly Cup', true)) && (await finishRun());
    } else if (sc === 'daily') {
      ok = (await pickThenRide('Daily Mountain', false)) && (await finishRun());
    } else if (sc === 'night') {
      ok = await go(st, '&autoride=1&night&legs=2', 'run');
      await page.waitForTimeout(800);
      await pinFrom(c.from);
      const fz = await page.evaluate(() => window.__gs.run.sim.course.finishZ);
      await reach(fz - 40);
      await page.evaluate(() => { window.__pinOn = false; });
      const beat = await page.waitForSelector('.gs-nb-where', { timeout: 60000 }).then(() => true).catch(() => false);
      if (beat) {
        await page.waitForTimeout(700);
        await shoot(`${st}-night-between`, { stage: st, screen: 'night-between' });
        await page.waitForSelector('.gs-nb-where', { state: 'detached', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(300);
      } else report.notes.push('night: no beat between legs seen');
      ok = await finishRun();
    }
    if (ok) await shootResults(tag);
    else report.notes.push(`${tag}: did not reach the results (phase ${await page.evaluate(() => window.__gs && window.__gs.phase).catch(() => '?')})`);
    report.results = await page.evaluate(() => {
      const r = window.__gs.results;
      const s = r && r.spine;
      return r ? { finish: r.finish || null, crashed: !!r.crash, label: r.runAgainLabel ? r.runAgainLabel.text : null, primary: s ? s.primary : null, opened: s ? s.opened.map((o) => o.name) : null } : null;
    }).catch(() => null);
  }

  // ------------------------------------------------------------ Run Again to riding
  if (c.part === 'again') {
    const st = c.stages[0];
    await go(st, '&autoride=1', 'run');
    for (let i = 0; i <= c.n; i++) {
      await finishRun();
      await page.waitForTimeout(2500);
      // What the button says it will do (a Daily waits for its rivals; a duel has its own start).
      const button = await page.evaluate(() => {
        const r = window.__gs.results;
        const p = r && r.spine && r.spine.primary;
        return p ? `${p.text}${p.sub ? `: ${p.sub}` : ''}` : r && r.runAgainLabel ? r.runAgainLabel.text : null;
      }).catch(() => null);
      const tPress = await page.evaluate(() => performance.now());
      await page.keyboard.press('Space');
      const times = await page.evaluate(async (tPress) => {
        const g = window.__gs;
        let runAt = null;
        let rideAt = null;
        // (The dev server's mock platform plays a midgame ad between some runs: the published build has none.)
        let ad = false;
        const until = performance.now() + 15000;
        while (performance.now() < until) {
          await new Promise((r) => requestAnimationFrame(r));
          const now = performance.now();
          ad = ad || !!(g.platform && (g.platform.adOn || g.platform.adBusy));
          if (runAt === null && g.phase === 'run') runAt = now - tPress;
          if (runAt !== null && g.run && g.run.sim.tick > 1 && g.run.sim.s.speed > 1) {
            rideAt = now - tPress;
            break;
          }
        }
        return { runAt: runAt && Math.round(runAt), rideAt: rideAt && Math.round(rideAt), ad };
      }, tPress);
      // The first is the warm-up (a fresh browser's first run).
      report.again.push({ i, warm: i > 0, button, ...times });
    }
  }

  // ------------------------------------------------------------ the title's doors: pointer, keyboard, pad, names
  if (c.part === 'crawl') {
    const st = c.stages[0];
    const SKIP = /^(Ride|Duel|Accept|Mute|Buy|Confirm|Light|Swap|Equip|Wear|Listen|Reset|Previous mountains|More mountains)\b|^Ride /;
    await go(st);
    await page.waitForTimeout(3000);
    const m0 = await page.evaluate(MEASURE, {});
    const titleCtl = m0.controls.filter((x) => x.top && !x.inert);
    const crawl = { stage: st, titleText: m0.chunks.filter((x) => !x.inert).map((x) => x.t).join(' | '), title: titleCtl.map((x) => ({ name: x.name, text: x.text, fk: x.fk, tabbable: x.tabbable, iconOnly: x.iconOnly })), doors: [], tab: [], pad: null };
    for (let i = 0; i < titleCtl.length; i++) {
      const ctl = titleCtl[i];
      if (SKIP.test(ctl.name) || ctl.primary) {
        crawl.doors.push({ from: ctl.name, skipped: true });
        continue;
      }
      await go(st);
      await page.waitForTimeout(2200);
      // (The Cup's and the Daily's cards take no tap until their rivals are in.)
      if (ctl.fk === 'cup' || ctl.fk === 'daily') await ready(ctl.fk === 'cup' ? 'Weekly Cup' : 'Daily Mountain');
      const hit = await page.evaluate(({ x, y, w, h, fk }) => {
        const el = (fk && document.querySelector(`[data-fk="${fk}"]`)) || document.elementFromPoint(x + w / 2, y + h / 2);
        const b = el && el.closest('button, [role=button], [role=tab], a[href]');
        if (!b) return false;
        b.click();
        return true;
      }, ctl);
      await page.waitForTimeout(1300);
      const sf = await surface();
      const m = await page.evaluate(MEASURE, {});
      // What it showed: a sheet's text, a popover's, or (a pick on the title itself, the Cup's card say) the title as
      // it is now.
      const inSurface = m.top !== 'title' ? m.chunks.filter((x) => x.top) : m.pop ? m.chunks.filter((x) => x.pop) : m.chunks.filter((x) => !x.inert);
      const doors = (m.top !== 'title' ? m.controls.filter((x) => x.top) : m.pop ? m.controls.filter((x) => x.pop) : m.controls.filter((x) => !x.inert)).map((x) => x.name).filter(Boolean);
      // A second tap: each tab of what opened (its own shelf or page), text read.
      const second = [];
      const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).filter((b) => b.checkVisibility() && !b.closest('[inert]')).map((b) => (b.textContent || '').trim()));
      for (const t of tabs.slice(0, 10)) {
        await page.evaluate((t) => Array.from(document.querySelectorAll('[role=tab]')).find((b) => (b.textContent || '').trim() === t).click(), t);
        await page.waitForTimeout(700);
        const m2 = await page.evaluate(MEASURE, {});
        second.push({ via: t, text: m2.chunks.filter((x) => x.top).map((x) => x.t).join(' | ').slice(0, 6000) });
      }
      crawl.doors.push({ from: ctl.name, clicked: hit, opened: sf, text: inSurface.map((x) => x.t).join(' | ').slice(0, 8000), doors, second });
    }
    // Keyboard: the Tab order from the top of the page.
    await go(st);
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(60);
      const f = await focusNow();
      if (seen.includes(f) && seen.length > 2 && f === seen[0]) break;
      seen.push(f);
    }
    crawl.tab = seen;
    // The pad: from the first press, every control a direction reaches, breadth first.
    await padOn();
    await padDir('down');
    await page.waitForTimeout(200);
    const start = await focusNow();
    const reached = new Set([start]);
    const edges = [];
    const queue = [start];
    let presses = 0;
    while (queue.length && presses < 160) {
      const from = queue.shift();
      for (const d of ['up', 'down', 'left', 'right']) {
        // Back to `from` by its label, then one press.
        const there = await page.evaluate((f) => {
          const all = Array.from(document.querySelectorAll('button, input, select, a[href]'));
          const el = all.find((b) => {
            const n = (b.getAttribute('aria-label') || b.textContent || b.tagName).replace(/\s+/g, ' ').trim().slice(0, 80) + (b.dataset && b.dataset.fk ? ` [${b.dataset.fk}]` : '');
            return n === f;
          });
          if (!el) return false;
          el.focus();
          return true;
        }, from);
        if (!there) break;
        await padDir(d);
        presses++;
        const to = await focusNow();
        if (to !== from) edges.push([from, d, to]);
        if (!reached.has(to)) {
          reached.add(to);
          queue.push(to);
        }
      }
    }
    crawl.pad = { start, reached: [...reached], edges: edges.length, presses };
    report.crawl = crawl;
  }

  await page.goto('about:blank').catch(() => {});
  return JSON.stringify({ ...report, errors, warns: warns.slice(0, 30) });
}
