import { WEAPONS } from '../combat/Weapons';
import { defOf, sortStacks, type ItemStack, type SortMode } from '../items/Inventory';
import {
  ITEMS,
  RARITY_COLOURS,
  RARITY_LABELS,
  WEAR_SLOTS,
  WEAR_SLOT_LABELS,
  type ItemDef,
  type WearSlot,
} from '../items/items';
import { STORAGE_UPGRADE, type Progress } from '../progress/Progress';
import { buyItem, pawnOffer, SHOP_STOCK, shopPrice } from '../items/shops';
export { pawnOffer, SHOP_STOCK, shopPrice };
import { MATERIAL_IDS } from '../workshop/workshop';
import type { AreaId } from '../progress/Progress';
import { menuButton } from './controls';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { itemIconUrl } from './itemIcons';
import type { Screen, UIManager } from './UIManager';

/**
 * Inventory, stash, pawn shop and clothes shop screens. They all share one
 * look: category tabs, a grid of item tiles, and a detail panel with what
 * you can do with the selected item.
 */

export interface InventoryActions {
  use(uid: string): { ok: boolean; text: string };
  hold(uid: string): boolean;
  putAway(): boolean;
  drop(uid: string, qty: number): boolean;
  /** Called after anything changes (save, rebuild the player's look). */
  changed(): void;
  /** Open the map at a place (e.g. where to sell something). */
  showOnMap?(area: AreaId): void;
}

/** The inventory's tabs. Item data keeps its own categories; these group them the way players think. */
type Filter = 'all' | 'weapons' | 'clothing' | 'equipment' | 'consumables' | 'materials' | 'valuables' | 'other';
const GROUPS: { id: Filter; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'all' },
  { id: 'weapons', label: 'Weapons', icon: 'weapon' },
  { id: 'clothing', label: 'Clothing', icon: 'clothes' },
  { id: 'equipment', label: 'Equipment', icon: 'equipment' },
  { id: 'consumables', label: 'Consumables', icon: 'consumable' },
  { id: 'materials', label: 'Materials', icon: 'material' },
  { id: 'valuables', label: 'Valuables', icon: 'valuable' },
  { id: 'other', label: 'Other', icon: 'misc' },
];
const MATERIALS = new Set<string>(MATERIAL_IDS);

export function groupOf(d: ItemDef): Exclude<Filter, 'all'> {
  if (d.weapon || d.category === 'weapon') return 'weapons';
  if (d.id.startsWith('bag_')) return 'equipment';
  if (d.category === 'clothing' || d.category === 'accessory' || d.wear) return 'clothing';
  if (d.category === 'consumable' || d.use) return 'consumables';
  if (MATERIALS.has(d.id)) return 'materials';
  if (d.category === 'valuable' || d.category === 'collectible') return 'valuables';
  return 'other';
}

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'category', label: 'Type' },
  { id: 'value', label: 'Value' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'name', label: 'Name' },
];

// ---- shared pieces ------------------------------------------------------------------------------

/** One square slot with the item's artwork. */
export function itemTile(st: ItemStack, opts: { selected?: boolean; tag?: string; onClick: () => void; price?: string }): HTMLElement {
  const d = defOf(st);
  const img = h('img', { src: itemIconUrl(st.id, st.colour), alt: '', draggable: 'false' });
  const tile = h(
    'button',
    { class: `item-tile${opts.selected ? ' selected' : ''}`, 'data-nav': true, 'data-grid': true, title: d.name, onclick: () => opts.onClick() },
    img,
    st.qty > 1 ? h('span', { class: 'qty', text: `×${st.qty}` }) : null,
    st.stolen ? h('span', { class: 'stolen', text: 'STOLEN' }) : null,
    opts.tag ? h('span', { class: 'tag', text: opts.tag }) : null,
    opts.price ? h('span', { class: 'price', text: opts.price }) : null,
    d.weapon && st.hits !== undefined ? conditionBar(st.hits, WEAPONS[d.weapon].durability) : null,
  );
  tile.style.setProperty('--rarity', RARITY_COLOURS[d.rarity]);
  return tile;
}

function conditionBar(hits: number, max: number): HTMLElement {
  const f = Math.max(0, Math.min(1, hits / max));
  const bar = h('span', { class: 'cond' }, h('span', { class: 'cond-fill' }));
  (bar.firstElementChild as HTMLElement).style.width = `${f * 100}%`;
  (bar.firstElementChild as HTMLElement).style.background = f > 0.5 ? '#6ad04a' : f > 0.25 ? '#e8c040' : '#e84a3a';
  return bar;
}


