/**
 * One limit on network requests for the whole game. Every asset loader asks here before it fetches,
 * so packages loading side by side can't multiply into dozens of parallel downloads (nested queues
 * did: 4 packages × 3 models each), and what the next location needs goes ahead of what can wait.
 *
 * Priorities: lower runs first, ties in the order asked. `bump` moves a waiting request up (a level
 * about to be built needs its models now). Nothing here retries: loaders decide what a failure means.
 */

export const PRIORITY = {
  /** Needed to show the location the player is in or is entering. */
  now: 0,
  /** The next location (a neighbouring street, a door you're standing at). */
  soon: 1,
  /** What every location uses (the street kits, people, animation), wanted before play starts. */
  later: 2,
  /** Models for places you aren't near yet: loaded once nothing more urgent is waiting. */
  background: 3,
} as const;
export type Priority = number;

interface Waiting {
  key: string;
  priority: Priority;
  order: number;
  start: () => void;
}

/** Six at a time: what one HTTP/1.1 host allows, and plenty over HTTP/2 without starving the decoder. */
let limit = 6;
let running = 0;
let order = 0;
const waiting: Waiting[] = [];

function pump(): void {
  while (running < limit && waiting.length) {
    let best = 0;
    for (let i = 1; i < waiting.length; i++) {
      const a = waiting[i], b = waiting[best];
      if (a.priority < b.priority || (a.priority === b.priority && a.order < b.order)) best = i;
    }
    const w = waiting.splice(best, 1)[0];
    running++;
    w.start();
  }
}

/**
 * Run `fn` when a slot is free. `key` names the asset (its URL) so `bump` can find it.
 */
export function request<T>(key: string, fn: () => Promise<T>, priority: Priority = PRIORITY.later): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w: Waiting = {
      key,
      priority,
      order: order++,
      start: () => {
        let p: Promise<T>;
        try { p = fn(); } catch (e) { p = Promise.reject(e); }
        p.then(resolve, reject).finally(() => {
          running--;
          pump();
        });
      },
    };
    waiting.push(w);
    pump();
  });
}

/** Move a waiting request up to `priority` (no effect once it has started or if it's already higher). */
export function bump(key: string, priority: Priority): void {
  for (const w of waiting) if (w.key === key && w.priority > priority) w.priority = priority;
}

/** Tests and the loader: how busy it is. */
export function requestStats(): { running: number; waiting: number; limit: number } {
  return { running, waiting: waiting.length, limit };
}

/** Change the limit (tests; a shot page loads everything as fast as it can). */
export function setRequestLimit(n: number): void {
  limit = Math.max(1, Math.floor(n) || 1);
  pump();
}

/** Reject after `ms` so one stuck download can't hold up everything waiting on it. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
