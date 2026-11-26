import type { InputManager } from '../input/InputManager';
import { h } from './dom';

/**
 * On-screen controls for phones and tablets: a floating stick on the left and a thumb arc on the right, laid
 * out by angle round a big PUNCH (layout()), with drawn glyphs and short captions; USE is a pill over the arc
 * that says what it will do. Multi-touch, so you can move, block and strike at the same time.
 */
export class TouchControls {
  readonly el: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  private readonly radius = 52;
  /** Each button with its place on the arc: angle (degrees, 0 = right, 90 = up), ring (0 = PUNCH), size (× PUNCH). */
  private buttons: [HTMLElement, number, number, number][] = [];
  private usePill!: HTMLElement;
  private useLabel!: HTMLElement;

  constructor(private readonly input: InputManager) {
    this.stickKnob = h('div', { class: 'stick-knob' });
    this.stickBase = h('div', { class: 'stick-base' }, this.stickKnob);
    const zone = h('div', { class: 'stick-zone' }, this.stickBase);

    // One button: a drawn glyph with a short caption, round, set on the thumb arc by layout().
    const btn = (caption: string, cls: string, glyph: string, onDown: () => void, onUp?: () => void) => {
      const b = h('div', { class: `touch-btn ${cls}`, 'aria-label': caption, role: 'button' }, h('span', { class: 'tb-ring' }), glyphEl(glyph), h('small', { text: caption }));
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
    // SPECIAL arms the next attack as a special (and SPECIAL then hard punch finishes a beaten opponent).
    const sp = btn('Special', 'sp', GLYPH.special, () => {
      input.touch.specialArmed = !input.touch.specialArmed;
      sp.classList.toggle('armed', input.touch.specialArmed);
    });
    input.onSpecialUsed = () => sp.classList.remove('armed');
    /**
     * The fighting arc for the right thumb (a modern mobile brawler's layout): PUNCH big where the thumb rests,
     * KICK beside it, the heavy hits just above, then round the outside DODGE, GRAB, BLOCK (hold), JUMP and
     * SPECIAL, with STYLE at the top. Each button's place is an angle and a ring out from PUNCH (layout()).
     * Walking about (body.roam) only PUNCH, KICK and JUMP show; USE is a pill over the arc saying what it does.
     */
    this.buttons = [
      [btn('Punch', 'lp', GLYPH.punch, () => input.pressFromTouch('lp')), 0, 0, 1],
      [btn('Kick', 'lk', GLYPH.kick, () => input.pressFromTouch('lk')), 180, 1, 0.8],
      [btn('Hard kick', 'hk', GLYPH.heavyKick, () => input.pressFromTouch('hk')), 138, 1, 0.7],
      [btn('Hard hit', 'hp', GLYPH.heavyPunch, () => input.pressFromTouch('hp')), 96, 1, 0.7],
      [btn('Dodge', 'dodge', GLYPH.dodge, () => input.pressFromTouch('dodge')), 186, 2, 0.64],
      [btn('Grab', 'grab', GLYPH.grab, () => input.pressFromTouch('grab')), 160, 2, 0.6],
      [btn('Block', 'block', GLYPH.block, () => (input.touch.block = true), () => (input.touch.block = false)), 132, 2, 0.76],
      [btn('Jump', 'jump', GLYPH.jump, () => input.pressFromTouch('jump')), 104, 2, 0.6],
      [sp, 80, 2, 0.6],
      [btn('Style', 'swap', GLYPH.swap, () => input.pressFromTouch('swap')), 118, 2.85, 0.52],
      // Walking about, JUMP sits where the heavy punch goes in a fight.
      [btn('Jump', 'jmp', GLYPH.jump, () => input.pressFromTouch('jump')), 96, 1, 0.7],
    ];
    const cluster = h('div', { class: 'tc-cluster' }, ...this.buttons.map((b) => b[0]));
    // USE: what's in front of you, said in words ("Open door", "Mug him"); only there while there's something to use.
    this.useLabel = h('b', { text: 'Use' });
    this.usePill = h('div', { class: 'touch-btn use tc-use', role: 'button', 'aria-label': 'Use' }, glyphEl(GLYPH.use), this.useLabel);
    this.usePill.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.usePill.classList.add('down');
      input.useFromTouch();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.usePill.addEventListener(ev, () => this.usePill.classList.remove('down'));

    this.el = h('div', { class: 'touch-controls tc2' }, zone, cluster, this.usePill);
    new ResizeObserver(() => this.layout()).observe(document.documentElement);
    window.addEventListener('orientationchange', () => this.layout());
    requestAnimationFrame(() => this.layout());

    // iOS still runs its own tap handling after a touch ends: double-tap zoom on a quick second tap, the text
    // magnifier, and a synthetic mouse click. The pad works on pointer events, so cancelling touchend here changes
    // nothing for it and stops all three (touch-action: none in the CSS covers the browsers that honour it).
    this.el.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    zone.addEventListener('pointerdown', (e) => this.stickStart(e, zone));
    zone.addEventListener('pointermove', (e) => this.stickMove(e));
    zone.addEventListener('pointerup', (e) => this.stickEnd(e));
    zone.addEventListener('pointercancel', (e) => this.stickEnd(e));
  }

  /**
   * Lay the arc out for this screen: PUNCH in from the bottom-right corner, every other button on its ring round
   * it, all scaled to the screen so a thumb reaches each one without leaving the corner.
   */
  private layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const upright = vh > vw;
    const unit = Math.max(0.78, Math.min(1.18, (upright ? vw / 430 : vh / 400)));
    const big = 84 * unit;
    const ring = 104 * unit;
    this.el.style.setProperty('--tb-big', `${big.toFixed(0)}px`);
    this.el.style.setProperty('--tc-unit', unit.toFixed(3));
    for (const [b, ang, r, size] of this.buttons) {
      const a = (ang * Math.PI) / 180;
      const d = big * size;
      // Upright, the outer rings are drawn in and stood up taller, so nothing reaches across to the stick.
      const outer = upright && r >= 2;
      const x = Math.cos(a) * ring * r * (outer ? 0.78 : 1);
      const y = Math.sin(a) * ring * r * (upright ? (outer ? 1.1 : 0.92) : 1);
      b.style.width = b.style.height = `${d.toFixed(0)}px`;
      // Positions are from PUNCH's middle; the cluster's own corner is PUNCH's middle.
      b.style.left = `${(x - d / 2).toFixed(0)}px`;
      b.style.top = `${(-y - d / 2).toFixed(0)}px`;
    }
  }

