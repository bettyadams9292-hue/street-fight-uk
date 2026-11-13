import type { Progress } from '../progress/Progress';
import {
  FINISHES,
  JEWEL_CATS,
  JEWEL_CAT_LABELS,
  JEWEL_CAT_ONE,
  JEWEL_LIST,
  JEWELS,
  STONES,
  jewelBuyback,
  jewelPrice,
  type FinishId,
  type JewelCat,
  type JewelDef,
} from '../items/jewellery';
import { buyJewel, isWorn, markSeen, removeJewel, sellJewel, wearJewel, type OwnedJewel } from '../items/jewelleryBox';
import { RARITY_COLOURS, RARITY_LABELS } from '../items/items';
import { menuButton } from './controls';
import { h } from './dom';
import { icon } from './icons';
import { panelScreen } from './hub';
import type { Screen } from './UIManager';

/**
 * Halden & Crane, the jewellers: browse each case, turn a piece over in the
 * preview, pick the metal, buy it, wear it. And the jewellery box: everything
 * you own, what's on, and putting things on and taking them off. Both go
 * through items/jewelleryBox.ts, which takes the money and changes the save.
 */

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

/** The turntable, loaded with the first screen that shows it (it brings three.js; the rest of the UI doesn't need it). */
let preview: typeof import('./jewelPreview') | null = null;
function jewelSlot(look: { id: string; finish: FinishId }): HTMLElement {
  if (preview) return preview.jewelCanvas(look);
  const slot = h('div', { class: 'prop-preview jw-preview jw-loading' });
  void import('./jewelPreview').then((m) => {
    preview = m;
    if (slot.isConnected) slot.replaceWith(m.jewelCanvas(look));
  });
  return slot;
}

function chip(text: string, colour: string): HTMLElement {
  const c = h('span', { class: 'jw-chip', text });
  c.style.setProperty('--chip', colour);
  return c;
}

function finishPicker(d: JewelDef, current: FinishId, pick: (f: FinishId) => void): HTMLElement {
  return h('div', { class: 'jw-finishes', role: 'radiogroup', 'aria-label': 'Metal' }, ...d.finishes.map((f) => {
    const fin = FINISHES[f];
    const b = h('button', { class: `jw-finish${f === current ? ' on' : ''}`, 'data-nav': true, role: 'radio', 'aria-checked': String(f === current), onclick: () => pick(f) },
      h('i', {}),
      h('span', { text: fin.name }),
      h('em', { text: money(jewelPrice(d, f)) }));
    (b.firstChild as HTMLElement).style.background = fin.metal2 ? `linear-gradient(135deg, ${fin.metal} 50%, ${fin.metal2} 50%)` : fin.metal;
    return b;
  }));
}

/** What you've got on, one line per kind, for the top of both screens. */
function wornStrip(progress: Progress, off: (c: JewelCat) => void): HTMLElement {
  const s = progress.save;
  return h('div', { class: 'jw-worn' }, ...JEWEL_CATS.map((c) => {
    const uid = s.jewellery.worn[c];
    const o = uid ? s.jewellery.owned.find((x) => x.uid === uid) : undefined;
    const d = o ? JEWELS[o.id] : undefined;
    return h('div', { class: `jw-slot${o ? ' on' : ''}` },
      h('small', { text: JEWEL_CAT_ONE[c] }),
      h('b', { text: d ? d.name : 'Nothing on' }),
      d && o ? h('span', { text: FINISHES[o.finish].name }) : null,
      o ? h('button', { class: 'jw-off', 'data-nav': true, 'aria-label': `Take off the ${d!.name}`, title: 'Take it off', onclick: () => off(c) }, icon('close')) : null);
  }));
}

// ---- the shop -------------------------------------------------------------------------------------

