import { SHOP_TIER_NAMES, tierLockFor } from '../items/shopTiers';
import type { Progress } from '../progress/Progress';
import {
  BUSINESS_UPGRADES,
  EQUIPMENT,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_LIST,
  IMPROVEMENTS,
  LIGHT_KINDS,
  MAX_UPGRADE,
  STRAINS,
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
  businessLevel,
  growStage,
  payBills,
  setStrain,
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
 * B&THC (the grow shop) and the basement's business terminal. Every
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
  if (def.plants) bits.push(`${def.plants} plants, needs ${def.needCfm} CFM · plant room ${st.capacity} → ${st.capacity + def.plants}`);
  if (def.watts && def.lamp) bits.push(`${def.watts} W ${LIGHT_KINDS[def.lamp].name} · lights ${Math.floor(def.watts / st.strain.wpp)} ${st.strain.name} plants${st.strain.likes.includes(def.lamp) ? ' (it likes this lamp: +10%)' : ''} · light ${st.watts} → ${st.watts + def.watts} W`);
  if (def.cfm) bits.push(`air ${st.cfm} → ${st.cfm + def.cfm} of ${st.needCfm} CFM needed`);
  if (def.circ) bits.push(`clip fans ${st.clipFans} → ${st.clipFans + def.circ} for ${st.tents} tent${st.tents === 1 ? '' : 's'}`);
  if (def.cool) bits.push(`cooling ${st.cooling} → ${Math.round((st.cooling + def.cool) * 100) / 100} kW for ${st.heat} kW of lamp heat`);
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
  const k = def.plants ? ['plant', def.plants] : def.watts ? ['100 W', def.watts / 100] : def.cfm ? ['100 CFM', def.cfm / 100] : def.storage ? ['unit of storage', def.storage] : def.sec ? ['point of security', def.sec] : null;
  return k ? `${money(def.price / (k[1] as number))} a ${k[0]}` : '';
}

/** Two clicks to spend money: the first arms the button, the second buys. */
function confirmButton(label: string, confirmText: string, armed: boolean, arm: () => void, go: () => void, cls?: string): HTMLElement {
  return menuButton(armed ? confirmText : label, armed ? go : arm, armed ? 'Click again to confirm' : undefined, cls);
}

// ---- the grow shop --------------------------------------------------------------------------------

