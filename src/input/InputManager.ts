import { emptyCommand, type CommandFrame, type PressButton } from './Commands';

export type GameButton = PressButton;
const PRESS_BUTTONS: readonly GameButton[] = ['lp', 'hp', 'lk', 'hk', 'jump', 'dodge', 'grab', 'swap'];
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause' | 'inventory' | 'map' | 'character' | 'crew';
export type InputSource = 'keyboard' | 'gamepad' | 'touch';

/** Keyboard layout. Kept in one place so a rebinding screen can edit it later. */
export const KEY_BINDINGS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'], // into the screen
  down: ['KeyS', 'ArrowDown'], // towards the camera
  lp: ['KeyJ'],
  hp: ['KeyI'],
  lk: ['KeyK'],
  hk: ['KeyL'],
  block: ['Space'],
  jump: ['KeyC'],
  dodge: ['ShiftLeft', 'ShiftRight'],
  grab: ['KeyU', 'KeyE'],
  special: ['KeyO'],
  swap: ['Tab'],
  pause: ['Escape', 'KeyP'],
  inventory: ['KeyB'],
  map: ['KeyM'],
  character: ['KeyH'],
  crew: ['KeyG'],
} as const;

/** Standard gamepad mapping (Xbox names). */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const PAD_BUTTONS: Record<GameButton, number> = { lp: PAD.X, hp: PAD.Y, lk: PAD.A, hk: PAD.B, jump: PAD.LS, dodge: PAD.LT, grab: PAD.LB, swap: PAD.BACK };
const STICK_DEADZONE = 0.25;

/**
 * Merges keyboard, gamepad and touch into one CommandFrame per simulation
 * step. Presses are queued between steps so a quick tap is never lost.
 */
