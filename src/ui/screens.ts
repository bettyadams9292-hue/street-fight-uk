import type { SettingsStore, Settings, Quality, TouchMode } from '../save/Settings';
import { h } from './dom';
import type { Screen, UIManager } from './UIManager';

export const VERSION = '0.1.0';

function menuButton(label: string, onClick: () => void, sub?: string): HTMLButtonElement {
  return h('button', { class: 'menu-btn', 'data-nav': true, onclick: () => onClick() }, h('span', { class: 'label', text: label }), sub ? h('span', { class: 'sub', text: sub }) : null);
}

// ---------------------------------------------------------------- main menu --

export function mainMenu(actions: { start: () => void; settings: () => void; controls: () => void }): Screen {
  const el = h(
    'div',
    { class: 'screen main-menu' },
    h(
      'div',
      { class: 'title-block' },
      h('div', { class: 'title-street', text: 'STREET' }),
      h('div', { class: 'title-fight', text: 'FIGHT' }),
      h('div', { class: 'title-uk', text: 'UK' }),
      h('div', { class: 'hazard' }),
    ),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Training Ground', actions.start, 'Back alley sparring'),
      menuButton('Settings', actions.settings),
      menuButton('Controls', actions.controls),
    ),
    h('div', { class: 'footer', text: `Stage 1 build · v${VERSION} · temporary art and sound` }),
  );
  // The main menu has nowhere to go back to.
  return { el, onBack: () => undefined };
}

// ---------------------------------------------------------------- settings ---

function sliderRow(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const out = h('span', { class: 'value', text: `${Math.round(value * 100)}%` });
  const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(value * 100), 'data-nav': true, 'aria-label': label }) as HTMLInputElement;
  const set = (v: number) => {
    const clamped = Math.max(0, Math.min(100, v));
    input.value = String(clamped);
    out.textContent = `${clamped}%`;
    onChange(clamped / 100);
  };
  input.addEventListener('input', () => set(Number(input.value)));
  input.addEventListener('nav-adjust', (e) => set(Number(input.value) + 5 * (e as CustomEvent<number>).detail));
  return h('div', { class: 'setting-row' }, h('span', { class: 'name', text: label }), input, out);
}

function cycleRow<T extends string | boolean>(label: string, options: { value: T; label: string }[], current: T, onChange: (v: T) => void): HTMLElement {
  let i = Math.max(0, options.findIndex((o) => o.value === current));
  const btn = h('button', { class: 'cycle', 'data-nav': true, 'aria-label': label }) as HTMLButtonElement;
  const render = () => (btn.textContent = `‹  ${options[i].label}  ›`);
  const step = (d: number) => {
    i = (i + d + options.length) % options.length;
    render();
    onChange(options[i].value);
  };
  btn.addEventListener('click', () => step(1));
  btn.addEventListener('nav-adjust', (e) => step((e as CustomEvent<number>).detail));
  render();
  return h('div', { class: 'setting-row' }, h('span', { class: 'name', text: label }), btn);
}

export function settingsScreen(store: SettingsStore, ui: UIManager): Screen {
  const el = h('div', { class: 'screen panel-screen' });
  const build = () => {
    const s: Settings = store.get();
    el.replaceChildren(
      h('h2', { text: 'Settings' }),
      h(
        'div',
        { class: 'panel' },
        h('h3', { text: 'Audio' }),
        sliderRow('Master volume', s.masterVolume, (v) => store.update({ masterVolume: v })),
        sliderRow('Effects volume', s.effectsVolume, (v) => store.update({ effectsVolume: v })),
        sliderRow('Ambience volume', s.ambienceVolume, (v) => store.update({ ambienceVolume: v })),
        h('h3', { text: 'Display' }),
        cycleRow<Quality>('Graphics quality', [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
        ], s.quality, (v) => store.update({ quality: v })),
        cycleRow<boolean>('Screen shake', [
          { value: true, label: 'On' },
          { value: false, label: 'Off' },
        ], s.screenShake, (v) => store.update({ screenShake: v })),
        cycleRow<boolean>('Frame rate counter', [
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ], s.showFps, (v) => store.update({ showFps: v })),
        h('h3', { text: 'Controls' }),
        cycleRow<TouchMode>('Touch controls', [
          { value: 'auto', label: 'Automatic' },
          { value: 'on', label: 'Always on' },
          { value: 'off', label: 'Off' },
        ], s.touchControls, (v) => store.update({ touchControls: v })),
        h('h3', { text: 'Training' }),
        cycleRow<boolean>('Show hitboxes (F1)', [
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ], s.showHitboxes, (v) => store.update({ showHitboxes: v })),
      ),
      h(
        'div',
        { class: 'panel-actions' },
        menuButton('Reset to defaults', () => {
          store.reset();
          build();
        }),
        menuButton('Back', () => ui.pop()),
      ),
    );
  };
  build();
  return { el };
}

// ---------------------------------------------------------------- controls ---

export function controlsScreen(ui: UIManager): Screen {
  const rows: [string, string, string, string][] = [
    ['Move left / right', 'A / D or ← →', 'Left stick / D-pad', 'Left stick'],
    ['Move into / out of screen', 'W / S or ↑ ↓', 'Left stick / D-pad', 'Left stick'],
    ['Light punch', 'J', 'X', 'LP'],
    ['Heavy punch', 'I', 'Y', 'HP'],
    ['Light kick', 'K', 'A', 'LK'],
    ['Heavy kick', 'L', 'B', 'HK'],
    ['Block (hold)', 'Space', 'RT', 'BLOCK'],
    ['Jump', 'C', 'Left stick click', 'JUMP'],
    ['Pause', 'Esc / P', 'Start', '❚❚'],
    ['Sparring partner mode', '1 / 2 / 3', '—', 'Top bar'],
    ['Reset positions', 'R', '—', 'Top bar'],
    ['Hitboxes', 'F1', '—', 'Settings'],
  ];
  const combos = [
    'Jab → Jab → Hook → Haymaker:  LP, LP, LP, HP',
    'Jab → Front kick → Roundhouse:  LP, LK, HK',
    'Front kick → Roundhouse:  LK, HK',
  ];
  const el = h(
    'div',
    { class: 'screen panel-screen' },
    h('h2', { text: 'Controls' }),
    h(
      'div',
      { class: 'panel' },
      h(
        'table',
        { class: 'controls-table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Action' }), h('th', { text: 'Keyboard' }), h('th', { text: 'Gamepad' }), h('th', { text: 'Touch' }))),
        h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((c) => h('td', { text: c }))))),
      ),
      h('h3', { text: 'Street Fighting combos' }),
      h('ul', { class: 'combo-list' }, ...combos.map((c) => h('li', { text: c }))),
      h('p', { class: 'hint', text: 'Press the next button while the previous move is still landing. Early presses are remembered for a moment.' }),
    ),
    h('div', { class: 'panel-actions' }, menuButton('Back', () => ui.pop())),
  );
  return { el };
}

// ---------------------------------------------------------------- pause ------

export function pauseMenu(actions: { resume: () => void; settings: () => void; controls: () => void; quit: () => void }): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    h('h2', { text: 'Paused' }),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Resume', actions.resume),
      menuButton('Settings', actions.settings),
      menuButton('Controls', actions.controls),
      menuButton('Quit to main menu', actions.quit),
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
