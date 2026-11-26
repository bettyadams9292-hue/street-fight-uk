/**
 * The high street's brand book (city/brands.ts): every named business has its own look and window, independents of
 * one kind don't all match, and every see-into shop on the streets is dressed (posters, vinyl) in its own brand.
 */
import assert from 'node:assert/strict';
import { BRANDS, brandFor, brandName, ownBrand } from '../src/city/brands';
import { kitStreet, planStreet } from '../src/city/street';
import { LEVELS } from '../src/world/levels';

let passed = 0;
let failed = 0;
const ok = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
};

console.log('Brands');
ok('every named business has a tagline and window posters', () => {
  for (const [name, b] of Object.entries(BRANDS)) {
    assert(b.tagline, `${name} tagline`);
    assert(b.posters.length >= 2, `${name} posters`);
  }
});
ok('a sign with a tagline after the name is the same brand', () => {
  assert.equal(brandName('B&THC — HYDROPONICS · LIGHTING · VENTILATION'), 'B&THC');
  assert(ownBrand('H. STERLING — FINE JEWELLERS SINCE 1962'));
});
ok('two independents of one kind look different', () => {
  const a = brandFor('CITY BOOKIES', 'bookies');
  const b = brandFor('LUCKY BOOKIES', 'bookies');
  assert(a.bg !== b.bg || a.face !== b.face || a.posters[0] !== b.posters[0]);
});
ok('every see-into shop on the streets is dressed in its own brand', () => {
  let shops = 0;
  for (const l of Object.values(LEVELS)) {
    if (!kitStreet(l)) continue;
    const plan = planStreet(l);
    for (const s of plan.shopfronts) {
      if (s.kind === 'office' || s.kind === 'casino' || s.kind === 'club') continue;
      shops++;
      const mine = plan.decals.filter((d) => d.x >= s.x0 && d.x <= s.x1);
      assert(mine.some((d) => d.art === 'poster'), `${l.id}: ${s.label} has posters`);
      assert(mine.some((d) => d.art === 'vinyl'), `${l.id}: ${s.label} has window vinyl`);
      assert(new Set(mine.map((d) => d.brand)).size === 1, `${l.id}: ${s.label} is one brand`);
    }
  }
  assert(shops > 20, `shops checked: ${shops}`);
});

console.log(`\nbrands: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
