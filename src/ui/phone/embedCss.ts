/**
 * Screens shown inside the phone (Me, Crew, Settings) should lay out as they do on an upright phone, whatever the
 * real screen is: an iPhone held upright, an iPad either way round, or a desktop browser.
 *
 * The game's screens are laid out by `@media` rules, and a media query asks about the real screen, not the phone.
 * On an upright iPhone the real screen *is* a narrow portrait one, so the right rules apply and the phone looked
 * right. On an iPad or a desktop the wide-screen rules applied inside the phone instead: two columns side by side,
 * clipped, and sliders with no track to drag.
 *
 * So, once, every size-based `@media` rule in the loaded style sheets is checked against an upright phone
 * (`PHONE`, 390 × 700 portrait, the size the repo checks UI at):
 *  - every size rule's original is told to leave the narrow app view alone (`:not(.ph-narrow *)`, no added
 *    specificity), so the real screen's layout never reaches inside the phone;
 *  - rules an upright phone would use get a copy as `@container phone (max-width: 560px)` straight after the original,
 *    in the same sheet, so inside the phone's narrow app view (a size container) the cascade is exactly an upright
 *    iPhone's, in the same order against the plain rules around it.
 * Rules about the device rather than its size (reduced motion, hover, pointer) are left as they are.
 *
 * `.ph-narrow` is set on the app view by `markNarrow` with the same 560 px test as the container query, so a
 * phone held sideways (where the app view is wide) keeps its own landscape layout, as before.
 */
let done = false;

/** The upright phone the screens are designed for. */
export const PHONE = { width: 390, height: 700 } as const;
/** Narrower than this, the app view counts as an upright phone (matches the `@container` query). */
export const NARROW_MAX = 560;

/** Does a media query list hold on an upright phone? `null`: it isn't only about size, so leave it alone. */
export function matchesPhone(media: string, screen: { width: number; height: number } = PHONE): boolean | null {
  const list = splitTop(media, ',');
  let any = false;
  for (const q of list) {
    const r = evalQuery(q.trim(), screen);
    if (r === null) return null;
    any ||= r;
  }
  return any;
}

function evalQuery(q: string, screen: { width: number; height: number }): boolean | null {
  let s = q.trim();
  let negate = false;
  if (/^not\s/i.test(s)) {
    negate = true;
    s = s.slice(3).trim();
  } else if (/^only\s/i.test(s)) s = s.slice(4).trim();
  const r = evalCondition(s, screen);
  if (r === null) return null;
  return negate ? !r : r;
}

/** `(a) and (b)`, `(a) or (b)`, `not (a)`, `screen and (a)`, nested brackets. */
function evalCondition(s: string, screen: { width: number; height: number }): boolean | null {
  s = s.trim();
  if (!s) return true;
  if (/^not\s/i.test(s)) {
    const r = evalCondition(s.slice(3), screen);
    return r === null ? null : !r;
  }
  const ands = splitWord(s, 'and');
  if (ands.length > 1) {
    let all = true;
    for (const part of ands) {
      const r = evalCondition(part, screen);
      if (r === null) return null;
      all &&= r;
    }
    return all;
  }
  const ors = splitWord(s, 'or');
  if (ors.length > 1) {
    let any = false;
    for (const part of ors) {
      const r = evalCondition(part, screen);
      if (r === null) return null;
      any ||= r;
    }
    return any;
  }
  if (/^(all|screen)$/i.test(s)) return true;
  if (/^print$/i.test(s)) return false;
  if (s.startsWith('(') && s.endsWith(')') && matchingClose(s, 0) === s.length - 1) {
    const inner = s.slice(1, -1).trim();
    if (inner.startsWith('(') || /^not\s/i.test(inner)) return evalCondition(inner, screen);
    return evalFeature(inner, screen);
  }
  return null;
}

