/** Cooperative work limits, not a profiler or a guarantee of execution time. */
export const DISTRICT_BUILD_BUDGET_MS = 3;
export const BACKGROUND_POSE_INTERVAL = 1 / 30;
export const BACKGROUND_POSE_DISTANCE = 12;

/** Drain resumable work until the deadline, always allowing at least one step. */
export function advanceWork<T>(steps: Generator<void, T, unknown>, budgetMs: number, now: () => number = () => performance.now()): IteratorResult<void, T> {
  const deadline = now() + budgetMs;
  let result = steps.next();
  while (!result.done && now() < deadline) result = steps.next();
  return result;
}
