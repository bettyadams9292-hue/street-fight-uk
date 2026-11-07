import type { AttackButton } from '../input/Commands';

export type HitHeight = 'high' | 'mid' | 'low';
export type Reaction = 'flinch' | 'stagger' | 'knockdown';
export type Limb = 'leadHand' | 'rearHand' | 'leadFoot' | 'rearFoot' | 'head' | 'knee' | 'elbow' | 'body';

/** Which animation a move uses. Several moves (in different styles) can share one. */
export type AnimKey =
  | 'jab' | 'cross' | 'hook' | 'uppercut' | 'haymaker' | 'body_shot' | 'overhand'
  | 'front_kick' | 'teep' | 'roundhouse' | 'low_kick' | 'side_kick' | 'axe_kick' | 'spin_kick'
  | 'knee' | 'elbow' | 'spin_backfist' | 'headbutt' | 'shove' | 'shoot' | 'grab'
  | 'getup_kick' | 'clinch_knee' | 'clinch_uppercut' | 'clinch_headbutt' | 'clinch_elbow'
  | 'throw' | 'takedown' | 'ground_punch' | 'submission' | 'finisher';

/**
 * One attack, authored as data. Frame counts are at 60 Hz before the
 * fighter's attack-speed multiplier is applied.
 */
export interface MoveData {
  id: string;
  name: string;
  style: string;
  /** Button that performs it from neutral (or in a combo). */
  button: AttackButton;
  kind: 'light' | 'heavy' | 'special' | 'grab' | 'clinch' | 'finisher';
  anim: AnimKey;
  limb: Limb;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  staminaCost: number;
  /** Distance in front of the fighter's centre where the hit sphere sits (m). */
  reach: number;
  hitRadius: number;
  /** Height of the hit sphere above the ground (m). */
  hitY: number;
  height: HitHeight;
  /** Max difference in depth (z) for the hit to connect (m). */
  depthTolerance: number;
  hitstun: number;
  blockstun: number;
  /** Knockback speed applied to the target (m/s). */
  knockback: number;
  poiseDamage: number;
  reaction: Reaction;
  hitstop: number;
  /** Forward step during startup (m). */
  lunge: number;
  /** Next move in the combo graph for each button, if any. */
  next: Partial<Record<AttackButton, string>>;

  // ---- optional effects -----------------------------------------------------
  /** Drains the target's stamina on hit (liver shots, body work). */
  staminaDamage?: number;
  /** Slows the target's movement for this many frames (leg kicks). */
  slowFrames?: number;
  /** Cannot be blocked (grabs, finishers). */
  unblockable?: boolean;
}

/** A move being performed, with frame timings already scaled by attack speed. */
export interface ActiveMove {
  data: MoveData;
  frame: number;
  startup: number;
  active: number;
  recovery: number;
  /** Ids of fighters already hit by this swing (each target is hit once). */
  hitTargets: Set<number>;
  connected: boolean;
}

export function totalFrames(m: ActiveMove): number {
  return m.startup + m.active + m.recovery;
}

/** Frame from which the next combo input can cancel this move. */
export function cancelFrame(m: ActiveMove): number {
  return m.startup + m.active + Math.min(3, m.recovery);
}

export function isActiveFrame(m: ActiveMove): boolean {
  return m.frame >= m.startup && m.frame < m.startup + m.active;
}

export function startMove(data: MoveData, attackSpeed: number): ActiveMove {
  const s = Math.max(0.5, attackSpeed);
  return {
    data,
    frame: 0,
    startup: Math.max(1, Math.round(data.startup / s)),
    active: Math.max(1, Math.round(data.active / s)),
    recovery: Math.max(1, Math.round(data.recovery / s)),
    hitTargets: new Set(),
    connected: false,
  };
}

/** Shorthand for authoring moves: fills sensible defaults. */
export function move(m: Partial<MoveData> & Pick<MoveData, 'id' | 'name' | 'style' | 'button' | 'kind' | 'anim' | 'startup' | 'active' | 'recovery' | 'damage'>): MoveData {
  const heavy = m.kind === 'heavy';
  return {
    limb: 'leadHand',
    staminaCost: heavy ? 16 : 7,
    reach: 0.8,
    hitRadius: 0.18,
    hitY: 1.5,
    height: 'high',
    depthTolerance: 0.45,
    hitstun: heavy ? 24 : 16,
    blockstun: heavy ? 15 : 9,
    knockback: heavy ? 3 : 1.3,
    poiseDamage: heavy ? 38 : 10,
    reaction: heavy ? 'stagger' : 'flinch',
    hitstop: heavy ? 7 : 3,
    lunge: heavy ? 0.25 : 0.05,
    next: {},
    ...m,
  };
}
