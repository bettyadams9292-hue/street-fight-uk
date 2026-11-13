/** Tiny DOM builder used by every UI screen. */
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'text') setText(el, String(v));
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Text, with any rank meter written as ▮▮▯▯ set as painted pips (fonts rarely carry
 * those characters, and a meter should look like one).
 */
function setText(el: HTMLElement, text: string): void {
  if (!/[\u25ae\u25af]/.test(text)) {
    el.textContent = text;
    return;
  }
  for (const part of text.split(/([\u25ae\u25af]+)/)) {
    if (!part) continue;
    if (!/^[\u25ae\u25af]+$/.test(part)) {
      el.append(part);
      continue;
    }
    const meter = document.createElement('span');
    meter.className = 'pips';
    meter.setAttribute('aria-label', `rank ${[...part].filter((c) => c === '\u25ae').length} of ${part.length}`);
    for (const c of part) {
      const pip = document.createElement('i');
      if (c === '\u25ae') pip.className = 'on';
      meter.append(pip);
    }
    el.append(meter);
  }
}