/** Lines describing an item (stats, use, condition, value). */
function detailLines(d: ItemDef, st: ItemStack | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (d.weapon) {
    const w = WEAPONS[d.weapon];
    out.push(
      statLine('Damage', `${w.light.damage} / ${w.heavy.damage}`),
      statLine('Reach', `${w.light.reach.toFixed(2)} m`),
      statLine('Speed', speedWord(w.light.startup)),
      statLine('Weight', `${w.weight} kg`),
      statLine('Durability', st?.hits !== undefined ? `${st.hits} / ${w.durability} hits` : `${w.durability} hits`),
    );
    if (w.throwable) out.push(statLine('Thrown', `${w.throwDamage} damage (Grab to throw)`));
    if (w.breaks) out.push(statLine('Breaks', w.breaksInto ? `into a ${WEAPONS[w.breaksInto].name.toLowerCase()}` : 'when worn out'));
  }
  if (d.use) out.push(statLine('Effect', d.use.text));
  if (d.wear) out.push(statLine('Worn on', WEAR_SLOT_LABELS[d.wear.slot]));
  for (const s of d.stats ?? []) out.push(statLine('Bonus', s.text));
  out.push(statLine('Value', d.value > 0 ? `£${d.value}${st && st.qty > 1 ? ` each (£${d.value * st.qty} total)` : ''}` : 'Worthless'));
  out.push(statLine('Space', `1 slot${d.stack > 1 ? `, stacks to ${d.stack}` : ''}`));
  if (st?.stolen) out.push(h('p', { class: 'warn-line', text: 'Stolen. The pawn shop pays less, and the police will take it if they catch you.' }));
  if (d.category === 'valuable' || d.category === 'collectible') out.push(h('p', { class: 'hint', text: 'Sell it at Pawn & Gold (Market Square). A cab from the map (M) drops you at the door.' }));
  if (d.questFlag) out.push(h('p', { class: 'warn-line', text: 'Quest item: can’t be dropped or sold.' }));
  return out;
}

const CATEGORY_ONE: Record<ItemDef['category'], string> = {
  weapon: 'Weapon', clothing: 'Clothing', accessory: 'Accessory', consumable: 'Consumable', collectible: 'Collectible', valuable: 'Valuable', quest: 'Quest item', misc: 'Item',
};

function speedWord(startup: number): string {
  return startup <= 5 ? 'Very fast' : startup <= 7 ? 'Fast' : startup <= 9 ? 'Medium' : startup <= 12 ? 'Slow' : 'Very slow';
}

function statLine(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat-line' }, h('span', { class: 'k', text: k }), h('span', { class: 'v', text: v }));
}

function detailPanel(d: ItemDef, st: ItemStack | null, actions: HTMLElement[], compare?: HTMLElement | null): HTMLElement {
  const head = h(
    'div',
    { class: 'detail-head' },
    h('img', { class: 'detail-icon', src: itemIconUrl(d.id, st?.colour), alt: '' }),
    h(
      'div',
      { class: 'detail-title' },
      h('h3', { text: d.name }),
      h('div', { class: 'rarity', text: `${RARITY_LABELS[d.rarity]} · ${CATEGORY_ONE[d.category]}` }),
    ),
  );
  (head.querySelector('.rarity') as HTMLElement).style.color = RARITY_COLOURS[d.rarity];
  return h('div', { class: 'detail-panel' }, head, h('p', { class: 'detail-text', text: d.text }), h('div', { class: 'stat-list' }, ...detailLines(d, st)), compare ?? null, h('div', { class: 'detail-actions' }, ...actions));
}

/** What you have on in the same slot, side by side. */
function compareBlock(progress: Progress, d: ItemDef): HTMLElement | null {
  const s = progress.save;
  let other: ItemStack | null = null;
  if (d.wear) other = s.worn[d.wear.slot] ?? null;
  else if (d.weapon) other = s.held;
  if (!other) return null;
  const od = defOf(other);
  if (od.id === d.id) return null;
  const rows: HTMLElement[] = [h('div', { class: 'compare-title', text: `Compared with your ${od.name.toLowerCase()}` })];
  if (d.weapon && od.weapon) {
    const a = WEAPONS[d.weapon];
    const b = WEAPONS[od.weapon];
    rows.push(cmpLine('Damage', a.heavy.damage, b.heavy.damage), cmpLine('Reach', a.light.reach, b.light.reach), cmpLine('Speed', -a.light.startup, -b.light.startup, (v) => speedWord(-v)));
  } else {
    const mine = (od.stats ?? []).map((x) => x.text).join(', ') || 'no bonus';
    const theirs = (d.stats ?? []).map((x) => x.text).join(', ') || 'no bonus';
    rows.push(statLine('This', theirs), statLine('Wearing', mine), cmpLine('Value', d.value, od.value, (v) => `£${v}`));
  }
  return h('div', { class: 'compare' }, ...rows);
}

