// Tiles frames into one PNG contact sheet (for reading many frames at once):
//   node scripts/playtest/tile.mjs <out.png> <cols> <width> <file...>
// Each tile is scaled to width/cols and labelled with its file name. Uses Playwright's Chromium.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { chromium } from 'file:///C:/Users/roger/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
const [out, colsS, widthS, ...files] = process.argv.slice(2);
const cols = +colsS;
const width = +widthS;
const tiles = files.map((f) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${basename(f)}</figcaption></figure>`).join('');
const html = `<!doctype html><style>body{margin:0;background:#111;color:#eee;font:11px system-ui}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px;width:${width}px}figure{margin:0;position:relative}figcaption{position:absolute;left:0;bottom:0;background:#000a;padding:1px 4px}img{width:100%;display:block}</style><main>${tiles}</main>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width, height: 400 } });
await page.setContent(html);
await page.waitForTimeout(200);
await page.locator('main').screenshot({ path: out });
await browser.close();
console.log(out);
