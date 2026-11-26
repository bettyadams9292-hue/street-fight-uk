/**
 * The venue kit: one look for every shop, counter and point of interest, themed per place.
 *
 * A venue screen is a card in Inter (ui/theme.css `.vn-*`): a header with the place's mark (a logo, or a painted
 * icon on its colour), a small line saying what kind of place it is, the name, a line of who's serving and the
 * wallet; then the body (sections, rows with an action each, amount chips, stats); then Leave. Every action is a
 * real menu button (data-nav), so keys and pads move between them like everywhere else.
 *
 * Themes are CSS custom properties on the card (`VenueTheme`): background, panel, ink, accent and a band (a strip
 * across the top in the place's own pattern: hazard tape for the garage, Battenburg for the police, a stripe for a
 * barber's pole). `VENUE_THEMES` holds the named ones; a bank passes its own colours.
 */
import { h } from './dom';
import { menuButton } from './controls';
import type { Screen } from './UIManager';

export interface VenueTheme {
  /** Card background, raised panels, text, the accent (buttons, highlights). */
  bg: string;
  panel: string;
  ink: string;
  accent: string;
  /** The strip across the top: any CSS background. */
  band: string;
  /** Light card (paper, porcelain) or dark. */
  light?: boolean;
}

const stripes = (a: string, b: string, w = 14, angle = 135) => `repeating-linear-gradient(${angle}deg, ${a} 0 ${w}px, ${b} ${w}px ${w * 2}px)`;
const chequer = (a: string, b: string) => `repeating-linear-gradient(90deg, ${a} 0 22px, ${b} 22px 44px)`;

/** The named looks, by kind of place. */
export const VENUE_THEMES = {
  garage: { bg: '#121417', panel: '#1c2025', ink: '#f1f3f5', accent: '#ffb000', band: stripes('#ffb000', '#16181b', 16) },
  motors: { bg: '#0e1116', panel: '#181d26', ink: '#f2f5fa', accent: '#ff3b30', band: chequer('#f2f2f2', '#121212') },
  tattoo: { bg: '#110d10', panel: '#1d161b', ink: '#f6ece9', accent: '#e0434f', band: stripes('#e0434f', '#110d10', 4, 90) },
  barber: { bg: '#f4f1ec', panel: '#ffffff', ink: '#1b1d22', accent: '#c4202b', band: stripes('#c4202b', '#ffffff', 12, 120), light: true },
  jeweller: { bg: '#0d0d0f', panel: '#18171a', ink: '#f5efe2', accent: '#d4af6a', band: 'linear-gradient(90deg, #8a6b33, #f3d79a 50%, #8a6b33)' },
  clothes: { bg: '#0f0f10', panel: '#1a1a1c', ink: '#f5f5f5', accent: '#ffffff', band: 'linear-gradient(90deg, #ffffff, #9a9a9a)' },
  pub: { bg: '#170f0a', panel: '#24170f', ink: '#f4e8d6', accent: '#d9a441', band: stripes('#5a2d14', '#2a160c', 10, 90) },
  casino: { bg: '#07130d', panel: '#0d2117', ink: '#f6f0dc', accent: '#e3b549', band: chequer('#b0141d', '#0a0a0a') },
  gym: { bg: '#0f1113', panel: '#191c20', ink: '#f2f4f6', accent: '#e8312a', band: stripes('#e8312a', '#0f1113', 18) },
  pawn: { bg: '#141310', panel: '#201e18', ink: '#f3efe2', accent: '#f2c94c', band: stripes('#f2c94c', '#141310', 10) },
  estate: { bg: '#f3f4f6', panel: '#ffffff', ink: '#14181f', accent: '#00a37a', band: 'linear-gradient(90deg, #00a37a, #00c896)', light: true },
  furniture: { bg: '#f3efe8', panel: '#ffffff', ink: '#211d18', accent: '#2f6e4f', band: 'linear-gradient(90deg, #2f6e4f, #6fa585)', light: true },
  food: { bg: '#fbf6ee', panel: '#ffffff', ink: '#231a14', accent: '#d2402b', band: stripes('#d2402b', '#ffffff', 10, 90), light: true },
  club: { bg: '#0b0b0c', panel: '#161617', ink: '#f2f2f2', accent: '#c81d25', band: 'linear-gradient(90deg, #2b0a0c, #c81d25 50%, #2b0a0c)' },
  street: { bg: '#0f1014', panel: '#1a1b21', ink: '#f1f1f4', accent: '#7c5cff', band: 'linear-gradient(90deg, #3c2a8a, #7c5cff)' },
  home: { bg: '#15120f', panel: '#211c17', ink: '#f3ebe0', accent: '#e8b04b', band: 'linear-gradient(90deg, #7b5a2e, #e8b04b 50%, #7b5a2e)' },
  metro: { bg: '#0c0e13', panel: '#171a22', ink: '#f4f4f6', accent: '#e8601c', band: 'linear-gradient(90deg, #e8601c 0 30%, #1d2230 30% 70%, #e8601c 70%)' },
  police: { bg: '#0b0f18', panel: '#121826', ink: '#f2f3f6', accent: '#ffd200', band: chequer('#1a43c8', '#ffd200') },
  plain: { bg: '#121317', panel: '#1b1c22', ink: '#f2f3f6', accent: '#e2342b', band: 'linear-gradient(90deg, #e2342b, rgba(226, 52, 43, 0))' },
} satisfies Record<string, VenueTheme>;

