/**
 * The property kit: every model the library loads is in public/models/property, every
 * property has its listing photo, the board artwork is there, and the big rooms get their
 * fittings when an interior is built.
 */
import { existsSync, readFileSync } from 'fs';
import { PROPERTY_LIST } from '../src/realty/catalogue';
import { buildPropertyInterior } from '../src/realty/world';
import { PROP_SIZE, type PropKind } from '../src/world/LevelTypes';

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
const pub = (p: string) => new URL(`../public/${p}`, import.meta.url).pathname;
// The library imports three.js, so its lists are read from the source here.
const lib = readFileSync(new URL('../src/render/props/PropertyLibrary.ts', import.meta.url), 'utf8');
const list = (name: string): string[] => {
  const m = lib.match(new RegExp(`${name}[^=]*=[^\\[]*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`no ${name} in PropertyLibrary.ts`);
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};
const PROPERTY_MODELS = list('PROPERTY_MODELS');
const PROPERTY_PROP_KINDS = list('PROPERTY_PROP_KINDS');

console.log('Property kit');
test('the lists read from the library', () => {
  assert(PROPERTY_MODELS.length === 24 && PROPERTY_PROP_KINDS.length === 16, `${PROPERTY_MODELS.length} models, ${PROPERTY_PROP_KINDS.length} kinds`);
});
test('every model file exists', () => {
  for (const id of PROPERTY_MODELS) assert(existsSync(pub(`models/property/${id}.glb`)), `missing models/property/${id}.glb`);
});
test('every kit prop kind has a size', () => {
  for (const k of PROPERTY_PROP_KINDS) assert(PROP_SIZE[k as PropKind], `no PROP_SIZE for ${k}`);
});
test('every property has a listing photo', () => {
  for (const p of PROPERTY_LIST) assert(existsSync(pub(`art/property/${p.id}.webp`)), `missing art/property/${p.id}.webp`);
});
test('board artwork exists', () => {
  for (const f of ['board_for_sale', 'board_to_let', 'board_sold', 'board_let_by', 'window_header']) assert(existsSync(pub(`art/agent/${f}.webp`)), `missing ${f}`);
});
test('big rooms get their fittings', () => {
  const want: Record<string, PropKind[]> = {
    pool: ['pool_basin', 'pool_lounger'],
    cinema: ['cinema_screen', 'projector', 'cinema_seats'],
    conservatory: ['conservatory_glazing'],
    terrace: ['terrace_deck', 'terrace_balustrade', 'terrace_sofa'],
    dressing: ['wardrobe_wall', 'dressing_island'],
  };
  for (const [room, kinds] of Object.entries(want)) {
    const p = PROPERTY_LIST.find((q) => q.rooms.includes(room as never));
    assert(p, `no property has a ${room}`);
    const lvl = buildPropertyInterior(p, 'viewing', false, '£1');
    for (const k of kinds) assert(lvl.props.some((q) => q.kind === k), `${p.id}: no ${k} in the ${room}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
