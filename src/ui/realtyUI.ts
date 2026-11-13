import type { Progress } from '../progress/Progress';
import {
  MONTH,
  PROP_CATS,
  PROP_CAT_LABELS,
  PROPERTIES,
  PROPERTY_LIST,
  QUALITY_LABELS,
  RENT_STEPS,
  RENT_STEP_LABELS,
  SALE_FEE,
  TIER_LABELS,
  formatPounds as money,
  marketRent,
  saleOffer,
  valueNow,
  type PropCat,
  type PropertyDef,
} from '../realty/catalogue';
import {
  askingRent,
  buyProperty,
  collectRent,
  findChance,
  holding,
  listForRent,
  sellProperty,
  setRent,
  settle,
  statusOf,
  totals,
  unlist,
  untilRentDay,
  type Holding,
} from '../realty/portfolio';
import { menuButton } from './controls';
import { h } from './dom';
import { icon } from './icons';
import { panelScreen } from './hub';
import { propertyPhoto } from './propertyPhoto';
import type { Screen } from './UIManager';
import { LEVELS } from '../world/levels';

/**
 * Keys & Co: the property market and your portfolio. Browse what's for sale,
 * book a viewing, buy; then manage what you own: live in it, let it, set the
 * rent, see who lives there and what they've paid, collect rent, sell. The
 * same screens are on the computer at home. Every button goes through
 * realty/portfolio.ts, which takes and pays the money and changes the save.
 */

export type RealtyTab = 'market' | 'mine' | 'rentals' | 'finance';
export interface RealtyActions {
  /** Go and look round a property (a viewing, or a visit to your own). */
  visit?: (id: string) => void;
  /** Money moved: save. */
  saved: () => void;
}

const STATUS_LABEL = { personal: 'Lived in by you', let: 'Let', vacant: 'Empty, to let', notice: 'Let, notice given' } as const;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function facts(d: PropertyDef): string {
  const beds = d.beds === 0 ? 'Studio' : plural(d.beds, 'bed');
  return `${beds} · ${plural(d.baths, 'bath')} · ${d.sqft.toLocaleString('en-GB')} sq ft`;
}

function where(d: PropertyDef): string {
  return `${d.locality} (${LEVELS[d.area]?.name ?? d.locality}) · ${TIER_LABELS[d.tier]} area`;
}

function fact(label: string, value: string, cls = ''): HTMLElement {
  return h('div', { class: `rt-fact ${cls}` }, h('small', { text: label }), h('b', { text: value }));
}

function minutes(sec: number): string {
  const m = Math.ceil(sec / 60);
  return m <= 1 ? 'under a minute' : `${m} minutes`;
}

