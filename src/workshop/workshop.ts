import type { Progress, PurchaseResult } from '../progress/Progress';
import type { ItemStack } from '../items/Inventory';
import { ITEMS, weaponItemId } from '../items/items';
import { WEAPONS, type WeaponId } from '../combat/Weapons';
import { MOD_KEYS, maxDurability, modLimit, type ModKey, type WeaponMods } from '../combat/weaponMods';

/**
 * The garage workbench: repair, craft and upgrade weapons. Materials are
 * ordinary items (found in bins, skips, cars, on enemies; the basics can be
 * ordered in), counted across your pockets and the stash. Every action costs
 * money and/or materials; upgrades get steeper level by level.
 */

export type Materials = Partial<Record<string, number>>;

export const MATERIAL_IDS = ['scrap_metal', 'duct_tape', 'bolts', 'leather_strip', 'steel_bar', 'spring_steel', 'carbon_fibre'] as const;
/** What can be ordered in for the bench (rarer materials have to be found or salvaged). */
export const SUPPLIES: { id: string; price: number }[] = [
  { id: 'duct_tape', price: 5 },
  { id: 'bolts', price: 6 },
  { id: 'scrap_metal', price: 9 },
];

/** How many of an item you have in your pockets and the stash. */
export function countItem(p: Progress, id: string): number {
  let n = 0;
  for (const st of p.save.inventory) if (st.id === id) n += st.qty;
  for (const st of p.save.storage) if (st.id === id) n += st.qty;
  return n;
}

export function hasMaterials(p: Progress, need: Materials): boolean {
  return Object.entries(need).every(([id, q]) => countItem(p, id) >= (q ?? 0));
}

/** Take materials, stash first (it's right there in the garage), then pockets. */
export function takeMaterials(p: Progress, need: Materials): void {
  for (const [id, q] of Object.entries(need)) {
    let left = q ?? 0;
    for (const list of [p.save.storage, p.save.inventory]) {
      for (let i = list.length - 1; i >= 0 && left > 0; i--) {
        const st = list[i];
        if (st.id !== id) continue;
        const take = Math.min(st.qty, left);
        st.qty -= take;
        left -= take;
        if (st.qty <= 0) list.splice(i, 1);
      }
    }
  }
}

/** Put materials in the stash (stacking where possible). */
export function addMaterials(p: Progress, give: Materials): void {
  for (const [id, q] of Object.entries(give)) {
    let left = q ?? 0;
    const def = ITEMS[id];
    for (const st of p.save.storage) {
      if (left <= 0) break;
      if (st.id !== id || st.qty >= def.stack) continue;
      const add = Math.min(def.stack - st.qty, left);
      st.qty += add;
      left -= add;
    }
    while (left > 0) {
      const add = Math.min(def.stack, left);
      p.save.storage.push(p.newStack(id, add));
      left -= add;
    }
  }
}

export function materialsText(m: Materials): string {
  return Object.entries(m).filter(([, q]) => (q ?? 0) > 0).map(([id, q]) => `${q} × ${ITEMS[id].name.toLowerCase()}`).join(', ');
}

export function buySupply(p: Progress, id: string, qty: number): PurchaseResult {
  const s = SUPPLIES.find((x) => x.id === id);
  if (!s) return { ok: false, reason: 'Can’t order that in' };
  const cost = s.price * qty;
  if (!p.pay(cost)) return { ok: false, reason: `Not enough money: need £${cost}` };
  addMaterials(p, { [id]: qty });
  return { ok: true };
}

// ---- weapons on the bench ------------------------------------------------------------------------

export interface BenchWeapon {
  st: ItemStack;
  where: 'hands' | 'pockets' | 'stash';
  id: WeaponId;
}

export function benchWeapons(p: Progress): BenchWeapon[] {
  const s = p.save;
  const out: BenchWeapon[] = [];
  const w = (st: ItemStack, where: BenchWeapon['where']) => {
    const d = ITEMS[st.id];
    if (d?.weapon) out.push({ st, where, id: d.weapon });
  };
  if (s.held) w(s.held, 'hands');
  for (const st of s.inventory) w(st, 'pockets');
  for (const st of s.storage) w(st, 'stash');
  return out;
}

