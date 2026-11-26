/**
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
