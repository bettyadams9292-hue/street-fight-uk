import type { AttackButton } from '../input/Commands';
import type { MoveData } from '../combat/MoveData';
import type { StyleData } from '../styles/StyleData';
import type { Screen } from './UIManager';
import { h } from './dom';
import { menuButton } from './controls';
import { titleArt } from './titles';
import { FINISHER_COOLDOWN } from '../fighter/Fighter';

/** What each attack button is called, on each kind of controller. */
export type Device = 'touch' | 'keyboard' | 'gamepad';
const BUTTONS: Record<AttackButton, Record<Device, string>> = {
  lp: { touch: 'Punch', keyboard: 'J', gamepad: 'X' },
  hp: { touch: 'Hard punch', keyboard: 'I', gamepad: 'Y' },
  lk: { touch: 'Kick', keyboard: 'K', gamepad: 'A' },
  hk: { touch: 'Hard kick', keyboard: 'L', gamepad: 'B' },
};
const SPECIAL: Record<Device, string> = { touch: 'Special', keyboard: 'O', gamepad: 'RB' };
const GRAB: Record<Device, string> = { touch: 'Grab', keyboard: 'U', gamepad: 'LB' };

export function buttonName(b: AttackButton, device: Device): string {
  return BUTTONS[b][device];
}

/**
 * Every combo a style can chain from neutral: walk the `next` graph from each starter and keep the
 * longest routes (a route that is the start of a longer one is dropped). Repeats of a move end a route.
 */
