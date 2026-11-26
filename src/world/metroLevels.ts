/**
 * The Brack Metro's stations as areas (`metro_<station>`, travel/metro.ts): one room, modelled once
 * (render/metroStation.ts) and dressed for each station by its colour, its name and its tiles.
 *
 * Left to right: the stairs up to the street (x 0–3.6), the ticket hall (ticket machines, the line map, the staff
 * booth) and the gate line at `GATE_X`, a passage, then the platform (`PLATFORM_X0`–`PLATFORM_X1`) with the track
 * and the tunnel behind it. The walkway is the street's (NARROW); the platform edge is the back of it.
 */
import type { LevelDef } from './LevelTypes';
import { STATIONS, type Station, type StationId } from '../travel/subway';
import type { AreaId } from '../progress/Progress';

export const METRO_LENGTH = 62;
/** The gate line across the ticket hall. */
export const GATE_X = 15.5;
/** The platform's length along the room; the train stands along it. */
export const PLATFORM_X0 = 20;
export const PLATFORM_X1 = 60;
/** Where the train's doors are (the middle of each pair), for boarding. */
export const TRAIN_DOORS = [24, 28.2, 32.4, 37.2, 41.4, 45.6, 50.4, 54.6];
/** Where you come down from the street. */
export const STAIRS_X = 1.9;

/** Each station's own look: its tile band and the colour of its name boards. */
export const STATION_LOOK: Record<StationId, { band: string; tile: string; ox?: boolean }> = {
  tanner_road: { band: '#2f6b3a', tile: '#cfc8b4' },
  high_street: { band: '#b31f2b', tile: '#d3ccb8', ox: true },
  market_square: { band: '#1f3f8f', tile: '#d5cfbf' },
  canal_docks: { band: '#0e6e73', tile: '#cdc8b8' },
  riverside: { band: '#c2741c', tile: '#d4cdbd' },
  neon_mile: { band: '#7a2b8c', tile: '#c9c4b5' },
  deep_line: { band: '#4a4f57', tile: '#bdb6a4' },
};

const ROOM = { minZ: -1.6, maxZ: 1.6 };

/**
 * Where each station's stairs come up: the street (area) and how far along it. Tanner Road's are off the Ring Road
 * underpass, not the estate itself (the estate's stairwell already goes down to the underpass).
 */
export const ENTRANCE: Record<StationId, { area: AreaId; x: number }> = {
  tanner_road: { area: 'subway', x: 8 },
  high_street: { area: 'high_street', x: 40 },
  market_square: { area: 'city', x: 40 },
  canal_docks: { area: 'docks', x: 35 },
  riverside: { area: 'mall', x: 12 },
  neon_mile: { area: 'nightlife', x: 60 },
  deep_line: { area: 'underground', x: 44 },
};

function stationLevel(st: Station): LevelDef {
  const id = `metro_${st.id}` as AreaId;
  const up = ENTRANCE[st.id];
  const lights = [];
  for (let x = 4; x < METRO_LENGTH - 2; x += 6) lights.push({ x, y: 3.0, z: -0.4, colour: 0xeef3ff, intensity: x < GATE_X + 2 ? 3.4 : 3.0, range: 8 });
  return {
    id,
    name: `${st.name} station`,
    district: st.name,
    theme: 'metro',
    bounds: { minX: 0, maxX: METRO_LENGTH, ...ROOM },
    entries: [
      // Off the stairs from the street.
      { id: 'street', x: STAIRS_X + 0.9, z: -0.9, facing: 1 },
      // Off a train, on the platform at its middle door.
      { id: 'platform', x: TRAIN_DOORS[3], z: -1.2, facing: -1 },
    ],
    exits: [
      { id: 'metro_stairs', kind: 'door', x: STAIRS_X, z: -1.4, to: up.area, toEntry: `metro_${st.id}`, label: `Way out: up to ${streetName(up.area)}` },
    ],
    facades: [{ kind: 'metro', x0: 0, x1: METRO_LENGTH, label: st.name.toUpperCase() }],
    props: [
      // Benches along the back of the platform, between the doors.
      { kind: 'bench', x: 30.3, z: 1.35, solid: false },
      { kind: 'bench', x: 43.5, z: 1.35, solid: false },
    ],
    pickups: [],
    containers: [],
    encounters: [],
    stations: [
      { id: 'metro_gates', x: GATE_X - 0.6, z: 0.2, label: 'Ticket barriers' },
      { id: 'metro_board', x: 34.8, z: -1.0, label: 'Departures' },
      ...TRAIN_DOORS.map((x) => ({ id: 'metro_train' as const, x, z: -1.25, label: 'Board the train' })),
    ],
    lights,
    weather: 'indoors',
    objective: `${st.name} station`,
  } as LevelDef;
}

function streetName(area: AreaId): string {
  const names: Partial<Record<string, string>> = { estate: 'the underpass', high_street: 'the High Street', city: 'Market Square', docks: 'Canal Docks', mall: 'the Riverside Centre', nightlife: 'the Neon Mile', underground: 'the Deep Line', subway: 'the underpass' };
  return names[area] ?? 'the street';
}

/** Every station's area. */
export const METRO_LEVELS: Record<string, LevelDef> = Object.fromEntries(STATIONS.map((st) => [`metro_${st.id}`, stationLevel(st)]));

/**
 * Put each station's stairs on its street: a door down (a gap in the frontage, drawn as a stairwell like the
 * underpass's: world/strip.ts isSubwayStairs) and the spot you come back up to. Anything standing where the stairs
 * go is moved along. Locked until the line reaches it (`opens`).
 */
export function addMetroEntrances(levels: Record<string, LevelDef>): void {
  for (const st of STATIONS) {
    const e = ENTRANCE[st.id];
    const lv = levels[e.area];
    if (!lv) continue;
    for (const p of lv.props) if (Math.abs(p.x - e.x) < 2.2 && p.z < -0.6) p.x = e.x + (p.x < e.x ? -2.6 : 2.6);
    lv.exits.push({
      id: `metro_${st.id}`, kind: 'door', x: e.x, z: -1.5, to: `metro_${st.id}` as AreaId, toEntry: 'street',
      label: `Down to ${st.name} station`, ...(st.opens ? { requires: st.opens, lockedText: 'Shutters down. The line doesn’t run this far yet.' } : {}),
    });
    lv.entries.push({ id: `metro_${st.id}`, x: e.x, z: -1.0, facing: 1 });
  }
}
