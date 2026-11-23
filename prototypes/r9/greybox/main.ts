import { makeRenderer, renderView } from './kit';
import { SCENES } from './scenes';

// The greybox page: one view a draw, by `?s=<scene>&v=<view>`, and `window.__gb` for the capture script
// (scripts/r9/concepts-frames.js) and the owner's page.

const canvas = document.getElementById('gb') as HTMLCanvasElement;
const renderer = makeRenderer(canvas);

function draw(id: string, key: string): number {
  const def = SCENES.find((s) => s.id === id);
  const view = def?.views.find((v) => v.key === key);
  if (!def || !view) throw new Error(`no view ${id}/${key}`);
  return renderView(renderer, def, view);
}

declare global {
  interface Window {
    __gb: { list: { id: string; title: string; views: { key: string; name: string }[] }[]; draw: (id: string, key: string) => number };
  }
}

window.__gb = {
  list: SCENES.map((s) => ({ id: s.id, title: s.title, views: s.views.map((v) => ({ key: v.key, name: v.name })) })),
  draw,
};

const q = new URLSearchParams(location.search);
const s = q.get('s');
if (s) draw(s, q.get('v') ?? 'opening');