export class InputManager {
  private held = new Set<string>();
  private pressedQueue = new Set<GameButton>();
  private menuListeners = new Set<(a: MenuAction, source: InputSource, fightKey?: boolean) => void>();
  private padPrev: boolean[] = [];
  private padAxesPrev = { x: 0, y: 0 };
  /** Set by the touch controls. */
  touch = { moveX: 0, moveZ: 0, block: false, specialArmed: false };
  lastDevice: InputSource = 'keyboard';
  /** Lets the touch UI un-highlight SP once it's been used. */
  onSpecialUsed: (() => void) | null = null;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => this.onKeyDown(e));
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  /**
   * Menu/navigation actions. Escape arrives as 'back' from the keyboard;
   * screens decide whether that means "go back" or "pause".
   */
  onMenu(fn: (a: MenuAction, source: InputSource, fightKey?: boolean) => void): () => void {
    this.menuListeners.add(fn);
    return () => this.menuListeners.delete(fn);
  }

  /** Touch buttons call this. */
  pressFromTouch(button: GameButton): void {
    this.pressedQueue.add(button);
    this.lastDevice = 'touch';
  }

  /** `fightKey`: the key also does something in a fight (Tab swaps style, I is heavy punch). */
  private emitMenu(a: MenuAction, source: InputSource = 'keyboard', fightKey = false): void {
    for (const fn of [...this.menuListeners]) fn(a, source, fightKey);
  }

  /** A fight key was used to open a menu instead: don't also throw the punch / swap style. */
  cancelPress(b: GameButton): void {
    this.pressedQueue.delete(b);
  }

  /** Touch UI (e.g. the pause button) can raise menu actions too. */
  menuFromTouch(a: MenuAction): void {
    this.emitMenu(a, 'touch');
  }

  private onKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    // Typing in a text box (e.g. your fighter's name): only Enter, Escape and up/down navigate.
    const t = e.target as HTMLElement | null;
    if (t && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text') {
      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        (t as HTMLInputElement).blur();
        this.emitMenu('down');
      } else if (code === 'Escape') this.emitMenu('back');
      else if (code === 'ArrowUp') this.emitMenu('up');
      else if (code === 'ArrowDown') this.emitMenu('down');
      return;
    }
    const gameKey = Object.values(KEY_BINDINGS).some((codes) => (codes as readonly string[]).includes(code));
    // Enter is handled by the menu system; stop the browser also "clicking" the focused button.
    if (gameKey || code === 'Enter' || code === 'NumpadEnter') e.preventDefault();
    this.lastDevice = 'keyboard';
    if (!e.repeat) {
      for (const b of PRESS_BUTTONS) {
        if ((KEY_BINDINGS[b] as readonly string[]).includes(code)) this.pressedQueue.add(b);
      }
      if (code === 'Escape') this.emitMenu('back');
      else if (code === 'KeyP') this.emitMenu('pause');
      else if (code === 'KeyB') this.emitMenu('inventory');
      else if (code === 'KeyM') this.emitMenu('map');
      else if (code === 'KeyH') this.emitMenu('character');
      else if (code === 'KeyG') this.emitMenu('crew');
      // Outside a fight these open the map and inventory; in one they stay swap style and heavy punch.
      else if (code === 'Tab') this.emitMenu('map', 'keyboard', true);
      else if (code === 'KeyI') this.emitMenu('inventory', 'keyboard', true);
    }
    // Menu navigation (arrow keys / WASD / Enter).
    if (code === 'ArrowUp' || code === 'KeyW') this.emitMenu('up');
    else if (code === 'ArrowDown' || code === 'KeyS') this.emitMenu('down');
    else if (code === 'ArrowLeft' || code === 'KeyA') this.emitMenu('left');
    else if (code === 'ArrowRight' || code === 'KeyD') this.emitMenu('right');
    else if ((code === 'Enter' || code === 'NumpadEnter') && !e.repeat) this.emitMenu('confirm');
    this.held.add(code);
  }

  private isHeld(codes: readonly string[]): boolean {
    for (const c of codes) if (this.held.has(c)) return true;
    return false;
  }

  /** Poll gamepads: queue presses, and fire menu actions on edges. Call once per rendered frame. */
  pollGamepad(): PadState {
    const out: PadState = { moveX: 0, moveZ: 0, block: false, special: false };
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((p): p is Gamepad => !!p && p.connected);
    if (!pad) return out;

    const pressed = (i: number) => !!pad.buttons[i]?.pressed;
    const edge = (i: number) => pressed(i) && !this.padPrev[i];

    for (const b of PRESS_BUTTONS) if (edge(PAD_BUTTONS[b])) this.pressedQueue.add(b);
    if (edge(PAD.START)) this.emitMenu('pause', 'gamepad');
    // Right-stick click: I (heavy punch) and RB (special) are fight buttons.
    if (edge(PAD.RS)) this.emitMenu('inventory', 'gamepad');
    if (edge(PAD.A)) this.emitMenu('confirm', 'gamepad');
    if (edge(PAD.B)) this.emitMenu('back', 'gamepad');
    if (edge(PAD.UP)) this.emitMenu('up', 'gamepad');
    if (edge(PAD.DOWN)) this.emitMenu('down', 'gamepad');
    if (edge(PAD.LEFT)) this.emitMenu('left', 'gamepad');
    if (edge(PAD.RIGHT)) this.emitMenu('right', 'gamepad');

    let ax = pad.axes[0] ?? 0;
    let ay = pad.axes[1] ?? 0;
    if (Math.abs(ax) < STICK_DEADZONE) ax = 0;
    if (Math.abs(ay) < STICK_DEADZONE) ay = 0;
    // Stick flicks navigate menus too.
    if (ay < -0.6 && this.padAxesPrev.y >= -0.6) this.emitMenu('up', 'gamepad');
    if (ay > 0.6 && this.padAxesPrev.y <= 0.6) this.emitMenu('down', 'gamepad');
    if (ax < -0.6 && this.padAxesPrev.x >= -0.6) this.emitMenu('left', 'gamepad');
    if (ax > 0.6 && this.padAxesPrev.x <= 0.6) this.emitMenu('right', 'gamepad');
    this.padAxesPrev = { x: ax, y: ay };

    out.moveX = ax + (pressed(PAD.RIGHT) ? 1 : 0) - (pressed(PAD.LEFT) ? 1 : 0);
    // Up = into the screen = negative z.
    out.moveZ = ay + (pressed(PAD.DOWN) ? 1 : 0) - (pressed(PAD.UP) ? 1 : 0);
    out.block = pressed(PAD.RT) || (pad.buttons[PAD.RT]?.value ?? 0) > 0.4;
    out.special = pressed(PAD.RB);

    if (pad.buttons.some((b) => b.pressed) || ax !== 0 || ay !== 0) this.lastDevice = 'gamepad';
    this.padPrev = pad.buttons.map((b) => b.pressed);
    return out;
  }

  /** Build the player's command for one simulation step and consume queued presses. */
  sample(pad: PadState): CommandFrame {
    const cmd = emptyCommand();
    const kx = (this.isHeld(KEY_BINDINGS.right) ? 1 : 0) - (this.isHeld(KEY_BINDINGS.left) ? 1 : 0);
    const kz = (this.isHeld(KEY_BINDINGS.down) ? 1 : 0) - (this.isHeld(KEY_BINDINGS.up) ? 1 : 0);
    cmd.moveX = clamp1(kx + pad.moveX + this.touch.moveX);
    cmd.moveZ = clamp1(kz + pad.moveZ + this.touch.moveZ);
    cmd.block = this.isHeld(KEY_BINDINGS.block) || pad.block || this.touch.block;
    cmd.special = this.isHeld(KEY_BINDINGS.special) || pad.special;
    for (const b of this.pressedQueue) cmd.pressed[b] = true;
    this.pressedQueue.clear();
    // Touch: SP arms the next attack as a special.
    if (this.touch.specialArmed && (cmd.pressed.lp || cmd.pressed.hp || cmd.pressed.lk || cmd.pressed.hk)) {
      cmd.special = true;
      this.touch.specialArmed = false;
      this.onSpecialUsed?.();
    }
    return cmd;
  }

  /** Drop anything queued (e.g. when pausing). */
  flush(): void {
    this.pressedQueue.clear();
  }
}

export interface PadState {
  moveX: number;
  moveZ: number;
  block: boolean;
  special: boolean;
}

function clamp1(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
