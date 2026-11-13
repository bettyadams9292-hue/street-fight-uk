import { BOSSES } from '../ai/bosses';
import { WEAPONS } from '../combat/Weapons';
import { STYLES } from '../data/styles';
import {
  MOVE_UNLOCKS,
  MOVE_UNLOCK_IDS,
  STYLE_LESSONS,
  UPGRADES,
  UPGRADE_IDS,
  xpForNextLevel,
} from '../progress/catalogue';
import type { AreaId, Progress, PurchaseResult } from '../progress/Progress';
import type { ItemStack } from '../items/Inventory';
import { ITEMS } from '../items/items';
import type { StyleId } from '../styles/StyleData';
import { LEVELS, DISTRICT_ORDER } from '../world/levels';
import { cycleRow, menuButton } from './controls';
import { screenLogo } from './screens';
import { h } from './dom';
import { firstTitle, titleArt } from './titles';
import { icon } from './icons';
import { COMPANIONS } from '../companions/companions';
import type { Screen } from './UIManager';

/**
 * The home hub's rooms and the story-mode menus. Every button here changes
 * the save through Progress; `changed` saves it and refreshes the player.
 */

export const MEAL_COST = 15;
export const TAXI_COST = 5;
/** Total secrets hidden around the neighbourhood. */
export const SECRET_COUNT = Object.values(LEVELS).reduce((n, l) => n + l.pickups.filter((p) => p.kind === 'secret').length, 0);

export function panelScreen(title: string, progress: Progress, body: (msg: (text: string, bad?: boolean) => void, rebuild: () => void) => HTMLElement[], close: () => void): Screen {
  const el = h('div', { class: 'screen panel-screen hub-screen' });
  let message = '';
  let bad = false;
  const build = () => {
    const s = progress.save;
    const wallet = `On you £${s.cash.pocket} · Tin £${s.cash.bank}`;
    const msgEl = h('div', { class: `hub-msg${bad ? ' bad' : ''}`, text: message });
    const set = (text: string, b = false) => {
      message = text;
      bad = b;
      build();
    };
    el.replaceChildren(
      h('div', { class: 'hub-head' }, h('h2', { text: title }), h('span', { class: 'wallet', text: wallet }), h('button', { class: 'icon-btn', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => close() }, icon('close'))),
      h('div', { class: 'panel' }, ...body(set, build), msgEl),
      h('div', { class: 'panel-actions' }, menuButton('Back', close)),
    );
  };
  build();
  return { el, onBack: close, onShow: build };
}

export function shopRow(name: string, text: string, button: string, onClick: (() => void) | null, owned = false): HTMLElement {
  const b = menuButton(button, () => onClick?.());
  if (!onClick) b.setAttribute('disabled', '');
  return h('div', { class: `shop-row${owned ? ' owned' : ''}` }, h('div', { class: 'what' }, h('b', { text: name }), h('span', { text })), b);
}

export const result = (r: PurchaseResult, ok: string, msg: (t: string, bad?: boolean) => void, changed: () => void) => {
  if (r.ok) {
    changed();
    msg(ok);
  } else msg(r.reason, true);
};

// ---- gym ------------------------------------------------------------------------------

