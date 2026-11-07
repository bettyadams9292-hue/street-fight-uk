import { BOSSES } from '../ai/bosses';
import { WEAPONS, type WeaponId } from '../combat/Weapons';
import { STYLES } from '../data/styles';
import {
  GEAR,
  MOVE_UNLOCKS,
  MOVE_UNLOCK_IDS,
  STYLE_LESSONS,
  UPGRADES,
  UPGRADE_IDS,
  xpForNextLevel,
  type GearId,
} from '../progress/catalogue';
import type { AreaId, Progress, PurchaseResult } from '../progress/Progress';
import type { StyleId } from '../styles/StyleData';
import { LEVELS, DISTRICT_ORDER } from '../world/levels';
import { cycleRow, menuButton } from './controls';
import { h } from './dom';
import type { Screen } from './UIManager';

/**
 * The home hub's rooms and the story-mode menus. Every button here changes
 * the save through Progress; `changed` saves it and refreshes the player.
 */

export const MEAL_COST = 15;
export const TAXI_COST = 5;
/** Total secrets hidden around the neighbourhood. */
export const SECRET_COUNT = Object.values(LEVELS).reduce((n, l) => n + l.pickups.filter((p) => p.kind === 'secret').length, 0);

function panelScreen(title: string, progress: Progress, body: (msg: (text: string, bad?: boolean) => void, rebuild: () => void) => HTMLElement[], close: () => void): Screen {
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
      h('div', { class: 'hub-head' }, h('h2', { text: title }), h('span', { class: 'wallet', text: wallet })),
      h('div', { class: 'panel' }, ...body(set, build), msgEl),
      h('div', { class: 'panel-actions' }, menuButton('Back', close)),
    );
  };
  build();
  return { el, onBack: close, onShow: build };
}

function shopRow(name: string, text: string, button: string, onClick: (() => void) | null, owned = false): HTMLElement {
  const b = menuButton(button, () => onClick?.());
  if (!onClick) b.setAttribute('disabled', '');
  return h('div', { class: `shop-row${owned ? ' owned' : ''}` }, h('div', { class: 'what' }, h('b', { text: name }), h('span', { text })), b);
}

const result = (r: PurchaseResult, ok: string, msg: (t: string, bad?: boolean) => void, changed: () => void) => {
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

// ---- garage ---------------------------------------------------------------------------

export function garageScreen(progress: Progress, close: () => void, changed: () => void): Screen {
  return panelScreen('Garage', progress, () => {
    const s = progress.save;
    const rows: HTMLElement[] = [
      h('h3', { text: 'Take a weapon out' }),
      cycleRow<WeaponId | null>('Weapon', [{ value: null, label: 'Bare hands' }, ...s.weapons.map((w) => ({ value: w as WeaponId | null, label: WEAPONS[w].name }))], s.equipped.weapon, (v) => {
        s.equipped.weapon = v;
        changed();
      }),
      h('p', { class: 'hint', text: s.weapons.length ? 'You start each trip holding it. It wears out and drops if you’re knocked down, but the garage always has another.' : 'Pick up a weapon out on the streets and a spare ends up here.' }),
      h('h3', { text: 'Gear' }),
      cycleRow<GearId | null>('Wearing', [{ value: null, label: 'Nothing' }, ...s.gear.map((g) => ({ value: g as GearId | null, label: GEAR[g].name }))], s.equipped.gear, (v) => {
        s.equipped.gear = v;
        changed();
      }),
    ];
    for (const g of s.gear) rows.push(h('div', { class: 'shop-row' }, h('div', { class: 'what' }, h('b', { text: GEAR[g].name }), h('span', { text: GEAR[g].text })), h('span', { text: s.equipped.gear === g ? 'On' : '' })));
    if (s.gear.length < Object.keys(GEAR).length) rows.push(h('p', { class: 'hint', text: `${Object.keys(GEAR).length - s.gear.length} more bits of gear are stashed around the neighbourhood.` }));
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
];

export function contactsScreen(progress: Progress, close: () => void, travel: (area: AreaId, entry: string) => void, changed: () => void): Screen {
  return panelScreen('Phone', progress, (msg) => {
    const s = progress.save;
    const next = DISTRICT_ORDER.find((d) => !progress.has(d.flag));
    const rows: HTMLElement[] = [
      h('h3', { text: 'Messages' }),
      h('p', { text: next ? `Mo: "${hintFor(next.flag)}"` : 'Mo: "You did it. Nobody runs these streets now. Mad."' }),
      h('h3', { text: `Dave’s Cabs: £${TAXI_COST} a ride, paid from the tin` }),
    ];
    for (const stop of TAXI_STOPS) {
      const lvl = LEVELS[stop.area];
      const locked = !!stop.requires && !progress.has(stop.requires);
      rows.push(
        shopRow(lvl.district, locked ? stop.requiresText ?? 'Not yet' : lvl.name, locked ? 'Locked' : `£${TAXI_COST}`, locked ? null : () => {
          if (s.cash.bank < TAXI_COST) return msg(`Need £${TAXI_COST} in the tin`, true);
          s.cash.bank -= TAXI_COST;
          changed();
          travel(stop.area, stop.entry);
        }),
      );
    }
    return rows;
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
    default:
      return 'Big Dunc. The Pit, past the city. Everything leads back to him.';
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

export function storyPauseMenu(actions: { resume: () => void; home: (() => void) | null; homeWhy: string; save: () => void; settings: () => void; controls: () => void; quit: () => void }): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    h('h2', { text: 'Paused' }),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Resume', actions.resume),
      actions.home ? menuButton('Head home', actions.home, 'Back to your house. Fights here will still be waiting.') : actions.homeWhy ? h('div', { class: 'hint', text: actions.homeWhy }) : null,
      menuButton('Save', actions.save),
      menuButton('Settings', actions.settings),
      menuButton('Controls', actions.controls),
      menuButton('Save and quit to menu', actions.quit),
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
      return false;
    },
  };
}

export function rewardScreen(title: string, lines: { text: string; big?: boolean }[], buttons: { label: string; sub?: string; go: () => void }[]): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    h('h2', { text: title }),
    h('ul', { class: 'reward-list' }, ...lines.map((l) => h('li', { class: l.big ? 'big' : '', text: l.text }))),
    h('nav', { class: 'menu-list' }, ...buttons.map((b) => menuButton(b.label, b.go, b.sub))),
  );
  // Back picks the first (main) choice: never strands you on this screen.
  return { el, onBack: buttons[0].go };
}