function cmpLine(k: string, a: number, b: number, fmt: (v: number) => string = (v) => (Math.round(v * 100) / 100).toString()): HTMLElement {
  const cls = a > b ? 'up' : a < b ? 'down' : '';
  return h('div', { class: `stat-line ${cls}` }, h('span', { class: 'k', text: k }), h('span', { class: 'v', text: `${fmt(a)}  vs  ${fmt(b)}` }));
}

function tabsRow(current: Filter, counts: Partial<Record<Filter, number>>, onPick: (f: Filter) => void): HTMLElement {
  return h(
    'div',
    { class: 'inv-tabs' },
    ...GROUPS.filter((g) => g.id === 'all' || counts[g.id] || g.id === current).map((g) =>
      h(
        'button',
        { class: `inv-tab${g.id === current ? ' on' : ''}`, 'data-nav': true, 'data-grid': true, onclick: () => onPick(g.id) },
        icon(g.icon),
        h('span', { text: g.label }),
        counts[g.id] ? h('span', { class: 'count', text: String(counts[g.id]) }) : null,
      ),
    ),
  );
}

function countBy(list: readonly ItemStack[]): Partial<Record<Filter, number>> {
  const c: Partial<Record<Filter, number>> = { all: list.length };
  for (const s of list) {
    const g = groupOf(defOf(s));
    c[g] = (c[g] ?? 0) + 1;
  }
  return c;
}

const matches = (f: Filter, st: ItemStack) => f === 'all' || groupOf(defOf(st)) === f;

/** One line under an item's name: what matters about it at a glance. */
function oneLine(d: ItemDef, st: ItemStack): string {
  if (d.weapon) {
    const w = WEAPONS[d.weapon];
    return `Damage ${w.light.damage}/${w.heavy.damage} · ${st.hits ?? w.durability}/${w.durability} hits`;
  }
  if (d.use) return d.use.text;
  if (d.wear) return `${WEAR_SLOT_LABELS[d.wear.slot]}${d.stats?.length ? ` · ${d.stats[0].text}` : ''}`;
  if (MATERIALS.has(d.id)) return 'Workbench material';
  if (d.questFlag) return 'Quest item';
  return d.value > 0 ? `Worth £${d.value}` : d.text;
}

/** A card in the inventory list: picture, name, the key fact, quantity, and whether it's equipped. */
function itemCard(st: ItemStack, opts: { selected: boolean; equipped?: string; onClick: () => void; onDouble: () => void }): HTMLElement {
  const d = defOf(st);
  const card = h(
    'button',
    { class: `item-card${opts.selected ? ' selected' : ''}${opts.equipped ? ' equipped' : ''}`, 'data-nav': true, 'data-grid': true, title: `${d.name} (double-click to ${primaryVerb(d, !!opts.equipped)})`, onclick: () => opts.onClick(), ondblclick: () => opts.onDouble() },
    h('span', { class: 'card-pic' }, h('img', { src: itemIconUrl(st.id, st.colour), alt: '', draggable: 'false' }), st.qty > 1 ? h('span', { class: 'qty', text: `×${st.qty}` }) : null),
    h('span', { class: 'card-text' }, h('b', { text: d.name }), h('small', { text: oneLine(d, st) })),
    opts.equipped ? h('span', { class: 'eq-tag' }, icon('check'), opts.equipped) : st.stolen ? h('span', { class: 'stolen', text: 'STOLEN' }) : null,
    d.weapon && st.hits !== undefined ? conditionBar(st.hits, WEAPONS[d.weapon].durability) : null,
  );
  card.style.setProperty('--rarity', RARITY_COLOURS[d.rarity]);
  return card;
}

function primaryVerb(d: ItemDef, equipped: boolean): string {
  if (equipped) return d.weapon ? 'put it away' : 'take it off';
  if (d.use) return 'use it';
  if (d.weapon) return 'hold it';
  if (d.wear) return 'wear it';
  return 'see it';
}

// ---- inventory -----------------------------------------------------------------------------------

