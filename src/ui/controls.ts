import { h } from './dom';

/**
 * Reusable menu controls. Each focusable control carries `data-nav`, and
 * responds to `nav-adjust` (left/right on keyboard, D-pad or stick) as
 * well as mouse and touch.
 */

export function menuButton(label: string, onClick: () => void, sub?: string, extraClass = ''): HTMLButtonElement {
  return h(
    'button',
    { class: `menu-btn ${extraClass}`, 'data-nav': true, onclick: () => onClick() },
    h('span', { class: 'label', text: label }),
    sub ? h('span', { class: 'sub', text: sub }) : null,
  );
}

/** Slider over [min, max] with a formatted readout. */
export function sliderRow(
  label: string,
  value: number,
  onChange: (v: number) => void,
  opts: { min?: number; max?: number; step?: number; format?: (v: number) => string } = {},
): HTMLElement {
  const min = opts.min ?? 0;
  const max = opts.max ?? 1;
  const steps = 20;
  const step = opts.step ?? (max - min) / steps;
  const format = opts.format ?? ((v: number) => `${Math.round(((v - min) / (max - min)) * 100)}%`);
  const out = h('span', { class: 'value', text: format(value) });
  const input = h('input', { type: 'range', min, max, step, value, 'data-nav': true, 'aria-label': label }) as HTMLInputElement;
  const set = (v: number) => {
    const clamped = Math.max(min, Math.min(max, Math.round(v / step) * step));
    input.value = String(clamped);
    out.textContent = format(clamped);
    onChange(clamped);
  };
  input.addEventListener('input', () => set(Number(input.value)));
  input.addEventListener('nav-adjust', (e) => set(Number(input.value) + step * (e as CustomEvent<number>).detail));
  return h('div', { class: 'setting-row' }, h('span', { class: 'name', text: label }), input, out);
}

/** Cycles through a list of options with left/right or a click. */
export function cycleRow<T>(label: string, options: { value: T; label: string }[], current: T, onChange: (v: T) => void): HTMLElement {
  let i = Math.max(0, options.findIndex((o) => o.value === current));
  const btn = h('button', { class: 'cycle', 'data-nav': true, 'aria-label': label }) as HTMLButtonElement;
  const render = () => (btn.textContent = `‹  ${options[i].label}  ›`);
  const step = (d: number) => {
    i = (i + d + options.length) % options.length;
    render();
    onChange(options[i].value);
  };
  btn.addEventListener('click', (e) => {
    // Clicking the left third goes back, the rest goes forward.
    const r = btn.getBoundingClientRect();
    const me = e as MouseEvent;
    step(me.clientX && me.clientX < r.left + r.width / 3 ? -1 : 1);
  });
  btn.addEventListener('nav-adjust', (e) => step((e as CustomEvent<number>).detail));
  render();
  return h('div', { class: 'setting-row' }, h('span', { class: 'name', text: label }), btn);
}

/** Row of colour swatches. Left/right moves the selection. */
export function swatchRow(label: string, colours: string[], current: string, onChange: (c: string) => void): HTMLElement {
  let i = colours.indexOf(current);
  const box = h('div', { class: 'swatches', 'data-nav': true, tabindex: 0, role: 'listbox', 'aria-label': label });
  const buttons = colours.map((c, idx) => {
    const b = h('button', { class: 'swatch', title: c, 'aria-label': `${label} ${idx + 1}`, onclick: () => select(idx) });
    b.style.background = c;
    box.append(b);
    return b;
  });
  const select = (idx: number) => {
    i = (idx + colours.length) % colours.length;
    buttons.forEach((b, j) => b.classList.toggle('on', j === i));
    onChange(colours[i]);
  };
  buttons.forEach((b, j) => b.classList.toggle('on', j === i));
  box.addEventListener('nav-adjust', (e) => select((i < 0 ? 0 : i) + (e as CustomEvent<number>).detail));
  box.addEventListener('click', () => box.focus({ preventScroll: true }));
  return h('div', { class: 'setting-row swatch-row' }, h('span', { class: 'name', text: label }), box);
}

/** Number with - and + buttons. */
export function stepperRow(
  label: string,
  get: () => number,
  onStep: (delta: number) => void,
  opts: { canDec: () => boolean; canInc: () => boolean; detail?: () => string },
): { row: HTMLElement; refresh: () => void } {
  const value = h('span', { class: 'stepper-value' });
  const detail = h('span', { class: 'stepper-detail' });
  const dec = h('button', { class: 'step-btn', 'aria-label': `Lower ${label}`, onclick: (e: Event) => { e.stopPropagation(); act(-1); } }, '−') as HTMLButtonElement;
  const inc = h('button', { class: 'step-btn', 'aria-label': `Raise ${label}`, onclick: (e: Event) => { e.stopPropagation(); act(1); } }, '+') as HTMLButtonElement;
  const row = h('div', { class: 'setting-row stepper', 'data-nav': true, tabindex: 0 }, h('span', { class: 'name', text: label }), h('span', { class: 'stepper-controls' }, dec, value, inc), detail);
  const refresh = () => {
    value.textContent = String(get());
    detail.textContent = opts.detail?.() ?? '';
    dec.disabled = !opts.canDec();
    inc.disabled = !opts.canInc();
  };
  const act = (d: number) => {
    if (d < 0 ? !opts.canDec() : !opts.canInc()) return;
    onStep(d);
  };
  row.addEventListener('nav-adjust', (e) => act((e as CustomEvent<number>).detail));
  row.addEventListener('click', () => row.focus({ preventScroll: true }));
  refresh();
  return { row, refresh };
}
