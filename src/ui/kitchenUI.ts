import { ITEMS } from '../items/items';
import { takeStack, type ItemStack } from '../items/Inventory';
import type { Progress } from '../progress/Progress';
import { COOK_AT_LABELS, GROCERY_SHOP, RECIPES, RECIPE_KIND_LABELS, STARTER_GROCERIES, dietLabel, have, missing, putInto, recipeStats, storeCount, takeFrom, type Recipe, type RecipeKind } from '../home/recipes';
import { NEED_KEYS, NEED_NAMES, needLabel, type NeedKey } from '../home/needs';
import { menuButton } from './controls';
import { h } from './dom';
import { panelScreen, shopRow } from './hub';
import { itemIconUrl } from './itemIcons';
import type { Screen } from './UIManager';

/**
 * The kitchen and bathroom screens: what's in the fridge and the cupboards
 * (take things out, put shopping away, order a food shop), the recipe book,
 * and the short choice lists for the bathroom sink, the bed and the cabinet.
 * Every one is a single flat list — no menus inside menus.
 */

/** A weekly shop: what the house starts with, in one go. */
export const WEEKLY_SHOP_COST = 25;

const thumb = (id: string) => h('img', { class: 'k-thumb', src: itemIconUrl(id), alt: '', draggable: 'false' });

function itemRow(st: { id: string; qty: number }, text: string, button: string, onClick: (() => void) | null): HTMLElement {
  const d = ITEMS[st.id];
  const row = shopRow(`${d.name}${st.qty > 1 ? ` ×${st.qty}` : ''}`, text, button, onClick);
  row.classList.add('k-row');
  row.prepend(thumb(st.id));
  return row;
}

/** Group stacks of the same thing for display. */
function grouped(list: ItemStack[]): { id: string; qty: number }[] {
  const m = new Map<string, number>();
  for (const s of list) m.set(s.id, (m.get(s.id) ?? 0) + s.qty);
  return [...m].map(([id, qty]) => ({ id, qty })).sort((a, b) => ITEMS[a.id].name.localeCompare(ITEMS[b.id].name));
}

