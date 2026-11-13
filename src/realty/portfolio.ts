/**
 * Your property empire: what you own, who lives there, and what it pays.
 *
 * Everything runs on the save's play-time clock, a letting month at a time
 * (MONTH seconds of actual play). Rent lands in the letting account at the end
 * of each month a tenant is in; you collect it into the bank from the
 * portfolio. Nothing is paid for time you weren't playing, reloading can't pay
 * twice, and tenant comings and goings are rolled from fixed seeds so a reload
 * doesn't re-roll them.
 */
import type { GameSave, Progress, PurchaseResult } from '../progress/Progress';
import { record } from '../progress/finance';
import { MONTH, PROPERTIES, RENT_STEPS, hash01, marketRent, monthAt, saleOffer, valueNow, type PropertyDef } from './catalogue';

export type Use = 'personal' | 'let';

export interface Tenant {
  name: string;
  /** "Young couple", "Two students", "Family of four"... */
  who: string;
  /** Letting month they moved in. */
  since: number;
}

export interface RentEvent {
  /** Letting month. */
  m: number;
  kind: 'bought' | 'listed' | 'unlisted' | 'moved_in' | 'moved_out' | 'paid' | 'notice' | 'rent_changed';
  text: string;
  amount?: number;
}

export interface Holding {
  id: string;
  /** What you paid. */
  paid: number;
  /** Play time when bought. */
  boughtAt: number;
  use: Use;
  /** Index into RENT_STEPS: what you're asking. */
  rentStep: number;
  tenant: Tenant | null;
  /** Rent waiting to be collected. */
  owed: number;
  /** All rent ever received for this place. */
  earned: number;
  /** Last letting month that's been settled. */
  settled: number;
  /** You've asked the tenants to leave so you can move in: they go at the end of the month. */
  notice: boolean;
  history: RentEvent[];
}

export interface PortfolioSave {
  holdings: Holding[];
  /** Which property you're standing in, if any (the interior is built from it). */
  inside: string | null;
}

export const HISTORY_LINES = 18;

export function defaultPortfolio(): PortfolioSave {
  return { holdings: [], inside: null };
}

const finite = (v: unknown, d: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d);

export function sanitisePortfolio(raw: unknown, playTime: number): PortfolioSave {
  const out = defaultPortfolio();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<PortfolioSave>;
  const now = monthAt(playTime);
  const seen = new Set<string>();
  if (Array.isArray(r.holdings))
    for (const h of r.holdings) {
      if (!h || typeof h.id !== 'string' || !PROPERTIES[h.id] || seen.has(h.id)) continue;
      seen.add(h.id);
      const d = PROPERTIES[h.id];
      const t = h.tenant;
      const tenant: Tenant | null =
        t && typeof t.name === 'string' && typeof t.who === 'string' ? { name: t.name.slice(0, 40), who: t.who.slice(0, 40), since: Math.floor(finite(t.since, now)) } : null;
      const use: Use = h.use === 'let' ? 'let' : 'personal';
      out.holdings.push({
        id: h.id,
        paid: Math.round(finite(h.paid, d.price)),
        boughtAt: finite(h.boughtAt, 0),
        use,
        rentStep: Math.min(RENT_STEPS.length - 1, Math.max(0, Math.floor(finite(h.rentStep, 2)))),
        tenant: use === 'let' ? tenant : null,
        owed: Math.round(finite(h.owed, 0)),
        earned: Math.round(finite(h.earned, 0)),
        // Never ahead of the clock (a save from the future can't skip months), never pay for time before it was bought.
        settled: Math.min(now, Math.floor(finite(h.settled, now))),
        notice: h.notice === true && use === 'let' && !!tenant,
        history: Array.isArray(h.history)
          ? h.history
              .filter((e) => e && typeof e.text === 'string' && Number.isFinite(e.m))
              .slice(-HISTORY_LINES)
              .map((e) => ({ m: Math.floor(e.m), kind: e.kind, text: e.text.slice(0, 90), amount: typeof e.amount === 'number' && Number.isFinite(e.amount) ? Math.round(e.amount) : undefined }))
          : [],
      });
    }
  out.inside = typeof r.inside === 'string' && PROPERTIES[r.inside] ? r.inside : null;
  return out;
}

