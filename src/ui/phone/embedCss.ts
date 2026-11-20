/**
 * Screens shown inside the phone (Map, Bag, Me, Crew, Settings) should lay out as they do on an upright phone,
 * whatever the real screen is. The upright-phone rules live in `@media (orientation: portrait)` blocks; this copies
 * them once into `@container phone (...)` blocks, so they apply inside the phone's app view (a size container) when
 * it's narrow. Read from the loaded style sheets, so it always matches the CSS.
 */
let done = false;

export function embedPortraitRules(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSMediaRule && /orientation:\s*portrait/.test(r.media.mediaText)) {
        out.push(Array.from(r.cssRules).map((x) => x.cssText).join('\n'));
      }
    }
  }
  if (!out.length) return;
  const style = document.createElement('style');
  style.id = 'phone-embed-rules';
  style.textContent = `@container phone (max-width: 560px) {\n${out.join('\n')}\n}`;
  document.head.append(style);
}
