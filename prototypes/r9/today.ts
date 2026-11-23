// Round 9, the screens lane: today's title and results (the game's own UI, src/ui, unchanged) mounted over the same
// captured frame and fed the same TitleModel and ResultsModel as the prototypes (fixtures.ts), so a blind pair differs
// only in the screen. Its handlers do nothing but log: nothing here rides.
//   today.html?screen=title&stage=run20     today.html?screen=results&case=duel-won[&open=details]
import type { UIHandlers } from '../../src/ui/contract';
import { UI, type UIMenuHandlers } from '../../src/ui/ui';
import { backdrop, CASES, resultsBackdrop, resultsModel, STAGES, titleBackdrop, titleModel, type Case, type Stage } from './fixtures';
import { countScreen, device } from './count';

const q = new URLSearchParams(location.search);
const screen = q.get('screen') === 'results' ? 'results' : 'title';
const stage = (STAGES as readonly string[]).includes(q.get('stage') ?? '') ? (q.get('stage') as Stage) : 'run20';
const kase = (CASES as readonly string[]).includes(q.get('case') ?? '') ? (q.get('case') as Case) : 'podium';
const dev = device();
document.querySelector<HTMLElement>('.p9-scene')!.style.backgroundImage = `url("${backdrop(dev, screen === 'title' ? titleBackdrop(stage) : resultsBackdrop(kase))}")`;

const calls: string[] = [];
const log = (s: string) => calls.push(s);
const noop = new Proxy({} as UIHandlers & UIMenuHandlers, { get: (_t, k) => (...a: unknown[]) => log(`${String(k)}(${a.map((x) => JSON.stringify(x)).join(', ')})`) });
const ui = new UI(document.getElementById('app')!, noop);
(window as unknown as { __calls: string[]; __count: typeof countScreen }).__calls = calls;
// A phone is a touch device: the title's keycaps and the results' prompts follow, as they do in the game.
if (dev === 'phone') ui.inputModeChanged('touch');

if (screen === 'title') {
  const m = titleModel(stage);
  if (dev === 'phone') m.inputMode = 'touch';
  ui.showTitle(m);
} else {
  ui.showResults(resultsModel(kase));
  if (q.get('open') === 'details') {
    // Land the story, then go one level down, as a player pressing Details would.
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('.gs-story')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-fk="details"]')?.click(), 200);
    }, 300);
  }
}
