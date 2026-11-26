import type { InputSource, MenuAction } from '../input/InputManager';

/** A full-screen menu. Focusable controls carry the `data-nav` attribute. */
export interface Screen {
  el: HTMLElement;
  /** Return true if the action was handled. */
  onAction?(action: MenuAction, source: InputSource): boolean;
  onBack?(): void;
  onShow?(): void;
}

/**
 * Stack of menu screens with keyboard / gamepad navigation. Mouse and touch
 * work directly on the buttons; arrows, D-pad and stick move the focus.
 */
export class UIManager {
  private stack: Screen[] = [];
  private focusIndex = 0;
  onNavigate: (() => void) | null = null;
  /** Given each screen as it's shown: the game themes it for the place you're in (ui/venueTheme.ts). */
  decorate: ((el: HTMLElement) => void) | null = null;
  onConfirm: (() => void) | null = null;

  /** Where screens go while an app has them inside the phone (null: over the game). */
  private host: HTMLElement | null = null;
  /** The last screen inside the phone closed. */
  onHostEmpty: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {}

  /** Put screens inside this element (the phone's app view), or back over the game with null. */
  setHost(el: HTMLElement | null): void {
    this.host = el;
  }

  get hosted(): boolean {
    return !!this.host;
  }

  private get mount(): HTMLElement {
    return this.host ?? this.root;
  }

  private emptied(): void {
    if (this.stack.length || !this.host) return;
    // The phone decides, a moment later, whether to go back to its home screen (another screen may open straight away).
    this.onHostEmpty?.();
  }

  get top(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  push(screen: Screen): void {
    if (this.top) this.top.el.classList.remove('active');
    this.stack.push(screen);
    this.decorate?.(screen.el);
    this.mount.append(screen.el);
    this.activate(screen);
  }

  pop(): void {
    const s = this.stack.pop();
    s?.el.remove();
    if (this.top) this.activate(this.top);
    else this.emptied();
  }

  replaceAll(screen: Screen | null): void {
    while (this.stack.length) this.stack.pop()!.el.remove();
    if (screen) this.push(screen);
    else this.emptied();
  }

  /** After a screen rebuilds its contents, focus the same position again. */
  keepFocus(): void {
    this.focus();
  }

  /** Focus a specific element (after a rebuild). */
  focusElement(el: HTMLElement | null): void {
    if (!el) return this.focus();
    const idx = this.items().indexOf(el);
    if (idx >= 0) this.focusIndex = idx;
    this.focus();
  }

  private activate(s: Screen): void {
    s.el.classList.add('active');
    s.onShow?.();
    this.focusIndex = 0;
    this.focus();
  }

  private items(): HTMLElement[] {
    if (!this.top) return [];
    return Array.from(this.top.el.querySelectorAll<HTMLElement>('[data-nav]')).filter((e) => !e.hasAttribute('disabled'));
  }

  private focus(): void {
    const items = this.items();
    if (!items.length) return;
    this.focusIndex = (this.focusIndex + items.length) % items.length;
    for (const it of items) it.classList.remove('focused');
    const el = items[this.focusIndex];
    el.classList.add('focused');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }

  /** Route a menu action to the top screen. Returns true if a menu consumed it. */
  handle(action: MenuAction, source: InputSource): boolean {
    const s = this.top;
    if (!s) return false;
    if (s.onAction?.(action, source)) return true;
    const items = this.items();
    // Keep focus in sync if the mouse moved it.
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? items.indexOf(active) : -1;
    if (idx >= 0) this.focusIndex = idx;

    switch (action) {
      case 'up':
        this.focusIndex--;
        this.focus();
        this.onNavigate?.();
        return true;
      case 'down':
        this.focusIndex++;
        this.focus();
        this.onNavigate?.();
        return true;
      case 'left':
      case 'right': {
        const el = items[this.focusIndex];
        // In item grids, left and right move between slots.
        if (el?.hasAttribute('data-grid')) {
          this.focusIndex += action === 'left' ? -1 : 1;
          this.focus();
          this.onNavigate?.();
          return true;
        }
        if (el) el.dispatchEvent(new CustomEvent('nav-adjust', { detail: action === 'left' ? -1 : 1 }));
        return true;
      }
      case 'confirm': {
        const el = items[this.focusIndex];
        if (el) {
          this.onConfirm?.();
          el.click();
        }
        return true;
      }
      case 'back':
        if (s.onBack) s.onBack();
        else this.pop();
        return true;
      default:
        return false;
    }
  }
}
