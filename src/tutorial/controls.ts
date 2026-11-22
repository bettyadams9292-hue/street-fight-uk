/**
 * What to press, for the device in hand, read from the same tables the input uses (KEY_BINDINGS, MENU_KEYS,
 * PAD_BUTTONS, PAD_EXTRA in input/InputManager.ts) and the touch buttons' own labels (ui/TouchControls.ts), so a
 * tutorial prompt can never name a key the game doesn't listen for.
 */
import { HOTBAR_KEYS, KEY_BINDINGS, MENU_KEYS, PAD, PAD_BUTTONS, PAD_EXTRA, PAD_HOTBAR, type InputSource } from '../input/InputManager';

export type Action =
  | 'move' | 'depth' | 'run' | 'jump' | 'use'
  | 'lp' | 'hp' | 'lk' | 'hk' | 'block' | 'parry' | 'dodge' | 'grab' | 'special' | 'swap'
  | 'phone' | 'pause' | 'bag' | 'map' | 'me' | 'hotbar';

const PAD_NAME: Record<number, string> = Object.fromEntries(Object.entries(PAD).map(([k, v]) => [v, k])) as Record<number, string>;
PAD_NAME[PAD.LS] = 'L3';
PAD_NAME[PAD.RS] = 'R3';

/** A key code as it's printed on the key. */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: 'Space', Escape: 'Esc', Tab: 'Tab' };
  return named[code] ?? code;
}

const first = (codes: readonly string[]) => keyName(codes[0]);

function keyboard(a: Action): string {
  switch (a) {
    case 'move': return `${first(KEY_BINDINGS.left)} / ${first(KEY_BINDINGS.right)}`;
    case 'depth': return `${first(KEY_BINDINGS.up)} / ${first(KEY_BINDINGS.down)}`;
    case 'run': return `${first(KEY_BINDINGS.right)} ${first(KEY_BINDINGS.right)} (tap twice, hold)`;
    case 'jump': return first(KEY_BINDINGS.jump);
    case 'use': return first(KEY_BINDINGS.use);
    case 'lp': case 'hp': case 'lk': case 'hk': case 'dodge': case 'grab': case 'swap': case 'special': return first(KEY_BINDINGS[a]);
    case 'block': return `hold ${first(KEY_BINDINGS.block)}`;
    case 'parry': return `tap ${first(KEY_BINDINGS.block)}`;
    case 'phone': return keyName(MENU_KEYS.phone);
    case 'pause': return first(KEY_BINDINGS.pause);
    case 'bag': return keyName(MENU_KEYS.inventory);
    case 'map': return keyName(MENU_KEYS.map);
    case 'me': return keyName(MENU_KEYS.character);
    case 'hotbar': return HOTBAR_KEYS.map((k) => keyName(k[0])).join(' / ');
  }
}

function pad(a: Action): string {
  const n = (i: number) => PAD_NAME[i];
  switch (a) {
    case 'move': return 'Left stick';
    case 'depth': return 'Left stick up / down';
    case 'run': return 'Left stick all the way';
    case 'jump': return n(PAD_BUTTONS.jump);
    case 'use': return n(PAD_EXTRA.use);
    case 'lp': case 'hp': case 'lk': case 'hk': case 'dodge': case 'grab': case 'swap': return n(PAD_BUTTONS[a]);
    case 'special': return `hold ${n(PAD_EXTRA.special)}`;
    case 'block': return `hold ${n(PAD_EXTRA.block)}`;
    case 'parry': return `tap ${n(PAD_EXTRA.block)}`;
    case 'phone': case 'map': case 'me': return a === 'phone' ? n(PAD_EXTRA.phone) : `${n(PAD_EXTRA.phone)} (phone)`;
    case 'pause': return n(PAD_EXTRA.pause);
    // A pad has no spare button for the bag: it's the bag button on screen or the keyboard.
    case 'bag': return `${keyName(MENU_KEYS.inventory)} on a keyboard`;
    case 'hotbar': return `hold ${n(PAD_EXTRA.hotbar)} + ${PAD_HOTBAR.map(n).join(' / ')}`;
  }
}

/** The touch buttons' own words (ui/TouchControls.ts), and the element to light up. */
const TOUCH: Record<Action, { label: string; sel: string }> = {
  move: { label: 'the stick (left thumb)', sel: '.stick-zone' },
  depth: { label: 'the stick up or down', sel: '.stick-zone' },
  run: { label: 'the stick all the way', sel: '.stick-zone' },
  jump: { label: 'JUMP', sel: '.touch-btn.jmp, .touch-btn.jump' },
  use: { label: 'USE', sel: '.touch-btn.use' },
  lp: { label: 'PUNCH', sel: '.touch-btn.lp' },
  hp: { label: 'HARD PUNCH', sel: '.touch-btn.hp' },
  lk: { label: 'KICK', sel: '.touch-btn.lk' },
  hk: { label: 'HARD KICK', sel: '.touch-btn.hk' },
  block: { label: 'hold BLOCK', sel: '.touch-btn.block' },
  parry: { label: 'tap BLOCK', sel: '.touch-btn.block' },
  dodge: { label: 'DODGE', sel: '.touch-btn.dodge' },
  grab: { label: 'GRAB', sel: '.touch-btn.grab' },
  special: { label: 'SPECIAL', sel: '.touch-btn.sp' },
  swap: { label: 'STYLE SWAP', sel: '.touch-btn.swap' },
  phone: { label: 'the phone button', sel: '.phone-btn' },
  pause: { label: 'the pause button', sel: '.pause-btn' },
  bag: { label: 'the bag button', sel: '.bag-btn' },
  map: { label: 'Maps on the phone', sel: '.phone-btn' },
  me: { label: 'Me on the phone', sel: '.phone-btn' },
  hotbar: { label: 'a hotbar slot', sel: '.hotbar' },
};

/** What to press for `a` on `device`. */
export function control(a: Action, device: InputSource): string {
  return device === 'touch' ? TOUCH[a].label : device === 'gamepad' ? pad(a) : keyboard(a);
}

/** The on-screen element(s) to light up for `a` on `device` (touch buttons; the HUD buttons everywhere). */
export function controlTarget(a: Action, device: InputSource): string | null {
  if (device === 'touch') return TOUCH[a].sel;
  return a === 'phone' || a === 'pause' || a === 'bag' || a === 'hotbar' ? TOUCH[a].sel : null;
}
