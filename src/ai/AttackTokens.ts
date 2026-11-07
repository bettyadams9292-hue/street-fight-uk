import type { Fighter } from '../fighter/Fighter';

/**
 * Beat-'em-up staple: only a couple of enemies may attack the same target at
 * once. The rest circle, wait and taunt, which keeps group fights fair and
 * readable.
 */
export class AttackTokens {
  private holders = new Map<number, Set<Fighter>>();

  constructor(public maxPerTarget = 2) {}

  /** Ask to attack `target`. Returns true if this fighter holds (or now holds) a token. */
  request(f: Fighter, target: Fighter): boolean {
    let set = this.holders.get(target.id);
    if (!set) {
      set = new Set();
      this.holders.set(target.id, set);
    }
    for (const h of set) if (h.isKO || h.target !== target) set.delete(h);
    if (set.has(f)) return true;
    if (set.size >= this.maxPerTarget) return false;
    set.add(f);
    return true;
  }

  release(f: Fighter): void {
    for (const set of this.holders.values()) set.delete(f);
  }

  holds(f: Fighter, target: Fighter): boolean {
    return this.holders.get(target.id)?.has(f) ?? false;
  }

  count(target: Fighter): number {
    return this.holders.get(target.id)?.size ?? 0;
  }
}
