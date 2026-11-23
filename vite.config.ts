import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Plugin, defineConfig } from 'vite';

/** Round 9, the truth lane, dev server only: `?debug&save=<name>` puts scripts/playtest/fixtures/<name>.json in the page
 *  as a JSON script element (#gs-fixture), which app.ts reads before the save is made (src/game/devsave.ts). A build
 *  never runs this, so no fixture reaches `dist`. */
function saveFixtures(): Plugin {
  let root = '.';
  return {
    name: 'ghost-sled-save-fixtures',
    apply: 'serve',
    configResolved(c) {
      root = c.root;
    },
    transformIndexHtml(html, ctx) {
      const name = new URL(ctx.originalUrl ?? '/', 'http://dev').searchParams.get('save');
      if (!name || !/^[a-z0-9-]{1,40}$/.test(name)) return html;
      const file = resolve(root, 'scripts/playtest/fixtures', `${name}.json`);
      if (!existsSync(file)) return html;
      const json = readFileSync(file, 'utf8').replace(/</g, '\\u003c');
      return [{ tag: 'script', attrs: { id: 'gs-fixture', type: 'application/json' }, children: json, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [saveFixtures()],
  build: {
    target: 'es2020',
    outDir: 'dist/game',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1400,
    reportCompressedSize: true,
  },
  worker: {
    format: 'es',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    hmr: { overlay: false },
  },
});