// ---- repair ---------------------------------------------------------------------------------------

/** Cost to bring a weapon back to full: money for the missing share, plus a material. */
export function repairQuote(st: ItemStack): { cash: number; materials: Materials; from: number; to: number } | null {
  const id = ITEMS[st.id].weapon!;
  const w = WEAPONS[id];
  if (w.breaks) return null;
  const max = maxDurability(id, st.mods);
  const now = st.hits ?? max;
  if (now >= max) return { cash: 0, materials: {}, from: now, to: max };
  const missing = (max - now) / max;
  const upgraded = Object.values(st.mods ?? {}).reduce((n, v) => n + (v ?? 0), 0);
  const cash = Math.max(2, Math.ceil(w.value * 0.6 * missing + upgraded * 3 * missing));
  const mat = w.cls === 'heavy' || w.cls === 'blade' ? 'bolts' : 'duct_tape';
  const materials: Materials = { [mat]: missing > 0.6 ? 2 : 1 };
  if (upgraded >= 4 && missing > 0.5) materials.steel_bar = 1;
  return { cash, materials, from: now, to: max };
}

export function repairWeapon(p: Progress, st: ItemStack): PurchaseResult {
  const q = repairQuote(st);
  if (!q) return { ok: false, reason: 'That smashes: it can’t be fixed' };
  if (q.cash === 0) return { ok: false, reason: 'Good as new already' };
  if (!hasMaterials(p, q.materials)) return { ok: false, reason: `Needs ${materialsText(q.materials)}` };
  if (!p.pay(q.cash)) return { ok: false, reason: `Not enough money: need £${q.cash}` };
  takeMaterials(p, q.materials);
  st.hits = q.to;
  return { ok: true };
}

// ---- upgrades -------------------------------------------------------------------------------------

/** Price of the next level of an upgrade (level = the level you're buying, 1..3). */
export function upgradeQuote(id: WeaponId, key: ModKey, level: number): { cash: number; materials: Materials } {
  const w = WEAPONS[id];
  const classMult = w.cls === 'blade' || w.cls === 'heavy' ? 1.3 : w.cls === 'improvised' ? 0.7 : 1;
  const cash = Math.round([0, 25, 70, 160][level] * classMult);
  const materials: Materials =
    level === 1 ? { scrap_metal: 2, [key === 'handling' ? 'leather_strip' : key === 'durability' ? 'duct_tape' : 'bolts']: key === 'handling' ? 1 : 2 }
    : level === 2 ? { steel_bar: 1, bolts: 2, ...(key === 'handling' ? { leather_strip: 2 } : {}) }
    : { spring_steel: 1, steel_bar: 1, ...(key === 'power' || key === 'speed' ? { carbon_fibre: 1 } : { leather_strip: 2 }) };
  return { cash, materials };
}

export function upgradeWeapon(p: Progress, st: ItemStack, key: ModKey): PurchaseResult {
  const id = ITEMS[st.id].weapon;
  if (!id) return { ok: false, reason: 'Not a weapon' };
  const cur = st.mods?.[key] ?? 0;
  const limit = modLimit(id, key);
  if (limit === 0) return { ok: false, reason: 'Can’t be improved that way' };
  if (cur >= limit) return { ok: false, reason: 'As good as that weapon gets' };
  const q = upgradeQuote(id, key, cur + 1);
  if (!hasMaterials(p, q.materials)) return { ok: false, reason: `Needs ${materialsText(q.materials)}` };
  if (!p.pay(q.cash)) return { ok: false, reason: `Not enough money: need £${q.cash}` };
  takeMaterials(p, q.materials);
  const before = maxDurability(id, st.mods);
  const mods: WeaponMods = { ...(st.mods ?? {}), [key]: cur + 1 };
  st.mods = mods;
  // More durability adds the new capacity to what's left, rather than filling it up.
  if (key === 'durability') st.hits = Math.min(maxDurability(id, mods), (st.hits ?? before) + (maxDurability(id, mods) - before));
  return { ok: true };
}

