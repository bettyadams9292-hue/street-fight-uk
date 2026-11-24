/**
 * The one request limit (src/performance/requests.ts): never more than the limit at once however many
 * loaders ask, urgent requests ahead of background ones, `bump` moving a waiting one up, failures
 * freeing their slot, and timeouts that settle.
 */
import assert from 'node:assert/strict';
import { PRIORITY, bump, request, requestStats, setRequestLimit, withTimeout } from '../src/performance/requests';

const tick = () => new Promise<void>((r) => setTimeout(r, 2));
setRequestLimit(2);

// Never more than the limit, across separate callers (the old nested queues multiplied).
let active = 0, peak = 0;
const job = async () => { active++; peak = Math.max(peak, active); await tick(); active--; };
await Promise.all(Array.from({ length: 10 }, (_, i) => request(`a${i}`, job, i % 2 ? PRIORITY.background : PRIORITY.later)));
assert.equal(peak, 2, 'at most the limit at once');
assert.deepEqual(requestStats(), { running: 0, waiting: 0, limit: 2 });

// Priority: with the slots busy, the urgent request queued last runs before the background ones.
const order: string[] = [];
const gate: (() => void)[] = [];
const blocker = (n: string) => request(n, () => new Promise<void>((r) => gate.push(() => { order.push(n); r(); })), PRIORITY.now);
const b1 = blocker('b1'), b2 = blocker('b2');
const mk = (n: string, p: number) => request(n, async () => { order.push(n); }, p);
const bg = mk('bg', PRIORITY.background);
const later = mk('later', PRIORITY.later);
const now = mk('now', PRIORITY.now);
const bumped = mk('bumped', PRIORITY.background);
bump('bumped', PRIORITY.soon);
await tick();
assert.equal(requestStats().waiting, 4);
gate.forEach((g) => g());
await Promise.all([b1, b2, bg, later, now, bumped]);
assert.deepEqual(order, ['b1', 'b2', 'now', 'bumped', 'later', 'bg'], 'urgent first, bumped ahead of background');

// A failure frees its slot and rejects only its own caller.
const failed = await request('bad', async () => { throw new Error('nope'); }).then(() => 'ok', () => 'rejected');
assert.equal(failed, 'rejected');
const thrown = await request('throws', () => { throw new Error('sync'); }).then(() => 'ok', () => 'rejected');
assert.equal(thrown, 'rejected');
assert.equal(requestStats().running, 0, 'slots freed after failures');

// Timeouts settle a request that never would.
const stuck = await withTimeout(new Promise(() => {}), 5, 'stuck').then(() => 'ok', (e: Error) => e.message);
assert.match(String(stuck), /timed out/);
assert.equal(await withTimeout(Promise.resolve(7), 50, 'quick'), 7);

console.log('requests: limit, priority, bump, failures and timeouts ok');
