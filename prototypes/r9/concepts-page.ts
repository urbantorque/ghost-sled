import { makeRenderer, renderView } from './greybox/kit';
import { SCENES } from './greybox/scenes';

// The owner's page for round 9's mountain concepts: `notes/r9-concepts.md` laid out in the game's own UI language,
// with every greybox frame drawn live in this page (one renderer, one frame at a time), so the notes stay the one
// source and nothing here is a stored image. Dev only.

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Bold, italic and code inside a line. */
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface FrameRef {
  id: string;
  view: string;
  alt: string;
}

/** A small markdown reader for what the notes use: headings, paragraphs, lists, tables, rules and frame images. */
function render(md: string, frames: FrameRef[], toc: { id: string; text: string }[]): string {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let i = 0;
  const image = /^!\[([^\]]*)\]\(frame:([a-z]+)\/([a-z]+)\)\s*$/;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const id = slug(text);
      if (level === 2) toc.push({ id, text });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (/^---\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }
    if (image.test(line)) {
      const row: string[] = [];
      while (i < lines.length && image.test(lines[i])) {
        const m = image.exec(lines[i])!;
        const n = frames.length;
        frames.push({ id: m[2], view: m[3], alt: m[1] });
        row.push(`<figure class="frame"><div class="shot" data-frame="${n}"><span>Drawing the frame…</span></div><figcaption>${inline(m[1])}</figcaption></figure>`);
        i++;
      }
      out.push(`<div class="frames${row.length > 2 ? ' three' : ''}">${row.join('')}</div>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<div class="table"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c, k) => (k === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    const list = /^(\s*)(- |\d+\. )(.*)$/;
    if (list.test(line)) {
      // A list, its items' continuation lines and one level of nesting.
      const ordered = /^\d+\. /.test(line.trim());
      const items: { depth: number; text: string }[] = [];
      while (i < lines.length && lines[i].trim()) {
        const m = list.exec(lines[i]);
        if (m) items.push({ depth: m[1].length >= 2 ? 1 : 0, text: m[3] });
        else items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      let html = `<${tag}>`;
      items.forEach((it, k) => {
        const next = items[k + 1];
        if (it.depth === 0) html += `<li>${inline(it.text)}${next && next.depth === 1 ? '<ul>' : '</li>'}`;
        else html += `<li>${inline(it.text)}</li>${!next || next.depth === 0 ? '</ul></li>' : ''}`;
      });
      out.push(html + `</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\||---|!\[|\s*- |\d+\. )/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

async function main(): Promise<void> {
  const article = document.getElementById('notes')!;
  const nav = document.getElementById('toc')!;
  let md: string;
  try {
    const res = await fetch('/notes/r9-concepts.md', { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    md = await res.text();
  } catch (e) {
    article.innerHTML = `<p class="error">The notes did not load (${esc(String(e))}). Open this page from the dev server: <code>npm run dev</code>, then <code>/prototypes/r9/concepts.html</code>.</p>`;
    return;
  }
  const frames: FrameRef[] = [];
  const toc: { id: string; text: string }[] = [];
  // The notes' own title is the page's header.
  article.innerHTML = render(md.replace(/\r/g, '').replace(/^# [^\n]*\n/, ''), frames, toc);
  nav.innerHTML = `<ol>${toc.map((t) => `<li><a href="#${t.id}">${inline(t.text)}</a></li>`).join('')}</ol>`;

  // Every frame, one at a time on one renderer, each set as an image in its place.
  const status = document.getElementById('status');
  if (status) status.textContent = `Drawing ${frames.length} greybox frames…`;
  const canvas = document.createElement('canvas');
  const renderer = makeRenderer(canvas);
  for (let n = 0; n < frames.length; n++) {
    const f = frames[n];
    const slot = article.querySelector<HTMLElement>(`[data-frame="${n}"]`);
    if (!slot) continue;
    const def = SCENES.find((s) => s.id === f.id);
    const view = def?.views.find((v) => v.key === f.view);
    if (!def || !view) {
      slot.innerHTML = `<span>No such frame: ${esc(f.id)}/${esc(f.view)}</span>`;
      continue;
    }
    // Let the page paint between frames: each takes a moment to build.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    renderView(renderer, def, view);
    const img = new Image(1280, 720);
    img.src = canvas.toDataURL('image/png');
    img.alt = `${def.title}, greybox: ${view.name}`;
    img.decoding = 'async';
    slot.replaceChildren(img);
  }
  renderer.dispose();
  article.removeAttribute('aria-busy');
  if (status) status.textContent = `All ${frames.length} frames drawn.`;
}

void main();
