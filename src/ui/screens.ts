import type { SettingsStore, Settings, Quality, TouchMode, Difficulty } from '../save/Settings';
import { titleArt } from './titles';
import { DIFFICULTY } from '../progress/catalogue';
import { h } from './dom';
import { cycleRow, menuButton, sliderRow } from './controls';
import type { Screen, UIManager } from './UIManager';

export const VERSION = '0.4.0';

/** The Street Fight UK logo, for screens that should carry the brand (pause, loading). */
export function screenLogo(): HTMLImageElement {
  return h('img', { class: 'screen-logo', src: '/art/logo-small.webp', alt: 'Street Fight UK', draggable: 'false' });
}

// ---------------------------------------------------------------- main menu --

export function mainMenu(
  hasCharacter: boolean,
  continueText: string | null,
  actions: { newGame: () => void; continue: () => void; training: () => void; character: () => void; settings: () => void; controls: () => void },
): Screen {
  const el = h(
    'div',
    { class: 'screen main-menu keyart' },
    // The key art carries the logo; the name is still there for screen readers.
    h('h1', { class: 'sr-only', text: 'Street Fight UK' }),
    h(
      'nav',
      { class: 'menu-list' },
      continueText ? menuButton('Continue', actions.continue, continueText, 'primary', 'play', undefined, 'menu-continue') : null,
      menuButton('New game', actions.newGame, 'Create a new fighter and start the story', continueText ? '' : 'primary', 'side', undefined, 'menu-new-game'),
      hasCharacter ? menuButton('Training ground', actions.training, 'Spar, drill combos, try every style', '', 'gym', undefined, 'menu-training-ground') : null,
      hasCharacter ? menuButton('Character', actions.character, 'Stats and look', '', 'contact', undefined, 'menu-character') : null,
      menuButton('Settings', actions.settings, undefined, '', 'settings', undefined, 'menu-settings'),
      menuButton('Controls', actions.controls, undefined, '', 'controls', undefined, 'menu-controls'),
    ),
    h('div', { class: 'footer', text: `v${VERSION}, early build: some art and sound are placeholders` }),
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
      h('h2', {}, titleArt('Settings', 'settings')),
      h(
        'div',
        { class: 'panel' },
        h('h3', {}, titleArt('Game', 'game')),
        cycleRow<Difficulty>('Difficulty (story)', (['easy', 'normal', 'hard'] as const).map((d) => ({ value: d, label: DIFFICULTY[d].name, note: DIFFICULTY[d].text, art: d })), s.difficulty, (v) => store.update({ difficulty: v }), 'difficulty'),
        h('h3', {}, titleArt('Audio', 'audio')),
        sliderRow('Master volume', s.masterVolume, (v) => store.update({ masterVolume: v }), { art: 'master-volume' }),
        sliderRow('Effects volume', s.effectsVolume, (v) => store.update({ effectsVolume: v }), { art: 'effects-volume' }),
        sliderRow('Ambience volume', s.ambienceVolume, (v) => store.update({ ambienceVolume: v }), { art: 'ambience-volume' }),
        h('h3', {}, titleArt('Display', 'display')),
        cycleRow<Quality>('Graphics quality', [
          { value: 'low', label: 'Low', art: 'low' },
          { value: 'medium', label: 'Medium', art: 'medium' },
          { value: 'high', label: 'High', art: 'high' },
        ], s.quality, (v) => store.update({ quality: v }), 'graphics-quality'),
        cycleRow<boolean>('Lighting and glow', [
          { value: true, label: s.quality === 'low' ? 'On (needs Medium or High)' : 'On' },
          { value: false, label: 'Off' },
        ], s.lighting, (v) => store.update({ lighting: v }), 'lighting-and-glow'),
        cycleRow<boolean>('Screen shake', [
          { value: true, label: 'On' },
          { value: false, label: 'Off' },
        ], s.screenShake, (v) => store.update({ screenShake: v }), 'screen-shake'),
        cycleRow<boolean>('Frame rate counter', [
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ], s.showFps, (v) => store.update({ showFps: v }), 'frame-rate-counter'),
        h('h3', {}, titleArt('Controls', 'controls')),
        cycleRow<TouchMode>('Touch controls', [
          { value: 'auto', label: 'Automatic' },
          { value: 'on', label: 'Always on' },
          { value: 'off', label: 'Off' },
        ], s.touchControls, (v) => store.update({ touchControls: v }), 'touch-controls'),
        h('h3', {}, titleArt('Training', 'training')),
        cycleRow<boolean>('Show hitboxes (F1)', [
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ], s.showHitboxes, (v) => store.update({ showHitboxes: v }), 'show-hitboxes'),
      ),
      h(
        'div',
        { class: 'panel-actions' },
        menuButton(
          'Reset to defaults',
          () => {
            store.reset();
            build();
          },
          undefined,
          '',
          undefined,
          undefined,
          'reset-to-defaults',
        ),
        menuButton('Back', () => ui.pop(), undefined, '', undefined, undefined, 'back'),
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
    ['Sprint (uses stamina in a fight)', 'Double-tap A / D and hold', 'Stick all the way, or double-tap D-pad', 'Push the stick to the edge'],
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
    screenLogo(),
    h('h2', {}, titleArt('Paused', 'pause')),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Resume', actions.resume, undefined, '', undefined, undefined, 'resume'),
      menuButton('Practice styles', actions.practice, 'Try any fighting style'),
      menuButton('Settings', actions.settings, undefined, '', undefined, undefined, 'settings'),
      menuButton('Controls', actions.controls, undefined, '', undefined, undefined, 'controls'),
      menuButton('Quit to main menu', actions.quit, undefined, 'danger', undefined, undefined, 'exit'),
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