export function gymScreen(progress: Progress, close: () => void, changed: () => void): Screen {
  return panelScreen('Gym', progress, (msg) => {
    const s = progress.save;
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: `Training points: ${s.trainingPoints} (one per level). Upgrades also cost money from the tin.` }), h('h3', { text: 'Training' })];
    for (const id of UPGRADE_IDS) {
      const def = UPGRADES[id];
      const rank = s.upgrades[id];
      const maxed = rank >= def.maxRank;
      rows.push(
        shopRow(`${def.name}  ${'▮'.repeat(rank)}${'▯'.repeat(def.maxRank - rank)}`, def.per, maxed ? 'Maxed' : `£${def.cost(rank)} + 1 pt`, maxed ? null : () => result(progress.buyUpgrade(id), `${def.name} up to rank ${rank + 1}`, msg, changed), maxed),
      );
    }
    rows.push(h('h3', { text: 'Moves' }));
    for (const id of MOVE_UNLOCK_IDS) {
      const def = MOVE_UNLOCKS[id];
      const have = s.moves.includes(id);
      const locked = !!def.requires && !progress.has(def.requires);
      rows.push(shopRow(def.name, locked ? `${def.text} (${def.requiresText})` : def.text, have ? 'Learned' : locked ? 'Locked' : `£${def.cost}`, have || locked ? null : () => result(progress.buyMove(id), `Learned ${def.name.toLowerCase()}`, msg, changed), have));
    }
    rows.push(h('h3', { text: 'Styles' }));
    for (const l of STYLE_LESSONS) {
      const have = s.styles.learned.includes(l.style);
      const locked = !!l.requires && !progress.has(l.requires);
      const name = STYLES[l.style].name;
      rows.push(shopRow(name, locked ? `${l.teacher} (${l.requiresText})` : `Taught by ${l.teacher}`, have ? 'Learned' : locked ? 'Locked' : `£${l.cost}`, have || locked ? null : () => result(progress.learnStyle(l.style), `Learned ${name}`, msg, changed), have));
    }
    const learned = s.styles.learned;
    rows.push(
      h('h3', { text: 'Your styles' }),
      cycleRow<StyleId>('Main style', learned.map((id) => ({ value: id, label: STYLES[id].name })), s.styles.primary, (v) => {
        progress.setStyles(v, s.styles.secondary === v ? null : s.styles.secondary);
        changed();
      }),
      cycleRow<StyleId | null>('Swap style (Tab)', [{ value: null, label: 'None' }, ...learned.map((id) => ({ value: id as StyleId | null, label: STYLES[id].name }))], s.styles.secondary, (v) => {
        progress.setStyles(s.styles.primary, v);
        changed();
      }),
    );
    return rows;
  }, close);
}

// ---- kitchen --------------------------------------------------------------------------

export function kitchenScreen(progress: Progress, close: () => void, heal: () => number, changed: () => void): Screen {
  return panelScreen('Kitchen', progress, (msg) => {
    const s = progress.save;
    return [
      shopRow('Brew and a sit down', 'Back to full health and stamina. Free.', 'Recover', () => {
        const n = heal();
        msg(n > 0 ? `Recovered ${n} health` : 'Already feeling fine');
      }),
      shopRow('Full English', `+25 max health for your next trip out (lost if you get battered).`, s.mealBuff ? 'Eaten' : `£${MEAL_COST}`, s.mealBuff ? null : () => result(progress.buyMeal(MEAL_COST), 'Proper fry-up. +25 max health until you’re next home.', msg, changed), s.mealBuff),
    ];
  }, close);
}

// ---- workbench: repair weapons ----------------------------------------------------------------

/** Cost to bring a weapon back to full: a share of its value per missing hit, at least a quid. */
export function repairCost(st: ItemStack): number {
  const d = ITEMS[st.id];
  const w = d?.weapon ? WEAPONS[d.weapon] : null;
  if (!w || st.hits === undefined || st.hits >= w.durability) return 0;
  const missing = (w.durability - st.hits) / w.durability;
  return Math.max(1, Math.round((w.value + 6) * 0.5 * missing));
}

export function repairScreen(progress: Progress, close: () => void, changed: () => void): Screen {
  return panelScreen('Workbench', progress, (msg) => {
    const s = progress.save;
    const weapons: { st: ItemStack; where: string }[] = [];
    if (s.held) weapons.push({ st: s.held, where: 'in your hands' });
    for (const st of s.inventory) if (ITEMS[st.id].weapon) weapons.push({ st, where: 'in your pockets' });
    for (const st of s.storage) if (ITEMS[st.id].weapon) weapons.push({ st, where: 'in the stash' });
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: 'Tape, glue and the odd bolt. Bring a battered weapon back to full strength, paid from the tin. Things that smash (bottles, tellies) can\u2019t be fixed.' })];
    if (!weapons.length) rows.push(h('p', { text: 'No weapons to work on. Pick some up out there; spares can live in the stash.' }));
    for (const { st, where } of weapons) {
      const d = ITEMS[st.id];
      const w = WEAPONS[d.weapon!];
      const cost = repairCost(st);
      const fixable = !w.breaks || w.durability > 2;
      rows.push(
        shopRow(`${d.name}  ${st.hits ?? w.durability}/${w.durability}`, where, cost === 0 ? 'Good as new' : !fixable ? 'Can\u2019t fix' : `Fix \u00a3${cost}`, cost === 0 || !fixable ? null : () => {
          if (s.cash.bank < cost) return msg(`Need \u00a3${cost} in the tin`, true);
          s.cash.bank -= cost;
          st.hits = w.durability;
          changed();
          msg(`${d.name} fixed up`);
        }),
      );
    }
    return rows;
  }, close);
}

