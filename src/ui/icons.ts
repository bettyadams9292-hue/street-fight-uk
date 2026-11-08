/**
 * One small icon set for the whole UI: map markers, menu buttons, the HUD
 * and inventory tabs. 24 × 24, drawn with a 2px round stroke so they all
 * read the same at any size. Drawn for this game (no icon font or library).
 */

export type IconName =
  | 'home' | 'mission' | 'boss' | 'side' | 'shop' | 'clothes' | 'pawn' | 'gym' | 'pub' | 'casino' | 'cars' | 'bikes'
  | 'property' | 'contact' | 'street' | 'parked' | 'lock' | 'map' | 'bag' | 'close' | 'play' | 'save' | 'settings'
  | 'controls' | 'quit' | 'phone' | 'pin' | 'you' | 'plus' | 'minus' | 'target' | 'route' | 'cab' | 'walk' | 'weapon'
  | 'consumable' | 'material' | 'valuable' | 'misc' | 'equipment' | 'all' | 'check' | 'coin' | 'back' | 'info';

const P: Record<IconName, string> = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  mission: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  boss: '<path d="M4 18 3 7l5 4 4-6 4 6 5-4-1 11z"/><path d="M4 21h16"/>',
  side: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  shop: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  clothes: '<path d="M8 3 3 6l2 4 2.5-1V21h9V9l2.5 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  pawn: '<circle cx="12" cy="14" r="6"/><path d="M9 4h6l-1.5 4h-3z"/>',
  gym: '<path d="M2.5 12h19"/><path d="M5 8v8M8 6.5v11M16 6.5v11M19 8v8"/>',
  pub: '<path d="M6 5h10v15H6z"/><path d="M16 9h2.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H16"/><path d="M6 9h10"/>',
  casino: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
  cars: '<path d="M3 16v-3l2-5h14l2 5v3z"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M5 13h14"/>',
  bikes: '<circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 10 9h5l3.5 7M9 9h-2M15 9l1.5-3H19"/>',
  property: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
  contact: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14.5a4.5 4.5 0 0 1 6 4.5"/>',
  street: '<circle cx="12" cy="12" r="3"/>',
  parked: '<circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 10 9h5l3.5 7"/><path d="M12 3v4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  bag: '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9 13h6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  controls: '<path d="M6 8h12a4 4 0 0 1 3.9 4.8l-1 4.4a2.5 2.5 0 0 1-4.3 1L15 16H9l-1.6 2.2a2.5 2.5 0 0 1-4.3-1l-1-4.4A4 4 0 0 1 6 8z"/><path d="M7 12h3M8.5 10.5v3"/><circle cx="16" cy="11.5" r=".8"/><circle cx="17.5" cy="13.5" r=".8"/>',
  quit: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  you: '<path d="M12 3 20 20l-8-4-8 4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  cab: '<path d="M4 17v-4l2-5h12l2 5v4z"/><path d="M9 8l.8-3h4.4L15 8"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="m9 21 2.5-6.5L14 17v4M11.5 14.5 12.5 9l3 3.5 3 .5M12.5 9 9 10.5 7.5 13.5"/>',
  weapon: '<path d="M4 20 15 9"/><path d="M14 4.5 19.5 10l-2 2L12 6.5z"/><path d="M6 15l3 3"/>',
  consumable: '<path d="M8 3h8M9 3v4l-3 4v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9l-3-4V3"/><path d="M6 14h12"/>',
  material: '<path d="M3 8l9-5 9 5-9 5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  valuable: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M12 9v12"/>',
  misc: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  equipment: '<path d="M6 7h12l1 13H5z"/><path d="M9 7V5h6v2M5 12h14"/>',
  all: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.5a3 3 0 0 0-5 2V16h6M8.5 13h4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};

/** SVG markup for an icon (stroke uses currentColor). */
export function iconSvg(name: IconName, size = 24): string {
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}

/** Inner paths only, for embedding in a bigger SVG (the map). */
export function iconPaths(name: IconName): string {
  return P[name];
}

/** A span holding the icon, for HTML. */
export function icon(name: IconName, cls = ''): HTMLElement {
  const s = document.createElement('span');
  s.className = `icon ${cls}`.trim();
  s.innerHTML = iconSvg(name);
  return s;
}