export type VenueThemeId = keyof typeof VENUE_THEMES;

export interface VenueOpts {
  theme: VenueThemeId | VenueTheme;
  /** A small line over the name: what kind of place this is. */
  kicker: string;
  title: string;
  /** Who's serving, or one line about the place. */
  sub?: string;
  /** The place's mark: a logo image, or a painted icon path. */
  logo?: string;
  /** Show the logo on a plate of this colour (a bank's own). */
  logoPlate?: string;
  /** What you can pay with (money/banking.ts walletLine). */
  wallet?: string;
  body: (HTMLElement | null | false)[];
  close: () => void;
  closeLabel?: string;
  /** Extra class on the screen (per-place tweaks). */
  cls?: string;
}

/** Apply a theme to an element (the card, or a phone app's body). */
export function applyTheme(el: HTMLElement, t: VenueThemeId | VenueTheme): void {
  const th: VenueTheme = typeof t === "string" ? VENUE_THEMES[t] : t;
  el.style.setProperty('--vn-bg', th.bg);
  el.style.setProperty('--vn-panel', th.panel);
  el.style.setProperty('--vn-ink', th.ink);
  el.style.setProperty('--vn-accent', th.accent);
  el.style.setProperty('--vn-band', th.band);
  el.classList.toggle('vn-light', !!th.light);
}

/** The header block alone (for screens that keep their own body, like the shop grids). */
export function venueHead(o: Pick<VenueOpts, 'kicker' | 'title' | 'sub' | 'logo' | 'logoPlate' | 'wallet'>): HTMLElement {
  return h('header', { class: 'vn-head' },
    o.logo ? h('span', { class: `vn-mark${o.logoPlate ? ' plate' : ''}`, style: o.logoPlate ? `background:${o.logoPlate}` : '' }, h('img', { src: o.logo, alt: '', draggable: 'false' })) : null,
    h('div', { class: 'vn-titles' },
      h('span', { class: 'vn-kicker', text: o.kicker }),
      h('h2', { text: o.title }),
      o.sub ? h('span', { class: 'vn-sub', text: o.sub }) : null,
    ),
    o.wallet ? h('span', { class: 'vn-wallet', text: o.wallet }) : null,
  );
}

export function venueScreen(o: VenueOpts): Screen & { card: HTMLElement; bodyEl: HTMLElement } {
  const bodyEl = h('div', { class: 'vn-body' }, ...o.body.filter((x): x is HTMLElement => !!x));
  const card = h('div', { class: 'vn-card' },
    h('div', { class: 'vn-band' }),
    venueHead(o),
    bodyEl,
    h('footer', { class: 'vn-foot menu-list' }, menuButton(o.closeLabel ?? 'Leave', o.close, undefined, 'vn-btn ghost', undefined, undefined, '')),
  );
  applyTheme(card, o.theme);
  const el = h('div', { class: `screen vn-screen${o.cls ? ` ${o.cls}` : ''}` }, card);
  return { el, onBack: o.close, card, bodyEl };
}

/** A titled group of rows. */
export function vnSection(title: string, ...children: (HTMLElement | null | false)[]): HTMLElement {
  return h('section', { class: 'vn-sec' }, h('h3', { text: title }), ...children.filter((x): x is HTMLElement => !!x));
}

export type Tone = 'go' | 'cost' | 'danger' | 'ghost';

/** One thing you can do: what it is, a line about it, and its button (null: shown, can't be done now). */
export function vnRow(title: string, sub: string, action: string | null, go: (() => void) | null, tone: Tone = 'go', extra?: HTMLElement): HTMLElement {
  return h('div', { class: `vn-row${go ? '' : ' off'}` },
    extra ?? null,
    h('div', { class: 'vn-what' }, h('b', { text: title }), sub ? h('span', { text: sub }) : null),
    action ? (go ? menuButton(action, go, undefined, `vn-btn ${tone}`, undefined, undefined, '') : h('span', { class: 'vn-tag', text: action })) : null,
  );
}

/** A row of quick amounts (or any short choices). */
export function vnChips(opts: { label: string; go: () => void; off?: boolean; on?: boolean }[]): HTMLElement {
  return h('div', { class: 'vn-chips menu-list' },
    ...opts.map((c) => {
      const b = menuButton(c.label, c.go, undefined, `vn-chip${c.on ? ' on' : ''}`, undefined, undefined, '');
      if (c.off) b.setAttribute('disabled', '');
      return b;
    }));
}

/** A big figure with its label (balances, totals). */
export function vnStat(label: string, value: string, cls = ''): HTMLElement {
  return h('div', { class: `vn-stat ${cls}`.trim() }, h('span', { text: label }), h('b', { text: value }));
}

/** A line of feedback under the header: what just happened, or why it didn't. */
export function vnNote(text: string, bad = false): HTMLElement {
  return h('p', { class: `vn-note${bad ? ' bad' : ''}${text ? '' : ' empty'}`, role: 'status', text });
}
