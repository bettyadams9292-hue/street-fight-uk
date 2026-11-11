/**
 * Asset pipeline tests: the store that loads the manifest's files must always
 * settle, report honestly, and fall back to the built-in version of anything
 * that fails, is slow, or is switched off.
 */
import { AssetStore, assetOptionsFromQuery, type LoadProgress } from '../src/assets/AssetStore';
import { ASSETS, ASSET_BY_ID, type AssetEntry } from '../src/assets/manifest';
import { existsSync, statSync } from 'node:fs';
import { SHOT_NAMES } from '../src/debug/shotList';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
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

const entry = (id: string, bytes: number, group = 'boot'): AssetEntry => ({ id, kind: 'model', url: `/x/${id}.glb`, bytes, group, fallback: `built-in ${id}`, source: 'test' });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log('Asset pipeline');

await test('the manifest matches the files in public/', () => {
  const ids = new Set<string>();
  for (const a of ASSETS) {
    assert(!ids.has(a.id), `${a.id} is listed twice`);
    ids.add(a.id);
    assert(ASSET_BY_ID[a.id] === a, `${a.id} is missing from the lookup`);
    assert(a.fallback.length > 0, `${a.id} has no fallback`);
    const path = `public${a.url}`;
    assert(existsSync(path), `${a.id}: ${path} does not exist`);
    assert(statSync(path).size === a.bytes, `${a.id}: manifest says ${a.bytes} bytes, the file is ${statSync(path).size}`);
  }
});

await test('a loaded asset is ready and returned', async () => {
  const s = new AssetStore({ entries: [entry('a', 100)] });
  s.register('model', async (e) => ({ from: e.url }));
  assert(s.status('a') === 'idle' && s.get('a') === null, 'not idle before loading');
  await s.loadOne('a');
  assert(s.status('a') === 'ready', `status is ${s.status('a')}`);
  assert(s.get<{ from: string }>('a')?.from === '/x/a.glb', 'wrong value');
  assert(!s.report()[0].usingFallback, 'reported as using the fallback');
});

await test('a file is only fetched once, however often it is asked for', async () => {
  let calls = 0;
  const s = new AssetStore({ entries: [entry('a', 100)] });
  s.register('model', async () => ++calls);
  await Promise.all([s.loadOne('a'), s.loadOne('a'), s.load(['a'])]);
  assert(calls === 1, `loader ran ${calls} times`);
});

await test('a failed load never throws and falls back', async () => {
  const s = new AssetStore({ entries: [entry('a', 100), entry('b', 100)] });
  s.register('model', async (e) => {
    if (e.id === 'a') throw new Error('404');
    return null;
  });
  await s.load(['a', 'b']);
  assert(s.status('a') === 'failed' && s.status('b') === 'failed', 'not marked failed');
  assert(s.get('a') === null && s.get('b') === null, 'returned something for a failed asset');
  const r = s.report();
  assert(r.every((x) => x.usingFallback), 'fallback not reported');
  assert(r.find((x) => x.id === 'a')?.error === '404', 'error message lost');
});

await test('a slow file times out; arriving late changes nothing', async () => {
  const s = new AssetStore({ entries: [entry('slow', 100)], timeoutMs: 20 });
  s.register('model', async () => {
    await wait(80);
    return 'late';
  });
  await s.loadOne('slow');
  assert(s.status('slow') === 'timeout', `status is ${s.status('slow')}`);
  await wait(90);
  assert(s.status('slow') === 'timeout' && s.get('slow') === null, 'a late file replaced the fallback');
});

await test('assets can be switched off, all or one at a time', async () => {
  let calls = 0;
  const all = new AssetStore({ entries: [entry('a', 1), entry('b', 1)], builtinOnly: true });
  all.register('model', async () => ++calls);
  await all.load(['a', 'b']);
  assert(calls === 0 && all.status('a') === 'off' && all.status('b') === 'off', 'builtinOnly still loaded something');
  const one = new AssetStore({ entries: [entry('a', 1), entry('b', 1)], off: ['a'] });
  one.register('model', async () => ++calls);
  await one.load(['a', 'b']);
  assert(one.status('a') === 'off' && one.status('b') === 'ready', 'single switch-off wrong');
});

await test('unknown ids and missing loaders fail cleanly', async () => {
  const s = new AssetStore({ entries: [entry('a', 1)] });
  await s.load(['a', 'nope']);
  assert(s.status('a') === 'failed' && s.status('nope') === 'failed', 'should both fail');
});

await test('progress is weighted by size and ends at 1', async () => {
  const s = new AssetStore({ entries: [entry('small', 100), entry('big', 900)] });
  s.register('model', async (e) => {
    await wait(e.id === 'small' ? 5 : 30);
    return e.id;
  });
  const seen: LoadProgress[] = [];
  await s.load(['small', 'big'], (p) => seen.push({ ...p }));
  assert(seen.length >= 2, 'no progress reported');
  const afterSmall = seen.find((p) => p.last?.id === 'small');
  assert(afterSmall && Math.abs(afterSmall.fraction - 0.1) < 1e-9, `small file should be 10%, got ${afterSmall?.fraction}`);
  const end = seen[seen.length - 1];
  assert(end.fraction === 1 && end.done === 2 && end.total === 2, 'did not finish at 100%');
  for (let i = 1; i < seen.length; i++) assert(seen[i].fraction >= seen[i - 1].fraction, 'progress went backwards');
});

await test('groups load together', async () => {
  const s = new AssetStore({ entries: [entry('a', 1, 'boot'), entry('b', 1, 'city'), entry('c', 1, 'boot')] });
  s.register('model', async (e) => e.id);
  await s.loadGroup('boot');
  assert(s.status('a') === 'ready' && s.status('c') === 'ready' && s.status('b') === 'idle', 'wrong group loaded');
});

await test('the address bar switches are read correctly', () => {
  assert(assetOptionsFromQuery('?assets=builtin').builtinOnly === true, '?assets=builtin');
  assert(assetOptionsFromQuery('?classic').builtinOnly === true, '?classic');
  const off = assetOptionsFromQuery('?assets=-character_male,-x').off ?? [];
  assert(off.length === 2 && off[0] === 'character_male' && off[1] === 'x', `?assets=-a,-b gave ${off}`);
  const none = assetOptionsFromQuery('');
  assert(!none.builtinOnly && !(none.off ?? []).length, 'plain address switched something off');
});

await test('every shot scene has a unique, file-safe name', () => {
  assert(new Set(SHOT_NAMES).size === SHOT_NAMES.length, 'duplicate shot name');
  for (const n of SHOT_NAMES) assert(/^[a-z0-9_]+$/.test(n), `${n} is not file-safe`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
