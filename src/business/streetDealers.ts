/**
 * Street dealers: the competition. Once you're dealing (`dealingOpen`), the rough districts have their own dealer
 * working a corner, on and off: one stands against a wall on the street, a purple £ over his head.
 *
 * - While he's there, punters in that district have someone else to buy off: your street price there drops
 *   (`RIVAL_CUT`).
 * - You can buy off him (`buyOff`): a few deals at trade (`TRADE_SHARE` of the street price), handy when you're out
 *   and away from the prep table.
 * - Tax him (`taxOffer`): he pays you a cut to be left alone, or squares up with his mates. Once a stretch.
 * - Run him off: a fight with him and his mates. Win and his stash and cash are on the floor, and the corner is yours
 *   for `CORNER_TRIPS` trips: no rival, and punters pay a little more there (`CORNER_BONUS`).
 *
 * Which districts have one, and when, is fixed by the district and the stretch of trips (`DEALER_TRIPS`), so a reload
 * doesn't change it. Numbers and save state only; the people are World's, the screen Game's.
 */
import type { Progress } from '../progress/Progress';
import { ROUGH_DISTRICTS } from '../progress/cops';
import { hash01 } from '../realty/catalogue';
import { DRUGS, DRUG_DEFS, dealingOpen, type Drug } from './dealing';

/** Where they work: the rough districts, and your own estate. */
export const DEALER_DISTRICTS: ReadonlySet<string> = new Set([...ROUGH_DISTRICTS, 'Home Estate']);
/** A dealer turns up for a stretch of this many trips, about this often. */
export const DEALER_TRIPS = 4;
export const DEALER_CHANCE = 0.65;
/** Your price where a rival's working, and where the corner is yours. */
export const RIVAL_CUT = 0.8;
export const CORNER_BONUS = 1.1;
/** Running him off keeps the corner yours for this many trips. */
export const CORNER_TRIPS = 8;
/** He sells to you at this share of the street price, at most this many deals a visit. */
export const TRADE_SHARE = 0.75;
export const TRADE_MAX = 6;
/** Heat for leaning on him, where it happens. */
export const DEALER_HEAT = { street: 6, police: 3 } as const;

const NAMES = ['Tyrell', 'Deano', 'Little Mo', 'Kai', 'Shaun', 'Rizzy', 'Jonno', 'Fitz', 'Benny', 'Kurtis', 'Ash', 'Lewi'] as const;

export interface CornerSave {
  /** Corners you've taken: district → the trip it's yours until. */
  until: Record<string, number>;
  /** Stretches you've taxed: district → stretch number. */
  taxed: Record<string, number>;
  /** Deals bought off a dealer this stretch: district → count. */
  bought: Record<string, { stretch: number; n: number }>;
}

export function newCorners(): CornerSave {
  return { until: {}, taxed: {}, bought: {} };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : d);

export function sanitiseCorners(r: unknown): CornerSave {
  const out = newCorners();
  if (!r || typeof r !== 'object') return out;
  const x = r as Partial<CornerSave>;
  for (const [k, v] of Object.entries(x.until ?? {})) if (typeof v === 'number') out.until[k] = num(v);
  for (const [k, v] of Object.entries(x.taxed ?? {})) if (typeof v === 'number') out.taxed[k] = num(v);
  for (const [k, v] of Object.entries(x.bought ?? {})) if (v && typeof v === 'object') out.bought[k] = { stretch: num((v as { stretch: unknown }).stretch, -1), n: num((v as { n: unknown }).n) };
  return out;
}

function corners(p: Progress): CornerSave {
  const d = p.save.dealing;
  // Saved as it came: tidied the first time it's used after a load.
  if (!d.corners || (d.corners as unknown as { __ok?: true }).__ok === undefined) {
    d.corners = sanitiseCorners(d.corners);
    Object.defineProperty(d.corners, '__ok', { value: true, enumerable: false });
  }
  return d.corners;
}

export function stretchOf(trip: number): number {
  return Math.floor(trip / DEALER_TRIPS);
}

/** The corner's yours here (you ran their dealer off, and it hasn't run out). */
export function cornerYours(p: Progress, district: string): boolean {
  return (corners(p).until[district] ?? -1) > p.save.trips;
}

/** Someone's dealing here this trip (and you're in that line of work, so you'd notice). */
export function rivalIn(p: Progress, district: string): boolean {
  if (!dealingOpen(p) || !DEALER_DISTRICTS.has(district) || cornerYours(p, district)) return false;
  return hash01(`rival:${district}:${stretchOf(p.save.trips)}`) < DEALER_CHANCE;
}

