/**
 * Difficulty dials for each main fight (docs/GAMEPLAY_PLAN.md, stage 4).
 *
 * Every enemy in a main fight takes extra damage, so fights don't drag: about 30%
 * less effective health for ordinary enemies and about 17% less for bosses. On top
 * of that, each fight has one "strength" dial (1 = as designed). Strength
 * scales the enemies' damage and their effective health together. The dials
 * are set by `tools/tune_fights.ts`, which plays every fight with bots and
 * moves each dial until win rates follow a smooth curve: easy at the start,
 * steadily harder, with each boss a step above its area.
 */
export const ENEMY_DAMAGE_TAKEN = 1.45;
/** Winning a main fight brings you back up to at least this share of your health. */
export const SECOND_WIND = 0.5;
export const BOSS_DAMAGE_TAKEN = 1.2;

/** `area/encounter` → strength. Written by tools/tune_fights.ts; edit by hand only to override. */
export const FIGHT_STRENGTH: Record<string, number> = {
  'estate/lads': 1.01,
  'high_street/pub_door': 1.02,
  'high_street/gaffer': 1.17,
  'alleys/ambush': 1.07,
  'industrial/yard': 0.95,
  'industrial/sully': 1.26,
  'subway/underpass': 0.98,
  'city/square': 0.69,
  'city/ratcatcher': 0.83,
  'territory/gauntlet': 1.33,
  'territory/dunc': 1.16,
  'residential/stairwell': 1.03,
  'residential/king': 0.52,
  'market/traders': 1.07,
  'market/maureen': 0.89,
  'leisure/carpark': 1.04,
  'docks/quay': 0.96,
  'docks/lenny': 0.73,
  'ind_estate/yard': 0.99,
  'precinct/shutters': 1.06,
  'precinct/pryce': 1.05,
  'mall/security': 1.09,
  'car_park/level3': 1.13,
  'nightlife/kicking_out': 1.20,
  'nightlife/simone': 1.26,
  'stadium/away_end': 1.22,
  'stadium/top_boy': 1.13,
  'factory/floor': 1.17,
  'factory/kasia': 1.50,
  'underground/platform': 1.12,
  'underground/crane': 1.42,
  'hq/gate': 1.12,
  'hq/courtyard': 1.59,
  'hq/hale': 1.39,
};

export function fightStrength(area: string, encounter: string): number {
  return FIGHT_STRENGTH[`${area}/${encounter}`] ?? 1;
}