export function growShopScreen(progress: Progress, close: () => void, saved: () => void, startTab: string = 'tents'): Screen {
  let tab: ShopTab = (EQUIPMENT_CATEGORIES.some((c) => c.id === startTab) ? startTab : 'tents') as ShopTab;
  let sel = EQUIPMENT_LIST.find((e) => e.cat === tab)?.id ?? 'tent_s';
  let qty = 1;
  let armed: string | null = null;
  return panelScreen('B&THC Hydroponics', progress, (msg, rebuild) => {
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
        h('b', { text: e.name }), h('span', { text: `${money(e.price)} · ${tierName[e.tier]}${o.length ? ` · own ${o.length} (${o.filter((x) => x.at).length} installed)` : tierLockFor(progress, e.tier) ? ' · SOON' : ''}` }));
    }));
    const mine = owned(def.id);
    const spare = mine.find((x) => !x.at);
    const total = def.price * qty;
    const lock = tierLockFor(progress, def.tier);
    const short = !progress.canAfford(total);
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
        lock
          ? menuButton('SOON', () => msg(lock, true), `${SHOP_TIER_NAMES[def.tier]}: ${lock}`, 'small')
          : confirmButton(`Buy ${money(total)}`, `Confirm ${money(total)}`, armed === `buy:${def.id}`, () => ((armed = `buy:${def.id}`), rebuild()),
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
    tickBusiness(b, s.playTime, progress.wanted);
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
      const stage = growStage(b, st);
      const bar = h('div', { class: 'stat-bar biz-progress' }, h('i', {}));
      (bar.firstChild as HTMLElement).style.width = `${progressPct}%`;
      rows.push(
        h('div', { class: `biz-status ${status}` , text: STATUS_TEXT[status] }),
        h('div', { class: 'biz-grid' },
          stat('Business level', `${st.level} / 5`),
          stat('Stock', `${bs.stock} / ${st.storage} units`, bs.stock >= st.storage),
          stat('Strain', `${st.strain.name} (${st.strain.type})`),
          stat('Each harvest', `${st.unitsPerCycle} units every ${Math.round(st.cycleSeconds / 60 * 10) / 10} min`),
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
        h('p', { class: 'hint', text: st.ready && bs.active ? `${stage.stage}: week ${stage.week} of ${stage.of}. Harvest ${progressPct}% of the way. It only grows while you're playing.` : `Crop: ${st.strain.name}, ${st.weeks.veg + st.weeks.flower + st.weeks.dry + st.weeks.turnaround} weeks seed to replant.` }),
        bar,
        h('div', { class: 'biz-grid' },
          stat('Plants', `${st.effective} growing of ${st.capacity} in ${st.tents} tent${st.tents === 1 ? '' : 's'}`, st.bottleneck !== 'none' && st.capacity > 0),
          stat('Light', `${st.watts} W: ${st.light} plants at ${st.strain.wpp} W`, st.light < st.capacity),
          stat('Extraction', `${st.cfm} of ${st.needCfm} CFM`, st.cfm < st.needCfm),
          stat('Heat', `${st.heat} kW out of ${st.cooling} kW`, st.heat > st.cooling),
          stat('Clip fans', `${st.clipFans} for ${st.tents} tent${st.tents === 1 ? '' : 's'}`, st.clipFans < st.tents),
          stat('Yield', `${Math.round(st.efficiency * 100)}% of the strain's best`),
        ),
      );
      if (st.bottleneck !== 'none' && st.capacity > 0) rows.push(h('p', { class: 'hub-warn', text: st.bottleneck === 'light' ? `Only ${st.light} of ${st.capacity} plants get enough light: add ${Math.ceil((st.capacity * st.strain.wpp - st.watts) / 100) * 100} W more.` : `The fans only air ${st.air} of ${st.capacity} plants: ${st.needCfm - st.cfm} CFM more extraction needed.` }));
      if (st.warnings.length) rows.push(h('p', { class: 'hub-warn', text: `Costing yield: ${st.warnings.join('; ')}.` }));
      const lvl = businessLevel(bs.unitsSold);
      rows.push(
        h('h3', { class: 'biz-h', text: 'Seeds' }),
        h('p', { class: 'hint', text: 'Changing strain pulls what\'s growing and starts again from seed.' }),
        h('div', { class: 'biz-strains' }, ...STRAINS.map((sd) => {
          const on = bs.strain === sd.id;
          const locked = lvl < sd.level;
          const weeks = sd.veg + sd.flower;
          return h('div', { class: `biz-strain${on ? ' on' : ''}${locked ? ' locked' : ''}` },
            h('b', { text: sd.name }),
            h('span', { class: 'biz-strain-type', text: `${sd.type} · ${sd.veg ? `${sd.veg} wk veg + ${sd.flower} wk flower` : `${weeks} wk seed to harvest`} · ${sd.wpp} W a plant · ${sd.likes.map((k) => LIGHT_KINDS[k].name).join(' or ')}` }),
            h('p', { text: sd.blurb }),
            on ? h('span', { class: 'biz-strain-tag', text: 'Growing now' })
              : locked ? h('span', { class: 'biz-strain-tag', text: `Business level ${sd.level}` })
              : confirmButton(`Plant ${sd.name}`, bs.cycle > 0 ? 'Pull the crop and replant' : `Plant ${sd.name}`, armed === `strain:${sd.id}`, () => ((armed = `strain:${sd.id}`), rebuild()), () => done(setStrain(progress, sd.id), `${sd.name} planted`), 'small'),
          );
        })),
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
          menuButton(progress.save.bank ? 'Pay into the bank' : 'Into the tin', () => collect('bank'), undefined, 'small'),
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
      rows.push(h('p', { class: 'hint', text: 'Install puts it in the room: move with arrows/WASD, turn with Q/E, Enter to place, Esc to cancel. More kit at B&THC on the trading estate.' }));
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
          stat('Your tin', money(s.cash.tin)),
          stat('Your account', s.bank ? money(s.cash.bank) : 'No account'),
          stat('Business money', money(bs.balance)),
          stat('Bills owed', money(bs.owed)),
          stat('Running costs', `£${st.opPerHour}/hr`),
          stat('Total earned', money(bs.totalEarned)),
          stat('Total costs', money(bs.totalCosts)),
          stat('Invested', money(-b.ledger.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0))),
        ),
        h('div', { class: 'row-actions' },
          menuButton(`Take ${money(bs.balance)} (pocket)`, () => collect('pocket')),
          menuButton(progress.save.bank ? 'Pay into the bank' : 'Into the tin', () => collect('bank')),
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
