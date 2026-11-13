/**
 * Property for sale: twenty homes around town, from a studio on the Tanner
 * Road estate to five mansions behind the gates of Ashcombe Park. Each one is
 * a real door on a real street (see doors.ts), with its own interior, price
 * and rent. Prices are in the game's own pounds, on the same scale as the
 * cars at the dealer.
 *
 * Pure data and maths: no three.js, no UI.
 */
import type { AreaId } from '../progress/Progress';

export type PropCat = 'house' | 'flat' | 'apartment' | 'mansion';
export const PROP_CATS: PropCat[] = ['house', 'flat', 'apartment', 'mansion'];
export const PROP_CAT_LABELS: Record<PropCat, string> = { house: 'Houses', flat: 'Flats', apartment: 'Apartments', mansion: 'Mansions' };

/** How much the neighbourhood is worth: drives price growth and rental yield. */
export type Tier = 'budget' | 'mid' | 'prime' | 'super';
export const TIER_LABELS: Record<Tier, string> = { budget: 'Affordable', mid: 'Popular', prime: 'Sought-after', super: 'Exclusive' };

/** Rooms an interior can have, laid out along the walkway left to right. */
export type RoomKind =
  | 'hall' | 'living' | 'kitchen' | 'dining' | 'bedroom' | 'master' | 'bathroom' | 'ensuite' | 'studio' | 'study'
  | 'cinema' | 'games' | 'gym' | 'bar' | 'pool' | 'dressing' | 'conservatory' | 'terrace';

export interface PropertyDef {
  id: string;
  /** Address or building name. */
  name: string;
  cat: PropCat;
  /** "Mid-terrace house", "Penthouse apartment"... */
  type: string;
  /** The street it's on and where its front door is. */
  area: AreaId;
  x: number;
  /** Neighbourhood name for the listing. */
  locality: string;
  tier: Tier;
  beds: number;
  baths: number;
  /** Floor area, square feet. */
  sqft: number;
  /** Fit-out, 1 (basic) to 5 (luxury): picks floors, walls and furniture inside. */
  quality: 1 | 2 | 3 | 4 | 5;
  /** Asking price when the game starts. */
  price: number;
  rooms: RoomKind[];
  /** Has stairs up (a house, a duplex, a mansion). */
  stairs: boolean;
  garden?: 'yard' | 'garden' | 'grounds';
  /** Behind its own gates. */
  gated?: boolean;
  blurb: string;
}

export const QUALITY_LABELS = ['', 'Basic', 'Decent', 'Good', 'Premium', 'Luxury'] as const;

const P = (d: PropertyDef): PropertyDef => d;

