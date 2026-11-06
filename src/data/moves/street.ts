import type { MoveData } from '../../combat/MoveData';
import type { AttackButton } from '../../input/Commands';

/**
 * Street Fighting: the style every player starts with. Loose, scrappy,
 * heavy-handed. Starting values for tuning (see design doc).
 *
 * Combo graph:
 *   jab -> jab -> hook -> haymaker
 *   jab -> front kick -> roundhouse
 *   front kick -> roundhouse
 */
const moves: MoveData[] = [
  {
    id: 'street_jab', name: 'Jab', style: 'street', button: 'lp', kind: 'light', limb: 'leadHand',
    startup: 5, active: 3, recovery: 9, damage: 5, staminaCost: 6,
    reach: 0.78, hitRadius: 0.16, hitY: 1.5, height: 'high', depthTolerance: 0.45,
    hitstun: 15, blockstun: 9, knockback: 1.2, poiseDamage: 9, reaction: 'flinch', hitstop: 3, lunge: 0.05,
    next: { lp: 'street_jab_2', hp: 'street_haymaker', lk: 'street_front_kick' },
  },
  {
    id: 'street_jab_2', name: 'Double Jab', style: 'street', button: 'lp', kind: 'light', limb: 'leadHand',
    startup: 4, active: 3, recovery: 10, damage: 5, staminaCost: 6,
    reach: 0.8, hitRadius: 0.16, hitY: 1.5, height: 'high', depthTolerance: 0.45,
    hitstun: 16, blockstun: 9, knockback: 1.2, poiseDamage: 9, reaction: 'flinch', hitstop: 3, lunge: 0.08,
    next: { lp: 'street_hook', hp: 'street_haymaker', lk: 'street_front_kick' },
  },
  {
    id: 'street_hook', name: 'Rear Hook', style: 'street', button: 'lp', kind: 'light', limb: 'rearHand',
    startup: 7, active: 3, recovery: 14, damage: 9, staminaCost: 9,
    reach: 0.7, hitRadius: 0.2, hitY: 1.5, height: 'high', depthTolerance: 0.55,
    hitstun: 24, blockstun: 11, knockback: 1.6, poiseDamage: 18, reaction: 'flinch', hitstop: 5, lunge: 0.1,
    next: { hp: 'street_haymaker' },
  },
  {
    id: 'street_haymaker', name: 'Haymaker', style: 'street', button: 'hp', kind: 'heavy', limb: 'rearHand',
    startup: 14, active: 4, recovery: 22, damage: 18, staminaCost: 16,
    reach: 0.85, hitRadius: 0.22, hitY: 1.5, height: 'high', depthTolerance: 0.55,
    hitstun: 24, blockstun: 15, knockback: 3.5, poiseDamage: 40, reaction: 'stagger', hitstop: 7, lunge: 0.3,
    next: {},
  },
  {
    id: 'street_front_kick', name: 'Front Kick', style: 'street', button: 'lk', kind: 'light', limb: 'leadFoot',
    startup: 9, active: 3, recovery: 14, damage: 9, staminaCost: 8,
    reach: 1.05, hitRadius: 0.2, hitY: 1.0, height: 'mid', depthTolerance: 0.45,
    hitstun: 24, blockstun: 11, knockback: 2.2, poiseDamage: 15, reaction: 'flinch', hitstop: 4, lunge: 0.05,
    next: { hk: 'street_roundhouse', lp: 'street_jab' },
  },
  {
    id: 'street_roundhouse', name: 'Roundhouse', style: 'street', button: 'hk', kind: 'heavy', limb: 'rearFoot',
    startup: 16, active: 4, recovery: 24, damage: 16, staminaCost: 18,
    reach: 1.12, hitRadius: 0.24, hitY: 1.35, height: 'high', depthTolerance: 0.65,
    hitstun: 26, blockstun: 16, knockback: 4.0, poiseDamage: 45, reaction: 'knockdown', hitstop: 8, lunge: 0.2,
    next: {},
  },
];

export const STREET_MOVES: Record<string, MoveData> = Object.fromEntries(moves.map((m) => [m.id, m]));

/** Move used when a button is pressed from neutral. */
export const STREET_STARTERS: Record<AttackButton, string> = {
  lp: 'street_jab',
  hp: 'street_haymaker',
  lk: 'street_front_kick',
  hk: 'street_roundhouse',
};
