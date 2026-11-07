import { move, type MoveData } from '../../combat/MoveData';

/** Moves every style has a version of: grab, get-up attack, finisher, clinch and ground moves. */

export function grabMove(style: string): MoveData {
  return move({
    id: `${style}_grab`, name: 'Grab', style, button: 'lp', kind: 'grab', anim: 'grab', limb: 'body',
    startup: 6, active: 4, recovery: 22, damage: 0, staminaCost: 10, reach: 0.55, hitRadius: 0.25, hitY: 1.3,
    height: 'mid', depthTolerance: 0.4, hitstun: 0, blockstun: 0, knockback: 0, poiseDamage: 0, hitstop: 4, lunge: 0.15,
    unblockable: true,
  });
}

export function getupKick(style: string): MoveData {
  return move({
    id: `${style}_getup_kick`, name: 'Get-up kick', style, button: 'lk', kind: 'light', anim: 'getup_kick', limb: 'leadFoot',
    startup: 8, active: 4, recovery: 18, damage: 7, staminaCost: 8, reach: 0.95, hitY: 0.6, height: 'low', hitRadius: 0.22,
    depthTolerance: 0.55, knockback: 2.5, poiseDamage: 14,
  });
}

export function finisherMove(style: string, name: string): MoveData {
  return move({
    id: `${style}_finisher`, name, style, button: 'hp', kind: 'finisher', anim: 'finisher', limb: 'rearHand',
    startup: 10, active: 4, recovery: 30, damage: 999, staminaCost: 0, reach: 0.9, hitRadius: 0.4, hitY: 1.3,
    depthTolerance: 0.7, hitstun: 30, knockback: 5, poiseDamage: 999, reaction: 'knockdown', hitstop: 14, lunge: 0.35,
    unblockable: true,
  });
}

/** Clinch strikes always reach the opponent you're holding. */
export function clinchStrike(style: string, id: string, name: string, anim: MoveData['anim'], damage: number, poise: number): MoveData {
  return move({
    id: `${style}_${id}`, name, style, button: 'lp', kind: 'clinch', anim, limb: anim === 'clinch_knee' ? 'knee' : 'head',
    startup: 7, active: 3, recovery: 12, damage, staminaCost: 8, reach: 0.45, hitRadius: 0.3, hitY: 1.1,
    hitstun: 0, poiseDamage: poise, knockback: 0, hitstop: 4, lunge: 0, depthTolerance: 0.6,
  });
}

/** Throw out of the clinch: ends it and puts the opponent on the floor. */
export function throwMove(style: string, id: string, name: string, damage: number, anim: MoveData['anim'] = 'throw'): MoveData {
  return move({
    id: `${style}_${id}`, name, style, button: 'lk', kind: 'clinch', anim, limb: 'body',
    startup: 12, active: 3, recovery: 22, damage, staminaCost: 14, reach: 0.45, hitRadius: 0.3, hitY: 1.1,
    reaction: 'knockdown', knockback: 2.5, poiseDamage: 999, hitstop: 8, lunge: 0, depthTolerance: 0.6,
  });
}

/** Takedown from the clinch to the ground (top position). */
export function takedownMove(style: string, id: string, name: string, damage: number): MoveData {
  return move({
    id: `${style}_${id}`, name, style, button: 'hk', kind: 'clinch', anim: 'takedown', limb: 'body',
    startup: 14, active: 3, recovery: 10, damage, staminaCost: 16, reach: 0.45, hitRadius: 0.3, hitY: 1.0,
    reaction: 'knockdown', knockback: 0, poiseDamage: 999, hitstop: 8, lunge: 0, depthTolerance: 0.6,
  });
}

export function groundMoves(style: string, subName: string): { strike: MoveData; submission: MoveData } {
  return {
    strike: move({
      id: `${style}_ground_punch`, name: 'Ground strike', style, button: 'lp', kind: 'clinch', anim: 'ground_punch', limb: 'rearHand',
      startup: 6, active: 3, recovery: 10, damage: 5, staminaCost: 6, reach: 0.5, hitRadius: 0.3, hitY: 0.3, hitstun: 0,
      knockback: 0, poiseDamage: 0, hitstop: 4, lunge: 0, depthTolerance: 0.8,
    }),
    submission: move({
      id: `${style}_submission`, name: subName, style, button: 'hp', kind: 'clinch', anim: 'submission', limb: 'body',
      startup: 10, active: 1, recovery: 4, damage: 0, staminaCost: 12, reach: 0.5, hitRadius: 0.3, hitY: 0.3, hitstun: 0,
      knockback: 0, poiseDamage: 0, hitstop: 0, lunge: 0, depthTolerance: 0.8,
    }),
  };
}

export function jumpPunch(style: string): MoveData {
  return move({
    id: `${style}_jump_punch`, name: 'Jumping punch', style, button: 'lp', kind: 'light', anim: 'overhand', limb: 'rearHand',
    startup: 5, active: 6, recovery: 10, damage: 9, staminaCost: 8, reach: 0.7, hitRadius: 0.26, hitY: 1.3,
    depthTolerance: 0.55, hitstun: 20, knockback: 2.2, poiseDamage: 18, hitstop: 5, lunge: 0,
  });
}

export function jumpKick(style: string): MoveData {
  return move({
    id: `${style}_jump_kick`, name: 'Flying kick', style, button: 'lk', kind: 'heavy', anim: 'side_kick', limb: 'leadFoot',
    startup: 6, active: 8, recovery: 12, damage: 14, staminaCost: 14, reach: 0.95, hitRadius: 0.3, hitY: 0.9,
    depthTolerance: 0.6, hitstun: 26, knockback: 4.5, poiseDamage: 45, reaction: 'knockdown', hitstop: 8, lunge: 0,
  });
}

/** Forward + heavy punch: a stepping lunge that covers distance and knocks back. */
export function dashStrike(style: string): MoveData {
  return move({
    id: `${style}_dash_strike`, name: 'Lunging strike', style, button: 'hp', kind: 'heavy', anim: 'cross', limb: 'rearHand',
    startup: 12, active: 4, recovery: 22, damage: 15, staminaCost: 15, reach: 0.9, hitRadius: 0.24, hitY: 1.45,
    depthTolerance: 0.55, hitstun: 26, knockback: 4.5, poiseDamage: 40, reaction: 'stagger', hitstop: 7, lunge: 1.1,
  });
}

export function table(...moves: MoveData[]): Record<string, MoveData> {
  return Object.fromEntries(moves.map((m) => [m.id, m]));
}
