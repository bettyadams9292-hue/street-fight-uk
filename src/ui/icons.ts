/**
 * One small icon set for the whole UI: map markers, menu buttons, the HUD
 * and inventory tabs. The artwork is one SVG per icon in public/icons/ui/
 * (24 x 24, 2px stroke, square caps and mitred corners, like stencilled
 * signage, coloured with currentColor). tools/icons/build_icons.py copies the
 * shapes into iconArt.ts so they are available synchronously. Original work.
 */
import { ICON_ART } from './iconArt';

export type IconName =
  | 'home' | 'mission' | 'boss' | 'side' | 'shop' | 'clothes' | 'pawn' | 'gym' | 'pub' | 'casino' | 'cars' | 'bikes'
  | 'property' | 'contact' | 'street' | 'parked' | 'lock' | 'map' | 'bag' | 'close' | 'play' | 'save' | 'settings'
  | 'controls' | 'quit' | 'phone' | 'pin' | 'you' | 'plus' | 'minus' | 'target' | 'route' | 'cab' | 'walk' | 'weapon'
  | 'consumable' | 'material' | 'valuable' | 'misc' | 'equipment' | 'all' | 'check' | 'coin' | 'back' | 'info'
  | 'food' | 'sleep' | 'shower' | 'tooth' | 'toilet' | 'gem' | 'key' | 'bell' | 'zoom-in' | 'zoom-out' | 'edit' | 'police';

const P: Record<IconName, string> = ICON_ART;

/** SVG markup for an icon (stroke uses currentColor). */
export function iconSvg(name: IconName, size = 24): string {
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${P[name]}</svg>`;
}

/** Inner paths only, for embedding in a bigger SVG (the map). */
export function iconPaths(name: IconName): string {
  return P[name];
}

/** The Hard Graft painted icons (public/icons/hg) that stand in for the line icons: every icon has one now. */
export const PAINTED: Partial<Record<IconName, string>> = {
  home: 'house', mission: 'rosette', boss: 'target_skull', side: 'fist', shop: 'shopping_bag', clothes: 'hoodie_hg',
  pawn: 'pawn_shop', gym: 'gloves_hanging', cars: 'car_saloon', bikes: 'dirt_bike', property: 'house_semi', contact: 'crew',
  street: 'street_lamp', parked: 'car_key', lock: 'lock', map: 'map', bag: 'backpack', close: 'cross', play: 'arrow_right',
  save: 'save', settings: 'gear', controls: 'gamepad', quit: 'power', phone: 'phone', pin: 'pin', plus: 'plus', minus: 'minus',
  target: 'target_skull', route: 'signpost', cab: 'car_hatch', walk: 'speed', weapon: 'bat', consumable: 'whey',
  material: 'toolbox', valuable: 'cash_twenties', misc: 'parcel', equipment: 'dumbbell', all: 'hg_crown', check: 'tick',
  coin: 'coins', back: 'arrow_left', info: 'info', gem: 'gold_chain', key: 'keys', edit: 'spanners', 'zoom-in': 'search',
  // Painted to match for the ones the sheets don't have (tools/icons/paint_icon.py).
  food: 'food', shower: 'shower', toilet: 'toilet', tooth: 'tooth', sleep: 'sleep', bell: 'bell', pub: 'pub', casino: 'casino',
  you: 'you', 'zoom-out': 'zoom_out', police: 'police',
};

/** The painted icon's file, if this icon has one. */
export function paintedIconUrl(name: IconName): string | null {
  const f = PAINTED[name];
  return f ? `/icons/hg/${f}.webp` : null;
}

/** A span holding the icon, for HTML: the painted icon where there is one, else the line drawing. */
export function icon(name: IconName, cls = ''): HTMLElement {
  const s = document.createElement('span');
  const url = paintedIconUrl(name);
  s.className = `icon ${url ? 'hg ' : ''}${cls}`.trim();
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    s.append(img);
  } else s.innerHTML = iconSvg(name);
  return s;
}
