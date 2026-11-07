import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';

type BaseStyle = Omit<StyleData, 'air' | 'dash'>;
import { clinchStrike, finisherMove, getupKick, grabMove, table, throwMove } from './shared';

const S = 'kickboxing';

/**
 * Kickboxing: punches and kicks, range control, flexible combos.
 * Combo: jab, cross, low kick, roundhouse.
 */
export const KICKBOXING: BaseStyle = {
  id: 'kickboxing',
  name: 'Kickboxing',
  blurb: 'Upright stance, punches flowing into kicks. Controls range.',
  strengths: ['Long, flexible combos', 'Good reach', 'Checks leg kicks'],
  weaknesses: ['Average in the clinch', 'Nothing on the ground'],
  moves: table(
    move({
      id: 'kickboxing_jab', name: 'Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 5, active: 3, recovery: 9, damage: 5, staminaCost: 5, reach: 0.8, hitstun: 16, poiseDamage: 9,
      next: { hp: 'kickboxing_cross', lk: 'kickboxing_low_kick', hk: 'kickboxing_roundhouse' },
    }),
    move({
      id: 'kickboxing_cross', name: 'Cross', style: S, button: 'hp', kind: 'light', anim: 'cross', limb: 'rearHand',
      startup: 6, active: 3, recovery: 12, damage: 8, staminaCost: 8, reach: 0.84, hitstun: 22, poiseDamage: 16, hitstop: 4, lunge: 0.12,
      next: { lk: 'kickboxing_low_kick', hk: 'kickboxing_roundhouse' },
    }),
    move({
      id: 'kickboxing_low_kick', name: 'Low Kick', style: S, button: 'lk', kind: 'light', anim: 'low_kick', limb: 'rearFoot',
      startup: 8, active: 3, recovery: 13, damage: 7, staminaCost: 8, reach: 0.95, hitRadius: 0.22, hitY: 0.5, height: 'low',
      depthTolerance: 0.5, hitstun: 24, blockstun: 10, knockback: 1.2, poiseDamage: 16, hitstop: 4, slowFrames: 120,
      next: { hk: 'kickboxing_roundhouse', lp: 'kickboxing_jab' },
    }),
    move({
      id: 'kickboxing_roundhouse', name: 'Roundhouse', style: S, button: 'hk', kind: 'heavy', anim: 'roundhouse', limb: 'rearFoot',
      startup: 14, active: 4, recovery: 22, damage: 15, staminaCost: 16, reach: 1.15, hitRadius: 0.24, hitY: 1.4,
      depthTolerance: 0.65, hitstun: 26, knockback: 3.8, poiseDamage: 42, reaction: 'knockdown', hitstop: 8, lunge: 0.2,
    }),
    move({
      id: 'kickboxing_switch_kick', name: 'Switch Kick', style: S, button: 'hk', kind: 'special', anim: 'roundhouse', limb: 'leadFoot',
      startup: 10, active: 4, recovery: 20, damage: 14, staminaCost: 16, reach: 1.1, hitRadius: 0.24, hitY: 1.5,
      depthTolerance: 0.6, hitstun: 26, knockback: 3.4, poiseDamage: 40, reaction: 'stagger', hitstop: 7, lunge: 0.2,
    }),
    move({
      id: 'kickboxing_spin_backfist', name: 'Spinning Backfist', style: S, button: 'hp', kind: 'special', anim: 'spin_backfist', limb: 'rearHand',
      startup: 13, active: 4, recovery: 20, damage: 16, staminaCost: 18, reach: 0.95, hitRadius: 0.24, hitY: 1.55,
      depthTolerance: 0.7, hitstun: 28, knockback: 3.5, poiseDamage: 48, reaction: 'knockdown', hitstop: 9, lunge: 0.35,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_knee', 'Clinch knee', 'clinch_knee', 8, 18),
    throwMove(S, 'clinch_dump', 'Clinch dump', 8),
    clinchStrike(S, 'clinch_knee_2', 'Double knee', 'clinch_knee', 11, 24),
    getupKick(S),
    finisherMove(S, 'Head kick'),
  ),
  starters: { lp: 'kickboxing_jab', hp: 'kickboxing_cross', lk: 'kickboxing_low_kick', hk: 'kickboxing_roundhouse' },
  specials: { hk: 'kickboxing_switch_kick', hp: 'kickboxing_spin_backfist' },
  clinch: { strike: 'kickboxing_clinch_knee', throw: 'kickboxing_clinch_dump', power: 'kickboxing_clinch_knee_2' },
  getupAttack: 'kickboxing_getup_kick',
  finisher: 'kickboxing_finisher',
  defence: 'check',
  defenceName: 'Check',
  defenceText: 'Blocking kicks takes no chip damage and leaves the kicker open for longer.',
  blockAbsorb: 0.88,
  walkMult: 1.04,
  grappleSkill: 0.9,
};
