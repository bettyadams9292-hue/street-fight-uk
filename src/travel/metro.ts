/**
 * The Brack Metro in play (docs/SUBWAY_PLAN.md; the numbers are in travel/subway.ts).
 *
 * Each station is its own area, `metro_<station>` (world/metroLevels.ts): stairs down from its street, a ticket
 * hall with ticket machines and the gate line, and a platform with the tunnel and the track. A visit to a
 * station (`MetroVisit`) is rolled once on the way in: sometimes a train is standing at the platform with its
 * doors open, sometimes not, and then the board says how long, and the only way to see if one's in is to go back
 * up and come down again (`rollTrain`). Arriving by train, it's always there (you've just got off it).
 *
 * The gates: tap in (your card or cash on you must cover the most a ride can cost; nothing is taken yet) and the
 * fare is charged when you get off at the other end (`tapOut`), or hop them (`hop`: caught, it's the penalty
 * fare, police heat and fare evasion on your record). Going out through the gates is always free.
 */
import type { Progress, AreaId } from '../progress/Progress';
import { HOP_CAUGHT, STATIONS, fare, hopCaught, stationOf, type StationId } from './subway';

export const metroArea = (id: StationId): AreaId => `metro_${id}` as AreaId;

export function stationAt(area: string): StationId | null {
  return area.startsWith('metro_') ? (area.slice(6) as StationId) : null;
}

/** What's going on at the station you're in, this visit. */
export interface MetroVisit {
  station: StationId;
  /** A train at the platform with its doors open. */
  train: boolean;
  /** Minutes till the next one, on the board (no train). */
  minutes: number;
  /** Past the gates (tapped in, hopped, or off a train). */
  through: boolean;
  /** Just off a train: it pulls out a few seconds after you arrive. */
  arrived: boolean;
}

let visit: MetroVisit | null = null;

export const metroVisit = (): MetroVisit | null => visit;
export function setMetroVisit(v: MetroVisit | null): void {
  visit = v;
}

/** About half the time a train's in when you come down. */
export const TRAIN_CHANCE = 0.5;

/** Saved: how many times you've come down (so each visit rolls afresh, and a reload keeps the answer), rides, and a tap-in waiting for its tap-out. */
export interface MetroSave {
  visits: number;
  rides: number;
  tappedIn: StationId | null;
}

export const defaultMetro = (): MetroSave => ({ visits: 0, rides: 0, tappedIn: null });

export function sanitiseMetro(raw: unknown): MetroSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MetroSave>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return { visits: n(r.visits), rides: n(r.rides), tappedIn: STATIONS.some((s) => s.id === r.tappedIn) ? (r.tappedIn as StationId) : null };
}

const hash01 = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
};

/** Coming down the stairs: is a train in? Rolled once a visit from the station and the visit count. */
export function rollTrain(p: Progress, station: StationId): MetroVisit {
  const m = p.save.metro;
  m.visits++;
  const r = hash01(`${station}:${m.visits}`);
  const train = r < TRAIN_CHANCE;
  return { station, train, minutes: train ? 0 : 2 + Math.floor(hash01(`${station}:${m.visits}:wait`) * 7), through: false, arrived: false };
}

/** Off a train at `station`: it's there, and you're past the gates. */
export const arriveBy = (station: StationId): MetroVisit => ({ station, train: true, minutes: 0, through: true, arrived: true });

/** Open stations you can ride to from here. */
export function destinations(p: Progress, here: StationId): StationId[] {
  return STATIONS.filter((s) => s.id !== here && (!s.opens || p.has(s.opens))).map((s) => s.id);
}

/** The most a single ride can cost from here (what tapping in needs to cover). */
export function maxFare(p: Progress, here: StationId): number {
  return Math.max(0, ...destinations(p, here).map((d) => fare(here, d)));
}

export type GateResult = { ok: true; caught?: boolean; fine?: number } | { ok: false; reason: string };

/** Tap in: you need enough to cover the dearest ride; nothing's taken till you tap out. */
export function tapIn(p: Progress, here: StationId): GateResult {
  const need = maxFare(p, here);
  if (!p.canAfford(need)) return { ok: false, reason: `Seek assistance. You need £${need.toFixed(2)} to travel: cash or your card.` };
  p.save.metro.tappedIn = here;
  return { ok: true };
}

/** Off at `to`: the fare for the ride from where you tapped in. Returns what was charged (0 if you hopped). */
export function tapOut(p: Progress, to: StationId): number {
  const from = p.save.metro.tappedIn;
  p.save.metro.tappedIn = null;
  p.save.metro.rides++;
  if (!from) return 0;
  const f = fare(from, to);
  // Pennies: the fare's in pounds and pence, money is whole pounds; round up like any shop.
  const charge = Math.ceil(f);
  p.pay(charge);
  return f;
}

/** Hop the barriers: `roll` 0–1 against the odds of being caught. */
export function hop(p: Progress, here: StationId, roll: number): GateResult {
  const st = stationOf(here);
  const dodged = p.save.record.filter((c) => c.crime === 'fare_evasion').length;
  const caught = roll < hopCaught(st.zone, dodged, p.heatIn().police);
  p.save.metro.tappedIn = null;
  if (!caught) return { ok: true, caught: false };
  const fine = Math.min(HOP_CAUGHT.fine, p.spendable());
  p.pay(fine);
  p.addHeatOf({ police: HOP_CAUGHT.police });
  p.logCrime(HOP_CAUGHT.record);
  return { ok: true, caught: true, fine };
}
