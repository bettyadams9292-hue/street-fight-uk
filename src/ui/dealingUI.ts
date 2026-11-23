/**
 * Dealing on screen (business/dealing.ts): the prep table in the garage, and Kez's wholesale section.
 */
import { h } from './dom';
import { menuButton } from './controls';
import { panelScreen } from './hub';
import type { Screen } from './UIManager';
import type { Progress } from '../progress/Progress';
import {
  BAG_PACK, BAG_PACK_PRICE, batchSeconds, BULK_BUYBACK, bulkWorth, buyBags, buyBulk, buyTable, DRUG_DEFS, DRUGS, fromGrow, GROW_PER_BULK,
  loadBulk, sellBulk, tableDef, takeDeals, tickPrep, type Drug,
} from '../business/dealing';

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** How many of an item you've got on you. */
const onYou = (p: Progress, id: string) => p.save.inventory.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);

/** The prep table: set it up, put bulk on it, bags, batches going, deals to take, upgrades. */
export function prepScreen(p: Progress, close: () => void, saved: () => void, changed: () => void): Screen {
  return panelScreen('Prep table', p, (msg, rebuild) => {
    const s = p.save.dealing;
    const rows: HTMLElement[] = [];
    const t = tableDef(s.table);
    if (!t) {
      const first = tableDef(1)!;
      rows.push(
        h('p', { class: 'quote', text: '“Clear a bit of the garage, get a table in, and you can sort it all out here. Bulk in, deals out.” – Kez' }),
        h('div', { class: 'job-card' },
          h('div', { class: 'job-head' }, h('b', { class: 'job-title', text: first.name }), h('span', { class: 'job-kind', text: money(first.price) })),
          h('p', { class: 'job-brief', text: `${first.text} Bulk goes on, it’s broken down and bagged up while you’re out, and the deals wait here for you.` }),
          h('div', { class: 'row-actions' }, menuButton('Set it up', () => {
            const r = buyTable(p);
            if (!r.ok) return msg(r.reason, true), rebuild();
            changed();
            msg('Table’s set up. Get some bulk off Kez, or bring your weed up from the basement.');
            rebuild();
          }, `${money(first.price)}`, 'primary', undefined, undefined, 'set-it-up')),
        ),
      );
      return rows;
    }
    const done = tickPrep(p);
    if (DRUGS.some((d) => done[d] > 0)) saved();

    // What's going now.
    rows.push(h('div', { class: 'job-sec', text: `${t.name} · ${t.batches > 1 ? `${t.batches} batches at once` : 'one batch at a time'}` }));
    if (s.batches.length)
      for (const b of s.batches)
        rows.push(h('div', { class: 'deal-row' },
          h('b', { text: `Bagging up ${DRUG_DEFS[b.drug].name.toLowerCase()}` }),
          h('div', { class: 'job-bar' }, h('i', { style: `width:${Math.round((1 - b.left / b.total) * 100)}%` })),
          h('small', { text: `${mmss(b.left)} left · ${DRUG_DEFS[b.drug].deals} ${DRUG_DEFS[b.drug].dealPlural}` }),
        ));
    else rows.push(h('p', { class: 'ph-empty', text: DRUGS.some((d) => s.bulk[d] > 0) && s.bags < Math.min(...DRUGS.filter((d) => s.bulk[d] > 0).map((d) => DRUG_DEFS[d].deals)) ? 'Out of bags: buy some to keep going.' : 'Nothing on the go. Put some bulk on the table.' }));

    // Stock on the table.
    rows.push(h('div', { class: 'job-sec', text: 'On the table' }));
    for (const d of DRUGS) {
      const def = DRUG_DEFS[d];
      const take = s.deals[d] > 0
        ? menuButton('Take them', () => {
            const n = takeDeals(p, d);
            if (!n) return msg('No room in your pockets.', true), rebuild();
            saved();
            msg(`Took ${n} ${n > 1 ? def.dealPlural : def.dealName.toLowerCase()}. Find punters on the street: look for the green £.`);
            rebuild();
          }, `${s.deals[d]} ready`, '', undefined, undefined, 'take-them')
        : null;
      rows.push(h('div', { class: 'deal-row' },
        h('b', { text: def.name }),
        h('small', { text: `${s.bulk[d]} bulk waiting · ${s.deals[d]} bagged · ${batchSeconds(d, s.table)} s a batch of ${def.deals}` }),
        take ? h('div', { class: 'row-actions' }, take) : null,
      ));
    }

    // Loading it up.
    const carrying = DRUGS.filter((d) => onYou(p, DRUG_DEFS[d].bulkItem) > 0);
    const grow = Math.floor(p.save.basement.business.stock / GROW_PER_BULK);
    rows.push(h('div', { class: 'job-sec', text: 'Load it up' }));
    rows.push(h('div', { class: 'row-actions deal-actions' },
      menuButton('Put it on', () => {
        const put = loadBulk(p);
        const n = DRUGS.reduce((a, d) => a + put[d], 0);
        if (!n) return msg('You’re not carrying any bulk. Kez sells it on Hollins.', true), rebuild();
        tickPrep(p);
        saved();
        msg(`On the table: ${DRUGS.filter((d) => put[d]).map((d) => `${put[d]} × ${DRUG_DEFS[d].bulkName.toLowerCase()}`).join(', ')}.`);
        rebuild();
      }, carrying.length ? carrying.map((d) => `${onYou(p, DRUG_DEFS[d].bulkItem)} ${DRUG_DEFS[d].name.toLowerCase()}`).join(', ') : 'No bulk on you', '', undefined, undefined, 'put-it-on'),
      menuButton('Bring it up', () => {
        const n = fromGrow(p);
        if (!n) return msg(`Not enough from the grow yet: ${GROW_PER_BULK} units make a bulk bag.`, true), rebuild();
        tickPrep(p);
        saved();
        msg(`Brought up ${n} bulk bag${n > 1 ? 's' : ''} of your own weed.`);
        rebuild();
      }, grow ? `${grow} bulk bag${grow > 1 ? 's' : ''} from the grow` : `${p.save.basement.business.stock} of ${GROW_PER_BULK} units in the basement`, '', undefined, undefined, 'bring-it-up'),
      menuButton('Buy bags', () => {
        const r = buyBags(p);
        if (!r.ok) return msg(r.reason, true), rebuild();
        tickPrep(p);
        saved();
        rebuild();
      }, `${s.bags} left · ${BAG_PACK} for ${money(BAG_PACK_PRICE)}`, '', undefined, undefined, 'buy-bags'),
    ));

    // Upgrades.
    const next = tableDef(s.table + 1);
    if (next)
      rows.push(h('div', { class: 'job-card' },
        h('div', { class: 'job-head' }, h('b', { class: 'job-title', text: next.name }), h('span', { class: 'job-kind', text: money(next.price) })),
        h('p', { class: 'job-brief', text: next.text }),
        h('div', { class: 'row-actions' }, menuButton('Upgrade it', () => {
          const r = buyTable(p);
          if (!r.ok) return msg(r.reason, true), rebuild();
          changed();
          msg(`${next.name}: done.`);
          rebuild();
        }, money(next.price), '', undefined, undefined, 'upgrade-it')),
      ));
    rows.push(h('small', { class: 'job-note', text: `Sold so far: ${DRUGS.map((d) => `${s.sold[d]} ${DRUG_DEFS[d].name.toLowerCase()}`).join(', ')} · ${money(s.earned)} taken. Every sale is police heat; now and then a punter is plain clothes.` }));
    return rows;
  }, close);
}