export const PROPERTY_LIST: PropertyDef[] = [
  // ---- houses --------------------------------------------------------------------------------
  P({ id: 'h_tanner_9', name: '9 Tanner Road', cat: 'house', type: 'Small terraced house', area: 'estate', x: 5, locality: 'Tanner Road Estate', tier: 'budget', beds: 2, baths: 1, sqft: 640, quality: 2, price: 38000, rooms: ['hall', 'living', 'kitchen', 'bathroom', 'bedroom', 'bedroom'], stairs: true, garden: 'yard', blurb: 'Two-up two-down a few doors from yours. Back yard, new boiler, neighbours you already know.' }),
  P({ id: 'h_hollins_27', name: '27 Hollins Road', cat: 'house', type: 'Semi-detached house', area: 'residential', x: 60, locality: 'Hollins', tier: 'mid', beds: 3, baths: 1, sqft: 980, quality: 3, price: 72000, rooms: ['hall', 'living', 'dining', 'kitchen', 'bathroom', 'bedroom', 'master', 'bedroom'], stairs: true, garden: 'garden', blurb: '1930s semi with a bay window, a drive and a long back garden.' }),
  P({ id: 'h_parkside_6', name: '6 Parkside Avenue', cat: 'house', type: 'Detached house', area: 'leisure', x: 70, locality: 'Leisure Park', tier: 'mid', beds: 4, baths: 2, sqft: 1450, quality: 3, price: 125000, rooms: ['hall', 'living', 'dining', 'kitchen', 'study', 'bathroom', 'bedroom', 'bedroom', 'master', 'ensuite'], stairs: true, garden: 'garden', blurb: 'Detached family home overlooking the park, with a double garage.' }),
  P({ id: 'h_ashcombe_beeches', name: 'The Beeches, 4 Ashcombe Rise', cat: 'house', type: 'Large family house', area: 'ashcombe', x: 21, locality: 'Ashcombe Park', tier: 'prime', beds: 5, baths: 3, sqft: 2900, quality: 4, price: 340000, rooms: ['hall', 'living', 'dining', 'kitchen', 'conservatory', 'study', 'bathroom', 'bedroom', 'bedroom', 'bedroom', 'master', 'ensuite'], stairs: true, garden: 'garden', blurb: 'Big Edwardian family house on the Rise: five bedrooms, a conservatory and a garden you could lose a dog in.' }),
  P({ id: 'h_ashcombe_linden', name: 'Linden House, 11 Ashcombe Rise', cat: 'house', type: 'Luxury modern house', area: 'ashcombe', x: 82, locality: 'Ashcombe Park', tier: 'prime', beds: 4, baths: 4, sqft: 3400, quality: 5, price: 520000, rooms: ['hall', 'living', 'kitchen', 'dining', 'cinema', 'gym', 'master', 'ensuite', 'bedroom', 'bathroom', 'bedroom', 'terrace'], stairs: true, garden: 'garden', blurb: 'Brand-new build: polished concrete, floor-to-ceiling glass, a cinema room and a home gym.' }),
  // ---- flats ---------------------------------------------------------------------------------
  P({ id: 'f_lowry_3', name: 'Flat 3, Lowry House', cat: 'flat', type: 'Studio flat', area: 'estate', x: 24.5, locality: 'Tanner Road Estate', tier: 'budget', beds: 0, baths: 1, sqft: 320, quality: 1, price: 18000, rooms: ['studio', 'bathroom'], stairs: false, blurb: 'One room and a shower room on the second floor. Cheap, cheerful, two minutes from the gym.' }),
  P({ id: 'f_hollins_41', name: 'Flat 41, Hollins House', cat: 'flat', type: 'Budget flat', area: 'residential', x: 27, locality: 'Hollins', tier: 'budget', beds: 1, baths: 1, sqft: 410, quality: 1, price: 24000, rooms: ['hall', 'living', 'kitchen', 'bedroom', 'bathroom'], stairs: false, blurb: 'Council-built flat on the eighth floor. The lift works most days.' }),
  P({ id: 'f_fairclough_12', name: 'Flat 12, Fairclough Court', cat: 'flat', type: 'One-bedroom flat', area: 'residential', x: 68.5, locality: 'Hollins', tier: 'budget', beds: 1, baths: 1, sqft: 520, quality: 2, price: 32000, rooms: ['hall', 'living', 'kitchen', 'bedroom', 'bathroom'], stairs: false, blurb: 'Tidy one-bed with a balcony looking over the estate.' }),
  P({ id: 'f_kirkgate_58b', name: 'Flat B, 58 Kirkgate Street', cat: 'flat', type: 'Two-bedroom flat', area: 'stadium', x: 78, locality: 'Kirkgate', tier: 'mid', beds: 2, baths: 1, sqft: 700, quality: 2, price: 46000, rooms: ['hall', 'living', 'kitchen', 'bedroom', 'bedroom', 'bathroom'], stairs: false, blurb: 'Upstairs half of a converted terrace. You can hear the crowd on match days.' }),
  P({ id: 'f_kingsway_7', name: 'Flat 7, Kingsway Point', cat: 'flat', type: 'Modern city flat', area: 'precinct', x: 25, locality: 'Kingsway', tier: 'mid', beds: 2, baths: 2, sqft: 760, quality: 3, price: 68000, rooms: ['hall', 'living', 'kitchen', 'master', 'ensuite', 'bedroom', 'bathroom'], stairs: false, blurb: 'New-build flat above the precinct with an open-plan kitchen and two bathrooms.' }),
  // ---- apartments ----------------------------------------------------------------------------
  P({ id: 'a_bonded_4', name: 'Apartment 4, Bonded Wharf', cat: 'apartment', type: 'Luxury apartment', area: 'docks', x: 8, locality: 'Canal Docks', tier: 'mid', beds: 2, baths: 2, sqft: 1100, quality: 4, price: 145000, rooms: ['hall', 'living', 'kitchen', 'dining', 'master', 'ensuite', 'bedroom', 'bathroom'], stairs: false, blurb: 'Warehouse conversion: exposed brick, iron columns and canal views.' }),
  P({ id: 'a_shaws_9', name: 'Apartment 9, Shaw’s Wharf', cat: 'apartment', type: 'Modern designer apartment', area: 'docks', x: 66, locality: 'Canal Docks', tier: 'mid', beds: 2, baths: 2, sqft: 1200, quality: 4, price: 175000, rooms: ['hall', 'living', 'kitchen', 'bar', 'master', 'ensuite', 'study', 'bathroom'], stairs: true, blurb: 'Architect-designed duplex in the old shipping office, with a bar and a mezzanine study.' }),
  P({ id: 'a_ashcombe_tower', name: 'Apartment 1806, Ashcombe Tower', cat: 'apartment', type: 'High-rise apartment', area: 'ashcombe', x: 36, locality: 'Ashcombe Park', tier: 'prime', beds: 2, baths: 2, sqft: 1250, quality: 4, price: 210000, rooms: ['hall', 'living', 'kitchen', 'dining', 'master', 'ensuite', 'bedroom', 'bathroom'], stairs: false, blurb: 'Eighteenth floor with a concierge, a residents’ gym and a view to the docks.' }),
  P({ id: 'a_belgrave_2', name: 'Apartment 2, Belgrave Mansions', cat: 'apartment', type: 'Large multi-bedroom apartment', area: 'ashcombe', x: 52, locality: 'Ashcombe Park', tier: 'prime', beds: 4, baths: 3, sqft: 2600, quality: 4, price: 390000, rooms: ['hall', 'living', 'dining', 'kitchen', 'study', 'bedroom', 'bedroom', 'bathroom', 'bedroom', 'master', 'ensuite'], stairs: false, blurb: 'A whole floor of a Victorian mansion block: high ceilings, cornicing, four bedrooms.' }),
  P({ id: 'a_pinnacle_ph', name: 'The Penthouse, The Pinnacle', cat: 'apartment', type: 'Penthouse apartment', area: 'ashcombe', x: 98, locality: 'Ashcombe Park', tier: 'super', beds: 3, baths: 3, sqft: 3100, quality: 5, price: 680000, rooms: ['hall', 'living', 'kitchen', 'bar', 'dining', 'cinema', 'master', 'dressing', 'ensuite', 'bedroom', 'bathroom', 'terrace'], stairs: true, blurb: 'Top two floors of The Pinnacle with a wraparound roof terrace and its own lift.' }),
  // ---- mansions ------------------------------------------------------------------------------
  P({ id: 'm_wyvern_hall', name: 'Wyvern Hall', cat: 'mansion', type: 'Gated mansion', area: 'ashcombe', x: 66, locality: 'Ashcombe Park', tier: 'super', beds: 6, baths: 5, sqft: 7200, quality: 5, price: 1400000, rooms: ['hall', 'living', 'dining', 'kitchen', 'bar', 'games', 'cinema', 'gym', 'study', 'master', 'dressing', 'ensuite', 'bedroom', 'bathroom', 'bedroom', 'bedroom'], stairs: true, garden: 'grounds', gated: true, blurb: 'Electric gates, CCTV, a games room and a bar. Built for someone who likes their privacy.' }),
  P({ id: 'm_ashcombe_manor', name: 'Ashcombe Manor', cat: 'mansion', type: 'Traditional luxury estate', area: 'ashcombe', x: 116, locality: 'Ashcombe Park', tier: 'super', beds: 8, baths: 6, sqft: 11000, quality: 5, price: 1900000, rooms: ['hall', 'living', 'dining', 'kitchen', 'study', 'games', 'bar', 'conservatory', 'master', 'dressing', 'ensuite', 'bedroom', 'bathroom', 'bedroom', 'bedroom', 'bedroom'], stairs: true, garden: 'grounds', gated: true, blurb: 'The big house the park is named after: Georgian, listed, with a library and a sweeping staircase.' }),
  P({ id: 'm_glasshouse', name: 'The Glasshouse', cat: 'mansion', type: 'Modern architectural mansion', area: 'ashcombe', x: 136, locality: 'Ashcombe Park', tier: 'super', beds: 6, baths: 6, sqft: 9400, quality: 5, price: 2400000, rooms: ['hall', 'living', 'kitchen', 'dining', 'pool', 'gym', 'cinema', 'bar', 'master', 'dressing', 'ensuite', 'bedroom', 'bathroom', 'bedroom', 'terrace'], stairs: true, garden: 'grounds', gated: true, blurb: 'Award-winning glass and steel, with an indoor pool and a cinema. Featured in every magazine.' }),
  P({ id: 'm_heathfield', name: 'Heathfield House', cat: 'mansion', type: 'Mansion with large gardens', area: 'ashcombe', x: 156, locality: 'Ashcombe Park', tier: 'super', beds: 6, baths: 4, sqft: 6800, quality: 5, price: 1600000, rooms: ['hall', 'living', 'dining', 'kitchen', 'conservatory', 'study', 'games', 'master', 'ensuite', 'bedroom', 'bathroom', 'bedroom', 'bedroom'], stairs: true, garden: 'grounds', gated: true, blurb: 'Two acres of lawns, a walled garden and an orangery. The tennis court needs a net.' }),
  P({ id: 'm_kensington_lodge', name: 'Kensington Lodge', cat: 'mansion', type: 'Large luxury mansion', area: 'ashcombe', x: 176, locality: 'Ashcombe Park', tier: 'super', beds: 7, baths: 5, sqft: 8200, quality: 5, price: 1200000, rooms: ['hall', 'living', 'dining', 'kitchen', 'bar', 'cinema', 'gym', 'study', 'master', 'ensuite', 'bedroom', 'bathroom', 'bedroom', 'bedroom'], stairs: true, garden: 'grounds', gated: true, blurb: 'Seven bedrooms of marble and gold taps. Subtle it isn’t.' }),
];

