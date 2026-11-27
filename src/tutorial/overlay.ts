/**
 * The lesson card (in the HUD's own column, under the objective: `Hud.lesson`) and the light it puts on the
 * real HUD element or touch button a step is about. It only redraws when what it shows changes.
 */
import { h } from '../ui/dom';

export interface LessonView {
  kind: 'step' | 'hint';
  /** "01 · First steps", or the hint's title (for screen readers and the library). */
  head: string;
  /** The chapter's number ("01") or "Tip", and its title, shown apart. */
  badge: string;
  title: string;
  text: string;
  why?: string;
  /** What to press, already worded for the device in hand. */
  keys: string[];
  /** Step n of m in the chapter. */
  progress?: { at: number; of: number };
  /** "Head to the gym →": where to go first. */
  pointer?: string;
  /** A Next / Got it button (steps you read, and hints). */
  next: string | null;
  /** The skip button's words, or null for none. */
  skip: string | null;
  /** CSS selectors to light up. */
  focus: string[];
}

export class LessonOverlay {
  readonly el: HTMLElement;
  private shown = '';
  private lit: Element[] = [];
  /** Rings laid over what's lit (an outline can't be used: the bars are cut to shape with a clip-path). */
  private rings: HTMLElement[] = [];
  private flashing = 0;

  constructor(
    slot: HTMLElement,
    private readonly on: { next: () => void; skip: () => void },
  ) {
    this.el = h('div', { class: 'tut-card off', role: 'status', 'aria-live': 'polite' });
    slot.append(this.el);
  }

  /** Show this (or nothing). Cheap to call every frame. */
  show(v: LessonView | null, side: 'left' | 'right' = 'left'): void {
    this.place();
    // The USE plate steps to the other half of the screen while a card is up (the card would hide it).
    document.body?.classList?.toggle('tut-on-left', !!v && side === 'left');
    document.body?.classList?.toggle('tut-on-right', !!v && side === 'right');
    // The objective plate steps aside while a card is up, unless the step is about it.
    document.body?.classList?.toggle('tut-up', !!v);
    document.body?.classList?.toggle('tut-obj', !!v && v.focus.some((f) => f.includes('objective')));
    // Hold the tick on screen for a moment before the next step replaces it.
    if (performance.now() < this.flashing) return;
    const key = v ? JSON.stringify(v) + side : '';
    if (key === this.shown && (!v || this.litStill(v))) return;
    this.shown = key;
    this.light(v?.focus ?? []);
    if (!v) {
      this.el.classList.add('off');
      return;
    }
    this.el.className = `tut-card ${v.kind} ${side}`;
    this.el.style?.setProperty('--tut-progress', v.progress ? `${Math.round((v.progress.at / v.progress.of) * 100)}%` : '100%');
    this.el.style?.setProperty('--tut-auto', '0%');
    this.el.setAttribute?.('aria-label', v.head);
    const keys = v.keys.length ? h('div', { class: 'tut-keys' }, ...v.keys.map((k) => h('kbd', { class: 'tut-key', text: k }))) : null;
    const count = v.progress ? h('span', { class: 'tut-count', text: `${v.progress.at}/${v.progress.of}`, 'aria-label': `Step ${v.progress.at} of ${v.progress.of}` }) : null;
    this.nextBtn = v.next ? h('button', { class: 'tut-next', onclick: () => this.on.next() }, v.next, h('small', { text: 'Enter' })) : null;
    const actions = v.next || v.skip
      ? h('div', { class: 'tut-actions' },
        this.nextBtn,
        v.skip ? h('button', { class: 'tut-skip', onclick: () => this.on.skip() }, v.skip) : null)
      : null;
    const parts: (HTMLElement | null)[] = [
      h('div', { class: 'tut-head' }, h('span', { class: 'tut-badge', text: v.badge }), h('span', { class: 'tut-title', text: v.title }), count),
      h('p', { class: 'tut-text', text: v.text }),
      keys,
      v.pointer ? h('p', { class: 'tut-pointer', text: v.pointer }) : null,
      v.why ? h('p', { class: 'tut-why', text: v.why }) : null,
      actions,
    ];
    this.el.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    this.hotbarCheck = 0;
    this.clearHotbar();
  }

  private nextBtn: HTMLElement | null = null;

  /** How far a read step has got towards moving on by itself (0–1): fills the Next button. */
  setAuto(frac: number): void {
    this.el.style?.setProperty('--tut-auto', `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`);
  }

  /** A step done: a tick and a brief light on the card before the next one shows. */
  flash(): void {
    this.el.classList.add('done');
    this.el.append(h('span', { class: 'tut-tick', 'aria-hidden': 'true' }));
    this.flashing = performance.now() + 650;
    // Not '' (that's "nothing shown"): after a guide's last step there's nothing next, and with '' the card
    // matched "nothing" and was never taken down, stuck on screen with its tick.
    this.shown = '#flash';
  }

  /** Off and unlit (leaving the game, or the tutorial switched off). */
  clear(): void {
    this.shown = '';
    this.light([]);
    document.body?.classList?.remove('tut-on-left', 'tut-on-right', 'tut-up', 'tut-obj');
    this.el.classList.add('off');
  }

  destroy(): void {
    this.clear();
    this.el.remove();
  }

  private hotbarCheck = 0;

  private clearHotbar(): void {
    const card = this.el;
    if (!card?.style || card.classList?.contains('off')) return;
    // Measured every few frames: reading layout every frame costs on a phone.
    if (this.hotbarCheck++ % 12 !== 0) return;
    card.style.marginLeft = '';
    card.style.width = '';
    const bar = typeof document !== 'undefined' ? document.querySelector('.hotbar:not(.off)') : null;
    if (!bar) return;
    const c = card.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const overlap = b.width > 0 && c.bottom > b.top + 2 && c.top < b.bottom && c.left < b.right && c.right > b.left;
    if (!overlap) return;
    // The slots to the card's right (sideways phones): the card stops short of them.
    if (b.left > c.left + c.width / 2) {
      const w = Math.floor(b.left - 8 - c.left);
      if (w >= 250) card.style.width = `${w}px`;
      return;
    }
    const push = Math.ceil(b.right + 8 - c.left);
    card.style.marginLeft = `${push}px`;
    card.style.width = `calc(100% - ${push}px)`;
  }

  /** The lit elements are still in the page (the HUD rebuilds some on each visit). */
  private litStill(v: LessonView): boolean {
    return !v.focus.length || (this.lit.length > 0 && this.lit.every((e) => e.isConnected));
  }

  private light(selectors: string[]): void {
    this.lit = selectors.length ? [...document.querySelectorAll(selectors.join(', '))] : [];
    for (const r of this.rings) r.remove();
    this.rings = this.lit.map(() => h('div', { class: 'tut-ring', 'aria-hidden': 'true' }));
    if (this.rings.length) document.body.append(...this.rings);
    this.place();
  }

  /** Each ring over its element, where it is now; hidden when the element isn't on screen. And the card itself kept
   * clear of the hotbar column (upright phones put the slots down the left side, under the card). */
  private place(): void {
    this.clearHotbar();
    this.lit.forEach((e, i) => {
      const ring = this.rings[i];
      if (!ring?.style) return;
      const r = (e as HTMLElement).getBoundingClientRect?.();
      const on = !!r && r.width > 0 && r.height > 0;
      ring.style.display = on ? 'block' : 'none';
      if (on) Object.assign(ring.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
    });
  }
}
