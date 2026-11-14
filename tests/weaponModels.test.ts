/**
 * Weapon models: every weapon in the game has a low-poly GLB in public/models/weapons,
 * listed in PropLibrary's WEAPON_FILES, within the style guide's weapon budget, and
 * made for the weapon's length (the scene's extras.length).
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { WEAPON_IDS, WEAPONS } from '../src/combat/Weapons';

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
function assert(ok: boolean, msg: string): void {
  if (!ok) throw new Error(msg);
}

const DIR = 'public/models/weapons/';

// Read from the source (importing PropLibrary would pull in three.js).
const lib = readFileSync('src/render/props/PropLibrary.ts', 'utf8');
const block = lib.slice(lib.indexOf('export const WEAPON_FILES'));
const WEAPON_FILES: Record<string, string> = Object.fromEntries(
  [...block.slice(0, block.indexOf('};')).matchAll(/^\s+([a-z_]+): '([a-z-]+\.glb)',$/gm)].map((m) => [m[1], m[2]]),
);

function glb(file: string): { json: { scenes: { extras?: { length?: number } }[]; meshes: { primitives: { indices: number }[] }[]; accessors: { count: number }[]; images?: unknown[] }; bytes: number } {
  const b = readFileSync(DIR + file);
  assert(b.readUInt32LE(0) === 0x46546c67, `${file} is not a GLB`);
  const n = b.readUInt32LE(12);
  return { json: JSON.parse(b.subarray(20, 20 + n).toString('utf8')), bytes: b.length };
}

test('every weapon has a model file listed', () => {
  for (const id of WEAPON_IDS) {
    const f = WEAPON_FILES[id];
    assert(!!f, `${id} has no entry in WEAPON_FILES`);
    assert(existsSync(DIR + f), `${DIR}${f} is missing`);
  }
});

test('no stray files and no unknown weapons', () => {
  const listed = new Set(Object.values(WEAPON_FILES));
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.glb'))) assert(listed.has(f), `${f} is not in WEAPON_FILES`);
  for (const id of Object.keys(WEAPON_FILES)) assert((WEAPON_IDS as readonly string[]).includes(id), `${id} is not a weapon`);
});

test('within the weapon budget and made for the weapon length', () => {
  for (const id of WEAPON_IDS) {
    const { json, bytes } = glb(WEAPON_FILES[id]);
    const tris = json.meshes.flatMap((m) => m.primitives).reduce((s, p) => s + json.accessors[p.indices].count / 3, 0);
    assert(tris <= 1200, `${id}: ${tris} triangles`);
    assert(bytes <= 80 * 1024, `${id}: ${bytes} bytes`);
    assert(!json.images?.length, `${id} has textures`);
    assert(json.scenes[0].extras?.length === WEAPONS[id].length, `${id}: extras.length ${json.scenes[0].extras?.length} vs ${WEAPONS[id].length}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
