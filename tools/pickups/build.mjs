/**
 * Builds the pickup models (tools/pickups/models.mjs) in headless Chrome and writes
 * public/models/pickups/<id>.glb.
 *
 *   node tools/pickups/build.mjs <three dir> <Kenney Food Kit "GLB format" dir> <out dir> [sheet.png] [ids...]
 *
 * three: a three.js package folder (e.g. node_modules/three). Kenney Food Kit: CC0, kenney.nl.
 * Playwright is loaded from PLAYWRIGHT (default /opt/npm-tools/node_modules/playwright/index.mjs).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [threeDir, kenneyDir, outDir, sheetPng, ...only] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT ?? '/opt/npm-tools/node_modules/playwright/index.mjs');

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.html': 'text/html' };
const page0 = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><body></body>`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = null;
  if (u === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(page0);
  if (u === '/models.mjs') file = path.join(here, 'models.mjs');
  else if (u.startsWith('/three/')) file = path.join(threeDir, u.slice(7));
  else if (u.startsWith('/kenney/')) file = path.join(kenneyDir, u.slice(8));
  if (!file || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('response', (r) => r.status() >= 400 && console.log('[404]', r.url()));
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/`);
const ids = only.length ? only : await page.evaluate(async () => (await import('/models.mjs')).IDS);
fs.mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const b64 = await page.evaluate(async (id) => (await import('/models.mjs')).exportGlb(id), id);
  fs.writeFileSync(path.join(outDir, `${id.replace(/_/g, '-')}.glb`), Buffer.from(b64, 'base64'));
}
console.log(`wrote ${ids.length} models to ${outDir}`);
if (sheetPng) {
  const url = await page.evaluate(async (ids) => (await import('/models.mjs')).sheet(ids), ids);
  fs.writeFileSync(sheetPng, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`sheet: ${sheetPng}`);
}
await browser.close();
server.close();
