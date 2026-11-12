import type { AreaId } from '../progress/Progress';
import type { ExitDef, LevelDef } from './LevelTypes';

/**
 * The town is one long street. Every outdoor district sits on it, end to end,
 * and you walk from one into the next without a stop: the seam between two
 * districts is just a line on the pavement.
 *
 * Each district keeps its own id, fights, doors and save data. This file only
 * says what order they come in, joins their ends, and says which seams are
 * shut until the story opens them.
 *
 * No Three.js here: the simulation, the map and the tests all read it.
 */

/** West to east. Home is on the estate, a fifth of the way along. */
const strip: AreaId[] = [
  'stadium', 'leisure', 'residential', 'estate', 'high_street', 'alleys', 'industrial', 'ind_estate', 'market', 'subway',
  'city', 'docks', 'precinct', 'mall', 'car_park', 'nightlife', 'factory', 'underground', 'territory', 'hq',
];
export const STRIP: readonly AreaId[] = strip;

/** Carry the street on eastwards (the generated towns). `lock` shuts the seam into the first of the new districts. */
export function extendStrip(ids: readonly AreaId[], lock?: SeamLock): void {
  for (const id of ids) if (!strip.includes(id)) strip.push(id);
  if (lock && ids.length) SEAM_LOCKS[ids[0]] = lock;
}

const HOME_INDEX = STRIP.indexOf('estate');

export interface SeamLock {
  requires?: string;
  requiresAll?: string[];
  lockedText: string;
}

/**
 * Seams that stay shut until the story opens them, keyed by the district on the
 * far side from home. Walking back towards home is never locked.
 */
export const SEAM_LOCKS: Partial<Record<AreaId, SeamLock>> = {
  stadium: { requires: 'has_stadium_key', lockedText: 'The stadium service gate is locked. Someone at the Old Market has a key.' },
  alleys: { requires: 'boss_gaffer', lockedText: 'Gaffer’s lads block the way. Deal with him first.' },
  ind_estate: { requires: 'boss_sully', lockedText: 'Sully’s gym runs this yard. Beat him first.' },
  docks: { requires: 'boss_ratcatcher', lockedText: 'The Ratcatcher’s crew won’t let you past' },
  nightlife: { requires: 'has_vip_pass', lockedText: 'The doormen want to see a VIP pass. Whoever runs the precinct hands them out.' },
  hq: {
    requiresAll: ['has_dunc_phone', 'boss_docks', 'boss_precinct', 'boss_nightclub', 'boss_stadium'],
    lockedText: 'Hale House is locked down. Beat Big Dunc, then break the Docks, the Precinct, the Neon Mile and the Firm.',
  },
};

/** Doors between two streets that stay as doors: the subway steps are a short cut, not the way through. */
const KEPT_STREET_DOORS = new Set(['subway_steps', 'estate_stairs']);

export function onStrip(id: AreaId): boolean {
  return STRIP.includes(id);
}

export function stripIndex(id: AreaId): number {
  return STRIP.indexOf(id);
}

/** The districts either side of this one on the street. */
export function stripNeighbours(id: AreaId): { left: AreaId | null; right: AreaId | null } {
  const i = STRIP.indexOf(id);
  if (i < 0) return { left: null, right: null };
  return { left: i > 0 ? STRIP[i - 1] : null, right: i < STRIP.length - 1 ? STRIP[i + 1] : null };
}

export function stripLength(levels: Record<AreaId, LevelDef>): number {
  return STRIP.reduce((n, id) => n + (levels[id].bounds.maxX - levels[id].bounds.minX), 0);
}

/**
 * Where each district starts on the whole street, in metres from its west end.
 * A point at local x in a district is at `stripOffsets[id] + (x - bounds.minX)`.
 */
export function stripOffsets(levels: Record<AreaId, LevelDef>): Partial<Record<AreaId, number>> {
  const out: Partial<Record<AreaId, number>> = {};
  let at = 0;
  for (const id of STRIP) {
    out[id] = at;
    at += levels[id].bounds.maxX - levels[id].bounds.minX;
  }
  return out;
}

/** Metres along the whole street for a point in a district (null for interiors). */
export function stripX(levels: Record<AreaId, LevelDef>, id: AreaId, x: number): number | null {
  const off = stripOffsets(levels)[id];
  return off === undefined ? null : off + (x - levels[id].bounds.minX);
}

/** A seam exit: you cross it by walking, with no door and no fade. */
export function isSeam(ex: ExitDef): boolean {
  return ex.kind === 'edge' && ex.seam === true;
}

/**
 * Joins the districts end to end. Rewrites each outdoor level's edge exits so
 * its west end leads to the district before it and its east end to the one
 * after, drops the side doors that used to lead from one street to another,
 * and makes sure every district has a 'left' and a 'right' entry.
 */
export function joinStrip(levels: Record<AreaId, LevelDef>): void {
  STRIP.forEach((id, i) => {
    const lvl = levels[id];
    const { minX, maxX } = lvl.bounds;
    lvl.exits = lvl.exits.filter((e) => {
      if (e.kind === 'edge') return false;
      // A door from one street to another: the street carries on instead.
      return !(STRIP.includes(e.to) && !KEPT_STREET_DOORS.has(e.id));
    });
    if (!lvl.entries.some((e) => e.id === 'left')) lvl.entries.push({ id: 'left', x: minX + 2, z: 0, facing: 1 });
    if (!lvl.entries.some((e) => e.id === 'right')) lvl.entries.push({ id: 'right', x: maxX - 2, z: 0, facing: -1 });
    const add = (side: 'left' | 'right', to: AreaId): void => {
      const there = levels[to];
      // Heading away from home is what the story locks.
      const outward = side === 'right' ? i >= HOME_INDEX : i <= HOME_INDEX;
      const lock = outward ? SEAM_LOCKS[to] : undefined;
      lvl.exits.push({
        id: `to_${to}`,
        kind: 'edge',
        side,
        seam: true,
        x: side === 'left' ? minX : maxX,
        z: 0,
        to,
        toEntry: side === 'left' ? 'right' : 'left',
        label: there.name,
        ...(lock ?? {}),
      });
    };
    if (i > 0) add('left', STRIP[i - 1]);
    if (i < STRIP.length - 1) add('right', STRIP[i + 1]);
  });
}
