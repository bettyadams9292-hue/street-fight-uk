/**
 * Texture files: every file src/render/textureFiles.ts asks for is in public/textures (with its
 * normal map), small enough, and every home finish in the catalogue has one.
 */
import { existsSync, statSync } from 'fs';
import { TEXTURE_NAMES, hasNormal } from '../src/render/textureList';
import { FINISH_LIST } from '../src/property/catalogue';

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

const file = (n: string) => `public/textures/${n}.webp`;

test('every texture file exists, with its normal map', () => {
  for (const n of TEXTURE_NAMES) {
    assert(existsSync(file(n)), `missing ${file(n)}`);
    if (hasNormal(n)) assert(existsSync(file(`${n}_n`)), `missing ${file(`${n}_n`)}`);
  }
});

test('texture files are small (under 200 KB each)', () => {
  for (const n of TEXTURE_NAMES) for (const f of [n, `${n}_n`]) if (existsSync(file(f))) assert(statSync(file(f)).size < 200 * 1024, `${f} is too big`);
});

test('every home finish has a texture file', () => {
  for (const f of FINISH_LIST) assert((TEXTURE_NAMES as readonly string[]).includes(`home/${f.id}`), `no texture for ${f.id}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
