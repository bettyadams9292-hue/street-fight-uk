import type { SettingsStore, Settings, Quality, TouchMode, Difficulty } from '../save/Settings';
import { titleArt } from './titles';
import { DIFFICULTY } from '../progress/catalogue';
import { h } from './dom';
import { menuScene } from './menuScene';
import { cycleRow, menuButton, sliderRow } from './controls';
import type { Screen, UIManager } from './UIManager';

export const VERSION = '0.4.0';

/** The Hard Graft logo, for screens that should carry the brand (pause, loading). */
export function screenLogo(): HTMLImageElement {
  return h('img', { class: 'screen-logo', src: '/icons/hg/logo.webp', alt: 'Hard Graft', draggable: 'false' });
}

// ---------------------------------------------------------------- main menu --

export function mainMenu(
  hasCharacter: boolean,
  continueText: string | null,
  actions: { newGame: () => void; continue: () => void; training: () => void; character: () => void; settings: () => void; controls: () => void },
): Screen {
  // The menu: plain lettering, quiet until chosen. Only the item you're on gets the red (a bar, an underline,
  // its line of detail). The painted title buttons stay in public/art/titles for the rest of the game.
  const item = (label: string, go: () => void, sub: string, cls = '') =>
    h('button', { class: `menu-btn nav-item ${cls}`, 'data-nav': true, onclick: () => go() },
      h('span', { class: 'nav-label', text: label }),
      h('span', { class: 'nav-sub', text: sub }),
    );
  const list = h(
    'nav',
    { class: 'menu-list nav-list', 'aria-label': 'Main menu' },
    continueText ? item('Continue', actions.continue, continueText, 'primary') : null,
    item('New game', actions.newGame, 'Create a new fighter and start the story', continueText ? '' : 'primary'),
    hasCharacter ? item('Training ground', actions.training, 'Spar, drill combos, try every style') : null,
    hasCharacter ? item('Character', actions.character, 'Stats and look') : null,
    item('Settings', actions.settings, 'Sound, picture, difficulty'),
    item('Controls', actions.controls, 'Every button, on every pad'),
  );
  // One item is "on" at a time: the pointer moves it like the keys and pad do (UIManager's .focused).
  list.addEventListener('pointerover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.nav-item');
    if (!b || b.classList.contains('focused')) return;
    for (const x of list.querySelectorAll('.nav-item.focused')) x.classList.remove('focused');
    b.classList.add('focused');
    b.focus({ preventScroll: true });
  });
  list.style.setProperty('--n', String(list.children.length));
  Array.from(list.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(i)));
  const el = h(
    'div',
    { class: 'screen main-menu keyart scene hg-menu' },
    // A slow loop of the streets with a fighter in front (ui/menuScene.ts), the logo over it.
    menuScene(),
    h('div', { class: 'menu-shade', 'aria-hidden': 'true' }),
    h('h1', { class: 'menu-logo' }, h('img', { src: '/icons/hg/logo.webp', alt: 'Hard Graft', draggable: 'false' })),
    list,
    h('div', { class: 'footer', text: `Early build ${VERSION}` }),
  );
  if (!list.querySelector('.focused')) list.firstElementChild?.classList.add('focused');
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
        cycleRow<boolean>('Tutorial hints', [
          { value: true, label: 'On', note: 'A short card the first time you meet something new' },
          { value: false, label: 'Off' },
        ], s.tutorialHints, (v) => store.update({ tutorialHints: v }), 'tutorial-hints'),
        h('h3', {}, titleArt('Audio', 'audio')),
        sliderRow('Master volume', s.masterVolume, (v) => store.update({ masterVolume: v }), { art: 'master-volume' }),
        sliderRow('Effects volume', s.effectsVolume, (v) => store.update({ effectsVolume: v }), { art: 'effects-volume' }),
        sliderRow('Ambience volume', s.ambienceVolume, (v) => store.update({ ambienceVolume: v }), { art: 'ambience-volume' }),
        sliderRow('Music volume', s.musicVolume, (v) => store.update({ musicVolume: v }), { art: 'music-volume' }),
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
        cycleRow<boolean>('Vibration', [
          { value: true, label: 'On' },
          { value: false, label: 'Off' },
        ], s.vibration, (v) => store.update({ vibration: v }), 'vibration'),
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
    ['Punch', 'J', 'X', 'PUNCH'],
    ['Hard punch', 'I', 'Y', 'PUNCH (hard)'],
    ['Kick', 'K', 'A', 'KICK'],
    ['Hard kick', 'L', 'B', 'KICK (hard)'],
    ['Block (hold) / parry (tap just before a hit)', 'Space', 'RT', 'BLOCK'],
    ['Dodge (hold up/down to sidestep)', 'Shift', 'LT', 'DODGE'],
    ['Grab / break free / let go', 'U', 'LB', 'GRAB'],
    ['Weapon: swing light / heavy', 'J or K / I or L', 'X or A / Y or B', 'PUNCH or KICK / the hard ones'],
    ['Dash strike (from neutral)', '\u2192 + I', '\u2192 + Y', '\u2192 + hard PUNCH'],
    ['Jump attack', 'C then any attack', 'L3 then any attack', 'JUMP then attack'],
    ['Special (hold, then attack)', 'O', 'RB', 'SPECIAL then attack'],
    ['Finisher (opponent under 15% and staggered; 25 s to recharge)', 'O + I', 'RB + Y', 'SPECIAL then hard PUNCH'],
    ['Swap style (in a fight)', 'Tab', 'Back / View', 'STYLE'],
    ['Phone: messages, map, cabs, bank, crew, jobs, home, GraftWiki (out of a fight)', 'P', 'Right-stick click', 'Phone button'],
    ['Map', 'M (or Tab outside a fight)', 'Phone → Map', 'Phone → Map'],
    ['Jump', 'C', 'Left stick click', 'JUMP'],
    ['Pause', 'Esc', 'Start', '\u275a\u275a'],
    ['Pockets and bag (story)', 'B', '—', 'Bag button'],
    ['Pussy out of a fight (drops some of your cash)', 'X', '—', 'PUSSY OUT'],
    ['Mug a passer-by (walk up to them)', 'E', 'LB', 'USE'],
    ['Character & crew (stats, injuries, companions)', 'H', 'Phone → Me / Crew', 'Phone → Me / Crew'],
    ['Crew orders: follow / wait here / get ready (at home: come with me / relax)', 'G', '—', 'Crew tab'],
    ['Use doors, shops, pickups and things at home (walk up to it)', 'E', 'LB', 'USE (shows when there is something to use)'],
    ['Stop what you’re doing in the house (cooking, showering, sleeping…)', 'Esc / move', 'B / stick', 'Move'],
    ['Close a menu', 'Esc', 'B', 'Back'],
    ['Training ground: partner stand / block / spar / group', '1 / 2 / 3 / 4', '\u2014', 'Top bar'],
    ['Training ground: next opponent / reset', 'N / R', '\u2014', 'Top bar'],
    ['Hitboxes', 'F1', '\u2014', 'Settings'],
  ];
  const combos = [
    'Street: Jab \u2192 Jab \u2192 Hook \u2192 Haymaker (punch, punch, punch, hard punch), Front kick \u2192 Roundhouse (kick, hard kick)',
    'Boxing: Jab \u2192 Jab \u2192 Cross \u2192 Hook \u2192 Uppercut (punch, punch, hard punch, punch, hard punch)',
    'Kickboxing: Jab \u2192 Cross \u2192 Low kick \u2192 Roundhouse (punch, hard punch, kick, hard kick)',
    'Muay Thai: Jab \u2192 Leg kick \u2192 Body kick (punch, kick, hard kick), Elbow \u2192 Knee (hard punch, kick)',
    'Karate: Lunge punch \u2192 Reverse punch (punch, hard punch), Front kick \u2192 Head kick (kick, hard kick)',
    'Wrestling and BJJ: Jab \u2192 shoot for the legs (punch, kick), then grapple',
    'In a clinch: punch to strike, kick to throw, hard kick for a takedown or power strike, GRAB to let go',
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

export function pauseMenu(actions: { resume: () => void; settings: () => void; controls: () => void; moves: () => void; practice: () => void; quit: () => void }): Screen {
  const el = h(
    'div',
    { class: 'screen pause-menu' },
    screenLogo(),
    h('h2', {}, titleArt('Paused', 'pause')),
    h(
      'nav',
      { class: 'menu-list' },
      menuButton('Resume', actions.resume, undefined, '', undefined, undefined, 'resume'),
      menuButton('Moves', actions.moves, 'Every move and combo you know', '', undefined, undefined, 'moves'),
      menuButton('Practice styles', actions.practice, 'Try any fighting style', '', undefined, undefined, 'practice-styles'),
      menuButton('Settings', actions.settings, undefined, '', undefined, undefined, 'settings'),
      menuButton('Controls', actions.controls, undefined, '', undefined, undefined, 'controls'),
      menuButton('Quit to main menu', actions.quit, undefined, 'danger', undefined, undefined, 'quit-to-main-menu'),
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
