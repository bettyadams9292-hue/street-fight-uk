import type { Progress } from '../progress/Progress';
import {
  BUSINESS_UPGRADES,
  EQUIPMENT,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_LIST,
  IMPROVEMENTS,
  MAX_UPGRADE,
  OWED_LIMIT,
  STARTUP_FEE,
  TIERS,
  UPGRADE_KEYS,
  equipmentResale,
  type EquipmentCategory,
  type EquipmentDef,
} from '../business/catalogue';
import {
  buyEquipment,
  buyImprovement,
  buyTier,
  buyUpgrade,
  repairCost,
  repairEquipment,
  sellEquipment,
  uninstallEquipment,
} from '../business/basement';
import {
  STATUS_TEXT,
  businessStats,
  businessStatus,
  payBills,
  sellStock,
  setPaused,
  startBusiness,
  tickBusiness,
  withdraw,
  type BusinessStats,
} from '../business/production';
import { menuButton } from './controls';
import { h } from './dom';
import { panelScreen, result } from './hub';
import { previewCanvas } from './propPreview';
import type { Screen } from './UIManager';

/**
 * Green Fingers (the grow shop) and the basement's business terminal. Every
 * button goes through business/basement.ts or business/production.ts, which
 * take the money and change the save.
 */

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const tierName = ['', 'Starter', 'Intermediate', 'Professional'];

type ShopTab = EquipmentCategory | 'upgrades' | 'basement';

function tabs<T extends string>(items: { id: T; name: string }[], current: T, pick: (id: T) => void): HTMLElement {
  return h('div', { class: 'prop-tabs' }, ...items.map((it) => h('button', { class: `prop-tab${it.id === current ? ' on' : ''}`, 'data-nav': true, text: it.name, onclick: () => pick(it.id) })));
}

/** What this piece would change, in the numbers the business cares about. */
function effectLine(def: EquipmentDef, st: BusinessStats): string {
  const bits: string[] = [];
  if (def.cap) bits.push(`capacity ${st.capacity} → ${st.capacity + def.cap}`);
  if (def.light) bits.push(`light ${st.light} → ${st.light + def.light}`);
  if (def.air) bits.push(`air ${st.air} → ${st.air + def.air}`);
  if (def.eff) bits.push(`+${Math.round(def.eff * 100)}% efficiency`);
  if (def.auto) bits.push(`automation ${st.automation} → ${Math.min(4, st.automation + def.auto)}`);
  if (def.sec) bits.push(`security ${st.security} → ${Math.min(100, st.security + def.sec)}`);
  if (def.storage) bits.push(`storage ${st.storage} → ${st.storage + def.storage}`);
  if (def.power) bits.push(`power ${st.power} → ${Math.round((st.power + def.power) * 100) / 100} of ${st.supply} kW`);
  if (def.op) bits.push(`running cost +£${def.op}/hr`);
  return bits.join(' · ');
}

/** £ per unit of what it does, so like-for-like kit can be compared. */
function valueLine(def: EquipmentDef): string {
  const k = def.cap ? ['capacity', def.cap] : def.light ? ['light', def.light] : def.air ? ['air', def.air] : def.storage ? ['storage', def.storage] : def.sec ? ['security', def.sec] : null;
  return k ? `${money(def.price / (k[1] as number))} per point of ${k[0]}` : '';
}

/** Two clicks to spend money: the first arms the button, the second buys. */
function confirmButton(label: string, confirmText: string, armed: boolean, arm: () => void, go: () => void, cls?: string): HTMLElement {
  return menuButton(armed ? confirmText : label, armed ? go : arm, armed ? 'Click again to confirm' : undefined, cls);
}

// ---- the grow shop --------------------------------------------------------------------------------

