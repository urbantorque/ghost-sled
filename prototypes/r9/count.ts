// Round 9, the screens lane: what a page is laid out for, and the counter that reads a screen's visible words and
// controls the way a player meets them. No side effects beyond the counter on window, so today.ts (the game's own UI)
// can use it without the prototypes' keys and pad.

/** Which device the page is laid out for: a phone held upright, a desk, or a wide desk. */
export function device(): 'phone' | 'desk' | 'wide' {
  const q = new URLSearchParams(location.search).get('device');
  if (q === 'phone' || q === 'desk' || q === 'wide') return q;
  return innerWidth < 640 ? 'phone' : innerWidth >= 1700 ? 'wide' : 'desk';
}

// ---------------------------------------------------------------- the count

export interface Count {
  words: number;
  controls: number;
  text: string[];
  buttons: string[];
}

/**
 * The words and controls a player meets on the screen as it stands: text that is drawn (its box on screen, not
 * hidden, not at no opacity, not clipped to a pixel for a screen reader), and the controls drawn the same way. The
 * truth lane counts the live screens with the same rules (its notes say which); a screen reader's extra words are not
 * a player's.
 */
export function countScreen(root: ParentNode = document.body): Count {
  const vw = innerWidth;
  const vh = innerHeight;
  const seen = (el: Element): boolean => {
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
    if (el.closest('.gs9-sr, .gs-sr, [hidden], [inert] [data-count-skip]')) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    return r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
  };
  const text: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const s = (n.textContent ?? '').trim();
    if (!s || !n.parentElement || !seen(n.parentElement)) continue;
    // A clipped-to-a-pixel span (a screen reader's words) has a box under 3 px and is left out above.
    text.push(s);
  }
  const words = text.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const ctl = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, [role=button], [role=tab]')).filter(seen);
  return { words, controls: ctl.length, text, buttons: ctl.map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)) };
}
(window as unknown as { __count: typeof countScreen }).__count = countScreen;
