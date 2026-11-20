import { h } from './dom';
import { icon, type IconName } from './icons';

export type NoteKind = 'cash' | 'item' | 'info' | 'warn' | 'need';

const KIND_ICON: Record<NoteKind, string> = {
  cash: '/icons/hg/cash_twenties.webp',
  item: '/icons/hg/parcel.webp',
  info: '/icons/hg/info.webp',
  warn: '/icons/hg/warning.webp',
  need: '/icons/hg/bell.webp',
};

const MAX_SHOWN = 3;

type Live = { el: HTMLElement; key: string; timer: number; count: number; badge: HTMLElement; until: number };

/**
 * The game's notifications: cards that drop in under the top bars, stack (newest on top, three at most), say
 * the same thing once with a count instead of twice, and go by themselves after long enough to read them. Tap
 * or swipe one up to send it away. Sizes come from the screen (clamp), so they read the same on a phone held
 * either way and on a desktop.
 *
 * "Title: the rest" messages ("Pockets full: no room for the crowbar") show the title in bold on its own line.
 */
export class Notifications {
  readonly el = h('div', { class: 'ntf-stack', role: 'status', 'aria-live': 'polite' });
  private live: Live[] = [];

  show(text: string, kind: NoteKind = 'info', opts: { accent?: string; icon?: IconName; id?: string } = {}): void {
    const key = opts.id ?? `${kind}|${text}`;
    const same = this.live.find((n) => n.key === key);
    if (same && !opts.id) {
      same.count++;
      same.badge.textContent = `×${same.count}`;
      same.badge.hidden = false;
      same.el.classList.remove('bump');
      void same.el.offsetWidth;
      same.el.classList.add('bump');
      this.arm(same, text);
      return;
    }
    if (same) this.dismiss(same, true);

    const { title, body } = split(text);
    const badge = h('span', { class: 'ntf-count', hidden: true });
    const art = opts.icon ? h('span', { class: 'ntf-icon line' }, icon(opts.icon)) : h('span', { class: 'ntf-icon' }, h('img', { src: KIND_ICON[kind], alt: '', draggable: 'false' }));
    const el = h(
      'div',
      { class: `ntf ${kind}` },
      art,
      h('div', { class: 'ntf-text' }, title ? h('b', { text: title }) : null, body ? h('span', { text: body }) : null),
      badge,
    );
    if (opts.accent) el.style.setProperty('--ntf-accent', opts.accent);
    const n: Live = { el, key, timer: 0, count: 1, badge, until: 0 };
    // Tap to dismiss; a flick upwards too.
    let y0: number | null = null;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      y0 = e.clientY;
    });
    el.addEventListener('pointermove', (e) => {
      if (y0 === null) return;
      const dy = Math.min(0, e.clientY - y0);
      el.style.transform = `translateY(${dy}px)`;
      el.style.opacity = String(Math.max(0.2, 1 + dy / 80));
    });
    const up = (e: PointerEvent) => {
      if (y0 === null) return;
      const dy = e.clientY - y0;
      y0 = null;
      if (dy < -24 || Math.abs(dy) < 6) this.dismiss(n);
      else {
        el.style.transform = '';
        el.style.opacity = '';
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => {
      y0 = null;
      el.style.transform = '';
      el.style.opacity = '';
    });
    this.el.prepend(el);
    this.live.unshift(n);
    while (this.live.length > MAX_SHOWN) this.dismiss(this.live[this.live.length - 1], true);
    this.arm(n, text);
  }

  /** Long enough to read: about 2.6 s plus a little per word, at most 7 s. */
  private arm(n: Live, text: string): void {
    clearTimeout(n.timer);
    const ms = Math.min(7000, 2600 + text.length * 38);
    n.timer = window.setTimeout(() => this.dismiss(n), ms);
  }

  private dismiss(n: Live, quick = false): void {
    clearTimeout(n.timer);
    const i = this.live.indexOf(n);
    if (i < 0) return;
    this.live.splice(i, 1);
    if (quick) {
      n.el.remove();
      return;
    }
    // Fold away: fade and slide up, then close the gap.
    n.el.style.height = `${n.el.offsetHeight}px`;
    n.el.classList.add('out');
    void n.el.offsetWidth;
    n.el.style.height = '0px';
    window.setTimeout(() => n.el.remove(), 260);
  }

  clear(): void {
    for (const n of [...this.live]) this.dismiss(n, true);
  }
}

function split(text: string): { title: string; body: string } {
  const m = /^([^:.!?“"]{2,28}):\s+(.+)$/s.exec(text);
  if (!m) return { title: '', body: text };
  const rest = m[2];
  return { title: m[1], body: rest.charAt(0).toUpperCase() + rest.slice(1) };
}
