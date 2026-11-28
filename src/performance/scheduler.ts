/**
 * One budget per frame for background work (building the district next door, getting a room ready),
 * shared by every job: two districts building at once take the same few milliseconds a frame as one,
 * where each used to run its own loop with its own budget. The renderer runs it once a frame
 * (`runBackground`), after the frame's own work.
 *
 * Jobs are resumable: `step(deadline)` does what it can before the deadline and says whether it's
 * finished. The most urgent job goes first (lower priority number, then oldest); at least one step
 * runs every frame there's work, so nothing starves on a slow device. `cancel()` drops a job before
 * its next step; whoever owns it disposes what it had built.
 */

/** Milliseconds a frame for background work: leaves a phone's 16.7 ms frame room for the frame itself. */
export const BACKGROUND_BUDGET_MS = 3;

export interface BackgroundJob {
  /** Lower first: PRIORITY in requests.ts uses the same scale. */
  priority: number;
  /** Do some work, stopping at `deadline` (performance.now() time). True when there's nothing left. */
  step(deadline: number): boolean;
  /** Called once, when `step` reports it's finished (not after a cancel). */
  done?(): void;
}

export interface JobHandle {
  cancel(): void;
  readonly finished: boolean;
  readonly cancelled: boolean;
}

interface Entry {
  job: BackgroundJob;
  order: number;
  finished: boolean;
  cancelled: boolean;
}

const jobs: Entry[] = [];
let order = 0;

export function addJob(job: BackgroundJob): JobHandle {
  const e: Entry = { job, order: order++, finished: false, cancelled: false };
  jobs.push(e);
  return {
    cancel: () => {
      if (e.finished || e.cancelled) return;
      e.cancelled = true;
      const i = jobs.indexOf(e);
      if (i >= 0) jobs.splice(i, 1);
    },
    get finished() {
      return e.finished;
    },
    get cancelled() {
      return e.cancelled;
    },
  };
}

function next(): Entry | null {
  let best: Entry | null = null;
  for (const e of jobs) if (!best || e.job.priority < best.job.priority || (e.job.priority === best.job.priority && e.order < best.order)) best = e;
  return best;
}

/** Run background jobs for up to `budgetMs` (at least one step if there's any work). Returns how many finished. */
export function runBackground(budgetMs = BACKGROUND_BUDGET_MS, now: () => number = () => performance.now()): number {
  const deadline = now() + budgetMs;
  let finished = 0;
  let first = true;
  while (jobs.length && (first || now() < deadline)) {
    first = false;
    const e = next()!;
    let over = false;
    const t0 = now();
    try {
      over = e.job.step(deadline);
      // How far a step ran past its deadline (a job whose single step is too big for the budget shows here).
      const ran = now() - t0;
      if (ran > longestStep) longestStep = ran;
      overrun = Math.max(overrun, now() - deadline);
    } catch (err) {
      // A job that throws is dropped, not retried every frame.
      console.warn('[background] job failed', err);
      over = true;
      e.cancelled = true;
    }
    if (over) {
      const i = jobs.indexOf(e);
      if (i >= 0) jobs.splice(i, 1);
      if (!e.cancelled) {
        e.finished = true;
        finished++;
        e.job.done?.();
      }
    }
  }
  return finished;
}

let longestStep = 0;
let overrun = 0;

/** The longest single job step and the furthest past a deadline since the last call (ms), then reset. */
export function takeStepStats(): { longestStep: number; overrun: number } {
  const r = { longestStep, overrun };
  longestStep = 0;
  overrun = 0;
  return r;
}

/** Jobs waiting (tests). */
export function backgroundJobs(): number {
  return jobs.length;
}

/** Drop every job (tests; leaving the game). */
export function clearBackground(): void {
  for (const e of jobs) e.cancelled = true;
  jobs.length = 0;
}
