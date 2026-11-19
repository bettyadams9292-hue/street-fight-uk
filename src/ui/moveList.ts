import type { AttackButton } from '../input/Commands';
import type { MoveData } from '../combat/MoveData';
import type { StyleData } from '../styles/StyleData';
import type { Screen } from './UIManager';
import { h } from './dom';
import { menuButton } from './controls';
import { titleArt } from './titles';

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

function kindLabel(m: MoveData): string {
  return m.kind === 'heavy' ? 'Heavy' : m.kind === 'light' ? 'Quick' : m.kind === 'special' ? 'Special' : m.kind === 'finisher' ? 'Finisher' : m.kind === 'grab' ? 'Grab' : 'Clinch';
}

function effect(m: MoveData): string {
  const bits: string[] = [];
  if (m.reaction === 'knockdown') bits.push('knocks down');
  else if (m.reaction === 'stagger') bits.push('staggers');
  if (m.unblockable) bits.push('can’t be blocked');
  if (m.staminaDamage) bits.push('drains stamina');
  if (m.slowFrames) bits.push('slows them');
  if (m.height === 'low') bits.push('low');
  return bits.join(', ');
}

function row(input: string, m: MoveData): HTMLElement {
  const note = effect(m);
  return h(
    'tr',
    {},
    h('td', { class: 'ml-input' }, ...input.split(/( \+ |, then )/).map((k, i) => (i % 2 ? k.replace(', then ', ' then ') : h('kbd', { text: k })))),
    h('td', { class: 'ml-name' }, h('b', { text: m.name }), note ? h('small', { text: note }) : ''),
    h('td', { class: 'ml-kind', text: kindLabel(m) }),
    h('td', { class: 'ml-dmg', text: m.damage >= 100 ? 'KO' : `${Math.round(m.damage)}` }),
  );
}

/** One style's moves: openers, specials, combos, and what's possible in the clinch. */
function styleSection(style: StyleData, device: Device): HTMLElement {
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
  const table = (rows: (readonly [string, MoveData])[]) =>
    h('table', { class: 'move-table' }, h('tbody', {}, ...rows.map(([i, m]) => row(i, m))));
  return h(
    'section',
    { class: 'move-style' },
    h('h3', { text: style.name }),
    h('p', { class: 'hint', text: style.blurb }),
    h('h4', { text: 'Openers' }),
    table(openers),
    specials.length ? h('h4', { text: 'Specials' }) : '',
    specials.length ? table(specials) : '',
    combos.length ? h('h4', { text: 'Combos' }) : '',
    combos.length
      ? h(
          'ul',
          { class: 'combo-routes' },
          ...combos.map((r) =>
            h(
              'li',
              {},
              h('span', { class: 'route-keys' }, ...r.flatMap((m, i) => [i ? ' ' : '', h('kbd', { text: b(m.button) })])),
              h('span', { class: 'route-names', text: r.map((m) => m.name).join(' → ') }),
            ),
          ),
        )
      : '',
    h('h4', { text: 'Up close' }),
    table(clinch),
    fin ? h('h4', { text: 'Finisher' }) : '',
    fin ? table([[`${SPECIAL[device]} + ${b('hp')}`, fin]]) : '',
    h('p', { class: 'hint', text: `${style.defenceName}: ${style.defenceText}` }),
  );
}

/** The move list (pause menu → Moves): your style, and your second style if you have one. */
export function moveListScreen(styles: StyleData[], device: Device, back: () => void): Screen {
  const el = h(
    'div',
    { class: 'screen panel-screen move-list' },
    h('h2', {}, titleArt('Moves', 'moves')),
    h(
      'div',
      { class: 'panel' },
      h('p', { class: 'hint', text: 'Press the next button while the last move is still landing to chain a combo. Finishers only work when they’re nearly out and reeling.' }),
      ...styles.map((s) => styleSection(s, device)),
    ),
    h('div', { class: 'panel-actions' }, menuButton('Back', back, undefined, '', undefined, undefined, 'back')),
  );
  return { el, onBack: back };
}