export function growShopScreen(progress: Progress, close: () => void, saved: () => void, startTab: string = 'room'): Screen {
  let tab: ShopTab = (EQUIPMENT_CATEGORIES.some((c) => c.id === startTab) ? startTab : 'room') as ShopTab;
  let sel = EQUIPMENT_LIST.find((e) => e.cat === tab)?.id ?? 'tent_s';
  let qty = 1;
  let armed: string | null = null;
  return panelScreen('Green Fingers Hydroponics', progress, (msg, rebuild) => {
    const b = progress.save.basement;
    const st = businessStats(b);
    const rows: HTMLElement[] = [
      h('p', { class: 'hint', text: 'Everything is delivered to your basement storage. Install it from the terminal down there.' }),
      tabs(EQUIPMENT_CATEGORIES, tab, (t) => {
        tab = t;
        armed = null;
        qty = 1;
        if (t !== 'upgrades' && t !== 'basement') sel = EQUIPMENT_LIST.find((e) => e.cat === t)!.id;
        rebuild();
      }),
    ];
    const done = (r: { ok: true } | { ok: false; reason: string }, good: string) => {
      armed = null;
      result(r, good, msg, saved);
      rebuild();
    };
    if (tab === 'upgrades') {
      rows.push(upgradesBlock(progress, armed, (k) => ((armed = k), rebuild()), done));
      return rows;
    }
    if (tab === 'basement') {
      rows.push(basementWorksBlock(progress, armed, (k) => ((armed = k), rebuild()), done));
      return rows;
    }
    const def = EQUIPMENT[sel];
    const owned = (id: string) => b.equipment.filter((e) => e.id === id);
    const list = h('div', { class: 'prop-list' }, ...EQUIPMENT_LIST.filter((e) => e.cat === tab).map((e) => {
      const o = owned(e.id);
      return h('button', { class: `prop-item${e.id === sel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((sel = e.id), (qty = 1), (armed = null), rebuild()) },
        h('b', { text: e.name }), h('span', { text: `${money(e.price)} · ${tierName[e.tier]}${o.length ? ` · own ${o.length} (${o.filter((x) => x.at).length} installed)` : ''}` }));
    }));
    const mine = owned(def.id);
    const spare = mine.find((x) => !x.at);
    const total = def.price * qty;
    const short = progress.save.cash.pocket + progress.save.cash.bank < total;
    const detail = h('div', { class: 'prop-detail' },
      previewCanvas(def.id, ''),
      h('h3', { text: `${def.name} — ${money(def.price)}` }),
      h('p', { class: 'hint', text: `${tierName[def.tier]} kit. ${def.blurb}` }),
      h('p', { class: 'hint', text: `With one more: ${effectLine(def, st)}` }),
      valueLine(def) ? h('p', { class: 'hint', text: valueLine(def) }) : null,
      h('p', { class: 'hint', text: mine.length ? `You own ${mine.length}: ${mine.filter((x) => x.at).length} installed, ${mine.filter((x) => !x.at).length} in storage.` : 'You don’t own one yet.' }),
      short ? h('p', { class: 'hub-warn', text: `Not enough money for ${qty > 1 ? `${qty} of these` : 'this'} (${money(total)}).` }) : null,
      h('div', { class: 'qty-row' },
        menuButton('−', () => ((qty = Math.max(1, qty - 1)), (armed = null), rebuild()), undefined, 'small'),
        h('span', { text: `× ${qty}` }),
        menuButton('+', () => ((qty = Math.min(10, qty + 1)), (armed = null), rebuild()), undefined, 'small'),
        confirmButton(`Buy ${money(total)}`, `Confirm ${money(total)}`, armed === `buy:${def.id}`, () => ((armed = `buy:${def.id}`), rebuild()),
          () => done(buyEquipment(progress, def.id, qty), `${qty > 1 ? `${qty} × ` : ''}${def.name} delivered to the basement`)),
        spare ? menuButton(`Sell one ${money(equipmentResale(def.price))}`, () => {
          const r = sellEquipment(progress, spare.uid);
          if (r.ok) {
            saved();
            msg(`Sold for ${money(r.refund)}`);
          } else msg(r.reason, true);
          rebuild();
        }, 'From storage', 'small') : null,
      ),
    );
    rows.push(h('div', { class: 'prop-shop' }, list, detail));
    return rows;
  }, close);
}

function upgradesBlock(progress: Progress, armed: string | null, arm: (k: string) => void, done: (r: { ok: true } | { ok: false; reason: string }, good: string) => void): HTMLElement {
  const b = progress.save.basement;
  return h('div', {},
    h('p', { class: 'hint', text: 'Upgrades apply to the whole operation straight away; nothing to install.' }),
    ...UPGRADE_KEYS.map((k) => {
      const u = BUSINESS_UPGRADES[k];
      const lvl = b.upgrades[k];
      const maxed = lvl >= MAX_UPGRADE;
      const cost = maxed ? 0 : u.cost[lvl];
      const btn = maxed ? menuButton('Maxed', () => undefined) : confirmButton(money(cost), `Confirm ${money(cost)}`, armed === `up:${k}`, () => arm(`up:${k}`), () => done(buyUpgrade(progress, k), `${u.name} level ${lvl + 1}`));
      if (maxed) btn.setAttribute('disabled', '');
      return h('div', { class: `shop-row${maxed ? ' owned' : ''}` }, h('div', { class: 'what' }, h('b', { text: `${u.name} — level ${lvl}/${MAX_UPGRADE}` }), h('span', { text: u.per })), btn);
    }),
  );
}

function basementWorksBlock(progress: Progress, armed: string | null, arm: (k: string) => void, done: (r: { ok: true } | { ok: false; reason: string }, good: string) => void): HTMLElement {
  const b = progress.save.basement;
  const next = TIERS[b.tier + 1];
  const rows: HTMLElement[] = [h('p', { class: 'hint', text: `Now: ${TIERS[b.tier].name} (${TIERS[b.tier].width} m long). Builders start straight away.` })];
  if (next) {
    rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: next.name }), h('span', { text: next.blurb })),
      confirmButton(money(next.price), `Confirm ${money(next.price)}`, armed === 'tier', () => arm('tier'), () => done(buyTier(progress), `${next.name} done`))));
  } else rows.push(h('p', { text: 'The basement is as big and as smart as it gets.' }));
  rows.push(h('h3', { text: 'Improvements' }));
  for (const imp of IMPROVEMENTS) {
    const have = b.improvements.includes(imp.id);
    const locked = b.tier < imp.needsTier;
    const btn = have || locked
      ? menuButton(have ? 'Done' : `Needs ${TIERS[imp.needsTier].name.toLowerCase()}`, () => undefined)
      : confirmButton(money(imp.price), `Confirm ${money(imp.price)}`, armed === `imp:${imp.id}`, () => arm(`imp:${imp.id}`), () => done(buyImprovement(progress, imp.id), `${imp.name} done`));
    if (have || locked) btn.setAttribute('disabled', '');
    rows.push(h('div', { class: `shop-row${have ? ' owned' : ''}` }, h('div', { class: 'what' }, h('b', { text: imp.name }), h('span', { text: imp.blurb })), btn));
  }
  return h('div', {}, ...rows);
}

// ---- the terminal ---------------------------------------------------------------------------------

type TermTab = 'overview' | 'equipment' | 'finances' | 'upgrades' | 'basement';

/**
 * The laptop on the desk by the stairs. `place(uid)` starts the placement
 * editor for a piece of equipment; `rebuilt()` reloads the basement after
 * works that change the room.
 */
export function terminalScreen(progress: Progress, close: () => void, saved: () => void, place: (uid: string) => void, rebuilt: () => void): Screen {
  let tab: TermTab = 'overview';
  let armed: string | null = null;
  return panelScreen('Business terminal', progress, (msg, rebuild) => {
    const s = progress.save;
    const b = s.basement;
    tickBusiness(b, s.playTime, s.heat);
    const st = businessStats(b);
    const status = businessStatus(b, s.playTime, st);
    const bs = b.business;
    const rows: HTMLElement[] = [
      tabs<TermTab>([
        { id: 'overview', name: 'Overview' }, { id: 'equipment', name: 'Equipment' }, { id: 'finances', name: 'Finances' },
        { id: 'upgrades', name: 'Upgrades' }, { id: 'basement', name: 'Basement' },
      ], tab, (t) => ((tab = t), (armed = null), rebuild())),
    ];
    const done = (r: { ok: true } | { ok: false; reason: string }, good: string, rebuildRoom = false) => {
      armed = null;
      result(r, good, msg, saved);
      if (r.ok && rebuildRoom) rebuilt();
      else rebuild();
    };
    const stat = (label: string, value: string, warn = false) => h('div', { class: `biz-stat${warn ? ' warn' : ''}` }, h('span', { text: label }), h('b', { text: value }));
    if (tab === 'overview') {
      const progressPct = st.ready && bs.active ? Math.round((bs.cycle / st.cycleSeconds) * 100) : 0;
      const bar = h('div', { class: 'stat-bar biz-progress' }, h('i', {}));
      (bar.firstChild as HTMLElement).style.width = `${progressPct}%`;
      rows.push(
        h('div', { class: `biz-status ${status}` , text: STATUS_TEXT[status] }),
        h('div', { class: 'biz-grid' },
          stat('Business level', `${st.level} / 5`),
          stat('Stock', `${bs.stock} / ${st.storage} units`, bs.stock >= st.storage),
          stat('Per cycle', `${st.unitsPerCycle} units every ${Math.round(st.cycleSeconds / 60 * 10) / 10} min`),
          stat('Unit value', money(st.unitValue)),
          stat('Running costs', `£${st.opPerHour}/hr`),
          stat('Est. profit', st.ready ? `${money(st.profitPerHour)}/hr of play` : '—'),
          stat('Security', `${st.security} / 100`),
          stat('Power', `${st.power} / ${st.supply} kW`, st.power > st.supply),
          stat('Business money', money(bs.balance)),
          stat('Bills owed', money(bs.owed), bs.owed > OWED_LIMIT * 0.6),
          stat('Total earned', money(bs.totalEarned)),
          stat('Units sold', String(bs.unitsSold)),
        ),
        h('p', { class: 'hint', text: `Cycle progress ${progressPct}%. Capacity ${st.capacity}, light ${st.light}, air ${st.air}${st.bottleneck !== 'none' && st.capacity > 0 ? ` — held back by ${st.bottleneck}` : ''}. Production only runs while you're playing.` }),
        bar,
      );
      if (st.missing.length) rows.push(h('p', { class: 'hub-warn', text: `To run it needs: ${st.missing.join(', ')}.` }));
      const actions = h('div', { class: 'row-actions' });
      if (!bs.active) {
        actions.append(confirmButton(`Start the business (${money(STARTUP_FEE)})`, `Confirm ${money(STARTUP_FEE)}`, armed === 'start', () => ((armed = 'start'), rebuild()), () => done(startBusiness(progress), 'The business is running')));
      } else {
        actions.append(
          menuButton(`Sell stock (${bs.stock} × ${money(st.unitValue)})`, () => {
            const r = sellStock(progress);
            if (r.ok) {
              saved();
              msg(`Sold ${r.units} units for ${money(r.value)}`);
            } else msg(r.reason, true);
            rebuild();
          }),
          menuButton(`Take ${money(bs.balance)} (pocket)`, () => collect('pocket'), undefined, 'small'),
          menuButton('Into the tin', () => collect('bank'), undefined, 'small'),
          menuButton(bs.paused ? 'Switch on' : 'Switch off', () => {
            setPaused(progress, !bs.paused);
            saved();
            rebuild();
          }, undefined, 'small'),
        );
        if (bs.owed > 0) actions.append(menuButton(`Pay bills ${money(bs.owed)}`, () => done(payBills(progress), 'Bills paid'), undefined, 'small'));
      }
      rows.push(actions);
      if (bs.events.length) {
        rows.push(h('h3', { text: 'Recent events' }));
        for (const e of [...bs.events].reverse().slice(0, 6)) rows.push(h('p', { class: 'hint', text: `${Math.floor(e.t / 60)}m in: ${e.text}` }));
      }
    } else if (tab === 'equipment') {
      rows.push(h('p', { class: 'hint', text: 'Install puts it in the room: move with arrows/WASD, turn with Q/E, Enter to place, Esc to cancel. More kit at Green Fingers on the trading estate.' }));
      if (!b.equipment.length) rows.push(h('p', { text: 'Nothing yet.' }));
      for (const e of b.equipment) {
        const def = EQUIPMENT[e.id];
        const actions = h('div', { class: 'row-actions' },
          menuButton(e.at ? 'Move' : 'Install', () => place(e.uid), undefined, 'small'),
          e.at ? menuButton('Store', () => done(uninstallEquipment(progress, e.uid), `${def.name} stored`, true), undefined, 'small') : null,
          e.faulty ? menuButton(`Repair ${money(repairCost(e.id))}`, () => done(repairEquipment(progress, e.uid), `${def.name} fixed`, true), undefined, 'small') : null,
          menuButton(`Sell ${money(e.faulty ? Math.floor(equipmentResale(def.price) / 2) : equipmentResale(def.price))}`, () => {
            const r = sellEquipment(progress, e.uid);
            if (r.ok) {
              saved();
              msg(`Sold for ${money(r.refund)}`);
              if (e.at) return rebuilt();
            } else msg(r.reason, true);
            rebuild();
          }, undefined, 'small'),
        );
        rows.push(h('div', { class: `shop-row${e.faulty ? ' faulty' : ''}` }, h('div', { class: 'what' }, h('b', { text: def.name }), h('span', { text: `${e.at ? 'Installed' : 'In storage'}${e.faulty ? ' · BROKEN' : ''} · ${tierName[def.tier]}` })), actions));
      }
    } else if (tab === 'finances') {
      rows.push(
        h('div', { class: 'biz-grid' },
          stat('Your pocket', money(s.cash.pocket)),
          stat('Your tin', money(s.cash.bank)),
          stat('Business money', money(bs.balance)),
          stat('Bills owed', money(bs.owed)),
          stat('Running costs', `£${st.opPerHour}/hr`),
          stat('Total earned', money(bs.totalEarned)),
          stat('Total costs', money(bs.totalCosts)),
          stat('Invested', money(-b.ledger.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0))),
        ),
        h('div', { class: 'row-actions' },
          menuButton(`Take ${money(bs.balance)} (pocket)`, () => collect('pocket')),
          menuButton('Into the tin', () => collect('bank')),
        ),
        h('h3', { text: 'History' }),
        ...(b.ledger.length ? [...b.ledger].reverse().slice(0, 15).map((l) => h('div', { class: 'ledger-row' }, h('span', { text: `${Math.floor(l.t / 60)}m` }), h('span', { text: l.what }), h('b', { class: l.amount < 0 ? 'neg' : 'pos', text: `${l.amount < 0 ? '−' : '+'}${money(Math.abs(l.amount))}` }))) : [h('p', { class: 'hint', text: 'Nothing yet.' })]),
      );
    } else if (tab === 'upgrades') {
      rows.push(upgradesBlock(progress, armed, (k) => ((armed = k), rebuild()), (r, good) => done(r, good)));
    } else {
      rows.push(basementWorksBlock(progress, armed, (k) => ((armed = k), rebuild()), (r, good) => done(r, good, true)));
    }
    return rows;

    function collect(to: 'pocket' | 'bank') {
      const r = withdraw(progress, to);
      if (r.ok) {
        saved();
        msg(`${money(r.amount)} ${to === 'bank' ? 'into the tin' : 'in your pocket'}`);
      } else msg(r.reason, true);
      rebuild();
    }
  }, close);
}
