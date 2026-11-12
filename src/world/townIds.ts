/**
 * Ids of the generated towns east of Hale House (see world/towns.ts).
 * Kept in a file with no imports so the save code and the level code can both use it.
 */
export const TOWN_COUNT = 6;
export const DISTRICTS_PER_TOWN = 4;

/** A district of a generated town: town 1 to TOWN_COUNT, district 1 to DISTRICTS_PER_TOWN. */
export type TownAreaId = `t${number}d${number}`;
export type TownBossId = `town${number}`;

export function townAreaId(town: number, district: number): TownAreaId {
  return `t${town}d${district}`;
}

export const TOWN_AREA_IDS: TownAreaId[] = [];
for (let t = 1; t <= TOWN_COUNT; t++) for (let d = 1; d <= DISTRICTS_PER_TOWN; d++) TOWN_AREA_IDS.push(townAreaId(t, d));

export function townBossId(town: number): TownBossId {
  return `town${town}`;
}

/** The flag set when a town's boss is beaten; it opens the next town. */
export function townBossFlag(town: number): string {
  return `boss_town${town}`;
}
