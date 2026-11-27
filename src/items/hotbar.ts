/**
 * The hotbar: four quick slots, one for something medical, one for food and drink, one for a stamina booster (an
 * energy drink, a gel, a shot), one for a weapon. Each
 * slot remembers an item (by id) and uses the next of it from your pockets; when you've none of that left it
 * pulls in the next suitable thing you're carrying, so a fight never stops for a trip to the bag. Change
 * what's in a slot from Pockets & bag.
 *
 * Pure: reads and writes the save only. The world applies what a use does (World.useHotbar).
 */
import type { ItemStack } from './Inventory';
import { ITEMS, type ItemDef } from './items';

export type HotbarSlot = 'medic' | 'food' | 'stamina' | 'weapon';
/** In key order: 1 medical, 2 food and drink, 3 stamina, 4 weapon (what you use up together, then the weapon). */
export const HOTBAR_SLOTS: readonly HotbarSlot[] = ['medic', 'food', 'stamina', 'weapon'];
export const HOTBAR_LABELS: Record<HotbarSlot, string> = { medic: 'Medical', food: 'Food and drink', stamina: 'Stamina', weapon: 'Weapon' };
/** What an empty slot shows, faded: a painted icon (public/icons/hg), or `item:<id>` for that item's own icon. */
export const HOTBAR_EMPTY_ICON: Record<HotbarSlot, string> = { medic: 'first_aid', food: 'food', stamina: 'item:energy_drink', weapon: 'bat' };

/** Seconds between medical, food or drink uses from the hotbar (World.useHotbar): a choice in a fight, not a button to mash. Weapons don't wait. */
export const HOTBAR_COOLDOWN = 1.5;

/**
 * Stamina boosters are capped so they can't carry a fight: `BOOST_COOLDOWN` seconds between any two (in or out of a
 * fight), and at most `BOOSTS_PER_FIGHT` in one fight (`BOOSTS_PER_BOSS` against a boss). The count starts again
 * once the fight's over (World.useItem).
 */
export const BOOST_COOLDOWN = 12;
export const BOOSTS_PER_FIGHT = 3;
export const BOOSTS_PER_BOSS = 2;

/** What each slot is set to (item ids); null: pick for me. */
export type HotbarSave = Record<HotbarSlot, string | null>;
export const newHotbar = (): HotbarSave => ({ medic: null, food: null, stamina: null, weapon: null });

export function sanitiseHotbar(v: unknown): HotbarSave {
  const out = newHotbar();
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  for (const s of HOTBAR_SLOTS) {
    const id = r[s];
    if (typeof id === 'string' && ITEMS[id] && fitsSlot(s, ITEMS[id])) out[s] = id;
  }
  // Old saves had a drinks slot: what was in it goes where it belongs now (an energy drink to stamina, a can of
  // pop or a flask of tea in with the food).
  const old = r.drink;
  if (typeof old === 'string' && ITEMS[old]) {
    const to = slotFor(ITEMS[old]);
    if (to && !out[to]) out[to] = old;
  }
  return out;
}

/** Can this item go in this slot? */
export function fitsSlot(slot: HotbarSlot, d: ItemDef): boolean {
  if (slot === 'weapon') return !!d.weapon;
  if (!d.use || d.ingredient) return false;
  if (slot === 'medic') return d.icon === 'medkit';
  // Stamina: boosters (energy drink, gel, shot, electrolyte drink), for getting your legs back mid-fight.
  if (slot === 'stamina') return !!d.boost;
  // Food and drink: anything else you eat or drink that does something for you.
  return d.icon !== 'medkit' && !d.boost && !!((d.use.heal ?? 0) > 0 || (d.use.healPct ?? 0) > 0 || (d.use.stamina ?? 0) > 0 || (d.use.needs?.fill ?? 0) > 0 || (d.use.needs?.diet ?? 0) > 0);
}

/** The slot an item goes in, if any. */
export function slotFor(d: ItemDef): HotbarSlot | null {
  return HOTBAR_SLOTS.find((s) => fitsSlot(s, d)) ?? null;
}

