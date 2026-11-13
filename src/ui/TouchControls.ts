import type { InputManager } from '../input/InputManager';
import { h } from './dom';

/**
 * On-screen controls for phones and tablets: a floating stick on the left,
 * four attack buttons in a diamond on the right, plus BLOCK and JUMP.
 * Multi-touch, so you can move, block and strike at the same time.
 */
export class TouchControls {
  readonly el: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private readonly radius = 52;

  constructor(private readonly input: InputManager) {
    this.stickKnob = h('div', { class: 'stick-knob' });
    this.stickBase = h('div', { class: 'stick-base' }, this.stickKnob);
    const zone = h('div', { class: 'stick-zone' }, this.stickBase);

    const btn = (label: string, cls: string, onDown: () => void, onUp?: () => void) => {
      const b = h('div', { class: `touch-btn ${cls}`, text: label });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('down');
        onDown();
      });
      const up = () => {
        b.classList.remove('down');
        onUp?.();
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      return b;
    };

    const pad = h(
      'div',
      { class: 'attack-pad' },
      btn('HP', 'hp', () => input.pressFromTouch('hp')),
      btn('LP', 'lp', () => input.pressFromTouch('lp')),
      btn('HK', 'hk', () => input.pressFromTouch('hk')),
      btn('LK', 'lk', () => input.pressFromTouch('lk')),
    );
    const side = h(
      'div',
      { class: 'side-pad' },
      btn('BLOCK', 'block', () => (input.touch.block = true), () => (input.touch.block = false)),
      btn('DODGE', 'dodge', () => input.pressFromTouch('dodge')),
      btn('JUMP', 'jump', () => input.pressFromTouch('jump')),
      btn('GRAB', 'grab', () => input.pressFromTouch('grab')),
    );
    // Inventory, top right under the pause button.
    const bag = btn('BAG', 'bag', () => input.menuFromTouch('inventory'));
    // SP arms the next attack as a special (and SP + HP finishes a beaten opponent).
    const sp = btn('SP', 'sp', () => {
      input.touch.specialArmed = !input.touch.specialArmed;
      sp.classList.toggle('armed', input.touch.specialArmed);
    });
    input.onSpecialUsed = () => sp.classList.remove('armed');
    const extras = h('div', { class: 'extra-pad' }, sp, btn('SWAP', 'swap', () => input.pressFromTouch('swap')));

    this.el = h('div', { class: 'touch-controls' }, zone, side, pad, extras, bag);

    // iOS still runs its own tap handling after a touch ends: double-tap zoom on a quick second tap, the text
    // magnifier, and a synthetic mouse click. The pad works on pointer events, so cancelling touchend here changes
    // nothing for it and stops all three (touch-action: none in the CSS covers the browsers that honour it).
    this.el.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    zone.addEventListener('pointerdown', (e) => this.stickStart(e, zone));
    zone.addEventListener('pointermove', (e) => this.stickMove(e));
    zone.addEventListener('pointerup', (e) => this.stickEnd(e));
    zone.addEventListener('pointercancel', (e) => this.stickEnd(e));
  }

  set visible(v: boolean) {
    this.el.style.display = v ? 'block' : 'none';
    if (!v) this.release();
  }

  release(): void {
    this.stickId = null;
    this.input.touch.moveX = 0;
    this.input.touch.moveZ = 0;
    this.input.touch.block = false;
    this.input.touch.specialArmed = false;
    this.el.querySelector('.sp')?.classList.remove('armed');
    this.stickBase.classList.remove('live');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  }

  private stickStart(e: PointerEvent, zone: HTMLElement): void {
    if (this.stickId !== null) return;
    e.preventDefault();
    zone.setPointerCapture(e.pointerId);
    this.stickId = e.pointerId;
    const r = zone.getBoundingClientRect();
    this.origin = { x: e.clientX, y: e.clientY };
    this.stickBase.style.left = `${e.clientX - r.left}px`;
    this.stickBase.style.top = `${e.clientY - r.top}px`;
    this.stickBase.classList.add('live');
    this.stickMove(e);
  }

  private stickMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / this.radius;
    const ny = dy / this.radius;
    const dead = 0.22;
    this.input.touch.moveX = Math.abs(nx) < dead ? 0 : nx;
    // Screen-down = towards the camera = +z.
    this.input.touch.moveZ = Math.abs(ny) < dead ? 0 : ny;
  }

  private stickEnd(e: PointerEvent): void {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.input.touch.moveX = 0;
    this.input.touch.moveZ = 0;
    this.stickBase.classList.remove('live');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  }
}
