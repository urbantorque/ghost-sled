import type { NightBeatView } from '../game/modes';
import { h, sr } from './dom';
import { icon } from './icons';
import './modes.css';

// Round 8, the modes lane: the Long Night's beat between two legs. One ink panel over the live scene, a breath long:
// the leg to come and its mountain, the night deepening (its mood and event), and what rides in with you (the
// lantern, the get-ups, the charms held). Never a menu: it goes on by itself, and a tap or Run Again's key goes at
// once. Reduced motion keeps the beat and drops the slide.

/** How long the beat holds before the next leg starts (ms). */
export const NIGHT_BEAT_MS = 2400;
/** Its way out, before the leg starts (ms). */
const OUT_MS = 220;

const GET_UPS = 3;

/** Shows the beat; `go` runs once, when it is over or tapped. Returns a function that takes it down unasked. */
export function showNightBeat(root: HTMLElement, v: NightBeatView, still: boolean, go: () => void): () => void {
  const host = root.querySelector<HTMLElement>('.gs-ui') ?? root;
  const where = h('span', 'gs-nb-where', v.mountain);
  where.setAttribute('translate', 'no');
  const deep = [v.mood, v.event].filter(Boolean).join(' · ');
  const pips = h('span', 'gs-nb-pips');
  pips.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < GET_UPS; i++) pips.append(h('span', `gs-nb-pip${i < v.getUps ? ' is-on' : ''}`));
  const charms = v.charms.length > 0 ? h('span', 'gs-nb-charms', ...v.charms.map((c) => h('span', 'gs-nb-charm', c))) : null;
  const lantern = h('span', 'gs-nb-lantern', icon('lantern'), h('span', 'gs-num', `${Math.round(v.lantern * 100)}%`));
  const carried = v.n > 1 ? h('p', 'gs-nb-carry', h('span', 'gs-nb-k', 'Carried'), lantern, pips, charms) : null;
  const el = h(
    'section',
    `gs-nightbeat${still ? '' : ' is-moving'}`,
    h('p', 'gs-nb-leg', h('span', 'gs-nb-k', 'The Long Night'), h('span', 'gs-num', `Leg ${v.n} of ${v.of}`)),
    h('h2', 'gs-nb-head', where, v.mirror ? h('span', 'gs-nb-mirror', 'Mirrored') : null),
    deep ? h('p', 'gs-nb-deep', icon('flame'), h('span', '', `The night deepens: ${deep}`)) : null,
    carried,
    sr(`Leg ${v.n} of ${v.of}: ${v.mountain}${v.mirror ? ', mirrored' : ''}.${deep ? ` The night deepens: ${deep}.` : ''} Carried: ${Math.round(v.lantern * 100)}% of a lantern, ${v.getUps} get-ups${v.charms.length ? `, ${v.charms.join(', ')}` : ''}.`),
  );
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  let done = false;
  let leave = 0;
  let hold = 0;
  const off = (): void => {
    window.clearTimeout(hold);
    window.clearTimeout(leave);
    el.remove();
  };
  const finish = (): void => {
    if (done) return;
    done = true;
    window.clearTimeout(hold);
    el.classList.add('is-out');
    leave = window.setTimeout(
      () => {
        el.remove();
        go();
      },
      still ? 0 : OUT_MS,
    );
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    finish();
  });
  host.append(el);
  // (In on the next frame, so the slide plays from its start.)
  requestAnimationFrame(() => el.classList.add('is-in'));
  hold = window.setTimeout(finish, NIGHT_BEAT_MS);
  return off;
}