interface Carrying {
  inventory: ItemStack[];
  held: ItemStack | null;
  hotbar: HotbarSave;
}

/**
 * The next suitable thing when a slot's own item has run out. Medical, food and drink: whatever you've most of (the
 * cheaper on a tie), so a stack of plasters goes before your one first aid kit. Weapons: the best one you carry.
 */
function fallback(slot: HotbarSlot, stacks: ItemStack[]): ItemStack | null {
  const fit = stacks.filter((st) => ITEMS[st.id] && fitsSlot(slot, ITEMS[st.id]));
  if (!fit.length) return null;
  const qty = new Map<string, number>();
  for (const st of fit) qty.set(st.id, (qty.get(st.id) ?? 0) + st.qty);
  fit.sort((a, b) => {
    const da = ITEMS[a.id];
    const db = ITEMS[b.id];
    if (slot === 'weapon') return db.value - da.value || (b.hits ?? Infinity) - (a.hits ?? Infinity) || a.id.localeCompare(b.id);
    return qty.get(b.id)! - qty.get(a.id)! || da.value - db.value || a.id.localeCompare(b.id);
  });
  return fit[0];
}

/** The stack a slot would use now, from your pockets (weapons: the one you'd draw). */
export function hotbarStack(s: Carrying, slot: HotbarSlot): ItemStack | null {
  const want = s.hotbar[slot];
  if (want) {
    // Of the one you chose, the stack with the least left goes first (a part-used weapon before a fresh one).
    const same = s.inventory.filter((st) => st.id === want);
    if (same.length) return same.sort((a, b) => (slot === 'weapon' ? (a.hits ?? Infinity) - (b.hits ?? Infinity) : a.qty - b.qty))[0];
  }
  return fallback(slot, s.inventory);
}

/** What a slot shows: the stack it would use, how many of it you've got, and whether it's in your hands. */
export interface HotbarView {
  slot: HotbarSlot;
  stack: ItemStack | null;
  /** All of that item you're carrying. */
  count: number;
  /** Weapon slot: the weapon in your hands (pressing it puts it away when there's nothing else to draw). */
  inHand: ItemStack | null;
}

export function hotbarView(s: Carrying, slot: HotbarSlot): HotbarView {
  const stack = hotbarStack(s, slot);
  const count = stack ? s.inventory.filter((x) => x.id === stack.id).reduce((n, x) => n + x.qty, 0) : 0;
  const inHand = slot === 'weapon' ? s.held : null;
  return { slot, stack, count, inHand };
}

/**
 * Keep the slot pointing at what it now uses: after the last of one item goes, the next suitable one takes
 * its place for good (so it shows, and stays, until you change it). Returns the id now in the slot.
 */
export function refillHotbar(s: Carrying, slot: HotbarSlot): string | null {
  const st = hotbarStack(s, slot);
  if (st) s.hotbar[slot] = st.id;
  return st?.id ?? s.hotbar[slot];
}

/** Every item you carry that could go in a slot, one per id, in the order the slot cycles through them. */
export function hotbarChoices(s: Carrying, slot: HotbarSlot): string[] {
  const ids: string[] = [];
  for (const st of s.inventory) if (ITEMS[st.id] && fitsSlot(slot, ITEMS[st.id]) && !ids.includes(st.id)) ids.push(st.id);
  return ids.sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
}

/** Put an item in its slot. */
export function setHotbar(s: Carrying, id: string): HotbarSlot | null {
  const d = ITEMS[id];
  const slot = d ? slotFor(d) : null;
  if (!slot) return null;
  s.hotbar[slot] = id;
  return slot;
}

/** Move a slot on to the next thing you could put there (from Pockets & bag). */
export function cycleHotbar(s: Carrying, slot: HotbarSlot): string | null {
  const ids = hotbarChoices(s, slot);
  if (!ids.length) return null;
  const now = hotbarStack(s, slot)?.id ?? null;
  const i = now ? ids.indexOf(now) : -1;
  s.hotbar[slot] = ids[(i + 1) % ids.length];
  return s.hotbar[slot];
}
