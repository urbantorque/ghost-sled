// DOM effects for the standalone mock: the fake ad break and the happytime confetti. Both are
// self-contained (inline styles, no stylesheet) and do nothing outside a browser.

import { hasDom } from './backend';

const INK = '#121933';
const OFF_WHITE = '#F5F3FF';
const CONFETTI = ['#FFD34D', '#8FF3E4', '#FFE7A8']; // marigold, spectral mint, pale gold
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TOP_Z = '2147483647';

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function el(tag: string, css: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Full-screen fake ad with a seconds countdown. Returns a remover; a no-op outside the DOM. */
export function showAdOverlay(label: string, durationMs: number): () => void {
  if (!hasDom() || !document.body) return () => {};
  const still = prefersReducedMotion();
  const root = el(
    'div',
    `position:fixed;inset:0;z-index:${TOP_Z};display:flex;flex-direction:column;align-items:center;` +
      'justify-content:center;gap:14px;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) ' +
      'max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));' +
      `background:${INK};color:${OFF_WHITE};font-family:${FONT};` +
      'text-align:center;touch-action:none;overscroll-behavior:contain;user-select:none;-webkit-user-select:none;cursor:default;outline:none;' +
      (still ? '' : 'opacity:0;transition:opacity 140ms ease-out;'),
  );
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Ad break (mock)');
  root.setAttribute('data-platform-mock-ad', label);
  root.tabIndex = -1;

  const kicker = el('div', 'font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.6;', label);
  const title = el('div', 'font-size:clamp(24px,5vw,40px);font-weight:900;font-style:italic;line-height:1.1;text-wrap:balance;', 'Ad break (mock)');
  const count = el(
    'div',
    'font-size:clamp(44px,9vw,72px);font-weight:900;line-height:1;font-variant-numeric:tabular-nums;',
  );
  count.setAttribute('aria-live', 'polite');
  const track = el('div', `width:min(220px,60vw);height:4px;border-radius:999px;background:rgba(245,243,255,0.16);overflow:hidden;`);
  const bar = el(
    'div',
    `width:100%;height:100%;border-radius:999px;background:${OFF_WHITE};transform-origin:left center;` +
      (still ? '' : `transition:transform ${durationMs}ms linear;`),
  );
  track.appendChild(bar);
  root.append(kicker, title, count, track);
  // Take focus like a real ad iframe would, and hand it back afterwards.
  const prevFocus = document.activeElement;
  document.body.appendChild(root);
  root.focus({ preventScroll: true });

  const start = performance.now();
  const tick = (): void => {
    const left = Math.max(0, Math.ceil((durationMs - (performance.now() - start)) / 1000));
    if (count.textContent !== String(left)) count.textContent = String(left);
  };
  tick();
  const iv = setInterval(tick, 100);
  if (!still) {
    // Force a style flush so the transitions run from their initial values.
    void root.offsetWidth;
    root.style.opacity = '1';
    bar.style.transform = 'scaleX(0)';
  }
  return () => {
    clearInterval(iv);
    root.remove();
    if (prevFocus instanceof HTMLElement && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
  };
}

/** A brief burst of glowing marigold / mint motes from about the rider's height. Skipped under reduced motion. */
export function confettiBurst(): void {
  if (!hasDom() || !document.body || prefersReducedMotion()) return;
  const probe = document.createElement('i');
  if (typeof probe.animate !== 'function') return;
  const layer = el('div', `position:fixed;inset:0;z-index:${TOP_Z};pointer-events:none;overflow:hidden;`);
  layer.setAttribute('aria-hidden', 'true');
  const reach = Math.min(window.innerWidth, window.innerHeight);
  // Round motes rather than paper flecks, and never up into the top 150 px, where the race row and
  // its banner name what is being celebrated (flecks over "+10 gifts" hid the reward).
  const top = 0.56 * window.innerHeight;
  let longest = 0;
  for (let i = 0; i < 26; i++) {
    const w = 4 + Math.random() * 4;
    const c = CONFETTI[i % CONFETTI.length];
    const p = el(
      'i',
      `position:absolute;left:50%;top:${top.toFixed(0)}px;width:${w.toFixed(1)}px;height:${w.toFixed(1)}px;margin:${(-w / 2).toFixed(1)}px 0 0 ${(-w / 2).toFixed(1)}px;` +
        `border-radius:50%;background:${c};box-shadow:0 0 ${(w * 1.5).toFixed(0)}px ${c};will-change:transform,opacity;`,
    );
    layer.appendChild(p);
    // Upward fan, then a gravity fall: the two keyframe segments ease out, then ease in.
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.05;
    const v = reach * (0.06 + Math.random() * 0.3);
    const dx = Math.cos(a) * v;
    const dy = Math.max(150 - top, Math.sin(a) * v);
    const fall = reach * (0.35 + Math.random() * 0.25);
    const spin = (Math.random() - 0.5) * 1080;
    const dur = 1100 + Math.random() * 600;
    longest = Math.max(longest, dur);
    p.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 1, easing: 'cubic-bezier(0.15,0.75,0.35,1)' },
        { transform: `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${(spin * 0.4).toFixed(0)}deg) scale(1)`, opacity: 1, offset: 0.38, easing: 'cubic-bezier(0.55,0,0.85,0.6)' },
        { transform: `translate(${(dx * 1.25).toFixed(1)}px,${(dy + fall).toFixed(1)}px) rotate(${spin.toFixed(0)}deg) scale(0.85)`, opacity: 0 },
      ],
      { duration: dur, fill: 'forwards' },
    );
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), longest + 100);
}
