/**
 * Every recorded sound set the AudioManager plays has its takes in public/audio, and every music track it can
 * ask for is there. A missing file would fall back to synthesis silently, so a lost recording would never be seen.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';

let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}
function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg);
}

const src = readFileSync('src/audio/AudioManager.ts', 'utf8');
const files = readdirSync('public/audio');
console.log('Audio files');

test('every recorded sound set has at least one take, numbered from 0 with no gaps', () => {
  const m = src.match(/type SoundSet =([^;]+);/);
  assert(m, 'SoundSet type not found');
  const sets = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert(sets.length > 10, `only ${sets.length} sets`);
  for (const set of sets) {
    const takes = files.filter((f) => new RegExp(`^${set}_\\d+\\.mp3$`).test(f)).map((f) => Number(f.slice(set.length + 1, -4))).sort((a, b) => a - b);
    assert(takes.length > 0, `no recording for ${set}`);
    takes.forEach((n, i) => assert(n === i, `${set}: take ${i} missing`));
  }
});

test('the menu, street and boss music are all there', () => {
  for (const id of ['menu', 'street', 'boss']) assert(existsSync(`public/audio/music_${id}.mp3`), `music_${id}.mp3 missing`);
});

test('every recording is credited or made by our own tools', () => {
  assert(existsSync('public/audio/CREDITS.md'), 'public/audio/CREDITS.md missing');
});

console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exit(1);
