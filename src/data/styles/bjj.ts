import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';
import { clinchStrike, finisherMove, getupKick, grabMove, groundMoves, table, takedownMove, throwMove } from './shared';

const S = 'bjj';
const ground = groundMoves(S, 'Rear-naked choke');

/**
 * Brazilian Jiu-Jitsu: patient, low, grip-seeking. Dominant on the ground,
 * strongest submissions, sweeps opponents from a knockdown.
 */
export const BJJ: StyleData = {
  id: 'bjj',
  name: 'Brazilian Jiu-Jitsu',
  blurb: 'Patient and low. Gets hold, gets it to the floor, finishes there.',
  strengths: ['Strongest submissions', 'Sweeps from the floor', 'Best grapple escapes'],
  weaknesses: ['Poor stand-up striking', 'Struggles against groups'],
  moves: table(
    move({
      id: 'bjj_jab', name: 'Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 6, active: 3, recovery: 11, damage: 4, staminaCost: 6, reach: 0.75, hitstun: 15, poiseDamage: 8,
      next: { lk: 'bjj_single_leg' },
    }),
    move({
      id: 'bjj_cross', name: 'Cross', style: S, button: 'hp', kind: 'light', anim: 'cross', limb: 'rearHand',
      startup: 8, active: 3, recovery: 14, damage: 7, staminaCost: 8, reach: 0.8, hitstun: 18, poiseDamage: 14, hitstop: 4,
      next: { lk: 'bjj_single_leg' },
    }),
    move({
      id: 'bjj_single_leg', name: 'Single-leg', style: S, button: 'lk', kind: 'grab', anim: 'shoot', limb: 'body',
      startup: 11, active: 5, recovery: 26, damage: 0, staminaCost: 15, reach: 0.7, hitRadius: 0.3, hitY: 0.6, height: 'low',
      depthTolerance: 0.45, hitstun: 0, blockstun: 0, knockback: 0, poiseDamage: 0, hitstop: 5, lunge: 0.6, unblockable: true,
    }),
    move({
      id: 'bjj_low_kick', name: 'Low Kick', style: S, button: 'hk', kind: 'light', anim: 'low_kick', limb: 'rearFoot',
      startup: 9, active: 3, recovery: 15, damage: 7, staminaCost: 8, reach: 0.95, hitY: 0.5, height: 'low', hitRadius: 0.22,
      hitstun: 22, knockback: 1.2, poiseDamage: 16, hitstop: 4, slowFrames: 90,
    }),
    move({
      id: 'bjj_shin_kick', name: 'Shin to the Body', style: S, button: 'hp', kind: 'special', anim: 'roundhouse', limb: 'rearFoot',
      startup: 14, active: 4, recovery: 22, damage: 12, staminaCost: 14, reach: 1.05, hitY: 1.1, height: 'mid', hitRadius: 0.24,
      hitstun: 24, knockback: 3, poiseDamage: 32, reaction: 'stagger', hitstop: 7,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_knee', 'Knee', 'clinch_knee', 5, 12),
    throwMove(S, 'hip_throw', 'Hip throw', 12),
    takedownMove(S, 'guard_pull', 'Pull to the floor', 3),
    ground.strike,
    ground.submission,
    getupKick(S),
    finisherMove(S, 'Choke out'),
  ),
  starters: { lp: 'bjj_jab', hp: 'bjj_cross', lk: 'bjj_single_leg', hk: 'bjj_low_kick' },
  specials: { hp: 'bjj_shin_kick', lk: 'bjj_single_leg' },
  clinch: { strike: 'bjj_clinch_knee', throw: 'bjj_hip_throw', power: 'bjj_guard_pull' },
  ground: { strike: ground.strike.id, submission: ground.submission.id },
  getupAttack: 'bjj_getup_kick',
  finisher: 'bjj_finisher',
  defence: 'guard_pull',
  defenceName: 'Sweep from the floor',
  defenceText: 'When knocked down, press GRAB with an opponent close by to sweep them off their feet.',
  blockAbsorb: 0.8,
  walkMult: 0.95,
  grappleSkill: 1.45,
};
