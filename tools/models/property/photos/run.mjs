// usage: node run.mjs <steps.mjs> [w] [h]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [,, stepsFile, w = '960', h = '540'] = process.argv;
const steps = (await import(stepsFile)).default;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { if (!m.text().includes('GPU stall')) logs.push(`${m.type()}: ${m.text()}`); }; });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto('http://127.0.0.1:5105/?debug=1&shot=estate');
await page.waitForFunction(() => window.__shot && window.__shot.ready, null, { timeout: 120000 });
await page.evaluate(() => { window.sfuk.manualClock = false; });
try { await steps(page); } catch (e) { console.log('STEP ERROR', e.message); }
console.log(logs.join('\n') || 'console clean');
await browser.close();
