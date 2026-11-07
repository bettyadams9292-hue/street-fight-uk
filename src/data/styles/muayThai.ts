import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';
import { clinchStrike, finisherMove, getupKick, grabMove, table, throwMove } from './shared';

const S = 'muay_thai';

/**
 * Muay Thai: the art of eight limbs. Heaviest single hits, devastating
 * clinch, leg kicks that slow you down. Slow footwork.
 * Combo: jab, rear leg kick, roundhouse / elbow into knee.
 */
export const MUAY_THAI: StyleData = {
  id: 'muay_thai',
  name: 'Muay Thai',
  blurb: 'Square stance, deliberate pace. Elbows, knees and shin kicks.',
  strengths: ['Heaviest single hits', 'Deadly clinch knees', 'Leg kicks slow opponents'],
  weaknesses: ['Slow footwork', 'Long recovery on misses'],
  moves: table(
    move({
      id: 'muay_thai_jab', name: 'Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 6, active: 3, recovery: 10, damage: 5, staminaCost: 6, reach: 0.78, hitstun: 18, poiseDamage: 10,
      next: { lk: 'muay_thai_leg_kick', hp: 'muay_thai_elbow' },
    }),
    move({
      id: 'muay_thai_elbow', name: 'Elbow', style: S, button: 'hp', kind: 'heavy', anim: 'elbow', limb: 'elbow',
      startup: 9, active: 3, recovery: 18, damage: 15, staminaCost: 13, reach: 0.55, hitRadius: 0.2, hitY: 1.55,
      hitstun: 26, blockstun: 13, knockback: 2, poiseDamage: 42, reaction: 'stagger', hitstop: 8, lunge: 0.2,
      next: { lk: 'muay_thai_knee' },
    }),
    move({
      id: 'muay_thai_leg_kick', name: 'Leg Kick', style: S, button: 'lk', kind: 'light', anim: 'low_kick', limb: 'rearFoot',
      startup: 9, active: 3, recovery: 15, damage: 9, staminaCost: 9, reach: 0.95, hitRadius: 0.22, hitY: 0.5, height: 'low',
      depthTolerance: 0.5, hitstun: 26, blockstun: 11, knockback: 1.2, poiseDamage: 22, hitstop: 5, slowFrames: 180,
      next: { hk: 'muay_thai_roundhouse' },
    }),
    move({
      id: 'muay_thai_knee', name: 'Knee', style: S, button: 'lk', kind: 'light', anim: 'knee', limb: 'knee',
      startup: 8, active: 3, recovery: 14, damage: 10, staminaCost: 9, reach: 0.55, hitRadius: 0.22, hitY: 1.1, height: 'mid',
      hitstun: 22, knockback: 1.8, poiseDamage: 22, hitstop: 5, lunge: 0.2, staminaDamage: 8,
    }),
    move({
      id: 'muay_thai_roundhouse', name: 'Body Kick', style: S, button: 'hk', kind: 'heavy', anim: 'roundhouse', limb: 'rearFoot',
      startup: 15, active: 4, recovery: 24, damage: 19, staminaCost: 17, reach: 1.1, hitRadius: 0.26, hitY: 1.15, height: 'mid',
      depthTolerance: 0.65, hitstun: 28, knockback: 3.6, poiseDamage: 55, reaction: 'knockdown', hitstop: 9, lunge: 0.15, staminaDamage: 12,
    }),
    move({
      id: 'muay_thai_teep', name: 'Teep', style: S, button: 'lk', kind: 'special', anim: 'teep', limb: 'leadFoot',
      startup: 8, active: 3, recovery: 14, damage: 5, staminaCost: 9, reach: 1.1, hitRadius: 0.22, hitY: 1.05, height: 'mid',
      hitstun: 20, blockstun: 14, knockback: 6.5, poiseDamage: 24, hitstop: 4, lunge: 0,
    }),
    move({
      id: 'muay_thai_jumping_knee', name: 'Jumping Knee', style: S, button: 'hp', kind: 'special', anim: 'knee', limb: 'knee',
      startup: 14, active: 4, recovery: 22, damage: 20, staminaCost: 20, reach: 0.7, hitRadius: 0.25, hitY: 1.45,
      hitstun: 30, knockback: 3.5, poiseDamage: 55, reaction: 'knockdown', hitstop: 10, lunge: 0.6,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_knee', 'Clinch knee', 'clinch_knee', 11, 26),
    throwMove(S, 'clinch_sweep', 'Clinch sweep', 9),
    clinchStrike(S, 'clinch_elbow', 'Clinch elbow', 'clinch_elbow', 14, 34),
    getupKick(S),
    finisherMove(S, 'Elbow from above'),
  ),
  starters: { lp: 'muay_thai_jab', hp: 'muay_thai_elbow', lk: 'muay_thai_leg_kick', hk: 'muay_thai_roundhouse' },
  specials: { lk: 'muay_thai_teep', hp: 'muay_thai_jumping_knee' },
  clinch: { strike: 'muay_thai_clinch_knee', throw: 'muay_thai_clinch_sweep', power: 'muay_thai_clinch_elbow' },
  getupAttack: 'muay_thai_getup_kick',
  finisher: 'muay_thai_finisher',
  defence: 'teep',
  defenceName: 'Teep',
  defenceText: 'Special + LK: a push kick that shoves an opponent back out of range.',
  blockAbsorb: 0.85,
  walkMult: 0.9,
  grappleSkill: 1.3,
};