export function comboRoutes(style: StyleData, max = 6): MoveData[][] {
  const routes: MoveData[][] = [];
  const walk = (path: MoveData[]) => {
    const last = path[path.length - 1];
    const nexts = Object.values(last.next ?? {})
      .map((id) => style.moves[id as string])
      .filter((m): m is MoveData => !!m && !path.includes(m));
    if (!nexts.length || path.length >= 5) {
      if (path.length >= 2) routes.push(path);
      return;
    }
    for (const n of nexts) walk([...path, n]);
  };
  for (const id of Object.values(style.starters)) {
    const m = style.moves[id];
    if (m) walk([m]);
  }
  // Longest first, then drop routes that only repeat another's opening, and near-duplicates.
  routes.sort((a, b) => b.length - a.length);
  const seen = new Set<string>();
  const out: MoveData[][] = [];
  for (const r of routes) {
    const key = r.map((m) => m.id).join('>');
    if ([...seen].some((s) => s.startsWith(key))) continue;
    const ends = `${r[0].id}>${r[r.length - 1].id}`;
    if (seen.has(ends)) continue;
    seen.add(key);
    seen.add(ends);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** How fast a move comes out, from its wind-up (frames at 60 a second), in words. */
function speed(m: MoveData): { label: string; cls: string } {
  if (m.kind === 'finisher') return { label: 'Ends it', cls: 'fin' };
  if (m.kind === 'grab' || m.kind === 'clinch') return { label: 'Up close', cls: 'clinch' };
  const s = m.startup;
  return s <= 7 ? { label: 'Fast', cls: 'fast' } : s <= 13 ? { label: 'Medium', cls: 'mid' } : { label: 'Slow', cls: 'slow' };
}

/** What it does besides the damage, in plain words. */
function effect(m: MoveData): string {
  const bits: string[] = [];
  if (m.reaction === 'knockdown') bits.push('knocks them down');
  else if (m.reaction === 'stagger') bits.push('staggers them (sets up a finisher)');
  if (m.unblockable) bits.push('can’t be blocked');
  if (m.staminaDamage) bits.push('tires them out');
  if (m.slowFrames) bits.push('slows them down');
  if (m.height === 'low') bits.push('hits low');
  return bits.join(' · ');
}

/** Damage as a bar out of the hardest normal hit (about 30), with the number beside it. */
const MAX_HIT = 30;
function damageCell(m: MoveData): HTMLElement {
  if (m.damage >= 100 || m.kind === 'finisher') return h('td', { class: 'ml-dmg' }, h('b', { text: 'KO' }));
  const d = Math.round(m.damage);
  const bar = h('i', { class: 'ml-bar' }, h('i', {}));
  (bar.firstChild as HTMLElement).style.width = `${Math.min(100, (d / MAX_HIT) * 100)}%`;
  return h('td', { class: 'ml-dmg', title: `${d} damage` }, bar, h('b', { text: String(d) }));
}

function keys(input: string): (HTMLElement | string)[] {
  return input.split(/( \+ |, then )/).map((k, i) => (i % 2 ? (k === ' + ' ? ' + ' : ' then ') : h('kbd', { text: k })));
}

function row(input: string, m: MoveData, note?: string): HTMLElement {
  const fx = note ?? effect(m);
  const sp = speed(m);
  return h(
    'tr',
    {},
    h('td', { class: 'ml-input' }, ...keys(input)),
    h('td', { class: 'ml-name' }, h('b', { text: m.name }), fx ? h('small', { text: fx }) : ''),
    h('td', { class: 'ml-kind' }, h('span', { class: `ml-speed ${sp.cls}`, text: sp.label })),
    damageCell(m),
  );
}

const head = () => h('thead', {}, h('tr', {}, h('th', { text: 'Press' }), h('th', { text: 'Move' }), h('th', { text: 'Speed' }), h('th', { class: 'r', text: 'Damage' })));

/** One style's moves: openers, specials, combos, what's possible up close, and the finisher. */
export function styleSection(style: StyleData, device: Device, tech: number): HTMLElement {
  const b = (x: AttackButton) => buttonName(x, device);
  const openers = (Object.entries(style.starters) as [AttackButton, string][]).map(([btn, id]) => [b(btn), style.moves[id]] as const).filter(([, m]) => !!m);
  const specials = (Object.entries(style.specials) as [AttackButton, string][]).map(([btn, id]) => [`${SPECIAL[device]} + ${b(btn)}`, style.moves[id]] as const).filter(([, m]) => !!m);
  const clinch = [
    [`${GRAB[device]}, then ${b('lp')}`, style.moves[style.clinch.strike]],
    [`${GRAB[device]}, then ${b('lk')}`, style.moves[style.clinch.throw]],
    [`${GRAB[device]}, then ${b('hk')}`, style.moves[style.clinch.power]],
  ].filter(([, m]) => !!m) as [string, MoveData][];
  const fin = style.moves[style.finisher];
  const combos = comboRoutes(style);
  const table = (rows: (readonly [string, MoveData])[]) => h('table', { class: 'move-table' }, head(), h('tbody', {}, ...rows.map(([i, m]) => row(i, m))));
  const comboItem = (r: MoveData[]) => {
    // Third hits and beyond need technique rank 3 in this style (Fighter.tryAttack): show where yours stops.
    const reach = tech >= 3 ? r.length : Math.min(r.length, 2);
    const total = r.slice(0, reach).reduce((t, m) => t + Math.round(m.damage), 0);
    const last = r[reach - 1];
    const ends = effect(last);
    return h(
      'li',
      { class: reach < r.length ? 'part' : '' },
      h('div', { class: 'route-keys' }, ...r.flatMap((m, i) => [i ? h('span', { class: 'arrow', text: '›' }) : '', h('kbd', { class: i >= reach ? 'locked' : '', text: b(m.button) })])),
      h('div', { class: 'route-names', text: r.map((m) => m.name).join(' → ') }),
      h('div', { class: 'route-sum' },
        h('b', { text: `${total} damage` }),
        ends ? h('span', { text: ` · last hit ${ends}` }) : '',
        reach < r.length ? h('em', { text: ` · the rest unlocks at ${style.name} rank 3` }) : ''),
    );
  };
  return h(
    'section',
    { class: 'move-style' },
    h('h3', { text: style.name }),
    h('p', { class: 'hint', text: style.blurb }),
    h('h4', { text: 'Single hits' }),
    h('p', { class: 'ml-what', text: 'One press, one move. Fast moves are hard to punish; slow ones hit harder but leave you open if they miss or get blocked.' }),
    table(openers),
    specials.length ? h('h4', { text: 'Specials' }) : '',
    specials.length ? h('p', { class: 'ml-what', text: `Hold ${SPECIAL[device]} and press the button.` }) : '',
    specials.length ? table(specials) : '',
    combos.length ? h('h4', { text: 'Combos' }) : '',
    combos.length ? h('p', { class: 'ml-what', text: 'Press the buttons in order, each one as the last hit lands (not before it starts, not after it’s finished). Each hit chains into the next, so they can’t block in between.' }) : '',
    combos.length ? h('ul', { class: 'combo-routes' }, ...combos.map(comboItem)) : '',
    h('h4', { text: 'Up close' }),
    h('p', { class: 'ml-what', text: `${GRAB[device]} to grab them, then a button for what to do with them.` }),
    table(clinch),
    fin ? h('h4', { text: 'Finisher' }) : '',
    fin
      ? h('p', { class: 'ml-what', text: `Ends the fight in one go and can’t be blocked, but only when they’re under 15% health and reeling from a stagger, right in front of you. Then it needs ${Math.round(FINISHER_COOLDOWN / 60)} seconds to recharge, so you can’t finish a whole crowd with it.` })
      : '',
    fin ? h('table', { class: 'move-table' }, head(), h('tbody', {}, row(`${SPECIAL[device]} + ${b('hp')}`, fin, 'when they’re nearly out and staggered'))) : '',
    h('h4', { text: style.defenceName }),
    h('p', { class: 'ml-what', text: style.defenceText }),
  );
}

/** The move list (pause menu → Moves): your style, and your second style if you have one. */
export function moveListScreen(styles: StyleData[], device: Device, back: () => void, techLevel: (style: string) => number = () => 5): Screen {
  const el = h(
    'div',
    { class: 'screen panel-screen move-list' },
    h('h2', {}, titleArt('Moves', 'moves')),
    h(
      'div',
      { class: 'panel' },
      h('div', { class: 'ml-key' },
        h('p', {}, h('b', { text: 'Damage' }), ' is how much health a clean hit takes off. Your health bar shows yours (it grows as you level up).'),
        h('p', {}, h('b', { text: 'Speed' }), ' is how quickly it comes out: ', h('span', { class: 'ml-speed fast', text: 'Fast' }), ' ', h('span', { class: 'ml-speed mid', text: 'Medium' }), ' ', h('span', { class: 'ml-speed slow', text: 'Slow' }), '.'),
      ),
      ...styles.map((s) => styleSection(s, device, techLevel(s.id))),
    ),
    h('div', { class: 'panel-actions' }, menuButton('Back', back, undefined, '', undefined, undefined, 'back')),
  );
  return { el, onBack: back };
}

/** The key to the numbers and words, on its own (the phone's wiki puts it at the top of its Moves page). */
export function movesKey(): HTMLElement {
  return h('div', { class: 'ml-key' },
    h('p', {}, h('b', { text: 'Damage' }), ' is how much health a clean hit takes off. Your health bar shows yours (it grows as you level up).'),
    h('p', {}, h('b', { text: 'Speed' }), ' is how quickly it comes out: ', h('span', { class: 'ml-speed fast', text: 'Fast' }), ' ', h('span', { class: 'ml-speed mid', text: 'Medium' }), ' ', h('span', { class: 'ml-speed slow', text: 'Slow' }), '.'),
  );
}
