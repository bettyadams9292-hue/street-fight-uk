import type { Progress } from '../progress/Progress';
import { ITEMS } from '../items/items';
import { WEAPONS } from '../combat/Weapons';
import { MOD_KEYS, MOD_LABELS, maxDurability, modLimit, upgradedWeapon } from '../combat/weaponMods';
import {
  MATERIAL_IDS,
  RECIPES,
  SUPPLIES,
  benchWeapons,
  buySupply,
  countItem,
  craftWeapon,
  hasMaterials,
  materialsText,
  repairQuote,
  repairWeapon,
  salvageQuote,
  salvageWeapon,
  upgradeQuote,
  upgradeWeapon,
  type BenchWeapon,
} from '../workshop/workshop';
import { menuButton } from './controls';
import { h } from './dom';
import { panelScreen, result } from './hub';
import type { Screen } from './UIManager';

/** The garage workbench: Repair, Craft, Upgrade, and Materials (order basics, salvage). */
export function workshopScreen(progress: Progress, close: () => void, changed: () => void): Screen {
  let tab: 'repair' | 'craft' | 'upgrade' | 'materials' = 'repair';
  let sel: string | null = null;
  const money = (n: number) => `£${n}`;
  return panelScreen('Workbench', progress, (msg, rebuild) => {
    const tabs = h('div', { class: 'prop-tabs' }, ...([['repair', 'Repair'], ['craft', 'Craft'], ['upgrade', 'Upgrade'], ['materials', 'Materials']] as const).map(([id, name]) =>
      h('button', { class: `prop-tab${tab === id ? ' on' : ''}`, 'data-nav': true, text: name, onclick: () => ((tab = id), rebuild()) })));
    const mats = h('div', { class: 'mat-strip' }, ...MATERIAL_IDS.map((id) => h('span', { class: 'mat', title: ITEMS[id].text }, h('i', { style: `background:${ITEMS[id].colour}` }), `${ITEMS[id].name} ×${countItem(progress, id)}`)));
    const rows: HTMLElement[] = [tabs, mats];
    const weapons = benchWeapons(progress);
    const wName = (b: BenchWeapon) => `${ITEMS[b.st.id].name}${b.st.crafted ? ' (made here)' : ''}`;
    const where = (b: BenchWeapon) => (b.where === 'hands' ? 'in your hands' : b.where === 'pockets' ? 'in your pockets' : 'in the stash');
    const done = (r: { ok: true } | { ok: false; reason: string }, good: string) => {
      result(r, good, msg, changed);
      rebuild();
    };

    if (tab === 'repair') {
      rows.push(h('p', { class: 'hint', text: 'Every swing that lands wears a weapon down; when it’s worn out it’s gone. Repairs take money and tape or bolts. Things that smash (bottles, chairs) can’t be fixed.' }));
      if (!weapons.length) rows.push(h('p', { text: 'No weapons here. Bring some home, or keep spares in the stash.' }));
      for (const b of weapons) {
        const q = repairQuote(b.st);
        const max = maxDurability(b.id, b.st.mods);
        const now = b.st.hits ?? max;
        const cond = h('div', { class: 'cond' }, h('div', { class: 'stat-bar' }, h('i', { style: `width:${(now / max) * 100}%` })), h('em', { text: q && q.cash ? `${now}/${max} → ${max}/${max}` : `${now}/${max}` }));
        const btn = !q ? h('span', { class: 'owned-tag', text: 'Can’t fix' })
          : q.cash === 0 ? h('span', { class: 'owned-tag', text: 'Good as new' })
          : menuButton(`Fix ${money(q.cash)}`, () => done(repairWeapon(progress, b.st), `${ITEMS[b.st.id].name} fixed: ${max}/${max}`), `+ ${materialsText(q.materials)}${hasMaterials(progress, q.materials) ? '' : ' (missing)'}`, 'small');
        rows.push(h('div', { class: 'shop-row bench-row' }, h('div', { class: 'what' }, h('b', { text: wName(b) }), h('span', { text: where(b) }), cond), btn));
      }
    } else if (tab === 'craft') {
      rows.push(h('p', { class: 'hint', text: 'Make weapons from materials. Some come out better than shop-bought. New ones go in your pockets (or the stash if they’re full).' }));
      for (const r of RECIPES) {
        const w = WEAPONS[r.weapon];
        const can = hasMaterials(progress, r.materials);
        const bonus = r.bonus ? ` Comes with +1 ${MOD_LABELS[Object.keys(r.bonus)[0] as keyof typeof MOD_LABELS].name.toLowerCase()}.` : '';
        const btn = menuButton(`Make ${money(r.cash)}`, () => done(craftWeapon(progress, r), `Made a ${w.name.toLowerCase()}`), can ? 'You have the materials' : 'Missing materials', 'small');
        if (!can) btn.classList.add('dim');
        rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: w.name }), h('span', { text: `${w.text}${bonus}` }), h('span', { class: can ? 'req ok' : 'req', text: `Needs ${materialsText(r.materials)}` })), btn));
      }
    } else if (tab === 'upgrade') {
      rows.push(h('p', { class: 'hint', text: 'Upgrades change how the weapon actually fights. Each kind of weapon can go so far; each level costs more and needs better materials.' }));
      const ups = weapons.filter((b) => MOD_KEYS.some((k) => modLimit(b.id, k) > 0));
      if (!ups.length) rows.push(h('p', { text: 'Nothing here that can be upgraded (bottles, bricks and chairs can’t).' }));
      if (sel && !ups.some((b) => b.st.uid === sel)) sel = null;
      const cur = ups.find((b) => b.st.uid === sel) ?? ups[0];
      if (cur) {
        sel = cur.st.uid;
        rows.push(h('div', { class: 'prop-tabs' }, ...ups.map((b) => h('button', { class: `prop-tab${b.st.uid === sel ? ' on' : ''}`, text: ITEMS[b.st.id].name, onclick: () => ((sel = b.st.uid), rebuild()) }))));
        const base = WEAPONS[cur.id];
        const up = upgradedWeapon(cur.id, cur.st.mods);
        rows.push(h('p', { class: 'hint', text: `${wName(cur)}, ${where(cur)}. Damage ${up.light.damage}/${up.heavy.damage} (base ${base.light.damage}/${base.heavy.damage}) · startup ${up.light.startup}/${up.heavy.startup} frames · ${up.durability} swings · stamina ${up.light.staminaCost}/${up.heavy.staminaCost}` }));
        for (const k of MOD_KEYS) {
          const lim = modLimit(cur.id, k);
          const lvl = cur.st.mods?.[k] ?? 0;
          const label = `${MOD_LABELS[k].name}  ${'▮'.repeat(lvl)}${'▯'.repeat(Math.max(0, lim - lvl))}`;
          if (lim === 0) {
            rows.push(h('div', { class: 'shop-row owned' }, h('div', { class: 'what' }, h('b', { text: MOD_LABELS[k].name }), h('span', { text: 'Not possible on this weapon' })), h('span', { text: '' })));
            continue;
          }
          if (lvl >= lim) {
            rows.push(h('div', { class: 'shop-row owned' }, h('div', { class: 'what' }, h('b', { text: label }), h('span', { text: MOD_LABELS[k].per })), h('span', { class: 'owned-tag', text: 'Maxed' })));
            continue;
          }
          const q = upgradeQuote(cur.id, k, lvl + 1);
          const can = hasMaterials(progress, q.materials);
          const btn = menuButton(`Level ${lvl + 1}: ${money(q.cash)}`, () => done(upgradeWeapon(progress, cur.st, k), `${ITEMS[cur.st.id].name}: ${MOD_LABELS[k].name.toLowerCase()} level ${lvl + 1}`), `+ ${materialsText(q.materials)}`, 'small');
          if (!can) btn.classList.add('dim');
          rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: label }), h('span', { text: MOD_LABELS[k].per }), h('span', { class: can ? 'req ok' : 'req', text: `Needs ${materialsText(q.materials)}` })), btn));
        }
      }
    } else {
      rows.push(h('p', { class: 'hint', text: 'Basics can be ordered in. Steel, leather, spring steel and carbon fibre turn up in skips, cars, and on tougher opponents, or come from salvaging weapons.' }));
      for (const s of SUPPLIES) {
        rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: ITEMS[s.id].name }), h('span', { text: `You have ${countItem(progress, s.id)}. Delivered to the stash.` })),
          h('div', { class: 'row-actions' },
            menuButton(`1 for ${money(s.price)}`, () => done(buySupply(progress, s.id, 1), `${ITEMS[s.id].name} delivered`), undefined, 'small'),
            menuButton(`5 for ${money(s.price * 5)}`, () => done(buySupply(progress, s.id, 5), `5 × ${ITEMS[s.id].name.toLowerCase()} delivered`), undefined, 'small'))));
      }
      rows.push(h('h3', { text: 'Salvage' }));
      const spare = weapons.filter((b) => b.where !== 'hands');
      if (!spare.length) rows.push(h('p', { class: 'hint', text: 'No spare weapons to break down (the one in your hands doesn’t count).' }));
      for (const b of spare) {
        const got = salvageQuote(b.id);
        rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: wName(b) }), h('span', { text: `${where(b)} → ${materialsText(got)}` })),
          menuButton('Break down', () => {
            const r = salvageWeapon(progress, b.st.uid);
            if (r.ok) {
              changed();
              msg(`Got ${materialsText(r.got)}`);
            } else msg(r.reason, true);
            rebuild();
          }, undefined, 'small')));
      }
    }
    return rows;
  }, close);
}
