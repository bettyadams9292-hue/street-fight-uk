/**
 * Rendered item icons (tools/icons/render_items.mjs): every weapon and pickup row has its
 * own icon in public/icons/items, each a small 128 px WebP, and the list the game reads
 * (src/ui/itemIconList.ts) matches the folder.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { RENDERED_ICON_IDS } from '../src/ui/itemIconList';
import { PICKUP_IDS } from '../src/render/props/pickupList';
import { ITEMS } from '../src/items/items';

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

const dir = new URL('../public/icons/items/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();
const weaponIds = Object.values(ITEMS).filter((d) => d.weapon).map((d) => d.id);
const rows = [...weaponIds, ...PICKUP_IDS];

console.log('Rendered item icons');
test('every weapon and pickup row has an icon file', () => {
  const missing = rows.filter((id) => !files.includes(id));
  assert(missing.length === 0, `no icon for: ${missing.join(', ')}`);
});
test('the list matches the folder', () => {
  const listed = [...RENDERED_ICON_IDS].sort();
  assert(JSON.stringify(listed) === JSON.stringify(files), `list ${listed.length} vs folder ${files.length}; run node tools/icons/render_items.mjs`);
});
test('every icon is a real item', () => {
  const unknown = files.filter((id) => !ITEMS[id]);
  assert(unknown.length === 0, `not items: ${unknown.join(', ')}`);
});
test('every icon is a 128 px WebP under 15 KB', () => {
  for (const id of files) {
    const path = dir + id + '.webp';
    const size = statSync(path).size;
    assert(size < 15 * 1024, `${id}.webp is ${size} bytes`);
    const b = readFileSync(path);
    assert(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP', `${id}.webp is not WebP`);
    // VP8L (lossless) or VP8X/VP8 header: read the canvas size.
    const kind = b.toString('ascii', 12, 16);
    let w = 0;
    let h = 0;
    if (kind === 'VP8X') {
      w = 1 + b.readUIntLE(24, 3);
      h = 1 + b.readUIntLE(27, 3);
    } else if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      w = (bits & 0x3fff) + 1;
      h = ((bits >> 14) & 0x3fff) + 1;
    } else if (kind === 'VP8 ') {
      w = b.readUInt16LE(26) & 0x3fff;
      h = b.readUInt16LE(28) & 0x3fff;
    }
    assert(w === 128 && h === 128, `${id}.webp is ${w}x${h}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
