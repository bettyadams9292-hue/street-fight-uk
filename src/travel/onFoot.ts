/**
 * Running somewhere (map → Run there; Game's autopilot): free, along the real streets, through the same exits and
 * doors you'd walk through, with your own run. The risk is the street: each street you cross on the way rolls once
 * for a few lads to jump you (`ambushChance`), more in rough districts and where a gang's after you, less in the
 * clean ones, none before the first steps are learned, and only on streets (not inside shops or your house).
 *
 * A short hop is one or two rolls; a long run across rough districts is many, so it adds up (`journeyRisk`), but each
 * one is small, so walking stays worth doing all game. Rolls come from the street, the trip and the journey (`hash01`),
 * never the fight's RNG, so a reload doesn't change them.
 */
import type { AreaId, Progress } from '../progress/Progress';
import { CLEAN_DISTRICTS, ROUGH_DISTRICTS } from '../progress/cops';
import { LEVELS } from '../world/levels';
import type { LevelDef } from '../world/LevelTypes';

/** Chance of being jumped crossing one ordinary street. */
export const AMBUSH_BASE = 0.07;
/** In a rough district, and in a clean one. */
export const AMBUSH_ROUGH = 0.13;
export const AMBUSH_CLEAN = 0.025;
/** Gang heat adds up to this much more (at 100). */
export const AMBUSH_GANG = 0.1;
/** Never more than this on one street. */
export const AMBUSH_MAX = 0.25;

const street = (lv: LevelDef | undefined): boolean => !!lv && !lv.deep && lv.weather !== 'indoors' && lv.id !== 'home' && lv.id !== 'basement';

/** The chance of being jumped crossing `area` on foot. */
export function ambushChance(p: Progress, area: AreaId): number {
  const lv = (LEVELS as Record<string, LevelDef>)[area];
  if (!street(lv) || !p.save.tutorial.essentialDone) return 0;
  const d = lv.district;
  const base = ROUGH_DISTRICTS.has(d) ? AMBUSH_ROUGH : CLEAN_DISTRICTS.has(d) ? AMBUSH_CLEAN : AMBUSH_BASE;
  const gang = p.heatIn(d).gang / 100;
  return Math.min(AMBUSH_MAX, base + AMBUSH_GANG * gang);
}

/** The chance of at least one fight on the whole way (`path`: the streets you'll cross, as `route` gives them). */
export function journeyRisk(p: Progress, path: readonly AreaId[]): number {
  return 1 - path.reduce((ok, a) => ok * (1 - ambushChance(p, a)), 1);
}

export function riskWord(r: number): string {
  return r <= 0.001 ? 'no trouble' : r < 0.12 ? 'low risk of trouble' : r < 0.3 ? 'some risk of trouble' : 'high risk of trouble';
}

/** 0..1 from a string (FNV-1a), for rolls that don't touch any RNG. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Whether you're jumped on this street, on this journey (`journey`: a number fixed when you set off). */
export function jumped(p: Progress, area: AreaId, journey: number): boolean {
  const c = ambushChance(p, area);
  return c > 0 && hash01(`ambush:${area}:${p.save.trips}:${journey}`) < c;
}

/** How many come for you: two, three once you're further on. */
export function ambushSize(p: Progress): number {
  return p.save.level >= 12 ? 3 : 2;
}
