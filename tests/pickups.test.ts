/**
 * Pickup models: every item in the food, groceries, materials, collectibles and quest
 * rows has a model file, keyed by a real Game id, within the small-item budget.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { PICKUP_FILES, PICKUP_IDS, pickupSize } from '../src/render/props/pickupList';
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
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

console.log('Pickup models');

test('every pickup id is a real item', () => {
  for (const id of PICKUP_IDS) assert(ITEMS[id], `${id} is not in items.ts`);
});

test('every pickup has its file, under 60 KB, and nothing extra is in the folder', () => {
  const files = new Set(readdirSync('public/models/pickups').filter((f) => f.endsWith('.glb')));
  for (const id of PICKUP_IDS) {
    const f = PICKUP_FILES[id];
    assert(existsSync(`public/models/pickups/${f}`), `${id}: ${f} is missing`);
    assert(statSync(`public/models/pickups/${f}`).size <= 60 * 1024, `${id}: ${f} is over 60 KB`);
    files.delete(f);
  }
  assert(files.size === 0, `unused files: ${[...files].join(', ')}`);
});

test('the four item areas of the asset sheet are all covered', () => {
  const areas = ['Items: Food & first aid', 'Items: Groceries & materials', 'Items: Collectibles', 'Items: Quest items'];
  const lines = readFileSync('docs/ASSETS_NEEDED.csv', 'utf8').split('\n');
  const want = lines.filter((l) => areas.some((a) => l.startsWith(a + ',') || l.startsWith(`"${a}",`))).map((l) => l.split(',')[2]);
  assert(want.length === 80, `expected 80 rows, found ${want.length}`);
  for (const id of want) assert((PICKUP_IDS as readonly string[]).includes(id), `${id} has no pickup model`);
});

test('sizes: only pickups have one, and bags show bigger than cards', () => {
  assert(pickupSize('not_an_item') === undefined, 'unknown ids have no size');
  assert(pickupSize('bag_holdall')! > pickupSize('bus_pass')!, 'holdall should show bigger than a bus pass');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