export function jewellerScreen(progress: Progress, close: () => void, saved: () => void, changed: () => void, startTab: string = 'ring', priceMult = 1): Screen {
  let tab: JewelCat | 'box' = (JEWEL_CATS as string[]).includes(startTab) ? (startTab as JewelCat) : startTab === 'box' ? 'box' : 'ring';
  let sel = JEWEL_LIST.find((d) => d.cat === (tab === 'box' ? 'ring' : tab))!.id;
  let finish: FinishId = JEWELS[sel].finishes[0];
  let boxSel: string | null = null;
  let confirmSell: string | null = null;
  return panelScreen('Halden & Crane', progress, (msg, rebuild) => {
    const s = progress.save;
    const off = (c: JewelCat) => {
      removeJewel(progress, c);
      changed();
      msg(`Taken off`);
    };
    const tabs = h('div', { class: 'prop-tabs' },
      ...JEWEL_CATS.map((c) => h('button', { class: `prop-tab${tab === c ? ' on' : ''}`, 'data-nav': true, text: JEWEL_CAT_LABELS[c], onclick: () => {
        tab = c;
        sel = JEWEL_LIST.find((d) => d.cat === c)!.id;
        finish = JEWELS[sel].finishes[0];
        rebuild();
      } })),
      h('button', { class: `prop-tab${tab === 'box' ? ' on' : ''}`, 'data-nav': true, onclick: () => ((tab = 'box'), rebuild()) },
        `Your jewellery box (${s.jewellery.owned.length})`));
    const rows: HTMLElement[] = [
      h('p', { class: 'hint jw-intro', text: 'Everything you buy goes in your jewellery box for good: it never takes a pocket and you can’t lose it in a fight. Wear one of each: a ring, a watch, a chain and a grill.' }),
      wornStrip(progress, off),
      tabs,
    ];
    if (tab === 'box') {
      rows.push(...boxBody(progress, boxSel, (u) => ((boxSel = u), (confirmSell = null), rebuild()), msg, changed, saved, {
        sell: (o) => {
          if (confirmSell !== o.uid) {
            confirmSell = o.uid;
            rebuild();
            return;
          }
          const r = sellJewel(progress, o.uid);
          confirmSell = null;
          if (r.ok) {
            saved();
            msg(`Sold back for ${money(r.amount)}. It’s in your pocket.`);
          } else msg(r.reason, true);
        },
        confirmSell,
      }));
      return rows;
    }
    const d = JEWELS[sel];
    const price = Math.round(jewelPrice(d, finish) * priceMult);
    const list = h('div', { class: 'prop-list jw-list' }, ...JEWEL_LIST.filter((x) => x.cat === tab).map((x) => {
      const owned = s.jewellery.owned.filter((o) => o.id === x.id);
      const wearing = owned.some((o) => isWorn(s, o.uid));
      const item = h('button', { class: `prop-item${x.id === sel ? ' on' : ''}`, 'data-nav': true, onclick: () => ((sel = x.id), (finish = x.finishes[0]), rebuild()) },
        h('b', {}, x.name, wearing ? h('span', { class: 'jw-tag on', text: 'Wearing' }) : owned.length ? h('span', { class: 'jw-tag', text: `Owned${owned.length > 1 ? ` ×${owned.length}` : ''}` }) : null),
        h('span', { text: `from ${money(Math.round(Math.min(...x.finishes.map((f) => jewelPrice(x, f))) * priceMult))} · ${RARITY_LABELS[x.rarity]}` }));
      item.style.setProperty('--rarity', RARITY_COLOURS[x.rarity]);
      return item;
    }));
    const ownedHere = s.jewellery.owned.filter((o) => o.id === d.id && o.finish === finish);
    const have = s.cash.pocket + s.cash.bank;
    const buy = (wear: boolean) => {
      const r = buyJewel(progress, d.id, finish, priceMult);
      if (!r.ok) return msg(r.reason, true);
      if (wear && r.uid) {
        const w = wearJewel(progress, r.uid);
        changed();
        msg(w.ok ? `Bought and wearing the ${d.name}` : `Bought. ${w.reason}`, !w.ok);
      } else {
        saved();
        msg(`Bought the ${d.name}. It’s in your jewellery box.`);
      }
    };
    const detail = h('div', { class: 'prop-detail jw-detail' },
      jewelSlot({ id: d.id, finish }),
      h('p', { class: 'jw-drag', text: 'Drag to turn it' }),
      h('h3', { text: d.name }),
      h('div', { class: 'jw-chips' }, chip(RARITY_LABELS[d.rarity], RARITY_COLOURS[d.rarity]), chip(FINISHES[finish].quality, FINISHES[finish].metal), d.stone ? chip(STONES[d.stone].name, STONES[d.stone].colour) : null),
      h('p', { class: 'hint', text: `${d.spec}. ${d.blurb}` }),
      finishPicker(d, finish, (f) => ((finish = f), rebuild())),
      h('div', { class: 'jw-price' }, h('b', { text: money(price) }), ownedHere.length ? h('span', { class: 'jw-tag', text: `You own ${ownedHere.length} in ${FINISHES[finish].name.toLowerCase()}` }) : null, priceMult > 1 ? h('span', { class: 'jw-tag bad', text: 'Marcus remembers you: prices are up' }) : null),
      h('div', { class: 'row-actions' },
        menuButton(`Buy and wear`, () => buy(true), have < price ? `You’re ${money(price - have)} short` : `${money(price)}, on straight away`, 'primary'),
        menuButton(`Buy`, () => buy(false), 'Into the jewellery box')),
    );
    rows.push(h('div', { class: 'prop-shop' }, list, detail));
    return rows;
  }, close);
}

// ---- the jewellery box ----------------------------------------------------------------------------

interface BoxExtras {
  sell?: (o: OwnedJewel) => void;
  confirmSell?: string | null;
}