export function inventoryScreen(progress: Progress, ui: UIManager, actions: InventoryActions, close: () => void, opts: { atHome: boolean }): Screen {
  const el = h('div', { class: 'screen inv-screen' });
  let filter: Filter = 'all';
  let sort: SortMode = 'category';
  let selected: string | null = null;
  let message = '';
  let bad = false;
  let confirmDrop: string | null = null;

  const say = (t: string, b = false) => {
    message = t;
    bad = b;
  };

  /** Everything you have: in your hands, worn, and in your pockets. */
  type Entry = { st: ItemStack; where: 'held' | WearSlot | 'pocket' };
  const entries = (): Entry[] => {
    const s = progress.save;
    const out: Entry[] = [];
    if (s.held) out.push({ st: s.held, where: 'held' });
    for (const slot of WEAR_SLOTS) if (s.worn[slot]) out.push({ st: s.worn[slot]!, where: slot });
    const pockets = [...s.inventory];
    sortStacks(pockets, sort);
    for (const st of pockets) out.push({ st, where: 'pocket' });
    return out;
  };

  /** The obvious thing to do with an item (double-click, or the highlighted button). */
  const primary = (e: Entry): (() => void) | null => {
    const d = defOf(e.st);
    const uid = e.st.uid;
    if (e.where === 'held') return () => { if (actions.putAway()) { say('Put away'); actions.changed(); } else say('Your pockets are full', true); };
    if (e.where !== 'pocket') return () => { const r = progress.unwear(e.where as WearSlot, false); if (r.ok) { say('Taken off'); actions.changed(); } else say(r.reason, true); };
    if (d.use) return () => { const r = actions.use(uid); say(r.text, !r.ok); actions.changed(); };
    if (d.weapon) return () => { if (actions.hold(uid)) { say(`Holding the ${d.name.toLowerCase()}`); actions.changed(); } else say('Can’t right now', true); };
    if (d.wear) return () => { const r = progress.wear(uid); if (r.ok) { say(`Wearing the ${d.name.toLowerCase()}`); actions.changed(); } else say(r.reason, true); };
    return null;
  };

  const build = (focusUid?: string) => {
    const s = progress.save;
    const all = entries();
    const shown = all.filter((e) => matches(filter, e.st));
    const cap = progress.inventoryCap;
    if (selected && !all.some((e) => e.st.uid === selected)) selected = null;
    if (!selected && shown.length) selected = shown[0].st.uid;
    const sel = all.find((e) => e.st.uid === selected) ?? null;

    const eqLabel = (e: Entry) => (e.where === 'held' ? 'Holding' : e.where === 'pocket' ? undefined : 'Worn');
    const cards = shown.map((e) =>
      itemCard(e.st, {
        selected: e.st.uid === selected,
        equipped: eqLabel(e),
        onClick: () => { selected = e.st.uid; confirmDrop = null; build(e.st.uid); },
        onDouble: () => { const f = primary(e); if (f) { f(); build(); } },
      }),
    );
    if (!cards.length) cards.push(h('div', { class: 'inv-empty', text: filter === 'all' ? 'Nothing on you. Pick things up out there with E.' : 'Nothing of this kind on you.' }));

    // Detail for the selected item: the main action first and highlighted.
    let detail: HTMLElement = h('div', { class: 'detail-panel empty', text: 'Pick an item to see what it does.' });
    if (sel) {
      const st = sel.st;
      const d = defOf(st);
      const acts: HTMLElement[] = [];
      const main = primary(sel);
      const verb = primaryVerb(d, sel.where !== 'pocket');
      if (main) acts.push(menuButton(verb[0].toUpperCase() + verb.slice(1), () => { main(); build(); }, sel.where === 'pocket' && d.wear ? WEAR_SLOT_LABELS[d.wear.slot] : undefined, 'primary'));
      if (sel.where === 'pocket') {
        if (opts.atHome) acts.push(menuButton('Put in the stash', () => { const r = progress.deposit(st.uid); if (r.ok) { say('Put in the stash'); actions.changed(); } else say(r.reason, true); build(); }));
        if (pawnOffer(d, st) > 0 && (d.category === 'valuable' || d.category === 'collectible') && actions.showOnMap) acts.push(menuButton('Where to sell it', () => actions.showOnMap!('pawn_shop'), 'Pawn & Gold, on the map'));
        if (!d.questFlag) {
          if (confirmDrop === st.uid) {
            acts.push(menuButton(`Drop ${st.qty > 1 ? 'all' : 'it'}: sure?`, () => { actions.drop(st.uid, st.qty); confirmDrop = null; say(`Dropped the ${d.name.toLowerCase()}`); actions.changed(); build(); }, d.value >= 50 ? `Worth £${d.value * st.qty}` : undefined, 'danger'));
            acts.push(menuButton('Keep it', () => { confirmDrop = null; build(st.uid); }));
          } else {
            if (st.qty > 1) acts.push(menuButton('Drop one', () => { actions.drop(st.uid, 1); say(`Dropped one ${d.name.toLowerCase()}`); actions.changed(); build(st.uid); }, undefined, 'quiet'));
            acts.push(menuButton(st.qty > 1 ? 'Drop all' : 'Drop', () => { confirmDrop = st.uid; build(st.uid); }, undefined, 'quiet'));
          }
        }
      } else if (sel.where !== 'held' && opts.atHome) {
        acts.push(menuButton('Take off into the stash', () => { const r = progress.unwear(sel.where as WearSlot, true); if (r.ok) { say('In the stash'); actions.changed(); } else say(r.reason, true); build(); }));
      }
      detail = detailPanel(d, st, acts, sel.where === 'pocket' ? compareBlock(progress, d) : null);
      if (sel.where !== 'pocket') detail.querySelector('.detail-title')?.append(h('div', { class: 'eq-now' }, icon('check'), sel.where === 'held' ? 'Holding it' : `Wearing (${WEAR_SLOT_LABELS[sel.where as WearSlot]})`));
    }

    const used = s.inventory.length;
    el.replaceChildren(
      h('div', { class: 'inv-top' },
        h('div', { class: 'inv-title' }, icon('bag'), h('h2', { text: 'Inventory' })),
        h('span', { class: 'wallet', text: `£${s.cash.pocket} on you · £${s.cash.bank} in the tin` }),
        h('span', { class: `cap${used >= cap ? ' full' : ''}` }, h('i', { class: 'cap-bar' }, h('i', { style: `width:${Math.min(100, (used / cap) * 100)}%` })), `${used}/${cap} pockets`),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', title: 'Close (Esc / I)', onclick: close }, icon('close')),
      ),
      tabsRow(filter, countBy(all.map((e) => e.st)), (f) => { filter = f; selected = null; build(); }),
      h('div', { class: 'inv-body' },
        h('div', { class: 'inv-left' }, h('div', { class: 'item-list' }, ...cards)),
        h('div', { class: 'inv-right' }, detail, h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message })),
      ),
      h('div', { class: 'panel-actions slim' },
        h('span', { class: 'hint', text: 'Double-click an item to use, hold or wear it' }),
        menuButton(`Sort: ${SORTS.find((x) => x.id === sort)!.label}`, () => { sort = SORTS[(SORTS.findIndex((x) => x.id === sort) + 1) % SORTS.length].id; build(); }, undefined, 'quiet'),
      ),
    );
    if (focusUid) ui.focusElement(el.querySelector('.item-card.selected') as HTMLElement | null);
    else ui.keepFocus();
  };
  return {
    el,
    onShow: () => build(),
    onBack: close,
    onAction: (a) => {
      if (a === 'pause' || a === 'inventory') {
        close();
        return true;
      }
      return false;
    },
  };
}

