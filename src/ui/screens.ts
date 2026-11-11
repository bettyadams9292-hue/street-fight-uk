import type { SettingsStore, Settings, Quality, TouchMode, Difficulty } from '../save/Settings';
import { DIFFICULTY } from '../progress/catalogue';
import { h } from './dom';
import { cycleRow, menuButton, sliderRow } from './controls';
import type { Screen, UIManager } from './UIManager';

export const VERSION = '0.4.0';

// ---------------------------------------------------------------- main menu --

export function mainMenu(
  hasCharacter: boolean,
  continueText: string | null,
  actions: { newGame: () => void; continue: () => void; training: () => void; character: () => void; settings: () => void; controls: () => void },
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
      continueText ? menuButton('Continue', actions.continue, continueText, 'primary', 'play') : null,
      menuButton('New Game', actions.newGame, 'Create a new fighter and start the story', continueText ? '' : 'primary', 'side'),
      hasCharacter ? menuButton('Training Ground', actions.training, 'Spar, drill combos, try every style', '', 'gym') : null,
      hasCharacter ? menuButton('Character', actions.character, 'Stats and look', '', 'contact') : null,
      menuButton('Settings', actions.settings, undefined, '', 'settings'),
      menuButton('Controls', actions.controls, undefined, '', 'controls'),
    ),
    h('div', { class: 'footer', text: `Stage 9 build \u00b7 v${VERSION} \u00b7 temporary art and sound` }),
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
        h('h3', { text: 'Game' }),
        cycleRow<Difficulty>('Difficulty (story)', (['easy', 'normal', 'hard'] as const).map((d) => ({ value: d, label: `${DIFFICULTY[d].name}: ${DIFFICULTY[d].text}` })), s.difficulty, (v) => store.update({ difficulty: v })),
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
        cycleRow<boolean>('Lighting and glow', [
          { value: true, label: s.quality === 'low' ? 'On (needs Medium or High)' : 'On' },
          { value: false, label: 'Off' },
        ], s.lighting, (v) => store.update({ lighting: v })),
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
    ['Move left / right', 'A / D or \u2190 \u2192', 'Left stick / D-pad', 'Left stick'],
    ['Move into / out of screen', 'W / S or \u2191 \u2193', 'Left stick / D-pad', 'Left stick'],
    ['Light punch', 'J', 'X', 'LP'],
    ['Heavy punch', 'I', 'Y', 'HP'],
    ['Light kick', 'K', 'A', 'LK'],
    ['Heavy kick', 'L', 'B', 'HK'],
    ['Block (hold) / parry (tap just before a hit)', 'Space', 'RT', 'BLOCK'],
    ['Dodge (hold up/down to sidestep)', 'Shift', 'LT', 'DODGE'],
    ['Grab / break free / let go', 'U', 'LB', 'GRAB'],
    ['Use / pick up / open (doors, weapons, stations)', 'E or U', 'LB', 'GRAB'],
    ['Weapon: swing light / heavy', 'J or K / I or L', 'X or A / Y or B', 'LP or LK / HP or HK'],
    ['Dash strike (from neutral)', '\u2192 + I', '\u2192 + Y', '\u2192 + HP'],
    ['Jump attack', 'C then any attack', 'L3 then any attack', 'JUMP then attack'],
    ['Special (hold, then attack)', 'O', 'RB', 'SP then attack'],
    ['Finisher (opponent nearly out and reeling)', 'O + I', 'RB + Y', 'SP then HP'],
    ['Swap style (in a fight)', 'Tab', 'Back / View', 'SWAP'],
    ['Map', 'M (or Tab outside a fight)', 'Pause → Map', 'MAP button'],
    ['Jump', 'C', 'Left stick click', 'JUMP'],
    ['Pause', 'Esc / P', 'Start', '\u275a\u275a'],
    ['Inventory (story)', 'B (or I outside a fight)', 'Right-stick click', 'BAG'],
    ['Character & crew (stats, injuries, companions)', 'H', 'Pause → Character & crew', 'Person button'],
    ['Crew orders: follow / wait here / get ready (at home: come with me / relax)', 'G', '—', 'Crew tab'],
    ['At home: use the fridge, cooker, sink, shower, toilet, bed, telly (walk up to it)', 'E', 'LB', 'GRAB'],
    ['Stop what you’re doing in the house (cooking, showering, sleeping…)', 'Esc / move', 'B / stick', 'Move'],
    ['Close a menu', 'Esc', 'B', 'Back'],
    ['Training ground: partner stand / block / spar / group', '1 / 2 / 3 / 4', '\u2014', 'Top bar'],
    ['Training ground: next opponent / reset', 'N / R', '\u2014', 'Top bar'],
    ['Hitboxes', 'F1', '\u2014', 'Settings'],
  ];
  const combos = [
    'Street: Jab \u2192 Jab \u2192 Hook \u2192 Haymaker (LP LP LP HP), Front kick \u2192 Roundhouse (LK HK)',
    'Boxing: Jab \u2192 Jab \u2192 Cross \u2192 Hook \u2192 Uppercut (LP LP HP LP HP)',
    'Kickboxing: Jab \u2192 Cross \u2192 Low kick \u2192 Roundhouse (LP HP LK HK)',
    'Muay Thai: Jab \u2192 Leg kick \u2192 Body kick (LP LK HK), Elbow \u2192 Knee (HP LK)',
    'Karate: Lunge punch \u2192 Reverse punch (LP HP), Front kick \u2192 Head kick (LK HK)',
    'Wrestling and BJJ: Jab \u2192 shoot for the legs (LP LK), then grapple',
    'In a clinch: LP strike, LK throw, HK takedown or power strike, GRAB to let go',
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
      h('h3', { text: 'Combos and grappling' }),
      h('ul', { class: 'combo-list' }, ...combos.map((c) => h('li', { text: c }))),
      h('p', { class: 'hint', text: 'Press the next button while the previous move is still landing. Early presses are remembered for a moment.' }),
    ),
    h('div', { class: 'panel-actions' }, menuButton('Back', () => ui.pop())),
  );
  return { el };
}

// ---------------------------------------------------------------- pause ------

export function pauseMenu(actions: { resume: () => void; settings: () => void; controls: () => void; practice: () => void; quit: () => void }): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    h('h2', { text: 'Paused' }),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Resume', actions.resume),
      menuButton('Practice styles', actions.practice, 'Try any fighting style'),
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
