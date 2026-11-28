/**
 * The Brack Metro in play (docs/SUBWAY_PLAN.md; the numbers are in travel/subway.ts).
 *
 * Each station is its own area, `metro_<station>` (world/metroLevels.ts): stairs down from its street, a ticket
 * hall with ticket machines, and a platform with the tunnel and the track.
 *
 * Trains run to a timetable (`trainAt`): one every `HEADWAY` seconds of play at each station. A train comes in out
 * of the west tunnel slowing to a stop (`ARRIVE`), opens its doors, stands with them open (`DWELL`), closes them and
 * pulls out east (`LEAVE`); the board counts down to the next one. Where in the cycle you find a station is fixed
 * by the station and how many times you've come down (`enterStation`), so a reload is the same; the clock runs on
 * the World's own steps while you're there (`tickMetro`), so waiting on the platform brings the train. Arriving by
 * train, you step off with its doors open and it leaves a few seconds later (`arriveBy`).
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

/** Seconds of play: one train a station every HEADWAY; in, open, stand, shut, out. */
export const HEADWAY = 90;
export const ARRIVE = 6;
export const OPEN = 1;
export const DWELL = 24;
export const CLOSE = 1.5;
export const LEAVE = 6;
/** How far out the train is when it starts braking in, and how far it has gone when it's out of sight (m). */
export const RUN_IN = 42;

export type TrainPhase = 'away' | 'arriving' | 'opening' | 'in' | 'closing' | 'leaving';

/** The station you're in, this visit: where its timetable was when you came in, and how long you've been here. */
export interface MetroVisit {
  station: StationId;
  /** Seconds into the cycle when you arrived (0 = a train starting to brake in). */
  start: number;
  /** Seconds of play since. */
  t: number;
  /** You came in on a train. */
  arrived: boolean;
}

/** Where the train is, for drawing and for boarding. */
export interface TrainState {
  phase: TrainPhase;
  /** Metres from its stopping place along the track (negative coming in, positive going out); null when away. */
  x: number | null;
  /** 0 shut .. 1 open. */
  doors: number;
  /** Seconds till the next train's doors open (0 while they're open). */
  eta: number;
  /** You can step on: doors open (not closing). */
  boardable: boolean;
}

export function trainAt(v: MetroVisit | null): TrainState {
  if (!v) return { phase: 'away', x: null, doors: 0, eta: HEADWAY, boardable: false };
  const c = (((v.start + v.t) % HEADWAY) + HEADWAY) % HEADWAY;
  const tOpen = ARRIVE;
  const tIn = ARRIVE + OPEN;
  const tClose = tIn + DWELL;
  const tLeave = tClose + CLOSE;
  const tGone = tLeave + LEAVE;
  const etaOpen = (c <= tOpen ? tOpen - c : HEADWAY - c + tOpen);
  if (c < tOpen) {
    const s = c / ARRIVE;
    return { phase: 'arriving', x: -RUN_IN * (1 - s) * (1 - s), doors: 0, eta: etaOpen, boardable: false };
  }
  if (c < tIn) return { phase: 'opening', x: 0, doors: (c - tOpen) / OPEN, eta: 0, boardable: false };
  if (c < tClose) return { phase: 'in', x: 0, doors: 1, eta: 0, boardable: true };
  if (c < tLeave) return { phase: 'closing', x: 0, doors: 1 - (c - tClose) / CLOSE, eta: etaOpen, boardable: false };
  if (c < tGone) {
    const s = (c - tLeave) / LEAVE;
    return { phase: 'leaving', x: RUN_IN * s * s, doors: 0, eta: etaOpen, boardable: false };
  }
  return { phase: 'away', x: null, doors: 0, eta: etaOpen, boardable: false };
}

/** What the departure board says for the next train: Now while its doors are open, Due, then minutes. */
export function boardWhen(s: TrainState): string {
  if (s.phase === 'in' || s.phase === 'opening') return 'Now';
  if (s.phase === 'arriving') return 'Arriving';
  if (s.eta <= 30) return 'Due';
  return `${Math.ceil(s.eta / 60)} min`;
}

let visit: MetroVisit | null = null;

export const metroVisit = (): MetroVisit | null => visit;
export function setMetroVisit(v: MetroVisit | null): void {
  visit = v;
}

/** The station clock: run on the World's steps while you're in a station (stopped while play is). */
export function tickMetro(dt: number): void {
  if (visit) visit.t += dt;
}

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

/**
 * Coming down the stairs: where the timetable is. Fixed by the station and how many times you've come down, so each
 * visit finds it somewhere new and a reload finds it in the same place. You never have to go back up for a train:
 * wait and one comes.
 */
export function enterStation(p: Progress, station: StationId): MetroVisit {
  const m = p.save.metro;
  m.visits++;
  return { station, start: hash01(`${station}:${m.visits}`) * HEADWAY, t: 0, arrived: false };
}

/** Off a train at `station`: its doors are open behind you and it pulls out a few seconds later. */
export const arriveBy = (station: StationId): MetroVisit => ({ station, start: ARRIVE + OPEN + DWELL - 5, t: 0, arrived: true });

/** Open stations you can ride to from here. */
export function destinations(p: Progress, here: StationId): StationId[] {
  return STATIONS.filter((s) => s.id !== here && p.has(s.opens)).map((s) => s.id);
}

/**
 * Why a ride from `from` to `to` can't happen, or null if it can. The travel layer's own check, so nothing gets
 * round it: not the train screen, a direct call, a stale choice left from before a reload, or another entrance.
 * Both stations must exist and be open (their district's boss down), they must differ, and a train must be in at
 * `from` with its doors open now.
 */
export function rideRefusal(p: Progress, from: StationId, to: StationId, v: MetroVisit | null = visit): string | null {
  const a = STATIONS.find((s) => s.id === from);
  const b = STATIONS.find((s) => s.id === to);
  if (!a || !b) return 'That isn’t a station on the line.';
  if (from === to) return `You’re already at ${a.name}.`;
  if (!p.has(a.opens)) return `${a.name} station is shut.`;
  if (!p.has(b.opens)) return `${b.name} is shuttered. It opens once its district is yours.`;
  if (!v || v.station !== from) return 'You’re not on the platform here.';
  const st = trainAt(v);
  if (!st.boardable) return st.phase === 'closing' || st.phase === 'leaving' ? 'Too late: the doors are shut. The next one’s along shortly.' : `No train in yet: ${boardWhen(st) === 'Due' ? 'it’s due' : `next in ${boardWhen(st)}`}.`;
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
