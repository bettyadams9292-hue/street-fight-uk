/**
 * Cashpoints: the `atm` props on the streets (and in Pawn & Gold) are usable. Take cash out of CaliBank (the same
 * money as the tin at home, `save.cash.bank`) or pay what's on you in, so it's safe if you get battered.
 *
 * Paying in is free everywhere. Taking out is free on the High Street and in the clean districts; the machines on
 * rough streets charge a fee each time (`atmFee`), like the pay-to-use ones on a corner shop wall.
 *
 * Numbers and save state only (the screen is in Game, `openAtm`).
 */
import type { Progress } from '../progress/Progress';
import { CLEAN_DISTRICTS } from '../progress/cops';
import { record } from '../progress/finance';

/** Districts whose machines are free to take money out of; everywhere else charges `PAY_FEE`. */
const FREE: ReadonlySet<string> = new Set([...CLEAN_DISTRICTS, 'High Street']);
export const PAY_FEE = 2;
/** What the machine will hand out in one go (banks cap it). */
export const ATM_MAX = 500;
/** The amounts on the screen. */
export const WITHDRAW_STEPS = [20, 50, 100, 250, 500] as const;
export const DEPOSIT_STEPS = [20, 50, 100] as const;

export function atmFee(district: string): number {
  return FREE.has(district) ? 0 : PAY_FEE;
}

export type AtmResult = { ok: true; amount: number; fee: number } | { ok: false; reason: string };

/** Take `amount` out of the bank into your pocket, less nothing: the fee comes off the balance on top. */
export function withdraw(p: Progress, amount: number, district: string): AtmResult {
  const c = p.save.cash;
  const fee = atmFee(district);
  const n = Math.floor(amount);
  if (n <= 0) return { ok: false, reason: 'Pick an amount.' };
  if (n > ATM_MAX) return { ok: false, reason: `It won’t give out more than £${ATM_MAX} at once.` };
  if (c.bank < n + fee) return { ok: false, reason: fee ? `Insufficient funds: £${n} and the £${fee} fee.` : 'Insufficient funds.' };
  c.bank -= n + fee;
  c.pocket += n;
  if (fee) record(p.save.finance, p.save.playTime, 'fees', `Cashpoint fee, ${district}`, -fee);
  return { ok: true, amount: n, fee };
}

/** Pay cash in: up to `amount` of what's on you (Infinity for all of it). */
export function deposit(p: Progress, amount: number): AtmResult {
  const c = p.save.cash;
  const n = Math.min(Math.floor(amount), c.pocket);
  if (n <= 0) return { ok: false, reason: 'You’ve no cash on you.' };
  c.pocket -= n;
  c.bank += n;
  return { ok: true, amount: n, fee: 0 };
}
