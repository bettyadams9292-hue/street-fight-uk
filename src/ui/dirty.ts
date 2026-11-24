/**
 * Writes to the page only when the value changes. The HUD updates every frame; writing the same text or
 * width again still replaces text nodes and invalidates style, which phones pay for in layout and paint.
 */
const texts = new WeakMap<Element, string>();
const styles = new WeakMap<HTMLElement, Map<string, string>>();

export function setText(el: Element, text: string): void {
  if (texts.get(el) === text) return;
  texts.set(el, text);
  el.textContent = text;
}

export function setStyle(el: HTMLElement, prop: string, value: string): void {
  let m = styles.get(el);
  if (!m) styles.set(el, (m = new Map()));
  if (m.get(prop) === value) return;
  m.set(prop, value);
  el.style.setProperty(prop, value);
}