export interface Dealer {
  name: string;
  /** What he's carrying, deals of each. */
  stock: Record<Drug, number>;
  /** Cash on him: what he drops if he's put down, and his cut if he's taxed. */
  cash: number;
  /** Mates who back him up. */
  mates: number;
  /** He'd rather pay than fight (taxing). */
  soft: number;
}

/** This stretch's dealer in this district: who he is and what he's got. */
export function dealerIn(p: Progress, district: string): Dealer {
  const st = stretchOf(p.save.trips);
  const h = (salt: string) => hash01(`dealer:${district}:${st}:${salt}`);
  const stock: Record<Drug, number> = { weed: 0, coke: 0, pills: 0 };
  // Weed always; pills or coke as well, coke more on the rougher estates.
  stock.weed = 6 + Math.floor(h('weed') * 10);
  if (h('pills') < 0.6) stock.pills = 8 + Math.floor(h('pn') * 12);
  if (h('coke') < 0.45) stock.coke = 3 + Math.floor(h('cn') * 6);
  return {
    name: NAMES[Math.floor(h('name') * NAMES.length) % NAMES.length],
    stock,
    cash: 80 + Math.floor(h('cash') * 220),
    mates: 1 + Math.floor(h('mates') * 2),
    soft: h('soft'),
  };
}

/** What one deal costs off him. */
export function tradePrice(drug: Drug): number {
  return Math.max(1, Math.round(DRUG_DEFS[drug].street * TRADE_SHARE));
}

/** How many more he'll sell you this stretch. */
export function tradeLeft(p: Progress, district: string): number {
  const b = corners(p).bought[district];
  const n = b && b.stretch === stretchOf(p.save.trips) ? b.n : 0;
  return Math.max(0, TRADE_MAX - n);
}

export type DealerResult = { ok: true; text: string } | { ok: false; reason: string };

/** Buy deals off him, into your pockets (stolen: contraband, like your own). */
export function buyOff(p: Progress, district: string, drug: Drug, n: number): DealerResult {
  const d = dealerIn(p, district);
  const k = Math.min(n, tradeLeft(p, district), d.stock[drug]);
  if (k <= 0) return { ok: false, reason: 'He’s not selling you any more today.' };
  const def = DRUG_DEFS[drug];
  if (p.spaceFor(def.dealItem, { stolen: true }) < k) return { ok: false, reason: 'No room in your pockets.' };
  const price = tradePrice(drug) * k;
  if (!p.pay(price)) return { ok: false, reason: `That’s £${price}. You haven’t got it.` };
  p.giveItem(def.dealItem, k, { stolen: true });
  const c = corners(p);
  const st = stretchOf(p.save.trips);
  const b = c.bought[district];
  c.bought[district] = { stretch: st, n: (b && b.stretch === st ? b.n : 0) + k };
  return { ok: true, text: `${k} ${k === 1 ? def.dealName.toLowerCase() : def.dealPlural} for £${price}.` };
}

/** Already taxed him this stretch. */
export function taxedNow(p: Progress, district: string): boolean {
  return corners(p).taxed[district] === stretchOf(p.save.trips);
}

/**
 * Lean on him for a cut. He pays (`paid`) or squares up (the World starts the fight). `roll` is 0..1; a higher level
 * and a name for yourself round here (street heat) make him likelier to pay.
 */
export function taxOffer(p: Progress, district: string, roll: number): { paid: number } | { fights: true } {
  const d = dealerIn(p, district);
  const street = p.heatIn(district).street;
  const pays = Math.min(0.85, 0.25 + d.soft * 0.35 + Math.min(0.2, p.save.level * 0.01) + street / 400);
  corners(p).taxed[district] = stretchOf(p.save.trips);
  p.addHeatOf(DEALER_HEAT, district);
  if (roll < pays) {
    const cut = Math.round(d.cash * 0.6);
    p.addCash(cut);
    return { paid: cut };
  }
  return { fights: true };
}

/** He's down: the corner's yours for a while. What he dropped is the World's to put on the floor. */
export function takeCorner(p: Progress, district: string): void {
  corners(p).until[district] = p.save.trips + CORNER_TRIPS;
  p.addHeatOf(DEALER_HEAT, district);
}

/** Your price multiplier in a district: less with a rival working it, more where the corner's yours. */
export function competition(p: Progress, district: string): number {
  if (cornerYours(p, district)) return CORNER_BONUS;
  return rivalIn(p, district) ? RIVAL_CUT : 1;
}

/** Anything he's carrying, for the screen. */
export function stockList(d: Dealer): { drug: Drug; n: number }[] {
  return DRUGS.filter((x) => d.stock[x] > 0).map((drug) => ({ drug, n: d.stock[drug] }));
}
