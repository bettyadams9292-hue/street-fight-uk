/**
 * The Brack Metro in play (docs/SUBWAY_PLAN.md; the numbers are in travel/subway.ts).
 *
 * Each station is its own area, `metro_<station>` (world/metroLevels.ts): stairs down from its street, a ticket
 * hall with ticket machines and the gate line, and a platform with the tunnel and the track. A visit to a
 * station (`MetroVisit`) is rolled once on the way in: sometimes a train is standing at the platform with its
 * doors open, sometimes not, and then the board says how long, and the only way to see if one's in is to go back
 * up and come down again (`rollTrain`). Arriving by train, it's always there (you've just got off it).
 *
 * No barriers: the hall is open to the platform, and you pay for a ride as you board (`payRide`: cash, then card).
 * Each station stays shuttered until its district's boss is beaten (`Station.opens` in travel/subway.ts).
 */
import type { Progress, AreaId } from '../progress/Progress';
import { STATIONS, fare, stationOf, type StationId } from './subway';

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

/** Saved: how many times you've come down (so each visit rolls afresh, and a reload keeps the answer), and rides. */
export interface MetroSave {
  visits: number;
  rides: number;
}

export const defaultMetro = (): MetroSave => ({ visits: 0, rides: 0 });

export function sanitiseMetro(raw: unknown): MetroSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MetroSave>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return { visits: n(r.visits), rides: n(r.rides) };
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
  return { station, train, minutes: train ? 0 : 2 + Math.floor(hash01(`${station}:${m.visits}:wait`) * 7), arrived: false };
}

/** Off a train at `station`: it's there. */
export const arriveBy = (station: StationId): MetroVisit => ({ station, train: true, minutes: 0, arrived: true });

/** Open stations you can ride to from here. */
export function destinations(p: Progress, here: StationId): StationId[] {
  return STATIONS.filter((s) => s.id !== here && p.has(s.opens)).map((s) => s.id);
}

/**
 * Why a ride from `from` to `to` can't happen, or null if it can. The travel layer's own check, so nothing gets
 * round it: not the train screen, a direct call, a stale choice left from before a reload, or another entrance.
 * Both stations must exist and be open (their district's boss down), they must differ, and a train must be in at
 * `from` this visit.
 */
export function rideRefusal(p: Progress, from: StationId, to: StationId, v: MetroVisit | null = visit): string | null {
  const a = STATIONS.find((s) => s.id === from);
  const b = STATIONS.find((s) => s.id === to);
  if (!a || !b) return 'That isn’t a station on the line.';
  if (from === to) return `You’re already at ${a.name}.`;
  if (!p.has(a.opens)) return `${a.name} station is shut.`;
  if (!p.has(b.opens)) return `${b.name} is shuttered. It opens once its district is yours.`;
  if (!v || v.station !== from || !v.train) return 'No train in. Go back up and come down again to see if one’s in.';
  return null;
}

/** Pay for a ride on the train (cash, then your card). No barriers: you pay as you board. */
export function payRide(p: Progress, from: StationId, to: StationId, v: MetroVisit | null = visit): { ok: true; paid: number } | { ok: false; reason: string } {
  const why = rideRefusal(p, from, to, v);
  if (why) return { ok: false, reason: why };
  const paid = Math.ceil(fare(from, to));
  if (!p.canAfford(paid)) return { ok: false, reason: `It's £${paid} to ${stationOf(to).name}: not enough cash on you or on your card.` };
  p.pay(paid);
  p.save.metro.rides++;
  return { ok: true, paid };
}
