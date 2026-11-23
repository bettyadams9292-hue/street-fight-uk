/**
 * Dealing: buy in bulk, break it down and bag it up in the garage, and sell it on the street.
 *
 * Opens halfway through the story (after the Ratcatcher, `DEALING_FLAG`): Kez has a connect and starts selling
 * wholesale. Three products: weed (bought, or brought up from your own grow in the basement), cocaine and pills.
 *
 * - Bulk is bought off Kez (`buyBulk`) into your pockets, and carried home.
 * - The prep table in the garage (`TABLES`, bought once and upgraded) takes bulk in (`loadBulk`), and works through
 *   it on the play clock (`tickPrep`), a batch at a time, using a bag per deal (`buyBags`). Deals wait on the table
 *   till you take them (`takeDeals`).
 * - Your grow's stock comes up from the basement as bulk weed (`fromGrow`), worth far more bagged than sold by the
 *   unit.
 * - Punters on the street buy deals (World): the price is the product's street price, times the district, less for
 *   every sale you've made there this trip (`streetPrice`). Every sale is police heat; now and then a punter is
 *   plain clothes (`undercoverChance`).
 *
 * Numbers and save state only.
 */
import type { Progress, PurchaseResult } from '../progress/Progress';

export type Drug = 'weed' | 'coke' | 'pills';
export const DRUGS: Drug[] = ['weed', 'coke', 'pills'];

/** The story beat that opens it (and Kez's wholesale). */
export const DEALING_FLAG = 'boss_ratcatcher';

export interface DrugDef {
  id: Drug;
  name: string;
  /** One bulk lot, and the deals it makes. */
  bulkName: string;
  dealName: string;
  /** More than one: "bags of weed". */
  dealPlural: string;
  /** Item ids (items.ts). */
  bulkItem: string;
  dealItem: string;
  /** What Kez wants for a bulk lot, and what he'll give you back for one. */
  bulkPrice: number;
  /** Deals in one bulk lot. */
  deals: number;
  /** Street price of one deal, before the district and how much you've sold there. */
  street: number;
  /** Seconds of play to bag up one bulk lot on a basic table. */
  seconds: number;
  /** How much more it fetches further east (per strip step past the estate). */
  eastward: number;
}

export const DRUG_DEFS: Record<Drug, DrugDef> = {
  weed: { id: 'weed', name: 'Weed', bulkName: 'Bulk bag of weed', dealName: 'Bag of weed', dealPlural: 'bags of weed', bulkItem: 'bulk_weed', dealItem: 'deal_weed', bulkPrice: 220, deals: 20, street: 18, seconds: 60, eastward: 0.01 },
  coke: { id: 'coke', name: 'Cocaine', bulkName: 'Block of cocaine', dealName: 'Wrap of cocaine', dealPlural: 'wraps of cocaine', bulkItem: 'bulk_coke', dealItem: 'deal_coke', bulkPrice: 1100, deals: 28, street: 55, seconds: 120, eastward: 0.05 },
  pills: { id: 'pills', name: 'Pills', bulkName: 'Bag of pills', dealName: 'Pill', dealPlural: 'pills', bulkItem: 'bulk_pills', dealItem: 'deal_pills', bulkPrice: 350, deals: 50, street: 10, seconds: 45, eastward: 0.03 },
};

/** Kez buys bulk back at this share of what he sells it for. */
export const BULK_BUYBACK = 0.7;
/** Grow units to one bulk bag of weed (the grow sells them at about £14 each). */
export const GROW_PER_BULK = 10;
/** Deal bags: a pack, and what it costs. */
export const BAG_PACK = 100;
export const BAG_PACK_PRICE = 15;

/** The prep table and its upgrades: what each costs, how fast it works, and how many batches at once. */
export const TABLES = [
  { tier: 1, name: 'Prep table', price: 1500, speed: 1, batches: 1, text: 'A table, a lamp and a pair of gloves. One batch at a time.' },
  { tier: 2, name: 'Digital scales', price: 2500, speed: 1.6, batches: 1, text: 'Weighs it out quick: batches go 60% faster.' },
  { tier: 3, name: 'Second table', price: 6000, speed: 1.6, batches: 2, text: 'Room for two batches at once.' },
] as const;

export interface Batch {
  drug: Drug;
  /** Seconds left. */
  left: number;
  total: number;
}

export interface DealingSave {
  /** Prep table tier: 0 none yet. */
  table: number;
  /** Bulk waiting on the table, and deals bagged and waiting. */
  bulk: Record<Drug, number>;
  deals: Record<Drug, number>;
  /** Empty deal bags on the table. */
  bags: number;
  /** Batches being bagged up now. */
  batches: Batch[];
  lastTick: number;
  /** Deals sold, all time. */
  sold: Record<Drug, number>;
  earned: number;
  /** Sales in a district this trip: the price drops the more you sell in one place. */
  local: { trip: number; n: Record<string, number> };
  /** Kez has told you about it. */
  told: boolean;
}

