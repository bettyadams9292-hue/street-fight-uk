import { ITEMS } from '../items/items';
import type { ItemStack } from '../items/Inventory';

/**
 * Cooking. Each recipe takes real ingredients from the fridge, the cupboards
 * or your pockets, is prepared at the worktop and (most of them) cooked on the
 * hob or in the oven, and makes a meal item: a plate you sit down and eat,
 * with any extra servings kept in the fridge as leftovers.
 */

export type RecipeKind = 'quick' | 'cooked' | 'snack';
/** Where the cooking happens. Snacks and cold food need no cooking. */
export type CookAt = 'none' | 'hob' | 'oven' | 'toaster';

export interface Recipe {
  id: string;
  name: string;
  kind: RecipeKind;
  /** What it makes (a meal or snack item). */
  makes: string;
  servings: number;
  ingredients: { id: string; qty: number }[];
  /** Seconds at the worktop. */
  prep: number;
  cookAt: CookAt;
  /** Seconds on the hob, in the oven or the toaster. */
  cook: number;
  /** 1..5 stars. */
  quality: number;
  text: string;
}

export const RECIPE_KIND_LABELS: Record<RecipeKind, string> = { quick: 'Quick meals', cooked: 'Cooked meals', snack: 'Snacks' };
export const COOK_AT_LABELS: Record<CookAt, string> = { none: 'No cooking', hob: 'Hob', oven: 'Oven', toaster: 'Grill' };

const R = (r: Recipe) => r;
const i = (id: string, qty = 1) => ({ id, qty });

