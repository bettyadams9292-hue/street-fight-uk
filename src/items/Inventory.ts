import { cleanMods, maxDurability, type WeaponMods } from '../combat/weaponMods';
import { ITEMS, type ItemCategory, type ItemDef } from './items';

/**
 * One pile of an item somewhere: in your pockets, in the stash at home, worn
 * or in your hands. Every stack has a unique id, and stacks are only ever
 * moved, split or merged, never copied, so an item can't be duplicated by
 * moving it about.
 */
export interface ItemStack {
  uid: string;
  id: string;
  qty: number;
  /** Weapons: swings left before it breaks. */
  hits?: number;
  /** Clothing: dyed colour. */
  colour?: string;
  /** Came from a robbery. Pawn shop pays less; the police take it if they catch you. */
  stolen?: boolean;
  /** Weapons: workshop upgrades. */
  mods?: WeaponMods;
  /** Weapons: made at the workbench. */
  crafted?: boolean;
}

export type SortMode = 'category' | 'value' | 'name' | 'rarity';
const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
const CATEGORY_ORDER: Record<ItemCategory, number> = { weapon: 0, clothing: 1, accessory: 2, consumable: 3, valuable: 4, collectible: 5, quest: 6, misc: 7 };

export function defOf(s: ItemStack): ItemDef {
  const d = ITEMS[s.id];
  if (!d) throw new Error(`Unknown item ${s.id}`);
  return d;
}

/** Two stacks can merge if they're the same thing in the same state. */
export function canMerge(a: ItemStack, b: { id: string; hits?: number; colour?: string; stolen?: boolean }): boolean {
  const d = ITEMS[a.id];
  return !!d && d.stack > 1 && a.id === b.id && !!a.stolen === !!b.stolen && a.hits === b.hits && a.colour === b.colour;
}

/** How many of this would fit in the list. */
export function spaceFor(list: readonly ItemStack[], cap: number, item: { id: string; hits?: number; colour?: string; stolen?: boolean }): number {
  const d = ITEMS[item.id];
  if (!d) return 0;
  let room = 0;
  for (const s of list) if (canMerge(s, item)) room += d.stack - s.qty;
  room += Math.max(0, cap - list.length) * d.stack;
  return room;
}

/**
 * Put a stack into a list, merging where possible. Returns what didn't fit
 * (null if everything fitted). The stack passed in is consumed: don't reuse it.
 */
export function addStack(list: ItemStack[], cap: number, stack: ItemStack, newUid: () => string): ItemStack | null {
  const d = ITEMS[stack.id];
  if (!d || stack.qty <= 0) return null;
  let left = stack.qty;
  for (const s of list) {
    if (left <= 0) break;
    if (!canMerge(s, stack)) continue;
    const n = Math.min(left, d.stack - s.qty);
    s.qty += n;
    left -= n;
  }
  let first = true;
  while (left > 0 && list.length < cap) {
    const n = Math.min(left, d.stack);
    // The stack passed in becomes the first new slot (it keeps its uid).
    list.push(first ? Object.assign(stack, { qty: n }) : { ...stack, uid: newUid(), qty: n });
    first = false;
    left -= n;
  }
  if (left <= 0) return null;
  return { ...stack, uid: first ? stack.uid : newUid(), qty: left };
}

/** Take qty out of a stack in a list. Returns the removed part (a new stack if split) or null. */
export function takeStack(list: ItemStack[], uid: string, qty: number, newUid: () => string): ItemStack | null {
  const i = list.findIndex((s) => s.uid === uid);
  if (i < 0) return null;
  const s = list[i];
  const n = Math.max(1, Math.min(qty, s.qty));
  if (n >= s.qty) {
    list.splice(i, 1);
    return s;
  }
  s.qty -= n;
  return { ...s, uid: newUid(), qty: n };
}

export function countOf(list: readonly ItemStack[], id: string): number {
  return list.reduce((n, s) => n + (s.id === id ? s.qty : 0), 0);
}

export function stackValue(s: ItemStack): number {
  return (ITEMS[s.id]?.value ?? 0) * s.qty;
}

export function sortStacks(list: ItemStack[], mode: SortMode): void {
  const name = (s: ItemStack) => ITEMS[s.id]?.name ?? s.id;
  list.sort((a, b) => {
    const da = defOf(a);
    const db = defOf(b);
    switch (mode) {
      case 'value':
        return stackValue(b) - stackValue(a) || name(a).localeCompare(name(b));
      case 'name':
        return name(a).localeCompare(name(b));
      case 'rarity':
        return RARITY_ORDER[da.rarity] - RARITY_ORDER[db.rarity] || name(a).localeCompare(name(b));
      default:
        return CATEGORY_ORDER[da.category] - CATEGORY_ORDER[db.category] || name(a).localeCompare(name(b));
    }
  });
}

/** Repair one loaded stack, or null if it's junk. */
export function sanitiseStack(raw: unknown, seen: Set<string>): ItemStack | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ItemStack>;
  const d = typeof r.id === 'string' ? ITEMS[r.id] : undefined;
  if (!d || typeof r.uid !== 'string' || !r.uid || seen.has(r.uid)) return null;
  seen.add(r.uid);
  const qty = typeof r.qty === 'number' && Number.isFinite(r.qty) ? Math.max(1, Math.min(d.stack, Math.floor(r.qty))) : 1;
  const out: ItemStack = { uid: r.uid, id: d.id, qty };
  if (typeof r.hits === 'number' && Number.isFinite(r.hits)) out.hits = Math.max(1, Math.floor(r.hits));
  if (typeof r.colour === 'string' && /^#[0-9a-f]{6}$/i.test(r.colour)) out.colour = r.colour;
  if (r.stolen === true) out.stolen = true;
  if (d.weapon) {
    const mods = cleanMods(r.mods, d.weapon);
    if (mods) out.mods = mods;
    if (r.crafted === true) out.crafted = true;
    // Hits can't exceed what the (upgraded) weapon holds.
    if (out.hits !== undefined) out.hits = Math.min(out.hits, maxDurability(d.weapon, mods));
  }
  return out;
}