  /** What USE would do now (null hides it): from the game's interactable, in plain words. */
  setUse(label: string | null): void {
    this.usePill.classList.toggle('on', !!label);
    if (label && this.useLabel.textContent !== label) this.useLabel.textContent = label;
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
    this.setUse(null);
    this.stickBase.classList.remove('live');
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  }

  private stickStart(e: PointerEvent, zone: HTMLElement): void {
    if (this.stickId !== null) return;
    e.preventDefault();
    zone.setPointerCapture(e.pointerId);
    this.stickId = e.pointerId;
    // The ring centres on the thumb but stays wholly inside its zone, so it never sits over a button.
    const r = zone.getBoundingClientRect();
    const half = this.stickBase.offsetWidth / 2 || 54;
    const clamp = (v: number, lo: number, hi: number) => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    const cx = clamp(e.clientX - r.left, half, r.width - half);
    const cy = clamp(e.clientY - r.top, half, r.height - half);
    this.origin = { x: r.left + cx, y: r.top + cy };
    this.stickBase.style.left = `${cx}px`;
    this.stickBase.style.top = `${cy}px`;
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

/** The buttons' glyphs: simple strokes, drawn to read at a glance under a thumb. */
const svg = (d: string) => `<svg viewBox="0 0 32 32" aria-hidden="true">${d}</svg>`;
const GLYPH = {
  punch: svg('<path d="M9 13v-2.5a2 2 0 0 1 4 0V12m0-2.5a2 2 0 0 1 4 0V12m0-1.5a2 2 0 0 1 4 0V13m0-.5a2 2 0 0 1 4 0V18c0 5-3 8-8 8h-1.5C11 26 8 23 8 19v-3.5a2 2 0 0 1 4 0V18"/>'),
  heavyPunch: svg('<path d="M11 14v-2.5a2 2 0 0 1 4 0V13m0-2a2 2 0 0 1 4 0V13m0-1a2 2 0 0 1 4 0V18c0 5-3 8-8 8h-1c-4 0-7-3-7-7v-3a2 2 0 0 1 4 0v2"/><path d="M3 9h5M2 14h4M4 19h3"/>'),
  kick: svg('<path d="M7 25h11l6-3c2-1 2-4 0-4.5l-6-1.5-3-9h-5l1 9-4 3z"/>'),
  heavyKick: svg('<path d="M10 25h10l5-3c2-1 2-4 0-4.5l-5-1.5-3-8h-5l1 8-3 3z"/><path d="M2 10h5M1 15h4M3 20h3"/>'),
  block: svg('<path d="M16 4l10 4v7c0 7-4.5 11-10 13C10.5 26 6 22 6 15V8z"/>'),
  dodge: svg('<path d="M6 16h20M11 10l-6 6 6 6M21 10l6 6-6 6"/>'),
  grab: svg('<path d="M10 17V9a2 2 0 0 1 4 0v6m0-7a2 2 0 0 1 4 0v7m0-6a2 2 0 0 1 4 0v8m0-5a2 2 0 0 1 4 0v7c0 5-4 9-9 9s-9-3-10-7l-1-4a2 2 0 0 1 3.5-1.5L10 18"/>'),
  jump: svg('<path d="M16 26V7M9 13l7-7 7 7"/><path d="M10 27h12"/>'),
  special: svg('<path d="M16 3l3.5 8.5L28 13l-6.5 5.5L23.5 28 16 23l-7.5 5 2-9.5L4 13l8.5-1.5z"/>'),
  swap: svg('<path d="M7 11h17l-4-4M25 21H8l4 4"/>'),
  use: svg('<path d="M12 15V6.5a2 2 0 0 1 4 0V14m0-3a2 2 0 0 1 4 0v3m0-2a2 2 0 0 1 4 0v8c0 5-3.5 8-8 8h-1c-3 0-5-1.5-6.5-4L6 18.5a2 2 0 0 1 3.5-2L12 19"/>'),
};

function glyphEl(markup: string): HTMLElement {
  const g = document.createElement('span');
  g.className = 'tb-glyph';
  g.innerHTML = markup;
  return g;
}
