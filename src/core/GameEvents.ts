import type { MoveData, Reaction } from '../combat/MoveData';
import type { Fighter } from '../fighter/Fighter';
import type { StyleData } from '../styles/StyleData';

export interface HitInfo {
  attacker: Fighter;
  target: Fighter;
  move: MoveData;
  damage: number;
  blocked: boolean;
  clean: boolean;
  /** Landed inside the counter window after a parry. */
  counter: boolean;
  reaction: Reaction | 'block' | 'guardbreak' | 'ko' | 'check';
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
  'hit:parried': { attacker: Fighter; target: Fighter; move: MoveData };
  'guard:broken': { fighter: Fighter; by: Fighter };
  'fighter:knockdown': { fighter: Fighter };
  'fighter:getup': { fighter: Fighter };
  'fighter:ko': { fighter: Fighter; by: Fighter | null };
  'fighter:finished': { fighter: Fighter; by: Fighter; move: MoveData };
  'fighter:jump': { fighter: Fighter };
  'fighter:land': { fighter: Fighter };
  /** A readable warning of what a fighter is about to do (an enemy getting ready to parry). */
  'fighter:tell': { fighter: Fighter; kind: 'parry' };
  'fighter:dodge': { fighter: Fighter; kind: 'slip' | 'sidestep' | 'backstep' | 'blitz' };
  'fighter:sweep': { fighter: Fighter; target: Fighter };
  'fighter:fatigue': { fighter: Fighter; state: 'fresh' | 'tired' | 'exhausted' };
  'style:swapped': { fighter: Fighter; style: StyleData };
  'action:refused': { fighter: Fighter; reason: 'exhausted' };
  'fighter:respawn': { fighter: Fighter };
  'grapple:start': { holder: Fighter; held: Fighter; phase: 'clinch' | 'ground' };
  'grapple:end': { holder: Fighter; held: Fighter; reason: string };
  'grapple:escape': { holder: Fighter; held: Fighter };
  'grapple:escape_failed': { holder: Fighter; held: Fighter };
  'grapple:sprawl': { attacker: Fighter; defender: Fighter };
  'grapple:throw': { holder: Fighter; held: Fighter; damage: number; wall: boolean };
  'grapple:takedown': { holder: Fighter; held: Fighter; damage: number };
  'submission:start': { holder: Fighter; held: Fighter };
  submission: { holder: Fighter; held: Fighter; damage: number };
  'weapon:thrown': { fighter: Fighter; name: string };
  'weapon:broken': { fighter: Fighter; name: string; smashed: boolean };
}
