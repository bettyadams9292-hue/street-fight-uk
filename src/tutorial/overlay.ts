/**
 * The lesson card (in the HUD's own column, under the objective: `Hud.lesson`) and the light it puts on the
 * real HUD element or touch button a step is about. It only redraws when what it shows changes.
 */
import { h } from '../ui/dom';

export interface LessonView {
  kind: 'step' | 'hint';
  /** "01 · First steps", or the hint's title. */
  head: string;
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
    const keys = v.keys.length ? h('div', { class: 'tut-keys' }, ...v.keys.map((k) => h('kbd', { class: 'tut-key', text: k }))) : null;
    const dots = v.progress ? h('div', { class: 'tut-dots', 'aria-label': `Step ${v.progress.at} of ${v.progress.of}` }, ...Array.from({ length: v.progress.of }, (_, i) => h('i', { class: i < v.progress!.at - 1 ? 'on' : i === v.progress!.at - 1 ? 'now' : '' }))) : null;
    const actions = v.next || v.skip
      ? h('div', { class: 'tut-actions' },
        v.next ? h('button', { class: 'tut-next', onclick: () => this.on.next() }, v.next, h('small', { text: 'Enter' })) : null,
        v.skip ? h('button', { class: 'tut-skip', onclick: () => this.on.skip() }, v.skip) : null)
      : null;
    const parts: (HTMLElement | null)[] = [
      h('div', { class: 'tut-head' }, h('span', { text: v.head }), dots),
      h('p', { class: 'tut-text', text: v.text }),
      keys,
      v.pointer ? h('p', { class: 'tut-pointer', text: v.pointer }) : null,
      v.why ? h('p', { class: 'tut-why', text: v.why }) : null,
      actions,
    ];
    this.el.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
  }

  /** A step done: a tick and a brief light on the card before the next one shows. */
  flash(): void {
    this.el.classList.add('done');
    this.el.append(h('span', { class: 'tut-tick', 'aria-hidden': 'true' }));
    this.flashing = performance.now() + 650;
    this.shown = '';
  }

  /** Off and unlit (leaving the game, or the tutorial switched off). */
  clear(): void {
    this.shown = '';
    this.light([]);
    this.el.classList.add('off');
  }

  destroy(): void {
    this.clear();
    this.el.remove();
  }

  /** The lit elements are still in the page (the HUD rebuilds some on each visit). */
  private litStill(v: LessonView): boolean {
    return !v.focus.length || (this.lit.length > 0 && this.lit.every((e) => e.isConnected));
  }

  private light(selectors: string[]): void {
    for (const e of this.lit) e.classList.remove('tut-focus');
    this.lit = selectors.length ? [...document.querySelectorAll(selectors.join(', '))] : [];
    for (const e of this.lit) e.classList.add('tut-focus');
  }
}