// ---- stash at home -----------------------------------------------------------------------------

export function storageScreen(progress: Progress, ui: UIManager, changed: () => void, close: () => void): Screen {
  const el = h('div', { class: 'screen inv-screen stash' });
  let filter: Filter = 'all';
  let sort: SortMode = 'category';
  let side: 'pockets' | 'stash' = 'stash';
  let selected: string | null = null;
  let message = '';
  let bad = false;
  const say = (t: string, b = false) => {
    message = t;
    bad = b;
  };

  const build = (focusSel = false) => {
    const s = progress.save;
    const pockets = [...s.inventory];
    const stash = [...s.storage];
    sortStacks(pockets, sort);
    sortStacks(stash, sort);
    const match = (x: ItemStack) => filter === 'all' || defOf(x).category === filter;
    const grid = (list: ItemStack[], which: 'pockets' | 'stash') =>
      list.filter(match).map((st) => itemTile(st, { selected: st.uid === selected, onClick: () => { selected = st.uid; side = which; build(true); } }));

    const st = (side === 'stash' ? s.storage : s.inventory).find((x) => x.uid === selected) ?? null;
    let detail: HTMLElement = h('div', { class: 'detail-panel empty', text: 'Pick something to move it between your pockets and the stash.' });
    if (st) {
      const d = defOf(st);
      const acts: HTMLElement[] = [];
      if (side === 'stash') {
        acts.push(menuButton(st.qty > 1 ? 'Take one' : 'Take it', () => { const r = progress.withdraw(st.uid, 1); say(r.ok ? 'Taken' : r.reason, !r.ok); if (r.ok) changed(); build(); }));
        if (st.qty > 1) acts.push(menuButton(`Take all ${st.qty}`, () => { const r = progress.withdraw(st.uid); say(r.ok ? 'Taken' : r.reason, !r.ok); if (r.ok) changed(); build(); }));
        if (d.wear) acts.push(menuButton('Wear it', () => { const r = progress.wear(st.uid, true); say(r.ok ? 'Wearing it' : r.reason, !r.ok); if (r.ok) changed(); build(); }));
      } else {
        acts.push(menuButton(st.qty > 1 ? 'Store one' : 'Store it', () => { const r = progress.deposit(st.uid, 1); say(r.ok ? 'Stored' : r.reason, !r.ok); if (r.ok) changed(); build(); }));
        if (st.qty > 1) acts.push(menuButton(`Store all ${st.qty}`, () => { const r = progress.deposit(st.uid); say(r.ok ? 'Stored' : r.reason, !r.ok); if (r.ok) changed(); build(); }));
      }
      detail = detailPanel(d, st, acts);
    }

    el.replaceChildren(
      h('div', { class: 'inv-top' }, h('h2', { text: 'Stash' }), h('span', { class: 'cap', text: `Stash ${s.storage.length} / ${s.storageCap} · Pockets ${s.inventory.length} / ${progress.inventoryCap}` })),
      tabsRow(filter, countBy([...s.inventory, ...s.storage]), (f) => { filter = f; build(); }),
      h(
        'div',
        { class: 'inv-body' },
        h(
          'div',
          { class: 'inv-left' },
          h('div', { class: 'eq-title', text: 'In the stash' }),
          h('div', { class: 'item-grid tall' }, ...grid(stash, 'stash')),
          h('div', { class: 'eq-title', text: 'In your pockets' }),
          h('div', { class: 'item-grid' }, ...grid(pockets, 'pockets')),
        ),
        h('div', { class: 'inv-right' }, detail, h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message })),
      ),
      h(
        'div',
        { class: 'panel-actions' },
        menuButton('Store everything', () => {
          let n = 0;
          // Never auto-store quest items, the weapon in your hands or bags (they hold your pockets open).
          for (const x of [...s.inventory]) if (!ITEMS[x.id].questFlag && !x.id.startsWith('bag_') && progress.deposit(x.uid).ok) n++;
          say(n ? `Stored ${n} stack${n === 1 ? '' : 's'}` : 'Nothing to store');
          if (n) changed();
          build();
        }, 'Except quest items and bags'),
        s.storageCap < STORAGE_UPGRADE.max
          ? menuButton(`More shelving (+${STORAGE_UPGRADE.slots})`, () => { const r = progress.buyStorageUpgrade(); say(r.ok ? 'Shelving up. More room in the stash.' : r.reason, !r.ok); if (r.ok) changed(); build(); }, `£${STORAGE_UPGRADE.cost} from the tin`)
          : null,
        menuButton(`Sort: ${SORTS.find((x) => x.id === sort)!.label}`, () => { sort = SORTS[(SORTS.findIndex((x) => x.id === sort) + 1) % SORTS.length].id; build(); }),
        menuButton('Close', close),
      ),
    );
    if (focusSel) ui.focusElement(el.querySelector('.item-tile.selected') as HTMLElement | null);
    else ui.keepFocus();
  };
  return { el, onShow: () => build(), onBack: close };
}

