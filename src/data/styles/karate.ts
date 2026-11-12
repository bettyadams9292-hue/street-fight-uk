import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';

type BaseStyle = Omit<StyleData, 'air' | 'dash'>;
import { clinchStrike, finisherMove, getupKick, grabMove, table, throwMove } from './shared';

const S = 'karate';

/**
 * Karate: long bladed stance, explosive entries, single decisive strikes.
 * Short combos, but the best counter-fighter: parries open a longer counter window.
 */
export const KARATE: BaseStyle = {
  id: 'karate',
  name: 'Karate',
  blurb: 'Long, bladed stance. Blitzes in, scores, and is gone.',
  strengths: ['Distance control', 'Strongest counters', 'Fast, long-range strikes'],
  weaknesses: ['Short combos', 'Poor in a clinch'],
  moves: table(
    move({
      id: 'karate_kizami', name: 'Lunge Punch', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 5, active: 3, recovery: 10, damage: 6, staminaCost: 6, reach: 0.95, hitstun: 16, poiseDamage: 10, lunge: 0.25,
      next: { hp: 'karate_reverse_punch' },
    }),
    move({
      id: 'karate_reverse_punch', name: 'Reverse Punch', style: S, button: 'hp', kind: 'heavy', anim: 'cross', limb: 'rearHand',
      startup: 7, active: 3, recovery: 18, damage: 14, staminaCost: 12, reach: 0.95, hitRadius: 0.18,
      hitstun: 24, knockback: 2.8, poiseDamage: 34, reaction: 'stagger', hitstop: 7, lunge: 0.3,
    }),
    move({
      id: 'karate_front_kick', name: 'Front Kick', style: S, button: 'lk', kind: 'light', anim: 'front_kick', limb: 'rearFoot',
      startup: 8, active: 3, recovery: 13, damage: 9, staminaCost: 8, reach: 1.15, hitRadius: 0.2, hitY: 1.05, height: 'mid',
      hitstun: 22, knockback: 2.6, poiseDamage: 16, hitstop: 4,
      next: { hk: 'karate_roundhouse' },
    }),
    move({
      id: 'karate_roundhouse', name: 'Head Kick', style: S, button: 'hk', kind: 'heavy', anim: 'roundhouse', limb: 'rearFoot',
      startup: 13, active: 4, recovery: 22, damage: 17, staminaCost: 16, reach: 1.2, hitRadius: 0.24, hitY: 1.6,
      depthTolerance: 0.6, hitstun: 28, knockback: 3.8, poiseDamage: 45, reaction: 'knockdown', hitstop: 9, lunge: 0.15,
    }),
    move({
      id: 'karate_side_kick', name: 'Side Kick', style: S, button: 'lk', kind: 'special', anim: 'side_kick', limb: 'leadFoot',
      startup: 11, active: 4, recovery: 18, damage: 12, staminaCost: 13, reach: 1.25, hitRadius: 0.24, hitY: 1.1, height: 'mid',
      hitstun: 24, blockstun: 16, knockback: 5.5, poiseDamage: 35, reaction: 'stagger', hitstop: 7, lunge: 0.1,
    }),
    move({
      id: 'karate_axe_kick', name: 'Axe Kick', style: S, button: 'hk', kind: 'special', anim: 'axe_kick', limb: 'rearFoot',
      startup: 17, active: 4, recovery: 22, damage: 20, staminaCost: 19, reach: 0.95, hitRadius: 0.26, hitY: 1.6,
      hitstun: 30, knockback: 2, poiseDamage: 60, reaction: 'knockdown', hitstop: 10, lunge: 0.2,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_elbow', 'Short elbow', 'clinch_elbow', 7, 16),
    throwMove(S, 'foot_sweep', 'Foot sweep', 8),
    clinchStrike(S, 'clinch_palm', 'Palm strike', 'clinch_uppercut', 8, 18),
    getupKick(S),
    finisherMove(S, 'Finishing punch'),
  ),
  starters: { lp: 'karate_kizami', hp: 'karate_reverse_punch', lk: 'karate_front_kick', hk: 'karate_roundhouse' },
  specials: { lk: 'karate_side_kick', hk: 'karate_axe_kick' },
  clinch: { strike: 'karate_clinch_elbow', throw: 'karate_foot_sweep', power: 'karate_clinch_palm' },
  getupAttack: 'karate_getup_kick',
  finisher: 'karate_finisher',
  defence: 'blitz',
  defenceName: 'Blitz',
  defenceText: 'Dodge is a long dash in the direction you hold: in to strike or out of range. Parries open a longer counter window.',
  blockAbsorb: 0.85,
  walkMult: 1.05,
  grappleSkill: 0.75,
};