/** The body of the property screens, for the estate agent and the home computer. */
export function realtyBody(progress: Progress, actions: RealtyActions, start: RealtyTab = 'market', focus?: string) {
  let tab: RealtyTab = start;
  let cat: PropCat = focus ? PROPERTIES[focus]?.cat ?? 'house' : 'house';
  let sel: string = focus && PROPERTIES[focus] ? focus : PROPERTY_LIST.find((p) => p.cat === cat)!.id;
  let mineSel: string | null = focus ?? null;
  let confirmBuy: string | null = null;
  let confirmSell: string | null = null;
  return (msg: (t: string, bad?: boolean) => void, rebuild: () => void): HTMLElement[] => {
    const s = progress.save;
    // Bring rents up to date before showing anything; anything that's happened goes at the top.
    const news = settle(s, s.playTime);
    if (news.length) actions.saved();
    const t = totals(s);
    const tabs = h('div', { class: 'prop-tabs' }, ...([
      ['market', 'For sale', 'shop'],
      ['mine', `My properties (${t.owned})`, 'home'],
      ['rentals', `My rentals${t.owed ? ` · ${money(t.owed)} to collect` : ''}`, 'key'],
      ['finance', 'Finances', 'coin'],
    ] as const).map(([id, name, ic]) => h('button', { class: `prop-tab${tab === id ? ' on' : ''}`, 'data-nav': true, onclick: () => ((tab = id), (confirmBuy = confirmSell = null), rebuild()) }, icon(ic), h('span', { text: name }))));
    const rows: HTMLElement[] = [tabs, ...news.map((n) => h('p', { class: `rt-news ${n.kind}`, text: n.text }))];

    if (tab === 'market') {
      rows.push(h('div', { class: 'prop-tabs sub' }, ...PROP_CATS.map((c) => h('button', { class: `prop-tab${cat === c ? ' on' : ''}`, 'data-nav': true, text: PROP_CAT_LABELS[c], onclick: () => {
        cat = c;
        sel = PROPERTY_LIST.find((p) => p.cat === c)!.id;
        confirmBuy = null;
        rebuild();
      } }))));
      const list = h('div', { class: 'prop-list rt-list' }, ...PROPERTY_LIST.filter((p) => p.cat === cat).map((p) => {
        const mine = holding(s, p.id);
        return h('button', { class: `prop-item rt-item${p.id === sel ? ' on' : ''}${mine ? ' owned' : ''}`, 'data-nav': true, onclick: () => ((sel = p.id), (confirmBuy = null), rebuild()) },
          propertyPhoto(p.id, 'rt-thumb'),
          h('div', {},
            h('b', {}, p.name, mine ? h('span', { class: 'jw-tag on', text: 'Yours' }) : null),
            h('span', { text: `${p.type} · ${facts(p)}` }),
            h('span', { class: 'rt-price', text: mine ? `Worth ${money(valueNow(p, s.playTime))}` : money(valueNow(p, s.playTime)) })));
      }));
      const d = PROPERTIES[sel];
      const mine = holding(s, d.id);
      const price = valueNow(d, s.playTime);
      const have = s.cash.pocket + s.cash.bank;
      const buyBtns: HTMLElement[] = [];
      if (mine) buyBtns.push(menuButton('Manage it', () => ((tab = 'mine'), (mineSel = d.id), rebuild()), 'It’s yours', 'primary'));
      else if (confirmBuy === d.id)
        buyBtns.push(
          menuButton(`Confirm: buy for ${money(price)}`, () => {
            const r = buyProperty(progress, d.id);
            confirmBuy = null;
            if (r.ok) {
              actions.saved();
              mineSel = d.id;
              msg(`${d.name} is yours. Live in it, let it out, or sell it on: it’s under My properties.`);
            } else msg(r.reason, true);
          }, `You’ve got ${money(have)} (pocket first, then the bank)`, 'primary'),
          menuButton('Cancel', () => ((confirmBuy = null), rebuild()), undefined, 'quiet'),
        );
      else buyBtns.push(menuButton(`Buy for ${money(price)}`, () => ((confirmBuy = d.id), rebuild()), have >= price ? 'Then confirm' : `You’re ${money(price - have)} short`, 'primary'));
      if (actions.visit) buyBtns.push(menuButton(mine ? 'Go there' : 'Book a viewing', () => actions.visit!(d.id), mine ? d.locality : 'Fiona drives you over', 'quiet'));
      const detail = h('div', { class: 'prop-detail rt-detail' },
        propertyPhoto(d.id),
        h('h3', { text: d.name }),
        h('p', { class: 'rt-type', text: `${d.type} · ${where(d)}` }),
        h('div', { class: 'rt-facts' },
          fact('Price', money(price), 'big'),
          fact('Bedrooms', d.beds === 0 ? 'Studio' : String(d.beds)),
          fact('Bathrooms', String(d.baths)),
          fact('Size', `${d.sqft.toLocaleString('en-GB')} sq ft`),
          fact('Interior', `${QUALITY_LABELS[d.quality]} fit-out`),
          fact('Rental income', `${money(marketRent(d, s.playTime))} / month`),
          fact('Status', mine ? `Yours (${STATUS_LABEL[statusOf(mine)].toLowerCase()})` : 'For sale'),
          d.garden ? fact('Outside', d.garden === 'grounds' ? 'Grounds' : d.garden === 'garden' ? 'Garden' : 'Back yard') : null,
        ),
        h('p', { class: 'hint', text: `${d.blurb}${d.gated ? ' Gated.' : ''} ${d.rooms.length} rooms${d.stairs ? ' over more than one floor' : ''}.` }),
        h('div', { class: 'row-actions' }, ...buyBtns),
      );
      rows.push(h('div', { class: 'prop-shop rt-shop' }, list, detail));
      return rows;
    }

    if (tab === 'mine') {
      const mine = s.portfolio.holdings;
      if (!mine.length) {
        rows.push(h('div', { class: 'inv-empty', text: 'You don’t own any property yet. Have a look at what’s for sale: a studio on Tanner Road is a start.' }));
        return rows;
      }
      if (!mineSel || !holding(s, mineSel)) mineSel = mine[0].id;
      const list = h('div', { class: 'prop-list rt-list' }, ...mine.map((hd) => {
        const d = PROPERTIES[hd.id];
        const st = statusOf(hd);
        return h('button', { class: `prop-item rt-item${hd.id === mineSel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((mineSel = hd.id), (confirmSell = null), rebuild()) },
          propertyPhoto(d.id, 'rt-thumb'),
          h('div', {},
            h('b', { text: d.name }),
            h('span', { text: `${d.type} · ${d.locality}` }),
            h('span', { class: `rt-status ${st}`, text: STATUS_LABEL[st] })));
      }));
      rows.push(h('div', { class: 'prop-shop rt-shop' }, list, manageBlock(progress, holding(s, mineSel)!, actions, msg, rebuild, {
        confirmSell,
        askSell: (id) => ((confirmSell = id), rebuild()),
        cancelSell: () => ((confirmSell = null), rebuild()),
        sold: () => ((confirmSell = null), (mineSel = null)),
      })));
      return rows;
    }

    if (tab === 'rentals') {
      const lets = s.portfolio.holdings.filter((x) => x.use === 'let');
      rows.push(h('div', { class: 'rt-facts wide' },
        fact('Rent coming in', `${money(t.monthly)} / month`, 'big'),
        fact('To collect now', money(t.owed), t.owed ? 'good' : ''),
        fact('Let', String(t.let)),
        fact('Empty', String(t.vacant)),
        fact('Next rent day', `in ${minutes(untilRentDay(s.playTime))}`),
      ));
      rows.push(h('div', { class: 'row-actions' },
        menuButton(t.owed ? `Collect ${money(t.owed)}` : 'Nothing to collect', () => {
          const n = collectRent(progress);
          if (n > 0) {
            actions.saved();
            msg(`${money(n)} rent paid into your bank.`);
          } else msg('No rent waiting. It comes in at the end of each month a tenant’s in.', true);
        }, 'Into the bank', t.owed ? 'primary' : 'quiet')));
      if (!lets.length) rows.push(h('p', { class: 'hint', text: 'None of your places are let. Pick one under My properties and put it on the rental market.' }));
      for (const hd of lets) {
        const d = PROPERTIES[hd.id];
        const st = statusOf(hd);
        rows.push(h('div', { class: `rt-let ${st}` },
          propertyPhoto(d.id, 'rt-thumb'),
          h('div', { class: 'what' },
            h('b', { text: d.name }),
            h('span', { text: hd.tenant ? `${hd.tenant.name}, ${hd.tenant.who.toLowerCase()}: ${money(askingRent(d, hd, s.playTime))} a month${hd.notice ? ' (leaving at month end)' : ''}` : `Empty. Asking ${money(askingRent(d, hd, s.playTime))} a month: ${Math.round(findChance(hd.rentStep) * 100)}% chance of a tenant each month` }),
            h('span', { text: `Earned ${money(hd.earned)} so far${hd.owed ? ` · ${money(hd.owed)} waiting` : ''}` })),
          menuButton('Manage', () => ((tab = 'mine'), (mineSel = hd.id), rebuild()), undefined, 'quiet')));
      }
      return rows;
    }

    // Finances.
    const f = s.finance;
    rows.push(h('div', { class: 'rt-facts wide' },
      fact('Portfolio value', money(t.value), 'big'),
      fact('Total invested', money(t.invested)),
      fact('Rent received', money(f.totals.rent.in)),
      fact('If you sold it all', money(t.saleValue)),
      fact('Profit', money(t.profit), t.profit >= 0 ? 'good' : 'bad'),
      fact('Jewellery spent', money(f.totals.jewellery.out)),
    ));
    rows.push(h('h4', { class: 'rt-h', text: 'Statement' }));
    if (!f.ledger.length) rows.push(h('p', { class: 'hint', text: 'Nothing yet. Property, rent and jewellery all show up here.' }));
    else
      rows.push(h('div', { class: 'rt-ledger' }, ...f.ledger.slice().reverse().slice(0, 40).map((l) =>
        h('div', { class: `rt-line ${l.amount >= 0 ? 'in' : 'out'}` },
          h('small', { text: `Month ${Math.floor(l.t / MONTH) + 1}` }),
          h('span', { text: l.what }),
          h('b', { text: `${l.amount >= 0 ? '+' : ''}${money(l.amount)}` })))));
    return rows;
  };
}

/** Everything about one place you own, and what you can do with it. */
function manageBlock(
  progress: Progress,
  hd: Holding,
  actions: RealtyActions,
  msg: (t: string, bad?: boolean) => void,
  rebuild: () => void,
  sell: { confirmSell: string | null; askSell: (id: string) => void; cancelSell: () => void; sold: () => void },
): HTMLElement {
  const s = progress.save;
  const d = PROPERTIES[hd.id];
  const value = valueNow(d, s.playTime);
  const offer = saleOffer(d, s.playTime);
  const pl = offer.net - hd.paid;
  const st = statusOf(hd);
  const acts: HTMLElement[] = [];
  if (hd.use === 'personal') {
    acts.push(menuButton('Let it out', () => {
      const r = listForRent(progress, hd.id);
      if (r.ok) {
        actions.saved();
        msg(`${d.name} is on the rental market at ${money(askingRent(d, hd, s.playTime))} a month. Tenants usually turn up within a month or two.`);
      } else msg(r.reason, true);
    }, `About ${money(marketRent(d, s.playTime))} a month`, 'primary'));
  } else {
    acts.push(menuButton(hd.tenant ? (hd.notice ? 'Notice given' : 'Give notice and move in') : 'Take it off the market', () => {
      if (hd.notice) return;
      const r = unlist(progress, hd.id);
      if (r.ok) {
        actions.saved();
        msg(r.notice ? `${hd.tenant?.name ?? 'The tenants'} will move out at the end of the month. Rent’s still paid until then.` : `${d.name} is yours to use again.`);
      } else msg(r.reason, true);
    }, hd.tenant ? 'They leave at month end' : 'Keep it for yourself', 'quiet'));
  }
  if (hd.owed > 0)
    acts.push(menuButton(`Collect ${money(hd.owed)}`, () => {
      const n = collectRent(progress, hd.id);
      actions.saved();
      msg(`${money(n)} paid into your bank.`);
    }, 'Rent from this place', 'primary'));
  if (actions.visit && !(hd.use === 'let' && hd.tenant)) acts.push(menuButton('Go there', () => actions.visit!(hd.id), d.locality, 'quiet'));
  const rentPicker =
    hd.use === 'let'
      ? h('div', { class: 'rt-rent' },
          h('small', { text: 'Rent asked' }),
          h('div', { class: 'jw-finishes' }, ...RENT_STEPS.map((_, i) => h('button', { class: `jw-finish${i === hd.rentStep ? ' on' : ''}`, 'data-nav': true, role: 'radio', 'aria-checked': String(i === hd.rentStep), onclick: () => {
            const r = setRent(progress, hd.id, i);
            if (r.ok) {
              actions.saved();
              rebuild();
            } else msg(r.reason, true);
          } }, h('span', { text: RENT_STEP_LABELS[i] }), h('em', { text: money(askingRent(d, { rentStep: i }, s.playTime)) })))),
          h('p', { class: 'hint', text: hd.tenant ? 'A new rent applies from next month. Overcharge and tenants leave sooner.' : `Cheaper finds a tenant faster: ${Math.round(findChance(hd.rentStep) * 100)}% chance each month at this rent.` }))
      : null;
  const sellBlock =
    sell.confirmSell === hd.id
      ? h('div', { class: 'rt-sell' },
          h('p', { text: `Sell ${d.name} for ${money(offer.gross)}, less ${money(offer.fee)} agent’s fee (${Math.round(SALE_FEE * 100)}%): ${money(offer.net)} into your bank${hd.owed ? `, plus ${money(hd.owed)} rent still to collect` : ''}. ${pl >= 0 ? `That’s ${money(pl)} profit.` : `That’s a ${money(-pl)} loss.`}${hd.tenant ? ' The tenants’ lease goes with the sale.' : ''}` }),
          h('div', { class: 'row-actions' },
            menuButton(`Sell for ${money(offer.net)}`, () => {
              const r = sellProperty(progress, hd.id);
              if (r.ok) {
                sell.sold();
                actions.saved();
                msg(`Sold. ${money(r.net + r.rent)} paid into your bank (${r.profit >= 0 ? `${money(r.profit)} profit` : `${money(-r.profit)} loss`}).`);
              } else msg(r.reason, true);
            }, undefined, 'danger'),
            menuButton('Keep it', sell.cancelSell, undefined, 'quiet')))
      : h('div', { class: 'row-actions' }, menuButton('Sell it', () => sell.askSell(hd.id), `About ${money(offer.net)} after fees`, 'quiet'));
  return h('div', { class: 'prop-detail rt-detail' },
    propertyPhoto(d.id),
    h('h3', { text: d.name }),
    h('p', { class: 'rt-type', text: `${d.type} · ${where(d)} · ${facts(d)}` }),
    h('div', { class: 'rt-facts' },
      fact('You paid', money(hd.paid)),
      fact('Worth now', money(value), value >= hd.paid ? 'good' : 'bad'),
      fact('Sale price', money(offer.net)),
      fact(pl >= 0 ? 'Profit if sold' : 'Loss if sold', money(Math.abs(pl)), pl >= 0 ? 'good' : 'bad'),
      fact('Status', STATUS_LABEL[st]),
      fact('Rent earned', money(hd.earned)),
    ),
    hd.tenant ? h('p', { class: 'rt-tenant' }, icon('contact'), h('span', { text: `${hd.tenant.name}, ${hd.tenant.who.toLowerCase()}. In since month ${hd.tenant.since + 1}, paying ${money(askingRent(d, hd, s.playTime))} a month.` })) : null,
    rentPicker,
    h('div', { class: 'row-actions' }, ...acts),
    hd.history.length
      ? h('div', { class: 'rt-history' }, h('h4', { class: 'rt-h', text: 'History' }), ...hd.history.slice().reverse().slice(0, 8).map((e) => h('div', { class: 'rt-line' }, h('small', { text: `Month ${e.m + 1}` }), h('span', { text: e.text }))))
      : null,
    sellBlock,
  );
}

/** Keys & Co, the estate agents. */
export function estateAgentScreen(progress: Progress, close: () => void, actions: RealtyActions, start: RealtyTab = 'market', focus?: string): Screen {
  return panelScreen('Keys & Co Estate Agents', progress, realtyBody(progress, actions, start, focus), close);
}

/** Inside a property: the brochure (viewing) or your own place's details. */
export function propertyBrochureScreen(progress: Progress, id: string, close: () => void, actions: RealtyActions): Screen {
  const owned = !!holding(progress.save, id);
  return panelScreen(owned ? 'Your property' : 'Keys & Co brochure', progress, realtyBody(progress, actions, owned ? 'mine' : 'market', id), close);
}