export function modsText(mods?: WeaponMods): string {
  if (!mods) return 'Standard';
  return MOD_KEYS.filter((k) => mods[k]).map((k) => `${k} ${mods[k]}`).join(' · ') || 'Standard';
}

// ---- crafting -------------------------------------------------------------------------------------

export interface Recipe {
  weapon: WeaponId;
  cash: number;
  materials: Materials;
  /** Comes out with a free level in this (made properly). */
  bonus?: WeaponMods;
}

export const RECIPES: Recipe[] = [
  { weapon: 'pipe', cash: 5, materials: { scrap_metal: 3, duct_tape: 1 } },
  { weapon: 'club', cash: 5, materials: { scrap_metal: 1, duct_tape: 2, leather_strip: 1 } },
  { weapon: 'metal_bar', cash: 10, materials: { steel_bar: 1, duct_tape: 1 } },
  { weapon: 'wrench', cash: 12, materials: { steel_bar: 1, bolts: 2 } },
  { weapon: 'chain', cash: 15, materials: { scrap_metal: 4, bolts: 2, leather_strip: 1 } },
  { weapon: 'hammer', cash: 18, materials: { steel_bar: 1, leather_strip: 1, bolts: 1 } },
  { weapon: 'crowbar', cash: 22, materials: { steel_bar: 2, duct_tape: 1 }, bonus: { durability: 1 } },
  { weapon: 'baseball_bat', cash: 30, materials: { steel_bar: 1, leather_strip: 2, bolts: 2 }, bonus: { handling: 1 } },
  { weapon: 'machete', cash: 45, materials: { spring_steel: 1, leather_strip: 1, bolts: 1 }, bonus: { power: 1 } },
];

export function craftWeapon(p: Progress, r: Recipe): PurchaseResult {
  if (!hasMaterials(p, r.materials)) return { ok: false, reason: `Needs ${materialsText(r.materials)}` };
  if (!p.pay(r.cash)) return { ok: false, reason: `Not enough money: need £${r.cash}` };
  takeMaterials(p, r.materials);
  const mods = r.bonus ? { ...r.bonus } : undefined;
  const st = p.newStack(weaponItemId(r.weapon), 1, { hits: maxDurability(r.weapon, mods), mods, crafted: true });
  // Into your pockets if there's room, otherwise the stash.
  const left = p.pocket(st);
  if (left) p.save.storage.push(left);
  return { ok: true };
}

/** Break a weapon down for parts. */
export function salvageQuote(id: WeaponId): Materials {
  const w = WEAPONS[id];
  if (w.cls === 'heavy' || w.cls === 'blade') return { scrap_metal: 2, bolts: 1 };
  if (w.cls === 'blunt' || w.cls === 'long') return { scrap_metal: 1, duct_tape: 1 };
  return { scrap_metal: 1 };
}

export function salvageWeapon(p: Progress, uid: string): { ok: true; got: Materials } | { ok: false; reason: string } {
  const s = p.save;
  let st: ItemStack | null = null;
  if (s.held?.uid === uid) return { ok: false, reason: 'Put it down first' };
  for (const list of [s.inventory, s.storage]) {
    const i = list.findIndex((x) => x.uid === uid);
    if (i >= 0) {
      st = list[i];
      list.splice(i, 1);
      break;
    }
  }
  if (!st) return { ok: false, reason: 'Not found' };
  const id = ITEMS[st.id].weapon!;
  const got = salvageQuote(id);
  // Upgraded kit gives some of its good parts back.
  if ((st.mods?.power ?? 0) + (st.mods?.speed ?? 0) >= 2) got.steel_bar = 1;
  addMaterials(p, got);
  return { ok: true, got };
}