export function holding(save: GameSave, id: string): Holding | undefined {
  return save.portfolio.holdings.find((h) => h.id === id);
}

export function owns(save: GameSave, id: string): boolean {
  return !!holding(save, id);
}

function log(h: Holding, e: RentEvent): void {
  h.history.push(e);
  if (h.history.length > HISTORY_LINES) h.history.splice(0, h.history.length - HISTORY_LINES);
}

/** The rent asked for a place, per month. */
export function askingRent(d: PropertyDef, h: Pick<Holding, 'rentStep'>, playTime: number): number {
  return Math.round((marketRent(d, playTime) * RENT_STEPS[h.rentStep]) / 5) * 5;
}

const fail = (reason: string): PurchaseResult => ({ ok: false, reason });

/** Buy a place at today's asking price. */
export function buyProperty(p: Progress, id: string): PurchaseResult {
  const d = PROPERTIES[id];
  if (!d) return fail('That’s not on the market.');
  const s = p.save;
  if (owns(s, id)) return fail('You already own it.');
  const price = valueNow(d, s.playTime);
  const have = s.cash.pocket + s.cash.bank;
  if (have < price) return fail(`Not enough money. It’s ${fmt(price)} and you’ve got ${fmt(have)}: you’re ${fmt(price - have)} short.`);
  p.pay(price);
  const m = monthAt(s.playTime);
  const h: Holding = { id, paid: price, boughtAt: s.playTime, use: 'personal', rentStep: 2, tenant: null, owed: 0, earned: 0, settled: m, notice: false, history: [] };
  log(h, { m, kind: 'bought', text: `Bought for ${fmt(price)}`, amount: -price });
  s.portfolio.holdings.push(h);
  record(s.finance, s.playTime, 'property', `Bought ${d.name}`, -price);
  return { ok: true };
}

/** Sell at today's value less the agent's fee. Any rent still owed is paid out with it, and the tenants' lease goes with the sale. */
export function sellProperty(p: Progress, id: string): { ok: true; net: number; profit: number; rent: number } | { ok: false; reason: string } {
  const s = p.save;
  const h = holding(s, id);
  const d = PROPERTIES[id];
  if (!h || !d) return { ok: false, reason: 'You don’t own that.' };
  settle(s, s.playTime);
  const offer = saleOffer(d, s.playTime);
  const rent = h.owed;
  s.portfolio.holdings = s.portfolio.holdings.filter((x) => x.id !== id);
  if (s.portfolio.inside === id) s.portfolio.inside = null;
  s.cash.bank += offer.net + rent;
  record(s.finance, s.playTime, 'property', `Sold ${d.name}`, offer.gross);
  record(s.finance, s.playTime, 'fees', `Agent’s fee on ${d.name}`, -offer.fee);
  if (rent > 0) record(s.finance, s.playTime, 'rent', `Rent collected on sale of ${d.name}`, rent);
  return { ok: true, net: offer.net, profit: offer.net - h.paid, rent };
}

/** Put it on the rental market (it stays empty until a tenant's found, usually within a month or two). */
export function listForRent(p: Progress, id: string, step = 2): PurchaseResult {
  const s = p.save;
  const h = holding(s, id);
  if (!h) return fail('You don’t own that.');
  if (s.portfolio.inside === id) return fail('Step outside first: you can’t let it while you’re in it.');
  const m = monthAt(s.playTime);
  settle(s, s.playTime);
  h.use = 'let';
  h.notice = false;
  h.rentStep = Math.max(0, Math.min(RENT_STEPS.length - 1, step));
  h.settled = m;
  log(h, { m, kind: 'listed', text: `Listed to let at ${fmt(askingRent(PROPERTIES[id], h, s.playTime))} a month` });
  return { ok: true };
}

export function setRent(p: Progress, id: string, step: number): PurchaseResult {
  const s = p.save;
  const h = holding(s, id);
  if (!h) return fail('You don’t own that.');
  if (h.use !== 'let') return fail('It’s not on the rental market.');
  const next = Math.max(0, Math.min(RENT_STEPS.length - 1, Math.floor(step)));
  if (next === h.rentStep) return { ok: true };
  h.rentStep = next;
  log(h, { m: monthAt(s.playTime), kind: 'rent_changed', text: `Rent set to ${fmt(askingRent(PROPERTIES[id], h, s.playTime))} a month` });
  return { ok: true };
}