function evalFeature(f: string, screen: { width: number; height: number }): boolean | null {
  const m = /^([a-z-]+)\s*(?::\s*(.+))?$/i.exec(f.trim());
  if (!m) return null;
  const name = m[1].toLowerCase();
  const raw = m[2]?.trim();
  const px = (v: string | undefined): number | null => {
    if (!v) return null;
    const n = /^(-?[\d.]+)(px|em|rem)?$/i.exec(v);
    if (!n) return null;
    const u = (n[2] ?? 'px').toLowerCase();
    return parseFloat(n[1]) * (u === 'px' ? 1 : 16);
  };
  const orientation = screen.height >= screen.width ? 'portrait' : 'landscape';
  switch (name) {
    case 'orientation':
      return raw ? raw.toLowerCase() === orientation : true;
    case 'min-width':
    case 'max-width':
    case 'min-height':
    case 'max-height': {
      const v = px(raw);
      if (v === null) return null;
      const have = name.endsWith('width') ? screen.width : screen.height;
      return name.startsWith('min') ? have >= v : have <= v;
    }
    case 'width':
    case 'height': {
      const v = px(raw);
      if (v === null) return null;
      return (name === 'width' ? screen.width : screen.height) === v;
    }
    default:
      // Reduced motion, hover, pointer, colour scheme…: about the device, not the size.
      return null;
  }
}

/** Index of the bracket closing the one at `open`. */
function matchingClose(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** Split on a character outside brackets. */
export function splitTop(s: string, ch: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ch && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

/** Split on a word (`and`, `or`) outside brackets. */
function splitWord(s: string, word: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  const re = new RegExp(`^\\s${word}\\s`, 'i');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && re.test(s.slice(i, i + word.length + 2))) {
      out.push(s.slice(start, i));
      start = i + word.length + 1;
      i = start - 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

const KEEP_OUT = ':where(:not(.ph-narrow *))';

/**
 * `a .b, c::before` → `a .b:where(:not(.ph-narrow *)), c:where(:not(.ph-narrow *))::before`: the same elements,
 * the same specificity, but never inside the phone's narrow app view.
 */
export function keepOutOfPhone(selectorText: string): string {
  return splitTop(selectorText, ',')
    .map((sel) => {
      const s = sel.trim();
      if (!s || s.includes('.ph-narrow')) return s;
      // A pseudo-element has to stay last: put the exclusion in front of it.
      let depth = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (depth === 0 && c === ':') {
          const rest = s.slice(i);
          if (rest.startsWith('::') || /^:(before|after|first-line|first-letter)\b/i.test(rest)) return `${s.slice(0, i)}${KEEP_OUT}${rest}`;
        }
      }
      return `${s}${KEEP_OUT}`;
    })
    .join(', ');
}

/** Tell the narrow-phone rules where they apply: the app view, while it's no wider than an upright phone's. */
export function markNarrow(box: HTMLElement): () => void {
  const set = () => box.classList.toggle('ph-narrow', box.clientWidth > 0 && box.clientWidth <= NARROW_MAX);
  set();
  if (typeof ResizeObserver === 'undefined') return () => {};
  const ro = new ResizeObserver(set);
  ro.observe(box);
  return () => ro.disconnect();
}

export function embedPortraitRules(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (!(r instanceof CSSMediaRule)) continue;
      const fits = matchesPhone(r.media.mediaText);
      if (fits === null) continue;
      const copy = fits ? Array.from(r.cssRules).map((x) => x.cssText).join('\n') : '';
      // The real screen's rule leaves the narrow app view alone, matching or not…
      for (const inner of Array.from(r.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue;
        const next = keepOutOfPhone(inner.selectorText);
        if (next !== inner.selectorText) inner.selectorText = next;
      }
      // …and an upright phone's rule gets a copy for the phone right after it, so the cascade order inside the phone
      // is exactly an upright iPhone's.
      if (copy) {
        try {
          sheet.insertRule(`@container phone (max-width: ${NARROW_MAX}px) {\n${copy}\n}`, i + 1);
          i++;
        } catch {
          // A browser without container queries keeps the old behaviour.
        }
      }
    }
  }
}