// ---- the Red Lion bar -----------------------------------------------------------------------------

export const BAR_MENU: { id: string; price: number }[] = [
  { id: 'can_of_pop', price: 2 },
  { id: 'water', price: 1 },
  { id: 'flask_tea', price: 3 },
  { id: 'sausage_roll', price: 3 },
  { id: 'pasty', price: 4 },
  { id: 'fry_up', price: 12 },
  { id: 'first_aid', price: 18 },
];

export function barScreen(progress: Progress, close: () => void, changed: () => void, rob?: () => void): Screen {
  let confirmRob = false;
  return panelScreen('The Red Lion', progress, (msg, rebuild) => {
    const rows: HTMLElement[] = [h('p', { class: 'hint', text: '"What can I get you? Kitchen\u2019s open till ten. And there\u2019s a first aid kit behind the bar, if you\u2019re after a fight."' })];
    // Ray remembers a robbery: prices go up by the same margin as at Threads.
    const mult = progress.shop('pub').priceMult;
    if (mult > 1) rows.push(h('p', { class: 'warn-line', text: 'Ray hasn\u2019t forgotten. Everything costs you more now.' }));
    for (const m of BAR_MENU) {
      const d = ITEMS[m.id];
      const price = Math.round(m.price * mult);
      rows.push(
        shopRow(d.name, d.use?.text ?? d.text, `\u00a3${price}`, () => {
          if (progress.spaceFor(m.id) < 1) return msg('Your pockets are full', true);
          if (!progress.pay(price)) return msg(`You need \u00a3${price}`, true);
          progress.giveItem(m.id);
          changed();
          msg(`${d.name}. In your pocket.`);
        }),
      );
    }
    if (rob) {
      rows.push(
        confirmRob
          ? shopRow('Do it: rob the pub', 'Grab the takings. Alarm, police and heat follow.', 'Rob', () => rob())
          : shopRow('Rob the pub\u2026', 'Think about it first', 'Rob?', () => { confirmRob = true; rebuild(); }),
      );
    }
    return rows;
  }, close);
}

// ---- living room: sofa, phone, tin -----------------------------------------------------

export function sofaScreen(progress: Progress, close: () => void, save: () => boolean): Screen {
  return panelScreen('Living room', progress, (msg) => {
    const s = progress.save;
    const rows: HTMLElement[] = [h('h3', { text: 'The story so far' })];
    let nextShown = false;
    for (const d of DISTRICT_ORDER) {
      const done = progress.has(d.flag);
      const boss = Object.values(BOSSES).find((b) => b.flag === d.flag)!;
      const next = !done && !nextShown;
      if (next) nextShown = true;
      rows.push(h('div', { class: 'shop-row' + (done ? ' owned' : '') }, h('div', { class: 'what' }, h('b', { text: `${boss.name}, ${boss.title}` }), h('span', { text: done ? `Beaten. ${LEVELS[d.area].district} is yours.` : next ? `Next: ${d.label}.` : 'Not yet.' })), h('span', { text: '' })));
    }
    if (progress.has('boss_dunc')) rows.push(h('p', { class: 'hint', text: 'Big Dunc is done. The neighbourhood is yours. Keep exploring for anything you missed.' }));
    rows.push(
      h('h3', { text: 'Record' }),
      h('p', { text: `Level ${s.level} · XP ${s.xp}/${xpForNextLevel(s.level)} · ${s.stats.kos} knocked out · ${s.stats.bosses} bosses · ${s.stats.secrets}/${SECRET_COUNT} secrets · battered ${s.stats.deaths} times` }),
      shopRow('Save the game', s.savedAt ? `Last saved ${new Date(s.savedAt).toLocaleString()}` : 'Not saved yet', 'Save', () => msg(save() ? 'Saved' : 'Couldn’t save: your browser blocked storage', !save)),
    );
    return rows;
  }, close);
}

