/**
 * The texture library: every catalogued set is on disk, every family names real sets, and the
 * rules that decide what a surface is made of give sensible answers.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { LIBRARY, type LibraryName } from '../src/render/materials/catalogue';
import * as A from '../src/render/materials/assign';
import { nearest } from '../src/render/materials/library';

let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const DIR = 'public/textures/lib';
const names = Object.keys(LIBRARY) as LibraryName[];

console.log('Texture library');

test('every catalogued set has its three files, and there are no strays', () => {
  for (const n of names) for (const s of ['_c', '_n', '_orm']) assert(existsSync(`${DIR}/${n}${s}.webp`), `missing ${n}${s}.webp`);
  const want = new Set(names.flatMap((n) => [`${n}_c.webp`, `${n}_n.webp`, `${n}_orm.webp`]));
  const stray = readdirSync(DIR).filter((f) => !want.has(f));
  assert(stray.length === 0, `not in the catalogue: ${stray.join(', ')}`);
});

test('the library stays small enough to ship (each file under 200 KB, under 12 MB in all)', () => {
  let total = 0;
  for (const f of readdirSync(DIR)) {
    const size = statSync(`${DIR}/${f}`).size;
    total += size;
    assert(size < 200_000, `${f} is ${Math.round(size / 1024)} KB`);
  }
  assert(total < 12_000_000, `${(total / 1e6).toFixed(1)} MB`);
});

test('every family and every place floor names sets that exist', () => {
  const lists: [string, readonly string[]][] = [
    ['WOODS', A.WOODS], ['ROUGH_WOODS', A.ROUGH_WOODS], ['WOOD_FLOORS', A.WOOD_FLOORS], ['BRICKS', A.BRICKS], ['STONE_WALLS', A.STONE_WALLS], ['CONCRETES', A.CONCRETES],
    ['STEELS', A.STEELS], ['BRASSES', A.BRASSES], ['RUSTY', A.RUSTY], ['CLOTHS', A.CLOTHS], ['LEATHERS', A.LEATHERS], ['FLOOR_TILES', A.FLOOR_TILES], ['WALL_TILES', A.WALL_TILES],
    ...Object.entries(A.PLACE_FLOORS).map(([k, v]): [string, readonly string[]] => [`PLACE_FLOORS.${k}`, v]),
  ];
  for (const [label, list] of lists) for (const n of list) assert(n in LIBRARY, `${label}: ${n} is not in the library`);
});

test('what a thing is made of follows from what it is', () => {
  const g = (colour: string, rough: number, metal: number, kind: string) => A.guess(colour, rough, metal, kind, 1)?.set ?? null;
  assert(g('#f4f2ee', 0.2, 0, 'toilet') === 'Porcelain001', `toilet: ${g('#f4f2ee', 0.2, 0, 'toilet')}`);
  assert(g('#1a1a1c', 0.2, 0, 'bath') === 'Porcelain003', 'a black bath is black porcelain');
  assert(LIBRARY[g('#7a5230', 0.7, 0, 'table')!].category === 'wood', 'a brown table is wood');
  assert(A.ROUGH_WOODS.includes(g('#7a5230', 0.9, 0, 'pallets')!), 'pallets are rough timber');
  assert(A.STEELS.includes(g('#8a8e94', 0.4, 0.8, 'shelves')!), 'grey metal shelving is steel');
  assert(A.RUSTY.includes(g('#6a7078', 0.6, 0.6, 'skip')!), 'a skip is weathered metal');
  assert(A.BRASSES.includes(g('#c9a227', 0.2, 0.9, 'bar')!), 'gold-coloured metal is brass or gold');
  assert(A.CLOTHS.includes(g('#3a5a8a', 0.9, 0, 'sofa')!), 'a blue sofa is cloth');
  assert(g('#8a8a88', 0.9, 0, '')?.startsWith('Concrete'), 'matt grey is concrete');
});

test('things that are paint, glow or screens are left alone', () => {
  assert(A.guess('#c02020', 0.4, 0.6, 'car', 1) === null, 'car paint');
  assert(A.guess('#101012', 0.5, 0, 'tv', 1) === null, 'a TV');
  assert(A.guess('#c03030', 0.9, 0, '', 1) === null, 'a plain red painted surface');
  assert(A.guess('#050506', 1, 0, 'tyre_stack', 1) === null, 'black rubber');
});

test('nearest picks the set closest in tone, and the same one for the same seed', () => {
  assert(nearest(A.WOODS, '#3a2414', 0, 1) !== nearest(A.WOODS, '#d8c0a0', 0, 1), 'dark and pale wood got the same set');
  assert(nearest(A.WOODS, '#8a6a4a', 5, 3) === nearest(A.WOODS, '#8a6a4a', 5, 3), 'not repeatable');
});

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
