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
import { jewelBonus, XP_BONUS_CAP } from '../items/gearBonus';
import { menuButton } from './controls';
import { h } from './dom';
import { icon } from './icons';
import { panelScreen } from './hub';
import type { Screen } from './UIManager';

/**
 * H. Sterling, the jewellers: browse each case, turn a piece over in the
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
  return panelScreen('H. Sterling', progress, (msg, rebuild) => {
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
      h('p', { class: 'hint jw-intro', text: 'Everything you buy goes in your jewellery box for good: it never takes a pocket and you can’t lose it in a fight. Wear one of each: a ring, a watch, a chain, a bracelet, earrings and a grill.' }),
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
      bonusLine(d, finish),
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
    return [h('div', { class: 'inv-empty', text: 'Your jewellery box is empty. H. Sterling in the Riverside Centre sells rings, watches, chains and grills.' })];
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
        h('p', { class: 'hint', text: `${d.spec}. ${sel.paid > 0 ? `Bought for ${money(sel.paid)}.` : 'Taken in a fight: it cost you nothing.'}` }),
        bonusLine(d, sel.finish),
        h('div', { class: 'row-actions' }, ...acts),
      ),
    ),
  ];
}

/** The jewellery box on its own (the inventory's Jewellery tab, the wardrobe at home). */
/**
 * The jewellery box as a body: a silhouette, head to hands, with a tag off each place you can wear something
 * (ears, mouth, neck, both wrists, the ring finger) saying what's on it. Tap a place (on the body or its tag)
 * and the drawer underneath lists what you own for it; tap a piece to put it on, tap it again to take it off.
 * A tick shows what you're wearing. The lead hand is the left: the watch and ring go there, the bracelet on
 * the right wrist (as `render/jewellery.ts` fits them).
 */
type Spot = { cat: JewelCat; where: string; side: 'l' | 'r'; y: number; at: [number, number] };
const SPOTS: Spot[] = [
  { cat: 'earring', where: 'Ears', side: 'l', y: 62, at: [172, 78] },
  { cat: 'necklace', where: 'Neck', side: 'l', y: 160, at: [210, 142] },
  { cat: 'bracelet', where: 'Right wrist', side: 'l', y: 318, at: [129, 318] },
  { cat: 'grill', where: 'Teeth', side: 'r', y: 84, at: [210, 96] },
  { cat: 'watch', where: 'Left wrist', side: 'r', y: 280, at: [291, 318] },
  { cat: 'ring', where: 'Left hand', side: 'r', y: 372, at: [296, 372] },
];

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** What a piece does for you: its XP bonus and its buff. */
function bonusLine(d: (typeof JEWELS)[string], finish: FinishId): HTMLElement {
  const b = jewelBonus(d, finish);
  return h('p', { class: 'jw-bonus' }, h('b', { text: b.xpText }), h('span', { text: ` · ${b.name}: ${b.stats.map((x) => x.text).join(', ')}` }));
}