/** Areas you can get a cab to, and what opens each one. */
export const TAXI_STOPS: { area: AreaId; entry: string; requires?: string; requiresText?: string }[] = [
  { area: 'high_street', entry: 'left' },
  { area: 'alleys', entry: 'left', requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first' },
  { area: 'industrial', entry: 'left', requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first' },
  { area: 'subway', entry: 'left', requires: 'boss_sully', requiresText: 'Beat Sully first' },
  { area: 'city', entry: 'left', requires: 'boss_sully', requiresText: 'Beat Sully first' },
  { area: 'territory', entry: 'left', requires: 'boss_ratcatcher', requiresText: 'Beat the Ratcatcher first' },
  { area: 'residential', entry: 'right' },
  { area: 'leisure', entry: 'right', requires: 'boss_estate_king', requiresText: 'Beat the Estate King first' },
  { area: 'market', entry: 'left', requires: 'boss_gaffer', requiresText: 'Beat the Gaffer first' },
  { area: 'docks', entry: 'left', requires: 'boss_sully', requiresText: 'Beat Sully first' },
  { area: 'precinct', entry: 'left', requires: 'boss_sully', requiresText: 'Beat Sully first' },
  { area: 'mall', entry: 'left', requires: 'boss_precinct', requiresText: 'Beat Dean Pryce first' },
];

/** Straight to the shop door. Pawn & Gold has a back door with a cab home, so it's safe to visit early. */
export const SHOP_STOPS: { area: AreaId; entry: string; where: string; shop?: string }[] = [
  { area: 'pawn_shop', entry: 'door', where: 'Sell valuables. Market Square, City Centre', shop: 'pawn' },
  { area: 'clothes_shop', entry: 'door', where: 'Clothes and bags. High Street', shop: 'threads' },
  { area: 'pub', entry: 'door', where: 'Food, drink, pool. High Street', shop: 'pub' },
  { area: 'furniture_shop', entry: 'door', where: 'Furniture, floors and walls. High Street' },
  { area: 'car_dealer', entry: 'door', where: 'Cars. Brackley Trading Estate' },
  { area: 'bike_shop', entry: 'door', where: 'Off-road bikes. Brackley Trading Estate' },
  { area: 'gym_store', entry: 'door', where: 'Home gym equipment. Leisure Park' },
  { area: 'boxing_gym', entry: 'door', where: 'Boxing and kickboxing. Tanner Road Estate' },
  { area: 'karate_dojo', entry: 'door', where: 'Karate and Muay Thai. Leisure Park' },
  { area: 'wrestling_club', entry: 'door', where: 'Wrestling and BJJ. Kingsway Precinct' },
  { area: 'grow_shop', entry: 'door', where: 'Basement equipment. Brackley Trading Estate' },
  { area: 'casino', entry: 'door', where: 'Slots, roulette, blackjack, prize motors. Market Square' },
  { area: 'jeweller', entry: 'door', where: 'Rings, watches, chains and grills. Riverside Centre', shop: 'jeweller' },
  { area: 'estate_agent', entry: 'door', where: 'Buy, sell and let property. Meridian House, City Centre' },
  { area: 'ashcombe', entry: 'gate', where: 'Mansions and penthouses for sale. Off Leisure Park' },
];

export function contactsScreen(progress: Progress, close: () => void, openMap: () => void, crew?: () => void): Screen {
  return panelScreen('Phone', progress, () => {
    const s = progress.save;
    const next = DISTRICT_ORDER.find((d) => !d.optional && !progress.has(d.flag));
    return [
      h('div', { class: 'phone-msg' }, h('b', { text: 'Mo' }), h('p', { text: next ? `“${hintFor(next.flag)}”` : '“You did it. Nobody runs these streets now. Mad.”' })),
      shopRow('Dave’s Cabs', `£${TAXI_COST} a ride from the tin. Pick where on the map.`, 'Open map', openMap),
      ...(crew ? [shopRow('Your crew', s.companions.following.length ? `Following you: ${s.companions.following.map((id) => COMPANIONS[id]?.nickname ?? id).join(', ')}` : `${s.companions.recruited.length} hired. Nobody with you.`, 'Manage (H)', crew)] : []),
    ];
  }, close);
}

function hintFor(flag: string): string {
  switch (flag) {
    case 'boss_gaffer':
      return 'Gaz Mullins thinks he owns the High Street. He drinks at the Gaffer’s Arms, far end. Sort him out and the alleys open up.';
    case 'boss_sully':
      return 'Sully Kane used to be a proper boxer. Runs a gym at the end of the Canal Side yard. Watch his hands.';
    case 'boss_ratcatcher':
      return 'The Ratcatcher drinks at the Rat & Castle in town. He’ll try to tie you up. Don’t let him get you on the floor.';
    case 'boss_docks':
      return 'Down the towpath from Sully\u2019s yard there\u2019s the old canal docks. Big Lenny Shaw runs them. Huge bloke, grabs and throws.';
    case 'boss_precinct':
      return 'Kingsway Precinct, through the walkway off Market Square. Dean Pryce takes money off every shop. He\u2019s got the VIP passes for the Neon Mile too.';
    case 'boss_nightclub':
      return 'With Pryce\u2019s VIP pass you can get onto the Neon Mile. Simone Achebe owns Velvet. Fast feet, watch the kicks.';
    case 'boss_stadium':
      return 'Kirkgate Ground, past the leisure park. You need the service key: Maureen at the Old Market keeps one. The firm\u2019s top boy is Carl Briggs.';
    case 'boss_dunc':
      return 'Big Dunc. The Pit, past the city. Everything leads back to him.';
    default:
      return 'Victor Hale. Hale House, past the Pit. This is where it ends.';
  }
}

export function tinScreen(progress: Progress, close: () => void, changed: () => void): Screen {
  return panelScreen('Biscuit tin', progress, (msg) => {
    const s = progress.save;
    return [
      h('p', { text: 'Money in the tin is safe and pays for training, food and cabs. Money in your pocket goes with you, and some of it goes if you get battered.' }),
      shopRow('Put it in the tin', `£${s.cash.pocket} on you`, s.cash.pocket > 0 ? `Bank £${s.cash.pocket}` : 'Nothing on you', s.cash.pocket > 0 ? () => {
        const n = progress.bankAll();
        changed();
        msg(`Put £${n} in the tin. £${s.cash.bank} saved.`);
      } : null),
    ];
  }, close);
}

// ---- story menus --------------------------------------------------------------------------

export function storyPauseMenu(actions: { resume: () => void; inventory: () => void; map: () => void; character: () => void; home: (() => void) | null; homeWhy: string; save: () => void; settings: () => void; controls: () => void; quit: () => void }): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    screenLogo(),
    h('h2', {}, titleArt('Paused', 'pause')),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Resume', actions.resume, undefined, 'primary', 'play', 'Esc', 'resume'),
      menuButton('Map', actions.map, undefined, '', 'map', 'M'),
      menuButton('Inventory', actions.inventory, undefined, '', 'bag', 'I'),
      menuButton('Character & crew', actions.character, undefined, '', 'contact', 'H', 'character'),
      actions.home ? menuButton('Head home', actions.home, 'Fights here will still be waiting', '', 'home', undefined, 'home') : actions.homeWhy ? h('div', { class: 'hint', text: actions.homeWhy }) : null,
      h('div', { class: 'menu-gap' }),
      menuButton('Save', actions.save, undefined, '', 'save'),
      menuButton('Settings', actions.settings, undefined, '', 'settings', undefined, 'settings'),
      menuButton('Controls', actions.controls, undefined, '', 'controls', undefined, 'controls'),
      menuButton('Save and quit', actions.quit, undefined, '', 'quit', undefined, 'exit'),
    ),
  );
  return {
    el,
    onBack: actions.resume,
    onAction: (a) => {
      if (a === 'pause') {
        actions.resume();
        return true;
      }
      if (a === 'map') {
        actions.map();
        return true;
      }
      if (a === 'inventory') {
        actions.inventory();
        return true;
      }
      if (a === 'character') {
        actions.character();
        return true;
      }
      return false;
    },
  };
}

/** `art`: title graphics to show for the heading, the first that exists (e.g. you-win, level-complete). */
export function rewardScreen(title: string, lines: { text: string; big?: boolean }[], buttons: { label: string; sub?: string; go: () => void }[], art: string[] = []): Screen {
  const slug = firstTitle(...art);
  const el = h(
    'div',
    { class: `screen pause-menu${slug ? ' reward-art' : ''}` },
    h('h2', {}, slug ? titleArt(title, slug, 'reward-title') : title),
    h('ul', { class: 'reward-list' }, ...lines.map((l) => h('li', { class: l.big ? 'big' : '', text: l.text }))),
    h('nav', { class: 'menu-list' }, ...buttons.map((b) => menuButton(b.label, b.go, b.sub))),
  );
  // Back picks the first (main) choice: never strands you on this screen.
  return { el, onBack: buttons[0].go };
}
