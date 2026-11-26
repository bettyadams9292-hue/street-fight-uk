/**
 * Every screen opened in a place looks like that place (the venue kit's themes, ui/venue.ts): the car showroom and
 * its mods in chequered motorsport red, the tattoo studio in ink black and red, the barber in pole stripes on white,
 * the jeweller in black and gold, and so on. UIManager hands each screen it shows to `decorate`, which reads where
 * you are (and what you used) and sets the theme's colours and a line saying what kind of place it is; the shared
 * screen pieces (panel screens, the item shops, the studios, result cards) take their look from those
 * (ui/theme.css, `.vn-themed`). Screens with a design of their own (the venue kit's, the police's, the cash
 * machine's, the bank prompt) are left as they are.
 */
import { applyTheme, type VenueThemeId } from './venue';

interface Venue {
  theme: VenueThemeId;
  /** What kind of place it is, over the screen's name. */
  kind: string;
}

const BY_AREA: Record<string, Venue> = {
  clothes_shop: { theme: 'clothes', kind: 'Streetwear' },
  pawn_shop: { theme: 'pawn', kind: 'Pawnbrokers' },
  pub: { theme: 'pub', kind: 'Public house' },
  furniture_shop: { theme: 'furniture', kind: 'Furniture and flooring' },
  car_dealer: { theme: 'motors', kind: 'Car sales and mods' },
  bike_shop: { theme: 'motors', kind: 'Bikes, scooters and motorbikes' },
  casino: { theme: 'casino', kind: 'Casino' },
  grow_shop: { theme: 'garage', kind: 'Hydroponics and supplies' },
  gym_store: { theme: 'gym', kind: 'Fitness equipment' },
  boxing_gym: { theme: 'gym', kind: 'Boxing gym' },
  karate_dojo: { theme: 'gym', kind: 'Martial arts' },
  wrestling_club: { theme: 'gym', kind: 'Wrestling club' },
  jeweller: { theme: 'jeweller', kind: 'Fine jewellers' },
  estate_agent: { theme: 'estate', kind: 'Estate agents' },
  barber_shop: { theme: 'barber', kind: 'Barbers' },
  tattoo_studio: { theme: 'tattoo', kind: 'Tattoo studio' },
  fight_club: { theme: 'club', kind: 'Underground fight club' },
  police_station: { theme: 'police', kind: 'Police station' },
  home: { theme: 'home', kind: 'Home' },
  basement: { theme: 'garage', kind: 'The basement' },
  property: { theme: 'home', kind: 'Your property' },
};

/** Some things are their own kind of place wherever they are. */
const BY_STATION: Record<string, Venue> = {
  garage: { theme: 'garage', kind: 'Your garage' },
  workbench: { theme: 'garage', kind: 'Workbench' },
  prep: { theme: 'garage', kind: 'The prep table' },
  kitchen: { theme: 'food', kind: 'Kitchen' },
  cooker: { theme: 'food', kind: 'Kitchen' },
  fridge: { theme: 'food', kind: 'Kitchen' },
  cupboard: { theme: 'food', kind: 'Kitchen' },
  bar: { theme: 'pub', kind: 'At the bar' },
  contact: { theme: 'street', kind: 'Contact' },
  recruit: { theme: 'pub', kind: 'For hire' },
  computer: { theme: 'home', kind: 'Your computer' },
  tin: { theme: 'home', kind: 'The biscuit tin' },
  casino_cashier: { theme: 'casino', kind: 'Cashier' },
  casino_slots: { theme: 'casino', kind: 'Slots' },
  casino_roulette: { theme: 'casino', kind: 'Roulette' },
  casino_blackjack: { theme: 'casino', kind: 'Blackjack' },
  cash_hatch: { theme: 'pawn', kind: 'Pawn hatch' },
};

/** The look for a screen opened in `area` (from `station`, if it was one). */
export function venueFor(area: string | undefined, station?: string | null): Venue {
  if (station && BY_STATION[station]) return BY_STATION[station];
  if (area && BY_AREA[area]) return BY_AREA[area];
  if (area?.startsWith('metro_')) return { theme: 'metro', kind: 'Brack Metro' };
  return { theme: 'plain', kind: '' };
}

/** Screens that already have a design of their own. */
const OWN = '.vn-screen, .pz-screen, .bp-screen, .atm-screen, .map-screen, .creator, .inv-screen, .profile-screen';

export function decorate(el: HTMLElement, v: Venue): void {
  if (el.matches(OWN)) return;
  el.classList.add('vn-themed');
  applyTheme(el, v.theme);
  el.style.setProperty('--vn-kicker', JSON.stringify(v.kind));
  el.classList.toggle('vn-kicked', !!v.kind);
}
