/**
 * A shop's screens wear its shopfront: the same fascia (city/brands.ts, drawn by render/brandArt.ts) as the logo at
 * the top, and the fascia's colours for the accent and the strip across the top. The sign is found on the street:
 * the facade the shop's door is in. Places inside a bigger building (the dojo in the leisure centre, the fight club
 * under the boxing gym) have their own sign.
 */
import { brandFor, type Brand } from '../city/brands';
import { interiorFor } from '../city/street';
import { fasciaCanvas } from '../render/brandArt';
import { LEVELS } from '../world/levels';
import type { VenueTheme } from './venue';

/** Places with a name of their own, not their building's. */
const OWN_SIGN: Record<string, { label: string; kind: 'gym' | 'pub' | 'casino' }> = {
  karate_dojo: { label: 'FISTS FIRST', kind: 'gym' },
  fight_club: { label: 'THE SCRAP YARD', kind: 'gym' },
};

/** Not shops: no sign to wear. */
const NOT_SHOPS = new Set(['police_station', 'home', 'basement', 'property', 'ashcombe']);

export interface ShopBrand {
  label: string;
  brand: Brand;
}

const found = new Map<string, ShopBrand | null>();

/** The sign over `area`'s door on the street, if it's a shop. */
export function shopBrand(area: string | null | undefined): ShopBrand | null {
  if (!area || NOT_SHOPS.has(area) || area.startsWith('metro_')) return null;
  if (found.has(area)) return found.get(area)!;
  let out: ShopBrand | null = null;
  const own = OWN_SIGN[area];
  if (own) out = { label: own.label, brand: brandFor(own.label, own.kind) };
  else {
    for (const street of Object.values(LEVELS)) {
      const door = street.exits.find((e) => e.kind === 'door' && e.to === area);
      if (!door) continue;
      const f = street.facades.find((fc) => fc.label && door.x >= fc.x0 - 0.3 && door.x <= fc.x1 + 0.3 && fc.kind !== 'room');
      if (!f?.label) continue;
      const label = f.label.split(' — ')[0];
      out = { label, brand: brandFor(label, interiorFor(f.kind, f.label), f.colour) };
      break;
    }
  }
  found.set(area, out);
  return out;
}

const logos = new Map<string, { url: string; ratio: number }>();

/** The fascia as a picture for the screen's header (made once the fonts are in, then kept). */
export function shopLogo(area: string): { url: string; ratio: number } | null {
  const sb = shopBrand(area);
  if (!sb) return null;
  const hit = logos.get(area);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const aspect = Math.max(2.6, Math.min(7, sb.label.length * 0.62 + 1.4));
  const c = fasciaCanvas(sb.label, sb.brand, aspect, 96);
  const out = { url: c.toDataURL('image/png'), ratio: c.width / c.height };
  if (document.fonts?.status !== 'loading') logos.set(area, out);
  return out;
}

// ---- colours -----------------------------------------------------------------------------------------------------

const rgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6);
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const sat = (hex: string) => {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** The brand's colours as a screen theme, keeping the kind of place's light or dark card. */
export function brandTheme(b: Brand, base: VenueTheme): VenueTheme {
  // The accent: the brand's most colourful colour that reads on the card (gold leaf counts as gold).
  const picks = [b.bg, b.accent, b.fg, ...(b.gilt ? ['#d9b14a'] : [])].filter((c) => /^#[0-9a-f]{3,6}$/i.test(c));
  // Its most colourful colour, brought into a range that reads on the card (lighter on a dark card, deeper on a light one).
  const vivid = picks.filter((c) => sat(c) > 0.3).sort((x, y) => sat(y) - sat(x))[0];
  // Gold-leaf signwriting (pubs, jewellers, the casino): the screens are in its gold.
  let accent = b.gilt ? (base.light ? '#8a6b1e' : '#d9b14a') : vivid ?? base.accent;
  for (let i = 0; i < 8 && (base.light ? lum(accent) > 0.5 : lum(accent) < 0.3); i++) accent = mix(accent, base.light ? '#000000' : '#ffffff', 0.18);
  const band = b.stripe
    ? `linear-gradient(180deg, ${b.bg} 0 62%, ${b.accent} 62%)`
    : b.gilt
      ? `linear-gradient(90deg, ${b.bg}, #d9b14a 50%, ${b.bg})`
      : `linear-gradient(90deg, ${b.bg} 0 78%, ${b.accent} 78%)`;
  if (base.light) return { bg: mix(b.bg, '#ffffff', 0.94), panel: '#ffffff', ink: '#16181d', accent, band, light: true };
  const tint = lum(b.bg) < 0.5 ? b.bg : mix(b.bg, '#000000', 0.5);
  return { bg: mix(tint, '#0b0c0e', 0.86), panel: mix(tint, '#16181c', 0.8), ink: '#f4f4f2', accent, band };
}

/** Does the screen's title already say the shop's name (then the logo stands in for it)? */
export function titleIsBrand(title: string, label: string): boolean {
  const n = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const a = n(title);
  const b = n(label);
  return !!a && !!b && (a.includes(b) || b.includes(a));
}
