// Cuts the same rectangle out of several frames and stacks the cuts, enlarged without smoothing, so
// edges can be read pixel by pixel (anti-aliasing, a reflection's stipple):
//   node scripts/playtest/crop.mjs <out.png> <x> <y> <w> <h> <scale> <file...>
// Each cut is labelled with its file name. Uses Playwright's Chromium, as tile.mjs does.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { chromium } from 'file:///C:/Users/roger/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs';
const [out, xS, yS, wS, hS, kS, ...files] = process.argv.slice(2);
const [x, y, w, h, k] = [xS, yS, wS, hS, kS].map(Number);
const cuts = files.map((f) => `<figure><div><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"></div><figcaption>${basename(f)}</figcaption></figure>`).join('');
const html = `<!doctype html><style>body{margin:0;background:#111;color:#eee;font:12px system-ui}main{width:${w * k}px}figure{margin:0 0 3px;position:relative}div{width:${w * k}px;height:${h * k}px;overflow:hidden}img{display:block;image-rendering:pixelated;transform-origin:0 0;transform:scale(${k}) translate(${-x}px,${-y}px)}figcaption{position:absolute;left:4px;top:3px;background:#000a;padding:1px 5px}</style><main>${cuts}</main>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: w * k, height: 400 } });
await page.setContent(html);
await page.waitForTimeout(200);
await page.locator('main').screenshot({ path: out });
await browser.close();
console.log(out);
