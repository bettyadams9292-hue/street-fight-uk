export type AssetTask = () => Promise<unknown>;

/** Limit concurrent asset packages; a failed package must not block the queue. */
export function loadAssetQueue(tasks: readonly AssetTask[], concurrency: number) {
  let next = 0;
  let settled = 0;
  const limit = Math.max(1, Math.min(tasks.length, Math.floor(concurrency) || 1));
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const task = tasks[next++];
      try { await task(); }
      catch (error) { console.warn('Asset package failed to load', error); }
      finally { settled++; }
    }
  };
  const ready = Promise.all(Array.from({ length: limit }, () => worker()));
  return { ready, progress: () => tasks.length ? settled / tasks.length : 1 };
}
