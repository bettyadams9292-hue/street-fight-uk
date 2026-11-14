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
  | 'food' | 'sleep' | 'shower' | 'tooth' | 'toilet' | 'gem' | 'key';

const P: Record<IconName, string> = ICON_ART;

/** SVG markup for an icon (stroke uses currentColor). */
export function iconSvg(name: IconName, size = 24): string {
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${P[name]}</svg>`;
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