const zero = (): Record<Drug, number> => ({ weed: 0, coke: 0, pills: 0 });

export function newDealing(): DealingSave {
  return { table: 0, bulk: zero(), deals: zero(), bags: 0, batches: [], lastTick: 0, sold: zero(), earned: 0, local: { trip: -1, n: {} }, told: false };
}

const num = (v: unknown, d = 0, lo = 0, hi = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const rec = (v: unknown): Record<Drug, number> => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { weed: Math.floor(num(o.weed)), coke: Math.floor(num(o.coke)), pills: Math.floor(num(o.pills)) };
};

export function sanitiseDealing(r: unknown): DealingSave {
  const out = newDealing();
  if (!r || typeof r !== 'object') return out;
  const x = r as Partial<DealingSave>;
  out.table = Math.floor(num(x.table, 0, 0, TABLES.length));
  out.bulk = rec(x.bulk);
  out.deals = rec(x.deals);
  out.bags = Math.floor(num(x.bags));
  out.batches = Array.isArray(x.batches)
    ? x.batches.filter((b): b is Batch => !!b && DRUGS.includes(b.drug as Drug)).slice(0, 2).map((b) => ({ drug: b.drug, left: num(b.left, 0, 0, 3600), total: num(b.total, 60, 1, 3600) }))
    : [];
  out.lastTick = num(x.lastTick);
  out.sold = rec(x.sold);
  out.earned = Math.floor(num(x.earned));
  if (x.local && typeof x.local === 'object') out.local = { trip: Math.floor(num(x.local.trip, -1, -1)), n: Object.fromEntries(Object.entries(x.local.n ?? {}).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, Math.floor(num(v))])) };
  out.told = x.told === true;
  return out;
}

export function dealingOpen(p: Progress): boolean {
  return p.has(DEALING_FLAG);
}

export function tableDef(tier: number): (typeof TABLES)[number] | null {
  return TABLES[tier - 1] ?? null;
}

const pay = (p: Progress, n: number) => p.pay(n);

/** Take `n` of an item out of your pockets (from any of its stacks). False if you haven't got that many. */
export function takeFromPockets(p: Progress, id: string, n = 1): boolean {
  const inv = p.save.inventory;
  if (inv.filter((x) => x.id === id).reduce((a, x) => a + x.qty, 0) < n) return false;
  let left = n;
  for (const st of inv.filter((x) => x.id === id)) {
    const k = Math.min(left, st.qty);
    st.qty -= k;
    left -= k;
    if (!left) break;
  }
  p.save.inventory = inv.filter((x) => x.qty > 0);
  return true;
}
const STOLEN = { stolen: true };

// ---- Kez's wholesale -------------------------------------------------------------------------------------------

/** Buy bulk off Kez: into your pockets, as contraband (the police take it if they nick you). */
export function buyBulk(p: Progress, drug: Drug, n = 1): PurchaseResult {
  if (!dealingOpen(p)) return { ok: false, reason: 'Kez isn’t selling that to you. Yet.' };
  const d = DRUG_DEFS[drug];
  if (p.spaceFor(d.bulkItem, STOLEN) < n) return { ok: false, reason: 'No room in your pockets.' };
  if (!pay(p, d.bulkPrice * n)) return { ok: false, reason: `That’s £${d.bulkPrice * n}. You haven’t got it.` };
  p.giveItem(d.bulkItem, n, { stolen: true });
  return { ok: true };
}

/** Sell a bulk lot back to Kez, at a loss. */
export function sellBulk(p: Progress, drug: Drug): { ok: true; price: number } | { ok: false; reason: string } {
  const d = DRUG_DEFS[drug];
  if (!takeFromPockets(p, d.bulkItem, 1)) return { ok: false, reason: `You haven’t got a ${d.bulkName.toLowerCase()} on you.` };
  const price = Math.round(d.bulkPrice * BULK_BUYBACK);
  p.addCash(price);
  return { ok: true, price };
}

// ---- the prep table --------------------------------------------------------------------------------------------

export function buyTable(p: Progress): PurchaseResult {
  const s = p.save.dealing;
  const next = tableDef(s.table + 1);
  if (!dealingOpen(p)) return { ok: false, reason: 'Not yet.' };
  if (!next) return { ok: false, reason: 'Nothing more to add.' };
  if (!pay(p, next.price)) return { ok: false, reason: `That’s £${next.price}. You haven’t got it.` };
  s.table = next.tier;
  if (next.tier === 1) s.lastTick = p.save.playTime;
  return { ok: true };
}

export function buyBags(p: Progress, packs = 1): PurchaseResult {
  if (!pay(p, BAG_PACK_PRICE * packs)) return { ok: false, reason: `£${BAG_PACK_PRICE * packs} for ${BAG_PACK * packs} bags. You haven’t got it.` };
  p.save.dealing.bags += BAG_PACK * packs;
  return { ok: true };
}

