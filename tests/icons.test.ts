/**
 * UI icons: src/ui/iconArt.ts matches the SVG files in public/icons/ui, every
 * file uses the shared style (24 x 24, stroke 2, square caps, mitred corners,
 * currentColor), and every "UI icons" row of the asset list has a file.
 */
import { readdirSync, readFileSync } from 'fs';
import { ICON_ART } from '../src/ui/iconArt';
import { iconSvg, iconPaths } from '../src/ui/icons';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}

const dir = new URL('../public/icons/ui/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
const art = ICON_ART as Record<string, string>;
const ROOT = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'square', 'stroke-linejoin': 'miter' };

console.log('UI icons');
test('iconArt.ts lists exactly the SVG files', () => {
  const keys = Object.keys(art).sort();
  const missing = files.filter((f) => !(f in art));
  const extra = keys.filter((k) => !files.includes(k));
  assert(!missing.length && !extra.length, `not generated: ${missing.join(', ')}; generated but no file: ${extra.join(', ')} (run tools/icons/build_icons.py)`);
});
test('generated shapes match the files', () => {
  for (const n of files) {
    const m = readFileSync(dir + n + '.svg', 'utf8').trim().match(/^<svg([^>]*)>([\s\S]*)<\/svg>$/);
    assert(m, `${n}.svg is not one <svg> element`);
    assert(m[2].trim() === art[n], `${n}: iconArt.ts is out of date (run tools/icons/build_icons.py)`);
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    for (const [k, v] of Object.entries(ROOT)) assert(attrs[k] === v, `${n}.svg: ${k}="${attrs[k]}", expected "${v}"`);
    assert(!/\b(stroke|stroke-width|fill|transform|style)=/.test(m[2]), `${n}.svg: children must not restyle the stroke`);
  }
});
test('every UI icons row in the asset list has an SVG', () => {
  const csv = readFileSync(new URL('../docs/ASSETS_NEEDED.csv', import.meta.url), 'utf8').split('\n');
  const ids = csv.filter((l) => l.startsWith('UI icons,')).map((l) => l.split(',')[2]);
  assert(ids.length === 50, `expected 50 rows, found ${ids.length}`);
  const missing = ids.filter((id) => !files.includes(id));
  assert(!missing.length, `no SVG for ${missing.join(', ')}`);
});
test('icons.ts serves the artwork', () => {
  assert(iconPaths('home') === art.home, 'iconPaths');
  const svg = iconSvg('settings', 32);
  assert(svg.includes('width="32"') && svg.includes('stroke-width="2"') && svg.includes(art.settings), 'iconSvg');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
