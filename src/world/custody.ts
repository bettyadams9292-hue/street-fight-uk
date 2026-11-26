/**
 * Getting nicked properly (docs/POLICE_PLAN.md): you wake up in a cell at the Kirkgate Constabulary with a
 * charge sheet. Bail is priced from what's on your record (`progress/record.ts`); pay it and walk out, or do
 * a night inside and pay a smaller court fine. Either way the stolen goods are gone and the charges are dealt
 * with.
 */
import { ITEMS } from '../items/items';
import { addStack, type ItemStack } from '../items/Inventory';
import { COMPANIONS } from '../companions/companions';
import {
  BENT_SARGE,
  CAUGHT_CHANCE,
  CAUGHT_HEAT,
  coolPrice,
  gearBackPrice,
  owedFor,
  paperworkPrice,
  sargeOnDuty,
  STRAIGHT_SARGE,
} from '../progress/cops';
import type { Progress } from '../progress/Progress';
import { LEVELS } from './levels';
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
  /** Who's on the custody desk: Kerrigan (bent) loses the paperwork for `paperwork`. */
  sarge: string;
  bent: boolean;
  paperwork: number;
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
  const taken = p.takeStolen();
  const seized = taken.reduce((n, x) => n + x.qty, 0);
  // Into the property store: this time's haul replaces the last (that's long gone to auction).
  if (taken.length) p.save.police.seized = taken;
  // They take your phone at the desk: no cabs and no maps till you walk out of the station.
  p.save.police.custody = true;
  const charges = chargesFor(p.save.record, district);
  const bail = bailPrice(charges, p.save.stats.arrests, seizedValue, p.save.level);
  const bent = sargeOnDuty(p.save.trips, p.save.stats.arrests, p.save.police.burned);
  p.save.stats.arrests++;
  return { district, charges, seized, seizedValue, bail, fine: courtFine(bail), sarge: bent ? BENT_SARGE : STRAIGHT_SARGE, bent, paperwork: paperworkPrice(bail) };
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

/**
 * Kerrigan loses the paperwork: cheaper than bail, the charges and the district's police heat gone the same, and
 * from now on he's your contact. False (nothing taken) if he's not on, or you can't cover it.
 */
export function losePaperwork(p: Progress, b: Booking): boolean {
  if (!b.bent || !p.pay(b.paperwork)) return false;
  settle(p, b);
  p.save.police.contact = true;
  return true;
}

/** Crew you can ring from custody to pay your bail: anyone you've taken on and don't already owe. */
export function crewToRing(p: Progress): string[] {
  const owed = p.save.police.owed;
  return owed ? [] : p.save.companions.recruited.filter((id) => COMPANIONS[id]);
}

/** One of your crew pays the bail. You owe them it and a bit more, and they sit at home till you've paid up. */
export function ringCrew(p: Progress, b: Booking, id: string): boolean {
  if (!crewToRing(p).includes(id)) return false;
  settle(p, b);
  p.save.police.owed = { id, left: owedFor(b.bail) };
  p.save.companions.following = p.save.companions.following.filter((x) => x !== id);
  return true;
}

/** Home: pay back whoever bailed you out, from the tin and then your pockets. Returns what was paid now. */
export function repayCrew(p: Progress): number {
  const o = p.save.police.owed;
  if (!o) return 0;
  const c = p.save.cash;
  const fromTin = Math.min(c.bank, o.left);
  c.bank -= fromTin;
  const fromPocket = Math.min(c.pocket, o.left - fromTin);
  c.pocket -= fromPocket;
  const paid = fromTin + fromPocket;
  o.left -= paid;
  if (o.left <= 0) p.save.police.owed = null;
  return paid;
}

/** Can this one of your crew come out with you? Not while you owe them for your bail. */
export function owesCrew(p: Progress, id: string): number {
  const o = p.save.police.owed;
  return o && o.id === id ? o.left : 0;
}

// ---- Kerrigan's favours (the phone's Heat app) ----------------------------------------------------

export interface Favour {
  ok: boolean;
  /** He got caught doing it: he's gone, and the police everywhere are after you. */
  caught: boolean;
  price: number;
}

/** What the seized gear in the property store is worth. */
export function seizedValue(p: Progress): number {
  return p.save.police.seized.reduce((v, x: ItemStack) => v + (ITEMS[x.id]?.value ?? 0) * x.qty, 0);
}

function risk(p: Progress, roll: number): boolean {
  if (roll >= CAUGHT_CHANCE) return false;
  const s = p.save.police;
  s.contact = false;
  s.burned = true;
  // He talks: every part of town's police know your name.
  const all = new Set([...Object.values(LEVELS).map((l) => l.district), ...Object.keys(p.save.districtHeat), p.here].filter(Boolean));
  for (const d of all) p.addHeatOf({ police: CAUGHT_HEAT }, d);
  return true;
}

/** Kerrigan cools a district down (its police heat to nothing). `roll` in [0, 1): under CAUGHT_CHANCE he's caught. */
export function kerriganCool(p: Progress, district: string, roll: number): Favour {
  const price = coolPrice(p.heatIn(district).police);
  if (!p.save.police.contact || p.heatIn(district).police <= 0 || !p.pay(price)) return { ok: false, caught: false, price };
  p.setHeat('police', 0, district);
  if (district === p.here) p.save.heat = 0;
  return { ok: true, caught: risk(p, roll), price };
}

/** Kerrigan gets your seized gear out of the property store (into the stash at home). */
export function kerriganGearBack(p: Progress, roll: number): Favour {
  const s = p.save.police;
  const price = gearBackPrice(seizedValue(p));
  if (!s.contact || !s.seized.length || !p.pay(price)) return { ok: false, caught: false, price };
  // Still hot: it's the same gear, stolen as ever.
  for (const st of s.seized) addStack(p.save.storage, 999, { ...st, uid: p.newUid() }, () => p.newUid());
  s.seized = [];
  return { ok: true, caught: risk(p, roll), price };
}