export const PROPERTIES: Readonly<Record<string, PropertyDef>> = Object.fromEntries(PROPERTY_LIST.map((p) => [p.id, p]));

// ---- the market --------------------------------------------------------------------------------

/** One letting month, in seconds of play (time in menus and paused doesn't count). */
export const MONTH = 600;

/** Price growth per month and how jumpy it is, by neighbourhood. */
const TREND: Record<Tier, { drift: number; vol: number }> = {
  budget: { drift: 0.0015, vol: 0.012 },
  mid: { drift: 0.003, vol: 0.012 },
  prime: { drift: 0.0045, vol: 0.015 },
  super: { drift: 0.005, vol: 0.02 },
};
/** Gross rent per month as a share of value: cheap places earn more for what they cost. */
const YIELD: Record<Tier, number> = { budget: 0.0075, mid: 0.0062, prime: 0.0052, super: 0.0042 };
/** Agent's fee on a sale. */
export const SALE_FEE = 0.02;

/** A fixed number 0..1 from a string: the market is the same for every save and every reload. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const indexCache = new Map<Tier, number[]>();
/** The neighbourhood's price index after `month` months (1 at the start). Kept within 0.7 to 2.4. */
export function marketIndex(tier: Tier, month: number): number {
  const m = Math.max(0, Math.floor(month));
  let list = indexCache.get(tier);
  if (!list) indexCache.set(tier, (list = [1]));
  const t = TREND[tier];
  while (list.length <= m) {
    const k = list.length;
    const shock = (hash01(`${tier}:${k}`) - 0.5) * 2 * t.vol;
    list.push(Math.max(0.7, Math.min(2.4, list[k - 1] * (1 + t.drift + shock))));
  }
  return list[m];
}

