// Motion helpers. Everything animates transform and opacity only, and every helper degrades to a
// plain fade when the player asked for reduced motion.

const mq: MediaQueryList | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export function reduced(): boolean {
  return mq ? mq.matches : false;
}

/** Spring-ish pop: slight overshoot. */
export const SPRING = 'cubic-bezier(0.2, 0.9, 0.2, 1.1)';
export const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
export const EASE_IN = 'cubic-bezier(0.55, 0, 0.85, 0.35)';

/**
 * element.animate() with a reduced-motion fallback that keeps only the opacity channel.
 * `keep` keeps the full duration in reduced mode (for lifetimes), otherwise it is capped.
 */
export function play(
  el: Element,
  frames: Keyframe[],
  opts: KeyframeAnimationOptions,
  keep = false,
): Animation | null {
  if (typeof el.animate !== 'function') return null;
  if (reduced()) {
    const fade: Keyframe[] = frames.map((k) => ({ opacity: k.opacity ?? 1, offset: k.offset }));
    const d = Number(opts.duration ?? 200);
    return el.animate(fade, { ...opts, duration: keep ? d : Math.min(d, 220), easing: 'linear' });
  }
  return el.animate(frames, opts);
}

/** A quick scale bump for "this value just changed" feedback. No-op in reduced motion. */
export function bump(el: Element, amount = 1.12, ms = 260): void {
  if (reduced() || typeof el.animate !== 'function') return;
  el.animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${amount})`, offset: 0.35 }, { transform: 'scale(1)' }],
    { duration: ms, easing: SPRING },
  );
}

/** FLIP: animate siblings from their old positions after a DOM change shifted them. */
export function flip(els: HTMLElement[], mutate: () => void, ms = 220): void {
  const before = els.map((e) => e.getBoundingClientRect().top);
  mutate();
  if (reduced()) return;
  els.forEach((e, i) => {
    if (!e.isConnected) return;
    const dy = before[i] - e.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5 || typeof e.animate !== 'function') return;
    e.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: ms, easing: EASE_OUT });
  });
}
