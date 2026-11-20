/**
 * Getting nicked properly (docs/POLICE_PLAN.md): you wake up in a cell at the Central Police Station with a
 * charge sheet. Bail is priced from what's on your record (`progress/record.ts`); pay it and walk out, or do
 * a night inside and pay a smaller court fine. Either way the stolen goods are gone and the charges are dealt
 * with.
 */
import { ITEMS } from '../items/items';
import type { Progress } from '../progress/Progress';
import {
  bailPrice,
  CELL_NIGHT_COOL,
  CELL_NIGHT_TRIPS,
  chargesFor,
  courtFine,
  type CrimeEntry,
} from '../progress/record';

export interface Booking {
  /** Where you were nicked: the charges and the police heat that's wiped are this district's. */
  district: string;
  charges: CrimeEntry[];
  /** Stolen goods seized, and what they were worth. */
  seized: number;
  seizedValue: number;
  bail: number;
  /** What a night in the cells costs instead. */
  fine: number;
}

/** What the stolen things you're carrying, wearing or holding are worth. */
export function stolenValue(p: Progress): number {
  const s = p.save;
  let v = 0;
  for (const st of s.inventory) if (st.stolen) v += (ITEMS[st.id]?.value ?? 0) * st.qty;
  for (const st of Object.values(s.worn)) if (st?.stolen) v += ITEMS[st.id]?.value ?? 0;
  if (s.held?.stolen) v += ITEMS[s.held.id]?.value ?? 0;
  return v;
}

/** Booked in: stolen goods seized, the charges read out, bail set. Counts as an arrest. */
export function book(p: Progress): Booking {
  const district = p.here ?? 'City Centre';
  const seizedValue = stolenValue(p);
  const seized = p.confiscateStolen();
  const charges = chargesFor(p.save.record, district);
  const bail = bailPrice(charges, p.save.stats.arrests, seizedValue, p.save.level);
  p.save.stats.arrests++;
  return { district, charges, seized, seizedValue, bail, fine: courtFine(bail) };
}

/** Can you pay bail from what's on you and in the tin? */
export function canPayBail(p: Progress, b: Booking): boolean {
  return p.save.cash.pocket + p.save.cash.bank >= b.bail;
}

/** The charges on the sheet are dealt with, and the district's police have had their man. */
function settle(p: Progress, b: Booking): void {
  p.save.record = p.save.record.filter((e) => !b.charges.includes(e));
  p.setHeat('police', 0, b.district);
  if (b.district === p.here) p.save.heat = 0;
}

/** Pay bail and walk out. False (nothing taken) if you can't cover it. */
export function payBail(p: Progress, b: Booking): boolean {
  if (!p.pay(b.bail)) return false;
  settle(p, b);
  return true;
}

/**
 * A night in the cells: time passes, the police cool off everywhere, and in the morning the court takes its
 * fine from whatever you've got. Returns what was taken.
 */
export function nightInCells(p: Progress, b: Booking): number {
  for (let i = 0; i < CELL_NIGHT_TRIPS; i++) p.tick();
  const have = p.save.cash.pocket + p.save.cash.bank;
  const taken = Math.min(have, b.fine);
  p.pay(taken);
  for (const d of Object.keys(p.save.districtHeat)) if (d !== b.district) p.setHeat('police', Math.max(0, p.heatIn(d).police - CELL_NIGHT_COOL), d);
  settle(p, b);
  return taken;
}