export const monthAt = (playTime: number): number => Math.floor(Math.max(0, playTime) / MONTH);

const round = (n: number, to: number) => Math.round(n / to) * to;

/** What it's worth today. */
export function valueNow(d: PropertyDef, playTime: number): number {
  const v = d.price * marketIndex(d.tier, monthAt(playTime));
  return round(v, v >= 100000 ? 1000 : 250);
}

/** What it would rent for at the going rate, per month. */
export function marketRent(d: PropertyDef, playTime: number): number {
  return round(valueNow(d, playTime) * YIELD[d.tier], 5);
}

/** The rents you can ask: 70% to 130% of the going rate. */
export const RENT_STEPS = [0.7, 0.85, 1, 1.15, 1.3];
export const RENT_STEP_LABELS = ['Cheap', 'Below market', 'Market rate', 'Above market', 'Premium'];

/** What you'd get if you sold today, after the agent's fee. */
export function saleOffer(d: PropertyDef, playTime: number): { gross: number; fee: number; net: number } {
  const gross = valueNow(d, playTime);
  const fee = round(gross * SALE_FEE, 5);
  return { gross, fee, net: gross - fee };
}

export function formatPounds(n: number): string {
  const s = Math.abs(Math.round(n)).toLocaleString('en-GB');
  return `${n < 0 ? '−' : ''}£${s}`;
}
