// The page's one beat. A changed figure or a moved label costs the page a style, layout and paint, and on
// a throttled Low frame about half the frame goes there. Spread over every frame, those costs leave no
// frame free. Everything that changes often waits for this beat instead, so the costs land together and
// two frames in three do no page work at all, and nobody reads a units digit any faster for it (decisions
// 205 and 217). A cash-in still lands in the score at once.

/** How often the page may change: twenty times a second, every third frame at 60 Hz. */
export const PAGE_BEAT_MS = 48;

let at = -Infinity;
let frame = Number.NaN;
let on = false;

/** Is this frame on the beat? Asked by anyone, any number of times: a frame's timestamp is the same for
 *  all of them, so they land together. */
export function pageBeat(): boolean {
  const t = document.timeline?.currentTime;
  const now = typeof t === 'number' ? t : performance.now();
  if (now !== frame) {
    frame = now;
    on = now - at >= PAGE_BEAT_MS;
    if (on) at = now;
  }
  return on;
}
