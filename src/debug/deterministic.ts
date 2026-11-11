/**
 * Makes a run repeatable for the visual tests: the same random numbers, the
 * same clock, and a throwaway save. Only ever called for `?shot=` pages.
 */
let state = 0;

/** Restart the random sequence. Called again just before a scene is built, so loading order can't shift it. */
export function reseed(seed = 0x5f0c1): void {
  state = seed >>> 0;
}

export function makeDeterministic(): void {
  reseed();
  // mulberry32
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const fixed = 1_760_000_000_000;
  Date.now = () => fixed;
  performance.now = () => 0;

  // A shot page must never read or change a real save: storage becomes a blank in-memory one.
  const mem = new Map<string, string>();
  const proto = Storage.prototype;
  proto.getItem = (k: string) => (mem.has(k) ? (mem.get(k) as string) : null);
  proto.setItem = (k: string, v: string) => void mem.set(k, String(v));
  proto.removeItem = (k: string) => void mem.delete(k);
  proto.clear = () => mem.clear();
  proto.key = (i: number) => [...mem.keys()][i] ?? null;
}