/**
 * Take it off the rental market. Empty: straight away, it's yours to use. Tenants in: they get notice and go
 * at the end of the month (rent's still paid for the month they're in).
 */
export function unlist(p: Progress, id: string): PurchaseResult & { notice?: boolean } {
  const s = p.save;
  const h = holding(s, id);
  if (!h) return fail('You don’t own that.');
  if (h.use !== 'let') return fail('It’s not let.');
  settle(s, s.playTime);
  const m = monthAt(s.playTime);
  if (h.tenant) {
    h.notice = true;
    log(h, { m, kind: 'notice', text: `${h.tenant.name} given notice` });
    return { ok: true, notice: true };
  }
  h.use = 'personal';
  log(h, { m, kind: 'unlisted', text: 'Taken off the rental market' });
  return { ok: true };
}

/** Collect the rent that's built up on one place, or on all of them, into the bank. */
export function collectRent(p: Progress, id?: string): number {
  const s = p.save;
  settle(s, s.playTime);
  let total = 0;
  for (const h of s.portfolio.holdings) {
    if (id && h.id !== id) continue;
    if (h.owed <= 0) continue;
    total += h.owed;
    record(s.finance, s.playTime, 'rent', `Rent from ${PROPERTIES[h.id].name}`, h.owed);
    h.owed = 0;
  }
  s.cash.bank += total;
  return total;
}

/** Who might move in, by kind of home. */
const HOUSEHOLDS: Record<PropertyDef['cat'], string[]> = {
  flat: ['Young professional', 'Two students', 'Young couple', 'Nurse on nights', 'Retired widower', 'Apprentice electrician'],
  house: ['Young family', 'Family of four', 'Couple with a dog', 'Three sharers', 'Teacher and son', 'Newlyweds'],
  apartment: ['City banker', 'Couple, both doctors', 'Footballer on loan', 'Tech start-up founder', 'Corporate let', 'Barrister'],
  mansion: ['Premier League striker', 'Film producer', 'Overseas family office', 'Rock star (retired)', 'Hedge fund manager', 'Royal cousin, allegedly'],
};
const SURNAMES = ['Okafor', 'Whitfield', 'Patel', 'Kowalski', 'Doyle', 'Ahmed', 'Hughes', 'McAllister', 'Nguyen', 'Brennan', 'Osei', 'Fairweather', 'Khan', 'Lindqvist', 'Ashworth', 'Mensah', 'O’Hara', 'Barker'];
const FIRST = ['Jade', 'Tom', 'Priya', 'Marek', 'Siobhan', 'Bilal', 'Chloe', 'Dev', 'Ellie', 'Kwame', 'Rhys', 'Aisha', 'Callum', 'Nadia', 'Owen', 'Femi'];

function tenantFor(d: PropertyDef, m: number): Tenant {
  const pick = <T>(list: T[], salt: string) => list[Math.floor(hash01(`${d.id}:${m}:${salt}`) * list.length)];
  const who = pick(HOUSEHOLDS[d.cat], 'who');
  const family = /family|couple|newlyweds|son|both/i.test(who);
  const name = family ? `The ${pick(SURNAMES, 'sur')}s` : `${pick(FIRST, 'first')} ${pick(SURNAMES, 'sur')}`;
  return { name, who, since: m };
}

/** Chance a tenant moves in this month, from how the rent compares with the going rate. */
export function findChance(step: number): number {
  const ratio = RENT_STEPS[step];
  return Math.max(0.08, Math.min(0.92, 0.6 + (1 - ratio) * 1.1));
}
/** Chance a tenant leaves at the end of a month. */
export function leaveChance(step: number, months: number): number {
  const ratio = RENT_STEPS[step];
  // Settled tenants stay longer; overcharged ones don't.
  return Math.max(0.02, Math.min(0.5, 0.07 + Math.max(0, ratio - 1) * 0.6 - Math.min(0.04, months * 0.004)));
}

export interface PortfolioNews {
  text: string;
  kind: 'in' | 'out' | 'paid';
}

/**
 * Bring every let property up to date with the clock: pay rent for each month a tenant was in, roll who moves
 * in and out. Months are settled one at a time from fixed seeds, so it gives the same answer however often it's called.
 */