/** The fridge or the cupboards: take things out, put things away, order more. */
export function storeScreen(which: 'fridge' | 'cupboard', p: Progress, close: () => void, changed: () => void): Screen {
  const title = which === 'fridge' ? 'Fridge' : 'Kitchen cupboards';
  let shopping = false;
  return panelScreen(title, p, (msg, rebuild) => {
    const s = p.save;
    const store = which === 'fridge' ? s.pantry.fridge : s.pantry.cupboard;
    const rows: HTMLElement[] = [];
    rows.push(
      h('div', { class: 'k-tabs' },
        menuButton(`In the ${which === 'fridge' ? 'fridge' : 'cupboards'} (${storeCount(store)})`, () => ((shopping = false), rebuild()), undefined, shopping ? '' : 'on'),
        menuButton('Order a food shop', () => ((shopping = true), rebuild()), 'Delivered to the kitchen', shopping ? 'on' : ''),
      ),
    );
    if (shopping) {
      rows.push(
        h('p', { class: 'hint', text: 'Paid from your pocket first, then the tin. It comes straight to the kitchen and goes in the fridge or the cupboards.' }),
        shopRow('Weekly shop', 'Bread, milk, eggs, butter, cheese, ham, bacon, sausages, beans, cereal, potatoes, veg, chicken, snacks.', `£${WEEKLY_SHOP_COST}`, () => {
          if (!p.pay(WEEKLY_SHOP_COST)) return msg('Not enough money', true);
          p.stockKitchen(STARTER_GROCERIES);
          changed();
          msg('Delivered. Fridge and cupboards stocked.');
        }),
        h('h3', { text: 'Single items' }),
      );
      for (const id of GROCERY_SHOP) {
        const d = ITEMS[id];
        if (!d?.store) continue;
        const n = have(s.pantry, s.inventory, id);
        rows.push(itemRow({ id, qty: 1 }, `${d.store === 'fridge' ? 'Fridge' : 'Cupboard'} · you have ${n}`, `£${d.value}`, () => {
          if (!p.pay(d.value)) return msg('Not enough money', true);
          p.stockKitchen([{ id, qty: 1 }]);
          changed();
          msg(`${d.name} delivered.`);
        }));
      }
      return rows;
    }
    const inside = grouped(store);
    if (!inside.length) rows.push(h('p', { class: 'hint', text: `Nothing in the ${which === 'fridge' ? 'fridge' : 'cupboards'}. Order a food shop.` }));
    for (const g of inside) {
      const d = ITEMS[g.id];
      const kind = d.ingredient ? 'Ingredient' : d.icon === 'plate' ? 'Leftovers — take it to eat' : d.use ? d.use.text : '';
      rows.push(itemRow(g, kind, 'Take one', () => {
        if (p.spaceFor(g.id) < 1) return msg('No room in your pockets', true);
        takeFrom(store, g.id, 1);
        p.giveItem(g.id, 1);
        changed();
        msg(`Took ${d.name.toLowerCase()}.`);
      }));
    }
    // What you're carrying that belongs in here.
    const put = s.inventory.filter((st) => ITEMS[st.id]?.store === which);
    if (put.length) {
      rows.push(h('h3', { text: 'Put away from your pockets' }));
      for (const st of put) {
        rows.push(itemRow(st, 'From your pockets', 'Put away', () => {
          const taken = takeStack(s.inventory, st.uid, st.qty, () => p.newUid());
          if (taken) putInto(store, taken.id, taken.qty, () => p.newUid());
          changed();
          msg(`Put ${ITEMS[st.id].name.toLowerCase()} away.`);
        }));
      }
    }
    return rows;
  }, close);
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** The recipe book: what you can make with what's in, and what's missing. */
export function recipeScreen(p: Progress, close: () => void, cook: (r: Recipe) => void, filter?: 'stove'): Screen {
  return panelScreen('Cooking', p, () => {
    const s = p.save;
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: 'Ingredients come from the fridge, the cupboards and your pockets. Cooking takes them; extra servings go in the fridge. Stop any time with Esc or by walking off.' })];
    for (const kind of ['quick', 'cooked', 'snack'] as RecipeKind[]) {
      const list = RECIPES.filter((r) => r.kind === kind && (filter !== 'stove' || r.cookAt !== 'none'));
      if (!list.length) continue;
      rows.push(h('h3', { text: RECIPE_KIND_LABELS[kind] }));
      for (const r of list) {
        const st = recipeStats(r);
        const miss = missing(r, s.pantry, s.inventory);
        const time = r.cookAt === 'none' ? `${r.prep}s` : `${r.prep}s prep + ${r.cook}s ${COOK_AT_LABELS[r.cookAt].toLowerCase()}`;
        const chips = h('div', { class: 'k-ings' }, ...r.ingredients.map((g) => {
          const n = have(s.pantry, s.inventory, g.id);
          return h('span', { class: `k-ing${n < g.qty ? ' miss' : ''}`, text: `${ITEMS[g.id].name}${g.qty > 1 ? ` ×${g.qty}` : ''}${n < g.qty ? ' (none)' : ''}` });
        }));
        const info = h('div', { class: 'what' },
          h('b', { text: `${r.name}  ` }, h('span', { class: 'k-stars', text: stars(r.quality) })),
          h('span', { text: `${time} · serves ${r.servings} · fills ${st.fill}% hunger · +${st.heal} health${st.energy ? ` · +${st.energy} energy` : ''} · ${dietLabel(st.diet)}` }),
          h('span', { class: 'k-text', text: r.text }),
          chips,
        );
        const b = menuButton(miss.length ? 'Missing' : r.kind === 'snack' ? 'Eat' : 'Make', () => {
          if (missing(r, s.pantry, s.inventory).length) return;
          cook(r);
        });
        if (miss.length) b.setAttribute('disabled', '');
        rows.push(h('div', { class: 'shop-row k-row k-recipe' }, thumb(r.makes), info, b));
      }
    }
    return rows;
  }, close);
}

/** A flat list of things to do somewhere (bathroom sink, bed, cabinet). */
export function choiceScreen(title: string, p: Progress, close: () => void, intro: string, choices: { name: string; text: string; button: string; go: () => void; disabled?: boolean }[]): Screen {
  return panelScreen(title, p, () => [
    h('p', { class: 'hint', text: intro }),
    ...choices.map((c) => shopRow(c.name, c.text, c.button, c.disabled ? null : () => c.go())),
  ], close);
}

/** Bars for the character screen's Needs & Lifestyle section. */
export function needsBars(needs: Record<NeedKey, number>): HTMLElement {
  return h('div', { class: 'needs-list' }, ...NEED_KEYS.map((k) => {
    const l = needLabel(k, needs[k]);
    return h('div', { class: `need-row u${l.urgency}` },
      h('span', { class: 'need-name', text: NEED_NAMES[k] }),
      h('div', { class: 'need-bar' }, h('div', { class: 'need-fill', style: `width:${Math.round(l.bar * 100)}%;background:${l.colour}` })),
      h('span', { class: 'need-label', text: l.label }),
    );
  }));
}