export function jewelleryBoxPanel(progress: Progress, changed: () => void, saved: () => void, say: (t: string, bad?: boolean) => void, rebuild: () => void, state: { sel: string | null; slot?: JewelCat }): HTMLElement {
  const s = progress.save;
  const owned = s.jewellery.owned;
  const unseen = new Set(s.jewellery.unseen);
  const wornOf = (c: JewelCat) => {
    const uid = s.jewellery.worn[c];
    return uid ? owned.find((x) => x.uid === uid) : undefined;
  };
  const mineOf = (c: JewelCat) => owned.filter((o) => JEWELS[o.id].cat === c);
  // Open on the place you last looked at, else the first with something new, else the first you own anything for.
  const slot: JewelCat = state.slot ?? SPOTS.find((p) => mineOf(p.cat).some((o) => unseen.has(o.uid)))?.cat ?? SPOTS.find((p) => mineOf(p.cat).length)?.cat ?? 'watch';
  const pick = (c: JewelCat) => {
    state.slot = c;
    rebuild();
  };

  // The figure: head, neck, shoulders, arms down, hands; front on, so your left is on the right.
  const fig = svg('svg', { viewBox: '0 0 420 420', class: 'jb-fig', 'aria-hidden': 'true' });
  const body = svg('g', { class: 'jb-body' });
  // One outline, head to hands: head and ears, neck, shoulders, arms hanging with a gap at the sides, hands.
  body.append(svg('path', { d: [
    'M210 30 C230 30 243 46 244 66',
    'C252 63 255 86 245 89 C242 101 233 110 226 114 L226 130',
    'C233 141 252 146 270 150 C292 156 301 175 302 196',
    'C305 230 307 258 307 280 C307 298 303 312 300 322 C304 330 307 342 306 352 C306 365 302 379 296 385 C292 388 287 383 287 372 L286 358 C283 362 280 367 278 370 C275 374 272 371 274 365 C276 353 279 339 281 326 L281 322 C278 300 274 282 272 268 L267 238',
    'L265 334 C236 344 184 344 155 334 L153 238',
    'L148 268 C146 282 142 300 139 322 L139 326 C141 339 144 353 146 365 C148 371 145 374 142 370 C140 367 137 362 134 358 L133 372 C133 383 128 388 124 385 C118 379 114 365 114 352 C113 342 116 330 120 322 C117 312 113 298 113 280 C113 258 115 230 118 196',
    'C119 175 128 156 150 150 C168 146 187 141 194 130 L194 114 C187 110 178 101 175 89',
    'C165 86 168 63 176 66 C177 46 190 30 210 30 Z',
  ].join(' ') }));
  // The gaps between the fingers, drawn as fine lines so the hands read as hands.
  for (const sx of [1, -1]) {
    const x = (v: number) => (sx > 0 ? v : 420 - v);
    body.append(svg('path', { class: 'jb-crease', d: `M${x(301)} 356 Q${x(302)} 366 ${x(300)} 377 M${x(296)} 358 Q${x(297)} 370 ${x(295)} 382 M${x(291)} 359 Q${x(292)} 371 ${x(290)} 382` }));
  }
  fig.append(body);
  for (const p of SPOTS) {
    const on = !!wornOf(p.cat);
    // Two leads: to the tags over the figure's sides (upright), and to tags further out (a wide stage, sideways).
    for (const [lx, k] of [[p.side === 'l' ? 104 : 316, 'p'], [p.side === 'l' ? 49 : 371, 'w']] as const)
      fig.append(svg('path', { d: `M${lx} ${p.y} L${(lx + p.at[0]) / 2} ${p.y} L${p.at[0]} ${p.at[1]}`, class: `jb-lead ${k}${p.cat === slot ? ' sel' : ''}${on ? ' on' : ''}` }));
  }
  for (const p of SPOTS) {
    const on = !!wornOf(p.cat);
    const dot = svg('circle', { cx: p.at[0], cy: p.at[1], r: p.cat === 'ring' ? 7 : 10, class: `jb-spot${p.cat === slot ? ' sel' : ''}${on ? ' on' : ''}` });
    dot.addEventListener('click', () => pick(p.cat));
    fig.append(svg('circle', { cx: p.at[0], cy: p.at[1], r: 22, class: 'jb-hit' }), dot);
    (fig.lastChild!.previousSibling as SVGElement).addEventListener('click', () => pick(p.cat));
  }

  // A tag off each place: what it is, and what's on it.
  const tags = SPOTS.map((p) => {
    const o = wornOf(p.cat);
    const n = mineOf(p.cat).length;
    const fresh = mineOf(p.cat).some((x) => unseen.has(x.uid));
    const t = h('button', { class: `jb-tag ${p.side}${p.cat === slot ? ' sel' : ''}${o ? ' on' : ''}`, 'data-nav': true, 'data-grid': true, 'aria-pressed': String(p.cat === slot), onclick: () => pick(p.cat) },
      h('small', { text: p.where }),
      h('b', { text: o ? JEWELS[o.id].name : n ? `${n} to choose` : 'Nothing yet' }),
      fresh ? h('i', { class: 'jb-new', text: 'New' }) : null);
    t.style.top = `${(p.y / 420) * 100}%`;
    return t;
  });

  // The drawer: everything you own for the place picked; tap to put on, tap again to take off.
  const spot = SPOTS.find((p) => p.cat === slot)!;
  const mine = mineOf(slot);
  const worn = wornOf(slot);
  const toggle = (o: OwnedJewel) => {
    const d = JEWELS[o.id];
    if (isWorn(s, o.uid)) {
      removeJewel(progress, slot);
      changed();
      say(`Took off the ${d.name}`);
    } else {
      const r = wearJewel(progress, o.uid);
      if (r.ok) {
        changed();
        say(`Wearing the ${d.name}`);
      } else say(r.reason, true);
    }
    rebuild();
  };
  const rows = mine.map((o) => {
    const d = JEWELS[o.id];
    const on = isWorn(s, o.uid);
    const r = h('button', { class: `jb-row${on ? ' on' : ''}`, 'data-nav': true, role: 'switch', 'aria-checked': String(on), onclick: () => toggle(o) },
      h('i', { class: 'jb-metal' }),
      h('span', { class: 'jb-name' }, h('b', { text: d.name }), h('span', { text: `${FINISHES[o.finish].name}${d.stone ? ` · ${STONES[d.stone].name}` : ''} · ${RARITY_LABELS[d.rarity]}` }), h('span', { class: 'jb-bonus', text: [jewelBonus(d, o.finish).xpText, ...jewelBonus(d, o.finish).stats.map((x) => x.text)].join(', ') })),
      unseen.has(o.uid) ? h('i', { class: 'jb-new', text: 'New' }) : null,
      h('span', { class: 'jb-tick', 'aria-hidden': 'true' }, on ? icon('check') : null));
    const fin = FINISHES[o.finish];
    (r.querySelector('.jb-metal') as HTMLElement).style.background = fin.metal2 ? `linear-gradient(135deg, ${fin.metal} 50%, ${fin.metal2} 50%)` : fin.metal;
    r.style.setProperty('--rarity', RARITY_COLOURS[d.rarity]);
    return r;
  });
  const drawer = h('div', { class: 'jb-drawer' },
    h('div', { class: 'jb-head' },
      h('div', {}, h('small', { text: spot.where }), h('h3', { text: JEWEL_CAT_LABELS[slot] })),
      worn ? jewelSlot({ id: worn.id, finish: worn.finish }) : null),
    rows.length
      ? h('div', { class: 'jb-rows' }, ...rows)
      : h('p', { class: 'jb-empty', text: `No ${JEWEL_CAT_LABELS[slot].toLowerCase()} yet. H. Sterling in the Riverside Centre sells them, and some turn up after a fight.` }),
    rows.length ? h('p', { class: 'hint', text: worn ? 'Tap the one you’re wearing to take it off.' : 'Tap one to put it on.' }) : null,
    h('p', { class: 'jb-xp' }, h('b', { text: `+${Math.round(progress.xpBonus * 100)}% XP` }), h('span', { text: ` from what you’re wearing (up to ${Math.round(XP_BONUS_CAP * 100)}%). Four pieces on at once adds more, six more again.` })),
  );

  // Looking at a place clears its "new" badges (after this draw).
  if (mine.some((o) => unseen.has(o.uid))) {
    s.jewellery.unseen = s.jewellery.unseen.filter((u) => !mine.some((o) => o.uid === u));
    saved();
  }
  void markSeen;
  return h('div', { class: 'jw-panel jb' },
    h('div', { class: 'jb-stage' }, fig, ...tags),
    drawer,
  );
}

/** A screen for just the jewellery box (opened from the character sheet). */
export function jewelleryBoxScreen(progress: Progress, close: () => void, changed: () => void, saved: () => void): Screen {
  const state = { sel: null as string | null };
  return panelScreen('Jewellery box', progress, (msg, rebuild) => [jewelleryBoxPanel(progress, changed, saved, msg, rebuild, state)], close);
}
