// Round 9, the screens lane: the owner's page. Every prototype state, and today's screen on the same model beside it,
// at desk (1280 x 720), wide (1920 x 1080) and phone (390 x 844) sizes, opened in a frame scaled to fit.
import { CASE_LABEL, CASES, STAGE_LABEL, STAGES } from './fixtures';

const frame = document.getElementById('frame') as HTMLIFrameElement;
const cap = document.getElementById('cap')!;
const SIZES = { desk: [1280, 720], wide: [1920, 1080], phone: [390, 844] } as const;
type Size = keyof typeof SIZES;

function show(url: string, size: Size, label: string, btn: HTMLButtonElement): void {
  const [w, hgt] = SIZES[size];
  frame.width = String(w);
  frame.height = String(hgt);
  const box = frame.parentElement!.getBoundingClientRect();
  const scale = Math.min(1, (box.width - 8) / w, (innerHeight - 110) / hgt);
  frame.style.transform = `scale(${scale.toFixed(3)})`;
  frame.style.marginBottom = `${-(hgt * (1 - scale)).toFixed(0)}px`;
  frame.src = `${url}${url.includes('?') ? '&' : '?'}device=${size}`;
  cap.replaceChildren(`${label}, ${size} (${w} x ${hgt}). `, Object.assign(document.createElement('a'), { href: frame.src, textContent: 'Open on its own', target: '_blank', rel: 'noopener' }));
  for (const b of document.querySelectorAll('[aria-pressed="true"]')) b.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-pressed', 'true');
  frame.focus();
}

function row(parent: HTMLElement, label: string, url: string, today: string | null): void {
  const r = document.createElement('div');
  r.className = 'row';
  const name = document.createElement('span');
  name.textContent = label;
  r.append(name);
  for (const size of ['desk', 'wide', 'phone'] as Size[]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gs9-b gs9-b-secondary';
    b.textContent = size === 'desk' ? 'Desk' : size === 'wide' ? 'Wide' : 'Phone';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `${label}, ${size}`);
    b.addEventListener('click', () => show(url, size, label, b));
    r.append(b);
  }
  parent.append(r);
  if (today) {
    const t = document.createElement('div');
    t.className = 'row';
    const n = document.createElement('span');
    n.textContent = '   today';
    n.style.color = 'var(--text-dim)';
    n.style.paddingLeft = '14px';
    t.append(n);
    for (const size of ['desk', 'wide', 'phone'] as Size[]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gs9-b gs9-b-quiet';
      b.textContent = size === 'desk' ? 'Desk' : size === 'wide' ? 'Wide' : 'Phone';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', `Today's screen for ${label}, ${size}`);
      b.addEventListener('click', () => show(today, size, `Today: ${label}`, b));
      t.append(b);
    }
    parent.append(t);
  }
}

const titles = document.getElementById('titles')!;
for (const s of STAGES) row(titles, STAGE_LABEL[s], `./title.html?stage=${s}`, `./today.html?screen=title&stage=${s}`);
const doors = document.getElementById('doors')!;
row(doors, 'Daily and Cup', './title.html?stage=run20&open=events', null);
row(doors, 'Progress', './title.html?stage=run20&open=progress', null);
row(doors, 'Daily and Cup, run 50', './title.html?stage=run50&open=events', null);
row(doors, 'Progress, run 50', './title.html?stage=run50&open=progress', null);
const results = document.getElementById('results')!;
for (const c of CASES) {
  row(results, CASE_LABEL[c], `./results.html?case=${c}`, `./today.html?screen=results&case=${c}`);
  row(results, `${CASE_LABEL[c]}: Details`, `./results.html?case=${c}&open=details`, `./today.html?screen=results&case=${c}&open=details`);
}
