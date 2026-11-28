/**
 * The shared background budget (src/performance/scheduler.ts): every job shares one budget a frame, the
 * urgent one goes first, a cancelled job never runs again or reports done, a throwing job is dropped, and
 * at least one step runs each frame so nothing starves.
 */
import assert from 'node:assert/strict';
import { addJob, backgroundJobs, clearBackground, runBackground } from '../src/performance/scheduler';

let clock = 0;
const now = () => clock;
/** A job of `n` steps, each costing `cost` ms of the fake clock. */
const job = (name: string, n: number, cost: number, priority: number, log: string[]) => {
  let left = n;
  return {
    priority,
    step: (deadline: number) => {
      do {
        clock += cost;
        left--;
        log.push(name);
      } while (left > 0 && clock < deadline);
      return left === 0;
    },
    done: () => log.push(`${name}:done`),
  };
};

// Two districts share one 3 ms budget: 1 ms steps → three steps between them a frame, not three each.
let log: string[] = [];
addJob(job('a', 5, 1, 1, log));
addJob(job('b', 5, 1, 1, log));
clock = 0;
runBackground(3, now);
assert.equal(log.filter((x) => !x.endsWith(':done')).length, 3, 'one budget for both');
assert.deepEqual(log, ['a', 'a', 'a'], 'the older of two equal jobs goes first');
clearBackground();

// The urgent job goes first even when added last.
log = [];
addJob(job('later', 2, 1, 2, log));
addJob(job('now', 2, 1, 0, log));
clock = 0;
runBackground(10, now);
assert.deepEqual(log, ['now', 'now', 'now:done', 'later', 'later', 'later:done']);
assert.equal(backgroundJobs(), 0);

// A step longer than the whole budget still runs (once) each frame.
log = [];
addJob(job('slow', 3, 50, 1, log));
clock = 0;
runBackground(3, now);
assert.deepEqual(log, ['slow']);
runBackground(3, now);
runBackground(3, now);
assert.deepEqual(log, ['slow', 'slow', 'slow', 'slow:done']);

// Cancelled: no more steps, no done.
log = [];
const h = addJob(job('gone', 5, 1, 1, log));
clock = 0;
runBackground(2, now);
h.cancel();
runBackground(10, now);
assert.deepEqual(log, ['gone', 'gone']);
assert.ok(h.cancelled && !h.finished);

// A job that throws is dropped and the others carry on.
log = [];
const warn = console.warn;
console.warn = () => {};
addJob({ priority: 0, step: () => { throw new Error('boom'); } });
addJob(job('ok', 1, 1, 1, log));
runBackground(10, now);
console.warn = warn;
assert.deepEqual(log, ['ok', 'ok:done']);
assert.equal(backgroundJobs(), 0);

// Nothing to do: nothing happens.
assert.equal(runBackground(3, now), 0);
console.log('scheduler: shared budget, priority, cancel, failures ok');

// A step that runs past its deadline is measured, for the development numbers (performance/perfStats.ts).
{
  const { takeStepStats } = await import('../src/performance/scheduler');
  clearBackground();
  let t = 0;
  const clock = () => t;
  takeStepStats();
  addJob({ priority: 1, step: () => { t += 9; return true; } });
  runBackground(3, clock);
  const s = takeStepStats();
  if (!(s.longestStep >= 9 && s.overrun >= 6)) throw new Error(`step stats ${JSON.stringify(s)}`);
  console.log('  ok   a step that runs past the budget is measured');
}