// ---- pawn shop ----------------------------------------------------------------------------------

/** What the pawnbroker offers for one: about 55% of value, less if stolen or rare and hot. */

export function pawnScreen(progress: Progress, ui: UIManager, changed: () => void, close: () => void, opts: { rob?: () => void; priceMult?: number } = {}): Screen {
  const el = h('div', { class: 'screen inv-screen pawn' });
  let selected: string | null = null;
  let qty = 1;
  let message = '';
  let bad = false;
  let confirmAll = false;
  let confirmRob = false;
  // After you've robbed him he still buys, but he remembers: offers drop by the same margin.
  const mult = opts.priceMult ?? 1;
  const offerFor = (x: ItemStack) => {
    const base = pawnOffer(defOf(x), x);
    return base > 0 ? Math.max(1, Math.round(base / mult)) : 0;
  };
  const say = (t: string, b = false) => {
    message = t;
    bad = b;
  };
  const sellable = () => progress.save.inventory.filter((x) => offerFor(x) > 0);

  const build = (focusSel = false) => {
    const s = progress.save;
    const list = sellable();
    sortStacks(list, 'value');
    if (selected && !list.some((x) => x.uid === selected)) selected = null;
    if (!selected && list.length) selected = list[0].uid;
    const st = list.find((x) => x.uid === selected) ?? null;
    const valuables = list.filter((x) => ['valuable', 'collectible'].includes(defOf(x).category));
    const allTotal = valuables.reduce((n, x) => n + offerFor(x) * x.qty, 0);

    let detail: HTMLElement = h('div', { class: 'detail-panel empty', text: 'Nothing he’ll buy. Watches, chains, phones, coins and collectibles turn up on the streets, in bins and on beaten enemies.' });
    if (st) {
      const d = defOf(st);
      qty = Math.max(1, Math.min(qty, st.qty));
      const each = offerFor(st);
      const offer = h(
        'div',
        { class: 'offer' },
        statLine('Worth', `£${d.value}`),
        statLine('He offers', `£${each} each${st.stolen ? ' (stolen: knocked down)' : ''}`),
        statLine('Selling', `${qty} of ${st.qty}`),
        h('div', { class: 'offer-total', text: `£${each * qty}` }),
      );
      const acts: HTMLElement[] = [];
      if (st.qty > 1) {
        acts.push(menuButton('One less', () => { qty = Math.max(1, qty - 1); build(); }), menuButton('One more', () => { qty = Math.min(st.qty, qty + 1); build(); }));
      }
      acts.push(menuButton(`Sell for £${each * qty}`, () => {
        const r = progress.sell(st.uid, qty, each);
        if (r.ok) {
          say(`Sold ${qty > 1 ? `${qty} × ` : ''}${d.name} for £${each * qty}. "Pleasure doing business."`);
          changed();
          qty = 1;
        } else say(r.reason, true);
        build();
      }, undefined, 'primary'));
      detail = h('div', {}, detailPanel(d, st, acts), offer);
    }
    el.replaceChildren(
      h('div', { class: 'inv-top' }, h('h2', { text: 'Pawn & Gold' }), h('span', { class: 'wallet', text: `£${s.cash.pocket} on you` }), h('span', { class: 'cap', text: `Sold so far: ${s.pawn.itemsSold} items, £${s.pawn.earned}` })),
      h('p', { class: 'hint', text: '"Let’s see what you’ve got. I don’t ask questions, but I don’t pay full whack for hot gear either."' }),
      h('p', { class: 'warn-line', text: mult > 1 ? `Mr Kaur hasn’t forgotten. He offers you ${Math.round((1 - 1 / mult) * 100)}% less than he would.` : '' }),
      h(
        'div',
        { class: 'inv-body' },
        h('div', { class: 'inv-left' }, h('div', { class: 'item-grid' }, ...list.map((x) => itemTile(x, { selected: x.uid === selected, price: `£${offerFor(x)}`, onClick: () => { selected = x.uid; qty = 1; build(true); } })))),
        h('div', { class: 'inv-right' }, detail, h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message })),
      ),
      h(
        'div',
        { class: 'panel-actions' },
        valuables.length
          ? confirmAll
            ? menuButton(`Sell ${valuables.length} valuables for £${allTotal}: sure?`, () => {
                let total = 0;
                for (const x of valuables) {
                  const each = offerFor(x);
                  const n = x.qty;
                  if (progress.sell(x.uid, n, each).ok) total += each * n;
                }
                confirmAll = false;
                say(`Sold the lot for £${total}.`);
                changed();
                build();
              }, 'Valuables and collectibles only', 'danger')
            : menuButton(`Sell all valuables (£${allTotal})`, () => { confirmAll = true; build(); })
          : null,
        opts.rob
          ? confirmRob
            ? menuButton('Do it: rob the shop', () => opts.rob!(), 'Grab from the cabinets. Alarm, police and heat follow.', 'danger')
            : menuButton('Rob the shop…', () => { confirmRob = true; build(); }, 'Think about it first')
          : null,
        menuButton('Leave', close),
      ),
    );
    if (focusSel) ui.focusElement(el.querySelector('.item-tile.selected') as HTMLElement | null);
    else ui.keepFocus();
  };
  return { el, onShow: () => build(), onBack: close };
}

