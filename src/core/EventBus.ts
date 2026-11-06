/**
 * Typed publish/subscribe bus. Systems broadcast what happened; anything
 * (HUD, audio, missions, XP) can listen without the sender knowing about it.
 */
export class EventBus<M extends object> {
  private listeners = new Map<keyof M, Set<(payload: never) => void>>();

  on<K extends keyof M>(event: K, fn: (payload: M[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as (payload: never) => void);
    return () => this.off(event, fn);
  }

  off<K extends keyof M>(event: K, fn: (payload: M[K]) => void): void {
    this.listeners.get(event)?.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as (p: M[K]) => void)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
