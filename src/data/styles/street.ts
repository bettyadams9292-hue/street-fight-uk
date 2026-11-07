import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';
import { clinchStrike, finisherMove, getupKick, grabMove, table, throwMove } from './shared';

const S = 'street';

/**
 * Street Fighting: the style every player starts with. Loose, scrappy,
 * heavy-handed, dirty. Combos: jab, jab, hook, haymaker / jab or front kick into roundhouse.
 */
export const STREET: StyleData = {
  id: 'street',
  name: 'Street Fighting',
  blurb: 'Loose, scrappy and opportunistic. Throws whatever works.',
  strengths: ['Big single hits', 'Dirty moves: headbutts and shoves', 'Throws people into walls'],
  weaknesses: ['Burns stamina fast', 'Sloppy defence'],
  moves: table(
    move({
      id: 'street_jab', name: 'Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 5, active: 3, recovery: 9, damage: 5, staminaCost: 6, reach: 0.78, hitRadius: 0.16, hitY: 1.5,
      hitstun: 15, blockstun: 9, knockback: 1.2, poiseDamage: 9, hitstop: 3, lunge: 0.05,
      next: { lp: 'street_jab_2', hp: 'street_haymaker', lk: 'street_front_kick' },
    }),
    move({
      id: 'street_jab_2', name: 'Double Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 4, active: 3, recovery: 10, damage: 5, staminaCost: 6, reach: 0.8, hitRadius: 0.16, hitY: 1.5,
      hitstun: 16, blockstun: 9, knockback: 1.2, poiseDamage: 9, hitstop: 3, lunge: 0.08,
      next: { lp: 'street_hook', hp: 'street_haymaker', lk: 'street_front_kick' },
    }),
    move({
      id: 'street_hook', name: 'Rear Hook', style: S, button: 'lp', kind: 'light', anim: 'hook', limb: 'rearHand',
      startup: 7, active: 3, recovery: 14, damage: 9, staminaCost: 9, reach: 0.7, hitRadius: 0.2, hitY: 1.5,
      depthTolerance: 0.55, hitstun: 24, blockstun: 11, knockback: 1.6, poiseDamage: 18, hitstop: 5, lunge: 0.1,
      next: { hp: 'street_haymaker' },
    }),
    move({
      id: 'street_haymaker', name: 'Haymaker', style: S, button: 'hp', kind: 'heavy', anim: 'haymaker', limb: 'rearHand',
      startup: 14, active: 4, recovery: 22, damage: 18, staminaCost: 16, reach: 0.85, hitRadius: 0.22, hitY: 1.5,
      depthTolerance: 0.55, hitstun: 24, blockstun: 15, knockback: 3.5, poiseDamage: 40, reaction: 'stagger', hitstop: 7, lunge: 0.3,
    }),
    move({
      id: 'street_front_kick', name: 'Front Kick', style: S, button: 'lk', kind: 'light', anim: 'front_kick', limb: 'leadFoot',
      startup: 9, active: 3, recovery: 14, damage: 9, staminaCost: 8, reach: 1.05, hitRadius: 0.2, hitY: 1.0, height: 'mid',
      hitstun: 24, blockstun: 11, knockback: 2.2, poiseDamage: 15, hitstop: 4, lunge: 0.05,
      next: { hk: 'street_roundhouse', lp: 'street_jab' },
    }),
    move({
      id: 'street_roundhouse', name: 'Roundhouse', style: S, button: 'hk', kind: 'heavy', anim: 'roundhouse', limb: 'rearFoot',
      startup: 16, active: 4, recovery: 24, damage: 16, staminaCost: 18, reach: 1.12, hitRadius: 0.24, hitY: 1.35,
      depthTolerance: 0.65, hitstun: 26, blockstun: 16, knockback: 4.0, poiseDamage: 45, reaction: 'knockdown', hitstop: 8, lunge: 0.2,
    }),
    // Specials
    move({
      id: 'street_shove', name: 'Shove', style: S, button: 'lp', kind: 'special', anim: 'shove', limb: 'body',
      startup: 6, active: 3, recovery: 12, damage: 1, staminaCost: 8, reach: 0.65, hitRadius: 0.3, hitY: 1.3, height: 'mid',
      depthTolerance: 0.5, hitstun: 20, blockstun: 16, knockback: 6, poiseDamage: 25, hitstop: 3, lunge: 0,
    }),
    move({
      id: 'street_headbutt', name: 'Headbutt', style: S, button: 'hp', kind: 'special', anim: 'headbutt', limb: 'head',
      startup: 9, active: 3, recovery: 18, damage: 15, staminaCost: 18, reach: 0.5, hitRadius: 0.2, hitY: 1.6,
      hitstun: 28, blockstun: 12, knockback: 2, poiseDamage: 50, reaction: 'stagger', hitstop: 8, lunge: 0.25,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_headbutt', 'Clinch headbutt', 'clinch_headbutt', 8, 20),
    throwMove(S, 'wall_throw', 'Wall throw', 14),
    clinchStrike(S, 'clinch_uppercut', 'Dirty uppercut', 'clinch_uppercut', 10, 22),
    getupKick(S),
    finisherMove(S, 'Lights out'),
  ),
  starters: { lp: 'street_jab', hp: 'street_haymaker', lk: 'street_front_kick', hk: 'street_roundhouse' },
  specials: { lp: 'street_shove', hp: 'street_headbutt' },
  clinch: { strike: 'street_clinch_headbutt', throw: 'street_wall_throw', power: 'street_clinch_uppercut' },
  getupAttack: 'street_getup_kick',
  finisher: 'street_finisher',
  defence: 'shove',
  defenceName: 'Shove',
  defenceText: 'Special + LP shoves an opponent away to make space.',
  blockAbsorb: 0.8,
  walkMult: 1,
  grappleSkill: 1,
};
