import assert from 'node:assert/strict';
import { loadAssetQueue } from '../src/performance/AssetQueue';

let active = 0;
let peak = 0;
let finished = 0;
const queue = loadAssetQueue(Array.from({ length: 12 }, (_, i) => async () => {
  active++;
  peak = Math.max(peak, active);
  try {
    await new Promise<void>(resolve => setTimeout(resolve, 1));
    if (i === 3) throw new Error('Expected test failure');
  } finally { active--; finished++; }
}), 3);
await queue.ready;
assert.equal(peak, 3);
assert.equal(finished, 12);
assert.equal(queue.progress(), 1);
const empty = loadAssetQueue([], 2);
await empty.ready;
assert.equal(empty.progress(), 1);
console.log('Asset queue regression tests passed');
