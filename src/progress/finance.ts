/**
 * Your money in and out on the big stuff: jewellery, property and rent. The
 * same pounds as everything else (the save's pocket and bank); this is only
 * the record of what moved, for the statements in the portfolio and the shop.
 */

export type FinanceKind = 'jewellery' | 'property' | 'rent' | 'fees';

export interface FinanceEntry {
  /** Play-time seconds when it happened. */
  t: number;
  kind: FinanceKind;
  what: string;
  /** Pounds: positive in, negative out. */
  amount: number;
}

export interface FinanceSave {
  ledger: FinanceEntry[];
  /** Running totals by kind, kept even after old lines drop off the ledger. */
  totals: Record<FinanceKind, { in: number; out: number }>;
}

export const LEDGER_LINES = 120;
const KINDS: FinanceKind[] = ['jewellery', 'property', 'rent', 'fees'];

export function defaultFinance(): FinanceSave {
  return { ledger: [], totals: { jewellery: { in: 0, out: 0 }, property: { in: 0, out: 0 }, rent: { in: 0, out: 0 }, fees: { in: 0, out: 0 } } };
}

export function record(f: FinanceSave, t: number, kind: FinanceKind, what: string, amount: number): void {
  const a = Math.round(amount);
  f.ledger.push({ t: Math.floor(t), kind, what: what.slice(0, 80), amount: a });
  if (f.ledger.length > LEDGER_LINES) f.ledger.splice(0, f.ledger.length - LEDGER_LINES);
  if (a >= 0) f.totals[kind].in += a;
  else f.totals[kind].out -= a;
}

export function sanitiseFinance(raw: unknown): FinanceSave {
  const out = defaultFinance();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<FinanceSave>;
  if (Array.isArray(r.ledger))
    out.ledger = r.ledger
      .filter((l) => l && typeof l.what === 'string' && Number.isFinite(l.amount) && Number.isFinite(l.t) && KINDS.includes(l.kind))
      .slice(-LEDGER_LINES)
      .map((l) => ({ t: Math.max(0, Math.floor(l.t)), kind: l.kind, what: l.what.slice(0, 80), amount: Math.round(l.amount) }));
  if (r.totals && typeof r.totals === 'object')
    for (const k of KINDS) {
      const v = (r.totals as Record<string, { in?: unknown; out?: unknown }>)[k];
      const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);
      if (v) out.totals[k] = { in: n(v.in), out: n(v.out) };
    }
  return out;
}
