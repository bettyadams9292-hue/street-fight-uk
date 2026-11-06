import type { MoveData, Reaction } from '../combat/MoveData';
import type { Fighter } from '../fighter/Fighter';

export interface HitInfo {
  attacker: Fighter;
  target: Fighter;
  move: MoveData;
  damage: number;
  blocked: boolean;
  clean: boolean;
  reaction: Reaction | 'block' | 'guardbreak' | 'ko';
  /** Consecutive hits landed while the target was still reeling. */
  comboHits: number;
  x: number;
  y: number;
  z: number;
}

/** Every event the simulation broadcasts. Subscribers: HUD, audio, FX, AI, (later) missions and XP. */
export interface GameEvents {
  'move:started': { fighter: Fighter; move: MoveData };
  'hit:landed': HitInfo;
  'hit:blocked': HitInfo;
  'guard:broken': { fighter: Fighter; by: Fighter };
  'fighter:knockdown': { fighter: Fighter };
  'fighter:getup': { fighter: Fighter };
  'fighter:ko': { fighter: Fighter; by: Fighter | null };
  'fighter:jump': { fighter: Fighter };
  'fighter:land': { fighter: Fighter };
  'fighter:fatigue': { fighter: Fighter; state: 'fresh' | 'tired' | 'exhausted' };
  'action:refused': { fighter: Fighter; reason: 'exhausted' };
  'fighter:respawn': { fighter: Fighter };
}
