/**
 * The Brack Metro: the town's underground line, as a way to get about (docs/SUBWAY_PLAN.md). This is the
 * groundwork: the line, its stations and which street each one's entrance stands on, fares, hopping the
 * barriers, and the odds of a scrap on a platform or in a carriage. All pure and tested (tests/subway.test.ts);
 * nothing in the game uses it yet. The plan says what each step wires in.
 *
 * Getting about by Metro, once it's built:
 *   1. Walk down the stairs from a street (a station entrance, `door` exit to the station's concourse).
 *   2. At the ticket barriers: tap in (pay the fare, `fare`) or hop them (`hopCaught`: get caught and it's a
 *      penalty fare plus heat and a `fare_evasion` on your record; get away and you're through).
 *   3. On the platform: wait for the train (`waitSeconds`); sometimes it kicks off (`platformScrap`).
 *   4. Ride to the station you picked (fast travel, `rideSeconds`); sometimes it kicks off in the carriage
 *      (`carriageScrap`), and the train stops at the next station so the fight has room.
 *   5. Up the stairs at the other end, onto that station's street.
 */
import type { AreaId } from '../progress/Progress';

export type StationId = 'tanner_road' | 'high_street' | 'market_square' | 'canal_docks' | 'riverside' | 'neon_mile' | 'deep_line';

export interface Station {
  id: StationId;
  /** Its name on the roundel and the line map. */
  name: string;
  /** The street its entrance is on, and where along it (metres): a gap in the frontage for the stairs. */
  area: AreaId;
  x: number;
  /** Fare zone (1 is the middle of town). */
  zone: 1 | 2 | 3;
  /** The story flag that opens it (the street being reachable isn't enough: the line opens in stages). */
  opens?: string;
}

/**
 * The line, in order, west to east. Deep Line is the old disused station under the Abandoned Factory (the
 * `underground` street), last on the line and reopened late in the story.
 */
export const STATIONS: Station[] = [
  // The estate's stairwell down (x 33.9, beside the lock-up) is the entrance: it leads to the Ring Road underpass now.
  { id: 'tanner_road', name: 'Tanner Road', area: 'estate', x: 33.9, zone: 2 },
  { id: 'high_street', name: 'High Street', area: 'high_street', x: 40, zone: 1 },
  { id: 'market_square', name: 'Market Square', area: 'city', x: 40, zone: 1, opens: 'boss_gaffer' },
  { id: 'canal_docks', name: 'Canal Docks', area: 'docks', x: 35, zone: 2, opens: 'boss_gaffer' },
  { id: 'riverside', name: 'Riverside', area: 'mall', x: 12, zone: 2, opens: 'boss_sully' },
  { id: 'neon_mile', name: 'Neon Mile', area: 'nightlife', x: 60, zone: 3, opens: 'boss_ratcatcher' },
  { id: 'deep_line', name: 'Deep Line', area: 'underground', x: 44, zone: 3, opens: 'boss_dunc' },
];

export const stationOf = (id: StationId): Station => STATIONS.find((s) => s.id === id)!;

/** Stations a run of `from` to `to` passes through, in order (both ends included). */
export function stopsBetween(from: StationId, to: StationId): StationId[] {
  const a = STATIONS.findIndex((s) => s.id === from);
  const b = STATIONS.findIndex((s) => s.id === to);
  const out = STATIONS.slice(Math.min(a, b), Math.max(a, b) + 1).map((s) => s.id);
  return a <= b ? out : out.reverse();
}

// ---- fares ------------------------------------------------------------------------------------------------------

/** Pay-as-you-go: a fare by the zones you cross. Dearer than a bus, much cheaper than a cab (ui/hub.ts CAB_*). */
export const FARE_BASE = 2.4;
export const FARE_PER_ZONE = 0.9;
/** Caught without a ticket: the penalty fare (it's real money, but it's the heat and the record that sting). */
export const PENALTY_FARE = 50;

export function fare(from: StationId, to: StationId): number {
  if (from === to) return 0;
  const zones = new Set(stopsBetween(from, to).map((s) => stationOf(s).zone));
  return Math.round((FARE_BASE + FARE_PER_ZONE * (zones.size - 1)) * 10) / 10;
}

// ---- hopping the barriers -----------------------------------------------------------------------------------------

/**
 * The chance you're caught hopping the barriers, 0–1: there's usually a member of staff about (more in the
 * middle of town), more often a revenue inspector the more you've dodged lately (`dodged`: fare evasions on your
 * record), and if the police already want you here, a British Transport Police officer at the gate.
 */
export function hopCaught(zone: 1 | 2 | 3, dodged: number, police: number): number {
  const staff = zone === 1 ? 0.22 : zone === 2 ? 0.15 : 0.1;
  const inspectors = Math.min(0.35, dodged * 0.07);
  const wanted = police >= 50 ? 0.25 : police >= 25 ? 0.1 : 0;
  return Math.min(0.8, staff + inspectors + wanted);
}

/** What getting caught costs: the penalty fare, police heat where you are, and the record. */
export const HOP_CAUGHT = { fine: PENALTY_FARE, police: 6, record: 'fare_evasion' as const };

// ---- waiting and riding -------------------------------------------------------------------------------------------

/** Seconds on the platform before the train comes in (a train every few minutes; less late at night). */
export function waitSeconds(roll: number, night: boolean): number {
  return Math.round((night ? 20 : 8) + roll * (night ? 40 : 22));
}

/** Seconds of travel (the screen fades through a ride): a station takes about 20 s. */
export function rideSeconds(from: StationId, to: StationId): number {
  return (stopsBetween(from, to).length - 1) * 20;
}

// ---- scraps underground -----------------------------------------------------------------------------------------

/**
 * A scrap on the platform while you wait, 0–1: rougher stations and late at night, and more if the gang here is
 * after you (gang heat). None while the tutorial runs or on the first ride (`rides` so far).
 */
export function platformScrap(zone: 1 | 2 | 3, night: boolean, gang: number, rides: number): number {
  if (rides < 1) return 0;
  const base = zone === 1 ? 0.06 : zone === 2 ? 0.1 : 0.16;
  return Math.min(0.6, base + (night ? 0.08 : 0) + gang / 400);
}

/** A scrap in the carriage on the way, 0–1: more for a long ride and at night. */
export function carriageScrap(stops: number, night: boolean, rides: number): number {
  if (rides < 2) return 0;
  return Math.min(0.45, 0.04 * stops + (night ? 0.08 : 0));
}
