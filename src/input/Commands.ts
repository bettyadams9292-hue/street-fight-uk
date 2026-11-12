/**
 * The command interface every fighter is driven by. The player's input
 * devices and the AI both produce a CommandFrame per simulation step, so
 * enemies follow exactly the same rules as the player.
 */
export type AttackButton = 'lp' | 'hp' | 'lk' | 'hk';
export const ATTACK_BUTTONS: readonly AttackButton[] = ['lp', 'hp', 'lk', 'hk'];
export type PressButton = AttackButton | 'jump' | 'dodge' | 'grab' | 'swap';

export interface CommandFrame {
  /** -1 (left) .. 1 (right) */
  moveX: number;
  /** -1 (into the screen) .. 1 (towards the camera) */
  moveZ: number;
  /** Held */
  block: boolean;
  /**
   * The block is a plain guard, not a parry attempt: pressing it doesn't open
   * the parry window. Enemies set this when they mean to block, so a late but
   * ordinary block never turns into a perfect parry. Players never set it.
   */
  guard?: boolean;
  /** Held: turns attack buttons into specials (and Special + HP into a finisher). */
  special: boolean;
  /** Pressed this frame */
  pressed: Record<PressButton, boolean>;
}

export function emptyCommand(): CommandFrame {
  return {
    moveX: 0,
    moveZ: 0,
    block: false,
    special: false,
    pressed: { lp: false, hp: false, lk: false, hk: false, jump: false, dodge: false, grab: false, swap: false },
  };
}
