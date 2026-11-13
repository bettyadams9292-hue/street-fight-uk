/**
 * Low-poly furniture: every kit model the game asks for exists, so nothing
 * quietly falls back to its boxy built-in version. (Reads the sources and the
 * asset files directly: these modules need three.js, which tests don't load.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { FURNITURE } from '../src/property/catalogue';

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

console.log('Furniture');

const home = readFileSync('src/render/props/homeFurniture.ts', 'utf8');
const kenney = readFileSync('src/render/props/KenneyLibrary.ts', 'utf8');
const kenneyList = kenney.slice(kenney.indexOf('export const FURNITURE'), kenney.indexOf('] as const;'));

test('every piece of furniture you can buy that has a kit model is a real catalogue item, with its model loaded and on disk', () => {
  const rows = [...home.matchAll(/^\s+([a-z0-9_]+): \{ k: '([A-Za-z0-9]+)', colour: '(fabric|wood|none)'/gm)];
  assert(rows.length >= 30, `only ${rows.length} pieces mapped`);
  for (const [, id, model, colour] of rows) {
    const def = FURNITURE[id];
    assert(def, `${id} isn't in the catalogue`);
    assert(kenneyList.includes(`'${model}'`), `${id}: ${model} isn't in the Kenney loader's list`);
    assert(existsSync(`public/models/kenney/furniture/${model}.glb`), `${id}: ${model}.glb is missing`);
    // Your colour choice has to show somewhere: fabric for soft things, a finish for wood.
    if (colour === 'none') assert(def.colours.length <= 2 || /lamp|plant|fridge|washer|tv|light|cabinet/.test(id), `${id} offers ${def.colours.length} colours but the model ignores them`);
  }
});

test('every street-kit piece used inside rooms exists in the kit', () => {
  const kit = JSON.parse(readFileSync('public/models/polyfork/kit.json', 'utf8')).models as Record<string, unknown>;
  const view = readFileSync('src/render/LevelView.ts', 'utf8');
  const ids = new Set([...view.matchAll(/(?:piece\(g, |hasKitPiece\()'([a-z]+\/[a-z0-9-]+)'/g)].map((m) => m[1]));
  assert(ids.size >= 7, `only ${ids.size} kit pieces used in rooms`);
  for (const id of ids) assert(kit[id], `${id} isn't in the Polyfork kit`);
});

test('the Kenney furniture files are all CC0 and credited', () => {
  const lic = readFileSync('public/models/kenney/LICENSE-furniture.txt', 'utf8');
  assert(/CC0|Creative Commons Zero|public domain/i.test(lic), 'licence file does not say CC0');
  for (const m of kenneyList.matchAll(/'([A-Za-z0-9]+)'/g)) assert(existsSync(`public/models/kenney/furniture/${m[1]}.glb`), `${m[1]}.glb is listed but missing`);
});

const gymLib = readFileSync('src/render/props/GymLibrary.ts', 'utf8');
const gymList = gymLib.slice(gymLib.indexOf('export const GYM_MODELS'), gymLib.indexOf('] as const;', gymLib.indexOf('export const GYM_MODELS')));
const gymIds = [...gymList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

test('every gym model is on disk', () => {
  assert(gymIds.length >= 14, `only ${gymIds.length} gym models listed`);
  for (const id of gymIds) assert(existsSync(`public/models/gym/${id}.glb`), `${id}.glb is missing`);
});

test('every gym prop placed in a room names a real gym model', () => {
  const rooms = readFileSync('src/world/interiors.ts', 'utf8');
  const used = [...rooms.matchAll(/GYM\('([a-z_]+)'/g)].map((m) => m[1]);
  assert(used.length >= 5, `only ${used.length} gym props placed`);
  for (const id of used) assert(gymIds.includes(id), `${id} isn't a gym model`);
});

test('the gym pack is credited (CC BY 4.0)', () => {
  const c = readFileSync('public/models/gym/CREDITS.md', 'utf8');
  assert(/Matrixxy/.test(c) && /CC BY 4\.0/.test(c), 'gym credits missing the author or licence');
});

test('every shop fitting model is on disk and used by the room builder', () => {
  const lib = readFileSync('src/render/props/ShopLibrary.ts', 'utf8');
  const list = lib.slice(lib.indexOf('export const SHOP_MODELS'), lib.indexOf('] as const;'));
  const ids = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert(ids.length >= 13, `only ${ids.length} shop models listed`);
  const view = readFileSync('src/render/LevelView.ts', 'utf8');
  for (const id of ids) {
    assert(existsSync(`public/models/shop/${id}.glb`), `${id}.glb is missing`);
    assert(view.includes(`'${id}'`), `${id} is never placed`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
