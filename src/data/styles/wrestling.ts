import { move } from '../../combat/MoveData';
import type { StyleData } from '../../styles/StyleData';

type BaseStyle = Omit<StyleData, 'air' | 'dash'>;
import { clinchStrike, finisherMove, getupKick, grabMove, groundMoves, table, takedownMove, throwMove } from './shared';

const S = 'wrestling';
const ground = groundMoves(S, 'Neck crank');

/**
 * Wrestling: low, forward, hands out. Takedowns, slams, high poise.
 * LK shoots a double-leg straight to the ground from range.
 */
export const WRESTLING: BaseStyle = {
  id: 'wrestling',
  name: 'Wrestling',
  blurb: 'Low and relentless. Takes people down and keeps them there.',
  strengths: ['Takedowns from range', 'Big slams', 'Hard to knock off balance', 'Sprawl stops grabs'],
  weaknesses: ['Weak striking'],
  moves: table(
    move({
      id: 'wrestling_jab', name: 'Jab', style: S, button: 'lp', kind: 'light', anim: 'jab', limb: 'leadHand',
      startup: 6, active: 3, recovery: 10, damage: 4, staminaCost: 6, reach: 0.75, hitstun: 15, poiseDamage: 8,
      next: { lk: 'wrestling_shoot', hp: 'wrestling_overhand' },
    }),
    move({
      id: 'wrestling_overhand', name: 'Overhand', style: S, button: 'hp', kind: 'heavy', anim: 'overhand', limb: 'rearHand',
      startup: 13, active: 4, recovery: 20, damage: 12, staminaCost: 14, reach: 0.82, hitY: 1.6,
      hitstun: 22, knockback: 2.5, poiseDamage: 32, hitstop: 6, lunge: 0.3,
    }),
    move({
      id: 'wrestling_shoot', name: 'Double-leg', style: S, button: 'lk', kind: 'grab', anim: 'shoot', limb: 'body',
      startup: 10, active: 5, recovery: 26, damage: 0, staminaCost: 16, reach: 0.75, hitRadius: 0.3, hitY: 0.8, height: 'low',
      depthTolerance: 0.45, hitstun: 0, blockstun: 0, knockback: 0, poiseDamage: 0, hitstop: 5, lunge: 0.7, unblockable: true,
    }),
    move({
      id: 'wrestling_knee', name: 'Knee', style: S, button: 'hk', kind: 'heavy', anim: 'knee', limb: 'knee',
      startup: 10, active: 3, recovery: 18, damage: 11, staminaCost: 12, reach: 0.55, hitY: 1.1, height: 'mid',
      hitstun: 22, knockback: 2, poiseDamage: 28, hitstop: 6, lunge: 0.25,
    }),
    move({
      id: 'wrestling_snap_down', name: 'Snap Down', style: S, button: 'hp', kind: 'special', anim: 'shove', limb: 'body',
      startup: 8, active: 3, recovery: 16, damage: 6, staminaCost: 14, reach: 0.6, hitRadius: 0.28, hitY: 1.5,
      hitstun: 28, blockstun: 18, knockback: 0.5, poiseDamage: 45, reaction: 'stagger', hitstop: 6,
    }),
    grabMove(S),
    clinchStrike(S, 'clinch_knee', 'Dirty knee', 'clinch_knee', 6, 14),
    throwMove(S, 'suplex', 'Suplex', 20),
    takedownMove(S, 'body_lock', 'Body-lock takedown', 6),
    ground.strike,
    ground.submission,
    getupKick(S),
    finisherMove(S, 'Slam'),
  ),
  starters: { lp: 'wrestling_jab', hp: 'wrestling_overhand', lk: 'wrestling_shoot', hk: 'wrestling_knee' },
  specials: { hp: 'wrestling_snap_down', lk: 'wrestling_shoot' },
  clinch: { strike: 'wrestling_clinch_knee', throw: 'wrestling_suplex', power: 'wrestling_body_lock' },
  ground: { strike: ground.strike.id, submission: ground.submission.id },
  getupAttack: 'wrestling_getup_kick',
  finisher: 'wrestling_finisher',
  defence: 'sprawl',
  defenceName: 'Sprawl',
  defenceText: 'While blocking you can’t be grabbed or taken down: the attacker is left off balance.',
  blockAbsorb: 0.82,
  walkMult: 0.95,
  grappleSkill: 1.5,
};