/** Everything you own, by kind, with the selected piece on the turntable and what you can do with it. */
function boxBody(progress: Progress, selUid: string | null, select: (uid: string) => void, msg: (t: string, bad?: boolean) => void, changed: () => void, saved: () => void, extras: BoxExtras = {}): HTMLElement[] {
  const s = progress.save;
  const owned = s.jewellery.owned;
  if (!owned.length)
    return [h('div', { class: 'inv-empty', text: 'Your jewellery box is empty. Halden & Crane in the Riverside Centre sells rings, watches, chains and grills.' })];
  const sel = owned.find((o) => o.uid === selUid) ?? owned.find((o) => isWorn(s, o.uid)) ?? owned[owned.length - 1];
  const unseen = new Set(s.jewellery.unseen);
  const groups = JEWEL_CATS.map((c) => {
    const mine = owned.filter((o) => JEWELS[o.id].cat === c);
    return h('div', { class: 'jw-group' },
      h('h4', { text: `${JEWEL_CAT_LABELS[c]} (${mine.length})` }),
      mine.length
        ? h('div', { class: 'jw-cards' }, ...mine.map((o) => {
            const d = JEWELS[o.id];
            const worn = isWorn(s, o.uid);
            const b = h('button', { class: `jw-card${o.uid === sel.uid ? ' on' : ''}${worn ? ' worn' : ''}`, 'data-nav': true, 'data-grid': true, onclick: () => select(o.uid) },
              h('i', { class: 'jw-dot' }),
              h('b', { text: d.name }),
              h('span', { text: FINISHES[o.finish].name }),
              worn ? h('em', { class: 'jw-tag on', text: 'Wearing' }) : unseen.has(o.uid) ? h('em', { class: 'jw-tag new', text: 'New' }) : null);
            (b.querySelector('.jw-dot') as HTMLElement).style.background = FINISHES[o.finish].metal;
            b.style.setProperty('--rarity', RARITY_COLOURS[d.rarity]);
            return b;
          }))
        : h('p', { class: 'hint', text: `No ${JEWEL_CAT_LABELS[c].toLowerCase()} yet.` }));
  });
  const d = JEWELS[sel.id];
  const worn = isWorn(s, sel.uid);
  const acts: HTMLElement[] = [
    worn
      ? menuButton('Take it off', () => {
          removeJewel(progress, d.cat);
          changed();
          msg(`Took off the ${d.name}`);
        }, undefined, 'primary')
      : menuButton('Wear it', () => {
          const r = wearJewel(progress, sel.uid);
          if (r.ok) {
            changed();
            msg(`Wearing the ${d.name}`);
          } else msg(r.reason, true);
        }, `In place of your ${JEWEL_CAT_ONE[d.cat].toLowerCase()}`, 'primary'),
  ];
  if (extras.sell) {
    acts.push(menuButton(extras.confirmSell === sel.uid ? `Sell for ${money(jewelBuyback(d, sel.finish))}: sure?` : 'Sell it back', () => extras.sell!(sel), worn ? 'Take it off first' : `Marcus pays ${money(jewelBuyback(d, sel.finish))}`, extras.confirmSell === sel.uid ? 'danger' : 'quiet'));
  }
  // Seeing the box clears the "new" badges (after this draw).
  if (unseen.size) {
    markSeen(s);
    saved();
  }
  return [
    h('div', { class: 'prop-shop jw-box' },
      h('div', { class: 'jw-groups' }, ...groups),
      h('div', { class: 'prop-detail jw-detail' },
        jewelSlot({ id: sel.id, finish: sel.finish }),
        h('h3', { text: d.name }),
        h('div', { class: 'jw-chips' }, chip(RARITY_LABELS[d.rarity], RARITY_COLOURS[d.rarity]), chip(FINISHES[sel.finish].quality, FINISHES[sel.finish].metal), d.stone ? chip(STONES[d.stone].name, STONES[d.stone].colour) : null),
        h('p', { class: 'hint', text: `${d.spec}. Bought for ${money(sel.paid)}.` }),
        h('div', { class: 'row-actions' }, ...acts),
      ),
    ),
  ];
}

/** The jewellery box on its own (the inventory's Jewellery tab, the wardrobe at home). */
export function jewelleryBoxPanel(progress: Progress, changed: () => void, saved: () => void, say: (t: string, bad?: boolean) => void, rebuild: () => void, state: { sel: string | null }): HTMLElement {
  const s = progress.save;
  return h('div', { class: 'jw-panel' },
    wornStrip(progress, (c) => {
      removeJewel(progress, c);
      changed();
      say('Taken off');
      rebuild();
    }),
    ...boxBody(progress, state.sel, (u) => ((state.sel = u), rebuild()), (t, b) => (say(t, b), rebuild()), () => (changed(), rebuild()), saved),
    s.jewellery.owned.length ? h('p', { class: 'hint', text: 'Sell pieces back at Halden & Crane, Riverside Centre.' }) : null,
  );
}

/** A screen for just the jewellery box (opened from the character sheet). */
export function jewelleryBoxScreen(progress: Progress, close: () => void, changed: () => void, saved: () => void): Screen {
  const state = { sel: null as string | null };
  return panelScreen('Jewellery box', progress, (msg, rebuild) => [jewelleryBoxPanel(progress, changed, saved, msg, rebuild, state)], close);
}
