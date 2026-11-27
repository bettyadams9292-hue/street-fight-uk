/**
 * Money, and where it can move (`save.cash`, `Progress.pay`):
 * - Cash on you (`pocket`) pays anywhere and is what gets mugged, dropped and seized.
 * - The biscuit tin (`tin`) is a stash in the house: nobody can touch it, and money goes in or out only while
 *   you're in the house (`Progress.toTin` / `fromTin`, the tin screen). It is the emergency fund: nothing ever pays from it.
 * - The bank account (`bank`): the phone's bank app only shows the balance. Cash goes in at your bank's branch
 *   counter (`branchDeposit`) and comes out there or at a cash machine (`branchWithdraw`, money/atm.ts
 *   `withdraw`). Your card spends it anywhere once your cash runs out. Rent, sales and the businesses pay into it
 *   (`Progress.credit`; into your pocket with no account yet).
 * Nothing moves between them any other way.
 *
 * Your bank (`save.bank`): Califax or Lloyd's THC, picked in the phone's CaliStore. The bank app on the phone is that
 * bank's own (its name, logo and colours) and its cash machines are free to use anywhere; the other bank's machines
 * charge `OTHER_BANK_FEE` a withdrawal (money/atm.ts `atmFee`). Same account either way: switching moves it across
 * for nothing. A save with no bank yet (a new game after its first lessons, or a save from before banks) is asked to
 * pick one (`Game.bankNudge`).
 */
import type { Progress } from '../progress/Progress';
import { record } from '../progress/finance';
import { BANKS, type BankBrand, type BankId } from './atm';

export { OTHER_BANK_FEE } from './atm';

/** What each bank says about itself in the store. */
export const BANK_PITCH: Record<BankId, { tagline: string; perks: string[] }> = {
  califax: {
    tagline: 'Banking for the High Street.',
    perks: ['Machines on the High Street and Kingsway', 'Free withdrawals at any Califax machine', 'Branch on the High Street'],
  },
  lloyds: {
    tagline: 'Grown in the City.',
    perks: ['Machines in the City Centre and the Riverside Centre', 'Free withdrawals at any Lloyd’s THC machine', 'Branch on Market Square'],
  },
};

/** Where each bank's branch is (its counter is at the branch door: World, station `bank_counter`). */
export const BRANCH_OF: Record<BankId, string> = { califax: 'High Street', lloyds: 'Market Square' };

/** A made-up, stable account number for the app and the counter. */
export function accountNumber(name: string, id: BankId): string {
  let h = id === 'califax' ? 7 : 13;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${String(10 + (h % 89)).padStart(2, '0')}-${String(h % 100).padStart(2, '0')}-${String(h % 100000000).padStart(8, '0').slice(-8)}`;
}

export type BranchResult = { ok: true; amount: number } | { ok: false; reason: string };

/** At the counter of `branch`'s bank: cash on you into your account. Your own bank's branch only. */
export function branchDeposit(p: Progress, amount: number, branch: BankId): BranchResult {
  const c = p.save.cash;
  if (p.save.bank !== branch) return { ok: false, reason: p.save.bank ? `You bank with ${BANKS[p.save.bank].name}.` : 'You haven’t got an account with us.' };
  const n = Math.min(Math.floor(amount), c.pocket);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: c.pocket <= 0 ? 'You’ve no cash on you to pay in.' : 'How much?' };
  c.pocket -= n;
  c.bank += n;
  record(p.save.finance, p.save.playTime, 'cash', `Paid in at ${BANKS[branch].name}, ${BRANCH_OF[branch]}`, n);
  return { ok: true, amount: n };
}

/** At the counter: your account into cash on you. Any amount, no fee. */
export function branchWithdraw(p: Progress, amount: number, branch: BankId): BranchResult {
  const c = p.save.cash;
  if (p.save.bank !== branch) return { ok: false, reason: p.save.bank ? `You bank with ${BANKS[p.save.bank].name}.` : 'You haven’t got an account with us.' };
  const n = Math.min(Math.floor(amount), c.bank);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, reason: c.bank <= 0 ? 'There’s nothing in your account.' : 'How much?' };
  c.bank -= n;
  c.pocket += n;
  record(p.save.finance, p.save.playTime, 'cash', `Withdrawn at ${BANKS[branch].name}, ${BRANCH_OF[branch]}`, -n);
  return { ok: true, amount: n };
}

/** One line for a shop's header: what you can pay with (never the tin, which only you move money in and out of). */
export function walletLine(p: Progress): string {
  const c = p.save.cash;
  const parts = [`£${c.pocket.toLocaleString('en-GB')} on you`];
  if (p.save.bank) parts.push(`£${c.bank.toLocaleString('en-GB')} on your card`);
  return parts.join(' · ');
}

/** How a payment is taken, in words (for "not enough" messages). */
export const PAY_ORDER = 'Cash on you first, then your card.';

export function myBank(p: Progress): BankBrand | null {
  const id = p.save.bank;
  return id ? BANKS[id] : null;
}

/** Open an account (or move it): the bank app becomes this bank's. Returns false if it's already yours. */
export function chooseBank(p: Progress, id: BankId): boolean {
  if (p.save.bank === id) return false;
  const was = p.save.bank;
  p.save.bank = id;
  record(p.save.finance, p.save.playTime, 'cash', was ? `Account moved to ${BANKS[id].name}` : `Account opened with ${BANKS[id].name}`, 0);
  return true;
}
