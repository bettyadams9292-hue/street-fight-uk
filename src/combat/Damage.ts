import type { Stats } from '../stats/Stats';

/** Damage lost for repeating the same move: x0.9 per consecutive repeat, floor x0.6. */
export function repetitionMultiplier(consecutiveUses: number): number {
  return Math.max(0.6, Math.pow(0.9, Math.max(0, consecutiveUses - 1)));
}

/**
 * Damage = Base x (1 + 0.03 STR) x fatigue/gear x mastery x counter x repetition
 *          x (1 - DEF / (DEF + 40)) x target damage-taken effects
 * (clean hits are applied by the caller).
 */
export function computeDamage(
  base: number,
  attacker: Stats,
  target: Stats,
  repeatMult = 1,
  counterMult = 1,
  masteryMult = 1,
): number {
  return (
    base *
    attacker.damageMultiplier *
    masteryMult *
    counterMult *
    repeatMult *
    (1 - target.defenceReduction) *
    target.damageTakenMultiplier
  );
}

/** Stamina lost per point of blocked damage, before the Defence reduction. */
export const BLOCK_STAMINA_RATIO = 0.3;
export const CLEAN_HIT_DAMAGE = 1.3;
export const CLEAN_HIT_POISE = 1.5;