// ---- clothes shop -------------------------------------------------------------------------------

export interface ShopActions {
  /** Show this look on the model (null: back to what you're wearing). */
  preview(itemId: string | null, colour?: string): void;
  rotate(dir: number): void;
  zoom(): void;
  changed(): void;
  rob(): void;
  /** Price multiplier for you (goes up after a robbery). */
  priceMult: number;
}


const SHOP_SECTIONS: { id: string; label: string; test: (d: ItemDef) => boolean }[] = [
  { id: 'tops', label: 'Tops & jackets', test: (d) => d.wear?.slot === 'top' },
  { id: 'bottoms', label: 'Bottoms', test: (d) => d.wear?.slot === 'bottoms' },
  { id: 'shoes', label: 'Footwear', test: (d) => d.wear?.slot === 'shoes' },
  { id: 'acc', label: 'Accessories', test: (d) => d.category === 'accessory' },
  { id: 'bags', label: 'Bags', test: (d) => d.id.startsWith('bag_') },
];


export function clothesShopScreen(progress: Progress, ui: UIManager, a: ShopActions, close: () => void): Screen {
  const el = h('div', { class: 'screen shop-screen' });
  let section = SHOP_SECTIONS[0].id;
  let selected: string = SHOP_STOCK.find((id) => SHOP_SECTIONS[0].test(ITEMS[id]))!;
  let message = '';
  let bad = false;
  let confirmRob = false;

  const owned = (id: string) => progress.owns(id);
  const build = (focusSel = false) => {
    const s = progress.save;
    const sec = SHOP_SECTIONS.find((x) => x.id === section)!;
    const stock = SHOP_STOCK.filter((id) => ITEMS[id] && sec.test(ITEMS[id]));
    const d = ITEMS[selected];
    const price = shopPrice(d, a.priceMult);
    const wornSlot = d.wear?.slot as WearSlot | undefined;
    const current = wornSlot ? s.worn[wornSlot] : null;
    const tiles = stock.map((id) => {
      const st: ItemStack = { uid: id, id, qty: 1 };
      return itemTile(st, { selected: id === selected, tag: owned(id) ? 'OWNED' : undefined, price: `£${shopPrice(ITEMS[id], a.priceMult)}`, onClick: () => { selected = id; confirmRob = false; a.preview(id); build(true); } });
    });
    const canAfford = s.cash.pocket + s.cash.bank >= price;
    const acts: HTMLElement[] = [
      menuButton(owned(selected) ? `Buy another (£${price})` : `Buy (£${price})`, () => {
        const r = buyItem(progress, selected, a.priceMult);
        if (!r.ok) {
          message = r.reason;
          bad = true;
          return build();
        }
        message = r.where === 'storage' ? `Bought. Your pockets were full, so Priya’s sending it round to yours (in your stash).` : `Bought the ${d.name.toLowerCase()}.`;
        bad = false;
        a.changed();
        build();
      }, canAfford ? 'Pays from your pocket, then the tin' : 'Not enough money', canAfford ? 'primary' : ''),
    ];
    if (d.wear && owned(selected)) {
      const carriedSt = s.inventory.find((x) => x.id === selected) ?? s.storage.find((x) => x.id === selected);
      if (carriedSt && current?.id !== selected) acts.push(menuButton('Wear it now', () => {
        const r = progress.wear(carriedSt.uid, !s.inventory.includes(carriedSt));
        message = r.ok ? 'Looking sharp.' : r.reason;
        bad = !r.ok;
        a.changed();
        a.preview(null);
        build();
      }));
    }
    acts.push(menuButton('Back to my own clothes', () => { a.preview(null); build(); }, 'Stop previewing'));
    const compare = current && current.id !== selected ? h('div', { class: 'compare' }, h('div', { class: 'compare-title', text: `You’re wearing: ${defOf(current).name}` })) : null;
    el.replaceChildren(
      h('div', { class: 'shop-head' }, h('h2', { text: 'Threads' }), h('span', { class: 'wallet', text: `£${s.cash.pocket} on you · £${s.cash.bank} in the tin` })),
      h('p', { class: 'warn-line', text: a.priceMult > 1 ? `Priya remembers you. Everything’s ${Math.round((a.priceMult - 1) * 100)}% dearer for you now.` : '' }),
      h('div', { class: 'inv-tabs' }, ...SHOP_SECTIONS.map((x) => h('button', { class: `inv-tab${x.id === section ? ' on' : ''}`, 'data-nav': true, 'data-grid': true, onclick: () => { section = x.id; selected = SHOP_STOCK.find((id) => ITEMS[id] && x.test(ITEMS[id]))!; a.preview(selected); build(); } }, x.label))),
      h('div', { class: 'shop-body' }, h('div', { class: 'item-grid' }, ...tiles), h('div', { class: 'inv-right' }, detailPanel(d, null, acts, compare), h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message }))),
      h(
        'div',
        { class: 'panel-actions' },
        menuButton('↺ Turn', () => a.rotate(-1)),
        menuButton('Turn ↻', () => a.rotate(1)),
        menuButton('Zoom', () => a.zoom()),
        confirmRob
          ? menuButton('Do it: rob the shop', () => a.rob(), 'Grab the till and clothes. Alarm, police and heat follow.', 'danger')
          : menuButton('Rob the shop…', () => { confirmRob = true; build(); }, 'Think about it first'),
        menuButton('Leave', close),
      ),
    );
    if (focusSel) ui.focusElement(el.querySelector('.item-tile.selected') as HTMLElement | null);
    else ui.keepFocus();
  };
  return {
    el,
    onShow: () => {
      a.preview(selected);
      build();
    },
    onBack: close,
  };
}