/** Kez's wholesale: bulk to buy, and bulk to sell back. Part of his contact screen once it's open. */
export function wholesaleRows(p: Progress, msg: (t: string, bad?: boolean) => void, rebuild: () => void, saved: () => void): HTMLElement[] {
  const rows: HTMLElement[] = [h('div', { class: 'job-sec', text: 'Wholesale' }), h('p', { class: 'job-brief', text: '“Buy it in bulk, it’s cheaper. Bag it up at yours and sell it on. Don’t get caught with it.”' })];
  for (const d of DRUGS) {
    const def = DRUG_DEFS[d];
    const have = onYou(p, def.bulkItem);
    rows.push(h('div', { class: 'job-card' },
      h('div', { class: 'job-head' }, h('b', { class: 'job-title', text: def.bulkName }), h('span', { class: 'job-kind', text: money(def.bulkPrice) })),
      h('p', { class: 'job-brief', text: `${def.deals} ${def.dealPlural} at about ${money(def.street)} each on the street: about ${money(bulkWorth(d))} bagged up.` }),
      h('div', { class: 'row-actions deal-actions' },
        menuButton('Buy it', () => {
          const r = buyBulk(p, d as Drug);
          if (!r.ok) return msg(r.reason, true), rebuild();
          saved();
          msg(`Got a ${def.bulkName.toLowerCase()}. Get it home to the prep table, and don’t get stopped.`);
          rebuild();
        }, money(def.bulkPrice), 'primary', undefined, undefined, 'buy-it'),
        have
          ? menuButton('Sell it back', () => {
              const r = sellBulk(p, d as Drug);
              if (!r.ok) return msg(r.reason, true), rebuild();
              saved();
              msg(`Kez gave you ${money(r.price)} for it.`);
              rebuild();
            }, `${money(Math.round(def.bulkPrice * BULK_BUYBACK))} · ${have} on you`, '', undefined, undefined, 'sell-it-back')
          : null,
      ),
    ));
  }
  return rows;
}