/** Put the bulk you're carrying on the table. */
export function loadBulk(p: Progress): Record<Drug, number> {
  const s = p.save.dealing;
  const put = zero();
  for (const drug of DRUGS) {
    const id = DRUG_DEFS[drug].bulkItem;
    let n = 0;
    while (takeFromPockets(p, id, 1)) n++;
    s.bulk[drug] += n;
    put[drug] = n;
  }
  return put;
}

/** Bring up the grow's stock from the basement as bulk weed (whole bags only; the rest stays put). */
export function fromGrow(p: Progress): number {
  const b = p.save.basement.business;
  const bags = Math.floor(b.stock / GROW_PER_BULK);
  if (bags <= 0) return 0;
  b.stock -= bags * GROW_PER_BULK;
  p.save.dealing.bulk.weed += bags;
  return bags;
}

/** Seconds a batch of this takes on the table you've got. */
export function batchSeconds(drug: Drug, tier: number): number {
  return Math.round(DRUG_DEFS[drug].seconds / (tableDef(tier)?.speed ?? 1));
}

/** Start whatever can start: bulk waiting, a free place on the table, and enough bags for the whole batch. */
function startBatches(s: DealingSave): void {
  const t = tableDef(s.table);
  if (!t) return;
  for (const drug of DRUGS) {
    while (s.batches.length < t.batches && s.bulk[drug] > 0 && s.bags >= DRUG_DEFS[drug].deals) {
      s.bulk[drug]--;
      s.bags -= DRUG_DEFS[drug].deals;
      const sec = batchSeconds(drug, s.table);
      s.batches.push({ drug, left: sec, total: sec });
    }
  }
}

/**
 * Bring the table up to `now` (play seconds): batches finish into deals and the next ones start. Safe to call any
 * time. Returns the deals bagged.
 */
export function tickPrep(p: Progress): Record<Drug, number> {
  const s = p.save.dealing;
  const done = zero();
  const now = p.save.playTime;
  let dt = Math.max(0, Math.min(3600, now - s.lastTick));
  s.lastTick = Math.max(s.lastTick, now);
  startBatches(s);
  while (dt > 0 && s.batches.length) {
    const step = Math.min(dt, ...s.batches.map((b) => b.left));
    for (const b of s.batches) b.left -= step;
    dt -= step;
    for (const b of s.batches.filter((x) => x.left <= 1e-6)) {
      s.deals[b.drug] += DRUG_DEFS[b.drug].deals;
      done[b.drug] += DRUG_DEFS[b.drug].deals;
    }
    s.batches = s.batches.filter((x) => x.left > 1e-6);
    startBatches(s);
  }
  return done;
}

/** Take bagged deals off the table into your pockets (as many as fit). */
export function takeDeals(p: Progress, drug: Drug): number {
  const s = p.save.dealing;
  const id = DRUG_DEFS[drug].dealItem;
  const n = Math.min(s.deals[drug], p.spaceFor(id, STOLEN));
  if (n <= 0) return 0;
  p.giveItem(id, n, { stolen: true });
  s.deals[drug] -= n;
  return n;
}

// ---- the street ------------------------------------------------------------------------------------------------

/** Each sale in a district this trip knocks this much off the next there (down to `FLOOR`). */
export const SATURATE = 0.04;
export const FLOOR = 0.6;

/** One deal's price on this street now: by product, how far east, and how many you've sold here this trip. */
export function streetPrice(p: Progress, drug: Drug, district: string, east: number): number {
  const s = p.save.dealing;
  const n = s.local.trip === p.save.trips ? s.local.n[district] ?? 0 : 0;
  const d = DRUG_DEFS[drug];
  const m = Math.max(FLOOR, 1 - SATURATE * n) * (1 + d.eastward * Math.max(0, east));
  return Math.max(1, Math.round(d.street * m));
}

/** Chance a punter is plain clothes: more where police heat is up. */
export function undercoverChance(police: number): number {
  return Math.min(0.2, 0.03 + police / 400);
}

/** Heat for one sale, where it happens. */
export const SALE_HEAT = { police: 3, street: 1 } as const;

/** A sale made: the money, the count, the district's market a little softer. */
export function recordSale(p: Progress, drug: Drug, n: number, price: number, district: string): void {
  const s = p.save.dealing;
  if (s.local.trip !== p.save.trips) s.local = { trip: p.save.trips, n: {} };
  s.local.n[district] = (s.local.n[district] ?? 0) + n;
  s.sold[drug] += n;
  s.earned += price;
}

/** Deals of each kind on you. */
export function dealsOnYou(p: Progress): Record<Drug, number> {
  const out = zero();
  for (const st of p.save.inventory) for (const drug of DRUGS) if (st.id === DRUG_DEFS[drug].dealItem) out[drug] += st.qty;
  return out;
}

/** What a bulk lot makes bagged up and sold at the base price, less its bags: for the screens. */
export function bulkWorth(drug: Drug): number {
  const d = DRUG_DEFS[drug];
  return d.deals * d.street - Math.ceil((d.deals * BAG_PACK_PRICE) / BAG_PACK);
}
