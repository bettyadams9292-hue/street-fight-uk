/**
 * Cash machines: the `atm` props set into shop and bank walls. With your bank card they show your balance and pay
 * cash out of your account (`save.cash.bank`); they don't take deposits (that's a branch counter, money/banking.ts).
 *
 * No machine works until the second story boss (Sully) is down (`ATM_FLAG`), and there are only a handful in the
 * whole town (`ATM_SITES`). Each belongs to one of the two banks (`BANKS`, Califax or Lloyd's THC) by its prop's
 * `label`: your own bank's are free, the other's charge `OTHER_BANK_FEE`.
 *
 * Numbers and save state only (the machine's software is ui/atmUI.ts).
 */
import type { Progress } from '../progress/Progress';
import { CLEAN_DISTRICTS } from '../progress/cops';
import { record } from '../progress/finance';

/** Districts whose machines are free to take money out of; everywhere else charges `PAY_FEE`. */
const FREE: ReadonlySet<string> = new Set([...CLEAN_DISTRICTS, 'High Street']);
export const PAY_FEE = 2;
/** What another bank's machine charges a customer (money/banking.ts). */
export const OTHER_BANK_FEE = 2;
/** What the machine will hand out in one go (banks cap it). */
export const ATM_MAX = 500;
/** Machines dispense notes: withdrawals are whole multiples of this. */
export const NOTE = 10;
/** The amounts on the screens. */
export const WITHDRAW_STEPS = [10, 20, 50, 100, 200, 500] as const;
export const DEPOSIT_STEPS = [10, 20, 50, 100, 200] as const;

/** The cash machines open once the second story boss is beaten (Sully, after the Gaffer). */
export const ATM_FLAG = 'boss_sully';

export function atmOpen(p: Progress): boolean {
  return !!p.save.flags[ATM_FLAG];
}

// ---- the two banks ----------------------------------------------------------------------------------------------

export type BankId = 'califax' | 'lloyds';

export interface BankBrand {
  id: BankId;
  /** As written on the machine and the screens. */
  name: string;
  /** Wordmark on the screen header. */
  mark: string;
  /** Leeko's approved logo (public/art/banks/), drawn in place of the wordmark on the screens and the machine. */
  logo?: string;
  /** The same logo laid out for the lit header board over the machine (about 4.6 : 1). */
  fasciaArt?: string;
  /** Screen colours: background, panel, text, accent (buttons, loaders). */
  bg: string;
  panel: string;
  ink: string;
  accent: string;
  /** Header board on the machine's fascia: board, letters. */
  fascia: [string, string];
  welcome: string;
}

export const BANKS: Record<BankId, BankBrand> = {
  califax: {
    id: 'califax', name: 'Califax', mark: 'CALIFAX', logo: '/art/banks/califax.webp', fasciaArt: '/art/banks/califax-fascia.webp',
    // The logo's own navy, white letters.
    bg: '#01196e', panel: '#0a2c8f', ink: '#ffffff', accent: '#6fb1ff',
    fascia: ['#01196e', '#ffffff'], welcome: 'Welcome to Califax.',
  },
  lloyds: {
    id: 'lloyds', name: 'Lloyd’s THC', mark: 'LLOYD’S THC', logo: '/art/banks/lloyds.webp', fasciaArt: '/art/banks/lloyds-fascia.webp',
    // The logo's black, white and its green.
    bg: '#000000', panel: '#0d2410', ink: '#ffffff', accent: '#39ce07',
    fascia: ['#000000', '#ffffff'], welcome: 'Welcome to Lloyd’s THC.',
  },
};

/** Which bank a machine belongs to, from its prop's label (Califax unless it says otherwise). */
export function bankOf(label: string | undefined): BankBrand {
  return label === 'lloyds' ? BANKS.lloyds : BANKS.califax;
}

/**
 * Where the machines are: level id → bank. Four in the town, spread along the way the story opens it up (the High
 * Street first, the City Centre, Kingsway and the Riverside Centre later), all set into a commercial wall. The
 * generated towns and the estates have none. tests/streetLife.test.ts holds the list against the levels.
 */
export const ATM_SITES: Readonly<Record<string, BankId>> = {
  high_street: 'califax',
  city: 'lloyds',
  precinct: 'califax',
  mall: 'lloyds',
};

/**
 * What a withdrawal costs here. Your own bank's machines are always free; the other bank's charge
 * `OTHER_BANK_FEE`; with no bank chosen yet, free in town (`FREE`) and `PAY_FEE` elsewhere.
 */
export function atmFee(district: string, machine?: BankId, mine?: BankId): number {
  if (machine && mine) return machine === mine ? 0 : OTHER_BANK_FEE;
  return FREE.has(district) ? 0 : PAY_FEE;
}

export type AtmResult = { ok: true; amount: number; fee: number } | { ok: false; reason: string };

/** Take `amount` out of the bank into your pocket; the fee comes off the balance on top. */
export function withdraw(p: Progress, amount: number, district: string, machine?: BankId): AtmResult {
  const c = p.save.cash;
  if (!p.save.bank) return { ok: false, reason: 'Card not recognised. Open an account first (CaliStore, on your phone).' };
  const fee = atmFee(district, machine, p.save.bank);
  const n = Math.floor(amount);
  if (!Number.isFinite(amount) || n <= 0) return { ok: false, reason: 'Please enter an amount.' };
  if (n % NOTE) return { ok: false, reason: `This machine can only dispense multiples of £${NOTE}.` };
  if (n > ATM_MAX) return { ok: false, reason: `The maximum you can withdraw is £${ATM_MAX}.` };
  if (c.bank < n + fee) return { ok: false, reason: fee ? `Insufficient funds. This machine charges £${fee} per withdrawal.` : 'Insufficient funds.' };
  c.bank -= n + fee;
  c.pocket += n;
  record(p.save.finance, p.save.playTime, 'cash', `Cash withdrawal, ${district}`, -n);
  if (fee) record(p.save.finance, p.save.playTime, 'fees', machine && p.save.bank && machine !== p.save.bank ? `${BANKS[machine].name} machine fee` : `Cashpoint fee, ${district}`, -fee);
  return { ok: true, amount: n, fee };
}

/**
 * Pay cash in: up to `amount` of what's on you (Infinity for all of it). Cash machines don't take deposits: this is
 * the counter's (money/banking.ts `branchDeposit` checks it's your bank first).
 */
export function deposit(p: Progress, amount: number, district = ''): AtmResult {
  const c = p.save.cash;
  if (Number.isNaN(amount) || amount <= 0) return { ok: false, reason: 'Please enter an amount.' };
  if (Number.isFinite(amount) && Math.floor(amount) > c.pocket) return { ok: false, reason: 'You don’t have that much cash on you.' };
  const n = Math.min(Math.floor(amount), c.pocket);
  if (n <= 0) return { ok: false, reason: 'You have no cash to deposit.' };
  c.pocket -= n;
  c.bank += n;
  record(p.save.finance, p.save.playTime, 'cash', `Cash deposit${district ? `, ${district}` : ''}`, n);
  return { ok: true, amount: n, fee: 0 };
}
