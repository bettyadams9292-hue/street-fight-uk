import type { SettingsStore, Settings, Quality, TouchMode } from '../save/Settings';
import { h } from './dom';
import { cycleRow, menuButton, sliderRow } from './controls';
import type { Screen, UIManager } from './UIManager';

export const VERSION = '0.2.0';

// ---------------------------------------------------------------- main menu --

export function mainMenu(
  hasCharacter: boolean,
  actions: { newGame: () => void; continue: () => void; character: () => void; settings: () => void; controls: () => void },
): Screen {
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
      hasCharacter ? menuButton('Continue', actions.continue, 'Back to the training ground') : null,
      menuButton('New Game', actions.newGame, 'Create a new fighter'),
      hasCharacter ? menuButton('Character', actions.character, 'Stats and look') : null,
      menuButton('Settings', actions.settings),
      menuButton('Controls', actions.controls),
    ),
    h('div', { class: 'footer', text: `Stage 2 build \u00b7 v${VERSION} \u00b7 temporary art and sound` }),
  );
  // The main menu has nowhere to go back to.
  return { el, onBack: () => undefined };
}

// ---------------------------------------------------------------- settings ---

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