export function settle(save: GameSave, playTime: number): PortfolioNews[] {
  const now = monthAt(playTime);
  const news: PortfolioNews[] = [];
  for (const h of save.portfolio.holdings) {
    const d = PROPERTIES[h.id];
    if (h.use !== 'let') {
      h.settled = now;
      continue;
    }
    while (h.settled < now) {
      const m = ++h.settled;
      // Rent is fixed for a month by the price that month.
      const rent = askingRent(d, h, m * MONTH);
      if (h.tenant) {
        h.owed += rent;
        h.earned += rent;
        log(h, { m, kind: 'paid', text: `${h.tenant.name} paid ${fmt(rent)}`, amount: rent });
        const stayed = m - h.tenant.since;
        if (h.notice) {
          log(h, { m, kind: 'moved_out', text: `${h.tenant.name} moved out (notice served). It’s yours to use.` });
          news.push({ text: `${h.tenant.name} moved out of ${d.name}. It’s free for you now.`, kind: 'out' });
          h.tenant = null;
          h.notice = false;
          h.use = 'personal';
          h.settled = now;
          break;
        }
        if (hash01(`${h.id}:${m}:leave`) < leaveChance(h.rentStep, stayed)) {
          log(h, { m, kind: 'moved_out', text: `${h.tenant.name} moved out` });
          news.push({ text: `${h.tenant.name} moved out of ${d.name}. It’s empty and back on the market.`, kind: 'out' });
          h.tenant = null;
        }
      } else if (hash01(`${h.id}:${m}:find`) < findChance(h.rentStep)) {
        h.tenant = tenantFor(d, m);
        log(h, { m, kind: 'moved_in', text: `${h.tenant.name} (${h.tenant.who.toLowerCase()}) moved in` });
        news.push({ text: `New tenants in ${d.name}: ${h.tenant.name}.`, kind: 'in' });
      }
    }
  }
  return news;
}

/** Can you walk in? Viewings are open for places on the market; tenants' homes are theirs. */
export function access(save: GameSave, id: string): { ok: true; as: 'viewing' | 'owner' } | { ok: false; reason: string } {
  const h = holding(save, id);
  if (!h) return { ok: true, as: 'viewing' };
  if (h.use === 'let' && h.tenant) return { ok: false, reason: `${h.tenant.name} live${h.tenant.name.startsWith('The ') ? '' : 's'} here: it’s let. Manage it from the portfolio.` };
  return { ok: true, as: 'owner' };
}

export interface PortfolioTotals {
  owned: number;
  value: number;
  invested: number;
  /** Rent received, ever, across what you own now. */
  rentEarned: number;
  /** Rent waiting to collect. */
  owed: number;
  /** Rent per month from places with tenants in. */
  monthly: number;
  let: number;
  vacant: number;
  personal: number;
  /** What you'd clear selling everything today. */
  saleValue: number;
  /** Paper gain on what you own plus rent received. */
  profit: number;
}

export function totals(save: GameSave): PortfolioTotals {
  const t = save.playTime;
  const out: PortfolioTotals = { owned: 0, value: 0, invested: 0, rentEarned: 0, owed: 0, monthly: 0, let: 0, vacant: 0, personal: 0, saleValue: 0, profit: 0 };
  for (const h of save.portfolio.holdings) {
    const d = PROPERTIES[h.id];
    out.owned++;
    out.value += valueNow(d, t);
    out.invested += h.paid;
    out.rentEarned += h.earned;
    out.owed += h.owed;
    out.saleValue += saleOffer(d, t).net;
    if (h.use === 'personal') out.personal++;
    else if (h.tenant) {
      out.let++;
      out.monthly += askingRent(d, h, t);
    } else out.vacant++;
  }
  out.profit = out.saleValue - out.invested + out.rentEarned;
  return out;
}

export function statusOf(h: Holding): 'personal' | 'let' | 'vacant' | 'notice' {
  if (h.use === 'personal') return 'personal';
  if (!h.tenant) return 'vacant';
  return h.notice ? 'notice' : 'let';
}

/** Seconds of play until the next rent day. */
export function untilRentDay(playTime: number): number {
  return MONTH - (playTime % MONTH);
}

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}
