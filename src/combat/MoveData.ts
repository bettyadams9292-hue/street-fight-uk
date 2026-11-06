import type { AttackButton } from '../input/Commands';

export type HitHeight = 'high' | 'mid' | 'low';
export type Reaction = 'flinch' | 'stagger' | 'knockdown';
export type Limb = 'leadHand' | 'rearHand' | 'leadFoot' | 'rearFoot';

/**
 * One attack, authored as data. Frame counts are at 60 Hz before the
 * fighter's attack-speed multiplier is applied.
 */
export interface MoveData {
  id: string;
  name: string;
  style: string;
  button: AttackButton;
  kind: 'light' | 'heavy';
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
  /** Forward step during startup (m), gives heavies their lunge. */
  lunge: number;
  /** Next move in the combo graph for each button, if any. */
  next: Partial<Record<AttackButton, string>>;
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
