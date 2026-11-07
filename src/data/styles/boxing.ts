import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';

type BaseStyle = Omit<StyleData, 'air' | 'dash'>;
import { clinchStrike, finisherMove, getupKick, grabMove, table, throwMove } from './shared';

const S = 'boxing';

/**
 * Boxing: hands only. Fastest combos, best block, head movement.
 * Kick buttons throw body shots and the overhand instead.
 * Combo: jab, jab, cross, hook, uppercut.
 */
export const BOXING: BaseStyle = {
  id: 'boxing',
  name: 'Boxing',
  blurb: 'Tight guard, bouncing footwork and fast hands. No kicks.',
  strengths: ['Fastest combos', 'Best block', 'Slips punches without leaving range', 'Body shots drain stamina'],
  weaknesses: ['No kicks: short reach', 'Weak against grapplers'],
  moves: table(
    move({
      id: 'boxing_jab', name: 'Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 4, active: 3, recovery: 8, damage: 4, staminaCost: 5, reach: 0.8, hitRadius: 0.16,
      hitstun: 16, blockstun: 8, knockback: 1, poiseDamage: 8, hitstop: 3, lunge: 0.06,
      next: { lp: 'boxing_jab_2', hp: 'boxing_cross', lk: 'boxing_body_shot' },
    }),
    move({
      id: 'boxing_jab_2', name: 'Double Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 4, active: 3, recovery: 8, damage: 4, staminaCost: 5, reach: 0.82, hitRadius: 0.16,
      hitstun: 17, blockstun: 8, knockback: 1, poiseDamage: 8, hitstop: 3, lunge: 0.08,
      next: { hp: 'boxing_cross', lk: 'boxing_body_shot' },
    }),
    move({
      id: 'boxing_cross', name: 'Cross', style: S, button: 'hp', kind: 'light', anim: 'cross', limb: 'rearHand',
      startup: 6, active: 3, recovery: 11, damage: 8, staminaCost: 8, reach: 0.85, hitRadius: 0.17,
      hitstun: 20, blockstun: 10, knockback: 1.6, poiseDamage: 16, hitstop: 4, lunge: 0.12,
      next: { lp: 'boxing_hook', hk: 'boxing_overhand' },
    }),
    move({
      id: 'boxing_hook', name: 'Lead Hook', style: S, button: 'lp', kind: 'light', anim: 'hook', limb: 'leadHand',
      startup: 6, active: 3, recovery: 11, damage: 8, staminaCost: 8, reach: 0.68, hitRadius: 0.2, depthTolerance: 0.6,
      hitstun: 22, blockstun: 10, knockback: 1.4, poiseDamage: 18, hitstop: 5, lunge: 0.08,
      next: { hp: 'boxing_uppercut' },
    }),
    move({
      id: 'boxing_uppercut', name: 'Uppercut', style: S, button: 'hp', kind: 'heavy', anim: 'uppercut', limb: 'rearHand',
      startup: 9, active: 3, recovery: 18, damage: 14, staminaCost: 13, reach: 0.6, hitRadius: 0.2, hitY: 1.55,
      hitstun: 26, blockstun: 12, knockback: 2.6, poiseDamage: 40, reaction: 'stagger', hitstop: 7, lunge: 0.15,
    }),
    move({
      id: 'boxing_body_shot', name: 'Body Shot', style: S, button: 'lk', kind: 'light', anim: 'body_shot', limb: 'leadHand',
      startup: 6, active: 3, recovery: 11, damage: 6, staminaCost: 7, reach: 0.7, hitRadius: 0.2, hitY: 1.05, height: 'mid',
      hitstun: 18, blockstun: 9, knockback: 1, poiseDamage: 12, hitstop: 4, lunge: 0.1, staminaDamage: 10,
      next: { lp: 'boxing_hook', hp: 'boxing_cross' },
    }),
    move({
      id: 'boxing_overhand', name: 'Overhand Right', style: S, button: 'hk', kind: 'heavy', anim: 'overhand', limb: 'rearHand',
      startup: 12, active: 4, recovery: 20, damage: 16, staminaCost: 15, reach: 0.85, hitRadius: 0.22, hitY: 1.6,
      hitstun: 24, blockstun: 14, knockback: 3, poiseDamage: 40, reaction: 'stagger', hitstop: 7, lunge: 0.3,
    }),
    // Specials
    move({
      id: 'boxing_liver_shot', name: 'Liver Shot', style: S, button: 'lk', kind: 'special', anim: 'body_shot', limb: 'leadHand',
      startup: 8, active: 3, recovery: 16, damage: 9, staminaCost: 14, reach: 0.72, hitRadius: 0.2, hitY: 1.0, height: 'mid',
      hitstun: 30, blockstun: 12, knockback: 1, poiseDamage: 35, reaction: 'stagger', hitstop: 8, lunge: 0.15, staminaDamage: 35,
    }),
    move({
      id: 'boxing_counter_cross', name: 'Counter Cross', style: S, button: 'hp', kind: 'special', anim: 'cross', limb: 'rearHand',
      startup: 5, active: 3, recovery: 16, damage: 13, staminaCost: 14, reach: 0.88, hitRadius: 0.18,
      hitstun: 24, blockstun: 12, knockback: 2.4, poiseDamage: 32, reaction: 'stagger', hitstop: 7, lunge: 0.15,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_uppercut', 'Inside uppercut', 'clinch_uppercut', 8, 18),
    throwMove(S, 'clinch_spin', 'Spin off', 4),
    clinchStrike(S, 'clinch_hook', 'Inside hook', 'clinch_uppercut', 10, 22),
    getupKick(S),
    finisherMove(S, 'Knockout punch'),
  ),
  starters: { lp: 'boxing_jab', hp: 'boxing_cross', lk: 'boxing_body_shot', hk: 'boxing_overhand' },
  specials: { lk: 'boxing_liver_shot', hp: 'boxing_counter_cross' },
  clinch: { strike: 'boxing_clinch_uppercut', throw: 'boxing_clinch_spin', power: 'boxing_clinch_hook' },
  getupAttack: 'boxing_getup_kick',
  finisher: 'boxing_finisher',
  defence: 'slip',
  defenceName: 'Slip and weave',
  defenceText: 'Dodge slips the punch with head movement: you stay in range to fire back.',
  blockAbsorb: 0.95,
  walkMult: 1.08,
  grappleSkill: 0.8,
};