export const RECIPES: Recipe[] = [
  // ---- quick meals ----
  R({ id: 'sandwich', name: 'Sandwich', kind: 'quick', makes: 'm_sandwich', servings: 1, ingredients: [i('g_bread'), i('g_ham'), i('g_cheese')], prep: 6, cookAt: 'none', cook: 0, quality: 2, text: 'Ham and cheese, cut into triangles.' }),
  R({ id: 'toast', name: 'Toast', kind: 'quick', makes: 'm_toast', servings: 1, ingredients: [i('g_bread'), i('g_butter')], prep: 2, cookAt: 'toaster', cook: 6, quality: 1, text: 'Two slices under the grill, lots of butter.' }),
  R({ id: 'cereal', name: 'Cereal', kind: 'quick', makes: 'm_cereal', servings: 1, ingredients: [i('g_cereal'), i('g_milk')], prep: 4, cookAt: 'none', cook: 0, quality: 1, text: 'Bowl, cereal, milk. In that order.' }),
  R({ id: 'beans_toast', name: 'Beans on toast', kind: 'quick', makes: 'm_beans_toast', servings: 1, ingredients: [i('g_bread'), i('g_beans'), i('g_butter')], prep: 3, cookAt: 'hob', cook: 8, quality: 2, text: 'Beans warmed in a pan, poured over buttered toast.' }),
  R({ id: 'scrambled', name: 'Scrambled eggs', kind: 'quick', makes: 'm_scrambled', servings: 1, ingredients: [i('g_eggs'), i('g_butter'), i('g_bread'), i('g_milk')], prep: 4, cookAt: 'hob', cook: 8, quality: 3, text: 'Low and slow with a knob of butter, on toast.' }),
  // ---- cooked meals ----
  R({ id: 'full_english', name: 'Full English', kind: 'cooked', makes: 'm_full_english', servings: 1, ingredients: [i('g_bacon'), i('g_sausages'), i('g_eggs'), i('g_beans'), i('g_bread'), i('g_mushrooms'), i('g_tomatoes')], prep: 8, cookAt: 'hob', cook: 16, quality: 5, text: 'The works. +25 max health for your next trip out.' }),
  R({ id: 'sausage_mash', name: 'Sausage and mash', kind: 'cooked', makes: 'm_sausage_mash', servings: 2, ingredients: [i('g_sausages'), i('g_potatoes'), i('g_butter'), i('g_peas')], prep: 8, cookAt: 'hob', cook: 14, quality: 4, text: 'Peel, boil, mash; bangers in the pan. Serves two.' }),
  R({ id: 'chicken_chips', name: 'Chicken and chips', kind: 'cooked', makes: 'm_chicken_chips', servings: 2, ingredients: [i('g_chicken'), i('g_oven_chips')], prep: 4, cookAt: 'oven', cook: 18, quality: 3, text: 'Season the chicken, everything in the oven. Serves two.' }),
  R({ id: 'steak', name: 'Steak and potatoes', kind: 'cooked', makes: 'm_steak', servings: 1, ingredients: [i('g_steak'), i('g_potatoes'), i('g_mushrooms'), i('g_butter')], prep: 8, cookAt: 'hob', cook: 14, quality: 5, text: 'Rested properly. Worth the money.' }),
  R({ id: 'pasta', name: 'Pasta bake', kind: 'cooked', makes: 'm_pasta', servings: 3, ingredients: [i('g_pasta'), i('g_sauce'), i('g_cheese')], prep: 4, cookAt: 'oven', cook: 14, quality: 3, text: 'Boil, sauce, cheese on top, into the oven. Serves three.' }),
  R({ id: 'burgers', name: 'Burgers', kind: 'cooked', makes: 'm_burger', servings: 2, ingredients: [i('g_mince'), i('g_buns'), i('g_cheese'), i('g_onions')], prep: 8, cookAt: 'hob', cook: 12, quality: 3, text: 'Shape the patties, fry the onions. Serves two.' }),
  R({ id: 'curry', name: 'Chicken curry', kind: 'cooked', makes: 'm_curry', servings: 3, ingredients: [i('g_chicken'), i('g_curry_sauce'), i('g_rice'), i('g_onions')], prep: 8, cookAt: 'hob', cook: 18, quality: 4, text: 'Better than the takeaway. Serves three.' }),
  // ---- snacks ----
  R({ id: 'crisps', name: 'Crisps', kind: 'snack', makes: 's_crisps', servings: 1, ingredients: [i('s_crisps')], prep: 1.5, cookAt: 'none', cook: 0, quality: 1, text: 'Open the bag.' }),
  R({ id: 'chocolate', name: 'Chocolate', kind: 'snack', makes: 's_chocolate', servings: 1, ingredients: [i('s_chocolate')], prep: 1.5, cookAt: 'none', cook: 0, quality: 1, text: 'Unwrap.' }),
  R({ id: 'fruit', name: 'Fruit', kind: 'snack', makes: 's_fruit', servings: 1, ingredients: [i('s_fruit')], prep: 1.5, cookAt: 'none', cook: 0, quality: 2, text: 'Give it a rinse.' }),
  R({ id: 'biscuits', name: 'Biscuits', kind: 'snack', makes: 's_biscuits', servings: 1, ingredients: [i('s_biscuits')], prep: 1.5, cookAt: 'none', cook: 0, quality: 1, text: 'Straight from the packet.' }),
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Nutrition at a glance for the recipe card. */
export function recipeStats(r: Recipe): { fill: number; diet: number; energy: number; heal: number } {
  const u = ITEMS[r.makes].use!;
  return { fill: u.needs?.fill ?? 0, diet: u.needs?.diet ?? 0, energy: u.needs?.energy ?? 0, heal: u.heal ?? 0 };
}

export function dietLabel(diet: number): string {
  return diet >= 70 ? 'Healthy' : diet >= 50 ? 'Balanced' : diet >= 30 ? 'Stodgy' : 'Junk';
}

// ---- the kitchen's stores -----------------------------------------------------------------------

export interface PantrySave {
  fridge: ItemStack[];
  cupboard: ItemStack[];
}

/** What the house comes stocked with (new games, and saves from before the kitchen worked). */
export const STARTER_GROCERIES: { id: string; qty: number }[] = [
  i('g_bread', 4), i('g_butter', 3), i('g_cheese', 2), i('g_ham', 2), i('g_eggs', 3), i('g_milk', 3), i('g_cereal', 2), i('g_beans', 3),
  i('g_bacon', 2), i('g_sausages', 2), i('g_potatoes', 2), i('g_mushrooms', 1), i('g_tomatoes', 1), i('g_peas', 1), i('g_chicken', 1), i('g_oven_chips', 1),
  i('s_crisps', 3), i('s_fruit', 4), i('s_biscuits', 2), i('s_chocolate', 1),
];

/** Online food shop: everything a recipe uses, delivered to the kitchen. */
export const GROCERY_SHOP: string[] = [
  'g_bread', 'g_butter', 'g_milk', 'g_eggs', 'g_cheese', 'g_ham', 'g_bacon', 'g_sausages', 'g_chicken', 'g_steak', 'g_mince',
  'g_mushrooms', 'g_tomatoes', 'g_peas', 'g_oven_chips', 'g_cereal', 'g_beans', 'g_potatoes', 'g_pasta', 'g_sauce', 'g_buns',
  'g_curry_sauce', 'g_rice', 'g_onions', 's_crisps', 's_chocolate', 's_fruit', 's_biscuits', 'water', 'can_of_pop',
];
/** A delivery charge on top, per order. */
export const DELIVERY_FEE = 2;

export function storeOf(id: string): 'fridge' | 'cupboard' | null {
  return ITEMS[id]?.store ?? null;
}

const count = (list: ItemStack[], id: string) => list.filter((s) => s.id === id).reduce((a, s) => a + s.qty, 0);

/** How many of something are in the kitchen and your pockets together. */
export function have(pantry: PantrySave, pockets: ItemStack[], id: string): number {
  return count(pantry.fridge, id) + count(pantry.cupboard, id) + count(pockets, id);
}

/** What's missing for a recipe (empty: you can make it). */
export function missing(r: Recipe, pantry: PantrySave, pockets: ItemStack[]): { id: string; need: number; have: number }[] {
  return r.ingredients.map((g) => ({ id: g.id, need: g.qty, have: have(pantry, pockets, g.id) })).filter((x) => x.have < x.need);
}

/** Take n of an item out of a list. Returns how many came out. */
export function takeFrom(list: ItemStack[], id: string, n: number): number {
  let left = n;
  for (let k = list.length - 1; k >= 0 && left > 0; k--) {
    const s = list[k];
    if (s.id !== id) continue;
    const take = Math.min(left, s.qty);
    s.qty -= take;
    left -= take;
    if (s.qty <= 0) list.splice(k, 1);
  }
  return n - left;
}

/** Use up a recipe's ingredients: the kitchen first, then your pockets. Returns false (and takes nothing) if anything's short. */
export function useIngredients(r: Recipe, pantry: PantrySave, pockets: ItemStack[]): boolean {
  if (missing(r, pantry, pockets).length) return false;
  for (const g of r.ingredients) {
    let left = g.qty;
    const where = storeOf(g.id) === 'fridge' ? [pantry.fridge, pantry.cupboard, pockets] : [pantry.cupboard, pantry.fridge, pockets];
    for (const list of where) left -= takeFrom(list, g.id, left);
  }
  return true;
}

/** Put n of an item into a store, topping up stacks first. New stacks need a uid. */
export function putInto(list: ItemStack[], id: string, n: number, newUid: () => string): void {
  const max = ITEMS[id]?.stack ?? 1;
  let left = n;
  for (const s of list) {
    if (left <= 0) break;
    if (s.id !== id || s.qty >= max) continue;
    const add = Math.min(left, max - s.qty);
    s.qty += add;
    left -= add;
  }
  while (left > 0) {
    const q = Math.min(left, max);
    list.push({ uid: newUid(), id, qty: q });
    left -= q;
  }
}

/** Repair the kitchen part of a save. Unknown or non-food items are dropped; stacks need unique uids. */
export function sanitisePantry(raw: unknown, sanitiseStack: (x: unknown) => ItemStack | null): PantrySave | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PantrySave>;
  const clean = (v: unknown): ItemStack[] => (Array.isArray(v) ? v.map(sanitiseStack).filter((s): s is ItemStack => !!s && !!ITEMS[s.id]?.store) : []).slice(0, 200);
  return { fridge: clean(r.fridge), cupboard: clean(r.cupboard) };
}

/** Total items in a store (for the screen's header). */
export function storeCount(list: ItemStack[]): number {
  return list.reduce((a, s) => a + s.qty, 0);
}
